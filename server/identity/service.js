// Identity core (SIMPLIFIED MODEL, docs/access-control.md S1–S5): effective access = ONE role (a set of module ids + a read-only flag) + ONE geographic scope per user; sessions (login / activation / authenticate),
// users, roles, audit — with every guard of the earlier model kept (hierarchy validation, delegation, no self-elevation, last full administrator, protected Administrator role, role in use).
// Credentials (hash, salt, password, activation code, signing key) never leave this module: payload builders below pick fields explicitly, and audit entries are built from summaries only.
import { MODULES, STARTER_ROLES, ADMIN_ROLE_ID, ADMIN_KEEP_MODULES, permissionsOf, normalizeModules, unknownModules, isScopedModule, describeUserSummary } from '../../src/data/permissions';
import { EMPTY_SCOPE, normalizeGeoScope, validateGeoScope, geoScopeSubset, isAllGeoScope, isEmptyGeoScope, describeGeoScope, geoScopesEqual, AMANAH_KEYS } from '../../src/data/geoScope';
import { ENTITIES, N_AMANAH } from '../../src/data/catalog';
import { municipalitiesOf } from '../../src/data/amanahHierarchy';
import { initialsOf, initialsFor } from '../../src/utils/identity';
import { getDb, commit, persist, markDirty, signingSecret, storageInfo } from './store';
import { hashPassword, verifyPassword, signToken, verifyToken, randomId, newActivationCode, hashCode } from './crypto';

export class ApiError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}
let clock = () => Date.now();
export const setClockForTests = (fn) => { clock = fn || (() => Date.now()); };
const nowIso = () => new Date(clock()).toISOString();
export const SESSION_MS = (Number(process.env.IIM_SESSION_HOURS) || 12) * 3600e3;
export const ACTIVATION_MS = 72 * 3600e3;

const VERR = (field, code, ar, en) => ({ field, code, ar, en });
export const validationError = (fields) => new ApiError(400, 'validation_error', { fields });

/* ====================================================================== effective access */
const rolesIndex = (roles) => (roles instanceof Map ? roles : Array.isArray(roles) ? new Map(roles.map((r) => [r.id, r])) : new Map(Object.entries(roles || {})));
const roleBrief = (r) => ({ id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, readOnly: !!r.readOnly });
/** { roleId, scope } + roles (array | Map | object by id) → { permissions:Set (module ids), modules:[ids], scopes:{[moduleId]:GeoScope}, role:{id,nameAr,nameEn,readOnly}|null, readOnly, overallScope }.
 *  ONE scope for every module the role holds; an unknown / missing role holds nothing. */
export function computeAccess(assignment, roles) {
  const idx = rolesIndex(roles); const role = assignment && idx.get(assignment.roleId); const scope = normalizeGeoScope(assignment && assignment.scope);
  if (!role) return { permissions: new Set(), modules: [], scopes: {}, role: null, readOnly: false, overallScope: EMPTY_SCOPE };
  const permissions = permissionsOf(role); const scopes = {}; for (const m of permissions) scopes[m] = scope;
  return { permissions, modules: normalizeModules([...permissions]), scopes, role: roleBrief(role), readOnly: !!role.readOnly, overallScope: scope };
}
/** the scope that applies to ONE module (a module the access does not hold → the EMPTY scope) */
export function effectiveScopeFor(access, moduleId) {
  if (!access || !access.permissions || !access.permissions.has(moduleId)) return EMPTY_SCOPE;
  const s = access.scopes instanceof Map ? access.scopes.get(moduleId) : access.scopes?.[moduleId];
  return s ? normalizeGeoScope(s) : EMPTY_SCOPE;
}
/** is `cand` entirely inside `base`? (every module held in base, with a scope that contains it; a writing role is never inside a read-only one) → null | { module, permission, kind } for the first violation */
export function accessViolation(cand, base) {
  for (const m of cand.permissions) {
    if (!base.permissions.has(m)) return { module: m, permission: m, kind: 'module' };
    if (isScopedModule(m) && !geoScopeSubset(effectiveScopeFor(cand, m), effectiveScopeFor(base, m))) return { module: m, permission: m, kind: 'scope' };
  }
  if (base.readOnly && cand.permissions.size && !cand.readOnly) return { module: null, permission: 'read_only', kind: 'read_only' };
  return null;
}
const roleList = () => getDb().roles;
const accessCache = { db: null, version: -1, map: new Map() };
export function accessOfUser(user) {
  const db = getDb();
  if (accessCache.db !== db || accessCache.version !== db.accessVersion) { accessCache.db = db; accessCache.version = db.accessVersion; accessCache.map = new Map(); }
  let a = accessCache.map.get(user.id); if (!a) { a = computeAccess({ roleId: user.roleId, scope: user.scope }, roleList()); accessCache.map.set(user.id, a); }
  return a;
}
const isFullAdminUser = (u) => u.status === 'active' && u.roleId === ADMIN_ROLE_ID && isAllGeoScope(u.scope);
const fullAdminCount = (users) => users.filter(isFullAdminUser).length;

