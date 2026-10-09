// ============================================================================
// Revenue ledger — the reconciled, explicit record model every revenue metric
// is computed from (see revenueMetrics.js).
//
// WHY THIS EXISTS: the original INVOICES fixtures carry only an AI-workflow
// `status` (pending / approved / duplicate / ...). Earlier screens treated
// workflow "approved" as "collected" and invented exclusions per page. This
// module derives an explicit ledger — issue/due dates, payments with dates
// and channels, adjustments, exclusion records with evidence and review state,
// objections, enforcement links, contract links, amount checks — from the
// existing fixtures plus the small, clearly-labelled OVERLAY below. Nothing in
// here is production data: every record is `provenance.kind === 'demo'`.
//
// Source statuses (Tahseel/Makeen-style) are kept SEPARATE from the AI
// workflow status; neither is used as proof of the other.
// ============================================================================
import { INVOICES, RECON, SANAD_ENFORCEMENT } from './mock';
import { DEMO_TODAY, addDaysIso } from './clock';
import { SOURCES, ENTITIES, N_AMANAH } from './catalog';

/* ---------- Data cutoff & provenance ---------- */

// "Today" in Asia/Riyadh at load (see clock.js). Every as-of, ageing and period-to-date figure is anchored here;
// nothing is dated after it.
export const DATA_CUTOFF = DEMO_TODAY;
// Earliest issue date the demo ledger covers. Periods starting before this are only partly covered.
export const DATA_START = '2025-01-01';

export const PROVENANCE_KINDS = {
  demo: { en: 'Illustrative demo data', ar: 'بيانات توضيحية للعرض', zh: '演示用示例数据' },
  uploaded: { en: 'Uploaded data', ar: 'بيانات مرفوعة', zh: '已上传数据' },
  connected: { en: 'Connected production data', ar: 'بيانات إنتاج متصلة', zh: '已连接的生产数据' },
  unavailable: { en: 'Unavailable source', ar: 'مصدر غير متاح', zh: '数据源不可用' },
  awaiting: { en: 'Awaiting verification', ar: 'بانتظار التحقق', zh: '待核实' }
};

/* ---------- Source-system registry ----------
   A system being LISTED in the HLSD/risks document is NOT proof of a working
   integration. Statuses below come from the supplied source-risk document and
   HLSD V0.4; in this demo none is connected. */
export const SOURCE_SYSTEMS = [
  { id: 'tahseel', name: 'Tahseel', role: { en: 'Official collection figures', ar: 'أرقام التحصيل الرسمية' }, status: 'unavailable', risk: 'at_risk', note: { en: 'Not in the Data Bank; platform contact needed for schema. Continuous feed not established.', ar: 'غير متوفر في بنك البيانات؛ يلزم التواصل مع مالك المنصة للحصول على المخطط. لم يتم إنشاء تغذية مستمرة.' } },
  { id: 'makeen', name: 'Makeen', role: { en: 'Billing / revenue reference (candidate)', ar: 'بيانات الفوترة والإيراد (مرشح)' }, status: 'awaiting', risk: 'verification', note: { en: 'Named in HLSD V0.4 as a candidate source; scope, identifiers and field authority unconfirmed.', ar: 'مذكور في وثيقة التصميم كمصدر مرشح؛ النطاق والمعرفات وسلطة الحقول غير مؤكدة.' } },
  { id: 'balady', name: 'Balady', role: { en: 'Municipal bills, payer names, licence links', ar: 'فواتير بلدية وأسماء الدافعين وروابط الرخص' }, status: 'unavailable', risk: 'not_at_risk', note: { en: 'Data exists in the Data Bank per the risk document, but it is not wired into this demo.', ar: 'البيانات موجودة في بنك البيانات وفق وثيقة المخاطر، لكنها غير موصولة بهذا العرض.' } },
  { id: 'furas', name: 'Furas', role: { en: 'Investment / lease contracts', ar: 'عقود الاستثمار والإيجار' }, status: 'awaiting', risk: 'verification', note: { en: 'Not in the Data Bank; schema to verify. Direct feed, verified integration or approved dataset route not yet chosen.', ar: 'غير متوفر في بنك البيانات؛ المخطط قيد التحقق. لم يُحدَّد مسار التغذية بعد.' } },
  { id: 'momtathil', name: 'Mumtathil', role: { en: 'Violations / objections', ar: 'المخالفات والاعتراضات' }, status: 'awaiting', risk: 'verification', note: { en: 'Internal system; owning department not identified.', ar: 'نظام داخلي؛ لم تُحدَّد الإدارة المالكة.' } },
  { id: 'efaa', name: 'Efaa', role: { en: 'Fines / execution cases', ar: 'الغرامات وقضايا التنفيذ' }, status: 'awaiting', risk: 'verification', note: { en: 'Not in the Data Bank; schema to verify.', ar: 'غير متوفر في بنك البيانات؛ المخطط قيد التحقق.' } },
  { id: 'sanad', name: 'Sanad', role: { en: 'Receivable enforcement', ar: 'إنفاذ المستحقات' }, status: 'unavailable', risk: 'at_risk', note: { en: 'Not in the Data Bank; contact needed. Enforcement links in this demo are illustrative.', ar: 'غير متوفر في بنك البيانات؛ يلزم التواصل. روابط الإنفاذ في هذا العرض توضيحية.' } },
  { id: 'sadad', name: 'SADAD', role: { en: 'Payment channel / invoice number', ar: 'قناة السداد ورقم الفاتورة' }, status: 'awaiting', risk: 'verification', note: { en: 'Schema available, data not in the Data Bank; integration with Tahseel undefined.', ar: 'المخطط متاح والبيانات غير موجودة في بنك البيانات؛ التكامل مع تحصيل غير محدد.' } },
  { id: 'demo-ledger', name: 'Demo invoice ledger', role: { en: 'The 33-record illustrative dataset behind this demo', ar: 'مجموعة البيانات التوضيحية (33 سجلاً) التي يعتمد عليها هذا العرض' }, status: 'demo', risk: null, note: { en: 'Fictional records. All figures in this app are illustrative.', ar: 'سجلات افتراضية. جميع الأرقام في هذا التطبيق توضيحية.' } }
];

