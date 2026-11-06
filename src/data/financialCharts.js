// The SHARED chart specification builders: Smart Reports (the report model), the Dashboard and every export draw these same blocks,
// so a chart means the same thing — and carries the same numbers — wherever it appears. Pure: totals in, a chart block out (null when the data cannot support the chart).
// A chart block = { type:'chart', kind, title, labels, series:[{label, values}], note? , … } (see src/data/reportModel.js and scratch/_agent-brief.md for the kinds).
// Nothing is invented: a chart with no net billed, no balance or a single month is simply not produced.
import { dimOf, M_NET, M_COLLECTED, M_UNCOLLECTED } from './chartAlts';
const lx = (ar) => (a, e) => (ar ? a : e);

/** gross billed → exclusions (cancellation included) → net billed. Reconciles by construction: net = gross − exclusions. */
export function grossToNetChart(T, lang) {
  const L = lx(lang === 'ar');
  if (!(T.gross > 0)) return null;
  return { type: 'chart', kind: 'waterfall', dim: dimOf('step', { ordered: true, measures: [{ key: 'amount', kind: 'amount' }] }), title: L('من إجمالي المفوتر إلى صافي المفوتر', 'From gross billed to net billed'), labels: [L('إجمالي المفوتر', 'Gross billed'), L('الاستبعادات', 'Exclusions'), L('صافي المفوتر', 'Net billed')], series: [{ label: L('المبلغ', 'Amount'), values: [T.gross, -T.exclusions, T.net] }], totals: [true, false, true], note: L('صافي المفوتر = إجمالي المفوتر − الاستبعادات (ويشمل الإلغاء).', 'Net billed = gross billed − exclusions (cancellation included).') };
}
/** the collected and uncollected parts of net billed (they add up to it); not drawn when net billed is zero (no denominator) */
export function collectedShareChart(T, lang) {
  const L = lx(lang === 'ar');
  if (!(T.net > 0)) return null;
  return { type: 'chart', kind: 'stacked_hbar', dim: dimOf('status', { measures: [M_COLLECTED, M_UNCOLLECTED], additive: true, whole: { label: L('صافي المفوتر', 'Net billed'), value: T.net } }), title: L('المحصّل وغير المحصّل من صافي المفوتر', 'Collected and uncollected share of net billed'), labels: [L('صافي المفوتر', 'Net billed')], series: [{ label: L('المحصّل', 'Collected'), values: [T.collected] }, { label: L('غير المحصّل', 'Uncollected'), values: [T.outstanding] }], note: L('غير المحصّل = صافي المفوتر − المحصّل؛ نسبة التحصيل = المحصّل ÷ صافي المفوتر.', 'Uncollected = net billed − collected; collection rate = collected ÷ net billed.') };
}
/** running totals by issue month (needs at least two months) — the basis is stated: cumulative, never to be read as a monthly figure */
export function cumulativeChart(months, lang) {
  const L = lx(lang === 'ar');
  if (!months || months.length < 2) return null;
  let n = 0; let c = 0;
  return { type: 'chart', kind: 'line', basis: 'cumulative', dim: dimOf('month', { ordered: true, measures: [M_NET, M_COLLECTED] }), title: L('التراكمي: صافي المفوتر والمحصّل (من بداية الفترة)', 'Cumulative net billed and collected (from the start of the period)'), labels: months.map((m) => m.month), series: [{ label: L('صافي المفوتر التراكمي', 'Cumulative net billed'), values: months.map((m) => (n += m.net)) }, { label: L('المحصّل التراكمي', 'Cumulative collected'), values: months.map((m) => (c += m.collected)) }], note: L('كل نقطة هي مجموع الأشهر حتى ذلك الشهر؛ يختلف عن الرسم الشهري الذي يعرض كل شهر وحده.', 'Each point is the running total up to that month; the monthly chart shows each month on its own.') };
}
/** the standing balance by age past due — only where the aged buckets carry an amount (the due dates exist and something is owed) */
export function agingChart(aging, lang, label = (x) => x) {
  const L = lx(lang === 'ar');
  if (!aging || !aging.some((a) => a.amount > 0)) return null;
  const whole = aging.reduce((t, a) => t + a.amount, 0);
  return { type: 'chart', kind: 'bar', dim: dimOf('aging', { ordered: true, measures: [M_UNCOLLECTED], additive: true, whole: { label: L('الرصيد القائم', 'Standing balance'), value: whole } }), title: L('الرصيد غير المحصّل حسب العمر بعد الاستحقاق', 'Uncollected balance by age past due'), labels: aging.map((a) => label(a.label)), series: [{ label: L('غير المحصّل', 'Uncollected'), values: aging.map((a) => a.amount) }] };
}
