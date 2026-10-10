// Reads the text of a Word (.docx) file — body paragraphs AND TABLES (each table row becomes one line «[table N, row R] cell | cell | …»), headers and footers.
// A .docx has no fixed pages (Word paginates when it displays): «pages» here are the parts separated by explicit page breaks, or by Word's own
// last-rendered page-break marks when the author's pagination was saved — approximate, and labelled so. Legacy binary .doc is NOT supported (see docText.js).

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');

// xml → { pages: [lines[]], tables }
export function parseWordXml(xml) {
  const explicit = /<w:br\b[^>]*w:type="page"/.test(xml);
  const pages = [[]]; let tables = 0; let tbl = 0; let rowN = 0; let inCell = false; let cells = []; let cell = ''; let para = ''; let inT = false; let depth = 0;
  const line = (t) => { const x = t.replace(/\s+/g, ' ').trim(); if (x) pages[pages.length - 1].push(x); };
  const brk = () => { pages.push([]); };
  const re = /<(\/?)w:(tbl|tr|tc|p|t|br|tab|lastRenderedPageBreak|cr)\b([^>]*?)(\/?)>|([^<]+)/g; let m;
  while ((m = re.exec(xml))) {
    if (m[5] != null) { if (inT) para += decode(m[5]); continue; }
    const close = m[1] === '/'; const tag = m[2]; const attrs = m[3]; const self = m[4] === '/';
    if (tag === 't') { inT = !close && !self; continue; }
    if (tag === 'tab') { para += '\t'; continue; }
    if (tag === 'cr') { para += ' '; continue; }
    if (tag === 'br') { if (/w:type="page"/.test(attrs)) brk(); else para += ' '; continue; }
    if (tag === 'lastRenderedPageBreak') { if (!explicit) brk(); continue; }
    if (tag === 'tbl') { if (!close) { depth += 1; if (depth === 1) { tables += 1; tbl = tables; rowN = 0; } } else depth -= 1; continue; }
    if (tag === 'tr') { if (!close) { rowN += 1; cells = []; } else { line(`[table ${tbl}, row ${rowN}] ${cells.join(' | ')}`); } continue; }
    if (tag === 'tc') { if (!close) { inCell = true; cell = ''; } else { inCell = false; cells.push(cell.replace(/\s+/g, ' ').trim()); } continue; }
    if (tag === 'p') { if (!close) para = ''; else { if (inCell) cell += `${cell ? ' ' : ''}${para}`; else line(para); para = ''; } }
  }
  return { pages: pages.filter((p, i) => p.length || i === 0), tables };
}

// bytes → { pages: [{ page: 1, text, hasTextLayer, units: [{ loc, text }] }], tables, parts }
// A .docx has NO reliable page numbers (Word paginates when it displays), so the whole file is ONE unit of reading and evidence names the LOCATION: «t2r3» = table 2, row 3 ·
// «p5» = paragraph 5 · «hdr» / «ftr» = header / footer. (`parts` = explicit page breaks, informational only.)
export async function readDocxPages(bytes) {
  const { default: JSZip } = await import('jszip'); // loaded only when a Word file is opened
  const zip = await JSZip.loadAsync(bytes);
  const body = zip.file('word/document.xml'); if (!body) throw new Error('not_a_docx');
  const { pages, tables } = parseWordXml(await body.async('string'));
  const units = []; let para = 0;
  for (const name of Object.keys(zip.files).filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n)).sort()) {
    const t = parseWordXml(await zip.file(name).async('string')).pages.flat().join(' ').trim(); if (t) units.push({ loc: /header/.test(name) ? 'hdr' : 'ftr', text: t });
  }
  for (const line of pages.flat()) {
    const m = /^\[table (\d+), row (\d+)\] (.*)$/.exec(line);
    if (m) units.push({ loc: `t${m[1]}r${m[2]}`, text: m[3] }); else { para += 1; units.push({ loc: `p${para}`, text: line }); }
  }
  return { pages: [{ page: 1, text: units.map((u) => u.text).join('\n'), hasTextLayer: true, units }], tables, parts: pages.length };
}
export function locLabel(loc, ar) {
  const m = /^t(\d+)r(\d+)$/.exec(loc || ''); if (m) return ar ? `جدول ${m[1]} · صف ${m[2]}` : `table ${m[1]} · row ${m[2]}`;
  const q = /^p(\d+)$/.exec(loc || ''); if (q) return ar ? `فقرة ${q[1]}` : `paragraph ${q[1]}`;
  if (loc === 'hdr') return ar ? 'رأس المستند' : 'header'; if (loc === 'ftr') return ar ? 'تذييل المستند' : 'footer'; return loc || '';
}
