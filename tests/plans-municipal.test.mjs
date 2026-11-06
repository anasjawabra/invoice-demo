// Tests of the municipality dimension of the pure revenue-plans model (docs/revenue-plans-spec.md §9): content, validation, activation check, summary, previews, monthly reconciliation, masking, view scope, access.
// Run with `npm run test:plansmuni`.
import assert from 'node:assert/strict';
import * as M from '../src/data/plans/planMath.js';
import * as R from '../src/data/plans/planRules.js';
import * as A from '../src/data/plans/planAccess.js';
import { ALL_SCOPE, EMPTY_SCOPE, entireAmanahGrant, normalizeGeoScope } from '../src/data/geoScope.js';
import { municipalitiesOf, municipalityCountOf } from '../src/data/amanahHierarchy.js';

let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { console.error('FAILED:', name); throw e; } n += 1; };
const sum = (a) => a.reduce((t, x) => t + x, 0);
const clone = (x) => JSON.parse(JSON.stringify(x));
const RIY = 'Riyadh Amanah'; const JED = 'Jeddah Amanah'; const MAK = 'Makkah Amanah'; const HOU = 'Housing Sector';
const rm = municipalitiesOf(RIY).map((m) => m.refId); const jm = municipalitiesOf(JED).map((m) => m.refId); const mm = municipalitiesOf(MAK).map((m) => m.refId);
const fy = M.fiscalYearPeriod(2026);
const content = (o = {}) => R.normalizeContent({ name: 'خطة', scope: { kind: 'ministry' }, period: fy, target: { amount: 1000 }, allocations: [{ entityKey: RIY, amount: 600, origin: 'manual' }, { entityKey: JED, amount: 400, origin: 'manual' }], distribution: { profile: 'equal' }, advanced: {}, ...o });
const raw = (o = {}) => ({ name: 'خطة', scope: { kind: 'ministry' }, period: fy, target: { amount: 1000 }, allocations: [{ entityKey: RIY, amount: 600 }, { entityKey: JED, amount: 400 }], distribution: { profile: 'equal' }, ...o }); // NOT normalised: validateDraft sees the raw input
const mr = (entityKey, muniId, amount, origin = 'manual') => ({ entityKey, muniId, amount, origin });
const acts = { actorScope: ALL_SCOPE, readOnly: false };
const codes = (r) => r.errors.map((e) => e.code);
const plan = (c) => ({ id: 'plan-0000abcd', name: c.name, isSystem: false, state: 'active', origin: 'user', legacy: { x: 1 }, content: c, versions: [{ n: 1, revision: 1, content: c, savedBy: null, savedAt: 'x' }], revision: 1 });
const idsOf = (o) => JSON.stringify(o);

/* ---------- content ---------- */
ok('content: without municipal rows nothing changes (no key); with rows they are normalised and unknown ids are KEPT for validateDraft to refuse', () => {
  assert.equal('municipalAllocations' in R.emptyContent({}), false); assert.equal('municipalAllocations' in content(), false);
  const c = content({ municipalAllocations: [{ entityKey: ` ${RIY} `, muniId: rm[0], amount: '100.4', origin: 'weird', note: ' x ' }, { entityKey: RIY, muniId: 'MREF-NOPE', amount: 5 }, null, 7] });
  assert.deepEqual(c.municipalAllocations, [{ entityKey: RIY, muniId: rm[0], amount: 100, origin: 'manual', note: 'x' }, { entityKey: RIY, muniId: 'MREF-NOPE', amount: 5, origin: 'manual' }]);
  assert.equal(R.normalizeContent(c).municipalAllocations.length, 2); assert.deepEqual(R.normalizeContent(c), c); // idempotent
  assert.deepEqual(R.municipalRowsOf(content()), []); assert.equal(R.municipalRowsOf(c, JED).length, 0); assert.equal(R.municipalRowsOf(c, RIY).length, 2);
});
ok('content: planView carries municipalAllocations; allocationDifferences ignores municipal rows', () => {
  const c = content({ municipalAllocations: [mr(RIY, rm[0], 100)] }); const v = R.planView(plan(c));
  assert.deepEqual(v.content.municipalAllocations, c.municipalAllocations); assert.notEqual(v.content.municipalAllocations, c.municipalAllocations);
  const d = R.allocationDifferences(v, R.planView(plan(content()))); assert.deepEqual(d.rows.map((r) => r.entityKey), [RIY, JED]); assert.equal(d.entityPlanTotal, 1000); assert.equal(d.difference, 0);
});

