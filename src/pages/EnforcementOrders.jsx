import React, { useEffect, useMemo, useState } from 'react';
import Pager from '../components/Pager';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { MetricTile } from '../components/revenue/RevenueUI';
import { OrderStatusChip, IntegrationNotice } from '../components/revenue/EnforcementUI';
import { orderCompleteness, orderStatusOf } from '../data/orderMatching';
import { enforcementCounts, CLOSE_REASON_LABEL } from '../data/relations';
import { RecordLink, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { orderPath } from '../utils/paths';
import { useDocFiles } from '../components/record/PdfPreview';

const PAGE = 25;
const mark = (ok, text) => <span className={ok ? 'rp-ok' : 'rp-warn'}>{ok ? '✓' : '!'} {text}</span>;

// إدارة أوامر التنفيذ — every order of Sanad, over ALL invoice types. Each order is judged on THREE separate completeness states, never one label.
export default function EnforcementOrders() {
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
  const counts = useMemo(() => enforcementCounts(cases), [cases]);
  const needs = (r) => r.comp.references.state === 'incomplete' || r.comp.extraction.state === 'incomplete' || ['short', 'over', 'not_checkable'].includes(r.comp.finance.state);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (fStatus === 'all' || r.status === fStatus)
      && (fRefs === 'all' || r.comp.references.state === fRefs) && (fDoc === 'all' || r.comp.extraction.state === fDoc)
      && (fFin === 'all' || (fFin === 'difference' ? ['short', 'over'].includes(r.comp.finance.state) : r.comp.finance.state === fFin))
      && (!t || r.c.enforceNum.toLowerCase().includes(t) || `${r.c.debtorName?.ar || ''} ${r.c.debtorName?.en || r.c.debtorName || ''}`.toLowerCase().includes(t) || (r.c.debtorId || '').includes(t)));
  }, [rows, fStatus, fRefs, fDoc, fFin, q]);
  const view = shown.slice(page * PAGE, (page + 1) * PAGE);
  useRestoreScroll(view.length > 0);
  const allDocs = useMemo(() => cases.flatMap((c) => c.docs || []), [cases]);
  const files = useDocFiles(allDocs.map((d) => d.id));
  const missing = allDocs.filter((d) => files[d.id] === false).length;
  const sel = (id, label, v, set, opts) => (
    <label>{label}<select id={id} className="input" value={v} onChange={(e) => { set(e.target.value); setPage(0); }}>{opts.map(([k, en, ar]) => <option key={k} value={k}>{L(en, ar)}</option>)}</select></label>
  );

  return (
    <div className="rp">
      <header className="rp-head">
        <div className="rp-titlebar"><div className="rp-title"><h1 className="page-title">{L('Enforcement orders management', 'إدارة أوامر التنفيذ')}</h1>
          <div className="page-sub">{L('Sanad is the source. An order covers one or several invoices of ANY revenue type, and an invoice can carry several orders. Open an order to review its references, document and reconciliation.', 'سند هو المصدر. يشمل الأمر فاتورة أو عدة فواتير من أي نوع إيراد، وقد تحمل الفاتورة عدة أوامر. افتح الأمر لمراجعة مراجعه ومستنده وتسويته.')}</div></div></div>
      </header>
      <IntegrationNotice compact />
      {missing > 0 && <div className="rp-limit rp-limit--warn" role="status">{L(`${missing} order document(s) have no original PDF in this browser (for example after a restore: backups do not contain PDF files). Their extracted references, evidence and history are kept; open the order to add the file again.`, `${missing} مستند أمر بلا ملف PDF أصلي في هذا المتصفح (مثلاً بعد استعادة: النسخ الاحتياطية لا تتضمن ملفات PDF). تبقى مراجعها المستخرجة وأدلتها وسجلها؛ افتح الأمر لإعادة إضافة الملف.`)}</div>}

      <div className="rv-tiles" aria-label={L('Counts — stated explicitly; invoices are counted once', 'الأعداد — مصرَّح بها؛ وتُعدّ الفاتورة مرة واحدة')}>
        <MetricTile label={L('Orders', 'الأوامر')} value={fmt(rows.length)} sub={L(`${rows.filter((r) => r.status === 'open').length} in execution · ${rows.filter((r) => r.status === 'suspended').length} suspended · ${rows.filter((r) => r.status === 'closed').length} closed`, `${rows.filter((r) => r.status === 'open').length} قيد التنفيذ · ${rows.filter((r) => r.status === 'suspended').length} موقوف · ${rows.filter((r) => r.status === 'closed').length} مغلق`)} />
        <MetricTile label={L('Invoices under an OPEN order', 'فواتير تحت أمر مفتوح')} value={fmt(counts.open)} sub={L(`${counts.inExecution} in execution · ${counts.suspended} suspended — unique invoices`, `${counts.inExecution} قيد التنفيذ · ${counts.suspended} موقوف — فواتير فريدة`)} />
        <MetricTile label={L('Invoices EVER referred', 'فواتير سبقت إحالتها')} value={fmt(counts.everReferred)} sub={L(`includes ${counts.closedOnly} whose orders are all closed — unique invoices`, `تشمل ${counts.closedOnly} أوامرها كلها مغلقة — فواتير فريدة`)} />
        <MetricTile label={L('Orders needing action', 'أوامر تحتاج إجراء')} value={fmt(rows.filter(needs).length)} tone={rows.filter(needs).length ? 'warn' : undefined} sub={L('an incomplete state in at least one of the three', 'حالة غير مكتملة في واحدة على الأقل من الثلاث')} />
      </div>

      <section className="rp-section" aria-label={L('Orders', 'الأوامر')}>
        <div className="rv-form" role="search" aria-label={L('Order filters', 'مرشحات الأوامر')} style={{ marginBottom: 10 }}>
          <label style={{ flex: '1 1 220px' }}>{L('Search order number or debtor', 'بحث برقم الأمر أو المدين')}<input id="ord_q" className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="EN-5013" dir="auto" /></label>
          {sel('ord_status', L('Order status', 'حالة الأمر'), fStatus, setFStatus, [['all', 'All', 'الكل'], ['open', 'In execution', 'قيد التنفيذ'], ['suspended', 'Suspended', 'موقوف'], ['closed', 'Closed', 'مغلق']])}
          {sel('ord_refs', L('Reference matching', 'مطابقة المراجع'), fRefs, setFRefs, [['all', 'All', 'الكل'], ['complete', 'Complete', 'مكتملة'], ['incomplete', 'Incomplete', 'غير مكتملة'], ['none', 'Nothing found yet', 'لا شيء بعد']])}
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
                  <td>{comp.references.state === 'complete' ? mark(true, L('complete', 'مكتملة')) : comp.references.state === 'none' ? <span className="muted">{c.contractNo ? L('contract level', 'على مستوى العقد') : L('none yet', 'لا شيء بعد')}</span> : mark(false, L(`${comp.references.unresolved + comp.references.proposed} open`, `${comp.references.unresolved + comp.references.proposed} مفتوحة`))}</td>
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
    </div>
  );
}
