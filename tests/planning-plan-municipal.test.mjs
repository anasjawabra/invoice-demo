// Tests of the MUNICIPALITY dimension of the plan calculation core (docs/revenue-plans-spec.md §9): the VIEW scope { amanah, muni } of planningBasisFromPlan / forecastPlan / planMeasures / loadPlanInputsForPlan.
// The synthetic world is the engine's own (server/engine.js); every expected number is COMPUTED from it by an independent route (a direct engine call with the municipality filter), never typed in.
// Run with `npm run test:planplanmuni`.
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { approvedConfigOf, loadPlanInputsForPlan } from '../src/data/planInputs.js';
import { DEFAULT_CONFIG } from '../src/data/revenueMetrics.js';
import { planningBasisFromPlan, resolveViewScope, municipalAllocationsOf, UNALLOCATED_MUNI_KEY, NO_MUNICIPAL_TARGET } from '../src/data/planningBasis.js';
import { forecastPlan } from '../src/data/planForecast.js';
import { planMeasures } from '../src/data/plans/planMeasures.js';
import { monthRows, municipalMonthlyBreakdown, municipalMonthly } from '../src/data/plans/planMath.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const sum = (a, f = (x) => x) => a.reduce((t, x) => t + f(x), 0);
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

const TODAY = '2026-11-06';
const st = loadStore(TODAY); const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: TODAY });
let calls = 0;
const rev = { data: { snapshot: async (scope, o = {}) => { calls += 1; return snapshot(st, { scope, cfg: o.cfg || cfg }); }, series: async (scope, o = {}) => { calls += 1; return series(st, { scope, cfg: o.cfg || cfg }); } } };
const sc = (from, to, amanah = 'all', muni = 'all') => ({ from, to, amanah, source: 'all', scopeType: 'all', muni, status: 'all' });
const directSum = (from, to, amanah = 'all', muni = 'all') => series(st, { scope: sc(from, to, amanah, muni), cfg }).values.reduce((a, b) => a + b, 0);
const RY = 'Riyadh Amanah'; const JD = 'Jeddah Amanah';
const J = (k) => `MREF-002-${String(k).padStart(3, '0')}`; // Jeddah's municipalities (internal reference ids)
const jKey = (id) => `${JD}|${id}`;
const equal = { profile: 'equal' };

