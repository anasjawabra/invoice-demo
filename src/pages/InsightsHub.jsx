// «لوحة المعلومات والتقارير» — management area 1. Three views with distinct purposes:
//   لوحة المعلومات (monitor) · التقارير الثابتة (established formats, open directly) · التقارير الذكية (prompt-based custom analysis)
// The URL carries the view (?view=dashboard|reports|smart) and the open fixed report (&report=key), so every view is linkable.
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAr } from '../utils/useAr';
import FilterChips from '../components/strategic/FilterChips';
import { DataStatus } from '../components/revenue/RevenueUI';
import InsightsDashboard from '../components/insights/InsightsDashboard';
import FixedReports from '../components/insights/FixedReports';
import SmartReports from './SmartReports';
import { Skeleton } from '../components/strategic/AsyncState';
import { LEGACY_SECTION_TO_REPORT, FIXED_REPORTS } from '../data/fixedReports';
import { fmtRangeText } from '../data/clock';
import { amanahOptionsOf } from '../data/revenueLedger';
import { sourceAr, sourceEn } from '../data/insightsEngine';

const VIEWS = [['dashboard', 'لوحة المعلومات', 'Dashboard'], ['reports', 'التقارير الثابتة', 'Fixed reports'], ['smart', 'التقارير الذكية', 'Smart reports']];

export default function InsightsHub() {
  const rev = useRevenue(); const { L, ar } = useAr();
  const [sp, setSp] = useSearchParams();
  let view = sp.get('view'); let report = sp.get('report');
  const legacy = sp.get('r'); // old /reports?r=<section> links
  if (!view && legacy) { view = 'reports'; report = LEGACY_SECTION_TO_REPORT[legacy] || null; }
  if (!VIEWS.some(([k]) => k === view)) view = 'dashboard';
  const badReport = !!report && !FIXED_REPORTS.some((r) => r.key === report);
  if (badReport) report = null;
  const go = (v, extra = {}) => { const n = new URLSearchParams(); n.set('view', v); Object.entries(extra).forEach(([k, x]) => x && n.set(k, x)); setSp(n); };
  const initialQuery = sp.get('q');
  const sEff = rev.scopeEff; const amName = (k) => { const x = amanahOptionsOf().find((o) => o.key === k); return x ? (ar ? x.ar : x.en) : k; };
  const scopeSummary = [sEff.amanah === 'all' ? L('كل الأمانات', 'All Amanahs') : [].concat(sEff.amanah).map(amName).join(ar ? '، ' : ', '), sEff.source === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(sEff.source) : sourceEn(sEff.source))].join(' · ');

  return (
    <div className="st-page">
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('لوحة المعلومات والتقارير', 'Dashboards and reports')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{view === 'smart' ? L('اكتب ما تريد من تقرير: الفترة أو الأمانة أو المصدر أو المقارنة.', 'Write what you need: period, Amanah, source or comparison.') : rev.ready ? L(`فواتير صدرت ${fmtRangeText(rev.scopeEff.from, rev.scopeEff.to, 'ar')} · ${scopeSummary}`, `Invoices issued ${fmtRangeText(rev.scopeEff.from, rev.scopeEff.to, 'en')} · ${scopeSummary}`) : ''}</div>
        </div>
      </header>
      <div className="sr-tabs" role="tablist" aria-label={L('واجهات لوحة المعلومات والتقارير', 'Dashboard and report views')}>
        {VIEWS.map(([k, a, e]) => <button key={k} id={`tab-${k}`} type="button" role="tab" aria-selected={view === k} aria-controls={`panel-${k}`} className={`sr-tab ${view === k ? 'is-active' : ''}`} onClick={() => go(k)}><b>{L(a, e)}</b></button>)}
      </div>
      {view !== 'smart' && (rev.ready ? <FilterChips /> : <Skeleton height={44} />)}
      {view !== 'smart' && <DataStatus />}
      {badReport && view === 'reports' && <div className="rv-callout rv-callout--warn" role="alert">{L('لا يوجد تقرير بهذا الاسم؛ اختر أحد التقارير أدناه.', 'There is no report with that name; choose one below.')}</div>}
      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`} aria-busy={view !== 'smart' && rev.loading ? 'true' : undefined} style={view !== 'smart' && rev.loading ? { opacity: 0.55, transition: 'opacity .15s' } : undefined}>
        {!rev.ready ? <div role="status"><Skeleton height={220} /></div>
          : view === 'dashboard' ? <InsightsDashboard />
            : view === 'reports' ? <FixedReports reportKey={report} setReport={(k) => go('reports', { report: k })} />
              : <SmartReports embedded initialQuery={initialQuery} onQueryConsumed={() => { const n = new URLSearchParams(sp); n.delete('q'); setSp(n, { replace: true }); }} />}
      </div>
    </div>
  );
}
