// Exports a report MODEL to Word / Excel / PowerPoint. The files carry exactly what the conversation shows: the same context (filters,
// period, basis, data label), KPIs, tables (same unit per table, stated in the header), chart data, insights and assumptions;
// Excel also gets exact SAR amounts. Nothing is recomputed here.
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, ImageRun } from 'docx';
import * as XLSX from 'xlsx';
import { assembleDeck, rasterizeSvg } from './pptxTemplate';
import { chartExportTable, chartExactAmounts, isLegacyChart } from './chartExportData';
import { planDeck } from './pptxDeckPlan';
import { tableToText, chartInfo, fillTokens, fmtEvidence } from '../data/reportFormat';
import { fmtSar } from './money';
import { riyadhDateOf, fmtRiyadh } from '../data/clock';
import { chartPng } from './chartKinds';
import { buildPdfHtml } from './pdfReport';

function download(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
// Excel caps sheet names at 31 characters; cut at a word boundary instead of mid-word
const cutAtWord = (t, max) => { const x = t.trim(); if (x.length <= max) return x; const cut = x.slice(0, max); const i = cut.lastIndexOf(' '); return (i >= Math.floor(max * 0.5) ? cut.slice(0, i) : cut).trim(); };
const relationsLine = (T, lang) => { const L = (a, e) => (lang === 'ar' ? a : e); return `${L('إجمالي المفوتر', 'Gross billed')} ${fmtSar(T.gross, lang)} = ${L('الاستبعادات', 'exclusions')} ${fmtSar(T.exclusions, lang)} + ${L('صافي المفوتر', 'net billed')} ${fmtSar(T.net, lang)}; ${L('صافي المفوتر', 'net billed')} = ${L('المحصّل', 'collected')} ${fmtSar(T.collected, lang)} + ${L('غير المحصّل', 'uncollected')} ${fmtSar(T.outstanding, lang)}; ${L('نسبة التحصيل', 'collection rate')} ${rateText(T.collectedOverNet, lang)}; ${L('نسبة الاستبعاد', 'exclusion rate')} ${rateText(T.exclusionRate, lang)}`; };
// the report context as it is shown on screen, plus the data cut-off and the time the report was prepared (Asia/Riyadh) — every export carries them
const exportContext = (model, lang) => { const L = (a, e) => (lang === 'ar' ? a : e); return [...model.context.map((c) => [c.label, c.value]), ...(model.cutoff ? [[L('قطع البيانات', 'Data cut-off'), model.cutoff]] : []), [L('أُعدّ في (بتوقيت الرياض)', 'Prepared (Riyadh time)'), fmtRiyadh(model.generatedAt)]]; };
const NA = { ar: 'غير متاحة', en: 'Not available' };
// a rate object {calculable, value} → «57.8%» or the explicit unavailable label (never a silent zero)
const rateText = (r, lang = 'ar') => (r && r.calculable ? `${(r.value * 100).toFixed(1)}%` : NA[lang]);
const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');
const dataLine = (model, lang) => model.dataNote || (lang === 'ar' ? 'بيانات تجريبية اصطناعية — وليست بيانات فعلية للوزارة' : 'Synthetic demo data — not the Ministry’s actual data');
// title · period · language: «Revenue-and-collection-report_2026-01-01_2026-10-09_ar.pdf»
export const reportFileName = (model, ext) => { const sc = model._inputs?.spec?.scope || model.meta?.period; const period = sc?.from && sc?.to ? `${sc.from}_${sc.to}` : riyadhDateOf(model.generatedAt); const ver = model.meta?.version ? `_v${model.meta.version}` : ''; return `${(model.title || 'report').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, sc?.muni && sc.muni !== 'all' ? 90 : 50)}_${period}${ver}_${model.lang === 'ar' ? 'ar' : 'en'}.${ext}`; };

// the flat, text form of a model (shared by Word and PowerPoint)
export function modelToLines(model) {
  const lang = model.lang; const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const items = [];
  const pushBlock = (b) => {
    if (b.type === 'text') items.push({ k: 'p', text: b.text });
    else if (b.type === 'kpis') items.push({ k: 'table', title: L('المؤشرات', 'Indicators'), headers: [L('المؤشر', 'Measure'), L('القيمة', 'Value'), L('ملاحظة', 'Note')], rows: b.items.map((m) => [m.label, m.value, m.sub]) });
    else if (b.type === 'relations') items.push({ k: 'table', title: L('العلاقات المالية', 'Financial relationships'), headers: [L('العلاقة', 'Relationship'), L('الصيغة', 'Formula')], rows: [[L('إجمالي المفوتر', 'Gross billed'), `${fmtSar(b.totals.gross, lang)} = ${L('الاستبعادات', 'exclusions')} ${fmtSar(b.totals.exclusions, lang)} + ${L('صافي المفوتر', 'net billed')} ${fmtSar(b.totals.net, lang)}`], [L('صافي المفوتر', 'Net billed'), `${fmtSar(b.totals.net, lang)} = ${L('المحصّل', 'collected')} ${fmtSar(b.totals.collected, lang)} + ${L('غير المحصّل', 'uncollected')} ${fmtSar(b.totals.outstanding, lang)}`], [L('نسبة التحصيل', 'Collection rate'), `${rateText(b.totals.collectedOverNet, lang)} (${L('المحصّل ÷ صافي المفوتر', 'collected ÷ net billed')})`], [L('نسبة الاستبعاد', 'Exclusion rate'), `${rateText(b.totals.exclusionRate, lang)} (${L('الاستبعادات ÷ إجمالي المفوتر', 'exclusions ÷ gross billed')})`]] });
    else if (b.type === 'table') { const t = tableToText(b, lang); items.push({ k: 'table', title: `${b.title}${t.unitText ? ` — ${L('المبالغ بوحدة', 'amounts in')}: ${t.unitText}` : ''}`, headers: t.headers, rows: t.total ? [...t.rows, t.total] : t.rows, note: b.note, source: b }); }
    else if (b.type === 'chart' && !isLegacyChart(b)) { const t = chartExportTable(b, lang); items.push({ k: 'table', chart: b, title: t.unitText ? `${b.title} — ${L('المبالغ بوحدة', 'amounts in')}: ${t.unitText}` : b.title, headers: t.headers, rows: t.rows }); } // chart-library kinds: the kind's own table (scatter points, histogram bins, tree leaves, flows …)
    else if (b.type === 'chart') { const { unitText, cu } = chartInfo(b, lang); items.push({ k: 'table', chart: b, title: unitText ? `${b.title} — ${L('المبالغ بوحدة', 'amounts in')}: ${unitText}` : b.title, headers: [L('البند', 'Item'), ...b.series.map((s) => s.label)], rows: b.labels.map((lab, i) => [lab, ...b.series.map((s) => (s.values[i] == null ? '—' : String(cu.tick(s.values[i]))))]) }); }
    else if (b.type === 'insights') { if (b.title) items.push({ k: 'h3', text: b.title }); b.items.forEach((it) => { items.push({ k: 'p', bold: true, text: pick(it.title, lang) }); items.push({ k: 'p', text: fillTokens(pick(it.body, lang), it.tokens, lang) }); if (it.evidence.length) items.push({ k: 'p', text: it.evidence.map((e) => `${pick(e.k, lang)}: ${fmtEvidence(e, lang)}`).join(' · ') }); items.push({ k: 'p', text: `${L('الأساس', 'Basis')}: ${pick(it.basis, lang)}${it.caveat ? ` — ${L('تحفظ', 'Caveat')}: ${pick(it.caveat, lang)}` : ''}` }); }); }
    else if (b.type === 'callout') items.push({ k: 'p', text: b.text });
    else if (b.type === 'list') b.items.forEach((x) => items.push({ k: 'li', text: x }));
  };
  const ctx = exportContext(model, lang);
  items.push({ k: 'table', title: L('سياق التقرير والتصفية', 'Report context and filters'), headers: [L('البند', 'Item'), L('القيمة', 'Value')], rows: ctx });
  model.headline.forEach(pushBlock);
  model.sections.forEach((s) => { items.push({ k: 'h2', text: s.title }); if (s.purpose) items.push({ k: 'p', text: s.purpose }); s.blocks.forEach(pushBlock); });
  return items;
}

/* ---------------------------- Word ---------------------------- */
// the Word document as an object (so it can be built and inspected without a browser); exportModelToDocx downloads it
export function buildDocx(model, images = new Map()) {
  const rtl = model.lang === 'ar';
  const run = (text, o = {}) => new TextRun({ text: String(text), rightToLeft: rtl, ...o });
  const para = (text, o = {}) => new Paragraph({ bidirectional: rtl, alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(text, o.run)], ...o.para });
  const cell = (text, bold) => new TableCell({ children: [new Paragraph({ bidirectional: rtl, children: [run(text, { bold })] })] });
  const children = [new Paragraph({ bidirectional: rtl, heading: HeadingLevel.TITLE, children: [run(model.title)] }), para(model.subtitle), para(`${dataLine(model, model.lang)}.`, { para: { spacing: { after: 200 } } })];
  for (const it of modelToLines(model)) {
    if (it.k === 'h2') children.push(new Paragraph({ bidirectional: rtl, heading: HeadingLevel.HEADING_1, spacing: { before: 280 }, children: [run(it.text)] }));
    else if (it.k === 'h3') children.push(new Paragraph({ bidirectional: rtl, heading: HeadingLevel.HEADING_2, children: [run(it.text)] }));
    else if (it.k === 'p') children.push(para(it.text, { run: { bold: it.bold }, para: { spacing: { after: 100 } } }));
    else if (it.k === 'li') children.push(para(`• ${it.text}`, { para: { spacing: { after: 60 } } }));
    else if (it.k === 'table') {
      if (it.title) children.push(new Paragraph({ bidirectional: rtl, spacing: { before: 160 }, children: [run(it.title, { bold: true })] }));
      const img = it.chart && images.get(it.chart);
      if (img) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new ImageRun({ type: 'png', data: img.data, transformation: { width: 600, height: Math.round((600 * img.h) / img.w) }, altText: { title: it.chart.title, description: it.chart.title, name: 'chart' } })] }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: rtl, rows: [new TableRow({ children: it.headers.map((h) => cell(h, true)) }), ...it.rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) }))] }));
      if (it.note) children.push(para(it.note, { para: { spacing: { before: 60, after: 120 } } }));
      else children.push(para('', { para: { spacing: { after: 100 } } }));
    }
  }
  return new Document({ sections: [{ children }] });
}
// the charts of the model as pictures (browser: SVG → PNG); where there is no canvas the file carries each chart's data table alone
async function chartImages(model) {
  const images = new Map();
  for (const it of modelToLines(model)) if (it.chart && !images.has(it.chart)) { const png = await chartPng(it.chart, { lang: model.lang }); if (png) images.set(it.chart, png); }
  return images;
}
export async function exportModelToDocx(model, filename = reportFileName(model, 'docx')) {
  download(await Packer.toBlob(buildDocx(model, await chartImages(model))), filename);
}

