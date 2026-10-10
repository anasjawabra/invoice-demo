import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pager from '../components/Pager';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { orderCompleteness, orderExceptions } from '../data/orderMatching';
import { reviewStatusOf, REVIEW_LABEL, orderAlerts, orderSearchBlob, normalizeSearch } from '../data/orderSummary';
import { SOURCE_STATUSES, DEBTOR_TYPES } from '../data/sanadSource';
import { RecordLink, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { orderPath } from '../utils/paths';
import { amanahName } from './Contracts';

const PAGE = 25;
const SORTS = [['recent', 'Latest referral', 'الأحدث رفعاً'], ['amount', 'Highest amount', 'الأعلى مبلغاً'], ['request', 'Request number', 'رقم الطلب']];
const REASONS = [['all', 'Any', 'أي سبب'], ['no_references', 'Numbers not identified', 'أرقام غير محددة'], ['unresolved_references', 'Open references', 'مراجع مفتوحة'], ['corrupted_reference', 'Unreliable number', 'رقم غير موثوق'], ['proposals_pending', 'Proposals to confirm', 'اقتراحات للتأكيد'], ['conflicts', 'Conflicts', 'تعارضات'], ['unread_pages', 'Unread document', 'مستند لم يُقرأ'], ['amount_difference', 'Financial gap', 'فرق مالي']];

// The ORDERS list of «إدارة التنفيذ» — the main working area: one row per Sanad ENFORCEMENT REQUEST, the original source status, linked invoices and ONE matching-review status (with small alerts).
// Three filters are visible; the rest are under «فلاتر إضافية». Everything else about an order is in its details page.
export default function OrdersView() {
  const { cases } = useRevenue();
  const { L, B, sar, ar } = useL();
  const [sp] = useSearchParams();
  const restore = useShouldRestore();
  const mem = useMemo(() => readListMemory('orders', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fromUrl = sp.get('review');
  const [page, setPage] = useState(mem.page ?? 0);
  const [q, setQ] = useState(mem.q ?? '');
  const [fAm, setFAm] = useState(mem.fAm ?? 'all');
  const [fRev, setFRev] = useState(fromUrl || mem.fRev || 'all');
  const [fSrc, setFSrc] = useState(mem.fSrc ?? 'all');
  const [fType, setFType] = useState(mem.fType ?? 'all');
  const [fDoc, setFDoc] = useState(mem.fDoc ?? 'all');
  const [fFin, setFFin] = useState(mem.fFin ?? 'all');
  const [fWhy, setFWhy] = useState(mem.fWhy ?? 'all');
  const [sort, setSort] = useState(mem.sort ?? 'recent');
  useEffect(() => { if (fromUrl) { setFRev(fromUrl); setPage(0); } }, [fromUrl]);
  useEffect(() => { writeListMemory('orders', { page, q, fAm, fRev, fSrc, fType, fDoc, fFin, fWhy, sort }); }, [page, q, fAm, fRev, fSrc, fType, fDoc, fFin, fWhy, sort]);

  const rows = useMemo(() => cases.map((c) => {
    const comp = orderCompleteness(c); const ex = orderExceptions(c);
    return { c, comp, ex, review: reviewStatusOf(comp, c, ex), alerts: orderAlerts(comp, ex), blob: orderSearchBlob(c) };
  }), [cases]);
  const amanahs = useMemo(() => [...new Set(cases.map((c) => c.amanahEn))].sort(), [cases]);
  const usedStatuses = useMemo(() => SOURCE_STATUSES.filter((x) => rows.some((r) => r.c.source?.statusId === x.id)), [rows]);
  const shown = useMemo(() => {
    const t = normalizeSearch(q);
    const out = rows.filter((r) => (fAm === 'all' || r.c.amanahEn === fAm) && (fRev === 'all' || (fRev === 'open' ? r.review !== 'complete' : r.review === fRev))
      && (fSrc === 'all' || String(r.c.source?.statusId) === fSrc) && (fType === 'all' || String(r.c.source?.debtorTypeId) === fType) && (fDoc === 'all' || r.comp.extraction.state === fDoc)
      && (fFin === 'all' || (fFin === 'difference' ? ['short', 'over'].includes(r.comp.finance.state) : r.comp.finance.state === fFin)) && (fWhy === 'all' || r.ex.includes(fWhy))
      && (!t || r.blob.includes(t)));
    const key = { recent: (r) => -(Date.parse(String(r.c.source?.raiseAt || r.c.openedDate).replace(' ', 'T')) || 0), amount: (r) => -(r.c.amount || 0), request: (r) => Number(r.c.source?.requestNo) || 0 }[sort];
    return out.sort((a, b) => key(a) - key(b));
  }, [rows, q, fAm, fRev, fSrc, fType, fDoc, fFin, fWhy, sort]);
  const view = shown.slice(page * PAGE, (page + 1) * PAGE);
  useRestoreScroll(view.length > 0);

  const extras = [fSrc, fType, fDoc, fFin, fWhy].filter((v) => v !== 'all');
  const reset = () => { setQ(''); setFAm('all'); setFRev('all'); setFSrc('all'); setFType('all'); setFDoc('all'); setFFin('all'); setFWhy('all'); setPage(0); };
  const why = REASONS.find((x) => x[0] === fWhy);
  const active = [
    q.trim() && { k: 'q', t: `${L('Search', 'بحث')}: ${q.trim()}`, off: () => setQ('') },
    fAm !== 'all' && { k: 'am', t: amanahName(fAm, ar), off: () => setFAm('all') },
    fRev !== 'all' && { k: 'rev', t: fRev === 'open' ? L('Needs attention', 'تحتاج إجراء') : B(REVIEW_LABEL[fRev] || { en: fRev, ar: fRev }), off: () => setFRev('all') },
    fSrc !== 'all' && { k: 'src', t: SOURCE_STATUSES.find((x) => String(x.id) === fSrc)?.text, off: () => setFSrc('all') },
    fType !== 'all' && { k: 'type', t: DEBTOR_TYPES.find((x) => String(x.id) === fType)?.text, off: () => setFType('all') },
    fDoc !== 'all' && { k: 'doc', t: L('Document: ', 'المستند: ') + ({ complete: L('read', 'مقروء'), incomplete: L('not read', 'لم يُقرأ'), no_document: L('none', 'لا مستند') }[fDoc] || fDoc), off: () => setFDoc('all') },
    fFin !== 'all' && { k: 'fin', t: L('Reconciliation: ', 'التسوية: ') + ({ reconciled: L('reconciled', 'متطابقة'), difference: L('gap', 'فرق'), no_confirmed: L('no linked invoice', 'لا فاتورة مربوطة') }[fFin] || fFin), off: () => setFFin('all') },
    fWhy !== 'all' && why && { k: 'why', t: L(why[1], why[2]), off: () => setFWhy('all') }
  ].filter(Boolean);
  const sel = (id, label, v, set, opts) => (<label>{label}<select id={id} className="input" value={v} onChange={(e) => { set(e.target.value); setPage(0); }}>{opts.map(([k, en, a]) => <option key={k} value={k}>{L(en, a)}</option>)}</select></label>);

  return (
    <section className="rp-section" aria-label={L('Enforcement requests', 'طلبات التنفيذ')}>
      <div className="rv-form" role="search" aria-label={L('Filters', 'المرشحات')} style={{ marginBottom: 8 }}>
        <label style={{ flex: '1 1 240px' }}>{L('Search by request number or invoice number', 'بحث برقم طلب التنفيذ أو رقم الفاتورة')}<input id="ord_q" className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="4606056" dir="auto" /></label>
        <label>{L('Amanah', 'الأمانة')}<select id="ord_am" className="input" value={fAm} onChange={(e) => { setFAm(e.target.value); setPage(0); }}><option value="all">{L('All', 'الكل')}</option>{amanahs.map((x) => <option key={x} value={x}>{amanahName(x, ar)}</option>)}</select></label>
        {sel('ord_rev', L('Matching review', 'مراجعة المطابقة'), fRev, setFRev, [['all', 'All', 'الكل'], ['open', 'Needs attention', 'تحتاج إجراء'], ['needs_review', 'Needs review', 'تحتاج مراجعة'], ['not_identified', 'Numbers not identified', 'أرقام غير محددة'], ['complete', 'Complete', 'مكتملة']])}
      </div>
      <details open={extras.length > 0} className="oj-more">
        <summary>{L('More filters', 'فلاتر إضافية')}{extras.length ? ` (${extras.length})` : ''}</summary>
        <div className="rv-form" style={{ marginTop: 6 }}>
          <label>{L('Source status', 'حالة الطلب في سند')}<select id="ord_src" className="input" value={fSrc} onChange={(e) => { setFSrc(e.target.value); setPage(0); }}><option value="all">{L('All', 'الكل')}</option>{usedStatuses.map((x) => <option key={x.id} value={String(x.id)}>{x.text}</option>)}</select></label>
          <label>{L('Debtor type', 'نوع المنفذ ضده')}<select id="ord_type" className="input" value={fType} onChange={(e) => { setFType(e.target.value); setPage(0); }}><option value="all">{L('All', 'الكل')}</option>{DEBTOR_TYPES.map((x) => <option key={x.id} value={String(x.id)}>{x.text}</option>)}</select></label>
          {sel('ord_why', L('Review reason', 'سبب المراجعة'), fWhy, setFWhy, REASONS)}
          {sel('ord_doc', L('Document', 'المستند'), fDoc, setFDoc, [['all', 'All', 'الكل'], ['complete', 'Read', 'مقروء'], ['incomplete', 'Not read', 'لم يُقرأ'], ['no_document', 'No document', 'لا مستند']])}
          {sel('ord_fin', L('Reconciliation', 'التسوية'), fFin, setFFin, [['all', 'All', 'الكل'], ['reconciled', 'Reconciled', 'متطابقة'], ['difference', 'Gap', 'فرق'], ['no_confirmed', 'No linked invoice', 'لا فاتورة مربوطة']])}
        </div>
      </details>
      <div className="oj-bar">
        <span role="status" aria-live="polite"><b>{shown.length}</b> {L('requests', 'طلب')}</span>
        {active.map((x) => <button key={x.k} type="button" className="oj-chip" onClick={() => { x.off(); setPage(0); }} aria-label={`${L('Remove filter', 'إزالة المرشح')}: ${x.t}`}>{x.t} ×</button>)}
        {active.length > 0 && <button type="button" className="rv-link" onClick={reset}>{L('Reset all filters', 'إعادة ضبط كل المرشحات')}</button>}
        <label className="oj-sort">{L('Sort', 'الترتيب')}<select id="ord_sort" className="input" value={sort} onChange={(e) => { setSort(e.target.value); setPage(0); }}>{SORTS.map(([k, en, a]) => <option key={k} value={k}>{L(en, a)}</option>)}</select></label>
      </div>
      <div className="rp-tablewrap" tabIndex={0}>
        <table aria-label={L('Enforcement requests', 'طلبات التنفيذ')}>
          <thead><tr><th>{L('Request no.', 'رقم الطلب')}</th><th>{L('Amanah · municipality', 'الأمانة · البلدية')}</th><th>{L('Source status', 'حالة الطلب في سند')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th className="num">{L('Linked invoices', 'الفواتير المربوطة')}</th><th>{L('Matching review', 'مراجعة المطابقة')}</th><th><span className="sr-only">{L('Details', 'التفاصيل')}</span></th></tr></thead>
          <tbody>
            {view.map(({ c, comp, review, alerts }) => { const sc = c.source || {}; const lab = REVIEW_LABEL[review]; return (
              <tr key={c.enforceNum}>
                <td><RecordLink to={orderPath(c.enforceNum)} dir="ltr"><b style={{ fontSize: 15 }}>{sc.requestNo || c.enforceNum}</b></RecordLink></td>
                <td>{amanahName(c.amanahEn, ar)}{sc.municipality ? <span className="muted"> · {sc.municipality}</span> : null}</td>
                <td style={{ fontSize: 13 }}>{sc.statusText || '—'}</td>
                <td className="num" dir="ltr">{sar(c.amount)}</td>
                <td className="num">{comp.references.confirmedLinks || <span className="muted">—</span>}</td>
                <td><span className={lab.tone === 'ok' ? 'rp-ok' : 'rp-warn'}>{lab.tone === 'ok' ? '✓' : '!'} {B(lab)}</span>{alerts.length > 0 && <div className="oj-alerts">{alerts.map((a) => <span key={a.key} className="oj-alert" title={B(a.why)}>⚠ {B(a)}</span>)}</div>}</td>
                <td><RecordLink className="btn btn-sm" to={orderPath(c.enforceNum)}>{L('Open', 'فتح')}</RecordLink></td>
              </tr>); })}
            {!view.length && <tr><td colSpan={7} className="muted">{L('No requests match these filters.', 'لا توجد طلبات مطابقة.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={shown.length} size={PAGE} onPage={setPage} />
    </section>
  );
}
