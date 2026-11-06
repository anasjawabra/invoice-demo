// Revenue plans — shared server-side persistence, API, permissions, audit, snapshots, concurrency, migration and the client cache (docs/revenue-plans-spec.md §10 — the SIMPLIFIED workflow: named SAVED plans, no draft / activation / archive).
// Run: npm run test:plansserver — HTTP-level through handleApi with signed tokens of the real identity module (IN-MEMORY identity store) and the plans store (in memory, or a TEMP FILE for the restart / migration tests).
// Two signed-in sessions share one stored plan; the repository's server/.data files are never touched. Synthetic data only.
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
import { resetPlanStore, openPlanStore, useStore, planStore, SEED_PLAN_ID, SCHEMA_VERSION } from '../server/plans/store.js';
import * as svc from '../server/plans/service.js';
import { planView, normalizeContent } from '../src/data/plans/planRules.js';
import { seedPlanContent, COLLECTION_PLAN_2027, REMAINING_PLAN_2026 } from '../src/data/plans/planDefaults.js';
import * as S from '../src/data/plans/planStore.js';
import { plansApi, PlansApiError } from '../src/api/plansClient.js';
import * as session from '../src/api/session.js';

const PLAN_2027_ID = COLLECTION_PLAN_2027.id; const REM_ID = REMAINING_PLAN_2026.id;
let n = 0; const pending = [];
const ok = (name, fn) => { const run = async () => { try { await fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } }; pending.push(run); };
process.env.IIM_PLANS_FILE = ':memory:';
resetForTests(':memory:');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'plans-test-'));
let store = resetPlanStore(':memory:');
assert.equal(typeof window, 'undefined', 'the suite runs without a window (the client cache is Node-safe)');

/* ------------------------------------------------------------------ users (isolated, in-memory identity store) */
let seq = 0; const stamp = new Date().toISOString();
function mkUser(modules, scope = ALL_SCOPE, { readOnly = false } = {}) {
  const db = getDb(); seq += 1;
  db.roles.push({ id: `role-p${seq}`, nameAr: `دور ${seq}`, nameEn: `Plans role ${seq}`, descriptionAr: '', descriptionEn: '', modules: [...modules], readOnly, starter: false, protected: false, createdAt: stamp, updatedAt: stamp });
  const user = { id: `usr-p${seq}`, username: `p${seq}`, email: null, nameAr: `مستخدم ${seq}`, nameEn: `User ${seq}`, avatar: 'P', status: 'active', roleId: `role-p${seq}`, scope, tokenVersion: 1, createdAt: stamp, createdBy: 'test', updatedAt: stamp, lastLoginAt: null, credential: hashPassword('Test-pass-1234') };
  db.users.push(user); commit();
  return { user, token: issueToken(user) };
}
const seeded = (username) => { const user = getDb().users.find((u) => u.username === username); return { user, token: issueToken(user) }; };
const DEMO = seeded('demo'); const ADMIN = seeded('admin'); const AUDITOR = seeded('auditor');
const JED = 'Jeddah Amanah'; const RIY = 'Riyadh Amanah'; const HOUSING = 'Housing Sector'; const MAK = 'Makkah Amanah';
const jedRef = municipalitiesOf(JED)[0].refId;
const JED_USER = mkUser(['planning'], normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(JED)] }));
const JED_MUNI = mkUser(['planning'], normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: JED, municipalities: [jedRef], direct: false, notSpecified: false }] }));
const NO_MODULE = mkUser(['dashboard']);
const WRITER = mkUser(['planning']);

/* ------------------------------------------------------------------ HTTP helper; every response text is kept for the secrets scan */
const ALL_TEXT = [];
function call(u, method, p, body, headers = {}) {
  return new Promise((resolve) => {
    const res = { chunks: [], writeHead(c, h) { this.code = c; this.headers = h || {}; }, write(c) { this.chunks.push(String(c)); return true; }, once() {}, end(b) { const t = b !== undefined ? b : this.chunks.join(''); ALL_TEXT.push(t); let j = null; try { j = JSON.parse(t); } catch { /* */ } resolve({ code: this.code, headers: this.headers, text: t, body: j }); } };
    handleApi({ method, url: `/api${p}`, headers: { ...(u && u.token ? { authorization: `Bearer ${u.token}` } : {}), ...headers }, body: method === 'GET' ? undefined : JSON.parse(JSON.stringify(body || {})) }, res);
  });
}
const get = (u, p) => call(u, 'GET', p); const post = (u, p, b) => call(u, 'POST', p, b); const put = (u, p, b) => call(u, 'PUT', p, b);
const J = (x) => JSON.parse(JSON.stringify(x));
const sum = (a) => a.reduce((t, x) => t + x, 0);
const FY = { start: '2026-01-01', end: '2026-12-31', preset: 'fiscal-year' };
const FY27 = { start: '2027-01-01', end: '2027-12-31', preset: 'fiscal-year' };
let nameSeq = 0; const nm = (base = 'خطة') => `${base} ${(nameSeq += 1)}`;
/** a complete (saveable) entity-plan content */
const entityContent = (name, keys, amount, period = FY) => ({ name, scope: { kind: 'entities', entityKeys: keys }, period, target: { amount }, allocations: keys.map((k, i) => ({ entityKey: k, amount: i === 0 ? amount - Math.floor(amount / keys.length) * (keys.length - 1) : Math.floor(amount / keys.length), origin: 'manual' })), distribution: { profile: 'equal' }, advanced: {} });
/** POST /plans → the saved plan record */
async function created(u, content, extra = {}) { const c = await post(u, '/plans', { name: content.name, content, ...extra }); assert.equal(c.code, 201, c.text); return c.body.plan; }
const seedPlan = async (u = ADMIN) => (await get(u, `/plans/${SEED_PLAN_ID}`)).body.plan;
const OLD_KEYS = ['working', 'inForce', 'hasWorking', 'archivedAt', 'type'];
const noOldSurface = (p) => { for (const k of OLD_KEYS) assert.equal(k in p, false, `the plan record has no «${k}»`); assert.equal(p.state, 'active'); };

/* ================================================================== 1. authentication, module, headers, routes */
ok('401 without a token on every plan route; 403 forbidden (no data) without the planning module; no-store + x-access-version; the draft / activate / archive / restore / discard routes are GONE', async () => {
  const routes = [['GET', '/plans'], ['POST', '/plans'], ['PUT', '/plans/default'], ['GET', '/plans/references'], ['POST', '/plans/references'], ['POST', '/plans/import-legacy'], ['GET', '/plans/plan-x'], ['PUT', '/plans/plan-x'], ['GET', '/plans/plan-x/versions/1'], ['GET', '/plans/plan-x/audit']];
  for (const [m, p] of routes) {
    const r = await call(null, m, p, {}); assert.equal(r.code, 401, `${m} ${p}`); assert.deepEqual(r.body, { error: 'unauthenticated' });
    const f = await call(NO_MODULE, m, p, {}); assert.equal(f.code, 403, `${m} ${p}`); assert.equal(f.body.error, 'forbidden'); assert.equal(f.body.permission, 'planning'); assert.deepEqual(Object.keys(f.body).sort(), ['error', 'module', 'permission']);
  }
  const r = await get(DEMO, '/plans'); assert.equal(r.code, 200); assert.equal(r.headers['Cache-Control'], 'no-store'); assert.ok(String(r.headers['x-access-version']).length > 0);
  assert.equal(requiredPermissionFor('GET', '/plans/plan-x', {}).anyOf[0], 'planning'); assert.equal(requiredPermissionFor('GET', '/plans/plan-x/audit', {}).write, undefined);
  for (const [m, p] of [['POST', '/plans'], ['PUT', '/plans/plan-x'], ['POST', '/plans/references'], ['POST', '/plans/import-legacy']]) assert.equal(requiredPermissionFor(m, p, {}).write, true, `${m} ${p}`);
  assert.equal(requiredPermissionFor('PUT', '/plans/default', {}).write, undefined, 'a personal preference is not a plan change');
  assert.ok(ENDPOINTS.some(([m, p]) => m === 'GET' && p === '/plans') && ENDPOINTS.some(([m, p]) => m === 'PUT' && p === '/plans/default'));
  for (const [m, p] of [['PATCH', '/plans/plan-x/draft'], ['POST', '/plans/plan-x/activate'], ['POST', '/plans/plan-x/archive'], ['POST', '/plans/plan-x/restore'], ['POST', '/plans/plan-x/discard-revision']]) { const g = await call(DEMO, m, p, { revision: 1 }); assert.equal(g.code, 404, `${m} ${p}`); assert.deepEqual(g.body, { error: 'not_found' }); }
  assert.equal(ENDPOINTS.some(([, p]) => p.startsWith('/plans') && /activate|archive|restore|discard|draft/.test(p)), false);
});