/* ---------- validation ---------- */
ok('validateDraft: valid municipal rows pass; rows for an entity with NO allocation and an excess are allowed in a draft', () => {
  assert.equal(R.validateDraft(content({ municipalAllocations: [mr(RIY, rm[0], 100), mr(RIY, rm[1], 200)] })).ok, true);
  assert.equal(R.validateDraft(content({ allocations: [], municipalAllocations: [mr(RIY, rm[0], 100)] })).ok, true); // no Amanah allocation yet
  assert.equal(R.validateDraft(content({ municipalAllocations: [mr(RIY, rm[0], 5000)] })).ok, true); // excess: only blocks activation
  assert.equal(R.validateDraft(content({ municipalAllocations: [mr(RIY, rm[0], 0)] })).ok, true);
});
ok('validateDraft: unknown municipality / municipality of another Amanah / unknown entity / entity outside the scope / amounts / duplicates are HARD errors', () => {
  assert.deepEqual(codes(R.validateDraft(content({ municipalAllocations: [mr(RIY, 'MREF-001-999', 1)] }))), ['unknown_municipality']);
  assert.deepEqual(codes(R.validateDraft(content({ municipalAllocations: [mr(RIY, '', 1)] }))), ['unknown_municipality']);
  const foreign = R.validateDraft(content({ municipalAllocations: [mr(RIY, jm[0], 1)] })); assert.deepEqual(codes(foreign), ['municipality_not_in_entity']); assert.equal(foreign.errors[0].path, 'municipalAllocations.0.muniId');
  assert.deepEqual(codes(R.validateDraft(content({ municipalAllocations: [mr(HOU, rm[0], 1)] }))), ['municipality_not_in_entity']); // the Housing Sector has no municipalities
  assert.ok(codes(R.validateDraft(content({ municipalAllocations: [mr('Nowhere', rm[0], 1)] }))).includes('unknown_entity'));
  assert.deepEqual(codes(R.validateDraft(content({ scope: { kind: 'entities', entityKeys: [JED] }, allocations: [{ entityKey: JED, amount: 1000 }], municipalAllocations: [mr(RIY, rm[0], 1)] }))), ['municipal_entity_not_in_scope']);
  for (const bad of [-1, 'abc', null, NaN]) assert.deepEqual(codes(R.validateDraft(raw({ municipalAllocations: [mr(RIY, rm[0], bad)] }))), ['invalid_amount'], String(bad));
  assert.deepEqual(codes(R.validateDraft(raw({ municipalAllocations: [mr(RIY, rm[0], 10.5)] }))), ['amount_not_integer']); // a raw (un-normalised) fractional amount
  const dup = R.validateDraft(content({ municipalAllocations: [mr(RIY, rm[0], 1), mr(RIY, rm[1], 1), mr(RIY, rm[0], 2)] })); assert.deepEqual(codes(dup), ['duplicate_municipal_allocation']); assert.equal(dup.errors[0].path, 'municipalAllocations.2.muniId');
  assert.equal(R.validateDraft(content({ municipalAllocations: [mr(RIY, rm[0], 1), mr(JED, rm[0] /* wrong */, 1)] })).ok, false);
  assert.deepEqual(codes(R.validateDraft(raw({ municipalAllocations: 'x' }))), ['municipal_invalid']); assert.deepEqual(codes(R.validateDraft(raw({ municipalAllocations: [3] }))), ['municipal_invalid']);
  for (const e of R.validateDraft(raw({ municipalAllocations: [mr(RIY, 'MREF-X', -1)] })).errors) assert.ok(e.ar && e.en);
  assert.equal(R.validateDraft(content()).ok, true); // content without municipal rows validates exactly as before
});

/* ---------- activation check ---------- */
ok('saveChecks: a plan without municipal rows still gets exactly the 6 entries; with rows the 7th is appended', () => {
  const base = R.saveChecks(content(), acts); assert.deepEqual(base.checks.map((c) => c.id), R.BASE_SAVE_CHECK_IDS); assert.equal(base.ok, true);
  const withM = R.saveChecks(content({ municipalAllocations: [mr(RIY, rm[0], 100)] }), acts);
  assert.deepEqual(withM.checks.map((c) => c.id), R.SAVE_CHECK_IDS); assert.equal(withM.ok, true); assert.equal(withM.checks[6].ok, true); assert.ok(withM.checks[6].label.ar && withM.checks[6].label.en);
});
ok('saveChecks: municipal_within_entity — exactly equal is fine, one riyal over blocks (and says which Amanah), no Amanah allocation blocks, municipal rows are otherwise optional', () => {
  const eq = R.saveChecks(content({ municipalAllocations: [mr(RIY, rm[0], 250), mr(RIY, rm[1], 350)] }), acts); assert.equal(eq.ok, true);
  const over = R.saveChecks(content({ municipalAllocations: [mr(RIY, rm[0], 250), mr(RIY, rm[1], 351)] }), acts);
  assert.deepEqual(over.failed, ['municipal_within_entity']); assert.deepEqual(over.checks[6].params.entities, [{ entityKey: RIY, amanahAmount: 600, allocated: 601, excess: 1 }]);
  const noAl = R.saveChecks(content({ scope: { kind: 'entities', entityKeys: [RIY, JED, MAK] }, municipalAllocations: [mr(MAK, mm[0], 5)] }), acts); assert.deepEqual(noAl.failed, ['municipal_within_entity']);
  const two = R.saveChecks(content({ municipalAllocations: [mr(RIY, rm[0], 700), mr(JED, jm[0], 401)] }), acts); assert.deepEqual(two.checks[6].params.entities.map((e) => e.entityKey), [RIY, JED]);
});

/* ---------- summary / target ---------- */
ok('municipalSummary: غير موزع على البلديات, shares, every municipality with an amount or null + «لم يُحدد مستهدف لهذه البلدية»', () => {
  assert.equal(R.UNALLOCATED_TO_MUNICIPALITIES_LABEL.ar, 'غير موزع على البلديات'); assert.equal(R.NO_MUNICIPAL_TARGET_LABEL.ar, 'لم يُحدد مستهدف لهذه البلدية');
  const c = content({ municipalAllocations: [mr(RIY, rm[2], 150), mr(RIY, rm[0], 100, 'distributed')] }); const s = R.municipalSummary(c, RIY);
  assert.equal(s.hasMunicipalities, true); assert.equal(s.amanahAmount, 600); assert.equal(s.allocated, 250); assert.equal(s.unallocated, 350); assert.equal(s.excess, 0); assert.equal(s.complete, false); assert.equal(s.unallocatedLabel.ar, 'غير موزع على البلديات');
  assert.deepEqual(s.rows.map((r) => r.muniId), [rm[0], rm[2]]); // reference order, not typed order
  assert.equal(s.rows[0].share, 100 / 600); assert.equal(s.rows[0].origin, 'distributed'); assert.ok(s.rows[0].name.ar.length > 0 && s.rows[0].name.en.length > 0);
  assert.equal(s.municipalities.length, 47); assert.equal(s.municipalities.filter((m) => m.amount !== null).length, 2);
  const none = s.municipalities.find((m) => m.muniId === rm[1]); assert.equal(none.amount, null); assert.equal(none.hasTarget, false); assert.equal(none.label.ar, 'لم يُحدد مستهدف لهذه البلدية'); assert.equal(none.share, null);
  const full = R.municipalSummary(content({ municipalAllocations: [mr(RIY, rm[0], 600)] }), RIY); assert.equal(full.complete, true); assert.equal(full.unallocated, 0);
  const ex = R.municipalSummary(content({ municipalAllocations: [mr(RIY, rm[0], 650)] }), RIY); assert.equal(ex.excess, 50); assert.equal(ex.unallocated, 0); assert.equal(ex.complete, false);
});
ok('municipalSummary: no allocation row, no municipalities, and changing the Amanah amount never edits municipal rows', () => {
  const s0 = R.municipalSummary(content({ allocations: [], municipalAllocations: [mr(RIY, rm[0], 40)] }), RIY); assert.equal(s0.hasAllocation, false); assert.equal(s0.amanahAmount, 0); assert.equal(s0.excess, 40);
  const h = R.municipalSummary(content(), HOU); assert.equal(h.hasMunicipalities, false); assert.deepEqual(h.municipalities, []); assert.deepEqual(h.rows, []);
  const c = content({ municipalAllocations: [mr(RIY, rm[0], 100)] }); const before = clone(c.municipalAllocations);
  const lower = clone(c); lower.allocations[0].amount = 80; assert.deepEqual(lower.municipalAllocations, before);
  const sl = R.municipalSummary(lower, RIY); assert.equal(sl.excess, 20); assert.equal(sl.unallocated, 0); assert.equal(R.municipalSummary(content({ allocations: [{ entityKey: RIY, amount: 900 }], municipalAllocations: before }), RIY).unallocated, 800);
  assert.equal(R.municipalSummary(null, RIY).allocated, 0);
});
ok('municipalTarget: explicit row → ok; otherwise no_municipal_target with a null amount (never the Amanah target, never 0)', () => {
  const c = content({ municipalAllocations: [mr(RIY, rm[0], 100), mr(RIY, rm[1], 0)] });
  assert.deepEqual(R.municipalTarget(c, RIY, rm[0]), { state: 'ok', amount: 100, origin: 'manual', note: null });
  assert.equal(R.municipalTarget(c, RIY, rm[1]).state, 'ok'); assert.equal(R.municipalTarget(c, RIY, rm[1]).amount, 0); // an explicit zero is a target of 0
  const no = R.municipalTarget(c, RIY, rm[2]); assert.equal(no.state, 'no_municipal_target'); assert.equal(no.amount, null); assert.equal(no.reason, 'no_municipal_target'); assert.equal(no.label.ar, 'لم يُحدد مستهدف لهذه البلدية');
  assert.equal(R.municipalTarget(c, JED, rm[0]).state, 'no_municipal_target'); assert.equal(R.municipalTarget(content(), RIY, rm[0]).amount, null);
});

