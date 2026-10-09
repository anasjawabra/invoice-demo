// Exports a report MODEL to Word / Excel / PowerPoint. The files carry exactly what the conversation shows: the same context (filters,
// period, basis, data label), KPIs, tables (same unit per table, stated in the header), chart data, insights and assumptions;
// Excel also gets exact SAR amounts. Nothing is recomputed here.
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType } from 'docx';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import { tableToText, chartInfo, fillTokens, fmtEvidence } from '../data/reportFormat';
import { fmtSar } from './money';
import { riyadhDateOf, fmtRiyadh } from '../data/clock';

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
export const reportFileName = (model, ext) => `${(model.title || 'report').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 50)}-${riyadhDateOf(model.generatedAt)}.${ext}`;

// the flat, text form of a model (shared by Word and PowerPoint)
export function modelToLines(model) {
  const lang = model.lang; const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const items = [];
  const pushBlock = (b) => {
    if (b.type === 'text') items.push({ k: 'p', text: b.text });
    else if (b.type === 'kpis') items.push({ k: 'table', title: L('المؤشرات', 'Indicators'), headers: [L('المؤشر', 'Measure'), L('القيمة', 'Value'), L('ملاحظة', 'Note')], rows: b.items.map((m) => [m.label, m.value, m.sub]) });
    else if (b.type === 'relations') items.push({ k: 'table', title: L('العلاقات المالية', 'Financial relationships'), headers: [L('العلاقة', 'Relationship'), L('الصيغة', 'Formula')], rows: [[L('إجمالي المفوتر', 'Gross billed'), `${fmtSar(b.totals.gross, lang)} = ${L('الاستبعادات', 'exclusions')} ${fmtSar(b.totals.exclusions, lang)} + ${L('صافي المفوتر', 'net billed')} ${fmtSar(b.totals.net, lang)}`], [L('صافي المفوتر', 'Net billed'), `${fmtSar(b.totals.net, lang)} = ${L('المحصّل', 'collected')} ${fmtSar(b.totals.collected, lang)} + ${L('غير المحصّل', 'uncollected')} ${fmtSar(b.totals.outstanding, lang)}`], [L('نسبة التحصيل', 'Collection rate'), `${rateText(b.totals.collectedOverNet, lang)} (${L('المحصّل ÷ صافي المفوتر', 'collected ÷ net billed')})`], [L('نسبة الاستبعاد', 'Exclusion rate'), `${rateText(b.totals.exclusionRate, lang)} (${L('الاستبعادات ÷ إجمالي المفوتر', 'exclusions ÷ gross billed')})`]] });
    else if (b.type === 'table') { const t = tableToText(b, lang); items.push({ k: 'table', title: `${b.title}${t.unitText ? ` — ${L('المبالغ بوحدة', 'amounts in')}: ${t.unitText}` : ''}`, headers: t.headers, rows: t.total ? [...t.rows, t.total] : t.rows, note: b.note, source: b }); }
    else if (b.type === 'chart') { const { unitText, cu } = chartInfo(b, lang); items.push({ k: 'table', title: `${b.title} — ${L('المبالغ بوحدة', 'amounts in')}: ${unitText}`, headers: [L('البند', 'Item'), ...b.series.map((s) => s.label)], rows: b.labels.map((lab, i) => [lab, ...b.series.map((s) => (s.values[i] == null ? '—' : String(cu.tick(s.values[i]))))]) }); }
    else if (b.type === 'insights') { if (b.title) items.push({ k: 'h3', text: b.title }); b.items.forEach((it) => { items.push({ k: 'p', bold: true, text: pick(it.title, lang) }); items.push({ k: 'p', text: fillTokens(pick(it.body, lang), it.tokens, lang) }); if (it.evidence.length) items.push({ k: 'p', text: it.evidence.map((e) => `${pick(e.k, lang)}: ${fmtEvidence(e, lang)}`).join(' · ') }); items.push({ k: 'p', text: `${L('الأساس', 'Basis')}: ${pick(it.basis, lang)}${it.caveat ? ` — ${L('تحفظ', 'Caveat')}: ${pick(it.caveat, lang)}` : ''}` }); }); }
    else if (b.type === 'callout') items.push({ k: 'p', text: b.text });
    else if (b.type === 'list') b.items.forEach((x) => items.push({ k: 'li', text: x }));
  };
  const ctx = exportContext(model, lang);
  items.push({ k: 'table', title: L('سياق التقرير والمرشحات', 'Report context and filters'), headers: [L('البند', 'Item'), L('القيمة', 'Value')], rows: ctx });
  model.headline.forEach(pushBlock);
  model.sections.forEach((s) => { items.push({ k: 'h2', text: s.title }); if (s.purpose) items.push({ k: 'p', text: s.purpose }); s.blocks.forEach(pushBlock); });
  return items;
}

