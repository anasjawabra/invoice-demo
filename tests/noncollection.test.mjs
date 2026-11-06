// «تحليل أسباب عدم التحصيل» data service — synthetic data only (compact world). Reconciliation identities, drill-down parity, payment/exclusion/process separation.
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { snapshot, derive, makeCtx, idOf } from '../server/engine.js';
import { list } from '../server/lists.js';
import { nonCollectionAnalysis, GROUPS, AGE_KEYS } from '../server/noncollection.js';
import { ENTITIES, SOURCES, F } from '../src/data/catalog.js';

process.env.DEMO_SIZE = 'compact';
let passed = 0; const test = (name, fn) => { try { fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } };
const TODAY = '2026-11-05'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const ALL = { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all' };
const ctx0 = makeCtx(st, { cfg });
const near = (a, b, m = '') => assert.ok(Math.abs(a - b) <= 0.5, `${m} ${a} vs ${b}`);
const run = (scope, extra = {}) => nonCollectionAnalysis(st, { scope, cfg, ...extra });
const lst = (scope, nc, extra = {}) => list(st, { scope, cfg, filters: { nc }, page: 0, pageSize: 1, ...extra });
const amt = (r, pop) => (pop === 'excluded' ? r.sums.exclusionAmount : r.sums.outstanding);
const allOk = (a) => { const bad = a.reconciliation.filter((c) => !c.ok); assert.equal(bad.length, 0, `failed: ${bad.map((c) => `${c.key} ${c.lhs} vs ${c.rhs}`).join('; ')}`); };

const ENT0 = ENTITIES[0].en; const ent0Scope = { ...ALL, amanah: ENT0 };
// a source that has unpaid invoices
const base = run(ALL);
const srcWith = base.bySource[0].key;
const SCOPES = { all: ALL, oneAmanah: ent0Scope, oneSource: { ...ALL, source: srcWith }, short: { from: '2026-09-01', to: TODAY, amanah: 'all', source: 'all' } };

test('the shape: contract fields, labels on process / quality / reasons, every reconciliation check has `ok`, no «collectible» / «recoverable» field anywhere', () => {
  assert.equal(base.version, 1); assert.equal(base.kind, 'noncollection'); assert.equal(base.cutoff, TODAY);
  for (const k of ['populations', 'standingBalance', 'unmatched', 'reconciliation', 'reasons', 'process', 'quality', 'aging', 'byAmanah', 'byMunicipality', 'bySource', 'heat', 'groups', 'notes', 'scope']) assert.ok(base[k] != null, k);
  assert.ok(Array.isArray(base.reconciliation) && base.reconciliation.length > 10 && base.reconciliation.every((c) => typeof c.ok === 'boolean' && c.labelAr && c.labelEn && 'lhs' in c && 'rhs' in c));
  for (const x of [...base.process, ...base.quality, ...base.reasons, ...base.aging]) assert.ok(x.labelAr && x.labelEn, x.key);
  assert.deepEqual(base.aging.map((a) => a.key), AGE_KEYS);
  assert.ok(base.process.every((p) => p.nonAdditive) && base.quality.every((p) => p.nonAdditive));
  const keys = []; const walk = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { keys.push(k); walk(v); } }; walk(base);
  assert.equal(keys.filter((k) => /collectible|recoverable|expected.?recovery|score/i.test(k)).length, 0);
  assert.ok(!/collectible|expected recovery|القابل للتحصيل|التحصيل المتوقع/i.test(JSON.stringify(base.groups.map((g) => [g.titleAr, g.titleEn, g.nextStepAr, g.nextStepEn, g.rationaleAr, g.rationaleEn]))));
  assert.ok(!/[A-Z]{3}-\d/.test(JSON.stringify(base.groups)), 'no internal rule codes in the group texts');
  assert.deepEqual(base.groups.map((g) => g.precedence).sort(), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(base.unmatched.includedInTotals, false);
});

test('every reconciliation identity holds for several scopes (all · one Amanah · one source · a short period)', () => {
  for (const [name, sc] of Object.entries(SCOPES)) { const a = run(sc); allOk(a); assert.ok(a.populations.netUnpaid.count > 0, name); }
});

test('an empty scope: everything zero or null, no division by zero, every identity still holds', () => {
  const a = run({ ...ALL, from: '2001-01-01', to: '2001-01-31' });
  allOk(a); assert.equal(a.populations.netUnpaid.amount, 0); assert.equal(a.populations.issued.count, 0);
  assert.ok(a.groups.every((g) => g.count === 0 && g.amount === 0 && g.maxOverdueDays === 0)); assert.equal(a.heat.rows.length, 0);
  assert.ok(Object.values(a.populations).every((p) => Object.values(p).every((v) => Number.isFinite(v))));
  assert.ok(JSON.stringify(a).indexOf('NaN') < 0 && JSON.stringify(a).indexOf('Infinity') < 0);
});

test('the populations match the engine: net unpaid = snapshot outstanding; excluded unpaid = rule exclusions; partial payments stay collected', () => {
  for (const sc of Object.values(SCOPES)) {
    const a = run(sc); const s = snapshot(st, { scope: sc, cfg }); const p = a.populations;
    near(p.netUnpaid.amount, s.totals.outstanding, 'net'); near(p.excludedUnpaid.amount, s.totals.exclusionsRules, 'excluded'); near(p.unpaidGross.amount, s.totals.outstanding + s.totals.exclusionsRules, 'gross unpaid');
    near(p.overdue.amount, s.totals.overdueOutstanding, 'overdue'); near(p.notYetDue.amount, s.totals.notDueOutstanding, 'not due'); assert.equal(p.dueUnknown.amount, 0, 'the synthetic data has a due date everywhere');
    assert.equal(p.issued.count, s.totals.count); near(p.issued.gross, s.totals.gross);
  }
  const p = base.populations; assert.ok(p.partlyPaid.count > 0 && p.partlyPaid.collected > 0, 'partly paid invoices exist and their collected part is kept apart');
  // a partly paid invoice: collected stays collected, unpaid = billed − received
  let k = -1; for (let i = 0; i < st.nGen && k < 0; i += 1) { if (st.issue[i] > ctx0.cutoffN) continue; const D = derive(ctx0, i, ctx0.cutoffN); if (D.received > 0 && D.outstanding > 0) k = i; }
  const D = derive(ctx0, k, ctx0.cutoffN); near(D.outstanding, D.billed - D.received); assert.ok(D.collected > 0);
  const r = list(st, { scope: ALL, cfg, filters: { nc: { payment: 'partial' } }, page: 0, pageSize: 500, withNc: true });
  assert.equal(r.total, p.partlyPaid.count); near(r.sums.outstanding, p.partlyPaid.amount); near(r.sums.collected, p.partlyPaid.collected);
  assert.ok(r.rows.every((x) => x.nc.payment === 'partial' && x.collected > 0));
});

test('overdue vs not yet due follows the engine days overdue; the due partition adds up', () => {
  const r = list(st, { scope: ALL, cfg, filters: { nc: { due: 'overdue' } }, page: 0, pageSize: 500, withNc: true });
  assert.ok(r.rows.length > 0 && r.rows.every((x) => x.daysOverdue > 0 && x.nc.due === 'overdue'));
  const nd = list(st, { scope: ALL, cfg, filters: { nc: { due: 'not_due' } }, page: 0, pageSize: 500, withNc: true });
  assert.ok(nd.rows.every((x) => x.daysOverdue === 0 && x.nc.due === 'not_due'));
  near(r.sums.outstanding + nd.sums.outstanding, base.populations.netUnpaid.amount);
});

test('a missing due date is counted apart and never overdue (synthetic tweak of the store)', () => {
  let k = -1; for (let i = 0; i < st.nGen && k < 0; i += 1) { if (st.issue[i] > ctx0.cutoffN || st.ent[i] !== 0) continue; const D = derive(ctx0, i, ctx0.cutoffN); if (D.outstanding > 0 && !D.excluded && D.daysOverdue > 0 && !(st.flags[i] & (F.OBJECTION | F.AMT_CONFLICT | F.MISSING_ID)) && st.cstat[i] !== 2 && st.cstat[i] !== 4) k = i; }
  assert.ok(k >= 0); const keep = st.due[k]; const D0 = derive(ctx0, k, ctx0.cutoffN); const out = D0.outstanding;
  st.due[k] = 0;
  try {
    const a = run(ent0Scope); const b0 = run(ent0Scope); allOk(a);
    assert.equal(a.populations.dueUnknown.count, 1); near(a.populations.dueUnknown.amount, out);
    assert.equal(a.aging.find((x) => x.key === 'unavailable').count, 1); assert.equal(a.quality.find((x) => x.key === 'due_unavailable').count, 1);
    assert.equal(a.groups.find((g) => g.key === 'request_missing_info').count >= 1, true); assert.equal(a.groups.find((g) => g.key === 'follow_up_overdue').count + 1, run({ ...ent0Scope }).groups.find((g) => g.key === 'follow_up_overdue').count + 1);
    near(a.populations.netUnpaid.amount, a.populations.overdue.amount + a.populations.notYetDue.amount + a.populations.dueUnknown.amount);
    const l = lst(ent0Scope, { due: 'unknown' }); assert.equal(l.total, 1); near(l.sums.outstanding, out);
    const row = list(st, { scope: ent0Scope, cfg, filters: { nc: { due: 'unknown' } }, page: 0, pageSize: 5, withNc: true }).rows[0]; assert.equal(row.nc.due, 'unknown'); assert.equal(row.nc.group, 'request_missing_info'); assert.ok(row.nc.quality.includes('due_unavailable'));
    assert.equal(a.standingBalance.dueUnknown >= out - 0.5, true, 'the standing balance carves it out of the engine overdue part'); void b0;
  } finally { st.due[k] = keep; }
  allOk(run(ent0Scope)); assert.equal(run(ent0Scope).populations.dueUnknown.count, 0);
});

test('documented vs not documented: only a recorded objection is a documented reason; overdue / partial / data gaps are never reasons', () => {
  const p = base.populations; assert.equal(p.documented.count + p.undocumented.count, p.netUnpaid.count);
  const objs = list(st, { scope: ALL, cfg, filters: { nc: { reason: 'documented' } }, page: 0, pageSize: 500, withNc: true });
  assert.equal(objs.total, p.documented.count); assert.ok(objs.rows.every((x) => x.objectionStatus && x.nc.reason.documented && x.nc.reason.evidenceStatus === 'source_record' && /^objection:/.test(x.nc.reason.key)));
  const und = list(st, { scope: ALL, cfg, filters: { nc: { reason: 'undocumented' } }, page: 0, pageSize: 500, withNc: true });
  assert.ok(und.rows.every((x) => !x.nc.reason.documented && x.nc.reason.key === 'undocumented' && x.nc.reason.evidenceStatus === 'none'));
  assert.ok(und.rows.some((x) => x.nc.due === 'overdue') && und.rows.some((x) => x.nc.payment === 'partial'), 'overdue and partly paid invoices stay «not documented»');
});

test('drill-down parity: for every group, aging bucket, reason, process, quality flag, due / payment position and source the list equals the analysis (count and amount)', () => {
  for (const [name, sc] of Object.entries(SCOPES)) {
    const a = run(sc); const chkb = (nc, count, amount, pop) => { const r = lst(sc, nc); assert.equal(r.total, count, `${name} ${JSON.stringify(nc)} count`); near(amt(r, pop), amount, `${name} ${JSON.stringify(nc)} amount`); };
    for (const g of a.groups) chkb(g.filter.nc, g.count, g.amount);
    for (const g of a.groups) chkb(g.nonAdditiveTags.filter.nc, g.nonAdditiveTags.count, g.nonAdditiveTags.amount);
    for (const b of a.aging) chkb(b.filter.nc, b.count, b.amount);
    for (const r of a.reasons) chkb(r.filter.nc, r.count, r.amount);
    for (const p of a.process) { chkb(p.filter.nc, p.count, p.amount); for (const s of p.sub || []) chkb(s.filter.nc, s.count, s.amount); }
    for (const q of a.quality) chkb(q.filter.nc, q.count, q.amount);
    for (const s of a.bySource) chkb(s.filter.nc, s.count, s.unpaid);
    const P = a.populations; chkb({ due: 'overdue' }, P.overdue.count, P.overdue.amount); chkb({ due: 'not_due' }, P.notYetDue.count, P.notYetDue.amount); chkb({ due: 'unknown' }, P.dueUnknown.count, P.dueUnknown.amount);
    chkb({ payment: 'unpaid' }, P.fullyUnpaid.count, P.fullyUnpaid.amount); chkb({ payment: 'partial' }, P.partlyPaid.count, P.partlyPaid.amount);
    chkb({}, P.netUnpaid.count, P.netUnpaid.amount); chkb({ population: 'excluded' }, P.excludedUnpaid.count, P.excludedUnpaid.amount, 'excluded');
    const g = lst(sc, { population: 'unpaidGross' }); assert.equal(g.total, P.unpaidGross.count); near(g.sums.outstanding + g.sums.exclusionAmount, P.unpaidGross.amount);
    for (const x of a.byAmanah) { const r = lst({ ...sc, amanah: x.key }, {}); assert.equal(r.total, x.count); near(r.sums.outstanding, x.unpaid); }
  }
});

test('a multi-reason / multi-tag invoice appears once in the primary allocation and its tags list every applicable group', () => {
  // the synthetic data has an objection invoice and an amount-conflict invoice; a proposed enforcement link on each adds a second applicable group (an isolated overlay, not a data change)
  const pickBy = (fn) => { for (let i = 0; i < st.n; i += 1) { if (st.issue[i] > ctx0.cutoffN) continue; const D = derive(ctx0, i, ctx0.cutoffN); if (D.outstanding > 0 && !D.excluded && fn(i, D)) return i; } return -1; };
  const o1 = pickBy((i) => st.flags[i] & F.OBJECTION); const c1 = pickBy((i) => (st.flags[i] & F.AMT_CONFLICT) && !(st.flags[i] & F.OBJECTION)); assert.ok(o1 >= 0 && c1 >= 0);
  const links = { [idOf(st, o1)]: 'candidate', [idOf(st, c1)]: 'candidate' };
  const a = nonCollectionAnalysis(st, { scope: ALL, cfg, links }); allOk(a);
  const q = (page) => list(st, { scope: ALL, cfg, links, filters: { nc: {} }, page, pageSize: 500, withNc: true }).rows;
  const rows = q(0).concat(q(1));
  const multi = rows.filter((x) => x.nc.tags.length > 1); assert.ok(multi.length >= 2);
  for (const x of multi) assert.equal(x.nc.group, GROUPS.find((g) => x.nc.tags.includes(g.key)).key, 'the primary group is the first applicable tag by precedence');
  const ro = rows.find((x) => x.id === idOf(st, o1)); assert.deepEqual(ro.nc.tags, ['verify_proposed_link', 'review_objection']); assert.equal(ro.nc.group, 'verify_proposed_link');
  const rc = rows.find((x) => x.id === idOf(st, c1)); assert.equal(rc.nc.group, 'review_amount_conflict'); assert.ok(rc.nc.tags.includes('verify_proposed_link'));
  assert.equal(rows.length, a.populations.netUnpaid.count, 'each invoice is listed once');
  assert.equal(a.groups.reduce((t, g) => t + g.count, 0), a.populations.netUnpaid.count, 'the primary allocation counts each invoice in exactly one group');
  const g = (k) => a.groups.find((x) => x.key === k);
  assert.ok(g('review_objection').nonAdditiveTags.count > g('review_objection').count, 'the objection tag overlaps the primary allocation');
  assert.ok(a.groups.reduce((t, x) => t + x.nonAdditiveTags.count, 0) > a.populations.netUnpaid.count);
  const t = list(st, { scope: ALL, cfg, links, filters: { nc: { tag: 'review_objection' } }, page: 0, pageSize: 50 }); assert.equal(t.total, g('review_objection').nonAdditiveTags.count);
});

// ---- confirmed vs proposed enforcement links: they never imply payment
const cfgNoSnd = { cutoff: TODAY, rules: { 'SND-1': false } };
const pick = (n, skip = new Set()) => { const out = []; for (let i = 0; i < st.nGen && out.length < n; i += 1) { if (st.issue[i] > ctx0.cutoffN || skip.has(i) || st.ent[i] > 16) continue; const D = derive(makeCtx(st, { cfg: cfgNoSnd }), i, ctx0.cutoffN); if (D.outstanding > 0 && !D.excluded && st.exec[i] < 0 && !(st.flags[i] & (F.OBJECTION | F.AMT_CONFLICT | F.MISSING_ID)) && st.cstat[i] !== 2 && st.cstat[i] !== 4 && D.daysOverdue > 0) out.push(i); } return out; };
test('confirmed enforcement vs a proposed link: payment position unchanged; confirmed → monitor group, proposed → verify group; the proposal is unverified', () => {
  const [c1, c2, p1] = pick(3); const links = { [idOf(st, c1)]: 'confirmed', [idOf(st, c2)]: 'suspended', [idOf(st, p1)]: 'candidate' };
  const run2 = (l) => nonCollectionAnalysis(st, { scope: ALL, cfg: cfgNoSnd, ...(l ? { links: l } : {}) });
  const a0 = run2(); const a1 = run2(links); allOk(a1);
  near(a1.populations.netUnpaid.amount, a0.populations.netUnpaid.amount, 'a link never moves money'); assert.equal(a1.populations.netUnpaid.count, a0.populations.netUnpaid.count);
  near(a1.populations.partlyPaid.amount, a0.populations.partlyPaid.amount); near(a1.populations.fullyUnpaid.amount, a0.populations.fullyUnpaid.amount);
  const g = (a, k) => a.groups.find((x) => x.key === k);
  assert.equal(g(a1, 'monitor_enforcement').count, g(a0, 'monitor_enforcement').count + 2); assert.equal(g(a1, 'verify_proposed_link').count, g(a0, 'verify_proposed_link').count + 1);
  assert.equal(g(a1, 'verify_proposed_link').evidence.status, 'unverified'); assert.equal(g(a1, 'monitor_enforcement').evidence.status, 'source_record');
  const pr = (a, k) => a.process.find((x) => x.key === k);
  assert.equal(pr(a1, 'confirmed').count, pr(a0, 'confirmed').count + 2); assert.equal(pr(a1, 'proposed').count, pr(a0, 'proposed').count + 1);
  assert.equal(pr(a1, 'confirmed').sub.find((s) => s.key === 'confirmed_suspended').count, 1);
  const rows = list(st, { scope: ALL, cfg: cfgNoSnd, links, filters: { nc: { process: 'confirmed' } }, page: 0, pageSize: 50, withNc: true });
  assert.ok(rows.rows.some((r) => r.id === idOf(st, c1)) && rows.rows.every((r) => r.nc.process.includes('confirmed') && (r.nc.payment === 'unpaid' || r.nc.payment === 'partial')));
  const pRow = list(st, { scope: ALL, cfg: cfgNoSnd, links, filters: { nc: { process: 'proposed' } }, page: 0, pageSize: 50, withNc: true }).rows.find((r) => r.id === idOf(st, p1));
  assert.ok(pRow && pRow.nc.group === 'verify_proposed_link' && pRow.nc.payment === 'unpaid' && pRow.outstanding > 0, 'a proposed link implies no payment');
  const ctxL = makeCtx(st, { cfg: cfgNoSnd, links }); const D = derive(ctxL, c1, ctxL.cutoffN); const Dn = derive(makeCtx(st, { cfg: cfgNoSnd }), c1, ctx0.cutoffN); near(D.outstanding, Dn.outstanding); assert.equal(D.payStatus, Dn.payStatus);
  for (const [nc, cnt, am] of [[{ process: 'confirmed' }, pr(a1, 'confirmed').count, pr(a1, 'confirmed').amount], [{ process: 'proposed' }, pr(a1, 'proposed').count, pr(a1, 'proposed').amount], [{ group: 'monitor_enforcement' }, g(a1, 'monitor_enforcement').count, g(a1, 'monitor_enforcement').amount]]) {
    const r = list(st, { scope: ALL, cfg: cfgNoSnd, links, filters: { nc }, page: 0, pageSize: 1 }); assert.equal(r.total, cnt); near(r.sums.outstanding, am);
  }
});

test('approved exclusions stay untouched: with the default rules an excluded invoice is not in the net, and its unpaid remainder is in the excluded part only', () => {
  const p = base.populations; assert.ok(p.excludedUnpaid.count > 0);
  const ex = list(st, { scope: ALL, cfg, filters: { nc: { population: 'excluded' } }, page: 0, pageSize: 500, withNc: true });
  assert.ok(ex.rows.every((r) => r.nc.excluded && r.nc.group === null && r.outstanding === 0 && r.exclusionAmount > 0));
  assert.equal(lst(ALL, { population: 'net' }).total, p.netUnpaid.count);
  const noEx = list(st, { scope: ALL, cfg, filters: { nc: {} }, page: 0, pageSize: 500, withNc: true }); assert.ok(noEx.rows.every((r) => !r.nc.excluded));
});

test('unmatched report-only records are listed apart and are in no total', () => {
  assert.ok(base.unmatched.count > 0 && base.unmatched.amount > 0); assert.equal(base.unmatched.includedInTotals, false);
  const one = run(ent0Scope); assert.equal(one.unmatched.count, 0, 'a scoped view leaves the report-only records out'); assert.equal(one.unmatched.scopedOut, true);
  const s = snapshot(st, { scope: ALL, cfg }); near(base.populations.netUnpaid.amount, s.totals.outstanding, 'unmatched amounts are not added'); near(base.standingBalance.amount, s.stock.netUncollected);
  assert.ok(base.standingBalance.bridge.steps.length > 0);
});

test('investment invoices needing contract review are the centrally billed Furas invoices whose contract is unmatched or unlinked; groups carry plain texts', () => {
  const c = base.groups.find((g) => g.key === 'review_contract'); const q = base.quality.find((x) => x.key === 'contract_unmatched');
  const rows = list(st, { scope: ALL, cfg, filters: { nc: { quality: 'contract_unmatched' } }, page: 0, pageSize: 500, withNc: true });
  assert.ok(rows.rows.every((r) => r.source === SOURCES[0].key && (r.contractStatus === 'unmatched' || r.contractStatus === 'unlinked')));
  assert.equal(rows.total, q.count); assert.ok(c.count <= q.count);
  for (const g of base.groups) { assert.ok(g.evidence.status && g.evidence.textAr && g.evidence.textEn && g.nextStepAr && g.nextStepEn && g.rationaleAr && g.rationaleEn && g.missingAr && g.missingEn); assert.ok(['source_record', 'calculated', 'unverified', 'missing'].includes(g.evidence.status)); }
  assert.deepEqual(base.groups.map((g) => g.rank).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]); assert.equal(base.groups[base.groups.length - 1].key, 'not_yet_due');
});

test('heat map: top 12 Amanahs by unpaid; null where there is no invoice; rows rank by overdue', () => {
  assert.ok(base.heat.rows.length <= 12 && base.heat.values.length === base.heat.rows.length && base.heat.values.every((r) => r.length === AGE_KEYS.length));
  assert.ok(base.heat.values.some((r) => r.some((v) => v === null)) || base.heat.rows.length === 0);
  for (let k = 1; k < base.byAmanah.length; k += 1) assert.ok(base.byAmanah[k - 1].overdue >= base.byAmanah[k].overdue);
  const t = base.heat.rows[0]; const i = base.byAmanah.findIndex((x) => x.key === t.key); near(base.heat.values[0].reduce((s, v) => s + (v || 0), 0), base.byAmanah[i].unpaid);
});

console.log(`\n${passed} passed`);
