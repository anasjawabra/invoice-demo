// REST routes of the revenue plans («خطط الإيرادات», docs/revenue-plans-spec.md §10 — the simplified workflow): GET/POST /plans · GET/PUT /plans/:id · PUT /plans/default · GET/PUT /plans/system-default · GET/POST /plans/references · GET /plans/:id/versions/:n · GET /plans/:id/audit · POST /plans/import-legacy.  server/api.js authenticates the request (401), maps it to the `planning` module (403 forbidden / read_only_role through
// endpointAccess.js) and then calls handlePlansRoute(); the plan-level scope check (403 `{error:'forbidden', reason}`) happens in server/plans/service.js. The actor is the AUTHENTICATED user (stable id + name snapshot) — a creator is
// never taken from the request body. Errors carry codes and structured lists, never an exception message; nothing here handles a password, a hash or a token.
import { effectiveScopeFor, getDb as identityDb } from './identity/index.js';
import * as svc from './plans/service.js';
import { PlanError } from './plans/service.js';
import { planStore } from './plans/store.js';
import { ensureRemainingPlan } from './plans/remaining2026.js';

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); // x-access-version is added by api.js
  res.end(body);
}
function sendError(res, e, path) {
  if (e instanceof PlanError) return send(res, e.status, { error: e.code, ...e.extra });
  console.error('[plans]', path); // path only: an exception message could carry a value
  return send(res, 500, { error: 'server_error' });
}
/** the acting user: id + name snapshot from the authenticated session, the planning-module scope, the role's read-only flag */
export function actorOf(auth, principal) {
  const u = auth.user || {};
  const scope = principal && typeof principal.scopeOf === 'function' ? principal.scopeOf('planning') : effectiveScopeFor(auth.access, 'planning');
  return { userId: u.id, name: u.nameAr || u.nameEn || u.username || u.id, ...(u.nameEn ? { nameEn: u.nameEn } : {}), geoScope: scope, readOnly: !!(auth.access && auth.access.readOnly) };
}

/* ---- names: a stored reference is {userId, name} (a snapshot); the display resolves the CURRENT name from the user id when the account still exists ---- */
let usersById = null;
function currentNames() {
  try { const db = identityDb(); if (!usersById || usersById.db !== db || usersById.n !== db.users.length) usersById = { db, n: db.users.length, map: new Map(db.users.map((u) => [u.id, { ar: u.nameAr || u.nameEn, en: u.nameEn || u.nameAr }])) }; return usersById.map; } catch { return new Map(); }
}
const withName = (ref, names) => { if (!ref || ref.system || !ref.userId) return ref; const cur = names.get(ref.userId); return cur ? { ...ref, currentName: cur } : ref; };
function decoratePlan(p, names) {
  if (!p) return p;
  const o = { ...p, createdBy: withName(p.createdBy, names), lastEditedBy: withName(p.lastEditedBy, names) };
  if (Array.isArray(p.versions)) o.versions = p.versions.map((v) => ({ ...v, savedBy: withName(v.savedBy, names) }));
  return o;
}
function decorate(result) {
  if (!result || typeof result !== 'object') return result;
  const names = currentNames(); const out = { ...result };
  if (out.plan && out.plan.id) out.plan = decoratePlan(out.plan, names);
  if (Array.isArray(out.plans)) out.plans = out.plans.map((p) => decoratePlan(p, names));
  if (out.references) out.references = Object.fromEntries(Object.entries(out.references).map(([y, r]) => [y, r ? { ...r, setBy: withName(r.setBy, names) } : r]));
  if (Array.isArray(out.entries)) out.entries = out.entries.map((e) => ({ ...e, actor: withName(e.actor, names) }));
  if (out.version && out.version.savedBy !== undefined) out.version = { ...out.version, savedBy: withName(out.version.savedBy, names) };
  return out;
}

/** Handles /plans… (`path` has no '/api' prefix). Returns true when it answered. ctx = { auth, principal, url } */
export async function handlePlansRoute(req, res, path, body, ctx = {}) {
  if (path !== '/plans' && !path.startsWith('/plans/')) return false;
  const method = String(req.method || 'GET').toUpperCase(); const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const auth = ctx.auth; if (!auth || !auth.user) { send(res, 401, { error: 'unauthenticated' }); return true; }
  const seg = path.split('/').filter(Boolean).slice(1).map((s) => { try { return decodeURIComponent(s); } catch { return s; } }); // after 'plans'
  const actor = actorOf(auth, ctx.principal); const store = planStore();
  await ensureRemainingPlan(store); // the remaining-2026 plan (selectable, NOT the global default — the full-year 2026 plan is) is derived once from the data engine on the first authenticated request; a no-op afterwards
  const q = (() => { try { return Object.fromEntries((ctx.url || new URL(req.url, 'http://x')).searchParams.entries()); } catch { return {}; } })();
  const ok = (code, r) => { send(res, code, decorate(r)); return true; };
  try {
    if (seg.length === 0) {
      if (method === 'GET') return ok(200, svc.listPlans(actor, { year: q.year, owner: q.owner, entity: q.entity, amanah: q.amanah, muni: q.muni }, store));
      if (method === 'POST') return ok(201, svc.createPlan(actor, b, store));
    } else if (seg.length === 1 && seg[0] === 'references') {
      if (method === 'GET') return ok(200, svc.getReferences(actor, store));
      if (method === 'POST') return ok(200, svc.setReference(actor, b, store));
    } else if (seg.length === 1 && seg[0] === 'import-legacy') {
      if (method === 'POST') return ok(201, svc.importLegacy(actor, b, store));
    } else if (seg.length === 1 && seg[0] === 'default') {
      if (method === 'PUT') return ok(200, svc.setPersonalDefault(actor, b, store));
    } else if (seg.length === 1 && seg[0] === 'system-default') {
      if (method === 'PUT') return ok(200, svc.setSystemDefault(actor, b, store));
      if (method === 'GET') return ok(200, svc.getSystemDefault(actor, store));
    } else if (seg.length === 1) {
      if (method === 'GET') return ok(200, svc.getPlan(actor, seg[0], store, { amanah: q.amanah, muni: q.muni }));
      if (method === 'PUT') return ok(200, svc.updatePlan(actor, seg[0], b, store));
    } else if (seg.length === 2) {
      if (method === 'GET' && seg[1] === 'audit') return ok(200, svc.getAudit(actor, seg[0], store));
    } else if (seg.length === 3 && method === 'GET' && seg[1] === 'versions') return ok(200, svc.getVersion(actor, seg[0], seg[2], store, { amanah: q.amanah, muni: q.muni }));
    send(res, 404, { error: 'not_found' });
  } catch (e) { sendError(res, e, path); }
  return true;
}
