// ENDPOINT → REQUIRED MODULE map of the data service (docs/access-control.md S4). Pure: no data, no store, no identity — the HTTP layer (server/api.js) authenticates the request, asks this module what the endpoint needs,
// checks the user's modules and derives the geographic scope from the modules that were SATISFIED (every module of a user carries the user's ONE scope).
// There are no export / upload / review permissions any more: an export, an upload and a confirmation are part of the module that owns the page. The only extra switch is the ROLE-level «read-only» flag: a requirement with
// `write:true` is refused (403 read_only_role) for a read-only role.
//
// requiredPermissionFor(method, path, body) →
//   { kind: 'public' }                                   no authentication (login / activation)
//   { kind: 'auth', note }                               any authenticated user (labels and dates only; figures are counted over the user's own geographic access)
//   { kind: 'identity', modules?, write?, note? }        /auth/* and /admin/*: the identity module authorises (users / roles) itself; `modules` documents the any-of list, `write` the mutating calls
//   { kind: 'permission', anyOf: [module ids], note, write? }   the user needs AT LEAST ONE of `anyOf` (module ids; the key keeps its earlier name)
//   { kind: 'unknown' }                                  no such endpoint → 404
// Scope rule (api.js): access = UNION of effectiveScopeFor(user, m) for the m in `anyOf` the user holds (all equal: ONE scope per user), then intersected with the client's requested narrowing
// (organisation / Amanah / municipality filters), which can only narrow.

/** every module whose pages read the shared metric layer (snapshot / series / bridge) */
export const DATA_MODULES = ['dashboard', 'invoices_collected', 'invoices_uncollected', 'exclusions', 'contracts', 'enforcement', 'planning', 'decisions', 'smart_reports'];
export const DATA_VIEWS = DATA_MODULES; // earlier name

const F = (b) => (b && b.filters && typeof b.filters === 'object' ? b.filters : {});
const set = (v) => v !== undefined && v !== null && v !== '' && v !== 'all';
/** the exclusions register: lists by exclusion reason, with the evidence records */
const exclusionMode = (b) => set(F(b).primary) || b?.withExclusions === true;
/** the uncollected worklist / non-collection drill-down: priority, non-collection classification, ageing, eligibility for referral */
const collectionMode = (b) => b?.withNc === true || b?.withPriority === true || !!F(b).nc || F(b).eligible === true || (F(b).ageMin !== undefined && F(b).ageMin !== null) || set(F(b).age) || set(F(b).category);
const UNCOLLECTED_STATES = new Set(['open', 'uncollected', 'noncollected']);

/** the modules a /list request needs (any ONE): the doc S4 «by filters.state / mode» */
export function listPermissions(body) {
  if (exclusionMode(body)) return ['exclusions'];
  if (collectionMode(body)) return ['invoices_uncollected'];
  const f = F(body);
  if (set(f.exec)) return ['invoices_collected', 'invoices_uncollected', 'enforcement']; // the enforcement dimension: any module that lists invoice rows or the orders
  if (UNCOLLECTED_STATES.has(f.state)) return ['invoices_uncollected'];
  if (f.state === 'excluded' || set(f.reason) || set(f.rule)) return ['exclusions', 'invoices_uncollected'];
  return ['invoices_collected']; // the collected register (the default list)
}
/** the modules of a CSV export request: the SAME as the list it exports (export is part of the module) */
export function exportPermissions(body) { return listPermissions(body); }

const P = (anyOf, note, extra = {}) => ({ kind: 'permission', anyOf, note, ...extra });
const ID = (modules, note, write = false) => ({ kind: 'identity', modules, note, ...(write ? { write: true } : {}) });

