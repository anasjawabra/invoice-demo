// Persistence of imported source records, import batches and reviewer decisions. Browser: IndexedDB (database `ib_enforcement_sources`); tests / no IndexedDB: an in-memory backend with the same interface.
// IndexedDB is used ONLY for the synthetic demo records and the reviewer history. Browser storage is not permission to retain confidential source data: real exports are not imported into the demo.
const DB = 'ib_enforcement_sources'; const VERSION = 1;
export const STORES = ['records', 'batches', 'reviews'];

export function memoryBackend() {
  const data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  return {
    kind: 'memory',
    async getAll(s) { return [...data[s].values()].map((x) => structuredClone(x)); },
    async get(s, id) { const x = data[s].get(id); return x ? structuredClone(x) : null; },
    async putMany(s, items) { for (const it of items) data[s].set(it.id, structuredClone(it)); },
    async clear(s) { data[s].clear(); }
  };
}

export function indexedDbBackend() {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no_indexeddb')); return; }
    const rq = indexedDB.open(DB, VERSION);
    rq.onupgradeneeded = () => { for (const s of STORES) if (!rq.result.objectStoreNames.contains(s)) rq.result.createObjectStore(s, { keyPath: 'id' }); };
    rq.onsuccess = () => resolve(rq.result); rq.onerror = () => reject(rq.error);
  }));
  const tx = async (s, mode, fn) => { const db = await open(); return new Promise((resolve, reject) => { const t = db.transaction(s, mode); const st = t.objectStore(s); const out = fn(st); t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); }); };
  return {
    kind: 'indexeddb',
    getAll: (s) => tx(s, 'readonly', (st) => st.getAll()),
    get: async (s, id) => (await tx(s, 'readonly', (st) => st.get(id))) || null,
    putMany: (s, items) => tx(s, 'readwrite', (st) => { for (const it of items) st.put(it); }),
    clear: (s) => tx(s, 'readwrite', (st) => st.clear())
  };
}

export function createSourceStore(backend = null) {
  let be = backend; if (!be) { try { be = typeof indexedDB !== 'undefined' ? indexedDbBackend() : memoryBackend(); } catch { be = memoryBackend(); } }
  return {
    get backend() { return be; },
    async records() { return be.getAll('records'); },
    async recordMap() { return new Map((await be.getAll('records')).map((r) => [r.id, r])); },
    async batches() { return (await be.getAll('batches')).sort((a, b) => String(b.at).localeCompare(String(a.at))); },
    async reviews() { return be.getAll('reviews'); },
    // commit one import result (see importer.importRows): upserts the new/changed records and appends the batch row; unchanged rows are not rewritten
    async commit(result) { if (!result?.ok) return; if (result.upserts.length) await be.putMany('records', result.upserts); await be.putMany('batches', [result.batch]); },
    async putReview(review) { await be.putMany('reviews', [review]); },
    async resetSynthetic() { for (const s of ['records', 'batches']) await be.clear(s); } // clears imported records and batches; reviewer decisions are kept
  };
}
