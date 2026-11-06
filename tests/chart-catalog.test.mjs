// Tests of the chart catalog, the compatibility rules, the chart config, the per-chart view and its persistence (src/data/chartCatalog.js, chartConfig.js, reportView.js, reportStore.js).
// Synthetic numbers only. Run: npm run test:chartcatalog
import assert from 'node:assert/strict';
import { CHART_TYPES, PURPOSES, chartOptions, evaluateChart, recommendedKind, defaultConfig, isAdditiveTree, sankeyReconciles, typeById, chartPreview } from '../src/data/chartCatalog.js';
import { chartDimensions, applyChartConfig, configChanges, normalizeConfig, patchConfig, waterfallReconciles, histogramCheck, boxDrawable, treeDepth } from '../src/data/chartConfig.js';
import { applyView, emptyView, viewIsDefault, mergeView, setChartConfig, resetChart, cleanView, exportPlan, hasCharts } from '../src/data/reportView.js';
import { createStore, makeRecord, modelOfRecord, userKeyOf } from '../src/data/reportStore.js';
import { chartTableText } from '../src/data/reportFormat.js';
import { chartSvg, DRAW_KINDS } from '../src/utils/chartKinds.js';
import { PPTX_SUPPORT, PPTX_FALLBACK_NOTE } from '../src/utils/pptxCharts.js';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan (the seed is the 2026 reference)

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };
const B = 1e9; const M = 1e6;
const sum = (a) => a.reduce((t, v) => (Number.isFinite(v) ? t + v : t), 0);
const sums = (b) => b.series.map((s) => sum(s.values));
const clone = (x) => JSON.parse(JSON.stringify(x));
const ids = (o) => o.available.map((x) => x.id);
const un = (o, id) => o.unavailable.find((x) => x.id === id);
const both = (r) => r && typeof r.ar === 'string' && typeof r.en === 'string' && r.ar.length > 8 && r.en.length > 8;

/* ---------------- representative blocks ---------------- */
const amanahs = ['Riyadh', 'Jeddah', 'Eastern', 'Madinah', 'Qassim', 'Asir', 'Tabuk', 'Hail'];
const amAm = () => ({ dimension: 'amanah', ordered: false, additive: false, measures: [{ key: 'net', kind: 'amount' }, { key: 'collected', kind: 'amount' }] });
const byAmanah = () => ({ type: 'chart', kind: 'hbar', ranked: true, title: 'Net billed and collected by Amanah', labels: [...amanahs], series: [{ label: 'Net billed', values: [8, 7, 6, 5, 4, 3, 2, 1].map((x) => x * B) }, { label: 'Collected', values: [5, 5, 3, 3, 2, 2, 1, 0.5].map((x) => x * B) }], dim: amAm() });
const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
const monthly = () => ({ type: 'chart', kind: 'bar', basis: 'monthly', title: 'Net billed and collected by month', labels: [...months], series: [{ label: 'Net billed', values: [1.1, 1.3, 1.0, 1.2, 1.4, 1.1].map((x) => x * B) }, { label: 'Collected', values: [0.7, 0.9, 0.8, 0.8, 1.0, 0.8].map((x) => x * B) }], dim: { dimension: 'month', ordered: true, additive: false, measures: [{ key: 'net', kind: 'amount' }, { key: 'collected', kind: 'amount' }] } });
const withRate = () => { const b = monthly(); b.series.push({ label: 'Collection rate', values: [0.64, 0.69, 0.8, 0.67, 0.71, 0.73] }); b.dim.measures.push({ key: 'rate', kind: 'rate' }); return b; };
const additiveByAmanah = () => ({ type: 'chart', kind: 'bar', title: 'Collected and uncollected by Amanah', labels: amanahs.slice(0, 5), series: [{ label: 'Collected', values: [5, 5, 3, 3, 2].map((x) => x * B), role: 'collected' }, { label: 'Uncollected', values: [3, 2, 3, 2, 2].map((x) => x * B), role: 'uncollected' }], dim: { dimension: 'amanah', ordered: false, additive: true, measures: [{ key: 'collected', kind: 'amount' }, { key: 'uncollected', kind: 'amount' }] } });
const partsOneRow = () => ({ type: 'chart', kind: 'stacked_hbar', title: 'Collected and uncollected of net billed', labels: ['Net billed'], series: [{ label: 'Collected', values: [7.5 * B], role: 'collected' }, { label: 'Uncollected', values: [3.5 * B], role: 'uncollected' }] });
const waterfall = () => ({ type: 'chart', kind: 'waterfall', title: 'Gross to net', labels: ['Gross', 'Exclusions', 'Net'], series: [{ label: 'Value', values: [14 * B, -3 * B, 11 * B] }], totals: [true, false, true] });
const negatives = () => ({ type: 'chart', kind: 'bar', title: 'Adjustments', labels: ['A', 'B', 'C', 'D'], series: [{ label: 'Adjustment', values: [4 * M, -2 * M, 3 * M, -1 * M] }], dim: { dimension: 'reason', ordered: false, measures: [{ key: 'amount', kind: 'amount' }] } });
const oneMonth = () => ({ type: 'chart', kind: 'bar', basis: 'monthly', title: 'One month', labels: ['2026-06'], series: [{ label: 'Net billed', values: [1 * B] }, { label: 'Collected', values: [0.5 * B] }], dim: { dimension: 'month', ordered: true, measures: [{ key: 'net', kind: 'amount' }, { key: 'collected', kind: 'amount' }] } });
const longAr = Array.from({ length: 40 }, (_, i) => `أمانة منطقة الاختبار الطويلة رقم ${i + 1}`);
const forty = () => ({ type: 'chart', kind: 'bar', title: 'أربعون أمانة', labels: longAr, series: [{ label: 'صافي المفوتر', values: longAr.map((_, i) => (40 - i) * 10 * M) }], dim: { dimension: 'amanah', ordered: false, measures: [{ key: 'net', kind: 'amount' }], whole: { label: 'الإجمالي', value: sum(longAr.map((_, i) => (40 - i) * 10 * M)) } } });
const withNulls = () => ({ type: 'chart', kind: 'bar', basis: 'monthly', title: 'With a gap', labels: [...months], series: [{ label: 'Collected', values: [1 * B, null, 2 * B, 1.5 * B, null, 2 * B] }], dim: { dimension: 'month', ordered: true, measures: [{ key: 'collected', kind: 'amount' }] } });
const bySource = () => ({ type: 'chart', kind: 'hbar', title: 'Net billed by source', labels: ['SADAD', 'Baladi', 'Fines', 'Other'], series: [{ label: 'Net billed', values: [6 * B, 3 * B, 1 * B, 0.5 * B] }], dim: { dimension: 'source', ordered: false, measures: [{ key: 'net', kind: 'amount' }] } });
const noDim = () => ({ type: 'chart', kind: 'hbar', ranked: true, title: 'No dimension described', labels: ['A', 'B', 'C'], series: [{ label: 'X', values: [3, 2, 1] }] });
const flow = () => ({ nodes: [{ id: 'a', label: 'A', col: 0 }, { id: 'b', label: 'B', col: 0 }, { id: 'c', label: 'C', col: 1 }, { id: 'd', label: 'D', col: 2 }, { id: 'e', label: 'E', col: 2 }], links: [{ from: 'a', to: 'c', value: 50 }, { from: 'b', to: 'c', value: 30 }, { from: 'c', to: 'd', value: 60 }, { from: 'c', to: 'e', value: 20 }] });
const tree = () => ({ label: 'All', value: 100, children: [{ label: 'North', value: 60, children: [{ label: 'N1', value: 40 }, { label: 'N2', value: 20 }] }, { label: 'South', value: 40, children: [{ label: 'S1', value: 25 }, { label: 'S2', value: 15 }] }] });
const pts = (n2) => Array.from({ length: n2 }, (_, i) => ({ x: i + 1, y: (i + 1) * 2, label: `P${i}` }));

