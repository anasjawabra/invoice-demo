import React, { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { RecordLink as Link } from '../utils/returnContext';
import { invoicePath } from '../utils/paths';
import { useAsync } from '../utils/useAsync';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ScopeBar, MetricTile } from '../components/revenue/RevenueUI';
import { PctBadge } from '../components/strategic/EntityMap';
import { EXCLUSION_REASONS, ORIGIN_AR, ORIGIN_EN } from '../data/iim';
import { groupByKey, groupName, groupTotals, mainChallenge } from '../data/productInsights';

// صفحة المنتج: its KPIs, its challenges (التحديات — a SECTION of the product, not a page of its own), its invoices. The Furas product adds contracts, receivables, expected
// collection, contracting growth and the link to asset values — the last one a placeholder: no asset valuation exists in the demo and none is invented.
export default function ProductPage() {
  const { key } = useParams(); const keys = groupByKey(key);
  const rev = useRevenue(); const nav = useNavigate();
  const { L, ar, lang, short, count, sar } = useL();
  const e = rev.scopeEff; const targetRate = rev.targets?.collectionRate?.value ?? 0.6;
  const scope = useMemo(() => ({ from: e.from, to: e.to, amanah: e.amanah, source: e.source, scopeType: e.scopeType, muni: e.muni, status: e.status, mainClass: e.mainClass, product: keys || [] }), [e, keys]);
  const { data: snap } = useAsync(() => (keys ? rev.data.snapshot(scope) : Promise.resolve(null)), [rev.data, scope, keys]);
  const { data: lst } = useAsync(() => (keys ? rev.data.list(scope, { filters: { state: 'noncollected' }, page: 0, pageSize: 12, sort: { key: 'outstanding', dir: 'desc' } }) : Promise.resolve(null)), [rev.data, scope, keys]);
  const { data: noContract } = useAsync(() => (keys && keys.includes('foras') ? rev.data.anomalies(scope, 1, { codes: ['investment_no_contract'] }) : Promise.resolve(null)), [rev.data, scope, keys]);
  const isFuras = !!keys && keys.includes('foras');
  const { data: cd } = useAsync(() => (isFuras ? rev.data.contracts({ amanah: e.amanah, source: 'investment', from: '2000-01-01', to: rev.cfg.cutoff }) : Promise.resolve(null)), [rev.data, isFuras, e.amanah, rev.cfg.cutoff]);
  if (!keys) return <Navigate to="/products" replace />;

  const T = snap ? groupTotals(snap.byProduct, keys) : null; const name = groupName(keys, lang);
  // challenges: each one is computed from the product's own figures
  const challenges = [];
  if (T && T.count > 0) {
    if (T.rate != null && T.rate < targetRate) challenges.push({ k: 'rate', text: L(`Collection rate ${(T.rate * 100).toFixed(1)}% is below the ${(targetRate * 100).toFixed(0)}% target.`, `نسبة التحصيل ${(T.rate * 100).toFixed(1)}% دون المستهدف ${(targetRate * 100).toFixed(0)}%.`) });
    const top = EXCLUSION_REASONS.map((r) => ({ r, s: snap.ruleStats?.[r.ruleId] })).filter((x) => x.s?.primaryCount > 0).sort((a, b) => b.s.primaryAmount - a.s.primaryAmount)[0];
    if (top && T.exclusionsRules > 0) challenges.push({ k: 'excl', text: L(`Exclusions remove ${short(T.exclusionsRules)}; the largest reason is «${top.r.en}» (${count(top.s.primaryCount)} invoices).`, `الاستبعادات تُخرج ${short(T.exclusionsRules)}؛ وأكبر سبب «${top.r.ar}» (${count(top.s.primaryCount)} فاتورة).`), to: '/exclusions' });
    if (T.net > 0 && T.overdueOutstanding > 0) challenges.push({ k: 'overdue', text: L(`${short(T.overdueOutstanding)} is overdue (${((T.overdueOutstanding / T.net) * 100).toFixed(1)}% of net billed).`, `${short(T.overdueOutstanding)} متأخر السداد (${((T.overdueOutstanding / T.net) * 100).toFixed(1)}% من صافي المفوتر).`), to: '/collection' });
    if (noContract?.total > 0) challenges.push({ k: 'nocontract', text: L(`${count(noContract.total)} investment invoices are not linked to a contract.`, `${count(noContract.total)} فاتورة استثمار غير مرتبطة بعقد.`), to: '/risk' });
    if (!challenges.length) challenges.push({ k: 'ok', text: L('No material challenge in this selection.', 'لا تحدٍّ جوهري في هذا الاختيار.') });
  }
  // Furas: contracts, receivables, expected collection and contracting growth (from the contract schedules)
  const cards = cd?.cards || [];
  const sum = (f) => cards.reduce((t, c) => t + f(c.totals), 0);
  const yr = Number(rev.cfg.cutoff.slice(0, 4)); const newOf = (y) => cards.filter((c) => String(c.start).slice(0, 4) === String(y));
  const nThis = newOf(yr); const nPrev = newOf(yr - 1); const vThis = nThis.reduce((t, c) => t + c.totals.contractValue, 0); const vPrev = nPrev.reduce((t, c) => t + c.totals.contractValue, 0);

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{name}</h1>
          <div className="page-sub"><Link to="/products">{L('Product management', 'إدارة المنتجات')}</Link> · {L('KPIs, challenges and invoices of this product', 'مؤشرات هذا المنتج وتحدياته وفواتيره')}</div>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => { rev.setProduct(keys); nav('/invoices'); }}>{L('Open the invoices list for this product', 'فتح قائمة الفواتير لهذا المنتج')}</button>
      </div>
      <ScopeBar hideStatus />
      {!T ? <div className="muted" role="status">{L('Calculating…', 'جارٍ الحساب…')}</div> : (
        <>
          <div className="rv-tiles">
            <MetricTile label={L('Billed', 'إجمالي المفوتر')} value={short(T.gross)} sub={L(`${count(T.count)} invoices`, `${count(T.count)} فاتورة`)} />
            <MetricTile label={L('Collected', 'المحصّل')} value={short(T.collected)} sub={L('of net billed', 'من صافي المفوتر')} />
            <MetricTile label={L('Total uncollected', 'إجمالي غير المحصل')} value={short(T.uncollectedTotal)} sub={L(`of which excluded ${short(T.exclusionsRules)}`, `منه مستبعد ${short(T.exclusionsRules)}`)} />
            <MetricTile label={L('Collection rate', 'نسبة التحصيل')} value={T.rate == null ? '—' : <PctBadge kind="share" v={T.rate} text={`${(T.rate * 100).toFixed(1)}%`} />} sub={mainChallenge(T, { targetRate, L })} />
          </div>

          <section className="card card-pad" aria-label={L('Challenges', 'التحديات')}>
            <h2 className="h3" style={{ marginTop: 0 }}>{L('Challenges', 'التحديات')}</h2>
            <ul className="prod-challenges">{challenges.map((c) => <li key={c.k}>{c.text}{c.to && <> <Link to={c.to}>{L('Open', 'عرض')}</Link></>}</li>)}</ul>
          </section>

          {isFuras && (
            <section className="card card-pad" aria-label={L('Contracts and receivables', 'العقود والمستحقات')}>
              <h2 className="h3" style={{ marginTop: 0 }}>{L('Contracts and receivables (central invoices only)', 'العقود والمستحقات (الفواتير المركزية فقط)')}</h2>
              <div className="rv-tiles">
                <MetricTile label={L('Contract values', 'قيم العقود')} value={short(sum((t) => t.contractValue))} sub={L(`${count(cards.length)} contracts`, `${count(cards.length)} عقود`)} />
                <MetricTile label={L('Receivables to date', 'المستحقات حتى تاريخه')} value={short(sum((t) => t.dueToDate))} sub={L('installments due up to the reference date', 'دفعات استحقت حتى تاريخ المرجع')} />
                <MetricTile label={L('Collected', 'المحصّل')} value={short(sum((t) => t.collected))} sub={L('on the contract payments', 'من دفعات العقود')} />
                <MetricTile label={L('Expected collection', 'المتوقع تحصيله')} value={short(sum((t) => t.netUncollected))} sub={L('invoiced and not yet collected (overdue + not yet due)', 'مفوتر ولم يُحصَّل (متأخر + لم يحن)')} />
              </div>
              <div className="rv-tiles">
                <MetricTile label={L('Contracting growth', 'نمو التعاقد')} value={vPrev > 0 ? `${(((vThis - vPrev) / vPrev) * 100).toFixed(1)}%` : '—'} sub={L(`New contracts ${yr}: ${count(nThis.length)} (${short(vThis)}) · ${yr - 1}: ${count(nPrev.length)} (${short(vPrev)})`, `عقود جديدة ${yr}: ${count(nThis.length)} (${short(vThis)}) · ${yr - 1}: ${count(nPrev.length)} (${short(vPrev)})`)} />
                <MetricTile label={L('Link of Furas to assets', 'ربط الفرص بالأصول')} value="—" sub={L('Awaiting asset valuation data', 'بانتظار بيانات تقييم الأصول')} />
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{L('The asset link is a placeholder: no asset valuation exists in the demo and none is assumed. Contract figures come from the contract schedules of the demo data.', 'ربط الأصول خانة مؤقتة: لا توجد في الديمو بيانات تقييم للأصول ولا يُفترض أي تقييم. أرقام العقود من جداول عقود البيانات التجريبية.')} <Link to="/contracts">{L('Investment contracts', 'العقود الاستثمارية')}</Link></div>
            </section>
          )}

          <section className="card card-pad" aria-label={L('Invoices', 'الفواتير')}>
            <h2 className="h3" style={{ marginTop: 0 }}>{L('Largest uncollected invoices', 'أكبر الفواتير غير المحصّلة')}</h2>
            <div className="rv-table-wrap" tabIndex={0}>
              <table className="rv-table">
                <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Amanah / entity', 'الأمانة / الجهة')}</th><th>{L('Origin', 'مصدر الفاتورة')}</th><th className="num">{L('Uncollected (SAR)', 'غير المحصّل (ريال)')}</th><th>{L('Exclusion reason', 'سبب الاستبعاد')}</th></tr></thead>
                <tbody>
                  {(lst?.rows || []).map((r) => (
                    <tr key={r.id}><td><Link to={invoicePath(r.id)} dir="ltr">{r.id}</Link></td><td>{ar ? r.amanahAr : r.amanahEn}</td><td>{ar ? ORIGIN_AR[r.origin] : ORIGIN_EN[r.origin]}</td><td className="num" dir="ltr">{sar(r.outstanding + r.exclusionAmount)}</td><td>{r.exclusionReason ? (ar ? r.exclusionReason.reasonAr : r.exclusionReason.reasonEn) : '—'}</td></tr>
                  ))}
                  {!(lst?.rows || []).length && <tr><td colSpan={5}><div className="rv-empty">{L('No uncollected invoices in this selection.', 'لا فواتير غير محصّلة في هذا الاختيار.')}</div></td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
