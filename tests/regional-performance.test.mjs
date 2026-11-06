// «الأداء حسب المنطقة» — the data / semantic layer of /insights (docs/insights-redesign-spec.md «Implementation notes — S (decoupling)»; src/data/regional/*). INVOICE-BASED ONLY: no collection plan, target or budget is read.
// The four metrics (value ↔ text ↔ colour ↔ legend), the collection-performance bands (39.9 / 40 / 59.9 / 60 / 79.9 / 80 boundaries), the rate from SUMMED amounts (never an average of entity percentages), the comparison metrics
// (adverse / favourable / unavailable), the unavailable states, reconciliation on the REAL data service (Ministry scope AND narrower scopes), authorisation, the performance summary (≤ 3, invoice-based gap, plan items excluded),
// the review priorities (≤ 3, no aggregate beside its own entity cases, plan-category items excluded, permissions) and the independence guard. Run with `npm run test:regional`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { DEFAULT_CONFIG } from '../src/data/revenueMetrics.js';
import { loadComparison } from '../src/data/comparison.js';
import { KSA_PROVINCES } from '../src/data/ksaProvinces.js';
import { METRICS, REGIONAL_METRICS, REASONS, REASON_CODES, buildLegend, colorOf, formatValue, metricOptionText, comparisonBasisText, BANDS_TITLE } from '../src/data/regional/regionalLegend.js';
import * as BANDS from '../src/data/regional/collectionBands.js';
import { PCT_COLORS, PCT_CUTS, pctColor } from '../src/components/strategic/PctScale.jsx';
import { buildRegionalDataset, loadRegionalDataset, regionalMetric, regionDetail, authorisedEntityKeys, REGION_OF, UNATTRIBUTED_LABEL, columnsFor } from '../src/data/regional/regionalPerformance.js';
import * as REG from '../src/data/regional/regionalPerformance.js';
import { buildPerformanceSummary, SUMMARY_MAX } from '../src/data/regional/performanceSummary.js';
import { buildReviewPriorities, subsumedKeys, isPlanItem, MAX_REVIEW_CASES } from '../src/data/regional/reviewPriorities.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const T = '2026-11-06'; const YEAR = 2026;
const st = loadStore(T); const cfg = { ...DEFAULT_CONFIG, cutoff: T };
const FULL = { from: `${YEAR}-01-01`, to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', product: [], mainClass: 'all' };
const data = { snapshot: async (sc, extra = {}) => snapshot(st, { scope: sc, cfg, ...extra }), series: async (sc, extra = {}) => series(st, { scope: sc, cfg: { ...cfg, cutoff: extra.asOf || T }, ...extra }) };
const strings = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (Array.isArray(o)) o.forEach((x) => strings(x, out)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => strings(x, out)); return out; };
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const code = (f) => read(f).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

/** what RevenueContext holds for a page scope: the page snapshot, the like-for-like previous snapshot and the comparison — computed here by the SAME functions */
async function pageOf(over = {}, orgKeys = null) {
  const scope = { ...FULL, ...over, org: orgKeys ? { amanahKeys: orgKeys } : null };
  const snap = snapshot(st, { scope, cfg });
  const c = await loadComparison(data, scope, cfg, snap);
  return { scopeEff: scope, cfg, data, snapshot: snap, prevSnapshot: c.prev, comparison: c.comparison, org: { amanahKeys: orgKeys } };
}
const regionSums = (ds, f) => ds.regions.reduce((t, r) => t + f(r.cur), 0) + (ds.unattributed ? f(ds.unattributed.cur) : 0);

