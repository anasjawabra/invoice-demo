// ONE chart: cumulative collected revenue by month — the plan against the actual. The actual line stops at the reporting month (later months have no value, they are not zero).
import React, { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, LineController, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAr } from '../../utils/useAr';
import { chartUnit, fmtSar } from '../../utils/money';
import { fmtMonthText } from '../../data/clock';

// registered explicitly: the production bundle drops the registration that react-chartjs-2 performs as an import side effect in development
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Tooltip, Legend);

export default function CollectionChart({ year, planned, actual, plannedLabel, actualLabel, label, height = 280 }) {
  const { lang, isRtl } = useAr();
  const cu = useMemo(() => chartUnit([...planned, ...actual].filter((v) => v != null), lang), [planned, actual, lang]);
  const labels = useMemo(() => planned.map((_, i) => fmtMonthText(`${year}-${String(i + 1).padStart(2, '0')}`, lang).replace(/\s?\d{4}$/, '')), [planned, year, lang]);
  const data = useMemo(() => ({
    labels,
    datasets: [
      { label: plannedLabel, data: planned, borderColor: 'rgba(25, 65, 133, 0.85)', backgroundColor: 'rgba(25, 65, 133, 0.85)', borderDash: [6, 4], borderWidth: 2, pointRadius: 2, tension: 0 },
      { label: actualLabel, data: actual, borderColor: '#1B8354', backgroundColor: '#1B8354', borderWidth: 3, pointRadius: 3, tension: 0, spanGaps: false }
    ]
  }), [labels, planned, actual, plannedLabel, actualLabel]);
  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', rtl: isRtl, labels: { boxWidth: 14, font: { size: 12 } } }, tooltip: { rtl: isRtl, callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y == null ? '—' : cu.fmt(c.parsed.y)}`, afterLabel: (c) => (c.parsed.y == null ? '' : fmtSar(c.parsed.y)) } } },
    scales: { x: { reverse: isRtl, grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, position: isRtl ? 'right' : 'left', title: { display: true, text: cu.title, font: { size: 11 } }, ticks: { callback: (v) => cu.tick(v) } } }
  }), [cu, isRtl]);
  return <div className="rv-chart" style={{ height, position: 'relative', width: '100%' }} role="img" aria-label={label}><Line role="presentation" data={data} options={options} /></div>;
}
