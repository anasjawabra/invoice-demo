// Minimal CSV reader for the local Furas exports (quoted fields, doubled quotes, CRLF, BOM). It keeps ONLY the columns asked for:
// every other column — personal data included — is skipped while reading and is never held in memory.
// Returns { header: string[] (all columns, lower-cased), n: rows, cols: { name: (string|null)[] } } — empty cells are null.
export function parseCsv(text, wanted) {
  const len = text.length; let i = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  const header = []; const keep = []; const cols = {}; let n = 0; let col = 0; let inHeader = true;
  const want = new Set(wanted);
  const push = (s) => {
    if (inHeader) { const h = s.trim().toLowerCase(); header.push(h); keep.push(want.has(h)); if (want.has(h)) cols[h] = []; return; }
    if (keep[col]) cols[header[col]].push(s === '' ? null : s);
  };
  while (i < len) {
    // one field
    let s; const c = text.charCodeAt(i);
    if (c === 34) { // quoted
      i += 1; let out = ''; let from = i;
      for (;;) {
        const q = text.indexOf('"', i);
        if (q < 0) { out += text.slice(from); i = len; break; }
        if (text.charCodeAt(q + 1) === 34) { out += text.slice(from, q + 1); i = q + 2; from = i; continue; }
        out += text.slice(from, q); i = q + 1; break;
      }
      s = out;
    } else {
      const from = i;
      while (i < len) { const d = text.charCodeAt(i); if (d === 44 || d === 10 || d === 13) break; i += 1; }
      s = text.slice(from, i);
    }
    const d = text.charCodeAt(i);
    if (inHeader || keep[col]) push(s);
    if (d === 44) { col += 1; i += 1; continue; }
    // end of record
    if (d === 13 && text.charCodeAt(i + 1) === 10) i += 2; else i += 1;
    if (inHeader) inHeader = false;
    else { n += 1; for (let k = col + 1; k < header.length; k += 1) if (keep[k]) cols[header[k]].push(null); } // a short record: the missing trailing cells are empty
    col = 0;
  }
  return { header, n, cols };
}