/* ================================================================== 2. the system plan (the seed) */
ok('the seed: the 2026 SYSTEM plan (isSystem, illustrative, ownerless, state constant, no draft / working / inForce surface), the 2026 reference, a system audit event; nothing is called «معتمد» (the 2027 and the remaining-2026 plans are the other system plans)', async () => {
  const r = await get(DEMO, '/plans'); assert.equal(r.code, 200);
  assert.equal(r.body.plans.length, 3); const p = r.body.plans.find((x) => x.id === SEED_PLAN_ID);
  assert.equal(p.id, SEED_PLAN_ID); assert.equal(p.isSystem, true); assert.equal(p.origin, 'seed'); assert.equal(p.createdBy, null); assert.equal(p.lastEditedBy, null); assert.equal(p.revision, 1); noOldSurface(p);
  assert.ok(p.name.includes('توضيحية') && p.name === p.content.name, 'labelled illustrative; the record name mirrors the content name');
  assert.equal(p.content.period.start, '2026-01-01'); assert.equal(p.content.scope.kind, 'ministry'); assert.equal(p.content.distribution.profile, 'equal'); assert.equal(sum(p.content.allocations.map((a) => a.amount)), p.content.target.amount);
  assert.deepEqual(p.versions.map((v) => [v.n, v.revision, v.savedBy]), [[1, 1, null]]); assert.equal(p.versionCount, 1); assert.equal(p.versions[0].content, undefined, 'snapshots are metadata only in the record (content via /versions/:n)');
  assert.deepEqual(p.viewer, { canEdit: false, reason: 'system_plan' });
  assert.deepEqual(r.body.defaults, { userDefaultPlanId: null, globalDefaultPlanId: SEED_PLAN_ID, systemDefaultPlanId: SEED_PLAN_ID, effectiveDefaultPlanId: SEED_PLAN_ID, source: 'global' }, 'the full-year 2026 seed plan is the global default (the remaining-2026 and 2027 plans are NOT)');
  assert.deepEqual(r.body.references['2026'].planId, SEED_PLAN_ID); assert.deepEqual(r.body.references['2026'].setBy, { system: true });
  const a = await get(DEMO, `/plans/${SEED_PLAN_ID}/audit`); assert.equal(a.code, 200);
  assert.ok(a.body.entries.some((e) => e.action === 'seed' && e.actor.system === true) && a.body.entries.some((e) => e.action === 'reference_set' && e.actor.system === true && e.details.year === 2026));
  assert.deepEqual(r.body.storage, { mode: 'memory', durable: false, localDemo: true });
  assert.ok(!/معتمد/.test(JSON.stringify(r.body.plans.map((x) => ({ ...x, legacy: null })))), 'no «معتمد» on a plan');
  assert.equal(r.body.capabilities.canSetReference, true); assert.equal(r.body.capabilities.canCreate, true);
  const v = await get(DEMO, `/plans/${SEED_PLAN_ID}/versions/1`); assert.equal(v.code, 200); assert.equal(v.body.version.content.name, p.name); assert.equal(v.body.version.isCurrent, true); assert.equal(v.body.view.versionId, `${SEED_PLAN_ID}@s1`);
});
ok('the 2026 seed runs only when the store holds NO plans; a fresh document is schema 3 with empty userDefaults and the settings of the global default', () => {
  const s = openPlanStore(':memory:'); assert.equal(s.db.plans.length, 2); assert.equal(s.db.schemaVersion, SCHEMA_VERSION); assert.equal(SCHEMA_VERSION, 3); assert.deepEqual(s.db.userDefaults, {}); assert.deepEqual(s.db.settings, { systemDefaultPlanId: SEED_PLAN_ID, systemDefaultConfigured: true }, 'the global default is the full-year 2026 seed plan from the start (no data-engine step involved)');
  const before = s.db.audit.length; s.reload(); assert.equal(s.db.plans.length, 2); assert.equal(s.db.audit.length, before);
  const empty = openPlanStore(':memory:', { seed: false }); assert.equal(empty.db.plans.length, 0); assert.equal(empty.db.audit.length, 0);
});

/* ================================================================== 3. create: two sessions see the same saved plan */
ok('TWO SESSIONS: a plan created by A appears in B\'s list and by id; the owner is the creator\'s user id (not the body); no draft state; the audit names the creator', async () => {
  const c = entityContent(nm('خطة مشتركة'), [RIY], 5000000);
  const r = await post(DEMO, '/plans', { name: c.name, content: c, createdBy: { userId: 'usr-evil', name: 'evil' }, origin: 'seed', isSystem: true, state: 'archived' }); assert.equal(r.code, 201, r.text);
  const p = r.body.plan; assert.match(p.id, /^plan-[0-9a-f]{8}$/); noOldSurface(p);
  assert.deepEqual([p.isSystem, p.origin, p.revision, p.versions.length], [false, 'user', 1, 1]);
  assert.equal(p.createdBy.userId, DEMO.user.id); assert.equal(p.createdBy.name, DEMO.user.nameAr); assert.equal(p.lastEditedBy.userId, DEMO.user.id); assert.equal(p.content.target.amount, 5000000); assert.equal(p.name, c.name);
  assert.deepEqual(r.body.defaults.userDefaultPlanId, null);
  const bList = await get(ADMIN, '/plans'); const seen = bList.body.plans.find((x) => x.id === p.id); assert.ok(seen, 'B sees it in the list'); assert.equal(seen.content.target.amount, 5000000);
  const bPlan = await get(ADMIN, `/plans/${p.id}`); assert.equal(bPlan.code, 200); assert.equal(bPlan.body.plan.createdBy.userId, DEMO.user.id); assert.equal(bPlan.body.plan.createdBy.currentName.ar, DEMO.user.nameAr, 'display resolves the CURRENT name from the user id');
  assert.equal(bPlan.body.plan.viewer.canEdit, true, 'an authorised user may edit a saved plan of their scope — owner or not');
  assert.deepEqual((await get(DEMO, `/plans/${p.id}/audit`)).body.entries.map((e) => [e.action, e.actor.userId]), [['create', DEMO.user.id]]);
  assert.equal((await post(DEMO, '/plans', { name: c.name, content: entityContent('x', [RIY], 1) })).code, 409, 'the same name is refused');
  const empty = await post(DEMO, '/plans', { name: 'بلا محتوى' }); assert.equal(empty.code, 400); assert.equal(empty.body.errors[0].code, 'content_required');
  assert.equal((await post(DEMO, '/plans', { name: 'x', content: { scope: { kind: 'ministry' } }, copyOf: 7 })).body.errors[0].code, 'copy_of_invalid');
});

/* ================================================================== 4. update: the same plan, owner untouched */
ok('UPDATE saves THAT plan: no duplicate, revision + 1, one more snapshot, owner unchanged, lastEditedBy = the editor (another user\'s edit included), audit names both actors', async () => {
  const base = entityContent(nm('خطة تعديل'), [RIY], 2000000); const p = await created(DEMO, base); const count = (await get(ADMIN, '/plans')).body.plans.length;
  const edited = entityContent(`${base.name} — بعد تعديل المستخدم الثاني`, [RIY], 5000000);
  const e = await put(ADMIN, `/plans/${p.id}`, { revision: p.revision, content: edited }); assert.equal(e.code, 200, e.text); const q = e.body.plan;
  assert.equal(q.id, p.id); assert.equal((await get(ADMIN, '/plans')).body.plans.length, count, 'no duplicate plan'); noOldSurface(q);
  assert.deepEqual([q.revision, q.versions.length, q.versionCount], [2, 2, 2]); assert.equal(q.content.target.amount, 5000000); assert.equal(q.name, edited.name); assert.equal(q.content.name, edited.name);
  assert.equal(q.createdBy.userId, DEMO.user.id, 'owner unchanged'); assert.equal(q.lastEditedBy.userId, ADMIN.user.id, 'lastEditedBy = the editor'); assert.ok(q.updatedAt >= q.createdAt); assert.equal(q.createdAt, p.createdAt);
  const aSees = (await get(DEMO, `/plans/${p.id}`)).body.plan; assert.equal(aSees.content.target.amount, 5000000, 'A sees B\'s save'); assert.equal(aSees.lastEditedBy.userId, ADMIN.user.id);
  // the technical snapshots keep BOTH saves
  const v1 = (await get(DEMO, `/plans/${p.id}/versions/1`)).body; const v2 = (await get(DEMO, `/plans/${p.id}/versions/2`)).body;
  assert.equal(v1.version.content.target.amount, 2000000); assert.equal(v1.version.isCurrent, false); assert.equal(v2.version.content.target.amount, 5000000); assert.equal(v2.version.isCurrent, true); assert.equal(v2.version.savedBy.userId, ADMIN.user.id); assert.equal((await get(DEMO, `/plans/${p.id}/versions/9`)).code, 404);
  // the creator edits again: still the same owner; the rename-only PUT (name without content) keeps the content
  const again = await put(DEMO, `/plans/${p.id}`, { revision: 2, content: { ...edited, target: { amount: 6000000 }, allocations: [{ entityKey: RIY, amount: 6000000, origin: 'manual' }] } }); assert.equal(again.code, 200); assert.equal(again.body.plan.createdBy.userId, DEMO.user.id); assert.equal(again.body.plan.lastEditedBy.userId, DEMO.user.id);
  const renamed = await put(DEMO, `/plans/${p.id}`, { revision: 3, name: `${base.name} — باسم جديد` }); assert.equal(renamed.code, 200); assert.equal(renamed.body.plan.name, `${base.name} — باسم جديد`); assert.equal(renamed.body.plan.content.target.amount, 6000000); assert.equal(renamed.body.plan.content.name, renamed.body.plan.name);
  const au = (await get(ADMIN, `/plans/${p.id}/audit`)).body; assert.deepEqual(au.entries.map((x) => x.action), ['update', 'update', 'update', 'create']); assert.equal(au.entries[2].actor.userId, ADMIN.user.id); assert.equal(au.entries[3].actor.userId, DEMO.user.id); assert.ok(au.entries.every((x) => x.actor.name && x.summary.ar && x.summary.en));
  // the body name wins over the content name
  const q2 = await put(DEMO, `/plans/${p.id}`, { revision: 4, name: ' الاسم الظاهر ', content: { ...edited, name: 'اسم داخل المحتوى', target: { amount: 6000000 }, allocations: [{ entityKey: RIY, amount: 6000000, origin: 'manual' }] } }); assert.equal(q2.code, 200); assert.equal(q2.body.plan.name, 'الاسم الظاهر'); assert.equal(q2.body.plan.content.name, 'الاسم الظاهر');
});
ok('SAVE AS NEW creates a SEPARATE plan owned by the creator (copyOf = provenance); the source is untouched; with no content the copy is taken from the source', async () => {
  const src = await created(DEMO, entityContent(nm('أصل'), [RIY], 3000000));
  const content = { ...J(src.content), name: nm('نسخة') };
  const c = await post(WRITER, '/plans', { name: content.name, content, copyOf: src.id, setDefault: true }); assert.equal(c.code, 201, c.text); const p = c.body.plan;
  assert.notEqual(p.id, src.id); assert.equal(p.createdBy.userId, WRITER.user.id, 'owned by the creator of the copy, not the source\'s owner'); assert.equal(p.revision, 1);
  assert.equal((await get(DEMO, `/plans/${src.id}`)).body.plan.revision, 1, 'the source is untouched'); assert.equal((await get(DEMO, `/plans/${src.id}`)).body.plan.createdBy.userId, DEMO.user.id);
  assert.deepEqual((await get(WRITER, `/plans/${p.id}/audit`)).body.entries.map((e) => [e.action, e.details && e.details.copyOf]), [['copy', src.id]]);
  assert.equal(c.body.defaults.userDefaultPlanId, p.id, 'setDefault made the copy the caller\'s personal default');
  const noContent = await post(WRITER, '/plans', { name: nm('نسخة بلا محتوى'), copyOf: SEED_PLAN_ID }); assert.equal(noContent.code, 201, noContent.text); assert.equal(noContent.body.plan.content.target.amount, (await seedPlan()).content.target.amount); assert.equal(noContent.body.plan.isSystem, false, 'a copy of the system plan is an ordinary plan');
  assert.equal((await post(WRITER, '/plans', { name: nm('x'), copyOf: 'plan-00000000' })).code, 404);
  assert.equal((await post(JED_USER, '/plans', { name: nm('x'), copyOf: SEED_PLAN_ID })).code, 403, 'a plan the actor sees only masked is not copyable without content');
});