/* ---------------------------- Word ---------------------------- */
// the Word document as an object (so it can be built and inspected without a browser); exportModelToDocx downloads it
export function buildDocx(model) {
  const rtl = model.lang === 'ar';
  const run = (text, o = {}) => new TextRun({ text: String(text), rightToLeft: rtl, ...o });
  const para = (text, o = {}) => new Paragraph({ bidirectional: rtl, alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(text, o.run)], ...o.para });
  const cell = (text, bold) => new TableCell({ children: [new Paragraph({ bidirectional: rtl, children: [run(text, { bold })] })] });
  const children = [new Paragraph({ bidirectional: rtl, heading: HeadingLevel.TITLE, children: [run(model.title)] }), para(model.subtitle), para(model.lang === 'ar' ? 'بيانات تجريبية اصطناعية — وليست بيانات فعلية للوزارة.' : 'Synthetic demo data — not the Ministry’s actual data.', { para: { spacing: { after: 200 } } })];
  for (const it of modelToLines(model)) {
    if (it.k === 'h2') children.push(new Paragraph({ bidirectional: rtl, heading: HeadingLevel.HEADING_1, spacing: { before: 280 }, children: [run(it.text)] }));
    else if (it.k === 'h3') children.push(new Paragraph({ bidirectional: rtl, heading: HeadingLevel.HEADING_2, children: [run(it.text)] }));
    else if (it.k === 'p') children.push(para(it.text, { run: { bold: it.bold }, para: { spacing: { after: 100 } } }));
    else if (it.k === 'li') children.push(para(`• ${it.text}`, { para: { spacing: { after: 60 } } }));
    else if (it.k === 'table') {
      if (it.title) children.push(new Paragraph({ bidirectional: rtl, spacing: { before: 160 }, children: [run(it.title, { bold: true })] }));
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: rtl, rows: [new TableRow({ children: it.headers.map((h) => cell(h, true)) }), ...it.rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) }))] }));
      if (it.note) children.push(para(it.note, { para: { spacing: { before: 60, after: 120 } } }));
      else children.push(para('', { para: { spacing: { after: 100 } } }));
    }
  }
  return new Document({ sections: [{ children }] });
}
export async function exportModelToDocx(model, filename = reportFileName(model, 'docx')) {
  download(await Packer.toBlob(buildDocx(model)), filename);
}

