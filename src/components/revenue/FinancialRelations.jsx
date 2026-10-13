// The approved relationships made visible: gross billed splits into exclusions + net billed; net billed splits into collected + uncollected.
// Both bars share ONE scale (share of gross billed) and the second bar sits under the "net billed" segment, so collected and uncollected
// read as parts of net billed and exclusions as a deduction from gross — never as independent totals.
import React, { useState } from 'react';
import { useL, ratioText } from '../../utils/bi';
import { unitOfValues } from '../../utils/money';

export default function FinancialRelations({ totals: T }) {
  const { L, ar, money, sar } = useL();
  const [sel, setSel] = useState(null); // the segment whose name and figures are open
  const u = unitOfValues([T.gross, T.exclusions, T.net, T.collected, T.outstanding]); // the five amounts share ONE unit
  const short = (v) => money(v, u);
  if (!(T.gross > 0)) return <div className="rv-na">{L('Gross billed is zero for this selection — the relationships are not available.', 'إجمالي المفوتر صفر لهذا الاختيار — العلاقات غير متاحة.')}</div>;
  const p = (v) => `${Math.max(0, (v / T.gross) * 100)}%`;
  // every segment is a button: pressing (or focusing) it opens its name, amount, share and meaning below — thin segments cannot hold a label, so the legend and this detail name them all
  const Seg = ({ id, cls, w, title, amount, extra }) => (
    <button type="button" className={`rv-rel__seg rv-rel__seg--${cls}${sel === id ? ' is-on' : ''}`} style={{ width: p(w), flex: 'none' }} aria-pressed={sel === id}
      title={title ? `${title}: ${sar(amount)}` : L('Alignment space (no amount)', 'مساحة فارغة للمحاذاة (بلا مبلغ)')} onClick={() => setSel(sel === id ? null : id)}>
      {w / T.gross >= 0.07 && title ? <><span>{title}</span><small dir="ltr">{short(amount)}{extra ? ` · ${extra}` : ''}</small></> : null}
    </button>
  );
  const canc = T.cancelled; const rules = Math.max(0, T.exclusions - T.cancelled);
  const share = (it) => (it.base === 'net' ? { v: it.amount / T.net, of: L('of net billed', 'من صافي المفوتر') } : { v: it.amount / T.gross, of: L('of gross billed', 'من إجمالي المفوتر') });
  const pc = (v) => `${(v * 100).toFixed(v > 0 && v < 0.001 ? 2 : 1)}%`;
  const items = [
    ...(T.exclusions > 0 ? [
      { id: 'cancel', cls: 'cancel', name: L('Cancelled', 'ملغى'), amount: canc, about: L('Invoices cancelled in the source. Deducted as a separate item because a cancelled invoice is not claimed; whether it counts as an «approved exclusion» is not confirmed by the requirements.', 'فواتير أُلغيت في المصدر. تُخصم كبند منفصل لأن الفاتورة الملغاة لا تُطالَب، ولم تؤكد المتطلبات بعد أنها «استبعاد معتمد».') },
      { id: 'excl', cls: 'excl', name: L('Rule-based exclusions', 'استبعاد وفق قواعد'), amount: rules, about: L('Invoices excluded under the exclusion rules that are switched on (by default only the business-approved ones: duplicate invoice, struck-off commercial registration).', 'فواتير استُبعدت وفق قواعد الاستبعاد المفعّلة (افتراضياً المعتمدة فقط: فاتورة مكررة، سجل تجاري مشطوب).') }
    ] : []),
    { id: 'net', cls: 'net', name: L('Net billed', 'صافي المفوتر'), amount: T.net, about: L('Gross billed − exclusions: the amount that is claimed from payers.', 'إجمالي المفوتر − الاستبعادات: المبلغ المطلوب تحصيله من الدافعين.') },
    { id: 'coll', cls: 'coll', name: L('Collected', 'المحصّل'), amount: T.collected, base: 'net', about: L('Payments received on the invoices issued in the period, up to the reference date (capped at each invoice).', 'المدفوعات المستلمة على فواتير الفترة حتى تاريخ المرجع (بحد أقصى قيمة كل فاتورة).') },
    { id: 'unc', cls: 'unc', name: L('Uncollected', 'غير المحصّل'), amount: T.outstanding, base: 'net', about: L('Net billed − collected: still to be collected on the period’s invoices.', 'صافي المفوتر − المحصّل: ما بقي للتحصيل على فواتير الفترة.') }
  ];
  const open = sel === 'gap' ? { name: L('Alignment space', 'مساحة فارغة للمحاذاة'), amount: null, about: L('No amount: it only keeps the second bar under the net-billed segment so collected and uncollected read as parts of net billed.', 'بلا مبلغ: تُبقي الشريط الثاني تحت شريحة صافي المفوتر ليُقرأ المحصّل وغير المحصّل كجزأين من الصافي.') } : items.find((x) => x.id === sel);
  return (
    <div className="rv-rel" role="group" aria-label={L('Financial relationships', 'العلاقات المالية')}>
      <div className="rv-rel__cap"><span>{L('Gross billed', 'إجمالي المفوتر')} <b dir="ltr">{short(T.gross)}</b> = {L('exclusions', 'الاستبعادات')} <b dir="ltr">{short(T.exclusions)}</b> + {L('net billed', 'صافي المفوتر')} <b dir="ltr">{short(T.net)}</b></span></div>
      <div className="rv-rel__row">
        {T.exclusions > 0 && <Seg id="cancel" cls="cancel" w={canc} title={L('Cancelled', 'ملغى')} amount={canc} />}
        {T.exclusions > 0 && <Seg id="excl" cls="excl" w={rules} title={L('Rule-based exclusions', 'استبعاد وفق قواعد')} amount={rules} />}
        <Seg id="net" cls="net" w={T.net} title={L('Net billed', 'صافي المفوتر')} amount={T.net} />
      </div>
      <div className="rv-rel__row" aria-label={L('Net billed splits into collected and uncollected', 'صافي المفوتر = المحصّل + غير المحصّل')}>
        {T.exclusions > 0 && <Seg id="gap" cls="gap" w={T.exclusions} title="" amount={T.exclusions} />}
        <Seg id="coll" cls="coll" w={T.collected} title={L('Collected', 'المحصّل')} amount={T.collected} extra={ratioText(T.collectedOverNet, ar)} />
        <Seg id="unc" cls="unc" w={T.outstanding} title={L('Uncollected', 'غير المحصّل')} amount={T.outstanding} />
      </div>
      <ul className="rv-rel__legend" aria-label={L('Every segment of the bars', 'كل أجزاء الشريطين')}>
        {items.map((it) => (
          <li key={it.id}><button type="button" className={`rv-rel__key${sel === it.id ? ' is-on' : ''}`} aria-pressed={sel === it.id} onClick={() => setSel(sel === it.id ? null : it.id)}><i className={`rv-rel__swatch rv-rel__seg--${it.cls}`} aria-hidden="true" />{it.name} <b dir="ltr">{money(it.amount)}</b> <span className="muted">(<bdi dir="ltr">{pc(share(it).v)}</bdi> {share(it).of})</span></button></li>
        ))}
      </ul>
      {open && (
        <div className="rv-rel__detail" role="status">
          <div><b>{open.name}</b>{open.amount != null && <>{': '}<span dir="ltr">{sar(open.amount)}</span> <span className="muted">(<bdi dir="ltr">{pc(share(open).v)}</bdi> {share(open).of})</span></>}</div>
          <div className="muted" style={{ fontSize: 13 }}>{open.about}</div>
        </div>
      )}
      <div className="rv-rel__cap">
        <span>{L('Net billed', 'صافي المفوتر')} <b dir="ltr">{short(T.net)}</b> = {L('collected', 'المحصّل')} <b dir="ltr">{short(T.collected)}</b> + {L('uncollected', 'غير المحصّل')} <b dir="ltr">{short(T.outstanding)}</b></span>
        <span>{L('Collection rate', 'نسبة التحصيل')} <b dir="ltr">{ratioText(T.collectedOverNet, ar)}</b></span>
        <span>{L('Exclusion rate', 'نسبة الاستبعاد')} <b dir="ltr">{ratioText(T.exclusionRate, ar)}</b></span>
      </div>
    </div>
  );
}
