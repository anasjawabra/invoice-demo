// Identity core (SIMPLIFIED MODEL): module catalog, geographic scope helpers, persistence + migration (incl. the schema-1 → 2 conversion), sessions, admin API guards, read-only role, no-secret scan. Run: npm run test:identity
// Uses an ISOLATED temp identity file (never server/.data/identity.json) and synthetic accounts only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MODULES, MODULE_IDS, moduleById, STARTER_ROLES, ADMIN_ROLE_ID, AUDITOR_ROLE_ID, permissionsOf, hasModule, describeUserSummary, moduleTitle, PERMISSION_IDS, hasPermission, closePermissions, permissionLabel } from '../src/data/permissions.js';
import {
  normalizeGeoScope, validateGeoScope, unionGeoScopes, intersectGeoScopes, geoScopeSubset, geoScopeAllowsRecord, geoScopeAmanahKeys, describeGeoScope, geoScopeKey, geoScopeMatcher,
  geoScopeFromAmanahKeys, AMANAH_KEYS, ALL_SCOPE, EMPTY_SCOPE, entireAmanahGrant, isEmptyGeoScope
} from '../src/data/geoScope.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { handleIdentityRoute, resolveAccess, describeAccess } from '../server/adminApi.js';
import { resetForTests, reloadFromDisk, getDb, authenticate, effectiveScopeFor, computeAccess, setClockForTests, getRoles, storageInfo, SCHEMA_VERSION, migrate, dbFile, mapOldRole } from '../server/identity/index.js';

