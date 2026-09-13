// Pure, language-independent What-If Modeling computations.
// Built on the same computeKpi() baseline used by Dashboard and Smart
// Reports (reportAnalytics.js), so the "current state" this page starts
// from can never drift from what the rest of the demo already shows.
//
// Per the 10-Sep Smart Invoicing MOM, the three levers modeled here
// (invoicing growth, collection-rate improvement, exclusions recovered)
// are the ones the meeting emphasized together (Section B/D, Decision #5).
// The MOM also lists "invoice status mix" and "uncollectible amounts" as
// candidate parameters, but explicitly flags the full parameter list as
// "not formally agreed during the meeting" — this model folds both into
// the collection-rate lever for now rather than guessing at a split.
import { INVOICES, OPEX_BASELINE } from './mock';
import { computeKpi, computeByProvince, computeExclusionBreakdown } from './reportAnalytics';

export const LEVER_BOUNDS = {
  invoicingGrowthPct: { min: 0, max: 25, step: 1, default: 0 },
  collectionRateDeltaPts: { min: 0, max: 20, step: 1, default: 0 },
  exclusionsRecoveredPct: { min: 0, max: 60, step: 5, default: 0 }
};

export function baselineState() {
  const kpi = computeKpi(INVOICES);
  const opex = OPEX_BASELINE;
  return {
    ...kpi,
    opex,
    opexCoveragePct: opex ? Math.round((kpi.collectedValue / opex) * 1000) / 10 : 0
  };
}

export function simulate(base, levers) {
  const invoicingGrowthPct = levers.invoicingGrowthPct || 0;
  const collectionRateDeltaPts = levers.collectionRateDeltaPts || 0;
  const exclusionsRecoveredPct = levers.exclusionsRecoveredPct || 0;

  // Use the exact (unrounded) baseline rate, not base.collectionRate — that
  // field is rounded to 1 decimal for display, and basing the simulation on
  // it would drift the "current state" result away from the real baseline
  // even when every lever is left at 0.
  const baseRateExact = base.netInvoiced ? (base.collectedValue / base.netInvoiced) * 100 : 0;

  const recoveredExclusions = base.excludedValue * (exclusionsRecoveredPct / 100);
  const netInvoiced = base.netInvoiced * (1 + invoicingGrowthPct / 100) + recoveredExclusions;
  const collectionRate = Math.min(100, baseRateExact + collectionRateDeltaPts);
  const collectedValue = netInvoiced * (collectionRate / 100);
  const opexCoveragePct = base.opex ? Math.round((collectedValue / base.opex) * 1000) / 10 : 0;

  return { recoveredExclusions, netInvoiced, collectionRate, collectedValue, opexCoveragePct };
}

export const MAX_LEVERS = Object.fromEntries(Object.entries(LEVER_BOUNDS).map(([k, b]) => [k, b.max]));
export const ZERO_LEVERS = Object.fromEntries(Object.entries(LEVER_BOUNDS).map(([k]) => [k, 0]));

// Marginal SAR impact of moving ONE lever alone to its max, holding the
// other two at zero — used to rank priority actions in the AI narrative.
export function leverImpacts(base) {
  return Object.keys(LEVER_BOUNDS).map((key) => {
    const levers = { ...ZERO_LEVERS, [key]: LEVER_BOUNDS[key].max };
    const sim = simulate(base, levers);
    return { key, impact: sim.collectedValue - base.collectedValue };
  }).sort((a, b) => b.impact - a.impact);
}

// Achievability against a target, for either target type.
export function evaluateTarget(base, sim, targetType, targetValue) {
  const current = targetType === 'opex' ? sim.opexCoveragePct : sim.collectedValue;
  const maxSim = simulate(base, MAX_LEVERS);
  const maxAchievable = targetType === 'opex' ? maxSim.opexCoveragePct : maxSim.collectedValue;
  return {
    current,
    gap: targetValue - current,
    achievableNow: current >= targetValue,
    achievableAtMax: maxAchievable >= targetValue,
    maxAchievable
  };
}

