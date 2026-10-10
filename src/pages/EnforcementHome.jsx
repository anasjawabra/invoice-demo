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
import { reviewStatusOf, statusGroupCounts } from '../data/orderSummary';
import { useDocFiles } from '../components/record/PdfPreview';
import { amanahName } from './Contracts';
import OrdersView from './EnforcementOrders';
import { Section } from '../components/record/RecordPage';
import { loadPreparedSamples, SIM_LABEL } from '../data/ocrSimulation';

const VIEWS = ['orders', 'invoices', 'contracts'];
const EXC_LABEL = {
  no_references: { en: 'Invoice numbers not identified — needs review', ar: 'لم يتم تحديد أرقام الفواتير — تحتاج مراجعة', def: { en: 'No invoice reference in the structured fields, the description, the notes or any document added. This is NOT «no related invoices».', ar: 'لا مرجع فاتورة في الحقول المهيكلة ولا الوصف ولا الملاحظات ولا أي مستند مضاف. وهذا ليس «لا فواتير مرتبطة».' } },
  corrupted_reference: { en: 'Corrupted invoice number (scientific notation)', ar: 'رقم فاتورة مشوّه (صيغة علمية)', def: { en: 'The structured invoice number arrived as scientific notation (digits lost): it cannot be matched. The description or a document may carry the full number.', ar: 'وصل رقم الفاتورة المهيكل بصيغة علمية (ضاعت أرقامه): لا يمكن مطابقته. وقد يحمل الوصف أو مستند الرقم الكامل.' } },
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
  const comps = useMemo(() => cases.map((c) => { const comp = orderCompleteness(c); const ex = orderExceptions(c); return { c, ex, comp, review: reviewStatusOf(comp, c, ex) }; }), [cases]);
  const grp = useMemo(() => statusGroupCounts(cases), [cases]); const closedN = grp.closed;
  const inv = useMemo(() => { const r = { notClosed: 0, closedOnly: 0, ever: 0 }; for (const e of idx.values()) { if (e.current !== 'none') r.notClosed += 1; else if (e.closedOnly) r.closedOnly += 1; if (e.referredEver) r.ever += 1; } return r; }, [idx]);
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
  const excCount = (t) => comps.filter((x) => x.ex.includes(t)).length;
  const needing = comps.filter((x) => x.review !== 'complete').length;
  const allDocs = useMemo(() => cases.flatMap((c) => c.docs || []), [cases]); const files = useDocFiles(allDocs.map((d) => d.id));
  const missing = allDocs.filter((d) => files[d.id] === false).length;
  const [samples, setSamples] = useState([]);
  useEffect(() => { let off = false; loadPreparedSamples().then((x) => { if (!off) setSamples(x); }); return () => { off = true; }; }, []);

  const go = (v, extra = {}) => setSp({ view: v, ...extra });
  const card = (n, label, unit, o = {}) => {
    const body = <><span className={`oj-card__n${o.warn && n ? ' rp-warn' : ''}`} dir="ltr">{typeof n === 'number' ? fmt(n) : n}</span><span className="oj-card__l">{label}</span><span className="oj-card__u">{unit}</span></>;
    return o.onClick ? <button type="button" className="oj-card" onClick={o.onClick}>{body}</button> : <div className="oj-card">{body}</div>;
  };
  return (
    <div className="rp">
      <header className="rp-head"><div className="rp-titlebar"><div className="rp-title"><h1 className="page-title">{L('Enforcement management', 'إدارة التنفيذ')}</h1>
        <div className="page-sub">{L('Sanad enforcement requests, the invoices they refer to and what needs your review.', 'طلبات التنفيذ في سند، والفواتير التي تشير إليها، وما يحتاج مراجعتك.')}</div></div></div></header>
      <IntegrationNotice />
      {missing > 0 && <div className="rp-limit rp-limit--warn" role="status">{L(`${missing} document(s) have no original file in this browser (backups keep the extracted evidence but not the files). Open the order to add the file again.`, `${missing} مستند بلا ملف أصلي في هذا المتصفح (تحتفظ النسخ الاحتياطية بالأدلة المستخرجة دون الملفات). افتح الأمر لإضافة الملف من جديد.`)}</div>}
      <LegacyRecords />

      <section aria-label={L('Summary', 'الملخص')}>
        <div className="oj-cards">
          {card(cases.length, L('Enforcement requests', 'طلبات التنفيذ'), L('count of requests', 'عدد الطلبات'), { onClick: () => go('orders') })}
          {card(needing, L('Need action', 'تحتاج إجراء'), L('requests', 'طلب'), { warn: true, onClick: () => go('orders', { review: 'open' }) })}
          {card(inv.ever, L('Referred invoices', 'فواتير محالة'), L('count of invoices', 'عدد الفواتير'), { onClick: () => go('invoices') })}
          {card(conflictN == null ? '…' : conflictN, L('Cancelled yet referred', 'ملغاة ومحالة'), L('invoices — kept cancelled', 'فاتورة — تبقى ملغاة'), { warn: true })}
        </div>
        <div className="muted" style={{ fontSize: 12, marginBlockStart: 6 }}>{L('Requests and invoices are different units: the counts are not added together.', 'الطلبات والفواتير وحدتا عدّ مختلفتان: لا تُجمع الأعداد معاً.')}</div>
        <details className="oj-more" style={{ marginBlockStart: 6 }}>
          <summary>{L('Breakdown of the counts', 'تفاصيل الأعداد')}</summary>
          <div className="rp-tablewrap" tabIndex={0} style={{ marginBlockStart: 6 }}>
            <table aria-label={L('Counts', 'الأعداد')}>
              <thead><tr><th>{L('Unit', 'الوحدة')}</th><th>{L('Count', 'العدد')}</th><th className="num">{L('Number', 'العدد')}</th></tr></thead>
              <tbody>
                <tr><td>{L('Requests', 'طلبات')}</td><td>{L('Closed (the source text says «مغلق»)', 'مغلقة (نص الحالة في سند «مغلق»)')}</td><td className="num">{fmt(closedN)}</td></tr>
                <tr><td>{L('Requests', 'طلبات')}</td><td>{L('Not classified (the meaning of the other statuses is not confirmed)', 'غير مصنّفة (معنى بقية الحالات غير مؤكد)')}</td><td className="num">{fmt(cases.length - closedN)}</td></tr>
                <tr><td>{L('Invoices', 'فواتير')}</td><td>{L('Referred, with an order that is not closed', 'محالة ولها طلب غير مغلق')}</td><td className="num">{fmt(inv.notClosed)}</td></tr>
                <tr><td>{L('Invoices', 'فواتير')}</td><td>{L('Referred, all orders closed (the referral stays; payment is judged on its own)', 'محالة وكل طلباتها مغلقة (تبقى الإحالة؛ والسداد يُحكم عليه منفصلاً)')}</td><td className="num">{fmt(inv.closedOnly)}</td></tr>
                <tr><td>{L('Contracts', 'عقود')}</td><td>{L('Directly referred / mentioned only / with referred invoices (overlapping groups)', 'محالة مباشرة / مذكورة فقط / بفواتير محالة (مجموعات متداخلة)')}</td><td className="num" dir="ltr">{contractsDirect} / {contractsMentioned} / {contractsWithInv}</td></tr>
                <tr><td colSpan={3} className="muted" style={{ fontSize: 12 }}>{L('A request can have several reasons for review, so the reasons below are not added together either.', 'قد يحمل الطلب الواحد أكثر من سبب للمراجعة، فلا تُجمع الأسباب أدناه أيضاً.')}</td></tr>
                {EXCEPTION_TYPES.map((k) => <tr key={k}><td>{L('Requests', 'طلبات')}</td><td>{B(EXC_LABEL[k])}</td><td className="num">{fmt(excCount(k))}</td></tr>)}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <nav className="rp-tabs" aria-label={L('Enforcement views', 'عروض الإنفاذ')}>
        {[['orders', L('Requests', 'الطلبات'), cases.length], ['invoices', L('Referred invoices', 'الفواتير المحالة'), inv.ever], ['contracts', L('Related contracts', 'العقود ذات الصلة'), contracts.length]].map(([k, label, n]) => (
          <button key={k} type="button" className={`rp-tab${view === k ? ' rp-tab--on' : ''}`} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}>{label} <span className="rp-count">{fmt(n)}</span></button>
        ))}
      </nav>
      {view === 'orders' && <OrdersView />}
      {view === 'invoices' && <ReferredInvoices idx={idx} />}
      {view === 'contracts' && <RelatedContracts items={contracts} />}

      <Section id="samples" secondary title={L('Prepared demo samples', 'عينات العرض المعدّة')} count={samples.length}
        note={<div className="rp-limit"><span className="rv-tag rv-tag--warn">{B(SIM_LABEL)}</span> {L('Each sample is a scanned-style document prepared for one demo request: open it, choose the sample in step 1, then analyse. A labelled simulation — not real OCR.', 'كل عينة مستند ممسوح معدّ لطلب واحد في العرض: افتحه واختر العينة في الخطوة 1 ثم حلّل. محاكاة معلّمة — وليست OCR حقيقياً.')}</div>}>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Prepared samples', 'العينات المعدّة')}>
          <thead><tr><th>{L('Scenario', 'السيناريو')}</th><th>{L('Request', 'الطلب')}</th><th>{L('What it shows', 'ما تُظهره')}</th></tr></thead>
          <tbody>{samples.map((x) => { const c = cases.find((k) => k.enforceNum === x.orderNo); return <tr key={x.id}><td><b>{B(x.title)}</b></td><td><RecordLink to={orderPath(x.orderNo)} dir="ltr">{c?.source?.requestNo || x.orderNo}</RecordLink></td><td style={{ fontSize: 12 }}>{B(x.what)}</td></tr>; })}{!samples.length && <tr><td colSpan={3} className="muted">{L('No prepared samples are available.', 'لا توجد عينات معدّة.')}</td></tr>}</tbody>
        </table></div>
      </Section>
    </div>
  );
}

