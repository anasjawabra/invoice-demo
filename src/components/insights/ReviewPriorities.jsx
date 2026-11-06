// «أبرز ما يحتاج مراجعة» — at most THREE cases from the existing Decision Room prioritisation (`buildReviewPriorities`): title · affected entity · ONE measure · «فحص».
// An aggregate is never shown beside its own entity cases; the link to the Decision Room appears only for a person who holds the `decisions` module (the cases themselves are not even computed otherwise).
import React from 'react';
import { Link } from 'react-router-dom';
import { useAr } from '../../utils/useAr';

const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');

export default function ReviewPriorities({ review, loading = false }) {
  const { L, ar, lang } = useAr();
  if (!review || !review.allowed) return null;
  return (
    <section className="card st-card ins-review" aria-labelledby="ins-rev-h">
      <div className="ins-sum__head"><h2 className="ins-h" id="ins-rev-h" style={{ margin: 0 }}>{L('أبرز ما يحتاج مراجعة', 'Top findings to review')}</h2>
        {review.link.show ? <Link className="btn btn-sm btn-ghost" to={review.link.to}>{pick(review.link.label, lang)} {ar ? '←' : '→'}</Link> : null}</div>
      {loading ? <div className="muted" role="status">{L('جارٍ تجهيز البنود…', 'Preparing the items…')}</div> : review.cases.length === 0
        ? <div className="muted" role="status">{L('لا بنود تدعمها البيانات في هذا النطاق.', 'The data supports no findings in this scope.')}</div>
        : (
          <ul className="ins-rev__list">{review.cases.map((c) => (
            <li key={c.key}>
              <div className="ins-rev__main"><span className="ins-rev__title">{pick(c.title, lang)}</span><small className="muted">{pick(c.entity.name, lang)}</small></div>
              <div className="ins-rev__m"><span className="muted">{pick(c.measure.label, lang)}</span> <bdi dir="ltr"><b>{pick(c.measure.text, lang)}</b></bdi></div>
              <Link className="btn btn-sm ins-rev__go" to={c.inspectTarget.to} aria-label={`${L('فحص', 'Inspect')}: ${pick(c.title, lang)}`}>{L('فحص', 'Inspect')}</Link>
            </li>))}</ul>
        )}
    </section>
  );
}
