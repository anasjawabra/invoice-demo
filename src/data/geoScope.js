// GEOGRAPHIC SCOPE (shared client + server, PURE: no React, no Node API). docs/access-control.md §2.
//
//   GeoScope = { all: true } | { all: false, grants: Grant[], nonMunicipal: boolean }
//   Grant    = { amanah, municipalities: 'all' | string[] /* MREF-… ids of src/data/amanahHierarchy.js */, direct: boolean, notSpecified: boolean }
//
// * `municipalities:'all'` = every mapped municipality of the Amanah; an array = only those (each MUST belong to that Amanah in the verified hierarchy).
// * `direct`       = records issued directly at Amanah level (municipality status `direct_amanah`).
// * `notSpecified` = records whose source gave the Amanah but no municipality; `unmapped_source_value` and `conflict` follow it, so nothing unidentified is silently granted.
// * Selecting a few municipalities NEVER implies `direct` or `notSpecified`.
// * `nonMunicipal` = records of entities that are not Amanahs (the central / sector entities of the catalog).
// A scope only ever NARROWS: intersect(a, b) ⊆ a and ⊆ b; union is used solely to combine the assignments whose role holds the SAME permission.
import { ENTITIES, N_AMANAH } from './catalog';
import { municipalitiesOf } from './amanahHierarchy';

export const ALL_SCOPE = Object.freeze({ all: true });
export const EMPTY_SCOPE = Object.freeze({ all: false, grants: Object.freeze([]), nonMunicipal: false });
/** the Amanah keys (the English entity names used everywhere) in catalog order */
export const AMANAH_KEYS = Object.freeze(ENTITIES.slice(0, N_AMANAH).map((e) => e.en));
const AMANAH_RANK = Object.fromEntries(AMANAH_KEYS.map((k, i) => [k, i]));

/** the default hierarchy used for validation: { has(amanah), refsOf(amanah) → string[] }. A custom hierarchy with the same two functions may be passed to validateGeoScope. */
export const GEO_HIERARCHY = Object.freeze({
  has: (amanah) => Object.prototype.hasOwnProperty.call(AMANAH_RANK, amanah),
  refsOf: (amanah) => municipalitiesOf(amanah).map((m) => m.refId)
});

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const byAmanah = (a, b) => ((AMANAH_RANK[a.amanah] ?? 99) - (AMANAH_RANK[b.amanah] ?? 99)) || (a.amanah < b.amanah ? -1 : a.amanah > b.amanah ? 1 : 0);
const uniqSorted = (arr) => [...new Set(arr.filter((x) => typeof x === 'string' && x))].sort();
const emptyGrant = (g) => g.municipalities !== 'all' && g.municipalities.length === 0 && !g.direct && !g.notSpecified;

function normGrant(g) {
  if (!isObj(g) || typeof g.amanah !== 'string') return null;
  const m = g.municipalities === 'all' ? 'all' : Array.isArray(g.municipalities) ? uniqSorted(g.municipalities) : [];
  return { amanah: g.amanah, municipalities: m, direct: g.direct === true, notSpecified: g.notSpecified === true };
}
function mergeGrants(a, b) { // union of two grants of the SAME Amanah
  return { amanah: a.amanah, municipalities: a.municipalities === 'all' || b.municipalities === 'all' ? 'all' : uniqSorted([...a.municipalities, ...b.municipalities]), direct: a.direct || b.direct, notSpecified: a.notSpecified || b.notSpecified };
}
const isFullGrant = (g) => g.municipalities === 'all' && g.direct && g.notSpecified;

/** canonical form: sorted, merged by Amanah, empty grants dropped, municipality arrays sorted and unique; every Amanah fully granted + nonMunicipal collapses to { all: true }. Anything unrecognisable → the EMPTY scope (never a wider one). */
export function normalizeGeoScope(x) {
  if (!isObj(x)) return EMPTY_SCOPE;
  if (x.all === true) return ALL_SCOPE;
  const grants = new Map();
  for (const raw of Array.isArray(x.grants) ? x.grants : []) {
    const g = normGrant(raw); if (!g) continue;
    grants.set(g.amanah, grants.has(g.amanah) ? mergeGrants(grants.get(g.amanah), g) : g);
  }
  const list = [...grants.values()].filter((g) => !emptyGrant(g)).sort(byAmanah);
  const nonMunicipal = x.nonMunicipal === true;
  if (nonMunicipal && AMANAH_KEYS.every((k) => { const g = grants.get(k); return g && isFullGrant(g); })) return ALL_SCOPE;
  return { all: false, grants: list, nonMunicipal };
}

