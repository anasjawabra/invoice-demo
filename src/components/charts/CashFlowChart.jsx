import React from 'react';
import { Bar } from 'react-chartjs-2';

// Monthly Cash Flow Forecast — collected inflow vs. outflow (expenses +
// commitments) per month, from cfoModel.computeCFOModel's own
// `monthlySeries` (the single source of truth every time-based chart here
// reads from). Elapsed months (isActual) render solid; projected months
// render at reduced opacity so the real/forecast boundary is visible.
export default function CashFlowChart({ monthlySeries, monthLabels, isRtl, money }) {
  const labels = monthlySeries.map((r, i) => monthLabels[i] || `M${r.month + 1}`);
  const alpha = (r, base) => (r.isActual ? base : base.replace(/[\d.]+\)$/, '0.35)'));
  const data = {
    labels,
    datasets: [
      {
        label: 'Inflow',
        data: monthlySeries.map((r) => r.collected || 0),
        backgroundColor: monthlySeries.map((r) => alpha(r, 'rgba(62,133,64,0.85)')),
        borderRadius: 3, barPercentage: 0.7
      },
      {
        label: 'Outflow',
        data: monthlySeries.map((r) => -r.outflow),
        backgroundColor: monthlySeries.map((r) => alpha(r, 'rgba(196,81,76,0.85)')),
        borderRadius: 3, barPercentage: 0.7
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', rtl: isRtl },
      tooltip: { rtl: isRtl, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(Math.abs(ctx.raw))}` } }
    },
    scales: {
      x: { reverse: isRtl, grid: { display: false }, stacked: false },
      y: { ticks: { callback: (v) => money(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
    }
  };
  return <Bar data={data} options={options} />;
}
