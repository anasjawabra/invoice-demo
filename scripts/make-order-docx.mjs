// Word (.docx) sample attachments (public/samples/enforcement-orders/*.docx) from the SYNTHETIC demo world: the invoice references are ONLY in a table
// (plus a contract mention line), so reading the table is what finds them. Usage: npm run make:samples:docx
import fs from 'node:fs';
import path from 'node:path';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, PageBreak } from 'docx';
import { loadStore } from '../server/store.js';
import { invoiceIdOf, payerName, beneficiaryIdOf } from '../server/names.js';
import { SOURCES, isoOf, ENTITIES } from '../src/data/catalog.js';

const OUT = path.resolve('public/samples/enforcement-orders');
const st = loadStore(process.argv[2] || '2026-10-09'); fs.mkdirSync(OUT, { recursive: true });
const num = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cell = (t, w) => new TableCell({ width: { size: w, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun(String(t))] })] });
const contract = st.contracts.filter(Boolean)[1]?.contractNo || 'CT-2023-0020';
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.docx')) fs.unlinkSync(path.join(OUT, f));
for (const q of st.requests.filter((r) => r.archetype === 'attach_docx')) {
  const rows = q.covers.map((i) => new TableRow({ children: [cell(invoiceIdOf(st.idKey[i]), 2600), cell(SOURCES[st.src[i]].key, 2000), cell(isoOf(st.issue[i]), 1800), cell(num(st.gross[i]), 2000)] }));
  const head = new TableRow({ children: ['Invoice No', 'Type', 'Issue date', 'Amount (SAR)'].map((t, k) => cell(t, [2600, 2000, 1800, 2000][k])) });
  const doc = new Document({ sections: [{ children: [
    new Paragraph({ children: [new TextRun({ text: 'SYNTHETIC DEMO DOCUMENT - not an official record', size: 16 })] }),
    new Paragraph({ children: [new TextRun({ text: 'ENFORCEMENT ORDER - attached schedule', bold: true, size: 30 })] }),
    new Paragraph(`Enforcement order no: ${q.enforceNum}   |   ${ENTITIES[q.ent].en}`),
    new Paragraph(`Debtor: ${payerName(q.debtor).en} (Beneficiary ID ${beneficiaryIdOf(q.debtor)})`),
    new Paragraph(`Total amount: ${num(q.amount)} SAR`),
    new Paragraph('Invoices covered by this order:'),
    new Table({ width: { size: 8400, type: WidthType.DXA }, columnWidths: [2600, 2000, 1800, 2000], rows: [head, ...rows.slice(0, 1)] }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph(`Order ${q.enforceNum} - second part of the schedule`),
    new Table({ width: { size: 8400, type: WidthType.DXA }, columnWidths: [2600, 2000, 1800, 2000], rows: [head, ...rows.slice(1)] }),
    new Paragraph(q.rep === 1 ? `Contract ${contract} itself is referred to enforcement under this order (not only the invoices listed above).` : `The invoices are held under contract ${contract} (mentioned for context; this does not say the contract itself is referred).`)
  ] }] });
  fs.writeFileSync(path.join(OUT, `${q.enforceNum}-attachment.docx`), await Packer.toBuffer(doc)); console.log('wrote', `${q.enforceNum}-attachment.docx`);
}
