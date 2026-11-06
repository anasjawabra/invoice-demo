// Conversational chart requests (docs/chart-library.md «Conversational chart requests»): a typed request («اعرضها كأعمدة», “Show this as a donut chart.”, …) is turned into a
// per-chart config for the right chart of the current result — or a question, or the reason it cannot be done. Real models on the compact synthetic world (AR + EN) plus small
// synthetic charts for the cases the report does not contain. Synthetic data only.
// Run: npm run test:chartreq
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { chartDistributions } from '../server/distributions.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { chartBlocks, assignChartIds } from '../src/data/chartIds.js';
import { CHART_TYPES, chartOptions, evaluateChart, typeIdOf } from '../src/data/chartCatalog.js';
import { resolveType } from '../src/data/chartConfig.js';
import { applyView, emptyView, chartConfigOf, cleanView } from '../src/data/reportView.js';
import { interpretChat } from '../src/data/chatIntents.js';
import { interpretChartRequest, viewAfterRequest, parseChartPhrase, fold } from '../src/data/chartRequests.js';
import { CORPUS } from './interpreter-corpus.mjs';
import { BLIND } from './interpreter-corpus-blind.mjs';
import { HELDOUT } from './interpreter-corpus-heldout.mjs';
import { HELDOUT2 } from './interpreter-corpus-heldout2.mjs';
import { HELDOUT3 } from './interpreter-corpus-heldout3.mjs';
import { HELDOUT4 } from './interpreter-corpus-heldout4.mjs';
import { HELDOUT5 } from './interpreter-corpus-heldout5.mjs';
import { HELDOUT6 } from './interpreter-corpus-heldout6.mjs';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan (the seed is the 2026 reference)

process.env.DEMO_SIZE = 'compact';
let passed = 0; const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const scope = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
const snap = snapshot(st, { scope, cfg }); const dist = chartDistributions(st, { scope, cfg }); const nc = nonCollectionAnalysis(st, { scope, cfg });
const out = { snapshot: snap, forecast: { ready: false }, targetPos: null, achievement: null, cards: [], anomalies: [] };
const build = (lang) => assignChartIds(buildReportModel({ spec: { ...defaultSpec(TODAY), scope, sections: SECTION_ORDER, depth: 'detailed' }, lang, out, targets: DEFAULT_TARGETS, cases: [], meta: null, dist, ncAnalysis: nc }));
const MA = build('ar'); const ME = build('en');
const AR_RE = /[؀-ۿ]/;
const sum = (a) => a.reduce((t, x) => t + (typeof x === 'number' && Number.isFinite(x) ? x : 0), 0);
const blk = (m, id) => chartBlocks(m).find((b) => b.id === id);
const both = (x) => x && typeof x.ar === 'string' && typeof x.en === 'string' && x.ar.length > 0 && x.en.length > 0;

// ask: the request against a model, saved model passed as `base`, the view that has been built so far
// as Smart Reports calls it: the saved model (with chart ids) + the view; `askShown` passes the displayed model too (it must give the same answer)
const ask = (m, q, view = emptyView()) => interpretChartRequest(q, { model: m, view, lang: m.lang, base: m });
const askShown = (m, q, view = emptyView()) => interpretChartRequest(q, { model: applyView(m, view).model, view, lang: m.lang, base: m });
const askDisplayedOnly = (m, q, view = emptyView()) => interpretChartRequest(q, { model: applyView(m, view).model, view, lang: m.lang });
const must = (r, type, msg = '') => { assert.ok(r, `${msg}: not null`); assert.equal(r.type, type, `${msg}: ${r.type} ${JSON.stringify(r.question || r.reason || r.note || '')}`); return r; };
const run = (m, q, view = emptyView()) => { const r = ask(m, q, view); must(r, 'apply', q); return { r, view: viewAfterRequest(view, r, m) }; };
const kindAfter = (m, view, id) => typeIdOf(blk(applyView(m, view).model, id));
// the chart ids a question offers (every option re-sends a request that names its chart)
const optionIds = (m, r, view = emptyView()) => r.options.map((o) => { const x = ask(m, o.text, view); assert.ok(x && (x.type === 'apply'), `option «${o.text}» → ${x && x.type}`); return x.chartId; });

/* synthetic charts for the cases the report does not hold */
const B = 1e9;
const mk = (b) => ({ type: 'chart', ...b });
const synthModel = (blocks, lang = 'en') => assignChartIds({ lang, headline: [], sections: [{ key: 'syn', title: 'x', blocks: blocks.map(mk) }] });
const negBar = () => ({ kind: 'bar', title: 'Net movement by item', labels: ['A', 'B', 'C'], series: [{ label: 'Delta', values: [5 * B, -3 * B, 4 * B] }], dim: { dimension: 'item', ordered: false, measures: [{ key: 'net', kind: 'amount' }], additive: true } });
const mixedBar = () => ({ kind: 'hbar', title: 'Amount next to a rate', labels: ['A', 'B', 'C'], series: [{ label: 'Net billed', values: [5 * B, 3 * B, 4 * B] }, { label: 'Collection rate', values: [0.5, 0.6, 0.7], valueKind: 'rate' }], dim: { dimension: 'amanah', ordered: false, measures: [{ key: 'net', kind: 'amount' }, { key: 'rate', kind: 'rate' }], additive: false } });
const byAmanahSyn = () => ({ kind: 'hbar', title: 'Net billed and collected by Amanah', labels: ['Riyadh Amanah', 'Jeddah Amanah', 'Makkah Amanah', 'Asir Amanah', 'Taif Amanah', 'Jazan Amanah', 'Tabuk Amanah'], series: [{ label: 'Net billed', values: [9 * B, 7 * B, 6 * B, 4 * B, 3 * B, 2 * B, 1 * B] }, { label: 'Collected', values: [6 * B, 5 * B, 4 * B, 3 * B, 2 * B, 1 * B, 0.5 * B] }], dim: { dimension: 'amanah', ordered: false, measures: [{ key: 'net', kind: 'amount' }, { key: 'collected', kind: 'amount' }], additive: false } });
const monthlySyn = () => ({ kind: 'bar', basis: 'monthly', title: 'Net billed by month', labels: ['Jan 26', 'Feb 26', 'Mar 26', 'Apr 26', 'May 26', 'Jun 26'], series: [{ label: 'Net billed', values: [1 * B, 2 * B, 1.5 * B, 2.5 * B, 2 * B, 3 * B] }], dim: { dimension: 'month', ordered: true, measures: [{ key: 'net', kind: 'amount' }], additive: false } });
const waterfallSyn = () => ({ kind: 'waterfall', title: 'From gross to net', labels: ['Gross', 'Exclusions', 'Net'], series: [{ label: 'Amount', values: [100 * B, -30 * B, 70 * B] }], totals: [true, false, true], dim: { dimension: 'step', ordered: true, measures: [{ key: 'amount', kind: 'amount' }], additive: false } });

