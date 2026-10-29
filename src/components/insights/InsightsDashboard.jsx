import { localize } from '../../utils/zh';
// «لوحة المعلومات» — monitoring view: works immediately, no prompt. ONE copy of the headline indicators; detail lives in the fixed reports
// (every card links to its report or to the supporting invoices).
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../../context/RevenueContext';
import { useAr } from '../../utils/useAr';
import { fmtMoney, fmtInt, unitOfValues, scaled, unitLabel } from '../../utils/money';
import { MetricTile, PpDelta, ToDateFigure } from '../revenue/RevenueUI';
import { basisLabel, BASIS } from '../../data/measure';
import FinancialRelations from '../revenue/FinancialRelations';
import { AmanahMap } from '../revenue/ExecutiveParts';
import RevenueAnalysis from './RevenueAnalysis';
import UnitLines from '../strategic/UnitLines';
import { useAsync } from '../../utils/useAsync';
import DecisionSummary from '../decisions/DecisionSummary';
import { fmtRangeText, fmtMonthText } from '../../data/clock';
import { CATEGORY_LABELS } from '../../data/revenueMetrics';

const pct = (v, na) => (v == null ? na : `${(v * 100).toFixed(1)}%`);

export default function InsightsDashboard() {
  const rev = useRevenue(); const { L, B, ar, lang, count } = useAr();
  const { snapshot, prevSnapshot, comparison, data, cfg, targets } = rev; const T = snapshot.totals; const s = rev.scopeEff; const today = cfg.cutoff;
  const comparable = comparison?.comparable;
  // D30 — «الأداء الشهري للإيرادات»: CUMULATIVE year to date. Net billed accrues by issue month; collected accrues in the month the payment happened (so a closed month never moves, a later payment adds to its own month).
  const seriesScope = useMemo(() => ({ from: s.from, to: s.to, amanah: s.amanah, source: s.source, scopeType: s.scopeType, muni: s.muni, status: s.status, product: s.product, mainClass: s.mainClass, issuedFrom: s.from, issuedTo: s.to }), [s]);
  const { data: ser } = useAsync(() => data.series(seriesScope, { capped: true }), [data, seriesScope]);
  const perf = useMemo(() => {
    if (!ser) return null;
    const netBy = new Map(snapshot.byMonth.map((m) => [m.month, m.net])); let cn = 0; let cc = 0;
    const net = ser.months.map((m) => { cn += netBy.get(m) || 0; return cn; });
    const col = ser.values.map((v) => { cc += v; return cc; });
    return { months: ser.months, net, col };
  }, [ser, snapshot]);
  const cmpRange = prevSnapshot ? fmtRangeText(prevSnapshot.scope.from, prevSnapshot.scope.to, lang) : '';
  const cmpLabel = comparison?.basis === 'same_period_last_year' ? L(`عن العام الماضي (${cmpRange})`, `vs last year (${cmpRange})`) : L(`عن الفترة السابقة (${cmpRange})`, `vs the previous period (${cmpRange})`);
  if (T.count === 0) return <div className="rv-empty" role="status"><b>{L('لا فواتير في هذا الاختيار.', 'There are no invoices in this selection.')}</b><div>{L('البيانات غير متاحة لهذه التصفية؛ وسّع الفترة أو أزل مرشحاً. لا تُعرض أصفار بدلاً من الغياب.', 'No data for these filters — widen the period or remove a filter. Absence is not shown as zero.')}</div></div>;

  const u = unitOfValues([T.gross, T.exclusions, T.net, T.collected, T.outstanding]); const kp = (v) => fmtMoney(v, { lang, unit: u });
  const months = snapshot.byMonth;

  return (
    <div className="st-page" style={{ gap: 16 }}>
      <p className="rv-line" role="status">{L(`${fmtInt(T.count)} فاتورة صدرت في هذه الفترة. `, `${fmtInt(T.count)} invoices issued in this period. `)}<b>{basisLabel(rev.scopeEff, BASIS.PERIOD_END, rev.cfg.cutoff, lang)}</b></p>

      <div className="rv-tiles">
        <MetricTile metric="gross" to="/invoices" label={L('إجمالي المفوتر', 'Gross billed')} value={kp(T.gross)} sub={L('قبل الاستبعادات', 'before exclusions')} />
        <MetricTile metric="exclusions" label={L('الاستبعادات', 'Exclusions')} value={kp(T.exclusions)} sub={`${L('نسبة الاستبعاد', 'Exclusion rate')} ${pct(T.exclusionRate.calculable ? T.exclusionRate.value : null, L('غير متاحة', 'n/a'))}`} />
        <MetricTile metric="net" label={L('صافي المفوتر', 'Net billed')} value={kp(T.net)} sub={L('بعد الاستبعادات', 'after exclusions')} />
        <MetricTile metric="collected" label={L('المحصّل', 'Collected')} value={kp(T.collected)} sub={L('من الصافي', 'of net billed')} />
        <MetricTile metric="uncollected" label={L('غير المحصّل', 'Uncollected')} value={kp(T.outstanding)} sub={L('من فواتير الفترة', 'on the period’s invoices')} />
        <MetricTile metric="collectedOverNet" label={L('نسبة التحصيل', 'Collection rate')} value={pct(T.collectedOverNet.calculable ? T.collectedOverNet.value : null, L('غير متاحة', 'Not available'))} delta={<PpDelta change={comparison?.collectedOverNetPp} comparable={comparable} label={cmpLabel} />} sub={L('من الصافي', 'of net billed')} />
      </div>
      <div className="card st-card"><FinancialRelations totals={T} /></div>
      <ToDateFigure snapshot={snapshot} />

      <DecisionSummary />

      <div className="card st-card">
        <b>{L('الأداء الشهري للإيرادات', 'Monthly revenue performance')}</b> <small className="muted">{L('تراكمي منذ بداية الفترة', 'cumulative from the start of the period')}</small>
        {perf ? <UnitLines labels={perf.months.map((m) => fmtMonthText(m, lang))} series={[{ label: L('صافي المفوتر (تراكمي)', 'Net billed (cumulative)'), values: perf.net }, { label: L('المحصّل (تراكمي)', 'Collected (cumulative)'), values: perf.col }]} label={L('الأداء الشهري للإيرادات', 'Monthly revenue performance')} /> : <div className="muted" role="status">{L('جارٍ الحساب…', 'Calculating…')}</div>}
        <div className="muted" style={{ fontSize: 12 }}>{L('الأشهر المنتهية ثابتة: التحصيل اللاحق يُضاف إلى الشهر الذي حدث فيه ولا يغيّر ما قبله. آخر نقطة تساوي بطاقات الفترة.', 'Closed months stay fixed: a later collection is added to the month it happened in and never changes earlier months. The last point equals the cards of the period.')}</div>
        <div className="muted" style={{ fontSize: 12 }}>{comparable ? L(`في الفترة نفسها من العام الماضي (${fmtRangeText(prevSnapshot.scope.from, prevSnapshot.scope.to, 'ar')}): ${pct(prevSnapshot.totals.collectedOverNet.value, '—')}`, `Same period last year (${fmtRangeText(prevSnapshot.scope.from, prevSnapshot.scope.to, 'en')}): ${pct(prevSnapshot.totals.collectedOverNet.value, '—')}`) : ''}</div>
      </div>

      <AmanahMap snapshot={snapshot} prevSnapshot={prevSnapshot} comparable={comparable} onPick={rev.setAmanah}>
          <div className="muted" style={{ fontSize: 12 }}><Link className="xref" to="/smart-reports?q=%D9%82%D8%A7%D8%B1%D9%86%20%D8%A3%D8%AF%D8%A7%D8%A1%20%D8%A7%D9%84%D8%AA%D8%AD%D8%B5%D9%8A%D9%84%20%D8%A8%D9%8A%D9%86%20%D8%A7%D9%84%D8%A3%D9%85%D8%A7%D9%86%D8%A7%D8%AA">{L('تقرير الأمانات والبلديات', 'Amanah and municipality report')}</Link></div>
      </AmanahMap>

      <RevenueAnalysis />
    </div>
  );
}
