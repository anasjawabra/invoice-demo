import { fmtMoney, fmtSar, chartUnit, unitOfValues } from '../../utils/money';
import React, { useEffect, useMemo, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useL } from '../../utils/bi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

/* Monthly receipts: ACTUAL vs APPROVED TARGET vs INDEPENDENT FORECAST (+ indicative range),
   with an optional user SCENARIO drawn as a separate series. The four are never merged. */
export default function OutlookChart({ labels, actual, target, forecast, low, high, scenario, height = 300 }) {
  const { L, isRtl, lang, num } = useL();
  const cu = useMemo(() => chartUnit([...actual, ...target, ...forecast, ...low, ...high, ...(scenario || [])].filter((v) => v != null), lang === 'ar' ? 'ar' : 'en'), [actual, target, forecast, low, high, scenario, lang]); // ONE unit for the whole chart and its table
  const ref = useRef(null);
  useEffect(() => () => ref.current?.destroy?.(), []);

  const data = useMemo(() => {
    const ds = [
      { type: 'bar', label: L('Actual receipts', 'المقبوضات الفعلية'), data: actual, backgroundColor: 'rgba(27, 131, 84, 0.65)', borderRadius: 4, order: 3 },
      { type: 'line', label: L('Approved target (demo input)', 'المستهدف المعتمد (مُدخل توضيحي)'), data: target, borderColor: '#6C737F', backgroundColor: '#6C737F', borderWidth: 2, pointRadius: 2, tension: 0.2, order: 2 },
      { type: 'line', label: L('Indicative range (high)', 'النطاق الإرشادي (أعلى)'), data: high, borderColor: 'rgba(24, 73, 169, 0)', backgroundColor: 'rgba(24, 73, 169, 0.14)', pointRadius: 0, fill: '+1', order: 5 },
      { type: 'line', label: L('Indicative range (low)', 'النطاق الإرشادي (أدنى)'), data: low, borderColor: 'rgba(24, 73, 169, 0)', backgroundColor: 'rgba(24, 73, 169, 0.14)', pointRadius: 0, fill: false, order: 5 },
      { type: 'line', label: L('Independent forecast', 'التنبؤ المستقل'), data: forecast, borderColor: '#1849A9', backgroundColor: '#1849A9', borderWidth: 2.5, borderDash: [7, 5], pointRadius: 3, tension: 0.2, order: 1 }
    ];
    if (scenario && scenario.some((v) => v != null)) {
      ds.push({ type: 'line', label: L('User scenario (separate)', 'سيناريو المستخدم (منفصل)'), data: scenario, borderColor: '#F04438', backgroundColor: '#F04438', borderWidth: 2, borderDash: [2, 4], pointRadius: 3, tension: 0.2, order: 0 });
    }
    return { labels, datasets: ds };
  }, [labels, actual, target, forecast, low, high, scenario, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    locale: lang === 'ar' ? 'ar' : 'en-US',
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        rtl: isRtl,
        filter: (item) => !/range/i.test(item.dataset.label),
        callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y == null ? '—' : fmtMoney(c.parsed.y, { lang: lang === 'ar' ? 'ar' : 'en', unit: cu.unit })}`, afterLabel: (c) => (c.parsed.y == null ? '' : fmtSar(c.parsed.y, lang)) }
      }
    },
    scales: {
      x: { reverse: isRtl, grid: { display: false } },
      y: { beginAtZero: true, position: isRtl ? 'right' : 'left', title: { display: true, text: cu.title }, ticks: { callback: (v) => cu.tick(v) } }
    }
  }), [isRtl, lang, cu]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="rv-chart" style={{ height }} role="img" aria-label={L('Monthly receipts: actual versus approved target versus independent forecast', 'المقبوضات الشهرية: الفعلي مقابل المستهدف المعتمد مقابل التنبؤ المستقل')}>
        <Chart ref={ref} type="bar" data={data} options={options} />
      </div>
      <div className="rv-legend" aria-hidden="true">
        <span style={{ color: '#1B8354' }}><i style={{ background: 'rgba(27,131,84,.65)', height: 8 }} />{L('Actual receipts', 'المقبوضات الفعلية')}</span>
        <span style={{ color: '#6C737F' }}><i style={{ background: '#6C737F' }} />{L('Approved target (input)', 'المستهدف المعتمد (مُدخل)')}</span>
        <span style={{ color: '#1849A9' }}><i className="dash" />{L('Independent forecast', 'التنبؤ المستقل')}</span>
        <span style={{ color: '#1849A9' }}><i style={{ background: 'rgba(24, 73, 169,.2)', height: 8 }} />{L('Indicative range', 'النطاق الإرشادي')}</span>
        {scenario && scenario.some((v) => v != null) && <span style={{ color: '#F04438' }}><i className="dash" />{L('User scenario', 'سيناريو المستخدم')}</span>}
      </div>
      <details className="rv-table-alt">
        <summary>{L('Show data table', 'عرض جدول البيانات')} — {cu.title}</summary>
        <div className="rv-table-wrap">
          <table className="rv-table">
            <thead><tr><th>{L('Month', 'الشهر')}</th><th className="num">{L('Actual', 'الفعلي')}</th><th className="num">{L('Target', 'المستهدف')}</th><th className="num">{L('Forecast', 'التنبؤ')}</th><th className="num">{L('Range', 'النطاق')}</th>{scenario && <th className="num">{L('Scenario', 'السيناريو')}</th>}</tr></thead>
            <tbody>
              {labels.map((m, i) => (
                <tr key={m}>
                  <td>{m}</td>
                  <td className="num">{actual[i] == null ? '—' : num(actual[i], cu.unit)}</td>
                  <td className="num">{target[i] == null ? '—' : num(target[i], cu.unit)}</td>
                  <td className="num">{forecast[i] == null ? '—' : num(forecast[i], cu.unit)}</td>
                  <td className="num">{low[i] == null ? '—' : `${num(low[i], cu.unit)}–${num(high[i], cu.unit)}`}</td>
                  {scenario && <td className="num">{scenario[i] == null ? '—' : num(scenario[i], cu.unit)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
