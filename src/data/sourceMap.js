// ============================================================================
// Source map: what each source is for (field-level authority), the join keys and
// documented match rules, and the (demo) import log that drives freshness.
//
// Four things are kept apart on purpose:
//   1) availability of the source      2) freshness of its data
//   3) quality of its records          4) completeness of matching
// A source being available does not mean every one of its records can be matched.
// ============================================================================
import { DATA_CUTOFF } from './revenueLedger';
import { addDaysIso, startOfYear, startOfMonth, prevMonthEnd } from './clock';

const BI = (ar, en) => ({ ar, en });

/* ---------- Source roles with FIELD-LEVEL authority (no single source is the reference for everything) ---------- */
export const SOURCE_ROLES = [
  { id: 'tahseel', name: BI('تحصيل', 'Tahseel'), cadence: BI('يومي', 'Daily'),
    role: BI('بيان إجمالي تبويب الإيرادات حسب الجهات، بيان غير المحصل، بيان تفاصيل الفواتير (المركزي والداخلي)', 'Revenue totals by beneficiary, the unpaid-invoices report, the invoice-details report (central and internal)'),
    authority: [BI('حالة الفاتورة الخام', 'Raw invoice status'), BI('مبالغ التحصيل وتواريخها', 'Collected amounts and dates'), BI('تواريخ الإصدار والاستحقاق', 'Issue / due dates'), BI('الإلغاء', 'Cancellation')],
    notAuthority: [BI('الأمانة (من مكين)', 'Amanah (from Makeen)'), BI('حالة السجل التجاري', 'CR status')] },
  { id: 'incorta', name: BI('إنكورتا', 'Incorta'), cadence: BI('أسبوعي', 'Weekly'),
    role: BI('التقارير التفصيلية للفواتير والحقول الإضافية (الجهات، البنود، الخدمات، العقود، الاعتراضات) بحسب التقرير', 'Detailed invoice reports and extra fields (entities, items, services, contracts, objections) depending on the report'),
    authority: [BI('بنود وخدمات الفاتورة', 'Invoice items and services'), BI('الاعتراضات', 'Objections')], notAuthority: [BI('مبالغ التحصيل', 'Collected amounts')] },
  { id: 'makeen', name: BI('مكين', 'Makeen'), cadence: BI('أسبوعي', 'Weekly'),
    role: BI('إثراء فواتير غير المحصل المركزية بالأمانة المعنية، لأن تقرير المركزي قد لا يتضمن الأمانة', 'Enriches central unpaid invoices with the responsible Amanah, because the central report may not carry it'),
    authority: [BI('الأمانة المعنية بالفاتورة', 'Amanah responsible for the invoice')], notAuthority: [BI('المبالغ والحالات', 'Amounts and statuses')],
    rule: BI('لا تُفترض الأمانة من اسم ملف أو من بيانات غير موثوقة؛ غير المطابق يبقى «غير محدد».', 'The Amanah is never assumed from a file name or untrusted data; unmatched stays "unassigned".') },
  { id: 'furas', name: BI('فرص', 'Furas'), cadence: BI('أسبوعي', 'Weekly'),
    role: BI('عقود الاستثمار ودفعاتها، أرقام العقود والفواتير أو سداد عند توفرها، مواعيد الاستحقاق وحالات العقود', 'Investment contracts and their payments, contract / invoice / SADAD numbers when available, due dates and contract statuses'),
    authority: [BI('رقم العقد وحالته', 'Contract number and status'), BI('جدول الدفعات ومواعيدها', 'Payment schedule and due dates')], notAuthority: [BI('التحصيل الفعلي (من تحصيل)', 'Actual collection (Tahseel)')] },
  { id: 'sanad', name: BI('سند', 'Sanad'), cadence: BI('أسبوعي', 'Weekly'),
    role: BI('طلبات التنفيذ وحالاتها، العقود المرتبطة بالتنفيذ، تفاصيل الفواتير أو المستندات والبنود، أدلة ربط التنفيذ بالفواتير', 'Enforcement requests and statuses, contracts tied to enforcement, invoice / document details and items, evidence linking enforcement to invoices'),
    authority: [BI('طلب التنفيذ وحالته ومبلغه', 'Request, status and amount'), BI('رقم السجل التجاري المستخرج من المستندات', 'CR number extracted from documents')], notAuthority: [BI('سداد المديونية', 'Debt repayment')],
    rule: BI('سند قد يعطي رقم العقد وليس رقم الفاتورة؛ لا يُوزَّع مبلغ التنفيذ على الدفعات دون دليل.', 'Sanad may give the contract number, not the invoice number; the execution amount is not spread over installments without evidence.') },
  { id: 'efaa-v2', name: BI('تقرير إيفاء v2', 'Efaa v2 report'), cadence: BI('يومي', 'Daily'),
    role: BI('الحالة فيه تمثل الحالة كما في تحصيل (بحسب تعريف فريق العمل)', 'Its status represents the status as in Tahseel (per the working team)'),
    authority: [BI('حالة المخالفة كما في تحصيل', 'Violation status as in Tahseel')], notAuthority: [BI('الحالة في إيفاء', 'Status in Efaa')] },
  { id: 'efaa-general', name: BI('تقرير مخالفات إيفاء العام', 'Efaa general violations report'), cadence: BI('أسبوعي', 'Weekly'),
    role: BI('الحالة فيه تمثل الحالة كما في إيفاء؛ وتقارير غير المكتمل والمنفذ ضده والقابل للإحالة تُستخدم لاستخراج أدلة أسباب الاستبعاد وفق القواعد المعتمدة', 'Its status is the status as in Efaa; the incomplete, executed-against and referable reports supply exclusion evidence under the approved rules'),
    authority: [BI('حالة المخالفة كما في إيفاء', 'Violation status as in Efaa'), BI('أدلة أسباب الاستبعاد', 'Exclusion-reason evidence')], notAuthority: [BI('حالة التحصيل', 'Collection status')] },
  { id: 'sadad', name: BI('سداد', 'SADAD'), cadence: BI('يومي', 'Daily'),
    role: BI('الفواتير والتحصيل والتسوية والبنود بحسب الحقول المتاحة', 'Invoices, collection, settlement and items depending on the fields available'),
    authority: [BI('عملية السداد وتاريخها', 'Payment event and date'), BI('رقم فاتورة سداد', 'SADAD invoice number')], notAuthority: [BI('السجل التجاري (لا يُفترض وجوده)', 'CR number (never assumed present)')] },
  { id: 'cr-view', name: BI('CR View', 'CR View'), cadence: BI('أسبوعي', 'Weekly'),
    role: BI('رقم السجل التجاري CrNo وحالة السجل Crstatus وبيانات تعريف المنشأة المتاحة', 'CR number CrNo, registry status Crstatus and available establishment data'),
    authority: [BI('حالة السجل التجاري الخام', 'Raw registry status')], notAuthority: [BI('قرار الاستبعاد (يحتاج قاعدة معتمدة)', 'The exclusion decision (needs an approved rule)')] },
  { id: 'other', name: BI('مصادر التحصيل الأخرى', 'Other collection sources'), cadence: BI('عند التوفر', 'When available'),
    role: BI('التحويلات والشيكات والتحصيل المرتبط بالتنفيذ؛ تُربط بإثبات التحصيل مع منع احتساب العملية مرتين', 'Transfers, cheques and enforcement-linked collection; tied to proof of payment, with the same event never counted twice'),
    authority: [BI('إثبات التحصيل', 'Proof of collection')], notAuthority: [BI('—', '—')] }
];

