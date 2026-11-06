// NATIVE, EDITABLE PowerPoint charts for the template deck. A report chart block → a DrawingML chart part (ppt/charts/chartN.xml) that carries its data caches AND an embedded workbook
// (ppt/embeddings/Microsoft_Excel_SheetN.xlsx), so «Edit data» opens the numbers in PowerPoint. Colours are the template theme's own accents (schemeClr), the font is the theme's minor font
// (+mn-lt / +mn-cs), values are in the chart's ONE unit (named once, in the value-axis title), bars start at zero, a missing value is an EMPTY cell (a gap, never zero).
//
// Native kinds (legacy, byte-stable):  bar (clustered columns) · hbar (clustered horizontal bars) · line (incl. dashed series, monthly / cumulative) · pie · stacked_hbar (parts of one whole) ·
//                waterfall (the standard stacked-column technique: an invisible «base» series + total / decrease / increase series, `totals` anchoring the absolute bars).
// Not a chart part: heatmap (a native shaded table, built by the deck planner). A waterfall whose running total would cross zero cannot use the invisible-base technique and is built as a plain
// clustered column chart of the signed step values (still native and editable).
// Chart-library kinds (docs/chart-library.md, «Export support»): stacked_col · stacked100_col · stacked100_hbar (percentStacked) · area · stacked_area · combo (bars + lines, a titled secondary axis) · pareto (bars + cumulative-share line on a
// secondary axis) · histogram (gap-free columns, bin labels) · donut · scatter · bubble — each a native, editable DrawingML chart with its embedded workbook.
// NO native form (an SVG picture with a PNG fallback, produced by the shared renderer, is placed by the deck planner instead — never another chart type): bullet · box · treemap · sunburst · sankey, and a block that a native chart would
// misdraw (area with a missing value — PowerPoint draws it as zero; a chart of more parts than the renderer allows). PPTX_SUPPORT is the single source of truth the catalog and the export dialog read.
// This file only builds XML strings and workbook bytes; it never touches the package.
import * as XLSX from 'xlsx';
import { chartInfo } from '../data/reportFormat';
import { chartUnit, unitLabel } from './money';
export { PDF_SUPPORT, WORD_SUPPORT, XLSX_SUPPORT } from './chartExportData';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const NS = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
// series colours = the template theme accents, in the order the template's own charts use them (dark teal, green, cyan, grey, mid teal, orange)
const PAL = [{ c: 'dk2', dark: true }, { c: 'accent3', dark: false }, { c: 'accent6', dark: false }, { c: 'accent5', dark: true }, { c: 'accent4', dark: true }, { c: 'hlink', dark: true }];
const clr = (name, mods = '') => `<a:schemeClr val="${name}">${mods}</a:schemeClr>`;
const fill = (name) => `<a:solidFill>${clr(name)}</a:solidFill>`;
const GREY_TXT = clr('dk1', '<a:lumMod val="65000"/><a:lumOff val="35000"/>');
const GRID = clr('lt1', '<a:lumMod val="85000"/>');
export const NATIVE_KINDS = ['bar', 'hbar', 'line', 'pie', 'stacked_hbar', 'waterfall'];
export const NEW_NATIVE_KINDS = ['stacked_col', 'stacked100_col', 'stacked100_hbar', 'area', 'stacked_area', 'combo', 'pareto', 'histogram', 'donut', 'scatter', 'bubble'];
// what the PowerPoint export really does with each chart kind (read by chartCatalog.exportPlan and the export dialog):
//   'native'       an editable DrawingML chart with an embedded workbook («Edit data» works)
//   'native-table' a native, shaded PowerPoint table (heat map)
//   'vector-image' an SVG picture (PNG fallback) drawn by the shared renderer + the data table in the appendix; not editable as a chart
export const PPTX_SUPPORT = {
  bar: 'native', hbar: 'native', line: 'native', pie: 'native', waterfall: 'native', stacked_hbar: 'native',
  stacked_col: 'native', stacked100_col: 'native', stacked100_hbar: 'native', area: 'native', stacked_area: 'native', combo: 'native', pareto: 'native', histogram: 'native', donut: 'native', scatter: 'native', bubble: 'native',
  heatmap: 'native-table',
  bullet: 'vector-image', box: 'vector-image', treemap: 'vector-image', sunburst: 'vector-image', sankey: 'vector-image'
};
// why a kind (or a block of that kind) is not native, in the words the slide and the export dialog use
export const PPTX_FALLBACK_NOTE = {
  bullet: { ar: 'لا يوجد مخطط رصاصة (Bullet) أصلي في PowerPoint: الرسم صورة متجهية بنطاقاتها وهدفها المعتمد.', en: 'PowerPoint has no native bullet chart: the drawing is a vector image with its ranges and approved target.' },
  box: { ar: 'لا يوجد مخطط صندوقي أصلي في PowerPoint المتوافق: الرسم صورة متجهية.', en: 'There is no native box plot in compatible PowerPoint: the drawing is a vector image.' },
  treemap: { ar: 'خريطة الشجرة ليست نوعاً أصلياً قابلاً للتحرير هنا: الرسم صورة متجهية (وليست مخططاً أعمدة).', en: 'The treemap is not an editable native type here: the drawing is a vector image (not a bar chart).' },
  sunburst: { ar: 'مخطط الشمس المشعة ليس نوعاً أصلياً قابلاً للتحرير هنا: الرسم صورة متجهية.', en: 'The sunburst is not an editable native type here: the drawing is a vector image.' },
  sankey: { ar: 'مخطط ساكي (Sankey) غير متوفر أصلياً في PowerPoint: الرسم صورة متجهية.', en: 'PowerPoint has no native Sankey: the drawing is a vector image.' }
};
const IMAGE_NOTE = { ar: 'صورة رسم متجهية (لا تُحرَّر كمخطط) — البيانات في الجدول', en: 'Chart image (not editable as a chart) — data in the table' };
const NO_CAUSE = { ar: 'يُظهر الرسم ارتباطاً بين قيمتين فقط، ولا يعني أن إحداهما سبب الأخرى.', en: 'The chart shows how two measures move together; it does not mean one causes the other.' };

