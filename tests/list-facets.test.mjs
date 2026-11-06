// The invoice-list data service (docs/invoice-lists-redesign.md «Data-service contract»): facets, the new filters, priority, pagination/sorting and the CSV export.
// Synthetic data only (the compact demo world). Run: npm run test:facets
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { list, worklist, exportChunks, EXPORT_COLUMNS, bumpEpoch } from '../server/lists.js';

process.env.DEMO_SIZE = 'compact';
let passed = 0; const test = (name, fn) => { try { fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } };
const TODAY = '2026-11-05'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const SC = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', product: [], mainClass: 'all' };
const ALLF = ['product', 'origin', 'source', 'due'];
const EPS = 0.5;
const near = (a, b, m = '') => assert.ok(Math.abs(a - b) <= EPS, `${m}: ${a} vs ${b}`);
const L = (scope, filters, extra = {}) => list(st, { scope, cfg, filters, page: 0, pageSize: 1, ...extra });
const ALLROWS = (scope, filters, extra = {}) => list(st, { scope, cfg, filters, page: 0, pageSize: 500, ...extra });
const sumOf = (arr, k) => arr.reduce((t, x) => t + x[k], 0);
const MEAS = ['collected', 'outstanding', 'gross', 'exclusionAmount'];
const checkFacetSums = (r, label, dims = ['product', 'origin', 'source']) => {
  for (const d of dims) {
    assert.equal(sumOf(r.facets[d], 'count'), r.total, `${label}: Σ ${d} count = list total`);
    for (const m of MEAS) near(sumOf(r.facets[d], m), r.sums[m], `${label}: Σ ${d} ${m}`);
  }
};
const finite = (o, path = '') => { if (typeof o === 'number') assert.ok(Number.isFinite(o), `${path} is finite`); else if (o && typeof o === 'object') for (const k of Object.keys(o)) finite(o[k], `${path}.${k}`); };

const UN = { state: 'uncollected' }; const PAID = { state: 'paid' };

test('every facet adds up to the filtered population (count · collected · outstanding · gross · exclusionAmount) — register and uncollected populations', () => {
  for (const [name, flt] of [['paid', PAID], ['uncollected', UN], ['all', {}]]) {
    const r = L(SC, flt, { facets: ALLF }); assert.ok(r.total > 20, `${name}: has rows`); checkFacetSums(r, name);
    for (const d of ['product', 'origin', 'source']) for (const b of r.facets[d]) { assert.ok(b.key && b.labelAr && b.labelEn && b.count > 0, `${name}/${d}: key, labels in both languages, no empty bucket`); }
  }
  const r = L(SC, PAID, { facets: ['product'] }); assert.deepEqual(Object.keys(r.facets), ['product'], 'only the requested facets are returned');
  assert.equal(L(SC, PAID).facets, undefined, 'no facets unless asked');
});

test('product labels are the real product names; revenue sources and origins carry both languages', () => {
  const r = L(SC, UN, { facets: ALLF }); const p = Object.fromEntries(r.facets.product.map((b) => [b.key, b]));
  assert.equal(p.mumtathil.labelAr, 'ممتثل'); assert.equal(p.foras.labelEn, 'Furas'); assert.ok(r.facets.source.every((b) => b.labelAr && b.labelEn && b.labelAr !== b.key));
  assert.deepEqual(r.facets.origin.map((b) => b.key).sort(), ['central', 'internal']);
  assert.equal(r.facets.origin.find((b) => b.key === 'central').labelAr, 'مركزي');
});

