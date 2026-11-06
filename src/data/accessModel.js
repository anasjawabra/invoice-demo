// CLIENT SIDE OF ACCESS CONTROL (simplified model, docs/access-control.md «SIMPLIFIED MODEL» S1–S5) — pure helpers (no React, no storage, no network) shared by AuthContext, the route guards, the navigation,
// the action gates and tests/access-client.test.mjs.
// ONE switch per module (13 module ids), ONE role per user, ONE geographic scope per user, and a role-level «Read-only» switch.
//   · module access enables the module's existing functionality (view, exports, uploads, confirmations, follow-up) inside the user's scope;
//   · a read-only role may open its modules and EXPORT, but every action that changes something (upload, apply, confirm, flag, note, plan edit) is disabled WITH the reason;
//   · module off ⇒ no navigation entry, the direct URL is «غير مصرّح», its requests and its exports are refused by the service (403).
// The server is the authority (401 / 403 + scope injection); everything here only decides what the UI SHOWS, enables or requests. It never widens: the page filters can only NARROW the account's own scope.
// Identity, role and authorised entities come ONLY from the authenticated account (`me`); there is no organisation / persona switcher.
import { MODULES, describeUserSummary } from './permissions';
import { displayName, initialsFor } from '../utils/identity';
import { exportPermissions } from '../../server/endpointAccess.js';
import { ALL_SCOPE, EMPTY_SCOPE, normalizeGeoScope, unionGeoScopes, describeGeoScope, geoScopeKey, isAllGeoScope } from './geoScope';

/** the modules whose pages read the shared metric layer (mirror of server/endpointAccess.js DATA_MODULES) */
export const DATA_MODULES = ['dashboard', 'invoices_collected', 'invoices_uncollected', 'exclusions', 'contracts', 'enforcement', 'planning', 'decisions', 'smart_reports'];
/** the modules whose scope is geographic: the data modules + the data sources (administration and the metrics dictionary show no figures) */
export const GEO_MODULES = [...DATA_MODULES, 'data_sources'];
/** the modules with something to CHANGE (uploads, confirmations, follow-up flags, plan edits, user / role writes): a read-only role cannot use them */
export const MUTATING_MODULES = ['decisions', 'exclusions', 'enforcement', 'planning', 'data_sources', 'users', 'roles'];

const nameOfModule = (m, lang) => (lang === 'en' ? (m.en ?? m.nameEn) : (m.ar ?? m.nameAr)) || m.id;
/** the name of a module in a language ('ar' | 'en'); an unknown id returns the id */
export const moduleName = (id, lang = 'ar') => { const m = (MODULES || []).find((x) => x.id === id); return m ? nameOfModule(m, lang) : String(id); };

/* ---------------------------------------------------------------- route → module map ---------------------------------------------------------------- */
// kind: 'page' (needs at least one of `any` = module ids) · 'redirect' (a superseded address: the guard applies to its destination) · 'landing' (redirects to the first page the user may open) · 'open' (any signed-in user).
// `pattern` is the react-router path relative to the layout route ('' = the index route). Every <Route path> of src/App.jsx has an entry here (tests/access-client.test.mjs checks it).
export const ROUTE_PERMISSIONS = [
  { pattern: '', kind: 'landing' },
  { pattern: 'insights', kind: 'page', any: ['dashboard'] },
  { pattern: 'planning', kind: 'page', any: ['planning'] },
  { pattern: 'planning/:planId', kind: 'page', any: ['planning'] },
  { pattern: 'smart-reports', kind: 'page', any: ['smart_reports'] },
  { pattern: 'decisions', kind: 'page', any: ['decisions'] },
  { pattern: 'settings', kind: 'landing-settings' },
  { pattern: 'settings/metrics', kind: 'page', any: ['metrics'] },
  { pattern: 'settings/metrics/:id', kind: 'page', any: ['metrics'] },
  { pattern: 'settings/users', kind: 'page', any: ['users'] },
  { pattern: 'settings/roles', kind: 'page', any: ['roles'] },
  { pattern: 'contracts', kind: 'page', any: ['contracts'] },
  { pattern: 'contracts/:no', kind: 'page', any: ['contracts'] },
  { pattern: 'invoices', kind: 'page', any: ['invoices_collected'] },
  // an invoice opens from any list that shows invoice rows (the service's /invoice answers the same four modules)
  { pattern: 'invoices/:id', kind: 'page', any: ['invoices_collected', 'invoices_uncollected', 'exclusions', 'enforcement'] },
  { pattern: 'collection', kind: 'page', any: ['invoices_uncollected'] },
  { pattern: 'analysis/:taskId', kind: 'page', any: ['invoices_uncollected'] },
  { pattern: 'exclusions', kind: 'page', any: ['exclusions'] },
  { pattern: 'products', kind: 'page', any: ['data_sources'] },
  { pattern: 'products/:key', kind: 'page', any: ['data_sources'] },
  { pattern: 'enforcement', kind: 'page', any: ['enforcement'] },
  { pattern: 'enforcement/violations/:key', kind: 'page', any: ['enforcement'] },
  { pattern: 'enforcement-orders/:enforceNum', kind: 'page', any: ['enforcement'] },
  // superseded addresses (the guard of the destination applies)
  ...['executive', 'dashboard', 'reports', 'assistant', 'strategic', 'decision-room', 'what-if', 'noncollection', 'settings/data-sources', 'settings/data-quality', 'data-sources', 'metrics', 'risk', 'enforcement-orders', 'sanad-orders', 'sanad-orders/:enforceNum', 'investment-invoices', 'investment-invoices/:id']
    .map((pattern) => ({ pattern, kind: 'redirect' })),
  { pattern: 'not-authorised', kind: 'open' },
  { pattern: '*', kind: 'open' }
];
export const ROUTE_MODULES = ROUTE_PERMISSIONS;

