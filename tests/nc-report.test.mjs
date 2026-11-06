// «تحليل أسباب عدم التحصيل» as a report: model (src/data/ncReportModel.js), Smart Reports integration (reportModel.js), saved-report round trip, PDF document and PowerPoint deck.
// Synthetic data only (the compact world). The real PDF / PPTX files are looked at with scripts/make-nc-report.mjs (headless Chromium + LibreOffice).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { loadStore } from '../server/store.js';
import { snapshot, derive, makeCtx } from '../server/engine.js';
import { list } from '../server/lists.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { buildNcReportModel, rebuildNcModel, ncSections, ncHeadline, NC_APPENDIX_ROWS, NC_TITLE } from '../src/data/ncReportModel.js';
import { buildReportModel } from '../src/data/reportModel.js';
import { defaultSpec, interpret } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { tableToText } from '../src/data/reportFormat.js';
import { buildPdfHtml, chartTable } from '../src/utils/pdfReport.js';
import { planDeck } from '../src/utils/pptxDeckPlan.js';
import { buildTemplatePptx } from '../src/utils/exportReportModel.js';
import { createStore, makeRecord, verifyRecord, modelOfRecord } from '../src/data/reportStore.js';
import { inLanguage } from '../src/components/smart/ExportDialog.jsx';
import { F } from '../src/data/catalog.js';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan (the seed is the 2026 reference)

process.env.DEMO_SIZE = 'compact';
let passed = 0; const test = (name, fn) => Promise.resolve().then(fn).then(() => { passed += 1; console.log(`  ok  ${name}`); }, (e) => { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); });
const TODAY = '2026-11-05'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const ALL_TIME = { from: '2000-01-01', to: '2026-11-05', amanah: 'all', source: 'all' };
const ALL = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' };
const near = (a, b, m = '') => assert.ok(Math.abs(a - b) <= 0.5, `${m} ${a} vs ${b}`);
const withInvoices = (a, scope, n = NC_APPENDIX_ROWS) => { const r = list(st, { scope, cfg, filters: { nc: {} }, sort: { key: 'outstanding', dir: 'desc' }, page: 0, pageSize: n, withNc: true }); return { ...JSON.parse(JSON.stringify(a)), invoices: r.rows, invoicesTotal: r.total }; };
const analysisOf = (scope) => nonCollectionAnalysis(st, { scope, cfg });
const A = withInvoices(analysisOf(ALL), ALL); const A_plain = analysisOf(ALL);
const META = { version: 3, generatedAt: A.generatedAt, cutoff: A.cutoff, requestId: 'u1' };
const MAR = buildNcReportModel(A, { lang: 'ar', meta: META }); const MEN = buildNcReportModel(A, { lang: 'en', meta: META });

const blocks = (m) => [...m.headline, ...m.sections.flatMap((s) => s.blocks)];
const charts = (m) => blocks(m).filter((b) => b.type === 'chart'); const tables = (m) => blocks(m).filter((b) => b.type === 'table');
const chartOf = (m, kind, pick = (c) => c) => charts(m).filter((c) => c.kind === kind).find(pick);
const sum = (xs) => xs.reduce((t, v) => t + (v || 0), 0);
// every string a model shows (titles, texts, labels, cells)
const strings = (m) => { const out = [m.title, m.subtitle, ...m.context.flatMap((c) => [c.label, c.value])]; const walk = (b) => { if (b == null) return; if (typeof b === 'string') { out.push(b); return; } if (Array.isArray(b)) { b.forEach(walk); return; } if (typeof b === 'object') Object.values(b).forEach(walk); }; walk(m.headline); walk(m.sections); return out; };
// every number a model shows, in reading order (raw values: kpi raw, table cells, chart series)
const numbers = (m) => { const out = []; for (const b of blocks(m)) { if (b.type === 'kpis') b.items.forEach((i) => out.push(i.raw)); else if (b.type === 'table') { b.rows.forEach((r) => r.forEach((v) => typeof v === 'number' && out.push(v))); (b.total || []).forEach((v) => typeof v === 'number' && out.push(v)); } else if (b.type === 'chart') b.series.forEach((s) => s.values.forEach((v) => out.push(v))); } return out; };

