// Pure per-page filter logic of the pages built on the SHARED revenue scope (Collected invoices · Uncollected · Exclusions · Decision Room · Product).
// No React: field definitions of each page's OWN filters (same shape as the shared ones, see filterLogic.js), their defaults, and the mapping from the filter
// values to the data-service request — so what is shown, counted, listed and exported is decided in ONE place and unit-tested (tests/filters-pages.test.mjs).
//
//   shared scope (period · Amanah · municipality · source · due position/status · origin · product · main class) → ScopeFilters (FILTER_PAGES.<page>)
//   page-own fields → `local` of ScopeFilters:    collected: collection · kind        uncollected: reason · processStatus · payStatus · exec · kind        exclusions: reason · payStatus
import { EXCLUSION_REASONS, DISCLOSURE_PRODUCTS } from '../../data/iim';
import { CATEGORY_LABELS } from '../../data/revenueMetrics';
import { CATEGORIES, CATEGORY_ORDER, PRIORITY_LABELS } from '../../data/decisionRoom';
import { FLAGS } from '../../data/decisionStore';
import { DUE_POSITION_KEYS, SCOPE_DEFAULTS, isDefaultValue, defaultOf, defaultValues, periodIsDefault } from './filterLogic';
import { selectionFilters } from '../invoices/listLogic';

const ALL = { ar: 'الكل', en: 'All' };
const bi = (o) => ({ ar: o.ar, en: o.en });

/* ---------- option lists ---------- */
// «الحالات الإجرائية» of an uncollected invoice (they describe where its handling stands, NOT where it stands against the due date): kept apart from the due position
export const PROCESS_STATES = ['objection', 'linkage_unresolved', 'ineligible_referral'];
export const PROCESS_LABELS = Object.fromEntries(PROCESS_STATES.map((k) => [k, bi(CATEGORY_LABELS[k])]));
// the PAYMENT status of an unpaid invoice (engine `payStatus`, from the source's own amounts — independent of any exclusion)
export const PAY_STATUS_KEYS = ['overdue', 'partial', 'not_due'];
export const PAY_STATUS_LABELS = { overdue: { ar: 'متأخرة', en: 'Overdue' }, partial: { ar: 'مدفوعة جزئياً', en: 'Partly paid' }, not_due: { ar: 'غير مستحقة بعد', en: 'Not yet due' } };
// the enforcement dimension (existing `filters.exec` of the data service; confirmed links only)
export const EXEC_KEYS = ['none', 'inexec', 'suspended', 'closed', 'ever'];
export const EXEC_LABELS = {
  none: { ar: 'لم تُحَل إلى التنفيذ', en: 'Never referred' }, inexec: { ar: 'أمر قيد التنفيذ', en: 'An order in execution' }, suspended: { ar: 'أمر معلّق', en: 'A suspended order' },
  closed: { ar: 'كل الأوامر مغلقة', en: 'All orders closed' }, ever: { ar: 'سبقت إحالتها (أي أمر)', en: 'Ever referred (any order)' }
};
export const KIND_LABELS = { occupancy: { ar: 'إشغالات (إفصاح من المكلف)', en: 'Occupancy (declared by the taxpayer)' }, differences: { ar: 'فروقات (ناتجة عن التدقيق)', en: 'Differences (from the audit)' } };
export const COLLECTION_LABELS = { collected: { ar: 'محصّلة بالكامل', en: 'Collected in full' }, partial: { ar: 'محصّلة جزئياً', en: 'Partially collected' } };

// the invoice-type filter exists only for the products that have it (tobacco / accommodation)
export const kindVisible = (product) => (product || []).some((k) => DISCLOSURE_PRODUCTS.includes(k));
const opts = (keys, labels, first) => [{ value: 'all', label: first || ALL }, ...keys.map((k) => ({ value: k, label: labels[k] }))];
const isRule = (r) => !!r && r !== 'all' && r !== 'none';

