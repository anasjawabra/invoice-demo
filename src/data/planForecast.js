// THE FORECAST ENGINE (planning review 0c / 0d) — ONE explainable baseline for every surface: the planning page, the Decision Room, Smart Reports, the assistant and the fixed reports.
//   method id  runrate3_v2   (D-05)
//   baseline   = the average monthly receipts of the last THREE COMPLETE months (a partial month is never a data point) carried forward:
//                forecast = received to the cut-off + the average × (the days of the current month still to come ÷ the days of that month) + the average × the whole months after it.
//   assumptions are printed with the result: no seasonality, no recovery of overdue balances, no benefit credited to any action, the target is not an input.
//   NOT aligned with the forecasting teams' methodology (D-05, coordination pending): said on every surface.
// A PROBABILITY of reaching the target is NOT produced (D-09): the history cannot validate one (22 complete months of illustrative data, no target history, no load date). The result carries
// `probabilityStatus: 'unsupported'` and the message «لا تتوفر بيانات كافية لتقدير احتمالية موثوقة». There is no `probability` field, no clamp, no verdict colour.
// "Maximum possible"/«billing is insufficient» are gone: receivables + future billing is not a maximum collectible. Pure functions, no I/O.
import { fmtMoney } from '../utils/money';
import { addDays } from './plans/planMath';
import { daysInMonth } from './planningBasis';
import { lastCompleteMonthBefore, remainingOf, PLAN_STATE_TEXT, planMonthLabel, UPCOMING_FORECAST_MAX_GAP_DAYS } from './plans/planBasis';

const bi = (ar, en) => ({ ar, en });
export const FORECAST_METHOD_ID = 'runrate3_v2';
export const FORECAST_WINDOW_MONTHS = 3;
export const FORECAST_ALIGNMENT = bi('غير مُواءَم مع منهجية فرق التوقع — قيد التنسيق', 'Not aligned with the forecasting teams’ methodology — coordination pending');
export const FORECAST_METHOD_LABEL = bi('متوسط التحصيل الشهري لآخر 3 أشهر مكتملة (خط أساس توضيحي)', 'Average monthly receipts of the last 3 complete months (illustrative baseline)');
export const PROBABILITY_MESSAGE = bi('لا تتوفر بيانات كافية لتقدير احتمالية موثوقة', 'Not enough data to estimate a reliable probability');
export const PROBABILITY_REASON = bi('السبب: السجل المكتمل أقل من 36 شهرًا، ولا سجل لمستهدفات سابقة معتمدة، ولا تاريخ تحميل للمدفوعات يتيح اختبار التوقع على ما كان معروفًا في كل تاريخ.', 'Reason: fewer than 36 complete months of history, no record of earlier approved targets, and no load date on payments to test the forecast on what was known at each date.');

const mean = (a) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0);

/** the baseline rate: the mean of the last `n` COMPLETE months (values oldest → newest); null when fewer than `n` are available */
export function baselineRate(completeValues, n = FORECAST_WINDOW_MONTHS) {
  const w = (completeValues || []).slice(-n);
  return w.length >= n ? mean(w) : null;
}
/** the share of the cut-off month still to come (calendar days: 6 Nov → 24/30); 0 on a month end */
export function restOfMonthFraction(asOf) {
  const y = Number(asOf.slice(0, 4)); const m = Number(asOf.slice(5, 7)); const d = Number(asOf.slice(8, 10)); const dim = daysInMonth(y, m);
  return { days: dim - d, dim, fraction: (dim - d) / dim };
}

const methodOf = (window) => ({ id: FORECAST_METHOD_ID, label: FORECAST_METHOD_LABEL, window, alignment: FORECAST_ALIGNMENT });

