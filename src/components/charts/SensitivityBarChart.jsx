import React from 'react';
import { Bar } from 'react-chartjs-2';

// Generic sensitivity bar chart — reused for Revenue Sensitivity and
// Expense Sensitivity (each just a differently-computed `data` array of
// {key, netPosition}, from cfoModel.computeRevenueSensitivity /
// computeExpenseSensitivity). Bars are colored by sign of Net Position.
export default function SensitivityBarChart({ data, isRtl, money }) {
  const chartData = {
    labels: data.map((d) => d.key),
    datasets: [{
      data: data.map((d) => d.netPosition),
      backgroundColor: data.map((d) => (d.netPosition >= 0 ? 'rgba(62,133,64,0.75)' : 'rgba(196,81,76,0.75)')),
      borderRadius: 4,
      barPercentage: 0.6
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
  return <Bar data={chartData} options={options} />;
}
