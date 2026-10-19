// How a report MODEL is presented, separate from what it contains: the chart type, and whether only the tables / charts / indicators are shown.
// The conversation keeps ONE view per result and the exports read the SAME view, so a file always reflects what the person agreed on screen
// (a chart changed to a line chart is a line chart in the PowerPoint, the PDF and the Word file).
export const CHART_KINDS = ['bar', 'hbar', 'line', 'pie'];
export const ONLY = ['tables', 'charts', 'kpis'];
export const emptyView = () => ({ chartKind: null, only: null });
export const viewIsDefault = (v) => !v || (!v.chartKind && !v.only);

const chartsOf = (model) => [...model.headline, ...model.sections.flatMap((s) => s.blocks)].filter((b) => b.type === 'chart');
export const hasCharts = (model) => !!model && chartsOf(model).length > 0;
export const hasTables = (model) => !!model && [...model.headline, ...model.sections.flatMap((s) => s.blocks)].some((b) => b.type === 'table');

// → { model, changed, skipped }: `skipped` = charts that cannot take the requested kind (a pie shows ONE series; a chart with several series stays as it is)
export function applyView(model, view) {
  if (!model || viewIsDefault(view)) return { model, changed: 0, skipped: 0 };
  let changed = 0; let skipped = 0;
  const mapBlock = (b) => {
    if (b.type !== 'chart' || !view.chartKind) return b;
    if (view.chartKind === 'pie' && b.series.length !== 1) { skipped += 1; return b; }
    if (view.chartKind !== (b.kind || 'bar')) changed += 1;
    return { ...b, kind: view.chartKind };
  };
  const keep = (b) => {
    if (!view.only) return true;
    if (view.only === 'tables') return b.type === 'table';
    if (view.only === 'charts') return b.type === 'chart';
    return b.type === 'kpis';
  };
  const headline = model.headline.map(mapBlock).filter(keep);
  const sections = model.sections.map((s) => ({ ...s, blocks: s.blocks.map(mapBlock).filter(keep) })).filter((s) => s.blocks.length);
  return { model: { ...model, headline, sections, view }, changed, skipped };
}
export const mergeView = (a, patch) => ({ ...emptyView(), ...(a || {}), ...patch });