/* ---------------- the catalog itself ---------------- */
ok('catalog lists every family with names, use text, needs, export entry and a preview', () => {
  const want = ['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar', 'line', 'line_markers', 'area', 'stacked_area', 'combo', 'waterfall', 'pie', 'donut', 'treemap', 'sunburst', 'heatmap', 'scatter', 'bubble', 'histogram', 'box', 'pareto', 'bullet', 'sankey'];
  assert.deepEqual(CHART_TYPES.map((t) => t.id).sort(), [...want].sort()); assert.equal(new Set(CHART_TYPES.map((t) => t.id)).size, want.length);
  assert.deepEqual(PURPOSES.map((p) => p.id), ['comparison', 'trend', 'composition', 'distribution', 'relationship']);
  for (const t of CHART_TYPES) {
    assert.ok(PURPOSES.some((p) => p.id === t.purpose), t.id); assert.equal(typeof t.more, 'boolean'); assert.ok(t.ar && t.en && t.useAr.length > 10 && t.useEn.length > 10, t.id); assert.ok(/[؀-ۿ]/.test(t.ar) && !/[؀-ۿ]/.test(t.en), `${t.id}: names in the right language`);
    assert.ok(t.needs && typeof t.needs === 'object'); assert.equal(t.export.pdf, 'vector'); assert.equal(t.export.word, 'png'); assert.ok(['native', 'vector-image', 'table'].includes(t.export.pptx), t.id);
    if (t.export.pptx !== 'native') assert.ok(both(t.export.note), `${t.id}: a fallback is explained`); else assert.equal(t.export.note, null);
    assert.equal(t.previewSpec.kind, t.kind); assert.equal(t.previewSpec.type, 'chart');
  }
  assert.deepEqual(CHART_TYPES.filter((t) => t.more).map((t) => t.id).sort(), ['bubble', 'bullet', 'box', 'combo', 'histogram', 'pareto', 'sankey', 'stacked100_col', 'stacked100_hbar', 'sunburst', 'treemap'].sort());
  assert.equal(typeById('line_markers').markers, true); assert.equal(chartPreview('donut').kind, 'donut');
});
ok('every preview spec is a self-contained synthetic block that the renderer can draw (kinds that are registered)', () => {
  for (const t of CHART_TYPES) {
    if (!DRAW_KINDS().includes(t.kind)) continue; const svg = chartSvg(t.previewSpec, { lang: 'en' });
    assert.ok(svg.startsWith('<svg') && !/NaN|undefined|Infinity/.test(svg), `${t.id}: preview draws`);
  }
});

ok('the PowerPoint column of the catalog equals what the PowerPoint export really implements (PPTX_SUPPORT), with the same fallback wording', () => {
  for (const t of CHART_TYPES) {
    const real = PPTX_SUPPORT[t.kind]; assert.ok(real, `${t.kind}: PPTX_SUPPORT has an entry`); assert.equal(t.export.pptx, real === 'native-table' ? 'table' : real, t.id);
    if (PPTX_FALLBACK_NOTE[t.kind]) assert.deepEqual(t.export.note, PPTX_FALLBACK_NOTE[t.kind], `${t.id}: same fallback text`);
  }
});