/* ================================================================== 5. concurrency */
ok('optimistic concurrency: a stale revision → 409 revision_conflict naming the last editor and the current revision; nothing is overwritten; the revision must be an integer', async () => {
  const p0 = await created(DEMO, entityContent(nm('تعارض'), [RIY], 1000000)); const rev = p0.revision;
  const a = await put(DEMO, `/plans/${p0.id}`, { revision: rev, content: entityContent(`${p0.name} من أ`, [RIY], 2000000) }); assert.equal(a.code, 200);
  const b = await put(ADMIN, `/plans/${p0.id}`, { revision: rev, content: entityContent(`${p0.name} من ب`, [RIY], 3000000) });
  assert.equal(b.code, 409); assert.equal(b.body.error, 'revision_conflict'); assert.equal(b.body.lastEditedBy.userId, DEMO.user.id); assert.equal(b.body.currentRevision, rev + 1);
  assert.equal((await get(ADMIN, `/plans/${p0.id}`)).body.plan.content.target.amount, 2000000, 'nothing overwritten');
  assert.equal((await put(ADMIN, `/plans/${p0.id}`, { content: entityContent('x', [RIY], 1) })).body.errors[0].code, 'revision_required');
  assert.equal((await put(ADMIN, `/plans/${p0.id}`, { revision: '2', content: entityContent('x', [RIY], 1) })).code, 400, 'a revision must be an integer');
});

/* ================================================================== 6. atomic save */
ok('a save is ONE atomic mutation: a failure injected at any step leaves the stored document byte-identical (revision, content, snapshots, audit) and the answer carries no exception message; the retry then succeeds', async () => {
  const p = await created(DEMO, entityContent(nm('ذرّية'), [RIY], 1000000)); const stored = J(planStore().db); const origErr = console.error; const logged = []; console.error = (...a) => logged.push(a.map(String).join(' '));
  const next = entityContent(`${p.name} — بعد`, [RIY], 2000000);
  try {
    for (const point of ['save.snapshot', 'save.content', 'save.state', 'commit']) {
      planStore().fault = (name) => { if (name === point) throw new Error('SECRET-BOOM-7731'); };
      const r = await put(DEMO, `/plans/${p.id}`, { revision: p.revision, content: next });
      assert.equal(r.code, 500, point); assert.deepEqual(r.body, { error: 'server_error' }); assert.ok(!r.text.includes('SECRET-BOOM'), 'no exception message in the answer');
      assert.deepEqual(planStore().db, stored, `${point}: the stored document is exactly as before`);
      const g = (await get(DEMO, `/plans/${p.id}`)).body.plan; assert.equal(g.revision, p.revision); assert.equal(g.content.target.amount, 1000000); assert.equal(g.versions.length, 1);
    }
    planStore().fault = (name) => { if (name === 'create.insert') throw new Error('SECRET-BOOM-7731'); };
    const c = await post(DEMO, '/plans', { name: nm('لن تُحفظ'), content: entityContent('x', [RIY], 1000), setDefault: true }); assert.equal(c.code, 500); assert.deepEqual(planStore().db, stored, 'a failed create stores nothing (no plan, no default, no audit)');
  } finally { planStore().fault = null; console.error = origErr; }
  assert.ok(logged.length >= 1 && logged.every((l) => !l.includes('SECRET-BOOM')), 'the log line carries the path, never the message');
  const ok2 = await put(DEMO, `/plans/${p.id}`, { revision: p.revision, content: next }); assert.equal(ok2.code, 200, ok2.text);
  assert.deepEqual([ok2.body.plan.revision, ok2.body.plan.versions.length, ok2.body.plan.content.target.amount], [p.revision + 1, 2, 2000000]);
  assert.equal((await get(DEMO, `/plans/${p.id}/audit`)).body.entries[0].action, 'update');
});

/* ================================================================== 7. the system plan is immutable */
ok('the system plan is never overwritten: PUT → 403 system_plan_readonly for everyone (admin included), nothing changes; an ordinary plan saved with isSystem:true in the body stays ordinary', async () => {
  const before = J(planStore().db.plans.find((x) => x.id === SEED_PLAN_ID)); const rev = before.revision;
  for (const u of [ADMIN, DEMO, WRITER]) { const r = await put(u, `/plans/${SEED_PLAN_ID}`, { revision: rev, content: before.content }); assert.equal(r.code, 403, 'system'); assert.deepEqual(r.body, { error: 'system_plan_readonly' }); }
  const r2 = await put(ADMIN, `/plans/${SEED_PLAN_ID}`, { revision: rev, name: 'اسم آخر' }); assert.equal(r2.code, 403); assert.deepEqual(planStore().db.plans.find((x) => x.id === SEED_PLAN_ID), before, 'byte-identical');
  assert.equal((await seedPlan()).viewer.canEdit, false); assert.equal((await seedPlan()).isSystem, true);
  const b27 = J(planStore().db.plans.find((x) => x.id === PLAN_2027_ID)); for (const u of [ADMIN, DEMO]) { const r = await put(u, `/plans/${PLAN_2027_ID}`, { revision: b27.revision, content: b27.content }); assert.equal(r.code, 403); assert.deepEqual(r.body, { error: 'system_plan_readonly' }); } assert.deepEqual(planStore().db.plans.find((x) => x.id === PLAN_2027_ID), b27, 'the 2027 system plan is never overwritten either');
  const actor = { userId: 'usr-x', name: 'x', geoScope: ALL_SCOPE, readOnly: false }; assert.throws(() => svc.updatePlan(actor, SEED_PLAN_ID, { revision: rev, content: before.content }), (e) => e.status === 403 && e.code === 'system_plan_readonly');
  const ord = await created(DEMO, entityContent(nm('عادية'), [RIY], 1000000)); const up = await put(DEMO, `/plans/${ord.id}`, { revision: 1, isSystem: true, origin: 'seed', content: entityContent(ord.name, [RIY], 2000000) }); assert.equal(up.body.plan.isSystem, false); assert.equal(up.body.plan.origin, 'user');
  assert.equal(planStore().db.plans.filter((x) => x.isSystem).length, 3, 'only the three seeded system plans');
});

/* ================================================================== 8. validation: hard errors, name rule, save checks */
ok('NAME rule: trimmed, 1–80 characters, unique case-insensitively among the plans the actor sees (400 name_required / name_too_long, 409 name_taken with errors[]); a plan keeps its own name; names hidden from the actor do not collide', async () => {
  const name = nm('Plan Alpha'); const a = await created(DEMO, entityContent(name, [RIY], 1000000));
  assert.equal(a.name, name);
  const dup = await post(ADMIN, '/plans', { name: `  ${name.toUpperCase()}  `, content: entityContent('x', [RIY], 1000000) }); assert.equal(dup.code, 409); assert.equal(dup.body.error, 'name_taken'); assert.equal(dup.body.errors[0].code, 'name_taken'); assert.ok(dup.body.errors[0].ar && dup.body.errors[0].en);
  const noName = await post(DEMO, '/plans', { content: { ...entityContent('', [RIY], 1000000), name: '' } }); assert.equal(noName.code, 400); assert.equal(noName.body.error, 'validation_error'); assert.ok(noName.body.errors.some((e) => e.code === 'name_required'));
  const blank = await post(DEMO, '/plans', { name: '   ', content: entityContent('x', [RIY], 1000000) }); assert.equal(blank.code, 400);
  const long = await post(DEMO, '/plans', { name: 'ا'.repeat(81), content: entityContent('x', [RIY], 1000000) }); assert.equal(long.code, 400); assert.ok(long.body.errors.some((e) => e.code === 'name_too_long' && e.params.max === 80));
  assert.equal((await post(DEMO, '/plans', { name: 'ا'.repeat(80), content: entityContent('x', [RIY], 1000000) })).code, 201, '80 characters are fine');
  const trimmed = await post(DEMO, '/plans', { name: `  ${nm('مقصوصة')}  `, content: entityContent('x', [RIY], 1000000) }); assert.equal(trimmed.code, 201); assert.equal(trimmed.body.plan.name, trimmed.body.plan.name.trim());
  // updating with its own name is fine (case change included); renaming onto another visible plan is not
  const other = await created(DEMO, entityContent(nm('Plan Beta'), [RIY], 1000000));
  assert.equal((await put(DEMO, `/plans/${a.id}`, { revision: 1, content: entityContent(name.toUpperCase(), [RIY], 1100000) })).code, 200, 'own name, different case');
  const clash = await put(DEMO, `/plans/${other.id}`, { revision: 1, name: name, content: entityContent(other.name, [RIY], 1000000) }); assert.equal(clash.code, 409); assert.equal(clash.body.error, 'name_taken'); assert.equal((await get(DEMO, `/plans/${other.id}`)).body.plan.revision, 1);
  // a restricted user does not see the Makkah plan, so the same name is free for them (and does not leak that it exists)
  const hidden = nm('خطة مكة المخفية'); await created(ADMIN, entityContent(hidden, [MAK], 800000)); const mine = await post(JED_USER, '/plans', { name: hidden, content: entityContent(hidden, [JED], 900000) }); assert.equal(mine.code, 201, 'no collision with a plan the actor cannot see'); assert.equal((await post(ADMIN, '/plans', { name: hidden, content: entityContent(hidden, [RIY], 1) })).code, 409);
});
ok('hard errors → 400 validation_error{errors[]} with AR/EN; SAVE CHECKS → 422 save_checks_failed{checks} (6 entries, the failed ones named); NOTHING is stored on any failure; several plans may share scope + period', async () => {
  const before = (await get(ADMIN, '/plans')).body.plans.length; const auditLen = planStore().db.audit.length;
  const bad = await post(DEMO, '/plans', { name: nm('تحقق'), content: { ...entityContent('x', [RIY], 100), period: { start: '2026-05-01', end: '2026-04-01' }, allocations: [{ entityKey: 'Nowhere', amount: -5 }] } });
  assert.equal(bad.code, 400); assert.equal(bad.body.error, 'validation_error'); const codes = bad.body.errors.map((e) => e.code); assert.ok(codes.includes('period_end_before_start') && codes.includes('unknown_entity') && codes.includes('invalid_amount')); assert.ok(bad.body.errors.every((e) => e.ar && e.en && e.path));
  assert.equal((await post(DEMO, '/plans', { name: nm('ب'), content: { ...entityContent('x', ['Nowhere'], 100) } })).code, 400);
  const empty = await post(DEMO, '/plans', { name: nm('ناقصة'), content: { name: 'x', scope: { kind: 'ministry' }, period: { start: '2028-01-01', end: '2028-12-31' }, target: { amount: null }, allocations: [], distribution: { profile: null }, advanced: {} } });
  assert.equal(empty.code, 422); assert.equal(empty.body.error, 'save_checks_failed'); assert.equal(empty.body.checks.length, 6); assert.deepEqual(empty.body.checks.filter((x) => !x.ok).map((x) => x.id).sort(), ['allocation_complete', 'profile_explicit', 'target_positive']); assert.ok(empty.body.checks.every((c) => c.label.ar && c.label.en && 'params' in c));
  const half = await post(DEMO, '/plans', { name: nm('ناقصة التخصيص'), content: { ...entityContent('x', [RIY, JED], 1000), allocations: [{ entityKey: RIY, amount: 400 }] } }); assert.equal(half.code, 422); assert.deepEqual(half.body.checks.filter((x) => !x.ok).map((x) => x.id), ['allocation_complete']); assert.equal(half.body.checks.find((x) => x.id === 'allocation_complete').params.unallocated, 600);
  assert.equal((await get(ADMIN, '/plans')).body.plans.length, before); assert.equal(planStore().db.audit.length, auditLen, 'no plan and no audit entry from any failed save');
  // an UPDATE that fails the checks leaves the stored plan unchanged
  const p = await created(DEMO, entityContent(nm('تحديث فاشل'), [RIY], 1000000)); const stored = J(planStore().db.plans.find((x) => x.id === p.id));
  const u = await put(DEMO, `/plans/${p.id}`, { revision: 1, content: { ...entityContent(p.name, [RIY], 1000000), distribution: { profile: null } } }); assert.equal(u.code, 422); assert.deepEqual(u.body.checks.filter((x) => !x.ok).map((x) => x.id), ['profile_explicit']);
  assert.deepEqual(planStore().db.plans.find((x) => x.id === p.id), stored);
  assert.equal((await put(DEMO, `/plans/${p.id}`, { revision: 1 })).body.errors[0].code, 'content_required');
  // personal variations: the SAME scope + period as another plan is fine (no duplicate-baseline rule)
  const same = await post(ADMIN, '/plans', { name: nm('نفس النطاق والفترة'), content: entityContent('x', [RIY], 1000000) }); assert.equal(same.code, 201);
});

