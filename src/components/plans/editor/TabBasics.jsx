import React from 'react';
import { Field, Notice } from './editorBits';
import { entityName, scopeChoices, setName, setPeriodPreset, setPeriodRange, setScopeKind, toggleScopeEntity } from './editorLogic';

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

/** «بيانات الخطة»: name, scope (Ministry | selected entities — only what the actor may cover), period (the calendar-year preset states its assumption, or a date range), and the read-only record data. */
export default function TabBasics({ ctx }) {
  const { tx, lang, content, update, canEdit, reason, access } = ctx;
  const ch = scopeChoices(access.geoScope);
  const isMin = content.scope?.kind === 'ministry'; const keys = content.scope?.kind === 'entities' ? content.scope.entityKeys : [];
  const preset = content.period?.preset === 'fiscal-year'; const year = Number((content.period?.start || '').slice(0, 4)) || 2026;
  const years = YEARS.includes(year) ? YEARS : [...YEARS, year].sort();
  const dis = !canEdit; const why = dis ? reason : undefined;
  return (
    <div className="pe-tab">
      <Field label={tx('basics.name')} htmlFor="pe-name">
        <input id="pe-name" className="input" value={content.name || ''} disabled={dis} title={why} maxLength={80} onChange={(e) => update((c) => setName(c, e.target.value), { keepName: true })} />
      </Field>

      <fieldset className="pe-group" disabled={dis} title={why}>
        <legend>{tx('basics.scope')}</legend>
        <label className="pe-radio"><input type="radio" name="pe-scope" checked={isMin} disabled={dis || !ch.ministryOk} onChange={() => update((c) => setScopeKind(c, 'ministry', ch.allowed))} /><span>{tx('basics.scopeMinistry')}</span>{!ch.ministryOk && <span className="pe-field__hint"> · {tx('basics.ministryNeedsAll')}</span>}</label>
        <label className="pe-radio"><input type="radio" name="pe-scope" checked={!isMin} disabled={dis || !ch.allowed.length} onChange={() => update((c) => setScopeKind(c, 'entities', ch.allowed))} /><span>{tx('basics.scopeEntities')}</span></label>
        {!isMin && (
          <ul className="pe-checks" aria-label={tx('basics.scopeEntities')}>
            {ch.entities.map((k) => {
              const ok = ch.allowed.includes(k);
              return <li key={k}><label className="pe-check"><input type="checkbox" checked={keys.includes(k)} disabled={dis || !ok} title={!ok ? tx('basics.entityNotCovered') : undefined} onChange={(e) => update((c) => toggleScopeEntity(c, k, e.target.checked))} /><span>{entityName(k, lang)}</span></label></li>;
            })}
          </ul>
        )}
        {!isMin && keys.length === 0 && <div className="pe-field__err" role="alert">{tx('basics.noEntities')}</div>}
      </fieldset>

      <fieldset className="pe-group" disabled={dis} title={why}>
        <legend>{tx('basics.period')}</legend>
        <label className="pe-radio"><input type="radio" name="pe-period" checked={preset} onChange={() => update((c) => setPeriodPreset(c, year))} /><span>{tx('basics.periodYear')}</span></label>
        {preset && (
          <div className="pe-indent">
            <Field label={tx('basics.year')} htmlFor="pe-year"><select id="pe-year" className="select" value={year} onChange={(e) => update((c) => setPeriodPreset(c, Number(e.target.value)))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></Field>
            <Notice kind="info" className="pe-notice--sm">{tx('basics.fiscalAssumption', { start: content.period.start, end: content.period.end })}</Notice>
          </div>
        )}
        <label className="pe-radio"><input type="radio" name="pe-period" checked={!preset} onChange={() => update((c) => setPeriodRange(c, {}))} /><span>{tx('basics.periodRange')}</span></label>
        {!preset && (
          <div className="pe-grid2 pe-indent">
            <Field label={tx('basics.start')} htmlFor="pe-start"><input id="pe-start" type="date" className="input" dir="ltr" value={content.period?.start || ''} onChange={(e) => update((c) => setPeriodRange(c, { start: e.target.value }))} /></Field>
            <Field label={tx('basics.end')} htmlFor="pe-end"><input id="pe-end" type="date" className="input" dir="ltr" value={content.period?.end || ''} onChange={(e) => update((c) => setPeriodRange(c, { end: e.target.value }))} /></Field>
          </div>
        )}
      </fieldset>
      <p className="pe-note">{tx('basics.noRowChange')}</p>
    </div>
  );
}
