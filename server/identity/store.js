// Identity persistence: ONE JSON document, written atomically (temp file + rename).
// Location: IIM_IDENTITY_FILE, else server/.data/identity.json (git-ignored). When that is not writable (Vercel's read-only filesystem) it falls back to the OS temp directory,
// and when even that fails to a process-memory store. `mode` says which one is active; only 'file' is durable across restarts (the UI states that the demo store is not durable otherwise).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STARTER_ROLES, ADMIN_ROLE_ID, AUDITOR_ROLE_ID, ADMIN_KEEP_MODULES, normalizeModules } from '../../src/data/permissions';
import { ALL_SCOPE, normalizeGeoScope, EMPTY_SCOPE } from '../../src/data/geoScope';
import { hashPassword, randomId, randomSecret } from './crypto';

export const SCHEMA_VERSION = 2;
const AUDIT_CAP = 5000;

// The three accounts of the original client-only login, migrated server-side (display names preserved — `usr-demo` has ONE verified display name, «Li Fangjun», kept in both language fields so every language shows the same person; the demo passwords are hashed here and no longer ship in the browser bundle).
const SEED_ACCOUNTS = [
  { id: 'usr-demo', username: 'demo', password: 'demo123', nameAr: 'Li Fangjun', nameEn: 'Li Fangjun', avatar: 'LF', titleAr: 'مركز الخدمات المشتركة · مدير', titleEn: 'Shared Service Center · Manager', roleId: ADMIN_ROLE_ID },
  { id: 'usr-auditor', username: 'auditor', password: 'demo123', nameAr: 'أحمد آل سعود', nameEn: 'Ahmad Al-Saud', avatar: 'AS', titleAr: 'مدقق', titleEn: 'Auditor', roleId: AUDITOR_ROLE_ID },
  { id: 'usr-admin', username: 'admin', password: 'admin', nameAr: 'مدير النظام', nameEn: 'System Admin', avatar: 'AD', titleAr: 'مدير المنصة', titleEn: 'Platform Admin', roleId: ADMIN_ROLE_ID }
];

const defaultFile = () => path.join(process.cwd(), 'server', '.data', 'identity.json');
let state = null; // { file, mode, db, dirty }

function canWrite(file) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const probe = `${file}.probe-${process.pid}`; fs.writeFileSync(probe, '1'); fs.unlinkSync(probe); return true;
  } catch { return false; }
}
function chooseLocation(requested) {
  const want = requested || process.env.IIM_IDENTITY_FILE || defaultFile();
  if (want === ':memory:') return { file: null, mode: 'memory' };
  if (canWrite(want)) return { file: want, mode: 'file' };
  const tmp = path.join(os.tmpdir(), 'iim-identity.json');
  if (canWrite(tmp)) return { file: tmp, mode: 'tmp' };
  return { file: null, mode: 'memory' };
}
function readFile(file) {
  if (!file || !fs.existsSync(file)) return null;
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && typeof j === 'object' ? j : null; } catch { return null; } // an unreadable file starts a fresh store: it is never half-trusted
}
function writeAtomic(file, db) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

const emptyDb = () => ({ schemaVersion: 0, accessVersion: 1, secret: null, users: [], roles: [], audit: [], activations: [] });
const nowIso = () => new Date().toISOString();

/* ---------- schema 1 → 2: the simplified model (docs/access-control.md S5) ---------- */
// old permission id → the module(s) it switches on
const OLD_MODULE_OF = (id) => {
  const [pre, action] = String(id).split('.');
  if (pre === 'invoices') return ['invoices_collected', 'invoices_uncollected'];
  if (pre === 'collection') return ['invoices_uncollected'];
  if (pre === 'reports') return ['smart_reports'];
  if (pre === 'sources' || (pre === 'data' && action === 'upload')) return ['data_sources'];
  if (pre === 'roles' || pre === 'audit') return ['roles'];
  if (['dashboard', 'exclusions', 'contracts', 'enforcement', 'planning', 'decisions', 'metrics', 'users'].includes(pre)) return [pre];
  return [];
};
const OLD_WRITE_ACTIONS = new Set(['upload', 'manage', 'review', 'followup', 'update']);
// the write-capable modules and the old permissions that really granted a write there (a role that held a module's pages but none of these gains write power from module access)
const OLD_WRITE_PERMS = { exclusions: ['exclusions.upload', 'exclusions.manage'], enforcement: ['enforcement.upload', 'enforcement.review'], planning: ['planning.update'], decisions: ['decisions.followup'], data_sources: ['data.upload'], users: ['users.manage'], roles: ['roles.manage'] };
const OLD_STARTER_NAMES = { 'role-system-admin': 'System Administrator', 'role-collection': 'Collection Officer', 'role-auditor': 'Read-only Auditor', 'role-financial': 'Financial Manager / Analyst', 'role-enforcement': 'Enforcement Reviewer' };

