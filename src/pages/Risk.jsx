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
import { useToast } from '../components/Toast';
import { RISKS } from '../data/mock';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function badgeForLevel(score) {
  if (score >= 80) return 'badge--red';
  if (score >= 60) return 'badge--orange';
  if (score >= 40) return 'badge--gold';
  return 'badge--green';
}

export default function Risk() {
  const { t, lang, T, isRtl } = useI18n();
  const toast = useToast();

  const labels = useMemo(() => {
    const v = t('risk_labels');
    return Array.isArray(v) ? v : ['0-20', '21-40', '41-60', '61-80', '81-100'];
  }, [t]);

  const buckets = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const r of RISKS) {
      const s = r.score;
      if (s <= 20) counts[0]++;
      else if (s <= 40) counts[1]++;
      else if (s <= 60) counts[2]++;
      else if (s <= 80) counts[3]++;
      else counts[4]++;
    }
    return counts;
  }, []);

  const stats = useMemo(() => {
    const high = RISKS.filter((r) => r.score >= 60).length;
    const mid = RISKS.filter((r) => r.score >= 40 && r.score < 60).length;
    const acc = 88.6;
    return { intercepted: 214, high, mid, acc };
  }, []);

  const chartRef = useRef(null);
  useEffect(() => {
    return () => chartRef.current?.destroy?.();
  }, []);

  const data = useMemo(() => {
    return {
      labels,
      datasets: [
        {
          label: t('risk_dist'),
          data: buckets,
          backgroundColor: ['rgba(53,208,127,0.35)', 'rgba(245,180,69,0.35)', 'rgba(255,159,67,0.35)', 'rgba(255,106,106,0.35)', 'rgba(255,106,106,0.60)'],
          borderColor: ['rgba(53,208,127,0.95)', 'rgba(245,180,69,0.95)', 'rgba(255,159,67,0.95)', 'rgba(255,106,106,0.95)', 'rgba(255,106,106,0.95)'],
          borderWidth: 1,
          borderRadius: 10
        }
      ]
    };
  }, [buckets, labels, t]);

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
          ticks: { color: '#9aa8c7', precision: 0 },
          grid: { color: 'rgba(255,255,255,0.06)' }
        }
      }
    };
  }, [isRtl, lang]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('risk')}</div>
          <div className="page-sub">{t('risk_dist_sub')}</div>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card card-pad">
          <div className="kpi__value">{stats.intercepted}</div>
          <div className="kpi__label">{t('risk_intercepted')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.high}</div>
          <div className="kpi__label">{t('risk_high')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.mid}</div>
          <div className="kpi__label">{t('risk_mid')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.acc}%</div>
          <div className="kpi__label">{t('risk_accuracy')}</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card chart-box" style={{ height: 360 }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="page-title" style={{ fontSize: 16 }}>{t('risk_dist')}</div>
              <div className="page-sub">{t('risk_dist_sub')}</div>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <Bar ref={chartRef} data={data} options={options} />
          </div>
        </div>

        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 16 }}>{t('risk_list')}</div>
          <div className="page-sub">{t('risk_list_sub')}</div>
          <div className="hr" />
          <div style={{ display: 'grid', gap: 12 }}>
            {RISKS.map((r) => (
              <div className="card" style={{ padding: 12, background: 'rgba(255,255,255,0.03)' }} key={r.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950 }}>{r.id}</div>
                    <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{T(r, 'entity')}</div>
                  </div>
                  <span className={`badge ${badgeForLevel(r.score)}`}>{r.score}</span>
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(lang === 'zh' ? r.types : lang === 'ar' ? r.typesAr : r.typesEn).map((x) => (
                    <span key={x} className="badge">{x}</span>
                  ))}
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('risk_evidence')}</div>
                  <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: 'var(--txt-dim)' }}>
                    {lang === 'zh' ? r.evidence : lang === 'ar' ? r.evidenceAr : r.evidenceEn}
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('risk_action')}</div>
                  <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: 'var(--txt-dim)' }}>
                    {lang === 'zh' ? r.action : lang === 'ar' ? r.actionAr : r.actionEn}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm" type="button" onClick={() => toast.info(`${r.id} · ${t('risk_action')}`)}>
                    {t('view_all')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
