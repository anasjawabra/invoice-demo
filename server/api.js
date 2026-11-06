// HTTP layer. One JSON endpoint per question the UI asks; every endpoint is answered from the columnar store.
import { riyadhToday } from '../src/data/clock.js';
import { ENTITIES } from '../src/data/catalog.js';
import { ENTITY_INDEX, dayNum } from '../src/data/catalog.js';
import { currentStore } from './store.js';
import { snapshot, series, bridge, makeCtx, lookupId, lookupRef, lookupComposite } from './engine.js';
import { list, exportChunks, worklist, anomalies, bumpEpoch, invoiceCandidates } from './lists.js';
import { contractCards, contractCard, contractRollup, sanadCases } from './contracts.js';
import { meta, quality } from './misc.js';
import { sourcesReport } from './sourcesReport.js';
import { resolveReferences, sameDebtorInvoices } from './orderMatch.js';
import { enforcementCollections } from './enforcementCollections.js';
import { detail } from './materialize.js';
import { appendRecord, recordCompositeKey } from './fixtures.js';
import { checkExclusionRows } from './exclusionUpload.js';
import { nonCollectionAnalysis } from './noncollection.js';
import { chartDistributions } from './distributions.js';
import { actionLines } from './planningActions.js';
import { furasSummary, furasContracts, furasContract, furasDecisionInput, furasAvailableFor } from './furasData.js';
import { ALL_SCOPE, EMPTY_SCOPE, GEO_HIERARCHY, normalizeGeoScope, intersectGeoScopes, unionGeoScopes, geoScopeKey, entireAmanahGrant, validateGeoScope, describeGeoScope } from '../src/data/geoScope.js';
import { parseMuniKey, classifySourceValues } from '../src/data/municipalityModel.js';
import { authenticate as identityAuthenticate, effectiveScopeFor, currentAccessVersion, auditDenied } from './identity/index.js';
import { handleIdentityRoute, resolveAccess, describeAccess } from './adminApi.js';
import { accessTable, accessKeyOf, isVisible, visibleCode, bumpAccessEpoch } from './accessMask.js';
import { requiredPermissionFor, DATA_MODULES } from './endpointAccess.js';
import { handlePlansRoute } from './plansApi.js';
import { contractVisible, requestVisible } from './contracts.js';

const memo = new Map();
const MAX_MEMO = 60;
function memoize(key, fn) {
  if (memo.has(key)) { const v = memo.get(key); memo.delete(key); memo.set(key, v); return v; }
  const v = fn(); memo.set(key, v); if (memo.size > MAX_MEMO) memo.delete(memo.keys().next().value); return v;
}
let epoch = 0;
let lastAccessVersion = null;

function readBody(req) {
  // on Vercel the platform has already read and parsed the body (req.body); under Node http / Vite it is undefined and the stream is read below
  if (req.body !== undefined && req.body !== null) {
    try { const b = req.body; return Promise.resolve(Buffer.isBuffer(b) ? (b.length ? JSON.parse(b.toString('utf8')) : {}) : typeof b === 'string' ? (b ? JSON.parse(b) : {}) : b); } catch (e) { return Promise.reject(e); }
  }
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > 20e6) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const send = (res, code, obj) => { const body = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); };
const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));

/* ====================================================================== AUTHENTICATION + AUTHORISATION (docs/access-control.md S4; SIMPLIFIED MODEL: module access + ONE role + ONE scope)
   Every endpoint except /auth/login and /auth/activate is authenticated (401) and mapped to the module(s) it needs (server/endpointAccess.js → 403 `{error:'forbidden', permission, module}` with no data; a mutating endpoint is refused for a read-only role: 403 `read_only_role`). The geographic access of the request is then
   COMPUTED HERE — `access` = union of effectiveScopeFor(user, m) over the satisfied modules ∩ the client's requested narrowing — and written into `body.access`; whatever the client sent as `access` / `owner` is discarded. */
let authenticator = null; // TEST SEAM: a function (req) → { user:{id,…}, access:{permissions:Set, scopes}, accessVersion } | null. Never set by production code.
export const setAuthenticator = (fn) => { authenticator = typeof fn === 'function' ? fn : null; };

