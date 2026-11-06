// Synthetic blocks (illustrative numbers only) of EVERY chart kind, in Arabic and English, for the export tests / parity check / deck+PDF scripts.
// Built from the renderers' own sample sets (chart-samples*.mjs) so the exports are checked against the exact block shapes the drawings accept.
import { sampleBlocks } from './chart-samples.mjs';
import { cartesianBlocks } from './chart-samples-cartesian.mjs';
import { hierSamples } from './chart-samples-hier.mjs';

// the same block with every missing value replaced by the mean of its neighbours (a «complete» variant of a sample that has a deliberate gap)
const fillGaps = (b) => ({ ...b, series: b.series.map((s) => ({ ...s, values: s.values.map((v, i, a) => { if (v != null) return v; const p = a.slice(0, i).reverse().find((x) => x != null); const n = a.slice(i + 1).find((x) => x != null); return p != null && n != null ? (p + n) / 2 : p ?? n; }) })) });

export const KIND_ORDER = ['bar', 'hbar', 'line', 'pie', 'waterfall', 'stacked_hbar', 'heatmap', 'stacked_col', 'stacked100_col', 'stacked100_hbar', 'area', 'stacked_area', 'combo', 'pareto', 'histogram', 'donut', 'scatter', 'bubble', 'bullet', 'box', 'treemap', 'sunburst', 'sankey'];
export function exportBlocks(lang) {
  const a = sampleBlocks(lang); const c = cartesianBlocks(lang); const h = hierSamples(lang);
  return {
    bar: a.bar_monthly, hbar: a.hbar_ranked, line: a.line_cum, pie: a.pie, waterfall: a.waterfall, stacked_hbar: a.stacked, heatmap: a.heatmap,
    stacked_col: c.stacked_col, stacked100_col: c.stacked100_col, stacked100_hbar: c.stacked100_hbar,
    area: fillGaps(c.area), stacked_area: fillGaps(c.stacked_area), combo: c.combo, pareto: c.pareto, histogram: c.histogram, donut: h.donut,
    scatter: c.scatter, bubble: c.bubble, bullet: c.bullet, box: c.box, treemap: h.treemap, sunburst: h.sunburst, sankey: h.sankey
  };
}
// variants a native chart must NOT misdraw (they take the image path, said plainly): an area with a missing month, a stacked area with a missing part, a waterfall that crosses zero, a donut of more than 8 parts
export function edgeBlocks(lang) {
  const a = sampleBlocks(lang); const c = cartesianBlocks(lang); const h = hierSamples(lang);
  return { area_gap: c.area, stacked_area_gap: c.stacked_area, waterfall_zero: { ...a.waterfall_multi, series: [{ label: 'v', values: [5e9, -2e9, 1e9, -6e9, -2e9] }], labels: ['A', 'B', 'C', 'D', 'E'], totals: [true, false, false, false, true] }, donut_many: h.donut_other, histogram_days: c.histogram_days, box_amount: c.box_amount };
}
export const blockList = (lang) => Object.entries(exportBlocks(lang)).map(([k, b]) => ({ ...b, id: `fx:${k}` }));
