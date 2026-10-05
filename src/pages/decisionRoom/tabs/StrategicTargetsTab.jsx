import React from 'react';
import { TargetSliders } from '../../../components/CFOControlPanel';
import TargetCard from '../components/TargetCard';

const WEIGHT_DIMS = ['revenue', 'collection', 'expense', 'liquidity', 'outstanding', 'commitment', 'investment'];

export default function StrategicTargetsTab({
  t, money, model, isIllustrative, assumptions, onAssumptionsChange, scenarioKey, onScenarioSelect, onReset,
  savedScenarios, onSaveScenario, onLoadScenario, onDeleteScenario,
  targetComparison, healthWeights, onHealthWeightsChange
}) {
  const weightSum = WEIGHT_DIMS.reduce((s, d) => s + (healthWeights[d] || 0), 0);

  // Value-based target inputs: revenue/expense growth% assumptions are the
  // model's real underlying levers, but a CFO thinks in absolute SAR values
  // — so these fields (in TargetCard) convert an absolute target back into
  // the equivalent growth% over the real trend baseline (targetComparison's
  // own "Trend" column) and push that through the same onAssumptionsChange
  // the sliders use. Revenue is the anchor: setting a coverage ratio solves
  // for the expense target that would hit it at the CURRENT revenue target,
  // keeping all three fields mutually consistent without a separate solver.
  const trendRevenue = targetComparison.find((r) => r.key === 'collections')?.trend || 0;
  const trendExpense = targetComparison.find((r) => r.key === 'expenses')?.trend || 0;
  // Clamped to the same ±25% the Revenue Growth / Expense Growth sliders
  // enforce (CFOControlPanel.jsx) — without this, a value typed in the
  // wrong unit (e.g. millions typed while the field expects billions) can
  // solve for a growth% in the thousands of percent, silently wrecking
  // every figure across the whole Planning Room until "Reset to Actual".
  const GROWTH_BOUND = 25;
  const pctFromTarget = (targetSAR, trendSAR) => {
    if (!trendSAR) return 0;
    const pct = Math.round(((targetSAR / trendSAR) - 1) * 1000) / 10;
    return Math.max(-GROWTH_BOUND, Math.min(GROWTH_BOUND, pct));
  };

  const setRevenueTarget = (billions) => {
    const targetSAR = Math.max(0, Number(billions) || 0) * 1e9;
    onAssumptionsChange({ ...assumptions, revenueGrowthPct: pctFromTarget(targetSAR, trendRevenue) });
  };
  const setExpenseTarget = (billions) => {
    const targetSAR = Math.max(0, Number(billions) || 0) * 1e9;
    onAssumptionsChange({ ...assumptions, expenseGrowthPct: pctFromTarget(targetSAR, trendExpense) });
  };
  const setCoverageTarget = (ratioPct) => {
    const ratio = Math.max(0.1, Number(ratioPct) || 0.1) / 100;
    const expenseTargetSAR = model.expectedCollections / ratio;
    onAssumptionsChange({ ...assumptions, expenseGrowthPct: pctFromTarget(expenseTargetSAR, trendExpense) });
  };

  // Self-balancing, like a budget-split slider: raising one dimension
  // proportionally pulls the remainder down from the other six (scaled by
  // their current relative share, last one absorbing rounding drift) so the
  // total is always exactly 100 — never a stale "you broke it, fix it
  // yourself" warning state.
  const patchWeight = (dim, rawValue) => {
    const newVal = Math.max(0, Math.min(100, Number(rawValue) || 0));
    const others = WEIGHT_DIMS.filter((d) => d !== dim);
    const othersSum = others.reduce((s, d) => s + (healthWeights[d] || 0), 0);
    const remaining = 100 - newVal;
    const next = { [dim]: newVal };
    let running = 0;
    others.forEach((d, i) => {
      if (i === others.length - 1) {
        next[d] = remaining - running;
      } else {
        const share = othersSum > 0 ? Math.round((healthWeights[d] / othersSum) * remaining) : Math.round(remaining / others.length);
        next[d] = share;
        running += share;
      }
    });
    onHealthWeightsChange({ ...healthWeights, ...next });
  };

  const rowLabel = { collections: 'cfo_kpi_expected_collections', expenses: 'cfo_kpi_expected_expenses', netPosition: 'cfo_kpi_net_position', health: 'cfo_health_score' };
  const fmtRow = (key, val) => {
    if (val == null) return '—';
    return key === 'health' ? val : money(val);
  };

  // Sustainability ratios (Financial Sustainability content) — only the
  // ratios this app has real source data for; "Self-Funding Ratio" is
  // skipped since this app tracks no external-vs-own funding split, which
  // would make it an identical duplicate of Coverage Ratio, not new info.
  const outstandingRatio = model.kpi.netInvoiced ? Math.round((model.kpi.uncollectedValue / model.kpi.netInvoiced) * 1000) / 10 : null;

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{t('cfo_target_title')}</div>
        <div className="page-sub">{t('cfo_target_sub')}</div>
      </div>

      <TargetCard
        t={t} money={money} model={model} isIllustrative={isIllustrative}
        onSetRevenueTarget={setRevenueTarget} onSetExpenseTarget={setExpenseTarget} onSetCoverageTarget={setCoverageTarget}
        onSaveScenario={onSaveScenario}
      />

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_sustainability_title')}</div>
        <div className="page-sub">{t('cfo_sustainability_sub')}</div>
        <div className="grid grid-3" style={{ marginTop: 'var(--spacing-md)', gap: 'var(--spacing-md)' }}>
          <div className="card card-pad">
            <div className="kpi__value" style={{ fontSize: 'var(--text-lg)' }}>{model.expenseCoverage == null ? '—' : `${model.expenseCoverage}%`}</div>
            <div className="kpi__label">{t('cfo_sustainability_coverage')}</div>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" style={{ fontSize: 'var(--text-lg)' }}>{model.kpi.collectionRate}%</div>
            <div className="kpi__label">{t('cfo_sustainability_collection_efficiency')}</div>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" style={{ fontSize: 'var(--text-lg)' }}>{outstandingRatio == null ? '—' : `${outstandingRatio}%`}</div>
            <div className="kpi__label">{t('cfo_sustainability_outstanding')}</div>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_target_setting_title')}</div>
        <div className="page-sub">{t('cfo_target_setting_sub')}</div>
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          <TargetSliders
            assumptions={assumptions} onChange={onAssumptionsChange}
            scenarioKey={scenarioKey} onScenarioSelect={onScenarioSelect} onReset={onReset}
            savedScenarios={savedScenarios} onSaveScenario={onSaveScenario} onLoadScenario={onLoadScenario} onDeleteScenario={onDeleteScenario}
            t={t}
          />
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_target_comparison_title')}</div>
        <div className="page-sub">{t('cfo_target_comparison_sub')}</div>
        <div className="table-wrap" style={{ marginTop: 'var(--spacing-md)' }} tabIndex={0}>
          <table className="table" aria-label={t('cfo_target_comparison_title')}>
            <thead><tr><th></th><th>{t('cfo_target_col_trend')}</th><th>{t('cfo_target_col_target')}</th><th>{t('cfo_target_col_actual')}</th></tr></thead>
            <tbody>
              {targetComparison.map((row) => (
                <tr key={row.key}>
                  <td>{t(rowLabel[row.key])}</td>
                  <td dir="ltr">{fmtRow(row.key, row.trend)}</td>
                  <td dir="ltr" style={{ fontWeight: 700 }}>{fmtRow(row.key, row.target)}</td>
                  <td dir="ltr">{fmtRow(row.key, row.actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_weights_title')}</div>
        <div className="page-sub">{t('cfo_weights_sub')}</div>
        <div className="grid grid-4" style={{ marginTop: 'var(--spacing-md)', gap: 'var(--spacing-md)' }}>
          {WEIGHT_DIMS.map((d) => (
            <div key={d}>
              <label className="muted" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>{t(`cfo_weights_dim_${d}`)}</label>
              <input className="input" type="number" min="0" max="100" value={healthWeights[d]} aria-label={t(`cfo_weights_dim_${d}`)} onChange={(e) => patchWeight(d, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-md)' }}>
          {t('cfo_weights_sum_label')}: <strong dir="ltr" style={{ color: weightSum === 100 ? 'var(--green)' : 'var(--gold)' }}>{weightSum}</strong>
          {weightSum !== 100 && <span> — {t('cfo_weights_sum_warning')} {weightSum}</span>}
        </div>
      </div>
    </div>
  );
}