const owners = new Map(); // user id → small unique number (the store's `owner` column is a Uint16; 0 = the shared generated/fixture records, 65535 = removed uploads)
const hashOwner = (sess) => { let h = 7; for (const ch of String(sess)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0; return 1 + (h % 60000); };
/** the owner of uploaded records = the AUTHENTICATED user (never the client-supplied x-session): unique per user inside the process */
export function ownerForUser(userId) {
  if (!userId) return 0; const k = String(userId); let n = owners.get(k);
  if (!n) { n = owners.size < 60000 ? owners.size + 1 : hashOwner(k); owners.set(k, n); }
  return n;
}

/** the client's requested NARROWING (organisation, Amanah, municipality filter) as a GeoScope: it can only shrink the user's own access */
export function narrowingOf(scope) {
  const sc = scope && typeof scope === 'object' && !Array.isArray(scope) ? scope : {};
  const ofKeys = (keys) => normalizeGeoScope({ all: false, nonMunicipal: keys.includes('Housing Sector'), grants: keys.filter((k) => typeof k === 'string' && GEO_HIERARCHY.has(k)).map(entireAmanahGrant) });
  let n = ALL_SCOPE;
  const org = sc.org && typeof sc.org === 'object' ? sc.org.amanahKeys : sc.orgKeys;
  if (Array.isArray(org)) n = intersectGeoScopes(n, ofKeys(org));
  if (sc.amanah !== undefined && sc.amanah !== null && sc.amanah !== 'all') n = intersectGeoScopes(n, ofKeys([].concat(sc.amanah).map(String)));
  if (sc.muni !== undefined && sc.muni !== null && sc.muni !== 'all' && sc.muni !== '') {
    const pm = parseMuniKey(sc.muni);
    if (pm && pm.invalid) n = intersectGeoScopes(n, EMPTY_SCOPE);
    else if (pm) {
      if (!GEO_HIERARCHY.has(pm.amanahEn)) n = intersectGeoScopes(n, normalizeGeoScope({ all: false, nonMunicipal: true, grants: [] })); // the Housing Sector has no municipalities: its «direct» group is the non-municipal entity
      else n = intersectGeoScopes(n, normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: pm.amanahEn, municipalities: pm.kind === 'mapped' ? [pm.refId] : [], direct: pm.kind === 'direct_amanah', notSpecified: pm.kind === 'not_specified' || pm.kind === 'unresolved' }] }));
    }
  }
  return n;
}

const principalOf = (auth) => ({ id: auth.user.id, user: auth.user, access: auth.access, accessVersion: auth.accessVersion, readOnly: !!auth.access.readOnly, has: (p) => auth.access.permissions.has(p), scopeOf: (p) => effectiveScopeFor(auth.access, p) });
/** the union of the scopes of the satisfied modules (all equal: the user's ONE scope) */
const scopeOfGranted = (principal, granted) => granted.reduce((s, p) => unionGeoScopes(s, principal.scopeOf(p)), EMPTY_SCOPE);
/** the geographic access of one request */
export const accessOfRequest = (principal, granted, clientScope) => intersectGeoScopes(scopeOfGranted(principal, granted), narrowingOf(clientScope));

// FURAS DATASET MODE (server/furasData.js): local-only, separate from the generated world; answers 404 whenever the local exports are not configured (always on Vercel).
// Its records cannot be attributed to an Amanah / municipality with certainty (docs/access-control.md «server enforcement»): a user whose contracts access is narrower than «all» reads it as unavailable.
async function furasRoute(req, res, path, body, access) {
  const av = furasAvailableFor(access);
  if (path === '/furas/status') return send(res, 200, av);
  if (!av.available) return send(res, 404, { error: 'furas_unavailable' });
  try {
    switch (path) {
      case '/furas/summary': return send(res, 200, await furasSummary());
      case '/furas/contracts': return send(res, 200, await furasContracts(body));
      case '/furas/contract': { const c = await furasContract(body.no); return c ? send(res, 200, c) : send(res, 404, { error: 'contract_not_found' }); }
      case '/furas/decisions': return send(res, 200, await furasDecisionInput());
      default: return send(res, 404, { error: 'not_found' });
    }
  } catch (e) { return send(res, 500, { error: 'furas_error' }); } // no value from the files is ever put in an error message
}

/** POST /admin/preview {roleId, scope} → what a user holding that role + scope would be allowed, and the (synthetic) figures visible under that access. The figures are CLAMPED to the administrator's own data access:
 *  an administrator never sees, through a preview, a figure the administrator could not see directly; one who holds no data module gets the modules and scope but no figures.
 *  Response: { role, readOnly, modules:[ids], permissions:[ids] (alias), scopes:{[module]:{scope, summary}}, scopeSummary, figuresLabel, figures, moduleFigures:{[module]:{records, contracts?, requests?}}, clamped, figuresWithheld } */
