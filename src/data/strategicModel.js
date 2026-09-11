import { COLLECTIONS } from './mock.js';

export const LEVERS = ['invoicing', 'collections', 'exclusions', 'statusMix', 'uncollectible'];

export const TARGET_TYPES = ['opexCoverage', 'collectionAmount'];

export const OPERATING_PROFILE = {
  monthlyOpex: 1800000,
  baseExclusionRate: 0.18,
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

export const PORTFOLIO_TOTAL = COLLECTIONS.reduce((sum, row) => sum + row.amount, 0);

const zeroValues = Object.fromEntries(LEVERS.map(key => [key, 0]));

const clampValues = (values, enabled) => Object.fromEntries(
  LEVERS.map(key => [key, enabled[key] ? values[key] : 0])
);

export function targetToAmount(scenario, profile = OPERATING_PROFILE) {
  if (scenario.targetType === 'collectionAmount') return scenario.target;
  return profile.monthlyOpex * (scenario.days / 30) * (scenario.target / 100);
}

export function project(values, days, profile = OPERATING_PROFILE) {
  const scale = days / 90;
  const grossInvoiced = PORTFOLIO_TOTAL * (1 + profile.maxInvoicingLift * values.invoicing / 100 * scale);
  const exclusionRate = profile.baseExclusionRate * (1 - profile.maxExclusionReduction * values.exclusions / 100);
  const netInvoiced = grossInvoiced * (1 - exclusionRate);
  const statusReadyRate = Math.min(.98, profile.baseStatusReadyRate + profile.maxStatusLift * values.statusMix / 100 * scale);
  const uncollectibleRate = profile.baseUncollectibleRate * (1 - profile.maxUncollectibleReduction * values.uncollectible / 100);
  const baselineRecovery = COLLECTIONS.reduce((sum, row) => {
    const probability = 1 - Math.pow(1 - row.prob / 100, scale);
    return sum + row.amount * probability;
  }, 0) / PORTFOLIO_TOTAL;
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

function requiredInvoicing(targetAmount, values, days, profile = OPERATING_PROFILE) {
  const withoutInvoicing = project({ ...values, invoicing: 0 }, days, profile);
  if (!withoutInvoicing.collectibleBase || !withoutInvoicing.collectionRate) return Infinity;
  const current = project(values, days, profile);
  const requiredGross = targetAmount / ((withoutInvoicing.collectibleBase / PORTFOLIO_TOTAL) * withoutInvoicing.collectionRate);
  return Math.max(0, requiredGross - current.grossInvoiced);
}

export function analyzeScenario(scenario) {
  const { target, targetType, days, values, enabled } = scenario;
  if (!TARGET_TYPES.includes(targetType) || !Number.isFinite(target) || target <= 0 || ![30, 60, 90].includes(days)
    || LEVERS.some(key => !Number.isFinite(values[key]) || values[key] < 0 || values[key] > 100 || typeof enabled[key] !== 'boolean')) {
    throw new Error('Invalid scenario');
  }

  const targetAmount = targetToAmount(scenario);
  const current = clampValues(values, enabled);
  const upper = Object.fromEntries(LEVERS.map(key => [key, enabled[key] ? 100 : 0]));
  const baseline = project(zeroValues, days);
  const projected = project(current, days);
  const maximum = project(upper, days);
  const exclusionImpact = project({ ...current, exclusions: 100 }, days).collected - projected.collected;
  const sensitivity = LEVERS.map(key => {
    const withMax = project({ ...current, [key]: 100 }, days);
    return { key, enabled: enabled[key], value: current[key], impact: withMax.collected - projected.collected };
  }).sort((a, b) => b.impact - a.impact);

  const recommended = { ...current };
  const actions = [];
  for (const item of sensitivity) {
    if (!item.enabled || project(recommended, days).collected >= targetAmount) continue;
    const from = recommended[item.key];
    const before = project(recommended, days).collected;
    let low = from, high = 100;
    if (project({ ...recommended, [item.key]: 100 }, days).collected >= targetAmount) {
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        if (project({ ...recommended, [item.key]: mid }, days).collected >= targetAmount) high = mid;
        else low = mid;
      }
    }
    recommended[item.key] = Math.ceil(high);
    const gain = project(recommended, days).collected - before;
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
    additionalInvoicingNeeded: requiredInvoicing(targetAmount, current, days),
    maxAdditionalInvoicingNeeded: requiredInvoicing(targetAmount, upper, days),
    achievable: maximum.collected + .01 >= targetAmount,
    meetsTarget: projected.collected + .01 >= targetAmount,
    roadmapOutcome: project(recommended, days)
  };
}
