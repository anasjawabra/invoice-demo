// ============================================================================
// Data-service client. The browser never holds the invoices: every number, list
// page, invoice detail and export is requested from the data service (server/)
// that keeps the whole demo world in typed arrays.
// ============================================================================
import { DEMO_TODAY, IS_TIME_TRAVEL } from '../data/clock';

import { getToken, noteAccessVersion, noteUnauthenticated } from './session';
// ?size=full switches the demo to the large stress-test world; the choice survives navigation within the tab
const DEMO_SIZE = (() => { try { const q = new URLSearchParams(window.location.search).get('size'); if (q === 'full' || q === 'compact') window.sessionStorage.setItem('ib_size', q); return window.sessionStorage.getItem('ib_size') || ''; } catch { return ''; } })();
// The caller's identity is the signed token (Authorization: Bearer): the data service derives the user, the role, the modules and the geographic access from it. The client no longer chooses an identity (the old `x-session` header is gone;
// the owner of uploaded records is the authenticated user id, decided by the server). The organisation / filters in the request body are only NARROWING.
const headers = (token = getToken()) => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(IS_TIME_TRAVEL ? { 'x-demo-today': DEMO_TODAY } : {}), ...(DEMO_SIZE ? { 'x-demo-size': DEMO_SIZE } : {}) });

let epoch = 0;
const cache = new Map();
const inflight = new Map();
const MAX_CACHE = 80;
// a cached answer belongs to ONE signed-in token: a different person (or a new sign-in) never sees another's cached answer
const tokenKey = () => { const t = getToken(); return t ? t.slice(-12) : 'anon'; };
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
// 403 from the data service: the module is off for this account (no data in the body) or the role is read-only (`code: 'read_only_role'`). Pages test `isForbidden(e)` and show the «ليست لديك صلاحية…» state instead of an error.
export class ForbiddenError extends ApiError { constructor(body) { super(403, body); this.name = 'ForbiddenError'; this.forbidden = true; this.code = body?.error || null; this.module = body?.module || body?.permission || null; this.permission = this.module; this.readOnly = body?.error === 'read_only_role'; } }
export const isForbidden = (e) => !!e && (e.forbidden === true || e.status === 403);
export const isReadOnlyRefusal = (e) => !!e && e.readOnly === true;
export const isUnauthenticated = (e) => !!e && e.status === 401;

// Every response goes through here: x-access-version changes re-read the person's access; a 401 signs the tab out (with a message on the sign-in page); a 403 becomes a typed error.
async function readResponse(r, tokenUsed) {
  try { noteAccessVersion(r.headers && typeof r.headers.get === 'function' ? r.headers.get('x-access-version') : null); } catch { /* never block the answer */ }
  const j = await r.json().catch(() => ({}));
  if (r.ok) return j;
  if (r.status === 401) { noteUnauthenticated(tokenUsed); throw new ApiError(401, j); }
  if (r.status === 403) throw new ForbiddenError(j);
  throw new ApiError(r.status, j);
}

