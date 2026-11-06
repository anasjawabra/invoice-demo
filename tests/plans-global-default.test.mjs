// «خطة تحصيل 2027» — the GLOBAL default plan (docs/revenue-plans-spec.md «Implementation notes — G»). Server side: idempotent creation by seedKey across restarts and double opens, the shared `settings`, PUT /plans/system-default and its authority,
// default resolution (personal → global → fallback), masking for a restricted viewer, migration of an existing schema-2 store, and the 2027 CONTENT (period, carried-forward targets, labels). HTTP-level through handleApi with the real identity module
// (in-memory identity store) and a plans store in memory or in a TEMP file; the repository's server/.data files are never touched. Synthetic data only.
// Run: npm run test:plansdefault
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { normalizeGeoScope, entireAmanahGrant, ALL_SCOPE } from '../src/data/geoScope.js';
import { requiredPermissionFor, ENDPOINTS } from '../server/endpointAccess.js';
import { resetForTests, getDb, issueToken } from '../server/identity/index.js';
import { commit } from '../server/identity/store.js';
import { hashPassword } from '../server/identity/crypto.js';
import { handleApi } from '../server/api.js';
import { resetPlanStore, openPlanStore, useStore, planStore, SEED_PLAN_ID, SCHEMA_VERSION, setPlansClockForTests } from '../server/plans/store.js';
import { COLLECTION_PLAN_2027, REMAINING_PLAN_2026, collectionPlan2027Content, carriedForwardNote, deriveRemainingPlanContent } from '../src/data/plans/planDefaults.js';
import { appropriationOf, appropriationKeys } from '../src/data/appropriations.js';
import { defaultPlanResolution, planView } from '../src/data/plans/planRules.js';
import { fiscalYearPeriod } from '../src/data/plans/planMath.js';
import { normalizeContent } from '../src/data/plans/planRules.js';
import { plansApi } from '../src/api/plansClient.js';
import { ensureRemainingPlan, engineActualsToCutoff, setRemainingProviderForTests } from '../server/plans/remaining2026.js';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { approvedConfigOf, loadPlanInputsForPlan } from '../src/data/planInputs.js';
import { DEFAULT_CONFIG } from '../src/data/revenueMetrics.js';

let n = 0; const pending = [];
const ok = (name, fn) => { const run = async () => { try { await fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } }; pending.push(run); };
process.env.IIM_PLANS_FILE = ':memory:';
resetForTests(':memory:');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'plans-default-test-'));
resetPlanStore(':memory:');
const ID27 = COLLECTION_PLAN_2027.id; const KEY27 = COLLECTION_PLAN_2027.seedKey; const REM = REMAINING_PLAN_2026.id; const KEYR = REMAINING_PLAN_2026.seedKey;

/* ------------------------------------------------------------------ users */
let seq = 0; const stamp = new Date().toISOString();
function mkUser(modules, scope = ALL_SCOPE, { readOnly = false } = {}) {
  const db = getDb(); seq += 1;
  db.roles.push({ id: `role-g${seq}`, nameAr: `دور ${seq}`, nameEn: `Default role ${seq}`, descriptionAr: '', descriptionEn: '', modules: [...modules], readOnly, starter: false, protected: false, createdAt: stamp, updatedAt: stamp });
  const user = { id: `usr-g${seq}`, username: `g${seq}`, email: null, nameAr: `مستخدم ${seq}`, nameEn: `User ${seq}`, avatar: 'G', status: 'active', roleId: `role-g${seq}`, scope, tokenVersion: 1, createdAt: stamp, createdBy: 'test', updatedAt: stamp, lastLoginAt: null, credential: hashPassword('Test-pass-1234') };
  db.users.push(user); commit();
  const u = { user, token: null }; MADE.push(u); return u;
}
const MADE = [];
const seeded = (username) => { const user = getDb().users.find((u) => u.username === username); return { user, token: issueToken(user) }; };
const DEMO = seeded('demo'); const ADMIN = seeded('admin'); const AUDITOR = seeded('auditor');
const JED = 'Jeddah Amanah'; const RIY = 'Riyadh Amanah';
const jedRef = municipalitiesOf(JED)[0].refId;
const JED_USER = mkUser(['planning'], normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(JED)] }));
const JED_MUNI = mkUser(['planning'], normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: JED, municipalities: [jedRef], direct: false, notSpecified: false }] }));
const NO_MODULE = mkUser(['dashboard']);
const WRITER = mkUser(['planning']);
const WRITER2 = mkUser(['planning']);
const FRESH = mkUser(['planning']); // a brand-new account (another person, another browser)
const READER = mkUser(['planning'], ALL_SCOPE, { readOnly: true });

for (const u of MADE) u.token = issueToken(u.user); // tokens are issued once every account exists (a later user change bumps the access version)
function call(u, method, p, body) {
  return new Promise((resolve) => {
    const res = { chunks: [], writeHead(c, h) { this.code = c; this.headers = h || {}; }, write(c) { this.chunks.push(String(c)); return true; }, once() {}, end(b) { const t = b !== undefined ? b : this.chunks.join(''); let j = null; try { j = JSON.parse(t); } catch { /* */ } resolve({ code: this.code, headers: this.headers, text: t, body: j }); } };
    handleApi({ method, url: `/api${p}`, headers: { ...(u && u.token ? { authorization: `Bearer ${u.token}` } : {}) }, body: method === 'GET' ? undefined : JSON.parse(JSON.stringify(body || {})) }, res);
  });
}
const get = (u, p) => call(u, 'GET', p); const post = (u, p, b) => call(u, 'POST', p, b); const put = (u, p, b) => call(u, 'PUT', p, b);
const J = (x) => JSON.parse(JSON.stringify(x));
const sum = (a) => a.reduce((t, x) => t + x, 0);
const FY = fiscalYearPeriod(2026);
let nameSeq = 0; const nm = (base = 'خطة') => `${base} ${(nameSeq += 1)}`;
const entityContent = (name, keys, amount, period = FY) => ({ name, scope: { kind: 'entities', entityKeys: keys }, period, target: { amount }, allocations: keys.map((k, i) => ({ entityKey: k, amount: i === 0 ? amount - Math.floor(amount / keys.length) * (keys.length - 1) : Math.floor(amount / keys.length), origin: 'manual' })), distribution: { profile: 'equal' }, advanced: {} });
async function created(u, content, extra = {}) { const c = await post(u, '/plans', { name: content.name, content, ...extra }); assert.equal(c.code, 201, c.text); return c.body.plan; }
const fileStore = (name) => path.join(TMP, name);
const seedAudit = (db) => db.audit.filter((e) => e.action === 'seed' && e.planId === ID27);

