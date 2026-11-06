// «لوحة المعلومات» /insights — the redesigned monitoring page (docs/insights-redesign-spec.md). Each section answers a DIFFERENT question, in this order:
//   KPI strip (what are the figures?) → performance summary (what changed / where is the gap / what is urgent?) → «الأداء حسب المنطقة» (where?) → «أبرز ما يحتاج مراجعة» (what should I check?)
// + ONE details panel on demand and the OPTIONAL heatmap. Every section reads the SAME page scope and the SAME authorised entities — nothing is reset to the Ministry. The dashboard is INDEPENDENT of the collection plans
// (no plan store, no reference plan, no targets): it is invoice-based only (docs/insights-redesign-spec.md «Implementation notes — S (decoupling)»).
// The removed content (the «من الإجمالي إلى المحصّل» charts, «الأداء عبر الزمن», the old «تحليل تفصيلي» container) lives on in the comparison panel and in the export model, which is unchanged.
import React, { useMemo, useState, useCallback } from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { useAccess } from '../../context/AuthContext';
import { useAr } from '../../utils/useAr';
import { useAsync } from '../../utils/useAsync';
import { useDashboardDecisions } from '../../data/useDecisions';
import { geoScopeKey } from '../../data/geoScope';
import { basisLabel, BASIS } from '../../data/measure';
import { fmtRangeText } from '../../data/clock';
import { unitOfValues, scaled, unitLabel } from '../../utils/money';
import { PpDelta, ToDateFigure } from '../revenue/RevenueUI';
import KpiStrip from '../invoices/KpiStrip';
import { AsyncBlock } from '../strategic/AsyncState';
import { loadRegionalDataset, authorisedEntityKeys } from '../../data/regional/regionalPerformance';
import { buildPerformanceSummary } from '../../data/regional/performanceSummary';
import { buildReviewPriorities, subsumedKeys } from '../../data/regional/reviewPriorities';
import PerformanceSummary from './PerformanceSummary';
import RegionalPerformance from './RegionalPerformance';
import RegionDetailPanel, { TOTAL_SEL } from './RegionDetailPanel';
import HeatmapDialog from './HeatmapDialog';
import ReviewPriorities from './ReviewPriorities';

const pct = (v, na) => (v == null ? na : `${(v * 100).toFixed(1)}%`);

