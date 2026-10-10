import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAsync } from '../utils/useAsync';
import { useL } from '../utils/bi';
import { RecordHeader, StatusGroup, Figures, Facts, Section, RecordState, Finding } from '../components/record/RecordPage';
import PdfPreview, { useDocFiles } from '../components/record/PdfPreview';
import SourceRecordSection from '../components/revenue/SourceRecordSection';
import { PayStatusChip, OrderStatusChip, Chip, EnforcementChips, LINK_STATUS_LABEL, CONFLICT_LABEL, SOURCE_LABEL } from '../components/revenue/EnforcementUI';
import { RecordLink, useReturnTarget } from '../utils/returnContext';
import { orderPath, contractPath } from '../utils/paths';
import { enforcementOf, evidenceForInvoice, CLOSE_REASON_LABEL } from '../data/relations';
import { exclusionRecordsOf, ruleById, CATEGORY_LABELS } from '../data/revenueMetrics';
import { RULE_APPROVAL_LABEL } from '../data/ruleRegistry';
import { RULE_IDS } from '../data/catalog';
import { REVENUE_SOURCES } from '../data/revenueLedger';
import { ORIGIN_LABEL, unresolvedConflicts } from '../data/orderMatching';
import { fmtRiyadh, fmtDateText } from '../data/clock';

