import React from 'react';
import { Line } from 'react-chartjs-2';
import { useTheme } from '../../context/ThemeContext';
import { chartColor, chartTooltip, getChartTheme } from '../../utils/chartTheme';

// Liquidity Gap over time — running Net Position per month
// (cfoModel.computeCFOModel's `monthlySeries[].net`), so a widening negative
// gap is visible before it happens rather than only as a single end-of-
// period KPI.
export default function LiquidityGapChart({ monthlySeries, monthLabels, isRtl, money }) {
  const { theme } = useTheme();
  const chartColors = getChartTheme(theme);
  const labels = monthlySeries.map((r, i) => monthLabels[i] || `M${r.month + 1}`);
  const values = monthlySeries.map((r) => r.net);
  const data = {
    labels,
    datasets: [{
      data: values,
      borderColor: chartColor('info', 0.9),
      backgroundColor: chartColor('info', 0.15),
      fill: true,
      tension: 0.25,
      pointRadius: monthlySeries.map((r) => (r.isActual ? 3 : 2)),
      pointBackgroundColor: monthlySeries.map((r) => chartColor('info', r.isActual ? 1 : 0.4))
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: chartTooltip(theme, isRtl, { callbacks: { label: (ctx) => money(ctx.raw) } })
    },
    scales: {
      x: { reverse: isRtl, ticks: { color: chartColors.text }, grid: { display: false } },
      y: { ticks: { color: chartColors.text, callback: (v) => money(v) }, grid: { color: chartColors.grid } }
    }
  };
  return <Line data={data} options={options} />;
}