/** the first pages offered to a user landing on «/», in the order of the sidebar */
export const LANDING_ORDER = ['/insights', '/collection', '/invoices', '/exclusions', '/contracts', '/enforcement', '/planning', '/decisions', '/smart-reports', '/products', '/settings/metrics', '/settings/users', '/settings/roles'];
export const SETTINGS_LANDING_ORDER = ['/settings/metrics', '/settings/users', '/settings/roles'];

const segs = (p) => String(p || '').split('/').filter(Boolean);
/** does a route pattern (react-router style, no wildcards except the final «*») match a pathname? */
export function matchPattern(pattern, pathname) {
  const ps = segs(pattern); const xs = segs(pathname);
  if (pattern === '*') return true;
  if (ps.length !== xs.length) return false;
  return ps.every((s, i) => (s.startsWith(':') ? xs[i].length > 0 : s === xs[i]));
}
/** the route entry of a pathname (the most specific: static segments win over parameters; «*» last) */
export function routeEntry(pathname) {
  const path = String(pathname || '/').split('?')[0].split('#')[0];
  let best = null; let bestScore = -1;
  for (const r of ROUTE_PERMISSIONS) {
    if (r.pattern === '*') continue;
    if (!matchPattern(r.pattern, path)) continue;
    const score = segs(r.pattern).reduce((a, s) => a + (s.startsWith(':') ? 1 : 2), 0) + (r.pattern === '' ? 0 : 1);
    if (score > bestScore) { best = r; bestScore = score; }
  }
  return best || ROUTE_PERMISSIONS.find((r) => r.pattern === '*');
}
const hasIn = (coll, id) => (!coll ? false : coll instanceof Set ? coll.has(id) : Array.isArray(coll) ? coll.includes(id) : typeof coll.has === 'function' ? coll.has(id) : false);
const isCtxObject = (x) => x && typeof x === 'object' && !(x instanceof Set) && !Array.isArray(x) && typeof x.has !== 'function';
/** a `can` function from: a function, a Set / array of module ids, or an access-like object `{ can, readOnly }` */
const toCan = (ctx) => (typeof ctx === 'function' ? ctx : isCtxObject(ctx) && typeof ctx.can === 'function' ? ctx.can : (id) => hasIn(ctx, id));
/** is the role read-only? only an access-like object `{ readOnly }` says so (a bare `can` function / Set carries no role) */
const toReadOnly = (ctx) => isCtxObject(ctx) && ctx.readOnly === true;

/** can the user open this pathname? (the module check of the guard; redirects and open pages are allowed here, their destination is checked in turn) */
export function canOpenRoute(pathname, canOrSet) {
  const can = toCan(canOrSet); const e = routeEntry(pathname);
  if (!e) return true;
  if (e.kind === 'page') return e.any.some(can);
  return true;
}
export const routeModules = (pathname) => { const e = routeEntry(pathname); return e && e.kind === 'page' ? e.any : []; };
export const routePermissions = routeModules;
/** the first page (sidebar order) the user may open, or null when they hold nothing that opens a page */
export function firstAllowedRoute(canOrSet, order = LANDING_ORDER) {
  const can = toCan(canOrSet);
  return order.find((p) => canOpenRoute(p, can)) || null;
}