/** a stored role of the old shape ({ permissions:[ids] }) → { modules, readOnly, widened:[modules gained with write power] } */
export function mapOldRole(role) {
  const perms = Array.isArray(role.permissions) ? role.permissions : [];
  const mods = new Set(); for (const p of perms) for (const m of OLD_MODULE_OF(p)) mods.add(m);
  const readOnly = !perms.some((p) => OLD_WRITE_ACTIONS.has(String(p).split('.')[1]));
  const widened = readOnly ? [] : [...mods].filter((m) => OLD_WRITE_PERMS[m] && !OLD_WRITE_PERMS[m].some((p) => perms.includes(p)));
  return { modules: normalizeModules([...mods]), readOnly, widened: normalizeModules(widened) };
}
const SCOPE_TEXT = (s) => { const n = normalizeGeoScope(s); return n.all ? 'all' : `${n.grants.length} Amanah grant(s)${n.nonMunicipal ? ' + non-municipal' : ''}`; };

/** schema 1 → 2 IN PLACE. Roles { permissions } → { modules, readOnly }; users { assignments } → { roleId, scope } (the FIRST assignment is kept; the rest are dropped and listed in the audit trail). Returns true when anything changed. */
function migrateToSimplified(db, now) {
  let changed = false; const summary = { roles: [], users: [], dropped: [], widened: {} };
  for (const r of db.roles) {
    if (Array.isArray(r.modules) && !Array.isArray(r.permissions)) { if (typeof r.readOnly !== 'boolean') { r.readOnly = false; changed = true; } continue; }
    const m = mapOldRole(r);
    const starter = STARTER_ROLES.find((s) => s.id === r.id);
    r.modules = m.modules; r.readOnly = r.protected ? false : m.readOnly; delete r.permissions;
    if (starter && r.starter && r.nameEn === OLD_STARTER_NAMES[r.id]) { r.nameAr = starter.nameAr; r.nameEn = starter.nameEn; r.descriptionAr = starter.descriptionAr; r.descriptionEn = starter.descriptionEn; } // an unedited starter role takes the new name and description
    r.updatedAt = now; changed = true;
    summary.roles.push({ id: r.id, modules: r.modules.length, readOnly: r.readOnly }); if (m.widened.length && !r.readOnly) summary.widened[r.id] = m.widened;
  }
  for (const u of db.users) {
    if (!Array.isArray(u.assignments)) { if (u.roleId === undefined) { u.roleId = null; u.scope = EMPTY_SCOPE; changed = true; } continue; }
    const first = u.assignments[0]; const dropped = u.assignments.slice(1);
    u.roleId = first ? first.roleId : null; u.scope = first ? normalizeGeoScope(first.scope) : EMPTY_SCOPE; delete u.assignments;
    if (dropped.length) {
      u.tokenVersion = (u.tokenVersion || 1) + 1; // the user's access narrowed: current sessions end
      db.audit.push({ id: randomId('aud'), at: now, actorId: 'migration', actorName: 'ترحيل النظام', actorNameEn: 'System migration', action: 'migration', targetType: 'user', targetId: u.id,
        summary: `ترحيل ${u.username} إلى دور واحد ونطاق واحد: احتُفظ بالأول وأُسقط ${dropped.length}`, summaryEn: `${u.username} migrated to ONE role and ONE scope: the first assignment kept, ${dropped.length} dropped`,
        before: { assignments: [first, ...dropped].map((a) => ({ roleId: a.roleId, scope: SCOPE_TEXT(a.scope) })) }, after: { roleId: u.roleId, scope: SCOPE_TEXT(u.scope), dropped: dropped.map((a) => ({ roleId: a.roleId, scope: SCOPE_TEXT(a.scope) })) } });
      summary.dropped.push(u.username);
    }
    u.updatedAt = now; summary.users.push(u.username); changed = true;
  }
  if (changed) db.audit.push({ id: randomId('aud'), at: now, actorId: 'migration', actorName: 'ترحيل النظام', actorNameEn: 'System migration', action: 'migration', targetType: 'session', targetId: 'schema-v2',
    summary: `ترحيل الهوية إلى النموذج المبسّط (الإصدار 2): ${summary.roles.length} أدوار، ${summary.users.length} مستخدمين، ${summary.dropped.length} فقدوا إسنادًا إضافيًا`,
    summaryEn: `Identity migrated to the simplified model (schema 2): ${summary.roles.length} roles, ${summary.users.length} users, ${summary.dropped.length} lost extra assignments`,
    after: { roles: summary.roles, users: summary.users, usersWithDroppedAssignments: summary.dropped, rolesWithNewWritePower: summary.widened } });
  return changed;
}

