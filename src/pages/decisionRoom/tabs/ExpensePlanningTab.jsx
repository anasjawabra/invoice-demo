import React from 'react';
import { ChapterSliders } from '../../../components/CFOControlPanel';
import AssumptionsStrip from '../components/AssumptionsStrip';
import CoverageGauge from '../components/CoverageGauge';
import SensitivityBarChart from '../../../components/charts/SensitivityBarChart';
import DemoDataBadge from '../../../components/DemoDataBadge';

export default function ExpensePlanningTab({
  t, lang, money, isRtl, model, assumptions, onAssumptionsChange, scenarioKey, onJumpToTargets, expenseSensitivity
}) {
  const chapterName = (c) => (lang === 'zh' ? c.name : lang === 'ar' ? c.nameAr : c.nameEn);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 18 }}>{t('cfo_expense_planning_title')}</div>
        <div className="page-sub">{t('cfo_expense_planning_sub')}</div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_chart_coverage')}</div>
          <DemoDataBadge />
        </div>
        <CoverageGauge value={model.expenseCoverage} targetPct={100} sub={t('cfo_chart_coverage_target')} />
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_chapters_advanced')}</div>
          <DemoDataBadge />
        </div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="table">
            <thead><tr><th></th><th>Budget</th><th>Actual</th><th>Committed</th><th>{t('cfo_chapter_adjusted')}</th></tr></thead>
            <tbody>
              {model.chapters.map((c) => (
                <tr key={c.id}>
                  <td>{chapterName(c)}</td>
                  <td dir="ltr">{money(c.budget)}</td>
                  <td dir="ltr">{money(c.actual)}</td>
                  <td dir="ltr">{money(c.committed)}</td>
                  <td dir="ltr" style={{ fontWeight: 800 }}>{money(c.annualAdjusted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12 }}>
          <ChapterSliders assumptions={assumptions} onChange={onAssumptionsChange} t={t} />
        </div>
      </div>

      <div className="card card-pad chart-box" style={{ height: 300 }}>
        <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_chart_expense_sensitivity')}</div>
        <div style={{ height: 230, marginTop: 10 }}>
          <SensitivityBarChart data={expenseSensitivity} isRtl={isRtl} money={money} />
        </div>
      </div>
    </div>
  );
}
