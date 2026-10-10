// Arabic sample enforcement-order PDFs from the SYNTHETIC demo world (public/samples/enforcement-orders/ar-*.pdf).
//   * ar-<order>-digital.pdf  : a real Arabic text layer (made with LibreOffice from RTL HTML; two pages, the invoice table continues on page 2)
//   * ar-<order>-scanned.pdf  : the same kind of page rendered to an IMAGE and wrapped in a PDF with NO text layer — what a scan looks like
// Needs `soffice` and `pdftoppm` (skipped with a message when they are missing). Usage: npm run make:samples:ar
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadStore } from '../server/store.js';
import { invoiceIdOf, payerName, beneficiaryIdOf } from '../server/names.js';
import { ENTITIES, SOURCES, isoOf } from '../src/data/catalog.js';

const OUT = path.resolve('public/samples/enforcement-orders'); const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'ar-pdf-'));
const have = (c) => { try { execFileSync('which', [c], { stdio: 'ignore' }); return true; } catch { return false; } };
if (!have('soffice') || !have('pdftoppm')) { console.log('soffice / pdftoppm not available: Arabic samples not regenerated'); process.exit(0); }
const SRC_AR = { investment: 'استثمار', fines: 'مخالفات', municipal_fees: 'رسوم بلدية', licenses: 'رخص', accommodation: 'إيواء', tobacco: 'تبغ', white_lands: 'أراضٍ بيضاء' };
const num = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
const st = loadStore(process.argv[2] || '2026-10-09');

function html(q, covers) {
  const rows = covers.map((i) => `<tr><td dir="ltr">${invoiceIdOf(st.idKey[i])}</td><td>${SRC_AR[SOURCES[st.src[i]].key] || SOURCES[st.src[i]].key}</td><td dir="ltr">${isoOf(st.issue[i])}</td><td dir="ltr">${num(st.gross[i])}</td></tr>`);
  const head = `<tr><th>رقم الفاتورة</th><th>النوع</th><th>تاريخ الإصدار</th><th>المبلغ (ريال)</th></tr>`;
  return `<html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>body{font-family:"Geeza Pro","Arial";font-size:14pt;direction:rtl} table{border-collapse:collapse;width:100%} td,th{border:1px solid #444;padding:5px}</style></head><body>
<p style="font-size:9pt">مستند تجريبي اصطناعي — ليس سجلاً رسمياً</p>
<h2>أمر تنفيذ — جدول الفواتير</h2>
<p>رقم أمر التنفيذ: <span dir="ltr">${q.enforceNum}</span></p>
<p>${ENTITIES[q.ent].ar} — المدين: ${payerName(q.debtor).ar} (رقم الهوية <span dir="ltr">${beneficiaryIdOf(q.debtor)}</span>)</p>
<p>المبلغ الإجمالي: <span dir="ltr">${num(q.amount)}</span> ريال</p>
<p>الفواتير المشمولة بالأمر (يتبع الجدول في الصفحة التالية)</p>
<table>${head}${rows.slice(0, 1).join('')}</table>
<p>رقم العقد: <span dir="ltr">CT-2026-0087</span> (ليس فاتورة) — رقم الحساب: <span dir="ltr">4410229981</span> (حساب العميل)</p>
<h3 style="page-break-before:always">أمر التنفيذ <span dir="ltr">${q.enforceNum}</span> — الصفحة ٢</h3>
<table>${head}${rows.slice(1).join('')}</table>
<p>تنبيه: الفواتير الواردة أعلاه واجبة التنفيذ مع ما ورد في الصفحة الأولى.</p></body></html>`;
}
function jpegSize(buf) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) { i += 1; continue; } const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; i += 2 + len; } throw new Error('no SOF'); }
function imagePdf(jpegs) {
  const objs = []; const add = (s) => { objs.push(s); return objs.length; }; const pageIds = []; const pagesId = 1 + jpegs.length * 3 + 1 - 0; // images, contents, pages…
  const ids = jpegs.map((j) => { const { w, h } = jpegSize(j); const im = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>\nstream\n`, 'latin1'), j, Buffer.from('\nendstream', 'latin1')])); const c = `q 595 0 0 842 0 0 cm /Im0 Do Q`; const cid = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`); return { im, cid }; });
  const total = objs.length + jpegs.length + 1;
  ids.forEach(({ im, cid }) => pageIds.push(add(`<< /Type /Page /Parent ${total} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cid} 0 R >>`)));
  const pg = add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${jpegs.length} >>`); const cat = add(`<< /Type /Catalog /Pages ${pg} 0 R >>`);
  const parts = [Buffer.from('%PDF-1.4\n', 'latin1')]; const offs = []; let pos = parts[0].length;
  objs.forEach((o, i) => { const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), Buffer.isBuffer(o) ? o : Buffer.from(o, 'latin1'), Buffer.from('\nendobj\n', 'latin1')]); offs.push(pos); pos += b.length; parts.push(b); });
  parts.push(Buffer.from(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  void pagesId; return Buffer.concat(parts);
}
const soffice = (file) => execFileSync('soffice', ['--headless', '--convert-to', 'pdf:writer_web_pdf_Export', '--outdir', TMP, file], { stdio: 'ignore' });
const make = (arch, nth, kind, covers) => {
  const q = st.requests.filter((r) => r.archetype === arch)[nth]; if (!q) return;
  const base = `ar-${q.enforceNum}`; const f = path.join(TMP, `${base}.html`); fs.writeFileSync(f, html(q, covers(q))); soffice(f);
  const pdf = path.join(TMP, `${base}.pdf`);
  if (kind === 'digital') fs.copyFileSync(pdf, path.join(OUT, `${base}-digital.pdf`));
  else { execFileSync('pdftoppm', ['-jpeg', '-r', '110', pdf, path.join(TMP, `${base}-pg`)]); const jp = fs.readdirSync(TMP).filter((x) => x.startsWith(`${base}-pg`) && x.endsWith('.jpg')).sort().map((x) => fs.readFileSync(path.join(TMP, x))); fs.writeFileSync(path.join(OUT, `${base}-scanned.pdf`), imagePdf(jp)); }
  console.log('wrote', `${base}-${kind}.pdf`);
};
for (const f of fs.readdirSync(OUT)) if (f.startsWith('ar-') && f.endsWith('.pdf')) fs.unlinkSync(path.join(OUT, f));
make('multi_exact', 0, 'digital', (q) => q.covers);
make('multi_no_refs', 1, 'scanned', (q) => q.covers);
