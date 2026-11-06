// Tests of the pure revenue-plans model (docs/revenue-plans-spec.md §1–§2 and the SIMPLIFIED workflow of §10): planMath, planRules, referenceRules, planAccess, planDefaults.
// Cleanup phase: the activation / duplicate-baseline / overlap / scenario / draft-version rules and the old record shape were removed; their assertions live on as `saveChecks`, the simplified record (`planView`, reference rules) and the §10 block at the end.
// Run with `npm run test:plansmodel`.
import assert from 'node:assert/strict';
import * as M from '../src/data/plans/planMath.js';
import * as R from '../src/data/plans/planRules.js';
import * as REF from '../src/data/plans/referenceRules.js';
import * as A from '../src/data/plans/planAccess.js';
import * as D from '../src/data/plans/planDefaults.js';
import { ALL_SCOPE, EMPTY_SCOPE, entireAmanahGrant, normalizeGeoScope } from '../src/data/geoScope.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { appropriationKeys, appropriationOf, HQ_KEY } from '../src/data/appropriations.js';
import { entityTargetsFull, evenWeights } from '../src/data/plans/legacyStore.js';
import { legacyStoreFixture } from '../src/data/plans/planFixtures.js';

let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { console.error('FAILED:', name); throw e; } n += 1; };
const sum = (a) => a.reduce((t, x) => t + x, 0);
const clone = (x) => JSON.parse(JSON.stringify(x));
const U = R.entityUniverse();
const RIY = 'Riyadh Amanah'; const JED = 'Jeddah Amanah'; const MAK = 'Makkah Amanah'; const HOU = 'Housing Sector';

/* ---------- builders ---------- */
const fy = (y = 2026) => M.fiscalYearPeriod(y);
const content = (o = {}) => R.normalizeContent({ name: 'خطة', scope: { kind: 'ministry' }, period: fy(), target: { amount: 1000 }, allocations: [], distribution: { profile: null }, advanced: {}, ...o });
const complete = (o = {}) => content({ target: { amount: 1000 }, allocations: [{ entityKey: RIY, amount: 600, origin: 'manual' }, { entityKey: JED, amount: 400, origin: 'manual' }], distribution: { profile: 'equal' }, ...o });
let seq = 0;
/** a saved plan record (spec §10: content + internal snapshots; no state, type, working copy or in-force version) */
const plan = (c, { id = null, origin = 'user', isSystem = false, revision = 1 } = {}) => {
  seq += 1; const pid = id || `plan-${String(seq).padStart(8, '0')}`;
  return { id: pid, name: c.name, isSystem, origin, content: c, createdBy: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', lastEditedBy: null, revision, legacy: null, state: 'active',
    versions: [{ n: 1, revision, content: c, savedBy: null, savedAt: '2026-01-01T00:00:00Z' }] };
};
const acts = { actorScope: ALL_SCOPE, readOnly: false };

/* ======================================================================== planMath */
ok('planMath: month rows — a whole year, 12 rows, 365 days, each fraction 1', () => {
  const rows = M.monthRows(fy(2026)); assert.equal(rows.length, 12); assert.equal(sum(rows.map((r) => r.days)), 365);
  assert.ok(rows.every((r) => r.fraction === 1 && !r.partial)); assert.equal(rows[1].end, '2026-02-28'); assert.equal(M.monthRows(fy(2028))[1].end, '2028-02-29');
});
ok('planMath: Oct-15 → Dec-31 range — 3 month rows, first one partial (17/31)', () => {
  const rows = M.monthRows({ start: '2026-10-15', end: '2026-12-31', preset: 'range' }); assert.deepEqual(rows.map((r) => r.ym), ['2026-10', '2026-11', '2026-12']);
  assert.equal(rows[0].days, 17); assert.equal(rows[0].start, '2026-10-15'); assert.ok(rows[0].partial && !rows[1].partial && !rows[2].partial); assert.ok(Math.abs(rows[0].fraction - 17 / 31) < 1e-12);
});
ok('planMath: a one-day period is one row of one day; an invalid period gives no rows', () => {
  const rows = M.monthRows({ start: '2026-05-03', end: '2026-05-03' }); assert.equal(rows.length, 1); assert.equal(rows[0].days, 1); assert.equal(M.periodDays({ start: '2026-05-03', end: '2026-05-03' }), 1);
  assert.deepEqual(M.monthRows({ start: '2026-05-04', end: '2026-05-03' }), []); assert.equal(M.periodValid({ start: '2026-02-30', end: '2026-03-01' }), false);
});
ok('planMath: apportion — Σ exact for many totals/weights, never negative, remainder reported and bounded', () => {
  for (const total of [0, 1, 7, 100, 999, 1000003, 123456789012]) for (const w of [[1, 1, 1], [3, 2, 1], [0, 5, 5], [1e9, 7, 13, 99], Array(12).fill(1 / 12)]) {
    const ap = M.apportion(total, w); assert.equal(sum(ap.amounts), total, `${total} over ${w}`); assert.ok(ap.amounts.every((x) => Number.isInteger(x) && x >= 0)); assert.ok(ap.remainder.units < w.length); assert.equal(ap.remainder.rows.length, ap.remainder.units);
  }
});
ok('planMath: rounding remainder — 100 over three equal rows → 34/33/33, one riyal to the first row (ties → lower index)', () => {
  const ap = M.apportion(100, [1, 1, 1]); assert.deepEqual(ap.amounts, [34, 33, 33]); assert.deepEqual(ap.remainder, { units: 1, rows: [0] });
  const b = M.apportion(10, [1, 1, 1, 1, 1, 1]); assert.equal(sum(b.amounts), 10); assert.equal(b.remainder.units, 4);
  const z = M.apportion(50, [0, 0]); assert.equal(z.ok, false); assert.deepEqual(z.amounts, [0, 0]);
});
ok('planMath: equal weights for a 12-month year are exactly 1/12 each (and a partial first month weighs its day fraction)', () => {
  const rows = M.monthRows(fy()); const w = M.distributionWeights({ profile: 'equal' }, rows); assert.ok(w.every((x) => x === 1)); const ap = M.apportion(1200, w); assert.ok(ap.amounts.every((x) => x === 100));
  assert.equal(sum(M.apportion(1000, w).amounts), 1000);
  const r2 = M.monthRows({ start: '2026-11-16', end: '2026-12-31' }); const w2 = M.distributionWeights({ profile: 'equal' }, r2); assert.ok(Math.abs(w2[0] - 15 / 30) < 1e-12 && w2[1] === 1);
});
ok('planMath: manual weights — total/remaining/complete, missing month = 0', () => {
  const rows = M.monthRows({ start: '2026-01-01', end: '2026-03-31' });
  assert.deepEqual(M.weightsTotal({ profile: 'manual', weights: { '2026-01': 5000, '2026-02': 3000 } }, rows), { total: 8000, remaining: 2000, complete: false });
  assert.equal(M.weightsTotal({ profile: 'manual', weights: { '2026-01': 5000, '2026-02': 3000, '2026-03': 2000 } }, rows).complete, true);
});
ok('planMath: plannedTo — before the start 0, inside a month in proportion to the period days, after the end everything', () => {
  const rows = M.monthRows({ start: '2026-10-15', end: '2026-12-31' }); const amounts = [170, 300, 310];
  assert.equal(M.plannedTo(amounts, rows, '2026-10-14'), 0); assert.equal(M.plannedTo(amounts, rows, '2026-10-15'), 10); assert.equal(M.plannedTo(amounts, rows, '2026-10-31'), 170);
  assert.equal(M.plannedTo(amounts, rows, '2026-11-15'), 170 + 150); assert.equal(M.plannedTo(amounts, rows, '2026-12-31'), 780); assert.equal(M.plannedTo(amounts, rows, '2027-06-01'), 780);
});
ok('planMath: planMonthly — entities reconcile to the plan by construction; entity override used; no allocations → target apportioned', () => {
  const c = complete({ entityDistributions: { [RIY]: { profile: 'manual', weights: Object.fromEntries(M.monthRows(fy()).map((r) => [r.ym, r.ym === '2026-12' ? 10000 : 0])) } } });
  const pm = M.planMonthly(c, c.period); assert.equal(pm.entities[RIY][11], 600); assert.equal(sum(pm.plan), 1000); assert.ok(pm.complete);
  const e = M.planMonthly(content({ target: { amount: 1000 } }), fy()); assert.equal(sum(e.plan), 1000); assert.equal(e.complete, false);
});
ok('planMath: calendar-year helpers and overlap/identical period', () => {
  assert.ok(M.isCalendarYear(fy())); assert.ok(!M.isCalendarYear({ start: '2026-01-01', end: '2026-06-30' })); assert.ok(M.periodsOverlap(fy(), { start: '2026-12-31', end: '2027-02-01' })); assert.ok(!M.periodsOverlap(fy(), { start: '2027-01-01', end: '2027-02-01' }));
  assert.ok(M.samePeriod(fy(), { start: '2026-01-01', end: '2026-12-31', preset: 'range' }));
});