/* ================================================================== 1. the plan: identity, period, targets, labels */
ok('the 2027 collection plan: ONE system plan (seedKey, isSystem, origin seed, ownerless), AR name «خطة تحصيل 2027» + EN «2027 Collection Plan», period 1 Jan – 31 Dec 2027 (fiscal-year preset), Ministry scope, explicit equal profile, ownerless audit by the system', async () => {
  const r = await get(DEMO, '/plans'); assert.equal(r.code, 200);
  const p = r.body.plans.find((x) => x.id === ID27); assert.ok(p, 'the plan is served');
  assert.equal(r.body.plans.filter((x) => x.seedKey === KEY27).length, 1);
  assert.deepEqual([p.name, p.nameEn, p.seedKey, p.isSystem, p.origin, p.createdBy, p.lastEditedBy, p.revision, p.state], ['خطة تحصيل 2027', '2027 Collection Plan', KEY27, true, 'seed', null, null, 1, 'active']);
  assert.equal(p.name, p.content.name); assert.deepEqual(p.content.period, { start: '2027-01-01', end: '2027-12-31', preset: 'fiscal-year' }); assert.deepEqual(p.content.scope, { kind: 'ministry' }); assert.deepEqual(p.content.distribution, { profile: 'equal' });
  assert.deepEqual(p.viewer, { canEdit: false, reason: 'system_plan' }); assert.ok(!/معتمد/.test(JSON.stringify({ ...p, legacy: null })), 'no approval wording');
  const a = await get(DEMO, `/plans/${ID27}/audit`); const seed = a.body.entries.find((e) => e.action === 'seed'); assert.deepEqual(seed.actor, { system: true }); assert.ok(seed.summary.ar.includes('بيانات توضيحية') && seed.summary.ar.includes('2027') && seed.summary.en.includes('illustrative'), 'the audit labels it illustrative');
  const ref = a.body.entries.find((e) => e.action === 'reference_set'); assert.deepEqual(ref.actor, { system: true }); assert.equal(ref.details.year, 2027);
  assert.ok(!a.body.entries.some((e) => e.action === 'system_default_set'), 'the 2027 plan is NOT the global default');
  assert.deepEqual(r.body.references['2027'].setBy, { system: true }); assert.equal(r.body.references['2027'].planId, ID27); assert.equal(r.body.references['2026'].planId, SEED_PLAN_ID, 'the 2026 reference is unchanged');
});
ok('targets: NO 2027 budget exists, so the 2026 communicated budget is CARRIED FORWARD × the documented 66 % — recorded in the target basis (carriedFromYear), allocations by the revenue-appropriation share summing to the riyal, labelled illustrative', async () => {
  assert.equal(appropriationKeys().some((k) => appropriationOf(k, 2027)), false, 'there is no 2027 budget in the data (so the carry-forward is the only way)');
  const p = (await get(DEMO, `/plans/${ID27}`)).body.plan; const c = p.content;
  const budget = appropriationKeys().reduce((t, k) => t + (appropriationOf(k, 2026)?.expAdjusted || 0), 0);
  assert.deepEqual(c.target.basis, { method: 'budget_x_coverage', coverage: 0.66, budget, at: p.createdAt, carriedFromYear: 2026 }); assert.equal(c.target.amount, Math.round(budget * 0.66));
  assert.equal(sum(c.allocations.map((a) => a.amount)), c.target.amount, 'allocations add up to the target to the riyal'); assert.ok(c.allocations.every((a) => a.origin === 'seed' && Number.isInteger(a.amount) && a.amount > 0));
  const share = (k) => appropriationOf(k, 2026)?.revAdjusted || 0; const tot = sum(c.allocations.map((a) => share(a.entityKey)));
  for (const a of c.allocations) assert.ok(Math.abs(a.amount - (c.target.amount * share(a.entityKey)) / tot) <= 1, `the share of ${a.entityKey}`);
  const note = carriedForwardNote(); assert.equal(note.ar, 'ميزانية 2027 توضيحية = ميزانية 2026 المبلغة لحين وصول ميزانية 2027؛ التغطية 66% افتراضية'); assert.ok(/illustrative/i.test(note.en) && /66%/.test(note.en));
  assert.deepEqual(J(collectionPlan2027Content({ at: p.createdAt })), c, 'the stored content is exactly the documented derivation');
  const v = planView(p); assert.equal(v.nameEn, '2027 Collection Plan'); assert.equal(v.isSystem, true);
});

/* ================================================================== 2. idempotent creation */
ok('IDEMPOTENT: opening the same file store again and again (restarts, double open, reload) never creates a second 2027 plan, never rewrites it, and adds no audit', () => {
  const file = fileStore('idem.json'); const a = openPlanStore(file); assert.equal(a.db.plans.filter((p) => p.seedKey === KEY27).length, 1); const snap = J(a.db);
  assert.equal(seedAudit(a.db).length, 1);
  for (let i = 0; i < 3; i += 1) { const again = openPlanStore(file); assert.deepEqual(J(again.db), snap, `open #${i + 2}`); again.reload(); assert.deepEqual(J(again.db), snap); }
  const both = [openPlanStore(file), openPlanStore(file)]; assert.deepEqual(both.map((s) => s.db.plans.length), [2, 2]);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), snap, 'the file is byte-for-meaning identical');
});
ok('NEVER overwrites a user plan: a user plan already named «خطة تحصيل 2027» keeps its content; the seed takes a suffixed name; the user plan is not touched', () => {
  const file = fileStore('clash.json'); const s0 = openPlanStore(file, { seed: false });
  const content = { ...entityContent('خطة تحصيل 2027', [RIY], 5000000, fiscalYearPeriod(2027)) };
  s0.mutate((db) => { db.plans.push({ id: 'plan-0000abcd', name: content.name, isSystem: false, origin: 'user', content, createdBy: { userId: 'usr-x', name: 'x' }, createdAt: stamp, updatedAt: stamp, lastEditedBy: { userId: 'usr-x', name: 'x' }, revision: 4, versions: [], legacy: null, state: 'active' }); });
  const before = J(s0.db.plans[0]);
  const s = openPlanStore(file); const mine = s.db.plans.find((p) => p.id === 'plan-0000abcd'); assert.deepEqual(J(mine), before, 'the user plan is untouched');
  const seed = s.db.plans.find((p) => p.seedKey === KEY27); assert.ok(seed && seed.name !== 'خطة تحصيل 2027' && seed.name.includes('2027') && seed.isSystem); assert.equal(s.db.plans.filter((p) => p.name === 'خطة تحصيل 2027').length, 1, 'no duplicate name');
  assert.equal(s.db.settings.systemDefaultPlanId, null, 'the 2027 plan never becomes the default by itself');
});
ok('a plan record saved by a user can never carry seedKey / nameEn / isSystem (the body cannot forge the system plan)', async () => {
  const c = entityContent(nm('محاولة'), [RIY], 1000000, fiscalYearPeriod(2027));
  const r = await post(DEMO, '/plans', { name: c.name, content: c, seedKey: KEY27, nameEn: 'x', isSystem: true, origin: 'seed' }); assert.equal(r.code, 201);
  assert.deepEqual([r.body.plan.isSystem, r.body.plan.origin, r.body.plan.seedKey, r.body.plan.nameEn], [false, 'user', undefined, undefined]);
  assert.equal(planStore().db.plans.filter((p) => p.seedKey === KEY27).length, 1);
});

