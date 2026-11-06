import React from 'react';

// Pure, reusable KSA province SVG map. Callers own all the data/colouring/selection logic (fillFor / titleFor / selectedIso / onSelect); this component only draws.
//   fillFor(p) → colour | 'none-pattern'      titleFor(p) → the accessible name + native tooltip (carries the value, so colour is never the only cue)
//   labelFor(p) → { name, value? } | null     a SHORT region label drawn only where the caller says it fits (the value line is optional: the dashboard draws names only)
//   isInert(p)  → true for a region with no data of the viewer's scope: drawn muted, not focusable, no tooltip
//   defs        → extra <defs> children (e.g. the hatch pattern of an unavailable value)      height → optional CSS height of the drawing
export default function ProvinceMap({ provinces, viewBox, fillFor, selectedIso, onSelect, titleFor, labelFor, onHover, isInert, defs, height, label }) {
  const inert = (p) => !!(isInert && isInert(p));
  return (
    <svg viewBox={viewBox} style={{ width: '100%', height: height || 'auto', display: 'block' }} role="group" aria-label={label}>
      {defs ? <defs>{defs}</defs> : null}
      {provinces.map((p) => (inert(p) ? (
        <path key={p.iso} d={p.path} fill="var(--surface-2, #F3F4F6)" stroke="var(--line-strong)" strokeWidth={1} strokeLinejoin="round" aria-hidden="true" />
      ) : (
        <path
          key={p.iso}
          d={p.path}
          fill={fillFor(p)}
          stroke={selectedIso === p.iso ? 'var(--primary)' : 'var(--line-strong)'}
          strokeWidth={selectedIso === p.iso ? 3 : 1}
          strokeLinejoin="round"
          style={{ cursor: 'pointer' }}
          onClick={() => onSelect(p.iso)}
          onMouseEnter={onHover ? () => onHover(p.iso) : undefined}
          onMouseLeave={onHover ? () => onHover(null) : undefined}
          onFocus={onHover ? () => onHover(p.iso) : undefined}
          onBlur={onHover ? () => onHover(null) : undefined}
          tabIndex={0}
          role="button"
          aria-pressed={selectedIso === p.iso}
          aria-label={titleFor(p)}
          data-iso={p.iso}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.iso); } }}
        >
          <title>{titleFor(p)}</title>
        </path>
      )))}
      {labelFor && provinces.map((p) => { if (inert(p)) return null; const t = labelFor(p); return t ? (
        <text key={`l-${p.iso}`} x={p.cx} y={p.cy} textAnchor="middle" pointerEvents="none" aria-hidden="true" className="ins-map__label" style={{ fontSize: 17, fontWeight: 700, fill: t.ink || '#111927', paintOrder: 'stroke', stroke: t.halo || 'rgba(255,255,255,.7)', strokeWidth: 3, strokeLinejoin: 'round' }}>
          <tspan x={p.cx} dy={t.value ? '-0.2em' : '0.3em'}>{t.name}</tspan>{t.value ? <tspan x={p.cx} dy="1.2em" style={{ fontSize: 17 }}>{t.value}</tspan> : null}
        </text>) : null; })}
    </svg>
  );
}
