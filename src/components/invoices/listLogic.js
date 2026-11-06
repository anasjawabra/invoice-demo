// Pure logic of the two invoice lists (Collected /invoices · Uncollected /collection): ranked-bar blocks (top five + «view all»), share %, the mapping of a chart
// selection to a list filter, the KPI strip numbers against the population each one counts, due-position segments, priority wording and the export label.
// No React and no network: unit-tested in tests/invoice-lists-ui.test.mjs. The data service (server/lists.js) decides every number; this module only arranges them.
import { PRODUCTS, ORIGIN_AR, ORIGIN_EN } from '../../data/iim';
import { REVENUE_SOURCES } from '../../data/revenueLedger';

export const TOP_N = 5;
export const PAGE_SIZES = [25, 50];
export const DEFAULT_PAGE_SIZE = 25;

const num = (v) => (Number.isFinite(v) ? v : 0);
const pick = (o, ar) => (o == null ? '' : typeof o === 'string' ? o : (ar ? o.ar : o.en) || o.en || '');

/* ---------- share ---------- */
/** the share of `v` in `total` as a percentage with one decimal; null when the total is zero (never «0%» of nothing) */
export function sharePct(v, total) { return total > 0 ? Math.round((num(v) / total) * 1000) / 10 : null; }
export const shareText = (v, total) => { const s = sharePct(v, total); return s == null ? '—' : `${s.toFixed(1)}%`; };

/* ---------- facet labels ---------- */
export function facetLabel(dim, item, ar) {
  if (ar && item.labelAr) return item.labelAr;
  if (!ar && item.labelEn) return item.labelEn;
  if (dim === 'product') return pick(PRODUCTS[item.key], ar) || String(item.key);
  if (dim === 'origin') return (ar ? ORIGIN_AR : ORIGIN_EN)[item.key] || String(item.key);
  if (dim === 'source') return pick(REVENUE_SOURCES[item.key], ar) || String(item.key);
  return String(item.key);
}

/* ---------- ranked items: top five + «view all», the selected one is never hidden ---------- */
/**
 * items: [{ key, count, <measure> … }] · measure: 'collected' | 'outstanding' | …  → { available, rows, total, hiddenCount, all }
 * Only items with an amount above zero are ranked (a zero is not a bar). A missing facet (null / undefined) is «unavailable», not an empty list.
 * When the chart is collapsed to the top N and the selected key ranks lower, it replaces the last visible row so a selection can always be seen.
 */
export function rankItems(items, measure, { top = TOP_N, expanded = false, selectedKey = null } = {}) {
  if (!Array.isArray(items)) return { available: false, rows: [], total: 0, hiddenCount: 0, all: [] };
  const all = items.filter((x) => num(x[measure]) > 0).slice().sort((a, b) => num(b[measure]) - num(a[measure]) || String(a.key).localeCompare(String(b.key)));
  const total = all.reduce((t, x) => t + num(x[measure]), 0);
  let rows = expanded || all.length <= top ? all : all.slice(0, top);
  if (!expanded && selectedKey != null && all.length > top && !rows.some((x) => x.key === selectedKey)) {
    const sel = all.find((x) => x.key === selectedKey); if (sel) rows = [...rows.slice(0, top - 1), sel];
  }
  return { available: true, rows, total, hiddenCount: Math.max(0, all.length - rows.length), all };
}

/** hover text of one bar: its share of the facet total and its invoice count (the exact amount is added by the chart itself) */
export function barTip(item, measure, total, ar, nf = (n) => String(n)) {
  const sh = shareText(item[measure], total); const c = nf(num(item.count));
  if (measure === 'outstanding') return ar ? `${sh} من الإجمالي · ${c} فاتورة في القائمة (يشمل المستبعد)` : `${sh} of the total · ${c} invoices in the list (excluded included)`; // the amount is NET unpaid, the count is the list's (the excluded invoices are in the list)
  return ar ? `${sh} من الإجمالي · ${c} فاتورة` : `${sh} of the total · ${c} invoices`;
}

