// PLAN DEFAULTS — the illustrative seed plan and the read-only mapping of the OLD browser store (see legacyStore.js) into the plan model. Pure; no I/O.
// legacyStore.js is the READ-ONLY reader of that value (nothing writes or deletes it): the legacy mapping reproduces what the old pages computed, rounded to whole riyals with the rounding remainder placed by largest-remainder apportionment.
import { apportion, BP_TOTAL, fiscalYearPeriod } from './planMath.js';
import { emptyContent, entityUniverse, normalizeContent } from './planRules.js';
import { appropriationOf, appropriationKeys, APPROPRIATION_YEAR, HQ_KEY } from '../appropriations.js';
import { DEFAULT_OVERALL_COVERAGE, entityTargetsFull, overallOf, targetMetaOf, LEGACY_KEY } from './legacyStore.js';

export const SEED_COVERAGE = DEFAULT_OVERALL_COVERAGE; // 66 % — the old documented default
export const seedPlanName = (year) => `خطة تحصيل ${year} — توضيحية (بيانات توضيحية)`;

/**
 * The SEED plan content (illustrative demo data): target = 66 % × the communicated budget INCLUDING the headquarters' budget (the old default; the basis is recorded as a note), allocations = the revenue-appropriation share
 * (apportioned to whole riyals, origin 'seed'; the headquarters collects nothing and has no row), explicit EQUAL monthly profile, Ministry scope, January–December preset. null where there is no appropriation data for the year.
 */
export function seedPlanContent(year = APPROPRIATION_YEAR, { at = null } = {}) {
  if (!appropriationKeys().some((k) => appropriationOf(k, year))) return null;
  const keys = appropriationKeys(); const budget = keys.reduce((t, k) => t + (appropriationOf(k, year)?.expAdjusted || 0), 0);
  const target = Math.round(budget * SEED_COVERAGE);
  const ents = entityUniverse(); const ap = apportion(target, ents.map((k) => appropriationOf(k, year)?.revAdjusted || 0));
  const c = emptyContent({ name: seedPlanName(year), scope: { kind: 'ministry' }, period: fiscalYearPeriod(year) });
  c.target = { amount: target, basis: { method: 'budget_x_coverage', coverage: SEED_COVERAGE, budget, at } };
  c.allocations = ents.map((k, i) => ({ entityKey: k, amount: ap.amounts[i], origin: 'seed' })).filter((a) => a.amount > 0);
  c.distribution = { profile: 'equal' };
  return normalizeContent(c);
}

/**
 * THE 2027 COLLECTION PLAN («خطة تحصيل 2027») — the global default plan, created ONCE by the server (idempotent by `seedKey`). Illustrative: there is no 2027 budget yet, so its targets CARRY FORWARD the communicated 2026 budget × the documented 66 %
 * coverage as an explicitly labelled ASSUMPTION (recorded in `target.basis.carriedFromYear` and shown with CARRIED_FORWARD_NOTE); never an approved or actual figure.
 */
export const COLLECTION_PLAN_2027 = Object.freeze({ seedKey: 'collection-plan-2027', id: 'plan-2027c0de', year: 2027, carriedFromYear: 2026, nameAr: 'خطة تحصيل 2027', nameEn: '2027 Collection Plan' });
export const carriedForwardNote = (year = COLLECTION_PLAN_2027.year, from = COLLECTION_PLAN_2027.carriedFromYear, coveragePct = Math.round(SEED_COVERAGE * 100)) => ({
  ar: `ميزانية ${year} توضيحية = ميزانية ${from} المبلغة لحين وصول ميزانية ${year}؛ التغطية ${coveragePct}% افتراضية`,
  en: `The ${year} budget is illustrative: it equals the communicated ${from} budget until the ${year} budget arrives; the ${coveragePct}% coverage is an assumption`
});
export const seedPlanNameEn = (year) => `${year} Collection Plan`;
/**
 * The content of a plan for `year` whose targets are the budget of `fromYear` carried forward: target = coverage × Σ communicated budget (headquarters included, as the 2026 seed), allocations = the revenue-appropriation SHARE of `fromYear`
 * (largest-remainder apportionment to whole riyals, origin 'seed'), explicit EQUAL monthly profile, Ministry scope, January–December preset. null where `fromYear` has no appropriation data.
 */
