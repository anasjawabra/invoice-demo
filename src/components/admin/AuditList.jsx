import React, { useMemo, useState } from 'react';
import { normText } from '../../data/textNorm';
import { adminApi } from '../../api/adminClient';
import { useTx, useLoad, ErrorNotice, timeText, AIcon } from './adminBits';
import { auditRow } from './adminLogic';

/* The audit trail, kept simple: time (Riyadh) · actor · action · summary, with one search box and «show more». The Arabic summary comes from the server (English fallback in English).
   Entries never contain secrets and the before / after payloads are not shown. */
const PAGE = 25;

export default function AuditList() {
  const { tx, lang } = useTx();
  const [q, setQ] = useState(''); const [limit, setLimit] = useState(PAGE);
  const s = useLoad((signal) => adminApi.audit({ limit }, { signal }), [limit]);
  const rows = useMemo(() => (s.data ? s.data.entries : []).map((e) => auditRow(e, lang)), [s.data, lang]);
  const needle = normText(q);
  const shown = needle ? rows.filter((r) => normText(`${r.actor} ${r.action} ${r.summary}`).includes(needle)) : rows;
  return (
    <div className="adm-audit">
      <div className="adm-filters" role="search">
        <label className="adm-search"><AIcon name="search" size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('audit.search')} aria-label={tx('audit.search')} /></label>
      </div>
      {s.error ? <ErrorNotice error={s.error} onRetry={s.reload} /> : s.loading && !s.data ? <div className="adm-loading" role="status">{tx('common.loading')}</div> : shown.length === 0 ? <div className="adm-empty">{tx('audit.empty')}</div> : (
        <div className="adm-tablewrap">
          <table className="adm-table adm-table--audit">
            <caption className="sr-only">{tx('audit.title')}</caption>
            <thead><tr><th scope="col">{tx('audit.time')}</th><th scope="col">{tx('audit.actor')}</th><th scope="col">{tx('audit.action')}</th><th scope="col">{tx('audit.summary')}</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td data-label={tx('audit.time')} className="adm-nowrap"><span dir="ltr">{timeText(r.at)}</span></td>
                  <td data-label={tx('audit.actor')}>{r.actor}</td>
                  <td data-label={tx('audit.action')}><span className="adm-tag">{r.action}</span></td>
                  <td data-label={tx('audit.summary')}>{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="adm-audit__foot">
        <span className="adm-muted">{s.data ? tx('audit.count', { n: shown.length, total: s.data.total }) : ''} · {tx('audit.tz')}</span>
        {s.data && s.data.total > rows.length && <button type="button" className="btn btn-sm" onClick={() => setLimit(limit + PAGE)}>{tx('audit.more')}</button>}
      </div>
    </div>
  );
}
