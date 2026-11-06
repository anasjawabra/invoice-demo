// The Decision Room as a hook: gathers what the items need from the platform (the SAME snapshot, previous-period comparison, plan, contracts, orders and checks the other pages use),
// builds the items (decisionRoom.js) and the charts (decisionCharts.js) and merges the stored follow-up flags (decisionStore.js). Used by the dashboard preview and by /decisions.
// PLAN: the plan section reads the CONFIGURED REFERENCE PLAN of the year (the server-owned plan store, via referenceTarget.js) at its in-force version — never a device store; an ambiguous / missing / invalid reference is an explicit
// «plan unavailable» state (no number), and every plan item carries the source plan name + version.
// Permissions: everybody with the `decisions` module sees the items of their ACCESS (geographic scope ∩ organisation); only users whose role is not read-only (rev.canDo.followup = the `decisions` module and not read-only) change a follow-up flag. Nothing is delegated to anyone.
// ACCESS: the items are built from the authorized snapshot only, `allowedAmanahs` is the user's scope (not just the organisation's list), and the follow-up flags / notes are filed PER USER (decisionStore through a user-namespaced storage;
// the seeded demo account adopts the flags it had before they were filed per user). A stored follow-up whose item is not in the current (authorized) list is never shown: items come from the data, the store only decorates them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRevenue } from '../context/RevenueContext';
import { useAuth, useAccess } from '../context/AuthContext';
import { userKeyOf } from './reportStore';
import { nsStorage, allowedEntityKeys } from './reportAccess';
import { geoScopeKey } from './geoScope';
import { useAsync } from '../utils/useAsync';
import { useAr } from '../utils/useAr';
import { actorName } from '../utils/actor';
import { amanahFilterOptions } from './revenueLedger';
import { sourceAr, sourceEn } from './insightsEngine';
import { loadPlanInputsForPlan, approvedConfigOf } from './planInputs';
import { planningBasisFromPlan } from './plans/planBasis';
import { forecastPlan } from './planForecast';
import { usePlans } from './plans/usePlans';
import { referenceFor, referenceTargets, referenceNotice, planSourceOf } from './referenceTarget';
import { HQ_KEY } from './appropriations';
import { caseSummary } from './enforcementMatching';
import { buildDecisionItems, planSectionOf, planUnavailable, withState, summaryOf } from './decisionRoom';
import { buildDecisionCharts, itemTrend } from './decisionCharts';
import * as store from './decisionStore';

const NO_PLANS = Object.freeze({ version: 0 });
/** the Decision Room / Smart Reports feed: includes the plan section (the configured reference plan) */
export function useDecisions() { return useDecisionsFeed({ plansSnap: usePlans(), withPlan: true }); }
/**
 * The DASHBOARD's feed (/insights): the very same items WITHOUT any plan lookup — no plan store subscription, no reference plan, no plan inputs, so no plan-category item exists and a change to a plan,
 * its target or the default can never reach the dashboard. Everything else (access scope, state merge, categories) is the Decision Room's own code.
 */
export function useDashboardDecisions() { return useDecisionsFeed({ plansSnap: NO_PLANS, withPlan: false }); }

