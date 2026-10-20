import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../utils/useAsync';
import { RecordLink as Link, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { invoicePath } from '../utils/paths';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ScopeBar, MetricTile } from '../components/revenue/RevenueUI';
import { kpiOf } from '../data/kpis';
import { EXCLUSION_REASONS, EXCLUSION_SOURCE_OF_RULE, ORIGIN_AR, ORIGIN_EN, PRODUCTS } from '../data/iim';

// إدارة الاستبعادات (IIM-23) — one place for every exclusion: the reasons, how much each removes from the collectible base, where it comes from, and the invoices behind it.
// The numbers come from the same KPI module as every other screen: the reasons add up exactly to إجمالي المستبعد (the uncollected part of the excluded invoices).
export default function Exclusions() {
  const rev = useRevenue(); const { snapshot } = rev;
  const { L, ar, short, count, sar } = useL();
  const [sp] = useSearchParams();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory('exclusions', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [reason, setReason] = useState(sp.get('reason') || mem.reason || 'all');
  React.useEffect(() => { writeListMemory('exclusions', { reason }); }, [reason]);
  const T = snapshot.totals; const K = kpiOf(T); const stats = snapshot.ruleStats || {};
  const e = rev.scopeEff;
  const scopeReq = useMemo(() => ({ from: e.from, to: e.to, amanah: e.amanah, source: e.source, scopeType: e.scopeType, muni: e.muni, status: e.status, product: e.product, mainClass: e.mainClass }), [e]);
  const rows = useMemo(() => EXCLUSION_REASONS.map((r) => ({ ...r, count: stats[r.ruleId]?.primaryCount || 0, amount: stats[r.ruleId]?.primaryAmount || 0, source: EXCLUSION_SOURCE_OF_RULE[r.ruleId] })).sort((a, b) => b.amount - a.amount), [stats]);
  const sum = rows.reduce((t, r) => t + r.amount, 0); const sumN = rows.reduce((t, r) => t + r.count, 0);
  const share = K.uncollectedTotal > 0 ? K.excluded / K.uncollectedTotal : null;
  // the invoices behind the selected reason (the service ranks the whole population and returns the top of the list)
  const { data: wl } = useAsync(() => rev.data.worklist(scopeReq, 100, { includeExcluded: true, reason: reason === 'all' ? 'any' : reason, category: 'excluded' }), [rev.data, scopeReq, reason]);
  const list = wl?.rows || [];
  useRestoreScroll(list.length > 0);
  const label = (id) => { const r = EXCLUSION_REASONS.find((x) => x.ruleId === id); return r ? (ar ? r.ar : r.en) : ''; };

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Exclusions management', 'إدارة الاستبعادات')}</h1>
          <div className="page-sub">{L('Every excluded invoice, the reason, where it comes from and how much it removes from the collectible base. Exclusions come only from uncollected invoices.', 'كل فاتورة مستبعدة وسببها ومصدر الاستبعاد وأثره على القابل للتحصيل. والاستبعاد يكون من الفواتير غير المحصّلة فقط.')}</div>
        </div>
        <Link className="btn btn-sm" to="/collection">{L('Uncollected invoices list', 'قائمة الفواتير غير المحصّلة')}</Link>
      </div>

      <ScopeBar hideStatus />

      <div className="rv-tiles">
        <MetricTile label={L('Total excluded', 'إجمالي المستبعد')} value={short(K.excluded)} sub={L('The uncollected part of the excluded invoices', 'الجزء غير المحصّل من الفواتير المستبعدة')} />
        <MetricTile label={L('Excluded invoices', 'عدد الفواتير المستبعدة')} value={count(K.excludedCount)} sub={L(`of ${count(T.count)} invoices in the scope`, `من ${count(T.count)} فاتورة في النطاق`)} />
        <MetricTile label={L('Share of total uncollected', 'نسبته من إجمالي غير المحصل')} value={share == null ? '—' : `${(share * 100).toFixed(1)}%`} sub={L(`${short(K.excluded)} of ${short(K.uncollectedTotal)}`, `${short(K.excluded)} من ${short(K.uncollectedTotal)}`)} />
      </div>

      <div className="card card-pad" role="region" aria-label={L('Exclusions by reason', 'الاستبعادات حسب السبب')}>
        <h2 className="h3" style={{ marginTop: 0 }}>{L('Exclusions by reason', 'الاستبعادات حسب السبب')}</h2>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr><th>{L('Reason', 'السبب')}</th><th>{L('Source of the exclusion', 'مصدر الاستبعاد')}</th><th className="num">{L('Invoices', 'عدد الفواتير')}</th><th className="num">{L('Amount (SAR)', 'المبلغ (ريال)')}</th><th className="num">{L('Share', 'النسبة')}</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ruleId} className={reason === r.ruleId ? 'is-on' : undefined}>
                  <td>{ar ? r.ar : r.en}</td>
                  <td className="muted">{r.source ? (ar ? r.source.ar : r.source.en) : '—'}</td>
                  <td className="num">{count(r.count)}</td>
                  <td className="num" dir="ltr">{sar(r.amount)}</td>
                  <td className="num">{K.excluded > 0 ? `${(Math.round((r.amount / K.excluded) * 1000) / 10).toFixed(1)}%` : '—'}</td>
                  <td><button type="button" className="btn btn-sm btn-ghost" disabled={r.count === 0} aria-pressed={reason === r.ruleId} onClick={() => setReason(reason === r.ruleId ? 'all' : r.ruleId)}>{reason === r.ruleId ? L('Show all', 'عرض الكل') : L('Show the invoices', 'عرض الفواتير')}</button></td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}><td>{L('Total', 'الإجمالي')}</td><td /><td className="num">{count(sumN)}</td><td className="num" dir="ltr">{sar(sum)}</td><td className="num">{K.excluded > 0 ? '100.0%' : '—'}</td><td /></tr>
            </tbody>
          </table>
        </div>
        {Math.abs(sum - K.excluded) > 1 && <p className="muted" style={{ fontSize: 12 }}>{L('The reasons do not add up to the total: check the reconciliation.', 'مجموع الأسباب لا يطابق الإجمالي: راجع المطابقة.')}</p>}
      </div>

      <div className="card card-pad" id="excluded-invoices">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <label htmlFor="ex-reason" className="rv-scope__lbl">{L('Reason', 'السبب')}</label>
          <select id="ex-reason" className="select" value={reason} onChange={(ev) => setReason(ev.target.value)}>
            <option value="all">{L('All reasons', 'كل الأسباب')}</option>
            {EXCLUSION_REASONS.map((r) => <option key={r.ruleId} value={r.ruleId}>{ar ? r.ar : r.en}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 12 }}>{L(`${count(wl?.total ?? 0)} excluded invoices`, `${count(wl?.total ?? 0)} فاتورة مستبعدة`)}{reason !== 'all' ? ` — ${label(reason)}` : ''}</span>
        </div>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr><th>#</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Amanah / entity · product', 'الأمانة / الجهة · المنتج')}</th><th>{L('Origin', 'مصدر الفاتورة')}</th><th className="num">{L('Excluded (SAR)', 'المستبعد (ريال)')}</th><th>{L('Exclusion reason', 'سبب الاستبعاد')}</th><th>{L('Source of the exclusion', 'مصدر الاستبعاد')}</th></tr></thead>
            <tbody>
              {list.length ? list.map((w, i) => (
                <tr key={w.id}>
                  <td className="num">{i + 1}</td>
                  <td><Link to={invoicePath(w.id)} dir="ltr">{w.id}</Link></td>
                  <td>{ar ? w.amanahAr : w.amanahEn} · {ar ? PRODUCTS[w.productKey].ar : PRODUCTS[w.productKey].en}</td>
                  <td>{ar ? ORIGIN_AR[w.origin] : ORIGIN_EN[w.origin]}</td>
                  <td className="num" dir="ltr">{sar(w.exclusionAmount)}</td>
                  <td>{w.exclusionReason ? (ar ? w.exclusionReason.reasonAr : w.exclusionReason.reasonEn) : '—'}</td>
                  <td className="muted">{w.exclusionReason ? (ar ? w.exclusionReason.sourceAr : w.exclusionReason.sourceEn) : '—'}</td>
                </tr>
              )) : <tr><td colSpan={7}><div className="rv-empty">{L('No excluded invoices in this view.', 'لا توجد فواتير مستبعدة في هذا العرض.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
