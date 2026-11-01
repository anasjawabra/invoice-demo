import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { ENTITIES } from '../src/data/catalog.js';
import { idOf } from '../server/engine.js';
import { canAccessEntity, canAccessInvoice } from '../server/access.js';
import { contractCard } from '../server/contracts.js';
import { resolveReferences, sameDebtorInvoices } from '../server/orderMatch.js';
import { demoSession, safeReturnPath } from '../src/data/demoSession.js';

const st = loadStore('2026-10-25', { size: 'compact' });
const scope = { from: '2000-01-01', to: '2026-10-25', org: { amanahKeys: ['Riyadh Amanah'] } };
const req = { scope, cfg: { cutoff: '2026-10-25' } };
let inside = -1, outside = -1;
for (let i = 0; i < st.n; i++) { if (ENTITIES[st.ent[i]].en === 'Riyadh Amanah') inside = i; else outside = i; }
assert.ok(inside >= 0 && outside >= 0);
assert.equal(canAccessInvoice(st, req, inside), true); assert.equal(canAccessInvoice(st, req, outside), false);
assert.equal(canAccessInvoice(st, { scope: {} }, outside), true);
assert.equal(canAccessEntity({ scope: { org: { amanahKeys: [] } } }, 'Riyadh Amanah'), false);
const originalOwner = st.owner[inside]; st.owner[inside] = 123;
assert.equal(canAccessInvoice(st, req, inside), false); assert.equal(canAccessInvoice(st, { ...req, owner: 123 }, inside), true); st.owner[inside] = originalOwner;
const resolved = resolveReferences(st, { ...req, refs: [inside, outside].map((i) => ({ kind: 'invoice_id_exact', value: idOf(st, i) })) });
assert.equal(resolved.results[0].status, 'matched'); assert.equal(resolved.results[1].status, 'unmatched'); assert.deepEqual(resolved.results[1].candidates, []);
for (const ct of st.contracts.filter(Boolean)) {
  const allowed = ENTITIES[ct.ent].en === 'Riyadh Amanah';
  assert.equal(!!contractCard(st, req, ct.contractNo), allowed);
  const result = resolveReferences(st, { ...req, refs: [{ kind: 'contract_no', value: ct.contractNo }] }).results[0];
  assert.equal(result.status, allowed ? 'contract_found' : 'contract_not_found');
  if (!allowed) assert.equal(result.contract, null);
}
for (const debtor of new Set(Array.from(st.payer.slice(0, st.nGen)))) {
  const rows = sameDebtorInvoices(st, { ...req, debtor }).invoices;
  assert.ok(rows.every((r) => r.amanahEn === 'Riyadh Amanah'));
}
const auditor = demoSession({ user: 'auditor', pass: 'old', canReview: true, org: { id: 'riyadh', amanahKeys: null } });
assert.equal(auditor.canReview, false); assert.ok(!('pass' in auditor)); assert.deepEqual(auditor.org.amanahKeys, ['Riyadh Amanah']);
for (const value of [null, {}, [], { user: 'unknown' }, { user: 'demo', org: { id: 'unknown' } }]) assert.equal(demoSession(value), null);
assert.equal(demoSession({ user: 'demo', org: { id: 'riyadh' } }).canReview, true);
assert.equal(safeReturnPath({ pathname: '/invoices/abc', search: '?view=all', hash: '#evidence' }), '/invoices/abc?view=all#evidence');
for (const pathname of ['//example.com', '/\\example.com', 'https://example.com', '/login', '/bad\npath']) assert.equal(safeReturnPath({ pathname }), '/insights');
console.log('Access data passed: invoice/entity/owner boundaries, all contract details and references, debtor lookups, canonical demo roles, password omission and internal return paths.');
