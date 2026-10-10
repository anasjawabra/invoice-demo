// ============================================================================
// Upload importer: parse -> validate -> de-duplicate -> accepted / rejected.
//
// Uploaded rows become ledger records with provenance.kind === 'uploaded'. The
// importer never trusts the file: required fields, formats, known Amanah,
// duplicates (within the file and against the existing ledger) and amounts are
// checked, and every rejection carries its reasons so nothing disappears
// silently or is double counted.
// ============================================================================
import { addDays, REVENUE_SOURCE_KEYS, DATA_CUTOFF, amanahOptionsOf, checkInvoiceAmount, AMOUNT_TOLERANCE } from './revenueLedger';

export const IMPORT_FIELDS = {
  id: ['invoice_id', 'invoice id', 'id', 'sadad_number', 'sadad number', 'رقم الفاتورة', 'رقم سداد'],
  amanah: ['amanah', 'amana', 'الأمانة', 'الامانة', 'amanah_en'],
  issueDate: ['issue_date', 'issue date', 'invoice_date', 'date', 'تاريخ الإصدار', 'تاريخ الفاتورة'],
  gross: ['amount', 'gross_amount', 'gross', 'invoice_amount', 'المبلغ', 'مبلغ الفاتورة'],
  dueDate: ['due_date', 'due date', 'تاريخ الاستحقاق'],
  paid: ['paid_amount', 'paid', 'amount_paid', 'المدفوع', 'المبلغ المدفوع'],
  paidDate: ['paid_date', 'payment_date', 'تاريخ السداد'],
  source: ['revenue_source', 'source', 'مصدر الإيراد'],
  debtorId: ['debtor_id', 'beneficiary_id', 'payer_id', 'هوية المدين'],
  entity: ['payer', 'payer_name', 'entity', 'اسم الدافع'],
  contract: ['contract', 'contract_ref', 'co', 'رقم العقد'],
  // line-level reports (Tahseel unpaid report repeats the invoice value on every line)
  lineNo: ['line_no', 'line no', 'line', 'رقم البند'],
  lineAmount: ['line_amount', 'line amount', 'item_amount', 'مبلغ البند'],
  invoiceValue: ['invoice_value', 'invoice value', 'قيمة الفاتورة'],
  subscriptionNo: ['subscription_no', 'subscription number', 'رقم الاشتراك'],
  sadadNo: ['sadad_no', 'sadad_invoice', 'رقم فاتورة سداد'],
  crNo: ['cr_no', 'cr number', 'رقم السجل التجاري'],
  statusRaw: ['status', 'source_status', 'الحالة'],
  scopeType: ['scope', 'scope_type', 'النطاق']
};

export const REPORT_TYPES = {
  invoice_details: { ar: 'تقرير تفاصيل الفواتير (تحصيل)', en: 'Invoice details (Tahseel)', system: 'tahseel' },
  unpaid_lines: { ar: 'تقرير غير المسدد (مستوى البنود)', en: 'Unpaid report (line level)', system: 'tahseel' }
};

// A cheap, stable content fingerprint (FNV-1a) used to recognise the SAME file uploaded twice.
export function fingerprint(table) {
  let h = 0x811c9dc5;
  const s = JSON.stringify(table);
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Identifiers are TEXT. A spreadsheet that converted them to numbers has already destroyed digits.
export function idProblem(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(v)) return 'id_scientific_notation (identifier corrupted by the spreadsheet — export it as text)';
  if (/^\d+\.0+$/.test(v)) return 'id_decimal_suffix (identifier was converted to a number — export it as text)';
  return null;
}

export const REQUIRED = ['id', 'amanah', 'issueDate', 'gross'];
// Line-level reports are not required to carry an Amanah (Makeen enrichment supplies it later).
export const REQUIRED_LINES = ['id', 'issueDate', 'gross'];

export function parseCsv(text) {
  const rows = [];
  let row = []; let cur = ''; let inQ = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cur); cur = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some((c) => c.trim() !== '')) rows.push(row); }
  return rows;
}

function mapHeaders(headerRow) {
  const idx = {};
  const norm = headerRow.map((h) => String(h || '').trim().toLowerCase());
  for (const [field, aliases] of Object.entries(IMPORT_FIELDS)) {
    const i = norm.findIndex((h) => aliases.includes(h));
    if (i >= 0) idx[field] = i;
  }
  return idx;
}

