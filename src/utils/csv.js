// CSV syntax and spreadsheet-active text are handled in one place.
export function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function csvDownloadName(disposition, fallback = 'invoices.csv') {
  let name;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition || '');
  if (encoded) { try { name = decodeURIComponent(encoded[1]); } catch { /* ordinary filename fallback */ } }
  if (!name) name = /filename="([^"]+)"/i.exec(disposition || '')?.[1] || /filename=([^;]+)/i.exec(disposition || '')?.[1];
  return (name || fallback).replace(/[\\/\u0000-\u001f]/g, '-').trim() || fallback;
}
