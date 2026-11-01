import assert from 'node:assert/strict';
import { list, listAsync, bumpEpoch, exportChunks, orderedCandidatesAsync } from '../server/lists.js';
import { loadStore } from '../server/store.js';
import { appendRecord } from '../server/fixtures.js';
import { importRows } from '../src/data/ledgerImport.js';
import { saveCsvResponse, MAX_BUFFERED_CSV_BYTES } from '../src/utils/saveCsv.js';

const st = loadStore('2026-10-25', { size: 'compact' });
const base = { scope: { from: '2000-01-01', to: '2026-10-25' }, cfg: { cutoff: '2026-10-25' }, filters: { allPeriods: true }, pageSize: 50 };
let compared = 0;
for (const key of ['issue', 'gross', 'id', 'outstanding', 'collected', 'daysOverdue']) for (const dir of ['asc', 'desc']) for (const filters of [{}, { state: 'open' }, { search: 'no-such-record' }]) {
  const req = { ...base, filters: { ...base.filters, ...filters }, sort: { key, dir }, page: 1 };
  const expected = list(st, req); bumpEpoch();
  assert.deepEqual(await listAsync(st, req), expected, `${key}/${dir}/${JSON.stringify(filters)}`); compared++;
}
const uploaded = importRows([['invoice_id', 'amanah', 'issue_date', 'amount'], ['STREAM-OWNED', 'Riyadh Amanah', '2026-01-01', '1234.56']]).accepted[0];
appendRecord(st, uploaded, { owner: 42, kind: 'upload' }); bumpEpoch();
for (const owner of [0, 42, 43]) for (const keys of [undefined, [], ['Riyadh Amanah']]) {
  const req = { ...base, owner, scope: { ...base.scope, org: { amanahKeys: keys } }, sort: { key: 'id', dir: 'asc' } };
  const expected = list(st, req); bumpEpoch(); assert.deepEqual(await listAsync(st, req), expected); compared++;
  const owned = { ...req, filters: { ...req.filters, search: 'STREAM-OWNED' } };
  const result = await listAsync(st, owned); assert.equal(result.total, owner === 42 && keys?.length !== 0 ? 1 : 0);
}
bumpEpoch(); const cancel = new AbortController(); const cancelled = listAsync(st, base, { signal: cancel.signal }); cancel.abort();
await assert.rejects(cancelled, { name: 'AbortError' });
bumpEpoch(); const changed = listAsync(st, base); bumpEpoch(); assert.deepEqual(await changed, list(st, base));
const hit = await orderedCandidatesAsync(st, base); bumpEpoch(); assert.throws(() => [...exportChunks(st, base, 500, hit)], /dataset_changed/);

const encode = (text) => new TextEncoder().encode(text);
const csvResponse = (parts, options = {}) => new Response(new ReadableStream({
  start(controller) { for (const part of parts) controller.enqueue(typeof part === 'string' ? encode(part) : part); controller.close(); }
}), { headers: { 'Content-Type': 'text/csv', ...options.headers } });
const small = await saveCsvResponse(csvResponse(['\uFEFF# demo\ninvoice_', 'id,amount\n00001,1.23\n']));
assert.match(await small.blob.text(), /00001,1.23/);
await assert.rejects(saveCsvResponse(csvResponse(['invoice_id_', 'unexpected\n'])), /not_csv/);
await assert.rejects(saveCsvResponse(csvResponse(['invoice_id\n', new Uint8Array(MAX_BUFFERED_CSV_BYTES)])), /too_large/);
await assert.rejects(saveCsvResponse(csvResponse([], { headers: { 'Content-Length': MAX_BUFFERED_CSV_BYTES + 1 } })), /too_large/);
let savedBytes = 0, writes = 0, committed = false, aborted = false;
const handle = { createWritable: async () => ({ write: async (part) => { savedBytes += part.byteLength; writes++; }, close: async () => { committed = true; }, abort: async () => { aborted = true; } }) };
const chunk = new Uint8Array(1024 * 1024); chunk.fill(65); let part = 0;
const large = new Response(new ReadableStream({ pull(controller) { if (part++ === 0) controller.enqueue(encode('invoice_id,amount\n')); else if (part <= 257) controller.enqueue(chunk); else controller.close(); } }), { headers: { 'Content-Type': 'text/csv' } });
const streamed = await saveCsvResponse(large, { handle }); assert.equal(streamed.blob, null); assert.equal(streamed.bytes, savedBytes); assert.ok(savedBytes > 256 * 1024 ** 2); assert.ok(committed && !aborted && writes > 256);
committed = false; aborted = false;
const controller = new AbortController(); const stoppingHandle = { createWritable: async () => ({ write: async () => controller.abort(), close: async () => { committed = true; }, abort: async () => { aborted = true; } }) };
await assert.rejects(saveCsvResponse(csvResponse(['invoice_id,amount\n', 'PARTIAL,1\n']), { handle: stoppingHandle, signal: controller.signal }), { name: 'AbortError' });
assert.ok(aborted && !committed);
let step = 0; aborted = false;
const failed = new Response(new ReadableStream({ pull(stream) { if (step++ === 0) stream.enqueue(encode('invoice_id,amount\n')); else stream.error(new Error('connection_lost')); } }), { headers: { 'Content-Type': 'text/csv' } });
await assert.rejects(saveCsvResponse(failed, { handle }), /connection_lost/); assert.ok(aborted && !committed);
console.log(`${compared} cold query comparisons; cancellation/version guards; bounded Blob; 256 MiB direct streaming; failed/cancelled file writes passed.`);
