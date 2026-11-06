// PLAN MEASURES — the ONE headline set of a plan (spec §5): the summary of the plan page and every row of the plans list read THIS and nothing else.
// planMeasures(basis, forecast) is pure. Every figure is explicit: null + a reason, never a silent 0. There is NO status / tolerance / «on plan, ahead, behind» classification.
//   target             the FULL-period target (a restricted viewer: Σ of the visible allocations, labelled «إجمالي الجهات المتاحة لك»)
//   actual             collections from the period start through the cut-off (null = no data, which is not 0)
//   achievementToDate  actual ÷ the full-period target — uncapped (> 1 allowed)
//   plannedToDate      the plan up to the cut-off (closed months in full, the cut-off month by its period days)
//   vsPlanRatio        actual ÷ plannedToDate («نسبة الإنجاز مقابل المخطط»); null + vsPlanReason when planned is 0
//   deviation          { amount (signed: actual − planned), pct (tooltip / detail only), unavailable }
//   expected           { state, amount (forecast full-period collections), pct (÷ the full-period target, uncapped), gap (shortfall > 0 / surplus < 0), gapKind, gapLabel, label, unavailable }
//   final              completed period only: { achieved, amount, pct, label } — the final achievement
//   upcoming           (period not started) { asOf (the data date), daysToStart, days, months (by days), support:{supported,gapDays,reason} } — the required pace is in requiredPace (daily = target ÷ days, monthly = target ÷ months by days)
//   dates              reportingCutoff (an UPCOMING period's forecast: the data date it is read at) · latestActualDataDate · lastCompleteMonth · forecastGeneratedAt (four distinct dates)
//   states / reasons   basis.state, forecast.state and the printed reasons
//   viewScope          { amanah, muni } the VIEW filter the numbers were computed for (never part of the plan) · viewLabel {ar,en}|null · municipalState (null | 'distributed' | 'not_distributed' | 'allocated' | 'no_municipal_target') · municipal (the municipal side summary)
//   no_municipal_target  a municipality with no explicit allocation: target null, every target-dependent measure null + reason 'no_municipal_target', actual (and expected.amount) still present
import { PLAN_STATE_TEXT } from './planBasis';

const bi = (ar, en) => ({ ar, en });
const EXPECTED_STATE_REASON = {
  insufficient_history: PLAN_STATE_TEXT.insufficient_history, future_period: PLAN_STATE_TEXT.future_period, completed: bi('انتهت الفترة: لا توقع بل نتيجة نهائية', 'The period has ended: a final result, not a forecast'),
  no_municipal_target: PLAN_STATE_TEXT.no_municipal_target, invalid_view_scope: PLAN_STATE_TEXT.invalid_view_scope,
  no_target: PLAN_STATE_TEXT.no_target, no_data: PLAN_STATE_TEXT.no_data, incompatible_input: PLAN_STATE_TEXT.incompatible_input, stale_input: PLAN_STATE_TEXT.stale_input, invalid_period: PLAN_STATE_TEXT.invalid_period
};

export function planMeasures(basis, forecast = null) {
  const b = basis || {}; const f = forecast || null;
  const calc = b.state === 'ok' || b.state === 'completed' || b.state === 'no_data' || b.state === 'no_municipal_target';
  const T = b.target?.value ?? null;
  const fState = f ? f.state : b.state === 'ok' ? 'not_run' : b.state || 'no_data';
  const expected = f && f.state === 'ok'
    ? { state: 'ok', amount: f.forecastTotal, pct: f.expectedAchievementPct, gap: f.gap, gapKind: f.gapKind, gapLabel: f.gapLabel, label: f.expectedAchievementLabel, unavailable: null, pctUnavailable: f.expectedAchievementPct == null ? (f.targetState || 'no_target') : null, monthlyRate: f.monthlyRate, window: f.method?.window ?? null }
    : { state: fState, amount: null, pct: null, gap: null, gapKind: null, gapLabel: null, label: f?.expectedAchievementLabel ?? null, unavailable: fState, pctUnavailable: fState, monthlyRate: null, window: null };
  const reasons = [];
  const push = (code, m) => { if (m) reasons.push({ code, ar: m.ar, en: m.en }); };
  if (b.state && b.state !== 'ok') push(b.state, PLAN_STATE_TEXT[b.state]);
  if (expected.state === 'ok' && expected.pctUnavailable === 'no_municipal_target' && b.state !== 'no_municipal_target') push('no_municipal_target', PLAN_STATE_TEXT.no_municipal_target);
  if (expected.state !== 'ok' && expected.state !== 'not_run' && expected.state !== b.state) push(expected.state, f?.message || EXPECTED_STATE_REASON[expected.state]);
  if (b.vsPlanReason === 'planned_zero') push('planned_zero', bi('المخطط حتى تاريخه صفر: لا نسبة إنجاز مقابل المخطط', 'Planned to date is zero: no ratio against plan'));
  return {
    planId: b.planId ?? null, versionId: b.versionId ?? null, name: b.name ?? null, period: b.period ?? null, scopeKey: b.scopeKey ?? null, restricted: !!b.restricted, scopeLabel: b.scopeLabel ?? null,
    viewScope: b.viewScope ?? { amanah: 'all', muni: 'all' }, viewLabel: b.viewLabel ?? null, municipalState: b.municipalState ?? null, municipal: b.municipal ?? null,
    state: b.state ?? 'no_data', forecastState: fState, calculable: calc,
    target: T, actual: b.actualToDate ?? null, achievementToDate: b.achievementToDate ?? null, plannedToDate: b.plannedToDate ?? null,
    vsPlanRatio: b.vsPlanRatio ?? null, vsPlanReason: b.vsPlanReason ?? null, deviation: b.deviation ? { amount: b.deviation.amount, pct: b.deviation.pct, unavailable: b.deviation.unavailable } : { amount: null, pct: null, unavailable: 'no_plan' },
    expected, final: b.state === 'completed' && b.outcome ? b.outcome : null,
    requiredPace: b.pace?.required ?? null, upcoming: b.upcoming ?? null, // upcoming: { asOf, daysToStart, days, months, support } while the period has not started
    dates: { reportingCutoff: b.reportingCutoff ?? (f && f.state === 'ok' && f.upcoming ? f.reportingCutoff : null), latestActualDataDate: b.latestActualDataDate ?? null, lastCompleteMonth: f && f.state === 'ok' ? f.lastCompleteMonth : (b.lastCompleteMonth ?? null), forecastGeneratedAt: f?.forecastGeneratedAt ?? null },
    flags: b.flags ?? null, reasons
  };
}
