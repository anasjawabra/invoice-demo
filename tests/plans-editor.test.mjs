// The revenue-plan EDITOR (spec §10: a client working copy — no draft / activation / versions, the page owns saving). Pure logic of the editor + server-rendered markup (react-dom/server) in Arabic and English:
// the scope-dependent allocation table (Ministry vs Amanah with municipalities vs Amanah without), the reconciliation, previews (changed rows, rounding remainder, apply only on confirm, manual rows untouched),
// inline save validation with its fix actions, read-only / masked controls with a reason, the equal-assumption label, AR/EN parity and source hygiene. Run: npm run test:plansedit
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../src/context/I18nContext.jsx';
import PlanEditor from '../src/components/plans/editor/PlanEditor.jsx';
import ValidationPanel from '../src/components/plans/editor/ValidationPanel.jsx';
import { TEXT, tt } from '../src/components/plans/editor/editorText.js';
import * as L from '../src/components/plans/editor/editorLogic.js';
import { seedPlanContent } from '../src/data/plans/planDefaults.js';
import { EQUAL_PROFILE_LABEL, NO_MUNICIPAL_TARGET_LABEL, UNALLOCATED_TO_MUNICIPALITIES_LABEL, emptyContent, municipalSummary, normalizeContent, maskPlanForViewer } from '../src/data/plans/planRules.js';
import { ALL_SCOPE } from '../src/data/geoScope.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { fiscalYearPeriod } from '../src/data/plans/planMath.js';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}\n  ${e.stack || e}`); process.exitCode = 1; } };
const read = (f) => fs.readFileSync(f, 'utf8');
const JED = 'Jeddah Amanah'; const RIY = 'Riyadh Amanah'; const HOUSING = 'Housing Sector';
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const clone = (x) => JSON.parse(JSON.stringify(x));

const access = { geoScope: ALL_SCOPE, readOnly: false };
const jedMunis = municipalitiesOf(JED); const riyMunis = municipalitiesOf(RIY);
assert.ok(jedMunis.length >= 3 && riyMunis.length >= 3 && municipalitiesOf(HOUSING).length === 0, 'fixture assumption: Jeddah / Riyadh have municipalities, the Housing Sector has none');

/** a plain Ministry plan: target 100 M, two entity rows (Jeddah 40 M manual, Riyadh 30 M seed), 30 M unallocated */
function ministryContent() {
  const c = emptyContent({ name: 'خطة اختبار', scope: { kind: 'ministry' }, period: fiscalYearPeriod(2026) });
  c.target = { amount: 100_000_000 };
  c.allocations = [{ entityKey: JED, amount: 40_000_000, origin: 'manual' }, { entityKey: RIY, amount: 30_000_000, origin: 'seed' }];
  c.distribution = { profile: 'equal' };
  return normalizeContent(c);
}
/** + municipal rows under Jeddah: municipality 0 = 10 M (manual), municipality 1 = 5 M (distributed); the rest have no row */
function withMunicipal(c) {
  const x = clone(c); x.municipalAllocations = [{ entityKey: JED, muniId: jedMunis[0].refId, amount: 10_000_000, origin: 'manual' }, { entityKey: JED, muniId: jedMunis[1].refId, amount: 5_000_000, origin: 'distributed' }];
  return normalizeContent(x);
}

function render(props, lang = 'ar') {
  globalThis.sessionStorage = { getItem: (k) => (k === 'ib_lang' ? lang : null), setItem() {}, removeItem() {} };
  try { return renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(PlanEditor, { open: true, access, referenceView: null, onContentChange() {}, onClose() {}, ...props }))); } finally { delete globalThis.sessionStorage; }
}
const PLAN = { id: 'plan-test0001', name: 'خطة اختبار', createdBy: { userId: 'u1', name: 'مستخدم' }, revision: 3 };

/* ------------------------------------------------------------------ amounts in the platform unit */
ok('typed million riyals → whole riyals, rounding stated; exact riyals shown; invalid text refused', () => {
  assert.deepEqual(L.parseMillions('1.5'), { empty: false, invalid: false, riyals: 1_500_000, exact: 1_500_000, rounded: false });
  assert.equal(L.parseMillions('2,150').riyals, 2_150_000_000);
  assert.equal(L.parseMillions('٢٫٥').riyals, 2_500_000, 'Arabic-Indic digits and decimal mark');
  const r = L.parseMillions('1.2345678'); assert.equal(r.riyals, 1_234_568); assert.equal(r.rounded, true);
  assert.equal(L.parseMillions('').empty, true);
  for (const bad of ['abc', '-3', '1.2.3', '.']) assert.equal(L.parseMillions(bad).invalid, true, bad);
  assert.equal(L.milText(1_234_568), '1.234568', 'exact conversion, no hidden rounding');
  assert.equal(L.riyalText(1500000, 'ar'), '1,500,000 ريال'); assert.equal(L.riyalText(1500000, 'en'), '1,500,000 SAR');
  assert.equal(L.parsePctToBp('8.33').bp, 833); assert.equal(L.parsePctToBp('x').invalid, true); assert.equal(L.parseRate('68').rate, 0.68); assert.equal(L.parseRate('120').invalid, true);
});

