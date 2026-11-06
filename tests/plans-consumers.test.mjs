// Tests of the NON-PLAN CONSUMERS of the revenue plans (docs/revenue-plans-spec.md §2 «Reference plan», §9, §10): the Decision Room, the report targets (Smart Reports, assistant, fixed reports, analysis tasks), the viewer targets,
// the report model / exports. Every one takes the target from the CONFIGURED REFERENCE PLAN (the plan store), shows the source plan, surfaces ambiguous / none / reference_invalid / not_loaded / no_access as UNAVAILABLE (never 0),
// never adds overlapping plans, honours restricted and municipal-only viewers, and carries NO tolerance class and NO read of the browser's `ib_plan_targets_v1`.
// Run with `npm run test:plansconsumers`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStore } from '../server/store.js';
import { snapshot, series, bridge } from '../server/engine.js';
import { worklist, anomalies } from '../server/lists.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { approvedConfigOf, loadPlanInputsForPlan } from '../src/data/planInputs.js';
import { DEFAULT_CONFIG, DEFAULT_TARGETS, targetAchievementFrom, cumulativeTargetToDate, monthlyTargetSeries } from '../src/data/revenueMetrics.js';
import { setPlansForTest, referenceViewFor, clearPlans, hydratePlans } from '../src/data/plans/planStore.js';
import { seededStore, customPlanRecord, referenceEntry, seedPlanRecord, SEED_ID } from '../src/data/plans/planFixtures.js';
import { planningBasisFromPlan } from '../src/data/plans/planBasis.js';
import { planMeasures } from '../src/data/plans/planMeasures.js';
import { forecastPlan } from '../src/data/planForecast.js';
import { maskPlanForViewer } from '../src/data/plans/planRules.js';
import { visibleEntityKeysOfScope as visKeys } from '../src/data/plans/planAccess.js';
import { entireAmanahGrant, normalizeGeoScope } from '../src/data/geoScope.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { viewerTargets } from '../src/data/viewerTargets.js';
import { referenceFor, referenceTargets, referenceLine, targetSourceText, targetUnavailableText, targetsForScope, planSourceOf } from '../src/data/referenceTarget.js';
import { forecastReceipts, targetVsForecast } from '../src/data/revenueOutlook.js';
import { planSectionOf, buildDecisionItems, THRESHOLDS } from '../src/data/decisionRoom.js';
import { answerFor } from '../src/data/assistantAnswers.js';
import { buildSmartReport } from '../src/data/smartReport.js';
import { buildReportModel } from '../src/data/reportModel.js';
import { runTask, createTaskState } from '../src/analysis/analysisTasks.js';
import { fmtMoney } from '../src/utils/money.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const strings = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (Array.isArray(o)) o.forEach((x) => strings(x, out)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => strings(x, out)); return out; };

