// A line chart of cumulative amounts: every series shares ONE unit (stated in the axis title); a `null` value ends a line (later months have no value — they are not zero).
import React, { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, LineController, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAr } from '../../utils/useAr';
import { chartUnit, fmtSar } from '../../utils/money';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Tooltip, Legend);
const STYLES = [
  { borderColor: 'rgba(25, 65, 133, 0.9)', backgroundColor: 'rgba(25, 65, 133, 0.9)', borderWidth: 3 },
  { borderColor: '#1B8354', backgroundColor: '#1B8354', borderWidth: 3 },
  { borderColor: 'rgba(181, 71, 8, 0.9)', backgroundColor: 'rgba(181, 71, 8, 0.9)', borderWidth: 2, borderDash: [6, 4] }
];

export default function UnitLines({ labels, series, height = 260, label }) {
  const { lang, isRtl } = useAr();
  const cu = useMemo(() => chartUnit(series.flatMap((s) => s.values).filter((v) => v != null), lang), [series, lang]);
  const data = useMemo(() => ({ labels, datasets: series.map((s, i) => ({ label: s.label, data: s.values, ...(s.style || STYLES[i % STYLES.length]), pointRadius: 3, tension: 0, spanGaps: false })) }), [labels, series]);
  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', rtl: isRtl, labels: { boxWidth: 14, font: { size: 12 } } }, tooltip: { rtl: isRtl, callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y == null ? '—' : cu.fmt(c.parsed.y)} (${c.parsed.y == null ? '' : fmtSar(c.parsed.y, lang)})` } } },
    scales: { x: { reverse: isRtl, grid: { display: false }, ticks: { font: { size: 11 } } }, y: { beginAtZero: true, position: isRtl ? 'right' : 'left', title: { display: true, text: cu.title, font: { size: 11 } }, ticks: { callback: (v) => cu.tick(v) } } }
  }), [cu, isRtl, lang]);
  return <div className="rv-chart" style={{ height, position: 'relative', width: '100%' }} role="img" aria-label={label}><Line role="presentation" data={data} options={options} /></div>;
}