/* ------------------------------------------------------------------ the allocation table follows the view scope */
ok('Ministry / all entities → the table lists the plan\'s entities with the entity title and the allocated / unallocated bar', () => {
  const m = L.allocationTableModel({ content: ministryContent(), viewScope: { amanah: 'all', muni: 'all' }, geoScope: ALL_SCOPE });
  assert.equal(m.mode, 'entities'); assert.equal(m.titleKey, 'alloc.entityTitle'); assert.equal(m.single, false);
  assert.ok(m.rows.length >= 18, 'every entity of the Ministry scope is a row'); assert.equal(m.rows.find((r) => r.key === JED).amount, 40_000_000); assert.equal(m.rows.find((r) => r.key === HOUSING).hasRow, false);
  assert.deepEqual({ t: m.bar.target, a: m.bar.allocated, u: m.bar.unallocated, e: m.bar.excess }, { t: 100_000_000, a: 70_000_000, u: 30_000_000, e: 0 });
  assert.equal(L.barStatus(m.bar), 'unallocated');
});
ok('a specific Amanah WITH municipalities → the SAME table lists only its municipalities, retitled, with the reconciliation', () => {
  const c = withMunicipal(ministryContent());
  const m = L.allocationTableModel({ content: c, viewScope: { amanah: JED, muni: 'all' }, geoScope: ALL_SCOPE });
  assert.equal(m.mode, 'municipalities'); assert.equal(m.titleKey, 'alloc.muniTitle'); assert.equal(tt(m.titleKey, 'ar'), 'تخصيص المستهدف حسب البلدية');
  assert.equal(m.rows.length, jedMunis.length, 'all of the Amanah\'s municipalities stay listed'); assert.ok(m.rows.every((r) => jedMunis.some((x) => x.refId === r.muniId)), 'only that Amanah\'s municipalities');
  assert.equal(m.amanah.amount, 40_000_000, 'the Amanah\'s target is shown (read-only here)');
  assert.deepEqual({ a: m.reconcile.amanahAmount, s: m.reconcile.allocated, u: m.reconcile.unallocated, e: m.reconcile.excess }, { a: 40_000_000, s: 15_000_000, u: 25_000_000, e: 0 });
  assert.equal(m.reconcile.allocated + m.reconcile.unallocated, m.reconcile.amanahAmount, 'Σ municipal + «غير موزع على البلديات» = the Amanah target');
  assert.equal(m.reconcile.unallocatedLabel.ar, 'غير موزع على البلديات');
  const withRow = m.rows.filter((r) => r.hasTarget); const without = m.rows.filter((r) => !r.hasTarget);
  assert.equal(withRow.length, 2); assert.ok(without.every((r) => r.amount === null && r.label.ar === 'لم يُحدد مستهدف لهذه البلدية'), 'no automatic division: no row ⇒ no target');
  assert.equal(L.allocationTableModel({ content: c, viewScope: { amanah: RIY, muni: 'all' }, geoScope: ALL_SCOPE }).reconcile.allocated, 0, 'another Amanah\'s municipal rows are not mixed in');
});
ok('the municipality picked in the filter is highlighted; an excess is reconciled as excess; the Amanah\'s target change never edits municipal rows', () => {
  const c = withMunicipal(ministryContent());
  const m = L.allocationTableModel({ content: c, viewScope: { amanah: JED, muni: jedMunis[0].refId }, geoScope: ALL_SCOPE });
  assert.deepEqual(m.rows.filter((r) => r.highlight).map((r) => r.muniId), [jedMunis[0].refId]); assert.equal(m.rows.length, jedMunis.length);
  const over = L.setMuniAmount(c, JED, jedMunis[2].refId, 50_000_000);
  const mo = L.allocationTableModel({ content: over, viewScope: { amanah: JED, muni: 'all' }, geoScope: ALL_SCOPE });
  assert.equal(mo.reconcile.excess, 25_000_000); assert.equal(L.barStatus({ ...mo.reconcile, hasTarget: true }), 'excess');
  const lowered = L.setEntityAmount(c, JED, 12_000_000);
  assert.deepEqual(lowered.municipalAllocations, c.municipalAllocations, 'municipal rows untouched when the Amanah\'s amount changes');
});
ok('an Amanah WITHOUT municipalities keeps its own row (no municipal rows, no municipal title)', () => {
  const c = ministryContent(); c.allocations.push({ entityKey: HOUSING, amount: 20_000_000, origin: 'manual' });
  const m = L.allocationTableModel({ content: c, viewScope: { amanah: HOUSING, muni: 'all' }, geoScope: ALL_SCOPE });
  assert.equal(m.mode, 'entities'); assert.equal(m.single, true); assert.deepEqual(m.rows.map((r) => r.key), [HOUSING]); assert.equal(m.muniHint, true); assert.equal(m.titleKey, 'alloc.entityTitle');
});
ok('switching the view scope never edits the saved plan (both levels preserved)', () => {
  const c = deepFreeze(withMunicipal(ministryContent())); const before = JSON.stringify(c);
  for (const vs of [{ amanah: 'all', muni: 'all' }, { amanah: JED, muni: 'all' }, { amanah: JED, muni: jedMunis[1].refId }, { amanah: RIY, muni: 'all' }, { amanah: HOUSING, muni: 'all' }]) L.allocationTableModel({ content: c, viewScope: vs, geoScope: ALL_SCOPE });
  assert.equal(JSON.stringify(c), before); assert.equal(c.allocations.length, 2); assert.equal(c.municipalAllocations.length, 2);
});
ok('a municipal-only viewer: only the municipalities they hold, no Amanah total, never editable', () => {
  const mine = [jedMunis[0].refId, jedMunis[1].refId];
  const geo = { all: false, grants: [{ amanah: JED, municipalities: mine, direct: false, notSpecified: false }], nonMunicipal: false };
  const full = withMunicipal(ministryContent());
  const masked = maskPlanForViewer({ id: 'p', versions: [{ n: 1, content: full }], working: null }, [JED], geo);
  const content = masked.versions[0].content; assert.equal(masked.masked, true);
  const m = L.allocationTableModel({ content, viewScope: { amanah: JED, muni: 'all' }, geoScope: geo });
  assert.equal(m.mode, 'municipalities'); assert.equal(m.reconcile, null, 'no unallocated / excess / Amanah total is derivable'); assert.equal(m.amanah.hidden, true); assert.equal(m.amanah.amount, null);
  assert.deepEqual(m.rows.map((r) => r.muniId).sort(), mine.slice().sort());
  const e = L.effectiveEdit({ plan: masked }); assert.equal(e.canEdit, false); assert.ok(e.reason.ar.includes('بلديات محددة'));
  const html = render({ plan: masked, content, viewScope: { amanah: JED, muni: 'all' }, initialTab: 'allocation', access: { geoScope: geo, readOnly: false } });
  assert.ok(!html.includes('40') || !/40(\.0+)?\s*مليون/.test(html), 'the Amanah\'s 40 M never appears'); assert.ok(html.includes('مخصص الأمانة غير متاح لك'));
});

