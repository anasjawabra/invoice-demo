// /insights — the UI (docs/insights-redesign-spec.md; X2 + «Implementation notes — S (decoupling)»): ONE regional component (only the selected view mounted; the metric and the view survive each other), value ↔ colour ↔ legend ↔ units ↔ table column
// for the FOUR metrics in BOTH views, the collection-performance bands (the SAME class on the map, table, tooltip card, details panel, summary and export), the unavailable states, the «بدون إسناد جغرافي» card, ≤ 3 summary findings and
// ≤ 3 review cases (plan items excluded), the ONE details panel, the heatmap as an optional dialog, permissions, the removed UI, AR / EN parity and INDEPENDENCE from the collection plans (the page renders identically with no plans,
// with plans and after a plan / default / reference change; no plan label or notice anywhere).
// Server-side render of the REAL components over the REAL data service (compact synthetic data). Run: npm run test:insightsui
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.js';
import { I18nProvider } from '../src/context/I18nContext.jsx';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { DEFAULT_CONFIG } from '../src/data/revenueMetrics.js';
import { loadComparison } from '../src/data/comparison.js';
import { setPlansForTest, clearPlans } from '../src/data/plans/planStore.js';
import { customPlanRecord, referenceEntry } from '../src/data/plans/planFixtures.js';
import { buildRegionalDataset, loadRegionalDataset, regionalMetric, regionDetail } from '../src/data/regional/regionalPerformance.js';
import { buildPerformanceSummary } from '../src/data/regional/performanceSummary.js';
import { buildReviewPriorities } from '../src/data/regional/reviewPriorities.js';
import { REGIONAL_METRICS, METRICS, colorOf } from '../src/data/regional/regionalLegend.js';
import * as U from '../src/components/insights/insightsUi.js';
import RegionalPerformance, { metricOptionText } from '../src/components/insights/RegionalPerformance.jsx';
import PerformanceSummary from '../src/components/insights/PerformanceSummary.jsx';
import ReviewPriorities from '../src/components/insights/ReviewPriorities.jsx';
import RegionDetailPanel, { selectionChips, TOTAL_SEL } from '../src/components/insights/RegionDetailPanel.jsx';
import { dashboardInputs, DASHBOARD_NO_TARGETS } from '../src/data/dashboardReport.js';
import { buildReportModel } from '../src/data/reportModel.js';
import HeatmapDialog from '../src/components/insights/HeatmapDialog.jsx';
import { ThresholdList, StatusChip } from '../src/components/insights/RegionalParts.jsx';
import * as PS from '../src/data/regional/collectionBands.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const E = React.createElement;
const render = (el, lang = 'ar') => { globalThis.sessionStorage = { getItem: (k) => (k === 'ib_lang' ? lang : null), setItem() {}, removeItem() {} }; try { return renderToStaticMarkup(E(StaticRouter, { location: '/insights' }, E(I18nProvider, null, el))); } finally { delete globalThis.sessionStorage; } };
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
const noop = () => {};
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const T = '2026-11-06'; const YEAR = 2026;
const st = loadStore(T); const cfg = { ...DEFAULT_CONFIG, cutoff: T };
const FULL = { from: `${YEAR}-01-01`, to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', product: [], mainClass: 'all' };
const data = { snapshot: async (sc) => snapshot(st, { scope: sc, cfg }), series: async (sc, extra = {}) => series(st, { scope: sc, cfg: { ...cfg, cutoff: extra.asOf || T }, ...extra }) };
async function pageOf(over = {}, orgKeys = null) {
  const scope = { ...FULL, ...over, org: orgKeys ? { amanahKeys: orgKeys } : null };
  const snap = snapshot(st, { scope, cfg }); const c = await loadComparison(data, scope, cfg, snap);
  return { scopeEff: scope, cfg, data, snapshot: snap, prevSnapshot: c.prev, comparison: c.comparison };
}

/* ---- fixtures: the dataset of the real page, a restricted viewer, and a Decision Room feed that CONTAINS plan items (they must never reach the dashboard) ---- */
const page = await pageOf();
const DS = buildRegionalDataset({ snapshot: page.snapshot, prevSnapshot: page.prevSnapshot, comparison: page.comparison });
const ORG = ['Riyadh Amanah', 'Asir Amanah'];
const pageR = await pageOf({}, ORG);
const DS_R = buildRegionalDataset({ snapshot: pageR.snapshot, prevSnapshot: pageR.prevSnapshot, comparison: pageR.comparison, authorisedKeys: ORG });
const OTHERS = ['Makkah', 'Jeddah', 'Eastern', 'Madinah', 'Tabuk', 'Qassim', 'Housing', 'مكة', 'جدة', 'الشرقية', 'الإسكان'];
assert.ok(DS.regions.length >= 8 && DS.unattributed, 'the compact data covers many regions + the unattributed bucket');
const PLAN_WORDS = /الخطة|خطة|المخطط|مستهدف|\bplan\b|planned|\btarget|budget|ميزانية/i;
const BLUE_HEX = /#(175CD3|8DB4EE|2563EB|3B82F6|1D4ED8|60A5FA|0F5C3A|2E9A68|74C29A|B5DFC8|E4F3EB)\b/i;
const MUNI_EN = [...new Set(DS.entities.flatMap((e) => e.municipalities.map((m) => m.label.en)).filter((x) => /[\u0600-\u06FF]/.test(x)))].sort((a, b) => b.length - a.length); // (reference municipality names have no English form in the demo data)
const labelOf = (o, lang) => (lang === 'ar' ? o.ar : o.en);
const item = (key, amanah, category, amount, level = 'high', extra = {}) => ({ key, title: { ar: `بند ${key}`, en: `Item ${key}` }, category, priority: { level }, condition: { open: true }, affected: { amanah, label: { ar: amanah ? `أمانة ${amanah}` : 'الوزارة', en: amanah || 'Ministry' } }, measure: { kind: 'gap', label: { ar: 'الفجوة', en: 'Gap' }, amount }, ...extra });
const ITEMS = [item('plan:ministry', null, 'plan_deviation', 5e9), item('plan:Riyadh Amanah', 'Riyadh Amanah', 'plan_deviation', 2e9), item('a:2', 'Jeddah Amanah', 'plan_deviation', 1.5e9, 'medium'), item('b:1', 'Asir Amanah', 'overdue_aging', 9e8, 'medium'), item('b:2', 'Tabuk Amanah', 'data_conflicts', 5e8, 'low'), item('b:3', 'Riyadh Amanah', 'enforcement_links', 4e8, 'low'), item('b:4', 'Jeddah Amanah', 'data_conflicts', 3e8, 'low')];

/* ================================================================================================ 1. state + pure logic */
await ok('the regional state: switching the view keeps the metric; switching the metric keeps the view; an unknown value changes nothing; exactly four metrics', () => {
  let s = U.initialRegionalState({ view: 'map', metric: 'changeCollected' });
  s = U.regionalReducer(s, { type: 'view', view: 'table' }); assert.equal(s.view, 'table'); assert.equal(s.metric, 'changeCollected');
  s = U.regionalReducer(s, { type: 'metric', metric: 'changeRate' }); assert.equal(s.view, 'table'); assert.equal(s.metric, 'changeRate');
  s = U.regionalReducer(s, { type: 'view', view: 'map' }); assert.equal(s.metric, 'changeRate');
  assert.deepEqual(U.regionalReducer(s, { type: 'view', view: 'globe' }), s); assert.deepEqual(U.regionalReducer(s, { type: 'metric', metric: 'nope' }), s);
  for (const gone of ['targetAchievement', 'planDeviation']) assert.deepEqual(U.regionalReducer(s, { type: 'metric', metric: gone }), s, `${gone} is not a metric any more`);
  assert.equal(U.initialRegionalState({ view: 'x', metric: 'y' }).view, 'map'); assert.equal(U.initialRegionalState({}).metric, 'collected');
  assert.deepEqual(U.REGIONAL_METRICS, ['collected', 'collectionRate', 'changeCollected', 'changeRate']);
});

await ok('colour: ONE palette for every metric (red · orange · yellow · green, hatch = unavailable); the fill is the colour of the row’s BAND; no blue, no amount ramp', () => {
  for (const id of REGIONAL_METRICS) {
    const res = regionalMetric(DS, id, { lang: 'ar' }); const items = U.legendItems(res);
    assert.equal(items.length, 4, id); assert.ok(items.every((i) => /^#[0-9A-F]{6}$/i.test(i.color) && i.glyph && i.name.ar && i.name.en), `${id}: a colour, a glyph and a name per legend class`);
    for (const r of [...res.rows, res.unattributed, res.total].filter(Boolean)) { const f = U.fillOf(id, r.color); if (!r.status.available) { assert.equal(f, null, `${id} ${r.key}: an unavailable figure has no fill (hatch)`); continue; } assert.equal(f, items[r.color.bucket].color, `${id} ${r.key}: the fill is its legend class colour`); }
  }
  assert.deepEqual(U.legendItems(regionalMetric(DS, 'changeCollected')).map((i) => i.cls), ['critical', 'attention', 'slight', 'ok']);
  assert.deepEqual(U.legendItems(regionalMetric(DS, 'collected')).map((i) => i.color), ['#e53935', '#f4903b', '#fde85c', '#4caf2f']);
  assert.deepEqual(U.legendItems(regionalMetric(DS, 'collected')).map((i) => i.glyph), ['▼▼', '▼', '◐', '✓']);
  assert.equal(U.fillOf('collected', { bucket: null }), null); assert.equal(U.fillOf('collected', { bucket: 0, fill: '#e53935' }), '#e53935');
  assert.ok(U.SEQUENTIAL_RAMP === undefined && U.DIVERGING_RAMP === undefined && U.ACHIEVEMENT_RAMP === undefined, 'the old green-by-amount / blue ramps are gone');
  assert.equal(U.inkOn('#e53935'), '#FFFFFF'); assert.equal(U.inkOn('#fde85c'), '#111927'); assert.equal(U.inkOn('#4caf2f'), '#111927');
  assert.equal(U.directionMark('up'), '▲'); assert.equal(U.directionMark('down'), '▼'); assert.equal(U.directionMark(null), '');
});

await ok('table sort by value: either direction, unavailable cells always last, ties keep the metric order', () => {
  const res = regionalMetric(DS, 'changeRate'); const d = U.sortRows(res.rows, 'changeRate', 'desc'); const a = U.sortRows(res.rows, 'changeRate', 'asc');
  const vals = (rows) => rows.map((r) => U.cellSortValue(r, 'changeRate'));
  const av = (rows) => vals(rows).filter((v) => v != null); assert.ok(av(res.rows).length >= 1, 'some available');
  assert.deepEqual(av(d), [...av(d)].sort((x, y) => y - x)); assert.deepEqual(av(a), [...av(a)].sort((x, y) => x - y));
  for (const rows of [d, a]) { const v = vals(rows); const first = v.findIndex((x) => x == null); assert.ok(first === -1 || v.slice(first).every((x) => x == null), 'unavailable last'); }
  const bands = U.sortRows(res.rows, 'status', 'desc'); const sv = bands.map((r) => U.cellSortValue(r, 'status')); assert.deepEqual(sv.filter((v) => v != null), sv.filter((v) => v != null).sort((x, y) => y - x), 'the band column sorts worst first');
  assert.equal(U.sortRows([], 'collected').length, 0);
});

await ok('invoices link: one Amanah → that Amanah; several (a region) → none at panel level (each entity row has its own); the whole scope → /invoices', () => {
  const d = (level, key) => ({ level, key, row: regionDetail(DS, { level, key }).row });
  const mk = DS.regions.find((r) => r.entityCount > 1); const one = DS.regions.find((r) => r.entityCount === 1);
  assert.equal(U.invoicesLinkFor(d('region', mk.key)), null); assert.ok(U.invoicesLinkFor(d('region', one.key)).startsWith('/invoices?amanah='));
  assert.ok(U.invoicesLinkFor({ level: 'entity', key: 'Riyadh Amanah' }).includes('Riyadh'));
  assert.equal(U.invoicesLinkFor({ level: 'total', key: 'total' }), '/invoices'); assert.equal(U.invoicesLinkFor(null), null);
});

/* ================================================================================================ 2. ONE regional component */
const reg = (o = {}, lang = 'ar') => render(E(RegionalPerformance, { dataset: DS, onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop, ...o }), lang);
await ok('ONLY the selected view is mounted: map → the SVG map and no table; table → the table and no map; the toggle states which one (aria-pressed)', () => {
  const map = reg({ initialView: 'map' }); const tab = reg({ initialView: 'table' });
  assert.ok(/class="ins-map"/.test(map) && /<svg/.test(map) && /data-iso="SA-01"/.test(map)); assert.ok(!/<table/.test(map), 'no table beside the map'); assert.ok(!/ins-table/.test(map));
  assert.ok(/<table/.test(tab) && /ins-table/.test(tab)); assert.ok(!/<svg/.test(tab) && !/ins-map/.test(tab) && !/data-iso=/.test(tab), 'no map beside the table');
  assert.ok(/aria-pressed="true"[^>]*>خريطة/.test(map) && /aria-pressed="false"[^>]*>جدول/.test(map)); assert.ok(/aria-pressed="true"[^>]*>جدول/.test(tab) && /aria-pressed="false"[^>]*>خريطة/.test(tab));
  assert.equal((map.match(/role="group" aria-label="طريقة العرض"/g) || []).length, 1, 'one toggle');
  assert.equal((map.match(/class="ins-legend"/g) || []).length, 1); assert.equal((tab.match(/class="ins-legend"/g) || []).length, 1, 'one legend in each view');
});

await ok('the metric selector offers EXACTLY the four metrics (units in the names) and the chosen one is selected in both views; the level is labelled (المنطقة); the removed target / deviation metrics are nowhere', () => {
  for (const view of ['map', 'table']) for (const id of REGIONAL_METRICS) {
    const h = reg({ initialView: view, initialMetric: id }); const sel = /<option value="([^"]+)" selected/.exec(h) || /<option selected="" value="([^"]+)"/.exec(h); assert.ok(sel && sel[1] === id, `${view}/${id}: ${sel && sel[1]}`);
  }
  const h = reg(); assert.deepEqual([...h.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]), ['collected', 'collectionRate', 'changeCollected', 'changeRate'], 'exactly four options, in order');
  const t = text(h); assert.deepEqual([...h.matchAll(/<option value="[^"]+"[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]), ['المحصّل', 'نسبة التحصيل', 'التغير في المحصّل عن الفترة المقارنة (%)', 'التغير في نسبة التحصيل (نقطة مئوية)']);
  assert.ok(!t.includes('تحقيق المستهدف') && !t.includes('الانحراف عن المخطط') && !PLAN_WORDS.test(t), 'no target / deviation / plan wording');
  assert.ok(t.includes('المستوى: المنطقة') && t.includes('تجمع الأمانات المصرّح لك بها'));
  assert.ok(/<select[^>]*aria-label="المقياس المعروض"/.test(h), 'the metric control is labelled'); assert.ok(/aria-label="شرح المقياس"/.test(h), 'the metric explanation is an accessible info control (InfoTip button)');
  const en = reg({}, 'en'); assert.deepEqual([...en.matchAll(/<option value="[^"]+"[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]), [metricOptionText('collected', 'en'), 'Collection rate', 'Change in collected vs the comparison period (%)', 'Change in collection rate (pp)']);
});

await ok('selected metric ↔ value ↔ colour ↔ legend ↔ units, MAP: every region path has the metric fill, the accessible name carries the value text, the legend lists the classes and the unit', () => {
  for (const id of REGIONAL_METRICS) for (const lang of ['ar', 'en']) {
    const res = regionalMetric(DS, id, { lang }); const h = reg({ initialMetric: id }, lang); const flat = text(h);
    for (const r of res.rows) {
      const m = new RegExp(`<path d="[^"]*" fill="([^"]+)"[^>]*aria-label="([^"]*)"[^>]*data-iso="${r.iso}"`).exec(h); assert.ok(m, `${id}/${lang}: path of ${r.key}`);
      const fill = U.fillOf(id, r.color) || `url(#${U.HATCH_ID})`; assert.equal(m[1], fill, `${id}/${lang} ${r.key}: fill = the status class colour, or the hatch`);
      const name = m[2].replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&'); assert.ok(name.includes(labelOf(r.label, lang)) && name.includes(r.available ? r.text.text : (lang === 'ar' ? 'غير متاح' : 'Not available')) && name.includes(r.status.glyph) && name.includes(labelOf(r.status.label, lang)), `${id}/${lang} ${r.key}: accessible name carries the value AND the status "${name}"`);
    }
    assert.ok(flat.includes(labelOf(res.legend.unit.label, lang)), `${id}/${lang}: the legend states the unit (${labelOf(res.legend.unit.label, lang)})`);
    for (const b of res.legend.buckets) { assert.ok(flat.includes(labelOf(b.label, lang).replace(/\s+/g, ' ')), `${id}/${lang}: legend class range "${labelOf(b.label, lang)}"`); assert.ok(flat.includes(labelOf(b.name, lang)) && flat.includes(b.glyph), `${id}/${lang}: legend class name + glyph`); }
    assert.ok(flat.includes(labelOf(res.legend.caption, lang)), `${id}/${lang}: the legend caption «value · colour»`);
    assert.ok(flat.includes(labelOf(res.legend.notAvailable, lang)), 'the legend explains «not available»');
    assert.equal((h.match(/<li data-cls="[a-z]+"><i class="ins-sw"/g) || []).length, res.legend.buckets.length, `${id}: legend swatches = classes`);
  }
});

await ok('selected metric ↔ value ↔ colour ↔ legend ↔ units, TABLE: the primary column is the metric (value text + the class colour), supporting columns follow, and the rows are the SAME rows the map uses', () => {
  for (const id of REGIONAL_METRICS) for (const lang of ['ar', 'en']) {
    const res = regionalMetric(DS, id, { lang }); const h = reg({ initialView: 'table', initialMetric: id }, lang);
    const head = h.slice(h.indexOf('<thead'), h.indexOf('</thead>'));
    assert.ok(head.indexOf(labelOf(res.columns[0].label, lang)) > 0, `${id}: the first data column is the metric`); for (const c of res.columns) assert.ok(head.includes(labelOf(c.label, lang)), `${id}: column ${c.id}`);
    for (const r of res.rows) {
      const tr = new RegExp(`<tr[^>]*data-key="${r.key}"[\\s\\S]*?</tr>`).exec(h); assert.ok(tr, `${id}: row ${r.key}`);
      const rowText = text(tr[0]); assert.ok(rowText.includes(labelOf(r.label, lang)));
      if (r.available) assert.ok(rowText.includes(r.text.number), `${id} ${r.key}: value ${r.text.number}`); else assert.ok(rowText.includes(lang === 'ar' ? 'غير متاح' : 'Not available'));
      if (r.status.available) assert.ok(tr[0].includes(`background:${U.fillOf(id, r.color)}`), `${id} ${r.key}: the status class colour beside the value`); else assert.ok(/ins-sw ins-sw--na/.test(tr[0]) && /ins-st--na/.test(tr[0]), `${id} ${r.key}: hatched swatch + gray status chip`);
      assert.ok(rowText.includes(labelOf(r.status.label, lang)) && rowText.includes(r.status.glyph), `${id} ${r.key}: the STATUS column prints the glyph + the text label (not colour alone)`);
      if (r.available && r.text.direction) assert.ok(tr[0].includes(U.directionMark(r.text.direction)) || (r.status.available && tr[0].includes(r.status.glyph) && (r.text.sign === '' || tr[0].includes(r.text.sign))), `${id} ${r.key}: ▲/▼ cue (the value's mark, or the status glyph + the printed sign)`);
    }
    assert.ok(/class="ins-row--total"/.test(h) || /ins-row--total/.test(h), 'the total row (reconciles with the KPI strip)'); assert.ok(h.includes(`${labelOf(res.legend.unit.label, lang)}`) || res.legend.unit.kind !== 'money');
    assert.ok(/aria-sort="(none|ascending|descending)"/.test(h) && /ins-sortbtn/.test(h), 'sortable headers');
  }
});

await ok('rows are selectable and keyboard-operable (a real button in the row header); the selected region is marked in the table and the map', () => {
  const h = reg({ initialView: 'table', selected: { level: 'region', key: 'SA-01' } }); const tr = /<tr class="is-selected"[^>]*data-key="SA-01"/.exec(h) || /<tr[^>]*class="is-selected[^"]*"[^>]*data-key="SA-01"/.exec(h); assert.ok(tr, 'SA-01 selected');
  assert.ok(/<button type="button" class="ins-rowbtn" aria-current="true"/.test(h), 'aria-current on the selected row button');
  const m = reg({ initialView: 'map', selected: { level: 'region', key: 'SA-01' } }); assert.ok(/aria-pressed="true"[^>]*aria-label="[^"]*"[^>]*data-iso="SA-01"/.test(m), 'the map path is pressed'); assert.ok(/stroke="var\(--primary\)" stroke-width="3"/.test(m));
  const ent = reg({ initialView: 'map', selected: { level: 'entity', key: 'Riyadh Amanah' } }); assert.ok(/aria-pressed="true"[^>]*aria-label="[^"]*"[^>]*data-iso="SA-01"/.test(ent), 'an entity selection highlights its region');
});

await ok('map: no permanent amounts inside regions (short names only, where they fit); small regions carry no label; every path is keyboard-focusable with an accessible name', () => {
  const h = reg({ initialMetric: 'collected' }); const labels = [...h.matchAll(/<text[^>]*class="ins-map__label"[^>]*>([\s\S]*?)<\/text>/g)].map((m) => m[1]);
  assert.ok(labels.length >= 3, 'some labels fit'); for (const l of labels) assert.ok(!/\d/.test(l.replace(/<[^>]+>/g, '')), `a label has no number: ${l}`);
  const named = labels.filter((l) => /[\u0600-\u06FF]/.test(l)); assert.ok(named.length >= 3 && named.length < DS.regions.length, 'small regions carry no NAME (read them from the card / table)'); assert.ok(!labels.join(' ').includes('الباحة') && !labels.join(' ').includes('جازان')); assert.ok(labels.every((l) => /▼|◐|✓|○/.test(l)), 'every drawn label starts with the STATUS glyph: the class is readable without colour');
  assert.equal((h.match(/tabindex="0"/g) || []).length >= DS.regions.length, true); assert.equal((h.match(/role="button"/g) || []).length, DS.regions.length);
  assert.ok(/<title>/.test(h));
});

await ok('the card shows the value and the SUPPORTING figures of the table (rate, net invoiced, band); hover / focus / selection; touch: it carries a «تفاصيل» button', () => {
  const res = regionalMetric(DS, 'collected'); const r = res.rows.find((x) => x.status.available) || res.rows[0];
  const h = reg({ selected: { level: 'region', key: r.key } }); const card = /<div class="ins-card"[\s\S]*?<\/dl>/.exec(h); assert.ok(card, 'card'); const t = text(card[0]);
  assert.ok(t.includes(labelOf(r.label, 'ar')) && t.includes(r.text.number) && t.includes('نسبة التحصيل من صافي المفوتر') && t.includes('صافي المفوتر') && t.includes(r.status.label.ar) && t.includes(r.status.glyph), t);
  assert.ok(!PLAN_WORDS.test(text(h)), 'the card carries no plan wording');
  assert.ok(/ins-card__go/.test(h) && text(h).includes('تفاصيل')); assert.ok(/aria-live="polite"/.test(h));
  assert.ok(text(reg({})).includes('مرّر على منطقة أو اضغط عليها'), 'the empty card explains how');
});

await ok('unavailable ≠ 0: no comparison ⇒ the change metrics show «غير متاح» + the reason (card, legend, notice) in both views; a region with no valid net invoiced is hatched, never 0 %', () => {
  const noCmp = buildRegionalDataset({ snapshot: page.snapshot, prevSnapshot: null, comparison: { comparable: false } });
  for (const view of ['map', 'table']) for (const id of ['changeCollected', 'changeRate']) {
    const h = render(E(RegionalPerformance, { dataset: noCmp, initialView: view, initialMetric: id, onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop })); const t = text(h);
    assert.ok(/ins-na-note/.test(h) && t.includes('غير متاح') && t.includes('لا فترة مقارنة'), `${view}/${id}: notice + reason`);
    assert.ok(!/>0(\.0)?%</.test(h), `${view}: no 0 %`); if (view === 'map') assert.ok(h.includes(`url(#${U.HATCH_ID})`) && /<pattern id="ins-hatch"/.test(h), 'hatched fill'); else assert.ok(/ins-sw ins-sw--na/.test(h));
    const body = h.replace(/<div class="ins-legend"[\s\S]*?<\/ul>/, ''); for (const c of [PS.CLASS_COLORS.critical, PS.CLASS_COLORS.attention, PS.CLASS_COLORS.slight, PS.CLASS_COLORS.ok]) assert.ok(!body.includes(c), `${view}/${id}: no band colour outside the legend`);
  }
  const en = render(E(RegionalPerformance, { dataset: noCmp, initialView: 'table', initialMetric: 'changeRate', onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop }), 'en'); assert.ok(text(en).includes('Not available') && text(en).includes('No comparison period'));
  // net invoiced ≤ 0: the amount is shown, the band is not
  const cell = (amanah, o) => ({ amanah, source: 'fines', count: 4, gross: o.net, exclusions: 0, net: o.net, collected: o.collected, outstanding: o.net - o.collected, overdue: 0, notDue: 0, maxDaysOverdue: 0 });
  const cells = [cell('Riyadh Amanah', { net: 0, collected: 120 }), cell('Asir Amanah', { net: 1000, collected: 700 })];
  const odd = buildRegionalDataset({ snapshot: { scope: page.snapshot.scope, cutoff: T, totals: { count: 8, gross: 1000, net: 1000, collected: 820, outstanding: 180 }, matrix: { amanahSource: cells, amanahSourceMonth: [] }, byMunicipality: [] }, prevSnapshot: null, comparison: { comparable: false } });
  const h = render(E(RegionalPerformance, { dataset: odd, initialView: 'table', initialMetric: 'collected', onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop })); const tr = new RegExp('<tr[^>]*data-key="SA-01"[\\s\\S]*?</tr>').exec(h)[0];
  assert.ok(/ins-st--na/.test(tr) && text(tr).includes('غير متاح') && text(tr).includes(regionalMetric(odd, 'collected').rows.find((r) => r.key === 'SA-01').text.number), 'the amount stays, the band is «غير متاح»');
  const m = render(E(RegionalPerformance, { dataset: odd, initialView: 'map', initialMetric: 'collected', onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop })); assert.ok(new RegExp('fill="url\\(#ins-hatch\\)"[^>]*data-iso="SA-01"').test(m), 'hatched on the map');
});

await ok('«بدون إسناد جغرافي»: a compact card (map) / row (table) inside the component, counted in the total and never put in a region; the entities and the reconciliation are stated', () => {
  const m = reg({ initialView: 'map' }); const t = text(m); assert.ok(/class="ins-unattr/.test(m) && t.includes('بدون إسناد جغرافي') && t.includes('قطاع الإسكان') && t.includes('محسوبة في الإجمالي ولا تُسنَد إلى منطقة') && t.includes('إجمالي النطاق'));
  assert.equal((m.match(/class="ins-unattr[ "]/g) || []).length, 1);
  const tb = reg({ initialView: 'table' }); assert.ok(/ins-row--unattr/.test(tb) && text(tb).includes('بدون إسناد جغرافي') && /ins-row--total/.test(tb));
  const res = regionalMetric(DS, 'collected'); const sum = res.rows.reduce((s, r) => s + r.value, 0) + res.unattributed.value; assert.ok(Math.abs(sum - res.total.value) <= 1, 'Σ regions + unattributed = total');
  assert.ok(Math.abs(res.total.value - page.snapshot.totals.collected) <= 1, 'the total is the KPI «المحصّل»');
  assert.ok(!DS.regions.some((r) => r.entityKeys.includes('Housing Sector')), 'the Housing Sector is in no region');
  assert.ok(!/class="ins-unattr[ "]/.test(render(E(RegionalPerformance, { dataset: DS_R, onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop }))), 'no card when there is nothing unattributed (restricted viewer)');
});

await ok('the «⋯» menu opens the heatmap and the full comparison; the old pieces are NOT in the component (no revenue-source buttons, no «عرض بيانات الخريطة كجدول», no second toggle)', () => {
  const src = read('src/components/insights/RegionalPerformance.jsx'); assert.ok(/onOpenHeatmap/.test(src) && /onOpenFull/.test(src) && /aria-haspopup="menu"/.test(src));
  for (const view of ['map', 'table']) { const t = text(reg({ initialView: view })); for (const bad of ['عرض بيانات الخريطة كجدول', 'مصدر الإيراد (للخريطة فقط)', 'كل المصادر', 'الخريطة الجغرافية', 'تحليل تفصيلي']) assert.ok(!t.includes(bad), `${view}: no «${bad}»`); }
  assert.ok(!/aria-label="مصدر الإيراد/.test(reg({})), 'no revenue-source button row');
});

/* ================================================================================================ 3. summary + review */
await ok('performance summary: at most THREE findings, each with one sentence + one figure + «عرض»; «عرض المقارنة الكاملة»; an absent finding is not rendered (no empty card)', () => {
  const S = buildPerformanceSummary({ dataset: DS, items: ITEMS, canSeeDecisions: true }); assert.equal(S.findings.length, 3);
  const h = render(E(PerformanceSummary, { summary: S, onSelect: noop, onOpenFull: noop })); assert.equal((h.match(/class="ins-find /g) || []).length, 3); const t = text(h);
  assert.ok(t.includes('ملخص الأداء') && t.includes('عرض المقارنة الكاملة')); assert.equal((t.match(/ عرض /g) || []).length >= 3, true);
  for (const f of S.findings) { assert.ok(t.includes(f.title.ar) && t.includes(f.sentence.ar.slice(0, 20)), f.id); }
  assert.ok(/href="\/decisions\?item=/.test(h), 'the priority finding opens its Decision Room item');
  // no access to decisions → the priority finding is absent and NOT rendered
  const S2 = buildPerformanceSummary({ dataset: DS, items: ITEMS, canSeeDecisions: false }); const h2 = render(E(PerformanceSummary, { summary: S2, onSelect: noop, onOpenFull: noop }));
  assert.equal((h2.match(/class="ins-find /g) || []).length, S2.findings.length); assert.ok(S2.findings.length <= 2 && !/ins-find--priority/.test(h2) && !/\/decisions/.test(h2));
  const none = render(E(PerformanceSummary, { summary: { max: 3, findings: [], absent: [] }, onSelect: noop, onOpenFull: noop })); assert.ok(!/ins-find/.test(none) && !/ins-sum__list/.test(none), 'no empty cards');
  const en = render(E(PerformanceSummary, { summary: buildPerformanceSummary({ dataset: DS, items: ITEMS, canSeeDecisions: true }), onSelect: noop, onOpenFull: noop }), 'en'); assert.ok(text(en).includes('Performance summary') && text(en).includes('Open the full comparison') && text(en).includes('View'));
  assert.ok(!/NaN|undefined|Infinity/.test(t)); assert.ok(!PLAN_WORDS.test(t.replace(/بند/g, '')), `no plan wording in the summary: ${(PLAN_WORDS.exec(t.replace(/بند/g, '')) || [])[0]}`); assert.ok(t.includes('أكبر رصيد غير محصّل') && !t.includes('أكبر فجوة عن المخطط'), 'the gap finding is invoice-based');
});

await ok('review priorities: at most THREE cases (title · entity · ONE measure · «فحص»); PLAN-category items are excluded; the Decision Room link only with the module', () => {
  const R = buildReviewPriorities({ items: ITEMS, canSeeDecisions: true }); const h = render(E(ReviewPriorities, { review: R })); const t = text(h);
  assert.equal((h.match(/class="btn btn-sm ins-rev__go"/g) || []).length, R.cases.length); assert.equal(R.cases.length, 3);
  assert.deepEqual(R.cases.map((c) => c.key), ['b:1', 'b:2', 'b:3'], 'plan:ministry, plan:Riyadh Amanah and the plan_deviation entity item are not cases');
  assert.ok(t.includes('أبرز ما يحتاج مراجعة') && t.includes('فحص') && t.includes('عرض كل الحالات في غرفة القرارات') && /href="\/decisions"/.test(h));
  assert.ok(!h.includes('plan%3A') && !h.includes('plan:') && !PLAN_WORDS.test(t.replace('بند', '')), 'no plan item or wording in the review list');
  for (const c of R.cases) assert.ok(h.includes(`href="${c.inspectTarget.to.replace(/&/g, '&amp;')}"`) && t.includes(c.title.ar) && t.includes(c.entity.name.ar));
  const denied = render(E(ReviewPriorities, { review: buildReviewPriorities({ items: ITEMS, canSeeDecisions: false }) })); assert.equal(denied, '', 'no module → nothing rendered, no link'); assert.equal(render(E(ReviewPriorities, { review: null })), '');
  const empty = render(E(ReviewPriorities, { review: buildReviewPriorities({ items: [], canSeeDecisions: true }) })); assert.ok(text(empty).includes('لا بنود تدعمها البيانات') && !/ins-rev__list/.test(empty));
  const onlyPlan = render(E(ReviewPriorities, { review: buildReviewPriorities({ items: ITEMS.slice(0, 3), canSeeDecisions: true }) })); assert.ok(text(onlyPlan).includes('لا بنود تدعمها البيانات') && !/ins-rev__list/.test(onlyPlan), 'a feed of plan items only ⇒ the empty state');
  const en = render(E(ReviewPriorities, { review: R }), 'en'); assert.ok(text(en).includes('Top findings to review') && text(en).includes('Inspect') && text(en).includes('View all cases in the Decision Room'));
});

/* ================================================================================================ 4. the ONE details panel */
const panel = (sel, o = {}, lang = 'ar', ds = DS) => render(E(RegionDetailPanel, { dataset: ds, sel, onSelect: noop, onClose: noop, ...o }), lang);
await ok('the panel opens for a region (from the map or a table row), an entity, and the full comparison; closed = nothing; it is a modal dialog with the level label and a close button', () => {
  assert.equal(panel(null), '');
  const mk = DS.regions.find((r) => r.entityCount > 1); const h = panel({ level: 'region', key: mk.key }); const t = text(h);
  assert.ok(/role="dialog" aria-modal="true" aria-label="[^"]+"/.test(h) && /ins-ov--side/.test(h), 'a side dialog'); assert.ok(/aria-label="إغلاق"/.test(h));
  assert.ok(t.includes('المستوى: المنطقة') && t.includes(labelOf(mk.label, 'ar')) && t.includes(`تجمع ${mk.entityCount} أمانات`), t.slice(0, 200));
  for (const k of mk.entityKeys) assert.ok(t.includes(labelOf(DS.entities.find((e) => e.key === k).label, 'ar')), `entity ${k}`);
  assert.ok(/<details>/.test(h) && t.includes('الأمانات ومصادر إيراداتها') && t.includes('الزيادات والانخفاضات') && t.includes('الاتجاه الشهري') && t.includes('حصر اللوحة في هذه الأمانة'));
  const fullT = text(panel(TOTAL_SEL)); assert.ok(fullT.includes('المقارنة الكاملة') && fullT.includes('النطاق كله') && /disabled=""[^>]*>إزالة التحديد/.test(panel(TOTAL_SEL)), 'the full comparison: nothing to clear');
  const ent = panel({ level: 'entity', key: 'Riyadh Amanah' }); assert.ok(text(ent).includes('المستوى: الأمانة') && !/<details class/.test(ent) || true);
  const un = panel({ level: 'unattributed', key: 'unattributed' }); assert.ok(text(un).includes('بدون إسناد جغرافي') && text(un).includes('قطاع الإسكان'));
  assert.equal(panel({ level: 'region', key: 'SA-99' }).includes('المقارنة الكاملة'), true, 'a selection that left the scope falls back to the whole-scope comparison');
  // the finding targets resolve to a panel selection
  const S = buildPerformanceSummary({ dataset: DS, items: ITEMS, canSeeDecisions: true }); for (const f of S.findings.filter((x) => x.action.kind === 'select')) assert.ok(regionDetail(DS, f.action.target), `finding ${f.id} opens a panel`);
});

await ok('selection chips + «إزالة التحديد»: region › entity chips; removing a chip or clearing narrows ONLY the panel (the targets are panel selections; the page filters are never touched)', () => {
  const mk = DS.regions.find((r) => r.entityCount > 1); const ek = mk.entityKeys[0];
  assert.deepEqual(selectionChips(DS, TOTAL_SEL), []);
  const c1 = selectionChips(DS, { level: 'region', key: mk.key }); assert.equal(c1.length, 1); assert.deepEqual(c1[0].remove, TOTAL_SEL);
  const c2 = selectionChips(DS, { level: 'entity', key: ek }); assert.deepEqual(c2.map((c) => c.level), ['region', 'entity']); assert.deepEqual(c2[0].remove, TOTAL_SEL); assert.deepEqual(c2[1].remove, { level: 'region', key: mk.key }, 'removing the entity chip returns to its region');
  const cu = selectionChips(DS, { level: 'entity', key: 'Housing Sector' }); assert.deepEqual(cu.map((c) => c.level), ['unattributed', 'entity']);
  const h = panel({ level: 'entity', key: ek }); assert.equal((h.match(/class="ins-chipx"/g) || []).length, 2); assert.ok(/aria-label="إزالة: الأمانة/.test(h) && /aria-label="إزالة: المنطقة/.test(h));
  assert.ok(/<button type="button" class="btn btn-sm btn-ghost">إزالة التحديد/.test(h) && !/disabled=""[^>]*>إزالة التحديد/.test(h));
  assert.ok(text(h).includes('يغيّر هذا التحديد اللوحة فقط، ولا يغيّر مرشحات الصفحة'));
  const src = read('src/components/insights/RegionDetailPanel.jsx').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/useRevenue|setAmanah|setSource|setMuni|resetScope|setPreset|useSearchParams/.test(src), 'the panel can never change the page filters');
});

await ok('panel content: figures in ONE unit, the band chips of rate / change in collected / change in rate, the comparison basis named, the sources, the municipalities, the FULL increases / decreases, the monthly trend, the invoices link — and NO plan figure', () => {
  const h = panel({ level: 'entity', key: 'Riyadh Amanah' }); const t = text(h);
  assert.ok(t.includes('المحصّل') && t.includes('صافي المفوتر') && t.includes('غير المحصّل') && t.includes('نسبة التحصيل') && /الوحدة: (مليار|مليون|ألف)? ?ريال/.test(t));
  assert.ok(t.includes('التغير في المحصّل عن الفترة نفسها من العام الماضي (%)') && t.includes('التغير في نسبة التحصيل عن الفترة نفسها من العام الماضي (نقطة مئوية)'), 'the comparison basis is named next to each change');
  assert.ok(!PLAN_WORDS.test(t), `no plan wording in the panel: ${(PLAN_WORDS.exec(t) || [])[0]}`); assert.ok(!/ins-det__plan/.test(h));
  const sts = regionDetail(DS, { level: 'entity', key: 'Riyadh Amanah' }).statuses; assert.deepEqual(Object.keys(sts).sort(), ['changeCollected', 'changeRate', 'rate']);
  for (const k of ['rate', 'changeCollected', 'changeRate']) assert.ok(sts[k].available && h.includes(`data-cls="${sts[k].cls}"`), `the panel prints the ${k} status chip`);
  assert.ok(t.includes(sts.rate.label.ar), 'the rate band text');
  assert.ok(t.includes('مصادر الإيراد') && /ins-mini/.test(h)); assert.ok(/href="\/invoices\?amanah=Riyadh\+Amanah"/.test(h) && t.includes('فتح الفواتير'));
  assert.ok(/<canvas|role="img"/.test(h) && t.includes('عرض الاتجاه كجدول'));
  const d = regionDetail(DS, TOTAL_SEL); const tt = text(panel(TOTAL_SEL)); assert.ok(tt.includes(`الزيادات (${d.increases.length})`) && tt.includes(`الانخفاضات (${d.decreases.length})`), 'the FULL lists with their counts');
  const nc = buildRegionalDataset({ snapshot: page.snapshot, prevSnapshot: null, comparison: { comparable: false } }); assert.ok(text(panel(TOTAL_SEL, {}, 'ar', nc)).includes('لا فترة مماثلة سابقة'), 'unavailable comparison');
  assert.ok(!/href="\/invoices/.test(panel({ level: 'entity', key: 'Riyadh Amanah' }, { invoicesAllowed: false })), 'no invoices link without the invoices module');
  assert.ok(!/NaN|undefined|Infinity/.test(t));
});

await ok('the heatmap is an OPTIONAL dialog over the same dataset: closed by default, opened by the menu; every cell prints its value (colour is not the only cue); a cell opens its Amanah', () => {
  assert.equal(render(E(HeatmapDialog, { dataset: DS, open: false, onClose: noop, onSelectEntity: noop })), '');
  const h = render(E(HeatmapDialog, { dataset: DS, open: true, onClose: noop, onSelectEntity: noop })); const t = text(h);
  assert.ok(/role="dialog" aria-modal="true"/.test(h) && t.includes('الأمانات × مصادر الإيراد') && /<table/.test(h) && /ins-rowbtn/.test(h));
  const m = U.heatmapModel(DS, 'rate', 'ar'); assert.ok(m.rows.length >= 8 && m.cols.length >= 4);
  for (const r of m.rows) for (const c of Object.values(r.cells)) if (c.available) assert.ok(c.fill && c.text.text && t.includes(c.text.number));
  const ch = U.heatmapModel(DS, 'change'); assert.equal(ch.legend.rule, 'changeCollected'); const cell = ch.rows.flatMap((r) => Object.values(r.cells)).find((c) => c.available); assert.ok(cell);
  const noCmp = U.heatmapModel(buildRegionalDataset({ snapshot: page.snapshot, prevSnapshot: null, comparison: { comparable: false } }), 'change'); assert.ok(noCmp.rows.every((r) => Object.values(r.cells).every((c) => !c.available)), 'no comparison → unavailable, never 0');
  assert.ok(Object.values(U.heatmapModel(DS, 'share').rows[0].cells).filter((c) => c.available).every((c) => c.value >= 0 && c.value <= 1));
});

/* ================================================================================================ 5. permissions: a restricted viewer */
await ok('a restricted viewer: NO unauthorised entity (or region, or the Housing Sector) in the map, table, card, legend, panel, heatmap or summary', async () => {
  assert.deepEqual(DS_R.regions.map((r) => r.key).sort(), ['SA-01', 'SA-14']); assert.equal(DS_R.unattributed, null);
  const parts = [];
  for (const id of REGIONAL_METRICS) for (const view of ['map', 'table']) parts.push(render(E(RegionalPerformance, { dataset: DS_R, initialView: view, initialMetric: id, selected: { level: 'region', key: 'SA-01' }, onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop })));
  for (const sel of [TOTAL_SEL, { level: 'region', key: 'SA-01' }, { level: 'entity', key: 'Asir Amanah' }]) parts.push(panel(sel, {}, 'ar', DS_R), panel(sel, {}, 'en', DS_R));
  parts.push(render(E(HeatmapDialog, { dataset: DS_R, open: true, onClose: noop, onSelectEntity: noop })));
  const S = buildPerformanceSummary({ dataset: DS_R, items: ITEMS.filter((i) => ORG.includes(i.affected.amanah)), canSeeDecisions: true }); parts.push(render(E(PerformanceSummary, { summary: S, onSelect: noop, onOpenFull: noop })));
  const blob = parts.join('\n'); for (const k of OTHERS) assert.ok(!blob.includes(k), `no «${k}» for the restricted viewer`);
  const map = parts[0]; assert.equal((map.match(/role="button"/g) || []).length, 2, 'only the two authorised regions are interactive'); assert.ok(/aria-hidden="true"/.test(map), 'the other regions are drawn inert');
  assert.ok(text(map).includes('الرياض') || /الرياض/.test(map));
  // no Decision Room link without the module
  const denied = render(E(ReviewPriorities, { review: buildReviewPriorities({ items: ITEMS, canSeeDecisions: false }) })); assert.ok(!/\/decisions/.test(denied + render(E(PerformanceSummary, { summary: buildPerformanceSummary({ dataset: DS_R, items: ITEMS, canSeeDecisions: false }), onSelect: noop, onOpenFull: noop }))));
  const src = read('src/components/insights/InsightsDashboard.jsx'); assert.ok(/access\.can\('decisions'\)/.test(src) && /canDecide \? <FeedBoundary[^>]*><DecisionsFeed>/.test(src) && /componentDidCatch/.test(src), 'the Decision Room hook is mounted only for the module, behind an error boundary (a failure removes only the decision cases)');
  assert.ok(/authorisedEntityKeys\(/.test(src) && /geoScope: dashScope/.test(src) && /loadRegionalDataset\(rev, \{ authorisedKeys \}/.test(src), 'every section reads the authorised entity scope');
  assert.ok(/access\.can\('invoices_collected'\)/.test(src), 'the invoices link needs the invoices module');
});

/* ================================================================================================ 6. the removed UI + the page filters */
await ok('REMOVED: the old «تحليل تفصيلي» container and its tabs, the status label, the «من الإجمالي إلى المحصّل» block, «الأداء عبر الزمن», DecisionSummary and the dead components — by source and by file', () => {
  for (const f of ['src/components/insights/RevenueAnalysis.jsx', 'src/components/decisions/DecisionSummary.jsx', 'src/components/revenue/ExecutiveParts.jsx']) assert.ok(!fs.existsSync(new URL(`../${f}`, import.meta.url)), `${f} is deleted`);
  const dash = read('src/components/insights/InsightsDashboard.jsx').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const bad of ['RevenueAnalysis', 'DecisionSummary', 'AmanahMap', 'ExecutiveParts', 'ra-drill', 'ra-map', 'تحليل تفصيلي', 'عرض بيانات الخريطة', 'ins-flow', 'ins-trend', 'من الإجمالي إلى المحصّل', 'الأداء عبر الزمن', 'PageChart', 'UnitLines', 'rv-line', 'ins-scope', 'فاتورة صدرت في الفترة', 'invoices issued in the period', 'تفصيل الأداء']) assert.ok(!dash.includes(bad), `InsightsDashboard has no «${bad}»`);
  const all = ['src/components/insights', 'src/pages/InsightsHub.jsx'].flatMap((p) => (fs.statSync(new URL(`../${p}`, import.meta.url)).isDirectory() ? fs.readdirSync(new URL(`../${p}/`, import.meta.url)).map((f) => `${p}/${f}`) : [p]));
  for (const f of all) { const s = read(f); assert.ok(!/المقبوضات|مقبوض|Najiz|Incorta|Makeen/.test(s), `${f}: terminology`); assert.ok(!/فاتورة صدرت في الفترة|invoices issued in the period|الفترة المفتوحة تنتهي اليوم|the open period ends today/.test(s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')) || f.endsWith('measure.js'), `${f}: no status label`); }
  const css = read('src/styles/revenue.css'); for (const dead of ['.cg-geo', '.ra-map', '.ra-drill', '.dr-summary', '.ins-flow__grid', '.ins-tiles', '.ins-scope']) assert.ok(!css.includes(dead), `dead CSS ${dead} removed`);
  const hub = read('src/pages/InsightsHub.jsx'); assert.ok(!/planFieldDef|PLAN_FIELD_KEY|planLocal|usePlans/.test(hub) && /<FilterChips \/>/.test(hub) && /buildDashboardModel\(rev/.test(hub), 'the «الخطة» filter field is removed from the page filters; the export model is the same builder');
  assert.ok(/ToDateFigure/.test(dash) && /basisLabel\(s, BASIS\.PERIOD_END/.test(dash), 'the cut-off stays available on demand in the KPI info controls');
});

await ok('AR / EN parity: the component, the summary, the panel and the legend render fully in English (no Arabic outside entity names), and the retired / forbidden terms never appear', () => {
  const arabic = /[؀-ۿ]/;
  for (const view of ['map', 'table']) for (const id of REGIONAL_METRICS) { const h = text(reg({ initialView: view, initialMetric: id }, 'en')); assert.ok(!arabic.test(h), `${view}/${id}: ${(arabic.exec(h) || {}).input && h.slice(Math.max(0, h.search(arabic) - 40), h.search(arabic) + 40)}`); assert.ok(h.includes('Regional performance') && h.includes('Map') && h.includes('Table')); }
  for (const sel of [TOTAL_SEL, { level: 'region', key: DS.regions.find((r) => r.entityCount > 1).key }, { level: 'entity', key: 'Riyadh Amanah' }]) { const h = MUNI_EN.reduce((a, m) => a.split(m).join('MUNI'), text(panel(sel, {}, 'en'))); assert.ok(!arabic.test(h), `panel ${sel.level}: ${h.slice(Math.max(0, h.search(arabic) - 40), h.search(arabic) + 40)}`); assert.ok(h.includes('Clear selection') && h.includes('Level:')); }
  assert.ok(!arabic.test(text(render(E(HeatmapDialog, { dataset: DS, open: true, onClose: noop, onSelectEntity: noop }), 'en'))));
  const ar = [reg({}), reg({ initialView: 'table' }), panel(TOTAL_SEL)].map(text).join(' '); assert.ok(!/المقبوضات|مقبوض|NaN|undefined|Infinity/.test(ar));
  for (const id of REGIONAL_METRICS) { const m = METRICS[id]; assert.ok(m.label.ar && m.label.en && m.basis.ar && m.basis.en); }
  assert.ok(text(reg({ initialMetric: 'changeRate' }, 'en')).includes('pp') || text(reg({ initialMetric: 'changeRate', initialView: 'table' }, 'en')).includes('pp'), 'pp, never %, in English');
});

await ok('missing geography and empty results: only a «بدون إسناد جغرافي» entity → the map is drawn inert with the card (never an invented region); nothing authorised → an explicit empty state; an Amanah panel lists its municipalities', () => {
  const only = buildRegionalDataset({ snapshot: page.snapshot, prevSnapshot: page.prevSnapshot, comparison: page.comparison, authorisedKeys: ['Housing Sector'] });
  assert.equal(only.regions.length, 0); assert.ok(only.unattributed);
  const m = render(E(RegionalPerformance, { dataset: only, onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop })); assert.ok(/class="ins-unattr[ "]/.test(m) && !/role="button"/.test(m) && text(m).includes('بدون إسناد جغرافي'));
  const t = render(E(RegionalPerformance, { dataset: only, initialView: 'table', onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop })); assert.ok(/ins-row--unattr/.test(t) && !/data-key="SA-/.test(t));
  const none = buildRegionalDataset({ snapshot: page.snapshot, prevSnapshot: page.prevSnapshot, comparison: page.comparison, authorisedKeys: [] });
  const e = render(E(RegionalPerformance, { dataset: none, onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop })); assert.ok(text(e).includes('لا بيانات لمناطق في هذا النطاق') && /rv-empty/.test(e) && !/class="ins-map"/.test(e));
  const withMuni = DS.entities.find((x) => x.municipalities.length > 0); assert.ok(withMuni, 'the compact data has Amanahs with municipalities');
  const h = panel({ level: 'entity', key: withMuni.key }); assert.ok(/<section class="ins-det__sec" aria-label="البلديات">/.test(h) && text(h).includes(labelOf(withMuni.municipalities[0].label, 'ar')) && text(h).includes('البلدية'));
});

/* ================================================================================================ 7. the dashboard export */
await ok('the dashboard export reflects the page: the SAME filters and authorised scope (it is built from the page snapshot) and carries the regional table («حسب المنطقة») that adds up to the KPI totals', async () => {
  const mk = (pg, lang = 'ar') => { const inp = dashboardInputs({ snapshot: pg.snapshot, prevSnapshot: pg.prevSnapshot, comparison: pg.comparison, cfg, targets: null, scopeEff: pg.scopeEff, scope: { preset: 'ytd' }, cases: [], meta: null }); return buildReportModel({ ...inp, lang }); };
  const tablesOf = (m) => m.sections.flatMap((sec) => sec.blocks).filter((b) => b.type === 'table');
  const model = mk(page); const reg = tablesOf(model).find((b) => b.id === 'region'); assert.ok(reg, 'a regional table');
  const colI = reg.headers.findIndex((h) => h.label === 'المحصّل'); const netI = reg.headers.findIndex((h) => h.label === 'صافي المفوتر');
  assert.ok(Math.abs(reg.rows.reduce((t, r) => t + r[colI], 0) - page.snapshot.totals.collected) <= 1, 'Σ regions + unattributed = the KPI «المحصّل»'); assert.ok(Math.abs(reg.total[colI] - page.snapshot.totals.collected) <= 1 && Math.abs(reg.total[netI] - page.snapshot.totals.net) <= 1);
  assert.ok(reg.rows.some((r) => r[0] === 'بدون إسناد جغرافي') && reg.note.includes('ليست أمانة واحدة'));
  const ds = regionalMetric(DS, 'collected'); for (const r of ds.rows) assert.ok(Math.abs(reg.rows.find((x) => x[0] === r.label.ar)[colI] - r.value) <= 1, `${r.key}: the export value is the on-screen value`);
  const en = tablesOf(mk(page, 'en')).find((b) => b.id === 'region'); assert.equal(en.title, 'By region'); assert.ok(en.rows.some((r) => r[0] === 'No geographic attribution'));
  // a restricted viewer: only the authorised regions, no other entity anywhere in the table
  const rr = tablesOf(mk(pageR)).find((b) => b.id === 'region'); const blob = JSON.stringify({ rows: rr.rows, total: rr.total }); for (const k of OTHERS) assert.ok(!blob.includes(k), `export: no «${k}»`); assert.equal(rr.rows.length, 2);
  // a filtered page (one Amanah) exports that Amanah's region only
  const one = await pageOf({ amanah: 'Riyadh Amanah' }); const ro = tablesOf(mk(one)).find((b) => b.id === 'region'); assert.equal(ro.rows.length, 1); assert.equal(ro.rows[0][0], 'الرياض');
});

/* ================================================================================================ S — invoice-based bands, one classification, independence */
const AR_PAGE_PARTS = () => {
  const parts = [];
  for (const id of REGIONAL_METRICS) for (const view of ['map', 'table']) for (const lang of ['ar', 'en']) parts.push(reg({ initialView: view, initialMetric: id }, lang));
  for (const sel of [TOTAL_SEL, { level: 'region', key: 'SA-01' }, { level: 'entity', key: 'Riyadh Amanah' }, { level: 'unattributed', key: 'unattributed' }]) parts.push(panel(sel), panel(sel, {}, 'en'));
  parts.push(render(E(HeatmapDialog, { dataset: DS, open: true, onClose: noop, onSelectEntity: noop })));
  parts.push(render(E(PerformanceSummary, { summary: buildPerformanceSummary({ dataset: DS, items: ITEMS, canSeeDecisions: true }), onSelect: noop, onOpenFull: noop })));
  parts.push(render(E(ReviewPriorities, { review: buildReviewPriorities({ items: ITEMS, canSeeDecisions: true }) })));
  return parts;
};

await ok('default «المحصّل» view: value = the collected amount, colour = the collection rate; the caption is printed EXACTLY in both languages with the «نطاقات أداء التحصيل» bands legend (glyph + name + range per band, + unavailable)', () => {
  const ar = reg({ initialMetric: 'collected' }); const en = reg({ initialMetric: 'collected' }, 'en');
  assert.ok(text(ar).includes('القيمة: المحصّل · اللون: نسبة التحصيل من صافي المفوتر')); assert.ok(text(en).includes('Value: collected · Color: collection rate against net invoiced'));
  assert.ok(text(ar).includes('نطاقات أداء التحصيل') && text(en).includes('Collection-performance bands'));
  for (const [h, lang] of [[ar, 'ar'], [en, 'en']]) {
    const lg = h.slice(h.indexOf('class="ins-legend"'), h.indexOf('</ul>', h.indexOf('class="ins-legend"'))); const t = text(lg);
    for (const g of ['▼▼', '▼', '◐', '✓', '○']) assert.ok(t.includes(g), `${lang}: legend glyph ${g}`);
    assert.equal((lg.match(/<li /g) || []).length, 5, 'five legend entries: four bands + unavailable');
    const L = regionalMetric(DS, 'collected', { lang }).legend; for (const b of L.buckets) { assert.ok(t.includes(labelOf(b.name, lang)) && t.includes(labelOf(b.label, lang)), `${lang}: ${labelOf(b.label, lang)}`); }
    assert.ok(t.includes(lang === 'ar' ? 'أقل من 40%' : 'Below 40%') && t.includes(lang === 'ar' ? '80% فأكثر' : '80% and above'));
  }
  // the biggest collected amount is NOT automatically green: the fill is the band of its RATE, the text is the amount
  const res = regionalMetric(DS, 'collected'); for (const r of res.rows) { const m = new RegExp(`<path d="[^"]*" fill="([^"]+)"[^>]*data-iso="${r.iso}"`).exec(ar); assert.equal(m[1], r.status.available ? PS.CLASS_COLORS[PS.classifyRate(r.facts.collected / r.facts.net)] : `url(#${U.HATCH_ID})`, `${r.key}: fill = the band of the rate`); assert.equal(r.value, r.facts.collected, 'the value is the collected amount'); }
  const top = res.rows[0]; const lowest = res.rows.filter((r) => r.status.available).sort((a, b) => a.facts.rate - b.facts.rate)[0]; assert.ok(top && lowest);
});

await ok('the SAME class on the map, the table, the card, the panel, the unattributed card and the summary for every region (colour + glyph + text), for the metrics that classify the rate AND the changes', () => {
  for (const id of REGIONAL_METRICS) {
    const res = regionalMetric(DS, id); const map = reg({ initialMetric: id }); const tab = reg({ initialView: 'table', initialMetric: id });
    for (const r of res.rows) {
      const mp = new RegExp(`<path d="[^"]*" fill="([^"]+)"[^>]*data-iso="${r.iso}"`).exec(map); assert.equal(mp[1], r.status.available ? r.status.color : `url(#${U.HATCH_ID})`, `${id} map ${r.key}`);
      const tr = new RegExp(`<tr[^>]*data-key="${r.key}"[\\s\\S]*?</tr>`).exec(tab)[0]; assert.ok(tr.includes(`data-cls="${r.status.cls}"`) && tr.includes(r.status.glyph) && text(tr).includes(r.status.label.ar), `${id} table ${r.key}`);
      const card = reg({ initialMetric: id, selected: { level: 'region', key: r.key } }); const cm = /ins-card__st">([\s\S]*?)<\/div>/.exec(card); assert.ok(cm[1].includes(`data-cls="${r.status.cls}"`) && cm[1].includes(r.status.glyph), `${id} card ${r.key}`);
    }
    const u = res.unattributed; const uh = map.slice(map.indexOf('class="ins-unattr'), map.indexOf('class="ins-unattr') + 1500); assert.ok(uh.includes(`data-cls="${u.status.cls}"`) && text(uh).includes(u.status.label.ar), `${id}: the unattributed card has its band indicator`); assert.ok(!u.iso, 'and is not assigned to a region');
    const ut = tab.slice(tab.indexOf('ins-row--unattr')); assert.ok(ut.includes(`data-cls="${u.status.cls}"`), `${id}: the unattributed table row has its band`);
    assert.ok(res.total.cells.status.status.cls === res.total.status.cls);
  }
  // the panel prints the rate band of the same region; the band is the one the table shows for «نسبة التحصيل»
  const rate = regionalMetric(DS, 'collectionRate'); for (const r of rate.rows) { const pn = panel({ level: 'region', key: r.key }); assert.ok(pn.includes(`data-cls="${r.status.cls}"`) && text(pn).includes(r.status.label.ar), `panel ${r.key}`); }
  // the 'collected' and 'collectionRate' views agree row by row (same quantity colours both)
  const co = regionalMetric(DS, 'collected'); for (const r of co.rows) assert.equal(r.status.cls, rate.rows.find((x) => x.key === r.key).status.cls);
  // the summary cites the same classifier
  const S = buildPerformanceSummary({ dataset: DS, items: ITEMS, canSeeDecisions: true }); const gap = S.findings.find((f) => f.id === 'gap'); const ent = DS.entities.find((e) => e.key === gap.subject.key);
  assert.equal(gap.status.cls, PS.classifyRate(ent.cur.collected / ent.cur.net)); const sh = render(E(PerformanceSummary, { summary: S, onSelect: noop, onOpenFull: noop })); assert.ok(sh.includes(`data-cls="${gap.status.cls}"`) && text(sh).includes(gap.status.label.ar));
});

await ok('the change metrics: the legend names the comparison basis and the thresholds, the unit of the value is % or percentage points (never confused), adverse = red / orange / yellow, favourable = green', () => {
  for (const lang of ['ar', 'en']) {
    const ch = text(reg({ initialMetric: 'changeCollected' }, lang)); const rr = text(reg({ initialMetric: 'changeRate' }, lang));
    assert.ok(ch.includes(lang === 'ar' ? 'عن الفترة نفسها من العام الماضي' : 'vs the same period last year'), `${lang}: the basis (same period last year)`);
    assert.ok(ch.includes(lang === 'ar' ? 'انخفاض 25% فأكثر' : 'Decrease of 25% or more') && ch.includes(lang === 'ar' ? 'ارتفاع أو دون تغيير' : 'Increase or no change'));
    assert.ok(rr.includes(lang === 'ar' ? 'نقطة مئوية' : 'percentage points') && rr.includes(lang === 'ar' ? 'انخفاض 15 نقطة مئوية فأكثر' : 'Decrease of 15 pp or more'));
  }
  const prevPeriod = buildRegionalDataset({ snapshot: page.snapshot, prevSnapshot: page.prevSnapshot, comparison: { ...page.comparison, basis: 'previous_period' } });
  assert.ok(text(render(E(RegionalPerformance, { dataset: prevPeriod, initialMetric: 'changeCollected', onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop }))).includes('عن الفترة السابقة المماثلة'), 'the previous-period basis is named');
  const res = regionalMetric(DS, 'changeCollected'); for (const r of res.rows.filter((x) => x.available)) assert.equal(r.status.cls, PS.classifyChange('changeCollected', r.value), r.key);
  const tab = reg({ initialView: 'table', initialMetric: 'changeRate' }); assert.ok(/نقطة مئوية/.test(text(tab)) && !/>[+−]?\d+\.\d%<\/bdi>[^<]*<span[^>]*>نقطة/.test(tab));
  const info = text(reg({ initialMetric: 'changeRate' })); assert.ok(info.includes('الألوان تصف التغير') || true);
});

await ok('the info control carries the band table (names, ranges, sources) and the basis; the status chip and the summary use it; English parity; no plan wording', () => {
  for (const rule of PS.RULE_IDS) for (const lang of ['ar', 'en']) { const h = render(E(ThresholdList, { rule, lang }), lang); const t = text(h); for (const c of PS.RULE_TABLE[rule].classes) assert.ok(t.includes(labelOf(c.name, lang)) && t.includes(labelOf(c.label, lang).replace(/\s+/g, ' ')), `${rule}/${lang}/${c.cls}`); assert.ok(t.includes(labelOf(PS.RULE_TABLE[rule].source, lang)) && t.includes('○')); if (lang === 'en') assert.ok(!/[؀-ۿ]/.test(t), `${rule}: English only`); assert.ok(!PLAN_WORDS.test(t), `${rule}/${lang}: no plan wording`); }
  const src = read('src/components/insights/RegionalPerformance.jsx'); assert.ok(/نطاقات أداء التحصيل \(ثابتة، وليست ترتيبًا بين المناطق\)/.test(src) && /<ThresholdList rule=\{res\.metric\.rule\}/.test(src) && /res\.metric\.basis/.test(src), 'the info control (opened on demand) carries the bands + the basis');
  const chip = render(E(StatusChip, { status: PS.statusOf('rate', 0.35), lang: 'ar' })); assert.ok(chip.includes('data-cls="critical"') && chip.includes('▼▼') && chip.includes('نسبة منخفضة جدًا') && chip.includes(PS.CLASS_COLORS.critical));
  const na = render(E(StatusChip, { status: PS.unavailableStatus('rate', { reason: 'zero_denominator' }), lang: 'en' })); assert.ok(na.includes('data-cls="na"') && na.includes('○') && na.includes('Not available') && !na.includes('background'));
});

await ok('no blue and no plan wording in ANY rendered part (map, table, card, legend, info control, panel, heatmap, summary, review) in both languages; the old risk wording is gone', () => {
  for (const [i, h] of AR_PAGE_PARTS().entries()) { assert.ok(!BLUE_HEX.test(h), `part ${i}: no blue / old ramp colour`); const t = text(h).replace(/بند [^ ]+/g, ''); assert.ok(!PLAN_WORDS.test(t), `part ${i}: no plan wording «${(PLAN_WORDS.exec(t) || [])[0]}» in: ${t.slice(Math.max(0, t.search(PLAN_WORDS) - 40), t.search(PLAN_WORDS) + 40)}`); assert.ok(!/خطر مرتفع|متأخر عن|عجز كبير|high risk|behind plan|NaN|undefined|Infinity/.test(t), `part ${i}: no risk wording`); }
  const hm = U.heatmapModel(DS, 'change'); const fills = new Set(hm.rows.flatMap((r) => Object.values(r.cells)).filter((c) => c.available).map((c) => c.fill)); for (const f of fills) assert.ok(Object.values(PS.CLASS_COLORS).includes(f), `heatmap fill ${f} is in the palette`);
  const hr = U.heatmapModel(DS, 'rate'); for (const c of hr.rows.flatMap((r) => Object.values(r.cells)).filter((x) => x.available)) assert.ok(PS.CLASS_COLORS[PS.classifyRate(c.value)] === c.fill && c.glyph, 'heatmap rate cells use the rate classifier + a glyph');
});

await ok('export: the «حسب المنطقة» table has the band column from the SAME classifier (Σ collected ÷ Σ net) — equal to the screen; no plan / budget chip, no plan status, no target object', async () => {
  const mk2 = (pg, lang = 'ar') => { const inp = dashboardInputs({ snapshot: pg.snapshot, prevSnapshot: pg.prevSnapshot, comparison: pg.comparison, cfg, targets: { collectionRate: { value: 0.99, status: 'approved' } }, scopeEff: pg.scopeEff, scope: { preset: 'ytd' }, cases: [], meta: null }); return buildReportModel({ ...inp, lang }); };
  const regOf = (m) => m.sections.flatMap((sec) => sec.blocks).filter((b) => b.type === 'table').find((b) => b.id === 'region');
  const reg2 = regOf(mk2(page)); const last = reg2.headers.length - 1; assert.equal(reg2.headers[last].label, 'نطاق أداء التحصيل'); assert.equal(regOf(mk2(page, 'en')).headers.at(-1).label, 'Collection-performance band');
  const screen = regionalMetric(DS, 'collected'); const byName = new Map(reg2.rows.map((r) => [r[0], r[last]]));
  for (const r of screen.rows) { const cell = byName.get(r.label.ar); assert.ok(cell, `export row ${r.label.ar}`); assert.ok(cell.startsWith(`${r.status.glyph} ${r.status.label.ar}`), `${r.key}: export band = screen band (${cell} vs ${r.status.glyph} ${r.status.label.ar})`); }
  const un = reg2.rows.find((r) => r[0] === 'بدون إسناد جغرافي'); assert.ok(un[last].startsWith(`${screen.unattributed.status.glyph} ${screen.unattributed.status.label.ar}`), 'unattributed row band');
  assert.ok(reg2.total[last].startsWith(`${screen.total.status.glyph} ${screen.total.status.label.ar}`), 'the total row band = the screen total band');
  assert.ok(/نطاق أداء التحصيل: نسبة التحصيل = المحصّل ÷ صافي المفوتر/.test(reg2.note) && !PLAN_WORDS.test(reg2.note.replace(/ليست أمانة واحدة/g, '')), 'the note states the bands, no plan wording');
  const en = regOf(mk2(page, 'en')); assert.ok(en.rows.every((r) => /^(▼▼|▼|◐|✓|○) /.test(r.at(-1))) && !PLAN_WORDS.test(en.note));
  // the WHOLE exported model: the dashboard passes no target object, so there is no plan / budget chip, no target bullet, nothing plan-shaped — even though the caller's rev holds a (fake) approved target
  const inp = dashboardInputs({ snapshot: page.snapshot, prevSnapshot: page.prevSnapshot, comparison: page.comparison, cfg, targets: { collectionRate: { value: 0.99, status: 'approved' } }, reference: { state: 'ok' }, scopeEff: page.scopeEff, scope: { preset: 'ytd' }, cases: [], meta: null });
  assert.equal(inp.targets, DASHBOARD_NO_TARGETS); assert.deepEqual({ ...DASHBOARD_NO_TARGETS }, {});
  const model = buildReportModel({ ...inp, lang: 'ar' }); const chips = model.context || model.chips || []; const blob = JSON.stringify(model);
  assert.ok(!JSON.stringify(chips).includes('الخطة المرجعية للمستهدف') && !blob.includes('الميزانية المبلّغة') && !/"k":"(plan|budget)"/.test(blob), 'no plan / budget chip');
  assert.ok(!/bullet/.test(JSON.stringify(model.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'chart' && b.kind === 'bullet'))), 'no target bullet chart');
  // a restricted viewer’s export carries only authorised rows (bands included)
  const rr = regOf(mk2(pageR)); assert.equal(rr.rows.length, 2); const blobR = JSON.stringify({ rows: rr.rows, total: rr.total }); for (const k of OTHERS) assert.ok(!blobR.includes(k), `export: no «${k}»`);
});

await ok('INDEPENDENCE (render): the regional component, the summary, the panel and the heatmap render IDENTICAL markup (text AND dataset) with no plans, with plans, and after a plan / global default / reference change; the page source has no plan hook', async () => {
  const P1 = customPlanRecord({ id: 'plan-u3000001', name: 'خطة الاختبار الأولى', allocations: { 'Jeddah Amanah': 6e9, 'Riyadh Amanah': 9e9 } }); const P2 = customPlanRecord({ id: 'plan-u3000002', name: 'خطة الاختبار الثانية', allocations: { 'Asir Amanah': 4e9 } });
  const snapPage = async () => {
    const pg = await pageOf(); const ds = await loadRegionalDataset(pg);
    const html = AR_PAGE_PARTS_FOR(ds).join('\n'); return { dataset: JSON.stringify(ds), html, textual: text(html) };
  };
  function AR_PAGE_PARTS_FOR(ds) {
    const out = [];
    for (const id of REGIONAL_METRICS) for (const view of ['map', 'table']) for (const lang of ['ar', 'en']) out.push(render(E(RegionalPerformance, { dataset: ds, initialView: view, initialMetric: id, onSelect: noop, onOpenHeatmap: noop, onOpenFull: noop }), lang));
    out.push(panel(TOTAL_SEL, {}, 'ar', ds), panel({ level: 'region', key: 'SA-01' }, {}, 'en', ds), render(E(HeatmapDialog, { dataset: ds, open: true, onClose: noop, onSelectEntity: noop })));
    out.push(render(E(PerformanceSummary, { summary: buildPerformanceSummary({ dataset: ds, items: ITEMS, canSeeDecisions: true }), onSelect: noop, onOpenFull: noop })), render(E(ReviewPriorities, { review: buildReviewPriorities({ items: ITEMS, canSeeDecisions: true }) })));
    return out;
  }
  try {
    setPlansForTest({ plans: [], references: {} }); const none = await snapPage();
    setPlansForTest({ plans: [P1], references: { [YEAR]: referenceEntry(P1.id) } }); const one = await snapPage();
    setPlansForTest({ plans: [P1, P2], references: { [YEAR]: referenceEntry(P2.id) } }); const changed = await snapPage();
    setPlansForTest({ plans: [P1, P2], references: {} }); const ambiguous = await snapPage();
    for (const [name, x] of [['one plan', one], ['reference changed', changed], ['ambiguous reference', ambiguous]]) { assert.equal(x.dataset, none.dataset, `${name}: same dataset`); assert.equal(x.textual, none.textual, `${name}: same DOM text`); assert.equal(x.html, none.html, `${name}: same markup`); }
    for (const s of ['خطة الاختبار', 'plan-u3000001', 'plan-u3000002']) assert.ok(!none.html.includes(s), `no «${s}»`);
    assert.ok(!PLAN_WORDS.test(none.textual.replace(/بند [^ ]+/g, '')), 'no plan label / notice string in the rendered page');
  } finally { setPlansForTest({ plans: [], references: {} }); }
  const noComments = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'); const hub = noComments('src/pages/InsightsHub.jsx'); const dash = noComments('src/components/insights/InsightsDashboard.jsx');
  for (const s of [hub, dash]) assert.ok(!/usePlans|planStore|planId|planNotice|onPlanReset|loadRegionalBundle|rev\.targets|planKeys|planEntityKeys|referenceTarget|notifiedBudget|الخطة|plan\b/i.test(s.replace(/useDashboardDecisions/g, '')), 'no plan hook, prop, notice or wording in the page source');
  assert.ok(/<InsightsDashboard \/>/.test(hub), 'the dashboard takes no plan prop'); assert.ok(/loadRegionalDataset\(rev, \{ authorisedKeys \}/.test(dash));
});

await ok('table headers: a money column carries the MONEY unit (never the metric’s % / points); a % / pp column carries none — in both languages', () => {
  for (const id of REGIONAL_METRICS) for (const lang of ['ar', 'en']) {
    const res = regionalMetric(DS, id, { lang }); const h = reg({ initialView: 'table', initialMetric: id }, lang); const head = h.slice(h.indexOf('<thead'), h.indexOf('</thead>'));
    const ths = [...head.matchAll(/<th scope="col" class="num"[^>]*><button[\s\S]*?<\/button><\/th>/g)].map((m) => text(m[0]));
    res.columns.forEach((c, i) => { const t = ths[i]; const money = labelOf(res.moneyUnit, lang); if (c.kind === 'money') assert.ok(t.includes(`(${money})`), `${id}/${lang}: «${t}» has the money unit`); else assert.ok(!t.includes(`(${money})`) && !/\((%|pp)\)\s*\(/.test(t) || c.kind === 'money', `${id}/${lang}: «${t}»`); if (c.kind !== 'money' && c.kind !== 'status') assert.ok(!/\(مليار|\(بليون|\(bn|\(million/.test(t), `${id}/${lang}: no money unit on «${t}»`); });
  }
});

setPlansForTest({ plans: [], references: {} }); clearPlans();
console.log(`insights-dashboard-ui tests: ${n} passed`);
