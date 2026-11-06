// The saved non-collection analyses: round trip, versions that never overwrite, per-user isolation, permission scope, size limits, damaged records. Synthetic data only.
import assert from 'node:assert/strict';
import { createAnalysisStore, KEYS, LIMITS, pruneAnalysis, userKeyOf } from '../src/data/analysisStore.js';

let passed = 0; const test = (name, fn) => { try { fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } };

// an in-memory localStorage with an optional capacity (characters), like a browser quota
function memStorage(cap = Infinity) {
  const m = new Map();
  const used = () => [...m.entries()].reduce((t, [k, v]) => t + k.length + v.length, 0);
  return {
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => { m.delete(k); },
    setItem(k, v) { const prev = m.get(k); const next = used() - (prev != null ? k.length + prev.length : 0) + k.length + String(v).length; if (next > cap) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } m.set(k, String(v)); },
    _m: m
  };
}
const fakeAnalysis = (net, extra = {}) => ({ version: 1, kind: 'noncollection', generatedAt: '2026-11-05T10:00:00.000Z', cutoff: '2026-11-05', scope: { from: '2026-01-01', to: '2026-11-05', amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', org: null }, populations: { netUnpaid: { count: 3, amount: net } }, unmatched: { count: 4, amount: 100, includedInTotals: false, rows: Array.from({ length: 4 }, (_, i) => ({ invoiceNo: `0000${i}`, invoiceValue: 25, lines: 1, hint: 'x' })) }, ...extra });
const inputOf = (net, taskId, more = {}) => ({ analysis: fakeAnalysis(net), taskScope: { from: '2026-01-01', to: '2026-11-05', amanah: 'all', source: 'all' }, sourceTaskId: taskId, dataVersion: 'dv1', ...more });
const U1 = userKeyOf({ user: 'demo' }); const U2 = userKeyOf({ user: 'auditor' });
let seq = 0; const idGen = () => `nc-test${++seq}`;
const fresh = (cap, limits) => { seq = 0; const storage = memStorage(cap); return { storage, store: createAnalysisStore({ storage, idGen, limits: { ...LIMITS, ...(limits || {}) } }) }; };

test('round trip: what is saved is exactly what is loaded (no recalculation), with its generation time, cutoff and task id', () => {
  const { store } = fresh();
  const r = store.create(U1, inputOf(1000, 'task-1')); assert.ok(r.ok && r.n === 1 && r.id === 'nc-test1');
  const l = store.load(U1, r.id); assert.ok(l.ok);
  assert.deepEqual(l.record.versions[0].analysis, fakeAnalysis(1000)); assert.equal(l.record.versions[0].generatedAt, '2026-11-05T10:00:00.000Z'); assert.equal(l.record.versions[0].cutoff, '2026-11-05');
  assert.equal(l.record.versions[0].sourceTaskId, 'task-1'); assert.equal(l.record.versions[0].taskScope.amanah, 'all');
  assert.equal(store.list(U1).length, 1); assert.equal(store.list(U1)[0].versions[0].n, 1);
});

test('the in-session task id maps to the stored analysis, and saving the same task twice is idempotent', () => {
  const { store } = fresh();
  const a = store.create(U1, inputOf(1000, 'task-7')); const b = store.create(U1, inputOf(1000, 'task-7'));
  assert.equal(b.id, a.id); assert.ok(b.duplicate); assert.equal(store.list(U1).length, 1);
  assert.deepEqual(store.findByTask(U1, 'task-7'), { id: a.id, n: 1 }); assert.equal(store.findByTask(U1, 'task-8'), null); assert.equal(store.findByTask(U2, 'task-7'), null);
});

test('versions append, never overwrite: v1 stays exactly as saved and each version loads on its own', () => {
  const { store } = fresh();
  const { id } = store.create(U1, inputOf(1000, 'task-1'));
  const v2 = store.addVersion(U1, id, inputOf(2000, 'task-2')); assert.ok(v2.ok && v2.n === 2);
  const v3 = store.addVersion(U1, id, inputOf(3000, 'task-3')); assert.equal(v3.n, 3);
  assert.equal(store.addVersion(U1, id, inputOf(3000, 'task-3')).duplicate, true, 'the same task never adds a second version');
  const l = store.load(U1, id); assert.deepEqual(l.record.versions.map((v) => v.n), [1, 2, 3]);
  assert.deepEqual(l.record.versions.map((v) => v.analysis.populations.netUnpaid.amount), [1000, 2000, 3000]);
  assert.deepEqual(store.list(U1)[0].versions.map((v) => v.n), [1, 2, 3]);
  assert.equal(store.list(U1).length, 1, 'a version is not a new analysis');
});

test('user isolation: another person sees neither the list entry, the record nor the task mapping', () => {
  const { store, storage } = fresh();
  const { id } = store.create(U1, inputOf(1000, 'task-1'));
  assert.deepEqual(store.list(U2), []); assert.equal(store.load(U2, id).error, 'not_found');
  assert.equal(store.addVersion(U2, id, inputOf(1, 'task-9')).error, 'not_found'); assert.equal(store.remove(U2, id), true);
  assert.ok(store.load(U1, id).ok, 'another user deleting the id removes nothing of this user’s');
  // a record copied under another user's key is refused (owner check)
  storage.setItem(`${KEYS.rec}:${U2}:${id}`, storage.getItem(`${KEYS.rec}:${U1}:${id}`));
  storage.setItem(`${KEYS.index}:${U2}`, storage.getItem(`${KEYS.index}:${U1}`));
  assert.equal(store.load(U2, id).error, 'not_found');
  assert.deepEqual(store.list(null), []); assert.equal(store.create(null, inputOf(1, 't')).error, 'unavailable');
});

test('permission scope: an analysis of Amanahs outside the signed-in organisation is not listed and does not open', () => {
  const { store } = fresh();
  const central = store.create(U1, inputOf(1000, 'task-1'), { org: null }).id; // a central view: all Amanahs
  const riyadh = store.create(U1, { ...inputOf(500, 'task-2'), analysis: fakeAnalysis(500, { scope: { from: '2026-01-01', to: '2026-11-05', amanah: 'Riyadh Amanah', source: 'all', org: null } }) }, { org: null }).id;
  const orgRiyadh = { id: 'org-riyadh', amanahKeys: ['Riyadh Amanah'] }; const orgJeddah = { id: 'org-jeddah', amanahKeys: ['Jeddah Amanah'] };
  assert.deepEqual(store.list(U1, null).map((x) => x.id).sort(), [central, riyadh].sort());
  assert.deepEqual(store.list(U1, orgRiyadh).map((x) => x.id), [riyadh], 'a Riyadh-only organisation does not see the all-Amanah analysis');
  assert.equal(store.load(U1, central, orgRiyadh).error, 'forbidden'); assert.ok(store.load(U1, riyadh, orgRiyadh).ok);
  assert.deepEqual(store.list(U1, orgJeddah), []); assert.equal(store.load(U1, riyadh, orgJeddah).error, 'forbidden');
  assert.equal(store.addVersion(U1, riyadh, inputOf(1, 'task-3'), { org: orgJeddah }).error, 'forbidden');
  // an organisation-scoped run (amanah «all» + org keys) is stored with the organisation's Amanahs as its coverage
  const own = store.create(U1, { ...inputOf(10, 'task-4') }, { org: orgRiyadh }).id; assert.deepEqual(store.list(U1, orgRiyadh).find((x) => x.id === own).coverage, { all: false, keys: ['Riyadh Amanah'] });
});

test('delete removes the record, the list entry and the task mapping', () => {
  const { store, storage } = fresh();
  const { id } = store.create(U1, inputOf(1000, 'task-1')); store.addVersion(U1, id, inputOf(2000, 'task-2'));
  assert.equal(store.remove(U1, id), true); assert.equal(store.load(U1, id).error, 'not_found'); assert.deepEqual(store.list(U1), []); assert.equal(store.findByTask(U1, 'task-2'), null);
  assert.equal(storage.getItem(`${KEYS.rec}:${U1}:${id}`), null);
});

test('size fallback: an older version first gives up its report-only rows (flagged); the new version is kept whole; nothing is removed', () => {
  const big = (net) => ({ ...fakeAnalysis(net), pad: 'x'.repeat(2000), unmatched: { count: 40, amount: 1, includedInTotals: false, rows: Array.from({ length: 40 }, (_, i) => ({ invoiceNo: `r${i}`, invoiceValue: 1, lines: 1, hint: 'y'.repeat(80) })) } });
  const { store } = fresh(undefined, { recordChars: 14000 });
  const { id } = store.create(U1, { ...inputOf(1, 't1'), analysis: big(1) });
  const r2 = store.addVersion(U1, id, { ...inputOf(2, 't2'), analysis: big(2) });
  assert.ok(r2.ok, JSON.stringify(r2)); assert.deepEqual(r2.pruned, [1], 'the OLDER version was reduced');
  const l = store.load(U1, id).record;
  assert.deepEqual(l.versions.map((v) => v.n), [1, 2]); assert.equal(l.versions[0].prune.unmatchedRows, true); assert.equal(l.versions[0].analysis.unmatched.rows.length, 0); assert.equal(l.versions[0].analysis.unmatched.rowsPruned, 40);
  assert.equal(l.versions[0].analysis.populations.netUnpaid.amount, 1, 'the figures of the reduced version are untouched'); assert.equal(l.versions[1].analysis.unmatched.rows.length, 40, 'the newest version is whole');
  assert.equal(store.list(U1)[0].versions[0].pruned, true);
  assert.equal(pruneAnalysis(pruneAnalysis(big(1))).unmatched.rowsPruned, 40, 'pruning twice changes nothing');
});

test('a version that cannot fit at all, or that the browser refuses, is refused with a reason and leaves everything as it was', () => {
  const huge = { ...fakeAnalysis(9), pad: 'z'.repeat(50000) };
  const a = fresh(undefined, { recordChars: 20000 });
  assert.equal(a.store.create(U1, { ...inputOf(9, 't1'), analysis: huge }).error, 'too_large'); assert.deepEqual(a.store.list(U1), []);
  const { store, storage } = fresh(2600);
  const { id } = store.create(U1, inputOf(1, 't1')); assert.ok(id);
  const before = storage.getItem(`${KEYS.rec}:${U1}:${id}`); const beforeIdx = storage.getItem(`${KEYS.index}:${U1}`);
  const r = store.addVersion(U1, id, { ...inputOf(2, 't2'), analysis: { ...fakeAnalysis(2), pad: 'q'.repeat(4000) } });
  assert.equal(r.ok, false); assert.equal(r.error, 'quota');
  assert.equal(storage.getItem(`${KEYS.rec}:${U1}:${id}`), before, 'the saved record is exactly as it was'); assert.equal(storage.getItem(`${KEYS.index}:${U1}`), beforeIdx);
  assert.deepEqual(store.load(U1, id).record.versions.map((v) => v.n), [1]);
});

test('limits are explicit: too many analyses or versions is refused, never replaced', () => {
  const { store } = fresh(undefined, { analyses: 2, versions: 2 });
  const a = store.create(U1, inputOf(1, 't1')); store.create(U1, inputOf(2, 't2'));
  assert.equal(store.create(U1, inputOf(3, 't3')).error, 'analyses_limit'); assert.equal(store.list(U1).length, 2);
  assert.ok(store.addVersion(U1, a.id, inputOf(4, 't4')).ok); assert.equal(store.addVersion(U1, a.id, inputOf(5, 't5')).error, 'versions_limit');
  assert.deepEqual(store.load(U1, a.id).record.versions.map((v) => v.n), [1, 2]);
  // the other user has their own allowance
  assert.ok(store.create(U2, inputOf(6, 't6')).ok);
});

test('a damaged version is reported as unreadable and never shown; an unavailable storage degrades without throwing', () => {
  const { store, storage } = fresh();
  const { id } = store.create(U1, inputOf(1000, 't1')); store.addVersion(U1, id, inputOf(2000, 't2'));
  const raw = JSON.parse(storage.getItem(`${KEYS.rec}:${U1}:${id}`)); raw.versions[0].analysis.populations.netUnpaid.amount = 999999; storage.setItem(`${KEYS.rec}:${U1}:${id}`, JSON.stringify(raw));
  const l = store.load(U1, id); assert.ok(l.ok); assert.deepEqual(l.record.versions.map((v) => v.n), [2]); assert.deepEqual(l.record.unreadable, [1]);
  raw.versions[1].analysis = { x: 1 }; storage.setItem(`${KEYS.rec}:${U1}:${id}`, JSON.stringify(raw)); assert.equal(store.load(U1, id).error, 'unreadable');
  const none = createAnalysisStore({ storage: null });
  assert.deepEqual(none.list(U1), []); assert.equal(none.load(U1, 'x').error, 'unavailable'); assert.equal(none.create(U1, inputOf(1, 't')).error, 'unavailable');
  const throwing = createAnalysisStore({ storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); }, length: 0, key: () => null } });
  assert.deepEqual(throwing.list(U1), []); assert.equal(throwing.create(U1, inputOf(1, 't')).ok, false);
});

console.log(`\n${passed} passed`);