/* ------------------------------------------------------------------------------------------------ synthetic snapshots (exact numbers) */
const cell = (amanah, source, o) => ({ amanah, source, count: o.count ?? 5, gross: o.net + (o.exclusions || 0), exclusions: o.exclusions || 0, net: o.net, collected: o.collected, outstanding: o.net - o.collected, overdue: 0, notDue: 0, maxDaysOverdue: 0 });
const snapOfCells = (cells, scope = {}) => ({ scope: { from: '2026-01-01', to: T, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', ...scope }, cutoff: T, totals: { count: cells.reduce((t, c) => t + c.count, 0), gross: cells.reduce((t, c) => t + c.gross, 0), net: cells.reduce((t, c) => t + c.net, 0), collected: cells.reduce((t, c) => t + c.collected, 0), outstanding: cells.reduce((t, c) => t + c.outstanding, 0) }, matrix: { amanahSource: cells, amanahSourceMonth: [] }, byMunicipality: [] });
const CMP = { comparable: true, basis: 'same_period_last_year' };
// A (Riyadh): big amount, LOW rate · B (Asir): small amount, HIGH rate · C (Jazan): mid amount, 60 % · Housing Sector (unattributed): 50 %
const CUR = [cell('Riyadh Amanah', 'fines', { net: 10e9, collected: 2e9 }), cell('Asir Amanah', 'fines', { net: 1.1e9, collected: 1e9 }), cell('Jazan Amanah', 'fines', { net: 2e9, collected: 1.2e9 }), cell('Housing Sector', 'fines', { net: 1e9, collected: 5e8 })];
const PRV = [cell('Riyadh Amanah', 'fines', { net: 9e9, collected: 2.5e9 }), cell('Asir Amanah', 'fines', { net: 1e9, collected: 4e8 }), cell('Jazan Amanah', 'fines', { net: 2e9, collected: 1e9 }), cell('Housing Sector', 'fines', { net: 1e9, collected: 5e8 })];
const SYN = buildRegionalDataset({ snapshot: snapOfCells(CUR), prevSnapshot: snapOfCells(PRV), comparison: CMP });
const rowOf = (res, key) => res.rows.find((r) => r.key === key);
const BLUE = /#(175CD3|8DB4EE|2563EB|3B82F6|1D4ED8|60A5FA)\b/i;
const hue = (hex) => { const v = parseInt(hex.slice(1), 16); const r = ((v >> 16) & 255) / 255; const g = ((v >> 8) & 255) / 255; const b = (v & 255) / 255; const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn; if (d === 0) return { h: 0, s: 0 }; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: ((h * 60) + 360) % 360, s: d / (mx || 1) }; };
const isBlue = (hex) => { const { h, s } = hue(hex); return s > 0.3 && h >= 185 && h <= 265; };
const PLAN_WORDS = /الخطة|خطة|المخطط|مستهدف|plan\b|planned|target|budget|ميزانية/i; // (the Arabic «مخاطر» is not a plan word)

/* ================================================================================================ 1. the metrics + the bands */
await ok('registry: EXACTLY four metrics, in the agreed order, with bilingual labels, basis and captions; the coded reasons; NO plan / target metric or wording anywhere', () => {
  assert.deepEqual(REGIONAL_METRICS, ['collected', 'collectionRate', 'changeCollected', 'changeRate']);
  assert.deepEqual(Object.keys(METRICS), ['collected', 'collectionRate', 'changeCollected', 'changeRate']);
  for (const id of REGIONAL_METRICS) { const m = METRICS[id]; assert.ok(m.label.ar && m.label.en && m.basis.ar && m.basis.en && m.scaleNote.ar && m.caption.ar && m.caption.en, id); assert.ok(['rate', 'changeCollected', 'changeRate'].includes(m.rule), id); }
  for (const gone of ['targetAchievement', 'planDeviation']) { assert.ok(!(gone in METRICS), gone); assert.ok(!REGIONAL_METRICS.includes(gone)); }
  assert.deepEqual(REASON_CODES.slice().sort(), ['new', 'no_comparison', 'no_data', 'no_invoices', 'zero_denominator']);
  for (const r of Object.values(REASONS)) assert.ok(r.short.ar && r.short.en && r.message.ar && r.message.en);
  const all = strings([METRICS, REASONS, BANDS.RULE_TABLE, BANDS_TITLE]).join(' ');
  assert.ok(!PLAN_WORDS.test(all), `no plan wording: ${(PLAN_WORDS.exec(all) || [])[0]}`); assert.ok(!/المقبوضات|مقبوض|Najiz/.test(all), 'retired terms');
  assert.ok(!/متأخر عن الخطة|behind plan/i.test(all));
  // the selector texts: the unit of a change is in the option so % and percentage points are never confused
  assert.deepEqual(REGIONAL_METRICS.map((id) => metricOptionText(id, 'ar')), ['المحصّل', 'نسبة التحصيل', 'التغير في المحصّل عن الفترة المقارنة (%)', 'التغير في نسبة التحصيل (نقطة مئوية)']);
  assert.deepEqual(REGIONAL_METRICS.map((id) => metricOptionText(id, 'en')), ['Collected', 'Collection rate', 'Change in collected vs the comparison period (%)', 'Change in collection rate (pp)']);
  assert.deepEqual(BANDS_TITLE, { ar: 'نطاقات أداء التحصيل', en: 'Collection-performance bands' });
});

await ok('the BANDS are ONE named constant = the documented PctScale: red < 40 · orange 40 to < 60 · yellow 60 to < 80 · green ≥ 80; boundaries 39.9 / 40 / 59.9 / 60 / 79.9 / 80; unavailable is never a band', () => {
  assert.deepEqual([...BANDS.COLLECTION_RATE_BANDS.cuts], [40, 60, 80]); assert.deepEqual(PCT_CUTS, [0.4, 0.6, 0.8], 'PctScale derives from the same constant');
  assert.deepEqual(PCT_COLORS, ['#e53935', '#f4903b', '#fde85c', '#4caf2f'], 'the existing four colours, unchanged');
  assert.deepEqual(PCT_COLORS, [BANDS.CLASS_COLORS.critical, BANDS.CLASS_COLORS.attention, BANDS.CLASS_COLORS.slight, BANDS.CLASS_COLORS.ok]);
  const cls = (pct) => BANDS.classifyRate(pct / 100);
  assert.equal(cls(0), 'critical'); assert.equal(cls(39.9), 'critical'); assert.equal(cls(40), 'attention'); assert.equal(cls(59.9), 'attention'); assert.equal(cls(60), 'slight'); assert.equal(cls(79.9), 'slight'); assert.equal(cls(80), 'ok'); assert.equal(cls(100), 'ok'); assert.equal(cls(120), 'ok');
  assert.equal(BANDS.classifyRate(null), null); assert.equal(BANDS.classifyRate(NaN), null); assert.equal(BANDS.classifyRate(undefined), null);
  for (const v of [0, 0.39, 0.4, 0.59, 0.6, 0.79, 0.8, 1.2]) assert.equal(BANDS.CLASS_COLORS[BANDS.classifyRate(v)], pctColor('share', v), `rate ${v}: the same colour as every other percentage of the app`);
  // the same boundaries THROUGH the dataset (a region of net 1 000 and collected 399 / 400 / 599 / 600 / 799 / 800 — summed amounts) and a real legend
  const probe = (col) => { const ds = buildRegionalDataset({ snapshot: snapOfCells([cell('Riyadh Amanah', 'fines', { net: 1000, collected: col })]), prevSnapshot: null, comparison: { comparable: false } }); const r = rowOf(regionalMetric(ds, 'collectionRate'), 'SA-01'); return [r.status.cls, r.color.cls, r.color.fill]; };
  assert.deepEqual(probe(399).slice(0, 2), ['critical', 'critical']); assert.deepEqual(probe(400).slice(0, 2), ['attention', 'attention']); assert.deepEqual(probe(599)[0], 'attention'); assert.deepEqual(probe(600)[0], 'slight'); assert.deepEqual(probe(799)[0], 'slight'); assert.deepEqual(probe(800)[0], 'ok');
  assert.equal(probe(399)[2], '#e53935'); assert.equal(probe(400)[2], '#f4903b'); assert.equal(probe(600)[2], '#fde85c'); assert.equal(probe(800)[2], '#4caf2f');
  const L = buildLegend('collectionRate'); assert.deepEqual(L.buckets.map((b) => b.cls), ['critical', 'attention', 'slight', 'ok']); assert.deepEqual(L.buckets.map((b) => b.label.ar), ['أقل من 40%', '40% إلى أقل من 60%', '60% إلى أقل من 80%', '80% فأكثر']); assert.deepEqual(L.buckets.map((b) => b.label.en), ['Below 40%', '40% to under 60%', '60% to under 80%', '80% and above']);
  assert.deepEqual(L.buckets.map((b) => b.glyph), ['▼▼', '▼', '◐', '✓']); assert.equal(L.na.glyph, '○'); assert.ok(L.buckets.every((b) => b.name.ar && b.name.en));
  assert.equal(colorOf(L, null).bucket, null); assert.equal(colorOf(L, null).fill, null); assert.equal(colorOf(L, 0.8).fill, '#4caf2f'); assert.equal(colorOf(L, 0.399).cls, 'critical');
  assert.equal(L.bandsTitle.ar, 'نطاقات أداء التحصيل'); assert.equal(L.bandsTitle.en, 'Collection-performance bands');
});

await ok('exact caption: «القيمة: المحصّل · اللون: نسبة التحصيل من صافي المفوتر» / "Value: collected · Color: collection rate against net invoiced" — and the rate caption', () => {
  const c = buildLegend('collected').caption; assert.equal(c.ar, 'القيمة: المحصّل · اللون: نسبة التحصيل من صافي المفوتر'); assert.equal(c.en, 'Value: collected · Color: collection rate against net invoiced');
  const r = buildLegend('collectionRate').caption; assert.equal(r.ar, 'القيمة: نسبة التحصيل · اللون: نسبة التحصيل من صافي المفوتر'); assert.equal(r.en, 'Value: collection rate · Color: collection rate against net invoiced');
  for (const id of REGIONAL_METRICS) { const cap = buildLegend(id).caption; assert.ok(/^القيمة: /.test(cap.ar) && /اللون: /.test(cap.ar) && /^Value: /.test(cap.en) && /Color: /.test(cap.en), id); }
  // the basis text states net invoiced = gross − exclusions, summed amounts, the same population in numerator and denominator
  assert.ok(/صافي المفوتر = إجمالي المفوتر − الاستبعادات/.test(METRICS.collected.basis.ar) && /مجمّعة من المبالغ/.test(METRICS.collected.basis.ar) && /net invoiced = gross invoiced − exclusions/.test(METRICS.collected.basis.en) && /SUMMED amounts/.test(METRICS.collected.basis.en));
  assert.ok(/أحمر أقل من 40%/.test(METRICS.collectionRate.basis.ar) && /red below 40 %/.test(METRICS.collectionRate.basis.en));
});

await ok('«المحصّل»: the VALUE is the collected amount, the COLOUR is the collection RATE — the biggest amount at a low rate is RED, the smallest amount at a high rate is GREEN (never green by size)', () => {
  const res = regionalMetric(SYN, 'collected');
  const a = rowOf(res, 'SA-01'); const b = rowOf(res, 'SA-14'); const c = rowOf(res, 'SA-09');
  assert.equal(a.value, 2e9); assert.equal(b.value, 1e9); assert.equal(c.value, 1.2e9, 'the displayed value stays the collected amount');
  assert.deepEqual(res.rows.map((r) => r.key).slice(0, 3), ['SA-01', 'SA-09', 'SA-14'], 'listed by amount (display order only)');
  assert.equal(a.status.cls, 'critical', 'Riyadh: 2.0bn but a 20 % rate ⇒ red'); assert.equal(a.color.fill, '#e53935');
  assert.equal(b.status.cls, 'ok', 'Asir: 1.0bn at a 90.9 % rate ⇒ green'); assert.equal(c.status.cls, 'slight', 'Jazan: exactly 60.0 % ⇒ yellow');
  assert.ok(a.facts.rate < b.facts.rate, 'the RATE order is the opposite of the amount order'); assert.ok(near(a.facts.rate, 0.2, 1e-12));
  assert.equal(res.legend.rule, 'rate'); assert.equal(res.legend.caption.ar, 'القيمة: المحصّل · اللون: نسبة التحصيل من صافي المفوتر');
  assert.deepEqual(res.columns.map((x) => x.id), ['collected', 'collectionRate', 'net', 'status']); assert.equal(res.columns.at(-1).label.ar, 'نطاق أداء التحصيل');
  assert.ok(/مليار|bn/.test(a.text.unit + formatValue('collected', 2e9, { lang: 'en' }).unit));
  // the supporting rate column is the rate the colour is judged by; the status cell is the SAME status
  assert.equal(a.cells.collectionRate.value, a.facts.rate); assert.equal(a.cells.status.status.cls, a.status.cls);
  // «نسبة التحصيل»: the value IS the rate, coloured by the same bands, so the two metrics agree on every row
  const rate = regionalMetric(SYN, 'collectionRate'); for (const r of res.rows) assert.equal(rowOf(rate, r.key).status.cls, r.status.cls, `${r.key}: collected and rate share the band`); assert.equal(rowOf(rate, 'SA-14').value, 1e9 / 1.1e9);
});

await ok('the regional rate is Σ collected ÷ Σ net — NEVER an average of entity percentages (crafted region of two Amanahs with very different net sizes)', () => {
  const iso = KSA_PROVINCES.find((p) => p.iso === 'SA-02'); const [a, b] = iso.amanahKeys; // Jeddah + Makkah: 90 % on a small net, 10 % on a big one
  const ds = buildRegionalDataset({ snapshot: snapOfCells([cell(a, 'fines', { net: 1000, collected: 900 }), cell(b, 'fines', { net: 9000, collected: 900 })]), prevSnapshot: null, comparison: { comparable: false } });
  const reg = rowOf(regionalMetric(ds, 'collectionRate'), 'SA-02'); assert.ok(near(reg.value, 1800 / 10000, 1e-12), `18 %, not the 50 % average (${reg.value})`); assert.equal(reg.status.cls, 'critical');
  const ents = regionalMetric(ds, 'collectionRate', { level: 'entity' }).rows; assert.deepEqual(ents.map((r) => r.status.cls).sort(), ['critical', 'ok'], 'the entities are 90 % (green) and 10 % (red) — the average 50 % would be orange');
  assert.notEqual(reg.status.cls, BANDS.classifyRate((0.9 + 0.1) / 2), 'not the class of the average of percentages');
  // the same on the collected metric's colour and on the total row
  assert.equal(rowOf(regionalMetric(ds, 'collected'), 'SA-02').status.cls, 'critical'); assert.ok(near(regionalMetric(ds, 'collectionRate').total.value, 0.18, 1e-12));
  // two regions: totals are sums, whatever the entity sizes
  const two = buildRegionalDataset({ snapshot: snapOfCells([cell(a, 'fines', { net: 1000, collected: 900 }), cell(b, 'fines', { net: 9000, collected: 900 }), cell('Riyadh Amanah', 'fines', { net: 4000, collected: 3600 })]), prevSnapshot: null, comparison: { comparable: false } });
  assert.ok(near(regionalMetric(two, 'collectionRate').total.value, 5400 / 14000, 1e-12));
});

await ok('unavailable ≠ 0: no invoices / net ≤ 0 ⇒ gray-hatched «غير متاح» (no band, no fill, never 0 %); the value of «المحصّل» can exist while the band does not; no invented colour variation', () => {
  const ds = buildRegionalDataset({ snapshot: snapOfCells([cell('Riyadh Amanah', 'fines', { net: 0, collected: 120, count: 3 }), cell('Asir Amanah', 'fines', { net: -50, collected: 10 }), cell('Jazan Amanah', 'fines', { net: 1000, collected: 500 })]), prevSnapshot: null, comparison: { comparable: false } });
  for (const id of ['collected', 'collectionRate']) { const res = regionalMetric(ds, id); for (const k of ['SA-01', 'SA-14']) { const r = rowOf(res, k); assert.equal(r.status.cls, 'na', `${id} ${k}`); assert.equal(r.status.available, false); assert.equal(r.status.reason, 'zero_denominator'); assert.equal(r.color.bucket, null); assert.equal(r.color.fill, null); assert.equal(r.cells.status.available, false); assert.ok(/غير متاح/.test(r.cells.status.text.text)); } }
  const cr = regionalMetric(ds, 'collectionRate'); assert.equal(rowOf(cr, 'SA-01').available, false); assert.equal(rowOf(cr, 'SA-01').value, null, 'never 0 %'); assert.equal(rowOf(cr, 'SA-01').text.text, '—');
  const co = regionalMetric(ds, 'collected'); assert.equal(rowOf(co, 'SA-01').value, 120, 'the collected amount is still shown'); assert.equal(rowOf(co, 'SA-01').status.reason, 'zero_denominator'); assert.equal(rowOf(co, 'SA-09').status.cls, 'attention');
  // a legend NEVER depends on the other regions: shuffling / removing a region leaves the same class for the same value
  const solo = buildRegionalDataset({ snapshot: snapOfCells([cell('Jazan Amanah', 'fines', { net: 1000, collected: 500 })]), prevSnapshot: null, comparison: { comparable: false } });
  assert.equal(rowOf(regionalMetric(solo, 'collectionRate'), 'SA-09').status.cls, 'attention'); assert.deepEqual(regionalMetric(solo, 'collectionRate').legend.buckets.map((b) => b.cls), regionalMetric(ds, 'collectionRate').legend.buckets.map((b) => b.cls));
  const allLow = buildRegionalDataset({ snapshot: snapOfCells([cell('Riyadh Amanah', 'fines', { net: 100, collected: 10 }), cell('Jazan Amanah', 'fines', { net: 100, collected: 20 })]), prevSnapshot: null, comparison: { comparable: false } });
  assert.ok(regionalMetric(allLow, 'collectionRate').rows.every((r) => r.status.cls === 'critical'), 'all-low ⇒ all red (no forced variation)');
  const allHigh = buildRegionalDataset({ snapshot: snapOfCells([cell('Riyadh Amanah', 'fines', { net: 100, collected: 99 }), cell('Jazan Amanah', 'fines', { net: 100, collected: 85 })]), prevSnapshot: null, comparison: { comparable: false } });
  assert.ok(regionalMetric(allHigh, 'collectionRate').rows.every((r) => r.status.cls === 'ok'), 'all-high ⇒ all green');
  // the legend is fixed whatever the values
  assert.deepEqual(buildLegend('collectionRate', [0.1, 0.2]).thresholds, buildLegend('collectionRate', [0.9]).thresholds);
});

await ok('value ↔ text ↔ colour ↔ legend are consistent for EVERY metric (the colour class is the legend bucket of the STATUS; the legend classes are fixed by the band table)', async () => {
  const page = await pageOf(); const ds = buildRegionalDataset({ snapshot: page.snapshot, prevSnapshot: page.prevSnapshot, comparison: page.comparison });
  for (const id of REGIONAL_METRICS) {
    for (const lang of ['ar', 'en']) for (const level of ['region', 'entity']) {
      const res = regionalMetric(ds, id, { lang, level }); const L = res.legend;
      assert.equal(L.metric, id); assert.equal(L.buckets.length, 4, 'four bands for every metric');
      for (const r of [...res.rows, ...(res.unattributed ? [res.unattributed] : [])]) {
        if (!r.available) { assert.equal(r.value, null); assert.equal(r.text.text, '—'); assert.ok(REASON_CODES.includes(r.reason), `${id} ${r.key}: ${r.reason}`); }
        else { assert.ok(Number.isFinite(r.value)); assert.ok(r.text.text.length > 1 && !/NaN|undefined|Infinity/.test(r.text.text)); assert.equal(r.cells[res.columns[0].id].text.text, r.text.text, `${id} ${r.key}: table cell = map text`); }
        if (r.status.available) {
          assert.equal(r.color.bucket, colorOf(L, r.status.driver).bucket); const b = L.buckets[r.color.bucket]; assert.ok(b, `${id}: a legend bucket exists for ${r.key}`);
          assert.equal(b.cls, r.status.cls); assert.equal(r.color.fill, r.status.color); assert.equal(b.color, r.status.color); assert.equal(r.cells.status.status.cls, r.status.cls, 'the table band cell is the same status');
        } else { assert.equal(r.color.bucket, null); assert.equal(r.color.fill, null); assert.equal(r.status.cls, 'na'); assert.equal(r.cells.status.available, false); }
      }
    }
  }
  // «المحصّل» / «نسبة التحصيل» classify from the row's own rate (Σ collected ÷ Σ net of the SAME row)
  for (const r of regionalMetric(ds, 'collected').rows) { const f = r.facts; assert.equal(r.status.cls, f.rate == null ? 'na' : BANDS.classifyRate(f.collected / f.net)); }
});

await ok('comparison metrics: the bases are NAMED (same period last year / previous period); a decrease is red / orange / yellow by explicit magnitude, an increase or no change is green, no comparable period is gray «غير متاح» (never 0); pp is never %', () => {
  const ch = regionalMetric(SYN, 'changeCollected'); const L = ch.legend;
  assert.equal(L.rule, 'changeCollected'); assert.deepEqual(L.buckets.map((b) => b.cls), ['critical', 'attention', 'slight', 'ok']);
  assert.deepEqual(L.buckets.map((b) => b.name.ar), ['انخفاض كبير', 'انخفاض', 'انخفاض طفيف', 'ارتفاع أو دون تغيير']); assert.deepEqual(L.buckets.map((b) => b.name.en), ['Large decrease', 'Decrease', 'Slight decrease', 'Increase or no change']);
  assert.deepEqual(L.buckets.map((b) => b.glyph), ['▼▼', '▼', '▽', '▲']);
  assert.ok(/الفترة نفسها من العام الماضي/.test(L.caption.ar) && /the same period last year/.test(L.caption.en), 'the comparison basis is in the caption'); assert.equal(ch.comparison.kind, 'same_period_last_year');
  assert.ok(/previous like-for-like period/.test(regionalMetric(buildRegionalDataset({ snapshot: snapOfCells(CUR), prevSnapshot: snapOfCells(PRV), comparison: { comparable: true, basis: 'previous_period' } }), 'changeRate').legend.caption.en));
  assert.deepEqual(comparisonBasisText({ comparable: true, basis: 'previous_month' }).kind, 'previous_period'); assert.equal(comparisonBasisText({ comparable: false }).kind, null);
  const asir = rowOf(ch, 'SA-14'); assert.equal(asir.text.sign, '+'); assert.equal(asir.direction, 'up'); assert.ok(/^\+150\.0%$/.test(asir.text.text), asir.text.text); assert.equal(asir.status.cls, 'ok', 'an increase is favourable (green), not blue');
  const riy = rowOf(ch, 'SA-01'); assert.equal(riy.text.sign, '−'); assert.equal(riy.direction, 'down'); assert.equal(riy.status.cls, 'attention', 'Riyadh: 2.5e9 → 2.0e9 = −20 % ⇒ a decrease of 10–25 % (orange)'); assert.equal(rowOf(ch, 'SA-09').status.cls, 'ok'); assert.equal(rowOf(ch, 'SA-01').status.label.ar, 'انخفاض');
  const pp = regionalMetric(SYN, 'changeRate', { lang: 'en' }); const pa = rowOf(pp, 'SA-14');
  assert.ok(/pp$/.test(pa.text.text) && !/%/.test(pa.text.text), pa.text.text); assert.ok(near(pa.value, (1e9 / 1.1e9 - 4e8 / 1e9) * 100, 1e-9), 'percentage POINTS');
  const ppAr = regionalMetric(SYN, 'changeRate', { lang: 'ar' }); assert.ok(/نقطة مئوية/.test(rowOf(ppAr, 'SA-14').text.text) && !/%/.test(rowOf(ppAr, 'SA-14').text.text)); assert.ok(/%/.test(riy.text.text) && !/pp|نقطة/.test(riy.text.text));
  assert.equal(pp.legend.unit.kind, 'pp'); assert.equal(ch.legend.unit.kind, 'pct'); assert.equal(rowOf(pp, 'SA-01').status.cls, 'attention', 'Riyadh −7.8 pp ⇒ orange');
  assert.equal(formatValue('changeCollected', 0.00001).sign, '', 'a zero change carries no sign'); assert.equal(formatValue('changeCollected', 0.00001).direction, 'flat');
  // the thresholds, boundary by boundary (a boundary belongs to the WORSE class); documented as ONE constant
  assert.deepEqual({ ...BANDS.CHANGE_BANDS.changeCollected }, { unit: 'pct', critical: 25, attention: 10 }); assert.deepEqual({ ...BANDS.CHANGE_BANDS.changeRate }, { unit: 'pp', critical: 15, attention: 5 });
  const c = (v) => BANDS.classifyChange('changeCollected', v / 100); const p = (v) => BANDS.classifyChange('changeRate', v);
  assert.deepEqual([-60, -25, -24.9, -10, -9.9, -0.1, 0, 0.1, 30].map(c), ['critical', 'critical', 'attention', 'attention', 'slight', 'slight', 'ok', 'ok', 'ok']);
  assert.deepEqual([-40, -15, -14.9, -5, -4.9, -0.1, 0, 0.1, 12].map(p), ['critical', 'critical', 'attention', 'attention', 'slight', 'slight', 'ok', 'ok', 'ok']);
  assert.equal(BANDS.classifyChange('changeRate', null), null); assert.equal(BANDS.classifyChange('collectionRate', 1), null);
  // no comparable period ⇒ gray «غير متاح» + the reason, never a band, never 0
  const nc = buildRegionalDataset({ snapshot: snapOfCells(CUR), prevSnapshot: null, comparison: { comparable: false } });
  for (const id of ['changeCollected', 'changeRate']) { const res = regionalMetric(nc, id); assert.ok(/غير متاحة|not available/i.test(res.legend.caption.ar + res.legend.caption.en)); for (const r of res.rows) { assert.equal(r.status.cls, 'na'); assert.equal(r.status.label.ar, 'غير متاح'); assert.equal(r.status.label.en, 'Not available'); assert.equal(r.color.fill, null); assert.equal(r.value, null); assert.equal(r.reason, 'no_comparison'); } assert.equal(res.legend.notAvailable.ar.startsWith('غير متاح'), true); }
  // the band columns of the change metrics describe the CHANGE
  assert.equal(columnsFor('changeCollected').at(-1).label.ar, 'حجم التغير'); assert.equal(columnsFor('collectionRate').at(-1).label.ar, 'نطاق أداء التحصيل');
});

await ok('no blue anywhere: the palette, the legends of the four metrics, the rendered CSS; the palette is the shared red / orange / yellow / green (+ hatch)', () => {
  for (const c of [...Object.values(BANDS.CLASS_COLORS), BANDS.NA_COLORS.base, BANDS.NA_COLORS.stroke]) assert.ok(!isBlue(c), `${c} is not blue`);
  for (const id of REGIONAL_METRICS) for (const b of buildLegend(id).buckets) assert.ok(!isBlue(b.color), `${id}: legend colour ${b.color}`);
  assert.deepEqual(Object.keys(BANDS.CLASS_COLORS), ['critical', 'attention', 'slight', 'ok']);
  const css = read('src/styles/insights.css'); assert.ok(!BLUE.test(css), 'no blue in the dashboard CSS'); assert.ok(!BLUE.test(read('src/components/insights/insightsUi.js')));
  assert.ok(!/DIVERGING_RAMP|SEQUENTIAL_RAMP|ACHIEVEMENT_RAMP/.test(read('src/components/insights/insightsUi.js')));
});


await ok('unavailable states carry a coded reason, never 0: zero denominator · no invoices · no comparison · new · negative prior', () => {
  const zeroNet = buildRegionalDataset({ snapshot: snapOfCells([cell('Riyadh Amanah', 'fines', { net: 0, collected: 0, count: 3 }), cell('Asir Amanah', 'fines', { net: 5e8, collected: 1e8 })]), prevSnapshot: null, comparison: { comparable: false } });
  let r = rowOf(regionalMetric(zeroNet, 'collectionRate'), 'SA-01'); assert.equal(r.available, false); assert.equal(r.reason, 'zero_denominator'); assert.equal(r.value, null); assert.equal(r.color.bucket, null);
  r = rowOf(regionalMetric(zeroNet, 'collected'), 'SA-01'); assert.equal(r.available, true); assert.equal(r.value, 0, 'invoices exist, nothing collected: a REAL zero');
  for (const id of ['changeCollected', 'changeRate']) { r = rowOf(regionalMetric(zeroNet, id), 'SA-14'); assert.equal(r.available, false); assert.equal(r.reason, 'no_comparison'); }
  // new: nothing collected last period, something now; and a region with no previous invoices for the rate
  const prev = [cell('Riyadh Amanah', 'fines', { net: 1e9, collected: 0 }), cell('Asir Amanah', 'fines', { net: 0, collected: 0, count: 2 })];
  const cur = [cell('Riyadh Amanah', 'fines', { net: 1e9, collected: 3e8 }), cell('Asir Amanah', 'fines', { net: 1e9, collected: 3e8 }), cell('Jazan Amanah', 'fines', { net: 1e9, collected: 1e8 })];
  const nw = buildRegionalDataset({ snapshot: snapOfCells(cur), prevSnapshot: snapOfCells(prev), comparison: CMP });
  r = rowOf(regionalMetric(nw, 'changeCollected'), 'SA-01'); assert.equal(r.reason, 'new'); assert.equal(r.value, null); assert.equal(r.reasonLabel.ar, 'جديد');
  r = rowOf(regionalMetric(nw, 'changeCollected'), 'SA-14'); assert.equal(r.reason, 'new', 'previous collected is zero with invoices');
  r = rowOf(regionalMetric(nw, 'changeRate'), 'SA-14'); assert.equal(r.reason, 'zero_denominator', 'previous net is zero');
  r = rowOf(regionalMetric(nw, 'changeRate'), 'SA-09'); assert.equal(r.reason, 'new', 'no invoices in the comparison period');
  r = rowOf(regionalMetric(nw, 'changeRate'), 'SA-01'); assert.equal(r.available, true); assert.ok(near(r.value, 30, 1e-9));
  // a region that existed before but has no invoices now: change −100 %, rate unavailable (no invoices), collected unavailable (no invoices)
  const gone = buildRegionalDataset({ snapshot: snapOfCells([cell('Asir Amanah', 'fines', { net: 1e9, collected: 5e8 })]), prevSnapshot: snapOfCells([cell('Asir Amanah', 'fines', { net: 1e9, collected: 5e8 }), cell('Jazan Amanah', 'fines', { net: 1e9, collected: 5e8 })]), comparison: CMP });
  const jz = (id) => rowOf(regionalMetric(gone, id), 'SA-09');
  assert.equal(jz('collected').reason, 'no_invoices'); assert.equal(jz('changeCollected').value, -1); assert.equal(jz('changeRate').reason, 'no_invoices');
  const nonComp = buildRegionalDataset({ snapshot: snapOfCells(CUR), prevSnapshot: snapOfCells(PRV), comparison: { comparable: false, notComparableReason: 'previous_period_outside_data_coverage' } });
  assert.equal(nonComp.comparison.comparable, false); assert.equal(nonComp.comparison.reason, 'previous_period_outside_data_coverage');
  assert.ok(regionalMetric(nonComp, 'changeCollected').rows.every((x) => !x.available && x.reason === 'no_comparison'));
  assert.ok(nonComp.regions.every((x) => x.prev === null), 'no previous figures leak when the periods are not comparable');
});

/* ================================================================================================ 2. the scope-true dataset on the real data service */
const scopes = [];
await ok('reconciliation on the real data service — the Ministry scope: Σ regions + unattributed = the total = the KPI figures (collected, net, uncollected, invoice count); Housing Sector is «بدون إسناد جغرافي»', async () => {
  const page = await pageOf(); const ds = await loadRegionalDataset(page);
  assert.ok(ds.reconciliation.ok, JSON.stringify(ds.reconciliation.checks)); assert.equal(ds.reconciliation.authorisationFiltered, false);
  const T0 = page.snapshot.totals;
  assert.ok(near(regionSums(ds, (c) => c.collected), T0.collected) && near(regionSums(ds, (c) => c.net), T0.net) && near(regionSums(ds, (c) => c.uncollected), T0.outstanding) && regionSums(ds, (c) => c.count) === T0.count);
  assert.ok(ds.unattributed && ds.unattributed.entityKeys.includes('Housing Sector') && ds.unattributed.label.ar === UNATTRIBUTED_LABEL.ar && ds.unattributed.level === 'unattributed');
  assert.ok(ds.regions.every((r) => r.entityKeys.every((k) => REGION_OF[k] === r.key)), 'a region holds only entities of its verified region');
  assert.ok(!ds.regions.some((r) => r.entityKeys.includes('Housing Sector')), 'the Housing Sector is never put in an invented region');
  assert.ok(near(ds.total.cur.gross - ds.total.cur.exclusions, ds.total.cur.net, 1), 'gross − exclusions = net (approved identity)');
  assert.ok(near(ds.total.cur.net - ds.total.cur.collected, T0.outstanding, 1), 'net − collected = uncollected');
  assert.ok(ds.entities.length >= 10 && ds.regions.length >= 8);
  // the collected metric: the rows + the unattributed row add up to the total in the SAME unit
  const res = regionalMetric(ds, 'collected'); assert.ok(near([...res.rows, res.unattributed].reduce((t, r) => t + r.value, 0), res.total.value));
  assert.equal(ds.comparison.comparable, true); assert.equal(ds.comparison.basis, 'same_period_last_year'); assert.ok(ds.comparison.previous.from.startsWith('2025'));
  scopes.push(['ministry', page, ds]);
});

await ok('reconciliation on NARROWER scopes — one Amanah · a source filter · a municipality: the dataset follows the PAGE scope (never the national snapshot) and reconciles with that scope’s KPIs', async () => {
  // one Amanah
  const one = await pageOf({ amanah: 'Jeddah Amanah' }); const dsOne = await loadRegionalDataset(one);
  assert.deepEqual(dsOne.entities.map((e) => e.key), ['Jeddah Amanah']); assert.equal(dsOne.regions.length, 1); assert.equal(dsOne.regions[0].key, 'SA-02'); assert.equal(dsOne.unattributed, null);
  assert.ok(dsOne.reconciliation.ok); assert.ok(near(dsOne.total.cur.collected, one.snapshot.totals.collected)); assert.ok(dsOne.total.cur.collected < scopes[0][1].snapshot.totals.collected, 'not the national figure');
  // a revenue-source filter
  const src = await pageOf({ source: 'fines' }); const dsSrc = await loadRegionalDataset(src);
  assert.ok(dsSrc.reconciliation.ok); assert.ok(near(dsSrc.total.cur.net, src.snapshot.totals.net)); assert.ok(dsSrc.total.cur.net < scopes[0][2].total.cur.net);
  assert.ok(dsSrc.entities.every((e) => e.sources.every((s) => s.key === 'fines')), 'only the filtered source is inside every row');
  assert.ok(near(regionSums(dsSrc, (c) => c.collected), src.snapshot.totals.collected));
  // a municipality (a reference municipality that has invoices)
  const jed = one.snapshot.byMunicipality.find((g) => g.municipality?.refId && g.count > 0);
  assert.ok(jed, 'the data has a mapped municipality with invoices in Jeddah');
  const mu = await pageOf({ amanah: 'Jeddah Amanah', muni: jed.key }); const dsMu = await loadRegionalDataset(mu);
  assert.ok(dsMu.reconciliation.ok, JSON.stringify(dsMu.reconciliation.checks)); assert.ok(near(dsMu.total.cur.collected, mu.snapshot.totals.collected));
  assert.ok(dsMu.total.cur.net < dsOne.total.cur.net, 'a municipality is narrower than its Amanah'); assert.deepEqual(dsMu.entities.map((e) => e.key), ['Jeddah Amanah']);
  scopes.push(['one', one, dsOne], ['source', src, dsSrc], ['muni', mu, dsMu]);
  // loadRegionalDataset never trusts a STALE page snapshot: a snapshot of another scope is replaced by the page scope’s own
  const stale = { ...mu, snapshot: scopes[0][1].snapshot, prevSnapshot: scopes[0][1].prevSnapshot, comparison: scopes[0][1].comparison };
  const fixed = await loadRegionalDataset(stale); assert.ok(near(fixed.total.cur.collected, mu.snapshot.totals.collected), 'reloaded for rev.scopeEff, not the stale national snapshot');
});

await ok('authorisation — a restricted viewer’s dataset contains no unauthorised entity: names, keys, regions and raw rows (server narrowing AND the client cut)', async () => {
  const ORG = ['Riyadh Amanah', 'Jeddah Amanah'];
  const page = await pageOf({}, ORG); const ds = await loadRegionalDataset(page, { authorisedKeys: ORG });
  assert.ok(ds.reconciliation.ok); assert.deepEqual(ds.entities.map((e) => e.key).sort(), [...ORG].sort());
  const blob = JSON.stringify(ds); const others = scopes[0][2].entities.map((e) => e.key).filter((k) => !ORG.includes(k));
  assert.ok(others.length >= 10);
  for (const k of others) { assert.ok(!blob.includes(k), `no «${k}» in the dataset`); const en = scopes[0][2].entities.find((e) => e.key === k).label; assert.ok(!blob.includes(en.ar), `no «${en.ar}»`); }
  assert.ok(!blob.includes('Housing Sector') && ds.unattributed === null && !blob.includes('قطاع الإسكان'));
  assert.deepEqual(ds.regions.map((r) => r.key).sort(), ['SA-01', 'SA-02']);
  for (const id of REGIONAL_METRICS) for (const level of ['region', 'entity']) { const s = JSON.stringify(regionalMetric(ds, id, { level })); for (const k of others) assert.ok(!s.includes(k), `${id}/${level}: no ${k}`); }
  for (const r of ds.regions) { const d = regionDetail(ds, { level: 'region', key: r.key }); const s = JSON.stringify(d); for (const k of others) assert.ok(!s.includes(k), `detail ${r.key}: no ${k}`); }
  // the CLIENT cut: an unrestricted snapshot + authorisedKeys → the others are removed from every part; the flag says the KPI no longer matches (never silently)
  const cut = buildRegionalDataset({ snapshot: scopes[0][1].snapshot, prevSnapshot: scopes[0][1].prevSnapshot, comparison: scopes[0][1].comparison, authorisedKeys: ORG });
  const cb = JSON.stringify(cut); for (const k of others) assert.ok(!cb.includes(k), `client cut: no ${k}`);
  assert.equal(cut.reconciliation.authorisationFiltered, true); assert.ok(cut.reconciliation.ok); assert.deepEqual(cut.entities.map((e) => e.key).sort(), [...ORG].sort());
  assert.equal(cut.authorised.restricted, true);
  assert.ok(near(cut.total.cur.collected, page.snapshot.totals.collected), 'the cut dataset equals the server-narrowed one');
  // helpers: geographic scope ∩ organisation
  assert.equal(authorisedEntityKeys({ orgKeys: null, geoScope: { all: true } }), null);
  assert.deepEqual(authorisedEntityKeys({ orgKeys: ORG, geoScope: { all: true } }), ORG);
  assert.deepEqual(authorisedEntityKeys({ orgKeys: ORG, geoScope: { all: false, grants: [{ amanah: 'Riyadh Amanah', municipalities: 'all', direct: true, notSpecified: true }, { amanah: 'Asir Amanah', municipalities: 'all', direct: true, notSpecified: true }], nonMunicipal: false } }), ['Riyadh Amanah']);
});

/* ================================================================================================ 4. summary + review priorities (invoice-based; plan items excluded) */
const item = (key, amanah, category, amount, level = 'high', extra = {}) => ({ key, title: { ar: `بند ${key}`, en: `Item ${key}` }, category, priority: { level }, condition: { open: true }, affected: { amanah, label: { ar: amanah ? `أمانة ${amanah}` : 'الوزارة', en: amanah || 'Ministry' } }, measure: { kind: 'gap', label: { ar: 'الفجوة', en: 'Gap' }, amount }, ...extra });
// a Decision Room feed that CONTAINS plan items (the Decision Room page lists them) — the dashboard must never surface them
const PLAN_ITEMS = [item('plan:ministry', null, 'plan_deviation', 9e9), item('plan:Riyadh Amanah', 'Riyadh Amanah', 'plan_deviation', 5e9), item('x:planbyfield', 'Asir Amanah', 'data_conflicts', 4e9, 'high', { planSource: { planId: 'p1' } })];
const OTHER_ITEMS = [item('overdue:Asir Amanah', 'Asir Amanah', 'overdue_aging', 9e8, 'medium'), item('conf:1', 'Tabuk Amanah', 'data_conflicts', 5e8, 'low'), item('ent:1', 'Jeddah Amanah', 'enforcement_links', 3e8, 'low')];
const ITEMS = [...PLAN_ITEMS, ...OTHER_ITEMS];

await ok('performance summary: at most THREE findings (change · gap · priority), each with subject, figure and an action; the gap is the largest UNCOLLECTED balance with its basis stated; no plan wording', () => {
  const ds = scopes[0][2];
  const S = buildPerformanceSummary({ dataset: ds, items: ITEMS, canSeeDecisions: true });
  assert.equal(S.max, SUMMARY_MAX); assert.ok(S.findings.length === 3, `3 findings (${S.findings.map((f) => f.id)}) absent ${JSON.stringify(S.absent.map((a) => a.id + ':' + a.reason))}`);
  assert.deepEqual(S.findings.map((f) => f.id), ['change', 'gap', 'priority']);
  for (const f of S.findings) { assert.ok(f.title.ar && f.title.en && f.sentence.ar && f.sentence.en && f.subject.name.ar && f.figure.label.ar && f.action.label.ar === 'عرض', f.id); assert.ok(!/NaN|undefined|Infinity/.test(strings(f).join(' ')), f.id); assert.ok(f.figure.value.ar.text && f.figure.value.en.text, f.id); assert.ok(!PLAN_WORDS.test(strings(f.title).join(' ') + strings(f.sentence).join(' ') + strings(f.figure).join(' ')), `${f.id}: no plan wording`); }
  const ch = S.findings[0]; const all = [...ds.entities, ...ds.regions.filter((r) => r.entityCount > 1)].filter((r) => r.prev);
  const biggest = all.reduce((m, r) => (Math.abs(r.cur.collected - r.prev.collected) > Math.abs(m.cur.collected - m.prev.collected) ? r : m));
  assert.equal(ch.subject.key, biggest.key, 'the most significant change = the largest |Δ| of collected'); assert.equal(ch.basis.kind, 'prior_period'); assert.ok(ch.status && ['critical', 'attention', 'slight', 'ok'].includes(ch.status.cls));
  assert.ok(/^[+−]/.test(ch.figure.value.en.text) && ch.figure.secondary.value.en.text.includes('%'), 'amount AND %');
  const gap = S.findings[1]; assert.equal(gap.basis.kind, 'uncollected'); assert.equal(gap.subject.level, 'entity'); assert.equal(gap.title.ar, 'أكبر رصيد غير محصّل');
  const top = ds.entities.slice().sort((a, b) => b.cur.uncollected - a.cur.uncollected)[0]; assert.equal(gap.subject.key, top.key, 'the largest uncollected balance'); assert.equal(gap.action.kind, 'select');
  assert.ok(/الأساس: صافي المفوتر − المحصّل على فواتير الفترة المختارة/.test(gap.sentence.ar) && /Basis: net invoiced − collected on the invoices of the selected period/.test(gap.sentence.en), 'the basis is stated');
  assert.equal(gap.status.cls, BANDS.classifyRate(top.cur.collected / top.cur.net), 'the gap finding cites the entity’s collection-rate band (same classifier)');
  assert.equal(gap.figure.secondary.label.ar, 'نسبة التحصيل');
  const pr = S.findings[2]; assert.equal(pr.basis.kind, 'decision_room'); assert.equal(pr.basis.itemKey, 'overdue:Asir Amanah', 'the first NON-plan item of the existing prioritisation'); assert.ok(pr.action.target.to.startsWith('/decisions?item='));
});

await ok('performance summary: a finding is ABSENT when its inputs are unavailable (coded reason) — never fabricated; no plan comparison is ever attempted', () => {
  const nc = buildRegionalDataset({ snapshot: scopes[0][1].snapshot, prevSnapshot: null, comparison: { comparable: false } });
  const S = buildPerformanceSummary({ dataset: nc, items: ITEMS, canSeeDecisions: false });
  assert.deepEqual(S.findings.map((f) => f.id), ['gap']); assert.equal(S.findings[0].basis.kind, 'uncollected');
  assert.deepEqual(S.absent.map((a) => [a.id, a.reason]), [['change', 'no_comparison'], ['priority', 'no_access']]); assert.ok(S.absent.every((a) => a.message.ar && a.message.en));
  const top = nc.entities.slice().sort((a, b) => b.cur.uncollected - a.cur.uncollected)[0]; assert.equal(S.findings[0].subject.key, top.key);
  assert.ok(!PLAN_WORDS.test(strings(S.findings[0]).join(' ') + strings(S.absent).join(' ')), 'no plan wording, no «no compatible target» notice');
  const empty = buildRegionalDataset({ snapshot: snapOfCells([]), prevSnapshot: null, comparison: { comparable: false } });
  const E = buildPerformanceSummary({ dataset: empty, items: [], canSeeDecisions: true }); assert.deepEqual(E.findings, []); assert.deepEqual(E.absent.map((a) => a.id), ['change', 'gap', 'priority']); assert.equal(E.absent[0].reason, 'no_data');
  // a feed that holds ONLY plan items ⇒ no priority finding (excluded, not shown)
  const P = buildPerformanceSummary({ dataset: scopes[0][2], items: PLAN_ITEMS, canSeeDecisions: true }); assert.ok(!P.findings.some((f) => f.id === 'priority')); assert.equal(P.absent.find((a) => a.id === 'priority').reason, 'no_items');
  const one = scopes.find((s) => s[0] === 'one')[2]; const O = buildPerformanceSummary({ dataset: one }); const ch = O.findings.find((f) => f.id === 'change'); assert.ok(!ch || (ch.subject.level === 'entity' && ch.subject.key === 'Jeddah Amanah'));
});

await ok('review priorities: ≤ 3 cases from the existing prioritisation, PLAN-category items (plan_deviation, plan:*, planSource) EXCLUDED, an aggregate never shown with its own entity cases, link + remaining only with the decisions module', () => {
  for (const it of PLAN_ITEMS) assert.equal(isPlanItem(it), true, it.key); for (const it of OTHER_ITEMS) assert.equal(isPlanItem(it), false, it.key);
  const R = buildReviewPriorities({ items: ITEMS, canSeeDecisions: true });
  assert.equal(MAX_REVIEW_CASES, 3); assert.deepEqual(R.cases.map((c) => c.key), ['overdue:Asir Amanah', 'conf:1', 'ent:1'], 'the plan items are not cases');
  assert.equal(R.total, OTHER_ITEMS.length, 'plan items are not even counted'); assert.equal(R.remaining, 0);
  for (const c of R.cases) { assert.ok(c.title.ar && c.title.en && c.entity.name.ar && ['entity', 'source', 'scope'].includes(c.entity.level) && c.measure.label.ar && c.measure.text.en && c.inspectTarget.to.startsWith('/decisions?item=')); assert.ok(!/plan/.test(c.key)); }
  assert.ok(!JSON.stringify(R).includes('plan:'), 'no plan key anywhere in the result');
  assert.deepEqual(R.link, { show: true, to: '/decisions', label: R.link.label }); assert.ok(R.link.label.ar.includes('غرفة القرارات'));
  const only = buildReviewPriorities({ items: PLAN_ITEMS, canSeeDecisions: true }); assert.deepEqual(only.cases, []); assert.equal(only.reason, 'no_items');
  const P = buildReviewPriorities({ items: ITEMS, canSeeDecisions: false }); assert.equal(P.allowed, false); assert.equal(P.reason, 'no_access'); assert.deepEqual(P.cases, []); assert.equal(P.link.show, false); assert.equal(P.remaining, 0);
  const N = buildReviewPriorities({ items: [], canSeeDecisions: true }); assert.equal(N.reason, 'no_items'); assert.equal(N.link.show, false);
  const closed = OTHER_ITEMS.map((i) => ({ ...i, condition: { open: false } })); assert.equal(buildReviewPriorities({ items: closed }).cases.length, 0); assert.ok(buildReviewPriorities({ items: OTHER_ITEMS, limit: 9 }).cases.length <= 3);
  // the generic aggregate rule still holds for non-plan categories: a scope-level item is subsumed by its entity cases
  const mk = (key, am, cat, pr) => ({ key, category: cat, title: { ar: key, en: key }, affected: am ? { amanah: am, label: { ar: am, en: am } } : { label: { ar: 'الوزارة', en: 'Ministry' } }, measure: { kind: 'gap', label: { ar: 'فجوة', en: 'Gap' }, amount: 1e6 }, priority: { level: pr }, condition: { open: true } });
  const syn = [mk('overdue:all', null, 'overdue_aging', 'high'), mk('overdue:A', 'A', 'overdue_aging', 'high'), mk('overdue:B', 'B', 'overdue_aging', 'medium'), mk('data:x', null, 'data_conflicts', 'low')];
  assert.ok(subsumedKeys(syn).has('overdue:all')); assert.deepEqual(buildReviewPriorities({ items: syn }).cases.map((c) => c.key), ['overdue:A', 'overdue:B', 'data:x']);
});

/* ================================================================================================ 5. panel details + the export cell */
await ok('regionDetail: the side panel data — entities, revenue sources, municipalities, full increases / decreases, monthly trend, the three band statuses; reconciles with the row; no plan field', () => {
  const ds = scopes[0][2]; const reg = ds.regions.find((r) => r.entityKeys.length > 1) || ds.regions[0];
  const d = regionDetail(ds, { level: 'region', key: reg.key }); assert.equal(d.levelLabel.ar, 'المنطقة'); assert.deepEqual(d.entities.map((e) => e.key).sort(), reg.entityKeys.slice().sort());
  assert.deepEqual(Object.keys(d.statuses).sort(), ['changeCollected', 'changeRate', 'rate']); assert.ok(!('plan' in d) && !('planState' in d) && !('plan' in d.row));
  assert.equal(d.statuses.rate.cls, BANDS.classifyRate(reg.cur.collected / reg.cur.net));
  assert.ok(near(d.sources.reduce((t, s) => t + s.cur.collected, 0), reg.cur.collected), 'sources add up to the region'); assert.ok(near(d.entities.reduce((t, e) => t + e.cur.collected, 0), reg.cur.collected));
  assert.ok(d.increases.every((c) => c.change > 0) && d.decreases.every((c) => c.change < 0)); assert.ok(d.increases.every((c, i) => i === 0 || d.increases[i - 1].change >= c.change)); assert.ok(d.decreases.every((c, i) => i === 0 || d.decreases[i - 1].change <= c.change));
  assert.ok(d.trend.length > 0 && near(d.trend.reduce((t, m) => t + m.collected, 0), reg.cur.collected, 1), 'the monthly trend adds up to the region');
  const e = regionDetail(ds, { level: 'entity', key: 'Jeddah Amanah' }); assert.equal(e.levelLabel.ar, 'الأمانة'); assert.deepEqual(e.entities, []); assert.ok(e.municipalities.length > 0 && e.municipalities.every((m) => m.key.startsWith('Jeddah Amanah|')));
  assert.ok(near(e.municipalities.reduce((t, m) => t + m.cur.collected, 0), e.row.cur.collected), 'municipalities add up to the Amanah (every invoice is in exactly one group)');
  const u = regionDetail(ds, { level: 'unattributed', key: 'unattributed' }); assert.equal(u.levelLabel.ar, UNATTRIBUTED_LABEL.ar); assert.equal(regionDetail(ds, { level: 'region', key: 'SA-XX' }), null);
  const iso = new Set(KSA_PROVINCES.map((p) => p.iso)); assert.ok(ds.regions.every((r) => iso.has(r.key)));
  for (const col of REGIONAL_METRICS) assert.ok(columnsFor(col)[0].primary && columnsFor(col)[0].id === col);
  assert.ok(!('plan' in ds) && ds.regions.every((r) => !('plan' in r)) && ds.entities.every((r) => !('plan' in r)), 'the dataset carries no plan');
});

await ok('the export cell (bandCell) is the SAME classifier as the screen: Σ collected ÷ Σ net, the band text + the range; net ≤ 0 or missing ⇒ unavailable (never 0 %)', () => {
  const c = (collected, net) => BANDS.bandCell({ collected, net });
  assert.equal(c(399, 1000).cls, 'critical'); assert.equal(c(400, 1000).cls, 'attention'); assert.equal(c(600, 1000).cls, 'slight'); assert.equal(c(800, 1000).cls, 'ok');
  assert.ok(c(800, 1000).text.ar.startsWith('✓ نسبة مرتفعة (80.0%)') && c(800, 1000).text.en.startsWith('✓ High rate (80.0%)') && /80% فأكثر/.test(c(800, 1000).text.ar));
  for (const bad of [c(10, 0), c(10, -5), c(null, 10), c(10, null), c(NaN, NaN), BANDS.bandCell({})]) { assert.equal(bad.cls, 'na'); assert.equal(bad.available, false); assert.ok(bad.text.ar.startsWith('○ غير متاح') && bad.text.en.startsWith('○ Not available')); }
  assert.ok(!PLAN_WORDS.test(strings(c(5, 10)).join(' ') + strings(c(5, 0)).join(' ')));
  const s = BANDS.statusOf('rate', 0.35); assert.equal(s.cls, 'critical'); assert.equal(s.available, true); assert.equal(BANDS.statusText(s, 'en'), '▼▼ Very low rate');
  const na = BANDS.unavailableStatus('rate', { reason: 'zero_denominator' }); assert.equal(na.cls, 'na'); assert.equal(na.color, null); assert.equal(BANDS.statusOf('rate', NaN).cls, 'na');
  assert.deepEqual(BANDS.RULE_IDS, ['rate', 'changeCollected', 'changeRate']);
});

/* ================================================================================================ 6. INDEPENDENCE from the collection plans */
const DASHBOARD_FILES = (() => {
  const dirs = ['src/components/insights', 'src/data/regional']; const out = ['src/pages/InsightsHub.jsx', 'src/data/dashboardReport.js', 'src/components/strategic/PctScale.jsx'];
  for (const d of dirs) for (const f of fs.readdirSync(new URL(`../${d}/`, import.meta.url))) if (/\.(js|jsx)$/.test(f)) out.push(`${d}/${f}`);
  return out;
})();
const FORBIDDEN = [/planStore/, /usePlans/, /\/plans\//, /referenceTarget/, /referenceFor|referenceTargets|referenceNotice/, /planCompat|loadPlanCompat|resolvePlanSelection/, /\.targets\b/, /notifiedBudget/, /viewerTargets/, /planInputs/, /planBasis|planForecast|planSectionOf/, /PLAN_FIELD_KEY|planFieldDef|planNotice|planStateText/, /performanceStatus/, /loadDashboardPlan|regionPlan|planKeys|planEntityKeys/, /selectorRows/];
await ok('INDEPENDENCE (static guard): nothing under src/components/insights/*, src/data/regional/*, src/pages/InsightsHub.jsx, src/data/dashboardReport.js imports or uses the plan store / usePlans / plans / referenceTarget / planCompat / rev.targets / notifiedBudget — and the dead plan modules are gone', () => {
  assert.ok(DASHBOARD_FILES.length >= 18, `scanned ${DASHBOARD_FILES.length} files`);
  for (const f of DASHBOARD_FILES) { const src = code(f); for (const re of FORBIDDEN) assert.ok(!re.test(src), `${f} must not use ${re}`); }
  for (const f of ['src/data/regional/planCompat.js', 'src/data/regional/performanceStatus.js']) assert.ok(!fs.existsSync(new URL(`../${f}`, import.meta.url)), `${f} is deleted (dead plan code)`);
  for (const mod of [REG, BANDS]) for (const k of Object.keys(mod)) assert.ok(!/plan|target|budget|reference/i.test(k), `export «${k}»`);
  for (const k of Object.keys(METRICS)) assert.ok(!/plan|target/i.test(k));
  const dr = code('src/data/dashboardReport.js'); assert.ok(/targets: DASHBOARD_NO_TARGETS/.test(dr), 'the export model gets no target object');
  const ud = read('src/data/useDecisions.js'); assert.ok(/export function useDashboardDecisions\(\) \{ return useDecisionsFeed\(\{ plansSnap: NO_PLANS, withPlan: false \}\); \}/.test(ud) && /export function useDecisions\(\) \{ return useDecisionsFeed\(\{ plansSnap: usePlans\(\), withPlan: true \}\); \}/.test(ud));
  const dash = code('src/components/insights/InsightsDashboard.jsx'); assert.ok(/useDashboardDecisions/.test(dash) && !/\buseDecisions\(/.test(dash));
});

await ok('INDEPENDENCE (behavioural): the dataset, every metric result, the summary, the review list and the legend are IDENTICAL with no plans, with plans, and after a plan / default / reference change (the store is never read)', async () => {
  const { setPlansForTest, clearPlans } = await import('../src/data/plans/planStore.js');
  const { customPlanRecord, referenceEntry } = await import('../src/data/plans/planFixtures.js');
  const run = async () => {
    const page = await pageOf(); const ds = await loadRegionalDataset(page);
    return { ds: JSON.stringify(ds), metrics: REGIONAL_METRICS.map((id) => JSON.stringify(regionalMetric(ds, id, { lang: 'ar' }))).join('|'), en: REGIONAL_METRICS.map((id) => JSON.stringify(regionalMetric(ds, id, { lang: 'en', level: 'entity' }))).join('|'), summary: JSON.stringify(buildPerformanceSummary({ dataset: ds, items: ITEMS, canSeeDecisions: true })), review: JSON.stringify(buildReviewPriorities({ items: ITEMS, canSeeDecisions: true })), detail: JSON.stringify(regionDetail(ds, { level: 'region', key: ds.regions[0].key })) };
  };
  try {
    setPlansForTest({ plans: [], references: {} }); const none = await run();
    const P1 = customPlanRecord({ id: 'plan-s1000001', name: 'خطة أولى', allocations: { 'Jeddah Amanah': 6e9, 'Riyadh Amanah': 9e9 } }); const P2 = customPlanRecord({ id: 'plan-s1000002', name: 'خطة ثانية', allocations: { 'Asir Amanah': 4e9 } });
    setPlansForTest({ plans: [P1], references: { [YEAR]: referenceEntry(P1.id) } }); const withPlan = await run();
    setPlansForTest({ plans: [P1, P2], references: { [YEAR]: referenceEntry(P2.id) } }); const changed = await run();
    setPlansForTest({ plans: [P1, P2], references: {} }); const ambiguous = await run();
    for (const k of Object.keys(none)) { assert.equal(withPlan[k], none[k], `${k}: same with a plan`); assert.equal(changed[k], none[k], `${k}: same after the reference changed`); assert.equal(ambiguous[k], none[k], `${k}: same with an ambiguous reference`); }
    const all = none.ds + none.metrics + none.en + none.summary + none.review + none.detail;
    for (const s of ['خطة أولى', 'خطة ثانية', 'plan-s1000001', 'plan-s1000002']) assert.ok(!all.includes(s), `no «${s}»`);
    assert.ok(!/"plan"|plannedToDate|vsPlan|targetAchievement|planDeviation|no_compatible_target|incompatible_period/.test(all), 'no plan field or reason in any result');
  } finally { clearPlans(); }
});

console.log(`regional performance: ${n} tests passed`);