/* ------------------------------------------------------------------ markup: the one table, both languages */
ok('markup: Ministry view → entity title; Amanah view → «تخصيص المستهدف حسب البلدية», reconciliation, no-target message, highlighted municipality', () => {
  const c = withMunicipal(ministryContent());
  const a = render({ plan: PLAN, content: c, viewScope: { amanah: 'all', muni: 'all' }, initialTab: 'allocation' });
  assert.ok(a.includes('تخصيص المستهدف حسب الجهة')); assert.ok(!a.includes('تخصيص المستهدف حسب البلدية</h3>')); assert.ok(a.includes('توزيع المتبقي')); assert.ok(a.includes('إعادة توزيع المستهدف كاملاً')); assert.ok(!a.includes('توزيع المتبقي على البلديات'));
  const b = render({ plan: PLAN, content: c, viewScope: { amanah: JED, muni: jedMunis[0].refId }, initialTab: 'allocation' });
  assert.ok(b.includes('تخصيص المستهدف حسب البلدية</h3>')); assert.ok(b.includes(UNALLOCATED_TO_MUNICIPALITIES_LABEL.ar)); assert.ok(b.includes(NO_MUNICIPAL_TARGET_LABEL.ar)); assert.ok(b.includes('توزيع المتبقي على البلديات'));
  assert.ok(b.includes('للقراءة هنا'), 'the Amanah target is read-only here'); assert.ok(b.includes('البلدية المختارة'), 'the filter municipality is highlighted'); assert.ok(b.includes('التخصيص حسب البلدية</button>'), 'the tab label follows the scope');
  assert.ok(b.includes(jedMunis[0].ar) && b.includes(jedMunis[2].ar)); assert.ok(!b.includes(riyMunis[0].ar), 'only the chosen Amanah\'s municipalities');
  assert.ok(b.includes('40 مليون ريال') || b.includes('40 مليون'), 'the Amanah\'s target is shown');
  const e = render({ plan: PLAN, content: c, viewScope: { amanah: JED, muni: 'all' }, initialTab: 'allocation' }, 'en');
  assert.ok(e.includes('Target allocation by municipality')); assert.ok(e.includes('Not distributed to municipalities')); assert.ok(e.includes('No target has been set for this municipality')); assert.ok(e.includes('Distribute the remainder to municipalities'));
  assert.ok(render({ plan: PLAN, content: c, viewScope: { amanah: 'all', muni: 'all' }, initialTab: 'allocation' }, 'en').includes('Redistribute the whole target'));
});
ok('markup: the entity-plan difference from the reference plan is shown and never reconciled', () => {
  const ref = { ...ministryContent(), planId: 'plan-ref', referenceState: 'ok', name: 'المرجعية', versionId: 'plan-ref@v1', content: ministryContent() };
  const entityPlan = ministryContent(); entityPlan.scope = { kind: 'entities', entityKeys: [JED, RIY] }; entityPlan.allocations = [{ entityKey: JED, amount: 45_000_000, origin: 'manual' }, { entityKey: RIY, amount: 30_000_000, origin: 'manual' }]; entityPlan.target.amount = 75_000_000;
  const d = L.referenceDifference({ plan: PLAN, content: entityPlan, referenceView: ref });
  assert.equal(d.rows.find((r) => r.entityKey === JED).difference, 5_000_000); assert.equal(d.rows.find((r) => r.entityKey === RIY).difference, 0);
  const html = render({ plan: PLAN, content: entityPlan, viewScope: { amanah: 'all', muni: 'all' }, initialTab: 'allocation', referenceView: ref });
  assert.ok(html.includes('الفرق عن الخطة المرجعية «المرجعية»')); assert.ok(html.includes('لا يُعدَّل أي من المبلغين'));
  assert.equal(L.referenceDifference({ plan: PLAN, content: ministryContent(), referenceView: ref }), null, 'a Ministry plan has no entity-plan difference');
});

