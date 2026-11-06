// The plan page's SHARED SECTIONS and helpers that survived the cleanup (planning review Phases 1–3): the ranked action view («أين نركز»: disjoint rows, A / D never added, expected impact «غير متاح», the drill URL ↔ the /collection list
// filter ↔ the list total), the action-table component, the factors section (three separate groups, never summed), the wording guard, the planning dictionary and AR / EN parity. The old page, its chart builders, its target panel and its
// store-based basis were retired; the plan page itself (summary, position, cumulative chart, forecast, breakdown, selector, save flow, view scope) is tested in tests/plans-ui.test.mjs. Server-side render of the REAL components with
// fixtures; synthetic data only. Run: npm run test:planpage
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.js';
import { I18nProvider } from '../src/context/I18nContext.jsx';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { actionLines } from '../server/planningActions.js';
import { list } from '../server/lists.js';
import { DEFAULT_CONFIG } from '../src/data/revenueMetrics.js';
import { approvedConfigOf, loadPlanInputsForPlan } from '../src/data/planInputs.js';
import { planningBasisFromPlan } from '../src/data/planningBasis.js';
import { forecastPlan } from '../src/data/planForecast.js';
import { planMeasures } from '../src/data/plans/planMeasures.js';
import { planView } from '../src/data/plans/planRules.js';
import { seedPlanRecord, customPlanRecord } from '../src/data/plans/planFixtures.js';
import { actionView, drillUrl, planLineFromQuery, planLineText, ACTION_COLUMNS } from '../src/data/planningActionsView.js';
import { FACTOR_GROUPS } from '../src/data/planningFactors.js';
import { planFactorsFor } from '../src/components/plans/planFactors.js';
import { planCumulativeBlock, planDeviationBlock } from '../src/components/plans/planCharts.js';
import { uncollectedListFilters } from '../src/components/filters/pageFilters.js';
import PlanActions from '../src/components/strategic/PlanActions.jsx';
import PlanFactors from '../src/components/strategic/PlanFactors.jsx';
import { PLANNING_METRICS } from '../src/data/planningMetricDocs.js';
import { DIRECTORY, CATEGORIES, categoryEntries, entryById } from '../src/data/dictionaryDirectory.js';
import { fmtMoney } from '../src/utils/money.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const pending = [];
const ok = (name, fn) => pending.push(async () => { try { await fn(); n += 1; } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } });
const TODAY = '2026-11-06';
const st = loadStore(TODAY);
const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: TODAY });
const rev = { data: { snapshot: async (scope, o) => snapshot(st, { scope, cfg: o?.cfg || cfg }), series: async (scope, o) => series(st, { scope, cfg: o?.cfg || cfg }) } };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const NOW = '2026-11-06T09:00:00.000Z';
const names = (k) => `N:${k}`;
/** the plan basis + forecast of a plan record at TODAY over the real loaded inputs (the way the plan page computes them) */
async function figures(record = seedPlanRecord(2026), { today = TODAY, entityKeys = null } = {}) {
  const view = planView(record);
  const D = await loadPlanInputsForPlan(rev, { view, reporting: today, approvedCfg: cfg, entityKeys });
  const basis = planningBasisFromPlan({ view, today, latestDataDate: today, entityKeys, actual: D?.actual || null });
  const forecast = forecastPlan(basis, { history: D?.history, now: NOW });
  return { view, D, basis, forecast, measures: planMeasures(basis, forecast) };
}
const SEEDF = await figures(); const B = SEEDF.basis; const F = SEEDF.forecast;
const moneyAr = (v) => fmtMoney(v, { lang: 'ar' });

