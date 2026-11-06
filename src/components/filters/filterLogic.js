// Pure logic of the platform filter toolbar (no React): defaults, "is this a default?", chips, dependent clearing, options limited by permissions,
// period labels, date-basis labels and URL round-trip. Tested by tests/filters.test.mjs.
//
// Filter VALUE model used by FilterBar / MoreFilters / LocalFilterToolbar:
//   field def  = { key, type: 'select' | 'multi' | 'period' | 'text', label: {ar,en}|string, options?: [{value,label,disabled?}] | (values)=>[...],
//                  default?: any ('all' for select, [] for multi), isDefault?: (value)=>bool, dependsOn?: parentKey, clearedNotice?: {ar,en},
//                  group?: 'location'|'classification'|'invoice'|'compare'|string, disabled?: (values)=>bool, hint?: {ar,en}|string }
//   values     = { [key]: value }      (period value = { preset, from, to })
import { amanahFilterOptions, REVENUE_SOURCES, REVENUE_SOURCE_KEYS } from '../../data/revenueLedger';
import { municipalityFilterOptions, muniLabel } from '../../data/municipalityModel';
import { PRODUCTS, MAIN_EN } from '../../data/iim';
import { detectPreset, periodChoiceLabel } from '../../data/periodPresets';
import { checkRange, rangeMessage } from '../../data/dateRange';
import { fmtRangeText } from '../../data/clock';
import { amanahAllowed, authorizedMunicipalityOptions, sanitizeScopeValues } from '../../data/reportAccess';

/* ---------- shared-scope defaults (RevenueContext resetScope) ---------- */
export const DEFAULT_PERIOD_PRESET = 'ytd';
export const SCOPE_DEFAULTS = { amanah: 'all', source: 'all', muni: 'all', status: 'all', scopeType: 'all', product: [], mainClass: 'all' };
// filter key → the field of the shared revenue scope it drives
export const SCOPE_FIELD = { amanah: 'amanah', municipality: 'muni', source: 'source', status: 'status', duePosition: 'status', invoiceOrigin: 'scopeType', product: 'product', mainClass: 'mainClass' };

