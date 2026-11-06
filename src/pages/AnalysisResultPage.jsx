import React, { useEffect, useMemo, useRef, useState } from 'react';
import useGate from '../components/access/useGate';
import { useParams, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { useL } from '../utils/bi';
import { RecordHeader } from '../components/record/RecordPage';
import AnalysisResultView from '../components/analysis/AnalysisResultView';
import { useReturnTarget } from '../utils/returnContext';
import { analysisPath } from '../utils/paths';
import NcResult from '../components/analysis/nc/NcResult';
import { useNcStore, saveNcTask, isNcTask, REFRESH_PREFIX } from '../components/analysis/nc/useNcStore';
import { isTerminal } from '../components/analysis/AnalysisProgress';
import ExportDialog from '../components/smart/ExportDialog';
import { buildNcReportModel, NC_APPENDIX_ROWS } from '../data/ncReportModel';
import { fmtRiyadh } from '../data/clock';
import { viewedModel } from '../data/viewedModel';
import { headlineCfg } from '../data/measure';

const FROM_KEY = (taskId) => `ib_ncfrom_${taskId}`;
const SAVE_REASON = {
  quota: { ar: 'امتلأت مساحة التخزين في المتصفح', en: 'the browser’s storage is full' }, too_large: { ar: 'حجم النتيجة يتجاوز الحد المسموح', en: 'the result is larger than the allowed size' },
  analyses_limit: { ar: 'بلغت الحد الأقصى من التحليلات المحفوظة؛ احذف تحليلاً من قائمة التحليلات المحفوظة', en: 'the limit of saved analyses is reached; delete one from the saved list' },
  versions_limit: { ar: 'بلغ التحليل الحد الأقصى من الإصدارات', en: 'this analysis reached its maximum number of versions' }, unavailable: { ar: 'التخزين غير متاح في هذا المتصفح', en: 'storage is not available in this browser' },
  forbidden: { ar: 'خارج نطاق صلاحيتك', en: 'outside your access scope' }
};

function Missing({ crumbs, ret, title, heading, body, listLink = true }) {
  const { L } = useL();
  return (
    <div className="rp"><RecordHeader crumbs={crumbs} title={title} ret={ret} />
      <div className="rp-state rp-state--bad" role="alert">
        <h2 className="rp-h2">{heading}</h2><p>{body}</p>
        <Link className="btn btn-sm btn-primary" to={listLink ? '/collection' : ret.path}>{listLink ? L('Uncollected invoices list', 'قائمة الفواتير غير المحصّلة') : ret.label}</Link>
      </div>
    </div>
  );
}

// A SAVED non-collection analysis: the stored version selected in the address (?v=n) or the latest. «تحديث التحليل» runs a new analysis for the same scope and appends a version; nothing is overwritten.
function SavedAnalysis({ id, record, crumbs, ret }) {
  const rev = useRevenue(); const { L, ar } = useL(); const [sp, setSp] = useSearchParams(); const loc = useLocation();
  const versions = record.versions; const latest = versions[versions.length - 1];
  const vParam = Number(sp.get('v')); const version = versions.find((x) => x.n === vParam) || latest;
  const seen = useRef(latest.n); // the newest version this visit knew about
  const tasksFor = rev.tasks.filter((t) => t.origin === REFRESH_PREFIX + id);
  const refreshing = tasksFor.some((t) => !isTerminal(t));
  const stale = version.dataVersion != null && version.dataVersion !== rev.dataVersion;
  // the chart presentation of THIS version (kept beside the saved analysis, see analysisStore.setView). It is a presentation only: changing it never refetches or recomputes anything, so the store is written
  // without announcing a change (the saved-analyses list does not show charts) and the page keeps the new view in its own state.
  const ncs = useNcStore(); const [views, setViews] = useState({});
  const chartView = views[version.n] ?? version.view ?? null;
  const onChartView = (v) => { setViews((x) => ({ ...x, [version.n]: v })); ncs.store.setView(ncs.uk, id, version.n, v, { org: ncs.viewer }); };
  const exportGate = useGate('export.collection'); // the non-collection analysis exports with collection.export
  const [exportOpen, setExportOpen] = useState(false); const [exportData, setExportData] = useState(null); const [busy, setBusy] = useState(false);

  const select = (n) => setSp((p) => { const x = new URLSearchParams(p); x.set('v', String(n)); ['d', 'p', 'q', 'sk', 'sd'].forEach((k) => x.delete(k)); return x; }, { replace: true }); // a filter's figures belong to one version
  const refresh = () => {
    const scope = version.taskScope || { ...record.scope };
    const r = rev.startAnalysis('noncollection', {}, { scope, origin: REFRESH_PREFIX + id });
    try { sessionStorage.setItem(FROM_KEY(r.id), JSON.stringify(loc.state?.from || null)); } catch { /* none */ }
  };
  const openExport = async () => {
    setBusy(true);
    try {
      let a = version.analysis; // the listing attached to the file is the CURRENT data: only when nothing changed since this version was generated
      if (!stale) { try { const r = await rev.data.list({ from: a.scope.from, to: a.scope.to, amanah: a.scope.amanah, source: a.scope.source, scopeType: a.scope.scopeType, muni: a.scope.muni, status: a.scope.status, product: version.taskScope?.product || [], mainClass: version.taskScope?.mainClass || 'all' }, { filters: { nc: {} }, page: 0, pageSize: NC_APPENDIX_ROWS, sort: { key: 'outstanding', dir: 'desc' }, withNc: true }); a = { ...a, invoices: r.rows, invoicesTotal: r.total }; } catch { /* the file then says the listing is on screen */ } }
      // the invoice-level distributions of the analysis' scope make the histogram / box types available in the file too (only while the data is the data the analysis was made on)
      if (!stale && version.cutoff === rev.cfg.cutoff && rev.data.distributions) { try { const t = version.taskScope || {}; const d = await rev.data.distributions({ from: a.scope.from, to: a.scope.to, amanah: a.scope.amanah, source: a.scope.source, scopeType: a.scope.scopeType, muni: a.scope.muni, status: a.scope.status, product: t.product || [], mainClass: t.mainClass || 'all' }, { cfg: headlineCfg(rev.cfg) }); if (d) a = { ...a, distributions: d }; } catch { /* the file then simply has no histogram / box alternatives */ } }
      const meta = { version: version.n, generatedAt: version.generatedAt, cutoff: version.cutoff, requestId: version.sourceTaskId || null, reportId: `${id}-v${version.n}`, lineageId: id, period: { from: a.scope.from, to: a.scope.to }, savedAt: version.savedAt || null, pruned: version.prune ? { detail: true, language: false } : null };
      setExportData({ id: `v${version.n}`, label: `${L(`Version ${version.n}`, `الإصدار ${version.n}`)} — ${fmtRiyadh(version.generatedAt)}`, meta, models: { ar: viewedModel(buildNcReportModel(a, { lang: 'ar', meta }), chartView), en: viewedModel(buildNcReportModel(a, { lang: 'en', meta }), chartView) } });
      setExportOpen(true);
    } finally { setBusy(false); }
  };
  const newer = latest.n > seen.current && version.n !== latest.n ? latest.n : null;

  return (
    <div className="rp">
      <RecordHeader crumbs={crumbs} ret={ret} kind={L('Analysis result', 'نتيجة التحليل')} title={L('Non-Collection Analysis', 'تحليل أسباب عدم التحصيل')} />
      <NcResult analysis={version.analysis} version={version} versions={versions} onSelectVersion={select} onRefresh={refresh} refreshing={refreshing || busy} onExport={openExport} exportDenied={exportGate.allowed ? null : exportGate.reason}
        saveState={{ saved: true }} stale={stale} newerVersion={newer} chartView={chartView} onChartView={onChartView} onOpenNewer={() => { seen.current = latest.n; select(latest.n); }} />
      {exportData && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} versions={[exportData]} activeId={exportData.id} L={(a, e) => L(e, a)} ar={ar} />}
    </div>
  );
}

