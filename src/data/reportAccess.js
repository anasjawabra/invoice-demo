// ACCESS RULES OF «التقارير الذكية», saved results and pickers (PURE: no React, no storage of its own). docs/access-control.md §2, §6.
//
// Everything here is a function of ONE GeoScope (the signed-in user's effective scope for the `smart_reports` module, src/data/geoScope.js) — or, for code that still holds an organisation
// (`{ amanahKeys }`), of the scope that organisation implies. A scope only ever NARROWS what a request, a picker or a saved result may touch:
//   · entity resolution   amanahAllowed / muniAllowed / groupAllowed — «all municipalities» means all AUTHORIZED ones; an unauthorized entity is refused with an access message, never described
//   · pickers             authorizedAmanahOptions / authorizedMunicipalityOptions — options come ONLY from the scope (municipalities = the Amanah ∩ the user's grant; the explicit «direct» / «not specified» groups only when granted)
//   · injected values     sanitizeScopeValues — a value (URL, stored filter, old request) outside the scope is dropped and reported (never silently widened)
//   · saved results       coverageGeo / checkCoverage — a report stores the GeoScope it was built for; reopening it re-checks the CURRENT access (coverage ⊆ scope, and the permission)
//   · per-user state      nsKey / nsStorage / createAccessBoundCache — state is namespaced by user id; derived caches are dropped when the access changes
import { ALL_SCOPE, EMPTY_SCOPE, GEO_HIERARCHY, normalizeGeoScope, intersectGeoScopes, unionGeoScopes, geoScopeSubset, geoScopeFromAmanahKeys, geoScopeKey, describeGeoScope } from './geoScope';
import { ENTITIES, N_AMANAH } from './catalog';
import { parseMuniKey, municipalityFilterOptions } from './municipalityModel';

export const HOUSING_KEY = ENTITIES[N_AMANAH]?.en || 'Housing Sector';
const isAmanahKey = (k) => GEO_HIERARCHY.has(k);
const isObj = (x) => x && typeof x === 'object';

/* ------------------------------------------------------------------ the scope behind any "access" value */
/** a GeoScope, a legacy organisation `{ amanahKeys }`, or nothing (= everything) → a normalised GeoScope. Anything unrecognisable → the EMPTY scope (never a wider one). */
export function asGeoScope(x) {
  if (x == null) return ALL_SCOPE;
  if (!isObj(x)) return EMPTY_SCOPE;
  if (typeof x.all === 'boolean') return normalizeGeoScope(x);
  if (x.geo && isObj(x.geo)) return normalizeGeoScope(x.geo); // a viewer (see makeViewer)
  if ('amanahKeys' in x) {
    const keys = x.amanahKeys;
    if (keys == null) return ALL_SCOPE;
    const base = geoScopeFromAmanahKeys(keys);
    const nonMunicipal = (Array.isArray(keys) ? keys : []).some((k) => !isAmanahKey(k)); // the legacy list could name the Housing Sector
    return nonMunicipal ? normalizeGeoScope({ ...base, nonMunicipal: true }) : base;
  }
  return EMPTY_SCOPE;
}
export const isAllScope = (s) => asGeoScope(s).all === true;
export const isNoAccess = (s) => { const n = asGeoScope(s); return !n.all && n.grants.length === 0 && !n.nonMunicipal; };
const grantOf = (s, key) => (s.all ? null : s.grants.find((g) => g.amanah === key) || null);