/* ---------- previews ---------- */
ok('previewDistributeMunicipalRemainder: equal — empty municipalities only, every changed row listed, unallocated before/after, the rounding remainder; manual rows untouched', () => {
  const c = content({ allocations: [{ entityKey: MAK, amount: 1000 }], scope: { kind: 'entities', entityKeys: [MAK] }, municipalAllocations: [mr(MAK, mm[0], 100)] });
  const p = R.previewDistributeMunicipalRemainder(c, MAK, { basis: 'equal' }); assert.equal(p.ok, true, JSON.stringify(p));
  assert.deepEqual(p.chosen, [mm[1], mm[2]]); assert.equal(p.pool, 900); assert.deepEqual(p.rows.map((r) => [r.muniId, r.before, r.after, r.delta]), [[mm[1], 0, 450, 450], [mm[2], 0, 450, 450]]);
  assert.equal(p.unallocatedBefore, 900); assert.equal(p.unallocatedAfter, 0); assert.equal(p.remainder.units, 0); assert.deepEqual(p.manualUntouched, [mm[0]]); assert.equal(p.rows[0].originAfter, 'distributed');
  const q = R.previewDistributeMunicipalRemainder(content({ allocations: [{ entityKey: MAK, amount: 1000 }], scope: { kind: 'entities', entityKeys: [MAK] } }), MAK, { basis: 'equal' }); // 1000 / 3
  assert.deepEqual(q.rows.map((r) => r.after), [334, 333, 333]); assert.equal(q.remainder.units, 1); assert.deepEqual(q.remainder.rows, [mm[0]]); assert.equal(sum(q.rows.map((r) => r.delta)), 1000); assert.equal(q.unallocatedAfter, 0);
  const a = R.applyMunicipalPreview(c, p); assert.equal(a.ok, true); assert.equal(R.municipalSummary(a.content, MAK).unallocated, 0); assert.deepEqual(c.municipalAllocations.length, 1); // the input is not mutated
  assert.equal(a.content.municipalAllocations.find((m) => m.muniId === mm[0]).origin, 'manual'); assert.equal(a.content.municipalAllocations.find((m) => m.muniId === mm[1]).origin, 'distributed');
  assert.deepEqual(R.validateDraft(a.content), { ok: true, errors: [] });
});
ok('previewDistributeMunicipalRemainder: rows choice, proportional, rounding on a large Amanah (47 municipalities), failures', () => {
  const c = content({ municipalAllocations: [mr(RIY, rm[0], 100), mr(RIY, rm[1], 300)] });
  const sel = R.previewDistributeMunicipalRemainder(c, RIY, { basis: 'equal', rows: [rm[0], rm[5]] }); assert.deepEqual(sel.chosen, [rm[0], rm[5]]); assert.equal(sum(sel.rows.map((r) => r.delta)), 200); // a row with an amount changes only when ticked in
  assert.deepEqual(sel.rows.map((r) => [r.muniId, r.after]), [[rm[0], 200], [rm[5], 100]]); assert.deepEqual(sel.manualUntouched, [rm[1]]);
  const pr = R.previewDistributeMunicipalRemainder(c, RIY, { basis: 'proportional', rows: [rm[0], rm[1]] }); assert.deepEqual(pr.rows.map((r) => [r.muniId, r.delta]), [[rm[0], 50], [rm[1], 150]]); assert.equal(pr.unallocatedAfter, 0);
  assert.equal(R.previewDistributeMunicipalRemainder(c, RIY, { basis: 'proportional' }).code, 'no_current_amounts'); // the default rows are the empty ones → no weights
  const big = R.previewDistributeMunicipalRemainder(content({ allocations: [{ entityKey: RIY, amount: 18_000_000_001 }], target: { amount: 18_000_000_001 } }), RIY, { basis: 'equal' });
  assert.equal(big.rows.length, 47); assert.equal(sum(big.rows.map((r) => r.after)), 18_000_000_001); assert.equal(big.remainder.rows.length, big.remainder.units); assert.ok(big.remainder.units > 0 && big.remainder.units < 47); assert.equal(big.unallocatedAfter, 0);
  assert.equal(R.previewDistributeMunicipalRemainder(c, RIY, { basis: 'appropriation' }).code, 'invalid_basis'); assert.equal(R.previewDistributeMunicipalRemainder(c, RIY, {}).code, 'invalid_basis');
  assert.equal(R.previewDistributeMunicipalRemainder(c, HOU, { basis: 'equal' }).code, 'no_municipalities'); assert.equal(R.previewDistributeMunicipalRemainder(content({ allocations: [] }), RIY, { basis: 'equal' }).code, 'no_entity_allocation');
  assert.equal(R.previewDistributeMunicipalRemainder(content({ municipalAllocations: [mr(RIY, rm[0], 600)] }), RIY, { basis: 'equal' }).code, 'no_remainder');
  assert.equal(R.previewDistributeMunicipalRemainder(c, RIY, { basis: 'equal', rows: ['MREF-X', jm[0]] }).code, 'no_rows'); // ids that are not the Amanah's are ignored
  for (const bad of [R.previewDistributeMunicipalRemainder(c, HOU, { basis: 'equal' }), R.previewDistributeMunicipalRemainder(c, RIY, {})]) assert.ok(bad.ar && bad.en);
});
ok('applyMunicipalPreview: stale / invalid previews are refused', () => {
  const c = content({ municipalAllocations: [mr(RIY, rm[0], 100)] }); const p = R.previewDistributeMunicipalRemainder(c, RIY, { basis: 'equal', rows: [rm[0], rm[1]] });
  const changed = clone(c); changed.municipalAllocations[0].amount = 101; const st = R.applyMunicipalPreview(changed, p); assert.equal(st.ok, false); assert.equal(st.code, 'stale_preview');
  assert.equal(R.applyMunicipalPreview(c, { ok: false }).code, 'invalid_preview'); assert.equal(R.applyMunicipalPreview(c, null).code, 'invalid_preview');
  const entityPreview = R.previewDistributeRemainder(content({ allocations: [] }), { basis: 'equal' }); assert.equal(R.applyMunicipalPreview(c, entityPreview).code, 'invalid_preview'); // an ENTITY preview cannot be applied as a municipal one
  const ok1 = R.applyMunicipalPreview(c, p); assert.equal(ok1.ok, true); assert.equal(R.municipalSummary(ok1.content, RIY).unallocated, 0);
});

