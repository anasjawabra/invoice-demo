// Tests of the Decision Room: items derived from the platform's own figures (reconciling with the dashboard), the ranking, the lifecycle store. Run with `npm run test:decisions`.
import assert from 'node:assert/strict';
import { loadStore as loadData } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { buildDecisionItems, planSectionOf, withState, summaryOf, W } from '../src/data/decisionRoom.js';
import * as ds from '../src/data/decisionStore.js';
import { targetsOf, emptyTargetStore } from '../src/data/planTargets.js';

let n = 0; const ok = (name, fn) => { fn(); n += 1; };
process.env.DEMO_SIZE = 'compact';
const TODAY = '2026-10-20'; const data = loadData(TODAY); const cfg = { cutoff: TODAY };
const full = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
const snap = snapshot(data, { scope: full, cfg });
const labels = { amanah: (k) => ({ ar: k, en: k }), source: (k) => ({ ar: k, en: k }) };
const base = { today: TODAY, snapshot: snap, labels, targetRate: () => 0.6, plan: null, contracts: { count: 7, arrears: 1.5e9, overdueInstallments: 5, futureNotInvoiced: 2.4e9 }, noContractCount: 14, orders: { suspendedCount: 10, suspendedAmount: 4e8 }, matching: { amountConflicts: 5, missingFields: 17 } };

ok('the overdue and not-yet-due parts of the cells add up to «غير المحصّل» of the dashboard (a partition, nothing counted twice)', () => {
  const cells = snap.matrix.amanahSource; const od = cells.reduce((t, c) => t + c.overdue, 0); const nd = cells.reduce((t, c) => t + c.notDue, 0);
  assert.ok(Math.abs(od + nd - snap.totals.outstanding) < 1, 'overdue + not yet due = uncollected');
  assert.ok(nd > 0 && od > 0);
  const aged = snap.stock.aged180ByAmanah.reduce((t, a) => t + a.amount, 0); assert.ok(Math.abs(aged - snap.stock.aging[4].amount) < 1, 'aged by Amanah adds up to the 180+ bucket');
});

const R = buildDecisionItems(base);
ok('items: unique stable keys; every item has a lane, a category, a role, a due period and evidence or a stated reason; the not-yet-due amount is never inside an overdue item', () => {
  const keys = R.items.map((i) => i.key); assert.equal(new Set(keys).size, keys.length);
  for (const i of R.items) { assert.ok(['decision', 'action', 'watch'].includes(i.lane)); assert.ok(i.category && i.role && i.dueDays > 0 && i.basis && i.title.ar && i.title.en); assert.ok(i.evidence.length > 0, `evidence for ${i.key}`); assert.ok(['confirmed', 'hypothesis', 'unknown'].includes(i.cause.status)); }
  const cellOf = (key) => { const [a, s] = key.replace('overdue:', '').split('|'); return snap.matrix.amanahSource.find((c) => c.amanah === a && c.source === s); };
  for (const i of R.items.filter((x) => x.key.startsWith('overdue:'))) assert.equal(i.amount, cellOf(i.key).overdue, 'the amount is the OVERDUE part only');
  const totalShown = R.items.filter((x) => x.key.startsWith('overdue:')).reduce((t, x) => t + x.amount, 0); assert.ok(totalShown <= R.summary.totalOverdue + 1);
  assert.ok(R.items.some((i) => i.key === 'upcoming:not_due' && i.lane === 'watch'), 'the not-yet-due balance is shown apart, as «to follow»');
  assert.equal(R.summary.totalOverdue + R.summary.totalNotDue, R.summary.uncollected, 'the summary reconciles with the dashboard card');
});
ok('categories without data produce no items; the unsupported ones are never generated', () => {
  const none = buildDecisionItems({ ...base, contracts: null, noContractCount: 0, orders: null, matching: null, plan: null });
  assert.ok(none.items.every((i) => ['overdue', 'aged'].includes(i.category)));
  assert.ok(!R.items.some((i) => /commit|follow_up|recurring/.test(i.key)), 'no commitments / stalled follow-ups / recurring obstacles without data');
});
ok('ranking = the platform formula; the reasons are the three largest weighted parts; the order is deterministic', () => {
  assert.deepEqual(W, { amount: 0.4, aging: 0.25, actionability: 0.25, evidence: 0.1 });
  for (let k = 1; k < R.items.length; k += 1) assert.ok(R.items[k - 1].score >= R.items[k].score);
  for (const i of R.items) { assert.equal(i.why.length, 3); const [a, b, c] = i.why.map((w) => w.v); assert.ok(a >= b && b >= c); }
  assert.deepEqual(buildDecisionItems(base).items.map((i) => i.key), R.items.map((i) => i.key));
  const big = R.items.find((i) => i.amount === Math.max(...R.items.map((x) => x.amount || 0))); assert.ok(big.why.some((w) => w.k === 'amount'));
});
ok('lanes: aged debt, year target and suspended orders ask for a decision; overdue follow-up and data matching ask for an action; the rest is to follow', () => {
  const lane = (p) => R.items.filter((i) => i.key.startsWith(p)).map((i) => i.lane);
  assert.ok(lane('aged:').every((l) => l === 'decision')); assert.ok(lane('overdue:').every((l) => l === 'action')); assert.deepEqual(lane('orders:'), ['decision']); assert.deepEqual(lane('data:missing'), ['watch']); assert.deepEqual(lane('contracts:future'), ['watch']);
});
ok('year target: an item appears only when the estimate is below the target; an entity behind its plan appears with its gap; a count-only item has no invented amount', () => {
  const rows = [targetsOf(emptyTargetStore(), 2026, 'A', { revAdjusted: 6e9, expAdjusted: 10e9 }), targetsOf(emptyTargetStore(), 2026, 'B', { revAdjusted: 4e9, expAdjusted: 20e9 })];
  const months = (v) => Array.from({ length: 10 }, () => v);
  const p = planSectionOf({ year: 2026, reportingDate: TODAY, entityRows: rows, collectedByKey: { A: 2e9, B: 3e9 }, collectedTotal: 5e9, monthly: months(0.5e9), billedMonthly: months(1e9), standing: 2e9 });
  assert.ok(p.ministry.target === 10e9 && p.entities.length === 2);
  const withPlan = buildDecisionItems({ ...base, plan: p });
  const tm = withPlan.items.find((i) => i.key === 'target:ministry'); assert.ok(tm && tm.lane === 'decision' && tm.amount > 0 && tm.caveat, 'a labelled demonstration estimate');
  assert.ok(withPlan.items.find((i) => i.key === 'target:A'), 'entity A collected 2e9 against ~4.4e9 planned to date');
  const easy = planSectionOf({ year: 2026, reportingDate: TODAY, entityRows: rows, collectedByKey: { A: 6e9, B: 4e9 }, collectedTotal: 10e9, monthly: months(1e9), billedMonthly: months(1e9), standing: 2e9 });
  assert.ok(!buildDecisionItems({ ...base, plan: easy }).items.some((i) => i.key.startsWith('target:')), 'on track: no target item');
  assert.equal(R.items.find((i) => i.key === 'contracts:no_contract').amount, null);
});

