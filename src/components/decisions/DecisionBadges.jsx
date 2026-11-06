// The small badges of «غرفة القرارات» shared by the ranked row, the expanded analysis and the dashboard preview: kind · priority (+ why) · follow-up flag · financial condition · the labelled amount.
import React from 'react';
import { useAr } from '../../utils/useAr';
import { KINDS, PRIORITY_LABELS, PRIORITY_RULE } from '../../data/decisionRoom';
import { FLAGS } from '../../data/decisionStore';
import { CONDITION_LABELS, measureText } from './decisionUi';

export function useDV() {
  const { L, ar, lang, B, count, short } = useAr();
  return { L, ar, lang, B, count, short };
}

export function KindBadge({ kind }) {
  const { B } = useDV();
  return <span className={`dr-kind dr-kind--${kind}`}>{B(KINDS[kind])}</span>;
}
export function PriorityBadge({ level, why }) {
  const { B } = useDV();
  return <span className={`dr-prio dr-prio--${level}`} title={why ? B(why) : undefined}>{B(PRIORITY_LABELS[level])}</span>;
}
/** the follow-up flag chip: nothing for «not flagged» */
export function FlagChip({ flag }) {
  const { B } = useDV();
  if (!flag || flag === 'none') return null;
  return <span className={`dr-flag dr-flag--${flag}`}>{B(FLAGS[flag])}</span>;
}
/** the financial condition of the issue (from the data), shown separately from the flag */
export function ConditionChip({ condition }) {
  const { B } = useDV();
  const open = condition?.open !== false;
  return <span className={`dr-cond dr-cond--${open ? 'open' : 'closed'}`}>{B(open ? CONDITION_LABELS.open : CONDITION_LABELS.closed)}</span>;
}
/** the labelled amount: «انكشاف متأخر» + the figure */
export function Measure({ item }) {
  const { lang } = useDV();
  const m = item.measure; const full = measureText(item, lang);
  const label = m.label?.[lang] || m.label?.en || '';
  const fig = full.slice(label.length).trim();
  return <span className="dr-measure" title={full}><small>{label}</small>{fig ? <b>{fig}</b> : null}</span>;
}

/** the factors behind a priority, with their thresholds (no numeric score) */
export function PriorityWhy({ priority, id }) {
  const { L, B } = useDV();
  return (
    <div className="dr-why" id={id}>
      <b>{L('لماذا هذه الأولوية؟', 'Why this priority?')}</b>
      <ul>{priority.factors.map((f, i) => <li key={i}><span className={`dr-grade dr-grade--${f.grade}`}>{B({ ar: { high: 'مرتفع', medium: 'متوسط', low: 'منخفض' }[f.grade], en: { high: 'High', medium: 'Medium', low: 'Low' }[f.grade] })}</span> <b>{B(f.label)}</b>: {B(f.text)} <small className="muted">({B(f.threshold)})</small></li>)}</ul>
      {priority.capped && <div className="muted">{L('خُفّضت إلى متوسطة لأن الدليل ما زال يحتاج تحققاً.', 'Held at Medium because the evidence still needs verification.')}</div>}
      <div className="muted">{B(PRIORITY_RULE)}</div>
    </div>
  );
}

