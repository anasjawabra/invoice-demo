// The DATA side of a chart block for every export (Word, Excel, CSV, PowerPoint appendix, PDF): the table that always sits next to a chart and the exact SAR amounts behind it.
// The six legacy kinds (bar, hbar, line, pie, waterfall, stacked_hbar, heatmap) keep the exact tables their exporters always built; every chart-library kind (docs/chart-library.md) takes its table from the kind's
// registered format (reportFormat.registerChartFormat → chartTableText) so the export, the screen's «View data table» and the drawing share ONE source of numbers. Pure; no I/O.
import { chartInfo, chartTableText } from '../data/reportFormat';
import './chartKinds'; // registers every chart-library kind's info / table format (and drawer) before a table is asked for

export const LEGACY_KINDS = new Set(['bar', 'hbar', 'line', 'pie', 'waterfall', 'stacked_hbar', 'heatmap']);
export const ALL_KINDS = [...LEGACY_KINDS, 'stacked_col', 'stacked100_col', 'stacked100_hbar', 'area', 'stacked_area', 'combo', 'pareto', 'histogram', 'donut', 'scatter', 'bubble', 'bullet', 'box', 'treemap', 'sunburst', 'sankey'];
// What the other formats do with a chart of each kind (the catalog's exportPlan and the export dialog read these, not a guess):
//   PDF: 'vector'  = the same SVG drawing as on screen, followed by the data table (every kind)
//   Word: 'png'    = the SVG rasterised in the browser (chartPng) + the data table; where there is no canvas (Node), 'table-only'
//   Excel/CSV: every kind is its data table (Excel also keeps the exact SAR in the amounts_sar sheet)
export const PDF_SUPPORT = Object.fromEntries(ALL_KINDS.map((k) => [k, 'vector']));
export const WORD_SUPPORT = Object.fromEntries(ALL_KINDS.map((k) => [k, 'png']));
export const XLSX_SUPPORT = Object.fromEntries(ALL_KINDS.map((k) => [k, 'table']));
export const isLegacyChart = (b) => LEGACY_KINDS.has(b.kind || 'bar');

/** {headers, rows (strings), unitText} for a chart-library block, in the chart's ONE unit. */
export function chartExportTable(b, lang) {
  let unitText = ''; try { unitText = chartInfo(b, lang)?.unitText || ''; } catch { unitText = ''; }
  const t = chartTableText(b, lang); const headers = t.headers.map(String);
  if (unitText && headers.some((h) => h.includes(unitText) || /SAR|ريال/.test(h))) unitText = ''; // the table's own headers already name the unit (per column, or exact SAR): do not claim another one in the title
  return { headers, rows: t.rows.map((r) => r.map((c) => (c == null ? '—' : String(c)))), unitText };
}

const leaves = (node, path = []) => (node?.children?.length ? node.children.flatMap((c) => leaves(c, [...path, node.label])) : node && Number.isFinite(node.value) ? [{ path: [...path, node.label], value: node.value }] : []);

/** [[row, column, exact SAR]] for the amounts of a chart-library block (rates, counts, days and plain numbers are never SAR). The legacy kinds are handled by their exporters. */
export function chartExactAmounts(b) {
  const out = []; const k = b.kind || 'bar'; if (b.plain) return out;
  const add = (row, col, v) => { if (typeof v === 'number' && Number.isFinite(v)) out.push([String(row), String(col), v]); };
  const bySeries = (pick) => (b.labels || []).forEach((lab, i) => (b.series || []).forEach((s) => { if (pick(s)) add(lab, s.label, s.values?.[i]); }));
  const isAmt = (kind) => (kind || 'amount') === 'amount';
  if (k === 'combo') bySeries((s) => s.axis !== 'secondary' || b.axis2?.kind === 'amount');
  else if (k === 'scatter' || k === 'bubble') (b.points || []).forEach((p, i) => { const r = p.label ?? `#${i + 1}`; if (isAmt(b.xKind)) add(r, b.xTitle || 'x', p.x); if (isAmt(b.yKind)) add(r, b.yTitle || 'y', p.y); if (k === 'bubble' && isAmt(b.sizeKind)) add(r, b.sizeTitle || 'size', p.size); });
  else if (k === 'histogram') (b.bins || []).forEach((bin, i) => { const r = `${bin.lo ?? ''}–${bin.hi ?? ''}`; if (b.binUnit === 'sar') { add(r, 'from', bin.lo); add(r, 'to', bin.hi); } if (bin.amount != null) add(r, 'amount', bin.amount); void i; });
  else if (k === 'box') (b.groups || []).forEach((g) => { if (isAmt(b.valueKind)) ['min', 'q1', 'median', 'q3', 'max'].forEach((f) => add(g.label, f, g[f])); });
  else if (k === 'bullet') (b.bullets || []).forEach((x) => { if (isAmt(b.valueKind)) { add(x.label, 'actual', x.actual); add(x.label, 'target', x.target); } });
  else if (k === 'treemap' || k === 'sunburst') leaves(b.tree).forEach((l) => add(l.path.join(' / '), 'value', l.value));
  else if (k === 'sankey') (b.links || []).forEach((l) => { const nm = (id) => (b.nodes || []).find((n) => n.id === id)?.label ?? id; add(`${nm(l.from)} → ${nm(l.to)}`, 'value', l.value); });
  else bySeries(() => true);
  return out;
}
