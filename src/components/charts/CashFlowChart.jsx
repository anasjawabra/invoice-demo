import React from 'react';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '../../context/ThemeContext';
import { chartColor, chartLegend, chartTooltip, getChartTheme } from '../../utils/chartTheme';

// Monthly Cash Flow Forecast — collected inflow vs. outflow (expenses +
// commitments) per month, from cfoModel.computeCFOModel's own
// `monthlySeries` (the single source of truth every time-based chart here
// reads from). Elapsed months (isActual) render solid; projected months
// render at reduced opacity so the real/forecast boundary is visible.
export default function CashFlowChart({ monthlySeries, monthLabels, isRtl, money }) {
  const { theme } = useTheme();
  const chartColors = getChartTheme(theme);
  const labels = monthlySeries.map((r, i) => monthLabels[i] || `M${r.month + 1}`);
  const data = {
    labels,
    datasets: [
      {
        label: 'Inflow',
        data: monthlySeries.map((r) => r.collected || 0),
        backgroundColor: monthlySeries.map((r) => chartColor('success', r.isActual ? 0.85 : 0.35)),
        borderRadius: 3, barPercentage: 0.7
      },
      {
        label: 'Outflow',
        data: monthlySeries.map((r) => -r.outflow),
        backgroundColor: monthlySeries.map((r) => chartColor('danger', r.isActual ? 0.85 : 0.35)),
        borderRadius: 3, barPercentage: 0.7
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: chartLegend(theme, { position: 'top', rtl: isRtl }),
      tooltip: chartTooltip(theme, isRtl, { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(Math.abs(ctx.raw))}` } })
    },
    scales: {
      x: { reverse: isRtl, ticks: { color: chartColors.text }, grid: { display: false }, stacked: false },
      y: { ticks: { color: chartColors.text, callback: (v) => money(v) }, grid: { color: chartColors.grid } }
    }
  };
  return <Bar data={data} options={options} />;
}
