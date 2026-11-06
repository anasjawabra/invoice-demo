// Pure logic of the pages that have their OWN filters (not the shared revenue scope): enforcement lists, investment contracts.
// No React: field definitions for LocalFilterToolbar, the URL keys / defaults, the mapping from filter values to the page's existing filters, and the row predicates.
// Tested by tests/filters-pages2.test.mjs. (Option arrays that depend on data — entities, source statuses … — are passed in; labels are {ar,en} or plain strings.)
import { fmtDateText } from '../../data/clock';
import { isDefaultValue, defaultOf, activeKeys, cascadePatch, pick } from './filterLogic';

const A = (ar, en) => ({ ar, en });
const ALL = A('الكل', 'All');
export const allOption = (label = ALL) => ({ value: 'all', label });
const opts = (list) => list.map(([value, ar, en]) => ({ value, label: A(ar, en) }));
const dateChip = (v, lang) => fmtDateText(v, lang);
const numChip = (v) => String(v);

/* ======================================================================================== Enforcement (إدارة أوامر التنفيذ) */
// The source switch (الكل / سند / إيفاء) and the related-view tabs are PAGE NAVIGATION, not filters. Each list has: Amanah/entity · source status (as written) · ONE review control
// (the old «Needs action» toggle and the «Matching review» select were the same dimension) in the toolbar; everything else is under «المزيد من الفلاتر».
export const REVIEW_OPEN = 'open'; // «Needs action» — every request / violation whose review is not complete
export const SANAD_REVIEW = opts([['all', 'الكل', 'All'], ['open', 'تحتاج إجراء', 'Needs action'], ['needs_review', 'تحتاج مراجعة', 'Needs review'], ['not_identified', 'أرقام غير محددة', 'Numbers not identified'], ['complete', 'مكتملة', 'Complete']]);
export const SOURCE_REVIEW = opts([['all', 'الكل', 'All'], ['open', 'تحتاج إجراء', 'Needs action'], ['complete', 'لا تحتاج إجراء', 'No action needed']]);
export const REASONS = opts([['all', 'أي سبب', 'Any'], ['no_references', 'أرقام غير محددة', 'Numbers not identified'], ['unresolved_references', 'مراجع مفتوحة', 'Open references'], ['corrupted_reference', 'رقم غير موثوق', 'Unreliable number'], ['proposals_pending', 'اقتراحات للتأكيد', 'Proposals to confirm'], ['conflicts', 'تعارضات', 'Conflicts'], ['unread_pages', 'مستند لم يُقرأ', 'Unread document'], ['amount_difference', 'فرق مالي', 'Financial gap']]);
export const DOC_STATES = opts([['all', 'الكل', 'All'], ['complete', 'مقروء', 'Read'], ['incomplete', 'لم يُقرأ', 'Not read'], ['no_document', 'لا مستند', 'No document']]);
export const FIN_STATES = opts([['all', 'الكل', 'All'], ['reconciled', 'متطابقة', 'Reconciled'], ['difference', 'فرق', 'Gap'], ['no_confirmed', 'لا فاتورة مربوطة', 'No linked invoice']]);
export const FLAG_OPTIONS = opts([['all', 'الكل', 'All'], ['conflicts', 'التقارير تختلف', 'Reports disagree'], ['damaged', 'معرّف تالف أو مفتاح بديل', 'Damaged / alternate key']]);
export const REFERRED_FILTER = opts([['all', 'سبقت إحالتها', 'Ever referred'], ['inexec', 'أمر غير مغلق', 'An order that is not closed'], ['closed', 'كل الأوامر مغلقة', 'All orders closed']]);
export const SORTS = {
  sanad: [['recent', 'الأحدث رفعاً', 'Latest referral'], ['amount', 'الأعلى مبلغاً', 'Highest amount'], ['request', 'رقم الطلب', 'Request number']],
  all: [['default', 'المصدر ثم المعرّف', 'Source, then identifier'], ['amount', 'الأعلى مبلغاً', 'Highest amount']],
  eefaa: [['default', 'ترتيب الاستيراد', 'Imported order'], ['amount', 'الأعلى مبلغاً', 'Highest amount']]
};
export const sortOptions = (view) => (SORTS[view] || SORTS.all).map(([value, ar, en]) => ({ value, label: A(ar, en) }));