/* ---------- monthly ---------- */
const EQ = fy; // January–December
ok('municipalMonthly: a municipality inherits the Amanah distribution; Σ municipalities + unallocated = the Amanah months to the riyal (equal profile, awkward numbers)', () => {
  const amounts = [1_234_567_891, 7, 3, 99_999_999, 12_345, 1, 2];
  const c = content({ allocations: [{ entityKey: RIY, amount: 1_000_000_007 }], municipalAllocations: amounts.slice(0, 4).map((a, i) => mr(RIY, rm[i * 3], a % 400_000_000 + i)) });
  const b = M.municipalMonthlyBreakdown(c, EQ, RIY); const planned = M.planMonthly(c, EQ).entities[RIY];
  assert.deepEqual(b.amanah, planned); assert.equal(b.reconciles, true); assert.equal(b.rows.length, 12);
  b.rows.forEach((_, i) => assert.equal(Object.values(b.municipalities).reduce((t, a) => t + a[i], 0) + b.unallocated[i], planned[i], `month ${i}`));
  assert.ok(b.unallocated.every((x) => Number.isInteger(x) && x >= 0)); assert.equal(sum(b.unallocated), b.unallocatedAmount); assert.equal(b.unallocatedAmount, 1_000_000_007 - b.allocated);
  for (const [id, arr] of Object.entries(b.municipalities)) { assert.ok(arr.every((x) => Number.isInteger(x) && x >= 0)); assert.equal(sum(arr), R.municipalTarget(c, RIY, id).amount); const ap = M.monthAmounts(R.municipalTarget(c, RIY, id).amount, c.distribution, b.rows).amounts; arr.forEach((v, i) => assert.ok(Math.abs(v - ap[i]) <= 1)); }
  const one = M.municipalMonthly(c, EQ, RIY, rm[3]); assert.equal(one.state, 'ok'); assert.deepEqual(one.amounts, b.municipalities[rm[3]]); assert.equal(one.amount, sum(one.amounts));
});
ok('municipalMonthly: complete split leaves unallocated exactly 0 each month; manual profile and an entity override are inherited; a municipality without a row has NO months (null, not 0)', () => {
  const comp = content({ allocations: [{ entityKey: MAK, amount: 1_000_003 }], scope: { kind: 'entities', entityKeys: [MAK] }, municipalAllocations: [mr(MAK, mm[0], 333_334), mr(MAK, mm[1], 333_334), mr(MAK, mm[2], 333_335)] });
  const b = M.municipalMonthlyBreakdown(comp, EQ, MAK); assert.equal(b.reconciles, true); assert.deepEqual(b.unallocated, new Array(12).fill(0)); assert.equal(b.unallocatedAmount, 0);
  const w = {}; for (let i = 1; i <= 12; i += 1) w[`2026-${String(i).padStart(2, '0')}`] = i === 1 ? 4000 : i === 2 ? 3000 : i === 3 ? 3000 : 0;
  const man = content({ allocations: [{ entityKey: RIY, amount: 1001 }, { entityKey: JED, amount: 999 }], distribution: { profile: 'equal' }, entityDistributions: { [RIY]: { profile: 'manual', weights: w } }, municipalAllocations: [mr(RIY, rm[0], 500), mr(RIY, rm[1], 1)] });
  const bm = M.municipalMonthlyBreakdown(man, EQ, RIY); assert.deepEqual(bm.amanah, M.planMonthly(man, EQ).entities[RIY]); assert.equal(bm.reconciles, true); assert.equal(bm.municipalities[rm[0]][3], 0); assert.ok(bm.municipalities[rm[0]][0] > bm.municipalities[rm[0]][1]);
  const no = M.municipalMonthly(man, EQ, RIY, rm[7]); assert.equal(no.state, 'no_municipal_target'); assert.equal(no.amounts, null); assert.equal(no.amount, null);
  assert.equal(M.municipalMonthly(man, EQ, JED, rm[0]).amounts, null);
  // a partial period (Oct-15 → Dec-31) also reconciles
  const pr = { start: '2026-10-15', end: '2026-12-31', preset: 'range' }; const cp = content({ period: pr, allocations: [{ entityKey: RIY, amount: 12345 }], municipalAllocations: [mr(RIY, rm[0], 4001), mr(RIY, rm[1], 3999)] });
  const bp = M.municipalMonthlyBreakdown(cp, pr, RIY); assert.equal(bp.reconciles, true); assert.equal(bp.rows.length, 3); assert.equal(sum(bp.amanah), 12345);
});
ok('municipalMonthly: random splits always reconcile exactly and never go negative; an excess falls back to independent apportionment and says so', () => {
  let seed = 7; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  for (let t = 0; t < 60; t += 1) {
    const total = Math.floor(rnd() * 5e9) + 1; const k = 1 + Math.floor(rnd() * 8); let left = Math.floor(total * rnd()); const rows = [];
    for (let i = 0; i < k; i += 1) { const a = i === k - 1 ? left : Math.floor(left * rnd()); rows.push(mr(RIY, rm[i * 2], a)); left -= a; }
    const c = content({ allocations: [{ entityKey: RIY, amount: total }], municipalAllocations: rows }); const b = M.municipalMonthlyBreakdown(c, EQ, RIY);
    assert.equal(b.reconciles, true, `trial ${t}`); assert.ok(b.unallocated.every((x) => x >= 0));
    assert.equal(sum(Object.values(b.municipalities).map(sum)) + sum(b.unallocated), total);
  }
  const ex = M.municipalMonthlyBreakdown(content({ municipalAllocations: [mr(RIY, rm[0], 700)] }), EQ, RIY); assert.equal(ex.excess, 100); assert.equal(ex.reconciles, false); assert.equal(sum(ex.municipalities[rm[0]]), 700); assert.deepEqual(ex.unallocated, new Array(12).fill(0));
  const orderA = M.municipalMonthlyBreakdown(content({ allocations: [{ entityKey: RIY, amount: 1001 }], municipalAllocations: [mr(RIY, rm[1], 333), mr(RIY, rm[0], 334)] }), EQ, RIY);
  const orderB = M.municipalMonthlyBreakdown(content({ allocations: [{ entityKey: RIY, amount: 1001 }], municipalAllocations: [mr(RIY, rm[0], 334), mr(RIY, rm[1], 333)] }), EQ, RIY); assert.deepEqual(orderA, orderB); // the typed order does not matter
  assert.equal(M.planMonthly(content({ municipalAllocations: [mr(RIY, rm[0], 100)] }), EQ).plan.length, 12); // planMonthly is untouched by municipal rows
  assert.deepEqual(M.planMonthly(content({ municipalAllocations: [mr(RIY, rm[0], 100)] }), EQ), M.planMonthly(content(), EQ));
});

