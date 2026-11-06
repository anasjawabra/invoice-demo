import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../utils/useAsync';
import { RecordLink as Link, useOpenRecord, readListMemory, writeListMemory, useShouldRestore, useRestoreScroll } from '../utils/returnContext';
import { invoicePath } from '../utils/paths';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import ScopeFilters from '../components/filters/ScopeFilters';
import NoResults from '../components/filters/NoResults';
import ExportLink from '../components/access/ExportLink';
import useClearStatusOnEnter from '../components/filters/useClearStatusOnEnter';
import { FILTER_PAGES } from '../components/filters/filterConfig';
import { exclusionsLocal, exclusionsFilters, scopeIsDefault, narrowing } from '../components/filters/pageFilters';
import { kpiOf } from '../data/kpis';
import { ruleById } from '../data/revenueMetrics';
import { EXCLUSION_REASONS, EXCLUSION_SOURCE_OF_RULE } from '../data/iim';
import ExclusionUpload from '../components/revenue/ExclusionUpload';
import InvoiceListTable from '../components/invoices/InvoiceListTable';
import Pager from '../components/Pager';
import PageChart from '../components/charts/PageChart';
import { usePageChartView } from '../components/charts/usePageChartView';
import { exclusionsReasonChart, reasonOrder } from '../data/exclusionsChart';
import KpiStrip from '../components/invoices/KpiStrip';

// إدارة الاستبعادات (IIM-23) — the exclusion register.
//   1. the upload of the Amanah exclusion file (the channel of R8 / R9) comes first,
//   2. a compact summary by reason (count · excluded amount; the rule and its source are one click away),
//   2b. beside it ONE chart of the same figures (excluded amount by effective reason) with the shared chart picker; a bar selects the reason like «View» does,
//   3. the excluded invoices in THE shared invoice list (the same table as the collected-invoice register), filtered by the selected reason.
// An invoice is ONE row and is counted under its effective (primary) reason, so the reasons add up to the total excluded; further reasons are information on that row.
// The figures come from the same KPI module as every other screen; the list from the same data service as the invoice register (filter «primary»).
const PAGE_SIZE = 25;
const PRECEDENCE = [...EXCLUSION_REASONS].sort((a, b) => (ruleById(a.ruleId)?.priority ?? 99) - (ruleById(b.ruleId)?.priority ?? 99));

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h); }, [value, ms]);
  return v;
}

