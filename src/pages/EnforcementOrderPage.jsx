import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../utils/useAsync';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { fmtRiyadh } from '../data/clock';
import { RecordHeader, StatusGroup, Figures, Facts, Section, RecordState } from '../components/record/RecordPage';
import OrderDocuments, { METHOD_NOTE } from '../components/revenue/OrderDocuments';
import OrderJourney from '../components/revenue/OrderJourney';
import { SIM_LABEL } from '../data/ocrSimulation';
import { locLabel } from '../data/docxText';
import { SOURCE_FIELDS, isCorruptedNumber } from '../data/sanadSource';
import { OrderStatusChip, PayStatusChip, Chip, LINK_STATUS_LABEL, KIND_LABEL, SOURCE_LABEL, IntegrationNotice } from '../components/revenue/EnforcementUI';
import { RecordLink, useReturnTarget } from '../utils/returnContext';
import { invoicePath, contractPath, ordersListPath } from '../utils/paths';
import { enforcementOf, CLOSE_REASON_LABEL } from '../data/relations';
import { collectReferences, contractMentions, buildRows, orderCompleteness, otherOrdersByInvoice, isInvoiceKind, ORIGIN_LABEL, isHardConflict } from '../data/orderMatching';
import { FORMAT_LABEL } from '../data/docText';
import { orderStatusOf } from '../data/relations';
import { useDocFiles } from '../components/record/PdfPreview';

const ERR = {
  no_permission: { en: 'Read-only role: you cannot change links.', ar: 'دور للقراءة فقط: لا يمكنك تغيير الروابط.' },
  note_required: { en: 'A reason is required to withdraw a confirmed link.', ar: 'يلزم سبب لسحب رابط مؤكد.' },
  not_accessible: { en: 'This order is outside your organisation’s access.', ar: 'هذا الأمر خارج صلاحيات جهتك.' },
  contract_not_found: { en: 'That contract number does not exist in the system, so the mention cannot be confirmed.', ar: 'رقم العقد غير موجود في النظام فلا يمكن تأكيد الذكر.' },
  evidence_required: { en: 'Confirming needs supporting evidence: a document that names the contract.', ar: 'التأكيد يحتاج دليلاً داعماً: مستنداً يذكر العقد.' },
  explicit_statement_required: { en: 'Confirming needs a document that EXPLICITLY states the contract itself is referred, with the statement recorded.', ar: 'التأكيد يحتاج مستنداً ينص صراحة على إحالة العقد نفسه مع تسجيل النص.' },
  use_remove: { en: 'A confirmed link is withdrawn (with a reason), not rejected.', ar: 'الرابط المؤكد يُسحب (مع سبب) ولا يُرفض.' },
  unresolved_conflict: { en: 'This link has a conflict that no evidence resolves. A reason does not resolve it — keep it unresolved or reject it.', ar: 'في هذا الرابط تعارض لا يحسمه دليل. والسبب لا يحسمه — أبقِه غير محسوم أو ارفضه.' }
};
const ACTION_LABEL = {
  proposed: { en: 'Link proposed (no effect yet)', ar: 'اقتُرح رابط (بلا أثر بعد)' }, confirmed: { en: 'Link confirmed — the order status is reflected on the invoice', ar: 'أُكِّد الرابط — عُكست حالة الأمر على الفاتورة' },
  rejected: { en: 'Link rejected', ar: 'رُفض الرابط' }, removed: { en: 'Confirmed link withdrawn — effect removed from the invoice', ar: 'سُحب رابط مؤكد — أُزيل أثره عن الفاتورة' },
  document_added: { en: 'Document added', ar: 'أُضيف مستند' }, extraction_updated: { en: 'Document re-read', ar: 'أُعيدت قراءة المستند' }, supplemental_extraction: { en: 'Text supplied for unread pages', ar: 'زُوِّد نص للصفحات غير المقروءة' },
  document_file_restored: { en: 'Original file added again (identity checked)', ar: 'أُعيدت إضافة الملف الأصلي (بعد التحقق من هويته)' },
  manual_references_added: { en: 'References typed by a person', ar: 'مراجع أدخلها شخص' }, contract_reference_confirmed: { en: 'Contract mention confirmed as a direct referral (reviewed)', ar: 'أُكِّد ذكر العقد كإحالة مباشرة (بعد مراجعة)' }, contract_reference_rejected: { en: 'Contract mention recorded as not a referral', ar: 'سُجّل ذكر العقد على أنه ليس إحالة' },
  reference_dismissed: { en: 'Reference set aside (not an invoice of this order)', ar: 'استُبعد مرجع (ليس فاتورة لهذا الأمر)' }, order_status_changed: { en: 'Order status changed in Sanad', ar: 'تغيّرت حالة الأمر في سند' },
  candidates_proposed: { en: 'Candidates proposed (earlier version)', ar: 'اقتُرح مرشحون (إصدار سابق)' }
};
const originOf = (row) => (row.origins.find((o) => o.type === 'sanad_structured') || row.origins[0])?.type || 'manual_selection';

