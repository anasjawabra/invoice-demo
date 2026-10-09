import React from 'react';
import { Bar } from 'react-chartjs-2';

// Revenue Bridge / Waterfall — floating bars showing how baseline collected
// revenue moves through the growth and collection-rate assumptions to reach
// the final forecast. `stages` is [{key, value}], already computed by
// cfoModel.computeRevenueBridge (this component only draws).
export default function WaterfallChart({ stages, labels, isRtl, money }) {
  let running = 0;
  const bars = stages.map((s, i) => {
    if (i === 0 || i === stages.length - 1) {
      const bar = { start: 0, end: s.value };
      running = s.value;
      return bar;
    }
    const start = running;
    running += s.value;
    return { start: Math.min(start, running), end: Math.max(start, running), delta: s.value };
  });

  const data = {
    labels: stages.map((s) => labels[s.key] || s.key),
    datasets: [{
      data: bars.map((b) => [b.start, b.end]),
      backgroundColor: stages.map((s, i) => (i === 0 || i === stages.length - 1) ? 'rgba(24, 73, 169,0.75)' : (s.value >= 0 ? 'rgba(27, 131, 84,0.75)' : 'rgba(240, 68, 56,0.75)')),
      borderRadius: 4,
      barPercentage: 0.6
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { rtl: isRtl, callbacks: { label: (ctx) => money(Math.round(Math.abs(ctx.raw[1] - ctx.raw[0]))) } }
    },
    scales: {
      x: { reverse: isRtl, grid: { display: false } },
      y: { beginAtZero: true, ticks: { callback: (v) => money(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
    }
  };
  return <Bar data={data} options={options} />;
}