function useDecisionsFeed({ plansSnap, withPlan }) {
  const rev = useRevenue(); const { user } = useAuth(); const { lang } = useAr();
  const today = rev.cfg.cutoff; const year = Number(today.slice(0, 4)); const sc = rev.scopeEff;
  const acc = useAccess(); const uk = userKeyOf(user);
  const scope = acc.effectiveScope('decisions'); const scopeKey = geoScopeKey(scope);
  const scopeKeys = useMemo(() => allowedEntityKeys(scope), [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps — the entity keys of the user's scope (null = everything)
  const allowedKeys = scopeKeys; // the Amanah / entity keys the items may name: the account's own scope for the module (null = every entity)
  const storage = useMemo(() => (typeof localStorage !== 'undefined' ? nsStorage(localStorage, uk, { adopt: ['u:demo'] }) : null), [uk]);
  const [st, setSt] = useState(() => store.loadStore(storage));
  const stFor = useRef(uk);
  useEffect(() => { if (stFor.current !== uk) { stFor.current = uk; setSt(store.loadStore(storage)); } }, [uk, storage]); // another user on this browser starts from THEIR OWN flags
  const by = actorName(user, lang) || 'user';

  const labels = useMemo(() => {
    const am = new Map(amanahFilterOptions().map((a) => [a.key, { ar: a.ar, en: a.en }]));
    return { amanah: (k) => (k === HQ_KEY ? { ar: 'ديوان عام الوزارة', en: 'Ministry headquarters' } : am.get(k) || { ar: k, en: k }), source: (k) => ({ ar: sourceAr(k), en: sourceEn(k) }) };
  }, []);
  const ref = useMemo(() => (withPlan ? referenceFor(year) : null), [year, plansSnap.version, withPlan]); // eslint-disable-line react-hooks/exhaustive-deps
  const refKey = !withPlan ? 'no-plan' : ref.referenceState === 'ok' ? `${ref.versionId}|${plansSnap.version}` : `${ref.referenceState}|${plansSnap.version}`;
  const planKeys = useMemo(() => (allowedKeys && allowedKeys.length ? allowedKeys.filter((k) => k !== HQ_KEY) : null), [allowedKeys]); // the viewer's entities (null = no narrowing)

  const scopeReq = useMemo(() => ({ from: sc.from, to: sc.to, amanah: sc.amanah, source: sc.source, scopeType: sc.scopeType, muni: sc.muni, status: sc.status, product: sc.product, mainClass: sc.mainClass }), [sc]);
  const inputs = useAsync(async () => {
    const approvedCfg = approvedConfigOf(rev.cfg);
    const planP = !withPlan ? Promise.resolve(null) : (async () => {
      const rt = referenceTargets(planKeys, { year }).reference; // the printable reference: state, source plan + version, or the reason there is none
      if (rt.state !== 'ok') return planUnavailable(rt.state, { notice: referenceNotice(rt, null), year, candidates: rt.candidates || null, reason: rt.reason || null });
      const view = ref; const source = planSourceOf(rt); const now = new Date().toISOString();
      const one = async (viewScope) => {
        const pin = await loadPlanInputsForPlan(rev, { view, reporting: today, approvedCfg, entityKeys: planKeys, viewScope });
        const basis = planningBasisFromPlan({ view, today, latestDataDate: today, entityKeys: planKeys, actual: pin?.actual || null, viewScope });
        return { basis, forecast: forecastPlan(basis, { history: pin?.history, now }) };
      };
      const main = await one(null);
      // a municipal-only viewer: the Amanahs they hold only through municipal grants (their allocation is withheld by the server) — read as the Amanah view = their municipalities' allocations
      const masked = await Promise.all((view.content?.maskedAmanahKeys || []).map(async (A) => ({ key: A, basis: (await one({ amanah: A, muni: 'all' })).basis })));
      return planSectionOf({ basis: main.basis, forecast: main.forecast, source, masked });
    })();
    const [plan, contracts, noContract, quality] = await Promise.all([
      planP,
      rev.data.contracts({ amanah: sc.amanah, source: 'investment', from: '2000-01-01', to: today }),
      rev.data.anomalies(scopeReq, 1, { codes: ['investment_no_contract'] }),
      rev.data.quality({ ...scopeReq })
    ]);
    return { plan, contracts, noContract, quality };
  }, [rev.data, scopeReq, year, today, planKeys, rev.cfg, refKey]);

  // what the items AND the charts read (one object, so they can never disagree)
  const built = useMemo(() => {
    if (!inputs.data || !rev.snapshot) return null;
    const { plan, contracts, noContract } = inputs.data;
    const cards = contracts?.cards || [];
    const cs = cards.length ? { count: cards.length, arrears: cards.reduce((t, c) => t + c.totals.arrears, 0), overdueInstallments: cards.reduce((t, c) => t + c.totals.overdueInstallments, 0), unlinkedInstallments: cards.reduce((t, c) => t + c.totals.unlinkedInstallments, 0), unlinkedAmount: cards.reduce((t, c) => t + c.totals.unlinkedAmount, 0) } : null;
    const inScope = (rev.cases || []).filter((c) => sc.amanah === 'all' || [].concat(sc.amanah).includes(c.amanahEn)); // rev.cases already holds only the user's organisation scope
    const suspended = inScope.filter((c) => c.orderStatus === 'suspended');
    const sums = inScope.map((c) => ({ c, s: caseSummary(c) }));
    const withProposed = sums.filter((x) => x.s.candidates > 0); const withUnresolved = sums.filter((x) => x.s.unresolvedRefs > 0);
    const planSec = plan; // planSectionOf(...) or planUnavailable(...): built from the reference plan in `inputs`
    const snap = rev.snapshot; const q = snap.quality || {};
    const inp = {
      today, snapshot: snap, labels, allowedAmanahs: allowedKeys, // = the account's scope (null = unrestricted)
      previous: rev.prevSnapshot ? { snapshot: rev.prevSnapshot, comparable: rev.comparison ? rev.comparison.comparable : false } : null,
      plan: planSec, contracts: cs, noContractCount: noContract?.total || 0,
      orders: { suspendedCount: suspended.length, suspendedAmount: suspended.reduce((t, c) => t + (c.amount || 0), 0), suspendedNums: suspended.map((c) => c.enforceNum), amanahs: [...new Set(inScope.map((c) => c.amanahEn))], proposedLinks: withProposed.reduce((t, x) => t + x.s.candidates, 0), proposedLinkOrders: withProposed.length, unresolvedRefs: withUnresolved.reduce((t, x) => t + x.s.unresolvedRefs, 0), unresolvedRefOrders: withUnresolved.length, linkNums: [...withProposed, ...withUnresolved].map((x) => x.c.enforceNum) },
      matching: { amountConflicts: q.amountConflictCount || 0, conflictAmount: q.conflictAmountAtStake || 0, conflictIds: q.amountConflicts || [], missingFields: q.missingFieldCount || 0, missingIds: q.missingFieldRecords || [] }
    };
    return { inp, ...buildDecisionItems(inp) };
  }, [inputs.data, rev.snapshot, rev.prevSnapshot, rev.comparison, rev.cases, allowedKeys, labels, today, year, sc.amanah]);

  const items = useMemo(() => (built ? withState(built.items, st) : []), [built, st]);
  const summary = useMemo(() => (built ? summaryOf(items, built.context) : null), [built, items]);
  const charts = useMemo(() => (built ? buildDecisionCharts(built.inp, lang) : null), [built, lang]);
  const trend = useCallback((it) => (rev.snapshot ? itemTrend(it, { snapshot: rev.snapshot, lang }) : null), [rev.snapshot, lang]);

  const act = useCallback((fn) => { if (!rev.canDo.followup) return { ok: false, error: 'no_permission' }; const r = fn(st, { by, at: new Date().toISOString() }); if (r.error) return { ok: false, error: r.error }; if (!storage) return { ok: false, error: 'no_permission' }; setSt(r.store); store.saveStore(r.store, storage); return { ok: true }; }, [rev.canDo.followup, st, by, storage]);
  const api = useMemo(() => ({
    flag: (it, { note } = {}) => act((s, c) => store.flag(s, it.key, { note }, c)),
    complete: (it, { note } = {}) => act((s, c) => store.complete(s, it.key, { note }, c)),
    unflag: (it, { note } = {}) => act((s, c) => store.unflag(s, it.key, { note }, c)),
    note: (it, text) => act((s, c) => store.addNote(s, it.key, text, c)),
    followUp: (it) => store.followUpOf(st, it.key)
  }), [act, st]);

  return { ready: !!built, loading: inputs.loading || !rev.snapshot, error: inputs.error, items, summary, charts, context: built?.context || null, trend, labels, canReview: rev.canDo.followup, by, today, ...api };
}