/* ---------------- availability rules ---------------- */
ok('clustered bars of Amanahs: bars fine; a line/area/combo has «no meaningful order»; stacking not additive; a pie needs one measure', () => {
  const o = chartOptions(byAmanah()); assert.ok(ids(o).includes('bar') && ids(o).includes('hbar'));
  for (const id of ['line', 'line_markers', 'area', 'combo']) { const u = un(o, id); assert.ok(u && both(u.reason) && /order/i.test(u.reason.en) && /ترتيب/.test(u.reason.ar), id); }
  for (const id of ['stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar', 'stacked_area']) { const u = un(o, id); assert.ok(u && /overlap/i.test(u.reason.en), id); }
  for (const id of ['pie', 'donut']) assert.ok(un(o, id) && /measure/i.test(un(o, id).reason.en), id);
  assert.ok(un(o, 'waterfall') && un(o, 'sankey') && un(o, 'histogram') && un(o, 'box') && un(o, 'bullet') && un(o, 'sunburst'));
  assert.equal(o.available.length + o.unavailable.length, CHART_TYPES.length);
});
ok('net billed vs collected over months are NOT additive; collected + uncollected are', () => {
  assert.ok(!ids(chartOptions(monthly())).includes('stacked_col')); assert.ok(un(chartOptions(monthly()), 'stacked_col'));
  const o = chartOptions(additiveByAmanah()); for (const id of ['stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar']) assert.ok(ids(o).includes(id), id);
  assert.ok(un(o, 'line') && un(o, 'pie'), 'unordered axis, several categories × series');
  const sw = o.available.find((x) => x.id === 'stacked_col'); assert.ok(sw.changes.some((c) => c.key === 'grouping' && both(c)), 'grouped → stacked is stated');
  const p100 = o.available.find((x) => x.id === 'stacked100_col'); assert.ok(p100.changes.some((c) => c.key === 'percentage' && /100/.test(c.en)), '100 % states the percentage basis');
});
ok('role-tagged collected + uncollected are additive even without a dim', () => {
  const b = additiveByAmanah(); delete b.dim; assert.ok(ids(chartOptions(b)).includes('stacked_col'));
});
ok('a single category of additive parts can be a pie / donut (the parts are the series)', () => {
  const o = chartOptions(partsOneRow()); assert.ok(ids(o).includes('pie') && ids(o).includes('donut')); assert.equal(o.current, 'stacked_hbar');
  const r = evaluateChart(partsOneRow(), 'pie'); assert.ok(r.ok); assert.deepEqual(r.block.labels, ['Collected', 'Uncollected']); assert.equal(sum(r.block.series[0].values), 11 * B); assert.ok(r.changes.some((c) => c.key === 'aggregation'));
  assert.ok(!ids(chartOptions(partsOneRow())).includes('line'));
});
ok('pie / donut: one measure of nonnegative parts; negatives, nulls, a rate, a cumulative series, a zero total are refused with a reason', () => {
  assert.ok(ids(chartOptions(bySource())).includes('pie'));
  assert.ok(/negative/i.test(un(chartOptions(negatives()), 'pie').reason.en)); assert.ok(/negative/i.test(un(chartOptions(negatives()), 'donut').reason.en));
  assert.ok(/missing/i.test(un(chartOptions(withNulls()), 'pie').reason.en));
  const rate = bySource(); rate.dim.measures = [{ key: 'rate', kind: 'rate' }]; assert.ok(/rate/i.test(un(chartOptions(rate), 'pie').reason.en));
  const cum = monthly(); cum.basis = 'cumulative'; cum.series = [cum.series[0]]; assert.ok(un(chartOptions(cum), 'pie'));
  const zero = bySource(); zero.series[0].values = [0, 0, 0, 0]; assert.ok(/zero/i.test(un(chartOptions(zero), 'pie').reason.en));
  const exceed = bySource(); exceed.dim.whole = { label: 'All', value: 5 * B }; assert.ok(un(chartOptions(exceed), 'pie') && /total/i.test(un(chartOptions(exceed), 'pie').reason.en));
  assert.ok(un(chartOptions(noDim()), 'pie') && /not stated/i.test(un(chartOptions(noDim()), 'pie').reason.en), 'undescribed parts: unavailable rather than a wrong chart');
  assert.ok(evaluateChart(noDim(), 'pie', {}, { loose: true }).ok, 'the legacy global command gives the benefit of the doubt');
});
ok('pie with more than 8 parts groups the smallest in an explicit «Other» (nothing dropped)', () => {
  const b = forty(); const r = evaluateChart(b, 'pie', {}, { lang: 'ar' }); assert.ok(r.ok); assert.equal(r.block.labels.length, 8); assert.ok(/أخرى/.test(r.block.labels[7]));
  assert.ok(nearlyEq(sum(r.block.series[0].values), sum(b.series[0].values))); assert.ok(r.changes.some((c) => c.key === 'topn' && both(c)));
  assert.equal(r.block.otherIndex, 7); assert.ok(chartTableText(r.block, 'ar').rows.some((row) => /أخرى/.test(row[0])), 'the Other row is in the table too');
  assert.deepEqual(clone(b), clone(forty()), 'the base block is untouched');
});
ok('line / area: ordered axis, at least two points; area also needs no gaps and no negatives', () => {
  const o = chartOptions(monthly()); for (const id of ['line', 'line_markers']) assert.ok(ids(o).includes(id)); assert.ok(un(o, 'area') && /overlap/i.test(un(o, 'area').reason.en));
  const single = monthly(); single.series = [single.series[1]]; assert.ok(ids(chartOptions(single)).includes('area'));
  const o1 = chartOptions(oneMonth()); assert.ok(un(o1, 'line') && /two points/i.test(un(o1, 'line').reason.en)); assert.ok(ids(o1).includes('bar'));
  const g = chartOptions(withNulls()); assert.ok(ids(g).includes('line'), 'a gap in a line stays a gap'); assert.ok(un(g, 'area') && /missing/i.test(un(g, 'area').reason.en));
  assert.ok(un(chartOptions(negatives()), 'line'));
  const neg = monthly(); neg.series = [{ label: 'Adj', values: [1, -2, 3, 1, 1, 2].map((x) => x * M) }]; assert.ok(/negative/i.test(un(chartOptions(neg), 'area').reason.en));
});
ok('order inference: month-like and bucket labels count as ordered; an undescribed ranked bar does not', () => {
  const b = noDim(); b.labels = ['0–30', '31–60', '61–90']; assert.ok(ids(chartOptions(b)).includes('line'));
  const m2 = noDim(); m2.labels = ['Jan', 'Feb', 'Mar']; assert.ok(ids(chartOptions(m2)).includes('line'));
  assert.ok(un(chartOptions(noDim()), 'line'));
});
ok('combo: needs an ordered axis and two series; a rate goes on its own secondary axis', () => {
  const r = evaluateChart(withRate(), 'combo'); assert.ok(r.ok); const s = r.block.series; assert.deepEqual(s.map((x) => x.type), ['bar', 'bar', 'line']); assert.deepEqual(s.map((x) => x.axis), ['primary', 'primary', 'secondary']);
  assert.equal(r.block.axis2.kind, 'rate'); assert.ok(r.block.axis2.title.length > 2); assert.ok(r.changes.some((c) => c.key === 'aggregation'));
  const same = evaluateChart(monthly(), 'combo'); assert.ok(same.ok); assert.equal(same.block.axis2, undefined); assert.deepEqual(same.block.series.map((x) => x.type), ['bar', 'line']);
  assert.ok(!evaluateChart(byAmanah(), 'combo').ok); assert.ok(evaluateChart(oneMonth(), 'combo').ok === false, 'one point');
  const units = chartOptions(withRate()); assert.ok(un(units, 'hbar') && /different units/i.test(un(units, 'hbar').reason.en), 'an amount and a rate cannot share one axis');
});
ok('waterfall: never converted; only itself (and a valid view of the same reconciliation via alts); the reason points to the table', () => {
  const o = chartOptions(waterfall()); assert.deepEqual(ids(o), ['waterfall']); assert.equal(o.recommended, 'waterfall');
  for (const id of ['bar', 'hbar', 'line', 'pie', 'stacked_col', 'heatmap']) { const u = un(o, id); assert.ok(u && /reconciliation/i.test(u.reason.en) && /مطابقة/.test(u.reason.ar), id); }
  const w = waterfall(); w.alts = { sankey: flow() }; assert.deepEqual(ids(chartOptions(w)).sort(), ['sankey', 'waterfall']);
  const bar = monthly(); bar.alts = { waterfall: waterfall() }; assert.ok(ids(chartOptions(bar)).includes('waterfall')); assert.equal(evaluateChart(bar, 'waterfall').block.kind, 'waterfall');
  const bad = waterfall(); bad.series[0].values = [14 * B, -3 * B, 12 * B]; assert.equal(waterfallReconciles(bad), false); const bar2 = monthly(); bar2.alts = { waterfall: bad }; assert.ok(un(chartOptions(bar2), 'waterfall'));
  assert.equal(waterfallReconciles(waterfall()), true);
});
ok('heat map is a matrix: fixed; a heat map is offered from one measure across two dimensions', () => {
  const hm = { type: 'chart', kind: 'heatmap', valueKind: 'rate', title: 'Rate', labels: ['S1', 'S2'], series: [{ label: 'A1', values: [0.5, null] }, { label: 'A2', values: [0.6, 0.7] }] };
  assert.deepEqual(ids(chartOptions(hm)), ['heatmap']);
  const grid = { type: 'chart', kind: 'bar', title: 'Net by Amanah and source', labels: ['SADAD', 'Baladi', 'Fines'], series: [{ label: 'Riyadh', values: [3, 2, 1].map((x) => x * B) }, { label: 'Jeddah', values: [2, 1, 1].map((x) => x * B) }], dim: { dimension: 'source', seriesBy: 'dimension', ordered: false, measures: [{ key: 'net', kind: 'amount' }] } };
  const r = evaluateChart(grid, 'heatmap'); assert.ok(r.ok); assert.equal(r.block.valueKind, 'amount'); assert.deepEqual(sums(r.block), sums(grid));
  assert.ok(un(chartOptions(byAmanah()), 'heatmap'), 'net vs collected are two measures, not one measure across two dimensions');
});
ok('scatter needs two measures or saved points; bubble needs a size measure', () => {
  const o = chartOptions(byAmanah()); assert.ok(ids(o).includes('scatter')); assert.ok(un(o, 'bubble') && /size/i.test(un(o, 'bubble').reason.en));
  const r = evaluateChart(byAmanah(), 'scatter'); assert.ok(r.ok); assert.equal(r.block.points.length, 8); assert.equal(r.block.xTitle, 'Net billed'); assert.equal(r.block.yTitle, 'Collected'); assert.ok(r.changes.some((c) => /causation/i.test(c.en)));
  const three = byAmanah(); three.series.push({ label: 'Invoices', values: [80, 70, 60, 50, 40, 30, 20, 10] }); three.dim.measures.push({ key: 'count', kind: 'count' });
  const b = evaluateChart(three, 'bubble'); assert.ok(b.ok); assert.equal(b.block.points[0].size, 80); assert.equal(b.block.sizeKind, 'count');
  const one = noDim(); assert.ok(un(chartOptions(one), 'scatter'));
  const s = noDim(); s.alts = { scatter: { points: pts(5), xTitle: 'x', yTitle: 'y' } }; assert.ok(ids(chartOptions(s)).includes('scatter')); assert.equal(evaluateChart(s, 'scatter').block.points.length, 5);
  const few = noDim(); few.alts = { scatter: { points: pts(2) } }; assert.ok(un(chartOptions(few), 'scatter'));
  const cum = monthly(); cum.basis = 'cumulative'; assert.ok(un(chartOptions(cum), 'scatter'), 'running totals correlate trivially');
  const neg = byAmanah(); neg.series.push({ label: 'Neg', values: [1, 1, 1, 1, 1, 1, 1, -1] }); assert.ok(un(chartOptions(neg), 'bubble'), 'a negative size is invalid');
});
ok('histogram / box / bullet / sankey / sunburst / treemap need their saved data', () => {
  const base = byAmanah();
  for (const id of ['histogram', 'box', 'bullet', 'sankey', 'sunburst']) assert.ok(un(chartOptions(base), id) && both(un(chartOptions(base), id).reason), id);
  const withAlts = byAmanah(); withAlts.alts = {
    histogram: { bins: [{ lo: 0, hi: 10, count: 4 }, { lo: 10, hi: 20, count: 9 }], binUnit: 'days', xTitle: 'Days' }, box: { groups: [{ label: 'A', n: 12, min: 1, q1: 2, median: 3, q3: 4, max: 6 }, { label: 'B', n: 3, min: 1, q1: 2, median: 3, q3: 4, max: 6 }], valueTitle: 'Days', valueKind: 'days' },
    bullet: { bullets: [{ label: 'A', actual: 70, target: 90 }], valueTitle: 'v' }, sankey: flow(), sunburst: { tree: tree() }
  };
  const o = chartOptions(withAlts); for (const id of ['histogram', 'box', 'bullet', 'sankey', 'sunburst', 'treemap']) assert.ok(ids(o).includes(id), id);
  for (const id of ['histogram', 'box', 'bullet', 'sankey', 'sunburst']) assert.ok(o.available.find((x) => x.id === id).changes.some((c) => c.key === 'aggregation'), `${id} states it uses saved data`);
  assert.equal(evaluateChart(withAlts, 'sankey').block.kind, 'sankey'); assert.equal(evaluateChart(withAlts, 'sankey').block.links.length, 4);
  assert.equal(evaluateChart(withAlts, 'sunburst').block.tree.value, 100);
  // not valid
  const bad = byAmanah(); bad.alts = { histogram: { bins: [{ lo: 0, hi: 10, count: 1 }, { lo: 5, hi: 15, count: 1 }] }, box: { groups: [{ label: 'A', n: 4, min: 1, q1: 2, median: 3, q3: 4, max: 5 }] }, bullet: { bullets: [{ label: 'A', actual: 1, target: 2 }], targetApproved: false }, sankey: { ...flow(), links: [...flow().links.slice(0, 3), { from: 'c', to: 'e', value: 10 }] }, sunburst: { tree: { ...tree(), value: 101 } } };
  const ob = chartOptions(bad); for (const id of ['histogram', 'box', 'bullet', 'sankey', 'sunburst']) assert.ok(un(ob, id), `${id} refused`);
  assert.ok(/reconcile/i.test(un(ob, 'sankey').reason.en)); assert.ok(/at least 5/i.test(un(ob, 'box').reason.en)); assert.ok(/approved/i.test(un(ob, 'bullet').reason.en));
});
ok('validators: isAdditiveTree, sankeyReconciles (±0.5 SAR), histogram bins, box n ≥ 5, tree depth', () => {
  assert.equal(isAdditiveTree(tree()), true); assert.equal(isAdditiveTree({ ...tree(), value: 100.4 }), true); assert.equal(isAdditiveTree({ ...tree(), value: 101 }), false);
  const t2 = tree(); t2.children[0].children[1].value = 21; assert.equal(isAdditiveTree(t2), false); const t3 = tree(); t3.children[0].children[1].value = -20; assert.equal(isAdditiveTree(t3), false);
  assert.equal(isAdditiveTree({ label: 'x', value: 5 }), true); assert.equal(isAdditiveTree(null), false); assert.equal(treeDepth(tree()), 2);
  assert.equal(sankeyReconciles(flow()), true);
  const within = flow(); within.links[2].value = 60.4; assert.equal(sankeyReconciles(within), true);
  const off = flow(); off.links[2].value = 61; assert.equal(sankeyReconciles(off), false);
  const dup = flow(); dup.links.push({ from: 'a', to: 'c', value: 1 }); assert.equal(sankeyReconciles(dup), false, 'the same pair twice');
  const back = flow(); back.links.push({ from: 'd', to: 'a', value: 0 }); assert.equal(sankeyReconciles(back), false, 'a link right to left');
  const ghost = flow(); ghost.links[0].to = 'zzz'; assert.equal(sankeyReconciles(ghost), false); assert.equal(sankeyReconciles({}), false); assert.equal(sankeyReconciles(null), false);
  assert.equal(histogramCheck({ bins: [{ lo: 0, hi: 1, count: 2 }, { lo: 1, hi: 2, count: 3 }] }), true); assert.equal(histogramCheck({ bins: [{ lo: 0, hi: 2, count: 2 }, { lo: 1, hi: 3, count: 3 }] }), false); assert.equal(histogramCheck({ bins: [{ lo: 3, hi: 2, count: 2 }, { lo: 4, hi: 5, count: 3 }] }), false); assert.equal(histogramCheck({ bins: [{ lo: 0, hi: 1, count: 0 }, { lo: 1, hi: 2, count: 0 }] }), false);
  assert.equal(boxDrawable({ groups: [{ n: 5, min: 1, q1: 2, median: 3, q3: 4, max: 5 }, { n: 4, min: 1, q1: 2, median: 3, q3: 4, max: 5 }, { n: 9, min: 1, q1: 5, median: 3, q3: 4, max: 5 }] }), 1);
});
ok('pareto, treemap (flat) and recommended kinds', () => {
  const o = chartOptions(bySource()); for (const id of ['pareto', 'treemap', 'pie', 'donut']) assert.ok(ids(o).includes(id), id);
  const r = evaluateChart(forty(), 'pareto'); assert.ok(r.ok); assert.equal(r.block.series.length, 1); assert.equal(r.block.labels.length, 16, 'Top 15 + Other'); assert.ok(r.block.otherLabel); assert.ok(nearlyEq(sum(r.block.series[0].values), sum(forty().series[0].values)));
  const r2 = evaluateChart(forty(), 'treemap'); assert.ok(r2.ok); assert.equal(r2.block.tree.children.length, 40); assert.ok(nearlyEq(r2.block.tree.value, sum(forty().series[0].values))); assert.ok(isAdditiveTree(r2.block.tree));
  assert.ok(un(chartOptions(byAmanah()), 'pareto'), 'two measures');
  assert.equal(recommendedKind(forty()), 'hbar', '40 long labels: horizontal bars'); assert.equal(recommendedKind(monthly()), 'bar'); assert.equal(recommendedKind(waterfall()), 'waterfall');
  const badLine = byAmanah(); badLine.kind = 'line'; assert.equal(recommendedKind(badLine), 'bar', 'a line over Amanahs is steered to columns');
  assert.equal(chartOptions(forty()).recommended, 'hbar');
});
ok('treemap and sunburst use a saved additive hierarchy; a hierarchy that does not add up is refused', () => {
  const b = bySource(); b.alts = { sunburst: { tree: tree() } };
  const t = evaluateChart(b, 'treemap'); assert.ok(t.ok); assert.equal(t.block.tree.children.length, 2);
  const s = evaluateChart(b, 'sunburst'); assert.ok(s.ok); const flat = bySource(); flat.alts = { sunburst: { tree: { label: 'x', value: 5, children: [{ label: 'a', value: 5 }] } } }; assert.ok(!evaluateChart(flat, 'sunburst').ok, 'one level is not a sunburst');
  const four = { label: 'r', value: 1, children: [{ label: 'a', value: 1, children: [{ label: 'b', value: 1, children: [{ label: 'c', value: 1, children: [{ label: 'd', value: 1 }] }] }] }] }; const deep = bySource(); deep.alts = { sunburst: { tree: four } }; assert.ok(!evaluateChart(deep, 'sunburst').ok, 'more than three levels');
});
ok('unavailable options never throw (odd and hostile blocks, every type)', () => {
  const odd = [null, undefined, {}, { type: 'chart' }, { type: 'chart', kind: 'bar', labels: null, series: null }, { type: 'chart', kind: 'bar', labels: ['a'], series: [{ label: 'x' }] }, { type: 'chart', kind: 'bar', labels: ['a', 'b'], series: [{ label: 'x', values: [NaN, Infinity] }] }, { type: 'chart', kind: 'bar', labels: ['a', 'b'], series: [{ label: 'x', values: [null, null] }] },
    { type: 'chart', kind: 'unknown_kind', labels: ['a'], series: [] }, { type: 'chart', kind: 'pie', labels: ['a', 'b'], series: [{ label: 'x', values: [1, 1] }], dim: 'bad', alts: 'bad' }, { type: 'chart', kind: 'bar', labels: ['a', 'b'], series: [{ label: 'x', values: [1, 2] }], alts: { sankey: { nodes: 1, links: 'x' }, treemap: { tree: 5 }, scatter: { points: 'no' }, histogram: null, box: { groups: 3 } } }, { type: 'chart', kind: 'waterfall', labels: [], series: [] }];
  for (const b of odd) { const o = chartOptions(b); assert.equal(o.available.length + o.unavailable.length, CHART_TYPES.length); for (const t of CHART_TYPES) { const r = evaluateChart(b, t.id, { topN: 3, sort: 'desc', mode: 'share', cumulative: true, labels: true }); assert.equal(typeof r.ok, 'boolean'); if (!r.ok) assert.ok(both(r.reason), `${t.id}: reason`); } applyChartConfig(b, { kind: 'pie', topN: 2 }); configChanges(b, { kind: 'bar' }); recommendedKind(b); defaultConfig(b); }
  assert.ok(!evaluateChart(byAmanah(), 'nonsense').ok); assert.ok(!evaluateChart(byAmanah(), undefined, { kind: 'nonsense' }).ok);
});
ok('every unavailable type of every representative block has an AR + EN reason that names what is missing', () => {
  for (const mk of [byAmanah, monthly, withRate, additiveByAmanah, partsOneRow, waterfall, negatives, oneMonth, forty, withNulls, bySource, noDim]) { const o = chartOptions(mk()); for (const u of o.unavailable) assert.ok(both(u.reason), `${mk.name}/${u.id}`); assert.equal(o.available.length + o.unavailable.length, CHART_TYPES.length); assert.ok(ids(o).includes(o.current) || o.current === undefined, `${mk.name}: the current type is available`); assert.ok(ids(o).includes(o.recommended), `${mk.name}: recommended is available`); }
});