/* =====================================================================================================================================================================================
   PLAN FORECAST (revenue plans, spec §5) — the ONLY forecast of a plan (the former fiscal-year-only forecast was retired in the cleanup phase).
   forecastPlan(basis, { history, now }) → the RECENT-RUN-RATE outlook of ONE plan version over ANY period:
     forecast total = actual collected through the cut-off (the partial month counted ONCE, inside the actual) + rate × Σ over the days AFTER the cut-off up to the period end (per calendar month: remaining days ÷ month days)
     rate           = the mean of the last THREE COMPLETE OBSERVED calendar months; a null / missing month is excluded (never zero); fewer than three → `insufficient_history`, no percentage.
     the window may END before the cut-off and may START before the period (history is calendar data, not period data).
   `history` = what `loadPlanInputsForPlan` returned in `.history`: { planId, versionId, scopeKey, period, cutoff, months: [{ ym, value: number|null }] } — checked against the basis:
     planId / versionId / scopeKey / period differ → `incompatible_input`; only the cut-off differs → `stale_input`; (a history array with no identity cannot be verified → `incompatible_input`). No number is produced in either case.
   Expected achievement = forecast total ÷ the FULL-period target, never capped (can exceed 100 %), labelled EXPECTED_ACHIEVEMENT_LABEL, never a probability. No `probability` field.
   UPCOMING PERIOD (basis.state 'future_period'): the SAME recent run-rate is carried over the whole period when the inputs support it — the period starts within UPCOMING_FORECAST_MAX_GAP_DAYS (31) days after the last data date and the last
     three complete observed months before that data date exist. forecastTotal = rate × Σ(period days ÷ month days) — NO collections are added (nothing is collected inside the period yet, and the baseline of a derived plan is another period),
     `upcoming:true`, `actualToDate:null`, `reportingCutoff` = the data date it is read at; the history must carry the same plan id / version / scope / period and the same data date (else incompatible_input / stale_input, no number).
     A period starting later → state 'future_period' with ONE explanation (reason 'upcoming_unsupported'); never a copied figure of another plan or period. It is a forecast, distinct from the target and from the planned schedule.
   ================================================================================================================================================================================== */
export const EXPECTED_ACHIEVEMENT_LABEL = bi('نسبة تحقيق المستهدف المتوقعة بنهاية الفترة', 'Expected target achievement by the end of the period');
export const EXPECTED_GAP_LABELS = { shortfall: bi('فجوة متوقعة عن المستهدف', 'Expected shortfall against the target'), surplus: bi('فائض متوقع فوق المستهدف', 'Expected surplus above the target'), none: bi('لا فجوة متوقعة', 'No expected gap') };
const probabilityNote = () => ({ probabilityStatus: 'unsupported', probabilityMessage: PROBABILITY_MESSAGE });
const fin2 = (v) => typeof v === 'number' && Number.isFinite(v);
const sameRange2 = (a, b) => !!a && !!b && a.start === b.start && a.end === b.end;

