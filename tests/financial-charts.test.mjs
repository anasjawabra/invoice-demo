// The shared financial chart specification: reconciliation, zero denominators, partial payments, missing data, and the Dashboard export built from the dashboard's own snapshot.
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { grossToNetChart, collectedShareChart, cumulativeChart, agingChart } from '../src/data/financialCharts.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { buildDashboardModel, DASHBOARD_SECTIONS } from '../src/data/dashboardReport.js';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan (the seed is the 2026 reference)

process.env.DEMO_SIZE = 'compact';
let passed = 0; const test = (name, fn) => { try { fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } };
const asyncTests = [];
const atest = (name, fn) => asyncTests.push([name, fn]);
const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const scopeOf = (o = {}) => ({ from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', ...o });
const snap = snapshot(st, { scope: scopeOf(), cfg }); const T = snap.totals;
const out = (s) => ({ snapshot: s, forecast: { ready: false }, targetPos: null, achievement: null, cards: [], anomalies: [] });
const blocks = (m) => m.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'chart');
const model = (s, sections = SECTION_ORDER, lang = 'ar') => buildReportModel({ spec: { ...defaultSpec(TODAY), sections, depth: 'detailed' }, lang, out: out(s), targets: DEFAULT_TARGETS, cases: [], meta: null });

test('waterfall: gross − exclusions = net, totals anchored, and it reconciles with the KPIs', () => {
  const w = grossToNetChart(T, 'en'); const [g, x, n] = w.series[0].values;
  assert.equal(g, T.gross); assert.equal(x, -T.exclusions); assert.equal(n, T.net); assert.ok(Math.abs(g + x - n) < 1, 'gross + (−exclusions) = net'); assert.deepEqual(w.totals, [true, false, true]);
});
test('stacked bar: collected + uncollected = net billed (partial payments stay collected); not drawn with no net billed', () => {
  const s = collectedShareChart(T, 'ar'); const [c, u] = s.series.map((x) => x.values[0]); assert.ok(Math.abs(c + u - T.net) < 1);
  assert.equal(collectedShareChart({ ...T, net: 0, collected: 0, outstanding: 0 }, 'ar'), null, 'zero denominator: no chart, no 0%');
  assert.equal(grossToNetChart({ ...T, gross: 0 }, 'ar'), null);
});
test('cumulative line: running totals end at the period totals; one month or none → no chart (never invented)', () => {
  const c = cumulativeChart(snap.byMonth, 'en'); assert.equal(c.basis, 'cumulative');
  assert.ok(Math.abs(c.series[0].values.at(-1) - snap.byMonth.reduce((t, m) => t + m.net, 0)) < 1); assert.ok(Math.abs(c.series[1].values.at(-1) - snap.byMonth.reduce((t, m) => t + m.collected, 0)) < 1);
  for (const sr of c.series) assert.deepEqual(sr.values, [...sr.values].sort((a, b) => a - b), 'a running total never decreases');
  assert.equal(cumulativeChart(snap.byMonth.slice(0, 1), 'en'), null); assert.equal(cumulativeChart([], 'en'), null);
});
test('aging: only where a balance exists; the buckets add up to the standing balance', () => {
  const a = agingChart(snap.stock.aging, 'en', (l) => l.en || l); assert.ok(a); assert.ok(Math.abs(a.series[0].values.reduce((t, v) => t + v, 0) - snap.stock.aging.reduce((t, x) => t + x.amount, 0)) < 1);
  assert.equal(agingChart(snap.stock.aging.map((x) => ({ ...x, amount: 0 })), 'en'), null);
});
test('report model: the new kinds are emitted in the right sections, in both languages, with identical series', () => {
  const ar = model(snap, SECTION_ORDER, 'ar'); const en = model(snap, SECTION_ORDER, 'en');
  const kinds = (m) => blocks(m).map((b) => `${b.kind}${b.basis ? `:${b.basis}` : ''}`);
  assert.deepEqual(kinds(ar), kinds(en)); for (const k of ['waterfall', 'stacked_hbar', 'bar:monthly', 'line:cumulative', 'hbar', 'heatmap']) assert.ok(kinds(ar).includes(k), k);
  assert.deepEqual(blocks(ar).map((b) => b.series.map((s) => s.values)), blocks(en).map((b) => b.series.map((s) => s.values)), 'the same figures in both languages');
  const exec = ar.sections.find((s) => s.key === 'executive'); assert.ok(!exec.blocks.some((b) => b.type === 'relations'), 'no repeated relations block next to the waterfall');
});
test('charts follow the question: a sources-only report has no Amanah heat map, waterfall or cumulative line', () => {
  const m = model(snap, ['sources']); assert.deepEqual(blocks(m).map((b) => b.kind), ['hbar']);
});
test('heat map: a missing cell is null (never zero) and rates are fractions of net billed', () => {
  const h = blocks(model(snap)).find((b) => b.kind === 'heatmap'); assert.equal(h.valueKind, 'rate');
  const vals = h.series.flatMap((s) => s.values); assert.ok(vals.every((v) => v === null || (v >= 0 && v <= 1.0000001)), 'a rate is between 0 and 1'); assert.ok(h.series.length <= 12);
});
test('an empty selection draws no chart at all (the data is unavailable, not zero)', () => {
  const empty = snapshot(st, { scope: scopeOf({ from: '2030-01-01', to: '2030-02-01' }), cfg });
  const m = model(empty); assert.equal(m.empty, true); assert.equal(blocks(m).filter((b) => ['waterfall', 'stacked_hbar', 'line'].includes(b.kind)).length, 0);
});
test('one Amanah selected: no Amanah comparison heat map (a single row is not a comparison)', () => {
  const key = snap.byAmanah[0].key; const one = snapshot(st, { scope: scopeOf({ amanah: key }), cfg }); const m = model(one, ['amanah']);
  assert.ok(!blocks(m).some((b) => b.kind === 'heatmap'));
});
atest('the Dashboard export is built from the dashboard snapshot and filters: same totals, period, basis and cutoff', async () => {
  const rev = { snapshot: snap, prevSnapshot: null, comparison: null, cfg: { cutoff: TODAY }, targets: DEFAULT_TARGETS, cases: [], meta: null, scope: { preset: 'ytd' }, scopeEff: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' },
    data: { series: async () => ({ months: snap.byMonth.map((m) => m.month), values: snap.byMonth.map((m) => m.collected) }) } };
  const m = await buildDashboardModel(rev, 'en'); assert.equal(m.totals.gross, T.gross); assert.equal(m.totals.net, T.net); assert.equal(m.totals.collected, T.collected);
  assert.equal(m.cutoff, TODAY); assert.ok(m.context.some((c) => c.k === 'period' && c.value.includes('2026-01-01')) && m.context.some((c) => c.k === 'basis'));
  assert.deepEqual(m.sections.map((s) => s.key).filter((k) => DASHBOARD_SECTIONS.includes(k)), DASHBOARD_SECTIONS);
  const ar = await buildDashboardModel(rev, 'ar'); assert.equal(ar.lang, 'ar'); assert.equal(ar.totals.net, T.net);
  assert.ok(m._inputs, 'keeps its inputs so the other language is the same figures');
});
for (const [name, fn] of asyncTests) { try { await fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } }
console.log(`\n${passed} financial-chart tests passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