export const isAllGeoScope = (s) => normalizeGeoScope(s).all === true;
export const isEmptyGeoScope = (s) => { const n = normalizeGeoScope(s); return !n.all && n.grants.length === 0 && !n.nonMunicipal; };

const E = (code, path, ar, en, extra = {}) => ({ code, path, ar, en, ...extra });
/** Strict validation of a RAW scope against the verified hierarchy. Returns { ok, errors:[{code,path,ar,en}] }. Unknown Amanah, a municipality that does not belong to the Amanah, wrong types, duplicates and empty grants are rejected. */
export function validateGeoScope(scope, hierarchy = GEO_HIERARCHY) {
  const errors = [];
  if (!isObj(scope)) return { ok: false, errors: [E('scope_invalid', 'scope', 'النطاق الجغرافي غير صالح.', 'The geographic scope is not valid.')] };
  if (scope.all === true) return { ok: true, errors };
  if (scope.all !== false) errors.push(E('scope_invalid', 'scope.all', 'يجب تحديد «الكل» أو قائمة منح.', 'Choose "all" or a list of grants.'));
  if (scope.nonMunicipal !== undefined && typeof scope.nonMunicipal !== 'boolean') errors.push(E('scope_invalid', 'scope.nonMunicipal', 'قيمة «الجهات غير البلدية» غير صالحة.', 'The non-municipal flag is not valid.'));
  if (!Array.isArray(scope.grants)) { errors.push(E('scope_invalid', 'scope.grants', 'قائمة الأمانات مطلوبة.', 'The list of Amanahs is required.')); return { ok: false, errors }; }
  const seen = new Set();
  scope.grants.forEach((g, i) => {
    const p = `scope.grants[${i}]`;
    if (!isObj(g) || typeof g.amanah !== 'string') { errors.push(E('grant_invalid', p, 'منحة الأمانة غير صالحة.', 'The Amanah grant is not valid.')); return; }
    if (!hierarchy.has(g.amanah)) { errors.push(E('unknown_amanah', `${p}.amanah`, 'أمانة غير معروفة.', 'Unknown Amanah.', { amanah: g.amanah })); return; }
    if (seen.has(g.amanah)) errors.push(E('duplicate_amanah', `${p}.amanah`, 'الأمانة مكررة في النطاق.', 'The Amanah appears twice in the scope.', { amanah: g.amanah }));
    seen.add(g.amanah);
    for (const f of ['direct', 'notSpecified']) if (g[f] !== undefined && typeof g[f] !== 'boolean') errors.push(E('grant_invalid', `${p}.${f}`, 'قيمة منطقية مطلوبة.', 'A true/false value is required.'));
    const m = g.municipalities;
    if (m !== 'all' && !Array.isArray(m)) { errors.push(E('grant_invalid', `${p}.municipalities`, 'اختر «كل البلديات» أو قائمة بلديات.', 'Choose "all municipalities" or a list of municipalities.')); return; }
    if (Array.isArray(m)) {
      const refs = new Set(hierarchy.refsOf(g.amanah));
      for (const r of m) if (typeof r !== 'string' || !refs.has(r)) errors.push(E('municipality_not_in_amanah', `${p}.municipalities`, 'بلدية لا تتبع هذه الأمانة في المرجع المعتمد.', 'A municipality that does not belong to this Amanah in the verified reference.', { amanah: g.amanah, ref: String(r) }));
    }
    const n = normGrant(g); if (n && emptyGrant(n)) errors.push(E('empty_grant', p, 'الأمانة بلا أي بلدية أو خيار مباشر/غير محددة.', 'The Amanah has no municipality and no direct / not-specified option.', { amanah: g.amanah }));
  });
  return { ok: errors.length === 0, errors };
}

