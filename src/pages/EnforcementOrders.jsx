import React, { useEffect, useMemo, useState } from 'react';
import Pager from '../components/Pager';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { OrderStatusChip } from '../components/revenue/EnforcementUI';
import { orderCompleteness, orderStatusOf } from '../data/orderMatching';
import { CLOSE_REASON_LABEL } from '../data/relations';
import { RecordLink, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { orderPath } from '../utils/paths';

const PAGE = 25;
const mark = (ok, text) => <span className={ok ? 'rp-ok' : 'rp-warn'}>{ok ? '✓' : '!'} {text}</span>;

// The ORDERS view of «إدارة التنفيذ»: every order of Sanad, over ALL invoice types. Each order is judged on THREE separate completeness states, never one label.
export default function OrdersView() {
  const { cases } = useRevenue();
  const { L, B, sar, count: fmt } = useL();
  const restore = useShouldRestore();
  const mem = useMemo(() => readListMemory('orders', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(mem.page ?? 0);
  const [fStatus, setFStatus] = useState(mem.fStatus ?? 'all');
  const [fRefs, setFRefs] = useState(mem.fRefs ?? 'all');
  const [fDoc, setFDoc] = useState(mem.fDoc ?? 'all');
  const [fFin, setFFin] = useState(mem.fFin ?? 'all');
  const [q, setQ] = useState(mem.q ?? '');
  useEffect(() => { writeListMemory('orders', { page, fStatus, fRefs, fDoc, fFin, q }); }, [page, fStatus, fRefs, fDoc, fFin, q]);

  const rows = useMemo(() => cases.map((c) => ({ c, comp: orderCompleteness(c), status: orderStatusOf(c) })), [cases]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (fStatus === 'all' || r.status === fStatus)
      && (fRefs === 'all' || r.comp.references.state === fRefs) && (fDoc === 'all' || r.comp.extraction.state === fDoc)
      && (fFin === 'all' || (fFin === 'difference' ? ['short', 'over'].includes(r.comp.finance.state) : r.comp.finance.state === fFin))
      && (!t || r.c.enforceNum.toLowerCase().includes(t) || `${r.c.debtorName?.ar || ''} ${r.c.debtorName?.en || r.c.debtorName || ''}`.toLowerCase().includes(t) || (r.c.debtorId || '').includes(t)));
  }, [rows, fStatus, fRefs, fDoc, fFin, q]);
  const view = shown.slice(page * PAGE, (page + 1) * PAGE);
  useRestoreScroll(view.length > 0);
  const sel = (id, label, v, set, opts) => (
    <label>{label}<select id={id} className="input" value={v} onChange={(e) => { set(e.target.value); setPage(0); }}>{opts.map(([k, en, ar]) => <option key={k} value={k}>{L(en, ar)}</option>)}</select></label>
  );

  return (
    <>
      <section className="rp-section" aria-label={L('Orders', 'الأوامر')}>
        <div className="rv-form" role="search" aria-label={L('Order filters', 'مرشحات الأوامر')} style={{ marginBottom: 10 }}>
          <label style={{ flex: '1 1 220px' }}>{L('Search order number or debtor', 'بحث برقم الأمر أو المدين')}<input id="ord_q" className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="EN-5013" dir="auto" /></label>
          {sel('ord_status', L('Order status', 'حالة الأمر'), fStatus, setFStatus, [['all', 'All', 'الكل'], ['open', 'In execution', 'قيد التنفيذ'], ['suspended', 'Suspended', 'موقوف'], ['closed', 'Closed', 'مغلق']])}
          {sel('ord_refs', L('Reference matching', 'مطابقة المراجع'), fRefs, setFRefs, [['all', 'All', 'الكل'], ['complete', 'Complete', 'مكتملة'], ['incomplete', 'Incomplete', 'غير مكتملة'], ['none', 'Not identified — review required', 'لم يتم تحديد أرقام الفواتير — تحتاج مراجعة']])}
          {sel('ord_doc', L('Document extraction', 'استخراج المستند'), fDoc, setFDoc, [['all', 'All', 'الكل'], ['complete', 'Complete', 'مكتمل'], ['incomplete', 'Incomplete (unread pages)', 'ناقص (صفحات لم تُقرأ)'], ['no_document', 'No document', 'لا مستند']])}
          {sel('ord_fin', L('Reconciliation', 'التسوية المالية'), fFin, setFFin, [['all', 'All', 'الكل'], ['reconciled', 'Reconciled', 'متطابقة'], ['difference', 'Difference', 'فرق'], ['no_confirmed', 'No confirmed invoice', 'لا فاتورة مؤكدة'], ['no_links', 'No links', 'لا روابط']])}
        </div>
        <div className="rp-tablewrap" tabIndex={0}>
          <table aria-label={L('Enforcement orders', 'أوامر التنفيذ')}>
            <thead><tr><th>{L('Order', 'الأمر')}</th><th>{L('Debtor · Amanah', 'المدين · الأمانة')}</th><th className="num">{L('Order amount', 'مبلغ الأمر')}</th><th>{L('Order status', 'حالة الأمر')}</th><th className="num">{L('Invoices', 'الفواتير')}</th><th>{L('References', 'المراجع')}</th><th>{L('Document', 'المستند')}</th><th>{L('Reconciliation', 'التسوية')}</th></tr></thead>
            <tbody>
              {view.map(({ c, comp, status }) => (
                <tr key={c.enforceNum}>
                  <td><RecordLink to={orderPath(c.enforceNum)} dir="ltr"><b>{c.enforceNum}</b></RecordLink><div className="muted" style={{ fontSize: 11 }}>{c.system === 'sanad' ? 'Sanad' : c.system === 'white_lands' ? L('White-lands file', 'ملف الأراضي البيضاء') : 'Efaa'}{c.contractNo ? ` · ${c.contractNo}` : ''}</div></td>
                  <td dir="auto">{B(c.debtorName) || '—'}<div className="muted" style={{ fontSize: 12 }}>{c.amanahEn}</div></td>
                  <td className="num" dir="ltr">{sar(c.amount)}</td>
                  <td><OrderStatusChip status={status} />{status === 'closed' && <div className="muted" style={{ fontSize: 11 }}>{c.closeReason ? B(CLOSE_REASON_LABEL[c.closeReason] || { en: c.closeReason, ar: c.closeReason }) : L('closure reason unknown', 'سبب الإغلاق غير معروف')}</div>}</td>
                  <td className="num">{comp.references.confirmedLinks}{comp.references.proposed ? <span className="muted"> +{comp.references.proposed}</span> : null}</td>
                  <td>{comp.references.state === 'complete' ? mark(true, L('complete', 'مكتملة')) : comp.references.state === 'none' ? <span className="muted">{c.contractNo ? L('contract level', 'على مستوى العقد') : L('not identified — review', 'غير محددة — مراجعة')}</span> : mark(false, L(`${comp.references.unresolved + comp.references.proposed} open`, `${comp.references.unresolved + comp.references.proposed} مفتوحة`))}</td>
                  <td>{comp.extraction.state === 'complete' ? mark(true, L('all pages read', 'قُرئت كل الصفحات')) : comp.extraction.state === 'incomplete' ? mark(false, L(`${comp.extraction.unreadPages} page(s) unread`, `${comp.extraction.unreadPages} صفحة لم تُقرأ`)) : <span className="muted">{L('no document', 'لا مستند')}</span>}</td>
                  <td>{comp.finance.state === 'reconciled' ? mark(true, L('reconciled', 'متطابقة')) : comp.finance.state === 'short' || comp.finance.state === 'over' ? mark(false, <span dir="ltr">{sar(Math.abs(comp.finance.difference))}</span>) : <span className="muted">{L('not checkable', 'غير قابلة للفحص')}</span>}</td>
                </tr>
              ))}
              {!view.length && <tr><td colSpan={8} className="muted">{L('No orders match this filter.', 'لا توجد أوامر مطابقة لهذا المرشح.')}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={shown.length} size={PAGE} onPage={setPage} />
      </section>
    </>
  );
}
