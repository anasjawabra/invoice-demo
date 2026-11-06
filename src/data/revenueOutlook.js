// ============================================================================
// Revenue outlook — keeps THREE concepts strictly apart:
//
//   1. The annual revenue target (an INPUT: the target of the CONFIGURED REFERENCE PLAN, `targets.collectionAmountAnnual` — src/data/referenceTarget.js; its source plan + version travel in `targets.reference`;
//      a missing / ambiguous / invalid reference is an UNAVAILABLE target (null), never 0)
//   2. Independent data-based forecast (computed here from receipts history only;
//      it never looks at the target and is never nudged toward it)
//   3. User-defined intervention scenario (what-if deltas applied ON TOP of the
//      independent forecast; stored and shown separately)
//
// ONE forecast engine for every surface (planning review 0d, D-05): the same baseline as the planning page (`runrate3_v2`, planForecast.js) — the average monthly receipts of the
// last THREE COMPLETE months (a partial month is never a data point), carried over the REST of the cut-off month (by days) and the months after it. No trend line, no seasonality,
// no probability and no confidence range (a range from a handful of points is not a validated interval). The method id and window are shown; the method is NOT aligned with the
// forecasting teams' methodology (coordination pending). The backtest below is a small-sample rolling-origin check of this same baseline, not a guarantee.
// ============================================================================
import { monthsBetween, normalizeConfig, normalizeScope, DEFAULT_TARGETS, monthlyTargetSeries, cumulativeTargetToDate } from './revenueMetrics';
import { addDays, monthOf, DATA_CUTOFF } from './revenueLedger';
import { baselineRate, restOfMonthFraction, FORECAST_METHOD_ID, FORECAST_WINDOW_MONTHS, FORECAST_ALIGNMENT, FORECAST_METHOD_LABEL } from './planForecast';
import { isMonthEnd } from './planningBasis';
import { targetSourceText, targetUnavailableText, targetCoversScope } from './referenceTarget';

const bi = (ar, en) => ({ ar, en });

// first day of the month `n` months before the given date (the demo intervention is dated relative to today)
function addMonthsFrom(date, n) { let y = Number(date.slice(0, 4)); let m = Number(date.slice(5, 7)) + n; while (m < 1) { m += 12; y -= 1; } while (m > 12) { m -= 12; y += 1; } return `${y}-${String(m).padStart(2, '0')}-01`; }

export const FORECAST_METHOD = {
  id: FORECAST_METHOD_ID,
  label: FORECAST_METHOD_LABEL,
  windowMonths: FORECAST_WINDOW_MONTHS, // the baseline window (complete months)
  historyMonths: 12, // the trailing months read for the check and the exceptional-payment screen
  minPoints: FORECAST_WINDOW_MONTHS,
  alignment: FORECAST_ALIGNMENT
};

const median = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// A payment is "exceptional" when it is large relative to the typical single payment (median of all
// payments in the history) AND is a large share of its own month, so one-off payments cannot silently
// drive a baseline. Thresholds are configuration, not statistical truth.
export function detectExceptionalPayments(months, values, payments, { monthShare = 0.35, typicalMultiple = 2.5, typicalPayment: typicalIn = null } = {}) {
  const typicalPayment = typicalIn != null ? typicalIn : median(payments.map((p) => p.amount));
  const byMonth = new Map(months.map((m, i) => [m, values[i]]));
  return payments
    .filter((p) => {
      const mv = byMonth.get(monthOf(p.date)) || 0;
      return mv > 0 && typicalPayment > 0 && p.amount >= typicalPayment * typicalMultiple && p.amount / mv >= monthShare;
    })
    .map((p) => ({ invoiceId: p.invoiceId, date: p.date, month: monthOf(p.date), amount: p.amount, shareOfMonth: p.amount / (byMonth.get(monthOf(p.date)) || 1), typicalPayment }));
}

// rolling-origin check of the SAME baseline on the complete months: predict month k by the mean of the 3 months before it
export function backtestRunRate(series, minTrain = 3) {
  const apes = [];
  const aes = [];
  for (let k = minTrain; k < series.length; k += 1) {
    const pred = baselineRate(series.slice(0, k));
    if (pred == null) continue;
    aes.push(Math.abs(series[k] - pred));
    if (series[k] > 0) apes.push(Math.abs(series[k] - pred) / series[k]);
  }
  if (aes.length < 3) return null;
  return {
    n: aes.length,
    mae: aes.reduce((a, b) => a + b, 0) / aes.length,
    mape: apes.length >= 3 ? apes.reduce((a, b) => a + b, 0) / apes.length : null,
    method: 'rolling_origin_runrate3'
  };
}

