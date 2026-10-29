import { localize } from '../../../utils/zh';
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
  const name = (r) => (lang === 'zh' ? r.name : lang === 'ar' ? r.nameAr : localize(r.nameEn, lang));

  return (
    <div className="grid" style={{ gap: 14 }}>
      <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 18 }}>{t('cfo_funding_title')}</div>
        <div className="page-sub">{t('cfo_funding_sub')}</div>
      </div>

      <div className="card card-pad chart-box" style={{ height: 320 }}>
        <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_chart_cashflow')}</div>
        <div style={{ height: 250, marginTop: 10 }}>
          <CashFlowChart monthlySeries={model.monthlySeries} monthLabels={monthLabels} isRtl={isRtl} money={money} />
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_investment_capacity_title')}</div>
        <div className="page-sub">{t('cfo_investment_capacity_sub')}</div>
        <div className="grid grid-3" style={{ gap: 10, marginTop: 10 }}>
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
        <div style={{ marginTop: 12 }}>
          <InvestmentInputs assumptions={assumptions} onChange={onAssumptionsChange} t={t} />
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="page-title" style={{ fontSize: 16 }}>{t("Investment Contracts")}</div>
          <DemoDataBadge />
        </div>
        <div className="table-wrap" style={{ marginTop: 6 }}>
          <table className="table">
            <thead><tr><th></th><th>{t("Value")}</th><th>{t("Paid")}</th><th>{t("Remaining")}</th><th>{t("Next Payment")}</th></tr></thead>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_investment_opportunities_title')}</div>
          <DemoDataBadge />
        </div>
        <div className="table-wrap" style={{ marginTop: 6 }}>
          <table className="table">
            <thead><tr><th></th><th>{t("Value")}</th><th>{t("Expected Return")}</th><th>{t("Priority")}</th><th>{t("Status")}</th></tr></thead>
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