// Revenue sources named in the brief that have NO records in this demo.
export const UNAVAILABLE_REVENUE_SOURCES = [];

/* ---------- Revenue-source taxonomy ---------- */
export const REVENUE_SOURCES = {
  investment: { gfs: '1421901', en: 'Investment (Furas)', ar: 'الاستثمار (فرص)', zh: '投资收入', platform: 'Foras' },
  fines: { gfs: '1438001', en: 'Fines & penalties', ar: 'الغرامات والجزاءات', zh: '罚款与处罚', platform: 'Mumathil' },
  municipal_fees: { gfs: '142113', en: 'Municipal fees', ar: 'الرسوم البلدية', zh: '市政收费', platform: 'Baladi' },
  licenses: { gfs: '142162', en: 'Licence fees', ar: 'رسوم التراخيص', zh: '许可费', platform: 'Amanah Internal Reports' },
  accommodation: { gfs: '11442', en: 'Accommodation facilities', ar: 'مرافق الإيواء', zh: '住宿设施', platform: 'Baladi' },
  tobacco: { gfs: '1422110', en: 'Tobacco service fee', ar: 'رسم منتجات التبغ', zh: '烟草服务费', platform: 'Baladi' },
  white_lands: { gfs: '1422111', en: 'White-land fees', ar: 'رسوم الأراضي البيضاء', zh: '空地费', platform: 'Baladi' },
  housing_sales: { gfs: '1422112', en: 'Housing sector sales', ar: 'مبيعات قطاع الإسكان', zh: '住房销售', platform: 'Baladi' }
};
export const REVENUE_SOURCE_KEYS = Object.keys(REVENUE_SOURCES);

export function revenueSourceOf(inv) {
  if (inv.source === 'Foras') return 'investment';
  if (inv.source === 'Mumathil') return 'fines';
  if (inv.source === 'Baladi') return inv.revenueSource || 'municipal_fees';
  return 'licenses';
}

/* ---------- Date helpers (UTC, string based) ---------- */
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}
export const monthOf = (dateStr) => dateStr.slice(0, 7);

/* ---------- Illustrative overlay (explicit, reviewable) ----------
   Only things the original fixtures cannot express. Everything else is
   derived by rule in buildLedger(). */
const REVIEWER = { en: 'Revenue data steward (demo reviewer)', ar: 'أمين بيانات الإيرادات (مراجع تجريبي)' };

