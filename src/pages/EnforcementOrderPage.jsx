import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../utils/useAsync';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { fmtRiyadh } from '../data/clock';
import { RecordHeader, StatusGroup, Figures, Facts, Section, RecordState } from '../components/record/RecordPage';
import OrderDocuments from '../components/revenue/OrderDocuments';
import { OrderStatusChip, PayStatusChip, Chip, LINK_STATUS_LABEL, CONFLICT_LABEL, KIND_LABEL, SOURCE_LABEL } from '../components/revenue/EnforcementUI';
import { RecordLink, useReturnTarget } from '../utils/returnContext';
import { invoicePath, contractPath, ordersListPath } from '../utils/paths';
import { enforcementOf, CLOSE_REASON_LABEL } from '../data/relations';
import { collectReferences, buildRows, orderCompleteness, otherOrdersByInvoice, isInvoiceKind, ORIGIN_LABEL, isHardConflict } from '../data/orderMatching';
import { orderStatusOf } from '../data/relations';
import { useDocFiles } from '../components/record/PdfPreview';

const ERR = {
  no_permission: { en: 'Read-only role: you cannot change links.', ar: 'دور للقراءة فقط: لا يمكنك تغيير الروابط.' },
  note_required: { en: 'A reason is required to withdraw a confirmed link.', ar: 'يلزم سبب لسحب رابط مؤكد.' },
  not_accessible: { en: 'This order is outside your organisation’s access.', ar: 'هذا الأمر خارج صلاحيات جهتك.' },
  use_remove: { en: 'A confirmed link is withdrawn (with a reason), not rejected.', ar: 'الرابط المؤكد يُسحب (مع سبب) ولا يُرفض.' },
  unresolved_conflict: { en: 'This link has a conflict that no evidence resolves. A reason does not resolve it — keep it unresolved or reject it.', ar: 'في هذا الرابط تعارض لا يحسمه دليل. والسبب لا يحسمه — أبقِه غير محسوم أو ارفضه.' }
};
const ACTION_LABEL = {
  proposed: { en: 'Link proposed (no effect yet)', ar: 'اقتُرح رابط (بلا أثر بعد)' }, confirmed: { en: 'Link confirmed — the order status is reflected on the invoice', ar: 'أُكِّد الرابط — عُكست حالة الأمر على الفاتورة' },
  rejected: { en: 'Link rejected', ar: 'رُفض الرابط' }, removed: { en: 'Confirmed link withdrawn — effect removed from the invoice', ar: 'سُحب رابط مؤكد — أُزيل أثره عن الفاتورة' },
  document_added: { en: 'Document added', ar: 'أُضيف مستند' }, extraction_updated: { en: 'Document re-read', ar: 'أُعيدت قراءة المستند' }, supplemental_extraction: { en: 'Text supplied for unread pages', ar: 'زُوِّد نص للصفحات غير المقروءة' },
  document_file_restored: { en: 'Original PDF added again (identity checked)', ar: 'أُعيدت إضافة ملف PDF الأصلي (بعد التحقق من هويته)' },
  reference_dismissed: { en: 'Reference set aside (not an invoice of this order)', ar: 'استُبعد مرجع (ليس فاتورة لهذا الأمر)' }, order_status_changed: { en: 'Order status changed in Sanad', ar: 'تغيّرت حالة الأمر في سند' },
  candidates_proposed: { en: 'Candidates proposed (earlier version)', ar: 'اقتُرح مرشحون (إصدار سابق)' }
};
const RESOLVE_HINT = {
  ambiguous_reference: { en: 'Resolved only by another reference that identifies exactly one of these invoices (for example the full invoice number on a page of the document). A reason does not resolve it.', ar: 'يُحسم فقط بمرجع آخر يحدد فاتورة واحدة منها (مثل رقم الفاتورة الكامل في صفحة من المستند). والسبب لا يحسمه.' },
  debtor_mismatch: { en: 'Resolved only if an order document names the invoice payer’s identity number. Otherwise the link stays unresolved.', ar: 'يُحسم فقط إذا ذكر مستند الأمر هوية دافع الفاتورة. وإلا يبقى الرابط غير محسوم.' },
  amanah_mismatch: { en: 'No evidence path: the link stays unresolved.', ar: 'لا مسار دليل: يبقى الرابط غير محسوم.' },
  invoice_issued_after_order: { en: 'No evidence path: the link stays unresolved.', ar: 'لا مسار دليل: يبقى الرابط غير محسوم.' },
  document_other_order: { en: 'Found only in a document that names another order: confirm it only if Sanad’s structured data or this order’s own document names the invoice.', ar: 'ورد فقط في مستند يذكر أمراً آخر: لا يُؤكَّد إلا إذا ذكرته بيانات سند المهيكلة أو مستند هذا الأمر.' }
};
const originOf = (row) => (row.origins.find((o) => o.type === 'sanad_structured') || row.origins[0])?.type || 'manual_selection';

