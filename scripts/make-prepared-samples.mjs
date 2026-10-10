// Prepared DEMO samples for the OCR simulation (public/samples/prepared/): eight SCANNED-style documents (image-only PDFs — no text layer) + index.json.
// Each sample belongs to ONE demo order (its number and invoice numbers are in the page content). index.json carries, per page, the TRANSCRIPT of exactly what was rendered onto
// that page (the generator's own source text), plus the SHA-256 of the PDF. The app's «OCR simulation» replays that transcript through the same reference extraction as real text:
// the result is deterministic and tied to the sample's content — never random, never inferred from a file name. It is a SIMULATION, not OCR.
// Needs `soffice` and `pdftoppm`. Usage: npm run make:samples:prepared
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadStore } from '../server/store.js';
import { invoiceIdOf, payerName, beneficiaryIdOf } from '../server/names.js';
import { ENTITIES, SOURCES, isoOf } from '../src/data/catalog.js';

const OUT = path.resolve('public/samples/prepared'); const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'prepared-'));
const have = (c) => { try { execFileSync('which', [c], { stdio: 'ignore' }); return true; } catch { return false; } };
if (!have('soffice') || !have('pdftoppm')) { console.log('soffice / pdftoppm not available: prepared samples not regenerated'); process.exit(0); }
const st = loadStore(process.argv[2] || '2026-10-09', { size: 'compact' });
const num = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SRC_AR = { investment: 'استثمار', fines: 'مخالفات', municipal_fees: 'رسوم بلدية', licenses: 'رخص', accommodation: 'إيواء', tobacco: 'تبغ', white_lands: 'أراضٍ بيضاء', furas: 'فرص' };
const ST_EN = { 'قيد التنفيذ': 'In execution', 'موقوف': 'Suspended', 'مغلق': 'Closed' };

