// «لوحة المعلومات والتقارير» — management area 1: the dashboard (monitor). The fixed reports were removed; «التقارير الذكية» is its own main page (/smart-reports).
import useGate from '../components/access/useGate';
import React, { useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAr } from '../utils/useAr';
import FilterChips from '../components/strategic/FilterChips';
import { DataStatus } from '../components/revenue/RevenueUI';
import InsightsDashboard from '../components/insights/InsightsDashboard';
import { Skeleton } from '../components/strategic/AsyncState';
import ExportDialog from '../components/smart/ExportDialog';
import { buildDashboardModel, withDashboardView, DASHBOARD_PAGE } from '../data/dashboardReport';
import { buildReportModel } from '../data/reportModel';
import { pageViewStore } from '../components/charts/pageChartView';
import { userKeyOf } from '../data/reportStore';
import { viewIsDefault } from '../data/reportView';

export default function InsightsHub() {
  const rev = useRevenue(); const { L, ar, lang } = useAr(); const xg = useGate('export.dashboard');
  const [exp, setExp] = useState({ open: false, busy: false, model: null, err: false });
  const openExport = async () => { if (exp.busy) return; setExp((x) => ({ ...x, busy: true, err: false })); try { const l0 = lang === 'ar' ? 'ar' : 'en'; const model = await buildDashboardModel(rev, l0);
      const view = pageViewStore().load(userKeyOf(rev.user), DASHBOARD_PAGE); // the chart types the person chose on this page are carried into the file (the same applyView Smart Reports uses)
      if (viewIsDefault(view)) setExp({ open: true, busy: false, model, versions: null, err: false });
      else { const other = l0 === 'ar' ? 'en' : 'ar'; const m2 = buildReportModel({ ...model._inputs, lang: other }); const mk = (m) => withDashboardView(m, view, model._inputs); setExp({ open: true, busy: false, model, versions: [{ id: 'dashboard', models: { [l0]: mk(model), [other]: mk(m2) } }], err: false }); } } catch (e) { console.error('[dashboard] export model failed:', e); setExp({ open: false, busy: false, model: null, err: true }); } };
  const [sp] = useSearchParams();
  // the dashboard is independent of the collection plans: no plan filter, no reference plan, no targets
  const initialQuery = sp.get('q');
  if (sp.get('view') === 'smart') return <Navigate to={`/smart-reports${initialQuery ? `?q=${encodeURIComponent(initialQuery)}` : ''}`} replace />; // «التقارير الذكية» is its own main page; the fixed reports were removed

  return (
    <div className="st-page">
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('لوحة المعلومات والتقارير', 'Dashboards and reports')}</h1>
        </div>
        <button type="button" className="btn btn-sm no-print" disabled={!rev.ready || rev.snapshot?.totals?.count === 0 || exp.busy || !xg.allowed} onClick={openExport} title={xg.allowed ? L('تصدير لوحة المعلومات بالتصفية الحالية: الفترة وأساس الحساب وتاريخ البيانات في الملف', 'Export the dashboard with the current filters: period, calculation basis and data cutoff are in the file') : xg.reason}>{exp.busy ? L('جارٍ التجهيز…', 'Preparing…') : L('تصدير التقرير', 'Export report')}</button>
      </header>
      {exp.err && <div className="rv-callout rv-callout--bad" role="alert">{L('تعذّر تجهيز ملف التصدير.', 'The export could not be prepared.')}</div>}
      {exp.model && <ExportDialog open={exp.open} onClose={() => setExp((x) => ({ ...x, open: false }))} versions={exp.versions || [{ id: 'dashboard', model: exp.model }]} activeId="dashboard" L={L} ar={ar} />}
      {rev.ready ? <FilterChips /> : <Skeleton height={44} />}
      <DataStatus />
      <div aria-busy={rev.loading ? 'true' : undefined} style={rev.loading ? { opacity: 0.55, transition: 'opacity .15s' } : undefined}>
        {!rev.ready ? <div role="status"><Skeleton height={220} /></div>
          : <InsightsDashboard />}
      </div>
    </div>
  );
}
