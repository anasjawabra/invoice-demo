// ONE entry point for an order's attached documents: detect what the file really is (not by its extension alone) and read what this system can read.
//   digital PDF  → text layer (pdf.js)            real
//   .docx        → paragraphs and tables (zip/xml) real
//   scanned PDF page / image (JPEG, PNG, TIFF) → needs OCR, which this system does NOT perform: the page is flagged unread
//   legacy .doc (binary) / other formats → not supported: flagged unread («convert to .docx or PDF»), NEVER treated as read
import { buildExtraction } from './orderMatching';
import { extractFromPdf } from './pdfText';
import { readDocxPages } from './docxText';

export const MAX_DOC_BYTES = 15 * 1024 * 1024;
const startsWith = (b, sig) => sig.every((x, i) => b[i] === x);
export async function detectFormat(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length > 4 && startsWith(b, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) { try { const { default: JSZip } = await import('jszip'); const z = await JSZip.loadAsync(b); return z.file('word/document.xml') ? 'docx' : 'zip_other'; } catch { return 'zip_other'; } }
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'doc'; // OLE2 container: legacy Word (.doc), also .xls/.ppt
  if (startsWith(b, [0xff, 0xd8, 0xff]) || startsWith(b, [0x89, 0x50, 0x4e, 0x47]) || startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])) return 'image';
  return 'unknown';
}
export const FORMAT_LABEL = { pdf: { en: 'PDF', ar: 'PDF' }, docx: { en: 'Word (.docx)', ar: 'Word (.docx)' }, doc: { en: 'Legacy Word (.doc)', ar: 'Word قديم (.doc)' }, image: { en: 'Image', ar: 'صورة' }, zip_other: { en: 'Other archive', ar: 'أرشيف آخر' }, unknown: { en: 'Unknown format', ar: 'صيغة غير معروفة' } };
export const UNREAD_REASON = {
  no_text_layer: { en: 'NOT read — no text layer (scanned image); this system performs no OCR', ar: 'لم تُقرأ — بلا طبقة نص (صورة ممسوحة)؛ ولا يجري هذا النظام OCR' },
  needs_ocr: { en: 'NOT read — an image needs OCR, which this system does not perform', ar: 'لم تُقرأ — الصورة تحتاج OCR ولا يجريه هذا النظام' },
  unsupported_format: { en: 'NOT read — legacy .doc is not supported: convert it to .docx or PDF', ar: 'لم تُقرأ — صيغة .doc القديمة غير مدعومة: حوّلها إلى .docx أو PDF' },
  simulated_no_text: { en: 'NOT read — the page has no recognisable text (OCR simulation of a prepared sample)', ar: 'لم تُقرأ — لا نص يمكن التعرف عليه في الصفحة (محاكاة OCR لعينة معدّة)' },
  unknown_format: { en: 'NOT read — this file format is not supported', ar: 'لم تُقرأ — صيغة الملف غير مدعومة' }
};

// → extraction record (see orderMatching.buildExtraction). `format` says what the file is; unreadable files produce ONE unread page with the reason.
export async function extractDocument(bytes, { orderNo = null, lib = null } = {}) {
  const format = await detectFormat(bytes);
  if (format === 'pdf') { const ex = await extractFromPdf(bytes, { orderNo, lib }); return { ...ex, format }; }
  if (format === 'docx') { const { pages, tables, parts } = await readDocxPages(bytes); return { ...buildExtraction(pages, 'docx_text', { orderNo, format, exactPages: false }), tables, parts }; }
  const reason = format === 'image' ? 'needs_ocr' : format === 'doc' || format === 'zip_other' ? 'unsupported_format' : 'unknown_format';
  return { ...buildExtraction([{ page: 1, text: '', hasTextLayer: false }], 'text_layer', { orderNo, format, reason }), unsupported: true };
}
