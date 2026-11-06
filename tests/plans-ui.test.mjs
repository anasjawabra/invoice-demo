// The ONE plan page («خطط الإيرادات», docs/revenue-plans-spec.md §10): the selector rows (no performance figures, default flags), the save modes and the naming rules, the save functions (validation before the request, values kept on
// failure, a stale revision = conflict), the working copy as a live preview (the saved plan unchanged), the unsaved-changes guard, the headline summary and its three percentages, no tolerance / probability / approval wording,
// the municipality view scope (authorised options only, the Amanah change clears the municipality, hidden when none, «لم يُحدد مستهدف لهذه البلدية», the reconciliation row, a restricted municipal viewer sees no Amanah total, a filter never
// writes the plan) and AR / EN parity. Server-side render of the REAL components with fixtures; synthetic data only. Run: npm run test:plansui
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.js';
import { I18nProvider } from '../src/context/I18nContext.jsx';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { approvedConfigOf, loadPlanInputsForPlan } from '../src/data/planInputs.js';
import { DEFAULT_CONFIG } from '../src/data/revenueMetrics.js';
import { planningBasisFromPlan, UNALLOCATED_MUNI_KEY } from '../src/data/plans/planBasis.js';
import { forecastPlan } from '../src/data/planForecast.js';
import { planMeasures } from '../src/data/plans/planMeasures.js';
import { maskPlanForViewer, normalizeContent } from '../src/data/plans/planRules.js';
import { viewScopeOf, resetMuniOnAmanahChange, visibleEntityKeysOfScope } from '../src/data/plans/planAccess.js';
import { normalizeGeoScope, ALL_SCOPE } from '../src/data/geoScope.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { seedPlanContent, collectionPlan2027Content, deriveRemainingPlanContent, REMAINING_PLAN_2026 } from '../src/data/plans/planDefaults.js';
import * as U from '../src/components/plans/planUi.js';
import { submitCreate, submitUpdate } from '../src/components/plans/planActions.js';
import { internalTarget } from '../src/components/plans/useUnsavedGuard.js';
import { planCumulativeBlock, planDeviationBlock, planBreakdown, planBulletRows, planBulletBlock, planTargetWords } from '../src/components/plans/planCharts.js';
import { actionView, sourceBars } from '../src/data/planningActionsView.js';
import { chartSummary } from '../src/data/reportFormat.js';
import { planFactorsFor } from '../src/components/plans/planFactors.js';
import { viewScopeFields } from '../src/components/plans/PlanViewScope.jsx';
import { PlanHeader, PlanOptions, UnsavedBar } from '../src/components/plans/PlanHeader.jsx';
import { PlanBaselineBlock, PlanSummary, PlanNotices, PlanPositionBlock, PlanForecastSection, PlanBreakdownSection, PlanCumulativeSection } from '../src/components/plans/PlanSections.jsx';
import { ConfirmDialog, SaveNameDialog } from '../src/components/plans/PlanDialogs.jsx';
import { defaultPlanId } from '../src/pages/Plans.jsx';
import { restamp } from '../src/pages/PlanDetail.jsx';
import LegacyImportNotice from '../src/components/plans/LegacyImportNotice.jsx';
import { legacyImportCandidates, canImportLegacy, runLegacyImport } from '../src/components/plans/legacyImport.js';
import { legacyRecord } from '../src/data/plans/planDefaults.js';
import { readLegacyStore, LEGACY_KEY } from '../src/data/plans/legacyStore.js';
import { legacyStoreFixture } from '../src/data/plans/planFixtures.js';
import { PlansApiError } from '../src/api/plansClient.js';
import { emptyView } from '../src/data/reportView.js';
import { PLANNING_METRICS } from '../src/data/planningMetricDocs.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const E = React.createElement;
const render = (el, lang = 'ar') => { globalThis.sessionStorage = { getItem: (k) => (k === 'ib_lang' ? lang : null), setItem() {}, removeItem() {} }; try { return renderToStaticMarkup(E(StaticRouter, { location: '/planning/p1' }, E(I18nProvider, null, el))); } finally { delete globalThis.sessionStorage; } };
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
const noop = () => {};
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