/* ---------------------------------------------------------------- 1. the sentences of the brief, AR + EN, on the real report */
test('«اعرضها كأعمدة» asks which chart (one option per chart that changes); every option re-sends a request that names its chart and applies', () => {
  for (const m of [MA, ME]) {
    const r = must(ask(m, 'اعرضها كأعمدة'), 'ask', m.lang); assert.ok(both(r.question) && r.options.length >= 5);
    const ids = optionIds(m, r); assert.equal(new Set(ids).size, ids.length, 'one option per chart');
    for (const [i, o] of r.options.entries()) { assert.ok(both(o.label) && o.label.ar === o.label.en, 'the label is the chart title'); assert.ok(o.text.includes(`"${o.label.ar}"`), 'the text names the chart'); assert.equal(blk(m, ids[i]).title, o.label.ar); }
    // only charts that CHANGE are offered: the one that is already a column chart is not
    assert.ok(!ids.includes('trends:0'), 'the monthly chart is already columns');
    // …and it says so when asked directly
    const d = must(ask(m, 'اعرض الرسم الشهري كأعمدة'), 'apply'); assert.equal(d.noop, true); assert.equal(d.chartId, 'trends:0');
  }
});
test('«حوّل المقارنة إلى رسم خطي»: the comparison chart is the multi-series one over an ordered axis → a line', () => {
  for (const m of [MA, ME]) { const r = must(ask(m, 'حوّل المقارنة إلى رسم خطي'), 'apply'); assert.equal(r.chartId, 'trends:0'); assert.equal(r.kind, 'line'); assert.deepEqual(r.patch, { kind: 'line' }); assert.ok(both(r.note)); }
  const r = must(ask(ME, 'Convert the comparison to a line chart'), 'apply'); assert.equal(r.chartId, 'trends:0');
});
test('«اعرض توزيع غير المحصل حسب البلديات»: a breakdown by municipality of the unpaid/overdue measure (a ranked bar), never a histogram', () => {
  for (const m of [MA, ME]) {
    const r = must(ask(m, 'اعرض توزيع غير المحصل حسب البلديات'), 'apply'); assert.equal(r.chartId, 'nc_exposure:1'); assert.equal(r.patch.dimension, 'municipality'); assert.notEqual(r.kind, 'histogram'); assert.equal(r.kind, 'hbar');
    assert.ok(r.changes.some((c) => c.key === 'dimension' && /بلدية/.test(c.ar) && /municipality/.test(c.en)), 'the dimension change is announced, localised');
    const v = viewAfterRequest(emptyView(), r, m); const shown = blk(applyView(m, v).model, 'nc_exposure:1'); const alt = blk(m, 'nc_exposure:1').alts.byMunicipality;
    assert.deepEqual(shown.labels, alt.labels); assert.equal(sum(shown.series[0].values), sum(alt.series[0].values), 'the figures are the saved municipality figures');
    assert.equal(shown.dim.dimension, 'municipality');
  }
  const e = must(ask(ME, 'Show the distribution of uncollected by municipality'), 'apply'); assert.equal(e.chartId, 'nc_exposure:1');
  // «توزيع المبالغ» IS a histogram
  const h = must(ask(MA, 'اعرض توزيع المبالغ كمدرج تكراري'), 'ask'); assert.ok(h.options.length >= 2);
  assert.equal(parseChartPhrase('اعرض توزيع المبالغ').it.typeId, 'histogram'); assert.equal(parseChartPhrase('اعرض توزيع غير المحصل حسب البلديات').it.typeId, null);
});
test('«اعرض مساهمة مصادر الإيراد بمخطط شجري»: the source chart that CAN be a treemap (the other overlaps net and collected) and the note names it', () => {
  const r = must(ask(MA, 'اعرض مساهمة مصادر الإيراد بمخطط شجري'), 'apply'); assert.equal(r.chartId, 'nc_exposure:2'); assert.equal(r.kind, 'treemap'); assert.ok(r.note.ar.includes(r.chartTitle));
  assert.equal(ask(ME, 'Show the contribution of revenue sources as a treemap').chartId, 'nc_exposure:2');
  // the net/collected source chart itself cannot be a treemap, and the reply says why
  const u = must(ask(MA, 'اعرض "صافي المفوتر والمحصّل حسب مصدر الإيراد" كخريطة شجرية'), 'unsuitable'); assert.ok(both(u.reason) && u.alternatives.length >= 1);
});
test('“Show this as a donut chart.” asks (several charts can); each option applies a donut', () => {
  const r = must(ask(ME, 'Show this as a donut chart.'), 'ask'); assert.ok(r.options.length >= 4);
  for (const x of optionIds(ME, r)) assert.equal(ask(ME, r.options[optionIds(ME, r).indexOf(x)].text).kind, 'donut');
  const sole = synthModel([{ kind: 'hbar', title: 'Net by source', labels: ['SADAD', 'Baladi', 'Fines'], series: [{ label: 'Net', values: [6 * B, 3 * B, 1 * B] }], dim: { dimension: 'source', ordered: false, measures: [{ key: 'net', kind: 'amount' }], additive: false } }]);
  const a = must(ask(sole, 'Show this as a donut chart.'), 'apply'); assert.equal(a.kind, 'donut'); assert.equal(a.chartId, 'syn:0'); // a result with one chart: no question
  must(ask(sole, 'اعرضه كدونات'), 'apply');
});
test('“Compare the Amanahs using grouped bars.”: understood, targets the Amanah comparison (already grouped bars → says so); on a vertical stack it regroups', () => {
  const r = must(ask(ME, 'Compare the Amanahs using grouped bars.'), 'apply'); assert.equal(r.chartId, 'amanah:0'); assert.equal(r.noop, true); assert.ok(both(r.note));
  const m = synthModel([{ ...byAmanahSyn(), kind: 'stacked_hbar', dim: { ...byAmanahSyn().dim, additive: true, whole: { label: 'Net', value: 1 } } }]);
  const x = ask(m, 'Compare the Amanahs using grouped bars.'); must(x, 'apply'); assert.equal(x.noop, undefined); assert.equal(x.kind, 'hbar'); assert.equal(x.patch.grouping, 'grouped');
});