// Pure forecast over series the data service computed: `hist` = monthly receipts over the trailing window, `fy` = fiscal-year-to-date receipts.
export async function forecastReceipts(data, scopeIn = {}, cfgIn = {}, opts = {}) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scopeIn, cfg);
  const targets = opts.targets || DEFAULT_TARGETS;
  const cutoffMonth = cfg.cutoff.slice(0, 7);
  const histFrom = `${addMonthsStr(cutoffMonth, -(FORECAST_METHOD.historyMonths - 1))}-01`;
  const [hist, fy] = await Promise.all([
    data.series({ ...sc, from: histFrom, to: cfg.cutoff }, { asOf: cfg.cutoff }),
    data.series({ ...sc, from: `${targets.fiscalYear}-01-01`, to: cfg.cutoff }, { asOf: cfg.cutoff })
  ]);
  return forecastCore({ hist, fyValues: fy.values, cfg, sc, ...opts, targets });
}

export function forecastCore({ hist, fyValues, cfg, sc, horizonMonths, targets = DEFAULT_TARGETS, excludeExceptional = false }) {
  const cutoffMonth = cfg.cutoff.slice(0, 7);
  const partial = !isMonthEnd(cfg.cutoff); // the cut-off month is a data point only once it is complete
  const exceptionalAll = detectExceptionalPayments(hist.months, hist.values, hist.payments, { typicalPayment: hist.typicalPayment });
  const exceptionalByMonth = new Map();
  for (const e of exceptionalAll) exceptionalByMonth.set(e.month, (exceptionalByMonth.get(e.month) || 0) + e.amount);
  const adjusted = hist.values.map((v, i) => (excludeExceptional ? v - (exceptionalByMonth.get(hist.months[i]) || 0) : v));
  // COMPLETE months only: the fit never sees the part of the cut-off month that has elapsed
  const completeIdx = hist.months.map((m, i) => i).filter((i) => !partial || hist.months[i] < cutoffMonth);
  const completeMonths = completeIdx.map((i) => hist.months[i]); const completeValues = completeIdx.map((i) => adjusted[i]);

  const rate = baselineRate(completeValues);
  const ready = rate != null;
  const rest = partial ? restOfMonthFraction(cfg.cutoff) : { days: 0, dim: 0, fraction: 0 };

  const fiscalEnd = `${targets.fiscalYear}-12`;
  const startMonth = partial ? cutoffMonth : addMonthsStr(cutoffMonth, 1); // forecast from the cut-off DAY: the rest of the cut-off month is part of the horizon
  const all = startMonth <= fiscalEnd ? monthsBetween(`${startMonth}-01`, `${fiscalEnd}-28`) : [];
  const horizon = horizonMonths ? all.slice(0, horizonMonths) : all;
  const point = [];
  if (ready) horizon.forEach((mo) => point.push(partial && mo === cutoffMonth ? rate * rest.fraction : rate));
  const backtest = ready ? backtestRunRate(completeValues) : null;

  const ytd = fyValues.reduce((s, v) => s + v, 0);
  const remainderPoint = point.reduce((s, v) => s + v, 0);
  const win = completeMonths.slice(-FORECAST_METHOD.windowMonths);
  const method = { ...FORECAST_METHOD, window: { months: win, count: FORECAST_METHOD.windowMonths } };

  return {
    method,
    ready,
    reasonNotReady: ready ? null : { en: `At least ${FORECAST_METHOD.minPoints} complete months of receipts history are needed; ${completeValues.length} available in scope. A partial month is never extrapolated.`, ar: `يلزم ${FORECAST_METHOD.minPoints} أشهر مكتملة على الأقل من سجل الإيرادات المحصلة؛ المتاح ${completeValues.length} في النطاق. ولا يُستخرج تقدير من شهر ناقص.` },
    cutoff: cfg.cutoff,
    scope: sc,
    history: { months: hist.months, values: hist.values, adjusted, completeMonths, completeValues },
    // `exceptional` lists the payments REMOVED from the baseline (none by default, so the baseline equals the planning page's); `exceptionalDetected` lists the large one-off payments the screen found either way
    exceptional: excludeExceptional ? exceptionalAll : [],
    exceptionalDetected: exceptionalAll,
    excludedExceptional: excludeExceptional,
    horizon: { months: horizon, point, low: null, high: null, restOfCutoffMonth: partial ? { month: cutoffMonth, days: rest.days, dim: rest.dim } : null },
    fit: ready ? { monthlyRate: rate, windowMonths: FORECAST_METHOD.windowMonths, n: completeValues.length } : null,
    backtest,
    fiscalYear: {
      receiptsYtd: ytd,
      projectedRemainder: remainderPoint,
      projectedTotal: ytd + remainderPoint,
      projectedTotalLow: null,
      projectedTotalHigh: null
    },
    bandLabel: { en: 'No supported range: an interval built from a handful of monthly points would not be a validated interval.', ar: 'لا يتوفر نطاق مدعوم: فاصل مبني على بضع نقاط شهرية ليس فاصلاً مُتحقَّقاً منه.' },
    probabilityStatus: 'unsupported',
    probabilityMessage: { en: 'Not enough data to estimate a reliable probability', ar: 'لا تتوفر بيانات كافية لتقدير احتمالية موثوقة' },
    assumptions: [
      { en: `Baseline: the average monthly receipts of the last ${FORECAST_METHOD.windowMonths} complete months continue unchanged.`, ar: `الأساس: يستمر بلا تغيير متوسط التحصيل الشهري لآخر ${FORECAST_METHOD.windowMonths} أشهر مكتملة.` },
      { en: partial ? `The rest of ${cutoffMonth} (${rest.days} of ${rest.dim} days) is prorated by calendar days; the incomplete month is not a data point.` : 'The cut-off is a month end: the forecast starts with the next month.', ar: partial ? `المتبقي من شهر ${cutoffMonth} (${rest.days} من ${rest.dim} يومًا) يُحتسب بالتناسب على أيام الشهر؛ والشهر غير المكتمل ليس نقطة بيانات.` : 'قطع البيانات نهاية شهر: يبدأ التنبؤ من الشهر التالي.' },
      { en: 'No seasonality, billing-calendar effects, recovery of overdue balances or policy changes are modelled.', ar: 'لا تُنمذج الموسمية أو تأثير التقويم المالي أو استرداد المتأخرات أو تغيّر السياسات.' },
      { en: 'The annual target is NOT used by the forecast.', ar: 'لا يُستخدم المستهدف السنوي في التنبؤ.' }
    ],
    limitations: [
      { en: `Based on only ${completeValues.length} complete monthly points of demo data; ${FORECAST_METHOD.alignment.en}.`, ar: `يعتمد على ${completeValues.length} نقاط شهرية مكتملة فقط من بيانات تجريبية؛ ${FORECAST_METHOD.alignment.ar}.` },
      backtest
        ? { en: `Backtest (rolling origin, this same baseline): n=${backtest.n}${backtest.mape != null ? `, MAPE ${(backtest.mape * 100).toFixed(0)}%` : ''}. A small sample; not a guarantee of future accuracy.`, ar: `الاختبار الرجعي (أصل متحرك، خط الأساس نفسه): n=${backtest.n}${backtest.mape != null ? `، متوسط الخطأ النسبي ${(backtest.mape * 100).toFixed(0)}%` : ''}. عينة صغيرة وليست ضماناً للدقة المستقبلية.` }
        : { en: 'Not enough history for a measured backtest, so no accuracy figure is shown.', ar: 'لا يوجد سجل كافٍ لاختبار رجعي مقاس، لذلك لا تُعرض نسبة دقة.' },
      { en: 'No probability of reaching the target and no confidence range are produced: the history cannot validate them.', ar: 'لا تُقدَّم احتمالية لبلوغ المستهدف ولا نطاق ثقة: فالسجل لا يتيح التحقق منهما.' },
      ...(exceptionalAll.length && !excludeExceptional ? [{ en: `${exceptionalAll.length} large one-off payment(s) are inside the history and are kept in the baseline (the planning page does the same).`, ar: `يضم السجل ${exceptionalAll.length} دفعة كبيرة استثنائية تبقى ضمن خط الأساس (كما في صفحة التخطيط).` }] : [])
    ]
  };
}

