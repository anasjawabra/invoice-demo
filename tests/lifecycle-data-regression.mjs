import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { handleApi } from '../server/api.js';
import { currentStore } from '../server/store.js';
import { makeCtx, derive, idOf, lookupId } from '../server/engine.js';
import { exportChunks } from '../server/lists.js';
import { RULE_IDS } from '../src/data/catalog.js';
import { importRows, parseCsv, SAMPLE_CSV } from '../src/data/ledgerImport.js';
import { loadEnforcement, readEnforcement, saveEnforcement } from '../src/data/enforcementStore.js';
import { loadTargetStore, readTargetStore, saveTargetStore } from '../src/data/planTargets.js';

async function call(path, body, session = 'lifecycle-A', { form = false } = {}) {
  const chunks = []; let status, headers;
  await handleApi({ method: 'POST', url: `/api/${path}`, headers: { 'x-session': session, 'x-demo-today': '2026-10-25', 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' }, body: form ? new URLSearchParams({ q: JSON.stringify(body) }).toString() : body }, Object.assign(new EventEmitter(), {
    writeHead: (s, h) => { status = s; headers = h; }, write: (v) => { chunks.push(String(v)); return true; }, end: (v) => { if (v) chunks.push(String(v)); }
  }));
  const text = chunks.join(''); return { status, headers, text, data: headers['Content-Type'].includes('json') ? JSON.parse(text) : null };
}
const records = importRows(parseCsv(SAMPLE_CSV)).accepted;
assert.ok(records.length);
const first = { ...records[0], id: 'LIFECYCLE-SHARED-1', grossAmount: 111, payments: [] };
const second = { ...first, grossAmount: 222 };
const scope = { from: '2000-01-01', to: '2026-10-25', amanah: 'all', source: 'all' };
assert.equal((await call('upload', { records: [first, first] })).data.added, 1, 'duplicate rows in one request are not appended twice');
assert.equal((await call('upload', { records: [second] }, 'lifecycle-B')).data.added, 1);
for (const [session, amount] of [['lifecycle-A', 111], ['lifecycle-B', 222]]) {
  const detail = await call('invoice', { id: first.id, scope }, session);
  assert.equal(detail.status, 200); assert.equal(detail.data.rec.grossAmount, amount);
  const list = await call('list', { scope, filters: { search: first.id, state: 'all' } }, session);
  assert.equal(list.data.total, 1); assert.equal(list.data.rows[0].gross, amount);
  assert.equal((await call('order-match', { scope, refs: [{ kind: 'invoice_id_exact', value: first.id }] }, session)).data.results[0].status, 'matched');
}
await call('upload/clear', {});
assert.equal((await call('invoice', { id: first.id, scope })).status, 404);
assert.equal((await call('invoice', { id: first.id, scope }, 'lifecycle-B')).data.rec.grossAmount, 222);
assert.equal((await call('upload', { records: [{ ...first, grossAmount: 333 }] })).data.added, 1);
assert.equal((await call('invoice', { id: first.id, scope })).data.rec.grossAmount, 333);
assert.equal((await call('upload', { records: [second] }, 'lifecycle-B')).data.added, 0);

const st = currentStore('2026-10-25'); const ctx = makeCtx(st, { cfg: { cutoff: '2026-10-25' } });
let changedId;
const rejected = { byRule: Object.fromEntries(RULE_IDS.map((id) => [id, { exclusion: { reviewStatus: 'rejected' } }])) };
for (let i = 0; i < st.n; i++) {
  derive(ctx, i, ctx.cutoffN);
  if (st.owner[i] !== 0 || !(ctx.D.exclusionAmount > 0)) continue;
  const candidate = idOf(st, i); const comparison = makeCtx(st, { cfg: { cutoff: '2026-10-25' }, decisions: { [candidate]: rejected } });
  derive(comparison, i, comparison.cutoffN);
  if (comparison.D.exclusionAmount !== ctx.D.exclusionAmount) { changedId = candidate; break; }
}
assert.ok(changedId);
const decisions = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`unknown-${i}`, { note: 'large saved review context' }]));
decisions[changedId] = rejected;
const payload = { scope, cfg: { cutoff: '2026-10-25' }, filters: { state: 'all', search: changedId }, decisions, links: {} };
assert.ok(JSON.stringify(decisions).length > 3000);
const result = await call('export.csv', payload, 'lifecycle-A', { form: true });
assert.equal(result.status, 200); assert.match(result.headers['Content-Disposition'], /attachment/);
assert.equal(result.text, [...exportChunks(st, payload)].join(''), 'streamed POST export preserves all review decisions');
assert.notEqual(result.text, [...exportChunks(st, { ...payload, decisions: {} })].join(''), 'dropping the overlay would change the exported financial values');
assert.equal(lookupId(st, first.id), -1, 'public lookup must not expose a private upload');

assert.equal(saveEnforcement({}, null), false); assert.equal(saveTargetStore({}, null), false);
const denied = { getItem: () => { throw new Error('Denied'); } };
assert.equal(readEnforcement(denied).ok, false); assert.equal(readTargetStore(denied).ok, false);
assert.deepEqual(loadTargetStore(denied), { v: 1, years: {} }); assert.ok(loadEnforcement(denied));
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError'); } });
assert.doesNotThrow(() => loadEnforcement()); assert.doesNotThrow(() => loadTargetStore());
assert.equal(saveEnforcement({}), false); assert.equal(saveTargetStore({}), false); delete globalThis.localStorage;
console.log('Lifecycle data passed: independent same-id uploads, duplicate batches, delete/reimport, exact search and references, complete streamed export overlays, unavailable storage and blocked storage getters.');
