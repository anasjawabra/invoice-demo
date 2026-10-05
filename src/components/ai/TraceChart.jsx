import React, { useMemo, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { useI18n } from '../../context/I18nContext';
import { L } from './util';
import { useTheme } from '../../context/ThemeContext';
import { chartColor, chartLegend, chartTooltip, getChartTheme } from '../../utils/chartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

const GREEN = chartColor('primary', 0.85);
const GREEN_SOFT = chartColor('primary', 0.30);
const BLUE = chartColor('info', 0.85);
const BLUE_SOFT = chartColor('info', 0.28);
const RED = chartColor('danger', 0.80);
const GOLD = chartColor('warning', 0.80);

/**
 * TraceChart — compact, on-theme (green/blue) chart embedded inside an AI
 * trace. Supports four small chart types used across scenarios:
 *   - factorBar     : horizontal factor-contribution bar (risk breakdown)
 *   - collectionCurve: collection-probability curve over the next N weeks
 *   - priceBench    : invoice unit price vs benchmark grouped bars
 *   - vatVariance   : declared vs computed vs ZATCA-expected VAT bars
 *
 * Props: { chartType, payload }  (payload label entries may be {zh,en,ar}).
 */
export default function TraceChart({ chartType, payload }) {
  const { t, lang, isRtl } = useI18n();
  const { theme } = useTheme();
  const chartColors = useMemo(() => getChartTheme(theme), [theme]);
  const ref = useRef(null);
  useEffect(() => () => ref.current?.destroy?.(), []);

  const baseOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false, rtl: isRtl },
      tooltip: chartTooltip(theme, isRtl)
    }
  }), [isRtl, theme]);

  const { title, node } = useMemo(() => {
    const resolveLabels = (arr) => (arr || []).map((x) => L(x, lang));
    if (chartType === 'factorBar') {
      const data = {
        labels: resolveLabels(payload.labels),
        datasets: [{
          data: payload.values,
          backgroundColor: payload.values.map((_, i) => (i === 0 ? RED : i === 1 ? GOLD : GREEN_SOFT)),
          borderColor: payload.values.map((_, i) => (i === 0 ? RED : i === 1 ? GOLD : GREEN)),
          borderWidth: 1,
          borderRadius: 6,
          barThickness: 14
        }]
      };
      const options = {
        ...baseOptions,
        indexAxis: 'y',
        scales: {
          x: { min: 0, max: payload.max || 100, reverse: isRtl, ticks: { color: chartColors.text }, grid: { color: chartColors.grid } },
          y: { position: isRtl ? 'right' : 'left', ticks: { color: chartColors.text, font: { size: 10 } }, grid: { display: false } }
        }
      };
      return { title: t('chart_factor'), node: <Bar ref={ref} data={data} options={options} /> };
    }

    if (chartType === 'collectionCurve') {
      const data = {
        labels: resolveLabels(payload.labels),
        datasets: [{
          data: payload.values,
          borderColor: GREEN,
          backgroundColor: GREEN_SOFT,
          tension: 0.35,
          pointRadius: 2,
          fill: true
        }]
      };
      const options = {
        ...baseOptions,
        scales: {
          x: { reverse: isRtl, ticks: { color: chartColors.text, font: { size: 10 } }, grid: { color: chartColors.grid } },
          y: { min: 0, max: 100, ticks: { color: chartColors.text, callback: (v) => `${v}%` }, grid: { color: chartColors.grid } }
        }
      };
      return { title: t('chart_collection'), node: <Line ref={ref} data={data} options={options} /> };
    }

    if (chartType === 'priceBench') {
      const data = {
        labels: resolveLabels(payload.labels),
        datasets: [
          { label: t('recon_invoice'), data: payload.invoice, backgroundColor: BLUE_SOFT, borderColor: BLUE, borderWidth: 1, borderRadius: 5 },
          { label: t('recon_bench'), data: payload.benchmark, backgroundColor: GREEN_SOFT, borderColor: GREEN, borderWidth: 1, borderRadius: 5 }
        ]
      };
      const options = {
        ...baseOptions,
        plugins: { ...baseOptions.plugins, legend: chartLegend(theme, { display: true, position: 'bottom', rtl: isRtl, labels: { boxWidth: 8, font: { size: 10 } } }) },
        scales: {
          x: { reverse: isRtl, ticks: { color: chartColors.text, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: chartColors.text }, grid: { color: chartColors.grid } }
        }
      };
      return { title: t('chart_bench'), node: <Bar ref={ref} data={data} options={options} /> };
    }

    // vatVariance
    const data = {
      labels: [t('recon_declared'), t('recon_computed'), t('recon_expected')],
      datasets: [{
        data: [payload.declared, payload.computed, payload.expected],
        backgroundColor: [payload.declared === payload.expected ? GREEN_SOFT : RED, GREEN_SOFT, BLUE_SOFT],
        borderColor: [payload.declared === payload.expected ? GREEN : RED, GREEN, BLUE],
        borderWidth: 1,
        borderRadius: 5,
        barThickness: 26
      }]
    };
    const options = {
      ...baseOptions,
      scales: {
        x: { reverse: isRtl, ticks: { color: chartColors.text, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: chartColors.text }, grid: { color: chartColors.grid } }
      }
    };
    return { title: t('chart_vat'), node: <Bar ref={ref} data={data} options={options} /> };
  }, [baseOptions, chartColors, chartType, isRtl, lang, payload, t, theme]);

  return (
    <div className="trace-chart">
      <div className="trace-chart__title">{title}</div>
      <div className="trace-chart__canvas">{node}</div>
    </div>
  );
}