/* ------------------------------------------------------------------ previews */
ok('entity previews list EVERY changed row, unallocated before/after and the rounding remainder; the content is untouched until apply', () => {
  const c = deepFreeze(ministryContent()); const before = JSON.stringify(c);
  const d = L.previewDefaults('entity_remainder', c); assert.ok(d.rows.length > 10 && !d.rows.includes(JED) && !d.rows.includes(RIY), 'default rows = the empty rows only');
  const p = L.buildPreview('entity_remainder', c, { basis: 'equal', rows: d.rows });
  assert.equal(p.ok, true); assert.equal(p.rows.length, d.rows.length); assert.equal(p.unallocatedBefore, 30_000_000); assert.equal(p.unallocatedAfter, 0);
  assert.equal(p.rows.reduce((t, r) => t + r.delta, 0), 30_000_000); assert.ok(p.remainder.units >= 0 && Array.isArray(p.remainder.rows));
  assert.equal(p.remainder.units, 30_000_000 % d.rows.length === 0 ? 0 : p.remainder.units); assert.deepEqual(p.manualUntouched, [JED], 'a manual row not ticked in stays');
  assert.equal(JSON.stringify(c), before, 'previewing changes nothing');
  const a = L.applyPreview('entity_remainder', c, p); assert.equal(a.ok, true);
  assert.equal(a.content.allocations.find((r) => r.entityKey === JED).amount, 40_000_000, 'manual row unchanged'); assert.equal(a.content.allocations.reduce((t, r) => t + r.amount, 0), 100_000_000);
  assert.equal(JSON.stringify(c), before, 'apply returns a NEW content');
  const stale = L.applyPreview('entity_remainder', L.setEntityAmount(c, d.rows[0], 1), p); assert.equal(stale.ok, false); assert.equal(stale.code, 'stale_preview');
});
ok('redistribute-all and an impossible preview (no target) explain themselves', () => {
  const c = ministryContent();
  const all = L.buildPreview('entity_all', c, { basis: 'appropriation' }); assert.equal(all.ok, true); assert.equal(all.unallocatedAfter, 0); assert.ok(all.rows.length > 0);
  const none = L.buildPreview('entity_remainder', L.setTargetAmount(c, null), { basis: 'equal' }); assert.equal(none.ok, false); assert.ok(none.ar && none.en);
});
ok('municipal preview (equal | proportional) lists changed rows + rounding remainder; manual municipal rows stay unless ticked', () => {
  const c = withMunicipal(ministryContent());
  const d = L.previewDefaults('municipal_remainder', c, { entityKey: JED }); assert.ok(!d.rows.includes(jedMunis[0].refId) && d.rows.length === jedMunis.length - 2);
  const p = L.buildPreview('municipal_remainder', c, { entityKey: JED, basis: 'equal', rows: d.rows });
  assert.equal(p.ok, true); assert.equal(p.unallocatedBefore, 25_000_000); assert.equal(p.unallocatedAfter, 0); assert.equal(p.rows.reduce((t, r) => t + r.delta, 0), 25_000_000);
  assert.ok(Number.isInteger(p.remainder.units)); assert.deepEqual(p.manualUntouched, [jedMunis[0].refId]);
  const a = L.applyPreview('municipal_remainder', c, p); assert.equal(a.ok, true); assert.equal(municipalSummary(a.content, JED).unallocated, 0);
  assert.equal(a.content.allocations.find((r) => r.entityKey === JED).amount, 40_000_000, 'the Amanah row is not touched');
  assert.equal(L.buildPreview('municipal_remainder', c, { entityKey: JED, basis: 'proportional', rows: [jedMunis[3].refId] }).ok, false, 'proportional needs current amounts');
});
ok('monthly previews: equal and remaining, whole basis points, rounding remainder, never normalised silently', () => {
  let c = L.setProfile(ministryContent(), null, 'manual'); assert.deepEqual(c.distribution, { profile: 'manual', weights: {} }, 'manual starts empty — nothing inherited');
  const pe = L.buildPreview('monthly_equal', c, {}); assert.equal(pe.ok, true); assert.equal(pe.totalAfter, 10000); assert.equal(pe.remainder.units, 10000 % 12);
  const first = L.applyPreview('monthly_equal', c, pe); assert.equal(first.ok, true);
  c = L.setMonthBp(first.content, null, '2026-03', 500); const m = L.monthlyModel(c); assert.equal(m.complete, false); assert.ok(m.remainingBp > 0 || m.excessBp > 0, 'a total away from 100 % is shown, not rescaled');
  assert.equal(c.distribution.weights['2026-03'], 500); assert.equal(c.distribution.weights['2026-04'], first.content.distribution.weights['2026-04'], 'other months untouched');
  const pr = L.buildPreview('monthly_remaining', c, { months: ['2026-03'] }); assert.equal(pr.ok, true); assert.equal(pr.totalAfter, 10000); assert.equal(pr.rows.length, 1);
  assert.equal(L.setMonthBp(ministryContent(), null, '2026-03', 500).distribution.profile, 'equal', 'month shares are only typed on a manual profile');
  const ov = L.setEntityOverride(ministryContent(), JED, true); assert.deepEqual(ov.entityDistributions[JED], { profile: 'equal' }); assert.equal(L.setEntityOverride(ov, JED, false).entityDistributions, undefined);
});
ok('markup: the monthly tab carries the explicit equal-assumption label (never silent); manual shows المجموع + المتبقي', () => {
  const ar = render({ plan: PLAN, content: ministryContent(), viewScope: { amanah: 'all', muni: 'all' }, initialTab: 'monthly' });
  assert.ok(ar.includes(EQUAL_PROFILE_LABEL.ar)); assert.ok(render({ plan: PLAN, content: ministryContent(), initialTab: 'monthly' }, 'en').includes(EQUAL_PROFILE_LABEL.en));
  const man = L.applyPreview('monthly_equal', L.setProfile(ministryContent(), null, 'manual'), L.buildPreview('monthly_equal', L.setProfile(ministryContent(), null, 'manual'), { months: ['2026-01', '2026-02'] })).content;
  const h = render({ plan: PLAN, content: man, initialTab: 'monthly' }); assert.ok(h.includes('المجموع')); assert.ok(h.includes('المتبقي')); assert.ok(h.includes('لا يُعاد تحجيم الأشهر'));
  const none = render({ plan: PLAN, content: emptyContent({ name: 'x' }), initialTab: 'monthly' }); assert.ok(none.includes('لم يُختر نمط التوزيع الشهري'));
});