test('own-dimension rule: a selection narrows every facet EXCEPT its own, which keeps showing the alternatives', () => {
  const base = L(SC, UN, { facets: ALLF });
  // revenue source (scope.source)
  const srcKey = base.facets.source[0].key; const bySrc = L({ ...SC, source: srcKey }, UN, { facets: ALLF });
  assert.deepEqual(bySrc.facets.source, base.facets.source, 'the source facet ignores the source selection');
  assert.equal(bySrc.total, base.facets.source[0].count, 'the selected source bucket count = the list total');
  checkFacetSums(bySrc, 'source selected', ['product', 'origin']); assert.ok(bySrc.facets.product.length <= base.facets.product.length);
  // product (filters.product, a key or a list of keys)
  const pk = base.facets.product.find((b) => b.count > 3).key; const byP = L(SC, { ...UN, product: pk }, { facets: ALLF });
  assert.deepEqual(byP.facets.product, base.facets.product, 'the product facet ignores the product selection');
  assert.equal(byP.total, base.facets.product.find((b) => b.key === pk).count, 'the selected product bucket count = the list total');
  for (const m of MEAS) near(byP.sums[m], base.facets.product.find((b) => b.key === pk)[m], `selected product ${m}`);
  checkFacetSums(byP, 'product selected', ['origin', 'source']);
  assert.deepEqual(L(SC, { ...UN, product: [pk] }, { facets: ['product'] }).facets.product, base.facets.product);
  assert.equal(L(SC, { ...UN, product: [pk] }).total, byP.total, 'an array of keys selects the same');
  // a product chosen in the SHARED scope (scope.product) behaves the same
  const byScopeP = L({ ...SC, product: [pk] }, UN, { facets: ALLF }); assert.deepEqual(byScopeP.facets.product, base.facets.product); assert.equal(byScopeP.total, byP.total);
  // origin (filters.origin and scope.scopeType)
  const byO = L(SC, { ...UN, origin: 'central' }, { facets: ALLF }); assert.deepEqual(byO.facets.origin, base.facets.origin, 'the origin facet ignores the origin selection');
  assert.equal(byO.total, base.facets.origin.find((b) => b.key === 'central').count); checkFacetSums(byO, 'origin selected', ['product', 'source']);
  const byO2 = L({ ...SC, scopeType: 'internal' }, UN, { facets: ALLF }); assert.deepEqual(byO2.facets.origin, base.facets.origin); assert.equal(byO2.total, base.facets.origin.find((b) => b.key === 'internal')?.count ?? 0);
  assert.equal(L(SC, { ...UN, origin: 'central' }).total + L(SC, { ...UN, origin: 'internal' }).total, base.total, 'central + internal = all');
  // due (filters.dueState)
  const byD = L(SC, { ...UN, dueState: 'overdue' }, { facets: ALLF }); assert.deepEqual(byD.facets.due, base.facets.due, 'the due facet ignores the due selection');
  checkFacetSums(byD, 'due selected', ['product', 'origin', 'source']);
  // a facet follows the OTHER dimensions: product + source selected together
  const both = L({ ...SC, source: srcKey }, { ...UN, product: pk }, { facets: ALLF });
  assert.deepEqual(both.facets.source, byP.facets.source, 'source facet = filtered by the product only'); assert.deepEqual(both.facets.product, bySrc.facets.product, 'product facet = filtered by the source only');
});

test('the rows of a selection really carry that product / origin / source', () => {
  const base = L(SC, UN, { facets: ALLF });
  for (const b of base.facets.product) { const r = ALLROWS(SC, { ...UN, product: b.key }); assert.equal(r.total, b.count, b.key); assert.ok(r.rows.every((x) => x.productKey === b.key), `${b.key}: rows`); }
  for (const b of base.facets.origin) { const r = ALLROWS(SC, { ...UN, origin: b.key }); assert.equal(r.total, b.count); assert.ok(r.rows.every((x) => x.origin === b.key)); }
  for (const b of base.facets.source) { const r = ALLROWS({ ...SC, source: b.key }, UN); assert.equal(r.total, b.count); assert.ok(r.rows.every((x) => x.source === b.key)); }
  assert.equal(L(SC, { ...UN, product: 'no-such-product' }).total, 0, 'an unknown product matches nothing (the list is not widened)');
});

