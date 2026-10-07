import React from 'react';
import ProvinceMap from '../../../components/ProvinceMap';
import { KSA_PROVINCES, KSA_PROVINCES_VIEWBOX } from '../../../data/ksaProvinces';
import { MAP_METRICS, AMANAH_RANK_CRITERIA, mapFillForMetric } from '../../../data/cfoModel';
import AssumptionsStrip from '../components/AssumptionsStrip';
import AmanahDetailPanel from '../components/AmanahDetailPanel';
import CopilotPanel from '../components/CopilotPanel';

const PRIORITY_BADGE = { high: 'badge--red', medium: 'badge--gold', low: 'badge--teal' };
const PROVINCE_BY_ISO = new Map(KSA_PROVINCES.map((province) => [province.iso, province]));

export default function DecisionRoomTab({
  t, lang, money, model, assumptions, onAssumptionsChange, scenarioKey, onJumpToTargets,
  byProvinceForMap, mapSelectedIso, setMapSelectedIso, mapMetric, setMapMetric,
  selectedAmanah, attentionAmanah, rankedAmanahs, rankCriterion, setRankCriterion,
  actionPlan, setActionField, recSentence
}) {
  const provinceName = (province) => {
    const localized = PROVINCE_BY_ISO.get(province?.iso) || province;
    if (lang === 'ar') return localized?.nameAr || province?.ar || province?.en || province?.iso;
    if (lang === 'zh') return localized?.name || province?.zh || province?.en || province?.iso;
    return localized?.nameEn || province?.en || province?.iso;
  };

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />

      <div className="grid grid-2" style={{ gap: 'var(--spacing-lg)', alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('dr_map_title')}</div>
          <div className="page-sub">{t('dr_map_sub')}</div>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', margin: 'var(--spacing-md) 0' }}>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t('cfo_map_metric_label')}</span>
            {MAP_METRICS.map((m) => (
              <button key={m} type="button" className={`btn btn-sm ${mapMetric === m ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMapMetric(m)}>
                {t(`cfo_map_metric_${m}`)}
              </button>
            ))}
          </div>
          <ProvinceMap
            provinces={byProvinceForMap}
            viewBox={KSA_PROVINCES_VIEWBOX}
            fillFor={(p) => mapFillForMetric(p, mapMetric)}
            selectedIso={mapSelectedIso}
            onSelect={setMapSelectedIso}
            titleFor={(p) => `${provinceName(p)} — ${p.rate ?? 0}%`}
          />
          {attentionAmanah && (
            <div className="banner banner--gold" style={{ marginTop: 'var(--spacing-md)' }}>
              <b>{t('cfo_attention_needed')}:</b> {provinceName(attentionAmanah)} — {attentionAmanah.rate}%
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_amanah_title')}</div>
          <AmanahDetailPanel amanah={selectedAmanah} money={money} t={t} lang={lang} />

          <div className="hr" style={{ margin: 'var(--spacing-xl) 0' }} />

          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t('cfo_rank_criterion')}</span>
            {AMANAH_RANK_CRITERIA.map((c) => (
              <button key={c} type="button" className={`btn btn-sm ${rankCriterion === c ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRankCriterion(c)}>
                {t(`cfo_rank_${c}`)}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 'var(--spacing-xs)', maxHeight: 260, overflowY: 'auto' }}>
            {rankedAmanahs.slice(0, 8).map((p) => (
              <button key={p.iso} type="button" className="pill" style={{ justifyContent: 'space-between' }} onClick={() => setMapSelectedIso(p.iso)}>
                <span>{provinceName(p)}</span>
                <span dir="ltr">{p.rate}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_action_plan_title')}</div>
        <div className="page-sub">{t('cfo_action_plan_sub')}</div>
        <div className="table-wrap" style={{ marginTop: 'var(--spacing-md)' }} tabIndex={0}>
          <table className="table" aria-label={t('cfo_action_plan_title')}>
            <thead>
              <tr>
                <th>{t('cfo_ap_priority')}</th><th>{t('cfo_ap_issue')}</th><th>{t('cfo_ap_impact')}</th>
                <th>{t('cfo_ap_owner')}</th><th>{t('cfo_ap_timeline')}</th>
              </tr>
            </thead>
            <tbody>
              {model.recommendations.map((r) => (
                <tr key={r.id}>
                  <td><span className={`badge ${PRIORITY_BADGE[r.priority] || 'badge--teal'}`}>{t(`priority_${r.priority}`)}</span></td>
                  <td>{recSentence(r)}</td>
                  <td dir="ltr">{money(r.impactSAR)}</td>
                  <td>
                    <input
                      className="input" placeholder={t('cfo_ap_owner_placeholder')}
                      aria-label={t('cfo_ap_owner')}
                      value={actionPlan[r.id]?.owner || ''}
                      onChange={(e) => setActionField(r.id, 'owner', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="input" placeholder={t('cfo_ap_timeline_placeholder')}
                      aria-label={t('cfo_ap_timeline')}
                      value={actionPlan[r.id]?.timeline || ''}
                      onChange={(e) => setActionField(r.id, 'timeline', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {model.recommendations.length === 0 && (
                <tr><td colSpan={5} className="muted">{t('cfo_risk_empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CopilotPanel t={t} money={money} model={model} assumptions={assumptions} onAssumptionsChange={onAssumptionsChange} />
    </div>
  );
}
