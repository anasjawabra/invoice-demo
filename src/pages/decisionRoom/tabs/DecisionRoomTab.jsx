import React from 'react';
import ProvinceMap from '../../../components/ProvinceMap';
import { KSA_PROVINCES_VIEWBOX } from '../../../data/ksaProvinces';
import { MAP_METRICS, AMANAH_RANK_CRITERIA, mapFillForMetric } from '../../../data/cfoModel';
import AssumptionsStrip from '../components/AssumptionsStrip';
import AmanahDetailPanel from '../components/AmanahDetailPanel';
import CopilotPanel from '../components/CopilotPanel';

const PRIORITY_BADGE = { high: 'badge--red', medium: 'badge--gold', low: 'badge--teal' };

export default function DecisionRoomTab({
  t, money, model, assumptions, onAssumptionsChange, scenarioKey, onJumpToTargets,
  byProvinceForMap, mapSelectedIso, setMapSelectedIso, mapMetric, setMapMetric,
  selectedAmanah, attentionAmanah, rankedAmanahs, rankCriterion, setRankCriterion,
  actionPlan, setActionField, recSentence
}) {
  return (
    <div className="grid" style={{ gap: 14 }}>
      <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />

      <div className="grid grid-2" style={{ gap: 14, alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 16 }}>{t('dr_map_title')}</div>
          <div className="page-sub">{t('dr_map_sub')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            <span className="muted" style={{ fontSize: 12 }}>{t('cfo_map_metric_label')}</span>
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
            titleFor={(p) => `${p.en || p.iso} — ${p.rate ?? 0}%`}
          />
          {attentionAmanah && (
            <div className="banner banner--gold" style={{ marginTop: 10 }}>
              <b>{t('cfo_attention_needed')}:</b> {attentionAmanah.en} — {attentionAmanah.rate}%
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_amanah_title')}</div>
          <AmanahDetailPanel amanah={selectedAmanah} money={money} t={t} />

          <div className="hr" style={{ margin: '14px 0' }} />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <span className="muted" style={{ fontSize: 12 }}>{t('cfo_rank_criterion')}</span>
            {AMANAH_RANK_CRITERIA.map((c) => (
              <button key={c} type="button" className={`btn btn-sm ${rankCriterion === c ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRankCriterion(c)}>
                {t(`cfo_rank_${c}`)}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
            {rankedAmanahs.slice(0, 8).map((p) => (
              <button key={p.iso} type="button" className="pill" style={{ justifyContent: 'space-between' }} onClick={() => setMapSelectedIso(p.iso)}>
                <span>{p.en}</span>
                <span dir="ltr">{p.rate}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_action_plan_title')}</div>
        <div className="page-sub">{t('cfo_action_plan_sub')}</div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('cfo_ap_priority')}</th><th>{t('cfo_ap_issue')}</th><th>{t('cfo_ap_impact')}</th>
                <th>{t('cfo_ap_owner')}</th><th>{t('cfo_ap_timeline')}</th>
              </tr>
            </thead>
            <tbody>
              {model.recommendations.map((r) => (
                <tr key={r.id}>
                  <td><span className={`badge ${PRIORITY_BADGE[r.priority] || 'badge--teal'}`}>{r.priority}</span></td>
                  <td>{recSentence(r)}</td>
                  <td dir="ltr">{money(r.impactSAR)}</td>
                  <td>
                    <input
                      className="input" placeholder={t('cfo_ap_owner_placeholder')}
                      value={actionPlan[r.id]?.owner || ''}
                      onChange={(e) => setActionField(r.id, 'owner', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="input" placeholder={t('cfo_ap_timeline_placeholder')}
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