/* ====================================================================== payload builders (explicit field picks — never spreads of a stored record) */
const summaryOf = (scope) => ({ ar: describeGeoScope(scope, 'ar'), en: describeGeoScope(scope, 'en') });
const userSummary = (u, role) => ({ ar: describeUserSummary(u, role, 'ar'), en: describeUserSummary(u, role, 'en') });
export function publicUser(u) {
  return { id: u.id, username: u.username, email: u.email || null, nameAr: u.nameAr, nameEn: u.nameEn, avatar: initialsFor(u, 'en'), titleAr: u.titleAr || null, titleEn: u.titleEn || null, status: u.status,
    createdAt: u.createdAt, updatedAt: u.updatedAt, lastLoginAt: u.lastLoginAt || null, roleId: u.roleId || null, scope: normalizeGeoScope(u.scope) };
}
/** the `me` payload of docs/access-control.md S2 (`permissions` is an alias of `modules`) */
export function buildMe(user, access) {
  const u = publicUser(user); const scope = u.scope; const role = getDb().roles.find((r) => r.id === u.roleId) || null;
  const scopes = {}; for (const m of access.modules) scopes[m] = effectiveScopeFor(access, m);
  return { id: u.id, username: u.username, email: u.email, nameAr: u.nameAr, nameEn: u.nameEn, avatar: initialsFor(u, 'en'), titleAr: u.titleAr, titleEn: u.titleEn, status: u.status,
    role: access.role, readOnly: access.readOnly, modules: [...access.modules], permissions: [...access.modules], scope, scopes, scopeSummary: summaryOf(scope), summary: userSummary(u, role), accessVersion: getDb().accessVersion };
}
const activationPending = (db, userId) => db.activations.some((a) => a.userId === userId && !a.usedAt && !a.revokedAt && Date.parse(a.expiresAt) > clock());
export function userRow(u, db = getDb()) {
  const access = accessOfUser(u); const role = db.roles.find((r) => r.id === u.roleId) || null; const scope = normalizeGeoScope(u.scope);
  return { id: u.id, username: u.username, email: u.email || null, nameAr: u.nameAr, nameEn: u.nameEn, avatar: initialsFor(u, 'en'), titleAr: u.titleAr || null, titleEn: u.titleEn || null, status: u.status,
    createdAt: u.createdAt, createdBy: u.createdBy, updatedAt: u.updatedAt, lastLoginAt: u.lastLoginAt || null,
    roleId: u.roleId || null, roleNameAr: role ? role.nameAr : null, roleNameEn: role ? role.nameEn : null, roleReadOnly: role ? !!role.readOnly : false, scope, scopeSummary: summaryOf(scope), summary: userSummary(u, role),
    moduleCount: access.permissions.size, activationPending: activationPending(db, u.id) };
}
const roleRow = (r, db = getDb()) => {
  const modules = normalizeModules(r.modules);
  return { id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, descriptionAr: r.descriptionAr || '', descriptionEn: r.descriptionEn || '', modules, readOnly: !!r.readOnly, starter: !!r.starter, protected: !!r.protected,
    createdAt: r.createdAt, updatedAt: r.updatedAt, moduleCount: modules.length, userCount: db.users.filter((u) => u.roleId === r.id).length };
};

/* ====================================================================== audit */
const actorFields = (actor) => (actor ? { actorId: actor.id, actorName: actor.nameAr || actor.nameEn || actor.id, actorNameEn: actor.nameEn || actor.nameAr || actor.id } : { actorId: 'system', actorName: 'النظام', actorNameEn: 'System' });
/** append an audit entry (summary strings + small before/after objects; never a secret). `persistNow` false keeps it in memory until the next write. */
export function auditLog(actor, action, targetType, targetId, summary, before, after, { persistNow = true } = {}) {
  const db = getDb();
  db.audit.push({ id: randomId('aud'), at: nowIso(), ...actorFields(actor), action, targetType, targetId: String(targetId), summary: summary.ar, summaryEn: summary.en, ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) });
  if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
  if (persistNow) persist(); else markDirty();
}
const recentDenied = new Map();
/** record a denied privilege attempt (a 403 for a missing module, a guard refusal). Identical attempts by one user within a minute are recorded once. */
export function auditDenied(actor, permission, route, reason) {
  const k = `${actor ? actor.id : '-'}|${permission}|${route}|${reason || ''}`; const t = clock();
  if (recentDenied.has(k) && t - recentDenied.get(k) < 60e3) return; recentDenied.set(k, t); if (recentDenied.size > 500) recentDenied.delete(recentDenied.keys().next().value);
  auditLog(actor, 'access_denied', 'session', actor ? actor.id : '-', { ar: `محاولة وصول مرفوضة: ${permission}${reason ? ` (${reason})` : ''}`, en: `Denied access attempt: ${permission}${reason ? ` (${reason})` : ''}` }, undefined, { permission, route, ...(reason ? { reason } : {}) });
}
export function listAudit({ limit = 100, offset = 0, targetType, targetId, actorId, action } = {}) {
  let rows = getDb().audit; if (targetType) rows = rows.filter((e) => e.targetType === targetType); if (targetId) rows = rows.filter((e) => e.targetId === targetId);
  if (actorId) rows = rows.filter((e) => e.actorId === actorId); if (action) rows = rows.filter((e) => e.action === action);
  const total = rows.length; const lim = Math.max(1, Math.min(500, Number(limit) || 100)); const off = Math.max(0, Number(offset) || 0);
  return { total, entries: rows.slice().reverse().slice(off, off + lim) };
}
const auditUserState = (u) => ({ status: u.status, roleId: u.roleId || null, scope: describeGeoScope(u.scope, 'en') });

