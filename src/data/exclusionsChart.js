// «الاستبعادات حسب السبب» as ONE chart block (the Exclusions page): the excluded amount by EFFECTIVE (primary) reason. Each invoice is counted once, under its effective reason, so the bars add up to
// the total excluded (the same figures as the reasons table: snapshot.ruleStats[ruleId].primaryAmount). Pure: rows in → a model chart block out (null when fewer than two reasons carry an amount —
// one bar is not a comparison). A reason with no excluded amount is not a bar (and not a row of the table by default); nothing is invented or estimated.
import { dimOf, M_EXCLUDED } from './chartAlts';

export const EXCLUSIONS_CHART_ID = 'exclusions:reasons';
/** the ONE order of the reasons — by excluded amount, then invoice count, then id — used by the chart AND the reasons table so they list the same reasons in the same order */
export const reasonOrder = (a, b) => b.amount - a.amount || (b.count || 0) - (a.count || 0) || String(a.ruleId).localeCompare(String(b.ruleId));
/** rows: [{ ruleId, ar, en, amount, count }] */
export function exclusionsReasonChart(rows, lang) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const used = (rows || []).filter((r) => Number.isFinite(r.amount) && r.amount > 0).slice().sort(reasonOrder);
  if (used.length < 2) return null;
  const total = used.reduce((t, r) => t + r.amount, 0);
  return {
    type: 'chart', kind: 'hbar', id: EXCLUSIONS_CHART_ID, ranked: true, otherLabel: L('أسباب أخرى', 'Other reasons'),
    dim: dimOf('reason', { measures: [M_EXCLUDED], additive: true, whole: { label: L('إجمالي المستبعد', 'Total excluded'), value: total } }),
    title: L('المبلغ المستبعد حسب السبب الفعلي', 'Excluded amount by effective reason'),
    labels: used.map((r) => (ar ? r.ar : r.en)), keys: used.map((r) => r.ruleId),
    series: [{ label: L('المبلغ المستبعد', 'Excluded amount'), values: used.map((r) => r.amount) }],
    note: L('كل فاتورة تُحتسب مرة واحدة تحت سببها الفعلي، فمجموع الأعمدة = إجمالي المستبعد. انقر عموداً لعرض فواتيره.', 'Each invoice is counted once, under its effective reason, so the bars add up to the total excluded. Click a bar to list its invoices.')
  };
}