const colName = (i) => { let n = i + 1; let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
// ONE number format per chart: whole numbers when every value is whole, otherwise one or two decimals (0.0# keeps «14.7» and «0.93»)
const numFmtFor = (vals) => { const v = vals.filter((x) => x != null && Number.isFinite(x)); return !v.length || v.every((x) => Number.isInteger(x)) ? '#,##0' : '#,##0.0#'; };
// the value-axis tick format: few decimals (ticks are round numbers)
const axisFmtFor = (vals, fmt) => { const mx = Math.max(0, ...vals.filter((x) => x != null).map(Math.abs)); return fmt === '#,##0' || mx >= 20 ? '#,##0' : mx >= 2 ? '#,##0.0' : '#,##0.00'; };

/* ------------------------------------------------------------------ the spec: what to draw, in the chart's ONE unit */
// block → { kind, labels, series:[{name, values, dashed, role}], fmt, axisTitle, lang, … }, or null when the block cannot be a chart part
export function chartSpecFor(block, { lang = 'en' } = {}) {
  const L = (a, e) => (lang === 'ar' ? a : e); const info = chartInfo(block, lang); const div = info.cu.unit.div || 1;
  const sv = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number((Number(v) / div).toFixed(4)));
  const labels = (block.labels || []).map((l) => String(l ?? ''));
  let kind = block.kind || 'bar';
  if (NEW_NATIVE_KINDS.includes(kind)) return newSpecFor(block, { lang });
  if (!NATIVE_KINDS.includes(kind) || !labels.length) return null;
  let series = (block.series || []).map((s) => ({ name: String(s.label ?? ''), values: labels.map((_, i) => sv(s.values?.[i])), dashed: !!s.dashed, role: s.role }));
  if (!series.length || !series.some((s) => s.values.some((v) => v != null))) return null;
  const basisLabel = block.basis === 'cumulative' ? L('تراكمي', 'cumulative') : block.basis === 'monthly' ? L('شهري', 'monthly') : '';
  const axisTitle = `${info.cu.title}${basisLabel ? ` (${basisLabel})` : ''}`;
  const spec = { kind, labels, series, axisTitle, lang, unit: info.unitText, plain: !!info.plain, title: block.title };
  if (kind === 'pie') { spec.series = series.slice(0, 1); }
  if (kind === 'stacked_hbar') { // each part carries its share of the whole in its legend name (static text at build time)
    const total = series.reduce((t, s) => t + (s.values[0] ?? 0), 0);
    spec.series = series.map((s) => ({ ...s, name: total > 0 && s.values[0] != null ? `${s.name} (${(s.values[0] / total * 100).toFixed(1)}%)` : s.name }));
  }
  if (kind === 'waterfall') {
    const w = waterfallSeries({ values: series[0].values, totals: block.totals, lang });
    if (w) { spec.waterfall = w; spec.series = w.cols; } else { spec.kind = 'bar'; spec.series = [series[0]]; spec.fallbackFrom = 'waterfall'; }
  }
  spec.fmt = numFmtFor(spec.series.flatMap((s) => s.values));
  Object.assign(spec, cfgFlags(block)); // showLabels / showLegend only when the report view set them (an unset flag keeps the automatic rules)
  return spec;
}
// the applied presentation config (a view setting; never a data change) → the two flags the native chart can honour
// (the renderers read block.showLabels / block.showLegend; the applied config {labels, legend} says the same — either one counts)
const cfgFlags = (block) => { const c = block.config || {}; const lb = typeof block.showLabels === 'boolean' ? block.showLabels : c.labels; const lg = typeof block.showLegend === 'boolean' ? block.showLegend : c.legend; return { ...(typeof lb === 'boolean' ? { showLabels: lb } : {}), ...(typeof lg === 'boolean' ? { showLegend: lg } : {}) }; };

// the stacked-column waterfall: Base (invisible) + Total + Decrease + Increase. totals[i] = an absolute level anchored at zero; the others float from the running total.
export function waterfallSeries({ values, totals, lang = 'en' }) {
  const L = (a, e) => (lang === 'ar' ? a : e); const n = values.length;
  const isTotal = (i) => (Array.isArray(totals) ? !!totals[i] : i === 0 || i === n - 1);
  const base = []; const tot = []; const dn = []; const up = []; const signed = []; let run = 0; const r4 = (x) => Number(x.toFixed(4));
  for (let i = 0; i < n; i += 1) {
    const v = values[i]; base.push(null); tot.push(null); dn.push(null); up.push(null); signed.push(v);
    if (v == null) continue;
    if (isTotal(i)) { tot[i] = v; run = v; if (v < 0) return null; continue; }
    const next = run + v; if (next < -1e-9 || run < -1e-9) return null; // crossing zero: the invisible-base technique does not hold
    if (v < 0) { base[i] = r4(next); dn[i] = r4(-v); } else { base[i] = r4(run); up[i] = r4(v); }
    run = r4(next);
  }
  const cols = [{ name: L('الأساس (غير مرئي)', 'Base (hidden)'), values: base, role: 'base' }, { name: L('الإجمالي', 'Total'), values: tot, role: 'total' }, { name: L('نقص', 'Decrease'), values: dn, role: 'decrease' }, { name: L('زيادة', 'Increase'), values: up, role: 'increase' }];
  // columns with no value at all (e.g. no increase) are kept out of the chart; the Base column is always kept
  return { cols: cols.filter((c) => c.role === 'base' || c.values.some((v) => v != null)), signed };
}

/* ------------------------------------------------------------------ XML pieces */
const txPr = ({ sz = 1000, color = GREY_TXT, b = 0, rtl = false, rot = null }) => `<c:txPr><a:bodyPr${rot != null ? ` rot="${rot}" vert="horz"` : ''}/><a:lstStyle/><a:p><a:pPr${rtl ? ' rtl="1"' : ''}><a:defRPr sz="${sz}" b="${b}"><a:solidFill>${color}</a:solidFill><a:latin typeface="+mn-lt"/><a:cs typeface="+mn-cs"/></a:defRPr></a:pPr><a:endParaRPr lang="${rtl ? 'ar-SA' : 'en-US'}"/></a:p></c:txPr>`;
const strRef = (f, arr) => `<c:strRef><c:f>${f}</c:f><c:strCache><c:ptCount val="${arr.length}"/>${arr.map((t, i) => `<c:pt idx="${i}"><c:v>${esc(t)}</c:v></c:pt>`).join('')}</c:strCache></c:strRef>`;
const numRef = (f, vals, fmt) => `<c:numRef><c:f>${f}</c:f><c:numCache><c:formatCode>${esc(fmt)}</c:formatCode><c:ptCount val="${vals.length}"/>${vals.map((v, i) => (v == null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join('')}</c:numCache></c:numRef>`;
const showFlags = (o = {}) => `<c:showLegendKey val="0"/><c:showVal val="${o.val ? 1 : 0}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${o.pct ? 1 : 0}"/><c:showBubbleSize val="0"/>`;
const lblBlock = ({ fmt, pos, color, sz, rtl, val = true, pct = false, extra = '' }) => `<c:numFmt formatCode="${esc(fmt)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr({ sz, color, rtl })}${pos ? `<c:dLblPos val="${pos}"/>` : ''}${showFlags({ val, pct })}${extra}`;

function catValRefs(spec, k, nPts) {
  const col = colName(k + 1); const last = nPts + 1;
  return { tx: `<c:tx>${strRef(`Sheet1!$${col}$1`, [spec.series[k].name])}</c:tx>`, cat: `<c:cat>${strRef(`Sheet1!$A$2:$A$${last}`, spec.labels)}</c:cat>`, val: `<c:val>${numRef(`Sheet1!$${col}$2:$${col}$${last}`, spec.series[k].values, spec.fmt)}</c:val>` };
}
// which series carry data labels, and how many points make a label crowded
const crowded = (spec) => { if (spec.showLabels != null) return !spec.showLabels; const n = spec.labels.length * spec.series.filter((s) => s.role !== 'base').length; return spec.kind === 'hbar' ? n > 36 : spec.kind === 'pie' ? n > 10 : n > 24; };

