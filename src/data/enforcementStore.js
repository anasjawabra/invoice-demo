// Where the enforcement-order work of a person is kept in THIS browser. Written only when the person acts (a document added, a link
// proposed / confirmed / rejected / removed) — opening a page never writes.
//   ib_enforcement_v1 (localStorage) : links, document records (name, hash, extracted references), history  — included in the backup file
//   ib_enforcement_docs (IndexedDB)  : the PDF bytes, keyed by SHA-256 — NOT in the backup (a restored record says the file must be added again)
// The older review state (sessionStorage «ib_rev_cases») is only read, never written, and is shown as it was.
import { emptyStore, validStoreShape, migrateIdScheme } from './orderMatching';

export const ENFORCEMENT_KEY = 'ib_enforcement_v1';

export function loadEnforcement(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    const raw = storage?.getItem(ENFORCEMENT_KEY); if (!raw) return emptyStore();
    const v = JSON.parse(raw);
    return validStoreShape(v) && v ? migrateIdScheme(v) : emptyStore(); // records under ambiguous legacy order ids are set aside, never applied (see migrateIdScheme)
  } catch { return emptyStore(); }
}
export function saveEnforcement(store, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { storage?.setItem(ENFORCEMENT_KEY, JSON.stringify(store)); return true; } catch { return false; }
}

/* ---- PDF bytes (IndexedDB; every call fails soft: the record and its extracted references survive without the file) ---- */
const DB = 'ib_enforcement_docs'; const TABLE = 'files';
function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no_indexeddb')); return; }
    const rq = indexedDB.open(DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(TABLE);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
const tx = async (mode, fn) => { const db = await open(); return new Promise((resolve, reject) => { const t = db.transaction(TABLE, mode); const r = fn(t.objectStore(TABLE)); t.oncomplete = () => { db.close(); resolve(r.result); }; t.onerror = () => { db.close(); reject(t.error); }; }); };
export const putFile = async (id, rec) => { try { await tx('readwrite', (s) => s.put(rec, id)); return true; } catch { return false; } };
export const getFile = async (id) => { try { return (await tx('readonly', (s) => s.get(id))) || null; } catch { return null; } };
