// The supporting-invoice table: the invoices behind whatever chart mark, card or answer was chosen, fetched from the data service with the SAME filter the figure was counted with
// (`filters.nc` + the analysis scope). Search, sorting and paging run on the service; the CSV export uses the same filter; every invoice number opens the ordinary invoice page and «back» returns here.
import React, { useEffect, useMemo, useState } from 'react';
import { RecordLink as Link, useRestoreScroll } from '../../../utils/returnContext';
import { invoicePath } from '../../../utils/paths';
import { useRevenue } from '../../../context/RevenueContext';
import { useL } from '../../../utils/bi';
import { useAsync } from '../../../utils/useAsync';
import Pager from '../../Pager';
import { PayStatusChip } from '../../revenue/EnforcementUI';
import ExportLink from '../../access/ExportLink';
import { useNc, EvidenceText } from './NcBits';
import { listRequest, listAmount, drillPopulation } from './ncModel';

export const PAGE_SIZE = 25;
const useDebounced = (value, ms) => { const [v, setV] = useState(value); useEffect(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h); }, [value, ms]); return v; };

export default function NcInvoices() {
  const rev = useRevenue(); const nc = useNc(); const { L, ar, count, sar, invoices } = useL();
  const { drill, q, sort, page, setView, base } = nc;
  const [text, setText] = useState(q);
  const debounced = useDebounced(text.trim(), 350);
  useEffect(() => { if (debounced !== q) setView({ q: debounced, page: 0 }); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setText(q); }, [q]); // a return / a cleared filter puts the search box back

  const pop = drillPopulation(drill);
  const sortKey = sort.key === 'amount' ? (pop === 'excluded' ? 'exclusionAmount' : 'outstanding') : sort.key;
  const rq = useMemo(() => listRequest(base, drill, { search: q }), [base, drill, q]);
  const { data: res, loading, error } = useAsync(() => rev.data.list(rq.scope, { filters: rq.filters, page, pageSize: PAGE_SIZE, sort: { key: sortKey, dir: sort.dir }, withNc: true }), [rev.data, rq, page, sortKey, sort.dir]);
  const rows = res?.rows || []; const total = res?.total ?? 0;
  useRestoreScroll(rows.length > 0 && !loading);
  // the figure the chart / card showed vs the list the service returned (the same filter): they must be equal
  const amount = res ? listAmount(res, pop) : null; const ex = drill?.expected || null;
  const match = res && ex ? Math.abs(amount - ex.amount) <= 0.5 && (ex.count == null || ex.count === total) : null;
  // scroll to the table when a chart / card opened it
  useEffect(() => { if (nc.scrollPending.current) { nc.scrollPending.current = false; const el = document.getElementById('nc-invoices'); if (el) el.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } }); // eslint-disable-line react-hooks/exhaustive-deps
  const exportHref = rev.data.exportUrl(rq.scope, { filters: rq.filters, sort: { key: sortKey, dir: sort.dir } });
  const toggle = (key) => setView({ sort: sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }, page: 0 });
  const th = (label, key) => (
    <th aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="rv-link nc-sortbtn" onClick={() => toggle(key)}>{label}{sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
    </th>
  );
  const dl = drill ? (ar ? drill.label.ar : drill.label.en) : L('All net unpaid invoices', 'كل فواتير صافي غير المسدد');
  const amountOf = (r) => (r.nc?.population === 'excludedUnpaid' ? r.exclusionAmount : r.outstanding);

  return (
    <section id="nc-invoices" className="nc-card nc-inv" aria-labelledby="nc-inv-h" tabIndex={-1}>
      <h2 id="nc-inv-h" className="nc-h">{L('Supporting invoices', 'الفواتير الداعمة')}</h2>
      <div className="nc-filterbar" role="group" aria-label={L('Active filter', 'التصفية الحالية')}>
        <span className="nc-chip">{drill ? (drill.src === 'chart' ? L('From the chart: ', 'من الرسم: ') : L('Filter: ', 'التصفية: ')) : ''}<b dir="auto">{dl}</b>{drill && <button type="button" className="nc-chip__x" onClick={() => nc.clearDrill()} aria-label={L('Remove the filter', 'إزالة التصفية')}>×</button>}</span>
        {q && <span className="nc-chip">{L('Search: ', 'بحث: ')}<b dir="auto">{q}</b><button type="button" className="nc-chip__x" onClick={() => setView({ q: '', page: 0 })} aria-label={L('Clear the search', 'مسح البحث')}>×</button></span>}
        <input className="input nc-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Search: invoice number, payer, SADAD…', 'بحث: رقم الفاتورة أو الجهة المفوترة أو سداد…')} aria-label={L('Search the invoices', 'بحث في الفواتير')} />
        <ExportLink filters={rq.filters} href={exportHref}>{L('Export CSV (this filter)', 'تصدير CSV (هذه التصفية)')}</ExportLink>
      </div>
      <div className="nc-invsum" role="status" aria-live="polite">
        {res ? <>
          <b>{invoices(total)}</b> · <span dir="ltr" title={sar(amount)}>{sar(amount)}</span>
          {match === true && <span className="nc-match nc-match--ok"> ✓ {L('equals the figure shown', 'يطابق الرقم المعروض')}</span>}
          {match === false && <span className="nc-match nc-match--bad"> ⚠ {L(`differs from the saved figure (${ex.count != null ? `${invoices(ex.count)}, ` : ''}${sar(ex.amount)}) — data or settings changed since this version`, `يختلف عن الرقم المحفوظ (${ex.count != null ? `${count(ex.count)} فاتورة، ` : ''}${sar(ex.amount)}) — تغيّرت البيانات أو الإعدادات بعد هذا الإصدار`)}</span>}
        </> : loading ? L('Loading…', 'جارٍ التحميل…') : null}
        {error && <span className="nc-match nc-match--bad"> {L('The invoices could not be loaded.', 'تعذّر تحميل الفواتير.')}</span>}
      </div>
      <div className="rv-table-wrap" tabIndex={0} aria-busy={loading}>
        <table className="rv-table nc-table nc-invtable" aria-label={L('Supporting invoices', 'الفواتير الداعمة')}>
          <thead><tr>
            {th(L('Invoice', 'الفاتورة'), 'id')}<th>{L('Amanah · municipality', 'الأمانة · البلدية')}</th><th>{L('Billed party', 'الجهة المفوترة')}</th>
            {th(L('Unpaid (SAR)', 'غير المسدد (ريال)'), 'amount')}{th(L('Days overdue', 'أيام التأخر'), 'daysOverdue')}
            <th>{L('Reason · evidence', 'السبب · الدليل')}</th><th>{L('Proposed next step', 'الخطوة المقترحة')}</th><th>{L('Payment status', 'حالة السداد')}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nc-idcell"><Link to={invoicePath(r.id)} dir="ltr" aria-label={`${L('Open invoice', 'فتح الفاتورة')} ${r.id}`}>{r.id}</Link></td>
                <td>{ar ? r.amanahAr : r.amanahEn}{(ar ? r.municipalityAr : r.municipalityEn) && <div className="muted nc-sub">{ar ? r.municipalityAr : r.municipalityEn}</div>}</td>
                <td dir="auto">{ar ? r.payerAr : r.payerEn}</td>
                <td className="num" dir="ltr">{nc.f.full(amountOf(r))}{r.collected > 0 && <div className="muted nc-sub">{L('paid', 'سُدد')} {nc.f.full(r.collected)}</div>}</td>
                <td className="num" dir="ltr">{r.daysOverdue > 0 ? count(r.daysOverdue) : <span className="muted" dir="auto">{r.nc?.due === 'not_due' ? L('not yet due', 'لم يحن') : '—'}</span>}</td>
                <td dir="auto">{r.nc?.reason ? <>{ar ? r.nc.reason.labelAr : r.nc.reason.labelEn}<div className="nc-sub"><EvidenceText status={r.nc.reason.documented ? 'source_record' : 'none'} /></div></> : <span className="muted">—</span>}</td>
                <td dir="auto">{r.nc?.nextStepAr ? (ar ? r.nc.nextStepAr : r.nc.nextStepEn) : <span className="muted">—</span>}</td>
                <td><PayStatusChip status={r.payStatus} /></td>
              </tr>
            ))}
            {!rows.length && !loading && <tr><td colSpan={8}><div className="rv-empty">{L('No invoices match this filter.', 'لا توجد فواتير تطابق هذه التصفية.')}</div></td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} size={PAGE_SIZE} onPage={(p) => setView({ page: p })} label={L('Supporting invoices', 'الفواتير الداعمة')} />
    </section>
  );
}