/* ---------- Demo import log (drives freshness and version history). Every row is DEMO metadata,
   derived from the real Riyadh date and the data service's own counts - nothing here is a fixed calendar date. ---------- */
export function buildImportLog(today = DATA_CUTOFF, { q = {}, counts = {} } = {}) {
  const yStart = startOfYear(today);
  const priorStart = `${Number(today.slice(0, 4)) - 1}-01-01`;
  const reportDate = prevMonthEnd(today);
  const stamp = (d, hh, mm) => `${d}T${hh}:${mm}:00Z`;
  const at = (d, n) => { const x = addDaysIso(d, n); return x > today ? today : x; };
  const nextYearEnd = `${Number(today.slice(0, 4)) + 1}-12-31`;
  const n = (v) => Math.max(0, Math.round(Number(v) || 0));
  const unmatchedMakeen = n(q.makeenUnmatched);
  const mk = (row) => ({ scopeType: 'central', entity: BI('الوزارة', 'Ministry'), basis: 'issue', accepted: row.rows, rejected: 0, ...row });
  return [
    mk({ source: 'tahseel', report: 'unpaid_lines', from: priorStart, to: reportDate, extractedAt: stamp(at(reportDate, 1), '08', '10'), uploadedAt: stamp(at(reportDate, 1), '09', '02'), version: 3, rows: n(q.centralInvoices * 0.42), note: BI('البنود تُجمَّع في صف لكل فاتورة', 'Lines collapsed to one row per invoice') }),
    mk({ source: 'tahseel', report: 'invoice_details', from: priorStart, to: today, extractedAt: stamp(today, '07', '40'), uploadedAt: stamp(today, '08', '20'), version: 6, rows: n(q.centralInvoices), note: BI('المرجع لحالة الفاتورة والتحصيل', 'Reference for invoice status and collection') }),
    mk({ source: 'tahseel', report: 'invoice_details', scopeType: 'internal', entity: BI('الأمانات', 'Amanahs'), from: priorStart, to: today, extractedAt: stamp(today, '07', '55'), uploadedAt: stamp(today, '08', '31'), version: 4, rows: n(q.internalInvoices), note: BI('التقارير الداخلية للأمانات', 'Amanah internal reports') }),
    mk({ source: 'incorta', report: 'invoice_items', from: yStart, to: at(today, -7), extractedAt: stamp(at(today, -6), '10', '00'), uploadedAt: stamp(at(today, -6), '10', '40'), version: 2, rows: n(counts.lineItemsYtd), note: BI('الفترة تُقرأ من محتوى الملف لا من اسمه', 'The period is read from the file content, not its name') }),
    mk({ source: 'makeen', report: 'invoice_amanah', from: priorStart, to: today, extractedAt: stamp(today, '06', '30'), uploadedAt: stamp(today, '06', '50'), version: 5, rows: n(q.centralInvoices), accepted: n(q.centralInvoices) - unmatchedMakeen, rejected: unmatchedMakeen, note: BI(`${unmatchedMakeen.toLocaleString('en-US')} فاتورة بلا أمانة في مكين`, `${unmatchedMakeen.toLocaleString('en-US')} invoice(s) without an Amanah in Makeen`) }),
    mk({ source: 'furas', report: 'contracts_payments', basis: 'due', from: priorStart, to: nextYearEnd, extractedAt: stamp(at(today, -2), '12', '00'), uploadedAt: stamp(at(today, -2), '12', '30'), version: 4, rows: n(q.installmentsInvoiced) + n(q.futureInstallments), note: BI('يتضمن دفعات مستقبلية لم تُفوتر', 'Includes future installments not yet invoiced') }),
    mk({ source: 'sanad', report: 'execution_requests', basis: 'opened', from: priorStart, to: at(today, -14), extractedAt: stamp(at(today, -13), '09', '00'), uploadedAt: stamp(at(today, -13), '09', '25'), version: 3, rows: n(q.requests), note: BI('الربط على مستوى العقد', 'Linked at contract level') }),
    mk({ source: 'efaa-v2', report: 'violations_v2', from: priorStart, to: today, extractedAt: stamp(today, '05', '30'), uploadedAt: stamp(today, '05', '50'), version: 7, rows: n(q.efaaTotal), note: BI('الحالة كما في تحصيل', 'Status as in Tahseel') }),
    mk({ source: 'efaa-general', report: 'violations_general', from: priorStart, to: at(today, -4), extractedAt: stamp(at(today, -3), '05', '30'), uploadedAt: stamp(at(today, -3), '06', '00'), version: 5, rows: n(q.efaaTotal * 0.98), note: BI('الحالة كما في إيفاء', 'Status as in Efaa') }),
    mk({ source: 'sadad', report: 'settlement', basis: 'payment', from: startOfMonth(today), to: today, extractedAt: stamp(today, '04', '00'), uploadedAt: stamp(today, '04', '20'), version: 9, rows: n(counts.paymentsYtd * 0.1), note: BI('لا يتضمن رقم السجل التجاري', 'Carries no CR number') }),
    mk({ source: 'cr-view', report: 'registry_status', basis: 'snapshot', from: '—', to: at(today, -12), extractedAt: stamp(at(today, -12), '08', '00'), uploadedAt: stamp(at(today, -12), '08', '15'), version: 2, rows: n(q.crViewKnown), note: BI('لقطة بتاريخها المرجعي', 'A snapshot with its own reference date') })
  ];
}