const T = '2026-11-06'; const YEAR = 2026; const RIY = 'Riyadh Amanah'; const JED = 'Jeddah Amanah'; const ASIR = 'Asir Amanah';
const st = loadStore(T); const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: T });
const rm = municipalitiesOf(RIY).map((m) => m.refId);
const sc = { from: `${YEAR}-01-01`, to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
const data = {
  snapshot: async (s, extra = {}) => snapshot(st, { scope: s, cfg, ...extra }),
  series: async (s, extra = {}) => series(st, { scope: s, cfg: { ...cfg, cutoff: extra.asOf || T } }),
  bridge: async (s, extra = {}) => bridge(st, { scope: s, cfg, ...extra }),
  worklist: async (s, limit, extra = {}) => worklist(st, { scope: s, cfg, limit, ...extra }),
  anomalies: async (s, limit, extra = {}) => anomalies(st, { scope: s, cfg, limit, ...extra }),
  noncollection: async (s, extra = {}) => nonCollectionAnalysis(st, { scope: s, cfg, ...extra }),
  distributions: async () => null
};
const setStore = (plans, reference = null) => setPlansForTest({ plans, references: reference ? { [YEAR]: referenceEntry(reference) } : {} });
const PA = customPlanRecord({ id: 'plan-a0000001', name: 'خطة أ', allocations: { [RIY]: 1.2e9, [JED]: 0.8e9 } });
const PB = customPlanRecord({ id: 'plan-b0000002', name: 'خطة ب', allocations: { [RIY]: 0.5e9, [ASIR]: 0.3e9 } });
const PM = customPlanRecord({ id: 'plan-d0000003', name: 'خطة البلديات', allocations: { [RIY]: 1.2e9, [JED]: 0.8e9 }, municipalAllocations: [{ entityKey: RIY, muniId: rm[0], amount: 300e6, origin: 'manual' }, { entityKey: RIY, muniId: rm[1], amount: 200e6, origin: 'manual' }] });

/* ------------------------------------------------------------------ one plan ⇒ one target everywhere */
await ok('the same reference plan gives the identical target in the viewer targets, DEFAULT_TARGETS, the Decision Room, the assistant, Smart Reports, the analysis task and the plan measures; the source plan is printed', async () => {
  setPlansForTest(seededStore());
  const view = referenceViewFor(YEAR); assert.equal(view.referenceState, 'ok');
  const inputs = await loadPlanInputsForPlan({ data }, { view, reporting: T, approvedCfg: cfg });
  const basis = planningBasisFromPlan({ view, today: T, latestDataDate: T, actual: inputs.actual });
  const fc = forecastPlan(basis, { history: inputs.history, now: '2026-11-06T09:00:00.000Z' }); const meas = planMeasures(basis, fc);
  const V = meas.target; assert.ok(V > 0);
  assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, V); assert.equal(viewerTargets(null).collectionAmountAnnual.value, V); assert.ok(near(cumulativeTargetToDate(DEFAULT_TARGETS, T), meas.plannedToDate, 1e-3));
  const sec = planSectionOf({ basis, forecast: fc, source: planSourceOf(DEFAULT_TARGETS.reference) }); assert.equal(sec.ministry.target, V); assert.equal(sec.ministry.plannedToDate, meas.plannedToDate); assert.equal(sec.source.planId, view.planId);
  const sn = snapshot(st, { scope: sc, cfg }); const fy = await data.series({ ...sc, from: `${YEAR}-01-01`, to: T }, { asOf: T });
  const ach = targetAchievementFrom(fy, sc, cfg, DEFAULT_TARGETS); assert.equal(ach.annualTarget, V); assert.ok(near(ach.targetYtd, meas.plannedToDate, 1e-3)); assert.ok(near(ach.deviation, meas.deviation.amount, 1e-3));
  const o = await forecastReceipts(data, sc, { ...DEFAULT_CONFIG, cutoff: T }, { targets: DEFAULT_TARGETS }); const tp = targetVsForecast(o, DEFAULT_TARGETS); assert.equal(tp.annualTarget, V); assert.ok(near(tp.projectedTotal, meas.expected.amount, 1));
  const out = { snapshot: sn, forecast: o, targetPos: tp, achievement: ach, cards: [], anomalies: [] };
  const task = await runTask(createTaskState('forecast', { scope: sc }), { data, cases: [], decisions: {}, cfg: { ...DEFAULT_CONFIG, cutoff: T }, targets: viewerTargets(null) });
  assert.ok(/^completed/.test(task.status), task.status);
  for (const lang of ['ar', 'en']) {
    const a = answerFor('forecast', out, { lang }).text; assert.ok(a.includes(fmtMoney(V, { lang })) || a.includes(fmtMoney(V, { lang, unit: undefined })), `assistant (${lang}) target`); assert.ok(a.includes(view.name), `assistant (${lang}) names the source plan`);
    const r = buildSmartReport({ snapshot: sn, forecast: o, targetPos: tp, achievement: ach, cards: [], anomalies: [], cases: [], lang });
    assert.ok(strings(r.predictions).join(' ').includes(view.name) && strings(r.keyMetrics).join(' ').includes(view.name), `Smart Report (${lang}) names the source plan`);
  }
  assert.equal(referenceLine(DEFAULT_TARGETS.reference, 'ar'), `الخطة المرجعية: ${view.name}`); assert.ok(/^Reference plan: /.test(referenceLine(DEFAULT_TARGETS.reference, 'en')));
});
await ok('a configured reference wins and is labelled «configured»; the only eligible plan without a reference is labelled «الخطة الوحيدة المؤهلة»', async () => {
  setPlansForTest(seededStore()); assert.equal(DEFAULT_TARGETS.reference.source, 'configured'); assert.ok(DEFAULT_TARGETS.reference.illustrative, 'the seed is illustrative');
  setStore([PA]); assert.equal(DEFAULT_TARGETS.reference.state, 'ok'); assert.equal(DEFAULT_TARGETS.reference.source, 'only_eligible');
  assert.ok(referenceLine(DEFAULT_TARGETS.reference, 'ar').startsWith('الخطة الوحيدة المؤهلة: خطة أ')); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, 2e9);
});

