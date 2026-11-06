// The PDF form of a report MODEL: a dedicated, isolated print document (never the app UI) that a browser turns into a real PDF
// (File → Print → «Save as PDF», or headless with scripts/make-report-pdf.mjs). Why a print document and not a PDF library:
// no pdf-lib / jsPDF / pdfmake is in the project, and none of them shapes Arabic (joining, bidi, mixed numbers) by itself; the browser's
// text engine does, keeps the text selectable, and embeds the font subset. The document is deliberately formatted for paper:
//   · A4, margins and CSS margin boxes: running header (report title · «synthetic data») and footer (version · prepared · cut-off · page X of Y)
//   · `thead` repeats on every page, rows / charts / KPI cards / insights never split, headings stay with what follows
//   · IBM Plex Sans Arabic embedded (data URIs supplied by the caller — no CDN, no network), tabular numbers, numbers never wrap
//   · a cover block (not a cover page): title, period, scope chips, KPI grid; charts always followed by their data table (the appendix-style «chart data»)
// Nothing is recomputed: every figure is the model's own, formatted by the same helpers as Word / Excel / PowerPoint.
// The module is pure (string in → string out) so it runs in the browser, in Node tests and in the headless script.
import { tableToText, chartInfo, fillTokens, fmtEvidence } from '../data/reportFormat';
import { fmtSar } from './money';
import { fmtRiyadh } from '../data/clock';
import { chartSvg } from './chartKinds';
import { chartExportTable, isLegacyChart } from './chartExportData';
export { PDF_SUPPORT } from './chartExportData';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// display text: in Arabic documents identifiers and ranges (177-2200000123, 2026-01-01, EXCL-RULES) are isolated left-to-right so right-to-left text never reorders their parts,
// and a range arrow points the way an Arabic reader moves (←). Module state is read synchronously inside buildPdfHtml only.
let LANG = 'ar';
const TOKEN = /(?<![\p{L}\p{N}])[\p{N}A-Za-z]+(?:[-\/:._][\p{N}A-Za-z]+)+%?(?![\p{L}\p{N}])/gu;
export function rich(t, lang = LANG) {
  const raw = String(t ?? ''); if (lang !== 'ar') return esc(raw);
  const s = raw.replace(/ → /g, ' ← '); let out = ''; let last = 0;
  for (const m of s.matchAll(TOKEN)) { out += `${esc(s.slice(last, m.index))}<bdi dir="ltr">${esc(m[0])}</bdi>`; last = m.index + m[0].length; }
  return out + esc(s.slice(last));
}
const X = (t) => rich(t, LANG);
const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');
const cssStr = (t) => `"${String(t ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ').replace(/</g, '\\3C ').replace(/>/g, '\\3E ')}"`; // a CSS string literal for margin-box `content` (< and > escaped so a title can never close the <style> element)
const clip = (t, n) => { const x = String(t ?? '').trim(); return x.length > n ? `${x.slice(0, n - 1).trim()}…` : x; };
const NA = { ar: 'غير متاحة', en: 'Not available' };
const rateText = (r, lang) => (r && r.calculable ? `${(r.value * 100).toFixed(1)}%` : NA[lang]);
export const PDF_DATA_LINE = { ar: 'بيانات تجريبية اصطناعية — وليست بيانات فعلية للوزارة', en: 'Synthetic demo data — not the Ministry’s actual data' };
const dataLine = (model, lang) => model.dataNote || PDF_DATA_LINE[lang];

/* ------------------------------ fonts ------------------------------ */
// IBM Plex Sans Arabic from the bundled @fontsource files. `urls` maps '<subset>-<weight>' → a URL / data URI the caller supplies
// (the browser build inlines them as data URIs, the script reads the files), so the document never reaches a network.
export const PDF_FONT_WEIGHTS = [400, 600, 700];
export const PDF_FONT_FILES = (w) => [`arabic-${w}`, `latin-${w}`]; // subsets used: Arabic + Latin (digits, SAR, dates)
const RANGE = {
  arabic: 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC,U+102E0-102FB,U+10E60-10E7E,U+1EE00-1EEF1',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
};
export function fontFaceCss(urls = {}) {
  let css = '';
  for (const w of PDF_FONT_WEIGHTS) for (const key of PDF_FONT_FILES(w)) { const u = urls[key]; if (!u) continue; css += `@font-face{font-family:'IBM Plex Sans Arabic';font-style:normal;font-weight:${w};src:url("${u}") format('woff2');unicode-range:${RANGE[key.split('-')[0]]}}\n`; }
  return css;
}

