// CROSS-SURFACE consistency of the planning numbers (planning review, Phase 4 / PC1; docs/planning-review/08, 09 V1/V10/V13/V15).
// ONE target everywhere: the planning basis, the report targets (viewerTargets → DEFAULT_TARGETS), the achievement and the target-vs-forecast of the analysis tasks, the assistant, Smart Reports, the report model
// and its exports all show the SAME target value, status and version at coverage 66 % and 70 %, for the national scope AND for a restricted viewer's entities (computed on the full set, summed over theirs),
// and the Smart Reports / assistant planning text carries the planning basis' numbers (planned to date, forecast, forecast achievement) in Arabic and English.
// Also the dictionary: every planning metric is defined (all fields, both languages) and the old probability / «billing is insufficient» definitions are gone.
// Run with `npm run test:plancross`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStore } from '../server/store.js';
import { snapshot, series, bridge } from '../server/engine.js';
import { worklist, anomalies } from '../server/lists.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { DEFAULT_CONFIG, DEFAULT_TARGETS, targetAchievementFrom, cumulativeTargetToDate } from '../src/data/revenueMetrics.js';
import { approvedConfigOf, loadPlanInputsForPlan } from '../src/data/planInputs.js';
import { setPlansForTest, referenceViewFor } from '../src/data/plans/planStore.js';
import { seededStore, customPlanRecord, referenceEntry } from '../src/data/plans/planFixtures.js';
import { seedPlanContent } from '../src/data/plans/planDefaults.js';
import { planningBasisFromPlan } from '../src/data/plans/planBasis.js';
import { forecastPlan } from '../src/data/planForecast.js';
import { forecastReceipts, targetVsForecast, deviationWords } from '../src/data/revenueOutlook.js';
import { viewerTargets } from '../src/data/viewerTargets.js';
import { answerFor } from '../src/data/assistantAnswers.js';
import { buildSmartReport } from '../src/data/smartReport.js';
import { buildReportModel } from '../src/data/reportModel.js';
import { buildAnalysisResult } from '../src/data/revenueInsights.js';
import { runTask, createTaskState } from '../src/analysis/analysisTasks.js';
import { PLANNING_METRICS } from '../src/data/planningMetricDocs.js';
import { FORMULA_GROUPS } from '../src/data/dictionaryDocs.js';
import { DIRECTORY, entryById } from '../src/data/dictionaryDirectory.js';
import { bulletAmountAlt } from '../src/data/chartAlts.js';
import { fmtBn, fmtMoney } from '../src/utils/money.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } finally { delete globalThis.window; } n += 1; }; // `surfaces()` installs the device storage the live targets read; it stays for the whole group
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const strings = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (Array.isArray(o)) o.forEach((x) => strings(x, out)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => strings(x, out)); return out; };

