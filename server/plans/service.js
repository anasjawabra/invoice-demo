// Revenue-plans SERVICE — every rule of docs/revenue-plans-spec.md §10 (the simplified workflow) that touches stored state, over the store (server/plans/store.js) and the pure rules (src/data/plans/*).
// The HTTP layer (server/plansApi.js) authenticates, derives the ACTOR and calls these functions; they throw PlanError(status, code, extra) — never an exception message. Nothing here knows about passwords or tokens.
//   actor = { userId, name, nameEn?, geoScope (the actor's GeoScope for the planning module), readOnly }
// A plan is a NAMED, SAVED configuration: { id, name, isSystem, origin, content, createdBy, createdAt, updatedAt, lastEditedBy, revision, versions[internal per-save snapshots], legacy, state:'active' (internal constant) }.
// There is no draft / activation / archive. Reads are MASKED for the viewer (planRules.maskPlanForViewer). Every write: viewable (404) → may-mutate scope check (403) → revision check (409) → hard validation (400) →
// name (400 / 409 name_taken) → save checks (422) → ONE atomic store mutation (snapshot + content + audit + revision+1). The owner (`createdBy`) is the authenticated creator's STABLE user id, immutable; an edit changes lastEditedBy / updatedAt only.
import { defaultPlanResolution, normalizeContent, planView, saveChecks, validateDraft, validatePlanName, maskPlanForViewer, municipalRowsOf } from '../../src/data/plans/planRules.js';
import { canSetReference, canViewScope, canViewMunicipality, entityUniverse, municipalCoverage, mutateDecision, scopeEntityKeys, visibleEntityKeysOfScope } from '../../src/data/plans/planAccess.js';
import { municipalitiesOf, municipalityByKey, municipalityByRef } from '../../src/data/amanahHierarchy.js';
import { GEO_HIERARCHY, normalizeGeoScope } from '../../src/data/geoScope.js';
import { eligibleReferencePlans } from '../../src/data/plans/referenceRules.js';
import { fiscalYearPeriod, periodsOverlap } from '../../src/data/plans/planMath.js';
import { legacyRecord, legacyStoreToContent } from '../../src/data/plans/planDefaults.js';
import { APPROPRIATION_YEAR } from '../../src/data/appropriations.js';
import { addAudit, newPlanId, nowIso, planStore } from './store.js';

export class PlanError extends Error {
  constructor(status, code, extra = {}) { super(code); this.name = 'PlanError'; this.status = status; this.code = code; this.extra = extra; }
}
const T = (ar, en) => ({ ar, en });
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const verr = (code, path, ar, en, params) => ({ code, path, params: params || {}, ar, en });
const invalid = (errors) => new PlanError(400, 'validation_error', { errors });
const notFound = () => new PlanError(404, 'plan_not_found');
const MAX_LEGACY_BYTES = 600000;

/* ------------------------------------------------------------------ actor / access */
const refOf = (actor) => ({ userId: actor.userId, name: actor.name, ...(actor.nameEn ? { nameEn: actor.nameEn } : {}) });
const refusal = (reason) => new PlanError(403, 'forbidden', { reason });
/**
 * the municipal rows of a content the GRANTS can be checked against: well-formed rows naming a known municipality that belongs to the named Amanah. Anything else (unknown id, another Amanah's municipality, a malformed row) is a
 * VALIDATION problem (400, validateDraft) and is never inferred from names. A well-formed row outside the actor's grants is a 403 `municipality` (spec §9).
 */
