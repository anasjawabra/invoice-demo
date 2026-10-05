import React from 'react';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '../../context/ThemeContext';
import { chartColor, chartTooltip, getChartTheme } from '../../utils/chartTheme';

// Revenue Bridge / Waterfall — floating bars showing how baseline collected
// revenue moves through the growth and collection-rate assumptions to reach
// the final forecast. `stages` is [{key, value}], already computed by
// cfoModel.computeRevenueBridge (this component only draws).
export default function WaterfallChart({ stages, labels, isRtl, money }) {
  const { theme } = useTheme();
  const chartColors = getChartTheme(theme);
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
      backgroundColor: stages.map((s, i) => chartColor(i === 0 || i === stages.length - 1 ? 'info' : (s.value >= 0 ? 'success' : 'danger'), 0.75)),
      borderRadius: 4,
      barPercentage: 0.6
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: chartTooltip(theme, isRtl, { callbacks: { label: (ctx) => money(Math.round(Math.abs(ctx.raw[1] - ctx.raw[0]))) } })
    },
    scales: {
      x: { reverse: isRtl, ticks: { color: chartColors.text }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: chartColors.text, callback: (v) => money(v) }, grid: { color: chartColors.grid } }
    }
  };
  return <Bar data={data} options={options} />;
}
