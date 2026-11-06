// PowerPoint export on the MOMAH TEMPLATE. The deck is built INSIDE the supplied template package (public/templates/momah-{en,ar}.pptx), so the slide masters, layouts, theme (colours and fonts), logo,
// skyline artwork, vertical rule and slide-number convention are the template's own — nothing is redrawn. The template's «Title Slide» layout opens the deck, its «Title Only» layout carries the content slides,
// its «Section header box» layout opens the appendix and its «End» layout closes the deck. Report data and template styling are kept apart: this module holds the slide-part builders (placeholders, text,
// cards, tables, chart frames) and the package assembly; src/utils/pptxDeckPlan.js decides WHAT goes on which slide, src/utils/pptxCharts.js builds the native chart parts.
// Everything is editable text, a native table, a native chart (with its embedded workbook) or — for the few chart kinds that have no native form (bullet, box, treemap, sunburst, sankey, and a block a native chart would misdraw) — a PICTURE: the shared
// renderer's SVG (a:blip → asvg:svgBlip) with a PNG fallback, placed next to the data table and labelled as an image. No screenshot of the app is ever used and no chart is silently drawn as another type.
import JSZip from 'jszip';
import { chartXml, chartWorkbook, chartRelsXml } from './pptxCharts';

const EMU = 914400; const e = (inch) => Math.round(inch * EMU);
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const COLORS = { teal: '006C67', dark: '003A37', green: '9BC73E', cyan: '2DC5D9', mid: '009A93', grey: '535353', light: 'F2F2F2', line: 'BFBFBF', orange: 'EB641B' };
const PALETTE = [COLORS.teal, COLORS.green, COLORS.cyan, COLORS.grey, COLORS.mid, COLORS.orange];
const FONT = { en: { latin: 'Trebuchet MS', cs: 'Trebuchet MS' }, ar: { latin: 'Sakkal Majalla', cs: 'Sakkal Majalla' } };
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export const GEOM = (lang) => (lang === 'ar' ? { x0: 0.85, w: 11.6 } : { x0: 0.69, w: 11.6 }); // the template's vertical rule sits on the right in English and on the left in Arabic
export const Y0 = 1.5; export const YMAX = 6.85; export const COLORS_T = COLORS;

/* ------------------------------------------------------------------ XML building blocks */
function run(t, { lang, sz = 11, b = false, i = false, color = '000000' }) {
  const f = FONT[lang];
  return `<a:r><a:rPr lang="${lang === 'ar' ? 'ar-SA' : 'en-US'}" sz="${Math.round(sz * 100)}" b="${b ? 1 : 0}" i="${i ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${f.latin}"/><a:cs typeface="${f.cs}"/></a:rPr><a:t>${esc(t)}</a:t></a:r>`;
}
const para = (t, o) => `<a:p><a:pPr algn="${o.align || (o.lang === 'ar' ? 'r' : 'l')}"${o.lang === 'ar' ? ' rtl="1"' : ''}><a:spcBef><a:spcPts val="0"/></a:spcBef></a:pPr>${run(t, o)}</a:p>`;
let _id = 10;
const nid = () => { _id += 1; return _id; };
export const resetIds = () => { _id = 10; };

