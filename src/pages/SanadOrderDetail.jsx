import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../utils/useAsync';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { fmtRiyadh } from '../data/clock';
import { MetricTile } from '../components/revenue/RevenueUI';
import OrderDocumentsPanel from '../components/revenue/OrderDocumentsPanel';
import {
  MatchStateBadge, OrderStatusChip, PayStatusChip, Chip, IntegrationNotice, LINK_STATUS_LABEL, CONFLICT_LABEL, KIND_LABEL, REASON_LABEL, SOURCE_LABEL
} from '../components/revenue/EnforcementUI';
import {
  collectReferences, buildRows, orderMatchState, otherOrdersByInvoice, orderStatusOf, needsNote, isInvoiceKind, ORIGIN_LABEL, refKey
} from '../data/orderMatching';

const ERR = {
  no_permission: { en: 'Read-only role: you cannot change links.', ar: 'دور للقراءة فقط: لا يمكنك تغيير الروابط.' },
  note_required: { en: 'A written reason is required (conflict, ambiguity, or withdrawing a confirmed link).', ar: 'يلزم سبب مكتوب (تعارض أو التباس أو سحب رابط مؤكد).' },
  not_accessible: { en: 'This order is outside your organisation’s access.', ar: 'هذا الأمر خارج صلاحيات جهتك.' },
  use_remove: { en: 'A confirmed link must be withdrawn (with a reason), not rejected.', ar: 'الرابط المؤكد يُسحب (مع سبب) ولا يُرفض.' }
};
const ACTION_LABEL = {
  proposed: { en: 'Link proposed (no effect yet)', ar: 'اقتُرح رابط (بلا أثر بعد)' }, confirmed: { en: 'Link confirmed — order status reflected on the invoice', ar: 'أُكِّد الرابط — عُكست حالة الأمر على الفاتورة' },
  rejected: { en: 'Link rejected', ar: 'رُفض الرابط' }, removed: { en: 'Confirmed link withdrawn — effect removed from the invoice', ar: 'سُحب رابط مؤكد — أُزيل أثره عن الفاتورة' },
  document_added: { en: 'Document added', ar: 'أُضيف مستند' }, extraction_updated: { en: 'Document re-read', ar: 'أُعيدت قراءة المستند' }, supplemental_extraction: { en: 'Text supplied for unread pages', ar: 'زُوِّد نص للصفحات غير المقروءة' },
  reference_dismissed: { en: 'Reference set aside (not an invoice of this order)', ar: 'استُبعد مرجع (ليس فاتورة لهذا الأمر)' }, order_status_changed: { en: 'Order status changed in Sanad', ar: 'تغيّرت حالة الأمر في سند' },
  candidates_proposed: { en: 'Candidates proposed (earlier version)', ar: 'اقتُرح مرشحون (إصدار سابق)' }
};
const originOf = (row) => (row.origins.find((o) => o.type === 'sanad_structured') || row.origins[0])?.type || 'manual_selection';

