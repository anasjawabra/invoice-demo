import React, { useMemo } from 'react';
import { useRevenue } from '../context/RevenueContext';
import { useL, ratioText } from '../utils/bi';
import { ProvenanceBadge, ScopeBar } from '../components/revenue/RevenueUI';
import { metricDictionary } from '../data/metricDictionary';
import { targetAchievementFrom, coverageFrom } from '../data/revenueMetrics';
import { useAsync } from '../utils/useAsync';

const KIND = {
  flow: { ar: 'تدفق لفترة', en: 'Period flow' },
  stock: { ar: 'رصيد قائم', en: 'Standing balance' },
  ratio: { ar: 'نسبة', en: 'Ratio' },
  plan: { ar: 'تخطيط', en: 'Plan' }
};

export default function Metrics() {
  const rev = useRevenue();
  const { L, B, ar, short } = useL();
  const { snapshot } = rev;
  const dict = useMemo(() => metricDictionary(snapshot), [snapshot]);
  const T = snapshot.totals; const S = snapshot.stock;
  // target achievement and coverage are computed from the fiscal-year receipts series held by the data service
  const { data: fy } = useAsync(() => {
    const through = rev.scopeEff.to < rev.cfg.cutoff ? rev.scopeEff.to : rev.cfg.cutoff;
    return rev.data.series({ amanah: rev.scopeEff.amanah, source: rev.scopeEff.source, scopeType: rev.scopeEff.scopeType, muni: rev.scopeEff.muni, status: rev.scopeEff.status, from: `${rev.targets.fiscalYear}-01-01`, to: through }, { asOf: through });
  }, [rev.data, rev.scopeEff.amanah, rev.scopeEff.source, rev.scopeEff.scopeType, rev.scopeEff.muni, rev.scopeEff.to, rev.cfg.cutoff, rev.targets.fiscalYear]);
  const ach = useMemo(() => (fy ? targetAchievementFrom(fy, rev.scopeEff, rev.cfg, rev.targets) : null), [fy, rev.scopeEff, rev.cfg, rev.targets]);
  const cov = useMemo(() => (fy ? coverageFrom(fy, rev.scopeEff, rev.cfg, rev.targets) : null), [fy, rev.scopeEff, rev.cfg, rev.targets]);
  const value = {
    gross: short(T.gross), adjustments: short(T.adjustments), cancelled: short(T.cancelled), exclusions: short(T.exclusions), net: short(T.net),
    collected: short(T.collected), uncollected: short(T.outstanding), received: short(snapshot.receivedInPeriod.total), netUncollected: short(S.netUncollected), overdue: short(S.overdue), notYetDue: short(S.notYetDue),
    collectedOverNet: ratioText(T.collectedOverNet, ar),
    targetAchievement: ach ? ratioText(ach.achievement, ar) : '…', coverage: cov ? ratioText(cov.coverage, ar) : '…', forecast: '—'
  };
  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Metric dictionary', 'قاموس المقاييس')}</h1>
          <div className="page-sub">{L('One definition per metric, used by the dashboard, reports, the assistant, charts and alerts. Values below are computed live for the scope selected above.', 'تعريف واحد لكل مقياس تستخدمه اللوحة والتقارير والمساعد والرسوم والتنبيهات. القيم أدناه محسوبة مباشرة للنطاق المحدد أعلاه.')}</div>
        </div>
      </div>
      <ScopeBar />
      <div className="rv-callout">
        <b>{L('Two things that are not the same', 'أمران مختلفان')}</b>{' '}
        {L('Net billed is a flow for an issue period; net uncollected is a standing balance at the cutoff. The collection rate is collected ÷ net billed × 100 within the selected scope.', 'صافي المفوتر تدفق لفترة إصدار؛ وصافي غير المحصل رصيد قائم عند القطع. ونسبة التحصيل = المحصّل ÷ صافي المفوتر ضمن النطاق المحدد؛ وأي نسبة على إجمالي المفوتر تُسمّى بوضوح وتُفصل.')}
      </div>
      <div className="rv-metric-list">
        {dict.map((m) => (
          <article key={m.key} className="card card-pad" aria-label={B(m.label)}>
            <div className="rv-card__head">
              <h2 className="rv-sec-title">{B(m.label)} <span className="rv-tag">{B(KIND[m.kind])}</span></h2>
              <div className="rv-metric-value" dir="ltr">{value[m.key]}</div>
            </div>
            <dl className="rv-dl">
              <dt>{L('Definition', 'التعريف')}</dt><dd dir="auto">{B(m.definition)}</dd>
              <dt>{L('Formula', 'المعادلة')}</dt><dd dir="auto">{B(m.formula)}</dd>
              <dt>{L('Period', 'الفترة')}</dt><dd>{B(m.period)}</dd>
              <dt>{L('Date basis', 'أساس التاريخ')}</dt><dd>{B(m.dateBasis)}</dd>
              <dt>{L('Scope', 'النطاق')}</dt><dd dir="auto">{B(m.scope)}</dd>
              <dt>{L('Sources', 'المصادر')}</dt><dd>{m.sourceLabels.map((x) => B(x)).join(ar ? '، ' : ', ')}</dd>
              <dt>{L('Updated', 'آخر تحديث')}</dt><dd dir="ltr">{m.updatedAt}</dd>
              <dt>{L('Rule version', 'إصدار القاعدة')}</dt><dd dir="ltr">{m.ruleVersion}</dd>
              <dt>{L('Data completeness', 'اكتمال البيانات')}</dt><dd>{m.completeness.calculable ? `${Math.round(m.completeness.value * 100)}%` : L('Not calculable', 'غير قابل للاحتساب')}</dd>
              {m.caveat && (<><dt>{L('Caution', 'تنبيه')}</dt><dd dir="auto">{B(m.caveat)}</dd></>)}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
