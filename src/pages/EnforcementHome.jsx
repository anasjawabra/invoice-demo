import React, { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Pager from '../components/Pager';
import { useAsync } from '../utils/useAsync';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { RecordLink, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { invoicePath, orderPath, contractPath } from '../utils/paths';
import { IntegrationNotice, PayStatusChip, OrderStatusChip, EnforcementChips, SOURCE_LABEL, CompletenessMarks } from '../components/revenue/EnforcementUI';
import { buildIndex } from '../data/relations';
import { orderExceptions, orderCompleteness, EXCEPTION_TYPES } from '../data/orderMatching';
import { useDocFiles } from '../components/record/PdfPreview';
import { amanahName } from './Contracts';
import OrdersView from './EnforcementOrders';
import { Section } from '../components/record/RecordPage';
import { loadPreparedSamples, SIM_LABEL } from '../data/ocrSimulation';

const VIEWS = ['orders', 'invoices', 'contracts', 'exceptions'];
const EXC_LABEL = {
  no_references: { en: 'Invoice numbers not identified — needs review', ar: 'لم يتم تحديد أرقام الفواتير — تحتاج مراجعة', def: { en: 'No invoice reference in the structured fields, the description, the notes or any document added. This is NOT «no related invoices».', ar: 'لا مرجع فاتورة في الحقول المهيكلة ولا الوصف ولا الملاحظات ولا أي مستند مضاف. وهذا ليس «لا فواتير مرتبطة».' } },
  unresolved_references: { en: 'References not yet accounted for', ar: 'مراجع لم تُحسم', def: { en: 'A reference was found (Sanad or document) that no link or decision accounts for.', ar: 'وُجد مرجع (من سند أو مستند) لا يحسمه رابط أو قرار.' } },
  proposals_pending: { en: 'Proposals awaiting confirmation', ar: 'اقتراحات بانتظار التأكيد', def: { en: 'A proposed link has no effect until a person confirms it.', ar: 'الرابط المقترح بلا أثر حتى يؤكده شخص.' } },
  conflicts: { en: 'Conflicts no evidence resolves', ar: 'تعارضات لا يحسمها دليل', def: { en: 'A proposed link conflicts with the data (other debtor, other Amanah, issued after the order…) and no evidence resolves it.', ar: 'رابط مقترح يتعارض مع البيانات (مدين آخر، أمانة أخرى، صدر بعد الأمر…) ولا دليل يحسمه.' } },
  unread_pages: { en: 'Document pages not read', ar: 'صفحات مستند لم تُقرأ', def: { en: 'A document page has no text layer and no text was supplied for it (this system performs no OCR).', ar: 'صفحة مستند بلا طبقة نص ولم يُزوَّد نص لها (لا يجري هذا النظام OCR).' } },
  attachments_not_retrieved: { en: 'Attachments listed but not added', ar: 'مرفقات مدرجة لم تُضَف', def: { en: 'Sanad lists attachments that this system cannot retrieve (not connected). The invoices they name are not identified until the files are added by hand.', ar: 'تدرج سند مرفقات لا يستطيع هذا النظام جلبها (غير متصل). وتبقى الفواتير التي تذكرها غير محددة حتى تُضاف الملفات يدوياً.' } },
  contract_mention_unreviewed: { en: 'Contract mentioned, not reviewed', ar: 'عقد مذكور دون مراجعة', def: { en: 'A contract number appears in the description or a document. A mention alone is not a direct referral: confirm it only with supporting evidence.', ar: 'يظهر رقم عقد في الوصف أو مستند. والذكر وحده ليس إحالة مباشرة: يُؤكَّد فقط بدليل داعم.' } },
  amount_difference: { en: 'Amount difference', ar: 'فرق في المبلغ', def: { en: 'The confirmed invoices do not add up to the order amount (reported, never forced).', ar: 'الفواتير المؤكدة لا تساوي مبلغ الأمر (يُعرض ولا يُفرض).' } },
  contract_level_only: { en: 'Contract-level request, invoices not identified', ar: 'طلب على مستوى العقد، فواتيره غير محددة', def: { en: 'Sanad names a contract number but no invoice; it is not spread over the contract’s invoices.', ar: 'تذكر سند رقم عقد دون فاتورة؛ ولا يُوزَّع على فواتير العقد.' } }
};

// «إدارة التنفيذ» — the landing of enforcement management: clearly defined counts, then four views over the SAME relationships used everywhere else
// (orders · referred invoices · related contracts · matching-review exceptions). It owns no data of its own.
export default function EnforcementHome() {
  const rev = useRevenue();
  const { L, B, ar, sar, count: fmt } = useL();
  const [sp, setSp] = useSearchParams();
  const view = VIEWS.includes(sp.get('view')) ? sp.get('view') : 'orders';
  const cases = rev.cases;
  const idx = useMemo(() => buildIndex(cases), [cases]);
  const comps = useMemo(() => cases.map((c) => ({ c, ex: orderExceptions(c), comp: orderCompleteness(c) })), [cases]);
  const statusN = (k) => cases.filter((c) => c.orderStatus === k).length;
  const inv = useMemo(() => { const r = { inExec: 0, suspendedOnly: 0, closedOnly: 0, ever: 0, proposedOnly: 0 }; for (const e of idx.values()) { if (e.current === 'in_execution') r.inExec += 1; else if (e.current === 'suspended') r.suspendedOnly += 1; else if (e.closedOnly) r.closedOnly += 1; else if (e.proposed.length) r.proposedOnly += 1; if (e.referredEver) r.ever += 1; } return r; }, [idx]);
  const scopeReq = useMemo(() => ({ amanah: rev.scopeEff.amanah, source: 'investment', from: '2000-01-01', to: rev.cfg.cutoff }), [rev.scopeEff.amanah, rev.cfg.cutoff]);
  const { data: cd } = useAsync(() => rev.data.contracts(scopeReq), [rev.data, scopeReq]);
  const contracts = useMemo(() => {
    const out = [];
    for (const k of cd?.cards || []) {
      const fact = (c) => (c.contractFacts || []).find((f) => f.contractNo === k.contractNo);
      const direct = cases.filter((c) => c.contractNo === k.contractNo || fact(c)?.direct);
      const mentioned = cases.filter((c) => !direct.includes(c) && fact(c)?.status === 'mentioned');
      const ids = k.invoiceIds || []; const referred = ids.filter((id) => idx.get(id)?.referredEver); const open = ids.filter((id) => idx.get(id)?.current && idx.get(id).current !== 'none');
      if (direct.length || mentioned.length || referred.length) out.push({ k, direct, mentioned, ids, referred, open });
    }
    return out;
  }, [cd, cases, idx]);
  const contractsMentioned = contracts.filter((x) => x.mentioned.length).length;
  const conflictReq = useMemo(() => ({ ...rev.scopeEff, from: '2000-01-01', to: rev.cfg.cutoff }), [rev.scopeEff, rev.cfg.cutoff]);
  const { data: conflictRes } = useAsync(() => rev.data.list(conflictReq, { filters: { exec: 'conflict', allPeriods: true }, page: 0, pageSize: 1 }), [rev.data, conflictReq, rev.dataVersion, cases]);
  const conflictN = conflictRes?.total ?? null;
  const contractsDirect = contracts.filter((x) => x.direct.length).length; const contractsWithInv = contracts.filter((x) => x.referred.length).length;
  const excCount = (t) => comps.filter((x) => x.ex.includes(t)).length; const needing = comps.filter((x) => x.ex.length).length;
  const allDocs = useMemo(() => cases.flatMap((c) => c.docs || []), [cases]); const files = useDocFiles(allDocs.map((d) => d.id));
  const missing = allDocs.filter((d) => files[d.id] === false).length;

  const [samples, setSamples] = useState([]);
  useEffect(() => { let off = false; loadPreparedSamples().then((x) => { if (!off) setSamples(x); }); return () => { off = true; }; }, []);
  const go = (v) => setSp({ view: v });
  const stat = (n, label, def, tone) => <div className="rp-compl__cell"><div className={`rp-compl__big${tone ? ` rp-${tone}` : ''}`} dir="ltr">{fmt(n)}</div><h3>{label}</h3><div className="rp-compl__d">{def}</div></div>;
  return (
    <div className="rp">
      <header className="rp-head"><div className="rp-titlebar"><div className="rp-title"><h1 className="page-title">{L('Enforcement management', 'إدارة التنفيذ')}</h1>
        <div className="page-sub">{L('Orders from Sanad over ALL invoice types, the invoices they refer to, the contracts involved, and what still needs review. One order can cover several invoices; one invoice can carry several orders.', 'أوامر سند على كل أنواع الفواتير، والفواتير التي تشير إليها، والعقود المعنية، وما يحتاج مراجعة. قد يشمل الأمر الواحد عدة فواتير، وقد تحمل الفاتورة الواحدة عدة أوامر.')}</div></div></div></header>
      <IntegrationNotice compact />
      {missing > 0 && <div className="rp-limit rp-limit--warn" role="status">{L(`${missing} order document(s) have no original file in this browser (for example after a restore: backups do not contain the document files). Extracted references, evidence and history are kept; open the order to add the file again.`, `${missing} مستند أمر بلا ملف أصلي في هذا المتصفح (مثلاً بعد استعادة: النسخ الاحتياطية لا تتضمن ملفات المستندات). تبقى المراجع المستخرجة والأدلة والسجل؛ افتح الأمر لإعادة إضافة الملف.`)}</div>}

      <section className="rp-section" aria-labelledby="counts-h">
        <div className="rp-sec-head"><h2 id="counts-h" className="rp-h2">{L('Counts and what each one means', 'الأعداد وما يعنيه كل عدد')}</h2></div>
        <div className="rp-body">
          <h3 className="rp-h3">{L('Orders (each order once)', 'الأوامر (كل أمر مرة)')}</h3>
          <div className="rp-compl">
            {stat(cases.length, L('All orders', 'كل الأوامر'), L('Every order from Sanad in your access.', 'كل أمر من سند ضمن صلاحيتك.'))}
            {stat(statusN('open'), L('In execution', 'قيد التنفيذ'), L('The order is proceeding.', 'الأمر ماضٍ.'))}
            {stat(statusN('suspended'), L('Suspended', 'موقوف'), L('Open but NOT proceeding.', 'مفتوح لكنه غير ماضٍ.'), 'warn')}
            {stat(statusN('closed'), L('Closed', 'مغلق'), L('Ended. Says nothing about payment.', 'منتهٍ. ولا يدل على السداد.'))}
          </div>
          <h3 className="rp-h3">{L('Invoices (each invoice once, even with several orders)', 'الفواتير (كل فاتورة مرة، ولو حملت عدة أوامر)')}</h3>
          <div className="rp-compl">
            {stat(inv.inExec, L('Under an order in execution', 'تحت أمر قيد التنفيذ'), L('At least one confirmed order in execution.', 'أمر مؤكد واحد على الأقل قيد التنفيذ.'))}
            {stat(inv.suspendedOnly, L('Only suspended orders', 'أوامرها موقوفة فقط'), L('No order in execution; at least one suspended (not proceeding).', 'لا أمر قيد التنفيذ؛ وواحد موقوف على الأقل (غير ماضٍ).'), 'warn')}
            {stat(inv.closedOnly, L('Referred before, all orders closed', 'سبقت إحالتها، كل الأوامر مغلقة'), L('The historical referral stays; payment is judged on its own.', 'تبقى الإحالة التاريخية؛ ويُحكم على السداد منفصلاً.'))}
            {stat(inv.ever, L('Ever referred (total)', 'سبقت إحالتها (الإجمالي)'), L('The three groups above. Confirmed links only; proposals and withdrawn links are not counted.', 'المجموعات الثلاث أعلاه. بالروابط المؤكدة فقط؛ ولا تُحتسب المقترحة ولا المسحوبة.'))}
          </div>
          <div className="rp-compl">
            {stat(conflictN == null ? '…' : conflictN, L('Source/enforcement conflicts', 'تعارضات المصدر/الإنفاذ'), L('Invoices cancelled in the source that an enforcement order is (or was) linked to. They stay cancelled in every total unless a reviewer records the documented ENF-1 treatment (pending EQ3); no order event moves an amount. Review required. (Invoices → Enforcement → Source/enforcement conflict.)', 'فواتير ملغاة في المصدر وبها (أو كان) أمر تنفيذ مرتبط. تبقى ملغاة في كل الإجماليات ما لم يسجّل مراجع معالجة ENF-1 الموثقة (بانتظار EQ3)؛ ولا يحرّك أي حدث للأمر مبلغاً. يلزم مراجعة. (الفواتير ← الإنفاذ ← تعارض المصدر/الإنفاذ.)'), conflictN ? 'warn' : undefined)}
          </div>
          <div className="rp-limit">{L('Uncollected status follows the invoice’s payment state only: an order — open, suspended or closed — never moves an invoice in or out of the uncollected view.', 'حالة عدم التحصيل تتبع حالة سداد الفاتورة وحدها: الأمر — مفتوحاً أو موقوفاً أو مغلقاً — لا يُدخل فاتورة إلى عرض غير المحصّل ولا يُخرجها منه.')}</div>
          <h3 className="rp-h3">{L('Contracts (three different facts)', 'العقود (ثلاث حقائق مختلفة)')}</h3>
          <div className="rp-compl">
            {stat(contractsMentioned, L('Mentioned in an order (unreviewed)', 'مذكورة في أمر (دون مراجعة)'), L('An order’s description or a document mentions the contract, with no structured field and no reviewed document behind THAT mention. A mention is not a direct referral (the same contract can also be directly referred by another order).', 'يذكر وصف أمر أو مستند العقد دون حقل مهيكل ولا مستند مراجَع وراء هذا الذكر. والذكر ليس إحالة مباشرة (وقد يكون العقد نفسه محالاً مباشرة بأمر آخر).'), contractsMentioned ? 'warn' : undefined)}
            {stat(contractsDirect, L('Directly referred', 'محالة مباشرة'), L('Sanad’s structured field names the contract, or a reviewer confirmed that a document EXPLICITLY states the contract itself is referred (a mention is not enough). It does NOT mean its invoices are referred.', 'حقل سند المهيكل يذكر العقد، أو أكّد مراجع أن مستنداً ينص صراحة على إحالة العقد نفسه (الذكر لا يكفي). ولا يعني أن فواتيره محالة.'))}
            {stat(contractsWithInv, L('With referred invoices', 'بفواتير محالة'), L('At least one of the contract’s invoices carries a confirmed order. It does NOT mean the contract itself is referred, nor that all its invoices are.', 'فاتورة واحدة على الأقل من فواتير العقد عليها أمر مؤكد. ولا يعني أن العقد نفسه محال ولا أن كل فواتيره محالة.'))}
          </div>
          <h3 className="rp-h3">{L('Review exceptions (orders, an order can have several)', 'استثناءات المراجعة (أوامر، وقد يحمل الأمر عدة استثناءات)')}</h3>
          <div className="rp-compl">
            {stat(needing, L('Orders needing review', 'أوامر تحتاج مراجعة'), L('At least one exception below.', 'استثناء واحد على الأقل مما يلي.'), needing ? 'warn' : undefined)}
          </div>
        </div>
      </section>

      <Section id="samples" secondary title={L('Prepared demo samples', 'عينات العرض المعدّة')} count={samples.length}
        note={<div className="rp-limit"><span className="rv-tag rv-tag--warn">{B(SIM_LABEL)}</span> {L('Each sample is a scanned-style document prepared for ONE demo order; open the order, choose the sample in step 1 and press «Analyse and link invoices». The reading is a labelled simulation that replays the sample’s own transcript — not real OCR.', 'كل عينة مستند بشكل ممسوح ضوئياً معدّ لأمر واحد في العرض؛ افتح الأمر واختر العينة في الخطوة 1 ثم اضغط «تحليل وربط الفواتير». القراءة محاكاة معلّمة تعيد نص العينة نفسه — وليست OCR حقيقياً.')}</div>}>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Prepared samples', 'العينات المعدّة')}>
          <thead><tr><th>{L('Scenario', 'السيناريو')}</th><th>{L('Order', 'الأمر')}</th><th>{L('What it shows', 'ما تُظهره')}</th></tr></thead>
          <tbody>{samples.map((x) => <tr key={x.id}><td><b>{B(x.title)}</b></td><td><RecordLink to={orderPath(x.orderNo)} dir="ltr">{x.orderNo}</RecordLink></td><td style={{ fontSize: 12 }}>{B(x.what)}</td></tr>)}{!samples.length && <tr><td colSpan={3} className="muted">{L('No prepared samples are available.', 'لا توجد عينات معدّة.')}</td></tr>}</tbody>
        </table></div>
      </Section>

      <nav className="rp-tabs" aria-label={L('Enforcement views', 'عروض الإنفاذ')}>
        {[['orders', L('Orders', 'الأوامر'), cases.length], ['invoices', L('Referred invoices', 'الفواتير المحالة'), inv.ever], ['contracts', L('Related contracts', 'العقود ذات الصلة'), contracts.length], ['exceptions', L('Review exceptions', 'استثناءات المراجعة'), needing]].map(([k, label, n]) => (
          <button key={k} type="button" className={`rp-tab${view === k ? ' rp-tab--on' : ''}`} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}>{label} <span className="rp-count">{fmt(n)}</span></button>
        ))}
      </nav>
      {view === 'orders' && <OrdersView />}
      {view === 'invoices' && <ReferredInvoices idx={idx} />}
      {view === 'contracts' && <RelatedContracts items={contracts} />}
      {view === 'exceptions' && <Exceptions comps={comps} />}
    </div>
  );
}

function ReferredInvoices({ idx }) {
  const rev = useRevenue(); const { L, B, sar } = useL();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory('enf-invoices', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [page, setPage] = useState(mem.page ?? 0); const [f, setF] = useState(mem.f ?? 'all'); const [q, setQ] = useState(mem.q ?? '');
  useEffect(() => { writeListMemory('enf-invoices', { page, f, q }); }, [page, f, q]);
  const all = useMemo(() => [...idx.entries()].filter(([, e]) => e.referredEver).map(([id, e]) => ({ id, e })).filter((x) => (f === 'all' || (f === 'inexec' && x.e.current === 'in_execution') || (f === 'suspended' && x.e.current === 'suspended') || (f === 'closed' && x.e.closedOnly)) && (!q.trim() || x.id.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => a.id.localeCompare(b.id)), [idx, f, q]);
  const view = all.slice(page * 25, (page + 1) * 25); const key = view.map((x) => x.id).join('|');
  const { data } = useAsync(() => (view.length ? rev.enforcement.resolve(view.map((x) => ({ kind: 'invoice_id_exact', value: x.id }))) : Promise.resolve({ results: [] })), [key, rev.dataVersion]);
  const by = useMemo(() => new Map((data?.results || []).map((r) => [r.ref.value, r.candidates[0]])), [data]);
  useRestoreScroll(view.length > 0);
  return (
    <section className="rp-section" aria-label={L('Referred invoices', 'الفواتير المحالة')}>
      <div className="rp-limit">{L('Invoices with at least one CONFIRMED order. Payment status and remaining balance are the invoice’s own; the enforcement columns are separate.', 'فواتير عليها أمر مؤكد واحد على الأقل. حالة السداد والمتبقي من الفاتورة نفسها؛ وأعمدة الإنفاذ منفصلة.')}</div>
      <div className="rv-form" role="search" style={{ margin: '8px 0' }}>
        <label style={{ flex: '1 1 200px' }}>{L('Search invoice number', 'بحث برقم الفاتورة')}<input className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} dir="ltr" placeholder="INV-2025" /></label>
        <label>{L('Enforcement', 'الإنفاذ')}<select className="input" value={f} onChange={(e) => { setF(e.target.value); setPage(0); }}><option value="all">{L('Ever referred', 'سبقت إحالتها')}</option><option value="inexec">{L('An order in execution', 'أمر قيد التنفيذ')}</option><option value="suspended">{L('Only suspended (not proceeding)', 'موقوفة فقط (غير ماضية)')}</option><option value="closed">{L('All orders closed', 'كل الأوامر مغلقة')}</option></select></label>
      </div>
      <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Referred invoices', 'الفواتير المحالة')}>
        <thead><tr><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Payer', 'الدافع')}</th><th>{L('Payment status', 'حالة السداد')}</th><th className="num">{L('Remaining', 'المتبقي')}</th><th>{L('Enforcement status', 'حالة الإنفاذ')}</th><th>{L('Orders', 'الأوامر')}</th></tr></thead>
        <tbody>{view.map(({ id, e }) => { const k = by.get(id); return (
          <tr key={id}>
            <td><RecordLink to={invoicePath(id)} dir="ltr"><b>{id}</b></RecordLink><div className="muted" style={{ fontSize: 12 }}>{k ? B(SOURCE_LABEL[k.source] || { en: k.source, ar: k.source }) : ''}</div></td>
            <td dir="auto">{k ? B(k.payerName) : '…'}</td>
            <td>{k ? <PayStatusChip status={k.paymentStatus} /> : '…'}</td><td className="num" dir="ltr">{k ? sar(k.outstanding) : ''}</td>
            <td><EnforcementChips enf={e} /></td>
            <td style={{ fontSize: 12 }}>{e.confirmed.map((o) => <div key={o.enforceNum}><RecordLink to={orderPath(o.enforceNum)} dir="ltr">{o.enforceNum}</RecordLink> <OrderStatusChip status={o.orderStatus} /></div>)}</td>
          </tr>); })}
          {!view.length && <tr><td colSpan={6} className="muted">{L('No invoice matches.', 'لا فاتورة مطابقة.')}</td></tr>}</tbody>
      </table></div>
      <Pager page={page} total={all.length} size={25} onPage={setPage} />
    </section>
  );
}

function RelatedContracts({ items }) {
  const { L, B, ar, sar, short } = useL();
  const [page, setPage] = useState(0);
  const view = items.slice(page * 25, (page + 1) * 25);
  return (
    <section className="rp-section" aria-label={L('Related contracts', 'العقود ذات الصلة')}>
      <div className="rp-limit">{L('Three different facts, never merged: «mentioned» (an order’s text or a document names the contract, unreviewed); «directly referred» (Sanad’s structured field, or a mention a reviewer confirmed from a document); «invoices referred» (the contract’s own invoices that carry a confirmed order). None implies another, and a contract is never linked by an amount or a payer name.', 'ثلاث حقائق مختلفة لا تُدمج: «مذكورة» (نص أمر أو مستند يذكر العقد دون مراجعة)؛ و«محالة مباشرة» (حقل سند المهيكل أو ذكر أكّده مراجع من مستند)؛ و«فواتير محالة» (فواتير العقد نفسه التي عليها أمر مؤكد). لا تدل إحداها على أخرى، ولا يُربط عقد بمبلغ أو اسم دافع.')}</div>
      <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Related contracts', 'العقود ذات الصلة')}>
        <thead><tr><th>{L('Contract', 'العقد')}</th><th>{L('Tenant', 'المستأجر')}</th><th>{L('Order and the contract', 'الأمر والعقد')}</th><th>{L('Invoices referred', 'فواتير محالة')}</th></tr></thead>
        <tbody>{view.map(({ k, direct, mentioned, ids, referred, open }) => (
          <tr key={k.contractNo}>
            <td><RecordLink to={contractPath(k.contractNo)} dir="ltr"><b>{k.contractNo}</b></RecordLink><div className="muted" style={{ fontSize: 12 }}>{amanahName(k.amanahEn, ar)}</div></td>
            <td dir="auto">{ar ? k.tenantAr : k.tenantEn}</td>
            <td style={{ fontSize: 12 }}>{direct.length ? direct.map((c) => <div key={c.enforceNum}><RecordLink to={orderPath(c.enforceNum)} dir="ltr">{c.enforceNum}</RecordLink> <OrderStatusChip status={c.orderStatus} /> <span className="rv-tag rv-tag--ok">{L('directly referred', 'محال مباشرة')}</span></div>) : <span className="muted">{L('no direct referral', 'لا إحالة مباشرة')}</span>}{mentioned.map((c) => <div key={c.enforceNum}><RecordLink to={orderPath(c.enforceNum)} dir="ltr">{c.enforceNum}</RecordLink> <OrderStatusChip status={c.orderStatus} /> <span className="rv-tag rv-tag--warn">{L('mentioned only — review', 'مذكور فقط — مراجعة')}</span></div>)}</td>
            <td style={{ fontSize: 12 }}>{referred.length ? <><b>{referred.length}</b> {L('of', 'من')} {ids.length} {L('invoiced installments', 'دفعات مفوترة')}{open.length ? <> · {open.length} {L('with an open order', 'بأمر مفتوح')}</> : null}</> : <span className="muted">{L(`none of ${ids.length}`, `لا شيء من ${ids.length}`)}</span>}</td>
          </tr>))}
          {!view.length && <tr><td colSpan={4} className="muted">{L('No contract is referred directly or through its invoices.', 'لا عقد محال مباشرة أو عبر فواتيره.')}</td></tr>}</tbody>
      </table></div>
      <Pager page={page} total={items.length} size={25} onPage={setPage} />
    </section>
  );
}

function Exceptions({ comps }) {
  const { L, B, sar } = useL();
  const [t, setT] = useState('all'); const [page, setPage] = useState(0);
  const rows = comps.filter((x) => x.ex.length && (t === 'all' || x.ex.includes(t)));
  const view = rows.slice(page * 25, (page + 1) * 25);
  return (
    <section className="rp-section" aria-label={L('Review exceptions', 'استثناءات المراجعة')}>
      <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Exception types', 'أنواع الاستثناءات')}>
        <thead><tr><th>{L('Exception', 'الاستثناء')}</th><th>{L('Meaning', 'المعنى')}</th><th className="num">{L('Orders', 'الأوامر')}</th></tr></thead>
        <tbody>{EXCEPTION_TYPES.map((k) => <tr key={k}><td><button type="button" className={`rv-link${t === k ? ' rp-ok' : ''}`} onClick={() => { setT(t === k ? 'all' : k); setPage(0); }} aria-pressed={t === k}>{B(EXC_LABEL[k])}</button></td><td style={{ fontSize: 12 }}>{B(EXC_LABEL[k].def)}</td><td className="num">{comps.filter((x) => x.ex.includes(k)).length}</td></tr>)}</tbody>
      </table></div>
      <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Orders with exceptions', 'أوامر باستثناءات')}>
        <thead><tr><th>{L('Order', 'الأمر')}</th><th>{L('Status', 'الحالة')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Exceptions', 'الاستثناءات')}</th><th>{L('Completeness', 'الاكتمال')}</th></tr></thead>
        <tbody>{view.map(({ c, ex, comp }) => <tr key={c.enforceNum}>
          <td><RecordLink to={orderPath(c.enforceNum)} dir="ltr"><b>{c.enforceNum}</b></RecordLink><div className="muted" style={{ fontSize: 12 }} dir="auto">{B(c.debtorName)}</div></td>
          <td><OrderStatusChip status={c.orderStatus} /></td><td className="num" dir="ltr">{sar(c.amount)}</td>
          <td style={{ fontSize: 12 }}>{ex.map((k) => <div key={k}>• {B(EXC_LABEL[k])}</div>)}</td><td><CompletenessMarks comp={comp} /></td></tr>)}
          {!view.length && <tr><td colSpan={5} className="muted">{L('No order has this exception.', 'لا أمر بهذا الاستثناء.')}</td></tr>}</tbody>
      </table></div>
      <Pager page={page} total={rows.length} size={25} onPage={setPage} />
    </section>
  );
}
void Link;