/* ---------------- the work store ---------------- */
const ctx = { by: 'Tester', at: '2026-10-20T10:00:00Z' }; const meta = { title: { ar: 'ع', en: 'T' }, category: 'overdue', lane: 'action', amount: 5 };
ok('lifecycle: new → in progress → completed; deferral and rejection need a reason; completed is final; a refused change leaves the store untouched', () => {
  let s = ds.emptyStore();
  assert.equal(ds.transition(s, 'k', 'completed', {}, ctx).error, 'not_allowed'); assert.equal(ds.transition(s, 'k', 'deferred', { reason: '  ' }, ctx).error, 'reason_required');
  s = ds.transition(s, 'k', 'in_progress', {}, { ...ctx, meta }).store; assert.equal(s.items.k.status, 'in_progress'); assert.equal(s.items.k.meta.amount, 5);
  s = ds.transition(s, 'k', 'deferred', { reason: 'waiting for the debtor' }, ctx).store; assert.equal(s.items.k.status, 'deferred'); s = ds.transition(s, 'k', 'in_progress', {}, ctx).store;
  s = ds.transition(s, 'k', 'completed', { amountNow: 7 }, ctx).store; assert.equal(s.items.k.amountAtClose, 7); assert.equal(ds.transition(s, 'k', 'in_progress', {}, ctx).error, 'not_allowed');
  assert.deepEqual(s.items.k.history.map((h) => h.to || h.action), ['in_progress', 'deferred', 'in_progress', 'completed']); assert.equal(s.items.k.history[1].reason, 'waiting for the debtor');
});
ok('assign needs an owner and a valid due date; a note needs text; everything is attributed and dated', () => {
  const s0 = ds.emptyStore();
  assert.equal(ds.assign(s0, 'k', { owner: '', due: '2026-11-19' }, ctx).error, 'owner_required'); assert.equal(ds.assign(s0, 'k', { owner: 'finance', due: '19/11' }, ctx).error, 'due_required');
  const s1 = ds.assign(s0, 'k', { owner: 'finance', assignee: 'Tester', due: '2026-11-19' }, { ...ctx, meta }).store; assert.equal(s1.items.k.owner, 'finance'); assert.deepEqual(s1.items.k.history[0], { at: ctx.at, by: 'Tester', action: 'assign', owner: 'finance', assignee: 'Tester', due: '2026-11-19' });
  assert.equal(ds.addNote(s1, 'k', ' ', ctx).error, 'text_required'); assert.equal(ds.addNote(s1, 'k', 'called the debtor', ctx).store.items.k.history.at(-1).text, 'called the debtor');
  assert.equal(ds.dueDateOf('2026-10-20', 30), '2026-11-19');
});
ok('recalculation keeps the work: state is matched by the stable key; an item the data stops raising comes back as «resolved by the data»; overdue actions are counted from the assigned due date', () => {
  const k = R.items[0].key; const other = R.items[1].key;
  let s = ds.assign(ds.emptyStore(), k, { owner: 'finance', due: '2026-10-01' }, { ...ctx, meta }).store;
  s = ds.transition(s, 'gone:x', 'in_progress', {}, { ...ctx, meta: { title: { ar: 'قديم', en: 'Old' }, category: 'data', lane: 'action', amount: 3 } }).store;
  s = ds.transition(s, other, 'rejected', { reason: 'not relevant' }, ctx).store;
  const ws = withState(R.items, s, { today: TODAY });
  assert.equal(ws.find((i) => i.key === k).overdueAction, true); assert.equal(ws.find((i) => i.key === other).status, 'rejected');
  const gone = ws.find((i) => i.key === 'gone:x'); assert.ok(gone && gone.resolvedByData && gone.status === 'resolved');
  const sm = summaryOf(ws, R.summary); assert.equal(sm.overdueActions, 1); assert.equal(sm.decisions, R.items.filter((i) => i.lane === 'decision' && i.key !== other).length);
  assert.equal(sm.collectible, R.summary.totalOverdue);
});
console.log(`decision room: ${n} test groups passed`);