/* ---------- one person, one name: the demo account used to carry a different Arabic name (a language-specific persona) next to «Li Fangjun» (a language-specific persona, not a translation) ---------- */
const OLD_DEMO_NAMES = { id: 'usr-demo', nameAr: '\u0637\u0627\u0631\u0642', nameEn: 'Li Fangjun' }; // the old Arabic persona, as escapes (no persona text lives in the code)
const hasOldDemoName = (u) => u && u.id === OLD_DEMO_NAMES.id && u.nameAr === OLD_DEMO_NAMES.nameAr && u.nameEn === OLD_DEMO_NAMES.nameEn;
/** does this stored document still hold the old two-persona name? (exact old seed values only: a name an administrator edited is never touched) */
export const needsIdentityNameFix = (db) => Array.isArray(db && db.users) && db.users.some(hasOldDemoName);
/** IN PLACE, idempotent: `usr-demo` shows «Li Fangjun» in both languages. No id, credential, role, scope or token change; ONE audit event; the history (audit / plan snapshots) is not rewritten. */
function fixIdentityNames(db, now) {
  const fixed = db.users.filter(hasOldDemoName); if (!fixed.length) return false;
  for (const u of fixed) { u.nameAr = u.nameEn; u.avatar = 'LF'; u.updatedAt = now; }
  db.audit.push({ id: randomId('aud'), at: now, actorId: 'migration', actorName: 'ترحيل النظام', actorNameEn: 'System migration', action: 'migration', targetType: 'user', targetId: fixed[0].id,
    summary: 'توحيد اسم الحساب التجريبي: اسم معتمد واحد (Li Fangjun) يظهر بالعربية والإنجليزية بدل اسمين مختلفين', summaryEn: 'Demo account name unified: ONE verified display name (Li Fangjun) is shown in Arabic and English instead of two different names',
    before: { nameAr: OLD_DEMO_NAMES.nameAr, nameEn: OLD_DEMO_NAMES.nameEn }, after: { nameAr: 'Li Fangjun', nameEn: 'Li Fangjun' } });
  return true;
}

/** Seeds + migrates the document IN PLACE. Idempotent; never overwrites existing users, roles or audit. Returns true when anything changed. */
export function migrate(db, { now = nowIso() } = {}) {
  let changed = false;
  if (!Array.isArray(db.users)) { db.users = []; changed = true; }
  if (!Array.isArray(db.roles)) { db.roles = []; changed = true; }
  if (!Array.isArray(db.audit)) { db.audit = []; changed = true; }
  if (!Array.isArray(db.activations)) { db.activations = []; changed = true; }
  if (!Number.isInteger(db.accessVersion)) { db.accessVersion = 1; changed = true; }
  const from = Number.isInteger(db.schemaVersion) ? db.schemaVersion : 0;
  if (from < 1) {
    const added = { roles: [], users: [] };
    for (const r of STARTER_ROLES) if (!db.roles.some((x) => x.id === r.id)) { db.roles.push({ ...r, modules: [...r.modules], createdAt: now, updatedAt: now }); added.roles.push(r.id); }
    for (const a of SEED_ACCOUNTS) {
      if (db.users.some((u) => u.id === a.id || u.username === a.username)) continue;
      db.users.push({ id: a.id, username: a.username, email: null, nameAr: a.nameAr, nameEn: a.nameEn, avatar: a.avatar, titleAr: a.titleAr, titleEn: a.titleEn, status: 'active',
        roleId: a.roleId, scope: ALL_SCOPE, tokenVersion: 1, createdAt: now, createdBy: 'migration', updatedAt: now, lastLoginAt: null, credential: hashPassword(a.password) });
      added.users.push(a.username);
    }
    db.audit.push({ id: randomId('aud'), at: now, actorId: 'migration', actorName: 'ترحيل النظام', actorNameEn: 'System migration', action: 'migration', targetType: 'session', targetId: `schema-v${SCHEMA_VERSION}`,
      summary: `تهيئة الهوية (الإصدار ${SCHEMA_VERSION}): ${added.roles.length} أدوار، ${added.users.length} حسابات`, summaryEn: `Identity initialised (schema ${SCHEMA_VERSION}): ${added.roles.length} roles, ${added.users.length} accounts`, after: { roles: added.roles, users: added.users } });
    changed = true;
  }
  if (from < 2 || db.roles.some((r) => Array.isArray(r.permissions)) || db.users.some((u) => Array.isArray(u.assignments))) { if (migrateToSimplified(db, now)) changed = true; }
  // the protected Administrator role always keeps user and role management and is never read-only
  const admin = db.roles.find((r) => r.id === ADMIN_ROLE_ID);
  if (admin) { const missing = ADMIN_KEEP_MODULES.filter((m) => !admin.modules.includes(m)); if (missing.length || !admin.protected || admin.readOnly) { admin.modules = normalizeModules([...admin.modules, ...ADMIN_KEEP_MODULES]); admin.protected = true; admin.readOnly = false; admin.updatedAt = now; changed = true; } }
  if (fixIdentityNames(db, now)) { changed = true; }
  if (from < SCHEMA_VERSION) { db.schemaVersion = SCHEMA_VERSION; db.accessVersion += 1; changed = true; }
  if (db.audit.length > AUDIT_CAP) { db.audit.splice(0, db.audit.length - AUDIT_CAP); changed = true; }
  return changed;
}

