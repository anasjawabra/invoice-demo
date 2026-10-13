import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useRevenue } from '../context/RevenueContext';
import { CATEGORY_LABELS } from '../data/revenueMetrics';
import { pickBi } from '../data/revenueInsights';
import { ProvenanceBadge, ScopeBar } from '../components/revenue/RevenueUI';
import { useL } from '../utils/bi';
import { useAsync } from '../utils/useAsync';
import { useOpenRecord, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { invoicePath } from '../utils/paths';
import { fmtDateText } from '../data/clock';

const PAGE_SIZE = 50;
const SORTABLE = { id: 'id', issue: 'issue', gross: 'gross', outstanding: 'outstanding', age: 'daysOverdue' };

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h); }, [value, ms]);
  return v;
}

// The invoice library. The browser never holds the invoices: every page, count, total, sort and filter is computed by the
// data service over the whole population and only the visible page (50 rows) is transferred. A row opens the full record on demand.
export default function Invoices() {
  const { t, lang, T } = useI18n();
  const rev = useRevenue();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightCo = searchParams.get('co');
  const idParam = searchParams.get('id');
  const filterMode = searchParams.get('filter');
  const srcParam = searchParams.get('src');

  const bi = useL();
  // coming BACK from a record page (the return link or the browser's Back) restores the filters, sorting, page and scroll position this list had
  const restore = useShouldRestore();
  const mem = useMemo(() => readListMemory('invoices', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const amanahParam = searchParams.get('amanah'); // a link such as /invoices?amanah=… sets the SHARED Amanah filter (the scope bar), then drops the parameter
  const [collectionFilter, setCollectionFilter] = useState(mem.collectionFilter ?? 'all');
  const [search, setSearch] = useState(mem.search ?? (highlightCo || ''));
  const allPeriods = !!highlightCo; // a contract link (?co=…) lists that contract's invoices of every period
  const [page, setPage] = useState(mem.page ?? 0);
  const [sort, setSort] = useState(mem.sort ?? { key: 'issue', dir: 'desc' });
  useEffect(() => { writeListMemory('invoices', { collectionFilter, search, page, sort }); }, [collectionFilter, search, page, sort]);
  const debouncedSearch = useDebounced(search.trim(), 350);

  const activeFilterCount = (collectionFilter !== 'all' ? 1 : 0) + (debouncedSearch ? 1 : 0) + (srcParam ? 1 : 0) + (filterMode ? 1 : 0);

  // any filter change returns to the first page
  const filterKey = JSON.stringify([collectionFilter, debouncedSearch, srcParam, filterMode, sort, rev.currentScopeKey, rev.dataVersion]);
  const lastKey = useRef(filterKey);
  useEffect(() => { if (lastKey.current !== filterKey) { lastKey.current = filterKey; setPage(0); } }, [filterKey]);

  const request = useMemo(() => {
    const sc = rev.scopeEff;
    // the shared scope bar (period, Amanah, source, municipality) plus this page's own collection-state, revenue-item and age filters
    const scope = { from: sc.from, to: sc.to, amanah: sc.amanah, source: srcParam || sc.source, status: 'all', scopeType: 'all', muni: sc.muni, item: 'all' };
    const filters = { search: debouncedSearch, state: collectionFilter === 'all' ? 'paid' : collectionFilter, allPeriods, tag: filterMode === 'problem' ? 'problem' : undefined };
    return { scope, filters };
  }, [rev.scopeEff, srcParam, debouncedSearch, collectionFilter, allPeriods, filterMode]);

  const { data: res, loading, error } = useAsync(() => rev.data.list(request.scope, { filters: request.filters, page, pageSize: PAGE_SIZE, sort }), [rev.data, request, page, sort]);
  const rows = res?.rows || [];
  const total = res?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sums = res?.sums || { gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 };

  const openRecord = useOpenRecord(); // a row opens the invoice's own full page; «back» returns here with everything as it was
  const openDetail = useCallback((row) => openRecord(invoicePath(row.id)), [openRecord]);
  const onRowKey = useCallback((row, e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); openDetail(row); } }, [openDetail]);
  useRestoreScroll(rows.length > 0 && !loading);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'id' ? 'asc' : 'desc' }));
  const th = (label, key) => (
    <th aria-sort={sort.key === SORTABLE[key] ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="rv-link" style={{ font: 'inherit', fontWeight: 700 }} onClick={() => toggleSort(SORTABLE[key])}>{label}{sort.key === SORTABLE[key] ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
    </th>
  );
  const exportHref = rev.data.exportUrl(request.scope, { filters: request.filters, sort });

  const viewLabel = bi.L('View details', 'عرض التفاصيل');
  // F-13: a drill-down link such as /invoices?src=fines writes the source into the SHARED filter (visible in the scope bar and used by the KPI strip), then drops the hidden URL parameter
  useEffect(() => { if (amanahParam) { rev.setAmanah(amanahParam); setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('amanah'); return n; }, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (srcParam) { rev.setSource(srcParam); setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('src'); return n; }, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const clearAll = () => {
    setCollectionFilter('all'); setSearch('');
    if (srcParam || filterMode) setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('src'); n.delete('filter'); return n; });
  };
  const selStyle = { height: 32, width: 'auto', paddingInline: 10, fontSize: 13 };

  if (idParam) return <Navigate to={invoicePath(idParam)} replace />; // the old «?id=» address of the former drawer

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('invoices')}</h1>
          <div className="page-sub">{t('recent_sub')}</div>
        </div>
      </div>

      <ScopeBar hideStatus />

      <div className="card card-pad" style={{ padding: '10px 14px' }} role="search" aria-label={bi.L('Invoice filters', 'مرشحات الفواتير')}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <input id="inv_search" className="input" style={{ flex: '1 1 220px', height: 32, minWidth: 180 }} placeholder={bi.L('Invoice, SADAD, subscription, violation, CR, payer or contract', 'فاتورة أو سداد أو اشتراك أو مخالفة أو سجل تجاري أو دافع أو عقد')} aria-label={bi.L('Search', 'بحث')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select id="f_state" className="select" aria-label={bi.L('Collection state', 'حالة التحصيل')} style={{ ...selStyle, minWidth: 180 }} value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)}>
          <option value="all">{bi.L('All collected invoices (in full or in part)', 'كل الفواتير المحصّلة (كلياً أو جزئياً)')}</option>
          <option value="collected">{bi.L('Collected in full', 'محصّلة بالكامل')}</option>
          <option value="partial">{pickBi(CATEGORY_LABELS.partial, lang)}</option>
        </select>
        {activeFilterCount > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={clearAll}>{t('inv_filter_clear')} ({activeFilterCount}) ×</button>
        )}
        <a className="btn btn-sm" href={exportHref} download>{bi.L('Export CSV', 'تصدير CSV')}</a>
        </div>
      </div>

      <section className="card card-pad inv-stats" aria-label={bi.L('Collection statistics of the matching invoices', 'إحصاءات التحصيل للفواتير المطابقة')}>
        <h2 className="ip-h">{bi.L('Collection statistics — the matching invoices', 'إحصاءات التحصيل — الفواتير المطابقة')}</h2>
        <div className="inv-stats__grid">
          <div><span className="ip-k">{bi.L('Invoices', 'عدد الفواتير')}</span><b className="ip-big" dir="ltr">{loading && !res ? '…' : bi.count(total)}</b></div>
          <div><span className="ip-k">{bi.L('Net billed', 'صافي المفوتر')}</span><b className="ip-big" dir="ltr" title={bi.sar(sums.net)}>{bi.short(sums.net)}</b></div>
          <div><span className="ip-k">{bi.L('Collected', 'المحصّل')}</span><b className="ip-big ip-good" dir="ltr" title={bi.sar(sums.collected)}>{bi.short(sums.collected)}</b></div>
          <div><span className="ip-k">{bi.L('Uncollected', 'غير المحصّل')}</span><b className="ip-big" dir="ltr" title={bi.sar(sums.outstanding)}>{bi.short(sums.outstanding)}</b></div>
          <div><span className="ip-k">{bi.L('Collection rate', 'نسبة التحصيل')}</span><b className="ip-big" dir="ltr">{sums.net > 0 ? `${(Math.round((sums.collected / sums.net) * 1000) / 10).toFixed(1)}%` : '—'}</b></div>
        </div>
        {sums.net > 0 && <div className="ip-bar" role="img" aria-label={bi.L('Collected share of net billed', 'نسبة المحصّل من صافي المفوتر')}><i className="ip-bar__paid" style={{ width: `${Math.min(sums.collected / sums.net, 1) * 100}%` }} /><i className="ip-bar__left" style={{ width: `${Math.max(1 - sums.collected / sums.net, 0) * 100}%` }} /></div>}
        <div className="muted" style={{ fontSize: 12 }}>{bi.L('Collection rate = collected ÷ net billed of the invoices that match the filters above.', 'نسبة التحصيل = المحصّل ÷ صافي المفوتر للفواتير المطابقة للمرشحات أعلاه.')}</div>
      </section>

      <div className="card card-pad">
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{t('inv_makeen_note')} {bi.L('Amounts in this table are full SAR; cards above show one appropriate unit per amount.', 'المبالغ في هذا الجدول بالريال كاملة؛ والبطاقات أعلاه بوحدة واحدة مناسبة لكل مبلغ.')}</div>
        {filterMode === 'problem' && (
          <div className="card" style={{ padding: '8px 12px', marginBottom: 10, background: 'rgba(180, 35, 24, 0.06)', border: '1px solid rgba(180, 35, 24, 0.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t('inv_filter_problem_title')}</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('filter'); return n; })}>{t('inv_filter_clear')} ×</button>
          </div>
        )}
        {error && <div className="rv-callout rv-callout--bad" role="alert">{bi.L('The data service could not load this page.', 'تعذّر على خدمة البيانات تحميل هذه الصفحة.')} {String(error.message || '')}</div>}
        <div className="table-wrap" tabIndex={0} aria-busy={loading}>
          <table className="table" aria-label="Invoice library">
            <thead>
              <tr>
                {th(t('th_id'), 'id')}
                <th>{t('th_beneficiary')}</th>
                <th>{t('th_amanah')}</th>
                <th>{bi.L('Revenue item', 'بند الإيراد')}</th>
                <th>{bi.L('Raw status', 'الحالة الخام')}</th>
                <th>{t('th_collection_status')}</th>
                {th(`${t('th_amount')} (${bi.L('SAR', 'ريال')})`, 'gross')}
                {th(`${bi.L('Uncollected', 'غير المحصّل')} (${bi.L('SAR', 'ريال')})`, 'outstanding')}
                {th(bi.L('Issue date', 'تاريخ الإصدار'), 'issue')}
                <th>{bi.L('Due date', 'تاريخ الاستحقاق')}</th>
                {th(bi.L('Days past due', 'أيام التأخر بعد الاستحقاق'), 'age')}
                <th><span className="sr-only">{viewLabel}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="row-clickable"
                  onClick={(e) => openDetail(r)}
                  style={idParam === r.id ? { background: 'rgba(21, 112, 239, 0.08)' } : undefined}
                >
                  <td style={{ fontWeight: 700 }} dir="ltr"><button type="button" className="rv-link" onClick={(e) => { e.stopPropagation(); openDetail(r); }} aria-label={`${viewLabel}: ${r.id}`}>{r.id}</button>{r.uploaded ? <span className="rv-tag" style={{ marginInlineStart: 6 }}>{lang === 'ar' ? 'مرفوع' : 'uploaded'}</span> : null}</td>
                  <td>{lang === 'ar' ? r.payerAr : r.payerEn}</td>
                  <td>{lang === 'zh' ? r.amanahZh : lang === 'ar' ? r.amanahAr : r.amanahEn}{r.municipalityEn && <div className="muted" style={{ fontSize: 12 }}>{lang === 'ar' ? r.municipalityAr : r.municipalityEn} · {r.scopeType === 'internal' ? bi.L('internal', 'داخلي') : bi.L('central', 'مركزي')}</div>}</td>
                  <td>{bi.ar ? r.itemAr : r.itemEn}</td>
                  <td style={{ fontSize: 12 }}>{r.statusRawTahseel || '—'}{r.statusRawEfaa && r.statusRawEfaa !== r.statusRawTahseel && <div className="muted">{bi.L('Efaa', 'إيفاء')}: {r.statusRawEfaa}</div>}</td>
                  <td>
                    <span className={`rv-cat rv-cat--${r.cls}`}>{r.cls === 'collected' ? (lang === 'ar' ? 'محصّلة' : 'Collected') : pickBi(CATEGORY_LABELS[r.cls], lang)}</span>
                    {r.enforcement >= 2 && <span className={`rv-tag${r.enforcement === 3 ? ' rv-tag--warn' : ''}`} style={{ marginInlineStart: 4 }} title={bi.L('Enforcement is a separate dimension: it does not change the payment state', 'الإنفاذ بُعد منفصل: لا يغيّر حالة السداد')}>{r.enforcement === 2 ? bi.L('order not closed', 'أمر غير مغلق') : r.enforcement === 3 ? bi.L('order on hold', 'أمر معلّق') : bi.L('referred before', 'سبقت إحالتها')}</span>}
                    {r.enfConflict && <span className="rv-tag rv-tag--bad" style={{ marginInlineStart: 4 }} title={bi.L('Cancelled in the source and referred to enforcement: it stays cancelled; review the disagreement.', 'ملغاة في المصدر ومحالة للتنفيذ: تبقى ملغاة؛ راجع التعارض.')}>{bi.L('cancelled yet referred', 'ملغاة ومحالة')}</span>}
                    {r.tags.includes('amount_conflict') && <span className="rv-tag rv-tag--bad" style={{ marginInlineStart: 4 }}>{lang === 'ar' ? 'تعارض مبلغ' : 'amount conflict'}</span>}
                    {r.tags.includes('contract_unmatched') && <span className="rv-tag rv-tag--warn" style={{ marginInlineStart: 4 }}>{lang === 'ar' ? 'عقد غير مطابق' : 'contract not matched'}</span>}
                    {r.tags.includes('exclusion_pending') && <span className="rv-tag" style={{ marginInlineStart: 4 }}>{lang === 'ar' ? 'استبعاد قيد المراجعة' : 'exclusion pending'}</span>}
                  </td>
                  <td dir="ltr">{bi.sar(r.gross)}{r.exclusions > 0 && <div className="muted" style={{ fontSize: 12 }}>{bi.L('excl.', 'استبعاد')} {bi.sar(r.exclusions)} · {bi.L('net', 'صافي')} {bi.sar(r.net)}</div>}</td>
                  <td dir="ltr">{bi.sar(r.outstanding)}{r.collected > 0 && <div className="muted" style={{ fontSize: 12 }}>{bi.L('collected', 'محصّل')} {bi.sar(r.collected)}</div>}</td>
                  <td dir="ltr" title={r.issueDate}>{fmtDateText(r.issueDate, lang === 'ar' ? 'ar' : 'en')}</td>
                  <td dir="ltr" title={r.dueDate}>{fmtDateText(r.dueDate, lang === 'ar' ? 'ar' : 'en')}</td>
                  <td dir="ltr">{r.daysOverdue > 0 ? r.daysOverdue : '—'}</td>
                  <td className="row-view">
                    <span className="row-view__link">{viewLabel}<span className="row-view__chev" aria-hidden="true">›</span></span>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && <tr><td colSpan={11}><div className="rv-empty">{bi.L('No invoices match these filters.', 'لا توجد فواتير مطابقة لهذه المرشحات.')}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }} role="navigation" aria-label={bi.L('Pages', 'الصفحات')}>
          <button type="button" className="btn btn-sm" disabled={page <= 0} onClick={() => setPage(0)}>«</button>
          <button type="button" className="btn btn-sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>{bi.L('Previous', 'السابق')}</button>
          <span className="muted" style={{ fontSize: 12 }} dir="ltr">{bi.count(Math.min(total, page * PAGE_SIZE + 1))}–{bi.count(Math.min(total, (page + 1) * PAGE_SIZE))} / {bi.count(total)} · {bi.L('page', 'صفحة')} {page + 1} / {bi.count(pages)}</span>
          <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>{bi.L('Next', 'التالي')}</button>
          <button type="button" className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)}>»</button>
        </div>
      </div>

    </div>
  );
}
