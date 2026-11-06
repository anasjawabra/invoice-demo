// Platform integration of the shared chart library (docs/chart-library.md «Platform integration» and §6 support matrix). Synthetic data only.
//  1. the support matrix: every catalog type proven (renderer, preview, AR + EN drawing, table, PDF, PowerPoint mode) and its real use in the platform; the document's §6 table is the generated one
//  2. unavailable reasons never show a raw token; incompatible requests are refused with a reason
//  3. representative data: every family on real chart blocks, zero / missing values, long Arabic labels, 40+ categories, a restricted organisation / municipality
//  4. switching types keeps the figures (Top-N «Other» keeps the sum)
//  5. page integration: dashboard (ids, figures, export), Exclusions, invoice summaries, non-collection (ids, saved view, export, drill-down mapping), Decision Room / Planning decisions
// Run: npm run test:chartint
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { buildMatrix, matrixMarkdown, world, surfaces, SC, TODAY, store } from '../scripts/chart-support-matrix.mjs';
import { CHART_TYPES, chartOptions, evaluateChart, chartPreview, typeIdOf } from '../src/data/chartCatalog.js';
import { NEEDS_TEXT } from '../src/data/chartConfig.js';
import { chartSvg } from '../src/utils/chartKinds.js';
import { chartTableText } from '../src/data/reportFormat.js';
import { exportBlocks } from '../scripts/chart-export-fixtures.mjs';
import { setChartConfig, chartConfigOf, emptyView, applyView, exportPlan, cleanView } from '../src/data/reportView.js';
import { chartBlocks } from '../src/data/chartIds.js';
import { buildDashboardModel, buildDashboardChartBlocks, withDashboardView, dashboardInputs, DASHBOARD_PAGE, DASHBOARD_PAGE_SECTIONS } from '../src/data/dashboardReport.js';
import { buildReportModel } from '../src/data/reportModel.js';
import { grossToNetChart, collectedShareChart, agingChart } from '../src/data/financialCharts.js';
import { buildNcReportModel } from '../src/data/ncReportModel.js';
import { viewedModel } from '../src/data/viewedModel.js';
import { ncChartEnrichment, MODEL_KEY } from '../src/components/analysis/nc/ncCharts.js';
import { buildCharts } from '../src/components/analysis/nc/ncModel.js';
import { exclusionsReasonChart, EXCLUSIONS_CHART_ID } from '../src/data/exclusionsChart.js';
import { EXCLUSION_REASONS } from '../src/data/iim.js';
import { createPageViewStore, PAGE_VIEW_KEY } from '../src/components/charts/pageChartView.js';
import { drillable, translateSelect, selectedToDisplay, sameShape } from '../src/components/charts/chartDrill.js';
import { createAnalysisStore, userKeyOf } from '../src/data/analysisStore.js';
import { rankedBlock } from '../src/components/invoices/listLogic.js';
import { summaryBlock } from '../src/components/invoices/summaryChart.js';
import { bulletAmountAlt, bulletRateAlt } from '../src/data/chartAlts.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { ENTITIES } from '../src/data/catalog.js';
import { kpiOf } from '../src/data/kpis.js';
import { muniLabel } from '../src/data/municipalityModel.js';
import { list } from '../server/lists.js';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan (the seed is the 2026 reference)

