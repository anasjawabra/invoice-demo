import { useCallback, useEffect, useRef, useState } from 'react';
export const emptyWorkflow = () => ({ v: 1, revision: 0, batches: [], actions: [] });
const history = (h) => Array.isArray(h) && h.every((r) => r && typeof r.at === 'string' && typeof r.by === 'string' && ['note', 'owner', 'status', 'action'].every((k) => r[k] == null || typeof r[k] === 'string'));
export function validWorkflowStore(store) {
  return store?.v === 1 && Number.isInteger(store.revision) && store.revision >= 0 && Array.isArray(store.batches) && Array.isArray(store.actions) && store.actions.length <= 5000 && store.batches.every((b) => typeof b.id === 'string' && typeof b.fileName === 'string' && typeof b.by === 'string' && typeof b.at === 'string' && ['applied', 'withdrawn'].includes(b.status) && history(b.history) && Array.isArray(b.rows) && b.rows.length <= 5000 && b.rows.every((r) => typeof r.invoiceId === 'string' && typeof r.ruleId === 'string' && typeof r.evidence === 'string')) && store.actions.every((a) => typeof a.invoiceId === 'string' && typeof a.owner === 'string' && typeof a.dueDate === 'string' && ['open', 'in_progress', 'done', 'dismissed'].includes(a.status) && history(a.history) && a.before && a.after && ['net', 'collected', 'outstanding', 'exclusions'].every((k) => Number.isFinite(a.before[k]) && Number.isFinite(a.after[k])));
}
export function readWorkflow(storage, key) {
  try {
    const raw = storage.getItem(key); if (!raw) return { ok: true, store: emptyWorkflow() };
    const store = JSON.parse(raw);
    if (!validWorkflowStore(store)) throw new Error('invalid_workflow');
    return { ok: true, store };
  } catch { return { ok: false, store: emptyWorkflow(), error: 'storage_failed' }; }
}
export function writeWorkflow(storage, key, transform) {
  const current = readWorkflow(storage, key); if (!current.ok) return current;
  try {
    const next = transform(current.store); if (!next) return { ok: false, error: 'conflict' };
    const store = { ...next, revision: current.store.revision + 1 };
    if (!validWorkflowStore(store)) return { ok: false, error: 'invalid_workflow' };
    storage.setItem(key, JSON.stringify(store)); return { ok: true, store };
  } catch { return { ok: false, error: 'storage_failed' }; }
}
export function workflowDecisions(base, batches) {
  const result = Object.create(null);
  for (const b of batches) if (b.status === 'applied') for (const r of b.rows) if (r.status !== 'withdrawn') {
    result[r.invoiceId] ||= { byRule: {} };
    result[r.invoiceId].byRule[r.ruleId] = { manualCandidate: true, exclusion: { reviewStatus: 'approved', reviewNote: r.evidence, reviewer: { en: b.by, ar: b.by }, reviewDate: b.at }, history: b.history };
  }
  for (const [id, d] of Object.entries(base)) result[id] = { ...d, byRule: { ...result[id]?.byRule, ...(d.byRule || (d.exclusion ? { [d.ruleId || '_primary']: d } : {})) } };
  return result;
}
export function addBatch(store, batch) {
  const active = new Set(store.batches.filter((b) => b.status === 'applied').flatMap((b) => b.rows.filter((r) => r.status !== 'withdrawn').map((r) => `${r.invoiceId}|${r.ruleId}`)));
  if (batch.rows.some((r) => active.has(`${r.invoiceId}|${r.ruleId}`))) return null;
  return { ...store, batches: [...store.batches, batch] };
}
export function withdrawBatch(store, id, row, audit) {
  const b = store.batches.find((x) => x.id === id); if (!b || b.status !== 'applied' || row && !b.rows.some((r) => r.invoiceId === row.invoiceId && r.ruleId === row.ruleId && r.status !== 'withdrawn')) return null;
  return { ...store, batches: store.batches.map((x) => x.id !== id ? x : { ...x, status: row ? 'applied' : 'withdrawn', rows: row ? x.rows.map((r) => r.invoiceId === row.invoiceId && r.ruleId === row.ruleId ? { ...r, status: 'withdrawn' } : r) : x.rows, history: [...x.history, { ...audit, action: row ? 'withdraw_row' : 'withdraw_batch', invoiceId: row?.invoiceId, ruleId: row?.ruleId }] }) };
}
export function useWorkflow(key) {
  const currentKey = useRef(key); currentKey.current = key;
  const load = () => { try { return { key, ...readWorkflow(localStorage, key) }; } catch { return { key, ok: false, store: emptyWorkflow(), error: 'storage_failed' }; } };
  const [saved, setSaved] = useState(load);
  const current = saved.key === key ? saved : load();
  useEffect(() => { setSaved(load()); const sync = (e) => { if (e.key === key || e.key == null) setSaved(load()); }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, [key]);
  const update = useCallback(async (transform) => {
    const commit = () => { if (currentKey.current !== key) return { ok: false, error: 'account_changed' }; try { const r = writeWorkflow(localStorage, key, transform); if (r.ok) setSaved({ key, ...r }); return r; } catch { return { ok: false, error: 'storage_failed' }; } };
    return navigator.locks ? navigator.locks.request(key, commit) : commit();
  }, [key]);
  return { ...current, update };
}
