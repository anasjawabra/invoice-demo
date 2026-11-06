// Explicit header mappings for every supplied report layout (schema evidence: header rows of the supplied workbooks/CSVs; value patterns are assumptions to confirm).
// A header is matched by NAME (after trimming), never by position. A field keeps the report's own label (`label`) so the UI can show «as written in the source».
// Identifier fields are candidates only: nothing here asserts that two identifiers in different reports denote the same thing, or that an identifier is unique.
export const SOURCES = {
  sanad: { id: 'sanad', ar: 'سند', en: 'Sanad' },
  eefaa: { id: 'eefaa', ar: 'إيفاء', en: 'Eefaa' },
  mumtathil: { id: 'mumtathil', ar: 'ممتثل', en: 'Mumtathil' }
};
// ingestion METHOD is separate from the business source. Production: the records are READ DIRECTLY FROM THE DATA BANK (no file upload). In the demo, synthetic records stand in for that read (labelled as such).
// Excel files were only used to understand the report schemas; uploading them is retired (the importer's header mappings remain the contract a Data Bank reader maps onto — the Data Bank's own field names are To Be Confirmed).
export const METHODS = {
  data_bank: { id: 'data_bank', ar: 'بنك البيانات — قراءة مباشرة', en: 'Data Bank — direct read', available: true, demo: { ar: 'في العرض التجريبي: سجلات اصطناعية تحاكي القراءة', en: 'In the demo: synthetic records stand in for the read' } },
  excel: { id: 'excel', ar: 'ملف إكسل (متوقف)', en: 'Excel file (retired)', available: false }
};

const f = (name, headers, type, o = {}) => ({ name, headers: [].concat(headers), type, ...o });
const ID = (name, headers, o = {}) => f(name, headers, 'id', { kind: 'numeric', ...o });
const TXT = (name, headers, o = {}) => f(name, headers, 'text', o);
const AMT = (name, headers, o = {}) => f(name, headers, 'amount', o);
const DT = (name, headers, o = {}) => f(name, headers, 'date', o);
const PII = (name, headers, o = {}) => f(name, headers, o.type || 'id', { personal: true, ...o }); // personal data: masked by default in every view