const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const numOf = (v) => Number(String(v).replace(/,/g, ''));

export function importRows(table, existingLedger = [], { fileName = 'upload', cutoff = DATA_CUTOFF, uploadedAt = null, reportType = null, reportDate = null, previousImports = [] } = {}) {
  const checksum = fingerprint(table);
  const prior = previousImports.filter((p) => p.checksum === checksum);
  const result = {
    fileName, accepted: [], rejected: [], warnings: [], missingColumns: [], rowsRead: 0, uploadCutoff: null, afterCutoff: 0,
    duplicateLines: 0, linesRead: 0,
    meta: { fileName, checksum, uploadedAt, reportType: null, reportDate, sourceSystem: null, version: 1, reuploadOf: prior.length ? prior[prior.length - 1].uploadedAt : null }
  };
  if (!table.length) { result.missingColumns = REQUIRED; return result; }
  const idx = mapHeaders(table[0]);
  const lineMode = reportType === 'unpaid_lines' || (reportType == null && (idx.lineNo != null || idx.lineAmount != null || idx.invoiceValue != null));
  result.meta.reportType = lineMode ? 'unpaid_lines' : 'invoice_details';
  result.meta.sourceSystem = REPORT_TYPES[result.meta.reportType].system;
  result.meta.version = previousImports.filter((p) => p.reportType === result.meta.reportType).length + 1;
  const required = lineMode ? REQUIRED_LINES : REQUIRED;
  // in line mode the "gross" column may be called invoice_value
  if (lineMode && idx.gross == null && idx.invoiceValue != null) idx.gross = idx.invoiceValue;
  result.missingColumns = required.filter((f) => idx[f] == null);
  if (result.missingColumns.length) return result;

  const amanahs = amanahOptionsOf(existingLedger);
  const amanahByName = new Map();
  for (const a of amanahs) { amanahByName.set(a.en.toLowerCase(), a); if (a.ar) amanahByName.set(a.ar, a); }
  const seen = new Set(existingLedger.map((r) => String(r.id)));
  const inFile = new Set();
  const get = (row, f) => (idx[f] == null ? '' : String(row[idx[f]] ?? '').trim());

  // ---- line mode: group the lines of one invoice (the invoice value is repeated on every line) ----
  let rows = table.slice(1).map((row, i) => ({ row, n: i + 2 }));
  const groups = new Map();
  if (lineMode) {
    for (const x of rows) {
      result.linesRead += 1;
      const id = get(x.row, 'id');
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(x);
    }
    rows = [...groups.values()].map((list) => ({ ...list[0], lines: list }));
  } else result.linesRead = rows.length;

  for (const x of rows) {
    const { row, n } = x;
    result.rowsRead += 1;
    const reasons = [];
    const id = get(row, 'id');
    const amanahRaw = get(row, 'amanah');
    const issue = get(row, 'issueDate');
    const gross = numOf(get(row, 'gross'));
    const dueRaw = get(row, 'dueDate');
    const paid = get(row, 'paid') === '' ? 0 : numOf(get(row, 'paid'));
    const paidDate = get(row, 'paidDate');
    const sourceRaw = get(row, 'source').toLowerCase().replace(/[\s-]+/g, '_');

    if (!id) reasons.push('missing_invoice_id');
    const idBad = idProblem(id) || idProblem(get(row, 'sadadNo')) || idProblem(get(row, 'subscriptionNo')) || idProblem(get(row, 'crNo'));
    if (idBad) reasons.push(idBad);
    if (id && (seen.has(id) || inFile.has(id))) reasons.push(seen.has(id) ? 'duplicate_of_existing_record' : 'duplicate_in_file');
    const am = amanahByName.get(amanahRaw.toLowerCase()) || amanahByName.get(amanahRaw);
    if (!amanahRaw) { if (!lineMode) reasons.push('missing_amanah'); } else if (!am) reasons.push('unknown_amanah');
    if (!issue) reasons.push('missing_issue_date'); else if (!isIsoDate(issue)) reasons.push('invalid_issue_date_format (use YYYY-MM-DD)');
    if (!Number.isFinite(gross)) reasons.push('invalid_amount'); else if (gross <= 0) reasons.push('non_positive_amount');
    if (dueRaw && !isIsoDate(dueRaw)) reasons.push('invalid_due_date_format');
    if (!Number.isFinite(paid) || paid < 0) reasons.push('invalid_paid_amount');
    if (paid > 0 && !paidDate) reasons.push('paid_amount_without_paid_date');
    if (paidDate && !isIsoDate(paidDate)) reasons.push('invalid_paid_date_format');
    if (issue && paidDate && isIsoDate(issue) && isIsoDate(paidDate) && paidDate < issue) reasons.push('payment_before_issue_date');
    if (sourceRaw && !REVENUE_SOURCE_KEYS.includes(sourceRaw)) reasons.push('unknown_revenue_source');

    if (reasons.length) { result.rejected.push({ row: n, id: id || null, reasons }); continue; }
    inFile.add(id);

    // lines of this invoice
    let lineItems = [{ no: 1, name: get(row, 'entity') || id, amount: gross }];
    const warnings = [];
    if (lineMode) {
      const seenLine = new Set();
      lineItems = [];
      for (const l of x.lines) {
        const no = get(l.row, 'lineNo') || String(lineItems.length + 1);
        if (seenLine.has(no)) { result.duplicateLines += 1; continue; }
        seenLine.add(no);
        const la = idx.lineAmount != null ? numOf(get(l.row, 'lineAmount')) : NaN;
        lineItems.push({ no: Number(no) || lineItems.length + 1, name: get(l.row, 'entity') || id, amount: Number.isFinite(la) ? la : gross });
        const iv = numOf(get(l.row, 'gross'));
        if (Number.isFinite(iv) && iv !== gross) warnings.push('invoice_value_differs_between_lines (first line value used)');
      }
      if (x.lines.length > 1) warnings.push(`line_level_report: ${x.lines.length} lines collapsed to ONE invoice (the repeated invoice value is counted once)`);
    }

    if (paid > gross) warnings.push('paid_exceeds_billed (overpayment recorded separately)');
    if (!dueRaw) warnings.push('due_date_assumed_issue_plus_30_days');
    if (!am) warnings.push('amanah_missing (needs Makeen enrichment; shown as unassigned)');
    if (issue > cutoff) { result.afterCutoff += 1; warnings.push(`issued_after_data_cutoff_${cutoff} (not counted until the cutoff is advanced)`); }
    if (warnings.length) result.warnings.push({ row: n, id, warnings });

    const scopeRaw = get(row, 'scopeType').toLowerCase();
    const rec = {
      id,
      entity: get(row, 'entity') || id, entityEn: get(row, 'entity') || id, entityAr: get(row, 'entity') || id,
      amanah: am ? (am.zh || am.en) : '未分配', amanahEn: am ? am.en : 'Unassigned', amanahAr: am ? am.ar : 'غير محدد (لم تُطابق في مكين)',
      beneficiaryId: get(row, 'debtorId') || null,
      co: get(row, 'contract') || null,
      sourcePlatform: 'Upload',
      scopeType: scopeRaw === 'internal' || scopeRaw === 'داخلي' ? 'internal' : 'central',
      revenueSource: sourceRaw || 'municipal_fees',
      revenueItem: null,
      issueDate: issue,
      dueDate: dueRaw || addDays(issue, 30),
      grossAmount: gross,
      vatAmount: 0, vatKnown: false,
      currency: 'SAR',
      lineItems,
      payments: paid > 0 ? [{ date: paidDate, amount: paid, channel: 'voluntary' }] : [],
      adjustments: [], adjustmentTotal: 0,
      sourceStatus: paid >= gross ? 'collected' : 'uncollected',
      statusRawTahseel: get(row, 'statusRaw') || null,
      statusRawEfaa: null,
      workflowStatus: 'uploaded',
      objection: null,
      enforcementLinks: [],
      contract: { required: (sourceRaw || '') === 'investment', status: get(row, 'contract') ? 'linked' : ((sourceRaw || '') === 'investment' ? 'unverified' : 'not_applicable'), ref: get(row, 'contract') || null },
      exclusion: null,
      exclusions: [],
      cancelled: null,
      subscriptionNo: get(row, 'subscriptionNo') || null,
      sadadNo: get(row, 'sadadNo') || null,
      crNo: get(row, 'crNo') || null, crStatusRaw: null, crEvidence: null, executionNo: null,
      violationNumber: null,
      missingFields: get(row, 'debtorId') ? [] : ['debtor_id_number'],
      amountCheck: lineMode ? lineAmountCheck(gross, lineItems) : checkInvoiceAmount(id, gross),
      aiRisk: { score: 0, tag: 'normal' },
      provenance: { kind: 'uploaded', system: 'upload', ref: `${fileName}#${n}`, file: fileName, uploadedAt, checksum, version: result.meta.version }
    };
    result.accepted.push(rec);
    if (paidDate && (!result.uploadCutoff || paidDate > result.uploadCutoff)) result.uploadCutoff = paidDate;
    if (!result.uploadCutoff || issue > result.uploadCutoff) result.uploadCutoff = issue;
  }

  // ---- validation summary shown on the Data page (one row per check) ----
  const dupReasons = (k) => result.rejected.filter((r) => r.reasons.some((x) => x.startsWith(k))).length;
  result.meta.reportDate = reportDate || result.uploadCutoff || null;
  result.validations = [
    { id: 'columns', ok: true, count: 0 },
    { id: 'id_text', ok: dupReasons('id_') === 0, count: dupReasons('id_') },
    { id: 'duplicates', ok: dupReasons('duplicate') === 0, count: dupReasons('duplicate') },
    { id: 'line_dedupe', ok: true, count: lineMode ? result.linesRead - result.rowsRead : 0, info: lineMode },
    { id: 'amounts', ok: dupReasons('invalid_amount') + dupReasons('non_positive') === 0, count: dupReasons('invalid_amount') + dupReasons('non_positive') },
    { id: 'dates', ok: dupReasons('invalid_') === dupReasons('invalid_amount') + dupReasons('invalid_paid_amount') && dupReasons('payment_before') === 0, count: dupReasons('payment_before') },
    { id: 'amanah', ok: dupReasons('unknown_amanah') + dupReasons('missing_amanah') === 0, count: dupReasons('unknown_amanah') + dupReasons('missing_amanah') },
    { id: 'reupload', ok: !result.meta.reuploadOf, count: result.meta.reuploadOf ? 1 : 0 }
  ];
  return result;
}

