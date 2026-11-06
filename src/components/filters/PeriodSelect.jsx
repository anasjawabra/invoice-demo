// PeriodSelect — the ONE period control of the platform.
//   <PeriodSelect preset="ytd" from="2026-01-01" to="2026-11-05" today="2026-11-05" dateBasis="issue" lang="ar"
//                 onPreset={(key)=>…} onRange={(from,to)=>…} />
// The trigger shows «السنة حتى اليوم · 1 يناير – 5 نوفمبر 2026». The popover offers six choices (this month, previous month, this quarter, year to date, all available data,
// custom range). From / To appear ONLY under «Custom range», labelled «من / إلى», validated (from ≤ to, inside the data) before Apply; the typed date is echoed as
// «5 نوفمبر 2026» so the browser's date format can never be misread. The DATE BASIS line (dateBasis: 'issue'|'payment'|'contract'|'order') sits in the popover and in the label.
// The data cutoff is NOT part of this control (see DataInfo). Keyboard: Enter/Space/ArrowDown open; ArrowUp/Down/Home/End move; Enter chooses; Esc closes.
import React, { useEffect, useRef, useState } from 'react';
import { PERIOD_CHOICES, periodChoiceLabel, presetRange, presetAvailable } from '../../data/periodPresets';
import { DATA_START } from '../../data/revenueLedger';
import { coverageLine } from '../../data/dateRange';
import { fmtDateText, fmtRangeText } from '../../data/clock';
import { Popover, useUid } from './overlay';
import { dateBasisLabel, dateBasisLine, periodText, validateCustomRange, FIELD_LABELS, pick } from './filterLogic';

const Cal = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
const Chevron = () => <svg className="ft-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;

