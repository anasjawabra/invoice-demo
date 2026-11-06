// «لوحة المعلومات» /insights — the PURE logic of the page UI (no React, no I/O; unit-tested in tests/insights-dashboard-ui.test.mjs): the colour of a metric class, the legend swatches, the value text parts,
// the table sort, the heatmap model and the small state reducer of the regional component. NO plan / target: the dashboard is independent of the collection plans.
// Every value, colour and legend entry of «الأداء حسب المنطقة» comes from the ONE `regionalMetric` result (src/data/regional); nothing here recalculates a figure.
import { buildLegend, colorOf, formatValue, REGIONAL_METRICS, DEFAULT_METRIC } from '../../data/regional/regionalLegend';
import { CLASS_COLORS, NA_COLORS, inkOn, RULE_TABLE } from '../../data/regional/collectionBands';

const bi = (ar, en) => ({ ar, en });
export { REGIONAL_METRICS, DEFAULT_METRIC, inkOn };

/* ---------------------------------------------------------------- colour */
// ONE palette for every metric (data/regional/collectionBands.js): red · orange · yellow · green collection-performance bands (rate < 40 / 40–60 / 60–80 / ≥ 80 %; a decrease by size for the change metrics) ·
// hatch = unavailable. NO blue, no amount-based green ramp. The glyph (▼▼ ▼ ◐ ✓ ○) and the text label always accompany the colour.
export const PERFORMANCE_PALETTE = CLASS_COLORS;
export const NO_VALUE = NA_COLORS.base;
export const HATCH_ID = 'ins-hatch';

/** the fill colour of a row: the colour of its band, `null` when it is not available (the caller draws the hatch / «غير متاح») */
export function fillOf(_metricId, color) { return color && color.bucket != null && color.fill ? color.fill : null; }

/** the legend items of a `regionalMetric` result: [{ index, cls, color, glyph, name, label{ar,en}, from, to }] — the SAME classes the map, the chips, the table and the card use */
export function legendItems(res) {
  const L = res.legend;
  return L.buckets.map((b) => ({ index: b.index, cls: b.cls, color: b.color, glyph: b.glyph, name: b.name, label: b.label, from: b.from, to: b.to }));
}
export { RULE_TABLE };
/** ▲ ▼ ■ — the non-colour cue of a signed value */
export const directionMark = (d) => (d === 'up' ? '▲' : d === 'down' ? '▼' : d === 'flat' ? '■' : '');

/* ---------------------------------------------------------------- the regional component's state (view + metric survive each other) */
export const REGIONAL_VIEWS = ['map', 'table'];
export const initialRegionalState = ({ view = 'map', metric = DEFAULT_METRIC } = {}) => ({ view: REGIONAL_VIEWS.includes(view) ? view : 'map', metric: REGIONAL_METRICS.includes(metric) ? metric : DEFAULT_METRIC, hover: null });
export function regionalReducer(state, action) {
  switch (action.type) {
    case 'view': return REGIONAL_VIEWS.includes(action.view) ? { ...state, view: action.view, hover: null } : state; // the metric is kept
    case 'metric': return REGIONAL_METRICS.includes(action.metric) ? { ...state, metric: action.metric } : state; // the view is kept
    case 'hover': return { ...state, hover: action.key ?? null };
    default: return state;
  }
}

/* ---------------------------------------------------------------- table */
/** the sortable value of a cell: its numeric value, or null (unavailable rows always sort last) */
export const cellSortValue = (row, colId) => { const c = row.cells?.[colId]; return c && c.available && Number.isFinite(c.value) ? c.value : null; };
/** rows sorted by a column; `dir` 'desc' (largest first, the default) | 'asc'. Unavailable cells are last in both directions; ties keep the metric order. */
export function sortRows(rows, colId, dir = 'desc') {
  const k = dir === 'asc' ? 1 : -1;
  return rows.map((r, i) => ({ r, i, v: cellSortValue(r, colId) })).sort((a, b) => (a.v == null && b.v == null ? a.i - b.i : a.v == null ? 1 : b.v == null ? -1 : (a.v - b.v) * k || a.i - b.i)).map((x) => x.r);
}

