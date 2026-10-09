// «لوحة المعلومات» — monitoring view: works immediately, no prompt. ONE copy of the headline indicators; detail lives in the fixed reports
// (every card links to its report or to the supporting invoices).
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenue } from '../../context/RevenueContext';
import { useAsync } from '../../utils/useAsync';
import { useAr } from '../../utils/useAr';
import { fmtMoney, fmtInt, unitOfValues, scaled, unitLabel } from '../../utils/money';
import { MetricTile, PpDelta, ToDateFigure } from '../revenue/RevenueUI';
import { basisLabel, BASIS } from '../../data/measure';
import FinancialRelations from '../revenue/FinancialRelations';
import { AmanahMap } from '../revenue/ExecutiveParts';
import UnitBar from '../strategic/UnitBar';
import { AsyncBlock } from '../strategic/AsyncState';
import { generateFinance, budgetExecution, operatingCoverage, financeCompatible, FINANCE_STATUS } from '../../data/syntheticFinance';
import { sourceAr, sourceEn } from '../../data/insightsEngine';
import { CATEGORY_LABELS } from '../../data/revenueMetrics';

const STATUS_COLOR = { collected: 'var(--green)', partial: '#c9a227', overdue: 'var(--danger)', not_due: 'var(--secondary)', cancelled: '#8a978f', excluded: '#6f7d76', objection: '#6B57A6', enforcement: '#9A5C00', linkage_unresolved: '#b07a9a', ineligible_referral: '#4f8d94' };
const STATUS_LABEL = { collected: { ar: 'محصّلة بالكامل', en: 'Collected in full' }, ...CATEGORY_LABELS };
const pct = (v, na) => (v == null ? na : `${(v * 100).toFixed(1)}%`);