/* ------------------------------ cells ------------------------------ */
const NUM_RE = /^[+\-−–]?\d[\d,]*(\.\d+)?\s*(%|pp)?$|^—$/;
const NUM_KIND = new Set(['money', 'count', 'pct', 'plain']);
const isNum = (v) => NUM_RE.test(String(v ?? '').trim());
// a column is numeric when its declared kind says so, or when every filled body cell reads as a number
const numericCols = (rows, headers, kinds) => headers.map((_, j) => (kinds && NUM_KIND.has(kinds[j]) ? true : rows.length > 0 && rows.every((r) => r[j] == null || r[j] === '' || isNum(r[j])) && rows.some((r) => isNum(r[j]) && r[j] !== '—')));
const td = (v, num, tag = 'td') => `<${tag}${num ? ' class="n"' : ''}>${num ? `<bdi dir="ltr">${esc(v)}</bdi>` : X(v)}</${tag}>`;
function tableHtml({ headers, rows, total, kinds, cls = '' }) {
  const num = numericCols(rows, headers, kinds); const dense = headers.length >= 8 ? ' dense' : '';
  // fixed layout with proportional columns: the label / text columns get 3 shares, a numeric column 1 (so a ten-column table never squeezes its label column to one letter, nor runs off the page)
  const wts = headers.map((_, j) => (j === 0 || !num[j] ? (headers.length >= 8 ? 2 : 3) : 1)); const sum = wts.reduce((a, b) => a + b, 0);
  const cols = `<colgroup>${wts.map((w) => `<col style="width:${((w / sum) * 100).toFixed(2)}%">`).join('')}</colgroup>`;
  const head = `<thead><tr>${headers.map((h, j) => td(h, num[j] && j > 0, 'th')).join('')}</tr></thead>`;
  const body = rows.map((r) => `<tr>${r.map((c, j) => td(c, num[j] && j > 0)).join('')}</tr>`).join('');
  const foot = total ? `<tr class="total">${total.map((c, j) => td(c, num[j] && j > 0)).join('')}</tr>` : '';
  return `<table class="${`data${dense} ${cls}`.trim()}">${cols}${head}<tbody>${body}${foot}</tbody></table>`;
}

// a table of WIDE_COLS or more columns is set on landscape pages (named page «wide»), so no header word is cut into letters
export const WIDE_COLS = 10;
const wide = (cols, html) => (cols >= WIDE_COLS ? `<div class="wide">${html}</div>` : html);

/* ------------------------------ chart data ------------------------------ */
// The table that always sits under a chart: same numbers as the drawing, in the chart's ONE unit. Heat maps are rows × columns (rates as %).
export function chartTable(b, lang) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e); const kind = b.kind || 'bar';
  if (!isLegacyChart(b)) return chartExportTable(b, lang); // chart-library kinds: the kind's own registered table (scatter points, histogram bins, tree leaves, flows …)
  if (kind === 'heatmap') {
    const rate = b.valueKind !== 'amount'; const { cu } = chartInfo(b, lang);
    const f = (v) => (v == null ? '—' : rate ? `${(v * 100).toFixed(1)}%` : String(cu.tick(v)));
    return { headers: [L('البند', 'Item'), ...b.labels], rows: b.series.map((s) => [s.label, ...b.labels.map((_, i) => f(s.values[i]))]), unitText: rate ? '' : chartInfo(b, lang).unitText };
  }
  const { cu, unitText } = chartInfo(b, lang); const f = (v) => (v == null ? '—' : String(cu.tick(v)));
  const headers = [L('البند', 'Item'), ...b.series.map((s) => s.label)]; const rows = b.labels.map((lab, i) => [lab, ...b.series.map((s) => f(s.values[i]))]);
  if (kind === 'stacked_hbar') { // parts of a whole: the row total and each part's share are stated, not left to the eye
    headers.push(L('الإجمالي', 'Total'), ...b.series.map((s) => `${s.label} %`));
    b.labels.forEach((_, i) => { const tot = b.series.reduce((t, s) => t + (s.values[i] || 0), 0); rows[i].push(f(tot), ...b.series.map((s) => (tot > 0 && s.values[i] != null ? `${((s.values[i] / tot) * 100).toFixed(1)}%` : '—'))); });
  }
  return { headers, rows, unitText };
}