export const FRESHNESS_LEVELS = {
  fresh: { ar: 'حديثة', en: 'Fresh', tone: 'good', maxDays: 7 },
  aging: { ar: 'تقادمت', en: 'Ageing', tone: 'warn', maxDays: 21 },
  stale: { ar: 'قديمة', en: 'Stale', tone: 'bad', maxDays: Infinity }
};

export function daysBetweenIso(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function freshnessOf(entry, asOf = DATA_CUTOFF) {
  const age = daysBetweenIso(entry.to === '—' ? entry.extractedAt.slice(0, 10) : (entry.to > asOf ? asOf : entry.to), asOf);
  const level = age <= FRESHNESS_LEVELS.fresh.maxDays ? 'fresh' : age <= FRESHNESS_LEVELS.aging.maxDays ? 'aging' : 'stale';
  return { ageDays: age, level };
}

/* ---------- Join keys and match rules (documented per source) ----------
   `q` is the data service's quality response (counts only - invoices never reach the browser). */
export function buildMatchRules(q, bridge) {
  const chains = q.crChains || 0;
  const chainsMatched = q.crChainsMatched || 0;
  return [
    { id: 'M1', from: BI('تحصيل — غير المحصل (بنود)', 'Tahseel — unpaid (lines)'), to: BI('تحصيل — تفاصيل الفواتير', 'Tahseel — invoice details'), key: BI('رقم الفاتورة (نص)', 'Invoice number (text)'), relation: BI('بنود N ← فاتورة 1', 'N lines → 1 invoice'),
      matched: bridge.invoiceCountInReport - bridge.unmatched.count, unmatched: bridge.unmatched.count, evidence: BI('تقرير التفاصيل بتاريخه المرجعي', 'The details report at its reference date'),
      reason: BI('رقم الفاتورة غير موجود في التفاصيل', 'Invoice number absent from the details'), review: false },
    { id: 'M2', from: BI('تحصيل — غير المحصل المركزي', 'Tahseel — central unpaid'), to: BI('مكين', 'Makeen'), key: BI('رقم الفاتورة (نص)', 'Invoice number (text)'), relation: BI('فاتورة 1 ← أمانة 1', '1 invoice → 1 Amanah'),
      matched: q.makeenMatched, unmatched: q.makeenUnmatched, evidence: BI('سجل مكين', 'Makeen record'), reason: BI('الفاتورة غير موجودة في مكين — الأمانة «غير محدد»', 'Invoice not in Makeen — Amanah stays "unassigned"'), review: true },
    { id: 'M3', from: BI('فرص — دفعات العقود', 'Furas — contract payments'), to: BI('تحصيل — الفواتير', 'Tahseel — invoices'), key: BI('رقم العقد + رقم الفاتورة/سداد', 'Contract number + invoice / SADAD number'), relation: BI('عقد 1 ← دفعات N', '1 contract → N payments'),
      matched: q.installmentsInvoiced, unmatched: q.contractUnmatched, pending: q.futureInstallments, evidence: BI('رقم الفاتورة في جدول الدفعات', 'Invoice number in the payment schedule'),
      reason: BI('عقد غير مطابق ≠ بدون عقد؛ «بدون عقد» يحتاج تأكيد فرص', 'An unmatched contract ≠ no contract; "no contract" needs Furas confirmation'), review: true,
      note: BI(`${q.futureInstallments.toLocaleString('en-US')} دفعة مستقبلية لم تُفوتر — ليست متأخرات ولا تدخل غير المحصل`, `${q.futureInstallments.toLocaleString('en-US')} future installment(s) not yet invoiced — neither arrears nor part of uncollected`) },
    { id: 'M4', from: BI('سند — طلبات التنفيذ', 'Sanad — requests'), to: BI('فرص — العقود', 'Furas — contracts'), key: BI('رقم العقد', 'Contract number'), relation: BI('طلب ← عقد (مستوى العقد)', 'request → contract (contract level)'),
      matched: q.requests, unmatched: 0, pending: q.requests - q.requestsIdentified, evidence: BI('رقم العقد في الطلب', 'Contract number in the request'),
      reason: BI('الفواتير المشمولة غير محددة', 'Invoices covered are not identified'), review: true,
      note: BI(`${q.requestsIdentified.toLocaleString('en-US')} طلب حُددت فواتيره؛ ${(q.requests - q.requestsIdentified).toLocaleString('en-US')} على مستوى العقد فقط (لا تُضاف مرة ثانية إلى غير المحصل)`, `${q.requestsIdentified.toLocaleString('en-US')} request(s) with invoices identified; ${(q.requests - q.requestsIdentified).toLocaleString('en-US')} at contract level only (not added again to uncollected)`) },
    { id: 'M5', from: BI('سند — مستندات الفواتير', 'Sanad — invoice documents'), to: BI('CR View', 'CR View'), key: BI('CrNo (نص) المستخرج من البند/المستند', 'CrNo (text) extracted from the item / document'), relation: BI('مستند ← سجل تجاري', 'document → registration'),
      matched: chainsMatched, unmatched: chains - chainsMatched, evidence: BI('بيانات منظمة أولاً ثم OCR مع مراجعة', 'Structured data first, then OCR with review'),
      reason: BI('السجل غير موجود في CR View', 'Registration not in CR View'), review: true,
      note: BI(`${q.ocrCrChains.toLocaleString('en-US')} استخراج بـ OCR، منها ${q.ocrLowConfidence.toLocaleString('en-US')} ثقة أقل من 80% تحتاج مراجعة`, `${q.ocrCrChains.toLocaleString('en-US')} OCR extraction(s), ${q.ocrLowConfidence.toLocaleString('en-US')} below 80% confidence need review`) },
    { id: 'M6', from: BI('إيفاء v2 (الحالة كما في تحصيل)', 'Efaa v2 (status as in Tahseel)'), to: BI('إيفاء — المخالفات العام (الحالة كما في إيفاء)', 'Efaa general (status as in Efaa)'), key: BI('رقم المخالفة (نص)', 'Violation number (text)'), relation: BI('مخالفة 1 ← مخالفة 1', '1 violation → 1 violation'),
      matched: q.efaaTotal - q.efaaDifferent, unmatched: q.efaaDifferent, evidence: BI('الحالتان تُحفظان منفصلتين', 'Both statuses are kept apart'), reason: BI('اختلاف الحالة بين تحصيل وإيفاء — لا يُكتب أحدهما فوق الآخر', 'Status differs between Tahseel and Efaa — neither overwrites the other'), review: true },
    { id: 'M7', from: BI('بنود الفاتورة', 'Invoice items'), to: BI('رأس الفاتورة', 'Invoice header'), key: BI('رقم الفاتورة (نص)', 'Invoice number (text)'), relation: BI('بنود N ← رأس 1', 'N items → 1 header'),
      matched: q.records - q.conflicts, unmatched: q.conflicts, evidence: BI('مجموع البنود مقابل قيمة الفاتورة', 'Sum of items vs invoice value'), reason: BI('مجموع البنود يختلف عن قيمة الفاتورة', 'Item total differs from the invoice value'), review: true }
  ];
}

export function qualityOverview(q) {
  return {
    records: q.records,
    withLineEvidence: q.records,
    missingMandatory: q.missing,
    amountConflicts: q.conflicts,
    unassignedAmanah: q.unassigned,
    contractUnmatched: q.contractUnmatched,
    pendingExclusions: q.pending
  };
}
