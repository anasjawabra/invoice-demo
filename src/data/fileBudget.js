export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
export function checkBytes(bytes, limit = MAX_DOCUMENT_BYTES) {
  const n = bytes?.byteLength ?? bytes?.length ?? 0;
  if (n > limit) throw new Error('file_budget_exceeded');
}

// Inspect central-directory sizes before decompressing DOCX/XLSX. ZIP64 and
// multidisk containers are outside this upload budget.
export function checkZipBudget(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let end = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i -= 1) {
    if (v.getUint32(i, true) === 0x06054b50 && i + 22 + v.getUint16(i + 20, true) === b.length) { end = i; break; }
  }
  if (end < 0) throw new Error('invalid_archive');
  const count = v.getUint16(end + 10, true);
  const size = v.getUint32(end + 12, true); let offset = v.getUint32(end + 16, true);
  if (v.getUint16(end + 4, true) || v.getUint16(end + 6, true) || v.getUint16(end + 8, true) !== count || count > 2048 || offset + size !== end) throw new Error('archive_budget_exceeded');
  let total = 0;
  for (let n = 0; n < count; n += 1) {
    if (offset + 46 > end || v.getUint32(offset, true) !== 0x02014b50) throw new Error('invalid_archive');
    const expanded = v.getUint32(offset + 24, true); total += expanded;
    if (expanded > 16 * 1024 * 1024 || total > 40 * 1024 * 1024) throw new Error('archive_budget_exceeded');
    offset += 46 + v.getUint16(offset + 28, true) + v.getUint16(offset + 30, true) + v.getUint16(offset + 32, true);
    if (offset > end) throw new Error('invalid_archive');
  }
  if (offset !== end) throw new Error('invalid_archive');
}