/* ---------- access ---------- */
const wholeRiy = normalizeGeoScope({ grants: [entireAmanahGrant(RIY)] });
const someMuni = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [rm[0], rm[4]], direct: false, notSpecified: false }] });
const muniPlusDirect = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [rm[0]], direct: true, notSpecified: true }] });
const directOnly = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [], direct: true, notSpecified: false }] });
const allMuniNoDirect = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: 'all', direct: false, notSpecified: false }] });
const mixed = normalizeGeoScope({ grants: [entireAmanahGrant(JED), { amanah: RIY, municipalities: [rm[1]], direct: false, notSpecified: false }] });
const housing = normalizeGeoScope({ nonMunicipal: true });
const MIN = { kind: 'ministry' }; const E = (...k) => ({ kind: 'entities', entityKeys: k });
ok('authorisedMunicipalities / municipalCoverage / canViewMunicipality — the access matrix', () => {
  assert.deepEqual(A.authorisedMunicipalities(ALL_SCOPE, RIY), rm); assert.deepEqual(A.authorisedMunicipalities(wholeRiy, RIY), rm); assert.deepEqual(A.authorisedMunicipalities(wholeRiy, JED), []);
  assert.deepEqual(A.authorisedMunicipalities(someMuni, RIY), [rm[0], rm[4]]); assert.deepEqual(A.authorisedMunicipalities(allMuniNoDirect, RIY), rm); assert.deepEqual(A.authorisedMunicipalities(directOnly, RIY), []);
  assert.deepEqual(A.authorisedMunicipalities(EMPTY_SCOPE, RIY), []); assert.deepEqual(A.authorisedMunicipalities(undefined, RIY), []); assert.deepEqual(A.authorisedMunicipalities(ALL_SCOPE, HOU), []); assert.deepEqual(A.authorisedMunicipalities(housing, HOU), []);
  assert.deepEqual(A.authorisedMunicipalities(normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [rm[0], jm[0]], direct: true, notSpecified: true }] }), RIY), [rm[0]]); // a muni of another Amanah is never granted
  const cw = A.municipalCoverage(wholeRiy, RIY); assert.deepEqual([cw.covered, cw.whole, cw.all, cw.direct, cw.notSpecified], [true, true, true, true, true]);
  const cs = A.municipalCoverage(someMuni, RIY); assert.deepEqual([cs.covered, cs.whole, cs.all, cs.direct, cs.notSpecified], [true, false, false, false, false]);
  const ca = A.municipalCoverage(allMuniNoDirect, RIY); assert.deepEqual([ca.covered, ca.whole, ca.all], [true, false, true]); assert.equal(A.municipalCoverage(directOnly, RIY).direct, true);
  assert.deepEqual([A.municipalCoverage(wholeRiy, JED).covered, A.municipalCoverage(housing, HOU).whole, A.municipalCoverage(wholeRiy, HOU).covered], [false, true, false]);
  assert.equal(A.canViewMunicipality(ALL_SCOPE, RIY, rm[3]), true); assert.equal(A.canViewMunicipality(someMuni, RIY, rm[0]), true); assert.equal(A.canViewMunicipality(someMuni, RIY, rm[1]), false);
  assert.equal(A.canViewMunicipality(ALL_SCOPE, RIY, jm[0]), false); assert.equal(A.canViewMunicipality(ALL_SCOPE, RIY, 'MREF-X'), false); assert.equal(A.canViewMunicipality(wholeRiy, JED, jm[0]), false); assert.equal(A.canViewMunicipality(ALL_SCOPE, RIY, undefined), false);
  assert.deepEqual(A.municipalRowsOutsideGrants(someMuni, [mr(RIY, rm[0], 1), mr(RIY, rm[1], 1), mr(JED, jm[0], 1)]).map((r) => r.muniId), [rm[1], jm[0]]);
});
ok('canMutateScope / mutateDecision: unchanged rules (whole-Amanah grant) + reason «municipality» for a payload naming a municipality outside the grants', () => {
  assert.equal(A.canMutateScope(wholeRiy, E(RIY)), true); assert.equal(A.canMutateScope(someMuni, E(RIY)), false); assert.equal(A.canMutateScope(muniPlusDirect, E(RIY)), false); assert.equal(A.canMutateScope(ALL_SCOPE, MIN), true);
  assert.equal(A.mutateDecision(someMuni, E(RIY), { municipalities: [mr(RIY, rm[0], 1)] }).reason, 'scope'); // the whole-Amanah rule still applies to municipal-allocation mutations
  assert.deepEqual(A.mutateDecision(wholeRiy, E(RIY), { municipalities: [mr(RIY, rm[0], 1), mr(RIY, rm[9], 1)] }), { ok: true, reason: null });
  const d = A.mutateDecision(wholeRiy, E(RIY), { municipalities: [mr(RIY, rm[0], 1), mr(RIY, jm[0], 1)] }); assert.equal(d.ok, false); assert.equal(d.reason, 'municipality'); assert.deepEqual(d.municipalities.map((r) => r.muniId), [jm[0]]);
  assert.equal(A.mutateDecision(wholeRiy, E(RIY), { municipalities: [mr(JED, jm[0], 1)] }).reason, 'municipality'); // an Amanah the actor does not hold
  assert.equal(A.mutateDecision(ALL_SCOPE, MIN, { municipalities: [mr(RIY, jm[0], 1)] }).reason, 'municipality'); assert.equal(A.canMutateScope(ALL_SCOPE, MIN, { municipalities: [mr(RIY, rm[0], 1)] }), true);
  assert.equal(A.mutateDecision(ALL_SCOPE, MIN, { readOnly: true, municipalities: [mr(RIY, jm[0], 1)] }).reason, 'read_only_role'); // earlier reasons win
  assert.deepEqual(A.mutateDecision(wholeRiy, E(RIY), { municipalities: [] }), { ok: true, reason: null }); assert.deepEqual(A.mutateDecision(wholeRiy, E(RIY)), { ok: true, reason: null });
  assert.equal(A.canSetReference(wholeRiy), false); assert.equal(A.canSetReference(ALL_SCOPE), true);
});