export function textBox({ x, y, w, h, text, lang, sz = 11, b = false, i = false, color = '000000', align, anchor = 't' }) {
  const id = nid();
  const paras = String(text).split('\n').map((t) => para(t, { lang, sz, b, i, color, align })).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${e(x)}" y="${e(y)}"/><a:ext cx="${e(w)}" cy="${e(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}"${lang === 'ar' ? ' rtlCol="1"' : ''}><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
}
export function rect({ x, y, w, h, fill, line = null, name = 'Shape' }) {
  const id = nid();
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name} ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${e(x)}" y="${e(y)}"/><a:ext cx="${Math.max(1, e(w))}" cy="${Math.max(1, e(h))}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}${line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>'}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
}
function ellipse({ x, y, d, fill }) {
  const id = nid();
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Marker ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${e(x - d / 2)}" y="${e(y - d / 2)}"/><a:ext cx="${e(d)}" cy="${e(d)}"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
}
function line({ x1, y1, x2, y2, color = COLORS.line, wpt = 0.75, dash = false }) {
  const id = nid(); const x = Math.min(x1, x2); const y = Math.min(y1, y2);
  const flipH = x2 < x1 ? ' flipH="1"' : ''; const flipV = y2 < y1 ? ' flipV="1"' : '';
  return `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Line ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${flipH}${flipV}><a:off x="${e(x)}" y="${e(y)}"/><a:ext cx="${e(Math.abs(x2 - x1))}" cy="${e(Math.abs(y2 - y1))}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${Math.round(wpt * 12700)}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${dash ? '<a:prstDash val="dash"/>' : ''}</a:ln></p:spPr></p:cxnSp>`;
}

/* ------------------------------------------------------------------ text measuring (PowerPoint grows a row / box to fit its text, so the planner must predict the height instead of overflowing the slide) */
const hasAr = (t) => /[؀-ۿ]/.test(t);
export const charW = (t, sz) => (sz / 72) * (hasAr(t) ? 0.45 : 0.5); // average advance in inches (slightly wider than the template fonts' real average, so a row is never predicted shorter than PowerPoint draws it)
export const linesOf = (t, wIn, sz) => String(t ?? '').split('\n').reduce((n, part) => n + Math.max(1, Math.ceil((part.length * charW(part, sz)) / Math.max(0.2, wIn))), 0);
export const textHeight = (t, wIn, sz, gap = 0.04) => linesOf(t, wIn, sz) * (sz / 72) * 1.22 + gap;

