// The catalogue of the generated synthetic Sanad PDFs (public/samples/synthetic-sanad/index.json, written by scripts/make-sanad-docs.mjs): per document the file, its SHA-256 and the
// per-page transcripts of what was printed on each page. A file counts as one of the scenario documents ONLY when its SHA-256 equals an entry here — never by name or by content guess.
export const CATALOG_URL = '/samples/synthetic-sanad/index.json';
export const FILE_BASE = '/samples/synthetic-sanad/';
let cache = null;

// `fetcher` is injectable (tests, other hosts); the browser default is fetch(). Failure returns an empty catalogue (the simulation then recognises no file).
export async function loadCatalog(fetcher = null) {
  if (cache) return cache;
  try {
    const f = fetcher || (typeof fetch !== 'undefined' ? fetch : null); if (!f) return { docs: [] };
    const r = await f(CATALOG_URL); const j = r.ok ? await r.json() : null;
    cache = { docs: Array.isArray(j?.docs) ? j.docs : [] };
  } catch { return { docs: [] }; }
  return cache;
}
export const setCatalog = (c) => { cache = c ? { docs: c.docs || [] } : null; }; // tests / hosts that already hold the index
export const docBySha = (catalog, sha) => (sha ? (catalog?.docs || []).find((d) => d.sha256 === sha) || null : null);
export const docByScenario = (catalog, scenarioId) => (catalog?.docs || []).find((d) => d.scenarioId === scenarioId) || null;
export const docUrl = (entry) => `${FILE_BASE}${entry.file}`;