/* ---------- masking ---------- */
const masked = (c, geo) => R.maskPlanForViewer(plan(c), A.visibleEntityKeysOfScope(geo), geo).versions[0].content;
const mc = () => content({ target: { amount: 1000, basis: { method: 'budget_x_coverage', coverage: 0.5, budget: 2000, at: null } }, advanced: { collectionRate: 0.8 }, entityDistributions: { [RIY]: { profile: 'equal' } },
  municipalAllocations: [mr(RIY, rm[0], 100), mr(RIY, rm[1], 150), mr(RIY, rm[4], 50), mr(JED, jm[0], 90), mr(JED, jm[1], 10)] });
ok('maskPlanForViewer(plan, vis, geoScope): whole-Amanah viewer — as today, every municipal row visible, the Amanah amount visible', () => {
  const c = mc(); const m = R.maskPlanForViewer(plan(c), A.visibleEntityKeysOfScope(wholeRiy), wholeRiy); const x = m.versions[0].content;
  assert.deepEqual(x.allocations.map((a) => [a.entityKey, a.amount]), [[RIY, 600]]); assert.equal(x.target.amount, 600); assert.equal(x.target.label.ar, 'إجمالي الجهات المتاحة لك'); assert.deepEqual(x.municipalAllocations.map((r) => r.muniId), [rm[0], rm[1], rm[4]]);
  assert.equal(x.maskedAmanahKeys, undefined); assert.equal(m.municipalOnlyEntityKeys, undefined); assert.equal(R.municipalSummary(x, RIY).unallocated, 300); assert.equal(R.municipalSummary(x, RIY).amanahHidden, false);
  assert.equal(x.advanced && Object.keys(x.advanced).length, 0); assert.equal(x.target.basis, undefined);
  const all = R.maskPlanForViewer(plan(c), A.visibleEntityKeysOfScope(ALL_SCOPE), ALL_SCOPE); assert.equal(all.masked, undefined); assert.deepEqual(all.versions[0].content, c);
  assert.deepEqual(R.maskPlanForViewer(plan(c), R.entityUniverse()).versions[0].content, c); // no geoScope, all visible: unchanged copy
  const ent = plan(content({ scope: E(RIY), allocations: [{ entityKey: RIY, amount: 1000 }], municipalAllocations: [mr(RIY, rm[0], 5)] })); assert.equal(R.maskPlanForViewer(ent, [RIY], wholeRiy).masked, undefined);
});
ok('maskPlanForViewer: municipal-only viewer — the Amanah allocation is HIDDEN, only their municipalities, target = their Σ (none ⇒ null); nothing to compute the total or the unallocated by difference', () => {
  const c = mc(); const m = R.maskPlanForViewer(plan(c), A.visibleEntityKeysOfScope(someMuni), someMuni); const x = m.versions[0].content;
  assert.equal(m.masked, true); assert.deepEqual(m.municipalOnlyEntityKeys, [RIY]); assert.deepEqual(x.allocations, []); assert.deepEqual(x.municipalAllocations.map((r) => [r.muniId, r.amount]), [[rm[0], 100], [rm[4], 50]]);
  assert.equal(x.target.amount, 150); assert.equal(x.target.masked, true); assert.equal(x.target.label.ar, 'إجمالي الجهات المتاحة لك'); assert.deepEqual(x.maskedAmanahKeys, [RIY]); assert.deepEqual(x.municipalVisibility, { [RIY]: [rm[0], rm[4]] });
  const s = R.municipalSummary(x, RIY); assert.equal(s.amanahHidden, true); assert.equal(s.amanahAmount, null); assert.equal(s.unallocated, null); assert.equal(s.excess, null); assert.equal(s.complete, false); assert.ok(s.rows.every((r) => r.share === null));
  assert.deepEqual(s.municipalities.map((r) => r.muniId), [rm[0], rm[4]]); // only the municipalities they may see (the others are not listed as «no target»)
  const dump = JSON.stringify(m); for (const secret of ['"amount":600', '"amount":1000', '"amount":400', '"amount":300', rm[1], jm[0], 'collectionRate', 'budget']) assert.equal(dump.includes(secret), false, secret);
  assert.equal(R.previewDistributeMunicipalRemainder(x, RIY, { basis: 'equal' }).code, 'amanah_hidden');
  const nothing = normalizeGeoScope({ grants: [{ amanah: RIY, municipalities: [rm[8]], direct: false, notSpecified: false }] }); const nx = masked(mc(), nothing); // a municipality with no row
  assert.equal(nx.target.amount, null); assert.deepEqual(nx.allocations, []); assert.equal(nx.municipalAllocations, undefined); assert.equal(R.municipalTarget(nx, RIY, rm[8]).state, 'no_municipal_target'); assert.equal(nx.target.label.ar, 'إجمالي الجهات المتاحة لك');
  assert.equal(masked(mc(), muniPlusDirect).target.amount, 100); assert.equal(masked(mc(), directOnly).target.amount, null); // direct-only: no municipality, no Amanah amount
  assert.equal(masked(mc(), allMuniNoDirect).target.amount, 300); assert.equal(masked(mc(), allMuniNoDirect).allocations.length, 0); // every municipality, but not the whole-Amanah grant → still no Amanah amount
});
ok('maskPlanForViewer: a mixed viewer (whole Jeddah + some Riyadh municipalities) gets Σ = Jeddah allocation + their Riyadh rows; the Riyadh Amanah amount stays hidden; older callers (no geoScope) behave as before', () => {
  const m = R.maskPlanForViewer(plan(mc()), A.visibleEntityKeysOfScope(mixed), mixed); const x = m.versions[0].content;
  assert.deepEqual(x.allocations.map((a) => [a.entityKey, a.amount]), [[JED, 400]]); assert.equal(x.target.amount, 400 + 150); assert.deepEqual(m.municipalOnlyEntityKeys, [RIY]);
  assert.deepEqual(x.municipalAllocations.filter((r) => r.entityKey === JED).map((r) => r.amount), [90, 10]); assert.deepEqual(x.municipalAllocations.filter((r) => r.entityKey === RIY).map((r) => r.muniId), [rm[1]]);
  const s = R.municipalSummary(x, JED); assert.equal(s.amanahHidden, false); assert.equal(s.unallocated, 300); assert.equal(R.municipalSummary(x, RIY).amanahHidden, true);
  assert.equal(x.target.amount, 550); assert.equal(JSON.stringify(m).includes('"amount":600'), false);
  // without the 3rd argument (the earlier behaviour): any grant shows the Amanah allocation, rows of invisible entities are still removed
  const old = R.maskPlanForViewer(plan(mc()), [RIY]).versions[0].content; assert.deepEqual(old.allocations.map((a) => a.amount), [600]); assert.equal(old.target.amount, 600); assert.deepEqual(old.municipalAllocations.map((r) => r.entityKey), [RIY, RIY, RIY]);
  const noMuni = plan(content()); assert.deepEqual(R.maskPlanForViewer(noMuni, [RIY]).versions[0].content.allocations.length, 1); assert.equal('municipalAllocations' in R.maskPlanForViewer(noMuni, [RIY]).versions[0].content, false);
  const wk = R.maskPlanForViewer(plan(mc()), A.visibleEntityKeysOfScope(someMuni), someMuni); assert.equal(wk.content.target.amount, 150); assert.equal(JSON.stringify(wk).includes('"amount":600'), false); // the saved content and every snapshot are masked
  const orig = plan(mc()); const snap = clone(orig); R.maskPlanForViewer(orig, [RIY], someMuni); assert.deepEqual(orig, snap);
});