const SANAD = [
  ID('claimNo', 'رقم طلب المطالبة بألاداء'), ID('requestNo', 'رقم طلب التنفيذ', { required: true }), DT('claimDate', 'تاريخ المطالبة'), TXT('amanah', 'الأمانة', { required: true }), TXT('municipality', 'البلدية'),
  TXT('statusId', 'رقم حالة الرفع للتنفيذ'), TXT('statusText', 'حالة الرفع للتنفيذ', { required: true, status: true }), TXT('debtorTypeId', 'رقم نوع المنفذ ضدة'), TXT('debtorType', 'نوع المنفذ ضدة'),
  DT('raisedAt', 'تاريخ الرفع للتنفيذ'), DT('createdAt', 'تاريخ انشاء الطلب'), PII('employeeId', 'رقم اسم الموظف منشئ الطلب', { kind: 'numeric' }), PII('employeeName', 'اسم الموظف منشئ الطلب', { type: 'text' }),
  AMT('amount', 'المبلغ', { required: true }), TXT('amountWords', 'المبلغ كتابة'), ID('enforcementNo', 'رقم الانفاذ'), ID('invoiceNo', 'رقم الفاتورة'), TXT('executionTypeId', 'رقم نوع التنفيذ'), TXT('executionType', 'نوع التنفيذ'), TXT('description', 'الوصف')
];
const EEFAA_COMMON = {
  entity: TXT('entity', 'الجهة'), identityNo: PII('identityNo', 'رقم الهوية', { expectedLength: 10 }), violationNo: ID('violationNo', 'رقم المخالفة', { required: true, expectedLength: 14, candidate: true }),
  serialNo: TXT('serialNo', 'الرقم التسلسلي'), amount: AMT('amount', 'قيمة المخالفة'), violationDate: DT('violationDate', 'تاريخ المخالفة'), claimNoticeDate: DT('claimNoticeDate', 'تاريخ استلام رسالة المطالبة بالأداء')
};
const EEFAA_EXECUTED = [
  { ...EEFAA_COMMON.entity, required: true }, EEFAA_COMMON.identityNo, EEFAA_COMMON.violationNo, EEFAA_COMMON.serialNo, EEFAA_COMMON.amount,
  TXT('executionRequestStatus', 'حالة طلب التنفيذ', { status: true, required: true }), ID('executionNo', 'رقم التنفيذ لدى ديوان المظالم'), DT('referralDate', 'تاريخ الرفع للتنفيذ'), DT('executionDate', 'تاريخ التنفيذ')
];
const EEFAA_REFERABLE = [
  { ...EEFAA_COMMON.entity, required: true }, EEFAA_COMMON.identityNo, EEFAA_COMMON.violationNo, EEFAA_COMMON.serialNo, EEFAA_COMMON.violationDate, TXT('city', 'مدينة المخالفة', { required: true }), TXT('category', 'تصنيف المخالفة'), EEFAA_COMMON.amount, EEFAA_COMMON.claimNoticeDate
];
const EEFAA_INCOMPLETE = [
  { ...EEFAA_COMMON.entity, required: true }, EEFAA_COMMON.violationNo, EEFAA_COMMON.serialNo, EEFAA_COMMON.identityNo, TXT('completionStatus', 'حالة الإكتمال', { required: true, status: true }), EEFAA_COMMON.violationDate, EEFAA_COMMON.claimNoticeDate
];
const EEFAA_GENERAL = [
  ID('violationNo', 'Finenumber', { required: true, expectedLength: 14, candidate: true }), TXT('entity', 'Main Source Info'), PII('violatorId', 'Violatorid', { expectedLength: 10 }), AMT('amount', 'Efaa Amount', { required: true }), AMT('sadadAmount', 'Sadad Amount'),
  TXT('efaaStatus', 'Efaa Status', { status: true }), TXT('sadadStatus', 'Sadad Status', { status: true }), DT('violationDate', 'Datehappened'), TXT('timeHappened', 'Timehappened'), TXT('city', 'Cityname'),
  ID('businessRef', 'Finebusinessref', { kind: 'text', pattern: /^\d+_\d+$/, required: true }), TXT('bookingType', 'Finebookingtypename'), TXT('amanah', 'Amananame'), DT('insertDate', 'Insertdate'), TXT('category', 'Mainfinecategoryname'),
  TXT('referenceId', 'Reference ID'), PII('fullName', 'Full Name', { type: 'text' }), PII('ownerId', 'Owner Id'), ID('resolutionRef', 'Resolutionref', { kind: 'text', pattern: /^\d+_\d+$/ }), PII('violatorName', 'Violatorname', { type: 'text' }),
  TXT('inspectionType', 'Inspectiontype'), TXT('executionRequestStatus', 'حالة التنفيذ', { status: true }), ID('executionNo', 'رقم التنفيذ')
];
const EEFAA_V2 = [
  TXT('violationTypeId', 'معرف نوع المخالفة'), PII('identityNo', 'رقم الهوية', { expectedLength: 10 }), TXT('city', 'اسم المدينة'), ID('sadadNo', 'رقم السداد', { required: true }), TXT('amanah', 'اسم الأمانة', { required: true }),
  ID('violationNo', 'رقم الغرامة', { required: true, expectedLength: 14, candidate: true }), PII('violatorName', 'اسم المخالف', { type: 'text' }), TXT('fineDescription', 'وصف الغرامة'), AMT('amount', 'مبلغ الغرامة', { required: true }),
  TXT('periodCount', 'عدد او فترة'), DT('createdDate', 'تاريح الانشاء'), DT('paymentDate', 'تاريخ الدفع'), DT('cancellationDate', 'تاريخ الالغاء'), TXT('invoiceStatus', 'حالة الفاتورة', { status: true, required: true })
];
const MUMTATHIL = [
  ID('caseId', 'معرف الحالة', { kind: 'text', pattern: /^[A-Za-z]{2,6}-\d+$/, required: true }), ID('sadadNo', 'رقم سداد', { required: true }), TXT('invoiceStatus', 'حالة الفاتورة', { status: true }), TXT('amanah', 'اسم أمانة', { required: true }), TXT('municipality', 'اسم البلدية'),
  AMT('amount', 'مبلغ سداد'), ID('fineNo', 'رقم غرامة', { expectedLength: 14, candidate: true }), PII('violatorId', 'هوية المخالف', { expectedLength: 10 }), TXT('clauseNo', 'بند اللائحة', { clause: true }), TXT('regulationName', 'اسم اللائحة'),
  ID('appealId', 'معرف الاستئناف', { kind: 'text', pattern: /^[A-Za-z]{2,6}-\d+$/ }), TXT('appealStatus', 'حالة الاستئناف', { status: true }), TXT('appealStatusAr', 'حالة الاستئناف AR', { status: true }), DT('appealRaisedAt', 'تاريخ رفع الاستئناف'), DT('appealResolvedAt', 'تاريخ حل الاستئناف'),
  DT('loadedAt', 'تاريخ التحميل'), TXT('mainClauseNo', 'اللائحة الرئيسية', { clause: true }), TXT('mainRegulationName', 'اسم اللائحة الرئيسية')
];

