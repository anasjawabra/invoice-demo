// ============================================================================
// Revenue outlook — keeps THREE concepts strictly apart:
//
//   1. Approved management target  (an INPUT; see revenueMetrics.DEFAULT_TARGETS)
//   2. Independent data-based forecast (computed here from receipts history only;
//      it never looks at the target and is never nudged toward it)
//   3. User-defined intervention scenario (what-if deltas applied ON TOP of the
//      independent forecast; stored and shown separately)
//
// The forecast method is deliberately simple and says so: an ordinary-least-
// squares linear trend over trailing monthly receipts, with a one-step-ahead
// expanding-window backtest as the only measured performance figure. No
// accuracy percentage is shown unless that backtest produced one.
// ============================================================================
import { monthsBetween, normalizeConfig, normalizeScope, DEFAULT_TARGETS, monthlyTargetSeries } from './revenueMetrics';
import { addDays, monthOf, DATA_CUTOFF } from './revenueLedger';

// first day of the month `n` months before the given date (the demo intervention is dated relative to today)
function addMonthsFrom(date, n) { let y = Number(date.slice(0, 4)); let m = Number(date.slice(5, 7)) + n; while (m < 1) { m += 12; y -= 1; } while (m > 12) { m -= 12; y += 1; } return `${y}-${String(m).padStart(2, '0')}-01`; }

export const FORECAST_METHOD = {
  id: 'ols_trend_v1',
  label: { en: 'Linear trend over trailing monthly receipts (illustrative)', ar: 'اتجاه خطي على المقبوضات الشهرية السابقة (توضيحي)' },
  windowMonths: 12,
  minPoints: 4
};

function olsFit(ys) {
  const n = ys.length;
  if (n < 2) return null;
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = den ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den : 0;
  const intercept = my - slope * mx;
  const resid = ys.map((y, i) => y - (slope * i + intercept));
  const dof = Math.max(1, n - 2);
  const sd = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / dof);
  return { slope, intercept, sd, n };
}

const median = (arr) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

// A payment is "exceptional" when it is large relative to the typical single payment (median of all
// payments in the history) AND is a large share of its own month, so one-off payments cannot silently
// drive a trend. Thresholds are configuration, not statistical truth.
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

export function backtestOneStep(series, minTrain = 6) {
  const apes = [];
  const aes = [];
  for (let k = minTrain; k < series.length; k += 1) {
    const fit = olsFit(series.slice(0, k));
    if (!fit) continue;
    const pred = Math.max(0, fit.slope * k + fit.intercept);
    aes.push(Math.abs(series[k] - pred));
    if (series[k] > 0) apes.push(Math.abs(series[k] - pred) / series[k]);
  }
  if (aes.length < 3) return null;
  return {
    n: aes.length,
    mae: aes.reduce((a, b) => a + b, 0) / aes.length,
    mape: apes.length >= 3 ? apes.reduce((a, b) => a + b, 0) / apes.length : null,
    method: 'expanding_window_one_step'
  };
}

// Pure forecast over series the data service computed: `hist` = monthly receipts over the trailing window, `fy` = fiscal-year-to-date receipts.
export async function forecastReceipts(data, scopeIn = {}, cfgIn = {}, opts = {}) {
  const cfg = normalizeConfig(cfgIn);
  const sc = normalizeScope(scopeIn, cfg);
  const targets = opts.targets || DEFAULT_TARGETS;
  const cutoffMonth = cfg.cutoff.slice(0, 7);
  const histFrom = `${addMonthsStr(cutoffMonth, -(FORECAST_METHOD.windowMonths - 1))}-01`;
  const [hist, fy] = await Promise.all([
    data.series({ ...sc, from: histFrom, to: cfg.cutoff }, { asOf: cfg.cutoff }),
    data.series({ ...sc, from: `${targets.fiscalYear}-01-01`, to: cfg.cutoff }, { asOf: cfg.cutoff })
  ]);
  return forecastCore({ hist, fyValues: fy.values, cfg, sc, ...opts, targets });
}