/* ---------------------------------------------------------------- heatmap (the optional advanced comparison): entities × revenue sources, from the SAME dataset */
export const HEAT_MEASURES = ['rate', 'change', 'share'];
export function heatmapModel(dataset, measure = 'rate', lang = 'ar') {
  const comparable = !!dataset.comparison?.comparable;
  const entities = dataset.entities.filter((e) => e.cur.count > 0 || (e.prev && e.prev.count > 0));
  const keys = [...new Set(entities.flatMap((e) => e.sources.map((s) => s.key)))];
  const cols = keys.map((k) => ({ key: k, label: dataset.entities.flatMap((e) => e.sources).find((s) => s.key === k)?.label || bi(k, k) }));
  const cell = (e, k) => {
    const s = e.sources.find((x) => x.key === k);
    if (!s || (s.cur.count === 0 && !(s.prev && s.prev.count > 0))) return { available: false, reason: 'no_invoices', value: null };
    if (measure === 'rate') return s.cur.net > 0 && s.cur.count > 0 ? { available: true, value: s.cur.collected / s.cur.net } : { available: false, reason: s.cur.count === 0 ? 'no_invoices' : 'zero_denominator', value: null };
    if (measure === 'change') {
      if (!comparable || !s.prev) return { available: false, reason: 'no_comparison', value: null };
      if (s.prev.collected > 1e-9) return { available: true, value: s.cur.collected / s.prev.collected - 1 };
      return s.cur.collected > 1e-9 ? { available: false, reason: 'new', value: null } : { available: false, reason: 'zero_denominator', value: null };
    }
    return e.cur.collected > 1e-9 ? { available: true, value: s.cur.collected / e.cur.collected } : { available: false, reason: 'zero_denominator', value: null };
  };
  const rows = entities.map((e) => ({ key: e.key, label: e.label, cells: Object.fromEntries(cols.map((c) => [c.key, cell(e, c.key)])) }));
  const vals = rows.flatMap((r) => Object.values(r.cells)).filter((c) => c.available).map((c) => c.value);
  const metricId = measure === 'rate' ? 'collectionRate' : measure === 'change' ? 'changeCollected' : null;
  const legend = metricId ? buildLegend(metricId, vals, { comparison: dataset.comparison }) : null;
  for (const r of rows) for (const c of Object.values(r.cells)) {
    if (!c.available) continue;
    if (metricId) { const col = colorOf(legend, c.value); c.fill = fillOf(metricId, col); c.cls = col.cls; c.glyph = col.glyph; c.text = formatValue(metricId === 'collectionRate' ? 'collectionRate' : 'changeCollected', c.value, { lang }); }
    else { c.fill = `rgba(100,116,139,${(0.12 + Math.min(c.value, 1) * 0.7).toFixed(2)})`; c.text = formatValue('collectionRate', c.value, { lang }); }
  }
  return { measure, metricId, legend, cols, rows, comparable };
}

/* ---------------------------------------------------------------- the links the details panel offers */
/** the invoices link of a selection: ONE Amanah → that Amanah; several (a region) → none (each entity row has its own); the whole scope → the page scope as it is */
export function invoicesLinkFor(detail) {
  if (!detail) return null;
  if (detail.level === 'entity') return `/invoices?${new URLSearchParams({ amanah: detail.key })}`;
  if (detail.level === 'region') { const ks = detail.row?.entityKeys || []; return ks.length === 1 ? `/invoices?${new URLSearchParams({ amanah: ks[0] })}` : null; }
  if (detail.level === 'total' || detail.level === 'unattributed') return detail.level === 'unattributed' && (detail.row?.entityKeys || []).length === 1 ? `/invoices?${new URLSearchParams({ amanah: detail.row.entityKeys[0] })}` : (detail.level === 'total' ? '/invoices' : null);
  return null;
}

