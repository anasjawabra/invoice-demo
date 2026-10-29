import React from 'react';

// Monthly liquidity heatmap — one cell per month, colored by that month's
// Net Position (cfoModel `monthlySeries[].net`) so pressure points across
// the period are visible at a glance without reading a table. No charting
// library needed — a CSS grid of colored cells.
export default function LiquidityHeatmap({ monthlySeries, monthLabels, money }) {
  const values = monthlySeries.map((r) => r.net ?? 0);
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const colorFor = (v) => {
    const intensity = Math.min(1, Math.abs(v) / maxAbs);
    return v >= 0
      ? `rgba(62,133,64,${0.15 + intensity * 0.65})`
      : `rgba(196,81,76,${0.15 + intensity * 0.65})`;
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(monthlySeries.length, 6)}, 1fr)`, gap: 6 }}>
      {monthlySeries.map((r, i) => (
        <div key={r.month} style={{ background: colorFor(r.net ?? 0), borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 10.5 }}>{monthLabels[i] || `M${r.month + 1}`}</div>
          <div dir="ltr" style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--heading)' }}>{r.net == null ? '—' : money(r.net)}</div>
        </div>
      ))}
    </div>
  );
}