/**
 * the chart block of one ranked facet (the shared report-chart contract, kind 'hbar'): labels · keys · tips (per-bar hover text) · one series with the role colour.
 * { dim, items, measure, role ('collected' = green, 'uncollected' = amber), title, valueTitle, ar, expanded, selectedKey, nf }
 */
export function rankedBlock({ dim, items, measure, role, title, valueTitle, ar, expanded = false, selectedKey = null, top = TOP_N, nf }) {
  const r = rankItems(items, measure, { top, expanded, selectedKey });
  if (!r.available || !r.rows.length) return { ...r, block: null, selectedIndex: -1 };
  const labels = r.rows.map((x) => facetLabel(dim, x, ar));
  const block = {
    type: 'chart', kind: 'hbar', title, valueTitle, labels, keys: r.rows.map((x) => String(x.key)),
    tips: r.rows.map((x) => barTip(x, measure, r.total, ar, nf)),
    series: [{ label: valueTitle || title, values: r.rows.map((x) => num(x[measure])), role }]
  };
  return { ...r, block, selectedIndex: selectedKey == null ? -1 : r.rows.findIndex((x) => x.key === selectedKey) };
}

/* ---------- chart selection → list filter ---------- */
/** clicking the selected bar again clears it; clicking another replaces it (one selected value per dimension) */
export const toggleKey = (current, key) => (key == null || String(current) === String(key) ? null : String(key));
/** the list-filter fields a chart selection adds to a request. The revenue-source selection is NOT here: it is the shared scope source (one state with the toolbar control); only the due-position bar adds a page filter */
export function selectionFilters(sel = {}) { return sel.dueState ? { dueState: sel.dueState } : {}; }
export const selectionCount = (sel = {}) => (sel.dueState ? 1 : 0);

/* ---------- labels ---------- */
export const DUE_LABEL = {
  overdue: { ar: 'متأخرة', en: 'Overdue' },
  not_due: { ar: 'غير مستحقة بعد', en: 'Not yet due' },
  unknown: { ar: 'تاريخ الاستحقاق غير متاح', en: 'Due date unavailable' }
};
export const DUE_KEYS = ['overdue', 'not_due', 'unknown'];
export const PRIORITY_LABEL = { high: { ar: 'عالية', en: 'High' }, medium: { ar: 'متوسطة', en: 'Medium' }, low: { ar: 'منخفضة', en: 'Low' } };
export const PRIORITY_KEYS = ['high', 'medium', 'low'];
export const priorityText = (level, ar) => pick(PRIORITY_LABEL[level], ar) || '—';
/** the accessible name of a priority badge: the level and the rule that gave it, never a number */
export function priorityAria(p, ar) {
  if (!p || !PRIORITY_LABEL[p.level]) return ar ? 'الأولوية غير متاحة' : 'Priority not available';
  const why = pick(p.why, ar);
  return ar ? `الأولوية ${priorityText(p.level, true)}${why ? `: ${why}` : ''}` : `${priorityText(p.level, false)} priority${why ? `: ${why}` : ''}`;
}
export const dueLabel = (key, ar) => pick(DUE_LABEL[key], ar) || key;

/* ---------- Collected: the KPI strip of the DISPLAYED population ---------- */
/**
 * main = the list response of the displayed register (state «paid», every filter + chart selection). The data service describes the population in the same response
 * (population.fullyPaid / partlyPaid = the payment status of the listed invoices), so the strip and the table can never disagree.
 * → { count, amount, fully, partly, closes }: closes = fully + partly equals the register count (the strip adds up)
 */
export function collectedKpis(main) {
  const count = num(main?.total); const pop = main?.population || {}; const f = num(pop.fullyPaid); const p = num(pop.partlyPaid);
  return { count, amount: num(main?.sums?.collected), fully: f, partly: p, closes: f + p === count };
}
/**
 * the period context: EVERY invoice of the scope (not only the collected register) with explicit denominators.
 * collection rate = collected ÷ net billed over all of them; null when there is nothing billed
 */