export default function EnforcementOrderPage() {
  const { enforceNum: raw } = useParams(); const enforceNum = decodeURIComponent(raw || '');
  const rev = useRevenue();
  const { L, B, ar, sar } = useL();
  const ret = useReturnTarget({ path: ordersListPath, label: L('Enforcement management', 'إدارة التنفيذ') });
  const c = rev.cases.find((x) => x.enforceNum === enforceNum);
  const [msg, setMsg] = useState(null); const [notes, setNotes] = useState({}); const [debtor, setDebtor] = useState(null); const [cf, setCf] = useState({}); const [tick, setTick] = useState(0); const [focus, setFocus] = useState(null);
  const docs = c?.docs || []; const links = c?.links || [];
  const refs = useMemo(() => (c ? collectReferences(c, docs) : []), [c, docs]);
  const cmentions = useMemo(() => (c ? contractMentions(c, docs) : []), [c, docs]);
  const asked = useMemo(() => {
    const out = refs.filter((r) => isInvoiceKind(r.kind)).map((r) => ({ kind: r.kind, value: r.value }));
    const have = new Set(out.filter((r) => r.kind === 'invoice_no').map((r) => r.value.toUpperCase()));
    for (const l of links) if (!have.has(l.invoiceId.toUpperCase())) out.push({ kind: 'invoice_id_exact', value: l.invoiceId });
    for (const m of cmentions) if (!m.structured) out.push({ kind: 'contract_no', value: m.contractNo }); // does the mentioned contract exist? (a mention alone is not a referral)
    return out;
  }, [refs, links, cmentions]);
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
  const stateWord = (s) => B({ complete: { en: 'Complete', ar: 'مكتملة' }, incomplete: { en: 'Incomplete', ar: 'غير مكتملة' }, none: { en: 'Not identified — review required', ar: 'لم يتم تحديد أرقام الفواتير — تحتاج مراجعة' }, no_document: { en: 'No document', ar: 'لا مستند' }, reconciled: { en: 'Reconciled', ar: 'متطابقة' }, short: { en: 'Difference', ar: 'فرق' }, over: { en: 'Difference', ar: 'فرق' }, no_links: { en: 'Not checkable', ar: 'غير قابلة للفحص' }, no_confirmed: { en: 'Not checkable', ar: 'غير قابلة للفحص' }, not_checkable: { en: 'Not checkable', ar: 'غير قابلة للفحص' } }[s]);
  const tone = (ok) => (ok ? 'rp-ok' : 'rp-warn');
  const srcs = comp.references.sources;
  const contractExists = (no) => (resolved?.results || []).some((r) => r.ref.kind === 'contract_no' && String(r.ref.value).toUpperCase() === no && r.status === 'contract_found');
  const reviewContract = (m, decision, evidence, exists) => say(rev.enforcement.reviewContract(c.enforceNum, m.contractNo, { decision, note: notes[`ct-${m.contractNo}`] || '', exists, evidence }),
    decision === 'confirmed' ? 'Direct referral of the contract confirmed on the recorded evidence (kept in the history). This does not say which invoices are referred.' : 'Mention recorded as not a referral (kept in the history).',
    decision === 'confirmed' ? 'أُكِّدت الإحالة المباشرة للعقد بالدليل المسجّل (محفوظ في السجل). وهذا لا يحدد أي فواتير محالة.' : 'سُجّل الذكر على أنه ليس إحالة (محفوظ في السجل).');
  const hist = c.history || [];

  return (
    <div className="rp">
      <RecordHeader
        crumbs={crumbs} ret={ret} kind={L(`Enforcement request ${c.source?.requestNo || ''}`, `طلب التنفيذ رقم ${c.source?.requestNo || ''}`)} title={c.enforceNum}
        statuses={<>
          <StatusGroup label={L('Order status (provisional class)', 'حالة الأمر (تصنيف مؤقت)')} hint={status === 'closed' ? L('closing an order does not mean payment and does not erase its links', 'إغلاق الأمر لا يعني السداد ولا يمحو روابطه') : null}><OrderStatusChip status={status} /></StatusGroup>
          <StatusGroup label={L('Referral status (source)', 'حالة الرفع للتنفيذ (المصدر)')} hint={L('as written in Sanad; the open/suspended/closed class is provisional', 'كما كُتبت في سند؛ وتصنيفها مفتوح/موقوف/مغلق مؤقت')}><b>{c.source?.statusText || '—'}</b></StatusGroup>
          <StatusGroup label={L('Source', 'المصدر')}><span className="rv-tag rv-tag--warn">{c.feed === 'synthetic_demo' ? L('Sanad — synthetic demo feed', 'سند — تغذية تجريبية اصطناعية') : L('Hand-anchored demo case', 'حالة تجريبية مثبّتة يدوياً')}</span></StatusGroup>
        </>}
      />
      <IntegrationNotice />
      <Figures label={L('Order summary', 'ملخص الأمر')} items={[
        { label: L('Order amount', 'مبلغ الأمر'), value: sar(c.amount) },
        { label: L('Debtor', 'المدين'), value: <span dir="auto">{B(c.debtorName) || '—'}</span>, note: c.debtorId ? <span dir="ltr">{c.debtorId}</span> : null },
        { label: L(`Linked invoices (${rec.confirmedCount})`, `الفواتير المربوطة (${rec.confirmedCount})`), value: rec.confirmedTotal == null ? L('n/a', 'غير متاح') : sar(rec.confirmedTotal), note: L('each invoice counted once', 'كل فاتورة تُحتسب مرة') },
        { label: L('Difference (order − linked)', 'الفرق (الأمر − المربوط)'), value: rec.difference == null ? '—' : sar(rec.difference), tone: rec.state === 'short' || rec.state === 'over' ? 'bad' : undefined, note: L('reported, never forced', 'يُعرض ولا يُفرض') }
      ]} />
      {msg && <div className={`rv-callout ${msg.ok ? '' : 'rv-callout--bad'}`} role="status" aria-live="polite">{msg.text}</div>}

      <Section id="invoices" title={L('Linked invoices', 'الفواتير المربوطة')} count={links.filter((l) => l.status === 'confirmed' || l.status === 'candidate').length}>
        {links.filter((l) => l.status !== 'rejected').length ? (
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Linked invoices', 'الفواتير المربوطة')}>
            <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th className="num">{L('Invoice amount', 'مبلغ الفاتورة')}</th><th>{L('Payment status', 'حالة السداد')}</th><th>{L('Link', 'الرابط')}</th><th style={{ minWidth: 190 }}>{L('Action', 'إجراء')}</th></tr></thead>
            <tbody>{links.filter((l) => l.status !== 'rejected').map((l) => {
              const k = byInvoice.get(l.invoiceId); const snap = l.snapshot || {};
              return (
                <tr key={l.invoiceId}>
                  <td><RecordLink to={invoicePath(l.invoiceId)} dir="ltr"><b>{l.invoiceId}</b></RecordLink> <RecordLink className="rv-link" to={invoicePath(l.invoiceId)}>{L('View the invoice', 'عرض الفاتورة')}</RecordLink>
                    <div className="muted" style={{ fontSize: 12 }}>{B(SOURCE_LABEL[k?.source || snap.source] || { en: k?.source || snap.source || '', ar: k?.source || snap.source || '' })} · <span dir="auto">{B(k?.payerName || snap.payerName)}</span></div>
                    {k?.enfConflict && <div><span className="rv-tag rv-tag--bad">{L('source/enforcement conflict — review required', 'تعارض بين المصدر والإنفاذ — يلزم مراجعة')}</span></div>}</td>
                  <td className="num" dir="ltr">{sar(k?.grossAmount ?? l.gross ?? 0)}</td>
                  <td>{k ? <PayStatusChip status={k.paymentStatus} /> : '—'}{k && <div className="muted" style={{ fontSize: 12 }} dir="ltr">{L('remaining', 'المتبقي')} {sar(k.outstanding)}</div>}</td>
                  <td><Chip def={LINK_STATUS_LABEL[l.status] || LINK_STATUS_LABEL.rejected} /><div className="muted" style={{ fontSize: 11 }}>{B(ORIGIN_LABEL[l.origin] || ORIGIN_LABEL.sanad_structured)}</div></td>
                  <td>{l.status === 'confirmed' ? (<>{noteInput(`rm-${l.invoiceId}`, L('Reason to withdraw (required)', 'سبب السحب (مطلوب)'))}<button type="button" className="btn btn-sm" disabled={!rev.canReview} onClick={() => withdraw(l.invoiceId)}>{L('Withdraw link…', 'سحب الرابط…')}</button></>) : <span className="muted">{L('awaiting confirmation', 'بانتظار التأكيد')}</span>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="muted">{L('No invoice is linked yet. Use the steps below.', 'لا فاتورة مربوطة بعد. استخدم الخطوات أدناه.')}</div>}
        <div className="rp-limit">{L('Only a confirmed link reflects this order’s status on the invoice; payment status is separate. Closing an order does not erase the referral and does not mean payment; withdrawing one link never removes another order’s effect.', 'الرابط المؤكد وحده يعكس حالة هذا الأمر على الفاتورة؛ وحالة السداد منفصلة. إغلاق الأمر لا يمحو الإحالة ولا يعني السداد؛ وسحب رابط لا يزيل أثر أمر آخر.')}</div>
      </Section>

      <OrderJourney c={c} rev={rev} rows={rows} loading={loading} error={error} onRetry={() => setTick((x) => x + 1)} comp={comp} inputFor={inputFor} others={others} onMessage={setMsg} setTick={setTick} />

      <Section id="details-sources" secondary title={L('Sources and extraction evidence', 'المصادر وأدلة الاستخراج')}>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Sources examined', 'المصادر المفحوصة')}>
          <thead><tr><th>{L('Source', 'المصدر')}</th><th>{L('State', 'الحالة')}</th><th className="num">{L('Invoice references found', 'مراجع فواتير وُجدت')}</th></tr></thead>
          <tbody>
            <tr><td>{L('Sanad structured invoice-reference field', 'حقل مراجع الفواتير المهيكل في سند')}</td><td>{srcs.structured ? L('read', 'قُرئ') : L('empty', 'فارغ')}</td><td className="num">{srcs.structured}</td></tr>
            <tr><td>{L('Sanad description (free text)', 'وصف سند (نص حر)')}</td><td>{srcs.hasDescription ? L('read', 'قُرئ') : L('empty', 'فارغ')}</td><td className="num">{srcs.description}</td></tr>
            <tr><td>{L('Sanad notes (free text)', 'ملاحظات سند (نص حر)')}</td><td>{srcs.hasNotes ? L('read', 'قُرئت') : L('empty', 'فارغة')}</td><td className="num">{srcs.notes}</td></tr>
            <tr><td>{L('Attachments listed by Sanad', 'مرفقات تدرجها سند')}</td><td>{srcs.attachmentsListed ? <span className="rv-tag rv-tag--warn">{L(`${srcs.attachmentsListed} listed — not retrievable here; add the files by hand`, `${srcs.attachmentsListed} مدرجة — لا يمكن جلبها هنا؛ أضف الملفات يدوياً`)}</span> : L('none listed', 'لا مرفقات مدرجة')}{(c.attachments || []).length > 0 && <div className="muted" style={{ fontSize: 12 }} dir="ltr">{(c.attachments || []).map((a) => a.name || a).join(' · ')}</div>}</td><td className="num">—</td></tr>
            {docs.map((d) => { const pgs = d.extraction?.pages || []; const unreadN = pgs.filter((p) => p.needsOcr && !(d.ocrCovered || []).includes(p.page)).length; return (
              <tr key={d.id}><td dir="ltr">{d.kind === 'manual' ? L('Typed references', 'مراجع مُدخلة') : d.name}<div className="muted" style={{ fontSize: 12 }}>{d.kind === 'manual' ? B(METHOD_NOTE.manual_entry) : B(FORMAT_LABEL[d.extraction?.format || d.format || 'pdf'] || FORMAT_LABEL.unknown)}{d.extraction?.method === 'ocr_simulated' ? <> · <b>{B(SIM_LABEL)}</b></> : null}</div></td>
                <td>{!d.extraction && d.kind !== 'manual' ? <span className="rv-tag">{L('not analysed yet', 'لم يُحلَّل بعد')}</span> : unreadN ? <span className="rv-tag rv-tag--bad">{L(`${unreadN} of ${pgs.length} page(s) NOT read`, `${unreadN} من ${pgs.length} صفحة لم تُقرأ`)}</span> : <span className="rv-tag rv-tag--ok">{d.extraction?.exactPages === false ? L('read (paragraphs and tables)', 'قُرئ (فقرات وجداول)') : L(`${pgs.length} page(s) read`, `قُرئت ${pgs.length} صفحة`)}</span>}{d.extraction?.tables > 0 && <span className="muted"> · {d.extraction.tables} {L('table(s)', 'جدول')}</span>}</td>
                <td className="num">{d.extraction?.refs?.length || 0}</td></tr>); })}
            {!docs.length && <tr><td>{L('Documents added to this order', 'مستندات أُضيفت إلى هذا الأمر')}</td><td className="muted">{L('none yet', 'لا شيء بعد')}</td><td className="num">—</td></tr>}
          </tbody>
        </table></div>
        <OrderDocuments order={c} rev={rev} onMessage={setMsg} focus={null} tick={tick} onChanged={() => setTick((x) => x + 1)} />
        {docs.some((d) => files[d.id] === false) && <div className="rp-limit rp-limit--warn" role="status">{L('Some original files are unavailable in this browser (for example after restoring a backup: backups keep the extracted evidence, provenance and link history but NOT the document files). Only extracted evidence remains for them; add the file again to view it — its identity (SHA-256) is checked first.', 'بعض الملفات الأصلية غير متاحة في هذا المتصفح (مثلاً بعد استعادة نسخة احتياطية: تحتفظ النسخ بالأدلة المستخرجة والمصدر وسجل الروابط ولا تتضمن ملفات المستندات). لم يبقَ لها إلا الدليل المستخرج؛ أضف الملف مرة أخرى لعرضه — وتُفحص بصمته (SHA-256) أولاً.')}</div>}
      </Section>

      <Section id="details-complete" secondary title={L('Completeness details (three separate states)', 'تفاصيل الاكتمال (ثلاث حالات منفصلة)')}>
        <div className="rp-compl" role="group" aria-label={L('Three completeness states — kept separate', 'ثلاث حالات اكتمال — منفصلة')}>
          <div>
            <h3>{L('1 · Reference matching', '1 · مطابقة المراجع')}</h3>
            <div className={`rp-compl__v ${tone(comp.references.state === 'complete')}`}>{comp.references.state === 'complete' ? '✓ ' : '! '}{stateWord(comp.references.state)}</div>
            <div className="rp-compl__d">{comp.references.state === 'none' ? L('Invoice numbers not identified — needs review. This is not “no related invoices”.', 'لم يتم تحديد أرقام الفواتير — تحتاج مراجعة. وهذا لا يعني «لا فواتير مرتبطة».') : L(`${comp.references.total} reference(s) found · ${comp.references.confirmedLinks} confirmed link(s)${comp.references.unresolved ? ` · ${comp.references.unresolved} unresolved` : ''}${comp.references.proposed ? ` · ${comp.references.proposed} proposal(s) to confirm` : ''}.`, `${comp.references.total} مرجع · ${comp.references.confirmedLinks} رابط مؤكد${comp.references.unresolved ? ` · ${comp.references.unresolved} غير محسوم` : ''}${comp.references.proposed ? ` · ${comp.references.proposed} اقتراح للتأكيد` : ''}.`)}</div>
            <div className="rp-compl__d">{L('“Complete” means every reference found is decided; it does not prove every covered invoice was found. Does not depend on the amount.', '«مكتملة» تعني أن كل مرجع وُجد قد حُسم؛ ولا تثبت أن كل فاتورة مشمولة وُجدت. ولا تعتمد على المبلغ.')}</div>
          </div>
          <div>
            <h3>{L('2 · Document extraction', '2 · استخراج المستند')}</h3>
            <div className={`rp-compl__v ${tone(comp.extraction.state === 'complete')}`}>{comp.extraction.state === 'complete' ? '✓ ' : '! '}{stateWord(comp.extraction.state)}</div>
            <div className="rp-compl__d">{comp.extraction.state === 'no_document' ? L('No order document attached.', 'لا مستند مرفق بالأمر.') : comp.extraction.state === 'incomplete' ? (comp.extraction.unreadPages ? L(`${comp.extraction.unreadPages} page(s) not read.`, `${comp.extraction.unreadPages} صفحة لم تُقرأ.`) : L(`${comp.extraction.attachmentsPending} listed attachment(s) not added.`, `${comp.extraction.attachmentsPending} مرفق مدرج لم يُضَف.`)) : L(`Every page of ${comp.extraction.documents} document(s) has text.`, `لكل صفحات ${comp.extraction.documents} مستند نص.`)}</div>
            {comp.extraction.suppliedPages > 0 && <div className="rp-compl__d rp-warn">{L(`${comp.extraction.suppliedPages} page(s) rely on supplied text (imported external OCR or typed) — its quality is NOT verified by this system.`, `${comp.extraction.suppliedPages} صفحة تعتمد على نص مُزوَّد (OCR خارجي مستورد أو مُدخل يدوياً) — ولا يتحقق هذا النظام من جودته.`)}</div>}
          </div>
          <div>
            <h3>{L('3 · Financial reconciliation', '3 · التسوية المالية')}</h3>
            <div className={`rp-compl__v ${tone(comp.finance.state === 'reconciled')}`}>{comp.finance.state === 'reconciled' ? '✓ ' : '! '}{stateWord(comp.finance.state)}</div>
            <div className="rp-compl__d">{comp.finance.state === 'reconciled' ? L('Linked invoices add up to the order amount.', 'الفواتير المربوطة تساوي مبلغ الأمر.') : comp.finance.difference != null && (comp.finance.state === 'short' || comp.finance.state === 'over') ? L(`${sar(Math.abs(comp.finance.difference))} ${comp.finance.state === 'short' ? 'of the order is not covered by a linked invoice' : 'more than the order is covered'} — reported, never forced to match.`, `${sar(Math.abs(comp.finance.difference))} ${comp.finance.state === 'short' ? 'من الأمر غير مغطى بفاتورة مربوطة' : 'أكثر من الأمر مغطى'} — يُعرض ولا يُفرض تطابقه.`) : L('No linked invoice to compare yet.', 'لا فاتورة مربوطة للمقارنة بعد.')}</div>
            {rec.proposedCount > 0 && <div className="rp-compl__d">{L('Difference if every proposal were confirmed', 'الفرق لو أُكِّدت كل الاقتراحات')}: <span dir="ltr">{rec.differenceIfProposedConfirmed == null ? '—' : sar(rec.differenceIfProposedConfirmed)}</span></div>}
          </div>
        </div>
        {(rec.state === 'short' || rec.state === 'over') && <div className="rp-limit rp-limit--warn">{rec.state === 'short' ? L('The linked invoices cover LESS than the order: look for further references in the documents or in Sanad — never force a match to make the totals agree.', 'الفواتير المربوطة تغطي أقل من الأمر: ابحث عن مراجع إضافية في المستندات أو في سند — ولا تفرض مطابقة لجعل المجاميع تتفق.') : L('The linked invoices cover MORE than the order: check for a wrong or duplicate link.', 'الفواتير المربوطة تغطي أكثر من الأمر: افحص رابطاً خاطئاً أو مكرراً.')}</div>}
        {rec.state === 'short' && c.debtorIdx != null && (
          <div><button type="button" className="btn btn-sm" onClick={loadDebtor}>{L('Show other open invoices of this debtor (investigation only)', 'عرض فواتير مفتوحة أخرى لهذا المدين (للتحقق فقط)')}</button>
            {debtor && (<div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <div className="rp-limit">{L('These are NOT proposed matches. An amount alone never links an invoice.', 'هذه ليست مطابقات مقترحة. فالمبلغ وحده لا يربط فاتورة.')}</div>
              <div className="rp-tablewrap" tabIndex={0}><table><thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Type', 'النوع')}</th><th className="num">{L('Invoice amount', 'مبلغ الفاتورة')}</th><th className="num">{L('Remaining', 'المتبقي')}</th><th>{L('Payment status', 'حالة السداد')}</th></tr></thead>
                <tbody>{debtor.map((d) => <tr key={d.invoiceId}><td dir="ltr"><RecordLink to={invoicePath(d.invoiceId)}>{d.invoiceId}</RecordLink></td><td>{B(SOURCE_LABEL[d.source] || { en: d.source, ar: d.source })}</td><td className="num" dir="ltr">{sar(d.grossAmount)}</td><td className="num" dir="ltr">{sar(d.outstanding)}</td><td><PayStatusChip status={d.paymentStatus} /></td></tr>)}{!debtor.length && <tr><td colSpan={5} className="muted">{L('No other open invoices.', 'لا فواتير مفتوحة أخرى.')}</td></tr>}</tbody></table></div>
            </div>)}
          </div>
        )}
        {otherRefs.length > 0 && (
          <Section id="others" secondary title={L('Other numbers found — not invoice references, never matched', 'أرقام أخرى وُجدت — ليست مراجع فواتير ولا تُطابَق')} count={otherRefs.length}>
            <div className="rp-tablewrap" tabIndex={0}><table>
              <thead><tr><th>{L('Number', 'الرقم')}</th><th>{L('Read as', 'قُرئ على أنه')}</th><th>{L('Where', 'أين')}</th></tr></thead>
              <tbody>{otherRefs.map((o, i) => <tr key={i}><td dir="ltr">{o.value}</td><td>{B(KIND_LABEL[o.kind] || { en: o.kind, ar: o.kind })}{o.label && o.label !== 'pattern' && o.label !== 'unlabelled' ? <span className="muted"> · {o.label}</span> : null}</td><td style={{ fontSize: 12 }} dir="ltr">{o.docName ? `${o.docName}${(o.locs || []).length ? ` · ${o.locs.map((x) => locLabel(x, ar)).join(', ')}` : (o.pages || []).length ? ` · p.${o.pages.join(',')}` : ''}` : ''}{o.snippet ? <div className="muted">“{o.snippet}”</div> : null}</td></tr>)}</tbody>
            </table></div>
          </Section>
        )}
      </Section>

      {cmentions.length > 0 && (
        <Section id="contract-refs" secondary title={L('Contract references', 'مراجع العقود')} count={cmentions.length}
          note={<div className="rp-limit">{L('Three different facts are kept apart: a contract MENTIONED in the order, a contract DIRECTLY referred (Sanad’s structured field, or a document that EXPLICITLY states the contract itself is referred and that a reviewer confirmed), and a contract some of whose INVOICES are referred (on the contract page). A mention — even in a document, even of an existing contract — is never a direct referral, and a directly referred contract never makes all its invoices referred.', 'ثلاث حقائق مختلفة تُفصل: عقد «مذكور» في الأمر، وعقد «محال مباشرة» (حقل سند المهيكل، أو مستند ينص صراحة على إحالة العقد نفسه وأكّده مراجع)، وعقد «بعض فواتيره محالة» (في صفحة العقد). والذكر — ولو في مستند ولو لعقد موجود — ليس إحالة مباشرة، والعقد المحال مباشرة لا يجعل كل فواتيره محالة.')}</div>}>
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Contract references', 'مراجع العقود')}>
            <thead><tr><th>{L('Contract', 'العقد')}</th><th>{L('Found in', 'وُجد في')}</th><th>{L('Status', 'الحالة')}</th><th style={{ minWidth: 260 }}>{L('Evidence of a direct referral', 'دليل الإحالة المباشرة')}</th></tr></thead>
            <tbody>{cmentions.map((m) => { const exists = m.structured || contractExists(m.contractNo); const docOrigins = m.origins.filter((o) => o.docId); const f = cf[m.contractNo] || {}; const picked = docOrigins[f.at ?? 0]; return (
              <tr key={m.contractNo}>
                <td>{exists ? <RecordLink to={contractPath(m.contractNo)} dir="ltr"><b>{m.contractNo}</b></RecordLink> : <b dir="ltr">{m.contractNo}</b>}{!exists && resolved && <div className="rv-tag rv-tag--bad">{L('no such contract in the system', 'لا عقد بهذا الرقم في النظام')}</div>}</td>
                <td style={{ fontSize: 12 }}>{m.origins.map((o, i) => <div key={i}>{B(ORIGIN_LABEL[o.type] || { en: o.type, ar: o.type })}{o.docName ? <span dir="ltr"> · {o.docName}</span> : null}{o.locs?.length ? <> · {o.locs.map((x) => locLabel(x, ar)).join('، ')}</> : o.pages?.length ? <> · {L('page', 'صفحة')} {o.pages.join(', ')}</> : null}{o.snippet ? <div className="muted" dir="ltr">“{o.snippet}”</div> : null}</div>)}</td>
                <td>{m.status === 'supported_by_source' && <span className="rv-tag rv-tag--ok">{L('Directly referred — Sanad structured field', 'محال مباشرة — حقل سند المهيكل')}</span>}{m.status === 'confirmed_by_review' && <span className="rv-tag rv-tag--ok">{L('Directly referred — explicit statement confirmed by review', 'محال مباشرة — نص صريح أكّدته المراجعة')}</span>}{m.status === 'mentioned' && <span className="rv-tag rv-tag--warn">{L('Mentioned only — not a direct referral', 'مذكور فقط — ليس إحالة مباشرة')}</span>}{m.status === 'rejected' && <span className="rv-tag">{L('Mention rejected by review', 'رفضت المراجعة هذا الذكر')}</span>}{m.review && <div className="muted" style={{ fontSize: 11 }}>{m.review.by} · {fmtRiyadh(m.review.at)}{m.review.note ? ` · “${m.review.note}”` : ''}</div>}</td>
                <td style={{ fontSize: 12 }}>
                  {m.status === 'confirmed_by_review' && m.review?.evidence && <div>{L('Evidence', 'الدليل')}: <span dir="ltr">{m.review.evidence.docName}</span>{m.review.evidence.location ? ` · ${m.review.evidence.location}` : ''}<div className="muted" dir="auto">“{m.review.evidence.quote}”</div></div>}
                  {m.status === 'mentioned' && rev.canReview ? (docOrigins.length && exists ? (<div style={{ display: 'grid', gap: 5 }}>
                    <label>{L('Document location', 'موضع المستند')}<select className="input" value={f.at ?? 0} onChange={(e) => setCf((x) => ({ ...x, [m.contractNo]: { ...f, at: Number(e.target.value) } }))}>{docOrigins.map((o, i) => <option key={i} value={i}>{o.docName}{o.locs?.length ? ` — ${o.locs.map((x) => locLabel(x, ar)).join(', ')}` : o.pages?.length ? ` — ${L('page', 'صفحة')} ${o.pages.join(',')}` : ''}</option>)}</select></label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}><input type="checkbox" checked={!!f.explicit} onChange={(e) => setCf((x) => ({ ...x, [m.contractNo]: { ...f, explicit: e.target.checked } }))} /> <span>{L('The document EXPLICITLY states that the contract itself is referred to enforcement (it does not merely mention it)', 'المستند ينص صراحة على أن العقد نفسه محال إلى التنفيذ (وليس مجرد ذكره)')}</span></label>
                    <label>{L('The statement, as written in the document', 'النص كما ورد في المستند')}<input className="input" dir="auto" value={f.quote || ''} onChange={(e) => setCf((x) => ({ ...x, [m.contractNo]: { ...f, quote: e.target.value } }))} /></label>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-sm btn-primary" disabled={!f.explicit || String(f.quote || '').trim().length < 5} onClick={() => reviewContract(m, 'confirmed', { type: picked.type, docId: picked.docId, docName: picked.docName, location: picked.locs?.length ? picked.locs.map((x) => locLabel(x, ar)).join(', ') : picked.pages?.length ? `${L('page', 'صفحة')} ${picked.pages.join(',')}` : null, statedExplicitly: !!f.explicit, quote: String(f.quote || '').trim() }, exists)}>{L('Confirm direct referral', 'تأكيد الإحالة المباشرة')}</button>
                      <button type="button" className="btn btn-sm" onClick={() => reviewContract(m, 'rejected', null, exists)}>{L('Not a referral', 'ليست إحالة')}</button>
                    </div></div>) : (<div style={{ display: 'grid', gap: 4 }}><span className="muted">{!exists ? L('The contract does not exist in the system, so it cannot be confirmed.', 'العقد غير موجود في النظام فلا يمكن تأكيده.') : L('Needs explicit evidence: a mention in the description cannot be confirmed; a document that explicitly states the contract itself is referred is required.', 'يلزم دليل صريح: لا يمكن تأكيد ذكر في الوصف؛ ويلزم مستند ينص صراحة على إحالة العقد نفسه.')}</span>
                    <div><button type="button" className="btn btn-sm" onClick={() => reviewContract(m, 'rejected', null, exists)}>{L('Not a referral', 'ليست إحالة')}</button></div></div>)) : null}
                </td>
              </tr>); })}</tbody>
          </table></div>
        </Section>
      )}

      <Section id="facts" secondary title={L('Sanad source fields (the enforcement request)', 'حقول المصدر (طلب التنفيذ في سند)')} count={SOURCE_FIELDS.length}
        note={<div className="rp-limit">{L('Every column of the Sanad extract, as the demo case carries it (synthetic values; column names as in the source). One row of the extract = one enforcement request. The extract has NO debtor name or identity — only the debtor type — and its invoice-number column is almost always empty: invoice numbers are mostly in the description, which is read in full.', 'كل أعمدة ملف سند كما تحملها الحالة التجريبية (قيم اصطناعية؛ وأسماء الأعمدة كما في المصدر). صف واحد في الملف = طلب تنفيذ واحد. ولا يحمل الملف اسم المنفذ ضده ولا هويته — بل نوعه فقط — وعمود رقم الفاتورة فارغ في الغالب: وأرقام الفواتير في الوصف غالباً، ويُقرأ كاملاً.')}</div>}>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Source fields', 'حقول المصدر')}>
          <thead><tr><th>{L('Field', 'الحقل')}</th><th>{L('Value', 'القيمة')}</th><th>{L('Data quality / meaning', 'جودة البيانات / المعنى')}</th></tr></thead>
          <tbody>{SOURCE_FIELDS.map((f) => { const raw = c.source?.[`${f.key}Raw`]; const v = f.key === 'amount' ? sar(c.amount) : f.key === 'amanah' ? c.amanahEn : f.key === 'description' ? [c.description, c.notes].filter(Boolean).join('\n') : c.source?.[f.key]; const bad = raw && isCorruptedNumber(raw);
            return (<tr key={f.key}>
              <td><b>{ar ? f.ar : f.en}</b><div className="muted" style={{ fontSize: 11 }} dir="rtl">{f.col}</div></td>
              <td dir={f.key === 'description' || f.key === 'amountWords' || f.key === 'employeeName' || f.key === 'statusText' || f.key === 'debtorType' || f.key === 'executionType' || f.key === 'municipality' ? 'auto' : 'ltr'} style={{ overflowWrap: 'anywhere', maxWidth: 420, whiteSpace: f.key === 'description' ? 'pre-wrap' : undefined }}>
                {bad ? <><span className="rv-tag rv-tag--bad">{raw}</span> <span className="muted" style={{ fontSize: 12 }}>{L('as received (scientific notation); the original digits are lost', 'كما وصل (صيغة علمية)؛ الأرقام الأصلية مفقودة')}</span><div className="muted" style={{ fontSize: 11 }} dir="ltr">{L('demo’s underlying value', 'القيمة الأصلية في العرض')}: {v}</div></>
                  : v ? (f.key === 'invoiceNo' && isCorruptedNumber(v) ? <span className="rv-tag rv-tag--bad">{v}</span> : String(v)) : <span className="muted">{f.key === 'municipality' ? L('empty in the source', 'فارغ في المصدر') : f.key === 'invoiceNo' ? L('empty (usual: the numbers are in the description)', 'فارغ (المعتاد: الأرقام في الوصف)') : '—'}</span>}</td>
              <td style={{ fontSize: 12 }} className="muted">{B(f.note)}{f.key === 'statusText' && c.sourceMeta?.provisionalClass && <div>{L('Provisional class', 'التصنيف المؤقت')}: <b>{{ open: L('open', 'مفتوح'), suspended: L('suspended', 'موقوف'), closed: L('closed', 'مغلق') }[c.sourceMeta.provisionalClass]}</b> ({c.sourceMeta.classBasis === 'stated' ? L('stated by the text', 'منصوص عليه في النص') : L('inferred — to be confirmed with Sanad', 'مستنتج — يلزم تأكيده مع سند')})</div>}</td>
            </tr>); })}
            <tr><td><b>{L('Debtor (name / identity)', 'المنفذ ضده (الاسم / الهوية)')}</b></td><td>{B(c.debtorName) || '—'}{c.debtorId ? <span className="muted" dir="ltr"> · {c.debtorId}</span> : null}</td><td className="muted" style={{ fontSize: 12 }}>{L('NOT in the Sanad extract — a demo value used to test payer conflicts. In practice the debtor appears only in the description or in documents.', 'غير موجود في ملف سند — قيمة تجريبية لاختبار تعارض الدافع. وعملياً يرد المنفذ ضده في الوصف أو المستندات فقط.')}</td></tr>
            <tr><td><b>{L('Demo reference', 'مرجع العرض')}</b></td><td dir="ltr">{c.enforceNum}</td><td className="muted" style={{ fontSize: 12 }}>{L('The key used by the demo’s links and addresses; the Sanad key is the enforcement request no.', 'المفتاح الذي تستعمله روابط العرض وعناوينه؛ ومفتاح سند هو رقم طلب التنفيذ.')}</td></tr>
            <tr><td><b>{L('Contract', 'العقد')}</b></td><td>{contracts.length ? contracts.map((no, i) => <span key={no}>{i ? ' · ' : ''}<RecordLink to={contractPath(no)} dir="ltr">{no}</RecordLink></span>) : L('none — this order is not tied to a contract (it covers invoices of any type)', 'لا عقد — هذا الأمر غير مرتبط بعقد (يشمل فواتير من أي نوع)')}</td><td className="muted" style={{ fontSize: 12 }}>{L('Listed only where the invoice record itself carries one or Sanad names the contract — never inferred.', 'يُسرد فقط حيث يحمل سجل الفاتورة عقداً أو تذكره سند — ولا يُستنتج.')}</td></tr>
          </tbody>
        </table></div>
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