/* ---------- view scope ---------- */
ok('viewScopeOf: default is the whole Amanah; options hold ONLY authorised municipalities; invalid values reset to all with a reason', () => {
  const v = A.viewScopeOf({ amanah: RIY, muni: 'all' }, { geoScope: ALL_SCOPE }); assert.equal(v.amanah, RIY); assert.equal(v.muni, 'all'); assert.equal(v.invalidReason, null); assert.equal(v.municipalityOptions.length, 47); assert.equal(v.showMunicipality, true); assert.equal(v.muniFilterValue, null);
  assert.deepEqual(Object.keys(v.municipalityOptions[0]), ['muniId', 'key', 'name']); assert.equal(v.municipalityOptions[0].key, `${RIY}|${rm[0]}`); assert.ok(v.municipalityOptions[0].name.ar && v.municipalityOptions[0].name.en);
  const s = A.viewScopeOf({ amanah: RIY, muni: rm[4] }, { geoScope: someMuni }); assert.deepEqual(s.municipalityOptions.map((o) => o.muniId), [rm[0], rm[4]]); assert.equal(s.muni, rm[4]); assert.equal(s.muniFilterValue, `${RIY}|${rm[4]}`); assert.equal(s.isDefault, false);
  const bad = A.viewScopeOf({ amanah: RIY, muni: rm[1] }, { geoScope: someMuni }); assert.equal(bad.muni, 'all'); assert.equal(bad.invalidReason, 'municipality_not_authorised'); assert.equal(bad.muniFilterValue, null);
  const foreign = A.viewScopeOf({ amanah: RIY, muni: jm[0] }, { geoScope: ALL_SCOPE }); assert.equal(foreign.muni, 'all'); assert.equal(foreign.invalidReason, 'municipality_not_in_amanah');
  const noAm = A.viewScopeOf({ amanah: 'all', muni: rm[0] }, { geoScope: ALL_SCOPE }); assert.equal(noAm.muni, 'all'); assert.equal(noAm.invalidReason, 'municipality_without_amanah'); assert.deepEqual(noAm.municipalityOptions, []); assert.equal(noAm.showMunicipality, false); assert.equal(noAm.isDefault, true);
  const unk = A.viewScopeOf({ amanah: 'Nowhere', muni: rm[0] }, { geoScope: ALL_SCOPE }); assert.deepEqual([unk.amanah, unk.muni, unk.invalidReason], ['all', 'all', 'unknown_amanah']);
  const na = A.viewScopeOf({ amanah: JED, muni: jm[0] }, { geoScope: wholeRiy }); assert.deepEqual([na.amanah, na.muni, na.invalidReason], ['all', 'all', 'amanah_not_authorised']); assert.deepEqual(na.amanahOptions, [RIY]);
  assert.deepEqual(A.viewScopeOf(undefined, { geoScope: ALL_SCOPE }).amanah, 'all'); assert.deepEqual(A.viewScopeOf({}, { geoScope: ALL_SCOPE }).muni, 'all'); assert.deepEqual(A.viewScopeOf({ amanah: RIY }, { geoScope: EMPTY_SCOPE }).amanah, 'all');
  assert.deepEqual(A.viewScopeOf({}, { geoScope: ALL_SCOPE }).amanahOptions, R.entityUniverse());
});
ok('viewScopeOf: the field is hidden when there is nothing to choose (no municipalities, or none authorised)', () => {
  const h = A.viewScopeOf({ amanah: HOU }, { geoScope: ALL_SCOPE }); assert.equal(h.amanah, HOU); assert.deepEqual(h.municipalityOptions, []); assert.equal(h.showMunicipality, false);
  const d = A.viewScopeOf({ amanah: RIY }, { geoScope: directOnly }); assert.equal(d.amanah, RIY); assert.equal(d.showMunicipality, false); assert.deepEqual(d.municipalityOptions, []);
  const hs = A.viewScopeOf({ amanah: HOU }, { geoScope: housing }); assert.equal(hs.amanah, HOU); assert.equal(hs.showMunicipality, false);
  assert.equal(municipalityCountOf(HOU), 0); assert.equal(A.viewScopeOf({ amanah: MAK }, { geoScope: ALL_SCOPE }).municipalityOptions.length, 3);
});
ok('resetMuniOnAmanahChange: changing the Amanah clears the municipality; same Amanah keeps it', () => {
  assert.deepEqual(A.resetMuniOnAmanahChange({ amanah: RIY, muni: rm[0] }, { amanah: JED, muni: rm[0] }), { amanah: JED, muni: 'all' });
  assert.deepEqual(A.resetMuniOnAmanahChange({ amanah: RIY, muni: rm[0] }, { amanah: RIY, muni: rm[3] }), { amanah: RIY, muni: rm[3] });
  assert.deepEqual(A.resetMuniOnAmanahChange({ amanah: 'all', muni: 'all' }, { amanah: RIY }), { amanah: RIY, muni: 'all' }); assert.deepEqual(A.resetMuniOnAmanahChange({ amanah: RIY, muni: rm[0] }, { amanah: 'all', muni: rm[0] }), { amanah: 'all', muni: 'all' });
  assert.deepEqual(A.resetMuniOnAmanahChange(undefined, undefined), { amanah: 'all', muni: 'all' });
});

