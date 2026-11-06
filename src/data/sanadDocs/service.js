// The workflow around a Sanad record's document: attach (upload or pick a synthetic scenario document), extract through the registered provider, build the review model, and
// summarise the state for list pages. Pure data + the injectable store — no React.
import { browserStore } from './store.js';
import { getProvider, DEFAULT_PROVIDER_ID } from './extraction.js';
import { loadCatalog, docBySha, docByScenario, docUrl } from './catalog.js';
import { scenarioForRecord, SCENARIOS } from './scenarios.js';
import { DOC_FIELDS, structuredValues, compareField, isEmptyValue, displayValue } from './compare.js';

export async function sha256Hex(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', u);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const formatOf = (name = '', type = '') => { const n = String(name).toLowerCase(); if (type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'; if (n.endsWith('.docx')) return 'docx'; if (/\.(png|jpe?g|tiff?)$/.test(n) || /^image\//.test(type)) return 'image'; return 'unknown'; };

/* ------------------------------------------------------------------ documents */
// the document of an order: the one stored, else — for the four scenario records that have a synthetic document — that document, as supplied with the record (not yet "extracted")
export async function currentDoc(store, orderId, catalog = null) {
  const stored = await store.getDoc(orderId); if (stored) return stored;
  return defaultDocFor(orderId, catalog || await loadCatalog());
}
export function defaultDocFor(orderId, catalog) {
  const sc = scenarioForRecord(orderId); if (!sc?.file) return null;
  const entry = docByScenario(catalog, sc.id); if (!entry) return null;
  return docFromEntry(orderId, entry, { virtual: true });
}
function docFromEntry(orderId, entry, extra = {}) {
  return { orderId, sha256: entry.sha256, name: entry.file, size: entry.bytes ?? null, type: 'application/pdf', format: 'pdf', scenarioId: entry.scenarioId, source: 'scenario', url: docUrl(entry), ...extra };
}
// pick a synthetic scenario document
export async function attachScenarioDoc(store, orderId, scenarioId, { by = null, at, catalog = null } = {}) {
  const entry = (catalog || await loadCatalog()).docs.find((d) => d.scenarioId === scenarioId); if (!entry) return { ok: false, error: 'unknown_scenario' };
  const doc = docFromEntry(orderId, entry); const ok = await store.putDoc(orderId, doc, { by, at });
  return ok ? { ok: true, doc: { ...doc, attachedBy: by } } : { ok: false, error: 'storage_failed' };
}
// attach any file: kept with its SHA-256; it is a scenario document ONLY if that hash equals one in the catalogue
export async function attachUpload(store, orderId, file, { by = null, at, catalog = null } = {}) {
  const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
  const sha = await sha256Hex(bytes); const entry = docBySha(catalog || await loadCatalog(), sha);
  const doc = entry
    ? { ...docFromEntry(orderId, entry), name: file.name || entry.file, source: 'upload', recognised: true }
    : { orderId, sha256: sha, name: file.name, size: bytes.length, type: file.type || '', format: formatOf(file.name, file.type), source: 'upload', recognised: false };
  const keep = { ...doc, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  const ok = await store.putDoc(orderId, keep, { by, at });
  return ok ? { ok: true, doc: { ...doc, attachedBy: by } } : { ok: false, error: 'storage_failed' };
}
export async function readDocBytes(doc, fetcher = null) {
  if (doc?.bytes) return new Uint8Array(doc.bytes);
  if (doc?.url) { const f = fetcher || globalThis.fetch; const r = await f(doc.url); if (!r.ok) throw new Error('fetch_failed'); return new Uint8Array(await r.arrayBuffer()); }
  throw new Error('no_bytes');
}

/* ------------------------------------------------------------------ extraction */
// Runs the provider and keeps the outcome. A transient failure is kept with its attempt counter (a retry is attempt n+1); a result that is NOT retryable (a file that is not a scenario
// document) is returned to the caller but not stored, so nothing about an unread file is ever persisted as an extraction.
export async function runExtraction(store, { orderId, record, providerId = DEFAULT_PROVIDER_ID, onPage, delayMs = 0, catalog = null, at, by = null } = {}) {
  const doc = await currentDoc(store, orderId, catalog); if (!doc) return { status: 'failed', error: { code: 'no_document', retryable: false }, persisted: false };
  const provider = getProvider(providerId); if (!provider) return { status: 'failed', error: { code: 'unknown_provider', retryable: false }, persisted: false };
  const prev = await store.getExtraction(orderId); const attempts = prev && prev.sha256 === doc.sha256 ? prev.attempts || 0 : 0; const attempt = attempts + 1;
  let res;
  try { res = await provider.extract(doc, record, { onPage, attempt, delayMs, catalog: catalog || await loadCatalog(), readBytes: () => readDocBytes(doc) }); }
  catch (e) { res = { status: 'failed', pages: [], fields: [], error: { code: 'provider_error', message: String(e?.message || e), retryable: true } }; }
  const ex = { orderId, sha256: doc.sha256, docName: doc.name, providerId, simulated: !!provider.simulated, scenarioId: doc.scenarioId || null, status: res.status, attempts: attempt, pages: res.pages || [], fields: res.fields || [], error: res.error || null, at: at || new Date().toISOString(), by };
  if (res.status === 'failed' && res.error?.retryable === false) return { ...ex, persisted: false };
  const persisted = await store.saveExtraction(orderId, ex);
  return { ...ex, persisted };
}

/* ------------------------------------------------------------------ review model */
const originOfValue = (status, decided) => (decided ? (status === 'corrected' ? 'reviewer' : status === 'confirmed' ? 'document' : 'structured') : null);
// One row per field for the side-by-side review: the structured Sanad value, the document's extracted value (with confidence, page, snippet), the status, the decision and its history.
export function reviewRows(extraction, reviews, record) {
  const structured = structuredValues(record);
  return DOC_FIELDS.map((def) => {
    const f = extraction?.fields?.find((x) => x.key === def.key) || { key: def.key, value: null, confidence: 0, page: null, snippet: null, status: 'missing' };
    const rev = reviews?.[def.key] || null; const sv = structured[def.key];
    const cmp = compareField(def.key, f.value, sv);
    const status = rev ? rev.decision : f.status;
    const final = rev ? { value: rev.value, origin: originOfValue(rev.decision, true) } : null;
    return {
      key: def.key, def, status, extractedStatus: f.status, extracted: f.value, confidence: f.confidence, page: f.page, snippet: f.snippet,
      structured: isEmptyValue(sv) ? null : sv, structuredShown: displayValue(def.kind, sv), extractedShown: displayValue(def.kind, f.value),
      differs: cmp.comparable && !cmp.same, conflict: f.status === 'conflict', needsDecision: !rev && ['extracted', 'uncertain', 'conflict'].includes(f.status),
      review: rev, history: rev?.history || [], original: rev?.original || null, final, finalShown: final ? displayValue(def.kind, final.value) : ''
    };
  });
}
export function countRows(rows) {
  return { total: rows.length, pending: rows.filter((r) => r.needsDecision).length, decided: rows.filter((r) => r.review).length, conflicts: rows.filter((r) => r.conflict).length, missing: rows.filter((r) => r.extractedStatus === 'missing').length };
}

/* ------------------------------------------------------------------ list helpers */
// loadDocsIndex() → Map keyed by the order / case id (enforceNum): { orderId, doc, extraction: {status, attempts, error} | null, counts }
export async function loadDocsIndex(store = browserStore(), catalog = null) {
  const cat = catalog || await loadCatalog(); const map = new Map();
  for (const { value: d } of await store.allDocs()) map.set(d.orderId, { orderId: d.orderId, doc: stripBytes(d), extraction: null, counts: null });
  for (const sc of SCENARIOS) { if (!map.has(sc.recordKey) && sc.file) { const d = defaultDocFor(sc.recordKey, cat); if (d) map.set(sc.recordKey, { orderId: sc.recordKey, doc: d, extraction: null, counts: null }); } }
  const exs = await store.allExtractions(); const reviews = await store.allReviews();
  for (const { value: ex } of exs) {
    const e = map.get(ex.orderId); if (!e || e.doc.sha256 !== ex.sha256) continue;
    e.extraction = { status: ex.status, attempts: ex.attempts, error: ex.error || null, providerId: ex.providerId };
    if (ex.status === 'completed') {
      const mine = {}; for (const { value: r } of reviews) if (r.orderId === ex.orderId && r.sha256 === ex.sha256) mine[r.fieldKey] = r;
      e.counts = countRows(reviewRows(ex, mine, null));
    }
  }
  return map;
}
const stripBytes = ({ bytes, ...rest }) => rest;

// → 'missing' | 'attached' | 'extracted' | 'under_review' | 'reviewed' | 'failed'
export function documentState(record, docsIndex) {
  const id = typeof record === 'string' ? record : (record?.enforceNum ?? record?.id);
  const e = docsIndex?.get?.(id); if (!e || !e.doc) return 'missing';
  if (!e.extraction) return 'attached';
  if (e.extraction.status === 'failed') return 'failed';
  const c = e.counts; if (!c || (c.decided === 0)) return 'extracted';
  return c.pending > 0 ? 'under_review' : 'reviewed';
}