const TODAY = '2026-11-06'; const NOW = '2026-11-06T09:00:00.000Z';
const st = loadStore(TODAY); const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: TODAY });
const rev = { data: { snapshot: async (scope, o = {}) => snapshot(st, { scope, cfg: o.cfg || cfg }), series: async (scope, o = {}) => series(st, { scope, cfg: o.cfg || cfg }) } };
const RY = 'Riyadh Amanah'; const JD = 'Jeddah Amanah'; const HS = 'Housing Sector';
const J = (k) => `MREF-002-${String(k).padStart(3, '0')}`;
const jm = municipalitiesOf(JD).map((m) => m.refId);
const PERIOD = { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' };
const content = (o = {}) => normalizeContent({
  name: 'خطة اختبار', scope: { kind: 'ministry' }, period: PERIOD, target: { amount: 9_000_000_000 },
  allocations: [{ entityKey: RY, amount: 6_000_000_000, origin: 'manual' }, { entityKey: JD, amount: 3_000_000_000, origin: 'manual' }],
  municipalAllocations: [{ entityKey: JD, muniId: J(1), amount: 100_000_000, origin: 'manual' }, { entityKey: JD, muniId: J(2), amount: 400_000_000, origin: 'manual' }, { entityKey: JD, muniId: J(5), amount: 200_000_000, origin: 'manual' }],
  distribution: { profile: 'equal' }, advanced: {}, ...o
});
const plan = (o = {}) => ({ id: 'p1', name: 'خطة اختبار', isSystem: false, origin: 'user', state: 'active', content: content(), createdBy: { userId: 'u1', name: 'سارة', nameEn: 'Sara' }, createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-05-02T10:00:00Z', lastEditedBy: { userId: 'u2', name: 'ماجد', nameEn: 'Majed' }, revision: 3, versions: [], legacy: null, viewer: { canEdit: true }, ...o });
const run = async (c, { viewScope = null, entityKeys = null, working = false, p = plan() } = {}) => {
  const view = U.viewOf(p, c, { working });
  const D = await loadPlanInputsForPlan(rev, { view, reporting: TODAY, approvedCfg: cfg, entityKeys, viewScope, upcomingHistory: true });
  const basis = planningBasisFromPlan({ view, today: TODAY, latestDataDate: TODAY, entityKeys, actual: D?.actual || null, viewScope });
  const forecast = forecastPlan(basis, { history: D?.history, now: NOW });
  return { view, D, basis, forecast, measures: planMeasures(basis, forecast) };
};
const BANNED = /معتمد|معتمدة|مسودة|مؤرشف|تفعيل كأساس|الإصدار الحالي|حالة المستهدف|احتمالية تحقيق المستهدف|وفق الخطة|متقدم|متأخر|approved|draft|archived|activat|on plan|probability of reaching/i;

const R = await run(content());

/* ------------------------------------------------------------------ the selector */
await ok('selector rows: name · period · scope · owner and the default flags — NO performance figures; the personal default first, then the system plan, then by name', () => {
  const sys = plan({ id: 'sys', name: 'خطة تحصيل 2026 — توضيحية', isSystem: true, origin: 'seed', createdBy: null });
  const a = plan({ id: 'a', name: 'ب خطتي' }); const b = plan({ id: 'b', name: 'أ خطة' });
  const defaults = { userDefaultPlanId: 'a', systemDefaultPlanId: 'sys', effectiveDefaultPlanId: 'a' };
  const rows = U.selectorRows([b, sys, a], defaults);
  assert.deepEqual(rows.map((r) => r.plan.id), ['a', 'sys', 'b']); assert.ok(rows[0].flags.personal && !rows[0].flags.system && rows[1].flags.system);
  assert.deepEqual(U.selectorRows([b, sys, a], defaults, { query: 'سارة' }).length, 2, 'searchable by owner'); assert.equal(U.selectorRows([b, sys, a], defaults, { query: 'zzz' }).length, 0);
  for (const r of rows) for (const k of Object.keys(r)) assert.ok(!/target|actual|achievement|expected|measures/i.test(k), `no performance key: ${k}`);
  const ar = text(render(E(PlanOptions, { rows, total: 3, selectedId: 'a', isNew: false, onPick: noop })));
  assert.ok(ar.includes('افتراضية') && ar.includes('الخطة الافتراضية للنظام · بيانات توضيحية') && ar.includes('المالك'));
  assert.ok(!/مليار|مليون|%/.test(ar), 'no figure inside the selector'); assert.ok(!BANNED.test(ar.replace('الخطة الافتراضية للنظام · بيانات توضيحية', '')), 'no state / approval wording');
  const en = text(render(E(PlanOptions, { rows, total: 3, selectedId: 'sys', isNew: false, onPick: noop }), 'en')); assert.ok(en.includes('Default') && en.includes('The system default plan') && en.includes('Owner'));
  assert.ok(render(E(PlanOptions, { rows, selectedId: 'a', isNew: false, onPick: noop })).includes('aria-selected="true"'));
  assert.ok(text(render(E(PlanOptions, { rows: [], total: 0, isNew: false, onPick: noop }))).includes('لا توجد خطط محفوظة'));
});
await ok('/planning opens the effective default plan: the personal default, else the system plan, else the first by name; an old ?year= link goes to that year\'s reference plan', () => {
  const sys = plan({ id: 'sys', name: 'ز', isSystem: true }); const a = plan({ id: 'a', name: 'أ' });
  assert.equal(defaultPlanId({ plans: [a, sys], defaults: { effectiveDefaultPlanId: 'a' } }), 'a');
  assert.equal(defaultPlanId({ plans: [a, sys], defaults: {} }), 'sys', 'no default → the system plan');
  assert.equal(defaultPlanId({ plans: [a], defaults: { effectiveDefaultPlanId: 'gone' } }), 'a', 'a stale id falls back to the first visible plan');
  assert.equal(defaultPlanId({ plans: [], defaults: {} }), null);
  assert.equal(defaultPlanId({ plans: [a, sys], defaults: { effectiveDefaultPlanId: 'a' } }, { year: 2025, referenceOf: () => ({ state: 'ok', plan: { id: 'sys' } }) }), 'sys');
  assert.equal(defaultPlanId({ plans: [a, sys], defaults: { effectiveDefaultPlanId: 'a' } }, { year: 2025, referenceOf: () => ({ state: 'ambiguous' }) }), 'a', 'ambiguous reference → the default plan, never a silent pick');
});

/* ------------------------------------------------------------------ header · save modes · names */
await ok('header: ONLY the title and the creation date beneath it · «حفظ الخطة» primary · «تعديل الخطة» · ⋯; no owner / last editor / scope / period / status / assumption text; createdAt unchanged by an edit', () => {
  const p = plan({ createdAt: '2026-03-04T08:00:00.000Z', updatedAt: '2026-11-05T09:00:00.000Z' });
  const h = render(E(PlanHeader, { name: p.name, plan: p, isNew: false, saveGate: { mode: 'update', reason: null }, editGate: { allowed: true }, dirty: false, busy: false, canReference: true, isPersonalDefault: false, onSave: noop, onSaveAsNew: noop, onEdit: noop, onSetDefault: noop, onSetReference: noop }));
  const t = text(h);
  assert.ok(h.includes('id="plan-save"') && t.includes('حفظ الخطة') && t.includes('تعديل الخطة') && h.includes('id="plan-more"'));
  assert.ok(h.includes('id="plan-created"') && t.includes('تاريخ الإنشاء') && t.includes('4 مارس 2026'), 'the creation date (createdAt) beneath the title'); assert.ok(!t.includes('5 نوفمبر'), 'the last-modified date is not shown');
  assert.ok(!/المالك|آخر تعديل|السنة المالية|افتراض|الأمانة|البلدية|مسودة|فعّالة|مؤرشفة|الإصدار/.test(t), `nothing but title + creation date + actions: ${t}`);
  assert.ok(!/<input|<select|<p[ >]/.test(h), 'no inputs and no explanatory paragraph in the header'); assert.ok(!BANNED.test(t));
  const en = text(render(E(PlanHeader, { name: p.name, plan: p, isNew: false, saveGate: { mode: 'update' }, editGate: { allowed: true }, dirty: true, busy: false, canReference: false, isPersonalDefault: true, onSave: noop, onSaveAsNew: noop, onEdit: noop, onSetDefault: noop, onSetReference: noop }), 'en'));
  assert.ok(en.includes('Save plan') && en.includes('Edit plan') && en.includes('Created:') && !/Owner|Last edited|Unsaved/.test(en));
  const nu = text(render(E(PlanHeader, { name: '', plan: null, isNew: true, saveGate: { mode: 'create' }, editGate: { allowed: true }, onSave: noop, onSaveAsNew: noop, onEdit: noop, onSetDefault: noop, onSetReference: noop }))); assert.ok(nu.includes('خطة جديدة') && !nu.includes('تاريخ الإنشاء'), 'an unsaved plan has no creation date');
  const sys = render(E(PlanHeader, { name: 'x', plan: plan({ isSystem: true }), isNew: false, saveGate: { mode: 'create', reason: U.bi('الخطة الافتراضية للنظام لا تُعدَّل: يُحفظ تعديلك كخطة جديدة', 'x') }, editGate: { allowed: true }, dirty: false, canReference: false, onSave: noop, onSaveAsNew: noop, onEdit: noop, onSetDefault: noop, onSetReference: noop }));
  assert.ok(sys.includes('il-tip') && sys.includes('aria-label="الخطة الافتراضية للنظام لا تُعدَّل'), 'the system-plan hint is an accessible help control beside «حفظ الخطة», not a paragraph');
});
await ok('«حفظ الخطة»: a new plan, the system plan and a plan the person may not edit open the NAMING modal; an editable plan is updated in place; a read-only role cannot save (with the reason)', () => {
  assert.equal(U.saveMode(null, { isNew: true }).mode, 'create');
  assert.equal(U.saveMode(plan({ isSystem: true }), { canEdit: true }).mode, 'create'); assert.ok(U.saveMode(plan({ isSystem: true }), { canEdit: true }).reason.ar.includes('الخطة الافتراضية للنظام'));
  assert.equal(U.saveMode(plan(), { canEdit: false }).mode, 'create');
  assert.equal(U.saveMode(plan(), { canEdit: true }).mode, 'update'); assert.equal(U.saveMode(plan(), { canEdit: true }).reason, null);
  const ro = U.saveMode(plan(), { canEdit: true, readOnly: true }); assert.equal(ro.mode, 'none'); assert.ok(ro.reason.ar && ro.reason.en);
  assert.equal(U.canEditPlan(plan({ isSystem: true }), { readOnly: false }), false, 'the system plan is never edited in place'); assert.equal(U.canEditPlan(plan(), { readOnly: true }), false);
  assert.equal(U.canEditPlan(plan({ viewer: { canEdit: false } }), {}), false); assert.equal(U.canEditPlan(plan({ viewer: { canEdit: true } }), {}), true);
  const h = render(E(PlanHeader, { name: 'x', plan: plan(), isNew: false, saveGate: ro, editGate: { allowed: false, reason: U.bi('دورك للقراءة فقط', 'read-only') }, dirty: false, canReference: false, onSave: noop, onSaveAsNew: noop, onEdit: noop, onSetDefault: noop, onSetReference: noop }));
  assert.ok(/id="plan-save"[^>]*disabled/.test(h) && /id="plan-edit"[^>]*disabled/.test(h)); assert.ok(h.split('il-tip__btn').length - 1 === 2 && h.includes('aria-label="دورك للقراءة فقط ولا يسمح بحفظ الخطط') && h.includes('aria-label="دورك للقراءة فقط"'), 'both disabled actions carry a concise reason in a help control (InfoTip), not a paragraph');
});
await ok('the naming rules: trimmed, 1–80 characters, unique case-insensitively among the visible plans; the dialog has «اسم الخطة», «تعيين كخطة افتراضية لي», حفظ / إلغاء', () => {
  const plans = [plan({ id: 'a', name: 'My Plan' })];
  assert.equal(U.nameProblem('', plans).code, 'name_required'); assert.equal(U.nameProblem('   ', plans).code, 'name_required'); assert.equal(U.nameProblem('x'.repeat(81), plans).code, 'name_too_long'); assert.equal(U.nameProblem('x'.repeat(80), plans), null);
  assert.equal(U.nameProblem(' my plan ', plans).code, 'name_taken'); assert.equal(U.nameProblem('my plan', plans, 'a'), null, 'the plan being renamed may keep its name'); assert.equal(U.nameProblem('Other', plans), null);
  const h = render(E(SaveNameDialog, { content: content(), plans, defaultName: 'خطة جديدة', onClose: noop, onSaved: noop })); const t = text(h);
  assert.ok(t.includes('اسم الخطة') && t.includes('تعيين كخطة افتراضية لي') && t.includes('حفظ') && t.includes('إلغاء')); assert.ok(h.includes('role="dialog"') && h.includes('aria-modal="true"') && h.includes('data-autofocus') && h.includes('value="خطة جديدة"'));
  const en = text(render(E(SaveNameDialog, { content: content(), plans, defaultName: 'N', onClose: noop, onSaved: noop }), 'en')); assert.ok(en.includes('Plan name') && en.includes('Set as my default plan') && en.includes('Cancel'));
});

/* ------------------------------------------------------------------ the save functions */
const CTX = { geoScope: ALL_SCOPE, readOnly: false };
await ok('submitCreate: an invalid name or configuration sends NOTHING; a server failure keeps the values; success returns the plan and refreshes the list first', async () => {
  const calls = []; const api = { createPlan: async (b) => { calls.push(b); return { plan: { id: 'new1', name: b.name } }; } }; let refreshed = 0;
  const base = { api, content: content(), plans: [plan()], ctx: CTX, refresh: async () => { refreshed += 1; } };
  const bad = await submitCreate({ ...base, name: '  ' }); assert.equal(bad.ok, false); assert.equal(bad.kind, 'name'); assert.equal(calls.length, 0);
  const dup = await submitCreate({ ...base, name: 'خطة اختبار' }); assert.equal(dup.kind, 'name'); assert.equal(calls.length, 0);
  const noTarget = await submitCreate({ ...base, name: 'جديدة', content: content({ target: { amount: null }, allocations: [], municipalAllocations: undefined }) }); assert.equal(noTarget.kind, 'config'); assert.ok(noTarget.problems.length > 0 && noTarget.problems[0].ar); assert.equal(calls.length, 0);
  const unalloc = await submitCreate({ ...base, name: 'جديدة', content: content({ target: { amount: 10_000_000_000 } }) }); assert.equal(unalloc.kind, 'config', 'unallocated amounts block a save (use the explicit distribute actions)'); assert.equal(calls.length, 0);
  const fail = await submitCreate({ ...base, name: 'جديدة', api: { createPlan: async () => { const e = new Error('x'); e.code = 'name_taken'; throw e; } } }); assert.equal(fail.ok, false); assert.equal(fail.kind, 'server'); assert.ok(fail.problems[0].ar.includes('يوجد خطة بهذا الاسم')); assert.equal(refreshed, 0);
  const good = await submitCreate({ ...base, name: ' جديدة ', setDefault: true, copyOf: 'p1' }); assert.equal(good.ok, true); assert.equal(good.plan.id, 'new1'); assert.equal(refreshed, 1);
  assert.equal(calls.length, 1); assert.equal(calls[0].name, 'جديدة'); assert.equal(calls[0].content.name, 'جديدة'); assert.equal(calls[0].setDefault, true); assert.equal(calls[0].copyOf, 'p1');
});
await ok('submitUpdate: PUTs the SAME plan with its revision (no name prompt, no duplicate); a stale revision is a conflict that leaves the working copy; validation failures send nothing', async () => {
  const p = plan(); const calls = []; const api = { updatePlan: async (id, revision, c, name) => { calls.push({ id, revision, name }); return { plan: { ...p, revision: revision + 1 } }; } };
  const r = await submitUpdate({ api, plan: p, content: content({ target: { amount: 9_000_000_000 } }), ctx: CTX }); assert.ok(r.ok); assert.deepEqual(calls, [{ id: 'p1', revision: 3, name: undefined }]);
  const renamed = await submitUpdate({ api, plan: p, content: content({ name: 'اسم جديد' }), ctx: CTX }); assert.ok(renamed.ok); assert.equal(calls[1].name, 'اسم جديد');
  const bad = await submitUpdate({ api, plan: p, content: content({ target: { amount: null }, allocations: [], municipalAllocations: undefined }), ctx: CTX }); assert.equal(bad.kind, 'config'); assert.equal(calls.length, 2);
  let refreshed = 0; const conflictApi = { updatePlan: async () => { const e = new Error('c'); e.code = 'revision_conflict'; e.lastEditedBy = { userId: 'u9', name: 'نورة' }; throw e; } };
  const c = await submitUpdate({ api: conflictApi, plan: p, content: content(), ctx: CTX, refresh: async () => { refreshed += 1; } }); assert.equal(c.kind, 'conflict'); assert.equal(c.error.lastEditedBy.name, 'نورة'); assert.equal(refreshed, 1);
  const sysFail = await submitUpdate({ api: { updatePlan: async () => { const e = new Error('s'); e.code = 'system_plan_readonly'; throw e; } }, plan: p, content: content(), ctx: CTX }); assert.ok(sysFail.problems[0].ar.includes('الخطة الافتراضية للنظام لا تُعدَّل'));
});
await ok('the working copy: dirty only when the canonical content differs; the SAVED plan is not touched; the preview is computed from the working content and differs from the saved figures', async () => {
  const p = deepFreeze(plan()); const saved = p.content;
  assert.equal(U.isDirty(saved, null), false); assert.equal(U.isDirty(saved, { ...saved }), false, 'same content is not an edit'); assert.equal(U.isDirty(saved, content({ target: { amount: 9_000_000_001 } })), true);
  const edited = content({ target: { amount: 12_000_000_000 }, allocations: [{ entityKey: RY, amount: 8_000_000_000, origin: 'manual' }, { entityKey: JD, amount: 4_000_000_000, origin: 'manual' }] });
  const a = await run(saved, { p }); const b = await run(edited, { working: true, p });
  assert.equal(a.view.versionId, 'p1@r3'); assert.equal(b.view.versionId, 'p1@working'); assert.equal(b.view.working, true);
  assert.equal(a.basis.target.value, 9_000_000_000); assert.equal(b.basis.target.value, 12_000_000_000, 'the preview shows the WORKING content'); assert.ok(b.measures.plannedToDate > a.measures.plannedToDate);
  assert.equal(a.measures.actual, b.measures.actual, 'the collections are the same'); assert.equal(p.content.target.amount, 9_000_000_000, 'the stored plan is unchanged');
  // the data is re-used for the working copy under its own version id (restamp): no refetch for a target edit
  const re = restamp(a.D, b.view); const basis2 = planningBasisFromPlan({ view: b.view, today: TODAY, latestDataDate: TODAY, actual: re.actual }); assert.equal(basis2.state, 'ok'); assert.deepEqual(basis2.target, b.basis.target);
  assert.notEqual(planningBasisFromPlan({ view: b.view, today: TODAY, latestDataDate: TODAY, actual: a.D.actual }).state, 'ok', 'without restamp the input is refused (it belongs to another version)');
});
await ok('unsaved-changes guard: in-app link clicks are intercepted; the same page, new tabs, modified clicks and external links are not', () => {
  const a = (href, extra = {}) => ({ getAttribute: (k) => (k === 'href' ? href : null), hasAttribute: () => false, target: '', ...extra });
  const here = { origin: 'http://x', pathname: '/planning/p1' };
  assert.equal(internalTarget(a('/insights'), here), '/insights'); assert.equal(internalTarget(a('/planning/p2?edit=1'), here), '/planning/p2?edit=1');
  assert.equal(internalTarget(a('/planning/p1?amanah=x'), here), null, 'a filter change stays on the page'); assert.equal(internalTarget(a('#plan-targets'), here), null);
  assert.equal(internalTarget(a('https://other.com/x'), here), null); assert.equal(internalTarget(a('/insights', { target: '_blank' }), here), null); assert.equal(internalTarget(a('/insights'), here, { ctrlKey: true }), null);
  const src = fs.readFileSync('src/components/plans/useUnsavedGuard.js', 'utf8'); assert.ok(/beforeunload/.test(src) && /addEventListener\('click', click, true\)/.test(src));
  const page = fs.readFileSync('src/pages/PlanDetail.jsx', 'utf8'); assert.ok(/useUnsavedGuard\(/.test(page) && /guard\.request\(/.test(page) && /kind="leave"/.test(page), 'the page uses the guard for plan switches and shows the leave confirmation');
  const bar = text(render(E(UnsavedBar, { isNew: false, onSave: noop, onDiscard: noop }))); assert.ok(bar.includes('تغييرات غير محفوظة') && bar.includes('حفظ الخطة') && bar.includes('تجاهل') && bar.includes('معاينة حية'));
  assert.ok(text(render(E(ConfirmDialog, { kind: 'leave', onClose: noop, onLeave: noop }))).includes('تغييرات غير محفوظة'));
});

/* ------------------------------------------------------------------ the summary and the three percentages */
await ok('ONE summary: target · collected + «نسبة تحقيق المستهدف حتى تاريخه» · «نسبة الإنجاز مقابل المخطط» + the signed deviation · expected amount + «نسبة تحقيق المستهدف المتوقعة بنهاية الفترة» + the gap; no tolerance badge, no probability block', () => {
  const m = R.measures; assert.equal(R.basis.state, 'ok'); assert.equal(m.expected.state, 'ok');
  const h = render(E(PlanSummary, { measures: m, view: R.view, plan: plan() })); const t = text(h);
  for (const id of ['plan-target', 'plan-actual', 'plan-vs-plan', 'plan-expected']) assert.ok(h.includes(`id="${id}"`), id);
  assert.ok(t.includes('نسبة تحقيق المستهدف حتى تاريخه') && t.includes('نسبة الإنجاز مقابل المخطط') && t.includes('نسبة تحقيق المستهدف المتوقعة بنهاية الفترة'));
  const pc = (v) => `${(v * 100).toFixed(1)}%`; assert.ok(t.includes(pc(m.achievementToDate)) && t.includes(pc(m.vsPlanRatio)) && t.includes(pc(m.expected.pct)), 'the three percentages are the measures');
  assert.ok(/data-gap="(shortfall|surplus)"/.test(h) && (t.includes('فجوة متوقعة عن المستهدف') || t.includes('فائض متوقع فوق المستهدف')), 'the expected gap is labelled');
  assert.ok(/[+−]/.test(t), 'the deviation is signed money');
  assert.ok(h.includes('title="') && /الانحراف %/.test(h), 'the deviation % is in a tooltip only'); assert.ok(!/class="[^"]*pl-status/.test(h), 'no status badge');
  assert.ok(!/احتمال|probab|وفق الخطة|متقدم|متأخر|ahead|behind|on plan|±0\.5|tolerance/i.test(t), `no probability / tolerance wording: ${t.match(/احتمال|probab|وفق الخطة|متقدم|متأخر/)}`);
  const en = text(render(E(PlanSummary, { measures: m, view: R.view, plan: plan() }), 'en')); assert.ok(en.includes('Target achievement to date') && en.includes('Achievement against plan') && en.includes('Expected target achievement by the end of the period'));
});
await ok('the formulas: achievement = collected ÷ the FULL target (uncapped); vs-plan = collected ÷ planned to date; deviation = collected − planned; expected = forecast ÷ the full target', () => {
  const m = R.measures;
  assert.ok(Math.abs(m.achievementToDate - m.actual / m.target) < 1e-12); assert.ok(Math.abs(m.vsPlanRatio - m.actual / m.plannedToDate) < 1e-12); assert.equal(m.deviation.amount, m.actual - m.plannedToDate);
  assert.ok(Math.abs(m.expected.pct - m.expected.amount / m.target) < 1e-12); assert.ok(m.expected.pct !== m.achievementToDate && m.vsPlanRatio !== m.achievementToDate, 'three different measures');
  assert.ok(!('status' in m) && !('probability' in m) && !('tolerance' in m));
});
await ok('position block: the cut-off, planned to date with the equal-split assumption printed beside it, NO four-dates box; forecast section has no probability block, no chip subtitle, no dictionary link, no assumptions collapsible', () => {
  const p = render(E(PlanPositionBlock, { basis: R.basis, measures: R.measures })); const t = text(p);
  assert.ok(p.includes('id="plan-cutoff"')); assert.ok(/data-assumption="equal"/.test(p) && t.includes('توزيع متساوٍ — افتراض'), 'the assumption is next to the planned-to-date figure');
  assert.ok(!p.includes('id="plan-dates"') && !p.includes('<details') && !t.includes('التواريخ الأربعة') && !t.includes('آخر تاريخ بيانات فعلية') && !t.includes('وقت توليد التوقع'), 'the four-dates box is removed from the page');
  assert.ok(t.includes('تاريخ الإغلاق المستخدم في الأرقام') && t.includes('المخطط حتى تاريخه') && t.includes('المتبقي من المستهدف') && t.includes('الأيام المتبقية في الفترة'), 'the position tiles stay');
  assert.ok(R.measures.dates.reportingCutoff && R.measures.dates.latestActualDataDate && R.measures.dates.forecastGeneratedAt, 'the dates stay in the calculation result');
  const f = render(E(PlanForecastSection, { basis: R.basis, forecast: R.forecast, measures: R.measures })); const ft = text(f);
  assert.ok(f.includes('id="plan-outlook"') && f.includes('id="plan-pace"')); assert.ok(!/احتمالية تحقيق المستهدف|لا تتوفر بيانات كافية|خط أساس توضيحي — ليس تقديراً|التعريف والمنهج في القاموس|تعريف التوقع والمنهج|افتراضات هذا التوقع|runrate3_v2/.test(ft), 'the deleted forecast chips / blocks are gone');
  assert.ok(!f.includes('settings/metrics') && !f.includes('<details'), 'no dictionary link, no collapsible');
});
await ok('the page has none of the deleted blocks: no always-on context chips, no probability block; only CONDITIONAL notices (stale data · restricted scope · no target · above target)', () => {
  assert.equal(render(E(PlanNotices, { basis: { ...R.basis, notices: [], restricted: false, scopeKind: 'ministry', state: 'ok' } })), '', 'nothing when there is nothing to say');
  const stale = text(render(E(PlanNotices, { basis: { ...R.basis, notices: [{ code: 'stale_data', tone: 'warn', ar: 'بيانات غير محدّثة', en: 'stale' }, { code: 'equal_distribution', tone: 'warn', ar: 'توزيع متساوٍ — افتراض', en: 'eq' }, { code: 'calendar_assumption', tone: 'info', ar: 'سنة', en: 'cal' }] } })));
  assert.ok(stale.includes('بيانات غير محدّثة') && !stale.includes('توزيع متساوٍ') && !stale.includes('سنة'), 'only the conditional notices');
  const page = fs.readFileSync('src/pages/PlanDetail.jsx', 'utf8'); for (const gone of ['PlanContext', 'TargetsPanel', 'probDef', 'defLinks', 'planActivate', 'activationChecks', 'TabVersions']) assert.ok(!page.includes(gone), `PlanDetail no longer uses ${gone}`);
  const hdr = fs.readFileSync('src/components/plans/PlanHeader.jsx', 'utf8'); assert.ok(!/activate|archive|restore|STATE_META|مسودة|مؤرشف/i.test(hdr.replace(/draft/g, '')), 'no state controls in the header');
  assert.ok(!/معتمد|معتمدة/.test(fs.readFileSync('src/components/plans/PlanSections.jsx', 'utf8') + fs.readFileSync('src/components/plans/planFactors.js', 'utf8')), 'no approval wording in the plan sections');
});

/* ------------------------------------------------------------------ states */
await ok('states: a period that has not started, a municipality without a target, a zero target and a completed period each print their reason — never a silent 0', async () => {
  const future = await run(content({ period: { start: '2027-01-01', end: '2027-12-31', preset: 'fiscal-year' } }));
  const f = text(render(E(PlanSummary, { measures: future.measures, view: future.view, plan: plan() }))); assert.ok(f.includes('غير متاح قبل بدء الفترة') && f.includes('قادمة — تبدأ 1 يناير 2027'));
  const zero = await run(content({ target: { amount: 0 }, allocations: [], municipalAllocations: undefined })); const z = text(render(E(PlanSummary, { measures: zero.measures, view: zero.view, plan: plan() }))); assert.ok(z.includes('لا مستهدف'));
  const done = await run(content({ period: { start: '2025-01-01', end: '2025-12-31', preset: 'fiscal-year' } })); assert.equal(done.basis.state, 'completed');
  const d = text(render(E(PlanSummary, { measures: done.measures, view: done.view, plan: plan() }))); assert.ok(d.includes('النتيجة النهائية للفترة') && d.includes('نسبة التحقق النهائية'));
  const fo = text(render(E(PlanForecastSection, { basis: done.basis, forecast: done.forecast, measures: done.measures }))); assert.ok(fo.includes('انتهت الفترة') && fo.includes('لا وتيرة مطلوبة'));
});

/* ------------------------------------------------------------------ the municipality view scope */
const only = (muni) => normalizeGeoScope({ grants: [{ amanah: JD, municipalities: muni, direct: false, notSpecified: false }] });
await ok('view scope: the municipality options are ONLY the authorised ones, the default is «كل البلديات التابعة للأمانة», an Amanah change clears the municipality, and the field is hidden for an entity without municipalities', () => {
  const full = viewScopeOf({ amanah: JD, muni: 'all' }, { geoScope: ALL_SCOPE }); assert.equal(full.municipalityOptions.length, jm.length); assert.ok(full.showMunicipality);
  const part = viewScopeOf({ amanah: JD, muni: 'all' }, { geoScope: only([jm[0], jm[3]]) }); assert.deepEqual(part.municipalityOptions.map((o) => o.muniId), [jm[0], jm[3]]);
  const f = viewScopeFields({ vsc: part }); const muni = f.find((x) => x.key === 'muni');
  assert.equal(muni.options[0].value, 'all'); assert.equal(muni.options[0].label.ar, 'كل البلديات التابعة للأمانة'); assert.deepEqual(muni.options.slice(1).map((o) => o.value), [jm[0], jm[3]]); assert.equal(muni.dependsOn, 'amanah'); assert.ok(muni.searchable);
  assert.equal(f.find((x) => x.key === 'amanah').options[0].value, 'all');
  const forbidden = viewScopeOf({ amanah: JD, muni: jm[1] }, { geoScope: only([jm[0]]) }); assert.equal(forbidden.muni, 'all'); assert.equal(forbidden.invalidReason, 'municipality_not_authorised');
  assert.deepEqual(resetMuniOnAmanahChange({ amanah: JD, muni: jm[0] }, { amanah: RY, muni: jm[0] }), { amanah: RY, muni: 'all' }, 'changing the Amanah clears the municipality');
  const hs = viewScopeOf({ amanah: HS, muni: 'all' }, { geoScope: ALL_SCOPE }); assert.equal(hs.showMunicipality, false); assert.equal(viewScopeFields({ vsc: hs }).length, 1, 'the field is hidden when the entity has no municipalities');
  const all = viewScopeOf({ amanah: 'all', muni: 'all' }, { geoScope: ALL_SCOPE }); assert.equal(viewScopeFields({ vsc: all }).length, 1);
  const src = fs.readFileSync('src/components/plans/PlanViewScope.jsx', 'utf8'); assert.ok(/LocalFilterToolbar/.test(src) && /dependsOn: 'amanah'/.test(src), 'it reuses the platform dependent-filter pattern');
});
await ok('Amanah view: the breakdown lists the municipalities + «غير موزع على البلديات» and the reconciliation (Σ + unallocated = the Amanah) for the target AND the actual; a municipality with no target says «لم يُحدد مستهدف لهذه البلدية»', async () => {
  const r = await run(content({ municipalAllocations: [{ entityKey: JD, muniId: J(1), amount: 100_000_000, origin: 'manual' }, { entityKey: JD, muniId: J(2), amount: 400_000_000, origin: 'manual' }] }), { viewScope: { amanah: JD, muni: 'all' } });
  assert.equal(r.basis.rowsKind, 'municipality'); const bd = planBreakdown(r.basis, { lang: 'ar' }); assert.equal(bd.kind, 'municipality'); assert.equal(bd.rows.at(-1).key, UNALLOCATED_MUNI_KEY); assert.equal(bd.rows.at(-1).label, 'غير موزع على البلديات');
  assert.ok(bd.reconcile.target.ok && bd.reconcile.actual.ok, 'Σ municipalities + unallocated = the Amanah (target and actual)'); assert.equal(bd.reconcile.target.amanah, 3_000_000_000);
  const dev = planDeviationBlock(r.basis, { lang: 'ar' }); assert.ok(dev.available && dev.reconciles && dev.kind === 'municipality'); assert.ok(dev.block.labels.includes('غير موزع على البلديات'));
  const h = render(E(PlanBreakdownSection, { basis: r.basis, dev, bd, view: emptyView(), onViewChange: noop, onPickRow: noop })); const t = text(h);
  assert.ok(h.includes('id="plan-reconcile"') && t.includes('غير موزع على البلديات') && t.includes('التسوية') && t.includes('المساهمة في الفجوة حسب البلدية')); assert.ok(/pln-unalloc/.test(h));
  const noTarget = bd.rows.find((x) => x.rowKind === 'municipality' && x.noTarget); if (noTarget) assert.ok(t.includes('لم يُحدد مستهدف لهذه البلدية'));
  assert.ok(planFactorsFor({ basis: r.basis, forecast: r.forecast, inputs: r.D }).facts.length > 0);
});
await ok('one municipality WITHOUT a target: «لم يُحدد مستهدف لهذه البلدية», actual shown, every target-dependent figure «غير متاح» — never 0, never the Amanah target; the summary and the position block say so', async () => {
  const r = await run(content(), { viewScope: { amanah: JD, muni: J(6) } }); assert.equal(r.basis.state, 'no_municipal_target');
  const h = render(E(PlanSummary, { measures: r.measures, view: r.view, plan: plan() })); const t = text(h);
  assert.ok(t.includes('لم يُحدد مستهدف لهذه البلدية')); assert.equal(r.measures.target, null); assert.equal(r.measures.achievementToDate, null); assert.equal(r.measures.deviation.amount, null);
  assert.ok(Number.isFinite(r.measures.actual), 'the actual collections still show'); assert.ok(!/(^|\s)0\s*%/.test(t) && !t.includes('0.0%'), 'never a 0 percentage');
  const pos = text(render(E(PlanPositionBlock, { basis: r.basis, measures: r.measures }))); assert.ok(pos.includes('لم يُحدد مستهدف لهذه البلدية'));
  const pace = text(render(E(PlanForecastSection, { basis: r.basis, forecast: r.forecast, measures: r.measures }))); assert.ok(pace.includes('لم يُحدد مستهدف لهذه البلدية'));
  const notices = text(render(E(PlanNotices, { basis: r.basis }))); assert.ok(notices.includes('لم يُحدد مستهدف لهذه البلدية'));
  const withT = await run(content(), { viewScope: { amanah: JD, muni: J(2) } }); assert.equal(withT.basis.state, 'ok'); assert.equal(withT.measures.target, 400_000_000, 'a municipality WITH an allocation shows its own target');
});
await ok('a restricted MUNICIPAL-ONLY viewer sees no Amanah total anywhere (summary, row cells, selector, tooltips) — only «إجمالي الجهات المتاحة لك»; the editing controls are disabled with the reason', async () => {
  const geo = only([J(1), J(2)]); const vis = visibleEntityKeysOfScope(geo);
  const masked = maskPlanForViewer(plan(), vis, geo); assert.ok(masked.masked && masked.municipalOnlyEntityKeys.includes(JD));
  assert.equal(masked.content.target.amount, 500_000_000, 'their target = Σ of their municipal allocations'); assert.equal(masked.content.target.label.ar, 'إجمالي الجهات المتاحة لك');
  const dump = JSON.stringify(masked.content); assert.ok(!dump.includes('3000000000') && !dump.includes('9000000000'), 'the Amanah total is not in the payload');
  const r = await run(masked.content, { viewScope: { amanah: JD, muni: 'all' }, entityKeys: vis, p: masked });
  const sum = render(E(PlanSummary, { measures: r.measures, view: r.view, plan: masked })); const t = text(sum);
  assert.ok(t.includes('إجمالي الجهات المتاحة لك')); assert.ok(!t.includes('3 مليار') && !t.includes('3.0 مليار') && !/3,000,000,000/.test(sum), 'no Amanah total in the summary or its tooltips');
  assert.equal(r.basis.municipal.targetHidden, true); assert.equal(r.measures.target, 500_000_000);
  const bd = planBreakdown(r.basis, { lang: 'ar' }); assert.equal(bd.reconcile, null, 'no reconciliation (it would reveal the Amanah total)');
  const rows = U.selectorRows([masked], { effectiveDefaultPlanId: 'p1' }); const sel = text(render(E(PlanOptions, { rows, total: 1, selectedId: 'p1', onPick: noop }))); assert.ok(!/مليار|3,000/.test(sel));
  assert.equal(masked.content.target.masked, true, 'a masked plan states that its target is only the visible Σ'); assert.ok(r.basis.municipal.unallocated === null && r.basis.municipal.excess === null && r.basis.municipal.amanahTarget === null, 'no unallocated / excess / Amanah total is derivable from a masked plan');
  assert.equal(U.canEditPlan(masked, { geoScope: geo }), false);
  const page = fs.readFileSync('src/pages/PlanDetail.jsx', 'utf8'); assert.ok(/masked \? \{ allowed: false/.test(page) && /لا يغطي كل جهات هذه الخطة/.test(page), 'editing is disabled with the reason for a masked plan');
});
await ok('the view-scope filter never writes the plan: the saved plan and its content are byte-identical after any number of scope changes', async () => {
  const p = deepFreeze(plan()); const before = JSON.stringify(p);
  for (const vs of [{ amanah: JD, muni: 'all' }, { amanah: JD, muni: J(1) }, { amanah: RY, muni: 'all' }, null]) await run(p.content, { viewScope: vs, p });
  assert.equal(JSON.stringify(p), before);
  const page = fs.readFileSync('src/pages/PlanDetail.jsx', 'utf8'); assert.ok(!/updatePlan\(.*viewScope|createPlan\(.*viewScope/.test(page));
});

/* ------------------------------------------------------------------ charts · reconciliation · AR/EN · dictionary */
await ok('cumulative chart: the plan\'s own months, the target as a REFERENCE line, the forecast as its own dashed series after the cut-off (never mixed with the actual)', () => {
  const b = planCumulativeBlock(R.basis, R.forecast, { lang: 'ar' }); assert.equal(b.labels.length, 12); const kinds = b.series.map((s) => s.kind);
  assert.deepEqual(kinds, ['actual', 'planned', 'planned_to_date', 'target', 'forecast']); assert.ok(b.series.find((s) => s.kind === 'target').values.every((v) => v === R.basis.target.value));
  const act = b.series[0].values; const ci = R.basis.months.findIndex((m) => m.cutoffMonth); assert.ok(act.slice(ci + 1).every((v) => v === null), 'no actual after the cut-off'); assert.ok(b.series.at(-1).dashed);
  const range = planCumulativeBlock({ ...R.basis, months: R.basis.months.slice(0, 5), cumulative: R.basis.cumulative }, null, { lang: 'en' }); assert.equal(range.labels.length, 5, 'a date-range plan is not forced to 12 months');
  const html = render(E(PlanCumulativeSection, { basis: R.basis, chart: b, view: emptyView(), onViewChange: noop })); assert.ok(html.includes('id="plan-cumulative"'));
  const dev = planDeviationBlock(R.basis, { lang: 'ar', nameOf: (k) => k, topN: 1 }); assert.ok(dev.available && dev.reconciles && Math.abs(dev.sum - R.basis.deviation.amount) <= 1);
});
await ok('AR / EN parity of the plan UI strings and no retired / removed terms in the new files', () => {
  const files = ['src/components/plans/planUi.js', 'src/components/plans/PlanHeader.jsx', 'src/components/plans/PlanSections.jsx', 'src/components/plans/PlanDialogs.jsx', 'src/components/plans/PlanViewScope.jsx', 'src/components/plans/planCharts.js', 'src/components/plans/planFactors.js', 'src/pages/PlanDetail.jsx', 'src/pages/Plans.jsx'];
  for (const f of files) { const s = fs.readFileSync(f, 'utf8'); assert.ok(!/المقبوضات|مقبوض|Najiz|Makeen|Incorta/.test(s), `${f}: no retired term`); assert.ok(!/(API|api)[_-]?key|password|token/i.test(s.replace(/localDemo|tokens?\b/g, '')) || /useUnsavedGuard/.test(f), `${f}: no secret handling`); }
  const L = (s) => [...s.matchAll(/L\('([^']*)',\s*'([^']*)'\)/g)]; for (const f of files) for (const m of L(fs.readFileSync(f, 'utf8'))) assert.ok(m[1].trim() && m[2].trim(), `${f}: both languages for ${m[1].slice(0, 30)}`);
  for (const k of ['حفظ الخطة', 'خطة جديدة', 'تغييرات غير محفوظة', 'اسم الخطة', 'تعيين كخطة افتراضية لي', 'حفظ كخطة جديدة', 'تعيين كافتراضية', 'تعيين كخطة مرجعية للتقارير', 'الخطة الافتراضية للنظام · بيانات توضيحية', 'خطط الإيرادات']) assert.ok(files.some((f) => fs.readFileSync(f, 'utf8').includes(k)), `AR string present: ${k}`);
  for (const k of ['Save plan', 'New plan', 'Unsaved changes', 'Plan name', 'Set as my default plan', 'Save as a new plan', 'Set as the reference plan for reports', 'Revenue plans']) assert.ok(files.some((f) => fs.readFileSync(f, 'utf8').includes(k)), `EN string present: ${k}`);
});
await ok('the dictionary documents the plan concepts, the three percentages, the signed deviation, the dates and the equal-distribution assumption — without tolerance, approval or probability-as-a-feature wording', () => {
  const keys = PLANNING_METRICS.map((m) => m.key);
  for (const k of ['planAchievement', 'planVsPlan', 'planDeviation', 'forecastAchievement', 'planConcepts', 'planDates', 'forecastAlignment', 'equalDistribution']) assert.ok(keys.includes(k), `dictionary entry ${k}`);
  const all = JSON.stringify(PLANNING_METRICS);
  assert.ok(!/0\.005|±0\.5|tolerance|هامش «وفق الخطة»|on plan/i.test(all), 'no tolerance text'); assert.ok(/not estimated|غير مقدَّرة/.test(all), 'the probability limitation stays in the dictionary');
  for (const m of PLANNING_METRICS) for (const f of ['label', 'brief', 'definition', 'formula', 'unit', 'level', 'period', 'dateBasis', 'sourceFields', 'missing', 'owner']) assert.ok(m[f]?.ar?.trim() && m[f]?.en?.trim(), `${m.key}.${f} in both languages`);
  const pa = PLANNING_METRICS.find((m) => m.key === 'planAchievement'); assert.ok(pa.label.ar === 'نسبة تحقيق المستهدف حتى تاريخه' && /full-period target|الفترة كاملة/.test(JSON.stringify(pa.definition)));
  assert.equal(PLANNING_METRICS.find((m) => m.key === 'forecastAchievement').label.ar, 'نسبة تحقيق المستهدف المتوقعة بنهاية الفترة'); assert.equal(PLANNING_METRICS.find((m) => m.key === 'planVsPlan').label.ar, 'نسبة الإنجاز مقابل المخطط');
});

/* ------------------------------------------------------------------ the legacy import notice */
await ok('legacy import: a notice appears only when this browser holds a saved record for a year, no shared plan was imported from THAT record, and the person may import; it is dismissible, never writes the browser value', () => {
  const store = legacyStoreFixture({ year: 2026, coverage: 0.7, meta: { version: 3, versionId: '2026-v3', status: 'approved', owner: 'x', savedAt: '2026-03-04T10:00:00Z', savedBy: 'y' } });
  const raw = JSON.stringify(store); const mem = { [LEGACY_KEY]: raw }; const writes = [];
  const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k) => writes.push(['set', k]), removeItem: (k) => writes.push(['remove', k]) };
  const caps = { canCreateMinistry: true, readOnly: false };
  const rec = legacyRecord(readLegacyStore(storage), 2026);
  // candidates: the saved year, until a plan carries the same version id + saved-at + year
  assert.deepEqual(legacyImportCandidates(readLegacyStore(storage), []).map((c) => c.year), [2026]);
  assert.deepEqual(legacyImportCandidates(readLegacyStore(storage), [plan({ legacy: rec })]), [], 'imported already: the notice goes away');
  assert.equal(legacyImportCandidates(readLegacyStore(storage), [plan({ legacy: { ...rec, savedAt: '2026-04-01T00:00:00Z' } })]).length, 1, 'a plan imported from an EARLIER version of the record does not hide a newer one');
  assert.deepEqual(legacyImportCandidates(readLegacyStore({ getItem: () => null }), []), [], 'an empty browser: nothing'); assert.deepEqual(legacyImportCandidates(readLegacyStore({ getItem: () => 'junk' }), []), []);
  // who sees it
  assert.equal(canImportLegacy(caps), true); assert.equal(canImportLegacy({ canCreateMinistry: true, readOnly: true }), false); assert.equal(canImportLegacy({ canCreateMinistry: false, readOnly: false }), false); assert.equal(canImportLegacy(undefined), false);
  const html = (c, plans = []) => render(E(LegacyImportNotice, { plans, capabilities: c, storage }));
  const ar = text(html(caps)); assert.ok(ar.includes('لديك مستهدف محفوظ على هذا الجهاز (2026) — يمكن استيراده كخطة جديدة') && ar.includes('استيراد كخطة') && ar.includes('إخفاء') && ar.includes('لا يُحذف المستهدف المحفوظ على هذا الجهاز'), ar);
  const en = text(render(E(LegacyImportNotice, { plans: [], capabilities: caps, storage }), 'en')); assert.ok(en.includes('You have a target saved on this device (2026)') && en.includes('Import as a plan') && en.includes('Dismiss'));
  assert.equal(html({ canCreateMinistry: true, readOnly: true }), '', 'a read-only role sees no import offer'); assert.equal(html({ canCreateMinistry: false }), '', 'nor a restricted viewer (the import is a Ministry-scope plan)');
  assert.equal(html(caps, [plan({ legacy: rec })]), '', 'already imported: nothing is rendered');
  // reading never writes: the browser value is preserved byte-for-byte
  assert.deepEqual(writes, []); assert.equal(mem[LEGACY_KEY], raw);
  assert.ok(!/IMPORT-|text-danger/.test(ar));
});
await ok('legacy import: «استيراد كخطة» calls importLegacyPlan(year, store) once, refreshes the plans, reports the new plan; a 409 / 422 / 400 / 403 is shown plainly; the browser value is never deleted or modified', async () => {
  const store = readLegacyStore({ getItem: () => JSON.stringify(legacyStoreFixture({ year: 2026, coverage: 0.7 })) }); const before = JSON.stringify(store);
  const record = legacyRecord(store, 2026); const calls = []; let refreshed = 0;
  const refresh = async () => { refreshed += 1; };
  const ok1 = await runLegacyImport({ year: 2026, store, record, plans: [], importer: async (y, st) => { calls.push([y, st]); return { plan: { id: 'plan-imp00001', name: 'خطة 2026 — مستوردة من هذا الجهاز (2026-default)', origin: 'imported', createdBy: null, legacy: record } }; }, refresh });
  assert.equal(ok1.kind, 'ok'); assert.equal(calls.length, 1); assert.equal(calls[0][0], 2026); assert.equal(calls[0][1], store, 'the record read from the browser is what is sent'); assert.equal(refreshed, 1, 'the plan list is refreshed so the plan appears in the selector'); assert.equal(ok1.plan.origin, 'imported'); assert.equal(ok1.plan.createdBy, null, 'ownerless');
  assert.equal(JSON.stringify(store), before, 'the store object was not modified');
  // 409: already imported → the existing plan is named, the list refreshed
  const dup = await runLegacyImport({ year: 2026, store, record, plans: [], importer: async () => { throw new PlansApiError(409, { error: 'legacy_already_imported', plan: { planId: 'plan-imp00001', name: 'مستوردة' } }); }, refresh });
  assert.deepEqual([dup.kind, dup.plan], ['already', { id: 'plan-imp00001', name: 'مستوردة' }]); assert.equal(refreshed, 2);
  // 422: the save checks failed → each failed rule is a plain message
  const chk = await runLegacyImport({ year: 2026, store, record, plans: [], importer: async () => { throw new PlansApiError(422, { error: 'save_checks_failed', checks: [{ id: 'allocation_complete', ok: false, label: { ar: 'التخصيص يساوي المستهدف إلى الريال', en: 'The allocation equals the target to the riyal' } }, { id: 'target_positive', ok: true, label: { ar: 'x', en: 'x' } }] }); }, refresh });
  assert.equal(chk.kind, 'failed'); assert.deepEqual(chk.problems.map((p) => p.en), ['The allocation equals the target to the riyal']);
  // 400 validation, 403 and a network failure are plain too
  const v400 = await runLegacyImport({ year: 2026, store, record, plans: [], importer: async () => { throw new PlansApiError(400, { error: 'validation_error', errors: [{ code: 'store_required', ar: 'سجل الجهاز القديم مطلوب', en: 'The legacy device record is required' }] }); }, refresh });
  assert.deepEqual(v400.problems.map((p) => p.ar), ['سجل الجهاز القديم مطلوب']);
  const f403 = await runLegacyImport({ year: 2026, store, record, plans: [], importer: async () => { throw new PlansApiError(403, { error: 'read_only_role' }); }, refresh }); assert.equal(f403.kind, 'failed'); assert.ok(f403.problems[0].ar.includes('للقراءة فقط'));
  const net = await runLegacyImport({ year: 2026, store, record, plans: [], importer: async () => { throw new PlansApiError(0, {}, 'network'); }, refresh }); assert.ok(net.problems[0].en.includes('Could not reach'));
  assert.equal(refreshed, 2, 'a refused import does not pretend the list changed');
  // the page mounts the notice, and nothing in the notice writes the legacy key
  assert.ok(fs.readFileSync('src/pages/PlanDetail.jsx', 'utf8').includes('<LegacyImportNotice plans={snap.plans} capabilities={snap.capabilities} />'));
  const src = fs.readFileSync('src/components/plans/LegacyImportNotice.jsx', 'utf8') + fs.readFileSync('src/components/plans/legacyImport.js', 'utf8') + fs.readFileSync('src/data/plans/legacyStore.js', 'utf8');
  assert.ok(!/setItem|removeItem|localStorage\.clear/.test(src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'no write / delete of the browser value anywhere in the import path');
});

/* ------------------------------------------------------------------ «خطة تحصيل 2027»: the GLOBAL default plan, the UPCOMING state, 2027 throughout (agent G) */
const SYS27 = () => { const c = collectionPlan2027Content({ at: '2026-11-06T09:00:00.000Z' }); return plan({ id: 'plan-2027c0de', name: c.name, nameEn: '2027 Collection Plan', seedKey: 'collection-plan-2027', isSystem: true, origin: 'seed', createdBy: null, content: c }); };
await ok('2027 plan, UPCOMING (the demo date is before 1 Jan 2027): «قادمة — تبدأ 1 يناير 2027», illustrative note, the target + allocation shown, and NO actual / planned-to-date / achievement / deviation / expected / pace / forecast — «غير متاح قبل بدء الفترة», never 0, never 2026 data', async () => {
  const p27 = SYS27(); const r = await run(p27.content, { p: p27 });
  assert.equal(r.basis.state, 'future_period'); assert.equal(r.view.isSystem, true); assert.equal(r.view.nameEn, '2027 Collection Plan');
  for (const [lang, up, na] of [['ar', 'قادمة — تبدأ 1 يناير 2027', 'غير متاح قبل بدء الفترة'], ['en', 'Upcoming — starts 1 Jan 2027', 'Not available before the period starts']]) {
    const sum = text(render(E(PlanSummary, { measures: r.measures, view: r.view, plan: p27, basis: r.basis }), lang)); assert.ok(sum.includes(up), `${lang}: ${sum}`); assert.equal((sum.match(new RegExp(na, 'g')) || []).length, 0, `${lang}: NO repeated «not available» cards — the one status line carries it`);
    assert.ok(/21[.,]59/.test(sum), 'the target is shown'); assert.ok(!/Collected to|المحصّل حتى|Target achievement to date|نسبة تحقيق المستهدف حتى تاريخه|Expected target achievement|الانحراف الكلي/.test(sum), `${lang}: no actual / achievement / expected wording`);
    assert.ok(lang === 'ar' ? sum.includes('ميزانية 2027 توضيحية = ميزانية 2026 المبلغة لحين وصول ميزانية 2027؛ التغطية 66% افتراضية') && sum.includes('خطة النظام · بيانات توضيحية') && !sum.includes('الخطة الافتراضية للنظام') : /illustrative/i.test(sum) && sum.includes('System plan') && !sum.includes('system default plan'), `${lang}: labelled illustrative`);
    assert.ok(!BANNED.test(sum.replace('The system default plan', '')), `${lang}: no approval / state wording`);
    assert.equal(text(render(E(PlanPositionBlock, { basis: r.basis, measures: r.measures }), lang)).trim(), '', `${lang}: no position card before the period starts (folded into the summary's status line)`);
    const fo = text(render(E(PlanForecastSection, { basis: r.basis, forecast: r.forecast, measures: r.measures }), lang)); assert.ok(!/Expected by the end|المتوقع بنهاية الفترة|Forecast —|التوقع —/.test(fo) && (lang === 'ar' ? fo.includes('المطلوبة شهرياً') && fo.includes('أبعد من 31 يوماً') : fo.includes('Required per month') && fo.includes('beyond the 31 days')), `${lang}: the 2027 forecast is unsupported with ONE explanation; the required pace (target ÷ days) still shows: ${fo.slice(0, 400)}`);
    const bd = planBreakdown(r.basis, { lang }); const br = text(render(E(PlanBreakdownSection, { basis: r.basis, dev: planDeviationBlock(r.basis, { lang }), bd, view: emptyView(), onViewChange: noop }), lang)); assert.ok(!/Deviation|الانحراف|Planned to date|المخطط حتى تاريخه|Collected|المحصّل<|نسبة الإنجاز/.test(br.replace(na, '').replace('المحصّل والانحراف', '').replace('collected and deviation', '')), `${lang}: the allocation table has no actual columns: ${br.slice(0, 300)}`);
    assert.ok(/4[.,]04/.test(br) && /%/.test(br), `${lang}: the allocation (target and share) is shown`);
  }
  assert.equal(r.measures.actual, null); assert.equal(r.measures.plannedToDate, null); assert.equal(r.measures.achievementToDate, null); assert.equal(r.measures.deviation.amount, null); assert.equal(r.measures.expected.amount, null); assert.equal(r.measures.calculable, false);
  assert.equal(r.basis.months.length, 12); assert.ok(r.basis.months.every((m) => m.ym.startsWith('2027-') && m.actual === null && m.actualCum === null), 'twelve 2027 months, none with an actual (never 0)');
  assert.equal(r.basis.months.at(-1).plannedCum, p27.content.target.amount, 'the plan line ends at the target');
});
await ok('2027 cumulative chart: the PLAN line + the target only; the axis is Jan–Dec 2027 (the year is named); no actual series, no planned-to-date point, no forecast; no month before / after 2027', async () => {
  const p27 = SYS27(); const r = await run(p27.content, { p: p27 });
  for (const lang of ['ar', 'en']) {
    const b = planCumulativeBlock(r.basis, r.forecast, { lang }); assert.ok(b); assert.deepEqual(b.series.map((x) => x.kind), ['planned', 'target']);
    assert.equal(b.labels.length, 12); assert.ok(b.labels.every((l) => /2027/.test(l)), `${lang}: ${b.labels.join(' | ')}`); assert.ok(!b.labels.some((l) => /2026|2028/.test(l)));
    assert.ok(b.series.every((x) => x.values.every((v) => typeof v === 'number')), 'no empty (zero-looking) point'); assert.deepEqual([b.period.from, b.period.to], ['2027-01-01', '2027-12-31']);
    assert.ok(!/actual|forecast|الفعلي|توقع/i.test(b.series.map((x) => x.label).join('|')), `${lang}: no actual / forecast series label`);
  }
  const sec = text(render(E(PlanCumulativeSection, { basis: r.basis, chart: planCumulativeBlock(r.basis, r.forecast, { lang: 'ar' }), view: emptyView(), onViewChange: noop }))); assert.ok(sec.includes('لا فعلي قبل بدء الفترة') && sec.includes('المخطط التراكمي للفترة'));
});
await ok('the SAME 2027 plan once the period is running (demo date 2027-03-15): the calculation leaves «future_period» and shows an actual state — the data service has NO 2027 receipts, so there is no actual (never 2026\'s), labelled honestly', async () => {
  const p27 = SYS27(); const c = p27.content; const view = U.viewOf(p27, c, {});
  const basis = planningBasisFromPlan({ view, today: '2027-03-15', latestDataDate: '2027-03-15', entityKeys: null, actual: null, viewScope: null });
  assert.notEqual(basis.state, 'future_period'); assert.equal(basis.state, 'no_data'); assert.equal(basis.actualToDate, null, 'no 2026 collection is presented as a 2027 actual'); assert.equal(basis.plannedToDate > 0, true, 'the planned-to-date now exists (2.5 months of the equal profile)');
  const m = planMeasures(basis, null); assert.equal(m.actual, null); assert.equal(m.achievementToDate, null);
  const sum = text(render(E(PlanSummary, { measures: m, view, plan: p27 }))); assert.ok(!sum.includes('قادمة') && !sum.includes('غير متاح قبل بدء الفترة'), 'no «upcoming» label once the period has started');
  // the period start day itself is in-period (not upcoming)
  assert.notEqual(planningBasisFromPlan({ view, today: '2027-01-01', latestDataDate: '2027-01-01', entityKeys: null, actual: null, viewScope: null }).state, 'future_period');
  assert.equal(planningBasisFromPlan({ view, today: '2026-12-31', latestDataDate: '2026-12-31', entityKeys: null, actual: null, viewScope: null }).state, 'future_period');
  // the real data service holds nothing dated 2027: loading the 2027 period returns no 2027 collections
  const D = await loadPlanInputsForPlan({ data: rev.data }, { view, reporting: '2027-03-15', approvedCfg: approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: '2027-03-15' }), entityKeys: null, viewScope: null });
  const tot = (D?.actual?.monthly || []).reduce((t, x) => t + (Number(x) || 0), 0); assert.ok(tot === 0 || D?.actual == null, `no 2027 receipts exist (got ${tot})`);
});
await ok('names by language: a system plan shows nameEn in English and its Arabic name in Arabic; a saved plan keeps its single name; the selector searches both names', () => {
  const p27 = SYS27(); const mine = plan({ id: 'm1', name: 'خطتي' });
  assert.equal(U.displayName(p27, 'ar'), 'خطة تحصيل 2027'); assert.equal(U.displayName(p27, 'en'), '2027 Collection Plan'); assert.equal(U.displayName(mine, 'en'), 'خطتي'); assert.equal(U.displayName(null, 'en'), '');
  const defaults = { userDefaultPlanId: null, globalDefaultPlanId: p27.id, systemDefaultPlanId: p27.id, effectiveDefaultPlanId: p27.id, source: 'global' };
  assert.equal(U.selectorRows([mine, p27], defaults, { lang: 'en' })[0].name, '2027 Collection Plan'); assert.equal(U.selectorRows([mine, p27], defaults, { query: '2027 collection' }).length, 1, 'the English name is searchable in Arabic mode'); assert.equal(U.selectorRows([mine, p27], defaults, { query: 'تحصيل' }).length, 1);
  const ar = text(render(E(PlanOptions, { rows: U.selectorRows([mine, p27], defaults), total: 2, selectedId: p27.id, isNew: false, onPick: noop, today: '2026-11-06' }))); const en = text(render(E(PlanOptions, { rows: U.selectorRows([mine, p27], defaults, { lang: 'en' }), total: 2, selectedId: p27.id, isNew: false, onPick: noop, today: '2026-11-06' }), 'en'));
  assert.ok(ar.includes('خطة تحصيل 2027') && ar.includes('قادمة — تبدأ 1 يناير 2027') && ar.includes('الخطة الافتراضية للنظام · بيانات توضيحية'), ar); assert.ok(en.includes('2027 Collection Plan') && en.includes('Upcoming — starts 1 Jan 2027') && en.includes('The system default plan'), en);
  const inPeriod = text(render(E(PlanOptions, { rows: U.selectorRows([p27], defaults), total: 1, selectedId: p27.id, isNew: false, onPick: noop, today: '2027-03-15' }))); assert.ok(!inPeriod.includes('قادمة'), 'no upcoming chip once the period started');
});
await ok('selector markers: the GLOBAL default plan carries «الخطة الافتراضية للنظام · بيانات توضيحية», the other system plan (2026) «خطة النظام · بيانات توضيحية», the caller\'s personal default «افتراضية»; when personal and global COINCIDE only one indicator shows', () => {
  const g = SYS27(); const old = plan({ id: 'plan-5eed2026', name: 'خطة تحصيل 2026 — توضيحية', isSystem: true, origin: 'seed', createdBy: null }); const mine = plan({ id: 'm1', name: 'خطتي' });
  const chips = (rows) => Object.fromEntries(rows.map((r) => [r.plan.id, Object.entries(r.flags).filter(([k, v]) => v && ['personal', 'global', 'illustrative'].includes(k)).map(([k]) => k)]));
  assert.deepEqual(chips(U.selectorRows([mine, old, g], { userDefaultPlanId: 'm1', globalDefaultPlanId: g.id, systemDefaultPlanId: g.id, effectiveDefaultPlanId: 'm1' })), { m1: ['personal'], 'plan-5eed2026': ['illustrative'], [g.id]: ['global'] });
  assert.deepEqual(chips(U.selectorRows([mine, old, g], { userDefaultPlanId: g.id, globalDefaultPlanId: g.id, systemDefaultPlanId: g.id, effectiveDefaultPlanId: g.id }))[g.id], ['global'], 'one indicator when they coincide');
  const html = text(render(E(PlanOptions, { rows: U.selectorRows([mine, old, g], { userDefaultPlanId: 'm1', globalDefaultPlanId: g.id, effectiveDefaultPlanId: 'm1' }), total: 3, selectedId: 'm1', isNew: false, onPick: noop, today: '2026-11-06' }))); assert.ok(html.includes('خطة النظام · بيانات توضيحية') && html.includes('افتراضية'));
  assert.deepEqual(U.selectorRows([mine, old, g], { userDefaultPlanId: 'm1', globalDefaultPlanId: g.id, effectiveDefaultPlanId: 'm1' }).map((r) => r.plan.id), ['m1', g.id, 'plan-5eed2026', ], 'personal, global, other system plans');
});
await ok('the ⋯ menu offers «تعيين كخطة افتراضية للنظام» only with canSystemDefault (administrators); the page passes the reference authority; the dialog calls setSystemDefault and says it grants no new permission', () => {
  const hdr = fs.readFileSync('src/components/plans/PlanHeader.jsx', 'utf8'); assert.ok(/canSystemDefault \? \[\{ id: 'sysdefault'/.test(hdr), 'the item is built only when canSystemDefault'); assert.ok(hdr.includes('تعيين كخطة افتراضية للنظام') && hdr.includes('Set as the system default plan'));
  const page = fs.readFileSync('src/pages/PlanDetail.jsx', 'utf8'); assert.ok(/canSystemDefault=\{canSystemDefault && !isNew\}/.test(page) && /capabilities\?\.canSetSystemDefault/.test(page));
  const dlg = fs.readFileSync('src/components/plans/PlanDialogs.jsx', 'utf8'); assert.ok(dlg.includes('c.setSystemDefault(plan.id)') && dlg.includes('لا يمنح ذلك أي صلاحية جديدة') && dlg.includes('grants no new permission'));
  const h = render(E(PlanHeader, { name: 'x', plan: plan(), isNew: false, saveGate: { mode: 'update' }, editGate: { allowed: true }, dirty: false, busy: false, canReference: false, canSystemDefault: false, isPersonalDefault: false, onSave: noop, onSaveAsNew: noop, onEdit: noop, onSetDefault: noop, onSetReference: noop, onSetSystemDefault: noop }));
  assert.ok(!h.includes('sysdefault')); const t = text(h); assert.ok(!/المالك|آخر تعديل|الأمانة|بيانات توضيحية/.test(t), 'the header stays minimal: title + creation date + the existing buttons');
});
await ok('REDIRECT RULE: /planning follows the server\'s effective default only — nothing remembered in the browser (no last-viewed plan, no localStorage / sessionStorage) can override it; an explicit /planning/:planId link keeps its plan; every entry re-reads the plans', () => {
  const g = SYS27(); const mine = plan({ id: 'm1', name: 'خطتي' });
  const snap = { plans: [mine, g], defaults: { userDefaultPlanId: null, globalDefaultPlanId: g.id, systemDefaultPlanId: g.id, effectiveDefaultPlanId: g.id, source: 'global' } };
  const kept = { getItem: () => 'm1', setItem() {}, removeItem() {}, length: 1, key: () => 'last_plan' }; globalThis.localStorage = kept; globalThis.sessionStorage = kept;
  try { assert.equal(defaultPlanId(snap), g.id, 'a remembered plan id in the browser does not override'); assert.equal(defaultPlanId({ ...snap, defaults: { ...snap.defaults, userDefaultPlanId: 'm1', effectiveDefaultPlanId: 'm1', source: 'personal' } }), 'm1', 'only the EXPLICIT personal default (server-side) does'); } finally { delete globalThis.localStorage; delete globalThis.sessionStorage; }
  assert.equal(defaultPlanId({ plans: [mine], defaults: { effectiveDefaultPlanId: g.id, globalDefaultPlanId: g.id } }), 'm1', 'a default that is not visible to this viewer falls back to a visible plan');
  const strip = (f) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const f of ['src/pages/Plans.jsx', 'src/pages/PlanDetail.jsx', 'src/data/plans/planStore.js', 'src/data/plans/usePlans.js', 'src/components/plans/PlanHeader.jsx', 'src/components/plans/planUi.js']) assert.ok(!/localStorage|sessionStorage|lastPlan|last_plan|lastViewed/i.test(strip(f)), `${f} keeps no browser-local plan preference`);
  const pg = strip('src/pages/Plans.jsx'); assert.ok(/refreshPlans\(\)/.test(pg) && /!fresh/.test(pg), 'every entry re-reads the plans before it redirects');
  assert.ok(/to: '\/planning'/.test(fs.readFileSync('src/data/accessModel.js', 'utf8')), 'the navigation entry is the bare /planning'); assert.ok(!/planning\/plan-|planning\/\$\{/.test(strip('src/components/Layout.jsx') + strip('src/data/accessModel.js')), 'no menu link names a plan id');
});

/* ------------------------------------------------------------------ the REMAINING-2026 plan (derived, frozen baseline, 7 Nov – 31 Dec 2026) */
const REM = async () => {
  const annualC = seedPlanContent(2026, { at: NOW }); const annualP = plan({ id: 'plan-5eed2026', name: annualC.name, isSystem: true, origin: 'seed', createdBy: null, content: annualC, revision: 1 });
  const D = await loadPlanInputsForPlan(rev, { view: U.viewOf(annualP, annualC), reporting: '2026-11-06', approvedCfg: cfg, entityKeys: null, viewScope: null });
  const c = deriveRemainingPlanContent({ annualContent: annualC, actualByEntity: D.actual.byEntity, derivedAt: NOW, annualPlanId: annualP.id, annualPlanRevision: 1 });
  return plan({ id: REMAINING_PLAN_2026.id, name: c.name, nameEn: 'Remaining 2026 Collection Plan', seedKey: REMAINING_PLAN_2026.seedKey, isSystem: true, origin: 'seed', createdBy: null, content: c, revision: 1 });
};
await ok('remaining-2026 plan, UPCOMING at the 6 Nov cut-off: «قادمة — تبدأ 7 نوفمبر 2026», the baseline block (annual · collected to 6 Nov · remaining · surplus when any) from the FROZEN baseline, target = the remaining, no plan-period actual / achievement / forecast, Nov–Dec 2026 axes with the partial November', async () => {
  const p = await REM(); const b = p.content.baseline; const r = await run(p.content, { p });
  assert.equal(r.basis.state, 'future_period'); assert.equal(r.basis.target.value, b.remaining); assert.ok(b.remaining > 0 && b.remaining < b.annualTarget);
  for (const lang of ['ar', 'en']) {
    const bh = text(render(E(PlanBaselineBlock, { view: r.view }), lang)); assert.ok(bh.includes(lang === 'ar' ? 'الأساس حتى 6 نوفمبر 2026' : 'Baseline to 6 Nov 2026'), bh); assert.ok(/21[.,]59/.test(bh) && /9[.,]21/.test(bh) && /12[.,]38/.test(bh), `${lang}: annual 21.59 · collected 9.21 · remaining 12.38: ${bh}`); assert.ok(!/Surplus|الفائض/.test(bh), 'no surplus row when there is none');
    const sum = text(render(E(PlanSummary, { measures: r.measures, view: r.view, plan: p, basis: r.basis }), lang)); assert.ok(sum.includes(lang === 'ar' ? 'قادمة — تبدأ 7 نوفمبر 2026' : 'Upcoming — starts 7 Nov 2026'), `${lang}: ${sum.slice(0, 300)}`); assert.equal((sum.match(/غير متاح|Not available/g) || []).length, 0, `${lang}: no empty «not available» cards`);
    assert.ok(/12[.,]38/.test(sum), 'the target tile is the remaining requirement'); assert.ok(sum.includes(lang === 'ar' ? 'توزيع متساوٍ على الأيام المتبقية — افتراض' : 'Equal distribution over the remaining days'), `${lang}: the baseline note is the illustrative note`);
    assert.ok(!BANNED.test(sum.replace('The system default plan', '')), `${lang}: no approval wording`);
    const cb = planCumulativeBlock(r.basis, r.forecast, { lang }); assert.equal(cb.labels.length, 2); assert.ok(/2026/.test(cb.labels[0]) && /2026/.test(cb.labels[1]) && !/2027/.test(cb.labels.join()), cb.labels.join()); assert.deepEqual(cb.series.map((x) => x.kind), ['planned', 'target', 'forecast'], 'the plan, the target and (supported) the DASHED forecast — a series of its own'); assert.deepEqual([cb.period.from, cb.period.to], ['2026-11-07', '2026-12-31']);
  }
  const m = r.basis.months; assert.deepEqual(m.map((x) => x.ym), ['2026-11', '2026-12']); assert.equal(m[0].partial, true); assert.equal(m[0].days, 24); assert.ok(Math.abs(m[0].plannedCum / b.remaining - 24 / 54) < 1e-6, 'the equal profile weights 24 of 54 days'); assert.equal(m[1].plannedCum, b.remaining);
  assert.equal(r.measures.actual, null); assert.equal(r.measures.achievementToDate, null);
});
await ok('remaining-2026 plan once the data cut-off passes 7 Nov (demo date 2026-11-20): actual collections of 7 Nov–20 Nov count against the REMAINING target only — never the baseline actuals; no upcoming label', async () => {
  const p = await REM(); const b = p.content.baseline; const st2 = loadStore('2026-11-20'); const cfg2 = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: '2026-11-20' });
  const rev2 = { data: { snapshot: async (scope, o = {}) => snapshot(st2, { scope, cfg: o.cfg || cfg2 }), series: async (scope, o = {}) => series(st2, { scope, cfg: o.cfg || cfg2 }) } };
  const view = U.viewOf(p, p.content); const D = await loadPlanInputsForPlan(rev2, { view, reporting: '2026-11-20', approvedCfg: cfg2, entityKeys: null, viewScope: null });
  const basis = planningBasisFromPlan({ view, today: '2026-11-20', latestDataDate: '2026-11-20', entityKeys: null, actual: D?.actual || null, viewScope: null });
  assert.notEqual(basis.state, 'future_period'); assert.equal(D.meta.period.start, '2026-11-07', 'the data is loaded for the plan period only');
  assert.ok(basis.actualToDate == null || basis.actualToDate < b.actualToCutoff / 5, `the plan-period actual (${basis.actualToDate}) is a few days of receipts, not the 6 Nov baseline (${b.actualToCutoff})`);
  assert.ok(basis.plannedToDate > 0 && basis.plannedToDate < b.remaining); assert.equal(basis.target.value, b.remaining);
  const sum = text(render(E(PlanSummary, { measures: planMeasures(basis, null), view, plan: p }))); assert.ok(!sum.includes('قادمة'), 'no upcoming label'); assert.ok(sum.includes('الأساس حتى 6 نوفمبر 2026'), 'the baseline block stays (frozen)');
  assert.equal(p.content.baseline.cutoff, '2026-11-06'); assert.deepEqual(p.content.period, { start: '2026-11-07', end: '2026-12-31', preset: 'range' });
});
await ok('baseline block with a surplus: an entity above its allocation shows the surplus row (separate), never netted; a restricted copy shows only the visible entities\' baseline; the editor table gets read-only baseline columns for a derived plan', async () => {
  const p = await REM(); const bl = { ...p.content.baseline, surplus: 123_000_000 }; const withS = { ...p.content, baseline: bl };
  const h = text(render(E(PlanBaselineBlock, { view: { content: withS } }))); assert.ok(h.includes('الفائض') && /123/.test(h));
  const ed = fs.readFileSync('src/components/plans/editor/TabAllocation.jsx', 'utf8'); assert.ok(/content\.baseline/.test(ed) && ed.includes("alloc.colRemaining") && ed.includes("alloc.colSurplus") && ed.includes("alloc.derivedNote"), 'the editor allocation table carries the baseline columns');
  const tx = fs.readFileSync('src/components/plans/editor/editorText.js', 'utf8'); for (const k of ['alloc.colAnnual', 'alloc.colActual', 'alloc.colRemaining', 'alloc.colSurplus', 'origin.derived']) assert.ok(tx.includes(`"${k}"`), k);
  const masked = maskPlanForViewer(JSON.parse(JSON.stringify(p)), [RY], normalizeGeoScope({ grants: [{ amanah: RY, municipalities: 'all', direct: true, notSpecified: true }] })); const mb = masked.content.baseline; assert.deepEqual(mb.entities.map((e) => e.entityKey), [RY]); assert.equal(mb.annualTarget, mb.entities[0].annual); assert.ok(mb.annualTarget < p.content.baseline.annualTarget);
});

/* ------------------------------------------------------------------ the contribution section: entity deviation | revenue-source bars | bullets (agent T) */
const SRC_RES = { asOf: TODAY, lines: [
  { class: 'B', entity: { key: RY }, source: { key: 's1', ar: 'مصدر أ', en: 'Source A' }, remaining: 600, count: 3, oldestDaysOverdue: 40 },
  { class: 'C', entity: { key: RY }, source: { key: 's1', ar: 'مصدر أ', en: 'Source A' }, remaining: 100, count: 1 },
  { class: 'B', entity: { key: JD }, source: { key: 's2', ar: 'مصدر ب', en: 'Source B' }, remaining: 300, count: 2, oldestDaysOverdue: 12 },
  { class: 'A', entity: { key: JD }, source: { key: 's2', ar: 'مصدر ب', en: 'Source B' }, remaining: 9999, count: 4 },
  { class: 'D', entity: { key: JD }, source: { key: 's3', ar: 'مصدر ج', en: 'Source C' }, remaining: 7777, count: 5 }
], cells: [
  { id: 'c1', entity: { key: RY }, source: { key: 's1' }, remaining: 700 }, { id: 'c2', entity: { key: JD }, source: { key: 's2' }, remaining: 300 }
], totals: {} };
const section = (r, extra = {}, lang = 'ar') => {
  const dev = planDeviationBlock(r.basis, { lang }); const bd = planBreakdown(r.basis, { lang });
  const bullets = planBulletRows(r.basis, { lang, derived: !!r.view?.content?.baseline }); const bulletBlock = planBulletBlock(r.basis, { lang, data: bullets });
  return render(E(PlanBreakdownSection, { basis: r.basis, dev, bd, view: emptyView(), onViewChange: noop, onPickRow: noop, bullets, bulletBlock, sources: sourceBars(SRC_RES, { lang }), sourceStatus: 'ready', onPickSource: noop, onResetSource: noop, ...extra }), lang);
};
await ok('contribution (full-year plan, in period): THREE visuals in order — entity deviation | revenue-source bars side by side, the bullets below, then the table; AR + EN', async () => {
  for (const lang of ['ar', 'en']) {
    const h = section(R, {}, lang); const t = text(h);
    const at = ['id="plan-entity-bars"', 'id="plan-source-bars"', 'id="plan-bullets"', 'id="plan-breakdown-table"'].map((k) => h.indexOf(k)); assert.ok(at.every((i) => i > 0) && at.every((v, i) => i === 0 || v > at[i - 1]), `${lang}: order ${at}`);
    assert.ok(h.includes('class="pln-contrib"') && h.indexOf('class="pln-contrib"') < at[0] && h.indexOf('id="plan-bullets"') > h.indexOf('id="plan-source-bars"'), 'entity bars and source bars share the grid; the bullets are outside it');
    assert.ok(t.includes(lang === 'ar' ? 'لا مستهدف لمصدر الإيراد' : 'There is no revenue-source target'), `${lang}: the no-source-target note`);
    assert.ok(t.includes(lang === 'ar' ? 'نسبة من مستهدف عام 2026' : '% of the 2026 target') && t.includes(lang === 'ar' ? 'الفعلي مقابل المخطط حتى تاريخه ومستهدف عام 2026' : 'Actual against planned to date and the 2026 target'), `${lang}: the axis is the % of the plan-period target`);
    const bh = h.slice(h.indexOf('id="plan-bullets"'), h.indexOf('id="plan-breakdown-table"')); assert.ok(!/معتمد|approved|annual target|المستهدف السنوي/i.test(text(bh)), `${lang}: no «approved» / «annual target» wording in the bullets`);
  }
});
await ok('bullets reconcile with the basis rows: collected · planned to date · target are the basis values; achievement = collected ÷ the FULL target, NOT capped; the axis passes 100 %; the scope row first', async () => {
  const b = R.basis; const d = planBulletRows(b, { lang: 'ar' }); assert.ok(d.available);
  const sc = d.rows[0]; assert.ok(sc.scope && sc.actual === b.actualToDate && sc.planned === b.plannedToDate && sc.target === b.target.value && sc.achievementPct === b.actualToDate / b.target.value);
  const ents = b.entities.filter((e) => e.hasTarget); assert.equal(d.rows.length, 1 + ents.length);
  for (const e of ents) { const r = d.rows.find((x) => x.key === e.key); assert.ok(r && r.actual === e.actual && r.planned === e.plannedToDate && r.target === e.target); assert.equal(r.achievementPct, e.achievementToDate); assert.equal(r.positionVsPlan, e.vsPlanRatio); }
  assert.deepEqual(d.rows.slice(1).map((x) => x.target), d.rows.slice(1).map((x) => x.target).sort((a, z) => z - a), 'ranked by target');
  // crafted: one entity above its target → 150 %, not capped; the axis grows
  const big = { ...b, entities: b.entities.map((e, i) => (i === 0 ? { ...e, actual: e.target * 1.5 } : e)) }; const dd = planBulletRows(big, { lang: 'en' });
  assert.ok(Math.abs(dd.rows.find((x) => x.key === b.entities[0].key).achievementPct - 1.5) < 1e-9 && dd.axisMax >= 1.5, 'not capped at 100%');
  const blk = planBulletBlock(b, { lang: 'ar', data: d, money: (v) => String(Math.round(v)) }); assert.equal(blk.kind, 'bullet'); assert.equal(blk.valueKind, 'rate'); assert.equal(blk.id, 'plan:bullet');
  assert.ok(blk.bullets.every((x) => x.target === 1) && Math.abs(blk.bullets[0].actual - sc.achievementPct) < 1e-12 && blk.bullets[0].ranges[0].to === sc.plannedPct);
  assert.deepEqual(blk.bullets[0].cells.slice(0, 3), ['\u2068' + Math.round(sc.actual) + '\u2069', '\u2068' + Math.round(sc.planned) + '\u2069', '\u2068' + Math.round(sc.target) + '\u2069'], 'the table view carries the amounts, each its own bidi isolate');
  // the chart library summarises it without throwing, in both languages, and never says «approved»
  for (const lang of ['ar', 'en']) { const sum = chartSummary(planBulletBlock(b, { lang, data: planBulletRows(b, { lang }) }), lang); assert.ok(typeof sum === 'string' ? !/معتمد|approved/i.test(sum) : true); }
});
await ok('rows without a target are listed as not drawn (never drawn, never 0): an entity with a zero target and a municipality without a municipal target', async () => {
  const c0 = content({ target: { amount: 6_000_000_000 }, allocations: [{ entityKey: RY, amount: 6_000_000_000, origin: 'manual' }, { entityKey: JD, amount: 0, origin: 'manual' }], municipalAllocations: [] });
  const r0 = await run(c0); const d0 = planBulletRows(r0.basis, { lang: 'ar', nameOf: (k) => k }); assert.deepEqual(d0.missing, [JD]); 
  assert.ok(!d0.rows.some((x) => x.key === JD)); const t0 = text(section(r0, {})); assert.ok(t0.includes('بلا مستهدف فلا يُرسم'), 'the "not drawn" line');
  const en = text(section(r0, {}, 'en')); assert.ok(en.includes('No target, so not drawn'));
  const rm = await run(content(), { viewScope: { amanah: JD, muni: 'all' } }); const dm = planBulletRows(rm.basis, { lang: 'ar' }); assert.equal(dm.kind, 'municipality');
  const withT = rm.basis.entities.filter((e) => e.hasTarget && Number.isFinite(e.actual)); assert.equal(dm.rows.length, 1 + withT.length); assert.equal(dm.missing.length, rm.basis.entities.length - withT.length);
  assert.ok(dm.rows[0].scope && dm.rows[0].target === rm.basis.target.value, 'the Amanah row first, then municipalities');
  const tm = text(section(rm, {})); assert.ok(tm.includes('المساهمة في الفجوة حسب البلدية'));
  if (dm.missing.length) assert.ok(tm.includes('بلا مستهدف فلا يُرسم'));
});
await ok('revenue-source bars: the actionable balance (classes B + C) by source from the action lines — blocked / older-than-180 are NOT in it; no source deviation; a click filters the «أين نركز» rows by source', async () => {
  const sb = sourceBars(SRC_RES, { lang: 'ar' }); assert.deepEqual(sb.items.map((x) => [x.key, x.total]), [['s1', 700], ['s2', 300]]); assert.equal(sb.total, 1000); assert.equal(sb.block.id, 'plan:sources'); assert.deepEqual(sb.block.keys, ['s1', 's2']);
  assert.ok(/أرصدة قائمة وليست انحرافاً/.test(sb.block.note)); assert.equal(sourceBars({ lines: [] }), null); assert.equal(sourceBars(null), null);
  const all = actionView(SRC_RES, { lang: 'ar' }); const one = actionView(SRC_RES, { lang: 'ar', sourceKey: 's2' });
  assert.equal(all.cells.length, 2); assert.deepEqual(one.cells.map((c) => c.source.key), ['s2']); assert.ok(one.groups.blocked.every((l) => l.source.key === 's2'));
  const sel = section(R, { srcSel: 's2' }); assert.ok(sel.includes('id="plan-source-sel"') && text(sel).includes('مصدر مختار لجدول الإجراءات') && text(sel).includes('مصدر ب'), 'the chosen source is named with a clear control');
  assert.ok(text(section(R, { onPickSource: null })).includes('اضغط شريطاً لتصفية جدول') === false, 'no click hint when the table below does not exist');
  assert.ok(text(section(R, { onPickSource: noop })).includes('اضغط شريطاً لتصفية جدول «أين نركز» على ذلك المصدر'));
  const page = fs.readFileSync('src/pages/PlanDetail.jsx', 'utf8'); assert.ok(page.includes('sourceKey: srcKey') && page.includes('setSrcSel((c) => (c === k ? null : k))') && /srcName=\{srcKey \?/.test(page) && page.includes('onResetSource={() => setSrcSel(null)}'), 'the selection is wired to the existing action table');
});
await ok('source-bars states: loading skeleton · error with Retry · denied · idle (period not running) omits the card; the bullets and the entity bars are unaffected; a failing visual never blanks the page', async () => {
  const ld = section(R, { sources: null, sourceStatus: 'loading' }); assert.ok(ld.includes('id="plan-source-bars"') && ld.includes('st-skel'));
  const er = text(section(R, { sources: null, sourceStatus: 'error', onRetrySources: noop })); assert.ok(er.includes('تعذّر تحميل خطوط الإجراءات') && er.includes('إعادة المحاولة'));
  const dn = text(section(R, { sources: null, sourceStatus: 'denied' }), 'ar'); assert.ok(dn.includes('لا صلاحية لوحدة التخطيط'));
  const en = text(section(R, { sources: null, sourceStatus: 'error', onRetrySources: noop }, 'en'), 'en'); assert.ok(en.includes('could not be loaded') && en.includes('Retry'));
  const idle = section(R, { sourceStatus: 'idle' }); assert.ok(!idle.includes('id="plan-source-bars"') && idle.includes('id="plan-bullets"') && idle.includes('id="plan-entity-bars"'));
  const src = fs.readFileSync('src/components/plans/PlanSections.jsx', 'utf8'); assert.ok(/class VisualBoundary extends React\.Component/.test(src) && /getDerivedStateFromError/.test(src) && (src.match(/<VisualBoundary /g) || []).length >= 2, 'each new visual sits in an error boundary');
});
await ok('UPCOMING plans (2027 and remaining-2026): no actual-based visual at all — no entity bars, no source bars, no bullets (no empty card); only the allocation table', async () => {
  const p27 = SYS27(); const r27 = await run(p27.content, { p: p27 }); const pr = await REM(); const rr = await run(pr.content, { p: pr });
  for (const r of [r27, rr]) {
    assert.equal(r.basis.state, 'future_period'); const d = planBulletRows(r.basis, { lang: 'ar' }); assert.equal(d.available, false); assert.equal(planBulletBlock(r.basis, { lang: 'ar' }), null);
    for (const lang of ['ar', 'en']) { const h = section(r, { sourceStatus: 'idle' }, lang); assert.ok(!/id="plan-(entity-bars|source-bars|bullets)"/.test(h), `${lang}: nothing actual-based`); assert.ok(h.includes('id="plan-breakdown-table"')); }
  }
});
await ok('period-aware target names: full-year «مستهدف عام 2026», 2027 plan in period «مستهدف عام 2027», the derived remaining plan «المستهدف المتبقي للفترة» (the dates of the period in the axis), any other range «مستهدف الفترة»', async () => {
  assert.equal(planTargetWords(R.basis).tick.ar, 'مستهدف عام 2026'); assert.equal(planTargetWords(R.basis).axis.en, '% of the 2026 target');
  const p27 = SYS27(); const v27 = U.viewOf(p27, p27.content); const b27 = planningBasisFromPlan({ view: v27, today: '2027-03-15', latestDataDate: '2027-03-15', entityKeys: null, actual: null, viewScope: null }); assert.equal(planTargetWords(b27).tick.en, '2027 target');
  const pr = await REM(); const rr = await run(pr.content, { p: pr }); const w = planTargetWords(rr.basis, { derived: true }); assert.equal(w.tick.ar, 'مستهدف المتبقي من 2026'); assert.equal(w.tick.en, 'Remaining-of-2026 target'); assert.ok(w.axis.ar.includes('2026-11-07') && w.axis.ar.includes('2026-12-31') && /remaining-of-2026 target/.test(w.axis.en));
  const rg = { ...R.basis, periodInfo: { ...R.basis.periodInfo, isCalendarYear: false, year: null }, period: { start: '2026-03-01', end: '2026-06-30' } }; assert.equal(planTargetWords(rg).tick.ar, 'مستهدف الفترة'); assert.ok(planTargetWords(rg).axis.ar.includes('2026-03-01'));
  // the remaining plan once running: the bullets compare against the REMAINING target
  const st2 = loadStore('2026-11-20'); const cfg2 = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: '2026-11-20' }); const rev2 = { data: { snapshot: async (scope, o = {}) => snapshot(st2, { scope, cfg: o.cfg || cfg2 }), series: async (scope, o = {}) => series(st2, { scope, cfg: o.cfg || cfg2 }) } };
  const view = U.viewOf(pr, pr.content); const D = await loadPlanInputsForPlan(rev2, { view, reporting: '2026-11-20', approvedCfg: cfg2, entityKeys: null, viewScope: null });
  const b2 = planningBasisFromPlan({ view, today: '2026-11-20', latestDataDate: '2026-11-20', entityKeys: null, actual: D?.actual || null, viewScope: null }); const d2 = planBulletRows(b2, { lang: 'ar', derived: true });
  if (d2.available) { assert.equal(d2.rows[0].target, pr.content.baseline.remaining); assert.ok(d2.rows[0].actual < pr.content.baseline.actualToCutoff / 5, 'only the plan-period collections'); assert.equal(d2.words.tick.ar, 'مستهدف المتبقي من 2026'); }
});
await ok('restricted municipal-only viewer: bullets show only authorised rows with the viewer\'s total — no Amanah total in the block, the rows or the table cells', async () => {
  const geo = only([J(1), J(2)]); const vis = visibleEntityKeysOfScope(geo); const masked = maskPlanForViewer(plan(), vis, geo);
  const r = await run(masked.content, { viewScope: { amanah: JD, muni: 'all' }, entityKeys: vis, p: masked }); const d = planBulletRows(r.basis, { lang: 'ar' });
  const blob = JSON.stringify(d) + JSON.stringify(planBulletBlock(r.basis, { lang: 'ar', data: d })); assert.ok(!/3000000000|9000000000/.test(blob), 'no Amanah / Ministry total');
  if (d.available) { assert.equal(d.rows[0].target, 500_000_000, 'their total = Σ of their municipal allocations'); assert.ok(d.rows.slice(1).every((x) => x.target <= 500_000_000)); assert.ok(!d.rows.some((x) => x.key === UNALLOCATED_MUNI_KEY && x.target > 0 && x.target === 2_500_000_000)); }
  const html = section(r, {}); assert.ok(!/3,000,000,000|3000000000/.test(html));
});
await ok('layout + guard: entity|source side by side on wide screens (auto-fit, stacked at 375 px), the page keeps rendering if a visual throws; the shared bullet draws a plan\'s own target label (not «approved»)', () => {
  const css = fs.readFileSync('src/styles/plans.css', 'utf8'); assert.ok(/\.pln-contrib \{[^}]*auto-fit, minmax\(min\(100%, 420px\), 1fr\)/.test(css));
  const lib = fs.readFileSync('src/utils/chartDrawCartesian.js', 'utf8'); assert.ok(lib.includes('b.targetLabel ? tl(b.targetLabel)') && lib.includes("L('المستهدف المعتمد', 'Approved target')"), 'default wording kept for the report charts');
  assert.ok(/const pc = p\.drawn\.map/.test(lib.split("registerChartFormat('bullet'")[1]), 'the bullet summary defines pc');
});

await ok('LOGIC AUDIT — the bullets are the basis, row by row: bar = collected ÷ the plan-period target (uncapped), band = planned to date ÷ target, tick = 100 %; the first row = the plan totals = Σ of the entity rows; the same numbers as the summary, the deviation chart and the table', async () => {
  const b = R.basis; const m = R.measures; const d = planBulletRows(b, { lang: 'ar' }); const sc = d.rows[0]; const blk = planBulletBlock(b, { lang: 'ar', data: d, money: (v) => String(Math.round(v)) });
  assert.equal(sc.actual, m.actual); assert.equal(sc.planned, m.plannedToDate); assert.equal(sc.target, m.target); assert.equal(sc.achievementPct, m.achievementToDate); assert.equal(sc.positionVsPlan, m.vsPlanRatio, 'the same three percentages as the summary tiles');
  const ents = d.rows.slice(1); assert.equal(sc.target, ents.reduce((t, e) => t + e.target, 0), 'the allocation is complete: Σ entity targets = the plan target'); assert.ok(Math.abs(sc.actual - (ents.reduce((t, e) => t + e.actual, 0) + (b.remainder || 0))) < 1, 'Σ entity collections (+ what no row holds) = the plan collections');
  const dev = planDeviationBlock(b, { lang: 'ar', topN: Infinity });
  for (const e of ents) { const i = dev.block.keys.indexOf(e.key); assert.ok(i >= 0 && Math.abs(dev.block.series[0].values[i] - (e.actual - e.planned)) < 1e-6, `${e.key}: the deviation bar is collected − planned to date of the same row`); }
  blk.bullets.forEach((x, i) => { const r = d.rows[i]; assert.equal(x.target, 1, 'the tick is the target = 100 %'); assert.equal(x.actual, r.actual / r.target); assert.equal(x.ranges[0].to, r.planned / r.target, 'the band is planned to date ÷ target'); });
  // the equal profile: every entity has the same planned-to-date share (and = the plan's); a manual override of ONE entity changes only that entity
  assert.ok(b.profile.assumption); for (const e of ents) assert.ok(Math.abs(e.plannedPct - sc.plannedPct) < 1e-9, 'equal profile ⇒ the same planned-to-date % for every entity');
  const w = {}; for (let i = 1; i <= 12; i += 1) w[`2026-${String(i).padStart(2, '0')}`] = i <= 2 ? 5000 : 0;
  const ro = await run(content({ entityDistributions: { [JD]: { profile: 'manual', weights: w } } })); const dro = planBulletRows(ro.basis, { lang: 'ar' });
  const rj = dro.rows.find((x) => x.key === JD); const rr = dro.rows.find((x) => x.key === RY); assert.ok(Math.abs(rr.plannedPct - sc.plannedPct) < 1e-9 && Math.abs(rj.plannedPct - 1) < 1e-9, `the overridden entity's band differs (${rj.plannedPct}) and the other keeps the plan's (${rr.plannedPct})`);
  // the caption states the ordering and the period target
  for (const lang of ['ar', 'en']) { const bl = planBulletBlock(b, { lang, data: planBulletRows(b, { lang }) }); assert.ok(lang === 'ar' ? bl.note.includes('مرتبة بحجم المستهدف') && bl.note.includes('بلا سقف') : /ranked by target size/.test(bl.note) && /no cap/.test(bl.note), bl.note); }
});
await ok('the axis extends past 100 % when a row exceeds its target (rendered tick), and the title appears ONCE; the amounts of the table view and the captions are bidi isolates (AR + EN)', async () => {
  const b = R.basis; const big = { ...b, entities: b.entities.map((e, i) => (i === 0 ? { ...e, actual: e.target * 1.5, achievementToDate: 1.5 } : e)) };
  const d = planBulletRows(big, { lang: 'ar' }); const blk = planBulletBlock(big, { lang: 'ar', data: d });
  const h = render(E(PlanBreakdownSection, { basis: big, dev: planDeviationBlock(big, { lang: 'ar' }), bd: planBreakdown(big, { lang: 'ar' }), view: emptyView(), onViewChange: noop, bullets: d, bulletBlock: blk })); const seg = h.slice(h.indexOf('id="plan-bullets"'), h.indexOf('id="plan-breakdown-table"'));
  assert.ok(/150\s?[%٪]/.test(seg), 'a 150 % tick is drawn'); const T26 = 'الفعلي مقابل المخطط حتى تاريخه ومستهدف عام 2026'; const heads = [...seg.matchAll(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/g)].map((x) => x[1]).filter((x) => x.includes(T26)); assert.ok(heads.length <= 1 && !/class="pl-h3">[^<]*الفعلي مقابل/.test(seg), `one visible heading: ${heads.length}`);
  const sc = d.rows[0]; for (const lang of ['ar', 'en']) { const bl = planBulletBlock(b, { lang, data: planBulletRows(b, { lang }), money: (v) => `${(v / 1e9).toFixed(2)} bn` }); const x = bl.bullets[0]; assert.ok(x.caption.ar === x.caption.en && /⁨[^⁩]+⁩ \/ ⁨[^⁩]+⁩ = [\d.]+%/.test(x.caption.ar), x.caption.ar); assert.ok(x.cells.slice(0, 3).every((c) => /^⁨.+⁩$/.test(c))); }
  assert.ok(sc.achievementPct > 0);
});
await ok('restricted entity viewer: the first row is «إجمالي الجهات المتاحة لك» and holds only their entities (no Ministry total); the remaining plan states that baseline collections are not counted', async () => {
  const geo = normalizeGeoScope({ grants: [{ amanah: RY, municipalities: 'all', direct: true, notSpecified: true }] }); const vis = visibleEntityKeysOfScope(geo); const masked = maskPlanForViewer(plan(), vis, geo);
  const r = await run(masked.content, { entityKeys: vis, p: masked }); const d = planBulletRows(r.basis, { lang: 'ar' }); assert.equal(d.rows[0].label, 'إجمالي الجهات المتاحة لك'); assert.deepEqual(d.rows.slice(1).map((x) => x.key), [RY]); assert.equal(d.rows[0].target, 6_000_000_000);
  assert.ok(!/9000000000/.test(JSON.stringify(d)));
  const pr = await REM(); const v = U.viewOf(pr, pr.content); const bs = planningBasisFromPlan({ view: v, today: '2026-11-20', latestDataDate: '2026-11-20', entityKeys: null, actual: null, viewScope: null }); const dd = planBulletRows({ ...bs, state: 'ok', actualToDate: 1, plannedToDate: 1, target: { value: pr.content.baseline.remaining } }, { lang: 'ar', derived: true });
  const bl = planBulletBlock({ ...bs, reportingCutoff: '2026-11-20' }, { lang: 'ar', data: { ...dd, available: true, rows: dd.rows.length ? dd.rows : [{ key: '__scope__', label: 'x', scope: true, actual: 1, planned: 1, target: 2, achievementPct: 0.5, plannedPct: 0.5, positionVsPlan: 1 }] } });
  assert.ok(bl.note.includes('محصّل الأساس المجمّد لا يُحسب هنا') && bl.targetLabel.ar === 'مستهدف المتبقي من 2026');
});

await ok('an Amanah view without municipal allocations draws its Amanah ONCE (the scope row is the entity row); with municipal allocations it is the Amanah row + the municipality rows', async () => {
  const r1 = await run(content({ municipalAllocations: [] }), { viewScope: { amanah: JD, muni: 'all' } }); const d1 = planBulletRows(r1.basis, { lang: 'ar' });
  assert.equal(r1.basis.rowsKind, 'entity'); assert.equal(d1.rows.length, 1, JSON.stringify(d1.rows.map((x) => x.key))); assert.ok(d1.rows[0].scope && d1.rows[0].target === 3_000_000_000 && d1.rows[0].actual === r1.basis.actualToDate);
  const r2 = await run(content(), { viewScope: { amanah: JD, muni: 'all' } }); const d2 = planBulletRows(r2.basis, { lang: 'ar' }); assert.equal(d2.rows[0].scope, true); assert.ok(d2.rows.length >= 2 && d2.rows.slice(1).every((x) => !x.scope));
});

console.log(`plans UI: ${n} test groups passed`);
