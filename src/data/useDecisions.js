// The Decision Room as a hook: gathers what the items need from the platform (the SAME snapshot, targets, contracts, orders and checks the other pages use),
// builds the items (decisionRoom.js) and merges the stored work on them (decisionStore.js). Used by the summary on the dashboard and by /decisions.
import { useCallback, useMemo, useState } from 'react';
import { useRevenue } from '../context/RevenueContext';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../utils/useAsync';
import { useAr } from '../utils/useAr';
import { actorName } from '../utils/actor';
import { amanahFilterOptions } from './revenueLedger';
import { sourceAr, sourceEn } from './insightsEngine';
import { loadPlanInputs, approvedConfigOf } from './planInputs';
import { reportingDateFor } from './collectionGoal';
import { loadTargetStore, targetsOf } from './planTargets';
import { appropriationOf, appropriationKeys, APPROPRIATION_YEAR, HQ_KEY } from './appropriations';
import { buildDecisionItems, planSectionOf, withState, summaryOf, ROLES } from './decisionRoom';
import * as store from './decisionStore';

export function useDecisions() {
  const rev = useRevenue(); const { user } = useAuth(); const { lang } = useAr();
  const today = rev.cfg.cutoff; const year = Number(today.slice(0, 4)); const sc = rev.scopeEff;
  const [st, setSt] = useState(store.loadStore);
  const by = actorName(user, lang) || 'user';

  const labels = useMemo(() => {
    const am = new Map(amanahFilterOptions().map((a) => [a.key, { ar: a.ar, en: a.en }]));
    return { amanah: (k) => (k === HQ_KEY ? { ar: 'ديوان عام الوزارة', en: 'Ministry headquarters' } : am.get(k) || { ar: k === 'Unassigned' ? 'غير محدد الأمانة' : k, en: k }), source: (k) => ({ ar: sourceAr(k), en: sourceEn(k) }) };
  }, []);
  const visible = useMemo(() => appropriationKeys().filter((k) => (rev.org.amanahKeys ? rev.org.amanahKeys.includes(k) : true)), [rev.org]);

  const scopeReq = useMemo(() => ({ from: sc.from, to: sc.to, amanah: sc.amanah, source: sc.source, scopeType: sc.scopeType, muni: sc.muni, status: sc.status, product: sc.product, mainClass: sc.mainClass }), [sc]);
  const inputs = useAsync(async () => {
    const reporting = reportingDateFor(year, today);
    const tstore = loadTargetStore();
    const entityRows = year === APPROPRIATION_YEAR ? visible.map((k) => targetsOf(tstore, year, k, appropriationOf(k, year))) : [];
    const approvedCfg = approvedConfigOf(rev.cfg);
    const [plan, contracts, noContract, quality] = await Promise.all([
      entityRows.length && reporting ? loadPlanInputs(rev, { year, amanah: 'all', reporting, approvedCfg }) : Promise.resolve(null),
      rev.data.contracts({ amanah: sc.amanah, source: 'investment', from: '2000-01-01', to: today }),
      rev.data.anomalies(scopeReq, 1, { codes: ['investment_no_contract'] }),
      rev.data.quality({ ...scopeReq })
    ]);
    return { entityRows, reporting, plan, contracts, noContract, quality };
  }, [rev.data, scopeReq, year, today, visible, rev.cfg]);

  const built = useMemo(() => {
    if (!inputs.data || !rev.snapshot) return null;
    const { entityRows, reporting, plan, contracts, noContract, quality } = inputs.data;
    const cards = contracts?.cards || [];
    const cs = cards.length ? { count: cards.length, arrears: cards.reduce((t, c) => t + c.totals.arrears, 0), overdueInstallments: cards.reduce((t, c) => t + c.totals.overdueInstallments, 0), futureNotInvoiced: cards.reduce((t, c) => t + c.totals.futureNotInvoiced, 0) } : null;
    const suspended = (rev.cases || []).filter((c) => c.orderStatus === 'suspended' && (sc.amanah === 'all' || [].concat(sc.amanah).includes(c.amanahEn)));
    const rateByKey = new Map(entityRows.map((r) => [r.key, r.collectionRate]));
    const planSec = plan ? planSectionOf({ year, reportingDate: reporting, entityRows, collectedByKey: plan.byAmanah, collectedTotal: plan.total, monthly: plan.monthly, billedMonthly: plan.billedMonthly, standing: plan.standing, yearEnded: reporting === `${year}-12-31` }) : null;
    const snap = rev.snapshot;
    return buildDecisionItems({
      today, snapshot: snap, labels, targetRate: (k) => rateByKey.get(k) ?? rev.targets?.collectionRate?.value ?? 0.6, plan: planSec, contracts: cs, noContractCount: noContract?.total || 0,
      orders: { suspendedCount: suspended.length, suspendedAmount: suspended.reduce((t, c) => t + (c.amount || 0), 0) },
      matching: { unassignedCount: quality?.makeenUnmatched || 0, unassignedPayments: snap.receivedInPeriod?.byAmanah?.Unassigned || 0, amountConflicts: snap.quality?.amountConflictCount || 0, missingFields: snap.quality?.missingFieldCount || 0 }
    });
  }, [inputs.data, rev.snapshot, rev.cases, rev.targets, labels, today, year, sc.amanah]);

  const items = useMemo(() => (built ? withState(built.items, st, { today }) : []), [built, st, today]);
  const summary = useMemo(() => (built ? summaryOf(items, built.summary) : null), [built, items]);

  const act = useCallback((fn) => { if (!rev.canReview) return { ok: false, error: 'no_permission' }; const r = fn(st, { by, at: new Date().toISOString() }); if (r.error) return { ok: false, error: r.error }; setSt(r.store); store.saveStore(r.store); return { ok: true }; }, [rev.canReview, st, by]);
  const metaOf = (it) => ({ title: it.title, category: it.category, lane: it.lane, amount: it.amount });
  const api = useMemo(() => ({
    assign: (it, { owner, assignee, due }) => act((s, c) => store.assign(s, it.key, { owner, assignee, due }, { ...c, meta: metaOf(it) })),
    setStatus: (it, to, reason) => act((s, c) => store.transition(s, it.key, to, { reason, amountNow: it.amount ?? null }, { ...c, meta: metaOf(it) })),
    note: (it, text) => act((s, c) => store.addNote(s, it.key, text, { ...c, meta: metaOf(it) }))
  }), [act]);

  return { ready: !!built, loading: inputs.loading || !rev.snapshot, error: inputs.error, items, summary, labels, canReview: rev.canReview, by, today, ROLES, ...api };
}