/* ======================================================================== content */
ok('content: emptyContent has NO rows, no profile, no target, the Jan–Dec preset', () => {
  const c = R.emptyContent({ name: ' س ', year: 2026 }); assert.equal(c.name, 'س'); assert.deepEqual(c.allocations, []); assert.equal(c.target.amount, null); assert.equal(c.distribution.profile, null); assert.deepEqual(c.period, { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' });
  assert.equal(R.emptyContent({ period: { start: '2026-10-15', end: '2026-12-31', preset: 'fiscal-year' } }).period.preset, 'range'); // fiscal-year only for a whole calendar year
});
ok('content: normalizeContent — integer riyals, trims, drops unknown fields, dedupes scope keys, does not mutate', () => {
  const raw = { name: '  اسم  ', evil: 1, scope: { kind: 'entities', entityKeys: [` ${RIY} `, RIY, JED], x: 1 }, period: { start: '2026-01-01', end: '2026-12-31' }, target: { amount: '1000.6', junk: 1, basis: { method: 'budget_x_coverage', coverage: 0.66, budget: 1500.4, at: 'now', evil: 1 } },
    allocations: [{ entityKey: ` ${RIY}`, amount: 99.5, origin: 'hack', note: ' n ', zzz: 1 }, { entityKey: JED, amount: 'abc' }], distribution: { profile: 'manual', weights: { '2026-01': 1000.4, bad: 5, '2026-02': 'x' }, junk: 1 }, advanced: { collectionRate: 0.7, billingTarget: 1234.5, junk: 1 } };
  const snap = clone(raw); const c = R.normalizeContent(raw); assert.deepEqual(raw, snap);
  assert.equal(c.name, 'اسم'); assert.deepEqual(c.scope, { kind: 'entities', entityKeys: [RIY, JED] }); assert.equal(c.target.amount, 1001); assert.deepEqual(c.target.basis, { method: 'budget_x_coverage', coverage: 0.66, budget: 1500, at: 'now' });
  assert.deepEqual(c.allocations, [{ entityKey: RIY, amount: 100, origin: 'manual', note: 'n' }, { entityKey: JED, amount: 0, origin: 'manual' }]); assert.deepEqual(c.distribution, { profile: 'manual', weights: { '2026-01': 1000, '2026-02': 0 } });
  assert.deepEqual(c.advanced, { collectionRate: 0.7, billingTarget: 1235 }); assert.ok(!('evil' in c) && !('junk' in c.target)); assert.ok(Object.values(c.allocations).every((a) => !('zzz' in a)));
  assert.deepEqual(R.normalizeContent(R.normalizeContent(raw)), c); // idempotent
});
ok('content: an unrecognised scope never widens into the Ministry; a non-array / null input is safe', () => {
  assert.deepEqual(R.normalizeContent({ scope: { kind: 'all' } }).scope, { kind: 'entities', entityKeys: [] }); assert.doesNotThrow(() => R.normalizeContent(null)); assert.deepEqual(R.normalizeContent(null).allocations, []);
});

/* ======================================================================== planView */
ok('planView: the saved content (versionId <id>@r<revision>), an internal snapshot by number (<id>@s<n>, historical once superseded), no working copy, never a draft / archived flag; a view is a copy', () => {
  const c1 = complete({ name: 'أ' }); const c2 = complete({ name: 'ب' });
  const p = plan(c2, { id: 'plan-aaaaaaaa', revision: 2 }); p.versions = [{ n: 1, revision: 1, content: c1, savedBy: null, savedAt: 'x' }, { n: 2, revision: 2, content: c2, savedBy: null, savedAt: 'y' }];
  const v = R.planView(p); assert.equal(v.versionId, 'plan-aaaaaaaa@r2'); assert.equal(v.versionNumber, 2); assert.equal(v.name, 'ب'); assert.ok(!v.isHistorical); assert.deepEqual(['isDraft', 'isArchived', 'type', 'scenarioOf'].filter((k) => k in v), [], 'no draft / archived / type / scenario fields'); assert.equal(v.state, 'active'); assert.deepEqual(v.period, c2.period);
  const old = R.planView(p, 1); assert.equal(old.versionId, 'plan-aaaaaaaa@s1'); assert.ok(old.isHistorical); assert.equal(old.name, 'أ'); assert.equal(R.planView(p, 2).isHistorical, false);
  assert.equal(R.planView(p, 'working'), null, 'the working copy lives in the client only'); assert.equal(R.planView(p, 9), null); assert.equal(R.planView(null), null); assert.equal(R.planView({ id: 'x', versions: [] }), null, 'an unknown record shape has no view');
  v.content.name = 'تعديل'; assert.equal(p.content.name, 'ب'); // a view is a copy
});
/* ======================================================================== validateDraft */
const codes = (r) => r.errors.map((e) => e.code);
ok('validateDraft: a half-finished draft is VALID (no target, unallocated, months ≠ 100 %, no profile, excess)', () => {
  assert.equal(R.validateDraft(R.emptyContent({ name: 'x' })).ok, true);
  assert.equal(R.validateDraft(content({ target: { amount: 100 }, allocations: [{ entityKey: RIY, amount: 5000 }], distribution: { profile: 'manual', weights: { '2026-01': 100 } } })).ok, true);
});
ok('validateDraft: hard errors — dates, unknown entity, negative / non-numeric amounts and weights, duplicate rows, month outside the period', () => {
  assert.ok(codes(R.validateDraft({ ...complete(), period: { start: '2026-13-01', end: '2026-12-31' } })).includes('period_invalid_start'));
  assert.ok(codes(R.validateDraft({ ...complete(), period: { start: '2026-12-31', end: '2026-01-01' } })).includes('period_end_before_start'));
  assert.ok(codes(R.validateDraft({ ...complete(), scope: { kind: 'entities', entityKeys: ['Nowhere Amanah'] } })).includes('unknown_entity'));
  assert.ok(codes(R.validateDraft({ ...complete(), scope: { kind: 'entities', entityKeys: [HQ_KEY] } })).includes('unknown_entity')); // the headquarters is not a plan entity
  assert.ok(codes(R.validateDraft({ ...complete(), allocations: [{ entityKey: 'Nowhere', amount: 1 }] })).includes('unknown_entity'));
  assert.ok(codes(R.validateDraft({ ...complete(), target: { amount: -1 } })).includes('invalid_amount')); assert.ok(codes(R.validateDraft({ ...complete(), target: { amount: 'abc' } })).includes('invalid_amount'));
  assert.ok(codes(R.validateDraft({ ...complete(), allocations: [{ entityKey: RIY, amount: -5 }] })).includes('invalid_amount')); assert.ok(codes(R.validateDraft({ ...complete(), allocations: [{ entityKey: RIY, amount: 'x' }] })).includes('invalid_amount'));
  assert.ok(codes(R.validateDraft({ ...complete(), allocations: [{ entityKey: RIY, amount: 1 }, { entityKey: RIY, amount: 2 }] })).includes('duplicate_allocation'));
  assert.ok(codes(R.validateDraft({ ...complete(), distribution: { profile: 'manual', weights: { '2026-01': -3 } } })).includes('invalid_weight')); assert.ok(codes(R.validateDraft({ ...complete(), distribution: { profile: 'manual', weights: { '2026-01': 'x' } } })).includes('invalid_weight'));
  const o = R.validateDraft({ ...complete(), distribution: { profile: 'manual', weights: { '2027-01': 100 } } }); assert.ok(codes(o).includes('month_outside_period')); assert.equal(o.errors[0].params.ym, '2027-01');
  assert.ok(codes(R.validateDraft({ ...complete(), entityDistributions: { [RIY]: { profile: 'manual', weights: { '2025-12': 1 } } } })).includes('month_outside_period'));
  assert.ok(codes(R.validateDraft({ ...complete(), advanced: { collectionRate: 1.5 } })).includes('invalid_collection_rate')); assert.ok(codes(R.validateDraft({ ...complete(), advanced: { billingTarget: -1 } })).includes('invalid_amount'));
  const e = R.validateDraft({ ...complete(), target: { amount: -1 } }).errors[0]; assert.ok(e.path && e.ar && e.en && e.params);
});
ok('validateDraft: scope outside the actor\'s authority and read-only roles are hard errors', () => {
  const ent = complete({ scope: { kind: 'entities', entityKeys: [RIY] }, allocations: [{ entityKey: RIY, amount: 1000 }] });
  assert.ok(codes(R.validateDraft(ent, { actorScope: normalizeGeoScope({ grants: [entireAmanahGrant(JED)] }) })).includes('scope_forbidden'));
  assert.ok(R.validateDraft(ent, { actorScope: normalizeGeoScope({ grants: [entireAmanahGrant(RIY)] }) }).ok);
  assert.ok(codes(R.validateDraft(complete(), { actorScope: normalizeGeoScope({ grants: [entireAmanahGrant(RIY)] }) })).includes('scope_forbidden')); // Ministry needs all-entities access
  assert.ok(codes(R.validateDraft(ent, { actorScope: ALL_SCOPE, readOnly: true })).includes('read_only_role'));
  assert.ok(R.validateDraft(complete()).ok); // no ctx → no authority check (the server always passes one)
});

/* ======================================================================== activation */
const failedOf = (r) => r.failed;
ok('saveChecks: always one entry per rule, in order — no type and no duplicate-baseline rule exists', () => {
  const r = R.saveChecks(R.emptyContent({}), acts); assert.deepEqual(r.checks.map((c) => c.id), R.BASE_SAVE_CHECK_IDS); assert.equal(R.BASE_SAVE_CHECK_IDS.length, 6); assert.deepEqual(R.SAVE_CHECK_IDS, [...R.BASE_SAVE_CHECK_IDS, 'municipal_within_entity']); assert.ok(!r.checks.some((c) => ['type_baseline', 'no_duplicate_active_baseline'].includes(c.id))); /* the 9th appears only with municipal rows (tests/plans-municipal.test.mjs) */ assert.ok(r.checks.every((c) => c.label.ar && c.label.en && typeof c.ok === 'boolean' && c.params));
});
ok('saveChecks: a complete baseline passes everything', () => { const r = R.saveChecks(complete(), acts); assert.equal(r.ok, true, JSON.stringify(failedOf(r))); assert.deepEqual(r.failed, []); });
ok('saveChecks: target > 0', () => { assert.deepEqual(failedOf(R.saveChecks(content({ target: { amount: 0 } }), acts)).includes('target_positive'), true); assert.ok(failedOf(R.saveChecks(content({ target: { amount: null } }), acts)).includes('target_positive')); });
ok('saveChecks: allocated = target to the riyal (unallocated / excess reported)', () => {
  const lo = R.saveChecks(complete({ allocations: [{ entityKey: RIY, amount: 600 }, { entityKey: JED, amount: 399 }] }), acts); assert.ok(lo.failed.includes('allocation_complete')); assert.equal(lo.checks[1].params.unallocated, 1); assert.equal(lo.checks[1].params.excess, 0);
  const hi = R.saveChecks(complete({ allocations: [{ entityKey: RIY, amount: 601 }, { entityKey: JED, amount: 400 }] }), acts); assert.ok(hi.failed.includes('allocation_complete')); assert.equal(hi.checks[1].params.excess, 1);
  assert.ok(R.saveChecks(content({ target: { amount: 1000 } }), acts).failed.includes('allocation_complete')); // no rows = unallocated = target
});
ok('saveChecks: allocations inside the scope (and a non-empty entity scope)', () => {
  const r = R.saveChecks(complete({ scope: { kind: 'entities', entityKeys: [RIY] } }), acts); assert.ok(r.failed.includes('allocations_in_scope')); assert.deepEqual(r.checks[2].params.outside, [JED]);
  assert.ok(R.saveChecks(complete({ scope: { kind: 'entities', entityKeys: [] } }), acts).failed.includes('allocations_in_scope'));
  assert.ok(!R.saveChecks(complete({ scope: { kind: 'entities', entityKeys: [RIY, JED] } }), acts).failed.includes('allocations_in_scope'));
});
ok('saveChecks: an explicit profile is required (also for entity overrides)', () => {
  assert.ok(R.saveChecks(complete({ distribution: { profile: null } }), acts).failed.includes('profile_explicit'));
  assert.ok(!R.saveChecks(complete({ distribution: { profile: 'equal' } }), acts).failed.includes('profile_explicit'));
  assert.ok(R.saveChecks(complete({ period: { start: null, end: null } }), acts).failed.includes('profile_explicit')); // no usable months
});
ok('saveChecks: manual months exactly 10 000 bp, including entity overrides', () => {
  const rows = M.monthRows(fy()); const w = (total) => { const ap = M.apportion(total, rows.map(() => 1)); return Object.fromEntries(rows.map((r, i) => [r.ym, ap.amounts[i]])); };
  assert.ok(!R.saveChecks(complete({ distribution: { profile: 'manual', weights: w(10000) } }), acts).failed.includes('months_complete'));
  const short = R.saveChecks(complete({ distribution: { profile: 'manual', weights: w(9999) } }), acts); assert.ok(short.failed.includes('months_complete')); assert.equal(short.checks[4].params.incomplete[0].remaining, 1);
  assert.ok(R.saveChecks(complete({ distribution: { profile: 'manual', weights: w(10001) } }), acts).failed.includes('months_complete'));
  const ov = R.saveChecks(complete({ distribution: { profile: 'equal' }, entityDistributions: { [RIY]: { profile: 'manual', weights: w(9000) } } }), acts); assert.ok(ov.failed.includes('months_complete')); assert.equal(ov.checks[4].params.incomplete[0].entityKey, RIY);
  assert.ok(!R.saveChecks(complete({ distribution: { profile: 'equal' }, entityDistributions: { [RIY]: { profile: 'manual', weights: w(10000) } } }), acts).failed.includes('months_complete'));
});
ok('saveChecks: the actor must be authorised (all-scope / whole-Amanah / municipal / read-only)', () => {
  const ent = complete({ scope: { kind: 'entities', entityKeys: [RIY] }, allocations: [{ entityKey: RIY, amount: 1000 }] });
  assert.equal(R.saveChecks(ent, { actorScope: normalizeGeoScope({ grants: [entireAmanahGrant(RIY)] }) }).ok, true);
  assert.deepEqual(R.saveChecks(ent, { actorScope: normalizeGeoScope({ grants: [entireAmanahGrant(JED)] }) }).failed, ['actor_authorised']);
  assert.deepEqual(R.saveChecks(ent, { actorScope: ALL_SCOPE, readOnly: true }).failed, ['actor_authorised']);
  assert.deepEqual(R.saveChecks(ent, {}).failed, ['actor_authorised']); // unknown actor → not authorised (fail safe)
  assert.equal(R.saveChecks(ent, { actorScope: ALL_SCOPE, readOnly: true }).checks[5].params.reason, 'read_only_role');
});

/* ======================================================================== allocation */
ok('allocationSummary: target / allocated / unallocated / excess / complete / share', () => {
  let s = R.allocationSummary(complete()); assert.deepEqual([s.target, s.allocated, s.unallocated, s.excess, s.complete], [1000, 1000, 0, 0, true]); assert.deepEqual(s.rows.map((r) => r.share), [0.6, 0.4]);
  s = R.allocationSummary(complete({ allocations: [{ entityKey: RIY, amount: 1100 }] })); assert.deepEqual([s.unallocated, s.excess, s.complete], [0, 100, false]);
  s = R.allocationSummary(content({ target: { amount: 1000 }, allocations: [] })); assert.deepEqual([s.unallocated, s.excess, s.complete, s.count], [1000, 0, false, 0]);
  s = R.allocationSummary(R.emptyContent({})); assert.equal(s.hasTarget, false); assert.equal(s.rows.length, 0);
});

const base3 = (o = {}) => content({ scope: { kind: 'entities', entityKeys: [RIY, JED, MAK] }, target: { amount: 1000 }, allocations: [], ...o });
ok('distributeRemainder (equal): a new plan has NO rows; the preview lists EVERY changed row, unallocated before/after and the rounding remainder; nothing is changed until apply', () => {
  const c = base3(); const snap = clone(c);
  const p = R.previewDistributeRemainder(c, { basis: 'equal' }); assert.equal(p.ok, true); assert.deepEqual(c, snap); assert.equal(p.mode, 'remainder');
  assert.deepEqual(p.rows.map((r) => [r.entityKey, r.before, r.after, r.delta]), [[RIY, 0, 334, 334], [JED, 0, 333, 333], [MAK, 0, 333, 333]]);
  assert.equal(p.unallocatedBefore, 1000); assert.equal(p.unallocatedAfter, 0); assert.deepEqual(p.remainder, { units: 1, rows: [RIY] }); assert.equal(p.pool, 1000);
  const a = R.applyDistributionPreview(c, p); assert.ok(a.ok); assert.deepEqual(a.content.allocations.map((x) => [x.entityKey, x.amount, x.origin]), [[RIY, 334, 'distributed'], [JED, 333, 'distributed'], [MAK, 333, 'distributed']]);
  assert.equal(R.allocationSummary(a.content).complete, true); assert.deepEqual(c, snap);
});
ok('distributeRemainder: default fills only EMPTY rows; a row holding an amount never changes unless ticked in; manual rows stay', () => {
  const c = base3({ allocations: [{ entityKey: RIY, amount: 500, origin: 'manual' }] });
  const p = R.previewDistributeRemainder(c, { basis: 'equal' }); assert.deepEqual(p.rows.map((r) => r.entityKey), [JED, MAK]); assert.deepEqual(p.rows.map((r) => r.after), [250, 250]); assert.deepEqual(p.manualUntouched, [RIY]);
  const a = R.applyDistributionPreview(c, p).content; assert.equal(a.allocations.find((x) => x.entityKey === RIY).amount, 500); assert.equal(a.allocations.find((x) => x.entityKey === RIY).origin, 'manual');
  const t = R.previewDistributeRemainder(c, { basis: 'equal', rows: [RIY, JED] }); // RIY ticked in: it receives a share ON TOP of its amount
  assert.deepEqual(t.rows.map((r) => [r.entityKey, r.before, r.after]), [[RIY, 500, 750], [JED, 0, 250]]); assert.ok(!t.rows.some((r) => r.entityKey === MAK));
});
ok('distributeRemainder (appropriation): shares of the revenue appropriation, Σ exact, remainder shown; (proportional): to current amounts', () => {
  const c = base3(); const p = R.previewDistributeRemainder(c, { basis: 'appropriation' }); assert.ok(p.ok);
  const w = [RIY, JED, MAK].map((k) => appropriationOf(k).revAdjusted); const exp = M.apportion(1000, w).amounts; assert.deepEqual(p.rows.map((r) => r.after), exp); assert.equal(sum(p.rows.map((r) => r.delta)), 1000);
  const pc = base3({ allocations: [{ entityKey: RIY, amount: 100 }, { entityKey: JED, amount: 300 }], target: { amount: 1000 } });
  const pp = R.previewDistributeRemainder(pc, { basis: 'proportional', rows: [RIY, JED] }); assert.deepEqual(pp.rows.map((r) => [r.before, r.after]), [[100, 100 + 150], [300, 300 + 450]]); assert.equal(pp.unallocatedAfter, 0);
  assert.equal(R.previewDistributeRemainder(base3(), { basis: 'proportional' }).code, 'no_current_amounts');
});
ok('distributeRemainder: refusals are coded (no target, nothing to distribute, no rows, bad basis, no budget data)', () => {
  assert.equal(R.previewDistributeRemainder(content({ scope: { kind: 'entities', entityKeys: [RIY] }, target: { amount: null } }), { basis: 'equal' }).code, 'no_target');
  assert.equal(R.previewDistributeRemainder(complete(), { basis: 'equal' }).code, 'no_remainder');
  assert.equal(R.previewDistributeRemainder(base3({ allocations: [{ entityKey: RIY, amount: 1 }, { entityKey: JED, amount: 1 }, { entityKey: MAK, amount: 1 }], target: { amount: 1000 } }), { basis: 'equal' }).code, 'no_rows');
  assert.equal(R.previewDistributeRemainder(base3(), { basis: 'weird' }).code, 'invalid_basis');
  assert.equal(R.previewDistributeRemainder(base3({ period: fy(2030) }), { basis: 'appropriation' }).code, 'no_budget_data'); // another year → no budget data
  assert.ok(R.previewDistributeRemainder(base3({ period: fy(2030) }), { basis: 'equal' }).ok);
});
ok('redistributeAll: replaces the chosen rows, leaves unchosen rows (the pool shrinks), refuses when they already exceed the target; stale previews are refused on apply', () => {
  const c = base3({ allocations: [{ entityKey: RIY, amount: 900, origin: 'manual' }, { entityKey: JED, amount: 50 }, { entityKey: MAK, amount: 50 }] });
  const all = R.previewRedistributeAll(c, { basis: 'equal' }); assert.ok(all.ok); assert.deepEqual(all.rows.map((r) => r.after), [334, 333, 333]); assert.equal(all.unallocatedAfter, 0); assert.equal(all.mode, 'all');
  const some = R.previewRedistributeAll(c, { basis: 'equal', rows: [JED, MAK] }); assert.equal(some.pool, 100); assert.deepEqual(some.rows, []); // 50 → 50: unchanged rows are not listed
  assert.deepEqual(some.unchanged, [JED, MAK]);
  const some2 = R.previewRedistributeAll(base3({ allocations: [{ entityKey: RIY, amount: 800 }, { entityKey: JED, amount: 150 }, { entityKey: MAK, amount: 50 }] }), { basis: 'equal', rows: [JED, MAK] }); assert.equal(some2.pool, 200); assert.deepEqual(some2.rows.map((r) => [r.entityKey, r.before, r.after]), [[JED, 150, 100], [MAK, 50, 100]]);
  assert.equal(R.previewRedistributeAll(base3({ allocations: [{ entityKey: RIY, amount: 1200 }] }), { basis: 'equal', rows: [JED] }).code, 'rows_exceed_target');
  const changed = clone(c); changed.allocations[0].amount = 1; assert.equal(R.applyDistributionPreview(changed, all).code, 'stale_preview'); assert.equal(R.applyDistributionPreview(c, { ok: false }).ok, false);
  assert.ok(all.remainder.units === 1 && all.remainder.rows[0] === RIY);
});
ok('distribute (Ministry scope): rows are the 18 entities, the headquarters never appears; rows outside the scope are not offered', () => {
  const c = content({ target: { amount: 18_000_000_001 } }); const p = R.previewDistributeRemainder(c, { basis: 'appropriation' });
  assert.ok(p.ok); assert.equal(p.rows.length, U.length); assert.ok(!p.rows.some((r) => r.entityKey === HQ_KEY)); assert.equal(sum(p.rows.map((r) => r.after)), 18_000_000_001); assert.equal(p.remainder.rows.every((k) => U.includes(k)), true);
  assert.equal(R.previewDistributeRemainder(base3(), { basis: 'equal', rows: [HOU] }).code, 'no_rows');
});

/* ======================================================================== monthly distribution */
ok('distributionSummary: equal — labelled «توزيع متساوٍ — افتراض», 12 × 1/12, amounts exact incl. remainder', () => {
  const s = R.distributionSummary(complete({ target: { amount: 1000 } })); assert.equal(s.profile, 'equal'); assert.equal(s.label.ar, 'توزيع متساوٍ — افتراض'); assert.equal(s.totalBp, 10000); assert.equal(s.complete, true); assert.equal(s.months.length, 12);
  assert.ok(Math.abs(s.months[0].pct - 100 / 12) < 1e-9); assert.equal(sum(s.months.map((m) => m.amount)), 1000); assert.equal(s.remainder.units, 1000 - 12 * 83);
  const e = R.distributionSummary(complete(), { entityKey: RIY }); assert.equal(sum(e.months.map((m) => m.amount)), 600); assert.equal(e.overridden, false);
});
ok('distributionSummary: manual — total bp, remaining, excess, per-month pct+amount; never normalised', () => {
  const c = complete({ target: { amount: 10000 }, allocations: [{ entityKey: RIY, amount: 10000 }], distribution: { profile: 'manual', weights: { '2026-01': 5000, '2026-02': 2500 } } });
  let s = R.distributionSummary(c); assert.equal(s.label, null); assert.equal(s.totalBp, 7500); assert.equal(s.remainingBp, 2500); assert.equal(s.excessBp, 0); assert.equal(s.complete, false);
  assert.deepEqual([s.months[0].pct, s.months[0].amount, s.months[1].amount, s.months[2].amount], [50, 5000, 2500, 0]); assert.equal(s.distributedAmount, 7500);
  s = R.distributionSummary({ ...c, distribution: { profile: 'manual', weights: { '2026-01': 7000, '2026-02': 4000 } } }); assert.equal(s.excessBp, 1000); assert.equal(s.remainingBp, 0);
  const none = R.distributionSummary(R.emptyContent({})); assert.equal(none.profile, null); assert.equal(none.remainingBp, 10000); assert.equal(none.months.length, 12);
  const ov = R.distributionSummary({ ...c, entityDistributions: { [RIY]: { profile: 'equal' } } }, { entityKey: RIY }); assert.equal(ov.overridden, true); assert.equal(ov.profile, 'equal');
});
ok('previewMonthlyDistribute remaining: the missing basis points go equally to the chosen months; shown before/after; remainder; excess refused', () => {
  const c = complete({ distribution: { profile: 'manual', weights: { '2026-01': 4000, '2026-02': 4000 } } });
  const p = R.previewMonthlyDistribute(c, { mode: 'remaining', months: ['2026-03', '2026-04', '2026-05'] }); assert.ok(p.ok); assert.equal(p.totalBefore, 8000); assert.equal(p.remainingBefore, 2000); assert.equal(p.remainingAfter, 0); assert.equal(p.totalAfter, 10000);
  assert.deepEqual(p.rows.map((r) => [r.ym, r.before, r.after, r.delta]), [['2026-03', 0, 667, 667], ['2026-04', 0, 667, 667], ['2026-05', 0, 666, 666]]); assert.deepEqual(p.remainder, { units: 2, months: ['2026-03', '2026-04'] });
  const a = R.applyMonthlyPreview(c, p); assert.ok(a.ok); assert.equal(a.content.distribution.profile, 'manual'); assert.equal(M.weightsTotal(a.content.distribution, M.monthRows(c.period)).complete, true); assert.equal(c.distribution.weights['2026-03'], undefined);
  const dflt = R.previewMonthlyDistribute(c, { mode: 'remaining' }); assert.equal(dflt.chosen.length, 10); // default = months with no weight
  assert.equal(R.previewMonthlyDistribute(complete({ distribution: { profile: 'manual', weights: { '2026-01': 10500 } } }), { mode: 'remaining' }).code, 'no_remaining');
  const overs = R.previewMonthlyDistribute(complete({ distribution: { profile: 'manual', weights: { '2026-01': 12000 } } }), { mode: 'remaining', months: ['2026-02'] }); assert.equal(overs.ok, false);
});
ok('previewMonthlyDistribute equal: chosen months share 10 000 minus the months left out; all months → exactly 12 shares summing to 10 000', () => {
  const c = complete({ distribution: { profile: 'manual', weights: { '2026-12': 2000 } } });
  const p = R.previewMonthlyDistribute(c, { mode: 'equal', months: M.monthRows(fy()).slice(0, 11).map((r) => r.ym) }); assert.ok(p.ok); assert.equal(p.totalAfter, 10000); assert.equal(p.allRows.find((r) => r.ym === '2026-12').after, 2000); assert.equal(sum(p.allRows.slice(0, 11).map((r) => r.after)), 8000);
  const all = R.previewMonthlyDistribute(complete(), { mode: 'equal' }); assert.equal(all.totalAfter, 10000); assert.equal(all.remainder.units, 10000 - 12 * 833); assert.deepEqual(all.allRows.map((r) => r.after).sort().slice(0, 1), [833]);
  const bad = R.previewMonthlyDistribute(c, { mode: 'equal', months: ['2026-01'] }); assert.equal(bad.totalAfter, 10000); assert.equal(bad.allRows[0].after, 8000);
  assert.equal(R.previewMonthlyDistribute(c, { mode: 'equal', months: [] }).code, 'no_months'); assert.equal(R.previewMonthlyDistribute(c, { mode: 'nope' }).code, 'invalid_mode');
  assert.equal(R.previewMonthlyDistribute(R.emptyContent({ period: { start: '2026-02-01', end: '2026-01-01' } }), { mode: 'equal' }).code, 'no_period');
});
ok('monthly actions on an entity override; a stale monthly preview is refused', () => {
  const c = complete(); const p = R.previewMonthlyDistribute(c, { mode: 'equal', months: ['2026-01', '2026-02'], entityKey: RIY }); const a = R.applyMonthlyPreview(c, p); assert.ok(a.ok);
  assert.deepEqual(a.content.entityDistributions[RIY].weights['2026-01'], 5000); assert.equal(a.content.distribution.profile, 'equal'); // the plan's own distribution is untouched
  const moved = clone(c); moved.entityDistributions = { [RIY]: { profile: 'manual', weights: { '2026-01': 1 } } }; assert.equal(R.applyMonthlyPreview(moved, p).code, 'stale_preview');
});
ok('range period: partial months make the equal summary day-weighted (Oct-15 → Dec-31)', () => {
  const c = content({ period: { start: '2026-10-15', end: '2026-12-31', preset: 'range' }, target: { amount: 1000 }, allocations: [{ entityKey: RIY, amount: 1000 }], distribution: { profile: 'equal' } }); const s = R.distributionSummary(c);
  assert.equal(s.months.length, 3); assert.ok(s.months[0].pct < s.months[1].pct); assert.equal(sum(s.months.map((m) => m.amount)), 1000); assert.ok(Math.abs(sum(s.months.map((m) => m.pct)) - 100) < 1e-9);
});

/* ======================================================================== differences */
ok('allocationDifferences: per-entity difference shown, nothing reconciled or replaced', () => {
  const ref = R.planView(plan(complete({ allocations: [{ entityKey: RIY, amount: 700 }, { entityKey: JED, amount: 300 }] })));
  const ent = R.planView(plan(complete({ scope: { kind: 'entities', entityKeys: [RIY, MAK] }, target: { amount: 900 }, allocations: [{ entityKey: RIY, amount: 500 }, { entityKey: MAK, amount: 400 }] })));
  const refSnap = clone(ref); const d = R.allocationDifferences(ent, ref);
  assert.deepEqual(d.rows, [{ entityKey: RIY, entityPlan: 500, reference: 700, difference: -200 }, { entityKey: MAK, entityPlan: 400, reference: null, difference: null }]); assert.equal(d.entityPlanTotal, 900); assert.equal(d.referenceTotal, 700); assert.equal(d.difference, -200); assert.deepEqual(ref, refSnap); assert.ok(d.note.ar);
  assert.equal(R.allocationDifferences(ent, null).rows[0].reference, null);
});

/* ======================================================================== masking */
ok('maskPlanForViewer: only visible allocations, target = visible Σ with the label, no advanced / basis / legacy; the original is untouched; fully visible plans pass unchanged', () => {
  const c = complete({ target: { amount: 1000, basis: { method: 'budget_x_coverage', coverage: 0.66, budget: 1500, at: null } }, advanced: { collectionRate: 0.7, billingTarget: 5 }, entityDistributions: { [RIY]: { profile: 'equal' }, [JED]: { profile: 'equal' } } });
  const p = plan(c); p.legacy = { owner: 'x' }; const snap = clone(p);
  const m = R.maskPlanForViewer(p, [RIY]); assert.deepEqual(p, snap); const mc = m.versions[0].content;
  assert.deepEqual(mc.allocations.map((a) => a.entityKey), [RIY]); assert.equal(mc.target.amount, 600); assert.equal(mc.target.label.ar, 'إجمالي الجهات المتاحة لك'); assert.equal(mc.target.masked, true); assert.ok(!('basis' in mc.target)); assert.deepEqual(mc.advanced, {});
  assert.deepEqual(Object.keys(mc.entityDistributions), [RIY]); assert.equal(m.masked, true); assert.deepEqual(m.visibleEntityKeys, [RIY]); assert.equal(m.legacy, null);
  assert.equal(R.planView(m).content.target.amount, 600);
  const full = R.maskPlanForViewer(p, U); assert.equal(full.masked, undefined); assert.equal(full.versions[0].content.target.amount, 1000); assert.deepEqual(full.versions[0].content.advanced, { collectionRate: 0.7, billingTarget: 5 });
  const none = R.maskPlanForViewer(p, []); assert.equal(none.versions[0].content.target.amount, 0); assert.deepEqual(none.versions[0].content.allocations, []);
  const entPlan = plan(complete({ scope: { kind: 'entities', entityKeys: [RIY, JED] } })); assert.equal(R.maskPlanForViewer(entPlan, [RIY, JED, MAK]).masked, undefined); assert.equal(R.maskPlanForViewer(entPlan, [RIY]).versions[0].content.scope.entityKeys.length, 1);
});

/* ======================================================================== access */
const wholeRiy = normalizeGeoScope({ grants: [entireAmanahGrant(RIY)] });
const wholeRiyJed = normalizeGeoScope({ grants: [entireAmanahGrant(RIY), entireAmanahGrant(JED)] });
const muni = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [municipalitiesOf(RIY)[0].refId], direct: true, notSpecified: true }] });
const noDirect = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: 'all', direct: false, notSpecified: false }] });
const housing = normalizeGeoScope({ nonMunicipal: true });
const MIN = { kind: 'ministry' }; const E = (...k) => ({ kind: 'entities', entityKeys: k });
ok('canMutateScope matrix: all-scope · whole-Amanah grant · municipal grant · read-only', () => {
  assert.equal(A.canMutateScope(ALL_SCOPE, MIN, {}), true); assert.equal(A.canMutateScope(ALL_SCOPE, E(RIY, HOU), {}), true);
  assert.equal(A.canMutateScope(wholeRiy, E(RIY), {}), true); assert.equal(A.canMutateScope(wholeRiy, E(RIY, JED), {}), false); assert.equal(A.canMutateScope(wholeRiyJed, E(RIY, JED), {}), true); assert.equal(A.canMutateScope(wholeRiy, MIN, {}), false);
  assert.equal(A.canMutateScope(muni, E(RIY), {}), false); assert.equal(A.canMutateScope(noDirect, E(RIY), {}), false); // a partial grant (municipal / without direct records) is never enough
  assert.equal(A.canMutateScope(housing, E(HOU), {}), true); assert.equal(A.canMutateScope(wholeRiy, E(HOU), {}), false); assert.equal(A.canMutateScope(housing, E(RIY), {}), false);
  assert.equal(A.canMutateScope(ALL_SCOPE, MIN, { readOnly: true }), false); assert.equal(A.canMutateScope(wholeRiy, E(RIY), { readOnly: true }), false);
  assert.equal(A.canMutateScope(EMPTY_SCOPE, E(RIY), {}), false); assert.equal(A.canMutateScope(ALL_SCOPE, E('Nowhere'), {}), false); assert.equal(A.canMutateScope(ALL_SCOPE, E(), {}), false); assert.equal(A.canMutateScope(ALL_SCOPE, { kind: 'x' }, {}), false);
  assert.equal(A.canMutateScope(undefined, MIN), false);
  assert.equal(A.mutateDecision(ALL_SCOPE, MIN, { readOnly: true }).reason, 'read_only_role'); assert.equal(A.mutateDecision(muni, E(RIY)).reason, 'scope'); assert.equal(A.mutateDecision(ALL_SCOPE, E('Nowhere')).reason, 'unknown_scope');
  // all 17 whole Amanahs + the non-municipal grant = all-entities access
  const allViaGrants = normalizeGeoScope({ grants: U.filter((k) => k !== HOU).map(entireAmanahGrant), nonMunicipal: true }); assert.equal(A.canMutateScope(allViaGrants, MIN, {}), true);
  const missingOne = normalizeGeoScope({ grants: U.filter((k) => k !== HOU && k !== RIY).map(entireAmanahGrant), nonMunicipal: true }); assert.equal(A.canMutateScope(missingOne, MIN, {}), false);
});
ok('canViewScope / visibleEntityKeysOfScope / canSetReference', () => {
  assert.deepEqual(A.visibleEntityKeysOfScope(ALL_SCOPE), U); assert.deepEqual(A.visibleEntityKeysOfScope(wholeRiyJed), [RIY, JED]); assert.deepEqual(A.visibleEntityKeysOfScope(muni), [RIY]); assert.deepEqual(A.visibleEntityKeysOfScope(housing), [HOU]); assert.deepEqual(A.visibleEntityKeysOfScope(EMPTY_SCOPE), []);
  assert.equal(A.canViewScope(wholeRiy, MIN), true); assert.equal(A.canViewScope(wholeRiy, E(JED)), false); assert.equal(A.canViewScope(wholeRiy, E(RIY, JED)), true); assert.equal(A.canViewScope(EMPTY_SCOPE, MIN), false); assert.equal(A.canViewScope(ALL_SCOPE, E()), true); assert.equal(A.canViewScope(wholeRiy, E()), false);
  assert.equal(A.canViewWholeScope(wholeRiy, MIN), false); assert.equal(A.canViewWholeScope(ALL_SCOPE, MIN), true); assert.equal(A.canViewWholeScope(wholeRiyJed, E(RIY, JED)), true);
  assert.equal(A.canSetReference(ALL_SCOPE, {}), true); assert.equal(A.canSetReference(ALL_SCOPE, { readOnly: true }), false); assert.equal(A.canSetReference(wholeRiy, {}), false); assert.equal(A.canSetReference(undefined), false);
  assert.ok(!A.entityUniverse().includes(HQ_KEY)); assert.equal(A.entityUniverse().length, appropriationKeys().length - 1); assert.deepEqual(R.entityUniverse(), A.entityUniverse());
});

