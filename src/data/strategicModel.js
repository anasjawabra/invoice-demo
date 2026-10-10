import { DEFAULT_TARGETS } from './revenueMetrics.js';
import { DATA_CUTOFF, addDays } from './revenueLedger.js';

// The what-if model starts from the SHARED revenue snapshot (not a separate
// hand-authored list): billing base, exclusion share and current recovery all
// come from the same ledger the rest of the app uses. Lever effects below are
// illustrative assumptions of this scenario tool, not measured elasticities.
export function baseFromSnapshot(snapshot) {
  const t = snapshot.totals;
  return {
    portfolioTotal: t.gross,
    exclusionRate: t.gross > 0 ? t.exclusions / t.gross : 0,
    baselineRecovery: t.collectedOverNet.calculable ? t.collectedOverNet.value : 0, // collection rate = collected ÷ net billed
    cutoff: snapshot.cutoff,
    count: t.count
  };
}
// The tool's "portfolio" is a 90-day billing base: invoices issued in the 90 days to the data cutoff.
export const BASE_WINDOW_DAYS = 90;
export const baseWindowScope = (scope, cutoff = DATA_CUTOFF) => ({ ...scope, from: addDays(cutoff, -(BASE_WINDOW_DAYS - 1)), to: cutoff });
// The real base is fetched from the data service (a 90-day snapshot); this placeholder only exists until it arrives.
export const DEFAULT_BASE = { portfolioTotal: 0, exclusionRate: 0, baselineRecovery: 0, cutoff: DATA_CUTOFF, count: 0 };

export const LEVERS = ['invoicing', 'collections', 'exclusions', 'statusMix', 'uncollectible'];

export const TARGET_TYPES = ['opexCoverage', 'collectionAmount'];

export const OPERATING_PROFILE = {
  // Denominator concept = the official coverage definition: eligible ORIGINAL budget of chapters 1-3 (annual ÷ 12),
  // prorated to the horizon. Eligibility and transfer rules remain unresolved (see revenueMetrics.DEFAULT_TARGETS).
  monthlyOpex: Object.values(DEFAULT_TARGETS.coverage.chapters).reduce((a, b) => a + b, 0) / 12,
  baseStatusReadyRate: 0.76,
  baseUncollectibleRate: 0.1,
  maxInvoicingLift: 0.4,
  maxCollectionLift: 0.22,
  maxExclusionReduction: 0.55,
  maxStatusLift: 0.17,
  maxUncollectibleReduction: 0.65
};

export const DEFAULT_SCENARIO = {
  targetType: 'opexCoverage',
  target: 65,
  days: 90,
  values: { invoicing: 20, collections: 35, exclusions: 25, statusMix: 30, uncollectible: 20 },
  enabled: { invoicing: true, collections: true, exclusions: true, statusMix: true, uncollectible: true }
};

export const PORTFOLIO_TOTAL = DEFAULT_BASE.portfolioTotal;

const zeroValues = Object.fromEntries(LEVERS.map(key => [key, 0]));

const clampValues = (values, enabled) => Object.fromEntries(
  LEVERS.map(key => [key, enabled[key] ? values[key] : 0])
);

export function targetToAmount(scenario, profile = OPERATING_PROFILE) {
  if (scenario.targetType === 'collectionAmount') return scenario.target;
  return profile.monthlyOpex * (scenario.days / 30) * (scenario.target / 100);
}