/* ------------------------------------------------------------------ states */
await ok('ambiguous / none / reference_invalid / not_loaded / no_access: the target is UNAVAILABLE (null, never 0), no plan is picked, the notice names the cause and links to /planning', async () => {
  const cases = {
    ambiguous: () => setStore([PA, PB]),
    none: () => setStore([]),
    reference_invalid: () => setStore([PA, PB], 'plan-9999ffff'),
    not_loaded: () => clearPlans()
  };
  for (const [state, arrange] of Object.entries(cases)) {
    arrange(); const ref = referenceFor(YEAR); assert.equal(ref.referenceState, state, state);
    const t = DEFAULT_TARGETS; assert.equal(t.reference.state, state); assert.equal(t.collectionAmountAnnual.value, null, `${state}: no number invented`); assert.equal(t.collectionAmountAnnual.status, 'unavailable');
    assert.equal(cumulativeTargetToDate(t, T), null); assert.ok(monthlyTargetSeries(t, ['2026-05']).every((x) => x === null));
    const note = targetUnavailableText(t, 'ar'); assert.ok(note && /لا|غير/.test(note), state); assert.ok(targetUnavailableText(t, 'en'));
    if (state !== 'not_loaded') assert.ok(note.includes('/planning'), `${state}: the link to the plans page`);
    if (state === 'ambiguous') { assert.ok(note.includes('خطة أ') && note.includes('خطة ب'), 'the candidates are named'); assert.equal(t.reference.candidates.length, 2); }
    const fy = await data.series({ ...sc, from: `${YEAR}-01-01`, to: T }, { asOf: T });
    const ach = targetAchievementFrom(fy, sc, cfg, t); assert.equal(ach.annualTarget, null); assert.ok(ach.unavailable); assert.equal(ach.targetYtd, null); assert.equal(ach.gap, null); assert.ok(ach.receiptsYtd > 0, 'the actual is still shown');
    const o = await forecastReceipts(data, sc, { ...DEFAULT_CONFIG, cutoff: T }, { targets: t }); const tp = targetVsForecast(o, t);
    assert.equal(tp.annualTarget, null); assert.equal(tp.forecastAchievementPct, null); assert.equal(tp.gapToTarget, null); assert.equal(tp.plannedToDate, null); assert.ok(tp.targetUnavailable.ar && tp.targetUnavailable.en);
    const sn = snapshot(st, { scope: sc, cfg }); const out = { snapshot: sn, forecast: o, targetPos: tp, achievement: ach, cards: [], anomalies: [] };
    for (const lang of ['ar', 'en']) {
      const a = answerFor('forecast', out, { lang }).text; assert.ok(a.includes(tp.targetUnavailable[lang]), `${state}/${lang}: the assistant prints why the target is unavailable`);
      const r = buildSmartReport({ snapshot: sn, forecast: o, targetPos: tp, achievement: ach, cards: [], anomalies: [], cases: [], lang });
      assert.ok(strings(r.predictions).join(' ').includes(tp.targetUnavailable[lang]), `${state}/${lang}: the Smart Report prints it`);
      const metric = (r.keyMetrics || []).find((m) => /plan to date|مقابل المخطط/.test(m.label)); assert.ok(metric && /غير متاح|Unavailable/.test(metric.value) && !/^0/.test(metric.value), `${state}/${lang}: the achievement metric is unavailable, not 0`);
    }
    // the Decision Room: no plan items, a visible state
    const sec = planSectionOf({ basis: null, source: null }); assert.equal(sec.available, false);
  }
  clearPlans();
  const calls = []; await hydratePlans({ list: async () => { calls.push(1); const e = new Error('forbidden'); e.status = 403; throw e; } }, { force: true });
  assert.equal(referenceFor(YEAR).referenceState, 'no_access'); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, null); assert.ok(/صلاحية/.test(targetUnavailableText(DEFAULT_TARGETS, 'ar')));
  clearPlans();
});
await ok('a configured plan that is removed, or whose period no longer covers the year, is reference_invalid and is NEVER replaced by another plan, even when exactly one other plan exists', () => {
  setPlansForTest({ plans: [PB], references: { [YEAR]: referenceEntry(PA.id) } });
  assert.equal(DEFAULT_TARGETS.reference.state, 'reference_invalid'); assert.equal(DEFAULT_TARGETS.reference.reason, 'not_found'); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, null);
  const moved = customPlanRecord({ id: PA.id, name: 'خطة أ', allocations: { [RIY]: 1.2e9, [JED]: 0.8e9 }, year: YEAR + 1 });
  setPlansForTest({ plans: [moved, PB], references: { [YEAR]: referenceEntry(PA.id) } });
  assert.equal(DEFAULT_TARGETS.reference.state, 'reference_invalid'); assert.equal(DEFAULT_TARGETS.reference.reason, 'period_mismatch'); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, null);
});

