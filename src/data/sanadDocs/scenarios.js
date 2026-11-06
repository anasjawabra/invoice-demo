// The SIX SYNTHETIC demo scenarios of the Sanad document + OCR simulation. The page texts (the transcripts printed into the demo PDFs by scripts/make-sanad-docs.mjs), the predefined field
// outputs and the simulated confidences are invented here; NOTHING is inferred from a file: a document is "simulated" only when its SHA-256 equals a scenario document's (catalog.js).
// The INVOICES the documents name are real invoices of the demo ledger (compact world, stable ids; all uncollected and not excluded unless stated):
//   A 171-407930123150 · B 171-407950123141 · C 171-408030123105 · D 171-407850123186 · E 171-407870123177 · F 171-407890123168 (partly paid) · G 171-407990123123 · H 177-407980123168 (CANCELLED in the source)
// plus, for scenario 3, 177-408500122934 (a Riyadh Amanah invoice — another Amanah than the order's) and the bare serial 0000094 (matches two invoices).
//   7 (no document): 177-407580123348 (Ha'il, 41,171,730) · 8: 177-407940123186 (Jeddah, 45,919,400) · 9: 177-408960122727 (2,845,640) + 177-409340122475 (77,837,190), both Eastern Province
//   MANUAL SEARCH paths (no document / failed extraction): SND-9100004 (Makkah Amanah) → 177-412170121242 (34,179,300) + 177-414830120045 (47,137,470) = 81,316,770;
//   SND-9100005 (Housing) → search 171-407890123168 and 171-407870123177.
// Records: ./scenarioRecords.js (SND-9100001…9). An invoice of ANOTHER Amanah than the order's is a hard conflict, so orders 7–9 use their invoices' Amanah.
// Each line of a page may carry a field (key + value + simulated confidence); the field's source page and snippet are derived from the line itself, so they cannot drift from the printed text.
import { DOC_MARK } from './labels.js';
import { amountInWords } from '../sanadSource.js';

const ln = (text, key = null, value = null, conf = 0.96) => ({ text, key, value, conf });
const money = (n) => `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ريال`;
const inv = (no, label, amount, key = null) => ln(`${label}: ${no}${amount != null ? ` — ${money(amount)}` : ''}`, key, key ? no : null, 0.97);
const TITLE = 'نموذج طلب تنفيذ — بيانات الطلب'; const TITLE_INV = 'الفواتير المشمولة بأمر التنفيذ'; const TITLE_END = 'الإجمالي والسند التنفيذي';

// header lines shared by every document: request no., claim no., claim date, Amanah (and municipality when present), debtor type, execution type
const header = (r, { municipality = true } = {}) => [
  ln(`رقم طلب التنفيذ: ${r.req}`, 'requestNo', String(r.req), 0.99), ln(`رقم طلب المطالبة بالأداء: ${r.claim}`, 'claimNo', String(r.claim), 0.98), ln(`تاريخ المطالبة: ${r.date}`, 'claimDate', r.date, 0.97),
  ln(`الأمانة: ${r.amanah}`, 'amanah', r.amanah, 0.96), ...(municipality ? [ln(`البلدية: ${r.muni}`, 'municipality', r.muni, 0.95)] : []),
  ln(`نوع المنفذ ضده: ${r.debtor}`, 'debtorType', r.debtor, 0.94), ln(`نوع التنفيذ: ${r.exec}`, 'executionType', r.exec, 0.94)
];
const totals = (total, enf, enfConf = 0.98, enfNote = '') => [
  ln(`المبلغ الإجمالي: ${money(total)}`, 'amount', total, 0.98), ln(`المبلغ كتابة: ${amountInWords(total)}`, 'amountWords', amountInWords(total), 0.92), ln(`رقم الانفاذ: ${enf}${enfNote}`, 'enforcementNo', String(enf), enfConf)
];