/* ------------------------------------------------------------------ entity-level questions */
/** may this Amanah (or non-Amanah entity such as the Housing Sector) appear in a request at all? */
export function amanahAllowed(scope, key) {
  const s = asGeoScope(scope); if (s.all) return true;
  return isAmanahKey(key) ? s.grants.some((g) => g.amanah === key) : s.nonMunicipal === true;
}
/** may this reference municipality (MREF id) of this Amanah be named? */
export function muniAllowed(scope, amanah, refId) {
  const s = asGeoScope(scope); if (s.all) return true;
  const g = grantOf(s, amanah); if (!g) return false;
  return g.municipalities === 'all' || (!!refId && g.municipalities.includes(refId));
}
/** may the explicit group («مباشر على الأمانة» = DIRECT, «بلا بلدية» = NOT_SPECIFIED, needs-review = UNRESOLVED) of this Amanah be named? Only when the grant says so. */
export function groupAllowed(scope, amanah, token) {
  const s = asGeoScope(scope); if (s.all) return true;
  if (!isAmanahKey(amanah)) return s.nonMunicipal === true;
  const g = grantOf(s, amanah); if (!g) return false;
  return token === 'DIRECT' ? g.direct === true : g.notSpecified === true;
}
/** the filter value of a municipality ('<Amanah>|MREF-…' · '<Amanah>|DIRECT' · …) → may it be used? 'all' always may (it then means «all authorized»); an invalid key never may */
export function muniKeyAllowed(scope, key) {
  const p = parseMuniKey(key); if (p === null) return true; if (p.invalid) return false;
  if (!isAmanahKey(p.amanahEn)) return asGeoScope(scope).all || asGeoScope(scope).nonMunicipal === true;
  if (p.kind === 'mapped') return muniAllowed(scope, p.amanahEn, p.refId);
  return groupAllowed(scope, p.amanahEn, p.kind === 'direct_amanah' ? 'DIRECT' : 'NOT_SPECIFIED'); // «needs review» follows «not specified»
}
/** does the user hold the ENTIRE Amanah (every municipality + direct + not specified)? false = a partial grant: «the whole Amanah» must be worded «within your access» */
export function entireAmanah(scope, key) {
  const s = asGeoScope(scope); if (s.all) return true;
  const g = grantOf(s, key); return !!g && g.municipalities === 'all' && g.direct && g.notSpecified;
}
/** the entity keys a scope touches (grant Amanahs + the Housing Sector when non-municipal entities are granted); null = everything */
export function allowedEntityKeys(scope) {
  const s = asGeoScope(scope); if (s.all) return null;
  return [...s.grants.map((g) => g.amanah), ...(s.nonMunicipal ? [HOUSING_KEY] : [])];
}

/* ------------------------------------------------------------------ pickers: options only from the scope */
/** the Amanah picker list ([{ key, ar, en }]) cut to the scope */
export function authorizedAmanahOptions(scope, all) {
  const s = asGeoScope(scope); const list = all || ENTITIES.slice(0, N_AMANAH + 1).map((e) => ({ key: e.en, en: e.en, ar: e.ar })).sort((a, b) => a.en.localeCompare(b.en));
  return s.all ? list.slice() : list.filter((a) => amanahAllowed(s, a.key));
}
/** the municipality picker of ONE Amanah ([{ value, label, kind, refId? }]): the Amanah's options ∩ the user's grant for it (the direct / not-specified / needs-review groups only when granted). Not an Amanah (all / several / none) → [] */
export function authorizedMunicipalityOptions(scope, amanah) {
  const s = asGeoScope(scope);
  return municipalityFilterOptions(amanah).filter((o) => s.all || muniKeyAllowed(s, o.value));
}

/* ------------------------------------------------------------------ injected values (URL / stored filters / an old request) */
/** { amanah, muni } (a report spec's scope fields, or a filter form's amanah/municipality) → the same fields with every value outside the scope replaced by 'all', and the list of fields that were dropped. Never widens. */
export function sanitizeScopeValues({ amanah = 'all', muni = 'all' } = {}, scope) {
  const s = asGeoScope(scope); const dropped = [];
  let am = amanah;
  if (am != null && am !== 'all' && am !== '__multi') {
    if (Array.isArray(am)) { const keep = am.filter((k) => amanahAllowed(s, k)); if (keep.length !== am.length) dropped.push('amanah'); am = keep.length === 0 ? 'all' : keep.length === 1 ? keep[0] : keep; }
    else if (!amanahAllowed(s, am)) { dropped.push('amanah'); am = 'all'; }
  }
  let mu = muni == null ? 'all' : muni;
  if (mu !== 'all') {
    const parsed = parseMuniKey(mu); const amOk = parsed && !parsed.invalid ? (Array.isArray(am) ? am.includes(parsed.amanahEn) : am === 'all' || am === '__multi' || am === parsed.amanahEn) : false;
    if (!muniKeyAllowed(s, mu) || (!amOk && dropped.includes('amanah'))) { dropped.push('muni'); mu = 'all'; }
  }
  // an Amanah that was dropped takes its municipality with it (the municipality belongs to that Amanah)
  if (dropped.includes('amanah') && mu !== 'all') { dropped.push('muni'); mu = 'all'; }
  return { amanah: am, muni: mu, dropped: [...new Set(dropped)] };
}
export const SANITIZE_NOTICE = { ar: 'أُزيلت قيمة خارج صلاحياتك من الاختيار (الأمانة أو البلدية) وعاد الاختيار إلى نطاقك المتاح.', en: 'A value outside your access (Amanah or municipality) was removed from the selection, which went back to your available scope.' };

