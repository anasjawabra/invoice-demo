import { localize } from '../utils/zh';
// «لوحة المعلومات والتقارير» — management area 1: the dashboard (monitor). The fixed reports were removed; «التقارير الذكية» is its own main page (/smart-reports).
import React from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAr } from '../utils/useAr';
import FilterChips from '../components/strategic/FilterChips';
import { DataStatus } from '../components/revenue/RevenueUI';
import InsightsDashboard from '../components/insights/InsightsDashboard';
import { Skeleton } from '../components/strategic/AsyncState';
import { fmtRangeText } from '../data/clock';
import { amanahFilterOptions } from '../data/revenueLedger';
import { sourceAr, sourceEn } from '../data/insightsEngine';

export default function InsightsHub() {
  const rev = useRevenue(); const { L, ar , lang } = useAr();
  const [sp] = useSearchParams();
  const initialQuery = sp.get('q');
  if (sp.get('view') === 'smart') return <Navigate to={`/smart-reports${initialQuery ? `?q=${encodeURIComponent(initialQuery)}` : ''}`} replace />; // «التقارير الذكية» is its own main page; the fixed reports were removed
  const sEff = rev.scopeEff; const amName = (k) => { const x = amanahFilterOptions().find((o) => o.key === k); return x ? (ar ? x.ar : localize(x.en, lang)) : k; };
  const scopeSummary = [sEff.amanah === 'all' ? L('كل الأمانات والجهات', 'All Amanahs') : [].concat(sEff.amanah).map(amName).join(ar ? '، ' : ', '), sEff.source === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(sEff.source) : localize(sourceEn(sEff.source), lang))].join(' · ');

  return (
    <div className="st-page">
      <header className="st-head">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{L('لوحة المعلومات والتقارير', 'Dashboards and reports')}</h1>
          <div className="muted" style={{ fontSize: 13 }}>{rev.ready ? L(`فواتير صدرت ${fmtRangeText(rev.scopeEff.from, rev.scopeEff.to, 'ar')} · ${scopeSummary}`, `Invoices issued ${fmtRangeText(rev.scopeEff.from, rev.scopeEff.to, 'en')} · ${scopeSummary}`) : ''}</div>
        </div>
        <button type="button" className="btn btn-sm no-print" onClick={() => window.print()} title={L('يطبع اللوحة بالتصفية الحالية، ويمكن حفظها PDF من نافذة الطباعة', 'Prints the dashboard with the current filters; save it as PDF from the print dialog')}>{L('طباعة / تصدير PDF', 'Print / export PDF')}</button>
      </header>
      {rev.ready ? <FilterChips /> : <Skeleton height={44} />}
      <DataStatus />
      <div aria-busy={rev.loading ? 'true' : undefined} style={rev.loading ? { opacity: 0.55, transition: 'opacity .15s' } : undefined}>
        {!rev.ready ? <div role="status"><Skeleton height={220} /></div>
          : <InsightsDashboard />}
      </div>
    </div>
  );
}
