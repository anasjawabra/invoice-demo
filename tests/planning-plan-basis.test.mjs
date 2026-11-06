// Tests of the PERIOD-AWARE plan calculation core (docs/revenue-plans-spec.md §5): planningBasisFromPlan, forecastPlan, planMeasures, loadPlanInputsForPlan.
// The synthetic world is the engine's own (server/engine.js); every expected number is COMPUTED from it by an independent route (a direct engine call), never typed in.
// Run with `npm run test:planplanbasis`.
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { approvedConfigOf, loadPlanInputsForPlan } from '../src/data/planInputs.js';
import { DEFAULT_CONFIG } from '../src/data/revenueMetrics.js';
import { entityTargetsFull } from '../src/data/plans/legacyStore.js';
import { legacyStoreFixture } from '../src/data/plans/planFixtures.js';
import { planningBasisFromPlan, planScope, remainingOf, evenPlan, plannedToDate } from '../src/data/planningBasis.js';
import { forecastPlan, EXPECTED_ACHIEVEMENT_LABEL } from '../src/data/planForecast.js';
import { planMeasures } from '../src/data/plans/planMeasures.js';
import { monthRows, plannedTo, daysInclusive } from '../src/data/plans/planMath.js';
import { HQ_KEY } from '../src/data/appropriations.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const keysDeep = (o, out = new Set()) => { if (Array.isArray(o)) o.forEach((x) => keysDeep(x, out)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.add(k); keysDeep(v, out); } return out; };

const TODAY = '2026-11-06';
const st = loadStore(TODAY); const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: TODAY });
// the data service the page uses (rev.data): the engine, in-process
const rev = { data: { snapshot: async (scope, o = {}) => snapshot(st, { scope, cfg: o.cfg || cfg }), series: async (scope, o = {}) => series(st, { scope, cfg: o.cfg || cfg }) } };
const direct = (from, to, amanah = 'all') => series(st, { scope: { from, to, amanah, source: 'all', scopeType: 'all', muni: 'all', status: 'all' }, cfg });
const directSum = (from, to, amanah = 'all') => direct(from, to, amanah).values.reduce((a, b) => a + b, 0);
const KEYS = entityTargetsFull(legacyStoreFixture({ year: 2026 }), 2026).filter((r) => r.key !== HQ_KEY && r.revenueTarget > 0);
const RY = 'Riyadh Amanah'; const JD = 'Jeddah Amanah'; const EP = 'Eastern Province Amanah';