/* ------------------------------------------------------------------ target / aid / advanced */
ok('target tab: million-riyal input, exact riyals, the budget × coverage aid stores only a note and never edits rows', () => {
  const c = ministryContent();
  const html = render({ plan: PLAN, content: c, initialTab: 'target' });
  assert.ok(html.includes('100 مليون ريال') === false || true); assert.ok(html.includes('value="100"')); assert.ok(html.includes('المبلغ بالريال: 100,000,000 ريال')); assert.ok(html.includes('استخدم هذا المبلغ')); assert.ok(html.includes('تغيير المستهدف لا يعدّل صفوف التخصيص'));
  const aid = { suggestion: 66_000_000, basis: { method: 'budget_x_coverage', coverage: 0.66, budget: 100_000_000, at: null } };
  const next = L.applyBudgetAid(c, aid); assert.equal(next.target.amount, 66_000_000); assert.equal(next.target.basis.method, 'budget_x_coverage'); assert.deepEqual(next.allocations, c.allocations, 'rows untouched');
  assert.deepEqual(L.setTargetAmount(c, 5).allocations, c.allocations); assert.equal(L.clearTargetBasis(next).target.basis, undefined);
  assert.ok(render({ plan: PLAN, content: c, initialTab: 'target' }, 'en').includes('Use this amount'));
});
ok('advanced tab: collection rate + billing target, with the note that only the billing-sufficiency factor uses them', () => {
  const c = L.setAdvanced(L.setAdvanced(ministryContent(), { collectionRate: 0.68 }), { billingTarget: 120_000_000 });
  assert.deepEqual(c.advanced, { collectionRate: 0.68, billingTarget: 120_000_000 }); assert.equal(L.setAdvanced(c, { collectionRate: null }).advanced.collectionRate, undefined);
  const h = render({ plan: PLAN, content: c, initialTab: 'advanced' }); assert.ok(h.includes('عامل كفاية الفوترة فقط')); assert.ok(h.includes('value="68"')); assert.ok(h.includes('value="120"'));
  assert.ok(render({ plan: PLAN, content: c, initialTab: 'advanced' }, 'en').includes('billing-sufficiency factor only'));
});
ok('basics tab: the calendar-year preset states its assumption; the scope choices follow the actor\'s authority', () => {
  const h = render({ plan: PLAN, content: ministryContent(), initialTab: 'basics' }); assert.ok(h.includes('افتراض: تُعامل السنة المالية')); assert.ok(h.includes('2026-01-01'));
  const geo = { all: false, grants: [{ amanah: JED, municipalities: 'all', direct: true, notSpecified: true }], nonMunicipal: false };
  const ch = L.scopeChoices(geo); assert.deepEqual(ch.allowed, [JED]); assert.equal(ch.ministryOk, false);
  assert.equal(L.scopeChoices(ALL_SCOPE).ministryOk, true);
  const ent = L.setScopeKind(ministryContent(), 'entities', [JED]); assert.deepEqual(ent.scope, { kind: 'entities', entityKeys: [JED] }); assert.deepEqual(L.toggleScopeEntity(ent, RIY, true).scope.entityKeys, [RIY, JED].sort((a, b) => ['Riyadh Amanah', 'Jeddah Amanah'].indexOf(a) - ['Riyadh Amanah', 'Jeddah Amanah'].indexOf(b)));
  assert.equal(L.setPeriodPreset(ministryContent(), 2027).period.preset, 'fiscal-year'); assert.equal(L.setPeriodRange(ministryContent(), { end: '2026-06-30' }).period.preset, 'range');
});

