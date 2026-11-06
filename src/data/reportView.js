// How a report MODEL is presented, separate from what it contains: the chart type, and whether only the tables / charts / indicators are shown.
// The conversation keeps ONE view per result and the exports read the SAME view, so a file always reflects what the person agreed on screen
// (a chart changed to a line chart is a line chart in the PowerPoint, the PDF and the Word file).
//
// view = { chartKind, only, charts }  —  `chartKind`: the legacy global «make every chart a …» command; `only`: tables | charts | kpis; `charts[chartId]`: the per-chart presentation config
// (docs/chart-library.md §4). Applying a view derives a displayed model from the saved model; it never changes the saved figures and never reads the data service.
import { assignChartIds, chartBlocks } from './chartIds';
import { evaluateChart, typeIdOf, exportEntryFor, defaultConfig } from './chartCatalog';
import { normalizeConfig } from './chartConfig';

export const CHART_KINDS = ['bar', 'hbar', 'line', 'pie'];
export const ONLY = ['tables', 'charts', 'kpis'];
export const emptyView = () => ({ chartKind: null, only: null, charts: {} });
const hasCfg = (v) => !!v && !!v.charts && typeof v.charts === 'object' && Object.keys(v.charts).length > 0;
export const viewIsDefault = (v) => !v || (!v.chartKind && !v.only && !hasCfg(v));

const chartsOf = (model) => [...model.headline, ...model.sections.flatMap((s) => s.blocks)].filter((b) => b.type === 'chart');
export const hasCharts = (model) => !!model && chartsOf(model).length > 0;
export const hasTables = (model) => !!model && [...model.headline, ...model.sections.flatMap((s) => s.blocks)].some((b) => b.type === 'table');

// charts whose KIND is their meaning (a bridge, a part-of-whole bar, a heat map, a running total) are never re-drawn by the global command
const GLOBAL_FIXED = {
  waterfall: { ar: 'مطابقة حسابية (شلال) لا تُحوَّل إلى نوع آخر.', en: 'A reconciliation (waterfall) is never converted to another type.' },
  stacked_hbar: { ar: 'شريط أجزاء من كلٍّ واحد يبقى كما هو.', en: 'A part-of-whole bar keeps its form.' },
  heatmap: { ar: 'مصفوفة (خريطة حرارية) تفقد معناها بأي شكل آخر.', en: 'A matrix (heat map) loses its meaning in any other shape.' }
};
const CUMULATIVE_FIXED = { ar: 'مجموع جارٍ (تراكمي) يبقى كما هو.', en: 'A running total (cumulative) keeps its form.' };

// → { model, changed, skipped, skippedList }: `skipped` = charts that cannot take the requested type (a pie shows ONE series, a line needs an ordered axis, …) and stay as they are;
// `skippedList` = [{chartId, title, reason:{ar,en}}] for those AND for the charts the global command never touches (a reconciliation, a matrix, a running total).
export function applyView(model, view) {
  if (!model || viewIsDefault(view)) return { model, changed: 0, skipped: 0, skippedList: [] };
  const base = assignChartIds(model); const lang = model.lang === 'en' ? 'en' : model.lang === 'ar' ? 'ar' : undefined;
  let changed = 0; let skipped = 0; const skippedList = [];
  const note = (b, reason) => skippedList.push({ chartId: b.id, title: b.title || '', reason });
  const legacy = (b) => {
    const fixed = GLOBAL_FIXED[b.kind] || (b.basis === 'cumulative' ? CUMULATIVE_FIXED : null);
    if (fixed) { note(b, fixed); return b; }
    const r = evaluateChart(b, view.chartKind, {}, { lang, loose: true });
    if (!r.ok) { skipped += 1; note(b, r.reason); return b; }
    if (view.chartKind !== (b.kind || 'bar')) changed += 1;
    return r.block;
  };
  const perChart = (b, cfg) => {
    const r = evaluateChart(b, cfg.kind || typeIdOf(b), cfg, { lang });
    if (!r.ok) { skipped += 1; note(b, r.reason); return b; }
    if (r.block !== b) changed += 1;
    return r.block;
  };
  const mapBlock = (b) => {
    if (b.type !== 'chart') return b;
    let out = b;
    if (view.chartKind) out = legacy(out); // the global command first …
    const cfg = hasCfg(view) ? view.charts[b.id] : null;
    if (cfg && typeof cfg === 'object') out = perChart(out, cfg); // … then the per-chart presentation on top of it
    return out;
  };
  const keep = (b) => {
    if (!view.only) return true;
    if (view.only === 'tables') return b.type === 'table';
    if (view.only === 'charts') return b.type === 'chart';
    return b.type === 'kpis';
  };
  const headline = base.headline.map(mapBlock).filter(keep);
  const sections = base.sections.map((s) => ({ ...s, blocks: s.blocks.map(mapBlock).filter(keep) })).filter((s) => s.blocks.length);
  return { model: { ...base, headline, sections, view }, changed, skipped, skippedList };
}
export const mergeView = (a, patch) => ({ ...emptyView(), ...(a || {}), ...patch });

/* ------------------------------------------------------------------ per-chart config in the view */
const PLAIN_KEYS = ['kind', 'orientation', 'mode', 'grouping', 'cumulative', 'sort', 'topN', 'labels', 'legend', 'dimension'];
// the config kept for a chart: only valid keys; with `block`, also only the keys that differ from the block's own default (so «no change» stores nothing)
function compact(cfg, block) {
  const c = normalizeConfig(cfg); if (!block) return c;
  const d = normalizeConfig(defaultConfig(block)); const out = {};
  for (const k of PLAIN_KEYS) if (k in c && c[k] !== d[k]) out[k] = c[k];
  return out;
}
// → a NEW view with `cfg` stored for the chart (an empty or default config removes the entry); the other parts of the view are kept
export function setChartConfig(view, chartId, cfg, block) {
  const v = mergeView(view, {}); const charts = { ...(v.charts || {}) }; const c = chartId == null ? {} : compact(cfg, block);
  if (chartId == null) return v;
  if (Object.keys(c).length) charts[chartId] = c; else delete charts[chartId];
  return { ...v, charts };
}
export function resetChart(view, chartId) { const v = mergeView(view, {}); const charts = { ...(v.charts || {}) }; delete charts[chartId]; return { ...v, charts }; }
export const chartConfigOf = (view, chartId) => (view && view.charts && view.charts[chartId]) || null;
// a view read back from storage (or from anywhere untrusted): only the known, valid parts survive
export function cleanView(view) {
  if (!view || typeof view !== 'object') return emptyView();
  const charts = {};
  if (view.charts && typeof view.charts === 'object') for (const [id, cfg] of Object.entries(view.charts)) { const c = normalizeConfig(cfg); if (Object.keys(c).length) charts[id] = c; }
  return { chartKind: CHART_KINDS.includes(view.chartKind) ? view.chartKind : null, only: ONLY.includes(view.only) ? view.only : null, charts };
}

/* ------------------------------------------------------------------ export plan */
// → [{ chartId, title, kind, typeId, pdf:'vector', word:'png', pptx:'native'|'vector-image'|'table', note:{ar,en}|null }] — how each chart of the report, AS SHOWN under `view`, will be rendered by each export.
// Pass the saved model with its view; a model that already carries `model.view` (the result of applyView) is used as it is.
export function exportPlan(model, view) {
  if (!model) return [];
  const vm = assignChartIds(model.view ? model : applyView(model, view).model);
  return chartBlocks(vm).map((b, i) => exportEntryFor(b, i));
}
