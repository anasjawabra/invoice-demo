import React, { useEffect, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { fmtMoney, COLLECTIONS, KPIS, PENALTY_STATUS } from '../data/mock';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function badgeForDelay(k) {
  if (k === 'high') return 'badge--red';
  if (k === 'mid') return 'badge--orange';
  return 'badge--green';
}

export default function Collection() {
  const { t, lang, T, isRtl } = useI18n();

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

  const data = useMemo(() => {
    return {
      labels: COLLECTIONS.map((c) => c.id),
      datasets: [
        {
          label: t('chart_recovery'),
          data: COLLECTIONS.map((c) => c.prob),
          backgroundColor: COLLECTIONS.map((c) =>
            c.prob >= 80 ? 'rgba(53,208,127,0.35)' : c.prob >= 50 ? 'rgba(245,180,69,0.35)' : 'rgba(255,106,106,0.28)'
          ),
          borderColor: COLLECTIONS.map((c) =>
            c.prob >= 80 ? 'rgba(53,208,127,0.95)' : c.prob >= 50 ? 'rgba(245,180,69,0.95)' : 'rgba(255,106,106,0.95)'
          ),
          borderWidth: 1,
          borderRadius: 10
        }
      ]
    };
  }, [t]);

  const options = useMemo(() => {
    const locale = lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en-US';
    return {
      responsive: true,
      maintainAspectRatio: false,
      locale,
      plugins: {
        legend: { display: false, rtl: isRtl },
        tooltip: { rtl: isRtl }
      },
      scales: {
        x: {
          reverse: isRtl,
          ticks: { color: '#9aa8c7' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#9aa8c7', callback: (v) => `${v}%` },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    };
  }, [isRtl, lang]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('collection')}</div>
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
        <div className="card chart-box" style={{ height: 360 }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="page-title" style={{ fontSize: 16 }}>{t('col_prob_dist')}</div>
              <div className="page-sub">{t('col_prob_sub')}</div>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Bar ref={chartRef} data={data} options={options} />
          </div>
        </div>

        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 16 }}>{t('col_penalty')}</div>
          <div className="page-sub">{t('col_list_sub')}</div>
          <div className="hr" />

          <div className="table-wrap">
            <table className="table" aria-label="Overdue collections">
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
                {COLLECTIONS.map((c) => {
                  const p = PENALTY_STATUS[c.penaltyKey];
                  const pLabel = lang === 'zh' ? p.label : lang === 'ar' ? p.labelAr : p.labelEn;
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 900 }}>{c.id}</td>
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

          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('th_strategy')}</div>
            <div style={{ marginTop: 6, display: 'grid', gap: 10 }}>
              {COLLECTIONS.map((c) => (
                <div className="card" key={c.id} style={{ padding: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontWeight: 900, fontSize: 12 }}>{c.id}</div>
                  <div className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
                    {lang === 'zh' ? c.strategy : lang === 'ar' ? c.strategyAr : c.strategyEn}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
