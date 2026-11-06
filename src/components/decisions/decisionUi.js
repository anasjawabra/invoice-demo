// «غرفة القرارات» — the PURE logic of the page UI (no React, no I/O; unit-tested in tests/decision-room-ui.test.mjs):
// which items a view shows (page filters + a chart selection), the removable chips, the summary strip, the follow-up buttons by flag state and permission,
// value formatting by unit, and the plain-words labels. The data model itself lives in src/data/decisionRoom.js / decisionStore.js.
import { filterItems, CATEGORIES } from '../../data/decisionRoom';
import { fmtMoney } from '../../utils/money';

const bi = (ar, en) => ({ ar, en });
const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');
const isAll = (v) => v == null || v === '' || v === 'all';

/* ---------------- which items a view shows ---------------- */
/** The page filters (category · priority · follow-up flag) AND the selected chart mark. A mark whose filter names another category than the page filter shows nothing (no silent widening). */
export function viewItems(items, values = {}, mark = null) {
  const page = filterItems(items, { category: values.category, priority: values.priority, flag: values.flag });
  return mark && mark.filter ? filterItems(page, mark.filter) : page;
}
/** the page-own filters that differ from «all» */
export const pageFilterCount = (values = {}) => ['category', 'priority', 'flag'].filter((k) => !isAll(values[k])).length;
/** is anything narrowing the list on top of the shared scope? (drives the no-results reset) */
export const viewIsNarrowed = (values = {}, mark = null) => pageFilterCount(values) > 0 || !!mark;

/** the chip of a chart selection: «من الرسم: <label> ×» */
export function markChip(mark, lang = 'ar') {
  if (!mark) return null;
  return { key: 'chart-mark', label: lang === 'ar' ? 'من الرسم:' : 'From the chart:', value: String(mark.label ?? '') };
}
/** a mark from a chart block and the selection the chart reports (`onSelect` → { i }); null when the block has no mark for that element */
export function markFrom(chartKey, block, sel) {
  const m = block && Array.isArray(block.marks) ? block.marks[sel?.i] : null;
  return m ? { chart: chartKey, i: sel.i, label: m.label, filter: m.filter } : null;
}
/** choosing the already-selected mark again clears it */
export const toggleMark = (current, next) => (current && next && current.chart === next.chart && current.i === next.i ? null : next);

/* ---------------- the summary strip ---------------- */
/**
 * The strip shows three counts (open financial issues · flagged for follow-up · evidence to verify) and a financial total ONLY when summary.financialTotal is non-null.
 * Nothing at all is shown for the total when it is null (the reason is a data-layer detail, not a number the page should hint at).
 */
export function stripOf(summary) {
  if (!summary) return null;
  const T = summary.financialTotal;
  const share = T && Number(T.scopeTotal) > 0 ? T.amount / T.scopeTotal : null;
  return {
    tiles: [
      { key: 'openFinancial', count: summary.openFinancialIssues, label: bi('قضايا مالية مفتوحة', 'Open financial issues') },
      { key: 'flagged', count: summary.flagged, label: bi('موسومة للمتابعة', 'Flagged for follow-up') },
      { key: 'verify', count: summary.needsVerification, label: bi('تحتاج تحقق الدليل', 'Need evidence verification') }
    ],
    total: T ? { amount: T.amount, label: T.label, basis: T.basis, share, scopeTotal: T.scopeTotal } : null,
    overlapNote: summary.overlapNote || null
  };
}

/* ---------------- follow-up controls ---------------- */
export const FOLLOW_STATEMENT = bi(
  'تمت المتابعة تعني أنه رُوجع أو تمت متابعته؛ لا تعني أن المشكلة المالية حُلّت أو أن الفاتورة سُدّدت أو أن التوصية اعتُمدت. العلامة لا تنفّذ إجراءً تنفيذياً ولا تغيّر مستهدفاً ولا تعدّل أي سجل.',
  'Follow-up completed means the item was reviewed or followed up; it does not mean the financial issue is resolved, the invoice paid or the recommendation approved. A flag never executes enforcement, changes a target or alters any record.'
);
export const NO_PERMISSION = bi('هذا الدور للقراءة فقط: لا يمكنه تغيير علامة المتابعة أو إضافة ملاحظة.', 'This role is read-only: it cannot change a follow-up flag or add a note.');
/**
 * Which follow-up buttons exist for a flag state, and whether they are enabled.
 * flag: none | followed_up → «وضع علامة للمتابعة» · complete: only from flagged · unflag: flagged | followed_up. Without review rights every available button is DISABLED with the reason.
 */
