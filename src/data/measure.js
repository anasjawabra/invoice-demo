// ONE measurement rule for every view (Dashboard, Fixed reports, Smart reports, Planning) — EQ1, approved.
//
//   HEADLINE basis  : collections are counted up to the END OF THE PERIOD (a closed period is measured at its own end; a period that is still open
//                     is measured at the data cut-off, which is its end for now). Comparisons use the same rule for both periods (same age).
//   TO-DATE figure  : collections up to today for the SAME invoices, shown only when asked for, as a separate figure with its own label.
//
// No view chooses its own measurement date: they all call these functions.
import { DATA_CUTOFF } from './revenueLedger';
import { fmtDateText } from './clock';

export const BASIS = { PERIOD_END: 'periodEnd', TO_DATE: 'cutoff' };

// the config a request must carry for a basis (the headline always uses PERIOD_END)
export const cfgFor = (cfg, basis = BASIS.PERIOD_END) => ({ ...cfg, collectionsAsOf: basis });
export const headlineCfg = (cfg) => cfgFor(cfg, BASIS.PERIOD_END);

// the date up to which payments are counted for a scope under a basis
export function asOfDate(scope, basis, today = DATA_CUTOFF) {
  if (basis === BASIS.TO_DATE) return today;
  return scope.to < today ? scope.to : today;
}
// a to-date figure differs from the headline only for a CLOSED period
export const hasToDateVariant = (scope, today = DATA_CUTOFF) => scope.to < today;

// one snapshot under the headline basis, or the labelled to-date variant
export const measure = (data, scope, cfg, basis = BASIS.PERIOD_END) => data.snapshot(scope, { cfg: cfgFor(cfg, basis) });

export function basisLabel(scope, basis, today, lang = 'ar') {
  const d = fmtDateText(asOfDate(scope, basis, today), lang); const ar = lang === 'ar';
  if (basis === BASIS.TO_DATE) return ar ? `المحصّل حتى اليوم ${d}` : `Collected up to today ${d}`;
  return scope.to < today ? (ar ? `المحصّل حتى نهاية الفترة ${d}` : `Collected up to the period end ${d}`) : (ar ? `المحصّل حتى ${d} (نهاية الفترة المفتوحة = اليوم)` : `Collected up to ${d} (the open period ends today)`);
}