/* ------------------------------------------------------------------ overlapping plans, saved vs unsaved content */
await ok('two overlapping plans are never summed: the consumers read ONE plan; changing the reference switches the figure; an UNSAVED working copy changes nothing, a saved change does', () => {
  setStore([PA, PB], PA.id); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, 2e9); assert.notEqual(DEFAULT_TARGETS.collectionAmountAnnual.value, 2e9 + 0.8e9);
  setStore([PA, PB], PB.id); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, 0.8e9);
  const edited = customPlanRecord({ id: PA.id, name: 'خطة أ', allocations: { [RIY]: 1.5e9, [JED]: 0.8e9 } });
  // an UNSAVED working copy lives in the plan page only (never in the plan store): the consumers keep reading the saved figure until a save changes the record
  assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, 0.8e9, 'nothing but a saved record is ever read');
  setStore([PA, PB], PA.id); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, 2e9);
  const saved = { ...PA, content: edited.content, revision: 2 };
  setStore([saved, PB], PA.id); assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, 2.3e9, 'a saved change reaches the consumers'); assert.equal(DEFAULT_TARGETS.reference.versionId, `${PA.id}@r2`);
});

/* ------------------------------------------------------------------ restricted and municipal-only viewers */
await ok('a restricted viewer reads the reference plan’s allocations of their entities only, labelled «إجمالي الجهات المتاحة لك»; the Ministry viewer is unchanged', () => {
  setPlansForTest({ plans: [PA], references: { [YEAR]: referenceEntry(PA.id) } });
  const t = viewerTargets([RIY]); assert.equal(t.collectionAmountAnnual.value, 1.2e9); assert.equal(t.scopeKind, 'available'); assert.equal(t.scopeLabel.ar, 'إجمالي الجهات المتاحة لك'); assert.ok(targetSourceText(t, 'ar').includes('إجمالي الجهات المتاحة لك') && targetSourceText(t, 'ar').includes('خطة أ'));
  assert.equal(DEFAULT_TARGETS.collectionAmountAnnual.value, 2e9); assert.equal(DEFAULT_TARGETS.scopeKind, 'ministry');
  // the server's masked copy gives the same figure
  const geo = normalizeGeoScope({ grants: [entireAmanahGrant(RIY)] }); const masked = maskPlanForViewer(PA, visKeys(geo), geo);
  setPlansForTest({ plans: [masked], references: { [YEAR]: referenceEntry(PA.id) } });
  const tm = viewerTargets([RIY]); assert.equal(tm.collectionAmountAnnual.value, 1.2e9); assert.equal(viewerTargets(null).collectionAmountAnnual.value, 1.2e9, 'the masked copy’s own total');
  assert.equal(viewerTargets(null).scopeKind, 'available');
});
await ok('a municipal-only viewer NEVER receives the Amanah total: the target is the Σ of the municipalities they may see (or unavailable), labelled «إجمالي الجهات المتاحة لك»', () => {
  const geo = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [rm[0]], direct: false, notSpecified: false }] });
  const masked = maskPlanForViewer(PM, visKeys(geo), geo);
  setPlansForTest({ plans: [masked], references: { [YEAR]: referenceEntry(PM.id) } });
  const t = viewerTargets([RIY]); assert.equal(t.collectionAmountAnnual.value, 300e6, 'only the municipality they may see'); assert.equal(t.scopeKind, 'available');
  const blob = JSON.stringify([t.reference, t.collectionAmountAnnual, t.monthlyCurve, t.scopeLabel, masked]); assert.ok(!blob.includes('1200000000') && !blob.includes('1.2e+9') && !blob.includes('200000000'), 'neither the Amanah amount nor another municipality’s amount is derivable');
  const unrelated = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [rm[5]], direct: false, notSpecified: false }] });
  setPlansForTest({ plans: [maskPlanForViewer(PM, visKeys(unrelated), unrelated)], references: { [YEAR]: referenceEntry(PM.id) } });
  assert.equal(viewerTargets([RIY]).collectionAmountAnnual.value, null, 'a municipality with no explicit allocation: no target (never 0, never the Amanah’s)');
});

