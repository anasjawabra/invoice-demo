// Product management (IIM-24): the groups of products, their figures from the shared KPI module, and the ONE-LINE main challenge of each product — derived from its own numbers, never invented.
import { PRODUCT_GROUPS, PRODUCTS } from './iim.js';
import { ratio } from './revenueMetrics.js';

export const groupId = (keys) => keys.join('-');
export const groupByKey = (id) => PRODUCT_GROUPS.find((g) => groupId(g) === id) || null;
export const groupName = (keys, lang) => keys.map((k) => (lang === 'ar' ? PRODUCTS[k].ar : PRODUCTS[k].en)).join(lang === 'ar' ? ' و' : ' & ');

const sumKeys = ['count', 'gross', 'exclusions', 'exclusionsRules', 'net', 'collected', 'outstanding', 'overdueOutstanding', 'notDueOutstanding', 'excludedCount', 'cancelled'];
/** one product group = the sum of its products' aggregates (byProduct rows of a snapshot) */
export function groupTotals(byProduct, keys) {
  const t = Object.fromEntries(sumKeys.map((k) => [k, 0]));
  for (const g of byProduct || []) if (keys.includes(g.key)) for (const k of sumKeys) t[k] += g[k] || 0;
  t.uncollectedTotal = t.outstanding + t.exclusionsRules; // إجمالي غير المحصل (excluded included)
  t.rate = t.net > 0 ? t.collected / t.net : null;
  return t;
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;
/** the main challenge, in one line: the first of these that applies (thresholds are demo defaults) */
export function mainChallenge(t, { targetRate = 0.6, L }) {
  if (!(t.count > 0)) return L('No invoices in this selection.', 'لا فواتير في هذا الاختيار.');
  if (t.rate != null && t.rate < targetRate - 0.1) return L(`Low collection: ${pct(t.rate)} against a ${pct(targetRate)} target.`, `تحصيل منخفض: ${pct(t.rate)} مقابل مستهدف ${pct(targetRate)}.`);
  if (t.gross > 0 && t.exclusionsRules / t.gross > 0.15) return L(`High exclusions: ${pct(t.exclusionsRules / t.gross)} of the billed amount.`, `استبعادات مرتفعة: ${pct(t.exclusionsRules / t.gross)} من المفوتر.`);
  if (t.net > 0 && t.overdueOutstanding / t.net > 0.25) return L(`Large overdue balance: ${pct(t.overdueOutstanding / t.net)} of net billed.`, `رصيد متأخر كبير: ${pct(t.overdueOutstanding / t.net)} من صافي المفوتر.`);
  if (t.rate != null && t.rate < targetRate) return L(`Collection ${pct(t.rate)} is below the ${pct(targetRate)} target.`, `التحصيل ${pct(t.rate)} دون المستهدف ${pct(targetRate)}.`);
  return L('Within the expected range.', 'ضمن المعتاد.');
}
void ratio;
