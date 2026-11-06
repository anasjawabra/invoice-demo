import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useExportGate } from '../components/access/ExportLink';
import { useAsync } from '../utils/useAsync';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RecordLink as Link, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll, useOpenRecord } from '../utils/returnContext';
import { invoicePath } from '../utils/paths';
import { useRevenue } from '../context/RevenueContext';
import { useI18n } from '../context/I18nContext';
import { useL } from '../utils/bi';
import ScopeFilters from '../components/filters/ScopeFilters';
import NoResults from '../components/filters/NoResults';
import { FILTER_PAGES } from '../components/filters/filterConfig';
import { uncollectedLocal, uncollectedListFilters, categoryTarget, dueStatusFor, scopeIsDefault, narrowing } from '../components/filters/pageFilters';
import { planLineFromQuery, planLineText } from '../data/planningActionsView';
import InvoiceListTable from '../components/invoices/InvoiceListTable';
import RankedBars from '../components/invoices/RankedBars';
import { usePageChartView } from '../components/charts/usePageChartView';
import DueBar from '../components/invoices/DueBar';
import KpiStrip from '../components/invoices/KpiStrip';
import ListTools from '../components/invoices/ListTools';
import Pager from '../components/Pager';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, UNCOLLECTED_WORDS, dueLabel, selectionCount, uncollectedKpis } from '../components/invoices/listLogic';

// Uncollected invoices list (IIM-06 / IIM-07). Structure: title + description (primary action: analyse the reasons) → compact filters + search → the three populations of unpaid money
//   total unpaid (excluded included)  =  excluded unpaid  +  net unpaid after approved exclusions
// → two visuals over the NET unpaid (by revenue source or product · due position) → the table (count · sort · pagination · export of ALL filtered rows).
// The list is rev.data.list with state «uncollected» (every uncollected invoice — the excluded ones too, with a separate badge); partly collected invoices stay (their status is on the invoice).
// The due position control of the toolbar is the shared scope status; the due-position bar is a chart selection (filters.dueState) that narrows the same list.
const FACETS = ['source', 'due']; // unpaid by REVENUE SOURCE + due position (no product breakdown)
const SORT_OPTIONS = [
  { value: 'priority:desc', ar: 'الأولوية: الأعلى أولاً', en: 'Priority: highest first' }, { value: 'uncollected:desc', ar: 'غير المحصّل: الأعلى أولاً', en: 'Unpaid: highest first' }, { value: 'uncollected:asc', ar: 'غير المحصّل: الأقل أولاً', en: 'Unpaid: lowest first' },
  { value: 'daysOverdue:desc', ar: 'أيام التأخر: الأكثر أولاً', en: 'Days overdue: most first' }, { value: 'issue:desc', ar: 'الأحدث إصداراً', en: 'Newest issued' }, { value: 'id:asc', ar: 'رقم الفاتورة', en: 'Invoice number' }
];
function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h); }, [value, ms]);
  return v;
}

