import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useExportGate } from '../components/access/ExportLink';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useRevenue } from '../context/RevenueContext';
import ScopeFilters from '../components/filters/ScopeFilters';
import NoResults from '../components/filters/NoResults';
import useClearStatusOnEnter from '../components/filters/useClearStatusOnEnter';
import { FILTER_PAGES } from '../components/filters/filterConfig';
import { collectedLocal, collectedListFilters, scopeIsDefault, narrowing } from '../components/filters/pageFilters';
import { useL } from '../utils/bi';
import { useAsync } from '../utils/useAsync';
import { useOpenRecord, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { invoicePath } from '../utils/paths';
import InvoiceListTable from '../components/invoices/InvoiceListTable';
import RankedBars from '../components/invoices/RankedBars';
import { usePageChartView } from '../components/charts/usePageChartView';
import KpiStrip from '../components/invoices/KpiStrip';
import CollectionRateCard from '../components/invoices/CollectionRateCard';
import ListTools from '../components/invoices/ListTools';
import Pager from '../components/Pager';
import { COLLECTED_WORDS, DEFAULT_PAGE_SIZE, PAGE_SIZES, collectedKpis, toggleKey } from '../components/invoices/listLogic';

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h); }, [value, ms]);
  return v;
}
const SORT_OPTIONS = [
  { value: 'issue:desc', ar: 'الأحدث إصداراً', en: 'Newest issued' }, { value: 'issue:asc', ar: 'الأقدم إصداراً', en: 'Oldest issued' },
  { value: 'collected:desc', ar: 'المحصّل: الأعلى أولاً', en: 'Collected: highest first' }, { value: 'collected:asc', ar: 'المحصّل: الأقل أولاً', en: 'Collected: lowest first' },
  { value: 'id:asc', ar: 'رقم الفاتورة', en: 'Invoice number' }
];
const FACETS = ['source']; // the ONE breakdown of this page: collected by REVENUE SOURCE