function ser(spec, k, { geom, colorIdx, rtl, szLbl }) {
  const s = spec.series[k]; const refs = catValRefs(spec, k, spec.labels.length); const p = PAL[colorIdx % PAL.length];
  const stacked = spec.kind === 'waterfall' || spec.kind === 'stacked_hbar';
  if (geom === 'pie') {
    const dpts = spec.labels.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(PAL[i % PAL.length].c)}<a:ln w="12700"><a:solidFill>${clr('lt1')}</a:solidFill></a:ln></c:spPr></c:dPt>`).join('');
    const dl = crowded(spec) ? '<c:dLbls><c:delete val="1"/></c:dLbls>' : `<c:dLbls>${lblBlock({ fmt: '0.0%', pos: 'outEnd', color: GREY_TXT, sz: szLbl, rtl, val: false, pct: true, extra: '<c:showLeaderLines val="1"/>' })}</c:dLbls>`;
    return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${refs.tx}${dpts}${dl}${refs.cat}${refs.val}</c:ser>`;
  }
  if (s.role === 'base') return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${refs.tx}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:invertIfNegative val="0"/><c:dLbls><c:delete val="1"/></c:dLbls>${refs.cat}${refs.val}</c:ser>`;
  const roleColor = s.role === 'total' ? PAL[0] : s.role === 'decrease' ? PAL[5] : s.role === 'increase' ? PAL[1] : p;
  const sp = geom === 'line'
    ? `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill>${clr(roleColor.c)}</a:solidFill>${s.dashed ? '<a:prstDash val="dash"/>' : ''}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${fill(roleColor.c)}<a:ln w="9525"><a:solidFill>${clr(roleColor.c)}</a:solidFill></a:ln></c:spPr></c:marker>`
    : `<c:spPr>${fill(roleColor.c)}</c:spPr><c:invertIfNegative val="0"/>`;
  let dl;
  const fmt = s.role === 'decrease' ? `\\-${spec.fmt}` : spec.fmt;
  const lblColor = stacked ? (roleColor.dark ? clr('lt1') : clr('dk1')) : GREY_TXT;
  if (geom === 'line') {
    const pts = spec.labels.length * spec.series.length;
    if (spec.showLabels === false) dl = '<c:dLbls><c:delete val="1"/></c:dLbls>';
    else if (pts <= 14 || spec.showLabels === true) dl = `<c:dLbls>${lblBlock({ fmt, pos: 't', color: GREY_TXT, sz: szLbl, rtl })}</c:dLbls>`;
    else { const lastIdx = s.values.reduce((a, v, i) => (v != null ? i : a), -1); dl = lastIdx < 0 ? '<c:dLbls><c:delete val="1"/></c:dLbls>' : `<c:dLbls><c:dLbl><c:idx val="${lastIdx}"/>${lblBlock({ fmt, pos: 't', color: GREY_TXT, sz: szLbl, rtl })}</c:dLbl>${showFlags({ val: false })}</c:dLbls>`; }
  } else if (crowded(spec)) dl = '<c:dLbls><c:delete val="1"/></c:dLbls>';
  else dl = `<c:dLbls>${lblBlock({ fmt, pos: stacked ? (s.role === 'total' || spec.kind === 'stacked_hbar' ? 'ctr' : 'ctr') : 'outEnd', color: lblColor, sz: szLbl, rtl })}</c:dLbls>`;
  return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${refs.tx}${sp}${dl}${refs.cat}${refs.val}${geom === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
}

/* ------------------------------------------------------------------ the chart part */
export function chartXml(spec) {
  if (NEW_NATIVE_KINDS.includes(spec.kind)) return chartXmlNew(spec);
  const rtl = spec.lang === 'ar'; const k = spec.kind; const szTxt = rtl ? 1200 : 1000; const szLbl = rtl ? 1100 : 900;
  const horizontal = k === 'hbar' || k === 'stacked_hbar'; const geom = k === 'line' ? 'line' : k === 'pie' ? 'pie' : 'bar';
  const stacked = k === 'waterfall' || k === 'stacked_hbar';
  const allVals = spec.series.flatMap((s) => s.values).filter((v) => v != null);
  const nonNeg = allVals.every((v) => v >= 0);
  const sers = spec.series.map((s, i) => {
    const colorIdx = k === 'waterfall' ? i : i; return ser(spec, i, { geom, colorIdx, rtl, szLbl });
  }).join('');
  let group;
  if (geom === 'pie') group = `<c:pieChart><c:varyColors val="1"/>${sers}<c:firstSliceAng val="0"/></c:pieChart>`;
  else if (geom === 'line') group = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/><c:axId val="50010"/><c:axId val="50020"/></c:lineChart>`;
  else group = `<c:barChart><c:barDir val="${horizontal ? 'bar' : 'col'}"/><c:grouping val="${stacked ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${sers}<c:gapWidth val="${stacked ? 60 : 80}"/>${stacked ? '<c:overlap val="100"/>' : ''}<c:axId val="50010"/><c:axId val="50020"/></c:barChart>`;
  // axes. Arabic reads right to left: columns / lines list the categories from the right (the value axis then sits on the right); horizontal bars grow from the right and list top to bottom.
  let axes = '';
  if (geom !== 'pie') {
    const lineLn = `<c:spPr><a:ln w="9525"><a:solidFill>${clr('dk1', '<a:lumMod val="50000"/><a:lumOff val="50000"/>')}</a:solidFill></a:ln></c:spPr>`;
    const catOrient = horizontal ? 'maxMin' : (rtl ? 'maxMin' : 'minMax'); // first category on top for horizontal bars
    const valOrient = horizontal && rtl ? 'maxMin' : 'minMax';
    const catPos = horizontal ? (rtl ? 'r' : 'l') : 'b'; const valPos = horizontal ? 'b' : (rtl ? 'r' : 'l');
    const valCrosses = horizontal ? 'max' : 'autoZero'; // horizontal: the value labels stay at the bottom although the categories run top to bottom
    const axTitle = `<c:title><c:tx><c:rich><a:bodyPr${horizontal ? '' : ' rot="-5400000" vert="horz"'}/><a:lstStyle/><a:p><a:pPr${rtl ? ' rtl="1"' : ''}><a:defRPr sz="${szTxt - 100}" b="0"><a:solidFill>${GREY_TXT}</a:solidFill><a:latin typeface="+mn-lt"/><a:cs typeface="+mn-cs"/></a:defRPr></a:pPr><a:r><a:rPr lang="${rtl ? 'ar-SA' : 'en-US'}" sz="${szTxt - 100}" b="0"><a:solidFill>${GREY_TXT}</a:solidFill><a:latin typeface="+mn-lt"/><a:cs typeface="+mn-cs"/></a:rPr><a:t>${esc(spec.axisTitle)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
    axes = `<c:catAx><c:axId val="50010"/><c:scaling><c:orientation val="${catOrient}"/></c:scaling><c:delete val="0"/><c:axPos val="${catPos}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>${lineLn}${txPr({ sz: szTxt, rtl })}<c:crossAx val="50020"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
      + `<c:valAx><c:axId val="50020"/><c:scaling><c:orientation val="${valOrient}"/>${nonNeg ? '<c:min val="0"/>' : ''}</c:scaling><c:delete val="0"/><c:axPos val="${valPos}"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill>${GRID}</a:solidFill></a:ln></c:spPr></c:majorGridlines>${axTitle}<c:numFmt formatCode="${esc(axisFmtFor(allVals, spec.fmt))}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr({ sz: szTxt - 100, rtl })}<c:crossAx val="50010"/><c:crosses val="${valCrosses}"/><c:crossBetween val="between"/></c:valAx>`;
  }
  const visible = spec.series.filter((s) => s.role !== 'base');
  const showLegend = spec.showLegend != null ? (spec.showLegend && k !== 'waterfall') : k === 'pie' || (visible.length > 1 && k !== 'waterfall');
  const legend = showLegend ? `<c:legend><c:legendPos val="${k === 'pie' ? 'r' : 't'}"/>${spec.series.map((s, i) => (s.role === 'base' ? `<c:legendEntry><c:idx val="${i}"/><c:delete val="1"/></c:legendEntry>` : '')).join('')}<c:overlay val="0"/>${txPr({ sz: szTxt, rtl })}</c:legend>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace ${NS}><c:date1904 val="0"/><c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>${group}${axes}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr({ sz: szTxt, rtl })}<c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>`;
}