/* ---------------- config application ---------------- */
function nearlyEq(a, b) { return Math.abs(a - b) <= 1e-6 + 1e-9 * Math.max(Math.abs(a), Math.abs(b)); }
ok('Top N groups the remainder in an explicit «Other» row: summed, labelled, in the table, nothing dropped, the base untouched', () => {
  const base = byAmanah(); const before = clone(base); const r = evaluateChart(base, 'hbar', { topN: 3 }, { lang: 'en' }); assert.ok(r.ok);
  assert.equal(r.block.labels.length, 4); assert.deepEqual(r.block.labels.slice(0, 3), ['Riyadh', 'Jeddah', 'Eastern']); assert.match(r.block.labels[3], /^Other \(5\)$/);
  assert.ok(sums(r.block).every((s, i) => nearlyEq(s, sums(base)[i])), 'the sums are unchanged');
  assert.equal(r.block.series[1].values[3], (3 + 2 + 2 + 1 + 0.5) * B - 0, 'collected remainder'); assert.equal(r.block.series[0].values[3], (5 + 4 + 3 + 2 + 1) * B);
  assert.ok(r.changes.some((c) => c.key === 'topn' && both(c))); assert.ok(chartTableText(r.block, 'en').rows.some((row) => /Other/.test(row[0])));
  assert.deepEqual(base, before, 'the base is not mutated'); assert.equal(r.block.config.topN, 3);
  const ar = evaluateChart(base, 'hbar', { topN: 2 }, { lang: 'ar' }); assert.match(ar.block.labels[2], /^أخرى \(6\)$/);
  const nullRest = byAmanah(); nullRest.series[1].values = [5, 5, 3, null, null, null, null, null].map((x) => (x == null ? null : x * B)); const nr = evaluateChart(nullRest, 'bar', { topN: 3 }); assert.equal(nr.block.series[1].values[3], null, 'an Other made only of missing values stays missing');
  const all = evaluateChart(base, 'bar', { topN: 50 }); assert.equal(all.block.labels.length, 8, 'N ≥ categories folds nothing');
  const tw = evaluateChart(evaluateChart(base, 'bar', { topN: 3 }).block, 'bar', { topN: 3 }); assert.equal(tw.block.labels.length, 4);
});
ok('Top N / sort are ignored (with a reason) on a time axis and for rates; they never reorder months', () => {
  const r = evaluateChart(monthly(), 'bar', { topN: 3, sort: 'desc' }); assert.ok(r.ok); assert.deepEqual(r.block.labels, months); assert.deepEqual(r.ignored.map((x) => x.key).sort(), ['sort', 'topn']); r.ignored.forEach((x) => assert.ok(both(x)));
  const rate = byAmanah(); rate.dim.measures = [{ key: 'a', kind: 'rate' }, { key: 'b', kind: 'rate' }]; const rr = evaluateChart(rate, 'bar', { topN: 2 }); assert.equal(rr.block.labels.length, 8); assert.ok(rr.ignored.some((x) => x.key === 'topn'));
});
ok('sort: descending / ascending by the primary measure, alphabetical; parts of one whole are ranked by their total; sums unchanged', () => {
  const b = byAmanah(); b.labels = ['d', 'b', 'a', 'c', 'h', 'g', 'f', 'e']; const d = evaluateChart(b, 'bar', { sort: 'desc' }).block; assert.deepEqual(d.series[0].values, [...b.series[0].values].sort((x, y) => y - x)); assert.equal(d.labels[0], 'd');
  const a = evaluateChart(b, 'bar', { sort: 'asc' }).block; assert.equal(a.labels[0], 'e'); const l = evaluateChart(b, 'bar', { sort: 'label' }).block; assert.deepEqual(l.labels, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.equal(l.series[0].values[0], b.series[0].values[2], 'values follow their labels');
  const add = additiveByAmanah(); add.series[0].values = [1, 1, 1, 1, 1].map((x) => x * B); add.series[1].values = [1, 9, 3, 2, 2].map((x) => x * B); const s = evaluateChart(add, 'stacked_col', { sort: 'desc' }).block; assert.equal(s.labels[0], add.labels[1], 'ranked by the stack total');
  assert.ok(sums(s).every((x, i) => nearlyEq(x, sums(add)[i])));
});
ok('amount → share: each value ÷ its series total, named as a percentage; refused for rates / negatives / running totals', () => {
  const b = byAmanah(); const r = evaluateChart(b, 'bar', { mode: 'share' }, { lang: 'en' }); assert.ok(r.ok); assert.ok(r.block.plain); assert.ok(r.block.series.every((s) => nearlyEq(sum(s.values), 100))); assert.ok(r.changes.some((c) => c.key === 'percentage' && /denominator/i.test(c.en)));
  assert.match(r.block.valueTitle, /Share/); assert.equal(r.block.shareOf, 'series-total');
  const rate = byAmanah(); rate.dim.measures = [{ key: 'a', kind: 'rate' }, { key: 'b', kind: 'rate' }]; const rr = evaluateChart(rate, 'bar', { mode: 'share' }); assert.ok(rr.ok); assert.ok(rr.ignored.some((x) => x.key === 'percentage')); assert.ok(!rr.block.plain);
  const neg = evaluateChart(negatives(), 'bar', { mode: 'share' }); assert.ok(neg.ignored.some((x) => x.key === 'percentage'));
  const nul = withNulls(); const sh = evaluateChart(nul, 'bar', { mode: 'share' }).block; assert.equal(sh.series[0].values[1], null, 'a missing value is not a 0 % share'); assert.ok(nearlyEq(sum(sh.series[0].values), 100));
});
ok('orientation, grouped ↔ stacked and 100 % pick the member of the bar family; the changes say what changed', () => {
  const add = additiveByAmanah();
  assert.equal(evaluateChart(add, 'bar', { orientation: 'h' }).block.kind, 'hbar'); assert.equal(evaluateChart(add, 'bar', { grouping: 'stacked' }).block.kind, 'stacked_col'); assert.equal(evaluateChart(add, 'bar', { grouping: 'stacked', orientation: 'h' }).block.kind, 'stacked_hbar');
  assert.equal(evaluateChart(add, 'bar', { grouping: 'stacked', mode: 'share' }).block.kind, 'stacked100_col'); assert.equal(evaluateChart(add, 'stacked_col', { mode: 'share' }).typeId, 'stacked100_col'); assert.equal(evaluateChart(add, 'stacked100_hbar', { mode: 'amount' }).typeId, 'stacked_hbar');
  const st = evaluateChart(add, 'stacked_col', { grouping: 'grouped' }); assert.equal(st.block.kind, 'bar');
  const back = evaluateChart(evaluateChart(add, 'stacked_col').block, 'bar'); assert.ok(back.changes.length === 0 || back.ok, 'back from the display block still works');
  const stBlock = { ...add, kind: 'stacked_col' }; assert.ok(evaluateChart(stBlock, 'bar').changes.some((c) => c.key === 'grouping'), 'stacked → grouped is stated');
  assert.ok(!evaluateChart(byAmanah(), 'bar', { grouping: 'stacked' }).ok, 'stacking non-additive series is refused through the modifier too');
  assert.deepEqual(patchConfig({ kind: 'bar', orientation: 'h', grouping: 'stacked', labels: false }, { kind: 'line' }), { kind: 'line', labels: false }, 'switching kind drops the old kind’s modifiers');
  assert.equal(defaultConfig(add).kind, 'bar'); assert.equal(defaultConfig({ ...add, kind: 'stacked100_hbar' }).mode, 'share'); assert.equal(defaultConfig({ ...add, kind: 'stacked100_hbar' }).orientation, 'h');
});
ok('monthly ↔ cumulative: only for saved monthly values; a running sum with the basis named; refused for gaps, rates, a cumulative base', () => {
  const b = monthly(); const r = evaluateChart(b, 'line', { cumulative: true }, { lang: 'en' }); assert.ok(r.ok); assert.equal(r.block.basis, 'cumulative'); assert.ok(/cumulative/i.test(r.block.title));
  let run = 0; assert.deepEqual(r.block.series[0].values, b.series[0].values.map((x) => (run += x))); assert.ok(nearlyEq(r.block.series[0].values.at(-1), sum(b.series[0].values)), 'the last value is the period total'); assert.ok(r.changes.some((c) => c.key === 'basis' && both(c)));
  assert.equal(b.basis, 'monthly'); assert.deepEqual(b.series[0].values[1], 1.3 * B, 'the saved block is untouched');
  const gap = evaluateChart(withNulls(), 'line', { cumulative: true }); assert.ok(gap.ignored.some((x) => x.key === 'cumulative') && gap.block.basis === 'monthly');
  const trailing = withNulls(); trailing.series[0].values = [1, 2, 3, 4, null, null].map((x) => (x == null ? null : x * B)); const tr = evaluateChart(trailing, 'line', { cumulative: true }); assert.equal(tr.block.basis, 'cumulative'); assert.deepEqual(tr.block.series[0].values.slice(4), [null, null], 'months not yet reported stay empty');
  const rate = evaluateChart(withRate(), 'combo', { cumulative: true }); assert.ok(rate.ignored.some((x) => x.key === 'cumulative'), 'a rate has no running sum');
  const cum = monthly(); cum.basis = 'cumulative'; const cr = evaluateChart(cum, 'line', { cumulative: false }); assert.ok(cr.ignored.some((x) => x.key === 'cumulative'));
  assert.ok(evaluateChart(bySource(), 'bar', { cumulative: true }).ignored.some((x) => x.key === 'cumulative'), 'categories are not months');
  assert.ok(evaluateChart(monthly(), 'pie', { cumulative: true }).ok === false);
});
ok('data labels and legend flags are explicit booleans (null = automatic); the renderers read showLabels / showLegend', () => {
  const b = byAmanah(); const auto = evaluateChart(b, 'bar', {}).block; assert.equal(auto.showLabels, undefined); assert.equal(auto.showLegend, undefined);
  const r = evaluateChart(b, 'bar', { labels: false, legend: true }).block; assert.equal(r.showLabels, false); assert.equal(r.showLegend, true); assert.equal(b.showLabels, undefined);
  assert.equal(applyChartConfig(b, { labels: true }).showLabels, true); assert.equal(applyChartConfig(b, { labels: null }).showLabels, undefined);
});
ok('applying a config twice gives the same block (idempotent), and an invalid request returns the base block', () => {
  const b = byAmanah(); const once = applyChartConfig(b, { kind: 'bar', topN: 3 }); const twice = applyChartConfig(once, { kind: 'bar', topN: 3 }); assert.equal(twice, once);
  assert.equal(applyChartConfig(b, { kind: 'pie' }), b, 'a pie of two unrelated measures is not applied'); assert.equal(applyChartConfig(waterfall(), { kind: 'bar' }).kind, 'waterfall'); assert.equal(applyChartConfig(null, {}), null);
  assert.equal(applyChartConfig(b, {}), b);
});
ok('another dimension only when the saved model already holds it', () => {
  const b = byAmanah(); b.alts = { bySource: { type: 'chart', kind: 'hbar', title: 'By source', labels: ['SADAD', 'Baladi'], series: [{ label: 'Net billed', values: [9 * B, 3 * B] }, { label: 'Collected', values: [5 * B, 1 * B] }] } };
  assert.deepEqual(chartDimensions(b), [{ id: 'source', current: false, altKey: 'bySource' }]); const r = evaluateChart(b, 'bar', { dimension: 'source' }); assert.equal(r.block.title, 'By source'); assert.ok(r.ok); assert.deepEqual(r.block.labels, ['SADAD', 'Baladi']); assert.ok(r.changes.some((c) => c.key === 'dimension')); assert.equal(r.block.dim.dimension, 'source', 'the description follows the new dimension'); assert.equal(r.block.dim.measures.length, 2, 'the measures stay');
  const no = evaluateChart(b, 'bar', { dimension: 'product' }); assert.ok(no.ignored.some((x) => x.key === 'dimension' && /new report version/i.test(x.en))); assert.deepEqual(no.block.labels, b.labels);
});
ok('normalizeConfig keeps only valid keys', () => {
  assert.deepEqual(normalizeConfig({ kind: 'pie', orientation: 'x', mode: 'share', grouping: 'stacked', cumulative: 'yes', sort: 'desc', topN: 3.7, labels: null, legend: false, dimension: '', junk: 1 }), { kind: 'pie', mode: 'share', grouping: 'stacked', sort: 'desc', topN: 3, legend: false });
  assert.deepEqual(normalizeConfig(null), {}); assert.deepEqual(normalizeConfig({ topN: 0 }), {});
});

/* ---------------- the view ---------------- */
const model = (lang = 'en') => ({ id: 'rpt', title: 'Test report', lang, headline: [{ type: 'kpis', items: [] }], sections: [{ key: 'trends', title: 'Trends', blocks: [monthly(), { type: 'table', headers: [], rows: [] }, withRate()] }, { key: 'rank', title: 'Rank', blocks: [byAmanah(), waterfall(), additiveByAmanah()] }] });
ok('emptyView / viewIsDefault / mergeView stay compatible and cover charts', () => {
  assert.equal(viewIsDefault(emptyView()), true); assert.equal(viewIsDefault(null), true); assert.equal(viewIsDefault({ chartKind: null, only: null }), true, 'a view stored before per-chart configs');
  assert.equal(viewIsDefault({ ...emptyView(), charts: { 'trends:0': { kind: 'line' } } }), false); assert.equal(viewIsDefault({ ...emptyView(), chartKind: 'line' }), false);
  const v = mergeView(emptyView(), { only: 'charts' }); assert.equal(v.only, 'charts'); assert.deepEqual(v.charts, {});
  const m = model(); assert.equal(hasCharts(m), true); const r = applyView(m, emptyView()); assert.equal(r.model, m); assert.equal(r.changed, 0); assert.equal(r.skipped, 0);
});
ok('per-chart configs apply to the saved model by stable chart id; the model data is never touched', () => {
  const m = model(); const before = clone(m);
  const v = setChartConfig(setChartConfig(emptyView(), 'trends:0', { kind: 'line' }), 'rank:0', { kind: 'hbar', topN: 3 });
  const r = applyView(m, v); assert.equal(r.skipped, 0); assert.ok(r.changed >= 2);
  const charts = r.model.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'chart');
  assert.equal(charts[0].kind, 'line'); assert.equal(charts[0].id, 'trends:0'); assert.equal(charts[1].kind, 'bar', 'untouched chart keeps its kind'); assert.equal(charts[2].id, 'rank:0'); assert.equal(charts[2].labels.length, 4); assert.ok(/Other/.test(charts[2].labels[3]));
  assert.deepEqual(m, before, 'the saved model is not mutated'); assert.equal(r.model.view, v);
  assert.ok(sums(charts[2]).every((s, i) => nearlyEq(s, sums(byAmanah())[i])), 'figures unchanged');
  assert.equal(applyView(m, v).model.sections[0].blocks[0].kind, 'line', 'deterministic');
});
ok('an incompatible per-chart config is skipped with a reason and the chart stays as saved', () => {
  const v = setChartConfig(emptyView(), 'rank:1', { kind: 'bar' }); const r = applyView(model(), v); assert.equal(r.skipped, 1); assert.equal(r.skippedList[0].chartId, 'rank:1'); assert.ok(both(r.skippedList[0].reason));
  assert.equal(r.model.sections[1].blocks[1].kind, 'waterfall');
  const bad = setChartConfig(emptyView(), 'rank:0', { kind: 'line' }); const rb = applyView(model(), bad); assert.equal(rb.skipped, 1); assert.equal(rb.model.sections[1].blocks[0].kind, 'hbar');
  const gone = setChartConfig(emptyView(), 'nowhere:9', { kind: 'line' }); assert.equal(applyView(model(), gone).changed, 0, 'a config for a chart that no longer exists is ignored');
});
ok('the global chartKind goes through the compatibility check: a reconciliation / matrix / running total is never converted, an unfit chart is skipped with a reason', () => {
  const m = model(); const line = applyView(m, { chartKind: 'line' }); const bl = line.model.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'chart');
  assert.equal(bl.find((b) => b.id === 'rank:1').kind, 'waterfall'); assert.ok(line.skippedList.some((x) => x.chartId === 'rank:1' && /reconciliation/i.test(x.reason.en)));
  const pie = applyView(m, { chartKind: 'pie' }); assert.ok(pie.skipped >= 1); const pl = pie.model.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'chart'); assert.ok(pl.every((b) => b.kind !== 'pie' || b.series.length === 1), 'a multi-series chart is not a pie');
  assert.ok(pie.skippedList.every((x) => both(x.reason)));
  const lineStrict = applyView(m, { chartKind: 'line' }); assert.ok(lineStrict.skippedList.some((x) => x.chartId === 'rank:0' && /order/i.test(x.reason.en)), 'a line over Amanahs (described as unordered) is refused');
  assert.equal(lineStrict.model.sections[1].blocks[0].kind, 'hbar');
  const und = { ...m, sections: [{ key: 'u', blocks: [noDim()] }] }; assert.equal(applyView(und, { chartKind: 'line' }).model.sections[0].blocks[0].kind, 'line', 'a chart with no dimension description keeps the old behaviour for the global command');
  const cum = { ...m, sections: [{ key: 'c', blocks: [{ ...monthly(), basis: 'cumulative' }] }] }; const cr = applyView(cum, { chartKind: 'pie' }); assert.equal(cr.model.sections[0].blocks[0].kind, 'bar'); assert.equal(cr.changed, 0);
});
ok('per-chart config is applied AFTER the global chartKind', () => {
  const m = { ...model(), sections: [{ key: 's', blocks: [monthly()] }] };
  const v = { ...emptyView(), chartKind: 'line', charts: { 's:0': { kind: 'bar', labels: false } } }; const b = applyView(m, v).model.sections[0].blocks[0]; assert.equal(b.kind, 'bar'); assert.equal(b.showLabels, false);
  const v2 = { ...emptyView(), chartKind: 'hbar', charts: { 's:0': { cumulative: true } } }; const b2 = applyView(m, v2).model.sections[0].blocks[0]; assert.equal(b2.kind, 'hbar'); assert.equal(b2.basis, 'cumulative');
});
ok('setChartConfig / resetChart / cleanView', () => {
  let v = setChartConfig(emptyView(), 'a:0', { kind: 'line', topN: 5, labels: null }); assert.deepEqual(v.charts['a:0'], { kind: 'line', topN: 5 });
  v = setChartConfig(v, 'b:0', { sort: 'desc' }); assert.deepEqual(Object.keys(v.charts).sort(), ['a:0', 'b:0']); const v2 = resetChart(v, 'a:0'); assert.deepEqual(Object.keys(v2.charts), ['b:0']); assert.ok('a:0' in v.charts, 'the old view is not mutated');
  assert.equal(viewIsDefault(resetChart(v2, 'b:0')), true); assert.equal(viewIsDefault(setChartConfig(emptyView(), 'a:0', {})), true);
  const b = monthly(); b.id = 'a:0'; const same = setChartConfig(emptyView(), 'a:0', { kind: 'bar', sort: 'none', mode: 'amount', orientation: 'v' }, b); assert.equal(viewIsDefault(same), true, 'a config equal to the chart’s own default stores nothing');
  const keep = setChartConfig(emptyView(), 'a:0', { kind: 'line', mode: 'amount' }, b); assert.deepEqual(keep.charts['a:0'], { kind: 'line' });
  assert.deepEqual(cleanView({ chartKind: 'bogus', only: 'x', charts: { a: { kind: 'pie', junk: 1 }, b: 5, c: {} } }), { chartKind: null, only: null, charts: { a: { kind: 'pie' } } }); assert.deepEqual(cleanView(undefined), emptyView());
});
ok('exportPlan lists how each chart of the viewed model is exported, with a note for a fallback', () => {
  const m = model(); const v = setChartConfig(emptyView(), 'trends:0', { kind: 'line' });
  const plan = exportPlan(m, v); assert.equal(plan.length, 5); assert.equal(plan[0].chartId, 'trends:0'); assert.equal(plan[0].typeId, 'line'); assert.equal(plan[0].pptx, 'native');
  for (const e of plan) { assert.equal(e.pdf, 'vector'); assert.equal(e.word, 'png'); assert.ok(['native', 'vector-image', 'table'].includes(e.pptx)); if (e.pptx !== 'native') assert.ok(both(e.note)); }
  assert.equal(plan.find((e) => e.typeId === 'waterfall').chartId, 'rank:1');
  const viewed = applyView(m, setChartConfig(emptyView(), 'trends:0', { kind: 'line' })).model; assert.deepEqual(exportPlan(viewed, null).map((e) => e.typeId), plan.map((e) => e.typeId), 'a viewed model is not viewed twice');
  const sk = { ...m, sections: [{ key: 'z', blocks: [{ ...byAmanah(), alts: { sankey: flow() } }] }] }; const sp = exportPlan(sk, setChartConfig(emptyView(), 'z:0', { kind: 'sankey' })); assert.equal(sp[0].typeId, 'sankey'); assert.equal(sp[0].pptx, 'vector-image'); assert.ok(both(sp[0].note));
  assert.deepEqual(exportPlan(null, null), []);
});