export default function EnforcementOrderPage() {
  const { enforceNum: raw } = useParams(); const enforceNum = decodeURIComponent(raw || '');
  const rev = useRevenue();
  const { L, B, ar, sar } = useL();
  const ret = useReturnTarget({ path: ordersListPath, label: L('Enforcement management', 'إدارة التنفيذ') });
  const c = rev.cases.find((x) => x.enforceNum === enforceNum);
  const [msg, setMsg] = useState(null); const [notes, setNotes] = useState({}); const [debtor, setDebtor] = useState(null); const [tick, setTick] = useState(0); const [focus, setFocus] = useState(null);
  const docs = c?.docs || []; const links = c?.links || [];
  const refs = useMemo(() => (c ? collectReferences(c, docs) : []), [c, docs]);
  const asked = useMemo(() => {
    const out = refs.filter((r) => isInvoiceKind(r.kind)).map((r) => ({ kind: r.kind, value: r.value }));
    const have = new Set(out.filter((r) => r.kind === 'invoice_no').map((r) => r.value.toUpperCase()));
    for (const l of links) if (!have.has(l.invoiceId.toUpperCase())) out.push({ kind: 'invoice_id_exact', value: l.invoiceId });
    return out;
  }, [refs, links]);
  const askKey = asked.map((r) => `${r.kind}:${r.value}`).join('|');
  const { data: resolved, loading, error } = useAsync(() => (asked.length ? rev.enforcement.resolve(asked) : Promise.resolve({ results: [] })), [askKey, rev.dataVersion, tick]);
  const others = useMemo(() => otherOrdersByInvoice(rev.cases, enforceNum), [rev.cases, enforceNum]);
  const mismatched = useMemo(() => new Set(docs.filter((d) => d.extraction?.orderNumberMismatch).map((d) => d.id)), [docs]);
  const rows = useMemo(() => (c && resolved ? buildRows(c, refs.filter((r) => isInvoiceKind(r.kind)), resolved.results, links, others, mismatched, docs) : []), [c, resolved, refs, links, others, mismatched, docs]);
  const byInvoice = useMemo(() => { const m = new Map(); for (const r of resolved?.results || []) for (const k of r.candidates) if (!m.has(k.invoiceId)) m.set(k.invoiceId, k); return m; }, [resolved]);
  const files = useDocFiles(docs.map((d) => d.id), tick);

  const crumbs = [{ label: L('Dashboards and reports', 'لوحة المعلومات والتقارير'), to: '/insights' }, { label: L('Enforcement management', 'إدارة التنفيذ'), to: '/enforcement' }, { label: enforceNum, ltr: true }];
  if (!c) return <div className="rp"><RecordHeader crumbs={crumbs} title={enforceNum} ret={ret} /><RecordState notFound kind={L('Enforcement order', 'أمر التنفيذ')} backTo={{ path: ordersListPath, label: L('Back to enforcement management', 'العودة إلى إدارة التنفيذ') }} /></div>;

  const status = orderStatusOf(c); const comp = orderCompleteness(c); const rec = comp.reconciliation;
  const say = (res, okEn, okAr) => setMsg(res.ok ? { ok: true, text: L(okEn, okAr) } : { ok: false, text: ERR[res.error] ? B(ERR[res.error]) : L('Could not record the change.', 'تعذّر تسجيل التغيير.') });
  const inputFor = (row, cand) => {
    const also = rows.filter((r) => r.duplicateOf === row.value && r !== row); // weak / duplicate references that point to the same invoice keep their evidence on the one link
    return {
      invoiceId: cand.invoiceId, origin: row.status === 'ambiguous' ? 'manual_selection' : originOf(row), gross: cand.grossAmount,
      snapshot: { source: cand.source, payerName: cand.payerName, payerId: cand.payerId, issueDate: cand.issueDate, amanahEn: cand.amanahEn },
      evidence: [row, ...also].flatMap((r) => r.origins.map((o) => ({ refKind: r.kind, refValue: r.value, origin: o.type, docId: o.docId || null, docName: o.docName || null, pages: o.pages || null, snippet: o.snippet || null }))),
      conflicts: row.conflicts[cand.invoiceId] || [], resolvedConflicts: row.resolved[cand.invoiceId] || []
    };
  };
  const confirm = (row, cand) => say(rev.enforcement.confirm(c.enforceNum, cand.invoiceId, { note: notes[cand.invoiceId] || '', input: inputFor(row, cand) }), 'Link confirmed. The order status now shows on the invoice; its payment status is unchanged.', 'أُكِّد الرابط. تظهر حالة الأمر الآن على الفاتورة؛ وحالة السداد لم تتغير.');
  const propose = (row, cand) => say(rev.enforcement.propose(c.enforceNum, inputFor(row, cand)), 'Saved as a proposal. It has no effect on the invoice until you confirm it.', 'حُفظ كاقتراح. لا أثر له على الفاتورة حتى تؤكده.');
  const reject = (row, cand) => say(rev.enforcement.reject(c.enforceNum, cand.invoiceId, { note: notes[cand.invoiceId] || '', input: inputFor(row, cand) }), 'Link rejected (kept in the history).', 'رُفض الرابط (محفوظ في السجل).');
  const withdraw = (invoiceId) => say(rev.enforcement.remove(c.enforceNum, invoiceId, { note: notes[`rm-${invoiceId}`] || '', base: links.find((x) => x.invoiceId === invoiceId && x.ledgerStatus == null) || null }), 'Confirmed link withdrawn; the invoice no longer carries this order (its other confirmed orders are unaffected).', 'سُحب الرابط المؤكد؛ لم تعد الفاتورة تحمل هذا الأمر (ولا تتأثر أوامرها المؤكدة الأخرى).');
  const clean = (r) => r.status === 'matched' && !r.link && !r.rejected && !(r.unresolved[r.candidates[0]?.invoiceId] || []).length;
  const proposeAll = () => { let n = 0; for (const row of rows) if (clean(row) && rev.enforcement.propose(c.enforceNum, inputFor(row, row.candidates[0])).ok) n += 1; setMsg({ ok: true, text: L(`${n} proposal(s) saved. They have no effect on any invoice until confirmed.`, `حُفظ ${n} اقتراح. لا أثر له على أي فاتورة حتى يُؤكَّد.`) }); };
  const loadDebtor = async () => { const r = await rev.enforcement.debtorInvoices(c.debtorIdx, links.filter((l) => l.status !== 'rejected').map((l) => l.invoiceId)); setDebtor(r.invoices); };
  const dismiss = (row) => say(rev.enforcement.dismiss(c.enforceNum, row.key, { note: notes[row.key] || '' }), 'Reference set aside (kept in the history).', 'استُبعد المرجع (محفوظ في السجل).');
  const noteInput = (id, ph) => <input key={id} className="input" style={{ width: '100%', padding: '5px 8px', margin: '4px 0' }} aria-label={L('Reason', 'السبب')} placeholder={ph} value={notes[id] || ''} onChange={(e) => setNotes({ ...notes, [id]: e.target.value })} disabled={!rev.canReview} />;
  const clauses = rows.filter(clean).length;
  const contracts = [...new Set([c.contractNo, ...[...byInvoice.values()].filter((k) => links.some((l) => l.invoiceId === k.invoiceId && l.status === 'confirmed')).map((k) => k.contractNo)].filter(Boolean))];
  const otherRefs = [...docs.flatMap((d) => (d.extraction?.others || []).map((o) => ({ ...o, docName: d.name }))), ...refs.filter((r) => !isInvoiceKind(r.kind)).map((r) => ({ kind: r.kind, value: r.value, pages: [], docName: null }))];
  const stateWord = (s) => B({ complete: { en: 'Complete', ar: 'مكتملة' }, incomplete: { en: 'Incomplete', ar: 'غير مكتملة' }, none: { en: 'Nothing found yet', ar: 'لا شيء بعد' }, no_document: { en: 'No document', ar: 'لا مستند' }, reconciled: { en: 'Reconciled', ar: 'متطابقة' }, short: { en: 'Difference', ar: 'فرق' }, over: { en: 'Difference', ar: 'فرق' }, no_links: { en: 'Not checkable', ar: 'غير قابلة للفحص' }, no_confirmed: { en: 'Not checkable', ar: 'غير قابلة للفحص' }, not_checkable: { en: 'Not checkable', ar: 'غير قابلة للفحص' } }[s]);
  const tone = (ok) => (ok ? 'rp-ok' : 'rp-warn');
  const hist = c.history || [];

  return (
    <div className="rp">
      <RecordHeader
        crumbs={crumbs} ret={ret} kind={L('Enforcement order', 'أمر تنفيذ')} title={c.enforceNum}
        actions={<><a className="btn btn-sm btn-primary" href="#docs">{L('Add / view the order PDF', 'إضافة / عرض ملف PDF للأمر')}</a><a className="btn btn-sm" href="#refs">{L('Review the references', 'مراجعة المراجع')}</a></>}
        statuses={<>
          <StatusGroup label={L('Order status (Sanad)', 'حالة الأمر (سند)')} hint={status === 'closed' ? L('closing an order does not mean payment and does not erase its links', 'إغلاق الأمر لا يعني السداد ولا يمحو روابطه') : null}><OrderStatusChip status={status} />{status === 'closed' && <span className="rv-tag">{c.closeReason ? B(CLOSE_REASON_LABEL[c.closeReason] || { en: c.closeReason, ar: c.closeReason }) : L('closure reason unknown', 'سبب الإغلاق غير معروف')}</span>}</StatusGroup>
          <StatusGroup label={L('Source', 'المصدر')} hint={L('live Sanad retrieval is not connected', 'الاسترجاع الحي من سند غير متصل')}><span className="rv-tag rv-tag--warn">{c.feed === 'synthetic_demo' ? L('Sanad — synthetic demo feed', 'سند — تغذية تجريبية اصطناعية') : L('Hand-anchored demo case', 'حالة تجريبية مثبّتة يدوياً')}</span></StatusGroup>
        </>}
      />
      <Figures label={L('Reconciliation summary', 'ملخص التسوية')} items={[
        { label: L('Order amount', 'مبلغ الأمر'), value: sar(c.amount) },
        { label: L(`Confirmed invoices (${rec.confirmedCount})`, `فواتير مؤكدة (${rec.confirmedCount})`), value: rec.confirmedTotal == null ? L('n/a', 'غير متاح') : sar(rec.confirmedTotal), note: L('each invoice counted once', 'كل فاتورة تُحتسب مرة') },
        { label: L(`Proposed (${rec.proposedCount})`, `مقترحة (${rec.proposedCount})`), value: rec.proposedTotal == null ? L('n/a', 'غير متاح') : sar(rec.proposedTotal), note: L('no effect until confirmed', 'بلا أثر حتى التأكيد') },
        { label: L('Difference (order − confirmed)', 'الفرق (الأمر − المؤكد)'), value: rec.difference == null ? '—' : sar(rec.difference), tone: rec.state === 'short' || rec.state === 'over' ? 'bad' : undefined }
      ]} />

      <div className="rp-compl" role="group" aria-label={L('Three completeness states — kept separate', 'ثلاث حالات اكتمال — منفصلة')}>
        <div>
          <h3>{L('1 · Reference matching', '1 · مطابقة المراجع')}</h3>
          <div className={`rp-compl__v ${tone(comp.references.state === 'complete')}`}>{comp.references.state === 'complete' ? '✓ ' : '! '}{stateWord(comp.references.state)}</div>
          <div className="rp-compl__d">{comp.references.state === 'none' ? L('No invoice reference yet.', 'لا مرجع فاتورة بعد.') : L(`${comp.references.total} reference(s) found · ${comp.references.confirmedLinks} confirmed link(s)${comp.references.unresolved ? ` · ${comp.references.unresolved} unresolved` : ''}${comp.references.proposed ? ` · ${comp.references.proposed} proposal(s) to confirm` : ''}.`, `${comp.references.total} مرجع · ${comp.references.confirmedLinks} رابط مؤكد${comp.references.unresolved ? ` · ${comp.references.unresolved} غير محسوم` : ''}${comp.references.proposed ? ` · ${comp.references.proposed} اقتراح للتأكيد` : ''}.`)}</div>
          <div className="rp-compl__d">{L('Does not depend on the amount.', 'لا تعتمد على المبلغ.')}</div>
        </div>
        <div>
          <h3>{L('2 · Document extraction', '2 · استخراج المستند')}</h3>
          <div className={`rp-compl__v ${tone(comp.extraction.state === 'complete')}`}>{comp.extraction.state === 'complete' ? '✓ ' : '! '}{stateWord(comp.extraction.state)}</div>
          <div className="rp-compl__d">{comp.extraction.state === 'no_document' ? L('No order document attached.', 'لا مستند مرفق بالأمر.') : comp.extraction.state === 'incomplete' ? L(`${comp.extraction.unreadPages} page(s) not read (no text layer).`, `${comp.extraction.unreadPages} صفحة لم تُقرأ (بلا طبقة نص).`) : L(`Every page of ${comp.extraction.documents} document(s) has text.`, `لكل صفحات ${comp.extraction.documents} مستند نص.`)}</div>
          {comp.extraction.suppliedPages > 0 && <div className="rp-compl__d rp-warn">{L(`${comp.extraction.suppliedPages} page(s) rely on supplied text (imported external OCR or typed) — its quality is NOT verified by this system.`, `${comp.extraction.suppliedPages} صفحة تعتمد على نص مُزوَّد (OCR خارجي مستورد أو مُدخل يدوياً) — ولا يتحقق هذا النظام من جودته.`)}</div>}
        </div>
        <div>
          <h3>{L('3 · Financial reconciliation', '3 · التسوية المالية')}</h3>
          <div className={`rp-compl__v ${tone(comp.finance.state === 'reconciled')}`}>{comp.finance.state === 'reconciled' ? '✓ ' : '! '}{stateWord(comp.finance.state)}</div>
          <div className="rp-compl__d">{comp.finance.state === 'reconciled' ? L('Confirmed invoices add up to the order amount.', 'الفواتير المؤكدة تساوي مبلغ الأمر.') : comp.finance.difference != null && (comp.finance.state === 'short' || comp.finance.state === 'over') ? L(`${sar(Math.abs(comp.finance.difference))} ${comp.finance.state === 'short' ? 'of the order is not covered by a confirmed invoice' : 'more than the order is covered'} — reported, never forced to match.`, `${sar(Math.abs(comp.finance.difference))} ${comp.finance.state === 'short' ? 'من الأمر غير مغطى بفاتورة مؤكدة' : 'أكثر من الأمر مغطى'} — يُعرض ولا يُفرض تطابقه.`) : L('No confirmed invoice to compare yet.', 'لا فاتورة مؤكدة للمقارنة بعد.')}</div>
        </div>
      </div>
      {msg && <div className={`rv-callout ${msg.ok ? '' : 'rv-callout--bad'}`} role="status" aria-live="polite">{msg.text}</div>}

      <Section id="invoices" title={L('Linked invoices', 'الفواتير المرتبطة')} count={links.filter((l) => l.status !== 'rejected').length}
        note={<div className="rp-limit">{L('Only a CONFIRMED link reflects this order’s status on the invoice. Payment status is a separate field and does not change. An invoice can carry several orders: withdrawing this link never removes the effect of another confirmed order.', 'الرابط «المؤكد» فقط يعكس حالة هذا الأمر على الفاتورة. وحالة السداد حقل منفصل ولا تتغير. وقد تحمل الفاتورة عدة أوامر: سحب هذا الرابط لا يزيل أثر أي أمر مؤكد آخر.')}</div>}>
        {links.length ? (
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Linked invoices', 'الفواتير المرتبطة')}>
            <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th className="num">{L('Gross', 'الإجمالي')}</th><th>{L('Payment status', 'حالة السداد')}</th><th>{L('Link', 'الرابط')}</th><th>{L('Enforcement on the invoice', 'الإنفاذ على الفاتورة')}</th><th style={{ minWidth: 190 }}>{L('Action', 'إجراء')}</th></tr></thead>
            <tbody>{links.map((l) => {
              const k = byInvoice.get(l.invoiceId); const snap = l.snapshot || {}; const enf = enforcementOf(l.invoiceId, rev.cases);
              const sameDebtor = k && c.debtorIdx != null && k.payerIdx != null ? c.debtorIdx === k.payerIdx : null;
              return (
                <tr key={l.invoiceId}>
                  <td><RecordLink to={invoicePath(l.invoiceId)} dir="ltr"><b>{l.invoiceId}</b></RecordLink><div className="muted" style={{ fontSize: 12 }}>{B(SOURCE_LABEL[k?.source || snap.source] || { en: k?.source || snap.source || '', ar: k?.source || snap.source || '' })} · <span dir="auto">{B(k?.payerName || snap.payerName)}</span> {sameDebtor === false && <span className="rv-tag rv-tag--bad">{L('not the order debtor', 'ليس مدين الأمر')}</span>}</div></td>
                  <td className="num" dir="ltr">{sar(k?.grossAmount ?? l.gross ?? 0)}</td>
                  <td>{k ? <PayStatusChip status={k.paymentStatus} /> : '—'}{k && <div className="muted" style={{ fontSize: 12 }} dir="ltr">{L('remaining', 'المتبقي')} {sar(k.outstanding)}</div>}</td>
                  <td><Chip def={LINK_STATUS_LABEL[l.status] || LINK_STATUS_LABEL.rejected} />{l.ledgerStatus === 'removed' && <div className="muted" style={{ fontSize: 12 }}>{L('withdrawn', 'مسحوب')}</div>}<div className="muted" style={{ fontSize: 11 }}>{B(ORIGIN_LABEL[l.origin] || ORIGIN_LABEL.sanad_structured)}</div>{l.reviewNote ? <div className="muted" dir="auto" style={{ fontSize: 11 }}>“{l.reviewNote}”</div> : null}{l.removeNote ? <div className="muted" dir="auto" style={{ fontSize: 11 }}>{L('withdrawn:', 'سُحب:')} “{l.removeNote}”</div> : null}</td>
                  <td style={{ fontSize: 12 }}>{l.status === 'confirmed' ? <><OrderStatusChip status={status} />{enf.confirmed.length > 1 && <div className="muted">{L(`on ${enf.confirmed.length} orders in total`, `على ${enf.confirmed.length} أوامر إجمالاً`)}</div>}</> : <span className="muted">{l.status === 'candidate' ? L('none — awaiting confirmation', 'لا شيء — بانتظار التأكيد') : L('none', 'لا شيء')}</span>}</td>
                  <td>{l.status === 'confirmed' ? (<>{noteInput(`rm-${l.invoiceId}`, L('Reason to withdraw (required)', 'سبب السحب (مطلوب)'))}<button type="button" className="btn btn-sm" disabled={!rev.canReview} onClick={() => withdraw(l.invoiceId)}>{L('Withdraw link…', 'سحب الرابط…')}</button></>) : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="muted">{L('No linked or proposed invoice yet. Add the order document or review the references below.', 'لا فواتير مرتبطة أو مقترحة بعد. أضف مستند الأمر أو راجع المراجع أدناه.')}</div>}
      </Section>

      <Section id="refs" title={L('References and matching review', 'المراجع ومراجعة المطابقة')} count={rows.length}
        note={<div className="rp-limit">{L('Every reference from Sanad and from the document is listed; one number is never taken to be the whole list. A reference matches only an invoice, SADAD or violation number that exists in the system. Order, contract, account and identity numbers are set apart. The amount never creates a match, and a written reason never resolves a conflict — only evidence does.', 'تُسرد كل المراجع من سند ومن المستند؛ ولا يُعدّ رقم واحد القائمة الكاملة. يطابق المرجع فقط رقم فاتورة أو سداد أو مخالفة موجوداً في النظام. وتُعزل أرقام الأوامر والعقود والحسابات والهويات. والمبلغ لا يُنشئ مطابقة، والسبب المكتوب لا يحسم تعارضاً — الدليل وحده يحسمه.')}</div>}>
        {loading && !resolved && <div role="status" className="muted">{L('Matching the references…', 'جارٍ مطابقة المراجع…')}</div>}
        {error && <div className="rp-limit rp-limit--warn" role="alert">{L('The data service could not match the references.', 'تعذّر على خدمة البيانات مطابقة المراجع.')} <button type="button" className="btn btn-sm" onClick={() => setTick((x) => x + 1)}>{L('Retry', 'إعادة المحاولة')}</button></div>}
        {!rows.length && !loading && <div className="muted">{L('No invoice reference yet — Sanad supplied none. Add the order PDF below (or supply the text of its pages).', 'لا مرجع فاتورة بعد — لم تزوّد سند بأي مرجع. أضف ملف PDF للأمر أدناه (أو زوّد نص صفحاته).')}</div>}
        {clauses > 0 && rev.canReview && <div><button type="button" className="btn btn-sm" onClick={proposeAll}>{L(`Save the ${clauses} clean match(es) as proposals`, `حفظ ${clauses} مطابقة سليمة كاقتراحات`)}</button> <span className="muted" style={{ fontSize: 12 }}>{L('Proposals have no effect on any invoice; matches with unresolved conflicts are never included.', 'الاقتراحات بلا أثر على أي فاتورة؛ ولا تُشمل المطابقات ذات التعارضات غير المحسومة.')}</span></div>}
        {rows.length > 0 && (
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('References', 'المراجع')}>
            <thead><tr><th>{L('Reference', 'المرجع')}</th><th>{L('Found in', 'وُجد في')}</th><th>{L('Result', 'النتيجة')}</th><th>{L('Invoice', 'الفاتورة')}</th><th style={{ minWidth: 230 }}>{L('Review', 'المراجعة')}</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.key}>
                <td><b dir="ltr">{row.value}</b><div className="muted" style={{ fontSize: 12 }}>{B(KIND_LABEL[row.kind] || { en: row.kind, ar: row.kind })}{row.normalized ? ` → ${row.normalized}` : ''}</div></td>
                <td style={{ fontSize: 12 }}>{row.origins.map((o, i) => <div key={i}>{B(ORIGIN_LABEL[o.type] || { en: o.type, ar: o.type })}{o.docName ? <span dir="ltr"> · {o.docName}</span> : null}{o.pages?.length ? <> · <button type="button" className="rv-link" onClick={() => { setFocus({ docId: o.docId, page: o.pages[0] }); document.getElementById('docs')?.scrollIntoView({ behavior: 'smooth' }); }}>{L('page', 'صفحة')} {o.pages.join(', ')}</button></> : ''}{o.snippet ? <div className="muted" dir="ltr">“{o.snippet}”</div> : null}</div>)}</td>
                <td>
                  {row.status === 'matched' && <Chip def={{ en: 'Matched', ar: 'مطابق', cls: 'rv-cat--collected' }} />}
                  {row.status === 'ambiguous' && <Chip def={{ en: `Ambiguous — ${row.candidates.length} invoices`, ar: `ملتبس — ${row.candidates.length} فواتير`, cls: 'rv-cat--partial' }} />}
                  {row.status === 'resolved_by_reference' && <Chip def={{ en: 'Weak reference settled by another reference', ar: 'مرجع ضعيف حُسم بمرجع آخر', cls: 'rv-cat--collected' }} />}
                  {row.status === 'unmatched' && <Chip def={{ en: 'Not found in the system', ar: 'غير موجود في النظام', cls: 'rv-cat--overdue' }} />}
                  {row.status === 'duplicate_reference' && <Chip def={{ en: 'Duplicate of another reference', ar: 'مكرر لمرجع آخر', cls: 'rv-cat--partial' }} />}
                  {row.status === 'pending' && <span className="muted">…</span>}
                  {row.duplicateOf && <div className="muted" style={{ fontSize: 12 }}>{L('same invoice as', 'نفس فاتورة')} <span dir="ltr">{row.duplicateOf}</span> — {L('evidence kept, amount counted once', 'الدليل محفوظ والمبلغ يُحتسب مرة')}</div>}
                  {row.weak && row.status === 'matched' && <div className="muted" style={{ fontSize: 12 }}>{L('weak reference (year missing / padded)', 'مرجع ضعيف (بلا سنة / مُكمَّل)')}</div>}
                  {row.status === 'unmatched' && <div className="muted" style={{ fontSize: 12 }}>{L('Possibly a typing or OCR error — never replaced by a “similar” invoice.', 'ربما خطأ طباعة أو OCR — ولا يُستبدل بفاتورة «مشابهة».')}</div>}
                </td>
                <td>{row.candidates.map((k) => (
                  <div key={k.invoiceId} style={{ marginBottom: 6, fontSize: 13 }}>
                    <RecordLink to={invoicePath(k.invoiceId)} dir="ltr">{k.invoiceId}</RecordLink> · {B(SOURCE_LABEL[k.source] || { en: k.source, ar: k.source })}
                    <div className="muted" style={{ fontSize: 12 }}>{B(k.payerName)} · <span dir="ltr">{sar(k.grossAmount)}</span> · <PayStatusChip status={k.paymentStatus} /></div>
                    {(row.conflicts[k.invoiceId] || []).map((x) => <span key={x} className={`rv-tag ${isHardConflict(x) && (row.unresolved[k.invoiceId] || []).includes(x) ? 'rv-tag--bad' : 'rv-tag--warn'}`}>{B(CONFLICT_LABEL[x] || { en: x, ar: x })}</span>)}
                    {(row.resolved[k.invoiceId] || []).map((r) => <div key={r.conflict} className="rp-ok" style={{ fontSize: 12 }}>✓ {L('conflict resolved by evidence', 'حُسم التعارض بدليل')}: {r.by === 'document_names_payer' ? `${L('the document names the payer', 'المستند يذكر الدافع')} (${r.evidence.value}${r.evidence.pages?.length ? `, ${L('page', 'صفحة')} ${r.evidence.pages.join(',')}` : ''})` : r.by}</div>)}
                    {(others.get(k.invoiceId) || []).map((o) => <div key={o.enforceNum} className="muted" style={{ fontSize: 12 }}>{L('also on', 'عليها أيضاً')} <RecordLink to={`/enforcement-orders/${o.enforceNum}`} dir="ltr">{o.enforceNum}</RecordLink> ({o.status === 'confirmed' ? L('confirmed', 'مؤكد') : L('proposed', 'مقترح')}, <OrderStatusChip status={o.orderStatus} />)</div>)}
                  </div>
                ))}</td>
                <td>
                  {row.status === 'duplicate_reference' && <span className="muted">—</span>}
                  {row.status !== 'duplicate_reference' && row.candidates.map((k) => {
                    const l = links.find((x) => x.invoiceId === k.invoiceId); const hard = row.unresolved[k.invoiceId] || [];
                    return (
                      <div key={k.invoiceId} style={{ marginBottom: 8 }}>
                        {row.candidates.length > 1 && <div dir="ltr" style={{ fontSize: 12, fontWeight: 700 }}>{k.invoiceId}</div>}
                        {l && <div style={{ marginBottom: 3 }}><Chip def={LINK_STATUS_LABEL[l.status]} /></div>}
                        {hard.length > 0 && (!l || l.status !== 'confirmed') && <div className="rp-limit rp-limit--warn" style={{ margin: '4px 0' }}><b>{L('Unresolved — cannot be confirmed', 'غير محسوم — لا يمكن تأكيده')}</b>{hard.map((x) => <div key={x}>{B(RESOLVE_HINT[x] || { en: '', ar: '' })}</div>)}</div>}
                        {(!l || l.status === 'rejected') && (<div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <button type="button" className="btn btn-sm btn-primary" disabled={!rev.canReview || hard.length > 0} onClick={() => confirm(row, k)}>{L('Confirm link', 'تأكيد الربط')}</button>
                          {!l && <button type="button" className="btn btn-sm" disabled={!rev.canReview || hard.length > 0} onClick={() => propose(row, k)}>{L('Save as proposal', 'حفظ كاقتراح')}</button>}
                          {!l && <button type="button" className="btn btn-sm" disabled={!rev.canReview} onClick={() => reject(row, k)}>{L('Reject', 'رفض')}</button>}
                        </div>)}
                        {l?.status === 'candidate' && <div style={{ display: 'flex', gap: 5 }}><button type="button" className="btn btn-sm btn-primary" disabled={!rev.canReview || hard.length > 0} onClick={() => confirm(row, k)}>{L('Confirm link', 'تأكيد الربط')}</button><button type="button" className="btn btn-sm" disabled={!rev.canReview} onClick={() => reject(row, k)}>{L('Reject', 'رفض')}</button></div>}
                        {l?.status === 'confirmed' && <span className="muted" style={{ fontSize: 12 }}>{L('Withdraw it in «Linked invoices».', 'يُسحب من «الفواتير المرتبطة».')}</span>}
                      </div>
                    );
                  })}
                  {row.status === 'unmatched' && (c.dismissedRefs || []).includes(row.key) && <span className="rv-tag">{L('set aside', 'مستبعد')}</span>}
                  {row.status === 'unmatched' && rev.canReview && !(c.dismissedRefs || []).includes(row.key) && (<>{noteInput(row.key, L('Reason (optional)', 'السبب (اختياري)'))}<button type="button" className="btn btn-sm" onClick={() => dismiss(row)}>{L('Set aside — not an invoice of this order', 'استبعاد — ليس فاتورة لهذا الأمر')}</button></>)}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {comp.unresolved.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{L(`${comp.unresolved.length} reference(s) are not yet accounted for by a link or a decision.`, `${comp.unresolved.length} مرجع لم يُحسم برابط أو قرار بعد.`)}</div>}
        {otherRefs.length > 0 && (
          <Section id="others" secondary title={L('Other numbers found — not invoice references, never matched', 'أرقام أخرى وُجدت — ليست مراجع فواتير ولا تُطابَق')} count={otherRefs.length}>
            <div className="rp-tablewrap" tabIndex={0}><table>
              <thead><tr><th>{L('Number', 'الرقم')}</th><th>{L('Read as', 'قُرئ على أنه')}</th><th>{L('Where', 'أين')}</th></tr></thead>
              <tbody>{otherRefs.map((o, i) => <tr key={i}><td dir="ltr">{o.value}</td><td>{B(KIND_LABEL[o.kind] || { en: o.kind, ar: o.kind })}{o.label && o.label !== 'pattern' && o.label !== 'unlabelled' ? <span className="muted"> · {o.label}</span> : null}</td><td style={{ fontSize: 12 }} dir="ltr">{o.docName ? `${o.docName} · p.${(o.pages || []).join(',')}` : ''}{o.snippet ? <div className="muted">“{o.snippet}”</div> : null}</td></tr>)}</tbody>
            </table></div>
          </Section>
        )}
      </Section>

      <Section id="docs" title={L('Document and extraction evidence', 'المستند وأدلة الاستخراج')} count={docs.length}>
        <OrderDocuments order={c} rev={rev} onMessage={setMsg} focus={focus} tick={tick} onChanged={() => setTick((x) => x + 1)} />
        {docs.some((d) => files[d.id] === false) && <div className="rp-limit rp-limit--warn" role="status">{L('Some original PDF files are unavailable in this browser (for example after restoring a backup, which does not contain PDF files). The extracted references, pages, evidence and link history are kept; add the file again to view it — its identity is checked first.', 'بعض ملفات PDF الأصلية غير متاحة في هذا المتصفح (مثلاً بعد استعادة نسخة احتياطية لا تتضمن ملفات PDF). تبقى المراجع المستخرجة والصفحات والأدلة وسجل الروابط؛ أضف الملف مرة أخرى لعرضه — وتُفحص هويته أولاً.')}</div>}
      </Section>

      <Section id="finance" title={L('Financial reconciliation', 'التسوية المالية')}>
        <Facts items={[
          { k: L('Order amount (Sanad)', 'مبلغ الأمر (سند)'), v: sar(c.amount), ltr: true }, { k: L('Confirmed invoices, each counted once', 'الفواتير المؤكدة، كل فاتورة مرة'), v: rec.confirmedTotal == null ? '—' : sar(rec.confirmedTotal), ltr: true },
          { k: L('Difference', 'الفرق'), v: rec.difference == null ? '—' : sar(rec.difference), ltr: true }, rec.proposedCount > 0 && { k: L('Difference if every proposal were confirmed', 'الفرق لو أُكِّدت كل الاقتراحات'), v: rec.differenceIfProposedConfirmed == null ? '—' : sar(rec.differenceIfProposedConfirmed), ltr: true }
        ].filter(Boolean)} />
        {(rec.state === 'short' || rec.state === 'over') && <div className="rp-limit rp-limit--warn">{rec.state === 'short' ? L('The confirmed invoices cover LESS than the order: look for further references in the document or in Sanad — do not force a match to make the totals agree.', 'الفواتير المؤكدة تغطي أقل من الأمر: ابحث عن مراجع إضافية في المستند أو في سند — ولا تفرض مطابقة لجعل المجاميع تتفق.') : L('The confirmed invoices cover MORE than the order: check for a wrong or duplicate link.', 'الفواتير المؤكدة تغطي أكثر من الأمر: افحص رابطاً خاطئاً أو مكرراً.')}</div>}
        {rec.state === 'short' && c.debtorIdx != null && (
          <div><button type="button" className="btn btn-sm" onClick={loadDebtor}>{L('Show other open invoices of this debtor (investigation only)', 'عرض فواتير مفتوحة أخرى لهذا المدين (للتحقق فقط)')}</button>
            {debtor && (<div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <div className="rp-limit">{L('These are NOT proposed matches. An amount alone never links an invoice — use them only to know where to look for a further reference.', 'هذه ليست مطابقات مقترحة. فالمبلغ وحده لا يربط فاتورة — استعملها فقط لمعرفة أين تبحث عن مرجع إضافي.')}</div>
              <div className="rp-tablewrap" tabIndex={0}><table><thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Type', 'النوع')}</th><th className="num">{L('Gross', 'الإجمالي')}</th><th className="num">{L('Remaining', 'المتبقي')}</th><th>{L('Payment status', 'حالة السداد')}</th></tr></thead>
                <tbody>{debtor.map((d) => <tr key={d.invoiceId}><td dir="ltr"><RecordLink to={invoicePath(d.invoiceId)}>{d.invoiceId}</RecordLink></td><td>{B(SOURCE_LABEL[d.source] || { en: d.source, ar: d.source })}</td><td className="num" dir="ltr">{sar(d.grossAmount)}</td><td className="num" dir="ltr">{sar(d.outstanding)}</td><td><PayStatusChip status={d.paymentStatus} /></td></tr>)}{!debtor.length && <tr><td colSpan={5} className="muted">{L('No other open invoices.', 'لا فواتير مفتوحة أخرى.')}</td></tr>}</tbody></table></div>
            </div>)}
          </div>
        )}
      </Section>

      <Section id="facts" title={L('Sanad order information', 'بيانات الأمر من سند')}>
        <Facts items={[
          { k: L('Order number', 'رقم الأمر'), v: c.enforceNum, ltr: true }, { k: L('Opened', 'تاريخ الفتح'), v: c.openedDate, ltr: true }, { k: L('Amanah', 'الأمانة'), v: c.amanahEn },
          { k: L('Debtor', 'المدين'), v: <>{B(c.debtorName) || '—'}{c.debtorId ? <span className="muted" dir="ltr"> · {c.debtorId}</span> : null}</> },
          { k: L('Invoice references from Sanad', 'مراجع الفواتير من سند'), v: (c.refs || []).length ? (c.refs || []).map((r) => r.value).join(', ') : L('none supplied', 'لم تُزوَّد'), ltr: true },
          { k: L('Contract', 'العقد'), v: contracts.length ? contracts.map((no, i) => <span key={no}>{i ? ' · ' : ''}<RecordLink to={contractPath(no)} dir="ltr">{no}</RecordLink></span>) : L('none — this order is not tied to a contract (it covers invoices of any type)', 'لا عقد — هذا الأمر غير مرتبط بعقد (يشمل فواتير من أي نوع)') }
        ]} />
        <div className="rp-limit">{L('Contracts are listed only where the invoice record itself carries one, or where Sanad names the contract number — never inferred from an amount or a payer name.', 'تُسرد العقود فقط حيث يحمل سجل الفاتورة عقداً أو تذكر سند رقم العقد — ولا تُستنتج من مبلغ أو اسم دافع.')}</div>
      </Section>

      <Section id="history" secondary title={L('Link and status history', 'سجل الروابط والحالات')} count={hist.length}>
        {hist.length ? (
          <div className="rp-tablewrap" tabIndex={0}><table><thead><tr><th>{L('When (Riyadh)', 'متى (الرياض)')}</th><th>{L('Who', 'من')}</th><th>{L('What', 'ماذا')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Detail', 'تفصيل')}</th></tr></thead>
            <tbody>{hist.map((h, i) => <tr key={i}><td dir="ltr">{String(h.at || '').length > 10 ? fmtRiyadh(h.at) : h.at}</td><td>{h.by}</td><td>{ACTION_LABEL[h.action] ? B(ACTION_LABEL[h.action]) : h.action}</td><td dir="ltr">{h.invoiceId || '—'}</td><td style={{ fontSize: 12 }} dir="auto">{histDetail(h, L, B)}</td></tr>)}</tbody></table></div>
        ) : <div className="muted">{L('No history yet.', 'لا يوجد سجل بعد.')}</div>}
      </Section>
    </div>
  );
}

function histDetail(h, L, B) {
  const d = h.detail || {}; const bits = [];
  if (h.note) bits.push(h.note);
  if (d.note) bits.push(`“${d.note}”`);
  if (d.appliedOrderStatus) bits.push(`${L('status applied', 'الحالة المعكوسة')}: ${B({ open: { en: 'In execution', ar: 'قيد التنفيذ' }, suspended: { en: 'Suspended', ar: 'موقوف' }, closed: { en: 'Closed', ar: 'مغلق' } }[d.appliedOrderStatus] || { en: d.appliedOrderStatus, ar: d.appliedOrderStatus })}`);
  if (d.wasAppliedStatus) bits.push(`${L('status removed', 'الحالة المُزالة')}: ${d.wasAppliedStatus}`);
  if (d.from && d.to) bits.push(`${d.from} → ${d.to}${d.invoices?.length ? ` (${d.invoices.length} ${L('confirmed invoice(s) follow it', 'فاتورة مؤكدة تتبعه')})` : ''}`);
  if (d.name) bits.push(d.name);
  if (Array.isArray(d.pages)) bits.push(`${L('pages', 'الصفحات')} ${d.pages.join(', ')}`); else if (typeof d.pages === 'number') bits.push(`${d.pages} ${L('page(s)', 'صفحة')}`);
  if (d.invoiceReferences != null) bits.push(`${d.invoiceReferences} ${L('invoice reference(s)', 'مرجع فاتورة')}`);
  if (d.origin) bits.push(B(ORIGIN_LABEL[d.origin] || { en: d.origin, ar: d.origin }));
  if (Array.isArray(d.conflicts) && d.conflicts.length) bits.push(`${L('conflicts', 'تعارضات')}: ${d.conflicts.join(', ')}`);
  if (Array.isArray(d.resolvedConflicts) && d.resolvedConflicts.length) bits.push(`${L('resolved by evidence', 'حُسمت بدليل')}: ${d.resolvedConflicts.map((r) => r.conflict).join(', ')}`);
  return bits.join(' · ') || '—';
}
