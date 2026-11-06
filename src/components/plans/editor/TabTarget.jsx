import React, { useState } from 'react';
import { Field, AmountInput, Notice } from './editorBits';
import { applyBudgetAid, barStatus, clearTargetBasis, milText, normalizeNumberText, riyalText, setTargetAmount } from './editorLogic';
import { allocationSummary, budgetAid, MASKED_TARGET_LABEL } from '../../../data/plans/planRules';
import { fmtRiyadh } from '../../../data/clock';

/** «المستهدف»: the plan target typed in million riyals (exact riyals in the tooltip, rounding stated), and the budget × coverage AID — a suggestion with «استخدم هذا المبلغ» that stores only a basis NOTE. Changing the target never edits allocation rows. */
export default function TabTarget({ ctx }) {
  const { tx, lang, content, update, canEdit, reason } = ctx;
  const [cov, setCov] = useState('66');
  const year = Number((content.period?.start || '').slice(0, 4)) || undefined;
  const covNum = Number(normalizeNumberText(cov)) / 100;
  const aid = budgetAid({ scope: content.scope, year, coverage: covNum > 0 && covNum <= 2 ? covNum : 0.66 });
  const masked = !!content.target?.masked;
  const sum = allocationSummary(content); const st = barStatus({ ...sum, hasTarget: sum.hasTarget });
  const basis = content.target?.basis;
  const dis = !canEdit;
  return (
    <div className="pe-tab">
      {masked && <Notice kind="info" title={(content.target?.label || MASKED_TARGET_LABEL)[lang]}>{tx('target.maskedNote')}</Notice>}
      <Field label={`${tx('target.amount')} (${tx('unit.million')})`} htmlFor="pe-target" hint={tx('target.hint')}>
        <AmountInput id="pe-target" value={content.target?.amount ?? null} disabled={dis || masked} disabledReason={reason} label={tx('target.amount')} describedBy="pe-target-hint" onCommit={(v) => update((c) => setTargetAmount(c, v))} />
      </Field>
      <p className="pe-note">{tx('target.unitRounding')}</p>

      {!masked && (
        <div className="pe-status-line" role="status">
          {st === 'no_target' ? tx('target.statusNoTarget')
            : st === 'complete' ? tx('target.statusComplete')
              : st === 'unallocated' ? tx('target.statusUnallocated', { value: `${milText(sum.unallocated)} ${tx('unit.million')}` })
                : tx('target.statusExcess', { value: `${milText(sum.excess)} ${tx('unit.million')}` })}
          <span className="pe-note"> · {tx('target.noRowEdit')}</span>
        </div>
      )}

      <section className="pe-aid" aria-labelledby="pe-aid-h">
        <h3 id="pe-aid-h" className="pe-h3">{tx('aid.title')}</h3>
        <p className="pe-note">{tx('aid.intro')}</p>
        {aid.available ? (
          <>
            <div className="pe-aid__calc">
              <Field label={tx('aid.budget')} htmlFor="pe-aid-budget"><output id="pe-aid-budget" className="pe-out" dir="ltr" title={riyalText(aid.budget, lang)}>{milText(aid.budget)} {tx('unit.million')}</output></Field>
              <Field label={tx('aid.coverage')} htmlFor="pe-aid-cov"><span className="pe-pct"><input id="pe-aid-cov" className="input pe-pct__in" dir="ltr" inputMode="decimal" value={cov} onChange={(e) => setCov(e.target.value)} /><span className="pe-pct__sign" aria-hidden="true">%</span></span></Field>
              <Field label={tx('aid.suggestion')} htmlFor="pe-aid-sug"><output id="pe-aid-sug" className="pe-out pe-out--strong" dir="ltr" title={riyalText(aid.suggestion, lang)}>{milText(aid.suggestion)} {tx('unit.million')}</output></Field>
            </div>
            <p className="pe-note">{aid.note[lang]}{aid.missing.length ? ` ${tx('aid.missing', { n: aid.missing.length })}` : ''}</p>
            <button type="button" className="btn btn-sm" disabled={dis || masked} title={dis ? reason : undefined} onClick={() => update((c) => applyBudgetAid(c, { ...aid, basis: { ...aid.basis, at: new Date().toISOString() } }))}>{tx('aid.use')}</button>
          </>
        ) : <Notice kind="info">{aid[lang]}</Notice>}
        {basis && (
          <div className="pe-basis" role="status">
            <b>{tx('aid.basisTitle')}</b>
            <span> {tx('aid.basisText', { budget: milText(basis.budget), cov: (basis.coverage * 100).toFixed(1).replace(/\.0$/, ''), at: basis.at ? fmtRiyadh(basis.at, { time: false }) : '—' })}</span>
            {content.target.amount !== Math.round(basis.budget * basis.coverage) && <span className="pe-basis__diff"> {tx('aid.basisDiffers')}</span>}
            {basis.carriedFromYear && <span className="pe-basis__carried" id="pe-basis-carried"> {tx('aid.basisCarried', { year: year ?? '', from: basis.carriedFromYear, cov: (basis.coverage * 100).toFixed(1).replace(/\.0$/, '') })}</span>}
            <button type="button" className="pe-linkbtn" disabled={dis} onClick={() => update((c) => clearTargetBasis(c))}>{tx('aid.clearBasis')}</button>
          </div>
        )}
      </section>
    </div>
  );
}
