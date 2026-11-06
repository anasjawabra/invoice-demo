// MoreFilters — «المزيد من الفلاتر»: the secondary filters behind ONE button. Desktop: popover; mobile: the FilterBar drawer reuses <FieldsForm>.
//   <MoreFilters defs={secondaryDefs} values={values} ctx={{today}} lang="ar" onApply={(patch)=>…} />
// It keeps its OWN draft: nothing changes until «تطبيق / Apply»; «إلغاء / Cancel» (or Esc) discards it. The trigger carries the count of applied advanced
// filters; each applied one stays visible as a chip (ActiveFilterChips) after the panel closes. Dependent fields are cleared in the draft with a visible notice.
import React, { useRef, useState } from 'react';
import FilterField from './FilterField';
import PeriodSelect from './PeriodSelect';
import { presetRange } from '../../data/periodPresets';
import { fmtDateText } from '../../data/clock';
import { Popover, useUid } from './overlay';
import { GROUP_LABELS, activeKeys, cascadePatch, clearedNoticeText, defaultOf, isEqualJson, pick } from './filterLogic';

const Sliders = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>;

// one control for a field definition (period / select / multi / text)
export function FieldControl({ def, values, onChange, lang, ctx = {}, id }) {
  const v = values[def.key];
  const opts = typeof def.options === 'function' ? def.options(values) : def.options;
  const disabled = typeof def.disabled === 'function' ? def.disabled(values) : !!def.disabled;
  if (def.type === 'period') return <PeriodSelect id={id} preset={v?.preset} from={v?.from} to={v?.to} today={ctx.today} start={ctx.start} dateBasis={def.dateBasis || ctx.dateBasis} lang={lang} label={pick(def.label, lang)} onPreset={(key) => onChange({ [def.key]: { preset: key, ...(presetRange(key, ctx.today) || {}) } })} onRange={(f, t) => onChange({ [def.key]: { preset: 'custom', from: f, to: t } })} />;
  if (def.type === 'text') return (
    <div className="ft-field"><label className="ft-label" htmlFor={id}>{pick(def.label, lang)}</label>
      <input id={id} className="ft-ctl ft-ctl--input" type={def.inputType || 'text'} inputMode={def.inputType === 'number' ? 'numeric' : undefined} value={v || ''} placeholder={pick(def.placeholder, lang)}
        min={typeof def.min === 'function' ? def.min(values) : def.min} max={typeof def.max === 'function' ? def.max(values) : def.max} onChange={(e) => onChange({ [def.key]: e.target.value })} />
      {def.inputType === 'date' && <output className="ft-date-echo" htmlFor={id} dir="auto">{v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDateText(v, lang) : '—'}</output>}
    </div>
  );
  return <FilterField id={id} label={def.label} lang={lang} type={def.type === 'multi' ? 'multi' : 'select'} value={v} options={opts || []} searchable={def.searchable} disabled={disabled} loading={def.loading} hint={def.hint} className={def.className || ''} onChange={(nv) => onChange({ [def.key]: nv })} />;
}

// the fields, grouped (group titles only when there is more than one group). `onChange(patch)` receives raw patches; the caller cascades.
export function FieldsForm({ defs, values, onChange, lang, ctx, notice, idPrefix, flat = false }) {
  const groups = []; for (const d of defs) { const g = flat ? 'flat' : (d.group || 'other'); let x = groups.find((y) => y.key === g); if (!x) { x = { key: g, defs: [] }; groups.push(x); } x.defs.push(d); }
  const titled = groups.length > 1 && !flat;
  return (
    <div className="ft-form">
      {notice && <div className="ft-notice" role="status" aria-live="polite">{notice}</div>}
      {groups.map((g) => (
        <fieldset key={g.key} className="ft-group">
          {titled && GROUP_LABELS[g.key] && <legend>{pick(GROUP_LABELS[g.key], lang)}</legend>}
          <div className="ft-group__grid">{g.defs.map((d) => <FieldControl key={d.key} def={d} values={values} onChange={onChange} lang={lang} ctx={ctx} id={`${idPrefix}-${d.key}`} />)}</div>
        </fieldset>
      ))}
    </div>
  );
}

export default function MoreFilters({ defs, allDefs, values, onApply, lang = 'ar', ctx = {}, label }) {
  const ar = lang === 'ar'; const id = useUid('ft-more');
  const [open, setOpen] = useState(false); const [draft, setDraft] = useState(values); const [note, setNote] = useState('');
  const wrap = useRef(null); const trigger = useRef(null);
  const count = activeKeys(defs, values, ctx).length;
  const text = label || (ar ? 'المزيد من الفلاتر' : 'More filters');
  const openIt = () => { setDraft(values); setNote(''); setOpen(true); };
  const change = (patch) => { const r = cascadePatch(allDefs || defs, draft, patch); setDraft(r.values); setNote(clearedNoticeText(allDefs || defs, r.cleared, lang)); };
  const apply = () => { const patch = {}; for (const d of defs) if (!isEqualJson(draft[d.key], values[d.key])) patch[d.key] = draft[d.key]; setOpen(false); if (Object.keys(patch).length) onApply(patch, note); if (trigger.current) trigger.current.focus(); };
  const reset = () => { setDraft((x) => ({ ...x, ...Object.fromEntries(defs.map((d) => [d.key, defaultOf(d)])) })); setNote(''); };
  return (
    <div className="ft-pop-wrap ft-more" ref={wrap}>
      <button ref={trigger} type="button" className={`btn btn-sm btn-ghost ft-more__btn${count ? ' is-active' : ''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-pop`} onClick={() => (open ? setOpen(false) : openIt())}>
        <Sliders />{text}{count > 0 && <span className="ft-badge" aria-label={ar ? `${count} فلتر مطبّق` : `${count} applied`}>{count}</span>}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} wrapRef={wrap} triggerRef={trigger} id={`${id}-pop`} label={text} align="end" wide className="ft-panel">
        <FieldsForm defs={defs} values={draft} onChange={change} lang={lang} ctx={ctx} notice={note} idPrefix={`${id}-d`} />
        <div className="ft-panel__foot">
          <button type="button" className="btn btn-sm btn-primary ft-btn" onClick={apply}>{ar ? 'تطبيق' : 'Apply'}</button>
          <button type="button" className="btn btn-sm btn-ghost ft-btn" onClick={() => { setOpen(false); if (trigger.current) trigger.current.focus(); }}>{ar ? 'إلغاء' : 'Cancel'}</button>
          <button type="button" className="ft-link" onClick={reset} disabled={defs.every((d) => isEqualJson(draft[d.key], defaultOf(d)))}>{ar ? 'إعادة ضبط هذه الفلاتر' : 'Reset these filters'}</button>
        </div>
      </Popover>
    </div>
  );
}
