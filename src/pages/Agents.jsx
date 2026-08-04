import React from 'react';
import { useI18n } from '../context/I18nContext';
import { AGENTS } from '../data/mock';
import OrchestrationMap from '../components/ai/OrchestrationMap';

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

export default function Agents() {
  const { t, lang, T } = useI18n();

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('agents')}</div>
          <div className="page-sub">{t('agent_center_desc')}</div>
        </div>
      </div>

      <div className="banner banner--teal card">
        <div>
          <b>{t('agent_center_banner')}</b>
          <p>{t('agent_center_desc')}</p>
        </div>
        <span className="badge badge--teal">A0-A6</span>
      </div>

      <OrchestrationMap />

      <div className="agent-grid">
        {AGENTS.map((a) => (
          <div className="card agent-card" key={a.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h3>
                  {a.id} · {T(a, 'name')}
                </h3>
                <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  {T(a, 'form')} · {a.en}
                </div>
              </div>
              <span className={`badge ${badgeForColor(a.color)}`}>{t('online')}</span>
            </div>

            <p>{T(a, 'desc')}</p>

            <div className="agent-meta">
              <div className="meta-item">
                <b>{t('agent_calls')}</b>
                <span>{a.calls.toLocaleString('en-US')}</span>
              </div>
              <div className="meta-item">
                <b>{t('agent_acc')}</b>
                <span>{a.acc}%</span>
              </div>
              <div className="meta-item" style={{ gridColumn: '1 / -1' }}>
                <b>Model</b>
                <span>{lang === 'zh' ? a.model : lang === 'ar' ? a.modelAr : a.modelEn}</span>
              </div>
              <div className="meta-item" style={{ gridColumn: '1 / -1' }}>
                <b>Use Case</b>
                <span>{a.uc}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
