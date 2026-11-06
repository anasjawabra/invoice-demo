// Server-side authorization (docs/access-control.md §5 + SIMPLIFIED MODEL S4): authentication (401), the endpoint → MODULE map (403), the read-only role (403 read_only_role), the geographic scope applied at the COLUMN level to every data function,
// 404-exactly-like-missing for unauthorized invoices, client narrowing that can never widen, cache isolation between users, identity changes taking effect on the next request.
// Run: npm run test:authz — HTTP-level through handleApi with signed tokens of the real identity module in an IN-MEMORY identity store (the repository's identity file is never touched). Synthetic data only.
import assert from 'node:assert/strict';
import { ENTITIES, N_AMANAH } from '../src/data/catalog.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { geoScopeAllowsRecord, normalizeGeoScope, entireAmanahGrant, ALL_SCOPE } from '../src/data/geoScope.js';
import { DATA_VIEWS, DATA_MODULES, ENDPOINTS, requiredPermissionFor, listPermissions, exportPermissions } from '../server/endpointAccess.js';
import { resetForTests, getDb, issueToken } from '../server/identity/index.js';
import { commit } from '../server/identity/store.js';
import { hashPassword } from '../server/identity/crypto.js';
import { loadStore } from '../server/store.js';
import { list } from '../server/lists.js';
import { contractCards } from '../server/contracts.js';
import { sanadCases } from '../server/contracts.js';
import { iimFields } from '../server/iimRow.js';
import { accessTable, visibleMask, isVisible, accessKeyOf } from '../server/accessMask.js';
import { handleApi, setAuthenticator, narrowingOf } from '../server/api.js';

process.env.IIM_PLANS_FILE = ':memory:'; // the revenue-plans routes in the endpoint table are exercised here: never touch the repository's plans file
let n = 0; const pending = [];
const ok = (name, fn) => { const run = async () => { try { await fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } }; pending.push(run); };
const TODAY = '2026-11-06'; const FROM = '2000-01-01';
resetForTests(':memory:');
const st = loadStore(TODAY, { size: 'compact' });

/* ------------------------------------------------------------------ fixtures: users (isolated, in-memory identity store) */
let seq = 0; const stamp = new Date().toISOString();
function mkUser(modules, scope = ALL_SCOPE, { readOnly = false } = {}) {
  const db = getDb(); seq += 1;
  const role = { id: `role-t${seq}`, nameAr: `دور ${seq}`, nameEn: `Test role ${seq}`, descriptionAr: '', descriptionEn: '', modules: [...modules], readOnly, starter: false, protected: false, createdAt: stamp, updatedAt: stamp };
  db.roles.push(role);
  const user = { id: `usr-t${seq}`, username: `t${seq}`, email: null, nameAr: `مستخدم ${seq}`, nameEn: `User ${seq}`, avatar: 'T', status: 'active', roleId: role.id, scope, tokenVersion: 1, createdAt: stamp, createdBy: 'test', updatedAt: stamp, lastLoginAt: null, credential: hashPassword('Test-pass-1234') };
  db.users.push(user); commit();
  return { user, role, token: issueToken(user) };
}
const BIG = ['dashboard', 'invoices_collected', 'invoices_uncollected', 'exclusions', 'contracts', 'enforcement', 'planning', 'decisions', 'smart_reports', 'data_sources'];

/* ------------------------------------------------------------------ HTTP helpers (a fake req/res; the response is parsed) */
function call(token, method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const res = { chunks: [], writeHead(c, h) { this.code = c; this.headers = h || {}; }, write(c) { this.chunks.push(String(c)); return true; }, once() {}, end(b) { const t = b !== undefined ? b : this.chunks.join(''); let j = null; try { j = JSON.parse(t); } catch { /* csv */ } resolve({ code: this.code, headers: this.headers, text: t, body: j }); } };
    const sep = path.includes('?') ? '&' : '?';
    handleApi({ method, url: `/api${path}${sep}today=${TODAY}`, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: method === 'GET' ? undefined : JSON.parse(JSON.stringify(body || {})) }, res);
  });
}
const post = (u, path, body, h) => call(u.token, 'POST', path, body, h);
const get = (u, path, h) => call(u.token, 'GET', path, null, h);
const csv = (u, q) => call(u.token, 'GET', `/export.csv?q=${encodeURIComponent(JSON.stringify(q))}`);
const SC = (extra = {}) => ({ from: FROM, to: TODAY, ...extra });
const CFG = { cutoff: TODAY };

/* ------------------------------------------------------------------ the independent recount: every invoice row of the UNRESTRICTED engine, filtered by the shared per-record rule */
function allRows(filters = {}) {
  const rows = [];
  for (let p = 0; ; p += 1) {
    const r = list(st, { scope: SC(), cfg: CFG, filters, page: p, pageSize: 500, sort: { key: 'id', dir: 'asc' }, owner: 0 });
    rows.push(...r.rows); if (rows.length >= r.total) break;
  }
  return rows;
}
const recOf = (r) => ({ amanah: r.entityKey, municipalityRefId: r.municipalityRefId, municipalityStatus: r.municipalityStatus, nonMunicipal: r.entityKey === 'Housing Sector' });
const allowedRows = (scope, rows) => rows.filter((r) => geoScopeAllowsRecord(scope, recOf(r)));
const sumRows = (rows) => rows.reduce((t, r) => ({ count: t.count + 1, gross: t.gross + r.gross, exclusions: t.exclusions + r.exclusions, net: t.net + r.net, collected: t.collected + r.collected, outstanding: t.outstanding + r.outstanding }), { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 });
const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= 0.5, `${msg}: ${a} vs ${b}`);
const sameTotals = (a, b, msg) => { for (const k of ['count', 'gross', 'exclusions', 'net', 'collected', 'outstanding']) near(a[k], b[k], `${msg} ${k}`); };
const ROWS = allRows(); const ROW_BY_ID = new Map(ROWS.map((r) => [r.id, r]));
assert.ok(ROWS.length > 800, 'the compact world is loaded');

/* ------------------------------------------------------------------ the scopes under test */
const mapped = (am) => municipalitiesOf(am).map((m) => m.refId).filter((ref) => ROWS.some((r) => r.municipalityRefId === ref));
const JED = 'Jeddah Amanah'; const RIY = 'Riyadh Amanah'; const MAK = 'Makkah Amanah'; const TAB = 'Tabuk Amanah';
const jedRefs = mapped(JED).slice(0, 2); const riyRefs = mapped(RIY).slice(0, 2); const makRefs = mapped(MAK).slice(0, 1);
assert.ok(jedRefs.length === 2 && riyRefs.length === 2 && makRefs.length === 1, 'municipalities with invoices exist for the matrix');
const SCOPES = {
  all: ALL_SCOPE,
  jedEntire: normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(JED)] }),
  jedMunis: normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: JED, municipalities: jedRefs, direct: false, notSpecified: false }] }),
  jedMunisFlags: normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: JED, municipalities: jedRefs, direct: true, notSpecified: true }] }),
  jedAllMunisOnly: normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: JED, municipalities: 'all', direct: false, notSpecified: false }] }),
  jedDirectOnly: normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: JED, municipalities: [], direct: true, notSpecified: false }] }),
  jedNotSpecifiedOnly: normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: JED, municipalities: [], direct: false, notSpecified: true }] }),
  twoAmanahs: normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: RIY, municipalities: riyRefs, direct: false, notSpecified: false }, { amanah: MAK, municipalities: makRefs, direct: false, notSpecified: false }] }),
  nonMuni: normalizeGeoScope({ all: false, nonMunicipal: true, grants: [] }),
  empty: normalizeGeoScope({ all: false, nonMunicipal: false, grants: [] })
};
const U = {}; for (const [k, s] of Object.entries(SCOPES)) U[k] = mkUser(BIG, s);
const unrestricted = sumRows(ROWS);
const muniOf = (r) => `${r.municipalityStatus}:${r.municipalityRefId || ''}`;