function build({ id, n, recordKey, file, title, pages, ...rest }) {
  const total = pages.length; const texts = pages.map((p, i) => [DOC_MARK, p.title, ...p.lines.map((l) => l.text), `صفحة ${i + 1} من ${total}`].join('\n')); const fields = {};
  pages.forEach((p, i) => p.lines.forEach((l) => { if (l.key && !fields[l.key]) fields[l.key] = { value: l.value, confidence: l.conf, page: i + 1, snippet: l.text }; }));
  return { id, n, recordKey, file, title, pages: texts, fields, ...rest };
}
const R1 = { req: 9100001, claim: 9200001, date: '2026-02-03', amanah: 'قطاع الإسكان', muni: 'وحدة المبيعات السكنية', debtor: 'شركة مسجلة في المملكة', exec: 'عقود او محررات موثقة' };
const R2 = { req: 9100002, claim: 9200002, date: '2026-03-12', amanah: 'قطاع الإسكان', muni: 'وحدة المبيعات السكنية', debtor: 'فرد (مستثمر)', exec: 'عقود او محررات موثقة' };
const R3 = { req: 9100003, claim: 9200003, date: '2026-04-05', amanah: 'قطاع الإسكان', muni: 'وحدة المبيعات السكنية', debtor: 'مؤسسة اهلية', exec: 'أوراق تجارية' };
const R5 = { req: 9100005, claim: 9200005, date: '2026-06-02', amanah: 'قطاع الإسكان', muni: 'وحدة المبيعات السكنية', debtor: 'جهة إدارية', exec: 'عقود او محررات موثقة' };
const R8 = { req: 9100008, claim: 9200008, date: '2026-08-03', amanah: 'أمانة محافظة جدة', muni: 'بلدية الشرق', debtor: 'شركة مسجلة في المملكة', exec: 'عقود او محررات موثقة' };
const R9 = { req: 9100009, claim: 9200009, date: '2026-08-17', amanah: 'أمانة المنطقة الشرقية', muni: 'بلدية الشمال', debtor: 'مؤسسة اهلية', exec: 'عقود او محررات موثقة' };
const R6 = { req: 9100006, claim: 9200006, date: '2026-07-06', amanah: 'أمانة محافظة جدة', muni: 'بلدية الشرق', debtor: 'شركة مسجلة في المملكة', exec: 'عقود او محررات موثقة' };

// ---- scenario 1: three invoices (A, B, C), all matched; the order amount is their total ----
const S1 = build({
  id: 'sc1-match', n: 1, recordKey: 'SND-9100001', file: 'sanad-9100001.pdf', title: { ar: 'ثلاث فواتير — كلها مطابقة', en: 'Three invoices — all matched' },
  invoices: [{ value: '171-407930123150', page: 2, expect: 'matched' }, { value: '171-407950123141', page: 2, expect: 'matched' }, { value: '171-408030123105', page: 3, expect: 'matched' }],
  pages: [
    { title: TITLE, lines: header(R1) },
    { title: `${TITLE_INV} (1/2)`, lines: [inv('171-407930123150', 'الفاتورة 1', 9478590, 'invoiceNo'), inv('171-407950123141', 'الفاتورة 2', 9524400)] },
    { title: `${TITLE_INV} (2/2) — ${TITLE_END}`, lines: [inv('171-408030123105', 'الفاتورة 3', 45152220), ...totals(64155210, 9300001)] }
  ]
});

// ---- scenario 2: D (clean), a SHORT serial-only number (the tail of E: ambiguous across years / Amanahs) and a number that exists nowhere; the municipality is absent ----
const S2 = build({
  id: 'sc2-uncertain', n: 2, recordKey: 'SND-9100002', file: 'sanad-9100002.pdf', title: { ar: 'فاتورة سليمة ورقم مختصر ورقم غير موجود', en: 'One clean invoice, a short number and an unmatched number' },
  invoices: [{ value: '171-407850123186', page: 2, expect: 'matched' }, { value: '0000031', page: 2, expect: 'incomplete' }, { value: '171-407777777777', page: 3, expect: 'unmatched' }],
  pages: [
    { title: TITLE, lines: header(R2, { municipality: false }) },
    { title: `${TITLE_INV} (1/2)`, lines: [inv('171-407850123186', 'الفاتورة 1', 103790970, 'invoiceNo'), ln('الفاتورة 2 (الرقم المختصر فقط): 0000031')] },
    { title: `${TITLE_INV} (2/2) — ${TITLE_END}`, lines: [ln('الفاتورة 3: 171-407777777777'), ...totals(155034670, 9300002, 0.54, ' (الرقم باهت في الأصل)')] }
  ]
});

// ---- scenario 3: G + an invoice of ANOTHER Amanah (Riyadh) + an ambiguous bare serial; the document total differs from the order amount ----
const S3 = build({
  id: 'sc3-conflict', n: 3, recordKey: 'SND-9100003', file: 'sanad-9100003.pdf', title: { ar: 'أمانة أخرى ورقم ملتبس وفرق في المبلغ', en: 'Other Amanah, ambiguous serial and an amount difference' },
  invoices: [{ value: '171-407990123123', page: 2, expect: 'matched' }, { value: '177-408500122934', page: 2, expect: 'conflicting' }, { value: '0000094', page: 3, expect: 'ambiguous' }],
  pages: [
    { title: TITLE, lines: header(R3) },
    { title: `${TITLE_INV} (1/2)`, lines: [inv('171-407990123123', 'الفاتورة 1', 79244410, 'invoiceNo'), inv('177-408500122934', 'الفاتورة 2', 70653160)] },
    { title: `${TITLE_INV} (2/2) — ${TITLE_END}`, lines: [ln('الفاتورة 3 (الرقم المختصر فقط): 0000094'), ...totals(149897570, 9300003)] }
  ]
});

