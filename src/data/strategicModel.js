import { COLLECTIONS } from './mock.js';

// Demonstration assumptions, not a trained forecast. Probabilities are treated
// as 90-day recovery estimates; interventions act on remaining unrecovered value.
export const LEVERS = ['reminders', 'legal', 'plans'];
export const DEFAULT_SCENARIO = {
  target: 3000000, days: 90,
  values: { reminders: 40, legal: 20, plans: 30 },
  enabled: { reminders: true, legal: true, plans: true }
};
export const PORTFOLIO_TOTAL = COLLECTIONS.reduce((sum, row) => sum + row.amount, 0);
export function project(values, days, rows = COLLECTIONS) {
  return rows.reduce((sum, row) => {
    const baseline = 1 - Math.pow(1 - row.prob / 100, days / 90);
    const remaining = (1 - baseline)
      * (1 - .12 * values.reminders / 100 * days / 90)
      * (1 - (row.delayKey === 'high' ? .32 : 0) * values.legal / 100 * days / 90)
      * (1 - (row.prob < 80 ? .18 : 0) * values.plans / 100 * days / 90);
    return sum + row.amount * (1 - remaining);
  }, 0);
}
export function analyzeScenario(scenario) {
  const { target, days, values, enabled } = scenario;
  if (!Number.isFinite(target) || target <= 0 || ![30, 60, 90].includes(days)
    || LEVERS.some(key => !Number.isFinite(values[key]) || values[key] < 0 || values[key] > 100 || typeof enabled[key] !== 'boolean')) {
    throw new Error('Invalid scenario');
  }
  const current = Object.fromEntries(LEVERS.map(key => [key, enabled[key] ? values[key] : 0]));
  const upper = Object.fromEntries(LEVERS.map(key => [key, enabled[key] ? 100 : 0]));
  const baseline = project({ reminders: 0, legal: 0, plans: 0 }, days);
  const projected = project(current, days);
  const maximum = project(upper, days);
  const sensitivity = LEVERS.map(key => ({ key, enabled: enabled[key], value: current[key],
    impact: project({ ...current, [key]: 100 }, days) - projected
  })).sort((a, b) => b.impact - a.impact);
  // Greedy roadmap by marginal impact. This is feasible, not cost-optimal.
  const recommended = { ...current };
  const actions = [];
  for (const item of sensitivity) {
    if (!item.enabled || project(recommended, days) >= target) continue;
    const from = recommended[item.key];
    const before = project(recommended, days);
    let low = from, high = 100;
    if (project({ ...recommended, [item.key]: 100 }, days) >= target) {
      for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2;
        if (project({ ...recommended, [item.key]: mid }, days) >= target) high = mid;
        else low = mid;
      }
    }
    recommended[item.key] = Math.ceil(high);
    const gain = project(recommended, days) - before;
    if (gain > .01) actions.push({ key: item.key, from, to: recommended[item.key], gain });
  }
  const issues = [...COLLECTIONS].map(row => ({ ...row,
    unrecovered: row.amount - project(current, days, [row])
  })).sort((a, b) => b.unrecovered - a.unrecovered);
  return { baseline, projected, maximum, current, sensitivity, recommended, actions, issues,
    achievable: maximum + .01 >= target,
    meetsTarget: projected + .01 >= target,
    roadmapOutcome: project(recommended, days)
  };
}