/* ================================================================== 9. personal default */
ok('PERSONAL DEFAULT: only the caller\'s, only for a plan they can see; independent of other users and of the organisation reference; falls back (reported in defaults.effectiveDefaultPlanId) when it becomes inaccessible; null clears', async () => {
  const mineP = await created(JED_USER, entityContent(nm('خطة جدة الافتراضية'), [JED], 700000)); const ministry = await created(ADMIN, entityContent(nm('خطة وزارية'), [RIY, JED], 4000000));
  const refsBefore = J((await get(ADMIN, '/plans/references')).body.references);
  const set = await put(JED_USER, '/plans/default', { planId: mineP.id }); assert.equal(set.code, 200, set.text); assert.deepEqual(set.body.defaults, { userDefaultPlanId: mineP.id, globalDefaultPlanId: SEED_PLAN_ID, systemDefaultPlanId: SEED_PLAN_ID, effectiveDefaultPlanId: mineP.id, source: 'personal' });
  assert.deepEqual((await get(JED_USER, '/plans')).body.defaults.effectiveDefaultPlanId, mineP.id);
  assert.deepEqual((await get(ADMIN, '/plans')).body.defaults, { userDefaultPlanId: null, globalDefaultPlanId: SEED_PLAN_ID, systemDefaultPlanId: SEED_PLAN_ID, effectiveDefaultPlanId: SEED_PLAN_ID, source: 'global' }, 'another user is unaffected');
  assert.deepEqual((await get(ADMIN, '/plans/references')).body.references, refsBefore, 'the organisation reference is unaffected');
  assert.equal(planStore().db.userDefaults[JED_USER.user.id], mineP.id);
  // each user has their own
  assert.equal((await put(ADMIN, '/plans/default', { planId: ministry.id })).body.defaults.effectiveDefaultPlanId, ministry.id); assert.equal((await get(JED_USER, '/plans')).body.defaults.userDefaultPlanId, mineP.id);
  // a plan the caller cannot see cannot become their default (404, like a missing plan); an unknown id; a malformed body
  const makkah = await created(ADMIN, entityContent(nm('خطة مكة'), [MAK], 600000)); assert.equal((await put(JED_USER, '/plans/default', { planId: makkah.id })).code, 404); assert.equal((await put(JED_USER, '/plans/default', { planId: 'plan-00000000' })).code, 404);
  assert.equal((await put(JED_USER, '/plans/default', {})).body.errors[0].code, 'plan_required'); assert.equal((await put(JED_USER, '/plans/default', { planId: 7 })).code, 400);
  assert.equal(planStore().db.userDefaults[JED_USER.user.id], mineP.id, 'a refused request changes nothing');
  // the plan the person can see only masked can be their default (viewing is enough); the effective default is it
  assert.equal((await put(JED_USER, '/plans/default', { planId: ministry.id })).body.defaults.effectiveDefaultPlanId, ministry.id);
  // the default becomes inaccessible when the person's scope changes: server-side fallback to the system plan (the stored choice is kept, not shown)
  const dbUser = getDb().users.find((u) => u.id === JED_USER.user.id); const prev = dbUser.scope;
  assert.equal((await put(JED_USER, '/plans/default', { planId: mineP.id })).code, 200);
  dbUser.scope = normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(MAK)] }); commit();
  const fb = await get(JED_USER, '/plans'); assert.equal(fb.code, 200); assert.deepEqual(fb.body.defaults, { userDefaultPlanId: null, globalDefaultPlanId: SEED_PLAN_ID, systemDefaultPlanId: SEED_PLAN_ID, effectiveDefaultPlanId: SEED_PLAN_ID, source: 'global' }, 'inaccessible personal default → the GLOBAL default'); assert.ok(!fb.body.plans.some((p) => p.id === mineP.id));
  dbUser.scope = prev; commit(); assert.equal((await get(JED_USER, '/plans')).body.defaults.userDefaultPlanId, mineP.id, 'access restored → the choice applies again');
  // clearing
  const clr = await put(JED_USER, '/plans/default', { planId: null }); assert.equal(clr.code, 200); assert.equal(clr.body.defaults.userDefaultPlanId, null); assert.equal(planStore().db.userDefaults[JED_USER.user.id], undefined);
  // a read-only role may keep a personal preference (it changes no plan)
  const ro = await put(AUDITOR, '/plans/default', { planId: ministry.id }); assert.equal(ro.code, 200); assert.equal(ro.body.defaults.effectiveDefaultPlanId, ministry.id); await put(AUDITOR, '/plans/default', { planId: null });
  // with the system plan out of sight the first visible plan by name opens
  const only = svc.listPlans({ userId: 'usr-z', name: 'z', geoScope: ALL_SCOPE, readOnly: false }, {}, { db: { ...planStore().db, plans: planStore().db.plans.filter((p) => !p.isSystem), userDefaults: {} }, info: () => ({}) });
  assert.equal(only.defaults.systemDefaultPlanId, null); assert.ok(only.plans.some((p) => p.id === only.defaults.effectiveDefaultPlanId)); assert.equal(only.defaults.effectiveDefaultPlanId, [...only.plans].sort((a, b) => (a.name < b.name ? -1 : 1))[0].id);
});