const CHANNEL = { sadad: { en: 'SADAD', ar: 'سداد' }, voluntary: { en: 'Voluntary', ar: 'طوعي' }, enforcement: { en: 'Enforcement', ar: 'تنفيذ' }, transfer: { en: 'Transfer', ar: 'تحويل' }, card: { en: 'Card', ar: 'بطاقة' }, wallet: { en: 'Wallet', ar: 'محفظة' } };
function exportReview(rec, der, enf, notes) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Invoice review report (demo data)', ''], ['Invoice number', rec.id], ['Revenue source', rec.revenueSource], ['Payer', rec.entityEn], ['Amanah', rec.amanahEn], ['Issue date', rec.issueDate], ['Due date', rec.dueDate],
    ['Gross billed (SAR)', der.gross], ['Exclusions (SAR)', der.exclusionsTotal], ['Net billed (SAR)', der.net], ['Collected (SAR)', der.collected], ['Remaining balance (SAR)', der.outstanding], ['Payment status', der.payStatus],
    ['Enforcement now', enf.current], ['Referred before', enf.referredEver ? 'yes' : 'no'], ['Confirmed orders', enf.confirmed.map((o) => `${o.enforceNum}:${o.orderStatus}`).join(' | ')], ['Proposed orders (no effect)', enf.proposed.map((o) => o.enforceNum).join(' | ')],
    ['Notes', (notes || []).map((n) => `${n.at} ${n.by}: ${n.text}`).join(' | ')], ['Note', 'An analysis review is not a payment and not a legal approval.']];
  const blob = new Blob([`\uFEFF${lines.map((r) => r.map(esc).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `invoice-review-${rec.id}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

const ERR = {
  no_permission: { en: 'Read-only role.', ar: 'دور للقراءة فقط.' },
  unresolved_conflict: { en: 'This link has a conflict that no evidence resolves. A reason does not resolve it: open the order to review the evidence, or leave the link unresolved.', ar: 'في هذا الرابط تعارض لا يحسمه دليل. والسبب المكتوب لا يحسمه: افتح الأمر لمراجعة الأدلة أو اترك الرابط غير محسوم.' }
};

// ONE full page per invoice: essential summary first, findings that need action, then a few sections. Statuses are kept apart on purpose:
// PAYMENT (what was paid) · ENFORCEMENT (current / historical, from confirmed order links) · REVIEW (this analysis) — reviewing or confirming never implies payment or legal approval.
export default function InvoicePage() {
  const { id: rawId } = useParams(); const id = decodeURIComponent(rawId || '');
  const rev = useRevenue();
  const { L, B, ar, sar, short } = useL();
  const { canReview } = rev;
  const [reload, setReload] = useState(0);
  const ret = useReturnTarget({ path: '/invoices', label: L('Invoices', 'سجل الفواتير') });
  const { data: det, loading, error } = useAsync(() => rev.data.invoice(id), [rev.data, id, reload]);
  const rec = det?.rec && det.rec.id === id ? det.rec : null; const der = rec ? det.derived : null;
  const contractNo = rec?.co || null;
  const { data: card } = useAsync(() => (contractNo ? rev.data.contract(contractNo).catch(() => null) : Promise.resolve(null)), [rev.data, contractNo]);
  const enf = useMemo(() => enforcementOf(id, rev.cases), [id, rev.cases]);
  const evidence = useMemo(() => evidenceForInvoice(id, rev.cases), [id, rev.cases]);
  const docIds = [...new Set(evidence.map((e) => e.docId).filter(Boolean))]; const files = useDocFiles(docIds, reload);
  const [msg, setMsg] = useState(null); const [text, setText] = useState(''); const [ev, setEv] = useState(0);
  const notes = rev.notes?.[id] || [];

  const crumbs = [{ label: L('Dashboards and reports', 'لوحة المعلومات والتقارير'), to: '/insights' }, { label: L('Invoices', 'سجل الفواتير'), to: '/invoices' }, { label: id, ltr: true }];
  if (!rec) {
    const notFound = !loading && !rec && (error?.status === 404 || (!error && det === null));
    return <div className="rp"><RecordHeader crumbs={crumbs} title={id} ret={ret} /><RecordState loading={loading && !error} error={error && error.status !== 404 ? error : null} notFound={notFound || error?.status === 404} onRetry={() => setReload((x) => x + 1)} kind={L('Invoice', 'الفاتورة')} backTo={{ path: '/invoices', label: L('Back to the invoices', 'العودة إلى الفواتير') }} /></div>;
  }

  const reasons = RULE_IDS.filter((_, b) => der.reasonMask & (1 << b)).sort((a, b) => (a === der.primaryRuleId ? -1 : b === der.primaryRuleId ? 1 : 0));
  const records = exclusionRecordsOf(rec);
  const pendingEx = records.filter((e) => e.reviewStatus === 'pending' || !e.reviewStatus);
  const proposedLinks = enf.proposed;
  const decide = (ruleId, d) => { const r = rev.decideExclusion(id, d, '', ruleId); setMsg(r.ok ? { ok: true, t: L('Analysis decision recorded. It does not imply payment or legal approval.', 'سُجّل القرار التحليلي. ولا يعني سداداً ولا اعتماداً قانونياً.') } : { ok: false, t: B(ERR[r.error] || ERR.no_permission) }); };
  const linkAct = (kind, en) => { const r = kind === 'confirm' ? rev.enforcement.confirm(en, id, {}) : rev.enforcement.reject(en, id, {}); setMsg(r.ok ? { ok: true, t: kind === 'confirm' ? L('Link confirmed: the order status now shows on this invoice; its payment status is unchanged.', 'أُكِّد الرابط: تظهر حالة الأمر على هذه الفاتورة؛ وحالة السداد لم تتغير.') : L('Link rejected (kept in the history).', 'رُفض الرابط (محفوظ في السجل).') } : { ok: false, t: B(ERR[r.error] || { en: 'Could not record the decision.', ar: 'تعذّر تسجيل القرار.' }) }); };

  const findings = [];
  if (rec.amountCheck?.status === 'conflict') findings.push({ k: 'amount', tone: 'bad', title: L('Amount does not match the line items', 'المبلغ لا يطابق البنود'), why: L('The header amount differs from the sum of the line items (VAT shown apart).', 'مبلغ الرأس يختلف عن مجموع البنود (والضريبة منفصلة).'), evidence: L(`Header ${sar(rec.amountCheck.headerAmount)} · items ${sar(rec.amountCheck.lineTotal)} · difference ${sar(Math.abs(rec.amountCheck.difference))}. Not corrected: the metrics use the header amount.`, `الرأس ${sar(rec.amountCheck.headerAmount)} · البنود ${sar(rec.amountCheck.lineTotal)} · الفرق ${sar(Math.abs(rec.amountCheck.difference))}. لم يُصحَّح: تستخدم المؤشرات مبلغ الرأس.`), action: null });
  for (const ex of pendingEx) findings.push({ k: `ex-${ex.ruleId}`, tone: 'warn', title: L('An exclusion is waiting for review', 'استبعاد بانتظار المراجعة'), why: L(`Rule ${ex.ruleId} flagged this invoice; until approved it stays inside net billed.`, `القاعدة ${ex.ruleId} أشارت إلى هذه الفاتورة؛ وتبقى ضمن صافي المفوتر حتى يُعتمد الاستبعاد.`), evidence: B(ex.evidence), action: ['ex', ex] });
  for (const o of proposedLinks) findings.push({ k: `pl-${o.enforceNum}`, tone: 'warn', title: L(`A proposed link to order ${o.enforceNum}`, `رابط مقترح بالأمر ${o.enforceNum}`), why: L('A reference in the order points to this invoice. A proposal has no effect until a person confirms it.', 'مرجع في الأمر يشير إلى هذه الفاتورة. والمقترح بلا أثر حتى يؤكده شخص.'), evidence: null, action: ['link', o] });
  if (rec.contract?.status === 'unmatched') findings.push({ k: 'contract', tone: 'info', title: L('Contract not matched', 'العقد غير مطابق'), why: L('This investment invoice carries no matched contract. It is NOT treated as “no contract”.', 'لا عقد مطابق لهذه الفاتورة الاستثمارية، ولا تُعامل على أنها «بلا عقد».'), evidence: L('No contract is inferred from an amount or a payer name.', 'لا يُستنتج عقد من مبلغ أو اسم دافع.'), action: null });
  if (rec.missingFields?.length) findings.push({ k: 'missing', tone: 'warn', title: L('Mandatory fields are missing', 'حقول إلزامية ناقصة'), why: L('The invoice cannot be referred as-is.', 'لا يمكن إحالة الفاتورة كما هي.'), evidence: rec.missingFields.join(', '), action: null });
  if (der.overpayment > 0) findings.push({ k: 'over', tone: 'info', title: L('Paid more than billed', 'مدفوع أكثر من المفوتر'), why: L('Cash received exceeds the net billed amount.', 'المقبوض يتجاوز صافي المفوتر.'), evidence: L(`Overpayment ${sar(der.overpayment)} (kept outside «collected», which is capped at the invoice net).`, `زيادة ${sar(der.overpayment)} (خارج «المحصّل» المحدود بصافي الفاتورة).`), action: null });
  if (rec.objection) findings.push({ k: 'obj', tone: 'info', title: L('Open objection', 'اعتراض مفتوح'), why: L('An objection is registered against this invoice.', 'يوجد اعتراض مسجّل على هذه الفاتورة.'), evidence: rec.objection.ref, action: null });
  if (enf.confirmed.length > 1) findings.push({ k: 'multi', tone: 'info', title: L(`Named by ${enf.confirmed.length} orders`, `مذكورة في ${enf.confirmed.length} أوامر`), why: L('One invoice can carry several orders (for example a closed one and a newer one). Enforcement status follows all of them.', 'قد تحمل الفاتورة الواحدة عدة أوامر (مثلاً أمر مغلق وأحدث منه). وتتبع حالة الإنفاذ كلها.'), evidence: enf.confirmed.map((o) => `${o.enforceNum} (${o.orderStatus})`).join(' · '), action: null });

  const myPay = card?.schedule?.find((p) => p.invoiceNo === id);
  const timeline = [
    { d: rec.issueDate, t: L('Invoice issued', 'صدرت الفاتورة') }, { d: rec.dueDate, t: L('Due date', 'تاريخ الاستحقاق') },
    ...rec.payments.map((p) => ({ d: p.date, t: `${L('Payment', 'دفعة')} ${sar(p.amount)} · ${B(CHANNEL[p.channel] || { en: p.channel, ar: p.channel })}` })),
    ...(rec.cancelled ? [{ d: rec.cancelled.date, t: L('Cancelled in the source', 'أُلغيت في المصدر') }] : []),
    ...records.filter((e) => e.reviewDate).map((e) => ({ d: e.reviewDate, t: `${e.ruleId}: ${e.reviewStatus === 'approved' ? L('exclusion approved (analysis decision)', 'اعتُمد الاستبعاد (قرار تحليلي)') : e.reviewStatus}` })),
    ...rev.cases.flatMap((c) => (c.history || []).filter((h) => h.invoiceId === id).map((h) => ({ d: h.at, t: `${L('Order', 'الأمر')} ${c.enforceNum}: ${h.action}` }))),
    ...notes.map((n) => ({ d: n.at, t: `${L('Note', 'ملاحظة')}: ${n.text}` }))
  ].sort((a, b) => String(a.d || '9999').localeCompare(String(b.d || '9999')));

  const orderLinks = rev.cases.map((c) => ({ c, l: (c.links || []).find((x) => x.invoiceId === id && (x.status === 'confirmed' || x.status === 'candidate' || x.ledgerStatus === 'removed')) })).filter((x) => x.l);
  const activeEv = evidence[Math.min(ev, Math.max(0, evidence.length - 1))];
  const activeDoc = activeEv ? rev.cases.find((c) => c.enforceNum === activeEv.enforceNum)?.docs?.find((d) => d.id === activeEv.docId) : null;
  const sourceKey = rec.revenueSource; const typeLabel = B(SOURCE_LABEL[sourceKey] || (REVENUE_SOURCES[sourceKey] ? REVENUE_SOURCES[sourceKey] : { en: sourceKey, ar: sourceKey }));

  return (
    <div className="rp">
      <RecordHeader
        crumbs={crumbs} ret={ret} kind={L('Invoice', 'فاتورة')} title={id} id={null}
        statuses={<>
          <StatusGroup label={L('Payment status', 'حالة السداد')} hint={L('what was paid — separate from enforcement and review', 'ما سُدّد — منفصلة عن الإنفاذ والمراجعة')}><PayStatusChip status={der.payStatus} />{der.daysOverdue > 0 && der.outstanding > 0 && <span className="rv-tag rv-tag--warn">{der.daysOverdue} {L('days overdue', 'يوماً متأخرة')}</span>}</StatusGroup>
          <StatusGroup label={L('Enforcement status', 'حالة الإنفاذ')} hint={L('from confirmed orders only; “referred before” stays after an order closes', 'من الأوامر المؤكدة فقط؛ وتبقى «سبقت إحالتها» بعد إغلاق الأمر')}><EnforcementChips enf={enf} /></StatusGroup>
          <StatusGroup label={L('Review (this analysis)', 'المراجعة (هذا التحليل)')} hint={L('an analysis decision — not a payment or a legal approval', 'قرار تحليلي — وليس سداداً ولا اعتماداً قانونياً')}>{findings.filter((f) => f.action).length ? <span className="rv-tag rv-tag--warn">{L(`${findings.filter((f) => f.action).length} awaiting your decision`, `${findings.filter((f) => f.action).length} بانتظار قرارك`)}</span> : <span className="rv-tag rv-tag--ok">{L('No decision pending', 'لا قرار معلّق')}</span>}</StatusGroup>
        </>}
        actions={<><span className="rv-cat">{typeLabel}</span><span className="rv-tag">{rec.sourcePlatform}</span><button type="button" className="btn btn-sm" onClick={() => exportReview(rec, der, enf, notes)}>{L('Export review report (CSV)', 'تصدير تقرير المراجعة (CSV)')}</button></>}
      />

      <Figures label={L('Financial summary', 'الملخص المالي')} items={[
        { label: L('Gross billed', 'إجمالي المفوتر'), value: sar(der.gross) },
        { label: L('Exclusions', 'الاستبعادات'), value: sar(der.exclusionsTotal), note: der.cancelled ? L('cancelled', 'ملغاة') : reasons[0] || null },
        { label: L('Net billed', 'صافي المفوتر'), value: sar(der.net) },
        { label: L('Collected', 'المحصّل'), value: sar(der.collected), tone: der.collected > 0 ? 'good' : undefined },
        { label: L('Remaining balance', 'الرصيد المتبقي'), value: sar(der.outstanding), tone: der.outstanding > 0 && der.daysOverdue > 0 ? 'bad' : undefined }
      ]} />

      <section className="rp-section" aria-label={L('Essential information', 'المعلومات الأساسية')}>
        <Facts items={[
          { k: L('Issue date', 'تاريخ الإصدار'), v: fmtDateText(rec.issueDate, ar ? 'ar' : 'en'), ltr: true }, { k: L('Due date', 'تاريخ الاستحقاق'), v: fmtDateText(rec.dueDate, ar ? 'ar' : 'en'), ltr: true },
          { k: L('Payer', 'الدافع'), v: <>{ar ? rec.entityAr : rec.entityEn}{rec.beneficiaryId ? <span className="muted" dir="ltr"> · {rec.beneficiaryId}</span> : null}</> },
          { k: L('Amanah · municipality', 'الأمانة · البلدية'), v: `${ar ? rec.amanahAr : rec.amanahEn}${rec.municipalityEn ? ` · ${ar ? rec.municipalityAr : rec.municipalityEn}` : ''}` },
          { k: L('Invoice no.', 'رقم الفاتورة'), v: rec.id, ltr: true }, rec.sadadNo && { k: L('SADAD no.', 'رقم سداد'), v: rec.sadadNo, ltr: true }, rec.violationNumber && { k: L('Violation no.', 'رقم المخالفة'), v: rec.violationNumber, ltr: true }
        ]} />
      </section>

      {msg && <div className={`rv-callout ${msg.ok ? '' : 'rv-callout--bad'}`} role="status" aria-live="polite">{msg.t}</div>}

      {findings.length > 0 && (
        <Section id="findings" title={L('Findings to review', 'ما يحتاج مراجعة')} count={findings.length}>
          <div className="rp-findings">
            {findings.map((f) => (
              <Finding key={f.k} tone={f.tone} title={f.title} why={f.why} evidence={f.evidence}
                actions={f.action && f.action[0] === 'ex' ? (<><button type="button" className="btn btn-sm btn-primary" disabled={!canReview} onClick={() => decide(f.action[1].ruleId, 'approved')}>{L('Approve exclusion', 'اعتماد الاستبعاد')}</button><button type="button" className="btn btn-sm" disabled={!canReview} onClick={() => decide(f.action[1].ruleId, 'rejected')}>{L('Reject', 'رفض')}</button></>)
                  : f.action && f.action[0] === 'link' ? (<><button type="button" className="btn btn-sm btn-primary" disabled={!canReview} onClick={() => linkAct('confirm', f.action[1].enforceNum)}>{L('Confirm link', 'تأكيد الرابط')}</button><button type="button" className="btn btn-sm" disabled={!canReview} onClick={() => linkAct('reject', f.action[1].enforceNum)}>{L('Reject', 'رفض')}</button><RecordLink className="btn btn-sm btn-ghost" to={orderPath(f.action[1].enforceNum)}>{L('Open the order', 'فتح الأمر')}</RecordLink></>) : null} />
            ))}
          </div>
          {!canReview && <div className="rp-limit">{L('Read-only role: you can read the findings but not decide.', 'دور للقراءة فقط: يمكنك قراءة الملاحظات دون اتخاذ قرار.')}</div>}
        </Section>
      )}

      <Section id="info" title={L('Invoice information and payments', 'بيانات الفاتورة والمدفوعات')}>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Payments', 'المدفوعات')}>
          <thead><tr><th>{L('Payment date', 'تاريخ الدفع')}</th><th>{L('Channel', 'القناة')}</th><th className="num">{L('Amount', 'المبلغ')}</th></tr></thead>
          <tbody>{rec.payments.length ? rec.payments.map((p, i) => <tr key={i}><td dir="ltr">{p.date}</td><td>{B(CHANNEL[p.channel] || { en: p.channel, ar: p.channel })}</td><td className="num" dir="ltr">{sar(p.amount)}</td></tr>) : <tr><td colSpan={3} className="muted">{L('No payment recorded up to the reference date.', 'لا دفعات مسجّلة حتى التاريخ المرجعي.')}</td></tr>}</tbody>
        </table></div>
        <Facts items={[
          { k: L('Source status (Tahseel)', 'حالة المصدر (تحصيل)'), v: rec.statusRawTahseel || '—' }, rec.statusRawEfaa && { k: L('Source status (Efaa)', 'حالة المصدر (إيفاء)'), v: rec.statusRawEfaa },
          { k: L('Unified state', 'الحالة الموحدة'), v: <span className={`rv-cat rv-cat--${det.cls}`}>{det.cls === 'collected' ? L('Collected', 'محصّلة') : B(CATEGORY_LABELS[det.cls])}</span> }
        ]} />
        <Section id="items" secondary title={L('Line items and source record', 'البنود والسجل المصدري')}>
          <div className="rp-tablewrap" tabIndex={0}><table>
            <thead><tr><th>#</th><th>{L('Item', 'البند')}</th><th className="num">{L('Amount', 'المبلغ')}</th></tr></thead>
            <tbody>{(rec.lineItems || []).map((li) => <tr key={li.no}><td>{li.no}</td><td dir="auto">{li.name}</td><td className="num" dir="ltr">{sar(li.amount)}</td></tr>)}</tbody>
          </table></div>
          <SourceRecordSection sr={det.sourceRecord} />
        </Section>
      </Section>

      <Section id="analysis" title={L('Analysis and review', 'التحليل والمراجعة')}>
        <div className="rp-limit">{L('Source figures (amounts, dates, payer) are not edited here — they are corrected in the source system. What can be reviewed here: exclusion decisions, enforcement links, and notes. A review decision is an analytical decision in this solution; it does not mean payment and is not a legal approval.', 'أرقام المصدر (المبالغ والتواريخ والدافع) لا تُعدَّل هنا — تُصحَّح في النظام المصدر. ما يُراجَع هنا: قرارات الاستبعاد وروابط الإنفاذ والملاحظات. والقرار المراجَع قرار تحليلي في هذه المنصة؛ لا يعني سداداً وليس اعتماداً قانونياً.')}</div>
        {records.length ? records.map((ex) => {
          const rule = ruleById(ex.ruleId);
          return (
            <div key={ex.ruleId} className="rp-ev__item">
              <div><b>{ex.category.replace(/_/g, ' ')}</b> · <span dir="ltr">{ex.ruleId}</span> {rule && <span className="rv-tag">{B(RULE_APPROVAL_LABEL[rule.approval])}</span>} — {ex.reviewStatus === 'approved' ? L('approved', 'معتمد') : ex.reviewStatus === 'rejected' ? L('rejected', 'مرفوض') : L('pending: stays in net billed', 'معلّق: يبقى في صافي المفوتر')}</div>
              <div dir="auto">{B(ex.evidence)}</div>
              {ex.sources?.length > 0 && <div className="muted">{ex.sources.map((x) => `${x.system} › ${x.field} = ${x.value}`).join(' · ')}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" className="btn btn-sm btn-primary" disabled={!canReview || ex.reviewStatus === 'approved'} onClick={() => decide(ex.ruleId, 'approved')}>{L('Approve', 'اعتماد')}</button>
                <button type="button" className="btn btn-sm" disabled={!canReview || ex.reviewStatus === 'rejected'} onClick={() => decide(ex.ruleId, 'rejected')}>{L('Reject', 'رفض')}</button>
              </div>
            </div>
          );
        }) : <div className="muted">{L('No exclusion record on this invoice.', 'لا يوجد سجل استبعاد على هذه الفاتورة.')}</div>}
        <Section id="notes" secondary title={L('Notes', 'الملاحظات')} count={notes.length}>
          {notes.length > 0 && <ul className="rv-list">{notes.map((n, i) => <li key={i}><span dir="ltr" className="muted">{n.at}</span> <b>{n.by}</b> — <span dir="auto">{n.text}</span></li>)}</ul>}
          <div className="rv-form">
            <label style={{ flex: '1 1 260px' }}>{L('Add a note', 'إضافة ملاحظة')}<input id="inv_note" className="input" value={text} onChange={(e) => setText(e.target.value)} disabled={!canReview} /></label>
            <button type="button" className="btn btn-sm btn-primary" disabled={!canReview || !text.trim()} onClick={() => { rev.addNote(id, text.trim()); setText(''); }}>{L('Add', 'إضافة')}</button>
          </div>
        </Section>
      </Section>

      <Section id="orders" title={L('Enforcement orders and documents', 'أوامر التنفيذ والمستندات')} count={orderLinks.length}>
        {orderLinks.length ? (
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Orders on this invoice', 'أوامر هذه الفاتورة')}>
            <thead><tr><th>{L('Order', 'الأمر')}</th><th>{L('Order status', 'حالة الأمر')}</th><th>{L('Link', 'الرابط')}</th><th>{L('Basis', 'الأساس')}</th></tr></thead>
            <tbody>{orderLinks.map(({ c, l }) => {
              const st = c.orderStatus; const hard = unresolvedConflicts(l.conflicts, l.resolvedConflicts);
              return (
                <tr key={c.enforceNum}>
                  <td><RecordLink to={orderPath(c.enforceNum)} dir="ltr"><b>{c.enforceNum}</b></RecordLink><div className="muted" dir="ltr">{sar(c.amount)}</div></td>
                  <td><OrderStatusChip status={st} />{st === 'closed' && <div className="muted" style={{ fontSize: 12 }}>{c.closeReason ? B(CLOSE_REASON_LABEL[c.closeReason] || { en: c.closeReason, ar: c.closeReason }) : L('closure reason unknown', 'سبب الإغلاق غير معروف')}</div>}{st === 'closed' && <div className="muted" style={{ fontSize: 11 }}>{L('closing an order does not mean payment', 'إغلاق الأمر لا يعني السداد')}</div>}</td>
                  <td><Chip def={l.ledgerStatus === 'removed' ? { en: 'Withdrawn', ar: 'مسحوب', cls: 'rv-cat--excluded' } : LINK_STATUS_LABEL[l.status]} />{hard.length > 0 && l.status === 'candidate' && <div className="rp-bad" style={{ fontSize: 12 }}>{hard.map((x) => B(CONFLICT_LABEL[x] || { en: x, ar: x })).join(' · ')}</div>}</td>
                  <td style={{ fontSize: 12 }}>{B(ORIGIN_LABEL[l.origin] || ORIGIN_LABEL.sanad_structured)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="muted">{L('No enforcement order is linked to this invoice. (A missing link is not proof that none exists: Sanad’s feed here is synthetic.)', 'لا يوجد أمر إنفاذ مرتبط بهذه الفاتورة. (غياب الرابط ليس دليلاً على عدم وجود أمر: تغذية سند هنا اصطناعية.)')}</div>}

        {evidence.length > 0 && (
          <div className="rp-split" role="group" aria-label={L('Document and evidence', 'المستند والدليل')}>
            <div>{activeDoc ? <PdfPreview doc={activeDoc} page={activeEv.page || 1} tick={reload} onRestored={() => setReload((x) => x + 1)} /> : <div className="rp-limit">{L('No document record for this evidence.', 'لا سجل مستند لهذا الدليل.')}</div>}</div>
            <div className="rp-ev" role="list" aria-label={L('Extraction evidence', 'أدلة الاستخراج')}>
              {evidence.map((e, i) => (
                <button key={i} type="button" role="listitem" className={`rp-ev__item${i === ev ? ' rp-ev__item--active' : ''}`} style={{ textAlign: 'start', cursor: 'pointer', font: 'inherit' }} onClick={() => setEv(i)} aria-current={i === ev}>
                  <div><b dir="ltr">{e.enforceNum}</b> · {e.docName ? <span dir="ltr">{e.docName}</span> : null} · {L('page', 'صفحة')} {e.page ?? '—'}</div>
                  <div className="muted">{files[e.docId] === false ? L('original PDF unavailable', 'ملف PDF الأصلي غير متاح') : B(ORIGIN_LABEL[`document_${e.method}`] || ORIGIN_LABEL[e.method] || { en: String(e.method || ''), ar: String(e.method || '') })}</div>
                  {e.snippet && <div className="rp-ev__snip" dir="ltr">“{e.snippet}”</div>}
                </button>
              ))}
            </div>
          </div>
        )}
        {evidence.length === 0 && orderLinks.length > 0 && <div className="rp-limit">{L('No document evidence: these links rest on Sanad’s structured references only.', 'لا دليل مستندي: هذه الروابط تستند إلى مراجع سند المهيكلة فقط.')}</div>}
      </Section>

      <Section id="contract" title={L('Related contract', 'العقد المرتبط')}>
        {rec.co ? (
          <>
            <Facts items={[
              { k: L('Contract', 'العقد'), v: <RecordLink to={contractPath(rec.co)} dir="ltr">{rec.co}</RecordLink> },
              card && { k: L('Tenant', 'المستأجر'), v: ar ? card.tenantAr : card.tenantEn }, card && { k: L('Contract status', 'حالة العقد'), v: card.status },
              myPay && { k: L('Installment', 'الدفعة'), v: `${myPay.no} / ${card.schedule.length}`, ltr: true }, card && { k: L('Contract value', 'قيمة العقد'), v: short(card.totals.contractValue) }
            ]} />
            <div className="rp-limit">{L('The contract is the one recorded on the invoice (Furas). It was not inferred from an amount or a payer name.', 'العقد هو المسجّل على الفاتورة (فرص). ولم يُستنتج من مبلغ أو اسم دافع.')}</div>
          </>
        ) : <div className="muted">{rec.contract?.required === false ? L('This invoice type does not belong to a contract. That is normal.', 'نوع هذه الفاتورة لا يتبع عقداً. وهذا طبيعي.') : rec.contract?.status === 'unmatched' ? L('Contract not matched — an open finding above (not “no contract”).', 'العقد غير مطابق — ملاحظة مفتوحة أعلاه (وليس «بلا عقد»).') : L('No contract. (Invoices without a contract are fully supported.)', 'بلا عقد. (الفواتير بلا عقد مدعومة بالكامل.)')}</div>}
      </Section>

      <Section id="history" secondary title={L('History', 'السجل')} count={timeline.length}>
        <ol className="rv-timeline">{timeline.map((e, i) => <li key={i}><span dir="ltr" className="muted">{String(e.d || '—').length > 10 ? fmtRiyadh(e.d) : e.d || '—'}</span> {e.t}</li>)}</ol>
      </Section>
    </div>
  );
}
