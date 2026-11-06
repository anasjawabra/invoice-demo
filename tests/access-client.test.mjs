// Client side of access control — SIMPLIFIED model (13 module switches, ONE role, ONE geographic scope, role-level read-only):
// route → module map, landing route, navigation, geographic narrowing, action gates, session / api-client behaviour with a fake fetch, source hygiene.
// Run: npm run test:accessclient. Pure and synthetic: no server, no real storage, no real credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STARTER_ROLES, MODULE_IDS, MODULES } from '../src/data/permissions.js';
import { DATA_MODULES as SERVER_DATA_MODULES, exportPermissions } from '../server/endpointAccess.js';
import { ALL_SCOPE, EMPTY_SCOPE, geoScopeSubset, intersectGeoScopes, normalizeGeoScope, geoScopeKey } from '../src/data/geoScope.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import {
  ROUTE_PERMISSIONS, LANDING_ORDER, routeEntry, canOpenRoute, firstAllowedRoute, filterNav, settingsPagesFor, canOpenSettings, gate, allGates, ACTIONS, exportGate, deriveCanReview, REVIEW_MODULES, MUTATING_MODULES,
  DATA_MODULES, GEO_MODULES, READ_ONLY_REASON, buildAccess, accessKeyOf, userOf, roleName, authErrorText, accessErrorText, matchPattern, moduleName
} from '../src/data/accessModel.js';
import * as session from '../src/api/session.js';
import { post, get, request, ApiError, ForbiddenError, isForbidden, isReadOnlyRefusal, bumpEpoch, api } from '../src/api/client.js';