/* ================================================================== 10. read-only roles and restricted scope */
ok('a READ-ONLY role is refused create / update / import / set-reference with 403 read_only_role (API machinery AND the service); it browses freely', async () => {
  const pid = (await created(DEMO, entityContent(nm('للقراءة فقط'), [RIY], 1000000))).id;
  for (const [m, p, b] of [['POST', '/plans', { name: 'x', content: entityContent('x', [RIY], 1) }], ['PUT', `/plans/${pid}`, { revision: 1, content: {} }], ['PUT', `/plans/${SEED_PLAN_ID}`, { revision: 1, content: {} }], ['POST', '/plans/references', { year: 2026, planId: null }], ['POST', '/plans/import-legacy', { year: 2026, store: {} }]]) {
    const r = await call(AUDITOR, m, p, b); assert.equal(r.code, 403, `${m} ${p}`); assert.deepEqual(r.body, { error: 'read_only_role' });
  }
  assert.equal((await get(AUDITOR, '/plans')).code, 200); assert.equal((await get(AUDITOR, `/plans/${SEED_PLAN_ID}/audit`)).code, 200);
  const seen = await get(AUDITOR, `/plans/${pid}`); assert.equal(seen.code, 200, 'a saved plan is browsable (no private drafts)'); assert.deepEqual(seen.body.plan.viewer, { canEdit: false, reason: 'read_only_role' }); assert.equal(seen.body.plan.content.target.amount, 1000000);
  assert.ok((await get(AUDITOR, '/plans')).body.plans.some((p) => p.id === pid)); assert.equal((await get(AUDITOR, '/plans')).body.capabilities.canCreate, false); assert.equal((await get(AUDITOR, '/plans')).body.capabilities.readOnly, true);
  const actor = { userId: 'usr-ro', name: 'ro', geoScope: ALL_SCOPE, readOnly: true };
  for (const f of [() => svc.createPlan(actor, { name: 'x', content: entityContent('x', [RIY], 1) }), () => svc.updatePlan(actor, pid, { revision: 1, content: {} }), () => svc.setReference(actor, { year: 2026, planId: null }), () => svc.importLegacy(actor, { year: 2026, store: {} })]) {
    assert.throws(f, (e) => e.status === 403 && e.code === 'forbidden' && e.extra.reason === 'read_only_role');
  }
  assert.equal((await get(AUDITOR, `/plans/${pid}`)).body.plan.revision, 1, 'nothing changed');
});
ok('RESTRICTED users: masked reads (only their entities, target = visible Σ, no advanced/basis/legacy, other entities absent); 403 `forbidden` + reason for a Ministry plan and any entity outside their coverage; viewing never grants editing; a municipal grant is not enough; cannot set the reference', async () => {
  const full = await seedPlan(ADMIN); const fullC = full.content; const jedRow = fullC.allocations.find((a) => a.entityKey === JED);
  const m = await get(JED_USER, `/plans/${SEED_PLAN_ID}`); assert.equal(m.code, 200); const mp = m.body.plan;
  assert.equal(mp.masked, true); assert.deepEqual(mp.content.allocations.map((a) => a.entityKey), [JED]); assert.equal(mp.content.target.amount, jedRow.amount); assert.equal(mp.content.target.masked, true); assert.equal(mp.content.target.label.ar, 'إجمالي الجهات المتاحة لك');
  assert.equal(mp.content.target.basis, undefined); assert.deepEqual(mp.content.advanced, {}); assert.equal(mp.legacy, null); assert.equal(mp.viewer.canEdit, false);
  const txt = JSON.stringify(m.body); assert.ok(!txt.includes(RIY) && !txt.includes(String(fullC.target.amount)), 'no other entity and no Ministry total reaches a restricted viewer');
  const list = await get(JED_USER, '/plans'); assert.ok(list.body.plans.every((p) => p.masked || p.content.scope.entityKeys?.every((k) => k === JED))); assert.ok(!JSON.stringify(list.body).includes(String(fullC.target.amount)));
  const v = await get(JED_USER, `/plans/${SEED_PLAN_ID}/versions/1`); assert.equal(v.code, 200); assert.ok(!v.text.includes(String(fullC.target.amount)), 'old snapshots are masked identically'); assert.deepEqual(v.body.version.content.allocations.map((a) => a.entityKey), [JED]);
  const muni = await get(JED_MUNI, `/plans/${SEED_PLAN_ID}`); assert.equal(muni.code, 200); assert.deepEqual(muni.body.plan.content.allocations.map((a) => a.entityKey), [], 'spec §9: a municipal-only grant does NOT reveal the Amanah allocation (the municipality dimension is covered by plans-server-muni.test.mjs)'); assert.equal(muni.body.plan.content.target.amount, null);
  // mutations: a Ministry plan owned by anyone → 403 scope for the Jeddah user (viewing is not editing)
  const ministry = await created(ADMIN, { ...J(fullC), name: nm('وزارية للاختبار') }); const g = await get(JED_USER, `/plans/${ministry.id}`); assert.equal(g.code, 200); assert.deepEqual(g.body.plan.viewer, { canEdit: false, reason: 'scope' });
  const up = await put(JED_USER, `/plans/${ministry.id}`, { revision: ministry.revision, content: J(fullC) }); assert.equal(up.code, 403); assert.equal(up.body.error, 'forbidden'); assert.equal(up.body.reason, 'scope');
  assert.equal((await get(ADMIN, `/plans/${ministry.id}`)).body.plan.revision, 1);
  const mk = (u, scope) => post(u, '/plans', { name: nm('قيد'), content: { ...entityContent('x', [JED], 100), scope } });
  assert.equal((await mk(JED_USER, { kind: 'ministry' })).code, 403); assert.equal((await mk(JED_USER, { kind: 'ministry' })).body.reason, 'scope');
  assert.equal((await post(JED_USER, '/plans', { name: nm('قيد'), content: entityContent('x', [RIY], 100) })).body.reason, 'scope', 'an entity outside the coverage');
  assert.equal((await post(JED_USER, '/plans', { name: nm('قيد'), content: entityContent('x', [JED, RIY], 100) })).code, 403, 'one entity outside the coverage is enough');
  assert.equal((await post(JED_MUNI, '/plans', { name: nm('قيد'), content: entityContent('x', [JED], 100) })).code, 403, 'a municipal grant is not enough to change an Amanah plan');
  const own = await created(JED_USER, entityContent(nm('خطة جدة'), [JED], 900000)); assert.equal(own.createdBy.userId, JED_USER.user.id);
  // the NEW scope is checked as well as the old one
  const widen = await put(JED_USER, `/plans/${own.id}`, { revision: own.revision, content: entityContent(own.name, [JED, RIY], 100) }); assert.equal(widen.code, 403); assert.equal(widen.body.reason, 'scope');
  const okSave = await put(JED_USER, `/plans/${own.id}`, { revision: own.revision, content: entityContent(own.name, [JED], 950000) }); assert.equal(okSave.code, 200);
  // a plan of another entity is invisible (404, exactly like missing); a Jeddah+Riyadh plan is visible (masked) but not editable
  const makkahPlan = await created(ADMIN, entityContent(nm('خطة مكة الخاصة'), [MAK], 800000)); assert.equal((await get(JED_USER, `/plans/${makkahPlan.id}`)).code, 404); assert.ok(!(await get(JED_USER, '/plans')).body.plans.some((p) => p.id === makkahPlan.id));
  assert.equal((await put(JED_USER, `/plans/${makkahPlan.id}`, { revision: 1, content: entityContent(makkahPlan.name, [MAK], 1) })).code, 404);
  const two = await created(ADMIN, entityContent(nm('جدة والرياض'), [JED, RIY], 2000000)); const tg = await get(JED_USER, `/plans/${two.id}`); assert.equal(tg.code, 200); assert.equal(tg.body.plan.masked, true); assert.equal(tg.body.plan.viewer.canEdit, false);
  assert.equal((await put(JED_USER, `/plans/${two.id}`, { revision: 1, content: entityContent(two.name, [JED], 1) })).code, 403, 'scope of the OLD content is not covered');
  // the reference: needs all-entities access
  const ref = await post(JED_USER, '/plans/references', { year: 2026, planId: SEED_PLAN_ID }); assert.equal(ref.code, 403); assert.equal(ref.body.reason, 'scope'); assert.equal((await get(JED_USER, '/plans/references')).body.capabilities.canSetReference, false);
  assert.equal((await post(JED_USER, '/plans/import-legacy', { year: 2026, store: { v: 2, years: {}, meta: {} } })).code, 403);
  // the audit of a visible plan is readable by the restricted viewer and carries no amounts
  const jau = await get(JED_USER, `/plans/${SEED_PLAN_ID}/audit`); assert.equal(jau.code, 200); assert.ok(!jau.text.includes(String(fullC.target.amount)));
});

/* ================================================================== 11. references */
ok('references (the ORGANISATION level): set (needs all-entities access) → audited; clear; a plan not overlapping the year → 400 reference_not_eligible; unknown plan 404; independent of anyone\'s default', async () => {
  const defaultsBefore = J((await get(ADMIN, '/plans')).body.defaults); const p27 = await created(ADMIN, entityContent(nm('مرجع 2027'), [RIY], 1000000, FY27)); const e26 = await created(ADMIN, entityContent(nm('مرجع 2026 جدة'), [JED], 1200000));
  const set = await post(ADMIN, '/plans/references', { year: 2027, planId: p27.id }); assert.equal(set.code, 200, set.text); assert.equal(set.body.references['2027'].planId, p27.id); assert.equal(set.body.references['2027'].setBy.userId, ADMIN.user.id);
  const au = (await get(ADMIN, `/plans/${p27.id}/audit`)).body.entries[0]; assert.equal(au.action, 'reference_set'); assert.equal(au.actor.userId, ADMIN.user.id); assert.equal(au.details.year, 2027);
  assert.equal((await get(AUDITOR, '/plans/references')).body.references['2027'].planId, p27.id, 'every planning user reads the references');
  const changed = await post(ADMIN, '/plans/references', { year: 2026, planId: e26.id }); assert.equal(changed.body.references['2026'].planId, e26.id, 'the 2026 seed reference is replaced explicitly');
  assert.deepEqual((await get(ADMIN, '/plans')).body.defaults, defaultsBefore, 'the reference never changes anyone\'s default');
  const bad = await post(ADMIN, '/plans/references', { year: 2026, planId: p27.id }); assert.equal(bad.code, 400); assert.equal(bad.body.errors[0].code, 'reference_not_eligible'); assert.equal(bad.body.errors[0].params.reason, 'period_mismatch');
  assert.equal((await post(ADMIN, '/plans/references', { year: 2026, planId: 'plan-ffffffff' })).code, 404);
  assert.equal((await post(ADMIN, '/plans/references', { year: 'x', planId: null })).code, 400); assert.equal((await post(ADMIN, '/plans/references', { year: 2026 })).code, 400);
  const list = (await get(ADMIN, '/plans')).body; S.setPlansForTest({ plans: list.plans, references: list.references, defaults: list.defaults });
  const okv = S.referenceViewFor(2026); assert.equal(okv.referenceState, 'ok'); assert.equal(okv.planId, e26.id); assert.equal(okv.source, 'configured'); assert.equal(okv.versionId, `${e26.id}@r1`);
  const clear = await post(ADMIN, '/plans/references', { year: 2026, planId: null }); assert.equal(clear.code, 200); assert.equal(clear.body.references['2026'], undefined); assert.equal(clear.body.cleared, true);
  const list2 = (await get(ADMIN, '/plans')).body; S.setPlansForTest({ plans: list2.plans, references: list2.references }); assert.equal(S.referenceViewFor(2026).referenceState, 'ambiguous', 'several saved plans overlap 2026 and none is configured: surfaced, not chosen');
  assert.equal((await post(ADMIN, '/plans/references', { year: 2026, planId: SEED_PLAN_ID })).code, 200, 'the system plan is the 2026 reference again for the rest of the suite');
});

/* ================================================================== 12. legacy import */
ok('import-legacy: a NORMAL saved plan, OWNERLESS, original metadata verbatim; the audit names the importer; a second import of the same legacy version is refused; a name clash gets a numbered suffix', async () => {
  const legacy = { v: 2, years: {}, meta: { 2026: { version: 3, versionId: '2026-v3', status: 'approved', owner: 'إدارة التخطيط', savedAt: '2026-03-04T10:00:00Z', savedBy: 'علي' } } };
  const r = await post(DEMO, '/plans/import-legacy', { year: 2026, store: legacy }); assert.equal(r.code, 201, r.text); const p = r.body.plan; noOldSurface(p);
  assert.deepEqual([p.origin, p.createdBy, p.isSystem, p.revision], ['imported', null, false, 1]); assert.equal(p.lastEditedBy.userId, DEMO.user.id);
  assert.deepEqual([p.legacy.versionId, p.legacy.status, p.legacy.owner, p.legacy.savedBy, p.legacy.savedAt, p.legacy.source, p.legacy.year], ['2026-v3', 'approved', 'إدارة التخطيط', 'علي', '2026-03-04T10:00:00Z', 'device-localStorage', 2026]);
  assert.ok(p.content.allocations.every((a) => a.origin === 'migrated')); assert.equal(sum(p.content.allocations.map((a) => a.amount)), p.content.target.amount); assert.equal(p.name, p.content.name);
  const au = (await get(DEMO, `/plans/${p.id}/audit`)).body.entries; assert.equal(au[0].action, 'import'); assert.equal(au[0].actor.userId, DEMO.user.id); assert.equal(au[0].details.legacyVersionId, '2026-v3');
  const again = await post(ADMIN, '/plans/import-legacy', { year: 2026, store: legacy }); assert.equal(again.code, 409); assert.equal(again.body.error, 'legacy_already_imported'); assert.equal(again.body.plan.planId, p.id);
  assert.equal((await post(DEMO, '/plans/import-legacy', { year: 2026 })).body.errors[0].code, 'store_required');
  assert.equal((await post(DEMO, '/plans/import-legacy', { year: 2026, store: { big: 'x'.repeat(700000) } })).body.errors[0].code, 'store_too_large');
  const v4 = J(legacy); v4.meta[2026] = { ...v4.meta[2026], version: 4, versionId: '2026-v4', savedAt: '2026-04-01T10:00:00Z' }; assert.equal((await post(DEMO, '/plans/import-legacy', { year: 2026, store: v4 })).code, 201, 'a different legacy version of the same year IS another record');
  const f = await get(DEMO, '/plans?owner=none'); assert.ok(f.body.plans.length >= 3 && f.body.plans.every((x) => x.createdBy === null), 'owner=none lists the ownerless plans (system + imported)');
});

