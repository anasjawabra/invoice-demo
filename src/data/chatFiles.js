// Reads the files attached to a «التقارير الذكية» conversation — entirely in the browser, nothing is uploaded anywhere.
//   PDF (digital, with a text layer)  → text per page (pdf.js)             real
//   Word .docx                        → paragraphs and tables              real
//   Excel .xlsx / .xls / .csv         → every sheet as a table             real
//   PowerPoint .pptx                  → the text of every slide            real
//   images (JPEG, PNG, GIF, WebP…)    → shown as a preview only: this system performs NO OCR, so the content is NOT read
//   scanned PDFs, legacy .doc / .ppt  → flagged unread with the reason; NEVER treated as read
// A record says exactly what was read (`status`) and what was not (`note`), so the analysis can state it and never invent content.
import { detectFormat } from './docText';
import { readPdfPages, loadPdfLib } from './pdfText';
import { readDocxPages } from './docxText';

export const MAX_FILES = 6;
export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_ROWS = 20000; // a sheet longer than this is read up to the limit and says so
export const ACCEPT = '.pdf,.docx,.xlsx,.xls,.csv,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,image/*';

const EXT = (name) => String(name || '').toLowerCase().split('.').pop();
export const KIND_LABEL = { pdf: 'PDF', docx: 'Word', sheet: 'Excel', csv: 'CSV', pptx: 'PowerPoint', image: { ar: 'صورة', en: 'Image' }, doc: 'Word (.doc)', ppt: 'PowerPoint (.ppt)', unknown: { ar: 'غير معروف', en: 'Unknown' } };
export const kindLabel = (k, ar) => { const v = KIND_LABEL[k] ?? k; return typeof v === 'string' ? v : v[ar ? 'ar' : 'en']; };

const NOTE = {
  scanned: { ar: 'لم تُقرأ — الصفحات صور بلا طبقة نص؛ ولا يجري هذا النظام OCR.', en: 'NOT read — the pages are images with no text layer; this system performs no OCR.' },
  image: { ar: 'معاينة فقط — محتوى الصورة لم يُقرأ لأن هذا النظام لا يجري OCR أو تحليل صور. يمكنك لصق النص أو إرفاق PDF رقمي أو Excel.', en: 'Preview only — the image content was NOT read: this system performs no OCR or image analysis. Paste the text or attach a digital PDF or Excel.' },
  legacy: { ar: 'لم تُقرأ — الصيغة القديمة غير مدعومة؛ حوّلها إلى .docx أو .pptx أو PDF.', en: 'NOT read — the legacy format is not supported; convert it to .docx, .pptx or PDF.' },
  unknown: { ar: 'لم تُقرأ — صيغة الملف غير مدعومة.', en: 'NOT read — this file format is not supported.' },
  empty: { ar: 'لم تُقرأ — الملف لا يحتوي نصاً أو بيانات.', en: 'NOT read — the file holds no text or data.' },
  toolarge: { ar: 'لم يُقرأ — حجم الملف أكبر من 15 م.ب.', en: 'NOT read — the file is larger than 15 MB.' },
  failed: { ar: 'تعذّرت قراءة الملف (قد يكون تالفاً أو محمياً بكلمة مرور).', en: 'The file could not be read (it may be damaged or password-protected).' },
  truncated: { ar: 'قُرئت أول 20,000 صف فقط.', en: 'Only the first 20,000 rows were read.' }
};
export const noteText = (n, ar) => (n ? (typeof n === 'string' ? n : n[ar ? 'ar' : 'en']) : '');

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ------------------------------------------------------------------ numbers and tables */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const latinDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/٫/g, '.').replace(/٬/g, ',');
// «1,234.50», «١٢٣٤», «1 234 ر.س», «SAR 500», «12.5%» → number; anything that is not purely a number (an ID with letters, free text) → NaN
export function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (v == null) return NaN;
  let s = latinDigits(v).trim(); if (!s) return NaN;
  s = s.replace(/(?:sar|s\.?r\.?|ر\.?\s?س\.?|ريال|﷼)/gi, '').replace(/%/g, '').replace(/\s+/g, '').trim();
  if (!/^[-+]?\(?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?$|^[-+]?\(?\d+(?:\.\d+)?\)?$/.test(s)) return NaN;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-'); const n = Number(s.replace(/[(),+-]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}
const cellText = (v) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).replace(/\s+/g, ' ').trim());