/* ---------------- persistence ---------------- */
function mem() { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => { m.delete(k); }, setItem: (k, v) => { m.set(k, String(v)); } }; }
ok('view.charts is stored with the conversation and each version and restored; the restored view reproduces the same displayed charts', () => {
  const uk = userKeyOf({ user: 'demo' }); const s = createStore({ storage: mem() });
  const m1 = model('en'); const m1ar = model('ar'); const rec = makeRecord({ msgId: 'a1', convId: 'c1', version: 1, generatedAt: '2026-11-06T09:00:00.000Z', cutoff: '2026-11-06', lang: 'en', spec: { scope: { from: '2026-01-01', to: '2026-06-30', amanah: 'all', source: 'all' } }, models: { en: { ...m1, alts: undefined }, ar: m1ar } });
  const v1 = setChartConfig(setChartConfig(emptyView(), 'trends:0', { kind: 'line', cumulative: true, labels: false }), 'rank:0', { kind: 'hbar', topN: 3, sort: 'desc' });
  const v2 = setChartConfig(v1, 'rank:2', { kind: 'stacked_col', mode: 'share' });
  const conv = { id: 'c1', title: 'T', createdAt: 1, updatedAt: 2, spec: null, messages: [{ id: 'u1', role: 'user', text: 'hi' }, { id: 'a1', role: 'assistant', kind: 'report', status: 'done', view: v1 }, { id: 'v2', role: 'assistant', kind: 'view', baseId: 'a1', view: v2, note: 'n', status: 'done' }] };
  assert.ok(s.saveConvs(uk, [conv]).ok); assert.ok(s.saveReports(uk, 'c1', { a1: rec }).ok);
  const back = s.listConvs(uk)[0]; const r = s.loadReports(uk, 'c1').records.a1;
  assert.deepEqual(back.messages[1].view, v1); assert.deepEqual(back.messages[2].view, v2); assert.deepEqual(JSON.parse(JSON.stringify(back.messages[2].view.charts)), v2.charts);
  for (const [lang, viewBack, viewOrig] of [['en', back.messages[2].view, v2], ['ar', back.messages[1].view, v1]]) {
    const saved = modelOfRecord(r, lang); const orig = lang === 'en' ? m1 : m1ar;
    const shownBack = applyView(saved, viewBack).model; const shownOrig = applyView({ ...orig, meta: saved.meta }, viewOrig).model;
    assert.equal(JSON.stringify(shownBack.sections.flatMap((x) => x.blocks)), JSON.stringify(shownOrig.sections.flatMap((x) => x.blocks)), `${lang}: the same displayed charts after restore`);
  }
  const shown = applyView(modelOfRecord(r, 'en'), back.messages[2].view).model.sections.flatMap((x) => x.blocks).filter((b) => b.type === 'chart');
  assert.equal(shown[0].kind, 'line'); assert.equal(shown[0].basis, 'cumulative'); assert.equal(shown[0].showLabels, false); assert.equal(shown[2].kind, 'hbar'); assert.equal(shown[2].labels.length, 4); assert.equal(shown[4].kind, 'stacked100_col');
  assert.equal(modelOfRecord(r, 'en').sections[0].blocks[0].kind, 'bar', 'the saved model itself is unchanged by a view');
});
ok('a damaged view in storage is reduced to its valid parts (never thrown, never shown)', () => {
  const uk = userKeyOf({ user: 'demo' }); const st = mem(); const s = createStore({ storage: st });
  const conv = { id: 'c1', title: 'T', createdAt: 1, updatedAt: 2, spec: null, messages: [{ id: 'a1', role: 'assistant', kind: 'view', baseId: 'x', view: { chartKind: 'zzz', only: 'tables', charts: { 'a:0': { kind: 'line', evil: () => 1, topN: NaN }, 'b:0': null } } }] };
  s.saveConvs(uk, [conv]); const v = s.listConvs(uk)[0].messages[0].view; assert.deepEqual(v, { chartKind: null, only: 'tables', charts: { 'a:0': { kind: 'line' } } });
  assert.doesNotThrow(() => applyView(model(), v));
});

