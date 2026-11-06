// «إجمالي المحصل من أوامر التنفيذ»: payments (collection records) attributable to enforcement on invoices with a CONFIRMED order link. Run with `npm run test:collections`.
// The payment records are the demo ledger's plus the labelled SYNTHETIC set of server/enforcementCollections.js.
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { enforcementCollections, syntheticTahseelPayments } from '../server/enforcementCollections.js';
import { normalizeConfig } from '../src/data/revenueMetrics.js';
import { buildIndex } from '../src/data/relations.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { console.error(`FAIL  ${name}`); throw e; } n += 1; };
const TODAY = '2026-10-20'; const st = loadStore(TODAY); const cfg = normalizeConfig({ cutoff: TODAY });
const A = '171-407930123150'; const B = '171-407950123141'; const C = '171-408030123105'; const F = '171-407890123168';
const run = (ids, o = {}, store = st) => enforcementCollections(store, { ids, scope: { amanah: 'all', source: 'all' }, cfg, ...o });
const synth = syntheticTahseelPayments(st, 20746);

ok('the total is the sum of the enforcement-channel payment records of the confirmed-linked invoices; partial payments are separate records', () => {
  const r = run([A, B, C]); const want = synth.filter((p) => [A, B, C].includes(p.invoiceId)).reduce((t, p) => t + p.amount, 0);
  assert.equal(r.available, true); assert.equal(r.total, want); assert.equal(r.total, 3000000 + 2500000 + 9524400 + 12000000);
  assert.equal(r.rows.filter((x) => x.invoiceId === A).length, 2, 'two partial payments on A'); assert.equal(r.count, 4); assert.equal(r.invoices, 3);
  assert.ok(r.rows.filter((x) => x.invoiceId === A).reduce((t, x) => t + x.amount, 0) < 9478590, 'collected through enforcement is not the invoice value');
  for (const row of r.rows) assert.ok(row.paymentId && row.date && row.amount > 0 && row.source, 'each payment carries its record id, date, amount and source');
});
ok('only invoices with a CONFIRMED link count: an invoice absent from the list contributes nothing', () => { assert.equal(run([A]).total, 5500000); assert.equal(run([]).total, 0); assert.equal(run([]).count, 0); });
ok('each payment is counted ONCE: a repeated invoice (linked to several orders) or a repeated request does not repeat its payments', () => {
  const once = run([A, B]); const dup = run([A, A, B, B, A]); assert.equal(dup.total, once.total); assert.equal(dup.count, once.count); assert.equal(new Set(dup.rows.map((r) => r.paymentId)).size, dup.rows.length);
  const mk = (num) => ({ enforceNum: num, requestStatus: 'قيد التنفيذ', links: [{ invoiceId: A, status: 'confirmed', origin: 'manual_selection' }, { invoiceId: B, status: 'confirmed', origin: 'manual_selection' }] }); const index = buildIndex([mk('O1'), mk('O2')]);
  const ids = [...index.entries()].filter(([, e]) => e.referredEver).map(([id]) => id); assert.equal(index.get(A).confirmed.length, 2); assert.equal(run(ids).total, once.total, 'two orders on the same invoices: the total does not double');
});
ok('collection is never inferred from order status, exclusion or the order amount: the service reads none of them (only payment records)', () => {
  const a = run([A, B, C]); const b = run([A, B, C], { links: { [A]: 'closed' }, linkInfo: {}, decisions: { x: 1 } }); assert.deepEqual(b.rows, a.rows); assert.equal(b.total, a.total);
  const noPay = run(['171-407990123123']); assert.equal(noPay.available, true); assert.equal(noPay.total, 0); assert.equal(noPay.count, 0); assert.equal(noPay.linkedInvoices, 1, 'a linked invoice without payments contributes no amount');
});
ok('payments on a linked invoice that do not show collection through enforcement are NOT counted and are reported apart', () => {
  const r = run([F]); assert.ok(r.notCounted.count >= 1 && r.notCounted.amount > 0, 'the ledger payments of F (another channel) are listed apart'); assert.ok(r.notCounted.items.every((x) => x.why === 'other_channel'));
  assert.equal(r.total, 4000000, 'only the enforcement-channel receipt counts');
});
ok('filters: the period is the PAYMENT date (inclusive), the Amanah scope filters the invoice', () => {
  const all = run([A, B, C]); const oct = run([A, B, C], { from: '2026-10-01' }); assert.deepEqual(oct.rows.map((r) => r.date), all.rows.filter((r) => r.date >= '2026-10-01').map((r) => r.date)); assert.ok(oct.total < all.total && oct.total > 0);
  const sep = run([A, B, C], { to: '2026-09-30' }); assert.equal(sep.total + oct.total, all.total, 'the two periods partition the payments');
  assert.equal(run([A, B, C], { scope: { amanah: 'Riyadh Amanah', source: 'all' } }).total, 0, 'another Amanah: the invoices are out of scope'); assert.equal(run([A, B, C], { scope: { amanah: 'Housing Sector', source: 'all' } }).total, all.total);
  assert.equal(run([A, B, C], { from: '2027-01-01' }).total, 0); assert.ok(run([A, B, C]).rows.every((r) => r.date <= TODAY), 'nothing after the cut-off');
});
ok('«غير متوفر من المصدر»: payments exist but none carries attribution evidence → no amount, neither assumed nor zero', () => {
  const blind = { ...st, pCh: new Uint8Array(st.pCh.length).fill(99) }; const r = run([F], { synthetic: false }, blind);
  assert.equal(r.available, false); assert.equal(r.total, null); assert.equal(r.reason, 'no_attribution_evidence'); assert.equal(r.notCounted.count >= 1, true);
  const real = run([F], { synthetic: false }); assert.equal(real.available, true);
});
ok('the synthetic payments are labelled and kept out of the ledger: they carry a source tag and no dashboard total changes', () => {
  assert.ok(synth.length > 0 && synth.every((p) => p.source === 'synthetic' && p.id.startsWith('SYN-TAH-') && p.channel === 'enforcement')); assert.equal(new Set(synth.map((p) => p.id)).size, synth.length);
  const before = st.pAmt.length; run([A, B, C]); assert.equal(st.pAmt.length, before, 'the ledger is untouched'); assert.equal(run([A], { synthetic: false }).rows.filter((r) => r.source === 'synthetic').length, 0);
});
console.log(`enforcement collections: ${n} test groups passed`);