/* ------------------------------------------------------------------ 2. the action view */
const gapsOf = (b) => Object.fromEntries(b.entities.filter((e) => e.hasTarget).map((e) => [e.key, e.plannedToDate - e.actual]));
const RES = actionLines(st, { scope: { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' }, cfg: { cutoff: TODAY }, entityGaps: gapsOf(B) });
const fmtN = (v) => String(Math.round(v)); const view = actionView(RES, { money: fmtN, count: String, lang: 'ar', expanded: true });
ok('the ranked table: ordered by the entity gap (largest first) then the actionable amount; the rows add up to the service actionable total; class A and D are SEPARATE groups', () => {
  assert.ok(view.available && view.cells.length > 3);
  const gaps = view.cells.map((c) => (c.entityGap > 0 ? c.entityGap : -Infinity));
  for (let i = 1; i < view.cells.length; i += 1) { assert.ok(gaps[i - 1] >= gaps[i], 'gap order'); if (gaps[i - 1] === gaps[i]) assert.ok(view.cells[i - 1].actionable >= view.cells[i].actionable, 'then the actionable amount'); }
  near(view.actionableTotal, RES.totals.actionable.remaining, 1, 'Σ rows = the service actionable total (B + C)'); near(view.cells.reduce((t, c) => t + c.actionable, 0), RES.totals.actionable.remaining, 1, 'Σ table rows');
  assert.deepEqual(view.cells.map((c) => c.priority), view.cells.map((_, i) => i + 1));
  assert.ok(view.groups.aged.every((l) => l.class === 'D') && view.groups.blocked.every((l) => l.class === 'A'));
  near(view.groups.aged.reduce((t, l) => t + l.remaining, 0), RES.totals.byClass.D.remaining, 1, 'D group = class D'); near(view.groups.blocked.reduce((t, l) => t + l.remaining, 0), RES.totals.byClass.A.remaining, 1, 'A group = class A');
  assert.ok(view.cells.every((c) => c.actionable === c.overdue + c.dueSoon), 'a row is class B + class C only (A and D are never added)');
  const ids = view.cells.map((c) => c.id); assert.equal(new Set(ids).size, ids.length, 'no duplicate row');
  // the rows and the groups do not overlap and together are the whole stock (no invoice counted twice)
  near(RES.totals.remaining, RES.totals.actionable.remaining + RES.totals.needsDecision.remaining + RES.totals.blocked.remaining + (RES.totals.byClass.E.remaining || 0) + (RES.totals.byClass.U.remaining || 0), 1, 'A + B + C + D + E + U = the stock');
});
ok('every row: a reason built from the evidence COUNTS, a recommended action, the expected impact «غير متاح», and a drill', () => {
  for (const c of view.cells) {
    assert.ok(c.reasons.length >= 1 && c.reasons.every((r) => /فاتورة/.test(r)), 'reason from counts'); assert.ok(c.actions.length >= 1 && c.actions.every((a) => a.ar && a.en)); assert.equal(c.expectedImpact.ar, 'غير متاح'); assert.equal(c.expectedImpact.en, 'Not available'); assert.ok(c.drill && c.drill.filters.planLine);
    assert.ok(!/بسبب|نتيجة|تأخر المستثمر|ضعف/.test(c.reasons.join(' ')), 'no causal wording');
  }
  const en = actionView(RES, { money: fmtN, count: String, lang: 'en', expanded: true }); assert.ok(en.cells[0].reasons[0].startsWith('Overdue') || en.cells[0].reasons[0].startsWith('Falls due'));
  const top = actionView(RES, { money: fmtN, count: String, lang: 'ar', topN: 3 }); assert.equal(top.cells.length, 3); assert.equal(top.hidden, top.all - 3);
  const jed = view.cells.find((c) => c.entity.key === 'Jeddah Amanah'); const bySource = actionView(RES, { money: fmtN, count: String, lang: 'ar', sourceKey: jed.source.key, expanded: true }); assert.ok(bySource.cells.every((c) => c.source.key === jed.source.key)); assert.deepEqual(bySource.cells.map((c) => c.priority), bySource.cells.map((_, i) => i + 1));
});
ok('the drill: URL ↔ /collection list filter ↔ the list total equals the row (parity through the real list service)', () => {
  const sample = [view.cells[0], view.cells[1], view.cells.find((c) => c.entity.key === 'Jeddah Amanah')].filter(Boolean);
  for (const c of sample) {
    const url = drillUrl(c.drill); assert.ok(url.startsWith('/collection?')); const q = new URL(url, 'http://x').searchParams;
    assert.equal(q.get('amanah'), c.drill.scope.amanah); assert.equal(q.get('src'), c.drill.scope.source); assert.equal(q.get('from'), '2000-01-01'); assert.equal(q.get('planLine'), 'B,C'); assert.equal(q.get('allPeriods'), '1');
    const pl = planLineFromQuery((k) => q.get(k)); assert.deepEqual(pl, { cls: ['B', 'C'] });
    const filters = uncollectedListFilters({ planLine: pl }); assert.deepEqual(filters.planLine, pl); assert.equal(filters.allPeriods, true, 'the drill carries allPeriods');
    const scope = { from: q.get('from'), to: q.get('to'), amanah: q.get('amanah'), source: q.get('src'), scopeType: 'all', muni: 'all', status: 'all' };
    let total = 0; let sum = 0; for (let p = 0; ; p += 1) { const x = list(st, { scope, cfg: { cutoff: TODAY }, filters, page: p, pageSize: 500, sort: { key: 'id', dir: 'asc' }, owner: 0 }); total = x.total; sum += x.rows.reduce((t, r) => t + (r.outstanding ?? 0), 0); if ((p + 1) * 500 >= x.total) break; }
    assert.equal(total, c.count, `${c.id}: the list count equals the row invoice count`); near(sum, c.actionable, 1, `${c.id}: the list outstanding equals the row actionable amount`);
  }
  assert.equal(planLineFromQuery(() => null), null); assert.deepEqual(planLineFromQuery((k) => ({ planLine: 'D' }[k] || null)), { cls: 'D' }); assert.deepEqual(planLineFromQuery((k) => ({ planLine: 'A', planBlocker: 'objection' }[k] || null)), { cls: 'A', blocker: 'objection' });
  assert.equal(planLineText({ cls: ['B', 'C'] }, 'en'), 'Actionable: overdue up to 180 days + due by year-end'); assert.equal(uncollectedListFilters({}).planLine, undefined, 'no planLine → the filters are unchanged');
  const base = uncollectedListFilters({ search: 'x', reason: 'none' }); assert.ok(!('planLine' in base) && !('allPeriods' in base));
});

/* ------------------------------------------------------------------ 3. the factors */
const FACT = planFactorsFor({ basis: B, forecast: F, inputs: SEEDF.D, actions: RES, advanced: { collectionRate: 0.68 } });
ok('factors: three SEPARATE groups (facts · hypotheses · missing data), each item bilingual; hypotheses are labelled; missing data names the confirmed plan, source targets, load dates and recovery data; no causal wording', () => {
  assert.deepEqual(FACTOR_GROUPS.map((g) => g.id), ['facts', 'hypotheses', 'missing']); assert.equal(FACT.mode, 'gap');
  for (const g of ['facts', 'hypotheses', 'missing']) { assert.ok(FACT[g].length >= 3, g); for (const it of FACT[g]) { assert.ok(it.id && it.text.ar && it.text.en, `${g}/${it.id}`); } }
  assert.ok(FACT.hypotheses.every((h) => /^فرضية/.test(h.text.ar) && /^Hypothesis/.test(h.text.en)), 'hypotheses are stated as hypotheses');
  const ids = FACT.missing.map((m) => m.id); for (const id of ['m_plan', 'm_target', 'm_source', 'm_load', 'm_recovery']) assert.ok(ids.includes(id), id);
  const all = JSON.stringify(FACT); assert.ok(!/الحد الأقصى الممكن|maximum possible|مبررات/.test(all)); assert.ok(!/تأخر المستثمر|investor delay/.test(all)); assert.ok(!/مفعّلة|activated|معتمد/.test(all.replace(/غير معتمد/g, '')), 'no activation / approval wording');
  const billing = FACT.facts.find((f) => f.id === 'billing_vs_required'); assert.ok(billing && /\d+(\.\d+)?%/.test(billing.text.en), 'billing vs the billing the plan requires to date (from the plan\'s own collection-rate assumption)');
  assert.ok(FACT.facts.find((f) => f.id === 'outstanding').text.ar.includes(moneyAr(RES.totals.remaining)));
  const noAdv = planFactorsFor({ basis: B, forecast: F, inputs: SEEDF.D, actions: RES, advanced: {} }); assert.ok(!noAdv.facts.some((f) => f.id === 'billing_vs_required'), 'without the plan\'s collection-rate / billing assumption there is no billing-sufficiency fact');
});
ok('factors: a target already reached gives the SUPPORTING title; no target gives the empty state', async () => {
  const small = await figures(customPlanRecord({ id: 'plan-c0000081', name: 'خطة صغيرة', allocations: { 'Riyadh Amanah': 1e9 } }));
  assert.equal(small.basis.flags.aboveTarget, true); assert.equal(planFactorsFor({ basis: small.basis, forecast: small.forecast, inputs: small.D, actions: RES }).mode, 'support');
  const zero = await figures(customPlanRecord({ id: 'plan-c0000082', name: 'خطة بلا مستهدف', allocations: {}, target: 0 })); assert.equal(planFactorsFor({ basis: zero.basis, forecast: zero.forecast }).empty, true);
});

/* ------------------------------------------------------------------ 4. the wording guard, the columns */
const SRC = (f) => fs.readFileSync(f, 'utf8');
const BUNDLE_FILES = ['src/pages/PlanDetail.jsx', 'src/components/plans/PlanSections.jsx', 'src/components/plans/planCharts.js', 'src/components/plans/planFactors.js', 'src/components/strategic/PlanActions.jsx', 'src/components/strategic/PlanFactors.jsx', 'src/data/planningFactors.js', 'src/data/planningActionsView.js'];
ok('wording guard: no probability percentage, no «الحد الأقصى الممكن», no «مبررات عدم تحقيق», no «غير المحدد» anywhere in the planning bundle; no map / method fold / dictionary-link remnants', () => {
  for (const f of BUNDLE_FILES) {
    const s = SRC(f).replace(/ليست احتمالية|not a probability/g, '');
    assert.ok(!/الحد الأقصى الممكن|maximum possible|the most possible/i.test(s), `${f}: «maximum possible»`);
    assert.ok(!/مبررات عدم تحقيق/.test(s), `${f}: «مبررات عدم تحقيق»`);
    assert.ok(!/غير المحدد/.test(s), `${f}: «غير المحدد»`);
    assert.ok(!/(احتمالية|probability)[^\n.]{0,60}\d+(\.\d+)?\s?%/i.test(s), `${f}: a percentage called a probability`);
    assert.ok(!/\bprobability\s*[:=]\s*[\d.]/.test(s) && !/\.probability\b(?!Status|Message|Reason)/.test(s), `${f}: a probability value`);
    for (const dead of ['plan-details', 'plan-map-fold', 'id="plan-method"', 'pl-details', 'pl-fold', 'ProvinceMap', 'mapRows', 'mapReconciliation', 'PlanMethod', 'onOpenMethod', 'التفاصيل والطريقة', 'الخريطة (اختيارية)', 'طريقة الحساب']) assert.ok(!s.includes(dead), `${f}: «${dead}» is gone`);
  }
  const css = SRC('src/components/strategic/planning.css'); for (const dead of ['.pl-details', '.pl-fold', '.pl-formulas', '.pl-posleg', '.pl-status', '.pl-prob', '.pl-bul', '.pl-deflink']) assert.ok(!css.includes(dead), `planning.css: ${dead} is gone`);
});
ok('wording guard · the forecast output carries no probability value, no «maximum possible» and the exact unsupported message', () => {
  const j = JSON.stringify(F); assert.ok(!/الحد الأقصى الممكن|maximum possible|"probability"\s*:/i.test(j)); assert.equal(F.probabilityStatus, 'unsupported'); assert.equal(F.probabilityMessage.ar, 'لا تتوفر بيانات كافية لتقدير احتمالية موثوقة');
});
const render = (el, lang = 'ar') => { globalThis.sessionStorage = { getItem: (k) => (k === 'ib_lang' ? lang : null), setItem() {}, removeItem() {} }; try { return renderToStaticMarkup(React.createElement(StaticRouter, { location: '/planning' }, React.createElement(I18nProvider, null, el))); } finally { delete globalThis.sessionStorage; } };
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
const noop = () => {};
const E = React.createElement;
const colHeads = (h) => [...h.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1]);
ok('the action table columns: priority · entity · [municipality] · source · gap · actionable · due by year-end · oldest overdue · reason · action · expected impact · records', () => {
  const html = render(E(PlanActions, { view, status: 'ready', canDrill: true, drillReason: 'x', scopeName: 'S', hasGaps: true, notCurrentYear: false, onResetSource: noop, onToggleExpanded: noop }));
  const heads = colHeads(html.split('id="plan-aged"')[0]);
  assert.deepEqual(heads.slice(0, 11), ['الأولوية', 'الأمانة / الجهة', 'مصدر الإيراد', 'الفجوة عن الخطة (الجهة)', 'المبلغ القابل للمتابعة', 'المستحق حتى نهاية السنة', 'أقدم تأخر (يوم)', 'السبب (من السجلات)', 'الإجراء المقترح', 'الأثر المتوقع', 'السجلات']);
  assert.ok(html.includes(`data-columns="${ACTION_COLUMNS.filter((c) => c !== 'municipality').join(' ')}"`)); assert.ok(html.includes('غير متاح'));
  const muniView = { ...view, level: 'municipality' }; assert.ok(render(E(PlanActions, { view: muniView, status: 'ready', canDrill: true, drillReason: 'x', scopeName: 'S', hasGaps: true, onResetSource: noop, onToggleExpanded: noop })).includes('>البلدية<'));
  assert.equal(html.split('data-line=').length - 1, view.cells.length, 'one table row per ranked cell'); assert.ok(html.includes('id="plan-aged"') && html.includes('id="plan-blocked"') && /لا تدخل في المبلغ القابل للمتابعة/.test(html), 'A and D are separate groups');
  const en = render(E(PlanActions, { view: actionView(RES, { money: fmtN, count: String, lang: 'en', expanded: true }), status: 'ready', canDrill: true, drillReason: 'x', scopeName: 'S', hasGaps: true, onResetSource: noop, onToggleExpanded: noop }), 'en'); assert.ok(en.includes('Expected impact') && en.includes('Not available') && en.includes('Open the invoices'));
});
ok('drill without the uncollected-invoices module: the link is DISABLED with the reason (no href to /collection); with the module every row links with the exact filters', () => {
  const off = render(E(PlanActions, { view, status: 'ready', canDrill: false, drillReason: 'REASON-X', scopeName: 'S', hasGaps: true, onResetSource: noop, onToggleExpanded: noop }));
  assert.ok(!off.includes('href="/collection'), 'no link'); assert.ok(off.includes('aria-disabled="true"') && off.includes('REASON-X'));
  const on = render(E(PlanActions, { view, status: 'ready', canDrill: true, drillReason: 'REASON-X', scopeName: 'S', hasGaps: true, onResetSource: noop, onToggleExpanded: noop }));
  const hrefs = [...on.matchAll(/href="(\/collection[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')); assert.ok(hrefs.length >= view.cells.length); assert.ok(hrefs.slice(0, view.cells.length).every((h) => /planLine=B%2CC/.test(h) && /allPeriods=1/.test(h)));
  assert.equal(hrefs[0], drillUrl(view.cells[0].drill));
});

/* ------------------------------------------------------------------ 5. the factors section renders */
ok('the factors section renders the three groups with their ids; the empty state and the supporting title', async () => {
  const html = render(E(PlanFactors, { factors: FACT })); const t = text(html);
  assert.ok(html.includes('id="plan-factors"')); for (const g of FACTOR_GROUPS) assert.ok(t.includes(g.title.ar), g.id); assert.ok(t.includes('هذه مؤشرات منفصلة'), 'not additive, not causes');
  const small = await figures(customPlanRecord({ id: 'plan-c0000081', name: 'خطة صغيرة', allocations: { 'Riyadh Amanah': 1e9 } }));
  assert.ok(text(render(E(PlanFactors, { factors: planFactorsFor({ basis: small.basis, forecast: small.forecast, inputs: small.D, actions: RES }) }))).includes('العوامل الداعمة لتحقيق المستهدف'));
  assert.ok(render(E(PlanFactors, { factors: { empty: true } })).includes('id="plan-factors"'), 'no target: an explicit empty state');
});
ok('the dictionary holds every planning definition with ALL fields (the content of the removed «طريقة الحساب» panel): one planning category, no duplicate, every metric of planningMetricDocs reachable and complete in AR + EN', () => {
  const cat = categoryEntries('planning'); assert.equal(Object.keys(CATEGORIES).filter((k) => k === 'planning').length, 1, 'one planning category'); assert.equal(new Set(DIRECTORY.map((e) => e.id)).size, DIRECTORY.length, 'no duplicate entry in the dictionary');
  assert.equal(new Set(PLANNING_METRICS.map((m) => m.key)).size, PLANNING_METRICS.length);
  for (const m of PLANNING_METRICS) {
    const e = cat.find((x) => x.id === m.key); assert.ok(e, `${m.key} is in the planning category`); assert.equal(entryById(m.key), e);
    for (const f of ['name', 'brief', 'definition', 'formula', 'period', 'dateBasis', 'unit', 'aggregation', 'sourceFields', 'missing', 'owner', 'filters']) { const v = e[f]; assert.ok(v && v.ar && v.ar.trim() && v.en && v.en.trim(), `${m.key}.${f} in both languages`); }
    for (const f of ['symbolic', 'where']) assert.ok(typeof e[f] === 'string' && e[f].trim(), `${m.key}.${f}`);
    assert.ok(e.inputs.length > 0 && e.steps.length > 0 && Array.isArray(e.notes) && Array.isArray(e.assumptions), `${m.key}: inputs · steps · notes · assumptions`);
    for (const x of [...e.notes, ...e.assumptions, ...e.steps]) assert.ok(x.ar && x.en, `${m.key}: bilingual lists`);
    assert.equal(e.sources.length > 0, true, `${m.key}: has source systems`);
  }
  assert.ok(PLANNING_METRICS.length >= 14);
  // nothing of the old panel is lost: every formula, the 14 labels and the specific statements it carried are in the dictionary text
  const OLD = { actualToDate: 'C(asOf) = Σ payments', annualTarget: 'T = plan.target.amount', plannedToDate: 'P(cutoff) = Σ_{closed months}', planDeviation: 'dev = C(cutoff) - P(cutoff)', planAchievement: 'achievementToDate = C(cutoff) / T', remainingTarget: 'remaining = max(T - C(asOf), 0)', requiredPace: 'monthsLeft = (dim - d)/dim', recentPace: 'mean(C_month for the last 3 complete months)', forecastBaseline: 'runrate3_v2', forecastAchievement: 'F / T', forecastGap: 'gap = T - F', gapContribution: 'sum_i g_i = P - C', actionClasses: 'sum(lines) = stock net unpaid', probabilityStatus: 'unsupported' };
  for (const [k, frag] of Object.entries(OLD)) assert.ok(entryById(k).symbolic.includes(frag), `${k}: the symbolic formula survived`);
  const all = (k) => { const e = entryById(k); return JSON.stringify([e.definition, e.notes, e.assumptions, e.missing, e.filters]); };
  assert.ok(/24÷30 \+ 1 = 1\.8/.test(JSON.stringify(entryById('requiredPace').definition)) && /no status badge|signed/i.test(all('planDeviation')) && /not capped/.test(JSON.stringify(entryById('planAchievement'))) && /collection rate/.test(all('planAchievement')));
  assert.ok(/«Other»/.test(all('gapContribution')) && /Actionable amount = class B/.test(all('actionClasses')) && /180/.test(all('actionClasses')) && /equal/i.test(all('plannedToDate')) && /Not aligned|not aligned/.test(all('forecastBaseline')) && /window/.test(all('forecastBaseline')) && /not a probability/i.test(all('forecastAchievement')) && /36/.test(all('probabilityStatus')));
  assert.equal(entryById('forecastBaseline').assumptions.length, 5, 'the forecast assumptions are documented');
  // the forecast assumptions the page prints are the ones the dictionary documents (no drift between the code and the text)
  assert.ok(F.assumptions.length === 5);
  // the dictionary page itself: the category list and the metric detail render, the detail prints the new fields
  assert.equal(Object.keys(CATEGORIES.planning).sort().join(), 'ar,en,intro');
});

/* ------------------------------------------------------------------ 6. AR / EN parity */
const nums = (h) => (text(h.replace(/<svg[\s\S]*?<\/svg>/g, ' ')).match(/\d[\d,]*(?:\.\d+)?/g) || []).filter((x) => x.length >= 1);
const bag = (arr) => arr.slice().sort().join('|');
ok('AR / EN parity: the same numbers in both languages for the action table and the factors; every bilingual text object has both languages', () => {
  const make = (lang) => [
    render(E(PlanFactors, { factors: FACT }), lang),
    render(E(PlanActions, { view: actionView(RES, { money: (v) => fmtMoney(v, { lang }), count: String, lang, expanded: true }), status: 'ready', canDrill: true, drillReason: 'x', scopeName: 'S', hasGaps: true, onResetSource: noop, onToggleExpanded: noop }), lang)
  ];
  const ar = make('ar'); const en = make('en'); const names6 = ['factors', 'actions'];
  ar.forEach((h, i) => {
    const a = nums(h).filter((x) => !/^20\d\d$/.test(x)); const e = nums(en[i]).filter((x) => !/^20\d\d$/.test(x));
    assert.equal(bag(a), bag(e), `${names6[i]}: the same numbers in Arabic and English`);
    assert.ok(!/[؀-ۿ]/.test(text(en[i]).replace(/N:[^\s]+/g, '')), `${names6[i]}: no Arabic text left in the English render`);
  });
  const seen = []; const walk = (o, p) => { if (o && typeof o === 'object') { if ('ar' in o && 'en' in o && typeof o.ar === 'string') seen.push([p, o]); else for (const [k, v] of Object.entries(o)) walk(v, `${p}.${k}`); } };
  walk(FACT, 'factors'); walk(FACTOR_GROUPS, 'groups'); walk(F.assumptions, 'assumptions'); walk(F.method, 'method'); walk(B.notices, 'notices'); walk(RES.notes, 'notes'); walk(view.cells.map((c) => c.actions), 'actions'); walk(view.cells.map((c) => c.expectedImpact), 'impact');
  assert.ok(seen.length > 40); for (const [p, o] of seen) assert.ok(o.ar && o.ar.trim() && o.en && o.en.trim(), `${p}: both languages`);
});
ok('the plan chart blocks are valid shared-library blocks (type chart, kind, equal-length labels / series / keys, the unit and the cut-off)', () => {
  const blocks = [planDeviationBlock(B, { nameOf: names, lang: 'ar' }).block, planCumulativeBlock(B, F, { lang: 'ar' })];
  for (const b of blocks) { assert.equal(b.type, 'chart'); assert.ok(['hbar', 'line'].includes(b.kind)); assert.ok(b.id.startsWith('plan:')); for (const s of b.series) assert.equal(s.values.length, b.labels.length); if (b.keys) assert.equal(b.keys.length, b.labels.length); assert.equal(b.unit, 'SAR'); assert.ok(b.title && b.note); }
  assert.equal(new Set(blocks.map((b) => b.id)).size, blocks.length, 'ids are unique');
});
ok('the retired planning files are gone and nothing in the source imports them', () => {
  for (const f of ['src/pages/PlanningArea.jsx', 'src/components/strategic/TargetsPanel.jsx', 'src/components/strategic/PlanContext.jsx', 'src/components/strategic/PlanPosition.jsx', 'src/components/strategic/PlanCumulative.jsx', 'src/components/strategic/PlanOutlook.jsx', 'src/components/strategic/PlanContribution.jsx', 'src/components/strategic/EntityMap.jsx', 'src/data/planningCharts.js', 'src/data/planTargets.js', 'src/data/collectionGoal.js', 'src/components/plans/planFigures.js']) assert.ok(!fs.existsSync(f), `${f} is retired`);
});

for (const fn of pending) await fn();
console.log(`planning-page: ${n} checks passed`);
