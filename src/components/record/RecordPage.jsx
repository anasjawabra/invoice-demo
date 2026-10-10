import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useL } from '../../utils/bi';

// The ONE full-page layout for every record (invoice, enforcement order, contract, analysis result):
// breadcrumbs · contextual return · title + identifier + statuses · essential summary · a few sections (secondary details folded).
export function RecordHeader({ crumbs = [], title, id = null, kind = null, statuses = null, actions = null, ret = null }) {
  const { L } = useL();
  // the browser tab names the record (history, bookmarks and screen readers announce it)
  useEffect(() => { const base = document.title.split(' | ').pop(); document.title = `${title} | ${base}`; }, [title]);
  useEffect(() => { window.scrollTo(0, 0); }, []); // a record page opens at its top, whatever position the list had
  return (
    <header className="rp-head">
      <nav className="rp-crumbs" aria-label={L('Breadcrumb', 'مسار التنقل')}>
        <ol>
          {crumbs.map((c, i) => (
            <li key={i}>{c.to && i < crumbs.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span aria-current={i === crumbs.length - 1 ? 'page' : undefined} dir={c.ltr ? 'ltr' : undefined}>{c.label}</span>}</li>
          ))}
        </ol>
        {ret && <button type="button" className="btn btn-sm rp-return" onClick={ret.go}><span aria-hidden="true">{L('←', '→')}</span> {L('Back to', 'العودة إلى')} {ret.label}</button>}
      </nav>
      <div className="rp-titlebar">
        <div className="rp-title">
          {kind && <div className="rp-kind">{kind}</div>}
          <h1 className="page-title" dir={id ? 'ltr' : undefined}>{title}</h1>
          {id && id !== title && <div className="rp-id" dir="ltr">{id}</div>}
        </div>
        {actions && <div className="rp-actions">{actions}</div>}
      </div>
      {statuses && <div className="rp-statuses" role="group" aria-label={L('Statuses (kept separate)', 'الحالات (منفصلة)')}>{statuses}</div>}
    </header>
  );
}

// one labelled status, so that payment / enforcement / review statuses are always read as three different things
export function StatusGroup({ label, children, hint = null }) {
  return <div className="rp-status"><span className="rp-status__k">{label}</span><span className="rp-status__v">{children}</span>{hint && <span className="rp-status__hint">{hint}</span>}</div>;
}

// a key figure strip (essential summary first) — one composed object, not a row of separate cards
export function Figures({ items, label }) {
  return (
    <dl className="rp-figures" aria-label={label}>
      {items.map((x, i) => (
        <div key={i} className={`rp-fig${x.tone ? ` rp-fig--${x.tone}` : ''}`}>
          <dt>{x.label}</dt><dd dir="ltr">{x.value}</dd>{x.note && <div className="rp-fig__note">{x.note}</div>}
        </div>
      ))}
    </dl>
  );
}

export function Facts({ items }) {
  return <dl className="rp-facts">{items.filter(Boolean).map((x, i) => <div key={i}><dt>{x.k}</dt><dd dir={x.ltr ? 'ltr' : 'auto'}>{x.v}</dd></div>)}</dl>;
}

// a section: always-open primary content, or a folded «secondary» detail (native <details>: keyboard accessible, no script)
export function Section({ id, title, count = null, secondary = false, defaultOpen = false, children, aside = null, note = null }) {
  const head = <><h2 className="rp-h2">{title}</h2>{count != null && <span className="rp-count">{count}</span>}</>;
  if (secondary) return (
    <section className="rp-section rp-section--secondary" id={id} aria-labelledby={`${id}-h`}>
      <details open={defaultOpen}><summary id={`${id}-h`}>{head}</summary><div className="rp-body">{note}{children}</div></details>
    </section>
  );
  return (
    <section className="rp-section" id={id} aria-labelledby={`${id}-h`}>
      <div className="rp-sec-head"><div id={`${id}-h`} className="rp-sec-title">{head}</div>{aside}</div>
      {note}
      <div className="rp-body">{children}</div>
    </section>
  );
}

// loading / error (with retry) / not found, for any record page
export function RecordState({ loading, error, notFound, onRetry, kind, backTo }) {
  const { L } = useL();
  if (loading) return <div className="rp-state" role="status" aria-live="polite"><div className="rp-skel" aria-hidden="true" /><div className="rp-skel rp-skel--short" aria-hidden="true" /><span>{L('Loading…', 'جارٍ التحميل…')}</span></div>;
  if (notFound) return (
    <div className="rp-state rp-state--bad" role="alert">
      <h2 className="rp-h2" style={{ fontSize: 20 }}>{L(`${kind || 'Record'} not found`, `${kind || 'السجل'} غير موجود`)}</h2>
      <p>{L('The address may be mistyped, the record may be outside your access, or it is not in the data loaded for this date.', 'ربما كُتب العنوان خطأً، أو أن السجل خارج صلاحياتك، أو غير موجود في البيانات المحمّلة لهذا التاريخ.')}</p>
      {backTo && <Link className="btn btn-sm btn-primary" to={backTo.path}>{backTo.label}</Link>}
    </div>
  );
  if (error) return (
    <div className="rp-state rp-state--bad" role="alert">
      <h2 className="rp-h2" style={{ fontSize: 20 }}>{L('The page could not be loaded', 'تعذّر تحميل الصفحة')}</h2>
      <p>{String(error.message || '')}</p>
      <div style={{ display: 'flex', gap: 8 }}>{onRetry && <button type="button" className="btn btn-sm btn-primary" onClick={onRetry}>{L('Retry', 'إعادة المحاولة')}</button>}{backTo && <Link className="btn btn-sm" to={backTo.path}>{backTo.label}</Link>}</div>
    </div>
  );
  return null;
}

// a finding that needs action: what to review · why it was flagged · the evidence · the available action
export function Finding({ title, why, evidence = null, actions = null, tone = 'warn', status = null }) {
  const { L } = useL();
  return (
    <article className={`rp-finding rp-finding--${tone}`}>
      <div className="rp-finding__main">
        <h3 className="rp-finding__title">{title}{status && <span className="rp-finding__status">{status}</span>}</h3>
        <div className="rp-finding__why"><b>{L('Why flagged', 'سبب الإشارة')}:</b> {why}</div>
        {evidence && <div className="rp-finding__ev"><b>{L('Evidence', 'الدليل')}:</b> {evidence}</div>}
      </div>
      {actions && <div className="rp-finding__actions">{actions}</div>}
    </article>
  );
}