// URL keys of every list (the same names across lists so a shared link reads the same): q · am (entity) · st (source status) · review · sort · + the list's own More fields
export const ENF_KEYS = {
  all: ['q', 'am', 'st', 'review', 'sort'],
  sanad: ['q', 'am', 'st', 'review', 'sort', 'dtype', 'why', 'doc', 'fin', 'from', 'to'],
  eefaa: ['q', 'am', 'st', 'review', 'sort', 'ex', 'mu', 'rp', 'fl', 'min', 'max'],
  invoices: ['q', 'enf']
};
export const ENF_DEFAULTS = { q: '', am: 'all', st: 'all', review: 'all', sort: undefined, dtype: 'all', why: 'all', doc: 'all', fin: 'all', from: '', to: '', ex: 'all', mu: 'all', rp: 'all', fl: 'all', min: '', max: '', enf: 'all' };
export const enfDefaults = (view) => Object.fromEntries(ENF_KEYS[view].map((k) => [k, k === 'sort' ? SORTS[view]?.[0]?.[0] : ENF_DEFAULTS[k]]));

// field definitions of a list. o = { entities:[{value,label}], statuses:[{value,label}], debtorTypes:[…], executionBases:[…], mumtathil:[…], reports:[…] }
export function enforcementFields(view, o = {}) {
  const sel = (key, label, options, extra) => ({ key, type: 'select', label, options: [allOption(), ...options], ...extra });
  const entity = sel('am', A('الأمانة / الجهة', 'Amanah / entity'), o.entities || [], { primary: true });
  const status = sel('st', view === 'sanad' ? A('حالة الطلب في سند', 'Sanad request status') : A('حالة المصدر', 'Source status'), o.statuses || [], { primary: true });
  if (view === 'sanad') {
    return [
      entity, status,
      { key: 'review', type: 'select', primary: true, label: A('مراجعة المطابقة', 'Matching review'), options: SANAD_REVIEW },
      sel('dtype', A('نوع المنفذ ضده', 'Debtor type'), o.debtorTypes || []),
      { key: 'why', type: 'select', label: A('سبب المراجعة', 'Review reason'), options: REASONS },
      { key: 'doc', type: 'select', label: A('المستند', 'Document'), options: DOC_STATES },
      { key: 'fin', type: 'select', label: A('التسوية', 'Reconciliation'), options: FIN_STATES },
      { key: 'from', type: 'text', inputType: 'date', default: '', label: A('تاريخ الإحالة (رفع الطلب): من', 'Referral date: from'), max: (v) => v.to || undefined, valueText: dateChip },
      { key: 'to', type: 'text', inputType: 'date', default: '', label: A('تاريخ الإحالة (رفع الطلب): إلى', 'Referral date: to'), min: (v) => v.from || undefined, valueText: dateChip }
    ];
  }
  const review = { key: 'review', type: 'select', primary: true, label: A('المراجعة', 'Review'), options: SOURCE_REVIEW };
  if (view === 'eefaa') {
    return [
      entity, status, review,
      sel('ex', A('أساس التنفيذ', 'Execution basis'), o.executionBases || []),
      sel('mu', A('الربط بممتثل', 'Mumtathil link'), o.mumtathil || []),
      sel('rp', A('التقرير المصدري', 'Source report'), o.reports || []),
      { key: 'fl', type: 'select', label: A('حالات خاصة', 'Special cases'), options: FLAG_OPTIONS },
      { key: 'min', type: 'text', inputType: 'number', default: '', label: A('قيمة المخالفة: من (ريال)', 'Violation amount: from (SAR)'), valueText: (v, l) => `${l === 'ar' ? 'من' : 'from'} ${numChip(v)}` },
      { key: 'max', type: 'text', inputType: 'number', default: '', label: A('قيمة المخالفة: إلى (ريال)', 'Violation amount: to (SAR)'), valueText: (v, l) => `${l === 'ar' ? 'إلى' : 'to'} ${numChip(v)}` }
    ];
  }
  return [entity, status, review];
}
export function referredFields() { return [{ key: 'enf', type: 'select', primary: true, label: A('الإنفاذ', 'Enforcement'), options: REFERRED_FILTER, default: 'all' }]; }