export function carryForwardPlanContent({ year, fromYear = APPROPRIATION_YEAR, name, at = null, coverage = SEED_COVERAGE } = {}) {
  const keys = appropriationKeys(); if (!keys.some((k) => appropriationOf(k, fromYear))) return null;
  const budget = keys.reduce((t, k) => t + (appropriationOf(k, fromYear)?.expAdjusted || 0), 0); const target = Math.round(budget * coverage);
  const ents = entityUniverse(); const ap = apportion(target, ents.map((k) => appropriationOf(k, fromYear)?.revAdjusted || 0));
  const c = emptyContent({ name: name || `خطة تحصيل ${year}`, scope: { kind: 'ministry' }, period: fiscalYearPeriod(year) });
  c.target = { amount: target, basis: { method: 'budget_x_coverage', coverage, budget, at, carriedFromYear: fromYear } };
  c.allocations = ents.map((k, i) => ({ entityKey: k, amount: ap.amounts[i], origin: 'seed' })).filter((a) => a.amount > 0);
  c.distribution = { profile: 'equal' };
  return normalizeContent(c);
}
/** the 2027 collection plan's content (or null where the 2026 budget is missing) */
export const collectionPlan2027Content = ({ at = null } = {}) => carryForwardPlanContent({ year: COLLECTION_PLAN_2027.year, fromYear: COLLECTION_PLAN_2027.carriedFromYear, name: COLLECTION_PLAN_2027.nameAr, at });

/**
 * THE REMAINING-2026 COLLECTION PLAN («خطة تحصيل المتبقي من 2026» / "Remaining 2026 Collection Plan") — a selectable system plan (the GLOBAL default is the full-year 2026 seed plan until an administrator changes it; no date-based switching anywhere). Created ONCE by the server from the data engine
 * (idempotent by `seedKey`); its period, baseline cut-off and derived figures are FROZEN at creation: opening the plan never recomputes or shifts them.
 */