const OVERLAY = {
  // Partial payment, short payment terms -> due before the data cutoff.
  'INV-2026-0724': { dueDate: '2026-07-30', payments: [{ date: '2026-07-29', amount: 400000, channel: 'voluntary' }] },
  // Small partial receipt on an overdue invoice.
  'INV-2026-0650': { payments: [{ date: '2026-07-27', amount: 150000, channel: 'voluntary' }] },
  // Approved credit note reduces the billed amount.
  'INV-2026-0520': { adjustments: [{ date: '2026-02-10', amount: -50000, kind: 'credit_note', reason: { en: 'Approved credit note (area re-measurement)', ar: 'إشعار دائن معتمد (إعادة قياس المساحة)' } }] },
  // Missing mandatory debtor identifier: invoice cannot be referred as-is.
  'INV-2026-0802': { missing: ['debtor_id_number'] },
  // Exclusion records (explicit, with evidence and review state).
  'INV-2026-0728': { exclusion: { category: 'duplicate', ruleId: 'DUP-1', evidence: { en: 'Line items identical to INV-2026-0731 (duplicate detection); same contract reference CO-88231.', ar: 'بنود الفاتورة مطابقة للفاتورة INV-2026-0731 (كشف التكرار)؛ نفس مرجع العقد CO-88231.' }, reviewStatus: 'approved', reviewDate: '2026-07-28' } },
  'INV-2025-0940': { exclusion: { category: 'duplicate', ruleId: 'DUP-1', evidence: { en: 'Re-submission of an invoice already registered under the same contract reference.', ar: 'إعادة تقديم فاتورة مسجلة مسبقاً بنفس مرجع العقد.' }, reviewStatus: 'approved', reviewDate: '2025-12-04' } },
  'INV-2026-0808': { exclusion: { category: 'duplicate', ruleId: 'DUP-1', evidence: { en: 'Same payer, amount and period as an earlier Jazan invoice.', ar: 'نفس الدافع والمبلغ والفترة لفاتورة سابقة في جازان.' }, reviewStatus: 'approved', reviewDate: '2026-04-20' } },
  'INV-2026-0545': { exclusion: { category: 'struck_off_registry', ruleId: 'CR-1', evidence: { en: 'Commercial registration reported struck-off by the commerce registry check.', ar: 'السجل التجاري مشطوب وفق فحص سجل التجارة.' }, reviewStatus: 'approved', reviewDate: '2026-03-10' } },
  // Candidate exclusion that is NOT yet approved -> stays in net billed.
  'INV-2026-0804': { exclusion: { category: 'deceased_debtor', ruleId: 'DEC-1', evidence: { en: 'Civil-registry flag suggests the debtor is deceased; heir/estate position not established.', ar: 'إشارة السجل المدني تفيد بوفاة المدين؛ وضع الورثة/التركة غير مثبت.' }, reviewStatus: 'pending', reviewDate: null } }
};

/* ---------- Enforcement cases (Sanad / Efaa) ----------
   Cases + the invoice links that have been reviewed. The six backlog cases come
   from SANAD_ENFORCEMENT.sample (mock.js); three previously-reviewed cases are
   added here. A link counts only once its status is `confirmed`. */
const CONFIRMED_SEED = [
  { enforceNum: 'EN-2301188', system: 'sanad', amanahEn: 'Jeddah Amanah', amount: 687500, openedDate: '2026-05-28', links: [{ invoiceId: 'INV-2026-0722', allocated: 687500, status: 'confirmed', evidence: ['reference_match'], reviewedBy: 'Revenue data steward (demo reviewer)', reviewedAt: '2026-06-30' }] },
  { enforceNum: 'EN-2188420', system: 'sanad', amanahEn: 'Riyadh Amanah', amount: 1363500, openedDate: '2026-04-30', links: [{ invoiceId: 'INV-2026-0635', allocated: 1363500, status: 'confirmed', evidence: ['reference_match'], reviewedBy: 'Revenue data steward (demo reviewer)', reviewedAt: '2026-06-12' }] },
  { enforceNum: 'EN-2455512', system: 'sanad', amanahEn: 'Al-Qassim Amanah', amount: 356500, openedDate: '2026-07-02', links: [{ invoiceId: 'INV-2026-0806', allocated: 356500, status: 'confirmed', evidence: ['reference_match', 'amount_exact'], reviewedBy: 'Revenue data steward (demo reviewer)', reviewedAt: '2026-07-09' }] }
];

// Backlog: orders issued by the enforcement platform that still have no reviewed invoice link.
const BACKLOG_SEED = SANAD_ENFORCEMENT.sample.map((c) => ({
  enforceNum: c.enforceNum,
  system: 'sanad',
  amanahEn: c.amanahEn,
  amount: c.amount,
  openedDate: '2026-07-01',
  links: [],
  history: []
}));

export const ANCHOR_ENFORCEMENT_SEED = [...CONFIRMED_SEED.map((c) => ({ ...c, history: [] })), ...BACKLOG_SEED];