/* ------------------------------ blocks ------------------------------ */
const splitValue = (v) => { const m = /^([+\-−]?[\d.,]+%?)(?:\s+(.+))?$/.exec(String(v ?? '').trim()); return m ? { n: m[1], u: m[2] || '' } : { n: String(v ?? ''), u: '' }; };
function kpisHtml(b) {
  return `<div class="kpis">${b.items.map((m) => { const { n, u } = splitValue(m.value); return `<div class="kpi"><div class="kl">${X(m.label)}</div><div class="kv"><bdi dir="ltr">${esc(n)}</bdi>${u ? `<span class="ku">${X(u)}</span>` : ''}</div>${m.sub ? `<div class="ks">${X(m.sub)}</div>` : ''}</div>`; }).join('')}</div>`;
}
function relationsHtml(b, lang) {
  const L = (a, e) => (lang === 'ar' ? a : e); const T = b.totals;
  const rows = [
    [L('إجمالي المفوتر', 'Gross billed'), `${fmtSar(T.gross, lang)} = ${L('الاستبعادات', 'exclusions')} ${fmtSar(T.exclusions, lang)} + ${L('صافي المفوتر', 'net billed')} ${fmtSar(T.net, lang)}`],
    [L('صافي المفوتر', 'Net billed'), `${fmtSar(T.net, lang)} = ${L('المحصّل', 'collected')} ${fmtSar(T.collected, lang)} + ${L('غير المحصّل', 'uncollected')} ${fmtSar(T.outstanding, lang)}`],
    [L('نسبة التحصيل', 'Collection rate'), `${rateText(T.collectedOverNet, lang)} (${L('المحصّل ÷ صافي المفوتر', 'collected ÷ net billed')})`],
    [L('نسبة الاستبعاد', 'Exclusion rate'), `${rateText(T.exclusionRate, lang)} (${L('الاستبعادات ÷ إجمالي المفوتر', 'exclusions ÷ gross billed')})`]
  ];
  return `<h4>${X(L('العلاقات المالية', 'Financial relationships'))}</h4>${tableHtml({ headers: [L('العلاقة', 'Relationship'), L('الصيغة', 'Formula')], rows, cls: 'rel' })}`;
}
function chartHtml(b, lang, size) {
  const L = (a, e) => (lang === 'ar' ? a : e); const ct = chartTable(b, lang); let svg = '';
  try { svg = chartSvg(b, { lang, ...size }); } catch { svg = ''; } // a chart that cannot be drawn leaves its data table, never a broken page
  const unit = ct.unitText ? ` <span class="unit">${X(L('المبالغ بوحدة', 'amounts in'))}: ${X(ct.unitText)}</span>` : '';
  const kinds = ct.headers.map((_, j) => (j === 0 ? 'text' : 'plain'));
  return `<figure class="chart"><h4>${X(b.title)}${unit}</h4>${svg ? `<div class="plot">${svg}</div>` : ''}${b.note ? `<p class="note">${X(b.note)}</p>` : ''}</figure>`
    + wide(ct.headers.length, `<h5>${X(L('بيانات الرسم', 'Chart data'))}</h5>${tableHtml({ headers: ct.headers, rows: ct.rows, kinds, cls: 'chartdata' })}`);
}
function blockHtml(b, lang, size) {
  const L = (a, e) => (lang === 'ar' ? a : e);
  if (b.type === 'kpis') return kpisHtml(b);
  if (b.type === 'text') return `<p class="lead">${X(b.text)}</p>`;
  if (b.type === 'callout') return `<div class="callout ${esc(b.tone || 'info')}"><p>${X(b.text)}</p></div>`;
  if (b.type === 'list') return `<ul class="items">${b.items.map((x) => `<li>${X(x)}</li>`).join('')}</ul>`;
  if (b.type === 'relations') return relationsHtml(b, lang);
  if (b.type === 'table') {
    const t = tableToText(b, lang); const unit = t.unitText ? ` <span class="unit">${X(L('المبالغ بوحدة', 'amounts in'))}: ${X(t.unitText)}</span>` : '';
    return wide(t.headers.length, `<h4>${X(b.title)}${unit}</h4>${tableHtml({ headers: t.headers, rows: t.rows, total: t.total, kinds: b.headers.map((h) => h.kind) })}${b.note ? `<p class="note">${X(b.note)}</p>` : ''}`);
  }
  if (b.type === 'chart') return chartHtml(b, lang, size);
  if (b.type === 'insights') {
    return `${b.title ? `<h3>${X(b.title)}</h3>` : ''}${b.items.map((it) => `<article class="insight"><h4>${X(pick(it.title, lang))}</h4><p>${X(fillTokens(pick(it.body, lang), it.tokens, lang))}</p>${it.evidence?.length ? `<p class="ev">${it.evidence.map((e) => `<span><b>${X(pick(e.k, lang))}</b> <bdi dir="ltr">${X(fmtEvidence(e, lang))}</bdi></span>`).join('')}</p>` : ''}<p class="basis">${X(L('الأساس', 'Basis'))}: ${X(pick(it.basis, lang))}${it.caveat ? ` — ${X(L('تحفظ', 'Caveat'))}: ${X(pick(it.caveat, lang))}` : ''}</p></article>`).join('')}`;
  }
  return '';
}