/** the machine-readable table (also what the tests iterate): [method, path, resolver(body) → requirement] */
export const ENDPOINTS = [
  ['POST', '/auth/login', () => ({ kind: 'public' })],
  ['POST', '/auth/activate', () => ({ kind: 'public' })],
  ['GET', '/auth/me', () => ({ kind: 'identity' })],
  ['POST', '/auth/logout', () => ({ kind: 'identity' })],
  ['GET', '/meta', () => ({ kind: 'auth', note: 'labels, dates and figures counted over the user\'s own geographic access' })],
  ['POST', '/snapshot', () => P(DATA_MODULES, 'any data module that reads the metric layer; scope = the user\'s scope')],
  ['POST', '/series', () => P(DATA_MODULES, 'same as /snapshot')],
  ['POST', '/bridge', () => P(DATA_MODULES, 'same as /snapshot')],
  ['POST', '/list', (b) => P(listPermissions(b), 'by mode: exclusions register → exclusions; uncollected worklist / non-collection → invoices_uncollected; enforcement dimension → invoices_collected|invoices_uncollected|enforcement; otherwise the collected register → invoices_collected')],
  ['GET', '/export.csv', (b) => P(exportPermissions(b), 'the module of the same mode as /list (no separate export permission); all filtered rows, same mask')],
  ['POST', '/invoice', () => P(['invoices_collected', 'invoices_uncollected', 'exclusions', 'enforcement'], 'an invoice opens for any module that lists invoice rows; its documents belong to the module')],
  ['POST', '/noncollection', () => P(['invoices_uncollected'], 'non-collection analysis')],
  ['POST', '/worklist', () => P(['invoices_uncollected'], 'uncollected worklist')],
  ['POST', '/anomalies', () => P(['invoices_uncollected', 'exclusions'], 'data-quality findings of invoice rows')],
  ['POST', '/distributions', () => P(['dashboard', 'invoices_uncollected'], 'chart distributions')],
  ['POST', '/plan-actions', () => P(['planning'], 'planning action lines («أين نركز»): the planning module only — no other data module reads it')],
  ['POST', '/contracts', () => P(['contracts'], 'contract cards + rollup')],
  ['POST', '/contract', () => P(['contracts'], 'one contract number')],
  ['GET', '/sanad-cases', () => P(['enforcement'], 'Sanad / white-lands enforcement feed')],
  ['POST', '/order-match', () => P(['enforcement'], 'reference resolution (read-only on the server; link review decisions are made in the client, which a read-only role may not make)')],
  ['POST', '/order-debtor-invoices', () => P(['enforcement'], 'same-debtor invoices of an order')],
  ['POST', '/enforcement-collections', () => P(['enforcement'], 'amounts collected through enforcement')],
  ['POST', '/exclusion-check', () => P(['exclusions'], 'row validation of the exclusions template (read-only on the server; applying exclusions happens in the client, which a read-only role may not do)')],
  ['POST', '/upload', () => P(['data_sources'], 'upload invoice records (owner = the authenticated user)', { write: true })],
  ['POST', '/upload/clear', () => P(['data_sources'], 'remove the user\'s own uploaded records', { write: true })],
  ['POST', '/sources', () => P(['data_sources'], 'source report, counts over visible records')],
  ['POST', '/quality', () => P(['data_sources'], 'data-quality counts over visible records')],
  ['GET', '/furas/status', () => P(['contracts'], 'Furas dataset mode (local-only)')],
  ['GET', '/furas/summary', () => P(['contracts'], 'Furas dataset mode')],
  ['POST', '/furas/contracts', () => P(['contracts'], 'Furas dataset mode')],
  ['POST', '/furas/contract', () => P(['contracts'], 'Furas dataset mode')],
  ['GET', '/furas/decisions', () => P(['contracts'], 'Furas dataset mode')],
  // revenue plans («خطط الإيرادات»): module `planning`; every mutating call is write:true (a read-only role is refused 403 read_only_role). The plan-level scope check (403 forbidden + reason) is made by server/plans/service.js.
  // The per-plan routes (GET/PUT /plans/:id, GET /plans/:id/versions/:n, GET /plans/:id/audit) are matched by prefix in requiredPermissionFor (spec §10: no draft / activate / archive routes).
  ['GET', '/plans', () => P(['planning'], 'revenue plans: list (masked for a restricted viewer)')],
  ['POST', '/plans', () => P(['planning'], 'save a NEW plan (owner = the authenticated user; may set the caller\'s personal default)', { write: true })],
  ['PUT', '/plans/default', () => P(['planning'], 'the caller\'s OWN default plan (a personal preference: not a plan change, so a read-only role may set it)')],
  ['GET', '/plans/system-default', () => P(['planning'], 'the GLOBAL default plan every user opens (as this caller sees it)')],
  ['PUT', '/plans/system-default', () => P(['planning'], 'change the GLOBAL default plan (needs all-entities access and a non-read-only role)', { write: true })],
  ['GET', '/plans/references', () => P(['planning'], 'the reference plan per calendar year')],
  ['POST', '/plans/references', () => P(['planning'], 'set / clear the reference plan of a year (needs all-entities access)', { write: true })],
  ['POST', '/plans/import-legacy', () => P(['planning'], 'import the browser\'s legacy plan record as a saved plan', { write: true })],
  ['POST', '/admin/preview', () => P(['users', 'roles'], 'effective-access preview of a role + scope; the figures are clamped to the administrator\'s own data scope')],
  // the identity module (server/identity/service.js) enforces these itself; listed so the map is complete
  ['GET', '/admin/catalog', () => ID(['users', 'roles'], 'modules, starter roles, hierarchy')],
  ['GET', '/admin/users', () => ID(['users'], 'user list')],
  ['POST', '/admin/users', () => ID(['users'], 'create a user (one-time activation code); read-only role refused', true)],
  ['GET', '/admin/roles', () => ID(['users', 'roles'], 'role list (the user pages need it for the role picker)')],
  ['POST', '/admin/roles', () => ID(['roles'], 'create a role; read-only role refused', true)],
  ['GET', '/admin/audit', () => ID(['users', 'roles'], 'audit trail')]
];
const BY_KEY = new Map(ENDPOINTS.map(([m, p, f]) => [`${m} ${p}`, f]));

/** the requirement of a request. `path` is relative to /api (e.g. '/snapshot'). `body` is the parsed JSON body (or, for /export.csv, the parsed `q` parameter). */
export function requiredPermissionFor(method, path, body) {
  const m = String(method || 'GET').toUpperCase(); const p = String(path || '');
  if (p.startsWith('/auth/') || p.startsWith('/admin/')) {
    const f = BY_KEY.get(`${m} ${p}`); if (f) return f(body || {});
    if (p.startsWith('/admin/users/')) return ID(['users'], 'one user / activation code', m !== 'GET');
    if (p.startsWith('/admin/roles/')) return ID(['roles'], 'one role', m !== 'GET');
    return { kind: 'identity' }; // the rest of /auth/*: the identity module answers (login, activation, me, logout)
  }
  if (p.startsWith('/plans/')) { const f0 = BY_KEY.get(`${m} ${p}`); return f0 ? f0(body || {}) : P(['planning'], 'revenue plans: one plan (read, versions, audit) or one of its mutations', m === 'GET' ? {} : { write: true }); }
  if (p.startsWith('/furas/')) return P(['contracts'], 'Furas dataset mode (any method)'); // the Furas routes answer GET and POST alike
  const f = BY_KEY.get(`${m} ${p}`);
  return f ? f(body || {}) : { kind: 'unknown' };
}

/** the module ids that satisfy a requirement, in order (empty for public / auth / identity / unknown) */
export const permissionsOfRequirement = (r) => (r && r.kind === 'permission' ? r.anyOf : []);
