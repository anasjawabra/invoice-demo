// Typed wrappers for the revenue-plans endpoints (docs/revenue-plans-spec.md §10): /api/plans…  One function per route. Requests go through the shared helper of src/api/client.js (`request`): it adds the signed-in
// session's bearer token, notes x-access-version and signs the tab out on a 401. Nothing here ever receives or stores a password, a hash or a token.
import { request as sharedRequest } from './client';

/** a plans request failed. `code` = the server's `error` code (`validation_error`, `name_taken`, `save_checks_failed`, `revision_conflict`, `system_plan_readonly`, `forbidden`, `read_only_role`, `plan_not_found`, `legacy_already_imported`, … ) or `network`.
 *  Structured parts of the body are lifted onto the error: errors[] (400 validation / 409 name_taken), checks[] (422 save_checks_failed), plan (409 legacy_already_imported), lastEditedBy + currentRevision (409 revision_conflict), reason (403). */
export class PlansApiError extends Error {
  constructor(status, body, code) {
    super(code || (body && body.error) || `HTTP ${status}`); this.name = 'PlansApiError';
    const b = body && typeof body === 'object' ? body : {};
    this.status = status; this.body = b; this.code = code || b.error || `http_${status}`;
    this.errors = Array.isArray(b.errors) ? b.errors : []; this.checks = Array.isArray(b.checks) ? b.checks : [];
    this.plan = b.plan || null; this.lastEditedBy = b.lastEditedBy || null; this.currentRevision = b.currentRevision ?? null; this.reason = b.reason || null;
    this.forbidden = status === 403; this.conflict = status === 409; this.nameTaken = this.code === 'name_taken'; this.systemPlan = this.code === 'system_plan_readonly'; this.readOnly = this.code === 'read_only_role' || b.reason === 'read_only_role';
  }
}
export const isRevisionConflict = (e) => !!e && e.code === 'revision_conflict';

async function request(method, path, body, { signal } = {}) {
  try { return await sharedRequest(method, path, body, { signal }); } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    if (e && e.network) throw new PlansApiError(0, {}, 'network');
    if (e && typeof e.status === 'number') throw new PlansApiError(e.status, e.body);
    throw new PlansApiError(0, {}, 'network');
  }
}
const qs = (o) => { const p = Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`); return p.length ? `?${p.join('&')}` : ''; };
const enc = encodeURIComponent;

/** GET /plans[?year&owner&entity|amanah&muni] → { plans:[plan], defaults:{ userDefaultPlanId, globalDefaultPlanId (= systemDefaultPlanId), effectiveDefaultPlanId, source:'personal'|'global'|'fallback'|'none' }, references, capabilities:{canSetReference, canSetSystemDefault, readOnly, canCreate, canCreateMinistry}, storage:{mode, durable, localDemo} }
 *  (plans MASKED for a restricted viewer; plan = { id, name, isSystem, origin, content, createdBy, lastEditedBy, revision, versions:[meta], viewer:{canEdit, reason?}, … }) */
export const listPlans = (params, o) => request('GET', `/plans${qs(params)}`, undefined, o);
/** GET /plans/:id → { plan, storage } */
export const getPlan = (id, o) => request('GET', `/plans/${enc(id)}`, undefined, o);
/** GET /plans/:id/versions/:n → { planId, version:{n, revision, content, savedBy, savedAt, label?, isCurrent}, view:planView }  (an internal snapshot, read-only) */
export const getPlanVersion = (id, n, o) => request('GET', `/plans/${enc(id)}/versions/${enc(n)}`, undefined, o);
/** GET /plans/:id/audit → { planId, total, entries:[{ id, at, actor, action, summary:{ar,en}, details? }] } (newest first) */
export const getPlanAudit = (id, o) => request('GET', `/plans/${enc(id)}/audit`, undefined, o);
/** POST /plans {name, content, setDefault?, copyOf?} → { plan, defaults }  (a NEW saved plan owned by the signed-in user: «حفظ» of a new plan and «حفظ كخطة جديدة»; 400 validation_error{errors} · 409 name_taken · 422 save_checks_failed{checks}) */
export const createPlan = (body, o) => request('POST', '/plans', body, o);
/** PUT /plans/:id {revision, content, name?} → { plan }  (saves THAT plan; 409 revision_conflict{currentRevision,lastEditedBy} · 403 system_plan_readonly | forbidden{reason} | read_only_role · 400 / 409 name_taken / 422 as for createPlan) */
export const updatePlan = (id, revision, content, name, o) => request('PUT', `/plans/${enc(id)}`, { revision, content, ...(name !== undefined && name !== null ? { name } : {}) }, o);
/** PUT /plans/default {planId|null} → { defaults }  (the CALLER's own default; the plan must be visible to them; null clears it) */
export const setPersonalDefault = (planId, o) => request('PUT', '/plans/default', { planId: planId ?? null }, o);
/** PUT /plans/system-default {planId} → { defaults }  (changes the GLOBAL default plan every user opens; needs all-entities access and a non-read-only role — 403 read_only_role / forbidden otherwise; the plan must be visible to the caller) */
export const setSystemDefault = (planId, o) => request('PUT', '/plans/system-default', { planId }, o);
/** GET /plans/system-default → { defaults, canSetSystemDefault } */
export const getSystemDefault = (o) => request('GET', '/plans/system-default', undefined, o);
/** GET /plans/references → { references:{ [year]:{ planId, setBy, at } }, defaults, capabilities, storage } */
export const getPlanReferences = (o) => request('GET', '/plans/references', undefined, o);
/** POST /plans/references {year, planId|null} → { references, cleared }  (the ORGANISATION reference; needs all-entities access) */
export const setPlanReference = (year, planId, o) => request('POST', '/plans/references', { year, planId }, o);
/** POST /plans/import-legacy {year, store} → { plan } (a normal saved plan, ownerless; 409 legacy_already_imported {plan} on a repeat) */
export const importLegacyPlan = (year, store, o) => request('POST', '/plans/import-legacy', { year, store }, o);

export const plansApi = {
  list: listPlans, get: getPlan, version: getPlanVersion, audit: getPlanAudit, create: createPlan, update: updatePlan, setDefault: setPersonalDefault, setSystemDefault, getSystemDefault,
  references: getPlanReferences, setReference: setPlanReference, importLegacy: importLegacyPlan
};