export function forecastPlan(basis, { history = null, now = null } = {}) {
  const generatedAt = (now instanceof Date ? now : now ? new Date(now) : new Date()).toISOString();
  const b = basis || {};
  const T = b.target?.value > 0 ? b.target.value : null;
  const req = b.pace?.required ?? null;
  const empty = (state, message = null, extra = {}) => ({
    state, message: message || PLAN_STATE_TEXT[state] || null, planId: b.planId ?? null, versionId: b.versionId ?? null, scopeKey: b.scopeKey ?? null, period: b.period ?? null,
    reportingCutoff: b.reportingCutoff ?? null, latestActualDataDate: b.latestActualDataDate ?? null, lastCompleteMonth: null, forecastGeneratedAt: generatedAt,
    target: T, actualToDate: null, plannedToDate: null, forecastTotal: null, expectedAchievementPct: null, expectedAchievementLabel: EXPECTED_ACHIEVEMENT_LABEL, gap: null, gapKind: null, gapLabel: null,
    expectedRemaining: null, monthlyRate: null, remaining: null, required: req, requiredVsRate: null, bridge: null, cumulative: null, outcome: null, assumptions: [], method: methodOf(null), ...probabilityNote(), ...extra
  });
  if (!basis) return empty('no_data');
  const st = b.state;
  if (st === 'completed') return empty('completed', null, { actualToDate: b.actualToDate, plannedToDate: b.plannedToDate, outcome: b.outcome, expectedAchievementPct: null });
  if (st === 'future_period') return upcomingForecast(b, history, generatedAt, empty);
  // a municipality WITHOUT an allocation: the target-independent outlook (collections + run-rate) is still produced; every target-dependent figure stays null (reason 'no_municipal_target')
  const noMuniTarget = st === 'no_municipal_target';
  if (st !== 'ok' && !noMuniTarget) return empty(st, null, { reason: b.reason ?? null });
  if (noMuniTarget && b.reportingCutoff && b.period && b.reportingCutoff >= b.period.end) return empty('completed', null, { actualToDate: b.actualToDate, reason: 'no_municipal_target' });

  // ---- the input must belong to this basis
  const idOk = history && !Array.isArray(history) && history.planId === b.planId && history.versionId === b.versionId && history.scopeKey === b.scopeKey && sameRange2(history.period, b.period);
  if (!history || Array.isArray(history) || !Array.isArray(history.months)) return empty('incompatible_input', null, { reason: 'history_unlabelled' });
  if (!idOk) return empty('incompatible_input', null, { reason: 'input_mismatch' });
  if (history.cutoff !== b.reportingCutoff) return empty('stale_input', null, { reason: 'cutoff_mismatch' });

  const C = b.actualToDate; const P = b.plannedToDate;
  if (noMuniTarget && !fin2(C)) return empty('no_data', null, { reason: 'actual_not_loaded' });
  const common = { target: T, actualToDate: C, plannedToDate: P, aboveTarget: T ? C >= T : null };

  // ---- the window: the last three complete OBSERVED months on or before the last complete month of the cut-off (a null month is not a data point)
  const candidate = lastCompleteMonthBefore(b.reportingCutoff);
  const seen = new Map();
  for (const x of history.months) if (x && typeof x.ym === 'string' && candidate && x.ym <= candidate && fin2(x.value) && x.value >= 0) seen.set(x.ym, x.value);
  const pool = [...seen.entries()].sort((a, c) => (a[0] < c[0] ? -1 : 1)).map(([ym, value]) => ({ ym, value }));
  if (pool.length < FORECAST_WINDOW_MONTHS) {
    return empty('insufficient_history', bi(`لا يكفي سجل لخط الأساس: المتاح ${pool.length} من ${FORECAST_WINDOW_MONTHS} أشهر مكتملة مرصودة — لا يُستخرج تقدير من شهر ناقص ولا يُعدّ الشهر الناقص صفرًا`, `Not enough history for the baseline: ${pool.length} of ${FORECAST_WINDOW_MONTHS} complete observed months — no estimate is extrapolated from a partial month and a missing month is never treated as zero`), { ...common, remaining: remainingOf(basisRows(b), b.reportingCutoff), available: pool.length, needed: FORECAST_WINDOW_MONTHS });
  }
  const win = pool.slice(-FORECAST_WINDOW_MONTHS); const months = win.map((x) => x.ym); const rate = mean(win.map((x) => x.value));
  const a = planMonthLabel(months[0]); const z = planMonthLabel(months[2]);
  const window = { months, count: FORECAST_WINDOW_MONTHS, endsBeforeCutoff: lastDay(months[2]) < b.reportingCutoff, startsBeforePeriod: `${months[0]}-01` < b.period.start, label: bi(`آخر 3 أشهر مكتملة: ${a.ar} – ${z.ar}`, `Last 3 complete months: ${a.en} – ${z.en}`) };

  const rem = remainingOf(basisRows(b), b.reportingCutoff);
  const expectedRemaining = rate * rem.months; const F = C + expectedRemaining;
  const gap = T ? T - F : null; const gapKind = gap == null ? null : gap > 0 ? 'shortfall' : gap < 0 ? 'surplus' : 'none';
  const bridge = T ? { behindAtCutoff: P - C, uncoveredRemainingPlan: (T - P) - (F - C), gap } : null;
  // the forecast path by month end (null for the months already complete at the cut-off): the cut-off month closes at C + its remaining days at the rate; every later month adds its share
  let run = C; const rows = b.months || [];
  const cumulative = rows.map((r, i) => { if (r.complete) return null; run += rate * rem.byMonth[i].fraction; return run; });
  const wl = window.label;
  const assumptions = [
    bi(`الأساس: متوسط التحصيل الشهري لآخر 3 أشهر مكتملة مرصودة (${wl.ar.replace('آخر 3 أشهر مكتملة: ', '')}) = ${fmtMoney(rate, { lang: 'ar' })}، ويستمر بلا تغيير.`, `Baseline: the average monthly collections of the last 3 complete observed months (${wl.en.replace('Last 3 complete months: ', '')}) = ${fmtMoney(rate, { lang: 'en' })}, continuing unchanged.`),
    bi(`المتبقي من الفترة ${rem.days} يومًا بعد ${b.reportingCutoff}، ويُحتسب لكل شهر بنسبة أيامه المتبقية إلى أيام الشهر (المكافئ ${rem.months.toFixed(3)} شهر)؛ والمحصّل حتى تاريخ الإغلاق بما فيه الشهر غير المكتمل يُحتسب مرة واحدة.`, `${rem.days} days of the period remain after ${b.reportingCutoff}, taken per month as remaining days ÷ days in the month (${rem.months.toFixed(3)} months); the collections to the cut-off, including the partial month, are counted once.`),
    bi('الشهر الناقص أو غير المرصود لا يُحتسب صفرًا ولا يدخل في المتوسط؛ وقد تسبق نافذة الأساس تاريخ الإغلاق أو بداية الفترة.', 'A missing or unobserved month is never counted as zero and is not in the average; the baseline window may end before the cut-off or start before the period.'),
    bi('لا موسمية، ولا استرداد لأرصدة متأخرة، ولا أثر لأي إجراء تحصيل مفترض؛ والمستهدف لا يدخل في حساب التقدير.', 'No seasonality, no recovery of overdue balances, no benefit credited to any collection action; the target is not an input of the estimate.'),
    bi('هذا خط أساس توضيحي (وتيرة حديثة) وليس نموذجًا معتمدًا ولا نطاق ثقة له، وليس احتمالًا.', 'This is an illustrative baseline (a recent run-rate), not an approved model: it has no confidence range and is not a probability.')
  ];
  return {
    state: 'ok', message: null, planId: b.planId, versionId: b.versionId, scopeKey: b.scopeKey, period: b.period,
    reportingCutoff: b.reportingCutoff, latestActualDataDate: b.latestActualDataDate, lastCompleteMonth: months[2], forecastGeneratedAt: generatedAt,
    ...common, forecastTotal: F, expectedAchievementPct: T ? F / T : null, expectedAchievementLabel: EXPECTED_ACHIEVEMENT_LABEL, gap, gapKind, gapLabel: gapKind ? EXPECTED_GAP_LABELS[gapKind] : null,
    ...(T ? {} : { targetState: 'no_municipal_target', reason: 'no_municipal_target', targetMessage: PLAN_STATE_TEXT.no_municipal_target }),
    expectedRemaining, monthlyRate: rate, remaining: rem, required: req, requiredVsRate: req?.state === 'ok' && rate > 0 ? req.monthly / rate : null, bridge, cumulative, outcome: null, assumptions, method: methodOf(window), ...probabilityNote()
  };
}

