import React, { useState } from 'react';

// Dynamic financial target setting: the user drives the plan by EITHER a
// target revenue amount OR a target coverage % (never both fighting at
// once) — the other two fields are read-only derived displays, always
// synced via the same onSetX handlers StrategicTargetsTab already built
// (no separate calculation engine). Works identically in Live or
// Illustrative mode since `model` is already shaped the same either way.
export default function TargetCard({
  t, money, model, isIllustrative,
  onSetRevenueTarget, onSetExpenseTarget, onSetCoverageTarget,
  onSaveScenario
}) {
  const [targetMode, setTargetMode] = useState('revenue'); // 'revenue' | 'coverage'
  const [targetName, setTargetName] = useState('');

  // Editable fields must respect the room's active unit mode (Live = SAR
  // Billion, Illustrative = SAR Million, per that baseline's own "do NOT
  // display as billions" instruction) — same convention money() already
  // uses everywhere else. onSetRevenueTarget/onSetExpenseTarget's contract
  // is always "value in billions" (defined in StrategicTargetsTab), so
  // entered values are converted back to billions before calling them.
  const unitDivisor = isIllustrative ? 1e6 : 1e9;
  const unitKey = isIllustrative ? 'pln_unit_million' : 'pln_unit_billion';
  const toBillions = (enteredInActiveUnit) => Number(enteredInActiveUnit || 0) * (unitDivisor / 1e9);

  const revenueTargetSAR = model.expectedCollections;
  const expenseTargetSAR = model.expectedExpenses;
  const coveragePct = model.expenseCoverage;
  const currentRevenueSAR = model.kpi.collectedValue;

  // Three distinct gaps (spec §50) — never confused with each other.
  const fundingGap = model.expectedExpenses - currentRevenueSAR; // Total Expenditure - Current Revenue
  const revenueTargetGap = revenueTargetSAR - currentRevenueSAR; // Target Revenue - Current Revenue
  const remainingGapAfterTarget = model.expectedExpenses - revenueTargetSAR; // Total Expenditure - Target Revenue

  const achievementPct = revenueTargetSAR ? Math.round((currentRevenueSAR / revenueTargetSAR) * 1000) / 10 : null;

  const targetBelowCurrent = revenueTargetSAR < currentRevenueSAR;
  const impliesOverCoverage = coveragePct != null && coveragePct > 100;

  return (
    <div className="card card-pad">
      <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_targetcard_title')}</div>
      <div className="page-sub">{t('cfo_targetcard_sub')}</div>

      <div style={{ display: 'flex', gap: 6, marginTop: 12, marginBottom: 14 }}>
        <button type="button" className={`btn btn-sm ${targetMode === 'revenue' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTargetMode('revenue')}>
          {t('cfo_targetcard_by_revenue')}
        </button>
        <button type="button" className={`btn btn-sm ${targetMode === 'coverage' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTargetMode('coverage')}>
          {t('cfo_targetcard_by_coverage')}
        </button>
      </div>

      <div className="grid grid-3" style={{ gap: 10 }}>
        <div>
          <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{t('cfo_targetcard_revenue_label')} ({t(unitKey)})</label>
          {targetMode === 'revenue' ? (
            <input key={`revenue-${unitDivisor}-${revenueTargetSAR}`} className="input" type="text" inputMode="decimal" dir="ltr"
              defaultValue={(revenueTargetSAR / unitDivisor).toFixed(2)}
              onBlur={(e) => onSetRevenueTarget(toBillions(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && onSetRevenueTarget(toBillions(e.target.value))} />
          ) : (
            <div className="input" style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }} dir="ltr">{(revenueTargetSAR / unitDivisor).toFixed(2)}</div>
          )}
        </div>
        <div>
          <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{t('cfo_targetcard_expense_label')} ({t(unitKey)})</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }} dir="ltr">{(expenseTargetSAR / unitDivisor).toFixed(2)}</div>
        </div>
        <div>
          <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{t('cfo_target_value_coverage')}</label>
          {targetMode === 'coverage' ? (
            <input key={`coverage-${isIllustrative}-${coveragePct}`} className="input" type="text" inputMode="decimal" dir="ltr"
              defaultValue={(coveragePct ?? 0).toFixed(2)}
              onBlur={(e) => onSetCoverageTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSetCoverageTarget(e.target.value)} />
          ) : (
            <div className="input" style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }} dir="ltr">{(coveragePct ?? 0).toFixed(2)}</div>
          )}
        </div>
      </div>

      {targetBelowCurrent && (
        <div className="banner banner--gold" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12.5 }}>{t('cfo_targetcard_warn_below_current')}</span>
        </div>
      )}
      {impliesOverCoverage && (
        <div className="banner banner--gold" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12.5 }}>{t('cfo_targetcard_warn_over_coverage')}</span>
        </div>
      )}

      <div className="grid grid-3" style={{ gap: 10, marginTop: 16 }}>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 17 }}>{money(fundingGap)}</div>
          <div className="kpi__label">{t('cfo_gap_funding')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 17 }}>{money(revenueTargetGap)}</div>
          <div className="kpi__label">{t('cfo_gap_revenue_target')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 17 }}>{money(remainingGapAfterTarget)}</div>
          <div className="kpi__label">{t('cfo_gap_remaining_after_target')}</div>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
        {t('cfo_target_achievement')}: <strong dir="ltr" style={{ color: 'var(--heading)' }}>{achievementPct == null ? '—' : `${achievementPct}%`}</strong>
      </div>

      <div className="hr" />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder={t('cfo_targetcard_name_placeholder')} value={targetName} onChange={(e) => setTargetName(e.target.value)} />
        <button type="button" className="btn btn-sm btn-primary"
          onClick={() => { if (targetName.trim()) { onSaveScenario(targetName.trim()); setTargetName(''); } }}>
          {t('cfo_targetcard_save')}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>{t('cfo_targetcard_unranked_note')}</p>
    </div>
  );
}
