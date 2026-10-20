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
import { sourceAr, sourceEn } from '../../data/insightsEngine';
import { fmtDateText, fmtRangeText, fmtMonthText } from '../../data/clock';
import { CATEGORY_LABELS } from '../../data/revenueMetrics';

const STATUS_COLOR = { collected: 'var(--green)', partial: '#FDB022', overdue: 'var(--danger)', not_due: 'var(--secondary)', cancelled: '#9DA4AE', excluded: '#6C737F', objection: '#6C737F', enforcement: '#B54708', linkage_unresolved: '#9DA4AE', ineligible_referral: '#6C737F' };
const STATUS_LABEL = { collected: { ar: 'محصّلة بالكامل', en: 'Collected in full' }, overdue: { ar: 'مستحقة متأخرة', en: 'Due and overdue' }, not_due: { ar: 'لم يحن استحقاقها', en: 'Not yet due' } };
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
  // D29 — «يحتاج انتباه»: ALL revenue sources, ranked by uncollected × the shortfall from the collection-rate target; it follows the selected الأمانة / الجهة (the snapshot is already scoped)
  const targetRate = targets?.collectionRate?.value ?? 0.6;
  const ranking = useMemo(() => snapshot.bySource.map((g) => {
    const rate = g.net > 0 ? g.collected / g.net : null; const shortfall = rate == null ? 0 : Math.max(0, targetRate - rate);
    const money = fmtMoney(g.outstanding, { lang });
    const reason = rate == null ? L('لا فواتير مستحقة التحصيل في هذا الاختيار.', 'No collectible invoices in this selection.')
      : shortfall > 0 ? L(`غير المحصّل ${money}؛ نسبة التحصيل ${(rate * 100).toFixed(1)}% أقل من المستهدف ${(targetRate * 100).toFixed(0)}%.`, `Uncollected ${money}; collection rate ${(rate * 100).toFixed(1)}% is below the ${(targetRate * 100).toFixed(0)}% target.`)
        : L(`ضمن المستهدف (${(rate * 100).toFixed(1)}%)${g.outstanding > 0 ? `؛ المتبقي ${money}` : ''}.`, `Within target (${(rate * 100).toFixed(1)}%)${g.outstanding > 0 ? `; ${money} still open` : ''}.`);
    return { key: g.key, rate, shortfall, outstanding: g.outstanding, score: g.outstanding * shortfall, reason };
  }).sort((a, b) => b.score - a.score || b.outstanding - a.outstanding), [snapshot, targetRate, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmpRange = prevSnapshot ? fmtRangeText(prevSnapshot.scope.from, prevSnapshot.scope.to, ar ? 'ar' : 'en') : '';
  const cmpLabel = comparison?.basis === 'same_period_last_year' ? L(`عن العام الماضي (${cmpRange})`, `vs last year (${cmpRange})`) : L(`عن الفترة السابقة (${cmpRange})`, `vs the previous period (${cmpRange})`);
  if (T.count === 0) return <div className="rv-empty" role="status"><b>{L('لا فواتير في هذا الاختيار.', 'There are no invoices in this selection.')}</b><div>{L('البيانات غير متاحة لهذه التصفية؛ وسّع الفترة أو أزل مرشحاً. لا تُعرض أصفار بدلاً من الغياب.', 'No data for these filters — widen the period or remove a filter. Absence is not shown as zero.')}</div></div>;

  const u = unitOfValues([T.gross, T.exclusions, T.net, T.collected, T.outstanding]); const kp = (v) => fmtMoney(v, { lang, unit: u });
  const months = snapshot.byMonth; const DUE_KEYS = ['collected', 'overdue', 'not_due']; const st = (snapshot.byDue || []).filter((g) => DUE_KEYS.includes(g.key)); // D28: three statuses only — collected in full · overdue · not yet due (excluded invoices live in إدارة الاستبعادات)
  const stTotal = st.reduce((t, g) => t + g.count, 0);
  const aging = snapshot.stock.aging; const uA = unitOfValues(aging.map((a) => a.amount));
  const src = snapshot.bySource.slice().sort((a, b) => b.outstanding - a.outstanding); const prevSrc = new Map((prevSnapshot?.bySource || []).map((g) => [g.key, g]));
  const mun = snapshot.byMunicipality.filter((g) => g.municipality).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5); const uM = unitOfValues(mun.map((g) => g.outstanding));

  return (
    <div className="st-page" style={{ gap: 14 }}>
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

      {ranking.length > 0 && (
        <section className="card st-card rv-attention" aria-label={L('يحتاج انتباهاً', 'Needs attention')}>
          <h2 className="rv-sec-title">{L('يحتاج انتباهاً', 'Needs attention')}</h2>
          <ul className="rv-attention__list">{ranking.slice(0, 1).map((r) => (
            <li key={r.key}><b>{ar ? sourceAr(r.key) : sourceEn(r.key)}</b><span>{r.reason}</span><Link to={`/invoices?src=${r.key}`}>{L('عرض الفواتير', 'View invoices')}</Link></li>
          ))}</ul>
          <details className="rv-more" open={undefined}>
            <summary>{L(`ترتيب كل مصادر الإيراد (${ranking.length}) من الأشد حاجة للانتباه إلى الأقل`, `All revenue sources (${ranking.length}), from most to least attention needed`)}</summary>
            <ol className="rv-attention__rank">{ranking.map((r) => (
              <li key={r.key}><b>{ar ? sourceAr(r.key) : sourceEn(r.key)}</b><span>{r.reason}</span><Link to={`/invoices?src=${r.key}`}>{L('الفواتير', 'Invoices')}</Link></li>
            ))}</ol>
            <div className="muted" style={{ fontSize: 12 }}>{L('الترتيب = غير المحصّل × النقص عن مستهدف نسبة التحصيل، ويُعاد حسابه للأمانة / الجهة المختارة.', 'Rank = uncollected × shortfall from the collection-rate target; it is recalculated for the selected Amanah / entity.')}</div>
          </details>
        </section>
      )}

      <div className="st-grid">
        <div className="card st-card">
          <b>{L('الفواتير وحالة الدفع', 'Invoices and payment status')} <small className="muted">({fmtInt(T.count)} {L('فاتورة', 'invoices')})</small></b>
          <div role="img" aria-label={L('توزيع أعداد الفواتير حسب الحالة', 'Invoice counts by status')} style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden' }}>{st.map((g) => <i key={g.key} title={`${B(STATUS_LABEL[g.key])}: ${fmtInt(g.count)}`} style={{ width: `${(g.count / Math.max(1, stTotal)) * 100}%`, background: STATUS_COLOR[g.key] || 'var(--line-strong)' }} />)}</div>
          <div className="st-table-wrap" tabIndex={0}><table className="table" aria-label={L('حالة الدفع', 'Payment status')}><tbody>{st.map((g) => <tr key={g.key}><td><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: STATUS_COLOR[g.key], marginInlineEnd: 6 }} />{B(STATUS_LABEL[g.key]) || g.key}</td><td dir="ltr">{count(g.count)}</td><td dir="ltr">{pct(g.count / Math.max(1, stTotal), '—')}</td></tr>)}</tbody></table></div>
          <Link to="/smart-reports?q=%D8%A3%D9%86%D8%B4%D8%A6%20%D8%AA%D9%82%D8%B1%D9%8A%D8%B1%20%D8%AD%D8%A7%D9%84%D8%A9%20%D8%A7%D9%84%D8%AF%D9%81%D8%B9%20%D9%84%D9%84%D9%81%D9%88%D8%A7%D8%AA%D9%8A%D8%B1" className="btn btn-sm btn-ghost">{L('تقرير حالة الدفع', 'Payment-status report')}</Link>
        </div>
        <div className="card st-card">
          <b>{L(`الرصيد القائم حتى ${fmtDateText(snapshot.cutoff, 'ar')}`, `Standing balance at ${fmtDateText(snapshot.cutoff, 'en')}`)}</b> <small className="muted">{L('أعمار غير المحصّل بعد الاستحقاق', 'age of what is unpaid past due')}</small>
          <div className="st-table-wrap" tabIndex={0}><table className="table" aria-label={L('التقادم', 'Aging')}><thead><tr><th>{L('العمر بعد الاستحقاق', 'Age past due')}</th><th>{L('الفواتير', 'Invoices')}</th><th>{L('غير المحصّل', 'Uncollected')} ({unitLabel(uA, lang)})</th></tr></thead>
            <tbody>{aging.map((a) => <tr key={a.key}><td>{B(a.label)}</td><td dir="ltr">{count(a.count)}</td><td dir="ltr" title={fmtMoney(a.amount, { lang, mode: 'detail' })}>{scaled(a.amount, uA)}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td>{L('إجمالي الرصيد القائم', 'Standing total')}</td><td dir="ltr">{count(snapshot.stock.invoiceCount)}</td><td dir="ltr">{scaled(snapshot.stock.netUncollected, uA)}</td></tr></tbody></table></div>
          <div className="muted" style={{ fontSize: 12 }}>{L('يشمل كل الفواتير غير المسددة مهما كان تاريخ إصدارها.', 'Includes every unpaid invoice, whatever its issue date.')}</div>
        </div>
      </div>

      <div className="card st-card">
        <b>{L('الأداء الشهري للإيرادات', 'Monthly revenue performance')}</b> <small className="muted">{L('تراكمي منذ بداية الفترة', 'cumulative from the start of the period')}</small>
        {perf ? <UnitLines labels={perf.months.map((m) => fmtMonthText(m, ar ? 'ar' : 'en'))} series={[{ label: L('صافي المفوتر (تراكمي)', 'Net billed (cumulative)'), values: perf.net }, { label: L('المحصّل (تراكمي)', 'Collected (cumulative)'), values: perf.col }]} label={L('الأداء الشهري للإيرادات', 'Monthly revenue performance')} /> : <div className="muted" role="status">{L('جارٍ الحساب…', 'Calculating…')}</div>}
        <div className="muted" style={{ fontSize: 12 }}>{L('الأشهر المنتهية ثابتة: التحصيل اللاحق يُضاف إلى الشهر الذي حدث فيه ولا يغيّر ما قبله. آخر نقطة تساوي بطاقات الفترة.', 'Closed months stay fixed: a later collection is added to the month it happened in and never changes earlier months. The last point equals the cards of the period.')}</div>
        <div className="muted" style={{ fontSize: 12 }}>{comparable ? L(`في الفترة نفسها من العام الماضي (${fmtRangeText(prevSnapshot.scope.from, prevSnapshot.scope.to, 'ar')}): ${pct(prevSnapshot.totals.collectedOverNet.value, '—')}`, `Same period last year (${fmtRangeText(prevSnapshot.scope.from, prevSnapshot.scope.to, 'en')}): ${pct(prevSnapshot.totals.collectedOverNet.value, '—')}`) : ''}</div>
      </div>

      <div className="st-grid st-grid--wide-first">
        <div className="card st-card">
          <b>{L('الأمانات / الجهات', 'Amanahs')}</b>
          <AmanahMap snapshot={snapshot} prevSnapshot={prevSnapshot} comparable={comparable} onPick={rev.setAmanah} />
          <div className="muted" style={{ fontSize: 12 }}><Link className="xref" to="/smart-reports?q=%D9%82%D8%A7%D8%B1%D9%86%20%D8%A3%D8%AF%D8%A7%D8%A1%20%D8%A7%D9%84%D8%AA%D8%AD%D8%B5%D9%8A%D9%84%20%D8%A8%D9%8A%D9%86%20%D8%A7%D9%84%D8%A3%D9%85%D8%A7%D9%86%D8%A7%D8%AA">{L('تقرير الأمانات والبلديات', 'Amanah and municipality report')}</Link></div>
        </div>
        <div className="st-pair">
          <div className="card st-card">
            <b>{L('مصادر الإيراد', 'Revenue sources')}</b>
            <div className="st-table-wrap" tabIndex={0}><table className="table" aria-label={L('مصادر الإيراد', 'Revenue sources')}><thead><tr><th>{L('المصدر', 'Source')}</th><th>{L('معدل التحصيل', 'Rate')}</th>{comparable && <th>{L('السابق', 'Prior')}</th>}<th>{L('الفواتير', 'Invoices')}</th></tr></thead>
              <tbody>{src.map((g) => <tr key={g.key}><td><Link to={`/invoices?src=${g.key}`}>{ar ? sourceAr(g.key) : sourceEn(g.key)}</Link></td><td dir="ltr">{pct(g.net > 0 ? g.collected / g.net : null, '—')}</td>{comparable && <td dir="ltr">{pct(prevSrc.get(g.key) && prevSrc.get(g.key).net > 0 ? prevSrc.get(g.key).collected / prevSrc.get(g.key).net : null, '—')}</td>}<td dir="ltr">{count(g.count)}</td></tr>)}</tbody></table></div>
            <Link to="/smart-reports?q=%D8%AD%D9%84%D9%84%20%D8%A7%D9%84%D8%A5%D9%8A%D8%B1%D8%A7%D8%AF%D8%A7%D8%AA%20%D8%AD%D8%B3%D8%A8%20%D8%A7%D9%84%D9%85%D8%B5%D8%AF%D8%B1" className="btn btn-sm btn-ghost">{L('تقرير المصادر', 'Sources report')}</Link>
          </div>
          {mun.length > 0 && (
            <div className="card st-card">
              <b>{L('البلديات (الأعلى غير محصّل)', 'Municipalities (largest uncollected)')}</b>
              <div className="st-table-wrap" tabIndex={0}><table className="table" aria-label={L('البلديات', 'Municipalities')}><thead><tr><th>{L('البلدية', 'Municipality')}</th><th>{L('غير المحصّل', 'Uncollected')} ({unitLabel(uM, lang)})</th><th>{L('معدل التحصيل', 'Rate')}</th></tr></thead>
                <tbody>{mun.map((g) => <tr key={g.key}><td>{ar ? g.municipality.ar : g.municipality.en}</td><td dir="ltr">{scaled(g.outstanding, uM)}</td><td dir="ltr">{pct(g.net > 0 ? g.collected / g.net : null, '—')}</td></tr>)}</tbody></table></div>
            </div>)}
        </div>
      </div>

      <RevenueAnalysis />
    </div>
  );
}