export default function SanadOrderDetail() {
  const { enforceNum } = useParams();
  const nav = useNavigate();
  const rev = useRevenue();
  const { L, B, ar, sar } = useL();
  const c = rev.cases.find((x) => x.enforceNum === enforceNum);
  const [msg, setMsg] = useState(null);
  const [notes, setNotes] = useState({});
  const [debtor, setDebtor] = useState(null);

  const docs = c?.docs || [];
  const refs = useMemo(() => (c ? collectReferences(c, docs) : []), [c, docs]);
  const links = c?.links || [];
  const asked = useMemo(() => {
    const out = refs.filter((r) => isInvoiceKind(r.kind)).map((r) => ({ kind: r.kind, value: r.value }));
    const have = new Set(out.filter((r) => r.kind === 'invoice_no').map((r) => r.value.toUpperCase()));
    for (const l of links) if (!have.has(l.invoiceId.toUpperCase())) out.push({ kind: 'invoice_id_exact', value: l.invoiceId });
    return out;
  }, [refs, links]);
  const askKey = asked.map((r) => `${r.kind}:${r.value}`).join('|');
  const { data: resolved, loading, error } = useAsync(() => (asked.length ? rev.enforcement.resolve(asked) : Promise.resolve({ results: [] })), [askKey, rev.dataVersion]);

  const others = useMemo(() => otherOrdersByInvoice(rev.cases, enforceNum), [rev.cases, enforceNum]);
  const mismatched = useMemo(() => new Set(docs.filter((d) => d.extraction?.orderNumberMismatch).map((d) => d.id)), [docs]);
  const rows = useMemo(() => (c && resolved ? buildRows(c, refs.filter((r) => isInvoiceKind(r.kind)), resolved.results, links, others, mismatched) : []), [c, resolved, refs, links, others, mismatched]);
  const byInvoice = useMemo(() => {
    const m = new Map();
    for (const r of resolved?.results || []) for (const k of r.candidates) if (!m.has(k.invoiceId)) m.set(k.invoiceId, k);
    return m;
  }, [resolved]);

  if (!c) {
    return (
      <div className="rv-page">
        <div className="page-head"><h1 className="page-title">{L('Enforcement order not found', 'أمر الإنفاذ غير موجود')}</h1></div>
        <Link className="btn btn-sm" to="/sanad-orders">{L('Back to the enforcement orders', 'العودة إلى أوامر الإنفاذ')}</Link>
      </div>
    );
  }

  const status = orderStatusOf(c);
  const ms = orderMatchState(c); const rec = ms.reconciliation;
  const otherRefs = [...docs.flatMap((d) => (d.extraction?.others || []).map((o) => ({ ...o, docName: d.name }))), ...refs.filter((r) => !isInvoiceKind(r.kind)).map((r) => ({ kind: r.kind, value: r.value, pages: [], docName: null }))];
  const say = (res, okEn, okAr) => setMsg(res.ok ? { ok: true, text: L(okEn, okAr) } : { ok: false, text: ERR[res.error] ? B(ERR[res.error]) : L('Could not record the change.', 'تعذّر تسجيل التغيير.') });
  const inputFor = (row, cand) => ({
    invoiceId: cand.invoiceId, origin: row.status === 'ambiguous' ? 'manual_selection' : originOf(row), gross: cand.grossAmount, // an ambiguous reference is settled by a person's choice, and is recorded as such
    snapshot: { source: cand.source, payerName: cand.payerName, payerId: cand.payerId, issueDate: cand.issueDate, amanahEn: cand.amanahEn },
    evidence: row.origins.map((o) => ({ refKind: row.kind, refValue: row.value, origin: o.type, docId: o.docId || null, docName: o.docName || null, pages: o.pages || null, snippet: o.snippet || null })),
    conflicts: row.conflicts[cand.invoiceId] || []
  });
  const confirm = (row, cand) => { const inp = inputFor(row, cand); const note = notes[cand.invoiceId] || ''; say(rev.enforcement.confirm(c.enforceNum, cand.invoiceId, { note, input: inp }), 'Link confirmed. The order status now shows on the invoice; its payment status is unchanged.', 'أُكِّد الرابط. تظهر حالة الأمر الآن على الفاتورة؛ وحالة السداد لم تتغير.'); };
  const propose = (row, cand) => say(rev.enforcement.propose(c.enforceNum, inputFor(row, cand)), 'Saved as a proposal. It has no effect on the invoice until you confirm it.', 'حُفظ كاقتراح. لا أثر له على الفاتورة حتى تؤكده.');
  const reject = (row, cand) => say(rev.enforcement.reject(c.enforceNum, cand.invoiceId, { note: notes[cand.invoiceId] || '', input: inputFor(row, cand) }), 'Link rejected (kept in the history).', 'رُفض الرابط (محفوظ في السجل).');
  const removeConfirmed = (invoiceId) => say(rev.enforcement.remove(c.enforceNum, invoiceId, { note: notes[`rm-${invoiceId}`] || '', base: links.find((x) => x.invoiceId === invoiceId && x.ledgerStatus == null) || null }), 'Confirmed link withdrawn; the invoice no longer carries this order.', 'سُحب الرابط المؤكد؛ لم تعد الفاتورة تحمل هذا الأمر.');
  const proposeAll = () => {
    let n = 0;
    for (const row of rows) {
      if (row.status !== 'matched' || row.link || row.rejected) continue;
      const cand = row.candidates[0]; if (needsNote(row.conflicts[cand.invoiceId])) continue; // conflicts are never swept in bulk
      if (rev.enforcement.propose(c.enforceNum, inputFor(row, cand)).ok) n += 1;
    }
    setMsg({ ok: true, text: L(`${n} proposal(s) saved. They have no effect on any invoice until confirmed.`, `حُفظ ${n} اقتراح. لا أثر له على أي فاتورة حتى يُؤكَّد.`) });
  };
  const loadDebtor = async () => { const r = await rev.enforcement.debtorInvoices(c.debtorIdx, links.filter((l) => l.status !== 'rejected').map((l) => l.invoiceId)); setDebtor(r.invoices); };
  const dismiss = (row) => say(rev.enforcement.dismiss(c.enforceNum, row.key, { note: notes[row.key] || '' }), 'Reference set aside (kept in the history).', 'استُبعد المرجع (محفوظ في السجل).');

  const noteInput = (id, required) => (
    <input key={id} className="input" style={{ width: '100%', padding: '5px 8px', margin: '4px 0' }} aria-label={L('Reason', 'السبب')} placeholder={required ? L('Reason (required)', 'السبب (مطلوب)') : L('Reason (optional)', 'السبب (اختياري)')} value={notes[id] || ''} onChange={(e) => setNotes({ ...notes, [id]: e.target.value })} disabled={!rev.canReview} />
  );

  const proposable = rows.filter((r) => r.status === 'matched' && !r.link && !r.rejected && !needsNote(r.conflicts[r.candidates[0]?.invoiceId])).length;
  const stateReasonText = ms.reasons.map((r) => B(REASON_LABEL[r])).join(' · ');

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title" dir="ltr">{c.enforceNum}</h1>
          <div className="page-sub">{c.system === 'sanad' ? 'Sanad' : c.system === 'white_lands' ? L('White-lands file', 'ملف الأراضي البيضاء') : 'Efaa'} · {c.amanahEn} · {L('opened', 'فُتح')} <span dir="ltr">{c.openedDate}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/sanad-orders')}>{L('All orders', 'كل الأوامر')}</button>
        </div>
      </div>

      <IntegrationNotice compact />

      {/* the order, alongside what was matched to it */}
      <div className="card card-pad" aria-label={L('The order', 'الأمر')}>
        <h2 className="rv-sec-title">{L('1 · The order and the reconciliation of its invoices', '1 · الأمر وتسوية فواتيره')}</h2>
        <div className="rv-kvgrid" style={{ marginBottom: 10 }}>
          <div className="rv-kv"><span className="rv-kv__k">{L('Order status (Sanad)', 'حالة الأمر (سند)')}</span><span className="rv-kv__v"><OrderStatusChip status={status} /></span></div>
          <div className="rv-kv"><span className="rv-kv__k">{L('Debtor', 'المدين')}</span><span className="rv-kv__v" dir="auto">{B(c.debtorName) || '—'}{c.debtorId ? <span className="muted" dir="ltr"> · {c.debtorId}</span> : null}</span></div>
          <div className="rv-kv"><span className="rv-kv__k">{L('Order amount', 'مبلغ الأمر')}</span><span className="rv-kv__v" dir="ltr">{sar(c.amount)}</span></div>
          {c.contractNo && <div className="rv-kv"><span className="rv-kv__k">{L('Contract (reference only)', 'العقد (مرجع فقط)')}</span><span className="rv-kv__v" dir="ltr">{c.contractNo}</span></div>}
          <div className="rv-kv"><span className="rv-kv__k">{L('Source', 'المصدر')}</span><span className="rv-kv__v">{c.feed === 'synthetic_demo' ? L('Sanad — synthetic demo feed', 'سند — تغذية تجريبية اصطناعية') : L('Hand-anchored demo case', 'حالة تجريبية مثبّتة يدوياً')}</span></div>
          <div className="rv-kv"><span className="rv-kv__k">{L('Invoice references from Sanad', 'مراجع الفواتير من سند')}</span><span className="rv-kv__v">{(c.refs || []).length ? (c.refs || []).map((r) => r.value).join(', ') : L('none supplied', 'لم تُزوَّد')}</span></div>
        </div>
        <div className="rv-tiles">
          <MetricTile label={L('Match state', 'حالة المطابقة')} value={<MatchStateBadge state={ms.state} />} sub={stateReasonText || (ms.state === 'matched' ? L('every reference accounted for and the amounts reconcile', 'كل المراجع محسومة والمبالغ متطابقة') : undefined)} />
          <MetricTile label={L('Order amount', 'مبلغ الأمر')} value={sar(c.amount)} />
          <MetricTile label={L(`Confirmed invoices (${rec.confirmedCount})`, `فواتير مؤكدة (${rec.confirmedCount})`)} value={rec.confirmedTotal == null ? L('n/a', 'غير متاح') : sar(rec.confirmedTotal)} sub={L('gross billed amount of the confirmed invoices', 'إجمالي المفوتر للفواتير المؤكدة')} />
          <MetricTile label={L(`Proposed, unconfirmed (${rec.proposedCount})`, `مقترحة غير مؤكدة (${rec.proposedCount})`)} value={rec.proposedTotal == null ? L('n/a', 'غير متاح') : sar(rec.proposedTotal)} sub={L('no effect until confirmed', 'بلا أثر حتى التأكيد')} />
          <MetricTile label={L('Difference (order − confirmed)', 'الفرق (الأمر − المؤكد)')} value={rec.difference == null ? '—' : sar(rec.difference)} tone={rec.state === 'short' || rec.state === 'over' ? 'warn' : undefined} sub={rec.state === 'short' ? L('invoices cover LESS than the order: look for further references — do not force a match', 'الفواتير تغطي أقل من الأمر: ابحث عن مراجع إضافية — ولا تفرض مطابقة') : rec.state === 'over' ? L('invoices cover MORE than the order: check for a wrong or duplicate link', 'الفواتير تغطي أكثر من الأمر: افحص رابطاً خاطئاً أو مكرراً') : rec.state === 'reconciled' ? L('reconciled', 'متطابق') : undefined} />
        </div>
        {(ms.state === 'partial' || ms.state === 'awaiting_review') && <div className="rv-callout rv-callout--warn" style={{ marginTop: 8 }} role="status"><b>{ms.state === 'partial' ? L('This order is only partly matched.', 'هذا الأمر مطابق جزئياً فقط.') : L('Nothing is confirmed yet.', 'لم يُؤكَّد شيء بعد.')}</b> {stateReasonText}. {rec.wouldReconcile ? L('Confirming the proposed links would reconcile the amount.', 'تأكيد الروابط المقترحة سيجعل المبلغ متطابقاً.') : ''}</div>}
        {rec.state === 'short' && c.debtorIdx != null && (
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-sm" onClick={loadDebtor}>{L('Show other open invoices of this debtor (for investigation only)', 'عرض فواتير مفتوحة أخرى لهذا المدين (للتحقق فقط)')}</button>
            {debtor && (
              <div style={{ marginTop: 8 }}>
                <div className="rv-callout" role="note">{L('These are NOT proposed matches. An amount alone never links an invoice. Use them to know where to look: a further reference in the order document, on a later page, or in Sanad’s data.', 'هذه ليست مطابقات مقترحة. فالمبلغ وحده لا يربط فاتورة. استعملها لمعرفة أين تبحث: مرجع إضافي في مستند الأمر أو في صفحة لاحقة أو في بيانات سند.')}</div>
                <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 0 }}>
                  <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Type', 'النوع')}</th><th className="num">{L('Gross', 'الإجمالي')}</th><th className="num">{L('Outstanding', 'المتبقي')}</th><th>{L('Payment status', 'حالة السداد')}</th></tr></thead>
                  <tbody>{debtor.map((d) => <tr key={d.invoiceId}><td dir="ltr"><Link to={`/invoices?id=${d.invoiceId}`}>{d.invoiceId}</Link></td><td>{B(SOURCE_LABEL[d.source] || { en: d.source, ar: d.source })}</td><td className="num" dir="ltr">{sar(d.grossAmount)}</td><td className="num" dir="ltr">{sar(d.outstanding)}</td><td><PayStatusChip status={d.paymentStatus} /></td></tr>)}
                    {!debtor.length && <tr><td colSpan={5} className="rv-empty">{L('No other open invoices for this debtor.', 'لا توجد فواتير مفتوحة أخرى لهذا المدين.')}</td></tr>}</tbody>
                </table></div>
              </div>
            )}
          </div>
        )}
      </div>

      {msg && <div className={`rv-callout ${msg.ok ? '' : 'rv-callout--bad'}`} role="status" aria-live="polite">{msg.text}</div>}

      <OrderDocumentsPanel order={c} rev={rev} onMessage={setMsg} />

      <div className="card card-pad">
        <h2 className="rv-sec-title">{L('3 · Invoice references found, and how each resolves', '3 · مراجع الفواتير الموجودة وكيف تُحسم')}</h2>
        <p className="rv-sec-sub">{L('Every reference from Sanad and from the document is listed — one number is never taken to be the whole list. A reference matches only an invoice number, SADAD number or violation number that exists in the system; order, contract, account and identity numbers are listed separately and never matched.', 'تُسرد كل المراجع من سند ومن المستند — ولا يُعدّ رقم واحد القائمة الكاملة. يطابق المرجع فقط رقم فاتورة أو رقم سداد أو رقم مخالفة موجوداً في النظام؛ أما أرقام الأوامر والعقود والحسابات والهويات فتُسرد منفصلة ولا تُطابَق.')}</p>
        {loading && !resolved && <div role="status" className="muted">{L('Matching the references…', 'جارٍ مطابقة المراجع…')}</div>}
        {error && <div className="rv-callout rv-callout--bad" role="alert">{L('The data service could not match the references.', 'تعذّر على خدمة البيانات مطابقة المراجع.')}</div>}
        {!rows.length && !loading && <div className="rv-empty">{L('No invoice reference yet — Sanad supplied none. Add the order PDF above (or supply the text of its pages).', 'لا يوجد مرجع فاتورة بعد — لم تزوّد سند بأي مرجع. أضف ملف PDF للأمر أعلاه (أو زوّد نص صفحاته).')}</div>}
        {proposable > 0 && rev.canReview && <div style={{ marginBottom: 8 }}><button type="button" className="btn btn-sm" onClick={proposeAll}>{L(`Save the ${proposable} clean match(es) as proposals`, `حفظ ${proposable} مطابقة سليمة كاقتراحات`)}</button> <span className="muted" style={{ fontSize: 12 }}>{L('Proposals have no effect on any invoice; matches with conflicts are never included.', 'الاقتراحات بلا أثر على أي فاتورة؛ ولا تُشمل المطابقات ذات التعارضات.')}</span></div>}
        {rows.length > 0 && (
          <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 900 }}>
            <thead><tr><th>{L('Reference', 'المرجع')}</th><th>{L('Found in', 'وُجد في')}</th><th>{L('Result', 'النتيجة')}</th><th>{L('Invoice(s)', 'الفاتورة / الفواتير')}</th><th style={{ minWidth: 230 }}>{L('Review', 'المراجعة')}</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.key}>
                <td><b dir="ltr">{row.value}</b><div className="muted" style={{ fontSize: 12 }}>{B(KIND_LABEL[row.kind] || { en: row.kind, ar: row.kind })}{row.normalized ? ` → ${row.normalized}` : ''}</div></td>
                <td style={{ fontSize: 12 }}>{row.origins.map((o, i) => <div key={i}>{B(ORIGIN_LABEL[o.type] || { en: o.type, ar: o.type })}{o.docName ? <span dir="ltr"> · {o.docName}</span> : null}{o.pages?.length ? ` · ${L('page', 'صفحة')} ${o.pages.join(', ')}` : ''}{o.snippet ? <div className="muted" dir="ltr">“{o.snippet}”</div> : null}</div>)}</td>
                <td>
                  {row.status === 'matched' && <Chip def={{ en: 'Matched', ar: 'مطابق', cls: 'rv-cat--collected' }} />}
                  {row.status === 'ambiguous' && <Chip def={{ en: `Ambiguous — ${row.candidates.length} invoices`, ar: `ملتبس — ${row.candidates.length} فواتير`, cls: 'rv-cat--partial' }} />}
                  {row.status === 'unmatched' && <Chip def={{ en: 'Not found in the system', ar: 'غير موجود في النظام', cls: 'rv-cat--overdue' }} />}
                  {row.status === 'duplicate_reference' && <Chip def={{ en: 'Duplicate of another reference', ar: 'مكرر لمرجع آخر', cls: 'rv-cat--partial' }} />}
                  {row.status === 'pending' && <span className="muted">…</span>}
                  {row.duplicateOf && <div className="muted" style={{ fontSize: 12 }}>{L('same invoice as', 'نفس فاتورة')} <span dir="ltr">{row.duplicateOf}</span></div>}
                  {row.weak && <div className="muted" style={{ fontSize: 12 }}>{L('weak reference (year missing / padded)', 'مرجع ضعيف (بلا سنة / مُكمَّل)')}</div>}
                  {row.status === 'unmatched' && <div className="muted" style={{ fontSize: 12 }}>{L('Possibly a typing or OCR error — it is NOT replaced by a “similar” invoice.', 'ربما خطأ طباعة أو OCR — ولا يُستبدل بفاتورة «مشابهة».')}</div>}
                </td>
                <td>
                  {row.candidates.map((k) => (
                    <div key={k.invoiceId} style={{ marginBottom: 6, fontSize: 13 }}>
                      <Link to={`/invoices?id=${k.invoiceId}`} dir="ltr">{k.invoiceId}</Link> · {B(SOURCE_LABEL[k.source] || { en: k.source, ar: k.source })}
                      <div className="muted" style={{ fontSize: 12 }}>{B(k.payerName)} · <span dir="ltr">{sar(k.grossAmount)}</span> · {L('payment', 'السداد')}: <PayStatusChip status={k.paymentStatus} /></div>
                      {(row.conflicts[k.invoiceId] || []).map((x) => <span key={x} className={`rv-tag ${NEED(x) ? 'rv-tag--bad' : 'rv-tag--warn'}`}>{B(CONFLICT_LABEL[x] || { en: x, ar: x })}</span>)}
                      {(others.get(k.invoiceId) || []).map((o) => <div key={o.enforceNum} className="muted" style={{ fontSize: 12 }}>{L('linked to', 'مرتبطة بـ')} <Link to={`/sanad-orders/${o.enforceNum}`} dir="ltr">{o.enforceNum}</Link> ({o.status === 'confirmed' ? L('confirmed', 'مؤكد') : L('proposed', 'مقترح')})</div>)}
                    </div>
                  ))}
                </td>
                <td>
                  {row.status === 'duplicate_reference' && <span className="muted">—</span>}
                  {row.candidates.map((k) => {
                    const l = links.find((x) => x.invoiceId === k.invoiceId);
                    const need = needsNote(row.conflicts[k.invoiceId]);
                    if (row.status === 'duplicate_reference') return null;
                    return (
                      <div key={k.invoiceId} style={{ marginBottom: 8 }}>
                        {row.candidates.length > 1 && <div dir="ltr" style={{ fontSize: 12, fontWeight: 700 }}>{k.invoiceId}</div>}
                        {l && <div style={{ marginBottom: 3 }}><Chip def={LINK_STATUS_LABEL[l.status]} /></div>}
                        {(!l || l.status === 'rejected') && (<>
                          {noteInput(k.invoiceId, need)}
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-sm btn-primary" disabled={!rev.canReview} onClick={() => confirm(row, k)}>{L('Confirm link', 'تأكيد الربط')}</button>
                            {!l && <button type="button" className="btn btn-sm" disabled={!rev.canReview} onClick={() => propose(row, k)}>{L('Save as proposal', 'حفظ كاقتراح')}</button>}
                            {!l && <button type="button" className="btn btn-sm" disabled={!rev.canReview} onClick={() => reject(row, k)}>{L('Reject', 'رفض')}</button>}
                          </div>
                        </>)}
                        {l?.status === 'candidate' && (<>
                          {noteInput(k.invoiceId, need)}
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button type="button" className="btn btn-sm btn-primary" disabled={!rev.canReview} onClick={() => confirm(row, k)}>{L('Confirm link', 'تأكيد الربط')}</button>
                            <button type="button" className="btn btn-sm" disabled={!rev.canReview} onClick={() => reject(row, k)}>{L('Reject', 'رفض')}</button>
                          </div>
                        </>)}
                        {l?.status === 'confirmed' && <span className="muted" style={{ fontSize: 12 }}>{L('Withdraw it in the table below.', 'يُسحب من الجدول أدناه.')}</span>}
                      </div>
                    );
                  })}
                  {row.status === 'unmatched' && (c.dismissedRefs || []).includes(row.key) && <span className="rv-tag">{L('set aside', 'مستبعد')}</span>}
                  {row.status === 'unmatched' && rev.canReview && !(c.dismissedRefs || []).includes(row.key) && (<>
                    {noteInput(row.key, false)}
                    <button type="button" className="btn btn-sm" onClick={() => dismiss(row)}>{L('Set aside — not an invoice of this order', 'استبعاد — ليس فاتورة لهذا الأمر')}</button>
                  </>)}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {ms.unresolved.length > 0 && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{L(`${ms.unresolved.length} invoice reference(s) are not yet accounted for by a link or a decision, so the order cannot be fully matched.`, `${ms.unresolved.length} مرجع فاتورة لم يُحسم برابط أو قرار بعد، لذا لا يمكن أن يكون الأمر مطابقاً بالكامل.`)}</p>}

        {otherRefs.length > 0 && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>{L(`Other numbers found (${otherRefs.length}) — not invoice references, never matched`, `أرقام أخرى وُجدت (${otherRefs.length}) — ليست مراجع فواتير ولا تُطابَق`)}</summary>
            <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 0 }}>
              <thead><tr><th>{L('Number', 'الرقم')}</th><th>{L('Read as', 'قُرئ على أنه')}</th><th>{L('Where', 'أين')}</th></tr></thead>
              <tbody>{otherRefs.map((o, i) => <tr key={i}><td dir="ltr">{o.value}</td><td>{B(KIND_LABEL[o.kind] || { en: o.kind, ar: o.kind })}{o.label && o.label !== 'pattern' && o.label !== 'unlabelled' ? <span className="muted"> · {o.label}</span> : null}</td><td style={{ fontSize: 12 }} dir="ltr">{o.docName ? `${o.docName} · p.${(o.pages || []).join(',')}` : ''}{o.snippet ? <div className="muted">“{o.snippet}”</div> : null}</td></tr>)}</tbody>
            </table></div>
          </details>
        )}
      </div>

      <div className="card card-pad">
        <h2 className="rv-sec-title">{L('4 · The order next to each linked invoice', '4 · الأمر بجانب كل فاتورة مرتبطة')}</h2>
        <p className="rv-sec-sub">{L('Only a CONFIRMED link reflects the order’s status on the invoice. The invoice’s payment status is a separate field and does not change.', 'الرابط «المؤكد» فقط يعكس حالة الأمر على الفاتورة. أما حالة سداد الفاتورة فحقل منفصل ولا تتغير.')}</p>
        {links.length ? (
          <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 980 }}>
            <thead><tr><th>{L('Order', 'الأمر')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Payment status (unchanged)', 'حالة السداد (لا تتغير)')}</th><th>{L('Enforcement status on the invoice', 'حالة الإنفاذ على الفاتورة')}</th><th>{L('Link', 'الرابط')}</th><th>{L('Evidence and method', 'الدليل والطريقة')}</th><th style={{ minWidth: 200 }}>{L('Action', 'إجراء')}</th></tr></thead>
            <tbody>{links.map((l) => {
              const k = byInvoice.get(l.invoiceId); const snap = l.snapshot || {};
              const sameDebtor = k && c.debtorIdx != null && k.payerIdx != null ? c.debtorIdx === k.payerIdx : null;
              const ev = (l.evidence || []).filter((e) => e && typeof e === 'object');
              return (
                <tr key={l.invoiceId}>
                  <td style={{ fontSize: 12 }}><b dir="ltr">{c.enforceNum}</b><div><OrderStatusChip status={status} /></div><div dir="auto">{B(c.debtorName)}</div><div dir="ltr">{sar(c.amount)}</div></td>
                  <td style={{ fontSize: 12 }}>
                    <Link to={`/invoices?id=${l.invoiceId}`} dir="ltr">{l.invoiceId}</Link>
                    <div>{B(SOURCE_LABEL[k?.source || snap.source] || { en: k?.source || snap.source || '', ar: k?.source || snap.source || '' })}</div>
                    <div dir="auto">{B(k?.payerName || snap.payerName)} {sameDebtor === false && <span className="rv-tag rv-tag--bad">{L('not the order debtor', 'ليس مدين الأمر')}</span>}{sameDebtor === true && <span className="rv-tag rv-tag--ok">{L('same debtor', 'نفس المدين')}</span>}</div>
                    <div dir="ltr">{sar(k?.grossAmount ?? l.gross ?? 0)}</div>
                  </td>
                  <td>{k ? <PayStatusChip status={k.paymentStatus} /> : <span className="muted">—</span>}{k && k.outstanding != null && <div className="muted" style={{ fontSize: 12 }} dir="ltr">{L('outstanding', 'المتبقي')} {sar(k.outstanding)}</div>}</td>
                  <td>{l.status === 'confirmed' ? <OrderStatusChip status={status} /> : <span className="muted">{l.status === 'candidate' ? L('none — awaiting confirmation', 'لا شيء — بانتظار التأكيد') : L('none', 'لا شيء')}</span>}</td>
                  <td><Chip def={LINK_STATUS_LABEL[l.status] || LINK_STATUS_LABEL.rejected} />{l.ledgerStatus === 'removed' && <div className="muted" style={{ fontSize: 12 }}>{L('withdrawn', 'مسحوب')}</div>}</td>
                  <td style={{ fontSize: 12 }}>
                    <div>{B(ORIGIN_LABEL[l.origin] || ORIGIN_LABEL.sanad_structured)}</div>
                    {ev.map((e, i) => <div key={i} className="muted" dir="ltr">{e.refValue}{e.docName ? ` · ${e.docName}` : ''}{e.pages?.length ? ` · p.${e.pages.join(',')}` : ''}{e.snippet ? ` · “${e.snippet}”` : ''}</div>)}
                    {(l.conflicts || []).map((x) => <span key={x} className="rv-tag rv-tag--warn">{B(CONFLICT_LABEL[x] || { en: x, ar: x })}</span>)}
                    {l.reviewedBy ? <div className="muted">{L('by', 'بواسطة')} {reviewerLabel(l.reviewedBy, L)}{l.reviewedAt ? ` · ${String(l.reviewedAt).length > 10 ? fmtRiyadh(l.reviewedAt) : l.reviewedAt}` : ''}</div> : null}
                    {l.reviewNote ? <div dir="auto" className="muted">“{l.reviewNote}”</div> : null}
                    {l.removeNote ? <div dir="auto" className="muted">{L('withdrawn:', 'سُحب:')} “{l.removeNote}”</div> : null}
                  </td>
                  <td>
                    {l.status === 'confirmed' ? (<>
                      {noteInput(`rm-${l.invoiceId}`, true)}
                      <button type="button" className="btn btn-sm" disabled={!rev.canReview} onClick={() => removeConfirmed(l.invoiceId)}>{L('Withdraw link…', 'سحب الرابط…')}</button>
                    </>) : '—'}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="rv-empty">{L('No linked or proposed invoices yet. The order stays unmatched until references are found and resolved.', 'لا توجد فواتير مرتبطة أو مقترحة بعد. يبقى الأمر غير مطابق حتى يُعثر على مراجع وتُحسم.')}</div>}
      </div>

      <div className="card card-pad">
        <h2 className="rv-sec-title">{L('5 · History', '5 · السجل')}</h2>
        {(c.history || []).length ? (
          <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 0 }}>
            <thead><tr><th>{L('When (Riyadh)', 'متى (الرياض)')}</th><th>{L('Who', 'من')}</th><th>{L('What', 'ماذا')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Detail', 'تفصيل')}</th></tr></thead>
            <tbody>{c.history.map((h, i) => (
              <tr key={i}>
                <td dir="ltr">{String(h.at || '').length > 10 ? fmtRiyadh(h.at) : h.at}</td>
                <td>{h.by}</td>
                <td>{ACTION_LABEL[h.action] ? B(ACTION_LABEL[h.action]) : h.action}</td>
                <td dir="ltr">{h.invoiceId || '—'}</td>
                <td style={{ fontSize: 12 }} dir="auto">{histDetail(h, L, B)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="rv-empty">{L('No history yet.', 'لا يوجد سجل بعد.')}</div>}
      </div>
    </div>
  );
}

const NEED = (x) => needsNote([x]);
const reviewerLabel = (by, L) => (by === 'Sanad structured reference (demo feed)' ? L(by, 'مرجع سند المهيكل (تغذية تجريبية)') : by === 'White-lands enforcement file (demo feed)' ? L(by, 'ملف إنفاذ الأراضي البيضاء (تغذية تجريبية)') : by);
function histDetail(h, L, B) {
  const d = h.detail || {}; const bits = [];
  if (h.note) bits.push(h.note);
  if (d.note) bits.push(`“${d.note}”`);
  if (d.appliedOrderStatus) bits.push(`${L('status applied', 'الحالة المعكوسة')}: ${B({ open: { en: 'In execution', ar: 'قيد التنفيذ' }, suspended: { en: 'Suspended', ar: 'موقوف' }, closed: { en: 'Closed', ar: 'مغلق' } }[d.appliedOrderStatus] || { en: d.appliedOrderStatus, ar: d.appliedOrderStatus })}`);
  if (d.wasAppliedStatus) bits.push(`${L('status removed', 'الحالة المُزالة')}: ${d.wasAppliedStatus}`);
  if (d.from && d.to) bits.push(`${d.from} → ${d.to}${d.invoices?.length ? ` (${d.invoices.length} ${L('confirmed invoice(s) follow it', 'فاتورة مؤكدة تتبعه')})` : ''}`);
  if (d.name) bits.push(d.name);
  if (d.pages != null && typeof d.pages === 'number') bits.push(`${d.pages} ${L('page(s)', 'صفحة')}`);
  if (Array.isArray(d.pages)) bits.push(`${L('pages', 'الصفحات')} ${d.pages.join(', ')}`);
  if (d.invoiceReferences != null) bits.push(`${d.invoiceReferences} ${L('invoice reference(s)', 'مرجع فاتورة')}`);
  if (d.origin) bits.push(B(ORIGIN_LABEL[d.origin] || { en: d.origin, ar: d.origin }));
  if (Array.isArray(d.conflicts) && d.conflicts.length) bits.push(`${L('conflicts', 'تعارضات')}: ${d.conflicts.join(', ')}`);
  return bits.join(' · ') || '—';
}
void refKey;