/* ---------------------------------------------------------------- 2. every family name, AR + EN */
const FAMILY = [ // id, [AR phrases], [EN phrases]
  ['bar', ['اعرضها كأعمدة', 'اعرضه كرسم أعمدة', 'اعرضها بشكل أعمدة', 'اعرضها بأعمدة عمودية'], ['show it as columns', 'show as a column chart', 'make it a column chart']],
  ['hbar', ['اعرضها كأشرطة أفقية', 'اعرضها كأعمدة أفقية', 'اعرضها كشريطي'], ['show it as horizontal bars', 'show as a horizontal bar chart', 'show it as horizontal columns']],
  ['stacked_col', ['اعرضها كأعمدة مكدسة', 'اعرضها كأعمدة مكدّسة'], ['show it as stacked columns', 'show as a stacked column chart']],
  ['stacked_hbar', ['اعرضها كأشرطة مكدسة', 'اعرضها كأعمدة أفقية مكدسة'], ['show it as stacked horizontal bars', 'show it as stacked bars horizontal']],
  ['stacked100_col', ['اعرضها كأعمدة مكدسة 100%', 'اعرضها كمكدس 100%', 'اعرضها كأعمدة مكدسة بالنسبة المئوية'], ['show it as 100% stacked columns', 'show it as a 100 % stacked column chart', 'show it as percent stacked columns']],
  ['stacked100_hbar', ['اعرضها كأشرطة مكدسة 100%', 'اعرضها كأعمدة أفقية مكدسة 100%'], ['show it as 100% stacked horizontal bars']],
  ['line', ['اعرضها كرسم خطي', 'اعرضها خطي', 'حولها إلى خطي'], ['show it as a line chart', 'turn it into a line']],
  ['line_markers', ['اعرضها كرسم خطي بنقاط', 'اعرضها كخطي بعلامات'], ['show it as a line chart with markers', 'show it as a line with markers']],
  ['area', ['اعرضها كرسم مساحي', 'اعرضها كمساحة', 'حولها إلى مساحي'], ['show it as an area chart', 'show it as an area']],
  ['stacked_area', ['اعرضها كرسم مساحي مكدس', 'اعرضها كمساحة مكدسة'], ['show it as a stacked area chart', 'show it as stacked area']],
  ['combo', ['اعرضها كرسم مركب', 'اعرضها كأعمدة وخط', 'اعرضها كأعمدة مع خط'], ['show it as a combo chart', 'show it as columns and a line', 'show it as bars with a line']],
  ['waterfall', ['اعرضها كرسم شلال', 'اعرضها كشلال'], ['show it as a waterfall chart', 'show it as a waterfall']],
  ['pie', ['اعرضها كرسم دائري', 'اعرضها كدائري', 'اعرضها كفطيرة'], ['show it as a pie chart', 'show as a pie']],
  ['donut', ['اعرضها كرسم حلقي', 'اعرضها كدونات', 'اعرضها كدونت'], ['show it as a donut chart', 'show as a doughnut']],
  ['treemap', ['اعرضها كخريطة شجرية', 'اعرضها بمخطط شجري', 'اعرضها كشجري'], ['show it as a treemap', 'show it as a tree map']],
  ['sunburst', ['اعرضها كرسم شمسي', 'اعرضها كسنبرست'], ['show it as a sunburst chart', 'show it as a sunburst']],
  ['heatmap', ['اعرضها كخريطة حرارية'], ['show it as a heat map', 'show it as a heatmap']],
  ['scatter', ['اعرضها كرسم تشتت', 'اعرضها كنقاط'], ['show it as a scatter plot', 'show it as a scatter chart']],
  ['bubble', ['اعرضها كرسم فقاعات', 'اعرضها كفقاعات'], ['show it as a bubble chart', 'show it as bubbles']],
  ['histogram', ['اعرضها كمدرج تكراري', 'اعرضها كهيستوغرام'], ['show it as a histogram']],
  ['box', ['اعرضها كرسم صندوقي', 'اعرضها كمخطط صندوقي'], ['show it as a box plot', 'show it as a boxplot']],
  ['pareto', ['اعرضها كرسم باريتو', 'اعرضها كباريتو'], ['show it as a pareto chart', 'show it as a Pareto']],
  ['bullet', ['اعرضها كرسم رصاصة', 'اعرضها كتقدم مقابل المستهدف', 'اعرضها كرصاصي'], ['show it as a bullet chart', 'show it as progress against target']],
  ['sankey', ['اعرضها كسانكي', 'اعرضها كرسم تدفق'], ['show it as a sankey chart', 'show it as a Sankey', 'show it as a flow chart']]
];
const resolvedId = (q) => { const p = parseChartPhrase(q); const it = p.it; const id = it.typeId || (it.fam ? (it.orientation === 'h' ? 'hbar' : 'bar') : null); return id ? resolveType({ kind: id, ...(it.orientation ? { orientation: it.orientation } : {}), ...(it.grouping ? { grouping: it.grouping } : {}), ...(it.mode ? { mode: it.mode } : {}) }, {}) : null; };
test('every chart family name, in Arabic and English, is read as its catalog type id', () => {
  assert.equal(FAMILY.length, 24); assert.deepEqual(FAMILY.map((f) => f[0]).sort(), CHART_TYPES.map((t) => t.id).sort());
  for (const [id, ars, ens] of FAMILY) for (const q of [...ars, ...ens]) assert.equal(resolvedId(q), id, `«${q}» → ${resolvedId(q)} (want ${id})`);
});
test('the phrase the module offers for every type reads back as that type (the re-sendable texts are parseable)', () => {
  // through the alternatives of an unsuitable answer: each text must name its own type
  const wm = synthModel([{ ...waterfallSyn(), alts: { sankey: { nodes: [{ id: 'a', label: 'Gross', col: 0 }, { id: 'b', label: 'Net', col: 1 }, { id: 'c', label: 'Excl', col: 1 }], links: [{ from: 'a', to: 'b', value: 70 * B }, { from: 'a', to: 'c', value: 30 * B }] } } }]);
  const u = must(ask(wm, 'Show it as a bar chart'), 'unsuitable'); assert.ok(u.alternatives.some((x) => x.typeId === 'sankey'));
  // every catalog type, as the alternative of a chart for which it is available
  const seen = new Set();
  for (const m of [MA, ME]) for (const b of chartBlocks(m)) {
    const r = ask(m, `${m.lang === 'ar' ? 'اعرض' : 'Show'} "${b.title}" ${m.lang === 'ar' ? 'كمدرج تكراري' : 'as a histogram'}`);
    if (r.type === 'unsuitable') for (const alt of r.alternatives.filter((x) => x.typeId !== 'table')) { assert.equal(resolvedId(alt.text.replace(/"[^"]*"/g, ' ')), alt.typeId, alt.text); seen.add(alt.typeId); }
  }
  assert.ok(seen.size >= 5, [...seen].join());
});
test('against the real report: a family name applies exactly where the catalog allows it, and is an `unsuitable` with the catalog\'s reason elsewhere', () => {
  for (const m of [MA, ME]) {
    const charts = chartBlocks(m);
    for (const [id, ars, ens] of FAMILY) {
      const q = m.lang === 'ar' ? ars[0] : ens[0];
      const r = ask(m, q); assert.ok(r, `${id}: «${q}»`);
      const fits = charts.filter((c) => { const e = evaluateChart(c, id === 'line_markers' ? 'line_markers' : id, {}, { lang: m.lang }); return e.ok && typeIdOf(c) !== e.typeId; });
      if (!fits.length) {
        // either every chart that could be it is already it (a no-op) or none can: the reason is the catalog's
        const already = charts.some((c) => typeIdOf(c) === id);
        if (already) assert.ok(r.type === 'apply' && r.noop === true, `${id}: already shown → ${r.type}`);
        else { must(r, 'unsuitable', id); assert.ok(both(r.reason) && r.reason.ar.length > 20); assert.ok(r.alternatives.length >= 1 && r.alternatives.length <= 4); }
      } else if (['bar', 'hbar'].includes(id)) { // «bars» / «columns» are family words: a stacked chart stays stacked, so the set can be smaller than the catalog's
        assert.ok(['apply', 'ask'].includes(r.type), id); const got = r.type === 'ask' ? optionIds(m, r) : [r.chartId];
        for (const g of got) assert.ok(fits.some((c) => c.id === g), `${id}: ${g} is a chart the catalog allows`);
      } else if (fits.length === 1) { must(r, 'apply', id); assert.equal(r.chartId, fits[0].id, id); assert.equal(r.kind, evaluateChart(fits[0], id, {}, { lang: m.lang }).typeId); }
      else { must(r, 'ask', id); assert.equal(r.options.length, fits.length, `${id}: one option per chart that changes`); }
    }
  }
});

/* ---------------------------------------------------------------- 3. ambiguity: never guess */
test('several plausible charts → a question with one option per chart; the option texts apply to the chart they name', () => {
  const r = must(ask(ME, 'Show it as a histogram'), 'ask'); const want = chartBlocks(ME).filter((c) => evaluateChart(c, 'histogram').ok && c.kind !== 'histogram').map((c) => c.id);
  assert.deepEqual(optionIds(ME, r).sort(), want.sort());
  const p = must(ask(ME, 'Show it as a Pareto chart'), 'ask'); assert.ok(p.options.length >= 3);
  for (const id of optionIds(ME, p)) assert.equal(ask(ME, `Show "${blk(ME, id).title}" as a Pareto chart`).chartId, id);
  // a chart named by a title that two charts share words with is still exact
  assert.equal(ask(ME, 'Show "Net billed and collected by Amanah" as columns').chartId, 'amanah:0');
  assert.equal(ask(MA, 'اعرض "صافي المفوتر والمحصّل حسب الأمانة" كأعمدة').chartId, 'amanah:0');
  assert.equal(ask(MA, 'اعرض "صافي المفوتر والمحصّل حسب الأمانة" كأعمدة').kind, 'bar');
  // …and a title that matches nothing is said so (not guessed)
  must(ask(ME, 'Show "No such chart anywhere" as columns'), 'need');
});
test('the question text says what is asked and has both languages', () => {
  const r = must(ask(ME, 'اعرضها كحلقي'), 'ask'); assert.ok(both(r.question)); assert.ok(AR_RE.test(r.question.ar) && !AR_RE.test(r.question.en));
  assert.ok(r.question.ar.includes('حلقي'));
});

/* ---------------------------------------------------------------- 4. unsuitable: the reason is the catalog's, the alternatives are ready */
test('a donut over negative values, over unrelated series, a line over Amanahs: refused with the catalog\'s reason and ≤ 4 ready alternatives', () => {
  const cases = [
    [synthModel([negBar()]), 'Show it as a donut chart', /negative/i], [synthModel([mixedBar()]), 'Show it as a donut chart', /measure|different/i], [synthModel([byAmanahSyn()]), 'Show it as a line chart', /order/i],
    [synthModel([byAmanahSyn()]), 'اعرضه كرسم خطي', /order/i], [synthModel([negBar()]), 'اعرضه كدائري', /negative/i]
  ];
  for (const [m, q, re] of cases) {
    const r = must(ask(m, q), 'unsuitable', q); assert.ok(both(r.reason)); assert.ok(re.test(r.reason.en), `${q}: ${r.reason.en}`);
    const direct = evaluateChart(m.sections[0].blocks[0], /خطي|line/.test(q) ? 'line' : 'donut', {}, { lang: 'en' }); assert.ok(r.reason.en.includes(direct.reason.en), 'the reason is the catalog\'s');
    assert.ok(r.alternatives.length >= 1 && r.alternatives.length <= 4); for (const a of r.alternatives) { assert.ok(both(a.label) && typeof a.text === 'string' && a.text.length > 3 && 'typeId' in a); if (a.typeId !== 'table') assert.ok(evaluateChart(m.sections[0].blocks[0], a.typeId).ok, `${a.typeId} is compatible`); assert.notEqual(a.typeId, /خطي|line/.test(q) ? 'line' : 'donut'); }
  }
  // the AR reason is Arabic, the EN one English
  const r = ask(synthModel([negBar()]), 'Show it as a donut chart'); assert.ok(AR_RE.test(r.reason.ar) && /negative/i.test(r.reason.en));
});
test('a waterfall is never turned into a bar/line/pie: the reason, the valid alternative (Sankey) and the table; never an unrelated chart', () => {
  for (const q of ['Show it as a bar chart', 'Show it as a line chart', 'Show it as a pie chart', 'اعرضه كأعمدة', 'اعرضه كدائري']) {
    const m = synthModel([{ ...waterfallSyn(), alts: { sankey: { nodes: [{ id: 'a', label: 'Gross', col: 0 }, { id: 'b', label: 'Net', col: 1 }, { id: 'c', label: 'Excl', col: 1 }], links: [{ from: 'a', to: 'b', value: 70 * B }, { from: 'a', to: 'c', value: 30 * B }] } } }]);
    const r = must(ask(m, q), 'unsuitable', q); assert.ok(/reconciliation|مطابقة/.test(`${r.reason.en} ${r.reason.ar}`));
    assert.ok(r.alternatives.some((a) => a.typeId === 'sankey') && r.alternatives.some((a) => a.typeId === 'table'), q);
    assert.ok(r.alternatives.every((a) => ['sankey', 'table', 'waterfall'].includes(a.typeId)), 'no unrelated chart');
  }
  // without the extra data the Sankey is not offered; the table still is
  const bare = ask(synthModel([waterfallSyn()]), 'Show it as a bar chart'); assert.deepEqual(bare.alternatives.map((a) => a.typeId), ['table']);
  // on the real report: the executive waterfall, by position
  const real = must(ask(MA, 'اعرض الرسم الأول كأعمدة'), 'unsuitable'); assert.ok(real.alternatives.some((a) => a.typeId === 'sankey'));
  // the table alternative is a request the chat layer already understands
  assert.deepEqual(interpretChat(real.alternatives.find((a) => a.typeId === 'table').text, { hasResult: true, hasCharts: true, hasTables: true }), { type: 'only', only: 'tables' });
});
test('a heat map is not re-drawn; modifiers that do not apply (sorting a time axis) are explained, never silently ignored', () => {
  const h = must(ask(ME, 'Show "Collection rate: Amanah × revenue source" as a pie chart'), 'unsuitable'); assert.ok(/matrix|heat map/i.test(h.reason.en));
  const s = must(ask(ME, 'Sort the monthly chart descending'), 'unsuitable'); assert.ok(/time|ordered|axis/i.test(s.reason.en), s.reason.en);
  const c = must(ask(synthModel([{ kind: 'line', basis: 'cumulative', title: 'Cumulative net billed', labels: ['Jan 26', 'Feb 26', 'Mar 26'], series: [{ label: 'Cumulative', values: [1 * B, 3 * B, 6 * B] }], dim: { dimension: 'month', ordered: true, measures: [{ key: 'net', kind: 'amount' }], additive: false } }]), 'Show it as a donut chart'), 'unsuitable'); assert.ok(/cumulative|running/i.test(c.reason.en));
  const back = must(ask(synthModel([{ kind: 'line', basis: 'cumulative', title: 'Cumulative net billed', labels: ['Jan 26', 'Feb 26'], series: [{ label: 'Cumulative', values: [1 * B, 3 * B] }], dim: { dimension: 'month', ordered: true, measures: [{ key: 'net', kind: 'amount' }], additive: false } }]), 'Show it monthly, not cumulative'), 'unsuitable'); assert.ok(/saved|محفوظة/.test(`${back.reason.en}${back.reason.ar}`));
});

/* ---------------------------------------------------------------- 5. data-dependent types whose data was not saved */
test('a data-dependent type without its saved data is `unsuitable`, saying what is missing', () => {
  const m = synthModel([byAmanahSyn()]);
  for (const [q, re] of [['Show it as a histogram', /distribution|bins/i], ['Show it as a box plot', /statistics|observations/i], ['Show it as a sankey chart', /flows|reconcile/i], ['Show it as a bullet chart', /target/i], ['Show it as a sunburst chart', /hierarchy/i]]) {
    const r = must(ask(m, q), 'unsuitable', q); assert.ok(re.test(r.reason.en), `${q}: ${r.reason.en}`); assert.ok(AR_RE.test(r.reason.ar)); assert.ok(r.alternatives.length >= 1);
  }
  // the real report: no box for the exclusions chart (no distribution saved), Amanah has one
  const e = must(ask(ME, 'Show "Exclusions by reason" as a box plot'), 'unsuitable'); assert.ok(/statistics|observations/i.test(e.reason.en));
  assert.equal(must(ask(ME, 'Show "Net billed and collected by Amanah" as a box plot'), 'apply').kind, 'box');
  // a breakdown the saved model does not hold: explained, with a way forward (the legacy section command)
  const d = must(ask(ME, 'Show the distribution of exclusions by municipality'), 'unsuitable'); assert.ok(/municipality/i.test(d.reason.en) && /new report version/i.test(d.reason.en));
  assert.ok(d.alternatives.some((a) => /compare by municipality/i.test(a.text)));
  assert.equal(interpretChat(d.alternatives.find((a) => /compare by municipality/i.test(a.text)).text, { hasResult: true, resultKind: 'report', hasCharts: true, hasTables: true }).type, 'section');
});

/* ---------------------------------------------------------------- 6. customisation */
test('orientation, amount ↔ share, grouped ↔ stacked: the family member changes; the share/aggregation change is stated in the note', () => {
  const m = synthModel([byAmanahSyn()]);
  let { r } = run(m, 'Make it vertical'); assert.equal(r.kind, 'bar'); assert.deepEqual(r.patch, { orientation: 'v' });
  ({ r } = run(m, 'اعرضه عموديا')); assert.equal(r.kind, 'bar');
  ({ r } = run(m, 'Show it as horizontal columns')); assert.ok(r.noop || r.kind === 'hbar');
  ({ r } = run(m, 'اعرضها كنسبة مئوية')); assert.equal(r.patch.mode, 'share'); assert.ok(r.changes.some((c) => c.key === 'percentage') && /نسبة|النسبة/.test(r.note.ar) && /Percentage basis/.test(r.note.en), 'the basis change is in the note');
  ({ r } = run(m, 'Show it as a percentage')); assert.equal(r.patch.mode, 'share');
  // a non-additive pair cannot be stacked: the reason, not a wrong chart
  const st1 = must(ask(m, 'Show it stacked'), 'unsuitable'); assert.ok(/overlap|double count/i.test(st1.reason.en));
  const add = synthModel([{ kind: 'bar', title: 'Collected and uncollected by Amanah', labels: ['Riyadh', 'Jeddah', 'Makkah'], series: [{ label: 'Collected', role: 'collected', values: [6 * B, 5 * B, 4 * B] }, { label: 'Uncollected', role: 'uncollected', values: [3 * B, 2 * B, 1 * B] }], dim: { dimension: 'amanah', ordered: false, additive: true, whole: { label: 'Net', value: 21 * B }, measures: [{ key: 'collected', kind: 'amount' }, { key: 'uncollected', kind: 'amount' }] } }]);
  assert.equal(must(ask(add, 'اعرضها مكدسة'), 'apply').kind, 'stacked_col'); assert.equal(ask(add, 'Show it stacked').kind, 'stacked_col');
  assert.equal(ask(add, 'Show it as stacked horizontal bars').kind, 'stacked_hbar'); assert.equal(ask(add, 'Show it as 100% stacked columns').kind, 'stacked100_col');
  assert.equal(ask(add, 'اعرضها كمكدس 100% أفقي').kind, 'stacked100_hbar');
  assert.equal(ask(add, 'Show it as a percentage').kind, 'bar', 'plain bars become shares of their series total');
  const g = ask(add, 'Show it stacked'); const v2 = viewAfterRequest(emptyView(), g, add); const grouped = ask(add, 'Show it grouped', v2); assert.equal(grouped.kind, 'bar'); assert.equal(grouped.patch.grouping, 'grouped');
});
test('monthly ↔ cumulative', () => {
  const m = synthModel([monthlySyn()]);
  const c = run(m, 'اعرضه تراكميا').r; assert.equal(c.patch.cumulative, true); assert.ok(c.changes.some((x) => x.key === 'basis'));
  const v = viewAfterRequest(emptyView(), c, m); const shown = applyView(m, v).model.sections[0].blocks[0]; assert.equal(shown.basis, 'cumulative');
  assert.equal(sum(shown.series[0].values.slice(-1)), sum(m.sections[0].blocks[0].series[0].values), 'the last running value is the period total');
  assert.equal(ask(m, 'Show it as cumulative').patch.cumulative, true); assert.equal(ask(m, 'Show it cumulatively as a line').kind, 'line');
});
test('sort (descending / ascending / by name) and Top N with «Other» (the sum is kept)', () => {
  const m = synthModel([byAmanahSyn()]); const orig = m.sections[0].blocks[0];
  for (const [q, sort] of [['sort it descending', 'desc'], ['رتبها تنازليا', 'desc'], ['من الأكبر إلى الأصغر', 'desc'], ['sort ascending', 'asc'], ['رتبها تصاعديا', 'asc'], ['sort it by name', 'label'], ['رتبها أبجديا', 'label'], ['sort the chart', 'desc']]) {
    const r = ask(m, q.startsWith('من') ? `اعرضها ${q}` : q); must(r, 'apply', q); assert.equal(r.patch.sort, sort, q);
  }
  const asc = run(m, 'sort ascending'); const sh = applyView(m, asc.view).model.sections[0].blocks[0]; assert.deepEqual(sh.labels, [...orig.labels].reverse().sort((a, b) => orig.series[0].values[orig.labels.indexOf(a)] - orig.series[0].values[orig.labels.indexOf(b)])); assert.equal(sum(sh.series[0].values), sum(orig.series[0].values));
  for (const [q, n] of [['show only the top 5', 5], ['اعرض أعلى 5 فقط', 5], ['top six with other', 6], ['اعرض أفضل خمسة فقط', 5], ['show the top 3 as a chart', 3]]) { const r = ask(m, q); must(r, 'apply', q); assert.equal(r.patch.topN, n, q); }
  const t5 = run(m, 'show the top 3 with other'); const shown = applyView(m, t5.view).model.sections[0].blocks[0];
  assert.equal(shown.labels.length, 4); assert.ok(shown.otherLabel && shown.labels[3] === shown.otherLabel); assert.equal(shown.series[0].values[3], orig.series[0].values.slice(3).reduce((a, b) => a + b, 0));
  for (let k = 0; k < 2; k += 1) assert.equal(sum(shown.series[k].values), sum(orig.series[k].values), 'Top N keeps every series sum');
  assert.ok(t5.r.changes.some((c) => c.key === 'topn'));
  // Top N on a time axis is refused with the reason
  assert.equal(must(ask(synthModel([monthlySyn()]), 'show only the top 3'), 'unsuitable').type, 'unsuitable');
  // more than the chart has: nothing to fold, and it says so
  assert.equal(ask(m, 'top ten with other').noop, true);
  assert.equal(ask(ME, 'show the Amanah chart top 10 with other').type, 'ask'); assert.equal(ask(ME, 'show "Net billed and collected by Amanah" top 10 with other').patch.topN, 10);
});
test('labels and legend: hide / show, in both languages', () => {
  const m = synthModel([byAmanahSyn()]);
  for (const [q, key, val] of [['اخف القيم', 'labels', false], ['hide the labels', 'labels', false], ['أخفِ الأرقام', 'labels', false], ['without labels', 'labels', false], ['بدون قيم', 'labels', false], ['اعرض القيم', 'labels', true], ['show the labels', 'labels', true],
    ['hide the legend', 'legend', false], ['اخف المفتاح', 'legend', false], ['بدون مفتاح', 'legend', false], ['show the legend', 'legend', true], ['أظهر وسيلة الإيضاح', 'legend', true]]) {
    const r = ask(m, q); must(r, 'apply', q); assert.equal(r.patch[key], val, q); assert.deepEqual(Object.keys(r.patch), [key], q);
  }
  const { view } = run(m, 'hide the labels'); const b = applyView(m, view).model.sections[0].blocks[0]; assert.equal(b.showLabels, false); assert.equal(b.showLegend, undefined);
  const both2 = ask(m, 'show it as columns without labels'); assert.equal(both2.patch.labels, false); assert.equal(both2.kind, 'bar');
});
test('breakdown dimensions: «حسب الأمانة / البلدية / مصدر الإيراد / المنتج» on the report that holds them', () => {
  const am = blk(MA, 'amanah:0'); assert.ok(am.alts.bySource && am.alts.byMunicipality && am.alts.byProduct);
  for (const [q, dim] of [['اعرض "صافي المفوتر والمحصّل حسب الأمانة" حسب البلدية', 'municipality'], ['اعرض "صافي المفوتر والمحصّل حسب الأمانة" حسب مصدر الإيراد', 'source'], ['اعرض "صافي المفوتر والمحصّل حسب الأمانة" حسب المنتج', 'product']]) {
    const r = must(ask(MA, q), 'apply', q); assert.equal(r.chartId, 'amanah:0'); assert.equal(r.patch.dimension, dim);
    const shown = blk(applyView(MA, viewAfterRequest(emptyView(), r, MA)).model, 'amanah:0'); assert.equal(shown.dim.dimension, dim); assert.deepEqual(shown.labels, am.alts[`by${dim[0].toUpperCase()}${dim.slice(1)}`].labels);
  }
  const e = must(ask(ME, 'Show "Net billed and collected by Amanah" by municipality'), 'apply'); assert.equal(e.patch.dimension, 'municipality');
  const e2 = must(ask(ME, 'Show the Amanah chart per revenue source'), 'ask'); assert.deepEqual(optionIds(ME, e2).sort(), ['amanah:0', 'nc_exposure:1']);
  // a dimension the chart already has just selects it («حسب الأمانة» + a type)
  const sel = ask(ME, 'Show by Amanah as columns'); assert.ok(sel.type === 'ask' || sel.type === 'apply'); if (sel.type === 'ask') assert.ok(sel.options.every((o) => /Amanah/i.test(o.label.en)));
  // plain «قارن حسب البلدية» is NOT a chart request: the legacy section command keeps it
  assert.equal(ask(MA, 'قارن حسب البلدية'), null); assert.equal(ask(ME, 'compare by municipality'), null);
});

/* ---------------------------------------------------------------- 7. relative references */
test('«الرسم الأول/الثاني/الأخير», “the second chart”, “chart 3”, by position, topic words and title words', () => {
  const ids = chartBlocks(MA).map((b) => b.id);
  assert.equal(ask(MA, 'اعرض الرسم الثاني كحلقي').chartId, ids[1]); assert.equal(ask(ME, 'Show the second chart as a donut').chartId, ids[1]);
  assert.equal(ask(MA, 'اعرض الرسم الثالث كأعمدة مكدسة 100%').type, 'unsuitable', 'the monthly chart is not additive');
  assert.equal(ask(ME, 'Show chart 2 as a donut').chartId, ids[1]); assert.equal(ask(MA, 'اعرض الرسم رقم 2 كحلقي').chartId, ids[1]); assert.equal(ask(MA, 'اعرض الرسم 2 كحلقي').chartId, ids[1]);
  assert.equal(must(ask(MA, 'اعرض الرسم الأخير كأعمدة'), 'unsuitable').type, 'unsuitable', 'the last chart is a heat map');
  assert.equal(ask(ME, 'Show the last chart as a bar chart').type, 'unsuitable');
  assert.equal(must(ask(ME, 'Show the sixth chart as a donut'), 'unsuitable').type, 'unsuitable', 'the sixth is the Amanah × source heat map');
  assert.equal(must(ask(ME, 'Show the ninth chart as a donut'), 'apply').chartId, ids[8]);
  must(ask(ME, 'Show chart 40 as a donut'), 'need'); must(ask(MA, 'اعرض الرسم رقم 40 كحلقي'), 'need');
});
test('by topic: the monthly chart, the exclusions chart, the aging chart, the cumulative chart, by dimension', () => {
  assert.equal(ask(MA, 'اعرض الرسم الشهري كخطي').chartId, 'trends:0'); assert.equal(ask(ME, 'Show the monthly chart as a line').chartId, 'trends:0');
  assert.equal(ask(MA, 'اعرض رسم الاستبعادات كحلقي').chartId, 'exclusions:0'); assert.equal(ask(ME, 'Show the exclusions chart as a donut').chartId, 'exclusions:0');
  assert.equal(ask(ME, 'Show the aging chart as a Pareto chart').type, 'ask', 'the standing and the non-collection aging charts');
  assert.equal(ask(MA, 'اعرض الرسم التراكمي كأعمدة').chartId, 'trends:1'); assert.equal(ask(ME, 'Show the cumulative chart as columns').chartId, 'trends:1');
  assert.equal(ask(ME, 'Show the sources chart as a donut').chartId, 'nc_exposure:2', 'the net/collected source chart overlaps, so only the overdue one can be a donut');
  assert.equal(ask(ME, 'Show the waterfall as a Sankey').type, 'ask', 'two waterfalls (gross→net and gross unpaid→net unpaid)');
  assert.equal(ask(ME, 'Show the line chart as columns').chartId, 'trends:1'); assert.equal(ask(MA, 'اعرض الرسم الخطي كأعمدة').chartId, 'trends:1');
});
test('«حسب الأمانة» + a type selects the charts by that dimension; several → ask; one → apply', () => {
  const r = ask(MA, 'اعرض حسب الأمانة كأعمدة'); assert.ok(r.type === 'ask'); assert.deepEqual(optionIds(MA, r).sort(), ['amanah:0', 'nc_exposure:1']);
  assert.equal(ask(ME, 'Show the Amanah chart as a treemap').type, 'ask');
});

/* ---------------------------------------------------------------- 8. reset */
test('reset: back to the original / the recommended chart; nothing changed → says so; several changed → asks', () => {
  const m = synthModel([byAmanahSyn(), monthlySyn()]);
  const noneYet = must(ask(m, 'reset the chart'), 'need'); assert.ok(both(noneYet.question));
  let v = run(m, 'Show "Net billed and collected by Amanah" as columns').view;
  const r1 = must(ask(m, 'reset the chart', v), 'apply'); assert.equal(r1.reset, true); assert.equal(r1.chartId, 'syn:0'); const v1 = viewAfterRequest(v, r1, m); assert.equal(chartConfigOf(v1, 'syn:0'), null);
  assert.equal(kindAfter(m, v1, 'syn:0'), 'hbar');
  for (const q of ['ارجع للرسم الموصى به', 'أعد الرسم إلى الشكل الأصلي', 'ارجع للرسم الأصلي', 'restore the chart', 'revert the chart to the default', 'go back to the original chart', 'reset the chart to the recommended one']) assert.equal(must(ask(m, q, v), 'apply', q).chartId, 'syn:0');
  v = run(m, 'Show "Net billed by month" as a line', v).view;
  const two = must(ask(m, 'ارجع للرسم الموصى به', v), 'ask'); assert.equal(two.options.length, 2); for (const o of two.options) must(ask(m, o.text, v), 'apply', o.text);
  assert.equal(ask(m, 'reset the monthly chart', v).chartId, 'syn:1'); assert.equal(ask(m, 'ارجع الرسم الشهري إلى الأصل', v).chartId, 'syn:1'); assert.equal(ask(m, 'ارجع رسم الأمانات للأصل', v).chartId, 'syn:0');
  const rx = run(MA, 'اعرض رسم الاستبعادات كحلقي'); assert.equal(must(ask(MA, 'restore the exclusions chart', rx.view), 'apply').chartId, 'exclusions:0'); assert.equal(ask(MA, 'استرجع رسم الاستبعادات', rx.view).reset, true);
  assert.equal(ask(m, 'reset "Net billed by month"', v).chartId, 'syn:1'); assert.equal(ask(m, 'reset the first chart', v).chartId, 'syn:0');
  const nochange = ask(m, 'reset the second chart', emptyView()); assert.equal(nochange.noop, true);
  // a chart whose recommended type differs from the one the builder chose goes to the recommended type
  const long = { kind: 'bar', title: 'Long names', labels: Array.from({ length: 14 }, (_, i) => `Municipality number ${i + 1}`), series: [{ label: 'Net', values: Array.from({ length: 14 }, (_, i) => (i + 1) * B) }], dim: { dimension: 'municipality', ordered: false, measures: [{ key: 'net', kind: 'amount' }], additive: false } };
  const lm = synthModel([long]);
  const rr = must(ask(lm, 'go back to the recommended chart', run(lm, 'Show it as columns without labels').view), 'apply'); assert.equal(rr.patch.kind, 'hbar'); assert.equal(rr.reset, false);
});

/* ---------------------------------------------------------------- 9. the view round trip: the figures never change */
const grand = (b) => (b.series || []).reduce((t, s) => t + sum(s.values || []), 0);
test('viewAfterRequest + applyView: the displayed series sums equal the saved ones (Top N keeps the sum); persisted views survive cleanView', () => {
  const steps = ['اعرض "صافي المفوتر والمحصّل حسب الأمانة" كأعمدة', 'اعرض "صافي المفوتر والمحصّل حسب الأمانة" مكدسة', 'رتب "صافي المفوتر والمحصّل حسب الأمانة" تنازليا', 'اعرض "الاستبعادات حسب السبب" كحلقي', 'اعرض "الاستبعادات حسب السبب" أعلى 3', 'اعرض "الاستبعادات حسب السبب" بدون قيم', 'اعرض "المحصّل وغير المحصّل من صافي المفوتر" كمكدس 100%', 'اعرض "الأمانات الأعلى تعرّضاً للمتأخر" كخريطة شجرية'];
  let view = emptyView(); let applied = 0;
  for (const q of steps) {
    const r = ask(MA, q, view); if (r && r.type === 'apply' && !r.noop) { view = viewAfterRequest(view, r, MA); applied += 1; }
  }
  assert.ok(applied >= 4, `applied ${applied}`);
  const shown = applyView(MA, view).model;
  for (const b of chartBlocks(MA)) {
    const d = blk(shown, b.id); if (!d || !b.series?.length || b.kind === 'waterfall' || b.kind === 'heatmap') continue;
    if (d.config?.mode === 'share' || /100/.test(d.kind)) continue;
    if (d.kind === 'treemap' || d.kind === 'sunburst') { if (d.tree && !d.tree.children?.some((c) => c.children)) assert.ok(Math.abs(d.tree.value - sum(b.series[0].values)) < 1, `${b.id} treemap total`); continue; }
    if (['donut', 'pie', 'bar', 'hbar', 'stacked_col', 'stacked_hbar'].includes(d.kind)) assert.ok(Math.abs(grand(d) - grand(b)) < 1, `${b.id} (${d.kind}) ${grand(d)} vs ${grand(b)}`);
  }
  const rt = applyView(MA, cleanView(JSON.parse(JSON.stringify(view)))).model; assert.equal(JSON.stringify(chartBlocks(rt).map((b) => [b.id, b.kind, b.showLabels])), JSON.stringify(chartBlocks(shown).map((b) => [b.id, b.kind, b.showLabels])));
  assert.equal(typeIdOf(blk(shown, 'exclusions:0')), 'donut'); assert.equal(blk(shown, 'exclusions:0').showLabels, false); assert.equal(typeIdOf(blk(shown, 'nc_exposure:1')), 'treemap');
  // the other results never touch the view
  const v0 = emptyView(); for (const r of [null, { type: 'ask' }, { type: 'unsuitable' }, { type: 'need' }, { type: 'apply', noop: true, chartId: 'x', patch: { kind: 'pie' } }]) assert.equal(viewAfterRequest(v0, r, MA), v0);
});
test('every request that applies is really applied by applyView (same type), keeps the figures, and nothing is skipped', () => {
  const phr = { ar: ['كأعمدة', 'كأشرطة أفقية', 'كحلقي', 'كدائري', 'كباريتو', 'كخريطة شجرية', 'كخطي', 'كمساحي', 'مكدسة', 'أعلى 3', 'مرتبة تصاعديا', 'بدون قيم', 'كنسبة مئوية', 'تراكميا', 'كأعمدة مكدسة 100%', 'كمدرج تكراري', 'كرسم صندوقي', 'كفقاعات', 'كسانكي'],
    en: ['as columns', 'as horizontal bars', 'as a donut chart', 'as a pie chart', 'as a Pareto chart', 'as a treemap', 'as a line chart', 'as an area chart', 'stacked', 'top 3', 'sorted ascending', 'without labels', 'as a percentage', 'cumulative', 'as a 100% stacked column chart', 'as a histogram', 'as a box plot', 'as a bubble chart', 'as a sankey chart'] };
  let applied = 0; let refused = 0; let checked = 0;
  for (const m of [MA, ME]) for (const b of chartBlocks(m)) for (const ph of phr[m.lang]) {
    const r = ask(m, `${m.lang === 'ar' ? 'اعرض' : 'Show'} "${b.title}" ${ph}`); assert.ok(r, `${b.id} ${ph}`);
    if (r.type !== 'apply' || r.noop) { assert.ok(['unsuitable', 'apply'].includes(r.type), `${b.id} ${ph}: ${r.type}`); if (r.type === 'unsuitable') refused += 1; continue; }
    applied += 1; assert.equal(r.chartId, b.id); const v = viewAfterRequest(emptyView(), r, m); const ap = applyView(m, v); assert.equal(ap.skipped, 0, `${b.id} ${ph}: skipped`);
    const shown = blk(ap.model, b.id); assert.equal(typeIdOf(shown), r.kind, `${b.id} ${ph}: ${typeIdOf(shown)} vs ${r.kind}`);
    const isShare = r.patch.mode === 'share' || /100/.test(r.kind) || shown.valueKind === 'rate'; const cumulative = r.patch.cumulative === true;
    const plain = shown.series?.length && b.series?.length && !shown.points && !shown.bins && !shown.groups && !shown.tree && !['pareto', 'heatmap'].includes(shown.kind);
    if (plain && !isShare && !cumulative) {
      const want = [grand(b), b.dim?.whole?.value].filter((x) => typeof x === 'number'); checked += 1;
      assert.ok(want.some((w) => Math.abs(grand(shown) - w) <= 1), `${b.id} ${ph}: ${grand(shown)} vs ${want}`);
    }
    assert.ok(both(r.note) && Array.isArray(r.changes) && r.chartTitle === b.title);
  }
  assert.ok(applied >= 60 && refused >= 100 && checked >= 40, `applied ${applied}, refused ${refused}, checked ${checked}`);
});
test('the chart is read as it is SHOWN: a second request sees the first one\'s result (type, dimension, title), with the saved model or the displayed one', () => {
  let view = emptyView(); ({ view } = run(MA, 'اعرض رسم الاستبعادات كحلقي'));
  // «the donut» is now the exclusions chart; as a donut it can show labels / Top N, but «as donut» again is a no-op
  assert.equal(ask(MA, 'اعرض الرسم الحلقي كأعمدة', view).chartId, 'exclusions:0');
  assert.equal(ask(MA, 'اعرض رسم الاستبعادات كحلقي', view).noop, true);
  for (const q of ['اعرض رسم الاستبعادات كخطي', 'اخف القيم في الرسم الحلقي']) assert.deepEqual(JSON.stringify(ask(MA, q, view)), JSON.stringify(askShown(MA, q, view)), q);
  // after a breakdown change the chart is «by municipality» — asking for it by that dimension finds it, and going back is possible
  const v2 = run(MA, 'اعرض "صافي المفوتر والمحصّل حسب الأمانة" حسب البلدية').view;
  assert.equal(ask(MA, 'اعرض حسب البلدية كأعمدة', v2).chartId, 'amanah:0'); assert.equal(ask(MA, 'اعرض "صافي المفوتر والمحصّل حسب البلدية" كأعمدة', v2).chartId, 'amanah:0', 'the title as it is shown now is accepted too'); assert.equal(must(ask(MA, 'اعرض حسب البلدية كحلقي', v2), 'unsuitable').type, 'unsuitable');
  const back = must(ask(MA, 'اعرض "صافي المفوتر والمحصّل حسب الأمانة" حسب الأمانة', v2), 'apply'); assert.equal(back.patch.dimension, 'amanah'); assert.equal(chartConfigOf(viewAfterRequest(v2, back, MA), 'amanah:0'), null);
  // the legacy global command first (every chart a line where it can be), then a per-chart request on top: the base is the legacy result
  const gv = { ...emptyView(), chartKind: 'line' }; const lb = applyView(MA, gv).model;
  const r = interpretChartRequest('اعرض "التراكمي: صافي المفوتر والمحصّل (من بداية الفترة)" كأعمدة', { model: MA, base: lb, view: gv, lang: 'ar' }); must(r, 'apply'); assert.equal(r.chartId, 'trends:1');
  const v3 = viewAfterRequest(gv, r, lb); assert.equal(typeIdOf(blk(applyView(MA, v3).model, 'trends:1')), 'bar'); assert.equal(v3.chartKind, 'line');
});
test('a second request builds on the first (with the saved model and with only the displayed one); keys equal to the default are not stored', () => {
  const m = synthModel([byAmanahSyn()]);
  let { view } = run(m, 'Show it as columns'); assert.deepEqual(chartConfigOf(view, 'syn:0'), { kind: 'bar', orientation: 'v' });
  let r = ask(m, 'hide the labels', view); must(r, 'apply'); view = viewAfterRequest(view, r, m); assert.deepEqual(chartConfigOf(view, 'syn:0'), { kind: 'bar', orientation: 'v', labels: false });
  r = askDisplayedOnly(m, 'show only the top 3', view); must(r, 'apply'); const v2 = viewAfterRequest(view, r, applyView(m, view).model); assert.equal(chartConfigOf(v2, 'syn:0').topN, 3); assert.equal(chartConfigOf(v2, 'syn:0').labels, false);
  const shown = applyView(m, v2).model.sections[0].blocks[0]; assert.equal(shown.labels.length, 4); assert.equal(shown.showLabels, false); assert.equal(shown.kind, 'bar');
  // back to the chart's own form: the stored entry disappears (base model given)
  const back = ask(m, 'show it as horizontal bars', run(m, 'Show it as columns').view); must(back, 'apply'); assert.equal(chartConfigOf(viewAfterRequest(run(m, 'Show it as columns').view, back, m), 'syn:0'), null);
  // the same request twice is a no-op, not a second change
  const again = ask(m, 'Show it as columns', run(m, 'Show it as columns').view); assert.equal(again.noop, true);
  // an already hidden legend
  assert.equal(ask(m, 'hide the labels', view).noop, true);
});

/* ---------------------------------------------------------------- 10. not a chart request → null ; global phrases ; dialect and typos */
test('messages that are not about a chart return null (the other interpreters run)', () => {
  for (const q of ['أنشئ تقرير الأمانات', 'صدّر PDF', 'حوّله إلى عرض تقديمي', 'قارن أداء التحصيل بين الأمانات', 'اعرض الجداول فقط', 'اعرض الكل', 'لخّص النتيجة', 'غيّر الرسم', 'ما هو الرسم الدائري؟', 'what is a donut chart?', 'create the revenue report for March', 'أنشئ تقرير الإيرادات لهذا الشهر كأعمدة', 'اعرض إيرادات مارس 2026 بمخطط دائري', 'export the first chart to PDF', 'show only the charts', 'مرحبا', '', '   ', 'اعرض إيرادات الرياض', 'compare by Amanah', 'ارجع', 'اعرض أعلى 5 أمانات', 'اعرض الإيرادات التراكمية', 'قارن حسب البلدية', 'show the monthly trend', 'compare Riyadh and Jeddah as columns', 'قارن بين الرياض وجدة كأعمدة', 'اعرض إيرادات الرياض كأعمدة', 'show the distribution by municipality as a table', 'ما الفرق بين الدائري والحلقي', 'what is the difference between pie and donut', 'show me the chart', 'make it bigger', 'thanks'])
    assert.equal(ask(MA, q), null, `«${q}»`);
  assert.equal(interpretChartRequest('اعرضها كأعمدة', { model: null }).type, 'need');
  assert.equal(interpretChartRequest('اعرضها كأعمدة', { model: { lang: 'ar', headline: [], sections: [{ key: 'a', blocks: [{ type: 'table' }] }] } }).type, 'need');
  assert.equal(interpretChartRequest(undefined, {}), null); assert.equal(interpretChartRequest(42, {}), null);
});
test('the report interpreter\'s own corpora (new-report requests, 579 sentences) are never taken for chart requests', () => {
  const all = [...CORPUS, ...BLIND, ...HELDOUT, ...HELDOUT2, ...HELDOUT3, ...HELDOUT4, ...HELDOUT5, ...HELDOUT6]; assert.ok(all.length >= 500);
  const taken = all.filter((c) => interpretChartRequest(c.q, { model: ME, view: emptyView(), lang: 'en', base: ME })).map((c) => c.q);
  // a bare «sort by amount descending» is about the current result; everything else is for the report interpreter
  assert.deepEqual(taken.filter((q) => q !== 'sort by amount descending'), [], taken.join(' | '));
});
test('global requests: the legacy command keeps the ones it knows (null); a donut, a treemap … go chart by chart (never read as a pie)', () => {
  const R = { hasResult: true, resultKind: 'report', hasCharts: true, hasTables: true, pendingFiles: 0 };
  for (const q of ['حوّل كل الرسوم إلى خطي', 'غيّر الرسوم إلى أعمدة', 'Change all charts to a line chart', 'make every chart a bar chart', 'حوّل جميع الرسوم إلى دائري', 'change all the charts to a pie chart', 'show all charts as horizontal bars']) {
    assert.equal(ask(MA, q), null, q); assert.ok(interpretChat(q, R), `legacy still reads «${q}»: ${JSON.stringify(interpretChat(q, R))}`); assert.equal(interpretChat(q, R).type, 'chart');
  }
  for (const q of ['حوّل كل الرسوم إلى حلقي', 'Change all charts to a treemap', 'حوّل كل الرسوم إلى خريطة شجرية', 'hide the labels on all charts']) { const r = ask(MA, q); assert.equal(r.type, 'ask', q); assert.ok(both(r.question) && r.options.length >= 2); }
  assert.equal(ask(MA, 'ارجع كل الرسوم إلى الأصل'), null);
  // the legacy command no longer turns a donut into a pie
  for (const q of ['Change all charts to a donut chart', 'Show this as a donut chart.', 'حوّل كل الرسوم إلى دونات']) { const l = interpretChat(q, R); assert.ok(!l || l.type !== 'chart', `${q}: ${JSON.stringify(l)}`); }
});
test('Arabic dialects, spelling variants and typos read like the standard forms', () => {
  const sole = synthModel([{ kind: 'hbar', title: 'Net by source', labels: ['SADAD', 'Baladi', 'Fines'], series: [{ label: 'Net', values: [6 * B, 3 * B, 1 * B] }], dim: { dimension: 'source', ordered: false, measures: [{ key: 'net', kind: 'amount' }], additive: false } }]);
  const want = { 'اعرضه كدايري': 'pie', 'ورني اياه دائري': 'pie', 'وريني ياه كدائره': 'pie', 'ابغاه دونت': 'donut', 'خليه دونات': 'donut', 'اعرضة كدائرى': 'pie', 'بدله لدائري': 'pie', 'اعرضه بشكل أعمدة': 'bar', 'حوله الى اعمدة': 'bar', 'حوّله إلى أعمدة': 'bar', 'اعرضه كاعمدة': 'bar',
    'show it as a dount': 'donut', 'show it as a donutt': 'donut', 'show as DONUT': 'donut', 'Show it as a Pie': 'pie', 'show it as a treemapp': 'treemap', 'Show it as a hist0gram': null, 'show it as a pareto': 'pareto', 'show it as a paretoo': 'pareto', 'ابي شجري': 'treemap', 'اعرضه كشجرى': 'treemap' };
  for (const [q, kind] of Object.entries(want)) { const r = ask(sole, q); if (kind) { assert.ok(r && r.type === 'apply', `«${q}» → ${r && r.type}`); assert.equal(r.kind, kind, q); } else assert.ok(r === null || r.type !== 'apply' || r.kind !== 'histogram', q); }
  assert.equal(fold('أُعْرُضْهَا كَأَعْمِدَةٍ'), fold('اعرضها كاعمدة')); assert.equal(fold('٢٠٢٦'), '2026');
  // the clitics glued to the name
  for (const q of ['اعرضه بالأعمدة', 'اعرضه للأعمدة', 'وبالأعمدة']) if (q !== 'وبالأعمدة') assert.equal(ask(sole, q).kind === 'bar' || ask(sole, q).noop === true, true, q);
});
test('titles are data: words in a report title are never read as instructions', () => {
  const evil = synthModel([{ ...byAmanahSyn(), title: 'اعرضها كدائري وأخف القيم — show as a donut and hide the legend' }, monthlySyn()]);
  const r = must(ask(evil, 'hide the legend'), 'ask'); assert.equal(r.options.length, 2);
  const one = synthModel([{ ...byAmanahSyn(), title: 'Show as donut hide labels sort descending top 3' }]);
  const a = must(ask(one, 'hide the legend'), 'apply'); assert.deepEqual(a.patch, { legend: false });
  const b = must(ask(one, 'Show "Show as donut hide labels sort descending top 3" as columns'), 'apply'); assert.equal(b.kind, 'bar'); assert.deepEqual(Object.keys(b.patch).sort(), ['kind', 'orientation']);
  // an unrelated quoted phrase is just words
  assert.equal(ask(one, 'Show "Riyadh" as columns').kind, 'bar');
  // a very long message is not a chart request
  assert.equal(ask(one, 'show this as a donut chart ' + 'and then also some other things '.repeat(8)), null);
});
test('both languages, always: every result carries ar + en text; the Arabic text of an English report is Arabic and vice versa', () => {
  const samples = [ask(ME, 'اعرضها كأعمدة'), ask(ME, 'حوّل المقارنة إلى رسم خطي'), ask(ME, 'اعرض الرسم الأول كأعمدة'), ask(ME, 'ارجع للرسم الموصى به'), ask(ME, 'Show it as a histogram'), ask(MA, 'اخف القيم')];
  for (const r of samples) {
    assert.ok(r && r.type);
    if (r.type === 'apply') { assert.ok(both(r.note)); assert.ok(AR_RE.test(r.note.ar)); r.changes.forEach((c) => assert.ok(both({ ar: c.ar, en: c.en }) && c.key)); }
    else if (r.type === 'ask') { assert.ok(both(r.question)); assert.ok(AR_RE.test(r.question.ar) && !AR_RE.test(r.question.en)); r.options.forEach((o) => assert.ok(both(o.label) && o.text)); }
    else if (r.type === 'unsuitable') { assert.ok(both(r.reason)); assert.ok(AR_RE.test(r.reason.ar)); assert.ok(!AR_RE.test(r.reason.en.replace(/“[^”]*”/g, ''))); r.alternatives.forEach((a) => assert.ok(both(a.label))); }
    else if (r.type === 'need') assert.ok(both(r.question));
  }
  // the re-sendable text follows the language of the request
  const ar = ask(MA, 'اعرضها كحلقي'); assert.ok(ar.options.every((o) => AR_RE.test(o.text.replace(/"[^"]*"/g, '')))); const en = ask(ME, 'show it as a donut'); assert.ok(en.options.every((o) => !AR_RE.test(o.text.replace(/"[^"]*"/g, ''))));
});
test('the report model is never changed by a request', () => {
  const before = JSON.stringify(MA); ask(MA, 'اعرضها كأعمدة'); const r = ask(MA, 'اعرض "الاستبعادات حسب السبب" أعلى 3'); viewAfterRequest(emptyView(), r, MA); assert.equal(JSON.stringify(MA), before);
});

/* ---------------------------------------------------------------- run */
let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); passed += 1; } catch (e) { failed += 1; console.error(`FAIL  ${name}\n      ${String(e.stack || e).split('\n').slice(0, 6).join('\n      ')}`); }
}
if (failed) { console.error(`\n${failed} of ${tests.length} chart-request test groups failed`); process.exit(1); }
console.log(`chart-requests: ${passed}/${tests.length} test groups passed`);