/* ================================================================== 1. authentication */
ok('401 without a token, with a malformed token, with a tampered token — on EVERY data endpoint; only login / activation are public', async () => {
  const eps = ENDPOINTS.filter(([, p]) => !p.startsWith('/auth/') && !p.startsWith('/admin/') || p === '/admin/preview');
  assert.ok(eps.length >= 25);
  for (const [m, p] of eps) {
    for (const tok of [null, 'garbage', `${U.all.token}x`, `${U.all.token.split('.')[0]}.AAAA`]) {
      const r = await call(tok, m, p, {}); assert.equal(r.code, 401, `${m} ${p}`); assert.deepEqual(r.body, { error: 'unauthenticated' }, 'no data and no hint in the 401 body');
    }
  }
  assert.equal((await call(null, 'POST', '/nope', {})).code, 401, 'an unknown path does not reveal itself to an anonymous caller');
  assert.equal((await call(null, 'POST', '/auth/login', { username: 'nobody', password: 'x' })).code, 401, 'login is reachable without a token and refuses bad credentials');
  assert.ok(String((await call(null, 'POST', '/snapshot', {})).headers['x-access-version']).length > 0, 'every response carries x-access-version');
});

/* ================================================================== 2. permissions on every endpoint (table-driven from endpointAccess.js) */
const BODIES = {
  '/snapshot': { scope: SC() }, '/series': { scope: SC() }, '/bridge': { scope: SC() }, '/list': { scope: SC(), page: 0, pageSize: 5 }, '/noncollection': { scope: SC() }, '/distributions': { scope: SC() },
  '/worklist': { scope: SC(), limit: 5 }, '/anomalies': { scope: SC(), limit: 5 }, '/sources': {}, '/quality': { scope: SC() }, '/contracts': {}, '/contract': { no: 'NOPE-0' }, '/invoice': { id: '999999999999' },
  '/exclusion-check': { rows: [] }, '/order-match': { refs: [] }, '/order-debtor-invoices': { debtor: 1 }, '/enforcement-collections': { ids: [] }, '/upload': { records: [] }, '/upload/clear': {},
  '/furas/contracts': {}, '/furas/contract': { no: 'X' }, '/admin/preview': { roleId: 'role-financial', scope: { all: true } }
};
const dataEndpoints = ENDPOINTS.filter(([, p]) => !p.startsWith('/auth/') && !(p.startsWith('/admin/') && p !== '/admin/preview'));
const userWith = (() => { const memo = new Map(); return (perms) => { const k = perms.join(','); if (!memo.has(k)) memo.set(k, mkUser(perms)); return memo.get(k); }; })();
ok('403 `{error:"forbidden", permission, module}` with NO data for a user who holds none of the endpoint\'s modules; 200/404 (never 401/403) for a user holding exactly one of them', async () => {
  const none = userWith(['metrics']);
  for (const [m, p, resolver] of dataEndpoints) {
    if (p === '/meta') continue;
    const body = BODIES[p] || {};
    const need = resolver(body); assert.equal(need.kind, 'permission', p);
    const q = m === 'GET' ? null : body;
    const denied = m === 'GET' && p === '/export.csv' ? await csv(none, body) : await call(none.token, m, p, q);
    assert.equal(denied.code, 403, `${m} ${p} must be forbidden`);
    assert.equal(denied.body.error, 'forbidden'); assert.equal(denied.body.permission, need.anyOf[0]);
    assert.deepEqual(Object.keys(denied.body).filter((k) => !['error', 'permission', 'module', 'anyOf'].includes(k)), [], `${p}: the 403 body carries nothing else`);
    for (const perm of need.anyOf) {
      const u = userWith([perm]); const r = m === 'GET' && p === '/export.csv' ? await csv(u, body) : await call(u.token, m, p, q);
      assert.ok(r.code !== 401 && r.code !== 403, `${m} ${p} with ${perm} → ${r.code}`);
    }
  }
  // /meta needs only authentication
  assert.equal((await get(userWith(['metrics']), '/meta')).code, 200);
});
ok('a role with ONLY invoices_collected is denied contracts, non-collection, worklist, upload, sources, enforcement, exclusion-check and every export of another module; it reads and exports its own register', async () => {
  const u = userWith(['invoices_collected']);
  for (const [m, p] of [['POST', '/contracts'], ['POST', '/contract'], ['POST', '/noncollection'], ['POST', '/worklist'], ['POST', '/distributions'], ['POST', '/upload'], ['POST', '/upload/clear'], ['POST', '/sources'], ['POST', '/quality'], ['POST', '/exclusion-check'],
    ['POST', '/order-match'], ['POST', '/enforcement-collections'], ['POST', '/order-debtor-invoices'], ['GET', '/sanad-cases'], ['POST', '/snapshot' + 'x']]) {
    const r = await call(u.token, m, p, {}); assert.ok(p.endsWith('x') ? r.code === 404 : r.code === 403, `${p} → ${r.code}`);
  }
  assert.equal((await post(u, '/list', { scope: SC(), page: 0, pageSize: 3 })).code, 200);
  assert.equal((await csv(u, { scope: SC(), filters: {} })).code, 200, 'export is part of the module: the collected register exports');
  assert.equal((await csv(u, { scope: SC(), filters: { state: 'uncollected' } })).code, 403, 'the uncollected export belongs to invoices_uncollected');
  assert.equal((await csv(u, { scope: SC(), filters: { primary: 'any' } })).code, 403, 'the exclusions export belongs to exclusions');
  assert.equal((await post(u, '/snapshot', { scope: SC() })).code, 200, 'a data-module holder may read the metric layer for its scope');
  assert.equal((await post(u, '/list', { scope: SC(), filters: { primary: 'any' }, page: 0 })).code, 403, 'the exclusions register is the exclusions module');
  assert.equal((await post(u, '/list', { scope: SC(), withNc: true, page: 0 })).code, 403, 'the non-collection drill-down is invoices_uncollected');
  assert.equal((await post(u, '/list', { scope: SC(), filters: { state: 'uncollected' }, page: 0 })).code, 403);
});
ok('module off ⇒ its pages AND its exports are refused; module on ⇒ both work (exports follow the module of the list mode)', async () => {
  const unc = userWith(['invoices_uncollected']); const exc = userWith(['exclusions']); const enf = userWith(['enforcement']);
  assert.equal((await post(unc, '/list', { scope: SC(), filters: { state: 'uncollected' }, page: 0, pageSize: 2 })).code, 200); assert.equal((await csv(unc, { scope: SC(), filters: { state: 'uncollected' } })).code, 200);
  assert.equal((await csv(unc, { scope: SC(), filters: {} })).code, 403, 'the collected register export is another module');
  assert.equal((await post(unc, '/noncollection', { scope: SC() })).code, 200); assert.equal((await post(unc, '/worklist', { scope: SC(), limit: 3 })).code, 200);
  assert.equal((await post(exc, '/list', { scope: SC(), filters: { primary: 'any' }, page: 0, pageSize: 2 })).code, 200); assert.equal((await csv(exc, { scope: SC(), filters: { primary: 'any' } })).code, 200);
  assert.equal((await post(exc, '/exclusion-check', { rows: [] })).code, 200); assert.equal((await post(exc, '/contracts', {})).code, 403);
  assert.equal((await get(enf, '/sanad-cases')).code, 200); assert.equal((await post(enf, '/order-match', { refs: [] })).code, 200); assert.equal((await post(enf, '/exclusion-check', { rows: [] })).code, 403);
  assert.equal((await csv(enf, { scope: SC(), filters: { exec: 'executed' } })).code, 200, 'the enforcement dimension of the list export is the enforcement module');
  const dash = userWith(['dashboard']); assert.equal((await post(dash, '/snapshot', { scope: SC() })).code, 200); assert.equal((await post(dash, '/distributions', { scope: SC() })).code, 200); assert.equal((await post(dash, '/list', { scope: SC(), page: 0 })).code, 403);
});
ok('the mode map: list / export modules follow the filters (export = the module of the same list mode)', () => {
  assert.deepEqual(listPermissions({}), ['invoices_collected']);
  assert.deepEqual(listPermissions({ filters: { state: 'uncollected' } }), ['invoices_uncollected']);
  assert.deepEqual(listPermissions({ filters: { primary: 'any' } }), ['exclusions']);
  assert.deepEqual(listPermissions({ withPriority: true }), ['invoices_uncollected']);
  assert.deepEqual(listPermissions({ filters: { exec: 'executed' } }), ['invoices_collected', 'invoices_uncollected', 'enforcement']);
  assert.deepEqual(exportPermissions({ filters: { state: 'excluded' } }), ['exclusions', 'invoices_uncollected']);
  for (const b of [{}, { filters: { state: 'open' } }, { filters: { primary: 'x' } }, { withNc: true }]) assert.deepEqual(exportPermissions(b), listPermissions(b));
  assert.equal(requiredPermissionFor('POST', '/nope', {}).kind, 'unknown'); assert.equal(requiredPermissionFor('POST', '/auth/login', {}).kind, 'public'); assert.equal(requiredPermissionFor('GET', '/furas/summary', {}).anyOf[0], 'contracts');
  assert.ok(DATA_VIEWS.includes('dashboard') && DATA_MODULES.length === 9 && DATA_VIEWS === DATA_MODULES);
  assert.deepEqual(requiredPermissionFor('POST', '/upload', {}).anyOf, ['data_sources']); assert.equal(requiredPermissionFor('POST', '/upload', {}).write, true); assert.equal(requiredPermissionFor('POST', '/sources', {}).write, undefined);
  assert.deepEqual(requiredPermissionFor('GET', '/admin/roles', {}).modules, ['users', 'roles']); assert.deepEqual(requiredPermissionFor('PATCH', '/admin/users/usr-x', {}).modules, ['users']); assert.equal(requiredPermissionFor('PATCH', '/admin/users/usr-x', {}).write, true);
  assert.deepEqual(requiredPermissionFor('DELETE', '/admin/roles/r1', {}).modules, ['roles']);
  assert.deepEqual(requiredPermissionFor('POST', '/admin/preview', {}).anyOf, ['users', 'roles']);
});
ok('every endpoint of the map names only known modules (the catalog and the map agree)', async () => {
  const { MODULE_IDS } = await import('../src/data/permissions.js');
  for (const [m, p, f] of ENDPOINTS) { const r = f(BODIES[p] || {}); for (const id of r.anyOf || r.modules || []) assert.ok(MODULE_IDS.includes(id), `${m} ${p}: ${id}`); }
});
ok('the READ-ONLY role: may open its modules and export, but /upload and /upload/clear are refused with 403 read_only_role (audited); a writable role with the same module is not refused', async () => {
  const ro = mkUser(['data_sources', 'invoices_collected'], SCOPES.all, { readOnly: true }); const rw = mkUser(['data_sources', 'invoices_collected'], SCOPES.all);
  for (const p of ['/upload', '/upload/clear']) { const r = await post(ro, p, { records: [] }); assert.equal(r.code, 403, p); assert.deepEqual(r.body, { error: 'read_only_role' }); }
  assert.equal((await post(rw, '/upload', { records: [] })).code, 200); assert.equal((await post(rw, '/upload/clear', {})).code, 200);
  assert.equal((await post(ro, '/sources', {})).code, 200); assert.equal((await post(ro, '/list', { scope: SC(), page: 0, pageSize: 2 })).code, 200);
  assert.equal((await csv(ro, { scope: SC(), filters: {} })).code, 200, 'a read-only role may export');
  assert.ok(getDb().audit.some((e) => e.action === 'access_denied' && e.actorId === ro.user.id && /read_only/.test(JSON.stringify(e.after || {}))), 'the refusal is audited');
  assert.equal((await post(mkUser(['invoices_collected'], SCOPES.all, { readOnly: true }), '/upload', { records: [] })).code, 403, 'without the module it is the plain 403 forbidden');
});
ok('an administration-only user (users, roles) gets 403 on every data endpoint', async () => {
  const u = userWith(['users', 'roles']);
  for (const p of ['/snapshot', '/list', '/invoice', '/noncollection', '/contracts']) assert.equal((await post(u, p, BODIES[p] || { scope: SC() })).code, 403, p);
});