export function forecastCore({ hist, fyValues, cfg, sc, horizonMonths, targets = DEFAULT_TARGETS, excludeExceptional = true }) {
  const cutoffMonth = cfg.cutoff.slice(0, 7);
  const exceptional = detectExceptionalPayments(hist.months, hist.values, hist.payments, { typicalPayment: hist.typicalPayment });
  const exceptionalByMonth = new Map();
  for (const e of exceptional) exceptionalByMonth.set(e.month, (exceptionalByMonth.get(e.month) || 0) + e.amount);
  const adjusted = hist.values.map((v, i) => (excludeExceptional ? v - (exceptionalByMonth.get(hist.months[i]) || 0) : v));

  const enough = adjusted.length >= FORECAST_METHOD.minPoints;
  const fit = enough ? olsFit(adjusted) : null;

  const fiscalEnd = `${targets.fiscalYear}-12`;
  const startMonth = addMonthsStr(cutoffMonth, 1);
  const horizon = horizonMonths
    ? Array.from({ length: horizonMonths }, (_, i) => addMonthsStr(cutoffMonth, i + 1))
    : monthsBetween(`${startMonth}-01`, `${fiscalEnd}-28`);
  const point = []; const low = []; const high = [];
  if (fit) {
    horizon.forEach((_, i) => {
      const x = adjusted.length + i;
      const p = Math.max(0, fit.slope * x + fit.intercept);
      // Widen the indicative band with distance from the data (sd * sqrt(1 + h/n) style growth, simplified).
      const spread = 1.28 * fit.sd * Math.sqrt(1 + (i + 1) / adjusted.length);
      point.push(p); low.push(Math.max(0, p - spread)); high.push(p + spread);
    });
  }
  const backtest = enough ? backtestOneStep(adjusted) : null;

  const ytd = fyValues.reduce((s, v) => s + v, 0);
  const remainderPoint = point.reduce((s, v) => s + v, 0);
  const remainderLow = low.reduce((s, v) => s + v, 0);
  const remainderHigh = high.reduce((s, v) => s + v, 0);

  return {
    method: FORECAST_METHOD,
    ready: !!fit,
    reasonNotReady: fit ? null : { en: `At least ${FORECAST_METHOD.minPoints} months of receipts history are needed; ${adjusted.length} available in scope.`, ar: `يلزم ${FORECAST_METHOD.minPoints} أشهر على الأقل من سجل المقبوضات؛ المتاح ${adjusted.length} في النطاق.` },
    cutoff: cfg.cutoff,
    scope: sc,
    history: { months: hist.months, values: hist.values, adjusted },
    exceptional,
    excludedExceptional: excludeExceptional,
    horizon: { months: horizon, point, low, high },
    fit: fit ? { slopePerMonth: fit.slope, residualSd: fit.sd, n: fit.n } : null,
    backtest,
    fiscalYear: {
      receiptsYtd: ytd,
      projectedRemainder: remainderPoint,
      projectedTotal: ytd + remainderPoint,
      projectedTotalLow: ytd + remainderLow,
      projectedTotalHigh: ytd + remainderHigh
    },
    bandLabel: { en: 'Indicative range (±1.28 residual SD of the trend fit) — not a validated confidence interval.', ar: 'نطاق إرشادي (±1.28 انحراف معياري للبواقي) — وليس فاصل ثقة مُتحقَّقاً منه.' },
    assumptions: [
      { en: 'Receipts follow a linear monthly trend over the trailing window.', ar: 'تتبع المقبوضات اتجاهاً شهرياً خطياً خلال الفترة السابقة.' },
      { en: 'No seasonality, billing-calendar effects or policy changes are modelled.', ar: 'لا تُنمذج الموسمية أو تأثير التقويم المالي أو تغيّر السياسات.' },
      { en: excludeExceptional ? 'Exceptional single payments are removed from the fitted series and shown separately.' : 'Exceptional single payments are kept in the fitted series.', ar: excludeExceptional ? 'تُستبعد الدفعات الاستثنائية الكبيرة من السلسلة المُلائمة وتُعرض منفصلة.' : 'تُبقى الدفعات الاستثنائية في السلسلة المُلائمة.' },
      { en: 'The approved target is NOT used by the forecast.', ar: 'لا يُستخدم المستهدف المعتمد في التنبؤ.' }
    ],
    limitations: [
      { en: `Based on only ${adjusted.length} monthly points of demo data.`, ar: `يعتمد على ${adjusted.length} نقاط شهرية فقط من بيانات تجريبية.` },
      backtest
        ? { en: `Backtest (expanding-window, one step ahead): n=${backtest.n}${backtest.mape != null ? `, MAPE ${(backtest.mape * 100).toFixed(0)}%` : ''}. A small sample; not a guarantee of future accuracy.`, ar: `الاختبار الرجعي: n=${backtest.n}${backtest.mape != null ? `، متوسط الخطأ النسبي ${(backtest.mape * 100).toFixed(0)}%` : ''}. عينة صغيرة وليست ضماناً للدقة المستقبلية.` }
        : { en: 'Not enough history for a measured backtest, so no accuracy figure is shown.', ar: 'لا يوجد سجل كافٍ لاختبار رجعي مقاس، لذلك لا تُعرض نسبة دقة.' }
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
export function targetVsForecast(forecast, targets = DEFAULT_TARGETS) {
  const months = forecast.horizon.months;
  const monthlyTarget = monthlyTargetSeries(targets, months);
  const annualTarget = targets.collectionAmountAnnual.value;
  const f = forecast.fiscalYear;
  let position = 'unknown';
  if (forecast.ready) {
    if (f.projectedTotalLow >= annualTarget) position = 'target_within_reach_above_range';
    else if (f.projectedTotalHigh < annualTarget) position = 'target_above_indicative_range';
    else position = 'target_inside_indicative_range';
  }
  return {
    annualTarget,
    targetStatus: targets.collectionAmountAnnual.status,
    projectedTotal: forecast.ready ? f.projectedTotal : null,
    gapToTarget: forecast.ready ? annualTarget - f.projectedTotal : null,
    monthlyTarget,
    position,
    note: { en: 'Forecast and target are independent; the forecast is not adjusted to meet the target.', ar: 'التنبؤ والمستهدف مستقلان؛ ولا يُعدَّل التنبؤ ليطابق المستهدف.' }
  };
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
    const rows = f.horizon.months.map((m, i) => ({ month: m, forecast: f.horizon.point[i], low: f.horizon.low[i], high: f.horizon.high[i], actual: actualByMonth.has(m) ? actualByMonth.get(m) : null }));
    const compared = rows.filter((r) => r.actual != null);
    out.push({
      id: `FC-${cutoff}`,
      generatedAtCutoff: cutoff,
      method: f.method.id,
      rows,
      meanAbsError: compared.length ? compared.reduce((s, r) => s + Math.abs(r.actual - r.forecast), 0) / compared.length : null,
      insideRange: compared.length ? compared.filter((r) => r.actual >= r.low && r.actual <= r.high).length : null,
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
