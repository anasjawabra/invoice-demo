/**
 * Zero-dependency CSV export (Blob + a.download) — mirrors the project's
 * no-runtime-deps server philosophy. Used by the "Export" buttons on the
 * Reconciliation / Audit / Revenue boards.
 *
 * @param {string} filename  download name (without extension)
 * @param {Array<Object>} rows  records; keys of the first row become headers
 */
export function exportCSV(filename, rows) {
  if (!rows?.length) return false;
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
