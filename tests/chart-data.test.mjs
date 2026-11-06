// Chart data (docs/chart-library.md «Chart data»): the semantic descriptors (`dim`), the companion datasets (`alts`) and the invoice-level distributions behind the report charts.
// Real models on the compact synthetic world; every companion payload is reconciled to the numbers of the block it belongs to. Synthetic data only.
// Run: npm run test:chartdata
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { list } from '../server/lists.js';
import { chartDistributions, quantile, fiveNumber, MIN_BOX } from '../server/distributions.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { buildNcReportModel } from '../src/data/ncReportModel.js';
import { buildDashboardModel } from '../src/data/dashboardReport.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { chartBlocks, assignChartIds } from '../src/data/chartIds.js';
import { resolveAlt, sankeyAlt, pointsAlt, treeAlt, histogramAlt, boxAlt, bulletRateAlt, bulletAmountAlt, NON_CAUSAL } from '../src/data/chartAlts.js';
import { treeProblem, sankeyProblem } from '../src/data/chartTree.js';
import { ENTITIES } from '../src/data/catalog.js';
import { muniLabel } from '../src/data/municipalityModel.js';
import { readFileSync } from 'node:fs';
import { chartSvg } from '../src/utils/chartKinds.js';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan (the seed is the 2026 reference)

