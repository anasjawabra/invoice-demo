// Tests of the planning CALCULATION BASIS as the revenue plans use it (docs/revenue-plans-spec.md §5, planning review 08 / 04 / 09): the plan basis (target, profile, planned to date, signed deviation, required pace) and the
// ONE forecast (forecastPlan) over the illustrative system plan, the calendar primitives that survive the cleanup (plannedToDate / evenPlan / isMonthEnd …), the single target across surfaces, the legacy device record
// (read-only), the Decision Room section and the wording guards. The store-based fiscal-year basis, its tolerance classification and the target store were RETIRED in the cleanup phase; what they proved is re-asserted here on the
// plan basis (and, for date ranges / municipalities / restricted viewers, in planning-plan-basis, planning-plan-municipal and plans-consumers).
// Oracles: the figures of the 2026-11-06 reconciliation are COMPUTED by the functions and checked by identity; the documented literal values are only a tolerance-bounded cross-check. Run with `npm run test:planbasis`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { approvedConfigOf, loadPlanInputsForPlan } from '../src/data/planInputs.js';
import { DEFAULT_CONFIG, DEFAULT_TARGETS, cumulativeTargetToDate } from '../src/data/revenueMetrics.js';
import { readLegacyStore, legacyYears, entityTargetsFull, targetMetaOf, LEGACY_KEY } from '../src/data/plans/legacyStore.js';
import { appropriationKeys, appropriationOf } from '../src/data/appropriations.js';
import { plannedToDate, evenPlan, isMonthEnd, daysInMonth, monthLabel } from '../src/data/planningBasis.js';
import { forecastPlan, baselineRate, PROBABILITY_MESSAGE } from '../src/data/planForecast.js';
import { planMeasures } from '../src/data/plans/planMeasures.js';
import { planView } from '../src/data/plans/planRules.js';
import { forecastReceipts, targetVsForecast, FORECAST_METHOD } from '../src/data/revenueOutlook.js';
import { planSectionOf, buildDecisionItems } from '../src/data/decisionRoom.js';
import { setPlansForTest, referenceViewFor } from '../src/data/plans/planStore.js';
import { seededStore, seedPlanRecord, customPlanRecord, referenceEntry, legacyStoreFixture } from '../src/data/plans/planFixtures.js';
import { planningBasisFromPlan } from '../src/data/plans/planBasis.js';
import { planSourceOf } from '../src/data/referenceTarget.js';
import { answerFor } from '../src/data/assistantAnswers.js';
import { buildSmartReport } from '../src/data/smartReport.js';
import { APPROPRIATION_BASIS } from '../src/data/revenueAnalysis.js';
import { fmtMoney } from '../src/utils/money.js';

process.env.DEMO_SIZE = 'compact';
setPlansForTest(seededStore()); // the reference plan every non-plan consumer reads (the seed is the 2026 reference)
let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const M = 1e6;
const NOW = '2026-11-06T09:00:00.000Z';

// ---- the synthetic world at a given "today": the data service in-process (approved rules only, payment date)
const worlds = new Map();
function world(today) {
  if (worlds.has(today)) return worlds.get(today);
  const st = loadStore(today); const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: today });
  const scope = { from: `${today.slice(0, 4)}-01-01`, to: today, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
  const sn = snapshot(st, { scope, cfg }); const se = series(st, { scope, cfg });
  const rev = { data: { snapshot: async (sc, o = {}) => snapshot(st, { scope: sc, cfg: o.cfg || cfg }), series: async (sc, o = {}) => series(st, { scope: sc, cfg: o.cfg || cfg }) } };
  const w = { st, cfg, sn, se, rev };
  worlds.set(today, w); return w;
}
const SEED = planView(seedPlanRecord(2026));
/** the plan basis + forecast + measures of a plan view at a given "today" over the REAL loaded inputs (the way the page computes them) */
async function runAt(today, { view = SEED, latest = today, entityKeys = null } = {}) {
  const w = world(today);
  const D = await loadPlanInputsForPlan(w.rev, { view, reporting: latest, approvedCfg: w.cfg, entityKeys });
  const basis = planningBasisFromPlan({ view, today, latestDataDate: latest, entityKeys, actual: D?.actual || null });
  const forecast = forecastPlan(basis, { history: D?.history, now: NOW });
  return { D, basis, forecast, measures: planMeasures(basis, forecast), w };
}
// a localStorage stand-in: records every WRITE (there must be none)
const fakeStorage = (init = {}) => { const m = new Map(Object.entries(init)); const writes = []; return { writes, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { writes.push(['set', k]); m.set(k, String(v)); }, removeItem: (k) => { writes.push(['remove', k]); m.delete(k); } }; };

// every bilingual {ar, en} object inside a value
function bilingual(o, out = []) { if (Array.isArray(o)) o.forEach((x) => bilingual(x, out)); else if (o && typeof o === 'object') { if (typeof o.ar === 'string' && typeof o.en === 'string') out.push(o); else Object.values(o).forEach((x) => bilingual(x, out)); } return out; }
const strings = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (Array.isArray(o)) o.forEach((x) => strings(x, out)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => strings(x, out)); return out; };
const keysDeep = (o, out = new Set()) => { if (Array.isArray(o)) o.forEach((x) => keysDeep(x, out)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.add(k); keysDeep(v, out); } return out; };
const digits = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).join('|');