/* ======================================================================== reference plan */
ok('resolveReferencePlan: ok(configured) · ok(only_eligible) · ambiguous · none · reference_invalid', () => {
  const a = plan(complete({ name: 'أ' }), { id: 'plan-11111111' }); const b = plan(complete({ name: 'ب', scope: { kind: 'entities', entityKeys: [RIY, JED] } }), { id: 'plan-22222222' });
  // none
  assert.deepEqual(REF.resolveReferencePlan({ year: 2026, plans: [], references: {} }), { state: 'none' });
  assert.deepEqual(REF.resolveReferencePlan({ year: 2027, plans: [a], references: {} }), { state: 'none' }, 'a plan of another year is not eligible');
  // only eligible
  const one = REF.resolveReferencePlan({ year: 2026, plans: [a], references: {} }); assert.equal(one.state, 'ok'); assert.equal(one.source, 'only_eligible'); assert.equal(one.sourceLabel.ar, 'الخطة الوحيدة المؤهلة'); assert.equal(one.view.versionId, 'plan-11111111@r1'); assert.equal(one.name, 'أ'); assert.equal(one.plan, a);
  // ambiguous
  const amb = REF.resolveReferencePlan({ year: 2026, plans: [a, b], references: {} }); assert.equal(amb.state, 'ambiguous'); assert.deepEqual(amb.candidates.map((c) => c.planId), ['plan-11111111', 'plan-22222222']); assert.equal(amb.candidates[0].versionId, 'plan-11111111@r1');
  // configured wins over the others
  const conf = REF.resolveReferencePlan({ year: 2026, plans: [a, b], references: { 2026: { planId: 'plan-22222222', setBy: { userId: 'u', name: 'n' }, at: 'x' } } }); assert.equal(conf.state, 'ok'); assert.equal(conf.source, 'configured'); assert.equal(conf.name, 'ب'); assert.equal(conf.sourceLabel.ar, 'الخطة المرجعية المحددة');
  // reference_invalid — never silently replaced by the other eligible plan (a saved plan has no lifecycle: only a missing plan or a period that no longer covers the year invalidates it)
  const refs = (id) => ({ 2026: { planId: id, setBy: null, at: 'x' } });
  assert.deepEqual(REF.resolveReferencePlan({ year: 2026, plans: [a, b], references: refs('plan-nope') }).reason, 'not_found');
  const r27 = REF.resolveReferencePlan({ year: 2027, plans: [a], references: { 2027: { planId: 'plan-11111111' } } }); assert.equal(r27.state, 'reference_invalid'); assert.equal(r27.reason, 'period_mismatch'); assert.equal(r27.planId, 'plan-11111111');
  assert.equal(REF.resolveReferencePlan({ year: 2026, plans: [a, b], references: refs('plan-nope') }).state, 'reference_invalid');
});
ok('resolveReferencePlan: eligible = SAVED plans whose period OVERLAPS the year (a range, a straddling plan; not other years); reads the saved content only', () => {
  const range = plan(complete({ name: 'نطاق', period: { start: '2026-10-15', end: '2026-12-31', preset: 'range' } }), { id: 'plan-33333333' }); const straddle = plan(complete({ name: 'عابرة', period: { start: '2026-07-01', end: '2027-06-30', preset: 'range' } }), { id: 'plan-44444444' });
  const y27 = plan(complete({ period: fy(2027) }), { id: 'plan-77777777' });
  assert.deepEqual(REF.eligibleReferencePlans(2026, [range, straddle, y27]).map((p) => p.id), ['plan-33333333', 'plan-44444444']);
  assert.deepEqual(REF.eligibleReferencePlans(2027, [range, straddle, y27]).map((p) => p.id), ['plan-44444444', 'plan-77777777']);
  assert.equal(REF.resolveReferencePlan({ year: 2026, plans: [range, y27], references: {} }).name, 'نطاق'); // exactly one eligible
  assert.deepEqual(REF.eligibleReferencePlans(2026, [{ id: 'old', state: 'active', inForce: 1, versions: [{ n: 1, content: complete() }] }]), [], 'a record without `content` (the retired shape) is never eligible');
});
/* ======================================================================== budget aid */
ok('budgetAid: Σ expAdjusted × coverage; Ministry includes the headquarters budget (the old default); entity scope excludes it; unavailable without data; a note, no live link', () => {
  const total = appropriationKeys().reduce((t, k) => t + appropriationOf(k).expAdjusted, 0);
  const m = R.budgetAid({ scope: MIN, year: 2026 }); assert.equal(m.available, true); assert.equal(m.budget, total); assert.equal(m.includesHeadquarters, true); assert.equal(m.coverage, 0.66); assert.equal(m.suggestion, Math.round(total * 0.66)); assert.deepEqual(m.basis, { method: 'budget_x_coverage', coverage: 0.66, budget: total, at: null }); assert.match(m.note.ar, /اقتراح/);
  const e = R.budgetAid({ scope: E(RIY, JED), year: 2026, coverage: 0.5, at: '2026-11-07T00:00:00Z' }); assert.equal(e.budget, appropriationOf(RIY).expAdjusted + appropriationOf(JED).expAdjusted); assert.equal(e.includesHeadquarters, false); assert.equal(e.basis.at, '2026-11-07T00:00:00Z'); assert.equal(e.suggestion, Math.round(e.budget * 0.5));
  assert.equal(R.budgetAid({ scope: MIN, year: 2031 }).available, false); assert.equal(R.budgetAid({ scope: MIN, year: 2031 }).reason, 'no_budget_data'); assert.equal(R.budgetAid({ scope: E(), year: 2026 }).available, false); assert.equal(R.budgetAid({ scope: MIN, coverage: 0 }).available, false);
  assert.ok(Number.isInteger(m.suggestion));
});

