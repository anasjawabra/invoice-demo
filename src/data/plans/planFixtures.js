// PLAN FIXTURES for tests and offline scripts (export parity, deck builders): plan RECORDS in the exact shape the data service stores (docs/revenue-plans-spec.md §10), built from the real seed content
// (planDefaults.seedPlanContent) and the real rules (planRules). Pure: nothing here touches a store — the caller injects the result with planStore.setPlansForTest. Never imported by application code.
import { seedPlanContent } from './planDefaults.js';
import { normalizeContent, emptyContent } from './planRules.js';
import { fiscalYearPeriod, apportion } from './planMath.js';
import { entityUniverse } from './planAccess.js';
import { APPROPRIATION_YEAR } from '../appropriations.js';

export const SEED_ID = 'plan-5eed2026';
const AT = '2026-01-01T00:00:00.000Z';
const SYSTEM = { system: true };

/** a saved plan record in the exact shape the data service presents (spec §10): `{ id, name, isSystem, origin, content, createdBy, createdAt, updatedAt, lastEditedBy, revision, versions:[meta], legacy, state:'active' }` */
export function planRecord({ id, content, origin = 'user', isSystem = false, createdBy = { userId: 'u-test', name: 'Test user' }, revision = 1, legacy = null, at = AT } = {}) {
  const versions = Array.from({ length: revision }, (_, i) => ({ n: i + 1, revision: i + 1, savedBy: createdBy, savedAt: at }));
  return { id, name: content?.name ?? '', isSystem, origin, content, createdBy, createdAt: at, updatedAt: at, lastEditedBy: createdBy, revision, versions, versionCount: versions.length, legacy, state: 'active' };
}
/** the illustrative system plan for `year` (Ministry scope, equal profile), exactly as the data service seeds it */
export function seedPlanRecord(year = APPROPRIATION_YEAR) { return planRecord({ id: SEED_ID, content: seedPlanContent(year, { at: AT }), origin: 'seed', isSystem: true, createdBy: null }); }
export const referenceEntry = (planId, at = AT) => ({ planId, setBy: SYSTEM, at });

/** an OLD browser store (the retired `v2` shape, read-only legacy input of the import) for tests of the legacy mapping: `coverage` = the overall coverage typed for `year`; `meta` = the version record; `years` = per-entity typed values */
export function legacyStoreFixture({ year = APPROPRIATION_YEAR, coverage = null, collectionRate = null, billing = null, meta = null, years = null, override = null, v = 2 } = {}) {
  const st = { v, years: {}, meta: {} };
  if (coverage != null || collectionRate != null || billing != null) st.overall = { [year]: { ...(coverage != null ? { coverage } : {}), ...(collectionRate != null ? { collectionRate } : {}), ...(billing != null ? { billing } : {}), savedAt: AT, savedBy: 'tester' } };
  if (years) st.years = { [year]: years };
  if (meta) st.meta = { [year]: meta };
  if (override != null) st.override = { [year]: override };
  return st;
}

/**
 * A custom saved plan: `allocations` { entityKey: amount } (target = their Σ unless `target`), scope Ministry (default) or entities, calendar-year period of `year` (or `period`), equal profile (or `distribution`).
 * Returns a plan record.
 */
export function customPlanRecord({ id = 'plan-c0000001', name = 'خطة اختبار', allocations, target = null, year = APPROPRIATION_YEAR, period = null, scope = { kind: 'ministry' }, distribution = { profile: 'equal' }, origin = 'user', municipalAllocations = null } = {}) {
  const al = Object.entries(allocations || {}).map(([entityKey, amount]) => ({ entityKey, amount, origin: 'manual' }));
  const c = emptyContent({ name, scope, period: period || fiscalYearPeriod(year) });
  c.target = { amount: target != null ? target : al.reduce((t, a) => t + a.amount, 0) };
  c.allocations = al; c.distribution = distribution;
  if (municipalAllocations) c.municipalAllocations = municipalAllocations;
  return planRecord({ id, content: normalizeContent(c), origin });
}
/** the arguments of setPlansForTest for "the seed plan is the 2026 reference" (what a fresh data service holds) */
export function seededStore(year = APPROPRIATION_YEAR, extraPlans = []) { return { plans: [seedPlanRecord(year), ...extraPlans], references: { [year]: referenceEntry(SEED_ID) } }; }
export { entityUniverse, apportion };
