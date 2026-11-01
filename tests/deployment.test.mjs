// Build the same two runtime artifacts as Docker, then exercise them over HTTP.
// Keep existing dist/ files intact while checking the post-login API requests.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { build as buildFrontend } from 'vite';
import { build as buildServer } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, '.test-build'), { recursive: true });
const runtime = await mkdtemp(path.join(root, '.test-build', 'deployment-'));
await buildFrontend({ root, logLevel: 'warn', build: { outDir: path.join(runtime, 'dist') } });
await buildServer({
  absWorkingDir: root, entryPoints: ['server/standalone.js'], bundle: true,
  platform: 'node', format: 'esm', outfile: path.join(runtime, 'dist-server/server.mjs'), logLevel: 'error'
});

const reservation = http.createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const child = spawn(process.execPath, ['dist-server/server.mjs'], {
  cwd: runtime, env: { ...process.env, PORT: String(port), DEMO_SIZE: 'compact' },
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
});
const exited = once(child, 'exit');
let output = '';
child.stdout.on('data', (part) => { output += part; });
child.stderr.on('data', (part) => { output += part; });
const base = `http://127.0.0.1:${port}`;
const request = (route, options = {}) => fetch(base + route, { ...options, signal: AbortSignal.timeout(5000) });

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (output.includes(`listening on port ${port}`)) { ready = true; break; }
    assert.equal(child.exitCode, null, output);
    await delay(100);
  }
  assert.ok(ready, `Server did not start:\n${output}`);

  const index = await readFile(path.join(runtime, 'dist/index.html'), 'utf8');
  for (const route of ['/login', '/insights', '/dashboard', '/insights?view=dashboard']) {
    const response = await request(route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get('content-type'), /text\/html/, route);
    assert.equal(await response.text(), index, route);
  }
  const asset = index.match(/<script[^>]+src="([^"]+)"/)?.[1];
  assert.ok(asset, 'The built page must reference its JavaScript bundle');
  const assetResponse = await request(asset);
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get('content-type'), /javascript/);
  assert.ok((await assetResponse.text()).length > 0);

  async function json(route, options) {
    const response = await request(route, options);
    assert.equal(response.status, 200, `${route} must reach the API, not return 405`);
    assert.match(response.headers.get('content-type'), /application\/json/, `${route} must not return SPA HTML`);
    return response.json();
  }
  const meta = await json('/api/meta');
  assert.match(meta.today, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(meta.counts.invoicesTotal > 0);
  const cases = await json('/api/sanad-cases');
  assert.ok(Array.isArray(cases.cases));

  for (const scope of [
    { from: meta.period.from, to: meta.period.to },
    { from: meta.period.priorFrom, to: meta.period.priorTo }
  ]) {
    const snapshot = await json('/api/snapshot', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session': 'deployment-smoke' },
      body: JSON.stringify({ scope })
    });
    assert.equal(snapshot.scope.from, scope.from);
    assert.equal(snapshot.scope.to, scope.to);
    assert.equal(snapshot.equation.ok, true);
    assert.ok(snapshot.totals);
  }
  const missing = await request('/api/not-a-route');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'not_found' });
  console.log('Deployment smoke passed: SPA routes, JS asset, GET metadata/cases, POST current/prior snapshots, JSON API 404.');
  console.log(`Isolated build: ${runtime}`);
} finally {
  if (child.exitCode === null) child.kill();
  await exited;
}