/* ================================================================== 3. the scope matrix */
const STATES = ['all', 'paid', 'uncollected', 'noncollected', 'excluded', 'cancelled', 'overdue', 'partial', 'collected', 'not_due'];
const ROWS_BY_STATE = Object.fromEntries(STATES.map((s) => [s, s === 'all' ? ROWS : allRows({ state: s })]));
for (const key of Object.keys(SCOPES)) {
  const scope = SCOPES[key]; const u = U[key]; const mine = allowedRows(scope, ROWS);
  ok(`[${key}] /snapshot totals = the permitted records only; the approved identities hold; the breakdowns add up`, async () => {
    const r = await post(u, '/snapshot', { scope: SC(), cfg: CFG }); assert.equal(r.code, 200);
    sameTotals(r.body.totals, sumRows(mine), `${key} snapshot`);
    assert.ok(r.body.equation.ok, 'the snapshot equation holds'); near(r.body.totals.gross, r.body.totals.exclusions + r.body.totals.net, 'gross = exclusions + net'); near(r.body.totals.net, r.body.totals.collected + r.body.totals.outstanding, 'net = collected + uncollected');
    for (const g of r.body.byAmanah) assert.ok(mine.some((x) => x.entityKey === g.key), `${key}: ${g.key} is a permitted Amanah`);
    for (const g of r.body.byMunicipality) assert.ok(mine.some((x) => x.entityKey === g.amanah && (g.status === 'mapped' ? x.municipalityRefId === g.municipality.refId : x.municipalityStatus === (g.status === 'needs_review' ? x.municipalityStatus : g.status))), `${key}: municipality group ${g.key} is permitted`);
    near(r.body.byMunicipality.reduce((t, g) => t + g.net, 0), r.body.totals.net, 'municipality groups add up');
    const sr = await post(u, '/series', { scope: SC({ from: '2026-01-01' }), cfg: CFG }); assert.equal(sr.code, 200);
    near(sr.body.billed.reduce((t, v) => t + v, 0), allowedRows(scope, ROWS.filter((x) => x.issueDate >= '2026-01-01')).reduce((t, x) => t + st.gross[x.index], 0), `${key} series billed`);
    const b = await post(u, '/bridge', { scope: SC(), cfg: CFG }); assert.equal(b.code, 200); assert.ok(Math.abs(b.body.check) < 1, 'the bridge reconciles for the scope');
    if (key !== 'all') { assert.equal(b.body.unmatched.count, 0); assert.equal(b.body.unmatched.nationalAmount, 0, 'no national report-only figure for a narrower access'); }
  });
  ok(`[${key}] /list in every state: total, sums, rows = the permitted rows of the same filter; facets add up`, async () => {
    for (const state of STATES) {
      const exp = allowedRows(scope, ROWS_BY_STATE[state]);
      const pages = []; let total = null; let sums = null;
      for (let p = 0; ; p += 1) { const r = await post(u, '/list', { scope: SC(), cfg: CFG, filters: state === 'all' ? {} : { state }, page: p, pageSize: 500, sort: { key: 'id', dir: 'asc' } }); assert.equal(r.code, 200, `${key} ${state}`); pages.push(...r.body.rows); total = r.body.total; sums = r.body.sums; if (pages.length >= total) break; }
      assert.equal(total, exp.length, `${key} ${state} total`); assert.deepEqual(pages.map((x) => x.id), exp.map((x) => x.id), `${key} ${state} rows`);
      if (exp.length) sameTotals({ ...sums, outstanding: sums.outstanding }, sumRows(exp), `${key} ${state} sums`);
    }
    const f = await post(u, '/list', { scope: SC(), cfg: CFG, filters: {}, page: 0, pageSize: 1, facets: ['product', 'origin', 'source', 'due'] });
    const tot = f.body.total; for (const dim of ['product', 'origin', 'source']) assert.equal(f.body.facets[dim].reduce((t, b) => t + b.count, 0), tot, `${key} facet ${dim} adds up to the permitted total`);
    if (tot) near(f.body.facets.source.reduce((t, b) => t + b.gross, 0), sumRows(mine).gross, `${key} facet gross`);
  });
  ok(`[${key}] /export.csv carries exactly the permitted rows (all filtered rows, not the page)`, async () => {
    for (const filters of [{}, { state: 'uncollected' }]) {
      const exp = allowedRows(scope, filters.state ? ROWS_BY_STATE[filters.state] : ROWS);
      const r = await csv(u, { scope: SC(), cfg: CFG, filters }); assert.equal(r.code, 200);
      const lines = r.text.trim().split('\n'); const head = lines[1].split(','); const idCol = head.indexOf('invoice_id');
      const ids = lines.slice(2).map((l) => l.split(',')[idCol]);
      assert.deepEqual(ids.slice().sort(), exp.map((x) => x.id).sort(), `${key} csv ${JSON.stringify(filters)}`);
      assert.ok(lines[0].includes(`(${exp.length})`), 'the first line states the number of rows');
    }
  });
  ok(`[${key}] /noncollection, /distributions, /worklist, /anomalies, /quality, /sources are computed over the permitted records only`, async () => {
    const unpaid = mine.filter((r) => r.outstanding > 0);
    const nc = await post(u, '/noncollection', { scope: SC(), cfg: CFG }); assert.equal(nc.code, 200);
    near(nc.body.populations.netUnpaid.amount, unpaid.reduce((t, r) => t + r.outstanding, 0), `${key} net unpaid`); assert.equal(nc.body.populations.netUnpaid.count, unpaid.length);
    assert.equal(nc.body.populations.issued.count, mine.length);
    const bad = nc.body.reconciliation.filter((c) => !c.ok); assert.deepEqual(bad.map((c) => c.key), [], `${key}: every reconciliation identity holds`);
    for (const a of nc.body.byAmanah) assert.ok(mine.some((x) => x.entityKey === a.key), `${key}: ${a.key} permitted`);
    for (const a of nc.body.heat.rows) assert.ok(mine.some((x) => x.entityKey === a.key));
    if (key !== 'all') assert.equal(nc.body.unmatched.rows.length, 0);
    const di = await post(u, '/distributions', { scope: SC(), cfg: CFG }); assert.equal(di.code, 200);
    assert.equal(di.body.amount.n, mine.length, `${key} distributions n`); near(di.body.amount.sum, sumRows(mine).gross, `${key} distributions sum`);
    for (const t of di.body.tree) assert.ok(mine.some((x) => x.entityKey === t.amanah), `${key}: tree cell ${t.amanah}`);
    assert.equal(di.body.tree.reduce((t, c) => t + c.count, 0), mine.length);
    const wl = await post(u, '/worklist', { scope: SC(), cfg: CFG, limit: 500 }); assert.equal(wl.code, 200);
    const wlExp = mine.filter((r) => r.outstanding > 0 && r.exclusionAmount === 0 && r.cls !== 'excluded');
    near(wl.body.totalOutstanding, wlExp.reduce((t, r) => t + r.outstanding, 0), `${key} worklist outstanding`); assert.equal(wl.body.total, wlExp.length);
    for (const r of wl.body.rows) assert.ok(ROW_BY_ID.has(r.id) && geoScopeAllowsRecord(scope, recOf(ROW_BY_ID.get(r.id))), `${key}: worklist row ${r.id}`);
    const an = await post(u, '/anomalies', { scope: SC(), cfg: CFG, limit: 300 }); assert.equal(an.code, 200);
    for (const r of an.body.rows) assert.ok(geoScopeAllowsRecord(scope, recOf(ROW_BY_ID.get(r.id))), `${key}: anomaly row ${r.id}`);
    const q = await post(u, '/quality', { scope: SC(), cfg: CFG }); assert.equal(q.body.records, mine.length, `${key} quality records`);
    if (key !== 'all') assert.ok(q.body.requests <= st.requests.length);
    const s = await post(u, '/sources', { cfg: CFG }); assert.equal(s.code, 200); assert.ok(Object.values(s.body.reconcile).every(Boolean), `${key}: the sources report reconciles over the permitted records`);
    near(s.body.totals.ytd.count, allowedRows(scope, ROWS.filter((r) => r.issueDate >= '2026-01-01')).length, `${key} sources ytd count`);
  });
  ok(`[${key}] /contracts, /contract and /sanad-cases show only contracts / cases whose Amanah, municipality and invoices are permitted`, async () => {
    const cards = contractCards(st, { cfg: CFG });
    const expect = cards.filter((c) => geoScopeAllowsRecord(scope, { amanah: c.amanahEn, municipalityRefId: c.municipalityRefId, municipalityStatus: c.municipalityStatus, nonMunicipal: false }) && c.invoiceIds.every((id) => ROW_BY_ID.has(id) && geoScopeAllowsRecord(scope, recOf(ROW_BY_ID.get(id)))));
    const r = await post(u, '/contracts', { cfg: CFG }); assert.equal(r.code, 200);
    assert.deepEqual(r.body.cards.map((c) => c.idx).sort(), expect.map((c) => c.idx).sort(), `${key} contracts`); assert.equal(r.body.rollup.contracts, expect.length);
    near(r.body.rollup.net, expect.reduce((t, c) => t + c.totals.net, 0), `${key} rollup net`);
    for (const c of cards) { const one = await post(u, '/contract', { no: c.contractNo, cfg: CFG }); const visible = expect.some((e) => e.idx === c.idx); if (visible) assert.ok([200, 409].includes(one.code)); else assert.ok([404, 409].includes(one.code) && !(one.body && one.body.contractNo === c.contractNo), `${key}: contract ${c.contractNo} is not served`); }
    const sc = await get(u, '/sanad-cases'); assert.equal(sc.code, 200); const all = sanadCases(st);
    assert.ok(sc.body.cases.length <= all.length);
    for (const c of sc.body.cases) for (const l of c.links) assert.ok(ROW_BY_ID.has(l.invoiceId) && geoScopeAllowsRecord(scope, recOf(ROW_BY_ID.get(l.invoiceId))), `${key}: case ${c.enforceNum} links only permitted invoices`);
    if (key === 'all') assert.equal(sc.body.cases.length, all.length);
    const ql = await post(u, '/quality', { scope: SC(), cfg: CFG }); assert.equal(ql.body.requests, sc.body.cases.filter((c) => c.system === 'sanad').length, `${key}: the quality request count follows the permitted cases`); assert.equal(ql.body.whiteLandsOrders, sc.body.cases.filter((c) => c.system === 'white_lands').length);
    const mt = await get(u, '/meta'); assert.equal(mt.body.counts.sanadRequests, ql.body.requests); assert.equal(mt.body.counts.whiteLandsOrders, ql.body.whiteLandsOrders);
  });
}
ok('direct / not-specified invoices are NOT visible without the flags and ARE visible with them (selected municipalities never imply them)', async () => {
  const noFlag = await post(U.jedMunis, '/list', { scope: SC(), filters: {}, page: 0, pageSize: 500 });
  assert.ok(noFlag.body.total > 0 && noFlag.body.rows.every((r) => r.municipalityStatus === 'mapped' && jedRefs.includes(r.municipalityRefId)), 'only the selected mapped municipalities');
  const withFlags = await post(U.jedMunisFlags, '/list', { scope: SC(), filters: {}, page: 0, pageSize: 500 });
  const statuses = new Set(withFlags.body.rows.map((r) => r.municipalityStatus));
  assert.ok(statuses.has('direct_amanah') && statuses.has('not_specified'), 'with the flags the direct and not-specified invoices appear');
  assert.ok(withFlags.body.total > noFlag.body.total);
  const only = await post(U.jedDirectOnly, '/list', { scope: SC(), filters: {}, page: 0, pageSize: 500 }); assert.ok(only.body.total > 0 && only.body.rows.every((r) => r.municipalityStatus === 'direct_amanah'));
  const ns = await post(U.jedNotSpecifiedOnly, '/list', { scope: SC(), filters: {}, page: 0, pageSize: 500 }); assert.ok(ns.body.total > 0 && ns.body.rows.every((r) => ['not_specified', 'unmapped_source_value', 'conflict'].includes(r.municipalityStatus)));
  // the three parts of an Amanah add up to the entire Amanah
  const sn = async (k) => (await post(U[k], '/snapshot', { scope: SC(), cfg: CFG })).body.totals;
  const parts = [await sn('jedAllMunisOnly'), await sn('jedDirectOnly'), await sn('jedNotSpecifiedOnly')]; const whole = await sn('jedEntire');
  sameTotals(parts.reduce((t, p) => ({ count: t.count + p.count, gross: t.gross + p.gross, exclusions: t.exclusions + p.exclusions, net: t.net + p.net, collected: t.collected + p.collected, outstanding: t.outstanding + p.outstanding }), { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 }), whole, 'municipalities + direct + not specified = the entire Amanah');
  assert.equal((await post(U.empty, '/snapshot', { scope: SC(), cfg: CFG })).body.totals.count, 0, 'an empty scope sees nothing');
  const nm = await post(U.nonMuni, '/list', { scope: SC(), page: 0, pageSize: 500 }); assert.ok(nm.body.total > 0 && nm.body.rows.every((r) => r.entityKey === 'Housing Sector'), 'non-municipal only = the Housing Sector');
});
ok('the partition of the unrestricted figures: Σ (one entire-Amanah scope per Amanah + non-municipal) = the unrestricted totals, for snapshot, list, contracts and noncollection', async () => {
  const users = ENTITIES.slice(0, N_AMANAH).map((e) => mkUser(BIG, normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(e.en)] }))); users.push(U.nonMuni);
  const add = (a, b) => ({ count: a.count + b.count, gross: a.gross + b.gross, exclusions: a.exclusions + b.exclusions, net: a.net + b.net, collected: a.collected + b.collected, outstanding: a.outstanding + b.outstanding });
  let snapSum = { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 }; let ncSum = 0; let ctSum = 0; let listSum = 0; let unpaid = 0;
  for (const u of users) {
    const s = await post(u, '/snapshot', { scope: SC(), cfg: CFG }); snapSum = add(snapSum, s.body.totals);
    ncSum += (await post(u, '/noncollection', { scope: SC(), cfg: CFG })).body.populations.netUnpaid.amount; unpaid += s.body.totals.outstanding;
    ctSum += (await post(u, '/contracts', { cfg: CFG })).body.rollup.contracts; listSum += (await post(u, '/list', { scope: SC(), page: 0, pageSize: 1 })).body.total;
  }
  const full = await post(U.all, '/snapshot', { scope: SC(), cfg: CFG }); sameTotals(snapSum, full.body.totals, 'Σ snapshot');
  sameTotals(full.body.totals, unrestricted, 'the unrestricted figures equal the independent recount');
  near(ncSum, (await post(U.all, '/noncollection', { scope: SC(), cfg: CFG })).body.populations.netUnpaid.amount, 'Σ net unpaid'); assert.equal(listSum, full.body.totals.count);
  const spanning = st.contracts.filter((c) => c && c.invs.some((i) => st.ent[i] !== c.ent)).length; // a contract whose invoices lie in another Amanah than its own is visible to nobody who lacks both (fail closed)
  assert.equal(ctSum + spanning, (await post(U.all, '/contracts', { cfg: CFG })).body.rollup.contracts, 'Σ contracts (+ the contracts whose invoices span Amanahs)');
  near(unpaid, full.body.totals.outstanding, 'Σ uncollected');
});
ok('a municipality scope across two Amanahs equals the sum of the two single-Amanah restrictions of the same municipalities', async () => {
  const a = mkUser(BIG, normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: RIY, municipalities: riyRefs, direct: false, notSpecified: false }] }));
  const b = mkUser(BIG, normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: MAK, municipalities: makRefs, direct: false, notSpecified: false }] }));
  const t = async (u) => (await post(u, '/snapshot', { scope: SC(), cfg: CFG })).body.totals;
  const x = await t(a); const y = await t(b); const z = await t(U.twoAmanahs);
  assert.equal(x.count + y.count, z.count); near(x.net + y.net, z.net, 'net'); assert.ok(z.count > 0);
});

