// PLAN STORE (client cache) — the synchronous read side of the SERVER-OWNED revenue plans (docs/revenue-plans-spec.md §1, §3). The plans live on the data service (server/plans/); this module holds the signed-in
// person's current copy (plan records MASKED by the server for a restricted viewer) so consumers that render synchronously — the Decision Room, the dashboard target, Smart Reports, the assistant, fixed reports — can read
// the reference plan without an await. Plain module (no React, no window, no fetch of its own): safe in Node tests; the HTTP client is injected (`hydratePlans(client)` with src/api/plansClient.js's `plansApi`).
//   hydratePlans(client, { key?, force? })  load (after sign-in and on an access-version change)      refreshPlans()  reload with the last client
//   getPlans() · getReferences() · getDefaults() · effectiveDefaultPlanId()                           clearPlans()  on sign-out / epoch change
//   getSnapshot() / subscribe(fn) (useSyncExternalStore-friendly)                                     upsertPlanLocally(plan) · setDefaultsLocally(defaults)  apply a server answer without a refetch
//   referenceFor(year)       resolveReferencePlan over the cache                                       referenceViewFor(year)  the in-force planView of the resolved reference, or a state object
//   setPlansForTest({ plans, references, defaults })
import { resolveReferencePlan } from './referenceRules.js';
import { defaultPlanResolution } from './planRules.js';

const emptyDefaults = () => ({ userDefaultPlanId: null, globalDefaultPlanId: null, systemDefaultPlanId: null, effectiveDefaultPlanId: null, source: 'none' });
const emptyState = () => ({ status: 'idle', plans: [], references: {}, defaults: emptyDefaults(), capabilities: null, storage: null, error: null, loadedAt: null, version: 0 });
let state = emptyState();
let snapshot = null;
let key = null;          // what the last successful load was for (token tail + access version): the same key is not re-fetched
let gen = 0;             // generation: an answer that arrives after clear / a newer load is dropped
let lastClient = null;
let inflight = null;
const listeners = new Set();
const memo = new Map();  // year → resolved reference, valid for one state.version

const freeze = () => { snapshot = Object.freeze({ ...state }); };
freeze();
function emit() { memo.clear(); state = { ...state, version: state.version + 1 }; freeze(); for (const l of [...listeners]) { try { l(snapshot); } catch { /* a listener must never break the cache */ } } }

/** stable between changes (referentially) — { status:'idle'|'loading'|'ready'|'forbidden'|'error', plans, references, defaults, capabilities, storage, error, loadedAt, version } */
export const getSnapshot = () => snapshot;
export function subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export const getPlans = () => state.plans;
export const getReferences = () => state.references;
export const getPlanById = (id) => state.plans.find((p) => p.id === id) || null;
/** { userDefaultPlanId, globalDefaultPlanId (= systemDefaultPlanId), effectiveDefaultPlanId, source:'personal'|'global'|'fallback'|'none' } as the server last reported them (the caller's EXPLICIT personal default, the GLOBAL default plan, what opens by default) */
export const getDefaults = () => state.defaults;
/**
 * the plan that opens by default: the server's `effectiveDefaultPlanId` when that plan is in the cache, else the same rule over the cached plans (personal default if present → the GLOBAL default → first system plan → first by name); null when there are no plans.
 * Nothing browser-local takes part: no last-viewed plan, no localStorage / sessionStorage preference.
 */
export function effectiveDefaultPlanId() {
  const d = state.defaults || emptyDefaults();
  if (d.effectiveDefaultPlanId && state.plans.some((p) => p.id === d.effectiveDefaultPlanId)) return d.effectiveDefaultPlanId;
  return defaultPlanResolution({ plans: state.plans, userDefaultPlanId: d.userDefaultPlanId, globalDefaultPlanId: d.globalDefaultPlanId || null }).effectiveDefaultPlanId;
}
export const plansStatus = () => state.status;

const defaultsOf = (j) => { const o = j && typeof j === 'object' ? j : {}; const g = o.globalDefaultPlanId || o.systemDefaultPlanId || null; return { ...emptyDefaults(), userDefaultPlanId: o.userDefaultPlanId || null, globalDefaultPlanId: g, systemDefaultPlanId: g, effectiveDefaultPlanId: o.effectiveDefaultPlanId || null, source: typeof o.source === 'string' ? o.source : o.effectiveDefaultPlanId ? 'fallback' : 'none' }; };
function adopt(res) {
  const j = res && typeof res === 'object' ? res : {};
  state = { ...state, status: 'ready', plans: Array.isArray(j.plans) ? j.plans : [], references: j.references && typeof j.references === 'object' ? j.references : {}, defaults: defaultsOf(j.defaults), capabilities: j.capabilities || null, storage: j.storage || null, error: null, loadedAt: new Date().toISOString() };
}
/**
 * Load the plans through `client` ({ list() → { plans, references, capabilities, storage } }). The same `key` that is already loaded (and not `force`d) is not fetched again; concurrent calls share one request.
 * Never throws: a 403 → status 'forbidden' (no planning module: the cache is empty), any other failure → status 'error' (the previous copy is kept so screens do not blank on a transient failure).
 */
