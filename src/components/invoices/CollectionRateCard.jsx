// «نسبة التحصيل ضمن النطاق» — a compact contextual summary of ALL invoices in the selected scope, next to the revenue-source chart of the collected register.
// One population, one basis: Collected ÷ Net invoiced × 100 over every invoice of the scope (period, Amanah, municipality, revenue source, product). The register below lists only the
// invoices with money collected, so the card says so once, in one short note; the formula and the filter rules live in the information tooltip, never as a long equation.
import React from 'react';
import { useL } from '../../utils/bi';
import InfoTip from './InfoTip';
import { ratePct, rateParts } from './rateCardLogic';

export default function CollectionRateCard({ totals, loading = false }) {
  const { L, ar, count: nf, short, sar } = useL();
  const p = rateParts(totals); const title = L('Collection rate within scope', 'نسبة التحصيل ضمن النطاق');
  const ready = !!totals && !loading;
  return (
    <aside className="il-rate" aria-label={title} aria-busy={loading || undefined}>
      <header className="il-rate__head">
        <h3 className="il-rate__title">{title}</h3>
        <InfoTip label={L('How the rate is calculated', 'كيف تُحسب النسبة')}>
          <b>{L('Collection rate = Collected ÷ Net invoiced × 100', 'نسبة التحصيل = المحصّل ÷ صافي المفوتر × 100')}</b>
          <span>{L('Net invoiced = gross invoiced − approved exclusions (cancellation included). Every invoice of the scope is counted — the invoice count also includes excluded and cancelled invoices.', 'صافي المفوتر = إجمالي المفوتر − الاستبعادات المعتمدة (ويشمل الإلغاء). تُحتسب كل فواتير النطاق، ويشمل عدد الفواتير المستبعدة والملغاة.')}</span>
          <span>{L('It follows the period, Amanah, municipality, revenue source and product. The register’s collection-state, invoice-type and search filters affect the register only, not this card.', 'تتبع الفترة والأمانة والبلدية ومصدر الإيراد والمنتج. أما مرشّحات حالة التحصيل ونوع الفاتورة والبحث فتخص السجل فقط ولا تؤثر في هذه البطاقة.')}</span>
          <span>{L('The collected amount here covers every invoice of the scope, so it can differ slightly from the register’s collected total.', 'المحصّل هنا يغطي كل فواتير النطاق، فقد يختلف قليلاً عن إجمالي المحصّل في السجل.')}</span>
        </InfoTip>
      </header>
      {!ready ? <div className="il-rate__skel" aria-hidden="true" /> : p.state === 'na' ? (
        <>
          <div className="il-rate__value il-rate__value--na" dir="ltr" aria-label={L('Not available', 'غير متاحة')}>—</div>
          <p className="il-rate__na" role="status">{L('Not available: no net invoiced amount in this scope (nothing to divide by).', 'غير متاحة: لا يوجد صافي مفوتر في هذا النطاق (لا مقام للقسمة).')}</p>
        </>
      ) : (
        <>
          <div className="il-rate__value" dir="ltr">{ratePct(p.rate)}</div>
          <div className="il-rate__bar" role="img" aria-label={L(`Collected ${short(p.collected)} of ${short(p.net)} net invoiced; remaining ${short(p.remaining)}`, `المحصّل ${short(p.collected)} من ${short(p.net)} صافي مفوتر؛ المتبقي ${short(p.remaining)}`)}>
            <span className="il-rate__seg il-rate__seg--got" style={{ width: `${p.gotPct}%` }} title={`${L('Collected', 'المحصّل')}: ${sar(p.collected)}`} />
            <span className="il-rate__seg il-rate__seg--left" style={{ width: `${100 - p.gotPct}%` }} title={`${L('Remaining net unpaid', 'المتبقي غير المحصّل')}: ${sar(p.remaining)}`} />
          </div>
          <div className="il-rate__legend" aria-hidden="true"><span><i className="il-rate__dot il-rate__dot--got" />{L('Collected', 'المحصّل')}</span><span><i className="il-rate__dot il-rate__dot--left" />{L('Remaining net unpaid', 'المتبقي غير المحصّل')}</span></div>
          <dl className="il-rate__facts">
            <div><dt>{L('Collected', 'المحصّل')}</dt><dd title={sar(p.collected)} dir="ltr">{short(p.collected)}</dd></div>
            <div><dt>{L('Net invoiced', 'صافي المفوتر')}</dt><dd title={sar(p.net)} dir="ltr">{short(p.net)}</dd></div>
          </dl>
        </>
      )}
      <p className="il-rate__ctx">{ready && p.state !== 'na' ? <>{L('Invoices in scope', 'الفواتير في النطاق')}: <b dir="ltr">{nf(p.invoices)}</b></> : null}</p>
      <p className="il-rate__note">{L('The rate covers all invoices in the selected scope. The register shows fully or partially paid invoices.', 'النسبة لجميع فواتير النطاق المحدد، بينما يعرض السجل الفواتير المحصّلة كلياً أو جزئياً.')}</p>
    </aside>
  );
}
