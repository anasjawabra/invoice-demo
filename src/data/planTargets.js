// المستهدفات (IIM-14) — the targets a person enters for the fiscal year, per الأمانة / الجهة:
//   مستهدف نسبة التغطية (coverage target)   — collected ÷ الميزانية المبلغة للأبواب الثلاثة الأولى;  coverage target × budget = the REVENUE target
//   مستهدف نسبة التحصيل (collection-rate)   — collected ÷ net billed
//   مستهدف الفوترة (billing target)          — the net billed amount planned for the year
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
  const billing = saved?.billing != null ? saved.billing : (revenueTarget > 0 && collectionRate > 0 ? revenueTarget / collectionRate : 0);
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
  return { budget, revenueTarget, billing, coverage: budget > 0 ? revenueTarget / budget : null, collectionRate: billing > 0 ? revenueTarget / billing : null, monthly, cumulative: cumulative(monthly), weights: revenueTarget > 0 ? monthly.map((m) => m / revenueTarget) : evenWeights() };
}
/** «one overall coverage target»: sets the Ministry's revenue target to c × the total budget and spreads it over the entities in proportion to their current revenue targets (the headquarters keeps zero) */
export function applyOverallCoverage(store, year, c, rows, opts) {
  const totalBudget = rows.reduce((t, r) => t + r.budget, 0); const totalRev = rows.reduce((t, r) => t + r.revenueTarget, 0); const goal = c * totalBudget;
  let next = store;
  for (const r of rows) { if (!(r.revenueTarget > 0) || !(r.budget > 0) || !(totalRev > 0)) continue; const share = r.revenueTarget / totalRev; next = setTargets(next, year, r.key, { coverage: (goal * share) / r.budget, billing: null }, opts); }
  return next;
}
