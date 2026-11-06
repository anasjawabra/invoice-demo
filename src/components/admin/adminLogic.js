// PURE logic of the two administration pages (no React, no fetch): the module matrix of a role, the role form, the three-option geographic access, the user form, filtering, summaries.
// docs/access-control.md «SIMPLIFIED MODEL» S1–S3. Every function here is covered by tests/admin-ui.test.mjs.
import { normalizeGeoScope, validateGeoScope, describeGeoScope, geoScopesEqual, GEO_HIERARCHY } from '../../data/geoScope';
import { MODULES, MODULE_IDS, describeUserSummary } from '../../data/permissions';
import { normText } from '../../data/textNorm';

/* ====================================================================== modules of a role (ONE on/off switch each) */
/** the Administrator role keeps these two modules on, always (so the system can never lock itself out) */
export const LOCKED_MODULES = ['users', 'roles'];
/** the modules in the catalog order, unknown ids dropped, no duplicates */
export const orderModules = (ids) => { const s = new Set(ids || []); return MODULE_IDS.filter((id) => s.has(id)); };
export const moduleName = (m, lang) => (lang === 'en' ? m.nameEn : m.nameAr);
export const moduleNameOther = (m, lang) => (lang === 'en' ? m.nameAr : m.nameEn);
/** flip ONE module. A protected role cannot switch a locked module off. */
export function setModule(selected, id, on, { protectedRole = false } = {}) {
  if (!MODULE_IDS.includes(id)) return orderModules(selected);
  const s = new Set(selected || []);
  if (on) s.add(id); else if (!(protectedRole && LOCKED_MODULES.includes(id))) s.delete(id);
  return orderModules(s);
}
/** «تفعيل الكل / تعطيل الكل» */
export const setAllModules = (on, { protectedRole = false } = {}) => (on ? [...MODULE_IDS] : orderModules(protectedRole ? LOCKED_MODULES : []));
export const moduleCountText = (selected) => ({ n: orderModules(selected).length, total: MODULE_IDS.length });

/* ====================================================================== roles */
export const roleDisplayName = (r, lang) => (lang === 'en' ? r.nameEn || r.nameAr : r.nameAr || r.nameEn) || r.id;
/** a role as the pages use it: a legacy record without `modules` renders as «no module» instead of crashing */
export const normalizeRole = (r) => ({ ...r, modules: orderModules(r && r.modules), readOnly: !!(r && r.readOnly), starter: !!(r && r.starter), protected: !!(r && r.protected) });
export const roleKind = (r) => (r.protected ? 'protected' : r.starter ? 'starter' : 'custom');
export const emptyRoleDraft = () => ({ id: undefined, nameAr: '', nameEn: '', descriptionAr: '', descriptionEn: '', modules: [], readOnly: false, protected: false });
export const roleDraftFrom = (role) => (role ? { id: role.id, nameAr: role.nameAr || '', nameEn: role.nameEn || '', descriptionAr: role.descriptionAr || '', descriptionEn: role.descriptionEn || '', modules: orderModules(role.modules), readOnly: !!role.readOnly, protected: !!role.protected } : emptyRoleDraft());
/** the role form validation (mirrors the server) → { ok, fields:{ nameAr, nameEn, descriptionAr, descriptionEn, modules } } with message KEYS (the caller translates) */
export function validateRoleDraft(d) {
  const f = {}; const s = (v) => String(v || '').trim();
  if (!s(d.nameAr)) f.nameAr = 'err.nameRequired'; else if (s(d.nameAr).length > 60) f.nameAr = 'err.nameLong';
  if (!s(d.nameEn)) f.nameEn = 'err.nameRequired'; else if (s(d.nameEn).length > 60) f.nameEn = 'err.nameLong';
  if (s(d.descriptionAr).length > 300) f.descriptionAr = 'err.descLong';
  if (s(d.descriptionEn).length > 300) f.descriptionEn = 'err.descLong';
  if (!orderModules(d.modules).length) f.modules = 'err.modulesRequired';
  return { ok: Object.keys(f).length === 0, fields: f };
}
/** the body sent to POST / PATCH /admin/roles */
export const roleForSave = (d) => ({ nameAr: String(d.nameAr || '').trim(), nameEn: String(d.nameEn || '').trim(), descriptionAr: String(d.descriptionAr || '').trim(), descriptionEn: String(d.descriptionEn || '').trim(), modules: orderModules(d.modules), readOnly: !!d.readOnly });
/** roles table: free-text search over both names and both descriptions (Arabic spelling folded) */
export function filterRoles(roles, { q = '' } = {}) {
  const needle = normText(q);
  return (roles || []).filter((r) => !needle || normText([r.nameAr, r.nameEn, r.descriptionAr, r.descriptionEn].filter(Boolean).join(' ')).includes(needle));
}
/** how many users hold a role: the server's count when it sends one, else counted from the loaded users, else null (the page then shows «—») */
export function roleUserCount(role, users) {
  if (typeof role.userCount === 'number') return role.userCount;
  return Array.isArray(users) ? users.filter((u) => u.roleId === role.id).length : null;
}
/** why a role cannot be deleted (a message KEY) or null */
export function roleDeleteBlock(role, count, { canManage = true } = {}) {
  if (!canManage) return 'roles.readOnlyReason';
  if (role.protected) return 'roles.cantDeleteProtected';
  if (typeof count === 'number' && count > 0) return 'roles.cantDeleteUsed';
  return null;
}