// the embedded workbook the chart's «Edit data» opens: column A = categories, one column per charted series (empty cell = no value); a waterfall also lists the signed step values after the chart range
export function chartWorkbook(spec) {
  if (spec.sheet) return writeSheet(spec.sheet);
  const head = ['', ...spec.series.map((s) => s.name)]; const rows = spec.labels.map((lab, i) => [lab, ...spec.series.map((s) => (s.values[i] == null ? null : s.values[i]))]);
  const aoa = [head, ...rows];
  if (spec.waterfall) { aoa[0] = [...aoa[0], '', spec.lang === 'ar' ? 'قيمة الخطوة (بإشارتها)' : 'Step value (signed)']; spec.labels.forEach((_, i) => { aoa[i + 1] = [...aoa[i + 1], null, spec.waterfall.signed[i]]; }); }
  const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}
export const chartRelsXml = (n) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Microsoft_Excel_Sheet${n}.xlsx"/></Relationships>`;

/* ================================================================== chart-library kinds (docs/chart-library.md) ================================================================== */
const AX = { c1: 50010, v1: 50020, c2: 50030, v2: 50040 };
const fin = (v) => v != null && Number.isFinite(Number(v));
const r4 = (x) => Number(Number(x).toFixed(4));
const trimNum = (s) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
// the chart unit of a value set (SAR → thousand / million / billion); `plain` blocks (counts, days, an attached file's numbers) are never scaled or called SAR
function unitOf(vals, lang, plain, title) {
  const L = (a, e) => (lang === 'ar' ? a : e);
  if (plain) return { div: 1, title: title || L('القيمة', 'Value'), unitText: '' };
  const cu = chartUnit(vals.filter(fin), lang); const ut = unitLabel(cu.unit, lang);
  return { div: cu.unit.div || 1, title: title ? `${title} — ${ut}` : cu.title, unitText: ut };
}
// one axis of a measure: kind 'amount' (scaled to the unit of its own values) · 'rate' (a fraction shown as %) · 'days' · 'count'
function measureAxis(kind, vals, lang, title) {
  const L = (a, e) => (lang === 'ar' ? a : e);
  if (kind === 'rate') return { kind, div: 1, fmt: '0.0%', axisFmt: '0%', title: title || L('النسبة (%)', 'Rate (%)'), unitText: '%' };
  if (kind === 'days') return { kind, div: 1, fmt: '#,##0.#', axisFmt: '#,##0', title: title || L('أيام', 'Days'), unitText: L('أيام', 'days') };
  if (kind === 'count') return { kind, div: 1, fmt: '#,##0', axisFmt: '#,##0', title: title || L('العدد', 'Count'), unitText: '' };
  const u = unitOf(vals, lang, false, title); const sc = vals.filter(fin).map((v) => v / u.div);
  return { kind: 'amount', div: u.div, fmt: numFmtFor(sc), axisFmt: axisFmtFor(sc, numFmtFor(sc)), title: u.title, unitText: u.unitText };
}
const sc = (div) => (v) => (fin(v) ? r4(Number(v) / div) : null);
const basisOf = (block, lang) => (block.basis === 'cumulative' ? (lang === 'ar' ? 'تراكمي' : 'Cumulative') : block.basis === 'monthly' ? (lang === 'ar' ? 'شهري' : 'Monthly') : '');

// Why a block of a native-capable kind cannot be a faithful native chart (→ the planner places the vector image of the SAME kind and says so), or null.
export function nativeBlocker(block, lang = 'en') {
  const L = (a, e) => ({ ar: a, en: e }); const k = block.kind || 'bar';
  const ser = block.series || []; const labels = block.labels || [];
  const anyNull = ser.some((s) => labels.some((_, i) => !fin(s.values?.[i])));
  if ((k === 'area' || k === 'stacked_area') && anyNull) return L('القيمة المفقودة لا تُرسم أصلياً في مخطط المساحة (يرسمها PowerPoint صفراً): الصورة المتجهية تُبقيها فجوة.', 'A missing value cannot be a gap in a native area chart (PowerPoint draws it as zero): the vector image keeps it a gap.');
  if ((k === 'stacked100_col' || k === 'stacked100_hbar') && ser.some((s) => (s.values || []).some((v) => fin(v) && v < 0))) return L('الأجزاء السالبة لا تصلح لمخطط 100٪ المكدّس.', 'Negative parts do not fit a 100 % stacked chart.');
  if (k === 'donut' && (labels.length > 8 || ser[0]?.values?.some((v) => fin(v) && v < 0))) return L('الدائري المجوّف يقبل حتى ٨ أجزاء غير سالبة.', 'A donut takes at most 8 non-negative parts.');
  if (k === 'pareto' && (ser.length !== 1 || ser[0].values.some((v) => !fin(v) || v < 0))) return L('باريتو يحتاج سلسلة واحدة غير سالبة بلا قيم مفقودة.', 'Pareto needs one non-negative series without missing values.');
  if (k === 'combo' && (ser.some((s) => s.type !== 'line' && s.axis === 'secondary') || !ser.some((s) => s.axis !== 'secondary'))) return L('الأعمدة على المحور الثانوي (أو غياب المحور الأول) غير مدعوم أصلياً.', 'Bars on the secondary axis (or no first-axis series) are not supported natively.');
  if (k === 'scatter' || k === 'bubble') { const pts = (block.points || []).filter((p) => fin(p.x) && fin(p.y) && (k === 'scatter' || fin(p.size))); if (!pts.length) return L('لا نقاط صالحة للرسم.', 'No plottable points.'); }
  if (k === 'histogram' && !(block.bins || []).length) return L('لا فئات.', 'No bins.');
  return null;
}

