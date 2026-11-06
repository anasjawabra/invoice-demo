// The REMAINING-2026 collection plan («خطة تحصيل المتبقي من 2026») — computed ONCE from the data engine, then frozen in the plan (docs/revenue-plans-spec.md «Implementation notes — G»).
//
// Why a separate module: the figures come from the DATA ENGINE (the demo world's receipts), not from the plans store. They are computed with the SAME function and configuration the planning page uses (`loadPlanInputsForPlan` over the annual
// plan's period, the approved calculation config, receipts by payment date, any invoice), so the numbers reconcile with the 2026 plan's page at the same cut-off. Nothing is ever invented: when the engine cannot be reached (or its clock is
// before the baseline cut-off) the plan is simply not created and the NEXT plans request tries again. Once created, the plan is never recomputed, moved or overwritten (idempotent by `seedKey`; a restart / a second request / a concurrent request
// creates nothing). The first authenticated plans request triggers it (server/plansApi.js); tests inject a provider with `setRemainingProviderForTests`.
import { currentStore } from '../store.js';
import { snapshot, series } from '../engine.js';
import { loadPlanInputsForPlan, approvedConfigOf } from '../../src/data/planInputs.js';
import { DEFAULT_CONFIG } from '../../src/data/revenueMetrics.js';
import { REMAINING_PLAN_2026, deriveRemainingPlanContent } from '../../src/data/plans/planDefaults.js';
import { nowIso, ensureRemaining2026, SEED_PLAN_ID } from './store.js';

/** the actual collections by entity of the ANNUAL plan's period up to `cutoff` (receipts by payment date, any invoice) — the planning page's own function over the engine, unrestricted. → { byEntity, total } | null */
export async function engineActualsToCutoff(annualContent, cutoff) {
  const st = currentStore();
  if (!st || !st.meta || !st.meta.today || st.meta.today < cutoff) return null; // the engine's clock has not reached the baseline cut-off: never invent
  const cfg = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: st.meta.today });
  const rev = { data: { snapshot: async (scope, o = {}) => snapshot(st, { scope, cfg: o.cfg || cfg }), series: async (scope, o = {}) => series(st, { scope, cfg: o.cfg || cfg }) } };
  const view = { planId: null, versionId: null, period: annualContent.period, scope: annualContent.scope, content: annualContent };
  const D = await loadPlanInputsForPlan(rev, { view, reporting: cutoff, approvedCfg: cfg, entityKeys: null, viewScope: null });
  if (!D || !D.actual || !D.actual.byEntity) return null;
  return { byEntity: D.actual.byEntity, total: D.actual.total };
}

let provider = engineActualsToCutoff;
/** tests: replace the source of the actuals (`(annualContent, cutoff) => Promise<{byEntity}|null>`); no argument restores the engine */
export const setRemainingProviderForTests = (fn) => { provider = typeof fn === 'function' ? fn : engineActualsToCutoff; };

// per store (properties on the store instance): `remainingSettled` = it holds the plan · `remainingPending` = the in-flight creation (concurrent first requests share one computation)
/**
 * Make sure the store holds the remaining-2026 plan: a no-op when it already does (by `seedKey`). Otherwise derive it from the annual 2026 system plan and the engine's actuals to the baseline cut-off and insert it in ONE atomic mutation
 * (re-checking the key inside, so two racing callers create one). Never throws (a failure leaves the store untouched and the next request retries). Returns true when this call created the plan.
 */
export function ensureRemainingPlan(store) {
  if (!store || store.remainingSettled) return Promise.resolve(false);
  if (store.db.plans.some((p) => p.seedKey === REMAINING_PLAN_2026.seedKey)) { store.remainingSettled = true; return Promise.resolve(false); }
  const annual = store.db.plans.find((p) => p.id === SEED_PLAN_ID && p.content && p.content.period && p.content.period.start === '2026-01-01');
  if (!annual) return Promise.resolve(false); // no annual 2026 plan to derive from (an empty / test store)
  if (store.remainingPending) return store.remainingPending;
  const run = (async () => {
    const act = await provider(annual.content, REMAINING_PLAN_2026.baselineCutoff);
    if (!act || !act.byEntity) return false;
    const now = nowIso();
    return store.mutate((db) => {
      const a = db.plans.find((p) => p.id === annual.id) || annual;
      const content = deriveRemainingPlanContent({ annualContent: a.content, actualByEntity: act.byEntity, cutoff: REMAINING_PLAN_2026.baselineCutoff, period: REMAINING_PLAN_2026.period, annualPlanId: a.id, annualPlanRevision: a.revision, derivedAt: now });
      return ensureRemaining2026(db, content, now).created;
    });
  })().then((created) => { if (store.db.plans.some((p) => p.seedKey === REMAINING_PLAN_2026.seedKey)) store.remainingSettled = true; return created; }, () => false).finally(() => { store.remainingPending = null; });
  store.remainingPending = run; return run;
}
