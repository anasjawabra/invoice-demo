// Where the Sanad document work is kept in THIS browser: IndexedDB database `ib_sanad_docs` with three stores —
//   docs         : the document attached to an order (key = order id): name, SHA-256, size, origin and — for an uploaded file — its bytes
//   extractions  : the last extraction of that document for the order (key = order id): provider, attempt counter, pages, fields, error
//   reviews      : one record per reviewed field (key = order|sha256|field): the ORIGINAL extracted value (never changed), the decision and the full history
// The backend is injectable: the in-memory backend is used by the tests (and as the fallback when IndexedDB is unavailable); the IndexedDB backend in the browser.
// Nothing here writes to the Sanad record itself: a review only records what a person decided about a document's extracted value.
import { FIELD_BY_KEY, coerceValue, isEmptyValue } from './compare.js';

export const DB_NAME = 'ib_sanad_docs';
export const STORES = ['docs', 'extractions', 'reviews'];

const clone = (v) => { if (v === undefined) return v; if (Object.prototype.toString.call(v) === '[object ArrayBuffer]') return v.slice(0); return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)); };

export function memoryBackend() {
  const data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  return {
    kind: 'memory',
    async get(store, key) { return clone(data[store].get(key)) ?? null; },
    async put(store, key, value) { data[store].set(key, clone(value)); return true; },
    async del(store, key) { data[store].delete(key); return true; },
    async all(store) { return [...data[store].entries()].map(([key, value]) => ({ key, value: clone(value) })); }
  };
}

export function idbBackend() {
  const open = () => new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no_indexeddb')); return; }
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => { for (const s of STORES) if (!rq.result.objectStoreNames.contains(s)) rq.result.createObjectStore(s); };
    rq.onsuccess = () => resolve(rq.result); rq.onerror = () => reject(rq.error);
  });
  const run = async (store, mode, fn) => { const db = await open(); return new Promise((resolve, reject) => { const t = db.transaction(store, mode); const r = fn(t.objectStore(store)); t.oncomplete = () => { db.close(); resolve(r.result); }; t.onerror = () => { db.close(); reject(t.error); }; t.onabort = () => { db.close(); reject(t.error); }; }); };
  return {
    kind: 'indexeddb',
    async get(store, key) { return (await run(store, 'readonly', (s) => s.get(key))) ?? null; },
    async put(store, key, value) { await run(store, 'readwrite', (s) => s.put(value, key)); return true; },
    async del(store, key) { await run(store, 'readwrite', (s) => s.delete(key)); return true; },
    async all(store) {
      const db = await open();
      return new Promise((resolve, reject) => { const out = []; const t = db.transaction(store, 'readonly'); const rq = t.objectStore(store).openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { out.push({ key: c.key, value: c.value }); c.continue(); } }; t.oncomplete = () => { db.close(); resolve(out); }; t.onerror = () => { db.close(); reject(t.error); }; });
    }
  };
}

export const reviewKey = (orderId, sha, field) => `${orderId}|${sha}|${field}`;
const nowIso = () => new Date().toISOString();

export function createStore(backend = memoryBackend()) {
  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };
  return {
    backend,
    // ---- documents ----
    getDoc: (orderId) => safe(() => backend.get('docs', orderId), null),
    async putDoc(orderId, doc, { by = null, at = nowIso() } = {}) {
      const ok = await safe(() => backend.put('docs', orderId, { ...doc, orderId, attachedBy: by, attachedAt: at }), false);
      if (ok) await safe(() => backend.del('extractions', orderId), null); // a new document starts a new extraction; reviews of the old one stay under its own SHA-256
      return ok;
    },
    // ---- extractions ----
    getExtraction: (orderId) => safe(() => backend.get('extractions', orderId), null),
    saveExtraction: (orderId, ex) => safe(() => backend.put('extractions', orderId, { ...ex, orderId }), false),
    // ---- reviews ----
    async getReviews(orderId, sha) {
      const rows = await safe(() => backend.all('reviews'), []); const out = {};
      for (const { value } of rows) if (value.orderId === orderId && value.sha256 === sha) out[value.fieldKey] = value;
      return out;
    },
    getReview: (orderId, sha, field) => safe(() => backend.get('reviews', reviewKey(orderId, sha, field)), null),
    putReview: (rev) => safe(() => backend.put('reviews', reviewKey(rev.orderId, rev.sha256, rev.fieldKey), rev), false),
    allDocs: () => safe(() => backend.all('docs'), []),
    allExtractions: () => safe(() => backend.all('extractions'), []),
    allReviews: () => safe(() => backend.all('reviews'), [])
  };
}

// The browser store (one per page load). Falls back to memory when IndexedDB cannot be opened (private mode…); `store.backend.kind` says which one is in use.
let shared = null;
export function browserStore() {
  if (!shared) shared = createStore(typeof indexedDB !== 'undefined' ? idbBackend() : memoryBackend());
  return shared;
}

/* ------------------------------------------------------------------ field review (confirm / correct / reject) */
// A review keeps the ORIGINAL extracted value (set at the first review, never changed), the final value, who decided and when, and EVERY decision in `history`.
export const REVIEW_ACTIONS = ['confirm', 'correct', 'reject'];
const DECISION = { confirm: 'confirmed', correct: 'corrected', reject: 'rejected' };

// → { ok:true, review } | { ok:false, error }
export async function reviewField(store, { orderId, extraction, fieldKey, action, value = null, note = '', by, at = nowIso() }) {
  if (!by || !String(by).trim()) return { ok: false, error: 'reviewer_required' };
  if (!REVIEW_ACTIONS.includes(action)) return { ok: false, error: 'unknown_action' };
  const def = FIELD_BY_KEY[fieldKey]; const f = extraction?.fields?.find((x) => x.key === fieldKey);
  if (!def || !f) return { ok: false, error: 'unknown_field' };
  if (!extraction || extraction.status !== 'completed') return { ok: false, error: 'no_extraction' };
  const text = String(note || '').trim();
  let finalValue;
  if (action === 'confirm') {
    if (isEmptyValue(f.value)) return { ok: false, error: 'nothing_to_confirm' };
    if (f.status === 'conflict' && !text) return { ok: false, error: 'note_required' }; // a conflicting value is accepted only with a stated reason
    finalValue = f.value;
  } else if (action === 'correct') {
    if (isEmptyValue(value)) return { ok: false, error: 'value_required' };
    const c = coerceValue(def.kind, value); if (!c.ok) return { ok: false, error: 'invalid_value' };
    finalValue = c.value;
  } else {
    if (!text) return { ok: false, error: 'note_required' };
    finalValue = null;
  }
  const sha = extraction.sha256;
  const prev = await store.getReview(orderId, sha, fieldKey);
  const entry = { n: (prev?.history?.length || 0) + 1, at, by: String(by).trim(), action, decision: DECISION[action], value: finalValue, note: text || null, previousDecision: prev?.decision || null };
  const review = {
    orderId, sha256: sha, fieldKey,
    original: prev?.original || { value: f.value, confidence: f.confidence, status: f.status, page: f.page, snippet: f.snippet }, // immutable once recorded
    decision: DECISION[action], value: finalValue, by: entry.by, at, history: [...(prev?.history || []), entry]
  };
  const saved = await store.putReview(review);
  return saved ? { ok: true, review } : { ok: false, error: 'storage_failed' };
}
