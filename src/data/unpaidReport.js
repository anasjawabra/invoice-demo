// ============================================================================
// Tahseel unpaid-report pipeline and the numeric BRIDGE to net uncollected.
//
// The Tahseel unpaid report is LINE-LEVEL: the invoice value is repeated on every
// line of the invoice. Summing the report as-is therefore overstates the debt, so
// the pipeline first de-duplicates to ONE row per invoice number (IDs are text).
//
//   report figure (de-duplicated, at the report date)
//     − reconciliation differences   (payments / credit notes after the report date)
//     − cancelled                    (status "ملغاة" in the detail report)
//     − excluded, non-overlapping    (approved reasons; amounts already counted as
//                                     cancelled are NOT deducted a second time)
//     + invoices issued after the report date (still unpaid)
//     + internal-scope (Amanah report) uncollected, which Tahseel does not carry
//     = net uncollected
//
// Report invoices that cannot be matched in the detail report are shown
// SEPARATELY — they are neither deducted nor silently added to the net.
// ============================================================================
import { DATA_CUTOFF } from './revenueLedger';
import { prevMonthEnd } from './clock';

// The unpaid report is the one printed at the end of the previous month (real Riyadh date).
const REPORT_DATE = prevMonthEnd(DATA_CUTOFF);
import { normalizeConfig, deriveRecord, applyReviewDecisions, scopeLedger, normalizeScope } from './revenueMetrics';

// Report-only invoice numbers: they exist in the unpaid report but not in the detail report. (Illustrative demo rows.)
export const UNMATCHED_REPORT_ROWS = [
  { invoiceNo: '0001234567890', amount: 48200, lines: 2, hint: 'رقم فاتورة غير موجود في تقرير التفاصيل' },
  { invoiceNo: '0001234567931', amount: 112750, lines: 1, hint: 'رقم فاتورة غير موجود في تقرير التفاصيل' },
  { invoiceNo: '0001234568004', amount: 9800, lines: 1, hint: 'رقم فاتورة غير موجود في تقرير التفاصيل' },
  { invoiceNo: '0001234568112', amount: 176300, lines: 3, hint: 'رقم فاتورة غير موجود في تقرير التفاصيل' }
];

const paidUpTo = (rec, date) => rec.payments.filter((p) => p.date <= date).reduce((s, p) => s + p.amount, 0);
const adjUpTo = (rec, date) => rec.adjustments.filter((a) => a.date <= date).reduce((s, a) => s + a.amount, 0);
const remainingAt = (rec, date) => Math.max(0, rec.grossAmount + adjUpTo(rec, date) - paidUpTo(rec, date));

export const textKey = (v) => String(v ?? '').trim();

/* ---------- Step 1: the unpaid report as Tahseel prints it (line level) ---------- */
export function buildUnpaidReport(ledger, { reportDate = REPORT_DATE, includeUnmatched = true } = {}) {
  const lines = [];
  const invoices = [];
  for (const rec of ledger) {
    if (rec.scopeType !== 'central') continue;
    if (rec.issueDate > reportDate) continue;
    if (rec.cancelled && rec.cancelled.date <= reportDate) continue; // already cancelled before the report was run
    const rem = remainingAt(rec, reportDate);
    if (rem <= 0) continue;
    invoices.push({ rec, invoiceNo: rec.id, remaining: rem });
    for (const li of rec.lineItems) {
      // the invoice value is REPEATED on every line (this is what the real report does)
      lines.push({ invoiceNo: rec.id, sadadNo: rec.sadadNo, subscriptionNo: rec.subscriptionNo, lineNo: li.no, item: li.name, lineAmount: li.amount, invoiceValue: rem, amanah: null });
    }
  }
  for (const u of includeUnmatched ? UNMATCHED_REPORT_ROWS : []) {
    for (let i = 1; i <= u.lines; i += 1) lines.push({ invoiceNo: u.invoiceNo, sadadNo: null, subscriptionNo: null, lineNo: i, item: '—', lineAmount: Math.round(u.amount / u.lines), invoiceValue: u.amount, amanah: null });
  }
  const naiveSum = lines.reduce((s, l) => s + l.invoiceValue, 0);
  return { reportDate, lines, invoices, naiveSum };
}

// De-duplicate to one row per invoice number (the value repeated on each line is taken ONCE).
export function dedupeReportLines(lines) {
  const byInvoice = new Map();
  const conflicts = [];
  for (const l of lines) {
    const key = textKey(l.invoiceNo);
    const prev = byInvoice.get(key);
    if (!prev) byInvoice.set(key, { invoiceNo: key, invoiceValue: l.invoiceValue, lines: 1, lineTotal: l.lineAmount });
    else {
      prev.lines += 1; prev.lineTotal += l.lineAmount;
      if (prev.invoiceValue !== l.invoiceValue) conflicts.push(key);
    }
  }
  const rows = [...byInvoice.values()];
  return { rows, conflicts, total: rows.reduce((s, r) => s + r.invoiceValue, 0) };
}