/* ======================================================================== seed */
ok('seedPlanContent: 66 % × the communicated budget incl. the headquarters; Σ allocations = target to the riyal; revenue-appropriation shares; explicit equal profile; Ministry scope; name per spec', () => {
  const c = D.seedPlanContent(2026); const budget = appropriationKeys().reduce((t, k) => t + appropriationOf(k).expAdjusted, 0);
  assert.equal(c.target.amount, Math.round(budget * 0.66)); assert.equal(sum(c.allocations.map((a) => a.amount)), c.target.amount); assert.ok(R.allocationSummary(c).complete); assert.ok(c.allocations.every((a) => a.origin === 'seed' && a.entityKey !== HQ_KEY));
  const exp = M.apportion(c.target.amount, U.map((k) => appropriationOf(k).revAdjusted)); assert.deepEqual(c.allocations.map((a) => a.amount), exp.amounts.filter((x) => x > 0));
  assert.deepEqual(c.distribution, { profile: 'equal' }); assert.deepEqual(c.scope, { kind: 'ministry' }); assert.deepEqual(c.period, { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' }); assert.equal(c.name, 'خطة تحصيل 2026 — توضيحية (بيانات توضيحية)');
  assert.equal(c.target.basis.method, 'budget_x_coverage'); assert.equal(c.target.basis.budget, budget); assert.equal(c.target.basis.coverage, 0.66); assert.equal(D.seedPlanContent(2026, { at: 'T' }).target.basis.at, 'T');
  assert.equal(D.seedPlanContent(2031), null); assert.equal(R.validateDraft(c).ok, true);
  const ck = R.saveChecks(c, acts); assert.equal(ck.ok, true, JSON.stringify(ck.failed)); // the seed is a valid active baseline
  assert.doesNotMatch(JSON.stringify(c), /معتمد/); const s = R.distributionSummary(c); assert.equal(s.label.ar, 'توزيع متساوٍ — افتراض');
});

/* ======================================================================== legacy */
ok('legacy: the DEFAULT store → allocations = the old entity targets rounded so Σ = the old Ministry target, migrated, explicit equal profile, metadata = the illustrative default', () => {
  const store = legacyStoreFixture({ year: 2026 }); const rows = entityTargetsFull(store, 2026).filter((r) => r.key !== HQ_KEY); const oldMin = Math.round(sum(rows.map((r) => r.revenueTarget)));
  const c = D.legacyStoreToContent(store, 2026); assert.equal(c.target.amount, oldMin); assert.equal(sum(c.allocations.map((a) => a.amount)), oldMin); assert.ok(c.allocations.every((a) => a.origin === 'migrated'));
  c.allocations.forEach((a) => { const r = rows.find((x) => x.key === a.entityKey); assert.ok(Math.abs(a.amount - r.revenueTarget) <= 1, a.entityKey); }); // within one riyal of the old computed target
  assert.deepEqual(c.distribution, { profile: 'equal' }); assert.equal(c.entityDistributions, undefined); assert.equal(c.advanced.collectionRate, 0.68); assert.equal(c.target.basis.coverage, 0.66);
  assert.equal(R.validateDraft(c).ok, true); assert.equal(R.saveChecks(c, acts).ok, true);
  const rec = D.legacyRecord(store, 2026); assert.equal(rec.versionId, '2026-default'); assert.equal(rec.source, 'device-localStorage'); assert.equal(rec.owner, null); assert.equal(rec.savedAt, null); assert.equal(rec.status, 'illustrative');
  // the seed and the default legacy store describe the same target (the old default IS 66 % of the budget)
  assert.ok(Math.abs(D.seedPlanContent(2026).target.amount - c.target.amount) <= 1);
});
ok('legacy: an EDITED store with uneven weights → manual profile (whole bp, Σ 10 000), entity overrides where an entity differs, metadata verbatim; the original store is untouched', () => {
  const uneven = [0.2, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.1, 0.2];
  const years = Object.fromEntries(U.map((k) => [k, { weights: k === RIY ? evenWeights() : uneven, savedAt: '2026-03-02T10:00:00Z', savedBy: k === RIY ? 'سارة' : 'محمد' }]));
  const st = legacyStoreFixture({ year: 2026, coverage: 0.5, collectionRate: 0.7, billing: 12_345_678_901.4, years, meta: { version: 21, versionId: '2026-v21', status: 'approved', owner: 'إدارة التخطيط', savedAt: '2026-03-04T10:00:00Z', savedBy: 'علي' } });
  const snap = clone(st);
  const c = D.legacyStoreToContent(st, 2026); const rows = entityTargetsFull(st, 2026).filter((r) => r.key !== HQ_KEY); const oldMin = Math.round(sum(rows.map((r) => r.revenueTarget)));
  assert.deepEqual(st, snap); assert.equal(c.target.amount, oldMin); assert.equal(sum(c.allocations.map((a) => a.amount)), oldMin); assert.equal(c.distribution.profile, 'manual'); assert.equal(sum(Object.values(c.distribution.weights)), 10000); assert.equal(Object.keys(c.distribution.weights).length, 12);
  assert.equal(c.distribution.weights['2026-01'] > c.distribution.weights['2026-03'], true); assert.deepEqual(Object.keys(c.entityDistributions), [RIY]); assert.deepEqual(c.entityDistributions[RIY], { profile: 'equal' });
  assert.equal(c.advanced.collectionRate, 0.7); assert.equal(c.advanced.billingTarget, 12_345_678_901); assert.equal(c.target.basis.coverage, 0.5);
  assert.equal(R.validateDraft(c).ok, true); assert.equal(R.saveChecks(c, acts).ok, true, JSON.stringify(R.saveChecks(c, acts).failed));
  const pm = M.planMonthly(c, c.period); assert.equal(sum(pm.plan), oldMin); // the monthly amounts reconcile to the target to the riyal
  const rec = D.legacyRecord(st, 2026); assert.deepEqual([rec.versionId, rec.status, rec.owner, rec.savedBy, rec.savedAt, rec.source], ['2026-v21', 'approved', 'إدارة التخطيط', 'علي', '2026-03-04T10:00:00Z', 'device-localStorage']);
  assert.doesNotMatch(JSON.stringify(c), /معتمد/); // the legacy status never reaches the content
});
ok('legacy: uniformly uneven weights → a manual plan profile and NO entity overrides', () => {
  const w = [0.3, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.1];
  const st = legacyStoreFixture({ year: 2026, years: Object.fromEntries(U.map((k) => [k, { weights: w, savedAt: 'a', savedBy: 'b' }])) });
  const c = D.legacyStoreToContent(st, 2026); assert.equal(c.distribution.profile, 'manual'); assert.equal(c.entityDistributions, undefined); assert.equal(c.distribution.weights['2026-01'], 3000); assert.equal(sum(Object.values(c.distribution.weights)), 10000);
});
ok('legacy: a store with a typed per-entity coverage (override on) is mapped without a budget basis; v1 stores and garbage are safe', () => {
  const st = legacyStoreFixture({ year: 2026, years: { [RIY]: { coverage: 1, savedAt: 'a', savedBy: 'b' } } });
  const c = D.legacyStoreToContent(st, 2026); assert.equal(c.target.basis, undefined); assert.equal(sum(c.allocations.map((a) => a.amount)), c.target.amount);
  const v1 = { v: 1, years: {} }; assert.equal(D.legacyStoreToContent(v1, 2026).allocations.length > 0, true); assert.equal(D.legacyRecord(v1, 2026).versionId, '2026-default');
  assert.doesNotThrow(() => D.legacyStoreToContent(null, 2026)); assert.doesNotThrow(() => D.legacyRecord(undefined, 2026));
});

/* ======================================================================== §10 — the simplified workflow */
/** a plan record of the simplified model (what the data service stores and serves) */
const saved = (c, { id = 'plan-5a5a0001', isSystem = false, origin = 'user', revision = 1, name = null, versions = null } = {}) => ({
  id, name: name ?? c.name, isSystem, origin, content: c, createdBy: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', lastEditedBy: null, revision, legacy: null, state: 'active',
  versions: versions ?? [{ n: 1, revision, content: c, savedBy: null, savedAt: '2026-01-01T00:00:00Z' }]
});
ok('saveChecks: the old activation rules minus the duplicate-baseline and the type rule — exactly 6 ids in order, the 7th (municipal) only with municipal rows', () => {
  assert.deepEqual(R.BASE_SAVE_CHECK_IDS, ['target_positive', 'allocation_complete', 'allocations_in_scope', 'profile_explicit', 'months_complete', 'actor_authorised']);
  assert.deepEqual(R.SAVE_CHECK_IDS, [...R.BASE_SAVE_CHECK_IDS, 'municipal_within_entity']);
  const r = R.saveChecks(complete(), acts); assert.equal(r.ok, true, JSON.stringify(r.failed)); assert.deepEqual(r.checks.map((c) => c.id), R.BASE_SAVE_CHECK_IDS); assert.deepEqual(r.failed, []);
  assert.ok(r.checks.every((c) => typeof c.ok === 'boolean' && c.params && typeof c.params === 'object' && c.label.ar && c.label.en));
  assert.ok(!r.checks.some((c) => c.id === 'type_baseline' || c.id === 'no_duplicate_active_baseline'));
  const e = R.saveChecks(R.emptyContent({}), acts); assert.deepEqual(e.failed, ['target_positive', 'allocation_complete', 'profile_explicit']); assert.equal(e.checks.length, 6); assert.equal(e.ok, false);
  const mr = (entityKey, muniId, amount) => ({ entityKey, muniId, amount, origin: 'manual' }); const rm = municipalitiesOf(RIY).map((m) => m.refId);
  const withM = R.saveChecks(complete({ municipalAllocations: [mr(RIY, rm[0], 600)] }), acts); assert.deepEqual(withM.checks.map((c) => c.id), R.SAVE_CHECK_IDS); assert.equal(withM.ok, true);
  const over = R.saveChecks(complete({ municipalAllocations: [mr(RIY, rm[0], 601)] }), acts); assert.deepEqual(over.failed, ['municipal_within_entity']); assert.equal(over.checks[6].params.entities[0].excess, 1);
  assert.deepEqual(R.saveChecks(complete(), { actorScope: normalizeGeoScope({ grants: [entireAmanahGrant(MAK)] }) }).failed, ['actor_authorised'], 'an actor without authority over the scope fails only the authority rule');
  assert.deepEqual(R.saveChecks(complete(), { actorScope: ALL_SCOPE, readOnly: true }).failed, ['actor_authorised']); assert.deepEqual(R.saveChecks(complete(), {}).failed, ['actor_authorised'], 'fail safe without an actor');
});
ok('saveChecks: several plans may share scope + period (no duplicate rule); manual months must total exactly 10 000 bp, also for overrides', () => {
  const w = (t) => { const o = {}; M.monthRows(fy()).forEach((r, i) => { o[r.ym] = i === 0 ? t - 11 * 100 : 100; }); return o; };
  assert.equal(R.saveChecks(complete(), acts).ok, true); assert.equal(R.saveChecks(complete(), acts).ok, true); // the same content twice: nothing to collide with
  assert.deepEqual(R.saveChecks(complete({ distribution: { profile: 'manual', weights: w(9999) } }), acts).failed, ['months_complete']);
  assert.equal(R.saveChecks(complete({ distribution: { profile: 'manual', weights: w(10000) } }), acts).ok, true);
  assert.deepEqual(R.saveChecks(complete({ distribution: { profile: 'equal' }, entityDistributions: { [RIY]: { profile: 'manual', weights: w(9000) } } }), acts).failed, ['months_complete']);
  assert.deepEqual(R.saveChecks(complete({ distribution: { profile: null } }), acts).failed, ['profile_explicit']);
  assert.deepEqual(R.saveChecks(complete({ allocations: [{ entityKey: RIY, amount: 600 }, { entityKey: JED, amount: 399 }] }), acts).failed, ['allocation_complete']);
  assert.deepEqual(R.saveChecks(complete({ scope: { kind: 'entities', entityKeys: [RIY] } }), acts).failed, ['allocations_in_scope']);
});
ok('validatePlanName: trimmed, 1–80 characters, unique case-insensitively among the visible names; coded AR/EN messages', () => {
  const v = R.validatePlanName('  خطتي  ', []); assert.deepEqual([v.ok, v.name, v.errors], [true, 'خطتي', []]);
  for (const bad of ['', '   ', null, undefined, 7, {}]) { const r = R.validatePlanName(bad, []); assert.equal(r.ok, false); assert.equal(r.errors[0].code, 'name_required'); assert.ok(r.errors[0].ar && r.errors[0].en && r.errors[0].path === 'name'); }
  assert.equal(R.validatePlanName('ا'.repeat(80), []).ok, true); const long = R.validatePlanName('ا'.repeat(81), []); assert.equal(long.errors[0].code, 'name_too_long'); assert.equal(long.errors[0].params.max, 80);
  assert.equal(R.PLAN_NAME_MAX, 80); assert.equal(R.validatePlanName('😀'.repeat(80), []).ok, true, 'counted in characters, not UTF-16 units');
  const t = R.validatePlanName('Plan A', ['plan a', 'Other']); assert.equal(t.ok, false); assert.equal(t.errors[0].code, 'name_taken'); assert.ok(t.errors[0].ar && t.errors[0].en); assert.equal(t.name, 'Plan A');
  assert.equal(R.validatePlanName(' PLAN a ', [{ name: 'plan A' }]).errors[0].code, 'name_taken', 'trim + case-insensitive; objects with a name are accepted');
  assert.equal(R.validatePlanName('خطة 2026', ['خطة 2027']).ok, true); assert.equal(R.validatePlanName('x', undefined).ok, true); assert.equal(R.validatePlanName('x', null).ok, true);
});
ok('defaultPlanResolution: personal default (exists + visible) → GLOBAL default (visible) → first system plan → first visible by name → none', () => {
  const P = [{ id: 'plan-b', name: 'ب' }, { id: 'plan-a', name: 'أ' }, { id: 'plan-sys', name: 'النظام', isSystem: true }, { id: 'plan-c', name: 'ج' }];
  const eff = (o) => R.defaultPlanResolution({ plans: P, ...o });
  assert.deepEqual(eff({ userDefaultPlanId: 'plan-c' }), { userDefaultPlanId: 'plan-c', globalDefaultPlanId: 'plan-sys', systemDefaultPlanId: 'plan-sys', effectiveDefaultPlanId: 'plan-c', source: 'personal' });
  assert.deepEqual(eff({}), { userDefaultPlanId: null, globalDefaultPlanId: 'plan-sys', systemDefaultPlanId: 'plan-sys', effectiveDefaultPlanId: 'plan-sys', source: 'global' });
  assert.equal(eff({ userDefaultPlanId: 'plan-gone' }).effectiveDefaultPlanId, 'plan-sys', 'a default that no longer exists falls back');
  assert.equal(eff({ userDefaultPlanId: 'plan-c', visibleIds: ['plan-a', 'plan-b', 'plan-sys'] }).effectiveDefaultPlanId, 'plan-sys', 'a default that is not visible falls back'); assert.equal(eff({ userDefaultPlanId: 'plan-c', visibleIds: ['plan-a'] }).userDefaultPlanId, null);
  const noSys = eff({ visibleIds: ['plan-b', 'plan-a', 'plan-c'] }); assert.deepEqual([noSys.systemDefaultPlanId, noSys.effectiveDefaultPlanId, noSys.source], [null, 'plan-a', 'fallback']);
  assert.deepEqual(R.defaultPlanResolution({ plans: [], userDefaultPlanId: 'x' }), { userDefaultPlanId: null, globalDefaultPlanId: null, systemDefaultPlanId: null, effectiveDefaultPlanId: null, source: 'none' }); assert.equal(R.defaultPlanResolution().effectiveDefaultPlanId, null);
  assert.equal(R.defaultPlanResolution({ plans: [{ id: 'z', name: 'س' }, { id: 'y', name: 'س' }] }).effectiveDefaultPlanId, 'y', 'ties are broken by id: deterministic');
  const before = clone(P); eff({ userDefaultPlanId: 'plan-c' }); assert.deepEqual(P, before);
});
ok('planView of a simplified record: the saved content, versionId <id>@r<revision>, no draft / historical / archived; numbered = an internal snapshot; working = null; a copy', () => {
  const c1 = complete({ name: 'نسخة أولى' }); const c2 = complete({ name: 'نسخة ثانية' });
  const p = saved(c2, { revision: 2, versions: [{ n: 1, revision: 1, content: c1, savedBy: null, savedAt: 'x' }, { n: 2, revision: 2, content: c2, savedBy: null, savedAt: 'y' }] });
  const v = R.planView(p, 'inForce'); assert.deepEqual([v.planId, v.versionId, v.versionNumber, v.name, v.state, v.isHistorical, v.isSystem], ['plan-5a5a0001', 'plan-5a5a0001@r2', 2, 'نسخة ثانية', 'active', false, false]);
  assert.equal(R.planView(p).versionId, v.versionId); assert.deepEqual(v.period, c2.period); assert.deepEqual(v.scope, c2.scope); assert.equal(v.labelSource.ar, 'نسخة ثانية');
  const old = R.planView(p, 1); assert.deepEqual([old.versionId, old.name, old.isHistorical], ['plan-5a5a0001@s1', 'نسخة أولى', true]); assert.equal(R.planView(p, 2).isHistorical, false); assert.equal(R.planView(p, 9), null);
  assert.equal(R.planView(p, 'working'), null); v.content.name = 'تعديل'; assert.equal(p.content.name, 'نسخة ثانية'); assert.equal(R.planView(saved(c1, { isSystem: true, origin: 'seed' })).isSystem, true);
  const meta = saved(c1, { versions: [{ n: 1, revision: 1, savedBy: null, savedAt: 'x' }] }); assert.equal(R.planView(meta, 1), null, 'a presented record carries snapshot metadata only');
  // the earlier record shape still reads exactly as before
  assert.equal(R.planView(plan(c1, { id: 'plan-aaaaaaaa' }), 'inForce').versionId, 'plan-aaaaaaaa@r1');
});
ok('resolveReferencePlan over simplified records: every saved plan overlapping the year is eligible; the same ok / ambiguous / none / reference_invalid semantics', () => {
  const a = saved(complete({ name: 'أ' }), { id: 'plan-11111111' }); const b = saved(complete({ name: 'ب', scope: { kind: 'entities', entityKeys: [RIY, JED] } }), { id: 'plan-22222222' }); const y27 = saved(complete({ name: 'ج', period: fy(2027) }), { id: 'plan-33333333' });
  assert.equal(REF.eligibleReferencePlans(2026, [a, b, y27]).length, 2); assert.deepEqual(REF.resolveReferencePlan({ year: 2026, plans: [], references: {} }), { state: 'none' }); assert.deepEqual(REF.resolveReferencePlan({ year: 2030, plans: [a, b], references: {} }), { state: 'none' });
  const one = REF.resolveReferencePlan({ year: 2026, plans: [a, y27], references: {} }); assert.deepEqual([one.state, one.source, one.name, one.versionId], ['ok', 'only_eligible', 'أ', 'plan-11111111@r1']);
  const amb = REF.resolveReferencePlan({ year: 2026, plans: [a, b], references: {} }); assert.equal(amb.state, 'ambiguous'); assert.deepEqual(amb.candidates.map((c) => c.planId), ['plan-11111111', 'plan-22222222']);
  const conf = REF.resolveReferencePlan({ year: 2026, plans: [a, b], references: { 2026: { planId: 'plan-22222222', setBy: { system: true }, at: 'x' } } }); assert.deepEqual([conf.state, conf.source, conf.name], ['ok', 'configured', 'ب']);
  assert.equal(REF.resolveReferencePlan({ year: 2026, plans: [a, b], references: { 2026: { planId: 'plan-nope' } } }).reason, 'not_found');
  assert.equal(REF.resolveReferencePlan({ year: 2026, plans: [a, y27], references: { 2026: { planId: 'plan-33333333' } } }).reason, 'period_mismatch');
  const retired = { id: 'plan-44444444', state: 'active', type: 'baseline', inForce: 1, versions: [{ n: 1, content: complete({ name: 'قديمة' }) }] }; assert.equal(REF.resolveReferencePlan({ year: 2026, plans: [a, retired], references: {} }).state, 'ok', 'a record of the retired shape (no `content`) takes no part');
});
ok('maskPlanForViewer on a simplified record: the saved content and every snapshot are masked like before (restricted viewer, municipal-only viewer); a whole viewer gets an unchanged copy', () => {
  const c = complete({ name: 'مقنّعة' }); const p = saved(c, { id: 'plan-6d6d0001' }); const snap = clone(p);
  const m = R.maskPlanForViewer(p, [RIY], normalizeGeoScope({ grants: [entireAmanahGrant(RIY)] }));
  assert.deepEqual(m.content.allocations.map((a) => a.entityKey), [RIY]); assert.equal(m.content.target.amount, 600); assert.equal(m.content.target.masked, true); assert.equal(m.masked, true); assert.equal(m.legacy, null);
  assert.deepEqual(m.versions[0].content.allocations.map((a) => a.entityKey), [RIY]); assert.deepEqual(p, snap, 'the input is not mutated'); assert.ok(!JSON.stringify(m).includes('"amount":400'));
  const whole = R.maskPlanForViewer(p, U, ALL_SCOPE); assert.deepEqual(whole.content, c); assert.equal(whole.masked, undefined);
  const rm = municipalitiesOf(RIY).map((x) => x.refId); const withM = saved(complete({ municipalAllocations: [{ entityKey: RIY, muniId: rm[0], amount: 100, origin: 'manual' }, { entityKey: RIY, muniId: rm[1], amount: 200, origin: 'manual' }] }));
  const mo = R.maskPlanForViewer(withM, [RIY], normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [rm[0]], direct: false, notSpecified: false }] }));
  assert.deepEqual(mo.content.allocations, []); assert.equal(mo.content.target.amount, 100); assert.deepEqual(mo.content.municipalAllocations.map((x) => x.amount), [100]); assert.deepEqual(mo.municipalOnlyEntityKeys, [RIY]); assert.ok(!JSON.stringify(mo).includes('"amount":600'));
});
ok('planStore side rules: effective default over cached records (personal → system → first), without the server\'s answer', () => {
  const recs = [saved(complete({ name: 'ب خطة' }), { id: 'plan-0000000b' }), saved(complete({ name: 'أ خطة' }), { id: 'plan-0000000a' }), saved(complete({ name: 'النظام' }), { id: 'plan-5eed2026', isSystem: true })];
  assert.equal(R.defaultPlanResolution({ plans: recs }).effectiveDefaultPlanId, 'plan-5eed2026'); assert.equal(R.defaultPlanResolution({ plans: recs, userDefaultPlanId: 'plan-0000000b' }).effectiveDefaultPlanId, 'plan-0000000b');
  assert.equal(R.defaultPlanResolution({ plans: recs.filter((x) => !x.isSystem) }).effectiveDefaultPlanId, 'plan-0000000a');
});

console.log(`plans model: ${n} test groups passed`);