function addMonthsStr(ym, delta) {
  let y = Number(ym.slice(0, 4));
  let m = Number(ym.slice(5, 7)) + delta;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/* ---------- Target vs forecast position (never merges them) ---------- */
// The signed deviation of the actual from the plan to date, in words — NO tolerance band and NO «on plan / ahead / behind» classification (spec §0.4): the sign and the amount are the statement.
export function deviationWords(amount) {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (amount > 0) return { ar: 'أعلى من المخطط حتى تاريخه', en: 'above the plan to date' };
  if (amount < 0) return { ar: 'أقل من المخطط حتى تاريخه', en: 'below the plan to date' };
  return { ar: 'مساوٍ للمخطط حتى تاريخه', en: 'equal to the plan to date' };
}
export function targetVsForecast(forecast, targets = DEFAULT_TARGETS) {
  const months = forecast.horizon.months;
  const monthlyTarget = monthlyTargetSeries(targets, months);
  const t = targets.collectionAmountAnnual;
  const annualTarget = t.value; // null = UNAVAILABLE (no / ambiguous / invalid reference plan, or no target for the view): never 0
  const ref = targets.reference || null;
  const f = forecast.fiscalYear;
  let position = 'unknown';
  if (forecast.ready && annualTarget != null) position = f.projectedTotal >= annualTarget ? 'forecast_reaches_target' : 'forecast_below_target';
  // the same planned-to-date as the plan page (cumulative plan to the cut-off, the current month by days) and the SIGNED deviation of the actual from it
  const planned = forecast.cutoff && annualTarget != null ? cumulativeTargetToDate(targets, forecast.cutoff) : null;
  const actualToDate = forecast.ready ? f.receiptsYtd : null;
  const dev = planned > 0 && actualToDate != null ? { amount: actualToDate - planned, pct: (actualToDate - planned) / planned } : null;
  const sc = forecast.scope || {}; const orgKeys = sc.org?.amanahKeys || null; const tk = targets.scopeEntityKeys || null;
  const sameOrg = !orgKeys || (tk && orgKeys.length === tk.length && orgKeys.every((k) => tk.includes(k))); const boundView = !!targets.viewScope && targets.viewScope.amanah !== 'all';
  return {
    annualTarget,
    targetStatus: t.status,
    cutoff: forecast.cutoff || null,
    targetScope: targets.scopeKind || 'ministry',
    targetScopeLabel: targets.scopeKind && targets.scopeKind !== 'ministry' ? targets.scopeLabel || null : null,
    reference: ref,
    targetSourceLine: ref ? bi(targetSourceText(targets, 'ar'), targetSourceText(targets, 'en')) : null,
    targetUnavailable: annualTarget == null ? (ref ? bi(targetUnavailableText(targets, 'ar'), targetUnavailableText(targets, 'en')) : bi('المستهدف غير متاح', 'The target is unavailable')) : null,
    // the forecast scope is wider / narrower than what the target describes (a chosen Amanah / source the target is not bound to, an organisation the target was not built for): the comparison is indicative only
    scopeCaveat: annualTarget != null && ((sc.source != null && sc.source !== 'all') || !targetCoversScope(targets, { amanah: sc.amanah ?? 'all', muni: sc.muni ?? 'all' }) || (!boundView && !sameOrg)),
    planProfile: targets.monthlyCurve?.profile ? { kind: targets.monthlyCurve.profile.kind, assumption: targets.monthlyCurve.profile.assumption, label: targets.monthlyCurve.profile.label } : null,
    plannedToDate: planned,
    actualToDate,
    deviationAmount: dev ? dev.amount : null,
    deviationPct: dev ? dev.pct : null,
    deviationLabel: dev ? deviationWords(dev.amount) : null, // the sign in words (above / below the plan to date), never a tolerance class
    targetVersion: t.versionId || null,
    projectedTotal: forecast.ready ? f.projectedTotal : null,
    forecastAchievementPct: forecast.ready && annualTarget > 0 ? f.projectedTotal / annualTarget : null,
    gapToTarget: forecast.ready && annualTarget != null ? annualTarget - f.projectedTotal : null,
    monthlyTarget,
    position,
    note: { en: 'Forecast and target are independent; the forecast is not adjusted to meet the target. The forecast gives no probability of reaching it.', ar: 'التنبؤ والمستهدف مستقلان؛ ولا يُعدَّل التنبؤ ليطابق المستهدف. ولا يقدّم التنبؤ احتمالية لبلوغه.' }
  };
}

/** the one sentence every report surface prints about the position against the plan: the source plan + version, actual, planned to date (the assumption is named), the SIGNED deviation in words, the target's scope label and the scope caveat. `fmt(v)` formats an amount. */
export function planPositionSentence(tp, fmt, lang = 'en') {
  if (!tp) return '';
  const ar = lang === 'ar';
  if (tp.annualTarget == null) return tp.targetUnavailable ? (ar ? `${tp.targetUnavailable.ar}` : `${tp.targetUnavailable.en}`) : '';
  const parts = [];
  if (tp.targetSourceLine) parts.push(`${ar ? tp.targetSourceLine.ar : tp.targetSourceLine.en}.`);
  else if (tp.targetScopeLabel) parts.push(ar ? `نطاق المستهدف: ${tp.targetScopeLabel.ar}.` : `Target scope: ${tp.targetScopeLabel.en}.`);
  if (tp.plannedToDate > 0 && tp.actualToDate != null) {
    const prof = tp.planProfile?.assumption ? (ar ? ' (افتراض: توزيع متساوٍ للمستهدف على أشهر الخطة)' : ' (assumption: the target spread evenly over the plan months)') : '';
    const pct = tp.deviationPct != null ? ` (${(tp.deviationPct * 100).toFixed(1)}%)` : '';
    const w = tp.deviationLabel;
    parts.push(ar
      ? `حتى ${tp.cutoff}: المحصّل ${fmt(tp.actualToDate)} مقابل المخطط حتى تاريخه ${fmt(tp.plannedToDate)}${prof}؛ الانحراف ${fmt(tp.deviationAmount)}${pct}${w ? ` — ${w.ar}` : ''}.`
      : `To ${tp.cutoff}: collected ${fmt(tp.actualToDate)} against planned to date ${fmt(tp.plannedToDate)}${prof}; deviation ${fmt(tp.deviationAmount)}${pct}${w ? ` — ${w.en}` : ''}.`);
  }
  if (tp.scopeCaveat) parts.push(ar ? 'نطاق التنبؤ يختلف عن الجهات التي يغطيها المستهدف، فالمقارنة إرشادية فقط.' : 'The forecast scope differs from what the target covers, so the comparison is indicative only.');
  return parts.join(' ');
}

/* ---------- Scenario (what-if) layered on the independent forecast ---------- */
export const DEFAULT_SCENARIO = {
  recoverOverduePct: 0, // % of CURRENT overdue outstanding recovered, spread evenly over the horizon
  billingChangePct: 0, // % change applied to the baseline forecast of new-billing-driven receipts
  label: ''
};

export function applyScenario(forecast, snapshot, scenario = DEFAULT_SCENARIO) {
  if (!forecast.ready) return { ready: false };
  const months = forecast.horizon.months;
  const overdue = (snapshot.noncollection.overdue?.amount || 0) + (snapshot.noncollection.partial?.amount || 0);
  const addRecovery = (overdue * (scenario.recoverOverduePct / 100)) / Math.max(1, months.length);
  const series = forecast.horizon.point.map((p) => p * (1 + scenario.billingChangePct / 100) + addRecovery);
  const total = series.reduce((s, v) => s + v, 0);
  const baseTotal = forecast.horizon.point.reduce((s, v) => s + v, 0);
  return {
    ready: true,
    isScenario: true,
    series,
    total,
    deltaVsForecast: total - baseTotal,
    fiscalYearTotal: forecast.fiscalYear.receiptsYtd + total,
    method: {
      en: 'Scenario = independent forecast × (1 + billing change) + a share of the current overdue/partial outstanding recovered evenly over the horizon. Simple arithmetic on user inputs, not a prediction.',
      ar: 'السيناريو = التنبؤ المستقل × (1 + تغيّر الفوترة) + حصة من المتأخرات/الجزئية الحالية تُحصَّل بالتساوي على الأفق. حساب بسيط على مدخلات المستخدم وليس تنبؤاً.'
    },
    inputs: { ...scenario, overdueBase: overdue }
  };
}

/* ---------- Forecast versions: replayed vintages for comparison with actuals ----------
   Re-runs the same method as if it had been run at earlier cutoffs, using only payments
   dated up to each cutoff. Restatements are not captured (the ledger holds final facts). */
export async function forecastVintages(data, scopeIn = {}, cfgIn = {}, cutoffs, { horizonMonths = 3 } = {}) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scopeIn, cfg);
  const out = [];
  for (const cutoff of cutoffs) {
    const f = await forecastReceipts(data, sc, { ...cfg, cutoff }, { horizonMonths });
    if (!f.ready) continue;
    const actualAll = await data.series({ ...sc, from: `${addMonthsStr(cutoff.slice(0, 7), 1)}-01`, to: cfg.cutoff }, { asOf: cfg.cutoff });
    const actualByMonth = new Map(actualAll.months.map((m, i) => [m, actualAll.values[i]]));
    const partialFirst = !!f.horizon.restOfCutoffMonth; // the cut-off month's forecast covers only its rest, so it is not compared with a whole month
    const rows = f.horizon.months.map((m, i) => ({ month: m, forecast: f.horizon.point[i], actual: !(partialFirst && i === 0) && actualByMonth.has(m) ? actualByMonth.get(m) : null }));
    const compared = rows.filter((r) => r.actual != null);
    out.push({
      id: `FC-${cutoff}`,
      generatedAtCutoff: cutoff,
      method: f.method.id,
      rows,
      meanAbsError: compared.length ? compared.reduce((s, r) => s + Math.abs(r.actual - r.forecast), 0) / compared.length : null,
      insideRange: null, // no supported range exists any more
      comparedMonths: compared.length
    });
  }
  return out;
}