/* ================================================================== 3. the global default: who opens what */
ok('every account gets the SAME effective default (the FULL-YEAR 2026 seed plan; the remaining-2026 and 2027 plans exist, are visible and are NOT the default) and `defaults` carries global / user / effective / source; the shared settings hold it', async () => {
  for (const u of [DEMO, ADMIN, AUDITOR, WRITER, WRITER2, READER, JED_USER, JED_MUNI]) {
    const r = await get(u, '/plans'); assert.equal(r.code, 200, u.user.username);
    assert.deepEqual(r.body.defaults, { userDefaultPlanId: null, globalDefaultPlanId: SEED_PLAN_ID, systemDefaultPlanId: SEED_PLAN_ID, effectiveDefaultPlanId: SEED_PLAN_ID, source: 'global' }, u.user.username);
    assert.ok(r.body.plans.some((p) => p.id === REM) && r.body.plans.some((p) => p.id === ID27), 'both system plans are visible to everybody with the planning module');
  }
  assert.deepEqual(planStore().db.settings, { systemDefaultPlanId: SEED_PLAN_ID, systemDefaultConfigured: true });
  const sd = await get(ADMIN, '/plans/system-default'); assert.equal(sd.code, 200); assert.equal(sd.body.defaults.globalDefaultPlanId, SEED_PLAN_ID); assert.equal(sd.body.canSetSystemDefault, true);
  assert.equal((await get(JED_USER, '/plans/system-default')).body.canSetSystemDefault, false); assert.equal((await get(READER, '/plans/system-default')).body.canSetSystemDefault, false);
});
ok('capabilities: canSetSystemDefault = the reference-plan authority (all entities AND not read-only)', async () => {
  const cap = async (u) => (await get(u, '/plans')).body.capabilities;
  for (const [u, want] of [[DEMO, true], [ADMIN, true], [WRITER, true], [AUDITOR, false], [READER, false], [JED_USER, false], [JED_MUNI, false]]) { const c = await cap(u); assert.equal(c.canSetSystemDefault, want, u.user.username); assert.equal(c.canSetSystemDefault, c.canSetReference); }
});
ok('a PERSONAL default (the caller\'s explicit choice) still wins over the global one — for that caller only; clearing it returns them to the global default; the explicit plan id is unaffected', async () => {
  const mine = await created(WRITER, entityContent(nm('خطتي'), [RIY], 1000000), { setDefault: true });
  const w = (await get(WRITER, '/plans')).body.defaults; assert.deepEqual(w, { userDefaultPlanId: mine.id, globalDefaultPlanId: SEED_PLAN_ID, systemDefaultPlanId: SEED_PLAN_ID, effectiveDefaultPlanId: mine.id, source: 'personal' });
  const other = (await get(WRITER2, '/plans')).body.defaults; assert.equal(other.effectiveDefaultPlanId, SEED_PLAN_ID); assert.equal(other.source, 'global');
  assert.equal((await get(WRITER, `/plans/${ID27}`)).code, 200, 'an explicit plan id opens that plan whatever the defaults');
  const clr = await put(WRITER, '/plans/default', { planId: null }); assert.equal(clr.body.defaults.effectiveDefaultPlanId, SEED_PLAN_ID); assert.equal(clr.body.defaults.source, 'global');
});
ok('PUT /plans/system-default: an administrator (all entities, not read-only) changes the GLOBAL default for everybody; it is audited with the actor and the previous plan; personal defaults and references are not touched', async () => {
  const target = await created(DEMO, entityContent(nm('خطة للتعيين'), [RIY], 1000000));
  const mineW = await created(WRITER, entityContent(nm('شخصية'), [RIY], 1000000), { setDefault: true });
  const refsBefore = J(planStore().db.references); const udBefore = J(planStore().db.userDefaults);
  const r = await put(ADMIN, '/plans/system-default', { planId: target.id }); assert.equal(r.code, 200, r.text);
  assert.equal(r.body.defaults.globalDefaultPlanId, target.id); assert.equal(r.body.defaults.effectiveDefaultPlanId, target.id); assert.equal(r.body.defaults.source, 'global');
  assert.deepEqual(planStore().db.settings, { systemDefaultPlanId: target.id, systemDefaultConfigured: true });
  assert.deepEqual(planStore().db.references, refsBefore, 'references untouched'); assert.deepEqual(planStore().db.userDefaults, udBefore, 'personal defaults untouched');
  for (const u of [DEMO, AUDITOR, WRITER2, JED_USER]) { const d = (await get(u, '/plans')).body.defaults; assert.equal(d.effectiveDefaultPlanId, u === JED_USER ? SEED_PLAN_ID : target.id, u.user.username); } // JED_USER cannot see the Riyadh plan → the first visible system plan (by name: the 2026 one)
  assert.equal((await get(WRITER, '/plans')).body.defaults.effectiveDefaultPlanId, mineW.id, 'a personal choice still wins');
  const a = (await get(ADMIN, `/plans/${target.id}/audit`)).body.entries.find((e) => e.action === 'system_default_set'); assert.equal(a.actor.userId, ADMIN.user.id); assert.equal(a.details.previous, SEED_PLAN_ID); assert.ok(a.summary.ar.includes('افتراضية عامة'));
  assert.equal((await put(ADMIN, '/plans/system-default', { planId: target.id })).code, 200, 'idempotent');
  assert.equal((await put(ADMIN, '/plans/system-default', { planId: SEED_PLAN_ID })).body.defaults.globalDefaultPlanId, SEED_PLAN_ID, 'and it can be set back');
});
ok('PUT /plans/system-default is refused: 401 anonymous · 403 forbidden without the planning module · 403 read_only_role for a read-only role (auditor too) · 403 forbidden{scope} for a restricted viewer · 404 for a plan they cannot see · 400 without a plan id; the settings never change', async () => {
  const before = J(planStore().db.settings); const target = await created(DEMO, entityContent(nm('محاولة'), [RIY], 1000000));
  assert.equal((await put(null, '/plans/system-default', { planId: target.id })).code, 401);
  const nm0 = await put(NO_MODULE, '/plans/system-default', { planId: target.id }); assert.equal(nm0.code, 403); assert.equal(nm0.body.error, 'forbidden');
  for (const u of [AUDITOR, READER]) { const r = await put(u, '/plans/system-default', { planId: target.id }); assert.equal(r.code, 403, u.user.username); assert.equal(r.body.error, 'read_only_role'); }
  for (const u of [JED_USER, JED_MUNI]) { const r = await put(u, '/plans/system-default', { planId: ID27 }); assert.equal(r.code, 403, u.user.username); assert.deepEqual(r.body, { error: 'forbidden', reason: 'scope' }); }
  assert.equal((await put(ADMIN, '/plans/system-default', { planId: 'plan-ffffffff' })).code, 404);
  assert.equal((await put(ADMIN, '/plans/system-default', {})).code, 400); assert.equal((await put(ADMIN, '/plans/system-default', { planId: null })).code, 400);
  assert.deepEqual(planStore().db.settings, before);
  assert.equal(requiredPermissionFor('PUT', '/plans/system-default', {}).write, true); assert.equal(requiredPermissionFor('GET', '/plans/system-default', {}).write, undefined);
  assert.ok(ENDPOINTS.some(([m, p]) => m === 'PUT' && p === '/plans/system-default') && ENDPOINTS.some(([m, p]) => m === 'GET' && p === '/plans/system-default'));
});
ok('the choice is a plan the caller SEES: an entity-scoped viewer is never pointed at a plan outside their scope — their effective default falls back (global → first system plan) and the plan is not revealed', async () => {
  const hidden = await created(DEMO, entityContent(nm('خفية'), [RIY], 1000000)); await put(ADMIN, '/plans/system-default', { planId: hidden.id });
  const d = (await get(JED_USER, '/plans')).body; assert.equal(d.defaults.globalDefaultPlanId, null); assert.equal(d.defaults.source, 'fallback'); assert.ok(d.plans.every((p) => p.id !== hidden.id)); assert.ok(d.plans.some((p) => p.id === d.defaults.effectiveDefaultPlanId));
  assert.equal((await get(JED_USER, `/plans/${hidden.id}`)).code, 404);
  await put(ADMIN, '/plans/system-default', { planId: SEED_PLAN_ID });
});

