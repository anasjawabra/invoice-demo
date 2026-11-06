// Identifier and date normalisation for imported source cells. Identifiers are kept as STRINGS: never parsed as numbers, never padded, never "repaired".
// A cell is classified, not trusted: `usable` is false when the identifier is damaged or ambiguous (it is then kept for provenance but never used as a key or for matching).
import { analyzeNotation } from '../sanadSource';

export const ID_FLAG = {
  damaged_scientific_notation: { ar: 'رقم تالف: كُتب بالصيغة العلمية وفقدت أرقامه', en: 'Damaged: written in scientific notation, digits lost', blocking: true },
  recovered_from_scientific_notation: { ar: 'استُعيد من الصيغة العلمية (كل الأرقام مكتوبة)', en: 'Recovered from scientific notation (all digits written)', blocking: false },
  excel_precision_risk: { ar: 'رقم أطول من دقة إكسل (15 رقماً): قد تكون الأرقام الأخيرة مفقودة', en: 'Longer than Excel precision (15 digits): trailing digits may be lost', blocking: true },
  non_integer: { ar: 'قيمة عددية غير صحيحة لا تصلح معرّفاً', en: 'Non-integer numeric value is not a valid identifier', blocking: true },
  non_numeric: { ar: 'يحتوي على غير الأرقام', en: 'Contains non-digit characters', blocking: true },
  unexpected_format: { ar: 'صيغة غير متوقعة للمعرّف', en: 'Unexpected identifier format', blocking: true },
  shorter_than_expected: { ar: 'أقصر من الطول المتوقع: قد تكون الأصفار البادئة مفقودة (لم تُضف)', en: 'Shorter than expected: leading zeros may have been lost (not added back)', blocking: false },
  placeholder: { ar: 'قيمة نائبة وليست معرّفاً', en: 'Placeholder, not an identifier', blocking: true },
  surrounding_space: { ar: 'مسافات حول القيمة أُزيلت', en: 'Surrounding whitespace removed', blocking: false }
};

const PLACEHOLDERS = new Set(['---', '--', '-', 'NULL', 'null', 'N/A', 'n/a']);
export const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

// → { raw: string, value: string|null, flags: string[], usable: boolean }
// opts: { kind: 'numeric' | 'text', pattern?: RegExp (for kind 'text'), expectedLength?: number }
export function normalizeIdentifier(cell, opts = {}) {
  const kind = opts.kind || 'numeric'; const flags = [];
  if (isBlank(cell)) return { raw: '', value: null, flags, usable: false };
  if (typeof cell === 'number') {
    const raw = Number.isFinite(cell) ? String(cell) : String(cell);
    if (!Number.isFinite(cell) || !Number.isInteger(cell)) { flags.push('non_integer'); return { raw, value: null, flags, usable: false }; }
    if (Math.abs(cell) >= 1e15) { flags.push('excel_precision_risk'); return { raw, value: null, flags, usable: false }; }
    if (/e/i.test(raw)) { flags.push('excel_precision_risk'); return { raw, value: null, flags, usable: false }; }
    if (opts.expectedLength && raw.length < opts.expectedLength) flags.push('shorter_than_expected');
    return { raw, value: raw, flags, usable: true };
  }
  const original = String(cell); const s = original.trim();
  if (s !== original) flags.push('surrounding_space');
  if (PLACEHOLDERS.has(s)) { flags.push('placeholder'); return { raw: original, value: null, flags, usable: false }; }
  const n = analyzeNotation(s);
  if (n.notation) {
    if (n.exact) { flags.push('recovered_from_scientific_notation'); return { raw: original, value: n.digits, flags, usable: true }; }
    flags.push('damaged_scientific_notation'); return { raw: original, value: null, flags, usable: false };
  }
  if (kind === 'numeric') {
    if (!/^\d+$/.test(s)) { flags.push('non_numeric'); return { raw: original, value: null, flags, usable: false }; }
    if (opts.expectedLength && s.length < opts.expectedLength) flags.push('shorter_than_expected');
    return { raw: original, value: s, flags, usable: true };
  }
  if (opts.pattern && !opts.pattern.test(s)) { flags.push('unexpected_format'); return { raw: original, value: s, flags, usable: false }; }
  return { raw: original, value: s, flags, usable: true };
}
export const isBlockingFlag = (f) => !!ID_FLAG[f]?.blocking;

/* ------------------------------------------------------------------ dates (Excel serial numbers are unambiguous; ambiguous day/month text is NOT guessed) */
export const DATE_FLAG = {
  ambiguous_date: { ar: 'تاريخ نصي ملتبس (يوم/شهر) لم يُفسَّر', en: 'Ambiguous day/month text date: not interpreted' },
  invalid_date: { ar: 'تاريخ غير صالح', en: 'Invalid date' },
  placeholder: { ar: 'قيمة نائبة بدل التاريخ', en: 'Placeholder instead of a date' }
};
const pad = (n) => String(n).padStart(2, '0');
// → { raw, value: 'YYYY-MM-DD' | 'YYYY-MM-DD HH:mm' | null, flags }
export function normalizeDate(cell) {
  if (isBlank(cell)) return { raw: '', value: null, flags: [] };
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell) || cell < 1 || cell > 2958465) return { raw: String(cell), value: null, flags: ['invalid_date'] };
    const ms = Math.round((cell - 25569) * 864e5); const d = new Date(ms); const whole = Number.isInteger(cell);
    const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return { raw: String(cell), value: whole ? day : `${day} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`, flags: [] };
  }
  const s = String(cell).trim();
  if (PLACEHOLDERS.has(s)) return { raw: s, value: null, flags: ['placeholder'] };
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(s);
  if (m) return { raw: s, value: m[4] ? `${m[1]}-${m[2]}-${m[3]} ${pad(m[4])}:${m[5]}` : `${m[1]}-${m[2]}-${m[3]}`, flags: [] };
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s);
  if (m) {
    const a = Number(m[1]); const b = Number(m[2]);
    if (a > 12 && b <= 12) return { raw: s, value: `${m[3]}-${pad(b)}-${pad(a)}${m[4] ? ` ${pad(m[4])}:${m[5]}` : ''}`, flags: [] };
    if (b > 12 && a <= 12) return { raw: s, value: `${m[3]}-${pad(a)}-${pad(b)}${m[4] ? ` ${pad(m[4])}:${m[5]}` : ''}`, flags: [] };
    return { raw: s, value: null, flags: ['ambiguous_date'] };
  }
  return { raw: s, value: null, flags: ['invalid_date'] };
}

// amounts: a number, or a numeric string; anything else is flagged (never guessed)
export function normalizeAmount(cell) {
  if (isBlank(cell)) return { raw: '', value: null, flags: [] };
  if (typeof cell === 'number') return Number.isFinite(cell) ? { raw: String(cell), value: cell, flags: [] } : { raw: String(cell), value: null, flags: ['invalid_amount'] };
  const s = String(cell).trim().replace(/,/g, ''); if (/^-?\d+(\.\d+)?$/.test(s)) return { raw: String(cell), value: Number(s), flags: [] };
  return { raw: String(cell), value: null, flags: ['invalid_amount'] };
}