/* ====================================================================== authentication */
const failures = new Map(); // username → { n, until }
const LOCK_AFTER = 8; const LOCK_MS = 60e3;
function noteFailure(name) { const f = failures.get(name) || { n: 0, until: 0 }; f.n += 1; if (f.n >= LOCK_AFTER) { f.until = clock() + LOCK_MS; f.n = 0; } failures.set(name, f); if (failures.size > 2000) failures.delete(failures.keys().next().value); }
const isLocked = (name) => (failures.get(name)?.until || 0) > clock();
let dummyCredential = null;
const burnTime = (password) => { dummyCredential = dummyCredential || hashPassword('not-a-real-password'); verifyPassword(password, dummyCredential); };

export function issueToken(user) { return signToken(signingSecret(), { uid: user.id, tv: user.tokenVersion, exp: clock() + SESSION_MS }); }
const findByUsername = (name) => { const n = String(name || '').trim().toLowerCase(); return getDb().users.find((u) => u.username === n) || null; };
/** POST /auth/login → { token, me } | throws ApiError(401 invalid_credentials | 403 account_inactive | 403 account_not_activated | 429 too_many_attempts). The session carries the ACCOUNT only: role, modules and geographic scope come from the stored user, never from a client choice. */
export function login({ username, password } = {}) {
  const name = String(username || '').trim().toLowerCase();
  if (!name || typeof password !== 'string' || !password) throw new ApiError(401, 'invalid_credentials');
  if (isLocked(name)) throw new ApiError(429, 'too_many_attempts');
  const user = findByUsername(name);
  if (!user) { burnTime(password); noteFailure(name); throw new ApiError(401, 'invalid_credentials'); }
  if (!user.credential) { if (user.status === 'inactive') { auditLog(null, 'login_denied', 'user', user.id, { ar: `رُفض دخول حساب معطّل: ${user.username}`, en: `Login refused for a deactivated account: ${user.username}` }); throw new ApiError(403, 'account_inactive'); } throw new ApiError(403, 'account_not_activated'); }
  if (!verifyPassword(password, user.credential)) { noteFailure(name); throw new ApiError(401, 'invalid_credentials'); }
  if (user.status === 'inactive') { auditLog(null, 'login_denied', 'user', user.id, { ar: `رُفض دخول حساب معطّل: ${user.username}`, en: `Login refused for a deactivated account: ${user.username}` }); throw new ApiError(403, 'account_inactive'); }
  if (user.status !== 'active') throw new ApiError(403, 'account_not_activated');
  failures.delete(name);
  const access = accessOfUser(user); const me = buildMe(user, access);
  user.lastLoginAt = nowIso(); markDirty(); // in memory now, written with the next real change (a write on every login would reload the dev data service)
  return { token: issueToken(user), me };
}
/** the signed-in user of a request → { user (public), access, accessVersion } | null. Re-reads the user and the roles on EVERY call, so a deactivation, role or scope change applies on the next request. */
export function authenticate(req) {
  const h = req && req.headers ? req.headers.authorization || req.headers.Authorization : null; const v = Array.isArray(h) ? h[0] : h;
  const m = typeof v === 'string' ? /^Bearer\s+(\S+)\s*$/i.exec(v) : null; if (!m) return null;
  const p = verifyToken(signingSecret(), m[1], clock()); if (!p) return null;
  const user = getDb().users.find((u) => u.id === p.uid);
  if (!user || user.status !== 'active' || !user.credential || user.tokenVersion !== p.tv) return null;
  return { user: publicUser(user), access: accessOfUser(user), accessVersion: getDb().accessVersion };
}
export const currentAccessVersion = () => getDb().accessVersion;
export function meOf(auth) { const u = getDb().users.find((x) => x.id === auth.user.id); return buildMe(u, auth.access); }

