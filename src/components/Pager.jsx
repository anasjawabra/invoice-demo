import React from 'react';
import { useL } from '../utils/bi';

// Page controls for server-side paging: shows the exact range and total, never loads more than one page.
export default function Pager({ page, total, size, onPage }) {
  const { L, count } = useL();
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }} role="navigation" aria-label={L('Pages', 'الصفحات')}>
      <button type="button" className="btn btn-sm" disabled={page <= 0} onClick={() => onPage(0)}>«</button>
      <button type="button" className="btn btn-sm" disabled={page <= 0} onClick={() => onPage(Math.max(0, page - 1))}>{L('Previous', 'السابق')}</button>
      <span className="muted" style={{ fontSize: 12 }} dir="ltr">{count(Math.min(total, page * size + 1))}–{count(Math.min(total, (page + 1) * size))} / {count(total)} · {L('page', 'صفحة')} {page + 1} / {count(pages)}</span>
      <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => onPage(Math.min(pages - 1, page + 1))}>{L('Next', 'التالي')}</button>
      <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => onPage(pages - 1)}>»</button>
    </div>
  );
}