// The generated Sanad execution requests come from the data service (/api/sanad-cases); only the hand-anchored cases live here.
export const ENFORCEMENT_SEED = ANCHOR_ENFORCEMENT_SEED;

/* ---------- Amount reconciliation against line items ---------- */
export const AMOUNT_TOLERANCE = 0.005; // 0.5%

function lineEvidenceFor(invId) {
  for (const r of Object.values(RECON)) {
    if (r.invoiceNo !== invId) continue;
    const lineTotal = r.lines.reduce((s, l) => s + l.qty * l.invUnit, 0);
    return { lineTotal, vatDeclared: r.vat?.declared ?? null, vatExpected: r.vat?.expected ?? null, vatRate: r.vat?.rate ?? null };
  }
  return null;
}

// Returns an explicit status instead of silently picking a number.
export function checkInvoiceAmount(invId, headerAmount) {
  const ev = lineEvidenceFor(invId);
  if (!ev) return { status: 'not_checkable', headerAmount };
  const withVat = ev.lineTotal + (ev.vatDeclared || 0);
  const near = (a, b) => b > 0 && Math.abs(a - b) / b <= AMOUNT_TOLERANCE;
  if (near(headerAmount, ev.lineTotal)) return { status: 'consistent', basis: 'ex_vat', headerAmount, ...ev, impliedTotalWithVat: withVat, difference: 0 };
  if (near(headerAmount, withVat)) return { status: 'consistent', basis: 'incl_vat', headerAmount, ...ev, impliedTotalWithVat: withVat, difference: 0 };
  return {
    status: 'conflict',
    headerAmount,
    ...ev,
    impliedTotalWithVat: withVat,
    // Difference against the closest line-item-based figure.
    difference: headerAmount - (Math.abs(headerAmount - ev.lineTotal) <= Math.abs(headerAmount - withVat) ? ev.lineTotal : withVat),
    differenceVsLineTotal: headerAmount - ev.lineTotal,
    differenceVsWithVat: headerAmount - withVat
  };
}

/* ---------- Ledger construction ---------- */
function stableOffset(id, min, span) {
  const n = Number(String(id).replace(/\D/g, '').slice(-4)) || 0;
  return min + (n % span);
}

function sourceStatusFor(inv, paid, excluded) {
  // Makeen-style 4-value source vocabulary, derived and kept separate from the workflow status.
  if (inv.status === 'duplicate') return 'cancelled';
  if (paid <= 0) return 'uncollected';
  return paid >= inv.amount ? 'collected' : 'uncollected';
}

function contractLinkOf(inv) {
  if (inv.source !== 'Foras') return { required: false, status: 'not_applicable' };
  if (inv.hasContract === true) return { required: true, status: 'linked', ref: inv.co };
  if (inv.hasContract === false) return { required: true, status: 'unlinked', ref: null };
  return { required: true, status: 'unverified', ref: inv.co || null };
}

const normExclusion = (ex, issueDate, extra = {}) => ({
  category: ex.category,
  ruleId: ex.ruleId,
  ruleVersion: 1,
  evidence: ex.evidence,
  sources: ex.sources || [],
  rawValue: ex.rawValue || (ex.sources || []).find((x) => x.field === 'Crstatus')?.value || null,
  reviewStatus: ex.reviewStatus,
  reviewer: ex.reviewStatus === 'approved' ? REVIEWER : null,
  reviewDate: ex.reviewStatus === 'approved' ? (ex.reviewDate || '2026-06-15') : null,
  effectiveFrom: ex.reviewStatus === 'approved' ? (ex.reviewDate || '2026-06-15') : issueDate,
  effectiveTo: null,
  reassessment: ex.reviewStatus === 'approved' ? 'scheduled_annual' : 'not_started',
  ...extra
});

// IDs are TEXT: never numbers (a CR / subscription / Sadad number must keep leading zeros and every digit).
const textId = (prefix, id, len) => `${prefix}${String(id).replace(/\D/g, '').padStart(len, '0')}`.slice(0, len + prefix.length);