// the donut's fixed plot-area layout (fractions of the chart frame) so the planner knows where the hole is and can place the total in it
const DONUT_LAYOUT = (legend) => (legend ? { x: 0.17, y: 0.03, w: 0.66, h: 0.74 } : { x: 0.08, y: 0.04, w: 0.84, h: 0.92 });
function newSpecFor(block, { lang }) {
  const L = (a, e) => (lang === 'ar' ? a : e); const kind = block.kind;
  if (nativeBlocker(block, lang)) return null;
  const flags = cfgFlags(block); const base = { kind, lang, title: block.title, plain: !!block.plain, ...flags };
  const labels = (block.labels || []).map((l) => String(l ?? ''));
  const basis = basisOf(block, lang);
  const withBasis = (t, rate = false) => (basis && !rate ? `${basis} — ${t}` : t); // named like the screen: «Monthly — Value — bn SAR»
  const seriesOf = (ser, div) => ser.map((s) => ({ name: String(s.label ?? ''), values: labels.map((_, i) => sc(div)(s.values?.[i])), dashed: !!s.dashed, role: s.role }));
  const hasData = (ser) => ser.length && ser.some((s) => s.values.some((v) => v != null));
  if (['stacked_col', 'stacked100_col', 'stacked100_hbar', 'area', 'stacked_area', 'donut'].includes(kind)) {
    if (!labels.length || !(block.series || []).length) return null;
    const info = chartInfo(block, lang); const div = info.cu.unit.div || 1;
    const series = seriesOf(kind === 'donut' ? block.series.slice(0, 1) : block.series, div); if (!hasData(series)) return null;
    const spec = { ...base, labels, series, unit: info.unitText, markers: block.markers !== false };
    spec.fmt = info.rate ? '0.0%' : numFmtFor(series.flatMap((s) => s.values)); if (info.rate) spec.rate = true;
    if (kind === 'stacked100_col' || kind === 'stacked100_hbar') { spec.pct = true; spec.axisTitle = `${L('الحصة من إجمالي كل فئة (%)', 'Share of each category’s total (%)')}${info.unitText ? ` — ${L('تسميات القيم بوحدة', 'value labels in')}: ${info.unitText}` : ''}`; }
    else spec.axisTitle = withBasis(info.cu.title, info.rate);
    if (kind === 'donut') { // the renderer's order: positive parts largest first, then the zero / missing parts (listed in the legend, no area)
      const vals = series[0].values; const idx = vals.map((v, i) => i); const pos = idx.filter((i) => vals[i] > 0).sort((a, z) => vals[z] - vals[a] || a - z); const rest = idx.filter((i) => !(vals[i] > 0));
      const ord = [...pos, ...rest]; spec.labels = ord.map((i) => labels[i]); spec.series = [{ ...series[0], values: ord.map((i) => vals[i]) }];
      const total = pos.reduce((t, i) => t + vals[i], 0); spec.total = total;
      const lay = DONUT_LAYOUT(spec.showLegend !== false); spec.layout = lay; spec.center = { text: info.rate ? `${(total * 100).toFixed(1)}%` : trimNum(total.toFixed(2)), sub: info.unitText || '', fx: lay.x + lay.w / 2, fy: lay.y + lay.h / 2, d: Math.min(lay.w, lay.h) };
    }
    return spec;
  }
  if (kind === 'combo') {
    if (!labels.length) return null;
    const ser = block.series || []; const prim = ser.filter((s) => s.axis !== 'secondary'); const secs = ser.filter((s) => s.axis === 'secondary');
    const ax2 = block.axis2 || {}; const k1 = block.valueKind || (block.plain ? 'count' : 'amount'); const k2 = ax2.kind || 'rate'; // the renderer's defaults: first axis = amount, second axis = rate
    const pa = measureAxis(k1, prim.flatMap((s) => s.values || []), lang, block.valueTitle); const pu = { div: pa.div, title: pa.title, unitText: pa.unitText };
    const ma = secs.length ? measureAxis(k2, secs.flatMap((s) => s.values || []), lang, ax2.title) : null;
    const series = ser.map((s) => {
      const second = s.axis === 'secondary'; const a = second ? ma : pa; const sv = a.kind === 'rate' ? (v) => (fin(v) ? Number(Number(v).toFixed(6)) : null) : sc(a.div);
      const values = labels.map((_, i) => sv(s.values?.[i])); const fm = a.kind === 'rate' ? '0.0%' : second ? ma.fmt : numFmtFor(values);
      return { name: String(s.label ?? ''), values, type: s.type === 'line' ? 'line' : 'bar', axis: second ? 'secondary' : 'primary', dashed: !!s.dashed, role: s.role, fmt: fm };
    });
    if (!hasData(series)) return null;
    const spec = { ...base, labels, series, axisTitle: withBasis(pu.title, pa.kind === 'rate'), unit: pu.unitText, markers: block.markers !== false, fmt: pa.kind === 'rate' ? '0.0%' : numFmtFor(series.filter((s) => s.axis === 'primary').flatMap((s) => s.values)), axisFmt: pa.axisFmt };
    if (ma) { spec.axis2 = { title: ma.title, fmt: ma.axisFmt, kind: ma.kind, min: ma.kind === 'rate' || ma.kind === 'count' ? 0 : null, max: ma.kind === 'rate' && secs.every((s) => (s.values || []).every((v) => !fin(v) || v <= 1)) ? 1 : null }; }
    return spec;
  }
  if (kind === 'pareto') {
    const s = block.series[0]; const pairs = labels.map((l, i) => ({ l, v: Number(s.values[i]), i }));
    const other = block.otherLabel != null ? pairs.find((p) => p.l === String(block.otherLabel)) : null;
    const rest = pairs.filter((p) => p !== other).sort((a, b) => b.v - a.v || a.i - b.i); const ordered = other ? [...rest, other] : rest;
    const total = ordered.reduce((t, p) => t + p.v, 0); if (!(total > 0)) return null;
    const info = chartInfo(block, lang); const div = info.cu.unit.div || 1; let run = 0;
    const bars = ordered.map((p) => r4(p.v / div)); const cum = ordered.map((p) => { run += p.v; return Number((run / total).toFixed(6)); });
    const pfm = info.rate ? '0.0%' : numFmtFor(bars);
    const series = [{ name: String(s.label ?? ''), values: bars, type: 'bar', axis: 'primary', fmt: pfm }, { name: L('النسبة التراكمية من الإجمالي (%)', 'Cumulative share of total (%)'), values: cum, type: 'line', axis: 'secondary', fmt: '0.0%' }];
    const nR = ordered.length; // the embedded sheet keeps the cumulative share a LIVE formula, so editing a bar in «Edit data» re-computes the line
    const sheet = [['', series[0].name, series[1].name], ...ordered.map((p, i) => [p.l, bars[i], { t: 'n', v: cum[i], f: `SUM(B$2:B${i + 2})/SUM(B$2:B$${nR + 1})`, z: '0.0%' }])];
    return { ...base, sheet, labels: ordered.map((p) => p.l), series, axisTitle: withBasis(info.cu.title, info.rate), unit: info.unitText, markers: true, fmt: pfm, rate: !!info.rate, axis2: { title: L('النسبة التراكمية من الإجمالي (%)', 'Cumulative share of total (%)'), fmt: '0%', kind: 'rate', min: 0, max: 1 }, paretoTotal: total / div };
  }
  if (kind === 'histogram') {
    const bins = block.bins; const useAmt = block.valueKind === 'amount' && bins.some((b) => fin(b.amount)); // the renderer's rule: counts unless valueKind says amount and the bins carry amounts
    const sar = block.binUnit !== 'days'; const edges = bins.flatMap((b) => [b.lo, b.hi]).filter(fin);
    const xa = measureAxis(sar ? 'amount' : 'days', edges, lang, block.xTitle); const tick = chartUnit(edges.length ? edges : [0], lang).tick; const t = (v) => (sar ? tick(v) : String(+Number(v).toFixed(2)));
    const lab = bins.map((b) => (fin(b.lo) && fin(b.hi) ? `${t(b.lo)} – ${t(b.hi)}` : fin(b.lo) ? `≥ ${t(b.lo)}` : fin(b.hi) ? `< ${t(b.hi)}` : L('غير محدد', 'unspecified')));
    let yv; let ya;
    if (useAmt) { ya = measureAxis('amount', bins.map((b) => b.amount), lang, block.valueTitle); yv = bins.map((b) => (fin(b.amount) ? r4(b.amount / ya.div) : null)); }
    else { ya = measureAxis('count', [], lang, block.valueTitle); yv = bins.map((b) => (fin(b.count) ? Number(b.count) : null)); }
    const fmt = useAmt ? numFmtFor(yv) : '#,##0';
    const sheet = [['', ya.title, ...(useAmt ? [L('العدد', 'Count')] : []), L('من', 'From'), L('إلى', 'To')], ...bins.map((b, i) => [lab[i], yv[i], ...(useAmt ? [b.count ?? null] : []), b.lo ?? null, b.hi ?? null])];
    return { ...base, labels: lab, series: [{ name: ya.title, values: yv }], fmt, axisTitle: ya.title, catTitle: xa.title, sheet, noLegend: true };
  }
  if (kind === 'scatter' || kind === 'bubble') {
    const pts = block.points.filter((p) => fin(p.x) && fin(p.y) && (kind === 'scatter' || fin(p.size)));
    const xa = measureAxis(block.xKind || 'amount', pts.map((p) => p.x), lang, block.xTitle); const ya = measureAxis(block.yKind || 'amount', pts.map((p) => p.y), lang, block.yTitle);
    const za = kind === 'bubble' ? measureAxis(block.sizeKind || 'amount', pts.map((p) => p.size), lang, block.sizeTitle) : null;
    const tr = (a, v) => (a.kind === 'rate' ? Number(Number(v).toFixed(6)) : r4(Number(v) / a.div));
    const P = pts.map((p) => ({ label: String(p.label ?? ''), x: tr(xa, p.x), y: tr(ya, p.y), ...(za ? { size: tr(za, p.size) } : {}) }));
    const sheet = [[L('النقطة', 'Point'), xa.title, ya.title, ...(za ? [za.title] : [])], ...P.map((p) => [p.label, p.x, p.y, ...(za ? [p.size] : [])])];
    return { ...base, labels: P.map((p) => p.label), series: [{ name: ya.title, values: P.map((p) => p.y) }], points: P, xa, ya, za, sheet, noLegend: true, dropped: (block.points || []).length - pts.length,
      notes: [NO_CAUSE, ...(za ? [{ ar: `مساحة الفقاعة = ${za.title}.`, en: `Bubble area = ${za.title}.` }] : [])] };
  }
  return null;
}