const COMMON = new Set(['12345678', '123456789', 'password', 'password1', 'qwertyui', '11111111', 'abcd1234']);
function checkPassword(password, username) {
  const errs = [];
  if (typeof password !== 'string' || password.length < 8) errs.push(VERR('password', 'password_short', 'كلمة المرور يجب ألا تقل عن 8 أحرف.', 'The password must be at least 8 characters.'));
  else if (password.length > 128) errs.push(VERR('password', 'password_long', 'كلمة المرور طويلة جدًا.', 'The password is too long.'));
  else if (String(password).toLowerCase() === String(username).toLowerCase() || COMMON.has(String(password).toLowerCase())) errs.push(VERR('password', 'password_weak', 'كلمة المرور سهلة التخمين.', 'The password is too easy to guess.'));
  if (errs.length) throw validationError(errs);
}
/** POST /auth/activate {code, password}: one-time, hashed, expiring, single use → signs the user in like a login */
export function activate({ code, password } = {}) {
  const db = getDb(); const h = typeof code === 'string' && code.trim() ? hashCode(code) : null;
  const act = h ? db.activations.find((a) => a.codeHash === h) : null;
  if (!act || act.usedAt || act.revokedAt) throw new ApiError(400, 'invalid_activation_code');
  if (Date.parse(act.expiresAt) <= clock()) throw new ApiError(400, 'activation_expired');
  const user = db.users.find((u) => u.id === act.userId); if (!user) throw new ApiError(400, 'invalid_activation_code');
  if (user.status === 'inactive') throw new ApiError(403, 'account_inactive');
  checkPassword(password, user.username);
  const wasInvited = user.status === 'invited';
  user.credential = hashPassword(password); user.status = 'active'; user.tokenVersion += 1; user.updatedAt = nowIso(); act.usedAt = nowIso(); user.lastLoginAt = nowIso();
  commit();
  auditLog(null, wasInvited ? 'user_activated' : 'password_reset', 'user', user.id, { ar: wasInvited ? `تفعيل الحساب: ${user.username}` : `إعادة تعيين كلمة المرور: ${user.username}`, en: wasInvited ? `Account activated: ${user.username}` : `Password reset: ${user.username}` });
  return { token: issueToken(user), me: buildMe(user, accessOfUser(user)) };
}

/* ====================================================================== guards shared by the services */
/** the user must hold AT LEAST ONE of the modules (`modules` is an id or a list) */
function requireModule(auth, modules, route) {
  if (!auth) throw new ApiError(401, 'unauthenticated');
  const list = [].concat(modules);
  if (!list.some((m) => auth.access.permissions.has(m))) { auditDenied(auth.user, list[0], route || list[0]); throw new ApiError(403, 'forbidden', { permission: list[0], module: list[0] }); }
}
/** a read-only role may look and export but never change anything: every administration write passes through here (after the module check) */
function requireWritable(auth, route) {
  if (auth.access.readOnly) { auditDenied(auth.user, 'read_only_role', route || 'write', 'read_only'); throw new ApiError(403, 'read_only_role'); }
}
const isFullAdminAuth = (auth) => isFullAdminUser(getDb().users.find((u) => u.id === auth.user.id) || { status: 'x' });

function lastAdminGuard(actor, afterUsers, route) {
  const before = fullAdminCount(getDb().users); const after = fullAdminCount(afterUsers);
  if (before >= 1 && after < 1) { auditDenied(actor, 'users', route, 'last_admin'); throw new ApiError(409, 'last_admin'); }
}
const delegationError = (auth, route, v) => { auditDenied(auth.user, 'users', route, 'delegation'); return new ApiError(403, 'forbidden', { reason: 'delegation', permission: v.permission, module: v.module || undefined }); };

/* ====================================================================== users */
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,39}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (x) => (typeof x === 'string' ? x.trim() : '');
function initials(nameEn, nameAr) { return initialsOf(str(nameEn) || str(nameAr)); }

/** the ONE role and the ONE scope of a user: validated against the stored roles and the verified hierarchy. Returns { roleId, scope } (either may be undefined when invalid → errors pushed). */
function readRoleAndScope(input, roles, fields) {
  const idx = rolesIndex(roles); let roleId; let scope;
  if (typeof input.roleId !== 'string' || !input.roleId) fields.push(VERR('roleId', 'role_required', 'اختر دورًا للمستخدم.', 'Choose a role for the user.'));
  else if (!idx.has(input.roleId)) fields.push(VERR('roleId', 'unknown_role', 'اختر دورًا موجودًا.', 'Choose an existing role.'));
  else roleId = input.roleId;
  if (input.scope === undefined || input.scope === null) fields.push(VERR('scope', 'scope_required', 'حدّد النطاق الجغرافي للمستخدم.', 'Set the geographic scope of the user.'));
  else {
    const v = validateGeoScope(input.scope);
    if (!v.ok) for (const e of v.errors) fields.push(VERR(e.path || 'scope', e.code, e.ar, e.en));
    else if (isEmptyGeoScope(input.scope)) fields.push(VERR('scope', 'scope_empty', 'اختر أمانة أو بلدية واحدة على الأقل، أو «كل الجهات».', 'Choose at least one Amanah or municipality, or "all entities".'));
    else scope = normalizeGeoScope(input.scope);
  }
  return { roleId, scope };
}

