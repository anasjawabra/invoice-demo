// The fields a Sanad document can supply (limited to what the Sanad schema supports — see SOURCE_FIELDS in ../sanadSource.js), how each is normalised for comparison,
// and the conflict rule: only an IDENTIFIER or the AMOUNT can conflict (the amount within AMOUNT_TOLERANCE SAR is the same amount). A text field that merely reads
// differently is shown as «differs» but never blocks the review.
import { analyzeNotation } from '../sanadSource.js';
import { ENTITIES } from '../catalog.js';

export const AMOUNT_TOLERANCE = 1; // SAR — the same tolerance as orderMatching.js (rounding only; anything larger is a real difference)
export const UNCERTAIN_BELOW = 0.75; // a simulated confidence under this is reported as «uncertain»

export const DOC_FIELDS = [
  { key: 'requestNo', kind: 'identifier', ar: 'رقم طلب التنفيذ', en: 'Enforcement request no.' },
  { key: 'claimNo', kind: 'identifier', ar: 'رقم طلب المطالبة بالأداء', en: 'Claim request no.' },
  { key: 'claimDate', kind: 'date', ar: 'تاريخ المطالبة', en: 'Claim date' },
  { key: 'amanah', kind: 'text', ar: 'الأمانة', en: 'Amanah' },
  { key: 'municipality', kind: 'text', ar: 'البلدية', en: 'Municipality' },
  { key: 'amount', kind: 'amount', ar: 'المبلغ', en: 'Amount' },
  { key: 'amountWords', kind: 'text', ar: 'المبلغ كتابة', en: 'Amount in words' },
  { key: 'enforcementNo', kind: 'identifier', ar: 'رقم الانفاذ', en: 'Enforcement no.' },
  { key: 'invoiceNo', kind: 'identifier', ar: 'رقم الفاتورة', en: 'Invoice no.' },
  { key: 'debtorType', kind: 'text', ar: 'نوع المنفذ ضده', en: 'Debtor type' },
  { key: 'executionType', kind: 'text', ar: 'نوع التنفيذ', en: 'Execution type' }
];
export const FIELD_BY_KEY = Object.fromEntries(DOC_FIELDS.map((f) => [f.key, f]));
export const CONFLICT_KINDS = new Set(['identifier', 'amount']);

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const toLatinDigits = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
export const isEmptyValue = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const normText = (s) => toLatinDigits(s).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
export const normId = (v) => toLatinDigits(v).replace(/[\s\-_/.,]/g, '').trim();
export function parseAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = toLatinDigits(v).replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (!s || !/\d/.test(s)) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
}
export const normDate = (v) => { const m = /(\d{4})-(\d{2})-(\d{2})/.exec(toLatinDigits(v)); return m ? m[0] : null; };

// the value a field takes in the normalised form used for comparing (null when empty / not usable)
export function normalize(kind, v) {
  if (isEmptyValue(v)) return null;
  if (kind === 'amount') return parseAmount(v);
  if (kind === 'identifier') return normId(v) || null;
  if (kind === 'date') return normDate(v);
  return normText(v) || null;
}
// the user-facing form of a value (amounts keep two decimals; everything else as typed)
export function displayValue(kind, v) {
  if (isEmptyValue(v)) return '';
  if (kind === 'amount') { const n = parseAmount(v); return n == null ? String(v) : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  return String(v);
}
// a typed correction → the stored value ({ok:false} when it is not valid for the field kind)
export function coerceValue(kind, raw) {
  if (isEmptyValue(raw)) return { ok: false };
  if (kind === 'amount') { const n = parseAmount(raw); return n == null || n < 0 ? { ok: false } : { ok: true, value: n }; }
  if (kind === 'identifier') { const n = normId(raw); return /^[A-Za-z0-9]+$/.test(n) ? { ok: true, value: n } : { ok: false }; }
  if (kind === 'date') { const d = normDate(raw); return d ? { ok: true, value: d } : { ok: false }; }
  return { ok: true, value: String(raw).trim() };
}

// the structured Sanad values of a record (what the system holds without any document). A value that arrived corrupted by a spreadsheet (digits lost) is not usable for comparing.
export function structuredValues(record) {
  const s = record?.source || {};
  const amanah = s.amanah || record?.amanahAr || (record?.amanahEn ? ENTITIES.find((e) => e.en === record.amanahEn)?.ar : null) || null;
  const usable = (raw, plain) => { const a = analyzeNotation(raw || plain); if (a.notation && !a.exact) return null; return a.notation && a.exact ? a.digits : plain; };
  return {
    requestNo: s.requestNo ?? null,
    claimNo: usable(s.claimNoRaw, s.claimNo) ?? null,
    claimDate: s.claimDate ?? null,
    amanah,
    municipality: s.municipality ?? null,
    amount: s.amount ?? record?.amount ?? null,
    amountWords: s.amountWords ?? null,
    enforcementNo: usable(s.enforcementNoRaw, s.enforcementNo) ?? null,
    invoiceNo: usable(null, s.invoiceNo) ?? null,
    debtorType: s.debtorType ?? null,
    executionType: s.executionType ?? null
  };
}

// compare ONE extracted value with the structured one → { comparable, same, conflict, difference? }
export function compareField(key, extracted, structured) {
  const def = FIELD_BY_KEY[key]; if (!def) return { comparable: false, same: null, conflict: false };
  const a = normalize(def.kind, extracted); const b = normalize(def.kind, structured);
  if (a === null || b === null) return { comparable: false, same: null, conflict: false };
  if (def.kind === 'amount') { const difference = a - b; const same = Math.abs(difference) <= AMOUNT_TOLERANCE; return { comparable: true, same, conflict: !same, difference }; }
  // an invoice number may carry its biller prefix («177-407580123348») on one side and be only the Sadad number («407580123348») on the other: the Sadad parts decide
  const same = a === b || (key === 'invoiceNo' && typeof a === 'string' && typeof b === 'string' && ((a.length > b.length && a.endsWith(b) && b.length >= 12) || (b.length > a.length && b.endsWith(a) && a.length >= 12)));
  return { comparable: true, same, conflict: !same && CONFLICT_KINDS.has(def.kind) };
}

// status of an extracted field against the record: missing (no value) | conflict | uncertain (low confidence) | extracted
export function classifyField(key, value, confidence, structured) {
  if (isEmptyValue(value)) return 'missing';
  if (compareField(key, value, structured).conflict) return 'conflict';
  return Number(confidence) < UNCERTAIN_BELOW ? 'uncertain' : 'extracted';
}
