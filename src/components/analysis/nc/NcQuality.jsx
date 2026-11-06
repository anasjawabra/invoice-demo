// Tab 4 · جودة البيانات والمنهجية — what is missing or in conflict, what is outside the totals, every reconciliation check with both sides, and the definitions / formulas / sources / rules.
import React from 'react';
import { useL } from '../../../utils/bi';
import { useNc } from './NcBits';
import { lab, isCountCheck, processDrill, titleOf, iso } from './ncModel';

const HINT_EN = { 'رقم فاتورة غير موجود في تقرير التفاصيل': 'Invoice number not found in the details report' }; // the data service writes the reason in Arabic
const DEFS = [
  [['Gross unpaid', 'إجمالي غير المسدد'], ['The unpaid remainder (billed − received) of the period’s invoices that are not cancelled, excluded ones included.', 'المتبقي غير المسدد (المفوتر − المستلم) من فواتير الفترة غير الملغاة، شاملاً المستبعد.']],
  [['Excluded unpaid', 'المستبعد غير المسدد'], ['The part of the unpaid remainder that an approved exclusion rule covers. A part-payment stays collected.', 'الجزء من المتبقي غير المسدد الذي تشمله قاعدة استبعاد معتمدة. والسداد الجزئي يبقى محصّلاً.']],
  [['Net unpaid', 'صافي غير المسدد'], ['Gross unpaid − excluded unpaid. It is “uncollected” in the financial snapshot of the same scope. No recoverability is assessed.', 'إجمالي غير المسدد − المستبعد غير المسدد، وهو «غير المحصّل» في اللقطة المالية للنطاق نفسه. ولا يُقيَّم ما يمكن استرداده.']],
  [['Overdue / not yet due / due date unavailable', 'متأخر / لم يحن استحقاقه / تاريخ الاستحقاق غير متاح'], ['Position against the reference date, after the grace days. An invoice with no due date is counted apart and is never called overdue.', 'الموقف من تاريخ المرجع بعد أيام السماح. والفاتورة بلا تاريخ استحقاق تُعدّ منفصلة ولا تُسمّى متأخرة.']],
  [['Non-collection reason: documented', 'سبب عدم التحصيل: موثَّق'], ['Only where the source records a cause (an objection by the payer, with its recorded status). Everything else is “Non-collection reason not documented”. Lateness, part-payment, enforcement and missing data are states, not reasons.', 'فقط حين يسجّل المصدر سبباً (اعتراض الدافع وحالته المسجَّلة). وما عداه «سبب عدم التحصيل غير موثق». والتأخر والسداد الجزئي والإنفاذ ونقص البيانات حالات وليست أسباباً.']],
  [['Standing balance', 'الرصيد القائم'], ['Every invoice issued up to the reference date that is still unpaid. A different population from the period’s invoices; it has its own bridge and is never added to them.', 'كل فاتورة صدرت حتى تاريخ المرجع وما زالت غير مسددة. مجتمع مختلف عن فواتير الفترة وله جسره الخاص ولا يُجمع معها.']],
  [['Report-only records', 'سجلات التقرير فقط'], ['Records of the unpaid report with no match in the invoice-details report. Listed apart; in no total.', 'سجلات في تقرير غير المسدد بلا مقابل في بيان التفاصيل. تُعرض منفصلة وليست في أي إجمالي.']]
];
const FORMULAS = [
  ['Gross unpaid = excluded unpaid + net unpaid', 'إجمالي غير المسدد = المستبعد غير المسدد + صافي غير المسدد'],
  ['Net unpaid = overdue + not yet due + due date unavailable', 'صافي غير المسدد = متأخر + لم يحن استحقاقه + تاريخ الاستحقاق غير متاح'],
  ['Net unpaid = fully unpaid + partly paid (remainder)', 'صافي غير المسدد = غير مسدد كلياً + مسدد جزئياً (المتبقي)'],
  ['Net unpaid = documented reason + not documented', 'صافي غير المسدد = موثق السبب + غير موثق'],
  ['Net unpaid = Σ action groups = Σ aging buckets = Σ Amanahs = Σ revenue sources', 'صافي غير المسدد = مجموع مجموعات الإجراء = مجموع فئات التقادم = مجموع الأمانات = مجموع مصادر الإيراد']
];
const SOURCES = [
  ['Tahseel — billed and received amounts, payment status', 'تحصيل — مبالغ الفواتير والمستلم وحالة السداد'],
  ['Approved exclusion rules — the excluded part', 'قواعد الاستبعاد المعتمدة — الجزء المستبعد'],
  ['Mumtathil — objections and their status (the only documented reason)', 'ممتثل — الاعتراضات وحالتها (السبب الوحيد الموثَّق)'],
  ['Enforcement links confirmed by a reviewer — the enforcement process', 'روابط الإنفاذ المؤكَّدة من مراجع — مسار الإنفاذ'],
  ['Furas contract register — contract status of investment invoices', 'سجل عقود فرص — حالة عقد فواتير الاستثمار'],
  ['The data is synthetic demonstration data, not the Ministry’s actual figures.', 'البيانات تجريبية مُصطنعة وليست أرقام الوزارة الفعلية.']
];