// a native, editable PowerPoint table: header row in the template's teal, banded rows, thin rules. Row heights are PREDICTED from the wrapped text of each row, so the planner can paginate by height.
// fills(i, j) → { fill, color, b, pattern } lets a caller shade cells (the heat map); returns { xml, h } (h = the table's height in inches).
export function layoutCols({ w, headers, rows, sz = 10, weights = null }) {
  const n = headers.length;
  if (weights) { const sum = weights.reduce((a, b) => a + b, 0); return weights.map((v) => (w * v) / sum); }
  const word = (t) => Math.max(0, ...String(t ?? '').split(/[\s/]+/).map((x) => x.length * charW(x, sz)));
  const min = []; const pref = [];
  for (let j = 0; j < n; j += 1) {
    let mn = word(headers[j]) * 1.12; let pf = String(headers[j] ?? '').length * charW(String(headers[j] ?? ''), sz) * 1.12 * 0.6;
    for (const r of rows) { const t = String(r[j] ?? ''); mn = Math.max(mn, word(t)); pf = Math.max(pf, t.length * charW(t, sz)); }
    min.push(Math.min(2.2, mn) + 0.18); pref.push(Math.min(4.6, Math.max(pf + 0.18, min[j])));
    if (j === 0) min[0] = Math.max(min[0], Math.min(pref[0], 1.7)); // the label column keeps room for a whole label (e.g. «Jeddah Amanah») on one line
  }
  const sMin = min.reduce((a, b) => a + b, 0); const sPref = pref.reduce((a, b) => a + b, 0);
  if (sPref * 1.4 < w && n <= 4) { const tw = Math.max(Math.min(w, 6.5), sPref * 1.4); return pref.map((v) => v + ((tw - sPref) * v) / sPref); } // a table of few narrow columns does not stretch across the slide
  if (sPref <= w) return pref.map((v) => v + ((w - sPref) * v) / sPref);
  if (sMin >= w) return min.map((v) => (v * w) / sMin);
  return min.map((v, j) => v + ((w - sMin) * (pref[j] - v)) / Math.max(1e-9, sPref - sMin));
}
export function tableFrame({ x, y, w, headers, rows, lang, sz = 10, weights = null, colW = null, minRowH = 0.27, fills = null, numCols = null, name = 'Table' }) {
  const id = nid(); const ar = lang === 'ar';
  const cw = colW || layoutCols({ w, headers, rows, sz, weights }); const widths = cw.map((c) => Math.round(e(c))); const tw = cw.reduce((a, b) => a + b, 0); const tx = ar ? x + w - tw : x;
  const wIn = cw.map((c) => c - 0.14);
  const isNum = (t) => /^[\s\-−+⁦⁩\d.,%()٠-٩/·:<>≥≤]+[^\p{L}]*$/u.test(String(t ?? '')) && /\d/.test(String(t));
  const numCol = headers.map((_, j) => (numCols ? numCols.includes(j) : j > 0 && rows.length > 0 && rows.every((r) => r[j] == null || r[j] === '' || r[j] === '—' || isNum(r[j])) && rows.some((r) => isNum(r[j]))));
  const ln = (side, on) => `<a:${side} w="${on ? 6350 : 0}">${on ? `<a:solidFill><a:srgbClr val="${COLORS.line}"/></a:solidFill>` : '<a:noFill/>'}</a:${side}>`;
  const cell = (t, j, { head = false, band = false, f = null }) => {
    const num = numCol[j];
    const algn = f?.align || (ar ? (num ? 'l' : 'r') : (num ? 'r' : 'l'));
    const color = f?.color || (head ? 'FFFFFF' : '000000'); const bold = f?.b ?? head;
    const bg = f?.fill ? f.fill : f?.pattern ? f.pattern : `<a:solidFill><a:srgbClr val="${head ? COLORS.teal : band ? COLORS.light : 'FFFFFF'}"/></a:solidFill>`;
    return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${algn}"${ar ? ' rtl="1"' : ''}/>${run(ar && num && isNum(t) ? `\u2066${t}\u2069` : String(t ?? ''), { lang, sz, b: bold, color })}</a:p></a:txBody><a:tcPr marL="${e(0.07)}" marR="${e(0.07)}" marT="${e(0.03)}" marB="${e(0.03)}" anchor="ctr">${ln('lnL', false)}${ln('lnR', false)}${ln('lnT', true)}${ln('lnB', true)}${bg}</a:tcPr></a:tc>`;
  };
  const rowH = (cells, bold = false) => Math.max(minRowH, ...cells.map((c, j) => textHeight(c ?? '', wIn[j] / (bold ? 1.08 : 1), sz, 0.07)));
  const hH = rowH(headers, true) + 0.02; const hs = rows.map((r) => rowH(r));
  const trs = [`<a:tr h="${e(hH)}">${headers.map((h, j) => cell(h, j, { head: true })).join('')}</a:tr>`, ...rows.map((r, i) => `<a:tr h="${e(hs[i])}">${r.map((c, j) => cell(c, j, { band: i % 2 === 1, f: fills ? fills(i, j) : null })).join('')}</a:tr>`)].join('');
  const total = hH + hs.reduce((a, b) => a + b, 0);
  const xml = `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${name} ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${e(tx)}" y="${e(y)}"/><a:ext cx="${e(tw)}" cy="${e(total)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr${ar ? ' rtl="1"' : ''} firstRow="1" bandRow="1"/><a:tblGrid>${widths.map((c) => `<a:gridCol w="${c}"/>`).join('')}</a:tblGrid>${trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  return { xml, h: total, rowHs: hs, headH: hH };
}
export const tableXml = (o) => tableFrame(o).xml;

// the row-height predictor alone (the planner paginates with it before building the frame)
export function tableRowHeights({ w, headers, rows, sz = 10, weights = null, colW = null, minRowH = 0.27 }) {
  const cw = colW || layoutCols({ w, headers, rows, sz, weights }); const wIn = cw.map((c) => c - 0.14);
  const rowH = (cells, bold = false) => Math.max(minRowH, ...cells.map((c, j) => textHeight(c ?? '', wIn[j] / (bold ? 1.08 : 1), sz, 0.07)));
  return { head: rowH(headers, true) + 0.02, rows: rows.map((r) => rowH(r)) };
}

// a rich text box: several paragraphs, each with its own size / weight / colour / bullet / spacing
export function richBox({ x, y, w, h, paras, lang, anchor = 't', name = 'Text', fillColor = null, line = null, inset = 0 }) {
  const id = nid(); const ar = lang === 'ar';
  const ps = paras.map((p) => {
    const al = p.align || (ar ? 'r' : 'l'); const ind = p.bullet ? ` marL="${ar ? 0 : 228600}" marR="${ar ? 228600 : 0}" indent="-228600"` : '';
    const bu = p.bullet ? `<a:buClr><a:srgbClr val="${COLORS.teal}"/></a:buClr><a:buFont typeface="Arial"/><a:buChar char="•"/>` : '<a:buNone/>';
    return `<a:p><a:pPr algn="${al}"${ar ? ' rtl="1"' : ''}${ind}><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="${Math.round((p.after ?? 3) * 100)}"/></a:spcAft>${bu}</a:pPr>${run(p.text, { lang: p.lang || lang, sz: p.sz || 11, b: p.b, i: p.i, color: p.color || '000000' })}</a:p>`;
  }).join('');
  const sp = `${fillColor ? `<a:solidFill><a:srgbClr val="${fillColor}"/></a:solidFill>` : '<a:noFill/>'}${line ? `<a:ln w="9525"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>` : ''}`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name} ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${e(x)}" y="${e(y)}"/><a:ext cx="${e(w)}" cy="${e(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${sp}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="${e(inset)}" tIns="${e(inset)}" rIns="${e(inset)}" bIns="${e(inset)}" anchor="${anchor}"${ar ? ' rtlCol="1"' : ''}><a:noAutofit/></a:bodyPr><a:lstStyle/>${ps}</p:txBody></p:sp>`;
}
// the height a list of paragraphs needs in a box of width w
export const parasHeight = (paras, w, lang) => paras.reduce((t, p) => t + textHeight(p.text, w - (p.bullet ? 0.25 : 0), p.sz || 11, (p.after ?? 3) / 72 + 0.02), 0);

