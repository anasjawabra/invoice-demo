// ============================================================================
// ONE central money formatter.
//
// Amounts are STORED and CALCULATED in SAR. For display every amount carries ONE appropriate unit chosen from its size:
//   SAR (< 1,000) · ألف / thousand (≥ 1,000) · مليون / million (≥ 1,000,000) · مليار / billion (≥ 1,000,000,000)
// e.g. 14,918,396,920 → «14.92 مليار SAR»; 7,834 → «7.83 ألف SAR».
// Inside ONE table or chart all amounts share ONE unit (pickUnit over the largest value) so columns stay comparable.
// Exact SAR stays available in tooltips, invoice/evidence tables and exports. Never apply this to ratios, counts, days or identifiers.
// ============================================================================
export const UNITS = {
  B: { key: 'B', div: 1e9, ar: 'مليار', en: 'bn' },
  M: { key: 'M', div: 1e6, ar: 'مليون', en: 'M' },
  K: { key: 'K', div: 1e3, ar: 'ألف', en: 'K' },
  S: { key: 'S', div: 1, ar: '', en: '' }
};
// threshold slightly under the next unit so 999.99 M reads «1 مليار», never «1,000 مليون»
export function pickUnit(maxAbs) {
  const a = Math.abs(Number(maxAbs) || 0);
  if (a >= 0.9995e9) return UNITS.B;
  if (a >= 0.9995e6) return UNITS.M;
  if (a >= 0.9995e3) return UNITS.K;
  return UNITS.S;
}
export const unitLabel = (u, lang = 'ar') => `${u.key === 'S' ? '' : `${lang === 'ar' ? u.ar : u.en} `}SAR`;
export const unitOfValues = (values) => pickUnit(Math.max(0, ...(values || []).map((v) => Math.abs(Number(v) || 0))));

const trim = (s) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
const group = (intPart) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// number part only, in the given unit. mode: 'card' (≤ 2 decimals) | 'detail' (up to 9 decimals: exact conversion)
export function scaled(amountSar, unit = 'auto', mode = 'card') {
  const a = Number(amountSar);
  if (!Number.isFinite(a)) return '—';
  if (a === 0) return '0';
  const u = unit === 'auto' ? pickUnit(a) : unit;
  const sign = a < 0 ? '-' : '';
  const x = Math.abs(a) / u.div;
  if (u.key === 'S') { const [i, d] = trim((mode === 'card' ? x.toFixed(x < 1 ? 2 : 0) : x.toFixed(2))).split('.'); return `${sign}${group(i)}${d ? `.${d}` : ''}`; }
  if (mode === 'card') {
    if (x < 0.005) return `${sign ? '>-' : '<'}0.01`; // a positive amount never reads as zero
    const [i, d] = trim(x.toFixed(2)).split('.');
    return `${sign}${group(i)}${d ? `.${d}` : ''}`;
  }
  const [i, d] = trim(x.toFixed(9)).split('.');
  return `${sign}${group(i)}${d ? `.${d}` : ''}`;
}
// {num, label, unit} — num in the chosen unit, label like «مليار SAR»
export function fmtParts(amountSar, { lang = 'ar', unit = 'auto', mode = 'card' } = {}) {
  const u = unit === 'auto' || Number(amountSar) === 0 ? pickUnit(amountSar) : unit; // zero reads «0 SAR», never «0 مليون»
  return { num: scaled(amountSar, u, mode), label: unitLabel(u, lang), unit: u };
}
// «14.92 مليار SAR». `unit`: 'auto' (per amount) | a UNITS entry (shared by a whole table / chart). `withUnit:false` → number only.
export function fmtMoney(amountSar, { lang = 'ar', mode = 'card', unit = 'auto', withUnit = true } = {}) {
  if (!Number.isFinite(Number(amountSar))) return '—';
  const p = fmtParts(amountSar, { lang, unit: unit === false || unit === true ? 'auto' : unit, mode });
  return withUnit && unit !== false ? `${p.num} ${p.label}` : p.num;
}
// legacy name, same behaviour (adaptive unit). `unit:false` still means "number only".
export const fmtBn = fmtMoney;

// exact SAR (tooltips, invoice/evidence tables, exports)
export function fmtSar(amountSar) {
  const a = Number(amountSar);
  if (!Number.isFinite(a)) return '—';
  return `${a.toLocaleString('en-US', { maximumFractionDigits: 2 })} SAR`;
}

// Chart helper: ONE unit for the whole chart, its axis title, ticks and tooltips.
export function chartUnit(values, lang = 'ar') {
  const unit = unitOfValues(values);
  return {
    unit, title: lang === 'ar' ? `القيمة — ${unitLabel(unit, 'ar')}` : `Value — ${unitLabel(unit, 'en')}`,
    tick: (v) => scaled(v, unit), fmt: (v) => fmtMoney(v, { lang, unit })
  };
}

/* ---------- Counts (invoices, items, payments) ----------
   Counts are never expressed in the money unit. Cards and tables show the exact figure ("500,000 فاتورة");
   charts may abbreviate ("500 ألف فاتورة") with the exact value in the tooltip. */
export const fmtInt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('en-US') : '—');
export function fmtInvoices(n, { lang = 'ar', short = false } = {}) {
  const v = Math.round(Number(n) || 0);
  if (short && v >= 10000) {
    const k = v / 1000;
    const s = k >= 1000 ? `${trim((k / 1000).toFixed(2))} ${lang === 'ar' ? 'مليون' : 'M'}` : `${trim(k.toFixed(k >= 100 ? 0 : 1))} ${lang === 'ar' ? 'ألف' : 'K'}`;
    return `${s} ${lang === 'ar' ? 'فاتورة' : 'invoices'}`;
  }
  return `${fmtInt(v)} ${lang === 'ar' ? 'فاتورة' : v === 1 ? 'invoice' : 'invoices'}`;
}
