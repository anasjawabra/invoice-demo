import React from 'react';
import AssumptionsStrip from '../components/AssumptionsStrip';
import WaterfallChart from '../../../components/charts/WaterfallChart';
import DemoDataBadge from '../../../components/DemoDataBadge';

const EXCLUSION_CATEGORIES = ['duplicate', 'appeal', 'invalid_debtor', 'enforcement'];

export default function ExecutiveOverviewTab({
  t, money, model, isIllustrative, assumptions, scenarioKey, onJumpToTargets
}) {
  if (isIllustrative) {
    const revenuePct = model.expectedExpenses ? Math.min(100, Math.round((model.kpi.collectedValue / model.expectedExpenses) * 100)) : 0;
    const waterfallStages = [
      { key: 'expenditure', value: model.expectedExpenses },
      { key: 'lessCollected', value: -model.kpi.collectedValue },
      { key: 'gap', value: Math.max(0, model.expectedExpenses - model.kpi.collectedValue) }
    ];
    return (
      <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
        <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />
        <div className="card card-pad">
          <div className="page-head" style={{ marginBottom: 'var(--spacing-xs)' }}>
            <div>
              <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{t('cfo_tab_overview')}</div>
              <div className="page-sub">{t('cfo_illustrative_overview_sub')}</div>
            </div>
            <DemoDataBadge />
          </div>
          <div className="grid grid-6" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
            <div className="card card-pad">
              <div className="kpi__value" dir="ltr">{money(model.kpi.collectedValue)}</div>
              <div className="kpi__label">{t('cfo_illustrative_revenue')}</div>
            </div>
            <div className="card card-pad">
              <div className="kpi__value" dir="ltr">{money(model.expectedExpenses)}</div>
              <div className="kpi__label">{t('cfo_illustrative_expenditure')}</div>
            </div>
            <div className="card card-pad">
              <div className="kpi__value" dir="ltr">{money(Math.max(0, model.expectedExpenses - model.kpi.collectedValue))}</div>
              <div className="kpi__label">{t('cfo_illustrative_gap')}</div>
            </div>
            <div className="card card-pad">
              <div className="kpi__value" dir="ltr">{model.kpi.collectionRate}%</div>
              <div className="kpi__label">{t('cfo_illustrative_coverage')}</div>
            </div>
            <div className="card card-pad">
              <div className="kpi__value" dir="ltr">{100 - model.kpi.collectionRate}%</div>
              <div className="kpi__label">{t('cfo_illustrative_uncovered')}</div>
            </div>
            <div className="card card-pad">
              <div className="kpi__value" dir="ltr">{t('cfo_not_available')}</div>
              <div className="kpi__label">{t('cfo_illustrative_forecast')}</div>
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_illustrative_hero_title')}</div>
          <div className="page-sub">{t('cfo_illustrative_hero_note')}</div>
          <div style={{ height: 28, borderRadius: 14, background: 'var(--line)', overflow: 'hidden', marginTop: 'var(--spacing-md)' }}>
            <div style={{ height: '100%', width: `${revenuePct}%`, background: 'var(--green)', transition: 'width 0.2s ease' }} />
          </div>
        </div>

        <div className="card card-pad chart-box" style={{ height: 320 }}>
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_illustrative_waterfall_title')}</div>
          <div className="page-sub">{t('cfo_illustrative_waterfall_sub')}</div>
          <div style={{ height: 250, marginTop: 'var(--spacing-md)' }}>
            <WaterfallChart
              stages={waterfallStages}
              labels={{ expenditure: t('cfo_illustrative_expenditure'), lessCollected: t('cfo_illustrative_less_collected'), gap: t('cfo_illustrative_gap') }}
              isRtl={false} money={money}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{t('cfo_tab_overview')}</div>
        <div className="page-sub">{t('cfo_overview_sub')}</div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_position_title')}</div>
        <div className="page-sub">{t('cfo_position_sub')}</div>
        <div className="grid grid-4" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{money(model.kpi.netInvoiced)}</div>
            <div className="kpi__label">{t('dash_kpi_net_invoiced')}</div>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{money(model.kpi.collectedValue)}</div>
            <div className="kpi__label">{t('dash_kpi_collected')}</div>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{model.kpi.collectionRate}%</div>
            <div className="kpi__label">{t('dash_kpi_collection_rate')}</div>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{money(model.kpi.uncollectedValue)}</div>
            <div className="kpi__label">{t('cfo_kpi_outstanding')}</div>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_composition_title')}</div>
        <div className="page-sub">{t('cfo_composition_sub')}</div>
        <div className="table-wrap" style={{ marginTop: 'var(--spacing-md)' }} tabIndex={0}>
          <table className="table" aria-label={t('cfo_composition_title')}>
            <thead><tr><th>{t('dash_kpi_gross')}</th><th>{t('dash_kpi_excluded')}</th><th>{t('dash_kpi_net_invoiced')}</th><th>{t('dash_kpi_collected')}</th><th>{t('cfo_kpi_outstanding')}</th></tr></thead>
            <tbody>
              <tr>
                <td dir="ltr">{money(model.kpi.gross)}</td>
                <td dir="ltr">−{money(model.kpi.excludedValue)}</td>
                <td dir="ltr">{money(model.kpi.netInvoiced)}</td>
                <td dir="ltr">{money(model.kpi.collectedValue)}</td>
                <td dir="ltr">{money(model.kpi.uncollectedValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="table-wrap" style={{ marginTop: 'var(--spacing-md)' }} tabIndex={0}>
          <table className="table" aria-label={t('dash_kpi_excluded')}>
            <thead><tr><th>{t('dr_schedule_th_category')}</th><th>{t('cfo_th_count')}</th><th>{t('th_amount')}</th></tr></thead>
            <tbody>
              {EXCLUSION_CATEGORIES.map((cat) => (
                <tr key={cat}>
                  <td>{t(`dash_excl_${cat}`)}</td>
                  <td dir="ltr">{model.exclusions[cat].count}</td>
                  <td dir="ltr">{money(model.exclusions[cat].value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_forecast_title')}</div>
        <div className="page-sub">{t('cfo_forecast_sub')}</div>
        <div className="grid grid-4" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{money(model.expectedCollections)}</div>
            <div className="kpi__label">{t('cfo_kpi_expected_collections')}</div>
            <span className="badge badge--indigo" style={{ marginTop: 'var(--spacing-xs)' }}>{t('cfo_tag_scenario')}</span>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{money(model.expectedExpenses)}</div>
            <div className="kpi__label">{t('cfo_kpi_expected_expenses')}</div>
            <span className="badge badge--indigo" style={{ marginTop: 'var(--spacing-xs)' }}>{t('cfo_tag_scenario')}</span>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{money(model.netPosition)}</div>
            <div className="kpi__label">{t('cfo_kpi_net_position')}</div>
            <span className="badge badge--indigo" style={{ marginTop: 'var(--spacing-xs)' }}>{t('cfo_tag_scenario')}</span>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{model.expenseCoverage == null ? '—' : `${model.expenseCoverage}%`}</div>
            <div className="kpi__label">{t('cfo_kpi_coverage')}</div>
            <span className="badge badge--indigo" style={{ marginTop: 'var(--spacing-xs)' }}>{t('cfo_tag_scenario')}</span>
          </div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 'var(--spacing-md)' }} onClick={onJumpToTargets}>{t('cfo_how_calculated')}</button>
      </div>
    </div>
  );
}
