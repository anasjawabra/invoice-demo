// The compact ranked row of «غرفة القرارات»: title · category + entity · kind · priority with its explanation · the labelled amount · follow-up flag · «عرض التحليل».
// The expanded analysis is in DecisionDetail.jsx. No owner, due date or assignment exists anywhere.
import React, { useState } from 'react';
import { VERIFICATION_LABELS } from '../../data/decisionRoom';
import { categoryLabel } from './decisionUi';
import DecisionDetail from './DecisionDetail';
import { useDV, KindBadge, PriorityBadge, FlagChip, ConditionChip, Measure, PriorityWhy } from './DecisionBadges';
export { useDV, KindBadge, PriorityBadge, FlagChip, ConditionChip, Measure, PriorityWhy };

export function ItemRow({ it, D, open, onToggle, titleOf }) {
  const { L, lang, B } = useDV(); const [why, setWhy] = useState(false);
  const bodyId = `dr-body-${it.key.replace(/[^a-z0-9]/gi, '_')}`; const whyId = `${bodyId}-why`;
  const toggleFromRow = (e) => { if (e.target.closest('button, a, input, textarea, select, summary, details')) return; onToggle(); };
  const fl = it.followUp?.flag || 'none';
  return (
    <article className={`dr-item dr-item--${it.priority.level}${open ? ' is-open' : ''}`} id={`dr-${it.key.replace(/[^a-z0-9]/gi, '_')}`} aria-label={B(it.title)}>
      <div className="dr-row" onClick={toggleFromRow}>
        <div className="dr-row__main">
          <h3 className="dr-row__title">{B(it.title)}</h3>
          <div className="dr-row__meta">
            <span>{categoryLabel(it, lang)}</span><span aria-hidden="true">·</span><span>{B(it.affected?.label)}</span>
            <KindBadge kind={it.kind} />
            {it.verification === 'needs_verification' && <span className="dr-verify" title={B(VERIFICATION_LABELS.needs_verification)}>{L('يحتاج تحقق الدليل', 'Evidence to verify')}</span>}
          </div>
        </div>
        <div className="dr-row__prio">
          <PriorityBadge level={it.priority.level} why={it.priority.why} />
          <button type="button" className="dr-linkbtn" aria-expanded={why} aria-controls={whyId} onClick={() => setWhy((v) => !v)}>{L('لماذا؟', 'Why?')}</button>
        </div>
        <div className="dr-row__amt"><Measure item={it} /></div>
        <div className="dr-row__flags">
          <FlagChip flag={fl} />
          {fl !== 'none' && <ConditionChip condition={it.condition} />}
        </div>
        <button type="button" className="btn btn-sm dr-row__open" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          {open ? L('إخفاء التحليل', 'Hide the analysis') : L('عرض التحليل', 'View the analysis')}
        </button>
      </div>
      {why && <PriorityWhy priority={it.priority} id={whyId} />}
      {open && <DecisionDetail it={it} D={D} id={bodyId} titleOf={titleOf} />}
    </article>
  );
}
