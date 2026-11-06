// The municipality is a PRIMARY control right after the Amanah it depends on (disabled, with «اختر أمانة أولاً» inside the control, until one Amanah is chosen).
// Per-page filter configuration of the platform + the builder of the field definitions bound to the SHARED revenue scope (RevenueContext).
// Page agents only pick a configuration:   <ScopeFilters {...FILTER_PAGES.collected} />   (plus their own search / actions / resultCount).
//
// Keys usable in primary / secondary (ScopeFilters):
//   period | amanah | municipality | source | status | invoiceOrigin | product | mainClass | duePosition | comparison | extra
//   * duePosition drives the SAME scope field as status (restricted to open / overdue / not due / partial): a page uses one of the two, never both.
//   * comparison needs the `comparison={{ value, onChange, options? }}` prop (it is not part of the shared scope).
//   * extra renders the page's own node(s) passed as `extra` (e.g. an exclusion-reason select).
//   * product + mainClass (+ status / invoiceOrigin when listed) are secondary by design: they live in the advanced groups
//     «تصنيف الإيراد / Revenue classification» and «الفاتورة / Invoice».
// `local: true` pages (contracts / enforcement) do NOT use the shared scope: they build `fields` for LocalFilterToolbar; the keys below
// are the agreed purpose-driven filters of that page (see docs/filters-redesign.md «Page configuration»).
import { presetRange } from '../../data/periodPresets';
import { MAIN_LIST, OTHER_CLASS, UNCLASSIFIED, PRODUCTS } from '../../data/iim';
import {
  FIELD_LABELS, GROUP_OF, STATUS_KEYS, STATUS_LABELS, DUE_POSITION_KEYS, ORIGIN_LABELS,
  periodIsDefault, permittedAmanahOptions, municipalityOptions, sourceOptions, mainClassLabel
} from './filterLogic';

export const FILTER_PAGES = {
  // fallback used by ScopeBar on any page that has not been migrated to an explicit configuration
  default: { primary: ['period', 'amanah', 'municipality', 'source'], secondary: ['status', 'invoiceOrigin', 'product', 'mainClass'], dateBasis: 'issue' },
  // Dashboard /insights — KPIs, charts and the export follow these. No comparison control: the dashboard always compares with the same period last year when it is inside the data.
  dashboard: { primary: ['period', 'amanah', 'municipality', 'source'], secondary: [], dateBasis: 'issue' },
  // Decision Room /decisions — period · Amanah from the shared scope + the page's own category (`extra` slot); More: revenue source (shared), priority, follow-up flag (page-own, see decisionsLocal)
  decisions: { primary: ['period', 'amanah', 'municipality', 'extra'], secondary: ['source'], dateBasis: 'issue' },
  // Collected invoices /invoices
  collected: { primary: ['period', 'amanah', 'municipality', 'source'], secondary: ['invoiceOrigin', 'product', 'mainClass'], dateBasis: 'issue' },
  // Uncollected /collection — the due position IS the invoice status of this list; payment-status wording is covered by it
  uncollected: { primary: ['amanah', 'municipality', 'source', 'duePosition'], secondary: ['period', 'invoiceOrigin', 'product', 'mainClass'], dateBasis: 'issue' },
  // Exclusions /exclusions — the reason select is the page's own (`extra`)
  exclusions: { primary: ['period', 'amanah', 'municipality', 'extra'], secondary: ['source', 'product'], dateBasis: 'issue' },
  // Product page /products/:key — the product is the page itself, so no product / classification control
  product: { primary: ['period', 'amanah', 'municipality'], secondary: ['invoiceOrigin'], dateBasis: 'issue' },
  // ---- pages with their OWN (non-shared) filters: build `fields` for LocalFilterToolbar ----
  // fields: see localPages.js (contractFields / enforcementFields). The contract data has no municipality below the Amanah and no verified installment / payment field, so neither is offered.
  contracts: { local: true, primary: ['amanah', 'rental', 'status'], secondary: ['type', 'from', 'to'], dateBasis: 'contract' },
  // enforcement: the source switch and the related-view tabs are navigation; the review control replaces the old «needs action» toggle + «matching review» select
  enforcement: { local: true, primary: ['am', 'st', 'review'], secondary: ['dtype', 'why', 'doc', 'fin', 'from', 'to', 'ex', 'mu', 'rp', 'fl', 'min', 'max'], dateBasis: 'order' }
  // the plan page («خطط الإيرادات») has no page-filter entry: its only filter is the VIEW SCOPE (Amanah → municipality) in the URL, src/components/plans/PlanViewScope.jsx
};

