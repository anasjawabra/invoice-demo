import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAsync } from '../utils/useAsync';
import { useL } from '../utils/bi';
import { RecordHeader, StatusGroup, Facts, Section, RecordState, Finding } from '../components/record/RecordPage';
import PdfPreview, { useDocFiles } from '../components/record/PdfPreview';
import SourceRecordSection from '../components/revenue/SourceRecordSection';
import { MoneyPanel, PaymentPanel, InfoGroups, SectionNav } from '../components/record/InvoiceParts';
import { paymentFacts } from '../data/invoicePayments';
import { PayStatusChip, OrderStatusChip, Chip, EnforcementChips, LINK_STATUS_LABEL, CONFLICT_LABEL, SOURCE_LABEL, Enf1Explainer } from '../components/revenue/EnforcementUI';
import { RecordLink, useReturnTarget } from '../utils/returnContext';
import { orderPath, contractPath } from '../utils/paths';
import { enforcementOf, evidenceForInvoice, CLOSE_REASON_LABEL } from '../data/relations';
import { exclusionRecordsOf, ruleById, CATEGORY_LABELS } from '../data/revenueMetrics';
import { RULE_APPROVAL_LABEL } from '../data/ruleRegistry';
import { RULE_IDS } from '../data/catalog';
import { REVENUE_SOURCES } from '../data/revenueLedger';
import { ORIGIN_LABEL, unresolvedConflicts } from '../data/orderMatching';
import { fmtRiyadh, fmtDateText } from '../data/clock';
import { MAIN_EN, EXCLUSIONS_AUTO_APPLY } from '../data/iim';
import { locLabel } from '../data/docxText';