/* ---------- save of a municipal plan end to end (spec §10 save checks; the activation functions above are the legacy equivalents) ---------- */
ok('end to end (legacy activation checks): draft with an excess saves, activation blocks; distributing the remainder completes the split and activation passes', () => {
  const draft = content({ allocations: [{ entityKey: MAK, amount: 1000 }], target: { amount: 1000 }, scope: E(MAK), municipalAllocations: [mr(MAK, mm[0], 1200)] });
  assert.equal(R.validateDraft(draft).ok, true); assert.deepEqual(R.saveChecks(draft, acts).failed, ['municipal_within_entity']);
  const fixed = clone(draft); fixed.municipalAllocations[0].amount = 400; const p = R.previewDistributeMunicipalRemainder(fixed, MAK, { basis: 'equal' }); const done = R.applyMunicipalPreview(fixed, p).content;
  assert.equal(R.saveChecks(done, acts).ok, true, JSON.stringify(R.saveChecks(done, acts).failed)); assert.equal(R.municipalSummary(done, MAK).complete, true);
  assert.equal(R.saveChecks(done, { actorScope: normalizeGeoScope({ grants: [entireAmanahGrant(MAK)] }) }).ok, true);
  assert.deepEqual(R.saveChecks(done, { actorScope: someMuni }).failed, ['actor_authorised']);
});

ok('end to end (§10): an excess fails saveChecks with only municipal_within_entity; the explicit distribute action completes the split and the save passes; only a whole-Amanah actor is authorised; a plan WITHOUT municipal rows has no 7th check', () => {
  const draft = content({ allocations: [{ entityKey: MAK, amount: 1000 }], target: { amount: 1000 }, scope: E(MAK), municipalAllocations: [mr(MAK, mm[0], 1200)] });
  const bad = R.saveChecks(draft, acts); assert.equal(bad.ok, false); assert.deepEqual(bad.failed, ['municipal_within_entity']); assert.deepEqual(bad.checks.map((c) => c.id), R.SAVE_CHECK_IDS); assert.equal(bad.checks[6].params.entities[0].excess, 200);
  const fixed = clone(draft); fixed.municipalAllocations[0].amount = 400; const done = R.applyMunicipalPreview(fixed, R.previewDistributeMunicipalRemainder(fixed, MAK, { basis: 'equal' })).content;
  assert.equal(R.saveChecks(done, acts).ok, true); assert.equal(R.saveChecks(done, { actorScope: normalizeGeoScope({ grants: [entireAmanahGrant(MAK)] }) }).ok, true);
  assert.deepEqual(R.saveChecks(done, { actorScope: someMuni }).failed, ['actor_authorised']);
  assert.deepEqual(R.saveChecks(content({ scope: E(RIY), allocations: [{ entityKey: RIY, amount: 1000 }], target: { amount: 1000 } }), acts).checks.map((c) => c.id), R.BASE_SAVE_CHECK_IDS);
});

console.log(`plans municipal: ${n} test groups passed`);