/** a ∪ b — used ONLY to combine the assignments whose roles hold the same permission */
export function unionGeoScopes(a, b) {
  const x = normalizeGeoScope(a); const y = normalizeGeoScope(b);
  if (x.all || y.all) return ALL_SCOPE;
  const m = new Map(x.grants.map((g) => [g.amanah, g]));
  for (const g of y.grants) m.set(g.amanah, m.has(g.amanah) ? mergeGrants(m.get(g.amanah), g) : g);
  return normalizeGeoScope({ all: false, grants: [...m.values()], nonMunicipal: x.nonMunicipal || y.nonMunicipal });
}
/** a ∩ b — an organisation / filter NARROWING; the result is a subset of both and can never expand */
export function intersectGeoScopes(a, b) {
  const x = normalizeGeoScope(a); const y = normalizeGeoScope(b);
  if (x.all) return y;
  if (y.all) return x;
  const ym = new Map(y.grants.map((g) => [g.amanah, g])); const out = [];
  for (const g of x.grants) {
    const h = ym.get(g.amanah); if (!h) continue;
    const m = g.municipalities === 'all' ? h.municipalities : h.municipalities === 'all' ? g.municipalities : g.municipalities.filter((r) => h.municipalities.includes(r));
    out.push({ amanah: g.amanah, municipalities: m, direct: g.direct && h.direct, notSpecified: g.notSpecified && h.notSpecified });
  }
  return normalizeGeoScope({ all: false, grants: out, nonMunicipal: x.nonMunicipal && y.nonMunicipal });
}
/** a ⊆ b (everything `a` allows, `b` allows too). Hierarchy-aware: a list that names every municipality of an Amanah covers 'all' of it. */
export function geoScopeSubset(a, b, hierarchy = GEO_HIERARCHY) {
  const x = normalizeGeoScope(a); const y = normalizeGeoScope(b);
  if (y.all) return true;
  if (x.all) return false; // y is not all (a full-but-for-one scope is still smaller)
  if (x.nonMunicipal && !y.nonMunicipal) return false;
  const ym = new Map(y.grants.map((g) => [g.amanah, g]));
  return x.grants.every((g) => {
    const h = ym.get(g.amanah); if (!h) return false;
    if (g.direct && !h.direct) return false;
    if (g.notSpecified && !h.notSpecified) return false;
    if (h.municipalities === 'all') return true;
    if (g.municipalities === 'all') { const all = hierarchy.refsOf(g.amanah); return all.length > 0 && all.every((r) => h.municipalities.includes(r)); }
    return g.municipalities.every((r) => h.municipalities.includes(r));
  });
}
export const geoScopesEqual = (a, b) => geoScopeSubset(a, b) && geoScopeSubset(b, a);

/** the Amanah keys a scope touches (those with any grant), sorted in catalog order; null = every Amanah ({all:true}) */
export function geoScopeAmanahKeys(scope) {
  const n = normalizeGeoScope(scope);
  return n.all ? null : n.grants.map((g) => g.amanah);
}

/* ---------- the per-record rule ---------- */
const NOT_SPECIFIED_LIKE = new Set(['not_specified', 'unmapped_source_value', 'conflict']);
/** Does the scope allow ONE record? rec = { amanah (key) | null, municipalityRefId | null, municipalityStatus, nonMunicipal }.
 *  mapped → municipalities is 'all' or includes the refId · direct_amanah → grant.direct · not_specified / unmapped_source_value / conflict (and anything unknown) → grant.notSpecified ·
 *  a record of a non-Amanah entity → scope.nonMunicipal · {all:true} allows everything. A grant for another Amanah never allows the record. */
export function geoScopeAllowsRecord(scope, rec) {
  const s = scope && scope.all === true ? ALL_SCOPE : normalizeGeoScope(scope);
  if (s.all) return true;
  if (!rec) return false;
  if (rec.nonMunicipal || (rec.amanah && !GEO_HIERARCHY.has(rec.amanah))) return s.nonMunicipal === true; // a non-Amanah entity (e.g. the Housing Sector)
  const g = s.grants.find((x) => x.amanah === rec.amanah); if (!g) return false;
  return allowsInGrant(g, rec.municipalityStatus, rec.municipalityRefId);
}
function allowsInGrant(g, status, refId) {
  const st = status || (refId ? 'mapped' : 'not_specified');
  if (st === 'mapped') return g.municipalities === 'all' || (!!refId && g.municipalities.includes(refId));
  if (st === 'direct_amanah') return g.direct;
  if (NOT_SPECIFIED_LIKE.has(st)) return g.notSpecified;
  return g.notSpecified; // an unknown status is treated like «not specified»: never silently granted by a municipality list
}
/** A compiled matcher for hot loops (the store has up to ~1.6M records): m.all · m.allowsAmanah(key) · m.allows(amanahKey, status, refId, nonMunicipal). Same rule as geoScopeAllowsRecord. */
export function geoScopeMatcher(scope) {
  const s = normalizeGeoScope(scope); const map = new Map((s.grants || []).map((g) => [g.amanah, { g, set: g.municipalities === 'all' ? null : new Set(g.municipalities) }]));
  return {
    all: s.all, nonMunicipal: s.all || s.nonMunicipal, none: !s.all && !s.nonMunicipal && map.size === 0,
    allowsAmanah: (key) => s.all || map.has(key),
    allows(amanah, status, refId, nonMunicipal) {
      if (s.all) return true;
      if (nonMunicipal || (amanah && !GEO_HIERARCHY.has(amanah))) return s.nonMunicipal;
      const e = map.get(amanah); if (!e) return false;
      const st = status || (refId ? 'mapped' : 'not_specified');
      if (st === 'mapped') return e.set === null || (!!refId && e.set.has(refId));
      if (st === 'direct_amanah') return e.g.direct;
      return e.g.notSpecified;
    }
  };
}

