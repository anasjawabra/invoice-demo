import React from 'react';
import { Icon } from './editorBits';
import { CHECK_FIX, entityName, milText, bpText } from './editorLogic';

/** the one-line explanation printed under a check (amounts in million riyals) */
export function checkDetail(check, tx, lang) {
  const p = check.params || {}; const u = tx('unit.million'); const m = (v) => `${milText(v)} ${u}`;
  switch (check.id) {
    case 'target_positive': return p.target > 0 ? tx('check.target.ok', { value: m(p.target) }) : tx('check.target.bad');
    case 'allocation_complete':
      if (check.ok) return tx('check.alloc.ok', { value: m(p.target) });
      return p.excess > 0 ? tx('check.alloc.excess', { value: m(p.excess) }) : tx('check.alloc.unallocated', { value: m(p.unallocated) });
    case 'allocations_in_scope': return check.ok ? tx('check.scope.ok') : p.emptyScope ? tx('check.scope.empty') : tx('check.scope.bad', { rows: (p.outside || []).map((k) => entityName(k, lang)).join('، ') });
    case 'profile_explicit': return check.ok ? (p.profile === 'equal' ? tx('check.profile.equal') : tx('check.profile.manual')) : tx('check.profile.bad');
    case 'months_complete':
      if (!p.applicable) return tx('check.months.na');
      return check.ok ? tx('check.months.ok') : (p.incomplete || []).map((x) => `${x.entityKey ? entityName(x.entityKey, lang) : tx('monthly.scopePlan')}: ${x.remaining > 0 ? tx('monthly.remaining', { value: `${bpText(x.remaining)}%` }) : tx('monthly.excess', { value: `${bpText(-x.remaining)}%` })}`).join(' · ');
    case 'actor_authorised': return check.ok ? tx('check.actor.ok') : p.reason === 'read_only_role' ? tx('check.actor.readOnly') : tx('check.actor.bad');
    case 'municipal_within_entity': return check.ok ? tx('check.muni.ok') : (p.entities || []).map((e) => tx('check.muni.bad', { entity: entityName(e.entityKey, lang), value: m(e.excess) })).join(' · ');
    default: return '';
  }
}


/**
 * Inline VALIDATION messages (spec §10): the rules a plan must meet to be saved, shown as plain sentences only for the rules that are not met, each with the explicit fix (go to the tab / «توزيع المتبقي» …).
 * It is not a check list and never says anything about activation. `serverValidation` (the page's answer to a refused save: { message?, errors?, checks? }) is shown in addition; the entered values are never touched.
 */
export default function ValidationPanel({ checks, serverValidation = null, tx, lang, canEdit, onGoto, onAction }) {
  const failing = (checks || []).filter((c) => !c.ok);
  const serverFailing = (serverValidation?.checks || []).filter((c) => !c.ok && !failing.some((f) => f.id === c.id));
  const items = [...failing, ...serverFailing];
  const serverErrors = serverValidation?.errors || [];
  if (!items.length && !serverErrors.length && !serverValidation?.message) return null;
  return (
    <section className="pe-validation" aria-label={tx('val.title')} role="status">
      <h3 className="pe-h4">{tx('val.title')}</h3>
      {serverValidation?.message && <p className="pe-note pe-note--err" role="alert">{serverValidation.message}</p>}
      {serverErrors.length > 0 && <ul className="pe-errlist pe-errlist--inline" role="alert">{serverErrors.map((e, i) => <li key={i}>{e[lang] || e.ar || e.code}</li>)}</ul>}
      {items.length > 0 && (
        <ul className="pe-val__list">
          {items.map((c) => {
            const fix = CHECK_FIX[c.id] || {};
            return (
              <li key={c.id}>
                <span className="pe-val__ic" aria-hidden="true"><Icon name="info" size={14} /></span>
                <span className="pe-val__txt"><b>{c.label?.[lang] || c.id}</b> — {checkDetail(c, tx, lang)}</span>
                <span className="pe-val__fix">
                  {fix.action && canEdit && <button type="button" className="btn btn-sm" onClick={() => onAction(fix.action)}>{tx(`val.fix.${fix.action}`)}</button>}
                  {fix.tab && <button type="button" className="pe-linkbtn" onClick={() => onGoto(fix.tab)}>{tx(`val.goto.${fix.tab}`)}</button>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