// Records stored by an earlier build under a generated order id that was later renumbered are AMBIGUOUS: they were set aside (never applied). The person may restore one to an order they choose.
function LegacyRecords() {
  const rev = useRevenue(); const { L } = useL();
  const [target, setTarget] = useState({}); const [msg, setMsg] = useState(null);
  const ids = Object.keys(rev.legacyRecords || {}); if (!ids.length) return null;
  const targets = rev.cases.filter((c) => /^EN-6[0-2]\d{2}$/.test(c.enforceNum) && !c.hasUserWork);
  return (
    <details className="rp-limit rp-limit--warn" open>
      <summary><b>{L(`${ids.length} saved record(s) under an old order number were not applied`, `${ids.length} سجل محفوظ بأرقام أوامر قديمة لم يُطبَّق على أي أمر`)}</b></summary>
      <div style={{ fontSize: 13 }}>{L('Order numbers of the demo samples were renumbered after these were saved, so they cannot be matched to an order safely. Nothing was deleted. Restore a record only to the order you know it belongs to.', 'أُعيد ترقيم بعض أوامر العرض بعد حفظ هذه السجلات، فلا يمكن ربطها بأمر بأمان. لم يُحذف شيء. استعد السجل فقط إلى الأمر الذي تعرف أنه يخصه.')}</div>
      {msg && <div role="status" className={msg.ok ? 'rp-ok' : 'rp-bad'}>{msg.t}</div>}
      <ul style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>{ids.map((id) => { const r = rev.legacyRecords[id]; const docs = Object.values(r.docs || {}); const links = Object.values(r.links || {}); return (
        <li key={id} style={{ marginBlockEnd: 6 }}><b dir="ltr">{id}</b> · {L(`${docs.length} document(s), ${links.length} link(s)`, `${docs.length} مستند، ${links.length} رابط`)}{docs[0] ? <span dir="ltr" className="muted"> · {docs[0].name}</span> : null}
          <div className="oj-row" style={{ marginBlockStart: 3 }}><label style={{ fontSize: 12 }}>{L('Restore to', 'استعادة إلى')} <select className="input" value={target[id] || ''} onChange={(e) => setTarget((m) => ({ ...m, [id]: e.target.value }))}><option value="">—</option>{targets.map((c) => <option key={c.enforceNum} value={c.enforceNum}>{c.source?.requestNo || ''} · {c.enforceNum}</option>)}</select></label>
            <button type="button" className="btn btn-sm" disabled={!target[id] || !rev.canReview} onClick={() => { const r = rev.enforcement.restoreLegacy(id, target[id]); setMsg(r.ok ? { ok: true, t: L('Restored.', 'تمت الاستعادة.') } : { ok: false, t: L('Could not restore (the order already has its own record).', 'تعذّرت الاستعادة (للأمر سجل خاص به بالفعل).') }); }}>{L('Restore', 'استعادة')}</button></div></li>); })}</ul>
    </details>
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
        <label>{L('Enforcement', 'الإنفاذ')}<select className="input" value={f} onChange={(e) => { setF(e.target.value); setPage(0); }}><option value="all">{L('Ever referred', 'سبقت إحالتها')}</option><option value="inexec">{L('An order that is not closed', 'أمر غير مغلق')}</option><option value="closed">{L('All orders closed', 'كل الأوامر مغلقة')}</option></select></label>
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

void Link;