/* ------------------------------------------------------------------ XML for the new kinds */
const AXLINE = `<c:spPr><a:ln w="9525"><a:solidFill>${clr('dk1', '<a:lumMod val="50000"/><a:lumOff val="50000"/>')}</a:solidFill></a:ln></c:spPr>`;
const axTitleX = (text, { rtl, sz, vertical }) => `<c:title><c:tx><c:rich><a:bodyPr${vertical ? ' rot="-5400000" vert="horz"' : ''}/><a:lstStyle/><a:p><a:pPr${rtl ? ' rtl="1"' : ''}><a:defRPr sz="${sz}" b="0"><a:solidFill>${GREY_TXT}</a:solidFill><a:latin typeface="+mn-lt"/><a:cs typeface="+mn-cs"/></a:defRPr></a:pPr><a:r><a:rPr lang="${rtl ? 'ar-SA' : 'en-US'}" sz="${sz}" b="0"><a:solidFill>${GREY_TXT}</a:solidFill><a:latin typeface="+mn-lt"/><a:cs typeface="+mn-cs"/></a:rPr><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
const catAxX = ({ id, cross, orient, pos, del = false, rtl, sz, title = '' }) => `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="${orient}"/></c:scaling><c:delete val="${del ? 1 : 0}"/><c:axPos val="${pos}"/>${title}<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>${AXLINE}${txPr({ sz, rtl })}<c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
const valAxX = ({ id, cross, orient = 'minMax', pos, crosses = 'autoZero', min = null, max = null, major = null, fmt, title = '', grid = true, rtl, sz, between = 'between', del = false }) => `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="${orient}"/>${max != null ? `<c:max val="${max}"/>` : ''}${min != null ? `<c:min val="${min}"/>` : ''}</c:scaling><c:delete val="${del ? 1 : 0}"/><c:axPos val="${pos}"/>${grid ? `<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill>${GRID}</a:solidFill></a:ln></c:spPr></c:majorGridlines>` : ''}${title}<c:numFmt formatCode="${esc(fmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr({ sz, rtl })}<c:crossAx val="${cross}"/><c:crosses val="${crosses}"/><c:crossBetween val="${between}"/>${major != null ? `<c:majorUnit val="${major}"/>` : ''}</c:valAx>`;
const alpha = (name, a) => `<a:solidFill><a:schemeClr val="${name}"><a:alpha val="${a}"/></a:schemeClr></a:solidFill>`;