/* ================================================================== 4. direct access: id / composite key / ambiguous number */
ok('an unauthorized invoice by legacy id, composite key or bare number answers 404 exactly like a missing one (same body, no leakage)', async () => {
  const foreign = ROWS.find((r) => r.entityKey === RIY && r.municipalityStatus === 'mapped'); assert.ok(foreign);
  const missing = await post(U.jedMunisFlags, '/invoice', { id: '999999999999-1' });
  for (const id of [foreign.id, foreign.compositeKey, foreign.invoiceNo]) {
    const r = await post(U.jedMunisFlags, '/invoice', { id, cfg: CFG }); assert.equal(r.code, 404, id); assert.deepEqual(r.body, { error: 'invoice_not_found' }); assert.deepEqual(r.body, missing.body);
    assert.equal((await post(U.jedEntire, '/invoice', { id })).code, 404);
  }
  const own = ROWS.find((r) => r.entityKey === JED && r.municipalityStatus === 'direct_amanah'); assert.equal((await post(U.jedMunis, '/invoice', { id: own.id })).code, 404, 'a direct Jeddah invoice is not visible to a municipalities-only scope');
  assert.equal((await post(U.jedMunisFlags, '/invoice', { id: own.id })).code, 200); assert.equal((await post(U.jedMunisFlags, '/invoice', { id: own.compositeKey })).code, 200);
  assert.equal((await post(U.all, '/invoice', { id: foreign.compositeKey })).code, 200);
  // a search by the unauthorized id / contract number / enforcement number finds nothing
  const s = await post(U.jedEntire, '/list', { scope: SC(), filters: { search: foreign.id }, page: 0 }); assert.equal(s.body.total, 0);
  for (const c of contractCards(st, { cfg: CFG })) if (c.amanahEn !== JED) { const r = await post(U.jedEntire, '/list', { scope: SC(), filters: { search: c.contractNo }, page: 0 }); assert.equal(r.body.total, 0, `contract ${c.contractNo} of another Amanah finds no invoice`); }
});
ok('an ambiguous invoice number lists ONLY the permitted candidates; a single permitted match opens without revealing the others', async () => {
  const groups = new Map(); for (const r of ROWS) { if (!groups.has(r.invoiceNo)) groups.set(r.invoiceNo, []); groups.get(r.invoiceNo).push(r); }
  const dups = [...groups.values()].filter((g) => g.length > 1 && new Set(g.map((x) => x.entityKey)).size > 1); assert.ok(dups.length >= 1, 'the world has invoice numbers carried by several Amanahs');
  for (const g of dups) {
    const ents = g.map((x) => x.entityKey); const [a, b] = g;
    const userA = mkUser(BIG, normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(a.entityKey)] }));
    const userAB = mkUser(BIG, normalizeGeoScope({ all: false, nonMunicipal: false, grants: ents.map(entireAmanahGrant) }));
    const none = mkUser(BIG, SCOPES.nonMuni);
    const rAll = await post(U.all, '/invoice', { id: a.invoiceNo }); assert.equal(rAll.code, 409); assert.equal(rAll.body.candidates.length, g.length);
    const rA = await post(userA, '/invoice', { id: a.invoiceNo }); assert.equal(rA.code, 200, 'one permitted match opens'); assert.equal(rA.body.rec.amanahEn, a.entityKey);
    const rAB = await post(userAB, '/invoice', { id: a.invoiceNo }); assert.equal(rAB.code, 409); assert.deepEqual(rAB.body.candidates.map((c) => c.amanahEn).sort(), ents.slice().sort());
    assert.equal((await post(none, '/invoice', { id: a.invoiceNo })).code, 404);
    assert.ok(!JSON.stringify(rA.body).includes(b.compositeKey) || b.compositeKey === a.compositeKey, 'the other Amanah\'s invoice is not mentioned');
  }
});