// rows of cells → { headers, rows }: the header is the first row with at least two filled cells; duplicate / empty names are made distinct
export function toTable(aoa, name = '') {
  const rows = (aoa || []).map((r) => (Array.isArray(r) ? r : [r]).map((c) => (typeof c === 'number' ? c : cellText(c)))).filter((r) => r.some((c) => c !== '' && c != null));
  if (!rows.length) return { name, headers: [], rows: [] };
  const hi = Math.max(0, rows.findIndex((r) => r.filter((c) => c !== '' && c != null).length >= 2));
  const width = Math.max(...rows.slice(hi).map((r) => r.length));
  const seen = new Map();
  const headers = Array.from({ length: width }, (_, j) => { let h = cellText(rows[hi][j]) || `Col ${j + 1}`; const n = (seen.get(h) || 0) + 1; seen.set(h, n); if (n > 1) h = `${h} (${n})`; return h; });
  const body = rows.slice(hi + 1).map((r) => Array.from({ length: width }, (_, j) => (r[j] == null ? '' : r[j])));
  return { name, headers, rows: body };
}

// per-column facts, computed from the cells (nothing assumed): how many are filled, how many parse as numbers, the sum / min / max, distinct values
export function profileColumns(table) {
  return table.headers.map((header, j) => {
    let filled = 0; let nums = 0; let sum = 0; let min = Infinity; let max = -Infinity; const distinct = new Set();
    for (const r of table.rows) {
      const v = r[j]; if (v === '' || v == null) continue; filled += 1;
      const n = parseNum(v); if (Number.isFinite(n)) { nums += 1; sum += n; if (n < min) min = n; if (n > max) max = n; }
      if (distinct.size <= 200) distinct.add(String(v));
    }
    const numeric = filled > 0 && nums / filled >= 0.8;
    return { j, header, filled, numeric, sum: numeric ? sum : null, min: numeric ? min : null, max: numeric ? max : null, distinct: distinct.size, capped: distinct.size > 200 };
  });
}

/* ------------------------------------------------------------------ readers */
const sheetsOf = async (bytes) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(bytes, { type: 'array', cellDates: true });
  return wb.SheetNames.map((n) => {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
    const cut = aoa.length > MAX_ROWS + 1;
    return { ...toTable(cut ? aoa.slice(0, MAX_ROWS + 1) : aoa, n), truncated: cut };
  }).filter((t) => t.headers.length);
};
const csvOf = async (bytes) => {
  const XLSX = await import('xlsx');
  let text = new TextDecoder('utf-8').decode(bytes); if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes('�')) { try { text = new TextDecoder('windows-1256').decode(bytes); } catch { /* keep utf-8 */ } } // an Arabic CSV saved by older Excel
  const wb = XLSX.read(text, { type: 'string', raw: true });
  const n = wb.SheetNames[0]; const aoa = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' });
  const cut = aoa.length > MAX_ROWS + 1;
  return [{ ...toTable(cut ? aoa.slice(0, MAX_ROWS + 1) : aoa, 'CSV'), truncated: cut }].filter((t) => t.headers.length);
};
const slidesOf = async (bytes) => {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/(\d+)/)[1]) - Number(b.match(/(\d+)/)[1]));
  const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const out = [];
  for (const [i, n] of names.entries()) {
    const xml = await zip.file(n).async('string');
    const paras = (xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) || []).map((p) => dec((p.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map((t) => t.replace(/<\/?a:t>/g, '')).join('')).trim()).filter(Boolean);
    out.push({ page: i + 1, text: paras.join('\n'), hasTextLayer: paras.length > 0 });
  }
  return out;
};

const imageThumb = (file) => new Promise((resolve) => {
  try { const fr = new FileReader(); fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null); fr.onerror = () => resolve(null); fr.readAsDataURL(file); } catch { resolve(null); }
});