/* ---------- field definitions (value model of FilterBar: select → string, default 'all') ---------- */
const kindDef = () => ({ key: 'kind', type: 'select', group: 'invoice', label: { ar: 'نوع الفاتورة', en: 'Invoice type' }, options: opts(Object.keys(KIND_LABELS), KIND_LABELS, { ar: 'كل أنواع الفاتورة', en: 'All invoice types' }) });

// Collected invoices: how much of the invoice was collected (the list holds invoices with money collected, in full or in part) + the invoice type where it exists
export function collectedLocal({ product } = {}) {
  const defs = [{ key: 'collection', type: 'select', group: 'invoice', label: { ar: 'حالة التحصيل', en: 'Collection state' }, options: [{ value: 'all', label: { ar: 'كل المحصّلة (كلياً أو جزئياً)', en: 'All collected (in full or in part)' } }, { value: 'collected', label: COLLECTION_LABELS.collected }, { value: 'partial', label: COLLECTION_LABELS.partial }] }];
  if (kindVisible(product)) defs.push(kindDef());
  return { defs, primary: [], secondary: defs.map((d) => d.key) };
}
// Uncollected: the exclusion reason + the process state + the payment status + the enforcement status + the invoice type — ALL inside «المزيد من الفلاتر»
export function uncollectedLocal({ product, reasonCount = () => '' } = {}) {
  const hasRule = (v) => isRule(v.reason);
  const defs = [
    { key: 'reason', type: 'select', group: 'invoice', label: { ar: 'سبب الاستبعاد', en: 'Exclusion reason' }, dependsOn: 'duePosition',
      options: (v) => ((v.duePosition && v.duePosition !== 'all') || (v.processStatus && v.processStatus !== 'all') ? [{ value: 'all', label: { ar: 'الكل (مستبعدة وغير مستبعدة)', en: 'All (excluded and not)' } }, { value: 'none', label: { ar: 'غير مستبعدة', en: 'Not excluded' } }]
        : [{ value: 'all', label: { ar: 'الكل (مستبعدة وغير مستبعدة)', en: 'All (excluded and not)' } }, { value: 'none', label: { ar: 'غير مستبعدة', en: 'Not excluded' } }, ...EXCLUSION_REASONS.map((r) => ({ value: r.ruleId, label: { ar: `${r.ar}${reasonCount(r.ruleId)}`, en: `${r.en}${reasonCount(r.ruleId)}` } }))]),
      clearedNotice: { ar: 'أُزيل سبب الاستبعاد لأن المستبعدة لا تدخل في أي موقف استحقاق', en: 'The exclusion reason was cleared: excluded invoices have no due position' },
      hint: { ar: 'السبب يخص الفواتير المستبعدة؛ اختر «كل المواقف» وبلا حالة إجرائية لاختيار سبب', en: 'A reason applies to excluded invoices: set the due position and processing status to “All” to pick one' } },
    { key: 'processStatus', type: 'select', group: 'invoice', label: { ar: 'الحالة الإجرائية', en: 'Processing status' }, dependsOn: 'duePosition',
      options: (v) => (v.duePosition && v.duePosition !== 'all' ? [{ value: 'all', label: ALL }] : opts(PROCESS_STATES, PROCESS_LABELS, { ar: 'كل الحالات الإجرائية', en: 'All processing states' })),
      disabled: (v) => (v.duePosition && v.duePosition !== 'all') || hasRule(v),
      hint: { ar: 'تتعارض مع موقف الاستحقاق ومع سبب الاستبعاد: اختر «كل المواقف» وبلا سبب أولاً', en: 'It cannot be combined with a due position or an exclusion reason: set those to “All” first' },
      clearedNotice: { ar: 'أُزيلت الحالة الإجرائية لأن موقف الاستحقاق تغيّر', en: 'The processing status was cleared because the due position changed' } },
    { key: 'payStatus', type: 'select', group: 'invoice', label: { ar: 'حالة السداد (مستقلة عن الاستبعاد)', en: 'Payment status (independent of exclusion)' }, options: opts(PAY_STATUS_KEYS, PAY_STATUS_LABELS, { ar: 'كل حالات السداد', en: 'All payment statuses' }) },
    { key: 'exec', type: 'select', group: 'invoice', label: { ar: 'حالة التنفيذ', en: 'Enforcement status' }, options: opts(EXEC_KEYS, EXEC_LABELS, { ar: 'كل حالات التنفيذ', en: 'All enforcement statuses' }) }
  ];
  if (kindVisible(product)) defs.push(kindDef());
  return { defs, primary: [], secondary: defs.map((d) => d.key) };
}
// Exclusions: the reason is the third PRIMARY control (the reason table below is the other way to pick the same state); the payment status is secondary
export function exclusionsLocal({ reasonCount = () => '', reasonDisabled = () => false } = {}) {
  const defs = [
    { key: 'reason', type: 'select', group: 'exclusion', label: { ar: 'سبب الاستبعاد', en: 'Exclusion reason' }, searchable: true,
      options: [{ value: 'all', label: { ar: 'كل الأسباب', en: 'All reasons' } }, ...EXCLUSION_REASONS.map((r) => ({ value: r.ruleId, label: { ar: `${r.ar}${reasonCount(r.ruleId)}`, en: `${r.en}${reasonCount(r.ruleId)}` }, disabled: reasonDisabled(r.ruleId) }))] },
    { key: 'pay', type: 'select', group: 'invoice', label: { ar: 'حالة السداد (مستقلة عن الاستبعاد)', en: 'Payment status (independent of exclusion)' }, options: opts(PAY_STATUS_KEYS, PAY_STATUS_LABELS, { ar: 'كل حالات السداد', en: 'All payment statuses' }) }
  ];
  return { defs, primary: ['reason'], secondary: ['pay'] };
}