/* ---------------------------------------------------------------- navigation ---------------------------------------------------------------- */
/** the sidebar: groups → items; `filterNav` keeps only the items whose module the user holds and drops empty groups */
export const NAV_GROUPS = [
  { key: 'overview', ar: 'نظرة عامة', en: 'Overview', items: [{ to: '/insights', icon: 'dashboard' }, { to: '/decisions', icon: 'decision-room', onlyWithout: '/insights' }] },
  { key: 'collection', ar: 'إدارة التحصيل', en: 'Collection management', items: [{ to: '/collection', icon: 'invoice-open' }, { to: '/invoices', icon: 'invoice-paid' }, { to: '/enforcement', icon: 'enforcement' }, { to: '/exclusions', icon: 'risk' }, { to: '/contracts', icon: 'contracts' }] },
  { key: 'planning', ar: 'التخطيط والتقارير', en: 'Planning & reports', items: [{ to: '/planning', icon: 'decision-room' }, { to: '/smart-reports', icon: 'smart-reports' }] },
  { key: 'data', ar: 'البيانات', en: 'Data', items: [{ to: '/products', icon: 'data-sources' }] }
];
/** the «إعدادات النظام» pages (SettingsNav) */
export const SETTINGS_ROUTES = ['/settings/metrics', '/settings/users', '/settings/roles'];
export function filterNav(canOrSet, groups = NAV_GROUPS) {
  const can = toCan(canOrSet);
  return groups
    .map((g) => ({ ...g, items: g.items.filter((it) => canOpenRoute(it.to, can) && !(it.onlyWithout && canOpenRoute(it.onlyWithout, can))) }))
    .filter((g) => g.items.length > 0);
}
export const settingsPagesFor = (canOrSet, pages = SETTINGS_ROUTES) => { const can = toCan(canOrSet); return pages.filter((p) => canOpenRoute(p, can)); };
export const canOpenSettings = (canOrSet) => settingsPagesFor(canOrSet).length > 0;

/* ---------------------------------------------------------------- action gates ---------------------------------------------------------------- */
// ONE place names which module each user action belongs to; the pages ask `gate(access, key)` and show the reason when it is not allowed.
//   allowed = the module is held  AND  (the action changes something ⇒ the role is not read-only).
// Exports have NO separate permission: an export is allowed iff the module that owns the data is held, and a read-only role may export.
export const READ_ONLY_REASON = { ar: 'هذا الدور للقراءة فقط', en: 'This role is read-only' };
// `module` = the owning module, or a list when several modules own the screen (any ONE of them is enough)
const A = (module, mutating) => ({ module: [].concat(module)[0], modules: [].concat(module), mutating });
export const ACTIONS = {
  'decision.followup': A('decisions', true),
  'invoice.note': A('decisions', true),
  'exclusion.upload': A('exclusions', true),
  'exclusion.manage': A('exclusions', true),
  'enforcement.review': A('enforcement', true),
  'enforcement.upload': A('enforcement', true),
  'planning.update': A('planning', true),
  'data.upload': A('data_sources', true),
  'export.dashboard': A('dashboard', false),
  'export.invoices': A('invoices_collected', false),
  'export.invoice': A(['invoices_collected', 'invoices_uncollected', 'exclusions', 'enforcement'], false), // the review report of ONE invoice: the invoice page opens for any of the four modules that list invoice rows
  'export.collection': A('invoices_uncollected', false),
  'export.exclusions': A('exclusions', false),
  'export.contracts': A('contracts', false),
  'export.enforcement': A('enforcement', false),
  'export.planning': A('planning', false),
  'export.reports': A('smart_reports', false)
};
/** the reason a module-less user reads: «هذا الإجراء يتطلب الوصول إلى وحدة «…»» */
export const moduleMissingReason = (modules) => {
  const ids = [].concat(modules);
  return { ar: `يتطلب هذا الإجراء الوصول إلى ${ids.length > 1 ? 'إحدى الوحدات' : 'وحدة'} «${ids.map((m) => moduleName(m, 'ar')).join('» أو «')}».`, en: `This action needs access to ${ids.length > 1 ? 'one of the modules' : 'the module'} «${ids.map((m) => moduleName(m, 'en')).join('» or «')}».` };
};
/** { allowed, module, permission (= module, kept for older callers), mutating, readOnly, reason:{ar,en}|null } — `reason` is what a disabled control / a note says */
export function gate(ctx, key) {
  const a = ACTIONS[key];
  if (!a) return { allowed: false, module: null, permission: null, mutating: false, readOnly: false, reason: { ar: 'إجراء غير معروف.', en: 'Unknown action.' } };
  const can = toCan(ctx); const held = a.modules.some(can); const ro = toReadOnly(ctx);
  const blockedByRole = held && a.mutating && ro;
  const allowed = held && !blockedByRole;
  return { allowed, module: a.module, permission: a.module, mutating: a.mutating, readOnly: blockedByRole, reason: allowed ? null : (blockedByRole ? READ_ONLY_REASON : moduleMissingReason(a.modules)) };
}
/** every gate at once (what RevenueContext exposes as `rev.gates`) */
export function allGates(ctx) { const out = {}; for (const k of Object.keys(ACTIONS)) out[k] = gate(ctx, k); return out; }