// The collected-invoice register. Structure: title + description → compact filters + search → KPI strip of the DISPLAYED population → visuals (collected by product · by invoice source)
// → the table (count · sort · pagination · export of ALL filtered rows). The browser never holds the invoices: counts, totals, facets, sorting and paging come from the data service.
export default function Invoices() {
  const { t, lang } = useI18n();
  const rev = useRevenue();
  const [chartView, onChartView] = usePageChartView('invoices');
  const [searchParams, setSearchParams] = useSearchParams();
  useClearStatusOnEnter(rev);
  const highlightCo = searchParams.get('co');
  const idParam = searchParams.get('id');
  const filterMode = searchParams.get('filter');
  const srcParam = searchParams.get('src');

  const bi = useL();
  const { L, ar, count: nf, short, sar } = bi;
  // coming BACK from a record page (the return link or the browser's Back) restores the filters, selections, sorting, page and scroll position this list had
  const restore = useShouldRestore();
  const mem = useMemo(() => readListMemory('invoices', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const muniParam = searchParams.get('muni'); // …&muni=<filter key> travels with ?amanah= (the dashboard / report drill-downs)
  const amanahParam = searchParams.get('amanah'); // a link such as /invoices?amanah=… sets the SHARED Amanah filter (the scope bar), then drops the parameter
  const [collectionFilter, setCollectionFilter] = useState(mem.collectionFilter ?? 'all');
  const [kind, setKind] = useState(mem.kind ?? 'all'); // نوع الفاتورة (tobacco / accommodation): إشغالات or فروقات
  const [search, setSearch] = useState(mem.search ?? (highlightCo || ''));
  const allPeriods = !!highlightCo; // a contract link (?co=…) lists that contract's invoices of every period
  const [page, setPage] = useState(mem.page ?? 0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES.includes(mem.pageSize) ? mem.pageSize : DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState(mem.sort ?? { key: 'issue', dir: 'desc' });
  useEffect(() => { writeListMemory('invoices', { collectionFilter, kind, search, page, pageSize, sort }); }, [collectionFilter, kind, search, page, pageSize, sort]);
  const debouncedSearch = useDebounced(search.trim(), 350);

  const local = useMemo(() => collectedLocal({ product: rev.scopeEff.product }), [rev.scopeEff.product]);
  const localValues = useMemo(() => ({ collection: collectionFilter, kind }), [collectionFilter, kind]);
  const onLocalChange = (patch) => { if ('collection' in patch) setCollectionFilter(patch.collection); if ('kind' in patch) setKind(patch.kind); };

  // any filter change returns to the first page
  const filterKey = JSON.stringify([collectionFilter, kind, debouncedSearch, srcParam, filterMode, sort, pageSize, rev.currentScopeKey, rev.dataVersion]);
  const lastKey = useRef(filterKey);
  useEffect(() => { if (lastKey.current !== filterKey) { lastKey.current = filterKey; setPage(0); } }, [filterKey]);

  const request = useMemo(() => {
    const sc = rev.scopeEff;
    // the shared scope bar (period, Amanah, REVENUE SOURCE, municipality) plus this page's own collection-state, revenue-item and age filters. A bar of the chart sets the SAME shared source filter as the toolbar
    const scope = { from: sc.from, to: sc.to, amanah: sc.amanah, source: srcParam || sc.source, status: 'all', scopeType: sc.scopeType, product: sc.product, mainClass: sc.mainClass, muni: sc.muni, item: 'all' };
    const filters = collectedListFilters({ search: debouncedSearch, collection: collectionFilter, kind, product: sc.product, allPeriods, problem: filterMode === 'problem' });
    return { scope, filters };
  }, [rev.scopeEff, srcParam, debouncedSearch, collectionFilter, kind, allPeriods, filterMode]);

  const { data: res, loading, error } = useAsync(() => rev.data.list(request.scope, { filters: request.filters, page, pageSize, sort, facets: FACETS }), [rev.data, request, page, pageSize, sort]);
  const rows = res?.rows || [];
  const total = res?.total ?? 0;
  const kpi = res ? collectedKpis(res) : null;
  const facets = res?.facets || null;

  const openRecord = useOpenRecord(); // a row opens the invoice's own full page; «back» returns here with everything as it was
  const openDetail = useCallback((row) => openRecord(invoicePath(row.id)), [openRecord]);
  useRestoreScroll(rows.length > 0 && !loading);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'id' ? 'asc' : 'desc' }));
  const sortValue = (v) => { const [key, dir] = v.split(':'); setSort({ key, dir }); };
  const exportGateX = useExportGate(request.filters);
  const exportHref = rev.data.exportUrl(request.scope, { filters: request.filters, sort });

  // F-13: a drill-down link such as /invoices?src=fines writes the source into the SHARED filter (visible in the scope bar and used by the KPI strip), then drops the hidden URL parameter
  useEffect(() => { if (amanahParam) { rev.setAmanah(amanahParam); if (muniParam) rev.setMuni(muniParam); setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('amanah'); n.delete('muni'); return n; }, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (srcParam) { rev.setSource(srcParam); setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('src'); return n; }, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const clearLocal = () => {
    setCollectionFilter('all'); setKind('all'); setSearch('');
    if (srcParam || filterMode || highlightCo) setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('src'); n.delete('filter'); n.delete('co'); return n; });
  };
  const clearAll = () => { rev.resetScope(); clearLocal(); }; // the no-results reset: the same as «مسح الفلاتر» of the toolbar
  const dropContract = () => { setSearch(''); setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('co'); return n; }); };
  // the chart selection IS the shared revenue-source filter (one state, one chip in the toolbar — never a second copy)
  const srcSel = typeof rev.scopeEff.source === 'string' && rev.scopeEff.source !== 'all' ? rev.scopeEff.source : null;
  const pickSource = (key) => rev.setSource(toggleKey(srcSel, key) || 'all');
  // a contract link lists that contract's invoices of EVERY period: the period control would otherwise state a range that is not applied
  const extraChips = [
    ...(allPeriods ? [{ key: 'co', label: L('Contract', 'العقد'), value: L(`${highlightCo} — all periods`, `${highlightCo} — كل الفترات`), onRemove: dropContract }] : []),
  ];
  const filtered = narrowing({ scopeActive: !scopeIsDefault(rev.scope, rev.cfg.cutoff), local, values: localValues, search: debouncedSearch, extra: (filterMode ? 1 : 0) + (allPeriods ? 1 : 0) });

  if (idParam) return <Navigate to={invoicePath(idParam)} replace />; // the old «?id=» address of the former drawer

  const kpiItems = [
    { key: 'n', label: L('Collected invoices', 'عدد الفواتير المحصّلة'), value: kpi ? nf(kpi.count) : null, sub: L('invoices with money collected', 'فواتير حُصّل منها مبلغ'), tone: 'collected' },
    { key: 'amt', label: L('Collected amount', 'المبلغ المحصّل'), value: kpi ? short(kpi.amount) : null, title: kpi ? sar(kpi.amount) : undefined, sub: L('collected on these invoices', 'المحصّل على هذه الفواتير'), tone: 'collected' },
    { key: 'full', label: L('Fully paid', 'مسدّدة بالكامل'), value: kpi ? nf(kpi.fully) : null, sub: L('invoices collected in full', 'فواتير حُصّلت كاملة') },
    { key: 'part', label: L('Partly paid', 'مسدّدة جزئياً'), value: kpi ? nf(kpi.partly) : null, sub: L('collected in part — included in the register', 'حُصّل جزء منها — مشمولة في السجل') }
  ];
  const valueTitle = L('Collected', 'المحصّل');

  return (
    <div className="il-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('invoices')}</h1>
          <div className="page-sub">{L('Invoices with money collected, in full or in part — filtered, ranked and opened one by one.', 'الفواتير التي حُصّل منها مبلغ، كلياً أو جزئياً — للتصفية والترتيب وفتح كل فاتورة على حدة.')}</div>
        </div>
      </div>

      <ScopeFilters {...FILTER_PAGES.collected} local={{ ...local, values: localValues, onChange: onLocalChange }} extraChips={extraChips} onClearLocal={clearLocal} onChange={() => setPage(0)}
        search={{ value: search, onChange: setSearch, label: { ar: 'بحث', en: 'Search' }, placeholder: { ar: 'فاتورة، سداد، اشتراك، مخالفة، سجل تجاري، دافع أو عقد', en: 'Invoice, SADAD, subscription, violation, CR, payer or contract' } }}
        resultCount={<span className="muted">{L(COLLECTED_WORDS.periodBasis.en, COLLECTED_WORDS.periodBasis.ar)}</span>} />

      <KpiStrip items={kpiItems} loading={loading} label={L('Figures of the collected register shown below', 'أرقام سجل المحصّل المعروض أدناه')} />
      <p className="il-regnote muted">{L(COLLECTED_WORDS.registerNote.en, COLLECTED_WORDS.registerNote.ar)}</p>

      <div className="il-viz il-viz--rate">
        <RankedBars id="source" dim="source" title={L('Collected by revenue source', 'المحصّل حسب مصدر الإيراد')} valueTitle={valueTitle}
          caption={L('Revenue source = the type of revenue (investment, fines, fees …) — not the supplying system. Click a bar to filter the list.', 'مصدر الإيراد = نوع الإيراد (استثمار، غرامات، رسوم …) — وليس النظام المُورِّد. اضغط شريطاً لتصفية القائمة.')}
          items={facets?.source} measure="collected" role="collected" chartView={chartView} onChartView={onChartView} selectedKey={srcSel} onSelect={pickSource} onReset={() => rev.setSource('all')} loading={loading} shareLabel={L('of collected', 'من المحصّل')} />
        <CollectionRateCard totals={rev.snapshot?.totals} loading={!rev.snapshot} />
      </div>

      <div className="card card-pad il-listcard">
        {filterMode === 'problem' && (
          <div className="card il-problem">
            <span style={{ fontSize: 13, fontWeight: 700 }}>{t('inv_filter_problem_title')}</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('filter'); return n; })}>{t('inv_filter_clear')} ×</button>
          </div>
        )}
        {error && <div className="rv-callout rv-callout--bad" role="alert">{L('The data service could not load this page.', 'تعذّر على خدمة البيانات تحميل هذه الصفحة.')} {String(error.message || '')}</div>}
        {!error && (
          <ListTools
            heading={loading && !res ? <span className="muted">{L('Loading…', 'جارٍ التحميل…')}</span> : <b>{L(`${nf(total)} collected invoices`, `${nf(total)} فاتورة محصّلة`)}</b>}
            sub={res && total > 0 ? L('Amounts are full SAR.', 'المبالغ بالريال كاملة.') : null}
            sortOptions={SORT_OPTIONS} sort={sort} onSortValue={sortValue} pageSize={pageSize} onPageSize={setPageSize} exportHref={exportHref} exportDenied={exportGateX.allowed ? null : exportGateX.reason} total={total} loading={loading} />
        )}
        {!loading && !error && total === 0 && filtered
          ? <NoResults lang={lang} title={L('No collected invoices match these filters', 'لا توجد فواتير محصّلة مطابقة لهذه التصفية')} hint={L('The list was not widened. Clear the filters to see every collected invoice of the default period.', 'لم تُوسَّع القائمة. امسح الفلاتر لعرض كل الفواتير المحصّلة في الفترة الافتراضية.')} onReset={clearAll} />
          : <InvoiceListTable mode="collected" ariaLabel={L('Collected invoices', 'الفواتير المحصّلة')} rows={rows} loading={loading} sort={sort} onSort={toggleSort} onOpen={openDetail} highlightId={idParam} />}
        <Pager page={page} total={total} size={pageSize} onPage={setPage} />
      </div>
    </div>
  );
}