// Jeddah: 3 bn allocated; five municipalities carry an explicit allocation (1.1 bn), the rest of the Amanah (1.9 bn) is «غير موزع على البلديات». J(6) has collections and NO allocation.
const MUNI_ALLOC = [
  { entityKey: JD, muniId: J(1), amount: 100_000_000, origin: 'manual' }, { entityKey: JD, muniId: J(2), amount: 400_000_000, origin: 'manual' }, { entityKey: JD, muniId: J(3), amount: 150_000_000, origin: 'manual' },
  { entityKey: JD, muniId: J(5), amount: 200_000_000, origin: 'manual' }, { entityKey: JD, muniId: J(8), amount: 250_000_000, origin: 'distributed' }
];
const mk = (o = {}) => {
  const period = o.period || { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' };
  const allocations = o.allocations || [{ entityKey: RY, amount: 6_000_000_000, origin: 'manual' }, { entityKey: JD, amount: 3_000_000_000, origin: 'manual' }];
  const target = allocations.reduce((t, a) => t + (a.amount || 0), 0);
  const municipalAllocations = o.municipalAllocations !== undefined ? o.municipalAllocations : MUNI_ALLOC;
  return {
    planId: 'plan-bbbb0001', versionId: 'plan-bbbb0001@v1', versionNumber: 1, name: 'خطة اختبار', state: 'active', type: 'baseline', origin: 'user',
    period, scope: o.scope || { kind: 'ministry' }, isHistorical: false,
    content: { name: 'خطة اختبار', scope: o.scope || { kind: 'ministry' }, period, target: { amount: o.target !== undefined ? o.target : target }, allocations, ...(municipalAllocations ? { municipalAllocations } : {}), distribution: o.distribution || equal, ...(o.entityDistributions ? { entityDistributions: o.entityDistributions } : {}), advanced: {} }
  };
};
const run = async (view, viewScope, { today = TODAY, entityKeys = null } = {}) => {
  const inputs = await loadPlanInputsForPlan(rev, { view, reporting: today, approvedCfg: cfg, entityKeys, viewScope });
  const basis = planningBasisFromPlan({ view, today, latestDataDate: today, entityKeys, actual: inputs?.actual || null, viewScope });
  const fc = forecastPlan(basis, { history: inputs?.history, now: '2026-11-06T09:00:00.000Z' });
  return { inputs, basis, fc, measures: planMeasures(basis, fc) };
};
const JD_VIEW = { amanah: JD, muni: 'all' };

/* ------------------------------------------------------------------ backward compatibility */
await ok('NO municipality in the view scope ⇒ exactly today\'s behaviour (the default scope is identical to none); the view scope is an echo, not a plan change', async () => {
  const view = mk();
  const a = await run(view, undefined); const b = await run(view, { amanah: 'all', muni: 'all' }); const c = await run(view, null);
  assert.deepEqual(a.basis, b.basis); assert.deepEqual(a.basis, c.basis); assert.deepEqual(a.measures, b.measures);
  assert.deepEqual(a.basis.viewScope, { amanah: 'all', muni: 'all' }); assert.equal(a.basis.municipalState, null); assert.equal(a.basis.rowsKind, 'entity'); assert.ok(!a.basis.scopeKey.includes('view:'));
  assert.equal(a.basis.entities.length, 2); assert.ok(a.basis.entities.every((e) => e.rowKind === 'entity'));
  assert.equal(resolveViewScope({ scope: view.scope }).mode, 'none');
});

/* ------------------------------------------------------------------ the Amanah view */
await ok('AMANAH view with municipal allocations: rows by municipality + «غير موزع على البلديات»; Σ rows = the Amanah for the TARGET, the ACTUAL and the PLANNED (to the riyal)', async () => {
  const view = mk(); const { basis, inputs, measures } = await run(view, JD_VIEW);
  assert.equal(basis.state, 'ok'); assert.equal(basis.scopeKind, 'amanah'); assert.equal(basis.rowsKind, 'municipality'); assert.equal(basis.municipalState, 'distributed');
  assert.equal(basis.target.value, 3_000_000_000, 'the Amanah target = its own allocation'); assert.deepEqual(basis.viewLabel.ar, 'أمانة محافظة جدة');
  const rows = basis.entities; const un = rows.find((r) => r.key === UNALLOCATED_MUNI_KEY);
  assert.ok(un && rows[rows.length - 1] === un, 'the unallocated row is the LAST row'); assert.equal(un.rowKind, 'unallocated_muni'); assert.equal(un.label.ar, 'غير موزع على البلديات');
  assert.equal(un.target, 3_000_000_000 - 1_100_000_000);
  // TARGET: Σ municipal allocations + unallocated = the Amanah target
  assert.equal(sum(rows, (r) => r.target || 0), basis.target.value);
  assert.equal(sum(rows.filter((r) => r.rowKind === 'municipality' && r.hasTarget), (r) => r.target), 1_100_000_000);
  // ACTUAL: every payment in ONE bucket — Σ municipality buckets + unattributed = the Amanah's actual (independent: one direct series call over the whole Amanah)
  const amanahActual = directSum('2026-01-01', TODAY, [JD]);
  assert.equal(basis.actualToDate, amanahActual); assert.ok(near(sum(rows, (r) => r.actual), amanahActual, 1e-3), 'Σ row actuals = the Amanah actual'); assert.ok(near(basis.remainder, 0, 1e-3), 'nothing unattributed outside the rows');
  const un0 = inputs.actual.unattributed; assert.ok(un0.total > 0 && near(un0.total, un0.direct + un0.notSpecified + un0.unresolved, 1e-6)); assert.ok(near(un.actual, un0.total, 1e-6));
  // each bucket equals an INDEPENDENT series call with the municipality filter
  for (const r of rows.filter((x) => x.rowKind === 'municipality')) assert.ok(near(r.actual, directSum('2026-01-01', TODAY, [JD], jKey(r.muniId)), 1e-3), `${r.muniId} actual`);
  assert.ok(near(un.actual, ['DIRECT', 'NOT_SPECIFIED', 'UNRESOLVED'].reduce((t, k) => t + directSum('2026-01-01', TODAY, [JD], `${JD}|${k}`), 0), 1e-3), 'the unallocated actual = direct + not specified + unresolved');
  // the municipality with collections but NO allocation is a row with an actual and no target
  const r6 = rows.find((r) => r.muniId === J(6)); assert.ok(r6 && r6.actual > 0); assert.equal(r6.target, null); assert.equal(r6.hasTarget, false); assert.equal(r6.vsPlanRatio, null); assert.equal(r6.vsPlanReason, 'no_municipal_target'); assert.equal(r6.deviationUnavailable, 'no_municipal_target'); assert.equal(r6.achievementToDate, null);
  // PLANNED: Σ rows = the Amanah planned; the months reconcile EXACTLY, month by month
  assert.ok(near(sum(rows, (r) => r.plannedToDate || 0), basis.plannedToDate, 1e-3), 'Σ planned = Amanah planned');
  basis.months.forEach((m, i) => assert.equal(sum(rows, (r) => (r.monthly ? r.monthly[i] : 0)), m.planned, `month ${m.ym}`));
  assert.equal(sum(basis.months, (m) => m.planned), 3_000_000_000);
  for (const r of rows.filter((x) => x.hasTarget)) assert.equal(sum(r.monthly), r.target, `${r.key}: its months add up to its allocation`);
  // …and equals the same Amanah WITHOUT municipal rows (the plan figure does not depend on how it is split)
  const flat = await run(mk({ municipalAllocations: null }), JD_VIEW);
  assert.equal(flat.basis.rowsKind, 'entity'); assert.equal(flat.basis.entities.length, 1); assert.equal(flat.basis.entities[0].key, JD); assert.equal(flat.basis.target.value, basis.target.value);
  assert.ok(near(flat.basis.plannedToDate, basis.plannedToDate, 1e-6)); assert.equal(flat.basis.actualToDate, basis.actualToDate);
  assert.equal(flat.basis.municipalState, 'not_distributed');
  // the measures carry the view scope
  assert.deepEqual(measures.viewScope, JD_VIEW); assert.equal(measures.municipalState, 'distributed'); assert.ok(measures.scopeKey.includes(`view:${JD}`));
  assert.equal(basis.municipal.allocatedCount, 5); assert.equal(basis.municipal.unallocated, 1_900_000_000); assert.equal(basis.municipal.excess, 0); assert.equal(basis.municipal.reconciled, true);
});

await ok('the Amanah view is the SAME figures as the entity row of the Ministry view (target, planned, actual) and the ministry view is unchanged by it', async () => {
  const view = mk(); const min = await run(view, undefined); const am = await run(view, JD_VIEW);
  const row = min.basis.entities.find((e) => e.key === JD);
  assert.equal(am.basis.target.value, row.target); assert.ok(near(am.basis.plannedToDate, row.plannedToDate, 1e-6)); assert.equal(am.basis.actualToDate, row.actual);
  assert.ok(near(am.basis.achievementToDate, row.achievementToDate, 1e-12)); assert.ok(near(am.basis.vsPlanRatio, row.vsPlanRatio, 1e-9));
  assert.equal(min.basis.target.value, 9_000_000_000);
  assert.notEqual(am.basis.scopeKey, min.basis.scopeKey);
});

await ok('forecast / expected % of the Amanah view use the Amanah series (municipal rows do not change them)', async () => {
  const { fc, basis, measures } = await run(mk(), JD_VIEW);
  assert.equal(fc.state, 'ok'); assert.deepEqual(fc.method.window.months, ['2026-08', '2026-09', '2026-10']);
  const rate = (directSum('2026-08-01', '2026-08-31', [JD]) + directSum('2026-09-01', '2026-09-30', [JD]) + directSum('2026-10-01', '2026-10-31', [JD])) / 3;
  assert.ok(near(fc.monthlyRate, rate, 1e-6)); assert.ok(near(fc.expectedAchievementPct, fc.forecastTotal / 3_000_000_000, 1e-12)); assert.equal(measures.expected.pct, fc.expectedAchievementPct); assert.ok(basis.pace.required.state === 'ok' || basis.pace.required.reason === 'target_reached');
});

/* ------------------------------------------------------------------ one municipality */
await ok('a MUNICIPALITY WITH an allocation: target = its allocation; achievement, vsPlanRatio, deviation, forecast and expected % are its own; equals its row in the Amanah view', async () => {
  const MU = J(2); const view = mk(); const vsco = { amanah: JD, muni: MU };
  const { basis, fc, measures, inputs } = await run(view, vsco); const am = (await run(view, JD_VIEW)).basis;
  assert.equal(basis.state, 'ok'); assert.equal(basis.municipalState, 'allocated'); assert.equal(basis.scopeKind, 'municipality'); assert.equal(basis.target.value, 400_000_000);
  const act = directSum('2026-01-01', TODAY, [JD], jKey(MU)); assert.equal(basis.actualToDate, act, 'actual = the data service\'s municipality scope');
  assert.ok(near(basis.plannedToDate, 400_000_000 * (10 + 6 / 30) / 12, 40), 'planned ≈ the allocation × 10.2/12 months (equal distribution, apportioned)');
  assert.ok(near(basis.achievementToDate, act / 400_000_000, 1e-12)); assert.ok(near(basis.vsPlanRatio, act / basis.plannedToDate, 1e-12)); assert.ok(near(basis.deviation.amount, act - basis.plannedToDate, 1e-6));
  const row = am.entities.find((r) => r.muniId === MU);
  assert.ok(near(basis.plannedToDate, row.plannedToDate, 1e-9), 'the municipality\'s own planned = its row in the Amanah view'); assert.deepEqual(basis.months.map((m) => m.planned), row.monthly);
  assert.ok(near(basis.achievementToDate, row.achievementToDate, 1e-12)); assert.ok(near(basis.deviation.amount, row.deviation, 1e-6));
  assert.deepEqual(basis.entities, []); assert.equal(basis.remainder, null); assert.ok(basis.viewLabel.ar.includes('أمانة محافظة جدة'));
  // forecast: the municipality's OWN history, same rules
  assert.equal(fc.state, 'ok'); assert.deepEqual(fc.method.window.months, ['2026-08', '2026-09', '2026-10']);
  const rate = (directSum('2026-08-01', '2026-08-31', [JD], jKey(MU)) + directSum('2026-09-01', '2026-09-30', [JD], jKey(MU)) + directSum('2026-10-01', '2026-10-31', [JD], jKey(MU))) / 3;
  assert.ok(near(fc.monthlyRate, rate, 1e-6), 'rate from the municipality\'s history'); assert.ok(fc.monthlyRate < (await run(view, JD_VIEW)).fc.monthlyRate, 'not the Amanah rate');
  assert.ok(near(fc.forecastTotal - basis.actualToDate, rate * (24 / 30 + 1), 1e-3)); assert.ok(near(fc.expectedAchievementPct, fc.forecastTotal / 400_000_000, 1e-12)); assert.ok(near(fc.gap, 400_000_000 - fc.forecastTotal, 1e-3));
  assert.deepEqual(inputs.history.months.map((m) => m.value), ['2026-08', '2026-09', '2026-10'].map((m) => directSum(`${m}-01`, `${m}-28`, [JD], jKey(MU)) + directSum(`${m}-29`, `${m}-31`, [JD], jKey(MU))));
  assert.equal(measures.target, 400_000_000); assert.equal(measures.expected.pct, fc.expectedAchievementPct); assert.equal(measures.municipalState, 'allocated'); assert.deepEqual(measures.viewScope, vsco); assert.ok(measures.scopeKey.endsWith(`|muni:${MU}`));
});

await ok('a MUNICIPALITY WITHOUT an allocation: «لم يُحدد مستهدف لهذه البلدية», actual and the target-independent forecast amount shown, every target-dependent measure null with a reason — never 0, never the Amanah target', async () => {
  const MU = J(6); const view = mk(); const { basis, fc, measures } = await run(view, { amanah: JD, muni: MU });
  const act = directSum('2026-01-01', TODAY, [JD], jKey(MU)); assert.ok(act > 0);
  assert.equal(basis.state, 'no_municipal_target'); assert.equal(basis.reason, 'no_municipal_target'); assert.equal(basis.municipalState, 'no_municipal_target'); assert.equal(basis.message.ar, 'لم يُحدد مستهدف لهذه البلدية'); assert.equal(NO_MUNICIPAL_TARGET.ar, basis.message.ar); assert.ok(basis.message.en.length > 0);
  assert.equal(basis.target.value, null); assert.equal(basis.actualToDate, act, 'the actual is still shown');
  for (const k of ['plannedToDate', 'achievementToDate', 'vsPlanRatio']) assert.equal(basis[k], null, k);
  assert.equal(basis.vsPlanReason, 'no_municipal_target'); assert.equal(basis.deviation.amount, null); assert.equal(basis.deviation.pct, null); assert.equal(basis.deviation.unavailable, 'no_municipal_target');
  assert.equal(basis.pace.required.state, 'none'); assert.equal(basis.pace.required.reason, 'no_municipal_target'); assert.equal(basis.pace.required.monthly, null); assert.equal(basis.remainingTarget, null);
  assert.ok(basis.months.every((m) => m.planned === null && m.plannedCum === null), 'no planned months'); assert.ok(basis.cumulative.planned.every((x) => x === null)); assert.ok(basis.months.some((m) => m.actual != null));
  assert.equal(basis.flags.zeroTarget, false); assert.equal(basis.flags.noMunicipalTarget, true); assert.ok(basis.notices.some((x) => x.code === 'no_municipal_target')); assert.ok(!basis.notices.some((x) => x.code === 'zero_target'));
  // the forecast AMOUNT is target-independent: actual + run-rate × remaining; percentage and gap are null
  assert.equal(fc.state, 'ok'); const rate = (directSum('2026-08-01', '2026-08-31', [JD], jKey(MU)) + directSum('2026-09-01', '2026-09-30', [JD], jKey(MU)) + directSum('2026-10-01', '2026-10-31', [JD], jKey(MU))) / 3;
  assert.ok(near(fc.forecastTotal, act + rate * (24 / 30 + 1), 1e-3)); assert.equal(fc.expectedAchievementPct, null); assert.equal(fc.gap, null); assert.equal(fc.gapKind, null); assert.equal(fc.bridge, null); assert.equal(fc.reason, 'no_municipal_target'); assert.equal(fc.target, null);
  // the measures
  assert.equal(measures.state, 'no_municipal_target'); assert.equal(measures.calculable, true); assert.equal(measures.target, null); assert.equal(measures.actual, act); assert.equal(measures.achievementToDate, null); assert.equal(measures.plannedToDate, null); assert.equal(measures.vsPlanRatio, null);
  assert.equal(measures.deviation.amount, null); assert.equal(measures.expected.state, 'ok'); assert.equal(measures.expected.amount, fc.forecastTotal); assert.equal(measures.expected.pct, null); assert.equal(measures.expected.gap, null); assert.equal(measures.expected.pctUnavailable, 'no_municipal_target');
  assert.ok(measures.reasons.some((r) => r.code === 'no_municipal_target' && r.ar === 'لم يُحدد مستهدف لهذه البلدية'));
  // NEVER the Amanah target, never a division of it
  const text = JSON.stringify({ basis: { ...basis, municipal: null }, measures: { ...measures, municipal: null } }); assert.ok(!text.includes('3000000000') && !text.includes('1900000000'), 'the Amanah target is no municipal figure anywhere'); assert.equal(basis.municipal.amanahTarget, 3_000_000_000, 'only as the Amanah context line, never as the municipality target');
});

await ok('a municipality with NO collections at all and no allocation: still no_municipal_target, actual 0 is a real figure (not missing)', async () => {
  const MU = J(4); const { basis } = await run(mk(), { amanah: JD, muni: MU });
  assert.equal(directSum('2026-01-01', TODAY, [JD], jKey(MU)), 0); assert.equal(basis.state, 'no_municipal_target'); assert.equal(basis.actualToDate, 0); assert.equal(basis.achievementToDate, null);
});

await ok('an EXPLICIT zero allocation is a zero target (no_target), not a missing one', async () => {
  const view = mk({ municipalAllocations: [...MUNI_ALLOC, { entityKey: JD, muniId: J(6), amount: 0, origin: 'manual' }] });
  const { basis } = await run(view, { amanah: JD, muni: J(6) }); assert.equal(basis.state, 'no_target'); assert.equal(basis.reason, 'zero_target'); assert.equal(basis.municipalState, 'allocated');
});

await ok('a future / completed period with a municipality without allocation keeps the period state first or the no-target state, never a number from the Amanah', async () => {
  const fut = await run(mk({ period: { start: '2027-01-01', end: '2027-12-31', preset: 'fiscal-year' } }), { amanah: JD, muni: J(6) });
  assert.equal(fut.basis.state, 'future_period'); assert.equal(fut.basis.target.value, null); assert.equal(fut.basis.actualToDate, null);
  const done = await run(mk({ period: { start: '2026-01-01', end: '2026-06-30', preset: 'range' } }), { amanah: JD, muni: J(6) });
  assert.equal(done.basis.state, 'no_municipal_target'); assert.equal(done.fc.state, 'completed'); assert.equal(done.basis.actualToDate, directSum('2026-01-01', '2026-06-30', [JD], jKey(J(6))));
});

/* ------------------------------------------------------------------ the view scope never touches the plan */
await ok('changing the view scope leaves the plan content deep-equal (the inputs are even frozen); the basis is pure', async () => {
  const view = mk(); const before = JSON.parse(JSON.stringify(view)); deepFreeze(view);
  for (const vs of [undefined, JD_VIEW, { amanah: JD, muni: J(2) }, { amanah: JD, muni: J(6) }, { amanah: RY, muni: 'all' }, { amanah: 'all', muni: J(2) }, { amanah: JD, muni: 'MREF-001-001' }]) await run(view, vs);
  assert.deepEqual(JSON.parse(JSON.stringify(view)), before);
});

/* ------------------------------------------------------------------ monthly reconciliation */
await ok('municipal months (planMath.municipalMonthlyBreakdown, consumed as is) reconcile to the Amanah\'s months to the riyal in EVERY month — in the basis rows too (equal, manual and partial-month periods)', async () => {
  const manual = { profile: 'manual', weights: { '2026-01': 1000, '2026-02': 700, '2026-03': 1300, '2026-04': 500, '2026-05': 900, '2026-06': 800, '2026-07': 600, '2026-08': 1100, '2026-09': 400, '2026-10': 1200, '2026-11': 900, '2026-12': 600 } };
  const cases = [
    { period: { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' }, dist: equal, am: 1_000_000_003, parts: [333_333_331, 333_333_333, 100_000_001] },
    { period: { start: '2026-03-17', end: '2026-09-04', preset: 'range' }, dist: equal, am: 999_999_999, parts: [123_456_789, 98_765_432, 7, 500_000_000] },
    { period: { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' }, dist: manual, am: 777_777_777, parts: [111_111_111, 222_222_222, 3, 1] }
  ];
  for (const c of cases) {
    const ids = [J(1), J(2), J(3), J(5)].slice(0, c.parts.length);
    const view = mk({ period: c.period, distribution: c.dist, allocations: [{ entityKey: JD, amount: c.am }], target: c.am, scope: { kind: 'entities', entityKeys: [JD] }, municipalAllocations: c.parts.map((amount, i) => ({ entityKey: JD, muniId: ids[i], amount })) });
    const { basis } = await run(view, JD_VIEW); const bd = municipalMonthlyBreakdown(view.content, c.period, JD);
    assert.equal(bd.reconciles, true); assert.equal(basis.target.value, c.am); assert.equal(basis.municipal.reconciled, true);
    basis.months.forEach((m, i) => { assert.equal(m.planned, bd.amanah[i]); assert.equal(sum(basis.entities, (r) => (r.monthly ? r.monthly[i] : 0)), bd.amanah[i], `month ${m.ym}`); });
    ids.forEach((id, k) => { assert.equal(sum(basis.entities.find((r) => r.muniId === id).monthly), c.parts[k], `${id} total`); assert.deepEqual(basis.entities.find((r) => r.muniId === id).monthly, bd.municipalities[id]); });
    assert.equal(sum(basis.entities.find((r) => r.key === UNALLOCATED_MUNI_KEY).monthly), c.am - sum(c.parts));
    // the municipality's own view uses the same months (A2's municipalMonthly)
    const one = await run(view, { amanah: JD, muni: ids[0] }); assert.deepEqual(one.basis.months.map((m) => m.planned), municipalMonthly(view.content, c.period, JD, ids[0]).amounts);
  }
});

await ok('an entity distribution OVERRIDE of the Amanah is the distribution of its municipalities; an EXCESS (Σ municipal > Amanah) is reported, the unallocated row is 0 and nothing throws', async () => {
  const w = { '2026-01': 2000, '2026-02': 1000, '2026-03': 1000, '2026-04': 500, '2026-05': 500, '2026-06': 500, '2026-07': 500, '2026-08': 500, '2026-09': 500, '2026-10': 500, '2026-11': 1500, '2026-12': 1000 };
  const { basis } = await run(mk({ entityDistributions: { [JD]: { profile: 'manual', weights: w } } }), JD_VIEW);
  const r2 = basis.entities.find((r) => r.muniId === J(2)); assert.ok(Math.abs(r2.monthly[0] - 80_000_000) <= 2, 'January ≈ 20 % of 400 M (the Amanah\'s own manual profile, not the plan\'s equal one)'); assert.equal(basis.months[0].planned, 600_000_000);
  const view = mk({ municipalAllocations: [{ entityKey: JD, muniId: J(1), amount: 2_000_000_000 }, { entityKey: JD, muniId: J(2), amount: 1_500_000_000 }] });
  const ex = (await run(view, JD_VIEW)).basis; assert.equal(ex.municipal.excess, 500_000_000); assert.equal(ex.municipal.reconciled, false); assert.equal(ex.target.value, 3_000_000_000);
  assert.equal(ex.entities.find((r) => r.key === UNALLOCATED_MUNI_KEY).target, 0); assert.ok(ex.state === 'ok');
});

/* ------------------------------------------------------------------ input identity */
await ok('an input loaded for ANOTHER municipality / Amanah / no view is rejected (basis AND forecast), with no numbers', async () => {
  const view = mk();
  const forMu2 = await loadPlanInputsForPlan(rev, { view, reporting: TODAY, approvedCfg: cfg, viewScope: { amanah: JD, muni: J(2) } });
  const forMu3 = await loadPlanInputsForPlan(rev, { view, reporting: TODAY, approvedCfg: cfg, viewScope: { amanah: JD, muni: J(3) } });
  const forJd = await loadPlanInputsForPlan(rev, { view, reporting: TODAY, approvedCfg: cfg, viewScope: JD_VIEW });
  const forNone = await loadPlanInputsForPlan(rev, { view, reporting: TODAY, approvedCfg: cfg });
  assert.notEqual(forMu2.meta.scopeKey, forMu3.meta.scopeKey); assert.notEqual(forMu2.meta.scopeKey, forJd.meta.scopeKey); assert.notEqual(forJd.meta.scopeKey, forNone.meta.scopeKey);
  const b = (vs, inp) => planningBasisFromPlan({ view, today: TODAY, actual: inp.actual, viewScope: vs });
  for (const [vs, inp] of [[{ amanah: JD, muni: J(2) }, forMu3], [{ amanah: JD, muni: J(2) }, forJd], [{ amanah: JD, muni: J(2) }, forNone], [JD_VIEW, forMu2], [JD_VIEW, forNone], [undefined, forJd]]) {
    const bs = b(vs, inp); assert.equal(bs.state, 'incompatible_input'); assert.equal(bs.actualToDate, null); assert.equal(bs.target.value, null);
  }
  // forecast: a good basis for municipality 2 fed with municipality 3's history
  const good = planningBasisFromPlan({ view, today: TODAY, actual: forMu2.actual, viewScope: { amanah: JD, muni: J(2) } }); assert.equal(good.state, 'ok');
  for (const wrong of [forMu3.history, forJd.history, forNone.history]) { const f = forecastPlan(good, { history: wrong, now: '2026-11-06T09:00:00.000Z' }); assert.equal(f.state, 'incompatible_input'); assert.equal(f.forecastTotal, null); assert.equal(f.expectedAchievementPct, null); }
  assert.equal(forecastPlan(good, { history: forMu2.history, now: '2026-11-06T09:00:00.000Z' }).state, 'ok');
  // the same for a municipality WITHOUT a target: its forecast also refuses another municipality's history
  const noT = planningBasisFromPlan({ view, today: TODAY, actual: (await loadPlanInputsForPlan(rev, { view, reporting: TODAY, approvedCfg: cfg, viewScope: { amanah: JD, muni: J(6) } })).actual, viewScope: { amanah: JD, muni: J(6) } });
  assert.equal(noT.state, 'no_municipal_target'); assert.equal(forecastPlan(noT, { history: forMu2.history }).state, 'incompatible_input');
});

await ok('INVALID view scopes are explicit: a municipality without an Amanah, a municipality of another Amanah, an Amanah outside the viewer\'s scope or the plan\'s scope — never silently widened', async () => {
  const view = mk(); const cases = [
    [{ amanah: 'all', muni: J(2) }, 'municipality_without_amanah'], [{ amanah: JD, muni: 'MREF-001-001' }, 'municipality_not_in_amanah'], [{ amanah: JD, muni: 'NOT_SPECIFIED' }, 'municipality_not_in_amanah'], [{ amanah: JD, muni: 'junk' }, 'municipality_not_in_amanah']
  ];
  for (const [vs, why] of cases) { const { basis, inputs, fc, measures } = await run(view, vs); assert.equal(basis.state, 'invalid_view_scope'); assert.equal(basis.reason, why); assert.equal(inputs.invalid, why); assert.equal(inputs.actual, null); assert.equal(basis.actualToDate, null); assert.equal(basis.target.value, null); assert.equal(fc.state, 'invalid_view_scope'); assert.equal(measures.state, 'invalid_view_scope'); assert.ok(measures.reasons.some((r) => r.code === 'invalid_view_scope')); }
  const ent = mk({ scope: { kind: 'entities', entityKeys: [RY] }, allocations: [{ entityKey: RY, amount: 1_000_000_000 }], municipalAllocations: [] });
  assert.equal((await run(ent, JD_VIEW)).basis.reason, 'amanah_not_available', 'Jeddah is not in an entity plan of Riyadh');
  assert.equal((await run(view, JD_VIEW, { entityKeys: [RY] })).basis.reason, 'amanah_not_available', 'the viewer does not see Jeddah');
  assert.equal((await run(view, JD_VIEW, { entityKeys: [RY, JD] })).basis.state, 'ok');
});

/* ------------------------------------------------------------------ restricted (municipal-only) viewers */
await ok('a MUNICIPAL-ONLY viewer (hand-built masked plan: the Amanah amount is withheld): the target = Σ of the municipal allocations they see, the Amanah total is never exposed; no visible allocation ⇒ no_municipal_target', async () => {
  const visible = MUNI_ALLOC.filter((m) => [J(2), J(5)].includes(m.muniId)); // 400 M + 200 M
  const maskedA = mk({ allocations: [], municipalAllocations: visible, target: 600_000_000 }); maskedA.content.target = { amount: 600_000_000, masked: true, label: { ar: 'إجمالي الجهات المتاحة لك', en: 'Total of the entities available to you' } };
  const maskedB = mk({ allocations: [{ entityKey: JD, amount: null, origin: 'manual' }], municipalAllocations: visible, target: 600_000_000 }); maskedB.content.target = { amount: 600_000_000, masked: true };
  for (const view of [maskedA, maskedB]) {
    deepFreeze(view);
    const am = await run(view, JD_VIEW); const b = am.basis;
    assert.equal(b.state, 'ok'); assert.equal(b.target.value, 600_000_000); assert.equal(b.target.restricted, true); assert.equal(b.target.label.ar, 'إجمالي الجهات المتاحة لك'); assert.equal(b.rowsKind, 'municipality');
    assert.deepEqual(b.entities.filter((r) => r.rowKind === 'municipality' && r.hasTarget).map((r) => r.muniId), [J(2), J(5)]);
    assert.equal(sum(b.entities.filter((r) => r.hasTarget), (r) => r.target), 600_000_000);
    assert.equal(b.municipal.targetHidden, true); assert.equal(b.municipal.amanahTarget, null); assert.equal(b.municipal.unallocated, null); assert.equal(b.allocation.unallocated, null); assert.equal(b.allocation.excess, null);
    assert.equal(b.entities.find((r) => r.key === UNALLOCATED_MUNI_KEY)?.target ?? null, null, 'no unallocated TARGET is shown (it would reveal the Amanah total)');
    assert.equal(sum(b.months, (m) => m.planned), 600_000_000, 'the months add up to what the viewer sees');
    const text = JSON.stringify({ basis: b, measures: am.measures, fc: am.fc }); assert.ok(!text.includes('3000000000') && !text.includes('1900000000') && !text.includes('1100000000'), 'no Amanah-level amount anywhere');
    // one visible municipality
    const m2 = await run(view, { amanah: JD, muni: J(2) }); assert.equal(m2.basis.state, 'ok'); assert.equal(m2.basis.target.value, 400_000_000); assert.equal(m2.basis.actualToDate, directSum('2026-01-01', TODAY, [JD], jKey(J(2))));
    assert.deepEqual(m2.basis.months.map((m) => m.planned), b.entities.find((r) => r.muniId === J(2)).monthly, 'the same months in the Amanah view and in the municipality view');
    // a municipality without a visible allocation
    const m6 = await run(view, { amanah: JD, muni: J(6) }); assert.equal(m6.basis.state, 'no_municipal_target'); assert.equal(m6.basis.target.value, null); assert.equal(m6.measures.achievementToDate, null);
    assert.ok(!JSON.stringify(m6.basis).includes('3000000000'));
  }
  // no visible municipal allocation at all
  const none = mk({ allocations: [], municipalAllocations: [], target: 0 }); none.content.target = { amount: 0, masked: true };
  const r = await run(none, JD_VIEW); assert.equal(r.basis.state, 'no_municipal_target'); assert.equal(r.basis.target.value, null); assert.equal(r.basis.municipalState, 'no_municipal_target'); assert.equal(r.basis.achievementToDate, null);
});

await ok('a viewer with the WHOLE Amanah (the Amanah amount visible) is not a municipal-only viewer even on a masked plan', async () => {
  const view = mk(); view.content.target = { amount: 3_000_000_000, masked: true };
  const { basis } = await run(view, JD_VIEW, { entityKeys: [JD] }); assert.equal(basis.municipal.targetHidden, false); assert.equal(basis.target.value, 3_000_000_000); assert.ok(basis.entities.some((r) => r.key === UNALLOCATED_MUNI_KEY && r.target === 1_900_000_000));
});

/* ------------------------------------------------------------------ the loader against the real data service */
await ok('LOADER reconciliation against the real service (Jeddah): Σ municipality buckets + «غير موزع على البلديات» = the Amanah actual = Σ monthly = the snapshot total, each record in ONE bucket; the calls are one per figure', async () => {
  const view = mk(); calls = 0;
  const inp = await loadPlanInputsForPlan(rev, { view, reporting: TODAY, approvedCfg: cfg, viewScope: JD_VIEW }); const callsAmanah = calls;
  const a = inp.actual; const bucketsSum = sum(Object.values(a.byMunicipality)) + a.unattributed.total;
  assert.ok(near(bucketsSum, a.total, 1e-3), `buckets ${bucketsSum} vs monthly ${a.total}`); assert.ok(near(bucketsSum, inp.total, 1e-3), 'and the snapshot total');
  assert.ok(near(a.total, directSum('2026-01-01', TODAY, [JD]), 1e-3), 'and an independent series call over the whole Amanah');
  const snapJd = snapshot(st, { scope: sc('2026-01-01', TODAY, [JD]), cfg }); assert.ok(near(snapJd.receivedInPeriod.total, bucketsSum, 1e-3));
  // the direct / not specified / unresolved groups are never reference municipalities
  assert.ok(Object.keys(a.byMunicipality).every((k) => /^MREF-002-\d{3}$/.test(k) && municipalitiesOf(JD).some((m) => m.refId === k)));
  assert.ok(callsAmanah <= 3, `at most snapshot + series + one history call (${callsAmanah})`);
  // a municipality: its monthly series IS the service's municipality scope; ≤ 3 calls
  calls = 0; const mu = await loadPlanInputsForPlan(rev, { view, reporting: TODAY, approvedCfg: cfg, viewScope: { amanah: JD, muni: J(2) } }); assert.ok(calls <= 3);
  assert.ok(near(mu.actual.total, a.byMunicipality[J(2)], 1e-3), 'the municipality\'s monthly total = its bucket in the Amanah breakdown'); assert.equal(mu.actual.byMunicipality, undefined);
  // every municipality of Jeddah: bucket = its own service call
  for (const m of municipalitiesOf(JD)) assert.ok(near(a.byMunicipality[m.refId] || 0, directSum('2026-01-01', TODAY, [JD], m.key), 1e-3), m.refId);
  // other Amanahs reconcile too (the municipalities of Riyadh)
  const ry = await loadPlanInputsForPlan(rev, { view, reporting: TODAY, approvedCfg: cfg, viewScope: { amanah: RY, muni: 'all' } });
  assert.ok(near(sum(Object.values(ry.actual.byMunicipality)) + ry.actual.unattributed.total, directSum('2026-01-01', TODAY, [RY]), 1e-3));
});

await ok('a short range plan and a mid-month cut-off: the municipal rows and the buckets follow the period; payments before the start are in no bucket', async () => {
  const view = mk({ period: { start: '2026-09-16', end: '2026-12-15', preset: 'range' }, allocations: [{ entityKey: JD, amount: 900_000_000 }], target: 900_000_000, municipalAllocations: [{ entityKey: JD, muniId: J(2), amount: 300_000_000 }], scope: { kind: 'entities', entityKeys: [JD] } });
  const { basis, inputs } = await run(view, JD_VIEW);
  assert.equal(basis.state, 'ok'); assert.equal(basis.actualToDate, directSum('2026-09-16', TODAY, [JD])); assert.ok(near(sum(basis.entities, (r) => r.actual), basis.actualToDate, 1e-3));
  assert.ok(near(sum(basis.entities, (r) => r.plannedToDate || 0), basis.plannedToDate, 1e-3)); assert.equal(sum(basis.entities, (r) => r.target || 0), 900_000_000);
  basis.months.forEach((m, i) => assert.equal(sum(basis.entities, (r) => (r.monthly ? r.monthly[i] : 0)), m.planned));
  assert.equal(inputs.actual.meta.scopeKey, basis.scopeKey);
});

await ok('municipalAllocationsOf: duplicates add up, negative / non-numeric are ignored, the reference order is kept, other Amanahs are ignored', () => {
  const c = { municipalAllocations: [{ entityKey: JD, muniId: J(3), amount: 5 }, { entityKey: JD, muniId: J(1), amount: 7 }, { entityKey: JD, muniId: J(3), amount: 6 }, { entityKey: RY, muniId: 'MREF-001-001', amount: 9 }, { entityKey: JD, muniId: J(2), amount: -1 }, { entityKey: JD, muniId: J(4), amount: 'x' }, { entityKey: JD, muniId: 'MREF-999-001', amount: 2 }] };
  assert.deepEqual(municipalAllocationsOf(c, JD).map((p) => [p.id, p.amount]), [[J(1), 7], [J(3), 11], ['MREF-999-001', 2]]);
});

console.log(`planning-plan-municipal: ${n} tests passed`);
