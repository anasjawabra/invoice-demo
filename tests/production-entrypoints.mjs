import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
const results = [];
for (const entry of ['index.js', 'static-server.mjs']) {
  const reservation = http.createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise((resolve) => reservation.close(resolve));
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'production', HOST: '127.0.0.1' }; delete env.APP_MODE;
  const child = spawn(process.execPath, [entry], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = ''; child.stdout.on('data', (part) => { output += part; }); child.stderr.on('data', (part) => { output += part; });
  try {
    let ready = false;
    for (let n = 0; n < 50; n++) {
      try { const r = await fetch(`http://127.0.0.1:${port}/api/meta`); assert.equal(r.status, 503); assert.equal((await r.json()).error, 'production_backend_not_configured'); ready = true; break; }
      catch (error) { if (error instanceof assert.AssertionError) throw error; await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    assert.ok(ready, output);
    for (const path of ['/api/list', '/api/export.csv?size=full&session=demo']) {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-session': 'forged', authorization: 'Bearer forged' }, body: JSON.stringify({ scope: {}, records: [] }) });
      assert.equal(r.status, 503); assert.equal((await r.json()).error, 'production_backend_not_configured');
    }
    if (entry === 'index.js') assert.match(output, /mode=production/);
    results.push({ entry, denied: true });
  } finally { child.kill(); await once(child, 'exit'); }
}
await mkdir('.audit-artifacts/2026-10-25-hardening', { recursive: true });
await writeFile('.audit-artifacts/2026-10-25-hardening/production-entrypoints.json', JSON.stringify(results, null, 2));
console.log('Built server and static fallback reject demo APIs under default NODE_ENV=production.');