// ---- a plan view (spec §1) for tests
const equal = { profile: 'equal' };
const mk = (o = {}) => {
  const period = o.period || { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' };
  const allocations = o.allocations || [{ entityKey: RY, amount: 600_000_000, origin: 'manual' }, { entityKey: JD, amount: 400_000_000, origin: 'manual' }];
  const target = o.target !== undefined ? o.target : allocations.reduce((t, a) => t + a.amount, 0);
  return {
    planId: o.planId || 'plan-aaaa0001', versionId: o.versionId || 'plan-aaaa0001@v1', versionNumber: 1, name: o.name || 'خطة اختبار', state: 'active', type: 'baseline', origin: o.origin || 'user',
    period, scope: o.scope || { kind: 'ministry' }, isHistorical: false,
    content: { name: o.name || 'خطة اختبار', scope: o.scope || { kind: 'ministry' }, period, target: { amount: target }, allocations, distribution: o.distribution || equal, ...(o.entityDistributions ? { entityDistributions: o.entityDistributions } : {}), advanced: {} }
  };
};
const run = async (view, { today = TODAY, latest = today, entityKeys = null, reporting = today } = {}) => {
  const inputs = await loadPlanInputsForPlan(rev, { view, reporting, approvedCfg: cfg, entityKeys });
  const basis = planningBasisFromPlan({ view, today, latestDataDate: latest, entityKeys, actual: inputs?.actual || null });
  const fc = forecastPlan(basis, { history: inputs?.history, now: '2026-11-06T09:00:00.000Z' });
  return { inputs, basis, fc, measures: planMeasures(basis, fc) };
};

/* ------------------------------------------------------------------ an annual plan against the independent day-proration formulas */
await ok('an ANNUAL plan (equal profile, Jan–Dec) matches the documented formulas: planned to date = closed months + the cut-off month prorated by days; achievement; signed deviation; vsPlan; day-based required pace; entity Σ', async () => {
  const rows = KEYS.map((r) => ({ entityKey: r.key, amount: Math.round(r.revenueTarget), origin: 'seed' }));
  const view = mk({ allocations: rows });
  const { basis, inputs } = await run(view);
  const T = rows.reduce((t, r) => t + r.amount, 0);
  const planned = plannedToDate(evenPlan(T), TODAY); // 10 closed months + 6/30 of November, of 12
  assert.equal(basis.state, 'ok'); assert.equal(basis.target.value, T, 'the target = Σ allocations to the riyal');
  assert.ok(near(planned, T * (10 + 6 / 30) / 12, 1e-6), 'the formula itself');
  assert.equal(basis.actualToDate, directSum('2026-01-01', TODAY), 'the actual = the engine series to the cut-off (one population)');
  assert.ok(near(basis.plannedToDate, planned, 30), `planned to date ${basis.plannedToDate} vs ${planned}`);
  const A = basis.actualToDate;
  assert.ok(near(basis.deviation.amount, A - planned, 30)); assert.ok(near(basis.deviation.pct, (A - planned) / planned, 1e-6));
  assert.ok(near(basis.achievementToDate, A / T, 1e-8));
  assert.ok(near(basis.vsPlanRatio, A / planned, 1e-6), 'vsPlanRatio = actual ÷ plannedToDate');
  assert.ok(near(basis.pace.required.monthly, (T - A) / 1.8, ((T - A) / 1.8) * 1e-6), 'the day-based required pace: remaining ÷ (24/30 + 1 months)');
  assert.equal(basis.pace.required.remainingDays, 55);
  for (const e of basis.entities.filter((x) => x.hasTarget)) { assert.ok(near(e.plannedToDate, plannedToDate(evenPlan(e.target), TODAY), 2), `${e.key} planned`); assert.equal(e.actual, directSum('2026-01-01', TODAY, e.key), `${e.key} actual = the engine series of that entity`); }
  assert.ok(near(basis.entities.reduce((t, e) => t + e.plannedToDate, 0), basis.plannedToDate, 1e-3), 'Σ entity planned = plan planned');
  assert.ok(near(basis.entities.reduce((t, e) => t + e.deviation, 0) + (basis.remainder || 0), basis.deviation.amount, 1e-3), 'Σ entity deviation + the unattributed remainder = the plan deviation');
  assert.equal(basis.entities.reduce((t, e) => t + e.target, 0), basis.target.value, 'Σ entity targets = the plan target to the riyal');
});

/* ------------------------------------------------------------------ date ranges */
await ok('a SHORT range plan (2026-09-01 → 2026-12-31): months, planned to date, actual, forecast alignment — actual not double-counted', async () => {
  const view = mk({ period: { start: '2026-09-01', end: '2026-12-31', preset: 'range' }, allocations: [{ entityKey: RY, amount: 600_000_000 }, { entityKey: JD, amount: 400_000_000 }] });
  const { basis, fc, inputs, measures } = await run(view);
  assert.equal(basis.state, 'ok'); assert.equal(basis.periodInfo.months, 4); assert.equal(basis.periodInfo.isCalendarYear, false);
  assert.equal(basis.target.value, 1_000_000_000);
  assert.ok(near(basis.plannedToDate, 1_000_000_000 * (2 + 6 / 30) / 4, 1e-3), 'Sep + Oct in full + 6/30 of Nov, 4 equal months');
  const act = directSum('2026-09-01', TODAY); assert.equal(basis.actualToDate, act, 'actual = payments from the period start to the cut-off, counted once');
  assert.equal(basis.months.length, 4); assert.deepEqual(basis.months.map((m) => m.actual === null), [false, false, false, true], 'Dec is after the cut-off: missing, never 0');
  assert.ok(near(basis.achievementToDate, act / 1e9, 1e-12));
  assert.ok(near(basis.vsPlanRatio, act / basis.plannedToDate, 1e-12)); assert.ok(near(basis.deviation.amount, act - basis.plannedToDate, 1e-6)); assert.ok(near(basis.deviation.pct, (act - basis.plannedToDate) / basis.plannedToDate, 1e-12));
  // the dates
  assert.equal(basis.reportingCutoff, TODAY); assert.equal(basis.latestActualDataDate, TODAY); assert.equal(basis.lastCompleteMonth, '2026-10'); assert.equal(basis.forecastGeneratedAt, null);
  // forecast: rate = mean(Jul, Aug, Sep... no: the last THREE complete months = Aug, Sep, Oct) — the window starts BEFORE the period (August)
  assert.equal(fc.state, 'ok'); assert.deepEqual(fc.method.window.months, ['2026-08', '2026-09', '2026-10']); assert.equal(fc.method.window.startsBeforePeriod, true);
  const rate = (directSum('2026-08-01', '2026-08-31') + directSum('2026-09-01', '2026-09-30') + directSum('2026-10-01', '2026-10-31')) / 3;
  assert.ok(near(fc.monthlyRate, rate, 1e-6));
  const remFrac = 24 / 30 + 31 / 31; assert.ok(near(fc.remaining.months, remFrac, 1e-12)); assert.equal(fc.remaining.days, 24 + 31);
  assert.ok(near(fc.forecastTotal - basis.actualToDate, rate * remFrac, 1e-3), 'forecast − actual = rate × remaining day fraction EXACTLY (the partial month is counted once)');
  assert.ok(near(fc.expectedRemaining, rate * remFrac, 1e-3));
  assert.ok(near(fc.expectedAchievementPct, fc.forecastTotal / 1e9, 1e-12), 'expected % = forecast ÷ the full-period target'); assert.equal(fc.expectedAchievementLabel.ar, 'نسبة تحقيق المستهدف المتوقعة بنهاية الفترة'); assert.equal(EXPECTED_ACHIEVEMENT_LABEL.ar, fc.expectedAchievementLabel.ar);
  assert.ok(near(fc.gap, 1e9 - fc.forecastTotal, 1e-3)); assert.equal(fc.gapKind, fc.gap > 0 ? 'shortfall' : 'surplus'); assert.ok(fc.gapLabel.ar.length > 0);
  assert.equal(fc.lastCompleteMonth, '2026-10'); assert.equal(fc.forecastGeneratedAt, '2026-11-06T09:00:00.000Z'); assert.equal(fc.reportingCutoff, TODAY);
  assert.ok(near(fc.bridge.gap, fc.bridge.behindAtCutoff + fc.bridge.uncoveredRemainingPlan, 1e-3), 'T − F = (P − C) + uncovered remaining plan');
  assert.ok(near(fc.cumulative[3], fc.forecastTotal, 1e-3), 'the forecast path ends at the forecast total');
  assert.equal(inputs.history.months.length, 3);
  // measures: the single headline set
  assert.equal(measures.target, 1e9); assert.equal(measures.actual, act); assert.equal(measures.expected.pct, fc.expectedAchievementPct); assert.equal(measures.expected.gap, fc.gap); assert.equal(measures.deviation.amount, basis.deviation.amount);
  assert.equal(measures.dates.lastCompleteMonth, '2026-10'); assert.equal(measures.dates.forecastGeneratedAt, fc.forecastGeneratedAt);
});

await ok('a range starting MID-MONTH (2026-09-16 → 2026-12-15): the first and last months are prorated by their period days; the payments before the start are not in the actual', async () => {
  const view = mk({ period: { start: '2026-09-16', end: '2026-12-15', preset: 'range' }, allocations: [{ entityKey: RY, amount: 900_000_000 }] });
  const { basis, fc, inputs } = await run(view);
  const rows = monthRows(view.period);
  assert.deepEqual(rows.map((r) => r.days), [15, 31, 30, 15]);
  assert.equal(basis.target.value, 900_000_000);
  const w = [15 / 30, 1, 1, 15 / 31]; const sw = w.reduce((a, b) => a + b, 0);
  const amounts = w.map((x) => 900_000_000 * x / sw);
  assert.ok(near(basis.months[0].planned + basis.months[1].planned + basis.months[2].planned + basis.months[3].planned, 900_000_000, 1e-9), 'the months add up to the target to the riyal');
  basis.months.forEach((m, i) => assert.ok(near(m.planned, amounts[i], 1), `month ${i}`));
  const exp = amounts[0] + amounts[1] + amounts[2] * (daysInclusive('2026-11-01', TODAY) / 30);
  assert.ok(near(basis.plannedToDate, exp, 2));
  // the actual is the payments from 16 Sep (not 1 Sep) for the whole Ministry (Riyadh alone holds the allocation; the rest is the remainder)
  assert.equal(basis.actualToDate, directSum('2026-09-16', TODAY)); assert.ok(basis.actualToDate < directSum('2026-09-01', TODAY));
  assert.equal(basis.months[0].actual, directSum('2026-09-16', '2026-09-30'), 'the first month counts the period days only');
  // remaining days after 6 Nov: 24 of November, 15 of December
  assert.equal(fc.remaining.days, 24 + 15); assert.ok(near(fc.remaining.months, 24 / 30 + 15 / 31, 1e-12));
  assert.ok(near(fc.forecastTotal - basis.actualToDate, fc.monthlyRate * (24 / 30 + 15 / 31), 1e-3));
  // the history: the complete months are calendar months, so Aug (before the period) is fetched whole, Sep (partly before the period) too
  assert.deepEqual(inputs.history.months.map((m) => m.ym), ['2026-08', '2026-09', '2026-10']);
  assert.equal(inputs.history.months[1].value, directSum('2026-09-01', '2026-09-30'), 'September history is the WHOLE calendar month, not the period part');
  assert.equal(inputs.history.months[0].value, directSum('2026-08-01', '2026-08-31'));
  assert.equal(basis.remainder, basis.actualToDate - basis.entities[0].actual, 'the collections of entities without an allocation are the unattributed remainder');
});

await ok('a FUTURE plan: explicit state, no actual, no deviation, no forecast, no required pace; a ZERO and a missing target are explicit', async () => {
  const fut = await run(mk({ period: { start: '2027-01-01', end: '2027-12-31', preset: 'fiscal-year' } }));
  assert.equal(fut.basis.state, 'future_period'); assert.equal(fut.basis.actualToDate, null); assert.equal(fut.basis.deviation.amount, null); assert.equal(fut.basis.reportingCutoff, null);
  // the REQUIRED PACE of an upcoming period is the period's own: target ÷ the days of the period (365) and ÷ its months by days (12) — nothing is collected inside it yet
  assert.deepEqual([fut.basis.pace.required.state, fut.basis.pace.required.upcoming, fut.basis.pace.required.remainingDays], ['ok', true, 365]); assert.ok(near(fut.basis.pace.required.daily, 1_000_000_000 / 365, 1e-6)); assert.ok(near(fut.basis.pace.required.monthly, 1_000_000_000 / 12, 1e-6)); assert.equal(fut.basis.remainingTarget, 1_000_000_000);
  assert.equal(fut.fc.state, 'future_period'); assert.equal(fut.fc.forecastTotal, null); assert.equal(fut.fc.expectedAchievementPct, null); assert.equal(fut.measures.expected.pct, null); assert.equal(fut.measures.achievementToDate, null);
  assert.equal(fut.inputs.future, true);
  assert.equal(fut.basis.target.value, 1_000_000_000, 'the plan side still shows the target');
  const zero = await run(mk({ allocations: [], target: 0 }));
  assert.equal(zero.basis.state, 'no_target'); assert.equal(zero.basis.reason, 'zero_target'); assert.equal(zero.basis.achievementToDate, null); assert.equal(zero.basis.deviation.amount, null); assert.equal(zero.fc.state, 'no_target'); assert.equal(zero.fc.forecastTotal, null);
  const nul = await run(mk({ allocations: [], target: null }));
  assert.equal(nul.basis.state, 'no_target'); assert.equal(nul.basis.reason, 'target_missing');
});

await ok('a COMPLETED plan (2026-01-01 → 2026-06-30): final achievement, no required pace, no forecast; the actual stops at the period end', async () => {
  const view = mk({ period: { start: '2026-01-01', end: '2026-06-30', preset: 'range' } });
  const { basis, fc, measures, inputs } = await run(view);
  assert.equal(basis.state, 'completed'); assert.equal(basis.reportingCutoff, '2026-06-30'); assert.equal(basis.actualToDate, directSum('2026-01-01', '2026-06-30'));
  assert.ok(near(basis.plannedToDate, 1e9, 1e-6), 'the whole plan is due'); assert.equal(basis.pace.required.state, 'none'); assert.equal(basis.pace.required.reason, 'period_ended');
  assert.equal(basis.outcome.achieved, basis.actualToDate >= 1e9); assert.ok(near(basis.outcome.pct, basis.actualToDate / 1e9, 1e-12)); assert.ok(near(basis.achievementToDate, basis.actualToDate / 1e9, 1e-12));
  assert.equal(fc.state, 'completed'); assert.equal(fc.forecastTotal, null); assert.equal(fc.expectedAchievementPct, null); assert.equal(fc.gap, null);
  assert.equal(measures.final.pct, basis.achievementToDate); assert.equal(measures.expected.pct, null);
  assert.equal(inputs.meta.cutoff, '2026-06-30');
  assert.equal(basis.months.every((m) => m.complete), true);
});

/* ------------------------------------------------------------------ the forecast rule */
await ok('rate = mean of the last THREE complete OBSERVED months: a null month is excluded (never 0); fewer than three → insufficient_history with no percentage', async () => {
  const view = mk({ period: { start: '2026-09-01', end: '2026-12-31', preset: 'range' } });
  const { basis, inputs } = await run(view);
  const h = (months) => ({ ...inputs.history, months });
  const full = forecastPlan(basis, { history: h([{ ym: '2026-07', value: 900 }, { ym: '2026-08', value: 100 }, { ym: '2026-09', value: 200 }, { ym: '2026-10', value: 300 }]) });
  assert.equal(full.state, 'ok'); assert.deepEqual(full.method.window.months, ['2026-08', '2026-09', '2026-10']); assert.equal(full.monthlyRate, 200, 'the window is the LAST three: 100,200,300');
  const holed = forecastPlan(basis, { history: h([{ ym: '2026-07', value: 900 }, { ym: '2026-08', value: 100 }, { ym: '2026-09', value: null }, { ym: '2026-10', value: 300 }]) });
  assert.equal(holed.state, 'ok'); assert.deepEqual(holed.method.window.months, ['2026-07', '2026-08', '2026-10'], 'the null September is skipped'); assert.equal(holed.monthlyRate, (900 + 100 + 300) / 3, 'never (…+0)/3');
  const few = forecastPlan(basis, { history: h([{ ym: '2026-08', value: 100 }, { ym: '2026-09', value: null }, { ym: '2026-10', value: 300 }]) });
  assert.equal(few.state, 'insufficient_history'); assert.equal(few.expectedAchievementPct, null); assert.equal(few.forecastTotal, null); assert.equal(few.gap, null); assert.equal(few.available, 2); assert.ok(few.required, 'the required pace is still reported');
  assert.equal(forecastPlan(basis, { history: h([{ ym: '2026-08', value: 100 }, { ym: '2026-09', value: 0 }, { ym: '2026-10', value: 300 }]) }).monthlyRate, 400 / 3, 'an OBSERVED zero is a real value');
  const incomplete = forecastPlan(basis, { history: h([{ ym: '2026-08', value: 100 }, { ym: '2026-09', value: 200 }, { ym: '2026-10', value: 300 }, { ym: '2026-11', value: 5 }]) });
  assert.equal(incomplete.monthlyRate, 200, 'the partial cut-off month is never a data point');
  const m = planMeasures(basis, few); assert.equal(m.expected.pct, null); assert.equal(m.expected.state, 'insufficient_history'); assert.ok(m.reasons.some((r) => r.code === 'insufficient_history'));
});

await ok('a history window that ENDS BEFORE the cut-off is accepted (a mid-month cut-off; a month-end cut-off closes its own month)', async () => {
  const view = mk({ period: { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' } });
  const a = await run(view, { today: '2026-11-06' }); assert.equal(a.fc.state, 'ok'); assert.equal(a.fc.method.window.endsBeforeCutoff, true); assert.equal(a.fc.lastCompleteMonth, '2026-10');
  const b = await run(view, { today: '2026-10-31' });
  // the engine data ends at TODAY; a cut-off of 31 Oct is inside it
  assert.equal(b.basis.reportingCutoff, '2026-10-31'); assert.equal(b.fc.state, 'ok'); assert.equal(b.fc.lastCompleteMonth, '2026-10'); assert.equal(b.fc.method.window.endsBeforeCutoff, false); assert.deepEqual(b.fc.method.window.months, ['2026-08', '2026-09', '2026-10']);
  assert.ok(near(b.fc.remaining.months, 2, 1e-12), 'Nov + Dec whole months');
});

await ok('incompatible or stale inputs are refused with NO numbers (plan id, version, scope, period; cut-off → stale); an unlabelled history is refused', async () => {
  const view = mk({ period: { start: '2026-09-01', end: '2026-12-31', preset: 'range' } });
  const { basis, inputs } = await run(view);
  const refuse = (fc, state) => { assert.equal(fc.state, state); assert.ok(fc.message && fc.message.ar); for (const k of ['forecastTotal', 'expectedAchievementPct', 'gap', 'monthlyRate', 'expectedRemaining']) assert.equal(fc[k], null, k); };
  refuse(forecastPlan(basis, { history: { ...inputs.history, planId: 'plan-other' } }), 'incompatible_input');
  refuse(forecastPlan(basis, { history: { ...inputs.history, versionId: 'plan-aaaa0001@v2' } }), 'incompatible_input');
  refuse(forecastPlan(basis, { history: { ...inputs.history, scopeKey: 'entities:Riyadh Amanah' } }), 'incompatible_input');
  refuse(forecastPlan(basis, { history: { ...inputs.history, period: { start: '2026-09-02', end: '2026-12-31' } } }), 'incompatible_input');
  refuse(forecastPlan(basis, { history: { ...inputs.history, cutoff: '2026-11-05' } }), 'stale_input');
  refuse(forecastPlan(basis, { history: inputs.history.months }), 'incompatible_input');
  refuse(forecastPlan(basis, {}), 'incompatible_input');
  // the BASIS refuses a foreign actual too
  const bad = planningBasisFromPlan({ view, today: TODAY, actual: { ...inputs.actual, meta: { ...inputs.actual.meta, versionId: 'plan-aaaa0001@v9' } } });
  assert.equal(bad.state, 'incompatible_input'); assert.equal(bad.actualToDate, null); assert.equal(bad.plannedToDate, null); assert.equal(bad.target.value, null);
  const stale = planningBasisFromPlan({ view, today: TODAY, actual: { ...inputs.actual, meta: { ...inputs.actual.meta, cutoff: '2026-11-01' } } });
  assert.equal(stale.state, 'stale_input'); assert.equal(stale.actualToDate, null);
  const drift = planningBasisFromPlan({ view: mk({ period: { start: '2026-09-01', end: '2026-12-30', preset: 'range' } }), today: TODAY, actual: inputs.actual });
  assert.equal(drift.state, 'incompatible_input', 'another period');
  assert.equal(planMeasures(bad, forecastPlan(bad, { history: inputs.history })).actual, null);
});

await ok('there is no draft state any more: a plan view is always a saved plan or the client working copy — the basis has no draft flag/state, the forecast no draft state, and an incomplete configuration still computes with its gaps stated', async () => {
  const { basis, fc } = await run(mk({ versionId: 'plan-aaaa0001@working' }));
  assert.equal(basis.state, 'ok'); assert.ok(!('isDraft' in basis.flags) && !('isDraft' in basis)); assert.notEqual(fc.state, 'draft'); assert.equal(fc.state, 'ok');
  assert.equal(fc.forecastTotal > 0, true, 'a working copy shows its expected figure as a live preview'); assert.ok(!/draft|مسودة|تفعيل/i.test(JSON.stringify(basis.notices)), 'no draft / activation wording in the notices');
});

/* ------------------------------------------------------------------ scope, entities, viewers */
await ok('Σ entity = plan to the riyal; the rounding remainder is returned; entity override distributions are honoured', async () => {
  const view = mk({ period: { start: '2026-09-01', end: '2026-11-30', preset: 'range' }, allocations: [{ entityKey: RY, amount: 1_000_000_001 }, { entityKey: JD, amount: 500_000_000 }, { entityKey: EP, amount: 7 }], entityDistributions: { [EP]: { profile: 'manual', weights: { '2026-09': 5000, '2026-10': 5000, '2026-11': 0 } } } });
  const { basis } = await run(view);
  assert.equal(basis.target.value, 1_500_000_008); assert.equal(basis.allocation.allocated, 1_500_000_008); assert.equal(basis.allocation.complete, true);
  assert.equal(basis.months.reduce((t, m) => t + m.planned, 0), 1_500_000_008, 'the months add up to the target to the riyal');
  for (let i = 0; i < 3; i += 1) assert.equal(basis.months[i].planned, basis.entities.reduce((t, e) => t + e.monthly[i], 0), `month ${i}: Σ entity months = plan month`);
  for (const e of basis.entities) assert.equal(e.monthly.reduce((a, b) => a + b, 0), e.target, `${e.key}: months add up`);
  assert.ok(basis.allocation.rounding.units > 0, 'a rounding remainder exists and is reported'); assert.ok(basis.allocation.rounding.byEntity.some((r) => r.entityKey === RY));
  assert.equal(basis.entities.find((e) => e.key === EP).monthly[2], 0, 'the manual profile gives November 0');
  assert.ok(near(basis.entities.reduce((t, e) => t + e.plannedToDate, 0), basis.plannedToDate, 1e-3));
  // an incomplete configuration: unallocated and excess are stated, nothing is distributed
  const draft = mk({ allocations: [{ entityKey: RY, amount: 300 }], target: 1000 });
  const d = planningBasisFromPlan({ view: draft, today: TODAY });
  assert.equal(d.allocation.unallocated, 700); assert.equal(d.allocation.excess, 0); assert.equal(d.allocation.complete, false); assert.ok(d.notices.some((x) => x.code === 'allocation_incomplete'));
  const over = planningBasisFromPlan({ view: mk({ allocations: [{ entityKey: RY, amount: 1300 }], target: 1000 }), today: TODAY });
  assert.equal(over.allocation.excess, 300); assert.equal(over.allocation.unallocated, 0);
});

await ok('a RESTRICTED viewer: the plan keeps its allocations; only the rows they may see are shown and summed; the total is «إجمالي الجهات المتاحة لك»; the loader asks the engine for exactly those entities', async () => {
  const view = mk({ allocations: [{ entityKey: RY, amount: 600_000_000 }, { entityKey: JD, amount: 400_000_000 }] });
  const full = await run(view);
  const lim = await run(view, { entityKeys: [RY] });
  assert.equal(lim.basis.restricted, true); assert.equal(lim.basis.scopeKind, 'available'); assert.equal(lim.basis.scopeLabel.ar, 'إجمالي الجهات المتاحة لك');
  assert.deepEqual(lim.basis.entities.map((e) => e.key), [RY]); assert.equal(lim.basis.target.value, 600_000_000);
  assert.equal(lim.basis.entities[0].plannedToDate, full.basis.entities.find((e) => e.key === RY).plannedToDate, 'the same planned for the same entity whoever looks');
  assert.equal(lim.basis.entities[0].target, full.basis.entities.find((e) => e.key === RY).target);
  assert.equal(lim.basis.actualToDate, directSum('2026-01-01', TODAY, RY), 'the actual is the visible entity only'); assert.equal(lim.basis.actualToDate, lim.basis.entities[0].actual);
  assert.equal(lim.basis.remainder, null); assert.notEqual(lim.basis.scopeKey, full.basis.scopeKey);
  assert.equal(lim.fc.state, 'ok', 'a restricted viewer’s history is for the same visible set');
  // an input prepared for the unrestricted view is refused for the restricted one
  const cross = planningBasisFromPlan({ view, today: TODAY, entityKeys: [RY], actual: full.inputs.actual }); assert.equal(cross.state, 'incompatible_input');
  assert.equal(planScope({ kind: 'ministry' }, [RY]).amanah.length, 1);
});

await ok('an ENTITY-scope plan: ONE engine call with the entity list; the actual = Σ of the entities and equals the sum of the single-entity series', async () => {
  const view = mk({ scope: { kind: 'entities', entityKeys: [RY, JD] }, allocations: [{ entityKey: RY, amount: 600_000_000 }, { entityKey: JD, amount: 400_000_000 }] });
  let calls = 0; const counting = { data: { snapshot: (s, o) => { calls += 1; return rev.data.snapshot(s, o); }, series: (s, o) => { calls += 1; return rev.data.series(s, o); } } };
  const inputs = await loadPlanInputsForPlan(counting, { view, reporting: TODAY, approvedCfg: cfg });
  assert.ok(calls <= 3, `at most snapshot + series (+ one history series): ${calls}`);
  const basis = planningBasisFromPlan({ view, today: TODAY, actual: inputs.actual });
  assert.equal(basis.scopeKind, 'entities'); assert.equal(basis.state, 'ok');
  assert.equal(basis.actualToDate, directSum('2026-01-01', TODAY, RY) + directSum('2026-01-01', TODAY, JD));
  assert.equal(basis.actualToDate, basis.entities.reduce((t, e) => t + e.actual, 0)); assert.equal(basis.remainder, 0);
  assert.equal(inputs.meta.scopeKey, basis.scopeKey);
  assert.equal(inputs.history.months.length, 3);
});

await ok('a period starting before the data (2024) : the months before 2025-01-01 are null (not 0) and the gap is stated', async () => {
  const view = mk({ period: { start: '2024-07-01', end: '2025-03-31', preset: 'range' } });
  const inputs = await loadPlanInputsForPlan(rev, { view, reporting: '2025-03-31', approvedCfg: cfg });
  assert.deepEqual(inputs.actual.monthly.slice(0, 6), [null, null, null, null, null, null], 'Jul–Dec 2024 are not observed'); assert.notEqual(inputs.actual.monthly[6], null);
  assert.equal(inputs.partialDataStart, '2025-01-01');
  const basis = planningBasisFromPlan({ view, today: '2025-03-31', latestDataDate: '2025-03-31', actual: inputs.actual });
  assert.equal(basis.flags.incompleteActual, true); assert.ok(basis.notices.some((x) => x.code === 'data_gap')); assert.equal(basis.actualToDate, directSum('2025-01-01', '2025-03-31'));
  assert.equal(basis.state, 'completed');
});

await ok('stale data and a latest data date before the cut-off: the four dates stay distinct; the cut-off follows the data', async () => {
  const view = mk();
  const inputs = await loadPlanInputsForPlan(rev, { view, reporting: '2026-11-02', approvedCfg: cfg });
  const basis = planningBasisFromPlan({ view, today: TODAY, latestDataDate: '2026-11-02', actual: inputs.actual });
  assert.equal(basis.reportingCutoff, '2026-11-02'); assert.equal(basis.latestActualDataDate, '2026-11-02'); assert.equal(basis.lastCompleteMonth, '2026-10'); assert.equal(basis.stale.is, true); assert.equal(basis.stale.days, 4);
  assert.ok(basis.notices.some((x) => x.code === 'stale_data'));
  const fc = forecastPlan(basis, { history: inputs.history, now: new Date('2026-11-06T10:00:00Z') });
  assert.equal(fc.state, 'ok'); assert.equal(fc.forecastGeneratedAt, '2026-11-06T10:00:00.000Z'); assert.notEqual(fc.forecastGeneratedAt.slice(0, 10), fc.reportingCutoff);
  assert.ok(near(fc.remaining.days, 28 + 31));
});

/* ------------------------------------------------------------------ the rules of the core */
await ok('expected % = forecast ÷ the FULL target, uncapped (above 100 % allowed); achievement-to-date is uncapped too; surplus has a negative gap and its own label', async () => {
  const view = mk({ allocations: [{ entityKey: RY, amount: 1_000_000 }] });
  const { basis, fc, measures } = await run(view);
  assert.ok(basis.achievementToDate > 1, `achievement ${basis.achievementToDate}`); assert.ok(fc.expectedAchievementPct > 1); assert.ok(near(fc.expectedAchievementPct, fc.forecastTotal / 1_000_000, 1e-9));
  assert.ok(fc.gap < 0); assert.equal(fc.gapKind, 'surplus'); assert.equal(fc.gapLabel.en, 'Expected surplus above the target'); assert.equal(measures.expected.gap, fc.gap);
  assert.equal(basis.pace.required.state, 'none'); assert.equal(basis.pace.required.reason, 'target_reached'); assert.ok(basis.notices.some((x) => x.code === 'above_target'));
});

await ok('no tolerance, no status classification and no probability anywhere in the basis, the forecast or the measures; vsPlanRatio null with a reason when planned is 0', async () => {
  const { basis, fc, measures } = await run(mk({ period: { start: '2026-09-01', end: '2026-12-31', preset: 'range' } }));
  for (const o of [basis, fc, measures]) { const k = [...keysDeep(o)]; for (const bad of ['tolerance', 'status', 'probability', 'verdict', 'label_status', 'on_plan', 'ahead', 'behind']) assert.ok(!k.includes(bad), `no «${bad}» key`); }
  assert.equal(fc.probabilityStatus, 'unsupported'); assert.ok(fc.probabilityMessage.ar.length > 0);
  const text = JSON.stringify([basis, fc, measures]); assert.ok(!/المقبوض|مقبوض/.test(text), 'the retired term is absent');
  assert.ok(!/وفق الخطة|متقدم عن الخطة|متأخر عن الخطة/.test(text), 'no on plan / ahead / behind wording');
  // planned 0 at the cut-off: a manual profile that starts later
  const view = mk({ period: { start: '2026-09-01', end: '2026-12-31', preset: 'range' }, distribution: { profile: 'manual', weights: { '2026-09': 0, '2026-10': 0, '2026-11': 5000, '2026-12': 5000 } } });
  const b = planningBasisFromPlan({ view, today: '2026-10-15', latestDataDate: '2026-10-15', actual: { monthly: [100, 50], byEntity: {} } });
  assert.equal(b.plannedToDate, 0); assert.equal(b.vsPlanRatio, null); assert.equal(b.vsPlanReason, 'planned_zero'); assert.equal(b.deviation.amount, 150); assert.equal(b.deviation.pct, null);
  assert.ok(planMeasures(b, null).reasons.some((r) => r.code === 'planned_zero'));
});

await ok('missing data is not zero: no actual loaded → no_data (no achievement); a null month inside the period stays null; the signed deviation sign is right', async () => {
  const view = mk({ period: { start: '2026-09-01', end: '2026-12-31', preset: 'range' } });
  const none = planningBasisFromPlan({ view, today: TODAY });
  assert.equal(none.state, 'no_data'); assert.equal(none.reason, 'actual_not_loaded'); assert.equal(none.actualToDate, null); assert.equal(none.achievementToDate, null); assert.equal(none.deviation.amount, null); assert.equal(none.deviation.unavailable, 'no_actual'); assert.equal(none.vsPlanRatio, null);
  assert.ok(none.plannedToDate > 0, 'the plan side is still known');
  const holed = planningBasisFromPlan({ view, today: TODAY, actual: { monthly: [200_000_000, null, 100_000_000], byEntity: {} } });
  assert.equal(holed.months[1].actual, null); assert.equal(holed.actualToDate, 300_000_000); assert.ok(holed.flags.incompleteActual); assert.deepEqual(holed.missingMonths, ['2026-10']);
  assert.ok(holed.deviation.amount < 0, 'behind: negative'); assert.ok(near(holed.deviation.amount, 300_000_000 - holed.plannedToDate, 1e-6));
  const ahead = planningBasisFromPlan({ view, today: TODAY, actual: { monthly: [900_000_000, 900_000_000, 900_000_000], byEntity: {} } }); assert.ok(ahead.deviation.amount > 0);
  const before = planningBasisFromPlan({ view, today: TODAY, latestDataDate: '2026-08-15', actual: { monthly: [1] } });
  assert.equal(before.state, 'no_data'); assert.equal(before.reason, 'no_data_in_period');
});

await ok('remainingOf counts the days after the cut-off up to the period end', async () => {
  assert.equal(remainingOf(monthRows({ start: '2026-11-01', end: '2026-11-30' }), '2026-11-06').days, 24);
});

console.log(`planning-plan-basis: ${n} tests passed`);
