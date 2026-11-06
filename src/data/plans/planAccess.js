// PLAN ACCESS — who may see and who may change a revenue plan (pure; shared by the server (authoritative, 403) and the client (UI hints)).
// Built on the GeoScope helpers (src/data/geoScope.js). Spec §2 «Access»:
//   • a plan may be CHANGED only when the actor's scope FULLY covers every entity of the plan: a Ministry-scope plan needs all-entities access; an entity-scope plan needs a whole-Amanah grant
//     (all municipalities + direct + not-specified) for every Amanah in it, and the non-municipal grant for the Housing Sector. A municipal grant is NOT enough. A read-only role never changes anything.
//   • a restricted VIEWER sees the entities their scope touches (any grant of an Amanah makes the Amanah's row visible — the same rule as geoScopeAmanahKeys); the module permission itself is checked by the caller.
//   • setting the per-year reference plan needs all-entities access (it changes what every consumer reads).
// Module permission («planning») is the caller's concern; no finer permission is invented here.
import { GEO_HIERARCHY, entireAmanahGrant, geoScopeSubset, normalizeGeoScope } from '../geoScope.js';
import { appropriationKeys, HQ_KEY } from '../appropriations.js';
import { municipalitiesOf } from '../amanahHierarchy.js';

/** the entities a plan may name: the appropriation entities except the headquarters (it collects no revenue) */
export const entityUniverse = () => appropriationKeys().filter((k) => k !== HQ_KEY);

const isAmanah = (k) => GEO_HIERARCHY.has(k);
const uniq = (a) => [...new Set(a)];

/** the entity keys a plan scope names (ministry → the whole universe); an unrecognised scope names nothing */
export function scopeEntityKeys(scope, universe = entityUniverse()) {
  if (scope?.kind === 'ministry') return [...universe];
  if (scope?.kind === 'entities' && Array.isArray(scope.entityKeys)) return uniq(scope.entityKeys.filter((k) => typeof k === 'string'));
  return [];
}

/** the GeoScope an actor must fully hold to change a plan of this scope; null when the scope names an entity that does not exist or nothing at all */
export function requiredGeoScope(planScope, universe = entityUniverse()) {
  const keys = scopeEntityKeys(planScope, universe);
  if (!keys.length) return null;
  if (keys.some((k) => !universe.includes(k))) return null;
  const am = keys.filter(isAmanah);
  return normalizeGeoScope({ all: false, grants: am.map(entireAmanahGrant), nonMunicipal: keys.some((k) => !isAmanah(k)) }); // every Amanah + the Housing Sector collapses to { all: true }
}

/**
 * the decision with its reason: { ok, reason: null | 'read_only_role' | 'scope' | 'unknown_scope' | 'municipality' } (the server maps read_only_role / scope / municipality onto 403).
 * Optional `municipalities` = the [{ entityKey, muniId }] a payload names (e.g. `content.municipalAllocations`): once the whole-Amanah rule is met, a municipality the actor's grants do not cover (or that does not belong to
 * the named Amanah) gives reason 'municipality' (+ `municipalities`: the offending rows). Without that option the decision is exactly what it always was.
 */
export function mutateDecision(geoScope, planScope, { readOnly = false, municipalities = null } = {}) {
  if (readOnly) return { ok: false, reason: 'read_only_role' };
  const need = requiredGeoScope(planScope);
  if (!need) return { ok: false, reason: 'unknown_scope' };
  if (!geoScopeSubset(need, geoScope)) return { ok: false, reason: 'scope' };
  if (Array.isArray(municipalities)) { const bad = municipalRowsOutsideGrants(geoScope, municipalities); if (bad.length) return { ok: false, reason: 'municipality', municipalities: bad }; }
  return { ok: true, reason: null };
}
/** may this actor create / edit / activate / archive / restore a plan of this scope? */
export const canMutateScope = (geoScope, planScope, opts = {}) => mutateDecision(geoScope, planScope, opts).ok;

/** the entities of `universe` the actor's scope lets them see (always an array; the full universe for an all-entities actor) */
export function visibleEntityKeysOfScope(geoScope, universe = entityUniverse()) {
  const s = normalizeGeoScope(geoScope);
  if (s.all) return [...universe];
  const am = new Set(s.grants.map((g) => g.amanah));
  return universe.filter((k) => (isAmanah(k) ? am.has(k) : s.nonMunicipal === true));
}
/** may this actor SEE a plan of this scope (at least one of its entities is visible)? A plan naming no entity is visible to an all-entities actor only. */
export function canViewScope(geoScope, planScope) {
  const s = normalizeGeoScope(geoScope);
  if (s.all) return true;
  const keys = scopeEntityKeys(planScope);
  if (!keys.length) return false;
  const vis = new Set(visibleEntityKeysOfScope(s));
  return keys.some((k) => vis.has(k));
}
/** does the actor see EVERY entity of this plan scope (so nothing needs masking)? */
export function canViewWholeScope(geoScope, planScope) {
  const keys = scopeEntityKeys(planScope);
  if (!keys.length) return normalizeGeoScope(geoScope).all === true;
  const vis = new Set(visibleEntityKeysOfScope(geoScope));
  return keys.every((k) => vis.has(k));
}
/** may this actor set the reference plan of a year? (needs all-entities access; a read-only role never) */
export const canSetReference = (geoScope, { readOnly = false } = {}) => !readOnly && normalizeGeoScope(geoScope).all === true;

