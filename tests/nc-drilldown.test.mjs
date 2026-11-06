// «تحليل أسباب عدم التحصيل» result page: every chart mark / card / KPI / management answer opens a supporting-invoice population whose list total and amount equal the figure it showed.
// Runs the real data service (synthetic compact world) through the SAME view model the page uses (ncModel.js). Synthetic data only.
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { list } from '../server/lists.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { buildCharts, kpiTiles, managementQuestions, groupDrill, processDrill, summaryLines, evidenceCoverage, listRequest, listAmount, drillPopulation, encodeDrill, decodeDrill, FACT_KIND, groupFactKind } from '../src/components/analysis/nc/ncModel.js';
import { chartRender } from '../src/utils/chartDraw.js';

process.env.DEMO_SIZE = 'compact';
let passed = 0; const test = (name, fn) => { try { fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } };
const TODAY = '2026-11-05'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const SCOPES = { all: { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all' }, year: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, short: { from: '2026-09-01', to: TODAY, amanah: 'all', source: 'all' } };
const near = (a, b, m = '') => assert.ok(Math.abs(a - b) <= 0.5, `${m} ${a} vs ${b}`);
const fmt = { money: (n) => `M${Math.round(n)}`, count: (n) => String(n) };

// what the page asks of the data service for a drill, and what comes back
function open(base, drill, extra = {}) {
  const rq = listRequest(base, drill);
  const r = list(st, { scope: rq.scope, cfg, filters: rq.filters, page: 0, pageSize: 5, withNc: true, ...extra });
  return { total: r.total, amount: listAmount(r, drillPopulation(drill)), res: r };
}
const check = (name, base, drill) => {
  assert.ok(drill && drill.expected, `${name}: a drill with its expected figure`);
  const { total, amount } = open(base, drill);
  near(amount, drill.expected.amount, `${name} amount`);
  if (drill.expected.count != null) assert.equal(total, drill.expected.count, `${name} count`);
  return total;
};

for (const [sname, scope] of Object.entries(SCOPES)) {
  const a = nonCollectionAnalysis(st, { scope, cfg }); const base = { ...a.scope }; delete base.org;
  test(`[${sname}] every mark of every chart opens exactly the invoices it shows (waterfall · due split · reasons · aging · Amanah · source · municipality · heat map)`, () => {
    const ch = buildCharts(a, true); let marks = 0; let opened = 0;
    for (const [name, c] of Object.entries(ch)) {
      const bl = c.block; assert.ok(bl.labels.length === (bl.series.length && bl.kind !== 'heatmap' && bl.kind !== 'stacked_hbar' ? bl.series[0].values.length : bl.labels.length) || bl.kind === 'heatmap' || bl.kind === 'stacked_hbar', name);
      const cells = [];
      if (bl.kind === 'heatmap') bl.series.forEach((s, i) => s.values.forEach((v, j) => cells.push({ kind: 'mark', i, j, v })));
      else if (bl.kind === 'stacked_hbar') bl.series.forEach((s, j) => cells.push({ kind: 'mark', i: 0, j, v: s.values[0] }));
      else bl.labels.forEach((_, i) => cells.push({ kind: 'mark', i, j: 0, v: bl.series[0].values[i] }));
      for (const cell of cells) {
        marks += 1; const d = c.pick(cell);
        if (cell.v == null) { assert.equal(d, null, `${name}[${cell.i},${cell.j}]: an empty heat cell opens nothing`); continue; }
        if (d && d.unsupported) continue; // a municipality-less item is not drillable (stated in the page)
        const got = check(`${name}[${cell.i},${cell.j}]`, base, d); opened += 1;
        const shown = name === 'waterfall' ? Math.abs(cell.v) : cell.v; near(d.expected.amount, shown, `${name}[${cell.i},${cell.j}] the chart value equals the bucket value`);
        void got;
      }
    }
    assert.ok(marks > 20 && opened > 15, `${marks} marks, ${opened} opened`);
  });

  test(`[${sname}] KPI tiles, action groups (primary + overlapping tag), process rows and management answers open their populations`, () => {
    for (const k of kpiTiles(a, true)) check(`kpi ${k.key}`, base, k.drill);
    for (const g of a.groups) { check(`group ${g.key}`, base, groupDrill(g, true)); }
    for (const p of a.process) { check(`process ${p.key}`, base, processDrill(p)); for (const s of p.sub || []) check(`process ${s.key}`, base, processDrill(s)); }
    for (const q of a.quality) check(`quality ${q.key}`, base, processDrill(q));
    let answered = 0; for (const q of managementQuestions(a, true, fmt)) { assert.ok(q.a || q.na, q.key); for (const o of q.open || []) { check(`question ${q.key}`, base, o.drill); answered += 1; } }
    assert.ok(answered >= 5);
    // the net unpaid KPI is the sum of the overdue / not-yet-due / due-unavailable KPIs
    const t = Object.fromEntries(kpiTiles(a, true).map((x) => [x.key, x])); near(t.net.amount, t.overdue.amount + t.not_due.amount + (t.unknown ? t.unknown.amount : 0));
  });

  test(`[${sname}] the waterfall reconciles (gross = excluded + net) and the due split sums to the net; the chart draws, with drill-down attributes`, () => {
    const ch = buildCharts(a, true); const w = ch.waterfall.block.series[0].values; near(w[0] + w[1], w[2]);
    const due = ch.due.block.series.reduce((t, s) => t + s.values[0], 0); near(due, a.populations.netUnpaid.amount);
    const svg = chartRender(ch.waterfall.block, { lang: 'ar', w: 640, responsive: true, interactive: true }).svg; assert.ok(/data-recon="ok"/.test(svg), 'the waterfall passes its own reconciliation check');
    assert.ok(/data-i="2"/.test(svg) && /role="button"/.test(svg) && /tabindex="0"/.test(svg) && /aria-label="[^"]+"/.test(svg));
    const plain = chartRender(ch.waterfall.block, { lang: 'ar', w: 640 }).svg; assert.ok(/data-i="2"/.test(plain) && !/role="button"/.test(plain) && /role="img"/.test(plain), 'the export drawing keeps the attributes but is not interactive');
    for (const k of ['aging', 'reasons', 'amanah', 'source', 'muni', 'heat', 'due']) { const s = chartRender(ch[k].block, { lang: 'en', w: 480, responsive: true, interactive: true }).svg; assert.ok(/data-i="0"/.test(s) && /<svg/.test(s), k); }
  });
}

test('an Amanah-scoped analysis keeps its scope in every drill (the active scope is preserved)', () => {
  const ent = nonCollectionAnalysis(st, { scope: SCOPES.year, cfg }).byAmanah[0].key; const scope = { ...SCOPES.year, amanah: ent };
  const a = nonCollectionAnalysis(st, { scope, cfg }); const base = { ...a.scope }; delete base.org; assert.equal(base.amanah, ent);
  for (const g of a.groups) check(`scoped group ${g.key}`, base, groupDrill(g, true));
  for (const [name, c] of Object.entries(buildCharts(a, false))) { const bl = c.block; if (bl.kind === 'heatmap' || bl.kind === 'stacked_hbar') continue; bl.labels.forEach((_, i) => { const d = c.pick({ kind: 'mark', i, j: 0 }); if (d && !d.unsupported) check(`scoped ${name}[${i}]`, base, d); }); }
  const rq = listRequest(base, { nc: { due: 'overdue' }, scope: null }); assert.equal(rq.scope.amanah, ent); assert.equal(rq.scope.from, base.from);
});

test('the drill travels in the page address and comes back unchanged; garbage in the address is ignored', () => {
  const a = nonCollectionAnalysis(st, { scope: SCOPES.year, cfg }); const d = managementQuestions(a, true, fmt)[0].open[0].drill;
  const back = decodeDrill(encodeDrill(d)); assert.deepEqual(back, d); assert.equal(decodeDrill('{nope'), null); assert.equal(decodeDrill(''), null); assert.equal(decodeDrill('{"n":5}'), null);
});

test('the management answers come only from the data: nothing to show is stated as «not available», never as a guess', () => {
  const a = nonCollectionAnalysis(st, { scope: SCOPES.year, cfg }); const qs = managementQuestions(a, true, fmt); assert.equal(qs.length, 8);
  const orders = qs.find((q) => q.key === 'orders'); assert.equal(a.process.find((x) => x.key === 'confirmed').count, 0); assert.ok(orders.na && !orders.open && orders.naNote, 'no confirmed order → not available, with the reason');
  const en = managementQuestions(a, false, fmt); assert.ok(en.every((q) => q.q.en && (q.a ? q.a.en : true)));
  assert.ok(!/collectible|recoverable|expected recovery|القابل للتحصيل|التحصيل المتوقع|%/.test(JSON.stringify(qs.map((q) => [q.q, q.a]))), 'no recoverability wording and no percentage in the answers');
});

test('the summary and the evidence coverage are plain statements with numbers from the analysis (no percentages, no scores)', () => {
  const a = nonCollectionAnalysis(st, { scope: SCOPES.year, cfg });
  for (const ar of [true, false]) {
    const lines = summaryLines(a, ar, fmt); assert.ok(lines.length >= 3); assert.deepEqual(lines.slice(0, 3).map((l) => l.kind), ['source_reported', 'calculated', 'not_documented']);
    assert.ok(lines.every((l) => l.text.length > 40 && Object.keys(FACT_KIND).includes(l.kind)));
    assert.ok(!/%|collectible|recover|القابل للتحصيل|متوقع/.test(lines.map((l) => l.text).join(' ')));
    assert.ok(lines[2].text.includes(String(a.populations.undocumented.count)));
    const cov = evidenceCoverage(a, ar, fmt); assert.equal(cov.length, 2); assert.ok(cov[0].text.includes(`${a.populations.documented.count}`) && !/%/.test(cov.map((c) => c.text).join('')));
  }
  assert.deepEqual(a.groups.map((g) => groupFactKind(g)).filter((k) => !Object.keys(FACT_KIND).includes(k)), []);
});

console.log(`\n${passed} passed`);