const CHANNEL = { sadad: { en: 'SADAD', ar: 'سداد' }, voluntary: { en: 'Voluntary', ar: 'طوعي' }, enforcement: { en: 'Enforcement', ar: 'تنفيذ' }, transfer: { en: 'Transfer', ar: 'تحويل' }, card: { en: 'Card', ar: 'بطاقة' }, wallet: { en: 'Wallet', ar: 'محفظة' } };
function exportReview(rec, der, enf, notes, evidence = []) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Invoice review report (demo data)', ''], ['Invoice number', rec.id], ['Revenue source', rec.revenueSource], ['Payer', rec.entityEn], ['Amanah', rec.amanahEn], ['Issue date', rec.issueDate], ['Due date', rec.dueDate],
    ['Gross billed (SAR)', der.gross], ['Exclusions (SAR)', der.exclusionsTotal], ['Collected (SAR)', der.collected], ['Remaining balance (SAR)', der.outstanding], ['Payment status', der.payStatus],
    ['Source cancelled', der.sourceCancelled ? 'yes' : 'no'], ['Source/enforcement conflict (review required)', der.enfConflict ? 'yes' : 'no'], ['Enforcement now', enf.current], ['Referred before', enf.referredEver ? 'yes' : 'no'], ['Confirmed orders', enf.confirmed.map((o) => `${o.enforceNum}:${o.orderStatus}`).join(' | ')], ['Proposed orders (no effect)', enf.proposed.map((o) => o.enforceNum).join(' | ')],
    ['Link evidence (method — document — location)', evidence.map((e) => `${e.enforceNum}: ${e.method || ''} — ${e.docName || ''} — ${e.loc || (e.page ? `page ${e.page}` : '')}`).join(' | ')], ['Notes', (notes || []).map((n) => `${n.at} ${n.by}: ${n.text}`).join(' | ')], ['Note', 'An analysis review is not a payment and not a legal approval.']];
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
  const ret = useReturnTarget({ path: '/invoices', label: L('Collected invoices list', 'قائمة الفواتير المحصّلة') });
  const { data: det, loading, error } = useAsync(() => rev.data.invoice(id), [rev.data, id, reload]);
  const rec = det?.rec && det.rec.id === id ? det.rec : null; const der = rec ? det.derived : null;
  const contractNo = rec?.co || null;
  const { data: card } = useAsync(() => (contractNo ? rev.data.contract(contractNo).catch(() => null) : Promise.resolve(null)), [rev.data, contractNo]);
  const enf = useMemo(() => enforcementOf(id, rev.cases), [id, rev.cases]);
  const evidence = useMemo(() => evidenceForInvoice(id, rev.cases), [id, rev.cases]);
  const docIds = [...new Set(evidence.map((e) => e.docId).filter(Boolean))]; const files = useDocFiles(docIds, reload);
  const [msg, setMsg] = useState(null); const [text, setText] = useState(''); const [ev, setEv] = useState(0);
  const notes = rev.notes?.[id] || [];

  const crumbs = [{ label: L('Dashboards and reports', 'لوحة المعلومات والتقارير'), to: '/insights' }, { label: L('Collected invoices list', 'قائمة الفواتير المحصّلة'), to: '/invoices' }, { label: id, ltr: true }];
  if (!rec) {
    const notFound = !loading && !rec && (error?.status === 404 || (!error && det === null));
    return <div className="rp"><RecordHeader crumbs={crumbs} title={id} ret={ret} /><RecordState loading={loading && !error} error={error && error.status !== 404 ? error : null} notFound={notFound || error?.status === 404} onRetry={() => setReload((x) => x + 1)} kind={L('Invoice', 'الفاتورة')} backTo={{ path: '/invoices', label: L('Back to the invoices', 'العودة إلى الفواتير') }} /></div>;
  }

  const im = rec.iim;
  const reasons = RULE_IDS.filter((_, b) => der.reasonMask & (1 << b)).sort((a, b) => (a === der.primaryRuleId ? -1 : b === der.primaryRuleId ? 1 : 0));
  const records = exclusionRecordsOf(rec);
  const today = rev.cfg.cutoff;
  const pf = paymentFacts({ payments: rec.payments, dueDate: rec.dueDate, issueDate: rec.issueDate, net: der.net, payStatus: der.payStatus, today });
  const pendingEx = EXCLUSIONS_AUTO_APPLY ? [] : records.filter((e) => e.reviewStatus === 'pending' || !e.reviewStatus); // S6: reasons apply automatically (a reviewer can still reject one)
  const proposedLinks = enf.proposed;
  const decide = (ruleId, d) => { const r = rev.decideExclusion(id, d, '', ruleId); setMsg(r.ok ? { ok: true, t: L('Analysis decision recorded. It does not imply payment or legal approval.', 'سُجّل القرار التحليلي. ولا يعني سداداً ولا اعتماداً قانونياً.') } : { ok: false, t: B(ERR[r.error] || ERR.no_permission) }); };
  const linkAct = (kind, en) => { const r = kind === 'confirm' ? rev.enforcement.confirm(en, id, {}) : rev.enforcement.reject(en, id, {}); setMsg(r.ok ? { ok: true, t: kind === 'confirm' ? L('Link confirmed: the order status now shows on this invoice; its payment status is unchanged.', 'أُكِّد الرابط: تظهر حالة الأمر على هذه الفاتورة؛ وحالة السداد لم تتغير.') : L('Link rejected (kept in the history).', 'رُفض الرابط (محفوظ في السجل).') } : { ok: false, t: B(ERR[r.error] || { en: 'Could not record the decision.', ar: 'تعذّر تسجيل القرار.' }) }); };

  const findings = [];
  if (rec.amountCheck?.status === 'conflict') findings.push({ k: 'amount', tone: 'bad', title: L('Amount does not match the line items', 'المبلغ لا يطابق البنود'), why: L('The header amount differs from the sum of the line items (VAT shown apart).', 'مبلغ الرأس يختلف عن مجموع البنود (والضريبة منفصلة).'), evidence: L(`Header ${sar(rec.amountCheck.headerAmount)} · items ${sar(rec.amountCheck.lineTotal)} · difference ${sar(Math.abs(rec.amountCheck.difference))}. Not corrected: the metrics use the header amount.`, `الرأس ${sar(rec.amountCheck.headerAmount)} · البنود ${sar(rec.amountCheck.lineTotal)} · الفرق ${sar(Math.abs(rec.amountCheck.difference))}. لم يُصحَّح: تستخدم المؤشرات مبلغ الرأس.`), action: null });
  // risk flags that are still OPEN (the same rule as the Risks & Deviations page): a flag whose exclusion is already approved is a settled decision, shown under «التحليل والمراجعة», not here
  const RISK_FINDING = {
    duplicate: { en: ['Possible duplicate', 'The source marks this invoice as a duplicate, and no exclusion has been approved for it.'], ar: ['تكرار محتمل', 'يشير المصدر إلى أن هذه الفاتورة مكررة، ولم يُعتمد استبعاد لها.'] },
    struck_off_registry: { en: ['Struck-off commercial registry', 'The payer’s commercial registration is reported struck off, and no exclusion has been approved for it.'], ar: ['سجل تجاري مشطوب', 'السجل التجاري للدافع مبلغ عنه مشطوباً، ولم يُعتمد استبعاد لها.'] },
    deceased_person: { en: ['Deceased debtor', 'The debtor is reported deceased, and no exclusion has been approved for it.'], ar: ['مدين متوفى', 'المدين مبلغ عنه متوفى، ولم يُعتمد استبعاد لها.'] }
  };
  for (const [cat, state] of Object.entries(det.riskFlags || {})) if (state === 'open' && RISK_FINDING[cat]) findings.push({ k: `risk-${cat}`, tone: 'warn', title: L(RISK_FINDING[cat].en[0], RISK_FINDING[cat].ar[0]), why: L(RISK_FINDING[cat].en[1], RISK_FINDING[cat].ar[1]), evidence: null, action: null });
  for (const ex of pendingEx) findings.push({ k: `ex-${ex.ruleId}`, tone: 'warn', title: L('An exclusion is waiting for review', 'استبعاد بانتظار المراجعة'), why: L(`Rule ${ex.ruleId} flagged this invoice; until approved it stays inside the invoice value.`, `القاعدة ${ex.ruleId} أشارت إلى هذه الفاتورة؛ وتبقى ضمن قيمة الفاتورة حتى يُعتمد الاستبعاد.`), evidence: B(ex.evidence), action: ['ex', ex] });
  for (const o of proposedLinks) findings.push({ k: `pl-${o.enforceNum}`, tone: 'warn', title: L(`A proposed link to order ${o.enforceNum}`, `رابط مقترح بالأمر ${o.enforceNum}`), why: L('A reference in the order points to this invoice. A proposal has no effect until a person confirms it.', 'مرجع في الأمر يشير إلى هذه الفاتورة. والمقترح بلا أثر حتى يؤكده شخص.'), evidence: null, action: ['link', o] });
  if (im.investment?.outcome === 'not_linked') findings.push({ k: 'inv-no-contract', tone: 'warn', title: L('Investment invoice not linked to a contract', 'فاتورة استثمار غير مرتبطة بعقد'), why: L('This invoice is billed centrally (177) and Furas does not know it. It is flagged, not excluded.', 'هذه الفاتورة صادرة مركزيًا (177) ولا تعرفها منصة فرص. تُعلَّم ولا تُستبعد تلقائيًا.'), evidence: `${L('Possible causes', 'الأسباب المحتملة')}: ${im.investment.causes.map((c) => (ar ? c.ar : c.en)).join(' · ')}`, action: null });
  if (im.investment?.outcome === 'internal_note') findings.push({ k: 'inv-internal', tone: 'info', title: L('Investment invoice from an internal system', 'فاتورة استثمار صادرة من نظام داخلي'), why: L('An investment invoice issued from an internal system — it is not expected to be linked to the Furas platform. This is not a deviation.', 'فاتورة استثمار صادرة من نظام داخلي – لا يُتوقع ربطها بمنصة فرص. وهذه ليست انحرافًا.'), evidence: null, action: null });
  if (rec.contract?.status === 'unmatched' && im.investment?.outcome !== 'not_linked') findings.push({ k: 'contract', tone: 'info', title: L('Contract not matched', 'العقد غير مطابق'), why: L('This investment invoice carries no matched contract. It is NOT treated as “no contract”.', 'لا عقد مطابق لهذه الفاتورة الاستثمارية، ولا تُعامل على أنها «بلا عقد».'), evidence: L('No contract is inferred from an amount or a payer name.', 'لا يُستنتج عقد من مبلغ أو اسم دافع.'), action: null });
  if (rec.missingFields?.length) findings.push({ k: 'missing', tone: 'warn', title: L('Mandatory fields are missing', 'حقول إلزامية ناقصة'), why: L('The invoice cannot be referred as-is.', 'لا يمكن إحالة الفاتورة كما هي.'), evidence: rec.missingFields.join(', '), action: null });
  if (der.overpayment > 0) findings.push({ k: 'over', tone: 'info', title: L('Paid more than billed', 'مدفوع أكثر من المفوتر'), why: L('Cash received exceeds the invoice value.', 'المبلغ المحصل يتجاوز قيمة الفاتورة.'), evidence: L(`Overpayment ${sar(der.overpayment)} (kept outside «collected», which is capped at the invoice value).`, `زيادة ${sar(der.overpayment)} (خارج «المحصّل» المحدود بقيمة الفاتورة).`), action: null });
  if (rec.objection) findings.push({ k: 'obj', tone: 'info', title: L('Open objection', 'اعتراض مفتوح'), why: L('An objection is registered against this invoice.', 'يوجد اعتراض مسجّل على هذه الفاتورة.'), evidence: rec.objection.ref, action: null });
  if (enf.confirmed.length > 1) findings.push({ k: 'multi', tone: 'info', title: L(`Named by ${enf.confirmed.length} orders`, `مذكورة في ${enf.confirmed.length} أوامر`), why: L('One invoice can carry several orders (for example a closed one and a newer one). Enforcement status follows all of them.', 'قد تحمل الفاتورة الواحدة عدة أوامر (مثلاً أمر مغلق وأحدث منه). وتتبع حالة الإنفاذ كلها.'), evidence: enf.confirmed.map((o) => `${o.enforceNum} (${o.orderStatus})`).join(' · '), action: null });

  const enf1Dec = rev.enf1Decisions?.[id] || null; const orderList = [...enf.confirmed.map((o) => `${o.enforceNum} (${o.orderStatus})`), ...enf.withdrawn.map((o) => `${o.enforceNum} (link withdrawn)`)].join(', ') || '—';
  if (der.enfConflict) findings.push({ k: 'srcconf', tone: 'bad', title: L('Cancelled in the source yet referred — review', 'ملغاة في المصدر ومحالة للتنفيذ — تحتاج مراجعة'),
    why: L('The source system shows this invoice as cancelled, and an enforcement order is (or was) linked to it. Neither fact overrides the other: the invoice stays cancelled in every total, and no order event — confirmation, closing or withdrawal — changes an amount.', 'يُظهر النظام المصدر هذه الفاتورة ملغاة، وهناك أمر تنفيذ مرتبط بها (أو كان). لا تلغي إحدى الحقيقتين الأخرى: تبقى الفاتورة ملغاة في كل الإجماليات، ولا يغيّر أي حدث للأمر — تأكيداً أو إغلاقاً أو سحباً — أي مبلغ.'),
    evidence: L(`Cancelled in the source${rec.cancelled?.date ? ` on ${rec.cancelled.date}` : ''} · orders: ${orderList}. The established treatment is kept: the invoice stays cancelled in every total. The rule that would count such invoices as uncollected is not applied — its conditions and approver are not confirmed. No review action changes an amount.${enf1Dec ? ' A decision recorded earlier is kept in the history only and has no effect.' : ''}`, `أُلغيت في المصدر${rec.cancelled?.date ? ` بتاريخ ${rec.cancelled.date}` : ''} · الأوامر: ${orderList}. المعالجة المقررة محفوظة: تبقى الفاتورة ملغاة في كل الإجماليات. والقاعدة التي تعدّ مثل هذه الفواتير غير محصّلة غير مطبّقة — فشروطها وجهة اعتمادها غير مؤكدة. ولا يغيّر أي إجراء مراجعة أي مبلغ.${enf1Dec ? ' وقرار سُجّل سابقاً محفوظ في السجل فقط ولا أثر له.' : ''}`), action: null });

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
        crumbs={crumbs} ret={ret} kind={`${L('Invoice', 'فاتورة')} · ${typeLabel} · ${ar ? im.productAr : im.productEn} · ${L('Origin', 'مصدر الفاتورة')}: ${ar ? im.originAr : (im.origin === 'central' ? 'Central' : 'Internal')}`} title={id} id={null}
        statuses={<>
          <StatusGroup label={L('Payment status', 'حالة السداد')} hint={L('what was paid — separate from enforcement and review', 'ما سُدّد — منفصلة عن الإنفاذ والمراجعة')}><PayStatusChip status={der.payStatus} />{der.daysOverdue > 0 && der.outstanding > 0 && <span className="rv-tag rv-tag--warn">{der.daysOverdue} {L('days overdue', 'يوماً متأخرة')}</span>}</StatusGroup>
          <StatusGroup label={L('Enforcement status', 'حالة الإنفاذ')} hint={L('from confirmed orders only; “referred before” stays after an order closes', 'من الأوامر المؤكدة فقط؛ وتبقى «سبقت إحالتها» بعد إغلاق الأمر')}><EnforcementChips enf={enf} /></StatusGroup>
          <StatusGroup label={L('Review (this analysis)', 'المراجعة (هذا التحليل)')} hint={L('an analysis decision — not a payment or a legal approval', 'قرار تحليلي — وليس سداداً ولا اعتماداً قانونياً')}>{findings.filter((f) => f.action).length ? <span className="rv-tag rv-tag--warn">{L(`${findings.filter((f) => f.action).length} awaiting your decision`, `${findings.filter((f) => f.action).length} بانتظار قرارك`)}</span> : <span className="rv-tag rv-tag--ok">{L('No decision pending', 'لا قرار معلّق')}</span>}</StatusGroup>
        </>}
        actions={<><button type="button" className="btn btn-sm" onClick={() => exportReview(rec, der, enf, notes, evidence)}>{L('Export review report (CSV)', 'تصدير تقرير المراجعة (CSV)')}</button></>}
      />

      <div className="ip-top">
        <PaymentPanel pf={pf} rec={rec} today={today} ar={ar} sar={sar} L={L} />
        <MoneyPanel der={der} rec={rec} sar={sar} L={L} ar={ar} />
      </div>

      <InfoGroups groups={[
        { title: L('Invoice identity', 'تعريف الفاتورة'), items: [
          { k: L('SADAD no.', 'رقم السداد'), v: im.sadadNo, ltr: true },
          { k: L('Biller', 'المفوتر'), v: <span><span dir="ltr">{im.billerId}</span> / {ar ? im.billerAr : im.billerEn}</span> },
          { k: L('Product', 'اسم المنتج'), v: ar ? im.productAr : im.productEn },
          rec.violationNumber && { k: L('Violation no.', 'رقم المخالفة'), v: rec.violationNumber, ltr: true }
        ] },
        { title: L('Location and revenue classification', 'الموقع وتصنيف الإيراد'), items: [
          { k: L('Amanah / entity', 'الأمانة / الجهة'), v: `${ar ? rec.amanahAr : rec.amanahEn}${im.entityType === 'entity' ? ` (${ar ? im.entityTypeAr : 'entity'})` : ''}` },
          rec.municipalityEn && { k: L('Municipality', 'البلدية'), v: ar ? rec.municipalityAr : rec.municipalityEn },
          im.gfsCode && { k: L('Revenue account no.', 'رقم حساب الإيراد'), v: im.gfsCode, ltr: true },
          im.gfsSub && { k: L('Revenue sub-class', 'تصنيف الإيراد الفرعي'), v: <span>{im.gfsSub} <small className="muted" dir="ltr">({im.gfsCode})</small></span> },
          { k: L('Main revenue class', 'تصنيف الإيراد الرئيسي'), v: ar ? im.mainClass : (MAIN_EN[im.mainClass] || im.mainClass) },
          im.referenceNo && { k: L('Reference no.', 'الرقم المرجعي'), v: im.referenceNo, ltr: true },
          im.requestNo && { k: L('Request no.', 'رقم الطلب'), v: im.requestNo, ltr: true }
        ] },
        { title: L('Beneficiary', 'المستفيد'), items: [
          im.beneficiary?.id && { k: L('ID type', 'نوع هوية المستفيد'), v: ar ? im.beneficiary.idType.ar : im.beneficiary.idType.en },
          im.beneficiary?.id && { k: L('Beneficiary ID', 'هوية المستفيد'), v: im.beneficiary.id, ltr: true },
          { k: L('Beneficiary name', 'اسم المستفيد'), v: ar ? im.beneficiary?.name?.ar : im.beneficiary?.name?.en },
          im.beneficiary?.mobile && { k: L('Beneficiary mobile', 'جوال المستفيد'), v: im.beneficiary.mobile, ltr: true }
        ] },
        { title: L('Dates and amounts', 'التواريخ والمبالغ'), items: [
          { k: L('Issue date', 'تاريخ إصدار الفاتورة'), v: fmtDateText(rec.issueDate, ar ? 'ar' : 'en') },
          { k: L('Due date', 'تاريخ الاستحقاق'), v: fmtDateText(rec.dueDate, ar ? 'ar' : 'en') },
          im.paidDate && { k: L('Payment date', 'تاريخ السداد'), v: fmtDateText(im.paidDate, ar ? 'ar' : 'en') },
          im.settlementDate && { k: L('Settlement date', 'تاريخ التسوية'), v: fmtDateText(im.settlementDate, ar ? 'ar' : 'en') },
          im.cancelDate && { k: L('Cancellation date', 'تاريخ الإلغاء'), v: fmtDateText(im.cancelDate, ar ? 'ar' : 'en') },
          { k: L('Invoice amount', 'مبلغ الفاتورة'), v: sar(rec.grossAmount), ltr: true },
          im.revenueAmount > 0 && { k: L('Revenue amount', 'مبلغ الإيراد'), v: sar(im.revenueAmount), ltr: true },
          im.exclusion && { k: L('Exclusion reason', 'سبب الاستبعاد'), v: <span>{ar ? im.exclusion.reasonAr : im.exclusion.reasonEn}{im.exclusion.sourceAr && <small className="muted"> — {ar ? im.exclusion.sourceAr : im.exclusion.sourceEn}</small>}</span> }
        ] },
        { title: L('Status in the source systems', 'الحالة في أنظمة المصدر'), items: [
          { k: L('Source status (Tahseel)', 'حالة المصدر (تحصيل)'), v: rec.statusRawTahseel || '—' }, rec.statusRawEfaa && { k: L('Source status (Efaa)', 'حالة المصدر (إيفاء)'), v: rec.statusRawEfaa },
          { k: L('Unified state', 'الحالة الموحدة'), v: <span className={`rv-cat rv-cat--${det.cls}`}>{det.cls === 'collected' ? L('Collected', 'محصّلة') : B(CATEGORY_LABELS[det.cls])}</span> }
        ] }
      ]} />

      <SectionNav label={L('On this page', 'في هذه الصفحة')} items={[
        findings.length > 0 && { id: 'findings', label: L('Findings', 'ما يحتاج مراجعة'), count: findings.length },
        { id: 'payments', label: L('Payments', 'المدفوعات'), count: rec.payments.length },
        { id: 'analysis', label: L('Analysis and review', 'التحليل والمراجعة') },
        { id: 'orders', label: L('Enforcement', 'الإنفاذ'), count: orderLinks.length },
        (rec.co || im.investment) && { id: 'contract', label: L('Contract', 'العقد') },
        im.disclosure && { id: 'disclosure', label: L('Disclosure', 'الإفصاح') },
        { id: 'history', label: L('History', 'السجل'), count: timeline.length }
      ]} />

      {msg && <div className={`rv-callout ${msg.ok ? '' : 'rv-callout--bad'}`} role="status" aria-live="polite">{msg.t}</div>}

      {der.cancelled && (
        <Section id="separate" title={L('Cancellation, exclusion, balance and enforcement — kept separate', 'الإلغاء والاستبعاد والرصيد والإنفاذ — منفصلة')}>
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Cancellation, exclusion, balance and enforcement', 'الإلغاء والاستبعاد والرصيد والإنفاذ')}><tbody>{[
            { k: L('Source cancellation', 'الإلغاء في المصدر'), v: der.sourceCancelled ? L(`Cancelled in the source${rec.cancelled?.date ? ` (${rec.cancelled.date})` : ''}`, `ملغاة في المصدر${rec.cancelled?.date ? ` (${rec.cancelled.date})` : ''}`) : L('Not cancelled at the reference date', 'غير ملغاة في التاريخ المرجعي') },
            { k: L('Effective treatment (exclusion / review)', 'المعالجة الفعلية (استبعاد / مراجعة)'), v: der.enfConflict ? L('The cancellation in the source stands; flagged for review.', 'الإلغاء في المصدر قائم؛ ومعلَّم للمراجعة.') : der.cancelled ? L('Excluded as cancelled (counted once)', 'مستبعدة كملغاة (تُحتسب مرة)') : L('No cancellation exclusion', 'لا استبعاد للإلغاء') },
            { k: L('Remaining collectible balance', 'الرصيد القابل للتحصيل المتبقي'), v: sar(der.outstanding), ltr: true },
            { k: L('Payment status', 'حالة السداد'), v: <PayStatusChip status={der.payStatus} /> },
            { k: L('Active enforcement', 'الإنفاذ الحالي'), v: <EnforcementChips enf={enf} /> },
            { k: L('Historical referral', 'الإحالة التاريخية'), v: enf.referredEver ? L('Referred before', 'سبقت إحالتها') : L('Never referred', 'لم تُحَل') }
          ].map((x) => <tr key={x.k}><th scope="row" style={{ width: '32%', textAlign: 'start' }}>{x.k}</th><td dir={x.ltr ? 'ltr' : 'auto'}>{x.v}</td></tr>)}</tbody></table></div>
          <div className="rp-limit">{L('A source cancellation, the exclusion/review decision, the remaining balance, the payment status and enforcement are different facts. An order never reinstates or removes an amount by itself; closing or withdrawing an order never implies payment and never erases the referral from the history.', 'الإلغاء في المصدر وقرار الاستبعاد/المراجعة والرصيد المتبقي وحالة السداد والإنفاذ خمس حقائق مختلفة. لا يعيد الأمر مبلغاً ولا يزيله بذاته؛ وإغلاق الأمر أو سحبه لا يعني السداد ولا يمحو الإحالة من السجل.')}</div>
          <Enf1Explainer />
        </Section>
      )}

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

      <Section id="payments" title={L('Payments', 'المدفوعات')} count={pf.count} note={<div className="rp-limit">{L('Payments up to the reference date, in date order. «Against the due date» compares each payment date with the due date; the balance is the invoice value minus what had been paid up to that payment.', 'المدفوعات حتى تاريخ المرجع بترتيب التاريخ. «مقابل الاستحقاق» يقارن تاريخ كل دفعة بتاريخ الاستحقاق، والرصيد هو قيمة الفاتورة ناقص المدفوع حتى تلك الدفعة.')}</div>}>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Payments', 'المدفوعات')}>
          <thead><tr><th>{L('Payment date', 'تاريخ الدفع')}</th><th>{L('Channel', 'القناة')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Against the due date', 'مقابل الاستحقاق')}</th><th className="num">{L('Balance after', 'الرصيد بعدها')}</th></tr></thead>
          <tbody>{pf.rows.length ? pf.rows.map((p, i) => <tr key={i}><td dir="ltr">{p.date}{pf.settled === p.date && <> <span className="rv-tag rv-tag--ok">{L('settled', 'سداد كامل')}</span></>}</td><td>{B(CHANNEL[p.channel] || { en: p.channel, ar: p.channel })}</td><td className="num" dir="ltr">{sar(p.amount)}</td><td>{p.offset == null ? '—' : p.offset > 0 ? <span className="rp-bad">{L(`${p.offset} d after`, `بعد ${p.offset} يوماً`)}</span> : p.offset < 0 ? L(`${-p.offset} d before`, `قبل ${-p.offset} يوماً`) : L('on the due date', 'في يوم الاستحقاق')}</td><td className="num" dir="ltr">{sar(p.balance)}</td></tr>) : <tr><td colSpan={5} className="muted">{L('No payment recorded up to the reference date.', 'لا دفعات مسجلة حتى التاريخ المرجعي.')}</td></tr>}</tbody>
          {pf.rows.length > 1 && <tfoot><tr><th colSpan={2}>{L('Total paid', 'إجمالي المدفوع')}</th><td className="num" dir="ltr"><b>{sar(pf.paid)}</b></td><td /><td className="num" dir="ltr">{sar(pf.remaining)}</td></tr></tfoot>}
        </table></div>
      </Section>

      <Section id="items" secondary title={L('Line items and source record', 'البنود والسجل المصدري')}>
        <div className="rp-tablewrap" tabIndex={0}><table>
          <thead><tr><th>#</th><th>{L('Item', 'البند')}</th><th className="num">{L('Amount', 'المبلغ')}</th></tr></thead>
          <tbody>{(rec.lineItems || []).map((li) => <tr key={li.no}><td>{li.no}</td><td dir="auto">{li.name}</td><td className="num" dir="ltr">{sar(li.amount)}</td></tr>)}</tbody>
        </table></div>
        <SourceRecordSection sr={det.sourceRecord} />
      </Section>

      <Section id="analysis" title={L('Analysis and review', 'التحليل والمراجعة')}>
        <div className="rp-limit">{L('Source figures (amounts, dates, payer) are not edited here — they are corrected in the source system. What can be reviewed here: exclusion decisions, enforcement links, and notes. A review decision is an analytical decision in this solution; it does not mean payment and is not a legal approval.', 'أرقام المصدر (المبالغ والتواريخ والدافع) لا تُعدَّل هنا — تُصحَّح في النظام المصدر. ما يُراجَع هنا: قرارات الاستبعاد وروابط الإنفاذ والملاحظات. والقرار المراجَع قرار تحليلي في هذه المنصة؛ لا يعني سداداً وليس اعتماداً قانونياً.')}</div>
        {records.length ? records.map((ex) => {
          const rule = ruleById(ex.ruleId);
          return (
            <div key={ex.ruleId} className="rp-ev__item">
              <div><b>{ex.category.replace(/_/g, ' ')}</b> · <span dir="ltr">{ex.ruleId}</span> {rule && <span className="rv-tag">{B(RULE_APPROVAL_LABEL[rule.approval])}</span>} — {ex.reviewStatus === 'approved' ? L('approved', 'معتمد') : ex.reviewStatus === 'rejected' ? L('rejected', 'مرفوض') : L('pending: stays in the invoice value', 'معلّق: يبقى ضمن قيمة الفاتورة')}</div>
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
                  <td><OrderStatusChip status={st} />{st === 'closed' && <div className="muted" style={{ fontSize: 12 }}>{c.source?.statusText || L('closure reason unknown', 'سبب الإغلاق غير معروف')}</div>}{st === 'closed' && <div className="muted" style={{ fontSize: 11 }}>{L('closing an order does not mean payment', 'إغلاق الأمر لا يعني السداد')}</div>}</td>
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
                  <div><b dir="ltr">{e.enforceNum}</b> · {e.docName ? <span dir="ltr">{e.docName}</span> : null} · {e.loc ? locLabel(e.loc, ar) : <>{L('page', 'صفحة')} {e.page ?? '—'}</>}</div>
                  <div className="muted">{files[e.docId] === false ? L('original PDF unavailable', 'ملف PDF الأصلي غير متاح') : B(ORIGIN_LABEL[`document_${e.method}`] || ORIGIN_LABEL[e.method] || { en: String(e.method || ''), ar: String(e.method || '') })}</div>
                  {e.snippet && <div className="rp-ev__snip" dir="ltr">“{e.snippet}”</div>}
                </button>
              ))}
            </div>
          </div>
        )}
        {evidence.length === 0 && orderLinks.length > 0 && <div className="rp-limit">{L('No document evidence: these links rest on Sanad’s structured references only.', 'لا دليل مستندي: هذه الروابط تستند إلى مراجع سند المهيكلة فقط.')}</div>}
      </Section>

      {im.disclosure && (
        <Section id="disclosure" title={L('Disclosure details', 'تفاصيل الإفصاح')}>
          <Facts items={[
            { k: L('Invoice type', 'نوع الفاتورة'), v: im.disclosure.kind === 'occupancy' ? L('Occupancy (declared by the taxpayer)', 'إشغالات (إفصاح من المكلف)') : L('Differences (from the audit)', 'فروقات (ناتجة عن التدقيق)') },
            { k: L('Taxpayer', 'اسم المكلف'), v: ar ? im.disclosure.taxpayer.ar : im.disclosure.taxpayer.en },
            { k: L('Facility', 'المنشأة'), v: <span>{ar ? im.disclosure.facility.ar : im.disclosure.facility.en} <small className="muted" dir="ltr">({im.disclosure.facility.key})</small></span> },
            im.disclosure.year && { k: L('Disclosure year', 'سنة الإفصاح'), v: String(im.disclosure.year), ltr: true },
            im.disclosure.month && { k: L('Disclosure month', 'شهر الإفصاح'), v: String(im.disclosure.month), ltr: true }
          ].filter(Boolean)} />
        </Section>
      )}

      {(rec.co || im.investment) && (
        <Section id="contract" title={L('Related contract', 'العقد المرتبط')}>
          <Facts items={[
            { k: L('Linked to a contract', 'مرتبطة بعقد'), v: rec.co ? L('Yes', 'نعم') : L('No', 'لا') },
            rec.co && { k: L('Contract', 'العقد'), v: <RecordLink to={contractPath(rec.co)} dir="ltr">{rec.co}</RecordLink> },
            rec.co && card && { k: L('Tenant', 'المستأجر'), v: ar ? card.tenantAr : card.tenantEn }, rec.co && card && { k: L('Contract status', 'حالة العقد'), v: card.status },
            rec.co && myPay && card && { k: L('Payment', 'الدفعة'), v: ar ? `الدفعة ${myPay.no} من ${card.schedule.length}` : `Payment ${myPay.no} of ${card.schedule.length}` },
            rec.co && card && { k: L('Contract value', 'قيمة العقد'), v: short(card.totals.contractValue), ltr: true }
          ].filter(Boolean)} />
          {rec.co ? <div className="rp-limit">{L('The contract is the one recorded on the invoice (Furas). It was not inferred from an amount or a payer name.', 'العقد هو المسجّل على الفاتورة (فرص). ولم يُستنتج من مبلغ أو اسم دافع.')}</div>
            : <div className="muted">{im.investment?.outcome === 'internal_note' ? L('An investment invoice issued from an internal system: it is not expected to be linked to the Furas platform.', 'فاتورة استثمار صادرة من نظام داخلي: لا يُتوقع ربطها بمنصة فرص.') : L('No contract is linked to this invoice — see the finding above (it is not treated as “no contract” automatically).', 'لا عقد مرتبط بهذه الفاتورة — راجع الملاحظة أعلاه (ولا تُعامل كـ«بلا عقد» تلقائيًا).')}</div>}
        </Section>
      )}

      <Section id="history" secondary title={L('History', 'السجل')} count={timeline.length}>
        <ol className="rv-timeline">{timeline.map((e, i) => <li key={i}><span dir="ltr" className="muted">{String(e.d || '—').length > 10 ? fmtRiyadh(e.d) : e.d || '—'}</span> {e.t}</li>)}</ol>
      </Section>
    </div>
  );
}
