// FULLY SYNTHETIC records in the real report layouts (header names from the supplied schemas; every value invented). Used for the demo, the tests and the downloadable Excel templates.
// Nothing here is, or is derived from, a value read from the supplied confidential files. Identifiers sit in obviously synthetic ranges (violation numbers 99…, Sadad numbers 99…, request numbers 91…).
// The same rows go through the same ingestion pipeline a Data Bank read would use: the demo seeds them automatically (method «Data Bank — direct read», labelled synthetic).
import { ENTITIES } from '../catalog';
import { SOURCE_STATUSES } from '../sanadSource';
import { SANAD_SCENARIO_ROWS } from '../sanadDocs/scenarioRecords';
import { REPORTS, reportById } from './reports';
import { tableFromObjects } from './importer';

const serial = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); const hhmm = iso.length > 10 ? iso.slice(11).split(':').map(Number) : null; return Date.UTC(y, m - 1, d) / 864e5 + 25569 + (hhmm ? (hhmm[0] * 60 + hhmm[1]) / 1440 : 0); };
const hdr = (reportId, name) => reportById(reportId).fields.find((f) => f.name === name).headers[0];
const row = (reportId, o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [hdr(reportId, k), v]));
export const vNo = (i) => 99000000000000 + i; // 14-digit synthetic violation number (a numeric cell, as in an Excel export)
export const sadadNo = (i) => 99000000000 + i; // 11-digit synthetic Sadad number
const AMANAH = ['أمانة منطقة الرياض', 'أمانة محافظة جدة', 'أمانة المنطقة الشرقية', 'أمانة منطقة مكة المكرمة', 'أمانة المدينة المنورة'];
const MUNI = ['بلدية الوسط', 'بلدية الشرق', 'بلدية الشمال', 'بلدية الجنوب', 'بلدية الغرب'];
const PERSON = (i) => `مخالف تجريبي ${i}`;
const IDN = (i) => 9000000000 + i; // synthetic 10-digit identity number
const ENTITY = 'جهة تجريبية'; const CITY = 'مدينة تجريبية';

// Sadad numbers of real demo-ledger invoices (compact world, stable ids): some synthetic Eefaa rows can then be shown next to demo invoices
export const DEFAULT_SADAD_POOL = ['407580123348', '407780123258', '407940123186', '408500122934', '408960122727', '409080122673', '407690123258', '407850123186', '407870123177', '407890123168'];
export const SYNTHETIC_LABEL = { ar: 'بيانات تجريبية اصطناعية', en: 'Synthetic demo data' };