/* ====================================================================== geographic access: THREE options (S3) over the unchanged GeoScope */
export const GEO_OPTIONS = ['all', 'amanahs', 'municipal'];
/** the picker's view of the hierarchy from the admin catalog: amanahs [{ key, nameAr, nameEn, municipalities:[{ref,nameAr,nameEn}], refs }] + helpers */
export function hierarchyIndex(catalogHierarchy) {
  const amanahs = ((catalogHierarchy && catalogHierarchy.amanahs) || []).map((a) => ({ ...a, refs: (a.municipalities || []).map((m) => m.ref) })); const map = new Map();
  for (const a of amanahs) map.set(a.key, a);
  return { amanahs, map, nonMunicipalEntities: (catalogHierarchy && catalogHierarchy.nonMunicipalEntities) || [], refsOf: (key) => (map.get(key) ? map.get(key).refs : []), has: (key) => map.has(key) };
}
/** the validation hierarchy for validateGeoScope built from the catalog (same two functions as GEO_HIERARCHY); the built-in verified hierarchy until the catalog is loaded */
export const validationHierarchy = (idx) => (idx && idx.amanahs.length ? { has: idx.has, refsOf: idx.refsOf } : GEO_HIERARCHY);

/** the editable model: { option: null | 'all' | 'amanahs' | 'municipal', amanahs:[keys], munis:{ [key]: [refs] }, includeDirect:boolean } — nothing is chosen until the administrator chooses (least privilege) */
export const emptyAccess = () => ({ option: null, amanahs: [], munis: {}, includeDirect: false });
const inOrder = (hier, keys) => hier.amanahs.map((a) => a.key).filter((k) => keys.includes(k));