export function buildLedger({ invoices = INVOICES, enforcement = ENFORCEMENT_SEED, uploaded = [], today = DATA_CUTOFF } = {}) {
  const linkByInvoice = new Map();
  for (const c of enforcement) {
    for (const l of c.links) {
      if (l.status !== 'confirmed' && l.status !== 'candidate') continue;
      if (!linkByInvoice.has(l.invoiceId)) linkByInvoice.set(l.invoiceId, []);
      linkByInvoice.get(l.invoiceId).push({ enforceNum: c.enforceNum, system: c.system, allocated: l.allocated, status: l.status });
    }
  }

  const anchors = invoices.filter((inv) => inv.date <= today).map((inv) => {
    const ov = OVERLAY[inv.id] || {};
    const issueDate = inv.date;
    const prepaid = inv.payType === 'prepaid';
    const dueDate = ov.dueDate || (prepaid ? issueDate : addDays(issueDate, 30));

    let payments = ov.payments ? ov.payments.filter((p) => p.date <= today).map((p) => ({ ...p })) : [];
    if (!ov.payments && inv.status === 'approved') {
      const payDate = prepaid ? issueDate : addDays(issueDate, stableOffset(inv.id, 8, 22));
      payments = [{
        date: payDate > today ? today : payDate,
        amount: inv.amount,
        channel: inv.collectedVia === 'enforcement' ? 'enforcement' : 'voluntary'
      }];
    }
    const adjustments = (ov.adjustments || []).filter((x) => x.date <= today);
    const adjustmentTotal = adjustments.reduce((s, a) => s + a.amount, 0);
    const paid = payments.reduce((s, p) => s + p.amount, 0);

    const ex = ov.exclusion ? normExclusion(ov.exclusion, issueDate) : null;
    const recon = lineEvidenceFor(inv.id);
    const revenueSource = revenueSourceOf(inv);
    const vatRate = revenueSource === 'fines' ? 0 : 0.15;
    const vat = recon?.vatDeclared ?? Math.round((inv.amount * vatRate) / (1 + vatRate));

    return {
      id: inv.id,
      entity: inv.entity, entityEn: inv.entityEn, entityAr: inv.entityAr,
      amanah: inv.amanah, amanahEn: inv.amanahEn, amanahAr: inv.amanahAr,
      municipalityEn: inv.municipalityEn, municipalityAr: inv.municipalityAr,
      beneficiaryId: (ov.missing || []).includes('debtor_id_number') ? null : inv.beneficiaryId,
      co: inv.co,
      sourcePlatform: inv.source,
      scopeType: inv.source === 'Foras' || inv.source === 'Mumathil' || inv.source === 'Baladi' ? 'central' : 'internal',
      revenueSource,
      revenueItem: null,
      issueDate,
      dueDate,
      grossAmount: inv.amount,
      vatAmount: vat,
      vatKnown: !!recon?.vatDeclared,
      currency: inv.currency || 'SAR',
      lineItems: [{ no: 1, name: inv.entityAr || inv.entity, amount: inv.amount }],
      payments,
      adjustments,
      adjustmentTotal,
      sourceStatus: sourceStatusFor(inv, paid),
      statusRawTahseel: null,
      statusRawEfaa: null,
      workflowStatus: inv.status,
      objection: inv.hasOpenObjection ? { open: true, ref: `OBJ-${inv.id.slice(-4)}`, system: 'momtathil' } : null,
      enforcementLinks: linkByInvoice.get(inv.id) || [],
      contract: contractLinkOf(inv),
      exclusion: ex,
      exclusions: ex ? [ex] : [],
      cancelled: null,
      subscriptionNo: textId('', inv.id + '7', 10),
      sadadNo: textId('1', inv.id + '33', 13),
      crNo: null, crStatusRaw: null, crEvidence: null, executionNo: null,
      violationNumber: inv.violationNumber || null,
      missingFields: ov.missing || [],
      amountCheck: checkInvoiceAmount(inv.id, inv.amount),
      aiRisk: { score: inv.risk, tag: inv.tag },
      provenance: { kind: 'demo', system: 'demo-ledger', ref: inv.id }
    };
  });

  return [...anchors, ...uploaded];
}

// The 33 hand-anchored fixture invoices (ids referenced by RECON / RISK data). The full demo world lives in the data service, not in the browser.
export const ANCHOR_LEDGER = buildLedger({ enforcement: ANCHOR_ENFORCEMENT_SEED });
export const BASE_LEDGER = ANCHOR_LEDGER;

/* ---------- Access scope ----------
   Real record-level scoping (not amount scaling). `org.amanahKeys === null`
   means all Amanahs. */
export function accessibleLedger(ledger, org) {
  if (!org || !org.amanahKeys) return ledger;
  const allowed = new Set(org.amanahKeys);
  return ledger.filter((r) => allowed.has(r.amanahEn));
}

export function amanahOptionsOf() {
  return ENTITIES.slice(0, N_AMANAH + 1).map((e) => ({ key: e.en, en: e.en, ar: e.ar, zh: e.zh })).sort((a, b) => a.en.localeCompare(b.en));
}
