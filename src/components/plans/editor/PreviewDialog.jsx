import React, { useMemo, useState } from 'react';
import { Chip, Icon, Notice, Overlay } from './editorBits';
import { applyPreview, bpText, buildPreview, entityName, milText, muniName, previewDefaults, riyalText } from './editorLogic';
import { monthLabel } from './TabMonthly';
import { scopeEntityKeys } from '../../../data/plans/planAccess';
import { municipalitiesOf } from '../../../data/amanahHierarchy';
import { monthRows } from '../../../data/plans/planMath';

const KIND_TITLE = { entity_remainder: 'preview.titleRemainder', entity_all: 'preview.titleAll', municipal_remainder: 'preview.titleMuni', monthly_equal: 'preview.titleMonthlyEqual', monthly_remaining: 'preview.titleMonthlyRemaining' };
const BASES = { entity_remainder: ['appropriation', 'equal', 'proportional'], entity_all: ['appropriation', 'equal', 'proportional'], municipal_remainder: ['equal', 'proportional'] };

/**
 * The before / after PREVIEW of an explicit action (distribute the remainder, redistribute the whole target, distribute to municipalities, equal months, remaining months). Nothing changes until «تطبيق»: the dialog only reads
 * `content`, lists EVERY changed row, the unallocated / remaining amount before and after and the ROUNDING REMAINDER (and which rows received it); rows with manual amounts that stay untouched are named. Apply hands the new content to the editor.
 */