let n = 0; let chain = Promise.resolve(); // tests run strictly in order (the identity tests share one store)
const ok = (name, fn) => { chain = chain.then(async () => { try { await fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}\n  ${e.stack || e}`); process.exitCode = 1; } }); };

const RIY = 'Riyadh Amanah'; const MAK = 'Makkah Amanah'; const EAST = 'Eastern Province Amanah';
const riyRefs = municipalitiesOf(RIY).map((m) => m.refId); const makRefs = municipalitiesOf(MAK).map((m) => m.refId);
const grant = (amanah, municipalities, direct = false, notSpecified = false) => ({ amanah, municipalities, direct, notSpecified });
const scopeOf = (grants, nonMunicipal = false) => ({ all: false, grants, nonMunicipal });

/* ------------------------------------------------------------------ 1. the module catalog */
ok('the 13 module ids match docs/access-control.md S1 exactly; every module has AR + EN names, descriptions and routes; ids are unique', () => {
  const doc = ['dashboard', 'invoices_collected', 'invoices_uncollected', 'enforcement', 'exclusions', 'contracts', 'planning', 'smart_reports', 'decisions', 'data_sources', 'metrics', 'users', 'roles'];
  assert.deepEqual([...MODULE_IDS], doc, 'the catalog order is the page order'); assert.equal(new Set(MODULE_IDS).size, 13); assert.equal(MODULES.length, 13);
  for (const m of MODULES) { assert.ok(m.nameAr && m.nameEn && m.descriptionAr && m.descriptionEn && m.routes.length > 0, m.id); assert.equal(moduleTitle(m.id, 'en'), m.nameEn); assert.equal(moduleTitle(m.id, 'ar'), m.nameAr); assert.equal(moduleById(m.id).id, m.id); }
  assert.equal(moduleById('nope'), null); assert.equal(moduleTitle('nope'), 'nope');
  assert.deepEqual(moduleById('invoices_collected').routes, ['/invoices', '/invoices/:id']); assert.equal(moduleById('users').routes[0], '/settings/users');
  assert.deepEqual(MODULES.filter((m) => !m.scoped).map((m) => m.id), ['metrics', 'users', 'roles']);
});
ok('starter roles: 5 editable roles with valid module ids; ONLY the Administrator is protected (all 13, keeps users + roles); only the Auditor is read-only; names per the spec', () => {
  assert.equal(STARTER_ROLES.length, 5); assert.equal(ADMIN_ROLE_ID, 'role-system-admin'); assert.equal(AUDITOR_ROLE_ID, 'role-auditor');
  for (const r of STARTER_ROLES) { assert.ok(r.nameAr && r.nameEn && r.descriptionAr && r.descriptionEn && r.starter, r.id); assert.ok(r.modules.length > 0 && r.modules.every((m) => MODULE_IDS.includes(m)), r.id); assert.equal(typeof r.readOnly, 'boolean'); }
  const by = Object.fromEntries(STARTER_ROLES.map((r) => [r.id, r]));
  assert.equal(by[ADMIN_ROLE_ID].nameEn, 'Administrator'); assert.equal(by[ADMIN_ROLE_ID].nameAr, 'مدير النظام'); assert.deepEqual(by[ADMIN_ROLE_ID].modules, MODULE_IDS); assert.ok(by[ADMIN_ROLE_ID].protected);
  assert.deepEqual(STARTER_ROLES.filter((r) => r.protected).map((r) => r.id), [ADMIN_ROLE_ID]); assert.deepEqual(STARTER_ROLES.filter((r) => r.readOnly).map((r) => r.id), [AUDITOR_ROLE_ID]);
  assert.equal(by['role-collection'].nameEn, 'Collection Officer'); assert.equal(by['role-collection'].nameAr, 'موظف تحصيل'); assert.equal(by[AUDITOR_ROLE_ID].nameEn, 'Auditor');
  assert.deepEqual(by[AUDITOR_ROLE_ID].modules, MODULE_IDS, 'the auditor reads every module (the read-only switch stops the changes)');
  for (const r of STARTER_ROLES) if (r.id !== ADMIN_ROLE_ID && r.id !== AUDITOR_ROLE_ID) assert.ok(!r.modules.includes('users') && !r.modules.includes('roles'), r.id);
  assert.ok(by['role-collection'].modules.includes('invoices_uncollected') && !by['role-collection'].modules.includes('exclusions') && !by['role-collection'].modules.includes('data_sources'));
  assert.ok(by['role-enforcement'].modules.includes('enforcement') && !by['role-collection'].modules.includes('enforcement') && by['role-financial'].modules.includes('exclusions') && by['role-financial'].modules.includes('planning'));
  assert.equal(new Set(STARTER_ROLES.map((r) => r.modules.join(','))).size >= 4, true);
});
ok('hasModule accepts a Set or an array; permissionsOf(role) is the Set of module ids; permissionsOf(null) is empty; describeUserSummary(user, role, lang) = «role · Amanah · municipalities»', () => {
  assert.ok(hasModule(new Set(['a']), 'a')); assert.ok(hasModule(['a'], 'a')); assert.ok(!hasModule(null, 'a')); assert.equal(permissionsOf(null).size, 0);
  assert.deepEqual([...permissionsOf({ modules: ['roles', 'users', 'nope', 'users'] })], ['users', 'roles']);
  const co = STARTER_ROLES.find((r) => r.id === 'role-collection'); const jed = 'Jeddah Amanah'; const refs = municipalitiesOf(jed).map((m) => m.refId).slice(0, 3);
  const u = { scope: scopeOf([grant(jed, refs)]) };
  assert.equal(describeUserSummary(u, co, 'en'), 'Collection Officer · Jeddah Amanah · 3 municipalities'); assert.equal(describeUserSummary(u, co, 'ar'), 'موظف تحصيل · أمانة محافظة جدة · 3 بلديات');
  assert.equal(describeUserSummary({ scope: ALL_SCOPE }, STARTER_ROLES[0], 'en'), 'Administrator · All Amanahs and municipalities');
  assert.equal(describeUserSummary({ scope: scopeOf([entireAmanahGrant(jed)]) }, co, 'en'), 'Collection Officer · Jeddah Amanah · all municipalities + direct + not specified');
  assert.equal(describeUserSummary({ scope: scopeOf([grant(jed, refs), grant(RIY, 'all')]) }, co, 'en').startsWith('Collection Officer · 2 Amanahs'), true);
  assert.equal(describeUserSummary({ scope: ALL_SCOPE }, null, 'en'), 'All Amanahs and municipalities');
});
ok('compat exports of the earlier API operate on modules: PERMISSION_IDS = MODULE_IDS, hasPermission, permissionLabel, closePermissions is the identity (known ids, catalog order)', () => {
  assert.deepEqual(PERMISSION_IDS, MODULE_IDS); assert.ok(hasPermission(['users'], 'users')); assert.equal(permissionLabel('contracts', 'en'), 'Investment Contracts');
  assert.deepEqual(closePermissions(['roles', 'users', 'nope', 'users']), ['users', 'roles']);
});

/* ------------------------------------------------------------------ 2. geographic scope */
ok('validateGeoScope: accepts good scopes; rejects an unknown Amanah, a municipality of another Amanah, duplicates, empty grants and wrong types', () => {
  assert.ok(validateGeoScope({ all: true }).ok);
  assert.ok(validateGeoScope(scopeOf([grant(RIY, [riyRefs[0], riyRefs[1]]), grant(MAK, 'all', true, true)])).ok);
  assert.ok(validateGeoScope(scopeOf([], true)).ok);
  const bad = (s, code) => { const v = validateGeoScope(s); assert.ok(!v.ok, code); assert.ok(v.errors.some((e) => e.code === code), `${code}: ${JSON.stringify(v.errors)}`); assert.ok(v.errors.every((e) => e.ar && e.en && e.path)); };
  bad(scopeOf([grant('Atlantis Amanah', 'all')]), 'unknown_amanah');
  bad(scopeOf([grant('Housing Sector', 'all')]), 'unknown_amanah'); // the Housing Sector is a non-municipal entity, not an Amanah
  bad(scopeOf([grant(RIY, [makRefs[0]])]), 'municipality_not_in_amanah');
  bad(scopeOf([grant(RIY, ['MREF-NOPE'])]), 'municipality_not_in_amanah');
  bad(scopeOf([grant(RIY, 'all'), grant(RIY, [riyRefs[0]])]), 'duplicate_amanah');
  bad(scopeOf([grant(RIY, [])]), 'empty_grant');
  bad({ all: false, grants: 'x' }, 'scope_invalid'); bad(null, 'scope_invalid'); bad({ all: 'yes' }, 'scope_invalid');
  bad(scopeOf([{ amanah: RIY, municipalities: 'some' }]), 'grant_invalid'); bad(scopeOf([{ amanah: RIY, municipalities: 'all', direct: 'yes' }]), 'grant_invalid');
});
ok('normalizeGeoScope: sorts, merges duplicates, drops empty grants, dedupes refs; every Amanah fully granted + nonMunicipal collapses to all; garbage → empty', () => {
  const s = normalizeGeoScope({ all: false, grants: [grant(MAK, [makRefs[1], makRefs[0], makRefs[0]]), grant(RIY, []), grant(MAK, [makRefs[2]], true)] });
  assert.equal(s.grants.length, 1); assert.deepEqual(s.grants[0].municipalities, [...makRefs].sort()); assert.equal(s.grants[0].direct, true);
  assert.deepEqual(normalizeGeoScope('x'), EMPTY_SCOPE); assert.deepEqual(normalizeGeoScope(undefined), EMPTY_SCOPE);
  assert.equal(normalizeGeoScope({ all: false, grants: AMANAH_KEYS.map(entireAmanahGrant), nonMunicipal: true }).all, true);
  assert.equal(normalizeGeoScope({ all: false, grants: AMANAH_KEYS.map(entireAmanahGrant), nonMunicipal: false }).all, false);
  assert.ok(isEmptyGeoScope(EMPTY_SCOPE) && !isEmptyGeoScope(scopeOf([], true)));
});
const REC = (amanah, status, refId = null, nonMunicipal = false) => ({ amanah, municipalityStatus: status, municipalityRefId: refId, nonMunicipal });
ok('geoScopeAllowsRecord matrix: a few municipalities never imply direct / not specified; mapped / direct / not_specified / unmapped / conflict / nonMunicipal', () => {
  const few = scopeOf([grant(RIY, [riyRefs[0], riyRefs[1]])]);
  assert.ok(geoScopeAllowsRecord(few, REC(RIY, 'mapped', riyRefs[0]))); assert.ok(geoScopeAllowsRecord(few, REC(RIY, 'mapped', riyRefs[1])));
  assert.ok(!geoScopeAllowsRecord(few, REC(RIY, 'mapped', riyRefs[2])));
  for (const st of ['direct_amanah', 'not_specified', 'unmapped_source_value', 'conflict']) assert.ok(!geoScopeAllowsRecord(few, REC(RIY, st)), st);
  assert.ok(!geoScopeAllowsRecord(few, REC(MAK, 'mapped', makRefs[0]))); assert.ok(!geoScopeAllowsRecord(few, REC('Housing Sector', 'not_specified', null, true)));
  const onlyMunis = scopeOf([grant(RIY, 'all')]);
  assert.ok(geoScopeAllowsRecord(onlyMunis, REC(RIY, 'mapped', riyRefs[5]))); assert.ok(!geoScopeAllowsRecord(onlyMunis, REC(RIY, 'direct_amanah'))); assert.ok(!geoScopeAllowsRecord(onlyMunis, REC(RIY, 'not_specified')));
  const direct = scopeOf([grant(RIY, [], true, false)]);
  assert.ok(geoScopeAllowsRecord(direct, REC(RIY, 'direct_amanah'))); assert.ok(!geoScopeAllowsRecord(direct, REC(RIY, 'not_specified'))); assert.ok(!geoScopeAllowsRecord(direct, REC(RIY, 'mapped', riyRefs[0])));
  const notSpec = scopeOf([grant(RIY, [riyRefs[0]], false, true)]);
  for (const st of ['not_specified', 'unmapped_source_value', 'conflict']) assert.ok(geoScopeAllowsRecord(notSpec, REC(RIY, st)), st);
  assert.ok(!geoScopeAllowsRecord(notSpec, REC(RIY, 'direct_amanah')));
  const entire = scopeOf([entireAmanahGrant(RIY)]);
  for (const st of ['direct_amanah', 'not_specified', 'unmapped_source_value', 'conflict']) assert.ok(geoScopeAllowsRecord(entire, REC(RIY, st)), st);
  assert.ok(geoScopeAllowsRecord(entire, REC(RIY, 'mapped', riyRefs[3]))); assert.ok(!geoScopeAllowsRecord(entire, REC(MAK, 'direct_amanah')));
  const nonM = scopeOf([], true);
  assert.ok(geoScopeAllowsRecord(nonM, REC('Housing Sector', 'not_specified', null, true))); assert.ok(geoScopeAllowsRecord(nonM, REC(null, 'not_specified', null, true))); assert.ok(!geoScopeAllowsRecord(nonM, REC(RIY, 'mapped', riyRefs[0])));
  assert.ok(!geoScopeAllowsRecord(entire, REC('Housing Sector', 'not_specified', null, true)));
  assert.ok(geoScopeAllowsRecord({ all: true }, REC(RIY, 'conflict'))); assert.ok(geoScopeAllowsRecord({ all: true }, REC('Housing Sector', 'x', null, true)));
  assert.ok(!geoScopeAllowsRecord(EMPTY_SCOPE, REC(RIY, 'mapped', riyRefs[0]))); assert.ok(!geoScopeAllowsRecord(few, null));
});
// deterministic fuzz: set algebra of union / intersect / subset agrees with the per-record rule
const lcg = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
function fuzzScope(r) {
  if (r() < 0.08) return { all: true };
  const grants = [];
  for (const a of [RIY, MAK, EAST]) if (r() < 0.55) { const pool = municipalitiesOf(a).map((m) => m.refId); grants.push(grant(a, r() < 0.3 ? 'all' : pool.filter(() => r() < 0.4), r() < 0.4, r() < 0.4)); }
  return normalizeGeoScope({ all: false, grants, nonMunicipal: r() < 0.3 });
}
function fuzzRecords() {
  const recs = [REC('Housing Sector', 'not_specified', null, true)];
  for (const a of [RIY, MAK, EAST, 'Asir Amanah']) { for (const st of ['direct_amanah', 'not_specified', 'unmapped_source_value', 'conflict']) recs.push(REC(a, st)); for (const m of municipalitiesOf(a)) recs.push(REC(a, 'mapped', m.refId)); }
  return recs;
}
ok('fuzz: allows(intersect) = allows(a) && allows(b); allows(union) = allows(a) || allows(b); intersect ⊆ a,b ⊆ union; subset agrees with record sets; the matcher equals the rule', () => {
  const r = lcg(7); const recs = fuzzRecords();
  for (let i = 0; i < 300; i++) {
    const a = fuzzScope(r); const b = fuzzScope(r); const I = intersectGeoScopes(a, b); const U = unionGeoScopes(a, b);
    const mi = geoScopeMatcher(I);
    for (const rec of recs) {
      const x = geoScopeAllowsRecord(a, rec); const y = geoScopeAllowsRecord(b, rec);
      assert.equal(geoScopeAllowsRecord(I, rec), x && y); assert.equal(geoScopeAllowsRecord(U, rec), x || y);
      assert.equal(mi.allows(rec.amanah, rec.municipalityStatus, rec.municipalityRefId, rec.nonMunicipal), x && y);
    }
    assert.ok(geoScopeSubset(I, a) && geoScopeSubset(I, b) && geoScopeSubset(a, U) && geoScopeSubset(b, U));
    if (geoScopeSubset(a, b)) for (const rec of recs) assert.ok(!geoScopeAllowsRecord(a, rec) || geoScopeAllowsRecord(b, rec));
    assert.equal(geoScopeKey(unionGeoScopes(a, b)), geoScopeKey(unionGeoScopes(b, a))); assert.equal(geoScopeKey(I), geoScopeKey(intersectGeoScopes(b, a)));
  }
});
ok('subset / intersect / union specifics: an organisation narrowing never expands; a municipality list covering the whole Amanah equals «all»', () => {
  const org = geoScopeFromAmanahKeys([RIY]); const few = scopeOf([grant(RIY, [riyRefs[0]])]);
  assert.deepEqual(intersectGeoScopes(few, org), few); assert.ok(geoScopeSubset(few, org) && !geoScopeSubset(org, few));
  assert.ok(isEmptyGeoScope(intersectGeoScopes(scopeOf([grant(MAK, 'all')]), org)));
  assert.deepEqual(intersectGeoScopes(ALL_SCOPE, few), few); assert.deepEqual(intersectGeoScopes(few, ALL_SCOPE), few);
  assert.equal(geoScopeFromAmanahKeys(null).all, true); assert.deepEqual(geoScopeAmanahKeys(org), [RIY]); assert.equal(geoScopeAmanahKeys(ALL_SCOPE), null);
  assert.ok(geoScopeSubset(scopeOf([grant(RIY, 'all')]), scopeOf([grant(RIY, riyRefs)])));
  assert.ok(!geoScopeSubset(scopeOf([grant(RIY, 'all', true)]), scopeOf([grant(RIY, riyRefs)])));
  assert.ok(!geoScopeSubset(ALL_SCOPE, scopeOf([entireAmanahGrant(RIY)]))); assert.ok(geoScopeSubset(EMPTY_SCOPE, EMPTY_SCOPE));
  const u = unionGeoScopes(scopeOf([grant(RIY, [riyRefs[0]])]), scopeOf([grant(RIY, [riyRefs[1]], true)]));
  assert.deepEqual(u.grants[0].municipalities, [riyRefs[0], riyRefs[1]].sort()); assert.ok(u.grants[0].direct && !u.grants[0].notSpecified);
});
ok('describeGeoScope: «أمانتان · 5 بلديات», «كل الأمانات والبلديات», suffixes, counts and EN', () => {
  const two = scopeOf([grant(RIY, [riyRefs[0], riyRefs[1], riyRefs[2]]), grant(MAK, [makRefs[0], makRefs[1]])]);
  assert.equal(describeGeoScope(two, 'ar'), 'أمانتان · 5 بلديات'); assert.equal(describeGeoScope(two, 'en'), '2 Amanahs · 5 municipalities');
  assert.equal(describeGeoScope(ALL_SCOPE, 'ar'), 'كل الأمانات والبلديات'); assert.equal(describeGeoScope(ALL_SCOPE, 'en'), 'All Amanahs and municipalities');
  assert.equal(describeGeoScope(scopeOf([entireAmanahGrant(RIY)]), 'ar'), 'أمانة واحدة · كل البلديات + مباشر + غير محددة');
  assert.equal(describeGeoScope(scopeOf([entireAmanahGrant(RIY)]), 'en'), '1 Amanah · all municipalities + direct + not specified');
  assert.equal(describeGeoScope(scopeOf([grant(RIY, [riyRefs[0]], true)], true), 'ar'), 'أمانة واحدة · بلدية واحدة + مباشر + جهات غير بلدية');
  assert.equal(describeGeoScope(scopeOf([grant(RIY, [], true)]), 'en'), '1 Amanah + direct');
  assert.equal(describeGeoScope(scopeOf([], true), 'ar'), 'الجهات غير البلدية فقط'); assert.equal(describeGeoScope(EMPTY_SCOPE, 'en'), 'No geographic access');
  assert.ok(describeGeoScope(scopeOf(AMANAH_KEYS.slice(0, 12).map((a) => grant(a, 'all'))), 'ar').startsWith('12 أمانة'));
  assert.ok(describeGeoScope(scopeOf(AMANAH_KEYS.slice(0, 5).map((a) => grant(a, 'all'))), 'ar').startsWith('5 أمانات'));
});
ok('geoScopeKey is stable and discriminating; long scopes are hashed', () => {
  const a = scopeOf([grant(MAK, [makRefs[1], makRefs[0]]), grant(RIY, 'all', true)]); const b = scopeOf([grant(RIY, 'all', true), grant(MAK, [makRefs[0], makRefs[1]])]);
  assert.equal(geoScopeKey(a), geoScopeKey(b)); assert.notEqual(geoScopeKey(a), geoScopeKey(scopeOf([grant(RIY, 'all')]))); assert.equal(geoScopeKey(ALL_SCOPE), 'ALL');
  assert.notEqual(geoScopeKey(scopeOf([grant(RIY, 'all', true)])), geoScopeKey(scopeOf([grant(RIY, 'all', false, true)])));
  assert.notEqual(geoScopeKey(scopeOf([], true)), geoScopeKey(EMPTY_SCOPE));
  const big = scopeOf([grant(RIY, riyRefs.slice(0, 40)), grant(MAK, 'all')]); assert.ok(geoScopeKey(big).length < 60 && geoScopeKey(big).startsWith('G#'));
});


/* ------------------------------------------------------------------ 3. identity: store, sessions, admin API */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iim-identity-test-'));
const FILE = path.join(tmp, 'identity.json');
resetForTests(FILE);
const TRANSCRIPT = []; // every raw response (for the no-secret scan)
async function call(method, p, body, token) {
  const [pathname, qs] = p.split('?');
  const req = { method, url: `/api${p}`, headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  let status = 0; let text = '';
  const res = { writeHead(c) { status = c; }, end(t) { text = t; } };
  const handled = await handleIdentityRoute(req, res, pathname, body || {}, {});
  if (!handled) return { handled: false };
  let json = null; try { json = JSON.parse(text); } catch { json = null; }
  TRANSCRIPT.push(json && json.activation ? text.split(json.activation.code).join('') : text); // the one response that hands the administrator a code is scanned without that code
  return { handled, status, json, text, qs };
}
const login = async (username, password, orgId) => call('POST', '/auth/login', { username, password, ...(orgId ? { orgId } : {}) });
const tokenOf = async (u, pw) => { const r = await login(u, pw); assert.equal(r.status, 200, `${u} login ${r.text}`); return r.json.token; };
const PW = 'Tr1al-pass-Qx9'; const PW2 = 'An0ther-pass-Zk7';
const unique = new Set();
async function mkUser(adminToken, username, roleId, scope, extra = {}) {
  const r = await call('POST', '/admin/users', { username, nameAr: `مستخدم ${username}`, nameEn: `User ${username}`, roleId, scope, ...extra }, adminToken);
  assert.equal(r.status, 201, `create ${username}: ${r.text}`); unique.add(r.json.activation.code);
  const a = await call('POST', '/auth/activate', { code: r.json.activation.code, password: PW }); assert.equal(a.status, 200, a.text);
  return { id: r.json.user.id, token: a.json.token, me: a.json.me };
}
const mkRole = async (tok, nameEn, modules, extra = {}) => { const r = await call('POST', '/admin/roles', { nameAr: `دور ${nameEn}`, nameEn, modules, ...extra }, tok); assert.equal(r.status, 201, r.text); return r.json.role; };
let demo;

ok('migration on a fresh store: starter roles + the three seeded accounts (names preserved, demo/admin = Administrator all scope, auditor = Auditor read-only), schema version stored, one migration audit entry, ONE role + ONE scope per user', async () => {
  const db = getDb();
  assert.equal(db.schemaVersion, SCHEMA_VERSION); assert.equal(SCHEMA_VERSION, 2); assert.equal(db.roles.length, 5); assert.deepEqual(db.users.map((u) => u.username).sort(), ['admin', 'auditor', 'demo']);
  const byName = Object.fromEntries(db.users.map((u) => [u.username, u]));
  assert.equal(byName.demo.nameAr, 'Li Fangjun'); assert.equal(byName.demo.nameEn, 'Li Fangjun', 'ONE verified display name for the demo account, the same in both languages'); assert.equal(byName.demo.avatar, 'LF'); assert.equal(byName.auditor.nameAr, 'أحمد آل سعود'); assert.equal(byName.admin.titleEn, 'Platform Admin');
  assert.equal(byName.demo.roleId, ADMIN_ROLE_ID); assert.equal(byName.auditor.roleId, AUDITOR_ROLE_ID); assert.equal(byName.admin.roleId, ADMIN_ROLE_ID);
  for (const u of db.users) { assert.deepEqual(u.scope, { all: true }); assert.equal(u.status, 'active'); assert.ok(!('assignments' in u)); }
  for (const r of db.roles) { assert.ok(Array.isArray(r.modules) && !('permissions' in r) && typeof r.readOnly === 'boolean'); }
  assert.equal(db.roles.find((r) => r.id === AUDITOR_ROLE_ID).readOnly, true); assert.equal(db.roles.find((r) => r.id === ADMIN_ROLE_ID).protected, true);
  assert.equal(db.audit.filter((e) => e.action === 'migration').length, 1);
  assert.ok(fs.existsSync(FILE), 'the temp identity file was written'); assert.equal(storageInfo().mode, 'file'); assert.equal(dbFile(), FILE);
});
ok('login: seeded accounts with the demo passwords; wrong password / unknown user → 401 invalid_credentials; me payload per S2 (role, modules, permissions alias, scope, scopes, summary)', async () => {
  let r = await login('demo', 'demo123'); assert.equal(r.status, 200); demo = r.json.token;
  const me = r.json.me;
  assert.equal(me.username, 'demo'); assert.equal(me.nameAr, 'Li Fangjun'); assert.equal(me.avatar, 'LF'); assert.deepEqual(me.modules, MODULE_IDS); assert.deepEqual(me.permissions, me.modules); assert.deepEqual(me.role, { id: ADMIN_ROLE_ID, nameAr: 'مدير النظام', nameEn: 'Administrator', readOnly: false });
  assert.deepEqual(me.scope, { all: true }); assert.deepEqual(me.scopes.invoices_collected, { all: true }); assert.deepEqual(Object.keys(me.scopes), MODULE_IDS); assert.equal(me.scopeSummary.ar, 'كل الأمانات والبلديات'); assert.equal(typeof me.accessVersion, 'number'); assert.equal(me.readOnly, false);
  assert.equal(me.summary.en, 'Administrator · All Amanahs and municipalities'); assert.equal(me.summary.ar, 'مدير النظام · كل الأمانات والبلديات'); assert.ok(!('roles' in me) && !('assignments' in me));
  assert.ok(!('orgOptions' in me), 'the account carries no organisation / persona options');
  r = await login('auditor', 'demo123'); assert.equal(r.status, 200); assert.equal(r.json.me.readOnly, true); assert.equal(r.json.me.role.readOnly, true); assert.equal(r.json.me.role.nameEn, 'Auditor'); assert.equal(r.json.me.modules.length, 13);
  r = await login('admin', 'admin'); assert.equal(r.status, 200);
  r = await login('demo', 'wrong'); assert.equal(r.status, 401); assert.equal(r.json.error, 'invalid_credentials');
  r = await login('nobody', 'demo123'); assert.equal(r.status, 401); assert.equal(r.json.error, 'invalid_credentials');
  r = await login('', ''); assert.equal(r.status, 401);
  r = await login('DEMO ', 'demo123'); assert.equal(r.status, 200, 'the username is case-insensitive and trimmed');
});
ok('login takes the account only: a client-sent orgId is ignored (no org in the answer, no org_not_allowed), and the identity comes from the stored user', async () => {
  let r = await login('demo', 'demo123', 'riyadh'); assert.equal(r.status, 200); assert.ok(!('org' in r.json) && !('orgOptions' in r.json.me)); assert.deepEqual(r.json.me.scope, { all: true }, 'asking for an organisation never narrows or widens the account');
  r = await login('demo', 'demo123', 'atlantis'); assert.equal(r.status, 200);
});
ok('authenticate(req): Bearer token → { user, access, accessVersion }; no token / garbage / tampered / other-secret → null; access = { permissions:Set (modules), modules, scopes, role, readOnly, overallScope }', async () => {
  const a = authenticate({ headers: { authorization: `Bearer ${demo}` } });
  assert.ok(a && a.user.username === 'demo' && a.access.permissions instanceof Set && a.access.permissions.has('users') && typeof a.accessVersion === 'number');
  assert.deepEqual(a.access.modules, MODULE_IDS); assert.equal(a.access.role.id, ADMIN_ROLE_ID); assert.equal(a.access.readOnly, false); assert.deepEqual(a.access.overallScope, { all: true });
  assert.ok(!('credential' in a.user) && !('tokenVersion' in a.user)); assert.deepEqual(effectiveScopeFor(a.access, 'invoices_collected'), { all: true });
  assert.equal(authenticate({ headers: {} }), null); assert.equal(authenticate({ headers: { authorization: 'Bearer nonsense' } }), null); assert.equal(authenticate({ headers: { authorization: demo } }), null);
  const [body, sig] = demo.split('.'); const flip = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA');
  assert.equal(authenticate({ headers: { authorization: `Bearer ${body}.${flip}` } }), null);
  const forged = Buffer.from(JSON.stringify({ uid: 'usr-demo', tv: 1, exp: Date.now() + 1e9 })).toString('base64url'); assert.equal(authenticate({ headers: { authorization: `Bearer ${forged}.${sig}` } }), null);
  assert.deepEqual(effectiveScopeFor(a.access, 'nope'), EMPTY_SCOPE);
  const aud = authenticate({ headers: { authorization: `Bearer ${await tokenOf('auditor', 'demo123')}` } }); assert.equal(aud.access.readOnly, true);
});
ok('token expiry: an expired token is refused (clock moved past the session length)', async () => {
  const t = await tokenOf('auditor', 'demo123'); assert.ok(authenticate({ headers: { authorization: `Bearer ${t}` } }));
  setClockForTests(() => Date.now() + 13 * 3600e3); try { assert.equal(authenticate({ headers: { authorization: `Bearer ${t}` } }), null); } finally { setClockForTests(null); }
  assert.ok(authenticate({ headers: { authorization: `Bearer ${t}` } }));
});
ok('GET /auth/me re-evaluates live; no token → 401 unauthenticated; logout answers ok', async () => {
  let r = await call('GET', '/auth/me', null, demo); assert.equal(r.status, 200); assert.equal(r.json.me.id, 'usr-demo');
  r = await call('GET', '/auth/me'); assert.equal(r.status, 401); assert.equal(r.json.error, 'unauthenticated');
  r = await call('POST', '/auth/logout', {}, demo); assert.equal(r.status, 200);
  r = await call('GET', '/nothing-here'); assert.equal(r.handled, false); r = await call('POST', '/admin/preview', {}, demo); assert.equal(r.handled, false, '/admin/preview is answered by api.js');
});
ok('/admin routes need authentication and the matching module; the read-only Auditor can view users, roles and the audit but every write is 403 read_only_role; a role without the module is 403 forbidden', async () => {
  let r = await call('GET', '/admin/users'); assert.equal(r.status, 401);
  const aud = await tokenOf('auditor', 'demo123');
  r = await call('GET', '/admin/users', null, aud); assert.equal(r.status, 200);
  r = await call('POST', '/admin/users', { username: 'x1x', nameEn: 'X', roleId: 'role-collection', scope: ALL_SCOPE }, aud); assert.equal(r.status, 403); assert.deepEqual(r.json, { error: 'read_only_role' });
  r = await call('GET', '/admin/audit', null, aud); assert.equal(r.status, 200); r = await call('GET', '/admin/roles', null, aud); assert.equal(r.status, 200);
  r = await call('POST', '/admin/roles', { nameAr: 'ص', nameEn: 'S', modules: ['invoices_collected'] }, aud); assert.equal(r.status, 403); assert.equal(r.json.error, 'read_only_role');
  r = await call('PATCH', '/admin/users/usr-demo', { nameEn: 'x' }, aud); assert.equal(r.status, 403); assert.equal(r.json.error, 'read_only_role');
  r = await call('POST', '/admin/users/usr-demo/activation', null, aud); assert.equal(r.status, 403); assert.equal(r.json.error, 'read_only_role');
  r = await call('DELETE', '/admin/roles/role-collection', null, aud); assert.equal(r.status, 403); assert.equal(r.json.error, 'read_only_role');
  assert.ok(getDb().audit.some((e) => e.action === 'access_denied' && e.actorId === 'usr-auditor' && /read_only/.test(JSON.stringify(e.after || {}))), 'a refused write is audited');
  const co = await mkUser(demo, 'plain1', 'role-collection', ALL_SCOPE);
  for (const [m, p, b] of [['GET', '/admin/users'], ['GET', '/admin/roles'], ['GET', '/admin/audit'], ['GET', '/admin/catalog'], ['POST', '/admin/users', { username: 'zzz', roleId: 'role-collection', scope: ALL_SCOPE }], ['POST', '/admin/roles', { nameAr: 'ص', nameEn: 'S', modules: ['metrics'] }]]) {
    r = await call(m, p, b || null, co.token); assert.equal(r.status, 403, `${m} ${p}`); assert.equal(r.json.error, 'forbidden');
  }
  assert.equal((await call('GET', '/admin/users', null, co.token)).json.permission, 'users');
  assert.ok(getDb().audit.some((e) => e.action === 'access_denied' && e.actorId === co.id), 'a denied privilege attempt is audited');
});
ok('GET /admin/catalog: the 13 modules (with routes), the starter roles (modules + readOnly) and the hierarchy for the pickers (17 Amanahs with municipalities)', async () => {
  const r = await call('GET', '/admin/catalog', null, demo); assert.equal(r.status, 200); const c = r.json;
  assert.deepEqual(c.modules.map((m) => m.id), MODULE_IDS); assert.ok(c.modules.every((m) => m.nameAr && m.nameEn && Array.isArray(m.routes) && m.descriptionAr && m.group)); assert.ok(!('permissions' in c));
  assert.equal(c.starterRoles.length, 5); assert.ok(c.starterRoles.every((s) => Array.isArray(s.modules) && typeof s.readOnly === 'boolean')); assert.equal(c.adminRoleId, ADMIN_ROLE_ID); assert.deepEqual(c.adminKeepModules, ['users', 'roles']);
  assert.equal(c.hierarchy.amanahs.length, 17);
  const riy = c.hierarchy.amanahs.find((a) => a.key === RIY); assert.equal(riy.municipalities.length, riyRefs.length); assert.ok(riy.nameAr && riy.nameEn && riy.municipalities.every((m) => m.ref && m.nameAr && 'nameEn' in m));
  assert.ok(c.hierarchy.nonMunicipalEntities.some((e) => e.key === 'Housing Sector')); assert.ok(['file', 'tmp', 'memory'].includes(c.storage.mode) && typeof c.storage.durable === 'boolean');
});

ok('create user (roleId + scope) → invited + one-time activation code; list row = { roleId, scope, summary, … }; activation single-use; login after activation', async () => {
  const scope = scopeOf([grant(RIY, [riyRefs[0], riyRefs[1], riyRefs[2]]), grant(MAK, [makRefs[0], makRefs[1]])]);
  let r = await call('POST', '/admin/users', { username: 'Analyst1', nameAr: 'محلل', nameEn: 'Analyst One', email: 'a1@example.test', roleId: 'role-financial', scope }, demo);
  assert.equal(r.status, 201, r.text); const code = r.json.activation.code; unique.add(code);
  assert.equal(r.json.user.status, 'invited'); assert.equal(r.json.user.username, 'analyst1'); assert.equal(r.json.user.roleId, 'role-financial'); assert.deepEqual(r.json.user.scope, normalizeGeoScope(scope));
  assert.equal(r.json.user.scopeSummary.ar, 'أمانتان · 5 بلديات'); assert.equal(r.json.user.summary.en, 'Financial Manager / Analyst · 2 Amanahs · 5 municipalities'); assert.equal(r.json.user.moduleCount, STARTER_ROLES.find((x) => x.id === 'role-financial').modules.length);
  assert.ok(!('assignments' in r.json.user));
  assert.ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)); assert.ok(r.json.activation.expiresAt);
  const id = r.json.user.id;
  let l = await login('analyst1', PW); assert.equal(l.status, 403); assert.equal(l.json.error, 'account_not_activated');
  l = await call('POST', '/auth/activate', { code: 'AAAA-BBBB-CCCC', password: PW }); assert.equal(l.status, 400); assert.equal(l.json.error, 'invalid_activation_code');
  l = await call('POST', '/auth/activate', { code, password: 'short' }); assert.equal(l.status, 400); assert.equal(l.json.error, 'validation_error'); assert.ok(l.json.fields[0].ar && l.json.fields[0].en);
  l = await call('POST', '/auth/activate', { code, password: PW }); assert.equal(l.status, 200, l.text); assert.equal(l.json.me.username, 'analyst1');
  l = await call('POST', '/auth/activate', { code, password: PW2 }); assert.equal(l.status, 400, 'a code works once'); assert.equal(l.json.error, 'invalid_activation_code');
  l = await login('analyst1', PW); assert.equal(l.status, 200); assert.equal(l.json.me.scopeSummary.en, '2 Amanahs · 5 municipalities'); assert.deepEqual(l.json.me.scopes.invoices_collected, normalizeGeoScope(scope)); assert.deepEqual(l.json.me.scope, normalizeGeoScope(scope));
  assert.equal(l.json.me.role.id, 'role-financial'); assert.ok(!l.json.me.modules.includes('users'));
  const list = await call('GET', '/admin/users', null, demo); const row = list.json.users.find((u) => u.id === id);
  assert.equal(row.status, 'active'); assert.ok(row.roleNameEn === 'Financial Manager / Analyst' && row.scopeSummary.ar && row.summary.ar.startsWith('مدير مالي / محلل')); assert.equal(row.activationPending, false);
  assert.ok(list.json.users.every((u) => !('credential' in u) && !('tokenVersion' in u)));
});
ok('activation codes expire; a re-issued code revokes the previous one; an inactive account cannot be re-invited', async () => {
  let r = await call('POST', '/admin/users', { username: 'expiry1', nameEn: 'Expiry', roleId: 'role-collection', scope: { all: true } }, demo); const first = r.json.activation.code; const id = r.json.user.id; unique.add(first);
  r = await call('POST', `/admin/users/${id}/activation`, null, demo); assert.equal(r.status, 200); const second = r.json.activation.code; unique.add(second); assert.notEqual(first, second);
  let a = await call('POST', '/auth/activate', { code: first, password: PW }); assert.equal(a.status, 400); assert.equal(a.json.error, 'invalid_activation_code');
  setClockForTests(() => Date.now() + 73 * 3600e3); try { a = await call('POST', '/auth/activate', { code: second, password: PW }); assert.equal(a.status, 400); assert.equal(a.json.error, 'activation_expired'); } finally { setClockForTests(null); }
  r = await call('PATCH', `/admin/users/${id}`, { status: 'inactive' }, demo); assert.equal(r.status, 200);
  r = await call('POST', `/admin/users/${id}/activation`, null, demo); assert.equal(r.status, 400); assert.equal(r.json.error, 'validation_error');
});
ok('scrypt: the same password hashes differently per user (random salt); algo recorded; verify works only for the right password', async () => {
  const u1 = await mkUser(demo, 'salt1', 'role-collection', ALL_SCOPE); const u2 = await mkUser(demo, 'salt2', 'role-collection', ALL_SCOPE);
  const c1 = getDb().users.find((u) => u.id === u1.id).credential; const c2 = getDb().users.find((u) => u.id === u2.id).credential;
  assert.notEqual(c1.hash, c2.hash); assert.notEqual(c1.salt, c2.salt); assert.ok(/^scrypt:/.test(c1.algo)); assert.ok(c1.hash.length >= 64);
  assert.equal((await login('salt1', PW)).status, 200); assert.equal((await login('salt1', PW2)).status, 401);
});
ok('deactivation kills the session on the NEXT request; reactivation needs a fresh login (tokenVersion bumped); inactive login → 403 account_inactive and is audited', async () => {
  const u = await mkUser(demo, 'deact1', 'role-collection', ALL_SCOPE);
  assert.ok(authenticate({ headers: { authorization: `Bearer ${u.token}` } }));
  const before = getDb().users.find((x) => x.id === u.id).tokenVersion;
  let r = await call('PATCH', `/admin/users/${u.id}`, { status: 'inactive' }, demo); assert.equal(r.status, 200); assert.equal(r.json.user.status, 'inactive');
  assert.equal(authenticate({ headers: { authorization: `Bearer ${u.token}` } }), null); assert.ok(getDb().users.find((x) => x.id === u.id).tokenVersion > before);
  r = await login('deact1', PW); assert.equal(r.status, 403); assert.equal(r.json.error, 'account_inactive'); assert.ok(getDb().audit.some((e) => e.action === 'login_denied' && e.targetId === u.id));
  r = await call('PATCH', `/admin/users/${u.id}`, { status: 'active' }, demo); assert.equal(r.json.user.status, 'active');
  assert.equal(authenticate({ headers: { authorization: `Bearer ${u.token}` } }), null, 'the old token stays dead'); assert.equal((await login('deact1', PW)).status, 200);
});
ok('a role / scope change applies on the NEXT request (live access) and ends the user\'s old token; a role edit (module off) applies at once; a password reset (activation) bumps tokenVersion', async () => {
  const u = await mkUser(demo, 'live1', 'role-collection', scopeOf([grant(RIY, 'all')]));
  const a1 = authenticate({ headers: { authorization: `Bearer ${u.token}` } }); assert.ok(a1.access.permissions.has('invoices_uncollected') && !a1.access.permissions.has('enforcement'));
  const r0 = await call('PATCH', `/admin/users/${u.id}`, { roleId: 'role-enforcement', scope: scopeOf([grant(MAK, 'all')]) }, demo); assert.equal(r0.status, 200, r0.text);
  assert.equal(authenticate({ headers: { authorization: `Bearer ${u.token}` } }), null);
  const t2 = await tokenOf('live1', PW); const a2 = authenticate({ headers: { authorization: `Bearer ${t2}` } }); assert.ok(a2.access.permissions.has('enforcement') && !a2.access.permissions.has('exclusions'));
  assert.deepEqual(geoScopeAmanahKeys(effectiveScopeFor(a2.access, 'enforcement')), [MAK]);
  const rl = await mkRole(demo, 'Live Role', ['invoices_collected', 'contracts']); const v = await mkUser(demo, 'live2', rl.id, ALL_SCOPE);
  assert.ok(authenticate({ headers: { authorization: `Bearer ${v.token}` } }).access.permissions.has('contracts'));
  await call('PATCH', `/admin/roles/${rl.id}`, { modules: ['invoices_collected'] }, demo);
  assert.ok(!authenticate({ headers: { authorization: `Bearer ${v.token}` } }).access.permissions.has('contracts'), 'a module switched off applies on the next request with the SAME token');
  await call('PATCH', `/admin/roles/${rl.id}`, { readOnly: true }, demo); assert.equal(authenticate({ headers: { authorization: `Bearer ${v.token}` } }).access.readOnly, true);
  const r = await call('POST', `/admin/users/${u.id}/activation`, null, demo); unique.add(r.json.activation.code);
  const act = await call('POST', '/auth/activate', { code: r.json.activation.code, password: PW2 }); assert.equal(act.status, 200);
  assert.equal(authenticate({ headers: { authorization: `Bearer ${t2}` } }), null); assert.equal((await login('live1', PW)).status, 401); assert.equal((await login('live1', PW2)).status, 200);
});
ok('ONE role + ONE scope: every module the role holds carries the same scope; modules not held have the EMPTY scope; an unknown role holds nothing; the preview resolves {roleId, scope}', async () => {
  const roles = getRoles(); const scope = scopeOf([grant(RIY, 'all')]);
  const access = computeAccess({ roleId: 'role-collection', scope }, roles);
  assert.deepEqual(access.modules, STARTER_ROLES.find((r) => r.id === 'role-collection').modules); assert.equal(access.role.id, 'role-collection'); assert.equal(access.readOnly, false);
  for (const m of access.modules) assert.deepEqual(geoScopeAmanahKeys(effectiveScopeFor(access, m)), [RIY], m);
  assert.deepEqual(effectiveScopeFor(access, 'users'), EMPTY_SCOPE, 'a module the role does not hold has no scope'); assert.deepEqual(effectiveScopeFor(access, 'nope'), EMPTY_SCOPE);
  assert.ok(!geoScopeAllowsRecord(effectiveScopeFor(access, 'invoices_collected'), REC(MAK, 'mapped', makRefs[0])));
  const none = computeAccess({ roleId: 'role-nope', scope }, roles); assert.equal(none.permissions.size, 0); assert.equal(none.role, null); assert.deepEqual(none.overallScope, EMPTY_SCOPE);
  const adm = computeAccess({ roleId: ADMIN_ROLE_ID, scope }, roles); assert.equal(adm.permissions.size, 13);
  assert.equal(describeAccess(access).scopes.invoices_collected.summary.en, '1 Amanah · all municipalities'); assert.deepEqual(describeAccess(access).modules, access.modules); assert.deepEqual(describeAccess(access).permissions, access.modules);
  assert.equal(describeAccess(access).role.id, 'role-collection');
  assert.equal(resolveAccess({ roleId: AUDITOR_ROLE_ID, scope: ALL_SCOPE }).permissions.size, 13); assert.equal(resolveAccess({ roleId: AUDITOR_ROLE_ID, scope: ALL_SCOPE }).readOnly, true);
  assert.equal(resolveAccess([{ roleId: AUDITOR_ROLE_ID, scope: ALL_SCOPE }]).permissions.size, 13, 'the earlier array shape still resolves (first element)');
  const u = await mkUser(demo, 'multi1', 'role-collection', scopeOf([grant(RIY, 'all')]));
  assert.deepEqual(geoScopeAmanahKeys(u.me.scopes.decisions), [RIY]); assert.equal(u.me.role.id, 'role-collection');
});
ok('validation: bad scope / role → validation_error with field paths and AR/EN messages (municipality not in the Amanah, unknown Amanah, unknown / missing role, missing / empty scope, username rules)', async () => {
  const post = (b) => call('POST', '/admin/users', b, demo);
  let r = await post({ username: 'val1', nameEn: 'V', roleId: 'role-collection', scope: scopeOf([grant(RIY, [makRefs[0]])]) });
  assert.equal(r.status, 400); assert.equal(r.json.error, 'validation_error'); const f = r.json.fields.find((x) => x.code === 'municipality_not_in_amanah'); assert.ok(f && f.ar && f.en && /^scope\.grants\[0\]/.test(f.field), JSON.stringify(f));
  r = await post({ username: 'val1', nameEn: 'V', roleId: 'role-collection', scope: scopeOf([grant('Atlantis', 'all')]) }); assert.ok(r.json.fields.some((x) => x.code === 'unknown_amanah'));
  r = await post({ username: 'val1', nameEn: 'V', roleId: 'role-nope', scope: ALL_SCOPE }); assert.ok(r.json.fields.some((x) => x.code === 'unknown_role' && x.field === 'roleId'));
  r = await post({ username: 'val1', nameEn: 'V', scope: ALL_SCOPE }); assert.ok(r.json.fields.some((x) => x.code === 'role_required'));
  r = await post({ username: 'val1', nameEn: 'V', roleId: 'role-collection' }); assert.ok(r.json.fields.some((x) => x.code === 'scope_required'));
  r = await post({ username: 'val1', nameEn: 'V', roleId: 'role-collection', scope: EMPTY_SCOPE }); assert.ok(r.json.fields.some((x) => x.code === 'scope_empty' && x.ar && x.en));
  r = await post({ username: 'val1', nameEn: 'V', roleId: 'role-collection', scope: scopeOf([], true) }); assert.equal(r.status, 201, 'non-municipal only is a valid scope'); unique.add(r.json.activation.code);
  r = await post({ username: 'a b', roleId: 'role-collection', scope: ALL_SCOPE }); const codes = r.json.fields.map((x) => x.code); assert.ok(codes.includes('username_invalid') && codes.includes('name_required'));
  r = await post({ username: 'demo', nameEn: 'Dup', roleId: 'role-collection', scope: ALL_SCOPE }); assert.ok(r.json.fields.some((x) => x.code === 'username_taken'));
  r = await post({ username: 'val2', nameEn: 'V', email: 'not-an-email', roleId: 'role-collection', scope: ALL_SCOPE }); assert.ok(r.json.fields.some((x) => x.code === 'email_invalid'));
  r = await call('PATCH', '/admin/users/usr-nope', { nameEn: 'x' }, demo); assert.equal(r.status, 404); assert.equal(r.json.error, 'not_found');
  r = await call('PATCH', '/admin/users/usr-auditor', { username: 'someoneelse' }, demo); assert.equal(r.status, 400);
  r = await call('PATCH', '/admin/users/usr-auditor', { status: 'invited' }, demo); assert.equal(r.status, 400);
  r = await call('PATCH', '/admin/users/usr-auditor', { roleId: 'role-nope' }, demo); assert.equal(r.status, 400);
});
ok('guard: the last active full administrator cannot be deactivated — by anyone, including themself; others can; nobody edits their OWN role or scope (403 self_elevation)', async () => {
  const boss = await mkUser(demo, 'boss1', ADMIN_ROLE_ID, ALL_SCOPE);
  let r = await call('PATCH', '/admin/users/usr-admin', { status: 'inactive' }, demo); assert.equal(r.status, 200, 'several administrators exist: one may go');
  r = await call('PATCH', '/admin/users/usr-demo', { status: 'inactive' }, boss.token); assert.equal(r.status, 200, 'boss1 remains');
  r = await call('PATCH', `/admin/users/${boss.id}`, { status: 'inactive' }, boss.token); assert.equal(r.status, 409); assert.equal(r.json.error, 'last_admin', 'the last administrator cannot deactivate themself');
  r = await call('PATCH', `/admin/users/${boss.id}`, { roleId: AUDITOR_ROLE_ID, scope: ALL_SCOPE }, boss.token); assert.equal(r.status, 403); assert.equal(r.json.error, 'self_elevation', 'not even a demotion of one\'s own role');
  r = await call('PATCH', `/admin/users/${boss.id}`, { scope: scopeOf([grant(RIY, 'all')]) }, boss.token); assert.equal(r.status, 403); assert.equal(r.json.error, 'self_elevation');
  r = await call('PATCH', `/admin/users/${boss.id}`, { nameEn: 'Boss Renamed' }, boss.token); assert.equal(r.status, 200, 'details are editable; only role / scope are locked');
  r = await call('PATCH', `/admin/users/${boss.id}`, { roleId: ADMIN_ROLE_ID, scope: ALL_SCOPE }, boss.token); assert.equal(r.status, 200, 'an unchanged role / scope is not an edit');
  assert.equal(authenticate({ headers: { authorization: `Bearer ${(await login('demo', 'demo123')).json?.token}` } }), null, 'the deactivated administrator is out');
  r = await call('PATCH', '/admin/users/usr-demo', { status: 'active' }, boss.token); assert.equal(r.status, 200); r = await call('PATCH', '/admin/users/usr-admin', { status: 'active' }, boss.token); assert.equal(r.status, 200);
  demo = await tokenOf('demo', 'demo123');
  r = await call('PATCH', `/admin/users/${boss.id}`, { status: 'inactive' }, demo); assert.equal(r.status, 200);
  assert.equal(getDb().audit.filter((e) => e.action === 'access_denied' && /last_admin/.test(JSON.stringify(e.after || {}))).length >= 1, true);
  assert.equal(getDb().audit.filter((e) => e.action === 'access_denied' && /self_elevation/.test(JSON.stringify(e.after || {}))).length >= 1, true);
});
ok('guard: a delegate (custom role with the users module) cannot change their own role or scope, but can edit their details; and cannot widen a role they hold', async () => {
  const del = await mkRole(demo, 'Delegate', ['users', 'invoices_collected']);
  const d = await mkUser(demo, 'delegate1', del.id, scopeOf([grant(RIY, [riyRefs[0], riyRefs[1], riyRefs[2]])]));
  let r = await call('PATCH', `/admin/users/${d.id}`, { scope: ALL_SCOPE }, d.token); assert.equal(r.status, 403); assert.equal(r.json.error, 'self_elevation');
  r = await call('PATCH', `/admin/users/${d.id}`, { roleId: 'role-system-admin' }, d.token); assert.equal(r.status, 403); assert.equal(r.json.error, 'self_elevation');
  r = await call('PATCH', `/admin/users/${d.id}`, { scope: scopeOf([grant(RIY, [riyRefs[0]])]) }, d.token); assert.equal(r.status, 403, 'narrowing one\'s own scope is an edit of one\'s own scope too'); assert.equal(r.json.error, 'self_elevation');
  r = await call('PATCH', `/admin/users/${d.id}`, { nameEn: 'Renamed Delegate' }, d.token); assert.equal(r.status, 200);
  const rk = await mkRole(demo, 'Role Keeper', ['roles', 'invoices_collected']); const keeper = await mkUser(demo, 'keeper1', rk.id, scopeOf([grant(RIY, 'all')]));
  r = await call('PATCH', `/admin/roles/${rk.id}`, { modules: ['roles', 'invoices_collected', 'contracts'] }, keeper.token); assert.equal(r.status, 403); assert.equal(r.json.error, 'forbidden', 'cannot add a module they do not hold');
  r = await call('PATCH', `/admin/roles/${rk.id}`, { descriptionEn: 'edited' }, keeper.token); assert.equal(r.status, 200);
  r = await call('PATCH', `/admin/roles/${rk.id}`, { modules: ['roles'] }, keeper.token); assert.equal(r.status, 200, 'removing modules from the role one holds is allowed');
  const rk2 = await mkRole(demo, 'Role Keeper 2', ['roles', 'invoices_collected'], { readOnly: false }); const k2 = await mkUser(demo, 'keeper2', rk2.id, ALL_SCOPE);
  await call('PATCH', `/admin/roles/${rk2.id}`, { readOnly: true }, demo); const k2tok = await tokenOf('keeper2', PW); void k2;
  r = await call('PATCH', `/admin/roles/${rk2.id}`, { readOnly: false }, k2tok); assert.equal(r.status, 403); assert.equal(r.json.error, 'read_only_role', 'a read-only role cannot switch itself back to writable');
});
ok('guard: a non-administrator delegates only what is ⊆ their own modules AND scope; cannot touch users above them; cannot grant the Administrator role', async () => {
  const rr = (await call('GET', '/admin/roles', null, demo)).json.roles.find((x) => x.nameEn === 'Delegate');
  const dId = getDb().users.find((u) => u.username === 'delegate1').id;
  const tok = await tokenOf('delegate1', PW); void dId;
  const mk = (extra) => call('POST', '/admin/users', { username: `kid${Math.random().toString(36).slice(2, 8)}`, nameEn: 'Kid', ...extra }, tok);
  let r = await mk({ roleId: rr.id, scope: scopeOf([grant(RIY, [riyRefs[0], riyRefs[1]])]) }); assert.equal(r.status, 201, r.text); unique.add(r.json.activation.code);
  r = await mk({ roleId: rr.id, scope: scopeOf([grant(RIY, [riyRefs[3]])]) }); assert.equal(r.status, 403); assert.equal(r.json.reason, 'delegation');
  r = await mk({ roleId: rr.id, scope: scopeOf([grant(RIY, [riyRefs[0]], true)]) }); assert.equal(r.status, 403, 'direct is not implied by the municipalities');
  r = await mk({ roleId: rr.id, scope: scopeOf([grant(MAK, 'all')]) }); assert.equal(r.status, 403);
  r = await mk({ roleId: 'role-system-admin', scope: scopeOf([grant(RIY, [riyRefs[0]])]) }); assert.equal(r.status, 403);
  r = await mk({ roleId: 'role-financial', scope: scopeOf([grant(RIY, [riyRefs[0]])]) }); assert.equal(r.status, 403, 'a role holding modules the delegate lacks');
  r = await call('PATCH', '/admin/users/usr-auditor', { status: 'inactive' }, tok); assert.equal(r.status, 403, 'cannot touch a user whose access is above their own');
  r = await call('PATCH', '/admin/users/usr-demo', { nameEn: 'x' }, tok); assert.equal(r.status, 403);
  r = await call('POST', '/admin/users/usr-demo/activation', null, tok); assert.equal(r.status, 403);
  r = await call('POST', '/admin/roles', { nameAr: 'تجاوز', nameEn: 'Overreach', modules: ['metrics'] }, tok); assert.equal(r.status, 403, 'no roles module');
});
ok('roles: create / update / delete with validation; readOnly flag; protected Administrator keeps users + roles and is never read-only; a role in use cannot be deleted; unique names; AR + EN messages', async () => {
  let r = await call('POST', '/admin/roles', { nameAr: 'مراجع تصدير', nameEn: 'Export Reviewer', descriptionAr: 'وصف', descriptionEn: 'desc', modules: ['contracts', 'invoices_collected', 'contracts'], readOnly: true }, demo);
  assert.equal(r.status, 201); assert.deepEqual(r.json.role.modules, ['invoices_collected', 'contracts']); assert.equal(r.json.role.starter, false); assert.equal(r.json.role.readOnly, true); assert.equal(r.json.role.protected, false); assert.equal(r.json.role.moduleCount, 2); assert.equal(r.json.role.userCount, 0); assert.ok(!('permissions' in r.json.role)); const id = r.json.role.id;
  r = await call('POST', '/admin/roles', { nameAr: 'مراجع تصدير', nameEn: 'Other', modules: ['metrics'] }, demo); assert.ok(r.json.fields.some((f) => f.code === 'name_taken'));
  r = await call('POST', '/admin/roles', { nameAr: '', nameEn: 'X', modules: ['bogus_module'] }, demo); assert.equal(r.status, 400); assert.ok(r.json.fields.some((f) => f.code === 'unknown_module' && f.ar && f.en) && r.json.fields.some((f) => f.code === 'name_required'));
  r = await call('POST', '/admin/roles', { nameAr: 'فارغ', nameEn: 'Empty', modules: [] }, demo); assert.ok(r.json.fields.some((f) => f.code === 'modules_required'));
  r = await call('POST', '/admin/roles', { nameAr: 'ع', nameEn: 'Bad RO', modules: ['metrics'], readOnly: 'yes' }, demo); assert.ok(r.json.fields.some((f) => f.code === 'read_only_invalid'));
  r = await call('POST', '/admin/roles', { nameAr: 'عادي', nameEn: 'Writable Default', modules: ['metrics'] }, demo); assert.equal(r.json.role.readOnly, false, 'read-only defaults to OFF'); await call('DELETE', `/admin/roles/${r.json.role.id}`, null, demo);
  r = await call('PATCH', `/admin/roles/${id}`, { modules: ['invoices_uncollected'], readOnly: false }, demo); assert.deepEqual(r.json.role.modules, ['invoices_uncollected']); assert.equal(r.json.role.readOnly, false);
  r = await call('PATCH', '/admin/roles/role-system-admin', { modules: MODULE_IDS.filter((m) => m !== 'roles') }, demo); assert.equal(r.status, 403); assert.equal(r.json.reason, 'protected_role');
  r = await call('PATCH', '/admin/roles/role-system-admin', { modules: MODULE_IDS.filter((m) => m !== 'users') }, demo); assert.equal(r.status, 403);
  r = await call('PATCH', '/admin/roles/role-system-admin', { readOnly: true }, demo); assert.equal(r.status, 403); assert.equal(r.json.reason, 'protected_role');
  r = await call('PATCH', '/admin/roles/role-system-admin', { nameEn: 'Administrator (renamed)' }, demo); assert.equal(r.status, 200); await call('PATCH', '/admin/roles/role-system-admin', { nameEn: 'Administrator' }, demo);
  r = await call('PATCH', '/admin/roles/role-system-admin', { modules: MODULE_IDS.filter((m) => m !== 'planning') }, demo); assert.equal(r.status, 200, 'other modules of the Administrator may be switched off'); await call('PATCH', '/admin/roles/role-system-admin', { modules: MODULE_IDS }, demo);
  r = await call('DELETE', '/admin/roles/role-system-admin', null, demo); assert.equal(r.status, 403);
  r = await call('DELETE', '/admin/roles/role-auditor', null, demo); assert.equal(r.status, 409); assert.equal(r.json.error, 'role_in_use'); assert.ok(r.json.users >= 1);
  r = await call('DELETE', `/admin/roles/${id}`, null, demo); assert.equal(r.status, 200); r = await call('DELETE', `/admin/roles/${id}`, null, demo); assert.equal(r.status, 404);
  r = await call('GET', '/admin/roles', null, demo); assert.ok(r.json.roles.every((x) => typeof x.userCount === 'number' && typeof x.moduleCount === 'number' && Array.isArray(x.modules) && typeof x.readOnly === 'boolean'));
});
ok('the read-only switch is per role and travels to every user of it: me.readOnly / me.role.readOnly, admin writes refused, reads and the audit allowed', async () => {
  const ro = await mkRole(demo, 'Read Only Admin', ['users', 'roles', 'invoices_collected'], { readOnly: true });
  const u = await mkUser(demo, 'reader1', ro.id, ALL_SCOPE); assert.equal(u.me.readOnly, true); assert.equal(u.me.role.readOnly, true);
  assert.equal((await call('GET', '/admin/users', null, u.token)).status, 200); assert.equal((await call('GET', '/admin/audit', null, u.token)).status, 200);
  const r = await call('PATCH', `/admin/users/${u.id}`, { nameEn: 'x' }, u.token); assert.equal(r.status, 403); assert.equal(r.json.error, 'read_only_role');
});
ok('audit trail: user / role / status / role+scope changes recorded newest-first with actor, target and AR+EN summaries; filterable; never carries a secret', async () => {
  const r = await call('GET', '/admin/audit?limit=500', null, demo); assert.equal(r.status, 200); const acts = new Set(r.json.entries.map((e) => e.action));
  for (const a of ['migration', 'user_create', 'user_status', 'user_assignments', 'role_create', 'role_update', 'role_delete', 'access_denied', 'user_activated', 'activation_issued', 'login_denied']) assert.ok(acts.has(a), a);
  const e = r.json.entries[0]; assert.ok(e.id && e.at && e.actorId && e.actorName && e.action && e.targetType && e.targetId && e.summary && e.summaryEn);
  assert.ok(r.json.entries.every((x, i, a) => i === 0 || a[i - 1].at >= x.at));
  const f = await call('GET', '/admin/audit?action=role_create&limit=5', null, demo); assert.ok(f.json.entries.length > 0 && f.json.entries.every((x) => x.action === 'role_create'));
  const sc = r.json.entries.find((x) => x.action === 'user_assignments'); assert.ok(sc.before && sc.after && sc.after.roleId && /Amanah|municipal|All/.test(JSON.stringify(sc.after)));
  const ru = r.json.entries.find((x) => x.action === 'role_update'); assert.ok(Array.isArray(ru.after.modules) && typeof ru.after.readOnly === 'boolean');
});
ok('persistence: reloading the file keeps users, roles, audit and the signing key (tokens survive a restart); the migration is idempotent', async () => {
  const tok = await tokenOf('demo', 'demo123'); const before = JSON.parse(JSON.stringify({ u: getDb().users.length, r: getDb().roles.length, a: getDb().audit.length, v: getDb().schemaVersion }));
  const db = reloadFromDisk();
  assert.equal(db.users.length, before.u); assert.equal(db.roles.length, before.r); assert.equal(db.audit.length, before.a); assert.equal(db.schemaVersion, before.v);
  assert.ok(authenticate({ headers: { authorization: `Bearer ${tok}` } }), 'the same token verifies after the reload');
  assert.equal(migrate(db), false, 're-running the migration on a current document changes nothing');
  assert.equal(db.audit.filter((e) => e.action === 'migration').length, 1);
});
ok('migration on a version bump keeps edits: an edited role, an added user, the audit trail and credentials survive; missing starter roles / accounts are restored; the Administrator regains users + roles', async () => {
  const dbA = getDb(); const edited = dbA.roles.find((r) => r.id === 'role-collection'); edited.nameEn = 'Collections (edited)'; edited.modules = ['invoices_collected']; // simulate an admin edit
  const adm = dbA.roles.find((r) => r.id === 'role-system-admin'); adm.modules = adm.modules.filter((m) => m !== 'roles'); adm.readOnly = true; // damage the protected role
  dbA.roles = dbA.roles.filter((r) => r.id !== 'role-enforcement'); const users = dbA.users.length; const audits = dbA.audit.length; const hashDemo = dbA.users.find((u) => u.username === 'demo').credential.hash;
  dbA.schemaVersion = 0; const changed = migrate(dbA);
  assert.ok(changed); assert.equal(dbA.schemaVersion, SCHEMA_VERSION);
  assert.equal(dbA.roles.find((r) => r.id === 'role-collection').nameEn, 'Collections (edited)'); assert.deepEqual(dbA.roles.find((r) => r.id === 'role-collection').modules, ['invoices_collected']);
  assert.ok(dbA.roles.some((r) => r.id === 'role-enforcement'), 'a missing starter role is restored on a version bump'); assert.ok(dbA.roles.find((r) => r.id === 'role-system-admin').modules.includes('roles') && !dbA.roles.find((r) => r.id === 'role-system-admin').readOnly);
  assert.equal(dbA.users.length, users, 'no user added or replaced'); assert.ok(dbA.audit.length === audits + 1 && dbA.audit.slice(-1)[0].action === 'migration'); assert.equal(dbA.users.find((u) => u.username === 'demo').credential.hash, hashDemo);
  dbA.roles.find((r) => r.id === 'role-collection').nameEn = 'Collection Officer'; dbA.roles.find((r) => r.id === 'role-collection').modules = STARTER_ROLES.find((r) => r.id === 'role-collection').modules;
});

/* ---- schema 1 → 2: the conversion of an OLD store (32 action permissions, several assignments per user) ---- */
const OLD_VIEWS = ['dashboard.view', 'invoices.view', 'collection.view', 'exclusions.view', 'contracts.view', 'enforcement.view', 'planning.view', 'decisions.view', 'reports.view', 'sources.view', 'metrics.view', 'users.view', 'roles.view', 'audit.view'];
const OLD_ALL = [...OLD_VIEWS, 'dashboard.export', 'invoices.export', 'invoices.documents', 'collection.export', 'exclusions.export', 'exclusions.upload', 'exclusions.manage', 'contracts.export', 'enforcement.export', 'enforcement.upload', 'enforcement.review', 'planning.update', 'planning.export', 'decisions.followup', 'reports.export', 'data.upload', 'users.manage', 'roles.manage'];
const OLD_FIN = ['dashboard.view', 'dashboard.export', 'invoices.view', 'invoices.export', 'invoices.documents', 'collection.view', 'collection.export', 'exclusions.view', 'exclusions.export', 'exclusions.upload', 'exclusions.manage', 'contracts.view', 'contracts.export', 'enforcement.view', 'enforcement.export', 'planning.view', 'planning.update', 'planning.export', 'decisions.view', 'decisions.followup', 'reports.view', 'reports.export', 'sources.view', 'data.upload', 'metrics.view'];
const OLD_COL = ['dashboard.view', 'invoices.view', 'invoices.export', 'invoices.documents', 'collection.view', 'collection.export', 'exclusions.view', 'contracts.view', 'enforcement.view', 'decisions.view', 'decisions.followup', 'reports.view', 'sources.view', 'metrics.view'];
const OLD_ENF = ['invoices.view', 'invoices.documents', 'collection.view', 'contracts.view', 'enforcement.view', 'enforcement.export', 'enforcement.upload', 'enforcement.review', 'decisions.view', 'reports.view', 'sources.view', 'metrics.view'];
const oldRole = (id, nameAr, nameEn, permissions, protectedRole = false) => ({ id, nameAr, nameEn, descriptionAr: 'وصف قديم', descriptionEn: 'old description', permissions, starter: true, protected: protectedRole, createdAt: '2026-11-06T08:00:00.000Z', updatedAt: '2026-11-06T08:00:00.000Z' });
const oldUser = (id, username, assignments, extra = {}) => ({ id, username, email: null, nameAr: `م ${username}`, nameEn: `U ${username}`, avatar: 'XX', titleAr: null, titleEn: null, status: 'active', assignments: assignments.map(([roleId, scope], i) => ({ id: `asg-${id}-${i}`, roleId, scope })), tokenVersion: 3, createdAt: '2026-11-06T08:00:00.000Z', createdBy: 'migration', updatedAt: '2026-11-06T08:00:00.000Z', lastLoginAt: null, credential: { algo: 'scrypt:1024:8:1', salt: 'c2FsdA', hash: 'aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g' }, ...extra });
const oldStore = () => ({
  schemaVersion: 1, accessVersion: 13, secret: 'c2VjcmV0LXNlY3JldA', activations: [],
  roles: [oldRole('role-system-admin', 'مدير النظام', 'System Administrator', OLD_ALL, true), oldRole('role-financial', 'مدير مالي / محلل', 'Financial Manager / Analyst', OLD_FIN), oldRole('role-collection', 'مسؤول التحصيل', 'Collection Officer', OLD_COL),
    oldRole('role-enforcement', 'مراجع التنفيذ', 'Enforcement Reviewer', OLD_ENF), oldRole('role-auditor', 'مدقق للقراءة فقط', 'Read-only Auditor', OLD_VIEWS), { ...oldRole('role-custom-x', 'مخصص', 'Custom X', ['invoices.view', 'invoices.export', 'collection.view']), starter: false }],
  users: [oldUser('usr-demo', 'demo', [['role-system-admin', ALL_SCOPE]]), oldUser('usr-auditor', 'auditor', [['role-auditor', ALL_SCOPE]]), oldUser('usr-admin', 'admin', [['role-system-admin', ALL_SCOPE]]),
    oldUser('usr-multi', 'multi', [['role-collection', scopeOf([grant(RIY, 'all')])], ['role-enforcement', scopeOf([grant(MAK, 'all')])], ['role-auditor', ALL_SCOPE]]),
    oldUser('usr-single', 'single', [['role-financial', scopeOf([grant(RIY, [riyRefs[0], riyRefs[1]])])]]), oldUser('usr-gone1', 'gone1', [['role-collection', scopeOf([grant(MAK, [makRefs[0]])])]], { status: 'inactive' }),
    oldUser('usr-gone2', 'gone2', [['role-financial', ALL_SCOPE]], { status: 'inactive' }), oldUser('usr-custom', 'custom', [['role-custom-x', ALL_SCOPE]])],
  audit: [{ id: 'aud-1', at: '2026-11-06T08:00:00.000Z', actorId: 'migration', actorName: 'ترحيل النظام', actorNameEn: 'System migration', action: 'migration', targetType: 'session', targetId: 'schema-v1', summary: 'ترحيل', summaryEn: 'migrated', after: { roles: [], users: [] } },
    { id: 'aud-2', at: '2026-11-06T09:00:00.000Z', actorId: 'usr-demo', actorName: 'طارق', actorNameEn: 'Li Fangjun', action: 'user_create', targetType: 'user', targetId: 'usr-multi', summary: 'إنشاء', summaryEn: 'created' }]
});
ok('migration 1 → 2 (S5): old roles → modules + readOnly; the old auditor becomes the read-only Auditor; the Administrator keeps all 13; a view-only module gain is recorded; names of unedited starter roles updated', () => {
  const m = mapOldRole(oldRole('x', 'a', 'b', OLD_COL)); assert.equal(m.readOnly, false); assert.deepEqual(m.modules, ['dashboard', 'invoices_collected', 'invoices_uncollected', 'enforcement', 'exclusions', 'contracts', 'smart_reports', 'decisions', 'data_sources', 'metrics']);
  assert.deepEqual(m.widened, ['enforcement', 'exclusions', 'data_sources'], 'modules whose pages the role could view but whose write actions it did not hold');
  assert.deepEqual(mapOldRole(oldRole('x', 'a', 'b', OLD_VIEWS)).readOnly, true); assert.deepEqual(mapOldRole(oldRole('x', 'a', 'b', OLD_VIEWS)).modules, MODULE_IDS, 'users.view → users; roles.view / audit.view → roles');
  assert.deepEqual(mapOldRole(oldRole('x', 'a', 'b', ['invoices.export'])).modules, ['invoices_collected', 'invoices_uncollected']); assert.deepEqual(mapOldRole(oldRole('x', 'a', 'b', ['collection.view'])).modules, ['invoices_uncollected']);
  assert.deepEqual(mapOldRole(oldRole('x', 'a', 'b', ['reports.view', 'sources.view', 'data.upload'])).modules, ['smart_reports', 'data_sources']); assert.deepEqual(mapOldRole(oldRole('x', 'a', 'b', OLD_ALL)).modules, MODULE_IDS);
  assert.equal(mapOldRole(oldRole('x', 'a', 'b', ['decisions.view', 'decisions.followup'])).readOnly, false); assert.equal(mapOldRole(oldRole('x', 'a', 'b', ['audit.view'])).readOnly, true);
});
ok('migration 1 → 2 on a stored OLD document: users keep ONE role + ONE scope (the first assignment), the dropped assignments are listed in the audit trail, demo / admin stay Administrator all-scope, deactivated accounts and the audit history are preserved, idempotent', () => {
  const db = oldStore(); const hashes = Object.fromEntries(db.users.map((u) => [u.username, u.credential.hash]));
  assert.equal(migrate(db, { now: '2026-11-07T10:00:00.000Z' }), true); assert.equal(db.schemaVersion, 2); assert.equal(db.accessVersion, 14);
  const u = Object.fromEntries(db.users.map((x) => [x.username, x])); const r = Object.fromEntries(db.roles.map((x) => [x.id, x]));
  for (const x of db.users) { assert.ok(!('assignments' in x), x.username); assert.ok(typeof x.roleId === 'string' && x.scope && typeof x.scope === 'object'); assert.equal(x.credential.hash, hashes[x.username], 'credentials untouched'); }
  for (const x of db.roles) { assert.ok(!('permissions' in x) && Array.isArray(x.modules) && typeof x.readOnly === 'boolean', x.id); }
  assert.equal(u.demo.roleId, 'role-system-admin'); assert.deepEqual(u.demo.scope, { all: true }); assert.equal(u.admin.roleId, 'role-system-admin'); assert.deepEqual(u.admin.scope, { all: true }); assert.equal(u.demo.tokenVersion, 3, 'a user who lost nothing keeps the session');
  assert.equal(u.auditor.roleId, 'role-auditor'); assert.equal(r['role-auditor'].readOnly, true); assert.equal(r['role-auditor'].nameEn, 'Auditor'); assert.equal(r['role-auditor'].nameAr, 'مدقق'); assert.deepEqual(r['role-auditor'].modules, MODULE_IDS);
  assert.equal(r['role-system-admin'].nameEn, 'Administrator'); assert.deepEqual(r['role-system-admin'].modules, MODULE_IDS); assert.equal(r['role-system-admin'].readOnly, false); assert.equal(r['role-system-admin'].protected, true);
  assert.equal(r['role-collection'].nameAr, 'موظف تحصيل'); assert.equal(r['role-collection'].readOnly, false); assert.equal(r['role-financial'].readOnly, false); assert.equal(r['role-enforcement'].readOnly, false);
  assert.equal(r['role-custom-x'].nameEn, 'Custom X', 'a custom role keeps its name'); assert.deepEqual(r['role-custom-x'].modules, ['invoices_collected', 'invoices_uncollected']); assert.equal(r['role-custom-x'].readOnly, true, 'no write permission → read-only');
  // the user with three assignments: FIRST kept, two dropped, listed in the audit
  assert.equal(u.multi.roleId, 'role-collection'); assert.deepEqual(geoScopeAmanahKeys(u.multi.scope), [RIY]); assert.equal(u.multi.tokenVersion, 4, 'his access narrowed: current sessions end');
  const note = db.audit.find((e) => e.action === 'migration' && e.targetType === 'user' && e.targetId === 'usr-multi'); assert.ok(note && note.summary && note.summaryEn); assert.equal(note.after.dropped.length, 2); assert.deepEqual(note.after.dropped.map((d) => d.roleId), ['role-enforcement', 'role-auditor']); assert.equal(note.before.assignments.length, 3);
  assert.equal(db.audit.filter((e) => e.targetType === 'user' && e.action === 'migration').length, 1, 'only the user who lost assignments gets a note');
  assert.deepEqual(u.single.roleId, 'role-financial'); assert.equal(u.single.tokenVersion, 3);
  assert.equal(u.gone1.status, 'inactive'); assert.equal(u.gone2.status, 'inactive'); assert.equal(u.gone1.roleId, 'role-collection'); assert.deepEqual(geoScopeAmanahKeys(u.gone1.scope), [MAK]);
  const sum = db.audit.find((e) => e.targetId === 'schema-v2'); assert.ok(sum && sum.after.usersWithDroppedAssignments.join() === 'multi'); assert.deepEqual(sum.after.rolesWithNewWritePower['role-collection'], ['enforcement', 'exclusions', 'data_sources']); assert.deepEqual(sum.after.rolesWithNewWritePower['role-financial'], ['enforcement']);
  assert.deepEqual(db.audit.slice(0, 2).map((e) => e.id), ['aud-1', 'aud-2'], 'the earlier audit history is preserved, in order'); assert.equal(db.audit.length, 4);
  assert.equal(migrate(db), false, 'idempotent'); assert.equal(db.audit.length, 4); assert.equal(db.accessVersion, 14);
  // the migrated document behaves: ONE role, ONE scope
  const acc = computeAccess({ roleId: u.multi.roleId, scope: u.multi.scope }, db.roles); assert.ok(acc.permissions.has('invoices_uncollected') && !acc.permissions.has('users')); assert.deepEqual(geoScopeAmanahKeys(effectiveScopeFor(acc, 'contracts')), [RIY]);
});
ok('migration through the store: an old identity FILE is converted on open, persisted, and the migrated accounts sign in with their old credentials-hash format (tokens of unchanged users survive)', async () => {
  const old = oldStore(); const f = path.join(tmp, 'old-identity.json');
  // a real scrypt credential for the old demo account, produced by the current hasher
  const { hashPassword } = await import('../server/identity/crypto.js'); old.users[0].credential = hashPassword('demo123'); old.users[1].credential = hashPassword('demo123'); old.users[2].credential = hashPassword('admin');
  fs.writeFileSync(f, JSON.stringify(old)); resetForTests(f);
  const db = getDb(); assert.equal(db.schemaVersion, 2); assert.ok(!db.users.some((u) => 'assignments' in u)); { const disk = JSON.parse(fs.readFileSync(f, 'utf8')); assert.equal(disk.schemaVersion, 2); assert.ok(disk.roles.every((x) => Array.isArray(x.modules) && !('permissions' in x)) && disk.users.every((x) => !('assignments' in x) && x.roleId), 'persisted in the new shape'); }
  let r = await login('demo', 'demo123'); assert.equal(r.status, 200); assert.equal(r.json.me.role.nameEn, 'Administrator'); assert.deepEqual(r.json.me.modules, MODULE_IDS); assert.deepEqual(r.json.me.scope, { all: true });
  r = await login('auditor', 'demo123'); assert.equal(r.json.me.readOnly, true); assert.equal(r.json.me.role.nameEn, 'Auditor');
  assert.equal((await login('gone1', 'whatever')).status, 401); assert.equal(db.users.find((u) => u.username === 'gone1').status, 'inactive');
  resetForTests(FILE); demo = await tokenOf('demo', 'demo123');
});
ok('a corrupt identity file starts a fresh, seeded store instead of crashing', () => {
  const bad = path.join(tmp, 'corrupt.json'); fs.writeFileSync(bad, '{not json'); const info = resetForTests(bad); assert.equal(info.mode, 'file'); assert.equal(getDb().users.length, 3);
  const mem = resetForTests(':memory:'); assert.equal(mem.mode, 'memory'); assert.equal(mem.durable, false); assert.equal(getDb().users.length, 3);
  resetForTests(FILE); // back to the main temp file for the scan
});
ok('NO-SECRET SCAN: no API payload, audit entry or error contains a password hash, salt, plaintext password, activation code or the signing key; the persisted file holds no plaintext password or code', async () => {
  // gather a few more payload kinds first
  const t = await tokenOf('demo', 'demo123');
  for (const p of ['/admin/users', '/admin/roles', '/admin/audit?limit=500', '/admin/catalog', '/auth/me']) await call('GET', p, null, t);
  await call('POST', '/auth/login', { username: 'demo', password: 'wrong-demo-password' }); await call('POST', '/auth/activate', { code: 'ZZZZ-ZZZZ-ZZZZ', password: 'x' });
  const db = getDb(); const secrets = [];
  for (const u of db.users) if (u.credential) { secrets.push(u.credential.hash, u.credential.salt); }
  secrets.push(db.secret || 'no-secret-yet-placeholder-xyz'); secrets.push(PW, PW2, 'demo123', 'wrong-demo-password'); for (const c of unique) { secrets.push(c, c.replace(/-/g, '')); }
  const hay = `${TRANSCRIPT.join('\n')}\n${JSON.stringify(db.audit)}`;
  for (const s of secrets) if (s && s.length >= 6) assert.ok(!hay.includes(s), `a secret leaked into a payload / audit entry: ${String(s).slice(0, 4)}…`);
  assert.ok(!/"credential"|"tokenVersion"|"codeHash"|"salt"/.test(TRANSCRIPT.join('\n')), 'no credential field names in any payload');
  assert.ok(!/"password"/.test(JSON.stringify(db.audit)));
  const file = fs.readFileSync(FILE, 'utf8');
  for (const s of [PW, PW2, 'demo123', ...unique]) assert.ok(!file.includes(s), 'the persisted file holds no plaintext password / code');
  assert.ok(TRANSCRIPT.length > 40, `scanned ${TRANSCRIPT.length} responses`);
});

await chain;
fs.rmSync(tmp, { recursive: true, force: true });
console.log(process.exitCode ? 'identity: FAILURES' : `identity: ${n} tests passed`);
