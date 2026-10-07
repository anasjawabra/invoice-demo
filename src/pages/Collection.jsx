import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { fmtMoney, COLLECTIONS, KPIS, PENALTY_STATUS, TREND } from '../data/mock';
import { FORECAST_BASIS } from '../data/aiProcess';
import AIProcessDrawer from '../components/ai/AIProcessDrawer';
import CollectionDetailDrawer from '../components/ai/CollectionDetailDrawer';
import { useTheme } from '../context/ThemeContext';
import { chartColor, chartTooltip, getChartTheme } from '../utils/chartTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

function badgeForDelay(k) {
  if (k === 'high') return 'badge--red';
  if (k === 'mid') return 'badge--orange';
  return 'badge--green';
}

export default function Collection() {
  const { t, lang, T, isRtl } = useI18n();
  const { theme } = useTheme();
  const chartColors = useMemo(() => getChartTheme(theme), [theme]);
  const [drawer, setDrawer] = useState(null);
  const [detail, setDetail] = useState(null);

  const chartRef = useRef(null);
  useEffect(() => {
    return () => chartRef.current?.destroy?.();
  }, []);

  const kpiRecovery = KPIS.find((k) => k.id === 'recovery');

  const stats = useMemo(() => {
    const overdue = COLLECTIONS.length;
    const high = COLLECTIONS.filter((c) => c.delayKey === 'high').length;
    const acc = 86.1;
    return { overdue, high, acc };
  }, []);

  // Most urgent (lowest recovery probability) first, so the collection manager sees the worst cases up top.
  const sorted = useMemo(() => [...COLLECTIONS].sort((a, b) => a.prob - b.prob), []);

  // "Opportunity" flags — distinct from risk flags: which receivables give the
  // biggest lift to the overall collection rate if chased now, not just which
  // are riskiest. Ranked by (probability × amount) impact.
  const opportunities = useMemo(
    () => [...COLLECTIONS].filter((c) => c.prob >= 50).sort((a, b) => b.prob * b.amount - a.prob * a.amount).slice(0, 2),
    []
  );

  const lifetimeLabels = useMemo(() => {
    if (lang === 'zh') return TREND.labels;
    if (lang === 'ar') return TREND.labelsAr;
    return TREND.labelsEn;
  }, [lang]);

  const lifetimeData = useMemo(() => {
    return {
      labels: lifetimeLabels,
      datasets: [
        {
          label: t('col_lifetime_title'),
          data: TREND.invoiceLifetimeDays,
          borderColor: chartColor('info', 0.95),
          backgroundColor: chartColor('info', 0.10),
          tension: 0.35,
          pointRadius: 2,
          fill: true
        }
      ]
    };
  }, [lifetimeLabels, t]);

  const lifetimeOptions = useMemo(() => {
    const locale = lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en-US';
    return {
      responsive: true,
      maintainAspectRatio: false,
      locale,
      plugins: {
        legend: { display: false },
        tooltip: chartTooltip(theme, isRtl)
      },
      scales: {
        x: { reverse: isRtl, ticks: { color: chartColors.text }, grid: { color: chartColors.grid } },
        y: { beginAtZero: true, ticks: { color: chartColors.text, callback: (v) => `${v}${t('unit_day')}` }, grid: { color: chartColors.grid } }
      }
    };
  }, [chartColors, isRtl, lang, t, theme]);

  const data = useMemo(() => {
    return {
      labels: sorted.map((c) => c.id),
      datasets: [
        {
          label: t('chart_recovery'),
          data: sorted.map((c) => c.prob),
          backgroundColor: sorted.map((c) =>
            chartColor(c.prob >= 80 ? 'success' : c.prob >= 50 ? 'warning' : 'danger', c.prob >= 50 ? 0.35 : 0.28)
          ),
          borderColor: sorted.map((c) =>
            chartColor(c.prob >= 80 ? 'success' : c.prob >= 50 ? 'warning' : 'danger', 0.95)
          ),
          borderWidth: 1,
          borderRadius: 10
        }
      ]
    };
  }, [t, sorted]);

  const options = useMemo(() => {
    const locale = lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en-US';
    return {
      responsive: true,
      maintainAspectRatio: false,
      locale,
      plugins: {
        legend: { display: false, rtl: isRtl },
        tooltip: chartTooltip(theme, isRtl)
      },
      scales: {
        x: {
          reverse: isRtl,
          ticks: { color: chartColors.text },
          grid: { color: chartColors.grid }
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: chartColors.text, callback: (v) => `${v}%` },
          grid: { color: chartColors.grid }
        }
      }
    };
  }, [chartColors, isRtl, lang, theme]);

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('collection')}</h1>
          <div className="page-sub">{t('col_prob_sub')}</div>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card card-pad">
          <div className="kpi__value">{kpiRecovery?.value?.toFixed?.(1) ?? 87.3}%</div>
          <div className="kpi__label">{t('col_rate')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.overdue}</div>
          <div className="kpi__label">{t('col_overdue')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.high}</div>
          <div className="kpi__label">{t('col_high_risk')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.acc}%</div>
          <div className="kpi__label">{t('col_accuracy')}</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('col_opportunity_title')}</div>
          <div className="page-sub">{t('col_opportunity_sub')}</div>
          <div className="hr" />
          <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
            {opportunities.map((c) => (
              <div className="card" key={c.id} style={{ padding: 'var(--spacing-md)', background: 'var(--surface-primary-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }}>{c.id} · {T(c, 'entity')}</div>
                  <span className="badge badge--green">{c.prob}%</span>
                </div>
                <div className="muted" style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--text-xs)' }}>
                  {fmtMoney(c.amount)} SAR · {t('col_opportunity_hint')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card chart-box" style={{ height: 260 }}>
          <div className="page-head" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('col_lifetime_title')}</div>
              <div className="page-sub">{t('col_lifetime_sub')}</div>
            </div>
          </div>
          <div style={{ height: 180 }}>
            <Line data={lifetimeData} options={lifetimeOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card chart-box" style={{ height: 360 }}>
          <div className="page-head" style={{ marginBottom: 'var(--spacing-md)' }}>
            <div>
              <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('col_prob_dist')}</div>
              <div className="page-sub">{t('col_prob_sub')}</div>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Bar ref={chartRef} data={data} options={options} />
          </div>
        </div>

        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('col_penalty')}</div>
          <div className="page-sub">{t('col_list_sub')}</div>
          <div className="hr" />

          <div className="table-wrap" tabIndex={0}>
            <table className="table" aria-label={t('a11y_overdue_collections')}>
              <thead>
                <tr>
                  <th>{t('th_id')}</th>
                  <th>{t('th_vendor')}</th>
                  <th>{t('th_overdue')}</th>
                  <th>{t('th_amount')}</th>
                  <th>{t('th_prob')}</th>
                  <th>{t('th_delay')}</th>
                  <th>{t('th_penalty')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const p = PENALTY_STATUS[c.penaltyKey];
                  const pLabel = lang === 'zh' ? p.label : lang === 'ar' ? p.labelAr : p.labelEn;
                  return (
                    <tr
                      key={c.id}
                      style={{
                        cursor: 'pointer',
                        background: c.delayKey === 'high' ? 'var(--danger-soft)' : undefined
                      }}
                      onClick={() => setDetail(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') setDetail(c); }}
                    >
                      <td style={{ fontWeight: 700 }}>{c.id}</td>
                      <td>{T(c, 'entity')}</td>
                      <td>{c.overdue} {t('unit_day')}</td>
                      <td>{fmtMoney(c.amount)} SAR</td>
                      <td>
                        <span className={`badge ${c.prob >= 80 ? 'badge--green' : c.prob >= 50 ? 'badge--gold' : 'badge--red'}`}>{c.prob}%</span>
                      </td>
                      <td>
                        <span className={`badge ${badgeForDelay(c.delayKey)}`}>{lang === 'zh' ? c.delay : lang === 'ar' ? c.delayAr : c.delayEn}</span>
                      </td>
                      <td>
                        <span className="badge">{c.penaltyKey === 'none' ? t('penalty_none') : pLabel}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 'var(--spacing-lg)' }}>
            <div className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>{t('th_strategy')}</div>
            <div style={{ marginTop: 'var(--spacing-xs)', display: 'grid', gap: 'var(--spacing-md)' }}>
              {sorted.map((c) => (
                <div
                  className="card"
                  key={c.id}
                  style={{
                    padding: 'var(--spacing-md)',
                    background: c.delayKey === 'high' ? 'var(--danger-soft)' : 'var(--surface-subtle)'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)' }}>{c.id}</div>
                  <div className="muted" style={{ marginTop: 'var(--spacing-xs)', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}>
                    {lang === 'zh' ? c.strategy : lang === 'ar' ? c.strategyAr : c.strategyEn}
                  </div>
                  <div style={{ marginTop: 'var(--spacing-md)' }}>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setDrawer(FORECAST_BASIS[c.id])}>
                      {t('ai_basis_btn')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CollectionDetailDrawer
        c={detail}
        open={!!detail}
        onClose={() => setDetail(null)}
        onOpenAI={() => setDrawer(FORECAST_BASIS[detail.id])}
      />
      <AIProcessDrawer open={!!drawer} onClose={() => setDrawer(null)} data={drawer} />
    </div>
  );
}
