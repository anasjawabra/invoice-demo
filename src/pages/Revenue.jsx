import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { fmtMoney, ORGS, REVENUE_AMANAH, REVENUE_SECTORS, REVENUE_SOURCES } from '../data/mock';
import { REVENUE_ANALYSIS } from '../data/aiProcess';
import AIProcessDrawer from '../components/ai/AIProcessDrawer';
import { exportCSV } from '../utils/export';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/* SCR-10 attainment chip: red below 60%, gold below 80%, green otherwise. */
function badgeForAttain(ratio) {
  if (ratio < 0.6) return 'badge--red';
  if (ratio < 0.8) return 'badge--gold';
  return 'badge--green';
}

export default function Revenue() {
  const { t, lang, T, isRtl } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const scale = user?.org?.scale ?? 1;

  const [sector, setSector] = useState('all');
  const [period, setPeriod] = useState('month');
  const [drawer, setDrawer] = useState(null);

  const chartRef = useRef(null);
  useEffect(() => () => chartRef.current?.destroy?.(), []);

  const sources = useMemo(() => (
    REVENUE_SOURCES.filter((s) => sector === 'all' || s.sector === sector)
  ), [sector]);

  const totals = useMemo(() => {
    const invoiced = sources.reduce((s, r) => s + r.invoiced, 0) * scale;
    const collected = sources.reduce((s, r) => s + r.collected, 0) * scale;
    const target = sources.reduce((s, r) => s + r.target, 0) * scale;
    return { invoiced, collected, target, attain: target ? collected / target : 0, gap: target - collected };
  }, [sources, scale]);

  const data = useMemo(() => ({
    labels: sources.map((s) => T(s, 'label')),
    datasets: [
      {
        label: t('chart_invoiced'),
        data: sources.map((s) => Math.round(s.invoiced * scale)),
        backgroundColor: 'rgba(0, 90, 150, 0.35)',
        borderColor: 'rgba(0, 90, 150, 0.95)',
        borderWidth: 1,
        borderRadius: 8
      },
      {
        label: t('chart_collected'),
        data: sources.map((s) => Math.round(s.collected * scale)),
        backgroundColor: 'rgba(38, 99, 75, 0.4)',
        borderColor: 'rgba(38, 99, 75, 0.95)',
        borderWidth: 1,
        borderRadius: 8
      }
    ]
  }), [sources, scale, t, T]);

  const options = useMemo(() => {
    const locale = lang === 'ar' ? 'ar' : lang === 'zh' ? 'zh-CN' : 'en-US';
    return {
      responsive: true,
      maintainAspectRatio: false,
      locale,
      plugins: {
        legend: { rtl: isRtl, labels: { color: '#4A4A4A', boxWidth: 10, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232',
          borderColor: '#EAEAEA', borderWidth: 1,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)} SAR` }
        }
      },
      scales: {
        x: { reverse: isRtl, ticks: { color: '#4A4A4A', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { ticks: { color: '#4A4A4A', callback: (v) => `${Math.round(v / 1e6)}M` }, grid: { color: 'rgba(0,0,0,0.06)' } }
      }
    };
  }, [isRtl, lang]);

  function doExport() {
    exportCSV('revenue-report', sources.map((s) => ({
      source: T(s, 'label'),
      sector: T(REVENUE_SECTORS[s.sector], 'label'),
      invoiced: Math.round(s.invoiced * scale),
      collected: Math.round(s.collected * scale),
      target: Math.round(s.target * scale),
      attainment_pct: Math.round((s.collected / s.target) * 100),
      yoy_pct: Math.round(((s.collected - s.lastYear) / s.lastYear) * 100)
    })));
    toast.success(`${t('toast_export')}revenue-report.csv`);
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('revenue')}</div>
          <div className="page-sub">{t('rev_sub')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge--indigo" title={t('persona_main')}>{t('persona_rev_manager')} · {t('persona_amanah_leader')}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={doExport}>
            {t('rcn_export')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setDrawer(REVENUE_ANALYSIS)}>
            {t('rev_ai_btn')}
          </button>
        </div>
      </div>

      {/* Filters: sector chips + period select */}
      <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('rev_filter_sector')}</span>
        {['all', 'municipal', 'housing'].map((k) => (
          <button
            key={k}
            type="button"
            className={`btn btn-sm ${sector === k ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSector(k)}
          >
            {k === 'all' ? t('ad_all') : T(REVENUE_SECTORS[k], 'label')}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('rev_period')}</span>
        <select
          className="select"
          style={{ width: 140 }}
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            if (e.target.value !== 'month') toast.info(t('rev_period_demo'));
          }}
          aria-label={t('rev_period')}
        >
          <option value="month">{t('rev_period_month')}</option>
          <option value="quarter">{t('rev_period_quarter')}</option>
          <option value="year">{t('rev_period_year')}</option>
        </select>
      </div>

      <div className="grid grid-4">
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr">{(totals.invoiced / 1e6).toFixed(1)}M</div>
          <div className="kpi__label">{t('rev_kpi_invoiced')} (SAR)</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr">{(totals.collected / 1e6).toFixed(1)}M</div>
          <div className="kpi__label">{t('rev_kpi_collected')} (SAR)</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" style={{ color: totals.attain < 0.6 ? 'var(--red, #AF0818)' : undefined }} dir="ltr">
            {(totals.attain * 100).toFixed(1)}%
          </div>
          <div className="kpi__label">{t('rev_kpi_attain')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr">{(totals.gap / 1e6).toFixed(1)}M</div>
          <div className="kpi__label">{t('rev_kpi_gap')} (SAR)</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card chart-box" style={{ height: 380 }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="page-title" style={{ fontSize: 16 }}>{t('th_source')}</div>
              <div className="page-sub">{t('rev_sub')}</div>
            </div>
          </div>
          <div style={{ height: 300 }}>
            <Bar ref={chartRef} data={data} options={options} />
          </div>
        </div>

        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 16 }}>{t('rev_amanah')}</div>
          <div className="page-sub">{t('rev_coverage')}</div>
          <div className="hr" />
          <div style={{ display: 'grid', gap: 12 }}>
            {REVENUE_AMANAH.map((a) => {
              const org = ORGS.find((o) => o.id === a.orgId);
              const attain = a.collected / a.target;
              return (
                <div className="card" key={a.orgId} style={{ padding: 12, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 950, fontSize: 13 }}>{org ? T(org, 'name') : a.orgId}</div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }} dir="ltr">
                        {fmtMoney(Math.round(a.collected * scale))} / {fmtMoney(Math.round(a.target * scale))} SAR
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {a.coverage != null ? (
                        <span className="badge badge--teal" dir="ltr">{t('rev_coverage')} ×{a.coverage}</span>
                      ) : null}
                      <span className={`badge ${badgeForAttain(attain)}`}>{Math.round(attain * 100)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="table-wrap">
          <table className="table" aria-label="Revenue by source">
            <thead>
              <tr>
                <th>{t('th_source')}</th>
                <th>{t('rev_filter_sector')}</th>
                <th>{t('th_invoiced')}</th>
                <th>{t('th_collected')}</th>
                <th>{t('th_target')}</th>
                <th>{t('th_attain')}</th>
                <th>{t('th_yoy')}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const attain = s.collected / s.target;
                const yoy = ((s.collected - s.lastYear) / s.lastYear) * 100;
                return (
                  <tr key={s.id} style={attain < 0.6 ? { background: 'rgba(175, 8, 24, 0.04)' } : undefined}>
                    <td style={{ fontWeight: 900 }}>{T(s, 'label')}</td>
                    <td><span className="badge badge--indigo">{T(REVENUE_SECTORS[s.sector], 'label')}</span></td>
                    <td dir="ltr">{fmtMoney(Math.round(s.invoiced * scale))}</td>
                    <td dir="ltr">{fmtMoney(Math.round(s.collected * scale))}</td>
                    <td dir="ltr">{fmtMoney(Math.round(s.target * scale))}</td>
                    <td dir="ltr"><span className={`badge ${badgeForAttain(attain)}`}>{Math.round(attain * 100)}%</span></td>
                    <td dir="ltr" style={{ color: yoy >= 0 ? 'var(--green, #006604)' : 'var(--red, #AF0818)', fontWeight: 800 }}>
                      {yoy >= 0 ? '+' : ''}{yoy.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AIProcessDrawer open={!!drawer} onClose={() => setDrawer(null)} data={drawer} />
    </div>
  );
}
