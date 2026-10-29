import { localize } from './zh';
// Exports a report MODEL to Word / Excel / PowerPoint. The files carry exactly what the conversation shows: the same context (filters,
// period, basis, data label), KPIs, tables (same unit per table, stated in the header), chart data, insights and assumptions;
// Excel also gets exact SAR amounts. Nothing is recomputed here.
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, ImageRun } from 'docx';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import { applyReportTemplate } from './pptxTemplate';
import { tableToText, chartInfo, fillTokens, fmtEvidence } from '../data/reportFormat';
import { fmtSar } from './money';
import { riyadhDateOf, fmtRiyadh } from '../data/clock';
import { chartSvg, chartPng } from './chartDraw';

function download(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
// Excel caps sheet names at 31 characters; cut at a word boundary instead of mid-word
const cutAtWord = (t, max) => { const x = t.trim(); if (x.length <= max) return x; const cut = x.slice(0, max); const i = cut.lastIndexOf(' '); return (i >= Math.floor(max * 0.5) ? cut.slice(0, i) : cut).trim(); };
const relationsLine = (T, lang) => { const L = (a, e) => (lang === 'ar' ? a : localize(e, lang)); return `${L('إجمالي المفوتر', 'Gross billed')} ${fmtSar(T.gross, lang)} = ${L('الاستبعادات', 'exclusions')} ${fmtSar(T.exclusions, lang)} + ${L('صافي المفوتر', 'net billed')} ${fmtSar(T.net, lang)}; ${L('صافي المفوتر', 'net billed')} = ${L('المحصّل', 'collected')} ${fmtSar(T.collected, lang)} + ${L('غير المحصّل', 'uncollected')} ${fmtSar(T.outstanding, lang)}; ${L('نسبة التحصيل', 'collection rate')} ${rateText(T.collectedOverNet, lang)}; ${L('نسبة الاستبعاد', 'exclusion rate')} ${rateText(T.exclusionRate, lang)}`; };
// the report context as it is shown on screen, plus the data cut-off and the time the report was prepared (Asia/Riyadh) — every export carries them
const exportContext = (model, lang) => { const L = (a, e) => (lang === 'ar' ? a : localize(e, lang)); return [...model.context.map((c) => [c.label, c.value]), ...(model.cutoff ? [[L('قطع البيانات', 'Data cut-off'), model.cutoff]] : []), [L('أُعدّ في (بتوقيت الرياض)', 'Prepared (Riyadh time)'), fmtRiyadh(model.generatedAt)]]; };
const NA = { ar: 'غير متاحة', en: 'Not available', zh: '暂无数据' };
// a rate object {calculable, value} → «57.8%» or the explicit unavailable label (never a silent zero)
const rateText = (r, lang = 'ar') => (r && r.calculable ? `${(r.value * 100).toFixed(1)}%` : NA[lang]);
const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : localize(o.en, lang)) || o.en || '');
const dataLine = (model, lang) => model.dataNote || (lang === 'ar' ? 'بيانات تجريبية اصطناعية — وليست بيانات فعلية للوزارة' : localize('Synthetic demo data — not the Ministry’s actual data', lang));
export const reportFileName = (model, ext) => `${(model.title || 'report').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 50)}-${riyadhDateOf(model.generatedAt)}.${ext}`;