/** the model → the GeoScope that is stored */
export function scopeFromAccess(model, hier) {
  const m = model || emptyAccess();
  if (m.option === 'all') return { all: true };
  if (m.option === 'amanahs') return { all: false, grants: inOrder(hier, m.amanahs).map((amanah) => ({ amanah, municipalities: 'all', direct: true, notSpecified: true })), nonMunicipal: false };
  if (m.option === 'municipal') {
    const inc = m.includeDirect === true;
    return { all: false, grants: inOrder(hier, m.amanahs).map((amanah) => ({ amanah, municipalities: hier.refsOf(amanah).filter((r) => (m.munis[amanah] || []).includes(r)), direct: inc, notSpecified: inc })), nonMunicipal: false };
  }
  return { all: false, grants: [], nonMunicipal: false };
}
/** a stored scope → the model that edits it (the closest of the three options; `accessFits` says whether it is exactly one of them) */
export function accessFromScope(scope, hier) {
  const n = normalizeGeoScope(scope);
  if (n.all) return { option: 'all', amanahs: [], munis: {}, includeDirect: false };
  if (!n.grants.length) return emptyAccess();
  const amanahs = inOrder(hier, n.grants.map((g) => g.amanah));
  if (n.grants.every((g) => g.municipalities === 'all')) return { option: 'amanahs', amanahs, munis: {}, includeDirect: false };
  const munis = {}; for (const g of n.grants) munis[g.amanah] = g.municipalities === 'all' ? [...hier.refsOf(g.amanah)] : [...g.municipalities];
  return { option: 'municipal', amanahs, munis, includeDirect: n.grants.every((g) => g.direct && g.notSpecified) };
}
/** does the stored scope belong EXACTLY to one of the three options? (false → the form says that saving converts it) */
export const accessFits = (scope, hier) => { const n = normalizeGeoScope(scope); const back = scopeFromAccess(accessFromScope(n, hier), hier); return n.all ? back.all === true : !n.nonMunicipal && geoScopesEqual(back, n); };

/** choose an option. From «all» nothing is carried over (the narrower choice is explicit); between «amanahs» and «municipal» the selected Amanahs are kept (municipalities start unticked: never silently widened). */
export function setOption(model, option) {
  const m = model || emptyAccess();
  if (option === m.option) return m;
  if (option === 'all' || m.option === 'all' || m.option === null) return { option, amanahs: [], munis: {}, includeDirect: false };
  return { option, amanahs: [...m.amanahs], munis: {}, includeDirect: false };
}
export function toggleAmanah(model, key, on, hier) {
  const has = model.amanahs.includes(key);
  if (on && !has) return { ...model, amanahs: inOrder(hier, [...model.amanahs, key]), munis: model.option === 'municipal' ? { ...model.munis, [key]: [] } : model.munis };
  if (!on && has) { const munis = { ...model.munis }; delete munis[key]; return { ...model, amanahs: model.amanahs.filter((k) => k !== key), munis }; }
  return model;
}
/** select the shown (searched) Amanahs / clear all */
export const addAmanahs = (model, keys, hier) => keys.reduce((m, k) => toggleAmanah(m, k, true, hier), model);
export const clearAmanahs = (model) => ({ ...model, amanahs: [], munis: {} });
/** the municipality choices of ONE Amanah — they depend on it and on nothing else */
export const municipalityOptions = (hier, key) => (hier.map.get(key) ? hier.map.get(key).municipalities : []);
export function setMunicipalities(model, key, refs, on, hier) {
  const all = hier.refsOf(key); const cur = new Set(model.munis[key] || []);
  for (const r of refs) { if (!all.includes(r)) continue; if (on) cur.add(r); else cur.delete(r); }
  return { ...model, munis: { ...model.munis, [key]: all.filter((r) => cur.has(r)) } };
}
export const toggleMunicipality = (model, key, ref, on, hier) => setMunicipalities(model, key, [ref], on, hier);
/** the ONE explicit checkbox of option 3: sets BOTH flags (Amanah-level + unspecified municipality) for the selected Amanahs */
export const setIncludeDirect = (model, on) => ({ ...model, includeDirect: !!on });
export const selectedMunicipalityCount = (model, key) => (model.munis[key] || []).length;