export function followControls(flag = 'none', canReview = false) {
  const base = { flag: flag === 'none' || flag === 'followed_up', complete: flag === 'flagged', unflag: flag === 'flagged' || flag === 'followed_up' };
  const reason = canReview ? null : NO_PERMISSION;
  const mk = (visible) => ({ visible, enabled: visible && canReview, reason: visible ? reason : null });
  return { flag: mk(base.flag), complete: mk(base.complete), unflag: mk(base.unflag), note: { visible: true, enabled: canReview, reason } };
}
export const FOLLOW_ERRORS = {
  no_permission: NO_PERMISSION, already_flagged: bi('البند موسوم للمتابعة بالفعل.', 'The item is already flagged.'), not_flagged: bi('لا توجد علامة متابعة على هذا البند.', 'The item has no follow-up flag.'),
  text_required: bi('اكتب الملاحظة أولاً.', 'Write the note first.'), actor_required: bi('تعذّر تحديد المستخدم.', 'The user could not be identified.')
};

/* ---------------- labels ---------------- */
export const FLAG_BUTTONS = { flag: bi('وضع علامة للمتابعة', 'Flag for follow-up'), complete: bi('تمت المتابعة', 'Follow-up completed'), unflag: bi('إزالة علامة المتابعة', 'Remove the follow-up flag') };
export const CONDITION_LABELS = { open: bi('مفتوحة ماليًا', 'Financially open'), closed: bi('لم تعد قائمة في البيانات', 'No longer present in the data') };
export const EVIDENCE_STATUS = {
  source_record: bi('سجل المصدر', 'Source record'), calculated: bi('محسوب', 'Calculated'), unverified: bi('غير متحقق منه', 'Unverified'), missing: bi('غير متوفر', 'Missing')
};
export const PERIOD_BASIS = {
  selected: bi('الفترة المختارة (فواتير بتاريخ الإصدار)', 'Selected period (invoices by issue date)'),
  fiscal_year: bi('السنة المالية حتى تاريخ التقرير', 'Fiscal year to the reporting date'),
  standing: bi('رصيد قائم حتى تاريخ القطع (لا يتأثر بالفترة)', 'Standing balance to the cutoff (not affected by the period)')
};
export const DATE_BASIS_NOTE = bi(
  'الفترة المختارة تُطبَّق على تاريخ إصدار الفاتورة. بنود خطة التحصيل تقيس السنة المالية حتى تاريخ التقرير، وبنود الأقساط والأوامر رصيد قائم؛ ويذكر كل بند أساسه.',
  'The selected period applies to the invoice issue date. Plan items measure the fiscal year to the reporting date, installment and order items are standing balances; each item states its basis.'
);
export const SECTION_LABELS = {
  facts: bi('حقائق موثقة', 'Verified facts'), calculated: bi('فروقات محسوبة', 'Calculated deviations'), unknown: bi('أسباب غير معروفة', 'Unknown causes'), proposed: bi('مقترحات للمراجعة', 'Proposed review steps')
};
export const PROPOSED_NOTE = bi('مقترح — ليس قراراً معتمداً', 'Proposed — not an approved decision');

/* ---------------- formatting ---------------- */
/** a value of a `calculated` / `comparison` entry in its unit: SAR · pct (a fraction) · pp (points) · count · days */
export function formatValue(value, unit, lang = 'ar') {
  if (value == null || !Number.isFinite(Number(value))) return lang === 'ar' ? 'غير متاح' : 'n/a';
  const v = Number(value); const ar = lang === 'ar';
  switch (unit) {
    case 'SAR': return fmtMoney(v, { lang });
    case 'pct': return `${(v * 100).toFixed(1)}%`;
    case 'pp': return `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(1)} ${ar ? 'نقطة' : 'pp'}`;
    case 'days': return `${Math.round(v)} ${ar ? 'يوماً' : 'days'}`;
    default: return Math.round(v).toLocaleString('en-US');
  }
}
/** the labelled amount of the row: «انكشاف متأخر 1.46 مليار ريال» (label from the item, one figure) */
export function measureText(item, lang = 'ar') {
  const m = item && item.measure; if (!m) return '';
  const label = pick(m.label, lang);
  const val = m.amount != null ? fmtMoney(m.amount, { lang }) : m.count != null ? Math.round(m.count).toLocaleString('en-US') : '';
  return val ? `${label} ${val}` : label;
}
/** the entry text of a history line: the bilingual `i18n` of a migrated entry when present, else the stored note */
export function historyText(h, lang = 'ar') { return h && h.i18n ? pick(h.i18n, lang) : (h && h.note) || ''; }
export const categoryLabel = (item, lang = 'ar') => pick(CATEGORIES[item?.category], lang);

/** the highest-priority open findings for the dashboard preview (the list is already ranked High → Medium → Low, then by amount) */
export function previewItems(items, n = 4) { return (items || []).filter((i) => i.condition?.open !== false).slice(0, n); }
/** the deep link of an item inside the Decision Room */
export const itemLink = (key) => `/decisions?item=${encodeURIComponent(key)}`;
