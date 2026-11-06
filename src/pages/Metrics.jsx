import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useL } from '../utils/bi';
import SettingsNav from '../components/settings/SettingsNav';
import { DIRECTORY, SCHEMA_STATES, CATEGORIES, categoryEntries } from '../data/dictionaryDirectory';
import '../components/settings/dictionaryTools.css';

// «قاموس المقاييس والمصطلحات» — a reference directory: one brief card per metric or term (definition, short formula, source systems, schema availability) that opens its own detail page.
// It shows no filters and no live KPI value: the page explains the rules; the numbers belong to the dashboards.
export const SchemaBadge = ({ state }) => {
  const { B } = useL(); const s = SCHEMA_STATES[state];
  return <span className={`gl-schema gl-schema--${state}`} title={B(s.full)}><span className="gl-schema__dot" aria-hidden="true" />{B(s)}</span>;
};

function Card({ e }) {
  const { L, B, ar } = useL();
  return (
    <li className="gl-card">
      <div className="gl-card__top"><h3 className="gl-card__name">{B(e.name)}</h3><span className="gl-card__type">{e.type === 'metric' ? L('Metric', 'مقياس') : L('Term', 'مصطلح')}</span></div>
      <p className="gl-card__def">{B(e.brief)}</p>
      {e.formula && <p className="gl-card__formula" dir="auto"><span className="gl-card__formula-h">{L('Formula', 'المعادلة')}</span>{B(e.formula)}</p>}
      <p className="gl-card__src"><span className="gl-card__src-h">{L('Sources', 'المصادر')}</span>{e.sourceLabels.length ? e.sourceLabels.map((s) => B(s)).join(ar ? '، ' : ', ') : <span className="muted">{L('Defined in the application', 'معرَّف في التطبيق')}</span>}</p>
      <div className="gl-card__foot">
        <SchemaBadge state={e.schema.state} />
        <Link className="gl-card__link" to={`/settings/metrics/${e.id}`} aria-label={`${L('View details', 'عرض التفاصيل')} — ${B(e.name)}`}>{L('View details', 'عرض التفاصيل')}<span aria-hidden="true" className="gl-card__arrow">→</span></Link>
      </div>
    </li>
  );
}

// the search reads the visible text of a card (name, brief, formula, id) in the current language and the other one, so «forecast» finds «التوقع» too
const hay = (e) => [e.id, e.name?.ar, e.name?.en, e.brief?.ar, e.brief?.en, e.formula?.ar, e.formula?.en, e.symbolic].filter(Boolean).join(' ').toLowerCase();

export default function Metrics() {
  const { L, B } = useL();
  const [sp] = useSearchParams(); const cat = CATEGORIES[sp.get('category')] ? sp.get('category') : null; // ?category=planning → the planning category page
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const match = (e) => !needle || hay(e).includes(needle);
  const all = useMemo(() => DIRECTORY, []);
  const shown = (type) => all.filter((e) => e.type === type && match(e));
  const inCat = cat ? categoryEntries(cat).filter(match) : [];
  const section = (id, title, list, intro) => (
    <section aria-labelledby={`gl-h-${id}`} id={`gl-${id}`}>
      <h2 className="h3 gl-section" id={`gl-h-${id}`}>{title}</h2>
      {intro && <p className="gl-intro" dir="auto">{intro}</p>}
      {list.length ? <ul className="gl-grid">{list.map((e) => <Card key={e.id} e={e} />)}</ul> : <p className="muted" role="status">{L('No entries match the search.', 'لا توجد مدخلات مطابقة للبحث.')}</p>}
    </section>
  );
  return (
    <div className="rv-page">
      <SettingsNav current="/settings/metrics" />
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Metrics and Glossary Dictionary', 'قاموس المقاييس والمصطلحات')}</h1>
          <div className="page-sub">{L('What each metric and term means, how it is calculated and where its data comes from. Reference only: no live figures.', 'ما يعنيه كل مقياس ومصطلح، وكيف يُحسب، ومن أين تأتي بياناته. مرجع فقط: دون أرقام حيّة.')}</div>
        </div>
      </div>
      <div className="gl-tools">
        <nav className="gl-cats" aria-label={L('Dictionary categories', 'تصنيفات القاموس')}>
          <Link to="/settings/metrics" className={`gl-cat${cat ? '' : ' is-on'}`} aria-current={cat ? undefined : 'page'}>{L('All', 'الكل')} <span className="gl-cat__n">{all.length}</span></Link>
          {Object.entries(CATEGORIES).map(([id, c]) => (
            <Link key={id} to={`/settings/metrics?category=${id}`} className={`gl-cat${cat === id ? ' is-on' : ''}`} aria-current={cat === id ? 'page' : undefined}>{B(c)} <span className="gl-cat__n">{categoryEntries(id).length}</span></Link>
          ))}
        </nav>
        <label className="gl-search"><span className="sr-only">{L('Search the dictionary', 'بحث في القاموس')}</span>
          <input type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Search a metric or a term', 'ابحث عن مقياس أو مصطلح')} aria-label={L('Search the dictionary', 'بحث في القاموس')} />
        </label>
      </div>
      {cat ? section(cat, B(CATEGORIES[cat]), inCat, B(CATEGORIES[cat].intro)) : <>
        {section('metric', L('Metrics', 'المقاييس'), shown('metric'))}
        {section('term', L('Terms', 'المصطلحات'), shown('term'))}
      </>}
    </div>
  );
}
