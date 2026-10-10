// Writes the sample enforcement-order PDFs (public/samples/enforcement-orders/*.pdf) from the SYNTHETIC demo world.
// They are digital PDFs with a text layer (plain Latin text, fictional numbers) so the text-layer reader can be shown working end to end;
// «EN-…-scanned.pdf» has pages with NO text layer on purpose (an image-only scan), which needs OCR that this demo does not have.
// Usage: node .test-build/make-order-pdfs.mjs   (bundled by `npm run make:samples`)
import fs from 'node:fs';
import path from 'node:path';
import { loadStore } from '../server/store.js';
import { invoiceIdOf, payerName, sadadOf, violationOf, beneficiaryIdOf } from '../server/names.js';
import { ENTITIES, SOURCES, isoOf } from '../src/data/catalog.js';
import { adaptSourceCase } from '../src/data/sanadSource.js';

const OUT = path.resolve('public/samples/enforcement-orders');
const esc = (s) => String(s).replace(/[\\()]/g, '\\$&');
const num = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// minimal PDF writer: Helvetica, one content stream per page; pages with `blank: true` carry only a drawn box (no text layer)
function pdf(pages) {
  const objs = []; const add = (s) => { objs.push(s); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds = []; const contentIds = [];
  const pagesId = objs.length + 1 + pages.length * 2; // reserve: contents and pages are added first, the Pages object after them
  for (const p of pages) {
    let c = '';
    if (p.blank) c = '0.85 g 60 120 475 560 re f 0 g\n';
    else { let y = 790; for (const l of p.lines) { if (l.gap) { y -= l.gap; continue; } c += `BT /F1 ${l.size || 10} Tf 56 ${y} Td (${esc(l.text)}) Tj ET\n`; y -= (l.size || 10) + 6; } }
    const cid = add(`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}endstream`); contentIds.push(cid);
    pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${cid} 0 R >>`));
  }
  const pg = add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  const cat = add(`<< /Type /Catalog /Pages ${pg} 0 R >>`);
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const st = loadStore(process.argv[2] || '2026-10-09');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.pdf') && !f.startsWith('ar-')) fs.unlinkSync(path.join(OUT, f));
const head = (q, title) => [
  { text: 'SYNTHETIC DEMO DOCUMENT - not an official record', size: 8 }, { gap: 6 },
  { text: title, size: 15 }, { gap: 6 },
  { text: `Enforcement order no: ${q.enforceNum}` }, { text: `Issued by: Sanad (demo feed)    Opened: ${isoOf(q.openedDay)}    Order status: ${adaptSourceCase(q).status === 'مغلق' ? 'Closed' : 'In execution'}` },
  { text: `Municipality: ${ENTITIES[q.ent].en}` }, { text: `Debtor: ${payerName(q.debtor).en} (Beneficiary ID ${beneficiaryIdOf(q.debtor)})` }, { gap: 6 }
];
const refRow = (i) => ({ text: `${invoiceIdOf(st.idKey[i])}   |   ${SOURCES[st.src[i]].en || SOURCES[st.src[i]].key}   |   Issued ${isoOf(st.issue[i])}   |   ${num(st.gross[i])} SAR` });
const wrote = [];
const write = (name, pages) => { fs.writeFileSync(path.join(OUT, name), pdf(pages)); wrote.push(name); };
const FIRST = new Set(['single', 'multi_exact', 'multi_partial_refs', 'multi_no_refs', 'multi_typo_ref', 'serial_ambiguous', 'amount_discrepancy', 'duplicate_across_orders']);
for (const q of st.requests.filter((r) => r.archetype && FIRST.has(r.archetype))) {
  // an amount-discrepancy order's document lists only the invoices it names; the remaining invoice behind the order amount is NOT written anywhere
  const all = q.archetype === 'amount_discrepancy' ? [...q.covers] : [...q.covers, ...(q.hidden || [])];
  const title = 'ENFORCEMENT ORDER - schedule of invoices';
  if (q.archetype === 'multi_partial_refs' || q.archetype === 'multi_no_refs' || q.archetype === 'multi_typo_ref' || q.archetype === 'amount_discrepancy') {
    // multi-page: page 1 header and the first rows; the remaining invoices are in a table on page 2 (a later page must be read too)
    const p1 = [...head(q, title), { text: `Total amount: ${num(q.amount)} SAR`, size: 11 }, { gap: 6 }, { text: 'Invoices covered by this order (continued on the next page)' }, { text: 'Invoice No   |   Type   |   Issue date   |   Amount' }, ...all.slice(0, 1).map(refRow), { gap: 8 }, { text: 'Contract reference: CT-2026-0087 (not an invoice)' }, { text: 'Account no: 4410229981 (customer account, not an invoice)' }];
    const p2 = [{ text: `Enforcement order ${q.enforceNum} - page 2`, size: 11 }, { gap: 6 }, { text: 'Invoice No   |   Type   |   Issue date   |   Amount' }, ...all.slice(1).map(refRow), { gap: 10 }, { text: 'Notice: the invoices above are enforceable together with the first page.' }];
    write(`${q.enforceNum}-${q.archetype}.pdf`, [{ lines: p1 }, { lines: p2 }]);
  } else if (q.archetype === 'serial_ambiguous') {
    const i = q.covers[0];
    write(`${q.enforceNum}-serial-only.pdf`, [{ lines: [...head(q, title), { text: `Total amount: ${num(q.amount)} SAR`, size: 11 }, { gap: 6 }, { text: `Invoice number: ${String(st.idKey[i] % 1e8).padStart(7, '0')}` }, { text: '(The year prefix is missing from the order text.)' }] }]);
  } else {
    write(`${q.enforceNum}-${q.archetype}.pdf`, [{ lines: [...head(q, title), { text: `Total amount: ${num(q.amount)} SAR`, size: 11 }, { gap: 6 }, { text: 'Invoice No   |   Type   |   Issue date   |   Amount' }, ...all.map(refRow)] }]);
  }
}
// E2 (human data entry): an attached multi-page PDF (the only place the references are), a scanned PDF (image only) and a legacy .doc stub (cannot be read)
for (const q of st.requests.filter((r) => ['attach_pdf', 'attach_unreadable'].includes(r.archetype))) {
  if (q.archetype === 'attach_pdf') {
    const all = [...q.covers]; const p1 = [...head(q, 'ENFORCEMENT ORDER - attached schedule'), { text: `Total amount: ${num(q.amount)} SAR`, size: 11 }, { gap: 6 }, { text: 'Invoice No   |   Type   |   Issue date   |   Amount' }, ...all.slice(0, 1).map(refRow)];
    const p2 = [{ text: `Enforcement order ${q.enforceNum} - page 2`, size: 11 }, { gap: 6 }, { text: 'Invoice No   |   Type   |   Issue date   |   Amount' }, ...all.slice(1).map(refRow), { gap: 8 }, { text: `Invoice ${invoiceIdOf(st.idKey[all[0]])} is repeated here (same invoice, second occurrence).` }];
    write(`${q.enforceNum}-attachment.pdf`, [{ lines: p1 }, { lines: p2 }]);
  } else {
    write(`${q.enforceNum}-scan.pdf`, [{ lines: [{ text: 'SYNTHETIC DEMO DOCUMENT - scanned image (no text layer)', size: 8 }] }, { blank: true }]);
    fs.writeFileSync(path.join(OUT, `${q.enforceNum}-legacy.doc`), Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from('SYNTHETIC STUB: legacy Word (.doc) binary - this demo cannot read it', 'latin1'), Buffer.alloc(512)])); wrote.push(`${q.enforceNum}-legacy.doc`);
  }
}
// an image-only (scanned) order: no text layer — needs OCR, which is not connected
const sc = st.requests.find((r) => r.archetype === 'multi_no_refs');
if (sc) write(`${sc.enforceNum}-scanned.pdf`, [{ lines: [{ text: 'SYNTHETIC DEMO DOCUMENT - scanned image (no text layer)', size: 8 }] }, { blank: true }, { blank: true }]);
// an order whose document does not belong to it (wrong order number inside)
const wr = st.requests.find((r) => r.archetype === 'single');
if (wr) { const other = st.requests.find((r) => r.archetype && r !== wr); write(`${wr.enforceNum}-wrong-document.pdf`, [{ lines: [...head(other, 'ENFORCEMENT ORDER'), refRow(other.covers[0])] }]); }
console.log(`wrote ${wrote.length} PDFs to ${OUT}`);
