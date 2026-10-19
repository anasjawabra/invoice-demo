// ONE KPI module (IIM-05). Every card, list header, dashboard figure and export reads its numbers from here, so the same filters always show
// the same figures. It is a pure function of a snapshot's `totals` (the columnar engine already applies D7 «أخرى» outside the billed total,
// D10 exclusions only on uncollected invoices, and the cancelled-invoice deduction).
//
//   إجمالي المفوتر            = Σ billed where the main class ≠ «أخرى»                       (totals.gross)
//   المحصّل                   = Σ collected
//   إجمالي غير المحصل         = uncollected amount INCLUDING the excluded invoices            (collectible + excluded)
//   إجمالي المستبعد           = uncollected amount of invoices with an exclusion reason
//   صافي المفوتر              = إجمالي المفوتر − الاستبعادات (and the separate cancelled deduction)
//   غير المحصل القابل للتحصيل  = إجمالي غير المحصل − إجمالي المستبعد
//   نسبة التحصيل              = المحصّل ÷ صافي المفوتر
//
// Invariants (tested):  إجمالي المفوتر = المحصّل + إجمالي غير المحصل + الملغاة      صافي المفوتر = المحصّل + غير المحصل القابل للتحصيل
import { ratio } from './revenueMetrics.js';

const TOL = 0.5; // SAR (float accumulation over ~10^6 rows)
export function kpiOf(T) {
  const excluded = T.exclusionsRules || 0; const cancelled = T.cancelled || 0;
  const collectible = T.outstanding;
  const uncollectedTotal = collectible + excluded;
  const out = {
    billedTotal: T.gross, collected: T.collected, uncollectedTotal, excluded, cancelled, collectible, net: T.net,
    rate: ratio(T.collected, T.net),
    count: T.count, excludedCount: T.excludedCount || 0, ignoredExclusions: T.ignoredExclusions || 0
  };
  out.invariants = {
    grossEqCollectedPlusUncollected: Math.abs(out.billedTotal - (out.collected + out.uncollectedTotal + out.cancelled)) <= TOL,
    netEqCollectedPlusCollectible: Math.abs(out.net - (out.collected + out.collectible)) <= TOL
  };
  out.invariants.ok = out.invariants.grossEqCollectedPlusUncollected && out.invariants.netEqCollectedPlusCollectible;
  return out;
}