/* ================================================================== 4. permissions are not widened */
ok('a restricted viewer opening the 2027 Ministry plan gets the MASKED plan: only their entities, no Ministry total, no edit; the default grants no access (explicit read of an outside plan is still 404)', async () => {
  const p = (await get(JED_USER, `/plans/${ID27}`)).body.plan; assert.equal(p.masked, true);
  assert.deepEqual(p.content.allocations.map((a) => a.entityKey), [JED]); assert.equal(p.viewer.canEdit, false);
  const full = (await get(ADMIN, `/plans/${ID27}`)).body.plan; assert.ok(p.content.target.amount < full.content.target.amount, 'the visible total is smaller than the Ministry target');
  assert.ok(!JSON.stringify(p).includes(String(full.content.target.amount)), 'the Ministry total is not in the masked payload'); assert.ok(!p.content.target.basis, 'no basis (it would reveal the budget)');
  const mm = (await get(JED_MUNI, `/plans/${ID27}`)).body.plan; assert.equal(mm.masked, true); assert.ok(!JSON.stringify(mm).includes(String(full.content.target.amount)));
  const edit = await put(JED_USER, `/plans/${ID27}`, { revision: 1, content: full.content }); assert.equal(edit.code, 403);
  const aud = (await get(AUDITOR, `/plans/${ID27}`)).body.plan; assert.equal(aud.viewer.canEdit, false); assert.equal((await put(AUDITOR, `/plans/${ID27}`, { revision: 1, content: full.content })).code, 403);
});

/* ================================================================== 5. persistence across restarts */
ok('PERSISTENCE: the administrator\'s choice is stored in the shared settings, survives a restart, and a LATER restart never re-applies the 2027 default (nor re-creates a deleted-from-settings state)', async () => {
  const file = fileStore('persist.json'); const live = resetPlanStore(file); assert.equal(live.mode, 'file');
  const target = await created(DEMO, entityContent(nm('خيار المدير'), [RIY], 1000000)); const rr = await put(ADMIN, '/plans/system-default', { planId: target.id }); assert.equal(rr.code, 200);
  for (let i = 0; i < 3; i += 1) {
    const fresh = openPlanStore(file); useStore(fresh); assert.deepEqual(fresh.db.settings, { systemDefaultPlanId: target.id, systemDefaultConfigured: true }, `restart ${i + 1}`);
    assert.equal(fresh.db.plans.filter((p) => p.seedKey === KEY27).length, 1);
    assert.equal((await get(WRITER2, '/plans')).body.defaults.effectiveDefaultPlanId, target.id, 'a different account, after the restart');
    assert.equal(fresh.db.audit.filter((e) => e.action === 'system_default_set').length, 2, 'the restart added no audit');
  }
  assert.equal((await get(DEMO, '/plans')).body.defaults.globalDefaultPlanId, target.id);
  // a new browser / session = a new token for another account: same answer
  assert.equal((await get(FRESH, '/plans')).body.defaults.effectiveDefaultPlanId, target.id);
  useStore(resetPlanStore(':memory:'));
});
ok('a store whose global default was configured but whose plan was set elsewhere is not re-seeded into the default: the 2027 plan exists but the administrator\'s plan remains the global default (also when the 2027 seed is created LATER)', () => {
  const file = fileStore('later.json'); const s0 = openPlanStore(file, { seed: false });
  s0.mutate((db) => { db.plans.push({ id: 'plan-0000beef', name: 'خطة المدير', isSystem: false, origin: 'user', content: entityContent('خطة المدير', [RIY], 1000000), createdBy: { userId: 'usr-a', name: 'a' }, createdAt: stamp, updatedAt: stamp, lastEditedBy: null, revision: 1, versions: [], legacy: null, state: 'active' }); db.settings = { systemDefaultPlanId: 'plan-0000beef', systemDefaultConfigured: true }; });
  const s = openPlanStore(file); assert.ok(s.db.plans.some((p) => p.seedKey === KEY27), 'the 2027 plan is created'); assert.equal(s.db.settings.systemDefaultPlanId, 'plan-0000beef', 'but the configured default is kept'); assert.equal(seedAudit(s.db).length, 1);
  assert.equal(s.db.audit.filter((e) => e.action === 'system_default_set').length, 0); assert.equal(s.db.references['2027'].planId, ID27, 'the reference entry is only set when none exists');
  const t = openPlanStore(fileStore('ref.json'), { seed: false }); t.mutate((db) => { db.references['2027'] = { planId: 'plan-0000beef', setBy: { userId: 'usr-a', name: 'a' }, at: stamp }; db.plans.push({ id: 'plan-0000beef', name: 'x', isSystem: false, origin: 'user', content: entityContent('x', [RIY], 1, fiscalYearPeriod(2027)), createdBy: null, createdAt: stamp, updatedAt: stamp, lastEditedBy: null, revision: 1, versions: [], legacy: null, state: 'active' }); });
  assert.equal(openPlanStore(fileStore('ref.json')).db.references['2027'].planId, 'plan-0000beef', 'an explicit 2027 reference is never replaced');
});

