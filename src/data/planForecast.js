// «أين نحن من الخطة» (IIM-15) — a SIMPLE, EXPLAINABLE projection from the actuals of the demo data. It is a demonstration, not a model: the screen labels it «تقدير تجريبي – للعرض التوضيحي».
//   estimate  = the average monthly collection of the last (up to) three CLOSED months, carried over the remaining months (the current month is at least what is already collected);
//   uncertainty = the spread of those months, widened by the number of months left;
//   probability = the chance the year-end estimate reaches the annual revenue target, assuming a normal spread;
//   reasons = rules over the same numbers (for instance: even collecting everything still owed plus the billing still expected cannot reach the target → billing is insufficient).
// Re-estimated every month when the actuals arrive. Pure functions, no I/O.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const erf = (x) => { const s = x < 0 ? -1 : 1; const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; };
export const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
const mean = (a) => (a.length ? a.reduce((t, x) => t + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((t, x) => t + (x - m) ** 2, 0) / (a.length - 1)); };

/**
 * @param {object} i
 * @param {number} i.target               annual revenue target (riyals)
 * @param {number[]} i.cumTarget          the cumulative monthly target (12 values)
 * @param {number[]} i.monthlyCollected   payments by month, January … the reporting month (partial last month)
 * @param {number} i.reportingMonth       1–12 (the month of the reporting date)
 * @param {boolean} i.yearEnded           true when the reporting date is 31 December
 * @param {number} i.dayFraction          the share of the reporting month already elapsed (0–1]
 * @param {number[]} i.billedMonthly      net billed by issue month (same length as monthlyCollected)
 * @param {number} i.standingUncollected  uncollectible-excluded balance still owed today
 */
export function forecastYear({ target, cumTarget, monthlyCollected = [], reportingMonth, yearEnded = false, dayFraction = 1, billedMonthly = [], standingUncollected = 0 }) {
  const m = reportingMonth; const closed = yearEnded ? 12 : m - 1;
  const actual = Array.from({ length: 12 }, (_, k) => (k < m ? monthlyCollected[k] || 0 : null));
  const actualCum = []; let run = 0; for (let k = 0; k < 12; k += 1) { if (k < m) { run += actual[k]; actualCum.push(run); } else actualCum.push(null); }
  const collected = run;
  const base = (closed >= 1 ? actual.slice(Math.max(0, closed - 3), closed) : [actual[0] / Math.max(dayFraction, 0.1)]).filter((x) => x != null);
  const avg = mean(base); const spread = base.length >= 2 ? sd(base) : avg * 0.25;
  const estCum = []; let e = 0;
  for (let k = 0; k < 12; k += 1) {
    if (k < closed) { e = actualCum[k]; } else if (k === closed && !yearEnded) { e = (closed > 0 ? actualCum[closed - 1] : 0) + Math.max(actual[k] || 0, avg); } else { e += avg; }
    estCum.push(e);
  }
  const forecast = estCum[11]; const monthsLeft = 12 - closed - (yearEnded ? 0 : 0);
  const sdTotal = spread * Math.sqrt(Math.max(monthsLeft, 0));
  let probability;
  if (!(target > 0)) probability = null;
  else if (collected >= target) probability = 1;
  else if (monthsLeft <= 0) probability = forecast >= target ? 1 : 0;
  else if (sdTotal <= 0) probability = forecast >= target ? 0.99 : 0.01;
  else probability = clamp(1 - normalCdf((target - forecast) / sdTotal), 0.01, 0.99);
  const plannedToDate = target > 0 ? (cumTarget[Math.max(m - 2, 0)] ?? 0) * (m > 1 ? 1 : 0) + ((cumTarget[m - 1] ?? 0) - (m > 1 ? cumTarget[m - 2] ?? 0 : 0)) * dayFraction : 0;
  const deviation = collected - plannedToDate; const deviationPct = plannedToDate > 0 ? deviation / plannedToDate : null;
  // reasons
  const billedYtd = billedMonthly.reduce((t, x) => t + (x || 0), 0); const billedBase = billedMonthly.slice(Math.max(0, closed - 3), Math.max(closed, 1)); const avgBilling = mean(billedBase.length ? billedBase : billedMonthly);
  const maxFuture = standingUncollected + avgBilling * Math.max(monthsLeft, 0); const maxTotal = collected + maxFuture;
  const reasons = [];
  if (target > 0) {
    if (collected >= target) reasons.push({ kind: 'reach', code: 'achieved' });
    else if (forecast >= target) { reasons.push({ kind: 'reach', code: 'run_rate', avg, required: Math.max(target - collected, 0) / Math.max(monthsLeft, 1) }); if (maxTotal >= target) reasons.push({ kind: 'reach', code: 'balance_covers', maxTotal }); }
    else {
      if (maxTotal < target) reasons.push({ kind: 'miss', code: 'billing_insufficient', maxTotal, gap: target - maxTotal });
      reasons.push({ kind: 'miss', code: 'pace_short', avg, required: Math.max(target - collected, 0) / Math.max(monthsLeft, 1), gap: target - forecast });
    }
  }
  return { actual, actualCum, estCum, targetCum: cumTarget, collected, forecast, avg, spread, monthsLeft, probability, plannedToDate, deviation, deviationPct, reasons, billedYtd, avgBilling, maxTotal };
}

/** «أين نركز»: entity × source cells ranked by what is still owed × the shortfall from the collection-rate target (cells with nothing owed are left out) */
export function focusRanking(cells, targetRate, limit = 5) {
  return (cells || []).map((c) => { const rate = c.net > 0 ? c.collected / c.net : null; const shortfall = rate == null ? 0 : Math.max(0, targetRate - rate); return { ...c, rate, shortfall, score: c.outstanding * (shortfall > 0 ? shortfall : 0.02) }; })
    .filter((c) => c.outstanding > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