/* ---------------- against the real report model (synthetic demo data) ---------------- */
ok('the real report model: every chart gets consistent options; its companions (alts) are accepted by the compatibility rules; a dimension switch keeps the figures', () => {
  process.env.DEMO_SIZE = 'compact'; const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
  const snap = snapshot(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg });
  const out = { snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: null, cards: [], anomalies: [] };
  const cash = { months: snap.byMonth.map((x) => x.month), values: snap.byMonth.map((x) => x.collected) };
  for (const lang of ['ar', 'en']) {
    const spec = { ...defaultSpec(TODAY), sections: SECTION_ORDER, depth: 'detailed', scope: { ...defaultSpec(TODAY).scope, from: '2026-01-01', to: TODAY } };
    const m = buildReportModel({ spec, lang, out, cash, targets: DEFAULT_TARGETS, cases: [], meta: { size: 'compact', counts: { invoicesTotal: st.n } } });
    const charts = m.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'chart'); assert.ok(charts.length >= 6);
    for (const b of charts) {
      const o = chartOptions(b); assert.equal(o.available.length + o.unavailable.length, CHART_TYPES.length); assert.ok(ids(o).includes(o.current) && ids(o).includes(o.recommended), b.id);
      for (const u of o.unavailable) assert.ok(both(u.reason), `${b.id}/${u.id}`);
      for (const k of Object.keys(b.alts || {})) { const id = ['sankey', 'scatter', 'bubble', 'treemap', 'sunburst', 'histogram', 'box', 'bullet'].includes(k) ? k : null; if (id) assert.ok(ids(o).includes(id), `${b.id}: the saved ${k} companion is accepted`); }
      if (b.kind === 'waterfall') assert.deepEqual(ids(o).sort(), b.alts?.sankey ? ['sankey', 'waterfall'] : ['waterfall']);
      if (b.kind === 'stacked_hbar') { assert.ok(ids(o).includes('pie') && ids(o).includes('stacked100_col') && !ids(o).includes('line')); const p = evaluateChart(b, 'pie'); assert.equal(sum(p.block.series[0].values), sum(b.series.map((s) => s.values[0]))); }
      const dims = chartDimensions(b); for (const d of dims) { const r = evaluateChart(b, typeIdOf0(b), { dimension: d.id }); assert.ok(r.ok && r.block.labels.length >= 2, `${b.id} → ${d.id}`); assert.ok(nearlyEq(sum(r.block.series[0].values), sum(b.alts[d.altKey].series[0].values)), 'the alternative dimension shows its own saved figures'); }
    }
    const am = charts.find((b) => b.id === 'amanah:0'); assert.ok(am && ['treemap', 'sunburst'].every((k) => ids(chartOptions(am)).includes(k)), 'Amanah → municipality → source hierarchy is offered');
    const sunburst = evaluateChart(am, 'sunburst'); assert.ok(sunburst.ok && isAdditiveTree(sunburst.block.tree) && treeDepth(sunburst.block.tree) >= 2);
    const topN = evaluateChart(am, 'hbar', { topN: 5, sort: 'desc' }); assert.equal(topN.block.labels.length, 6); assert.ok(sums(topN.block).every((x, i) => nearlyEq(x, sums(am)[i])), 'Top 5 + Other keeps the totals');
    // the whole chain on the real model: per-chart view → JSON → apply → export plan
    const view = setChartConfig(setChartConfig(emptyView(), 'amanah:0', { kind: 'treemap' }), 'exclusions:0', { kind: 'pie' }); const back = JSON.parse(JSON.stringify(view));
    const shown = applyView(m, back); assert.equal(shown.skipped, 0); assert.equal(shown.model.sections.flatMap((s) => s.blocks).find((b) => b.id === 'amanah:0').kind, 'treemap');
    const plan = exportPlan(m, back); assert.equal(plan.find((e) => e.chartId === 'amanah:0').pptx, 'vector-image'); assert.ok(plan.every((e) => ['native', 'vector-image', 'table'].includes(e.pptx)));
    assert.equal(applyView(m, { ...emptyView(), chartKind: 'line' }).model.sections.flatMap((s) => s.blocks).find((b) => b.id === 'executive:0').kind, 'waterfall');
  }
});
function typeIdOf0(b) { return b.kind === 'line' && b.markers ? 'line_markers' : b.kind || 'bar'; }

console.log(`chart-catalog tests: ${n} passed`);