export default function NcQuality() {
  const { a, ar, f, openDrill, version } = useNc(); const { L, sar } = useL();
  const U = a.unmatched; const failed = a.reconciliation.filter((c) => !c.ok);
  const val = (c, v) => (isCountCheck(c) ? f.count(v) : sar(v));
  return (
    <div className="nc-stack">
      <section className="nc-card" aria-labelledby="nc-dq-h">
        <h2 id="nc-dq-h" className="nc-h">{L('Missing, conflicting and unresolved data', 'بيانات ناقصة ومتعارضة وغير محسومة')}</h2>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table nc-table" aria-label={L('Data-quality flags', 'ملاحظات جودة البيانات')}>
            <thead><tr><th>{L('Issue', 'الملاحظة')}</th><th className="num">{L('Unpaid invoices', 'فواتير غير مسددة')}</th><th className="num">{L('Amount (SAR)', 'المبلغ (ريال)')}</th><th>{L('Included in the totals?', 'ضمن الإجماليات؟')}</th><th><span className="sr-only">{L('Invoices', 'الفواتير')}</span></th></tr></thead>
            <tbody>
              {a.quality.map((x) => (
                <tr key={x.key}>
                  <th scope="row" className="nc-rowh">{lab(x, ar)}</th><td className="num" dir="ltr">{f.count(x.count)}</td><td className="num" dir="ltr">{f.full(x.amount)}</td>
                  <td>{x.key === 'due_unavailable' ? L('Yes — in its own “due date unavailable” part', 'نعم — في جزئه المستقل «تاريخ الاستحقاق غير متاح»') : x.key === 'amount_conflict' ? L('Yes — at the invoice header amount, flagged', 'نعم — بمبلغ رأس الفاتورة مع الوسم') : L('Yes — flagged, amount unchanged', 'نعم — موسومة دون تغيير المبلغ')}</td>
                  <td>{x.count > 0 ? <button type="button" className="nc-linkbtn" onClick={() => openDrill(processDrill(x))}>{L('Show invoices', 'عرض الفواتير')}</button> : <span className="muted">—</span>}</td>
                </tr>
              ))}
              <tr className="nc-row--out">
                <th scope="row" className="nc-rowh">{L('Report-only records (no match)', 'سجلات التقرير فقط (بلا مطابقة)')}</th><td className="num" dir="ltr">{f.count(U.count)}</td><td className="num" dir="ltr">{f.full(U.amount)}</td>
                <td>{L('No — outside every total', 'لا — خارج كل الإجماليات')}</td><td><span className="muted">—</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="nc-fine">{L('The flags overlap (one invoice can carry several), so the rows are not added.', 'الملاحظات متداخلة (قد تحمل الفاتورة أكثر من واحدة) فلا تُجمع الصفوف.')}</p>
      </section>

      <section className="nc-card" aria-labelledby="nc-um-h">
        <h2 id="nc-um-h" className="nc-h">{L('Unmatched records', 'السجلات غير المطابقة')}</h2>
        {U.scopedOut ? <p>{L('Report-only records carry no Amanah, so they are not attributed to this narrower scope; they appear in the national view.', 'سجلات التقرير غير المطابقة لا تحمل أمانة فلا تُنسب لهذا النطاق الأضيق؛ وتظهر في العرض الوطني.')}</p> : U.count === 0 ? <p>{L('Every report record matched an invoice.', 'كل سجلات التقرير طابقت فاتورة.')}</p> : <>
          <div className="rv-table-wrap" tabIndex={0}>
            <table className="rv-table nc-table" aria-label={L('Where the unmatched records are counted', 'أين تُحتسب السجلات غير المطابقة')}>
              <thead><tr><th>{L('Total', 'الإجمالي')}</th><th>{L('Includes the unmatched records?', 'يشمل السجلات غير المطابقة؟')}</th></tr></thead>
              <tbody>
                <tr><th scope="row" className="nc-rowh">{L('Gross unpaid', 'إجمالي غير المسدد')}</th><td><span className="nc-inc nc-inc--no">{L('No', 'لا')}</span></td></tr>
                <tr><th scope="row" className="nc-rowh">{L('Net unpaid and every breakdown of it', 'صافي غير المسدد وكل تفصيلاته')}</th><td><span className="nc-inc nc-inc--no">{L('No', 'لا')}</span></td></tr>
                <tr><th scope="row" className="nc-rowh">{L('Standing balance', 'الرصيد القائم')}</th><td><span className="nc-inc nc-inc--no">{L('No — neither deducted nor added', 'لا — لا تُخصم ولا تُضاف')}</span></td></tr>
              </tbody>
            </table>
          </div>
          {U.rows?.length > 0 ? (
            <div className="rv-table-wrap" tabIndex={0}>
              <table className="rv-table nc-table" aria-label={L('Unmatched records', 'السجلات غير المطابقة')}>
                <thead><tr><th>{L('Invoice number in the report', 'رقم الفاتورة في التقرير')}</th><th className="num">{L('Value (SAR)', 'القيمة (ريال)')}</th><th className="num">{L('Lines', 'البنود')}</th><th>{L('Why it is apart', 'سبب الفصل')}</th></tr></thead>
                <tbody>{U.rows.map((r, i) => <tr key={i}><td dir="ltr">{r.invoiceNo}</td><td className="num" dir="ltr">{f.full(r.invoiceValue)}</td><td className="num" dir="ltr">{r.lines}</td><td dir="auto">{ar ? r.hint : (HINT_EN[r.hint] || r.hint)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="nc-fine">{U.rowsPruned ? L(`The ${f.count(U.rowsPruned)} record rows of this older version were dropped to save space; the count and amount above are kept.`, `حُذفت صفوف ${f.count(U.rowsPruned)} سجلاً من هذا الإصدار الأقدم لتوفير المساحة؛ ويبقى العدد والمبلغ أعلاه.`) : null}</p>}
        </>}
      </section>

      <section className="nc-card" aria-labelledby="nc-rc-h">
        <h2 id="nc-rc-h" className="nc-h">{L('Reconciliation checks', 'فحوص المطابقة')} <span className={`nc-badge ${failed.length ? 'nc-badge--bad' : 'nc-badge--ok'}`}>{failed.length ? L(`${failed.length} failed`, `فشل ${failed.length}`) : L(`all ${f.count(a.reconciliation.length)} hold`, `تحققت كلها (${f.count(a.reconciliation.length)})`)}</span></h2>
        <div className="rv-table-wrap" tabIndex={0}>
          <table className="rv-table nc-table" aria-label={L('Reconciliation checks', 'فحوص المطابقة')}>
            <thead><tr><th>{L('Check', 'الفحص')}</th><th className="num">{L('Left side', 'الطرف الأيسر')}</th><th className="num">{L('Right side', 'الطرف الأيمن')}</th><th>{L('Result', 'النتيجة')}</th></tr></thead>
            <tbody>
              {a.reconciliation.map((c) => (
                <tr key={c.key}><td dir="auto">{ar ? c.labelAr : c.labelEn}</td><td className="num" dir="ltr">{val(c, c.lhs)}</td><td className="num" dir="ltr">{val(c, c.rhs)}</td><td><span className={`nc-res ${c.ok ? 'nc-res--ok' : 'nc-res--bad'}`}>{c.ok ? <>✓ {L('Holds', 'متحقق')}</> : <>✕ {L('Fails', 'غير متحقق')}</>}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="nc-card nc-method" aria-labelledby="nc-mt-h">
        <h2 id="nc-mt-h" className="nc-h">{L('Methodology', 'المنهجية')}</h2>
        <details><summary>{L('Definitions', 'التعريفات')}</summary>
          <dl className="nc-defs">{DEFS.map(([n, d], i) => <div key={i}><dt>{ar ? n[1] : n[0]}</dt><dd>{ar ? d[1] : d[0]}</dd></div>)}</dl></details>
        <details><summary>{L('Formulas', 'المعادلات')}</summary>
          <ul className="nc-list">{FORMULAS.map((x, i) => <li key={i} dir="auto">{ar ? x[1] : x[0]}</li>)}</ul></details>
        <details><summary>{L('Sources', 'المصادر')}</summary>
          <ul className="nc-list">{SOURCES.map((x, i) => <li key={i} dir="auto">{ar ? x[1] : x[0]}</li>)}</ul></details>
        <details><summary>{L('Classification rules — which group an unpaid invoice falls in', 'قواعد التصنيف — في أي مجموعة تقع الفاتورة غير المسددة')}</summary>
          <p className="nc-fine">{L('An invoice is placed in the first group, in this order, whose condition it meets; the other conditions it meets stay as secondary tags.', 'تُوضع الفاتورة في أول مجموعة بهذا الترتيب تتحقق شروطها؛ وتبقى الشروط الأخرى المنطبقة وسوماً ثانوية.')}</p>
          <ol className="nc-list">{a.groups.slice().sort((x, y) => x.precedence - y.precedence).map((g) => <li key={g.key} dir="auto"><b>{titleOf(g, ar)}</b> — {ar ? g.rationaleAr : g.rationaleEn}</li>)}</ol></details>
        <details open><summary>{L('Limitations', 'القيود')}</summary>
          <ul className="nc-list">{(a.notes || []).map((n, i) => <li key={i} dir="auto">{ar ? n.ar : n.en}</li>)}</ul></details>
      </section>
      <p className="nc-fine">{L(`Version ${version.n}: the figures are those saved when it was generated (${version.cutoff}).`, `الإصدار ${version.n}: الأرقام هي المحفوظة عند إنشائه (${iso(version.cutoff)}).`)}</p>
    </div>
  );
}
