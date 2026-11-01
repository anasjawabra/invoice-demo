import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { currentStore } from '../server/store.js';
import { handleApi } from '../server/api.js';

process.env.APP_MODE = 'demo'; process.env.DEMO_SIZE = 'full';
const output = process.env.PERF_OUTPUT || '.audit-artifacts/2026-10-25-hardening'; await mkdir(output, { recursive: true });
const started = performance.now(); const store = currentStore('2026-10-25', 'full');
const report = { generatedRows: store.n, generationMs: performance.now() - started, rssAfterGeneration: process.memoryUsage().rss, runs: [] };
const server = http.createServer((req, res) => handleApi(req, res)); server.listen(0, '127.0.0.1'); await once(server, 'listening');
const root = `http://127.0.0.1:${server.address().port}/api`;
const query = { scope: { from: '2000-01-01', to: '2026-10-25' }, cfg: { cutoff: '2026-10-25' }, filters: { allPeriods: true }, sort: { key: 'issue', dir: 'desc' }, pageSize: 50 };
const headers = { 'content-type': 'application/json', 'x-demo-today': '2026-10-25', 'x-demo-size': 'full' };
const post = (route, body = query) => fetch(`${root}${route}`, { method: 'POST', headers, body: JSON.stringify(body) });
const delay = monitorEventLoopDelay({ resolution: 20 }); delay.enable(); let peakRss = report.rssAfterGeneration;
const sampler = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 50);
try {
  let t = performance.now(); const baseline = await (await post('/list')).json();
  assert.ok(baseline.total > 1000000); assert.equal(baseline.rows.length, 50);
  report.listColdMs = performance.now() - t; report.visibleRows = baseline.total;
  t = performance.now(); const response = await post('/export.csv'); assert.equal(response.status, 200);
  let bytes = 0, lines = 0; const decoder = new TextDecoder();
  for await (const part of response.body) { bytes += part.byteLength; lines += (decoder.decode(part, { stream: true }).match(/\n/g) || []).length; }
  lines += (decoder.decode().match(/\n/g) || []).length;
  assert.equal(lines - 2, baseline.total); report.fullExport = { bytes, rows: lines - 2, ms: performance.now() - t };
  console.log(JSON.stringify({ fullExport: report.fullExport }));
  const a = await post('/export.csv'); const b = await post('/export.csv');
  const busy = await post('/export.csv'); assert.equal(busy.status, 429); await busy.arrayBuffer();
  await a.body.cancel(); await b.body.cancel();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const resumed = await post('/export.csv'); assert.equal(resumed.status, 200); await resumed.body.cancel(); report.concurrentLimitAndCancel = true;
  const sustainedStart = performance.now();
  const duration = Number(process.env.PERF_DURATION_MS || 180000);
  for (let round = 0; performance.now() - sustainedStart < duration; round++) {
    const latencies = await Promise.all(Array.from({ length: 4 }, async (_, i) => {
      const begin = performance.now(); const result = await post('/list', { ...query, page: (round + i) % 10, sort: { key: i % 2 ? 'gross' : 'issue', dir: 'desc' } });
      assert.equal(result.status, 200); const body = await result.json(); assert.equal(body.rows.length, 50); return performance.now() - begin;
    }));
    report.runs.push({ round, maxMs: Math.max(...latencies), rss: process.memoryUsage().rss });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  for (const [body, status] of [[null, 400], [[], 400], [{ records: new Array(5001).fill({}) }, 413]]) { const r = await post('/upload', body); assert.equal(r.status, status); await r.arrayBuffer(); }
  report.sustainedRequests = report.runs.length * 4; report.sustainedMs = performance.now() - sustainedStart; report.peakRss = peakRss; report.eventLoopP99Ms = delay.percentile(99) / 1e6; report.eventLoopMaxMs = delay.max / 1e6;
  globalThis.gc?.(); report.rssAfterGc = process.memoryUsage().rss;
  // Local regression budgets, not target-environment SLAs.
  assert.ok(report.fullExport.ms < 180000); assert.ok(peakRss < 2 * 1024 ** 3);
  assert.ok(Math.max(...report.runs.map((r) => r.maxMs)) < 10000);
  report.passed = true;
} finally {
  clearInterval(sampler); delay.disable(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  report.totalMs = performance.now() - started;
  await writeFile(`${output}/performance.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, rows: report.visibleRows, peakRss: report.peakRss, totalMs: report.totalMs }));