/* ================================================================== 6. migration of an existing schema-2 store */
ok('MIGRATION schema 2 → 3: every plan, personal default and reference is kept byte for byte; the 2027 plan is added; the remaining-2026 plan is derived on the first request and becomes the global default (never configured before); one migrate event; the old file is backed up once; idempotent', async () => {
  const at = '2026-11-06T11:10:26.475Z';
  const seed26 = openPlanStore(':memory:').db.plans.find((p) => p.id === SEED_PLAN_ID);
  const mine = { id: 'plan-c36843c5', name: 'خطة الواجهة', isSystem: false, origin: 'user', content: entityContent('خطة الواجهة', [RIY], 3000000), createdBy: { userId: 'usr-demo', name: 'طارق' }, createdAt: at, updatedAt: at, lastEditedBy: { userId: 'usr-demo', name: 'طارق' }, revision: 3, versions: [{ n: 1, revision: 1, content: entityContent('خطة الواجهة', [RIY], 3000000), savedBy: null, savedAt: at }], legacy: null, state: 'active' };
  const old = { schemaVersion: 2, plans: [J(seed26), mine], references: { 2026: { planId: SEED_PLAN_ID, setBy: { system: true }, at } }, userDefaults: { 'usr-demo': 'plan-c36843c5', 'usr-gone': 'plan-c36843c5' }, audit: [{ id: 'aud-old000001', at, actor: { system: true }, action: 'seed', planId: SEED_PLAN_ID, summary: { ar: 'قديم', en: 'old' } }] };
  const file = fileStore('v2.json'); fs.writeFileSync(file, JSON.stringify(old)); const original = fs.readFileSync(file, 'utf8');
  const s = openPlanStore(file); const db = s.db;
  assert.equal(db.schemaVersion, SCHEMA_VERSION); assert.equal(SCHEMA_VERSION, 3);
  assert.deepEqual(J(db.plans.slice(0, 2)), old.plans, 'the existing plans are identical'); assert.equal(db.plans.length, 3); assert.equal(db.plans[2].seedKey, KEY27);
  assert.deepEqual(db.userDefaults, old.userDefaults, 'personal defaults untouched'); assert.deepEqual(db.references['2026'], old.references['2026']); assert.equal(db.references['2027'].planId, ID27);
  assert.deepEqual(db.settings, { systemDefaultPlanId: SEED_PLAN_ID, systemDefaultConfigured: true }, 'the full-year 2026 seed plan becomes the initial global default (no administrator ever chose one)');
  assert.deepEqual(db.audit[0], old.audit[0]); const mig = db.audit.filter((e) => e.action === 'migrate'); assert.equal(mig.length, 1); assert.deepEqual([mig[0].actor, mig[0].details.fromSchema, mig[0].details.toSchema, mig[0].details.plans, mig[0].details.personalDefaults, mig[0].details.references], [{ system: true }, 2, 3, 2, 2, 1]);
  assert.equal(fs.readFileSync(`${file}.pre-v3.bak`, 'utf8'), original, 'the pre-migration file is kept'); assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).schemaVersion, 3);
  const bakStat = fs.statSync(`${file}.pre-v3.bak`).mtimeMs;
  const again = openPlanStore(file); assert.deepEqual(J(again.db), J(db), 'opening again changes nothing'); again.reload(); assert.deepEqual(J(again.db), J(db)); assert.equal(again.db.audit.filter((e) => e.action === 'migrate').length, 1); assert.equal(fs.statSync(`${file}.pre-v3.bak`).mtimeMs, bakStat, 'the backup is written once');
  // the personal default of that user still wins over the new global default
  useStore(s); const demoFull = (await get(DEMO, '/plans')).body.defaults; assert.equal(demoFull.userDefaultPlanId, 'plan-c36843c5'); assert.equal(demoFull.effectiveDefaultPlanId, 'plan-c36843c5'); assert.equal(demoFull.globalDefaultPlanId, SEED_PLAN_ID); assert.equal(demoFull.source, 'personal');
  assert.equal((await get(WRITER2, '/plans')).body.defaults.effectiveDefaultPlanId, SEED_PLAN_ID);
  assert.equal(planStore().db.plans.length, 4, 'the remaining-2026 plan was added after the 2027 plan, no plan dropped'); assert.deepEqual(J(planStore().db.plans.slice(0, 2)), old.plans); assert.deepEqual(planStore().db.userDefaults, old.userDefaults);
  useStore(resetPlanStore(':memory:'));
});

