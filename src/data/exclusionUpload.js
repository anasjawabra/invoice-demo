// The exclusion upload template (IIM-30) — the channel for R8 «التعديات واستغلال المواقع (محضر التعدي)» and R9 «إفادات الأمانات».
// An Amanah sends this list ad hoc, once or twice a month, typically 100–200 invoices. The file is read in the browser, every row is checked against the invoice data
// (server: /api/exclusion-check) and only a FULL match is accepted; any mismatch is rejected and returned with the reason. Nothing here writes to a source system.
// Pure functions + file builders that take the `xlsx` / `jszip` modules as arguments, so the same code runs in the browser and in the sample generator.
import { EXCLUSION_REASONS, EXCLUSION_REASON_OF_RULE } from './iim';
import { ENTITIES, ENT_UNASSIGNED, ENT_HOUSING } from './catalog';

export const UPLOAD_RULES = ['ENC-1', 'ATT-1']; // R8, R9 — the only reasons this template can carry
export const UPLOAD_SOURCE = { ar: 'ملف الأمانة (رفع يدوي)', en: 'Amanah file (manual upload)' };
export const TEMPLATE_COLUMNS = [
  { key: 'invoiceNo', ar: 'رقم الفاتورة', en: 'Invoice number', width: 24 },
  { key: 'date', ar: 'تاريخ الفاتورة', en: 'Invoice date', width: 16 },
  { key: 'amount', ar: 'المبلغ', en: 'Amount', width: 16 },
  { key: 'amanah', ar: 'الأمانة / الجهة', en: 'Amanah / entity', width: 30 },
  { key: 'name', ar: 'اسم المكلف', en: 'Taxpayer name', width: 28 },
  { key: 'account', ar: 'رقم حساب الإيراد', en: 'Revenue account number', width: 18 },
  { key: 'reason', ar: 'سبب الاستبعاد', en: 'Exclusion reason', width: 40 }
];
export const REJECT_COLUMN = { ar: 'سبب الرفض', en: 'Rejection reason' };
export const TEMPLATE_SHEET = 'النموذج';
export const LISTS_SHEET = 'القوائم';
export const TEMPLATE_ROWS = 500; // rows the drop-downs cover

export const uploadReasons = () => UPLOAD_RULES.map((id) => EXCLUSION_REASON_OF_RULE[id]);
export const amanahNames = () => ENTITIES.filter((_, i) => i !== ENT_UNASSIGNED).map((e) => e.ar);

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'; const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const westernDigits = (v) => String(v ?? '').replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
const clean = (v) => westernDigits(v).replace(/[‎‏‪-‮ ]/g, ' ').trim();
const normText = (v) => clean(v).replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').toLowerCase();

/** the reason column → the rule id (R8 / R9) or null. Accepts the Arabic or English label, or the code. */
export function reasonRuleOf(text) {
  const t = normText(text); if (!t) return null;
  for (const id of UPLOAD_RULES) { const r = EXCLUSION_REASON_OF_RULE[id]; if ([r.ar, r.en, r.code, `r${r.n}`].some((x) => normText(x) === t)) return id; }
  return null;
}
/** the Amanah column → the entity index, or -1 */
export function entityIndexOf(text) {
  const t = normText(text); if (!t) return -1;
  return ENTITIES.findIndex((e, i) => i !== ENT_UNASSIGNED && [e.ar, e.en, e.zh].some((x) => normText(x) === t));
}
export const isHousing = (idx) => idx === ENT_HOUSING;

/** Excel serial / Date / "2026-03-04" / "04/03/2026" (day first) / Arabic digits → "YYYY-MM-DD", or '' when it is not a date */
export function normDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = clean(v); if (!s) return '';
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
export function normNumber(v) { if (typeof v === 'number') return Number.isFinite(v) ? v : NaN; const s = clean(v).replace(/[,٬\s]/g, '').replace(/٫/g, '.'); return s === '' ? NaN : Number(s); }

/** the sheet as rows of cells (XLSX.utils.sheet_to_json with header:1) → the rows of the template, found by header names so the column order may differ */
export function readRows(cells) {
  const head = (cells || []).findIndex((r) => (r || []).some((c) => normText(c) === normText(TEMPLATE_COLUMNS[0].ar)));
  if (head < 0) return { error: 'no_header', rows: [] };
  const idx = {}; (cells[head] || []).forEach((c, j) => { const col = TEMPLATE_COLUMNS.find((x) => normText(x.ar) === normText(c) || normText(x.en) === normText(c)); if (col && idx[col.key] == null) idx[col.key] = j; });
  const missing = TEMPLATE_COLUMNS.filter((c) => idx[c.key] == null).map((c) => c.ar);
  if (missing.length) return { error: 'missing_columns', missing, rows: [] };
  const rows = [];
  for (let r = head + 1; r < cells.length; r += 1) {
    const line = cells[r] || []; if (!line.some((c) => clean(c) !== '')) continue;
    const o = { row: r + 1 }; for (const c of TEMPLATE_COLUMNS) o[c.key] = line[idx[c.key]];
    rows.push({ row: o.row, invoiceNo: clean(o.invoiceNo), date: normDate(o.date), dateRaw: clean(o.date), amount: normNumber(o.amount), amountRaw: clean(o.amount), amanah: clean(o.amanah), name: clean(o.name), account: clean(o.account), reason: clean(o.reason) });
  }
  return { error: null, rows };
}