test('state «uncollected» = the worklist with excluded invoices included (the page /collection lists): same invoices, Σ outstanding + Σ exclusionAmount = the page total', () => {
  for (const sc of [SC, { ...SC, source: 'fines' }, { ...SC, from: '2000-01-01' }, { ...SC, product: ['mumtathil'] }]) {
    const w = worklist(st, { scope: sc, cfg, limit: 500, includeExcluded: true, reason: 'all' }); const r = ALLROWS(sc, UN); assert.ok(w.total <= 500 && r.total <= 500);
    assert.equal(r.total, w.total, 'same count'); near(r.sums.outstanding + r.sums.exclusionAmount, w.totalOutstanding, 'Σ outstanding + Σ exclusionAmount = the worklist total');
    assert.deepEqual(r.rows.map((x) => x.id).sort(), w.rows.map((x) => x.id).sort(), 'same invoices');
    for (const x of r.rows) assert.ok(x.outstanding > 0 || (x.exclusionAmount > 0 && x.exclusionReason), 'every row owes something; an excluded row carries its reason');
    assert.ok(r.rows.every((x) => x.cls !== 'collected' && x.cls !== 'cancelled'));
    near(r.sums.outstanding + r.sums.exclusionAmount, sumOf(r.rows, 'uncollected'), 'row.uncollected adds up');
  }
  // the worklist's other filters have list equivalents
  const w2 = worklist(st, { scope: SC, cfg, limit: 500, includeExcluded: true, reason: 'none' }); assert.equal(L(SC, { ...UN, reason: 'none' }).total, w2.total);
  const w3 = worklist(st, { scope: SC, cfg, limit: 500, includeExcluded: true, payStatus: 'partial' }); assert.equal(L(SC, { ...UN, payStatus: 'partial' }).total, w3.total);
  const w4 = worklist(st, { scope: SC, cfg, limit: 500, includeExcluded: true, category: 'overdue' }); assert.equal(L(SC, { ...UN, category: 'overdue' }).total, w4.total);
  const w5 = worklist(st, { scope: SC, cfg, limit: 500, includeExcluded: true, reason: 'any' }); assert.equal(L(SC, { ...UN, reason: 'any' }).total, w5.total);
  // excluded unpaid = the engine's exclusion amount; a net-open row has no exclusion amount and vice versa
  const r = ALLROWS(SC, UN); for (const x of r.rows) assert.ok(!(x.outstanding > 0 && x.exclusionAmount > 0), 'outstanding and exclusionAmount never overlap');
});

test('partial payments: collected stays collected; a partly paid invoice is in the register; fully paid + partly paid = the register', () => {
  const paid = L(SC, PAID); const full = L(SC, { state: 'collected' }); const part = L(SC, { state: 'partial' });
  assert.equal(full.total + part.total, paid.total, 'collected + partial = paid'); near(full.sums.collected + part.sums.collected, paid.sums.collected, 'collected amount splits');
  near(full.sums.outstanding + part.sums.outstanding, paid.sums.outstanding, 'unpaid remainder splits'); assert.ok(part.total > 0, 'the compact world has partly paid invoices');
  assert.equal(paid.population.key, 'paid'); assert.deepEqual(paid.population.includes, ['collected', 'partial']);
  assert.equal(paid.population.fullyPaid, full.total); assert.equal(paid.population.partlyPaid, part.total); assert.equal(paid.population.fullyPaid + paid.population.partlyPaid, paid.total); assert.equal(paid.population.count, paid.total);
  const rows = ALLROWS(SC, { state: 'partial' }).rows; assert.ok(rows.every((x) => x.collected > 0 && x.outstanding > 0 && x.payStatus === 'partial'), 'partly paid rows keep what was collected AND owe the rest');
  const u = L(SC, UN); assert.ok(u.population.partlyPaid > 0, 'partly paid invoices stay in the uncollected list too'); assert.equal(u.population.key, 'uncollected');
  assert.ok(L(SC, {}).population.includes.includes('cancelled'));
});