/* ------------------------------------------------------------------ municipality scope */
await ok('a report scoped to ONE Amanah reads its allocation; one municipality reads its explicit allocation or «لم يُحدد مستهدف لهذه البلدية» — the actual stays, the target-dependent figures are unavailable, the Amanah target is never reused', async () => {
  setPlansForTest({ plans: [PM], references: { [YEAR]: referenceEntry(PM.id) } });
  const am = targetsForScope(DEFAULT_TARGETS, { ...sc, amanah: RIY }); assert.equal(am.collectionAmountAnnual.value, 1.2e9); assert.equal(am.scopeKind, 'amanah'); assert.deepEqual(am.viewScope, { amanah: RIY, muni: 'all' });
  const mk = (id) => `${RIY}|${id}`;
  const m0 = targetsForScope(DEFAULT_TARGETS, { ...sc, amanah: RIY, muni: mk(rm[0]) }); assert.equal(m0.collectionAmountAnnual.value, 300e6); assert.equal(m0.scopeKind, 'municipality'); assert.ok(near(cumulativeTargetToDate(m0, T), 300e6 * (310 / 365), 300e6 * 0.02));
  const m5 = targetsForScope(DEFAULT_TARGETS, { ...sc, amanah: RIY, muni: mk(rm[5]) }); assert.equal(m5.collectionAmountAnnual.value, null); assert.equal(m5.reference.targetState, 'no_municipal_target');
  assert.ok(targetUnavailableText(m5, 'ar').includes('لم يُحدد مستهدف لهذه البلدية')); assert.notEqual(m5.collectionAmountAnnual.value, 1.2e9); assert.notEqual(m5.collectionAmountAnnual.value, 0);
  const group = targetsForScope(DEFAULT_TARGETS, { ...sc, amanah: RIY, muni: `${RIY}|DIRECT` }); assert.equal(group.collectionAmountAnnual.value, null, 'an explicit municipality group has no municipal target');
  assert.equal(targetsForScope(DEFAULT_TARGETS, sc), DEFAULT_TARGETS, 'no single Amanah: the viewer target unchanged');
  // the analysis task for the municipality scope: actual shown, achievement unavailable with the sentence
  const msc = { ...sc, amanah: RIY, muni: mk(rm[5]) };
  const task = await runTask(createTaskState('forecast', { scope: msc }), { data, cases: [], decisions: {}, cfg: { ...DEFAULT_CONFIG, cutoff: T }, targets: DEFAULT_TARGETS });
  assert.ok(/^completed/.test(task.status), task.status); const tx = strings(task.result).join(' '); assert.ok(tx.includes('لم يُحدد مستهدف لهذه البلدية') || tx.includes('No target has been set for this municipality'), 'the result says there is no municipal target');
  const fy = await data.series({ ...msc, from: `${YEAR}-01-01`, to: T }, { asOf: T });
  const ach = targetAchievementFrom(fy, msc, cfg, targetsForScope(DEFAULT_TARGETS, msc)); assert.equal(ach.scopeCaveat, false, 'the target is bound to this very view'); assert.ok(ach.unavailable); assert.equal(ach.achievement.calculable, false); assert.ok(ach.receiptsYtd >= 0);
  // the Amanah view caveat: the Amanah target with an Amanah scope is NOT a narrower-scope context-only comparison
  const fyA = await data.series({ ...sc, amanah: RIY, from: `${YEAR}-01-01`, to: T }, { asOf: T });
  assert.equal(targetAchievementFrom(fyA, { ...sc, amanah: RIY }, cfg, targetsForScope(DEFAULT_TARGETS, { ...sc, amanah: RIY })).scopeCaveat, false);
  assert.equal(targetAchievementFrom(fyA, { ...sc, amanah: RIY }, cfg, DEFAULT_TARGETS).scopeCaveat, true, 'the plan target is not compared with a narrower scope it was not bound to');
});
await ok('the report model (the source of every export) carries the source plan and the target’s view scope — and, when unavailable, the reason', async () => {
  setPlansForTest({ plans: [PM], references: { [YEAR]: referenceEntry(PM.id) } });
  const msc = { ...sc, amanah: RIY, muni: `${RIY}|${rm[0]}` }; const tg = targetsForScope(DEFAULT_TARGETS, msc);
  const fy = await data.series({ ...msc, from: `${YEAR}-01-01`, to: T }, { asOf: T }); const ach = targetAchievementFrom(fy, msc, cfg, tg);
  const sn = snapshot(st, { scope: msc, cfg });
  for (const lang of ['ar', 'en']) {
    const spec = { kind: 'smart', depth: 'summary', focus: 'revenue', scope: { ...msc, preset: 'ytd' }, sections: ['executive'], title: 'x', compare: 'none' };
    const model = buildReportModel({ spec, lang, out: { snapshot: sn, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: ach, cards: [], anomalies: [] }, targets: tg, cases: [], meta: null, generatedAt: new Date('2026-11-06T09:00:00Z') });
    const chip = (model.chips || model.context || []).find((c) => c.k === 'plan'); assert.ok(chip, `${lang}: a plan chip`); assert.ok(chip.value.includes('خطة البلديات'), 'the source plan'); assert.ok(chip.value.includes(lang === 'ar' ? 'نطاق المستهدف' : 'Target scope'), 'the view scope of the target');
  }
  const none = targetsForScope(DEFAULT_TARGETS, { ...sc, amanah: RIY, muni: `${RIY}|${rm[5]}` }); const ach2 = targetAchievementFrom(fy, { ...sc, amanah: RIY, muni: `${RIY}|${rm[5]}` }, cfg, none);
  const model2 = buildReportModel({ spec: { kind: 'smart', depth: 'summary', focus: 'revenue', scope: { ...msc, muni: `${RIY}|${rm[5]}`, preset: 'ytd' }, sections: ['executive'], title: 'x', compare: 'none' }, lang: 'ar', out: { snapshot: sn, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: ach2, cards: [], anomalies: [] }, targets: none, cases: [], meta: null, generatedAt: new Date('2026-11-06T09:00:00Z') });
  assert.ok((model2.chips || model2.context || []).find((c) => c.k === 'plan').value.includes('لم يُحدد مستهدف لهذه البلدية'));
  // a report with no target figure carries no plan chip
  const plain = buildReportModel({ spec: { kind: 'smart', depth: 'summary', focus: 'revenue', scope: { ...sc, preset: 'ytd' }, sections: ['executive'], title: 'x', compare: 'none' }, lang: 'ar', out: { snapshot: snapshot(st, { scope: sc, cfg }), forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: null, cards: [], anomalies: [] }, targets: DEFAULT_TARGETS, cases: [], meta: null, generatedAt: new Date('2026-11-06T09:00:00Z') });
  assert.ok(!(plain.chips || plain.context || []).some((c) => c.k === 'plan'));
});