/* ---------- Steps 2-6: reconcile to the detail report and build the bridge ---------- */
export function buildBridge(ledger, { cfg: cfgIn = {}, scope = {}, decisions = {}, reportDate = REPORT_DATE } = {}) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope({ ...scope, from: '2000-01-01', to: cfg.cutoff }, cfg);
  const all = scopeLedger(applyReviewDecisions(ledger, decisions), sc, cfg);
  // Report-only rows carry no Amanah, so they can only be shown for the national, all-source view.
  const national = sc.amanah === 'all' && sc.source === 'all' && !sc.org?.amanahKeys;
  const report = buildUnpaidReport(all, { reportDate, includeUnmatched: national });
  const dedupe = dedupeReportLines(report.lines);
  const unmatchedKeys = new Set(UNMATCHED_REPORT_ROWS.map((u) => u.invoiceNo));
  const matchedRows = dedupe.rows.filter((r) => !unmatchedKeys.has(r.invoiceNo));
  const unmatchedRows = dedupe.rows.filter((r) => unmatchedKeys.has(r.invoiceNo));

  const byId = new Map(all.map((r) => [r.id, r]));
  let reportMatched = 0;
  let paidAfter = 0; let creditAfter = 0;
  let cancelled = 0; let cancelledCount = 0;
  let excludedNonOverlap = 0; let excludedCount = 0; let excludedApproved = 0; let excludedUnapproved = 0;
  let overlapAmount = 0; let overlapCount = 0;
  let netFromReport = 0;
  const reportIds = new Set();
  const perInvoice = [];

  for (const r of matchedRows) {
    const rec = byId.get(r.invoiceNo);
    if (!rec) continue;
    reportIds.add(rec.id);
    const d = deriveRecord(rec, cfg, null);
    const r0 = r.invoiceValue;
    const rawR1 = Math.max(0, d.billedAfterAdj - d.received);
    reportMatched += r0;
    const diff = r0 - rawR1; // reconciliation: payments + credit notes between the report date and the cutoff
    const payPart = Math.max(0, paidUpTo(rec, cfg.cutoff) - paidUpTo(rec, reportDate));
    const adjPart = diff - payPart;
    paidAfter += payPart; creditAfter += adjPart;
    let cancelledPart = 0; let excludedPart = 0; let net = 0;
    if (d.cancelled) {
      cancelledPart = rawR1; cancelled += rawR1; cancelledCount += 1;
      if (d.overlapsCancelled) { overlapCount += 1; overlapAmount += rawR1; }
    } else if (d.excluded) {
      excludedPart = rawR1; excludedNonOverlap += rawR1; excludedCount += 1;
      if (d.exclusion.approval === 'approved') excludedApproved += rawR1; else excludedUnapproved += rawR1;
    } else net = d.outstanding;
    netFromReport += net;
    perInvoice.push({ invoiceNo: rec.id, reportValue: r0, reconciled: diff, cancelled: cancelledPart, excluded: excludedPart, net });
  }

  // invoices issued after the report date that remain unpaid; and internal-scope (not in Tahseel)
  let newInvoices = 0; let newCount = 0; let internal = 0; let internalCount = 0; let centralBefore = 0;
  for (const rec of all) {
    if (rec.issueDate > cfg.cutoff) continue;
    const d = deriveRecord(rec, cfg, null);
    if (d.outstanding <= 0) continue;
    if (rec.scopeType !== 'central') { internal += d.outstanding; internalCount += 1; continue; }
    if (rec.issueDate > reportDate) { newInvoices += d.outstanding; newCount += 1; } else if (!reportIds.has(rec.id)) centralBefore += d.outstanding;
  }
  const net = netFromReport + newInvoices + internal + centralBefore;

  const steps = [
    { key: 'report', amount: reportMatched, count: matchedRows.length, kind: 'start' },
    { key: 'reconciliation', amount: -(paidAfter + creditAfter), kind: 'minus', detail: { payments: paidAfter, creditNotes: creditAfter } },
    { key: 'cancelled', amount: -cancelled, count: cancelledCount, kind: 'minus', detail: { overlapNotDeductedAgain: overlapAmount, overlapCount } },
    { key: 'excluded', amount: -excludedNonOverlap, count: excludedCount, kind: 'minus', detail: { approvedRules: excludedApproved, unapprovedRules: excludedUnapproved } },
    { key: 'newInvoices', amount: newInvoices, count: newCount, kind: 'plus' },
    ...(centralBefore ? [{ key: 'missedByReport', amount: centralBefore, kind: 'plus' }] : []),
    { key: 'internal', amount: internal, count: internalCount, kind: 'plus' }
  ];
  const stepsSum = steps.reduce((s, x) => s + x.amount, 0);

  return {
    reportDate, detailsDate: cfg.cutoff,
    lineCount: report.lines.length,
    invoiceCountInReport: dedupe.rows.length,
    naiveSum: report.naiveSum,
    dedupedTotal: dedupe.total,
    inflation: report.naiveSum - dedupe.total,
    conflicts: dedupe.conflicts,
    steps,
    net,
    check: Math.round((stepsSum - net) * 100) / 100,
    unmatched: { scopedOut: !national, nationalCount: UNMATCHED_REPORT_ROWS.length, nationalAmount: UNMATCHED_REPORT_ROWS.reduce((s, u) => s + u.amount, 0), count: unmatchedRows.length, amount: unmatchedRows.reduce((s, r) => s + r.invoiceValue, 0), rows: unmatchedRows.map((r) => ({ ...r, hint: UNMATCHED_REPORT_ROWS.find((u) => u.invoiceNo === r.invoiceNo)?.hint })) },
    perInvoice,
    ruleSetApproval: { unapprovedAmount: excludedUnapproved, approvedAmount: excludedApproved }
  };
}

export { BRIDGE_LABELS } from './bridgeLabels';

export { REPORT_DATE, DATA_CUTOFF };