(async () => {
await test('the model shape: title, period, context chips, generatedAt, cutoff, meta, lang, totals, headline, sections; `_inputs` is non-enumerable', () => {
  for (const [m, lang] of [[MAR, 'ar'], [MEN, 'en']]) {
    assert.equal(m.title, NC_TITLE[lang]); assert.equal(m.lang, lang); assert.equal(m.subtitle, `${ALL.from} → ${ALL.to}`); assert.equal(m.cutoff, A.cutoff); assert.equal(m.generatedAt, A.generatedAt); assert.equal(m.synthetic, true);
    assert.deepEqual(m.meta, META); assert.deepEqual(m.context.map((c) => c.k), ['period', 'amanah', 'source', 'basis', 'data']); assert.ok(m.context.every((c) => c.label && c.value));
    assert.ok(/تجريبية|synthetic/i.test(m.context.find((c) => c.k === 'data').value)); assert.ok(m.context.find((c) => c.k === 'basis').value.includes(A.asOf));
    assert.equal(m.totals.netUnpaid, A.populations.netUnpaid.amount); assert.equal(m.empty, false); assert.equal(m.equationOk, true);
    assert.deepEqual(m.sections.map((s) => s.key), ['nc_executive', 'nc_reasons', 'nc_exposure', 'nc_priorities', 'nc_quality', 'nc_method', 'nc_appendix', 'assumptions']);
    assert.ok(m.sections.every((s) => s.title && Array.isArray(s.blocks) && s.blocks.length));
    assert.ok(!Object.keys(m).includes('_inputs') && m._inputs.analysis === A && m._inputs.ncReport === true && m._inputs.spec.scope.from === ALL.from);
  }
  assert.equal(buildNcReportModel(A, { lang: 'ar' }).meta, undefined, 'no meta unless given');
  const j = JSON.parse(JSON.stringify(MAR)); assert.deepEqual(j.sections, MAR.sections, 'a model is plain JSON (it is saved and restored from the store)');
});

await test('headline: net unpaid · overdue · not yet due · amount with the undocumented reason; «due unavailable» only when > 0', () => {
  const P = A.populations; assert.equal(P.dueUnknown.amount, 0);
  for (const m of [MAR, MEN]) { const it = m.headline[0].items; assert.equal(it.length, 4); assert.deepEqual(it.map((i) => i.raw), [P.netUnpaid.amount, P.overdue.amount, P.notYetDue.amount, P.undocumented.amount]); assert.ok(it.every((i) => i.label && i.value && i.sub)); }
  assert.ok(MAR.headline[0].items[3].label.includes('سبب عدم التحصيل غير موثق')); assert.ok(MEN.headline[0].items[3].label.includes('Non-collection reason not documented'));
});

await test('numbers: the waterfall reconciles, the stacked bar / reasons / aging / Amanah tables sum to net unpaid, the heat map keeps null ≠ 0', () => {
  const P = A.populations; const N = P.netUnpaid.amount;
  for (const m of [MAR, MEN]) {
    const w = chartOf(m, 'waterfall'); const v = w.series[0].values; assert.deepEqual(w.totals, [true, false, true]); near(v[0] + v[1], v[2], 'gross − excluded = net'); near(v[0], P.unpaidGross.amount); near(v[1], -P.excludedUnpaid.amount); near(v[2], N);
    const s = chartOf(m, 'stacked_hbar'); near(sum(s.series.map((x) => x.values[0])), N, 'overdue + not due (+ unavailable) = net'); assert.equal(s.series.length, 2); near(s.series[0].values[0], P.overdue.amount);
    const r = charts(m).find((c) => c.kind === 'hbar' && c.series[0].values.length === A.reasons.filter((x) => x.amount > 0 || x.key === 'undocumented').length && c.labels.some((l) => /غير موثق|not documented/.test(l))); near(sum(r.series[0].values), N, 'reasons sum to net unpaid'); assert.ok(r.note.includes('صافي غير المسدد') || r.note.includes('net unpaid'), 'the denominator is stated');
    const ag = chartOf(m, 'bar'); near(sum(ag.series[0].values), N, 'aging buckets sum to net unpaid');
    const am = tables(m).find((t) => t.id === 'nc_by_amanah'); near(sum(am.rows.map((x) => x[2])), N); near(am.total[2], N); near(sum(am.rows.map((x) => x[3])) + sum(am.rows.map((x) => x[4])), N, 'overdue + not yet due'); assert.equal(sum(am.rows.map((x) => x[1])), P.netUnpaid.count);
    const so = tables(m).find((t) => t.id === 'nc_by_source'); near(sum(so.rows.map((x) => x[2])), N);
    const pr = tables(m).find((t) => t.id === 'nc_priorities'); near(sum(pr.rows.map((x) => x[2])), N, 'action groups (primary allocation) sum to net'); assert.equal(sum(pr.rows.map((x) => x[1])), P.netUnpaid.count); assert.ok(pr.rows[pr.rows.length - 1][0].startsWith('8.'), 'the no-action group is last');
    const h = chartOf(m, 'heatmap'); assert.equal(h.valueKind, 'amount'); assert.ok(h.series.some((r2) => r2.values.some((x) => x === null)), 'cells without invoices stay null'); assert.ok(h.series.every((r2) => r2.values.every((x) => x === null || x > 0)), 'no null becomes 0');
    h.series.forEach((row, i) => { const src = A.heat.rows[i]; assert.equal(row.label, m.lang === 'ar' ? src.labelAr : src.labelEn); const keep = A.heat.cols.map((_, c) => c).filter((c) => A.heat.values.some((rr) => rr[c] != null)); keep.forEach((c, j) => assert.equal(row.values[j], A.heat.values[i][c])); });
    const reas = tables(m).find((t) => t.id === 'nc_reasons'); near(reas.total[3], N); assert.equal(reas.total[2], P.netUnpaid.count); near(sum(reas.rows.map((x) => x[3])), N);
    const pos = tables(m).find((t) => t.id === 'nc_position'); near(pos.rows[0][2] + pos.rows[1][2], N);
  }
});

await test('both languages carry the SAME figures, in the same order (the other language is re-expressed from the same analysis)', () => {
  assert.deepEqual(numbers(MAR), numbers(MEN)); assert.equal(MAR.sections.length, MEN.sections.length);
  MAR.sections.forEach((s, i) => { assert.equal(s.key, MEN.sections[i].key); assert.deepEqual(s.blocks.map((b) => b.type + (b.kind || '') + (b.id || '')), MEN.sections[i].blocks.map((b) => b.type + (b.kind || '') + (b.id || ''))); });
  const back = rebuildNcModel(MAR, 'en'); assert.deepEqual(JSON.parse(JSON.stringify(back.sections)), JSON.parse(JSON.stringify(MEN.sections))); assert.deepEqual(back.meta, META); assert.equal(back._inputs.analysis, A);
  assert.equal(rebuildNcModel({ _inputs: {} }, 'en'), null);
  // the export dialog's inLanguage: same-language returns the model, the other language is rebuilt, a model without inputs yields nothing
  assert.equal(inLanguage(MAR, 'ar'), MAR); const en = inLanguage(MAR, 'en'); assert.equal(en.lang, 'en'); assert.deepEqual(numbers(en), numbers(MAR));
  assert.equal(inLanguage(JSON.parse(JSON.stringify(MAR)), 'en'), null, 'a restored (JSON) model has no inputs and stays in its language — the saved record holds both languages instead');
});

await test('wording: no «collectible» / expected recovery / confidence anywhere; the undocumented label is present; facts are not inferred from age', () => {
  const FORBIDDEN = /collectible|recoverable|expected recovery|expected collection|القابل للتحصيل|التحصيل المتوقع|قابل للتحصيل|confidence|نسبة الثقة|درجة الثقة/i;
  for (const m of [MAR, MEN]) {
    const all = strings(m); const bad = all.filter((t) => FORBIDDEN.test(String(t))); assert.deepEqual(bad, [], 'forbidden words'); assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all.join(' ').replace(/[✓✗]/g, '')), 'no emoji');
    const lab = m.lang === 'ar' ? 'سبب عدم التحصيل غير موثق' : 'Non-collection reason not documented';
    const reasons = tables(m).find((t) => t.id === 'nc_reasons'); assert.ok(reasons.rows.some((r) => r[0] === lab), 'the undocumented reason row'); assert.ok(charts(m).some((c) => c.labels.includes(lab)), 'and its bar');
    assert.ok(all.some((t) => /لا يُستنتج|never inferred|no reason is inferred/.test(t)), 'the no-inference rule is stated');
    const ec = m.sections[0].blocks.filter((b) => b.type === 'text').map((b) => b.text).join(' '); assert.ok(ec.includes(lab) || P0_DOCUMENTED > 0, 'executive summary states the undocumented share');
    assert.ok(m.sections.find((s) => s.key === 'nc_priorities').blocks[0].text.includes(m.lang === 'ar' ? 'مقترح' : 'proposals'), 'owner / next step are marked as suggestions');
    const det = tables(m).find((t) => t.id === 'nc_priorities_detail'); assert.ok(det.rows.every((r) => r[6].includes(m.lang === 'ar' ? 'مقترح' : 'suggested')), 'suggested owner marked');
  }
});
const P0_DOCUMENTED = A.populations.documented.amount;

