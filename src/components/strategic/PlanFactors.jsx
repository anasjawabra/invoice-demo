// Section 6 · «العوامل المؤثرة في فجوة المستهدف» (replaces the old «reasons the target is missed» list) — three SEPARATE, labelled groups: confirmed facts (amounts and periods from records), hypotheses that need verification,
// and missing data. The indicators are separate figures: they do not add up and are not causes (no waterfall). Content: src/data/planningFactors.js.
import React from 'react';
import { Link } from 'react-router-dom';
import { useAr } from '../../utils/useAr';
import { FACTOR_GROUPS, FACTORS_TITLE, FACTORS_NOT_ADDITIVE } from '../../data/planningFactors';

export default function PlanFactors({ factors }) {
  const { L, ar } = useAr(); const T = (o) => (o == null ? '' : ar ? o.ar : o.en);
  if (!factors || factors.empty) {
    return (
      <section id="plan-factors" className="card pl-section" aria-labelledby="plan-factors-h">
        <h2 id="plan-factors-h" className="pl-h2">{T(FACTORS_TITLE.gap)}</h2>
        <p className="pl-sub" role="status">{L('لا مستهدف أو لا بيانات فعلية لهذا الاختيار، فلا عوامل تُعرض.', 'There is no target or no actual data for this selection, so no factors are shown.')}</p>
      </section>
    );
  }
  const title = factors.mode === 'support' ? FACTORS_TITLE.support : FACTORS_TITLE.gap;
  return (
    <section id="plan-factors" className="card pl-section" aria-labelledby="plan-factors-h">
      <h2 id="plan-factors-h" className="pl-h2">{T(title)}<small>{L('حقائق وفرضيات وبيانات ناقصة — منفصلة', 'facts, hypotheses and missing data — kept apart')}</small></h2>
      <p className="pl-sub" role="note">{T(FACTORS_NOT_ADDITIVE)}</p>
      <div className="pl-factors">
        {FACTOR_GROUPS.map((g) => (
          <div key={g.id} className={`pl-fgroup pl-fgroup--${g.id}`} data-group={g.id}>
            <h3 className="pl-h3">{T(g.title)}</h3>
            <p className="pl-note" style={{ margin: 0 }}>{T(g.sub)}</p>
            <ul className="pl-flist">
              {factors[g.id].map((it) => (
                <li key={it.id} data-factor={it.id}>{T(it.text)}{it.link && it.link.to.startsWith('#') ? <> <a className="rv-link" href={it.link.to}>{T(it.link)}</a></> : it.link ? <> <Link className="rv-link" to={it.link.to}>{T(it.link)}</Link></> : null}</li>
              ))}
              {factors[g.id].length === 0 && <li className="pl-na">{L('لا بنود.', 'No items.')}</li>}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