export default function InsightsDashboard() {
  const rev = useRevenue(); const { L, B, ar, lang, count } = useAr();
  const { snapshot, prevSnapshot, comparison, data, cfg, targets } = rev; const T = snapshot.totals; const s = rev.scopeEff; const today = cfg.cutoff;
  const comparable = comparison?.comparable;
  const cmpLabel = comparison?.basis === 'same_period_last_year' ? L('مقابل نفس الفترة من العام السابق', 'vs the same period last year') : L('مقابل الفترة السابقة', 'vs the previous period');
  const financeOk = financeCompatible(s, rev.org); const fin = useMemo(() => generateFinance(today), [today]);
  const [rt, setRt] = useState(0);
  const fy = useAsync(async () => { if (!financeOk) return null; const r = await data.series({ amanah: 'all', source: 'all', from: `${today.slice(0, 4)}-01-01`, to: today }, { asOf: today }); return r.values.reduce((t, v) => t + v, 0); }, [data, financeOk, today, rt]);
  if (T.count === 0) return <div className="rv-empty" role="status"><b>{L('لا فواتير في هذا الاختيار.', 'There are no invoices in this selection.')}</b><div>{L('البيانات غير متاحة لهذه المرشحات؛ وسّع الفترة أو أزل مرشحاً. لا تُعرض أصفار بدلاً من الغياب.', 'No data for these filters — widen the period or remove a filter. Absence is not shown as zero.')}</div></div>;

  const u = unitOfValues([T.gross, T.exclusions, T.net, T.collected, T.outstanding]); const kp = (v) => fmtMoney(v, { lang, unit: u });
  const months = snapshot.byMonth; const st = snapshot.byStatus.slice().sort((a, b) => b.count - a.count);
  const aging = snapshot.stock.aging; const uA = unitOfValues(aging.map((a) => a.amount));
  const src = snapshot.bySource.slice().sort((a, b) => b.outstanding - a.outstanding); const prevSrc = new Map((prevSnapshot?.bySource || []).map((g) => [g.key, g]));
  const mun = snapshot.byMunicipality.filter((g) => g.municipality).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5); const uM = unitOfValues(mun.map((g) => g.outstanding));
  const ex = budgetExecution(fin); const cov = fy.data != null ? operatingCoverage(fin, fy.data) : null;

  return (
    <div className="st-page" style={{ gap: 14 }}>
      <div className="st-fresh">
        <span className="st-tag st-tag--actual">{L('بيانات حتى', 'Data to')} <bdi>{snapshot.cutoff}</bdi> ({L('الرياض', 'Riyadh')})</span>
        <span className="st-tag">{fmtInt(T.count)} {L('فاتورة', 'invoices')} · {snapshot.byAmanah.length} {L('أمانة', 'Amanahs')} · {snapshot.bySource.length} {L('مصدر', 'sources')}</span>
        <span className="st-tag st-tag--warn" title={rev.meta?.sizeNote ? B(rev.meta.sizeNote) : ''}>{L('بيانات تجريبية اصطناعية', 'Synthetic demo data')}{rev.meta?.size === 'compact' ? ` — ${L('عينة مضغوطة', 'compact sample')} ${fmtInt(rev.meta.counts?.invoicesTotal)}` : ''}</span>
        <span className="muted" style={{ fontSize: 12 }}>{L('فواتير صادرة في الفترة. ', 'Invoices issued in the period. ')}{basisLabel(rev.scopeEff, BASIS.PERIOD_END, rev.cfg.cutoff, lang)}</span>
      </div>

      <div className="rv-tiles">
        <MetricTile metric="gross" to="/invoices" label={L('إجمالي المفوتر', 'Gross billed')} value={kp(T.gross)} sub={L('قبل الاستبعادات', 'before exclusions')} />
        <MetricTile metric="exclusions" label={L('الاستبعادات', 'Exclusions')} value={kp(T.exclusions)} sub={`${L('نسبة الاستبعاد', 'Exclusion rate')} ${pct(T.exclusionRate.calculable ? T.exclusionRate.value : null, L('غير متاحة', 'n/a'))}`} />
        <MetricTile metric="net" label={L('صافي المفوتر', 'Net billed')} value={kp(T.net)} sub={L('الإجمالي − الاستبعادات', 'Gross − exclusions')} />
        <MetricTile metric="collected" label={L('المحصّل', 'Collected')} value={kp(T.collected)} sub={L('ضمن صافي المفوتر', 'within net billed')} />
        <MetricTile metric="uncollected" label={L('غير المحصّل', 'Uncollected')} value={kp(T.outstanding)} sub={L('الصافي − المحصّل', 'Net − collected')} />
        <MetricTile metric="collectedOverNet" label={L('نسبة التحصيل', 'Collection rate')} value={pct(T.collectedOverNet.calculable ? T.collectedOverNet.value : null, L('غير متاحة', 'Not available'))} delta={<PpDelta change={comparison?.collectedOverNetPp} comparable={comparable} label={cmpLabel} />} sub={L('المحصّل ÷ صافي المفوتر × 100', 'Collected ÷ net billed × 100')} />
      </div>
      <div className="card st-card"><FinancialRelations totals={T} /></div>
      <ToDateFigure snapshot={snapshot} />

      <div className="st-grid">
        <div className="card st-card">
          <b>{L('الفواتير وحالة الدفع', 'Invoices and payment status')} <small className="muted">({fmtInt(T.count)} {L('فاتورة', 'invoices')})</small></b>
          <div role="img" aria-label={L('توزيع أعداد الفواتير حسب الحالة', 'Invoice counts by status')} style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden' }}>{st.map((g) => <i key={g.key} title={`${B(STATUS_LABEL[g.key])}: ${fmtInt(g.count)}`} style={{ width: `${(g.count / T.count) * 100}%`, background: STATUS_COLOR[g.key] || 'var(--line-strong)' }} />)}</div>
          <div className="st-table-wrap"><table className="table" aria-label={L('حالة الدفع', 'Payment status')}><tbody>{st.slice(0, 7).map((g) => <tr key={g.key}><td><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: STATUS_COLOR[g.key], marginInlineEnd: 6 }} />{B(STATUS_LABEL[g.key]) || g.key}</td><td dir="ltr">{count(g.count)}</td><td dir="ltr">{pct(g.count / T.count, '—')}</td></tr>)}</tbody></table></div>
          <Link to="/insights?view=reports&report=status" className="btn btn-sm btn-ghost">{L('تقرير حالة الدفع', 'Payment-status report')}</Link>
        </div>
        <div className="card st-card">
          <b>{L('المتأخرات والتقادم (رصيد قائم)', 'Outstanding and aging (standing balance)')}</b>
          <div className="st-table-wrap"><table className="table" aria-label={L('التقادم', 'Aging')}><thead><tr><th>{L('العمر بعد الاستحقاق', 'Age past due')}</th><th>{L('الفواتير', 'Invoices')}</th><th>{L('غير المحصّل', 'Uncollected')} ({unitLabel(uA, lang)})</th></tr></thead>
            <tbody>{aging.map((a) => <tr key={a.key}><td>{B(a.label)}</td><td dir="ltr">{count(a.count)}</td><td dir="ltr" title={fmtMoney(a.amount, { lang, mode: 'detail' })}>{scaled(a.amount, uA)}</td></tr>)}
              <tr style={{ fontWeight: 800 }}><td>{L('الإجمالي القائم', 'Standing total')}</td><td dir="ltr">{count(snapshot.stock.invoiceCount)}</td><td dir="ltr">{scaled(snapshot.stock.netUncollected, uA)}</td></tr></tbody></table></div>
          <div className="muted" style={{ fontSize: 12 }}>{L(`رصيد في ${snapshot.cutoff} لكل ما صدر حتى ذلك التاريخ، وليس غير محصّل الفترة.`, `A balance at ${snapshot.cutoff} for everything issued up to then, not the period’s uncollected.`)} <Link to="/collection">{L('قائمة التحصيل', 'Collection worklist')}</Link> · <Link to="/insights?view=reports&report=aging">{L('تقرير التقادم', 'Aging report')}</Link></div>
        </div>
      </div>

      <div className="card st-card">
        <b>{L('الاتجاه الشهري (شهر الإصدار)', 'Monthly trend (issue month)')}</b>
        <UnitBar labels={months.map((m) => m.month)} series={[{ label: L('صافي المفوتر', 'Net billed'), values: months.map((m) => m.net) }, { label: L('المحصّل', 'Collected'), values: months.map((m) => m.collected) }]} label={L('الاتجاه الشهري', 'Monthly trend')} />
        <div className="muted" style={{ fontSize: 12 }}>{comparable ? L(`المقارنة بالفترة المكافئة (${prevSnapshot.scope.from} → ${prevSnapshot.scope.to}): نسبة التحصيل ${pct(prevSnapshot.totals.collectedOverNet.value, '—')} سابقاً.`, `Against the equivalent period (${prevSnapshot.scope.from} → ${prevSnapshot.scope.to}): collection rate was ${pct(prevSnapshot.totals.collectedOverNet.value, '—')}.`) : L('لا توجد مقارنة مكافئة لهذه الفترة.', 'No equivalent comparison for this period.')} <Link to="/insights?view=reports&report=trends">{L('تقرير الاتجاهات', 'Trends report')}</Link></div>
      </div>

      <div className="st-grid">
        <div className="card st-card">
          <b>{L('الأمانات', 'Amanahs')}</b>
          <AmanahMap snapshot={snapshot} prevSnapshot={prevSnapshot} comparable={comparable} onPick={rev.setAmanah} />
          <div className="muted" style={{ fontSize: 12 }}><Link to="/insights?view=reports&report=amanah">{L('تقرير الأمانات والبلديات', 'Amanah and municipality report')}</Link> · {L('المقارنة المعدّلة بمزيج الإيرادات في تقرير الأمانات', 'The mix-adjusted comparison is in the Amanah report')}</div>
        </div>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <div className="card st-card">
            <b>{L('مصادر الإيراد', 'Revenue sources')}</b>
            <div className="st-table-wrap"><table className="table" aria-label={L('مصادر الإيراد', 'Revenue sources')}><thead><tr><th>{L('المصدر', 'Source')}</th><th>{L('معدل التحصيل', 'Rate')}</th>{comparable && <th>{L('السابق', 'Prior')}</th>}<th>{L('الفواتير', 'Invoices')}</th></tr></thead>
              <tbody>{src.map((g) => <tr key={g.key}><td><Link to={`/invoices?src=${g.key}`}>{ar ? sourceAr(g.key) : sourceEn(g.key)}</Link></td><td dir="ltr">{pct(g.net > 0 ? g.collected / g.net : null, '—')}</td>{comparable && <td dir="ltr">{pct(prevSrc.get(g.key) && prevSrc.get(g.key).net > 0 ? prevSrc.get(g.key).collected / prevSrc.get(g.key).net : null, '—')}</td>}<td dir="ltr">{count(g.count)}</td></tr>)}</tbody></table></div>
            <Link to="/insights?view=reports&report=sources" className="btn btn-sm btn-ghost">{L('تقرير المصادر', 'Sources report')}</Link>
          </div>
          {mun.length > 0 && (
            <div className="card st-card">
              <b>{L('البلديات (الأعلى غير محصّل)', 'Municipalities (largest uncollected)')}</b>
              <div className="st-table-wrap"><table className="table" aria-label={L('البلديات', 'Municipalities')}><thead><tr><th>{L('البلدية', 'Municipality')}</th><th>{L('غير المحصّل', 'Uncollected')} ({unitLabel(uM, lang)})</th><th>{L('معدل التحصيل', 'Rate')}</th></tr></thead>
                <tbody>{mun.map((g) => <tr key={g.key}><td>{ar ? g.municipality.ar : g.municipality.en}</td><td dir="ltr">{scaled(g.outstanding, uM)}</td><td dir="ltr">{pct(g.net > 0 ? g.collected / g.net : null, '—')}</td></tr>)}</tbody></table></div>
            </div>)}
        </div>
      </div>

      <div className="card st-card">
        <b>{L('الميزانية وتنفيذ الإنفاق', 'Budget and expenditure execution')} <span className="st-tag st-tag--warn">{L('تجريبية اصطناعية', 'synthetic')}</span></b>
        {financeOk ? (
          <AsyncBlock state={fy} onRetry={() => setRt((n) => n + 1)} height={90}>
            <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
              <div className="rv-tile"><div className="rv-tile__label">{L('الميزانية المتناسبة حتى اليوم', 'Budget prorated to date')}</div><div className="rv-tile__value" dir="ltr">{fmtMoney(ex.total.budgetToDate, { lang })}</div></div>
              <div className="rv-tile"><div className="rv-tile__label">{L('الالتزامات', 'Commitments')}</div><div className="rv-tile__value" dir="ltr">{fmtMoney(ex.total.commitments, { lang })}</div></div>
              <div className="rv-tile"><div className="rv-tile__label">{L('المصروف نقداً', 'Paid (cash)')}</div><div className="rv-tile__value" dir="ltr">{fmtMoney(ex.total.paid, { lang })}</div><div className="rv-tile__sub">{L('نسبة الصرف من الميزانية المتناسبة', 'payments ÷ prorated budget')} {pct(ex.total.execution, '—')}</div></div>
              <div className="rv-tile"><div className="rv-tile__label">{L('تغطية الإنفاق التشغيلي (أبواب 1–3)', 'Operating coverage (ch. 1–3)')}</div><div className="rv-tile__value" dir="ltr">{pct(cov?.ratio, L('غير متاحة', 'n/a'))}</div><div className="rv-tile__sub">{L('مقبوضات ÷ صرف نقدي للفترة نفسها', 'receipts ÷ cash payments, same period')}</div></div>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{B(FINANCE_STATUS)}. <Link to="/insights?view=reports&report=budget">{L('تقرير الميزانية والتنفيذ', 'Budget execution report')}</Link> · <Link to="/planning">{L('التخطيط المالي', 'Financial planning')}</Link></div>
          </AsyncBlock>
        ) : <div className="rv-empty" style={{ padding: 14 }}><b>{L('البيانات غير متاحة لهذا النطاق', 'Data not available for this scope')}</b><div style={{ fontSize: 12.5 }}>{L('الميزانية والإنفاق على مستوى وطني لكل المصادر فقط؛ أزل مرشحات الأمانة والبلدية والمصدر والحالة لعرضها.', 'Budget and expenditure exist at national level for all sources only; clear the Amanah, municipality, source and status filters to see them.')}</div></div>}
      </div>

      <div className="muted" style={{ fontSize: 12.5 }}>{L('وحدات تشغيلية:', 'Operational modules:')} <Link to="/invoices">{L('الفواتير', 'Invoices')}</Link> · <Link to="/collection">{L('قائمة التحصيل', 'Collection')}</Link> · <Link to="/contracts">{L('العقود والتنفيذ', 'Contracts & enforcement')}</Link> · <Link to="/sanad-orders">{L('أوامر سند', 'Sanad orders')}</Link> · <Link to="/investment-invoices">{L('فواتير الاستثمار', 'Investment invoices')}</Link> · <Link to="/noncollection">{L('الاستبعادات', 'Exclusions review')}</Link> · <Link to="/risk">{L('جودة البيانات', 'Data quality')}</Link></div>
    </div>
  );
}