/* ---- the CSV export of a filtered list: which module owns the rows — the SAME pure rule the data service applies to /export.csv (mode → module), so the button and the 403 never disagree ---- */
/** the modules that own a /list (and so its CSV) request — ANY ONE of them opens it. `body` = `{ filters, withExclusions, withNc, withPriority }` */
export const listModules = (body = {}) => exportPermissions(body);
/** the export gate of a filtered list: allowed iff a module that owns the list is held (a read-only role may export); `reason` names the modules */
export function exportGate(ctx, filters = {}) {
  const need = listModules({ filters }); const can = toCan(ctx);
  const allowed = need.some(can);
  return { allowed, anyOf: need, reason: allowed ? null : moduleMissingReason(need) };
}
/** `canReview` — a DERIVED convenience for code that has not moved to granular checks: true iff the user holds a module with something to change AND the role is not read-only.
 *  The read-only Auditor → false; the Administrator → true (unchanged behaviour for `demo`). */
export const REVIEW_MODULES = MUTATING_MODULES;
export const deriveCanReview = (ctx) => !toReadOnly(ctx) && REVIEW_MODULES.some(toCan(ctx));

/* ---------------------------------------------------------------- the access object (what useAccess() returns, minus React state) ---------------------------------------------------------------- */
/** the modules of `me` (`modules`, or its alias `permissions`) */
export const modulesOf = (me) => (Array.isArray(me?.modules) ? me.modules : Array.isArray(me?.permissions) ? me.permissions : []);
/** a stable fingerprint of what the user can do and see: when it changes, pages remount and caches clear (identity changes of OTHER users bump the version but not this key) */
export function accessKeyOf(me) {
  if (!me) return 'none';
  const mods = [...modulesOf(me)].sort();
  const scope = geoScopeKey(me.scope ?? me.scopes?.[mods[0]] ?? ALL_SCOPE);
  return `${me.id}|${me.status}|${me.role?.id || ''}|${me.role?.readOnly ? 'ro' : 'rw'}|${mods.join(',')}|${scope}`;
}
export function buildAccess(me, lang0 = 'ar') {
  const set0 = new Set(modulesOf(me));
  const readOnly = me?.role?.readOnly === true;
  const can = (id) => set0.has(id);
  const canAny = (ids) => (ids || []).some(can);
  // ONE scope per user (`me.scope`); `me.scopes[module]` is the same scope per held module. A held module with no scope stated is treated as EMPTY (never wider than the service stated)
  const userScope = me?.scope ? normalizeGeoScope(me.scope) : null;
  const scopeFor = (id) => (set0.has(id) ? normalizeGeoScope(me?.scopes?.[id] ?? userScope ?? EMPTY_SCOPE) : EMPTY_SCOPE);
  const geoScope = GEO_MODULES.filter(can).reduce((u, p) => unionGeoScopes(u, scopeFor(p)), EMPTY_SCOPE);
  /** the entities the account may see for a module — the ONLY source of "which Amanahs / municipalities" for every page filter, list, report and saved result (page filters can only narrow it further) */
  const effectiveScope = (id) => scopeFor(id);
  // the geographic part of the summary line («أمانة محافظة جدة · 3 بلديات»): the SAME wording the service uses for `me.summary` (describeUserSummary without the role); the service's own text is the fallback
  const scopeSummary = (lang = lang0) => {
    if (userScope) return describeUserSummary({ scope: userScope }, null, lang);
    const s = me?.scopeSummary;
    if (s && typeof s === 'object' && (s.ar || s.en)) return (lang === 'en' ? s.en : s.ar) || s.ar || s.en;
    if (typeof s === 'string' && s) return s;
    return describeGeoScope(geoScope, lang);
  };
  /** «Collection Officer · Jeddah Amanah · 3 municipalities» — the server's `me.summary`; falls back to role name + scope summary */
  const summary = (lang = lang0) => {
    const s = me?.summary;
    const given = s && typeof s === 'object' ? (lang === 'en' ? s.en : s.ar) || s.ar || s.en : typeof s === 'string' ? s : '';
    if (given) return given;
    const r = roleName(me, lang);
    return [r, scopeSummary(lang)].filter(Boolean).join(' · ');
  };
  const ctx = { can, readOnly };
  return {
    me: me || null, can, canAny, scopeFor, geoScope, scopeSummary, summary, effectiveScope, permissions: set0, modules: [...set0],
    role: me?.role || null, readOnly, canReview: deriveCanReview(ctx), gates: allGates(ctx), accessKey: accessKeyOf(me), allScope: isAllGeoScope(geoScope)
  };
}

