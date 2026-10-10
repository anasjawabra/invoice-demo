import React, { useEffect, useMemo, useState } from 'react';
import Pager from '../components/Pager';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { OrderStatusChip } from '../components/revenue/EnforcementUI';
import { orderCompleteness, orderStatusOf, orderExceptions } from '../data/orderMatching';
import { listReviewStatus } from '../data/orderSummary';
import { SOURCE_STATUSES, DEBTOR_TYPES, isCorruptedNumber } from '../data/sanadSource';
import { RecordLink, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { orderPath } from '../utils/paths';

const PAGE = 25;
const tone = (t) => (t === 'ok' ? 'rp-ok' : 'rp-warn');

// The ORDERS view of «إدارة التنفيذ»: one row per Sanad ENFORCEMENT REQUEST, with the essential source fields and the matching-review status. Every other source field, the documents
// and the manual upload are in the order's detail page. (The three completeness states stay separate in the data and in the detail page.)
export default function OrdersView() {
  const { cases } = useRevenue();
  const { L, B, sar, count: fmt } = useL();
  const restore = useShouldRestore();
  const mem = useMemo(() => readListMemory('orders', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(mem.page ?? 0);
  const [fStatus, setFStatus] = useState(mem.fStatus ?? 'all');
  const [fSrc, setFSrc] = useState(mem.fSrc ?? 'all');
  const [fType, setFType] = useState(mem.fType ?? 'all');
  const [fRefs, setFRefs] = useState(mem.fRefs ?? 'all');
  const [fDoc, setFDoc] = useState(mem.fDoc ?? 'all');
  const [fFin, setFFin] = useState(mem.fFin ?? 'all');
  const [q, setQ] = useState(mem.q ?? '');
  useEffect(() => { writeListMemory('orders', { page, fStatus, fSrc, fType, fRefs, fDoc, fFin, q }); }, [page, fStatus, fSrc, fType, fRefs, fDoc, fFin, q]);

  const rows = useMemo(() => cases.map((c) => ({ c, comp: orderCompleteness(c), status: orderStatusOf(c), ex: orderExceptions(c) })), [cases]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (fStatus === 'all' || r.status === fStatus) && (fSrc === 'all' || String(r.c.source?.statusId) === fSrc) && (fType === 'all' || String(r.c.source?.debtorTypeId) === fType)
      && (fRefs === 'all' || (fRefs === 'review' ? r.ex.length > 0 : r.comp.references.state === fRefs)) && (fDoc === 'all' || r.comp.extraction.state === fDoc)
      && (fFin === 'all' || (fFin === 'difference' ? ['short', 'over'].includes(r.comp.finance.state) : r.comp.finance.state === fFin))
      && (!t || [r.c.enforceNum, r.c.source?.requestNo, r.c.source?.claimNo, r.c.source?.enforcementNo, r.c.debtorId].some((x) => String(x || '').toLowerCase().includes(t)) || `${r.c.debtorName?.ar || ''} ${r.c.debtorName?.en || r.c.debtorName || ''}`.toLowerCase().includes(t)));
  }, [rows, fStatus, fSrc, fType, fRefs, fDoc, fFin, q]);
  const view = shown.slice(page * PAGE, (page + 1) * PAGE);
  useRestoreScroll(view.length > 0);
  const usedStatuses = useMemo(() => SOURCE_STATUSES.filter((x) => rows.some((r) => r.c.source?.statusId === x.id)), [rows]);
  const sel = (id, label, v, set, opts) => (
    <label>{label}<select id={id} className="input" value={v} onChange={(e) => { set(e.target.value); setPage(0); }}>{opts.map(([k, en, ar]) => <option key={k} value={k}>{L(en, ar)}</option>)}</select></label>
  );

  return (
    <>
      <section className="rp-section" aria-label={L('Orders', 'الأوامر')}>
        <div className="rv-form" role="search" aria-label={L('Order filters', 'مرشحات الأوامر')} style={{ marginBottom: 10 }}>
          <label style={{ flex: '1 1 220px' }}>{L('Search request / claim / enforcement no. or debtor', 'بحث برقم الطلب / المطالبة / الإنفاذ أو المدين')}<input id="ord_q" className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="4636126" dir="auto" /></label>
          {sel('ord_status', L('Status class (provisional)', 'تصنيف الحالة (مؤقت)'), fStatus, setFStatus, [['all', 'All', 'الكل'], ['open', 'Open', 'مفتوح'], ['suspended', 'Suspended', 'موقوف'], ['closed', 'Closed', 'مغلق']])}
          <label>{L('Source status', 'حالة الرفع للتنفيذ')}<select id="ord_src" className="input" value={fSrc} onChange={(e) => { setFSrc(e.target.value); setPage(0); }}><option value="all">{L('All', 'الكل')}</option>{usedStatuses.map((x) => <option key={x.id} value={String(x.id)}>{x.text}</option>)}</select></label>
          <label>{L('Debtor type', 'نوع المنفذ ضده')}<select id="ord_type" className="input" value={fType} onChange={(e) => { setFType(e.target.value); setPage(0); }}><option value="all">{L('All', 'الكل')}</option>{DEBTOR_TYPES.map((x) => <option key={x.id} value={String(x.id)}>{x.text}</option>)}</select></label>
          {sel('ord_refs', L('Matching review', 'مراجعة المطابقة'), fRefs, setFRefs, [['all', 'All', 'الكل'], ['review', 'Needs review', 'تحتاج مراجعة'], ['complete', 'References complete', 'المراجع مكتملة'], ['incomplete', 'References incomplete', 'المراجع غير مكتملة'], ['none', 'Not identified — needs review', 'لم يتم تحديد أرقام الفواتير — تحتاج مراجعة']])}
          {sel('ord_doc', L('Document extraction', 'استخراج المستند'), fDoc, setFDoc, [['all', 'All', 'الكل'], ['complete', 'Complete', 'مكتمل'], ['incomplete', 'Incomplete (unread pages)', 'ناقص (صفحات لم تُقرأ)'], ['no_document', 'No document', 'لا مستند']])}
          {sel('ord_fin', L('Reconciliation', 'التسوية المالية'), fFin, setFFin, [['all', 'All', 'الكل'], ['reconciled', 'Reconciled', 'متطابقة'], ['difference', 'Difference', 'فرق'], ['no_confirmed', 'No confirmed invoice', 'لا فاتورة مؤكدة'], ['no_links', 'No links', 'لا روابط']])}
        </div>
        <div className="rp-tablewrap" tabIndex={0}>
          <table aria-label={L('Enforcement requests', 'طلبات التنفيذ')}>
            <thead><tr><th>{L('Enforcement request no.', 'رقم طلب التنفيذ')}</th><th>{L('Amanah · municipality', 'الأمانة · البلدية')}</th><th>{L('Debtor type', 'نوع المنفذ ضده')}</th><th>{L('Referral status (source)', 'حالة الرفع للتنفيذ (المصدر)')}</th><th>{L('Referred on', 'تاريخ الرفع')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Invoice no. (field)', 'رقم الفاتورة (الحقل)')}</th><th>{L('Matching review', 'مراجعة المطابقة')}</th></tr></thead>
            <tbody>
              {view.map(({ c, comp, status }) => { const sc = c.source || {}; const rv = listReviewStatus(comp, c); return (
                <tr key={c.enforceNum}>
                  <td><RecordLink to={orderPath(c.enforceNum)} dir="ltr"><b>{sc.requestNo || c.enforceNum}</b></RecordLink><div className="muted" style={{ fontSize: 11 }} dir="ltr">{c.enforceNum}{c.contractNo ? ` · ${c.contractNo}` : ''}</div></td>
                  <td>{c.amanahEn}<div className="muted" style={{ fontSize: 12 }}>{sc.municipality || L('— (municipality empty in the source)', '— (البلدية فارغة في المصدر)')}</div></td>
                  <td style={{ fontSize: 13 }}>{sc.debtorType || '—'}</td>
                  <td style={{ fontSize: 13 }}>{sc.statusText || '—'}<div><OrderStatusChip status={status} /></div></td>
                  <td dir="ltr" style={{ fontSize: 12 }}>{sc.raiseAt || c.openedDate}</td>
                  <td className="num" dir="ltr">{sar(c.amount)}</td>
                  <td dir="ltr" style={{ fontSize: 12 }}>{sc.invoiceNo ? (isCorruptedNumber(sc.invoiceNo) ? <span className="rv-tag rv-tag--bad" title={L('A spreadsheet turned this number into scientific notation: the digits are lost', 'حوّل جدول بيانات هذا الرقم إلى صيغة علمية: الأرقام الأصلية مفقودة')}>{sc.invoiceNo}</span> : sc.invoiceNo) : <span className="muted">—</span>}</td>
                  <td style={{ fontSize: 13 }}><div className={tone(rv.main.tone)}>{rv.main.tone === 'ok' ? '✓' : '!'} {B(rv.main)}</div>{rv.extras.map((x, i) => <div key={i} className={tone(x.tone)} style={{ fontSize: 12 }}>! {B(x)}</div>)}</td>
                </tr>); })}
              {!view.length && <tr><td colSpan={8} className="muted">{L('No orders match this filter.', 'لا توجد أوامر مطابقة لهذا المرشح.')}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="rp-limit">{L('One row per Sanad enforcement request. The source status is shown as written; its open / suspended / closed class is PROVISIONAL (see the order page). The extract carries no debtor name — only the debtor type.', 'صف واحد لكل طلب تنفيذ في سند. تُعرض حالة المصدر كما كُتبت؛ وتصنيفها مفتوح / موقوف / مغلق مؤقت (انظر صفحة الأمر). ولا يحمل الملف اسم المنفذ ضده — بل نوعه فقط.')}</div>
        <Pager page={page} total={shown.length} size={PAGE} onPage={setPage} />
      </section>
    </>
  );
}
