import React from 'react';
import { Line } from 'react-chartjs-2';

// Liquidity Gap over time — running Net Position per month
// (cfoModel.computeCFOModel's `monthlySeries[].net`), so a widening negative
// gap is visible before it happens rather than only as a single end-of-
// period KPI.
export default function LiquidityGapChart({ monthlySeries, monthLabels, isRtl, money }) {
  const labels = monthlySeries.map((r, i) => monthLabels[i] || `M${r.month + 1}`);
  const values = monthlySeries.map((r) => r.net);
  const data = {
    labels,
    datasets: [{
      data: values,
      borderColor: 'rgba(10,111,166,0.9)',
      backgroundColor: 'rgba(10,111,166,0.15)',
      fill: true,
      tension: 0.25,
      pointRadius: monthlySeries.map((r) => (r.isActual ? 3 : 2)),
      pointBackgroundColor: monthlySeries.map((r) => (r.isActual ? 'rgba(10,111,166,1)' : 'rgba(10,111,166,0.4)'))
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { rtl: isRtl, callbacks: { label: (ctx) => money(ctx.raw) } }
    },
    scales: {
      x: { reverse: isRtl, grid: { display: false } },
      y: { ticks: { callback: (v) => money(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
    }
  };
  return <Line data={data} options={options} />;
}
