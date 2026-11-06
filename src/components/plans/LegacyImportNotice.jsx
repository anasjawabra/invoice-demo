// The small, dismissible notice on the plan page: this browser still holds the retired target record for a year and the shared plans hold no plan imported from it → «استيراد كخطة».
// It READS the old browser value (legacyStore.readLegacyStore) and calls importLegacyPlan(year, store); the plan is created ownerless with the original metadata kept, appears in the selector, and the browser value is
// never deleted or modified. A refused import (400 / 403 / 409 / 422) is shown plainly. Nothing is rendered when there is nothing to import, for a person who may not import, or after dismissal.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAr } from '../../utils/useAr';
import { readLegacyStore } from '../../data/plans/legacyStore';
import { importLegacyPlan } from '../../api/plansClient';
import { refreshPlans } from '../../data/plans/planStore';
import { legacyImportCandidates, canImportLegacy, runLegacyImport, LEGACY_TEXT as T } from './legacyImport';
import { pickL } from './planUi';

export default function LegacyImportNotice({ plans, capabilities, storage = undefined, importer = importLegacyPlan, refresh = refreshPlans }) {
  const { lang } = useAr();
  const store = useMemo(() => readLegacyStore(storage), [storage]);
  const [hidden, setHidden] = useState([]); const [busy, setBusy] = useState(null); const [problems, setProblems] = useState([]); const [done, setDone] = useState(null);
  if (!canImportLegacy(capabilities) && !done) return null;
  const items = legacyImportCandidates(store, plans).filter((c) => !hidden.includes(c.year));
  if (!items.length && !done) return null;
  const run = async (c) => {
    setBusy(c.year); setProblems([]); setDone(null);
    const r = await runLegacyImport({ year: c.year, store, record: c.record, plans, importer, refresh });
    if (r.kind === 'failed') setProblems(r.problems); else setDone(r);
    setBusy(null);
  };
  const L = (o) => pickL(o, lang);
  return (
    <div className="pln-legacy-wrap" id="plan-legacy-import">
      {items.map((c) => (
        <div key={c.year} className="pl-notice pl-notice--info pln-legacy" role="status" data-year={c.year}>
          <span>{L(T.notice(c.year))} <small className="pl-sub2">{L(T.keep)}</small></span>
          <span className="pln-legacy__act">
            <button type="button" className="btn btn-sm btn-primary" disabled={busy != null} onClick={() => run(c)}>{busy === c.year ? L(T.importing) : L(T.import)}</button>
            <button type="button" className="btn btn-sm" disabled={busy != null} onClick={() => setHidden((h) => [...h, c.year])}>{L(T.dismiss)}</button>
          </span>
        </div>
      ))}
      {problems.length > 0 && <div className="rv-callout rv-callout--bad" role="alert" id="plan-legacy-problems"><b>{L(T.failed)}</b><ul className="pln-problems">{problems.map((p, i) => <li key={i}>{L(p)}</li>)}</ul></div>}
      {done && done.kind === 'ok' && <div className="pl-notice pl-notice--good" role="status" id="plan-legacy-done">{L(T.done(done.plan?.name || ''))} {done.plan?.id && <Link to={`/planning/${encodeURIComponent(done.plan.id)}`}>{L(T.open)}</Link>}</div>}
      {done && done.kind === 'already' && <div className="pl-notice pl-notice--info" role="status" id="plan-legacy-done">{L(T.already(done.plan?.name || ''))} {done.plan?.id && <Link to={`/planning/${encodeURIComponent(done.plan.id)}`}>{L(T.open)}</Link>}</div>}
    </div>
  );
}
