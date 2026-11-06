// REFERENCE PLAN — which plan the NON-plan consumers (Decision Room, dashboard target, Smart Reports, assistant, fixed reports, viewer targets) read for a calendar year. Spec §2 «Reference plan».
// Pure. An explicit reference per year wins; with none configured a SINGLE eligible plan is used (and labelled so); several eligible plans are AMBIGUOUS and surfaced — a plan is never chosen silently among several.
// Eligible = SAVED plans whose period overlaps the calendar year (spec §10: every saved plan is eligible — there is no lifecycle).
// A configured plan that is no longer eligible is surfaced as reference_invalid, never silently replaced.
import { periodsOverlap, fiscalYearPeriod } from './planMath.js';
import { planView } from './planRules.js';

export const REFERENCE_SOURCE_LABELS = Object.freeze({
  configured: Object.freeze({ ar: 'الخطة المرجعية المحددة', en: 'The configured reference plan' }),
  only_eligible: Object.freeze({ ar: 'الخطة الوحيدة المؤهلة', en: 'The only eligible plan' })
});

const summary = (p) => { const v = planView(p, 'inForce'); return v ? { planId: p.id, name: v.name, versionId: v.versionId, versionNumber: v.versionNumber, scope: v.scope, period: v.period, origin: p.origin, isSystem: !!p.isSystem, plan: p } : null; };

/** a saved plan record (it carries its `content`) */
const isSaved = (p) => !!p && !!p.content && typeof p.content === 'object';
/** the SAVED plans whose period overlaps the calendar year */
export function eligibleReferencePlans(year, plans = []) {
  const y = fiscalYearPeriod(year);
  return (plans || []).filter(isSaved).filter((p) => { const v = planView(p, 'inForce'); return v && periodsOverlap(v.period, y); });
}

/**
 * @param {{ year: number, plans: object[] (plan records), references: { [year]: { planId, setBy, at } } }} input
 * @returns {{ state:'ok', plan, view, source:'configured'|'only_eligible', sourceLabel:{ar,en}, versionId, name }
 *   | { state:'ambiguous', candidates: [{ planId, name, versionId, versionNumber, scope, period, origin, plan }] }
 *   | { state:'none' }
 *   | { state:'reference_invalid', reason:'not_found'|'period_mismatch', planId, configured }}
 */
export function resolveReferencePlan({ year, plans = [], references = {} } = {}) {
  const eligible = eligibleReferencePlans(year, plans);
  const conf = references?.[year] || null;
  if (conf && conf.planId) {
    const p = (plans || []).find((x) => x && x.id === conf.planId);
    let reason = null;
    if (!p) reason = 'not_found';
    else if (!eligible.includes(p)) reason = 'period_mismatch'; // a saved plan has no lifecycle: only its period (or its absence) can make it ineligible
    if (reason) return { state: 'reference_invalid', reason, planId: conf.planId, configured: conf };
    const view = planView(p, 'inForce');
    return { state: 'ok', plan: p, view, source: 'configured', sourceLabel: REFERENCE_SOURCE_LABELS.configured, versionId: view.versionId, name: view.name };
  }
  if (eligible.length === 1) {
    const p = eligible[0]; const view = planView(p, 'inForce');
    return { state: 'ok', plan: p, view, source: 'only_eligible', sourceLabel: REFERENCE_SOURCE_LABELS.only_eligible, versionId: view.versionId, name: view.name };
  }
  if (eligible.length > 1) return { state: 'ambiguous', candidates: eligible.map(summary).filter(Boolean) };
  return { state: 'none' };
}