/** a copy of the stored file taken ONCE, right before a migration of existing users writes to it (`identity.json.pre-names.bak`); never overwritten */
function backupOnce(file, db) {
  if (!file || !needsIdentityNameFix(db)) return;
  try { const bak = `${file}.pre-names.bak`; if (fs.existsSync(file) && !fs.existsSync(bak)) fs.copyFileSync(file, bak, fs.constants.COPYFILE_EXCL); } catch { /* the migration still runs; the backup is best effort */ }
}

/** open (once) and return the live document; `ensure()` is cheap after the first call */
export function ensure() {
  if (state) return state;
  const loc = chooseLocation(null);
  const db = readFile(loc.file) || emptyDb();
  state = { ...loc, db, dirty: false };
  backupOnce(loc.file, db);
  if (migrate(db)) persist();
  return state;
}
export const getDb = () => ensure().db;
export const storageInfo = () => { const s = ensure(); return { mode: s.mode, durable: s.mode === 'file' }; };
export const dbFile = () => ensure().file;

/** write the document (atomic). A write failure downgrades to memory instead of failing the request. */
export function persist() {
  const s = ensure(); s.dirty = false;
  if (!s.file) return;
  try { writeAtomic(s.file, s.db); } catch { s.mode = 'memory'; s.file = null; }
}
/** a state change that must reach disk: bumps accessVersion and writes */
export function commit() { const s = ensure(); s.db.accessVersion += 1; persist(); return s.db.accessVersion; }
/** flush values that are cheap to lose (lastLoginAt) together with the next real write; also on a clean exit */
export function markDirty() { ensure().dirty = true; }
if (typeof process !== 'undefined' && process.on) process.on('beforeExit', () => { if (state && state.dirty) persist(); });

/** the HMAC signing key: IIM_AUTH_SECRET; else on Vercel a key derived from the deployment (all instances agree); else a random key persisted in the (durable) store */
export function signingSecret() {
  if (process.env.IIM_AUTH_SECRET) return process.env.IIM_AUTH_SECRET;
  const s = ensure();
  if (s.mode !== 'file' && process.env.VERCEL) return `vercel|${process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_PROJECT_ID || 'local'}|iim-identity`;
  if (!s.db.secret) { s.db.secret = randomSecret(); persist(); }
  return s.db.secret;
}

/** tests: point the store at a fresh (temp) file, or ':memory:'; the previous in-memory document is dropped. Returns the storage info. */
export function resetStore(file) {
  const loc = chooseLocation(file || ':memory:');
  const db = readFile(loc.file) || emptyDb();
  state = { ...loc, db, dirty: false };
  backupOnce(loc.file, db);
  if (migrate(db)) persist();
  return storageInfo();
}
/** tests: drop the in-memory document and re-read the same file (simulates a restart) */
export function reloadFromDisk() {
  const s = ensure(); const db = readFile(s.file) || emptyDb();
  state = { ...s, db, dirty: false }; backupOnce(s.file, db); if (migrate(db)) persist(); return state.db;
}
