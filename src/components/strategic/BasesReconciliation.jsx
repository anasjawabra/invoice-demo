// «ما الذي يقيسه كل رقم؟» — one place that states, for every figure on the Planning page, its period and scope, its accounting basis, whether it is actual /
// forecast / scenario / synthetic, and its data cut-off, and that RECONCILES the two actual measures that look alike (collected on the plan period's invoices vs receipts by payment date).
// Nothing here adds an actual to a forecast or a scenario; where the page itself has to put two bases side by side (the funding projection) the difference is said out loud.
import React from 'react';
import { useAr } from '../../utils/useAr';
import { fmtMoney } from '../../utils/money';
import { fmtDateText, fmtRangeText } from '../../data/clock';

export default function BasesReconciliation({ plan, scopeLabel, s, today, fy, snapshot, receipts, rec, funding, scenRes, scenarioOn, cov, coverageApproved = false }) {
  const { L, ar, lang } = useAr();
  const D = (d) => fmtDateText(d, ar ? 'ar' : 'en'); const m = (v) => (v == null ? L('غير متاح', 'n/a') : fmtMoney(v, { lang }));
  const T = snapshot.totals; const through = s.to < today ? s.to : today;
  const periodTxt = fmtRangeText(s.from, s.to, ar ? 'ar' : 'en');
  const fyTxt = fmtRangeText(`${fy}-01-01`, today, ar ? 'ar' : 'en');
  const periodEqFy = s.from === `${fy}-01-01` && s.to >= today;
  const tag = (k) => <span className={`st-tag st-tag--${{ actual: 'actual', forecast: 'forecast', scenario: 'scenario', synthetic: 'warn', target: 'target' }[k]}`}>{{ actual: L('فعلي', 'actual'), forecast: L('تنبؤ', 'forecast'), scenario: L('سيناريو', 'scenario'), synthetic: L('اصطناعي', 'synthetic'), target: L('مستهدف تجريبي', 'demo target') }[k]}</span>;
  const rows = [
    [L('المحصّل (خط الأساس)', 'Collected (baseline)'), m(T.collected), tag('actual'), L(`فترة الخطة ${periodTxt}؛ نطاق الخطة: ${scopeLabel}`, `Plan period ${periodTxt}; plan scope: ${scopeLabel}`), L('أساس الفواتير: ما حُصّل على الفواتير الصادرة في الفترة (مدفوع محدود بصافي الفاتورة)', 'Invoice basis: what was collected on invoices ISSUED in the period (paid, capped at the invoice net)'), L(`حتى ${D(through)} (نهاية الفترة أو آخر بيانات)`, `to ${D(through)} (period end or the data cut-off)`)],
    [L('المقبوضات منذ بداية السنة', 'Receipts since the start of the year'), m(receipts), tag('actual'), L(`السنة المالية ${fyTxt}؛ نطاق الخطة نفسه`, `Fiscal year ${fyTxt}; the plan's scope`), L('أساس تاريخ الدفع: كل ما قُبض في الفترة، على أي فاتورة (أحدث أو أقدم)', 'Payment-date basis: everything received in the window, on any invoice (newer or older)'), L(`حتى ${D(today)}`, `to ${D(today)}`)],
    [L('التنبؤ بمقبوضات بقية السنة', 'Forecast of receipts for the rest of the year'), funding.available ? m(funding.restReceipts) : L('غير متاح', 'n/a'), tag('forecast'), L('بقية السنة المالية؛ نطاق الخطة نفسه', 'Rest of the fiscal year; the plan scope'), L('أساس تاريخ الدفع، تقدير مستقل عن المستهدف (اتجاه خطي أو متوسط حديث — يُذكر أيّهما في جدول التوقعات)', 'Payment-date basis, an estimate independent of the target (linear trend or recent average — the outlook table says which)'), L(`من ${D(today)} إلى ${D(plan.planDate || `${fy}-12-31`)}`, `from ${D(today)} to ${D(plan.planDate || `${fy}-12-31`)}`)],
    [L('أثر السيناريو على المحصّل', 'Scenario effect on collected'), scenRes ? `${scenRes.deltaCollected >= 0 ? '+' : ''}${m(scenRes.deltaCollected)}` : '—', tag('scenario'), L(`فترة الخطة ونطاقها (${periodTxt})`, `Plan period and scope (${periodTxt})`), L('أساس الفواتير: تغيير افتراضي لما يُحصَّل على فواتير الفترة — ليس تنبؤاً ولا مقبوضات', 'Invoice basis: a hypothetical change in what is collected on the period\'s invoices — not a forecast and not receipts'), scenarioOn ? L('قيم المحرر الحالية', 'current editor values') : L('المحرر عند الافتراضي (لا أثر)', 'the editor is at its defaults (no effect)')],
    [L('تغطية الإنفاق التشغيلي (أبواب 1–3)', 'Operating-expenditure coverage (chapters 1–3)'), cov?.ratio != null ? `${(cov.ratio * 100).toFixed(1)}%` : L('غير متاحة', 'n/a'), tag('synthetic'), L('وطني؛ من بداية السنة', 'National; since the start of the year'), L('مقبوض ÷ مصروف نقدي، ببيانات إنفاق اصطناعية. التعريف الرسمي للتغطية (على أساس المخصص المتناسب أو الصرف النقدي) لم يُعتمد بعد ولم يُفترض هنا', 'Cash received ÷ cash paid, on synthetic expenditure data. The official coverage definition (prorated-appropriation or cash-payment basis) is NOT approved and is not assumed here'), L(`حتى ${D(today)}`, `to ${D(today)}`)]
  ];

  const A = rec?.receiptsWindow; const B = rec?.onPeriodInvoices; const C = T.collected;
  const other = A != null && B != null ? A - B : null; const measure = B != null ? B - C : null;
  const closeEnough = measure != null && Math.abs(measure) < 0.5; // any non-zero difference is shown, never absorbed

  return (
    <details className="rv-more st-card card" id="bases" open style={{ minWidth: 0, overflow: "hidden", gridTemplateColumns: "minmax(0, 1fr)" }}>
      <summary><b>{L('ما الذي يقيسه كل رقم؟ وكيف تتسق أرقام هذه الصفحة؟', 'What does each figure measure, and how do the figures on this page fit together?')}</b></summary>
      <p className="muted" style={{ fontSize: 13, margin: '6px 0' }}>{L('رقمان يبدوان متشابهين يقيسان شيئين مختلفين: «المحصّل» يتتبع فواتير فترة الخطة، و«المقبوضات» تتتبع تواريخ الدفع. لا يُجمع تنبؤ أو سيناريو إلى رقم فعلي في هذا الجدول.', 'Two figures that look alike measure different things: «collected» follows the plan period\'s invoices, «receipts» follow payment dates. No forecast or scenario is added to an actual in this table.')}</p>
      <div className="st-table-wrap" tabIndex={0}>
        <table className="table" aria-label={L('أساس كل رقم في صفحة التخطيط', 'The basis of each figure on the Planning page')}>
          <thead><tr><th scope="col">{L('الرقم', 'Figure')}</th><th scope="col">{L('القيمة', 'Value')}</th><th scope="col">{L('النوع', 'Kind')}</th><th scope="col">{L('الفترة والنطاق', 'Period and scope')}</th><th scope="col">{L('أساس القياس', 'Basis')}</th><th scope="col">{L('قطع البيانات', 'Cut-off')}</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><th scope="row">{r[0]}</th><td dir="ltr">{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td>{r[5]}</td></tr>)}</tbody>
        </table>
      </div>

      <h2 style={{ margin: '10px 0 4px', fontSize: 15 }}>{L('تسوية «المقبوضات» مع «المحصّل»', 'Reconciling “receipts” with “collected”')} {tag('actual')}</h2>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 6px' }}>{L('«المحصّل» هو ما دُفع على الفاتورة ضمن حدّ صافي الفاتورة (لا يتجاوز الصافي). «المقبوض» هو إجمالي النقد المستلم بتاريخ الدفع، ويشمل أي دفعة زائدة عن صافي الفاتورة وما دُفع على فواتير خارج الفترة. لذلك قد يزيد المقبوض عن المحصّل حتى على فواتير الفترة نفسها.', '«Collected» is what was paid on an invoice up to the invoice net (never above it). «Received» is the total cash received by payment date, including any payment above an invoice\'s net and everything paid on invoices outside the period. Received can therefore exceed collected even on the period\'s own invoices.')}</p>
      {!rec ? <div className="rv-callout">{L('جارٍ احتساب التسوية…', 'Computing the reconciliation…')}</div> : !rec.available ? (
        <div className="rv-callout" role="note">{L(`فترة الخطة (${periodTxt}) ليست ضمن نافذة السنة المالية (${fy}-01-01 → ${fy}-12-31)، فلا تُحسب تسوية رقمية؛ الرقمان يبقيان منفصلين ومعنونين بأساسيهما.`, `The plan period (${periodTxt}) is not inside the fiscal-year window (${fy}-01-01 → ${fy}-12-31), so no numeric reconciliation is computed; the two figures stay separate, each labelled with its basis.`)}</div>
      ) : (
        <div className="st-table-wrap" tabIndex={0}>
          <table className="table bridge" style={{ minWidth: 0 }} aria-label={L('جسر من المحصّل إلى المقبوضات', 'Bridge from collected to receipts')}>
            <caption className="sr-only">{L('جسر المحصّل إلى المقبوضات', 'Bridge from collected to receipts')}</caption>
            <tbody>
              <tr><th scope="row">{L(`المحصّل على فواتير فترة الخطة (خط الأساس، حتى ${D(through)})`, `Collected on the plan period's invoices (baseline, to ${D(through)})`)}</th><td dir="ltr">{m(C)}</td></tr>
              {!closeEnough && <tr><th scope="row">{L('فرق قياس: دفعات تزيد عن صافي الفاتورة (يُحدّ «المحصّل» بصافي الفاتورة ولا يُحدّ «المقبوض»)', 'Measurement difference: payments above an invoice\'s net (“collected” is capped at the invoice net, “received” is not)')}</th><td dir="ltr">{measure >= 0 ? '+' : ''}{m(measure)}</td></tr>}
              <tr><th scope="row">{L('= المقبوض (بتاريخ الدفع) على فواتير صدرت في فترة الخطة', '= Received (by payment date) on invoices issued in the plan period')}</th><td dir="ltr">{m(B)}</td></tr>
              <tr><th scope="row">{L('+ المقبوض على فواتير صدرت خارج فترة الخطة (فواتير أقدم عادةً)', '+ Received on invoices issued outside the plan period (usually older invoices)')}</th><td dir="ltr">{m(other)}</td></tr>
              <tr style={{ fontWeight: 700 }}><th scope="row">{L(`= المقبوضات بتاريخ الدفع منذ ${D(`${fy}-01-01`)} حتى ${D(through)}`, `= Receipts by payment date from ${D(`${fy}-01-01`)} to ${D(through)}`)}</th><td dir="ltr">{m(A)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {rec?.available && through !== today && <div className="muted" style={{ fontSize: 12 }}>{L(`الجسر محسوب حتى نهاية فترة الخطة (${D(through)})، وبطاقة «المقبوضات منذ بداية السنة» أعلاه حتى ${D(today)}؛ لذلك قد يختلف رقمهما.`, `The bridge stops at the plan period end (${D(through)}) while the «receipts since the start of the year» card runs to ${D(today)}; their figures can differ for that reason.`)}</div>}
      {rec?.available && !periodEqFy && <div className="muted" style={{ fontSize: 12 }}>{L('فترة الخطة أقصر من نافذة السنة، فالمقبوض على فواتير خارج الفترة يشمل فواتير الأشهر السابقة واللاحقة ضمن النافذة.', 'The plan period is shorter than the year window, so «received on invoices outside the period» includes invoices of the months before and after it inside the window.')}</div>}

      <h2 style={{ margin: '10px 0 4px', fontSize: 15 }}>{L('ما لا يُجمع', 'What is deliberately not added together')}</h2>
      <ul className="res__list res__list--plain" style={{ fontSize: 13 }}>
        <li>{L('التنبؤ (تاريخ الدفع، مستقبلي) لا يُضاف إلى المحصّل (الفواتير، فعلي).', 'The forecast (payment date, future) is not added to collected (invoices, actual).')}</li>
        <li>{L('أثر السيناريو (أساس الفواتير، افتراضي) ليس مقبوضات.', 'The scenario effect (invoice basis, hypothetical) is not receipts.')}{funding.available && <> {L('جدول «توقع التمويل» في قسم التوقعات يعرض أثر السيناريو منفصلاً ولا يُنتج ميزاناً تمويلياً للسيناريو، لأن تحويل «المحصّل» إلى «مقبوضات» غير مُعرَّف بعد.', 'The «funding outlook» table in the forecasts section shows the scenario\'s effects separately and produces no scenario funding balance, because the conversion from «collected» to «receipts» is not defined yet.')}</>}</li>
        <li>{L('المستهدف (تجريبي، غير معتمد) مرجع للمقارنة وليس رقماً فعلياً.', 'The target (demo, not approved) is a reference for comparison, not an actual.')}</li>
        <li>{coverageApproved ? '' : L('تغطية الإنفاق مبنية على بيانات اصطناعية وتعريفها الرسمي معلّق؛ لا تُسوّى مع الأرقام أعلاه.', 'Expenditure coverage rests on synthetic data and its official definition is pending; it is not reconciled with the figures above.')}</li>
      </ul>
    </details>
  );
}