/* ---- the UPCOMING period forecast ---------------------------------------------------------------------------------------------------------------------------------------------------- */
export const UPCOMING_UNSUPPORTED = {
  too_far: (gap) => bi(`لا يُقدَّر توقع لهذه الخطة بعد: تبدأ الفترة بعد ${gap} يوماً من آخر بيانات فعلية، وهو أبعد من ${UPCOMING_FORECAST_MAX_GAP_DAYS} يوماً الذي يُمدَّد فيه متوسط آخر 3 أشهر مكتملة. يظهر التوقع تلقائياً حين تقترب الفترة أو تبدأ.`, `No forecast can be estimated for this plan yet: the period starts ${gap} days after the last actual data, beyond the ${UPCOMING_FORECAST_MAX_GAP_DAYS} days over which the average of the last 3 complete months is carried forward. The forecast appears automatically when the period gets closer or starts.`),
  no_data_date: () => bi('لا تاريخ بيانات فعلية لتقدير التوقع.', 'There is no actual-data date to estimate the forecast from.'),
  not_upcoming: () => bi('الفترة بدأت: يُحسب التوقع بالطريقة المعتادة.', 'The period has started: the forecast uses the usual method.')
};
function upcomingForecast(b, history, generatedAt, empty) {
  const T = b.target?.value > 0 ? b.target.value : null; const up = b.upcoming || {}; const asOf = up.asOf || null;
  const base = { reportingCutoff: asOf, upcoming: true, upcomingSupport: up.support || null };
  if (!T) return empty('future_period', null, { ...base, reason: 'no_target' });
  const sup = up.support || { supported: false, gapDays: null, reason: 'no_data_date' };
  if (!sup.supported) return empty('future_period', (UPCOMING_UNSUPPORTED[sup.reason] || UPCOMING_UNSUPPORTED.no_data_date)(sup.gapDays), { ...base, reason: 'upcoming_unsupported' });
  const idOk = history && !Array.isArray(history) && history.planId === b.planId && history.versionId === b.versionId && history.scopeKey === b.scopeKey && sameRange2(history.period, b.period);
  if (!history || Array.isArray(history) || !Array.isArray(history.months)) return empty('incompatible_input', null, { ...base, reason: 'history_unlabelled' });
  if (!idOk) return empty('incompatible_input', null, { ...base, reason: 'input_mismatch' });
  if (history.cutoff !== asOf) return empty('stale_input', null, { ...base, reason: 'cutoff_mismatch' });
  const candidate = lastCompleteMonthBefore(asOf);
  const seen = new Map();
  for (const x of history.months) if (x && typeof x.ym === 'string' && candidate && x.ym <= candidate && fin2(x.value) && x.value >= 0) seen.set(x.ym, x.value);
  const pool = [...seen.entries()].sort((a, c) => (a[0] < c[0] ? -1 : 1)).map(([ym, value]) => ({ ym, value }));
  if (pool.length < FORECAST_WINDOW_MONTHS) {
    return empty('insufficient_history', bi(`لا يكفي سجل لخط الأساس: المتاح ${pool.length} من ${FORECAST_WINDOW_MONTHS} أشهر مكتملة مرصودة — لا يُعدّ الشهر الناقص صفرًا`, `Not enough history for the baseline: ${pool.length} of ${FORECAST_WINDOW_MONTHS} complete observed months — a missing month is never treated as zero`), { ...base, available: pool.length, needed: FORECAST_WINDOW_MONTHS });
  }
  const win = pool.slice(-FORECAST_WINDOW_MONTHS); const months = win.map((x) => x.ym); const rate = mean(win.map((x) => x.value));
  const a = planMonthLabel(months[0]); const z = planMonthLabel(months[2]);
  const window = { months, count: FORECAST_WINDOW_MONTHS, endsBeforeCutoff: lastDay(months[2]) < asOf, startsBeforePeriod: `${months[0]}-01` < b.period.start, label: bi(`آخر 3 أشهر مكتملة: ${a.ar} – ${z.ar}`, `Last 3 complete months: ${a.en} – ${z.en}`) };
  const rem = b.remaining || remainingOf(basisRows(b), addDays(b.period.start, -1));
  const F = rate * rem.months; const gap = T - F; const gapKind = gap > 0 ? 'shortfall' : gap < 0 ? 'surplus' : 'none';
  let run = 0; const cumulative = (b.months || []).map((r, i) => { run += rate * rem.byMonth[i].fraction; return run; });
  const wl = window.label; const req = b.pace?.required ?? null;
  const assumptions = [
    bi(`الأساس: متوسط التحصيل الشهري لآخر 3 أشهر مكتملة مرصودة قبل ${asOf} (${wl.ar.replace('آخر 3 أشهر مكتملة: ', '')}) = ${fmtMoney(rate, { lang: 'ar' })}، ويستمر بلا تغيير طوال الفترة.`, `Baseline: the average monthly collections of the last 3 complete observed months before ${asOf} (${wl.en.replace('Last 3 complete months: ', '')}) = ${fmtMoney(rate, { lang: 'en' })}, continuing unchanged through the period.`),
    bi(`المتوقع للفترة = الوتيرة × (أيام كل شهر في الفترة ÷ أيام الشهر) = ${rem.months.toFixed(3)} شهر لـ ${rem.days} يوماً؛ لا يدخل فيه أي تحصيل سابق لبداية الفترة (الأساس المجمّد فترة أخرى).`, `Expected for the period = the rate × (the period's days of each month ÷ the days of that month) = ${rem.months.toFixed(3)} months for ${rem.days} days; no collection before the period start is included (a frozen baseline is another period).`),
    bi('لا موسمية، ولا استرداد لأرصدة متأخرة، ولا أثر لأي إجراء تحصيل مفترض؛ والمستهدف والجدول الشهري لا يدخلان في حساب التقدير.', 'No seasonality, no recovery of overdue balances, no benefit credited to any collection action; neither the target nor the monthly schedule is an input of the estimate.'),
    bi('هذا خط أساس توضيحي (وتيرة حديثة) وليس نموذجًا معتمدًا ولا نطاق ثقة له، وليس احتمالًا، وليس المستهدف ولا الجدول المخطط.', 'This is an illustrative baseline (a recent run-rate), not an approved model: it has no confidence range, is not a probability, and is neither the target nor the planned schedule.')
  ];
  return {
    state: 'ok', message: null, upcoming: true, upcomingSupport: sup, planId: b.planId, versionId: b.versionId, scopeKey: b.scopeKey, period: b.period,
    reportingCutoff: asOf, latestActualDataDate: b.latestActualDataDate, lastCompleteMonth: months[2], forecastGeneratedAt: generatedAt,
    target: T, actualToDate: null, plannedToDate: null, aboveTarget: null, forecastTotal: F, expectedAchievementPct: F / T, expectedAchievementLabel: EXPECTED_ACHIEVEMENT_LABEL, gap, gapKind, gapLabel: EXPECTED_GAP_LABELS[gapKind],
    expectedRemaining: F, monthlyRate: rate, remaining: rem, required: req, requiredVsRate: req?.state === 'ok' && rate > 0 ? req.monthly / rate : null, bridge: null, cumulative, outcome: null, assumptions, method: methodOf(window), ...probabilityNote()
  };
}
// the month rows of the basis in the shape `remainingOf` reads
const basisRows = (b) => (b.months || []).map((m) => ({ ym: m.ym, start: m.start, end: m.end, days: m.days, monthDays: m.monthDays }));
const lastDay = (ym) => { const y = Number(ym.slice(0, 4)); const m = Number(ym.slice(5, 7)); return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