// «Needs action» from the KPI cards (?review=open) and an unknown stored value both fall back safely
export const sanitizeSelect = (value, options, fallback = 'all') => (options.some((o) => o.value === value) ? value : fallback);

// URL values that no option offers any more (an old link, a status that is not in the data) go back to the field's default instead of leaving a blank select
export function sanitizeValues(fields, values) {
  const out = { ...values };
  for (const f of fields) {
    if (f.type !== 'select') continue;
    const options = typeof f.options === 'function' ? f.options(out) : f.options;
    if (Array.isArray(options) && options.length > 1 && !options.some((o) => String(o.value) === String(out[f.key]))) out[f.key] = defaultOf(f);
  }
  return out;
}

/* ---------- row predicates (the lists' existing logic, now testable) ---------- */
const dayOf = (c) => String(c.source?.raiseAt || c.openedDate || '').slice(0, 10);
// row = { c, comp, ex, review, blob }
export function sanadMatches(row, v, norm) {
  const t = norm ? norm(v.q) : String(v.q || '').trim().toLowerCase();
  if (v.am !== 'all' && row.c.amanahEn !== v.am) return false;
  if (v.review !== 'all' && (v.review === REVIEW_OPEN ? row.review === 'complete' : row.review !== v.review)) return false;
  if (v.st !== 'all' && String(row.c.source?.statusId) !== v.st) return false;
  if (v.dtype !== 'all' && String(row.c.source?.debtorTypeId) !== v.dtype) return false;
  if (v.doc !== 'all' && row.comp.extraction.state !== v.doc) return false;
  if (v.fin !== 'all' && (v.fin === 'difference' ? !['short', 'over'].includes(row.comp.finance.state) : row.comp.finance.state !== v.fin)) return false;
  if (v.why !== 'all' && !row.ex.includes(v.why)) return false;
  if (t && !row.blob.includes(t)) return false;
  if (v.from || v.to) { const d = dayOf(row.c); if (!d || (v.from && d < v.from) || (v.to && d > v.to)) return false; }
  return true;
}
// row = { entity, statuses:[text], need, blob }  (the «all» list: Sanad requests and Eefaa violations side by side)
export function allMatches(row, v) {
  const t = String(v.q || '').trim().toLowerCase();
  if (v.am !== 'all' && row.entity !== v.am) return false;
  if (v.st !== 'all' && !row.statuses.includes(v.st)) return false;
  if (v.review !== 'all' && (v.review === REVIEW_OPEN ? !row.need : row.need)) return false;
  return !t || row.blob.includes(t);
}
// row = { ent, st:[{value}], need, basis, relStatus, conflicting, reports, hasConflicts, damaged, amount, blob }
export function eefaaMatches(row, v) {
  const t = String(v.q || '').trim().toLowerCase();
  if (v.am !== 'all' && row.ent !== v.am) return false;
  if (v.st !== 'all' && !row.st.some((s) => s.value === v.st)) return false;
  if (v.review !== 'all' && (v.review === REVIEW_OPEN ? !row.need : row.need)) return false;
  if (v.ex !== 'all' && row.basis !== v.ex) return false;
  if (v.mu !== 'all') {
    const r = row.relStatus;
    const ok = v.mu === 'conflicting' ? !!row.conflicting : v.mu === 'linked' ? ['proposed', 'confirmed'].includes(r) : v.mu === 'unmatched' ? !r || ['unmatched', 'rejected'].includes(r) : r === v.mu;
    if (!ok) return false;
  }
  if (v.rp !== 'all' && !row.reports.includes(v.rp)) return false;
  if (v.fl !== 'all' && (v.fl === 'conflicts' ? !row.hasConflicts : v.fl === 'damaged' ? !row.damaged : false)) return false;
  if (v.min !== '' && !((row.amount ?? -1) >= Number(v.min))) return false;
  if (v.max !== '' && !((row.amount ?? Infinity) <= Number(v.max))) return false;
  return !t || row.blob.includes(t);
}
// the referred-invoices list: e = { current, closedOnly }
export const referredMatches = (id, e, v) => (v.enf === 'all' || (v.enf === 'inexec' && e.current === 'in_execution') || (v.enf === 'suspended' && e.current === 'suspended') || (v.enf === 'closed' && e.closedOnly))
  && (!String(v.q || '').trim() || id.toLowerCase().includes(String(v.q).trim().toLowerCase()));

