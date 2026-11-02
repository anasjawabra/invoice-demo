import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAsync } from '../utils/useAsync';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { INSTALLMENT_STATES, INSTALLMENT_STATE_HELP, TIMELINE_SEGMENTS, DATA_STATE, contractStatusText } from '../data/contracts';
import { ProvenanceBadge } from '../components/revenue/RevenueUI';
import { ratioText } from '../utils/bi';
import Pager from '../components/Pager';
import { RecordHeader, StatusGroup, Figures, Facts, Section, RecordState } from '../components/record/RecordPage';
import { OrderStatusChip } from '../components/revenue/EnforcementUI';
import { OriginNote, OriginTag, ProposedTag, CandidateRuleNote, DataLimitsNote } from '../components/record/OriginParts';
import { PROPOSED_RULES, NOT_AVAILABLE } from '../data/contractRules';
import { RecordLink, useReturnTarget } from '../utils/returnContext';
import { invoicePath, orderPath } from '../utils/paths';
import { buildIndex, ordersOfContract, CLOSE_REASON_LABEL } from '../data/relations';
import { amanahName, itemName } from './Contracts';

// The contract as a full page: its invoices (the payment schedule) and, for each invoice, the orders that name it — from the same relationship model
// used by the invoice and order pages. A contract-level Sanad request (one that only names the contract number) is shown as such: it is never spread over invoices.
export default function ContractPage() {
  const { no: raw } = useParams(); const no = decodeURIComponent(raw || '');
  const rev = useRevenue();
  const { L, B, ar, short, sar, count } = useL();
  const [reload, setReload] = useState(0);
  const [seg, setSeg] = useState(null); const [page, setPage] = useState(0); const [openRows, setOpenRows] = useState(() => new Set());
  const ret = useReturnTarget({ path: '/contracts', label: L('Contracts', 'العقود') });
  const { data: c, loading, error } = useAsync(() => rev.data.contract(no), [rev.data, no, reload]);
  const idx = useMemo(() => buildIndex(rev.cases), [rev.cases]);
  const crumbs = [{ label: L('Dashboards and reports', 'لوحة المعلومات والتقارير'), to: '/insights' }, { label: L('Contracts', 'العقود'), to: '/contracts' }, { label: no, ltr: true }];
  if (!c) {
    const nf = !loading && (error?.status === 404 || error?.message === 'contract_not_found');
    const amb = !loading && error?.status === 409; // the number matches several contract records: it does not identify one
    if (amb) return <div className="rp"><RecordHeader crumbs={crumbs} title={no} ret={ret} /><div className="rp-state rp-state--bad" role="alert"><h2 className="rp-h2" style={{ fontSize: 20 }}>{L('This number matches more than one contract record', 'هذا الرقم يطابق أكثر من سجل عقد')}</h2><p>{L('A contract number alone does not identify a single contract record, so no record is opened and none is chosen for you.', 'رقم العقد وحده لا يحدد سجل عقد واحداً، لذا لا يُفتح أي سجل ولا يُختار لك أحدها.')}</p><Link className="btn btn-sm btn-primary" to="/contracts">{L('Back to the contracts', 'العودة إلى العقود')}</Link></div></div>;
    return <div className="rp"><RecordHeader crumbs={crumbs} title={no} ret={ret} /><RecordState loading={loading && !error} error={error && !nf ? error : null} notFound={nf} onRetry={() => setReload((x) => x + 1)} kind={L('Contract', 'العقد')} backTo={{ path: '/contracts', label: L('Back to the contracts', 'العودة إلى العقود') }} /></div>;
  }
  const t = c.totals; const invoiceIds = c.schedule.map((p) => p.invoiceNo).filter(Boolean);
  const orders = ordersOfContract(no, invoiceIds, rev.cases);
  const direct = orders.filter((o) => o.contractLevel); const mentioned = orders.filter((o) => o.mentionedOnly); const referredIds = invoiceIds.filter((id) => idx.get(id)?.referredEver);
  const todayIso = rev.cfg.cutoff;
  const segDef = TIMELINE_SEGMENTS.map((g) => ({ ...g, n: g.states ? c.schedule.filter((p) => g.states.includes(p.state)).length : c.schedule.length }));
  const activeKey = seg || (segDef.find((g) => g.key === 'open')?.n ? 'open' : segDef.find((g) => g.key === 'upcoming')?.n ? 'upcoming' : 'all');
  const active = segDef.find((g) => g.key === activeKey) || segDef[0];
  const rows = c.schedule.filter((p) => !active.states || active.states.includes(p.state));
  const PS = 12; const shown = rows.slice(page * PS, (page + 1) * PS);
  const cov = t.coverage;
  // a value is one of three things — known, not applicable yet, or not available from the source — and only the first may look like a number
  const val = (v, p, f = sar) => (v != null ? f(v) : p.dataState === 'not_applicable' ? <span className="muted" title={B(DATA_STATE.not_applicable)}>—</span> : <span className="muted" title={B(DATA_STATE.unknown)}>{B(DATA_STATE.unknown)}</span>);
  const dayText = (n) => (n === 0 ? L('on the due date', 'في يوم الاستحقاق') : n > 0 ? L(`${n} day(s) after due`, `بعد الاستحقاق بـ${n} يوم`) : L(`${-n} day(s) before due`, `قبل الاستحقاق بـ${-n} يوم`));
  const toggle = (no2) => setOpenRows((o) => { const n2 = new Set(o); if (n2.has(no2)) n2.delete(no2); else n2.add(no2); return n2; });
  return (
    <div className="rp">
      <RecordHeader crumbs={crumbs} ret={ret} kind={L('Contract', 'عقد')} title={c.contractNo}
        statuses={<><StatusGroup label={L('Contract status (illustrative value)', 'حالة العقد (قيمة توضيحية)')}><span className={c.status ? 'rv-tag' : 'muted'}>{contractStatusText(c.status, B, L)}</span></StatusGroup>
          {c.termEnded && <StatusGroup label={L('Term', 'مدة العقد')}><span className="rv-tag">{L(`Term ended on ${c.end}`, `انتهت المدة في ${c.end}`)}</span> <ProposedTag rule="term_ended" /></StatusGroup>}
          <ProvenanceBadge kind="demo" /></>} />
      <OriginNote origin={c.origin} />
      <Figures label={L('Contract summary', 'ملخص العقد')} items={[
        { label: L('Contract value', 'قيمة العقد'), value: short(t.contractValue), note: `${count(t.installments)} ${L('installments in the whole schedule', 'دفعة في الجدول كاملاً')}` },
        { label: L('Gross invoiced', 'إجمالي المفوتر'), value: short(t.gross), note: `${count(t.invoicedInstallments)} ${L('invoiced', 'مفوترة')}` },
        { label: L('Exclusions', 'الاستبعادات'), value: short(t.exclusions) },
        { label: L('Net invoiced', 'صافي المفوتر'), value: short(t.net) },
        { label: L('Collected', 'المحصّل'), value: short(t.collected), tone: 'good' },
        { label: L('Uncollected', 'غير المحصّل'), value: short(t.uncollected), note: `${L('of which overdue', 'منها متأخر')} ${short(t.arrears)} · ${t.overdueInstallments} ${L('installment(s)', 'دفعة')}`, tone: t.arrears ? 'bad' : undefined },
        { label: L('Collection rate on net invoiced', 'نسبة التحصيل من صافي المفوتر'), value: ratioText(t.collectionRateOnNet, ar), note: L('collected ÷ net invoiced', 'المحصّل ÷ صافي المفوتر') }
      ]} />
      <div className="rp-limit"><OriginTag origin={c.origin} field="contractValue" /> {L(`Figures are to the reference date ${todayIso} and cover the installments invoiced in the data range: ${count(cov.known)} of ${count(cov.installments)} installments have data; ${count(cov.notApplicable)} are upcoming (not invoiced yet) and ${count(cov.unknown)} have no readable invoice or collection (before the data range, or no invoice linked). Unknown is never counted as zero. Collected of what is due to date (net invoiced on installments whose due date has come): ${ratioText(t.collectedOfDueToDate, false)}.`, `الأرقام حتى التاريخ المرجعي ${todayIso} وتشمل الدفعات المفوترة ضمن نطاق البيانات: ${count(cov.known)} من ${count(cov.installments)} دفعة لها بيانات؛ ${count(cov.notApplicable)} قادمة لم تُفوتر بعد؛ و${count(cov.unknown)} بلا فاتورة أو تحصيل يمكن قراءته (قبل نطاق البيانات أو بلا فاتورة مرتبطة). غير المعروف لا يُحسب صفراً. المحصّل من المستحق حتى التاريخ (صافي المفوتر على دفعات حلّ موعدها): ${ratioText(t.collectedOfDueToDate, true)}.`)}</div>
      <div className="rp-limit"><ProposedTag rule="overdue_no_grace" /> {B(PROPOSED_RULES.overdue_no_grace.statement)} {L('“Collected of what is due to date” covers invoiced installments only; installments with no linked invoice are counted separately because their collection is unknown.', '«المحصّل من المستحق حتى التاريخ» يشمل الدفعات المفوترة فقط؛ أما الدفعات بلا فاتورة مرتبطة فتُعدّ على حدة لأن تحصيلها غير معروف.')}</div>
      <section className="rp-section"><Facts items={[
        { k: L('Tenant', 'المستأجر'), v: <>{ar ? c.tenantAr : c.tenantEn}<OriginTag origin={c.origin} field="tenant" /></> }, { k: L('Amanah', 'الأمانة / الجهة'), v: <>{amanahName(c.amanahEn, ar)}<OriginTag origin={c.origin} field="amanah" /></> }, { k: L('Revenue item (illustrative classification)', 'بند الإيراد (تصنيف توضيحي)'), v: <>{itemName(c.itemKey, ar)}<OriginTag origin={c.origin} field="item" /></> },
        { k: L('Starts', 'يبدأ'), v: <>{c.start}<OriginTag origin={c.origin} field="start" /></>, ltr: true }, { k: L('Ends', 'ينتهي'), v: <>{c.end}<OriginTag origin={c.origin} field="end" /></>, ltr: true },
        { k: L('Payment interval (illustrative)', 'دورية الدفعات (توضيحية)'), v: <>{L(`every ${c.intervalMonths} month(s)`, `كل ${c.intervalMonths} شهر`)}<OriginTag origin={c.origin} field="interval" /></> }
      ]} /></section>
      <DataLimitsNote />

      <Section id="invoices" title={L('Payments and invoices — from created to finished', 'الدفعات والفواتير — من الإنشاء إلى الانتهاء')} count={rows.length} aside={<OriginTag origin={c.origin} field="schedule" />}
        note={<div className="rp-limit">{L(`One row per scheduled installment, from the first to the last of the contract. Open a row to see its payments. An installment’s own creation date is not available in the current data: the dates shown are the due date, the invoice’s issue date and the payment dates; “—” means not applicable yet, “${NOT_AVAILABLE.en}” means the information is not in the data. The schedule, “n of N” and the invoice links are generated for the demo.`, `صفّ لكل دفعة مجدولة، من أول دفعة إلى آخرها. افتح الصف لترى مدفوعاته. تاريخ إنشاء الدفعة نفسها غير متاح في البيانات الحالية: التواريخ المعروضة هي الاستحقاق وتاريخ إصدار الفاتورة وتواريخ السداد؛ «—» تعني لا ينطبق بعد، و«${NOT_AVAILABLE.ar}» تعني أن المعلومة غير موجودة في البيانات. الجدول و«دفعة س من ص» وروابط الفواتير مُولَّدة لهذا العرض..`)}</div>}>
        <div className="rv-seg" role="group" aria-label={L('Show installments', 'عرض الدفعات')}>
          {segDef.map((g) => <button key={g.key} type="button" className={`btn btn-sm${g.key === active.key ? ' btn-primary' : ''}`} aria-pressed={g.key === active.key} disabled={!g.n} onClick={() => { setSeg(g.key); setPage(0); }}>{B(g)} · {count(g.n)}</button>)}
        </div>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Payments and invoices', 'الدفعات والفواتير')}>
          <thead><tr><th title={L('The schedule, “n of N” and the year are generated for the demo', 'الجدول و«س من ص» والسنة مُولَّدة لهذا العرض')}>{L('Installment (generated schedule)', 'الدفعة (جدول مُولَّد)')}</th><th>{L('Due date', 'الاستحقاق')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Invoice issued', 'تاريخ إصدار الفاتورة')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th className="num" title={L('Read from the installment’s invoice (Tahseel in production; illustrative in this demo)', 'تُقرأ من فاتورة الدفعة (تحصيل في الإنتاج؛ توضيحية في هذا العرض)')}>{L('Collected (from the invoice)', 'المحصّل (من الفاتورة)')}</th><th className="num" title={L('Invoice amount still owed; not a Furas field', 'مبلغ الفاتورة المتبقي؛ وليس حقلاً من فرص')}>{L('Remaining (from the invoice)', 'المتبقي (من الفاتورة)')}</th><th>{L('Paid', 'السداد')}</th><th>{L('State', 'الحالة')}</th></tr></thead>
          <tbody>{shown.map((p) => {
            const e = p.invoiceNo ? idx.get(p.invoiceNo) : null; const isOpen = openRows.has(p.no);
            return (
              <React.Fragment key={p.no}>
                <tr>
                  <td>{p.invoiced ? <button type="button" className="btn btn-sm" aria-expanded={isOpen} aria-label={L(`Payments of installment ${p.no}`, `مدفوعات الدفعة ${p.no}`)} onClick={() => toggle(p.no)}>{isOpen ? '−' : '+'}</button> : null} <b>{p.no}</b> <span className="muted" title={L('“n of N” comes from the generated schedule', '«س من ص» من الجدول المُولَّد')}>{L(`of ${count(t.installments)} · ${p.year}`, `من ${count(t.installments)} · ${p.year}`)}</span></td>
                  <td dir="ltr">{p.dueDate}</td>
                  <td>{p.invoiceNo ? <><RecordLink to={invoicePath(p.invoiceNo)} dir="ltr">{p.invoiceNo}</RecordLink><div className="muted" style={{ fontSize: 12 }} dir="ltr">{L('SADAD', 'سداد')} {p.sadadNo}</div></> : p.state === 'history' ? <span className="muted">{B(DATA_STATE.unknown)}</span> : p.state === 'unlinked' ? <span className="muted">{L('no invoice linked', 'لا فاتورة مرتبطة')}</span> : <span className="muted">{L('not invoiced', 'لم تُفوتر')}</span>}</td>
                  <td dir="ltr">{p.issueDate || (p.state === 'history' ? <span className="muted">{B(DATA_STATE.unknown)}</span> : <span className="muted">—</span>)}</td>
                  <td className="num" dir="ltr">{sar(p.amount)}</td>
                  <td className="num" dir="ltr">{val(p.collected, p)}</td>
                  <td className="num" dir="ltr">{val(p.outstanding, p)}</td>
                  <td>{p.paidInFullOn ? <>{L('Paid in full', 'سُدّدت كاملة')} <span dir="ltr">{p.paidInFullOn}</span></> : p.lastPaymentOn ? <>{L('Last payment', 'آخر سداد')} <span dir="ltr">{p.lastPaymentOn}</span></> : p.invoiced ? <span className="muted">{L('no payment yet', 'لا سداد بعد')}</span> : <span className="muted">{p.dataState === 'not_applicable' ? '—' : B(DATA_STATE.unknown)}</span>}</td>
                  <td><span className={`rv-badge rv-badge--sm rv-badge--${INSTALLMENT_STATES[p.state]?.tone || 'mute'}`}>{INSTALLMENT_STATES[p.state] ? B(INSTALLMENT_STATES[p.state]) : `${L('Unrecognised state', 'حالة غير معروفة')}: ${p.state}`}</span>{p.daysOverdue > 0 && <div className="muted" style={{ fontSize: 12 }}>{L(`${p.daysOverdue} day(s) overdue unpaid`, `غير مسددة منذ ${p.daysOverdue} يوماً بعد الاستحقاق`)}</div>}{e && e.orders.length > 0 && <div style={{ fontSize: 12 }}>{e.orders.map((o) => <div key={o.enforceNum}><RecordLink to={orderPath(o.enforceNum)} dir="ltr">{o.enforceNum}</RecordLink> <OrderStatusChip status={o.orderStatus} />{e.proposed.some((x) => x.enforceNum === o.enforceNum) && <span className="rv-tag rv-tag--warn">{L('proposed', 'مقترح')}</span>}</div>)}</div>}</td>
                </tr>
                {isOpen && <tr><td colSpan={9}>
                  {p.payments.length ? (
                    <table aria-label={L(`Payments of installment ${p.no}`, `مدفوعات الدفعة ${p.no}`)}><thead><tr><th>{L('Payment date', 'تاريخ السداد')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Channel', 'القناة')}</th><th className="num">{L('Cumulative', 'التراكمي')}</th><th>{L('Against the due date', 'مقارنة بالاستحقاق')}</th></tr></thead>
                      <tbody>{p.payments.map((x, k) => <tr key={k}><td dir="ltr">{x.date}</td><td className="num" dir="ltr">{sar(x.amount)}</td><td>{x.channel}</td><td className="num" dir="ltr">{sar(x.cumulative)}</td><td>{dayText(x.daysAfterDue)}{rev.cfg.graceDays > 0 && x.lateBy > 0 ? ` · ${L(`${x.lateBy} day(s) beyond the grace period`, `${x.lateBy} يوماً بعد مهلة السماح`)}` : ''}</td></tr>)}</tbody></table>
                  ) : <div className="muted">{L('No payment is recorded for this invoice up to the reference date.', 'لا سداد مسجّل لهذه الفاتورة حتى التاريخ المرجعي.')}</div>}
                  {p.exclusion > 0 && <div className="muted" style={{ fontSize: 12 }}>{L(`Excluded amount ${sar(p.exclusion)} — it stays visible and is not counted in net invoiced.`, `المبلغ المستبعد ${sar(p.exclusion)} — يبقى ظاهراً ولا يُحسب في صافي المفوتر.`)}</div>}
                </td></tr>}
              </React.Fragment>
            );
          })}{!shown.length && <tr><td colSpan={9}><div className="rv-empty">{L('No installment in this view.', 'لا دفعات في هذا العرض.')}</div></td></tr>}</tbody>
        </table></div>
        <Pager page={page} total={rows.length} size={PS} onPage={setPage} />
        <dl className="rp-legend">{Object.keys(INSTALLMENT_STATES).filter((k) => c.schedule.some((p) => p.state === k)).map((k) => <div key={k}><dt><span className={`rv-badge rv-badge--sm rv-badge--${INSTALLMENT_STATES[k].tone}`}>{B(INSTALLMENT_STATES[k])}</span></dt><dd>{B(INSTALLMENT_STATE_HELP[k])}</dd></div>)}</dl>
        {c.schedule.some((p) => p.state === 'unlinked') && <CandidateRuleNote />}
      </Section>

      <Section id="relation" title={L('Enforcement relationship — three different facts', 'علاقة الإنفاذ — ثلاث حقائق مختلفة')}>
        <div className="rp-compl">
          <div>
            <h3>{L('1 · Mentioned in an order', '1 · مذكور في أمر')}</h3>
            <div className={`rp-compl__v ${mentioned.length ? 'rp-warn' : ''}`}>{mentioned.length ? L(`Mentioned by ${mentioned.length} order(s) — not a direct referral`, `مذكور في ${mentioned.length} أمر — وليس إحالة مباشرة`) : L('Not mentioned without review', 'غير مذكور دون مراجعة')}</div>
            <div className="rp-compl__d">{mentioned.length ? mentioned.map((o) => <span key={o.enforceNum}><RecordLink to={orderPath(o.enforceNum)} dir="ltr">{o.enforceNum}</RecordLink> <OrderStatusChip status={o.orderStatus} /> </span>) : L('No unreviewed mention of this contract in an order’s description or documents.', 'لا ذكر غير مراجَع لهذا العقد في وصف أمر أو مستنداته.')}</div>
            <div className="rp-compl__d">{L('A mention in a description or document is only a lead. It becomes a direct referral only if a reviewer confirms it from a document (on the order page).', 'الذكر في وصف أو مستند مجرد قرينة. ولا يصبح إحالة مباشرة إلا إذا أكّده مراجع من مستند (في صفحة الأمر).')}</div>
          </div>
          <div>
            <h3>{L('2 · The contract itself (direct referral)', '2 · العقد نفسه (إحالة مباشرة)')}</h3>
            <div className={`rp-compl__v ${direct.length ? 'rp-warn' : ''}`}>{direct.length ? L(`Directly referred by ${direct.length} order(s)`, `محال مباشرة بـ${direct.length} أمر`) : L('Not directly referred', 'غير محال مباشرة')}</div>
            <div className="rp-compl__d">{direct.length ? direct.map((o) => <span key={o.enforceNum}><RecordLink to={orderPath(o.enforceNum)} dir="ltr">{o.enforceNum}</RecordLink> <OrderStatusChip status={o.orderStatus} /> </span>) : L('No order names this contract number in a source field or a reviewed document.', 'لا أمر يذكر رقم هذا العقد في حقل مصدر أو مستند مراجَع.')}</div>
            <div className="rp-compl__d">{direct.length ? direct.map((o) => <div key={o.enforceNum}>{o.enforceNum}: {o.factStatus === 'confirmed_by_review' ? L('confirmed by a reviewer from a document', 'أكّده مراجع من مستند') : L('named in the order data (demo feed; the real Sanad extract has no contract-number column)', 'مذكور في بيانات الأمر (تغذية العرض؛ مستخرج سند الفعلي لا يتضمن عمود رقم عقد)')}</div>) : null}{L('The order names this contract. It does not say which invoices are covered, and it does not mean they are all referred.', 'الأمر يذكر هذا العقد. ولا يحدد أي فواتير يشمل، ولا يعني أنها كلها محالة.')}</div>
          </div>
          <div>
            <h3>{L('3 · The contract’s invoices', '3 · فواتير العقد')}</h3>
            <div className={`rp-compl__v ${referredIds.length ? 'rp-warn' : ''}`}>{L(`${referredIds.length} of ${invoiceIds.length} invoiced installments carry a confirmed order`, `${referredIds.length} من ${invoiceIds.length} دفعات مفوترة عليها أمر مؤكد`)}</div>
            <div className="rp-compl__d">{L('Counted per invoice from confirmed links only. The others are not referred.', 'تُعدّ لكل فاتورة بالروابط المؤكدة فقط. والبقية غير محالة.')}</div>
          </div>
        </div>
        <div className="rp-limit">{L('None implies another: a mention is not a referral, a contract-level order does not mean all its invoices are referred, and referred invoices do not mean the contract itself is referred.', 'لا تعني إحداها الأخرى: الذكر ليس إحالة، والأمر على مستوى العقد لا يعني أن كل فواتيره محالة، والفواتير المحالة لا تعني أن العقد نفسه محال.')}</div>
      </Section>

      <Section id="orders" title={L('Orders associated with this contract', 'أوامر مرتبطة بهذا العقد')} count={orders.length} aside={<OriginTag origin={c.origin} field="orders" />}
        note={<div className="rp-limit">{L('An order appears here only if it names this contract number (contract level) or is linked to one of this contract’s invoices. Nothing is inferred from an amount or a payer name.', 'يظهر الأمر هنا فقط إذا ذكر رقم هذا العقد (على مستوى العقد) أو ارتبط بإحدى فواتيره. ولا يُستنتج شيء من مبلغ أو اسم دافع.')}</div>}>
        {orders.length ? (
          <div className="rp-tablewrap" tabIndex={0}><table>
            <thead><tr><th>{L('Order', 'الأمر')}</th><th>{L('Status', 'الحالة')}</th><th>{L('Opened', 'فُتح في')}</th><th>{L('Closed', 'أُغلق في')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Relation to the contract', 'العلاقة بالعقد')}</th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.enforceNum}>
                <td><RecordLink to={orderPath(o.enforceNum)} dir="ltr"><b>{o.enforceNum}</b></RecordLink></td>
                <td><OrderStatusChip status={o.orderStatus} />{o.orderStatus === 'closed' && <div className="muted" style={{ fontSize: 12 }}>{o.sourceStatus || L('closure reason unknown', 'سبب الإغلاق غير معروف')}</div>}</td>
                <td dir="ltr">{o.openedDate || <span className="muted">{B(DATA_STATE.unknown)}</span>}</td>
                <td>{o.orderStatus === 'closed' ? <span className="muted">{L('date not recorded (no closing date in the Sanad extract)', 'التاريخ غير مسجّل (لا يحتوي مستخرج سند تاريخ إغلاق)')}</span> : <span className="muted">—</span>}</td>
                <td className="num" dir="ltr">{sar(o.amount)}</td>
                <td style={{ fontSize: 12 }}>{o.contractLevel && <div>{L('names the contract number — contract level (not spread over invoices)', 'يذكر رقم العقد — على مستوى العقد (لا يُوزَّع على الفواتير)')}</div>}{o.mentionedOnly && <div className="rp-warn">{L('mentions the contract only — not a direct referral until reviewed', 'يذكر العقد فقط — ليس إحالة مباشرة حتى تتم مراجعته')}</div>}{o.invoices.map((x) => <div key={x.invoiceId}>{L('invoice', 'فاتورة')} <RecordLink to={invoicePath(x.invoiceId)} dir="ltr">{x.invoiceId}</RecordLink> · {x.link === 'confirmed' ? L('confirmed link', 'رابط مؤكد') : L('proposed link', 'رابط مقترح')}</div>)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="muted">{L('No order is recorded for this contract or its invoices. (A missing order field is not evidence that no order exists.)', 'لا يوجد أمر مسجّل لهذا العقد أو فواتيره. (غياب الحقل ليس دليلاً على عدم وجود أمر.)')}</div>}
        {c.requests.length > 0 && <div className="rp-limit">{B(c.execution.note)} {L('Execution is not allocated to installments without evidence or an approved rule.', 'لا يُوزَّع التنفيذ على الدفعات دون دليل أو قاعدة معتمدة.')}</div>}
      </Section>

      <Section id="cr" secondary title={L('Commercial registration chain', 'سلسلة السجل التجاري')} count={c.crChain.length}>
        {c.crChain.length ? (
          <div className="rp-tablewrap" tabIndex={0}><table><thead><tr><th>{L('Sanad request · document / item', 'طلب سند · المستند/البند')}</th><th>{L('CR number (text)', 'رقم السجل (نص)')}</th><th>{L('Extraction', 'الاستخراج')}</th><th>{L('CR View status (raw)', 'حالة CR View (خام)')}</th></tr></thead>
            <tbody>{c.crChain.map((x, i) => <tr key={i}><td dir="auto">{x.sanadRequest} · {x.document}</td><td dir="ltr">{x.crNo}</td><td>{x.method === 'ocr' ? <>{L('Read by OCR in the source', 'قُرئ بـ OCR في المصدر')} <span className={`rv-tag${x.confidence < 0.8 ? ' rv-tag--warn' : ''}`}>{Math.round(x.confidence * 100)}%</span></> : L('Structured data', 'بيانات منظمة')}</td><td dir="ltr"><b>{x.crViewStatusRaw || '—'}</b></td></tr>)}</tbody></table></div>
        ) : <div className="muted">{L('No Sanad document with a CR number for this contract; the registration link is not claimed.', 'لا مستند سند برقم سجل تجاري لهذا العقد؛ ولا يُدّعى ربط السجل.')}</div>}
        <div className="rp-limit">{L('A non-Active CR status is evidence, not an exclusion.', 'حالة السجل غير النشطة دليل وليست استبعاداً.')}</div>
      </Section>
    </div>
  );
}