export default function PeriodSelect({ preset, from, to, today, start = DATA_START, dateBasis = 'issue', lang = 'ar', onPreset, onRange, id: idProp, label, className = '' }) {
  const ar = lang === 'ar'; const auto = useUid('ft-p'); const id = idProp || auto;
  const [open, setOpen] = useState(false); const [custom, setCustom] = useState(false); const [act, setAct] = useState(0);
  const [draft, setDraft] = useState({ from, to });
  const wrap = useRef(null); const trigger = useRef(null); const list = useRef(null); const fromRef = useRef(null);
  const current = preset && preset !== 'custom' && PERIOD_CHOICES.includes(preset) ? preset : (preset && preset !== 'custom' ? null : 'custom');
  const check = validateCustomRange(draft.from, draft.to, { today, start, lang });
  const basis = dateBasisLabel(dateBasis, lang);

  const close = (focusBack) => { setOpen(false); if (focusBack === true && trigger.current) trigger.current.focus(); };
  const openIt = () => { const i = Math.max(0, PERIOD_CHOICES.indexOf(current)); setAct(i); setCustom(current === 'custom'); setDraft({ from, to }); setOpen(true); };
  useEffect(() => { if (open && list.current) list.current.focus(); }, [open]);
  const choose = (key) => {
    if (key === 'custom') { setCustom(true); setDraft({ from, to }); window.setTimeout(() => fromRef.current && fromRef.current.focus(), 0); return; }
    if (!presetAvailable(key, today, start)) return;
    onPreset(key); close(true);
  };
  const applyCustom = () => { if (!check.ok) return; onRange(check.from, check.to); close(true); };
  const onListKey = (e) => {
    const n = PERIOD_CHOICES.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAct((i) => (i + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAct((i) => (i - 1 + n) % n); }
    else if (e.key === 'Home') { e.preventDefault(); setAct(0); }
    else if (e.key === 'End') { e.preventDefault(); setAct(n - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(PERIOD_CHOICES[act]); }
  };
  const triggerKey = (e) => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openIt(); } };
  const text = periodText({ preset: current || preset, from, to }, lang);
  const lbl = label || pick(FIELD_LABELS.period, lang);

  return (
    <div className={`ft-field ft-field--period ${className}`}>
      <span className="ft-label" id={`${id}-lbl`}>{lbl}{basis ? <span className="ft-label__basis"> · {basis}</span> : null}</span>
      <div className="ft-pop-wrap" ref={wrap}>
        <button ref={trigger} type="button" id={id} className={`ft-ctl ft-trigger${current !== 'ytd' ? ' is-active' : ''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-pop`} aria-labelledby={`${id}-lbl ${id}`} title={text}
          onClick={() => (open ? close() : openIt())} onKeyDown={triggerKey}>
          <Cal /><span className="ft-trigger__text">{text}</span><Chevron />
        </button>
        <Popover open={open} onClose={close} wrapRef={wrap} triggerRef={trigger} id={`${id}-pop`} label={lbl} className="ft-period-pop">
          <ul ref={list} role="listbox" tabIndex={0} aria-label={lbl} aria-activedescendant={`${id}-o-${act}`} className="ft-period-list" onKeyDown={onListKey}>
            {PERIOD_CHOICES.map((k, i) => {
              const r = k === 'custom' ? null : presetRange(k, today); const na = k !== 'custom' && !presetAvailable(k, today, start);
              return (
                <li key={k} id={`${id}-o-${i}`} role="option" aria-selected={current === k} aria-disabled={na ? 'true' : undefined} className={`ft-period-opt${i === act ? ' is-act' : ''}${current === k ? ' is-sel' : ''}${na ? ' is-dis' : ''}`} onClick={() => { setAct(i); choose(k); }} onMouseMove={() => setAct(i)}>
                  <span className="ft-period-opt__name">{periodChoiceLabel(k, lang)}</span>
                  <small>{na ? (ar ? 'خارج نطاق البيانات' : 'Outside the data') : r ? fmtRangeText(r.from, r.to, lang) : (ar ? 'اختر تاريخي البداية والنهاية' : 'Pick a start and an end date')}</small>
                </li>
              );
            })}
          </ul>
          {custom && (
            <div className="ft-custom" role="group" aria-label={periodChoiceLabel('custom', lang)}>
              <div className="ft-custom__row">
                {[['from', ar ? 'من' : 'From'], ['to', ar ? 'إلى' : 'To']].map(([k, l]) => (
                  <div className="ft-field" key={k}>
                    <label className="ft-label" htmlFor={`${id}-${k}`}>{l}</label>
                    <input ref={k === 'from' ? fromRef : undefined} id={`${id}-${k}`} className="ft-ctl ft-ctl--input" type="date" min={start} max={today} value={draft[k] || ''} aria-invalid={!check.ok ? 'true' : undefined} aria-describedby={`${id}-msg`}
                      onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustom(); } }} />
                    <output className="ft-date-echo" htmlFor={`${id}-${k}`} dir="auto">{draft[k] && /^\d{4}-\d{2}-\d{2}$/.test(draft[k]) ? fmtDateText(draft[k], lang) : '—'}</output>
                  </div>
                ))}
              </div>
              <div id={`${id}-msg`} className={`ft-msg ${!check.ok ? 'is-bad' : check.message ? 'is-note' : ''}`} role={!check.ok || check.message ? 'alert' : undefined}>{!check.ok ? check.message : check.message || coverageLine(lang, { today, start })}</div>
              <div className="ft-custom__actions">
                <button type="button" className="btn btn-sm btn-primary ft-btn" disabled={!check.ok} onClick={applyCustom}>{ar ? 'تطبيق' : 'Apply'}</button>
                <button type="button" className="btn btn-sm btn-ghost ft-btn" onClick={() => close(true)}>{ar ? 'إلغاء' : 'Cancel'}</button>
              </div>
            </div>
          )}
          {basis && <div className="ft-period-basis">{dateBasisLine(dateBasis, lang)}</div>}
        </Popover>
      </div>
    </div>
  );
}
