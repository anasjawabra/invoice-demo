// The Dashboard's export: the SAME report model Smart Reports exports, built from the dashboard's OWN snapshot and active filters — so the file carries exactly the figures
// the KPI cards show (period, filters, calculation basis and data cutoff are in the report's context block). Nothing is recalculated for the export.
//
// Charts: the three library charts of the page («من الإجمالي إلى المحصّل») ARE the model's own blocks (executive:0, executive:1, aging:0), so the chart type the person chose on the page
// (view.charts, kept per user and page — src/components/charts/usePageChartView.js) is applied to the exported model with the same `applyView`: the file shows what the page shows.
import { buildReportModel } from './reportModel';
import { viewedModel } from './viewedModel';
import { chartBlocks } from './chartIds';
import { headlineCfg } from './measure';

export const DASHBOARD_SECTIONS = ['executive', 'trends', 'amanah', 'sources', 'aging'];
export const DASHBOARD_PAGE_SECTIONS = ['executive', 'aging']; // the sections whose charts the dashboard page draws itself
export const DASHBOARD_PAGE = 'dashboard';

// The dashboard is INDEPENDENT of the collection plans: the model gets no target object at all (no reference plan, no target bullets, no budget chip) — a plan change cannot reach the file.
export const DASHBOARD_NO_TARGETS = Object.freeze({});
const scopeKeysOf = (s) => ({ amanah: s.amanah, source: s.source, scopeType: s.scopeType, muni: s.muni, status: s.status, product: s.product, mainClass: s.mainClass });
/** the build inputs of the dashboard model (pure: the caller fetched `cash` / `dist`) */
export function dashboardInputs(rev, { cash = null, dist = null, sections = DASHBOARD_SECTIONS } = {}) {
  const { snapshot, prevSnapshot, comparison } = rev; const s = rev.scopeEff;
  const compare = comparison?.comparable && comparison.basis === 'same_period_last_year' ? 'prev_year' : 'none';
  const spec = { title: { ar: 'لوحة المعلومات — الأداء المالي', en: 'Dashboard — financial performance' }, preset: rev.scope.preset, scope: { from: s.from, to: s.to, ...scopeKeysOf(s) }, compare, depth: 'summary', sections };
  return { spec, out: { snapshot, forecast: { ready: false, reasonNotReady: { ar: 'غير مطلوب في هذا التصدير', en: 'not needed in this export' } }, targetPos: null, achievement: null, cards: [], anomalies: [] }, prev: compare === 'prev_year' ? prevSnapshot : null, compare, prevScope: prevSnapshot?.scope, cash, targets: DASHBOARD_NO_TARGETS, cases: rev.cases, meta: rev.meta, dist };
}
/** the invoice-level distributions of the dashboard's scope, measured at the snapshot's own cut-off (otherwise the model refuses them); a failure only removes the histogram / box / 3-level tree alternatives */
export const dashboardDistributions = (rev) => {
  const s = rev.scopeEff; const data = rev.data;
  return data.distributions ? data.distributions({ from: s.from, to: s.to, ...scopeKeysOf(s) }, { cfg: headlineCfg(rev.cfg) }).catch(() => null) : Promise.resolve(null);
};

export async function buildDashboardModel(rev, lang) {
  const { data, cfg } = rev; const s = rev.scopeEff; const today = cfg.cutoff;
  const cash = await data.series({ from: s.from, to: s.to, ...scopeKeysOf(s) }, { asOf: s.to < today ? s.to : today });
  const dist = await dashboardDistributions(rev);
  const inputs = dashboardInputs(rev, { cash, dist });
  const model = buildReportModel({ ...inputs, lang });
  Object.defineProperty(model, '_inputs', { value: inputs, enumerable: false });
  return model;
}

/** the report model of the page's own charts (executive + aging sections only): { blocks:{ [chartId]: block }, model } — the picker's base blocks, with their `dim` / `alts`. Pure. */
export function buildDashboardChartBlocks(rev, dist, lang) {
  const model = buildReportModel({ ...dashboardInputs(rev, { dist, sections: DASHBOARD_PAGE_SECTIONS }), lang });
  const blocks = {}; for (const b of chartBlocks(model)) blocks[b.id] = b;
  return { model, blocks };
}

/** the export model with the page's saved chart view applied (and its build inputs kept, so the other language is rebuilt the same way) */
export const withDashboardView = (model, view, inputs = null) => viewedModel(model, view, inputs);
