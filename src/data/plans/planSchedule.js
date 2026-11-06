// PURE builders of the two things a plan shows about its PERIOD besides the headline measures — shared by every plan (a full year and the remaining-2026 plan use the same functions):
//   scheduleRows(basis)        the planned schedule by month (partial first / last month by its days), the cumulative plan and — once a month has started — the actual and the signed deviation; totals; Σ planned = the target to the riyal
//   upcomingTiles(basis)       the four planning measures that replace the empty tiles BEFORE the period starts: the period target · the planned collection of the first month(s) · the required average daily collection
// No figure is invented here: everything comes from the planning basis (planBasis.planningBasisFromPlan). Text is bilingual { ar, en }.
import { planMonthLabel } from './planBasis';
import { fmtDateText } from '../clock';

const bi = (ar, en) => ({ ar, en });
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const MONTH_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (ym) => ({ ar: MONTH_AR[Number(ym.slice(5, 7)) - 1], en: MONTH_EN[Number(ym.slice(5, 7)) - 1] });
const dayOf = (iso) => Number(iso.slice(8, 10));

/** «7–30 نوفمبر» / «7–30 Nov» for a partial month, «نوفمبر» for a whole one */
export function monthRangeLabel(m) {
  const n = monthName(m.ym);
  return m.partial ? bi(`${dayOf(m.start)}–${dayOf(m.end)} ${n.ar}`, `${dayOf(m.start)}–${dayOf(m.end)} ${n.en}`) : bi(n.ar, n.en);
}

/**
 * The planned schedule by month. rows[i] = { ym, label, range, days, monthDays, partial, planned, plannedCum, share (planned ÷ target), actual, actualCum, deviation (actual − planned of that month, only for a COMPLETE month), reached, complete }.
 * totals = { planned (Σ rows = the target to the riyal), target, reconciles, actual (Σ observed) , days }. `hasActual` = any month has begun (the actual columns are then shown). Empty when the plan has no months / no target.
 */
export function scheduleRows(basis) {
  const months = Array.isArray(basis?.months) ? basis.months : []; const T = basis?.target?.value;
  if (!months.length || !fin(T) || !(T > 0) || basis.state === 'invalid_period') return { rows: [], totals: null, hasActual: false, partial: false };
  const rows = months.map((m) => ({
    ym: m.ym, label: planMonthLabel(m.ym), range: monthRangeLabel(m), days: m.days, monthDays: m.monthDays, partial: !!m.partial, planned: fin(m.planned) ? m.planned : null, plannedCum: fin(m.plannedCum) ? m.plannedCum : null,
    share: fin(m.planned) ? m.planned / T : null, actual: fin(m.actual) ? m.actual : null, actualCum: fin(m.actualCum) ? m.actualCum : null,
    deviation: m.complete && fin(m.actual) && fin(m.planned) ? m.actual - m.planned : null, reached: !!m.reached, complete: !!m.complete, cutoffMonth: !!m.cutoffMonth
  }));
  const planned = rows.reduce((t, r) => t + (r.planned || 0), 0);
  const obs = rows.filter((r) => r.actual != null);
  return { rows, totals: { planned, target: T, reconciles: Math.abs(planned - T) < 1, actual: obs.length ? obs.reduce((t, r) => t + r.actual, 0) : null, days: rows.reduce((t, r) => t + r.days, 0) }, hasActual: rows.some((r) => r.reached), partial: rows.some((r) => r.partial) };
}

/**
 * The FOUR measures of an UPCOMING plan (the period has not started), in order:
 *   1 target        the period target (a derived plan: «المستهدف للفترة المتبقية»)
 *   2 first month   the planned collection of the first month of the period (a partial month says so: «7–30 نوفمبر»)
 *   3 second month  the planned collection of the second month — when the period has exactly two months; for a longer period the REQUIRED MONTHLY average (target ÷ months by days)
 *   4 daily         the required average daily collection = target ÷ the days of the period
 * `derived` = the plan carries a frozen baseline (the remaining-of-annual plan): the first tile is then «المستهدف للفترة المتبقية».
 * → [{ id, label, value (riyals), sub:{ar,en} }] — or [] when the plan has no target / the pace is not computable (the caller then folds that into the one status line).
 */
export function upcomingTiles(basis, { derived = false } = {}) {
  const T = basis?.target?.value; const req = basis?.pace?.required; const months = Array.isArray(basis?.months) ? basis.months : [];
  if (basis?.state !== 'future_period' || !fin(T) || !(T > 0) || !months.length) return [];
  const days = basis.upcoming?.days ?? req?.remainingDays ?? null;
  const first = months[0]; const second = months[1];
  const share = (m) => (fin(m.planned) ? `${((m.planned / T) * 100).toFixed(1)}%` : '—');
  const monthSub = (m) => (m.partial ? bi(`شهر جزئي: ${m.days} من ${m.monthDays} يوماً · ${share(m)} من المستهدف`, `Partial month: ${m.days} of ${m.monthDays} days · ${share(m)} of the target`) : bi(`شهر كامل · ${share(m)} من المستهدف`, `Whole month · ${share(m)} of the target`));
  const monthLabel = (m) => { const r = monthRangeLabel(m); const n = monthName(m.ym); return bi(`المخطط لشهر ${n.ar}${m.partial ? ` (${r.ar})` : ''}`, `Planned for ${n.en}${m.partial ? ` (${r.en})` : ''}`); };
  const out = [
    { id: 'target', label: derived ? bi('المستهدف للفترة المتبقية', 'Target for the remaining period') : bi('المستهدف', 'Target'), value: T, sub: bi(days != null ? `${days} يوماً: ${fmtDateText(basis.period.start, 'ar')} – ${fmtDateText(basis.period.end, 'ar')}` : `${fmtDateText(basis.period.start, 'ar')} – ${fmtDateText(basis.period.end, 'ar')}`, days != null ? `${days} days: ${fmtDateText(basis.period.start, 'en')} – ${fmtDateText(basis.period.end, 'en')}` : `${fmtDateText(basis.period.start, 'en')} – ${fmtDateText(basis.period.end, 'en')}`) },
    { id: 'first', label: monthLabel(first), value: fin(first.planned) ? first.planned : null, sub: monthSub(first), ym: first.ym }
  ];
  if (months.length === 2 && second) out.push({ id: 'second', label: monthLabel(second), value: fin(second.planned) ? second.planned : null, sub: monthSub(second), ym: second.ym });
  else if (req?.state === 'ok') out.push({ id: 'monthly', label: bi('المتوسط الشهري المطلوب', 'Required monthly average'), value: req.monthly, sub: bi(`المستهدف ÷ ${req.remainingMonths.toFixed(1)} شهراً (بالأيام)`, `Target ÷ ${req.remainingMonths.toFixed(1)} months (by days)`) });
  if (req?.state === 'ok') out.push({ id: 'daily', label: bi('متوسط التحصيل اليومي المطلوب', 'Required average daily collection'), value: req.daily, sub: bi(`المستهدف ÷ ${req.remainingDays} يوماً`, `Target ÷ ${req.remainingDays} days`) });
  return out;
}