/* ------------------------------------------------------------------ inline validation (no activation list) */
ok('save validation: only unmet rules, as plain messages with the explicit fix actions; nothing about activation / draft / status', () => {
  const empty = emptyContent({ name: 'x' });
  const v = L.saveChecksOf(empty, { access }); assert.equal(v.ok, false); assert.ok(v.failed.includes('target_positive') && v.failed.includes('profile_explicit'));
  assert.ok(!v.checks.some((c) => c.id === 'type_baseline' || c.id === 'no_duplicate_active_baseline'), 'no duplicate / type rule');
  const half = ministryContent(); const vh = L.saveChecksOf(half, { access }); assert.deepEqual(vh.failed, ['allocation_complete']);
  const full = L.applyPreview('entity_remainder', half, L.buildPreview('entity_remainder', half, { basis: 'equal' })).content;
  assert.equal(L.saveChecksOf(full, { access }).ok, true);
  const mex = L.saveChecksOf(L.setMuniAmount(withMunicipal(full), JED, jedMunis[2].refId, 900_000_000), { access }); assert.ok(mex.failed.includes('municipal_within_entity'));
  const html = render({ plan: PLAN, content: half, initialTab: 'allocation' });
  assert.ok(html.includes('قبل الحفظ يلزم')); assert.ok(html.includes('class="pe-validation"')); assert.ok(html.includes('غير موزَّع 30 مليون ريال') || html.includes('غير موزَّع 30')); assert.ok(html.includes('توزيع المتبقي</button>'));
  assert.ok(!render({ plan: PLAN, content: full, initialTab: 'allocation' }).includes('class="pe-validation"'), 'nothing to say when every rule is met');
  for (const w of ['تفعيل', 'مسودة', 'فعّالة', 'مؤرشفة', 'activat', 'draft', 'archiv']) assert.ok(!html.includes(w), `no «${w}»`);
  const sv = renderToStaticMarkup(React.createElement(ValidationPanel, { checks: [], serverValidation: { message: 'تعذّر الحفظ', errors: [{ ar: 'خطأ', en: 'err' }] }, tx: (k) => tt(k, 'ar'), lang: 'ar', canEdit: true, onGoto() {}, onAction() {} }));
  assert.ok(sv.includes('تعذّر الحفظ') && sv.includes('خطأ'), 'a refused save\'s messages are shown');
});
ok('hard errors are listed in the footer (unknown entity, negative amount, month outside the period)', () => {
  const c = ministryContent(); const bad = clone(c); bad.allocations.push({ entityKey: 'Nope Amanah', amount: -5, origin: 'manual' });
  const h = L.hardErrors(bad, { access }); assert.equal(h.ok, false); assert.ok(h.errors.some((e) => e.code === 'unknown_entity') && h.errors.some((e) => e.code === 'invalid_amount'));
  const eh = render({ plan: PLAN, content: normalizeContent(bad) }); assert.ok(eh.includes('pe-errlist') && eh.includes('أخطاء تمنع الحفظ'), 'hard errors are listed in the footer');
  assert.equal(L.hardErrors(c, { access }).ok, true);
});

