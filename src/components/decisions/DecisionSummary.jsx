// «غرفة القرارات» on the dashboard: the four numbers and the three highest items, with the way into the full room.
import React from 'react';
import { Link } from 'react-router-dom';
import { useDecisions } from '../../data/useDecisions';
import { useAr } from '../../utils/useAr';
import { LANES, CATEGORIES } from '../../data/decisionRoom';
import { STATUSES } from '../../data/decisionStore';
import { scoreTone } from './DecisionParts';

export default function DecisionSummary() {
  const D = useDecisions(); const { L, ar, short, count } = useAr(); const B = (o) => (o == null ? '' : o[ar ? 'ar' : 'en']);
  if (D.error) return null;
  const S = D.summary; const top = D.items.filter((i) => ['new', 'in_progress'].includes(i.status)).slice(0, 3);
  return (
    <section className="card st-card rv-attention dr-summary" aria-label={L('غرفة القرارات', 'Decision room')}>
      <div className="dr-summary__head"><h2 className="rv-sec-title" style={{ margin: 0 }}>{L('غرفة القرارات', 'Decision room')}</h2><Link className="btn btn-sm" to="/decisions">{L('فتح غرفة القرارات', 'Open the decision room')} {ar ? '←' : '→'}</Link></div>
      {!S ? <div className="muted" role="status">{L('جارٍ تجهيز البنود…', 'Preparing the items…')}</div> : (
        <>
          <div className="dr-summary__nums">
            <div><b dir="ltr">{count(S.decisions)}</b><span>{L('يتطلب قراراً', 'need a decision')}</span></div>
            <div><b dir="ltr">{count(S.overdueActions)}</b><span>{L('إجراءات متأخرة عن موعدها', 'actions past due')}</span></div>
            <div><b dir="ltr">{short(S.collectible)}</b><span>{L('متأخر قابل للمتابعة (دون ما لم يحن)', 'overdue to follow up (not-yet-due excluded)')}</span></div>
            <div><b dir="ltr">{S.largest ? short(S.largest.amount) : '—'}</b><span>{S.largest ? B(S.largest.title) : L('لا بنود بمبلغ', 'no item with an amount')}</span></div>
          </div>
          <ul className="dr-summary__top">{top.map((it) => (
            <li key={it.key}><span className={`dr-score dr-score--${scoreTone(it.score)}`} dir="ltr">{it.score.toFixed(2)}</span><span><b>{B(it.title)}</b><small>{B(LANES[it.lane])} · {B(CATEGORIES[it.category])} · {B(STATUSES[it.status])}</small></span><span dir="ltr">{it.amount != null ? short(it.amount) : '—'}</span></li>
          ))}</ul>
        </>
      )}
    </section>
  );
}
