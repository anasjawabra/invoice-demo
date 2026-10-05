import React from 'react';

// Read-only "current assumptions" pill strip shown on every tab that isn't
// Strategic Targets — a single source of truth for the live assumptions,
// visible everywhere, without duplicating the editable sliders on every tab.
// Clicking it jumps straight to Strategic Targets, where the real controls
// live.
export default function AssumptionsStrip({ assumptions, scenarioKey, onJumpToTargets, t }) {
  const pills = [
    `${assumptions.revenueGrowthPct > 0 ? '+' : ''}${assumptions.revenueGrowthPct}% ${t('cfo_lever_revenue_growth')}`,
    `${assumptions.collectionRateDelta > 0 ? '+' : ''}${assumptions.collectionRateDelta}pp ${t('cfo_lever_collection_rate')}`,
    `${assumptions.expenseGrowthPct > 0 ? '+' : ''}${assumptions.expenseGrowthPct}% ${t('cfo_lever_expense_growth')}`
  ];
  return (
    <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-xs)' }}>
      <span className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>{t('cfo_assumptions_strip_title')}:</span>
      {pills.map((p) => <span key={p} className="pill" style={{ fontSize: 'var(--text-xs)' }}>{p}</span>)}
      <span className="badge badge--indigo">{t('cfo_assumptions_strip_scenario')}: {t(`cfo_scenario_${scenarioKey === 'custom' ? 'management_plan' : scenarioKey}`)}</span>
      <button type="button" className="btn btn-sm btn-ghost" style={{ marginInlineStart: 'auto' }} onClick={onJumpToTargets}>
        {t('cfo_assumptions_strip_edit')} →
      </button>
    </div>
  );
}
