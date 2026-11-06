// The `targets` object a SIGNED-IN VIEWER's reports read (revenue plans, spec §2 «Reference plan» / §9).
// One target everywhere: Smart Reports, the assistant, the fixed reports, the analysis tasks, the exports and the Decision Room all take the target from the CONFIGURED REFERENCE PLAN of the year
// (the plan store → referenceTarget.js), at its in-force version — never from the browser, never a silent pick among several plans, never a sum of overlapping plans.
//   · no organisation narrowing  → DEFAULT_TARGETS itself (the plan's own target for the viewer: the Ministry total for a Ministry plan)
//   · an organisation (a restricted viewer) → the reference plan's allocations of THEIR entities only (the server also masks the plan record for them), labelled «إجمالي الجهات المتاحة لك» /
//     "Total of the entities available to you". A municipal-only viewer never receives the Amanah's full target (spec §9).
// The object keeps the synchronous getter shape; `targets.reference` carries the state (ok · ambiguous · none · reference_invalid · not_loaded · no_access) and the source plan name + version — an unavailable
// target has `collectionAmountAnnual.value === null` (never 0).
import { DEFAULT_TARGETS } from './revenueMetrics';
import { APPROPRIATION_YEAR } from './appropriations';
import { referenceTargets, targetsForScope, AVAILABLE_LABEL } from './referenceTarget';

export { AVAILABLE_LABEL, targetsForScope };
export const MINISTRY_LABEL = { ar: 'الوزارة (كل الجهات)', en: 'The Ministry (all entities)' };

/** @param entityKeys the viewer's entity (Amanah) keys, or null/undefined for no narrowing  @returns a `targets` object (revenueMetrics shape) + { scopeKind, scopeLabel, scopeEntityKeys, reference } */
export function viewerTargets(entityKeys = null, { year = APPROPRIATION_YEAR, fresh = false } = {}) {
  // `fresh` = a NEW object even without narrowing (React contexts: a new object is what makes dependants recompute when the plan store changes); otherwise DEFAULT_TARGETS itself
  if (!entityKeys || !entityKeys.length) return year === APPROPRIATION_YEAR && !fresh ? DEFAULT_TARGETS : referenceTargets(null, { year, base: { fiscalYear: DEFAULT_TARGETS.fiscalYear, collectionRate: DEFAULT_TARGETS.collectionRate } });
  return referenceTargets(entityKeys, { year, base: { fiscalYear: DEFAULT_TARGETS.fiscalYear, collectionRate: DEFAULT_TARGETS.collectionRate } });
}

/** the label a surface prints next to a target: null for the Ministry total (the default wording), the «available entities» label for a restricted viewer */
export const targetScopeLabel = (targets) => (targets?.scopeKind === 'available' ? AVAILABLE_LABEL : null);