// a caller's abort rejects ONLY that caller: a cached request is shared between callers (e.g. React StrictMode runs an effect twice), so one caller's abort must never cancel or poison the shared fetch
const abortable = (p, signal) => {
  if (!signal) return p;
  return new Promise((resolve, reject) => {
    const aborted = () => { const e = new Error('Aborted'); e.name = 'AbortError'; reject(e); };
    if (signal.aborted) { aborted(); return; }
    signal.addEventListener('abort', aborted, { once: true });
    p.then((v) => { signal.removeEventListener('abort', aborted); resolve(v); }, (e) => { signal.removeEventListener('abort', aborted); reject(e); });
  });
};
export async function post(path, body = {}, { signal, cached = true } = {}) {
  const key = cached ? `${epoch}|${tokenKey()}|${path}|${JSON.stringify(body)}` : null;
  if (key && cache.has(key)) return cache.get(key);
  if (key && inflight.has(key)) return abortable(inflight.get(key), signal);
  const tokenUsed = getToken();
  const own = key ? undefined : signal; // a shared (cached) request is not bound to one caller's signal
  const run = resilientFetch(`/api${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: own }, { signal: own })
    .then((r) => readResponse(r, tokenUsed))
    .then((j) => { if (key) { cache.set(key, j); if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value); } return j; })
    .finally(() => { if (key) inflight.delete(key); });
  if (key) inflight.set(key, run);
  return key ? abortable(run, signal) : run;
}
export async function get(path, { signal } = {}) {
  const key = `${epoch}|${tokenKey()}|GET|${path}`;
  if (cache.has(key)) return cache.get(key);
  const tokenUsed = getToken();
  const r = await resilientFetch(`/api${path}`, { headers: headers(tokenUsed), signal }, { signal });
  const j = await readResponse(r, tokenUsed);
  cache.set(key, j);
  return j;
}
// any method, never cached (administration, mutations): get/post above are for the cached read model
export async function request(method, path, body, { signal } = {}) {
  const tokenUsed = getToken();
  const init = { method: String(method).toUpperCase(), headers: headers(tokenUsed), signal };
  if (body !== undefined && body !== null && init.method !== 'GET' && init.method !== 'HEAD') init.body = JSON.stringify(body);
  const r = await resilientFetch(`/api${path}`, init, { signal });
  return readResponse(r, tokenUsed);
}

export const api = {
  meta: () => get('/meta'),
  sanadCases: () => get('/sanad-cases'),
  snapshot: (req, o) => post('/snapshot', req, o),
  series: (req, o) => post('/series', req, o),
  bridge: (req, o) => post('/bridge', req, o),
  // POST /api/list — req: { scope, filters, page, pageSize, sort:{key,dir}, facets?:['product','origin','source','due'], withPriority?, withNc?, withExclusions? } (docs/invoice-lists-redesign.md «Implemented»)
  list: (req, o) => post('/list', req, o),
  noncollection: (req, o) => post('/noncollection', req, o),
  distributions: (req, o) => post('/distributions', req, o), // bins · quartiles · Amanah → municipality → source cells for the chart library (server/distributions.js)
  planActions: (req, o) => post('/plan-actions', req, o), // planning action lines: entity × revenue source × class (A blocked · B ≤ 180 d · C due by year-end · D > 180 d · E later · U no due date) — server/planningActions.js
  worklist: (req, o) => post('/worklist', req, o),
  anomalies: (req, o) => post('/anomalies', req, o),
  quality: (req, o) => post('/quality', req, o),
  sources: (req, o) => post('/sources', req, o),
  contracts: (req, o) => post('/contracts', req, o),
  contract: (req, o) => post('/contract', req, o),
  invoice: (req, o) => post('/invoice', req, o),
  exclusionCheck: (req, o) => post('/exclusion-check', req, { ...o, cached: false }),
  orderMatch: (req, o) => post('/order-match', req, { ...o, cached: false }),
  enforcementCollections: (req, o) => post('/enforcement-collections', req, { ...o, cached: false }),
  orderDebtorInvoices: (req, o) => post('/order-debtor-invoices', req, { ...o, cached: false }),
  upload: async (records) => { const r = await post('/upload', { records }, { cached: false }); bumpEpoch(); return r; },
  clearUploads: async () => { const r = await post('/upload/clear', {}, { cached: false }); bumpEpoch(); return r; },
  // a plain GET URL so the browser streams the CSV to disk (the page never builds the file)
  // (a download navigation cannot send headers: the signed, expiring session token travels as `access_token`, which the data service accepts for /export.csv only)
  exportUrl: (req) => `/api/export.csv?q=${encodeURIComponent(JSON.stringify(req))}${getToken() ? `&access_token=${encodeURIComponent(getToken())}` : ''}${IS_TIME_TRAVEL ? `&today=${DEMO_TODAY}` : ''}`
};
