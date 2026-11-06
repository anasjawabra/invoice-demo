// The SYNTHETIC Sanad demo documents (public/samples/synthetic-sanad/sanad-<requestNo>.pdf + index.json) for the document + OCR simulation.
//   * each PDF has a real Arabic text layer (made with LibreOffice from RTL HTML, exactly like scripts/make-arabic-order-pdfs.mjs) and every page is headed «مستند تجريبي — غير رسمي»
//   * the page texts come from src/data/sanadDocs/scenarios.js (the single source of truth), so the printed text and the simulation's transcripts cannot drift apart
//   * index.json lists, per document: the scenario, the record it belongs to, the SHA-256 of the file and the per-page transcripts — the SHA-256 is how the simulation recognises a file
// Fully fictional data. Needs `soffice` (skipped with a message when missing); `pdftotext` / `pdfinfo` (poppler) are used to check the result when present.
// Usage: npm run make:sanad-docs   (or: node scripts/make-sanad-docs.mjs)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SCENARIOS } from '../src/data/sanadDocs/scenarios.js';
import { DOC_MARK } from '../src/data/sanadDocs/labels.js';

const OUT = path.resolve('public/samples/synthetic-sanad'); const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'sanad-pdf-'));
const have = (c) => { try { execFileSync('which', [c], { stdio: 'ignore' }); return true; } catch { return false; } };
if (!have('soffice')) { console.log('soffice not available: synthetic Sanad documents not regenerated'); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const isLtr = (v) => /^[0-9A-Za-z.,\-\s]+$/.test(v);

function pageHtml(text, i) {
  const lines = text.split('\n'); const mark = lines[0]; const title = lines[1]; const footer = lines[lines.length - 1]; const body = lines.slice(2, -1);
  const rows = body.map((l) => {
    const k = l.indexOf(': '); if (k < 0) return `<p>${esc(l)}</p>`;
    const label = l.slice(0, k); const value = l.slice(k + 2);
    const v = isLtr(value) ? `<span dir="ltr">${esc(value)}</span>` : esc(value).replace(/\d[\d,.\-]*\d|\d/g, (m) => `<span dir="ltr">${m}</span>`);
    return `<tr><th>${esc(label)}</th><td>${v}</td></tr>`;
  });
  const table = rows.some((r) => r.startsWith('<tr>')) ? `<table>${rows.filter((r) => r.startsWith('<tr>')).join('')}</table>` : '';
  const free = rows.filter((r) => r.startsWith('<p>')).join('');
  return `<div>
<p style="font-size:15pt;font-weight:bold;color:#B42318;border:2px solid #B42318;padding:6px;text-align:center${i ? ';page-break-before:always' : ''}">${esc(mark)}</p>
<h2>${esc(title)}</h2>${table}${free}
<p style="font-size:9pt;color:#555">${esc(footer)}</p></div>`;
}
const html = (sc) => `<html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>body{font-family:"Geeza Pro","Arial";font-size:14pt;direction:rtl} table{border-collapse:collapse;width:100%} td,th{border:1px solid #444;padding:6px;text-align:start} th{background:#eee;width:40%}</style></head><body>${sc.pages.map(pageHtml).join('')}</body></html>`;

for (const f of fs.readdirSync(OUT)) if (f.endsWith('.pdf')) fs.unlinkSync(path.join(OUT, f));
const docs = [];
for (const sc of SCENARIOS) {
  if (!sc.file) continue;
  const base = sc.file.replace(/\.pdf$/, ''); const f = path.join(TMP, `${base}.html`); fs.writeFileSync(f, html(sc));
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf:writer_web_pdf_Export', '--outdir', TMP, f], { stdio: 'ignore' });
  const bytes = fs.readFileSync(path.join(TMP, `${base}.pdf`)); fs.writeFileSync(path.join(OUT, sc.file), bytes);
  if (have('pdfinfo') && have('pdftotext')) {
    const info = execFileSync('pdfinfo', [path.join(OUT, sc.file)]).toString(); const n = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
    if (n !== sc.pages.length) throw new Error(`${sc.file}: expected ${sc.pages.length} pages, got ${n}`);
    sc.pages.forEach((t, i) => {
      const txt = execFileSync('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), path.join(OUT, sc.file), '-']).toString();
      for (const m of t.match(/\d[\d,.]{3,}/g) || []) if (!txt.includes(m)) throw new Error(`${sc.file} p${i + 1}: «${m}» missing from the text layer`);
      if (!/تجريب/.test(txt)) throw new Error(`${sc.file} p${i + 1}: marker missing from the text layer`);
    });
  }
  docs.push({ scenarioId: sc.id, n: sc.n, recordKey: sc.recordKey, file: sc.file, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, mark: DOC_MARK, pages: sc.pages.map((text, i) => ({ page: i + 1, text })) });
  console.log('wrote', sc.file, `(${sc.pages.length} pages, ${bytes.length} bytes)`);
}
fs.writeFileSync(path.join(OUT, 'index.json'), `${JSON.stringify({ note: 'Fully SYNTHETIC documents for the Sanad document + OCR simulation demo. Not official, not real. The SHA-256 identifies a scenario document.', docs }, null, 1)}\n`);
console.log('wrote index.json');