await test('non-additive views are labelled (no total row); the unmatched records and the standing balance are separate tables and in no total', () => {
  for (const m of [MAR, MEN]) {
    for (const id of ['nc_process', 'nc_flags']) { const t = tables(m).find((x) => x.id === id); assert.ok(/غير جمعي|not additive/.test(t.title), id); assert.equal(t.total, null, 'no total row for an overlapping view'); }
    const un = tables(m).find((t) => t.id === 'nc_unmatched'); assert.equal(un.rows[0][1], A.unmatched.count); near(un.rows[0][2], A.unmatched.amount); assert.ok(/outside every total|خارج كل الإجماليات/.test(un.title)); assert.ok(['لا', 'No'].includes(un.rows[0][3]));
    const sb = tables(m).find((t) => t.id === 'nc_standing'); near(sb.rows[0][1], A.standingBalance.amount); assert.ok(/different population|مجتمع مختلف/.test(sb.title));
    const ck = tables(m).find((t) => t.id === 'nc_checks'); assert.equal(ck.rows.length, A.reconciliation.length); assert.ok(ck.rows.every((r) => r.length === 5 && /✓/.test(r[4]))); assert.equal(ck.headers.length, 5);
    assert.equal(tables(m).filter((t) => /غير جمعي|not additive/.test(t.title)).length, 2);
  }
});

