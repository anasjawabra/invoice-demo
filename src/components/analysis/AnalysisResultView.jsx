import React from 'react';
import { RecordLink as Link } from '../../utils/returnContext';
import { invoicePath, contractPath, orderPath } from '../../utils/paths';
import { useL } from '../../utils/bi';
import { describeScope } from '../../data/revenueInsights';

const KIND = {
  fact: { en: 'Source fact', ar: 'حقيقة من المصدر', cls: 'rtag--fact' },
  calculated: { en: 'Calculated', ar: 'نتيجة محسوبة', cls: 'rtag--calc' },
  hypothesis: { en: 'Hypothesis — verify', ar: 'فرضية — تحتاج تحققاً', cls: 'rtag--hyp' },
  recommendation: { en: 'Recommendation', ar: 'توصية', cls: 'rtag--rec' }
};

export function KindTag({ kind }) {
  const { B } = useL();
  const k = KIND[kind] || KIND.calculated;
  return <span className={`rtag ${k.cls}`}>{B(k)}</span>;
}

function Section({ title, count, children, tone }) {
  return (
    <section className={`res__sec${tone ? ` res__sec--${tone}` : ''}`}>
      <h4>{title}{count != null ? <span className="res__count">{count}</span> : null}</h4>
      {children}
    </section>
  );
}

function InvoiceChips({ ids }) {
  if (!ids || !ids.length) return null;
  return (
    <span className="res__chips">
      {ids.slice(0, 6).map((id) => <Link key={id} className="res__chip" to={invoicePath(id)} dir="ltr">{id}</Link>)}
      {ids.length > 6 && <span className="res__chip res__chip--more">+{ids.length - 6}</span>}
    </span>
  );
}

function impactText(impact, B, L) {
  if (!impact) return null;
  if (impact.kind === 'upper_bound') return `${L('Upper bound', 'حد أعلى')}: +${impact.pp} pp — ${B(impact.method)}`;
  if (impact.kind === 'calculated_if_approved') return impact.pp == null ? null : `${impact.pp >= 0 ? '+' : ''}${impact.pp} pp — ${B(impact.method)}`;
  if (impact.kind === 'not_calculable') return `${L('Not calculable', 'غير قابل للاحتساب')}${impact.reason ? ` — ${B(impact.reason)}` : ''}`;
  return null;
}

export default function AnalysisResultView({ result, task, stale, compact = false }) {
  const { L, B, lang } = useL();
  if (!result) return null;
  return (
    <div className={`res${compact ? ' res--compact' : ''}`}>
      <div className="res__head">
        <div className="res__scope" dir="auto">{describeScope(result.scope, lang)}</div>
        <div className="res__meta">
          <span className="rtag rtag--meta">{L('Data cutoff', 'قطع البيانات')}: {result.cutoff}</span>
          <span className="rtag rtag--demo">{B(result.provenance)}</span>
          {task && task.status === 'completed_with_limitations' && <span className="rtag rtag--warn">{L('Completed with data limitations', 'اكتمل مع قيود في البيانات')}</span>}
        </div>
      </div>
      {stale && <div className="ap__stale">{L('Filters or data changed after this analysis ran — re-run it before relying on it.', 'تغيّرت المرشحات أو البيانات بعد تشغيل هذا التحليل — أعد تشغيله قبل الاعتماد عليه.')}</div>}

      <Section title={L('Executive summary', 'الملخص التنفيذي')}>
        <p className="res__summary" dir="auto">{B(result.executiveSummary)}</p>
      </Section>

      {result.indicators?.length > 0 && (
        <Section title={L('Calculated indicators', 'المؤشرات المحسوبة')} count={result.indicators.length}>
          <div className="res__ind">
            {result.indicators.map((ind, i) => (
              <div key={i} className="res__indcard">
                <span className="res__indlabel">{B(ind.label)}</span>
                <b dir="ltr">{ind.value}</b>
                <KindTag kind={ind.kind} />
                {ind.note && <small>{B(ind.note)}</small>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {result.confirmed?.length > 0 && (
        <Section title={L('Confirmed findings (from records)', 'النتائج المؤكدة (من السجلات)')} count={result.confirmed.length}>
          <ul className="res__list">
            {result.confirmed.map((c, i) => <li key={i}><KindTag kind={c.kind} /> <span dir="auto">{B(c.text)}</span> <InvoiceChips ids={c.invoices} /></li>)}
          </ul>
        </Section>
      )}

      {result.hypotheses?.length > 0 && (
        <Section title={L('Hypotheses requiring verification', 'فرضيات تحتاج إلى تحقق')} count={result.hypotheses.length} tone="hyp">
          <ul className="res__list">
            {result.hypotheses.map((c, i) => <li key={i}><KindTag kind="hypothesis" /> <span dir="auto">{B(c.text)}</span> <InvoiceChips ids={c.invoices} /></li>)}
          </ul>
        </Section>
      )}

      {result.missing?.length > 0 && (
        <Section title={L('Missing data and conflicts', 'بيانات ناقصة وتعارضات')} count={result.missing.length} tone="warn">
          <ul className="res__list">
            {result.missing.map((c, i) => <li key={i}><KindTag kind="fact" /> <span dir="auto">{B(c.text)}</span> <InvoiceChips ids={c.invoices} /></li>)}
          </ul>
        </Section>
      )}

      {result.recommendations?.length > 0 && (
        <Section title={L('Recommended interventions', 'التدخلات الموصى بها')} count={result.recommendations.length}>
          <ul className="res__list">
            {result.recommendations.map((c, i) => (
              <li key={i}>
                <KindTag kind="recommendation" /> <span dir="auto">{B(c.text)}</span>
                {c.impact && <div className="res__impact" dir="auto">{impactText(c.impact, B, L)}</div>}
              </li>
            ))}
          </ul>
          <p className="res__note">{L('Recommendations are proposals for human decision, not approved actions. This platform does not execute payments, issue or cancel invoices, take legal action, or change source-system records.', 'التوصيات مقترحات لقرار بشري وليست إجراءات معتمدة. لا تنفذ هذه المنصة مدفوعات ولا تصدر الفواتير أو تلغيها ولا تتخذ إجراءات قانونية ولا تعدّل سجلات الأنظمة المصدرية.')}</p>
        </Section>
      )}

      {result.references?.length > 0 && (
        <Section title={L('Supporting records', 'السجلات الداعمة')} count={result.references.length}>
          <InvoiceChips ids={result.references.map((r) => r.invoiceId)} />
        </Section>
      )}

      <Section title={L('Assumptions and limitations', 'الافتراضات والقيود')}>
        <ul className="res__list res__list--plain">
          {[...(result.assumptions || []), ...(result.limitations || [])].map((a, i) => <li key={i} dir="auto">{B(a)}</li>)}
        </ul>
      </Section>

      {result.links?.length > 0 && (
        <div className="res__links">{result.links.map((l, i) => <Link key={i} className="ap__btn" to={l.to}>{B(l.label)}</Link>)}</div>
      )}
    </div>
  );
}