function checkableMunicipalRows(content) {
  const rows = [];
  for (const m of municipalRowsOf(content)) {
    if (!isObj(m) || typeof m.entityKey !== 'string' || typeof m.muniId !== 'string') continue;
    const entityKey = m.entityKey.trim(); const muniId = m.muniId.trim();
    if (municipalityByRef(muniId) && municipalitiesOf(entityKey).some((x) => x.refId === muniId)) rows.push({ entityKey, muniId });
  }
  return rows;
}
/** the decision for one content: null when allowed; 'unknown_scope' is left to validation (a 400), the others are 403s ('municipality' = a named municipality outside the actor's grants). `content` may be just a scope-only holder. */
function scopeRefusal(actor, scope, content = null) {
  const d = mutateDecision(actor.geoScope, scope, { readOnly: actor.readOnly, municipalities: content ? checkableMunicipalRows(content) : null });
  return d.ok || d.reason === 'unknown_scope' ? null : d.reason;
}
/** does the actor's SCOPE let them change this plan (its saved content: scope + every named municipality)? Read-only roles never. The system plan is a separate rule (never editable by anyone). */
function mayMutate(actor, plan) {
  const c = plan.content;
  return !!c && mutateDecision(actor.geoScope, c.scope, { readOnly: actor.readOnly, municipalities: checkableMunicipalRows(c) }).ok;
}
const canEditPlan = (actor, plan) => !plan.isSystem && mayMutate(actor, plan);
/** why the actor cannot edit (null when they can) — for a UI that disables the control with the reason */
function editBlock(actor, plan) {
  if (plan.isSystem) return 'system_plan';
  if (actor.readOnly) return 'read_only_role';
  return mayMutate(actor, plan) ? null : 'scope';
}
function assertCanEdit(actor, plan) {
  const r = scopeRefusal(actor, plan.content.scope, plan.content); if (r) throw refusal(r);
  if (actor.readOnly) throw refusal('read_only_role');
}
/** a plan the actor may open: it touches an entity they see, or they may change it. Every saved plan is shared within the viewer's scope (there are no private drafts). */
function viewable(actor, plan) {
  return !!plan.content && (mayMutate(actor, plan) || canViewScope(actor.geoScope, plan.content.scope));
}
/** the viewer's masked copy of the FULL record (snapshots included) */
const maskedFull = (actor, plan) => maskPlanForViewer(clone(plan), visibleEntityKeysOfScope(actor.geoScope), actor.geoScope); // the geoScope is ALWAYS passed: a municipal-only viewer never receives the Amanah's amount (spec §9)
/** the viewer's copy of a plan record: masked for a restricted viewer; snapshots as METADATA only (n, revision, savedBy, savedAt, label — the content is read through GET /plans/:id/versions/:n); `viewer.canEdit` + `viewer.reason` */
function present(actor, plan) {
  const out = maskedFull(actor, plan);
  out.versions = (out.versions || []).map(({ content, migratedFrom, ...meta }) => meta);
  out.versionCount = out.versions.length;
  delete out.migrated;
  const reason = editBlock(actor, plan);
  out.viewer = { canEdit: reason === null, ...(reason ? { reason } : {}) };
  return out;
}
const findPlan = (db, id) => db.plans.find((p) => p.id === id) || null;
function load(actor, db, id) {
  const p = typeof id === 'string' ? findPlan(db, id) : null;
  if (!p || !viewable(actor, p)) throw notFound();
  return p;
}
function checkRevision(plan, body) {
  const rev = body?.revision;
  if (!Number.isInteger(rev)) throw invalid([verr('revision_required', 'revision', 'رقم المراجعة مطلوب', 'The revision number is required')]);
  if (rev !== plan.revision) throw new PlanError(409, 'revision_conflict', { currentRevision: plan.revision, lastEditedBy: plan.lastEditedBy || null, updatedAt: plan.updatedAt });
}
const touch = (plan, actor, now) => { plan.lastEditedBy = refOf(actor); plan.updatedAt = now; plan.revision += 1; };
/** the names of the plans the actor can see (optionally without one plan) — the scope of the name-uniqueness rule */
const visibleNames = (actor, db, exceptId = null) => db.plans.filter((p) => p.id !== exceptId && viewable(actor, p)).flatMap((p) => (p.nameEn ? [p.name, p.nameEn] : [p.name])); // a system plan also holds its English name
/**
 * the defaults the caller sees (computed over the plans THEY can see, so a plan outside their scope is never revealed or opened):
 *   userDefaultPlanId (their own explicit choice, only while it still exists and is visible) · globalDefaultPlanId (the shared setting an administrator controls, if visible) · systemDefaultPlanId (= global, kept for compatibility)
 *   · effectiveDefaultPlanId (personal → global → first visible system plan → first visible by name) · source 'personal' | 'global' | 'fallback' | 'none'.
 * Seeing or opening the default never changes a permission.
 */
