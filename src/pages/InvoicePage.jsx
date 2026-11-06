import React, { useMemo, useState } from 'react';
import useGate from '../components/access/useGate';
import { useParams, Link } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useAsync } from '../utils/useAsync';
import { useL } from '../utils/bi';
import { shownActor } from '../utils/actor';
import { RecordHeader, StatusGroup, Facts, Section, RecordState, Finding } from '../components/record/RecordPage';
import PdfPreview, { useDocFiles } from '../components/record/PdfPreview';
import SourceRecordSection from '../components/revenue/SourceRecordSection';
import { InvoiceSummary, ExclusionBanner, InfoGroups, SectionNav } from '../components/record/InvoiceParts';
import { paymentFacts } from '../data/invoicePayments';
import { contractStatusText } from '../data/contracts';
import { PayStatusChip, OrderStatusChip, Chip, EnforcementChips, LINK_STATUS_LABEL, CONFLICT_LABEL, SOURCE_LABEL, Enf1Explainer } from '../components/revenue/EnforcementUI';
import { RecordLink, useReturnTarget } from '../utils/returnContext';
import { orderPath, contractPath, invoicePath } from '../utils/paths';
import { enforcementOf, evidenceForInvoice, CLOSE_REASON_LABEL } from '../data/relations';
import { exclusionRecordsOf, ruleById, CATEGORY_LABELS } from '../data/revenueMetrics';
import { RULE_APPROVAL_LABEL } from '../data/ruleRegistry';
import { RULE_IDS } from '../data/catalog';
import { MUNICIPALITY_NOT_SPECIFIED, STATUS_LABEL } from '../data/municipalityModel';
import { REVENUE_SOURCES } from '../data/revenueLedger';
import { ORIGIN_LABEL, unresolvedConflicts } from '../data/orderMatching';
import { fmtRiyadh, fmtDateText } from '../data/clock';
import { MAIN, MAIN_EN, EXCLUSIONS_AUTO_APPLY, EXCLUSION_REASONS } from '../data/iim';
import { locLabel } from '../data/docxText';

