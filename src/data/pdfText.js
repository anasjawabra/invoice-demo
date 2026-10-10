// Reads the TEXT LAYER of a digital PDF (pdf.js). This is NOT optical character recognition: a scanned page — an image with no text
// layer — yields no text here and is reported as «needs OCR». No OCR engine is connected to this demo; text produced by an external OCR
// tool can be imported (see orderMatching.splitOcrText) or the references can be typed in. Nothing here is simulated.
import { buildExtraction } from './orderMatching';

let libPromise = null;
// browser: the worker is bundled by Vite and loaded only when a PDF is actually opened (kept out of the main bundle)
export function loadPdfLib() {
  if (!libPromise) {
    libPromise = Promise.all([import('pdfjs-dist/build/pdf.mjs'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return libPromise;
}

// text items → lines (items on the same baseline, left-to-right; a wide gap becomes a column separator so table rows stay one line)
function linesOf(items) {
  const rows = [];
  for (const it of items) {
    if (!('str' in it) || !it.str) continue;
    const y = Math.round(it.transform[5]); const x = it.transform[4];
    let row = rows.find((r) => Math.abs(r.y - y) <= 2);
    if (!row) { row = { y, parts: [] }; rows.push(row); }
    row.parts.push({ x, w: it.width || 0, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x);
    let out = ''; let end = null;
    for (const p of r.parts) { out += end != null && p.x - end > 12 ? '   |   ' : end != null && p.x - end > 1 && !out.endsWith(' ') && !p.s.startsWith(' ') ? ' ' : ''; out += p.s; end = p.x + p.w; }
    return out;
  }).join('\n');
}

// → { pages: [{ page, text, hasTextLayer }], pageCount }
export async function readPdfPages(bytes, lib) {
  const copy = (bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).slice(); // pdf.js takes over (detaches) the buffer it is given; the caller still needs its own bytes for hashing and storing
  const task = lib.getDocument({ data: copy, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const pdf = await task.promise;
  const pages = [];
  try {
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      const text = linesOf(tc.items);
      pages.push({ page: n, text, hasTextLayer: text.trim().length > 0 });
      page.cleanup();
    }
  } finally { await pdf.destroy(); }
  return { pages, pageCount: pages.length };
}

// PDF bytes → the extraction record the order keeps (every page read, every invoice-like reference with its page and the line it was on)
export async function extractFromPdf(bytes, { orderNo = null, lib = null } = {}) {
  const l = lib || await loadPdfLib();
  const { pages } = await readPdfPages(bytes, l);
  return buildExtraction(pages, 'text_layer', { orderNo });
}

export async function sha256Hex(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const isPdf = (bytes) => { const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); return b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; };
export const MAX_PDF_BYTES = 15 * 1024 * 1024;