/* ---------------------------- Excel ---------------------------- */
export function buildWorkbook(model) {
  const lang = model.lang; const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const wb = XLSX.utils.book_new();
  if (ar) wb.Workbook = { Views: [{ RTL: true }] };
  const summary = [[model.title], [model.subtitle], [L('بيانات تجريبية اصطناعية — وليست بيانات فعلية للوزارة', 'Synthetic demo data — not the Ministry’s actual data')], [], [L('سياق التقرير والمرشحات', 'Report context and filters')], ...exportContext(model, lang), []];
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
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[b.sectionTitle && b.sectionTitle !== b.title ? `${b.sectionTitle} — ${b.title}` : b.title], [L('البند', 'Item'), ...b.series.map((s) => `${s.label} (${cu.title.split('—')[1]?.trim()})`)], ...b.labels.map((lab, i) => [lab, ...b.series.map((s) => (s.values[i] == null ? '' : Number((s.values[i] / cu.unit.div).toFixed(6))))])]), sheetName(b.title));
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
  const rtl = model.lang === 'ar'; const PRIMARY = '1B8354';
  const pptx = new pptxgen(); pptx.rtlMode = rtl;
  const title = pptx.addSlide(); title.background = { color: PRIMARY };
  title.addText(model.title, { x: 0.5, y: 2, w: 9, h: 1.2, fontSize: 30, bold: true, color: 'FFFFFF', align: rtl ? 'right' : 'left', rtlMode: rtl });
  title.addText(`${model.subtitle}\n${rtl ? 'بيانات تجريبية اصطناعية — وليست بيانات فعلية للوزارة' : 'Synthetic demo data — not the Ministry’s actual data'}`, { x: 0.5, y: 3.3, w: 9, h: 1, fontSize: 14, color: 'FFFFFF', align: rtl ? 'right' : 'left', rtlMode: rtl });
  const lines = modelToLines(model);
  let slide = null; let y = 0; let heading = '';
  const open = (h) => { slide = pptx.addSlide(); heading = h; slide.addText(h, { x: 0.4, y: 0.25, w: 9.2, h: 0.55, fontSize: 20, bold: true, color: PRIMARY, align: rtl ? 'right' : 'left', rtlMode: rtl }); y = 0.95; };
  for (const it of lines) {
    if (it.k === 'h2') { open(it.text); continue; }
    if (!slide) open(rtl ? 'سياق التقرير' : 'Report context');
    if (it.k === 'h3') continue;
    if (it.k === 'table') {
      // a table that does not fit is continued on the next slide (header repeated, "part n of m" in the title); the total row is the last row and is never dropped
      const chunks = paginateRows(it.rows); const parts = chunks.length;
      for (let k = 0; k < parts; k += 1) {
        const rows = chunks[k];
        if (k > 0 || y > 3.6) open(heading);
        const ttl = it.title ? (parts > 1 ? `${it.title} — ${rtl ? `الجزء ${k + 1} من ${parts}` : `part ${k + 1} of ${parts}`}` : it.title) : '';
        if (ttl) { slide.addText(ttl, { x: 0.4, y, w: 9.2, h: 0.35, fontSize: 12, bold: true, align: rtl ? 'right' : 'left', rtlMode: rtl }); y += 0.4; }
        slide.addTable([it.headers.map((h) => ({ text: h, options: { bold: true, fill: { color: 'EFEFEF' } } })), ...rows], { x: 0.4, y, w: 9.2, fontSize: 9, rtlMode: rtl, autoPage: false });
        y += 0.28 * (rows.length + 1) + 0.2;
        if (it.note && k === parts - 1) { const nh = Math.min(0.9, 0.3 + it.note.length / 150 * 0.3); slide.addText(it.note, { x: 0.4, y, w: 9.2, h: nh, fontSize: 9, italic: true, valign: 'top', align: rtl ? 'right' : 'left', rtlMode: rtl }); y += nh + 0.1; }
      }
    } else {
      const text = it.k === 'li' ? `• ${it.text}` : it.text;
      if (y > 5) open(heading);
      slide.addText(text, { x: 0.4, y, w: 9.2, h: Math.min(1.2, 0.3 + text.length / 140 * 0.3), fontSize: 11, bold: !!it.bold, valign: 'top', align: rtl ? 'right' : 'left', rtlMode: rtl });
      y += Math.min(1.2, 0.3 + text.length / 140 * 0.3) + 0.05;
    }
  }
  await pptx.writeFile({ fileName: filename });
}
