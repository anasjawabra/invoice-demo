// FilterField — ONE labelled filter control (label ABOVE, 36px control, same width rules everywhere).
//   <FilterField label="البلدية" value="all" options={[{ value, label: {ar,en}|string, disabled? }]} onChange={(v)=>…} />
//   type 'select' (default): native <select> up to 12 options (best keyboard / screen-reader support), a searchable combobox above 12 (or searchable={true}).
//   type 'multi': checkbox group (value = array); gets a search box above 12 options.
//   Props: label, value, onChange, options, type, searchable, disabled, loading, hint (shown while disabled), placeholder, lang ('ar'|'en'), id, className, hideLabel.
// States: selected (non-default → `is-active` emphasis), loading (aria-busy + «جارٍ التحميل»), disabled (+ hint wired with aria-describedby).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pick } from './filterLogic';
import { useUid } from './overlay';

export const SEARCHABLE_AFTER = 12;
const norm = (s) => String(s || '').toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();
const T = (ar, a, e) => (ar ? a : e);
const Chevron = () => <svg className="ft-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;

function Combobox({ id, label, value, options, onChange, disabled, loading, lang, placeholder, describedBy, active }) {
  const ar = lang === 'ar'; const listId = `${id}-list`;
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [act, setAct] = useState(0);
  const wrap = useRef(null); const input = useRef(null);
  const sel = options.find((o) => o.value === value);
  const shown = useMemo(() => (q.trim() ? options.filter((o) => norm(pick(o.label, lang)).includes(norm(q))) : options), [q, options, lang]);
  useEffect(() => { setAct(0); }, [q, open]);
  useEffect(() => { if (open) { const i = shown.findIndex((o) => o.value === value); if (i >= 0 && !q) setAct(i); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) return; const el = document.getElementById(`${id}-opt-${act}`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }, [act, open, id]);
  const choose = (o) => { if (!o || o.disabled) return; onChange(o.value); setOpen(false); setQ(''); };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); else setAct((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (!open) setOpen(true); else setAct((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home' && open) { e.preventDefault(); setAct(0); }
    else if (e.key === 'End' && open) { e.preventDefault(); setAct(shown.length - 1); }
    else if (e.key === 'Enter' && open) { e.preventDefault(); choose(shown[act]); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); setQ(''); }
  };
  return (
    <div className="ft-combo" ref={wrap} onBlur={(e) => { if (!wrap.current.contains(e.relatedTarget)) { setOpen(false); setQ(''); } }}>
      <input ref={input} id={id} className={`ft-ctl ft-ctl--input${active ? ' is-active' : ''}`} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-haspopup="listbox"
        aria-activedescendant={open && shown[act] ? `${id}-opt-${act}` : undefined} aria-describedby={describedBy} aria-label={undefined} autoComplete="off" disabled={disabled}
        placeholder={open ? (sel ? pick(sel.label, lang) : placeholder || T(ar, 'ابحث…', 'Search…')) : undefined}
        value={open ? q : (sel ? pick(sel.label, lang) : '')} onChange={(e) => { setQ(e.target.value); if (!open) setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={key} />
      <Chevron />
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="ft-list">
          {shown.length === 0 && <li className="ft-list__empty" role="presentation">{T(ar, 'لا نتائج مطابقة', 'No matching options')}</li>}
          {shown.map((o, i) => (
            <li key={String(o.value)} id={`${id}-opt-${i}`} role="option" aria-selected={o.value === value} aria-disabled={o.disabled ? 'true' : undefined} className={`ft-list__opt${i === act ? ' is-act' : ''}${o.value === value ? ' is-sel' : ''}${o.disabled ? ' is-dis' : ''}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)} onMouseMove={() => setAct(i)}>{pick(o.label, lang)}</li>
          ))}
        </ul>
      )}
      <span className="ft-sr" role="status" aria-live="polite">{open ? T(ar, `${shown.length} خيار`, `${shown.length} options`) : ''}</span>
      {loading && <span className="ft-sr">{T(ar, 'جارٍ التحميل', 'Loading')}</span>}
    </div>
  );
}

function MultiGroup({ id, label, value, options, onChange, disabled, lang }) {
  const ar = lang === 'ar'; const [q, setQ] = useState(''); const v = Array.isArray(value) ? value : [];
  const searchable = options.length > SEARCHABLE_AFTER;
  const shown = q.trim() ? options.filter((o) => norm(pick(o.label, lang)).includes(norm(q))) : options;
  const toggle = (k) => onChange(v.includes(k) ? v.filter((x) => x !== k) : [...v, k]);
  return (
    <div role="group" aria-labelledby={`${id}-lbl`} className="ft-multi">
      {searchable && <input className="ft-ctl ft-ctl--input" type="search" aria-label={T(ar, `بحث في ${pick(label, lang)}`, `Search ${pick(label, lang)}`)} value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="ft-multi__list">
        {shown.map((o) => <label key={String(o.value)} className="ft-check"><input type="checkbox" disabled={disabled || o.disabled} checked={v.includes(o.value)} onChange={() => toggle(o.value)} /> <span>{pick(o.label, lang)}</span></label>)}
      </div>
      {v.length > 0 && <button type="button" className="ft-link" onClick={() => onChange([])}>{T(ar, 'مسح الاختيار', 'Clear selection')}</button>}
    </div>
  );
}

export default function FilterField({ id: idProp, label, value, onChange, options = [], type = 'select', searchable, disabled = false, loading = false, hint, placeholder, lang = 'ar', className = '', hideLabel = false, active }) {
  const auto = useUid('ft-f'); const id = idProp || auto; const ar = lang === 'ar'; const hintId = `${id}-hint`;
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const isActive = active != null ? active : (type === 'multi' ? (Array.isArray(value) && value.length > 0) : value !== 'all' && value != null && value !== '');
  const text = pick(label, lang); const showHint = disabled && hint;
  const combo = type === 'select' && (searchable === true || (searchable !== false && opts.length > SEARCHABLE_AFTER));
  return (
    <div className={`ft-field${disabled ? ' is-disabled' : ''}${loading ? ' is-loading' : ''} ${className}`} aria-busy={loading ? 'true' : undefined}>
      {type === 'multi'
        ? <span id={`${id}-lbl`} className={`ft-label${hideLabel ? ' ft-sr' : ''}`}>{text}</span>
        : <label htmlFor={id} id={`${id}-lbl`} className={`ft-label${hideLabel ? ' ft-sr' : ''}`}>{text}</label>}
      {type === 'multi' ? <MultiGroup id={id} label={label} value={value} options={opts} onChange={onChange} disabled={disabled} lang={lang} />
        : combo ? <Combobox id={id} label={text} value={value} options={opts} onChange={onChange} disabled={disabled} loading={loading} lang={lang} placeholder={placeholder} describedBy={showHint ? hintId : undefined} active={isActive} />
          : (
            <div className="ft-selectwrap">
              <select id={id} className={`ft-ctl ft-ctl--select${isActive ? ' is-active' : ''}`} value={value ?? ''} disabled={disabled} aria-describedby={showHint ? hintId : undefined} title={showHint ? pick(hint, lang) : undefined} onChange={(e) => onChange(e.target.value)}>
                {opts.map((o) => <option key={String(o.value)} value={o.value} disabled={o.disabled}>{pick(o.label, lang)}</option>)}
              </select>
              <Chevron />
            </div>
          )}
      {loading && <span className="ft-hint" role="status">{T(ar, 'جارٍ التحميل…', 'Loading…')}</span>}
      {showHint && <span id={hintId} className="ft-hint">{pick(hint, lang)}</span>}
    </div>
  );
}
