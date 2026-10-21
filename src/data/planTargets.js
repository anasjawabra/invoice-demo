// المستهدفات (IIM-14) — the targets a person enters for the fiscal year, per الأمانة / الجهة:
//   مستهدف نسبة التغطية (coverage target)   — collected ÷ الميزانية المبلغة للأبواب الثلاثة الأولى;  coverage target × budget = the REVENUE target
//   مستهدف نسبة التحصيل (collection-rate)   — collected ÷ net billed
//   مستهدف الفوترة (billing target)          — DERIVED, never typed: revenue target ÷ collection-rate target (so the three can never contradict each other)
// and the split of the annual revenue target by month (weights summing to 1). Saved on this device with «آخر تعديل»; editable at any time (an approved change, for example).
// Defaults reproduce the revenue appropriation, so nothing changes until a person edits a target. Pure functions, no I/O (the store is a plain object).
export const TARGETS_KEY = 'ib_plan_targets_v1';
export const MONTHS = 12;
export const DEFAULT_COLLECTION_RATE = 0.6; // illustrative demo input (no approved collection-rate target was supplied)
export const evenWeights = () => Array.from({ length: MONTHS }, () => 1 / MONTHS);
export const normalizeWeights = (w) => { const a = Array.from({ length: MONTHS }, (_, i) => Math.max(0, Number(w?.[i]) || 0)); const s = a.reduce((t, x) => t + x, 0); return s > 0 ? a.map((x) => x / s) : evenWeights(); };
export const cumulative = (parts) => { let run = 0; return parts.map((v) => (run += v)); };

export const emptyTargetStore = () => ({ v: 1, years: {} });
export function loadTargetStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { const v = JSON.parse(storage?.getItem(TARGETS_KEY) || 'null'); return v && v.v === 1 && v.years && typeof v.years === 'object' ? v : emptyTargetStore(); } catch { return emptyTargetStore(); }
}
export function saveTargetStore(store, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) { try { storage?.setItem(TARGETS_KEY, JSON.stringify(store)); return true; } catch { return false; } }

/** the targets of ONE entity for a year: the saved values over the defaults; `a` = { revAdjusted, expAdjusted } (the appropriation row: revenue appropriation and the communicated budget) */
export function targetsOf(store, year, key, a) {
  const budget = a?.expAdjusted || 0; const rev = a?.revAdjusted || 0;
  const saved = store?.years?.[year]?.[key] || null;
  const coverage = saved?.coverage != null ? saved.coverage : budget > 0 ? rev / budget : null;
  const collectionRate = saved?.collectionRate != null ? saved.collectionRate : DEFAULT_COLLECTION_RATE;
  const revenueTarget = coverage != null && budget > 0 ? coverage * budget : 0; // coverage × budget = the revenue target
  const billing = revenueTarget > 0 && collectionRate > 0 ? revenueTarget / collectionRate : 0; // derived: target ÷ collection rate (an older saved `billing` value is ignored)
  const weights = normalizeWeights(saved?.weights);
  const cum = cumulative(weights.map((w) => revenueTarget * w));
  return { key, year, budget, coverage, collectionRate, billing, weights, revenueTarget, monthly: weights.map((w) => revenueTarget * w), cumulative: cum, source: saved ? 'saved' : 'default', savedAt: saved?.savedAt || null, savedBy: saved?.savedBy || null };
}
export function setTargets(store, year, key, patch, { at = new Date().toISOString(), by = null } = {}) {
  const y = { ...(store.years[year] || {}) }; const cur = y[key] || {};
  y[key] = { ...cur, ...patch, savedAt: at, savedBy: by };
  return { ...store, years: { ...store.years, [year]: y } };
}
export function resetTargets(store, year, key) { const y = { ...(store.years[year] || {}) }; delete y[key]; return { ...store, years: { ...store.years, [year]: y } }; }

/** the Ministry (all entities shown) = the sum of its entities: revenue target, budget, billing; coverage = revenue ÷ budget; collection rate = revenue ÷ billing; monthly = the sum of the entities' monthly targets */
export function totalTargets(rows) {
  const budget = rows.reduce((t, r) => t + r.budget, 0); const revenueTarget = rows.reduce((t, r) => t + r.revenueTarget, 0); const billing = rows.reduce((t, r) => t + r.billing, 0);
  const monthly = Array.from({ length: MONTHS }, (_, i) => rows.reduce((t, r) => t + r.monthly[i], 0));
  return { budget, revenueTarget, billing, requiredBilling: billing, coverage: budget > 0 ? revenueTarget / budget : null, collectionRate: billing > 0 ? revenueTarget / billing : null, monthly, cumulative: cumulative(monthly), weights: revenueTarget > 0 ? monthly.map((m) => m / revenueTarget) : evenWeights() };
}
/** «one overall coverage target»: sets the Ministry's revenue target to c × the total budget and spreads it over the entities in proportion to their current revenue targets (the headquarters keeps zero) */
export function applyOverallCoverage(store, year, c, rows, opts) {
  const totalBudget = rows.reduce((t, r) => t + r.budget, 0); const totalRev = rows.reduce((t, r) => t + r.revenueTarget, 0); const goal = c * totalBudget;
  let next = store;
  for (const r of rows) { if (!(r.revenueTarget > 0) || !(r.budget > 0) || !(totalRev > 0)) continue; const share = r.revenueTarget / totalRev; next = setTargets(next, year, r.key, { coverage: (goal * share) / r.budget }, opts); }
  return next;
}

