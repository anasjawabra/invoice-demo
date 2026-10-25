import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL, ratioText } from '../utils/bi';
import { ProvenanceBadge, ScopeBar } from '../components/revenue/RevenueUI';
import { metricDictionary } from '../data/metricDictionary';
import SettingsNav from '../components/settings/SettingsNav';
import { ExclusionsTab, FormulasTab, DevelopersTab } from '../components/settings/DictionaryTabs';
import ExclusionsReference from '../components/settings/ExclusionsReference';
import SadadExample from '../components/settings/SadadExample';

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
  const [sp, setSp] = useSearchParams(); const tab = ['metrics', 'exclusions', 'formulas', 'developers'].includes(sp.get('tab')) ? sp.get('tab') : 'metrics';
  const TABS = [['metrics', L('Metrics', 'المقاييس')], ['exclusions', L('Exclusions', 'الاستبعادات')], ['formulas', L('Formulas and rules', 'المعادلات والقواعد')], ['developers', L('For developers', 'للمطورين')]];
  const dict = useMemo(() => metricDictionary(snapshot), [snapshot]);
  const T = snapshot.totals; const S = snapshot.stock;
  const value = {
    gross: short(T.gross), adjustments: short(T.adjustments), cancelled: short(T.cancelled), exclusions: short(T.exclusions), net: short(T.net),
    collected: short(T.collected), uncollected: short(T.outstanding), netUncollected: short(S.netUncollected), overdue: short(S.overdue), notYetDue: short(S.notYetDue),
    collectedOverNet: ratioText(T.collectedOverNet, ar),
    adjustedTotal: '—', targetCollection: '—', remainingToTarget: '—'
  };
  return (
    <div className="rv-page">
      <SettingsNav current="/settings/metrics" />
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Metric dictionary', 'قاموس المقاييس')}</h1>
          <div className="page-sub">{L('The full reference for the business and for developers: every metric, every exclusion and how it is computed, and every formula — one definition, used by the dashboard, reports, the assistant, charts and alerts.', 'المرجع الكامل للأعمال وللمطورين: كل مقياس، وكل استبعاد وكيف يُحسب وعلى ماذا يُبنى، وكل المعادلات — تعريف واحد تستخدمه لوحة المعلومات والتقارير والمساعد والرسوم والتنبيهات.')}</div>
        </div>
      </div>
      <div className="rv-chips" role="tablist" aria-label={L('Dictionary sections', 'أقسام القاموس')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 12px' }}>
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`btn btn-sm${tab === k ? ' btn-primary' : ''}`} onClick={() => setSp(k === 'metrics' ? {} : { tab: k })}>{label}</button>)}
      </div>
      {tab === 'exclusions' && <><ScopeBar hideStatus /><ExclusionsTab /></>}
      {tab === 'formulas' && <FormulasTab />}
      {tab === 'developers' && <DevelopersTab />}
      {tab === 'metrics' && <>
      <ScopeBar />
      <div className="rv-callout">
        <b>{L('Two things that are not the same', 'أمران مختلفان')}</b>{' '}
        {L('Net billed is a flow for an issue period; net uncollected is a standing balance at the cutoff. The collection rate is collected ÷ net billed × 100 within the selected scope.', 'صافي المفوتر تدفق لفترة إصدار؛ والرصيد القائم رصيد قائم عند القطع. ونسبة التحصيل = المحصّل ÷ صافي المفوتر ضمن النطاق المحدد؛ وأي نسبة على إجمالي المفوتر تُسمّى بوضوح وتُفصل.')}
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
      <SadadExample />
      <ExclusionsReference />
      </>}
    </div>
  );
}