export const STATUS_LABELS = {
  collected: { ar: 'محصّلة بالكامل', en: 'Collected in full' },
  open: { ar: 'قائمة (غير مسددة)', en: 'Still owing (open)' },
  overdue: { ar: 'متأخرة', en: 'Overdue' },
  partial: { ar: 'محصّلة جزئياً', en: 'Partially collected' },
  not_due: { ar: 'لم يحن استحقاقها', en: 'Not yet due' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled' },
  excluded: { ar: 'مستبعدة', en: 'Excluded' }
};
export const STATUS_KEYS = ['collected', 'open', 'overdue', 'partial', 'not_due', 'cancelled', 'excluded'];
export const DUE_POSITION_KEYS = ['open', 'overdue', 'not_due', 'partial']; // the statuses that describe WHERE an unpaid invoice stands against its due date
export const ORIGIN_LABELS = { central: { ar: 'مركزي', en: 'Central' }, internal: { ar: 'داخلي', en: 'Internal' } };

export const FIELD_LABELS = {
  period: { ar: 'الفترة', en: 'Period' },
  amanah: { ar: 'الأمانة / الجهة', en: 'Amanah / entity' },
  municipality: { ar: 'البلدية', en: 'Municipality' },
  source: { ar: 'مصدر الإيراد', en: 'Revenue source' },
  status: { ar: 'حالة الفاتورة', en: 'Invoice status' },
  duePosition: { ar: 'موقف الاستحقاق', en: 'Due position' },
  invoiceOrigin: { ar: 'مصدر الفاتورة', en: 'Invoice origin' },
  product: { ar: 'المنتج (المنصة)', en: 'Product (platform)' },
  mainClass: { ar: 'تصنيف الإيراد الرئيسي', en: 'Main revenue class' },
  comparison: { ar: 'المقارنة', en: 'Comparison' }
};
export const GROUP_LABELS = {
  location: { ar: 'الموقع', en: 'Location' },
  classification: { ar: 'تصنيف الإيراد', en: 'Revenue classification' },
  invoice: { ar: 'الفاتورة', en: 'Invoice' },
  compare: { ar: 'المقارنة', en: 'Comparison' },
  other: { ar: 'خيارات أخرى', en: 'Other options' }
};
export const GROUP_OF = { municipality: 'location', amanah: 'location', source: 'classification', product: 'classification', mainClass: 'classification', status: 'invoice', duePosition: 'invoice', invoiceOrigin: 'invoice', comparison: 'compare' };

export const pick = (x, lang) => (x == null ? '' : typeof x === 'string' ? x : (lang === 'ar' ? x.ar : x.en) ?? x.en ?? '');

/* ---------- date basis (what a period selects on) ---------- */
export const DATE_BASIS = {
  issue: { ar: 'تاريخ الإصدار', en: 'Issue date' },
  payment: { ar: 'تاريخ الدفع', en: 'Payment date' },
  contract: { ar: 'تاريخ العقد', en: 'Contract date' },
  order: { ar: 'تاريخ الأمر', en: 'Order date' }
};
export const dateBasisLabel = (basis, lang = 'ar') => (DATE_BASIS[basis] ? pick(DATE_BASIS[basis], lang) : '');
export const dateBasisLine = (basis, lang = 'ar') => (DATE_BASIS[basis] ? `${lang === 'ar' ? 'أساس التاريخ' : 'Date basis'}: ${pick(DATE_BASIS[basis], lang)}` : '');

/* ---------- period ---------- */
export const isEqualJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// the period is the default when its range is the year-to-date range (a stored «custom» that equals it still counts)
export const periodIsDefault = (p, today) => !!p && detectPreset(p.from, p.to, today) === DEFAULT_PERIOD_PRESET;
// «السنة حتى اليوم · 1 يناير – 5 نوفمبر 2026»
export function periodText(p, lang = 'ar') {
  if (!p) return '';
  const key = p.preset && p.preset !== 'custom' ? p.preset : 'custom';
  return `${periodChoiceLabel(key, lang)} · ${fmtRangeText(p.from, p.to, lang)}`;
}
// custom range: the same validation as every period control (from ≤ to, inside the data) with the message when it fails or is adjusted
export function validateCustomRange(from, to, { today, start, lang = 'ar' } = {}) {
  const r = checkRange({ from, to }, { today, ...(start ? { start } : {}) });
  if (!r.ok) return { ok: false, code: r.code, message: rangeMessage(r.code, lang, { today, start }) };
  return { ok: true, from: r.from, to: r.to, adjusted: r.adjusted, message: r.adjusted.length ? rangeMessage(r.adjusted[0], lang, { today, start }) : '' };
}

/* ---------- options ---------- */
// Amanah options are limited to the signed-in account's own geographic access (`access` = a GeoScope, `access.effectiveScope(module)`: only Amanahs holding a grant, the Housing Sector only
// when non-municipal entities are granted; null = no restriction). The filters can only NARROW the list, never widen it.
export function permittedAmanahOptions(access = null, all = amanahFilterOptions()) {
  return all.filter((a) => !access || amanahAllowed(access, a.key));
}
export const amanahLabel = (key, lang) => { const a = amanahFilterOptions().find((x) => x.key === key); return a ? (lang === 'ar' ? a.ar : a.en) : String(key); };
// a municipality belongs to ONE Amanah: with «all» (or several) Amanahs selected there is nothing to choose from. Options = the explicit groups (issued directly by the Amanah · municipality not specified in source · needs review)
// followed by the REFERENCE municipalities mapped under that Amanah (src/data/amanahHierarchy.js); values are stable keys, never names.
// With `access` (a GeoScope) the list is the Amanah's options ∩ the user's grant for it: selected municipalities only, and the explicit groups (direct / not specified / needs review) only when the grant includes them.
export function municipalityOptions(amanah, access = null) {
  return (access ? authorizedMunicipalityOptions(access, amanah) : municipalityFilterOptions(amanah)).map((o) => ({ value: o.value, label: o.label }));
}
/** filter-form values { amanah, municipality } → the same with every value outside the access dropped (back to «all»), and the fields dropped: a URL / stored value can never widen the access */
export function sanitizeFormValues(values, access) {
  const r = sanitizeScopeValues({ amanah: values.amanah === '__multi' ? 'all' : values.amanah, muni: values.municipality }, access);
  return { values: { ...values, ...(values.amanah === '__multi' ? {} : { amanah: r.amanah }), municipality: r.muni }, dropped: r.dropped };
}
export const municipalityLabel = (key, lang) => muniLabel(key, lang);
export const sourceOptions = () => REVENUE_SOURCE_KEYS.map((k) => ({ value: k, label: { ar: REVENUE_SOURCES[k].ar, en: REVENUE_SOURCES[k].en } }));
export const sourceLabel = (k, lang) => (REVENUE_SOURCES[k] ? (lang === 'ar' ? REVENUE_SOURCES[k].ar : REVENUE_SOURCES[k].en) : String(k));
export const productLabel = (k, lang) => (PRODUCTS[k] ? (lang === 'ar' ? PRODUCTS[k].ar : PRODUCTS[k].en) : String(k));
export const mainClassLabel = (k, lang) => (lang === 'ar' ? k : (MAIN_EN[k] || k));

/* ---------- defaults, active detection ---------- */
export function defaultOf(def) {
  if ('default' in def) return def.default;
  return def.type === 'multi' ? [] : def.type === 'text' ? '' : 'all';
}
export function isDefaultValue(def, value, ctx = {}) {
  if (typeof def.isDefault === 'function') return !!def.isDefault(value, ctx);
  const d = defaultOf(def);
  if (Array.isArray(d)) return (Array.isArray(value) ? value : []).length === d.length && isEqualJson([].concat(value || []).sort(), [...d].sort());
  return (value == null ? d : value) === d;
}
export const defaultValues = (defs) => Object.fromEntries(defs.map((d) => [d.key, defaultOf(d)]));
export const activeKeys = (defs, values, ctx) => defs.filter((d) => !isDefaultValue(d, values[d.key], ctx)).map((d) => d.key);

/* ---------- dependent selections ---------- */
// Apply `patch` to `values`; every field that depends on a changed parent (and is not itself in the patch) goes back to its default when its
// value no longer belongs to the parent. Returns the new values and the fields that were cleared (to be announced).
export function cascadePatch(defs, values, patch) {
  const next = { ...values, ...patch }; const cleared = [];
  for (const parent of Object.keys(patch)) {
    if (isEqualJson(values[parent], patch[parent])) continue;
    for (const child of defs.filter((d) => d.dependsOn === parent)) {
      if (child.key in patch) continue;
      const opts = typeof child.options === 'function' ? child.options(next) : child.options;
      const stillValid = Array.isArray(opts) && (Array.isArray(next[child.key]) ? next[child.key].every((v) => opts.some((o) => o.value === v)) : opts.some((o) => o.value === next[child.key]));
      if (!isDefaultValue(child, values[child.key]) && !stillValid) { next[child.key] = defaultOf(child); cleared.push(child.key); }
    }
  }
  return { values: next, cleared };
}
export const clearedNoticeText = (defs, cleared, lang) => cleared.map((k) => { const d = defs.find((x) => x.key === k); return d && d.clearedNotice ? pick(d.clearedNotice, lang) : ''; }).filter(Boolean).join(lang === 'ar' ? '، ' : '; ');

/* ---------- chips ---------- */
// One chip per MEANINGFUL non-default selection: never an «All …» chip, never the period (it lives in the period control). `valueText(def, value)` gives the readable value.
export function deriveChips(defs, values, { lang = 'ar', exclude = [], ctx = {}, valueText } = {}) {
  const out = [];
  for (const d of defs) {
    if (d.type === 'period' || exclude.includes(d.key)) continue;
    const v = values[d.key];
    if (isDefaultValue(d, v, ctx)) continue;
    const text = valueText ? valueText(d, v, lang) : defaultValueText(d, v, lang);
    if (!text) continue;
    out.push({ key: d.key, label: pick(d.label, lang), value: text });
  }
  return out;
}
export function defaultValueText(def, value, lang) {
  if (typeof def.valueText === 'function') return def.valueText(value, lang); // a field may state how its value reads in a chip (e.g. a date in words)
  const opts = typeof def.options === 'function' ? def.options({}) : (def.options || []);
  const one = (v) => { const o = opts.find((x) => x.value === v); return o ? pick(o.label, lang) : String(v); };
  if (Array.isArray(value)) return value.map(one).join(lang === 'ar' ? '، ' : ', ');
  return def.type === 'text' ? String(value) : one(value);
}

/* ---------- URL state ---------- */
// keys → search params (defaults are removed, other params are preserved); arrays are comma separated.
export function parseUrlFilters(search, keys, defaults = {}) {
  const sp = new URLSearchParams(search || ''); const out = { ...defaults };
  for (const k of keys) {
    if (!sp.has(k)) continue;
    const raw = sp.get(k);
    out[k] = Array.isArray(defaults[k]) ? (raw ? raw.split(',').filter(Boolean) : []) : raw;
  }
  return out;
}
export function serializeUrlFilters(search, values, keys, defaults = {}) {
  const sp = new URLSearchParams(search || '');
  for (const k of keys) {
    const v = values[k]; const d = defaults[k];
    const isDef = v == null || v === '' || (Array.isArray(v) ? (v.length === 0 && (!Array.isArray(d) || d.length === 0)) || isEqualJson([...v].sort(), Array.isArray(d) ? [...d].sort() : null) : v === d);
    if (isDef) sp.delete(k); else sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