export function listUsers(auth) {
  requireModule(auth, 'users', 'GET /admin/users');
  const db = getDb(); return { users: db.users.map((u) => userRow(u, db)), storage: storageInfo(), accessVersion: db.accessVersion };
}
export function getUser(auth, id) {
  requireModule(auth, 'users', 'GET /admin/users/:id');
  const db = getDb(); const u = db.users.find((x) => x.id === id); if (!u) throw new ApiError(404, 'not_found'); return { user: userRow(u, db) };
}
function issueActivationFor(user, actor) {
  const db = getDb(); for (const a of db.activations) if (a.userId === user.id && !a.usedAt && !a.revokedAt) a.revokedAt = nowIso();
  const cutoff = clock() - 30 * 86400e3; db.activations = db.activations.filter((a) => Date.parse(a.expiresAt) > cutoff);
  const code = newActivationCode(); const expiresAt = new Date(clock() + ACTIVATION_MS).toISOString();
  db.activations.push({ id: randomId('act'), userId: user.id, codeHash: hashCode(code), createdAt: nowIso(), expiresAt, usedAt: null, revokedAt: null, createdBy: actor.id });
  return { code, expiresAt }; // the plain code is returned ONCE to the administrator; only its hash is stored and it is never written to the audit trail
}
/** POST /admin/users {username, nameAr?, nameEn?, email?, roleId, scope, avatar?, titleAr?, titleEn?} */
export function createUser(auth, input = {}) {
  requireModule(auth, 'users', 'POST /admin/users'); requireWritable(auth, 'POST /admin/users');
  const db = getDb(); const fields = [];
  const username = str(input.username).toLowerCase();
  if (!USERNAME_RE.test(username)) fields.push(VERR('username', 'username_invalid', 'اسم المستخدم من 3 إلى 40 حرفًا (حروف إنجليزية صغيرة وأرقام ونقطة وشرطة).', 'The username is 3–40 characters (lowercase letters, digits, dot, dash).'));
  else if (db.users.some((u) => u.username === username)) fields.push(VERR('username', 'username_taken', 'اسم المستخدم مستخدم من قبل.', 'This username is already taken.'));
  let nameAr = str(input.nameAr); let nameEn = str(input.nameEn);
  if (!nameAr && !nameEn) fields.push(VERR('nameAr', 'name_required', 'الاسم مطلوب.', 'The name is required.')); else { nameAr = nameAr || nameEn; nameEn = nameEn || nameAr; }
  if (nameAr.length > 80 || nameEn.length > 80) fields.push(VERR('nameAr', 'name_long', 'الاسم طويل جدًا.', 'The name is too long.'));
  const email = str(input.email) || null; if (email && !EMAIL_RE.test(email)) fields.push(VERR('email', 'email_invalid', 'البريد الإلكتروني غير صالح.', 'The email address is not valid.'));
  else if (email && db.users.some((u) => (u.email || '').toLowerCase() === email.toLowerCase())) fields.push(VERR('email', 'email_taken', 'البريد الإلكتروني مستخدم من قبل.', 'This email is already used.'));
  const { roleId, scope } = readRoleAndScope(input, db.roles, fields);
  if (fields.length) throw validationError(fields);
  if (!isFullAdminAuth(auth)) { const v = accessViolation(computeAccess({ roleId, scope }, db.roles), auth.access); if (v) throw delegationError(auth, 'POST /admin/users', v); }
  const now = nowIso();
  const user = { id: randomId('usr'), username, email, nameAr, nameEn, avatar: str(input.avatar).slice(0, 3) || initials(nameEn, nameAr), titleAr: str(input.titleAr) || null, titleEn: str(input.titleEn) || null, status: 'invited', roleId, scope, tokenVersion: 1, createdAt: now, createdBy: auth.user.id, updatedAt: now, lastLoginAt: null, credential: null };
  db.users.push(user);
  const activation = issueActivationFor(user, auth.user); commit();
  auditLog(auth.user, 'user_create', 'user', user.id, { ar: `إنشاء المستخدم ${username}`, en: `User created: ${username}` }, undefined, auditUserState(user));
  return { user: userRow(user, db), activation };
}
/** PATCH /admin/users/:id — details, status, roleId, scope. Guards: delegation ⊆ own access, a user can NOT change their own role or scope, last full administrator. */
export function updateUser(auth, id, patch = {}) {
  requireModule(auth, 'users', 'PATCH /admin/users/:id'); requireWritable(auth, 'PATCH /admin/users/:id');
  const db = getDb(); const user = db.users.find((u) => u.id === id); if (!user) throw new ApiError(404, 'not_found');
  const fields = []; const self = auth.user.id === user.id; const full = isFullAdminAuth(auth);
  const next = { ...user };
  if (patch.username !== undefined && str(patch.username).toLowerCase() !== user.username) fields.push(VERR('username', 'username_immutable', 'لا يمكن تغيير اسم المستخدم.', 'The username cannot be changed.'));
  if (patch.nameAr !== undefined || patch.nameEn !== undefined) {
    let nameAr = patch.nameAr !== undefined ? str(patch.nameAr) : user.nameAr; let nameEn = patch.nameEn !== undefined ? str(patch.nameEn) : user.nameEn;
    if (!nameAr && !nameEn) fields.push(VERR('nameAr', 'name_required', 'الاسم مطلوب.', 'The name is required.')); else { next.nameAr = nameAr || nameEn; next.nameEn = nameEn || nameAr; }
    if (next.nameAr.length > 80 || next.nameEn.length > 80) fields.push(VERR('nameAr', 'name_long', 'الاسم طويل جدًا.', 'The name is too long.'));
  }
  if (patch.email !== undefined) {
    const email = str(patch.email) || null;
    if (email && !EMAIL_RE.test(email)) fields.push(VERR('email', 'email_invalid', 'البريد الإلكتروني غير صالح.', 'The email address is not valid.'));
    else if (email && db.users.some((u) => u.id !== user.id && (u.email || '').toLowerCase() === email.toLowerCase())) fields.push(VERR('email', 'email_taken', 'البريد الإلكتروني مستخدم من قبل.', 'This email is already used.'));
    else next.email = email;
  }
  if (patch.avatar !== undefined) next.avatar = str(patch.avatar).slice(0, 3) || user.avatar;
  if (patch.titleAr !== undefined) next.titleAr = str(patch.titleAr) || null; if (patch.titleEn !== undefined) next.titleEn = str(patch.titleEn) || null;
  if (patch.status !== undefined) {
    if (patch.status !== 'active' && patch.status !== 'inactive') fields.push(VERR('status', 'status_invalid', 'الحالة إما نشط أو معطّل.', 'The status is either active or inactive.'));
    else next.status = patch.status === 'inactive' ? 'inactive' : (user.credential ? 'active' : 'invited');
  }
  if (patch.roleId !== undefined || patch.scope !== undefined) {
    const { roleId, scope } = readRoleAndScope({ roleId: patch.roleId !== undefined ? patch.roleId : user.roleId, scope: patch.scope !== undefined ? patch.scope : user.scope }, db.roles, fields);
    if (roleId !== undefined) next.roleId = roleId; if (scope !== undefined) next.scope = scope;
  }
  if (fields.length) throw validationError(fields);
  // guards -------------------------------------------------------------------------------------------------------------------------------------------
  const beforeAccess = accessOfUser(user); const accessChanged = next.roleId !== user.roleId || !geoScopesEqual(next.scope, user.scope);
  if (self && accessChanged) { auditDenied(auth.user, 'users', 'PATCH /admin/users/:id', 'self_elevation'); throw new ApiError(403, 'self_elevation'); } // nobody edits their own role or scope
  if (!full) { // a non-administrator may only touch users whose current access is inside their own, and grant only what is inside their own
    const cur = accessViolation(beforeAccess, auth.access); if (cur) throw delegationError(auth, 'PATCH /admin/users/:id', cur);
  }
  const afterAccess = computeAccess({ roleId: next.roleId, scope: next.scope }, db.roles);
  if (accessChanged && !full) { const v = accessViolation(afterAccess, auth.access); if (v) throw delegationError(auth, 'PATCH /admin/users/:id', v); }
  if (accessChanged || next.status !== user.status) lastAdminGuard(auth.user, db.users.map((u) => (u.id === user.id ? next : u)), 'PATCH /admin/users/:id');
  // apply --------------------------------------------------------------------------------------------------------------------------------------------
  const before = auditUserState(user); const statusChanged = next.status !== user.status;
  const changed = ['nameAr', 'nameEn', 'email', 'avatar', 'titleAr', 'titleEn'].filter((k) => next[k] !== user[k]);
  Object.assign(user, { nameAr: next.nameAr, nameEn: next.nameEn, email: next.email, avatar: next.avatar, titleAr: next.titleAr, titleEn: next.titleEn, status: next.status, roleId: next.roleId, scope: next.scope });
  if (statusChanged || accessChanged) user.tokenVersion += 1; // the user's current sessions end at their next request
  user.updatedAt = nowIso(); commit();
  if (changed.length) auditLog(auth.user, 'user_update', 'user', user.id, { ar: `تعديل بيانات المستخدم ${user.username}`, en: `User details updated: ${user.username}` }, undefined, { fields: changed });
  if (statusChanged) auditLog(auth.user, 'user_status', 'user', user.id, { ar: `تغيير حالة ${user.username} إلى ${user.status}`, en: `Status of ${user.username} changed to ${user.status}` }, { status: before.status }, { status: user.status });
  if (accessChanged) auditLog(auth.user, 'user_assignments', 'user', user.id, { ar: `تغيير الدور والنطاق الجغرافي للمستخدم ${user.username}`, en: `Role and geographic scope changed: ${user.username}` }, { roleId: before.roleId, scope: before.scope }, { roleId: user.roleId, scope: describeGeoScope(user.scope, 'en') });
  return { user: userRow(user, db) };
}
/** POST /admin/users/:id/activation — a fresh one-time code (the previous unused ones are revoked) */
export function reissueActivation(auth, id) {
  requireModule(auth, 'users', 'POST /admin/users/:id/activation'); requireWritable(auth, 'POST /admin/users/:id/activation');
  const db = getDb(); const user = db.users.find((u) => u.id === id); if (!user) throw new ApiError(404, 'not_found');
  if (user.status === 'inactive') throw validationError([VERR('status', 'user_inactive', 'فعّل الحساب أولًا قبل إصدار رمز تفعيل.', 'Re-activate the account before issuing an activation code.')]);
  if (!isFullAdminAuth(auth)) { const v = accessViolation(accessOfUser(user), auth.access); if (v) throw delegationError(auth, 'POST /admin/users/:id/activation', v); }
  const activation = issueActivationFor(user, auth.user); user.updatedAt = nowIso(); commit();
  auditLog(auth.user, 'activation_issued', 'user', user.id, { ar: `إصدار رمز تفعيل للمستخدم ${user.username}`, en: `Activation code issued: ${user.username}` });
  return { user: userRow(user, db), activation };
}