/* ------------------------------------------------------------------ coverage of a saved result */
/** the GeoScope a request asks for (spec.scope.amanah / .muni), BEFORE the user's access is applied */
export function requestedGeoScope(sc) {
  const a = sc?.amanah; if (a == null || a === 'all') return ALL_SCOPE;
  const keys = [].concat(a).filter((k) => typeof k === 'string'); if (!keys.length) return ALL_SCOPE;
  const muni = keys.length === 1 && sc.muni && sc.muni !== 'all' ? parseMuniKey(sc.muni) : null;
  if (muni && muni.invalid) return EMPTY_SCOPE; // a key that selects nothing covers nothing
  const grants = []; let nonMunicipal = false;
  for (const k of keys) {
    if (!isAmanahKey(k)) { nonMunicipal = true; continue; }
    if (muni && muni.amanahEn === k) {
      if (muni.kind === 'mapped') grants.push({ amanah: k, municipalities: [muni.refId], direct: false, notSpecified: false });
      else if (muni.kind === 'direct_amanah') grants.push({ amanah: k, municipalities: [], direct: true, notSpecified: false });
      else grants.push({ amanah: k, municipalities: [], direct: false, notSpecified: true });
    } else if (muni) continue; // a municipality of another Amanah: nothing
    else grants.push({ amanah: k, municipalities: 'all', direct: true, notSpecified: true });
  }
  return normalizeGeoScope({ all: false, grants, nonMunicipal });
}
/** what a report built for `spec` under `access` actually covers: the request ∩ the access */
export const coverageGeo = (spec, access) => intersectGeoScopes(requestedGeoScope(spec?.scope), asGeoScope(access));
/** the GeoScope of a stored coverage: `geo` when stored, otherwise the legacy { all, keys } of an older record */
export function geoOfCoverage(c) {
  if (!c) return EMPTY_SCOPE;
  if (c.geo) return normalizeGeoScope(c.geo);
  if (c.all) return ALL_SCOPE;
  return asGeoScope({ amanahKeys: c.keys || [] });
}
/** the stored shape: the legacy fields (all, keys) stay so older readers keep working, plus `geo` */
export function coverageFromGeo(geo) {
  const g = normalizeGeoScope(geo);
  return { all: g.all === true, keys: g.all ? [] : [...g.grants.map((x) => x.amanah), ...(g.nonMunicipal ? [HOUSING_KEY] : [])], geo: g };
}
export const mergeGeoCoverage = (a, b) => coverageFromGeo(unionGeoScopes(geoOfCoverage(a), geoOfCoverage(b)));

/** the viewer: everything a re-check needs about the CURRENT access. permitted = holds the `smart_reports` module (or `invoices_uncollected` for the non-collection analyses); geo = effective scope for it */
export function makeViewer({ uid = null, geo = ALL_SCOPE, permitted = true, canExport = true, accessVersion = 0 } = {}) {
  const g = asGeoScope(geo);
  return { uid, geo: g, key: geoScopeKey(g), permitted: permitted !== false, canExport: canExport !== false, accessVersion: accessVersion || 0 };
}
/** reopening a saved result: → { ok:true } | { ok:false, reason:'permission'|'scope' }. The CURRENT access decides, never the access at the time of saving. */
export function checkCoverage(coverage, viewer) {
  if (viewer && viewer.permitted === false) return { ok: false, reason: 'permission' };
  if (!coverage || !viewer) return { ok: true };
  const cur = viewer.geo ? asGeoScope(viewer.geo) : ('amanahKeys' in viewer ? asGeoScope({ amanahKeys: viewer.amanahKeys }) : null);
  if (!cur) return { ok: true };
  return geoScopeSubset(geoOfCoverage(coverage), cur) ? { ok: true } : { ok: false, reason: 'scope' };
}
export const accessSignature = (viewer) => (viewer ? `${viewer.uid || '-'}|${viewer.accessVersion || 0}|${viewer.key || geoScopeKey(viewer.geo)}|${viewer.permitted === false ? 0 : 1}|${viewer.canExport === false ? 0 : 1}` : 'none');