/* ------------------------------------------------------------------ Decision Room: no tolerance class; restricted viewer */
await ok('Decision Room: no tolerance / «on plan» class anywhere — items keep their own gap threshold, the signed deviation is in words, the source plan + link travel with each item', async () => {
  const src = fs.readFileSync('src/data/decisionRoom.js', 'utf8'); assert.ok(!/on_plan|PLAN_TOLERANCE|planTolerance|deviationOf|وفق الخطة/.test(src), 'decisionRoom.js has no tolerance class');
  assert.equal(THRESHOLDS.planTolerance, undefined); assert.equal(THRESHOLDS.planShortfallMin, 0.1);
  setPlansForTest({ plans: [PA], references: { [YEAR]: referenceEntry(PA.id) } });
  const view = referenceViewFor(YEAR); const months = Array.from({ length: 10 }, () => 0.05e9);
  const basis = planningBasisFromPlan({ view, today: T, latestDataDate: T, actual: { monthly: months, byEntity: { [RIY]: 0.3e9, [JED]: 0.2e9 } } });
  const section = planSectionOf({ basis, source: planSourceOf(DEFAULT_TARGETS.reference) });
  const snap = snapshot(st, { scope: sc, cfg }); const labels = { amanah: (k) => ({ ar: k, en: k }), source: (k) => ({ ar: k, en: k }) };
  const R = buildDecisionItems({ today: T, snapshot: snap, labels, previous: null, plan: section, contracts: null, noContractCount: 0, orders: null, matching: null });
  const items = R.items.filter((i) => i.category === 'plan_deviation'); assert.ok(items.some((i) => i.key === 'plan:ministry') && items.some((i) => i.key === `plan:${RIY}`));
  for (const i of items) { assert.equal(i.planSource.planId, PA.id); assert.ok(i.evidence.some((e) => e.to === `/planning/${PA.id}`), 'link to the plan'); assert.ok(strings(i).join(' ').includes('خطة أ') || strings(i).join(' ').includes('Reference plan: خطة أ'), 'the source is printed'); assert.ok(!/وفق الخطة|\bon plan\b|\bon-plan\b/i.test(strings(i).join(' ')), (strings(i).join(' ').match(/.{20}(وفق الخطة|on plan).{20}/i) || [''])[0]); assert.ok(/below the plan to date/.test(i.title.en)); }
  assert.equal(R.context.plan.available, true); assert.equal(R.context.plan.source.planId, PA.id);
  // unavailable plan → no plan items, a visible state in the context
  setStore([PA, PB]);
  const un = planSectionOf({ basis: null }); const R2 = buildDecisionItems({ today: T, snapshot: snap, labels, previous: null, plan: { ...un, state: 'ambiguous', notice: { ar: 'x', en: 'x' } }, contracts: null, noContractCount: 0, orders: null, matching: null });
  assert.ok(!R2.items.some((i) => i.category === 'plan_deviation')); assert.equal(R2.context.plan.available, false); assert.equal(R2.context.plan.state, 'ambiguous'); assert.equal(R2.context.plan.link, '/planning');
});
await ok('Decision Room, restricted viewer: the section is the visible entities’ plan, flagged restricted; a municipal-only viewer’s Amanah row is the visible municipalities’ Σ (no Amanah total)', () => {
  const geo = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [rm[0]], direct: false, notSpecified: false }] });
  const masked = maskPlanForViewer(PM, visKeys(geo), geo);
  setPlansForTest({ plans: [masked], references: { [YEAR]: referenceEntry(PM.id) } });
  const view = referenceViewFor(YEAR); const keys = [RIY];
  const main = planningBasisFromPlan({ view, today: T, latestDataDate: T, entityKeys: keys, actual: { monthly: [], byEntity: {} } });
  const vs = { amanah: RIY, muni: 'all' };
  const b = planningBasisFromPlan({ view, today: T, latestDataDate: T, entityKeys: keys, viewScope: vs, actual: { monthly: Array.from({ length: 10 }, () => 10e6), byEntity: { [RIY]: 100e6 }, byMunicipality: { [rm[0]]: 80e6 }, unattributed: { total: 20e6 } } });
  const sec = planSectionOf({ basis: main.state === 'ok' || main.state === 'completed' ? main : { ...main, state: 'no_target' }, source: planSourceOf(referenceTargets(keys, { year: YEAR }).reference), masked: [{ key: RIY, basis: b }] });
  if (sec.available) { const row = sec.entities.find((e) => e.key === RIY); assert.ok(row && row.municipalTotal && row.target === 300e6 && row.collected === 80e6, 'the visible municipality only'); }
  else assert.ok(sec.notice, 'or an explicit unavailable state');
});