/** syntheticTables({ sadadPool }) → { [reportId]: { headers, rows } } ready for importRows. `sadadPool`: optional real demo-ledger Sadad numbers (strings) so some Eefaa rows can link to demo invoices. */
export function syntheticTables({ sadadPool = DEFAULT_SADAD_POOL } = {}) {
  const T = {};
  const sd = (i) => (sadadPool[i] ? Number(sadadPool[i]) : sadadNo(i));
  // ---- Sanad: the five document scenarios + 25 generated requests
  const sanadHeaders = reportById('sanad.qadaya_view').fields.map((f) => f.headers[0]);
  const sanadObjs = [...SANAD_SCENARIO_ROWS];
  const stat = SOURCE_STATUSES;
  for (let i = 10; i <= 33; i += 1) {
    const s = stat[(i * 7) % stat.length]; const k = i % AMANAH.length; const day = String(1 + (i % 27)).padStart(2, '0'); const mon = String(1 + (i % 9)).padStart(2, '0');
    sanadObjs.push({
      'رقم طلب المطالبة بألاداء': i % 6 === 0 ? `9.2E+11` : 9200000 + i * 3, 'رقم طلب التنفيذ': 9100000 + i, 'تاريخ المطالبة': serial(`2026-${mon}-${day}`), 'الأمانة': AMANAH[k], 'البلدية': i % 3 === 0 ? null : MUNI[k],
      'رقم حالة الرفع للتنفيذ': s.id, 'حالة الرفع للتنفيذ': s.text, 'رقم نوع المنفذ ضدة': 1, 'نوع المنفذ ضدة': 'شركة مسجلة في المملكة', 'تاريخ الرفع للتنفيذ': serial(`2026-${mon}-${day} 09:${String(10 + i).padStart(2, '0')}`), 'تاريخ انشاء الطلب': serial(`2026-${mon}-${day} 09:${String(i).padStart(2, '0')}`),
      'رقم اسم الموظف منشئ الطلب': 9000 + (i % 5), 'اسم الموظف منشئ الطلب': `موظف تجريبي ${(i % 5) + 1}`, 'المبلغ': 5000 + i * 1375, 'المبلغ كتابة': null, 'رقم الانفاذ': i % 4 === 0 ? 9200000 + i * 3 : 9300000 + i,
      'رقم الفاتورة': i % 5 === 0 ? 910000000000 + i : null, 'رقم نوع التنفيذ': 3, 'نوع التنفيذ': 'عقود او محررات موثقة', 'الوصف': 'سجل تجريبي — بيانات اصطناعية'
    });
  }
  T['sanad.qadaya_view'] = tableFromObjects(sanadHeaders, sanadObjs);
  const mk = (reportId, objs) => { T[reportId] = tableFromObjects(reportById(reportId).fields.map((f) => f.headers[0]), objs.map((o) => row(reportId, o))); };

  // ---- Eefaa: executed-against (execution evidence)
  mk('eefaa.executed_against', [
    { entity: ENTITY, identityNo: IDN(1), violationNo: vNo(1), serialNo: 'S-9000001', amount: 1500, executionRequestStatus: 'طلب تنفيذ قائم', executionNo: 990000001, referralDate: serial('2026-03-02 10:15'), executionDate: '---' },
    { entity: ENTITY, identityNo: IDN(3), violationNo: vNo(3), serialNo: 'S-9000003', amount: 3200, executionRequestStatus: 'طلب تنفيذ منتهٍ', executionNo: 990000003, referralDate: serial('2026-02-11 09:30'), executionDate: serial('2026-04-20') },
    { entity: ENTITY, identityNo: IDN(5), violationNo: vNo(5), serialNo: 'S-9000005', amount: 2000, executionRequestStatus: 'طلب تنفيذ قائم', executionNo: 990000005, referralDate: serial('2026-05-05 14:00'), executionDate: '---' }
  ]);
  // ---- Eefaa: referable-to-execution (listed; says nothing about execution)
  mk('eefaa.referable', [
    { entity: ENTITY, identityNo: IDN(1), violationNo: vNo(1), serialNo: 'S-9000001', violationDate: serial('2025-11-20'), city: CITY, category: 'تصنيف تجريبي أ', amount: 1500, claimNoticeDate: serial('2026-01-15') },
    { entity: ENTITY, identityNo: IDN(2), violationNo: vNo(2), serialNo: 'S-9000002', violationDate: serial('2025-12-02'), city: CITY, category: 'تصنيف تجريبي ب', amount: 900, claimNoticeDate: serial('2026-01-20') },
    { entity: ENTITY, identityNo: IDN(4), violationNo: vNo(4), serialNo: 'S-9000004', violationDate: serial('2025-12-18'), city: CITY, category: 'تصنيف تجريبي ب', amount: 800, claimNoticeDate: serial('2026-02-01') },
    { entity: ENTITY, identityNo: IDN(5), violationNo: vNo(5), serialNo: 'S-9000005', violationDate: serial('2025-10-30'), city: CITY, category: 'تصنيف تجريبي أ', amount: 2100, claimNoticeDate: serial('2026-01-08') },
    { entity: ENTITY, identityNo: IDN(10), violationNo: vNo(10), serialNo: 'S-9000010', violationDate: serial('2026-01-12'), city: CITY, category: 'تصنيف تجريبي ج', amount: 450, claimNoticeDate: serial('2026-02-14') }
  ]);
  // ---- Eefaa: incomplete claim notices
  mk('eefaa.incomplete_notices', [
    { entity: ENTITY, violationNo: vNo(6), serialNo: 'S-9000006', identityNo: IDN(6), completionStatus: 'غير مكتمل', violationDate: serial('2022-11-09'), claimNoticeDate: null },
    { entity: ENTITY, violationNo: vNo(4), serialNo: 'S-9000004', identityNo: IDN(4), completionStatus: 'غير مكتمل', violationDate: serial('2025-12-18'), claimNoticeDate: null }
  ]);
  // ---- Eefaa: general report (a CSV-like export: the violation number may arrive damaged → keyed by the business reference)
  mk('eefaa.general', [
    { violationNo: '9.9E+13', entity: 'أمانة تجريبية', violatorId: IDN(8), amount: 600, sadadAmount: null, efaaStatus: 'غير مسددة', sadadStatus: null, violationDate: serial('2026-02-03 08:30'), city: CITY, businessRef: '990000008_1', bookingType: 'نوع حجز تجريبي', amanah: AMANAH[0], category: 'تصنيف تجريبي أ', violatorName: PERSON(8), executionRequestStatus: null, executionNo: null },
    { violationNo: vNo(11), entity: 'أمانة تجريبية', violatorId: IDN(11), amount: 700, sadadAmount: null, efaaStatus: 'مسددة', sadadStatus: null, violationDate: serial('2026-02-10 11:00'), city: CITY, businessRef: '990000011_1', bookingType: 'نوع حجز تجريبي', amanah: AMANAH[1], category: 'تصنيف تجريبي ب', violatorName: PERSON(11), executionRequestStatus: null, executionNo: null }
  ]);
  // ---- Eefaa v2 (status as in Tahseel): the only view with a Sadad number
  mk('eefaa.v2_tahseel', [
    { violationTypeId: 11, identityNo: IDN(1), city: CITY, sadadNo: sd(1), amanah: AMANAH[0], violationNo: vNo(1), violatorName: PERSON(1), fineDescription: 'وصف غرامة تجريبي', amount: 1500, periodCount: 1, createdDate: serial('2025-11-20'), paymentDate: null, cancellationDate: null, invoiceStatus: 'غير مسددة' },
    { violationTypeId: 12, identityNo: IDN(7), city: CITY, sadadNo: sd(7), amanah: AMANAH[2], violationNo: vNo(7), violatorName: PERSON(7), fineDescription: 'وصف غرامة تجريبي', amount: 1200, periodCount: 1, createdDate: serial('2026-01-05'), paymentDate: serial('2026-01-20'), cancellationDate: null, invoiceStatus: 'مسددة' },
    { violationTypeId: 12, identityNo: IDN(9), city: CITY, sadadNo: sd(9), amanah: AMANAH[3], violationNo: '9.9E+13', violatorName: PERSON(9), fineDescription: 'وصف غرامة تجريبي', amount: 300, periodCount: 1, createdDate: serial('2026-01-09'), paymentDate: null, cancellationDate: null, invoiceStatus: 'غير مسددة' }
  ]);
  // ---- Mumtathil (separate source: enriches Eefaa, never counted as violations)
  const mum = (n, o) => ({ caseId: `SYN-${String(n).padStart(5, '0')}`, invoiceStatus: 'bill has not been paid', amanah: AMANAH[0], municipality: MUNI[0], clauseNo: '1/2/3', regulationName: 'لائحة تجريبية', mainClauseNo: '1', mainRegulationName: 'لائحة رئيسية تجريبية', loadedAt: serial('2026-06-01 06:00'), ...o });
  mk('mumtathil.report', [
    mum(1, { sadadNo: sd(1), amount: 1500, fineNo: vNo(1), violatorId: IDN(1), amanah: AMANAH[0] }), // matches Eefaa 1 (sadad and amount agree in every view)
    mum(2, { sadadNo: sadadNo(2), amount: 950, fineNo: vNo(2), violatorId: IDN(2), appealId: 'APL-001', appealStatus: 'Resolved-Rejected', appealStatusAr: 'مرفوض', appealRaisedAt: serial('2026-02-01 09:00'), appealResolvedAt: serial('2026-02-20 09:00') }), // amount differs from the Eefaa referable view
    mum(3, { sadadNo: sadadNo(31), amount: 3200, fineNo: vNo(3), violatorId: IDN(3) }), mum(4, { sadadNo: sadadNo(32), amount: 3200, fineNo: vNo(3), violatorId: IDN(3), invoiceStatus: 'bill has been paid' }), // two records carry the same fine number → ambiguous
    mum(5, { sadadNo: sd(7), amount: 1200, fineNo: vNo(7), violatorId: IDN(7), amanah: AMANAH[2], invoiceStatus: 'bill has been paid' }),
    mum(6, { sadadNo: sadadNo(41), amount: 410, fineNo: null, violatorId: IDN(20) }), // no fine number: cannot be linked
    mum(7, { sadadNo: sadadNo(42), amount: 520, fineNo: vNo(99), violatorId: IDN(21) }) // fine number with no Eefaa violation imported
  ]);
  return T;
}
export const SYNTHETIC_REPORT_IDS = REPORTS.map((r) => r.id);
