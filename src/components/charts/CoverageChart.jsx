import React from 'react';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '../../context/ThemeContext';
import { chartColor, chartTooltip, getChartTheme } from '../../utils/chartTheme';

// Expense Coverage compared across scenarios (Base/Conservative/Optimistic/
// current Management Plan) — each already a fully computed cfoModel via
// DecisionRoom.jsx's `scenarioModels`, this only reads `.expenseCoverage`.
export default function CoverageChart({ scenarioModels, labels, isRtl }) {
  const { theme } = useTheme();
  const chartColors = getChartTheme(theme);
  const keys = ['base', 'conservative', 'optimistic', 'current'];
  const data = {
    labels: keys.map((k) => labels[k] || k),
    datasets: [{
      data: keys.map((k) => scenarioModels[k]?.expenseCoverage ?? 0),
      backgroundColor: keys.map((k) => (k === 'current' ? chartColor('info', 0.85) : chartColor('neutral', 0.55))),
      borderRadius: 4, barPercentage: 0.6
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: chartTooltip(theme, isRtl, { callbacks: { label: (ctx) => `${ctx.raw}%` } })
    },
    scales: {
      x: { reverse: isRtl, ticks: { color: chartColors.text }, grid: { display: false } },
      y: { ticks: { color: chartColors.text, callback: (v) => `${v}%` }, grid: { color: chartColors.grid } }
    }
  };
  return <Bar data={data} options={options} />;
}
