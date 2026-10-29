import React from 'react';
import { useL } from '../../utils/bi';
import { EXCLUSIONS_REFERENCE as R } from '../../data/exclusionsReference';

const split = (o, B) => B(o).split('|');

/* مرجع: قائمة الاستبعادات (مخرجات جلسة 21 أكتوبر 2026) — منقولة من المستند المصدر، وليست اعتماداً جديداً */
export default function ExclusionsReference() {
  const { L, B, ar , lang } = useL();
  const head = split(R.table_head, B);
  return (
    <section className="card card-pad" id="exclusions-reference" aria-label={B(R.title)}>
      <div className="rv-card__head">
        <h2 className="rv-sec-title">{L('Reference: ', 'مرجع: ')}{B(R.title)} <span className="rv-tag rv-tag--warn">{L('reference, not an approval', 'مرجع وليس اعتماداً')}</span></h2>
      </div>
      <p className="muted" dir="auto" style={{ fontSize: 12 }}>{B(R.origin)}</p>
      <div className="rv-callout" dir="auto">{B(R.caution)}</div>

      {R.summary.map((p, i) => <p key={i} dir="auto">{B(p)}</p>)}

      <h3 className="h3">{B(R.principles_title)}</h3>
      <ol className="dd-list">{R.principles.map((p, i) => <li key={i} dir="auto">{B(p)}</li>)}</ol>

      <h3 className="h3">{B(R.table_title)}</h3>
      <div className="rv-table-wrap" tabIndex={0}>
        <table className="rv-table dd-table">
          <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {R.rows.map((r) => (
              <tr key={r.n}>
                <td dir="ltr">{r.n}</td><td dir="auto"><b>{B(r.reason)}</b></td><td dir="auto">{B(r.source)}</td><td dir="auto">{B(r.scope)}</td>
                <td dir="auto">{B(r.criterion)}</td><td dir="auto">{B(r.status)}</td><td dir="ltr">{r.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="h3">{B(R.details_title)}</h3>
      {R.details.map((d) => (
        <details key={d.n} className="dd-ref" style={{ margin: '6px 0' }}>
          <summary dir="auto"><b>{d.n}.</b> {B(d.title)}</summary>
          <dl className="rv-dl">
            {d.items.map(([k, v]) => (<React.Fragment key={k}><dt>{B(R.labels[k])}</dt><dd dir="auto">{B(v)}</dd></React.Fragment>))}
          </dl>
          {d.n === 5 && (
            <>
              <h4 className="h3" style={{ fontSize: 13 }}>{B(R.upload_title)}</h4>
              <div className="rv-table-wrap" tabIndex={0}>
                <table className="rv-table dd-table">
                  <thead><tr>{split(R.upload_head, B).map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{R.upload.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} dir="auto">{B(c)}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <p dir="auto">{B(R.validation)}</p>
            </>
          )}
          {d.n === 7 && (
            <>
              <h4 className="h3" style={{ fontSize: 13 }}>{B(R.objection_title)}</h4>
              <div className="rv-table-wrap" tabIndex={0}>
                <table className="rv-table dd-table">
                  <thead><tr>{split(R.objection_head, B).map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{R.objection.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} dir="auto">{B(c)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </details>
      ))}

      <h3 className="h3">{B(R.compare_title)}</h3>
      <div className="rv-table-wrap" tabIndex={0}>
        <table className="rv-table dd-table">
          <thead><tr>{split(R.compare_head, B).map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{R.compare.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} dir="auto">{B(c)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
