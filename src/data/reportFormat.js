// Formatting shared by the on-screen report and the exports, so both show the same text.
// Money columns of ONE table share ONE unit (the largest value decides), stated in the column header.
import { unitOfValues, unitLabel, scaled, fmtInt, fmtMoney, chartUnit } from '../utils/money';

export function tableUnit(table) {
  const vals = [];
  table.headers.forEach((h, j) => { if (h.kind === 'money') { table.rows.forEach((r) => { if (typeof r[j] === 'number') vals.push(r[j]); }); if (table.total && typeof table.total[j] === 'number') vals.push(table.total[j]); } });
  return unitOfValues(vals);
}
export function fmtCell(v, kind, unit, lang) {
  if (v == null || v === '') return '—';
  if (kind === 'money') return typeof v === 'number' ? scaled(v, unit) : String(v);
  if (kind === 'count') return fmtInt(v);
  if (kind === 'plain') return typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 2 })) : String(v); // a number from an attached file: its own unit, never scaled as money
  if (kind === 'pct') return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : String(v);
  return String(v);
}
// {headers, rows, total, unit, rawRows}: strings ready to display / export; rawRows keep exact SAR for Excel
export function tableToText(table, lang = 'ar') {
  const unit = tableUnit(table); const hasMoney = table.headers.some((h) => h.kind === 'money');
  const headers = table.headers.map((h) => (h.kind === 'money' ? `${h.label} (${unitLabel(unit, lang)})` : h.label));
  const fmtRow = (r) => r.map((v, j) => fmtCell(v, table.headers[j].kind, unit, lang));
  return { headers, rows: table.rows.map(fmtRow), total: table.total ? fmtRow(table.total) : null, unit: hasMoney ? unit : null, unitText: hasMoney ? unitLabel(unit, lang) : null };
}
const plainNum = (v) => (Number.isInteger(v) ? v.toLocaleString('en-US') : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const pct1 = (v) => `${(v * 100).toFixed(1)}%`;
// extension point for the chart library (docs/chart-library.md): a module that draws a new kind also registers how that kind is summarised, tabulated and unit-resolved.
// fmt = { info?(block, lang) → same shape as chartInfo, summary?(block, lang) → sentence, table?(block, lang) → {headers, rows} }
const CHART_FORMATS = {};
export function registerChartFormat(kind, fmt) { CHART_FORMATS[kind] = fmt; }
export function chartInfo(block, lang = 'ar') {
  if (CHART_FORMATS[block.kind]?.info) return CHART_FORMATS[block.kind].info(block, lang);
  if (block.plain) return { cu: { unit: { key: 'plain', div: 1 }, title: block.valueTitle || (lang === 'ar' ? 'القيمة' : 'Value'), tick: plainNum, fmt: plainNum }, unitText: '', plain: true }; // values from an attached file: shown as they are, never scaled or labelled as SAR
  if (block.kind === 'heatmap' && block.valueKind === 'rate') return { cu: { unit: { key: 'pct', div: 1 }, title: block.valueTitle || (lang === 'ar' ? 'النسبة المئوية (%)' : 'Rate (%)'), tick: pct1, fmt: pct1 }, unitText: '%', plain: false, rate: true }; // rates are fractions 0..1 shown as % with one decimal
  const vals = block.series.flatMap((s) => s.values).filter((v) => v != null);
  if (block.kind === 'stacked_hbar') block.labels.forEach((_, i) => vals.push(block.series.reduce((t, s) => t + (Number.isFinite(s.values[i]) ? s.values[i] : 0), 0))); // the unit follows the row total
  const cu = chartUnit(vals, lang);
  return { cu, unitText: unitLabel(cu.unit, lang) };
}
const KIND_NAME = { bar: ['مخطط أعمدة', 'Column chart'], hbar: ['مخطط أشرطة أفقية', 'Horizontal bar chart'], line: ['مخطط خطي', 'Line chart'], pie: ['مخطط دائري', 'Pie chart'], waterfall: ['مخطط شلال', 'Waterfall chart'], stacked_hbar: ['شريط أفقي مكدّس', 'Stacked horizontal bar'], heatmap: ['خريطة حرارية', 'Heat map'] };
// one-sentence text alternative of a chart (aria-label / <desc>)
export function chartSummary(block, lang = 'ar') {
  if (CHART_FORMATS[block.kind]?.summary) return CHART_FORMATS[block.kind].summary(block, lang);
  const ar = lang === 'ar'; const { cu, unitText } = chartInfo(block, lang); const k = block.kind || 'bar'; const name = (KIND_NAME[k] || KIND_NAME.bar)[ar ? 0 : 1];
  const unit = unitText ? ` (${unitText})` : ''; const n = block.labels.length; const m = block.series.length; const first = block.series[0]; const v = (x) => (x == null ? '—' : cu.tick(x));
  let body;
  if (k === 'waterfall' && first && n > 1) body = ar ? `من ${block.labels[0]} ${v(first.values[0])} إلى ${block.labels[n - 1]} ${v(first.values[n - 1])}${unit}` : `from ${block.labels[0]} ${v(first.values[0])} to ${block.labels[n - 1]} ${v(first.values[n - 1])}${unit}`;
  else if (k === 'heatmap') body = ar ? `${m} صفاً × ${n} عموداً${unit}؛ الخلية الفارغة تعني لا بيانات` : `${m} rows × ${n} columns${unit}; an empty cell means no data`;
  else {
    let best = null; block.series.forEach((s) => s.values.forEach((x, i) => { if (x != null && (!best || x > best.x)) best = { x, l: block.labels[i], s: s.label }; }));
    body = ar ? `${n} فئة و${m} سلسلة${unit}${best ? `؛ الأعلى: ${best.l} ${v(best.x)}` : ''}` : `${n} categories, ${m} series${unit}${best ? `; highest: ${best.l} ${v(best.x)}` : ''}`;
  }
  return `${name}: ${block.title ? `${block.title}. ` : ''}${body}.`;
}
// the chart as a table (the accessible alternative on screen): {headers, rows}
export function chartTableText(block, lang = 'ar') {
  if (CHART_FORMATS[block.kind]?.table) return CHART_FORMATS[block.kind].table(block, lang);
  const ar = lang === 'ar'; const { cu } = chartInfo(block, lang); const k = block.kind || 'bar'; const v = (x) => (x == null ? '—' : cu.tick(x));
  if (k === 'heatmap') return { headers: ['', ...block.labels], rows: block.series.map((s) => [s.label, ...block.labels.map((_, i) => v(s.values[i]))]) };
  if (k === 'waterfall') { const vals = block.series[0]?.values || []; const tot = block.totals || vals.map((_, i) => i === 0 || i === vals.length - 1); return { headers: [ar ? 'الخطوة' : 'Step', ar ? 'القيمة' : 'Value', ar ? 'النوع' : 'Type'], rows: block.labels.map((l, i) => [l, vals[i] == null ? '—' : tot[i] ? cu.tick(vals[i]) : `${vals[i] > 0 ? '+' : vals[i] < 0 ? '\u2212' : ''}${cu.tick(Math.abs(vals[i]))}`, tot[i] ? (ar ? 'إجمالي' : 'Total') : (ar ? 'تغيّر' : 'Change')]) }; }
  if (k === 'stacked_hbar') return { headers: [ar ? 'البند' : 'Item', ...block.series.map((s) => s.label), ar ? 'الإجمالي' : 'Total'], rows: block.labels.map((l, i) => { const tot = block.series.reduce((t, s) => t + (Number.isFinite(s.values[i]) ? s.values[i] : 0), 0); return [l, ...block.series.map((s) => (s.values[i] == null ? '—' : `${cu.tick(s.values[i])}${tot > 0 ? ` (${((s.values[i] / tot) * 100).toFixed(1)}%)` : ''}`)), block.series.some((s) => Number.isFinite(s.values[i])) ? cu.tick(tot) : '—']; }) };
  return { headers: [ar ? 'البند' : 'Item', ...block.series.map((s) => s.label)], rows: block.labels.map((l, i) => [l, ...block.series.map((s) => v(s.values[i]))]) };
}
export { fmtMoney };

// text helpers shared by the view and the exports
export function fillTokens(text, tokens, lang) { return !tokens ? text : text.replace(/\{(\w+)\}/g, (_, k) => (tokens[k] == null ? '' : fmtMoney(tokens[k], { lang }))); }
export function fmtEvidence(e, lang) {
  const ar = lang === 'ar';
  if (e.v == null) return ar ? 'غير متاحة' : 'Not available';
  if (e.fmt === 'money') return fmtMoney(e.v, { lang });
  if (e.fmt === 'ratio') return `${(e.v * 100).toFixed(1)}%`;
  if (e.fmt === 'pp') return `${e.v >= 0 ? '+' : ''}${e.v.toFixed(1)} ${ar ? 'نقطة' : 'pp'}`;
  return Number(e.v).toLocaleString('en-US');
}
