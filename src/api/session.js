// The signed-in SESSION of the browser tab: the server-issued token + the `me` document (the account, its ONE role, its modules and its ONE geographic scope) in sessionStorage.
// Identity, role and authorised entities come ONLY from the account (`me`); there is no persona / organisation choice to store.
// A password is typed into the sign-in form and posted ONCE to /api/auth/login (or /activate); it is never kept, stored or logged. The token is a signed, expiring credential held for the tab only.
// Plain module (no React) so the api client, the auth context and tests/access-client.test.mjs share one implementation; storage and fetch are injectable for tests.
const KEY = 'ib_auth';
const LEGACY_KEYS = ['ib_user']; // sessions of the retired client-only login carry no token: they are discarded

let storage = null;      // test hook; default = window.sessionStorage when it exists, else memory
let fetchImpl = null;    // test hook; default = global fetch
const memory = new Map();
const mem = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => { memory.set(k, String(v)); }, removeItem: (k) => { memory.delete(k); } };
const store = () => { if (storage) return storage; try { if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage; } catch { /* blocked */ } return mem; };
const doFetch = (...a) => (fetchImpl || fetch)(...a);

const EMPTY = Object.freeze({ token: null, me: null, notice: null, checking: false });
let state = EMPTY;
const listeners = new Set();
const emit = (event) => { for (const l of [...listeners]) { try { l(state, event); } catch { /* a listener must never break the session */ } } };
const set = (next, event) => { state = next; emit(event); };

function persist() {
  try {
    if (!state.token) { store().removeItem(KEY); return; }
    store().setItem(KEY, JSON.stringify({ token: state.token, me: state.me })); // never a password
  } catch { /* storage unavailable: the session lives for this page only */ }
}
export function loadStoredSession() {
  try {
    for (const k of LEGACY_KEYS) store().removeItem(k);
    const raw = store().getItem(KEY); if (!raw) return EMPTY;
    const j = JSON.parse(raw);
    if (!j || typeof j.token !== 'string' || !j.token || !j.me) return EMPTY;
    return { token: j.token, me: j.me, notice: null, checking: true }; // `checking`: re-validated with /auth/me before the app trusts it
  } catch { return EMPTY; }
}

export const getState = () => state;
export const getToken = () => state.token;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** test hook: replace storage / fetch and reload the stored session */
export function __configure({ storage: s, fetch: f } = {}) { storage = s || null; fetchImpl = f || null; memory.clear(); listeners.clear(); state = loadStoredSession(); lastVersion = null; refreshing = null; }

const API = '/api';
async function call(method, path, body, token) {
  let res;
  try {
    res = await doFetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  } catch { return { ok: false, status: 0, error: 'network' }; }
  const json = await res.json().catch(() => ({}));
  const version = res.headers && typeof res.headers.get === 'function' ? res.headers.get('x-access-version') : null;
  return { ok: res.ok, status: res.status, json, error: res.ok ? null : (json && json.error) || `http_${res.status}`, version };
}

/* ---------------------------------------------------------------- sign in / out ---------------------------------------------------------------- */
function adopt(json) {
  const me = json.me;
  set({ token: json.token, me, notice: null, checking: false }, 'login');
  lastVersion = me?.accessVersion ?? null;
  persist();
}
/** POST /api/auth/login — resolves { ok:true, me } or { ok:false, error:<server code> } */
export async function login(username, password) {
  const r = await call('POST', '/auth/login', { username: String(username || '').trim(), password: String(password || '') });
  if (!r.ok || !r.json || !r.json.token || !r.json.me) return { ok: false, error: r.error || 'invalid_credentials', status: r.status };
  adopt(r.json); return { ok: true, me: r.json.me };
}
/** POST /api/auth/activate — the one-time code of an invited / re-invited account + a new password; signs the person in */
export async function activate(code, password) {
  const r = await call('POST', '/auth/activate', { code: String(code || '').trim(), password: String(password || '') });
  if (!r.ok || !r.json || !r.json.token || !r.json.me) return { ok: false, error: r.error || 'invalid_activation_code', status: r.status, fields: r.json && r.json.fields };
  adopt(r.json); return { ok: true, me: r.json.me };
}
/** sign out locally (and tell the server, best effort). `reason` shows a notice on the sign-in page. */
export function signOut(reason = null) {
  const token = state.token;
  if (token) { call('POST', '/auth/logout', {}, token).catch(() => {}); } // best effort: the token also expires by itself
  set({ ...EMPTY, notice: reason ? { code: reason } : null }, 'logout');
  persist();
  lastVersion = null;
}
export function clearNotice() { if (state.notice) set({ ...state, notice: null }, 'notice'); }

/* ---------------------------------------------------------------- re-validation and live changes ---------------------------------------------------------------- */
let refreshing = null;
let lastVersion = null;
/** GET /api/auth/me — re-reads the person's access. 401 → signed out with a message; other failures keep the session (the next request decides). */
export function refreshMe() {
  if (!state.token) return Promise.resolve(null);
  if (refreshing) return refreshing;
  const tokenAtStart = state.token;
  refreshing = (async () => {
    const r = await call('GET', '/auth/me', null, tokenAtStart);
    if (state.token !== tokenAtStart) return state.me; // signed out or in again meanwhile
    if (r.status === 401 || r.status === 403 && (r.error === 'account_inactive')) { signOut(r.error === 'account_inactive' ? 'account_inactive' : 'unauthenticated'); return null; }
    if (!r.ok || !r.json) { if (state.checking) set({ ...state, checking: false }, 'checked'); return state.me; }
    const me = r.json.me || r.json;
    lastVersion = me.accessVersion ?? lastVersion;
    set({ ...state, me, checking: false }, 'me');
    persist();
    return me;
  })().finally(() => { refreshing = null; });
  return refreshing;
}
/** the api client reports the `x-access-version` header of every response: a change re-reads `me` so permission / scope changes apply without signing in again */
export function noteAccessVersion(v) {
  if (v === null || v === undefined || v === '') return;
  const n = Number(v); const cur = Number.isFinite(n) ? n : v;
  if (lastVersion === null) { lastVersion = cur; return; }
  if (cur !== lastVersion) { lastVersion = cur; refreshMe(); }
}
/** the api client reports a 401 of a request that carried this token */
export function noteUnauthenticated(tokenUsed) { if (tokenUsed && tokenUsed === state.token) signOut('unauthenticated'); }

// first load of the module: pick up a stored session (re-validated by the provider via refreshMe)
state = loadStoredSession();