/* ------------------------------------------------------------------ source scans */
await ok('no consumer reads the browser’s plan-target store, and no consumer keeps the tolerance classification', () => {
  const consumers = ['src/data/useDecisions.js', 'src/data/decisionRoom.js', 'src/data/decisionCharts.js', 'src/data/revenueMetrics.js', 'src/data/viewerTargets.js', 'src/data/referenceTarget.js', 'src/data/revenueOutlook.js', 'src/data/assistantAnswers.js', 'src/data/smartReport.js', 'src/data/revenueInsights.js', 'src/data/reportModel.js', 'src/analysis/analysisTasks.js', 'src/context/RevenueContext.jsx', 'src/components/decisions/DecisionPlanNote.jsx', 'src/pages/DecisionRoom.jsx', 'src/components/insights/FixedReports.jsx', 'src/data/dashboardReport.js'];
  for (const f of consumers) {
    const s = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/ib_plan_targets_v1|loadTargetStore|entityTargetsFull|from '\.\/planTargets'|from '\.\.\/data\/planTargets'|planTarget\(|targetsFromBasis|planningBasis\(/.test(s), `${f}: reads the device target store`);
    assert.ok(!/on_plan|PLAN_TOLERANCE|deviationOf\(/.test(s), `${f}: tolerance class`);
    assert.ok(!/المقبوض/.test(s), `${f}: retired term`);
  }
  for (const f of consumers.filter((x) => /^src\/data\/(decisionRoom|revenueOutlook|assistantAnswers|smartReport|revenueInsights|referenceTarget|viewerTargets)\.js$/.test(x))) assert.ok(!/وفق الخطة/.test(fs.readFileSync(f, 'utf8')), `${f}: «وفق الخطة»`);
});

console.log(`plans consumers: ${n} test groups passed`);