/* ================================================================== 7. the pure rule + client wrapper */
ok('defaultPlanResolution: personal → global → first system → first by name; an unseen / missing global falls back; `systemDefaultPlanId` mirrors the global one', () => {
  const P = [{ id: 'plan-b', name: 'ب' }, { id: 'plan-a', name: 'أ' }, { id: 'plan-s', name: 'ز النظام', isSystem: true }, { id: 'plan-g', name: 'ع' }];
  const r = (o) => defaultPlanResolution({ plans: P, ...o });
  assert.deepEqual(r({ globalDefaultPlanId: 'plan-g' }), { userDefaultPlanId: null, globalDefaultPlanId: 'plan-g', systemDefaultPlanId: 'plan-g', effectiveDefaultPlanId: 'plan-g', source: 'global' });
  assert.equal(r({ globalDefaultPlanId: 'plan-g', userDefaultPlanId: 'plan-b' }).effectiveDefaultPlanId, 'plan-b'); assert.equal(r({ globalDefaultPlanId: 'plan-g', userDefaultPlanId: 'plan-b' }).source, 'personal');
  assert.deepEqual([r({ globalDefaultPlanId: 'plan-gone' }).effectiveDefaultPlanId, r({ globalDefaultPlanId: 'plan-gone' }).source], ['plan-s', 'fallback'], 'a missing global default → the first system plan');
  assert.deepEqual([r({ globalDefaultPlanId: null }).effectiveDefaultPlanId, r({ globalDefaultPlanId: 'plan-g', visibleIds: ['plan-a', 'plan-b'] }).effectiveDefaultPlanId, r({ globalDefaultPlanId: 'plan-g', visibleIds: ['plan-a', 'plan-b'] }).globalDefaultPlanId], ['plan-s', 'plan-a', null], 'an invisible global default is not reported and falls back by name');
  assert.equal(r({}).effectiveDefaultPlanId, 'plan-s', 'undefined global = the first system plan (the earlier behaviour)'); assert.equal(defaultPlanResolution({}).source, 'none');
});
ok('plansClient.setSystemDefault / getSystemDefault call the new route; the plansApi object exposes them', async () => {
  assert.equal(typeof plansApi.setSystemDefault, 'function'); assert.equal(typeof plansApi.getSystemDefault, 'function');
  const calls = []; const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push([String(url), init && init.method, init && init.body]); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ defaults: {} }), text: async () => '{"defaults":{}}' }; };
  try { await plansApi.setSystemDefault('plan-x'); await plansApi.getSystemDefault(); } catch { /* the transport needs a session; the call list is what is checked */ } finally { globalThis.fetch = realFetch; }
  assert.ok(calls.some(([u, m, b]) => u.endsWith('/api/plans/system-default') && m === 'PUT' && JSON.parse(b).planId === 'plan-x'), JSON.stringify(calls)); assert.ok(calls.some(([u, m]) => u.endsWith('/api/plans/system-default') && m === 'GET'));
});
ok('hygiene: no secrets, no retired term «المقبوضات» and no «معتمد» in the new payloads; the clock hook exists for tests', async () => {
  assert.equal(typeof setPlansClockForTests, 'function');
  const all = JSON.stringify([(await get(ADMIN, '/plans')).body, (await get(ADMIN, '/plans/system-default')).body]);
  assert.ok(!/password|scrypt|secret|hash|token/i.test(all)); assert.ok(!/المقبوضات|مقبوض/.test(all));
});