const MSG = {
  no_option: { ar: 'اختر نوع الوصول الجغرافي.', en: 'Choose the type of geographic access.' },
  no_amanah: { ar: 'اختر أمانة واحدة على الأقل.', en: 'Choose at least one Amanah.' },
  no_municipality: { ar: 'حدّد بلدية واحدة على الأقل لأمانة «{name}»، أو فعّل تضمين سجلات الأمانة المباشرة.', en: 'Select at least one municipality for “{name}”, or include the Amanah-level records.' }
};
/** client-side validation BEFORE saving → { ok, messages:[{ code, amanah?, text }] } in the language asked. Uses validateGeoScope for everything the server also checks. */
export function validateAccess(model, lang, hier) {
  const L = lang === 'en' ? 'en' : 'ar'; const m = model || emptyAccess(); const messages = [];
  if (!GEO_OPTIONS.includes(m.option)) return { ok: false, messages: [{ code: 'no_option', text: MSG.no_option[L] }] };
  if (m.option === 'all') return { ok: true, messages };
  if (!m.amanahs.length) return { ok: false, messages: [{ code: 'no_amanah', text: MSG.no_amanah[L] }] };
  if (m.option === 'municipal' && !m.includeDirect) {
    for (const k of m.amanahs) if (!(m.munis[k] || []).length) { const a = hier.map.get(k); messages.push({ code: 'no_municipality', amanah: k, text: MSG.no_municipality[L].replace('{name}', a ? (L === 'en' ? a.nameEn : a.nameAr) : k) }); }
  }
  const skip = new Set(messages.map((x) => x.amanah));
  for (const e of validateGeoScope(scopeFromAccess(m, hier), validationHierarchy(hier)).errors) if (!(e.code === 'empty_grant' && skip.size)) messages.push({ code: e.code, amanah: e.amanah, text: e[L] });
  return { ok: messages.length === 0, messages };
}
/** the scope sent to the server, or null while the model is invalid */
export const scopeForSave = (model, hier) => (validateAccess(model, 'en', hier).ok ? normalizeGeoScope(scopeFromAccess(model, hier)) : null);
/** concise live summary: «أمانتان · 5 بلديات» (a dash while nothing is chosen) */
export function accessSummary(model, lang, hier) {
  if (!model || !GEO_OPTIONS.includes(model.option)) return '—';
  if (model.option !== 'all' && !model.amanahs.length) return '—';
  return describeGeoScope(normalizeGeoScope(scopeFromAccess(model, hier)), lang);
}

/* ====================================================================== users */
export const USER_STATUSES = ['active', 'inactive', 'invited'];
export const userDisplayName = (u, lang) => (lang === 'en' ? u.nameEn || u.nameAr : u.nameAr || u.nameEn) || u.username;
/** a user as the pages use it: ONE role + ONE scope. A record from the old several-assignments model shows its first assignment instead of crashing. */
export function normalizeUser(u) {
  const first = Array.isArray(u && u.assignments) && u.assignments.length ? u.assignments[0] : null;
  return { ...u, roleId: (u && u.roleId) || (first && first.roleId) || '', scope: (u && u.scope) || (first && first.scope) || { all: false, grants: [], nonMunicipal: false }, status: (u && u.status) || 'inactive' };
}
/** «Collection Officer · Jeddah Amanah · 3 municipalities» — the one summary line used everywhere (permissions.js, shared with the server and the header) */
export const userSummary = (user, role, lang) => describeUserSummary(user, role || null, lang === 'en' ? 'en' : 'ar');
/** search over names (AR/EN), username, e-mail and the role names · status */
export function filterUsers(users, { q = '', status = '' } = {}, rolesById = new Map()) {
  const needle = normText(q);
  return (users || []).filter((u) => {
    if (status && u.status !== status) return false;
    if (!needle) return true;
    const r = rolesById.get(u.roleId);
    return normText([u.nameAr, u.nameEn, u.username, u.email, r && r.nameAr, r && r.nameEn].filter(Boolean).join(' ')).includes(needle);
  });
}
export const sortUsers = (users, lang = 'ar') => [...(users || [])].sort((a, b) => String(userDisplayName(a, lang)).localeCompare(String(userDisplayName(b, lang)), lang === 'en' ? 'en' : 'ar'));
/** the signed-in administrator's own row: role, scope and status cannot be edited there */
export const isSelf = (me, u) => !!me && !!u && me.id === u.id;
export const activationLink = (code, origin = '') => `${origin}/login?activate=${encodeURIComponent(code)}`;
export const statusMeta = (status) => ({ active: { icon: 'check', cls: 'adm-st--active' }, inactive: { icon: 'ban', cls: 'adm-st--inactive' }, invited: { icon: 'clock', cls: 'adm-st--invited' } }[status] || { icon: 'clock', cls: 'adm-st--invited' });

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,39}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emptyUserForm = () => ({ nameAr: '', nameEn: '', username: '', email: '', roleId: '', status: 'invited', access: emptyAccess() });
export const userFormFrom = (user, hier) => (user ? { nameAr: user.nameAr || '', nameEn: user.nameEn || '', username: user.username || '', email: user.email || '', roleId: user.roleId || '', status: user.status || 'inactive', access: accessFromScope(user.scope, hier) } : emptyUserForm());
/** the form validation (mirrors the server) → { ok, fields:{ nameAr, username, email, roleId, access } } — message KEYS, except `access` = the geographic messages in the language asked */
export function validateUserForm(form, { creating = true, lang = 'ar', hier, self = false } = {}) {
  const f = {}; const s = (v) => String(v || '').trim();
  if (!s(form.nameAr) && !s(form.nameEn)) f.nameAr = 'err.nameRequired';
  else if (s(form.nameAr).length > 80 || s(form.nameEn).length > 80) f.nameAr = 'err.nameLong';
  if (creating && !USERNAME_RE.test(s(form.username).toLowerCase())) f.username = 'err.usernameInvalid';
  if (s(form.email) && !EMAIL_RE.test(s(form.email))) f.email = 'err.emailInvalid';
  if (!self) {
    if (!form.roleId) f.roleId = 'err.roleRequired';
    const a = validateAccess(form.access, lang, hier); if (!a.ok) f.access = a.messages;
  }
  return { ok: Object.keys(f).length === 0, fields: f };
}
/** the body of POST (creating) / PATCH /admin/users/:id. Own row: only names and e-mail (+ a status change). A new user is always created «invited» by the server, so no status is sent then.
 *  A status is sent only when it changed and is active / inactive (the server refuses anything else). */