/* ---- page model: blocks → HTML (what is drawn) and transcript lines (what a clean OCR would read) ---- */
const P = (text, o = {}) => ({ t: 'p', text, ...o }); const R = (...cells) => ({ t: 'row', cells }); const STAMP = { t: 'stamp' };
const transcript = (blocks) => blocks.filter((b) => b.t !== 'stamp').map((b) => (b.t === 'row' ? b.cells.join(' | ') : b.text)).join('\n');
function html(pages, ar) {
  const body = pages.map((blocks, pi) => {
    let out = ''; let rows = []; let first = pi > 0;
    const flush = () => { if (rows.length) { out += `<table>${rows.map((r, k) => `<tr>${r.cells.map((c) => (k === 0 && r.head ? `<th>${c}</th>` : `<td dir="ltr">${c}</td>`)).join('')}</tr>`).join('')}</table>`; rows = []; } };
    for (const b of blocks) {
      if (b.t === 'row') { rows.push(b); continue; } flush();
      if (b.t === 'stamp') out += '<table><tr><td style="height:240px;width:240px;background:#d9d9d9"></td></tr></table>';
      else { out += `<p style="font-size:${b.size || 13}pt;margin:5px 0${first ? ';page-break-before:always' : ''}"${b.ltr ? ' dir="ltr"' : ''}>${b.text}</p>`; first = false; }
    }
    flush(); return out;
  }).join('');
  return `<html dir="${ar ? 'rtl' : 'ltr'}" lang="${ar ? 'ar' : 'en'}"><head><meta charset="utf-8"><style>body{font-family:${ar ? '"Geeza Pro","Arial"' : 'Arial'};font-size:13pt;direction:${ar ? 'rtl' : 'ltr'}} table{border-collapse:collapse;width:100%} td,th{border:1px solid #666;padding:5px;font-size:12pt}</style></head><body>${body}</body></html>`;
}
function jpegSize(buf) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) { i += 1; continue; } const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; i += 2 + len; } throw new Error('no SOF'); }
function imagePdf(jpegs) {
  const objs = []; const add = (s) => { objs.push(s); return objs.length; }; const pageIds = [];
  const ids = jpegs.map((j) => { const { w, h } = jpegSize(j); const im = add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.length} >>\nstream\n`, 'latin1'), j, Buffer.from('\nendstream', 'latin1')])); const c = 'q 595 0 0 842 0 0 cm /Im0 Do Q'; const cid = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`); return { im, cid }; });
  const total = objs.length + jpegs.length + 1;
  ids.forEach(({ im, cid }) => pageIds.push(add(`<< /Type /Page /Parent ${total} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cid} 0 R >>`)));
  const pg = add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${jpegs.length} >>`); const cat = add(`<< /Type /Catalog /Pages ${pg} 0 R >>`);
  const parts = [Buffer.from('%PDF-1.4\n', 'latin1')]; const offs = []; let pos = parts[0].length;
  objs.forEach((o, i) => { const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), Buffer.isBuffer(o) ? o : Buffer.from(o, 'latin1'), Buffer.from('\nendobj\n', 'latin1')]); offs.push(pos); pos += b.length; parts.push(b); });
  parts.push(Buffer.from(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(parts);
}
function scan(name, pages, ar) {
  const f = path.join(TMP, `${name}.html`); fs.writeFileSync(f, html(pages, ar));
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf:writer_web_pdf_Export', '--outdir', TMP, f], { stdio: 'ignore' });
  execFileSync('pdftoppm', ['-jpeg', '-r', '100', path.join(TMP, `${name}.pdf`), path.join(TMP, `${name}-pg`)]);
  const jp = fs.readdirSync(TMP).filter((x) => x.startsWith(`${name}-pg`) && x.endsWith('.jpg')).sort().map((x) => fs.readFileSync(path.join(TMP, x)));
  return imagePdf(jp);
}

/* ---- the order header and invoice rows, English or Arabic ---- */
const inv = (i) => invoiceIdOf(st.idKey[i]);
const rowOf = (i, ar) => R(inv(i), ar ? (SRC_AR[SOURCES[st.src[i]].key] || SOURCES[st.src[i]].key) : (SOURCES[st.src[i]].en || SOURCES[st.src[i]].key), isoOf(st.issue[i]), num(st.gross[i]));
const THEAD = (ar) => ({ ...(ar ? R('رقم الفاتورة', 'النوع', 'تاريخ الإصدار', 'المبلغ (ريال)') : R('Invoice No', 'Type', 'Issue date', 'Amount (SAR)')), head: true });
const headEn = (q) => [P('SYNTHETIC DEMO DOCUMENT - not an official record', { size: 9 }), P('ENFORCEMENT ORDER - schedule of invoices', { size: 17 }), P(`Enforcement order no: ${q.enforceNum}`), P(`Issued by: Sanad (demo feed)    Opened: ${isoOf(q.openedDay)}    Order status: ${ST_EN[q.status] || q.status}`), P(`Municipality: ${ENTITIES[q.ent].en}`), P(`Debtor: ${payerName(q.debtor).en} (Beneficiary ID ${beneficiaryIdOf(q.debtor)})`), P(`Total amount: ${num(q.amount)} SAR`)];
const headAr = (q) => [P('مستند تجريبي اصطناعي — ليس سجلاً رسمياً', { size: 9 }), P('أمر تنفيذ — جدول الفواتير', { size: 17 }), P(`رقم أمر التنفيذ: ${q.enforceNum}`), P(`${ENTITIES[q.ent].ar} — المدين: ${payerName(q.debtor).ar} (رقم الهوية ${beneficiaryIdOf(q.debtor)})`), P(`المبلغ الإجمالي: ${num(q.amount)} ريال`)];
const ord = (arch, nth) => st.requests.filter((r) => r.archetype === arch)[nth];

const SCENARIOS = [
  { id: 'one_invoice', arch: 'one_attached', nth: 0, title: { ar: 'فاتورة واحدة', en: 'One invoice' }, what: { ar: 'مستند مصوّر بصفحة واحدة يذكر فاتورة واحدة.', en: 'A scanned one-page document naming one invoice.' },
    pages: (q) => [[...headEn(q), THEAD(), ...q.covers.map((i) => rowOf(i))]] },
  { id: 'multi_pages', arch: 'multi_no_refs', nth: 0, title: { ar: 'عدة فواتير عبر صفحات', en: 'Several invoices across pages' }, what: { ar: 'ثلاث صفحات: الفواتير موزعة على الصفحتين الأولى والثانية، والثالثة ختم بلا نص (تُعدّ غير مقروءة).', en: 'Three pages: invoices on pages 1–2, page 3 is a stamp with no text (reported as not read).' },
    pages: (q) => { const all = [...q.covers, ...(q.hidden || [])]; return [[...headEn(q), P('Invoices covered by this order (continued on the next page)'), THEAD(), rowOf(all[0])], [P(`Enforcement order ${q.enforceNum} - page 2`, { size: 13 }), THEAD(), ...all.slice(1).map((i) => rowOf(i))], [P('\u00a0'), STAMP]]; } },
  { id: 'mixed_sources', arch: 'mixed_sources', nth: 0, title: { ar: 'مراجع في الحقل والوصف والمرفق', en: 'References in the field, description and attachment' }, what: { ar: 'مرجع في الحقل المخصص وآخر في الوصف، والمرفق يذكر الباقي ويكرر الأول (يُدمج دون تكرار).', en: 'One reference in the structured field, one in the description; the attachment names the rest and repeats the first (merged without duplicates).' },
    pages: (q) => [[...headEn(q), P('Invoices covered by this order'), THEAD(), ...q.covers.slice(1).map((i) => rowOf(i)), P(`Invoice ${inv(q.covers[0])} is also named in the order record (repeated here).`)]] },
  { id: 'same_serial_two_years', arch: 'same_serial_two_years', nth: 0, title: { ar: 'فاتورتان بالتسلسل نفسه وسنتين', en: 'Two invoices, same serial, different years' }, what: { ar: 'فاتورتان صحيحتان بالتسلسل نفسه في سنتين مختلفتين يغطيهما الأمر نفسه: كلتاهما تُطابقان بشكل مستقل.', en: 'Two valid invoices with the same serial in different years covered by one order: each matches independently.' },
    pages: (q) => [[...headEn(q), P('Invoices covered by this order'), THEAD(), ...q.covers.map((i) => rowOf(i))]] },
  { id: 'ambiguous_serial', arch: 'serial_ambiguous', nth: 0, title: { ar: 'مرجع ناقص ملتبس', en: 'Incomplete, ambiguous reference' }, what: { ar: 'يذكر المستند تسلسلاً بلا سنة يطابق عدة فواتير: يبقى ملتبساً حتى يتوفر دليل.', en: 'The document gives a serial without a year that matches several invoices: it stays ambiguous until evidence is added.' },
    pages: (q) => [[...headEn(q), P(`Invoice number: ${String(st.idKey[q.covers[0]] % 1e8).padStart(7, '0')}`), P('(The year prefix is missing from the order text.)')]] },
  { id: 'genuine_conflict', arch: 'genuine_conflict', nth: 0, title: { ar: 'تعارض حقيقي في المرجع', en: 'A genuine reference conflict' }, what: { ar: 'يذكر المستند فاتورة تعود لدافع آخر غير مدين الأمر: يلزم دليل قبل الربط.', en: 'The document names an invoice that belongs to a different payer than the order’s debtor: evidence is needed before linking.' },
    pages: (q) => [[...headEn(q), P('Invoices covered by this order'), THEAD(), rowOf(q.covers[0]), ...(q.conflictWith != null && q.conflictWith >= 0 ? [rowOf(q.conflictWith)] : [])]] },
  { id: 'amount_discrepancy', arch: 'amount_discrepancy', nth: 0, title: { ar: 'فرق في المبلغ', en: 'An amount discrepancy' }, what: { ar: 'الفواتير المذكورة لا تساوي مبلغ الأمر: يُعرض الفرق ولا يمنع الربط ولا يُفرض.', en: 'The named invoices do not add up to the order amount: the difference is shown, does not block linking and is never forced.' },
    pages: (q) => [[...headEn(q), P('Invoices covered by this order'), THEAD(), ...q.covers.map((i) => rowOf(i))]] },
  { id: 'arabic_scanned', arch: 'multi_no_refs', nth: 1, ar: true, title: { ar: 'مستند عربي ممسوح ضوئياً', en: 'An Arabic scanned document' }, what: { ar: 'صفحتان عربيتان مصوّرتان؛ أرقام الفواتير اللاتينية داخل نص عربي.', en: 'Two scanned Arabic pages; Latin invoice numbers inside Arabic text.' },
    pages: (q) => { const all = [...q.covers, ...(q.hidden || [])]; return [[...headAr(q), P('الفواتير المشمولة بالأمر (يتبع الجدول في الصفحة التالية)'), THEAD(true), rowOf(all[0], true), P('رقم العقد: CT-2026-0087 (ليس فاتورة) — رقم الحساب: 4410229981 (حساب العميل)')], [P(`أمر التنفيذ ${q.enforceNum} — الصفحة ٢`, { size: 14 }), THEAD(true), ...all.slice(1).map((i) => rowOf(i, true)), P('تنبيه: الفواتير الواردة أعلاه واجبة التنفيذ مع ما ورد في الصفحة الأولى.')]]; } }
];

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
const index = [];
for (const sc of SCENARIOS) {
  const q = ord(sc.arch, sc.nth); if (!q) { console.log('no order for', sc.id); continue; }
  const pages = sc.pages(q); const file = `${sc.id}-${q.enforceNum}.pdf`; const bytes = scan(`${sc.id}-${q.enforceNum}`, pages, !!sc.ar);
  fs.writeFileSync(path.join(OUT, file), bytes);
  index.push({ id: sc.id, orderNo: q.enforceNum, file, lang: sc.ar ? 'ar' : 'en', title: sc.title, what: sc.what, size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    pages: pages.map((b, k) => ({ page: k + 1, text: transcript(b) })) });
  console.log('wrote', file, pages.length, 'page(s)');
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ version: 1, note: 'SYNTHETIC demo samples. Transcripts are the generator’s own source text of each page; the app replays them as an OCR SIMULATION.', samples: index }, null, 1));
console.log(`wrote ${index.length} prepared samples to ${OUT}`);
