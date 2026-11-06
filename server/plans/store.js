// Revenue-plans persistence («خطط الإيرادات»): ONE JSON document, written atomically (temp file + rename) — the same pattern as the identity store (server/identity/store.js).
// Location: IIM_PLANS_FILE, else server/.data/plans.json (git-ignored via server/.data/). When that is not writable (a read-only host such as Vercel) it falls back to the OS temp directory,
// and when even that fails to a process-memory store. `mode` says which one is active; ONLY 'file' survives a restart. THIS IS A LOCAL-DEMO STORE: on a read-only host the 'tmp' / 'memory' modes are not durable across
// cold starts and are not shared across function instances (docs/revenue-plans-spec.md «Persistence — verified facts and limitations»).
//
// Document (schemaVersion 3): { schemaVersion, plans:[plan], references:{ [year]: { planId, setBy, at } }, userDefaults:{ [userId]: planId }, settings:{ systemDefaultPlanId, systemDefaultConfigured } (the GLOBAL default plan every user opens unless they chose a personal default), audit:[ { id, at, actor, action, planId?, summary:{ar,en}, details? } ] }   (audit is NEVER truncated)
//   plan = { id, name, nameEn? (system plans), seedKey? (the idempotency key of a seeded system plan), isSystem, origin, content, createdBy, createdAt, updatedAt, lastEditedBy, revision, versions:[internal snapshots], legacy, state:'active' }
// A document of schemaVersion 1 (draft / active / archived plans with versions + inForce + working) is MIGRATED IN PLACE when it is opened (migrateDb): nothing is dropped, no owner is invented, the old file is kept beside it once.
// Every change goes through `mutate(fn)`: fn works on a CLONE of the document; only when it returns normally is the clone swapped in and written. A throw anywhere (a failed check, an injected fault, a bug) leaves the
// stored document exactly as it was — all-or-nothing, so a save can never half-happen.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { seedPlanContent, seedPlanName, collectionPlan2027Content, carriedForwardNote, COLLECTION_PLAN_2027, REMAINING_PLAN_2026 } from '../../src/data/plans/planDefaults.js';
import { APPROPRIATION_YEAR } from '../../src/data/appropriations.js';

export const SCHEMA_VERSION = 3;
/** the stable id of the illustrative seed plan (valid `plan-<8 hex>`) */
export const SEED_PLAN_ID = 'plan-5eed2026';
const SYSTEM_ACTOR = Object.freeze({ system: true });

let clockOverride = null;
export const setPlansClockForTests = (fn) => { clockOverride = typeof fn === 'function' ? fn : null; };
export const nowIso = () => (clockOverride ? clockOverride() : new Date().toISOString());

const defaultFile = () => path.join(process.cwd(), 'server', '.data', 'plans.json');
function canWrite(file) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); const probe = `${file}.probe-${process.pid}`; fs.writeFileSync(probe, '1'); fs.unlinkSync(probe); return true; } catch { return false; }
}
function chooseLocation(requested) {
  const want = requested || process.env.IIM_PLANS_FILE || defaultFile();
  if (want === ':memory:') return { file: null, mode: 'memory' };
  if (canWrite(want)) return { file: want, mode: 'file' };
  const tmp = path.join(os.tmpdir(), 'iim-plans.json');
  if (canWrite(tmp)) return { file: tmp, mode: 'tmp' };
  return { file: null, mode: 'memory' };
}
const looksLikeDb = (j) => !!j && typeof j === 'object' && !Array.isArray(j) && Array.isArray(j.plans) && Array.isArray(j.audit) && j.references && typeof j.references === 'object' && !Array.isArray(j.references);
/** the stored document, or null. An unreadable / malformed file is NEVER half-trusted: it is set aside (renamed, best effort) and the store starts fresh. */
function readFile(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (looksLikeDb(j)) return j;
  } catch { /* fall through */ }
  try { fs.renameSync(file, `${file}.unreadable-${Date.now()}`); } catch { /* best effort */ }
  return null;
}
function writeAtomic(file, db) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
const emptySettings = () => ({ systemDefaultPlanId: null, systemDefaultConfigured: false });
const emptyDb = () => ({ schemaVersion: SCHEMA_VERSION, plans: [], references: {}, userDefaults: {}, settings: emptySettings(), audit: [] });
const hex = (bytes) => randomBytes(bytes).toString('hex');
export const newPlanId = (db) => { for (;;) { const id = `plan-${hex(4)}`; if (!db.plans.some((p) => p.id === id)) return id; } };
export const newAuditId = () => `aud-${hex(6)}`;

