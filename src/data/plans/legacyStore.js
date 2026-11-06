// THE LEGACY DEVICE RECORD — a small READ-ONLY reader of the old browser value `ib_plan_targets_v1` (docs/revenue-plans-spec.md §2 «Legacy»).
// The planning page no longer reads or writes this value: targets live in the shared plans (server). This module exists for ONE purpose — to describe what an older browser still holds so it can be IMPORTED as a plan
// (planDefaults.legacyStoreToContent / legacyRecord, the «استيراد كخطة» notice). It never writes, deletes or modifies the value: nothing in the application calls setItem / removeItem on this key.
// The store shape (kept verbatim from the retired planning page): { v: 1|2, years: { [year]: { [entityKey]: { coverage?, collectionRate?, weights?, savedAt?, savedBy? } } }, meta: { [year]: { version, versionId, status, owner, savedAt, savedBy } },
//   overall: { [year]: { coverage?, collectionRate?, billing?, savedAt?, savedBy? } }, override: { [year]: boolean } }.
// Pure functions except `readLegacyStore` (a localStorage READ). Defaults reproduce the revenue appropriation (illustrative demo inputs).
import { appropriationOf, appropriationKeys } from '../appropriations';

export const LEGACY_KEY = 'ib_plan_targets_v1';
export const TARGETS_KEY = LEGACY_KEY;
export const MONTHS = 12;
export const DEFAULT_OVERALL_COVERAGE = 0.66; // illustrative (the old documented default)
export const DEFAULT_OVERALL_COLLECTION = 0.68; // illustrative

export const emptyLegacyStore = () => ({ v: 2, years: {}, meta: {} });
export const evenWeights = () => Array.from({ length: MONTHS }, () => 1 / MONTHS);
export const normalizeWeights = (w) => { const a = Array.from({ length: MONTHS }, (_, i) => Math.max(0, Number(w?.[i]) || 0)); const s = a.reduce((t, x) => t + x, 0); return s > 0 ? a.map((x) => x / s) : evenWeights(); };
const cumulative = (parts) => { let run = 0; return parts.map((v) => (run += v)); };

/** READ the old value of this browser (never writes). A missing / unreadable / foreign value is the empty store. */
export function readLegacyStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    const v = JSON.parse(storage?.getItem(LEGACY_KEY) || 'null');
    return v && (v.v === 1 || v.v === 2) && v.years && typeof v.years === 'object' ? { ...v, v: 2, meta: v.meta && typeof v.meta === 'object' ? v.meta : {} } : emptyLegacyStore();
  } catch { return emptyLegacyStore(); }
}

/** the years for which the store holds something a person saved (a typed value, a version, an overall input, an override) — numbers, ascending */
export function legacyYears(store) {
  if (!store || typeof store !== 'object') return [];
  const ys = new Set();
  for (const part of ['years', 'meta', 'overall', 'override']) for (const k of Object.keys(store[part] && typeof store[part] === 'object' ? store[part] : {})) {
    const y = Number(k); if (!Number.isInteger(y) || y < 1990 || y > 2200) continue;
    const v = store[part][k];
    if (part === 'years' && !(v && typeof v === 'object' && Object.keys(v).length)) continue;
    ys.add(y);
  }
  return [...ys].sort((a, b) => a - b);
}

/** the version / status / owner of the target in force for a year; a store without `meta` is version 0 = the illustrative default (`<year>-default`) */
export function targetMetaOf(store, year) {
  const m = store?.meta?.[year] || null; const n = m?.version || 0;
  return { version: n, versionId: m?.versionId || (n ? `${year}-v${n}` : `${year}-default`), status: m?.status === 'approved' ? 'approved' : 'illustrative', owner: m?.owner || null, editedAt: m?.savedAt || null, editedBy: m?.savedBy || null };
}
export function overallOf(store, year) {
  const o = store?.overall?.[year] || null;
  return { coverage: o?.coverage != null ? o.coverage : DEFAULT_OVERALL_COVERAGE, collectionRate: o?.collectionRate != null ? o.collectionRate : DEFAULT_OVERALL_COLLECTION, billing: o?.billing != null ? o.billing : null, source: o ? 'saved' : 'default', savedAt: o?.savedAt || null, savedBy: o?.savedBy || null };
}
/** the per-entity override: an explicit choice wins; otherwise ON only when the store holds a typed per-entity coverage / collection rate for the year */
export function overrideOn(store, year) {
  const x = store?.override?.[year]; if (typeof x === 'boolean') return x;
  const y = store?.years?.[year] || {};
  return Object.values(y).some((e) => e && (e.coverage != null || e.collectionRate != null));
}

/**
 * What the old store describes for every entity of a year (`items` = [{ key, a }], `a` = the appropriation row): override OFF → the Ministry target is overall coverage × the TOTAL communicated budget carried by the entities that
 * collect revenue in proportion to their revenue appropriation; override ON → a typed per-entity value wins. Kept ONLY so an old device record can be mapped to a plan (planDefaults.legacyStoreToContent).
 */
export function entityTargets(store, year, items) {
  const ov = overallOf(store, year); const on = overrideOn(store, year);
  const totalBudget = items.reduce((t, x) => t + (x.a?.expAdjusted || 0), 0); const totalRev = items.reduce((t, x) => t + (x.a?.revAdjusted || 0), 0);
  return items.map(({ key, a }) => {
    const budget = a?.expAdjusted || 0; const rev = a?.revAdjusted || 0;
    const saved = store?.years?.[year]?.[key] || null;
    const baseTarget = totalRev > 0 ? ov.coverage * totalBudget * (rev / totalRev) : 0;
    const baseCoverage = budget > 0 ? baseTarget / budget : null;
    const typedCov = on && saved?.coverage != null; const typedRate = on && saved?.collectionRate != null;
    const coverage = typedCov ? saved.coverage : baseCoverage;
    const collectionRate = typedRate ? saved.collectionRate : ov.collectionRate;
    const revenueTarget = coverage != null && budget > 0 ? coverage * budget : 0;
    const billing = revenueTarget > 0 && collectionRate > 0 ? revenueTarget / collectionRate : 0;
    const weights = normalizeWeights(saved?.weights);
    return { key, year, budget, coverage, collectionRate, billing, weights, revenueTarget, monthly: weights.map((w) => revenueTarget * w), cumulative: cumulative(weights.map((w) => revenueTarget * w)), source: typedCov || typedRate ? 'saved' : 'default' };
  });
}
/** the targets of every entity of a year on the FULL entity set */
export function entityTargetsFull(store, year) {
  return entityTargets(store, year, appropriationKeys().map((k) => ({ key: k, a: appropriationOf(k, year) })));
}