export const localDefaults = (local) => defaultValues(local.defs);
export const localIsDefault = (local, values) => local.defs.every((d) => isDefaultValue(d, values[d.key], {}));
export const localActiveCount = (local, values) => local.defs.filter((d) => !isDefaultValue(d, values[d.key], {})).length;

/* ---------- the due position (scope status) and the legacy ?category= links ---------- */
// An old «category» link (Decision Room, analysis) names an engine class: a DUE POSITION goes to the scope status, a PROCESS state to the local field; anything else is not a filter
export function categoryTarget(cat) {
  if (!cat || cat === 'all') return {};
  if (DUE_POSITION_KEYS.includes(cat)) return { status: cat };
  if (PROCESS_STATES.includes(cat)) return { processStatus: cat };
  return {};
}
// a status from another page that this list cannot honour (e.g. «collected» on an uncollected list) → 'all'
export const dueStatusFor = (status) => (!status || status === 'all' || DUE_POSITION_KEYS.includes(status) ? (status || 'all') : 'all');

/* ---------- values → data-service requests ---------- */
// Collected invoices (rev.data.list): the register of invoices with money collected; kind only while the product it belongs to is chosen
export function collectedFilters({ search = '', collection = 'all', kind = 'all', product = [], allPeriods = false, problem = false } = {}) {
  return { search, state: collection === 'all' ? 'paid' : collection, kind: kindVisible(product) ? kind : 'all', allPeriods, tag: problem ? 'problem' : undefined };
}
// Uncollected (rev.data.worklist extras): the scope status travels in the scope; here the page-own fields
export function uncollectedExtras({ reason = 'all', processStatus = 'all', payStatus = 'all', exec = 'all', kind = 'all', product = [] } = {}) {
  return { includeExcluded: true, reason, kind: kindVisible(product) ? kind : 'all', ...(processStatus === 'all' ? {} : { category: processStatus }), ...(payStatus === 'all' ? {} : { payStatus }), ...(exec === 'all' ? {} : { exec }) };
}
// The redesigned lists (src/pages/Invoices.jsx · Collection.jsx): the page's own fields + the chart selections (product · origin · due state) as ONE list-filter object.
export function collectedListFilters({ sel = {}, ...rest } = {}) { return { ...collectedFilters(rest), ...selectionFilters(sel) }; }
// Uncollected = rev.data.list with state «uncollected» (every uncollected, non-cancelled invoice INCLUDING the excluded ones). processStatus → `category` (the class on top of the state);
// reason → `reason` (none · any · a rule id: the effective, primary reason — an invoice counts once); payStatus / exec / kind as before.
// `planLine` = { cls: 'B' | ['B','C'], blocker? } (the planning page's «أين نركز» drill): exactly the invoices of that action line (server/planningActions.js). The line is a STOCK population (every period), so it
// carries `allPeriods: true`; with no planLine the filters are unchanged.
export function uncollectedListFilters({ search = '', reason = 'all', processStatus = 'all', payStatus = 'all', exec = 'all', kind = 'all', product = [], sel = {}, planLine = null } = {}) {
  const f = { search, state: 'uncollected', kind: kindVisible(product) ? kind : 'all', ...selectionFilters(sel) };
  if (planLine) { f.planLine = planLine; f.allPeriods = true; }
  if (processStatus !== 'all') f.category = processStatus;
  if (payStatus !== 'all') f.payStatus = payStatus;
  if (exec !== 'all') f.exec = exec;
  if (reason !== 'all') f.reason = reason;
  return f;
}
// Exclusions (rev.data.list): an invoice appears once, under its effective reason
export function exclusionsFilters({ search = '', reason = 'all', pay = 'all' } = {}) {
  return { search, state: 'all', primary: reason === 'all' ? 'any' : reason, payStatus: pay, kind: 'all' };
}