function lineAmountCheck(header, lines) {
  const lineTotal = lines.reduce((s, l) => s + l.amount, 0);
  const near = header > 0 && Math.abs(header - lineTotal) / header <= AMOUNT_TOLERANCE;
  return near ? { status: 'consistent', basis: 'ex_vat', headerAmount: header, lineTotal, difference: 0 } : { status: 'conflict', basis: 'ex_vat', headerAmount: header, lineTotal, vatDeclared: 0, difference: header - lineTotal, differenceVsLineTotal: header - lineTotal, differenceVsWithVat: header - lineTotal };
}

export const SAMPLE_CSV = [
  'invoice_id,amanah,issue_date,amount,due_date,paid_amount,paid_date,revenue_source,debtor_id',
  'UP-2026-0001,Riyadh Amanah,2026-06-15,120000,2026-07-15,120000,2026-07-02,municipal_fees,1022334455',
  'UP-2026-0002,Jeddah Amanah,2026-06-20,85000,2026-07-20,0,,fines,',
  'UP-2026-0003,Makkah Amanah,2026-06-22,64000,,32000,2026-07-10,licenses,7001122334',
  'UP-2026-0001,Riyadh Amanah,2026-06-15,120000,2026-07-15,120000,2026-07-02,municipal_fees,1022334455',
  'UP-2026-0004,Atlantis Amanah,2026-06-22,64000,,0,,fines,'
].join('\n');

// A Tahseel unpaid report as printed: the invoice value is REPEATED on every line (never summed across lines).
export const SAMPLE_LINES_CSV = [
  'invoice_id,sadad_no,line_no,line_amount,invoice_value,issue_date,due_date,revenue_source,subscription_no',
  '0044210001,1000000000123,1,30000,50000,2026-06-10,2026-07-10,municipal_fees,0000123456',
  '0044210001,1000000000123,2,20000,50000,2026-06-10,2026-07-10,municipal_fees,0000123456',
  '0044210002,1000000000456,1,75000,75000,2026-06-18,2026-07-18,municipal_fees,0000654321',
  '1.0044E+9,1000000000789,1,9000,9000,2026-06-20,2026-07-20,municipal_fees,0000999999'
].join('\n');
