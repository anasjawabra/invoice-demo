// «ملخص الأداء» — at most THREE findings from `buildPerformanceSummary` (the change · the gap · the priority issue): each = one sentence + one figure + «عرض». A finding that has no data is simply not shown (no empty cards).
// «عرض المقارنة الكاملة» opens the ONE details panel at the whole-scope level.
import React from 'react';
import { Link } from 'react-router-dom';
import { Val, StatusChip } from './RegionalParts';
import { useAr } from '../../utils/useAr';

const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');

export default function PerformanceSummary({ summary, onSelect, onOpenFull }) {
  const { L, ar, lang } = useAr();
  if (!summary) return null;
  const list = summary.findings;
  return (
    <section className="ins-sum" aria-labelledby="ins-sum-h">
      <div className="ins-sum__head"><h2 className="ins-h" id="ins-sum-h" style={{ margin: 0 }}>{L('ملخص الأداء', 'Performance summary')}</h2><button type="button" className="btn btn-sm btn-ghost" onClick={onOpenFull}>{L('عرض المقارنة الكاملة', 'Open the full comparison')}</button></div>
      {list.length ? (
        <ul className="ins-sum__list">
          {list.map((f) => {
            const fig = f.figure.value[lang] || f.figure.value[ar ? 'ar' : 'en']; const sec = f.figure.secondary;
            return (
              <li key={f.id} className={`ins-find ins-find--${f.id}`}>
                <div className="ins-find__t">{pick(f.title, lang)}</div>
                <p className="ins-find__s">{pick(f.sentence, lang)}</p>
                <div className="ins-find__fig"><span className="muted">{pick(f.figure.label, lang)}</span>{' '}
                  {fig.number != null ? <Val text={fig} lang={lang} strong /> : <b>{fig.text}</b>}
                  {sec ? <small className="muted"> · {pick(sec.label, lang)}: {sec.value ? <Val text={sec.value[lang]} lang={lang} /> : <span className="ins-na">{L('جديد', 'new')}</span>}</small> : null}</div>
                {f.status ? <div className="ins-find__st"><StatusChip status={f.status} lang={lang} size="sm" /></div> : null}
                {f.action.kind === 'open_item'
                  ? <Link className="btn btn-sm ins-find__go" to={f.action.target.to} aria-label={`${pick(f.action.label, lang)}: ${pick(f.title, lang)}`}>{pick(f.action.label, lang)}</Link>
                  : <button type="button" className="btn btn-sm ins-find__go" onClick={() => onSelect(f.action.target)} aria-label={`${pick(f.action.label, lang)}: ${pick(f.title, lang)}`}>{pick(f.action.label, lang)}</button>}
              </li>);
          })}
        </ul>
      ) : null}
    </section>
  );
}
