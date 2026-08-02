import React, { useEffect, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { fmtMoney, INVOICES, KPIS, PROACTIVE, SOURCES, STATUS, TREND } from '../data/mock';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend);

function badgeForColor(c) {
  switch (c) {
    case 'teal':
      return 'badge--teal';
    case 'indigo':
      return 'badge--indigo';
    case 'gold':
      return 'badge--gold';
    case 'green':
      return 'badge--green';
    case 'red':
      return 'badge--red';
    case 'orange':
      return 'badge--orange';
    case 'blue':
      return 'badge--blue';
    case 'purple':
      return 'badge--purple';
    default:
      return '';
  }
}

export default function Dashboard() {
  const { t, lang, T, isRtl } = useI18n();
  const { user } = useAuth();

  const orgScale = user?.org?.scale ?? 1;

  const trendLabels = useMemo(() => {
    if (lang === 'zh') return TREND.labels;
    if (lang === 'ar') return TREND.labelsAr;
    return TREND.labelsEn;
  }, [lang]);

  const baseChartOptions = useMemo(() => {
    const locale = lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en-US';
    return {
      responsive: true,
      maintainAspectRatio: false,
      locale,
      plugins: {
        legend: {
          rtl: isRtl,
          labels: {
            color: '#9aa8c7',
            boxWidth: 10,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          rtl: isRtl
        }
      },
      scales: {
        x: {
          reverse: isRtl,
          ticks: { color: '#9aa8c7' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        },
        y: {
          ticks: { color: '#9aa8c7' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    };
  }, [isRtl, lang]);

  const trendRef = useRef(null);
  const recoveryRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    return () => {
      trendRef.current?.destroy?.();
      recoveryRef.current?.destroy?.();
      sourceRef.current?.destroy?.();
    };
  }, []);

  const kpis = useMemo(() => {
    return KPIS.map((k) => {
      let v = k.value;
      if (k.id === 'processed' || k.id === 'anomaly') v = Math.round(v * orgScale);
      if (k.id === 'amount') v = Math.round(v * orgScale * 100) / 100;
      return { ...k, _value: v };
    });
  }, [orgScale]);

  const trendData = useMemo(() => {
    const processed = TREND.processed.map((v) => Math.round(v * orgScale));
    return {
      labels: trendLabels,
      datasets: [
        {
          type: 'bar',
          label: t('chart_volume'),
          data: processed,
          backgroundColor: 'rgba(23, 201, 184, 0.35)',
          borderColor: 'rgba(23, 201, 184, 0.85)',
          borderWidth: 1,
          borderRadius: 8,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: t('chart_automation'),
          data: TREND.automation,
          borderColor: 'rgba(109, 139, 255, 0.95)',
          backgroundColor: 'rgba(109, 139, 255, 0.12)',
          tension: 0.35,
          pointRadius: 2,
          yAxisID: 'y1'
        }
      ]
    };
  }, [orgScale, t, trendLabels]);

  const trendOptions = useMemo(() => {
    return {
      ...baseChartOptions,
      scales: {
        x: { ...baseChartOptions.scales.x, reverse: isRtl },
        y: {
          ...baseChartOptions.scales.y,
          title: { display: false },
          ticks: { ...baseChartOptions.scales.y.ticks }
        },
        y1: {
          position: isRtl ? 'left' : 'right',
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false, color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#9aa8c7', callback: (v) => `${v}%` }
        }
      }
    };
  }, [baseChartOptions, isRtl]);

  const sourceData = useMemo(() => {
    const labels = SOURCES.map((s) => s.name);
    const data = SOURCES.map((s) => Math.round(s.count * orgScale));
    const colors = SOURCES.map((s) => {
      const c = getComputedStyle(document.documentElement).getPropertyValue(`--${s.color}`).trim();
      return c || '#17c9b8';
    });

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors.map((c) => `${c}CC`),
          borderColor: colors,
          borderWidth: 1
        }
      ]
    };
  }, [orgScale]);

  const sourceOptions = useMemo(() => {
    const locale = lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en-US';
    return {
      responsive: true,
      maintainAspectRatio: false,
      locale,
      plugins: {
        legend: {
          position: 'bottom',
          rtl: isRtl,
          labels: { color: '#9aa8c7', boxWidth: 10, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: { rtl: isRtl }
      }
    };
  }, [isRtl, lang]);

  const recoveryData = useMemo(() => {
    return {
      labels: trendLabels,
      datasets: [
        {
          label: t('chart_recovery'),
          data: TREND.recovery,
          borderColor: 'rgba(53, 208, 127, 0.95)',
          backgroundColor: 'rgba(53, 208, 127, 0.10)',
          tension: 0.35,
          pointRadius: 2,
          fill: true
        }
      ]
    };
  }, [t, trendLabels]);

  const recoveryOptions = useMemo(() => {
    return {
      ...baseChartOptions,
      scales: {
        x: { ...baseChartOptions.scales.x, reverse: isRtl },
        y: {
          ...baseChartOptions.scales.y,
          min: 70,
          max: 95,
          ticks: { color: '#9aa8c7', callback: (v) => `${v}%` }
        }
      }
    };
  }, [baseChartOptions, isRtl]);

  const recent = useMemo(() => {
    return [...INVOICES]
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6);
  }, []);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="banner banner--teal card">
        <div>
          <b>
            {t('org_scope')} · {T(user?.org, 'name')}
          </b>
          <p>{t('org_scope_note')}</p>
        </div>
        <span className="badge badge--indigo">{user?.org?.code}</span>
      </div>

      <div className="banner banner--gold card">
        <div>
          <b>{t('hitl_banner')}</b>
          <p>{t('hitl_desc')}</p>
        </div>
        <span className="badge badge--gold">HITL</span>
      </div>

      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 10 }}>
          <div>
            <div className="page-title" style={{ fontSize: 16 }}>{t('proactive_title')}</div>
            <div className="page-sub">{t('proactive_sub')}</div>
          </div>
        </div>

        <div className="grid grid-4">
          {PROACTIVE.map((p, idx) => (
            <div className="card" style={{ padding: 14 }} key={idx}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 13 }}>{T(p, 'title')}</div>
                  <div style={{ marginTop: 8, color: 'var(--txt-dim)', fontSize: 12, lineHeight: 1.6 }}>{T(p, 'desc')}</div>
                </div>
                <span className={`badge ${badgeForColor(p.color)}`}>AI</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-sm" type="button">{t('pro_act')}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-3">
        {kpis.map((k) => {
          const unit = lang === 'zh' ? k.unit : lang === 'ar' ? k.unitAr : k.unitEn;
          const delta = k.delta;
          const deltaColor = delta >= 0 ? 'var(--green)' : 'var(--red)';

          const val =
            k.id === 'automation' || k.id === 'recovery'
              ? `${k._value.toFixed(1)}${unit}`
              : k.id === 'cycle'
                ? `${k._value}${unit}`
                : k.id === 'amount'
                  ? `${k._value.toFixed(2)} ${unit}`
                  : `${fmtMoney(k._value)}${unit ? ` ${unit}` : ''}`;

          return (
            <div className="card card-pad" key={k.id}>
              <div className="kpi">
                <div className="kpi__icon">
                  <span className={`badge ${badgeForColor(k.color)}`}>{k.id.toUpperCase()}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="kpi__value">{val}</div>
                  <div className="kpi__label">{T(k, 'label')}</div>
                  <div className="kpi__delta">
                    <span style={{ color: deltaColor, fontWeight: 900 }}>{delta >= 0 ? '+' : ''}{delta}%</span>
                    <span className="muted">&nbsp;MoM</span>
                  </div>
                </div>
              </div>
              {typeof k.target === 'number' ? (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="muted" style={{ fontSize: 12 }}>{t('kpi_target')}: {k.target}%</span>
                  <span className={`badge ${k._value >= k.target ? 'badge--green' : 'badge--orange'}`}>
                    {k._value >= k.target ? t('kpi_achieved') : t('kpi_not_achieved')}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="charts">
        <div className="card chart-box" style={{ height: 340 }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="page-title" style={{ fontSize: 16 }}>{t('trend_title')}</div>
              <div className="page-sub">{t('trend_sub')}</div>
            </div>
          </div>
          <div style={{ height: 270 }}>
            <Bar ref={trendRef} data={trendData} options={trendOptions} />
          </div>
        </div>

        <div className="card chart-box" style={{ height: 340 }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="page-title" style={{ fontSize: 16 }}>{t('src_title')}</div>
              <div className="page-sub">{t('recent_sub')}</div>
            </div>
          </div>
          <div style={{ height: 260 }}>
            <Doughnut ref={sourceRef} data={sourceData} options={sourceOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="page-head" style={{ marginBottom: 10 }}>
            <div>
              <div className="page-title" style={{ fontSize: 16 }}>{t('src_title')}</div>
              <div className="page-sub">{t('recent_sub')}</div>
            </div>
          </div>

          <div className="source-cards">
            {SOURCES.map((s) => (
              <div key={s.id} className="card source-card">
                <div>
                  <b>{s.name}</b>
                  <p>{T(s, 'desc')}</p>
                </div>
                <span className={`badge ${badgeForColor(s.color)}`}>{fmtMoney(Math.round(s.count * orgScale))}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card chart-box" style={{ height: 360 }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="page-title" style={{ fontSize: 16 }}>{t('recovery_title')}</div>
              <div className="page-sub">{t('recovery_sub')}</div>
            </div>
          </div>
          <div style={{ height: 285 }}>
            <Line ref={recoveryRef} data={recoveryData} options={recoveryOptions} />
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 10 }}>
          <div>
            <div className="page-title" style={{ fontSize: 16 }}>{t('recent_title')}</div>
            <div className="page-sub">{t('recent_sub')}</div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table" aria-label="Recent invoices">
            <thead>
              <tr>
                <th>{t('th_id')}</th>
                <th>{t('th_vendor')}</th>
                <th>{t('th_amount')}</th>
                <th>{t('th_source')}</th>
                <th>{t('th_status')}</th>
                <th>{t('th_po')}</th>
                <th>{t('th_date')}</th>
                <th>{t('th_risk')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((inv) => {
                const st = STATUS[inv.status];
                const badge = st?.color ? badgeForColor(st.color) : '';
                const statusLabel = lang === 'zh' ? st?.label : lang === 'ar' ? st?.labelAr : st?.labelEn;
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 850 }}>{inv.id}</td>
                    <td>{T(inv, 'entity')}</td>
                    <td>{fmtMoney(Math.round(inv.amount * orgScale))} {inv.currency}</td>
                    <td>{inv.source}</td>
                    <td>
                      <span className={`badge ${badge}`}>{statusLabel}</span>
                    </td>
                    <td>{inv.po}</td>
                    <td>{inv.date}</td>
                    <td>
                      <span className={`badge ${inv.risk >= 60 ? 'badge--red' : inv.risk >= 40 ? 'badge--orange' : 'badge--green'}`}>
                        {inv.risk}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
