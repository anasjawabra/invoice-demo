import React from 'react';
import { useL } from '../../utils/bi';
import { NOT_AVAILABLE } from '../../data/contractRules';

// Small building blocks of the Furas pages (see src/styles/furas.css). No data logic here.
const PATHS = {
  search: 'M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z',
  alert: 'M12 9v4m0 4h.01M10.3 3.9L2.4 17.5A2 2 0 004.1 20.5h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  table: 'M3 5h18v14H3zM3 10h18M9 5v14',
  info: 'M12 16v-5m0-3h.01M12 22a10 10 0 100-20 10 10 0 000 20z',
  x: 'M6 6l12 12M18 6L6 18'
};
export const Icon = ({ name }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name]} /></svg>;

export const Chip = ({ tone = 'value', icon, title, children }) => <span className={`fu-chip fu-chip--${tone}`} title={title}>{icon && <Icon name={icon} />}{children}</span>;

// «Not available in the current data»: the full wording for screen readers and on hover; a quiet dash in dense cells (the table legend spells it out)
export function NaCell({ full = false }) {
  const { B } = useL();
  return full ? <span className="fu-na">{B(NOT_AVAILABLE)}</span> : <span className="fu-na" title={B(NOT_AVAILABLE)}>—<span className="fu-sr">{B(NOT_AVAILABLE)}</span></span>;
}

export function Tabs({ tabs, value, onChange, label }) {
  const onKey = (e) => { const i = tabs.findIndex((t) => t.key === value); if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const d = (e.key === 'ArrowRight' ? 1 : -1) * (document.dir === 'rtl' ? -1 : 1); onChange(tabs[(i + d + tabs.length) % tabs.length].key); } };
  return (
    <div className="fu-tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t) => <button key={t.key} id={`fu-tab-${t.key}`} type="button" role="tab" aria-selected={value === t.key} aria-controls={`fu-panel-${t.key}`} tabIndex={value === t.key ? 0 : -1} className="fu-tab" onClick={() => onChange(t.key)}>{t.label}{t.hint != null && <small>{t.hint}</small>}</button>)}
    </div>
  );
}

// one quiet strip of key figures; an item can act as a filter
export function StatStrip({ items }) {
  return (
    <div className="fu-stats">
      {items.map((x) => {
        const body = <><span className="fu-stat__label">{x.label}</span><span className="fu-stat__value" dir="ltr">{x.value}</span>{x.sub && <span className="fu-stat__sub">{x.sub}</span>}</>;
        return x.onClick
          ? <button key={x.label} type="button" className={`fu-stat${x.tone ? ` fu-stat--${x.tone}` : ''}`} aria-pressed={!!x.active} onClick={x.onClick} title={x.title}>{body}</button>
          : <div key={x.label} className={`fu-stat${x.tone ? ` fu-stat--${x.tone}` : ''}`} title={x.title}>{body}</div>;
      })}
    </div>
  );
}

// a distribution as bars: rows = [{ key, label, title, a, b }]; the bar is a's share of the largest a. Two stored values can read the same once translated (spelling variants), so the key is the stored value, never the label.
export function BarList({ rows, format, second }) {
  const max = Math.max(1, ...rows.map((r) => r.a));
  return (
    <ul className="fu-bars">
      {rows.map((r, i) => (
        <li key={r.key ?? `${r.label}#${i}`} className="fu-bar">
          <span className="fu-bar__label" dir="auto" title={r.title}>{r.label}{r.chip}</span>
          <span className="fu-bar__nums" dir="ltr">{format(r.a)}{second && r.b != null ? ` · ${second(r.b)}` : ''}</span>
          <span className="fu-bar__track" aria-hidden="true"><span className="fu-bar__fill" style={{ width: `${Math.max(1, (r.a / max) * 100)}%` }} /></span>
        </li>))}
    </ul>
  );
}
