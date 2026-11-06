// `/planning` — there is ONE plan page. This route only decides WHICH plan to open: the caller's effective default plan (their personal default, else the system default plan, else the first visible plan by name), docs/revenue-plans-spec.md §10.
// Old addresses land on the right plan: `/planning?year=2025` → the reference plan of that year (else the default plan), `/planning?amanah=…` keeps the Amanah as the view scope, `/planning#plan-targets` opens the plan with its editor.
// With no saved plan at all it offers «خطة جديدة». Nothing is shown while the plans load.
// GLOBAL DEFAULT (G): every entry to /planning (the menu, an address, a refresh) re-reads the shared plans first, so the redirect follows the server's `effectiveDefaultPlanId` — the caller's EXPLICIT personal default, else the global default plan (
// «خطة تحصيل 2027» unless an administrator changed it). NOTHING browser-local takes part: no last-viewed plan, no localStorage / sessionStorage preference; only an explicit /planning/:planId link opens another plan.
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAr } from '../utils/useAr';
import { usePlans } from '../data/plans/usePlans';
import { referenceFor, refreshPlans } from '../data/plans/planStore';
import { selectorRows } from '../components/plans/planUi';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** REVIEW-ONLY override of the latest data date (?demoDataDate=), the twin of ?demoToday: lets a reviewer see the stale-data state */
export function reviewDataDate(today) {
  try { const q = new URLSearchParams(window.location.search).get('demoDataDate'); return q && ISO.test(q) && q <= today ? q : null; } catch { return null; }
}

/** the plan id /planning opens, and where it goes: pure so the tests can call it */
export function defaultPlanId(snap, { year = null, referenceOf = referenceFor } = {}) {
  if (year) { const r = referenceOf(Number(year)); if (r && r.state === 'ok' && r.plan?.id) return r.plan.id; }
  const eff = snap.defaults?.effectiveDefaultPlanId;
  if (eff && (snap.plans || []).some((p) => p.id === eff)) return eff;
  const sys = (snap.plans || []).find((p) => p.isSystem); if (sys) return sys.id;
  return selectorRows(snap.plans, snap.defaults)[0]?.plan.id || null;
}

export default function Plans() {
  const snap = usePlans(); const { L, ar } = useAr(); const [sp] = useSearchParams();
  const hash = typeof window !== 'undefined' && window.location.hash === '#plan-targets';
  const [fresh, setFresh] = useState(false);
  useEffect(() => { let live = true; Promise.resolve(refreshPlans()).catch(() => null).finally(() => { if (live) setFresh(true); }); return () => { live = false; }; }, []); // a stale cache must never decide which plan opens
  if (snap.status === 'idle' || snap.status === 'loading' || (!fresh && snap.status !== 'forbidden')) return <div className="pl-page st-page" role="status" aria-busy="true"><div className="card pl-section"><div className="st-skel" style={{ height: 160 }} /></div></div>;
  if (snap.status === 'forbidden') return <div className="pl-page st-page"><div className="rv-callout rv-callout--warn" role="alert">{L('لا صلاحية لوحدة التخطيط لعرض الخطط.', 'No access to the planning module to see plans.')}</div></div>;
  const id = defaultPlanId(snap, { year: sp.get('year') });
  if (id) {
    const q = new URLSearchParams(); const am = sp.get('amanah'); if (am && am !== 'all') q.set('amanah', am);
    const qs = q.toString();
    return <Navigate replace to={`/planning/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}${hash ? '#plan-targets' : ''}`} />;
  }
  return (
    <div className="pl-page st-page pln-page" dir={ar ? 'rtl' : 'ltr'}>
      <div className="card pl-section rv-empty" role="status" id="plans-empty">
        <p>{snap.status === 'error' ? L('تعذّر تحميل الخطط.', 'The plans could not be loaded.') : L('لا توجد خطط محفوظة بعد.', 'There are no saved plans yet.')}</p>
        <Link className="btn btn-primary" to="/planning/new" id="plan-first">{L('خطة جديدة', 'New plan')}</Link>
      </div>
    </div>
  );
}