/** a scope from a plain list of Amanah keys (not a persona: used for entity lists such as a province's Amanahs): null = everything; otherwise the ENTIRE listed Amanahs (all municipalities + direct + not specified), no non-municipal entities (as before). Unknown keys are dropped. */
export function geoScopeFromAmanahKeys(keys) {
  if (keys == null) return ALL_SCOPE;
  return normalizeGeoScope({ all: false, nonMunicipal: false, grants: (Array.isArray(keys) ? keys : []).filter((k) => GEO_HIERARCHY.has(k)).map((amanah) => ({ amanah, municipalities: 'all', direct: true, notSpecified: true })) });
}
/** the entire-Amanah grant (the «الأمانة كاملة» preset) */
export const entireAmanahGrant = (amanah) => ({ amanah, municipalities: 'all', direct: true, notSpecified: true });
/** the number of mapped municipalities a scope names (an 'all' grant counts the Amanah's municipalities in the hierarchy) */
export function geoScopeMunicipalityCount(scope, hierarchy = GEO_HIERARCHY) {
  const n = normalizeGeoScope(scope);
  if (n.all) return AMANAH_KEYS.reduce((t, k) => t + hierarchy.refsOf(k).length, 0);
  return n.grants.reduce((t, g) => t + (g.municipalities === 'all' ? hierarchy.refsOf(g.amanah).length : g.municipalities.length), 0);
}

/* ---------- description + stable key ---------- */
const arCount = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const amanahsText = (n, lang) => (lang === 'ar' ? arCount(n, 'أمانة واحدة', 'أمانتان', 'أمانات', 'أمانة') : `${n} ${n === 1 ? 'Amanah' : 'Amanahs'}`);
const munisText = (n, lang) => (lang === 'ar' ? arCount(n, 'بلدية واحدة', 'بلديتان', 'بلديات', 'بلدية') : `${n} ${n === 1 ? 'municipality' : 'municipalities'}`);
/** concise summary: «أمانتان · 5 بلديات» / “2 Amanahs · 5 municipalities”; all-municipality grants read «كل البلديات»; suffixes «+ مباشر» «+ غير محددة» «+ جهات غير بلدية» when granted; «كل الأمانات والبلديات» for all. */
export function describeGeoScope(scope, lang = 'ar', hierarchy = GEO_HIERARCHY) {
  const ar = lang !== 'en'; const n = normalizeGeoScope(scope);
  if (n.all) return ar ? 'كل الأمانات والبلديات' : 'All Amanahs and municipalities';
  const suffix = [];
  if (n.grants.some((g) => g.direct)) suffix.push(ar ? 'مباشر' : 'direct');
  if (n.grants.some((g) => g.notSpecified)) suffix.push(ar ? 'غير محددة' : 'not specified');
  if (n.nonMunicipal) suffix.push(ar ? 'جهات غير بلدية' : 'non-municipal entities');
  if (!n.grants.length) return n.nonMunicipal ? (ar ? 'الجهات غير البلدية فقط' : 'Non-municipal entities only') : (ar ? 'بلا نطاق جغرافي' : 'No geographic access');
  let base = amanahsText(n.grants.length, lang);
  const withMunis = n.grants.filter((g) => g.municipalities === 'all' || g.municipalities.length > 0);
  if (withMunis.length) base += ` · ${n.grants.every((g) => g.municipalities === 'all') ? (ar ? 'كل البلديات' : 'all municipalities') : munisText(geoScopeMunicipalityCount(n, hierarchy), lang)}`;
  return suffix.length ? `${base} ${suffix.map((s) => `+ ${s}`).join(' ')}` : base;
}
const fnv = (s, seed) => { let h = seed >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
/** a stable string for cache keys: equal scopes (after normalisation) give equal keys; long keys are hashed (two 32-bit FNV hashes + length). */
export function geoScopeKey(scope) {
  const n = normalizeGeoScope(scope);
  if (n.all) return 'ALL';
  const body = n.grants.map((g) => `${g.amanah}:${g.municipalities === 'all' ? '*' : g.municipalities.join(',')}:${g.direct ? 1 : 0}${g.notSpecified ? 1 : 0}`).join(';') + (n.nonMunicipal ? '|N' : '');
  return body.length <= 120 ? `G(${body})` : `G#${fnv(body, 2166136261)}${fnv(body, 5381)}.${body.length}`;
}
