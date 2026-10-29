import { sanitizeListMemory } from './navigationState.js';
const volatile = new Map();
const unsaved = new Set();
export const historyStorageKey = (namespace, entry, kind) => `ib_history_v1_${encodeURIComponent(namespace)}_${encodeURIComponent(entry)}_${kind}`;
export function readHistory(namespace, entry, kind) {
  const key = historyStorageKey(namespace, entry, kind);
  if (unsaved.has(key)) return volatile.get(key) ?? null;
  let raw; try { raw = sessionStorage.getItem(key); } catch { return volatile.get(key) ?? null; }
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function writeHistory(namespace, entry, kind, value) {
  const key = historyStorageKey(namespace, entry, kind); volatile.set(key, value);
  try { sessionStorage.setItem(key, JSON.stringify(value)); unsaved.delete(key); } catch { unsaved.add(key); }
}
export function readEntryList(key, restore, entry) {
  if (!restore) return null;
  if (!entry) { try { return sanitizeListMemory(key, JSON.parse(sessionStorage.getItem(`ib_listmem_${key}`))); } catch { return null; } }
  let value = readHistory(entry.namespace, entry.id, `list_${key}`);
  if (value == null && entry.restoreFrom) value = readHistory(entry.namespace, entry.restoreFrom, `list_${key}`);
  if (value == null && entry.legacy) {
    try { const raw = sessionStorage.getItem(`ib_listmem_${key}`); if (raw) { value = JSON.parse(raw); sessionStorage.removeItem(`ib_listmem_${key}`); } } catch { /* invalid legacy snapshot */ }
  }
  return sanitizeListMemory(key, value);
}
export function historyScope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const key of ['preset', 'from', 'to', 'source', 'scopeType', 'muni', 'status', 'mainClass']) {
    if (typeof value[key] !== 'string') return null; out[key] = value[key];
  }
  const date = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  if (!date(out.from) || !date(out.to) || out.from > out.to) return null;
  if (!(typeof value.amanah === 'string' || (Array.isArray(value.amanah) && value.amanah.every((x) => typeof x === 'string')))) return null;
  if (!Array.isArray(value.product) || !value.product.every((x) => typeof x === 'string')) return null;
  out.amanah = Array.isArray(value.amanah) ? [...value.amanah] : value.amanah; out.product = [...value.product];
  return out;
}
