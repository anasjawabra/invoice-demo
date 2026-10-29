import React from 'react';
import { Bar } from 'react-chartjs-2';

// Expense Coverage compared across scenarios (Base/Conservative/Optimistic/
// current Management Plan) — each already a fully computed cfoModel via
// DecisionRoom.jsx's `scenarioModels`, this only reads `.expenseCoverage`.
export default function CoverageChart({ scenarioModels, labels, isRtl }) {
  const keys = ['base', 'conservative', 'optimistic', 'current'];
  const data = {
    labels: keys.map((k) => labels[k] || k),
    datasets: [{
      data: keys.map((k) => scenarioModels[k]?.expenseCoverage ?? 0),
      backgroundColor: keys.map((k) => (k === 'current' ? 'rgba(10,111,166,0.85)' : 'rgba(139,160,152,0.55)')),
      borderRadius: 4, barPercentage: 0.6
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { rtl: isRtl, callbacks: { label: (ctx) => `${ctx.raw}%` } }
    },
    scales: {
      x: { reverse: isRtl, grid: { display: false } },
      y: { ticks: { callback: (v) => `${v}%` }, grid: { color: 'rgba(0,0,0,0.06)' } }
    }
  };
  return <Bar data={data} options={options} />;
}
