import React from 'react';
import AssumptionsStrip from '../components/AssumptionsStrip';
import WaterfallChart from '../../../components/charts/WaterfallChart';
import SensitivityBarChart from '../../../components/charts/SensitivityBarChart';

export default function RevenuePlanningTab({
  t, money, isRtl, assumptions, scenarioKey, onJumpToTargets, revenueBridge, revenueSensitivity
}) {
  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{t('cfo_revenue_planning_title')}</div>
        <div className="page-sub">{t('cfo_revenue_planning_sub')}</div>
      </div>

      <div className="card card-pad chart-box" style={{ height: 320 }}>
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_bridge_baseline')} → {t('cfo_bridge_forecast')}</div>
        <div style={{ height: 250, marginTop: 'var(--spacing-md)' }}>
          <WaterfallChart
            stages={revenueBridge}
            labels={{ baseline: t('cfo_bridge_baseline'), growthEffect: t('cfo_bridge_growth'), collectionEffect: t('cfo_bridge_collection'), forecast: t('cfo_bridge_forecast') }}
            isRtl={isRtl} money={money}
          />
        </div>
      </div>

      <div className="card card-pad chart-box" style={{ height: 300 }}>
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_chart_revenue_sensitivity')}</div>
        <div style={{ height: 230, marginTop: 'var(--spacing-md)' }}>
          <SensitivityBarChart data={revenueSensitivity} isRtl={isRtl} money={money} />
        </div>
      </div>
    </div>
  );
}