await test('the appendix: the supporting-invoice listing (top N) is present, titled «الملحق / Appendix»; without invoices it says the list is on screen', () => {
  for (const m of [MAR, MEN]) {
    const ap = m.sections.find((s) => s.key === 'nc_appendix'); assert.ok(/الملحق|Appendix/.test(ap.title)); const t = ap.blocks.find((b) => b.id === 'nc_invoices');
    assert.equal(t.rows.length, NC_APPENDIX_ROWS); assert.equal(t.headers.length, 9); assert.ok(t.rows.every((r) => r.length === 9 && r[0]));
    assert.equal(t.total, null); assert.ok(sum(t.rows.map((r) => r[5])) <= A.populations.netUnpaid.amount + 0.5); assert.equal(t.headers[5].kind, 'money'); assert.ok(t.note.includes(String(A.populations.netUnpaid.count)), 'N of M stated');
    for (let i = 1; i < t.rows.length; i += 1) assert.ok(t.rows[i - 1][5] >= t.rows[i][5], 'sorted by unpaid amount');
  }
  for (const [lang, word] of [['ar', 'متاحة على الشاشة'], ['en', 'available on screen']]) { const m = buildNcReportModel(A_plain, { lang }); const ap = m.sections.find((s) => s.key === 'nc_appendix'); assert.equal(ap.blocks.length, 1); assert.equal(ap.blocks[0].type, 'callout'); assert.ok(ap.blocks[0].text.includes(word)); }
});