function defaultsOf(actor, db) {
  const vis = db.plans.filter((p) => viewable(actor, p));
  const r = defaultPlanResolution({ plans: vis, userDefaultPlanId: db.userDefaults?.[actor.userId] || null, globalDefaultPlanId: db.settings?.systemDefaultPlanId || null, visibleIds: vis.map((p) => p.id) });
  return { userDefaultPlanId: r.userDefaultPlanId, globalDefaultPlanId: r.globalDefaultPlanId, systemDefaultPlanId: r.systemDefaultPlanId, effectiveDefaultPlanId: r.effectiveDefaultPlanId, source: r.source };
}
const storageOf = (store) => store.info();

/* ------------------------------------------------------------------ view scope (spec §9) */
const strOrNull = (x) => (typeof x === 'string' && x.trim() && x.trim() !== 'all' ? x.trim() : null);
/**
 * The VIEW scope a read names: { amanah: 'all'|entityKey, muni: 'all'|MREF-id } from `amanah` (alias `entity`) and `muni` — a municipal id or the data service's '<Amanah>|<MREF-…>' key. It is a FILTER: it never writes a plan.
 *   400 validation_error — a municipality without an Amanah, an unknown Amanah, an unknown municipality id, a municipality that does not belong to the Amanah (never inferred from names).
 *   403 forbidden{reason:'municipality'} — a well-formed municipality outside the actor's grants.
 * Returns null when the request names neither (so ordinary reads are unchanged); otherwise the validated view scope.
 */
export function resolveViewScope(actor, q) {
  const raw = isObj(q) ? q : {}; const amanahIn = strOrNull(raw.amanah) ?? strOrNull(raw.entity); const muniIn = strOrNull(raw.muni);
  if (!amanahIn && !muniIn) return null;
  let amanah = amanahIn; let muniId = null;
  if (muniIn) {
    const byKey = muniIn.includes('|') ? municipalityByKey(muniIn) : null; const byRef = byKey ? null : municipalityByRef(muniIn);
    const m = byKey || byRef;
    if (!m) throw invalid([verr('unknown_municipality', 'muni', 'بلدية غير معروفة', 'Unknown municipality', { muni: muniIn })]);
    if (amanah == null && byKey) amanah = byKey.amanahKey; // the data service's '<Amanah>|<MREF>' key carries its Amanah
    if (amanah == null) throw invalid([verr('municipality_without_amanah', 'muni', 'اختر الأمانة قبل البلدية', 'Choose the Amanah before the municipality')]);
    if (!entityUniverse().includes(amanah)) throw invalid([verr('unknown_entity', 'amanah', 'جهة غير معروفة', 'Unknown entity', { entityKey: amanah })]);
    if (m.amanahKey !== amanah) throw invalid([verr('municipality_not_in_entity', 'muni', 'البلدية لا تتبع هذه الأمانة', 'The municipality does not belong to this Amanah', { entityKey: amanah, muniId: m.refId })]);
    muniId = m.refId;
    if (!canViewMunicipality(actor.geoScope, amanah, muniId)) throw refusal('municipality');
  }
  return { amanah: amanah || 'all', muni: muniId || 'all' };
}

/* ------------------------------------------------------------------ reads */
/**
 * { plans:[viewer's copies], defaults:{ userDefaultPlanId, systemDefaultPlanId, effectiveDefaultPlanId }, references, capabilities, storage, viewScope? }
 * filters: year (the calendar year overlaps the plan's period), owner (a user id | 'none'), entity (an entity key in the scope; alias `amanah`), muni (a municipality of that entity: the plan must name the entity; viewer-scope guarded).
 * `defaults` are computed over EVERY plan the viewer can see (a filter never changes them).
 */
export function listPlans(actor, filters = {}, store = planStore()) {
  const f = isObj(filters) ? filters : {}; const yr = Number(f.year); const out = [];
  const vs = resolveViewScope(actor, f); const entity = vs && vs.amanah !== 'all' ? vs.amanah : strOrNull(f.entity);
  for (const p of store.db.plans) {
    if (!viewable(actor, p)) continue;
    if (f.owner) { if (f.owner === 'none' ? p.createdBy != null : p.createdBy?.userId !== f.owner) continue; }
    const c = p.content;
    if (Number.isInteger(yr) && yr > 0 && !(c && periodsOverlap(c.period, fiscalYearPeriod(yr)))) continue;
    if (entity && !(c && scopeEntityKeys(c.scope).includes(entity))) continue;
    out.push(present(actor, p));
  }
  return { plans: out, defaults: defaultsOf(actor, store.db), references: clone(store.db.references), capabilities: capabilitiesOf(actor), storage: storageOf(store), ...(vs ? { viewScope: vs } : {}) };
}
/**
 * what the actor may do and see. `municipalCoverage` (RESTRICTED actors only; absent for an all-entities actor) = how their grants cover each Amanah they see: { [entityKey]: { whole, all, direct, notSpecified, muniIds } } — their OWN access,
 * never plan figures; `muniIds` is omitted when `all` (every municipality). A UI hides the municipality field for an Amanah with no municipalities. `canCreate` = may save a NEW plan at all (false for a read-only role).
 */
