// The import pipeline: header detection by name → per-cell normalisation → key choice → duplicate / revision classification → rejected-row report.
// Pure: it never touches storage (see store.js) and never reads a file (see excel.js), so the same logic can later consume raw Data Bank records or a direct feed (same `{headers, rows}` input).
import { detectReport, reportById, fieldDef, METHODS } from './reports';
import { normalizeIdentifier, normalizeDate, normalizeAmount, isBlank, isBlockingFlag } from './ids';

export const REJECT = {
  header_mismatch: { ar: 'رؤوس الأعمدة لا تطابق أي تقرير معروف', en: 'Headers do not match a known report' },
  unusable_key: { ar: 'المفتاح مفقود أو تالف أو ملتبس', en: 'Key is missing, damaged or ambiguous' },
  duplicate_key_in_file: { ar: 'مفتاح مكرر داخل الملف نفسه', en: 'Key repeated within the same file' }
};

// small deterministic row hash (FNV-1a over two seeds): detects "same record, changed content" — not a security hash
export function hashText(s) {
  let a = 2166136261; let b = 5381; for (let i = 0; i < s.length; i += 1) { const c = s.charCodeAt(i); a ^= c; a = Math.imul(a, 16777619); b = Math.imul(b ^ c, 33) >>> 0; }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
const cellText = (v) => (v === null || v === undefined ? '' : typeof v === 'number' ? `n:${v}` : `s:${String(v)}`);

function normalizeCell(fd, cell) {
  if (fd.type === 'id') { const r = normalizeIdentifier(cell, { kind: fd.kind, pattern: fd.pattern, expectedLength: fd.expectedLength }); return { value: r.value, raw: r.raw, flags: r.flags, usable: r.usable }; }
  if (fd.type === 'date') { const r = normalizeDate(cell); return { value: r.value, raw: r.raw, flags: r.flags, usable: r.value !== null }; }
  if (fd.type === 'amount') { const r = normalizeAmount(cell); return { value: r.value, raw: r.raw, flags: r.flags, usable: r.value !== null }; }
  // text / status / clause — kept verbatim (trimmed); a spreadsheet may have turned a clause number into a date serial: flag, never interpret
  if (isBlank(cell)) return { value: null, raw: '', flags: [], usable: false };
  const raw = String(cell); const v = raw.trim(); const flags = [];
  if (v === '---') return { value: null, raw, flags: ['placeholder'], usable: false };
  if (fd.clause && typeof cell === 'number' && Number.isInteger(cell) && cell > 20000 && cell < 80000) flags.push('possible_date_coercion');
  return { value: v, raw, flags, usable: true };
}
export const FIELD_FLAG_LABEL = {
  possible_date_coercion: { ar: 'قد يكون إكسل حوّل رقم البند إلى تاريخ — يُعامل نصاً ولا يُفسَّر', en: 'Excel may have turned the clause number into a date — kept as text, not interpreted' },
  placeholder: { ar: 'قيمة نائبة (---)', en: 'Placeholder (---)' },
  ambiguous_date: { ar: 'تاريخ ملتبس لم يُفسَّر', en: 'Ambiguous date not interpreted' },
  invalid_date: { ar: 'تاريخ غير صالح', en: 'Invalid date' },
  invalid_amount: { ar: 'مبلغ غير صالح', en: 'Invalid amount' }
};

/**
 * importRows({ headers, rows, reportId?, file:{name, sha256}, method, existing: Map(recordId→record), now, batchId })
 * rows: arrays aligned to `headers`. → { ok, error?, report, batch, upserts, unchanged, rejected, headerReport }
 */
export function importRows({ headers, rows, reportId = null, file = {}, method = 'data_bank', existing = new Map(), now = new Date().toISOString(), batchId = null }) {
  if (!METHODS[method]?.available) return { ok: false, error: 'method_unavailable', detail: method };
  const det = detectReport(headers, { only: reportId || undefined });
  if (!det.report) {
    return { ok: false, error: 'header_mismatch', detail: det.ambiguous ? { ambiguous: det.ambiguous } : { missing: det.missing, closest: det.best?.report?.id || null },
      rejected: [], upserts: [], unchanged: [], batch: null };
  }
  const report = det.report; const cols = det.cols; const names = Object.keys(cols);
  const bid = batchId || `b-${hashText(`${now}|${file.sha256 || file.name || ''}|${report.id}`)}`;
  const upserts = []; const unchanged = []; const rejected = []; const seen = new Map(); let created = 0; let revised = 0; let skippedEmpty = 0;
  const flagTotals = {};

  rows.forEach((row, i) => {
    const rowNumber = i + 2; // spreadsheet numbering: row 1 is the header
    if (!row || row.every((c) => isBlank(c))) { skippedEmpty += 1; return; }
    const fields = {}; const pairs = [];
    for (const name of names) {
      const fd = fieldDef(report, name); const cell = row[cols[name]]; const nv = normalizeCell(fd, cell);
      fields[name] = { value: nv.value, raw: nv.raw, label: headers[cols[name]] ? String(headers[cols[name]]).trim() : fd.headers[0], flags: nv.flags, report: report.id, ...(fd.personal ? { personal: true } : {}), ...(fd.candidate ? { candidate: true } : {}) };
      pairs.push(`${name}=${cellText(cell)}`);
      for (const fl of nv.flags) flagTotals[fl] = (flagTotals[fl] || 0) + 1;
    }
    // key: the primary identifier when it is usable; else the declared alternate; else the row is rejected (a damaged key is never repaired)
    let keyField = report.key; let keyValue = null; let fromAlt = false;
    const idOk = (nm) => { const fd = fieldDef(report, nm); const raw = row[cols[nm]]; const r = normalizeIdentifier(raw, { kind: fd.kind, pattern: fd.pattern, expectedLength: fd.expectedLength }); return r.usable ? r.value : null; };
    keyValue = report.key in cols ? idOk(report.key) : null;
    if (!keyValue && report.altKey && report.altKey in cols) { const alt = idOk(report.altKey); if (alt) { keyField = report.altKey; keyValue = alt; fromAlt = true; } }
    if (!keyValue) { rejected.push({ rowNumber, reason: 'unusable_key', detail: { field: report.key, label: fields[report.key]?.label, flags: fields[report.key]?.flags || [] } }); return; }
    const id = `${report.id}|${keyField}|${keyValue}`; const rowHash = hashText(pairs.join('␟'));
    if (seen.has(id)) { rejected.push({ rowNumber, reason: 'duplicate_key_in_file', detail: { firstRow: seen.get(id).row, identicalContent: seen.get(id).hash === rowHash } }); return; }
    seen.set(id, { row: rowNumber, hash: rowHash });
    const prior = existing.get(id);
    const recFlags = []; if (fromAlt) recFlags.push('key_from_alternate');
    for (const nm of names) { const fl = fields[nm].flags.filter(isBlockingFlag); if (fl.length && (nm === report.key || nm === report.altKey || fieldDef(report, nm).candidate)) recFlags.push(`damaged_identifier:${nm}`); }
    const ingestion = { method, batchId: bid, fileName: file.name || null, fileSha256: file.sha256 || null, importedAt: now, mappingId: report.id, mappingVersion: report.version };
    if (prior && prior.rowHash === rowHash) { unchanged.push(id); return; }
    const rec = { id, source: report.source, reportId: report.id, reportVersion: report.version, keyField, keyValue, keyLabel: fields[keyField].label, flags: [...new Set(recFlags)], rowHash, rowNumber, fields, ingestion,
      firstImportedAt: prior ? prior.firstImportedAt : now, lastImportedAt: now,
      revisions: prior ? [{ batchId: prior.ingestion.batchId, at: prior.ingestion.importedAt, rowHash: prior.rowHash, fields: Object.fromEntries(Object.entries(prior.fields).map(([n, v]) => [n, { value: v.value, raw: v.raw }])) }, ...(prior.revisions || [])].slice(0, 10) : [] };
    upserts.push(rec); if (prior) revised += 1; else created += 1;
  });

  const batch = { id: bid, at: now, method, source: report.source, reportId: report.id, mappingVersion: report.version, fileName: file.name || null, fileSha256: file.sha256 || null,
    rows: rows.length - skippedEmpty, created, revised, unchanged: unchanged.length, rejected: rejected.length, flagTotals, extraColumns: det.extra, missingOptionalColumns: det.missingOptional };
  return { ok: true, report, batch, upserts, unchanged, rejected, headerReport: { extra: det.extra, missingOptional: det.missingOptional } };
}

// objects keyed by header → { headers, rows } (synthetic data and tests)
export function tableFromObjects(headers, objs) { return { headers, rows: objs.map((o) => headers.map((h) => (h in o ? o[h] : null))) }; }
export const reportLabel = (id, lang = 'ar') => reportById(id)?.label?.[lang] || id;