/* ---------- Decision Room: the page-own filters (period · Amanah · source come from the shared scope; items are already built for that scope) ---------- */
// category is PRIMARY; priority and the follow-up flag live in «المزيد من الفلاتر». Their values are kept in the URL (?category=&priority=&flag=) by the page.
export const DECISION_PAGE_KEYS = ['category', 'priority', 'flag'];
export const DECISION_PAGE_DEFAULTS = { category: 'all', priority: 'all', flag: 'all' };
export function decisionsLocal() {
  const defs = [
    { key: 'category', type: 'select', group: 'decision', label: { ar: 'الفئة', en: 'Category' }, options: opts(CATEGORY_ORDER, CATEGORIES, { ar: 'كل الفئات', en: 'All categories' }) },
    { key: 'priority', type: 'select', group: 'decision', label: { ar: 'الأولوية', en: 'Priority' }, options: opts(['high', 'medium', 'low'], PRIORITY_LABELS, { ar: 'كل المستويات', en: 'All levels' }) },
    { key: 'flag', type: 'select', group: 'decision', label: { ar: 'علامة المتابعة', en: 'Follow-up flag' }, options: opts(['flagged', 'followed_up', 'none'], FLAGS, { ar: 'الكل', en: 'All' }) }
  ];
  return { defs, primary: ['category'], secondary: ['priority', 'flag'] };
}

/* ---------- is anything narrowing this page? (drives «مسح الفلاتر» and the no-results reset) ---------- */
export function narrowing({ scopeActive = false, local, values, search = '', extra = 0 } = {}) {
  return scopeActive || (local ? !localIsDefault(local, values) : false) || !!String(search || '').trim() || extra > 0;
}
// the shared scope equals its defaults (year to date, everything «all»)? — the same test ScopeFilters uses for «مسح الفلاتر»
export function scopeIsDefault(scope, today) {
  const s = scope || {};
  return periodIsDefault({ preset: s.preset, from: s.from, to: s.to }, today) && (s.amanah ?? 'all') === 'all' && (s.muni ?? 'all') === (SCOPE_DEFAULTS.muni) && (s.source ?? 'all') === 'all' && (s.status ?? 'all') === 'all'
    && (s.scopeType ?? 'all') === 'all' && (s.product || []).length === 0 && (s.mainClass ?? 'all') === 'all';
}
export { defaultOf };