export const REMAINING_PLAN_2026 = Object.freeze({ seedKey: 'remaining-2026-collection-plan', id: 'plan-2026d0ec', year: 2026, baselineCutoff: '2026-11-06', period: Object.freeze({ start: '2026-11-07', end: '2026-12-31', preset: 'range' }), nameAr: 'خطة تحصيل المتبقي من 2026', nameEn: 'Remaining 2026 Collection Plan' });
const dayLabel = (iso, lang) => { const [y, m, d] = iso.split('-').map(Number); const AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']; const EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return lang === 'ar' ? `${d} ${AR[m - 1]} ${y}` : `${d} ${EN[m - 1]} ${y}`; };
/** «المتبقي = المستهدف السنوي − المحصّل حتى 6 نوفمبر» — the note of every derived allocation row */
export const derivedRowNote = (cutoff) => `المتبقي = المستهدف السنوي − المحصّل حتى ${dayLabel(cutoff, 'ar')}`;
/**
 * PURE derivation of the remaining plan from the annual plan and the actual collections by entity up to the baseline cut-off.
 * input = { annualContent (the annual plan's content), actualByEntity ({ [entityKey]: riyals collected 1 Jan … cutoff — the SAME figures the planning page shows at that cut-off }), cutoff, period ({start,end}), annualPlanId, annualPlanRevision, derivedAt, name? }
 * Per entity e with an allocation: annual = its allocation · actual = collections to the cut-off (whole riyals) · remaining = max(0, annual − actual) · surplus = max(0, actual − annual), the surplus kept SEPARATE (never netted into another entity, never a negative target).
 * Target = Σ remaining (an ENTITY-level convention: it differs from «Ministry annual − Ministry actual» exactly when some entity exceeds its allocation). Allocations = the entities with remaining > 0 (origin 'derived'); the whole entity table sits in `content.baseline`.
 * Distribution = the explicit EQUAL profile over the remaining period (a partial first month by day-fraction). No municipal allocations (not derivable). → normalized content; never throws on an entity without actuals (its actual is 0).
 */
export function deriveRemainingPlanContent({ annualContent, actualByEntity = {}, cutoff = REMAINING_PLAN_2026.baselineCutoff, period = REMAINING_PLAN_2026.period, annualPlanId = null, annualPlanRevision = null, derivedAt = null, name = REMAINING_PLAN_2026.nameAr } = {}) {
  const annualRows = (annualContent?.allocations || []).filter((a) => a && typeof a.entityKey === 'string');
  const rows = annualRows.map((a) => { const annual = Math.round(Number(a.amount) || 0); const raw = Number(actualByEntity?.[a.entityKey]); const actual = Number.isFinite(raw) ? Math.round(raw) : 0; return { entityKey: a.entityKey, annual, actual, remaining: Math.max(0, annual - actual), surplus: Math.max(0, actual - annual) }; });
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0);
  const remaining = sum('remaining'); const surplus = sum('surplus');
  const c = emptyContent({ name, scope: { kind: 'ministry' }, period: { start: period.start, end: period.end, preset: 'range' } });
  c.target = { amount: remaining };
  c.allocations = rows.filter((r) => r.remaining > 0).map((r) => ({ entityKey: r.entityKey, amount: r.remaining, origin: 'derived', note: derivedRowNote(cutoff) }));
  c.distribution = { profile: 'equal' };
  c.baseline = {
    kind: 'remaining_of_annual', cutoff, annualPlanId, annualPlanRevision, derivedAt, annualPeriod: annualContent?.period ? { start: annualContent.period.start, end: annualContent.period.end } : null,
    convention: { ar: 'الهدف المتبقي = مجموع المتبقي لكل جهة (المستهدف السنوي للجهة − المحصّل حتى تاريخ الأساس، وبحد أدنى صفر). يختلف عن «مستهدف الوزارة السنوي − محصّل الوزارة» تماماً حين تتجاوز بعض الجهات مخصصها؛ ويُعرض الفائض لكل جهة منفصلاً ولا يُخصم من جهة أخرى.', en: 'The remaining target is the sum of each entity\'s remaining (its annual target − its collections to the baseline date, never below zero). It differs from «Ministry annual − Ministry actual» exactly when some entities exceed their allocation; each entity\'s surplus is shown separately and is never netted against another entity.' },
    note: { ar: `بيانات توضيحية. الأساس حتى ${dayLabel(cutoff, 'ar')}: المتبقي = المستهدف السنوي − المحصّل (المبالغ بالريال حسب تاريخ الدفع) لكل جهة. توزيع متساوٍ على الأيام المتبقية — افتراض. لا تُعاد الحسابات عند فتح الخطة.`, en: `Illustrative data. Baseline to ${dayLabel(cutoff, 'en')}: remaining = annual target − collected (receipts by payment date) for each entity. Equal distribution over the remaining days — an assumption. The figures are not recomputed when the plan is opened.` },
    entities: rows, annualTarget: sum('annual'), actualToCutoff: sum('actual'), remaining, surplus
  };
  return normalizeContent(c);
}

const isEqualWeights = (w) => w.length > 0 && w.every((x) => Math.abs(x - 1 / w.length) < 1e-9);
const safeStore = (s) => ({ v: 2, years: {}, meta: {}, ...(s && typeof s === 'object' ? s : {}), years: s?.years && typeof s.years === 'object' ? s.years : {}, meta: s?.meta && typeof s.meta === 'object' ? s.meta : {} });
const bpOf = (weights, year) => { const ap = apportion(BP_TOTAL, weights); const o = {}; ap.amounts.forEach((v, i) => { o[`${year}-${String(i + 1).padStart(2, '0')}`] = v; }); return o; };