// ---- municipalities (spec §9) ---------------------------------------------------------------------------------------------------------------------------------
const muniIdsOf = (entityKey) => municipalitiesOf(entityKey).map((m) => m.refId);
/**
 * How the actor's scope covers ONE entity: { entityKey, covered (any grant of it), whole (every municipality + direct + not-specified, i.e. the whole-Amanah grant; for a non-Amanah entity: the non-municipal grant),
 * all (every municipality of the Amanah is covered), muniIds (the municipalities covered, reference order), direct, notSpecified }. A grant is hierarchy-aware: a list naming every municipality counts as 'all'.
 */
export function municipalCoverage(geoScope, entityKey) {
  const s = normalizeGeoScope(geoScope); const ids = muniIdsOf(entityKey);
  const none = { entityKey, covered: false, whole: false, all: false, muniIds: [], direct: false, notSpecified: false };
  if (s.all) return { entityKey, covered: true, whole: true, all: true, muniIds: ids, direct: true, notSpecified: true };
  if (!isAmanah(entityKey)) { const ok = s.nonMunicipal === true; return ok ? { ...none, covered: true, whole: true } : none; }
  const g = s.grants.find((x) => x.amanah === entityKey); if (!g) return none;
  const list = g.municipalities === 'all' ? ids : ids.filter((r) => g.municipalities.includes(r));
  const all = g.municipalities === 'all' || (ids.length > 0 && list.length === ids.length);
  return { entityKey, covered: true, whole: all && g.direct === true && g.notSpecified === true, all, muniIds: list, direct: g.direct === true, notSpecified: g.notSpecified === true };
}
/** the municipality ids (reference ids, reference order) of `entityKey` the scope covers: every one of the Amanah's for an all-grant, the listed ones otherwise, [] for none / a non-Amanah entity. Flags: see municipalCoverage. */
export const authorisedMunicipalities = (geoScope, entityKey) => municipalCoverage(geoScope, entityKey).muniIds;
/** may this scope see ONE municipality of this Amanah (the municipality must belong to it)? */
export const canViewMunicipality = (geoScope, entityKey, muniId) => typeof muniId === 'string' && authorisedMunicipalities(geoScope, entityKey).includes(muniId);
/** the rows ([{ entityKey, muniId }]) the scope does NOT cover (including a municipality that does not belong to the named Amanah) */
export const municipalRowsOutsideGrants = (geoScope, rows) => (Array.isArray(rows) ? rows : []).filter((r) => !canViewMunicipality(geoScope, r?.entityKey, r?.muniId));

/**
 * The VIEW scope of a page: { amanah: 'all' | entityKey, muni: 'all' | MREF-id } — a filter, never plan content. Normalises it against what the actor may see:
 *   • an unknown / unauthorised Amanah resets to 'all' (and the municipality with it); a municipality without an Amanah, not belonging to it, or not authorised resets to 'all' — `invalidReason` says why
 *     (null | 'unknown_amanah' | 'amanah_not_authorised' | 'municipality_without_amanah' | 'municipality_not_in_amanah' | 'municipality_not_authorised').
 *   • `municipalityOptions` = ONLY the authorised municipalities of the chosen Amanah ([{ muniId, key ('<Amanah>|<MREF>'), name:{ar,en} }]); no options ⇒ `showMunicipality` is false (the field is hidden).
 *   • `amanahOptions` = the entities the actor may see; `muniFilterValue` = the data service's `muni` filter value ('<Amanah>|<MREF>') or null; `isDefault` = the whole-Amanah / all view.
 * Pure; `universe` defaults to the plan entity universe.
 */
export function viewScopeOf(view, { geoScope, universe = entityUniverse() } = {}) {
  const amanahOptions = visibleEntityKeysOfScope(geoScope, universe); let invalidReason = null;
  let amanah = view?.amanah == null || view.amanah === '' ? 'all' : view.amanah; let muni = view?.muni == null || view.muni === '' ? 'all' : view.muni;
  if (amanah !== 'all') {
    if (typeof amanah !== 'string' || !universe.includes(amanah)) { invalidReason = 'unknown_amanah'; amanah = 'all'; }
    else if (!amanahOptions.includes(amanah)) { invalidReason = 'amanah_not_authorised'; amanah = 'all'; }
    if (amanah === 'all') muni = 'all';
  }
  let municipalityOptions = [];
  if (amanah === 'all') { if (muni !== 'all') { invalidReason = invalidReason || 'municipality_without_amanah'; muni = 'all'; } }
  else {
    const auth = authorisedMunicipalities(geoScope, amanah);
    municipalityOptions = municipalitiesOf(amanah).filter((m) => auth.includes(m.refId)).map((m) => ({ muniId: m.refId, key: m.key, name: { ar: m.ar, en: m.en } }));
    if (muni !== 'all') {
      if (!muniIdsOf(amanah).includes(muni)) { invalidReason = invalidReason || 'municipality_not_in_amanah'; muni = 'all'; }
      else if (!auth.includes(muni)) { invalidReason = invalidReason || 'municipality_not_authorised'; muni = 'all'; }
    }
  }
  return { amanah, muni, invalidReason, amanahOptions, municipalityOptions, showMunicipality: municipalityOptions.length > 0, muniFilterValue: amanah !== 'all' && muni !== 'all' ? `${amanah}|${muni}` : null, isDefault: amanah === 'all' && muni === 'all' };
}
/** changing the Amanah clears the municipality: returns { amanah, muni } of `next` with muni 'all' whenever the Amanah differs from `prev` */
export function resetMuniOnAmanahChange(prev, next) {
  const pa = prev?.amanah ?? 'all'; const na = next?.amanah ?? 'all';
  return { amanah: na, muni: na !== pa ? 'all' : (next?.muni ?? 'all') };
}
