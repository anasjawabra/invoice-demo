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
export function chartInfo(block, lang = 'ar') {
  if (block.plain) return { cu: { unit: { key: 'plain', div: 1 }, title: block.valueTitle || (lang === 'ar' ? 'القيمة' : 'Value'), tick: plainNum, fmt: plainNum }, unitText: '', plain: true }; // values from an attached file: shown as they are, never scaled or labelled as SAR
  const cu = chartUnit(block.series.flatMap((s) => s.values).filter((v) => v != null), lang);
  return { cu, unitText: unitLabel(cu.unit, lang) };
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