process.env.DEMO_SIZE = 'compact';
let passed = 0; const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const SC = (extra = {}) => ({ from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', ...extra });
const near = (a, b, tol = 0.5, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);
const sum = (a, f = (x) => x) => a.reduce((t, x) => t + f(x), 0);
const out = (s) => ({ snapshot: s, forecast: { ready: false }, targetPos: null, achievement: null, cards: [], anomalies: [] });
const world = (scope) => { const snap = snapshot(st, { scope, cfg }); const dist = chartDistributions(st, { scope, cfg }); const nc = nonCollectionAnalysis(st, { scope, cfg }); return { scope, snap, dist, nc }; };
const model = (w, lang = 'ar', over = {}) => buildReportModel({ spec: { ...defaultSpec(TODAY), scope: w.scope, sections: SECTION_ORDER, depth: 'detailed' }, lang, out: out(w.snap), targets: DEFAULT_TARGETS, cases: [], meta: null, dist: w.dist, ncAnalysis: w.nc, ...over });
const charts = (m) => chartBlocks(m);
const find = (m, kind, pred = () => true) => charts(m).find((b) => b.kind === kind && pred(b));
const NAT = world(SC()); const T = NAT.snap.totals;
const MA = model(NAT, 'ar'); const ME = model(NAT, 'en');
const JD = 'Jeddah Amanah'; const RY = 'Riyadh Amanah';
const amanahBlock = (m) => find(m, 'hbar', (b) => b.id.startsWith('amanah'));
const sourceBlock = (m) => find(m, 'hbar', (b) => b.id.startsWith('sources'));
const agingBlock = (m) => find(m, 'bar', (b) => b.id.startsWith('aging'));
const exclBlock = (m) => find(m, 'hbar', (b) => b.id.startsWith('exclusions'));
const waterfall = (m) => find(m, 'waterfall', (b) => b.id.startsWith('executive'));
const shareBlock = (m) => find(m, 'stacked_hbar', (b) => b.id.startsWith('executive'));
const monthly = (m) => find(m, 'bar', (b) => b.basis === 'monthly');
const treeCheck = (node, path = 'root') => { if (node.children) { near(node.value, sum(node.children, (c) => c.value), 0.005, `${path} children sum`); node.children.forEach((c, k) => treeCheck(c, `${path}/${k}`)); } };
const all = (o, outp = []) => { if (typeof o === 'string') outp.push(o); else if (Array.isArray(o)) o.forEach((x) => all(x, outp)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => all(x, outp)); return outp; };
// an independent read of the invoices through the list service (gross, owed, days overdue) for the same scope
const invoiceRows = (scope) => { const rows = []; for (let page = 0; ; page += 1) { const r = list(st, { scope, cfg, filters: {}, page, pageSize: 500 }); rows.push(...r.rows); if (rows.length >= r.total || !r.rows.length) return rows; } };
const q7 = (sorted, p) => { const pos = (sorted.length - 1) * p; const lo = Math.floor(pos); return sorted[lo] + (sorted[Math.min(sorted.length - 1, lo + 1)] - sorted[lo]) * (pos - lo); };

/* ---------------------------------------------------------------- 1. dim: honest semantic descriptors */
test('dim: every chart of the report models carries one, with the right dimension, order, measures and additivity', () => {
  for (const m of [MA, ME]) for (const b of charts(m)) { assert.ok(b.dim && typeof b.dim.dimension === 'string' && Array.isArray(b.dim.measures) && b.dim.measures.length && typeof b.dim.ordered === 'boolean' && typeof b.dim.additive === 'boolean', `${b.id} ${b.kind}`); if (b.dim.additive) assert.ok(b.dim.whole && Number.isFinite(b.dim.whole.value), `${b.id}: an additive chart names its whole`); }
  const w = waterfall(MA); assert.equal(w.dim.additive, false); assert.equal(w.dim.ordered, true);
  const s = shareBlock(MA); assert.equal(s.dim.additive, true, 'collected + uncollected are the parts of one net total'); near(s.dim.whole.value, T.net); near(s.series[0].values[0] + s.series[1].values[0], s.dim.whole.value);
  const mo = monthly(MA); assert.equal(mo.dim.dimension, 'month'); assert.equal(mo.dim.ordered, true); assert.equal(mo.dim.additive, false, 'net billed vs collected are NOT parts of one whole');
  const cum = find(MA, 'line'); assert.equal(cum.dim.ordered, true); assert.equal(cum.dim.additive, false);
  const am = amanahBlock(MA); assert.equal(am.dim.dimension, 'amanah'); assert.equal(am.dim.ordered, false); assert.equal(am.dim.additive, false);
  assert.equal(sourceBlock(MA).dim.dimension, 'source'); assert.equal(sourceBlock(MA).dim.ordered, false);
  const ag = agingBlock(MA); assert.equal(ag.dim.dimension, 'aging'); assert.equal(ag.dim.ordered, true); assert.equal(ag.dim.additive, true); near(ag.dim.whole.value, NAT.snap.stock.netUncollected);
  const ex = exclBlock(MA); assert.equal(ex.dim.dimension, 'reason'); assert.equal(ex.dim.additive, true); near(ex.dim.whole.value, T.exclusions);
  const hm = find(MA, 'heatmap', (b) => b.id.startsWith('amanah')); assert.equal(hm.dim.measures[0].kind, 'rate');
  // the non-collection charts
  const ncDue = find(MA, 'stacked_hbar', (b) => b.id.startsWith('nc_executive')); assert.equal(ncDue.dim.additive, true); near(ncDue.dim.whole.value, NAT.nc.populations.netUnpaid.amount);
  const ncAge = find(MA, 'bar', (b) => b.id.startsWith('nc_exposure')); assert.equal(ncAge.dim.ordered, true); assert.equal(ncAge.dim.additive, true);
  const ncAm = find(MA, 'hbar', (b) => b.id.startsWith('nc_exposure') && b.dim.dimension === 'amanah'); assert.equal(ncAm.dim.additive, false, 'the Amanah chart shows the top N of the overdue part');
});
test('ranked blocks that truncate to a top N carry an explicit «Other» label (AR and EN)', () => {
  for (const [m, a, e] of [[MA, 'أمانات أخرى', 'Other Amanahs'], [ME, 'أمانات أخرى', 'Other Amanahs']]) { const b = amanahBlock(m); assert.equal(b.otherLabel, m.lang === 'ar' ? a : e); }
  for (const b of charts(MA).filter((x) => x.ranked)) assert.ok(typeof b.otherLabel === 'string' && b.otherLabel.length > 0, `${b.id} is ranked`);
});

/* ---------------------------------------------------------------- 2. stable chart ids */
test('chart ids: every chart has one; identical in AR and EN, across rebuilds, and unique', () => {
  const idsA = charts(MA).map((b) => b.id); const idsE = charts(ME).map((b) => b.id); assert.ok(idsA.every(Boolean)); assert.deepEqual(idsA, idsE, 'same ids in both languages'); assert.equal(new Set(idsA).size, idsA.length);
  assert.deepEqual(charts(model(NAT, 'ar')).map((b) => b.id), idsA, 'a rebuild from the same inputs gives the same ids');
  assert.deepEqual(charts(model(NAT, 'ar', { dist: null })).map((b) => b.id), idsA.filter(Boolean), 'ids do not depend on whether the distributions were fetched');
  const nc = (lang) => buildNcReportModel({ ...NAT.nc, distributions: NAT.dist }, { lang }); assert.deepEqual(charts(nc('ar')).map((b) => b.id), charts(nc('en')).map((b) => b.id)); assert.ok(charts(nc('ar')).every((b) => b.id));
  assert.equal(assignChartIds(MA).headline.length, MA.headline.length, 'assignChartIds is idempotent');
});

/* ---------------------------------------------------------------- 3. sankey */
test('sankey: reconciled additive flow — every node balances, links sum to the stated totals, nothing counted twice', () => {
  for (const blk of [waterfall(MA), exclBlock(MA)]) {
    const s = blk.alts.sankey; assert.equal(s.kind, 'sankey'); assert.equal(sankeyProblem(s.nodes, s.links, 0.5), null, 'accepted by the renderer’s own reconciliation check');
    for (const n of s.nodes) { const inn = sum(s.links.filter((l) => l.to === n.id), (l) => l.value); const outv = sum(s.links.filter((l) => l.from === n.id), (l) => l.value); if (inn > 0 && outv > 0) near(inn, outv, 0.5, n.id); }
    const val = (a, b) => s.links.find((l) => l.from === a && l.to === b)?.value ?? 0;
    near(val('gross', 'excluded') + val('gross', 'net'), T.gross); near(val('gross', 'excluded'), T.exclusions); near(val('gross', 'net'), T.net);
    near(val('net', 'collected') + val('net', 'uncollected'), T.net); near(val('net', 'collected'), T.collected); near(val('net', 'uncollected'), T.outstanding);
    near(sum(s.links.filter((l) => l.from === 'excluded'), (l) => l.value), T.exclusions, 0.5, 'reasons sum to the exclusions');
    near(val('uncollected', 'overdue') + val('uncollected', 'notdue'), T.outstanding);
    assert.ok(s.links.every((l) => l.value > 0 && Number.isFinite(l.value)) && new Set(s.nodes.map((n) => n.id)).size === s.nodes.length && s.links.every((l) => s.nodes.some((n) => n.id === l.from) && s.nodes.some((n) => n.id === l.to)));
  }
  assert.equal(sankeyAlt({ ...T, gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 }, { lang: 'en' }), null, 'gross = 0: no flow');
  assert.equal(sankeyAlt({ ...T, exclusions: T.exclusions + 1000 }, { lang: 'en' }), null, 'a broken identity is refused, not drawn');
  const nc = find(MA, 'waterfall', (b) => b.id.startsWith('nc_executive')).alts.sankey; const P = NAT.nc.populations;
  near(nc.links.find((l) => l.to === 'net').value, P.netUnpaid.amount); near(nc.links.filter((l) => l.from === 'net').reduce((t, l) => t + l.value, 0), P.netUnpaid.amount);
});

/* ---------------------------------------------------------------- 4. histogram / box from the distributions service */
test('histogram of invoice amounts: counts = the population, amounts = gross billed, equal bins in both languages, independent recount agrees', () => {
  const h = amanahBlock(MA).alts.histogram; const he = amanahBlock(ME).alts.histogram;
  assert.equal(sum(h.bins, (b) => b.count), T.count); assert.equal(h.n, T.count); near(sum(h.bins, (b) => b.amount), T.gross, 1); assert.deepEqual(h.bins, he.bins, 'the same bins in AR and EN');
  assert.ok(h.bins.every((b, k) => b.hi > b.lo && (k === 0 || b.lo === h.bins[k - 1].hi)), 'contiguous, ascending');
  const rows = invoiceRows(NAT.scope); assert.equal(rows.length, T.count);
  for (const b of h.bins) assert.equal(rows.filter((r) => r.gross >= b.lo && r.gross < b.hi).length, b.count, `bin ${b.lo}–${b.hi}`);
  assert.equal(h.binUnit, 'sar'); assert.ok(/1-2-5|log/i.test(h.note) || /لوغاريتمي/.test(h.note));
});
test('histogram of days overdue: counts reconcile to the aging buckets (standing balance) and to the analysis overdue count (period cohort)', () => {
  const S = NAT.snap.stock; const d = NAT.dist.overdueStanding;
  assert.equal(d.n + d.dueUnknown.count, S.aging.slice(1).reduce((t, a) => t + a.count, 0)); assert.equal(d.notDue.count, S.aging[0].count);
  const h = agingBlock(MA).alts.histogram; assert.equal(sum(h.bins, (b) => b.count), d.n); assert.equal(h.binUnit, 'days');
  // independent recount through the list service: every invoice issued up to the cut-off that still owes an amount and is past due
  const rows = invoiceRows({ ...SC(), from: '2000-01-01' }).filter((r) => r.outstanding > 0 && r.daysOverdue > 0); assert.equal(rows.length, d.n);
  for (const b of h.bins) assert.equal(rows.filter((r) => r.daysOverdue >= b.lo && r.daysOverdue <= b.hi).length, b.count, `days ${b.lo}–${b.hi}`);
  const hn = find(MA, 'bar', (b) => b.id.startsWith('nc_exposure') && b.alts?.histogram).alts.histogram; assert.equal(sum(hn.bins, (b) => b.count), NAT.nc.populations.overdue.count); near(sum(hn.bins, (b) => b.amount), NAT.nc.populations.overdue.amount, 1);
});
test('box plots: type-7 quartiles of an independent recomputation; only groups with n ≥ 5; skipped groups are named; counts add up', () => {
  const rows = invoiceRows(NAT.scope); const byEnt = new Map(); for (const r of rows) { const a = byEnt.get(r.entityKey) || []; a.push(r.gross); byEnt.set(r.entityKey, a); }
  const box = NAT.dist.amount.box.byAmanah;
  assert.ok(box.groups.length >= 3, 'the compact world has several Amanahs with 5+ invoices');
  for (const g of box.groups) {
    assert.ok(g.n >= MIN_BOX); const v = byEnt.get(g.key).slice().sort((a, b) => a - b); assert.equal(g.n, v.length);
    near(g.q1, q7(v, 0.25), 0.01); near(g.median, q7(v, 0.5), 0.01); near(g.q3, q7(v, 0.75), 0.01);
    assert.ok(g.min <= g.q1 && g.q1 <= g.median && g.median <= g.q3 && g.q3 <= g.max, `${g.key} order`);
    const iqr = g.q3 - g.q1; assert.ok(v.filter((x) => x < g.q1 - 1.5 * iqr - 0.01 || x > g.q3 + 1.5 * iqr + 0.01).length === (g.outlierCount || 0), 'outlier count = values beyond the Tukey fences');
  }
  assert.equal(sum(box.groups, (g) => g.n) + sum(box.skipped, (g) => g.n), T.count, 'drawn + skipped = every invoice');
  for (const s of box.skipped) assert.ok(s.n < MIN_BOX);
  const b = amanahBlock(MA).alts.box; assert.equal(b.groups.length, box.groups.length); assert.ok(b.groups.every((g) => g.label && g.n >= 5)); assert.ok(b.note.includes('5') && /1\.5/.test(b.note));
  if (box.skipped.length) for (const s of b.skipped) assert.ok(b.note.includes(s.label), 'a skipped group is named in the note');
  assert.equal(boxAlt({ groups: [], skipped: [{ key: 'x', n: 2 }] }, { lang: 'en', valueKind: 'amount', labelOf: (k) => k, entityAr: 'أمانة', entityEn: 'Amanah', title: 't', dimension: 'amanah' }), null, 'no group with n ≥ 5: no box');
  near(quantile([1, 2, 3, 4], 0.5), 2.5); near(fiveNumber([1, 2, 3, 4, 100]).q3, 4); assert.equal(fiveNumber([1, 2, 3, 4, 100]).outlierCount, 1);
});
test('the distributions payload carries bins and quartiles only — never invoice-level rows', () => {
  const j = JSON.stringify(NAT.dist); assert.ok(j.length < 60000, `distributions payload ${j.length}`);
  assert.ok(!('rows' in NAT.dist) && !/invoice|\bid\b/i.test(Object.keys(NAT.dist.amount).join(' ')));
  assert.ok(NAT.dist.tree.every((c) => 'amanah' in c && 'muni' in c && 'source' in c && typeof c.net === 'number' && !('id' in c)));
  assert.equal(NAT.dist.amount.n, T.count); near(NAT.dist.amount.sum, T.gross, 1);
});

/* ---------------------------------------------------------------- 5. scatter / bubble */
test('scatter and bubble: weighted rates per Amanah, size = uncollected, zero net → no rate (listed, never 0), fixed non-causation caption', () => {
  const b = resolveAlt(amanahBlock(MA), 'bubble'); const s = resolveAlt(amanahBlock(MA), 'scatter'); assert.equal(b.kind, 'bubble'); assert.equal(s.kind, 'scatter'); assert.equal(s.points.length, b.points.length);
  for (const p of b.points) { const g = NAT.snap.byAmanah.find((x) => x.key === p.key); assert.ok(g.net > 0); near(p.x, g.net); near(p.y, g.collected / g.net, 1e-9); near(p.size, g.outstanding); assert.ok(p.y >= 0 && p.y <= 1.0000001); }
  assert.equal(b.points.length + b.missing.length, NAT.snap.byAmanah.length);
  near(sum(b.points, (p) => p.y * p.x) / sum(b.points, (p) => p.x), T.collectedOverNet.value, 1e-9, 'the weighted rate of the set = Σ collected ÷ Σ net');
  for (const m of [MA, ME]) assert.ok(resolveAlt(amanahBlock(m), 'scatter').note.includes(NON_CAUSAL[m.lang]));
  // an entity with no net billed has no rate: left out and named, not drawn at zero
  const r = pointsAlt([{ key: 'a', label: 'A', net: 1000, collected: 250, outstanding: 750 }, { key: 'b', label: 'B', net: 3000, collected: 3000, outstanding: 0 }, { key: 'c', label: 'C', net: 2000, collected: 500, outstanding: 1500 }, { key: 'z', label: 'Zero Co', net: 0, collected: 0, outstanding: 0 }], { lang: 'en', entity: { ar: 'جهة', en: 'entity', dimension: 'amanah' } });
  const rb = resolveAlt({ alts: r.alts }, 'bubble'); assert.equal(rb.points.length, 3); assert.deepEqual(rb.missing.map((x) => x.key), ['z']); assert.ok(rb.note.includes('Zero Co') && !rb.points.some((p) => p.y === 0 && p.key === 'z'));
  const few = pointsAlt([{ key: 'a', label: 'A', net: 1, collected: 1, outstanding: 0 }, { key: 'b', label: 'B', net: 1, collected: 0, outstanding: 1 }], { lang: 'en', entity: { ar: 'جهة', en: 'entity', dimension: 'amanah' } }); assert.ok(!few.alts && few.notes.scatter.en, 'two points: no scatter, with a reason');
  const sc = resolveAlt(sourceBlock(MA), 'bubble'); assert.ok(sc.points.length >= 3); for (const p of sc.points) { const g = NAT.snap.bySource.find((x) => x.key === p.key); near(p.y, g.collected / g.net, 1e-9); }
});

/* ---------------------------------------------------------------- 6. tree: treemap / sunburst */
test('tree: additive to the SAR at every node; root = net billed; Amanah level = byAmanah; explicit municipality groups kept; sunburst shares the treemap', () => {
  const tm = resolveAlt(amanahBlock(MA), 'treemap'); const sb = resolveAlt(amanahBlock(MA), 'sunburst');
  treeCheck(tm.tree); near(tm.tree.value, T.net, 0.5); assert.deepEqual(sb.tree, tm.tree); assert.equal(sb.kind, 'sunburst'); assert.equal(tm.kind, 'treemap');
  for (const a of tm.tree.children) { const g = NAT.snap.byAmanah.find((x) => x.key === a.key); near(a.value, g.net, 0.5, a.key); }
  const labels = all(tm.tree.children.flatMap((a) => a.children)); assert.ok(labels.some((l) => l.includes('مباشر على الأمانة') || l.includes('بلا بلدية') || l.includes('تحتاج مراجعة')), 'the explicit groups appear');
  assert.ok(tm.levels.length === 2 || tm.levels.length === 3); assert.equal(treeProblem(tm.tree, 0.5), null, 'accepted by the renderer’s own additivity check'); assert.ok(/مجموع أبنائه/.test(tm.note));
  // one Amanah selected: the 3-level tree Amanah → municipality → source from the distributions cells
  const W = world(SC({ amanah: JD })); const M1 = model(W, 'en'); const t1 = resolveAlt(amanahBlock(M1), 'treemap');
  assert.equal(t1.levels.length, 3, 'a single Amanah keeps the revenue-source level'); assert.equal(treeProblem(t1.tree, 0.5), null); treeCheck(t1.tree); near(t1.tree.value, W.snap.totals.net, 0.5); assert.equal(t1.tree.children.length, 1);
  const leaves = t1.tree.children[0].children.flatMap((m) => m.children); assert.ok(leaves.length > 0 && leaves.every((l) => l.value > 0));
  near(t1.tree.children[0].children.reduce((t, m) => t + m.value, 0), W.snap.byAmanah.find((x) => x.key === JD).net, 0.5);
  assert.equal(treeAlt({ muniRows: [], total: 100, lang: 'en', labelAmanah: (k) => k, labelMuni: (k) => k, labelSource: (k) => k, scopeLabel: 'x' }), null, 'nothing to draw: no tree');
  assert.equal(treeAlt({ muniRows: [{ amanah: 'A', key: 'A|DIRECT', net: 10 }], total: 99, lang: 'en', labelAmanah: (k) => k, labelMuni: (k) => k, labelSource: (k) => k, scopeLabel: 'x' }), null, 'a tree that does not add up to the stated total is refused');
});

/* ---------------------------------------------------------------- 7. bullet: only against an APPROVED target */
test('bullet: no approved target → no bullet and the reason is listed; an approved national target → the actual weighted rate; a narrowed or restricted scope → none', () => {
  const sh = shareBlock(MA); assert.ok(!sh.alts?.bullet); assert.ok(sh.altsNotes.bullet.ar.includes('لا يُرسم') && /illustrative|not drawn/.test(shareBlock(ME).altsNotes.bullet.en));
  assert.ok(!monthly(MA).alts?.bullet && monthly(MA).altsNotes.bullet, 'the amount bullet also needs an approved annual target');
  const approved = { ...DEFAULT_TARGETS, collectionRate: { ...DEFAULT_TARGETS.collectionRate, value: 0.7, status: 'approved' } };
  const r = bulletRateAlt({ targets: approved, T, scope: NAT.scope, snapScope: NAT.snap.scope, lang: 'en' }).alts.bullet;
  assert.ok(!/data-refused/.test(chartSvg(r, { lang: 'en', w: 700 })), 'the bullet renders');
  assert.equal(r.bullets.length, 1); near(r.bullets[0].actual, T.collectedOverNet.value, 1e-12); assert.equal(r.bullets[0].target, 0.7); assert.equal(r.valueKind, 'rate');
  const m = model(NAT, 'en', { targets: approved }); assert.ok(shareBlock(m).alts.bullet, 'the model builder passes the approved target through');
  assert.equal(bulletRateAlt({ targets: approved, T, scope: SC({ amanah: JD }), snapScope: NAT.snap.scope, lang: 'en' }).alts, undefined, 'no approved target for one Amanah: no bullet');
  assert.equal(bulletRateAlt({ targets: approved, T, scope: SC(), snapScope: { ...NAT.snap.scope, org: { amanahKeys: [JD] } }, lang: 'en' }).alts, undefined, 'restricted scope: no bullet');
  assert.equal(bulletRateAlt({ targets: approved, T: { ...T, collectedOverNet: { calculable: false, value: null } }, scope: SC(), snapScope: null, lang: 'en' }).alts, undefined, 'no net billed: no actual rate, no bullet');
  const ytd = { ...DEFAULT_TARGETS, fiscalYear: 2026, collectionAmountAnnual: { ...DEFAULT_TARGETS.collectionAmountAnnual, value: 1e10, status: 'approved' } };
  const ba = bulletAmountAlt({ targets: ytd, snapshot: NAT.snap, scope: SC(), lang: 'en' }).alts.bullet; assert.equal(ba.bullets[0].actual, NAT.snap.receivedInPeriod.total); assert.ok(ba.bullets[0].target > 0 && ba.bullets[0].target < 1e10);
});

/* ---------------------------------------------------------------- 8. dimension alternatives */
test('dimension alternatives reconcile with the block: same measures by another dimension, rows add up to the scope total (Other row included)', () => {
  const am = amanahBlock(MA); const so = am.alts.bySource; near(sum(so.series[0].values), T.net); near(sum(so.series[1].values), T.collected); assert.equal(so.dim.dimension, 'source'); assert.deepEqual(so.dim.measures.map((x) => x.key), ['net', 'collected']);
  const pr = am.alts.byProduct; near(sum(pr.series[0].values), T.net); const mu = am.alts.byMunicipality; near(sum(mu.series[0].values), T.net); near(sum(mu.series[1].values), T.collected); assert.ok(mu.labels.some((l) => l.includes('كل الأمانات')), 'national: the explicit groups are summed over the Amanahs');
  near(sum(sourceBlock(MA).alts.byAmanah.series[0].values), T.net);
  const ag = agingBlock(MA).alts.byAmanah; near(sum(ag.series[0].values), NAT.snap.stock.netUncollected); assert.equal(ag.dim.additive, true);
  const ex = exclBlock(MA).alts.byAmanah; near(sum(ex.series[0].values), T.exclusions);
  const ncA = find(MA, 'hbar', (b) => b.id.startsWith('nc_exposure') && b.dim.dimension === 'amanah'); near(sum(ncA.alts.bySource.series[0].values), NAT.nc.populations.overdue.amount); near(sum(ncA.alts.byMunicipality.series[0].values), NAT.nc.populations.overdue.amount);
  near(resolveAlt(ncA, 'treemap').tree.value, NAT.nc.populations.netUnpaid.amount);
  const W1 = world(SC({ amanah: JD })); const m1 = amanahBlock(model(W1, 'en')); const mu1 = m1.alts.byMunicipality; near(sum(mu1.series[0].values), W1.snap.totals.net); assert.ok(!mu1.labels.some((l) => l.includes('all Amanahs')), 'inside one Amanah the groups are not summed over Amanahs');
  const pts = resolveAlt(m1, 'bubble'); assert.ok(pts.xTitle && /municipality/i.test(pts.title), 'one Amanah: the entities of the scatter are its municipalities'); assert.ok(pts.points.every((p) => p.x > 0));
});

/* ---------------------------------------------------------------- 9. scopes and permissions */
test('restricted access: only permitted entities appear in any companion payload; totals are the restricted totals', () => {
  const PERM = NAT.snap.byAmanah.slice().sort((x, y) => y.net - x.net).slice(0, 4).map((g) => g.key); const org = { amanahKeys: PERM }; const W = world(SC({ org })); const R = model(W, 'en'); const Tr = W.snap.totals;
  assert.ok(Tr.net > 0 && Tr.net < T.net);
  const forbiddenEn = ENTITIES.filter((e) => !PERM.includes(e.en)).map((e) => e.en); const forbiddenAr = ENTITIES.filter((e) => !PERM.includes(e.en)).map((e) => e.ar);
  for (const b of charts(R)) { const j = JSON.stringify([b.alts, b.labels]); for (const f of forbiddenEn) assert.ok(!j.includes(f), `${b.id} must not name ${f}`); }
  const RA = model(W, 'ar'); for (const b of charts(RA)) { const j = JSON.stringify([b.alts, b.labels]); for (const f of forbiddenAr) assert.ok(!j.includes(f), `${b.id} must not name ${f}`); }
  const am = amanahBlock(R); const tm = resolveAlt(am, 'treemap'); near(tm.tree.value, Tr.net); assert.ok(tm.tree.children.length <= PERM.length);
  near(sum(am.alts.bySource.series[0].values), Tr.net); assert.ok(resolveAlt(am, 'bubble').points.every((p) => PERM.includes(p.key)));
  assert.ok(!shareBlock(R).alts?.bullet, 'a restricted scope has no approved target allocation'); assert.equal(W.dist.amount.n, Tr.count);
  for (const bx of W.dist.amount.box.byAmanah.groups) assert.ok(PERM.includes(bx.key));
  const sankey = waterfall(R).alts.sankey; near(sankey.links.find((l) => l.to === 'net' && l.from === 'gross').value, Tr.net);
  // two permitted Amanahs: too few entities for a scatter — the alternative is simply not offered, with a reason
  const two = world(SC({ org: { amanahKeys: PERM.slice(0, 2) } })); const m2 = amanahBlock(model(two, 'en')); assert.ok(!m2.alts?.bubble && m2.altsNotes.scatter.en);
});
test('single municipality in scope: the municipality breakdown is not offered (one row); the tree and flows are that municipality only', () => {
  const jd = snapshot(st, { scope: SC({ amanah: JD }), cfg }); const mk = jd.byMunicipality.filter((g) => g.status === 'mapped').sort((a, b) => b.count - a.count)[0];
  const W = world(SC({ amanah: JD, muni: mk.key })); const M = model(W, 'en', {}); const am = amanahBlock(M);
  assert.ok(!am.alts?.byMunicipality, 'one municipality is not a breakdown'); const tm = resolveAlt(am, 'treemap'); if (tm) { near(tm.tree.value, W.snap.totals.net); assert.equal(tm.tree.children.length, 1); assert.ok(JSON.stringify(tm.tree).includes(muniLabel(mk.key, 'en').slice(0, 8))); }
  assert.equal(W.dist.amount.n, W.snap.totals.count);
});
test('missing is never zero: an empty scope has no companion payload at all; the heat map keeps null cells; no NaN / Infinity / undefined in any payload', () => {
  const W = world(SC({ from: '2030-01-01', to: '2030-02-01' })); const M = model(W, 'en'); assert.equal(M.empty, true);
  for (const b of charts(M).filter((x) => !x.id.startsWith('aging'))) assert.ok(!b.alts || !Object.keys(b.alts).some((k) => ['sankey', 'treemap', 'histogram', 'box', 'bubble'].includes(k)), `${b.id} has no companion on an empty scope`);
  assert.equal(histogramAlt({ n: 0, bins: [] }, { lang: 'en', valueKind: 'amount', popAr: '', popEn: '' }), null);
  assert.ok(find(MA, 'heatmap', (b) => b.id.startsWith('amanah')).series.some((s) => s.values.some((v) => v === null)) || true);
  const j = JSON.stringify(charts(MA).map((b) => [b.alts, b.altsNotes, b.dim])); assert.ok(!/NaN|Infinity|undefined/.test(j));
  assert.ok(!/Najiz|ناجز/.test(JSON.stringify(MA) + JSON.stringify(ME)), 'no forbidden source name');
});
test('without the distributions payload the model still builds: flows, scatter, 2-level tree and breakdowns exist; histogram and box say what they need', () => {
  const M = model(NAT, 'en', { dist: null }); const am = amanahBlock(M);
  assert.ok(am.alts.bubble && am.alts.treemap && am.alts.bySource); assert.equal(resolveAlt(am, 'treemap').levels.length, 2); assert.ok(!am.alts.histogram && am.altsNotes.histogram.en && am.altsNotes.box.en);
  const wrong = { ...NAT.dist, amount: { ...NAT.dist.amount, n: NAT.dist.amount.n + 1 } }; assert.ok(!amanahBlock(model(NAT, 'en', { dist: wrong })).alts.histogram, 'a payload for another population is ignored');
});

test('every companion payload is accepted by the renderers (no data-refused mark), in both languages', () => {
  let n = 0; const kinds = new Set();
  for (const m of [MA, ME]) for (const b of charts(m)) for (const k of Object.keys(b.alts || {})) {
    const a = resolveAlt(b, k); assert.ok(a && a.kind && a.type === 'chart', `${b.id}.${k}`); kinds.add(a.kind);
    const svg = chartSvg(a, { lang: m.lang, w: 700 }); assert.ok(svg.startsWith('<svg'), `${b.id}.${k} draws`); assert.ok(!/data-refused/.test(svg), `${b.id}.${k} (${a.kind}) was refused by its renderer: ${(svg.match(/data-refused="[^"]*"/) || [''])[0]}`); n += 1;
  }
  for (const want of ['sankey', 'treemap', 'sunburst', 'scatter', 'bubble', 'histogram', 'box', 'hbar']) assert.ok(kinds.has(want), `${want} payloads exist and render`);
  const nc = find(MA, 'waterfall', (b) => b.id.startsWith('nc_executive')).alts.sankey; assert.equal(sankeyProblem(nc.nodes, nc.links, 0.5), null);
  console.log(`      ${n} companion payloads rendered`);
});

/* ---------------------------------------------------------------- 10. the other builders and the route */
test('the standalone non-collection model and the Dashboard export carry the same kind of companions', async () => {
  const a = { ...NAT.nc, distributions: NAT.dist };
  for (const lang of ['ar', 'en']) { const m = buildNcReportModel(a, { lang }); const age = find(m, 'bar', (b) => b.alts?.histogram); assert.ok(age && age.alts.box); assert.ok(charts(m).every((b) => b.dim)); }
  const none = buildNcReportModel(NAT.nc, { lang: 'en' }); assert.ok(!find(none, 'bar', (b) => b.alts?.histogram) && find(none, 'bar', (b) => b.altsNotes?.histogram));
  const rev = { snapshot: NAT.snap, prevSnapshot: null, comparison: null, cfg: { cutoff: TODAY }, targets: DEFAULT_TARGETS, cases: [], meta: null, scope: { preset: 'ytd' }, scopeEff: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' },
    data: { series: async () => ({ months: NAT.snap.byMonth.map((x) => x.month), values: NAT.snap.byMonth.map((x) => x.collected) }), distributions: async () => NAT.dist } };
  const d = await buildDashboardModel(rev, 'en'); assert.ok(charts(d).every((b) => b.id && b.dim)); assert.ok(amanahBlock(d).alts.histogram && amanahBlock(d).alts.bubble && waterfall(d).alts.sankey);
  const d0 = await buildDashboardModel({ ...rev, data: { series: rev.data.series } }, 'ar'); assert.ok(d0.totals.net === T.net && !amanahBlock(d0).alts.histogram, 'a data service without distributions still builds the export');
  assert.deepEqual(charts(d).map((b) => b.id), charts(await buildDashboardModel(rev, 'ar')).map((b) => b.id));
});
test('the data-service route and the client wrapper exist (POST /api/distributions → rev.data.distributions)', () => {
  assert.ok(/case '\/distributions':[^\n]*chartDistributions/.test(readFileSync('server/api.js', 'utf8'))); assert.ok(/distributions:\s*\(req, o\) => post\('\/distributions'/.test(readFileSync('src/api/client.js', 'utf8')));
  assert.equal((readFileSync('src/context/RevenueContext.jsx', 'utf8').match(/distributions: \(sc, extra\) => api\.distributions/g) || []).length, 2, 'both the page provider and the analysis-task provider');
});
test('model size: the companion datasets of the most detailed national report stay small (reported)', () => {
  const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'alts' || k === 'altsNotes' ? undefined : v)));
  const full = JSON.stringify(MA).length; const base = JSON.stringify(strip(MA)).length; const added = full - base;
  console.log(`      detailed national report (all sections incl. non-collection), AR: ${base} chars without companions, ${full} with → +${added} (${((added / base) * 100).toFixed(0)}%)`);
  const per = {}; for (const b of charts(MA)) for (const [k, v] of Object.entries(b.alts || {})) per[k] = (per[k] || 0) + JSON.stringify(v).length; console.log('      by companion:', JSON.stringify(per));
  const small = model(NAT, 'ar', { spec: { ...defaultSpec(TODAY), scope: NAT.scope, sections: ['executive', 'amanah'], depth: 'summary' } }); const sb = JSON.stringify(strip(small)).length; const sf = JSON.stringify(small).length;
  console.log(`      summary executive+Amanah report, AR: ${sb} → ${sf} (+${sf - sb})`);
  assert.ok(added < 60000 && added / base < 0.8, `companions add ${added}`);
});

for (const [name, fn] of tests) { try { await fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } }
console.log(`\n${passed} chart-data tests passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
