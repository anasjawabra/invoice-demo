// Revenue plans — SERVER-SIDE enforcement of the municipality dimension (docs/revenue-plans-spec.md §9, «Implementation notes — B2»).
// Run: npm run test:plansservermuni — HTTP-level through handleApi with signed tokens of the real identity module (IN-MEMORY identity store) and the plans store in memory. Synthetic data only.
// Proves (on the simplified §10 model: named SAVED plans, PUT saves, no draft / activation): a municipal-only viewer never receives the Amanah amount / the unallocated figure / the plan total (list, get, version, audit, references, capabilities — the JSON is scanned for the hidden numbers);
// whole-Amanah and Ministry-level actors are unchanged; a mutation naming an unauthorised municipality is 403 `municipality`, an unknown / foreign / duplicate municipality is 400; an excess fails the save checks (422);
// a view-scope read naming a municipality outside the grants is 403 (400 for unknown / not-of-the-Amanah); the data-service endpoints return nothing for a municipality outside the grants.
import assert from 'node:assert/strict';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { normalizeGeoScope, entireAmanahGrant, ALL_SCOPE } from '../src/data/geoScope.js';
import { resetForTests, getDb, issueToken } from '../server/identity/index.js';
import { commit } from '../server/identity/store.js';
import { hashPassword } from '../server/identity/crypto.js';
import { handleApi } from '../server/api.js';
import { loadStore } from '../server/store.js';
import { resetPlanStore, planStore, SEED_PLAN_ID } from '../server/plans/store.js';

let n = 0; const pending = [];
const ok = (name, fn) => { const run = async () => { try { await fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } }; pending.push(run); };
process.env.IIM_PLANS_FILE = ':memory:';
resetForTests(':memory:');
resetPlanStore(':memory:');
const TODAY = '2026-11-06';
loadStore(TODAY, { size: 'compact' });

/* ------------------------------------------------------------------ users (isolated, in-memory identity store) */
let seq = 0; const stamp = new Date().toISOString();
function mkUser(modules, scope = ALL_SCOPE, { readOnly = false } = {}) {
  const db = getDb(); seq += 1;
  db.roles.push({ id: `role-m${seq}`, nameAr: `دور ${seq}`, nameEn: `Muni role ${seq}`, descriptionAr: '', descriptionEn: '', modules: [...modules], readOnly, starter: false, protected: false, createdAt: stamp, updatedAt: stamp });
  const user = { id: `usr-m${seq}`, username: `m${seq}`, email: null, nameAr: `مستخدم ${seq}`, nameEn: `User ${seq}`, avatar: 'M', status: 'active', roleId: `role-m${seq}`, scope, tokenVersion: 1, createdAt: stamp, createdBy: 'test', updatedAt: stamp, lastLoginAt: null, credential: hashPassword('Test-pass-1234') };
  db.users.push(user); commit();
  return { user, token: issueToken(user) };
}
const JED = 'Jeddah Amanah'; const RIY = 'Riyadh Amanah';
const jm = municipalitiesOf(JED).map((m) => m.refId); const rm = municipalitiesOf(RIY).map((m) => m.refId);
const munis = (amanah, ids, extra = {}) => ({ amanah, municipalities: ids, direct: false, notSpecified: false, ...extra });
const sc = (...grants) => normalizeGeoScope({ all: false, nonMunicipal: false, grants });
const ADMIN = mkUser(['planning', 'dashboard']);                                              // Ministry level (all entities)
const JED_WHOLE = mkUser(['planning'], sc(entireAmanahGrant(JED)));                      // the whole Jeddah Amanah
const JED_TWO = mkUser(['planning', 'dashboard'], sc(munis(JED, [jm[0], jm[1]])));       // municipal-only: two municipalities
const JED_ONE = mkUser(['planning', 'dashboard'], sc(munis(JED, [jm[2]])));                           // municipal-only: one municipality (the third)
const JED_NONE = mkUser(['planning'], sc(munis(JED, [jm[9]])));                          // municipal-only: a municipality that has NO row in the plan
const JED_ALL_MUNIS = mkUser(['planning'], sc({ amanah: JED, municipalities: 'all', direct: false, notSpecified: false })); // every municipality but not the direct / not-specified groups -> NOT whole
const RIY_WHOLE = mkUser(['planning'], sc(entireAmanahGrant(RIY)));
const AUDITOR = mkUser(['planning'], ALL_SCOPE, { readOnly: true });