const ALL = { ar: 'الكل', en: 'All' };
const field = (key, type, extra) => ({ key, type, label: FIELD_LABELS[key], group: GROUP_OF[key], ...extra });

// The field definitions for the requested keys. ctx = { access, today, hideStatuses, comparison, dateBasis }.
export function buildScopeDefs(keys, ctx = {}) {
  const { today, hideStatuses = [], comparison = null, dateBasis = 'issue', access = null } = ctx; // access = the user's GeoScope for the pickers (options come ONLY from it)
  const seen = new Set(); const defs = [];
  for (const key of keys) {
    if (seen.has(key)) continue; seen.add(key);
    if (key === 'status' && keys.includes('duePosition')) continue; // one control per scope field
    if (key === 'period') defs.push({ key, type: 'period', group: 'period', label: FIELD_LABELS.period, default: { preset: 'ytd' }, isDefault: (v) => periodIsDefault(v, today), dateBasis });
    else if (key === 'amanah') {
      const restricted = !!access && !access.all;
      const base = [{ value: 'all', label: { ar: restricted ? 'كل ما تتيحه صلاحيتك' : 'جميع الأمانات والجهات', en: restricted ? 'Everything you may access' : 'All Amanahs and entities' } }, ...permittedAmanahOptions(access).map((a) => ({ value: a.key, label: { ar: a.ar, en: a.en } }))];
      defs.push(field(key, 'select', { options: (vals) => (vals.amanah === '__multi' ? [...base, { value: '__multi', label: { ar: 'عدة أمانات', en: 'Several Amanahs' } }] : base) }));
    } else if (key === 'municipality') {
      const none = (vals) => municipalityOptions(vals.amanah, access).length === 0;
      // disabled: the placeholder is the control's own (only) option, so it reads inside the control; a sector that is not an Amanah says so
      const placeholder = (vals) => (vals.amanah === 'Housing Sector' ? { ar: 'لا بلديات لهذه الجهة', en: 'No municipalities for this entity' } : { ar: 'اختر أمانة أولاً', en: 'Select an Amanah first' });
      defs.push(field(key, 'select', {
        dependsOn: 'amanah', searchable: true, className: 'ft-field--muni', // searchable: an Amanah has up to 47 reference municipalities
        options: (vals) => (none(vals) ? [{ value: 'all', label: placeholder(vals) }] : [{ value: 'all', label: access && !access.all ? { ar: 'كل البلديات ضمن صلاحيتك', en: 'All municipalities within your access' } : { ar: 'كل البلديات', en: 'All municipalities' } }, ...municipalityOptions(vals.amanah, access)]),
        disabled: none,
        placeholder: { ar: 'اختر أمانة أولاً', en: 'Select an Amanah first' },
        clearedNotice: { ar: 'أُزيلت البلدية لأن الأمانة تغيّرت', en: 'The municipality was cleared because the Amanah changed' }
      }));
    } else if (key === 'source') defs.push(field(key, 'select', { options: [{ value: 'all', label: { ar: 'جميع مصادر الإيراد', en: 'All revenue sources' } }, ...sourceOptions()] }));
    else if (key === 'status') defs.push(field(key, 'select', { options: [{ value: 'all', label: { ar: 'كل الحالات', en: 'All statuses' } }, ...STATUS_KEYS.filter((k) => !hideStatuses.includes(k)).map((k) => ({ value: k, label: STATUS_LABELS[k] }))] }));
    else if (key === 'duePosition') defs.push(field(key, 'select', { scopeKey: 'status', options: [{ value: 'all', label: { ar: 'كل المواقف', en: 'All positions' } }, ...DUE_POSITION_KEYS.filter((k) => !hideStatuses.includes(k)).map((k) => ({ value: k, label: STATUS_LABELS[k] }))] }));
    else if (key === 'invoiceOrigin') defs.push(field(key, 'select', { options: [{ value: 'all', label: ALL }, { value: 'central', label: ORIGIN_LABELS.central }, { value: 'internal', label: ORIGIN_LABELS.internal }] }));
    else if (key === 'product') defs.push(field(key, 'multi', { options: Object.keys(PRODUCTS).map((k) => ({ value: k, label: { ar: PRODUCTS[k].ar, en: PRODUCTS[k].en } })) }));
    else if (key === 'mainClass') defs.push(field(key, 'select', { options: [{ value: 'all', label: { ar: 'كل التصنيفات', en: 'All classes' } }, ...MAIN_LIST.filter((m) => m !== OTHER_CLASS && m !== UNCLASSIFIED).map((m) => ({ value: m, label: { ar: mainClassLabel(m, 'ar'), en: mainClassLabel(m, 'en') } })), { value: UNCLASSIFIED, label: { ar: mainClassLabel(UNCLASSIFIED, 'ar'), en: mainClassLabel(UNCLASSIFIED, 'en') } }] }));
    else if (key === 'comparison' && comparison) defs.push(field(key, 'select', { options: comparison.options || [{ value: 'none', label: { ar: 'بدون', en: 'None' } }, { value: 'prev_year', label: { ar: 'نفس الفترة من العام السابق', en: 'Same period last year' } }, { value: 'prev_month', label: { ar: 'الشهر الماضي (المدة المنقضية نفسها)', en: 'Last month (same elapsed days)' } }], default: comparison.default ?? 'none' }));
  }
  return defs;
}