/* ================================================================== 13. listing filters */
ok('list filters: year, owner, entity; there is no state filter any more', async () => {
  const all = (await get(ADMIN, '/plans')).body.plans; assert.ok(all.length > 8);
  const y27 = (await get(ADMIN, '/plans?year=2027')).body.plans; assert.ok(y27.length >= 1 && y27.every((p) => p.content.period.start.startsWith('2027') || p.content.period.end.startsWith('2027')));
  assert.ok((await get(ADMIN, `/plans?owner=${DEMO.user.id}`)).body.plans.every((p) => p.createdBy?.userId === DEMO.user.id));
  const ent = (await get(ADMIN, `/plans?entity=${encodeURIComponent(HOUSING)}`)).body.plans; assert.ok(ent.some((p) => p.id === SEED_PLAN_ID));
  assert.equal((await get(ADMIN, '/plans?state=archived')).body.plans.length, all.length, 'the removed state filter is ignored');
  assert.deepEqual((await get(ADMIN, '/plans?year=2027')).body.defaults, (await get(ADMIN, '/plans')).body.defaults, 'filters never change the defaults');
});

/* ================================================================== 14. persistence across a restart */
ok('RESTART persistence: a file store written through the API is read back by a FRESH instance — plans, snapshots, audit, references, owner AND the personal defaults; edits continue; the seed does not re-run; an unreadable file is set aside, never trusted', async () => {
  const file = path.join(TMP, 'plans.json'); const live = resetPlanStore(file); assert.equal(live.mode, 'file'); assert.equal(planStore().info().durable, true);
  const a = await created(DEMO, entityContent(nm('بعد إعادة التشغيل'), [MAK, HOUSING], 2500000), { setDefault: true }); assert.equal(a.createdBy.userId, DEMO.user.id);
  const e = await put(ADMIN, `/plans/${a.id}`, { revision: a.revision, content: entityContent(`${a.name} — تعديل`, [MAK, HOUSING], 2600000) }); assert.equal(e.code, 200);
  assert.equal((await post(ADMIN, '/plans/references', { year: 2026, planId: a.id })).code, 200); assert.equal((await put(ADMIN, '/plans/default', { planId: a.id })).code, 200);
  const snap = J(planStore().db); assert.ok(fs.existsSync(file)); assert.deepEqual(J(JSON.parse(fs.readFileSync(file, 'utf8'))), snap, 'the file IS the document'); assert.equal(snap.schemaVersion, 3); assert.deepEqual(Object.keys(snap.userDefaults).sort(), [ADMIN.user.id, DEMO.user.id].sort());
  // "restart": a brand-new instance on the same file
  const fresh = openPlanStore(file); assert.notEqual(fresh, live); useStore(fresh);
  assert.deepEqual(J(fresh.db), snap, 'plans, snapshots, audit, references and defaults identical after the restart'); assert.equal(fresh.db.plans.filter((p) => p.isSystem).length, 3, 'the three system plans were seeded once');
  const after = await get(ADMIN, `/plans/${a.id}`).then((r) => r.body.plan); assert.equal(after.createdBy.userId, DEMO.user.id); assert.equal(after.versions.length, 2); assert.equal(after.content.target.amount, 2600000); assert.equal(after.revision, a.revision + 1);
  assert.equal((await get(DEMO, '/plans')).body.defaults.userDefaultPlanId, a.id, 'DEMO\'s personal default survived'); assert.equal((await get(ADMIN, '/plans')).body.defaults.userDefaultPlanId, a.id);
  assert.equal((await get(DEMO, `/plans/${a.id}/audit`)).body.total, 3); // create, update, reference_set
  // work continues on the reopened store, and a THIRD instance sees it
  const act = await put(ADMIN, `/plans/${a.id}`, { revision: after.revision, content: entityContent(after.name, [MAK, HOUSING], 2700000) }); assert.equal(act.code, 200); assert.equal(act.body.plan.versions.length, 3);
  const third = openPlanStore(file); assert.equal(third.db.plans.find((p) => p.id === a.id).versions.length, 3); assert.equal(third.db.references['2026'].planId, a.id); assert.equal(third.db.userDefaults[DEMO.user.id], a.id);
  assert.equal(third.db.audit.at(-1).action, 'update', 'audit is appended, never truncated');
  // an unreadable file starts fresh (seeded) and is set aside, never half-trusted
  fs.writeFileSync(file, '{"plans": [ this is not json'); const broken = openPlanStore(file); assert.equal(broken.db.plans.length, 2); assert.ok(broken.db.plans.every((q) => q.isSystem)); assert.ok(fs.readdirSync(TMP).some((f) => f.includes('.unreadable-')), 'the unreadable file is kept aside');
  fs.writeFileSync(file, JSON.stringify({ plans: 'nope' })); assert.equal(openPlanStore(file).db.plans.length, 2, 'a structurally wrong file is not trusted either');
  assert.ok(!/password|credential|scrypt|secret|hash/i.test(JSON.stringify(snap)), 'the document never contains secrets');
  useStore(resetPlanStore(':memory:'));
});
ok('the store falls back instead of failing: an unwritable path → temp dir / memory; ":memory:" is never durable', () => {
  const m = openPlanStore(':memory:'); assert.deepEqual(m.info(), { mode: 'memory', durable: false, localDemo: true });
  const f = openPlanStore('/proc/definitely/not/writable/plans.json'); assert.ok(['tmp', 'memory'].includes(f.mode)); assert.equal(f.info().durable, false); assert.equal(f.db.plans.length >= 1, true);
});