/** append one audit entry (never truncated). actor = { userId, name } | { system: true } */
export function addAudit(db, { actor, action, planId = null, summary, details = null, at = nowIso() }) {
  const a = actor && actor.system ? { system: true } : actor ? { userId: actor.userId, name: actor.name, ...(actor.nameEn ? { nameEn: actor.nameEn } : {}) } : { system: true };
  db.audit.push({ id: newAuditId(), at, actor: a, action, ...(planId ? { planId } : {}), summary, ...(details ? { details } : {}) });
}

/** the illustrative SYSTEM plan, ONLY when the store holds no plans: `isSystem` (never overwritten), origin 'seed', ownerless, the 2026 reference — audited with the system actor. Returns true when it seeded. */
export function seedIfEmpty(db, now = nowIso()) {
  if (db.plans.length) return false;
  const content = seedPlanContent(APPROPRIATION_YEAR, { at: now });
  if (!content) return false;
  const plan = {
    id: SEED_PLAN_ID, name: content.name, isSystem: true, origin: 'seed', content, createdBy: null, createdAt: now, updatedAt: now, lastEditedBy: null, revision: 1,
    versions: [{ n: 1, revision: 1, content: JSON.parse(JSON.stringify(content)), savedBy: null, savedAt: now, label: 'seed' }], legacy: null, state: 'active'
  };
  db.plans.push(plan);
  addAudit(db, { actor: SYSTEM_ACTOR, action: 'seed', planId: plan.id, at: now, summary: { ar: `تهيئة الخطة الافتراضية للنظام «${seedPlanName(APPROPRIATION_YEAR)}» (بيانات توضيحية)`, en: `System default plan created: ${seedPlanName(APPROPRIATION_YEAR)} (illustrative data)` } });
  db.references[String(APPROPRIATION_YEAR)] = { planId: plan.id, setBy: { system: true }, at: now };
  addAudit(db, { actor: SYSTEM_ACTOR, action: 'reference_set', planId: plan.id, at: now, summary: { ar: `تعيين الخطة الافتراضية للنظام كخطة مرجعية لسنة ${APPROPRIATION_YEAR}`, en: `The system default plan was set as the ${APPROPRIATION_YEAR} reference plan` }, details: { year: APPROPRIATION_YEAR } });
  return true;
}

/**
 * THE 2027 COLLECTION PLAN («خطة تحصيل 2027» / "2027 Collection Plan"), created ONCE (idempotent by `seedKey`; a plan that already carries the key is never touched, edited or recreated — also not after an administrator changed anything).
 * isSystem · origin 'seed' · ownerless (createdBy null) · period 1 Jan–31 Dec 2027 · Ministry scope · targets = the communicated 2026 budget carried forward × the documented 66 % coverage (an ASSUMPTION recorded in the target basis).
 * It is NOT the global default (the full-year 2026 seed plan is: ensureInitialGlobalDefault); the 2027 reference entry is set only when none exists. Never overwrites a user plan: a user plan
 * that already uses the name makes the seed take a suffixed name instead. Returns { created, referenceSet }.
 */
