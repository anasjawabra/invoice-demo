// «لوحة المعلومات والتقارير» — management area 1. Three views with distinct purposes:
//   لوحة المعلومات (monitor) · التقارير الثابتة (established formats, open directly) · التقارير الذكية (prompt-based custom analysis)
// The URL carries the view (?view=dashboard|reports|smart) and the open fixed report (&report=key), so every view is linkable.
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAr } from '../utils/useAr';
import FilterChips from '../components/strategic/FilterChips';
import InsightsDashboard from '../components/insights/InsightsDashboard';
import FixedReports from '../components/insights/FixedReports';
import SmartReports from './SmartReports';
import { Skeleton } from '../components/strategic/AsyncState';
import { LEGACY_SECTION_TO_REPORT, FIXED_REPORTS } from '../data/fixedReports';

const VIEWS = [['dashboard', 'لوحة المعلومات', 'Dashboard', 'رصد الأداء الآن'], ['reports', 'التقارير الثابتة', 'Fixed reports', 'صيغ قياسية تُفتح مباشرة'], ['smart', 'التقارير الذكية', 'Smart reports', 'تحليل مخصص بالطلب']];

export default function InsightsHub() {
  const rev = useRevenue(); const { L } = useAr();
  const [sp, setSp] = useSearchParams();
  let view = sp.get('view'); let report = sp.get('report');
  const legacy = sp.get('r'); // old /reports?r=<section> links
  if (!view && legacy) { view = 'reports'; report = LEGACY_SECTION_TO_REPORT[legacy] || null; }
  if (!VIEWS.some(([k]) => k === view)) view = 'dashboard';
  if (report && !FIXED_REPORTS.some((r) => r.key === report)) report = null;
  const go = (v, extra = {}) => { const n = new URLSearchParams(); n.set('view', v); Object.entries(extra).forEach(([k, x]) => x && n.set(k, x)); setSp(n); };
  const initialQuery = sp.get('q');

  return (
    <div className="st-page">
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('لوحة المعلومات والتقارير', 'Dashboards and reports')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{L('كيف الأداء الآن، وأين الانحراف، وأي تقرير أرفع؟ — أرقام واحدة في كل الواجهات الثلاث.', 'How are we performing, where is the deviation, which report do I send? — the same figures in all three views.')}</div>
        </div>
      </header>
      <div className="sr-tabs" role="tablist" aria-label={L('واجهات لوحة المعلومات والتقارير', 'Dashboard and report views')}>
        {VIEWS.map(([k, a, e, hint]) => <button key={k} id={`tab-${k}`} type="button" role="tab" aria-selected={view === k} aria-controls={`panel-${k}`} className={`sr-tab ${view === k ? 'is-active' : ''}`} onClick={() => go(k)}><b>{L(a, e)}</b><small>{hint}</small></button>)}
      </div>
      {view !== 'smart' && (rev.ready ? <FilterChips /> : <Skeleton height={44} />)}
      <div role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>
        {!rev.ready ? <div role="status"><Skeleton height={220} /></div>
          : view === 'dashboard' ? <InsightsDashboard />
            : view === 'reports' ? <FixedReports reportKey={report} setReport={(k) => go('reports', { report: k })} />
              : <SmartReports embedded initialQuery={initialQuery} onQueryConsumed={() => { const n = new URLSearchParams(sp); n.delete('q'); setSp(n, { replace: true }); }} />}
      </div>
    </div>
  );
}
