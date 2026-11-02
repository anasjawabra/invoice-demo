import React from 'react';
import { useL } from '../../utils/bi';
import { ORIGIN, ORIGIN_NOTE, UNLINKED_RULE, PROPOSED_RULE, PROPOSED_RULES, DATA_LIMITS, LIMIT_KIND, originOf } from '../../data/contractRules';

// «Illustrative» vs «From source», per value. A value is «From source» only when the card names the source record it was read from and lists the field (originOf);
// a verified mapping of the field to a schema column does not change the tag.
export function OriginTag({ origin, field }) {
  const { B } = useL();
  const k = originOf(origin, field);
  return <span className={`rp-origin rp-origin--${k}`} title={B(ORIGIN[k].help)}>{B(ORIGIN[k])}</span>;
}

// «Proposed rule — requires confirmation»: the tag beside any figure or label produced by a rule nobody has confirmed. `rule` is a key of PROPOSED_RULES (hover shows the rule).
export function ProposedTag({ rule }) {
  const { B } = useL();
  const r = PROPOSED_RULES[rule];
  return <span className="rp-origin rp-origin--proposed" title={r ? B(r.statement) : undefined}>{B(PROPOSED_RULE)}</span>;
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

// the proposed rule «due — no invoice linked»: what it is, and what it needs before it could be a finding
export function CandidateRuleNote({ open = false }) {
  const { B, L } = useL();
  return (
    <details className="rp-rulenote" open={open}>
      <summary>{L('Why “Due — no invoice linked” is a proposed rule', 'لماذا «مستحقة — لا فاتورة مرتبطة» قاعدة مقترحة')} — {B(PROPOSED_RULE)}</summary>
      <p>{B(UNLINKED_RULE.statement)}</p>
      <p>{L('It could become a finding only when all of these exist:', 'لا تصبح نتيجة إلا عند توفر كل ما يلي:')}</p>
      <ul>{UNLINKED_RULE.prerequisites.map((p) => <li key={p.key}>{B(p)}</li>)}</ul>
    </details>
  );
}

// what the current data can and cannot support, in words (no real figure). Each line carries its kind: not available · proposed · limited sample · demo.
export function DataLimitsNote({ open = false }) {
  const { B, L } = useL();
  return (
    <details className="rp-rulenote" open={open}>
      <summary>{L('What the current data supports — and what it does not', 'ما تدعمه البيانات الحالية — وما لا تدعمه')}</summary>
      <ul>{DATA_LIMITS.map((x) => <li key={x.key}><span className={`rp-origin rp-origin--${x.kind}`}>{B(LIMIT_KIND[x.kind])}</span> {B(x)}</li>)}</ul>
    </details>
  );
}