test('due position: overdue · not yet due · unknown add up to the unpaid non-excluded population; excluded invoices are tallied apart', () => {
  const r = L(SC, UN, { facets: ['due'] }); const d = r.facets.due; assert.deepEqual(Object.keys(d), ['overdue', 'notYetDue', 'unknown', 'excluded']);
  const cnt = d.overdue.count + d.notYetDue.count + d.unknown.count; const amt = d.overdue.amount + d.notYetDue.amount + d.unknown.amount;
  assert.equal(cnt + d.excluded.count, r.total, 'buckets + excluded = the list'); near(amt, r.sums.outstanding, 'Σ amount = Σ outstanding (the net unpaid)'); near(d.excluded.amount, r.sums.exclusionAmount, 'excluded unpaid');
  assert.equal(d.overdue.excludedCount + d.notYetDue.excludedCount + d.unknown.excludedCount, d.excluded.count); near(d.overdue.excludedAmount + d.notYetDue.excludedAmount + d.unknown.excludedAmount, d.excluded.amount);
  // the filter opens exactly what a bucket counts (the excluded invoices of the bucket included)
  for (const [fk, bk] of [['overdue', 'overdue'], ['not_due', 'notYetDue'], ['unknown', 'unknown']]) {
    const x = L(SC, { ...UN, dueState: fk }); assert.equal(x.total, d[bk].count + d[bk].excludedCount, fk); near(x.sums.outstanding, d[bk].amount, `${fk} outstanding`); near(x.sums.exclusionAmount, d[bk].excludedAmount, `${fk} excluded`);
  }
  assert.ok(ALLROWS(SC, { ...UN, dueState: 'overdue' }).rows.filter((x) => !x.exclusionReason).every((x) => x.daysOverdue > 0), 'overdue rows are overdue');
  assert.ok(ALLROWS(SC, { ...UN, dueState: 'not_due' }).rows.every((x) => !(x.daysOverdue > 0)), 'not-yet-due rows are not overdue');
  // on the register (collected) population only the partly paid remainder has a due position
  const c = L(SC, PAID, { facets: ['due'] }).facets.due; assert.equal(c.overdue.count + c.notYetDue.count + c.unknown.count, L(SC, { state: 'partial' }).total);
  assert.equal(L(SC, { dueState: 'overdue', state: 'collected' }).total, 0, 'a fully paid invoice has no due position');
});

test('due date unavailable is its own bucket and is never read as overdue', () => {
  const ids = ALLROWS(SC, { ...UN, dueState: 'overdue', reason: 'none' }).rows.filter((x) => x.outstanding > 0); const i = ids[ids.length - 1].index; const saved = st.due[i];
  try {
    st.due[i] = 0; bumpEpoch(); // a store edit is a new epoch: the list cache is dropped
    const r = L(SC, { ...UN, reason: 'none' }, { facets: ['due'] }); assert.equal(r.facets.due.unknown.count, 1); near(r.facets.due.unknown.amount, ids[ids.length - 1].outstanding);
    assert.equal(L(SC, { ...UN, dueState: 'unknown' }).total, 1); assert.ok(L(SC, { ...UN, dueState: 'overdue', reason: 'none' }).total === ids.length - 1, 'it left the overdue bucket');
    const row = ALLROWS(SC, { ...UN, dueState: 'unknown' }, { withPriority: true }).rows[0]; assert.ok(row.priority.level !== 'high' && /الاستحقاق/.test(row.priority.why.ar), 'unknown due is never high, and says why');
  } finally { st.due[i] = saved; bumpEpoch(); }
  assert.equal(L(SC, { ...UN, dueState: 'unknown' }).total, 0);
});