export default function Exclusions() {
  const rev = useRevenue(); const { snapshot } = rev;
  useClearStatusOnEnter(rev);
  const { L, ar, short, count, sar, parts } = useL();
  const [sp, setSp] = useSearchParams();
  const restore = useShouldRestore(); const mem = useMemo(() => readListMemory('exclusions', restore) || {}, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [reason, setReason] = useState(sp.get('reason') || mem.reason || 'all');
  const [search, setSearch] = useState(mem.search || '');
  const [page, setPage] = useState(mem.page ?? 0);
  const [sort, setSort] = useState(mem.sort || { key: 'exclusionAmount', dir: 'desc' });
  const [pay, setPay] = useState(mem.pay || 'all'); // the PAYMENT status filter (an exclusion is not a payment status)
  const [open, setOpen] = useState(null); // the reason whose rule / source is expanded
  const headRef = useRef(null);
  useEffect(() => { writeListMemory('exclusions', { reason, search, page, sort, pay }); }, [reason, search, page, sort, pay]);
  useEffect(() => { if (sp.get('reason')) setSp((p) => { const n = new URLSearchParams(p); n.delete('reason'); return n; }, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const debouncedSearch = useDebounced(search.trim(), 350);

  const T = snapshot.totals; const K = kpiOf(T); const stats = snapshot.ruleStats || {};
  const rows = useMemo(() => EXCLUSION_REASONS.map((r) => ({ ...r, count: stats[r.ruleId]?.primaryCount || 0, amount: stats[r.ruleId]?.primaryAmount || 0, source: EXCLUSION_SOURCE_OF_RULE[r.ruleId] })), [stats]);
  const sum = rows.reduce((t, r) => t + r.amount, 0); const sumN = rows.reduce((t, r) => t + r.count, 0);
  const ranked = useMemo(() => [...rows].sort(reasonOrder), [rows]); // by excluded amount — the SAME order as the chart
  const withCount = ranked.filter((r) => r.count > 0);
  const visible = ranked.filter((r) => r.count > 0 || r.ruleId === reason); // ALL the reasons that have invoices (a selected reason is never hidden); reasons with no invoices are counted in one quiet line
  const noInvoices = ranked.length - ranked.filter((r) => r.count > 0).length;
  const [chartView, onChartView] = usePageChartView('exclusions');
  const reasonChart = useMemo(() => exclusionsReasonChart(rows, ar ? 'ar' : 'en'), [rows, ar]);
  const share = K.uncollectedTotal > 0 ? K.excluded / K.uncollectedTotal : null;
  const label = (id) => { const r = EXCLUSION_REASONS.find((x) => x.ruleId === id); return r ? (ar ? r.ar : r.en) : ''; };

  // any change of filter returns to the first page
  const filterKey = JSON.stringify([reason, debouncedSearch, pay, sort, rev.currentScopeKey, rev.dataVersion]);
  const lastKey = useRef(filterKey);
  useEffect(() => { if (lastKey.current !== filterKey) { lastKey.current = filterKey; setPage(0); } }, [filterKey]);

  // the SAME request shape as the invoice register: the shared scope bar + this page's own filters (the effective reason and the search)
  const request = useMemo(() => {
    const sc = rev.scopeEff;
    const scope = { from: sc.from, to: sc.to, amanah: sc.amanah, source: sc.source, status: 'all', scopeType: sc.scopeType, product: sc.product, mainClass: sc.mainClass, muni: sc.muni, item: 'all' };
    const filters = exclusionsFilters({ search: debouncedSearch, reason, pay });
    return { scope, filters };
  }, [rev.scopeEff, debouncedSearch, reason, pay]);
  const { data: res, loading, error } = useAsync(() => rev.data.list(request.scope, { filters: request.filters, page, pageSize: PAGE_SIZE, sort }), [rev.data, request, page, sort]);
  const list = res?.rows || [];
  const total = res?.total ?? 0;
  const shownAmount = res?.sums?.exclusionAmount ?? 0;
  useRestoreScroll(list.length > 0 && !loading);

  const openRecord = useOpenRecord(); // a row opens the invoice's own page; «back» returns here with the reason, search, sorting, page and scroll as they were
  const openDetail = useCallback((row) => openRecord(invoicePath(row.id)), [openRecord]);
  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'id' ? 'asc' : 'desc' }));
  const exportHref = rev.data.exportUrl(request.scope, { filters: request.filters, sort });
  const select = (id) => { const next = reason === id ? 'all' : id; setReason(next); if (next !== 'all') window.setTimeout(() => { headRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); headRef.current?.focus({ preventScroll: true }); }, 0); };
  const reconciles = Math.abs(sum - K.excluded) <= 1 && sumN === K.excludedCount;
  // the toolbar: period · Amanah · REASON (the same state as the reason table) | More: municipality, revenue source, product, payment status | search | export
  const local = useMemo(() => exclusionsLocal({ reasonCount: (id) => (stats[id]?.primaryCount ? ` · ${count(stats[id].primaryCount)}` : ''), reasonDisabled: (id) => !stats[id]?.primaryCount && reason !== id }), [stats, reason, count]);
  const localValues = useMemo(() => ({ reason, pay }), [reason, pay]);
  const onLocalChange = (patch) => { if ('reason' in patch) setReason(patch.reason); if ('pay' in patch) setPay(patch.pay); };
  const clearLocal = () => { setReason('all'); setPay('all'); setSearch(''); };
  const clearAll = () => { rev.resetScope(); clearLocal(); }; // the no-results reset: the same as «مسح الفلاتر» of the toolbar
  const filtered = narrowing({ scopeActive: !scopeIsDefault(rev.scope, rev.cfg.cutoff), local, values: localValues, search: debouncedSearch });

  // three balanced cards: the value and its unit are separate; the percentage is computed from the UNROUNDED amounts (excluded ÷ uncollected BEFORE exclusions), never from the rounded display
  const amtParts = parts(K.excluded);
  const netUnpaid = K.collectible; // uncollected AFTER exclusions (what remains collectible) — a different denominator, named in the tooltip
  const kpiItems = [
    { key: 'amt', label: L('Total excluded amount', 'إجمالي المبلغ المستبعد'), value: amtParts.num, unit: amtParts.label, title: sar(K.excluded), sub: L('unpaid part of the excluded invoices', 'الجزء غير المسدّد من الفواتير المستبعدة') },
    { key: 'n', label: L('Excluded invoices', 'عدد الفواتير المستبعدة'), value: count(K.excludedCount), unit: L('invoices', 'فاتورة'), sub: L('each counted once, under its effective reason', 'كل فاتورة تُحتسب مرة واحدة تحت سببها الفعلي') },
    { key: 'share', label: L('Excluded share of uncollected before exclusions', 'نسبة المستبعد من إجمالي غير المحصّل قبل الاستبعاد'), value: share == null ? '—' : `${(share * 100).toFixed(1)}%`, title: share == null ? undefined : `${sar(K.excluded)} ÷ ${sar(K.uncollectedTotal)}`,
      sub: share == null ? L('no uncollected amount in this scope', 'لا يوجد غير محصّل في هذا النطاق') : L(`of ${short(K.uncollectedTotal)} uncollected before exclusions`, `من ${short(K.uncollectedTotal)} غير محصّل قبل الاستبعاد`),
      infoLabel: L('How the percentage is calculated', 'كيف تُحسب النسبة'),
      info: (<>
        <b>{L('Excluded amount ÷ uncollected before exclusions × 100', 'المبلغ المستبعد ÷ إجمالي غير المحصّل قبل الاستبعاد × 100')}</b>
        <span>{L(`Denominator = uncollected before exclusions = net uncollected after exclusions (${sar(netUnpaid)}) + the excluded amount (${sar(K.excluded)}) = ${sar(K.uncollectedTotal)}.`, `المقام = إجمالي غير المحصّل قبل الاستبعاد = صافي غير المحصّل بعد الاستبعاد (${sar(netUnpaid)}) + المبلغ المستبعد (${sar(K.excluded)}) = ${sar(K.uncollectedTotal)}.`)}</span>
        <span>{L('This is NOT the net uncollected after exclusions (what remains collectible). The percentage uses the exact amounts, not the rounded figures shown.', 'وهو ليس صافي غير المحصّل بعد الاستبعاد (المتبقي للتحصيل). وتُحسب النسبة من المبالغ الدقيقة لا من الأرقام المقرّبة المعروضة.')}</span>
      </>) }
  ];

  return (
    <div className="rv-page ex-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Exclusions management', 'إدارة الاستبعادات')}</h1>
          <div className="page-sub">{L('Upload exclusions and review the excluded invoices. Exclusions come only from uncollected invoices and never change an invoice’s payment status.', 'ارفع الاستبعادات وراجع الفواتير المستبعدة. والاستبعاد يكون من الفواتير غير المحصّلة فقط ولا يغيّر حالة سداد الفاتورة.')}</div>
        </div>
      </div>

      <ExclusionUpload />

      <ScopeFilters {...FILTER_PAGES.exclusions} local={{ ...local, values: localValues, onChange: onLocalChange }} onClearLocal={clearLocal} onChange={() => setPage(0)}
        search={{ value: search, onChange: setSearch, label: { ar: 'بحث', en: 'Search' }, placeholder: { ar: 'فاتورة، سداد، اشتراك، مخالفة، سجل تجاري، دافع أو عقد', en: 'Invoice, SADAD, subscription, violation, CR, payer or contract' } }}
        actions={<ExportLink filters={request.filters} href={exportHref}>{L('Export CSV', 'تصدير CSV')}</ExportLink>} />

      <KpiStrip label={L('Exclusions summary', 'ملخص الاستبعادات')} items={kpiItems} />

      <section className={`card card-pad ex-reasons${reasonChart ? ' ex-reasons--two' : ''}`} aria-label={L('Exclusions by reason', 'الاستبعادات حسب السبب')}>
        <div className="ex-reasons__head">
          <h2 className="ex-h">{L('Exclusions by reason', 'الاستبعادات حسب السبب')}</h2>
          <span className="muted ex-reasons__view">{L(`All ${count(withCount.length)} reasons, by excluded amount`, `كل الأسباب (${count(withCount.length)}) بحسب المبلغ المستبعد`)}{noInvoices > 0 ? L(` · ${count(noInvoices)} other reason(s) have no invoices in this scope`, ` · ${count(noInvoices)} سبب آخر بلا فواتير في هذا النطاق`) : ''}</span>
        </div>
        <div className="table-wrap" tabIndex={0}>
          <table className="ex-rtable" data-no-stack="" aria-label={L('Exclusion reasons: invoices and excluded amount — also the data of the chart', 'أسباب الاستبعاد: عدد الفواتير والمبلغ المستبعد — وهي أيضاً بيانات الرسم')}>
            <thead><tr><th scope="col">{L('Exclusion reason', 'سبب الاستبعاد')}</th><th scope="col" className="num">{L('Invoices', 'عدد الفواتير')}</th><th scope="col" className="num">{L('Excluded amount', 'المبلغ المستبعد')}</th><th scope="col">{L('View', 'عرض')}</th></tr></thead>
            <tbody>
              {visible.map((r) => (
                <React.Fragment key={r.ruleId}>
                  <tr className={`${reason === r.ruleId ? 'is-on' : ''}${r.count === 0 ? ' is-zero' : ''}`}>
                    <td>
                      <span className="ex-rname">{ar ? r.ar : r.en}</span>
                      {r.workingLabel && <span className="rv-tag rv-tag--warn" title={L('A working label, to be confirmed', 'تسمية مؤقتة للتأكيد')}>{L('working label', 'تسمية مؤقتة')}</span>}
                      <button type="button" className="ex-info" aria-expanded={open === r.ruleId} aria-controls={`ex-more-${r.ruleId}`} aria-label={L(`Rule, source and exact amount: ${r.en}`, `القاعدة والمصدر والمبلغ الدقيق: ${r.ar}`)} title={L('Rule, source and exact amount', 'القاعدة والمصدر والمبلغ الدقيق')} onClick={() => setOpen(open === r.ruleId ? null : r.ruleId)}>i</button>
                    </td>
                    <td className="num">{count(r.count)}</td>
                    <td className="num" dir="ltr" title={sar(r.amount)}>{short(r.amount)}</td>
                    <td className="ex-act">{r.count === 0 ? <span className="muted">—</span> : reason === r.ruleId ? <span className="ex-sel" aria-current="true">{L('Selected', 'محدّد')}</span> : <button type="button" className="rv-link" aria-pressed="false" onClick={() => select(r.ruleId)}>{L('View', 'عرض')}</button>}</td>
                  </tr>
                  {open === r.ruleId && (
                    <tr className="ex-rmore" id={`ex-more-${r.ruleId}`}><td colSpan={4}>
                      <div>{ar ? r.ruleAr : r.ruleEn}</div>
                      <div className="muted">{L('Source of the exclusion', 'مصدر الاستبعاد')}: {r.source ? (ar ? r.source.ar : r.source.en) : '—'} · {L('Exact amount', 'المبلغ الدقيق')}: <span dir="ltr">{sar(r.amount)}</span></div>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
              {!visible.length && <tr><td colSpan={4}><div className="rv-empty">{L('No exclusions in this scope.', 'لا استبعادات في هذا النطاق.')}</div></td></tr>}
            </tbody>
            <tfoot><tr><th scope="row">{L(`All reasons (${count(withCount.length)})`, `كل الأسباب (${count(withCount.length)})`)}</th><td className="num">{count(sumN)}</td><td className="num" dir="ltr" title={sar(sum)}>{short(sum)}</td><td /></tr></tfoot>
          </table>
        </div>
        {reasonChart && (
          <div className="ex-chart">
            <PageChart block={reasonChart} view={chartView} onViewChange={onChartView} picker="full" table={false} onPick={(t) => { const k = reasonChart.keys[t.i]; if (k != null) select(k); }} selected={reason !== 'all' && reasonChart.keys.indexOf(reason) >= 0 ? { i: reasonChart.keys.indexOf(reason) } : null} />
          </div>
        )}
        {!reconciles && <div className="rv-callout rv-callout--bad" role="alert">{L('The reasons do not add up to the total excluded: check the reconciliation.', 'مجموع الأسباب لا يطابق إجمالي المستبعد: راجع المطابقة.')}</div>}
        <details className="ex-rules">
          <summary>{L('Rules and precedence', 'القواعد وترتيب الأولوية')}</summary>
          <div className="muted" style={{ fontSize: 12, margin: '4px 0' }}>{L('When an invoice meets several reasons, the first one in this order applies; the others stay on the record. Each invoice is counted once, under its effective reason.', 'إذا انطبق على الفاتورة أكثر من سبب فيُطبَّق الأول بهذا الترتيب وتبقى الأسباب الأخرى في السجل. وتُحتسب كل فاتورة مرة واحدة تحت سببها الفعلي.')}</div>
          <ol>{PRECEDENCE.map((r) => <li key={r.ruleId}>{ar ? r.ar : r.en}</li>)}</ol>
        </details>
      </section>

      <section className="card card-pad" id="excluded-invoices" aria-labelledby="ex-list-h">
        <div className="ex-list-head">
          <h2 className="ex-h" id="ex-list-h" ref={headRef} tabIndex={-1}>{L('Excluded invoices', 'الفواتير المستبعدة')}</h2>
          {!error && !(loading && !res) && <span className="muted" style={{ fontSize: 13 }} role="status" aria-live="polite">{L(`${count(total)} invoices · ${sar(shownAmount)} excluded`, `${count(total)} فاتورة · ${sar(shownAmount)} مستبعد`)}{reason !== 'all' ? ` — ${label(reason)}` : ''}</span>}
        </div>
        {error && <div className="rv-callout rv-callout--bad" role="alert">{L('The data service could not load this page.', 'تعذّر على خدمة البيانات تحميل هذه الصفحة.')} {String(error.message || '')}</div>}
        {!loading && !error && total === 0 && filtered
          ? <NoResults lang={ar ? 'ar' : 'en'} title={L('No excluded invoices match these filters', 'لا توجد فواتير مستبعدة مطابقة لهذه التصفية')} hint={L('The list was not widened. Clear the filters to see every excluded invoice of the default period.', 'لم تُوسَّع القائمة. امسح الفلاتر لعرض كل الفواتير المستبعدة في الفترة الافتراضية.')} onReset={clearAll} />
          : <InvoiceListTable mode="excluded" rows={list} loading={loading} sort={sort} onSort={toggleSort} onOpen={openDetail} ariaLabel={L('Excluded invoices', 'الفواتير المستبعدة')} />}
        <Pager page={page} total={total} size={PAGE_SIZE} onPage={setPage} />
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{L('Invoice amount is the original amount; the excluded amount is the unpaid remainder that leaves the collectible base (a partial payment stays collected). Where several reasons apply, the effective one is shown and the others are listed under it; the amount is excluded once.', 'مبلغ الفاتورة هو المبلغ الأصلي؛ والمبلغ المستبعد هو المتبقي غير المسدد الذي يخرج من القابل للتحصيل (وتبقى الدفعة الجزئية محصّلة). وإذا انطبق أكثر من سبب يُعرض السبب الفعلي وتُسرد الأسباب الأخرى تحته؛ ويُستبعد المبلغ مرة واحدة.')}</p>
      </section>
    </div>
  );
}