/* ================================================================== 5. a client can only narrow */
ok('widening attempts never expand: a client `access`, another Amanah, scope.org with other Amanahs, a forged owner / x-session', async () => {
  const base = (await post(U.jedEntire, '/snapshot', { scope: SC(), cfg: CFG })).body.totals; const jedOnly = sumRows(allowedRows(SCOPES.jedEntire, ROWS)); sameTotals(base, jedOnly, 'baseline');
  const attempts = [
    { scope: SC(), cfg: CFG, access: { all: true } }, { scope: SC(), cfg: CFG, access: SCOPES.all, accessMask: 'all' },
    { scope: SC({ org: { amanahKeys: [JED, RIY, MAK] } }), cfg: CFG }, { scope: SC({ amanah: [JED, RIY] }), cfg: CFG }, { scope: SC({ org: { orgKeys: null, amanahKeys: null } }), cfg: CFG }, { scope: SC(), cfg: CFG, owner: 7 }
  ];
  for (const body of attempts) { const r = await post(U.jedEntire, '/snapshot', body, { 'x-session': 'someone-else' }); assert.equal(r.code, 200); sameTotals(r.body.totals, jedOnly, `widening ${JSON.stringify(body).slice(0, 60)}`); }
  const other = await post(U.jedEntire, '/snapshot', { scope: SC({ amanah: RIY }), cfg: CFG }); assert.equal(other.body.totals.count, 0, 'asking for another Amanah returns nothing, not that Amanah');
  const muni = await post(U.jedMunis, '/snapshot', { scope: SC({ muni: `${JED}|DIRECT` }), cfg: CFG }); assert.equal(muni.body.totals.count, 0, 'a municipality group outside the grant is empty');
  for (const p of ['/noncollection', '/distributions', '/contracts']) { const r = await post(U.jedEntire, p, { scope: SC({ amanah: [RIY, JED] }), cfg: CFG, access: { all: true } }); assert.equal(r.code, 200); }
  const nc = await post(U.jedEntire, '/noncollection', { scope: SC(), cfg: CFG, access: { all: true } }); assert.ok(nc.body.byAmanah.every((a) => a.key === JED));
  const ls = await post(U.jedEntire, '/list', { scope: SC(), cfg: CFG, access: { all: true }, page: 0, pageSize: 500 }); assert.ok(ls.body.rows.every((r) => r.entityKey === JED));
  const x = await csv(U.jedEntire, { scope: SC(), cfg: CFG, access: { all: true }, owner: 3 }); assert.ok(x.text.split('\n').slice(2).filter(Boolean).every((l) => l.includes('Jeddah Amanah')));
  // the pure narrowing helper never expands
  assert.equal(accessKeyOf(narrowingOf({})), 'ALL'); assert.ok(accessKeyOf(narrowingOf({ amanah: JED })) !== 'ALL');
});

