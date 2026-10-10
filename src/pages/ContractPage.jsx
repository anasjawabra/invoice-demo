import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAsync } from '../utils/useAsync';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { INSTALLMENT_STATES } from '../data/contracts';
import { RecordHeader, StatusGroup, Figures, Facts, Section, RecordState } from '../components/record/RecordPage';
import { OrderStatusChip } from '../components/revenue/EnforcementUI';
import { RecordLink, useReturnTarget } from '../utils/returnContext';
import { invoicePath, orderPath } from '../utils/paths';
import { buildIndex, ordersOfContract, CLOSE_REASON_LABEL } from '../data/relations';
import { amanahName, itemName } from './Contracts';

// The contract as a full page: its invoices (the payment schedule) and, for each invoice, the orders that name it — from the same relationship model
// used by the invoice and order pages. A contract-level Sanad request (one that only names the contract number) is shown as such: it is never spread over invoices.
export default function ContractPage() {
  const { no: raw } = useParams(); const no = decodeURIComponent(raw || '');
  const rev = useRevenue();
  const { L, B, ar, short, sar } = useL();
  const [reload, setReload] = useState(0);
  const ret = useReturnTarget({ path: '/contracts', label: L('Contracts', 'العقود') });
  const { data: c, loading, error } = useAsync(() => rev.data.contract(no), [rev.data, no, reload]);
  const idx = useMemo(() => buildIndex(rev.cases), [rev.cases]);
  const crumbs = [{ label: L('Dashboards and reports', 'لوحة المعلومات والتقارير'), to: '/insights' }, { label: L('Contracts', 'العقود'), to: '/contracts' }, { label: no, ltr: true }];
  if (!c) {
    const nf = !loading && (error?.status === 404 || error?.message === 'contract_not_found');
    return <div className="rp"><RecordHeader crumbs={crumbs} title={no} ret={ret} /><RecordState loading={loading && !error} error={error && !nf ? error : null} notFound={nf} onRetry={() => setReload((x) => x + 1)} kind={L('Contract', 'العقد')} backTo={{ path: '/contracts', label: L('Back to the contracts', 'العودة إلى العقود') }} /></div>;
  }
  const t = c.totals; const invoiceIds = c.schedule.map((p) => p.invoiceNo).filter(Boolean);
  const orders = ordersOfContract(no, invoiceIds, rev.cases);
  const direct = orders.filter((o) => o.contractLevel); const mentioned = orders.filter((o) => o.mentionedOnly); const referredIds = invoiceIds.filter((id) => idx.get(id)?.referredEver);
  return (
    <div className="rp">
      <RecordHeader crumbs={crumbs} ret={ret} kind={L('Contract', 'عقد')} title={c.contractNo}
        statuses={<StatusGroup label={L('Contract status', 'حالة العقد')}><span className="rv-tag">{c.status}</span></StatusGroup>} />
      <Figures label={L('Contract summary', 'ملخص العقد')} items={[
        { label: L('Contract value', 'قيمة العقد'), value: short(t.contractValue), note: `${t.installments} ${L('installments', 'دفعة')}` },
        { label: L('Due to the reference date', 'المستحق حتى التاريخ المرجعي'), value: short(t.dueToDate) },
        { label: L('Collected', 'المحصل'), value: short(t.collected), tone: 'good' },
        { label: L('Overdue', 'المتأخر'), value: short(t.arrears), tone: t.arrears ? 'bad' : undefined, note: `${t.overdueInstallments} ${L('installment(s)', 'دفعة')}` },
        { label: L('Future installments', 'الدفعات المستقبلية'), value: short(t.futureNotInvoiced), note: L('not arrears', 'ليست متأخرات') }
      ]} />
      <section className="rp-section"><Facts items={[
        { k: L('Tenant', 'المستأجر'), v: ar ? c.tenantAr : c.tenantEn }, { k: L('Amanah', 'الأمانة'), v: amanahName(c.amanahEn, ar) }, { k: L('Revenue item', 'بند الإيراد'), v: itemName(c.itemKey, ar) }, { k: L('Starts', 'يبدأ'), v: c.start, ltr: true }
      ]} /></section>

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
            <div className="rp-compl__d">{direct.length ? direct.map((o) => <div key={o.enforceNum}>{o.enforceNum}: {o.factStatus === 'confirmed_by_review' ? L('confirmed by a reviewer from a document', 'أكّده مراجع من مستند') : L('Sanad’s structured contract field', 'حقل العقد المهيكل في سند')}</div>) : null}{L('The order names this contract. It does not say which invoices are covered, and it does not mean they are all referred.', 'الأمر يذكر هذا العقد. ولا يحدد أي فواتير يشمل، ولا يعني أنها كلها محالة.')}</div>
          </div>
          <div>
            <h3>{L('3 · The contract’s invoices', '3 · فواتير العقد')}</h3>
            <div className={`rp-compl__v ${referredIds.length ? 'rp-warn' : ''}`}>{L(`${referredIds.length} of ${invoiceIds.length} invoiced installments carry a confirmed order`, `${referredIds.length} من ${invoiceIds.length} دفعات مفوترة عليها أمر مؤكد`)}</div>
            <div className="rp-compl__d">{L('Counted per invoice from confirmed links only. The others are not referred.', 'تُعدّ لكل فاتورة بالروابط المؤكدة فقط. والبقية غير محالة.')}</div>
          </div>
        </div>
        <div className="rp-limit">{L('None implies another: a mention is not a referral, a contract-level order does not mean all its invoices are referred, and referred invoices do not mean the contract itself is referred.', 'لا تعني إحداها الأخرى: الذكر ليس إحالة، والأمر على مستوى العقد لا يعني أن كل فواتيره محالة، والفواتير المحالة لا تعني أن العقد نفسه محال.')}</div>
      </Section>

      <Section id="invoices" title={L('Invoices and payment schedule', 'الفواتير وجدول الدفعات')} count={invoiceIds.length}
        note={<div className="rp-limit">{L('The repeated balance column is the contract balance AFTER each payment, not an independent amount — it is never summed.', 'عمود الرصيد المتكرر هو رصيد العقد بعد كل دفعة وليس مبلغاً مستقلاً — ولا يُجمع أبداً.')}</div>}>
        <div className="rp-tablewrap" tabIndex={0}><table aria-label={L('Payment schedule', 'جدول الدفعات')}>
          <thead><tr><th className="num">#</th><th>{L('Due date', 'الاستحقاق')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('Orders on the invoice', 'أوامر الفاتورة')}</th><th>{L('State', 'الحالة')}</th><th className="num">{L('Collected', 'المحصل')}</th><th className="num">{L('Remaining', 'المتبقي')}</th></tr></thead>
          <tbody>{c.schedule.map((p) => {
            const e = p.invoiceNo ? idx.get(p.invoiceNo) : null;
            return (
              <tr key={p.no}>
                <td className="num">{p.no}</td><td dir="ltr">{p.dueDate}</td><td className="num" dir="ltr">{sar(p.amount)}</td>
                <td>{p.invoiceNo ? <RecordLink to={invoicePath(p.invoiceNo)} dir="ltr">{p.invoiceNo}</RecordLink> : <span className="muted">{L('not invoiced', 'لم تُفوتر')}</span>}</td>
                <td style={{ fontSize: 12 }}>{e && e.orders.length ? e.orders.map((o) => <div key={o.enforceNum}><RecordLink to={orderPath(o.enforceNum)} dir="ltr">{o.enforceNum}</RecordLink> <OrderStatusChip status={o.orderStatus} />{e.proposed.some((x) => x.enforceNum === o.enforceNum) && <span className="rv-tag rv-tag--warn">{L('proposed', 'مقترح')}</span>}</div>) : <span className="muted">—</span>}</td>
                <td><span className={`rv-badge rv-badge--sm rv-badge--${INSTALLMENT_STATES[p.state].tone}`}>{B(INSTALLMENT_STATES[p.state])}</span></td>
                <td className="num">{p.collected ? sar(p.collected) : '—'}</td><td className="num">{p.outstanding ? sar(p.outstanding) : '—'}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </Section>

      <Section id="orders" title={L('Orders associated with this contract', 'أوامر مرتبطة بهذا العقد')} count={orders.length}
        note={<div className="rp-limit">{L('An order appears here only if it names this contract number (contract level) or is linked to one of this contract’s invoices. Nothing is inferred from an amount or a payer name.', 'يظهر الأمر هنا فقط إذا ذكر رقم هذا العقد (على مستوى العقد) أو ارتبط بإحدى فواتيره. ولا يُستنتج شيء من مبلغ أو اسم دافع.')}</div>}>
        {orders.length ? (
          <div className="rp-tablewrap" tabIndex={0}><table>
            <thead><tr><th>{L('Order', 'الأمر')}</th><th>{L('Status', 'الحالة')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Relation to the contract', 'العلاقة بالعقد')}</th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.enforceNum}>
                <td><RecordLink to={orderPath(o.enforceNum)} dir="ltr"><b>{o.enforceNum}</b></RecordLink></td>
                <td><OrderStatusChip status={o.orderStatus} />{o.orderStatus === 'closed' && <div className="muted" style={{ fontSize: 12 }}>{o.closeReason ? B(CLOSE_REASON_LABEL[o.closeReason] || { en: o.closeReason, ar: o.closeReason }) : L('closure reason unknown', 'سبب الإغلاق غير معروف')}</div>}</td>
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