/* ================================================================== 8. THE REMAINING-2026 PLAN: the GLOBAL default, derived once from the data engine, frozen */
const remOf = (db) => db.plans.find((p) => p.seedKey === KEYR);
ok('PURE derivation (crafted input): remaining = max(0, annual − actual) per entity, surplus kept SEPARATE (never netted, never a negative target), Σ remaining + Σ min(annual, actual) = Σ annual; an entity above its allocation shows surplus and ZERO remaining; target = Σ remaining; zero remaining shows the surplus; the period / cut-off / distribution are the plan\'s own', () => {
  const annual = normalizeContent({ name: 'سنوية', scope: { kind: 'ministry' }, period: FY, target: { amount: 1000 }, allocations: [{ entityKey: RIY, amount: 600, origin: 'seed' }, { entityKey: JED, amount: 300, origin: 'seed' }, { entityKey: 'Makkah Amanah', amount: 100, origin: 'seed' }], distribution: { profile: 'equal' } });
  const c = deriveRemainingPlanContent({ annualContent: annual, actualByEntity: { [RIY]: 250.4, [JED]: 450, 'Unlisted Entity': 999 /* not in the annual plan: ignored */ }, cutoff: '2026-11-06', period: REMAINING_PLAN_2026.period, annualPlanId: 'plan-a', annualPlanRevision: 1, derivedAt: '2026-11-06T09:00:00.000Z' });
  const b = c.baseline; const by = Object.fromEntries(b.entities.map((e) => [e.entityKey, e]));
  assert.deepEqual(by[RIY], { entityKey: RIY, annual: 600, actual: 250, remaining: 350, surplus: 0 });
  assert.deepEqual(by[JED], { entityKey: JED, annual: 300, actual: 450, remaining: 0, surplus: 150 }, 'above its allocation: zero remaining, a surplus of its own');
  assert.deepEqual(by['Makkah Amanah'], { entityKey: 'Makkah Amanah', annual: 100, actual: 0, remaining: 100, surplus: 0 }, 'no actual = 0');
  assert.equal(c.target.amount, 450, 'the target is Σ remaining (350 + 0 + 100), NOT the Ministry arithmetic 1000 − 700 = 300'); assert.notEqual(c.target.amount, b.annualTarget - b.actualToCutoff);
  assert.deepEqual([b.annualTarget, b.actualToCutoff, b.remaining, b.surplus], [1000, 700, 450, 150]);
  assert.equal(b.entities.reduce((t, e) => t + e.remaining + Math.min(e.annual, e.actual), 0), b.annualTarget, 'Σ remaining + Σ min(annual, actual) = Σ annual'); assert.ok(b.entities.every((e) => e.remaining >= 0 && e.surplus >= 0));
  assert.deepEqual(c.allocations.map((a) => [a.entityKey, a.amount, a.origin]), [[RIY, 350, 'derived'], ['Makkah Amanah', 100, 'derived']], 'no row for a zero remaining; origin derived'); assert.ok(c.allocations.every((a) => a.note.includes('المتبقي = المستهدف السنوي − المحصّل حتى 6 نوفمبر 2026')));
  assert.equal(c.allocations.reduce((t, a) => t + a.amount, 0), c.target.amount); assert.deepEqual(c.period, { start: '2026-11-07', end: '2026-12-31', preset: 'range' }); assert.deepEqual(c.distribution, { profile: 'equal' }); assert.equal(c.municipalAllocations, undefined);
  assert.deepEqual([b.cutoff, b.annualPlanId, b.annualPlanRevision, b.derivedAt], ['2026-11-06', 'plan-a', 1, '2026-11-06T09:00:00.000Z']); assert.ok(b.convention.ar.includes('يختلف') && b.convention.en.includes('differs'), 'the entity-level convention is stated'); assert.ok(b.note.ar.includes('توزيع متساوٍ على الأيام المتبقية — افتراض'));
  // every entity above its allocation: zero remaining, the plan shows the surplus
  const z = deriveRemainingPlanContent({ annualContent: annual, actualByEntity: { [RIY]: 600, [JED]: 301, 'Makkah Amanah': 1000 }, derivedAt: 'x' }); assert.equal(z.target.amount, 0); assert.deepEqual(z.allocations, []); assert.equal(z.baseline.remaining, 0); assert.equal(z.baseline.surplus, 1 + 900);
  // a deterministic pure function: same input, same output; the input is not mutated
  const frozen = JSON.parse(JSON.stringify(annual)); deriveRemainingPlanContent({ annualContent: annual, actualByEntity: { [RIY]: 1 } }); assert.deepEqual(annual, frozen);
});
ok('the remaining-2026 plan is created from the REAL engine on the first plans request: ONE system plan (seedKey, isSystem, origin seed, ownerless), AR/EN names, period 7 Nov – 31 Dec 2026 (range) and the baseline cut-off 6 Nov saved in the content, Ministry scope, explicit equal profile, derived allocations, no municipal rows, audited by the system', async () => {
  useStore(resetPlanStore(':memory:')); const r = await get(DEMO, '/plans'); assert.equal(r.code, 200);
  const p = r.body.plans.find((x) => x.seedKey === KEYR); assert.ok(p); assert.equal(r.body.plans.filter((x) => x.seedKey === KEYR).length, 1);
  assert.deepEqual([p.id, p.name, p.nameEn, p.isSystem, p.origin, p.createdBy, p.lastEditedBy, p.revision], [REM, 'خطة تحصيل المتبقي من 2026', 'Remaining 2026 Collection Plan', true, 'seed', null, null, 1]); assert.equal(p.name, p.content.name);
  const c = p.content; assert.deepEqual(c.period, { start: '2026-11-07', end: '2026-12-31', preset: 'range' }); assert.deepEqual(c.scope, { kind: 'ministry' }); assert.deepEqual(c.distribution, { profile: 'equal' }); assert.equal(c.municipalAllocations, undefined);
  assert.equal(c.baseline.cutoff, '2026-11-06'); assert.equal(c.baseline.annualPlanId, SEED_PLAN_ID); assert.equal(c.baseline.annualPlanRevision, 1); assert.equal(c.baseline.derivedAt, p.createdAt); assert.ok(c.allocations.every((a) => a.origin === 'derived' && a.amount > 0));
  assert.deepEqual(p.viewer, { canEdit: false, reason: 'system_plan' }); assert.ok(!/معتمد/.test(JSON.stringify({ ...p, legacy: null })), 'no approval wording');
  const a = (await get(DEMO, `/plans/${REM}/audit`)).body.entries; const seed = a.find((e) => e.action === 'seed'); assert.deepEqual(seed.actor, { system: true }); assert.ok(seed.summary.ar.includes('بيانات توضيحية') && seed.summary.en.includes('illustrative') && seed.details.annualPlanId === SEED_PLAN_ID);
  assert.ok(!a.some((e) => e.action === 'system_default_set'), 'the remaining plan is NOT made the default'); const sd = (await get(DEMO, `/plans/${SEED_PLAN_ID}/audit`)).body.entries.find((e) => e.action === 'system_default_set'); assert.deepEqual(sd.actor, { system: true }); assert.equal(sd.details.reason, 'no_administrator_choice'); assert.equal(sd.details.previous, null, 'the full-year 2026 plan is the initial default of a fresh store');
});
ok('RECONCILES with the 2026 plan\'s page at the same cut-off: the baseline actuals ARE the planning page\'s own figures (loadPlanInputsForPlan over the annual period, approved config, receipts by payment date, any invoice); Σ remaining + Σ min(annual, actual) = Σ annual; surplus ≥ 0; the target is Σ remaining', async () => {
  const db = planStore().db; const p = remOf(db); const b = p.content.baseline; const annual = db.plans.find((x) => x.id === SEED_PLAN_ID);
  const st = loadStore('2026-11-06'); const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: '2026-11-06' });
  const rev = { data: { snapshot: async (scope, o = {}) => snapshot(st, { scope, cfg: o.cfg || cfg }), series: async (scope, o = {}) => series(st, { scope, cfg: o.cfg || cfg }) } };
  const D = await loadPlanInputsForPlan(rev, { view: { period: annual.content.period, scope: annual.content.scope, content: annual.content }, reporting: '2026-11-06', approvedCfg: cfg, entityKeys: null, viewScope: null });
  assert.equal(b.actualToCutoff, Math.round(annual.content.allocations.reduce((t, a) => t + Math.round(D.actual.byEntity[a.entityKey] || 0), 0)), 'the same receipts the planning page shows');
  for (const e of b.entities) assert.equal(e.actual, Math.round(D.actual.byEntity[e.entityKey] || 0), e.entityKey);
  assert.equal(b.annualTarget, annual.content.target.amount); assert.equal(b.entities.reduce((t, e) => t + e.remaining + Math.min(e.annual, e.actual), 0), b.annualTarget);
  assert.equal(p.content.target.amount, b.entities.reduce((t, e) => t + e.remaining, 0)); assert.ok(b.entities.every((e) => e.remaining >= 0 && e.surplus >= 0)); assert.ok(p.content.target.amount > 0 && p.content.target.amount < b.annualTarget, 'never the full annual target reused as the remaining target');
  assert.equal(p.content.allocations.reduce((t, a) => t + a.amount, 0), p.content.target.amount); assert.equal(b.surplus, b.entities.reduce((t, e) => t + e.surplus, 0));
  assert.equal((await engineActualsToCutoff(annual.content, '2026-11-06')).byEntity[RIY] >= 0, true, 'the server\'s provider is the same engine');
});
ok('IDEMPOTENT + FROZEN: a restart, a second request and FIVE concurrent first requests create ONE plan; a later change of the actuals (the engine moving on) never recomputes or shifts the stored period, cut-off, figures or revision', async () => {
  const file = fileStore('remaining.json'); const live = resetPlanStore(file); useStore(live);
  const rs = await Promise.all([1, 2, 3, 4, 5].map(() => get([DEMO, ADMIN, AUDITOR, WRITER, WRITER2][0], '/plans'))); assert.ok(rs.every((r) => r.code === 200));
  assert.equal(live.db.plans.filter((p) => p.seedKey === KEYR).length, 1); const first = J(remOf(live.db)); assert.equal(live.db.audit.filter((e) => e.action === 'seed' && e.planId === first.id).length, 1);
  setRemainingProviderForTests(async () => ({ byEntity: Object.fromEntries(first.content.baseline.entities.map((e) => [e.entityKey, e.annual * 2])), total: 1 })); // the engine "moved on": would give different numbers
  try {
    await get(DEMO, '/plans'); assert.deepEqual(J(remOf(live.db)), first, 'unchanged by a second request');
    const fresh = openPlanStore(file); useStore(fresh); assert.deepEqual(J(remOf(fresh.db)), first, 'unchanged by a restart'); await get(ADMIN, '/plans'); assert.equal(fresh.db.plans.filter((p) => p.seedKey === KEYR).length, 1); assert.deepEqual(J(remOf(fresh.db)), first);
    const again = openPlanStore(file); assert.deepEqual(J(again.db.plans), J(fresh.db.plans)); assert.equal(again.db.audit.filter((e) => e.action === 'seed' && e.planId === first.id).length, 1);
  } finally { setRemainingProviderForTests(null); useStore(resetPlanStore(':memory:')); }
});
ok('NEVER invented: when the engine cannot be reached (provider null / throws) the plan is NOT created and the global default stays unset; the NEXT request creates it with real figures', async () => {
  const s = resetPlanStore(':memory:'); useStore(s);
  setRemainingProviderForTests(async () => null); try { const r = await get(DEMO, '/plans'); assert.equal(r.code, 200); assert.equal(remOf(s.db), undefined); assert.equal(r.body.defaults.globalDefaultPlanId, SEED_PLAN_ID, 'the default is the full-year 2026 seed plan whether or not the remaining plan exists'); assert.equal(r.body.defaults.source, 'global'); } finally { setRemainingProviderForTests(null); }
  setRemainingProviderForTests(async () => { throw new Error('engine down'); }); try { assert.equal((await get(DEMO, '/plans')).code, 200); assert.equal(remOf(s.db), undefined); } finally { setRemainingProviderForTests(null); }
  const r = await get(DEMO, '/plans'); assert.equal(r.body.defaults.globalDefaultPlanId, SEED_PLAN_ID, 'creating the remaining plan does NOT make it the default'); assert.ok(remOf(s.db).content.baseline.actualToCutoff > 0);
  useStore(resetPlanStore(':memory:'));
});
ok('GLOBAL DEFAULT policy: a fresh store AND a default set only by the SYSTEM under an earlier policy (the 2027 or the remaining-2026 plan) resolve to the FULL-YEAR 2026 seed plan, with a system audit event naming the previous plan; an administrator\'s explicit choice is KEPT (also across restarts and when the remaining plan is created later)', async () => {
  const mk = (file, admin) => {
    const s0 = openPlanStore(file); const id27 = s0.db.plans.find((p) => p.seedKey === KEY27).id;
    s0.mutate((db) => { db.settings = { systemDefaultPlanId: id27, systemDefaultConfigured: true }; db.audit = db.audit.filter((e) => e.action !== 'system_default_set'); db.audit.push({ id: 'aud-old1', at: stamp, actor: { system: true }, action: 'system_default_set', planId: id27, summary: { ar: 'x', en: 'x' } });
      if (admin) db.audit.push({ id: 'aud-adm1', at: stamp, actor: { userId: 'usr-admin', name: 'admin' }, action: 'system_default_set', planId: id27, summary: { ar: 'x', en: 'x' } }); });
    return { id27 };
  };
  const f1 = fileStore('mig-sys.json'); const { id27 } = mk(f1, false); const s1 = openPlanStore(f1); useStore(s1); const r1 = await get(ADMIN, '/plans');
  assert.equal(s1.db.settings.systemDefaultPlanId, SEED_PLAN_ID); assert.equal(r1.body.defaults.effectiveDefaultPlanId, SEED_PLAN_ID); assert.ok(remOf(s1.db), 'the remaining plan is created but is not the default'); const ev = s1.db.audit.filter((e) => e.action === 'system_default_set').at(-1); assert.deepEqual(ev.actor, { system: true }); assert.equal(ev.details.previous, id27); assert.equal(ev.details.reason, 'no_administrator_choice');
  const f2 = fileStore('mig-adm.json'); const m2 = mk(f2, true); const s2 = openPlanStore(f2); useStore(s2); const r2 = await get(ADMIN, '/plans'); assert.ok(remOf(s2.db), 'the plan is created'); assert.equal(s2.db.settings.systemDefaultPlanId, m2.id27, 'the administrator\'s choice stays'); assert.equal(r2.body.defaults.effectiveDefaultPlanId, m2.id27);
  // and a LATER restart never switches it back
  const s3 = openPlanStore(f2); useStore(s3); await get(ADMIN, '/plans'); assert.equal(s3.db.settings.systemDefaultPlanId, m2.id27); useStore(resetPlanStore(':memory:'));
});
ok('permissions: the baseline follows the viewer — a restricted viewer gets only their entities\' baseline rows and Σ of those (never the Ministry totals); an Amanah seen through MUNICIPAL grants only gets NO baseline; read-only / restricted users cannot edit the plan; nobody\'s access is widened by it being the default', async () => {
  const full = (await get(ADMIN, `/plans/${REM}`)).body.plan; const fb = full.content.baseline;
  const j = (await get(JED_USER, `/plans/${REM}`)).body.plan; assert.equal(j.masked, true); assert.deepEqual(j.content.baseline.entities.map((e) => e.entityKey), [JED]); const je = fb.entities.find((e) => e.entityKey === JED);
  assert.deepEqual([j.content.baseline.annualTarget, j.content.baseline.actualToCutoff, j.content.baseline.remaining, j.content.baseline.surplus], [je.annual, je.actual, je.remaining, je.surplus]); assert.deepEqual(j.content.allocations.map((a) => a.entityKey), [JED]);
  for (const hidden of [fb.annualTarget, fb.actualToCutoff, fb.remaining, full.content.target.amount]) assert.ok(!JSON.stringify(j).includes(String(hidden)), `no Ministry total (${hidden}) in the restricted payload`);
  const m = (await get(JED_MUNI, `/plans/${REM}`)).body.plan; assert.equal(m.content.baseline, undefined, 'no baseline for a municipal-only viewer'); assert.ok(!JSON.stringify(m).includes(String(fb.annualTarget)));
  for (const u of [JED_USER, JED_MUNI, AUDITOR, READER]) { assert.equal((await get(u, `/plans/${REM}`)).body.plan.viewer.canEdit, false, u.user.username); assert.equal((await put(u, `/plans/${REM}`, { revision: 1, content: full.content })).code, 403); }
  assert.deepEqual((await get(JED_USER, '/plans')).body.defaults.effectiveDefaultPlanId, SEED_PLAN_ID, 'the restricted viewer opens the (masked) default'); assert.equal((await put(READER, `/plans/system-default`, { planId: REM })).code, 403);
});
ok('the defaults for demo, auditor and the restricted user are the SAME (the FULL-YEAR 2026 seed plan), the explicit link to another plan is unaffected, and the 2027 plan stays selectable (upcoming, full year, its own period)', async () => {
  for (const u of [DEMO, AUDITOR, JED_USER, JED_MUNI, FRESH]) { const r = await get(u, '/plans'); assert.equal(r.body.defaults.effectiveDefaultPlanId, SEED_PLAN_ID, u.user.username); assert.ok([REM, ID27, SEED_PLAN_ID].every((id) => r.body.plans.some((p) => p.id === id)), 'selector keeps all system plans'); }
  const p27 = (await get(DEMO, `/plans/${ID27}`)).body.plan; assert.deepEqual(p27.content.period, { start: '2027-01-01', end: '2027-12-31', preset: 'fiscal-year' }); assert.equal(p27.content.baseline, undefined);
});

for (const run of pending) await run();
console.log(`plans-global-default: ${n} tests passed`);
