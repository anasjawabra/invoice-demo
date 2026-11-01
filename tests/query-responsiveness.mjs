import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { currentStore } from '../server/store.js';
import { list, bumpEpoch } from '../server/lists.js';
import { handleApi } from '../server/api.js';
process.env.APP_MODE = 'demo';
const st = currentStore('2026-10-25', 'full');
const req = { scope: { from: '2000-01-01', to: '2026-10-25' }, cfg: { cutoff: '2026-10-25' }, filters: { allPeriods: true }, sort: { key: 'gross', dir: 'desc' }, pageSize: 50 };
const start = performance.now(); const expected = list(st, req); const baselineMs = performance.now() - start; bumpEpoch();
const server = http.createServer((q, r) => handleApi(q, r)); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const root = `http://127.0.0.1:${server.address().port}/api`;
const headers = { 'Content-Type': 'application/json', 'x-demo-size': 'full', 'x-demo-today': '2026-10-25' };
await (await fetch(`${root}/meta`, { headers })).arrayBuffer();
const delay = monitorEventLoopDelay({ resolution: 10 }); delay.enable();
const report = { rows: st.n, baselineSyncColdMs: baselineMs, queries: [], pings: [] };
try {
  let queryFinished = false;
  const ping = (async () => { while (!queryFinished) { const t = performance.now(); const response = await fetch(`${root}/meta`, { headers }); assert.equal(response.status, 200); await response.arrayBuffer(); report.pings.push(performance.now() - t); await new Promise((resolve) => setTimeout(resolve, 10)); } })();
  try {
    for (const key of ['gross', 'outstanding', 'collected', 'daysOverdue', 'id', 'issue']) {
      const t = performance.now(); const response = await fetch(`${root}/list`, { method: 'POST', headers, body: JSON.stringify({ ...req, sort: { key, dir: 'desc' } }) });
      assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.total, expected.total);
      if (key === 'gross') assert.deepEqual(result.rows, expected.rows);
      report.queries.push({ key, ms: performance.now() - t });
    }
  } finally { queryFinished = true; await ping; }
  report.maxPingMs = Math.max(...report.pings); report.eventLoopMaxMs = delay.max / 1e6; report.eventLoopP99Ms = delay.percentile(99) / 1e6; report.rss = process.memoryUsage().rss;
  assert.ok(report.pings.length > 10); assert.ok(report.maxPingMs < 250, JSON.stringify(report)); assert.ok(report.eventLoopMaxMs < 250);
  report.passed = true;
} finally {
  delay.disable(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  await mkdir('.audit-artifacts/2026-10-25-query-streaming', { recursive: true }); await writeFile('.audit-artifacts/2026-10-25-query-streaming/responsiveness.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, baselineSyncColdMs: baselineMs, maxPingMs: report.maxPingMs, eventLoopMaxMs: report.eventLoopMaxMs }));
