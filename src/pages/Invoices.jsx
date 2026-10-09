import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useRevenue } from '../context/RevenueContext';
import { NONCOLLECTION_CATEGORIES, CATEGORY_LABELS, EXCLUSION_RULES } from '../data/revenueMetrics';
import { pickBi } from '../data/revenueInsights';
import { ProvenanceBadge, ScopeBar, DefinitionButton } from '../components/revenue/RevenueUI';
import { useL, ratioText } from '../utils/bi';
import { amanahOptionsOf } from '../data/revenueLedger';
import { ITEMS, municipalitiesOf } from '../data/catalog';
import { AGING_BUCKETS } from '../data/assistantProtocol';
import { useAsync } from '../utils/useAsync';
import { legacyFromRow } from '../utils/legacyInvoice';
import { NODE_DRAWERS, RISK_ANALYSIS } from '../data/aiProcess';
import InvoiceDetailDrawer from '../components/ai/InvoiceDetailDrawer';
import AIProcessDrawer from '../components/ai/AIProcessDrawer';
import { fmtDateText } from '../data/clock';

const PAGE_SIZE = 50;
const SORTABLE = { id: 'id', issue: 'issue', gross: 'gross', outstanding: 'outstanding', age: 'daysOverdue' };

// Which agent node best represents each scenario's "full AI analysis".
const PRIMARY_AGENT = { normal: 'validation', fraud: 'anomaly', dup: 'dedup', taxfail: 'validation' };
function aiBundleForInvoice(inv) {
  if (RISK_ANALYSIS[inv.id]) return RISK_ANALYSIS[inv.id];
  const scenario = inv.tag || 'normal';
  const nodes = NODE_DRAWERS[scenario] || NODE_DRAWERS.normal;
  const agent = PRIMARY_AGENT[scenario] || 'validation';
  return nodes[agent] || nodes.ingest || nodes.validation || null;
}

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
  const [amanahFilter, setAmanahFilter] = useState(searchParams.get('amanah') || 'all');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [search, setSearch] = useState(highlightCo || '');
  const [scopeType, setScopeType] = useState('all');
  const [muniFilter, setMuniFilter] = useState('all');
  const [itemFilter, setItemFilter] = useState('all');
  const [exFilter, setExFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [execFilter, setExecFilter] = useState('all');
  const [allPeriods, setAllPeriods] = useState(!!(highlightCo || idParam));
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ key: 'issue', dir: 'desc' });
  const debouncedSearch = useDebounced(search.trim(), 350);

  const amanahOptions = useMemo(() => amanahOptionsOf().filter((a) => !rev.org.amanahKeys || rev.org.amanahKeys.includes(a.key)), [rev.org]);
  const amanahLabel = (o) => (lang === 'zh' ? o.zh : lang === 'ar' ? o.ar : o.en);
  const muniOptions = useMemo(() => (amanahFilter === 'all' ? [] : municipalitiesOf(amanahFilter)), [amanahFilter]);
  const activeFilterCount = [amanahFilter, collectionFilter, scopeType, muniFilter, itemFilter, exFilter, ageFilter, contractFilter, execFilter].filter((v) => v !== 'all').length + (debouncedSearch ? 1 : 0) + (srcParam ? 1 : 0) + (filterMode ? 1 : 0);

  // any filter change returns to the first page
  const filterKey = JSON.stringify([amanahFilter, collectionFilter, scopeType, muniFilter, itemFilter, exFilter, ageFilter, contractFilter, execFilter, allPeriods, debouncedSearch, srcParam, filterMode, sort, rev.currentScopeKey, rev.dataVersion]);
  const lastKey = useRef(filterKey);
  useEffect(() => { if (lastKey.current !== filterKey) { lastKey.current = filterKey; setPage(0); } }, [filterKey]);

  const request = useMemo(() => {
    const sc = rev.scopeEff;
    const scope = {
      from: sc.from, to: sc.to,
      amanah: amanahFilter !== 'all' ? amanahFilter : sc.amanah,
      source: srcParam || sc.source, status: sc.status,
      scopeType: scopeType !== 'all' ? scopeType : sc.scopeType, muni: muniFilter !== 'all' ? muniFilter : (amanahFilter === 'all' ? sc.muni : 'all'), item: itemFilter
    };
    const filters = { search: debouncedSearch, state: collectionFilter, rule: exFilter, age: ageFilter, contract: contractFilter, exec: execFilter, allPeriods, tag: filterMode === 'problem' ? 'problem' : undefined };
    return { scope, filters };
  }, [rev.scopeEff, amanahFilter, srcParam, scopeType, muniFilter, itemFilter, debouncedSearch, collectionFilter, exFilter, ageFilter, contractFilter, execFilter, allPeriods, filterMode]);

  const { data: res, loading, error } = useAsync(() => rev.data.list(request.scope, { filters: request.filters, page, pageSize: PAGE_SIZE, sort }), [rev.data, request, page, sort]);
  const rows = res?.rows || [];
  const total = res?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const sums = res?.sums || { gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 };

  const [detailId, setDetailId] = useState(idParam || null); // invoice shown in the detail drawer
  const [detailInv, setDetailInv] = useState(null);
  const [aiDrawer, setAiDrawer] = useState(null); // aiProcess bundle (stacked on top)
  const triggerRef = useRef(null);

  const openDetail = useCallback((row, e) => {
    triggerRef.current = e.currentTarget;
    setDetailInv(legacyFromRow(row));
    setDetailId(row.id);
  }, []);
  const closeDetail = useCallback(() => {
    setDetailId(null); setDetailInv(null); setAiDrawer(null);
    triggerRef.current?.focus?.();
  }, []);
  const openAi = useCallback(() => { if (detailInv) setAiDrawer(aiBundleForInvoice(detailInv)); else if (detailId) setAiDrawer(aiBundleForInvoice({ id: detailId, tag: 'normal' })); }, [detailInv, detailId]);
  const onRowKey = useCallback((row, e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); openDetail(row, e); }
  }, [openDetail]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'id' ? 'asc' : 'desc' }));
  const th = (label, key) => (
    <th aria-sort={sort.key === SORTABLE[key] ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="rv-link" style={{ font: 'inherit', fontWeight: 700 }} onClick={() => toggleSort(SORTABLE[key])}>{label}{sort.key === SORTABLE[key] ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
    </th>
  );
  const exportHref = rev.data.exportUrl(request.scope, { filters: request.filters, sort });

  const viewLabel = bi.L('View details', 'عرض التفاصيل');
  // F-13: a drill-down link such as /invoices?src=fines writes the source into the SHARED filter (visible in the scope bar and used by the KPI strip), then drops the hidden URL parameter
  useEffect(() => { if (srcParam) { rev.setSource(srcParam); setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('src'); return n; }, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const clearAll = () => {
    setAmanahFilter('all'); setCollectionFilter('all'); setSearch(''); setScopeType('all'); setMuniFilter('all'); setItemFilter('all'); setExFilter('all'); setAgeFilter('all'); setContractFilter('all'); setExecFilter('all');
    if (srcParam || filterMode) setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('src'); n.delete('filter'); return n; });
  };
  const selStyle = { height: 32, width: 'auto', paddingInline: 10, fontSize: 12.5 };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('invoices')}</h1>
          <div className="page-sub">{t('recent_sub')}</div>
        </div>
        <ProvenanceBadge kind="demo" />
      </div>

      <ScopeBar />

      <div className="rv-tiles" aria-label={bi.L('Indicators for the scope above', 'مؤشرات النطاق أعلاه')}>
        <div className="rv-tile"><div className="rv-tile__label"><span>{bi.L('Gross billed', 'إجمالي المفوتر')}</span><DefinitionButton metric="gross" /></div><div className="rv-tile__value" dir="ltr" title={bi.sar(rev.snapshot.totals.gross)}>{bi.short(rev.snapshot.totals.gross)}</div><div className="rv-tile__sub">{bi.invoices(rev.snapshot.totals.count)}</div></div>
        <div className="rv-tile"><div className="rv-tile__label"><span>{bi.L('Net billed', 'صافي المفوتر')}</span><DefinitionButton metric="net" /></div><div className="rv-tile__value" dir="ltr" title={bi.sar(rev.snapshot.totals.net)}>{bi.short(rev.snapshot.totals.net)}</div></div>
        <div className="rv-tile"><div className="rv-tile__label"><span>{bi.L('Net uncollected', 'الرصيد القائم')}</span><DefinitionButton metric="netUncollected" /></div><div className="rv-tile__value" dir="ltr" title={bi.sar(rev.snapshot.stock.netUncollected)}>{bi.short(rev.snapshot.stock.netUncollected)}</div></div>
        <div className="rv-tile"><div className="rv-tile__label"><span>{bi.L('Collected ÷ net billed', 'المحصّل ÷ صافي المفوتر')}</span><DefinitionButton metric="collectedOverNet" /></div><div className="rv-tile__value" dir="ltr">{ratioText(rev.snapshot.totals.collectedOverNet, bi.ar)}</div></div>
      </div>

      <div className="card card-pad" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }} role="search" aria-label={bi.L('Invoice filters', 'مرشحات الفواتير')}>
        <input id="inv_search" className="input" style={{ flex: '1 1 220px', height: 32, minWidth: 180 }} placeholder={bi.L('Invoice, SADAD, subscription, violation, CR, payer or contract', 'فاتورة أو سداد أو اشتراك أو مخالفة أو سجل تجاري أو دافع أو عقد')} aria-label={bi.L('Search', 'بحث')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select id="f_scope" className="select" aria-label={bi.L('Central / internal', 'مركزي / داخلي')} style={selStyle} value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
          <option value="all">{bi.L('Central & internal', 'المركزي والداخلي')}</option><option value="central">{bi.L('Central', 'مركزي')}</option><option value="internal">{bi.L('Internal', 'داخلي')}</option>
        </select>
        <select id="f_amanah" className="select" aria-label={bi.L('Amanah', 'الأمانة')} style={{ ...selStyle, minWidth: 170 }} value={amanahFilter} onChange={(e) => { setAmanahFilter(e.target.value); setMuniFilter('all'); }}>
          <option value="all">{t('inv_filter_amanah_all')}</option>
          {amanahOptions.map((o) => (<option key={o.key} value={o.key}>{amanahLabel(o)}</option>))}
        </select>
        <select id="f_muni" className="select" aria-label={bi.L('Municipality', 'البلدية')} style={{ ...selStyle, minWidth: 150 }} value={muniFilter} onChange={(e) => setMuniFilter(e.target.value)} disabled={amanahFilter === 'all'}>
          <option value="all">{bi.L('All municipalities', 'كل البلديات')}</option>
          {muniOptions.map((m) => (<option key={m.key} value={m.key}>{lang === 'ar' ? m.ar : m.en}</option>))}
        </select>
        <select id="f_item" className="select" aria-label={bi.L('Revenue item', 'بند الإيراد')} style={{ ...selStyle, minWidth: 150 }} value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
          <option value="all">{bi.L('All revenue items', 'كل بنود الإيراد')}</option>
          {ITEMS.map((i) => (<option key={i.key} value={i.key}>{bi.ar ? i.ar : i.en}</option>))}
        </select>
        <select id="f_state" className="select" aria-label={bi.L('Collection state', 'حالة التحصيل')} style={{ ...selStyle, minWidth: 180 }} value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)}>
          <option value="all">{t('inv_filter_status_all')}</option>
          <option value="open">{bi.L('Any outstanding balance', 'أي رصيد متبقٍ')}</option>
          <option value="collected">{bi.L('Collected', 'محصّلة')}</option>
          {NONCOLLECTION_CATEGORIES.map((k) => (<option key={k} value={k}>{pickBi(CATEGORY_LABELS[k], lang)}</option>))}
        </select>
        <select id="f_excl" className="select" aria-label={bi.L('Exclusion reason', 'سبب الاستبعاد')} style={{ ...selStyle, minWidth: 150 }} value={exFilter} onChange={(e) => setExFilter(e.target.value)}>
          <option value="all">{bi.L('Any exclusion reason', 'أي سبب استبعاد')}</option><option value="none">{bi.L('No exclusion record', 'بلا سجل استبعاد')}</option>
          {EXCLUSION_RULES.filter((r) => !r.locked).map((r) => (<option key={r.id} value={r.id}>{r.id} · {bi.B(r.label)}</option>))}
        </select>
        <select id="f_age" className="select" aria-label={bi.L('Age', 'العمر')} style={selStyle} value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}>
          <option value="all">{bi.L('Any age (from due date)', 'أي عمر (من الاستحقاق)')}</option>
          {AGING_BUCKETS.map((b) => (<option key={b.key} value={b.key}>{bi.B(b.label)}</option>))}
        </select>
        <select id="f_contract" className="select" aria-label={bi.L('Contract', 'العقد')} style={selStyle} value={contractFilter} onChange={(e) => setContractFilter(e.target.value)}>
          <option value="all">{bi.L('Any contract state', 'أي حالة عقد')}</option><option value="linked">{bi.L('Contract linked', 'عقد مرتبط')}</option><option value="unmatched">{bi.L('Contract not matched', 'لم تتم مطابقة العقد')}</option><option value="confirmed_none">{bi.L('No contract (confirmed)', 'بدون عقد (مؤكد)')}</option><option value="not_applicable">{bi.L('Not a contract invoice', 'ليست فاتورة عقد')}</option>
        </select>
        <select id="f_exec" className="select" aria-label={bi.L('Execution', 'التنفيذ')} style={selStyle} value={execFilter} onChange={(e) => setExecFilter(e.target.value)}>
          <option value="all">{bi.L('Execution: any', 'التنفيذ: أي')}</option><option value="yes">{bi.L('With execution', 'بتنفيذ')}</option><option value="no">{bi.L('No execution recorded', 'دون تنفيذ مسجل')}</option>
        </select>
        <label className="rv-inline"><input type="checkbox" checked={allPeriods} onChange={(e) => setAllPeriods(e.target.checked)} /> {bi.L('Ignore the period above', 'تجاهل الفترة أعلاه')}</label>
        {activeFilterCount > 0 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={clearAll}>{t('inv_filter_clear')} ({activeFilterCount}) ×</button>
        )}
        <a className="btn btn-sm" href={exportHref} download>{bi.L('Export CSV', 'تصدير CSV')}</a>
      </div>

      <div className="grid grid-3" role="group" aria-label={bi.L('Totals of the matching invoices', 'إجماليات الفواتير المطابقة')}>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr">{loading && !res ? '…' : bi.count(total)}</div>
          <div className="kpi__label">{bi.L('Invoices matching the filters', 'فواتير مطابقة للمرشحات')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" title={bi.sar(sums.gross)}>{bi.short(sums.gross)}</div>
          <div className="kpi__label">{bi.L('Gross billed (before exclusions)', 'إجمالي المفوتر (قبل الاستبعادات)')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" title={bi.sar(sums.exclusions)}>{bi.short(sums.exclusions)}</div>
          <div className="kpi__label">{bi.L('Exclusions (deducted once)', 'الاستبعادات (تُخصم مرة واحدة)')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" title={bi.sar(sums.net)}>{bi.short(sums.net)}</div>
          <div className="kpi__label">{bi.L('Net billed = gross − exclusions', 'صافي المفوتر = الإجمالي − الاستبعادات')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" title={bi.sar(sums.collected)}>{bi.short(sums.collected)}</div>
          <div className="kpi__label">{bi.L('Collected (within net billed)', 'المحصّل (ضمن صافي المفوتر)')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" title={bi.sar(sums.outstanding)}>{bi.short(sums.outstanding)}</div>
          <div className="kpi__label">{bi.L('Uncollected = net − collected', 'غير المحصّل = الصافي − المحصّل')} · {bi.L('collection rate', 'نسبة التحصيل')} {sums.net > 0 ? `${(Math.round((sums.collected / sums.net) * 1000) / 10).toFixed(1)}%` : bi.L('Not available', 'غير متاحة')}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>{t('inv_makeen_note')} {bi.L('Amounts in this table are full SAR; cards above show one appropriate unit per amount.', 'المبالغ في هذا الجدول بالريال كاملة؛ والبطاقات أعلاه بوحدة واحدة مناسبة لكل مبلغ.')}</div>
        {filterMode === 'problem' && (
          <div className="card" style={{ padding: '8px 12px', marginBottom: 10, background: 'rgba(175, 8, 24, 0.06)', border: '1px solid rgba(175, 8, 24, 0.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t('inv_filter_problem_title')}</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('filter'); return n; })}>{t('inv_filter_clear')} ×</button>
          </div>
        )}
        {error && <div className="rv-callout rv-callout--bad" role="alert">{bi.L('The data service could not load this page.', 'تعذّر على خدمة البيانات تحميل هذه الصفحة.')} {String(error.message || '')}</div>}
        <div className="table-wrap" aria-busy={loading}>
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
                <th aria-label={viewLabel} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="row-clickable"
                  tabIndex={0}
                  role="button"
                  aria-label={`${viewLabel} · ${r.id}`}
                  onClick={(e) => openDetail(r, e)}
                  onKeyDown={(e) => onRowKey(r, e)}
                  style={idParam === r.id ? { background: 'rgba(0, 128, 255, 0.08)' } : undefined}
                >
                  <td style={{ fontWeight: 900 }} dir="ltr">{r.id}{r.uploaded ? <span className="rv-tag" style={{ marginInlineStart: 6 }}>{lang === 'ar' ? 'مرفوع' : 'uploaded'}</span> : null}</td>
                  <td>{lang === 'ar' ? r.payerAr : r.payerEn}</td>
                  <td>{lang === 'zh' ? r.amanahZh : lang === 'ar' ? r.amanahAr : r.amanahEn}{r.municipalityEn && <div className="muted" style={{ fontSize: 11 }}>{lang === 'ar' ? r.municipalityAr : r.municipalityEn} · {r.scopeType === 'internal' ? bi.L('internal', 'داخلي') : bi.L('central', 'مركزي')}</div>}</td>
                  <td>{bi.ar ? r.itemAr : r.itemEn}</td>
                  <td style={{ fontSize: 11.5 }}>{r.statusRawTahseel || '—'}{r.statusRawEfaa && r.statusRawEfaa !== r.statusRawTahseel && <div className="muted">{bi.L('Efaa', 'إيفاء')}: {r.statusRawEfaa}</div>}</td>
                  <td>
                    <span className={`rv-cat rv-cat--${r.cls}`}>{r.cls === 'collected' ? (lang === 'ar' ? 'محصّلة' : 'Collected') : pickBi(CATEGORY_LABELS[r.cls], lang)}</span>
                    {r.tags.includes('amount_conflict') && <span className="rv-tag rv-tag--bad" style={{ marginInlineStart: 4 }}>{lang === 'ar' ? 'تعارض مبلغ' : 'amount conflict'}</span>}
                    {r.tags.includes('contract_unmatched') && <span className="rv-tag rv-tag--warn" style={{ marginInlineStart: 4 }}>{lang === 'ar' ? 'عقد غير مطابق' : 'contract not matched'}</span>}
                    {r.tags.includes('exclusion_pending') && <span className="rv-tag" style={{ marginInlineStart: 4 }}>{lang === 'ar' ? 'استبعاد قيد المراجعة' : 'exclusion pending'}</span>}
                  </td>
                  <td dir="ltr">{bi.sar(r.gross)}{r.exclusions > 0 && <div className="muted" style={{ fontSize: 11 }}>{bi.L('excl.', 'استبعاد')} {bi.sar(r.exclusions)} · {bi.L('net', 'صافي')} {bi.sar(r.net)}</div>}</td>
                  <td dir="ltr">{bi.sar(r.outstanding)}{r.collected > 0 && <div className="muted" style={{ fontSize: 11 }}>{bi.L('collected', 'محصّل')} {bi.sar(r.collected)}</div>}</td>
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

      <InvoiceDetailDrawer
        inv={detailInv}
        invoiceId={detailId}
        open={!!detailId}
        onClose={closeDetail}
        onOpenAI={openAi}
        suppressClose={!!aiDrawer}
      />
      <AIProcessDrawer open={!!aiDrawer} onClose={() => setAiDrawer(null)} data={aiDrawer} />
    </div>
  );
}