/* ------------------------------ running header / footer ------------------------------ */
// version · generated · cut-off come from model.meta when the report keeps versions (another module adds it); otherwise from the model itself
export function pdfMeta(model) {
  const lang = model.lang === 'ar' ? 'ar' : 'en'; const L = (a, e) => (lang === 'ar' ? a : e); const m = model.meta || {};
  const ver = m.version != null && m.version !== '' ? (typeof m.version === 'object' ? m.version.n ?? m.version.label ?? m.version.id : m.version) : null;
  const generated = m.generatedAt || model.generatedAt; const cutoff = m.cutoff || model.cutoff;
  return {
    ver,
    version: ver != null ? `${L('الإصدار', 'Version')} ${ver}` : '',
    generated: generated ? `${L('أُعدّ في', 'Prepared')} ${fmtRiyadh(generated)} (${L('بتوقيت الرياض', 'Riyadh')})` : '',
    cutoff: cutoff ? `${L('قطع البيانات', 'Data cut-off')} ${cutoff}` : ''
  };
}

/* ------------------------------ stylesheet ------------------------------ */
export function printCss(model, { toolbar = false } = {}) {
  const lang = model.lang === 'ar' ? 'ar' : 'en'; const rtl = lang === 'ar'; const L = (a, e) => (rtl ? a : e);
  const { version, generated, cutoff } = pdfMeta(model);
  const start = rtl ? 'right' : 'left'; const end = rtl ? 'left' : 'right'; const dir = rtl ? 'rtl' : 'ltr';
  const box = `font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif;font-size:7.6pt;color:#667085;direction:${dir};vertical-align:middle`;
  const pageOf = `${cssStr(L('صفحة ', 'Page '))} counter(page) ${cssStr(L(' من ', ' of '))} counter(pages)`;
  const footStart = [version, generated].filter(Boolean).join(' · ');
  return `
@page{size:A4;margin:21mm 14mm 19mm 14mm;
  @top-${start}{content:${cssStr(clip(model.title, 74))};${box};color:#194185;font-weight:600;text-align:${start};padding-top:3mm}
  @top-${end}{content:${cssStr(clip(dataLine(model, lang), 64))};${box};text-align:${end};padding-top:3mm}
  @bottom-center{content:${pageOf};${box};font-weight:600;color:#344054;text-align:center;padding-bottom:2mm}
  @bottom-${start}{content:${cssStr(footStart)};${box};text-align:${start};padding-bottom:2mm;width:38%}
  @bottom-${end}{content:${cssStr(cutoff)};${box};text-align:${end};padding-bottom:2mm;width:30%}
}
@page wide{size:A4 landscape}
.wide{page:wide;break-before:page;break-after:page}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:optimizeLegibility}
body{margin:0;font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif;font-size:9.6pt;line-height:1.65;color:#1d2939;font-variant-numeric:tabular-nums lining-nums;orphans:3;widows:3}
bdi{unicode-bidi:isolate}
h1,h2,h3,h4,h5{break-after:avoid;break-inside:avoid;margin:0}
h1{font-size:21pt;line-height:1.3;color:#102a56;font-weight:700}
h2{font-size:14.5pt;color:#194185;font-weight:700;margin:16pt 0 6pt;padding-bottom:3pt;border-bottom:1.6pt solid #194185}
h3{font-size:11.5pt;color:#102a56;margin:12pt 0 5pt;font-weight:600}
h4{font-size:10pt;font-weight:600;color:#1d2939;margin:11pt 0 4pt}
h5{font-size:8.2pt;font-weight:600;color:#667085;margin:5pt 0 2pt;letter-spacing:0}
.unit{font-weight:400;color:#667085;font-size:8.4pt}
.cover{border-top:4pt solid #194185;padding-top:8pt;margin-bottom:10pt}
.cover .sub{font-size:11pt;color:#475467;margin:3pt 0 7pt}
.chips{display:flex;flex-wrap:wrap;gap:4pt 6pt;margin:0 0 8pt;padding:0;list-style:none}
.chips li{background:#f2f4f7;border:.6pt solid #e4e7ec;border-radius:3pt;padding:2pt 7pt;font-size:8.2pt;line-height:1.5;break-inside:avoid}
.chips li b{font-weight:600;color:#475467;margin-inline-end:4pt}
.prov{display:inline-block;background:#fffaeb;border:.6pt solid #fec84b;color:#93370d;border-radius:3pt;padding:2pt 8pt;font-size:8.2pt;font-weight:600;margin:0 0 6pt}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:6pt;margin:6pt 0 10pt;break-inside:avoid}
.kpi{border:.7pt solid #d0d5dd;border-top:2.4pt solid #194185;border-radius:3pt;padding:5pt 7pt 5pt;background:#fff;break-inside:avoid;min-width:0}
.kl{font-size:8.2pt;color:#475467;font-weight:600;line-height:1.35}
.kv{font-size:14.5pt;font-weight:700;color:#102a56;line-height:1.3;white-space:nowrap;margin-top:1pt}
.ku{font-size:7.8pt;font-weight:500;color:#667085;margin-inline-start:4pt;white-space:nowrap}
.ks{font-size:7.6pt;color:#667085;line-height:1.4;margin-top:1pt}
p{margin:0 0 5pt}
.lead{font-size:10pt;color:#344054}
.note{color:#667085;font-size:8.2pt;margin:3pt 0 5pt}
.purpose{color:#475467;margin:0 0 5pt;break-after:avoid}
table.data{width:100%;table-layout:fixed;border-collapse:collapse;margin:2pt 0 9pt;font-size:8.6pt;line-height:1.45;break-inside:auto}
table.data.dense{font-size:7.3pt}
table.data.dense th,table.data.dense td{padding:3pt 3pt}
table.data.chartdata{font-size:7.8pt;margin-bottom:11pt}
thead{display:table-header-group}
tr{break-inside:avoid}
th,td{border:.5pt solid #d0d5dd;padding:3pt 5pt;text-align:${start};vertical-align:top;overflow-wrap:break-word}
th{background:#eef2f9;color:#102a56;font-weight:600;border-color:#c5d0e4}
th.n,td.n{text-align:${end};overflow-wrap:break-word}
td.n{white-space:nowrap}
tbody tr:nth-child(even) td{background:#fafbfc}
tr.total td{font-weight:700;background:#eef2f9;border-top:1.2pt solid #194185}
table.rel td:first-child{font-weight:600;white-space:nowrap}
figure.chart{margin:0;break-inside:avoid}
figure.chart h4{margin-top:11pt}
.plot{border:.5pt solid #e4e7ec;border-radius:3pt;padding:3pt;margin:2pt 0 3pt}
.plot svg{display:block;width:100%;height:auto;max-height:118mm}
.plot svg text{font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif!important}
.callout{border-${start}:3pt solid #194185;background:#f5f8fe;padding:4pt 9pt;margin:5pt 0 8pt;break-inside:avoid}
.callout.warn{border-color:#f79009;background:#fffaeb}
.callout p{margin:0}
.insight{border:.6pt solid #e4e7ec;border-radius:3pt;padding:5pt 9pt 3pt;margin:0 0 6pt;break-inside:avoid}
.insight h4{margin:0 0 2pt;color:#194185}
.insight p{margin:0 0 3pt}
.ev{display:flex;flex-wrap:wrap;gap:2pt 12pt;font-size:8.4pt;color:#344054}
.ev b{font-weight:600;color:#475467}
.basis{font-size:8.1pt;color:#667085}
ul.items{margin:2pt 0 8pt;padding-${start}:15pt}
ul.items li{margin:0 0 3pt;break-inside:avoid}
section{break-inside:auto}
.bar{display:none}
@media screen{
  body{background:#e8ebf0}
  .doc{max-width:210mm;margin:${toolbar ? '64px' : '16px'} auto 24px;background:#fff;padding:14mm;box-shadow:0 1px 8px rgba(16,24,40,.18)}
  ${toolbar ? `.bar{display:flex;gap:12px;align-items:center;position:fixed;top:0;inset-inline:0;z-index:9;background:#102a56;color:#fff;padding:10px 18px;font-size:13px;line-height:1.5}.bar span{flex:1}.bar button{background:#fff;color:#102a56;border:0;border-radius:6px;padding:7px 16px;font:inherit;font-weight:700;cursor:pointer}` : ''}
}
@media print{.bar{display:none!important}}
`;
}

/* ------------------------------ the document ------------------------------ */
// opts: { fonts: {'arabic-400': url, …}, toolbar: boolean (on-screen preview bar with the print button; never printed), size: {w,h} chart canvas }
export function buildPdfHtml(model, opts = {}) {
  const lang = model.lang === 'ar' ? 'ar' : 'en'; LANG = lang; const rtl = lang === 'ar'; const L = (a, e) => (rtl ? a : e);
  const size = opts.size || { w: 760, h: 380 }; const { ver, version, generated, cutoff } = pdfMeta(model);
  const ctx = [...(model.context || []).map((c) => [c.label, c.value]), ...(cutoff ? [[L('قطع البيانات', 'Data cut-off'), String(model.meta?.cutoff || model.cutoff)]] : []), ...(version ? [[L('الإصدار', 'Version'), String(ver)]] : []), ...(generated ? [[L('أُعدّ في (بتوقيت الرياض)', 'Prepared (Riyadh time)'), fmtRiyadh(model.meta?.generatedAt || model.generatedAt)]] : [])];
  const out = [];
  out.push(`<header class="cover"><h1>${X(model.title)}</h1><p class="sub">${X(model.subtitle || '')}</p><p class="prov">${X(dataLine(model, lang))}</p>${ctx.length ? `<ul class="chips">${ctx.map(([k, v]) => `<li><b>${X(k)}</b><bdi>${X(v)}</bdi></li>`).join('')}</ul>` : ''}</header>`);
  (model.headline || []).forEach((b) => out.push(blockHtml(b, lang, size)));
  (model.sections || []).forEach((s) => { out.push(`<section><h2>${X(s.title)}</h2>${s.purpose ? `<p class="purpose">${X(s.purpose)}</p>` : ''}${(s.blocks || []).map((b) => blockHtml(b, lang, size)).join('')}</section>`); });
  const bar = opts.toolbar ? `<div class="bar" role="note"><span>${esc(L('هذه معاينة المستند. في نافذة الطباعة اختر الوجهة «حفظ بصيغة PDF» وأوقف «الرؤوس والتذييلات» لتبقى رؤوس التقرير وأرقام الصفحات.', 'This is a preview of the document. In the print window choose the destination “Save as PDF” and turn off “Headers and footers” so the report’s own header and page numbers stay.'))}</span><button type="button" onclick="window.print()">${esc(L('طباعة / حفظ PDF', 'Print / Save as PDF'))}</button></div>` : '';
  return `<!doctype html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title || model.title)}</title><style>${fontFaceCss(opts.fonts)}${printCss(model, opts)}</style></head><body>${bar}<main class="doc">${out.join('')}</main></body></html>`;
}