/* ================================================================== 6. caches never leak between users */
ok('alternating users with different scopes on IDENTICAL requests: every answer equals that user\'s first answer and differs from the others (snapshot, list, noncollection, distributions, contracts, meta, export, worklist)', async () => {
  const users = [U.jedEntire, U.twoAmanahs, U.all, U.nonMuni];
  const req = { scope: SC(), cfg: CFG, filters: {}, page: 0, pageSize: 20, sort: { key: 'gross', dir: 'desc' }, facets: ['source'] };
  const probes = [['/snapshot', (r) => r.body.totals], ['/list', (r) => ({ t: r.body.total, ids: r.body.rows.map((x) => x.id), f: r.body.facets })], ['/noncollection', (r) => r.body.populations.netUnpaid], ['/distributions', (r) => r.body.amount.n],
    ['/contracts', (r) => r.body.rollup.contracts], ['/worklist', (r) => r.body.total], ['/anomalies', (r) => r.body.total], ['/quality', (r) => r.body.records]];
  const first = new Map();
  for (let round = 0; round < 3; round += 1) {
    for (const u of (round % 2 ? users.slice().reverse() : users)) {
      for (const [p, pick] of probes) {
        const r = await post(u, p, req); assert.equal(r.code, 200); const v = JSON.stringify(pick(r)); const k = `${u.user.id}|${p}`;
        if (!first.has(k)) first.set(k, v); else assert.equal(v, first.get(k), `${p}: user ${u.user.id} round ${round} got a changed / foreign answer`);
      }
      const m = await get(u, '/meta'); const mk = `${u.user.id}|meta`; const mv = JSON.stringify(m.body.counts); if (!first.has(mk)) first.set(mk, mv); else assert.equal(mv, first.get(mk));
      const e = await csv(u, { scope: SC(), cfg: CFG, filters: {} }); const ek = `${u.user.id}|csv`; if (!first.has(ek)) first.set(ek, e.text); else assert.equal(e.text, first.get(ek));
    }
  }
  for (const [p] of probes) { const vals = users.map((u) => first.get(`${u.user.id}|${p}`)); assert.ok(new Set(vals).size >= 3, `${p}: different scopes give different answers`); }
  assert.notEqual(first.get(`${U.jedEntire.user.id}|csv`), first.get(`${U.all.user.id}|csv`));
});
ok('the access mask: cached per scope key, identical to the per-record rule, absent (null) for an unrestricted access', () => {
  assert.equal(visibleMask(st, undefined), null); assert.equal(visibleMask(st, { all: true }), null);
  const m1 = visibleMask(st, SCOPES.jedMunisFlags); assert.equal(m1, visibleMask(st, SCOPES.jedMunisFlags), 'cached');
  const tab = accessTable(SCOPES.jedMunisFlags);
  for (let i = 0; i < st.n; i += 1) { const f = iimFields(st, i); const exp = geoScopeAllowsRecord(SCOPES.jedMunisFlags, { amanah: ENTITIES[st.ent[i]].en, municipalityRefId: f.municipalityRefId, municipalityStatus: f.municipalityStatus, nonMunicipal: st.ent[i] >= N_AMANAH }); assert.equal(m1[i] === 1, exp, `row ${i}`); assert.equal(isVisible(st, i, tab), exp); }
  assert.notEqual(accessKeyOf(SCOPES.jedEntire), accessKeyOf(SCOPES.jedMunis)); assert.equal(accessKeyOf(normalizeGeoScope(SCOPES.jedEntire)), accessKeyOf(SCOPES.jedEntire));
  assert.equal(accessTable('junk').all, false, 'a value that is not a GeoScope denies everything'); assert.equal(accessTable(undefined).all, true);
});