const T = '2026-11-06'; const YEAR = 2026;
const st = loadStore(T); const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: T });
const RESTRICTED = ['Riyadh Amanah', 'Jeddah Amanah'];
// the reference plan: the seed (66 %-equivalent) or another saved plan with every allocation scaled to the 70 % target — the SAME plan feeds every surface
const seedC = seedPlanContent(YEAR); const SCALE = 22893.5 / 21585.3;
const PLAN70 = customPlanRecord({ id: 'plan-c0000070', name: 'خطة بتغطية 70', allocations: Object.fromEntries(seedC.allocations.map((a) => [a.entityKey, Math.round(a.amount * SCALE)])) });
const storeAt = (cov) => (cov == null ? seededStore() : { plans: [PLAN70], references: { [YEAR]: referenceEntry(PLAN70.id) } });
const scopeFor = (keys) => ({ from: `${YEAR}-01-01`, to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', org: keys ? { amanahKeys: keys } : null });
// the data service as the analysis tasks see it: the engine over the (optionally organisation-narrowed) scope
const dataFor = () => ({
  snapshot: async (sc, extra = {}) => snapshot(st, { scope: sc, cfg, ...extra }),
  series: async (sc, extra = {}) => series(st, { scope: sc, cfg: { ...cfg, cutoff: extra.asOf || T } }),
  bridge: async (sc, extra = {}) => bridge(st, { scope: sc, cfg, ...extra }),
  worklist: async (sc, limit, extra = {}) => worklist(st, { scope: sc, cfg, limit, ...extra }),
  anomalies: async (sc, limit, extra = {}) => anomalies(st, { scope: sc, cfg, limit, ...extra }),
  noncollection: async (sc, extra = {}) => nonCollectionAnalysis(st, { scope: sc, cfg, ...extra }),
  distributions: async () => null
});

/** every surface function, for one reference plan × one scope → the values read from each */
async function surfaces(cov, keys) {
  setPlansForTest(storeAt(cov));
  const view = referenceViewFor(YEAR); const sc = scopeFor(keys);
  const sn = snapshot(st, { scope: sc, cfg }); const data = dataFor();
  const inputs = await loadPlanInputsForPlan({ data }, { view, reporting: T, approvedCfg: cfg, entityKeys: keys });
  const basis = planningBasisFromPlan({ view, today: T, latestDataDate: T, entityKeys: keys, actual: inputs.actual });
  const fc = forecastPlan(basis, { history: inputs.history, now: '2026-11-06T09:00:00.000Z' });
  const tg = viewerTargets(keys);
  const fy = await data.series({ ...sc, from: `${YEAR}-01-01`, to: T }, { asOf: T });
  const ach = targetAchievementFrom(fy, sc, cfg, tg);
  const o = await forecastReceipts(data, sc, { ...DEFAULT_CONFIG, cutoff: T }, { targets: tg }); const tp = targetVsForecast(o, tg);
  const out = { snapshot: sn, forecast: o, targetPos: tp, achievement: ach, cards: [], anomalies: [] };
  const task = await runTask(createTaskState('forecast', { scope: sc }), { data, cases: [], decisions: {}, cfg: { ...DEFAULT_CONFIG, cutoff: T }, targets: tg });
  return { basis, fc, view, tg, ach, o, tp, out, sn, sc, task };
}

for (const cov of [null, 0.7]) {
  for (const keys of [null, RESTRICTED]) {
    const label = `coverage ${cov == null ? '66 (default)' : cov * 100} % · ${keys ? 'restricted viewer (Riyadh + Jeddah)' : 'national scope'}`;
    await ok(`one target value, status and version on every surface — ${label}`, async () => {
      const S = await surfaces(cov, keys);
      const v = S.basis.target.value; assert.ok(v > 0);
      if (!keys) assert.ok(near(v, cov == null ? 21585.3e6 : 22893.5e6, 0.5e6), 'national: 66 % → 21.59 bn, 70 % → 22.89 bn');
      else { assert.ok(v < S.view.content.target.amount, 'the viewer’s total is part of the plan’s'); assert.equal(S.basis.scopeKind, 'available'); assert.equal(S.tg.scopeKind, 'available'); assert.equal(S.tg.scopeLabel.ar, 'إجمالي الجهات المتاحة لك'); }
      const t = S.tg.collectionAmountAnnual;
      assert.equal(t.value, v, 'report targets (Smart Reports, assistant, fixed reports, analysis tasks)'); assert.equal(t.status, cov == null ? 'demo' : 'plan', 'seed = illustrative; a user plan is never «approved»'); assert.equal(t.versionId, S.basis.versionId); assert.equal(S.tg.reference.name, S.view.name);
      assert.equal(S.ach.annualTarget, v, 'target achievement (analysis task / Smart Reports / assistant)'); assert.equal(S.ach.status, cov == null ? 'demo' : 'plan');
      assert.equal(S.tp.annualTarget, v, 'target vs forecast'); assert.equal(S.tp.targetStatus, cov == null ? 'demo' : 'plan'); assert.equal(S.tp.targetVersion, S.basis.versionId);
      assert.ok(/^completed/.test(S.task.status), `the analysis task ran (${S.task.status} ${S.task.error?.message || ''})`);
      const tr = strings(S.task.result).join(' '); assert.ok(tr.includes(fmtMoney(v, { lang: 'en' })) || tr.includes(fmtMoney(v, { lang: 'ar' })) || tr.includes(fmtBn(v, { lang: 'en' })) || tr.includes(fmtBn(v, { lang: 'ar' })), 'the analysis task’s own result names the same target');
      assert.ok(S.task.stages.every((x) => !/trend|الاتجاه/i.test(strings(x.label).join(' ') + strings(x.detail).join(' '))), 'no «trend» stage label');
      if (!keys) assert.equal(DEFAULT_TARGETS === viewerTargets(null), true, 'no narrowing → the plan’s own targets object (DEFAULT_TARGETS)');
      // the achievement’s own scope caveat: a viewer whose organisation is exactly the target’s entities is NOT caveated; a national target against a narrower organisation would be
      assert.equal(S.ach.scopeCaveat, false, 'the target covers exactly the entities of the data');
      assert.equal(S.ach.targetScope, keys ? 'available' : 'ministry');
      assert.equal(S.tp.scopeCaveat, false);
      // planned to date: ONE implementation (day-prorated cumulative plan), same number from the basis, the achievement and the position
      assert.ok(near(S.ach.targetYtd, S.basis.plannedToDate, 1e-3), 'planned to date: achievement = basis'); assert.ok(near(S.tp.plannedToDate, S.basis.plannedToDate, 1e-3), 'planned to date: target position = basis');
      assert.ok(near(cumulativeTargetToDate(S.tg, T), S.basis.plannedToDate, 1e-3));
      assert.ok(near(S.tp.actualToDate, S.basis.actualToDate, 1) && near(S.tp.deviationAmount, S.basis.deviation.amount, 1e-3), 'deviation: position = basis'); assert.equal(S.tp.deviationLabel.ar, deviationWords(S.basis.deviation.amount).ar); assert.ok(!('status' in S.basis.deviation), 'no tolerance class');
    });
    await ok(`Smart Reports and the assistant carry the basis numbers (planned to date, forecast, forecast achievement %), AR and EN — ${label}`, async () => {
      const S = await surfaces(cov, keys); const f = { forecast: S.fc.forecastTotal, forecastAchievementPct: S.fc.expectedAchievementPct };
      assert.equal(S.fc.state, 'ok'); assert.ok(near(S.tp.projectedTotal, f.forecast, 1), 'the forecast = the plan forecast'); assert.ok(near(S.tp.forecastAchievementPct, f.forecastAchievementPct, 1e-9), 'forecast achievement % = the plan basis');
      for (const lang of ['en', 'ar']) {
        const MB = (x) => fmtBn(x || 0, { lang }); const MS = (x) => fmtMoney(x || 0, { lang });
        const pct = `${(f.forecastAchievementPct * 100).toFixed(1)}%`;
        const a = answerFor('forecast', S.out, { lang }).text;
        const r = buildSmartReport({ snapshot: S.sn, forecast: S.o, targetPos: S.tp, achievement: S.ach, cards: [], anomalies: [], cases: [], lang });
        const rep = strings(r.predictions).join(' ');
        for (const [name, txt, M] of [['assistant', a, MB], ['Smart Report', rep, MS]]) {
          assert.ok(txt.includes(M(S.basis.target.value)), `${name} (${lang}): the target ${M(S.basis.target.value)}`);
          assert.ok(txt.includes(M(S.basis.plannedToDate)), `${name} (${lang}): planned to date ${M(S.basis.plannedToDate)}`);
          assert.ok(txt.includes(M(f.forecast)), `${name} (${lang}): the forecast ${M(f.forecast)}`);
          assert.ok(txt.includes(pct), `${name} (${lang}): forecast achievement ${pct}`);
          assert.ok(txt.includes(M(S.basis.actualToDate)), `${name} (${lang}): actual to date`);
          assert.ok(txt.includes(S.view.name), `${name} (${lang}): the SOURCE PLAN is named`); assert.ok(!/معتمد|approved/i.test(txt.replace(/not an approved model|غير معتمد|نموذجًا معتمدًا|نموذجاً معتمداً/g, '')), `${name} (${lang}): a plan target is never called approved`);
          assert.ok(lang === 'en' ? /even/i.test(txt) && /assumption/i.test(txt) : /افتراض/.test(txt), `${name} (${lang}): the even split is labelled an assumption`);
          assert.ok(lang === 'en' ? /Not aligned with the forecasting teams/.test(txt) : /غير مُواءَم مع منهجية فرق التوقع/.test(txt), `${name} (${lang}): the non-alignment note`);
          assert.ok(txt.includes('runrate3_v2'), `${name} (${lang}): the method id`);
          if (keys) assert.ok(txt.includes(lang === 'en' ? 'Total of the entities available to you' : 'إجمالي الجهات المتاحة لك'), `${name} (${lang}): the restricted label`);
          else assert.ok(!txt.includes('إجمالي الجهات المتاحة لك') && !txt.includes('available to you'), `${name} (${lang}): no restricted label for the national scope`);
          for (const bad of [/الحد الأقصى الممكن/, /maximum possible/i, /\bprobability of \d/i, /احتمالية\s*[:：]?\s*\d/, /\d\s*%\s*احتمال/, /billing.insufficient/i, /مبررات عدم تحقيق/]) assert.ok(!bad.test(txt), `${name} (${lang}): forbidden ${bad}`);
        }
        // the old wording of the target is gone
        assert.ok(!/cumulative demo target|المستهدف التراكمي التوضيحي/.test(strings(r).join(' ') + a));
        // the achievement line, where the scope allows it, names the planned-to-date and the available-entities scope
        const tc = strings(r.keyMetrics).join(' '); assert.ok(tc.includes(MS(S.basis.plannedToDate)), `Smart Report (${lang}): the achievement metric is against the planned to date`);
        // the analysis result (indicators) shows the same status and scope label
        const res = strings(buildAnalysisResult('forecast', { snapshot: S.sn, forecast: S.o, targetPos: S.tp, achievement: S.ach, cards: [], references: [] })).join(' ');
        assert.ok(res.includes(S.view.name) && /المستهدف السنوي للإيراد في الخطة/.test(res)); if (keys) assert.ok(res.includes('إجمالي الجهات المتاحة لك') && res.includes('Total of the entities available to you'));
      }
    });
  }
}

await ok('the report model (the source of the Word / Excel / PowerPoint / PDF exports) carries the same planning figures — detailed Smart Report, national and restricted', async () => {
  for (const keys of [null, RESTRICTED]) {
    const S = await surfaces(0.7, keys); const f = { forecast: S.fc.forecastTotal, forecastAchievementPct: S.fc.expectedAchievementPct };
    for (const lang of ['ar', 'en']) {
      const spec = { kind: 'smart', depth: 'detailed', focus: 'revenue', scope: { ...S.sc, preset: 'ytd' }, sections: ['executive'], title: 'x', compare: 'none' };
      let model; try { model = buildReportModel({ spec, lang, out: S.out, targets: S.tg, cases: [], meta: null, generatedAt: new Date('2026-11-06T09:00:00Z') }); } catch (e) { e.message = `buildReportModel: ${e.message}`; throw e; }
      const sec = (model.sections || []).find((x) => x.key === 'forecast'); assert.ok(sec, 'the detailed report has the «forecast and its limits» section');
      const txt = strings(sec.blocks).join(' '); const M = (x) => fmtMoney(x || 0, { lang });
      assert.ok(txt.includes(M(S.basis.plannedToDate)) && txt.includes(M(f.forecast)) && txt.includes(`${(f.forecastAchievementPct * 100).toFixed(1)}%`) && txt.includes(M(S.basis.target.value)), `export section (${lang}${keys ? ', restricted' : ''}) carries the target, planned to date, forecast and forecast achievement`);
      assert.ok(!/(الحد الأقصى الممكن|maximum possible)/i.test(JSON.stringify(model)));
    }
  }
});

await ok('the bullet chart alternative reads the day-prorated planned-to-date (no month-end plan) and is drawn only for an approved target', async () => {
  const S = await surfaces(0.7, null);
  const draft = bulletAmountAlt({ targets: S.tg, snapshot: S.sn, scope: { from: `${YEAR}-01-01`, to: T, amanah: 'all', source: 'all' }, lang: 'en' }); assert.equal(draft.alts, undefined, 'an illustrative target draws no bullet');
  const appr = { ...S.tg, collectionAmountAnnual: { ...S.tg.collectionAmountAnnual, status: 'approved' } };
  const m = bulletAmountAlt({ targets: appr, snapshot: S.sn, scope: { from: `${YEAR}-01-01`, to: T, amanah: 'all', source: 'all' }, lang: 'en' });
  if (m.alts) assert.ok(near(m.alts.bullet.bullets[0].target, S.basis.plannedToDate, 1e-3), 'the bullet target = planned to date at the cut-off DAY');
  const src = fs.readFileSync('src/data/chartAlts.js', 'utf8'); assert.ok(!/cumulativeTargetToDate\(targets, through\.slice\(0, 7\)\)/.test(src), 'no month-end call remains');
});

await ok('a national target against a narrower organisation keeps its caveat; the analysis task labels follow the baseline (no «trend»), and every surface reads the viewer’s targets', async () => {
  const sc = scopeFor(RESTRICTED); const fy = await dataFor().series({ ...sc, from: `${YEAR}-01-01`, to: T }, { asOf: T });
  assert.equal(targetAchievementFrom(fy, sc, cfg, DEFAULT_TARGETS).scopeCaveat, true, 'the Ministry target is not compared with a narrower organisation');
  const src = fs.readFileSync('src/analysis/analysisTasks.js', 'utf8'); assert.ok(!/Fit trend|مُلاءمة الاتجاه|the approved target without|المستهدف المعتمد دون/.test(src), 'the stale stage labels are gone');
  const ctx = fs.readFileSync('src/context/RevenueContext.jsx', 'utf8'); assert.ok(/viewerTargets\(viewerKeys/.test(ctx) && /allowedEntityKeys\(access\.geoScope\)/.test(ctx) && !/targets = DEFAULT_TARGETS/.test(ctx), 'the context hands every report the viewer’s targets (the entities of the ACCOUNT\'s own scope)');
  const fx = fs.readFileSync('src/components/insights/FixedReports.jsx', 'utf8'); assert.ok(/forecastReceipts\(data, scopeBase, cfg, \{ targets \}\)/.test(fx), 'fixed reports forecast with the viewer’s targets');
});

await ok('dictionary: every planning metric has all definition fields in AR and EN, the probability entry is the honest «not estimated» one, and the old definitions are gone', () => {
  const need = ['key', 'label', 'brief', 'definition', 'formula', 'f', 'unit', 'level', 'period', 'dateBasis', 'sourceFields', 'missing', 'owner', 'where'];
  const keys = ['annualTarget', 'actualToDate', 'plannedToDate', 'planDeviation', 'annualAchievement', 'remainingTarget', 'requiredPace', 'recentPace', 'forecastBaseline', 'forecastAchievement', 'forecastGap', 'gapContribution', 'actionClasses', 'probabilityStatus'];
  const have = PLANNING_METRICS.map((m) => m.key); // the plan pages' dictionary may add plan-concept entries and rename «annualAchievement» → «planAchievement» (revenue plans); every original metric must still be defined
  for (const k of keys) assert.ok(have.includes(k) || (k === 'annualAchievement' && have.includes('planAchievement')), `metric ${k} is defined`);
  for (const m of PLANNING_METRICS) {
    for (const k of need) assert.ok(m[k] != null && m[k] !== '', `${m.key}.${k}`);
    for (const k of ['label', 'brief', 'definition', 'formula', 'unit', 'level', 'period', 'dateBasis', 'sourceFields', 'missing', 'owner']) assert.ok(m[k].ar?.trim() && m[k].en?.trim(), `${m.key}.${k} in both languages`);
    const e = entryById(m.key); assert.ok(e && e.unit && e.sourceFields && e.missing && e.owner && e.aggregation, `${m.key} is in the dictionary directory with its full field set`); assert.deepEqual(e.definition, m.definition);
  }
  const all = JSON.stringify([PLANNING_METRICS, FORMULA_GROUPS, DIRECTORY]);
  assert.ok(!/billing_insufficient|maxTotal|normalCdf|clamped to \[0\.01|1 − Φ|"name":\{"ar":"الاحتمال"/.test(all), 'the old probability and «billing is insufficient» definitions are removed');
  const g = FORMULA_GROUPS.find((x) => x.rows.some((r) => r.name.ar === 'احتمالية تحقيق المستهدف: غير مقدَّرة')); assert.ok(g, 'the group holds the «probability: not estimated» row');
  const p = PLANNING_METRICS.find((m) => m.key === 'probabilityStatus'); assert.ok(/36/.test(p.definition.en) && /load date/i.test(p.definition.en) && /تحميل/.test(p.definition.ar), 'what data would be needed is stated');
  assert.ok(/runrate3_v2/.test(PLANNING_METRICS.find((m) => m.key === 'forecastBaseline').f) && /غير مُواءَم/.test(PLANNING_METRICS.find((m) => m.key === 'forecastBaseline').definition.ar));
  assert.ok(!/0\.005/.test(PLANNING_METRICS.find((m) => m.key === 'planDeviation').f), 'no tolerance band in the deviation formula (spec §0.4)');
  for (const r of g.rows) assert.ok(r.f && r.where && r.name?.ar && r.meaning?.ar && r.unit && r.owner, 'formula rows keep the existing structure');
  // PD1: the dictionary has a TEXT search box and category links (the planning category); still no financial filter panel (scope / period / amount / source selectors, no live data)
  for (const f of ['src/pages/Metrics.jsx']) { const src = fs.readFileSync(f, 'utf8'); assert.ok(!/ScopeBar|LocalFilterToolbar|useRevenue|snapshot|<select|type="date"|type="number"/.test(src), 'no financial filter panel on the dictionary page'); assert.deepEqual([...src.matchAll(/<input[^>]*>/g)].map((m) => /type="search"/.test(m[0])), [true], 'the only input is the text search'); }
  for (const m of PLANNING_METRICS) { const e = entryById(m.key); assert.ok(e.category === 'planning' && e.symbolic === m.f && e.where === m.where && e.filters === m.filters, `${m.key}: category, symbolic formula, provenance and filters are in the directory entry`); }
  assert.ok(!/مقبوض/.test(fs.readFileSync('src/data/planningMetricDocs.js', 'utf8')), 'the retired term is not used');
});

console.log(`planning cross-surface: ${n} test groups passed`);
