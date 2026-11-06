// THE PLANNING DATE PRIMITIVES + the period-aware plan basis barrel (revenue plans, docs/revenue-plans-spec.md §5).
// The store-based, fiscal-year-only `planningBasis` (target from the browser-stored device record, tolerance classification, status text) was RETIRED in the cleanup phase: every plan figure now comes from
// `planningBasisFromPlan` (src/data/plans/planBasis.js, ONE plan version) — re-exported below. What stays here are the small calendar primitives other modules share (the dashboard's appropriation attainment, the run-rate
// forecast helpers, the outlook): planned to date by calendar-day proration, the reporting date, the month labels. Pure functions, no I/O.
const bi = (ar, en) => ({ ar, en });
export const MONTHS = 12;
export const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate(); // month 1–12
const MONTH_NAMES = { ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
export const monthLabel = (ym) => { const m = Number(ym.slice(5, 7)); return bi(`${MONTH_NAMES.ar[m - 1]} ${ym.slice(0, 4)}`, `${MONTH_NAMES.en[m - 1]} ${ym.slice(0, 4)}`); };

/* ---------------------------------------------------------------- the date / plan primitives */
// cumulative plan for a target spread evenly over twelve months: index 0 = end of January … index 11 = end of December
export const evenPlan = (target) => Array.from({ length: MONTHS }, (_, i) => target * ((i + 1) / MONTHS));
/** PLANNED TO DATE of a 12-month cumulative plan: the closed months in full + the current month in proportion to the calendar days elapsed (day d of the month's days) */
export function plannedToDate(cumulative, asOf) {
  const m = Number(asOf.slice(5, 7)); const d = Number(asOf.slice(8, 10)); const y = Number(asOf.slice(0, 4));
  const prev = m > 1 ? cumulative[m - 2] : 0; const cur = cumulative[m - 1];
  return prev + (cur - prev) * (d / daysInMonth(y, m));
}
export const isMonthEnd = (iso) => Number(iso.slice(8, 10)) === daysInMonth(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)));

// the period-aware basis (annual plans AND any date range): src/data/plans/planBasis.js
export { planningBasisFromPlan, planScope, planScopeKey, lastCompleteMonthBefore, historyMonths, remainingOf, deviationAmount, PLAN_STATE_TEXT, resolveViewScope, normalizeViewScope, municipalAllocationsOf, DEFAULT_VIEW_SCOPE, UNALLOCATED_MUNI_KEY, UNALLOCATED_MUNI_LABEL, NO_MUNICIPAL_TARGET } from './plans/planBasis';