function serRefs(spec, k) {
  const col = colName(k + 1); const n = spec.labels.length; const last = n + 1;
  return { tx: `<c:tx>${strRef(`Sheet1!$${col}$1`, [spec.series[k].name])}</c:tx>`, cat: `<c:cat>${strRef(`Sheet1!$A$2:$A$${last}`, spec.labels)}</c:cat>`, val: `<c:val>${numRef(`Sheet1!$${col}$2:$${col}$${last}`, spec.series[k].values, spec.series[k].fmt || spec.fmt)}</c:val>` };
}
// does a series carry its value labels? (view setting first, then the same crowding rules as the legacy kinds)
const lblState = (spec, nPts) => (spec.showLabels === false ? 'none' : spec.showLabels === true ? 'all' : (spec.kind === 'area' || spec.kind === 'stacked_area') ? 'none' : nPts <= 24 ? 'all' : 'none'); // an area's labels would sit on its fill: off unless the view asks
function catSer(spec, k, { geom, ci, rtl, szLbl, pos, stacked = false, outline = false, translucent = false }) {
  const s = spec.series[k]; const r = serRefs(spec, k); const col = PAL[ci % PAL.length]; const fmt = s.fmt || spec.fmt;
  const nPts = spec.labels.length * spec.series.length; const st = lblState(spec, nPts);
  const lblColor = stacked ? (col.dark ? clr('lt1') : clr('dk1')) : GREY_TXT;
  let sp; let dl;
  if (geom === 'bar') sp = `<c:spPr>${fill(col.c)}${outline ? `<a:ln w="9525"><a:solidFill>${clr('lt1')}</a:solidFill></a:ln>` : ''}</c:spPr><c:invertIfNegative val="0"/>`;
  else if (geom === 'area') sp = `<c:spPr>${translucent ? alpha(col.c, 62000) : fill(col.c)}<a:ln w="19050"><a:solidFill>${clr(col.c)}</a:solidFill></a:ln></c:spPr>`;
  else sp = `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill>${clr(col.c)}</a:solidFill>${s.dashed ? '<a:prstDash val="dash"/>' : ''}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="${spec.markers === false ? 'none' : 'circle'}"/>${spec.markers === false ? '' : `<c:size val="5"/><c:spPr>${fill(col.c)}<a:ln w="9525"><a:solidFill>${clr(col.c)}</a:solidFill></a:ln></c:spPr>`}</c:marker>`;
  if (st === 'none') {
    if (geom === 'line' && spec.showLabels == null) { const lastIdx = s.values.reduce((a, v, i) => (v != null ? i : a), -1); dl = lastIdx < 0 ? '<c:dLbls><c:delete val="1"/></c:dLbls>' : `<c:dLbls><c:dLbl><c:idx val="${lastIdx}"/>${lblBlock({ fmt, pos: 't', color: GREY_TXT, sz: szLbl, rtl })}</c:dLbl>${showFlags({ val: false })}</c:dLbls>`; } // a crowded line labels its last point only
    else dl = '<c:dLbls><c:delete val="1"/></c:dLbls>';
  } else dl = `<c:dLbls>${lblBlock({ fmt, pos, color: lblColor, sz: szLbl, rtl })}</c:dLbls>`;
  return `<c:ser><c:idx val="${k}"/><c:order val="${k}"/>${r.tx}${sp}${dl}${r.cat}${r.val}${geom === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`;
}
const legendX = (spec, pos, rtl, szTxt) => `<c:legend><c:legendPos val="${pos}"/><c:overlay val="0"/>${txPr({ sz: szTxt, rtl })}</c:legend>`;
const wrapSpace = (plot, legend, rtl, szTxt, extraPlotLayout = '<c:layout/>') => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace ${NS}><c:date1904 val="0"/><c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea>${extraPlotLayout}${plot}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr({ sz: szTxt, rtl })}<c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData></c:chartSpace>`;

function chartXmlNew(spec) {
  const rtl = spec.lang === 'ar'; const k = spec.kind; const szTxt = rtl ? 1200 : 1000; const szLbl = rtl ? 1100 : 900; const szAx = szTxt - 100;
  const legendWanted = (auto) => (spec.showLegend != null ? spec.showLegend : auto);
  if (k === 'donut') {
    const s = spec.series[0]; const r = serRefs(spec, 0);
    const dpts = spec.labels.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(PAL[i % PAL.length].c)}<a:ln w="19050"><a:solidFill>${clr('lt1')}</a:solidFill></a:ln></c:spPr></c:dPt>`).join('');
    const showLbl = spec.showLabels == null ? spec.labels.length <= 8 : spec.showLabels;
    const dl = showLbl ? `<c:dLbls><c:numFmt formatCode="0.0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr({ sz: szLbl, color: clr('lt1'), rtl, b: 1 })}${showFlags({ pct: true })}<c:showLeaderLines val="0"/></c:dLbls>` : '<c:dLbls><c:delete val="1"/></c:dLbls>';
    const lg = legendWanted(true); const L0 = DONUT_LAYOUT(lg);
    const layout = `<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="${L0.x}"/><c:y val="${L0.y}"/><c:w val="${L0.w}"/><c:h val="${L0.h}"/></c:manualLayout></c:layout>`;
    return wrapSpace(`<c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${r.tx}${dpts}${dl}${r.cat}${r.val}</c:ser><c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>`, lg ? legendX(spec, 'b', rtl, szTxt) : '', rtl, szTxt, layout);
  }
  if (k === 'scatter' || k === 'bubble') {
    const n = spec.points.length; const col = PAL[0]; const showLbl = spec.showLabels == null ? n <= 12 : spec.showLabels && n <= 40;
    const ref = (c, f2) => `<c:numRef><c:f>Sheet1!$${c}$2:$${c}$${n + 1}</c:f><c:numCache><c:formatCode>${esc(f2)}</c:formatCode><c:ptCount val="${n}"/>${spec.points.map((p, i) => `<c:pt idx="${i}"><c:v>${c === 'B' ? p.x : c === 'C' ? p.y : p.size}</c:v></c:pt>`).join('')}</c:numCache></c:numRef>`;
    const cust = showLbl ? spec.points.map((p, i) => `<c:dLbl><c:idx val="${i}"/><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr${rtl ? ' rtl="1"' : ''}/><a:r><a:rPr lang="${rtl ? 'ar-SA' : 'en-US'}" sz="${szLbl}"><a:solidFill>${GREY_TXT}</a:solidFill><a:latin typeface="+mn-lt"/><a:cs typeface="+mn-cs"/></a:rPr><a:t>${esc(p.label)}</a:t></a:r></a:p></c:rich></c:tx><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:dLblPos val="r"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbl>`).join('') : '';
    const dl = showLbl ? `<c:dLbls>${cust}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txPr({ sz: szLbl, rtl })}<c:dLblPos val="r"/>${showFlags({ val: false })}</c:dLbls>` : '<c:dLbls><c:delete val="1"/></c:dLbls>';
    const tx = `<c:tx>${strRef('Sheet1!$C$1', [spec.ya.title])}</c:tx>`;
    let group;
    if (k === 'scatter') group = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/>${tx}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="8"/><c:spPr>${alpha(col.c, 80000)}<a:ln w="9525"><a:solidFill>${clr(col.c)}</a:solidFill></a:ln></c:spPr></c:marker>${dl}<c:xVal>${ref('B', spec.xa.fmt)}</c:xVal><c:yVal>${ref('C', spec.ya.fmt)}</c:yVal><c:smooth val="0"/></c:ser><c:axId val="${AX.c1}"/><c:axId val="${AX.v1}"/></c:scatterChart>`;
    else group = `<c:bubbleChart><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/>${tx}<c:spPr>${alpha(col.c, 55000)}<a:ln w="9525"><a:solidFill>${clr(col.c)}</a:solidFill></a:ln></c:spPr><c:invertIfNegative val="0"/>${dl}<c:xVal>${ref('B', spec.xa.fmt)}</c:xVal><c:yVal>${ref('C', spec.ya.fmt)}</c:yVal><c:bubbleSize>${ref('D', spec.za.fmt)}</c:bubbleSize><c:bubble3D val="0"/></c:ser><c:bubbleScale val="60"/><c:showNegBubbles val="0"/><c:sizeRepresents val="area"/><c:axId val="${AX.c1}"/><c:axId val="${AX.v1}"/></c:bubbleChart>`;
    const axes = valAxX({ id: AX.c1, cross: AX.v1, orient: rtl ? 'maxMin' : 'minMax', pos: 'b', fmt: spec.xa.axisFmt, title: axTitleX(spec.xa.title, { rtl, sz: szAx, vertical: false }), grid: false, rtl, sz: szAx, between: 'midCat', min: spec.xa.kind === 'amount' ? null : 0 })
      + valAxX({ id: AX.v1, cross: AX.c1, pos: rtl ? 'r' : 'l', fmt: spec.ya.axisFmt, title: axTitleX(spec.ya.title, { rtl, sz: szAx, vertical: true }), rtl, sz: szAx, between: 'midCat', min: spec.ya.kind === 'amount' ? null : 0 });
    return wrapSpace(group + axes, '', rtl, szTxt);
  }
  // category-axis kinds: bars (stacked / 100 % / clustered histogram), areas, combo / pareto
  const horizontal = k === 'stacked100_hbar'; const nPts = spec.labels.length;
  const catOrient = horizontal ? 'maxMin' : (rtl ? 'maxMin' : 'minMax');
  const catPos = horizontal ? (rtl ? 'r' : 'l') : 'b'; const valPos = horizontal ? 'b' : (rtl ? 'r' : 'l');
  const allVals = spec.series.filter((s) => s.axis !== 'secondary').flatMap((s) => s.values).filter((v) => v != null); const nonNeg = allVals.every((v) => v >= 0);
  const valOrient = horizontal && rtl ? 'maxMin' : 'minMax';
  let groups = ''; let axes = ''; let legend = '';
  const sers = (idx, o) => idx.map((i) => catSer(spec, i, { rtl, szLbl, ...o(i) })).join('');
  const allIdx = spec.series.map((_, i) => i);
  if (k === 'stacked_col' || k === 'stacked100_col' || k === 'stacked100_hbar') {
    const grouping = spec.pct ? 'percentStacked' : 'stacked';
    groups = `<c:barChart><c:barDir val="${horizontal ? 'bar' : 'col'}"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>${sers(allIdx, (i) => ({ geom: 'bar', ci: i, pos: 'ctr', stacked: true }))}<c:gapWidth val="60"/><c:overlap val="100"/><c:axId val="${AX.c1}"/><c:axId val="${AX.v1}"/></c:barChart>`;
    axes = catAxX({ id: AX.c1, cross: AX.v1, orient: catOrient, pos: catPos, rtl, sz: szTxt }) + valAxX({ id: AX.v1, cross: AX.c1, orient: valOrient, pos: valPos, crosses: horizontal ? 'max' : 'autoZero', min: spec.pct ? 0 : nonNeg ? 0 : null, max: spec.pct ? 1 : null, fmt: spec.pct ? '0%' : axisFmtFor(allVals, spec.fmt), title: axTitleX(spec.axisTitle, { rtl, sz: szAx, vertical: !horizontal }), rtl, sz: szAx });
    legend = legendWanted(spec.series.length > 1) ? legendX(spec, 't', rtl, szTxt) : '';
  } else if (k === 'area' || k === 'stacked_area') {
    const stackedA = k === 'stacked_area';
    groups = `<c:areaChart><c:grouping val="${stackedA ? 'stacked' : 'standard'}"/><c:varyColors val="0"/>${sers(allIdx, (i) => ({ geom: 'area', ci: i, pos: null, translucent: !stackedA }))}<c:axId val="${AX.c1}"/><c:axId val="${AX.v1}"/></c:areaChart>`;
    axes = catAxX({ id: AX.c1, cross: AX.v1, orient: catOrient, pos: 'b', rtl, sz: szTxt }) + valAxX({ id: AX.v1, cross: AX.c1, pos: valPos, min: nonNeg ? 0 : null, fmt: axisFmtFor(allVals, spec.fmt), title: axTitleX(spec.axisTitle, { rtl, sz: szAx, vertical: true }), rtl, sz: szAx, between: 'midCat' });
    legend = legendWanted(spec.series.length > 1) ? legendX(spec, 't', rtl, szTxt) : '';
  } else if (k === 'histogram') {
    groups = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers(allIdx, () => ({ geom: 'bar', ci: 0, pos: 'outEnd', outline: true }))}<c:gapWidth val="0"/><c:axId val="${AX.c1}"/><c:axId val="${AX.v1}"/></c:barChart>`;
    axes = catAxX({ id: AX.c1, cross: AX.v1, orient: catOrient, pos: 'b', rtl, sz: szTxt, title: axTitleX(spec.catTitle, { rtl, sz: szAx, vertical: false }) }) + valAxX({ id: AX.v1, cross: AX.c1, pos: valPos, min: 0, fmt: axisFmtFor(allVals, spec.fmt), title: axTitleX(spec.axisTitle, { rtl, sz: szAx, vertical: true }), rtl, sz: szAx });
    legend = spec.showLegend ? legendX(spec, 't', rtl, szTxt) : '';
  } else if (k === 'combo' || k === 'pareto') {
    const bars = allIdx.filter((i) => spec.series[i].type !== 'line'); const linesP = allIdx.filter((i) => spec.series[i].type === 'line' && spec.series[i].axis !== 'secondary'); const linesS = allIdx.filter((i) => spec.series[i].type === 'line' && spec.series[i].axis === 'secondary');
    const lineColor = (i) => (k === 'pareto' ? 5 : i);
    if (bars.length) groups += `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers(bars, (i) => ({ geom: 'bar', ci: i, pos: 'outEnd' }))}<c:gapWidth val="${k === 'pareto' ? 40 : 80}"/><c:axId val="${AX.c1}"/><c:axId val="${AX.v1}"/></c:barChart>`;
    if (linesP.length) groups += `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers(linesP, (i) => ({ geom: 'line', ci: lineColor(i), pos: 't' }))}<c:marker val="1"/><c:axId val="${AX.c1}"/><c:axId val="${AX.v1}"/></c:lineChart>`;
    if (linesS.length) groups += `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers(linesS, (i) => ({ geom: 'line', ci: lineColor(i), pos: 't' }))}<c:marker val="1"/><c:axId val="${AX.c2}"/><c:axId val="${AX.v2}"/></c:lineChart>`;
    axes = catAxX({ id: AX.c1, cross: AX.v1, orient: catOrient, pos: 'b', rtl, sz: szTxt }) + valAxX({ id: AX.v1, cross: AX.c1, pos: valPos, min: nonNeg ? 0 : null, fmt: axisFmtFor(allVals, spec.fmt), title: axTitleX(spec.axisTitle, { rtl, sz: szAx, vertical: true }), rtl, sz: szAx });
    if (linesS.length) {
      const a2 = spec.axis2 || {};
      axes += catAxX({ id: AX.c2, cross: AX.v2, orient: catOrient, pos: 'b', del: true, rtl, sz: szTxt })
        + valAxX({ id: AX.v2, cross: AX.c2, orient: 'minMax', pos: rtl ? 'l' : 'r', crosses: 'max', min: a2.min, max: a2.max, major: a2.max === 1 ? 0.2 : null, fmt: a2.fmt || '#,##0', title: axTitleX(a2.title || '', { rtl, sz: szAx, vertical: true }), grid: false, rtl, sz: szAx });
    }
    legend = legendWanted(true) ? legendX(spec, 't', rtl, szTxt) : '';
  }
  return wrapSpace(groups + axes, legend, rtl, szTxt);
}