// ---- scenario 4: NO document (the record stays visible with the flag and the attach actions) ----
const S4 = { id: 'sc4-missing', n: 4, recordKey: 'SND-9100004', file: null, title: { ar: 'سجل بلا مستند', en: 'Record without a document' }, pages: [], fields: {}, invoices: [] };

// ---- scenario 5: the first attempt fails (page 2 unreadable), the retry succeeds; F is PARTLY PAID, E is clean ----
const S5 = build({
  id: 'sc5-retry', n: 5, recordKey: 'SND-9100005', file: 'sanad-9100005.pdf', title: { ar: 'فشل الاستخراج ثم نجاح المحاولة الثانية', en: 'Extraction fails, the retry succeeds' },
  failOnAttempts: [1], failure: { code: 'page_unreadable', page: 2, message: { ar: 'تعذّرت قراءة الصفحة 2: جودة المسح غير كافية (فشل محاكى).', en: 'Page 2 could not be read: scan quality too low (simulated failure).' } },
  invoices: [{ value: '171-407890123168', page: 2, expect: 'matched' }, { value: '171-407870123177', page: 3, expect: 'matched' }],
  pages: [
    { title: TITLE, lines: header(R5) },
    { title: `${TITLE_INV} (1/2)`, lines: [inv('171-407890123168', 'الفاتورة 1', 190630970, 'invoiceNo')] },
    { title: `${TITLE_INV} (2/2) — ${TITLE_END}`, lines: [inv('171-407870123177', 'الفاتورة 2', 51243700), ...totals(241874670, 9300005)] }
  ]
});

// ---- scenario 6: H, an invoice CANCELLED in the source (a Jeddah Amanah invoice, the order's own Amanah) ----
const S6 = build({
  id: 'sc6-cancelled', n: 6, recordKey: 'SND-9100006', file: 'sanad-9100006.pdf', title: { ar: 'فاتورة ملغاة في المصدر', en: 'An invoice cancelled in the source' },
  invoices: [{ value: '177-407980123168', page: 2, expect: 'cancelled' }],
  pages: [
    { title: TITLE, lines: header(R6) },
    { title: `${TITLE_INV} — ${TITLE_END}`, lines: [inv('177-407980123168', 'الفاتورة 1', 77876290, 'invoiceNo'), ...totals(77876290, 9300006)] }
  ]
});


// ---- scenario 7: NO document needed — the structured number matches one invoice and the amount equals it (the reviewer only confirms) ----
const S7 = { id: 'sc7-structured', n: 7, recordKey: 'SND-9100007', file: null, title: { ar: 'رقم صحيح وقيمة مطابقة — بلا مستند', en: 'Correct number, matching amount — no document' }, pages: [], fields: {}, invoices: [] };

// ---- scenario 8: the structured number exists nowhere; the document names the right invoice (the structured one is then corrected, with the reason kept) ----
const S8 = build({
  id: 'sc8-unmatched', n: 8, recordKey: 'SND-9100008', file: 'sanad-9100008.pdf', title: { ar: 'رقم غير موجود يُستبدل بالمستخرج من المستند', en: 'Unmatched number replaced by the one extracted from the document' },
  invoices: [{ value: '177-407940123186', page: 2, expect: 'matched' }],
  pages: [
    { title: TITLE, lines: header(R8) },
    { title: `${TITLE_INV} — ${TITLE_END}`, lines: [inv('177-407940123186', 'الفاتورة 1', 45919400, 'invoiceNo'), ...totals(45919400, 9300008)] }
  ]
});

// ---- scenario 9: the structured number is valid but covers only part of the order amount; the document also names the missing invoice (difference before 77,837,190, after 0) ----
const S9 = build({
  id: 'sc9-difference', n: 9, recordKey: 'SND-9100009', file: 'sanad-9100009.pdf', title: { ar: 'فرق في القيمة وفاتورة ناقصة في المستند', en: 'Amount difference and a missing invoice found in the document' },
  invoices: [{ value: '177-408960122727', page: 2, expect: 'matched' }, { value: '177-409340122475', page: 2, expect: 'matched' }],
  pages: [
    { title: TITLE, lines: header(R9) },
    { title: `${TITLE_INV} — ${TITLE_END}`, lines: [inv('177-408960122727', 'الفاتورة 1', 2845640, 'invoiceNo'), inv('177-409340122475', 'الفاتورة 2', 77837190), ...totals(80682830, 9300009)] }
  ]
});

export const SCENARIOS = [S1, S2, S3, S4, S5, S6, S7, S8, S9];
export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id) || null;
export const scenarioForRecord = (key) => SCENARIOS.find((s) => s.recordKey === key) || null;
export const SCENARIO_DOCS = SCENARIOS.filter((s) => s.file);