/* ---------- Intervention follow-up (did it help?) ----------
   Compares collected ÷ net billed for invoices issued BEFORE vs AFTER an
   intervention start, in the intervention's scope. Association only. */
export async function interventionFollowUp(data, intervention, cfgIn = {}) {
  const cfg = normalizeConfig(cfgIn);
  const scope = { amanah: intervention.scope.amanah || 'all', source: intervention.scope.source || 'all' };
  const [before, after] = await Promise.all([
    data.snapshot({ ...scope, from: intervention.baselineFrom, to: addDays(intervention.startDate, -1) }),
    data.snapshot({ ...scope, from: intervention.startDate, to: cfg.cutoff })
  ]);
  const bRate = before.totals.collectedOverNet;
  const aRate = after.totals.collectedOverNet;
  const sparse = before.totals.count < 30 || after.totals.count < 30;
  return {
    before, after,
    ppChange: bRate.calculable && aRate.calculable ? Math.round((aRate.value - bRate.value) * 1000) / 10 : null,
    sparse,
    caveat: {
      en: `Association only — not proof the intervention caused the change. Compared invoices issued ${intervention.baselineFrom}–${addDays(intervention.startDate, -1)} (n=${before.totals.count}) with ${intervention.startDate}–${cfg.cutoff} (n=${after.totals.count}); the recent group has had less time to collect.`,
      ar: `ارتباط فقط وليس دليلاً على أن التدخل هو السبب. قورنت الفواتير الصادرة ${intervention.baselineFrom}–${addDays(intervention.startDate, -1)} (n=${before.totals.count}) مع ${intervention.startDate}–${cfg.cutoff} (n=${after.totals.count})؛ والمجموعة الأحدث أمامها وقت أقل للتحصيل.`
    }
  };
}

// Illustrative demo intervention record (clearly labelled in the UI).
export const DEMO_INTERVENTIONS = [
  {
    id: 'INT-DEMO-1',
    title: { en: 'Weekly follow-up on overdue municipal-fee invoices (Jeddah & Eastern Province)', ar: 'متابعة أسبوعية للفواتير البلدية المتأخرة (جدة والمنطقة الشرقية)' },
    owner: { en: 'Amanah revenue units (demo)', ar: 'وحدات الإيرادات في الأمانات (تجريبي)' },
    startDate: addMonthsFrom(DATA_CUTOFF, -6),
    baselineFrom: addMonthsFrom(DATA_CUTOFF, -12),
    scope: { amanah: ['Jeddah Amanah', 'Eastern Province Amanah'], source: 'all' },
    provenance: 'demo'
  }
];