/* ================================================================== 7. identity changes apply on the NEXT request */
ok('deactivation, a narrowed scope and a removed module take effect on the very next request (no stale cache)', async () => {
  const u = mkUser(BIG, SCOPES.all); const q = { scope: SC(), cfg: CFG };
  const wide = (await post(u, '/snapshot', q)).body.totals.count; assert.equal(wide, unrestricted.count);
  u.user.scope = SCOPES.jedEntire; commit();
  assert.equal((await post(u, '/snapshot', q)).body.totals.count, allowedRows(SCOPES.jedEntire, ROWS).length, 'the narrowed scope applies at once');
  assert.equal((await post(u, '/list', { ...q, page: 0, pageSize: 1 })).body.total, allowedRows(SCOPES.jedEntire, ROWS).length);
  u.role.modules = u.role.modules.filter((m) => m !== 'contracts'); commit();
  assert.equal((await post(u, '/contracts', {})).code, 403, 'a removed module is refused at once'); assert.equal((await post(u, '/snapshot', q)).code, 200);
  u.user.status = 'inactive'; commit();
  assert.equal((await post(u, '/snapshot', q)).code, 401, 'a deactivated user is signed out at once'); assert.equal((await get(u, '/meta')).code, 401);
  const w = mkUser(BIG, SCOPES.jedEntire); w.user.tokenVersion += 1; commit(); assert.equal((await post(w, '/snapshot', q)).code, 401, 'a token issued before a credential reset is void');
});
ok('the unit seam: a stub authenticator drives the same enforcement without the identity store (used only by tests)', async () => {
  const perms = new Set(['invoices_collected']); setAuthenticator(() => ({ user: { id: 'stub-1' }, access: { permissions: perms, scopes: { invoices_collected: SCOPES.jedEntire } }, accessVersion: 1 }));
  try {
    const r = await call(null, 'POST', '/list', { scope: SC(), page: 0, pageSize: 500 }); assert.equal(r.code, 200); assert.ok(r.body.rows.every((x) => x.entityKey === JED));
    assert.equal((await call(null, 'POST', '/contracts', {})).code, 403);
    setAuthenticator(() => null); assert.equal((await call(null, 'POST', '/list', {})).code, 401);
  } finally { setAuthenticator(null); }
});

/* ================================================================== 8. meta, documents, the Furas dataset, the exclusion check, enforcement helpers */
ok('/meta counts are over the permitted records; labels and dates are unchanged', async () => {
  const all = (await get(U.all, '/meta')).body; const jed = (await get(U.jedEntire, '/meta')).body;
  assert.equal(jed.counts.invoicesTotal, Array.from({ length: st.nGen }, (_, i) => i).filter((i) => ENTITIES[st.ent[i]].en === JED).length + Array.from({ length: st.n - st.nGen }, (_, k) => st.nGen + k).filter((i) => st.owner[i] === 0 && ENTITIES[st.ent[i]].en === JED).length);
  assert.ok(jed.counts.invoicesTotal < all.counts.invoicesTotal && jed.counts.paymentsTotal < all.counts.paymentsTotal); assert.equal(jed.today, all.today); assert.deepEqual(jed.label, all.label);
  assert.equal(jed.counts.contracts, (await post(U.jedEntire, '/contracts', {})).body.rollup.contracts);
});
ok('invoice documents are part of the module that opens the invoice: no separate documents permission, nothing is stripped', async () => {
  const view = mkUser(['invoices_collected'], SCOPES.all); const row = ROWS[0];
  const a = await post(view, '/invoice', { id: row.id }); assert.equal(a.code, 200); assert.equal(a.body.documentsRestricted, undefined);
  const b = await post(U.all, '/invoice', { id: row.id }); assert.equal(b.code, 200); assert.equal(b.body.documentsRestricted, undefined);
  for (const mod of ['invoices_uncollected', 'exclusions', 'enforcement']) assert.equal((await post(mkUser([mod], SCOPES.all), '/invoice', { id: row.id })).code, 200, `${mod} opens an invoice`);
  assert.equal((await post(mkUser(['contracts'], SCOPES.all), '/invoice', { id: row.id })).code, 403);
});
ok('the Furas dataset: the contracts module is required; a narrower-than-all access reads it as unavailable (its records cannot be attributed to an Amanah / municipality)', async () => {
  assert.ok([200, 404].includes((await post(U.all, '/furas/contracts', {})).code), 'an unrestricted user reaches the (local-only) Furas routes');
  const none = userWith(['invoices_collected']); assert.equal((await post(none, '/furas/contracts', {})).code, 403);
  const s = await get(U.jedEntire, '/furas/status'); assert.equal(s.code, 200); assert.deepEqual(s.body, { available: false, reason: 'geo_scope_unmapped' });
  assert.equal((await post(U.jedEntire, '/furas/contracts', {})).code, 404);
  assert.notEqual((await get(U.all, '/furas/status')).body.reason, 'geo_scope_unmapped');
});
ok('/exclusion-check, /order-match, /order-debtor-invoices and /enforcement-collections treat an unauthorized invoice exactly like a missing one', async () => {
  const foreign = ROWS.find((r) => r.entityKey === RIY && r.municipalityStatus === 'mapped' && r.outstanding > 0 && r.cls !== 'cancelled'); assert.ok(foreign);
  const ex = await post(U.jedEntire, '/exclusion-check', { rows: [{ row: 1, reason: 'عدم قابلية التحصيل', invoiceNo: foreign.id, amanah: foreign.amanahAr, amount: foreign.gross, date: foreign.issueDate, account: foreign.gfsCode }], cfg: CFG });
  assert.equal(ex.code, 200); assert.equal(ex.body.rows[0].invoiceId, null, 'no invoice is revealed'); assert.ok(['invoice_not_found', 'reason_invalid', 'amanah_unknown'].includes(ex.body.rows[0].code), ex.body.rows[0].code);
  const miss = await post(U.jedEntire, '/exclusion-check', { rows: [{ row: 1, reason: 'عدم قابلية التحصيل', invoiceNo: '171-999999999999', amanah: foreign.amanahAr, amount: 1, date: foreign.issueDate, account: '1' }], cfg: CFG });
  assert.equal(ex.body.rows[0].code, miss.body.rows[0].code, 'the answer is identical to a missing invoice');
  const om = await post(U.jedEntire, '/order-match', { refs: [{ kind: 'composite_key', value: foreign.compositeKey }, { kind: 'invoice_id_exact', value: foreign.id }, { kind: 'sadad_no', value: foreign.invoiceNo }], cfg: CFG });
  assert.deepEqual(om.body.results.map((r) => [r.status, r.candidates.length]), [['unmatched', 0], ['unmatched', 0], ['unmatched', 0]]);
  const omAll = await post(U.all, '/order-match', { refs: [{ kind: 'composite_key', value: foreign.compositeKey }], cfg: CFG }); assert.equal(omAll.body.results[0].status, 'matched');
  const ec = await post(U.jedEntire, '/enforcement-collections', { ids: [foreign.id], cfg: CFG }); assert.equal(ec.body.linkedInvoices, 0);
  const debtorRow = st.payer[foreign.index]; const sd = await post(U.jedEntire, '/order-debtor-invoices', { debtor: debtorRow, cfg: CFG });
  for (const v of sd.body.invoices) assert.ok(geoScopeAllowsRecord(SCOPES.jedEntire, recOf(ROW_BY_ID.get(v.invoiceId))), 'same-debtor invoices are limited to the permitted ones');
});