/* ====================================================================== roles */
/** the role list is read by the role pages and by the user pages (the role picker) */
export function listRoles(auth) { requireModule(auth, ['roles', 'users'], 'GET /admin/roles'); const db = getDb(); return { roles: db.roles.map((r) => roleRow(r, db)) }; }
function readRoleFields(input, existing, fields, db) {
  const out = {};
  for (const k of ['nameAr', 'nameEn']) {
    if (input[k] === undefined && existing) continue;
    const v = str(input[k]);
    if (!v) fields.push(VERR(k, 'name_required', 'اسم الدور مطلوب بالعربية والإنجليزية.', 'The role name is required in Arabic and English.'));
    else if (v.length > 60) fields.push(VERR(k, 'name_long', 'اسم الدور طويل جدًا.', 'The role name is too long.'));
    else if (db.roles.some((r) => (!existing || r.id !== existing.id) && String(r[k]).trim().toLowerCase() === v.toLowerCase())) fields.push(VERR(k, 'name_taken', 'يوجد دور بهذا الاسم.', 'A role with this name exists.'));
    else out[k] = v;
  }
  for (const k of ['descriptionAr', 'descriptionEn']) if (input[k] !== undefined) { const v = str(input[k]); if (v.length > 300) fields.push(VERR(k, 'description_long', 'الوصف طويل جدًا.', 'The description is too long.')); else out[k] = v; }
  if (input.modules !== undefined || !existing) {
    if (!Array.isArray(input.modules) || input.modules.length === 0) fields.push(VERR('modules', 'modules_required', 'اختر وحدة واحدة على الأقل.', 'Choose at least one module.'));
    else { const bad = unknownModules(input.modules); if (bad.length) fields.push(VERR('modules', 'unknown_module', 'وحدة غير معروفة.', 'Unknown module.')); else out.modules = normalizeModules(input.modules); }
  }
  if (input.readOnly !== undefined) { if (typeof input.readOnly !== 'boolean') fields.push(VERR('readOnly', 'read_only_invalid', 'قيمة «للقراءة فقط» إما نعم أو لا.', 'The read-only value is yes or no.')); else out.readOnly = input.readOnly; }
  return out;
}
export function createRole(auth, input = {}) {
  requireModule(auth, 'roles', 'POST /admin/roles'); requireWritable(auth, 'POST /admin/roles');
  const db = getDb(); const fields = []; const v = readRoleFields(input, null, fields, db); if (fields.length) throw validationError(fields);
  if (!isFullAdminAuth(auth)) { const over = v.modules.find((m) => !auth.access.permissions.has(m)); if (over) { auditDenied(auth.user, 'roles', 'POST /admin/roles', 'delegation'); throw new ApiError(403, 'forbidden', { reason: 'delegation', permission: over, module: over }); } }
  const now = nowIso(); const role = { id: randomId('role'), nameAr: v.nameAr, nameEn: v.nameEn, descriptionAr: v.descriptionAr || '', descriptionEn: v.descriptionEn || '', modules: v.modules, readOnly: v.readOnly === true, starter: false, protected: false, createdAt: now, updatedAt: now };
  db.roles.push(role); commit();
  auditLog(auth.user, 'role_create', 'role', role.id, { ar: `إنشاء الدور ${role.nameAr}`, en: `Role created: ${role.nameEn}` }, undefined, { modules: role.modules, readOnly: role.readOnly });
  return { role: roleRow(role, db) };
}
export function updateRole(auth, id, patch = {}) {
  requireModule(auth, 'roles', 'PATCH /admin/roles/:id'); requireWritable(auth, 'PATCH /admin/roles/:id');
  const db = getDb(); const role = db.roles.find((r) => r.id === id); if (!role) throw new ApiError(404, 'not_found');
  const fields = []; const v = readRoleFields(patch, role, fields, db); if (fields.length) throw validationError(fields);
  const oldMods = normalizeModules(role.modules); const newMods = v.modules || oldMods; const newRO = v.readOnly !== undefined ? v.readOnly : !!role.readOnly;
  if (role.protected && (ADMIN_KEEP_MODULES.some((m) => !newMods.includes(m)) || newRO)) { auditDenied(auth.user, 'roles', 'PATCH /admin/roles/:id', 'protected_role'); throw new ApiError(403, 'forbidden', { reason: 'protected_role' }); } // the Administrator keeps user and role management and is never read-only
  const full = isFullAdminAuth(auth);
  if (!full) { const cur = oldMods.find((m) => !auth.access.permissions.has(m)); const add = newMods.find((m) => !oldMods.includes(m) && !auth.access.permissions.has(m)); const bad = cur || add; if (bad) { auditDenied(auth.user, 'roles', 'PATCH /admin/roles/:id', 'delegation'); throw new ApiError(403, 'forbidden', { reason: 'delegation', permission: bad, module: bad }); } }
  const me = db.users.find((u) => u.id === auth.user.id);
  if (me && me.roleId === role.id && (newMods.some((m) => !oldMods.includes(m)) || (role.readOnly && !newRO))) { // editing the role the actor holds must not raise the actor's own access
    auditDenied(auth.user, 'roles', 'PATCH /admin/roles/:id', 'self_elevation'); throw new ApiError(403, 'self_elevation', { permission: newMods.find((m) => !oldMods.includes(m)) || 'read_only' });
  }
  const before = { modules: oldMods, readOnly: !!role.readOnly }; Object.assign(role, { nameAr: v.nameAr ?? role.nameAr, nameEn: v.nameEn ?? role.nameEn, descriptionAr: v.descriptionAr ?? role.descriptionAr, descriptionEn: v.descriptionEn ?? role.descriptionEn, modules: newMods, readOnly: newRO, updatedAt: nowIso() });
  commit(); auditLog(auth.user, 'role_update', 'role', role.id, { ar: `تعديل الدور ${role.nameAr}`, en: `Role updated: ${role.nameEn}` }, before, { modules: newMods, readOnly: newRO });
  return { role: roleRow(role, db) };
}
export function deleteRole(auth, id) {
  requireModule(auth, 'roles', 'DELETE /admin/roles/:id'); requireWritable(auth, 'DELETE /admin/roles/:id');
  const db = getDb(); const role = db.roles.find((r) => r.id === id); if (!role) throw new ApiError(404, 'not_found');
  if (role.protected) { auditDenied(auth.user, 'roles', 'DELETE /admin/roles/:id', 'protected_role'); throw new ApiError(403, 'forbidden', { reason: 'protected_role' }); }
  const users = db.users.filter((u) => u.roleId === id).length; if (users) throw new ApiError(409, 'role_in_use', { users });
  db.roles = db.roles.filter((r) => r.id !== id); commit();
  auditLog(auth.user, 'role_delete', 'role', id, { ar: `حذف الدور ${role.nameAr}`, en: `Role deleted: ${role.nameEn}` }, { modules: normalizeModules(role.modules), readOnly: !!role.readOnly });
  return { ok: true };
}