export default function PreviewDialog({ kind, content, entityKey = null, tx, lang, onApply, onClose }) {
  const monthly = kind === 'monthly_equal' || kind === 'monthly_remaining';
  const defaults = useMemo(() => previewDefaults(kind, content, { entityKey }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [basis, setBasis] = useState(defaults.basis || 'equal');
  const [picked, setPicked] = useState(monthly ? defaults.months : defaults.rows);
  const [stale, setStale] = useState(false);
  const candidates = useMemo(() => {
    if (monthly) return monthRows(content.period).map((r) => ({ id: r.ym, name: monthLabel(r.ym, lang) }));
    if (kind === 'municipal_remainder') return municipalitiesOf(entityKey).map((m) => ({ id: m.refId, name: muniName(m, lang) }));
    const keys = [...new Set([...scopeEntityKeys(content.scope), ...(content.allocations || []).map((a) => a.entityKey)])];
    return keys.map((k) => ({ id: k, name: entityName(k, lang) }));
  }, [kind, content, entityKey, lang, monthly]);
  const preview = useMemo(() => buildPreview(kind, content, monthly ? { months: picked, entityKey } : { basis, rows: picked, entityKey }), [kind, content, basis, picked, entityKey, monthly]);
  const toggle = (id) => { setStale(false); setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])); };
  const nameOfRow = (r) => (monthly ? monthLabel(r.ym, lang) : r.muniId ? muniName(r.name, lang) : entityName(r.entityKey, lang));
  const idOfRow = (r) => r.ym || r.muniId || r.entityKey;
  const nameById = (id) => candidates.find((c) => c.id === id)?.name || id;
  const unit = monthly ? '%' : tx('unit.million');
  const fmt = (v) => (monthly ? `${bpText(v)}%` : milText(v));
  const sign = (d) => (d > 0 ? '+' : d < 0 ? '−' : '') + (monthly ? `${bpText(Math.abs(d))}%` : milText(Math.abs(d)));
  const apply = () => { const res = applyPreview(kind, content, preview); if (!res.ok) { setStale(true); return; } onApply(res.content); };
  const ok = preview.ok;
  const beforeLabel = monthly ? tx('preview.remainingPct') : kind === 'municipal_remainder' ? tx('alloc.muniUnallocated') : tx('alloc.legendUnallocated');
  return (
    <Overlay variant="dialog" size="lg" title={tx(KIND_TITLE[kind])} subtitle={tx('preview.subtitle')} onClose={onClose} className="pe-preview"
      footer={<><button type="button" className="btn btn-primary" data-autofocus onClick={apply} disabled={!ok || preview.rows.length === 0}>{tx('preview.apply')}</button><button type="button" className="btn" onClick={onClose}>{tx('common.cancel')}</button></>}>
      <Notice kind="info">{tx('preview.nothingYet')}</Notice>
      {BASES[kind] && (
        <fieldset className="pe-group">
          <legend>{tx('preview.basis')}</legend>
          {BASES[kind].map((b) => <label className="pe-radio" key={b}><input type="radio" name="pe-basis" checked={basis === b} onChange={() => { setStale(false); setBasis(b); }} /><span>{tx(`preview.basis.${b}`)}</span></label>)}
        </fieldset>
      )}
      <fieldset className="pe-group">
        <legend>{monthly ? tx('preview.monthsIncluded') : tx('preview.rowsIncluded')}</legend>
        <p className="pe-note">{tx(monthly ? 'preview.monthsHint' : 'preview.rowsHint')}</p>
        <ul className="pe-checks pe-checks--cols">{candidates.map((c) => <li key={c.id}><label className="pe-check"><input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} /><span>{c.name}</span></label></li>)}</ul>
      </fieldset>
      {!ok && <Notice kind="warn" title={tx('preview.cannot')}>{preview[lang] || preview.ar}</Notice>}
      {stale && <Notice kind="error">{tx('preview.stale')}</Notice>}
      {ok && (
        <section aria-label={tx('preview.changes')}>
          <h3 className="pe-h3">{tx('preview.changes')} <Chip kind="info">{preview.rows.length}</Chip></h3>
          {preview.rows.length === 0 ? <p className="pe-note">{tx('preview.noChange')}</p> : (
            <div className="pe-tablewrap">
              <table className="pe-table pe-table--stack">
                <thead><tr><th scope="col">{monthly ? tx('monthly.colMonth') : tx('preview.colRow')}</th><th scope="col">{tx('preview.before')} ({unit})</th><th scope="col">{tx('preview.after')} ({unit})</th><th scope="col">{tx('preview.delta')}</th></tr></thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const received = (preview.remainder?.rows || preview.remainder?.months || []).includes(idOfRow(r));
                    return (
                      <tr key={idOfRow(r)}>
                        <th scope="row" data-label={tx('preview.colRow')}>{nameOfRow(r)}</th>
                        <td data-label={tx('preview.before')} dir="ltr" title={monthly ? undefined : riyalText(r.before, lang)}>{fmt(r.before)}</td>
                        <td data-label={tx('preview.after')} dir="ltr" title={monthly ? undefined : riyalText(r.after, lang)}>{fmt(r.after)}</td>
                        <td data-label={tx('preview.delta')} dir="ltr"><b>{sign(r.delta)}</b>{received && <span className="pe-note"> · {tx('preview.gotRounding')}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <dl className="pe-recon pe-recon--sum">
            <div><dt>{beforeLabel}</dt><dd dir="ltr">{monthly ? `${bpText(preview.remainingBefore)}% → ${bpText(preview.remainingAfter)}%` : `${milText(preview.unallocatedBefore)} → ${milText(preview.unallocatedAfter)} ${unit}`}</dd></div>
            {!monthly && <div><dt>{tx('alloc.legendAllocated')}</dt><dd dir="ltr">{milText(preview.allocatedBefore)} → {milText(preview.allocatedAfter)} {unit}</dd></div>}
            <div><dt>{tx('alloc.legendExcess')}</dt><dd dir="ltr">{monthly ? `${bpText(preview.excessAfter)}%` : `${milText(preview.excessAfter)} ${unit}`}</dd></div>
            <div><dt>{tx('preview.rounding')}</dt><dd>{(preview.remainder?.units || 0) === 0 ? tx('preview.roundingNone') : tx(monthly ? 'preview.roundingMonthly' : 'preview.roundingText', { units: preview.remainder.units, rows: (preview.remainder.rows || preview.remainder.months || []).map(nameById).join('، ') })}</dd></div>
          </dl>
          {(preview.manualUntouched || []).length > 0 && <p className="pe-note"><Icon name="lock" size={13} /> {tx('preview.manualKept', { rows: preview.manualUntouched.map(nameById).join('، ') })}</p>}
          {(preview.skipped || []).length > 0 && <p className="pe-note">{tx('preview.skipped', { rows: preview.skipped.map((s) => nameById(s.entityKey)).join('، ') })}</p>}
        </section>
      )}
    </Overlay>
  );
}