export default function Collection() {
  const rev = useRevenue();
  const [chartView, onChartView] = usePageChartView('collection');
  const nav = useNavigate();
  const { lang } = useI18n();
  const { L, ar, short, count, sar } = useL();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory('collection', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [searchParams, setSearchParams] = useSearchParams();
  const legacy = useMemo(() => categoryTarget(searchParams.get('category')), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [processStatus, setProcessStatus] = useState(legacy.processStatus || mem.processStatus || 'all');
  // a drill from the planning page («أين نركز») carries ONE action line: ?planLine=B,C[&planBlocker=…] + the whole stock scope (from 2000-01-01); it is shown as a removable chip and sent as filters.planLine
  const [planLine, setPlanLine] = useState(() => planLineFromQuery((k) => searchParams.get(k)) || mem.planLine || null);
  // a link from the Decision Room (?amanah=…&src=…&category=…) sets the SHARED filter and the status chip, then drops the parameters
  React.useEffect(() => {
    const a = searchParams.get('amanah'); const s = searchParams.get('src'); const f = searchParams.get('from'); const t = searchParams.get('to'); const mu = searchParams.get('muni'); if (!a && !s && !f && !mu && !searchParams.get('category') && !searchParams.get('planLine')) return;
    if (f && t) rev.setCustomRange(f, t); // the period of the report the link comes from
    rev.setAmanah(a || 'all'); if (mu && a) rev.setMuni(mu); rev.setSource(s || 'all'); // the municipality (a stable filter key) travels with its Amanah; an invalid one is reset visibly by the shared scope // a link from a report states its whole scope: a missing part means «all»
    setSearchParams((p) => { const n = new URLSearchParams(p); ['amanah', 'src', 'category', 'from', 'to', 'muni', 'planLine', 'planBlocker', 'allPeriods'].forEach((k) => n.delete(k)); return n; }, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [reason, setReason] = useState(mem.reason ?? 'all'); // all · none (not excluded) · a rule id
  const [kind, setKind] = useState(mem.kind ?? 'all'); // نوع الفاتورة (tobacco / accommodation)
  const [payStatus, setPayStatus] = useState(mem.payStatus ?? 'all'); // the PAYMENT status (engine payStatus), independent of any exclusion
  const [exec, setExec] = useState(mem.exec ?? 'all'); // the enforcement dimension (confirmed links)
  const [search, setSearch] = useState(mem.search ?? '');
  const [sel, setSel] = useState(mem.sel ?? {}); // chart selection: { dueState } (the revenue-source selection IS the shared scope source: one state, one control)
  const [page, setPage] = useState(mem.page ?? 0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES.includes(mem.pageSize) ? mem.pageSize : DEFAULT_PAGE_SIZE);
  const [sort, setSort] = useState(mem.sort ?? { key: 'priority', dir: 'desc' });
  // the due position lives in the shared scope while this list is open (the KPIs, the list and the analysis read it); it is not carried to other pages, and a return from an invoice restores it
  React.useEffect(() => {
    rev.setStatus(legacy.status || (restore ? dueStatusFor(mem.status) : dueStatusFor(rev.scope.status))); // an explicit ?category= link wins over the remembered state
    return () => rev.setStatus('all');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { writeListMemory('collection', { processStatus, reason, kind, payStatus, exec, search, sel, page, pageSize, sort, status: rev.scope.status, planLine }); }, [processStatus, reason, kind, payStatus, exec, search, sel, page, pageSize, sort, rev.scope.status, planLine]);
  const debouncedSearch = useDebounced(search.trim(), 350);
  const scopeReq = useMemo(() => ({ from: rev.scopeEff.from, to: rev.scopeEff.to, amanah: rev.scopeEff.amanah, source: rev.scopeEff.source, scopeType: rev.scopeEff.scopeType, muni: rev.scopeEff.muni, status: rev.scopeEff.status, product: rev.scopeEff.product, mainClass: rev.scopeEff.mainClass }), [rev.scopeEff]);
  const filterKey = JSON.stringify([processStatus, reason, kind, payStatus, exec, debouncedSearch, sel, sort, pageSize, rev.currentScopeKey, rev.dataVersion, planLine]);
  const lastKey = useRef(filterKey);
  useEffect(() => { if (lastKey.current !== filterKey) { lastKey.current = filterKey; setPage(0); } }, [filterKey]);

  const filters = useMemo(() => uncollectedListFilters({ search: debouncedSearch, reason, processStatus, payStatus, exec, kind, product: rev.scopeEff.product, sel, planLine }), [debouncedSearch, reason, processStatus, payStatus, exec, kind, rev.scopeEff.product, sel, planLine]);
  // the service ranks and pages the whole population (real pagination — no «top 100»)
  const { data: res, loading, error } = useAsync(() => rev.data.list(scopeReq, { filters, page, pageSize, sort, withPriority: true, facets: FACETS }), [rev.data, scopeReq, filters, page, pageSize, sort]);
  const rows = res?.rows || [];
  const total = res?.total ?? 0;
  const kpi = res ? uncollectedKpis(res) : null;
  const facets = res?.facets || null;
  const stats = rev.snapshot.ruleStats || {};
  useRestoreScroll(rows.length > 0 && !loading);

  const openRecord = useOpenRecord();
  const openDetail = useCallback((row) => openRecord(invoicePath(row.id)), [openRecord]);
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'id' ? 'asc' : 'desc' }));
  const sortValue = (v) => { const [key, dir] = v.split(':'); setSort({ key, dir }); };
  const exportGateX = useExportGate(filters);
  const exportHref = rev.data.exportUrl(scopeReq, { filters, sort });

  // the toolbar: Amanah · revenue source · due position | More: period, municipality, origin, classification + the page's own (reason, processing status, payment status, enforcement, invoice type)
  const local = useMemo(() => uncollectedLocal({ product: rev.scopeEff.product, reasonCount: (id) => (stats[id]?.primaryCount ? ` · ${count(stats[id].primaryCount)}` : '') }), [rev.scopeEff.product, stats, count]);
  const localValues = useMemo(() => ({ reason, processStatus, payStatus, exec, kind }), [reason, processStatus, payStatus, exec, kind]);
  const onLocalChange = (patch) => {
    if ('reason' in patch) setReason(patch.reason);
    if ('processStatus' in patch) setProcessStatus(patch.processStatus);
    if ('payStatus' in patch) setPayStatus(patch.payStatus);
    if ('exec' in patch) setExec(patch.exec);
    if ('kind' in patch) setKind(patch.kind);
  };
  const clearLocal = () => { setReason('all'); setProcessStatus('all'); setPayStatus('all'); setExec('all'); setKind('all'); setSearch(''); setSel({}); setPlanLine(null); };
  const clearAll = () => { rev.resetScope(); clearLocal(); };
  const dropSel = (dim) => () => setSel((s) => ({ ...s, [dim]: undefined }));
  const extraChips = [
    ...(planLine ? [{ key: 'plan-line', label: L('Planning line', 'سطر التخطيط'), value: planLineText(planLine, ar ? 'ar' : 'en'), onRemove: () => setPlanLine(null) }] : []),
    ...(sel.dueState ? [{ key: 'sel-due', label: L('Due position (chart)', 'موقف الاستحقاق (الرسم)'), value: dueLabel(sel.dueState, ar), onRemove: dropSel('dueState') }] : [])
  ];
  const filtered = narrowing({ scopeActive: !scopeIsDefault(rev.scope, rev.cfg.cutoff), local, values: localValues, search: debouncedSearch, extra: selectionCount(sel) + (planLine ? 1 : 0) });
  const srcSel = rev.scopeEff.source && rev.scopeEff.source !== 'all' && typeof rev.scopeEff.source === 'string' ? rev.scopeEff.source : null;

  const W = UNCOLLECTED_WORDS; const w = (o) => (ar ? o.ar : o.en);
  const kpiItems = [
    { key: 'total', label: w(W.total), value: kpi ? short(kpi.totalUnpaid) : null, title: kpi ? sar(kpi.totalUnpaid) : undefined, sub: kpi ? L(`${count(kpi.count)} invoices`, `${count(kpi.count)} فاتورة`) : null, def: w(W.totalDef) },
    { key: 'excl', label: w(W.excluded), value: kpi ? short(kpi.excludedUnpaid) : null, title: kpi ? sar(kpi.excludedUnpaid) : undefined, sub: kpi ? L(`${count(kpi.excludedCount)} invoices`, `${count(kpi.excludedCount)} فاتورة`) : null, def: w(W.excludedDef), action: { label: L('Open exclusions management', 'فتح إدارة الاستبعادات'), onClick: () => nav('/exclusions') } },
    { key: 'net', label: w(W.net), value: kpi ? short(kpi.netUnpaid) : null, title: kpi ? sar(kpi.netUnpaid) : undefined, sub: kpi ? L(`${count(kpi.openCount)} invoices`, `${count(kpi.openCount)} فاتورة`) : null, def: w(W.netDef), tone: 'unpaid' }
  ];
  const valueTitle = L('Net unpaid', 'صافي غير المحصّل');
  return (
    <div className="il-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Uncollected invoices list', 'قائمة الفواتير غير المحصّلة')}</h1>
          <div className="page-sub">{L('Every uncollected invoice — the excluded ones too, with the reason — with its priority, so the follow-up starts where it matters.', 'كل الفواتير غير المحصّلة — ومنها المستبعدة مع سببها — بأولوية كل فاتورة لتبدأ المتابعة من الأهم.')}</div>
        </div>
        <div className="il-head-act">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => rev.startAnalysis('noncollection', {}, { origin: 'collection' })}>{L('Analyze reasons for noncollection', 'تحليل أسباب عدم التحصيل')}</button>
          <Link className="il-head-link" to="/planning">{L('Collection goal', 'هدف التحصيل السنوي')} <span aria-hidden="true">{ar ? '←' : '→'}</span></Link>
        </div>
      </div>

      <ScopeFilters {...FILTER_PAGES.uncollected} local={{ ...local, values: localValues, onChange: onLocalChange }} extraChips={extraChips} onClearLocal={clearLocal} onChange={() => setPage(0)}
        search={{ value: search, onChange: setSearch, label: { ar: 'بحث', en: 'Search' }, placeholder: { ar: 'فاتورة، سداد، اشتراك، مخالفة، سجل تجاري أو دافع', en: 'Invoice, SADAD, subscription, violation, CR or payer' } }} />

      <KpiStrip items={kpiItems} loading={loading} label={L('The three populations of unpaid money', 'المجاميع الثلاثة لغير المحصّل')} />

      <div className="il-viz">
        <RankedBars id="source" dim="source" title={L('Unpaid by revenue source', 'غير المحصّل حسب مصدر الإيراد')} valueTitle={valueTitle}
          caption={L('Net unpaid after approved exclusions — excluded invoices are not counted here. Revenue source = the type of revenue, not the supplying system. Click a bar to filter the list.', 'صافي غير المحصّل بعد الاستبعاد المعتمد — الفواتير المستبعدة غير محسوبة هنا. مصدر الإيراد = نوع الإيراد وليس النظام المُورِّد. اضغط شريطاً لتصفية القائمة.')}
          items={facets?.source} measure="outstanding" role="uncollected" chartView={chartView} onChartView={onChartView} selectedKey={srcSel} onSelect={(k) => rev.setSource(srcSel === String(k) ? 'all' : String(k))} onReset={() => rev.setSource('all')} loading={loading} />
        <DueBar title={L('Due position of the net unpaid', 'موقف الاستحقاق لصافي غير المحصّل')} due={facets?.due} selected={sel.dueState ?? null} loading={loading}
          caption={L('The bar shows the net unpaid. Choosing a segment lists its invoices plus the excluded ones whose own due date gives the same position (“+N excluded”).', 'الشريط يمثل صافي غير المحصّل. واختيار قطعة يعرض فواتيرها مع الفواتير المستبعدة التي يعطيها تاريخ استحقاقها الموقف نفسه («+ن مستبعدة»).')}
          onSelect={(k) => setSel((s) => ({ ...s, dueState: k }))} onReset={dropSel('dueState')} />
      </div>

      <div className="card card-pad il-listcard" id="uncollected-list">
        {error && <div className="rv-callout rv-callout--bad" role="alert">{L('The data service could not load this page.', 'تعذّر على خدمة البيانات تحميل هذه الصفحة.')} {String(error.message || '')}</div>}
        {!error && (
          <ListTools
            heading={loading && !res ? <span className="muted">{L('Loading…', 'جارٍ التحميل…')}</span> : <b>{L(`${count(total)} uncollected invoices`, `${count(total)} فاتورة غير محصّلة`)}</b>}
            sub={kpi && total > 0 ? L(`${count(kpi.openCount)} open + ${count(kpi.excludedCount)} excluded`, `${count(kpi.openCount)} مفتوحة + ${count(kpi.excludedCount)} مستبعدة`) : null}
            sortOptions={SORT_OPTIONS} sort={sort} onSortValue={sortValue} pageSize={pageSize} onPageSize={setPageSize} exportHref={exportHref} exportDenied={exportGateX.allowed ? null : exportGateX.reason} total={total} loading={loading} />
        )}
        {!loading && !error && total === 0 && filtered
          ? <NoResults lang={lang} title={L('No uncollected invoices match these filters', 'لا توجد فواتير غير محصّلة مطابقة لهذه التصفية')} hint={L('The list was not widened. Clear the filters to see every uncollected invoice of the default period.', 'لم تُوسَّع القائمة. امسح الفلاتر لعرض كل الفواتير غير المحصّلة في الفترة الافتراضية.')} onReset={clearAll} />
          : <InvoiceListTable mode="uncollected" ariaLabel={L('Uncollected invoices', 'الفواتير غير المحصّلة')} rows={rows} loading={loading} sort={sort} onSort={toggleSort} onOpen={openDetail} />}
        <Pager page={page} total={total} size={pageSize} onPage={setPage} />
        <p className="muted il-foot">{L('Collected invoices never appear here. An excluded invoice shows its reason in the details; the exclusion applies to the uncollected part only and never changes the payment status.', 'لا تظهر هنا الفواتير المحصّلة. وتظهر المستبعدة وسببها في التفاصيل؛ والاستبعاد يخص الجزء غير المحصّل فقط ولا يغيّر حالة السداد.')}</p>
      </div>
    </div>
  );
}
