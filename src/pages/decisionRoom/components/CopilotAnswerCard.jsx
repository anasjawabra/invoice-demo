import React from 'react';

// Renders one structured Copilot answer — Finding / Driver / Financial
// Impact / Scenario / Action, with a Data Basis footer so every answer
// shows where its numbers actually came from (never a bare claim).
export default function CopilotAnswerCard({ question, answer, t }) {
  const rows = [
    { key: 'finding', labelKey: 'cfo_copilot_finding', value: answer.finding },
    { key: 'driver', labelKey: 'cfo_copilot_driver', value: answer.driver },
    { key: 'scenario', labelKey: 'cfo_copilot_scenario', value: answer.scenario },
    { key: 'action', labelKey: 'cfo_copilot_action', value: answer.action }
  ];
  return (
    <div className="card card-pad" style={{ marginTop: 'var(--spacing-md)' }}>
      <div className="muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--spacing-md)' }}>“{question}”</div>
      {rows.map((r) => (
        <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 'var(--spacing-md)', padding: 'var(--spacing-xs) 0' }}>
          <span className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>{t(r.labelKey)}</span>
          <span style={{ fontSize: 'var(--text-xs)' }}>{r.value}</span>
        </div>
      ))}
      {answer.impact && answer.impact.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 'var(--spacing-md)', padding: 'var(--spacing-xs) 0' }}>
          <span className="muted" style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>{t('cfo_copilot_impact')}</span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
            {answer.impact.map((i, idx) => (
              <span key={idx} className="pill" style={{ fontSize: 'var(--text-xs)' }} dir="ltr">{i.label}: {i.value}</span>
            ))}
          </span>
        </div>
      )}
      <div className="muted" style={{ fontSize: 'var(--text-2xs)', marginTop: 'var(--spacing-md)' }}>{t('cfo_copilot_basis')}: {answer.basis}</div>
    </div>
  );
}