/* ---------------------------- Excel ---------------------------- */
export function buildWorkbook(model) {
  const lang = model.lang; const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const wb = XLSX.utils.book_new();
  if (ar) wb.Workbook = { Views: [{ RTL: true }] };
  const summary = [[model.title], [model.subtitle], [dataLine(model, lang)], [], [L('سياق التقرير والتصفية', 'Report context and filters')], ...exportContext(model, lang), []];
  for (const b of model.headline) if (b.type === 'kpis') { summary.push([L('المؤشر', 'Measure'), L('القيمة', 'Value'), L('الريال بالدقة', 'Exact SAR'), L('ملاحظة', 'Note')]); b.items.forEach((m) => summary.push([m.label, m.value, typeof m.raw === 'number' && !String(m.value).includes('%') && !String(m.value).includes('فاتورة') && !String(m.value).includes('invoices') ? m.raw : '', m.sub])); }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), L('الملخص', 'Summary'));
  const exact = [[L('الجدول', 'Table'), L('الصف', 'Row'), L('العمود', 'Column'), 'amount_sar']];
  const used = new Set([L('الملخص', 'Summary')]);
  const sheetName = (t) => { let n = cutAtWord(String(t).replace(/[\\/?*[\]:]/g, ' '), 28) || 'Sheet'; let k = 2; const base = n; while (used.has(n)) { n = `${base.slice(0, 25)} ${k}`; k += 1; } used.add(n); return n; };
  const tables = []; const notes = [];
  model.headline.forEach((b) => { if (b.type === 'text' || b.type === 'callout') notes.push([b.text]); });
  model.sections.forEach((s) => s.blocks.forEach((b) => { if (b.type === 'text' || b.type === 'callout') notes.push([s.title, b.text]); else if (b.type === 'relations') notes.push([s.title, relationsLine(b.totals, lang)]); if (b.type === 'table' || b.type === 'chart') tables.push({ ...b, sectionTitle: s.title }); else if (b.type === 'insights') tables.push({ type: 'insights', title: b.title || s.title, items: b.items }); else if (b.type === 'list') tables.push({ type: 'list', title: s.title, items: b.items }); }));
  tables.forEach((b) => {
    if (b.type === 'table') {
      const t = tableToText(b, lang); const aoa = [[b.sectionTitle && b.sectionTitle !== b.title ? `${b.sectionTitle} — ${b.title}` : b.title], t.headers.map((h, j) => (b.headers[j].kind === 'pct' ? `${h} (%)` : h))];
      const num = (v, j) => (b.headers[j].kind === 'money' && typeof v === 'number' ? Number((v / t.unit.div).toFixed(6)) : b.headers[j].kind === 'pct' && typeof v === 'number' ? Number((v * 100).toFixed(2)) : v ?? '');
      b.rows.forEach((r) => { aoa.push(r.map(num)); b.headers.forEach((h, j) => { if (h.kind === 'money' && typeof r[j] === 'number') exact.push([b.title, String(r[0]), h.label, r[j]]); }); });
      if (b.total) { aoa.push(b.total.map(num)); b.headers.forEach((h, j) => { if (h.kind === 'money' && typeof b.total[j] === 'number') exact.push([b.title, String(b.total[0]), h.label, b.total[j]]); }); } // totals carry their exact SAR amount too
      if (b.note) aoa.push([], [b.note]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName(b.title));
    } else if (b.type === 'chart' && !isLegacyChart(b)) {
      const t = chartExportTable(b, lang); const numeric = (v) => (/^-?[\d,]+(\.\d+)?$/.test(String(v).trim()) ? Number(String(v).replace(/,/g, '')) : v);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[b.sectionTitle && b.sectionTitle !== b.title ? `${b.sectionTitle} — ${b.title}` : b.title], ...(t.unitText ? [[`${L('المبالغ بوحدة', 'amounts in')}: ${t.unitText}`]] : []), t.headers, ...t.rows.map((r) => r.map(numeric))]), sheetName(b.title));
      chartExactAmounts(b).forEach(([row, col, v]) => exact.push([b.title, row, col, v])); // the exact SAR behind every amount the chart shows
    } else if (b.type === 'chart') {
      const { cu } = chartInfo(b, lang);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[b.sectionTitle && b.sectionTitle !== b.title ? `${b.sectionTitle} — ${b.title}` : b.title], [L('البند', 'Item'), ...b.series.map((s) => (b.plain ? s.label : `${s.label} (${cu.title.split('—')[1]?.trim()})`))], ...b.labels.map((lab, i) => [lab, ...b.series.map((s) => (s.values[i] == null ? '' : Number((s.values[i] / cu.unit.div).toFixed(6))))])]), sheetName(b.title));
      b.labels.forEach((lab, i) => b.series.forEach((s) => { if (s.values[i] != null) exact.push([b.title, lab, s.label, s.values[i]]); }));
    } else if (b.type === 'insights') {
      const rows = [[L('الرؤية', 'Insight'), L('الشرح', 'Detail'), L('الأرقام الداعمة', 'Supporting figures'), L('الأساس', 'Basis'), L('تحفظ', 'Caveat')], ...b.items.map((it) => [pick(it.title, lang), fillTokens(pick(it.body, lang), it.tokens, lang), it.evidence.map((e) => `${pick(e.k, lang)}: ${fmtEvidence(e, lang)}`).join(' | '), pick(it.basis, lang), pick(it.caveat, lang)])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName(L('الرؤى', 'Insights')));
    } else if (b.type === 'list') XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[b.title], ...b.items.map((x) => [x])]), sheetName(b.title));
  });
  if (notes.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[L('القسم', 'Section'), L('الملاحظة', 'Note')], ...notes.map((n) => (n.length === 1 ? ['', n[0]] : n))]), sheetName(L('ملاحظات التقرير', 'Report notes')));
  if (exact.length > 1) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(exact), 'amounts_sar');
  return wb;
}
export function exportModelToXlsx(model, filename = reportFileName(model, 'xlsx')) { XLSX.writeFile(buildWorkbook(model), filename); }

