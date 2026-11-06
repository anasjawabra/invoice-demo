// The saved side of «تحليل أسباب عدم التحصيل»: each finished analysis is kept per signed-in user, as the STRUCTURED OUTPUT of the data service (never as inputs that must be recomputed),
// so /analysis/:id and a page refresh show exactly the figures that were generated. «تحديث التحليل» adds a NEW version beside the old ones; nothing is ever overwritten or silently dropped.
//
// Storage layout (localStorage, injectable for tests) — modelled on src/data/reportStore.js, whose user key, permission and checksum helpers it reuses:
//   ib_nc_idx_v1:<user>          { v, items:[{ id, createdAt, updatedAt, scope, coverage, versions:[{ n, generatedAt, cutoff, savedAt, sourceTaskId, size, pruned? }] }] }   (light: the saved list)
//   ib_nc_rec_v1:<user>:<id>     { v, id, owner, versions:[{ n, generatedAt, cutoff, savedAt, sourceTaskId, dataVersion, taskScope, analysis, prune?, check }] }                 (heavy: one key per analysis)
//  - `view` (optional) = the person's chart presentation for THIS version ({ charts:{ [chartId]: config } }, src/data/reportView.js): a presentation only, outside `check`, so changing a chart type never touches the saved figures.
//  - `check` is a checksum of `analysis`; a version that fails it is reported as unreadable, never shown.
//  - `coverage` = the Amanahs the figures include (same helper as the saved reports): a person whose organisation does not cover it never sees the analysis.
//  - Limits are explicit: a new analysis / version that does not fit is REFUSED with a stated reason (the result then stays in the page's memory for the session); older versions are only ever
//    reduced (the report-only record rows are dropped, flagged `prune`), never removed.
import { checksum, toJsonSafe, coverageOf, canView as canViewIn, userKeyOf } from './reportStore';
import { viewIsDefault } from './reportView';
import { sessionViewer } from './sessionViewer';
import { cleanKnownView as cleanView } from './viewedModel';

// the non-collection analysis is an uncollected-invoices result: the CURRENT access that governs it is the effective scope of the `invoices_uncollected` module
const canView = (coverage, org) => canViewIn(coverage, org, 'invoices_uncollected');
export { userKeyOf, canView };
export const KEYS = { index: 'ib_nc_idx_v1', rec: 'ib_nc_rec_v1' };
export const LIMITS = { analyses: 20, versions: 10, recordChars: 600000 };
export const FORMAT = 1;

const defaultStorage = () => { try { return typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null) || null; } catch { return null; } };
const indexKey = (uk) => `${KEYS.index}:${uk}`;
const recKey = (uk, id) => `${KEYS.rec}:${uk}:${id}`;
const newId = () => `nc-${Date.now().toString(36)}${Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0')}`;

/** the part of an analysis that is only evidence detail (the report-only rows): the first thing an older version gives up when space is short */
export function pruneAnalysis(a) {
  if (!a || !a.unmatched || !Array.isArray(a.unmatched.rows) || !a.unmatched.rows.length) return a;
  return { ...a, unmatched: { ...a.unmatched, rows: [], rowsPruned: a.unmatched.rows.length } };
}
const scopeLight = (s) => ({ from: s?.from ?? null, to: s?.to ?? null, amanah: s?.amanah ?? 'all', source: s?.source ?? 'all', scopeType: s?.scopeType ?? 'all', muni: s?.muni ?? 'all', status: s?.status ?? 'all' });
const metaOf = (v) => ({ n: v.n, generatedAt: v.generatedAt, cutoff: v.cutoff, savedAt: v.savedAt, sourceTaskId: v.sourceTaskId ?? null, size: v.size ?? 0, pruned: !!v.prune });
const verify = (v) => !!v && typeof v === 'object' && v.analysis && typeof v.analysis === 'object' && v.check === checksum(JSON.stringify(v.analysis));