/* ================================================================== 15. migration of a store written in the OLD shape */
ok('MIGRATION in place (schema 1 → 3, via the simplified model): a store written in the OLD shape — seed, draft-only, active with versions, active WITH a pending working copy, archived, scenario, imported — keeps every value; nothing is invented; idempotent; audited; the old file is kept; the API serves the migrated plans', async () => {
  const at = '2026-02-01T00:00:00.000Z'; const A = (n2) => ({ userId: `usr-old${n2}`, name: `مستخدم قديم ${n2}`, nameEn: `Old user ${n2}` });
  const seedC = seedPlanContent(2026, { at }); const mk = (name, amount, keys = [RIY], period = FY) => normalizeContent(entityContent(name, keys, amount, period));
  const cDraft = mk('مسودة قديمة', 1100000); const cAct1 = mk('فعّالة قديمة — الإصدار 1', 2100000); const cAct2 = mk('فعّالة قديمة — الإصدار 2', 2200000); const cBoth1 = mk('فعّالة مع مراجعة — المعتمدة في التقارير', 3100000); const cBoth2 = mk('فعّالة مع مراجعة — المراجعة غير المحفوظة', 3300000);
  const cArch = mk('مؤرشفة قديمة', 4100000); const cScen = mk('سيناريو قديم', 5100000); const cImp = mk('مستوردة قديمة', 6100000, [JED]);
  const base = (id, over) => ({ id, type: 'baseline', state: 'active', createdBy: A(1), createdAt: at, updatedAt: '2026-02-02T00:00:00.000Z', lastEditedBy: A(2), origin: 'user', legacy: null, working: null, versions: [], inForce: null, revision: 7, ...over });
  const v = (nn, c, extra = {}) => ({ n: nn, content: c, activatedBy: A(2), activatedAt: '2026-02-03T00:00:00.000Z', supersededAt: null, ...extra });
  const oldPlans = [
    base('plan-5eed2026', { origin: 'seed', createdBy: null, lastEditedBy: null, revision: 1, versions: [v(1, seedC, { activatedBy: null })], inForce: 1 }),
    base('plan-0d0d0001', { state: 'draft', working: { content: cDraft, lastEditedBy: A(2), updatedAt: '2026-02-04T00:00:00.000Z' } }),
    base('plan-0a0a0002', { versions: [v(1, cAct1, { supersededAt: '2026-02-05T00:00:00.000Z' }), v(2, cAct2)], inForce: 2 }),
    base('plan-0b0b0003', { versions: [v(1, cBoth1)], inForce: 1, working: { content: cBoth2, lastEditedBy: A(3), updatedAt: '2026-02-06T00:00:00.000Z' } }),
    base('plan-0c0c0004', { state: 'archived', versions: [v(1, cArch)], inForce: null, archivedAt: '2026-02-07T00:00:00.000Z' }),
    base('plan-0e0e0005', { type: 'scenario', scenarioOf: 'plan-0a0a0002', state: 'draft', working: { content: cScen, lastEditedBy: A(1), updatedAt: '2026-02-08T00:00:00.000Z' } }),
    base('plan-0f0f0006', { origin: 'imported', createdBy: null, state: 'draft', legacy: { versionId: '2026-v3', status: 'approved', owner: 'إدارة التخطيط', savedBy: 'علي', savedAt: '2026-03-04T10:00:00Z', source: 'device-localStorage', year: 2026 }, working: { content: cImp, lastEditedBy: A(2), updatedAt: '2026-02-09T00:00:00.000Z' } })
  ];
  const oldDoc = { schemaVersion: 1, plans: oldPlans, references: { 2026: { planId: 'plan-5eed2026', setBy: { system: true }, at } }, audit: [{ id: 'aud-old000001', at, actor: { system: true }, action: 'seed', planId: 'plan-5eed2026', summary: { ar: 'قديم', en: 'old' } }] };
  const file = path.join(TMP, 'plans-old.json'); fs.writeFileSync(file, JSON.stringify(oldDoc)); const original = fs.readFileSync(file, 'utf8');
  const mig = openPlanStore(file); const db = mig.db; useStore(mig);
  assert.equal(db.schemaVersion, 3); assert.deepEqual(db.userDefaults, {}); assert.equal(db.plans.length, 8, 'no plan dropped (the 7 old ones + the seeded 2027 collection plan)'); assert.deepEqual(db.plans.map((p) => p.id).filter((id) => oldPlans.some((o) => o.id === id)).sort(), oldPlans.map((o) => o.id).sort()); assert.deepEqual(db.references['2026'], oldDoc.references['2026'], 'the old references are untouched'); assert.equal(db.references['2027'].planId, PLAN_2027_ID, 'plus the 2027 reference entry'); assert.deepEqual(db.settings, { systemDefaultPlanId: SEED_PLAN_ID, systemDefaultConfigured: true }, 'the migrated 2026 seed plan becomes the initial global default (no administrator chose one)');
  const by = (id) => db.plans.find((p) => p.id === id); const orig = (id) => oldPlans.find((p) => p.id === id);
  // content kept per the rule
  assert.deepEqual(by('plan-5eed2026').content, seedC); assert.equal(by('plan-5eed2026').isSystem, true); assert.equal(db.plans.filter((p) => p.isSystem).length, 2, 'the seed and the 2027 collection plan are the system plans');
  assert.deepEqual(by('plan-0d0d0001').content, cDraft, 'working-only → promoted to the content');
  assert.deepEqual(by('plan-0a0a0002').content, cAct2, 'active → the in-force version');
  assert.deepEqual(by('plan-0b0b0003').content, cBoth1, 'in-force + working → the IN-FORCE content stays');
  const keptDraft = by('plan-0b0b0003').versions.find((s) => s.label === 'migrated-draft'); assert.ok(keptDraft, 'the unsaved working content is kept as an internal snapshot'); assert.deepEqual(keptDraft.content, cBoth2); assert.equal(keptDraft.savedBy.userId, 'usr-old3'); assert.equal(keptDraft.savedAt, '2026-02-06T00:00:00.000Z');
  assert.deepEqual(by('plan-0c0c0004').content, cArch, 'archived plans stay as ordinary saved plans'); assert.deepEqual(by('plan-0e0e0005').content, cScen); assert.deepEqual(by('plan-0f0f0006').content, cImp);
  // every old content survives somewhere (content or a snapshot)
  for (const c of [seedC, cDraft, cAct1, cAct2, cBoth1, cBoth2, cArch, cScen, cImp]) assert.ok(db.plans.some((p) => JSON.stringify(p.content) === JSON.stringify(c) || p.versions.some((s) => JSON.stringify(s.content) === JSON.stringify(c))), `a content (${c.name}) was dropped`);
  assert.equal(by('plan-0a0a0002').versions.length, 2); assert.deepEqual(by('plan-0a0a0002').versions[0].migratedFrom, { versionNumber: 1, supersededAt: '2026-02-05T00:00:00.000Z' }); assert.equal(by('plan-0a0a0002').versions[0].savedBy.userId, 'usr-old2');
  // owners, legacy, timestamps, revision untouched — nothing invented
  for (const o of oldPlans) { const p = by(o.id); assert.deepEqual(p.createdBy, o.createdBy, o.id); assert.deepEqual(p.lastEditedBy, o.lastEditedBy, o.id); assert.deepEqual(p.legacy, o.legacy, o.id); assert.equal(p.origin, o.origin); assert.equal(p.createdAt, o.createdAt); assert.equal(p.updatedAt, o.updatedAt); assert.equal(p.revision, o.revision); assert.equal(p.name, p.content.name); assert.equal(p.state, 'active'); for (const k of OLD_KEYS) assert.equal(k in p, false, `${o.id}: ${k} removed from the record`); }
  assert.equal(by('plan-0f0f0006').createdBy, null, 'an ownerless plan is not given an owner'); assert.equal(by('plan-5eed2026').createdBy, null);
  assert.deepEqual([by('plan-0c0c0004').migrated.previousState, by('plan-0c0c0004').migrated.archivedAt, by('plan-0e0e0005').migrated.previousType, by('plan-0e0e0005').migrated.scenarioOf, by('plan-0a0a0002').migrated.inForce], ['archived', '2026-02-07T00:00:00.000Z', 'scenario', 'plan-0a0a0002', 2], 'what the model no longer shows is kept under `migrated`');
  // audit: the old entry stays + ONE migrate event with the counters
  assert.equal(db.audit[0].id, 'aud-old000001'); const ev = db.audit.filter((e) => e.action === 'migrate'); assert.equal(ev.length, 1); assert.deepEqual([ev[0].actor, ev[0].details.fromSchema, ev[0].details.toSchema, ev[0].details.plans, ev[0].details.promotedDrafts, ev[0].details.workingKeptAsSnapshot, ev[0].details.seedMarkedSystem], [{ system: true }, 1, 2, 7, 3, 1, 1]);
  // the file: migrated in place, the old bytes kept once beside it, idempotent
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).schemaVersion, 3); assert.equal(fs.readFileSync(`${file}.pre-v2.bak`, 'utf8'), original, 'the pre-migration file is kept');
  const again = openPlanStore(file); assert.deepEqual(J(again.db), J(mig.db), 'opening again changes nothing'); assert.equal(again.db.audit.filter((e) => e.action === 'migrate').length, 1); again.reload(); assert.deepEqual(J(again.db), J(mig.db));
  // the API serves the migrated store
  const list = await get(ADMIN, '/plans'); assert.equal(list.code, 200); assert.equal(list.body.plans.length, 9); for (const p of list.body.plans) { noOldSurface(p); assert.equal(p.migrated, undefined); assert.ok(p.content && p.versionCount >= 1); }
  assert.deepEqual(list.body.defaults, { userDefaultPlanId: null, globalDefaultPlanId: SEED_PLAN_ID, systemDefaultPlanId: SEED_PLAN_ID, effectiveDefaultPlanId: SEED_PLAN_ID, source: 'global' }); assert.deepEqual(list.body.references['2026'].planId, 'plan-5eed2026');
  const kv = await get(ADMIN, '/plans/plan-0b0b0003/versions/2'); assert.equal(kv.code, 200); assert.equal(kv.body.version.label, 'migrated-draft'); assert.equal(kv.body.version.content.target.amount, 3300000);
  const edit = await put(ADMIN, '/plans/plan-0a0a0002', { revision: 7, content: { ...cAct2, name: 'فعّالة قديمة — بعد الترحيل', target: { amount: 2200000 } } }); assert.equal(edit.code, 200, edit.text); assert.equal(edit.body.plan.revision, 8); assert.equal(edit.body.plan.createdBy.userId, 'usr-old1', 'the migrated owner stays the owner'); assert.equal(edit.body.plan.lastEditedBy.userId, ADMIN.user.id);
  assert.equal((await put(ADMIN, '/plans/plan-5eed2026', { revision: 1, content: seedC })).body.error, 'system_plan_readonly');
  // an empty / already-new store gets no migrate event
  const fresh = openPlanStore(path.join(TMP, 'plans-new.json')); assert.equal(fresh.db.audit.filter((e) => e.action === 'migrate').length, 0); assert.equal(fresh.db.schemaVersion, 3);
  const emptyOld = path.join(TMP, 'plans-empty-old.json'); fs.writeFileSync(emptyOld, JSON.stringify({ schemaVersion: 1, plans: [], references: {}, audit: [] })); const eo = openPlanStore(emptyOld); assert.equal(eo.db.schemaVersion, 3); assert.equal(eo.db.audit.filter((e) => e.action === 'migrate').length, 0); assert.equal(eo.db.plans.length, 2, 'then the system plans are seeded');
  useStore(resetPlanStore(':memory:'));
});

/* ================================================================== 16. hygiene: no secrets anywhere */
ok('no password / hash / secret / token string appears in ANY response, audit entry or error of the whole suite', async () => {
  const blob = ALL_TEXT.join('\n'); assert.ok(blob.length > 20000, 'responses were recorded');
  assert.ok(!/passw|credential|scrypt|secret|\bhash|\btoken|Test-pass/i.test(blob), 'no secret-like word');
  for (const u of [DEMO, ADMIN, AUDITOR, JED_USER, WRITER]) assert.ok(!blob.includes(u.token), 'no bearer token echoed');
  assert.ok(!blob.includes('SECRET-BOOM'), 'no exception message');
  const audit = JSON.stringify(planStore().db.audit); assert.ok(!/passw|credential|scrypt|hash/i.test(audit));
  const unknown = await get(DEMO, '/plans/plan-00000000'); assert.equal(unknown.code, 404); assert.deepEqual(unknown.body, { error: 'plan_not_found' });
  assert.equal((await call(DEMO, 'DELETE', '/plans/plan-00000000', {})).code, 404); assert.equal((await post(DEMO, '/plans/references/extra/more', {})).code, 404);
});