export const capabilitiesOf = (actor) => {
  const mayAdmin = canSetReference(actor.geoScope, { readOnly: actor.readOnly });
  const caps = { canSetReference: mayAdmin, canSetSystemDefault: mayAdmin, readOnly: !!actor.readOnly, canCreate: !actor.readOnly, canCreateMinistry: mutateDecision(actor.geoScope, { kind: 'ministry' }, { readOnly: actor.readOnly }).ok };
  const geo = normalizeGeoScope(actor.geoScope);
  if (!geo.all) {
    const cov = {};
    for (const k of visibleEntityKeysOfScope(geo)) {
      if (!GEO_HIERARCHY.has(k)) continue;
      const c = municipalCoverage(geo, k); cov[k] = { whole: c.whole, all: c.all, direct: c.direct, notSpecified: c.notSpecified, ...(c.all ? {} : { muniIds: c.muniIds }) };
    }
    caps.municipalCoverage = cov;
  }
  return caps;
};
export function getPlan(actor, id, store = planStore(), view = null) {
  const vs = resolveViewScope(actor, view); const p = load(actor, store.db, id);
  return { plan: present(actor, p), storage: storageOf(store), ...(vs ? { viewScope: vs } : {}) };
}
/** one internal snapshot (technical, read-only), masked exactly like the plan */
export function getVersion(actor, id, n, store = planStore(), view = null) {
  const vs = resolveViewScope(actor, view); const p = load(actor, store.db, id); const num = Number(n);
  const shown = maskedFull(actor, p); const v = (shown.versions || []).find((x) => x.n === num);
  if (!Number.isInteger(num) || !v || !v.content) throw new PlanError(404, 'version_not_found');
  const { migratedFrom, ...meta } = v;
  return { planId: p.id, version: { ...meta, isCurrent: v.revision != null && v.revision === p.revision }, view: planView(shown, num), ...(vs ? { viewScope: vs } : {}) };
}
/** newest first. Audit summaries and details name plans and actors, never amounts; a viewer's entries are the same for everyone who may open the plan. */
export function getAudit(actor, id, store = planStore()) {
  const p = load(actor, store.db, id);
  const entries = store.db.audit.filter((e) => e.planId === p.id).map(clone).reverse();
  return { planId: p.id, total: entries.length, entries };
}
export function getReferences(actor, store = planStore()) { return { references: clone(store.db.references), defaults: defaultsOf(actor, store.db), capabilities: capabilitiesOf(actor), storage: storageOf(store) }; }

/* ------------------------------------------------------------------ create / update (one atomic save) */
/**
 * The shared save pipeline: raw content + name → { content (normalized, named) } or a thrown PlanError.
 *   hard validation (validateDraft on the RAW content) + the name rule → 400 `validation_error{errors}`; the name already used by a plan the actor sees → 409 `name_taken{errors}`; the save checks → 422 `save_checks_failed{checks}`.
 */
function prepareSave(actor, db, raw, nameIn, exceptId) {
  const named = { ...raw, name: typeof nameIn === 'string' ? nameIn.trim() : nameIn };
  const v = validateDraft(named, { actorScope: actor.geoScope, readOnly: actor.readOnly });
  const nm = validatePlanName(nameIn, visibleNames(actor, db, exceptId));
  const taken = nm.errors.filter((e) => e.code === 'name_taken'); const nameBad = nm.errors.filter((e) => e.code !== 'name_taken');
  const errors = [...nameBad, ...v.errors];
  if (errors.length) throw invalid(errors);
  if (taken.length) throw new PlanError(409, 'name_taken', { errors: taken });
  const content = normalizeContent({ ...named, name: nm.name });
  const res = saveChecks(content, { actorScope: actor.geoScope, readOnly: actor.readOnly });
  if (!res.ok) throw new PlanError(422, 'save_checks_failed', { checks: res.checks });
  return { content, checks: res.checks };
}
const snapshotOf = (db, plan, content, actor, now, revision, label = null) => ({ n: (plan.versions || []).reduce((m, x) => Math.max(m, x.n || 0), 0) + 1, revision, content: clone(content), savedBy: actor ? refOf(actor) : null, savedAt: now, ...(label ? { label } : {}) });

