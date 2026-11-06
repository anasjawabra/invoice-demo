// Typed wrappers for the administration endpoints (docs/access-control.md «SIMPLIFIED MODEL» S2–S4): /api/admin/* and /api/auth/me. One role and one geographic scope per user.
// Nothing here ever receives, stores or logs a password or a hash:
// the only secret a response can carry is the ONE-TIME activation code of a create / re-issue answer, which the caller shows once and then drops.

// Requests go through the shared helper of src/api/client.js (`request`): it adds the signed-in session's bearer token, notes x-access-version and signs the tab out on a 401.
import { request as sharedRequest } from './client';

/** an administration request failed. `code` is the server's `error` code (`forbidden`, `last_admin`, `role_in_use`, `validation_error`, …) or `network`. */
export class AdminApiError extends Error {
  constructor(status, body, code) { super(code || (body && body.error) || `HTTP ${status}`); this.name = 'AdminApiError'; this.status = status; this.body = body && typeof body === 'object' ? body : {}; this.code = code || this.body.error || `http_${status}`; }
}

async function request(method, path, body, { signal } = {}) {
  try { return await sharedRequest(method, path, body, { signal }); } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    if (e && e.network) throw new AdminApiError(0, {}, 'network');
    if (e && typeof e.status === 'number') throw new AdminApiError(e.status, e.body);
    throw new AdminApiError(0, {}, 'network');
  }
}
const qs = (o) => { const p = Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`); return p.length ? `?${p.join('&')}` : ''; };
const enc = encodeURIComponent;

export const adminApi = {
  /** the signed-in user's own access (`me.modules`, `me.role`, `me.id`) */
  me: (o) => request('GET', '/auth/me', undefined, o).then((j) => j.me),
  /** the 13 modules, the starter roles, the Amanah → municipality hierarchy for the geographic picker, storage mode */
  catalog: (o) => request('GET', '/admin/catalog', undefined, o),
  users: (o) => request('GET', '/admin/users', undefined, o),
  user: (id, o) => request('GET', `/admin/users/${enc(id)}`, undefined, o),
  /** body: { username, nameAr, nameEn, email?, roleId, scope:GeoScope, status? } → { user, activation:{code, expiresAt} } (the code is shown ONCE) */
  createUser: (body, o) => request('POST', '/admin/users', body, o),
  /** patch: { nameAr?, nameEn?, email?, roleId?, scope?, status?: 'active'|'inactive' } → { user } */
  updateUser: (id, patch, o) => request('PATCH', `/admin/users/${enc(id)}`, patch, o),
  setStatus: (id, status, o) => request('PATCH', `/admin/users/${enc(id)}`, { status }, o),
  /** a fresh one-time code (earlier unused ones are revoked) → { user, activation } */
  reissueActivation: (id, o) => request('POST', `/admin/users/${enc(id)}/activation`, {}, o),
  roles: (o) => request('GET', '/admin/roles', undefined, o),
  /** body: { nameAr, nameEn, descriptionAr?, descriptionEn?, modules:[ids], readOnly } → { role } */
  createRole: (body, o) => request('POST', '/admin/roles', body, o),
  updateRole: (id, patch, o) => request('PATCH', `/admin/roles/${enc(id)}`, patch, o),
  deleteRole: (id, o) => request('DELETE', `/admin/roles/${enc(id)}`, undefined, o),
  /** params: { limit, offset } → { total, entries } */
  audit: (params, o) => request('GET', `/admin/audit${qs(params)}`, undefined, o),
  /** { roleId, scope } → the modules of the role and the synthetic figures visible under the scope: { figures:{count, net, collected, uncollected}|null, figuresLabel, figuresWithheld, … } */
  preview: (body, o) => request('POST', '/admin/preview', body, o)
};
