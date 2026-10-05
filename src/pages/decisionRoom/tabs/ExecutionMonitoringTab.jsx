import React from 'react';

export default function ExecutionMonitoringTab({
  t, money, assumptions, scenarioKey, onJumpToTargets, monthLabels, planVsActual, actionPlan, recommendations
}) {
  const assignedCount = recommendations.filter((r) => actionPlan[r.id]?.owner).length;

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{t('cfo_execution_title')}</div>
        <div className="page-sub">{t('cfo_execution_sub')}</div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_planvsactual_title')}</div>
        <div className="page-sub">{t('cfo_planvsactual_sub')}</div>
        <div className="table-wrap" style={{ marginTop: 'var(--spacing-md)' }} tabIndex={0}>
          <table className="table" aria-label={t('cfo_planvsactual_title')}>
            <thead>
              <tr>
                <th>{t('cfo_planvsactual_col_month')}</th><th>{t('cfo_planvsactual_col_target')}</th>
                <th>{t('cfo_planvsactual_col_actual')}</th><th>{t('cfo_planvsactual_col_variance')}</th>
              </tr>
            </thead>
            <tbody>
              {planVsActual.map((r) => (
                <tr key={r.month}>
                  <td>{monthLabels[r.month] || `M${r.month + 1}`}</td>
                  <td dir="ltr">{money(r.target)}</td>
                  <td dir="ltr">{money(r.actual)}</td>
                  <td dir="ltr" style={{ color: r.variance >= 0 ? 'var(--green)' : 'var(--red)' }}>{r.variance >= 0 ? '+' : ''}{money(r.variance)}</td>
                </tr>
              ))}
              {planVsActual.length === 0 && (
                <tr><td colSpan={4} className="muted">{t('cfo_planvsactual_empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 'var(--text-2xs)', marginTop: 'var(--spacing-md)' }}>{t('cfo_planvsactual_expense_note')}</p>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_actionstatus_title')}</div>
        <div className="page-sub">{t('cfo_actionstatus_sub')}</div>
        <div className="grid grid-2" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{assignedCount}</div>
            <div className="kpi__label">{t('cfo_actionstatus_assigned')}</div>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{recommendations.length - assignedCount}</div>
            <div className="kpi__label">{t('cfo_actionstatus_unassigned')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