/** the only checks a typed target needs: coverage is a non-negative number; the collection rate is above 0 and at most 100 % (a share of billing cannot be collected twice) → an error code or null */
export function targetError(patch) {
  if (patch.coverage != null && !(Number.isFinite(patch.coverage) && patch.coverage >= 0)) return 'coverage';
  if (patch.collectionRate != null && !(Number.isFinite(patch.collectionRate) && patch.collectionRate > 0 && patch.collectionRate <= 1)) return 'collection_rate';
  return null;
}

// ---- IIM-28 (v3, meeting 21 Oct): OVERALL targets with an optional per-Amanah override --------------------------------------------------------------------
//   Two SEPARATE overall inputs — مستهدف نسبة التغطية (default 66 %, from the communicated budget of the three chapters) and مستهدف نسبة التحصيل (default 68 %) — plus an optional overall مستهدف الفوترة.
//   المستهدف السنوي للإيراد = coverage × budget; الفوترة المطلوبة = revenue target ÷ collection %. The two percentages are independent: changing only the collection rate moves the required billing, never the revenue target.
//   Per-Amanah coverage / collection values are an override: OFF by default (when off, the overall values apply to every entity). Defaults are illustrative demo inputs.
//   Stored beside the v2 per-entity values in the same key: store.overall[year] = { coverage, collectionRate, billing, savedAt, savedBy }, store.override[year] = true | false.
export const DEFAULT_OVERALL_COVERAGE = 0.66; // illustrative (v3, Q2)
export const DEFAULT_OVERALL_COLLECTION = 0.68; // illustrative (v3, Q2)

export function overallOf(store, year) {
  const o = store?.overall?.[year] || null;
  return { coverage: o?.coverage != null ? o.coverage : DEFAULT_OVERALL_COVERAGE, collectionRate: o?.collectionRate != null ? o.collectionRate : DEFAULT_OVERALL_COLLECTION, billing: o?.billing != null ? o.billing : null, source: o ? 'saved' : 'default', savedAt: o?.savedAt || null, savedBy: o?.savedBy || null };
}
export function setOverall(store, year, patch, { at = new Date().toISOString(), by = null } = {}) {
  const cur = store?.overall?.[year] || {};
  return { ...store, overall: { ...(store.overall || {}), [year]: { ...cur, ...patch, savedAt: at, savedBy: by } } };
}
/** the per-entity override: an explicit choice wins; otherwise ON only when a v2 store already holds a typed per-entity coverage / collection rate for the year (so nothing a person saved is silently dropped) */
export function overrideOn(store, year) {
  const x = store?.override?.[year]; if (typeof x === 'boolean') return x;
  const y = store?.years?.[year] || {};
  return Object.values(y).some((e) => e && (e.coverage != null || e.collectionRate != null));
}
export function setOverride(store, year, on) { return { ...store, override: { ...(store.override || {}), [year]: !!on } }; }

/**
 * The targets of every entity of a year. `items` = [{ key, a }] with `a` = { revAdjusted, expAdjusted } (the appropriation row).
 * Override OFF: the Ministry target is overall coverage × the TOTAL communicated budget (headquarters included), carried by the entities that collect revenue in proportion to their revenue appropriation
 * (headquarters collects nothing and keeps zero), so the entities always add up to the Ministry. Collection rate = the overall one for every entity.
 * Override ON: a typed per-entity value wins, an untyped one keeps the overall-derived value.
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
    const billing = revenueTarget > 0 && collectionRate > 0 ? revenueTarget / collectionRate : 0; // الفوترة المطلوبة
    const weights = normalizeWeights(saved?.weights);
    return { key, year, budget, coverage, collectionRate, billing, requiredBilling: billing, weights, revenueTarget, monthly: weights.map((w) => revenueTarget * w), cumulative: cumulative(weights.map((w) => revenueTarget * w)), source: typedCov || typedRate ? 'saved' : 'default', savedAt: saved?.savedAt || null, savedBy: saved?.savedBy || null };
  });
}
/** the overall billing target (a person's input, optional) against the required billing: null when none is set; otherwise the gap (negative = the target is BELOW what is required) */
export function billingCheck(billingTarget, requiredBilling) {
  if (!(billingTarget > 0) || !(requiredBilling > 0)) return null;
  const gap = billingTarget - requiredBilling;
  return { gap, below: gap < -0.5 };
}
/** a typed billing target: a non-negative amount (blank = not set) */
export const billingError = (v) => (v != null && !(Number.isFinite(v) && v >= 0) ? 'billing' : null);