/* ------------------------------------------------------------------ the numbers of the reconciliation (computed) */
await ok('seed plan figures at 2026-11-06: target, actual, planned (even split, day-prorated), signed deviation, the three percentages, required pace on the real remaining days — computed, identities exact', async () => {
  const T = '2026-11-06'; const { basis: b, measures: ms, w } = await runAt(T);
  assert.equal(b.state, 'ok'); assert.equal(b.reportingCutoff, T);
  assert.ok(near(b.target.value, 0.66 * appropriationKeys().reduce((t, k) => t + appropriationOf(k, 2026).expAdjusted, 0), 1), '66 % × the communicated budget');
  assert.ok(near(b.target.value, 21585.3 * M, 0.5 * M), 'documented oracle 21.59 bn');
  assert.ok(near(b.actualToDate, w.sn.receivedInPeriod.total, 1) && near(b.actualToDate, w.se.values.reduce((a, c) => a + c, 0), 1), 'the actual = Σ monthly series = receipts total (one population)');
  assert.ok(near(b.actualToDate, 9210.04 * M, 0.5 * M), 'documented oracle 9.21 bn');
  assert.ok(near(b.plannedToDate, b.target.value * (10 / 12 + (1 / 12) * (6 / 30)), 50), 'even split, day-prorated: 0.85 × the target (±a few riyals of apportionment rounding)');
  assert.ok(near(b.deviation.amount, b.actualToDate - b.plannedToDate, 1e-6)); assert.ok(near(b.deviation.pct, b.deviation.amount / b.plannedToDate, 1e-12));
  assert.ok(near(b.achievementToDate * 100, 42.67, 0.01), 'achievement of the full-period target to date — a different number from the deviation % and from the ratio against plan');
  assert.ok(near(b.vsPlanRatio, b.actualToDate / b.plannedToDate, 1e-12)); assert.ok(near(ms.vsPlanRatio, b.vsPlanRatio, 1e-12));
  assert.equal(b.remaining.days, 55); assert.ok(near(b.remaining.months, 1.8, 1e-12));
  const R = b.pace.required; assert.equal(R.state, 'ok'); assert.ok(near(R.monthly * b.remaining.months, b.remainingTarget, 1e-3), 'required monthly × months left = remaining target'); assert.ok(near(R.daily * 55, b.remainingTarget, 1e-3));
  assert.equal(b.lastCompleteMonth, '2026-10'); assert.equal(b.partialMonth, true); assert.equal(b.flags.partialMonth, true);
  // entities: Σ deviation = the Ministry deviation, Σ planned = planned, Σ actual = actual (no remainder)
  const ents = b.entities.filter((e) => e.hasTarget); assert.ok(ents.length >= 17);
  assert.ok(near(ents.reduce((t, e) => t + e.deviation, 0), b.deviation.amount, 1), 'Σ entity deviations = the Ministry deviation'); assert.ok(near(ents.reduce((t, e) => t + e.plannedToDate, 0), b.plannedToDate, 1)); assert.ok(near(b.remainder, 0, 1));
  assert.ok(near(b.cumulative.actual[10], b.actualToDate, 1) && b.cumulative.actual[11] === null, 'the actual line stops at the cut-off month; the future is null, not zero');
  // the signed deviation and the three percentages are the ONLY headline measures: no status / tolerance field anywhere
  const ks = keysDeep(b); for (const k of ['status', 'tolerance', 'annualAchievementPct', 'probability']) assert.ok(!ks.has(k), `the plan basis has no «${k}»`);
});