export function userForSave(form, hier, { creating = true, self = false, originalStatus = '' } = {}) {
  const s = (v) => String(v || '').trim(); const body = { nameAr: s(form.nameAr), nameEn: s(form.nameEn), email: s(form.email) || undefined };
  if (creating) body.username = s(form.username).toLowerCase();
  if (!self) { body.roleId = form.roleId; body.scope = scopeForSave(form.access, hier); }
  if (!creating) {
    if (!body.email) body.email = '';
    if (form.status !== originalStatus && (form.status === 'active' || form.status === 'inactive')) body.status = form.status;
  }
  return body;
}
/** the status choices of the form: a new user is «invited» (becomes active when the activation link is used); an invited user can be deactivated; others switch between active / inactive */
export const statusChoices = (creating, current) => (creating ? ['invited'] : current === 'invited' ? ['invited', 'inactive'] : ['active', 'inactive']);
/** server validation fields ([{field, code, ar, en}]) → { field: text } in the language */
export function serverFieldErrors(error, lang) {
  const out = {}; const list = error && error.body && Array.isArray(error.body.fields) ? error.body.fields : [];
  for (const f of list) { const text = (lang === 'en' ? f.en : f.ar) || ''; if (f.field && text && !out[f.field]) out[f.field] = text; }
  return out;
}

/* ====================================================================== the «what will they see?» line */
const FIGS = ['count', 'net', 'collected', 'uncollected'];
/** the modules of the chosen role, in catalog order, as { id, nameAr, nameEn } */
export const modulesOfRole = (role) => (role ? orderModules(role.modules) : []).map((id) => MODULES.find((m) => m.id === id));
/** the figures of a preview answer or null (withheld / none) */
export const previewFigures = (p) => (p && p.figures && FIGS.every((k) => typeof p.figures[k] === 'number') ? p.figures : null);

/* ====================================================================== audit rows */
/** an audit entry as a display row: the Arabic summary from the server, the English one as the other language; secrets are never part of an entry and `before`/`after` are not shown */
export const auditRow = (e, lang) => ({ id: e.id, at: e.at, actor: (lang === 'en' ? e.actorNameEn || e.actorName : e.actorName || e.actorNameEn) || '—', action: e.action, targetType: e.targetType, targetId: e.targetId, summary: (lang === 'en' ? e.summaryEn || e.summary : e.summary || e.summaryEn) || '' });