/**
 * POST /plans {name, content, setDefault?, copyOf?} — a NEW saved plan owned by the authenticated actor (also «حفظ كخطة جديدة»). `copyOf` names the plan it was saved from (provenance in the audit; with no `content` the copy is taken from it —
 * refused 403 when the actor sees it only masked). `setDefault` makes it the caller's personal default in the same atomic step.
 */
export function createPlan(actor, input, store = planStore()) {
  const b = isObj(input) ? input : {};
  if (b.copyOf != null && typeof b.copyOf !== 'string') throw invalid([verr('copy_of_invalid', 'copyOf', 'معرّف الخطة المنسوخة غير صالح', 'The copied plan id is not valid')]);
  return store.mutate((db) => {
    const src = b.copyOf != null ? load(actor, db, b.copyOf) : null;
    let raw = isObj(b.content) ? b.content : null;
    if (!raw && src) { if (maskedFull(actor, src).masked) throw refusal('scope'); raw = clone(src.content); } // a plan the actor cannot see whole is not copyable
    if (!raw) throw invalid([verr('content_required', 'content', 'محتوى الخطة مطلوب', 'The plan content is required')]);
    if (actor.readOnly) throw refusal('read_only_role');
    const sr = isObj(raw.scope) ? scopeRefusal(actor, raw.scope, raw) : null; if (sr) throw refusal(sr);
    const { content } = prepareSave(actor, db, raw, b.name != null ? b.name : raw.name, null);
    const now = nowIso();
    const plan = { id: newPlanId(db), name: content.name, isSystem: false, origin: 'user', content, createdBy: refOf(actor), createdAt: now, updatedAt: now, lastEditedBy: refOf(actor), revision: 1, versions: [], legacy: null, state: 'active' };
    plan.versions.push(snapshotOf(db, plan, content, actor, now, 1));
    db.plans.push(plan);
    store.checkpoint('create.insert');
    if (b.setDefault === true) { db.userDefaults = { ...(db.userDefaults || {}), [actor.userId]: plan.id }; }
    addAudit(db, { actor: refOf(actor), action: src ? 'copy' : 'create', planId: plan.id, at: now, summary: T(`${src ? 'حفظ نسخة جديدة من خطة' : 'إنشاء الخطة'} «${content.name}»`, `Plan "${content.name}" ${src ? 'saved as a new plan' : 'created'}`), details: { ...(src ? { copyOf: src.id } : {}), ...(b.setDefault === true ? { setDefault: true } : {}) } });
    return { plan: present(actor, plan), defaults: defaultsOf(actor, db) };
  });
}

/**
 * PUT /plans/:id {revision, content, name?} — saves THAT plan: validate → snapshot → write → audit → revision+1 in ONE atomic mutation (a failure leaves the stored plan unchanged). The owner never changes; `lastEditedBy` does.
 * 403 system_plan_readonly (the system plan is never overwritten) · 403 forbidden{reason} (read-only role / the OLD or the NEW scope or a named municipality outside the actor's authority) · 409 revision_conflict · 400 / 409 name_taken / 422 as in createPlan.
 */
export function updatePlan(actor, id, input, store = planStore()) {
  const b = isObj(input) ? input : {};
  return store.mutate((db) => {
    const plan = load(actor, db, id);
    if (actor.readOnly) throw refusal('read_only_role');
    if (plan.isSystem) throw new PlanError(403, 'system_plan_readonly');
    assertCanEdit(actor, plan);
    checkRevision(plan, b);
    const raw = isObj(b.content) ? b.content : (b.name != null ? clone(plan.content) : null);
    if (!raw) throw invalid([verr('content_required', 'content', 'محتوى الخطة مطلوب', 'The plan content is required')]);
    const widened = isObj(raw.scope) ? scopeRefusal(actor, raw.scope, raw) : null; // the NEW scope (and every municipality it names) must be covered too: 403, not a validation message
    if (widened) throw refusal(widened);
    const { content } = prepareSave(actor, db, raw, b.name != null ? b.name : raw.name, plan.id);
    const now = nowIso(); const next = plan.revision + 1;
    plan.versions = plan.versions || [];
    plan.versions.push(snapshotOf(db, plan, content, actor, now, next));
    store.checkpoint('save.snapshot');
    plan.content = content; plan.name = content.name;
    store.checkpoint('save.content');
    touch(plan, actor, now);
    store.checkpoint('save.state');
    addAudit(db, { actor: refOf(actor), action: 'update', planId: plan.id, at: now, summary: T(`حفظ الخطة «${content.name}»`, `Plan "${content.name}" saved`), details: { revision: plan.revision } });
    return { plan: present(actor, plan) };
  });
}