// the flat, text form of a model (shared by Word and PowerPoint)
export function modelToLines(model) {
  const lang = model.lang; const ar = lang === 'ar'; const L = (a, e) => (ar ? a : localize(e, lang));
  const items = [];
  const pushBlock = (b) => {
    if (b.type === 'text') items.push({ k: 'p', text: b.text });
    else if (b.type === 'kpis') items.push({ k: 'table', title: L('المؤشرات', 'Indicators'), headers: [L('المؤشر', 'Measure'), L('القيمة', 'Value'), L('ملاحظة', 'Note')], rows: b.items.map((m) => [m.label, m.value, m.sub]) });
    else if (b.type === 'relations') items.push({ k: 'table', title: L('العلاقات المالية', 'Financial relationships'), headers: [L('العلاقة', 'Relationship'), L('الصيغة', 'Formula')], rows: [[L('إجمالي المفوتر', 'Gross billed'), `${fmtSar(b.totals.gross, lang)} = ${L('الاستبعادات', 'exclusions')} ${fmtSar(b.totals.exclusions, lang)} + ${L('صافي المفوتر', 'net billed')} ${fmtSar(b.totals.net, lang)}`], [L('صافي المفوتر', 'Net billed'), `${fmtSar(b.totals.net, lang)} = ${L('المحصّل', 'collected')} ${fmtSar(b.totals.collected, lang)} + ${L('غير المحصّل', 'uncollected')} ${fmtSar(b.totals.outstanding, lang)}`], [L('نسبة التحصيل', 'Collection rate'), `${rateText(b.totals.collectedOverNet, lang)} (${L('المحصّل ÷ صافي المفوتر', 'collected ÷ net billed')})`], [L('نسبة الاستبعاد', 'Exclusion rate'), `${rateText(b.totals.exclusionRate, lang)} (${L('الاستبعادات ÷ إجمالي المفوتر', 'exclusions ÷ gross billed')})`]] });
    else if (b.type === 'table') { const t = tableToText(b, lang); items.push({ k: 'table', title: `${b.title}${t.unitText ? ` — ${L('المبالغ بوحدة', 'amounts in')}: ${t.unitText}` : ''}`, headers: t.headers, rows: t.total ? [...t.rows, t.total] : t.rows, note: b.note, source: b }); }
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
  const lang = model.lang; const ar = lang === 'ar'; const L = (a, e) => (ar ? a : localize(e, lang));
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
export async function exportModelToPptx(model, filename = reportFileName(model, 'pptx')) {
  const rtl = model.lang === 'ar'; const L = (a, e) => rtl ? a : localize(e, model.lang);
  const pptx = new pptxgen();
  // Both MOMAH templates are 13⅓ × 7½ inches, with mirrored body side rules.
  pptx.defineLayout({ name: 'MOMAH', width: 40 / 3, height: 7.5 });
  pptx.layout = 'MOMAH'; pptx.rtlMode = rtl;
  const fontFace = rtl ? 'Sakkal Majalla' : model.lang === 'zh' ? 'Microsoft YaHei' : 'Trebuchet MS';
  pptx.theme = { headFontFace: fontFace, bodyFontFace: fontFace, lang: rtl ? 'ar-SA' : model.lang === 'zh' ? 'zh-CN' : 'en-US' };
  const X = rtl ? 0.85 : 0.69; const W = 11.79; const TOP = 1.48; const BOTTOM = 6.85;
  const textStyle = { fontFace, color: '003A37', margin: 0, align: rtl ? 'right' : 'left', rtlMode: rtl };
  const slideTitles = [''];
  const cover = pptx.addSlide(); // Main text is filled in the original cover's placeholders.
  cover.addText(dataLine(model, model.lang), { ...textStyle, x: 0.73, y: 5.05, w: 8.03, h: 0.35, fontSize: rtl ? 14 : 11, color: '006C67', fit: 'shrink' });
  let slide; let y = TOP; let heading = L('سياق التقرير', 'Report context');
  const open = (title = heading) => {
    heading = title; slide = pptx.addSlide(); slideTitles.push(title); y = TOP;
  };
  // Estimate wrapped lines in points, including wide Chinese glyphs and explicit newlines.
  const lineCount = (text, width, fontSize) => String(text ?? '').split('\n').reduce((sum, line) => {
    const limit = (width * 72 - 8) / fontSize;
    let lines = 1; let used = 0;
    // PowerPoint wraps whole words. Counting only characters underestimates
    // long municipality names in narrow table columns.
    for (const word of line.trim().split(/\s+/)) {
      const units = Array.from(word).reduce((n, ch) => n + (/[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(ch) ? 1 : /[\u0600-\u06ff]/.test(ch) ? 0.65 : 0.55), 0);
      if (used && used + 0.55 + units > limit) { lines += 1; used = 0; }
      used += (used ? 0.55 : 0) + units;
      while (used > limit) { lines += 1; used -= limit; }
    }
    return sum + lines;
  }, 0);
  const addText = (text, options = {}) => {
    if (!text) return;
    const fontSize = (options.fontSize || 11) * (rtl ? 1.6 : 4 / 3);
    // Long narrative blocks continue, without spilling into the template footer.
    const maxChars = Math.min(1000, Math.floor((W * 72 - 8) / fontSize) * Math.floor((BOTTOM - TOP - 0.08) * 72 / (fontSize * 1.35)));
    const paragraphs = String(text).match(new RegExp(`[\\s\\S]{1,${maxChars}}(?:\\s|$)|[\\s\\S]{1,${maxChars}}`, 'g')) || [];
    for (const paragraph of paragraphs) {
      const h = Math.max(0.25, lineCount(paragraph, W, fontSize) * fontSize * 1.35 / 72 + 0.08);
      if (!slide || y + h > BOTTOM) open();
      slide.addText(paragraph, { ...textStyle, x: X, y, w: W, h, valign: 'top', ...options, fontSize });
      y += h + 0.1;
    }
  };
  open();
  for (const it of modelToLines(model)) {
    if (it.k === 'h2') { open(it.text); continue; }
    if (it.k === 'h3') { addText(it.text, { bold: true, fontSize: 13 }); continue; }
    if (it.k !== 'table') { addText(it.k === 'li' ? `• ${it.text}` : it.text, { bold: !!it.bold }); continue; }
    if (it.chart) {
      if (y > TOP) open();
      const b = it.chart; const { cu } = chartInfo(b, model.lang); const kind = b.kind || 'bar';
      const labels = b.labels.map(String);
      const type = kind === 'line' ? pptx.charts.LINE : kind === 'pie' ? pptx.charts.PIE : pptx.charts.BAR;
      const data = (kind === 'pie' ? b.series.slice(0, 1) : b.series).map((s) => ({ name: s.label, labels, values: s.values.map((v) => v == null ? null : Number((v / cu.unit.div).toFixed(2))) }));
      addText(b.title, { fontSize: 12, bold: true });
      slide.addChart(type, data, { x: X, y, w: W, h: BOTTOM - y,
        ...(kind === 'bar' || kind === 'hbar' ? { barDir: kind === 'hbar' ? 'bar' : 'col', barGrouping: 'clustered' } : {}),
        showLegend: data.length > 1 || kind === 'pie', legendPos: 'b', legendFontSize: 12, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
        showValAxisTitle: kind !== 'pie', valAxisTitle: cu.title, valAxisTitleFontSize: 11,
        chartColors: ['006C67', '009A93', '9BC73E', '535353', '2DC5D9', '003A37'],
        ...(kind === 'pie' ? { showPercent: true, showLabel: false, showValue: false } : {}) });
      y = BOTTOM;
    }
    // A table uses the body's available height, repeating headers on every page.
    // Keep totals and all rows, including for narrow columns with wrapped labels.
    const fontSize = it.headers.length > 9 ? (rtl ? 11 : 10.5) : (rtl ? 14 : 12);
    const colW = W / it.headers.length;
    const rowHeight = (row) => Math.max(0.28, ...row.map((cell) => lineCount(cell, colW, fontSize) * fontSize * 1.4 / 72 + 0.12));
    const headerHeight = rowHeight(it.headers);
    const chunks = []; let chunk = []; let height = headerHeight;
    const titleFontSize = 12 * (rtl ? 1.6 : 4 / 3);
    const titleHeight = Math.max(0.35, lineCount(`${it.title || ''} — ${L('الجزء 99 من 99', 'part 99 of 99')}`, W, titleFontSize) * titleFontSize * 1.35 / 72 + 0.08);
    const available = BOTTOM - TOP - titleHeight - 0.15;
    for (const row of it.rows) {
      const h = rowHeight(row);
      if (chunk.length && height + h > available) { chunks.push(chunk); chunk = []; height = headerHeight; }
      chunk.push(row); height += h;
    }
    if (chunk.length || !chunks.length) chunks.push(chunk);
    for (let k = 0; k < chunks.length; k += 1) {
      const part = model.lang === 'zh' ? `第 ${k + 1} / ${chunks.length} 部分` : L(`الجزء ${k + 1} من ${chunks.length}`, `part ${k + 1} of ${chunks.length}`);
      const title = chunks.length > 1 ? `${it.title} — ${part}` : it.title;
      const rows = chunks[k];
      const rowH = [headerHeight, ...rows.map(rowHeight)];
      if (k > 0 || y + titleHeight + 0.1 + rowH.reduce((sum, h) => sum + h, 0) > BOTTOM) open();
      addText(title, { fontSize: 12, bold: true });
      const tableRows = [it.headers.map((text) => ({ text, options: { bold: true, color: 'FFFFFF', fill: { color: '006C67' } } })), ...rows];
      slide.addTable(rtl ? tableRows.map((row) => [...row].reverse()) : tableRows, {
        x: X, y, w: W, colW, rowH, fontFace, fontSize, color: '003A37',
        border: { type: 'solid', pt: 0.5, color: 'CAD8D2' }, fill: { color: 'F8FAF9' },
        margin: 3, valign: 'top', align: rtl ? 'right' : 'left', rtlMode: rtl, autoPage: false
      });
      y += rowH.reduce((sum, h) => sum + h, 0) + 0.15;
    }
    if (it.note) addText(it.note, { fontSize: 9, italic: true, color: '5B6663' });
  }
  pptx.addSlide(); slideTitles.push(''); // Original branded closing slide.
  pptx.addSlide(); slideTitles.push(''); // The supplied language-specific disclaimer.
  download(await applyReportTemplate(await pptx.write({ outputType: 'arraybuffer' }), model, slideTitles), filename);
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

/* ---------------------------- PDF (the browser's print-to-PDF) ---------------------------- */
// A browser cannot write a PDF without a PDF library; this builds a clean printable document (charts included) and opens the print dialog:
// choose «Save as PDF». The button says so. Nothing else is claimed.
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function modelToHtml(model) {
  const lang = model.lang; const rtl = lang === 'ar'; const L = (a, e) => (rtl ? a : localize(e, lang));
  const body = [`<h1>${esc(model.title)}</h1>`, `<p class="sub">${esc(model.subtitle)}</p>`, `<p class="note">${esc(dataLine(model, lang))}</p>`];
  let open = false;
  for (const it of modelToLines(model)) {
    if (it.k === 'h2') { if (open) body.push('</section>'); body.push(`<section><h2>${esc(it.text)}</h2>`); open = true; }
    else if (it.k === 'h3') body.push(`<h3>${esc(it.text)}</h3>`);
    else if (it.k === 'p') body.push(`<p${it.bold ? ' class="b"' : ''}>${esc(it.text)}</p>`);
    else if (it.k === 'li') body.push(`<p class="li">• ${esc(it.text)}</p>`);
    else if (it.k === 'table') {
      if (it.title) body.push(`<h4>${esc(it.title)}</h4>`);
      if (it.chart) body.push(`<div class="chart">${chartSvg(it.chart, { lang })}</div>`);
      body.push(`<table><thead><tr>${it.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${it.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      if (it.note) body.push(`<p class="note">${esc(it.note)}</p>`);
    }
  }
  if (open) body.push('</section>');
  body.push(`<p class="foot">${esc(L('أُعدّ في', 'Prepared'))} ${esc(fmtRiyadh(model.generatedAt))} — ${esc(L('بتوقيت الرياض', 'Riyadh time'))}</p>`);
  return `<!doctype html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(model.title)}</title><style>
@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#1d2939;font-size:11.5px;line-height:1.7;margin:0}
h1{font-size:21px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 6px;border-bottom:2px solid #194185;padding-bottom:3px;color:#194185}h3{font-size:13px}h4{font-size:12.5px;margin:14px 0 4px}
.sub{color:#475467;margin:0 0 4px}.note{color:#667085;font-size:10.5px;margin:2px 0 6px}.b{font-weight:700}.li{margin:2px 0}.foot{color:#667085;font-size:10px;margin-top:20px}
table{width:100%;border-collapse:collapse;margin:4px 0 10px;font-size:10.5px}th,td{border:1px solid #d0d5dd;padding:4px 6px;text-align:${rtl ? 'right' : 'left'};vertical-align:top}th{background:#f2f4f7}tr{page-break-inside:avoid}
.chart{page-break-inside:avoid;margin:4px 0}.chart svg{width:100%;height:auto}section{break-inside:auto}
</style></head><body>${body.join('')}</body></html>`;
}
export function printHtml(html) {
  const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f); const d = f.contentDocument; d.open(); d.write(html); d.close();
  window.setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { window.setTimeout(() => f.remove(), 120000); } }, 350);
}
export function exportModelToPdf(model) { printHtml(modelToHtml(model)); }

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
