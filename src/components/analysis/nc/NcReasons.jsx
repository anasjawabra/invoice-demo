// Tab 2 · الأسباب والتركّز — the documented reasons (and what is not documented), aging, and where the overdue exposure sits; the overlapping process / data-quality views are tabled and labelled non-additive.
import React, { useMemo } from 'react';
import { useL } from '../../../utils/bi';
import { useNc, ChartCard, LimitNote } from './NcBits';
import { buildCharts, processDrill, lab } from './ncModel';

function OverlapTable({ title, rows, hint }) {
  const { a, ar, f, openDrill } = useNc(); const { L } = useL();
  return (
    <section className="nc-card">
      <h3 className="nc-h nc-h--sm">{title} <span className="nc-badge nc-badge--warn">{L('Overlapping — not additive', 'متداخل — لا يُجمع')}</span></h3>
      <div className="rv-table-wrap" tabIndex={0}>
        <table className="rv-table nc-table" aria-label={title}>
          <thead><tr><th>{L('View', 'العرض')}</th><th className="num">{L('Invoices', 'الفواتير')}</th><th className="num">{L('Unpaid amount (SAR)', 'المبلغ غير المسدد (ريال)')}</th><th><span className="sr-only">{L('Invoices', 'الفواتير')}</span></th></tr></thead>
          <tbody>
            {rows.flatMap((x) => [x, ...(x.sub || []).map((s) => ({ ...s, _sub: true }))]).map((x) => (
              <tr key={x.key} className={x._sub ? 'nc-row--sub' : ''}>
                <th scope="row" className="nc-rowh">{x._sub ? '↳ ' : ''}{lab(x, ar)}</th>
                <td className="num" dir="ltr">{f.count(x.count)}</td><td className="num" dir="ltr">{f.full(x.amount)}</td>
                <td>{x.count > 0 ? <button type="button" className="nc-linkbtn" onClick={() => openDrill(processDrill(x))} aria-label={`${L('Show the invoices', 'عرض الفواتير')}: ${lab(x, ar)}`}>{L('Show invoices', 'عرض الفواتير')}</button> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hint && <p className="nc-fine">{hint}</p>}
    </section>
  );
}

export default function NcReasons() {
  const { a, ar, f } = useNc(); const { L } = useL();
  const ch = useMemo(() => buildCharts(a, ar), [a, ar]);
  const P = a.populations; const noneDoc = P.documented.count === 0;
  return (
    <div className="nc-stack">
      <section className="nc-card">
        <ChartCard chart={ch.reasons} name="reasons"
          note={L(`Denominator: net unpaid ${f.money(P.netUnpaid.amount)} (${f.count(P.netUnpaid.count)} invoices). Each invoice is in exactly one reason, so the bars add up to the net. The process and data-quality views below overlap and are not added to it.`, `المقام: صافي غير المسدد ${f.money(P.netUnpaid.amount)} (${f.count(P.netUnpaid.count)} فاتورة). كل فاتورة في سبب واحد فقط فتجمع الأعمدة إلى الصافي. أما عروض الإجراء وجودة البيانات أدناه فمتداخلة ولا تُجمع معه.`)} />
        {noneDoc && <p className="nc-callout">{L('The source records no non-collection reason for any of these invoices. Lateness, part-payment, enforcement and missing data are states, not reasons, and no reason is inferred from them.', 'لا يسجّل المصدر سبب عدم تحصيل لأي من هذه الفواتير. التأخر والسداد الجزئي والإنفاذ ونقص البيانات حالات وليست أسباباً، ولا يُستنتج سبب منها.')}</p>}
      </section>
      <div className="nc-grid2">
        <section className="nc-card"><ChartCard chart={ch.aging} name="aging" note={L('Age counted from the due date to the reference date; “not yet due” is a separate bucket, not an age.', 'العمر من تاريخ الاستحقاق إلى تاريخ المرجع؛ و«لم يحن استحقاقه» فئة مستقلة وليس عمراً.')} /></section>
        <section className="nc-card"><ChartCard chart={ch.source} name="source" /></section>
        <section className="nc-card"><ChartCard chart={ch.amanah} name="amanah" /></section>
        <section className="nc-card"><ChartCard chart={ch.muni} name="muni" note={L('Every invoice is in one row of its Amanah: a reference municipality, “No municipality (not specified in source)”, “Issued directly by the Amanah” or “Needs review”. Each row opens exactly its invoices.', 'كل فاتورة في صف واحد ضمن أمانتها: بلدية من المرجع، أو «بلا بلدية (غير محددة في المصدر)»، أو «مباشر على الأمانة»، أو «تحتاج مراجعة». كل صف يفتح فواتيره بالضبط.')} /></section>
      </div>
      <section className="nc-card"><ChartCard chart={ch.heat} name="heat" note={L('A hatched cell means no invoice (not zero). Click a cell for its invoices, a row name for the whole Amanah.', 'الخلية المخططة تعني لا توجد فواتير (وليست صفراً). انقر خلية لفواتيرها أو اسم الصف للأمانة كلها.')} /></section>
      <LimitNote>{L('Overdue ranking uses the overdue amount only; the net unpaid of each Amanah is in the heat map and in the table view of each chart.', 'يعتمد الترتيب على مبلغ المتأخر فقط؛ وصافي غير المسدد لكل أمانة في الخريطة الحرارية وفي عرض الجدول لكل رسم.')}</LimitNote>
      <div className="nc-grid2">
        <OverlapTable title={L('Collection process (as recorded)', 'مسار التحصيل (كما هو مسجَّل)')} rows={a.process} hint={L('An invoice with a confirmed order may also have a recorded objection; the counts are not added.', 'قد تجتمع في فاتورة واحدة أمر إنفاذ مؤكَّد واعتراض مسجَّل؛ فلا تُجمع الأعداد.')} />
        <OverlapTable title={L('Data-quality flags', 'ملاحظات جودة البيانات')} rows={a.quality} hint={L('One invoice can carry several flags; each flag is counted on its own.', 'قد تحمل الفاتورة الواحدة أكثر من ملاحظة؛ وتُحتسب كل ملاحظة على حدة.')} />
      </div>
    </div>
  );
}