/* ---------------------------- PowerPoint ---------------------------- */
// rows per slide: a long table continues on the next slide, so no row (and never the total row, which is last) is dropped
export const paginateRows = (rows, per = 11) => { const out = []; for (let i = 0; i < rows.length; i += per) out.push(rows.slice(i, i + per)); return out.length ? out : [[]]; };
// The deck is built on the MOMAH TEMPLATE for the report's language (src/utils/pptxTemplate.js): the template's own title, content and end layouts, theme, logo and rule.
// `templateBytes` lets a caller (a test, a script) supply the template; in the browser it is fetched from /templates/momah-{en,ar}.pptx.
// opts.rasterize(svg, w, h) → PNG bytes | null: the PNG fallback of the chart pictures (kinds with no native PowerPoint form). The browser passes the canvas rasteriser; tests / scripts may pass their own; without one the SVG is embedded with a placeholder PNG.
export async function buildTemplatePptx(model, templateBytes, opts = {}) {
  const lang = model.lang === 'ar' ? 'ar' : 'en'; const L = (a, e) => (lang === 'ar' ? a : e);
  // version · generated · data cut-off: from model.meta when present, else from the model's own fields (every part is optional, none is invented)
  const m = model.meta || {}; const gen = m.generatedAt || model.generatedAt; const cut = m.cutoff || model.cutoff;
  const ltr = (t) => (lang === 'ar' ? `\u2066${t}\u2069` : String(t)); // numbers and dates stay left-to-right inside an Arabic line
  const stamp = [m.version != null && m.version !== '' ? `${L('الإصدار', 'Version')} ${ltr(m.version)}` : '', gen ? `${L('أُنشئ', 'Generated')} ${ltr(fmtRiyadh(gen))}` : '', cut ? `${L('بيانات حتى', 'Data as of')} ${ltr(cut)}` : ''].filter(Boolean).join(' · ');
  const relationsRows = (b) => [[L('إجمالي المفوتر', 'Gross billed'), `${fmtSar(b.totals.gross, lang)} = ${L('الاستبعادات', 'exclusions')} ${fmtSar(b.totals.exclusions, lang)} + ${L('صافي المفوتر', 'net billed')} ${fmtSar(b.totals.net, lang)}`], [L('صافي المفوتر', 'Net billed'), `${fmtSar(b.totals.net, lang)} = ${L('المحصّل', 'collected')} ${fmtSar(b.totals.collected, lang)} + ${L('غير المحصّل', 'uncollected')} ${fmtSar(b.totals.outstanding, lang)}`], [L('نسبة التحصيل', 'Collection rate'), `${rateText(b.totals.collectedOverNet, lang)} (${L('المحصّل ÷ صافي المفوتر', 'collected ÷ net billed')})`], [L('نسبة الاستبعاد', 'Exclusion rate'), `${rateText(b.totals.exclusionRate, lang)} (${L('الاستبعادات ÷ إجمالي المفوتر', 'exclusions ÷ gross billed')})`]];
  const { slides } = planDeck({ model, helpers: { ctxRows: exportContext(model, lang), dataLine: dataLine(model, lang), stamp, relationsRows } });
  return assembleDeck(templateBytes, { lang, title: model.title, docTitle: model.title, subtitle: model.subtitle || '', note: [{ text: dataLine(model, lang) }, ...(stamp ? [{ text: stamp, sz: 12 }] : [])], slides }, opts);
}
async function templateBytesFor(lang) {
  const name = `momah-${lang === 'ar' ? 'ar' : 'en'}.pptx`;
  if (typeof window === 'undefined') { const fs = await import('node:fs'); return fs.readFileSync(new URL(`../../public/templates/${name}`, import.meta.url)); }
  const r = await fetch(`${import.meta.env?.BASE_URL || '/'}templates/${name}`); if (!r.ok) throw new Error(`template_unavailable:${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}
export async function exportModelToPptx(model, filename = reportFileName(model, 'pptx')) {
  const bytes = await buildTemplatePptx(model, await templateBytesFor(model.lang), { rasterize: (svg, w, h) => rasterizeSvg(svg, w, h, 2) });
  download(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), filename);
}


/* ---------------------------- CSV ---------------------------- */
// ONE UTF-8 file (with the BOM Excel needs for Arabic): the report context, then every table of the report — title row, header row, rows, total — separated by a blank line.
// Chart data and indicators are tables too. Amounts are in the unit stated in each table's header.
const csvCell = (v) => { const t = v == null ? '' : String(v); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function buildCsv(model) {
  const lines = []; const row = (cells) => lines.push(cells.map(csvCell).join(','));
  row([model.title]); row([model.subtitle]); row([dataLine(model, model.lang)]); lines.push('');
  for (const it of modelToLines(model)) {
    if (it.k === 'table') { if (it.title) row([it.title]); row(it.headers); it.rows.forEach(row); if (it.note) row([it.note]); lines.push(''); }
  }
  return `\ufeff${lines.join('\r\n')}\r\n`;
}
export function exportModelToCsv(model, filename = reportFileName(model, 'csv')) { download(new Blob([buildCsv(model)], { type: 'text/csv;charset=utf-8' }), filename); }

/* ---------------------------- PDF (a deliberately formatted print document → «Save as PDF») ---------------------------- */
// The document itself (A4, margin-box header/footer with page X of Y, repeating table headers, embedded IBM Plex Sans Arabic, KPI grid, charts with their data tables)
// is built by src/utils/pdfReport.js — see the «PDF» section of docs/smart-reports-export.md. A browser cannot write a PDF file without a PDF library, so the document opens in an
// isolated window (not the app UI) and the print dialog is raised; the verified PDF files are produced from this same builder by scripts/make-report-pdf.mjs.
export const modelToHtml = (model, opts) => buildPdfHtml(model, opts);
// the file name the browser proposes when saving: reportFileName(model, 'pdf') without the extension (the window title decides it)
const pdfTitle = (model) => reportFileName(model, 'pdf').replace(/\.pdf$/, '');
// hidden-iframe fallback (pop-up blocked): same isolated document, printed from an off-screen frame
function printInFrame(html) {
  const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f); const d = f.contentDocument; d.open(); d.write(html); d.close();
  const go = async () => { try { await f.contentWindow.document.fonts?.ready; } catch { /* print anyway */ } try { f.contentWindow.focus(); f.contentWindow.print(); } finally { window.setTimeout(() => f.remove(), 120000); } };
  window.setTimeout(go, 250);
}
export async function exportModelToPdf(model) {
  const w = window.open('', '_blank'); // opened first, inside the click, so a pop-up blocker lets it through; filled once the fonts are ready
  let fonts = {}; try { const mod = await Object.values(import.meta.glob('./pdfFonts.js'))[0](); fonts = await mod.loadPdfFontUris(); } catch (e) { console.warn('[pdf] fonts unavailable, using system fonts:', e); } // import.meta.glob: Vite-only, so the Node test / script bundles never resolve the .woff2 imports
  if (!w) return printInFrame(buildPdfHtml(model, { fonts, title: pdfTitle(model) }));
  w.document.open(); w.document.write(buildPdfHtml(model, { fonts, title: pdfTitle(model), toolbar: true })); w.document.close();
  try { await w.document.fonts.ready; } catch { /* print anyway */ }
  window.setTimeout(() => { try { w.focus(); w.print(); } catch (e) { console.warn('[pdf] print failed:', e); } }, 300);
}

/* ---------------------------- one entry point ---------------------------- */
export const EXPORT_FORMATS = [
  { key: 'docx', ext: 'docx', name: 'Word' }, { key: 'pptx', ext: 'pptx', name: 'PowerPoint' }, { key: 'pdf', ext: 'pdf', name: 'PDF' }, { key: 'xlsx', ext: 'xlsx', name: 'Excel' }, { key: 'csv', ext: 'csv', name: 'CSV' }
];
export async function exportModel(kind, model) {
  if (kind === 'docx') return exportModelToDocx(model);
  if (kind === 'xlsx') return exportModelToXlsx(model);
  if (kind === 'pptx') return exportModelToPptx(model);
  if (kind === 'csv') return exportModelToCsv(model);
  if (kind === 'pdf') return exportModelToPdf(model);
  throw new Error(`unknown export format: ${kind}`);
}