export function hydratePlans(client, { key: k = null, force = false } = {}) {
  if (client) lastClient = client;
  const c = client || lastClient;
  if (!c || typeof c.list !== 'function') return Promise.resolve(getSnapshot());
  if (!force && k !== null && k === key && state.status === 'ready') return Promise.resolve(getSnapshot());
  if (inflight && !force && inflight.key === k) return inflight.promise;
  const my = ++gen;
  state = { ...state, status: state.status === 'ready' ? 'ready' : 'loading' }; if (snapshot.status !== state.status) emit();
  const promise = Promise.resolve().then(() => c.list()).then(
    (res) => { if (my !== gen) return getSnapshot(); adopt(res); key = k; emit(); return getSnapshot(); },
    (e) => {
      if (my !== gen) return getSnapshot();
      const forbidden = !!e && (e.status === 403 || e.forbidden === true);
      state = forbidden ? { ...emptyState(), status: 'forbidden', version: state.version, error: e.code || 'forbidden' } : { ...state, status: 'error', error: (e && e.code) || 'network' };
      key = null; emit(); return getSnapshot();
    }
  ).finally(() => { if (inflight && inflight.my === my) inflight = null; });
  inflight = { my, key: k, promise };
  return promise;
}
/** reload with the client of the last hydrate (after an edit, on window focus, on demand) */
export const refreshPlans = () => hydratePlans(null, { force: true });
/** sign-out / epoch change: nothing of the previous person survives */
export function clearPlans() { gen += 1; key = null; inflight = null; lastClient = null; state = { ...emptyState(), version: state.version }; emit(); }
/** tests: put plan records straight into the cache (status 'ready'); `defaults` is { userDefaultPlanId?, globalDefaultPlanId?, effectiveDefaultPlanId?, source? } */
export function setPlansForTest({ plans = [], references = {}, defaults = null, capabilities = null, storage = null } = {}) { gen += 1; key = null; inflight = null; state = { ...state, status: 'ready', plans: JSON.parse(JSON.stringify(plans)), references: JSON.parse(JSON.stringify(references)), defaults: defaultsOf(defaults), capabilities, storage, error: null, loadedAt: null }; emit(); }
/**
 * Put one plan record the server just returned (create / update answer) into the cache without a refetch: replaces the plan with the same id (keeping its place) or appends it. The reference resolution is recomputed.
 * Stale answers are the caller's concern (the server's `revision` is the arbiter): a record with a LOWER revision than the cached one is ignored.
 */
export function upsertPlanLocally(plan) {
  if (!plan || typeof plan !== 'object' || typeof plan.id !== 'string') return false;
  const rec = JSON.parse(JSON.stringify(plan)); const i = state.plans.findIndex((p) => p.id === plan.id);
  if (i >= 0 && Number.isInteger(state.plans[i].revision) && Number.isInteger(rec.revision) && rec.revision < state.plans[i].revision) return false;
  const plans = i >= 0 ? state.plans.map((p, k) => (k === i ? rec : p)) : [...state.plans, rec];
  state = { ...state, plans }; emit(); return true;
}
/** apply the `defaults` of a server answer (PUT /plans/default, POST /plans) to the cache */
export function setDefaultsLocally(defaults) { state = { ...state, defaults: defaultsOf(defaults) }; emit(); }

/** resolveReferencePlan over the cache → { state:'ok', plan, view, source, sourceLabel, versionId, name } | { state:'ambiguous', candidates } | { state:'none' } | { state:'reference_invalid', reason, planId, configured } */
export function referenceFor(year) {
  const y = Number(year);
  if (memo.has(y)) return memo.get(y);
  const r = resolveReferencePlan({ year: y, plans: state.plans, references: state.references });
  memo.set(y, r); return r;
}
/**
 * The ONE thing a non-plan consumer reads for a calendar year:
 *   ok  → the in-force planView of the reference plan, PLUS referenceState:'ok', source:'configured'|'only_eligible', sourceLabel:{ar,en}
 *         (planView.state is the plan's lifecycle state, e.g. 'active'; test `referenceState`, never `state`)
 *   not ok → { referenceState, state: referenceState, … } with referenceState 'ambiguous' (+ candidates) | 'none' | 'reference_invalid' (+ reason, planId) — `view` is absent; the consumer SURFACES it, never picks silently.
 */
export function referenceViewFor(year) {
  const r = referenceFor(year);
  if (r.state === 'ok') return { ...r.view, referenceState: 'ok', source: r.source, sourceLabel: r.sourceLabel };
  const { state: s, ...rest } = r;
  return { referenceState: s, state: s, ...rest };
}
