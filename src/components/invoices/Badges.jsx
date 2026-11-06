// Small badges of the invoice lists. PriorityBadge: High / Medium / Low (never a number) with an accessible explanation (a button that opens the rule that gave the level).
// ExclusionBadge: a SEPARATE compact badge for an excluded invoice — never merged into the payment status.
import React, { useEffect, useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import { priorityAria, priorityText } from './listLogic';

export function PriorityBadge({ priority }) {
  const { L, ar } = useL(); const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!priority || !priority.level) return <span className="muted" title={L('Priority not available', 'الأولوية غير متاحة')}>—</span>;
  const why = ar ? priority.why?.ar : priority.why?.en;
  return (
    <span className="il-prio-wrap" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className={`il-prio il-prio--${priority.level}`} aria-expanded={open} aria-label={priorityAria(priority, ar)} onClick={() => setOpen((x) => !x)}>
        {priorityText(priority.level, ar)}<span className="il-prio__i" aria-hidden="true">i</span>
      </button>
      {open && (
        <span className="il-pop" role="note">
          <b>{L('Why this priority', 'سبب هذه الأولوية')}</b>
          {why && <span>{why}</span>}
          {Array.isArray(priority.factors) && priority.factors.length > 0 && (
            <ul>{priority.factors.map((f, i) => <li key={i}><span>{ar ? f.label?.ar : f.label?.en}</span> <b dir="auto">{typeof f.value === 'object' && f.value ? (ar ? f.value.ar : f.value.en) : String(f.value ?? '')}</b></li>)}</ul>
          )}
        </span>
      )}
    </span>
  );
}

export function ExclusionBadge({ reason, amount }) {
  const { L, ar } = useL();
  const why = reason ? (ar ? reason.reasonAr : reason.reasonEn) : '';
  return <span className="il-excl" title={why || undefined} aria-label={`${L('Excluded', 'مستبعدة')}${why ? `: ${why}` : ''}`}>{L('Excluded', 'مستبعدة')}</span>;
}
