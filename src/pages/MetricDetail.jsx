import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useL } from '../utils/bi';
import { entryById, SCHEMA_STATES, SOURCE_ROLE, CATEGORIES } from '../data/dictionaryDirectory';
import { exclusionDocs } from '../data/dictionaryDocs';
import { SchemaBadge } from './Metrics';

const KIND = { flow: { ar: 'تدفق لفترة', en: 'Period flow' }, stock: { ar: 'رصيد قائم', en: 'Standing balance' }, ratio: { ar: 'نسبة', en: 'Ratio' }, plan: { ar: 'تخطيط', en: 'Plan' } };
const STATUS = { 'Business-confirmed': { ar: 'مؤكد من الأعمال', en: 'Business-confirmed' }, Conflict: { ar: 'تعارض في الوثائق', en: 'Conflicting evidence' }, Proposal: { ar: 'مقترح', en: 'Proposal' }, 'Draft requirement': { ar: 'متطلب مسودة', en: 'Draft requirement' }, 'Missing evidence': { ar: 'دليل ناقص', en: 'Missing evidence' }, 'Demo behavior': { ar: 'سلوك العرض', en: 'Demo behaviour' } };

// One metric or term: definition and interpretation, formula with its inputs, steps, aggregation, date basis, special cases, source systems and roles, where it is used, and — only when a schema exists — the mapping table.
export default function MetricDetail() {
  const { id } = useParams(); const e = entryById(id);
  const { L, B, ar } = useL();
  if (!e) return <Navigate to="/settings/metrics" replace />;
  const sc = e.schema; const sec = (key, title, body) => <section className="gl-sec" aria-labelledby={`gl-d-${key}`}><h2 className="gl-sec__h" id={`gl-d-${key}`}>{title}</h2>{body}</section>;
  const rules = e.rules ? exclusionDocs() : [];
  const cat = e.category && CATEGORIES[e.category] ? e.category : null; const back = cat ? `/settings/metrics?category=${cat}` : '/settings/metrics'; // a planning definition goes back to its category page
  return (
    <div className="rv-page gl-detail">
      <nav className="rp-crumbs" aria-label={L('Breadcrumb', 'مسار التنقل')}><ol>
        <li><Link to="/settings/metrics">{L('Metrics and Glossary Dictionary', 'قاموس المقاييس والمصطلحات')}</Link></li>
        {cat && <li><Link to={back}>{B(CATEGORIES[cat])}</Link></li>}
        <li><span aria-current="page">{B(e.name)}</span></li>
      </ol></nav>
      <Link className="gl-back" to={back}><span aria-hidden="true">{ar ? '→' : '←'}</span> {cat ? L(`Back to ${CATEGORIES[cat].en}`, `العودة إلى ${CATEGORIES[cat].ar}`) : L('Back to the dictionary', 'العودة إلى القاموس')}</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">{B(e.name)}</h1>
          <div className="gl-meta"><span className="gl-card__type">{e.type === 'metric' ? `${L('Metric', 'مقياس')} · ${B(KIND[e.kind])}` : L('Term', 'مصطلح')}</span><SchemaBadge state={sc.state} /></div>
        </div>
      </div>

      {sec('def', L('Definition and interpretation', 'التعريف والتفسير'), <>
        <p dir="auto">{B(e.definition)}</p>
        {e.caveat && <div className="rv-callout" dir="auto"><b>{L('Caution', 'تنبيه')}:</b> {B(e.caveat)}</div>}
      </>)}

      {e.formula && sec('formula', L('Formula', 'المعادلة'), <>
        <p className="gl-formula" dir="auto">{B(e.formula)}</p>
        {e.symbolic && <p className="gl-formula gl-formula--sym" dir="ltr"><code>{e.symbolic}</code></p>}
        {e.inputs?.length > 0 && <div className="rv-table-wrap" tabIndex={0}><table className="rv-table"><caption className="sr-only">{L('Inputs of the formula', 'مدخلات المعادلة')}</caption>
          <thead><tr><th scope="col">{L('Input', 'المُدخل')}</th><th scope="col">{L('Meaning', 'المعنى')}</th></tr></thead>
          <tbody>{e.inputs.map(([a, b], i) => <tr key={i}><th scope="row">{B(a)}</th><td dir="auto">{B(b)}</td></tr>)}</tbody></table></div>}
      </>)}

      {e.steps?.length > 0 && sec('steps', L('Calculation steps and aggregation', 'خطوات الحساب ومستوى التجميع'), <>
        <ol className="gl-steps">{e.steps.map((s, i) => <li key={i} dir="auto">{B(s)}</li>)}</ol>
        <dl className="gl-dl"><dt>{L('Aggregation level', 'مستوى التجميع')}</dt><dd dir="auto">{B(e.aggregation)}</dd>
          {e.period && <><dt>{L('Period', 'الفترة')}</dt><dd dir="auto">{B(e.period)}</dd></>}
          {e.dateBasis && <><dt>{L('Date basis', 'أساس التاريخ')}</dt><dd dir="auto">{B(e.dateBasis)}</dd></>}
          {e.unit && <><dt>{L('Unit', 'الوحدة')}</dt><dd dir="auto">{B(e.unit)}</dd></>}
          {e.filters && <><dt>{L('Applicable filters', 'التصفيات المنطبقة')}</dt><dd dir="auto">{B(e.filters)}</dd></>}
          {e.sourceFields && <><dt>{L('Source fields', 'حقول المصدر')}</dt><dd dir="auto">{B(e.sourceFields)}</dd></>}
          {e.missing && <><dt>{L('Missing and zero values', 'القيم المفقودة والصفرية')}</dt><dd dir="auto">{B(e.missing)}</dd></>}
          {e.where && <><dt>{L('Implemented in (provenance)', 'موضع التنفيذ (المرجع)')}</dt><dd dir="ltr"><code>{e.where}</code></dd></>}
          {e.owner && <><dt>{L('Owner function', 'الجهة المالكة للتعريف')}</dt><dd dir="auto">{B(e.owner)}</dd></>}</dl>
      </>)}

      {e.notes?.length > 0 && sec('notes', L('Inclusions, exclusions and special cases', 'ما يدخل وما لا يدخل والحالات الخاصة'), <ul className="gl-list">{e.notes.map((n, i) => <li key={i} dir="auto">{B(n)}</li>)}</ul>)}

      {e.assumptions?.length > 0 && sec('assumptions', L('Assumptions and limitations', 'الافتراضات والقيود'), <ul className="gl-list">{e.assumptions.map((n, i) => <li key={i} dir="auto">{B(n)}</li>)}</ul>)}

      {rules.length > 0 && sec('rules', L('Exclusion reasons', 'أسباب الاستبعاد'), <ul className="gl-list">{rules.map((r) => <li key={r.ruleId} dir="auto"><b>{ar ? r.ar : r.en}</b> — {B(r.what)}</li>)}</ul>)}

      {e.sources.length > 0 && sec('sources', L('Source systems and their role', 'المصادر ودور كل منها'), <div className="rv-table-wrap" tabIndex={0}><table className="rv-table"><caption className="sr-only">{L('Source systems', 'المصادر')}</caption>
        <thead><tr><th scope="col">{L('Source system', 'المصدر')}</th><th scope="col">{L('Role', 'الدور')}</th></tr></thead>
        <tbody>{e.sources.map((s, i) => <tr key={s}><th scope="row">{B(e.sourceLabels[i])}</th><td dir="auto">{SOURCE_ROLE[s] ? B(SOURCE_ROLE[s]) : '—'}</td></tr>)}</tbody></table></div>)}

      {e.used?.length > 0 && sec('used', L('Where it is used in the application', 'أين يُستخدم في التطبيق'), <ul className="gl-list gl-list--links">{e.used.map((u) => <li key={u.to}><Link to={u.to}>{B(u.label)}</Link></li>)}</ul>)}

      {sec('schema', L('Schema and mapping', 'المخطط والربط'), <>
        <p className="gl-schema-note"><SchemaBadge state={sc.state} /> <span>{B(SCHEMA_STATES[sc.state].full)}</span></p>
        {sc.state === 'none' && e.schemaNote && <p dir="auto">{B(e.schemaNote)}</p>}
        {sc.state === 'none' && !e.schemaNote && <p className="muted" dir="auto">{L('The definition and formula above remain valid; no source columns are documented for this entry yet.', 'يبقى التعريف والمعادلة أعلاه ساريين؛ ولا توجد أعمدة مصدر موثّقة لهذا البند بعد.')}</p>}
        {sc.state === 'available' && <p className="muted" dir="auto">{L('The columns below are those the project specification records for this entry. No mapping to them is confirmed yet, so treat them as candidates, not as the final mapping.', 'الأعمدة أدناه هي ما توثّقه مواصفات المشروع لهذا البند. لم يُؤكَّد الربط بها بعد، فهي مرشّحة وليست الربط النهائي.')}</p>}
        {sc.rows.length > 0 && <div className="rv-table-wrap" tabIndex={0}><table className="rv-table gl-map"><caption className="sr-only">{L('Schema mapping', 'ربط المخطط')}</caption>
          <thead><tr><th scope="col">{L('Source system', 'المصدر')}</th><th scope="col">{L('Schema and table', 'المخطط والجدول')}</th><th scope="col">{L('Column', 'العمود')}</th><th scope="col">{L('Business meaning', 'المعنى')}</th><th scope="col">{L('Transformation / calculation', 'التحويل أو الحساب')}</th><th scope="col">{L('Join keys and relationships', 'مفاتيح الربط والعلاقات')}</th><th scope="col">{L('Mapping status', 'حالة الربط')}</th></tr></thead>
          <tbody>{sc.rows.map((r, i) => (
            <tr key={i}>
              <td dir="auto">{r.sources.length ? r.sources.join(ar ? '، ' : ', ') : '—'}</td>
              <td dir="ltr">{[r.dataset && r.dataset !== r.table ? r.dataset : '', r.table].filter(Boolean).join(' · ') || '—'}</td>
              <td dir="ltr"><code>{r.column}</code></td>
              <td dir="auto">{typeof r.meaning === 'string' ? r.meaning : B(r.meaning)}{r.attribute && !String(r.meaning).includes(r.attribute.slice(0, 18)) ? <small className="gl-sub"> ({r.attribute})</small> : null}</td>
              <td dir="auto">{r.transformation || '—'}</td>
              <td dir="auto">{r.join || '—'}</td>
              <td>{r.verified ? <span className="rv-tag">{L('Verified', 'مؤكد')}</span> : <span className="rv-tag rv-tag--warn">{L('Not yet confirmed', 'غير مؤكد بعد')}</span>}{r.specStatus && STATUS[r.specStatus] && <small className="gl-sub"> {B(STATUS[r.specStatus])}</small>}{r.note && <small className="gl-sub"> {B(r.note)}</small>}{!r.schema && r.gap ? <small className="gl-sub" dir="auto"> {r.gap}</small> : null}</td>
            </tr>))}</tbody></table></div>}
        {sc.rows.length > 0 && sc.total > sc.rows.length && <p className="muted" style={{ fontSize: 12 }}>{L(`Showing ${sc.rows.length} of ${sc.total} documented columns; the project specification holds the full lineage.`, `يُعرض ${sc.rows.length} من ${sc.total} عموداً موثّقاً؛ وتحتفظ مواصفات المشروع بالسلسلة الكاملة.`)}</p>}
        {sc.rows.length > 0 && <p className="muted" style={{ fontSize: 12 }} dir="auto">{L('Schema text is technical and kept in English as documented. Databank, Incorta, Makeen and similar are tools or access routes, not source systems, and are not listed as sources.', 'نصوص المخطط تقنية وتبقى بالإنجليزية كما وردت في الوثائق. بنك البيانات وIncorta وMakeen ونحوها أدوات أو مسارات وصول وليست مصادر بيانات، ولا تُعرض كمصادر.')}</p>}
      </>)}
    </div>
  );
}
