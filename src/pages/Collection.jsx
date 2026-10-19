import React, { useMemo, useState } from 'react';
import { useAsync } from '../utils/useAsync';
import { RecordLink as Link, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { invoicePath } from '../utils/paths';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ScopeBar, MetricTile } from '../components/revenue/RevenueUI';
import { worklistRows, PRIORITY_WEIGHTS } from '../data/revenueInsights';
import { CATEGORY_LABELS, NONCOLLECTION_CATEGORIES } from '../data/revenueMetrics';
import { REVENUE_SOURCES } from '../data/revenueLedger';
import { kpiOf } from '../data/kpis';
import { EXCLUSION_REASONS, ORIGIN_AR, ORIGIN_EN, PRODUCTS, DISCLOSURE_PRODUCTS } from '../data/iim';

// Uncollected invoices list (IIM-06 / IIM-07). The header has three cards and ONE relation between them:
//   إجمالي غير المحصل (excluded invoices INCLUDED)  −  إجمالي المستبعد  =  غير المحصل القابل للتحصيل.
// The list shows every uncollected invoice — the excluded ones too — with the reason it was excluded; clicking إجمالي المستبعد opens the
// breakdown by reason, and each reason row filters the list. Partly collected invoices stay in the list (their status is on the invoice).
const STATE_CHIPS = NONCOLLECTION_CATEGORIES.filter((c) => !['excluded', 'cancelled', 'partial'].includes(c));

