import React, { useEffect, useMemo, useState } from 'react';
import { useAsync } from '../utils/useAsync';
import Pager from '../components/Pager';
import { Link, useSearchParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { ProvenanceBadge } from '../components/revenue/RevenueUI';
import { INSTALLMENT_STATES } from '../data/contracts';
import { AMANAH_CATALOG, ITEMS } from '../data/catalog';

const amanahName = (en, ar) => { const a = AMANAH_CATALOG.find((x) => x.en === en); return a ? (ar ? a.ar : a.en) : en; };
const itemName = (key, ar) => { const i = ITEMS.find((x) => x.key === key); return i ? (ar ? i.ar : i.en) : key; };

export default function Contracts() {
  const rev = useRevenue();
  const { L, B, ar, short, money, count, sar } = useL();
  const [sp, setSp] = useSearchParams();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const PS = 25;
  const scopeReq = useMemo(() => ({ amanah: rev.scopeEff.amanah, source: 'investment', from: '2000-01-01', to: rev.cfg.cutoff }), [rev.scopeEff.amanah, rev.cfg.cutoff]);
  // contract cards (aggregates per contract; the payment schedule is loaded only for the contract opened)
  const { data: cd } = useAsync(() => rev.data.contracts(scopeReq), [rev.data, scopeReq]);
  const visible = cd?.cards || [];
  const roll = cd?.rollup || { contracts: 0, multiPayment: 0 };
  const list = useMemo(() => visible.filter((c) => {
    if (q && !`${c.contractNo} ${c.tenantAr} ${c.tenantEn}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'arrears') return c.totals.arrears > 0;
    if (filter === 'exec') return c.requests.length > 0;
    if (filter === 'future') return c.totals.futureInstallments > 0;
    if (filter === 'crinactive') return ['Deleted', 'Cancelled', 'Suspended'].includes(c.crStatusRaw);
    return true;
  }).sort((a, b) => b.totals.arrears - a.totals.arrears), [visible, q, filter]);
  useEffect(() => { setPage(0); }, [q, filter]);
  const selNo = sp.get('no');
  const { data: sel } = useAsync(() => (selNo ? rev.data.contract(selNo).catch(() => null) : Promise.resolve(null)), [rev.data, selNo]);

  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Contracts, enforcement and registry', 'العقود والتنفيذ والسجل التجاري')}</h1>
          <div className="page-sub">{L('Furas contract → payments → Tahseel invoices, and the Sanad execution requests tied to the contract number. Execution amounts are shown at contract level and are never added to the uncollected debt again.', 'عقد فرص ← دفعاته ← فواتير تحصيل، وطلبات تنفيذ سند المرتبطة برقم العقد. تُعرض مبالغ التنفيذ على مستوى العقد ولا تُضاف إلى المديونية غير المحصلة مرة ثانية.')}</div>
        </div>
      </div>

      <div className="rv-tiles">
        <div className="rv-tile"><div className="rv-tile__label">{L('Contracts', 'العقود')}</div><div className="rv-tile__value">{count(visible.length)}</div><div className="rv-tile__sub">{roll.multiPayment} {L('with several payments', 'متعددة الدفعات')}</div></div>
        <div className="rv-tile rv-tile--bad"><div className="rv-tile__label">{L('Overdue installments', 'دفعات متأخرة')}</div><div className="rv-tile__value">{short(visible.reduce((s, c) => s + c.totals.arrears, 0))}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('Invoiced, not yet due', 'مفوترة لم يحن استحقاقها')}</div><div className="rv-tile__value">{short(visible.reduce((s, c) => s + c.totals.notDue, 0))}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('Future installments (not arrears)', 'دفعات مستقبلية (ليست متأخرات)')}</div><div className="rv-tile__value">{short(visible.reduce((s, c) => s + c.totals.futureNotInvoiced, 0))}</div><div className="rv-tile__sub">{L('not invoiced yet', 'لم تُفوتر بعد')}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('Execution at contract level', 'تنفيذ على مستوى العقد')}</div><div className="rv-tile__value">{short(visible.reduce((s, c) => s + (c.execution.invoicesIdentified ? 0 : c.execution.amount), 0))}</div><div className="rv-tile__sub">{L('invoices not identified — not added to the debt', 'فواتير غير محددة — لا تُضاف للمديونية')}</div></div>
      </div>

      <div className="card card-pad">
        <div className="rv-form">
          <label>{L('Search', 'بحث')}<input id="ct_q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Contract number or tenant', 'رقم العقد أو المستأجر')} /></label>
          <label>{L('Show', 'عرض')}
            <select id="ct_f" className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">{L('All contracts', 'كل العقود')}</option>
              <option value="arrears">{L('With overdue installments', 'بدفعات متأخرة')}</option>
              <option value="future">{L('With future installments', 'بدفعات مستقبلية')}</option>
              <option value="exec">{L('With an execution request', 'بطلب تنفيذ')}</option>
              <option value="crinactive">{L('CR status not Active (raw)', 'السجل التجاري غير Active (خام)')}</option>
            </select>
          </label>
        </div>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table">
            <thead><tr><th>{L('Contract', 'العقد')}</th><th>{L('Tenant', 'المستأجر')}</th><th>{L('Amanah', 'الأمانة')}</th><th className="num">{L('Value', 'القيمة')}</th><th className="num">{L('Collected', 'المحصل')}</th><th className="num">{L('Overdue', 'المتأخر')}</th><th className="num">{L('Future', 'مستقبلية')}</th><th>{L('Execution', 'التنفيذ')}</th><th>{L('CR (raw)', 'السجل (خام)')}</th></tr></thead>
            <tbody>
              {list.slice(page * PS, (page + 1) * PS).map((c) => (
                <tr key={c.contractNo} className={c.contractNo === selNo ? 'rv-row--sel' : ''}>
                  <td><button type="button" className="rv-link" dir="ltr" onClick={() => setSp({ no: c.contractNo })}>{c.contractNo}</button></td>
                  <td dir="auto">{ar ? c.tenantAr : c.tenantEn}</td>
                  <td>{amanahName(c.amanahEn, ar)}</td>
                  <td className="num">{short(c.totals.contractValue)}</td>
                  <td className="num">{short(c.totals.collected)}</td>
                  <td className="num">{c.totals.arrears ? <b className="rv-neg">{short(c.totals.arrears)}</b> : '—'}</td>
                  <td className="num">{count(c.totals.futureInstallments)}</td>
                  <td>{c.requests.length ? `${c.requests.length} · ${short(c.execution.amount)}` : '—'}</td>
                  <td dir="ltr">{c.crStatusRaw || '—'}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={9}><div className="rv-empty">{L('No contract matches.', 'لا عقد مطابق.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={list.length} size={PS} onPage={setPage} />
      </div>

      {sel && <ContractCard c={sel} amanah={amanahName(sel.amanahEn, ar)} item={itemName(sel.itemKey, ar)} onClose={() => setSp({})} />}
    </div>
  );
}

function ContractCard({ c, amanah, item, onClose }) {
  const { L, B, ar, short, money, sar } = useL();
  const t = c.totals;
  return (
    <section className="card card-pad rv-contract" aria-label={`${L('Contract', 'العقد')} ${c.contractNo}`}>
      <div className="rv-card__head">
        <div>
          <h2 className="rv-sec-title" dir="ltr">{c.contractNo}</h2>
          <p className="rv-sec-sub" dir="auto">{ar ? c.tenantAr : c.tenantEn} · {amanah} · {item} · {L('status', 'الحالة')}: {c.status} · {L('starts', 'يبدأ')} <span dir="ltr">{c.start}</span></p>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>{L('Close', 'إغلاق')}</button>
      </div>

      <div className="rv-tiles">
        <div className="rv-tile"><div className="rv-tile__label">{L('Contract value', 'قيمة العقد')}</div><div className="rv-tile__value">{short(t.contractValue)}</div><div className="rv-tile__sub">{t.installments} {L('installments', 'دفعة')}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('Due to the reference date', 'المستحق حتى التاريخ المرجعي')}</div><div className="rv-tile__value">{short(t.dueToDate)}</div></div>
        <div className="rv-tile rv-tile--good"><div className="rv-tile__label">{L('Collected', 'المحصل')}</div><div className="rv-tile__value">{short(t.collected)}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('Remaining of the due installments', 'المتبقي من الدفعات المستحقة')}</div><div className="rv-tile__value">{short(t.remainingOfDue)}</div></div>
        <div className={`rv-tile${t.arrears ? ' rv-tile--bad' : ''}`}><div className="rv-tile__label">{L('Overdue', 'المتأخر')}</div><div className="rv-tile__value">{short(t.arrears)}</div><div className="rv-tile__sub">{t.overdueInstallments} {L('installment(s)', 'دفعة')}</div></div>
        <div className="rv-tile"><div className="rv-tile__label">{L('Future installments', 'الدفعات المستقبلية')}</div><div className="rv-tile__value">{short(t.futureNotInvoiced)}</div><div className="rv-tile__sub">{t.futureInstallments} {L('— not arrears', '— ليست متأخرات')}</div></div>
      </div>

      <h4 className="rv-sec-title" style={{ fontSize: 13 }}>{L('Payment schedule', 'جدول الدفعات')}</h4>
      <div className="rv-table-wrap" tabIndex={0}>
        <table className="rv-table">
          <thead><tr><th className="num">#</th><th>{L('Due date', 'الاستحقاق')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Invoice', 'الفاتورة')}</th><th>{L('SADAD no. (text)', 'رقم سداد (نص)')}</th><th>{L('State', 'الحالة')}</th><th className="num">{L('Collected', 'المحصل')}</th><th className="num">{L('Outstanding', 'المتبقي')}</th><th className="num">{L('Contract balance after payment', 'رصيد العقد بعد الدفعة')}</th></tr></thead>
          <tbody>
            {c.schedule.map((p) => (
              <tr key={p.no}>
                <td className="num">{p.no}</td>
                <td dir="ltr">{p.dueDate}</td>
                <td className="num" dir="ltr">{sar(p.amount)}</td>
                <td>{p.invoiceNo ? <Link to={`/invoices?id=${p.invoiceNo}`} dir="ltr">{p.invoiceNo}</Link> : <span className="muted">{L('not invoiced', 'لم تُفوتر')}</span>}</td>
                <td dir="ltr">{p.sadadNo || '—'}</td>
                <td><span className={`rv-badge rv-badge--sm rv-badge--${INSTALLMENT_STATES[p.state].tone}`}>{B(INSTALLMENT_STATES[p.state])}</span></td>
                <td className="num">{p.collected ? sar(p.collected) : '—'}</td>
                <td className="num">{p.outstanding ? sar(p.outstanding) : '—'}</td>
                <td className="num muted">{sar(p.remainingContractBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small className="muted">{L('The repeated balance column is the contract balance AFTER each payment, not an independent amount — it is never summed.', 'عمود الرصيد المتكرر هو رصيد العقد بعد كل دفعة وليس مبلغاً مستقلاً — ولا يُجمع أبداً.')}</small>

      <h4 className="rv-sec-title" style={{ fontSize: 13, marginTop: 14 }}>{L('Execution requests (Sanad)', 'طلبات التنفيذ (سند)')}</h4>
      {c.requests.length ? (
        <>
          <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 0 }}>
            <thead><tr><th>{L('Request', 'الطلب')}</th><th>{L('Status', 'الحالة')}</th><th className="num">{L('Amount', 'المبلغ')}</th><th>{L('Invoices covered', 'الفواتير المشمولة')}</th></tr></thead>
            <tbody>{c.requests.map((q) => <tr key={q.enforceNum}><td dir="ltr"><Link to={`/sanad-orders/${q.enforceNum}`}>{q.enforceNum}</Link></td><td>{q.status}</td><td className="num" dir="ltr">{sar(q.amount)}</td><td>{q.identified ? q.identifiedInvoices.map((id) => <Link key={id} to={`/invoices?id=${id}`} dir="ltr" style={{ marginInlineEnd: 6 }}>{id}</Link>) : <span className="rv-tag">{L('not identified', 'غير محددة')}</span>}</td></tr>)}</tbody>
          </table></div>
          <ul className="rv-list" style={{ marginTop: 8 }}>
            <li>{L('Execution amount', 'مبلغ التنفيذ')}: <b>{short(c.execution.amount)}</b></li>
            <li>{L('Debt that could be tied to execution (outstanding of the identified invoices)', 'المديونية التي أمكن ربطها بالتنفيذ (متبقي الفواتير المحددة)')}: <b>{short(c.execution.linkedDebt)}</b></li>
            <li>{L('Execution amounts whose invoices are not identified', 'مبالغ التنفيذ التي لم تتحدد فواتيرها')}: <b>{short(c.execution.unidentifiedAmount)}</b></li>
          </ul>
          <div className="rv-callout">{B(c.execution.note)} {L('Execution is not allocated to installments without evidence or an approved rule.', 'لا يُوزَّع التنفيذ على الدفعات دون دليل أو قاعدة معتمدة.')}</div>
        </>
      ) : <div className="rv-empty">{L('No execution request is recorded for this contract. (A missing execution field is not evidence that no execution exists.)', 'لا يوجد طلب تنفيذ مسجل لهذا العقد. (غياب حقل التنفيذ ليس دليلاً على عدم وجود تنفيذ.)')}</div>}

      <h4 className="rv-sec-title" style={{ fontSize: 13, marginTop: 14 }}>{L('Commercial registration chain', 'سلسلة السجل التجاري')}</h4>
      {c.crChain.length ? (
        <div className="rv-table-wrap" tabIndex={0}><table className="rv-table" style={{ minWidth: 0 }}>
          <thead><tr><th>{L('Sanad request · document / item', 'طلب سند · المستند/البند')}</th><th>{L('CR number (text)', 'رقم السجل (نص)')}</th><th>{L('Extraction', 'الاستخراج')}</th><th>{L('CR View status (raw)', 'حالة CR View (خام)')}</th></tr></thead>
          <tbody>{c.crChain.map((x, i) => (
            <tr key={i}><td dir="auto">{x.sanadRequest} · {x.document}</td><td dir="ltr">{x.crNo}</td>
              <td>{x.method === 'ocr' ? <>OCR <span className={`rv-tag${x.confidence < 0.8 ? ' rv-tag--warn' : ''}`}>{Math.round(x.confidence * 100)}%{x.confidence < 0.8 ? ` · ${L('review', 'مراجعة')}` : ''}</span></> : L('Structured data', 'بيانات منظمة')}</td>
              <td dir="ltr"><b>{x.crViewStatusRaw || '—'}</b></td></tr>
          ))}</tbody>
        </table></div>
      ) : <div className="rv-empty">{L('No Sanad document with a CR number for this contract; the registration link is not claimed.', 'لا مستند سند برقم سجل تجاري لهذا العقد؛ ولا يُدّعى ربط السجل.')}</div>}
      <div className="rv-callout rv-callout--warn" style={{ marginTop: 8 }}>{L('A non-Active CR status is evidence, not an exclusion. The invoice is excluded only if rule CR-1 is enabled, the raw status is one the rule accepts, and a reviewer approves it.', 'حالة السجل غير النشطة دليل وليست استبعاداً. لا تُستبعد الفاتورة إلا إذا فُعّلت القاعدة CR-1 وكانت الحالة الخام مما تقبله القاعدة واعتمدها مراجع.')}</div>
    </section>
  );
}
