import React from 'react';

// A 0-100% horizontal bar gauge with a target marker — used by Expense
// Planning to show Expense Coverage against a 100% (fully funded) target
// without a separate charting library.
export default function CoverageGauge({ value, targetPct = 100, label, sub }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const markerPct = Math.max(0, Math.min(100, targetPct));
  const color = value == null ? 'var(--low)' : value >= 90 ? 'var(--green)' : value >= 60 ? 'var(--gold)' : 'var(--red)';
  return (
    <div>
      {label && <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{label}</div>}
      <div style={{ position: 'relative', height: 14, borderRadius: 7, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 7, transition: 'width 0.2s ease' }} />
        <div style={{ position: 'absolute', insetInlineStart: `${markerPct}%`, top: -3, bottom: -3, width: 2, background: 'var(--heading)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="kpi__value" dir="ltr" style={{ fontSize: 16 }}>{value == null ? '—' : `${value}%`}</span>
        {sub && <span className="muted" style={{ fontSize: 11 }}>{sub}</span>}
      </div>
    </div>
  );
}