// → record { id, name, size, kind, status: 'ready' | 'partial' | 'unread', note, text, pageCount, tables, pages, preview }
export async function readAttachment(file, { pdfLib = null } = {}) {
  const base = { id: uid(), name: file.name || 'file', size: file.size || 0, kind: 'unknown', status: 'unread', note: null, text: '', pageCount: 0, tables: [], pages: [], preview: null };
  if ((file.size || 0) > MAX_BYTES) return { ...base, kind: EXT(file.name) === 'pdf' ? 'pdf' : 'unknown', note: NOTE.toolarge };
  const ext = EXT(file.name); const mime = String(file.type || '');
  try {
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tif', 'tiff'].includes(ext)) return { ...base, kind: 'image', note: NOTE.image, preview: await imageThumb(file) };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (ext === 'csv' || mime === 'text/csv') {
      const tables = await csvOf(bytes); if (!tables.length) return { ...base, kind: 'csv', note: NOTE.empty };
      return { ...base, kind: 'csv', status: tables[0].truncated ? 'partial' : 'ready', note: tables[0].truncated ? NOTE.truncated : null, tables, pageCount: 1 };
    }
    const fmt = await detectFormat(bytes);
    if (fmt === 'pdf') {
      const { pages } = await readPdfPages(bytes, pdfLib || await loadPdfLib());
      const withText = pages.filter((p) => p.hasTextLayer);
      if (!withText.length) return { ...base, kind: 'pdf', note: NOTE.scanned, pageCount: pages.length };
      const missing = pages.length - withText.length;
      return { ...base, kind: 'pdf', status: missing ? 'partial' : 'ready', note: missing ? { ar: `قُرئت ${withText.length} من ${pages.length} صفحة؛ والباقي صور بلا طبقة نص (لا OCR).`, en: `${withText.length} of ${pages.length} pages were read; the rest are images with no text layer (no OCR).` } : null, pages, pageCount: pages.length, text: pages.map((p) => p.text).join('\n') };
    }
    if (fmt === 'docx') {
      const { pages, tables } = await readDocxPages(bytes); const text = pages.map((p) => p.text).join('\n');
      if (!text.trim()) return { ...base, kind: 'docx', note: NOTE.empty };
      return { ...base, kind: 'docx', status: 'ready', pages, pageCount: 1, text, tablesInDoc: tables };
    }
    if (fmt === 'zip_other' && (ext === 'xlsx' || ext === 'pptx')) {
      const { default: JSZip } = await import('jszip'); const z = await JSZip.loadAsync(bytes);
      if (z.file('ppt/presentation.xml')) {
        const pages = await slidesOf(bytes); const text = pages.map((p) => p.text).join('\n');
        if (!text.trim()) return { ...base, kind: 'pptx', note: NOTE.empty, pageCount: pages.length };
        return { ...base, kind: 'pptx', status: 'ready', pages, pageCount: pages.length, text };
      }
      if (z.file('xl/workbook.xml')) {
        const tables = await sheetsOf(bytes); if (!tables.length) return { ...base, kind: 'sheet', note: NOTE.empty };
        const cut = tables.some((t) => t.truncated);
        return { ...base, kind: 'sheet', status: cut ? 'partial' : 'ready', note: cut ? NOTE.truncated : null, tables, pageCount: tables.length };
      }
    }
    if (fmt === 'doc') { // the OLE2 container is shared by legacy .doc / .xls / .ppt: .xls is readable by the spreadsheet reader
      if (ext === 'xls') { const tables = await sheetsOf(bytes); if (tables.length) return { ...base, kind: 'sheet', status: 'ready', tables, pageCount: tables.length }; }
      return { ...base, kind: ext === 'ppt' ? 'ppt' : 'doc', note: NOTE.legacy };
    }
    if (fmt === 'image') return { ...base, kind: 'image', note: NOTE.image, preview: await imageThumb(file) };
    return { ...base, note: NOTE.unknown };
  } catch (e) {
    return { ...base, kind: ['pdf', 'docx', 'pptx'].includes(ext) ? ext : ext === 'csv' ? 'csv' : ['xlsx', 'xls'].includes(ext) ? 'sheet' : 'unknown', note: NOTE.failed, error: String(e?.message || e) };
  }
}

// the lines the reference extractor reads: free text as it is, and every table row as «cell | cell | cell» so a column of invoice numbers is found row by row
export function attachmentPages(att) {
  if (att.pages?.length && att.kind !== 'sheet' && att.kind !== 'csv') return att.pages.filter((p) => p.hasTextLayer !== false).map((p) => ({ page: p.page, text: p.text, hasTextLayer: true }));
  if (att.tables?.length) return att.tables.map((t, i) => ({ page: i + 1, hasTextLayer: true, text: t.rows.map((r) => r.join(' | ')).join('\n') }));
  return [];
}

// what a person sees as the preview of one attachment (image thumbnail · first rows of a table · first lines of text)
export function previewOf(att, { rows = 6, lines = 8 } = {}) {
  if (att.preview) return { type: 'image', src: att.preview };
  if (att.tables?.length) { const t = att.tables[0]; return { type: 'table', sheet: t.name, headers: t.headers.slice(0, 8), rows: t.rows.slice(0, rows).map((r) => r.slice(0, 8)), totalRows: t.rows.length, sheets: att.tables.length }; }
  if (att.text) return { type: 'text', lines: att.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, lines) };
  return { type: 'none' };
}

export const sizeText = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
