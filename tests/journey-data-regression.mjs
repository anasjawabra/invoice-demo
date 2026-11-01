import assert from 'node:assert/strict';
import { buildBackup, validateBackup, applyBackup } from '../src/data/localBackup.js';
const mem = () => {
  const values = new Map();
  return { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: (k) => values.delete(k), values };
};
const source = mem();
const targets = { v: 1, years: { 2026: { Riyadh: { coverage: 0, collectionRate: 0.6, weights: Array(12).fill(1 / 12) } } } };
source.setItem('ib_plan_targets_v1', JSON.stringify(targets));
source.setItem('ib_actions_v1', JSON.stringify({ actions: [{ id: 'new-action' }] }));
const backup = buildBackup(source);
assert.deepEqual(backup.data.ib_plan_targets_v1, targets);
const destination = mem();
assert.equal(applyBackup(backup, destination).ok, true);
assert.deepEqual(JSON.parse(destination.getItem('ib_plan_targets_v1')), targets);
const legacy = buildBackup(mem());
assert.equal(applyBackup(legacy, destination).ok, true);
assert.deepEqual(JSON.parse(destination.getItem('ib_plan_targets_v1')), targets, 'legacy backup preserves current targets');
for (const data of [undefined, [], {}, { ...backup.data, ib_plan_targets_v1: { v: 1, years: [] } }, { ...backup.data, ib_plan_targets_v1: { v: 1, years: { 2026: { Riyadh: { coverage: -1 } } } } }]) {
  assert.equal(validateBackup({ ...backup, data }).ok, false);
}
const previous = mem();
previous.setItem('ib_plans_v1', JSON.stringify({ plans: [{ id: 'keep-plan' }], objectives: [] }));
previous.setItem('ib_actions_v1', JSON.stringify({ actions: [{ id: 'keep-action' }] }));
const before = new Map(previous.values);
const set = previous.setItem;
previous.setItem = (k, v) => { if (k === 'ib_actions_v1' && v.includes('new-action')) throw new Error('Quota'); set(k, v); };
assert.deepEqual(applyBackup(backup, previous), { ok: false, error: 'storage_failed' });
assert.deepEqual(previous.values, before, 'failed restore rolls back earlier writes');
const broken = mem(); broken.setItem('ib_actions_v1', '{broken');
assert.throws(() => buildBackup(broken), 'corrupt local data must not be exported as an empty record');
const blocked = mem(); blocked.getItem = () => { throw new Error('Denied'); };
assert.equal(applyBackup(backup, blocked).error, 'storage_failed');
const partial = mem(); partial.setItem('ib_plans_v1', JSON.stringify({ plans: [{ id: 'keep' }], objectives: [] }));
const partialSet = partial.setItem;
partial.setItem = (k, v) => { if (k === 'ib_actions_v1' || k === 'ib_plans_v1') throw new Error('Persistent storage failure'); partialSet(k, v); };
assert.equal(applyBackup(backup, partial).error, 'rollback_failed', 'a rollback failure must never be reported as preserved data');
console.log('Journey data: target round-trip, legacy compatibility, validation, rollback, corrupt export and storage denial passed');