await test('Smart Reports: `noncollection` is a section of the report model, built by the SAME builder; the request «حلل أسباب عدم التحصيل» yields it', () => {
  const spec = interpret('حلل أسباب عدم التحصيل لهذه السنة', null, TODAY).spec; assert.deepEqual(spec.sections, ['noncollection']);
  const snap = snapshot(st, { scope: ALL, cfg }); const out = { snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: null, cards: [], anomalies: [] };
  const mk = (lang, extra = {}) => buildReportModel({ spec: { ...defaultSpec(TODAY), ...spec, scope: { ...ALL, scopeType: 'all', muni: 'all', status: 'all' } }, lang, out, targets: DEFAULT_TARGETS, ncAnalysis: A, ...extra });
  const ar = mk('ar'); const en = mk('en');
  assert.equal(ar.title, NC_TITLE.ar); assert.equal(en.title, NC_TITLE.en);
  assert.deepEqual(ar.sections.slice(0, 7).map((s) => s.key), ncSections(A, 'ar').map((s) => s.key)); assert.deepEqual(JSON.parse(JSON.stringify(ar.sections.slice(0, 7))), JSON.parse(JSON.stringify(ncSections(A, 'ar'))), 'one implementation');
  assert.deepEqual(JSON.parse(JSON.stringify(ar.headline)), JSON.parse(JSON.stringify(ncHeadline(A, 'ar')))); assert.deepEqual(numbers(ar).slice(0, 4), numbers(en).slice(0, 4));
  assert.ok(ar.summaryText.includes('غير مسدد') && !ar.summaryText.includes('undefined')); assert.equal(ar.sections.at(-1).key, 'assumptions');
  // together with another section the report keeps its own headline and adds the analysis; without the analysis a multi-section report simply leaves it out
  const both = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive', 'noncollection'] }, lang: 'ar', out, targets: DEFAULT_TARGETS, ncAnalysis: A });
  assert.ok(both.sections.some((s) => s.key === 'executive') && both.sections.some((s) => s.key === 'nc_executive')); assert.notEqual(both.title, NC_TITLE.ar); assert.ok(both.headline[0].items.some((i) => i.label === 'إجمالي المفوتر'));
  const without = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive', 'noncollection'] }, lang: 'ar', out, targets: DEFAULT_TARGETS });
  assert.ok(!without.sections.some((s) => s.key.startsWith('nc_')));
  const alone = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['noncollection'] }, lang: 'ar', out, targets: DEFAULT_TARGETS });
  assert.equal(alone.sections[0].blocks[0].tone, 'warn', 'a lone request without the analysis shows that it is unavailable, not an empty report');
  assert.equal(buildNcReportModel(null, { lang: 'en' }).empty, true);
});