function previewResponse(st, today, principal, body) {
  const fields = [];
  if (typeof body.roleId !== 'string' || !body.roleId) fields.push({ field: 'roleId', code: 'required' });
  const v = validateGeoScope(body.scope); if (!v.ok) fields.push({ field: 'scope', code: 'scope_invalid', errors: v.errors });
  if (fields.length) return { code: 400, body: { error: 'validation_error', fields } };
  const access = resolveAccess({ roleId: body.roleId, scope: normalizeGeoScope(body.scope) });
  if (!access.role) return { code: 400, body: { error: 'validation_error', fields: [{ field: 'roleId', code: 'unknown_role' }] } };
  const described = describeAccess(access);
  const adminData = DATA_MODULES.filter((p) => principal.has(p)).reduce((s, p) => unionGeoScopes(s, principal.scopeOf(p)), EMPTY_SCOPE);
  const held = DATA_MODULES.filter((p) => access.permissions.has(p));
  const previewScope = held.reduce((s, p) => unionGeoScopes(s, effectiveScopeFor(access, p)), EMPTY_SCOPE);
  const visible = intersectGeoScopes(previewScope, adminData);
  const label = { ar: 'أرقام اصطناعية للعرض فقط', en: 'Synthetic figures, illustrative only' };
  const adminHasData = DATA_MODULES.some((p) => principal.has(p));
  const out = { ...described, scopeSummary: { ar: describeGeoScope(normalizeGeoScope(body.scope), 'ar'), en: describeGeoScope(normalizeGeoScope(body.scope), 'en') }, figuresLabel: label };
  if (!adminHasData || !held.length) return { code: 200, body: { ...out, figures: null, figuresWithheld: !adminHasData, moduleFigures: {}, clamped: false } };
  const cfg = { cutoff: today };
  const snap = snapshot(st, { access: visible, scope: { from: '2000-01-01', to: today }, cfg, owner: 0 });
  const t = snap.totals;
  const moduleFigures = {};
  for (const p of held) {
    const s = intersectGeoScopes(effectiveScopeFor(access, p), adminData); const tab = accessTable(s);
    const cutN = dayNum(today); let n = 0; for (let i = 0; i < st.n; i += 1) if (st.owner[i] === 0 && st.issue[i] <= cutN && (tab.all || isVisible(st, i, tab))) n += 1;
    const m = { records: n };
    if (p === 'contracts') m.contracts = st.contracts.filter((c) => c && contractVisible(st, c, tab)).length;
    if (p === 'enforcement') m.requests = st.requests.filter((q) => requestVisible(st, q, tab)).length;
    moduleFigures[p] = m;
  }
  const clamped = geoScopeKey(visible) !== geoScopeKey(previewScope);
  return { code: 200, body: { ...out, figures: { count: t.count, gross: t.gross, exclusions: t.exclusions, net: t.net, collected: t.collected, uncollected: t.outstanding }, moduleFigures, clamped, figuresWithheld: false } };
}

