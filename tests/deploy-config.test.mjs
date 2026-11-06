// Hosting configuration guard (Vercel): EVERY /api/** path — single AND multi-segment (/api/auth/login, /api/admin/users, /api/plans/references …) — must reach the one serverless function.
// A catch-all FILE (`api/[...path].js`) matched only ONE segment on Vercel, so sign-in and every nested route returned Vercel's own 404 in production. The fix is `api/index.js` + the `/api/:path*` rewrite
// in vercel.json (before the SPA fallback). The handler routes by the ORIGINAL request URL; this test proves it for single- and multi-segment paths, in the pre-parsed-body shape Vercel uses.
process.env.IIM_IDENTITY_FILE = ':memory:'; process.env.IIM_PLANS_FILE = ':memory:';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { handleApi } = await import('../server/api.js');

let n = 0; const ok = async (name, fn) => { try { await fn(); n += 1; } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } };
const call = (method, url, body, headers = {}) => new Promise((resolve) => {
  const req = { method, url, headers: { host: 'example.vercel.app', ...headers }, body, socket: {}, on() { return this; } };
  const res = { statusCode: 0, writeHead(c) { this.statusCode = c; }, setHeader() {}, getHeader() {}, end(b) { let j = null; try { j = JSON.parse(String(b || '')); } catch { /* not JSON */ } resolve({ status: this.statusCode, json: j }); } };
  handleApi(req, res).catch((e) => resolve({ threw: String(e && e.message) }));
});

await ok('vercel.json sends every /api/** path to the function before the SPA fallback, and the entry is api/index.js (no single-segment catch-all file)', () => {
  const cfg = JSON.parse(fs.readFileSync('vercel.json', 'utf8')); const rw = cfg.rewrites || [];
  const iApi = rw.findIndex((r) => r.source === '/api/:path*' && r.destination === '/api'); const iSpa = rw.findIndex((r) => r.destination === '/index.html');
  assert.ok(iApi >= 0, 'the /api/:path* → /api rewrite exists'); assert.ok(iSpa > iApi, 'the SPA fallback comes after it');
  assert.ok(/\(\?!api\//.test(rw[iSpa].source), 'the SPA fallback never swallows /api/');
  assert.ok(fs.existsSync('api/index.js') && fs.existsSync('api/_handler.mjs'), 'the function entry and the bundled handler exist');
  assert.ok(!fs.existsSync('api/[...path].js'), 'the single-segment catch-all file is gone');
  const entry = fs.readFileSync('api/index.js', 'utf8'); assert.ok(/from '\.\/_handler\.mjs'/.test(entry) && /handleApi\(req, res\)/.test(entry), 'the entry delegates to the bundled handler');
});

await ok('the handler answers single- AND multi-segment /api paths by their original URL (sign-in works; unauthenticated nested routes are the app’s own 401, never a platform 404)', async () => {
  const health = await call('GET', '/api/health'); assert.equal(health.status, 401); assert.equal(health.json?.error, 'unauthenticated');
  const refs = await call('GET', '/api/plans/references'); assert.equal(refs.status, 401, 'a two-segment route reaches the app'); assert.equal(refs.json?.error, 'unauthenticated');
  const admin = await call('GET', '/api/admin/users'); assert.equal(admin.status, 401); assert.equal(admin.json?.error, 'unauthenticated');
  const bad = await call('POST', '/api/auth/login', { username: 'nobody', password: 'wrong-password' }); assert.equal(bad.status, 401); assert.equal(bad.json?.error, 'invalid_credentials');
  const good = await call('POST', '/api/auth/login', { username: 'demo', password: 'demo123' }); assert.equal(good.status, 200); assert.ok(good.json?.token && good.json?.me?.username === 'demo');
  const me = await call('GET', '/api/auth/me', undefined, { authorization: `Bearer ${good.json.token}` }); assert.equal(me.status, 200); assert.equal(me.json?.me?.username, 'demo');
});

console.log(`deploy config: ${n} test groups passed`);
