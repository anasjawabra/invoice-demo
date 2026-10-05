import React from 'react';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '../../context/ThemeContext';
import { chartColor, chartTooltip, getChartTheme } from '../../utils/chartTheme';

// Generic sensitivity bar chart — reused for Revenue Sensitivity and
// Expense Sensitivity (each just a differently-computed `data` array of
// {key, netPosition}, from cfoModel.computeRevenueSensitivity /
// computeExpenseSensitivity). Bars are colored by sign of Net Position.
export default function SensitivityBarChart({ data, isRtl, money }) {
  const { theme } = useTheme();
  const chartColors = getChartTheme(theme);
  const chartData = {
    labels: data.map((d) => d.key),
    datasets: [{
      data: data.map((d) => d.netPosition),
      backgroundColor: data.map((d) => chartColor(d.netPosition >= 0 ? 'success' : 'danger', 0.75)),
      borderRadius: 4,
      barPercentage: 0.6
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
  return <Bar data={chartData} options={options} />;
}
