import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAsync } from '../../utils/useAsync';
import { furas } from '../../api/furasClient';
import { furasItems } from '../../data/furasDecisions';
import { LANES } from '../../data/decisionRoom';
import { RecordState } from '../../components/record/RecordPage';
import { DatasetBanner, Tag } from '../../components/furas/FurasParts';

// Decision Room in FURAS DATASET MODE: read-only items about the data itself. The generated-demo items need data the exports do not contain, so they are not built.
export default function FurasDecisionRoom() {
  const { L, B, ar, count, short } = useL();
  const { data: I, error } = useAsync(() => furas.decisions(), []);
  const [lane, setLane] = useState('decision'); const [open, setOpen] = useState(null);
  const items = useMemo(() => (I ? furasItems(I) : []), [I]);
  const fig = (f) => (f.kind === 'money' ? short(f.value) : count(f.value));
  return (
    <div className="st-page" dir={ar ? 'rtl' : 'ltr'}>
      <header className="st-head"><div>
        <h1 className="page-title" style={{ margin: 0 }}>{L('Decision room', 'غرفة القرارات')} <span className="rv-badge rv-badge--sm rv-badge--ok">{L('Furas exports (local)', 'تصديرات فرص (محلية)')}</span></h1>
        <div className="muted" style={{ fontSize: 13 }}>{L('Items about the exported data itself — what needs a decision or a request to the data owner. Read-only.', 'بنود عن البيانات المصدَّرة نفسها — ما يحتاج قراراً أو طلباً إلى مالك البيانات. للقراءة فقط.')}</div>
      </div></header>
      {error && !I && <RecordState error={error} onRetry={() => window.location.reload()} kind={L('Decision room', 'غرفة القرارات')} />}
      <DatasetBanner S={I ? { dataset: I.dataset } : null} />
      <div className="rv-callout" role="note" style={{ fontSize: 12.5 }}>{L('Overdue stock, aged debt, collection targets, enforcement, “due — no invoice linked” and every figure that needs collected amounts are not available in the current data, so no such item is shown in this mode.', 'المتأخرات والديون المتقادمة وأهداف التحصيل والتنفيذ و«مستحقة — لا فاتورة مرتبطة» وكل مؤشر يحتاج مبالغ محصّلة غير متاحة في البيانات الحالية، لذا لا يُعرض أي بند منها في هذا الوضع.')}</div>
      {I && (
        <>
          <div className="sr-tabs" role="tablist">{Object.keys(LANES).map((k) => <button key={k} type="button" role="tab" aria-selected={lane === k} className={`sr-tab ${lane === k ? 'is-active' : ''}`} onClick={() => { setLane(k); setOpen(null); }}><b>{B(LANES[k])}</b> ({items.filter((i) => i.lane === k).length})</button>)}</div>
          <ul className="dr-list" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {items.filter((i) => i.lane === lane).map((it) => (
              <li key={it.key} className="card card-pad">
                <button type="button" className="btn btn-ghost" aria-expanded={open === it.key} onClick={() => setOpen(open === it.key ? null : it.key)} style={{ width: '100%', textAlign: 'start' }}><b>{B(it.title)}</b></button>
                <div className="muted" style={{ fontSize: 13 }}>{B(it.problem)}</div>
                {open === it.key && (
                  <div className="dr-detail" style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                    <div className="rv-tiles">{it.figures.map((f, i) => <div key={i} className="rv-tile"><div className="rv-tile__label">{B(f.label)}</div><div className="rv-tile__value" dir="ltr">{fig(f)}</div></div>)}</div>
                    <div><b>{L('Cause', 'السبب')}</b> <Tag tone={it.cause.status === 'confirmed' ? '' : 'proposed'}>{{ confirmed: L('Confirmed by the data', 'مؤكد بالبيانات'), hypothesis: L('Hypothesis', 'فرضية'), unknown: L('Unknown', 'غير معروف') }[it.cause.status]}</Tag> {B(it.cause.text)}</div>
                    <div><b>{L('Recommendation', 'التوصية')}</b> {B(it.recommendation)}</div>
                    {it.decisionNeeded && <div><b>{L('Decision needed', 'القرار المطلوب')}</b> {B(it.decisionNeeded)}</div>}
                    <div>{it.evidence.map((e) => <Link key={e.to} to={e.to}>{B(e.label)}</Link>)}</div>
                  </div>)}
              </li>))}
            {!items.some((i) => i.lane === lane) && <li className="muted">{L('No item in this lane.', 'لا بنود في هذا المسار.')}</li>}
          </ul>
        </>)}
    </div>
  );
}