/* ------------------------------------------------------------------ HTTP */
const ALL_TEXT = [];
function call(u, method, p, body) {
  return new Promise((resolve) => {
    const res = { chunks: [], writeHead(c, h) { this.code = c; this.headers = h || {}; }, write(c) { this.chunks.push(String(c)); return true; }, once() {}, end(b) { const t = b !== undefined ? b : this.chunks.join(''); ALL_TEXT.push(t); let j = null; try { j = JSON.parse(t); } catch { /* */ } resolve({ code: this.code, headers: this.headers, text: t, body: j }); } };
    handleApi({ method, url: `/api${p}${p.includes('?') ? '&' : '?'}today=${TODAY}`, headers: { ...(u && u.token ? { authorization: `Bearer ${u.token}` } : {}) }, body: method === 'GET' ? undefined : JSON.parse(JSON.stringify(body || {})) }, res);
  });
}
const get = (u, p) => call(u, 'GET', p); const post = (u, p, b) => call(u, 'POST', p, b); const put = (u, p, b) => call(u, 'PUT', p, b);
const J = (x) => JSON.parse(JSON.stringify(x));
const sum = (a) => a.reduce((t, x) => t + x, 0);
const FY = { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' };
const FY27 = { start: '2027-01-01', end: '2027-12-31', preset: 'fiscal-year' };
const hasNum = (value, num) => new RegExp(`(?<![\\d.])${num}(?![\\d])`).test(typeof value === 'string' ? value : JSON.stringify(value));
const mr = (entityKey, muniId, amount) => ({ entityKey, muniId, amount, origin: 'manual' });

/* ------------------------------------------------------------------ the fixture plan: scope [Jeddah, Riyadh]; distinctive amounts so a leak (or a derivation) is detectable by scanning the JSON */
const A_JED = 6543210; const A_RIY = 3456790; const TARGET = A_JED + A_RIY;                // 10 000 000
const M0 = 1111111; const M1 = 2222222; const M2 = 3000001; const M_SUM = M0 + M1 + M2;    // 6 333 334
const UNALLOC = A_JED - M_SUM;                                                              // 209 876 («غير موزع على البلديات»)
const HIDDEN_FOR_TWO = [A_JED, A_RIY, TARGET, M2, M_SUM, UNALLOC];                          // JED_TWO may know M0, M1 and their sum only
const HIDDEN_FOR_ONE = [A_JED, A_RIY, TARGET, M0, M1, M0 + M1, M_SUM, UNALLOC];
const contentOf = (name = 'خطة البلديات الاختبارية', rows = null) => ({
  name, scope: { kind: 'entities', entityKeys: [JED, RIY] }, period: FY, target: { amount: TARGET },
  allocations: [{ entityKey: JED, amount: A_JED, origin: 'manual' }, { entityKey: RIY, amount: A_RIY, origin: 'manual' }],
  municipalAllocations: rows || [mr(JED, jm[0], M0), mr(JED, jm[1], M1), mr(JED, jm[2], M2)], distribution: { profile: 'equal' }, advanced: {}
});
/** save a NEW plan (POST) → the plan record; names are made unique per call */
let nameSeq = 0; const uniq = (name) => `${name} #${(nameSeq += 1)}`;
async function saved(u, content) { const c = await post(u, '/plans', { name: uniq(content.name), content }); assert.equal(c.code, 201, c.text); return c.body.plan; }
let PLAN = null;
const seedFull = async () => (await get(ADMIN, `/plans/${SEED_PLAN_ID}`)).body.plan.content;

/* ================================================================== 1. the Ministry-level admin is unchanged */
ok('Ministry-level admin: saves a plan with municipal rows (save checks incl. municipal_within_entity pass); sees every amount, no masking, no municipalCoverage; a plan WITHOUT municipal rows is saved with exactly the 6 base checks', async () => {
  PLAN = await saved(ADMIN, contentOf()); assert.equal(PLAN.masked, undefined); assert.equal(PLAN.viewer.canEdit, true); assert.equal(PLAN.createdBy.userId, ADMIN.user.id);
  const c = PLAN.content; assert.equal(c.target.amount, TARGET); assert.equal(c.target.masked, undefined);
  assert.deepEqual(c.allocations.map((x) => x.amount), [A_JED, A_RIY]); assert.deepEqual(c.municipalAllocations.map((x) => x.amount), [M0, M1, M2]);
  assert.equal(c.maskedAmanahKeys, undefined); assert.equal(c.municipalVisibility, undefined); assert.equal(PLAN.municipalOnlyEntityKeys, undefined);
  const list = await get(ADMIN, '/plans'); assert.equal(list.code, 200); assert.equal(list.body.capabilities.municipalCoverage, undefined, 'an all-entities actor has no restricted coverage');
  assert.equal(list.body.viewScope, undefined, 'no view scope named -> none echoed (ordinary reads unchanged)');
  assert.ok(list.body.plans.some((x) => x.id === PLAN.id && x.content.target.amount === TARGET));
  const rules = await import('../src/data/plans/planRules.js'); assert.deepEqual(rules.saveChecks(contentOf(), { actorScope: ALL_SCOPE }).checks.map((x) => x.id), rules.SAVE_CHECK_IDS);
  const plain = await saved(ADMIN, { ...contentOf('خطة بلا بلديات', []), scope: { kind: 'entities', entityKeys: [RIY] }, target: { amount: A_RIY }, allocations: [{ entityKey: RIY, amount: A_RIY }], municipalAllocations: undefined }); assert.equal(plain.content.municipalAllocations, undefined);
  assert.deepEqual(rules.saveChecks(plain.content, { actorScope: ALL_SCOPE }).checks.map((x) => x.id), rules.BASE_SAVE_CHECK_IDS);
});

/* ================================================================== 2. whole-Amanah viewer */
ok('whole-Amanah user (Jeddah): sees the Jeddah allocation and ALL its municipal rows, never the Riyadh allocation or the plan total; target = Σ visible; cannot edit a [Jeddah, Riyadh] plan', async () => {
  const g = await get(JED_WHOLE, `/plans/${PLAN.id}`); assert.equal(g.code, 200); const c = g.body.plan.content;
  assert.equal(g.body.plan.masked, true); assert.deepEqual(c.allocations.map((a) => [a.entityKey, a.amount]), [[JED, A_JED]]); assert.deepEqual(c.municipalAllocations.map((m) => m.amount), [M0, M1, M2]);
  assert.equal(c.target.amount, A_JED); assert.equal(c.target.masked, true); assert.equal(c.maskedAmanahKeys, undefined, 'a whole-Amanah grant hides nothing of its own Amanah'); assert.equal(g.body.plan.municipalOnlyEntityKeys, undefined);
  for (const h of [A_RIY, TARGET]) assert.ok(!hasNum(g.text, h), `no ${h}`);
  assert.equal(g.body.plan.viewer.canEdit, false);
  const r = await put(JED_WHOLE, `/plans/${PLAN.id}`, { revision: g.body.plan.revision, content: contentOf() }); assert.equal(r.code, 403); assert.equal(r.body.reason, 'scope');
});

/* ================================================================== 3. municipal-only viewers: masked reads */
ok('municipal-only viewer (two municipalities): list / get / version / audit contain no Amanah amount, unallocated, plan total or the other municipality; only their allocations; target = Σ visible', async () => {
  const g = await get(JED_TWO, `/plans/${PLAN.id}`); assert.equal(g.code, 200); const p = g.body.plan; const c = p.content;
  assert.equal(p.masked, true); assert.deepEqual(p.municipalOnlyEntityKeys, [JED]); assert.deepEqual(c.allocations, [], 'the Amanah allocation is not returned');
  assert.deepEqual(c.municipalAllocations.map((m) => [m.muniId, m.amount]), [[jm[0], M0], [jm[1], M1]]);
  assert.equal(c.target.amount, M0 + M1); assert.equal(c.target.masked, true); assert.equal(c.target.label.ar, 'إجمالي الجهات المتاحة لك');
  assert.deepEqual(c.maskedAmanahKeys, [JED]); assert.deepEqual(c.municipalVisibility[JED], [jm[0], jm[1]]); assert.deepEqual(c.scope.entityKeys, [JED], 'the other Amanah is not even named');
  assert.equal(p.viewer.canEdit, false); assert.equal(p.working, undefined); assert.equal(p.legacy, null); assert.deepEqual(c.advanced, {}); assert.equal(c.target.basis, undefined);
  const scan = (label, v) => { for (const h of HIDDEN_FOR_TWO) assert.ok(!hasNum(v, h), `${label}: leaks ${h}`); assert.ok(!JSON.stringify(v).includes(RIY), `${label}: names ${RIY}`); assert.ok(!JSON.stringify(v).includes(jm[2]), `${label}: names the hidden municipality`); };
  scan('get', g.text);
  const list = await get(JED_TWO, '/plans'); assert.equal(list.code, 200); scan('list', JSON.stringify(list.body.plans.filter((x) => x.id === PLAN.id)));
  assert.equal(list.body.plans.find((x) => x.id === PLAN.id).content.target.amount, M0 + M1);
  const v = await get(JED_TWO, `/plans/${PLAN.id}/versions/1`); assert.equal(v.code, 200); scan('version', v.text);
  assert.equal(v.body.version.content.target.amount, M0 + M1); assert.deepEqual(v.body.version.content.allocations, []); assert.equal(v.body.view.content.target.amount, M0 + M1); assert.deepEqual(v.body.view.content.municipalAllocations.map((m) => m.amount), [M0, M1]);
  const au = await get(JED_TWO, `/plans/${PLAN.id}/audit`); assert.equal(au.code, 200); scan('audit', au.text); assert.ok(au.body.entries.length > 0);
  for (const e of au.body.entries) assert.ok(!/\d{4,}/.test(`${e.summary.ar} ${e.summary.en}`), 'an audit summary never embeds an amount');
  // the whole serialized list (including the seed plan) never reveals the full Ministry figures either
  const seedC = await seedFull(); const lt = JSON.stringify(list.body.plans);
  for (const h of [seedC.target.amount, ...seedC.allocations.map((a) => a.amount)]) assert.ok(!hasNum(lt, h), `the seed plan leaks ${h}`);
  const seedMasked = list.body.plans.find((x) => x.id === SEED_PLAN_ID); assert.equal(seedMasked.content.target.amount, null, 'no municipal row in the seed -> no target for a municipal-only viewer (never 0, never the Amanah\'s)');
  assert.deepEqual(seedMasked.content.allocations, []);
});
ok('municipal-only viewer (one municipality): sees only that municipality; target = its amount; the other municipalities and every derivable sum are absent', async () => {
  const g = await get(JED_ONE, `/plans/${PLAN.id}`); const c = g.body.plan.content;
  assert.deepEqual(c.municipalAllocations.map((m) => [m.muniId, m.amount]), [[jm[2], M2]]); assert.equal(c.target.amount, M2); assert.deepEqual(c.allocations, []);
  for (const h of HIDDEN_FOR_ONE) assert.ok(!hasNum(g.text, h), `leaks ${h}`);
  for (const p of [`/plans/${PLAN.id}/versions/1`, `/plans/${PLAN.id}/audit`, '/plans', '/plans/references']) { const r = await get(JED_ONE, p); assert.equal(r.code, 200, p); for (const h of HIDDEN_FOR_ONE) assert.ok(!hasNum(r.text, h), `${p} leaks ${h}`); }
});
ok('municipal-only viewer with NO row in the plan: the plan is visible but the target is null (labelled), never 0 and never the Amanah\'s; a grant of EVERY municipality without direct/not-specified is still not whole-Amanah', async () => {
  const g = await get(JED_NONE, `/plans/${PLAN.id}`); const c = g.body.plan.content;
  assert.equal(c.target.amount, null); assert.equal(c.target.masked, true); assert.deepEqual(c.allocations, []); assert.equal(c.municipalAllocations, undefined);
  for (const h of HIDDEN_FOR_ONE.concat([M2])) assert.ok(!hasNum(g.text, h), `leaks ${h}`);
  const all = await get(JED_ALL_MUNIS, `/plans/${PLAN.id}`); const ca = all.body.plan.content;
  assert.deepEqual(ca.allocations, [], 'every municipality is not the whole Amanah: the Amanah allocation stays hidden'); assert.equal(ca.target.amount, M_SUM); assert.deepEqual(ca.municipalAllocations.map((m) => m.amount), [M0, M1, M2]);
  assert.ok(!hasNum(all.text, A_JED) && !hasNum(all.text, UNALLOC) && !hasNum(all.text, TARGET));
  const riy = await get(RIY_WHOLE, `/plans/${PLAN.id}`); assert.deepEqual(riy.body.plan.content.allocations.map((a) => [a.entityKey, a.amount]), [[RIY, A_RIY]]); assert.equal(riy.body.plan.content.municipalAllocations, undefined, 'another Amanah\'s viewer gets no Jeddah rows');
  assert.ok(!hasNum(riy.text, A_JED) && !hasNum(riy.text, M0));
});
ok('a SAVE by an editor is what every viewer reads next (masked per grant); the previous snapshot stays readable through /versions/:n, masked identically; nothing about an unsaved change exists on the server', async () => {
  const cur = (await get(ADMIN, `/plans/${PLAN.id}`)).body.plan; const rev = J(cur.content); rev.municipalAllocations[0].amount = 1111119; rev.municipalAllocations[2].amount = 2999993;
  assert.equal((await get(JED_TWO, `/plans/${PLAN.id}`)).body.plan.content.target.amount, M0 + M1, 'before the save');
  const s = await put(ADMIN, `/plans/${PLAN.id}`, { revision: cur.revision, content: rev }); assert.equal(s.code, 200, s.text);
  for (const u of [JED_TWO, JED_ONE, JED_WHOLE, AUDITOR]) { const g = await get(u, `/plans/${PLAN.id}`); assert.equal(g.body.plan.working, undefined); assert.equal(g.body.plan.hasWorking, undefined); }
  const two = (await get(JED_TWO, `/plans/${PLAN.id}`)).body.plan; assert.equal(two.versionCount, 2);
  assert.equal(two.content.target.amount, 1111119 + M1);
  const v1 = await get(JED_TWO, `/plans/${PLAN.id}/versions/1`); assert.equal(v1.body.version.content.target.amount, M0 + M1, 'the old snapshot is masked the same way');
  const v2 = await get(JED_TWO, `/plans/${PLAN.id}/versions/2`); assert.equal(v2.body.view.content.target.amount, 1111119 + M1);
  for (const h of [A_JED, A_RIY, TARGET, 2999993, UNALLOC, 1111119 + M1 + 2999993]) assert.ok(!hasNum(JSON.stringify(two) + v1.text + v2.text, h), `leaks ${h}`);
  PLAN = s.body.plan;
});

/* ================================================================== 4. references / capabilities */
ok('references payload and capabilities: no plan amounts for a municipal-only viewer; capabilities.municipalCoverage describes only the viewer\'s own grants', async () => {
  const r = await get(JED_TWO, '/plans/references'); assert.equal(r.code, 200); assert.ok(!/\d{6,}/.test(JSON.stringify(r.body.references)), 'references carry ids and users, never amounts');
  assert.deepEqual(r.body.capabilities.municipalCoverage[JED], { whole: false, all: false, direct: false, notSpecified: false, muniIds: [jm[0], jm[1]] });
  assert.equal(r.body.capabilities.canSetReference, false); assert.equal(Object.keys(r.body.capabilities.municipalCoverage).length, 1, 'only the Amanahs the viewer sees');
  const w = await get(JED_WHOLE, '/plans'); assert.deepEqual(w.body.capabilities.municipalCoverage[JED], { whole: true, all: true, direct: true, notSpecified: true });
  const am = await get(JED_ALL_MUNIS, '/plans'); assert.deepEqual(am.body.capabilities.municipalCoverage[JED], { whole: false, all: true, direct: false, notSpecified: false });
  const adm = await get(ADMIN, '/plans/references'); assert.equal(adm.body.capabilities.municipalCoverage, undefined); assert.equal(adm.body.capabilities.canSetReference, true);
  const lst = await get(JED_TWO, '/plans'); assert.deepEqual(lst.body.capabilities.municipalCoverage, r.body.capabilities.municipalCoverage);
});

/* ================================================================== 5. mutations */
ok('a municipal-only viewer can mutate NOTHING (the whole-Amanah rule): create / update are 403 scope; a read-only role is 403 read_only_role', async () => {
  const cur = (await get(ADMIN, `/plans/${PLAN.id}`)).body.plan;
  const c1 = await post(JED_TWO, '/plans', { name: uniq('x'), content: { ...contentOf(), name: 'x', scope: { kind: 'entities', entityKeys: [JED] }, target: { amount: A_JED }, allocations: [{ entityKey: JED, amount: A_JED }], municipalAllocations: [] } }); assert.equal(c1.code, 403); assert.deepEqual([c1.body.error, c1.body.reason], ['forbidden', 'scope']);
  const r = await put(JED_TWO, `/plans/${PLAN.id}`, { revision: cur.revision, content: contentOf() }); assert.equal(r.code, 403); assert.equal(r.body.error, 'forbidden'); assert.equal(r.body.reason, 'scope'); for (const h of HIDDEN_FOR_TWO) assert.ok(!hasNum(r.text, h));
  const ro = await post(AUDITOR, '/plans', { name: uniq('x'), content: contentOf() }); assert.equal(ro.code, 403); assert.ok(ro.body.error === 'read_only_role' || ro.body.reason === 'read_only_role');
  const ro2 = await put(AUDITOR, `/plans/${PLAN.id}`, { revision: cur.revision, content: contentOf() }); assert.equal(ro2.code, 403); assert.equal(ro2.body.error, 'read_only_role');
  const after = (await get(ADMIN, `/plans/${PLAN.id}`)).body.plan; assert.equal(after.revision, cur.revision, 'nothing changed');
});
const jedBase = (name, extra = {}) => ({ name, scope: { kind: 'entities', entityKeys: [JED] }, period: FY, target: { amount: 1000 }, allocations: [{ entityKey: JED, amount: 1000 }], distribution: { profile: 'equal' }, advanced: {}, ...extra });
ok('a payload naming a municipality OUTSIDE the actor\'s grants is 403 {reason:\'municipality\'} (create AND update); the whole-Amanah actor is fine with its own, a Ministry admin with any', async () => {
  const base = jedBase('خطة جدة'); const c = await saved(JED_WHOLE, base);
  const bad = await put(JED_WHOLE, `/plans/${c.id}`, { revision: c.revision, content: { ...base, municipalAllocations: [mr(RIY, rm[0], 5)] } });
  assert.equal(bad.code, 403, bad.text); assert.deepEqual([bad.body.error, bad.body.reason], ['forbidden', 'municipality']); assert.deepEqual(Object.keys(bad.body).sort(), ['error', 'reason']);
  const badCreate = await post(JED_WHOLE, '/plans', { name: uniq('x'), content: { ...base, municipalAllocations: [mr(RIY, rm[0], 5)] } }); assert.equal(badCreate.code, 403); assert.equal(badCreate.body.reason, 'municipality');
  const own = await put(JED_WHOLE, `/plans/${c.id}`, { revision: c.revision, content: { ...base, municipalAllocations: [mr(JED, jm[3], 400), mr(JED, jm[4], 300)] } }); assert.equal(own.code, 200, own.text);
  assert.equal(own.body.plan.viewer.canEdit, true); assert.deepEqual(own.body.plan.content.municipalAllocations.map((m) => m.amount), [400, 300]);
  // a Riyadh-only plan editor naming a Jeddah municipality: also 403 municipality (their grants do not cover it) — not 400 and not silently accepted
  const rbase = jedBase('خطة الرياض', { scope: { kind: 'entities', entityKeys: [RIY] }, allocations: [{ entityKey: RIY, amount: 1000 }] }); const rc = await saved(RIY_WHOLE, rbase);
  const rb = await put(RIY_WHOLE, `/plans/${rc.id}`, { revision: rc.revision, content: { ...rbase, municipalAllocations: [mr(JED, jm[0], 5)] } });
  assert.equal(rb.code, 403); assert.equal(rb.body.reason, 'municipality');
  // a copy of a plan the actor sees only masked stays refused
  const cp = await post(JED_TWO, '/plans', { name: uniq('نسخة'), copyOf: PLAN.id }); assert.equal(cp.code, 403);
  // Ministry level: any valid municipality, no 403
  const ad = await put(ADMIN, `/plans/${c.id}`, { revision: own.body.plan.revision, content: { ...base, municipalAllocations: [mr(JED, jm[3], 400), mr(JED, jm[4], 300)] } }); assert.equal(ad.code, 200, ad.text);
  assert.equal((await get(ADMIN, `/plans/${c.id}`)).body.plan.content.municipalAllocations.length, 2);
});
ok('validation (400 validation_error + errors[]): unknown municipality, a municipality of another Amanah, an entity outside the scope, duplicates, negative / non-integer amounts, a non-array — for a whole-Amanah actor and for the admin, on create and on update; nothing is stored', async () => {
  const base = jedBase('خطة التحقق'); const c = await saved(JED_WHOLE, base); const id = c.id;
  const cases = [
    ['unknown_municipality', [mr(JED, 'MREF-999-999', 5)]], ['unknown_municipality', [mr(JED, '', 5)]], ['municipality_not_in_entity', [mr(JED, rm[0], 5)]], ['municipality_not_in_entity', [mr('Housing Sector', jm[0], 5)]],
    ['duplicate_municipal_allocation', [mr(JED, jm[0], 5), mr(JED, jm[0], 6)]], ['invalid_amount', [mr(JED, jm[0], -3)]], ['amount_not_integer', [mr(JED, jm[0], 10.5)]], ['municipal_invalid', 'x'], ['municipal_invalid', [7]], ['unknown_entity', [mr('Nowhere', jm[0], 5)]]
  ];
  const count = planStore().db.plans.length;
  for (const u of [JED_WHOLE, ADMIN]) for (const [code, rows] of cases) {
    const cur = (await get(ADMIN, `/plans/${id}`)).body.plan; const r = await put(u, `/plans/${id}`, { revision: cur.revision, content: { ...base, municipalAllocations: rows } });
    assert.equal(r.code, 400, `${code} ${JSON.stringify(rows)} -> ${r.text}`); assert.equal(r.body.error, 'validation_error'); assert.ok(r.body.errors.some((e) => e.code === code), `${code} in ${r.body.errors.map((e) => e.code)}`);
    assert.ok(r.body.errors.every((e) => e.ar && e.en && e.path)); assert.equal((await get(ADMIN, `/plans/${id}`)).body.plan.revision, cur.revision, 'nothing stored');
    const cr = await post(u, '/plans', { name: uniq('تحقق'), content: { ...base, municipalAllocations: rows } }); assert.equal(cr.code, 400, `create ${code}`); assert.ok(cr.body.errors.some((e) => e.code === code));
  }
  assert.equal(planStore().db.plans.length, count, 'no plan was created by a failed create');
  const outside = await put(ADMIN, `/plans/${id}`, { revision: (await get(ADMIN, `/plans/${id}`)).body.plan.revision, content: { ...base, municipalAllocations: [mr(RIY, rm[0], 5)] } });
  assert.equal(outside.code, 400); assert.ok(outside.body.errors.some((e) => e.code === 'municipal_entity_not_in_scope'));
});
ok('an EXCESS (Σ municipal > the Amanah allocation) fails the SAVE with 422 save_checks_failed (7 checks, municipal_within_entity failed) on create and on update, nothing stored; fixing it saves; an Amanah with NO allocation counts as 0', async () => {
  const base = jedBase('خطة الزيادة', { target: { amount: 5000 }, allocations: [{ entityKey: JED, amount: 5000 }] }); const count = planStore().db.plans.length;
  const over = await post(ADMIN, '/plans', { name: uniq('زيادة'), content: { ...base, municipalAllocations: [mr(JED, jm[0], 3000), mr(JED, jm[1], 2500)] } });
  assert.equal(over.code, 422); assert.equal(over.body.error, 'save_checks_failed'); assert.equal(over.body.checks.length, 7);
  const f = over.body.checks.filter((x) => !x.ok); assert.deepEqual(f.map((x) => x.id), ['municipal_within_entity']); assert.equal(f[0].params.entities[0].excess, 500); assert.equal(planStore().db.plans.length, count);
  const good = await saved(ADMIN, { ...base, municipalAllocations: [mr(JED, jm[0], 3000), mr(JED, jm[1], 2000)] }); assert.equal(good.content.municipalAllocations.length, 2);
  const upOver = await put(ADMIN, `/plans/${good.id}`, { revision: good.revision, content: { ...base, municipalAllocations: [mr(JED, jm[0], 3000), mr(JED, jm[1], 2500)] } }); assert.equal(upOver.code, 422); assert.equal((await get(ADMIN, `/plans/${good.id}`)).body.plan.revision, good.revision, 'a failed update leaves the stored plan unchanged');
  const noAl = await post(ADMIN, '/plans', { name: uniq('بلا تخصيص'), content: { ...base, scope: { kind: 'entities', entityKeys: [JED, RIY] }, target: { amount: 5000 }, allocations: [{ entityKey: RIY, amount: 5000 }], municipalAllocations: [mr(JED, jm[0], 1)] } });
  assert.equal(noAl.code, 422); assert.ok(noAl.body.checks.some((x) => x.id === 'municipal_within_entity' && !x.ok));
});

/* ================================================================== 6. two sessions with municipal rows */
ok('TWO SESSIONS: the municipal rows saved by one session are what the other reads (editor: full rows; municipal-only viewer: masked, immediately — saved plans are shared); a stale revision is 409 and overwrites nothing', async () => {
  const base = jedBase('خطة جلستين', { period: FY27, target: { amount: 900000 }, allocations: [{ entityKey: JED, amount: 900000 }] }); const c = await saved(JED_WHOLE, { ...base, municipalAllocations: [mr(JED, jm[0], 111111), mr(JED, jm[1], 222222)] });
  const bSees = await get(ADMIN, `/plans/${c.id}`); assert.deepEqual(bSees.body.plan.content.municipalAllocations.map((m) => m.amount), [111111, 222222]);
  const bSave = await put(ADMIN, `/plans/${c.id}`, { revision: bSees.body.plan.revision, content: { ...base, municipalAllocations: [mr(JED, jm[0], 111111), mr(JED, jm[1], 222222), mr(JED, jm[2], 333333)] } }); assert.equal(bSave.code, 200, bSave.text);
  const stale = await put(JED_WHOLE, `/plans/${c.id}`, { revision: c.revision, content: { ...base, municipalAllocations: [] } }); assert.equal(stale.code, 409); assert.equal(stale.body.error, 'revision_conflict'); assert.equal(stale.body.lastEditedBy.userId, ADMIN.user.id);
  const aSees = await get(JED_WHOLE, `/plans/${c.id}`); assert.deepEqual(aSees.body.plan.content.municipalAllocations.map((m) => m.amount), [111111, 222222, 333333]);
  const two = (await get(JED_TWO, `/plans/${c.id}`)).body.plan.content; assert.equal(two.target.amount, 111111 + 222222); assert.deepEqual(two.municipalAllocations.map((m) => m.amount), [111111, 222222]);
  const one = (await get(JED_ONE, `/plans/${c.id}`)).body.plan.content; assert.equal(one.target.amount, 333333, 'JED_ONE holds the third municipality'); const who = (await get(JED_WHOLE, `/plans/${c.id}`)).body.plan; assert.equal(who.content.target.amount, 900000);
  const aud = (await get(ADMIN, `/plans/${c.id}/audit`)).body.entries; assert.deepEqual(aud.map((e) => e.action), ['update', 'create']);
});

/* ================================================================== 7. view-scope read guard */
ok('view-scope reads: a municipality outside the grants is 403 {reason:municipality} (list, get, version); unknown id / not of the Amanah / without an Amanah is 400; an allowed one is echoed; `entity`/`amanah` + `muni` filter the list', async () => {
  const q = (amanah, muni) => `amanah=${encodeURIComponent(amanah)}&muni=${encodeURIComponent(muni)}`;
  for (const base of ['/plans', `/plans/${PLAN.id}`, `/plans/${PLAN.id}/versions/1`]) {
    const sep = `${base}?`;
    const outside = await get(JED_TWO, sep + q(JED, jm[2])); assert.equal(outside.code, 403, base); assert.deepEqual(outside.body, { error: 'forbidden', reason: 'municipality' });
    const other = await get(JED_TWO, sep + q(RIY, rm[0])); assert.equal(other.code, 403, 'a municipality of an Amanah the viewer does not see'); assert.equal(other.body.reason, 'municipality');
    const unknown = await get(JED_TWO, sep + q(JED, 'MREF-999-999')); assert.equal(unknown.code, 400); assert.equal(unknown.body.error, 'validation_error'); assert.equal(unknown.body.errors[0].code, 'unknown_municipality');
    const foreign = await get(ADMIN, sep + q(JED, rm[0])); assert.equal(foreign.code, 400, 'not of the Amanah'); assert.equal(foreign.body.errors[0].code, 'municipality_not_in_entity');
    const noAm = await get(ADMIN, `${sep}muni=${jm[0]}`); assert.equal(noAm.code, 400); assert.equal(noAm.body.errors[0].code, 'municipality_without_amanah');
    const badAm = await get(ADMIN, sep + q('Nowhere', jm[0])); assert.equal(badAm.code, 400); assert.equal(badAm.body.errors[0].code, 'unknown_entity');
    const good = await get(JED_TWO, sep + q(JED, jm[0])); assert.equal(good.code, 200, good.text); assert.deepEqual(good.body.viewScope, { amanah: JED, muni: jm[0] });
    const keyForm = await get(JED_TWO, `${sep}muni=${encodeURIComponent(`${JED}|${jm[1]}`)}`); assert.equal(keyForm.code, 200); assert.deepEqual(keyForm.body.viewScope, { amanah: JED, muni: jm[1] });
    const keyOut = await get(JED_TWO, `${sep}muni=${encodeURIComponent(`${JED}|${jm[2]}`)}`); assert.equal(keyOut.code, 403);
    const adm = await get(ADMIN, sep + q(JED, jm[2])); assert.equal(adm.code, 200); assert.equal(adm.body.viewScope.muni, jm[2]);
    const all = await get(JED_TWO, `${sep}amanah=all&muni=all`); assert.equal(all.code, 200); assert.equal(all.body.viewScope, undefined);
    for (const h of HIDDEN_FOR_TWO) assert.ok(!hasNum(good.text, h) && !hasNum(outside.text, h), `view-scope answers leak ${h}`);
  }
  // list filter: entity / amanah (+ muni) keep only the plans naming that entity; nothing else changes
  const allIds = (await get(ADMIN, '/plans')).body.plans.map((p) => p.id);
  const jedOnly = await get(ADMIN, `/plans?${q(JED, jm[0])}`); assert.ok(jedOnly.body.plans.length > 0 && jedOnly.body.plans.length <= allIds.length);
  assert.ok(jedOnly.body.plans.every((p) => { const c = p.content; return c.scope.kind === 'ministry' || c.scope.entityKeys.includes(JED); }));
  const byEntity = await get(ADMIN, `/plans?entity=${encodeURIComponent(RIY)}`); assert.equal(byEntity.code, 200); assert.deepEqual(byEntity.body.viewScope, { amanah: RIY, muni: 'all' }, 'entity alone: the whole-Amanah view is echoed');
  assert.ok(byEntity.body.plans.every((p) => { const c = p.content; return c.scope.kind === 'ministry' || c.scope.entityKeys.includes(RIY); }));
  // the plan record never carries the view scope (it is a filter, not content)
  assert.equal(JSON.stringify(planStore().db.plans).includes('viewScope'), false);
});

/* ================================================================== 8. the data-service endpoints (existing machinery) */
ok('data-service endpoints (existing behaviour, verified): a municipal-only user asking for a municipality outside the grant gets no data; for a granted one, exactly the Ministry figures for that municipality', async () => {
  const SCOPE = (extra = {}) => ({ from: '2000-01-01', to: TODAY, ...extra }); const CFG = { cutoff: TODAY };
  const snap = (u, extra) => post(u, '/snapshot', { scope: SCOPE(extra), cfg: CFG });
  const series = (u, extra) => post(u, '/series', { scope: SCOPE({ from: '2026-01-01', ...extra }), cfg: CFG });
  const key = (i) => `${JED}|${jm[i]}`;
  const admin2 = await snap(ADMIN, { amanah: JED, muni: key(0) }); assert.equal(admin2.code, 200);
  const mine = await snap(JED_TWO, { amanah: JED, muni: key(0) }); assert.equal(mine.code, 200); assert.ok(mine.body.totals.count > 0, 'the control municipality has data');
  for (const k of ['count', 'gross', 'exclusions', 'net', 'collected', 'outstanding']) assert.equal(mine.body.totals[k], admin2.body.totals[k], `granted municipality: ${k} equals the unrestricted figure`);
  for (const [name, extra] of [['outside municipality', { amanah: JED, muni: key(2) }], ['outside municipality, no Amanah', { muni: key(2) }], ['another Amanah\'s municipality', { amanah: RIY, muni: `${RIY}|${rm[0]}` }], ['the direct group', { amanah: JED, muni: `${JED}|DIRECT` }], ['another Amanah', { amanah: RIY }]]) {
    const r = await snap(JED_TWO, extra); assert.equal(r.code, 200, name); assert.equal(r.body.totals.count, 0, `${name}: no records`); assert.equal(r.body.totals.gross, 0, `${name}: no amounts`);
    const s = await series(JED_TWO, extra); assert.equal(s.code, 200, name); assert.equal(sum(s.body.billed), 0, `${name}: the series carries no billed amounts`); assert.equal(sum(s.body.collected || []), 0, `${name}: nor collections`);
  }
  const sAdmin = await series(ADMIN, { amanah: JED, muni: key(0) }); const sMine = await series(JED_TWO, { amanah: JED, muni: key(0) }); assert.deepEqual(sMine.body.billed, sAdmin.body.billed, 'granted municipality: the series equals the unrestricted one');
  const wide = await snap(JED_TWO, { access: { all: true }, amanah: [JED, RIY] }); assert.ok(wide.body.totals.count <= (await snap(ADMIN, { amanah: JED })).body.totals.count, 'a client cannot widen');
  // the same request from two users with different grants is never mixed (caches are keyed by the access scope)
  const a1 = await snap(JED_ONE, { amanah: JED, muni: key(0) }); assert.equal(a1.body.totals.count, 0, 'JED_ONE does not hold municipality 0'); const a2 = await snap(JED_TWO, { amanah: JED, muni: key(0) }); assert.equal(a2.body.totals.count, mine.body.totals.count);
});

/* ================================================================== 9. hygiene */
ok('no secret-like word anywhere in the suite\'s responses; an unauthorised-municipality 403 carries only the reason', async () => {
  const blob = ALL_TEXT.join('\n'); assert.ok(blob.length > 20000);
  assert.ok(!/passw|credential|scrypt|secret|\bhash|\btoken/i.test(blob), 'no secret-like word');
  for (const u of [ADMIN, JED_WHOLE, JED_TWO, JED_ONE, RIY_WHOLE, AUDITOR]) assert.ok(!blob.includes(u.token), 'no bearer token echoed');
  const audit = JSON.stringify(planStore().db.audit); assert.ok(!/passw|credential|scrypt|hash/i.test(audit));
});

for (const run of pending) await run();
console.log(`plans-server-muni: ${n} tests passed`);