test('priority: High / Medium / Low with a plain reason, deterministic, no numeric score, null when nothing is owed', () => {
  const a = ALLROWS(SC, UN, { withPriority: true }); const b = ALLROWS(SC, UN, { withPriority: true });
  assert.deepEqual(a.rows.map((x) => [x.id, x.priority.level]), b.rows.map((x) => [x.id, x.priority.level]), 'deterministic');
  const levels = new Set(a.rows.map((x) => x.priority.level)); assert.ok([...levels].every((l) => ['high', 'medium', 'low'].includes(l)) && levels.size >= 2, 'a spread of levels');
  for (const x of a.rows) {
    assert.ok(x.priority.why.ar.length > 5 && x.priority.why.en.length > 5, `${x.id}: a reason in both languages`); assert.ok(x.nextStep?.ar && x.nextStep?.en, `${x.id}: a next step`);
    assert.ok(Array.isArray(x.priority.factors) && x.priority.factors.length >= 3 && x.priority.factors.every((f) => f.label.ar && f.label.en && f.value.ar && f.value.en));
    assert.ok(!('score' in x) && !('score' in x.priority), 'no numeric score');
    if (x.exclusionReason) assert.equal(x.priority.level, 'low', 'excluded: nothing to collect');
    if (x.priority.level === 'high') assert.ok(x.daysOverdue > 30 && x.outstanding > 0, 'high is overdue by more than 30 days and open');
    if (x.priority.level === 'low' && !x.exclusionReason) assert.ok(x.daysOverdue <= 90, 'a low open invoice is at most 90 days overdue');
    if (x.daysOverdue > 180 && !x.exclusionReason && x.cls === 'overdue') assert.ok(x.priority.level !== 'low', 'over 180 days overdue is never low');
  }
  assert.ok(a.rows.some((x) => x.priority.level === 'high'));
  const paid = ALLROWS(SC, PAID, { withPriority: true }).rows.filter((x) => x.cls === 'collected'); assert.ok(paid.length && paid.every((x) => x.priority === null && x.nextStep === null), 'a fully paid invoice has no priority');
  assert.equal(L(SC, UN).rows[0].priority, undefined, 'priority only on request');
});

test('sorting by priority orders the levels (high first when descending), reversed when ascending; the page and the whole list agree', () => {
  const rank = { high: 2, medium: 1, low: 0 };
  const d = ALLROWS(SC, UN, { sort: { key: 'priority', dir: 'desc' }, withPriority: true }).rows.map((x) => rank[x.priority.level]);
  assert.deepEqual(d, [...d].sort((x, y) => y - x), 'non-increasing'); assert.ok(d[0] === 2 && d[d.length - 1] === 0);
  const a = ALLROWS(SC, UN, { sort: { key: 'priority', dir: 'asc' }, withPriority: true }).rows.map((x) => rank[x.priority.level]); assert.deepEqual(a, [...a].sort((x, y) => x - y));
  // paging a sort gives the same sequence as the whole list
  const all = ALLROWS(SC, UN, { sort: { key: 'priority', dir: 'desc' } }).rows.map((x) => x.id); const paged = [];
  for (let p = 0; p < 4; p += 1) paged.push(...list(st, { scope: SC, cfg, filters: UN, page: p, pageSize: 40, sort: { key: 'priority', dir: 'desc' } }).rows.map((x) => x.id));
  assert.deepEqual(paged, all, 'pages concatenate to the whole ordered list'); assert.equal(new Set(paged).size, all.length, 'no row repeated or lost');
});