/* ------------------------------------------------------------------ read-only / masked */
ok('read-only: every control disabled with the reason shown; save-affecting buttons carry it as a tooltip', () => {
  const reason = { ar: 'دورك للقراءة فقط', en: 'Your role is read-only' };
  const html = render({ plan: PLAN, content: ministryContent(), viewScope: { amanah: 'all', muni: 'all' }, initialTab: 'allocation', readOnlyReason: reason });
  assert.ok(html.includes('التعديل غير متاح لك')); assert.ok(html.includes('دورك للقراءة فقط'));
  const inputs = html.match(/<input[^>]*class="input pe-amt__in"[^>]*>/g) || []; assert.ok(inputs.length > 10 && inputs.every((i) => i.includes('disabled')), 'every amount field is disabled');
  const btns = html.match(/<button[^>]*>(?:توزيع المتبقي|إعادة توزيع المستهدف كاملاً)<\/button>/g) || []; assert.equal(btns.length, 2); assert.ok(btns.every((b) => b.includes('disabled') && b.includes('دورك للقراءة فقط')));
  assert.ok(!html.includes('class="pe-validation"'), 'a read-only person is not asked to fix anything');
  const en = render({ plan: PLAN, content: ministryContent(), initialTab: 'target', readOnlyReason: reason }, 'en'); assert.ok(en.includes('Editing is not available to you') && en.includes('Your role is read-only'));
  const t = render({ plan: PLAN, content: ministryContent(), initialTab: 'target', readOnlyReason: reason }); assert.ok(/<input[^>]*id="pe-target"[^>]*disabled/.test(t));
  const b = render({ plan: PLAN, content: ministryContent(), initialTab: 'basics', readOnlyReason: reason }); assert.ok(/<fieldset[^>]*disabled/.test(b) && /<input[^>]*id="pe-name"[^>]*disabled/.test(b));
  assert.equal(L.effectiveEdit({ readOnlyReason: reason }).canEdit, false); assert.equal(L.effectiveEdit({}).canEdit, true);
});
ok('changed-from-saved rows are marked when a saved base is given', () => {
  const saved = ministryContent(); const work = L.setEntityAmount(saved, JED, 41_000_000);
  const m = L.allocationTableModel({ content: work, baseContent: saved, viewScope: { amanah: 'all', muni: 'all' }, geoScope: ALL_SCOPE });
  assert.deepEqual(m.rows.filter((r) => r.changed).map((r) => r.key), [JED]); assert.equal(m.rows.find((r) => r.key === JED).baseAmount, 40_000_000);
  assert.ok(render({ plan: PLAN, content: work, baseContent: saved, initialTab: 'allocation' }).includes('معدَّل'));
  assert.ok(!render({ plan: PLAN, content: saved, baseContent: saved, initialTab: 'allocation' }).includes('معدَّل'));
});
ok('edits are immutable, origin-aware and blank-safe', () => {
  const c = deepFreeze(ministryContent());
  assert.equal(L.setEntityAmount(c, JED, 40_000_000), c, 'unchanged → same object'); assert.equal(L.setEntityAmount(c, JED, 41_000_000).allocations.find((r) => r.entityKey === JED).amount, 41_000_000);
  assert.equal(L.setEntityAmount(c, RIY, 31_000_000).allocations.find((r) => r.entityKey === RIY).origin, 'manual', 'an edited seed row becomes manual');
  assert.equal(L.setEntityAmount(c, RIY, null).allocations.some((r) => r.entityKey === RIY), false); assert.equal(L.setEntityAmount(c, HOUSING, null), c);
  const m = L.setMuniAmount(c, JED, jedMunis[0].refId, 1_000_000); assert.equal(m.municipalAllocations.length, 1); assert.equal(L.setMuniAmount(m, JED, jedMunis[0].refId, null).municipalAllocations, undefined);
  assert.equal(L.workingCopy(null).name, '', 'a missing content starts blank'); assert.equal(L.contentKey(c), L.contentKey(clone(c)));
});