/* ====================================================================== catalog for the admin pickers */
let hierarchyPayload = null;
export function hierarchyForPickers() {
  if (hierarchyPayload) return hierarchyPayload;
  hierarchyPayload = {
    amanahs: ENTITIES.slice(0, N_AMANAH).map((e) => ({ key: e.en, nameAr: e.ar, nameEn: e.en, municipalities: municipalitiesOf(e.en).map((m) => ({ ref: m.refId, nameAr: m.ar, nameEn: m.en !== m.ar ? m.en : null })) })),
    nonMunicipalEntities: ENTITIES.slice(N_AMANAH).map((e) => ({ key: e.en, nameAr: e.ar, nameEn: e.en }))
  };
  return hierarchyPayload;
}
export function adminCatalog(auth) {
  requireModule(auth, ['users', 'roles'], 'GET /admin/catalog');
  return {
    modules: MODULES.map((m) => ({ id: m.id, group: m.group, nameAr: m.nameAr, nameEn: m.nameEn, routes: m.routes, descriptionAr: m.descriptionAr, descriptionEn: m.descriptionEn, scoped: m.scoped })),
    starterRoles: STARTER_ROLES.map((r) => ({ id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, descriptionAr: r.descriptionAr, descriptionEn: r.descriptionEn, modules: r.modules, readOnly: r.readOnly, protected: r.protected })),
    adminKeepModules: ADMIN_KEEP_MODULES, hierarchy: hierarchyForPickers(), amanahKeys: AMANAH_KEYS, storage: storageInfo(), adminRoleId: ADMIN_ROLE_ID, systemAdminRoleId: ADMIN_ROLE_ID, accessVersion: getDb().accessVersion
  };
}
