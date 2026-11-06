// Per-request VISIBILITY over the columnar store, derived from a GeoScope (docs/access-control.md §2 and §5).
//
// An invoice (generated, hand-anchored or uploaded) is visible iff `geoScopeAllowsRecord(access, { amanah, municipalityRefId, municipalityStatus, nonMunicipal })` for its stored entity (`st.ent`) and
// its stored municipality code (`st.mref`). Those two columns are small integers, so the decision is made ONCE per (entity, municipality code) pair — a table of NE × MUNI_SLOTS bytes cached per
// `geoScopeKey(access)` — and read per row in O(1): `tab[ent * MUNI_SLOTS + code]`. No per-row object is created, nothing depends on the store size, and rows appended later (uploads) are covered
// automatically because they carry the same two columns.
//
// `access` conventions: `undefined` / `null` = unrestricted (direct function callers in tests and scripts; `handleApi` ALWAYS sets it) · `{ all: true }` = unrestricted ·
// any other value is normalised by `normalizeGeoScope` and a value that is not a GeoScope at all denies everything (fail closed).
import { ENTITIES, N_AMANAH } from '../src/data/catalog.js';
import { MUNI_SLOTS, statusOfCode, municipalityOfCode } from '../src/data/municipalityModel.js';
import { geoScopeAllowsRecord, geoScopeKey, normalizeGeoScope } from '../src/data/geoScope.js';

const NE = ENTITIES.length;
export const DENY_ALL = Object.freeze({ all: false, grants: [], nonMunicipal: false });

/** the normalised GeoScope of any `access` value (undefined/null → all; anything unusable → deny all) */
export function normalizeAccess(access) {
  if (access === undefined || access === null) return { all: true };
  if (typeof access !== 'object' || Array.isArray(access)) return { ...DENY_ALL };
  if (access.all === true) return { all: true };
  try { const n = normalizeGeoScope(access); return n && typeof n === 'object' ? n : { ...DENY_ALL }; } catch { return { ...DENY_ALL }; }
}

const tables = new Map(); // geoScopeKey → table (small: a few KB each)
const MAX_TABLES = 64;
let accessEpoch = 0;
/** an identity change (role / scope / status edit, `accessVersion` bump) drops every cached decision */
export function bumpAccessEpoch() { accessEpoch += 1; tables.clear(); masks.clear(); }

export const ALL_TABLE = Object.freeze({ all: true, key: 'ALL', tab: null, ent: null });

/** the cached decision table of an access value: { all, key, tab (NE × MUNI_SLOTS bytes), ent (1 when ANY row of that entity may be visible) } */
export function accessTable(access) {
  const scope = normalizeAccess(access);
  if (scope.all === true) return ALL_TABLE;
  const key = geoScopeKey(scope);
  const hit = tables.get(key); if (hit) { tables.delete(key); tables.set(key, hit); return hit; }
  const tab = new Uint8Array(NE * MUNI_SLOTS); const ent = new Uint8Array(NE);
  for (let e = 0; e < NE; e += 1) {
    const amanah = ENTITIES[e].en; const nonMunicipal = e >= N_AMANAH;
    for (let c = 0; c < MUNI_SLOTS; c += 1) {
      const m = e < N_AMANAH ? municipalityOfCode(e, c) : null;
      const status = e < N_AMANAH ? statusOfCode(e, c) : (c === 1 ? 'direct_amanah' : 'not_specified');
      const ok = geoScopeAllowsRecord(scope, { amanah, municipalityRefId: m ? m.refId : null, municipalityStatus: status, nonMunicipal }) === true;
      if (ok) { tab[e * MUNI_SLOTS + c] = 1; ent[e] = 1; }
    }
  }
  const t = { all: false, key, tab, ent, scope };
  tables.set(key, t); if (tables.size > MAX_TABLES) tables.delete(tables.keys().next().value);
  return t;
}

/** the table index of a stored municipality code (a code outside the table is read as «not specified» — never guessed) */
export const slotIndex = (e, code) => e * MUNI_SLOTS + (code < MUNI_SLOTS ? code : 0);
/** may the user see a record of entity `e` with stored municipality code `code`? */
export const visibleCode = (tab, e, code) => tab.all || tab.tab[slotIndex(e, code)] === 1;
/** may the user see invoice row `i` of the store? */
export const isVisible = (st, i, tab) => tab.all || tab.tab[slotIndex(st.ent[i], st.mref[i])] === 1;
/** does the access reach this entity at all (any municipality)? Cheap pre-filter. */
export const entityReachable = (tab, e) => tab.all || tab.ent[e] === 1;

const masks = new Map();
/** the visibility of every row as a byte mask (1 = visible) — null for an unrestricted access. Cached per geoScopeKey + store identity + row count + epoch; the hot paths use `isVisible` instead. */
export function visibleMask(st, access) {
  const tab = accessTable(access); if (tab.all) return null;
  const key = `${tab.key}|${st.meta?.today}|${st.n}|${accessEpoch}`;
  const hit = masks.get(key); if (hit && hit.st === st) return hit.mask;
  const mask = new Uint8Array(st.n); for (let i = 0; i < st.n; i += 1) mask[i] = tab.tab[slotIndex(st.ent[i], st.mref[i])];
  masks.set(key, { st, mask }); if (masks.size > 8) masks.delete(masks.keys().next().value);
  return mask;
}

/** the access key to put into any memo / list / facet / export cache key (identical access → identical key; different scopes never collide) */
export const accessKeyOf = (access) => accessTable(access).key;

/** the stored municipality code and entity a municipality-level record (a contract, a request) is read under */
export const recordVisible = (access, e, code) => visibleCode(accessTable(access), e, code);