export function periodContext(totals) {
  const T = totals || {}; const net = num(T.net);
  return { invoices: num(T.count), collected: num(T.collected), net, rate: net > 0 ? num(T.collected) / net : null };
}

/* ---------- Uncollected: the three populations ---------- */
/**
 * main = list response of state «uncollected» (every uncollected invoice, excluded ones included); population.excluded = the invoices an exclusion applies to
 * → { count, excludedCount, openCount, totalUnpaid, excludedUnpaid, netUnpaid, closes }
 * totalUnpaid = netUnpaid + excludedUnpaid (the stated identity); closes = the open + excluded counts add up to the list
 */
export function uncollectedKpis(main) {
  const s = main?.sums || {}; const net = num(s.outstanding); const ex = num(s.exclusionAmount);
  const count = num(main?.total); const exCount = num(main?.population?.excluded);
  return { count, excludedCount: exCount, openCount: Math.max(0, count - exCount), totalUnpaid: net + ex, excludedUnpaid: ex, netUnpaid: net, closes: exCount <= count };
}
/** the due-position bar: three segments over the NET unpaid (an excluded invoice is counted apart — excludedCount — and falls in the segment of its own due date when that segment is chosen). amountSum equals the net unpaid when the service is consistent */
export function dueSegments(due) {
  if (!due) return { available: false, segments: [], total: 0, count: 0 };
  const src = { overdue: due.overdue, not_due: due.notYetDue || due.not_due, unknown: due.unknown };
  const segments = DUE_KEYS.map((key) => ({ key, count: num(src[key]?.count), amount: num(src[key]?.amount), excludedCount: num(src[key]?.excludedCount), excludedAmount: num(src[key]?.excludedAmount) }));
  const total = segments.reduce((t, x) => t + x.amount, 0); const count = segments.reduce((t, x) => t + x.count, 0);
  return { available: true, segments: segments.map((x) => ({ ...x, share: sharePct(x.amount, total) })), total, count };
}

/* ---------- export ---------- */
export const exportLabel = (total, ar, nf = (n) => String(n)) => (ar ? `تصدير كل النتائج المصفّاة (${nf(total)})` : `Export all filtered results (${nf(total)})`);
export const exportHint = (ar) => (ar ? 'ملف CSV يضم كل الفواتير المطابقة للتصفية الحالية — وليس الصفحة المعروضة فقط.' : 'A CSV of every invoice matching the current filters — not just the page on screen.');

/* ---------- wording of the populations (one place, so the page and the tests agree) ---------- */
export const COLLECTED_WORDS = {
  registerNote: { ar: 'يشمل السجل الفواتير المسدّدة بالكامل والمسدّدة جزئياً. «المحصّل» هو المبلغ المحصّل على هذه الفواتير نفسها.', en: 'The register includes fully paid and partly paid invoices. “Collected” is the amount collected on these same invoices.' },
  periodBasis: { ar: 'الفترة بتاريخ إصدار الفاتورة. لا يوجد مرشّح بتاريخ السداد، فلا تعني الفترة أن المبلغ حُصّل خلالها.', en: 'The period is the invoice ISSUE date. There is no payment-date filter, so the period does not mean the money was received within it.' }
};
export const UNCOLLECTED_WORDS = {
  total: { ar: 'إجمالي غير المحصّل — يشمل المستبعد', en: 'Total unpaid — excluded included' },
  excluded: { ar: 'غير المحصّل المستبعد', en: 'Excluded unpaid' },
  net: { ar: 'صافي غير المحصّل بعد الاستبعاد المعتمد', en: 'Net unpaid after approved exclusions' },
  totalDef: { ar: 'كل المبالغ غير المسدّدة لكل الفواتير المعروضة', en: 'Every unpaid amount of every listed invoice' },
  excludedDef: { ar: 'الجزء غير المسدّد من الفواتير التي انطبقت عليها قاعدة استبعاد معتمدة', en: 'The unpaid part of invoices an approved exclusion rule applies to' },
  netDef: { ar: 'إجمالي غير المحصّل − المستبعد', en: 'Total unpaid − excluded' }
};