export const REPORTS = [
  { id: 'sanad.qadaya_view', source: 'sanad', version: 1, label: { ar: 'عرض قضايا سند (طلبات التنفيذ)', en: 'Sanad enforcement-requests view' }, key: 'requestNo', fields: SANAD,
    note: 'رقم طلب التنفيذ هو المفتاح المقترح؛ «رقم الانفاذ» يُحفظ بتسميته الأصلية ولا يُفترض أنه رقم الحالة نفسها في أي نظام آخر.' },
  { id: 'eefaa.executed_against', source: 'eefaa', version: 1, label: { ar: 'إيفاء — تقرير المنفذ ضده', en: 'Eefaa — executed-against report' }, key: 'violationNo', fields: EEFAA_EXECUTED, evidence: 'execution' },
  { id: 'eefaa.referable', source: 'eefaa', version: 1, label: { ar: 'إيفاء — تقرير المخالفات القابلة للتنفيذ', en: 'Eefaa — referable-to-execution report' }, key: 'violationNo', fields: EEFAA_REFERABLE, evidence: 'listed' },
  { id: 'eefaa.incomplete_notices', source: 'eefaa', version: 1, label: { ar: 'إيفاء — إشعارات المطالبة بالأداء غير المكتملة', en: 'Eefaa — incomplete claim notices' }, key: 'violationNo', fields: EEFAA_INCOMPLETE, evidence: 'listed' },
  { id: 'eefaa.general', source: 'eefaa', version: 1, label: { ar: 'إيفاء — تقرير المخالفات العام', en: 'Eefaa — general violations report' }, key: 'violationNo', altKey: 'businessRef', fields: EEFAA_GENERAL },
  { id: 'eefaa.v2_tahseel', source: 'eefaa', version: 1, label: { ar: 'إيفاء v2 — الحالة كما في تحصيل', en: 'Eefaa v2 — status as in Tahseel' }, key: 'violationNo', altKey: 'sadadNo', fields: EEFAA_V2 },
  { id: 'mumtathil.report', source: 'mumtathil', version: 1, label: { ar: 'تقرير منصة ممتثل', en: 'Mumtathil platform report' }, key: 'caseId', fields: MUMTATHIL }
];
export const reportById = (id) => REPORTS.find((r) => r.id === id) || null;
export const reportsOf = (source) => REPORTS.filter((r) => r.source === source);
export const fieldDef = (report, name) => report.fields.find((x) => x.name === name) || null;

export const normHeader = (h) => String(h ?? '').replace(/[‎‏‪-‮﻿]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// match a header row against every report: all REQUIRED headers must be present. Returns { report, missingOptional, extra, columns:{name→index} } or { report:null, best, missing }.
export function detectReport(headers, { only } = {}) {
  const H = headers.map(normHeader); const cands = [];
  for (const r of REPORTS) {
    if (only && r.id !== only) continue;
    const cols = {}; let matched = 0; const missingRequired = []; const missingOptional = [];
    for (const fd of r.fields) {
      const idx = H.findIndex((h) => fd.headers.some((x) => normHeader(x) === h));
      if (idx >= 0) { cols[fd.name] = idx; matched += 1; } else if (fd.required) missingRequired.push(fd.headers[0]); else missingOptional.push(fd.headers[0]);
    }
    const used = new Set(Object.values(cols)); const extra = headers.map((h, i) => (normHeader(h) && !used.has(i) ? String(h) : null)).filter(Boolean);
    cands.push({ report: r, cols, matched, total: r.fields.length, missingRequired, missingOptional, extra });
  }
  const full = cands.filter((c) => !c.missingRequired.length);
  if (full.length) {
    full.sort((a, b) => b.matched - a.matched || a.extra.length - b.extra.length);
    const top = full[0]; const tie = full.filter((c) => c.matched === top.matched && c.extra.length === top.extra.length);
    return tie.length > 1 ? { report: null, ambiguous: tie.map((c) => c.report.id), best: top } : { report: top.report, cols: top.cols, missingOptional: top.missingOptional, extra: top.extra };
  }
  cands.sort((a, b) => b.matched / b.total - a.matched / a.total);
  return { report: null, best: cands[0], missing: cands[0]?.missingRequired || [] };
}
