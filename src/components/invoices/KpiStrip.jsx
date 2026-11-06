// KpiStrip — the figures of the DISPLAYED population, each with a one-line definition of what it counts; PopulationNote — the secondary «period context» block
// whose denominators are stated (never mixed with the register figures above it).
import React from 'react';
import InfoTip from './InfoTip';

export default function KpiStrip({ items, label, loading = false }) {
  return (
    <section className="il-kpis" aria-label={label}>
      {items.map((k) => (
        <div key={k.key} className={`il-kpi${k.tone ? ` il-kpi--${k.tone}` : ''}`}>
          <div className="il-kpi__label">{k.label}{k.info ? <InfoTip label={k.infoLabel || k.label}>{k.info}</InfoTip> : null}</div>
          {k.unit
            ? <div className={`il-kpi__value${loading && k.value == null ? ' il-kpi__value--skel' : ''}`} title={k.title}><bdi dir="ltr">{k.value == null ? '…' : k.value}</bdi>{k.value == null ? null : <small className="il-kpi__unit"> {k.unit}</small>}</div>
            : <div className={`il-kpi__value${loading && k.value == null ? ' il-kpi__value--skel' : ''}`} dir="ltr" title={k.title}>{k.value == null ? '…' : k.value}</div>}
          {k.sub && <div className="il-kpi__sub">{k.sub}</div>}
          {k.def && <div className="il-kpi__def">{k.def}</div>}
          {k.action && <button type="button" className="il-kpi__act" onClick={k.action.onClick}>{k.action.label} <span aria-hidden="true">{k.action.arrow || '←'}</span></button>}
        </div>
      ))}
    </section>
  );
}

export function PopulationNote({ title, children }) {
  return (
    <aside className="il-popnote" aria-label={title}>
      <b className="il-popnote__t">{title}</b>
      <div className="il-popnote__b">{children}</div>
    </aside>
  );
}