export function createAnalysisStore({ storage = defaultStorage(), limits = LIMITS, idGen = newId, now = () => new Date().toISOString() } = {}) {
  const read = (k) => { try { const t = storage?.getItem(k); return t ? JSON.parse(t) : null; } catch { return null; } };
  const write = (k, v) => { try { storage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch { return false; } };
  const drop = (k) => { try { storage?.removeItem(k); } catch { /* storage unavailable */ } };

  const readIndex = (uk) => {
    if (!uk || !storage) return [];
    const v = read(indexKey(uk)); if (!v || v.v !== FORMAT || !Array.isArray(v.items)) return [];
    return v.items.filter((x) => x && x.id && Array.isArray(x.versions)); // (the index key is per user, so an entry is never another person's)
  };
  const readRecord = (uk, id) => {
    const r = read(recKey(uk, id)); if (!r || r.v !== FORMAT || r.id !== id || r.owner !== uk || !Array.isArray(r.versions)) return null; // a record filed under another user is never read
    return r;
  };
  const writeBoth = (uk, rec, items, prevRec) => { // the record first, then the index; if the index is refused the record goes back to what it was
    if (!write(recKey(uk, rec.id), rec)) return false;
    if (write(indexKey(uk), { v: FORMAT, items })) return true;
    if (prevRec) write(recKey(uk, rec.id), prevRec); else drop(recKey(uk, rec.id));
    return false;
  };
  const fit = (rec) => { // → { rec, pruned:[n] } or { over:true }: the newest version stays whole; older ones give up their evidence rows first
    let r = rec; const pruned = [];
    const size = (x) => JSON.stringify(x).length;
    if (size(r) <= limits.recordChars) return { rec: r, pruned };
    r = { ...r, versions: r.versions.slice() };
    for (let k = 0; k < r.versions.length - 1; k += 1) {
      const v = r.versions[k]; if (v.prune) continue;
      const a = pruneAnalysis(v.analysis); if (a === v.analysis) continue;
      r.versions[k] = { ...v, analysis: a, prune: { unmatchedRows: true }, check: checksum(JSON.stringify(a)) }; pruned.push(v.n);
      if (size(r) <= limits.recordChars) return { rec: r, pruned };
    }
    return { over: true, rec: r, pruned };
  };
  const indexEntry = (rec, base) => ({ ...base, updatedAt: now(), versions: rec.versions.map((v) => metaOf({ ...v, size: JSON.stringify(v.analysis).length })) });
  const makeVersion = (n, { analysis, taskScope = null, generatedAt, cutoff, sourceTaskId = null, dataVersion = null }) => {
    const safe = toJsonSafe(analysis);
    return { n, generatedAt: generatedAt || safe.value?.generatedAt || now(), cutoff: cutoff || safe.value?.cutoff || null, savedAt: now(), sourceTaskId, dataVersion, taskScope: taskScope ? toJsonSafe(taskScope).value : null, analysis: safe.value, check: checksum(JSON.stringify(safe.value)), ...(safe.lossy.length ? { lossy: safe.lossy.slice(0, 10) } : {}) };
  };

  /** the saved analyses this person may open (newest first); one whose scope the organisation no longer covers is not listed */
  const list = (uk, org = null) => readIndex(uk).filter((x) => canView(x.coverage, org)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  /** → the analysis (and the task id → stored id mapping) already saved from this in-session task, or null */
  const findByTask = (uk, taskId) => { if (!taskId) return null; for (const it of readIndex(uk)) { const v = it.versions.find((x) => x.sourceTaskId === taskId); if (v) return { id: it.id, n: v.n }; } return null; };
  /** → { ok, record:{ id, createdAt, versions:[…], unreadable:[n] } } | { ok:false, error:'unavailable'|'not_found'|'forbidden'|'unreadable' } */
  const load = (uk, id, org = null) => {
    if (!uk || !storage) return { ok: false, error: 'unavailable' };
    const it = readIndex(uk).find((x) => x.id === id); const rec = readRecord(uk, id);
    if (!it || !rec) return { ok: false, error: 'not_found' };
    if (!canView(it.coverage, org)) return { ok: false, error: 'forbidden' };
    const good = rec.versions.filter(verify); const unreadable = rec.versions.filter((v) => !verify(v)).map((v) => v.n);
    if (!good.length) return { ok: false, error: 'unreadable' };
    return { ok: true, record: { id, createdAt: it.createdAt, updatedAt: it.updatedAt, scope: it.scope, coverage: it.coverage, versions: good.map((v) => (v.view ? { ...v, view: cleanView(v.view) } : v)).sort((a, b) => a.n - b.n), unreadable } };
  };
  /** a first version of a NEW analysis; saving the same in-session task twice returns the saved one (idempotent) */
  const create = (uk, input, { org = null, access = null } = {}) => {
    if (!uk || !storage) return { ok: false, error: 'unavailable' };
    const dup = findByTask(uk, input.sourceTaskId); if (dup) return { ok: true, id: dup.id, n: dup.n, duplicate: true };
    const items = readIndex(uk);
    if (items.length >= limits.analyses) return { ok: false, error: 'analyses_limit' };
    const id = idGen(); const v1 = makeVersion(1, input);
    const rec = { v: FORMAT, id, owner: uk, versions: [v1] };
    const f = fit(rec); if (f.over) return { ok: false, error: 'too_large' };
    const base = { id, createdAt: now(), scope: scopeLight(v1.analysis?.scope || input.taskScope), coverage: coverageOf({ scope: { amanah: v1.analysis?.scope?.amanah, muni: v1.analysis?.scope?.muni } }, org, access || (org && org.geo) || sessionViewer('invoices_uncollected')?.geo || null) };
    const entry = indexEntry(f.rec, base);
    if (!writeBoth(uk, f.rec, [entry, ...items], null)) return { ok: false, error: 'quota' };
    return { ok: true, id, n: 1 };
  };
  /** a NEW version of an existing analysis (never replaces one); → { ok, n, pruned:[n] } | { ok:false, error } */
  const addVersion = (uk, id, input, { org = null } = {}) => {
    if (!uk || !storage) return { ok: false, error: 'unavailable' };
    const dup = findByTask(uk, input.sourceTaskId); if (dup) return { ok: true, id: dup.id, n: dup.n, duplicate: true };
    const items = readIndex(uk); const it = items.find((x) => x.id === id); const rec = readRecord(uk, id);
    if (!it || !rec) return { ok: false, error: 'not_found' };
    if (!canView(it.coverage, org)) return { ok: false, error: 'forbidden' };
    if (rec.versions.length >= limits.versions) return { ok: false, error: 'versions_limit' };
    const n = rec.versions.reduce((m, v) => Math.max(m, v.n), 0) + 1;
    const next = { ...rec, versions: [...rec.versions, makeVersion(n, input)] };
    const f = fit(next); if (f.over) return { ok: false, error: 'too_large' };
    const entry = indexEntry(f.rec, it);
    if (!writeBoth(uk, f.rec, items.map((x) => (x.id === id ? entry : x)), rec)) return { ok: false, error: 'quota' };
    return { ok: true, id, n, pruned: f.pruned };
  };
  /** keep the chart presentation of ONE version beside its (immutable) analysis; an empty / default view removes it. → { ok } | { ok:false, error } */
  const setView = (uk, id, n, view, { org = null } = {}) => {
    if (!uk || !storage) return { ok: false, error: 'unavailable' };
    const it = readIndex(uk).find((x) => x.id === id); const rec = readRecord(uk, id);
    if (!it || !rec) return { ok: false, error: 'not_found' };
    if (!canView(it.coverage, org)) return { ok: false, error: 'forbidden' };
    if (!rec.versions.some((v) => v.n === n)) return { ok: false, error: 'not_found' };
    const clean = cleanView(view); const keep = !viewIsDefault(clean);
    const next = { ...rec, versions: rec.versions.map((v) => { if (v.n !== n) return v; const { view: _old, ...rest } = v; return keep ? { ...rest, view: clean } : rest; }) }; // eslint-disable-line no-unused-vars
    return write(recKey(uk, id), next) ? { ok: true } : { ok: false, error: 'quota' };
  };
  const remove = (uk, id) => { if (!uk || !storage) return false; drop(recKey(uk, id)); return write(indexKey(uk), { v: FORMAT, items: readIndex(uk).filter((x) => x.id !== id) }); };
  const usage = (uk) => { if (!uk || !storage) return 0; let n = 0; for (let i = 0; i < (storage.length || 0); i += 1) { const k = storage.key(i); if (k && (k === indexKey(uk) || k.startsWith(`${KEYS.rec}:${uk}:`))) n += (storage.getItem(k) || '').length; } return n; };
  return { list, load, create, addVersion, findByTask, setView, remove, usage };
}

/* ---------------- change notification (one store per tab; every hook re-reads when it changes) ---------------- */
let tick = 0; const subs = new Set();
export const subscribeStore = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const storeVersion = () => tick;
export const notifyStore = () => { tick += 1; subs.forEach((f) => f()); };