/* ------------------------------------------------------------------ personal default */
/** PUT /plans/default {planId|null} — the CALLER's own default plan (it must be one they can see; null clears it). Never affects other users or the organisation reference. */
export function setPersonalDefault(actor, input, store = planStore()) {
  const b = isObj(input) ? input : {};
  if (!('planId' in b) || (b.planId !== null && typeof b.planId !== 'string')) throw invalid([verr('plan_required', 'planId', 'معرّف الخطة مطلوب (أو null للمسح)', 'A plan id is required (or null to clear)')]);
  return store.mutate((db) => {
    const map = { ...(db.userDefaults || {}) };
    if (b.planId === null) delete map[actor.userId];
    else { load(actor, db, b.planId); map[actor.userId] = b.planId; }
    db.userDefaults = map;
    return { defaults: defaultsOf(actor, db) };
  });
}

/**
 * PUT /plans/system-default {planId} — changes the GLOBAL default plan every user opens (unless they chose a personal default). Same authority as setting a reference plan: all-entities access AND a non-read-only role
 * (403 `read_only_role` / `forbidden{reason:'scope'}` otherwise); the plan must be one the actor can see (404). Audited; idempotent. It grants nobody any permission and never touches personal defaults or references.
 */
export function setSystemDefault(actor, input, store = planStore()) {
  const b = isObj(input) ? input : {};
  if (typeof b.planId !== 'string' || !b.planId) throw invalid([verr('plan_required', 'planId', 'معرّف الخطة مطلوب', 'A plan id is required')]);
  if (!canSetReference(actor.geoScope, { readOnly: actor.readOnly })) throw refusal(actor.readOnly ? 'read_only_role' : 'scope');
  return store.mutate((db) => {
    const plan = load(actor, db, b.planId); const now = nowIso();
    const prev = db.settings?.systemDefaultPlanId || null;
    db.settings = { ...(db.settings || {}), systemDefaultPlanId: plan.id, systemDefaultConfigured: true };
    addAudit(db, { actor: refOf(actor), action: 'system_default_set', planId: plan.id, at: now, summary: T(`تعيين «${plan.name}» خطة افتراضية عامة لكل المستخدمين`, `"${plan.nameEn || plan.name}" set as the global default plan for every user`), details: { ...(prev ? { previous: prev } : {}), unchanged: prev === plan.id } });
    return { defaults: defaultsOf(actor, db) };
  });
}

/** GET /plans/system-default → { defaults, canSetSystemDefault } (the global default plan as THIS caller sees it) */
export const getSystemDefault = (actor, store = planStore()) => ({ defaults: defaultsOf(actor, store.db), canSetSystemDefault: canSetReference(actor.geoScope, { readOnly: actor.readOnly }) });