export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const hdr = (k) => { const v = req.headers[k]; return Array.isArray(v) ? v[0] : v; };
  // every response carries the identity version: the client re-reads `me` when it changes
  { const wh = res.writeHead.bind(res); let v; try { v = String(currentAccessVersion()); } catch { v = '0'; } res.writeHead = (code, headers) => wh(code, { ...(headers || {}), 'x-access-version': v }); }
  const method = String(req.method || 'GET').toUpperCase();
  let body = {};
  // ---- identity routes: /auth/* and /admin/* (the identity module authenticates and authorises them; /admin/preview needs the data engine and is handled below)
  if ((path.startsWith('/auth/') || path.startsWith('/admin/')) && path !== '/admin/preview') {
    try { body = method === 'GET' || method === 'HEAD' ? {} : await readBody(req); } catch (e) { return send(res, 400, { error: 'invalid_json' }); }
    try { const handled = await handleIdentityRoute(req, res, path, body, {}); if (!handled) return send(res, 404, { error: 'not_found' }); return undefined; } catch (e) { console.error('[api]', path); return send(res, 500, { error: 'server_error' }); }
  }
  // ---- everything else: authenticated first (401), then mapped to its permission (403)
  let auth = null;
  try {
    if (authenticator) auth = await authenticator(req);
    else {
      let r = req;
      if (method === 'GET' && path === '/export.csv' && !(req.headers && (req.headers.authorization || req.headers.Authorization)) && url.searchParams.get('access_token')) r = { headers: { authorization: `Bearer ${url.searchParams.get('access_token')}` } }; // a browser download navigation cannot set headers: /export.csv alone also accepts the (expiring, signed) token as a parameter
      auth = identityAuthenticate(r);
    }
  } catch (e) { auth = null; }
  if (!auth || !auth.user || !auth.access) return send(res, 401, { error: 'unauthenticated' });
  const principal = principalOf(auth);
  if (principal.accessVersion !== lastAccessVersion) { lastAccessVersion = principal.accessVersion; bumpAccessEpoch(); epoch += 1; bumpEpoch(); } // an identity change (role, scope, status) drops every cached decision and answer
  const owner = ownerForUser(principal.id);
  try {
    if (method === 'GET' && path === '/export.csv') { try { body = JSON.parse(url.searchParams.get('q') || '{}'); } catch { return send(res, 400, { error: 'invalid_json' }); } }
    else if (method !== 'GET' && method !== 'HEAD') { try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'invalid_json' }); } }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    const need = requiredPermissionFor(method, path, body);
    if (need.kind === 'unknown') return send(res, 404, { error: 'not_found' });
    let granted = [];
    if (need.kind === 'permission') {
      granted = need.anyOf.filter((p) => principal.has(p));
      if (!granted.length) { try { auditDenied(principal.user, need.anyOf[0], `${method} ${path}`); } catch { /* the audit trail must never block the answer */ } return send(res, 403, { error: 'forbidden', permission: need.anyOf[0], module: need.anyOf[0], ...(need.anyOf.length > 1 ? { anyOf: need.anyOf } : {}) }); }
      if (need.write && principal.readOnly) { try { auditDenied(principal.user, 'read_only_role', `${method} ${path}`, 'read_only'); } catch { /* never blocks */ } return send(res, 403, { error: 'read_only_role' }); } // a read-only role may open and export, never change
    } else if (need.kind === 'auth') granted = DATA_MODULES.filter((p) => principal.has(p));
    // ---- revenue plans (/plans…): authenticated + `planning` module + read-only refusal are settled above; the plan-level scope check is the service's (server/plansApi.js)
    if (path === '/plans' || path.startsWith('/plans/')) { await handlePlansRoute(req, res, path, body, { auth, principal, url }); return undefined; }
    // the request's geographic access (the user's own, narrowed by what the client asked for) — written into the body for every data function
    delete body.access; delete body.accessMask;
    const access = accessOfRequest(principal, granted, body.scope);
    body.access = access; body.owner = owner;
    const aKey = `${accessKeyOf(access)}|${granted.join('+')}`;
    if (path.startsWith('/furas/')) return await furasRoute(req, res, path, body, effectiveScopeOfAll(principal, granted));
    const st = currentStore(hdr('x-demo-today') || url.searchParams.get('today'), hdr('x-demo-size') || url.searchParams.get('size'));
    const today = st.meta.today;
    if (method === 'GET' && path === '/meta') return send(res, 200, memoize(`meta|${today}|${epoch}|${owner}|${aKey}`, () => meta(st, today, access)));
    if (method === 'GET' && path === '/sanad-cases') return send(res, 200, { cases: memoize(`cases|${today}|${epoch}|${aKey}`, () => sanadCases(st, { access, cfg: { cutoff: today } })) });
    if (method === 'GET' && path === '/export.csv') {
      body.cfg = { ...(body.cfg || {}), cutoff: today };
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="invoices-${today}.csv"`, 'Cache-Control': 'no-store' });
      const it = exportChunks(st, body);
      const pump = () => { for (;;) { const { value, done } = it.next(); if (done) { res.end(); return; } if (!res.write(value)) { res.once('drain', pump); return; } } };
      return pump();
    }
    if (method !== 'POST') return send(res, 404, { error: 'not_found' });
    body.cfg = { ...(body.cfg || {}), cutoff: path === '/series' && body.asOf && body.asOf < today ? body.asOf : today };
    const key = (k) => `${k}|${today}|${epoch}|${aKey}|${stable(body)}`;
    switch (path) {
      case '/admin/preview': { const r = previewResponse(st, today, principal, body); return send(res, r.code, r.body); }
      case '/snapshot': return send(res, 200, memoize(key('snap'), () => snapshot(st, body)));
      case '/series': return send(res, 200, memoize(key('series'), () => series(st, body)));
      case '/bridge': return send(res, 200, memoize(key('bridge'), () => bridge(st, body)));
      case '/list': return send(res, 200, list(st, body));
      case '/noncollection': return send(res, 200, memoize(key('nc'), () => nonCollectionAnalysis(st, body)));
      case '/distributions': return send(res, 200, memoize(key('dist'), () => chartDistributions(st, body)));
      case '/plan-actions': return send(res, 200, memoize(key('planact'), () => actionLines(st, body)));
      case '/worklist': return send(res, 200, memoize(key('wl'), () => worklist(st, body)));
      case '/anomalies': return send(res, 200, memoize(key('an'), () => anomalies(st, body)));
      case '/sources': return send(res, 200, memoize(key('src'), () => sourcesReport(st, body)));
      case '/quality': return send(res, 200, memoize(key('q'), () => quality(st, body)));
      case '/contracts': return send(res, 200, memoize(key('ct'), () => { const cards = contractCards(st, body); return { cards, rollup: contractRollup(cards) }; }));
      case '/contract': { const c = memoize(key('ct1'), () => contractCard(st, body, body.no)); return c?.ambiguous ? send(res, 409, { error: 'contract_number_ambiguous', matches: c.matches }) : c ? send(res, 200, c) : send(res, 404, { error: 'contract_not_found' }); } // same Amanah / organisation / geographic scope as the list; a contract outside the access answers exactly like a missing one
      case '/invoice': {
        // a composite key or a legacy id opens its invoice; a bare number that several invoices carry is AMBIGUOUS: the candidates are returned (409), never the first one.
        // Only invoices inside the user's geographic access (and the user's own uploads) take part: an unauthorized invoice answers exactly like a missing one, and never appears among the candidates.
        const ref = lookupRef(st, body.id); const orgKeys = body.scope?.org?.amanahKeys || null; const tab = accessTable(access);
        const vis = ref.indexes.filter((x) => (st.owner[x] === 0 || st.owner[x] === owner) && isVisible(st, x, tab) && (!orgKeys || orgKeys.includes(ENTITIES[st.ent[x]].en)));
        if (vis.length > 1) return send(res, 409, { error: 'invoice_ambiguous', candidates: invoiceCandidates(st, body, vis) });
        const i = vis.length === 1 ? vis[0] : -1;
        if (i < 0) return send(res, 404, { error: 'invoice_not_found' });
        const d = detail(st, i, makeCtx(st, body));
        return send(res, 200, d); // the invoice documents belong to the module that opens the invoice
      }
      case '/exclusion-check': return send(res, 200, checkExclusionRows(st, body));
      case '/order-match': return send(res, 200, resolveReferences(st, body));
      case '/enforcement-collections': return send(res, 200, enforcementCollections(st, body));
      case '/order-debtor-invoices': return send(res, 200, sameDebtorInvoices(st, body));
      case '/upload': {
        const recs = [];
        const duplicates = [];
        const outOfScope = []; const tab = accessTable(access);
        for (const r of body.records || []) {
          // an uploaded invoice must lie inside the uploader's own data_sources access (Amanah + municipality as the record would be classified): otherwise it is refused, never stored invisible
          const e = ENTITY_INDEX[r.amanahEn];
          if (e != null && !visibleCode(tab, e, classifySourceValues(e, r.municipalitySourceValues || (r.municipalityAr ? [r.municipalityAr] : [])).code)) { outOfScope.push(r.id); continue; }
          // a repeated import of the SAME invoice (same id, or the same composite key) is a duplicate; the same invoice number under another Amanah or GFS code is a different invoice
          const ck = recordCompositeKey(r); const ex = Math.max(lookupId(st, r.id), ck ? lookupComposite(st, ck) : -1);
          if (ex >= 0 && (st.owner[ex] === 0 || st.owner[ex] === owner)) duplicates.push(r.id); else recs.push(r);
        }
        if (st.n + recs.length > st.cap || st.pn + recs.length * 3 > st.pcap) return send(res, 413, { error: 'upload_capacity_exceeded' });
        for (const r of recs) appendRecord(st, r, { owner, kind: 'upload' });
        epoch += 1; bumpEpoch();
        return send(res, 200, { ok: true, added: recs.length, duplicates, ...(outOfScope.length ? { outOfScope } : {}) });
      }
      case '/upload/clear': {
        let n = 0; for (let i = st.nGen; i < st.n; i += 1) if (st.owner[i] === owner && owner !== 0) { st.owner[i] = 65535; n += 1; }
        epoch += 1; bumpEpoch();
        return send(res, 200, { ok: true, removed: n });
      }
      default: return send(res, 404, { error: 'not_found' });
    }
  } catch (e) {
    console.error('[api]', path, e);
    return send(res, 500, { error: 'server_error', message: String(e.message || e) });
  }
}
/** a Furas route is attributed only when the user's contracts access is «all»: the effective (un-narrowed) scope of the satisfied permissions, so a client-side narrowing cannot make a restricted user look unrestricted — nor an unrestricted user restricted */
const effectiveScopeOfAll = (principal, granted) => scopeOfGranted(principal, granted);
export { riyadhToday };
