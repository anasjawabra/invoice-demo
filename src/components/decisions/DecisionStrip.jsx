// The SMALL summary strip: open financial issues · flagged for follow-up · need evidence verification. A financial total appears ONLY when the data layer says the populations
// are additive and deduplicated (summary.financialTotal non-null), with its label, basis, share of the scope total and the overlap note; otherwise nothing is shown for it.
import React from 'react';
import { useAr } from '../../utils/useAr';
import { stripOf } from './decisionUi';

export default function DecisionStrip({ summary }) {
  const { L, B, count, short } = useAr();
  const S = stripOf(summary); if (!S) return null;
  return (
    <section className="dr-strip" aria-label={L('ملخص موجز', 'Summary')}>
      <dl className="dr-strip__tiles">
        {S.tiles.map((t) => <div key={t.key} className="dr-strip__tile"><dt>{B(t.label)}</dt><dd>{count(t.count)}</dd></div>)}
        {S.total && (
          <div className="dr-strip__tile dr-strip__tile--total">
            <dt>{B(S.total.label)}</dt>
            <dd>{short(S.total.amount)}{S.total.share != null ? <small> · {(S.total.share * 100).toFixed(1)}% {L('من متأخر النطاق', 'of the scope overdue')}</small> : null}</dd>
            <dd className="dr-strip__basis">{B(S.total.basis)}</dd>
          </div>
        )}
      </dl>
      {S.overlapNote && <div className="muted dr-strip__foot">{B(S.overlapNote)}</div>}
    </section>
  );
}
