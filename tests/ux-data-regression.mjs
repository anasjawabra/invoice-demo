import assert from 'node:assert/strict';
import { parseTargetNumber, targetError, saveTargetStore } from '../src/data/planTargets.js';
import { loadStore } from '../server/store.js';
import { worklist, anomalies, risk } from '../server/lists.js';
import { TopK } from '../server/engine.js';

for (const [input, expected] of [['١٠', 10], ['۱۰٫۵', 10.5], ['1,234.50', 1234.5], ['١٬٢٣٤٫٥', 1234.5], ['-10', -10], ['0', 0]]) assert.equal(parseTargetNumber(input), expected);
for (const input of ['', ' ', '10abc', '1,23', '1e2', '10%', '.', 'Infinity']) assert.ok(Number.isNaN(parseTargetNumber(input)), input);
assert.equal(targetError({ coverage: parseTargetNumber('-10') }), 'coverage');
assert.equal(saveTargetStore({}, { setItem() { throw new Error('quota'); } }), false);

// Equal scores must retain the same prefix for different page sizes.
const best = (k) => { const t = new TopK(k); [1, 1, 1, 2, 3, 2, 4, 1].forEach((v, i) => t.push(i, v)); return t.sorted(); };
assert.deepEqual(best(5).slice(0, 3), best(3));

process.env.DEMO_SIZE = 'compact';
const today = '2026-10-25'; const st = loadStore(today);
const req = { cfg: { cutoff: today }, scope: { from: '2025-01-01', to: today, amanah: 'all', source: 'all' }, includeExcluded: true };
const whole = worklist(st, { ...req, limit: 500 });
const collected = [];
for (let page = 0; page * 17 < whole.total; page += 1) {
  const part = worklist(st, { ...req, limit: 17, page });
  assert.equal(part.total, whole.total); assert.ok(part.rows.length <= 17);
  collected.push(...part.rows.map((r) => r.id));
}
assert.ok(whole.total > 100, 'exercise the former cutoff');
assert.equal(new Set(collected).size, whole.total);
assert.deepEqual(collected, whole.rows.map((r) => r.id));
assert.equal(worklist(st, { ...req, limit: 17, page: 999 }).rows.length, 0);

const codes = ['missing_fields', 'amount_conflict', 'investment_no_contract'];
const riskCats = ['duplicate', 'struck_off_registry', 'deceased_person', 'value_anomaly'];
const combined = { ...req, codes: [...codes, ...riskCats.map((c) => `risk_${c}`)], riskCats };
const all = anomalies(st, { ...combined, limit: 300 });
const ids = [];
for (let page = 0; page * 7 < all.total; page += 1) {
  const part = anomalies(st, { ...combined, limit: 7, page });
  assert.deepEqual(part.counts, all.counts); assert.equal(part.collectedFlagged, all.collectedFlagged);
  ids.push(...part.rows.map((r) => r.id));
}
assert.equal(new Set(ids).size, all.total);
assert.deepEqual(ids, all.rows.map((r) => r.id));
const radar = risk(st, req);
for (const cat of riskCats) assert.equal(all.counts[`risk_${cat}`] || 0, radar.categories[cat].count);
for (const code of combined.codes) {
  const part = anomalies(st, { ...combined, code, limit: 300 });
  assert.equal(part.total, all.counts[code] || 0);
  assert.equal(part.groupTotal, all.total);
}
// Open risk flags must survive combining/deduplicating with data findings.
const openReq = { ...combined, cfg: { cutoff: today, rules: { 'DUP-1': false } } };
const openRadar = risk(st, openReq);
const openFindings = anomalies(st, { ...openReq, limit: 300 });
assert.ok(openRadar.categories.duplicate.count > 0);
assert.equal(openFindings.counts.risk_duplicate, openRadar.categories.duplicate.count);
const duplicates = anomalies(st, { ...openReq, code: 'risk_duplicate', limit: 1 });
assert.equal(duplicates.total, openRadar.categories.duplicate.count);
assert.ok(duplicates.rows[0].tags.includes('risk_duplicate'));
assert.equal(anomalies(st, { ...openReq, code: 'risk_duplicate', limit: 1, page: 1 }).rows.length, Math.min(1, duplicates.total - 1));
console.log('UX data regressions passed: strict input, failed storage, stable ranking, complete worklist and combined findings pagination.');
