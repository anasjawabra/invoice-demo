import React from 'react';
import AssumptionsStrip from '../components/AssumptionsStrip';

const SCENARIO_ROWS = [
  { key: 'base', labelKey: 'cfo_scenario_base' },
  { key: 'conservative', labelKey: 'cfo_scenario_conservative' },
  { key: 'optimistic', labelKey: 'cfo_scenario_optimistic' },
  { key: 'current', labelKey: 'cfo_scenario_management_plan' }
];

export default function ScenarioPlanningTab({
  t, money, assumptions, scenarioKey, onJumpToTargets, scenarioModels
}) {
  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{t('cfo_scenario_compare_title')}</div>
        <div className="page-sub">{t('cfo_scenario_compare_sub')}</div>
        <div className="table-wrap" style={{ marginTop: 'var(--spacing-md)' }} tabIndex={0}>
          <table className="table" aria-label={t('cfo_scenario_compare_title')}>
            <thead>
              <tr>
                <th></th>
                <th>{t('cfo_kpi_expected_collections')}</th>
                <th>{t('cfo_kpi_expected_expenses')}</th>
                <th>{t('cfo_kpi_net_position')}</th>
                <th>{t('cfo_health_score')}</th>
              </tr>
            </thead>
            <tbody>
              {SCENARIO_ROWS.map((row) => {
                const m = scenarioModels[row.key];
                return (
                  <tr key={row.key}>
                    <td>{t(row.labelKey)}</td>
                    <td dir="ltr">{money(m.expectedCollections)}</td>
                    <td dir="ltr">{money(m.expectedExpenses)}</td>
                    <td dir="ltr">{money(m.netPosition)}</td>
                    <td dir="ltr">{m.health.score}</td>
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
