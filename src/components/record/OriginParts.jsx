import React from 'react';
import { useL } from '../../utils/bi';
import { ORIGIN, ORIGIN_NOTE, UNLINKED_RULE, originOf } from '../../data/contractRules';

// «Illustrative» vs «From source», per value. A value is «From source» only when the card names the source record it was read from and lists the field (originOf);
// a verified mapping of the field to a schema column does not change the tag.
export function OriginTag({ origin, field }) {
  const { B } = useL();
  const k = originOf(origin, field);
  return <span className={`rp-origin rp-origin--${k}`} title={B(ORIGIN[k].help)}>{B(ORIGIN[k])}</span>;
}

// the one-paragraph statement under a contract page header and above the contracts list
export function OriginNote({ origin }) {
  const { B, L } = useL();
  const n = origin?.sourceBacked?.length || 0;
  return (
    <div className="rp-limit rp-originnote" role="note">
      <span className="rp-origin rp-origin--illustrative">{B(ORIGIN.illustrative)}</span> {B(ORIGIN_NOTE)}
      {n === 0 ? ` ${L('Values from a source on this page: none.', 'القيم من مصدر في هذه الصفحة: لا شيء.')}` : ''}
    </div>
  );
}

// the candidate rule «due — no invoice linked»: what it is, and what it needs before it could be a finding
export function CandidateRuleNote({ open = false }) {
  const { B, L } = useL();
  return (
    <details className="rp-rulenote" open={open}>
      <summary>{L('Why “Due — no invoice linked” is only a candidate rule', 'لماذا «مستحقة — لا فاتورة مرتبطة» قاعدة مرشَّحة فقط')}</summary>
      <p>{B(UNLINKED_RULE.statement)}</p>
      <p>{L('It could become a finding only when all of these exist:', 'لا تصبح نتيجة إلا عند توفر كل ما يلي:')}</p>
      <ul>{UNLINKED_RULE.prerequisites.map((p) => <li key={p.key}>{B(p)}</li>)}</ul>
    </details>
  );
}