test('pagination and every sort key work for the uncollected population (and keep the totals)', () => {
  const total = L(SC, UN).total;
  const key = { outstanding: (x) => x.outstanding, daysOverdue: (x) => x.daysOverdue, issue: (x) => Date.parse(x.issueDate), gross: (x) => x.gross, exclusionAmount: (x) => x.exclusionAmount, uncollected: (x) => x.uncollected, collected: (x) => x.collected };
  for (const [k, fn] of Object.entries(key)) for (const dir of ['asc', 'desc']) {
    const r = ALLROWS(SC, UN, { sort: { key: k, dir } }); assert.equal(r.total, total); const v = r.rows.map(fn);
    assert.deepEqual(v, [...v].sort((x, y) => (dir === 'asc' ? x - y : y - x)), `sorted by ${k} ${dir}`);
  }
  { const asc = ALLROWS(SC, UN, { sort: { key: 'id', dir: 'asc' } }).rows.map((x) => x.id); const desc = ALLROWS(SC, UN, { sort: { key: 'id', dir: 'desc' } }).rows.map((x) => x.id); assert.deepEqual(asc, [...desc].reverse(), 'id asc is id desc reversed'); assert.equal(new Set(asc).size, total); }
  const p0 = list(st, { scope: SC, cfg, filters: UN, page: 0, pageSize: 25, sort: { key: 'outstanding', dir: 'desc' } }); const p1 = list(st, { scope: SC, cfg, filters: UN, page: 1, pageSize: 25, sort: { key: 'outstanding', dir: 'desc' } });
  assert.equal(p0.rows.length, 25); assert.equal(p0.total, total); assert.equal(p1.total, total); assert.ok(p0.rows[24].outstanding >= p1.rows[0].outstanding && !p1.rows.some((x) => p0.rows.some((y) => y.id === x.id)));
  assert.equal(list(st, { scope: SC, cfg, filters: UN, page: 99, pageSize: 25 }).rows.length, 0, 'a page past the end is empty');
  // the totals do not depend on the page or on the sort
  const a = L(SC, UN, { sort: { key: 'gross', dir: 'asc' } }); const b = L(SC, UN, { sort: { key: 'priority', dir: 'desc' }, page: 2 }); assert.deepEqual(a.sums, b.sums);
});

test('cache keys: every filter, the facet request and the sort are part of the key (no stale overlay / filter answer)', () => {
  const base = L(SC, UN, { facets: ['product'] }); const base2 = L(SC, UN, { facets: ['product'] }); assert.deepEqual(base, base2, 'a repeated request is identical');
  assert.equal(L(SC, UN).facets, undefined, 'the same filters WITHOUT facets must not return the cached facets');
  assert.ok(L(SC, UN, { facets: ['origin'] }).facets.origin && !L(SC, UN, { facets: ['origin'] }).facets.product);
  const pk = base.facets.product[0].key;
  const t = [L(SC, UN).total, L(SC, { ...UN, dueState: 'overdue' }).total, L(SC, { ...UN, dueState: 'not_due' }).total, L(SC, { ...UN, origin: 'central' }).total, L(SC, { ...UN, origin: 'internal' }).total, L(SC, { ...UN, product: pk }).total, L(SC, UN).total];
  assert.equal(t[0], t[6]); assert.ok(t[1] < t[0] && t[2] < t[0] && t[3] <= t[0] && t[5] < t[0], 'each filter changes the answer');
  // the overlay content is part of the key too: confirming an order link / a decision changes the list that was cached before
  const ids = ALLROWS(SC, { ...UN, reason: 'none' }).rows.map((x) => x.id); const links = { [ids[0]]: 'open' };
  assert.notDeepEqual(L(SC, UN, { links }).sums, L(SC, UN).sums, 'an enforcement link changes the sums and is not served from the cache of the request without it');
});