/** the template: an .xlsx with the seven columns, the Amanah and reason columns as drop-down lists (data validation), and a lists sheet. XLSX = the `xlsx` module, JSZip = the `jszip` module. */
export async function buildTemplate(XLSX, JSZip, { sample = [] } = {}) {
  const wb = XLSX.utils.book_new();
  const head = TEMPLATE_COLUMNS.map((c) => c.ar);
  const ws = XLSX.utils.aoa_to_sheet([head, ...sample.map((r) => TEMPLATE_COLUMNS.map((c) => r[c.key] ?? ''))]);
  ws['!cols'] = TEMPLATE_COLUMNS.map((c) => ({ wch: c.width }));
  ws['!views'] = [{ rightToLeft: true }];
  const lists = XLSX.utils.aoa_to_sheet([['الأمانة / الجهة', 'سبب الاستبعاد'], ...Array.from({ length: Math.max(amanahNames().length, 2) }, (_, i) => [amanahNames()[i] || '', uploadReasons()[i]?.ar || ''])]);
  lists['!cols'] = [{ wch: 34 }, { wch: 44 }]; lists['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, ws, TEMPLATE_SHEET); XLSX.utils.book_append_sheet(wb, lists, LISTS_SHEET);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return addValidation(JSZip, buf);
}
// SheetJS (community) cannot write data validations, so they are added to the sheet XML after writing
async function addValidation(JSZip, buf) {
  const zip = await JSZip.loadAsync(buf); const file = 'xl/worksheets/sheet1.xml';
  const xml = await zip.file(file).async('string');
  const ix = (k) => TEMPLATE_COLUMNS.findIndex((c) => c.key === k); const col = (k) => String.fromCharCode(65 + ix(k));
  const q = `'${LISTS_SHEET}'`;
  const dv = `<dataValidations count="2"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="الأمانة / الجهة" error="اختر الأمانة من القائمة" sqref="${col('amanah')}2:${col('amanah')}${TEMPLATE_ROWS + 1}"><formula1>${q}!$A$2:$A$${amanahNames().length + 1}</formula1></dataValidation>`
    + `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="سبب الاستبعاد" error="اختر أحد السببين من القائمة" sqref="${col('reason')}2:${col('reason')}${TEMPLATE_ROWS + 1}"><formula1>${q}!$B$2:$B$${uploadReasons().length + 1}</formula1></dataValidation></dataValidations>`;
  const out = /<pageMargins/.test(xml) ? xml.replace('<pageMargins', `${dv}<pageMargins`) : xml.replace('</worksheet>', `${dv}</worksheet>`);
  zip.file(file, out);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** the rejected rows, in the same columns plus «سبب الرفض», to return to the Amanah */
export function buildRejectedWorkbook(XLSX, rejected) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[...TEMPLATE_COLUMNS.map((c) => c.ar), REJECT_COLUMN.ar], ...rejected.map((r) => [...TEMPLATE_COLUMNS.map((c) => (c.key === 'date' ? r.dateRaw || r.date : c.key === 'amount' ? (r.amountRaw ?? r.amount) : r[c.key] ?? '')), r.reason_ar || r.rejection || ''])]);
  ws['!cols'] = [...TEMPLATE_COLUMNS.map((c) => ({ wch: c.width })), { wch: 46 }]; ws['!views'] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(wb, ws, 'الصفوف المرفوضة');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

/** the text of a rejection code, in the user's language */
export const REJECTIONS = {
  reason_invalid: { ar: 'سبب الاستبعاد غير صالح: اختر «التعديات واستغلال المواقع (محضر التعدي)» أو «إفادات الأمانات».', en: 'The exclusion reason is not valid: choose the encroachment report or the Amanah statement.' },
  invoice_no_missing: { ar: 'رقم الفاتورة مطلوب.', en: 'The invoice number is required.' },
  amanah_missing: { ar: 'الأمانة / الجهة مطلوبة.', en: 'The Amanah / entity is required.' },
  amanah_unknown: { ar: 'الأمانة / الجهة غير معروفة: اخترها من القائمة.', en: 'The Amanah / entity is not known: choose it from the list.' },
  invoice_not_found: { ar: 'الفاتورة غير موجودة لهذه الأمانة.', en: 'The invoice was not found for this Amanah.' },
  other_amanah: { ar: 'الفاتورة موجودة لكنها تتبع أمانة أخرى.', en: 'The invoice exists but belongs to another Amanah.' },
  already_collected: { ar: 'الفاتورة محصّلة: لا تُستبعد إلا الفواتير غير المحصّلة.', en: 'The invoice is already collected: only uncollected invoices are excluded.' },
  cancelled: { ar: 'الفاتورة ملغاة.', en: 'The invoice is cancelled.' },
  amount_mismatch: { ar: 'المبلغ غير مطابق لمبلغ الفاتورة.', en: 'The amount does not match the invoice.' },
  date_mismatch: { ar: 'تاريخ الفاتورة غير مطابق.', en: 'The invoice date does not match.' },
  account_mismatch: { ar: 'رقم حساب الإيراد غير مطابق.', en: 'The revenue account number does not match.' },
  not_investment: { ar: 'التعديات واستغلال المواقع تخص فواتير الاستثمار فقط.', en: 'Encroachments apply to investment invoices only.' },
  duplicate_in_file: { ar: 'الفاتورة مكررة في الملف.', en: 'The invoice appears twice in the file.' }
};