/**
 * The content the OLD store describes for a year: allocations = the old computed entity targets rounded to whole riyals so that Σ = the old Ministry target (origin 'migrated'); the old monthly weights become a MANUAL profile
 * only when they are not all equal (else the explicit equal profile); an entity whose own weights differ from the plan's gets an entity override. Name marks it as imported from the device; period = January–December of `year`.
 * The headquarters has no row (it collects nothing; a target typed for it is not importable). Advanced inputs = the old collection rate and optional billing target.
 */
export function legacyStoreToContent(store, year = APPROPRIATION_YEAR) {
  const st = safeStore(store); const rows = entityTargetsFull(st, year).filter((r) => r.key !== HQ_KEY);
  const sumRev = rows.reduce((t, r) => t + r.revenueTarget, 0); const target = Math.round(sumRev);
  const withT = rows.filter((r) => r.revenueTarget > 0); const ap = apportion(target, withT.map((r) => r.revenueTarget));
  const allocations = withT.map((r, i) => ({ entityKey: r.key, amount: ap.amounts[i], origin: 'migrated' })).filter((a) => a.amount > 0);
  const ov = overallOf(st, year); const meta = targetMetaOf(st, year);
  const c = emptyContent({ name: `خطة ${year} — مستوردة من هذا الجهاز (${meta.versionId})`, scope: { kind: 'ministry' }, period: fiscalYearPeriod(year) });
  c.target = { amount: target };
  const totalBudget = appropriationKeys().reduce((t, k) => t + (appropriationOf(k, year)?.expAdjusted || 0), 0);
  if (!Object.values(st.years?.[year] || {}).some((e) => e && e.coverage != null) && totalBudget > 0) c.target.basis = { method: 'budget_x_coverage', coverage: ov.coverage, budget: totalBudget, at: null };
  c.allocations = allocations;
  // monthly weights: every entity has its own old weights. The PLAN's profile = the profile shared by the entities carrying the largest part of the target (equal when all are equal); an entity that differs gets its own override.
  const profOf = (r) => (isEqualWeights(r.weights) ? { key: 'equal', dist: { profile: 'equal' } } : { key: JSON.stringify(bpOf(r.weights, year)), dist: { profile: 'manual', weights: bpOf(r.weights, year) } });
  const groups = new Map();
  for (const r of withT) { const p = profOf(r); const g = groups.get(p.key) || { dist: p.dist, total: 0 }; g.total += r.revenueTarget; groups.set(p.key, g); }
  let main = { key: 'equal', dist: { profile: 'equal' }, total: -1 };
  for (const [key, g] of groups) if (g.total > main.total) main = { key, ...g }; // ties → the first group met
  c.distribution = main.dist;
  const ed = {}; for (const r of withT) { const p = profOf(r); if (p.key !== main.key) ed[r.key] = p.dist; }
  if (Object.keys(ed).length) c.entityDistributions = ed;
  c.advanced = { collectionRate: ov.collectionRate };
  if (ov.billing > 0) c.advanced.billingTarget = Math.round(ov.billing);
  return normalizeContent(c);
}

/**
 * The original metadata of the old record, VERBATIM — kept as a read-only record (`plan.legacy`); never interpreted as owner or approval: { versionId, status, owner (free text), savedBy, savedAt, source:'device-localStorage', year }.
 * A store without metadata for the year is the illustrative default version (`<year>-default`), exactly as the old pages show it.
 */
export function legacyRecord(store, year = APPROPRIATION_YEAR) {
  const st = safeStore(store); const raw = st.meta?.[year] || null; const d = targetMetaOf(st, year);
  return { versionId: d.versionId, status: raw?.status ?? d.status, owner: raw?.owner ?? null, savedBy: raw?.savedBy ?? null, savedAt: raw?.savedAt ?? null, source: 'device-localStorage', year, storageKey: LEGACY_KEY };
}
