import React from 'react';

// Pure, reusable KSA province SVG map — extracted from Dashboard.jsx so the
// Decision Room can render the same real province boundaries without a
// second copy-pasted <svg> loop. Callers own all the data/coloring/selection
// logic (fillFor/titleFor/selectedIso/onSelect); this component only draws.
export default function ProvinceMap({ provinces, viewBox, fillFor, selectedIso, onSelect, titleFor }) {
  return (
    <svg viewBox={viewBox} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {provinces.map((p) => (
        <path
          key={p.iso}
          d={p.path}
          fill={fillFor(p)}
          stroke={selectedIso === p.iso ? 'var(--primary)' : 'var(--line-strong)'}
          strokeWidth={selectedIso === p.iso ? 3 : 1}
          strokeLinejoin="round"
          style={{ cursor: 'pointer' }}
          onClick={() => onSelect(p.iso === selectedIso ? null : p.iso)}
        >
          <title>{titleFor(p)}</title>
        </path>
      ))}
    </svg>
  );
}
