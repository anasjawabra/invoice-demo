import assert from 'node:assert/strict';
import { analyzeScenario, DEFAULT_SCENARIO, PORTFOLIO_TOTAL, LEVERS } from '../src/data/strategicModel.js';
const base = analyzeScenario(DEFAULT_SCENARIO);
assert.ok(base.baseline <= base.projected && base.projected <= base.maximum && base.maximum <= PORTFOLIO_TOTAL);
assert.ok(base.achievable && base.roadmapOutcome >= DEFAULT_SCENARIO.target);
assert.ok(Math.abs(base.projected + base.actions.reduce((sum, a) => sum + a.gain, 0) - base.roadmapOutcome) < .01);
const impossible = analyzeScenario({ ...DEFAULT_SCENARIO, target: PORTFOLIO_TOTAL + 1 });
assert.equal(impossible.achievable, false);
assert.ok(Math.abs(impossible.roadmapOutcome - impossible.maximum) < .01);
const locked = analyzeScenario({ ...DEFAULT_SCENARIO, enabled: { reminders: false, legal: false, plans: false } });
assert.equal(locked.projected, locked.baseline);
assert.equal(locked.maximum, locked.baseline);
assert.equal(locked.actions.length, 0);
const met = analyzeScenario({ ...DEFAULT_SCENARIO, target: 1 });
assert.equal(met.meetsTarget, true);
assert.equal(met.actions.length, 0);
assert.ok(analyzeScenario({ ...DEFAULT_SCENARIO, days: 30 }).maximum < base.maximum);
for (let mask = 0; mask < 8; mask++) {
  const enabled = Object.fromEntries(LEVERS.map((key, i) => [key, Boolean(mask & (1 << i))]));
  for (const days of [30, 60, 90]) {
    for (const target of [1, 2500000, 3500000, PORTFOLIO_TOTAL + 1]) {
      const result = analyzeScenario({ ...DEFAULT_SCENARIO, enabled, days, target });
      assert.ok(result.baseline <= result.projected && result.projected <= result.maximum + .01);
      assert.ok(result.maximum <= PORTFOLIO_TOTAL);
      if (result.achievable) assert.ok(result.roadmapOutcome + .01 >= target);
      for (const key of LEVERS) if (!enabled[key]) assert.equal(result.recommended[key], 0);
    }
  }
}
for (const target of [0, -1, Infinity, NaN]) assert.throws(() => analyzeScenario({ ...DEFAULT_SCENARIO, target }));
console.log('PASS: 96 scenario combinations plus baseline, feasibility, bounds, locked variables, incremental gains and invalid targets.');
