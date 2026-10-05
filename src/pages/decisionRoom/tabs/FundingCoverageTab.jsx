import React from 'react';
import { InvestmentInputs } from '../../../components/CFOControlPanel';
import { DEMO_INVESTMENT_CONTRACTS } from '../../../data/cfoModel';
import { DEMO_INVESTMENT_OPPORTUNITIES } from '../../../data/decisionRoomDemoData';
import AssumptionsStrip from '../components/AssumptionsStrip';
import CashFlowChart from '../../../components/charts/CashFlowChart';
import DemoDataBadge from '../../../components/DemoDataBadge';

export default function FundingCoverageTab({
  t, lang, money, isRtl, model, assumptions, onAssumptionsChange, scenarioKey, onJumpToTargets, monthLabels
}) {
  const name = (r) => (lang === 'zh' ? r.name : lang === 'ar' ? r.nameAr : r.nameEn);

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{t('cfo_funding_title')}</div>
        <div className="page-sub">{t('cfo_funding_sub')}</div>
      </div>

      <div className="card card-pad chart-box" style={{ height: 320 }}>
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_chart_cashflow')}</div>
        <div style={{ height: 250, marginTop: 'var(--spacing-md)' }}>
          <CashFlowChart monthlySeries={model.monthlySeries} monthLabels={monthLabels} isRtl={isRtl} money={money} />
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_investment_capacity_title')}</div>
        <div className="page-sub">{t('cfo_investment_capacity_sub')}</div>
        <div className="grid grid-3" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{money(model.investmentCapacity.capacity)}</div>
            <div className="kpi__label">{t('cfo_capacity_available')}</div>
          </div>
          <div className="card card-pad">
            <div className="kpi__value" dir="ltr">{money(model.investmentCapacity.proposed)}</div>
            <div className="kpi__label">{t('cfo_capacity_proposed')}</div>
          </div>
          <div className="card card-pad">
            <span className={`badge ${model.investmentCapacity.exceedsCapacity ? 'badge--red' : 'badge--green'}`}>
              {model.investmentCapacity.exceedsCapacity ? t('cfo_capacity_exceeds') : t('cfo_capacity_ok')}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <InvestmentInputs assumptions={assumptions} onChange={onAssumptionsChange} t={t} />
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xs)' }}>
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>Investment Contracts</div>
          <DemoDataBadge />
        </div>
        <div className="table-wrap" style={{ marginTop: 'var(--spacing-xs)' }} tabIndex={0}>
          <table className="table" aria-label="Investment Contracts">
            <thead><tr><th></th><th>Value</th><th>Paid</th><th>Remaining</th><th>Next Payment</th></tr></thead>
            <tbody>
              {DEMO_INVESTMENT_CONTRACTS.map((r) => (
                <tr key={r.id}>
                  <td>{name(r)}</td>
                  <td dir="ltr">{money(r.value)}</td>
                  <td dir="ltr">{money(r.paid)}</td>
                  <td dir="ltr">{money(r.remaining)}</td>
                  <td dir="ltr">{money(r.nextPaymentAmount)} · {r.nextPaymentDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xs)' }}>
          <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_investment_opportunities_title')}</div>
          <DemoDataBadge />
        </div>
        <div className="table-wrap" style={{ marginTop: 'var(--spacing-xs)' }} tabIndex={0}>
          <table className="table" aria-label={t('cfo_investment_opportunities_title')}>
            <thead><tr><th></th><th>Value</th><th>Expected Return</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {DEMO_INVESTMENT_OPPORTUNITIES.map((r) => (
                <tr key={r.id}>
                  <td>{name(r)}</td>
                  <td dir="ltr">{money(r.value)}</td>
                  <td dir="ltr">{Math.round(r.expectedReturn * 100)}%</td>
                  <td>{r.priority}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