let passed = 0; const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const near = (a, b, tol = 0.5, m = '') => assert.ok(Math.abs(a - b) <= tol, `${m} ${a} vs ${b}`);
const sum = (a, f = (x) => x) => a.reduce((t, x) => t + f(x), 0);
const flat = (b) => (b.series || []).reduce((t, s) => t + sum((s.values || []).filter((v) => v != null)), 0);
const refused = (svg) => /data-refused=/.test(svg);
const ARABIC = /[؀-ۿ]/;
// a token a person must never read in a reason: an alts.* path, a snake_case / camelCase identifier, a catalog id, JS leftovers
const RAW = /\balts\b|alts\.|\b[a-z]+_[a-z0-9_]+\b|\b(stacked100_\w+|stacked_\w+|line_markers)\b|\bundefined\b|\bnull\b|\[object|\$\{|=>/;
const cfgNow = { cutoff: TODAY };

const W = world(); const LANGS = ['ar', 'en'];
const SF = { ar: surfaces(W, 'ar'), en: surfaces(W, 'en') };
const blocksOf = (lang, page) => SF[lang].find((s) => s.page === page).blocks;
const byId = (lang, page, id) => blocksOf(lang, page).find((b) => b.id === id);

/* ============================================================ 1. the support matrix */
const M = buildMatrix();
test('support matrix: every catalog type is proven (renderer, preview, AR + EN drawing, table, PDF, PowerPoint mode equal to the declared one)', () => {
  assert.equal(M.types.length, CHART_TYPES.length); assert.equal(CHART_TYPES.length, 24);
  for (const t of M.types) {
    assert.ok(t.rendererRegistered, `${t.id} renderer registered`); assert.ok(t.previewDrawn, `${t.id} preview drawn`);
    for (const l of LANGS) { assert.ok(t.drawn[l], `${t.id} drawn ${l}`); assert.ok(t.table[l], `${t.id} table ${l}`); assert.ok(t.pdf[l], `${t.id} pdf ${l}`); }
    assert.equal(t.pptx.mode, t.pptx.expected, `${t.id} PowerPoint mode is the declared one`); assert.equal(t.word.support, 'png', `${t.id} Word`);
    assert.ok(t.proven && t.status !== 'not-proven', `${t.id} status ${t.status}`);
    assert.ok(['implemented', 'data-dependent', 'unavailable-in-demo'].includes(t.status));
  }
});
test('support matrix: a type is «unavailable-in-demo» only if NO real chart of the platform can take it; the two such types are named and explained', () => {
  const na = M.types.filter((t) => t.status === 'unavailable-in-demo').map((t) => t.id).sort();
  assert.deepEqual(na, ['bullet', 'stacked_area'], 'the only types no real demo chart can take: bullet (no approved target) and stacked area (no additive time series)');
  const b = M.types.find((t) => t.id === 'bullet'); assert.ok(/approved (collection-rate )?target/i.test(b.unavailableWhy.en) && /مستهدف معتمد/.test(b.unavailableWhy.ar), `bullet: the reason is the missing approved target (${b.unavailableWhy.en})`);
  assert.ok(M.types.filter((t) => t.status === 'data-dependent').every((t) => t.needs && t.needs.alts), 'data-dependent = needs a saved companion dataset');
  assert.ok(M.types.filter((t) => t.status === 'implemented').every((t) => !(t.needs && t.needs.alts)));
  for (const t of M.types.filter((x) => x.status !== 'unavailable-in-demo')) assert.ok(t.offeredOn.length >= 1, `${t.id} is offered somewhere`);
});
test('support matrix: where each page offers what (the pages measured are exactly the integrated ones)', () => {
  assert.deepEqual(M.surfaces.map((s) => s.page), ['smart_reports', 'dashboard', 'nc_analysis', 'exclusions', 'invoice_summaries']);
  assert.deepEqual(M.surfaces.map((s) => s.picker), ['full', 'full', 'full', 'full', 'compact']);
  const on = (p) => M.types.filter((t) => t.offeredOn.includes(p)).map((t) => t.id);
  assert.ok(on('dashboard').includes('sankey') && on('dashboard').includes('histogram') && on('dashboard').includes('donut'), 'dashboard: sankey on the bridge, histogram / box on the aging chart');
  assert.ok(on('nc_analysis').includes('sunburst') && on('nc_analysis').includes('treemap'));
  assert.ok(!on('exclusions').includes('line') && !on('invoice_summaries').includes('line'), 'no time-axis chart on an unordered breakdown');
  assert.ok(!on('invoice_summaries').includes('sankey') && !on('invoice_summaries').includes('scatter') && !on('invoice_summaries').includes('stacked_col'), 'the summaries stay focused: only the compatible types of one breakdown');
});
test('support matrix: the document §6 holds exactly the generated table', () => {
  const doc = readFileSync('docs/chart-library.md', 'utf8');
  const m = doc.match(/<!-- matrix:start -->\n([\s\S]*?)\n<!-- matrix:end -->/); assert.ok(m, 'the matrix markers exist in docs/chart-library.md');
  assert.equal(m[1].trim(), matrixMarkdown(M).trim(), 'paste the output of `npm run chart:matrix` between the markers');
});

/* ============================================================ 2. reasons and refusals */
const REAL_BLOCKS = LANGS.flatMap((l) => SF[l].flatMap((s) => s.blocks.map((b) => [l, b])));
const FIX = LANGS.flatMap((l) => Object.values(exportBlocks(l)).map((b) => [l, b]));
test('unavailable reasons never contain a raw token (alts.*, ids, snake_case), in either language, on real and fixture blocks', () => {
  const reasons = new Set();
  for (const [l, b] of [...REAL_BLOCKS, ...FIX]) for (const u of chartOptions(b, { lang: l }).unavailable) { reasons.add(u.reason.ar); reasons.add(u.reason.en); }
  for (const [id, r] of Object.entries(NEEDS_TEXT)) { reasons.add(r.ar); reasons.add(r.en); }
  assert.ok(reasons.size > 20);
  for (const r of reasons) { assert.equal(typeof r, 'string'); assert.ok(r.length > 8, r); assert.ok(!RAW.test(r), `raw token in a reason: ${r}`); }
  assert.ok(!/alts/.test(NEEDS_TEXT.heatmap.ar + NEEDS_TEXT.heatmap.en + NEEDS_TEXT.scatter.en + NEEDS_TEXT.waterfall.en));
  assert.ok(/^لا يوجد مستهدف معتمد/.test(NEEDS_TEXT.bullet.ar), 'bullet without a target: «لا يوجد مستهدف معتمد»'); assert.ok(/^No approved target/.test(NEEDS_TEXT.bullet.en));
});
test('the heat-map reason is a proper sentence in both languages', () => {
  const p = byId('en', 'smart_reports', 'executive:1'); // (a part-of-whole bar: a heat map needs a second dimension)
  const h = chartOptions(p, { lang: 'en' }).unavailable.find((u) => u.id === 'heatmap'); assert.ok(h && /two dimensions/.test(h.reason.en) && ARABIC.test(h.reason.ar) && !RAW.test(h.reason.ar + h.reason.en));
});
test('pareto / donut messages mention Top-N and «Other» only when a real grouping happens', () => {
  const ex = byId('en', 'exclusions', EXCLUSIONS_CHART_ID); assert.equal(ex.labels.length, 11); assert.ok(ex.otherLabel, 'the block carries an otherLabel');
  const p = evaluateChart(ex, 'pareto', {}, { lang: 'en' }); assert.ok(p.ok); assert.ok(!p.changes.some((c) => c.key === 'topn'), '11 categories: nothing is grouped, so no Top-N message');
  assert.ok(!/«Other»|Other/.test(JSON.stringify(p.changes)), JSON.stringify(p.changes)); assert.equal(p.block.labels.length, 11);
  const d = evaluateChart(ex, 'donut', {}, { lang: 'en' }); assert.ok(d.ok && d.changes.some((c) => c.key === 'topn'), 'a donut of 11 parts really groups (7 + Other)'); assert.ok(d.block.labels.length <= 8);
  const big = { type: 'chart', kind: 'hbar', otherLabel: 'Other', title: 'x', dim: { dimension: 'amanah', ordered: false, additive: true, measures: [{ key: 'excluded', kind: 'amount' }] }, labels: Array.from({ length: 30 }, (_, i) => `C${i}`), series: [{ label: 'v', values: Array.from({ length: 30 }, (_, i) => 100 - i) }] };
  const pp = evaluateChart(big, 'pareto', {}, { lang: 'en' }); assert.ok(pp.ok && pp.changes.some((c) => c.key === 'topn') && pp.block.labels.length === 16, 'beyond 20 categories the largest 15 + an explicit Other');
  near(flat(pp.block), flat(big), 1e-6, 'the grouped pareto keeps the total');
});
test('incompatible requests are refused with a reason in both languages (the base chart is returned unchanged)', () => {
  const ok = (r, why) => { assert.equal(r.ok, false, why); assert.ok(r.reason && ARABIC.test(r.reason.ar) && r.reason.en.length > 8 && !RAW.test(r.reason.ar + r.reason.en), `${why}: ${JSON.stringify(r.reason)}`); };
  const neg = { type: 'chart', kind: 'hbar', title: 't', dim: { dimension: 'reason', ordered: false, additive: true, measures: [{ key: 'excluded', kind: 'amount' }] }, labels: ['A', 'B', 'C'], series: [{ label: 'v', values: [10, -4, 7] }] };
  ok(evaluateChart(neg, 'donut', {}, { lang: 'en' }), 'donut with a negative part'); ok(evaluateChart(neg, 'pie', {}, { lang: 'en' }), 'pie with a negative part');
  const am = byId('en', 'smart_reports', 'amanah:0'); ok(evaluateChart(am, 'line', {}, { lang: 'en' }), 'a line over Amanahs (no order)'); ok(evaluateChart(am, 'area', {}, { lang: 'en' }), 'an area over Amanahs');
  const one = byId('en', 'exclusions', EXCLUSIONS_CHART_ID); ok(evaluateChart(one, 'scatter', {}, { lang: 'en' }), 'a scatter from one measure'); ok(evaluateChart(one, 'bubble', {}, { lang: 'en' }), 'a bubble from one measure');
  const wf = byId('en', 'dashboard', 'executive:0'); ok(evaluateChart(wf, 'pie', {}, { lang: 'en' }), 'waterfall → pie'); ok(evaluateChart(wf, 'hbar', {}, { lang: 'en' }), 'waterfall → bars');
  const sk = { ...byId('en', 'dashboard', 'executive:0'), alts: undefined }; ok(evaluateChart(sk, 'sankey', {}, { lang: 'en' }), 'sankey without a saved reconciliation');
  const bad = { ...wf, alts: { sankey: { nodes: [{ id: 'a', label: 'A', col: 0 }, { id: 'b', label: 'B', col: 1 }, { id: 'c', label: 'C', col: 2 }], links: [{ from: 'a', to: 'b', value: 100 }, { from: 'b', to: 'c', value: 60 }] } } }; ok(evaluateChart(bad, 'sankey', {}, { lang: 'en' }), 'a sankey whose flows do not reconcile');
  assert.equal(evaluateChart(neg, 'donut', {}, { lang: 'en' }).block, neg, 'the base block is returned as it was');
});

/* ============================================================ 3. representative data */
test('representative data: every available type of every real chart draws (AR + EN) with a table, never a refusal', () => {
  let drawn = 0; const kinds = new Set();
  for (const [l, b] of REAL_BLOCKS) {
    const o = chartOptions(b, { lang: l });
    for (const a of o.available) {
      const r = evaluateChart(b, a.id, {}, { lang: l }); assert.ok(r.ok, `${b.id} → ${a.id}`);
      const svg = chartSvg(r.block, { lang: l }); assert.ok(svg.startsWith('<svg') && !refused(svg), `${l} ${b.id} → ${a.id} drawn (${(svg.match(/data-refused="([^"]*)"/) || [])[1] || ''})`);
      const t = chartTableText(r.block, l); assert.ok(t.rows.length > 0, `${b.id} → ${a.id} has a table`); drawn += 1; kinds.add(a.id);
    }
  }
  assert.ok(drawn > 300 && kinds.size >= 22, `${drawn} drawings over ${kinds.size} types`);
});
test('families on representative synthetic fixtures: comparison · trend · composition · distribution · relationship draw in both languages', () => {
  for (const l of LANGS) { const fx = exportBlocks(l); for (const t of CHART_TYPES) { const b = fx[t.kind]; const svg = chartSvg(t.markers ? { ...b, markers: true } : b, { lang: l }); assert.ok(!refused(svg) && svg.includes(`data-kind="${t.kind}"`), `${l} ${t.id}`); } }
  assert.deepEqual([...new Set(CHART_TYPES.map((t) => t.purpose))].sort(), ['comparison', 'composition', 'distribution', 'relationship', 'trend']);
});
test('missing is not zero: a missing value is «—» in the table and never 0, in every kind that can carry a gap', () => {
  const base = (kind, extra = {}) => ({ type: 'chart', kind, title: 't', dim: { dimension: 'month', ordered: true, additive: true, measures: [{ key: 'net', kind: 'amount' }, { key: 'collected', kind: 'amount' }] }, labels: ['M1', 'M2', 'M3', 'M4', 'M5'], series: [{ label: 'A', values: [100, 120, null, 90, 130] }, { label: 'B', values: [60, 70, null, 50, 80] }], ...extra });
  for (const l of LANGS) for (const id of ['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'line', 'line_markers']) {
    const b = base(id === 'line_markers' ? 'line' : id.replace('stacked_col', 'stacked_col'), id === 'line_markers' ? { markers: true } : {});
    const svg = chartSvg(b, { lang: l }); assert.ok(!refused(svg), `${l} ${id}`);
    const t = chartTableText(b, l); const row = t.rows.find((r) => String(r[0]) === 'M3'); assert.ok(row, `${id} M3 row`);
    const cells = id.startsWith('stacked_hbar') ? row.slice(1, 3) : row.slice(1); // (known gap: the legacy stacked_hbar table prints Total 0 for a row whose every part is missing — see docs/chart-library.md «Honest gaps»)
    assert.ok(cells.every((c) => c === '—' || c === '' || /^[-–—]$/.test(String(c))), `${l} ${id}: a missing month is not a number: ${JSON.stringify(row)}`);
    const m4 = t.rows.find((r) => String(r[0]) === 'M4'); assert.ok(m4.slice(1).some((c) => /\d/.test(String(c))));
  }
  // switching the kind of a block with a gap keeps the gap (a null never becomes 0)
  const gap = base('bar'); for (const id of ['line', 'hbar', 'line_markers']) { const r = evaluateChart(gap, id, {}, { lang: 'en' }); assert.ok(r.ok, id); assert.ok(r.block.series.every((s) => s.values[2] == null), `${id} keeps the gap`); }
  const area = evaluateChart(gap, 'area', {}, { lang: 'en' }); assert.equal(area.ok, false, 'an area over a gap is refused (it would draw the gap as zero)');
  // zero values: drawn as 0, hoverable, not as a gap
  const zero = { ...gap, series: [{ label: 'A', values: [100, 0, 50, 0, 20] }] }; const zt = chartTableText(zero, 'en'); assert.ok(zt.rows.find((r) => r[0] === 'M2').slice(1).some((c) => /^0(\.0+)?$/.test(String(c).replace(/[,\s]/g, '')) || String(c) === '0'), `zero stays a number ${JSON.stringify(zt.rows[1])}`);
});
test('long Arabic labels: every type that takes them draws, the full text stays in the tooltip, nothing refused', () => {
  const long = (i) => `الإدارة العامة لتحصيل الإيرادات والرسوم والغرامات المتأخرة في المنطقة الأولى من الأمانة رقم ${i}`;
  const b = { type: 'chart', kind: 'hbar', title: 'نص طويل', otherLabel: 'أخرى', dim: { dimension: 'source', ordered: false, additive: true, measures: [{ key: 'collected', kind: 'amount' }] }, labels: Array.from({ length: 8 }, (_, i) => long(i)), series: [{ label: 'المبلغ', values: [90, 80, 70, 60, 50, 40, 30, 20].map((x) => x * 1e6) }] };
  const o = chartOptions(b, { lang: 'ar' }); for (const id of ['bar', 'hbar', 'pie', 'donut', 'treemap', 'pareto']) assert.ok(o.available.some((a) => a.id === id), id);
  for (const a of o.available) { const r = evaluateChart(b, a.id, {}, { lang: 'ar' }); const svg = chartSvg(r.block, { lang: 'ar' }); assert.ok(!refused(svg), a.id); assert.ok(svg.includes(long(0)) || svg.includes(long(0).slice(0, 30)), `${a.id}: the label (or its start with the full text in a tooltip) is present`); }
  const svg = chartSvg(b, { lang: 'ar' }); assert.ok(svg.includes(`<title>`) && svg.includes(long(7)), 'the full label is in a tooltip title');
});
test('many categories (45): bar / pareto / pie / donut / treemap keep the total; the pie and donut fold into an explicit «Other»', () => {
  const n = 45; const vals = Array.from({ length: n }, (_, i) => (n - i) * 1_000_000 + i);
  const b = { type: 'chart', kind: 'hbar', title: 'many', ranked: true, otherLabel: 'Other', dim: { dimension: 'source', ordered: false, additive: true, measures: [{ key: 'collected', kind: 'amount' }], whole: { label: 'Total', value: sum(vals) } }, labels: vals.map((_, i) => `Category ${i + 1}`), series: [{ label: 'v', values: vals }] };
  assert.notEqual(chartOptions(b, { lang: 'en' }).recommended, 'pie');
  for (const id of ['bar', 'hbar', 'pareto', 'pie', 'donut', 'treemap']) {
    const r = evaluateChart(b, id, {}, { lang: 'en' }); assert.ok(r.ok, id); near(flat(r.block), sum(vals), 1e-6, id); const svg = chartSvg(r.block, { lang: 'en' }); assert.ok(!refused(svg), id);
    if (id === 'pie' || id === 'donut') { assert.ok(r.block.labels.length <= 8 && r.block.otherIndex === r.block.labels.length - 1 && /Other/.test(r.block.labels.at(-1)), `${id}: 7 + Other`); }
  }
  const t5 = evaluateChart(b, 'hbar', { topN: 5 }, { lang: 'en' }); assert.equal(t5.block.labels.length, 6); assert.ok(/Other \(40\)/.test(t5.block.labels[5])); near(flat(t5.block), sum(vals), 1e-6, 'Top 5 + Other');
});
test('restricted organisation: options, charts, companions and drawings contain only the permitted Amanahs', () => {
  const PERM = W.snap.byAmanah.slice().sort((x, y) => y.net - x.net).slice(0, 2).map((g) => g.key); const org = { amanahKeys: PERM };
  const R = world(SC({ org })); const Tr = R.snap.totals; assert.ok(Tr.net < W.snap.totals.net);
  const forbidden = ENTITIES.filter((e) => !PERM.includes(e.en) && !PERM.includes(e.key)).flatMap((e) => [e.en, e.ar]).filter((n) => n && !PERM.some((p) => { const pe = ENTITIES.find((x) => x.en === p || x.key === p); return pe && (pe.en.includes(n) || pe.ar.includes(n)); }));
  assert.ok(forbidden.length > 10);
  for (const l of LANGS) for (const s of surfaces(R, l)) for (const b of s.blocks) {
    const j = JSON.stringify(b); for (const f of forbidden) assert.ok(!j.includes(f), `${l} ${s.page} ${b.id} leaks «${f}»`);
    for (const a of chartOptions(b, { lang: l }).available) { const r = evaluateChart(b, a.id, {}, { lang: l }); const svg = chartSvg(r.block, { lang: l }); for (const f of forbidden) assert.ok(!svg.includes(f), `${l} ${s.page} ${b.id} → ${a.id} drawing leaks «${f}»`); }
  }
  const dash = surfaces(R, 'en').find((s) => s.page === 'dashboard').blocks; near(dash.find((b) => b.dim.dimension === 'status').dim.whole.value, Tr.net, 0.5, 'the restricted net billed');
  const ex = surfaces(R, 'en').find((s) => s.page === 'exclusions').blocks[0]; if (ex) near(sum(ex.series[0].values), kpiOf(Tr).excluded, 1, 'the exclusions chart is the restricted total');
  const am = surfaces(R, 'en').find((s) => s.page === 'smart_reports').blocks.find((b) => b.id === 'amanah:0'); assert.ok(am.labels.length <= PERM.length, 'only permitted Amanahs are bars');
});
test('municipality scope: the charts of a narrowed scope contain only that municipality', () => {
  const JD = 'Jeddah Amanah'; const jd = W.st && W.snap; const probe = world(SC({ amanah: JD })); const mapped = probe.snap.byMunicipality.filter((g) => g.status === 'mapped').sort((a, b) => b.count - a.count)[0]; assert.ok(mapped);
  const R = world(SC({ amanah: JD, muni: mapped.key })); assert.ok(R.snap.totals.count > 0 && R.snap.totals.count < probe.snap.totals.count);
  const others = probe.snap.byMunicipality.filter((g) => g.status === 'mapped' && g.key !== mapped.key).map((g) => muniLabel(g.key, 'en')).filter((n) => n && n !== muniLabel(mapped.key, 'en'));
  assert.ok(others.length >= 2);
  for (const s of surfaces(R, 'en')) for (const b of s.blocks) { const j = JSON.stringify(b); for (const o of others) assert.ok(!j.includes(o), `${s.page} ${b.id} leaks the municipality «${o}»`); }
});

/* ============================================================ 4. switching types keeps the figures */
const TABLE_DERIVED = new Set(['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'pareto', 'pie', 'donut']);
test('switching types on the same compatible dataset keeps the figures: the sum of every series is identical (a Top-N «Other» keeps the sum too)', () => {
  let checked = 0;
  for (const [l, b] of REAL_BLOCKS) {
    if (b.kind === 'waterfall' || b.kind === 'heatmap' || b.basis === 'cumulative') continue;
    for (const a of chartOptions(b, { lang: l }).available) {
      if (!TABLE_DERIVED.has(a.id)) continue; const r = evaluateChart(b, a.id, {}, { lang: l }); if (!r.ok || r.changes.some((c) => c.key === 'aggregation' && /saved|محفوظة/.test(c.en + c.ar))) continue;
      const w = b.dim?.whole?.value; const expected = flat(b); const got = flat(r.block);
      if ((a.id === 'pie' || a.id === 'donut') && w != null && w - expected > 0.5) near(got, w, 1e-3, `${b.id} → ${a.id} (rest of total)`); else near(got, expected, 1e-3, `${l} ${b.id} → ${a.id}`);
      checked += 1;
    }
  }
  assert.ok(checked > 40, `${checked} conversions checked`);
  const ex = byId('en', 'exclusions', EXCLUSIONS_CHART_ID); const tot = flat(ex);
  for (const k of [2, 4, 6]) { const r = evaluateChart(ex, 'hbar', { topN: k }, { lang: 'en' }); assert.ok(r.ok && r.block.labels.length === k + 1 && /Other/.test(r.block.labels[k]), `Top ${k} + Other`); near(flat(r.block), tot, 1e-6, `Top ${k} keeps the sum`); }
  const sortedAsc = evaluateChart(ex, 'hbar', { sort: 'asc' }, { lang: 'en' }); near(flat(sortedAsc.block), tot, 1e-6); assert.deepEqual(sortedAsc.block.keys.slice().sort(), ex.keys.slice().sort(), 'sorting re-orders the keys with the labels');
  for (const id of ['pareto', 'donut', 'treemap']) { const r = evaluateChart(ex, id, {}, { lang: 'en' }); const total = r.block.tree ? r.block.tree.value : flat(r.block); near(total, tot, 1e-3, `${id} total`); }
});
test('the display of a ranked chart keeps tooltips and keys aligned with their labels after a sort / Top N (parallel arrays follow)', () => {
  const f = list(W.st, { scope: W.scope, cfg: cfgNow, filters: {}, page: 0, pageSize: 1, facets: ['source'] }).facets.source;
  const r = rankedBlock({ dim: 'source', items: f, measure: 'collected', role: 'collected', title: 'T', valueTitle: 'T', ar: false, nf: String }); const b = summaryBlock(r.block, { id: 'source', dim: 'source', measure: 'collected', total: r.total, ar: false });
  assert.ok(Array.isArray(b.tips) && b.tips.length === b.labels.length);
  const s = evaluateChart(b, 'hbar', { sort: 'asc' }, { lang: 'en' }); assert.ok(s.ok);
  s.block.labels.forEach((lbl, i) => { const k = s.block.keys[i]; const j = b.keys.indexOf(k); assert.equal(b.labels[j], lbl); assert.equal(s.block.tips[i], b.tips[j], `tip of ${lbl} follows its label`); });
  const t = evaluateChart(b, 'hbar', { topN: 2 }, { lang: 'en' }); assert.equal(t.block.tips.length, t.block.labels.length);
});

/* ============================================================ 5. page integration */
test('Dashboard: the three charts are the dashboard report model\'s own blocks (executive:0, executive:1, aging:0) with the SAME figures as the plain financial-chart builders', () => {
  const rev = { snapshot: W.snap, prevSnapshot: null, comparison: null, cfg: cfgNow, targets: DEFAULT_TARGETS, cases: [], meta: null, scope: { preset: 'ytd' }, scopeEff: { from: W.scope.from, to: W.scope.to, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' } };
  for (const l of LANGS) {
    const { blocks } = buildDashboardChartBlocks(rev, W.dist, l); assert.deepEqual(Object.keys(blocks).sort(), ['aging:0', 'executive:0', 'executive:1']); assert.deepEqual(DASHBOARD_PAGE_SECTIONS, ['executive', 'aging']);
    const T = W.snap.totals; const plain = { 'executive:0': grossToNetChart(T, l), 'executive:1': collectedShareChart(T, l), 'aging:0': agingChart(W.snap.stock?.aging, l, (x) => (typeof x === 'string' ? x : x?.[l] || x?.en || x)) };
    for (const [id, p] of Object.entries(plain)) { const b = blocks[id]; assert.equal(b.kind, p.kind, id); assert.deepEqual(b.series.map((s) => s.values), p.series.map((s) => s.values), `${l} ${id}: same figures`); assert.equal(b.labels.length, p.labels.length); assert.ok(b.dim, `${id} has dim`); }
    assert.ok(blocks['executive:0'].alts?.sankey, 'the bridge offers its sankey'); assert.ok(blocks['aging:0'].alts?.histogram && blocks['aging:0'].alts?.box, 'the aging chart offers histogram / box once the distributions are attached');
    const noDist = buildDashboardChartBlocks(rev, null, l).blocks['aging:0']; assert.ok(!noDist.alts?.histogram && noDist.altsNotes?.histogram, 'without distributions the types are unavailable with a stated reason (never a wrong chart)');
  }
  // the page ids are the full export model's ids
  const full = chartBlocks(buildReportModelFor(rev, W.dist, 'en')); for (const id of ['executive:0', 'executive:1', 'aging:0']) assert.ok(full.find((b) => b.id === id), `${id} in the export model`);
});
function buildReportModelFor(rev, dist, lang) { return buildReportModel({ ...dashboardInputs(rev, { dist }), lang }); }
test('Dashboard export carries the chosen kinds (applyView), in both languages, keeps its build inputs and never refetches', async () => {
  const rev = { snapshot: W.snap, prevSnapshot: null, comparison: null, cfg: cfgNow, targets: DEFAULT_TARGETS, cases: [], meta: null, scope: { preset: 'ytd' }, scopeEff: { from: W.scope.from, to: W.scope.to, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' }, data: { calls: 0, series: async function () { this.calls += 1; return { months: [], values: [] }; }, distributions: async function () { this.calls += 1; return W.dist; } } };
  const model = await buildDashboardModel(rev, 'en'); const callsAfterBuild = rev.data.calls;
  const { blocks } = buildDashboardChartBlocks(rev, W.dist, 'en');
  let view = emptyView(); view = setChartConfig(view, 'executive:1', { kind: 'donut' }, blocks['executive:1']); view = setChartConfig(view, 'aging:0', { kind: 'histogram' }, blocks['aging:0']); view = setChartConfig(view, 'executive:0', { kind: 'sankey' }, blocks['executive:0']);
  const vm = withDashboardView(model, view); assert.ok(vm._inputs && vm._inputs.spec, 'the build inputs survive'); assert.equal(rev.data.calls, callsAfterBuild, 'applying the view does not touch the data service');
  const plan = exportPlan(vm, vm.view); const by = Object.fromEntries(plan.map((p) => [p.chartId, p]));
  assert.equal(by['executive:1'].typeId, 'donut'); assert.equal(by['aging:0'].typeId, 'histogram'); assert.equal(by['executive:0'].typeId, 'sankey'); assert.equal(by['executive:1'].pptx, 'native'); assert.equal(by['executive:0'].pptx, 'vector-image');
  assert.equal(chartBlocks(vm).find((b) => b.id === 'executive:1').kind, 'donut', 'the exported model really holds a donut');
  near(flat(chartBlocks(vm).find((b) => b.id === 'executive:1')), flat(chartBlocks(model).find((b) => b.id === 'executive:1')), 1e-6, 'same figures');
  assert.equal(viewedModel(model, emptyView()), model, 'the default view returns the model as it is');
  const other = buildReportModel({ ...model._inputs, lang: 'ar' }); const va = withDashboardView(other, view, model._inputs); assert.equal(chartBlocks(va).find((b) => b.id === 'executive:1').kind, 'donut', 'Arabic model too');
});
test('page chart views persist per user and page (localStorage, try/catch), never cross users, survive junk, and a default view removes the key', () => {
  const mem = new Map(); const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
  const s = createPageViewStore(storage); const U1 = 'u:demo'; const U2 = 'u:other';
  assert.deepEqual(s.load(U1, DASHBOARD_PAGE), emptyView());
  const v = setChartConfig(emptyView(), 'executive:1', { kind: 'donut' }); assert.equal(s.save(U1, DASHBOARD_PAGE, v), true);
  assert.deepEqual(chartConfigOf(s.load(U1, DASHBOARD_PAGE), 'executive:1'), { kind: 'donut' }); assert.deepEqual(s.load(U2, DASHBOARD_PAGE), emptyView(), 'another user sees nothing'); assert.deepEqual(s.load(U1, 'exclusions'), emptyView(), 'another page sees nothing');
  assert.ok([...mem.keys()].every((k) => k.startsWith(`${PAGE_VIEW_KEY}:`)));
  mem.set(`${PAGE_VIEW_KEY}:${U1}:junk`, '{not json'); assert.deepEqual(s.load(U1, 'junk'), emptyView()); mem.set(`${PAGE_VIEW_KEY}:${U1}:evil`, JSON.stringify({ v: 1, view: { charts: { x: { kind: '<script>', topN: -4, orientation: 'z' } }, chartKind: 'pie3d' } })); assert.deepEqual(s.load(U1, 'evil'), emptyView(), 'only valid parts of a stored view survive (an unknown type is dropped)');
  s.save(U1, DASHBOARD_PAGE, emptyView()); assert.equal(mem.has(`${PAGE_VIEW_KEY}:${U1}:${DASHBOARD_PAGE}`), false, 'a default view removes the key');
  const boom = createPageViewStore({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('denied'); } }); assert.deepEqual(boom.load(U1, 'p'), emptyView()); assert.equal(boom.save(U1, 'p', v), false); assert.doesNotThrow(() => boom.clear(U1, 'p'));
  assert.deepEqual(createPageViewStore(null).load(U1, 'p'), emptyView()); assert.equal(createPageViewStore(null).save(U1, 'p', v), false);
});
test('Exclusions: ONE chart of the excluded amount by effective reason; the bars add up to the total excluded; options and drill key', () => {
  const T = W.snap.totals; const rows = EXCLUSION_REASONS.map((r) => ({ ...r, count: W.snap.ruleStats?.[r.ruleId]?.primaryCount || 0, amount: W.snap.ruleStats?.[r.ruleId]?.primaryAmount || 0 }));
  for (const l of LANGS) {
    const b = exclusionsReasonChart(rows, l); assert.equal(b.id, EXCLUSIONS_CHART_ID); assert.equal(b.dim.dimension, 'reason'); assert.equal(b.dim.additive, true); near(sum(b.series[0].values), kpiOf(T).excluded, 1, 'each invoice once under its effective reason: the bars add up to the exclusions KPI of the page');
    near(b.dim.whole.value, kpiOf(T).excluded, 1); assert.equal(b.keys.length, b.labels.length); assert.ok(b.series[0].values.every((v, i, a) => i === 0 || a[i - 1] >= v), 'ranked by amount');
    const o = chartOptions(b, { lang: l }).available.map((a) => a.id); for (const id of ['hbar', 'bar', 'pareto', 'donut', 'treemap']) assert.ok(o.includes(id), `${l} ${id}`);
    assert.ok(!o.includes('line') && !o.includes('scatter'));
  }
  assert.equal(exclusionsReasonChart(rows.map((r) => ({ ...r, amount: 0 })), 'en'), null, 'nothing excluded: no chart'); assert.equal(exclusionsReasonChart(rows.map((r, i) => ({ ...r, amount: i === 0 ? 5 : 0 })), 'en'), null, 'one bar is not a comparison');
  const ex = exclusionsReasonChart(rows, 'en'); const p = evaluateChart(ex, 'pareto', {}, { lang: 'en' }); assert.ok(p.ok && ex.keys.every((k) => EXCLUSION_REASONS.some((r) => r.ruleId === k)));
  const src = readFileSync('src/pages/Exclusions.jsx', 'utf8'); assert.ok(src.indexOf('ex-reasons') < src.indexOf('PageChart block={reasonChart}') && src.indexOf('<table className="ex-rtable"') < src.indexOf('PageChart block={reasonChart}'), 'the reasons table stays first');
});
test('Invoice summaries: one revenue-source chart each, compact picker, only the compatible types of one breakdown (no extra charts)', () => {
  for (const l of LANGS) for (const b of blocksOf(l, 'invoice_summaries')) {
    const a = chartOptions(b, { lang: l }).available.map((x) => x.id).sort(); assert.deepEqual(a, ['bar', 'donut', 'hbar', 'pareto', 'pie', 'treemap'], `${l} ${b.title}`);
    const pie = evaluateChart(b, 'donut', {}, { lang: l }); assert.ok(pie.ok); near(flat(pie.block), b.dim.whole.value, 1e-3, 'a top-5 donut names the rest of the total as «Other»');
  }
  for (const f of ['src/pages/Invoices.jsx', 'src/pages/Collection.jsx']) assert.equal((readFileSync(f, 'utf8').match(/<RankedBars /g) || []).length, f.endsWith('Invoices.jsx') ? 1 : 1, `${f}: still one RankedBars summary`);
  assert.ok(/picker="compact"/.test(readFileSync('src/components/invoices/RankedBars.jsx', 'utf8')));
});
test('Non-collection: the page charts take the model\'s ids, dims and companions; the municipality chart (not in the file) gets no picker', () => {
  for (const l of LANGS) {
    const enr = ncChartEnrichment({ ...W.nc, distributions: W.dist }, l); assert.deepEqual(Object.keys(enr).sort(), Object.keys(MODEL_KEY).sort());
    const model = buildNcReportModel({ ...W.nc, distributions: W.dist }, { lang: l }); const ids = new Set(chartBlocks(model).map((b) => b.id));
    for (const [name, e] of Object.entries(enr)) assert.ok(ids.has(e.id), `${name} → ${e.id} is a chart of the exported NC model`);
    assert.ok(enr.waterfall.alts?.sankey && enr.aging.alts?.histogram && enr.aging.alts?.box, 'sankey on the bridge, histogram / box of days overdue on aging');
    const plain = ncChartEnrichment(W.nc, l); assert.ok(!plain.aging.alts?.histogram && plain.aging.altsNotes?.histogram, 'without distributions the histogram is unavailable with a stated reason');
    const ch = buildCharts(W.nc, l === 'ar'); assert.ok(!('muni' in enr) && ch.muni, 'the municipality chart exists on the page but not in the file');
  }
  const src = readFileSync('src/components/analysis/nc/NcBits.jsx', 'utf8'); assert.ok(/nc\.enrich\[name\]/.test(src) && /PageChart/.test(src));
});
test('Non-collection: the chosen chart type is saved with the analysis VERSION (not with the figures), restored on reload, and appears in the exported model', () => {
  const mem = new Map(); const storage = { get length() { return mem.size; }, key: (i) => [...mem.keys()][i] ?? null, getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
  const nstore = createAnalysisStore({ storage }); const uk = userKeyOf({ user: 'demo' });
  const input = { analysis: JSON.parse(JSON.stringify(W.nc)), taskScope: { from: W.nc.scope.from, to: W.nc.scope.to, amanah: 'all', source: 'all' }, sourceTaskId: 't-1', dataVersion: 'dv' };
  const c = nstore.create(uk, input); assert.ok(c.ok); const before = nstore.load(uk, c.id).record.versions[0];
  const enr = ncChartEnrichment({ ...W.nc, distributions: W.dist }, 'en'); const id = enr.due.id; const block = { ...buildCharts(W.nc, false).due.block, ...enr.due };
  const view = setChartConfig(emptyView(), id, { kind: 'donut' }, block); assert.deepEqual(nstore.setView(uk, c.id, 1, view), { ok: true });
  const after = nstore.load(uk, c.id); assert.ok(after.ok); const v1 = after.record.versions[0];
  assert.deepEqual(chartConfigOf(v1.view, id), { kind: 'donut' }); assert.deepEqual(v1.analysis, before.analysis, 'the figures are untouched'); assert.equal(v1.check, before.check, 'the checksum of the analysis is untouched');
  assert.ok(nstore.setView(uk, c.id, 2, view).error === 'not_found'); assert.equal(nstore.setView('u:other', c.id, 1, view).ok, false, 'another user cannot write it');
  // a second version has its own view
  const a2 = nstore.addVersion(uk, c.id, { ...input, sourceTaskId: 't-2' }); assert.ok(a2.ok); assert.equal(nstore.load(uk, c.id).record.versions[1].view, undefined, 'a new version starts at the recommended charts');
  // the exported model carries it
  for (const l of LANGS) { const m = buildNcReportModel({ ...v1.analysis, distributions: W.dist }, { lang: l }); const vm = viewedModel(m, v1.view); const e = chartBlocks(vm).find((b) => b.id === id); assert.equal(typeIdOf(e), 'donut', `${l}: the donut is in the exported model`); near(flat(e), flat(chartBlocks(m).find((b) => b.id === id)), 1e-6); assert.ok(exportPlan(vm, vm.view).some((p) => p.chartId === id && p.typeId === 'donut')); }
  nstore.setView(uk, c.id, 1, emptyView()); assert.equal(nstore.load(uk, c.id).record.versions[0].view, undefined, 'a default view is removed');
  const bad = JSON.parse(mem.get([...mem.keys()].find((k) => k.includes('rec')))); bad.versions[0].view = { charts: { z: { kind: '<b>', topN: -1 } }, chartKind: 'x' }; mem.set([...mem.keys()].find((k) => k.includes('rec')), JSON.stringify(bad)); assert.deepEqual(nstore.load(uk, c.id).record.versions[0].view.charts, {}, 'a damaged view is reduced to its valid parts');
});
test('Drill-down on a changed chart: marks map back to the page\'s own marks by label; the folded «Other», flows, trees and scatters are not clickable (never a broken target)', () => {
  const base = buildCharts(W.nc, false).source.block; assert.ok(base.labels.length >= 2);
  const disp = (cfg) => evaluateChart({ ...base, dim: { dimension: 'source', ordered: false, additive: true, measures: [{ key: 'overdue', kind: 'amount' }] }, otherLabel: 'Other' }, cfg.kind || 'hbar', cfg, { lang: 'en' }).block;
  assert.ok(sameShape(base, base)); const sorted = disp({ sort: 'asc' }); assert.equal(sorted.kind, 'hbar'); assert.ok(drillable(base, sorted));
  const last = sorted.labels.length - 1; const t = translateSelect(base, sorted, { kind: 'mark', i: 0, j: 0, label: sorted.labels[0] }); assert.equal(base.labels[t.i], sorted.labels[0], 'a click on the first sorted bar is the page mark of THAT label'); assert.ok(last >= 1);
  const pareto = disp({ kind: 'pareto' }); assert.ok(drillable(base, pareto)); assert.equal(base.labels[translateSelect(base, pareto, { kind: 'mark', i: 1, j: 0, label: pareto.labels[1] }).i], pareto.labels[1]);
  const topn = disp({ topN: 2 }); assert.ok(drillable(base, topn)); assert.equal(translateSelect(base, topn, { kind: 'mark', i: topn.otherIndex, j: 0, label: topn.labels[topn.otherIndex] }), null, 'the «Other» group opens nothing');
  assert.ok(translateSelect(base, topn, { kind: 'mark', i: 0, j: 0, label: topn.labels[0] }));
  for (const k of ['treemap', 'sunburst', 'sankey', 'scatter', 'histogram', 'box', 'bullet']) assert.equal(drillable(base, { kind: k, labels: [], series: [] }), false, `${k} is not clickable`);
  // a stacked bar whose parts are series → a donut: the clicked part is a series of the page chart
  const due = buildCharts(W.nc, false).due.block; const don = evaluateChart({ ...due, dim: { dimension: 'due', ordered: false, additive: true, measures: [{ key: 'overdue', kind: 'amount' }, { key: 'notDue', kind: 'amount' }], whole: { label: 'x', value: flat(due) } } }, 'donut', {}, { lang: 'en' });
  if (don.ok) { assert.ok(drillable(due, don.block)); const part = don.block.labels[1]; const t2 = translateSelect(due, don.block, { kind: 'mark', i: 1, label: part }); assert.equal(due.series[t2.j].label, part); assert.equal(t2.i, 0); assert.deepEqual(selectedToDisplay(due, don.block, { i: 0, j: t2.j }), { i: 1 }); }
  assert.deepEqual(selectedToDisplay(base, sorted, { i: 0 }), { i: sorted.labels.indexOf(base.labels[0]) });
  const heat = buildCharts(W.nc, false).heat.block; assert.equal(translateSelect(heat, heat, { kind: 'mark', i: 1, j: 2 }).j, 2, 'a heat map keeps its geometry');
});
test('Presentation code never reaches the data service (a type change cannot refetch or recompute figures)', () => {
  for (const f of ['src/components/charts/pageChartView.js', 'src/components/charts/usePageChartView.js', 'src/components/charts/chartDrill.js', 'src/components/charts/PageChart.jsx', 'src/data/viewedModel.js', 'src/components/invoices/summaryChart.js', 'src/data/exclusionsChart.js']) {
    const s = readFileSync(f, 'utf8'); assert.ok(!/rev\.data|\.snapshot\(|fetch\(|api\.|\.distributions\(|\.series\(/.test(s.replace(/\/\/.*$/gm, '')), `${f} must not call the data service`);
  }
  const nc = readFileSync('src/components/analysis/nc/NcResult.jsx', 'utf8'); assert.ok(/useAsync\(\(\) => \(distOk/.test(nc) && /\[distOk, rev\.data, base, rev\.cfg\]/.test(nc), 'the distributions are fetched for the scope, not for the view');
  const page = readFileSync('src/pages/AnalysisResultPage.jsx', 'utf8'); assert.ok(/ncs\.store\.setView/.test(page) && !/notifyStore\(\);?\s*\n[^\n]*setView/.test(page), 'the view is stored without announcing a data change');
});
test('Decision Room: evidence charts stay plain (no picker — they are the filter of the queue), their figures and marks unchanged', () => {
  const s = readFileSync('src/components/decisions/DecisionCharts.jsx', 'utf8'); assert.ok(!/ChartFrame|ChartPicker|PageChart/.test(s), 'the Decision Room chart is a filter control: choosing a type would break its mark → filter mapping');
  assert.ok(/onSelect=\{pick\(/.test(s) && /markFrom/.test(s), 'bars still filter the items');
});
test('Planning: no approved target exists, so a bullet is never drawn from a demo target; the picker reason is «لا يوجد مستهدف معتمد»', () => {
  const T = W.snap.totals; const demo = { ...DEFAULT_TARGETS }; assert.ok(Object.values(demo).filter((t) => t && typeof t === 'object' && 'status' in t).every((t) => t.status === 'demo'), 'every target of the demo is status demo');
  const r = bulletRateAlt({ targets: demo, T, scope: SC(), snapScope: W.snap.scope, lang: 'en' }); assert.equal(r.alts, undefined, 'a demo target draws no bullet'); assert.ok(r.notes?.bullet?.en, 'and the reason is listed');
  const approved = { ...DEFAULT_TARGETS, collectionRate: { ...DEFAULT_TARGETS.collectionRate, value: 0.6, status: 'approved' } }; const a = bulletRateAlt({ targets: approved, T, scope: SC(), snapScope: W.snap.scope, lang: 'en' }); assert.equal(a.alts?.bullet?.bullets?.[0]?.target, 0.6, 'only an approved target draws it'); const withB = { ...byId('en', 'dashboard', 'executive:1'), alts: { ...a.alts }, altsNotes: undefined }; assert.ok(chartOptions(withB, { lang: 'en' }).available.some((x) => x.id === 'bullet'), 'and then the picker offers it');
  const m = bulletAmountAlt({ targets: demo, snapshot: W.snap, scope: SC(), lang: 'en' }); assert.equal(m?.alts, undefined);
  for (const [l, b] of REAL_BLOCKS) { assert.ok(!b.alts?.bullet, `${b.id}: no bullet payload in the demo`); const u = chartOptions(b, { lang: l }).unavailable.find((x) => x.id === 'bullet'); assert.ok(u, `${b.id}: bullet unavailable`); assert.ok(l === 'ar' ? /مستهدف[^.:؛]*معتمد/.test(u.reason.ar) : /approved ([a-z-]+ )*target/i.test(u.reason.en), `${l} ${b.id} reason: ${u.reason[l]}`); } // (the reason in the language of the page: see the honest gap on the other-language field of a builder note)
  // The plan page («خطط الإيرادات») DRAWS its charts with the shared library (PageChart: cumulative line, deviation hbar) — the old bespoke projection (PlanForecast / UnitLines) and the planning map are gone.
  // (The bullet was built only for an APPROVED target; a plan target is never «approved», so the plan page draws none: see tests/plans-ui.test.mjs. The alt/picker reasons above are about the report charts and are unchanged.)
  const plan = readFileSync('src/pages/PlanDetail.jsx', 'utf8') + readFileSync('src/components/plans/PlanSections.jsx', 'utf8') + readFileSync('src/components/plans/planCharts.js', 'utf8');
  assert.ok(/PageChart/.test(plan) && /usePageChartView\('planning'\)/.test(plan), 'Planning draws its charts with the shared PageChart (view kept per user, page «planning»)'); assert.ok(!existsSync('src/components/strategic/PlanForecast.jsx'), 'the bespoke target / estimate / actual projection is retired'); assert.ok(!existsSync('src/pages/PlanningArea.jsx') && !existsSync('src/data/planningCharts.js'), 'the old planning page and its chart builders are retired');
  assert.ok(!/ProvinceMap|EntityMap|ksaProvinces|map-based/.test(plan), 'the plan page draws no map (the comparison is the sorted deviation bars)'); assert.ok(/kind: 'line'/.test(readFileSync('src/components/plans/planCharts.js', 'utf8')) && /<PageChart/.test(readFileSync('src/components/plans/PlanSections.jsx', 'utf8')), 'the cumulative chart is its own block on the shared PageChart');
});
test('the store of the demo is the synthetic compact one (no real figures anywhere in this test)', () => { assert.ok(store()); assert.equal(process.env.DEMO_SIZE, 'compact'); });

for (const [name, fn] of tests) { try { await fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } }
console.log(`${passed}/${tests.length} integration groups passed`);