export function ensureCollectionPlan2027(db, now = nowIso()) {
  const out = { created: false, referenceSet: false };
  if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings)) db.settings = emptySettings();
  const K = COLLECTION_PLAN_2027;
  let plan = db.plans.find((p) => p.seedKey === K.seedKey) || null;
  if (!plan) {
    const content = collectionPlan2027Content({ at: now }); if (!content) return out;
    const names = new Set(db.plans.map((p) => String(p.name || '').trim().toLowerCase()));
    let nameAr = K.nameAr; let nameEn = K.nameEn; if (names.has(nameAr.trim().toLowerCase()) || db.plans.some((p) => p.nameEn && String(p.nameEn).trim().toLowerCase() === nameEn.toLowerCase())) { nameAr = `${K.nameAr} (النظام)`; nameEn = `${K.nameEn} (system)`; }
    content.name = nameAr;
    const id = db.plans.some((p) => p.id === K.id) ? newPlanId(db) : K.id;
    plan = { id, name: nameAr, nameEn, seedKey: K.seedKey, isSystem: true, origin: 'seed', content, createdBy: null, createdAt: now, updatedAt: now, lastEditedBy: null, revision: 1,
      versions: [{ n: 1, revision: 1, content: JSON.parse(JSON.stringify(content)), savedBy: null, savedAt: now, label: 'seed' }], legacy: null, state: 'active' };
    db.plans.push(plan); out.created = true;
    const note = carriedForwardNote();
    addAudit(db, { actor: SYSTEM_ACTOR, action: 'seed', planId: plan.id, at: now, summary: { ar: `تهيئة «${nameAr}» (بيانات توضيحية): الفترة 1 يناير – 31 ديسمبر ${K.year}. ${note.ar}`, en: `"${nameEn}" created (illustrative data): 1 January – 31 December ${K.year}. ${note.en}` }, details: { seedKey: K.seedKey, year: K.year, carriedFromYear: K.carriedFromYear } });
  }
  if (out.created && !db.references[String(K.year)]) {
    db.references[String(K.year)] = { planId: plan.id, setBy: { system: true }, at: now }; out.referenceSet = true;
    addAudit(db, { actor: SYSTEM_ACTOR, action: 'reference_set', planId: plan.id, at: now, summary: { ar: `تعيين «${plan.name}» كخطة مرجعية لسنة ${K.year}`, en: `"${plan.nameEn || plan.name}" was set as the ${K.year} reference plan` }, details: { year: K.year } });
  }
  return out;
}

/**
 * THE REMAINING-2026 COLLECTION PLAN, created ONCE (idempotent by `seedKey`) from figures the CALLER computed from the data engine (server/plans/remaining2026.js — never invented here): `content` = deriveRemainingPlanContent(…).
 * Its period, baseline cut-off and derived figures are frozen in the plan; nothing ever recomputes or overwrites them. It is NOT the global default (the full-year 2026 seed plan is — `ensureInitialGlobalDefault`); it stays selectable. Returns { created, madeDefault:false }.
 */
export function ensureRemaining2026(db, content, now = nowIso()) {
  const out = { created: false, madeDefault: false };
  if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings)) db.settings = emptySettings();
  const K = REMAINING_PLAN_2026;
  if (db.plans.some((p) => p.seedKey === K.seedKey) || !content) return out;
  const names = new Set(db.plans.map((p) => String(p.name || '').trim().toLowerCase()));
  let nameAr = K.nameAr; let nameEn = K.nameEn; if (names.has(nameAr.trim().toLowerCase()) || db.plans.some((p) => p.nameEn && String(p.nameEn).trim().toLowerCase() === nameEn.toLowerCase())) { nameAr = `${K.nameAr} (النظام)`; nameEn = `${K.nameEn} (system)`; }
  const c = JSON.parse(JSON.stringify(content)); c.name = nameAr;
  const id = db.plans.some((p) => p.id === K.id) ? newPlanId(db) : K.id;
  const plan = { id, name: nameAr, nameEn, seedKey: K.seedKey, isSystem: true, origin: 'seed', content: c, createdBy: null, createdAt: now, updatedAt: now, lastEditedBy: null, revision: 1,
    versions: [{ n: 1, revision: 1, content: JSON.parse(JSON.stringify(c)), savedBy: null, savedAt: now, label: 'seed' }], legacy: null, state: 'active' };
  db.plans.push(plan); out.created = true;
  const b = c.baseline;
  addAudit(db, { actor: SYSTEM_ACTOR, action: 'seed', planId: plan.id, at: now, summary: { ar: `تهيئة «${nameAr}» (بيانات توضيحية): الفترة ${K.period.start} – ${K.period.end}؛ الأساس حتى ${b?.cutoff}، مشتقة من الخطة السنوية`, en: `"${nameEn}" created (illustrative data): ${K.period.start} – ${K.period.end}; baseline to ${b?.cutoff}, derived from the annual plan` }, details: { seedKey: K.seedKey, cutoff: b?.cutoff ?? null, annualPlanId: b?.annualPlanId ?? null, annualPlanRevision: b?.annualPlanRevision ?? null } });
  // NOT the global default: the full-year 2026 seed plan is (ensureInitialGlobalDefault); this plan stays selectable
  return out;
}