/* ================================================================== 17. the client cache and the typed client, end to end */
ok('planStore: hydrate through a client, defaults, stable snapshots, subscribe, upsertPlanLocally, resolve the reference, ambiguous / none / reference_invalid, 403 → forbidden, stale answers dropped, clearPlans', async () => {
  useStore(resetPlanStore(':memory:'));
  let seen = 0; const unsub = S.subscribe(() => { seen += 1; });
  S.clearPlans(); assert.equal(S.getSnapshot().status, 'idle'); assert.deepEqual(S.getPlans(), []); assert.deepEqual(S.getDefaults(), { userDefaultPlanId: null, globalDefaultPlanId: null, systemDefaultPlanId: null, effectiveDefaultPlanId: null, source: 'none' }); assert.equal(S.effectiveDefaultPlanId(), null); const s0 = S.getSnapshot(); assert.equal(S.getSnapshot(), s0, 'the snapshot is referentially stable between changes');
  const client = { list: async () => (await get(ADMIN, '/plans')).body };
  await S.hydratePlans(client, { key: 'k1' }); assert.equal(S.getSnapshot().status, 'ready'); assert.equal(S.getPlans().length, 3); assert.notEqual(S.getSnapshot(), s0); assert.ok(seen >= 2);
  assert.deepEqual(S.getDefaults(), { userDefaultPlanId: null, globalDefaultPlanId: SEED_PLAN_ID, systemDefaultPlanId: SEED_PLAN_ID, effectiveDefaultPlanId: SEED_PLAN_ID, source: 'global' }); assert.equal(S.effectiveDefaultPlanId(), SEED_PLAN_ID); assert.deepEqual(S.getSnapshot().defaults, S.getDefaults());
  const r = S.referenceFor(2026); assert.equal(r.state, 'ok'); assert.equal(r.source, 'configured'); assert.equal(r.plan.id, SEED_PLAN_ID);
  const v = S.referenceViewFor(2026); assert.equal(v.referenceState, 'ok'); assert.equal(v.planId, SEED_PLAN_ID); assert.equal(v.versionId, `${SEED_PLAN_ID}@r1`); assert.equal(v.state, 'active'); assert.equal(v.isSystem, true); assert.equal(v.sourceLabel.ar, 'الخطة المرجعية المحددة'); assert.ok(v.content.target.amount > 0);
  assert.equal(S.referenceViewFor(2030).referenceState, 'none'); assert.equal(S.referenceViewFor(2030).state, 'none');
  // same key is not fetched again; force / refresh is
  let calls = 0; const counting = { list: async () => { calls += 1; return client.list(); } };
  await S.hydratePlans(counting, { key: 'k1' }); assert.equal(calls, 0, 'same key → no refetch'); await S.hydratePlans(counting, { key: 'k2' }); assert.equal(calls, 1); await S.refreshPlans(); assert.equal(calls, 2);
  // a plan created by another session appears after a refresh; upsertPlanLocally applies a server answer without one
  const made = await created(DEMO, entityContent(nm('من جلسة أخرى'), [RIY], 1000000)); await S.refreshPlans(); assert.equal(S.getPlans().length, 4);
  const third = await created(DEMO, entityContent(nm('محلية'), [RIY], 1000000)); assert.equal(S.getPlans().length, 4); assert.equal(S.upsertPlanLocally(third), true); assert.equal(S.getPlans().length, 5); assert.equal(S.getPlanById(third.id).name, third.name);
  const upd = (await put(DEMO, `/plans/${third.id}`, { revision: 1, content: entityContent(third.name, [RIY], 1500000) })).body.plan; const seenN = seen; assert.equal(S.upsertPlanLocally(upd), true); assert.equal(S.getPlans().length, 5, 'replaced in place'); assert.equal(S.getPlanById(third.id).content.target.amount, 1500000); assert.ok(seen > seenN);
  assert.equal(S.upsertPlanLocally(third), false, 'an older revision never overwrites a newer one'); assert.equal(S.getPlanById(third.id).revision, 2); assert.equal(S.upsertPlanLocally(null), false);
  S.setDefaultsLocally({ userDefaultPlanId: made.id, globalDefaultPlanId: REM_ID, effectiveDefaultPlanId: made.id, source: 'personal' }); assert.equal(S.effectiveDefaultPlanId(), made.id); assert.equal(S.getDefaults().userDefaultPlanId, made.id);
  S.setDefaultsLocally({ userDefaultPlanId: 'plan-gone', effectiveDefaultPlanId: 'plan-gone' }); assert.equal(S.effectiveDefaultPlanId(), SEED_PLAN_ID, 'a default that is not in the cache falls back (personal → system → first)');
  // ambiguous (two eligible, nothing configured), only-eligible, setPlansForTest with defaults
  const base = J(S.getPlans().find((p) => p.id === SEED_PLAN_ID)); const second = J(base); second.id = 'plan-00000002'; second.isSystem = false; second.name = 'ثانية'; second.content.scope = { kind: 'entities', entityKeys: [RIY] };
  S.setPlansForTest({ plans: [base, second], references: {}, defaults: { userDefaultPlanId: 'plan-00000002' } }); const amb = S.referenceViewFor(2026); assert.equal(amb.referenceState, 'ambiguous'); assert.equal(amb.candidates.length, 2); assert.equal(amb.view, undefined); assert.equal(S.effectiveDefaultPlanId(), 'plan-00000002'); assert.equal(S.getDefaults().userDefaultPlanId, 'plan-00000002');
  S.setPlansForTest({ plans: [base, second], references: {} }); assert.equal(S.effectiveDefaultPlanId(), SEED_PLAN_ID, 'no defaults given: computed over the cache');
  S.setPlansForTest({ plans: [base], references: {} }); assert.equal(S.referenceViewFor(2026).source, 'only_eligible');
  S.setPlansForTest({ plans: [base], references: { 2026: { planId: 'plan-gone', setBy: { system: true }, at: 'x' } } }); assert.equal(S.referenceViewFor(2026).referenceState, 'reference_invalid');
  // forbidden: the cache is emptied
  await S.hydratePlans({ list: async () => { const e = new Error('x'); e.status = 403; throw e; } }, { key: 'k3', force: true }); assert.equal(S.getSnapshot().status, 'forbidden'); assert.deepEqual(S.getPlans(), []); assert.equal(S.effectiveDefaultPlanId(), null);
  // a transient error keeps the previous copy
  await S.hydratePlans(client, { key: 'k4', force: true }); const kept = S.getPlans().length; await S.hydratePlans({ list: async () => { throw new Error('net'); } }, { key: 'k5', force: true }); assert.equal(S.getSnapshot().status, 'error'); assert.equal(S.getPlans().length, kept);
  // a late answer after clearPlans is dropped
  let release; const slow = { list: () => new Promise((res) => { release = () => res({ plans: [base], references: {} }); }) };
  const pending1 = S.hydratePlans(slow, { key: 'k6', force: true }); await new Promise((r) => setTimeout(r, 5)); S.clearPlans(); release(); await pending1; assert.deepEqual(S.getPlans(), [], 'cleared on sign-out; a stale answer does not resurrect it'); assert.equal(S.getSnapshot().status, 'idle');
  unsub(); S.clearPlans();
});
ok('plansClient end to end (fetch → handleApi): every route has a function; errors carry status + code + errors/checks/lastEditedBy/currentRevision; the cache hydrates with the real client', async () => {
  const stored = { token: DEMO.token, me: { id: DEMO.user.id } }; const mem = new Map([['ib_auth', JSON.stringify(stored)]]);
  session.__configure({ storage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) } });
  assert.equal(session.getToken(), DEMO.token);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, init = {}) => new Promise((resolve) => {
    const res = { chunks: [], writeHead(c, h) { this.code = c; this.hdr = h || {}; }, write(c) { this.chunks.push(String(c)); return true; }, once() {}, end(b) { const t = b !== undefined ? b : this.chunks.join(''); resolve({ ok: this.code < 400, status: this.code, headers: { get: (k) => this.hdr[k] ?? this.hdr[String(k).toLowerCase()] ?? null }, json: async () => JSON.parse(t) }); } };
    handleApi({ method: init.method || 'GET', url, headers: Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), body: init.body ? JSON.parse(init.body) : undefined }, res);
  });
  try {
    assert.deepEqual(Object.keys(plansApi).sort(), ['audit', 'create', 'get', 'getSystemDefault', 'importLegacy', 'list', 'references', 'setDefault', 'setReference', 'setSystemDefault', 'update', 'version']);
    const list = await plansApi.list(); assert.ok(list.plans.length >= 1); assert.equal(list.storage.localDemo, true); assert.ok(list.defaults.effectiveDefaultPlanId);
    const content = entityContent(nm('عبر العميل'), [RIY], 700000);
    const created1 = await plansApi.create({ name: content.name, content, setDefault: true }); const id = created1.plan.id; assert.equal(created1.plan.createdBy.userId, DEMO.user.id); assert.equal(created1.defaults.userDefaultPlanId, id);
    assert.equal((await plansApi.get(id)).plan.id, id);
    const saved1 = await plansApi.update(id, created1.plan.revision, entityContent(content.name, [RIY], 800000)); assert.equal(saved1.plan.content.target.amount, 800000); assert.equal(saved1.plan.revision, 2);
    const renamed = await plansApi.update(id, 2, entityContent(content.name, [RIY], 800000), `${content.name} — جديد`); assert.equal(renamed.plan.name, `${content.name} — جديد`);
    await assert.rejects(() => plansApi.update(id, 1, entityContent('قديم', [RIY], 1)), (e) => e instanceof PlansApiError && e.status === 409 && e.code === 'revision_conflict' && e.lastEditedBy.userId === DEMO.user.id && e.currentRevision === 3);
    await assert.rejects(() => plansApi.update(id, 3, { period: { start: 'x', end: 'y' }, scope: { kind: 'ministry' } }), (e) => e.status === 400 && e.code === 'validation_error' && e.errors.length >= 2);
    await assert.rejects(() => plansApi.update(id, 3, { ...entityContent('x', [RIY], 1000), distribution: { profile: null } }), (e) => e.status === 422 && e.code === 'save_checks_failed' && e.checks.length === 6 && e.checks.some((c) => !c.ok));
    await assert.rejects(() => plansApi.create({ name: renamed.plan.name, content: entityContent('x', [RIY], 1) }), (e) => e.status === 409 && e.code === 'name_taken' && e.nameTaken === true && e.errors[0].code === 'name_taken');
    await assert.rejects(async () => plansApi.update(SEED_PLAN_ID, 1, (await seedPlan()).content), (e) => e.status === 403 && e.code === 'system_plan_readonly' && e.systemPlan === true && e.forbidden === true);
    const d = await plansApi.setDefault(SEED_PLAN_ID); assert.equal(d.defaults.userDefaultPlanId, SEED_PLAN_ID); assert.equal((await plansApi.setDefault(null)).defaults.userDefaultPlanId, null); await assert.rejects(() => plansApi.setDefault('plan-00000000'), (e) => e.status === 404);
    assert.equal((await plansApi.version(id, 1)).version.content.target.amount, 700000); assert.ok((await plansApi.audit(id)).entries.length >= 3);
    const refs = await plansApi.references(); assert.ok(refs.references['2026']); const setRef = await plansApi.setReference(2026, SEED_PLAN_ID); assert.equal(setRef.references['2026'].planId, SEED_PLAN_ID);
    await assert.rejects(() => plansApi.setReference(2026, 'plan-ffffffff'), (e) => e.status === 404);
    const imp = await plansApi.importLegacy(2026, { v: 2, years: {}, meta: {} }); assert.equal(imp.plan.origin, 'imported'); await assert.rejects(() => plansApi.importLegacy(2026, { v: 2, years: {}, meta: {} }), (e) => e.code === 'legacy_already_imported' && e.plan.planId === imp.plan.id);
    await assert.rejects(() => plansApi.get('plan-00000000'), (e) => e.status === 404 && e.code === 'plan_not_found');
    session.__configure({ storage: { getItem: () => JSON.stringify({ token: NO_MODULE.token, me: { id: NO_MODULE.user.id } }), setItem() {}, removeItem() {} } });
    await assert.rejects(() => plansApi.list(), (e) => e instanceof PlansApiError && e.status === 403 && e.forbidden === true);
    session.__configure({ storage: { getItem: () => JSON.stringify({ token: AUDITOR.token, me: { id: AUDITOR.user.id } }), setItem() {}, removeItem() {} } });
    await assert.rejects(() => plansApi.create({ name: nm('x'), content: entityContent('x', [RIY], 1) }), (e) => e.status === 403 && e.readOnly === true);
    session.__configure({ storage: { getItem: () => JSON.stringify({ token: DEMO.token, me: { id: DEMO.user.id } }), setItem() {}, removeItem() {} } });
    await S.hydratePlans(plansApi, { key: 'real', force: true }); assert.equal(S.getSnapshot().status, 'ready'); assert.ok(S.getPlans().some((p) => p.id === id)); assert.equal(S.referenceViewFor(2026).planId, SEED_PLAN_ID); assert.ok(S.effectiveDefaultPlanId());
    S.clearPlans();
  } finally { globalThis.fetch = realFetch; session.__configure({}); }
});

for (const run of pending) await run();
console.log(`plans-server: ${n} tests passed`);