const CHANNEL = { sadad: { en: 'SADAD', ar: 'سداد' }, voluntary: { en: 'Voluntary', ar: 'طوعي' }, enforcement: { en: 'Enforcement', ar: 'تنفيذ' }, transfer: { en: 'Transfer', ar: 'تحويل' }, card: { en: 'Card', ar: 'بطاقة' }, wallet: { en: 'Wallet', ar: 'محفظة' } };
function exportReview(rec, der, enf, notes, evidence = []) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Invoice review report (demo data)', ''], ['Invoice number', rec.id], ['Revenue source', rec.revenueSource], ['Payer', rec.entityEn], ['Amanah', rec.amanahEn], ['Issue date', rec.issueDate], ['Due date', rec.dueDate],
    ['Gross billed (SAR)', der.gross], ['Exclusions (SAR)', der.exclusionsTotal], ['Collected (SAR)', der.collected], ['Remaining balance (SAR)', der.outstanding], ['Payment status', der.payStatus],
    ['Source cancelled', der.sourceCancelled ? 'yes' : 'no'], ['Source/enforcement conflict (review required)', der.enfConflict ? 'yes' : 'no'], ['Enforcement now', enf.current], ['Referred before', enf.referredEver ? 'yes' : 'no'], ['Confirmed orders', enf.confirmed.map((o) => `${o.enforceNum}:${o.orderStatus}`).join(' | ')], ['Proposed orders (no effect)', enf.proposed.map((o) => o.enforceNum).join(' | ')],
    ['Link evidence (method — document — location)', evidence.map((e) => `${e.enforceNum}: ${e.method || ''} — ${e.docName || ''} — ${e.loc || (e.page ? `page ${e.page}` : '')}`).join(' | ')], ['Notes', (notes || []).map((n) => `${n.at} ${shownActor(n.by)}: ${n.text}`).join(' | ')], ['Note', 'An analysis review is not a payment and not a legal approval.']];
  const blob = new Blob([`\uFEFF${lines.map((r) => r.map(esc).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `invoice-review-${rec.id}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

const ERR = {
  no_permission: { en: 'This role is read-only: it cannot decide here.', ar: 'هذا الدور للقراءة فقط: لا يمكنه اتخاذ القرار هنا.' },
  unresolved_conflict: { en: 'This link has a conflict that no evidence resolves. A reason does not resolve it: open the order to review the evidence, or leave the link unresolved.', ar: 'في هذا الرابط تعارض لا يحسمه دليل. والسبب المكتوب لا يحسمه: افتح الأمر لمراجعة الأدلة أو اترك الرابط غير محسوم.' }
};

// ONE full page per invoice: essential summary first, findings that need action, then a few sections. Statuses are kept apart on purpose:
// PAYMENT (what was paid) · ENFORCEMENT (current / historical, from confirmed order links) · REVIEW (this analysis) — reviewing or confirming never implies payment or legal approval.
const CONTRACT_STATE = { linked: { en: 'Linked', ar: 'مرتبط' }, unmatched: { en: 'Not matched', ar: 'غير مطابق' }, confirmed_none: { en: 'No contract (confirmed)', ar: 'لا يوجد عقد (مؤكد)' }, unlinked: { en: 'Not linked', ar: 'غير مرتبط' }, unverified: { en: 'Not verified', ar: 'لم يُتحقق منه' } };

export default function InvoicePage() {
  const { id: rawId } = useParams(); const urlId = decodeURIComponent(rawId || ''); // the URL may carry the composite key, the internal id (old links) or a bare number
  const rev = useRevenue();
  const { L, B, ar, sar, short } = useL();
  const xg = useGate('export.invoice'); const { canDo } = rev; // exclusion decisions → the exclusions module; link decisions → the enforcement module (both blocked for a read-only role); the review report exports with any module that opens the invoice
  const [reload, setReload] = useState(0);
  const { data: det, loading, error } = useAsync(() => rev.data.invoice(urlId), [rev.data, urlId, reload]);
  const rec = det?.rec && (det.rec.id === urlId || det.rec.iim?.compositeKey === urlId) ? det.rec : null; const der = rec ? det.derived : null;
  const fromLists = der && (der.payStatus === 'collected' || der.outstanding <= 0) ? { path: '/invoices', label: L('Collected invoices list', 'قائمة الفواتير المحصّلة') } : { path: '/collection', label: L('Uncollected invoices list', 'قائمة الفواتير غير المحصّلة') };
  const ret = useReturnTarget(fromLists); // the list the person came from; without one, the list this invoice belongs to by its payment status
  const id = rec ? rec.id : urlId; // everything stored about the invoice (notes, decisions, links) keeps using its internal id, which maps to exactly one invoice
  const contractNo = rec?.co || null;
  const { data: card } = useAsync(() => (contractNo ? rev.data.contract(contractNo).catch(() => null) : Promise.resolve(null)), [rev.data, contractNo]);
  const enf = useMemo(() => enforcementOf(id, rev.cases), [id, rev.cases]);
  const evidence = useMemo(() => evidenceForInvoice(id, rev.cases), [id, rev.cases]);
  const docIds = [...new Set(evidence.map((e) => e.docId).filter(Boolean))]; const files = useDocFiles(docIds, reload);
  const [msg, setMsg] = useState(null); const [text, setText] = useState(''); const [ev, setEv] = useState(0);
  const notes = rev.notes?.[id] || [];

  const crumbs = [{ label: L('Dashboards and reports', 'لوحة المعلومات والتقارير'), to: '/insights' }, { label: ret.label, to: ret.path }, { label: id, ltr: true }];
  if (!rec && error?.status === 409 && error.body?.error === 'invoice_ambiguous') {
    // several invoices carry this number (it can repeat across Amanahs / GFS codes): the person chooses — nothing is opened silently
    const cs = error.body.candidates || [];
    return (
      <div className="rp"><RecordHeader crumbs={crumbs} title={id} ret={ret} />
        <section className="card card-pad" role="alert"><h2 className="rv-sec-title">{L('Several invoices carry this number', 'عدة فواتير تحمل هذا الرقم')}</h2>
          <p className="muted">{L('An invoice number can repeat between Amanahs. Choose the invoice you mean.', 'قد يتكرر رقم الفاتورة بين الأمانات. اختر الفاتورة المقصودة.')}</p>
          <div className="rv-table-wrap" tabIndex={0}><table className="rv-table"><thead><tr><th scope="col">{L('Invoice number', 'رقم الفاتورة')}</th><th scope="col">{L('GFS code', 'رمز حساب الإيراد')}</th><th scope="col">{L('Amanah / municipality', 'الأمانة / البلدية')}</th><th scope="col">{L('Source', 'المصدر')}</th><th scope="col">{L('Amount', 'المبلغ')}</th><th scope="col">{L('Status', 'الحالة')}</th><th scope="col"><span className="sr-only">{L('Open', 'فتح')}</span></th></tr></thead>
            <tbody>{cs.map((c) => (<tr key={c.compositeKey || c.id}><td dir="ltr">{c.invoiceNo}</td><td dir="ltr">{c.gfsCode || '—'}</td><td>{ar ? c.amanahAr : c.amanahEn}{(ar ? c.municipalityAr : c.municipalityEn) ? ` · ${ar ? c.municipalityAr : c.municipalityEn}` : ''}</td><td>{c.platform || c.source || '—'}</td><td dir="ltr">{c.amount == null ? '—' : sar(c.amount)}</td><td>{c.status ? (CATEGORY_LABELS[c.status] ? B(CATEGORY_LABELS[c.status]) : c.status) : '—'}</td>
              <td><Link className="btn btn-sm" to={invoicePath(c.compositeKey || c.id)}>{L('Open', 'فتح')}</Link></td></tr>))}</tbody></table></div></section></div>
    );
  }
  if (!rec) {
    const notFound = !loading && !rec && (error?.status === 404 || (!error && det === null));
    return <div className="rp"><RecordHeader crumbs={crumbs} title={id} ret={ret} /><RecordState loading={loading && !error} error={error && error.status !== 404 ? error : null} notFound={notFound || error?.status === 404} onRetry={() => setReload((x) => x + 1)} kind={L('Invoice', 'الفاتورة')} backTo={{ path: '/invoices', label: L('Back to the invoices', 'العودة إلى الفواتير') }} /></div>;
  }

  const im = rec.iim; const muniStatus = im?.municipalityStatus || 'not_specified';
  const reasons = RULE_IDS.filter((_, b) => der.reasonMask & (1 << b)).sort((a, b) => (a === der.primaryRuleId ? -1 : b === der.primaryRuleId ? 1 : 0));
  const records = exclusionRecordsOf(rec);
  const today = rev.cfg.cutoff;
  const pf = paymentFacts({ payments: rec.payments, dueDate: rec.dueDate, issueDate: rec.issueDate, net: der.excluded ? der.billedAfterAdj : der.net, payStatus: der.payStatus, today, overdueDays: der.daysOverdue, graceDays: rev.cfg.graceDays || 0 });
  const pendingEx = EXCLUSIONS_AUTO_APPLY ? [] : records.filter((e) => e.reviewStatus === 'pending' || !e.reviewStatus); // S6: reasons apply automatically (a reviewer can still reject one)
  const proposedLinks = enf.proposed;
  const decide = (ruleId, d) => { const r = rev.decideExclusion(id, d, '', ruleId); setMsg(r.ok ? { ok: true, t: L('Analysis decision recorded. It does not imply payment or legal approval.', 'سُجّل القرار التحليلي. ولا يعني سداداً ولا اعتماداً قانونياً.') } : { ok: false, t: B(ERR[r.error] || ERR.no_permission) }); };
  const linkAct = (kind, en) => { const r = kind === 'confirm' ? rev.enforcement.confirm(en, id, {}) : rev.enforcement.reject(en, id, {}); setMsg(r.ok ? { ok: true, t: kind === 'confirm' ? L('Link confirmed: the order status now shows on this invoice; its payment status is unchanged.', 'أُكِّد الرابط: تظهر حالة الأمر على هذه الفاتورة؛ وحالة السداد لم تتغير.') : L('Link rejected (kept in the history).', 'رُفض الرابط (محفوظ في السجل).') } : { ok: false, t: B(ERR[r.error] || { en: 'Could not record the decision.', ar: 'تعذّر تسجيل القرار.' }) }); };

  const findings = [];
  if (rec.amountCheck?.status === 'conflict') findings.push({ k: 'amount', tone: 'bad', title: L('Amount does not match the line items', 'المبلغ لا يطابق البنود'), why: L('The header amount differs from the sum of the line items (VAT shown apart).', 'مبلغ الرأس يختلف عن مجموع البنود (والضريبة منفصلة).'), evidence: L(`Header ${sar(rec.amountCheck.headerAmount)} · items ${sar(rec.amountCheck.lineTotal)} · difference ${sar(Math.abs(rec.amountCheck.difference))}. Not corrected: the metrics use the header amount.`, `الرأس ${sar(rec.amountCheck.headerAmount)} · البنود ${sar(rec.amountCheck.lineTotal)} · الفرق ${sar(Math.abs(rec.amountCheck.difference))}. لم يُصحَّح: تستخدم المؤشرات مبلغ الرأس.`), action: null });
  // risk flags that are still OPEN : a flag whose exclusion is already approved is a settled decision, shown under «التحليل والمراجعة», not here
  const RISK_FINDING = {
    duplicate: { en: ['Possible duplicate', 'The source marks this invoice as a duplicate, and no exclusion has been approved for it.'], ar: ['تكرار محتمل', 'يشير المصدر إلى أن هذه الفاتورة مكررة، ولم يُعتمد استبعاد لها.'] },
    struck_off_registry: { en: ['Struck-off commercial registry', 'The payer’s commercial registration is reported struck off, and no exclusion has been approved for it.'], ar: ['سجل تجاري مشطوب', 'السجل التجاري للدافع مبلغ عنه مشطوباً، ولم يُعتمد استبعاد لها.'] }
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
  if (der.enfConflict) findings.push({ k: 'srcconf', tone: 'bad', title: L('Source/enforcement conflict — review required', 'تعارض بين المصدر والتنفيذ — يحتاج مراجعة'),
    why: L('The source system shows this invoice as cancelled, and a confirmed enforcement order is (or was) linked to it. Neither fact overrides the other: the source status is kept, no payment record is touched, and the invoice is excluded as «linked to a confirmed enforcement order» (the uncollected remainder, counted once). A reviewer decides which fact is right.', 'يُظهر النظام المصدر هذه الفاتورة ملغاة، وهناك أمر تنفيذ مؤكد مرتبط بها (أو كان). لا تلغي إحدى الحقيقتين الأخرى: تبقى حالة المصدر كما هي، ولا يُمسّ أي سجل سداد، وتُستبعد الفاتورة كـ«مرتبطة بأمر تنفيذ مؤكد» (المتبقي غير المحصّل، مرة واحدة). ويقرّر المراجع أي الحقيقتين الصحيحة.'),
    evidence: L(`Cancelled in the source${rec.cancelled?.date ? ` on ${rec.cancelled.date}` : ''} · orders: ${orderList}. Enforcement is not payment and not cancellation; closing an order does not remove the exclusion by itself.${enf1Dec ? ' A decision recorded earlier is kept in the history only.' : ''}`, `أُلغيت في المصدر${rec.cancelled?.date ? ` بتاريخ ${rec.cancelled.date}` : ''} · الأوامر: ${orderList}. والتنفيذ ليس سداداً ولا إلغاءً؛ وإغلاق الأمر لا يزيل الاستبعاد من تلقاء نفسه.${enf1Dec ? ' وقرار سُجّل سابقاً محفوظ في السجل فقط.' : ''}`), action: null });

  const myPay = card?.schedule?.find((p) => p.invoiceNo === id);
  const sndEx = (det?.rec?.exclusions || []).find((e) => e.ruleId === 'SND-1') || null; const sndSrc = (f) => sndEx?.sources?.find((x) => x.field === f)?.value || null; // the enforcement-link exclusion and its evidence (order, reviewer, time, document)
  const uploadedEx = (det?.rec?.exclusions || []).find((e) => e.file && e.ruleId === det?.rec?.iim?.exclusion?.ruleId) || null; // R8 / R9: the file the exclusion came from
  const orderLinks = rev.cases.map((c) => ({ c, l: (c.links || []).find((x) => x.invoiceId === id && (x.status === 'confirmed' || x.status === 'candidate' || x.ledgerStatus === 'removed')) })).filter((x) => x.l);
  const activeEv = evidence[Math.min(ev, Math.max(0, evidence.length - 1))];
  const activeDoc = activeEv ? rev.cases.find((c) => c.enforceNum === activeEv.enforceNum)?.docs?.find((d) => d.id === activeEv.docId) : null;
  // the party type comes from the data only: an investment invoice is issued to an investor (Furas), a commercial-registration holder is a company / establishment, a national-ID holder is an individual
  const idT = im.beneficiary?.idType?.en; const partyType = rec.revenueSource === 'investment' ? L('Investor', 'مستثمر') : idT === 'Commercial registration' ? L('Company / establishment', 'شركة / منشأة') : idT === 'National ID' ? L('Individual', 'فرد') : <span className="muted">{L('Not available', 'غير متوفر')}</span>;
  const sourceKey = rec.revenueSource; const typeLabel = B(SOURCE_LABEL[sourceKey] || (REVENUE_SOURCES[sourceKey] ? REVENUE_SOURCES[sourceKey] : { en: sourceKey, ar: sourceKey }));

  return (
    <div className="rp">
      <RecordHeader
        crumbs={crumbs} ret={ret} kind={`${L('Invoice', 'فاتورة')} · ${typeLabel} · ${ar ? im.mainClass : (MAIN_EN[im.mainClass] || im.mainClass)}`} title={id} id={null}
        statuses={<>
          <StatusGroup label={L('Payment status', 'حالة السداد')}><PayStatusChip status={der.payStatus} />{der.daysOverdue > 0 && der.outstanding > 0 && <span className="rv-tag rv-tag--warn">{der.daysOverdue} {L('days overdue', 'يوماً متأخرة')}</span>}</StatusGroup>
          <StatusGroup label={L('Enforcement status', 'حالة الإنفاذ')}><EnforcementChips enf={enf} /></StatusGroup>
          <StatusGroup label={L('Review (this analysis)', 'المراجعة (هذا التحليل)')}>{findings.filter((f) => f.action).length ? <span className="rv-tag rv-tag--warn">{L(`${findings.filter((f) => f.action).length} awaiting your decision`, `${findings.filter((f) => f.action).length} بانتظار قرارك`)}</span> : <span className="rv-tag rv-tag--ok">{L('No decision pending', 'لا قرار معلّق')}</span>}</StatusGroup>
        </>}
        actions={<><button type="button" className="btn btn-sm" disabled={!xg.allowed} title={xg.reason || undefined} onClick={() => exportReview(rec, der, enf, notes, evidence)}>{L('Export review report (CSV)', 'تصدير تقرير المراجعة (CSV)')}</button></>}
      />

      <ExclusionBanner der={der} im={im} reasons={reasons} uploadedFile={uploadedEx?.file?.name} sar={sar} L={L} ar={ar} />
      <InvoiceSummary der={der} rec={rec} im={im} pf={pf} sar={sar} L={L} ar={ar} />

      <InfoGroups groups={[
        { title: L('Invoice information and dates', 'معلومات الفاتورة والتواريخ'), items: [
          { k: L('Invoice number', 'رقم الفاتورة'), v: im.invoiceNo, ltr: true },
          { k: L('SADAD no.', 'رقم السداد'), v: im.sadadNo, ltr: true },
          { k: L('Description', 'الوصف'), v: <span>{B(rec.revenueItem)} · {ar ? im.productAr : im.productEn}</span> },
          im.gfsCode && { k: L('Revenue account no.', 'رقم حساب الإيراد'), v: im.gfsCode, ltr: true },
          im.gfsSub && { k: L('Revenue sub-class', 'تصنيف الإيراد الفرعي'), v: im.gfsSub },
          im.referenceNo && { k: L('Reference no.', 'الرقم المرجعي'), v: im.referenceNo, ltr: true },
          im.requestNo && { k: L('Request no.', 'رقم الطلب'), v: im.requestNo, ltr: true },
          { k: L('Issue date', 'تاريخ الإصدار'), v: fmtDateText(rec.issueDate, ar ? 'ar' : 'en') },
          { k: L('Due date', 'تاريخ الاستحقاق'), v: fmtDateText(rec.dueDate, ar ? 'ar' : 'en') },
          im.paidDate && { k: L('Payment date', 'تاريخ السداد'), v: fmtDateText(im.paidDate, ar ? 'ar' : 'en') },
          im.settlementDate && { k: L('Settlement date', 'تاريخ التسوية'), v: fmtDateText(im.settlementDate, ar ? 'ar' : 'en') },
          im.cancelDate && { k: L('Cancellation date', 'تاريخ الإلغاء'), v: fmtDateText(im.cancelDate, ar ? 'ar' : 'en') },
          im.revenueAmount > 0 && { k: L('Revenue amount', 'مبلغ الإيراد'), v: sar(im.revenueAmount), ltr: true }
        ] },
        // issuing entity, Amanah, municipality and source system are four separate fields; nothing is inferred when a value is missing
        { title: L('Issuing entity, Amanah and municipality', 'الجهة المصدرة والأمانة والبلدية'), items: [
          { k: L('Issuing entity', 'الجهة المصدرة'), v: <span>{ar ? im.billerAr : im.billerEn} <small className="muted" dir="ltr">({L('biller', 'مفوتر')} {im.billerId})</small></span> },
          im.entityType === 'entity' && { k: L('Entity (sector)', 'الجهة (قطاع)'), v: ar ? rec.amanahAr : rec.amanahEn },
          { k: L('Amanah', 'الأمانة'), v: im.entityType === 'amanah' ? (ar ? rec.amanahAr : rec.amanahEn) : <span className="muted">{L('Not applicable — the entity is not an Amanah', 'غير منطبق — الجهة ليست أمانة')}</span> },
          // the municipality is a field of its own (never merged into the Amanah). Mapped → the reference name; otherwise the status wording, never an inferred name
          { k: L('Municipality', 'البلدية'), v: muniStatus === 'mapped' ? (ar ? im.municipalityAr : im.municipalityEn) : im.entityType !== 'amanah' ? <span className="muted">{L('Not applicable', 'غير منطبقة')}</span> : <span className="muted">{muniStatus === 'not_specified' ? L(MUNICIPALITY_NOT_SPECIFIED.en, MUNICIPALITY_NOT_SPECIFIED.ar) : muniStatus === 'direct_amanah' ? L('None — the Amanah issues directly', 'لا توجد — الأمانة تصدر مباشرة') : L('Not matched to the reference', 'غير مطابقة للمرجع')}</span> },
          im.entityType === 'amanah' && muniStatus !== 'mapped' && { k: L('Municipality status', 'حالة تحديد البلدية'), v: <span>{ar ? STATUS_LABEL[muniStatus].ar : STATUS_LABEL[muniStatus].en}</span> },
          im.entityType === 'amanah' && { k: L('Municipality in the source', 'البلدية في المصدر'), v: im.municipalitySourceValue ? <span>{im.municipalitySourceValue}{im.municipalitySource?.simulated && <small className="muted"> ({L('demo stand-in', 'قيمة تجريبية بديلة')}{im.municipalitySource.field ? ` · ${im.municipalitySource.field}` : ''})</small>}</span> : <span className="muted">{L('No value in the source', 'لا توجد قيمة في المصدر')}</span> },
          im.municipalityRefId && { k: L('Municipality reference id (internal)', 'المعرّف المرجعي للبلدية (داخلي)'), v: <span dir="ltr">{im.municipalityRefId} <small className="muted">({L('not an official code', 'ليس رمزاً رسمياً')})</small></span> },
          { k: L('Source system', 'النظام المصدر'), v: <span>{rec.sourcePlatform || '—'} <small className="muted">({typeLabel})</small></span> }
        ] },
        // the party the invoice is issued TO and who is responsible for paying it (not a «beneficiary»)
        { title: L('Billed party', 'بيانات المُصدَر له الفاتورة'), items: [
          { k: L('Party type', 'نوع الجهة'), v: partyType },
          { k: L('Name', 'الاسم'), v: (ar ? im.beneficiary?.name?.ar : im.beneficiary?.name?.en) || <span className="muted">{L('Not available', 'غير متوفر')}</span> },
          im.beneficiary?.id && { k: L('ID type', 'نوع الهوية'), v: ar ? im.beneficiary.idType.ar : im.beneficiary.idType.en },
          im.beneficiary?.id && { k: L('ID number (masked)', 'رقم الهوية (مقنّع)'), v: String(im.beneficiary.id).length > 4 ? '•'.repeat(String(im.beneficiary.id).length - 4) + String(im.beneficiary.id).slice(-4) : '••••', ltr: true },
          rec.crNo && { k: L('Commercial registration', 'السجل التجاري'), v: <span dir="ltr">{rec.crNo}</span> },
          rec.crStatusRaw && { k: L('Registration status', 'حالة السجل'), v: rec.crStatusRaw, ltr: true },
          rec.revenueSource === 'investment' && im.beneficiary?.id && { k: L('Investor reference', 'مرجع المستثمر'), v: <span dir="ltr">{String(im.beneficiary.id).length > 4 ? '•'.repeat(String(im.beneficiary.id).length - 4) + String(im.beneficiary.id).slice(-4) : '••••'}</span> }
        ] }
      ]} />

      <SectionNav label={L('On this page', 'في هذه الصفحة')} items={[
        findings.length > 0 && { id: 'findings', label: L('Findings', 'ما يحتاج مراجعة'), count: findings.length },
        { id: 'payments', label: L('Payments', 'المدفوعات'), count: rec.payments.length },
        (rec.revenueSource === 'investment' || im.mainClass === MAIN.investment) && { id: 'contract', label: L('Contract', 'العقد') },
        { id: 'orders', label: L('Enforcement orders', 'أوامر التنفيذ'), count: orderLinks.length },
        { id: 'eefaa', label: L('Efaa violations', 'مخالفات إيفاء') },
        im.disclosure && { id: 'disclosure', label: L('Disclosure', 'الإفصاح') }
      ]} />

      {msg && <div className={`rv-callout ${msg.ok ? '' : 'rv-callout--bad'}`} role="status" aria-live="polite">{msg.t}</div>}

      {der.cancelled && (
        <Section id="separate" title={L('Cancellation, exclusion, balance and enforcement — kept separate', 'الإلغاء والاستبعاد والرصيد والإنفاذ — منفصلة')}>
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Cancellation, exclusion, balance and enforcement', 'الإلغاء والاستبعاد والرصيد والإنفاذ')}><tbody>{[
            { k: L('Source cancellation', 'الإلغاء في المصدر'), v: der.sourceCancelled ? L(`Cancelled in the source${rec.cancelled?.date ? ` (${rec.cancelled.date})` : ''}`, `ملغاة في المصدر${rec.cancelled?.date ? ` (${rec.cancelled.date})` : ''}`) : L('Not cancelled at the reference date', 'غير ملغاة في التاريخ المرجعي') },
            { k: L('Effective treatment (exclusion / review)', 'المعالجة الفعلية (استبعاد / مراجعة)'), v: der.enfConflict ? L('Cancelled in the source and linked to a confirmed enforcement order: the source status is kept; excluded as linked to a confirmed order (uncollected remainder, once); flagged for review.', 'ملغاة في المصدر ومرتبطة بأمر تنفيذ مؤكد: تُحفظ حالة المصدر؛ وتُستبعد كمرتبطة بأمر تنفيذ مؤكد (المتبقي غير المحصّل، مرة)؛ ومعلَّمة للمراجعة.') : der.cancelled ? L('Excluded as cancelled (counted once)', 'مستبعدة كملغاة (تُحتسب مرة)') : L('No cancellation exclusion', 'لا استبعاد للإلغاء') },
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
                actions={f.action && f.action[0] === 'ex' ? (<><button type="button" className="btn btn-sm btn-primary" disabled={!canDo.exclusionManage} title={canDo.exclusionManage ? undefined : L(rev.gates['exclusion.manage'].reason.en, rev.gates['exclusion.manage'].reason.ar)} onClick={() => decide(f.action[1].ruleId, 'approved')}>{L('Approve exclusion', 'اعتماد الاستبعاد')}</button><button type="button" className="btn btn-sm" disabled={!canDo.exclusionManage} onClick={() => decide(f.action[1].ruleId, 'rejected')}>{L('Reject', 'رفض')}</button></>)
                  : f.action && f.action[0] === 'link' ? (<><button type="button" className="btn btn-sm btn-primary" disabled={!canDo.enforcementReview} title={canDo.enforcementReview ? undefined : L(rev.gates['enforcement.review'].reason.en, rev.gates['enforcement.review'].reason.ar)} onClick={() => linkAct('confirm', f.action[1].enforceNum)}>{L('Confirm link', 'تأكيد الرابط')}</button><button type="button" className="btn btn-sm" disabled={!canDo.enforcementReview} onClick={() => linkAct('reject', f.action[1].enforceNum)}>{L('Reject', 'رفض')}</button><RecordLink className="btn btn-sm btn-ghost" to={orderPath(f.action[1].enforceNum)}>{L('Open the order', 'فتح الأمر')}</RecordLink></>) : null} />
            ))}
          </div>
          {(!canDo.exclusionManage || !canDo.enforcementReview) && <div className="rp-limit" data-testid="decide-denied">{L(`Your role cannot decide here (exclusion and link decisions). ${(rev.gates['exclusion.manage'].reason || rev.gates['enforcement.review'].reason)?.en || ''}`, `دورك لا يتيح اتخاذ القرار هنا (قرارات الاستبعاد والروابط). ${(rev.gates['exclusion.manage'].reason || rev.gates['enforcement.review'].reason)?.ar || ''}`)}</div>}
        </Section>
      )}

      <Section id="payments" title={L('Payments', 'المدفوعات')} count={pf.count} note={<div className="rp-limit">{L('Payments up to the reference date, in date order. «Against the due date» compares each payment date with the due date; the balance is the invoice value minus what had been paid up to that payment.', 'المدفوعات حتى تاريخ المرجع بترتيب التاريخ. «مقابل الاستحقاق» يقارن تاريخ كل دفعة بتاريخ الاستحقاق، والرصيد هو قيمة الفاتورة ناقص المدفوع حتى تلك الدفعة.')}</div>}>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Payments', 'المدفوعات')}>
          <thead><tr><th>{L('Payment date', 'تاريخ الدفع')}</th><th>{L('Channel', 'القناة')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Against the due date', 'مقابل الاستحقاق')}</th><th className="num">{L('Balance after', 'الرصيد بعدها')}</th></tr></thead>
          <tbody>{pf.rows.length ? pf.rows.map((p, i) => <tr key={i}><td dir="ltr">{p.date}{pf.settled === p.date && <> <span className="rv-tag rv-tag--ok">{L('settled', 'سداد كامل')}</span></>}</td><td>{B(CHANNEL[p.channel] || { en: p.channel, ar: p.channel })}</td><td className="num" dir="ltr">{sar(p.amount)}</td><td>{p.offset == null ? '—' : p.offset > 0 ? <span className="rp-bad">{L(`${p.offset} d after`, `بعد ${p.offset} يوماً`)}</span> : p.offset < 0 ? L(`${-p.offset} d before`, `قبل ${-p.offset} يوماً`) : L('on the due date', 'في يوم الاستحقاق')}</td><td className="num" dir="ltr">{sar(p.balance)}</td></tr>) : <tr><td colSpan={5} className="muted">{L('No payment recorded up to the reference date.', 'لا دفعات مسجلة حتى التاريخ المرجعي.')}</td></tr>}</tbody>
          {pf.rows.length > 1 && <tfoot><tr><th colSpan={2}>{L('Total paid', 'إجمالي المدفوع')}</th><td className="num" dir="ltr"><b>{sar(pf.paid)}</b></td><td /><td className="num" dir="ltr">{sar(pf.remaining)}</td></tr></tfoot>}
        </table></div>
      </Section>

      {(rec.revenueSource === 'investment' || im.mainClass === MAIN.investment) && (
        <Section id="contract" title={L('Related investment contract', 'العقد الاستثماري المرتبط')}>
          {rec.co ? (<>
            <Facts items={[
              { k: L('Contract number', 'رقم العقد'), v: <RecordLink to={contractPath(rec.co)} dir="ltr">{rec.co}</RecordLink> },
              card && { k: L('Contract status (illustrative value)', 'حالة العقد (قيمة توضيحية)'), v: contractStatusText(card.status, B, L) },
              card && { k: L('Investor', 'المستثمر'), v: ar ? card.tenantAr : card.tenantEn },
              { k: L('Opportunity / property', 'الفرصة الاستثمارية / العقار'), v: `${B(rec.revenueItem)}${rec.municipalityAr ? ` — ${ar ? rec.municipalityAr : rec.municipalityEn}` : ''}` },
              card && { k: L('Contract start', 'بداية العقد'), v: fmtDateText(card.start, ar ? 'ar' : 'en') },
              card && { k: L('Contract end', 'نهاية العقد'), v: fmtDateText(card.end, ar ? 'ar' : 'en') },
              card && { k: L('Contract value', 'قيمة العقد'), v: short(card.totals.contractValue), ltr: true },
              myPay && card && { k: L('Related installment', 'الدفعة المرتبطة'), v: ar ? `الدفعة ${myPay.no} من ${card.schedule.length}` : `Installment ${myPay.no} of ${card.schedule.length}` },
              myPay && { k: L('Installment due date', 'استحقاق الدفعة'), v: fmtDateText(myPay.dueDate, ar ? 'ar' : 'en') },
              myPay && { k: L('Installment amount', 'مبلغ الدفعة'), v: sar(myPay.amount), ltr: true }
            ].filter(Boolean)} />
            <div className="rp-limit">{L('The contract is the one recorded on the invoice (Furas); it was not inferred from an amount, a date or a payer name.', 'العقد هو المسجّل على الفاتورة (فرص)، ولم يُستنتج من مبلغ أو تاريخ أو اسم دافع.')}</div>
          </>) : (<>
            <p className="rp-empty">{L('No confirmed link to an investment contract is available for this invoice.', 'لا يتوفر ربط مؤكد بعقد استثماري لهذه الفاتورة')}</p>
            {im.investment?.outcome === 'internal_note' && <div className="muted">{L('An investment invoice issued from an internal system: it is not expected to be linked to Furas.', 'فاتورة استثمار صادرة من نظام داخلي: لا يُتوقع ربطها بمنصة فرص.')}</div>}
          </>)}
        </Section>
      )}

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

      <Section id="orders" title={L('Related enforcement orders', 'أوامر التنفيذ المرتبطة')} count={orderLinks.length}>
        {orderLinks.length ? (
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Orders on this invoice', 'أوامر هذه الفاتورة')}>
            <thead><tr><th>{L('Order', 'الأمر')}</th><th>{L('Source and date', 'المصدر والتاريخ')}</th><th>{L('Order status', 'حالة الأمر')}</th><th>{L('Link', 'الرابط')}</th><th>{L('Basis', 'الأساس')}</th></tr></thead>
            <tbody>{orderLinks.map(({ c, l }) => {
              const st = c.orderStatus; const hard = unresolvedConflicts(l.conflicts, l.resolvedConflicts);
              return (
                <tr key={c.enforceNum}>
                  <td><RecordLink to={orderPath(c.enforceNum)} dir="ltr"><b>{c.enforceNum}</b></RecordLink><div className="muted" dir="ltr">{sar(c.amount)}</div></td>
                  <td>{c.system === 'sanad' ? L('Sanad', 'سند') : c.system || '—'}<div className="muted" dir="ltr">{c.openedDate || '—'}</div></td>
                  <td><OrderStatusChip status={st} />{st === 'closed' && <div className="muted" style={{ fontSize: 12 }}>{c.source?.statusText || L('closure reason unknown', 'سبب الإغلاق غير معروف')}</div>}{st === 'closed' && <div className="muted" style={{ fontSize: 11 }}>{L('closing an order does not mean payment', 'إغلاق الأمر لا يعني السداد')}</div>}</td>
                  <td><Chip def={l.ledgerStatus === 'removed' ? { en: 'Withdrawn', ar: 'مسحوب', cls: 'rv-cat--excluded' } : LINK_STATUS_LABEL[l.status]} />{hard.length > 0 && l.status === 'candidate' && <div className="rp-bad" style={{ fontSize: 12 }}>{hard.map((x) => B(CONFLICT_LABEL[x] || { en: x, ar: x })).join(' · ')}</div>}</td>
                  <td style={{ fontSize: 12 }}>{B(ORIGIN_LABEL[l.origin] || ORIGIN_LABEL.sanad_structured)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <p className="rp-empty">{L('No related record is available in the available data.', 'لا يتوفر سجل مرتبط في البيانات المتاحة')}</p>}

        {orderLinks.length > 1 && <div className="rp-limit">{L('Each order shows its own amount; the invoice amount is counted once and is not split between orders. A candidate link awaits confirmation and is not a confirmed link.', 'يعرض كل أمر مبلغه الخاص؛ ويُحتسب مبلغ الفاتورة مرة واحدة ولا يُقسَّم بين الأوامر. الرابط المرشّح بانتظار التأكيد وليس رابطاً مؤكداً.')}</div>}

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

      <Section id="eefaa" title={L('Related Efaa violations', 'مخالفات إيفاء المرتبطة')} count={rec.revenueSource === 'fines' ? 1 : 0}>
        {rec.revenueSource === 'fines' ? (
          <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Efaa violations', 'مخالفات إيفاء')}>
            <thead><tr><th>{L('Violation', 'المخالفة')}</th><th>{L('Type', 'النوع')}</th><th>{L('Issuing authority', 'الجهة المصدرة')}</th><th>{L('Date', 'التاريخ')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Efaa status', 'حالة إيفاء')}</th><th>{L('Payment status', 'حالة السداد')}</th></tr></thead>
            <tbody><tr>
              <td dir="ltr">{rec.violationNumber || '—'}</td><td>{B(rec.revenueItem)}</td><td>{ar ? im.billerAr : im.billerEn}</td><td dir="ltr">{rec.issueDate}</td><td className="num" dir="ltr">{sar(rec.grossAmount)}</td>
              <td>{rec.statusRawEfaa ? (rec.statusRawEfaa === 'غير مكتملة' ? L('Incomplete', 'غير مكتملة') : rec.statusRawEfaa === 'منفذ ضده' ? L('Executed against', 'منفذ ضده') : L('Complete', 'مكتملة')) : <span className="muted">{L('Not available', 'غير متوفر')}</span>}</td>
              <td><PayStatusChip status={der.payStatus} /></td>
            </tr></tbody>
          </table></div>
        ) : rec.statusRawEfaa ? (
          // the invoice carries an Efaa status, but it is not an Efaa violation record: only the status is stated, no violation is invented
          <p className="rp-empty">{L('Efaa status recorded on this invoice: ', 'حالة الفاتورة المسجلة في إيفاء: ')}<b>{rec.statusRawEfaa === 'غير مكتملة' ? L('Incomplete', 'غير مكتملة') : rec.statusRawEfaa === 'منفذ ضده' ? L('Executed against', 'منفذ ضده') : L('Complete', 'مكتملة')}</b>. {L('No violation record is available in the available data.', 'ولا يتوفر سجل مخالفة في البيانات المتاحة.')}</p>
        ) : <p className="rp-empty">{L('No related record is available in the available data.', 'لا يتوفر سجل مرتبط في البيانات المتاحة')}</p>}
        <div className="rp-limit">{L('An Efaa violation and an enforcement order are different records: a link between them is shown only where the data supports it. A violation record does not imply payment.', 'مخالفة إيفاء وأمر التنفيذ سجلان مختلفان: لا يُعرض الربط بينهما إلا حيث تدعمه البيانات. وسجل المخالفة لا يعني السداد.')}</div>
      </Section>

    </div>
  );
}
