import React, { useMemo, useState } from 'react';
import { useAsync } from '../utils/useAsync';
import { Link, useNavigate } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL, ratioText } from '../utils/bi';
import { ScopeBar, MetricTile, ProvenanceBadge } from '../components/revenue/RevenueUI';
import { worklistRows, PRIORITY_WEIGHTS, pickBi } from '../data/revenueInsights';
import { CATEGORY_LABELS, NONCOLLECTION_CATEGORIES } from '../data/revenueMetrics';
import { REVENUE_SOURCES } from '../data/revenueLedger';

// Outstanding collection worklist. Only invoices with a balance still to collect
// appear here; collected and excluded invoices never do. Data-quality and anomaly
// follow-up lives on its own screen (Data Quality & Risk).
export default function Collection() {
  const rev = useRevenue();
  const { snapshot } = rev;
  const { L, B, ar, lang, short, count, sar } = useL();
  const nav = useNavigate();
  const [cat, setCat] = useState('all');
  const [detail, setDetail] = useState(null);
  const scopeReq = useMemo(() => ({ from: rev.scopeEff.from, to: rev.scopeEff.to, amanah: rev.scopeEff.amanah, source: rev.scopeEff.source, scopeType: rev.scopeEff.scopeType, muni: rev.scopeEff.muni, status: rev.scopeEff.status }), [rev.scopeEff]);
  // the service ranks the whole population and returns the top of the list (never the entire set)
  const { data: wl } = useAsync(() => rev.data.worklist(scopeReq, 100), [rev.data, scopeReq]);
  const { data: wlCat } = useAsync(() => (cat === 'all' ? Promise.resolve(null) : rev.data.worklist(scopeReq, 100, { category: cat })), [rev.data, scopeReq, cat]);
  const T = snapshot.totals;
  const nc = snapshot.noncollection;
  const allRows = useMemo(() => worklistRows(cat === 'all' ? wl : wlCat), [wl, wlCat, cat]);
  const rows = allRows;
  const actionableAmt = nc.overdue.amount + nc.partial.amount;
  const actionableN = nc.overdue.count + nc.partial.count;
  const maxAge = Math.max(nc.overdue.maxDaysOverdue || 0, nc.partial.maxDaysOverdue || 0);
  const totalN = wl?.total ?? 0;

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Outstanding collection worklist', 'قائمة التحصيل للمتبقي')}</h1>
          <div className="page-sub">{L('Invoices with a balance still to collect, ranked by amount, aging, actionable opportunity and evidence quality — not by the lowest collection percentage.', 'فواتير لها رصيد متبقٍ للتحصيل، مرتبة بحسب المبلغ والتقادم والفرصة القابلة للتنفيذ وجودة الدليل — وليس بأقل نسبة تحصيل.')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <ProvenanceBadge kind="demo" />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => rev.startAnalysis('noncollection', {}, { origin: 'collection' })}>{L('Analyze reasons for noncollection', 'تحليل أسباب عدم التحصيل')}</button>
          <Link className="btn btn-sm" to="/planning#outlook">{L('Forecast & target', 'التنبؤ والمستهدف')}</Link>
        </div>
      </div>

      <ScopeBar />

      <div className="rv-tiles">
        <MetricTile metric="outstanding" label={L('Uncollected (not excluded)', 'غير المحصّل (غير المستبعد)')} value={short(T.outstanding)} sub={L(`${count(totalN)} invoices`, `${count(totalN)} فاتورة`)} />
        <MetricTile label={L('Actionable now (overdue + partial)', 'قابل للإجراء الآن (متأخر + جزئي)')} value={short(actionableAmt)} sub={L(`${count(actionableN)} invoices; oldest ${maxAge} days overdue`, `${count(actionableN)} فاتورة؛ الأقدم متأخرة ${maxAge} يوماً`)} />
        <MetricTile label={L('Not yet due', 'لم يحن استحقاقها')} value={short(snapshot.noncollection.not_due.amount)} sub={L('No action yet — monitor', 'لا إجراء بعد — مراقبة')} />
        <MetricTile label={L('Blocked (objection / link / data)', 'معطّل (اعتراض / ربط / بيانات)')} value={short(snapshot.noncollection.objection.amount + snapshot.noncollection.linkage_unresolved.amount + snapshot.noncollection.ineligible_referral.amount)} sub={L('Resolve the blocker first', 'احسم المعطّل أولاً')} />
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }} role="group" aria-label={L('Filter by state', 'تصفية حسب الحالة')}>
          <button type="button" className={`btn btn-sm ${cat === 'all' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={cat === 'all'} onClick={() => setCat('all')}>{L('All', 'الكل')} · {count(totalN)}</button>
          {NONCOLLECTION_CATEGORIES.filter((c) => !['excluded'].includes(c)).map((c) => (
            <button key={c} type="button" className={`btn btn-sm ${cat === c ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{B(CATEGORY_LABELS[c])} · {count(nc[c].count)}</button>
          ))}
        </div>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table" style={{ minWidth: 820 }}>
            <thead><tr><th>#</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Amanah · source', 'الأمانة · المصدر')}</th><th>{L('State', 'الحالة')}</th><th className="num">{L('Outstanding (SAR)', 'المتبقي (ريال)')}</th><th className="num">{L('Days overdue', 'أيام التأخر')}</th><th className="num">{L('Priority', 'الأولوية')}</th><th>{L('Suggested next step', 'الخطوة المقترحة')}</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((w, i) => (
                <tr key={w.id} data-clickable="true" onClick={() => setDetail(detail === w.id ? null : w.id)}>
                  <td className="num">{i + 1}</td>
                  <td><Link to={`/invoices?id=${w.id}`} dir="ltr" onClick={(e) => e.stopPropagation()}>{w.id}</Link></td>
                  <td>{ar ? w.amanahAr : w.amanahEn} · {ar ? REVENUE_SOURCES[w.source].ar : REVENUE_SOURCES[w.source].en}</td>
                  <td><span className={`rv-cat rv-cat--${w.category}`}>{B(CATEGORY_LABELS[w.category])}</span></td>
                  <td className="num" dir="ltr">{sar(w.outstanding)}</td>
                  <td className="num">{w.daysOverdue || '—'}</td>
                  <td className="num" title={L(`amount ${PRIORITY_WEIGHTS.amount}, aging ${PRIORITY_WEIGHTS.aging}, actionability ${PRIORITY_WEIGHTS.actionability}, evidence ${PRIORITY_WEIGHTS.evidence}`, `المبلغ ${PRIORITY_WEIGHTS.amount}، التقادم ${PRIORITY_WEIGHTS.aging}، القابلية ${PRIORITY_WEIGHTS.actionability}، الدليل ${PRIORITY_WEIGHTS.evidence}`)}>{w.score.toFixed(2)}</td>
                  <td dir="auto" style={{ fontSize: 12 }}>
                    {B(w.nextStep)}
                    {detail === w.id && (
                      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                        {L(`Actionability ${w.actionability}; evidence quality ${w.evidenceQuality}. Priority = ${PRIORITY_WEIGHTS.amount}×amount + ${PRIORITY_WEIGHTS.aging}×aging + ${PRIORITY_WEIGHTS.actionability}×actionability + ${PRIORITY_WEIGHTS.evidence}×evidence (configurable weights, not truth). No probability of payment is shown: none is supported by the data.`, `القابلية ${w.actionability}؛ جودة الدليل ${w.evidenceQuality}. الأولوية = ${PRIORITY_WEIGHTS.amount}×المبلغ + ${PRIORITY_WEIGHTS.aging}×التقادم + ${PRIORITY_WEIGHTS.actionability}×القابلية + ${PRIORITY_WEIGHTS.evidence}×الدليل (أوزان قابلة للضبط وليست حقيقة). لا يُعرض احتمال سداد لعدم وجود ما يدعمه في البيانات.`)}
                        {w.tags.length > 0 && <div>{w.tags.join(' · ')}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              )) : <tr><td colSpan={8}><div className="rv-empty">{L('No outstanding invoices in this scope.', 'لا توجد فواتير متبقية في هذا النطاق.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{L('Collected and excluded invoices never appear here. Invoices with data problems (amount conflicts, missing fields, risk flags) are reviewed in ', 'لا تظهر هنا الفواتير المحصّلة أو المستبعدة. أما الفواتير ذات مشكلات البيانات (تعارض مبلغ، حقول ناقصة، تنبيهات مخاطر) فتُراجع في ')}<Link to="/risk">{L('Data Quality & Risk', 'جودة البيانات والمخاطر')}</Link>.</p>
      </div>
    </div>
  );
}
