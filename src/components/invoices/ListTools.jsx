// ListTools — the line above the invoice table: the result count (with what it counts), a sort selector (also the way to sort on a phone), the page size and the CSV export of ALL filtered rows.
import React from 'react';
import { useL } from '../../utils/bi';
import { PAGE_SIZES, exportHint, exportLabel } from './listLogic';

export default function ListTools({ heading, sub, sortOptions, sort, onSortValue, pageSize, onPageSize, exportHref, total, loading, exportDenied = null }) {
  const { L, ar, count: nf } = useL();
  const value = `${sort.key}:${sort.dir}`;
  return (
    <div className="il-tools">
      <div className="il-tools__count" role="status" aria-live="polite">
        {heading}
        {sub ? <span className="muted il-tools__sub">{sub}</span> : null}
      </div>
      <div className="il-tools__ctl">
        <label className="il-tools__f"><span>{L('Sort', 'الترتيب')}</span>
          <select className="select il-select" value={value} onChange={(e) => onSortValue(e.target.value)}>
            {sortOptions.map((o) => <option key={o.value} value={o.value}>{ar ? o.ar : o.en}</option>)}
            {!sortOptions.some((o) => o.value === value) && <option value={value}>{L('Custom', 'مخصّص')}</option>}
          </select>
        </label>
        <label className="il-tools__f"><span>{L('Per page', 'لكل صفحة')}</span>
          <select className="select il-select" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>{PAGE_SIZES.map((n) => <option key={n} value={n}>{nf(n)}</option>)}</select>
        </label>
        {exportDenied
          ? <span className="btn btn-sm il-export is-disabled" aria-disabled="true" role="link" tabIndex={0} title={exportDenied} data-reason={exportDenied}>{exportLabel(total || 0, ar, nf)}</span>
          : exportHref && total > 0 && !loading
          ? <a className="btn btn-sm il-export" href={exportHref} download title={exportHint(ar)} aria-label={`${exportLabel(total, ar, nf)}. ${exportHint(ar)}`}>{exportLabel(total, ar, nf)}</a>
          : <span className="btn btn-sm il-export is-disabled" aria-disabled="true" title={exportHint(ar)}>{exportLabel(total || 0, ar, nf)}</span>}
      </div>
    </div>
  );
}