/**
 * THE INITIAL GLOBAL DEFAULT = the full-year 2026 illustrative seed plan («خطة تحصيل 2026 — توضيحية»). Applied when no ADMINISTRATOR ever chose a global default (a `system_default_set` audit event by a non-system actor): a fresh store gets it,
 * and a default set only by the SYSTEM under an earlier policy (the 2027 plan, or the remaining-2026 plan) is replaced by it — with a system audit event naming the reason and the previous plan. An administrator's explicit choice is never
 * overridden. Idempotent (a second call changes nothing). The remaining-2026 and 2027 plans stay created and selectable. Returns true when it changed the setting.
 */
export function ensureInitialGlobalDefault(db, now = nowIso()) {
  if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings)) db.settings = emptySettings();
  const seed = db.plans.find((p) => p.id === SEED_PLAN_ID && p.isSystem);
  if (!seed) return false;
  if (db.audit.some((e) => e.action === 'system_default_set' && e.actor && !e.actor.system)) return false; // an administrator chose: never overridden
  const prev = db.settings.systemDefaultPlanId || null;
  if (prev === seed.id) { db.settings.systemDefaultConfigured = true; return false; }
  db.settings.systemDefaultPlanId = seed.id; db.settings.systemDefaultConfigured = true;
  const prevPlan = prev ? db.plans.find((p) => p.id === prev) : null;
  addAudit(db, { actor: SYSTEM_ACTOR, action: 'system_default_set', planId: seed.id, at: now, summary: { ar: `تعيين «${seed.name}» خطة افتراضية عامة لكل المستخدمين (لم يختر مدير النظام خطة أخرى)`, en: `"${seed.nameEn || seed.name}" set as the global default plan for every user (no administrator chose another)` }, details: { reason: 'no_administrator_choice', previous: prevPlan ? prevPlan.id : null } });
  return true;
}

/* ---- migration schema 1 → 2 (spec §10 «Migration») ---- */
const jc = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
/** a plan record of the earlier model: it has no `content` (its figures live in versions / working) */
const isOldPlan = (p) => !!p && typeof p === 'object' && !(p.content && typeof p.content === 'object');
/**
 * Migrate ONE earlier record in place (returns the counters it changed). The content the plan keeps = the version that was IN FORCE (an active plan), else its last version (an archived plan), else the working content (a draft).
 * An earlier PENDING working copy of a plan that also has such a version is kept as an internal snapshot labelled `migrated-draft` (never dropped). Earlier versions become internal snapshots (`migrated-version`).
 * The seed becomes the system plan. createdBy / lastEditedBy / legacy / origin / timestamps / revision are untouched; what the model no longer shows (state, type, inForce, archivedAt) is kept under `migrated`.
 */