/* ======================================================================================== Investment contracts */
// Only filters the data really supports: the Amanah (source entity of the contract: municipalityid), the stored execution status (rentalstatus), the service type (contracttype),
// the stored contract status (only when the dataset is NOT already scoped to approved contracts), and the contract START date as stored. The data has no municipality below
// the Amanah and no verified installment / payment condition field: those two are deliberately NOT offered.
export const CONTRACT_KEYS = ['q', 'amanah', 'rental', 'type', 'status', 'from', 'to'];
export const CONTRACT_DEFAULTS = { q: '', amanah: 'all', rental: 'all', type: 'all', status: 'all', from: '', to: '' };
// o = { amanahs:[{code,name}], rentals:[{value,label}], types:[…], statuses:[…], scoped:boolean }
export function contractFields(o = {}) {
  const out = [
    { key: 'amanah', type: 'select', primary: true, label: A('الأمانة / الجهة (المصدر)', 'Amanah / entity (source)'), options: [allOption(), ...(o.amanahs || []).map((m) => ({ value: m.code, label: m.name }))] },
    { key: 'rental', type: 'select', primary: true, label: A('حالة التنفيذ', 'Execution status'), options: [allOption(), ...(o.rentals || [])] }
  ];
  if (!o.scoped) out.push({ key: 'status', type: 'select', primary: true, label: A('حالة العقد (كما هي)', 'Contract status (as stored)'), options: [allOption(), ...(o.statuses || [])] });
  out.push({ key: 'type', type: 'select', label: A('نوع الخدمة', 'Service type'), options: [allOption(), ...(o.types || [])] });
  out.push({ key: 'from', type: 'text', inputType: 'date', default: '', label: A('بداية العقد (كما هي مخزنة): من', 'Contract start date (as stored): from'), max: (v) => v.to || undefined, valueText: dateChip });
  out.push({ key: 'to', type: 'text', inputType: 'date', default: '', label: A('بداية العقد (كما هي مخزنة): إلى', 'Contract start date (as stored): to'), min: (v) => v.from || undefined, valueText: dateChip });
  return out;
}
// filter values → the body filter of furas.contracts (defaults are left out)
export function contractFilterBody(v, scoped = false) {
  const f = {};
  if (v.amanah && v.amanah !== 'all') f.municipality = v.amanah;
  if (v.rental && v.rental !== 'all') f.rental = v.rental;
  if (v.type && v.type !== 'all') f.type = v.type;
  if (!scoped && v.status && v.status !== 'all') f.status = v.status;
  if (v.from) f.startFrom = v.from;
  if (v.to) f.startTo = v.to;
  return f;
}
// the server side of the contract start-date filter (server/furasData.js uses the same rule): a number is in range when its single stored start date lies in it;
// a number whose records disagree on the start (or with none) is NOT shown when a date range is active — nothing is guessed.
export const startInRange = (start, from, to) => !!start && (!from || start >= from) && (!to || start <= to);

/* ---------- shared helpers re-exported for the tests / pages ---------- */
export { isDefaultValue, defaultOf, activeKeys, cascadePatch, pick };
export const hasActive = (defs, values, extra = 0) => activeKeys(defs, values, {}).length + extra > 0;