/* ------------------------------------------------------------------ references */
/** POST /plans/references {year, planId|null} */
export function setReference(actor, input, store = planStore()) {
  const b = isObj(input) ? input : {}; const year = b.year;
  if (!Number.isInteger(year) || year < 1990 || year > 2200) throw invalid([verr('year_invalid', 'year', 'السنة غير صالحة', 'The year is not valid')]);
  if (b.planId !== null && typeof b.planId !== 'string') throw invalid([verr('plan_required', 'planId', 'معرّف الخطة مطلوب (أو null للمسح)', 'A plan id is required (or null to clear)')]);
  if (!canSetReference(actor.geoScope, { readOnly: actor.readOnly })) throw refusal(actor.readOnly ? 'read_only_role' : 'scope');
  return store.mutate((db) => {
    const now = nowIso(); const key = String(year); const prev = db.references[key] || null;
    if (b.planId === null) {
      if (prev) delete db.references[key];
      addAudit(db, { actor: refOf(actor), action: 'reference_clear', ...(prev ? { planId: prev.planId } : {}), at: now, summary: T(`مسح الخطة المرجعية لسنة ${year}`, `The ${year} reference plan was cleared`), details: { year, ...(prev ? { previous: prev.planId } : {}) } });
      return { references: clone(db.references), cleared: !!prev };
    }
    const plan = findPlan(db, b.planId);
    if (!plan) throw notFound();
    if (!eligibleReferencePlans(year, [plan]).length) throw invalid([verr('reference_not_eligible', 'planId', 'الخطة المرجعية يجب أن تتقاطع فترتها مع السنة', 'The reference plan must overlap the year', { reason: 'period_mismatch' })]);
    db.references[key] = { planId: plan.id, setBy: refOf(actor), at: now };
    addAudit(db, { actor: refOf(actor), action: 'reference_set', planId: plan.id, at: now, summary: T(`تعيين «${plan.name}» خطة مرجعية لسنة ${year}`, `"${plan.name}" set as the ${year} reference plan`), details: { year, ...(prev ? { previous: prev.planId } : {}) } });
    return { references: clone(db.references), cleared: false };
  });
}

/* ------------------------------------------------------------------ legacy import */
const uniqueName = (base, names) => { const taken = new Set(names.map((n) => String(n).trim().toLowerCase())); let name = base; for (let i = 2; taken.has(name.trim().toLowerCase()); i += 1) name = `${base} (${i})`; return name; };
/** POST /plans/import-legacy {year, store} — the browser's legacy device record as a normal saved plan, OWNERLESS (original metadata verbatim in `legacy`). A second import of the same legacy version is refused. The save checks apply. */
export function importLegacy(actor, input, store = planStore()) {
  const b = isObj(input) ? input : {}; const year = b.year == null ? APPROPRIATION_YEAR : b.year;
  if (!Number.isInteger(year) || year < 1990 || year > 2200) throw invalid([verr('year_invalid', 'year', 'السنة غير صالحة', 'The year is not valid')]);
  if (!isObj(b.store)) throw invalid([verr('store_required', 'store', 'سجل الجهاز القديم مطلوب', 'The legacy device record is required')]);
  let size = 0; try { size = JSON.stringify(b.store).length; } catch { size = Infinity; }
  if (size > MAX_LEGACY_BYTES) throw invalid([verr('store_too_large', 'store', 'سجل الجهاز كبير جدًا', 'The device record is too large')]);
  if (actor.readOnly) throw refusal('read_only_role');
  const sr = scopeRefusal(actor, { kind: 'ministry' }); if (sr) throw refusal(sr); // the imported plan is Ministry-scope
  return store.mutate((db) => {
    const rec = legacyRecord(b.store, year);
    const dup = db.plans.find((p) => p.legacy && p.legacy.versionId === rec.versionId && p.legacy.savedAt === rec.savedAt && p.legacy.year === rec.year);
    if (dup) throw new PlanError(409, 'legacy_already_imported', { plan: { planId: dup.id, name: dup.name } });
    const raw = legacyStoreToContent(b.store, year);
    const mr = scopeRefusal(actor, raw.scope, raw); if (mr) throw refusal(mr);
    raw.name = uniqueName(raw.name, visibleNames(actor, db));
    const { content } = prepareSave(actor, db, raw, raw.name, null);
    const now = nowIso();
    const plan = { id: newPlanId(db), name: content.name, isSystem: false, origin: 'imported', content, createdBy: null, createdAt: now, updatedAt: now, lastEditedBy: refOf(actor), revision: 1, versions: [], legacy: clone(rec), state: 'active' };
    plan.versions.push(snapshotOf(db, plan, content, actor, now, 1, 'import'));
    db.plans.push(plan);
    addAudit(db, { actor: refOf(actor), action: 'import', planId: plan.id, at: now, summary: T(`استيراد سجل الجهاز القديم لسنة ${year} كخطة «${content.name}»`, `Legacy device record for ${year} imported as the plan "${content.name}"`), details: { year, legacyVersionId: rec.versionId, legacySavedAt: rec.savedAt } });
    return { plan: present(actor, plan) };
  });
}
