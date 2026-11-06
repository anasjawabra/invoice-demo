import React, { useState } from 'react';
import { Chip, Field, Icon, Notice, PctInput } from './editorBits';
import { BP_TOTAL, bpText, entityName, milText, monthlyModel, riyalText, setEntityOverride, setMonthBp, setProfile } from './editorLogic';
import { EQUAL_PROFILE_LABEL } from '../../../data/plans/planRules';

/** «شهر سنة» in the page language (UTC so the label never shifts a month) */
export const monthLabel = (ym, lang) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)).toLocaleString(lang === 'en' ? 'en-GB' : 'ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * «التوزيع الشهري»: the profile is chosen EXPLICITLY (equal | manual); an equal split carries its assumption label wherever it is shown; manual months are typed as percentages (0.01 % steps) with المجموع + المتبقي + excess and are NEVER
 * normalised. «توزيع بالتساوي» / «توزيع المتبقي» open a before/after preview. An entity may have its own distribution (override); municipal amounts follow their Amanah's months.
 */
export default function TabMonthly({ ctx }) {
  const { tx, lang, content, update, canEdit, reason, openPreview } = ctx;
  const entities = (content.allocations || []).map((a) => a.entityKey);
  const [sel, setSel] = useState('');
  const entityKey = sel && entities.includes(sel) ? sel : null;
  const m = monthlyModel(content, entityKey);
  const dis = !canEdit; const why = dis ? reason : undefined;
  const manual = m.profile === 'manual'; const equal = m.profile === 'equal';
  const editable = !dis && !m.inherited;
  const amountLabel = entityKey ? tx('monthly.basisEntity', { entity: entityName(entityKey, lang), value: milText(m.amount) }) : tx('monthly.basisPlan', { value: milText(m.amount) });
  return (
    <div className="pe-tab">
      <p className="pe-note">{tx('monthly.intro')}</p>
      {entities.length > 0 && (
        <Field label={tx('monthly.scopeLabel')} htmlFor="pe-mon-scope">
          <select id="pe-mon-scope" className="select" value={entityKey || ''} onChange={(e) => setSel(e.target.value)}>
            <option value="">{tx('monthly.scopePlan')}</option>
            {entities.map((k) => <option key={k} value={k}>{entityName(k, lang)}{content.entityDistributions?.[k] ? ` — ${tx('monthly.hasOverride')}` : ''}</option>)}
          </select>
        </Field>
      )}
      {entityKey && m.inherited && (
        <Notice kind="info">
          {tx('monthly.inherited')}{' '}
          <button type="button" className="btn btn-sm" disabled={dis} title={why} onClick={() => update((c) => setEntityOverride(c, entityKey, true))}>{tx('monthly.makeOverride')}</button>
        </Notice>
      )}
      {entityKey && !m.inherited && (
        <p><button type="button" className="pe-linkbtn" disabled={dis} title={why} onClick={() => update((c) => setEntityOverride(c, entityKey, false))}><Icon name="undo" size={13} /> {tx('monthly.dropOverride')}</button></p>
      )}

      <Field label={tx('monthly.profile')} htmlFor="pe-profile">
        <select id="pe-profile" className="select" value={m.profile || ''} disabled={dis || (entityKey && m.inherited)} title={why}
          onChange={(e) => update((c) => setProfile(c, entityKey, e.target.value || null))}>
          <option value="">{tx('monthly.profileNone')}</option>
          <option value="equal">{EQUAL_PROFILE_LABEL[lang]}</option>
          <option value="manual">{tx('monthly.profileManual')}</option>
        </select>
      </Field>
      {!m.profile && <Notice kind="warn">{tx('monthly.noProfile')}</Notice>}
      {equal && <Notice kind="info" title={EQUAL_PROFILE_LABEL[lang]}>{tx('monthly.equalAssumption')}</Notice>}
      {manual && Object.keys(content.distribution?.weights || {}).length === 0 && !entityKey && <p className="pe-note">{tx('monthly.manualStartsEmpty')}</p>}

      {m.profile && (
        <>
          <div className="pe-tablewrap">
            <table className="pe-table pe-table--stack">
              <caption className="pe-caption">{amountLabel}</caption>
              <thead><tr><th scope="col">{tx('monthly.colMonth')}</th><th scope="col">{tx('monthly.colPct')}</th><th scope="col">{tx('monthly.colAmount')} ({tx('unit.million')})</th></tr></thead>
              <tbody>
                {m.months.map((row) => (
                  <tr key={row.ym}>
                    <th scope="row" data-label={tx('monthly.colMonth')}>{monthLabel(row.ym, lang)}{row.partial && <Chip kind="muted">{tx('monthly.partial')}</Chip>}</th>
                    <td data-label={tx('monthly.colPct')}>
                      {manual ? <PctInput id={`pe-bp-${row.ym}`} bp={row.bp} disabled={!editable} label={`${monthLabel(row.ym, lang)} — %`} onCommit={(bp) => update((c) => setMonthBp(c, entityKey, row.ym, bp))} />
                        : <span dir="ltr">{row.pct.toFixed(2)}%</span>}
                    </td>
                    <td data-label={`${tx('monthly.colAmount')} (${tx('unit.million')})`} dir="ltr" title={riyalText(row.amount, lang)}>{milText(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th scope="row" data-label={tx('monthly.colMonth')}>{tx('monthly.total')}</th><td data-label={tx('monthly.colPct')} dir="ltr"><b>{bpText(m.totalBp)}%</b></td><td data-label={tx('monthly.colAmount')} dir="ltr">{milText(m.distributedAmount)}</td></tr>
              </tfoot>
            </table>
          </div>
          <div className="pe-status-line" role="status">
            {m.complete ? <Chip kind="ok"><Icon name="check" size={13} /> {tx('monthly.complete')}</Chip>
              : m.excessBp > 0 ? <Chip kind="bad">{tx('monthly.excess', { value: `${bpText(m.excessBp)}%` })}</Chip>
                : <Chip kind="warn">{tx('monthly.remaining', { value: `${bpText(m.remainingBp)}%` })}</Chip>}
            <span className="pe-note"> {tx('monthly.neverNormalised', { total: bpText(BP_TOTAL) })}</span>
          </div>
        </>
      )}
      <div className="pe-actions">
        <button type="button" className="btn btn-sm" disabled={!editable} title={why} onClick={() => openPreview('monthly_equal', { entityKey })}>{tx('monthly.btnEqual')}</button>
        <button type="button" className="btn btn-sm" disabled={!editable || !manual} title={why || (!manual ? tx('monthly.remainingNeedsManual') : undefined)} onClick={() => openPreview('monthly_remaining', { entityKey })}>{tx('monthly.btnRemaining')}</button>
      </div>
      <p className="pe-note">{tx('monthly.muniFollow')}</p>
    </div>
  );
}