await test('a saved non-collection report restores from the store and exports (both languages, figures identical, the supporting-invoice appendix kept)', () => {
  const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => { m.delete(k); }, setItem: (k, v) => { m.set(k, String(v)); } }; };
  const store = createStore({ storage: mem() }); const spec = { ...defaultSpec(TODAY), sections: ['noncollection'] };
  const snap = snapshot(st, { scope: ALL, cfg }); const out = { snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: null, cards: [], anomalies: [] };
  const models = Object.fromEntries(['ar', 'en'].map((l) => [l, buildReportModel({ spec, lang: l, out, targets: DEFAULT_TARGETS, ncAnalysis: A })]));
  const rec = makeRecord({ msgId: 'a1', convId: 'c1', version: 1, requestId: 'u1', lineageId: 'c1', generatedAt: A.generatedAt, cutoff: A.cutoff, lang: 'ar', spec, org: { id: 'mof-hq', amanahKeys: null }, models });
  assert.ok(store.saveReports('u:demo', 'c1', { a1: rec }).ok); const back = store.loadReports('u:demo', 'c1'); assert.deepEqual(back.unreadable, []); const r = back.records.a1; assert.ok(verifyRecord(r));
  const ar = modelOfRecord(r, 'ar'); const en = modelOfRecord(r, 'en'); assert.equal(ar.meta.version, 1); assert.equal(ar.title, NC_TITLE.ar); assert.equal(en.title, NC_TITLE.en);
  assert.deepEqual(numbers(ar), numbers(models.ar)); assert.deepEqual(numbers(ar), numbers(en)); assert.ok(ar.sections.some((s) => s.key === 'nc_appendix' && s.blocks.some((b) => b.id === 'nc_invoices' && b.rows.length === NC_APPENDIX_ROWS)));
  for (const m of [ar, en]) { const html = buildPdfHtml(m, {}); assert.ok(html.includes('nc_') === false); assert.ok(html.length > 20000); assert.ok(planDeck({ model: m, helpers: { ctxRows: [], dataLine: 'x', stamp: '', relationsRows: () => [] } }).slides.length > 8); }
});

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
await test('PDF document: every table cell, total row, KPI, chart-data cell and note of both languages is present; the appendix is last before the assumptions', () => {
  for (const m of [MAR, MEN]) {
    const html = buildPdfHtml(m, { fonts: {} }); const text = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
    for (const b of tables(m)) { const t = tableToText(b, m.lang); for (const c of [...t.rows.flat(), ...(t.total || [])]) assert.ok(html.includes(esc(c)) || text.includes(esc(c)) || text.replace(/<\/?bdi[^>]*>/g, '').includes(esc(c)), `${b.id} cell «${c}»`); if (b.note) assert.ok(text.replace(/<\/?bdi[^>]*>/g, '').includes(esc(b.note)), `${b.id} note`); }
    for (const b of charts(m)) { const ct = chartTable(b, m.lang); for (const c of [...ct.rows.flat()]) assert.ok(text.replace(/<\/?bdi[^>]*>/g, '').includes(esc(c)), `${b.title} data «${c}»`); }
    for (const k of m.headline[0].items) assert.ok(html.includes(esc(k.label)));
    assert.ok(html.indexOf(esc(m.sections.find((s) => s.key === 'nc_appendix').title)) > html.indexOf(esc(m.sections.find((s) => s.key === 'nc_method').title)));
    assert.equal((html.match(/class="wide"/g) || []).length, 0, 'no table is wide enough to need a landscape page');
  }
});

await test('PowerPoint deck plan: a concise main part (findings, the priorities table, charts) and an appendix with every table; the invoice listing is in the appendix', () => {
  for (const m of [MAR, MEN]) {
    const { slides, appendixCount } = planDeck({ model: m, helpers: { ctxRows: m.context.map((c) => [c.label, c.value]), dataLine: 'synthetic', stamp: 'v3', relationsRows: () => [] } });
    const iApp = slides.findIndex((s) => s.layout === 5); assert.ok(iApp > 0, 'an appendix divider exists'); const main = slides.slice(0, iApp); const app = slides.slice(iApp);
    assert.ok(main.length <= 16, `main slides ${main.length}`); assert.ok(app.length >= 6);
    assert.ok(main.some((s) => s.title === (m.lang === 'ar' ? 'مجموعات الإجراء بحسب الأولوية' : 'Action groups by priority')), 'the priorities table is a main slide');
    assert.ok(main.filter((s) => s.charts.length).length >= 5, 'native charts on the main slides');
    assert.ok(app.some((s) => /nc_invoices|الفواتير الداعمة|supporting invoices/i.test(s.title)), 'the invoice listing is in the appendix'); assert.ok(app.filter((s) => !/محتويات|contents/i.test(s.title) && s.layout !== 5).every((s) => s.appendix || /تابع|cont/.test(s.title)));
    assert.ok(appendixCount >= 10, `appendix tables ${appendixCount}`);
    assert.ok(!main.some((s) => /nc_invoices/.test(s.title)) && !main.some((s) => /الفواتير الداعمة|supporting invoices/i.test(s.title)));
  }
});