// a native chart's graphic frame on the slide (rid = the slide relationship to ppt/charts/chartN.xml)
export function chartFrame({ x, y, w, h, rid, name, descr }) {
  const id = nid();
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${esc(name || 'Chart')} ${id}" descr="${esc(descr || '')}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${e(x)}" y="${e(y)}"/><a:ext cx="${e(w)}" cy="${e(h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${rid}"/></a:graphicData></a:graphic></p:graphicFrame>`;
}

// a picture frame: the PNG is the a:blip (every PowerPoint version), the SVG rides in the asvg:svgBlip extension (PowerPoint 2016+ draws it as vector). rPng / rSvg = the slide relationships.
export function pictureFrame({ x, y, w, h, rPng, rSvg, name, descr }) {
  const id = nid();
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${esc(name || 'Chart image')} ${id}" descr="${esc(descr || '')}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rPng}"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${rSvg}"/></a:ext></a:extLst></a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${e(x)}" y="${e(y)}"/><a:ext cx="${e(w)}" cy="${e(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}
// A 1x1 light PNG: the stand-in fallback where nothing can rasterise (Node tests without a canvas / Chromium). The SVG itself is always embedded; the browser export and scripts/make-chart-decks.mjs supply real PNGs.
export const PLACEHOLDER_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
// browser: SVG text → PNG bytes at `scale` x its size (null where there is no canvas)
export async function rasterizeSvg(svg, w, h, scale = 2) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/png')); if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch { return null; }
}

/* ------------------------------------------------------------------ charts drawn as vector shapes (editable; bars start at zero; a missing value is left empty, never drawn as zero) */
export function chartShapes({ x, y, w, h, kind, labels, series, lang, fmt }) {
  const out = []; const f = lang;
  const vals = series.flatMap((s) => s.values).filter((v) => v != null && Number.isFinite(v));
  if (!labels.length || !vals.length) return { xml: textBox({ x, y, w, h: 0.3, text: lang === 'ar' ? 'لا بيانات لعرض الرسم.' : 'No data to chart.', lang: f, sz: 10, color: COLORS.grey }), height: 0.35 };
  const legendH = series.length > 1 ? 0.28 : 0; const axisW = 0.9; const catH = kind === 'hbar' ? 0 : 0.4;
  const px = lang === 'ar' ? x : x + axisW; const pw = w - axisW; const py = y + legendH + 0.1; const ph = h - legendH - 0.1 - catH;
  // legend
  series.forEach((s, k) => { const lx = lang === 'ar' ? x + w - 0.2 - (k + 1) * 2.2 : x + axisW + k * 2.2; out.push(rect({ x: lang === 'ar' ? lx + 2.0 : lx, y: y + 0.07, w: 0.14, h: 0.14, fill: PALETTE[k % PALETTE.length], name: 'Legend' })); out.push(textBox({ x: lang === 'ar' ? lx - 0.05 : lx + 0.2, y: y + 0.03, w: 2.0, h: 0.22, text: String(s.label), lang: f, sz: 9, align: lang === 'ar' ? 'r' : 'l' })); });
  const lo = Math.min(0, ...vals); const hi = Math.max(0, ...vals); const span = hi - lo || 1;
  const niceStep = (() => { const raw = span / 4; const p = 10 ** Math.floor(Math.log10(raw)); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; })();
  const top = Math.ceil(hi / niceStep) * niceStep; const bottom = Math.floor(lo / niceStep) * niceStep; const rng = top - bottom || niceStep;
  if (kind === 'hbar') {
    const n = labels.length; const rowH = ph / n; const labW = 2.3; const bx = lang === 'ar' ? px : px + labW; const bw = pw - labW - 0.9;
    labels.forEach((lab, i) => {
      const cy = py + i * rowH; const sH = Math.min(0.28, (rowH * 0.7) / series.length);
      out.push(textBox({ x: lang === 'ar' ? px + bw + 0.95 : px, y: cy + rowH / 2 - 0.11, w: labW - 0.1, h: 0.22, text: String(lab).slice(0, 34), lang: f, sz: 9, align: lang === 'ar' ? 'r' : 'l' }));
      series.forEach((s, k) => { const v = s.values[i]; if (v == null) return; const len = Math.max(0, (v - Math.min(0, lo)) / (Math.max(0, hi) - Math.min(0, lo) || 1)) * bw; const by = cy + rowH / 2 - (sH * series.length) / 2 + k * sH;
        out.push(rect({ x: lang === 'ar' ? bx + bw - len : bx, y: by, w: len, h: sH - 0.02, fill: PALETTE[k % PALETTE.length], name: 'Bar' }));
        out.push(textBox({ x: lang === 'ar' ? bx + bw - len - 0.85 : bx + len + 0.05, y: by, w: 0.8, h: sH, text: fmt(v), lang: 'en', sz: 8, align: lang === 'ar' ? 'r' : 'l', anchor: 'ctr' })); });
    });
    out.push(line({ x1: lang === 'ar' ? bx + bw : bx, y1: py, x2: lang === 'ar' ? bx + bw : bx, y2: py + ph, color: COLORS.grey }));
    return { xml: out.join(''), height: h };
  }
  // gridlines + value axis (starts at zero for bars)
  for (let v = bottom; v <= top + niceStep / 1000; v += niceStep) {
    const gy = py + ph - ((v - bottom) / rng) * ph;
    out.push(line({ x1: px, y1: gy, x2: px + pw, y2: gy, color: v === 0 ? COLORS.grey : 'E0E0E0', wpt: v === 0 ? 1 : 0.5 }));
    out.push(textBox({ x: lang === 'ar' ? px + pw + 0.08 : x, y: gy - 0.09, w: axisW - 0.12, h: 0.18, text: fmt(v), lang: 'en', sz: 8, color: COLORS.grey, align: lang === 'ar' ? 'l' : 'r' }));
  }
  const n = labels.length; const gW = pw / n; const order = (i) => (lang === 'ar' ? n - 1 - i : i); // Arabic: the time axis runs right to left
  const lx = (i) => px + order(i) * gW + gW / 2;
  const zeroY = py + ph - ((0 - bottom) / rng) * ph;
  labels.forEach((lab, i) => out.push(textBox({ x: px + order(i) * gW, y: py + ph + 0.06, w: gW, h: catH - 0.06, text: String(lab).slice(0, 12), lang: f, sz: 8, align: 'ctr', color: COLORS.grey })));
  if (kind === 'line') {
    series.forEach((s, k) => { let prev = null; s.values.forEach((v, i) => { if (v == null || !Number.isFinite(v)) { prev = null; return; } const cx = lx(i); const cy = py + ph - ((v - bottom) / rng) * ph; if (prev) out.push(line({ x1: prev[0], y1: prev[1], x2: cx, y2: cy, color: PALETTE[k % PALETTE.length], wpt: 2.25 })); out.push(ellipse({ x: cx, y: cy, d: 0.09, fill: PALETTE[k % PALETTE.length] })); prev = [cx, cy]; }); });
  } else {
    const bw = Math.min(0.6, (gW * 0.72) / series.length);
    labels.forEach((_, i) => series.forEach((s, k) => { const v = s.values[i]; if (v == null || !Number.isFinite(v)) return; const cy = py + ph - ((v - bottom) / rng) * ph; const bx = lx(i) - (bw * series.length) / 2 + k * bw;
      out.push(rect({ x: bx, y: Math.min(cy, zeroY), w: bw - 0.02, h: Math.abs(zeroY - cy), fill: PALETTE[k % PALETTE.length], name: 'Bar' }));
      if (n <= 12) out.push(textBox({ x: bx - 0.15, y: (v >= 0 ? cy : zeroY) - (v >= 0 ? 0.2 : -0.02), w: bw + 0.3, h: 0.18, text: fmt(v), lang: 'en', sz: 7, align: 'ctr', color: COLORS.grey })); }));
  }
  return { xml: out.join(''), height: h };
}

/* ------------------------------------------------------------------ the slide parts */
// a title that always fits ONE line in the template's title box (11.96 in): the size steps down from the layout's own, never below 18 pt; a longer text is cut with an ellipsis
export function fitTitle(text, lang, base) {
  const t = String(text ?? ''); const k = lang === 'ar' ? 0.42 : 0.52; const maxW = 11.7;
  let sz = Math.min(base, Math.floor((maxW * 72) / Math.max(1, t.length * k))); sz = Math.max(18, sz);
  const cap = Math.floor((maxW * 72) / (sz * k)); return { text: t.length > cap ? `${t.slice(0, Math.max(1, cap - 1)).trimEnd()}…` : t, sz };
}
const slideXml = (lang, { title, shapes, footer, kicker, titleSize, footerColor }) => {
  const g = GEOM(lang); const ft = fitTitle(title, lang, titleSize || (lang === 'ar' ? 34 : 32));
  const szAttr = ft.sz < (titleSize || (lang === 'ar' ? 34 : 32)) ? ` sz="${ft.sz * 100}"` : '';
  const titleSp = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${lang === 'ar' ? '<a:pPr algn="r" rtl="1"/>' : ''}<a:r><a:rPr lang="${lang === 'ar' ? 'ar-SA' : 'en-US'}"${szAttr} dirty="0"/><a:t>${esc(ft.text)}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const kick = kicker ? textBox({ x: g.x0, y: 1.17, w: g.w, h: 0.26, text: kicker, lang, sz: 11, color: COLORS.grey }) : '';
  const fw = 9.4; const foot = footer ? textBox({ x: lang === 'ar' ? g.x0 + g.w - fw : g.x0, y: 7.02, w: fw, h: 0.22, text: footer, lang, sz: 8, color: footerColor || COLORS.grey }) : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${titleSp}${kick}${shapes.join('')}${foot}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
};
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const slideRels = (layout, charts, pics = []) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout${layout}.xml"/>${charts.map((c) => `<Relationship Id="${c.rid}" Type="${REL}/chart" Target="../charts/chart${c.n}.xml"/>`).join('')}${pics.map((p) => `<Relationship Id="${p.rPng}" Type="${REL}/image" Target="../media/${p.file}.png"/><Relationship Id="${p.rSvg}" Type="${REL}/image" Target="../media/${p.file}.svg"/>`).join('')}</Relationships>`;

/* ------------------------------------------------------------------ assembling the package */
const setPlaceholder = (xml, ph, text, lang) => {
  const paras = (Array.isArray(text) ? text : [text]).filter((t) => t != null && t !== '').map((t) => { const o = typeof t === 'string' ? { text: t } : t; return `<a:p>${lang === 'ar' ? '<a:pPr algn="r" rtl="1"/>' : ''}<a:r><a:rPr lang="${lang === 'ar' ? 'ar-SA' : 'en-US'}"${o.sz ? ` sz="${o.sz * 100}" cap="none"` : ''} dirty="0"/><a:t>${esc(o.text)}</a:t></a:r></a:p>`; }).join('') || '<a:p><a:endParaRPr lang="en-US"/></a:p>';
  return xml.replace(new RegExp(`(<p:ph ${ph}[^>]*/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>)<a:p>.*?</a:p>`), (_, a) => `${a}${paras}`);
};

/** templateBytes: the template .pptx · deck: { lang, title, subtitle, note: string | [string | {text, sz}], docTitle, slides: [{ title, kicker, layout (2 = Title Only, 5 = Section header box), shapes, footer, charts: [{ rid, spec }] }] }
 *  → Uint8Array of the finished .pptx. Each chart spec becomes a chart part with its embedded workbook. */
export async function assembleDeck(templateBytes, deck, opts = {}) {
  const zip = await JSZip.loadAsync(templateBytes); const lang = deck.lang;
  const rd = async (p) => zip.file(p).async('string');
  let pres = await rd('ppt/presentation.xml'); let prels = await rd('ppt/_rels/presentation.xml.rels'); let ct = await rd('[Content_Types].xml');
  // 1) the title slide of the template (slide1) takes the report title; the End slide (slide4) is kept as the template made it
  let s1 = await rd('ppt/slides/slide1.xml');
  s1 = setPlaceholder(s1, 'type="ctrTitle"', deck.title, lang); s1 = setPlaceholder(s1, 'type="body" sz="quarter" idx="10"', deck.subtitle, lang); s1 = setPlaceholder(s1, 'type="body" sz="quarter" idx="11"', deck.note, lang);
  zip.file('ppt/slides/slide1.xml', s1);
  // 2) the template's sample content slides (2, 3) and its disclaimer (5) are replaced by the report's slides
  const drop = [2, 3, 5];
  for (const n of drop) {
    const rel = await rd(`ppt/slides/_rels/slide${n}.xml.rels`); const note = /notesSlides\/(notesSlide\d+)\.xml/.exec(rel);
    zip.remove(`ppt/slides/slide${n}.xml`); zip.remove(`ppt/slides/_rels/slide${n}.xml.rels`); ct = ct.replace(new RegExp(`<Override PartName="/ppt/slides/slide${n}\\.xml"[^>]*/>`), '');
    if (note) { zip.remove(`ppt/notesSlides/${note[1]}.xml`); zip.remove(`ppt/notesSlides/_rels/${note[1]}.xml.rels`); ct = ct.replace(new RegExp(`<Override PartName="/ppt/notesSlides/${note[1]}\\.xml"[^>]*/>`), ''); }
    prels = prels.replace(new RegExp(`<Relationship [^>]*Target="slides/slide${n}\\.xml"[^>]*/>`), '');
  }
  // 3) the new content slides, and the chart parts they carry
  const ids = []; let rid = 100; let sid = 400; const slideRelsXml = []; let nChart = 0; const addCt = []; let hasXlsxDefault = /Extension="xlsx"/.test(ct);
  let nPic = 0; const picJobs = [];
  for (let i = 0; i < deck.slides.length; i += 1) {
    const s = deck.slides[i];
    const name = `slide${100 + i}`; const charts = []; const pics = [];
    for (const p of s.pics || []) { // a picture: the SVG as drawn by the shared renderer + its PNG fallback (real where a rasteriser exists, else the placeholder)
      nPic += 1; const file = `chartimg${nPic}`; pics.push({ ...p, file });
      zip.file(`ppt/media/${file}.svg`, p.svg);
      const png = opts.rasterize ? await opts.rasterize(p.svg, p.w, p.h) : null;
      zip.file(`ppt/media/${file}.png`, png || PLACEHOLDER_PNG); picJobs.push({ file, real: !!png });
    }
    for (const c of s.charts || []) {
      nChart += 1; charts.push({ rid: c.rid, n: nChart });
      zip.file(`ppt/charts/chart${nChart}.xml`, chartXml(c.spec)); zip.file(`ppt/charts/_rels/chart${nChart}.xml.rels`, chartRelsXml(nChart)); zip.file(`ppt/embeddings/Microsoft_Excel_Sheet${nChart}.xlsx`, chartWorkbook(c.spec));
      addCt.push(`<Override PartName="/ppt/charts/chart${nChart}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
    }
    zip.file(`ppt/slides/${name}.xml`, slideXml(lang, s)); zip.file(`ppt/slides/_rels/${name}.xml.rels`, slideRels(s.layout || 2, charts, pics));
    addCt.push(`<Override PartName="/ppt/slides/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    rid += 1; sid += 1; slideRelsXml.push(`<Relationship Id="rId${rid}" Type="${REL}/slide" Target="slides/${name}.xml"/>`); ids.push(`<p:sldId id="${sid}" r:id="rId${rid}"/>`);
  }
  if (nPic) { for (const [ext, type] of [['png', 'image/png'], ['svg', 'image/svg+xml']]) if (!new RegExp(`Extension="${ext}"`).test(ct)) ct = ct.replace('<Default Extension="xml"', `<Default Extension="${ext}" ContentType="${type}"/><Default Extension="xml"`); }
  if (nChart && !hasXlsxDefault) ct = ct.replace('<Default Extension="xml"', '<Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/><Default Extension="xml"');
  ct = ct.replace('</Types>', `${addCt.join('')}</Types>`);
  prels = prels.replace('</Relationships>', `${slideRelsXml.join('')}</Relationships>`);
  // the order: title (slide1), the content slides, the End slide (slide4)
  const idOf = (n) => { const r = new RegExp(`Id="(rId\\d+)"[^>]*Target="slides/slide${n}\\.xml"|Target="slides/slide${n}\\.xml"[^>]*Id="(rId\\d+)"`).exec(prels); return r[1] || r[2]; };
  pres = pres.replace(/<p:sldIdLst>.*?<\/p:sldIdLst>/, `<p:sldIdLst><p:sldId id="276" r:id="${idOf(1)}"/>${ids.join('')}<p:sldId id="279" r:id="${idOf(4)}"/></p:sldIdLst>`);
  zip.file('ppt/presentation.xml', pres); zip.file('ppt/_rels/presentation.xml.rels', prels); zip.file('[Content_Types].xml', ct);
  if (deck.docTitle) { const core = await rd('docProps/core.xml'); zip.file('docProps/core.xml', core.replace(/<dc:title>.*?<\/dc:title>/, `<dc:title>${esc(deck.docTitle)}</dc:title>`)); }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
