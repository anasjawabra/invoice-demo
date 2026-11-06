// REST routes of the identity core: /auth/* and /admin/* (docs/access-control.md §4–§5). server/api.js calls handleIdentityRoute() first and answers 'false' routes itself
// (/admin/preview is registered by api.js: it needs the data engine; it uses resolveAccessFromAssignments below).
import { authenticate, login, activate, meOf, currentAccessVersion, listAudit, listUsers, getUser, createUser, updateUser, reissueActivation, listRoles, createRole, updateRole, deleteRole, adminCatalog, ApiError, computeAccess, getRoles } from './identity/index';
import { auditDenied } from './identity/index';
import { MODULE_IDS } from '../src/data/permissions';
import { effectiveScopeFor } from './identity/index';
import { describeGeoScope } from '../src/data/geoScope';

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'x-access-version': String(currentAccessVersion()) });
  res.end(body);
}
function sendError(res, e) {
  if (e instanceof ApiError) { const { fields, permission, module, reason, users } = e.extra || {}; return send(res, e.status, { error: e.code, ...(fields ? { fields } : {}), ...(permission ? { permission } : {}), ...(module ? { module } : {}), ...(reason ? { reason } : {}), ...(users !== undefined ? { users } : {}) }); }
  return send(res, 500, { error: 'server_error' }); // never an exception message: it could carry a value
}
const q = (req) => { try { return Object.fromEntries(new URL(req.url, 'http://x').searchParams.entries()); } catch { return {}; } };

/** {roleId, scope} (+ the stored roles by default) → the access it would give: { permissions:Set, modules, scopes, role, readOnly, overallScope } — for api.js's POST /admin/preview. An array (the earlier shape) uses its first element. */
export function resolveAccess(assignment, roles = getRoles()) { return computeAccess(Array.isArray(assignment) ? assignment[0] : assignment, roles); }
export const resolveAccessFromAssignments = resolveAccess;
/** a plain-JSON summary of an access for the preview response: the role, the modules and, per module, the scope + its AR/EN summary */
export function describeAccess(access) {
  const scopes = {}; for (const m of MODULE_IDS) if (access.permissions.has(m)) { const s = effectiveScopeFor(access, m); scopes[m] = { scope: s, summary: { ar: describeGeoScope(s, 'ar'), en: describeGeoScope(s, 'en') } }; }
  const modules = MODULE_IDS.filter((m) => access.permissions.has(m));
  return { role: access.role, readOnly: !!access.readOnly, modules, permissions: modules, scopes };
}

/** Handles /auth/* and /admin/* (except /admin/preview). `path` has no '/api' prefix. Returns true when it answered, false when the path is not an identity route. ctx.auth may carry an already-resolved authenticate() result. */
export async function handleIdentityRoute(req, res, path, body, ctx = {}) {
  const isAuth = path === '/auth' || path.startsWith('/auth/'); const isAdmin = path === '/admin' || path.startsWith('/admin/');
  if (!isAuth && !isAdmin) return false;
  if (path === '/admin/preview') return false;
  const method = req.method || 'GET'; const b = body && typeof body === 'object' ? body : {};
  try {
    if (isAuth) {
      if (method === 'POST' && path === '/auth/login') return send(res, 200, login(b)), true;
      if (method === 'POST' && path === '/auth/activate') return send(res, 200, activate(b)), true;
      if (method === 'POST' && path === '/auth/logout') return send(res, 200, { ok: true }), true; // stateless tokens: the client drops its token; a password/status/role change is what ends other sessions
      if (method === 'GET' && path === '/auth/me') { const a = ctx.auth || authenticate(req); if (!a) throw new ApiError(401, 'unauthenticated'); return send(res, 200, { me: meOf(a) }), true; }
      return send(res, 404, { error: 'not_found' }), true;
    }
    const auth = ctx.auth || authenticate(req); if (!auth) throw new ApiError(401, 'unauthenticated');
    const seg = path.split('/').filter(Boolean); // ['admin', 'users', ':id', 'activation']
    if (method === 'GET' && path === '/admin/catalog') return send(res, 200, adminCatalog(auth)), true;
    if (seg[1] === 'users') {
      if (seg.length === 2 && method === 'GET') return send(res, 200, listUsers(auth)), true;
      if (seg.length === 2 && method === 'POST') return send(res, 201, createUser(auth, b)), true;
      if (seg.length === 3 && method === 'GET') return send(res, 200, getUser(auth, decodeURIComponent(seg[2]))), true;
      if (seg.length === 3 && method === 'PATCH') return send(res, 200, updateUser(auth, decodeURIComponent(seg[2]), b)), true;
      if (seg.length === 4 && seg[3] === 'activation' && method === 'POST') return send(res, 200, reissueActivation(auth, decodeURIComponent(seg[2]))), true;
    }
    if (seg[1] === 'roles') {
      if (seg.length === 2 && method === 'GET') return send(res, 200, listRoles(auth)), true;
      if (seg.length === 2 && method === 'POST') return send(res, 201, createRole(auth, b)), true;
      if (seg.length === 3 && method === 'PATCH') return send(res, 200, updateRole(auth, decodeURIComponent(seg[2]), b)), true;
      if (seg.length === 3 && method === 'DELETE') return send(res, 200, deleteRole(auth, decodeURIComponent(seg[2]))), true;
    }
    if (method === 'GET' && path === '/admin/audit') {
      if (!['users', 'roles'].some((m) => auth.access.permissions.has(m))) { auditDenied(auth.user, 'roles', 'GET /admin/audit'); throw new ApiError(403, 'forbidden', { permission: 'roles', module: 'roles' }); }
      return send(res, 200, listAudit(q(req))), true;
    }
    return send(res, 404, { error: 'not_found' }), true;
  } catch (e) { return sendError(res, e), true; }
}