/* ================================================================== 9. uploads keep owner semantics and the uploader's own geographic access */
ok('uploaded records: owner = the authenticated user (a forged x-session or owner changes nothing); refused outside the uploader\'s access; clear removes only the own', async () => {
  const tpl = [...st.fixtures.values()].find((f) => f.grossAmount > 0);
  const mk = (id, amanahEn) => ({ ...JSON.parse(JSON.stringify(tpl)), id, invoiceNo: id.replace(/\D/g, '').padEnd(12, '0').slice(0, 12), sadadNo: id.replace(/\D/g, '').padEnd(12, '0').slice(0, 12), amanahEn, amanahAr: ENTITIES.find((e) => e.en === amanahEn).ar, municipalitySourceValues: undefined, municipalityAr: undefined, payments: [], exclusion: null, exclusions: [], cancelled: null });
  const a = mkUser(BIG, SCOPES.jedEntire); const b = mkUser(BIG, SCOPES.jedEntire);
  const r1 = await post(a, '/upload', { records: [mk('UPLD-7001', JED), mk('UPLD-7002', RIY)] }, { 'x-session': 'forged' }); assert.equal(r1.code, 200); assert.equal(r1.body.added, 1); assert.deepEqual(r1.body.outOfScope, ['UPLD-7002']);
  const seen = async (u, h) => (await post(u, '/list', { scope: SC(), filters: { search: 'UPLD-70' }, page: 0, pageSize: 50 }, h)).body.rows.map((r) => r.id);
  assert.deepEqual(await seen(a), ['UPLD-7001']); assert.deepEqual(await seen(b), [], 'another user of the same scope does not see it'); assert.deepEqual(await seen(b, { 'x-session': 'forged' }), [], 'a forged x-session does not either');
  assert.deepEqual(await seen(U.all), [], 'not even an unrestricted user sees another user\'s upload');
  assert.equal((await post(b, '/invoice', { id: 'UPLD-7001' })).code, 404);
  const own = (await post(a, '/snapshot', { scope: SC(), cfg: CFG })).body.totals.count; assert.equal(own, allowedRows(SCOPES.jedEntire, ROWS).length + 1);
  assert.equal((await post(b, '/upload/clear', {})).body.removed, 0); assert.deepEqual(await seen(a), ['UPLD-7001']);
  assert.equal((await post(a, '/upload/clear', {})).body.removed, 1); assert.deepEqual(await seen(a), []);
});

/* ================================================================== 10. the administrator's preview */
ok('/admin/preview {roleId, scope}: the figures visible under the previewed access, clamped to the administrator\'s own data access', async () => {
  const role = getDb().roles.find((r) => r.id === 'role-financial'); assert.ok(role, 'the starter financial role exists');
  const full = mkUser([...BIG, 'users'], SCOPES.all);
  const p1 = await post(full, '/admin/preview', { roleId: 'role-financial', scope: SCOPES.jedMunisFlags }); assert.equal(p1.code, 200);
  sameTotals({ ...p1.body.figures, outstanding: p1.body.figures.uncollected }, sumRows(allowedRows(SCOPES.jedMunisFlags, ROWS)), 'preview figures'); assert.equal(p1.body.clamped, false); assert.ok(p1.body.figuresLabel.en.includes('Synthetic'));
  assert.ok(p1.body.moduleFigures.invoices_collected.records > 0); assert.ok(p1.body.modules.includes('invoices_collected') && p1.body.permissions.includes('invoices_collected') && Array.isArray(p1.body.modules));
  assert.equal(p1.body.role.id, 'role-financial'); assert.equal(p1.body.readOnly, false); assert.ok(p1.body.scopes.invoices_collected.summary.en);
  const small = mkUser([...BIG, 'users'], SCOPES.jedEntire);
  const p2 = await post(small, '/admin/preview', { roleId: 'role-financial', scope: ALL_SCOPE }); assert.equal(p2.body.clamped, true);
  sameTotals({ ...p2.body.figures, outstanding: p2.body.figures.uncollected }, sumRows(allowedRows(SCOPES.jedEntire, ROWS)), 'clamped preview');
  const adminOnly = mkUser(['users', 'roles'], SCOPES.all);
  const p3 = await post(adminOnly, '/admin/preview', { roleId: 'role-financial', scope: ALL_SCOPE }); assert.equal(p3.code, 200); assert.equal(p3.body.figures, null); assert.equal(p3.body.figuresWithheld, true);
  assert.equal((await post(adminOnly, '/admin/preview', { roleId: 'role-financial', scope: { all: false, grants: [{ amanah: 'Nowhere', municipalities: 'all' }] } })).code, 400);
  assert.equal((await post(adminOnly, '/admin/preview', { roleId: 'role-nope', scope: ALL_SCOPE })).code, 400); assert.equal((await post(adminOnly, '/admin/preview', {})).code, 400);
  const ro = await post(adminOnly, '/admin/preview', { roleId: 'role-auditor', scope: ALL_SCOPE }); assert.equal(ro.body.readOnly, true);
  assert.equal((await post(userWith(['invoices_collected']), '/admin/preview', {})).code, 403);
  assert.ok(!JSON.stringify(p1.body).includes('credential') && !JSON.stringify(p1.body).toLowerCase().includes('password'));
});

for (const run of pending) await run();
console.log(`authz-server tests: ${n} passed`);