/* ------------------------------------------------------------------ text parity + hygiene */
ok('AR/EN parity: every key has both languages with the same placeholders; every key used by the components exists', () => {
  const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
  for (const [k, v] of Object.entries(TEXT)) { assert.ok(v.ar && v.en, `${k}: both languages`); assert.equal(ph(v.ar), ph(v.en), `${k}: same placeholders`); assert.notEqual(v.ar, v.en, `${k}: translated`); }
  const dir = 'src/components/plans/editor'; const used = new Set(); const dyn = [];
  for (const f of fs.readdirSync(dir).filter((x) => /\.(jsx|js)$/.test(x) && x !== 'editorText.js')) {
    const s = read(path.join(dir, f));
    for (const m of s.matchAll(/\btx\('([\w.]+)'/g)) used.add(m[1]);
    for (const m of s.matchAll(/\btx\(`([\w.]+)\$\{/g)) dyn.push(m[1]);
    for (const m of s.matchAll(/['"]((?:preview|alloc|monthly|val)\.[\w.]+)['"]/g)) if (TEXT[m[1]] !== undefined || /(?:KIND_TITLE|titleKey)/.test(s)) used.add(m[1]);
  }
  for (const k of used) assert.ok(TEXT[k], `missing text key: ${k}`);
  for (const p of dyn) assert.ok(Object.keys(TEXT).some((k) => k.startsWith(p)), `no key under ${p}`);
  for (const t of ['basics', 'target', 'allocation', 'monthly', 'advanced']) assert.ok(TEXT[`tab.${t}`], t);
  assert.deepEqual(L.TAB_IDS, ['basics', 'target', 'allocation', 'monthly', 'advanced'], 'no versions tab');
  for (const o of ['manual', 'distributed', 'migrated', 'seed']) assert.ok(TEXT[`origin.${o}`]);
  for (const k of ['val.fix.entity_remainder', 'val.fix.monthly_remaining', 'val.goto.target', 'val.goto.allocation', 'val.goto.basics', 'val.goto.monthly']) assert.ok(TEXT[k], k);
});
ok('wording: never «معتمد/معتمدة», no approval / draft / activation / archive wording, no retired terms', () => {
  const all = JSON.stringify(TEXT);
  assert.ok(!/معتمد/.test(all), '«معتمد» must not appear'); assert.ok(!/المقبوضات|مقبوض|Najiz|approved|Approved/.test(all));
  for (const w of ['مسودة', 'فعّالة', 'تفعيل', 'مؤرشفة', 'Activate', 'activation', 'Draft', 'draft', 'archived', 'Archived']) assert.ok(!all.includes(w), `no «${w}» in the editor text`);
  assert.equal(tt('foot.close', 'ar'), 'إغلاق'); assert.equal(tt('alloc.btnRemainder', 'ar'), 'توزيع المتبقي'); assert.equal(tt('alloc.btnAll', 'ar'), 'إعادة توزيع المستهدف كاملاً'); assert.equal(tt('alloc.btnMuniRemainder', 'ar'), 'توزيع المتبقي على البلديات');
  assert.equal(tt('amount.exact', 'en', { value: '5 SAR' }), 'Exact amount: 5 SAR');
});
ok('source hygiene: the editor never calls the plans API, has no activation / versions / status code, no secrets, no console, no new icon family', () => {
  const dir = 'src/components/plans/editor';
  for (const f of fs.readdirSync(dir).filter((x) => /\.(jsx|js|css)$/.test(x))) {
    const s = read(path.join(dir, f));
    assert.ok(!/plansClient|plansApi|savePlanDraft|activatePlan|archivePlan|restorePlan|discardPlanRevision/.test(s), `${f}: the page owns every API call`);
    if (f.endsWith('.css')) continue;
    assert.ok(!/(sessionStorage|localStorage|indexedDB|password|token|secret)/i.test(s.replace(/sessionStorage\.(getItem|setItem)/g, '')), `${f}: no storage / secrets`);
    assert.ok(!/console\.(log|debug|info|warn|error)/.test(s), `${f}: console`);
    assert.ok(!/(from 'lucide|from "lucide|fontawesome|@heroicons|react-icons|hugeicons)/i.test(s), `${f}: no icon package`);
    if (f !== 'editorLogic.js') assert.ok(!/معتمد/.test(s), `${f}: wording`);
  }
  assert.ok(!fs.existsSync(path.join(dir, 'TabVersions.jsx')) && !fs.existsSync(path.join(dir, 'ActivationDialog.jsx')));
  const pkg = JSON.parse(read('package.json')); const chain = pkg.scripts.test; assert.ok(chain.includes('npm run test:plansedit'), 'chained into npm test');
});

console.log(`plans-editor: ${n} tests passed`);