await test('PowerPoint files (supplied templates): built in both languages; every slide is valid XML; counts match the plan; no forbidden words in any slide', async () => {
  for (const m of [MAR, MEN]) {
    const tpl = fs.readFileSync(new URL(`../public/templates/momah-${m.lang}.pptx`, import.meta.url)); const bytes = await buildTemplatePptx(m, tpl);
    const zip = await JSZip.loadAsync(bytes); const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)); assert.ok(slideFiles.length >= 14, `slides ${slideFiles.length}`);
    let all = ''; for (const f of slideFiles) { const x = await zip.file(f).async('string'); assert.ok(x.startsWith('<?xml') && x.includes('</p:sld>'), f); all += x.replace(/<[^>]+>/g, ' '); }
    assert.ok(!/collectible|expected recovery|القابل للتحصيل|confidence/i.test(all)); assert.ok(all.includes(m.lang === 'ar' ? 'سبب عدم التحصيل غير موثق' : 'Non-collection reason not documented'));
    assert.ok(Object.keys(zip.files).filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f)).length >= 5, 'native charts');
  }
});

await test('a missing due date (synthetic tweak): the headline and the stacked bar gain the «due unavailable» part and the identities still hold', () => {
  const ctx0 = makeCtx(st, { cfg }); let k = -1;
  for (let i = 0; i < st.nGen && k < 0; i += 1) { if (st.issue[i] > ctx0.cutoffN || st.ent[i] !== 0) continue; const D = derive(ctx0, i, ctx0.cutoffN); if (D.outstanding > 0 && !D.excluded && D.daysOverdue > 0 && !(st.flags[i] & (F.OBJECTION | F.AMT_CONFLICT | F.MISSING_ID)) && st.cstat[i] !== 2 && st.cstat[i] !== 4) k = i; }
  assert.ok(k >= 0); const keep = st.due[k]; st.due[k] = 0;
  try {
    const a = analysisOf(ALL_TIME); assert.ok(a.populations.dueUnknown.count >= 1);
    for (const lang of ['ar', 'en']) { const m = buildNcReportModel(a, { lang }); assert.equal(m.headline[0].items.length, 5); near(m.headline[0].items[4].raw, a.populations.dueUnknown.amount); const s = chartOf(m, 'stacked_hbar'); assert.equal(s.series.length, 3); near(sum(s.series.map((x) => x.values[0])), a.populations.netUnpaid.amount); assert.ok(chartOf(m, 'bar').labels.length === 6); near(sum(chartOf(m, 'bar').series[0].values), a.populations.netUnpaid.amount); assert.ok(tables(m).find((t) => t.id === 'nc_by_amanah').headers.length === 7); }
  } finally { st.due[k] = keep; }
});

await test('edge cases: an empty scope, an analysis with a failed check, and a one-Amanah scope', () => {
  const empty = analysisOf({ ...ALL, from: '2001-01-01', to: '2001-01-31' });
  for (const lang of ['ar', 'en']) { const m = buildNcReportModel(empty, { lang }); assert.equal(m.empty, true); assert.deepEqual(m.headline, []); assert.ok(JSON.stringify(m).indexOf('NaN') < 0 && JSON.stringify(m).indexOf('Infinity') < 0); assert.equal(m.sections[0].blocks.length, 1); buildPdfHtml(m, {}); planDeck({ model: m, helpers: { ctxRows: [], dataLine: 'x', stamp: '', relationsRows: () => [] } }); }
  const bad = JSON.parse(JSON.stringify(A)); bad.reconciliation[3].ok = false;
  for (const lang of ['ar', 'en']) { const m = buildNcReportModel(bad, { lang }); assert.equal(m.equationOk, false); const q = m.sections.find((s) => s.key === 'nc_quality'); assert.equal(q.blocks[0].tone, 'warn'); assert.ok(tables(m).find((t) => t.id === 'nc_checks').rows.some((r) => /✗/.test(r[4]))); }
  const one = withInvoices(analysisOf({ ...ALL, amanah: A.byAmanah[0].key }), { ...ALL, amanah: A.byAmanah[0].key }, 10);
  for (const lang of ['ar', 'en']) { const m = buildNcReportModel(one, { lang }); assert.ok(m.context.find((c) => c.k === 'amanah').value !== (lang === 'ar' ? 'كل الأمانات والجهات' : 'All Amanahs')); assert.equal(tables(m).find((t) => t.id === 'nc_invoices').rows.length, Math.min(10, one.populations.netUnpaid.count)); near(tables(m).find((t) => t.id === 'nc_by_amanah').total[2], one.populations.netUnpaid.amount); }
});

console.log(`\n${passed} passed`);
})();
