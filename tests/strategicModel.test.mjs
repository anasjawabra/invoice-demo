import assert from 'node:assert/strict';
import { analyzeScenario, DEFAULT_SCENARIO, LEVERS, OPERATING_PROFILE, PORTFOLIO_TOTAL, targetToAmount } from '../src/data/strategicModel.js';

const base = analyzeScenario(DEFAULT_SCENARIO);
assert.equal(targetToAmount(DEFAULT_SCENARIO), OPERATING_PROFILE.monthlyOpex * 3 * .65);
assert.ok(base.baseline.collected <= base.projected.collected && base.projected.collected <= base.maximum.collected + .01);
assert.ok(base.projected.grossInvoiced >= PORTFOLIO_TOTAL);
assert.ok(base.projected.excludedAmount < base.projected.grossInvoiced);
assert.ok(base.projected.sustainabilityCoverage > 0);
assert.ok(base.achievable && base.roadmapOutcome.collected + .01 >= base.targetAmount);
assert.ok(Math.abs(base.projected.collected + base.actions.reduce((sum, a) => sum + a.gain, 0) - base.roadmapOutcome.collected) < .01);
assert.ok(base.exclusionImpact > 0);
assert.equal(analyzeScenario({ ...DEFAULT_SCENARIO, targetType: 'collectionAmount', target: 2500000 }).targetAmount, 2500000);

const impossible = analyzeScenario({ ...DEFAULT_SCENARIO, targetType: 'collectionAmount', target: PORTFOLIO_TOTAL * 3 });
assert.equal(impossible.achievable, false);
assert.ok(Math.abs(impossible.roadmapOutcome.collected - impossible.maximum.collected) < .01);
assert.ok(impossible.maxAdditionalInvoicingNeeded > 0);

const locked = analyzeScenario({ ...DEFAULT_SCENARIO, enabled: Object.fromEntries(LEVERS.map(key => [key, false])) });
assert.equal(locked.projected.collected, locked.baseline.collected);
assert.equal(locked.maximum.collected, locked.baseline.collected);
assert.equal(locked.actions.length, 0);

const met = analyzeScenario({ ...DEFAULT_SCENARIO, targetType: 'collectionAmount', target: 1 });
assert.equal(met.meetsTarget, true);
assert.equal(met.actions.length, 0);
assert.equal(met.additionalInvoicingNeeded, 0);
assert.ok(analyzeScenario({ ...DEFAULT_SCENARIO, days: 30 }).maximum.collected < base.maximum.collected);

for (let mask = 0; mask < 32; mask++) {
  const enabled = Object.fromEntries(LEVERS.map((key, i) => [key, Boolean(mask & (1 << i))]));
  for (const days of [30, 60, 90]) {
    for (const targetType of ['opexCoverage', 'collectionAmount']) {
      for (const target of targetType === 'opexCoverage' ? [1, 50, 85, 140] : [1, 2500000, 3500000, PORTFOLIO_TOTAL * 2]) {
        const result = analyzeScenario({ ...DEFAULT_SCENARIO, enabled, days, targetType, target });
        assert.ok(result.baseline.collected <= result.projected.collected + .01);
        assert.ok(result.projected.collected <= result.maximum.collected + .01);
        if (result.achievable) assert.ok(result.roadmapOutcome.collected + .01 >= result.targetAmount);
        for (const key of LEVERS) if (!enabled[key]) assert.equal(result.recommended[key], 0);
      }
    }
  }
}

for (const target of [0, -1, Infinity, NaN]) assert.throws(() => analyzeScenario({ ...DEFAULT_SCENARIO, target }));
assert.throws(() => analyzeScenario({ ...DEFAULT_SCENARIO, targetType: 'collectionRate' }));
console.log('PASS: strategic sustainability model covers target types, feasibility, bounds, locked variables, invoicing needs and invalid inputs.');