function migratePlan(p, now) {
  const versions = Array.isArray(p.versions) ? p.versions : []; const inForceV = versions.find((v) => v.n === p.inForce) || null; const lastV = versions.length ? versions[versions.length - 1] : null;
  const keep = inForceV || (p.state === 'archived' ? lastV : null); const working = p.working && p.working.content ? p.working : null;
  const counters = { promotedDraft: 0, keptWorkingAsSnapshot: 0, seedToSystem: 0 };
  let content;
  if (keep) content = jc(keep.content); else if (working) { content = jc(working.content); counters.promotedDraft = 1; } else if (lastV) content = jc(lastV.content); else return null; // nothing to keep (cannot happen in a real store)
  const snaps = versions.map((v, i) => ({ n: i + 1, revision: null, content: jc(v.content), savedBy: v.activatedBy ?? null, savedAt: v.activatedAt || p.updatedAt || now, label: 'migrated-version', migratedFrom: { versionNumber: v.n, supersededAt: v.supersededAt ?? null } }));
  if (working && keep) { snaps.push({ n: snaps.length + 1, revision: null, content: jc(working.content), savedBy: working.lastEditedBy ?? null, savedAt: working.updatedAt || p.updatedAt || now, label: 'migrated-draft' }); counters.keptWorkingAsSnapshot = 1; }
  if (counters.promotedDraft) snaps.push({ n: snaps.length + 1, revision: p.revision ?? 1, content: jc(content), savedBy: working.lastEditedBy ?? p.lastEditedBy ?? null, savedAt: working.updatedAt || p.updatedAt || now, label: 'migrated-draft-promoted' });
  const isSystem = p.origin === 'seed'; if (isSystem) counters.seedToSystem = 1;
  const migrated = { fromSchema: 1, at: now, previousState: p.state ?? null, previousType: p.type ?? 'baseline', ...(p.scenarioOf ? { scenarioOf: p.scenarioOf } : {}), inForce: p.inForce ?? null, ...(p.archivedAt ? { archivedAt: p.archivedAt } : {}) };
  for (const k of ['working', 'inForce', 'archivedAt', 'type', 'scenarioOf']) delete p[k];
  p.name = content.name; p.isSystem = isSystem; p.content = content; p.versions = snaps; p.state = 'active'; p.migrated = migrated;
  return counters;
}
/** migrate an earlier document in place (1 → 2 the simplified model, 2 → 3 the shared settings / global default); idempotent (a plan already in the new shape is left alone). Returns the audit details when anything changed, else null. */
export function migrateDb(db, now = nowIso()) {
  const from = db.schemaVersion ?? 1; let result = null;
  const old = db.plans.filter(isOldPlan);
  if (old.length || from < 2) {
    const total = { plans: 0, promotedDrafts: 0, workingKeptAsSnapshot: 0, seedMarkedSystem: 0 };
    for (const p of old) { const c = migratePlan(p, now); if (!c) continue; total.plans += 1; total.promotedDrafts += c.promotedDraft; total.workingKeptAsSnapshot += c.keptWorkingAsSnapshot; total.seedMarkedSystem += c.seedToSystem; }
    if (!db.userDefaults || typeof db.userDefaults !== 'object' || Array.isArray(db.userDefaults)) db.userDefaults = {};
    db.schemaVersion = 2; // an empty / already-new store is only stamped
    if (total.plans) {
      addAudit(db, { actor: SYSTEM_ACTOR, action: 'migrate', at: now, summary: { ar: `ترحيل مخزن الخطط إلى النموذج المبسّط (${total.plans} خطة): لا تُحذف أي قيمة`, en: `The plans store was migrated to the simplified model (${total.plans} plans); no value was dropped` }, details: { fromSchema: from, toSchema: 2, ...total } });
      result = total;
    }
  }
  if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings) || (db.schemaVersion ?? 2) < 3) {
    const had = db.settings && typeof db.settings === 'object' && !Array.isArray(db.settings) ? db.settings : {};
    db.settings = { systemDefaultPlanId: typeof had.systemDefaultPlanId === 'string' ? had.systemDefaultPlanId : null, systemDefaultConfigured: had.systemDefaultConfigured === true };
    if (db.plans.length && from >= 2) {
      addAudit(db, { actor: SYSTEM_ACTOR, action: 'migrate', at: now, summary: { ar: `ترحيل مخزن الخطط إلى المخطط 3: إضافة إعدادات النظام (الخطة الافتراضية العامة)؛ لم تُحذف أي خطة ولا أي خطة افتراضية شخصية ولا أي خطة مرجعية`, en: 'The plans store was migrated to schema 3: shared settings added (the global default plan); no plan, personal default or reference was dropped' }, details: { fromSchema: from, toSchema: SCHEMA_VERSION, plans: db.plans.length, personalDefaults: Object.keys(db.userDefaults || {}).length, references: Object.keys(db.references || {}).length } });
      result = result || { plans: 0 };
    }
  }
  db.schemaVersion = SCHEMA_VERSION;
  return result;
}