export default function Collection() {
  const rev = useRevenue();
  const { snapshot } = rev;
  const { L, B, ar, short, count, sar } = useL();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory('collection', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [cat, setCat] = useState(mem.cat ?? 'all');
  const [reason, setReason] = useState(mem.reason ?? 'all'); // all · none (not excluded) · a rule id
  const [kind, setKind] = useState(mem.kind ?? 'all'); // نوع الفاتورة (tobacco / accommodation)
  const [showBreak, setShowBreak] = useState(mem.showBreak ?? false);
  const [detail, setDetail] = useState(mem.detail ?? null);
  React.useEffect(() => { writeListMemory('collection', { cat, reason, kind, showBreak, detail }); }, [cat, reason, kind, showBreak, detail]);
  const scopeReq = useMemo(() => ({ from: rev.scopeEff.from, to: rev.scopeEff.to, amanah: rev.scopeEff.amanah, source: rev.scopeEff.source, scopeType: rev.scopeEff.scopeType, muni: rev.scopeEff.muni, status: rev.scopeEff.status, product: rev.scopeEff.product, mainClass: rev.scopeEff.mainClass }), [rev.scopeEff]);
  // the service ranks the whole population and returns the top of the list (never the entire set)
  const { data: wl } = useAsync(() => rev.data.worklist(scopeReq, 100, { includeExcluded: true, reason, kind, ...(cat === 'all' ? {} : { category: cat }) }), [rev.data, scopeReq, cat, reason, kind]);
  const T = snapshot.totals; const nc = snapshot.noncollection; const K = kpiOf(T);
  const rows = useMemo(() => worklistRows(wl), [wl]);
  const uncollectedCount = ['excluded', 'objection', 'linkage_unresolved', 'ineligible_referral', 'partial', 'overdue', 'not_due'].reduce((t, c) => t + (nc[c]?.count || 0), 0);
  const stats = snapshot.ruleStats || {};
  const breakdown = useMemo(() => EXCLUSION_REASONS.map((r) => ({ ...r, count: stats[r.ruleId]?.primaryCount || 0, amount: stats[r.ruleId]?.primaryAmount || 0 })).filter((r) => r.count > 0).sort((a, b) => b.amount - a.amount), [stats]);
  const breakSum = breakdown.reduce((t, r) => t + r.amount, 0);
  const totalN = wl?.total ?? 0;
  useRestoreScroll(rows.length > 0);
  const openReason = (id) => { setReason(id); setCat('all'); const el = document.getElementById('uncollected-list'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const reasonLabel = (id) => { const r = EXCLUSION_REASONS.find((x) => x.ruleId === id); return r ? (ar ? r.ar : r.en) : id; };

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Uncollected invoices list', 'قائمة الفواتير غير المحصّلة')}</h1>
          <div className="page-sub">{L('Every uncollected invoice — including the excluded ones, with the reason — ranked by amount, aging, actionable opportunity and evidence quality.', 'كل الفواتير غير المحصّلة — ومنها المستبعدة مع سبب الاستبعاد — مرتبة بالمبلغ والتقادم وفرصة الإجراء وجودة الدليل.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => rev.startAnalysis('noncollection', {}, { origin: 'collection' })}>{L('Analyze reasons for noncollection', 'تحليل أسباب عدم التحصيل')}</button>
          <Link className="btn btn-sm" to="/planning">{L('Collection goal', 'هدف التحصيل السنوي')}</Link>
        </div>
      </div>

      <ScopeBar />

      <div className="rv-tiles">
        <MetricTile metric="outstanding" label={L('Total uncollected (excluded included)', 'إجمالي غير المحصل (يشمل المستبعد)')} value={short(K.uncollectedTotal)} sub={L(`${count(uncollectedCount)} invoices`, `${count(uncollectedCount)} فاتورة`)} />
        <MetricTile id="excluded-card" label={L('Total excluded', 'إجمالي المستبعد')} value={short(K.excluded)} sub={L(`${count(K.excludedCount)} invoices — by reason`, `${count(K.excludedCount)} فاتورة — حسب السبب`)} onAction={() => setShowBreak((v) => !v)} actionLabel={showBreak ? L('Hide the breakdown', 'إخفاء التفصيل') : L('Breakdown by reason', 'التفصيل حسب السبب')} />
        <MetricTile label={L('Collectible uncollected', 'غير المحصل القابل للتحصيل')} value={short(K.collectible)} sub={L('Total uncollected − total excluded', 'إجمالي غير المحصل − إجمالي المستبعد')} />
      </div>

      {showBreak && (
        <div className="card card-pad" role="region" aria-label={L('Exclusions by reason', 'الاستبعادات حسب السبب')}>
          <h2 className="h3" style={{ marginTop: 0 }}>{L('Excluded invoices by reason', 'الفواتير المستبعدة حسب السبب')}</h2>
          <div className="rv-table-wrap" tabIndex={0}>
            <table className="rv-table">
              <thead><tr><th>{L('Reason', 'السبب')}</th><th className="num">{L('Invoices', 'عدد الفواتير')}</th><th className="num">{L('Amount (SAR)', 'المبلغ (ريال)')}</th><th className="num">{L('Share', 'النسبة')}</th><th /></tr></thead>
              <tbody>
                {breakdown.map((r) => (
                  <tr key={r.ruleId}>
                    <td>{ar ? r.ar : r.en}</td>
                    <td className="num">{count(r.count)}</td>
                    <td className="num" dir="ltr">{sar(r.amount)}</td>
                    <td className="num">{K.excluded > 0 ? `${(Math.round((r.amount / K.excluded) * 1000) / 10).toFixed(1)}%` : '—'}</td>
                    <td><button type="button" className="btn btn-sm btn-ghost" onClick={() => openReason(r.ruleId)}>{L('Show the invoices', 'عرض الفواتير')}</button></td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>{L('Total', 'الإجمالي')}</td><td className="num">{count(breakdown.reduce((t, r) => t + r.count, 0))}</td><td className="num" dir="ltr">{sar(breakSum)}</td><td className="num">{K.excluded > 0 ? '100.0%' : '—'}</td><td />
                </tr>
              </tbody>
            </table>
          </div>
          {Math.abs(breakSum - K.excluded) > 1 && <p className="muted" style={{ fontSize: 12 }}>{L('The reasons do not add up to the card: check the reconciliation.', 'مجموع الأسباب لا يطابق البطاقة: راجع المطابقة.')}</p>}
        </div>
      )}

      <div className="card card-pad" id="uncollected-list">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }} role="group" aria-label={L('Filter by state', 'تصفية حسب الحالة')}>
          <button type="button" className={`btn btn-sm ${cat === 'all' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={cat === 'all'} onClick={() => setCat('all')}>{L('All', 'الكل')}</button>
          {STATE_CHIPS.map((c) => (
            <button key={c} type="button" className={`btn btn-sm ${cat === c ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{B(CATEGORY_LABELS[c])} · {count(nc[c].count)}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <label htmlFor="rv-reason" className="rv-scope__lbl">{L('Exclusion reason', 'سبب الاستبعاد')}</label>
          <select id="rv-reason" className="select" value={reason} onChange={(e) => { setReason(e.target.value); setCat('all'); }}>
            <option value="all">{L('All (excluded and not)', 'الكل (مستبعدة وغير مستبعدة)')}</option>
            <option value="none">{L('Not excluded', 'غير مستبعدة')}</option>
            {EXCLUSION_REASONS.map((r) => <option key={r.ruleId} value={r.ruleId}>{ar ? r.ar : r.en}{stats[r.ruleId]?.primaryCount ? ` · ${count(stats[r.ruleId].primaryCount)}` : ''}</option>)}
          </select>
          {(rev.scopeEff.product || []).some((k) => DISCLOSURE_PRODUCTS.includes(k)) && (
            <select id="rv-kind" className="select" aria-label={L('Invoice type', 'نوع الفاتورة')} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="all">{L('All invoice types', 'كل أنواع الفاتورة')}</option>
              <option value="occupancy">{L('Occupancy (declared by the taxpayer)', 'إشغالات (إفصاح من المكلف)')}</option>
              <option value="differences">{L('Differences (from the audit)', 'فروقات (ناتجة عن التدقيق)')}</option>
            </select>
          )}
          <span className="muted" style={{ fontSize: 12 }}>{L(`${count(totalN)} invoices in this view`, `${count(totalN)} فاتورة في هذا العرض`)}{reason !== 'all' && reason !== 'none' ? ` — ${reasonLabel(reason)}` : ''}</span>
        </div>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr><th>#</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Amanah · product', 'الأمانة · المنتج')}</th><th>{L('Origin', 'مصدر الفاتورة')}</th><th>{L('State', 'الحالة')}</th><th className="num">{L('Uncollected (SAR)', 'غير المحصّل (ريال)')}</th><th>{L('Exclusion reason', 'سبب الاستبعاد')}</th><th className="num">{L('Days overdue', 'أيام التأخر')}</th><th className="num">{L('Priority', 'الأولوية')}</th><th>{L('Next step', 'الخطوة التالية')}</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((w, i) => (
                <tr key={w.id} data-clickable="true" onClick={() => setDetail(detail === w.id ? null : w.id)}>
                  <td className="num">{i + 1}</td>
                  <td><Link to={invoicePath(w.id)} dir="ltr" onClick={(e) => e.stopPropagation()}>{w.id}</Link></td>
                  <td>{ar ? w.amanahAr : w.amanahEn} · {ar ? PRODUCTS[w.productKey].ar : PRODUCTS[w.productKey].en}{w.invoiceKindAr ? ` — ${w.invoiceKindAr}` : ''} <span className="muted" style={{ fontSize: 11 }}>({ar ? REVENUE_SOURCES[w.source].ar : REVENUE_SOURCES[w.source].en})</span></td>
                  <td>{ar ? ORIGIN_AR[w.origin] : ORIGIN_EN[w.origin]}</td>
                  <td><span className={`rv-cat rv-cat--${w.category}`}>{B(CATEGORY_LABELS[w.category])}</span></td>
                  <td className="num" dir="ltr">{sar(w.uncollected ?? w.outstanding)}</td>
                  <td>{w.exclusionReason ? (ar ? w.exclusionReason.reasonAr : w.exclusionReason.reasonEn) : '—'}{w.exclusionReason && detail === w.id && <div className="muted" style={{ fontSize: 11 }}>{L('Source', 'المصدر')}: {ar ? w.exclusionReason.sourceAr : w.exclusionReason.sourceEn}</div>}</td>
                  <td className="num">{w.daysOverdue || '—'}</td>
                  <td className="num" title={L(`amount ${PRIORITY_WEIGHTS.amount}, aging ${PRIORITY_WEIGHTS.aging}, actionability ${PRIORITY_WEIGHTS.actionability}, evidence ${PRIORITY_WEIGHTS.evidence}`, `المبلغ ${PRIORITY_WEIGHTS.amount}، التقادم ${PRIORITY_WEIGHTS.aging}، قابلية الإجراء ${PRIORITY_WEIGHTS.actionability}، الدليل ${PRIORITY_WEIGHTS.evidence}`)}>{w.score}</td>
                  <td dir="auto" style={{ fontSize: 12 }}>
                    {B(w.nextStep)}
                    {detail === w.id && (
                      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                        {L(`Actionability ${w.actionability}; evidence quality ${w.evidenceQuality}.`, `قابلية الإجراء ${w.actionability}؛ جودة الدليل ${w.evidenceQuality}.`)}
                        {w.tags.length > 0 && <div>{w.tags.join(' · ')}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              )) : <tr><td colSpan={10}><div className="rv-empty">{L('No uncollected invoices in this view.', 'لا توجد فواتير غير محصّلة في هذا العرض.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{L('Collected invoices never appear here. Excluded invoices appear with their reason; the exclusion applies to the uncollected part only. Invoices with risk flags or amount conflicts are reviewed in ', 'لا تظهر هنا الفواتير المحصّلة. وتظهر المستبعدة مع سببها؛ والاستبعاد يخص الجزء غير المحصّل فقط. أما الفواتير ذات أعلام المخاطر أو تعارض المبالغ فتُراجَع في ')}<Link to="/risk">{L('Risks & Deviations', 'المخاطر والانحرافات')}</Link>.</p>
      </div>
    </div>
  );
}