// shared scope → filter values
export function scopeToValues(scope) {
  const s = scope || {};
  return {
    period: { preset: s.preset, from: s.from, to: s.to },
    amanah: Array.isArray(s.amanah) ? '__multi' : (s.amanah ?? 'all'), municipality: s.muni ?? 'all', source: s.source ?? 'all',
    status: s.status ?? 'all', duePosition: s.status ?? 'all', invoiceOrigin: s.scopeType ?? 'all', product: s.product || [], mainClass: s.mainClass || 'all'
  };
}
// a filter patch → calls on the shared scope setters (amanah first: it clears the municipality, which a patch may then set again)
export function applyScopePatch(patch, setters) {
  const order = ['period', 'amanah', 'municipality', 'source', 'status', 'duePosition', 'invoiceOrigin', 'product', 'mainClass'];
  for (const k of order) {
    if (!(k in patch)) continue; const v = patch[k];
    if (k === 'period') { if (v.preset && v.preset !== 'custom' && presetRange(v.preset, setters.today)) setters.setPreset(v.preset); else setters.setCustomRange(v.from, v.to); }
    else if (k === 'amanah') { if (v !== '__multi') setters.setAmanah(v); } // '__multi' = the report-only «several Amanahs» value: unchanged
    else if (k === 'municipality') setters.setMuni(v);
    else if (k === 'source') setters.setSource(v);
    else if (k === 'status' || k === 'duePosition') setters.setStatus(v);
    else if (k === 'invoiceOrigin') setters.setScopeType(v);
    else if (k === 'product') setters.setProduct(v);
    else if (k === 'mainClass') setters.setMainClass(v);
  }
}