/** make a loaded document structurally sound (idempotent); returns true when something changed. Runs the schema migration. */
function normalizeDb(db, file = null) {
  let changed = false;
  if (!Array.isArray(db.plans)) { db.plans = []; changed = true; }
  if (!Array.isArray(db.audit)) { db.audit = []; changed = true; }
  if (!db.references || typeof db.references !== 'object' || Array.isArray(db.references)) { db.references = {}; changed = true; }
  const backupOnce = (suffix) => { if (!file) return; try { const bak = `${file}${suffix}`; if (!fs.existsSync(bak) && fs.existsSync(file)) fs.copyFileSync(file, bak); } catch { /* best effort: the migration never fails because a backup could not be written */ } };
  if (db.plans.some(isOldPlan)) backupOnce('.pre-v2.bak');
  else if (db.plans.length && (db.schemaVersion ?? 1) < SCHEMA_VERSION) backupOnce('.pre-v3.bak'); // a schema-2 store is copied once before the shared settings are added (and the 2027 plan is seeded)
  const sv = db.schemaVersion;
  if (migrateDb(db) || sv !== db.schemaVersion) changed = true;
  if (db.schemaVersion !== SCHEMA_VERSION) { db.schemaVersion = SCHEMA_VERSION; changed = true; }
  if (!db.settings || typeof db.settings !== 'object' || Array.isArray(db.settings)) { db.settings = emptySettings(); changed = true; }
  if (!db.userDefaults || typeof db.userDefaults !== 'object' || Array.isArray(db.userDefaults)) { db.userDefaults = {}; changed = true; }
  return changed;
}

/** the system plans every store holds: the 2026 illustrative seed (an EMPTY store only) and the 2027 collection plan (once, by seedKey). Returns true when anything was added. */
export function seedSystemPlans(db, now = nowIso()) {
  const a = seedIfEmpty(db, now); const b = ensureCollectionPlan2027(db, now); const c = ensureInitialGlobalDefault(db, now);
  return a || b.created || c;
}

/**
 * Open a store instance on `requested` (a path, ':memory:' or null → IIM_PLANS_FILE / the default). Each call re-reads the file, so a second instance on the same path is a faithful "restart".
 * The instance: { file, mode, durable, db (live document — read only), mutate(fn), info(), reload(), checkpoint(name), fault }.
 */
export function openPlanStore(requested = null, { seed = true } = {}) {
  const loc = chooseLocation(requested);
  const store = {
    file: loc.file, mode: loc.mode, db: readFile(loc.file) || emptyDb(),
    /** tests: a function called at named checkpoints inside a mutation (and with 'commit' right before the swap); a throw aborts the whole mutation */
    fault: null,
    checkpoint(name) { if (typeof this.fault === 'function') this.fault(name); },
    info() { return { mode: this.mode, durable: this.mode === 'file', localDemo: true }; },
    /** write the document (atomic). A write failure downgrades to memory instead of failing the request. */
    persist() { if (!this.file) return; try { writeAtomic(this.file, this.db); } catch { this.mode = 'memory'; this.file = null; } },
    /** all-or-nothing change: fn(workingCopy) → result. Throw to abort; nothing is stored then. */
    mutate(fn) {
      const work = structuredClone(this.db);
      const result = fn(work);
      this.checkpoint('commit');
      this.db = work; this.persist();
      return result;
    },
    /** drop the in-memory document and re-read the file (a restart in place) */
    reload() { this.db = readFile(this.file) || emptyDb(); const a = normalizeDb(this.db, this.file); const b = seed ? seedSystemPlans(this.db) : false; if (a || b) this.persist(); return this.db; }
  };
  const changed = normalizeDb(store.db, store.file); const seeded = seed ? seedSystemPlans(store.db) : false;
  if ((changed || seeded) && store.file) store.persist();
  return store;
}

/* ---- the process-wide instance (what the HTTP layer uses) ---- */
let current = null;
/** the live store; opened (and seeded when empty) on first use */
export const planStore = () => (current || (current = openPlanStore(null)));
/** tests: point the process-wide store at a fresh temp file or ':memory:'; returns the instance */
export function resetPlanStore(file = ':memory:', opts) { current = openPlanStore(file || ':memory:', opts); return current; }
/** tests: replace the process-wide store with an instance opened elsewhere */
export function useStore(store) { current = store; return current; }
