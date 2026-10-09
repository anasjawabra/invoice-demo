// A bar chart whose amounts all share ONE unit (stated in the axis title); tooltips also show the exact SAR.
import React, { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAr } from '../../utils/useAr';
import { chartUnit, fmtSar } from '../../utils/money';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
const COLORS = ['rgba(45, 95, 139, 0.8)', 'rgba(27, 131, 84, 0.8)', 'rgba(255, 193, 7, 0.85)', 'rgba(175, 8, 24, 0.7)'];

export default function UnitBar({ labels, series, height = 250, label }) {
  const { lang, isRtl } = useAr();
  const cu = useMemo(() => chartUnit(series.flatMap((s) => s.values).filter((v) => v != null), lang), [series, lang]);
  const data = useMemo(() => ({ labels, datasets: series.map((s, i) => ({ label: s.label, data: s.values, backgroundColor: s.color || COLORS[i % COLORS.length], borderRadius: 3 })) }), [labels, series]);
  const options = useMemo(() => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', rtl: isRtl, labels: { boxWidth: 12, font: { size: 11 } } }, tooltip: { rtl: isRtl, callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y == null ? '—' : cu.fmt(c.parsed.y)}`, afterLabel: (c) => (c.parsed.y == null ? '' : fmtSar(c.parsed.y)) } } }, scales: { x: { reverse: isRtl, grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, title: { display: true, text: cu.title, font: { size: 11 } }, ticks: { callback: (v) => cu.tick(v) } } } }), [cu, isRtl]);
  return <div className="rv-chart" style={{ height, position: 'relative', width: '100%' }} role="img" aria-label={label}><Bar data={data} options={options} /></div>;
}