// An in-session task that is not (yet) in the store: save it, then continue on the stored address so the page survives a refresh.
function TaskToStored({ task, crumbs, ret }) {
  const { L } = useL(); const nav = useNavigate(); const loc = useLocation(); const nc = useNcStore();
  const [fail, setFail] = useState(null);
  useEffect(() => {
    const r = saveNcTask(nc.uk, nc.viewer, task);
    if (!r.ok) { setFail(r.error); return; }
    let from = loc.state?.from;
    if (typeof task.origin === 'string' && task.origin.startsWith(REFRESH_PREFIX)) { try { from = JSON.parse(sessionStorage.getItem(FROM_KEY(task.id)) || 'null') || undefined; } catch { from = undefined; } }
    nav(`${analysisPath(r.id)}?v=${r.n}`, { replace: true, state: from ? { from } : undefined });
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!fail) return <div className="rp"><RecordHeader crumbs={crumbs} ret={ret} kind={L('Analysis result', 'نتيجة التحليل')} title={L('Non-Collection Analysis', 'تحليل أسباب عدم التحصيل')} /><p className="muted" role="status">{L('Opening the saved result…', 'جارٍ فتح النتيجة المحفوظة…')}</p></div>;
  const reason = SAVE_REASON[fail] || null;
  const version = { n: 1, generatedAt: task.result.generatedAt, cutoff: task.result.cutoff, taskScope: task.scope, dataVersion: task.dataVersion };
  return (
    <div className="rp">
      <RecordHeader crumbs={crumbs} ret={ret} kind={L('Analysis result', 'نتيجة التحليل')} title={L('Non-Collection Analysis', 'تحليل أسباب عدم التحصيل')} />
      <NcResult analysis={task.result.analysis} version={version} versions={[version]} saveState={{ saved: false, reason }} stale={false} />
    </div>
  );
}

export default function AnalysisResultPage() {
  const { taskId: raw } = useParams(); const id = decodeURIComponent(raw || '');
  const rev = useRevenue(); const nc = useNcStore();
  const { L, B } = useL();
  const ret0 = useReturnTarget({ path: '/insights', label: L('Dashboards and reports', 'لوحة المعلومات والتقارير') });
  const retNc = useReturnTarget({ path: '/collection', label: L('Uncollected invoices list', 'قائمة الفواتير غير المحصّلة') });
  const task = rev.tasks.find((t) => t.id === id);
  const stored = useMemo(() => nc.store.load(nc.uk, id, nc.viewer), [nc.store, nc.uk, nc.viewer, id, nc.ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const ncCrumbs = [{ label: L('Uncollected invoices list', 'قائمة الفواتير غير المحصّلة'), to: '/collection' }, { label: L('Non-Collection Analysis', 'تحليل أسباب عدم التحصيل') }];
  const crumbs = [{ label: L('Dashboards and reports', 'لوحة المعلومات والتقارير'), to: '/insights' }, { label: L('Analysis result', 'نتيجة التحليل') }];

  if (stored.ok) return <SavedAnalysis key={id} id={id} record={stored.record} crumbs={ncCrumbs} ret={retNc} />;
  if (stored.error === 'forbidden') return <Missing crumbs={ncCrumbs} ret={retNc} title={L('Non-Collection Analysis', 'تحليل أسباب عدم التحصيل')} heading={L('This analysis is outside your access scope', 'هذا التحليل خارج نطاق صلاحيتك')} body={L('It covers Amanahs that your organisation is not allowed to see.', 'يغطي أمانات لا يُسمح لجهتك برؤيتها.')} />;
  if (stored.error === 'unreadable') return <Missing crumbs={ncCrumbs} ret={retNc} title={L('Non-Collection Analysis', 'تحليل أسباب عدم التحصيل')} heading={L('This saved analysis cannot be read', 'تعذّرت قراءة هذا التحليل المحفوظ')} body={L('The saved record is damaged and was not shown. Run the analysis again.', 'السجل المحفوظ تالف ولم يُعرض. شغّل التحليل مجدداً.')} />;
  if (task && isNcTask(task)) return <TaskToStored key={id} task={task} crumbs={ncCrumbs} ret={retNc} />;
  if (task && task.kind === 'noncollection' && !task.result) return <Missing crumbs={ncCrumbs} ret={retNc} title={L('Non-Collection Analysis', 'تحليل أسباب عدم التحصيل')} heading={L('No result was produced', 'لم تُنتج نتيجة')} body={L('The analysis did not finish. Start it again from the uncollected invoices list.', 'لم يكتمل التحليل. ابدأه من جديد من قائمة الفواتير غير المحصّلة.')} />;
  if (!task || !task.result) {
    const looksStored = /^nc-/.test(id);
    return <Missing crumbs={looksStored ? ncCrumbs : crumbs} ret={looksStored ? retNc : ret0} title={L('Analysis result', 'نتيجة التحليل')} heading={L('This result is no longer available', 'هذه النتيجة لم تعد متاحة')} body={looksStored ? L('This saved analysis was deleted or belongs to another user. Saved analyses are listed on the uncollected invoices page.', 'حُذف هذا التحليل المحفوظ أو يخص مستخدماً آخر. تظهر التحليلات المحفوظة في صفحة الفواتير غير المحصّلة.') : L('This result was not saved and is no longer in memory. Run the analysis again from the page that started it.', 'لم تُحفظ هذه النتيجة ولم تعد في الذاكرة. شغّل التحليل مجدداً من الصفحة التي بدأته.')} listLink={looksStored} />;
  }
  return (
    <div className="rp">
      <RecordHeader crumbs={[...crumbs.slice(0, 1), { label: B(task.title) }]} ret={ret0} kind={L('Analysis result', 'نتيجة التحليل')} title={B(task.title)} />
      <section className="rp-section"><AnalysisResultView result={task.result} task={task} stale={rev.isStale(task)} /></section>
    </div>
  );
}