export function project(values, days, profile = OPERATING_PROFILE, base = DEFAULT_BASE) {
  const scale = days / 90;
  const PORTFOLIO = base.portfolioTotal;
  const grossInvoiced = PORTFOLIO * (1 + profile.maxInvoicingLift * values.invoicing / 100 * scale);
  const exclusionRate = base.exclusionRate * (1 - profile.maxExclusionReduction * values.exclusions / 100);
  const netInvoiced = grossInvoiced * (1 - exclusionRate);
  const statusReadyRate = Math.min(.98, profile.baseStatusReadyRate + profile.maxStatusLift * values.statusMix / 100 * scale);
  const uncollectibleRate = profile.baseUncollectibleRate * (1 - profile.maxUncollectibleReduction * values.uncollectible / 100);
  // Current recovery performance from the shared ledger (collected ÷ net billed), scaled to the horizon.
  const baselineRecovery = 1 - Math.pow(1 - Math.min(0.999, base.baselineRecovery), scale);
  const collectionRate = Math.min(.98, baselineRecovery + profile.maxCollectionLift * values.collections / 100 * scale);
  const collectibleBase = netInvoiced * statusReadyRate * (1 - uncollectibleRate);
  const collected = collectibleBase * collectionRate;
  const opex = profile.monthlyOpex * (days / 30);

  return {
    grossInvoiced,
    excludedAmount: grossInvoiced * exclusionRate,
    netInvoiced,
    statusReadyAmount: netInvoiced * statusReadyRate,
    uncollectibleAmount: netInvoiced * statusReadyRate * uncollectibleRate,
    collectibleBase,
    collectionRate,
    collected,
    opex,
    sustainabilityCoverage: opex ? collected / opex * 100 : 0
  };
}

function requiredInvoicing(targetAmount, values, days, profile = OPERATING_PROFILE, base = DEFAULT_BASE) {
  const withoutInvoicing = project({ ...values, invoicing: 0 }, days, profile, base);
  if (!withoutInvoicing.collectibleBase || !withoutInvoicing.collectionRate) return Infinity;
  const current = project(values, days, profile, base);
  const requiredGross = targetAmount / ((withoutInvoicing.collectibleBase / base.portfolioTotal) * withoutInvoicing.collectionRate);
  return Math.max(0, requiredGross - current.grossInvoiced);
}

export function trajectory(values, days, steps = 12, profile = OPERATING_PROFILE, base = DEFAULT_BASE) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const d = Math.max(1, Math.round(days * i / steps));
    points.push({ day: d, ...project(values, d, profile, base) });
  }
  return points;
}

export function analyzeScenario(scenario, base = DEFAULT_BASE) {
  const P = (v, d) => project(v, d, OPERATING_PROFILE, base);
  const { target, targetType, days, values, enabled } = scenario;
  if (!TARGET_TYPES.includes(targetType) || !Number.isFinite(target) || target <= 0 || ![30, 60, 90].includes(days)
    || LEVERS.some(key => !Number.isFinite(values[key]) || values[key] < 0 || values[key] > 100 || typeof enabled[key] !== 'boolean')) {
    throw new Error('Invalid scenario');
  }

  const targetAmount = targetToAmount(scenario);
  const current = clampValues(values, enabled);
  const upper = Object.fromEntries(LEVERS.map(key => [key, enabled[key] ? 100 : 0]));
  const baseline = P(zeroValues, days);
  const projected = P(current, days);
  const maximum = P(upper, days);
  const exclusionImpact = P({ ...current, exclusions: 100 }, days).collected - projected.collected;
  const sensitivity = LEVERS.map(key => {
    const withMax = P({ ...current, [key]: 100 }, days);
    return { key, enabled: enabled[key], value: current[key], impact: withMax.collected - projected.collected };
  }).sort((a, b) => b.impact - a.impact);

  const recommended = { ...current };
  const actions = [];
  for (const item of sensitivity) {
    if (!item.enabled || P(recommended, days).collected >= targetAmount) continue;
    const from = recommended[item.key];
    const before = P(recommended, days).collected;
    let low = from, high = 100;
    if (P({ ...recommended, [item.key]: 100 }, days).collected >= targetAmount) {
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        if (P({ ...recommended, [item.key]: mid }, days).collected >= targetAmount) high = mid;
        else low = mid;
      }
    }
    recommended[item.key] = Math.ceil(high);
    const gain = P(recommended, days).collected - before;
    if (gain > .01) actions.push({ key: item.key, from, to: recommended[item.key], gain });
  }

  return {
    targetAmount,
    baseline,
    projected,
    maximum,
    current,
    sensitivity,
    recommended,
    actions,
    exclusionImpact,
    additionalInvoicingNeeded: requiredInvoicing(targetAmount, current, days, OPERATING_PROFILE, base),
    maxAdditionalInvoicingNeeded: requiredInvoicing(targetAmount, upper, days, OPERATING_PROFILE, base),
    achievable: maximum.collected + .01 >= targetAmount,
    meetsTarget: projected.collected + .01 >= targetAmount,
    roadmapOutcome: P(recommended, days)
  };
}
