// Five FIXED, fully SYNTHETIC Sanad records for the document + OCR simulation demo. Plain objects keyed by the exact 20 Arabic Sanad column headers (see docs/sanad-csv-mapping.md §2
// and SOURCE_FIELDS in ../sanadSource.js). Nothing here is a real record: request numbers 9100001…9100005 are a synthetic range, amounts / dates / names are invented,
// Amanah names come from the demo catalog and status texts are verbatim reference vocabulary (SOURCE_STATUSES). The enforcement key of an imported record is `SND-<requestNo>`.
// Scenarios (see ./scenarios.js): 1 three invoices, all matched · 2 one clean + one short (serial-only) + one unmatched number · 3 other Amanah + ambiguous serial + amount difference · 4 NO document ·
// 5 extraction fails once, retry succeeds (partly paid + clean invoice) · 6 an invoice cancelled in the source. The invoices named by the documents are REAL invoices of the demo ledger (compact world; see ./scenarios.js).
// The structured «رقم الفاتورة» is EMPTY in 1–6 (the real extract captures at most one value and almost always none: the numbers come from the document) and a 12-digit Sadad number in 7–9
// (the importer keeps the field as a numeric identifier, so the biller prefix of «177-407580123348» is not part of it). Invoices: see ./scenarios.js. Orders 7–9 use the Amanah of their invoices (another Amanah is a hard conflict).

import { amountInWords } from '../sanadSource.js';

const row = (o) => ({
  'رقم طلب المطالبة بألاداء': o.claim, 'رقم طلب التنفيذ': o.req, 'تاريخ المطالبة': o.claimDate, 'الأمانة': o.amanah, 'البلدية': o.muni,
  'رقم حالة الرفع للتنفيذ': o.statusId, 'حالة الرفع للتنفيذ': o.status, 'رقم نوع المنفذ ضدة': o.debtorId, 'نوع المنفذ ضدة': o.debtor,
  'تاريخ الرفع للتنفيذ': o.raise, 'تاريخ انشاء الطلب': o.created, 'رقم اسم الموظف منشئ الطلب': o.empId, 'اسم الموظف منشئ الطلب': o.empName,
  'المبلغ': o.amount, 'المبلغ كتابة': o.words, 'رقم الانفاذ': o.enf, 'رقم الفاتورة': o.invoice, 'رقم نوع التنفيذ': o.execId, 'نوع التنفيذ': o.exec, 'الوصف': o.desc
});

