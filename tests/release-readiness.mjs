import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const origin = new URL(process.env.RELEASE_URL || 'http://127.0.0.1:4188');
const out = process.env.RELEASE_OUTPUT || '.audit-artifacts/2026-10-25-release/production-before.json';
const request = (route, body) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: origin.hostname, port: origin.port, path: route, method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {} }, (res) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') })); });
  req.setTimeout(15000, () => req.destroy(new Error('Probe timed out'))); req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
});
const root = path.resolve('.'); const name = `dist-audit-${randomUUID()}`; const folder = path.resolve(root, name);
if (path.dirname(folder) !== root || !path.basename(folder).startsWith('dist-audit-')) throw new Error('Unsafe sentinel target');
const token = randomUUID(); await fs.mkdir(folder); await fs.writeFile(path.join(folder, 'probe.txt'), token);
let traversal;
try { const response = await request(`/..%2f${name}/probe.txt`); traversal = { status: response.status, leakedSentinel: response.text === token }; }
finally { await fs.unlink(path.join(folder, 'probe.txt')); await fs.rmdir(folder); }
const list = await request('/api/list?size=compact', { scope: { from: '2026-01-01', to: '2026-10-25', amanah: 'all', source: 'all' }, cfg: { cutoff: '2026-10-25' }, filters: { state: 'all' }, pageSize: 1 });
const home = await request('/'); const malformed = await request('/bad%');
const result = { origin: origin.origin, capturedAt: new Date().toISOString(), traversal, malformedPathStatus: malformed.status, anonymousList: { status: list.status, rows: (() => { try { return JSON.parse(list.text).rows?.length ?? 0; } catch { return 0; } })() }, headers: { nosniff: home.headers['x-content-type-options'] || null, frameOptions: home.headers['x-frame-options'] || null, referrerPolicy: home.headers['referrer-policy'] || null }, productionReady: false, reason: 'Demo identities and client-selected scope do not provide server authentication or trusted authorization. A real identity integration is required.' };
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
if (process.env.EXPECT_TRAVERSAL_BLOCKED === '1' && (traversal.leakedSentinel || traversal.status !== 403 || malformed.status !== 400)) process.exitCode = 1;