test('the CSV export honours every filter, always holds ALL filtered rows (not the page) and says so on its first line', () => {
  const lines = (req) => [...exportChunks(st, req, 50)].join('').replace(/^﻿/, '').split('\n').filter(Boolean);
  const reqs = [{ scope: SC, cfg, filters: UN, page: 3, pageSize: 10 }, { scope: SC, cfg, filters: { ...UN, dueState: 'overdue', origin: 'central' } }, { scope: SC, cfg, filters: PAID, facets: ALLF }, { scope: { ...SC, source: 'fines' }, cfg, filters: { ...UN, product: 'mumtathil' } }];
  for (const rq of reqs) {
    const ls = lines(rq); const total = list(st, { ...rq, page: 0, pageSize: 1 }).total; assert.ok(ls[0].startsWith('#'), 'first line is a comment');
    assert.ok(ls[0].includes(`يشمل كل النتائج المصفّاة (${total})`), 'Arabic note with the count'); assert.ok(ls[0].includes(`includes all ${total} filtered results`), 'English note with the count'); assert.ok(ls[0].includes('demo data'), 'the synthetic-data line stays');
    assert.equal(ls[1], EXPORT_COLUMNS.join(','), 'header on line 2'); assert.equal(ls.length - 2, total, 'every filtered row, not the page');
  }
  const ls = lines(reqs[0]); const head = ls[1].split(','); assert.deepEqual(head.slice(-5, -3), ['priority', 'exclusion_flag'], 'the earlier columns keep their place'); assert.deepEqual(head.slice(-3), ['municipality_ref_id', 'municipality_status', 'municipality_source_value'], 'the municipality columns are appended last'); assert.equal(head[0], 'invoice_id'); assert.equal(head[34], 'payment_status');
  const iP = head.indexOf('priority'); const iE = head.indexOf('exclusion_flag'); const iX = head.indexOf('excluded_sar'); const iO = head.indexOf('outstanding_sar');
  const rows = ls.slice(2).map((l) => l.split(',')); assert.ok(rows.every((r) => r.length === head.length || /"/.test(r.join(','))));
  const u = L(SC, UN); assert.equal(rows.filter((r) => r[iE] === 'excluded').length, u.population.excluded, 'exclusion_flag marks the excluded invoices');
  assert.ok(rows.every((r) => (Number(r[iO]) > 0 || Number(r[iX]) > 0) ? ['high', 'medium', 'low'].includes(r[iP]) : true), 'priority on every invoice that owes something');
  const lo = lines({ scope: SC, cfg, filters: { ...UN, dueState: 'overdue' } }); assert.equal(lo.length - 2, L(SC, { ...UN, dueState: 'overdue' }).total);
  // the priority in the file is the priority on screen
  const scr = new Map(ALLROWS(SC, UN, { withPriority: true }).rows.map((x) => [x.id, x.priority.level])); assert.ok(rows.every((r) => scr.get(r[0]) === r[iP]));
});

test('empty scope and empty filters: zeros everywhere, no NaN, no crash', () => {
  const empty = { ...SC, from: '2000-01-01', to: '2000-02-01' };
  for (const flt of [{}, UN, PAID, { ...UN, dueState: 'overdue' }]) {
    const r = L(empty, flt, { facets: ALLF, withPriority: true }); assert.equal(r.total, 0); assert.deepEqual(r.rows, []); finite(r);
    for (const m of ['count', 'gross', 'collected', 'outstanding', 'exclusionAmount', 'net']) assert.equal(r.sums[m], 0, m);
    assert.deepEqual([r.facets.product, r.facets.origin, r.facets.source], [[], [], []]); assert.equal(r.facets.due.overdue.count + r.facets.due.notYetDue.count + r.facets.due.unknown.count + r.facets.due.excluded.count, 0);
    assert.equal(r.population.count, 0);
  }
  const none = L(SC, { ...UN, product: 'no-such-product' }, { facets: ALLF }); finite(none); assert.equal(none.total, 0);
  assert.ok(none.facets.product.length > 0, 'the product facet still offers the alternatives of the other filters');
  assert.equal([...exportChunks(st, { scope: empty, cfg, filters: UN })].join('').split('\n').filter(Boolean).length, 2, 'an empty export is the comment and the header');
  assert.ok([...exportChunks(st, { scope: empty, cfg, filters: UN })][0].includes('(0)'));
});

test('the existing worklist is unchanged (only added to): same shape, still ranked by the weighted score', () => {
  const w = worklist(st, { scope: SC, cfg, limit: 20 }); assert.ok(w.rows.length > 0 && w.rows.every((x) => typeof x.score === 'number' && 'actionability' in x && 'evidenceQuality' in x && 'uncollected' in x && x.category));
  const sc = w.rows.map((x) => x.score); assert.deepEqual(sc, [...sc].sort((a, b) => b - a));
});

console.log(`${passed} list/facets checks passed`);