/** the Decision Room items WITHOUT any plan lookup (useDashboardDecisions), read ONLY for a person who holds the `decisions` module (the hook is mounted only then) */
function DecisionsFeed({ children }) { const D = useDashboardDecisions(); return children({ items: D.items, ready: D.ready && !D.error }); }
/** a failure of the Decision Room feed removes only the cases that depend on it (the priority finding and the review list), never the dashboard */
class FeedBoundary extends React.Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) { console.error('[insights] the Decision Room feed failed:', e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function InsightsDashboard() {
  const access = useAccess(); const canDecide = access.can('decisions');
  const inner = (d) => <Body items={d.items} decisionsReady={d.ready} canDecide={canDecide} />;
  return canDecide ? <FeedBoundary fallback={inner({ items: null, ready: true })}><DecisionsFeed>{inner}</DecisionsFeed></FeedBoundary> : inner({ items: null, ready: true });
}

function Body({ items, decisionsReady, canDecide }) {
  const rev = useRevenue(); const { L, lang } = useAr(); const access = useAccess(); const [retry, setRetry] = useState(0);
  const { snapshot, prevSnapshot, comparison, cfg } = rev; const T = snapshot.totals; const s = rev.scopeEff;
  const comparable = comparison?.comparable;

  /* the authorised entities: the account's dashboard scope (the data service already narrows; this is the client-side guarantee) */
  const dashScope = access.effectiveScope('dashboard');
  const authKey = geoScopeKey(dashScope);
  const authorisedKeys = useMemo(() => authorisedEntityKeys({ geoScope: dashScope }), [authKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* the ONE dataset (page scope, authorised entities): invoice-based only */
  const bundle = useAsync(() => loadRegionalDataset(rev, { authorisedKeys }), [snapshot, prevSnapshot, comparison, authKey, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  const dataset = bundle.data || null;
  const summary = useMemo(() => (dataset ? buildPerformanceSummary({ dataset, items, canSeeDecisions: canDecide }) : null), [dataset, items, canDecide]);
  // the highest-priority issue is already the summary's third finding: the review list continues AFTER it (no repetition; aggregates already subsumed by their entity cases stay out)
  const prioKey = summary?.findings.find((f) => f.id === 'priority')?.basis?.itemKey || null;
  const review = useMemo(() => {
    if (!canDecide) return null;
    const sub = subsumedKeys(items || []);
    return buildReviewPriorities({ items: (items || []).filter((i) => !sub.has(i.key) && i.key !== prioKey), canSeeDecisions: true });
  }, [items, canDecide, prioKey]);

  const [detail, setDetail] = useState(null); const [heat, setHeat] = useState(false);
  const openDetail = useCallback((t) => setDetail(t && t.level ? { level: t.level, key: t.key } : TOTAL_SEL), []);
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeHeat = useCallback(() => setHeat(false), []);

  if (T.count === 0) return <div className="rv-empty" role="status"><b>{L('لا فواتير في هذا الاختيار.', 'There are no invoices in this selection.')}</b><div>{L('البيانات غير متاحة لهذه التصفية؛ وسّع الفترة أو أزل مرشحاً. لا تُعرض أصفار بدلاً من الغياب.', 'No data for these filters — widen the period or remove a filter. Absence is not shown as zero.')}</div><button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={rev.resetScope}>{L('مسح الفلاتر', 'Clear filters')}</button></div>;

  /* ---- the ONE KPI strip ---- */
  const u = unitOfValues([T.gross, T.exclusions, T.net, T.collected, T.outstanding]); const unit = unitLabel(u, lang); const val = (v) => scaled(v, u);
  const cutoffInfo = basisLabel(s, BASIS.PERIOD_END, cfg.cutoff, lang);
  const cmpRange = prevSnapshot ? fmtRangeText(prevSnapshot.scope.from, prevSnapshot.scope.to, lang) : '';
  const cmpLabel = comparison?.basis === 'same_period_last_year' ? L(`عن العام الماضي (${cmpRange})`, `vs last year (${cmpRange})`) : L(`عن الفترة السابقة (${cmpRange})`, `vs the previous period (${cmpRange})`);
  const na = L('غير متاحة', 'Not available');
  const kpis = [
    { key: 'gross', label: L('إجمالي المفوتر', 'Gross billed'), value: val(T.gross), unit, info: L('إجمالي فواتير الفترة قبل الاستبعادات.', 'All invoices of the period before exclusions.') },
    { key: 'exclusions', label: L('الاستبعادات', 'Exclusions'), value: val(T.exclusions), unit, sub: `${L('من الإجمالي', 'of gross')} ${pct(T.exclusionRate.calculable ? T.exclusionRate.value : null, na)}`, info: L('المبالغ المستبعدة من الإجمالي وفق قواعد الاستبعاد المعتمدة.', 'Amounts excluded from gross under the approved exclusion rules.') },
    { key: 'net', label: L('صافي المفوتر', 'Net billed'), value: val(T.net), unit, info: L('الإجمالي − الاستبعادات.', 'Gross − exclusions.') },
    { key: 'collected', label: L('المحصّل', 'Collected'), value: val(T.collected), unit, tone: 'collected', info: <>{L('المحصّل من صافي فواتير الفترة.', 'Collected on the period’s net billed.')} <b>{cutoffInfo}</b></> },
    { key: 'uncollected', label: L('غير المحصّل', 'Uncollected'), value: val(T.outstanding), unit, tone: 'unpaid', info: L('الصافي − المحصّل.', 'Net − collected.') },
    { key: 'rate', label: L('نسبة التحصيل', 'Collection rate'), value: pct(T.collectedOverNet.calculable ? T.collectedOverNet.value : null, na), sub: <PpDelta change={comparison?.collectedOverNetPp} comparable={comparable} label={cmpLabel} />, info: <>{L('المحصّل ÷ صافي المفوتر.', 'Collected ÷ net billed.')} <b>{cutoffInfo}</b></> }
  ];
  const bundleState = { ...bundle, data: bundle.data, loading: bundle.loading };

  return (
    <div className="st-page ins-page" style={{ gap: 16 }}>
      <div className="ins-kpis" aria-busy={rev.loading ? 'true' : undefined}>
        <KpiStrip items={kpis} label={L('المؤشرات المالية', 'Financial indicators')} />
        <ToDateFigure snapshot={snapshot} />
      </div>
      <AsyncBlock state={bundleState} onRetry={() => setRetry((n) => n + 1)} height={280}>
        {dataset && (
          <>
            <PerformanceSummary summary={summary} onSelect={openDetail} onOpenFull={() => openDetail(TOTAL_SEL)} />
            <RegionalPerformance dataset={dataset} selected={detail} onSelect={openDetail} onOpenHeatmap={() => setHeat(true)} onOpenFull={() => openDetail(TOTAL_SEL)} loading={bundle.loading} />
            {review ? <ReviewPriorities review={review} loading={!decisionsReady} /> : null}
            <RegionDetailPanel dataset={dataset} sel={detail} onSelect={openDetail} onClose={closeDetail} invoicesAllowed={access.can('invoices_collected')} />
            <HeatmapDialog dataset={dataset} open={heat} onClose={closeHeat} onSelectEntity={(k) => { setHeat(false); openDetail({ level: 'entity', key: k }); }} />
          </>
        )}
      </AsyncBlock>
    </div>
  );
}