/** the role name (one role per user), both languages */
export function roleName(me, lang = 'ar') {
  const r = me?.role;
  if (r) return (lang === 'en' ? r.nameEn : r.nameAr) || r.nameAr || r.nameEn || '';
  const t = lang === 'en' ? me?.titleEn : me?.titleAr;
  return t || '';
}
export const roleSummary = roleName;
/** the `user` shape the pages already read (name / nameAr / nameEn / role / roleAr / roleEn / avatar / user), built from the authenticated account `me` — no secret, no permission logic, no organisation */
export function userOf(me) {
  if (!me) return null;
  const roleAr = roleName(me, 'ar'); const roleEn = roleName(me, 'en');
  // ONE identity (utils/identity.js): the name in each language is the account's own value for that language, else the other language's value of the SAME record; initials come from the displayed name (a stored `avatar` is ignored)
  return { id: me.id, user: me.username, name: displayName(me, 'en'), nameEn: displayName(me, 'en'), nameAr: displayName(me, 'ar'), role: roleEn || roleAr, roleEn: roleEn || roleAr, roleAr: roleAr || roleEn, avatar: initialsFor(me, 'en'), email: me.email || null };
}
/** the error a signed-in call can get from the data service, in plain words (AR / EN); `code` = the body's error (`read_only_role` gets its own text) */
export function accessErrorText(status, code, lang = 'ar') {
  const ar = lang !== 'en';
  if (status === 401) return ar ? 'انتهت الجلسة أو لم يعد الحساب صالحًا. سجّل الدخول من جديد.' : 'Your session ended or the account is no longer valid. Please sign in again.';
  if (status === 403 && code === 'read_only_role') return ar ? READ_ONLY_REASON.ar + '، فلا يمكنها تنفيذ هذا الإجراء.' : `${READ_ONLY_REASON.en}, so it cannot perform this action.`;
  if (status === 403) return ar ? 'ليست لديك صلاحية للاطلاع على هذه البيانات أو تنفيذ هذا الإجراء.' : 'You do not have permission to see this data or perform this action.';
  return code || '';
}
/** sign-in / activation error codes from the server → text */
export function authErrorText(code, lang = 'ar') {
  const ar = lang !== 'en';
  const M = {
    invalid_credentials: ['اسم المستخدم أو كلمة المرور غير صحيحة.', 'The username or password is incorrect.'],
    account_inactive: ['هذا الحساب موقوف. تواصل مع مسؤول النظام.', 'This account is deactivated. Contact the system administrator.'],
    account_not_activated: ['لم يُفعَّل هذا الحساب بعد. استخدم رمز التفعيل الذي أعطاك إياه مسؤول النظام.', 'This account is not activated yet. Use the activation code your administrator gave you.'],
    too_many_attempts: ['محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.', 'Too many attempts. Wait a minute and try again.'],
    invalid_activation_code: ['رمز التفعيل غير صالح أو منتهٍ أو مستخدم من قبل. اطلب رمزًا جديدًا من مسؤول النظام.', 'The activation code is invalid, expired or already used. Ask the administrator for a new one.'],
    activation_expired: ['انتهت صلاحية رمز التفعيل. اطلب رمزًا جديدًا من مسؤول النظام.', 'The activation code has expired. Ask the administrator for a new one.'],
    validation_error: ['كلمة المرور لا تستوفي الشروط: ثمانية أحرف على الأقل.', 'The password does not meet the rules: at least eight characters.'],
    weak_password: ['كلمة المرور قصيرة: ثمانية أحرف على الأقل.', 'The password is too short: at least eight characters.'],
    password_mismatch: ['كلمتا المرور غير متطابقتين.', 'The two passwords do not match.'],
    unauthenticated: ['انتهت الجلسة. سجّل الدخول من جديد.', 'Your session ended. Please sign in again.'],
    network: ['تعذّر الوصول إلى الخدمة. حاول مرة أخرى.', 'The service could not be reached. Try again.']
  };
  const m = M[code]; if (m) return ar ? m[0] : m[1];
  return ar ? 'تعذّر تسجيل الدخول. حاول مرة أخرى.' : 'Sign-in failed. Please try again.';
}
