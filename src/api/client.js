// ============================================================================
// Data-service client. The browser never holds the invoices: every number, list
// page, invoice detail and export is requested from the data service (server/)
// that keeps the whole demo world in typed arrays.
// ============================================================================
import { DEMO_TODAY, IS_TIME_TRAVEL } from '../data/clock';

const SESSION_KEY = 'ib_session_id';
function sessionId() {
  try {
    let s = window.sessionStorage.getItem(SESSION_KEY);
    if (!s) { s = Math.random().toString(36).slice(2, 12); window.sessionStorage.setItem(SESSION_KEY, s); }
    return s;
  } catch { return 'anon'; }
}
// ?size=full switches the demo to the large stress-test world; the choice survives navigation within the tab
const DEMO_SIZE = (() => { try { const q = new URLSearchParams(window.location.search).get('size'); if (q === 'full' || q === 'compact') window.sessionStorage.setItem('ib_size', q); return window.sessionStorage.getItem('ib_size') || ''; } catch { return ''; } })();
const headers = () => ({ 'Content-Type': 'application/json', 'x-session': sessionId(), ...(IS_TIME_TRAVEL ? { 'x-demo-today': DEMO_TODAY } : {}), ...(DEMO_SIZE ? { 'x-demo-size': DEMO_SIZE } : {}) });

let epoch = 0;
const cache = new Map();
const inflight = new Map();
const MAX_CACHE = 80;
export const bumpEpoch = () => { epoch += 1; cache.clear(); };

// A rejected fetch («Failed to fetch») means the request never reached the data service — typically while it restarts or rebuilds the
// demo world after a code change or a day rollover. Such failures are retried with a short back-off before the page shows an error.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function resilientFetch(url, init, { retries = 3, signal } = {}) {
  let last;
  for (let a = 0; a <= retries; a += 1) {
    try { return await fetch(url, init); } catch (e) {
      if (e?.name === 'AbortError' || signal?.aborted) throw e;
      last = e; if (a < retries) await sleep(350 * (a + 1) ** 2);
    }
  }
  const err = new Error('تعذّر الوصول إلى خدمة البيانات (Failed to fetch). تحقق من تشغيل الخدمة ثم أعد المحاولة.'); err.cause = last; err.network = true; throw err;
}

export class ApiError extends Error { constructor(status, body) { super(body?.message || body?.error || `HTTP ${status}`); this.status = status; this.body = body; } }

export async function post(path, body = {}, { signal, cached = true } = {}) {
  const key = cached ? `${epoch}|${path}|${JSON.stringify(body)}` : null;
  if (key && cache.has(key)) return cache.get(key);
  if (key && inflight.has(key)) return inflight.get(key);
  const run = resilientFetch(`/api${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal }, { signal })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new ApiError(r.status, j); return j; })
    .then((j) => { if (key) { cache.set(key, j); if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value); } return j; })
    .finally(() => { if (key) inflight.delete(key); });
  if (key) inflight.set(key, run);
  return run;
}
export async function get(path, { signal } = {}) {
  const key = `${epoch}|GET|${path}`;
  if (cache.has(key)) return cache.get(key);
  const r = await resilientFetch(`/api${path}`, { headers: headers(), signal }, { signal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, j);
  cache.set(key, j);
  return j;
}

export const api = {
  meta: () => get('/meta'),
  sanadCases: () => get('/sanad-cases'),
  snapshot: (req, o) => post('/snapshot', req, o),
  series: (req, o) => post('/series', req, o),
  bridge: (req, o) => post('/bridge', req, o),
  list: (req, o) => post('/list', req, o),
  worklist: (req, o) => post('/worklist', req, o),
  anomalies: (req, o) => post('/anomalies', req, o),
  risk: (req, o) => post('/risk', req, o),
  quality: (req, o) => post('/quality', req, o),
  sources: (req, o) => post('/sources', req, o),
  contracts: (req, o) => post('/contracts', req, o),
  contract: (req, o) => post('/contract', req, o),
  invoice: (req, o) => post('/invoice', req, o),
  orderMatch: (req, o) => post('/order-match', req, { ...o, cached: false }),
  orderDebtorInvoices: (req, o) => post('/order-debtor-invoices', req, { ...o, cached: false }),
  upload: async (records) => { const r = await post('/upload', { records }, { cached: false }); bumpEpoch(); return r; },
  clearUploads: async () => { const r = await post('/upload/clear', {}, { cached: false }); bumpEpoch(); return r; },
  // a plain GET URL so the browser streams the CSV to disk (the page never builds the file)
  exportUrl: (req) => `/api/export.csv?q=${encodeURIComponent(JSON.stringify(req))}&session=${encodeURIComponent(sessionId())}${IS_TIME_TRAVEL ? `&today=${DEMO_TODAY}` : ''}`
};