/* ------------------------------------------------------------------ one planned-to-date */
await ok('planned to date of a 12-month cumulative plan: ONE implementation — equal to the former copies on fixtures; no other copy in the source', () => {
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const oldGoal = (cum, d) => { const m = +d.slice(5, 7), dd = +d.slice(8, 10), y = +d.slice(0, 4); const prev = m > 1 ? cum[m - 2] : 0; return prev + (cum[m - 1] - prev) * (dd / dim(y, m)); };
  const oldForecast = (cum, d) => { const m = +d.slice(5, 7); const f = +d.slice(8, 10) / dim(+d.slice(0, 4), m); return (cum[Math.max(m - 2, 0)] ?? 0) * (m > 1 ? 1 : 0) + ((cum[m - 1] ?? 0) - (m > 1 ? cum[m - 2] ?? 0 : 0)) * f; };
  const oldDecision = (cum, d) => { const m = +d.slice(5, 7); const f = +d.slice(8, 10) / dim(+d.slice(0, 4), m); return (m > 1 ? cum[m - 2] : 0) + (cum[m - 1] - (m > 1 ? cum[m - 2] : 0)) * f; };
  const rows = entityTargetsFull(legacyStoreFixture({ year: 2026, coverage: 0.7 }), 2026); const cums = [evenPlan(1200), rows[0].cumulative, Array.from({ length: 12 }, (_, i) => 54 * Math.min(1, (i + 1) / 6))];
  for (const cum of cums) for (const d of ['2026-01-01', '2026-01-31', '2026-02-15', '2026-02-28', '2026-06-30', '2026-11-06', '2026-12-15', '2026-12-31']) {
    const v = plannedToDate(cum, d); for (const o of [oldGoal, oldForecast, oldDecision]) assert.ok(Math.abs(v - o(cum, d)) <= 1e-6 * Math.max(1, Math.abs(v)), `${d}`);
  }
  assert.ok(near(plannedToDate(evenPlan(120), '2026-01-31'), 10, 1e-9) && near(plannedToDate(evenPlan(120), '2026-12-31'), 120, 1e-9));
  assert.equal(isMonthEnd('2026-02-28'), true); assert.equal(isMonthEnd('2026-11-06'), false); assert.equal(daysInMonth(2028, 2), 29); assert.equal(monthLabel('2026-11').ar, 'نوفمبر 2026');
  const defs = []; for (const f of fs.readdirSync('src/data').filter((x) => /\.jsx?$/.test(x))) { const t = fs.readFileSync(`src/data/${f}`, 'utf8'); if (/function plannedToDate\b|const plannedToDate\b|cum\[m - 2\]|cumTarget\[/.test(t)) defs.push(f); }
  assert.deepEqual(defs, ['planningBasis.js'], `only planningBasis.js implements the 12-month plan to date, found in ${defs}`);
  assert.ok(near(cumulativeTargetToDate({ fiscalYear: 2026, collectionAmountAnnual: { value: 1200 }, monthlyCurve: { curveMode: 'equal', equalWeights: Array(12).fill(1 / 12), weights: [] } }, '2026-11-06'), 1200 * 0.85, 1e-9), 'the reports’ cumulative target at a DATE uses the same proration');
});

/* ------------------------------------------------------------------ pace */
await ok('required pace is day-based, none at/after the period end and once the target is reached; the 15 December case', async () => {
  const b = (await runAt('2026-12-15')).basis; const R = b.pace.required;
  assert.equal(b.remaining.days, 16); assert.ok(near(b.remaining.months, 16 / 31, 1e-12));
  assert.ok(near(R.monthly * (16 / 31), b.remainingTarget, 1e-3) && near(R.daily * 16, b.remainingTarget, 1e-3), 'a whole-month divisor would have given half');
  const e = await runAt('2026-12-31'); assert.equal(e.basis.state, 'completed'); assert.equal(e.basis.pace.required.state, 'none'); assert.equal(e.basis.pace.required.reason, 'period_ended'); assert.equal(e.basis.pace.required.monthly, null); assert.equal(e.basis.pace.required.daily, null); assert.equal(e.basis.remaining.days, 0);
  assert.equal(e.forecast.state, 'completed'); assert.equal(e.forecast.forecastTotal ?? null, null, 'a completed period has a final achievement, not a forecast'); assert.ok(e.measures.final, 'the final achievement is stated');
  // a later "today": the period is measured at its end — no pace either
  const late = planningBasisFromPlan({ view: SEED, today: '2027-03-01', latestDataDate: '2027-03-01', actual: (await runAt('2026-12-31')).D.actual }); assert.equal(late.reportingCutoff, '2026-12-31'); assert.equal(late.pace.required.state, 'none');
  // the target reached: nothing is still required
  const small = customPlanRecord({ id: 'plan-c0000071', name: 'خطة صغيرة', allocations: { 'Riyadh Amanah': 1e9 } }); const r = (await runAt('2026-11-06', { view: planView(small) })).basis;
  assert.equal(r.pace.required.state, 'none'); assert.equal(r.pace.required.reason, 'target_reached'); assert.equal(r.remainingTarget, 0); assert.equal(r.flags.aboveTarget, true); assert.ok(r.achievementToDate > 1, 'achievement above 100 % is NOT capped');
});

/* ------------------------------------------------------------------ the forecast */
await ok('forecast: complete months only + the remaining days of the cut-off month explicit; the partial month is not a data point; the bridge is exact', async () => {
  const T = '2026-11-06'; const { basis: b, forecast: f, D, w } = await runAt(T);
  assert.equal(f.state, 'ok'); assert.equal(f.method.id, 'runrate3_v2'); assert.deepEqual(f.method.window.months, ['2026-08', '2026-09', '2026-10']); assert.equal(f.method.alignment.ar, 'غير مُواءَم مع منهجية فرق التوقع — قيد التنسيق');
  assert.ok(near(f.monthlyRate, (w.se.values[7] + w.se.values[8] + w.se.values[9]) / 3, 1e-3));
  assert.ok(near(f.expectedRemaining, f.monthlyRate * (24 / 30 + 1), 1e-3), 'the rest of November by days (24/30) + December');
  assert.ok(near(f.forecastTotal, b.actualToDate + f.expectedRemaining, 1e-3)); assert.ok(near(f.expectedAchievementPct, f.forecastTotal / b.target.value, 1e-12)); assert.ok(near(f.gap, b.target.value - f.forecastTotal, 1e-3));
  assert.ok(near(f.bridge.behindAtCutoff + f.bridge.uncoveredRemainingPlan, f.gap, 1e-3), 'T − F = (P − C) + ((T − P) − (F − C))'); assert.ok(near(f.bridge.behindAtCutoff, b.plannedToDate - b.actualToDate, 1e-3));
  assert.ok(near(f.cumulative[11], f.forecastTotal, 1e-3), 'the forecast path ends at the full-period forecast');
  // the partial month changes the actual, never the baseline rate
  const bumped = JSON.parse(JSON.stringify(D.actual)); bumped.monthly[10] += 5000 * M; bumped.total = (bumped.total ?? 0) + 5000 * M;
  const b2 = planningBasisFromPlan({ view: SEED, today: T, latestDataDate: T, actual: bumped }); const f2 = forecastPlan(b2, { history: D.history, now: NOW });
  assert.equal(f2.monthlyRate, f.monthlyRate, 'the partial month is never a data point'); assert.ok(near(f2.forecastTotal - f.forecastTotal, 5000 * M, 1), 'the extra receipts count ONCE, inside the actual');
  assert.ok(f.assumptions.length >= 4 && f.assumptions.every((a) => a.ar && a.en));
  assert.equal(baselineRate([1, 2]), null); assert.equal(baselineRate([3, 6, 9, 12]), 9);
});
await ok('early month: no ×10 extrapolation — on 2 Jan the baseline is the previous year’s last three complete months; with fewer than three observed months the forecast is insufficient_history with no percentage', async () => {
  const r = await runAt('2026-01-02');
  assert.equal(r.forecast.state, 'ok'); assert.deepEqual(r.forecast.method.window.months, ['2025-10', '2025-11', '2025-12'], 'the window may start before the period'); assert.equal(r.forecast.method.window.startsBeforePeriod, true);
  assert.ok(r.forecast.forecastTotal <= r.basis.actualToDate + r.forecast.monthlyRate * 12, 'never above the baseline run-rate for the whole period'); assert.ok(r.forecast.forecastTotal < 0.6 * r.basis.target.value, 'an annualisation of the first two days (×10) gave ~21 bn');
  // the data starts in 2025-01: a 2025 plan on 10 Feb 2025 has ONE complete observed month
  const early = planView(customPlanRecord({ id: 'plan-c0000072', name: 'خطة 2025', year: 2025, allocations: { 'Riyadh Amanah': 5e9 } }));
  const e = await runAt('2025-02-10', { view: early });
  assert.equal(e.forecast.state, 'insufficient_history'); assert.equal(e.forecast.forecastTotal ?? null, null); assert.equal(e.forecast.expectedAchievementPct ?? null, null); assert.ok(e.forecast.message.ar.startsWith('لا يكفي سجل')); assert.equal(e.measures.expected.pct ?? null, null, 'no percentage without a baseline');
});
await ok('probability is unsupported everywhere: status + the exact message; no `probability` field, no clamp, no «maximum possible»', async () => {
  for (const T of ['2026-11-06', '2026-06-30', '2026-01-02', '2026-12-31']) {
    const { forecast: f } = await runAt(T); assert.equal(f.probabilityStatus, 'unsupported'); assert.deepEqual(f.probabilityMessage, PROBABILITY_MESSAGE); assert.equal(f.probabilityMessage.ar, 'لا تتوفر بيانات كافية لتقدير احتمالية موثوقة');
    const ks = keysDeep(f); for (const k of ['probability', 'maxTotal', 'reasons', 'billing_insufficient', 'tone']) assert.ok(!ks.has(k), `forecast has no «${k}»`);
  }
  const src = fs.readFileSync('src/data/planForecast.js', 'utf8'); assert.ok(!/normalCdf|clamp\(|erf\(|0\.01|0\.99|maxTotal|billing_insufficient/.test(src), 'the probability code is gone from planForecast.js');
  assert.ok(!/export function forecastYear/.test(src), 'the fiscal-year-only forecast is retired: forecastPlan is the only plan forecast');
});
await ok('ONE engine: revenueOutlook (Smart Reports / assistant / fixed reports) fits complete months only, forecasts from the cut-off day, and equals forecastPlan — method id and window shown', async () => {
  for (const T of ['2026-11-06', '2026-10-31', '2026-06-15']) {
    const w = world(T); const data = { series: async (req, o = {}) => series(w.st, { scope: req, cfg: { ...w.cfg, cutoff: o.asOf || T } }) };
    const scope = { from: '2026-01-01', to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
    const o = await forecastReceipts(data, scope, { ...DEFAULT_CONFIG, cutoff: T }, { targets: DEFAULT_TARGETS });
    const f = (await runAt(T)).forecast;
    assert.equal(o.ready, true); assert.equal(o.method.id, 'runrate3_v2'); assert.equal(o.method.window.count, 3); assert.equal(o.method.alignment.ar, f.method.alignment.ar);
    assert.ok(near(o.fit.monthlyRate, f.monthlyRate, 1e-3), `${T}: same baseline rate`); assert.ok(near(o.fiscalYear.projectedTotal, f.forecastTotal, 1), `${T}: the same full-period forecast from both surfaces`);
    assert.equal(o.history.completeMonths[o.history.completeMonths.length - 1], T === '2026-11-06' ? '2026-10' : T === '2026-10-31' ? '2026-10' : '2026-05', 'the partial cut-off month is never a data point');
    assert.equal(o.horizon.low, null); assert.equal(o.horizon.high, null); assert.equal(o.fiscalYear.projectedTotalLow, null); assert.ok(/No supported range/.test(o.bandLabel.en)); assert.equal(o.probabilityStatus, 'unsupported'); assert.ok(!keysDeep(o).has('probability'));
    if (T === '2026-11-06') { assert.equal(o.horizon.months[0], '2026-11', 'forecast from the cut-off DAY: the rest of November is in the horizon'); assert.ok(near(o.horizon.point[0], o.fit.monthlyRate * (24 / 30), 1e-3)); assert.deepEqual(o.horizon.restOfCutoffMonth, { month: '2026-11', days: 24, dim: 30 }); }
    if (T === '2026-10-31') assert.equal(o.horizon.months[0], '2026-11', 'a month-end cut-off starts with the next month');
    const tp = targetVsForecast(o, DEFAULT_TARGETS); assert.ok(near(tp.projectedTotal, f.forecastTotal, 1), 'the target position uses the same projected full year');
  }
  const src = fs.readFileSync('src/data/revenueOutlook.js', 'utf8'); assert.ok(!/olsFit|ols_trend_v1|1\.28/.test(src), 'the OLS trend and the ±1.28 SD band are gone');
  assert.equal(FORECAST_METHOD.id, 'runrate3_v2');
});

/* ------------------------------------------------------------------ one target across surfaces */
await ok('one target per (year, scope, plan) on every surface — reports, Smart Reports, the assistant, Decision Room — read from the CONFIGURED REFERENCE PLAN (the seed AND another plan)', async () => {
  const T = '2026-11-06'; const w = world(T);
  const other = customPlanRecord({ id: 'plan-c0000070', name: 'خطة بديلة', allocations: { 'Riyadh Amanah': 12e9, 'Jeddah Amanah': 10.5e9 } });
  for (const [label, store] of [['seed', seededStore()], ['other', { plans: [other], references: { 2026: referenceEntry(other.id) } }]]) {
    setPlansForTest(store);
    const view = referenceViewFor(2026); const actual = (await runAt(T, { view })).D.actual; const b = planningBasisFromPlan({ view, today: T, latestDataDate: T, actual }); const v = b.target.value;
    assert.ok(v > 0, label);
    if (label === 'seed') assert.ok(near(v, 21585.3 * M, 0.5 * M));
    assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, v, 'DEFAULT_TARGETS (reports, assistant, fixed reports) reads the reference plan target'); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.status, label === 'seed' ? 'demo' : 'plan'); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.versionId, view.versionId);
    assert.ok(near(cumulativeTargetToDate(DEFAULT_TARGETS, T), b.plannedToDate, 1), 'the same planned to date');
    const data = { series: async (req, o = {}) => series(w.st, { scope: req, cfg: { ...w.cfg, cutoff: o.asOf || T } }) };
    const scope = { from: '2026-01-01', to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
    const o = await forecastReceipts(data, scope, { ...DEFAULT_CONFIG, cutoff: T }, { targets: DEFAULT_TARGETS }); const tp = targetVsForecast(o, DEFAULT_TARGETS);
    assert.equal(tp.annualTarget, v, 'the analysis task’s target position'); assert.equal(tp.targetVersion, view.versionId); assert.ok(near(tp.forecastAchievementPct, o.fiscalYear.projectedTotal / v, 1e-12));
    const sec = planSectionOf({ basis: b, source: planSourceOf(DEFAULT_TARGETS.reference) });
    assert.equal(sec.ministry.target, v, 'Decision Room'); assert.ok(near(sec.ministry.plannedToDate, b.plannedToDate, 1e-6), 'Decision Room: the same planned to date'); assert.equal(sec.source.versionId, view.versionId);
    const out = { snapshot: w.sn, forecast: o, targetPos: tp, cards: [], anomalies: [] };
    for (const lang of ['en', 'ar']) {
      const a = answerFor('forecast', out, { lang }); assert.ok(a.text.includes(fmtMoney(v, { lang })), `assistant (${lang}) names the same target`); assert.ok(a.text.includes(view.name), `assistant (${lang}) names the source plan`);
      const r = buildSmartReport({ snapshot: w.sn, forecast: o, targetPos: tp, achievement: null, cards: [], anomalies: [], cases: [], lang });
      assert.ok(strings(r.predictions).some((s) => s.includes(fmtMoney(v, { lang }))), `Smart Report (${lang}) names the same target`);
    }
  }
  setPlansForTest(seededStore());
  assert.equal(APPROPRIATION_BASIS.name.ar, 'نسبة تحقيق الاعتماد مقابل الإيراد', 'the dashboard attainment keeps its own name and basis (D-01) — it is not «the target»'); assert.ok(APPROPRIATION_BASIS.basis.ar.includes('مقياس مستقل'));
  const live = fs.readFileSync('src/data/revenueMetrics.js', 'utf8'); assert.ok(!/appropriationTotal\(\)\.revAdjusted/.test(live), 'the 11.5 bn appropriation is no longer the report target');
});
await ok('wording of the target: the source plan is named, a plan target is never «approved», and an unavailable reference prints as unavailable (not 0)', async () => {
  const T = '2026-11-06'; const w = world(T); const data = { series: async (req, o = {}) => series(w.st, { scope: req, cfg: { ...w.cfg, cutoff: o.asOf || T } }) };
  const scope = { from: '2026-01-01', to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
  setPlansForTest(seededStore());
  const o = await forecastReceipts(data, scope, { ...DEFAULT_CONFIG, cutoff: T }, { targets: DEFAULT_TARGETS }); const out = (targets) => ({ snapshot: w.sn, forecast: o, targetPos: targetVsForecast(o, targets), cards: [], anomalies: [] });
  const en = answerFor('forecast', out(DEFAULT_TARGETS), { lang: 'en' }).text; assert.ok(/Reference plan:/.test(en) && !/approved/.test(en.replace(/not an approved model/g, '')));
  assert.ok(!/المعتمد/.test(answerFor('forecast', out(DEFAULT_TARGETS), { lang: 'ar' }).text.replace(/غير معتمد/g, '')), 'AR: no bare «المعتمد»');
  setPlansForTest({ plans: [], references: {} });
  const un = answerFor('forecast', out(DEFAULT_TARGETS), { lang: 'en' }).text; assert.ok(/unavailable/i.test(un) && !/target[^.]*\b0\b/.test(un.slice(un.indexOf('unavailable') - 5, un.indexOf('unavailable') + 5)));
  setPlansForTest(seededStore());
  for (const f of ['src/data/assistantAnswers.js', 'src/data/revenueInsights.js', 'src/data/revenueOutlook.js']) assert.ok(!/approved annual target \(a demo input|المستهدف السنوي المعتمد \(مُدخل توضيحي|Approved annual target \(demo input\)/.test(fs.readFileSync(f, 'utf8')), `${f}: the old «approved annual target (demo input)» wording is gone`);
});

/* ------------------------------------------------------------------ restricted viewers */
await ok('a plan’s allocations are fixed content: a restricted viewer’s entity row equals the Ministry viewer’s; the total is labelled «إجمالي الجهات المتاحة لك»; rows are only the authorised ones', async () => {
  const T = '2026-11-06'; const ry = 'Riyadh Amanah'; const full = (await runAt(T)).basis; const ryFull = full.entities.find((e) => e.key === ry);
  const viewer = (await runAt(T, { entityKeys: [ry] })).basis;
  assert.equal(viewer.entities.length, 1); assert.equal(viewer.entities[0].key, ry); assert.equal(viewer.entities[0].target, ryFull.target, 'the same number for every viewer');
  assert.equal(viewer.target.value, ryFull.target); assert.equal(viewer.restricted, true); assert.equal(viewer.scopeLabel.ar, 'إجمالي الجهات المتاحة لك'); assert.equal(full.scopeKind, 'ministry'); assert.equal(viewer.entities[0].plannedToDate, ryFull.plannedToDate);
  const two = (await runAt(T, { entityKeys: [ry, 'Jeddah Amanah'] })).basis; assert.ok(near(two.target.value, ryFull.target + full.entities.find((e) => e.key === 'Jeddah Amanah').target, 1e-6), 'the pair’s total is the sum of the same allocations');
});

/* ------------------------------------------------------------------ aggregation */
await ok('the national percentages are computed from aggregated amounts, never averaged from entities', async () => {
  const b = (await runAt('2026-11-06')).basis; const ents = b.entities.filter((e) => e.hasTarget);
  const sumT = ents.reduce((t, e) => t + e.target, 0); const sumP = ents.reduce((t, e) => t + e.plannedToDate, 0); const C = b.actualToDate;
  assert.ok(near(b.achievementToDate, C / sumT, 1e-9), 'achievement = Σ collected ÷ Σ target'); assert.ok(near(b.deviation.pct, (C - sumP) / sumP, 1e-9), 'deviation % = Σ deviation ÷ Σ planned');
  const mean = ents.reduce((t, e) => t + e.deviationPct, 0) / ents.length; assert.ok(Math.abs(mean - b.deviation.pct) > 1e-6, 'a mean of the entity percentages would have been a different (wrong) number');
});

/* ------------------------------------------------------------------ the legacy device record (read-only) */
await ok('legacy device record: the key is unchanged; a v1 value is read as is and never written back; the years it holds are listed; nothing in src or server WRITES it', () => {
  assert.equal(LEGACY_KEY, 'ib_plan_targets_v1');
  const v1 = { v: 1, years: { 2026: { 'Riyadh Amanah': { coverage: 0.5, savedAt: 't', savedBy: 'x' } } }, overall: { 2026: { coverage: 0.7, savedAt: 't', savedBy: 'x' } } };
  const storage = fakeStorage({ [LEGACY_KEY]: JSON.stringify(v1) }); const loaded = readLegacyStore(storage);
  assert.equal(loaded.v, 2); assert.deepEqual(loaded.years, v1.years); assert.deepEqual(loaded.overall, v1.overall); assert.deepEqual(loaded.meta, {});
  const before = entityTargetsFull(v1, 2026).map((r) => r.revenueTarget); assert.deepEqual(entityTargetsFull(loaded, 2026).map((r) => r.revenueTarget), before, 'reading v1 changes no value');
  const m0 = targetMetaOf(loaded, 2026); assert.equal(m0.versionId, '2026-default'); assert.equal(m0.status, 'illustrative'); assert.equal(m0.version, 0); assert.equal(m0.owner, null);
  assert.deepEqual(storage.writes, [], 'reading the legacy value never writes or removes it'); assert.equal(storage.getItem(LEGACY_KEY), JSON.stringify(v1));
  assert.deepEqual(legacyYears(loaded), [2026]); assert.deepEqual(legacyYears(readLegacyStore(fakeStorage())), [], 'an empty browser holds nothing to import'); assert.deepEqual(legacyYears(readLegacyStore({ getItem: () => 'junk' })), []);
  assert.deepEqual(legacyYears({ v: 2, years: { 2025: {} }, meta: {}, overall: { 2026: { coverage: 0.7 } }, override: { 2027: false } }), [2026, 2027], 'an empty per-entity map is not a saved value');
  const withMeta = { v: 2, years: {}, meta: { 2026: { version: 3, versionId: '2026-v3', status: 'approved', owner: 'Finance', savedAt: 's', savedBy: 'b' } } };
  assert.equal(targetMetaOf(withMeta, 2026).versionId, '2026-v3'); assert.equal(targetMetaOf(withMeta, 2026).status, 'approved');
  // no application file writes the key (only the reader READS it); the old store-based modules are gone
  const hits = []; const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(e.name)) { const t = fs.readFileSync(p, 'utf8'); if (/setItem\([^)]*(LEGACY_KEY|TARGETS_KEY|ib_plan_targets_v1)|removeItem\([^)]*(LEGACY_KEY|TARGETS_KEY|ib_plan_targets_v1)/.test(t)) hits.push(p); } } };
  walk('src'); walk('server'); assert.deepEqual(hits, [], `no writer of the legacy value: ${hits}`);
  for (const gone of ['src/data/planTargets.js', 'src/data/collectionGoal.js', 'src/pages/PlanningArea.jsx', 'src/data/planningCharts.js']) assert.ok(!fs.existsSync(gone), `${gone} is retired`);
  assert.ok(!/export (const|function) (planningBasis|planTarget|targetsFromBasis|deviationOf|basisFromRows|PLAN_TOLERANCE|STATUS_TEXT)\b/.test(fs.readFileSync('src/data/planningBasis.js', 'utf8')), 'the store-based basis, its tolerance and its status text are gone');
});

/* ------------------------------------------------------------------ Decision Room */
await ok('Decision Room plan items read the reference plan basis: the same planned to date, a signed deviation and NO tolerance / «on plan» class, the pace is day-based', async () => {
  const T = '2026-10-20'; const w = world(T);
  setPlansForTest(seededStore()); const view = referenceViewFor(2026);
  const b = (await runAt(T, { view })).basis;
  const sec = planSectionOf({ basis: b, source: planSourceOf(DEFAULT_TARGETS.reference) });
  assert.equal(sec.ministry.plannedToDate, b.plannedToDate); assert.equal(sec.ministry.requiredMonthly, b.pace.required.monthly); assert.equal(sec.monthsLeft, b.remaining.months);
  assert.equal(sec.ministry.deviation, sec.ministry.collected - sec.ministry.plannedToDate, 'the deviation is signed: collected − planned');
  for (const e of sec.entities) assert.equal(e.plannedToDate, b.entities.find((x) => x.key === e.key).plannedToDate, e.key);
  const ks = keysDeep(sec); for (const k of ['reasons', 'maxTotal', 'probability', 'status', 'tolerance']) assert.ok(!ks.has(k), k);
  const snap = snapshot(w.st, { scope: { from: '2026-01-01', to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' }, cfg: w.cfg });
  const labels = { amanah: (k) => ({ ar: k, en: k }), source: (k) => ({ ar: k, en: k }) };
  const mk = (plan) => buildDecisionItems({ today: T, snapshot: snap, labels, previous: null, plan, contracts: null, noContractCount: 0, orders: null, matching: null });
  assert.ok(mk(sec).items.some((i) => i.category === 'plan_deviation'), 'the Ministry is far behind plan: items exist');
  const level = { ...sec, entities: sec.entities.map((e) => ({ ...e, collected: e.plannedToDate })), ministry: { ...sec.ministry, collected: sec.ministry.plannedToDate } };
  assert.ok(!mk(level).items.some((i) => i.category === 'plan_deviation'), 'collection equal to the plan to date: no gap, no item (the Decision Room’s own threshold, no tolerance class)');
  const ahead = { ...sec, entities: sec.entities.map((e) => ({ ...e, collected: e.plannedToDate * 1.2 })), ministry: { ...sec.ministry, collected: sec.ministry.plannedToDate * 1.2 } };
  assert.ok(!mk(ahead).items.some((i) => i.category === 'plan_deviation'), 'above the plan to date: no item');
});

/* ------------------------------------------------------------------ parity and wording */
await ok('AR/EN parity: every bilingual message of the basis, the forecast and the measures has both languages with the same numbers', async () => {
  const objs = [];
  for (const [t, latest] of [['2026-11-06', null], ['2026-12-31', null], ['2026-01-02', null], ['2026-11-06', '2026-11-01']]) { const r = await runAt(t, { latest: latest || t }); objs.push(...bilingual(r.basis), ...bilingual(r.forecast), ...bilingual(r.measures)); }
  assert.ok(objs.length > 60);
  for (const o of objs) { assert.ok(o.ar.trim() && o.en.trim(), 'both languages'); assert.equal(digits(o.ar), digits(o.en), `same numbers: «${o.ar}» / «${o.en}»`); }
});
await ok('wording guard: no «احتمالية» percentage, no «الحد الأقصى الممكن», no «مبررات عدم تحقيق», no maximum-possible text in the basis, the forecast, the outlook, the Decision Room section or the assistant answer', async () => {
  const T = '2026-11-06'; const w = world(T); const data = { series: async (req, o = {}) => series(w.st, { scope: req, cfg: { ...w.cfg, cutoff: o.asOf || T } }) };
  const scope = { from: '2026-01-01', to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
  const o = await forecastReceipts(data, scope, { ...DEFAULT_CONFIG, cutoff: T }, { targets: DEFAULT_TARGETS }); const r = await runAt(T); const ye = await runAt('2026-12-31');
  const bag = [...strings(r.basis), ...strings(r.forecast), ...strings(r.measures), ...strings(ye.forecast), ...strings(o), ...strings(targetVsForecast(o, DEFAULT_TARGETS)),
    ...strings(planSectionOf({ basis: r.basis, source: planSourceOf(DEFAULT_TARGETS.reference) })),
    answerFor('forecast', { snapshot: w.sn, forecast: o, targetPos: targetVsForecast(o, DEFAULT_TARGETS), cards: [], anomalies: [] }, { lang: 'ar' }).text, answerFor('forecast', { snapshot: w.sn, forecast: o, targetPos: targetVsForecast(o, DEFAULT_TARGETS), cards: [], anomalies: [] }, { lang: 'en' }).text];
  const bad = [/احتمالية[^.]{0,12}\d+(\.\d+)?\s*%/, /\d+(\.\d+)?\s*%\s*احتمالية/, /الحد الأقصى الممكن/, /مبررات عدم تحقيق/, /maximum possible/i, /probability of (reaching|achieving)[^.]{0,20}\d+\s*%/i, /billing is insufficient/i, /indicative range/i];
  for (const s of bag) for (const rx of bad) assert.ok(!rx.test(s), `forbidden ${rx}: «${s.slice(0, 120)}»`);
  assert.ok(bag.some((s) => s === 'لا تتوفر بيانات كافية لتقدير احتمالية موثوقة'), 'the one sentence that mentions a probability says it is unsupported');
  for (const s of bag.filter((x) => x.includes('احتمالية'))) assert.ok(/لا تتوفر|لا تُقدَّم|لا يُقدَّم|لا يُستخرج|الاحتمالية|لبلوغ المستهدف|فالسجل لا يتيح/.test(s) || s.length > 40, `«احتمالية» only in unsupported statements: «${s}»`);
  for (const f of ['src/data/planForecast.js', 'src/data/planningBasis.js']) assert.ok(!/GOAL_KEY|savePlan|rebasePlan/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')), `${f}: the dead saved-plan store is gone`);
});

/* ------------------------------------------------------------------ receipts parity (latent defect D15) */
await ok('receipts: the monthly series and the snapshot count the same payments (cards = charts = tables) at several cut-offs', () => {
  for (const T of ['2026-03-15', '2026-06-30', '2026-11-06', '2026-12-31']) { const w = world(T); assert.ok(near(w.se.values.reduce((a, c) => a + c, 0), w.sn.receivedInPeriod.total, 1), `${T}: Σ series = snapshot receipts`); assert.ok(near(Object.values(w.sn.receivedInPeriod.byAmanah).reduce((a, c) => a + c, 0), w.sn.receivedInPeriod.total, 1), `${T}: Σ byAmanah = receipts`); }
});

console.log(`planning basis: ${n} test groups passed`);