const HOUSING = 'قطاع الإسكان'; const HOUSING_UNIT = 'وحدة المبيعات السكنية';
export const SANAD_SCENARIO_ROWS = [
  // 1 — the document lists invoices A, B, C (all matched); the amount is their total
  row({ claim: 9200001, req: 9100001, claimDate: '2026-02-03', amanah: HOUSING, muni: HOUSING_UNIT, statusId: 3, status: 'تحت الإجراء لدى الدائرة القضائية', debtorId: 1, debtor: 'شركة مسجلة في المملكة',
    raise: '2026-02-10 09:15', created: '2026-02-10 09:08', empId: 9001, empName: 'موظف تجريبي أول', amount: 64155210, words: amountInWords(64155210), enf: 9300001, invoice: '', execId: 3, exec: 'عقود او محررات موثقة',
    desc: 'إلزام المنفذ ضده بسداد المستحقات المالية الناتجة عن العقد الموثق - بيانات تجريبية' }),
  // 2 — D (clean), a short serial-only number (E) and a number that exists nowhere; the municipality is absent from the document
  row({ claim: 9200002, req: 9100002, claimDate: '2026-03-12', amanah: HOUSING, muni: HOUSING_UNIT, statusId: 17, status: 'تم إصدار أمر تنفيذ', debtorId: 6, debtor: 'فرد (مستثمر)',
    raise: '2026-03-18 10:40', created: '2026-03-18 10:33', empId: 9002, empName: 'موظف تجريبي ثان', amount: 155034670, words: amountInWords(155034670), enf: 9300002, invoice: '', execId: 3, exec: 'عقود او محررات موثقة',
    desc: 'رسوم مستحقة على المنفذ ضده - بيانات تجريبية' }),
  // 3 — G + an invoice of ANOTHER Amanah + an ambiguous bare serial; the order amount differs from the document total
  row({ claim: 9200003, req: 9100003, claimDate: '2026-04-05', amanah: HOUSING, muni: HOUSING_UNIT, statusId: 54, status: 'ستكمال إجراءات التنفيذ', debtorId: 4, debtor: 'مؤسسة اهلية',
    raise: '2026-04-14 11:05', created: '2026-04-14 10:58', empId: 9003, empName: 'موظف تجريبي ثالث', amount: 150000000, words: amountInWords(150000000), enf: 9300003, invoice: '', execId: 5, exec: 'أوراق تجارية',
    desc: 'قيمة مستحقات على المنفذ ضده - بيانات تجريبية' }),
  // 4 — NO document: the record stays visible with the flag «مستند سند غير متوفر»
  row({ claim: 9200004, req: 9100004, claimDate: '2026-05-20', amanah: 'أمانة منطقة مكة المكرمة', muni: 'بلدية الجنوب', statusId: 2, status: 'مراجعة الطلب', debtorId: 1, debtor: 'شركة مسجلة في المملكة',
    raise: '2026-05-27 08:50', created: '2026-05-27 08:44', empId: 9004, empName: 'موظف تجريبي رابع', amount: 81316770, words: amountInWords(81316770), enf: 9300004, invoice: '', execId: 3, exec: 'عقود او محررات موثقة',
    desc: 'سجل بلا مستند مرفق — يُكمل بالبحث اليدوي عن الفاتورة - بيانات تجريبية' }),
  // 5 — extraction fails on the first attempt, the retry succeeds; F (partly paid) and E
  row({ claim: 9200005, req: 9100005, claimDate: '2026-06-02', amanah: HOUSING, muni: HOUSING_UNIT, statusId: 38, status: 'طلب مقبول', debtorId: 7, debtor: 'جهة إدارية',
    raise: '2026-06-09 13:20', created: '2026-06-09 13:12', empId: 9005, empName: 'موظف تجريبي خامس', amount: 241874670, words: amountInWords(241874670), enf: 9300005, invoice: '', execId: 3, exec: 'عقود او محررات موثقة',
    desc: 'مستند طويل تتعثر قراءته في المحاولة الأولى - بيانات تجريبية' }),
  // 6 — the document lists H, an invoice CANCELLED in the source
  row({ claim: 9200006, req: 9100006, claimDate: '2026-07-06', amanah: 'أمانة محافظة جدة', muni: 'بلدية الشرق', statusId: 38, status: 'طلب مقبول', debtorId: 1, debtor: 'شركة مسجلة في المملكة',
    raise: '2026-07-13 09:30', created: '2026-07-13 09:22', empId: 9006, empName: 'موظف تجريبي سادس', amount: 77876290, words: amountInWords(77876290), enf: 9300006, invoice: '', execId: 3, exec: 'عقود او محررات موثقة',
    desc: 'مطالبة بفاتورة ملغاة في المصدر - بيانات تجريبية' })
  ,
  // 7 — «correct number, matching amount»: the structured invoice number (the 12-digit Sadad number of 177-407580123348, 41,171,730) matches ONE invoice and the amount equals it — no document / OCR needed
  row({ claim: 9200007, req: 9100007, claimDate: '2026-07-20', amanah: 'أمانة منطقة حائل', muni: 'بلدية الوسط', statusId: 38, status: 'طلب مقبول', debtorId: 1, debtor: 'شركة مسجلة في المملكة',
    raise: '2026-07-27 10:05', created: '2026-07-27 09:58', empId: 9007, empName: 'موظف تجريبي سابع', amount: 41171730, words: amountInWords(41171730), enf: 9300007, invoice: '407580123348', execId: 3, exec: 'عقود او محررات موثقة',
    desc: 'رقم فاتورة صحيح وقيمة مطابقة - بيانات تجريبية' }),
  // 8 — «unmatched number resolved through extraction»: the structured number (Sadad 407940123199) exists nowhere; the document lists the right invoice 177-407940123186 (45,919,400)
  row({ claim: 9200008, req: 9100008, claimDate: '2026-08-03', amanah: 'أمانة محافظة جدة', muni: 'بلدية الشرق', statusId: 3, status: 'تحت الإجراء لدى الدائرة القضائية', debtorId: 1, debtor: 'شركة مسجلة في المملكة',
    raise: '2026-08-10 11:20', created: '2026-08-10 11:12', empId: 9008, empName: 'موظف تجريبي ثامن', amount: 45919400, words: amountInWords(45919400), enf: 9300008, invoice: '407940123199', execId: 3, exec: 'عقود او محررات موثقة',
    desc: 'رقم فاتورة مسجّل غير موجود في المصادر - بيانات تجريبية' }),
  // 9 — «valid number, amount difference, missing invoice found in the document»: structured 177-408960122727 (2,845,640); the order amount also covers 177-409340122475 (77,837,190), named only in the document
  row({ claim: 9200009, req: 9100009, claimDate: '2026-08-17', amanah: 'أمانة المنطقة الشرقية', muni: 'بلدية الشمال', statusId: 17, status: 'تم إصدار أمر تنفيذ', debtorId: 4, debtor: 'مؤسسة اهلية',
    raise: '2026-08-24 08:40', created: '2026-08-24 08:33', empId: 9009, empName: 'موظف تجريبي تاسع', amount: 80682830, words: amountInWords(80682830), enf: 9300009, invoice: '408960122727', execId: 3, exec: 'عقود او محررات موثقة',
    desc: 'رقم فاتورة صحيح مع فرق في القيمة - بيانات تجريبية' })
];

export const SANAD_SCENARIO_KEYS = SANAD_SCENARIO_ROWS.map((r) => `SND-${r['رقم طلب التنفيذ']}`);