export const REOPEN_MSG = {
  scope: { ar: 'لم يعد لديك صلاحية على كامل نطاق هذا التقرير، فلا تُعرض أرقامه المحفوظة ولا يمكن تصديره. يمكنك إعادة إنشائه ضمن صلاحياتك الحالية.', en: 'You no longer have access to the full scope of this report, so its saved figures are not shown and it cannot be exported. You can regenerate it within your current access.' },
  permission: { ar: 'لم يعد دورك يتيح وحدة «التقارير الذكية»، فلا تُعرض التقارير المحفوظة.', en: 'Your role no longer includes the «Smart Reports» module, so saved reports are not shown.' },
  none: { ar: 'لا تتيح لك صلاحياتك الحالية الاطلاع على بيانات أي أمانة أو بلدية، فلا أستطيع إعداد تقرير.', en: 'Your current access does not include the data of any Amanah or municipality, so I cannot prepare a report.' },
  exportDenied: { ar: 'وحدة «التقارير الذكية» غير متاحة لدورك، فلا يمكن التصدير.', en: 'The «Smart Reports» module is not available to your role, so exporting is not possible.' },
  regenerated: { ar: 'أُعيد إنشاء التقرير ضمن صلاحياتك الحالية.', en: 'The report was regenerated within your current access.' }
};
/** the spec of a report re-built within the CURRENT access: values outside it are dropped (→ 'all authorized'); { spec, dropped:[…] }. `null` when nothing of the request remains meaningful (no access). */
export function respecWithin(spec, scope) {
  const s = asGeoScope(scope); if (isNoAccess(s) || !spec?.scope) return null;
  const r = sanitizeScopeValues({ amanah: spec.scope.amanah, muni: spec.scope.muni }, s);
  return { spec: { ...spec, scope: { ...spec.scope, amanah: r.amanah, muni: r.muni } }, dropped: r.dropped };
}
export const describeAccess = (scope, lang = 'ar') => describeGeoScope(asGeoScope(scope), lang);
/** «all Amanahs» as the user's own access reads it: unrestricted → the plain wording; restricted → «everything your access allows (summary)» */
export function allAuthorizedLabel(scope, lang = 'ar') {
  const s = asGeoScope(scope);
  if (s.all) return lang === 'ar' ? 'كل الأمانات والجهات' : 'All Amanahs and entities';
  return lang === 'ar' ? `كل ما تتيحه صلاحيتك (${describeGeoScope(s, 'ar')})` : `Everything your access allows (${describeGeoScope(s, 'en')})`;
}
export function allMunicipalitiesLabel(scope, amanah, lang = 'ar') {
  const s = asGeoScope(scope); const full = s.all || (typeof amanah === 'string' && amanah !== 'all' && (() => { const g = grantOf(s, amanah); return !!g && g.municipalities === 'all'; })());
  return full ? (lang === 'ar' ? 'كل البلديات' : 'All municipalities') : (lang === 'ar' ? 'كل البلديات ضمن صلاحيتك' : 'All municipalities within your access');
}

/* ------------------------------------------------------------------ per-user state */
/** a storage key of a user: `<base>:<user key>` (the user key is `u:<name>` from reportStore.userKeyOf) */
export const nsKey = (base, uk) => (uk ? `${base}:${uk}` : null);
/**
 * A Storage-like wrapper that files every key under the user: `<key>:<uk>`. With no user nothing is read or written.
 * `adopt` = user keys that may READ the un-namespaced key of an older version when their own is missing (writes always go to the namespaced key): used once so the seeded demo
 * account keeps the follow-up flags it had before state was filed per user; every other user starts empty.
 */
export function nsStorage(storage, uk, { adopt = [] } = {}) {
  const k = (key) => `${key}:${uk}`;
  return {
    getItem: (key) => { if (!uk || !storage) return null; const v = storage.getItem(k(key)); return v == null && adopt.includes(uk) ? storage.getItem(key) : v; },
    setItem: (key, v) => { if (!uk || !storage) throw new Error('no user'); storage.setItem(k(key), v); },
    removeItem: (key) => { if (uk && storage) storage.removeItem(k(key)); }
  };
}
/** a memo whose entries are valid for ONE access signature: `bind(signature)` drops everything when the signature (user, accessVersion, scope, permission) changed → true when it dropped */
export function createAccessBoundCache() {
  let sig = null; let weak = new WeakMap(); let strong = new Map();
  return {
    bind(signature) { if (sig === signature) return false; sig = signature; weak = new WeakMap(); strong = new Map(); return true; },
    get signature() { return sig; },
    getWeak: (o) => weak.get(o), setWeak: (o, v) => { weak.set(o, v); return v; },
    get: (k) => strong.get(k), set: (k, v) => { strong.set(k, v); return v; },
    get size() { return strong.size; }
  };
}