let n = 0; let chain = Promise.resolve();
const ok = (name, fn) => { chain = chain.then(async () => { try { await fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}\n  ${e.stack || e}`); process.exitCode = 1; } }); };

const RIY = 'Riyadh Amanah'; const MAK = 'Makkah Amanah';
const starter = (id) => STARTER_ROLES.find((r) => r.id === id);
// the `me` document the service issues (docs/access-control.md S2): role{id,nameAr,nameEn,readOnly}, modules, permissions (alias), scope, scopes{[module]:scope}, summary{ar,en}
const meOf = (modules, scope = ALL_SCOPE, { readOnly = false, extra = {} } = {}) => {
  const mods = MODULE_IDS.filter((m) => modules.includes(m));
  const scopes = {}; for (const m of mods) scopes[m] = scope;
  return {
    id: 'usr-t', username: 't', nameAr: 'اختبار', nameEn: 'Tester', avatar: 'T', status: 'active', role: { id: 'r', nameAr: 'دور', nameEn: 'Role', readOnly },
    modules: mods, permissions: mods, scope, scopes, scopeSummary: { ar: 'ملخص', en: 'Summary' }, summary: { ar: 'دور · ملخص', en: 'Role · Summary' }, accessVersion: 3, ...extra
  };
};
const meOfRole = (id, scope = ALL_SCOPE) => { const r = starter(id); return meOf(r.modules, scope, { readOnly: r.readOnly === true }); };
const ADMIN = meOf(MODULE_IDS); const AUDITOR = meOfRole('role-auditor'); const COLLECTOR = meOfRole('role-collection');
const ENFORCER = meOfRole('role-enforcement'); const NOBODY = meOf([]); const ONLY_METRICS = meOf(['metrics']);
const accOf = (me) => buildAccess(me);
const canOf = (me) => buildAccess(me).can;

/* ------------------------------------------------------------------ 0. the catalog the client relies on */
ok('the client knows exactly the 13 module ids of the catalog; the data modules mirror the data service', () => {
  assert.equal(MODULE_IDS.length, 13);
  for (const id of ['dashboard', 'invoices_collected', 'invoices_uncollected', 'enforcement', 'exclusions', 'contracts', 'planning', 'smart_reports', 'decisions', 'data_sources', 'metrics', 'users', 'roles']) assert.ok(MODULE_IDS.includes(id), id);
  assert.deepEqual([...DATA_MODULES].sort(), [...SERVER_DATA_MODULES].sort());
  assert.deepEqual(GEO_MODULES, [...DATA_MODULES, 'data_sources']);
  for (const m of [...MUTATING_MODULES, ...DATA_MODULES, ...GEO_MODULES]) assert.ok(MODULE_IDS.includes(m), m);
  for (const m of MODULES) { assert.equal(moduleName(m.id, 'ar'), m.nameAr); assert.equal(moduleName(m.id, 'en'), m.nameEn); }
  assert.equal(moduleName('nope'), 'nope');
  // the starter roles: Auditor is the (only) read-only starter; the others are not
  assert.equal(starter('role-auditor').readOnly, true); for (const id of ['role-system-admin', 'role-financial', 'role-collection', 'role-enforcement']) assert.ok(!starter(id).readOnly, id);
});

/* ------------------------------------------------------------------ 1. routes */
ok('every <Route path> of src/App.jsx has an entry in ROUTE_PERMISSIONS, and every guarded page() is a "page" entry', () => {
  const app = fs.readFileSync('src/App.jsx', 'utf8');
  const routePaths = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '/' && p !== '/login');
  const pagePaths = [...app.matchAll(/page\('([^']+)'/g)].map((m) => m[1]);
  assert.ok(routePaths.length > 20 && pagePaths.length >= 18);
  const known = new Set(ROUTE_PERMISSIONS.map((r) => r.pattern));
  for (const p of [...routePaths, ...pagePaths]) assert.ok(known.has(p), `App.jsx route «${p}» has no entry in ROUTE_PERMISSIONS`);
  for (const p of pagePaths) { const e = ROUTE_PERMISSIONS.find((r) => r.pattern === p); assert.equal(e.kind, 'page', `${p} is a page`); assert.ok(e.any.length > 0, p); for (const m of e.any) assert.ok(MODULE_IDS.includes(m), `${p} names an unknown module ${m}`); }
  // every ROUTE_PERMISSIONS "page" is actually registered through the guard helper (no unguarded page route)
  for (const e of ROUTE_PERMISSIONS.filter((r) => r.kind === 'page')) assert.ok(pagePaths.includes(e.pattern), `${e.pattern} is declared a page but App.jsx does not guard it`);
  // a page route written as a plain <Route> (unguarded) would carry an element that is not a Navigate / landing / settings landing / not-authorised / NotFound: none may exist
  for (const m of app.matchAll(/<Route path="([^"]+)" element=\{([^}]*)\}/g)) {
    if (m[1] === '/' || m[1] === '/login') continue;
    assert.ok(/Navigate|Redirect|LandingRedirect|SettingsLanding|NotAuthorisedPage|NotFound|Layout/.test(m[2]), `unguarded page element on «${m[1]}»: ${m[2]}`);
  }
  assert.ok(/RequireRoute/.test(app) && /ProtectedRoute/.test(app));
});
ok('route → module table (S1)', () => {
  const need = (p) => routeEntry(p).any;
  assert.deepEqual(need('/insights'), ['dashboard']);
  assert.deepEqual(need('/invoices'), ['invoices_collected']);
  assert.deepEqual(need('/collection'), ['invoices_uncollected']); assert.deepEqual(need('/analysis/abc'), ['invoices_uncollected']);
  assert.deepEqual(need('/exclusions'), ['exclusions']); assert.deepEqual(need('/contracts'), ['contracts']); assert.deepEqual(need('/contracts/12'), ['contracts']);
  assert.deepEqual(need('/enforcement'), ['enforcement']); assert.deepEqual(need('/enforcement/violations/k'), ['enforcement']); assert.deepEqual(need('/enforcement-orders/55'), ['enforcement']);
  assert.deepEqual(need('/planning'), ['planning']); assert.deepEqual(need('/decisions'), ['decisions']); assert.deepEqual(need('/smart-reports'), ['smart_reports']);
  assert.deepEqual(need('/products'), ['data_sources']); assert.deepEqual(need('/products/foras'), ['data_sources']);
  assert.deepEqual(need('/settings/metrics'), ['metrics']); assert.deepEqual(need('/settings/metrics/x'), ['metrics']);
  assert.deepEqual(need('/settings/users'), ['users']); assert.deepEqual(need('/settings/roles'), ['roles']);
  // the invoice page opens for any module that lists invoice rows (the service's /invoice answers the same four)
  assert.deepEqual([...routeEntry('/invoices/177-1').any].sort(), ['enforcement', 'exclusions', 'invoices_collected', 'invoices_uncollected']);
  assert.equal(routeEntry('/nope/nothing').kind, 'open'); assert.equal(routeEntry('/executive').kind, 'redirect');
  assert.equal(routeEntry('/settings').kind, 'landing-settings'); assert.equal(routeEntry('/').kind, 'landing');
  assert.ok(matchPattern('invoices/:id', '/invoices/x') && !matchPattern('invoices/:id', '/invoices'));
});
ok('a module-less user opens no page; an administrator opens every page; a module opens only its own pages', () => {
  const pages = ROUTE_PERMISSIONS.filter((r) => r.kind === 'page').map((r) => `/${r.pattern.replace(/:[^/]+/g, 'x')}`);
  for (const p of pages) { assert.equal(canOpenRoute(p, canOf(NOBODY)), false, p); assert.equal(canOpenRoute(p, canOf(ADMIN)), true, p); }
  // the read-only Auditor holds every module: it opens every page (reading), including the two administration pages
  for (const p of pages) assert.equal(canOpenRoute(p, canOf(AUDITOR)), true, `auditor ${p}`);
  assert.equal(canOpenRoute('/settings/users', canOf(COLLECTOR)), false); assert.equal(canOpenRoute('/planning', canOf(COLLECTOR)), false); assert.equal(canOpenRoute('/exclusions', canOf(COLLECTOR)), false);
  assert.equal(canOpenRoute('/enforcement', canOf(ENFORCER)), true); assert.equal(canOpenRoute('/insights', canOf(ENFORCER)), false);
  // module off ⇒ the direct URL is closed, whichever other module is held
  assert.equal(canOpenRoute('/exclusions', canOf(meOf(MODULE_IDS.filter((m) => m !== 'exclusions')))), false);
  assert.equal(canOpenRoute('/invoices/x', canOf(meOf(['exclusions']))), true); assert.equal(canOpenRoute('/invoices', canOf(meOf(['exclusions']))), false);
  assert.equal(canOpenRoute('/not-authorised', canOf(NOBODY)), true); assert.equal(canOpenRoute('/whatever', canOf(NOBODY)), true);
});
ok('the landing route is the first page the user may open', () => {
  assert.equal(firstAllowedRoute(canOf(ADMIN)), '/insights'); assert.equal(firstAllowedRoute(canOf(AUDITOR)), '/insights'); assert.equal(firstAllowedRoute(canOf(COLLECTOR)), '/insights');
  assert.equal(firstAllowedRoute(canOf(ENFORCER)), '/collection'); // no dashboard → the first permitted page of the sidebar order
  assert.equal(firstAllowedRoute(canOf(ONLY_METRICS)), '/settings/metrics');
  assert.equal(firstAllowedRoute(canOf(NOBODY)), null);
  assert.equal(firstAllowedRoute(canOf(meOf(['roles']))), '/settings/roles');
  assert.ok(LANDING_ORDER.every((p) => routeEntry(p).kind === 'page'));
});

/* ------------------------------------------------------------------ 2. navigation */
ok('navigation shows only the modules the user holds; empty groups disappear', () => {
  const flat = (me) => filterNav(canOf(me)).flatMap((g) => g.items.map((i) => i.to));
  assert.deepEqual(flat(ADMIN), ['/insights', '/collection', '/invoices', '/enforcement', '/exclusions', '/contracts', '/planning', '/smart-reports', '/products']);
  assert.ok(!flat(ADMIN).includes('/decisions')); // the Decision room is reached from the dashboard when the dashboard is allowed
  assert.deepEqual(flat(NOBODY), []); assert.deepEqual(filterNav(canOf(NOBODY)), []);
  assert.ok(!flat(COLLECTOR).includes('/planning') && flat(COLLECTOR).includes('/collection') && !flat(COLLECTOR).includes('/exclusions') && !flat(COLLECTOR).includes('/products'));
  assert.deepEqual(flat(ENFORCER), ['/decisions', '/collection', '/invoices', '/enforcement', '/contracts', '/smart-reports']);
  // a module switched off removes exactly its item
  for (const [m, to] of [['dashboard', '/insights'], ['invoices_collected', '/invoices'], ['invoices_uncollected', '/collection'], ['exclusions', '/exclusions'], ['contracts', '/contracts'], ['enforcement', '/enforcement'], ['planning', '/planning'], ['smart_reports', '/smart-reports'], ['data_sources', '/products']]) {
    const f = flat(meOf(MODULE_IDS.filter((x) => x !== m))); assert.ok(!f.includes(to), `${m} off still lists ${to}`); assert.equal(f.length, flat(ADMIN).length - 1 + (m === 'dashboard' ? 1 : 0), m); // without the dashboard the Decision room gets its own row
  }
  const onlyDecisions = meOf(['decisions']);
  assert.deepEqual(flat(onlyDecisions), ['/decisions']); // no dashboard → the Decision room gets its own row
  assert.deepEqual(filterNav(canOf(onlyDecisions)).map((g) => g.key), ['overview']);
  assert.deepEqual(settingsPagesFor(canOf(ADMIN)), ['/settings/metrics', '/settings/users', '/settings/roles']);
  assert.deepEqual(settingsPagesFor(canOf(COLLECTOR)), ['/settings/metrics']); assert.equal(canOpenSettings(canOf(NOBODY)), false); assert.equal(canOpenSettings(canOf(ONLY_METRICS)), true);
  assert.deepEqual(settingsPagesFor(canOf(meOf(['users']))), ['/settings/users']); assert.deepEqual(settingsPagesFor(canOf(meOf(['roles']))), ['/settings/roles']);
});

/* ------------------------------------------------------------------ 3. access object + narrowing */
ok('useAccess() shape: every documented member exists (buildAccess is what the provider exposes)', () => {
  const a = buildAccess(ADMIN); assert.ok(!('orgNarrowing' in a), 'no organisation narrowing exists any more');
  for (const k of ['me', 'can', 'canAny', 'scopeFor', 'geoScope', 'scopeSummary', 'summary', 'effectiveScope', 'canReview', 'gates', 'accessKey', 'role', 'readOnly', 'modules', 'permissions']) assert.ok(k in a, k);
  assert.equal(typeof a.can, 'function'); assert.equal(typeof a.scopeFor, 'function'); assert.equal(typeof a.scopeSummary, 'function'); assert.equal(typeof a.summary, 'function');
  assert.equal(a.can('invoices_collected'), true); assert.equal(buildAccess(NOBODY).can('invoices_collected'), false); assert.equal(buildAccess(null).can('invoices_collected'), false);
  assert.equal(a.canAny(['nope', 'invoices_collected']), true); assert.equal(a.canAny([]), false);
  assert.equal(a.scopeSummary('ar'), 'كل الأمانات والبلديات'); assert.equal(a.scopeSummary('en'), 'All Amanahs and municipalities'); // derived from the one scope (the service's wording)
  assert.equal(buildAccess({ ...ADMIN, scope: undefined }).scopeSummary('en'), 'Summary', 'without a scope the service\'s own text is used');
  assert.equal(a.summary('ar'), 'دور · ملخص'); assert.equal(a.summary('en'), 'Role · Summary');
  assert.ok(a.permissions instanceof Set && a.permissions.size === 13 && a.modules.length === 13); assert.equal(a.role.id, 'r'); assert.equal(a.readOnly, false);
  assert.equal(buildAccess(AUDITOR).readOnly, true); assert.equal(buildAccess(null).readOnly, false);
  // `summary` falls back to role name + scope summary when the service did not send it
  const noSummary = { ...ADMIN, summary: undefined }; assert.equal(buildAccess(noSummary).summary('en'), 'Role · All Amanahs and municipalities');
  const jed = meOf(['invoices_collected'], { all: false, grants: [{ amanah: 'Jeddah Amanah', municipalities: municipalitiesOf('Jeddah Amanah').slice(0, 3).map((m) => m.refId), direct: false, notSpecified: false }], nonMunicipal: false }, { extra: { summary: undefined } });
  assert.equal(buildAccess(jed).summary('en'), 'Role · Jeddah Amanah · 3 municipalities'); assert.equal(buildAccess(jed).scopeSummary('ar'), 'أمانة محافظة جدة · 3 بلديات');
  const src = fs.readFileSync('src/context/AuthContext.jsx', 'utf8');
  for (const k of ['ready', 'accessVersion', 'refresh', 'export function useAccess', 'export function useAuth']) assert.ok(src.includes(k), k);
});
ok('effectiveScope = the account\'s own scope for the module — derived ONLY from the authenticated account (no persona, no organisation), never wider than it', () => {
  const riyMakScope = { all: false, grants: [{ amanah: RIY, municipalities: 'all', direct: true, notSpecified: true }, { amanah: MAK, municipalities: 'all', direct: true, notSpecified: true }], nonMunicipal: false };
  const me = meOf(['invoices_collected', 'invoices_uncollected'], riyMakScope);
  const a = buildAccess(me);
  assert.equal(geoScopeKey(a.effectiveScope('invoices_collected')), geoScopeKey(a.scopeFor('invoices_collected')));
  assert.deepEqual(a.effectiveScope('invoices_collected').grants.map((g) => g.amanah).sort(), [MAK, RIY].sort());
  // a module the user does not hold is empty
  assert.equal(a.effectiveScope('exclusions').grants.length, 0); assert.equal(a.scopeFor('exclusions').all, false);
  // an unrestricted account sees everything, a few municipalities of Riyadh stay exactly those few
  assert.equal(buildAccess(ADMIN).effectiveScope('invoices_collected').all, true);
  const few = municipalitiesOf(RIY).slice(0, 2).map((m) => m.refId);
  const fewScope = { all: false, grants: [{ amanah: RIY, municipalities: few, direct: false, notSpecified: false }], nonMunicipal: false };
  assert.deepEqual(buildAccess(meOf(['invoices_collected'], fewScope)).effectiveScope('invoices_collected').grants[0].municipalities, few);
  // property: for random scopes the effective scope equals the stated one (nothing widens or narrows it)
  for (let i = 0; i < 40; i++) {
    const g1 = i % 2 ? [{ amanah: RIY, municipalities: 'all', direct: !!(i & 2), notSpecified: !!(i & 4) }] : [{ amanah: MAK, municipalities: 'all', direct: true, notSpecified: !!(i & 4) }, { amanah: RIY, municipalities: few, direct: false, notSpecified: false }];
    const s1 = { all: false, grants: g1, nonMunicipal: !!(i & 8) };
    const eff = buildAccess(meOf(['invoices_collected'], s1)).effectiveScope('invoices_collected');
    assert.ok(geoScopeSubset(eff, normalizeGeoScope(s1)) && geoScopeSubset(normalizeGeoScope(s1), eff));
  }
  assert.ok(geoScopeSubset(EMPTY_SCOPE, ALL_SCOPE) && intersectGeoScopes(ALL_SCOPE, EMPTY_SCOPE).all === false);
});
ok('ONE scope per user: every held module carries it; a held module with no stated scope is EMPTY; the union covers the geographic modules only', () => {
  const s1 = { all: false, grants: [{ amanah: RIY, municipalities: 'all', direct: true, notSpecified: true }], nonMunicipal: false };
  const me = meOf(['invoices_collected', 'invoices_uncollected', 'metrics'], s1);
  const a = buildAccess(me);
  assert.deepEqual(a.scopeFor('invoices_collected').grants.map((g) => g.amanah), [RIY]); assert.deepEqual(a.scopeFor('invoices_uncollected').grants.map((g) => g.amanah), [RIY]);
  assert.deepEqual(a.geoScope.grants.map((g) => g.amanah), [RIY]);
  // no entry in `scopes` → the user's `scope` (S2: the same scope for every module); neither → EMPTY, never wider than stated
  const noScopes = { ...me, scopes: {} }; assert.deepEqual(buildAccess(noScopes).scopeFor('invoices_collected').grants.map((g) => g.amanah), [RIY]);
  const none = { ...me, scopes: {}, scope: undefined }; assert.equal(buildAccess(none).scopeFor('invoices_collected').grants.length, 0); assert.equal(buildAccess(none).scopeFor('invoices_collected').all, false);
  // the metrics dictionary shows no figures: a module-only user has no geographic union
  assert.equal(buildAccess(ONLY_METRICS).geoScope.grants.length, 0); assert.equal(buildAccess(ONLY_METRICS).geoScope.all, false);
  assert.equal(buildAccess(NOBODY).geoScope.grants.length, 0);
  assert.equal(buildAccess(ADMIN).allScope, true);
  assert.ok(buildAccess(meOf(['invoices_collected'], s1)).scopeSummary('ar').length > 0);
  // a `me` that still carries only the older `permissions` alias is read as modules
  const aliasOnly = { ...ADMIN, modules: undefined }; assert.equal(buildAccess(aliasOnly).can('planning'), true);
});
ok('the user shape, role name and access fingerprint (module / role / read-only / scope change it; another person\'s version does not)', () => {
  const u = userOf(ADMIN);
  assert.equal(u.user, 't'); assert.equal(u.nameAr, 'اختبار'); assert.equal(u.roleEn, 'Role'); assert.equal(u.roleAr, 'دور'); assert.ok(!('org' in u) && !('orgScoped' in u), 'no organisation on the user'); assert.ok(!('password' in u) && !('token' in u) && !('credential' in u));
  assert.equal(roleName({ role: { nameAr: 'أ', nameEn: 'A' } }, 'en'), 'A'); assert.equal(roleName({ role: { nameAr: 'أ', nameEn: 'A' } }, 'ar'), 'أ'); assert.equal(roleName(null), ''); assert.equal(userOf(null), null);
  assert.equal(accessKeyOf(ADMIN), accessKeyOf({ ...ADMIN, accessVersion: 99 })); // another person's change (version only) is not a change of MY access
  assert.notEqual(accessKeyOf(ADMIN), accessKeyOf({ ...ADMIN, modules: ADMIN.modules.slice(1), permissions: ADMIN.modules.slice(1) }));
  assert.notEqual(accessKeyOf(ADMIN), accessKeyOf({ ...ADMIN, status: 'inactive' }));
  assert.notEqual(accessKeyOf(ADMIN), accessKeyOf({ ...ADMIN, role: { ...ADMIN.role, readOnly: true } }), 'switching the role to read-only changes the fingerprint (caches and pages refresh)');
  assert.notEqual(accessKeyOf(ADMIN), accessKeyOf({ ...ADMIN, scope: { all: false, grants: [], nonMunicipal: false } }));
  assert.equal(accessKeyOf(null), 'none');
});

/* ------------------------------------------------------------------ 4. action gates */
ok('gates: administrator / read-only auditor / collection officer / enforcement reviewer / no module', () => {
  const g = (me) => allGates(accOf(me));
  const A = g(ADMIN); for (const k of Object.keys(ACTIONS)) { assert.equal(A[k].allowed, true, `admin ${k}`); assert.equal(A[k].reason, null); }
  // the read-only Auditor holds every module: every ACTION that changes something is blocked WITH the reason, every export is allowed
  const U = g(AUDITOR);
  for (const [k, a] of Object.entries(ACTIONS)) {
    if (a.mutating) { assert.equal(U[k].allowed, false, `auditor ${k}`); assert.deepEqual(U[k].reason, READ_ONLY_REASON, k); assert.equal(U[k].readOnly, true); }
    else { assert.equal(U[k].allowed, true, `auditor ${k} (a read-only role may export)`); assert.equal(U[k].reason, null); }
  }
  assert.equal(READ_ONLY_REASON.ar, 'هذا الدور للقراءة فقط'); assert.equal(READ_ONLY_REASON.en, 'This role is read-only');
  // Collection Officer: decisions + both invoice registers + dashboard + contracts + smart reports
  const C = g(COLLECTOR);
  assert.equal(C['decision.followup'].allowed, true); assert.equal(C['invoice.note'].allowed, true); assert.equal(C['export.invoices'].allowed, true); assert.equal(C['export.collection'].allowed, true); assert.equal(C['export.dashboard'].allowed, true);
  assert.equal(C['exclusion.upload'].allowed, false); assert.equal(C['planning.update'].allowed, false); assert.equal(C['export.exclusions'].allowed, false); assert.equal(C['enforcement.review'].allowed, false); assert.equal(C['data.upload'].allowed, false);
  assert.ok(C['exclusion.upload'].reason.ar.includes('إدارة الاستبعادات') && C['exclusion.upload'].reason.en.includes('Exclusions Management'), 'a missing module is named in the reason');
  assert.equal(C['exclusion.upload'].readOnly, false);
  const E = g(ENFORCER); assert.equal(E['enforcement.review'].allowed, true); assert.equal(E['enforcement.upload'].allowed, true); assert.equal(E['export.enforcement'].allowed, true); assert.equal(E['decision.followup'].allowed, true); assert.equal(E['export.dashboard'].allowed, false); assert.equal(E['exclusion.manage'].allowed, false);
  const N = g(NOBODY); for (const k of Object.keys(ACTIONS)) { assert.equal(N[k].allowed, false); assert.ok(N[k].reason.ar && N[k].reason.en); }
  assert.equal(gate(accOf(ADMIN), 'nope').allowed, false);
  // a bare `can` function / module Set carries no role: only the module decides; an access-like object adds read-only
  assert.equal(gate(new Set(['data_sources']), 'data.upload').allowed, true); assert.equal(gate(canOf(ADMIN), 'data.upload').allowed, true);
  assert.equal(gate({ can: (m) => m === 'data_sources', readOnly: true }, 'data.upload').allowed, false); assert.equal(gate({ can: (m) => m === 'data_sources', readOnly: true }, 'data.upload').reason.en, 'This role is read-only');
  // the review report of ONE invoice exports with any module that opens the invoice page
  for (const m of ['invoices_collected', 'invoices_uncollected', 'exclusions', 'enforcement']) assert.equal(gate(new Set([m]), 'export.invoice').allowed, true, m);
  assert.equal(gate(new Set(['contracts']), 'export.invoice').allowed, false);
  // every action names modules that exist and (for the single-module ones) the module it is gated by
  for (const [k, a] of Object.entries(ACTIONS)) { assert.ok(a.modules.every((m) => MODULE_IDS.includes(m)), k); assert.equal(typeof a.mutating, 'boolean'); }
  const FOLLOW = { 'decision.followup': 'decisions', 'invoice.note': 'decisions', 'exclusion.upload': 'exclusions', 'exclusion.manage': 'exclusions', 'enforcement.review': 'enforcement', 'enforcement.upload': 'enforcement', 'planning.update': 'planning', 'data.upload': 'data_sources' };
  for (const [k, m] of Object.entries(FOLLOW)) { assert.deepEqual(ACTIONS[k].modules, [m], k); assert.equal(ACTIONS[k].mutating, true, k); }
  for (const k of Object.keys(ACTIONS).filter((x) => x.startsWith('export.'))) assert.equal(ACTIONS[k].mutating, false, `${k} is never blocked by read-only`);
});
ok('CSV export: allowed iff the module that owns the rows is held (the SAME mode rule as the data service); a read-only role may export', () => {
  assert.equal(exportGate(accOf(ADMIN), { state: 'collected' }).allowed, true);
  const noMod = exportGate(canOf(meOf(MODULE_IDS.filter((m) => m !== 'invoices_collected'))), { state: 'collected' }); assert.equal(noMod.allowed, false); assert.ok(noMod.reason.ar && noMod.reason.en); assert.deepEqual(noMod.anyOf, ['invoices_collected']);
  assert.equal(exportGate(accOf(AUDITOR), { state: 'collected' }).allowed, true, 'read-only exports');
  assert.equal(exportGate(accOf(COLLECTOR), { state: 'open' }).allowed, true); // uncollected list ← invoices_uncollected
  assert.equal(exportGate(canOf(meOf(['invoices_collected'])), { state: 'open' }).allowed, false); // the collected module does not own the uncollected rows
  assert.equal(exportGate(canOf(meOf(['invoices_uncollected'])), { primary: 'R8' }).allowed, false); // the exclusions register exports with the exclusions module
  assert.equal(exportGate(canOf(meOf(['exclusions'])), { primary: 'R8' }).allowed, true);
  assert.equal(exportGate(canOf(NOBODY), {}).allowed, false);
  // identical to the service's rule for a spread of list modes
  for (const f of [{}, { state: 'open' }, { state: 'excluded' }, { primary: 'R8' }, { nc: 'x' }, { exec: 'yes' }, { ageMin: 30 }, { eligible: true }, { reason: 'r' }]) {
    assert.deepEqual(exportGate(canOf(ADMIN), f).anyOf, exportPermissions({ filters: f }), JSON.stringify(f));
    for (const m of MODULE_IDS) assert.equal(exportGate(new Set([m]), f).allowed, exportPermissions({ filters: f }).includes(m), `${m} ${JSON.stringify(f)}`);
  }
});
ok('canReview is a documented derived convenience: true iff a module with something to change is held AND the role is not read-only', () => {
  assert.equal(deriveCanReview(accOf(ADMIN)), true); assert.equal(deriveCanReview(accOf(AUDITOR)), false); assert.equal(deriveCanReview(accOf(NOBODY)), false);
  assert.equal(deriveCanReview(accOf(ENFORCER)), true); assert.equal(deriveCanReview(accOf(COLLECTOR)), true); assert.equal(deriveCanReview(canOf(meOf(['exclusions']))), true);
  assert.equal(deriveCanReview(accOf(meOf(['dashboard', 'invoices_collected', 'invoices_uncollected', 'contracts', 'smart_reports', 'metrics']))), false, 'view-only modules change nothing');
  for (const m of REVIEW_MODULES) { assert.equal(deriveCanReview(canOf(meOf([m]))), true, m); assert.equal(deriveCanReview(accOf(meOf([m], ALL_SCOPE, { readOnly: true }))), false, `${m} read-only`); }
  assert.deepEqual([...REVIEW_MODULES].sort(), ['data_sources', 'decisions', 'enforcement', 'exclusions', 'planning', 'roles', 'users']);
  assert.equal(buildAccess(AUDITOR).canReview, false); assert.equal(buildAccess(ADMIN).canReview, true);
  assert.equal(buildAccess(meOf(MODULE_IDS, ALL_SCOPE, { readOnly: true })).canReview, false, 'read-only beats every module');
});
ok('error texts exist in both languages (a read-only refusal has its own wording)', () => {
  for (const c of ['invalid_credentials', 'account_inactive', 'account_not_activated', 'too_many_attempts', 'invalid_activation_code', 'activation_expired', 'weak_password', 'password_mismatch', 'unauthenticated', 'network', 'whatever']) {
    assert.ok(authErrorText(c, 'ar').length > 5 && authErrorText(c, 'en').length > 5, c); assert.notEqual(authErrorText(c, 'ar'), authErrorText(c, 'en'));
  }
  assert.ok(accessErrorText(401, '', 'ar') && accessErrorText(403, '', 'en').includes('permission'));
  assert.ok(accessErrorText(403, 'read_only_role', 'en').includes('read-only') && accessErrorText(403, 'read_only_role', 'ar').includes('للقراءة فقط'));
});

/* ------------------------------------------------------------------ 5. session + api client with a fake fetch */
const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, dump: () => [...m.entries()] }; };
const res = (status, json, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => headers[String(k).toLowerCase()] ?? null }, json: async () => json });
const ME1 = { ...meOf(MODULE_IDS, ALL_SCOPE, { extra: { accessVersion: 5 } }) };
function harness(handler) {
  const store = memStore(); const calls = [];
  const f = async (url, init = {}) => { const c = { url, method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null }; calls.push(c); return handler(c, calls); };
  session.__configure({ storage: store, fetch: f }); globalThis.fetch = f; bumpEpoch();
  return { store, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

ok('login stores token + me (never the password); bad password / inactive / not activated / too many attempts surface the server code', async () => {
  const h = harness((c) => {
    if (c.url === '/api/auth/login') {
      if (c.body.password === 'good-pass-123') return res(200, { token: 'tok.A', me: ME1 }, { 'x-access-version': '5' });
      if (c.body.username === 'gone') return res(403, { error: 'account_inactive' });
      if (c.body.username === 'new') return res(403, { error: 'account_not_activated' });
      if (c.body.username === 'spam') return res(429, { error: 'too_many_attempts' });
      return res(401, { error: 'invalid_credentials' });
    }
    return res(200, {});
  });
  const bad = await session.login('demo', 'wrong-pass'); assert.deepEqual([bad.ok, bad.error], [false, 'invalid_credentials']); assert.equal(session.getToken(), null);
  assert.equal((await session.login('gone', 'x')).error, 'account_inactive'); assert.equal((await session.login('new', 'x')).error, 'account_not_activated'); assert.equal((await session.login('spam', 'x')).error, 'too_many_attempts');
  const okR = await session.login(' demo ', 'good-pass-123');
  assert.equal(okR.ok, true); assert.equal(session.getToken(), 'tok.A'); assert.ok(!('orgId' in session.getState()) && !('orgScoped' in session.getState()), 'the session holds no organisation / persona');
  assert.ok(!h.calls.some((c) => c.body && 'orgId' in c.body), 'the sign-in request carries no organisation');
  assert.equal(h.calls.at(-1).body.username, 'demo'); // trimmed
  const stored = JSON.stringify(h.store.dump());
  assert.ok(!stored.includes('good-pass-123') && !stored.includes('wrong-pass'), 'the password is never stored');
  assert.deepEqual(Object.keys(JSON.parse(h.store.getItem('ib_auth'))).sort(), ['me', 'token']);
  // a reload picks the session up and marks it to be re-validated
  session.__configure({ storage: h.store, fetch: globalThis.fetch }); assert.equal(session.getState().checking, true); assert.equal(session.getToken(), 'tok.A');
  // the retired client-only session key is discarded
  const h2 = harness(() => res(200, {})); h2.store.setItem('ib_user', JSON.stringify({ user: 'demo', canReview: true })); session.__configure({ storage: h2.store, fetch: globalThis.fetch }); assert.equal(session.getToken(), null); assert.equal(h2.store.getItem('ib_user'), null);
});
ok('activation: code + new password → signed in; invalid code surfaces the server code', async () => {
  const h = harness((c) => (c.url === '/api/auth/activate' ? (c.body.code === 'GOOD' ? res(200, { token: 'tok.N', me: ME1 }) : res(400, { error: 'invalid_activation_code' })) : res(200, {})));
  assert.equal((await session.activate('BAD', 'longenough1')).error, 'invalid_activation_code');
  assert.equal((await session.activate('GOOD', 'longenough1')).ok, true); assert.equal(session.getToken(), 'tok.N');
  assert.ok(!JSON.stringify(h.store.dump()).includes('longenough1'));
});
ok('api client: Authorization: Bearer on every call, no x-session, narrowing only travels in the body', async () => {
  const h = harness((c) => (c.url === '/api/auth/login' ? res(200, { token: 'tok.B', me: ME1 }) : res(200, { echoed: true })));
  await session.login('demo', 'good-pass-123', null);
  await post('/snapshot', { scope: { org: { amanahKeys: [RIY] } } }, { cached: false }); await get('/meta'); await request('PATCH', '/admin/users/u1', { status: 'inactive' });
  for (const c of h.calls.slice(1)) { assert.equal(c.headers.Authorization, 'Bearer tok.B', c.url); assert.ok(!('x-session' in c.headers), 'no client-chosen identity'); }
  assert.equal(h.calls.at(-1).method, 'PATCH'); assert.deepEqual(h.calls.at(-1).body, { status: 'inactive' });
  assert.ok(api.exportUrl({ a: 1 }).includes('access_token=tok.B') && !api.exportUrl({ a: 1 }).includes('session='));
  session.signOut(null); await tick();
  assert.ok(!api.exportUrl({ a: 1 }).includes('access_token'));
});
ok('api client: a cached answer belongs to one token', async () => {
  let k = 0; const h = harness((c) => (c.url === '/api/auth/login' ? res(200, { token: `tok.${c.body.username}`, me: ME1 }) : res(200, { n: (k += 1), who: c.headers.Authorization })));
  await session.login('u1', 'good-pass-123'); const a1 = await post('/list', { x: 1 }); const a2 = await post('/list', { x: 1 }); assert.equal(a1.n, a2.n);
  session.signOut(null); await session.login('u2', 'good-pass-123'); const b = await post('/list', { x: 1 }); assert.notEqual(b.n, a1.n); assert.ok(b.who.endsWith('tok.u2'));
  void h;
});
ok('api client: 401 signs out with a message; 403 is a typed error with the permission and no data', async () => {
  harness((c) => {
    if (c.url === '/api/auth/login') return res(200, { token: 'tok.C', me: ME1 });
    if (c.url === '/api/auth/logout') return res(200, {});
    if (c.url === '/api/list') return res(403, { error: 'forbidden', permission: 'invoices_collected', module: 'invoices_collected' });
    if (c.url === '/api/invoice') return res(401, { error: 'unauthenticated' });
    return res(200, {});
  });
  await session.login('demo', 'good-pass-123');
  const e403 = await post('/list', {}, { cached: false }).then(() => null, (e) => e);
  assert.ok(e403 instanceof ForbiddenError && e403 instanceof ApiError); assert.equal(e403.status, 403); assert.equal(e403.module, 'invoices_collected'); assert.equal(e403.permission, 'invoices_collected'); assert.equal(e403.readOnly, false); assert.ok(isForbidden(e403)); assert.ok(!isReadOnlyRefusal(e403)); assert.equal(session.getToken(), 'tok.C', 'a 403 keeps the session');
  const e401 = await post('/invoice', {}, { cached: false }).then(() => null, (e) => e);
  assert.equal(e401.status, 401); assert.equal(session.getToken(), null); assert.equal(session.getState().me, null); assert.deepEqual(session.getState().notice, { code: 'unauthenticated' });
  // a 401 of a request that carried an OLD token does not sign out the person who signed in again meanwhile
  await session.login('demo', 'good-pass-123'); session.noteUnauthenticated('tok.OLD'); assert.equal(session.getToken(), 'tok.C');
});
ok('api client: a read-only refusal (403 read_only_role) is a typed error that keeps the session; the deactivated account is signed out on the next request', async () => {
  let inactive = false;
  harness((c) => {
    if (c.url === '/api/auth/login') return res(200, { token: 'tok.R', me: meOf(['data_sources'], ALL_SCOPE, { readOnly: true }) });
    if (c.url === '/api/auth/logout') return res(200, {});
    if (c.url === '/api/upload') return res(403, { error: 'read_only_role' });
    if (inactive) return res(401, { error: 'unauthenticated' });
    return res(200, {});
  });
  await session.login('aud', 'good-pass-123');
  const e = await post('/upload', { records: [] }, { cached: false }).then(() => null, (x) => x);
  assert.ok(e instanceof ForbiddenError && isForbidden(e) && isReadOnlyRefusal(e) && e.code === 'read_only_role'); assert.equal(session.getToken(), 'tok.R', 'a read-only refusal keeps the session');
  assert.equal(buildAccess(session.getState().me).readOnly, true);
  inactive = true; const e2 = await post('/snapshot', {}, { cached: false }).then(() => null, (x) => x);
  assert.equal(e2.status, 401); assert.equal(session.getToken(), null); assert.deepEqual(session.getState().notice, { code: 'unauthenticated' });
});
ok('x-access-version: the first value is recorded, a change re-reads /auth/me and updates the permissions without signing in again', async () => {
  let meCalls = 0; let ver = '5'; let me = ME1;
  const h = harness((c) => {
    if (c.url === '/api/auth/login') return res(200, { token: 'tok.D', me: ME1 }, { 'x-access-version': '5' });
    if (c.url === '/api/auth/me') { meCalls += 1; return res(200, { me }, { 'x-access-version': ver }); }
    return res(200, { ok: true }, { 'x-access-version': ver });
  });
  await session.login('demo', 'good-pass-123');
  await post('/snapshot', {}, { cached: false }); await tick(); assert.equal(meCalls, 0, 'same version: nothing to refresh');
  ver = '6'; me = { ...ME1, accessVersion: 6, modules: ME1.modules.filter((p) => p !== 'exclusions'), permissions: ME1.modules.filter((p) => p !== 'exclusions') };
  await post('/snapshot', {}, { cached: false }); await tick(); await tick();
  assert.equal(meCalls, 1); assert.equal(session.getState().me.modules.includes('exclusions'), false); assert.equal(buildAccess(session.getState().me).can('exclusions'), false); assert.equal(canOpenRoute('/exclusions', buildAccess(session.getState().me).can), false, 'a module switched off in the open tab closes its page without signing in again');
  await post('/snapshot', {}, { cached: false }); await tick(); assert.equal(meCalls, 1, 'the new version is remembered');
  void h;
});
ok('re-validation on start: 401 → signed out with a message; success replaces me', async () => {
  let mode = 'ok'; let me = ME1;
  const h = harness((c) => {
    if (c.url === '/api/auth/login') return res(200, { token: 'tok.E', me: ME1 });
    if (c.url === '/api/auth/me') return mode === 'ok' ? res(200, { me }) : mode === 'inactive' ? res(403, { error: 'account_inactive' }) : res(401, { error: 'unauthenticated' });
    return res(200, {});
  });
  await session.login('demo', 'good-pass-123');
  me = { ...ME1, modules: ME1.modules.slice(1), permissions: ME1.modules.slice(1), accessVersion: 6 }; await session.refreshMe();
  assert.deepEqual(session.getState().me.modules, ME1.modules.slice(1), 'success replaces me (the account is the only source of access)');
  mode = '401'; await session.refreshMe(); assert.equal(session.getToken(), null); assert.deepEqual(session.getState().notice, { code: 'unauthenticated' });
  const stored = h.store.getItem('ib_auth'); assert.equal(stored, null);
  mode = 'ok'; await session.login('demo', 'good-pass-123'); mode = 'inactive'; await session.refreshMe(); assert.deepEqual(session.getState().notice, { code: 'account_inactive' });
  // a stored session is re-validated on start
  mode = 'ok'; await session.login('demo', 'good-pass-123'); session.__configure({ storage: h.store, fetch: globalThis.fetch }); assert.equal(session.getState().checking, true);
  await session.refreshMe(); assert.equal(session.getState().checking, false); assert.equal(session.getToken(), 'tok.E');
});
ok('there is no selectOrg / switchOrg: the session module exports no organisation API', () => {
  assert.ok(!('selectOrg' in session) && !('switchOrg' in session));
});

/* ------------------------------------------------------------------ 6. source hygiene */
const walk = (dir, out = []) => { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${f.name}`; if (f.isDirectory()) walk(p, out); else if (/\.(jsx?|mjs|css)$/.test(f.name)) out.push(p); } return out; };
const SRC = walk('src');
ok('the client bundle holds no seeded passwords and no CREDENTIALS list', () => {
  const seeded = ['demo123', 'admin123', "pass: 'admin'", 'pass: "admin"'];
  for (const f of SRC) {
    const s = fs.readFileSync(f, 'utf8');
    for (const lit of seeded) assert.ok(!s.includes(lit), `${f} contains a seeded password literal «${lit}»`);
    assert.ok(!/\bCREDENTIALS\b/.test(s.replace(/\/\/[^\n]*/g, '')), `${f} still uses CREDENTIALS`);
    assert.ok(!/\bpass:\s*['"]/.test(s), `${f} has a pass: literal`);
  }
  const mock = fs.readFileSync('src/data/mock.js', 'utf8'); assert.ok(mock.includes('DEMO_ACCOUNT_HINTS') && !mock.includes('export const ORGS')); assert.ok(!/pass\b/.test(mock.slice(0, mock.indexOf('export const INVOICES'))));
});
ok('sessionStorage / localStorage never receive a password; the login page posts it once and clears it', () => {
  for (const f of SRC) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(sessionStorage|localStorage)\.setItem\(([^;]*)\)/g)) assert.ok(!/passw|\bpass\b/i.test(m[2]), `${f}: ${m[0].slice(0, 80)}`);
  }
  const login = fs.readFileSync('src/pages/Login.jsx', 'utf8'); assert.ok(/setPassword\(''\)/.test(login)); assert.ok(!/localStorage|sessionStorage/.test(login));
  const sess = fs.readFileSync('src/api/session.js', 'utf8'); assert.ok(!/setItem\([^)]*password/i.test(sess)); assert.ok(!/console\.(log|warn|error)/.test(sess));
  const ctx = fs.readFileSync('src/context/AuthContext.jsx', 'utf8'); assert.ok(!/console\./.test(ctx));
});
ok('every remaining canReview read is documented (derived convenience or a decisions-module alias)', () => {
  const DOCUMENTED = new Map([
    ['src/context/RevenueContext.jsx', 'defines the derived canReview and the granular canDo.*'],
    ['src/data/accessModel.js', 'deriveCanReview / REVIEW_MODULES'],
    ['src/context/AuthContext.jsx', 'the useAccess() doc comment'],
    ['src/components/decisions/decisionUi.js', 'followControls(flag, canReview): the parameter is the decisions follow-up gate'],
    ['src/components/decisions/DecisionDetail.jsx', 'D.canReview = the decisions gate (useDecisions)'],
    ['src/data/useDecisions.js', 'returns canReview: rev.canDo.followup'],
    ['src/data/permissions.js', 'a comment about the old flag'],
    ['src/components/revenue/OrderJourney.jsx', 'local const = canDo.enforcementReview'],
    ['src/components/revenue/OrderDocuments.jsx', 'local const = canDo.enforcementUpload'],
    ['src/components/revenue/SanadDocumentWorkflow.jsx', 'local const = canDo.enforcementReview'],
    ['src/components/revenue/SanadDocumentPanel.jsx', 'local const = canDo.enforcementReview'],
    ['src/components/revenue/SanadDocumentReview.jsx', 'prop fed by SanadDocumentPanel (enforcement module, not read-only)']
  ]);
  for (const f of SRC) {
    const s = fs.readFileSync(f, 'utf8'); if (!/canReview/.test(s)) continue;
    assert.ok(DOCUMENTED.has(f), `${f} reads canReview without documentation`);
    for (const m of s.matchAll(/\brev\.canReview\b|\buser\??\.canReview\b|=\s*rev\.canReview\b/g)) assert.fail(`${f}: ${m[0]} is the retired single flag`);
  }
  for (const f of ['src/pages/EnforcementHome.jsx', 'src/pages/EnforcementOrderPage.jsx', 'src/pages/InvoicePage.jsx', 'src/pages/PlanDetail.jsx', 'src/components/revenue/ExclusionUpload.jsx']) assert.ok(!/canReview/.test(fs.readFileSync(f, 'utf8')), `${f} is on the granular gates`);
});
ok('the client names modules, not the retired action permissions (no «x.view» / «x.export» ids outside the compatibility notes)', () => {
  const RETIRED = /['"`](dashboard|invoices|collection|exclusions|contracts|enforcement|planning|decisions|reports|sources|data|metrics|users|roles|audit)\.(view|export|upload|manage|review|followup|update|documents)['"`]/;
  const SKIP = new Set(['src/data/permissions.js', 'src/api/adminClient.js']); // M1's compatibility layer; the administration pages are another owner's files
  for (const f of SRC) {
    if (SKIP.has(f) || f.startsWith('src/pages/admin') || f.startsWith('src/components/admin')) continue;
    const s = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    // the ACTIONS keys (`enforcement.review`, `exclusion.upload`, `data.upload`, `planning.update`, …) are action NAMES, not permission ids: only the module-style ids are checked, in function-call / literal positions
    for (const m of s.matchAll(new RegExp(`(can|canAny|scopeFor|effectiveScope|hasPermission|hasModule)\\(\\s*\\[?\\s*${RETIRED.source}`, 'g'))) assert.fail(`${f}: ${m[0]} uses a retired permission id`);
  }
  assert.ok(!/reports\.view|collection\.view/.test(fs.readFileSync('src/data/reportStore.js', 'utf8').replace(/\/\/[^\n]*/g, '')));
  assert.ok(!/reports\.view|collection\.view/.test(fs.readFileSync('src/data/analysisStore.js', 'utf8').replace(/\/\/[^\n]*/g, '')));
});
ok('export controls are gated: no ungated CSV anchor, ExportDialog call sites check a permission', () => {
  for (const f of ['src/pages/Exclusions.jsx', 'src/components/analysis/nc/NcInvoices.jsx']) { const s = fs.readFileSync(f, 'utf8'); assert.ok(!/<a [^>]*href=\{exportHref\}/.test(s), `${f}: raw export anchor`); assert.ok(s.includes('ExportLink')); }
  for (const f of ['src/pages/Invoices.jsx', 'src/pages/Collection.jsx']) assert.ok(fs.readFileSync(f, 'utf8').includes('useExportGate'), f);
  for (const [f, key] of [['src/pages/InsightsHub.jsx', 'export.dashboard'], ['src/pages/AnalysisResultPage.jsx', 'export.collection'], ['src/pages/furas/FurasContracts.jsx', 'export.contracts'], ['src/pages/furas/FurasContract.jsx', 'export.contracts'], ['src/pages/InvoicePage.jsx', 'export.invoice']]) assert.ok(fs.readFileSync(f, 'utf8').includes(`useGate('${key}')`), `${f} gates ${key}`);
  const lt = fs.readFileSync('src/components/invoices/ListTools.jsx', 'utf8'); assert.ok(lt.includes('exportDenied'));
  assert.ok(/ACTIONS/.test(fs.readFileSync('src/data/accessModel.js', 'utf8')));
});
ok('the Decision Room keeps follow-up flags only (no assignment) and the settings nav lists the two administration pages by module', () => {
  const nav = fs.readFileSync('src/components/settings/SettingsNav.jsx', 'utf8'); assert.ok(nav.includes('/settings/users') && nav.includes('/settings/roles') && nav.includes('canOpenRoute'));
  const dr = fs.readFileSync('src/data/useDecisions.js', 'utf8'); assert.ok(!/assign|assignee/i.test(dr.replace(/Nothing is delegated[^\n]*/g, '')));
});

ok('/planning/:planId: editing a plan is refused to a read-only role and to a scope that does not cover the plan (the page reads access.readOnly + the effective planning scope; the server refuses too); the action gate matrix is unchanged', () => {
  const page = fs.readFileSync('src/pages/PlanDetail.jsx', 'utf8'); assert.ok(/readOnly = !!access\.readOnly/.test(page) && /access\.effectiveScope\('planning'\)/.test(page) && /canEditPlan\(plan, \{ geoScope: geo, readOnly \}\)/.test(page), 'the plan page decides editing from the read-only role and the planning scope');
  const g = (me) => allGates(accOf(me));
  assert.equal(g(ADMIN)['planning.update'].allowed, true); assert.equal(g(AUDITOR)['planning.update'].allowed, false); assert.deepEqual(g(AUDITOR)['planning.update'].reason, READ_ONLY_REASON); assert.equal(g(COLLECTOR)['planning.update'].allowed, false);
  assert.equal(accOf(ADMIN).can('metrics'), true); assert.equal(accOf(ONLY_METRICS).can('metrics'), true); assert.equal(accOf(NOBODY).can('metrics'), false); assert.equal(canOpenRoute('/settings/metrics', canOf(NOBODY)), false, 'the link target is not reachable without the module');
});

chain.then(() => { console.log(`access client (module model): ${n} test groups passed`); });