// ---------- Amanah / province drill-down (Level 3) ----------
// Reuses the exact same aggregation Smart Reports already uses — the map
// and leaderboard below can never disagree with the rest of the demo.
export function byProvince() {
  return computeByProvince(INVOICES).filter((p) => p.count > 0);
}

// Ranked worst-to-best by collection rate — the underperformers a leader
// would want to drill into first.
export function underperformers(limit = 5) {
  return [...byProvince()].sort((a, b) => a.rate - b.rate).slice(0, limit);
}

export function exclusionBreakdown() {
  return computeExclusionBreakdown(INVOICES);
}

// ---------- Illustrative trend + forecast ----------
// This demo's per-invoice dataset is a single snapshot with no real
// month-over-month ledger, so there is no genuine history to chart. This
// walks backward from the LIVE baseline using a fixed, deterministic
// month-over-month growth path (same every render — never randomized) to
// produce an illustrative 6-month trend that always ends exactly at
// today's real numbers, then projects 3 months forward from the trailing
// growth rate actually present in that trend. Clearly labeled illustrative
// in the UI — this is a shape-of-the-answer demo, not a real forecast.
const HISTORY_GROWTH_PATH = [0.86, 0.90, 0.93, 0.96, 0.98, 1.00];
export const FORECAST_MONTHS = 3;

export function historicalSeries(base) {
  return HISTORY_GROWTH_PATH.map((m) => Math.round(base.collectedValue * m));
}

export function forecastSeries(history) {
  const ratios = [];
  for (let i = history.length - 3; i < history.length; i++) {
    if (i > 0) ratios.push(history[i] / history[i - 1]);
  }
  const avgGrowth = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  const forecast = [];
  let last = history[history.length - 1];
  for (let i = 0; i < FORECAST_MONTHS; i++) {
    last *= avgGrowth;
    forecast.push(Math.round(last));
  }
  // Uncertainty band widens the further out the projection reaches.
  const band = forecast.map((v, i) => Math.round(v * 0.04 * (i + 1)));
  return { forecast, avgGrowth, band };
}

// ---------- Lever waterfall (sequential contribution) ----------
// Unlike leverImpacts() above (each lever alone, for ranking), this applies
// the three levers IN ORDER so the segments sum exactly to the simulated
// total — what a stacked "baseline + contributions = outcome" chart needs.
export function leverWaterfall(base, levers) {
  const order = ['invoicingGrowthPct', 'collectionRateDeltaPts', 'exclusionsRecoveredPct'];
  let running = { ...ZERO_LEVERS };
  let prevValue = base.collectedValue;
  const segments = [];
  for (const key of order) {
    running = { ...running, [key]: levers[key] || 0 };
    const value = simulate(base, running).collectedValue;
    segments.push({ key, contribution: value - prevValue });
    prevValue = value;
  }
  return segments;
}

// ---------- Illustrative lever scoring (for the priority radar) ----------
// Impact is derived from the model itself (leverImpacts, normalized 0-100).
// Speed-to-implement and confidence are qualitative, fixed, illustrative
// scores — not computed from data — reflecting the operational reality
// each lever implies (recovering exclusions means resolving disputes /
// correcting registries case-by-case, which is slower and less certain
// than an internal collection-rate push).
const LEVER_QUALITATIVE = {
  invoicingGrowthPct: { speed: 40, confidence: 70 },
  collectionRateDeltaPts: { speed: 75, confidence: 65 },
  exclusionsRecoveredPct: { speed: 55, confidence: 50 }
};

export function leverScorecard(base) {
  const impacts = leverImpacts(base);
  const maxImpact = Math.max(...impacts.map((i) => i.impact), 1);
  return impacts.map((i) => ({
    key: i.key,
    impact: Math.round((i.impact / maxImpact) * 100),
    speed: LEVER_QUALITATIVE[i.key].speed,
    confidence: LEVER_QUALITATIVE[i.key].confidence
  }));
}