function writeSheet(aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

/* ------------------------------------------------------------------ the plan for ONE chart block */
// → { kind, mode: 'native' | 'table' | 'image' | 'none', spec?, why?: {ar,en}, notes: [{ar,en}] }
//   native: a DrawingML chart (spec) · table: the heat map (a shaded native table, built by the planner) · image: the shared renderer's vector picture + data table, with the reason ·
//   none: a kind nothing can draw (never replaced by another type)
export function chartPlan(block, { lang = 'en', drawable = null } = {}) {
  const kind = block.kind || 'bar'; const sup = PPTX_SUPPORT[kind]; const notes = [];
  if (kind === 'heatmap') return { kind, mode: 'table', notes };
  if (sup === 'native') {
    const why = nativeBlocker(block, lang);
    if (!why) {
      const spec = chartSpecFor(block, { lang });
      if (spec) {
        if (spec.fallbackFrom === 'waterfall') notes.push({ ar: 'الجسر يعبر الصفر فلا يمكن رسمه عائماً أصلياً: تُعرض خطواته أعمدةً بقيمها بإشاراتها (الجسر العائم في الشاشة وPDF).', en: 'The bridge crosses zero, so a floating native waterfall is not possible: the steps are shown as columns of their signed values (the floating bridge is on screen and in the PDF).' });
        (spec.notes || []).forEach((n) => notes.push(n));
        return { kind, mode: 'native', spec, notes };
      }
    }
    return drawable && !drawable(kind) ? { kind, mode: 'none', why: why || { ar: 'لا بيانات.', en: 'No data.' }, notes } : { kind, mode: 'image', why: why || { ar: 'لا بيانات كافية لمخطط أصلي.', en: 'Not enough data for a native chart.' }, notes: [IMAGE_NOTE] };
  }
  if (sup === 'vector-image') return drawable && !drawable(kind) ? { kind, mode: 'none', why: PPTX_FALLBACK_NOTE[kind], notes } : { kind, mode: 'image', why: PPTX_FALLBACK_NOTE[kind], notes: [IMAGE_NOTE] };
  return { kind, mode: 'none', why: { ar: 'لا يوجد رسم لهذا النوع من المخططات.', en: 'There is no drawing for this chart kind.' }, notes };
}
// the real PowerPoint treatment of one block (what exportPlan reports): 'native' | 'native-table' | 'vector-image' | 'table-only'
export const pptxModeOf = (block, lang = 'en', drawable = null) => { const p = chartPlan(block, { lang, drawable }); return p.mode === 'native' ? 'native' : p.mode === 'table' ? 'native-table' : p.mode === 'image' ? 'vector-image' : 'table-only'; };
