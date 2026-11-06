// Chart picker, customize panel, toolbar and export disclosure (src/components/charts/*, src/components/smart/ExportDialog.jsx, src/pages/SmartReports.jsx).
// Pure logic (chartPickerLogic.js) + server-side renders of the components that need no DOM + source/markup hygiene — React interaction itself is verified in the real app (docs/chart-library.md).
// Synthetic numbers only. Run: npm run test:chartui
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  pickerModel, customizeModel, effectiveCfg, sameEffective, cfgForType, displayFor, withKey, recommendedConfig, changeLines, SAME_NUMBERS, nextIndexByRects, KEY_DIR, changeNote, skippedLine, exportSummary, typeName, PURPOSE_NAMES, pptxLine, sameCfg, DIMENSION_NEEDS_TEXT
} from '../src/components/charts/chartPickerLogic.js';
import ChartCustomize from '../src/components/charts/ChartCustomize.jsx';
import ChartFrame from '../src/components/charts/ChartFrame.jsx';
import { ChartsDisclosure } from '../src/components/smart/ExportDialog.jsx';
import { I18nProvider } from '../src/context/I18nContext.jsx';
import { CHART_TYPES, chartOptions, evaluateChart, typeIdOf } from '../src/data/chartCatalog.js';
import { applyView, emptyView, setChartConfig, chartConfigOf, exportPlan, resetChart } from '../src/data/reportView.js';
import { assignChartIds, chartBlocks } from '../src/data/chartIds.js';
import { chartTableText } from '../src/data/reportFormat.js';
import { chartSvg } from '../src/utils/chartKinds.js';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };
const B = 1e9; const sum = (a) => a.reduce((t, v) => (Number.isFinite(v) ? t + v : t), 0);
const amanahs = ['Riyadh', 'Jeddah', 'Eastern', 'Madinah', 'Qassim', 'Asir', 'Tabuk', 'Hail'];
const byAmanah = (alts) => ({ type: 'chart', id: 'amanah:0', kind: 'hbar', ranked: true, title: 'Net billed and collected by Amanah', labels: [...amanahs], series: [{ label: 'Net billed', values: [8, 7, 6, 5, 4, 3, 2, 1].map((x) => x * B) }, { label: 'Collected', values: [5, 5, 3, 3, 2, 2, 1, 0.5].map((x) => x * B) }], dim: { dimension: 'amanah', ordered: false, additive: false, measures: [{ key: 'net', kind: 'amount' }, { key: 'collected', kind: 'amount' }] }, ...(alts ? { alts } : {}) });
const additive = () => ({ type: 'chart', id: 'amanah:1', kind: 'bar', title: 'Collected and uncollected by Amanah', labels: amanahs.slice(0, 5), series: [{ label: 'Collected', values: [5, 5, 3, 3, 2].map((x) => x * B), role: 'collected' }, { label: 'Uncollected', values: [3, 2, 3, 2, 2].map((x) => x * B), role: 'uncollected' }], dim: { dimension: 'amanah', ordered: false, additive: true, measures: [{ key: 'collected', kind: 'amount' }, { key: 'uncollected', kind: 'amount' }] } });
const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
const monthly = () => ({ type: 'chart', id: 'trends:0', kind: 'bar', basis: 'monthly', title: 'Net billed and collected by month', labels: [...months], series: [{ label: 'Net billed', values: [1.1, 1.3, 1.0, 1.2, 1.4, 1.1].map((x) => x * B) }, { label: 'Collected', values: [0.7, 0.9, 0.8, 0.8, 1.0, 0.8].map((x) => x * B) }], dim: { dimension: 'month', ordered: true, additive: false, measures: [{ key: 'net', kind: 'amount' }, { key: 'collected', kind: 'amount' }] } });
const flow = () => ({ nodes: [{ id: 'g', label: 'Gross', col: 0 }, { id: 'x', label: 'Exclusions', col: 1 }, { id: 'n', label: 'Net', col: 1 }, { id: 'c', label: 'Collected', col: 2 }, { id: 'u', label: 'Uncollected', col: 2 }], links: [{ from: 'g', to: 'x', value: 3 * B }, { from: 'g', to: 'n', value: 11 * B }, { from: 'n', to: 'c', value: 7 * B }, { from: 'n', to: 'u', value: 4 * B }] });
const waterfall = () => ({ type: 'chart', id: 'executive:0', kind: 'waterfall', title: 'Gross to net', labels: ['Gross', 'Exclusions', 'Net'], series: [{ label: 'Value', values: [14 * B, -3 * B, 11 * B] }], totals: [true, false, true], dim: { dimension: 'step', ordered: true, additive: false, measures: [{ key: 'net', kind: 'amount' }] }, alts: { sankey: flow() } });
const model = () => ({ lang: 'en', title: 'T', headline: [byAmanah()], sections: [{ key: 'executive', title: 'E', blocks: [waterfall(), monthly(), additive()] }], context: [] });

/* ---------------- the picker model ---------------- */
ok('the picker lists every catalog type once, grouped by the five purposes (the common ones first, the uncommon ones under «More charts»)', () => {
  const m = pickerModel(byAmanah(), null, 'en');
  const ids = [...m.groups, ...m.more].flatMap((g) => g.items.map((i) => i.id)); assert.equal(ids.length, CHART_TYPES.length); assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(m.groups.map((g) => g.purpose), ['comparison', 'trend', 'composition', 'distribution', 'relationship'].filter((p) => m.groups.some((g) => g.purpose === p)));
  assert.deepEqual(Object.keys(PURPOSE_NAMES), ['comparison', 'trend', 'composition', 'distribution', 'relationship']);
  assert.equal(PURPOSE_NAMES.comparison.ar, 'المقارنة'); assert.equal(PURPOSE_NAMES.trend.ar, 'الاتجاه'); assert.equal(PURPOSE_NAMES.composition.ar, 'التركيب'); assert.equal(PURPOSE_NAMES.distribution.ar, 'التوزيع'); assert.equal(PURPOSE_NAMES.relationship.ar, 'العلاقة');
  assert.ok(m.groups.every((g) => g.items.every((i) => !i.more)) && m.more.every((g) => g.items.every((i) => i.more)), 'the disclosure holds exactly the uncommon kinds');
  const more = m.more.flatMap((g) => g.items.map((i) => i.id)); for (const id of ['pareto', 'treemap', 'sankey', 'stacked100_col', 'box', 'histogram', 'bullet', 'combo', 'bubble', 'sunburst', 'stacked100_hbar']) assert.ok(more.includes(id), id);
});
ok('exactly one option is Recommended and one is Current; the current type of a horizontal bar is hbar', () => {
  const m = pickerModel(byAmanah(), null, 'en'); assert.equal(m.items.filter((i) => i.recommended).length, 1); assert.equal(m.items.filter((i) => i.current).length, 1);
  assert.equal(m.current, 'hbar'); assert.equal(m.byId.hbar.current, true); assert.equal(m.recommended, chartOptions(byAmanah()).recommended);
});
ok('an unavailable option carries a concise reason in Arabic and English and no drawing of the data (the generic shape is used, greyed)', () => {
  const m = pickerModel(byAmanah(), null, 'en'); const un = m.items.filter((i) => !i.available); assert.ok(un.length > 5, 'several types cannot carry per-Amanah net vs collected');
  for (const i of un) { assert.ok(i.reason && i.reason.ar.length > 8 && i.reason.en.length > 8, `${i.id} reason`); assert.equal(i.block, null); assert.ok(i.previewSpec && i.previewSpec.preview, `${i.id} has the generic shape`); assert.ok(chartSvg(i.previewSpec, { lang: 'en', w: 280 }).includes('<svg'), `${i.id} preview draws`); assert.equal(i.cfg, null); }
  assert.ok(m.byId.line.available === false && /order|ordered|time/i.test(m.byId.line.reason.en), 'a line over an unordered axis says so: ' + m.byId.line.reason.en);
});
ok('the thumbnails draw the person\'s OWN data: the same figures in every type that is available (bar · hbar · pareto · treemap · pie/donut where parts of one whole)', () => {
  const b = additive(); const tot = [sum(b.series[0].values), sum(b.series[1].values)]; const m = pickerModel(b, null, 'en');
  for (const id of ['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'stacked100_col']) { assert.ok(m.byId[id].available, id); const x = m.byId[id].block; if (id.startsWith('stacked100')) { assert.ok(chartSvg(x, { lang: 'en', w: 360 }).includes('<svg')); continue; } assert.equal(x.series.length, 2, id); tot.forEach((t, k) => assert.ok(Math.abs(sum(x.series[k].values) - t) < 0.5, `${id} series ${k}`)); }
  const one = byAmanah(); const net = sum(one.series[0].values); const m1 = pickerModel(one, null, 'en');
  for (const id of ['hbar', 'bar']) assert.ok(Math.abs(sum(m1.byId[id].block.series[0].values) - net) < 0.5, id);
  for (const it of m1.items.filter((i) => i.available)) assert.ok(chartSvg(it.block, { lang: 'ar', w: 360 }).includes('<svg'), `${it.id} draws`);
});
ok('every available option states what changes: a switch that changes the aggregation says so, one that only redraws says «same numbers, presentation only»', () => {
  const m = pickerModel(additive(), null, 'en'); const st = m.byId.stacked_col; assert.ok(st.available && st.changes.some((c) => c.key === 'grouping'), 'stacked: the grouping change is named');
  assert.ok(m.byId.stacked100_col.changes.some((c) => c.key === 'percentage'), '100 %: the percentage basis is named');
  const h = pickerModel(byAmanah(), null, 'en').byId.bar; assert.deepEqual(changeLines(h.changes, 'en'), [], 'a plain redraw lists no change'); assert.equal(SAME_NUMBERS.en, 'Same numbers, presentation only.'); assert.ok(SAME_NUMBERS.ar.includes('الأرقام نفسها'));
  const p = pickerModel(byAmanah(), null, 'en').byId.pareto; if (p.available) assert.ok(p.changes.some((c) => c.key === 'aggregation'), 'pareto: sorted with a cumulative line');
});
ok('amount → share (the change box): the percentage basis and its denominator are stated in both languages', () => {
  const r = evaluateChart(additive(), 'bar', { mode: 'share' }, { lang: 'en' }); assert.ok(r.ok); const c = changeLines(r.changes, 'en').find((x) => x.key === 'percentage'); assert.ok(c && /denominator|÷/i.test(c.text), c && c.text);
  assert.ok(changeLines(r.changes, 'ar').find((x) => x.key === 'percentage').text.includes('المقام'));
});
ok('a waterfall is never converted: the picker offers only itself and the saved sankey, every other type is unavailable with a reason', () => {
  const m = pickerModel(waterfall(), null, 'en'); const av = m.items.filter((i) => i.available).map((i) => i.id).sort(); assert.deepEqual(av, ['sankey', 'waterfall'].sort(), av.join(','));
  for (const i of m.items.filter((x) => !x.available)) assert.ok(i.reason && i.reason.en.length > 8, i.id);
  const w = m.byId.waterfall; assert.ok(w.current && w.available); const flowSum = sum(m.byId.sankey.block.links.map((l) => l.value)); assert.ok(flowSum > 0, 'the sankey is the SAVED flow, not a recomputation');
  assert.equal(displayFor(waterfall(), { kind: 'pie' }, 'en').kind, 'waterfall', 'a stored request the data cannot take leaves the chart as it is');
});
ok('selecting a type builds the config with patchConfig: the modifiers of the old kind are dropped, the data choices stay', () => {
  assert.deepEqual(cfgForType({ kind: 'hbar', orientation: 'h', sort: 'desc', topN: 5 }, 'bar'), { kind: 'bar', sort: 'desc', topN: 5 });
  assert.deepEqual(cfgForType(null, 'treemap'), { kind: 'treemap' });
  assert.deepEqual(withKey({ sort: 'desc', topN: 5 }, 'topN', null), { sort: 'desc' }); assert.deepEqual(withKey({ labels: true }, 'labels', 'auto'), {}); assert.deepEqual(withKey({}, 'labels', false), { labels: false });
});
ok('«no change» is the empty config: a request equal to the chart\'s own type and defaults counts as unchanged (Apply stays disabled), a real difference does not', () => {
  const b = byAmanah(); assert.deepEqual(effectiveCfg(b, { kind: 'hbar' }), {}); assert.deepEqual(effectiveCfg(b, { kind: 'bar' }), { kind: 'bar' }); assert.deepEqual(effectiveCfg(b, { kind: 'hbar', topN: 5 }), { topN: 5 });
  assert.ok(sameEffective(b, { kind: 'hbar' }, {})); assert.ok(!sameEffective(b, { kind: 'bar' }, {})); assert.ok(sameEffective(b, null, undefined));
});
ok('«reset to recommended»: empty when the report already drew the recommended type, otherwise the recommended kind', () => {
  const b = byAmanah(); const r = chartOptions(b).recommended; const c = recommendedConfig(b, 'en'); if (r === typeIdOf(b)) assert.deepEqual(c, {}); else assert.deepEqual(c, { kind: r });
  const many = { ...byAmanah(), kind: 'bar', labels: Array.from({ length: 20 }, (_, i) => `Municipality number ${i + 1}`), series: [{ label: 'Net', values: Array.from({ length: 20 }, (_, i) => (20 - i) * 1e6) }] };
  assert.equal(recommendedConfig(many, 'en').kind, 'hbar', 'many long-named categories read better as horizontal bars');
});
ok('applying through the view: the choice is stored per chart id, the saved model is untouched, the figures are identical, and it survives clean → apply again', () => {
  const m = assignChartIds(model()); const before = JSON.stringify(m); const id = 'amanah:0'; const block = chartBlocks(m).find((c) => c.id === id);
  const v = setChartConfig(emptyView(), id, cfgForType(null, 'bar'), block); assert.deepEqual(chartConfigOf(v, id), { kind: 'bar' });
  const out = applyView(m, v).model; const shown = chartBlocks(out).find((c) => c.id === id); assert.equal(shown.kind, 'bar');
  assert.ok(Math.abs(sum(shown.series[0].values) - sum(block.series[0].values)) < 0.5, 'same SAR total'); assert.equal(JSON.stringify(m), before, 'the saved model is never mutated');
  assert.equal(chartConfigOf(setChartConfig(v, id, {}, block), id), null, 'an empty config removes the entry'); assert.deepEqual(resetChart(v, id).charts, {});
  assert.equal(chartConfigOf(setChartConfig(emptyView(), id, { kind: 'hbar' }, block), id), null, 'a config equal to the chart\'s own type stores nothing');
});

/* ---------------- customize ---------------- */
ok('customize offers only the controls the chart accepts: a by-Amanah bar has orientation, sorting, Top N, labels, legend; no cumulative', () => {
  const c = customizeModel(byAmanah(), {}, 'en'); const keys = c.controls.map((x) => x.key);
  for (const k of ['orientation', 'sort', 'topN', 'labels', 'legend']) assert.ok(keys.includes(k), `${k} in ${keys}`);
  assert.ok(!keys.includes('cumulative'), 'a per-Amanah chart has no monthly basis');
  const top = c.controls.find((x) => x.key === 'topN'); assert.ok(top.options.some((o) => o.value === 5 && o.label.en === 'Top 5 + Other' && o.label.ar === 'الأعلى 5 + أخرى'), JSON.stringify(top.options.map((o) => o.label)));
  assert.ok(top.options.every((o) => o.value === null || o.value < 8), 'Top N never offers a value that is not smaller than the number of categories');
});
ok('a time axis: sorting and Top N are not offered (listed once as «not applicable» with the reason), monthly ↔ cumulative is', () => {
  const c = customizeModel(monthly(), {}, 'en'); const keys = c.controls.map((x) => x.key); assert.ok(keys.includes('cumulative') && !keys.includes('sort') && !keys.includes('topN'), keys.join(','));
  const na = c.notApplicable.find((x) => x.key === 'sort'); assert.ok(na && /time|ordered/i.test(na.reason.en), JSON.stringify(c.notApplicable));
  const cu = c.controls.find((x) => x.key === 'cumulative'); assert.equal(cu.value, false); const on = cu.options.find((o) => o.value === true); assert.ok(on.enabled && on.changes.some((x) => x.key === 'basis'), 'the running total names its basis');
  const after = customizeModel(monthly(), { cumulative: true }, 'en'); assert.equal(after.display.basis, 'cumulative'); assert.ok(after.controls.find((x) => x.key === 'cumulative').options.find((o) => o.value === false).enabled, 'back to the saved monthly values is allowed');
  const saved = { ...monthly(), basis: 'cumulative', title: 'Cumulative', series: monthly().series.map((s) => ({ ...s, values: s.values.reduce((a, v, i) => [...a, (a[i - 1] || 0) + v], []) })) };
  const cs = customizeModel(saved, {}, 'en'); assert.ok(!cs.controls.some((x) => x.key === 'cumulative'), 'a SAVED running total offers no switch back to monthly');
  const why = cs.notApplicable.find((x) => x.key === 'cumulative'); assert.ok(why && /monthly values/i.test(why.reason.en) && why.reason.ar.length > 8, 'the reason is listed: ' + JSON.stringify(cs.notApplicable));
});
ok('Top N keeps the total: the folded rows become ONE explicit «Other» row and the change box says so', () => {
  const b = byAmanah(); const c = customizeModel(b, { topN: 5 }, 'en'); assert.ok(c.ok); assert.equal(c.display.labels.length, 6); assert.ok(c.display.otherLabel, 'the Other group is labelled'); assert.ok(/Top 5/.test(c.changes.map((x) => x.en).join(' ')));
  b.series.forEach((s, k) => assert.ok(Math.abs(sum(c.display.series[k].values) - sum(s.values)) < 0.5, `series ${k} total unchanged`));
  assert.ok(chartTableText(c.display, 'en').rows.length >= 6, 'the table holds the Other row too');
});
ok('the breakdown dimension: held dimensions are selectable, the others are shown disabled with «needs a new report version»', () => {
  const alt = (lab) => ({ labels: lab, series: [{ label: 'Net billed', values: lab.map((_, i) => (i + 1) * B) }, { label: 'Collected', values: lab.map((_, i) => (i + 1) * 0.5 * B) }] });
  const b = byAmanah({ bySource: alt(['SADAD', 'Fines', 'Other']) }); const d = customizeModel(b, {}, 'en').controls.find((x) => x.key === 'dimension'); assert.ok(d, 'the control appears for a described dimension');
  const o = Object.fromEntries(d.options.map((x) => [x.value, x])); assert.ok(o.amanah.current && o.source.enabled, 'source is held'); assert.equal(o.municipality.enabled, false); assert.equal(o.product.enabled, false);
  assert.equal(o.municipality.why.en, DIMENSION_NEEDS_TEXT.en); assert.equal(DIMENSION_NEEDS_TEXT.ar, 'يحتاج إصداراً جديداً من التقرير'); assert.ok(d.notes.length === 2 && d.notes.every((x) => x.text.en === 'needs a new report version'));
  assert.equal(customizeModel(monthly(), {}, 'en').controls.some((x) => x.key === 'dimension'), false, 'a time axis has no Amanah / source breakdown');
  const sw = evaluateChart(b, 'hbar', withKey({}, 'dimension', 'source'), { lang: 'en' }); assert.ok(sw.ok && sw.block.labels.length === 3 && sw.changes.some((x) => x.key === 'dimension'));
});
ok('share ↔ amount and grouped ↔ stacked appear for additive parts, each with its change text', () => {
  const c = customizeModel(additive(), {}, 'en'); const g = c.controls.find((x) => x.key === 'grouping'); assert.ok(g && g.options.find((o) => o.value === 'stacked').enabled);
  const mo = c.controls.find((x) => x.key === 'mode'); assert.ok(mo.options.find((o) => o.value === 'share').changes.some((x) => x.key === 'percentage'));
  const net = customizeModel(byAmanah(), {}, 'en').controls.find((x) => x.key === 'grouping'); assert.ok(!net || !net.options.find((o) => o.value === 'stacked').enabled, 'net billed vs collected overlap: never stacked');
});
ok('labels and legend are tri-state (auto · show · hide) and reach the display block', () => {
  const c = customizeModel(byAmanah(), { labels: false, legend: true }, 'en'); assert.equal(c.display.showLabels, false); assert.equal(c.display.showLegend, true);
  const l = c.controls.find((x) => x.key === 'labels'); assert.equal(l.value, false); assert.deepEqual(l.options.map((o) => o.value), ['auto', true, false]);
});

/* ---------------- keyboard ---------------- */
ok('arrow keys move by physical direction in the card grid (LTR and RTL layouts), Home/End jump, the edge stays put', () => {
  const R = (l, t) => ({ left: l, right: l + 100, top: t, bottom: t + 80 });
  const ltr = [R(0, 0), R(110, 0), R(0, 90), R(110, 90)]; const rtl = [R(110, 0), R(0, 0), R(110, 90), R(0, 90)]; // DOM order 0..3 in each layout
  assert.equal(nextIndexByRects(ltr, 0, 'right'), 1); assert.equal(nextIndexByRects(ltr, 0, 'down'), 2); assert.equal(nextIndexByRects(ltr, 3, 'up'), 1); assert.equal(nextIndexByRects(ltr, 1, 'right'), 1, 'the edge stays');
  assert.equal(nextIndexByRects(rtl, 0, 'left'), 1, 'RTL: the next card is on the left'); assert.equal(nextIndexByRects(rtl, 0, 'right'), 0); assert.equal(nextIndexByRects(rtl, 2, 'up'), 0);
  assert.equal(nextIndexByRects(ltr, 2, 'home'), 0); assert.equal(nextIndexByRects(ltr, 0, 'end'), 3); assert.equal(nextIndexByRects([], 0, 'down'), -1);
  assert.deepEqual(Object.keys(KEY_DIR).sort(), ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home']);
});

/* ---------------- messages ---------------- */
ok('the view message names the change in both languages and says «same numbers» when nothing but the drawing changed', () => {
  const ar = changeNote('X', 'hbar', 'bar', 'ar', []); const en = changeNote('X', 'hbar', 'bar', 'en', []); assert.ok(ar.includes('أعمدة') && ar.includes('الأرقام نفسها')); assert.ok(en.includes('Column') && en.includes('Same numbers'));
  assert.ok(typeName('treemap', 'en') === 'Treemap' && typeName('treemap', 'ar') === 'خريطة شجرية');
});
ok('skipped charts: each one is named with its OWN reason (not only «pies»)', () => {
  const m = assignChartIds(model()); const r = applyView(m, { ...emptyView(), chartKind: 'pie' });
  assert.ok(r.skippedList.length >= 1); const t = skippedLine(r.skippedList, 'en'); assert.ok(t.startsWith('Left as they were:') && t.includes('Gross to net') && /waterfall|reconciliation/i.test(t), t); assert.ok(!/\.;/.test(t) && !t.includes('..'), 'no doubled punctuation: ' + t);
  assert.ok(skippedLine(r.skippedList, 'ar').startsWith('لم يتغيّر:')); assert.equal(skippedLine([], 'en'), '');
  const big = Array.from({ length: 6 }, (_, i) => ({ chartId: `c${i}`, title: `T${i}`, reason: { ar: 'س', en: 'why' } })); assert.ok(skippedLine(big, 'en').includes('(+3 more)'));
});

/* ---------------- export disclosure ---------------- */
ok('the export plan summary counts native / picture / table and names every fallback with the picture-and-table note', () => {
  const m = assignChartIds(model()); let v = emptyView(); const blk = chartBlocks(m).find((c) => c.id === 'amanah:0');
  const plain = exportSummary(exportPlan(m, v), 'en'); assert.equal(plain.total, 4); assert.equal(plain.native, plain.total - plain.picture - plain.table);
  v = setChartConfig(v, 'executive:0', { kind: 'sankey' }, chartBlocks(m).find((c) => c.id === 'executive:0'));
  const s = exportSummary(exportPlan(m, v), 'en'); assert.ok(s.picture >= 1 && s.fallbacks.some((f) => f.typeId === 'sankey' && f.mode === 'vector-image' && /picture/.test(f.note) && f.name === 'Sankey'), JSON.stringify(s.fallbacks));
  assert.ok(exportSummary(exportPlan(m, v), 'ar').fallbacks[0].note.includes('صورة — البيانات في الجدول'));
  v = setChartConfig(v, 'amanah:0', { kind: 'treemap' }, blk); const t = exportSummary(exportPlan(m, v), 'en'); assert.ok(t.fallbacks.length >= (s.fallbacks.length + (chartOptions(blk).available.some((a) => a.id === 'treemap') ? 1 : 0)));
  assert.ok(pptxLine({ pptx: 'vector-image' }, 'ar').includes('صورة') && pptxLine({ pptx: 'native' }, 'en').includes('editable'));
});

/* ---------------- server-side renders (no DOM needed) ---------------- */
ok('the customize panel renders its groups, pressed state, disabled options with their reasons and the change box', () => {
  const alt = { labels: ['A', 'B'], series: [{ label: 'Net billed', values: [1, 2] }, { label: 'Collected', values: [1, 1] }] };
  const html = renderToStaticMarkup(React.createElement(ChartCustomize, { id: 'cc1', block: byAmanah({ bySource: alt }), cfg: { topN: 5 }, lang: 'en', dirty: true, onDraft() {}, onApply() {}, onCancel() {}, onReset() {} }));
  assert.ok(html.includes('role="region"') && html.includes('aria-pressed="true"') && html.includes('aria-disabled="true"'));
  assert.ok(html.includes('needs a new report version') && html.includes('Top 5 + Other') && html.includes('What will change') && html.includes('Reset to recommended'));
  const ar = renderToStaticMarkup(React.createElement(ChartCustomize, { id: 'cc2', block: byAmanah(), cfg: {}, lang: 'ar', dirty: false, onDraft() {}, onApply() {}, onCancel() {}, onReset() {} })); assert.ok(ar.includes('ما سيتغيّر') && ar.includes('تطبيق') && ar.includes('إعادة إلى الموصى به'));
});
ok('the toolbar: «Change chart» (aria-haspopup=dialog) and «Customize» (aria-expanded) with the current type; a saved config shows «Modified» + «Reset to recommended»', () => {
  const b = byAmanah(); const mk = (view, lang, picker = 'full') => renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(ChartFrame, { block: b, chartId: 'amanah:0', view, onViewChange() {}, lang, picker })));
  const html = mk(emptyView(), 'en'); assert.ok(html.includes('aria-haspopup="dialog"') && html.includes('Change chart') && html.includes('Customize') && html.includes('aria-expanded="false"') && html.includes('Horizontal bar') && !html.includes('Modified'));
  assert.ok(html.includes('View data table') && html.includes('data-chart-id="amanah:0"'), 'the data table fold stays');
  const mod = mk(setChartConfig(emptyView(), 'amanah:0', { kind: 'bar' }, b), 'en'); assert.ok(mod.includes('Modified') && mod.includes('Reset to recommended') && mod.includes('Column'));
  const ar = mk(setChartConfig(emptyView(), 'amanah:0', { kind: 'bar' }, b), 'ar'); assert.ok(ar.includes('تغيير الرسم') && ar.includes('تخصيص') && ar.includes('معدّل') && ar.includes('عرض جدول البيانات'));
  const compact = mk(emptyView(), 'en', 'compact'); assert.ok(compact.includes('aria-label="Change chart"') && !compact.includes('<span>Change chart</span>'));
  const plain = renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(ChartFrame, { block: b, view: emptyView(), lang: 'en', picker: false }))); assert.ok(!plain.includes('Change chart'), 'picker:false is the plain chart');
});
ok('the export dialog block: PowerPoint counts + a visible warning line for fallbacks, PDF/Word say «same drawing»', () => {
  const m = assignChartIds(model()); const v = setChartConfig(emptyView(), 'executive:0', { kind: 'sankey' }, chartBlocks(m).find((c) => c.id === 'executive:0'));
  const shown = applyView(m, v).model; const el = (format, ar) => renderToStaticMarkup(React.createElement(ChartsDisclosure, { model: shown, format, L: (a) => a, ar }));
  const p = el('pptx', false); assert.ok(p.includes('How charts appear in the file') && p.includes('native editable') && p.includes('picture') && p.includes('sr-exp__warnline') && p.includes('picture — the data is in the table') && p.includes('Sankey'));
  assert.ok(el('pdf', false).includes('same drawing') && !el('pdf', false).includes('sr-exp__warnline') && el('docx', false).includes('same drawing'));
  assert.ok(el('pptx', true).includes('كيف ستظهر الرسوم في الملف') && el('pptx', true).includes('صورة — البيانات في الجدول'));
  assert.equal(renderToStaticMarkup(React.createElement(ChartsDisclosure, { model: { headline: [], sections: [], lang: 'en' }, format: 'pptx', L: (a) => a, ar: false })), '', 'no charts → nothing');
});

/* ---------------- source hygiene ---------------- */
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FILES = ['src/components/charts/ChartPicker.jsx', 'src/components/charts/ChartCustomize.jsx', 'src/components/charts/ChartFrame.jsx', 'src/components/charts/chartPickerLogic.js', 'src/components/smart/ReportChart.jsx', 'src/components/smart/ExportDialog.jsx'];
ok('the picker is an accessible dialog: role=dialog, aria-modal, a heading label, Esc closes, focus is trapped and returned, radios with roving tabindex, disabled options keep their visible reason', () => {
  const s = read('src/components/charts/ChartPicker.jsx');
  for (const t of ['role="dialog"', 'aria-modal="true"', 'aria-labelledby', "e.key === 'Escape'", "e.key !== 'Tab'", 'role="radio"', 'aria-checked', 'aria-disabled', 'tabIndex={tabbable ? 0 : -1}', 'role="radiogroup"', 'aria-expanded={showMore}', 'aria-live="polite"', 'anchorRef.current', 'createPortal']) assert.ok(s.includes(t), t);
  for (const t of ['Recommended', 'Current', 'More charts', 'What will change', 'Apply', 'Cancel', 'Reset to recommended', 'View data table', 'Not available: ', 'ما سيتغيّر', 'مخططات أخرى', 'موصى به', 'الحالي']) assert.ok(s.includes(t), t);
  assert.ok(s.includes('cp-card__why') && !/title=\{[^}]*reason/.test(s), 'the reason is visible text, not only a tooltip');
  const f = read('src/components/charts/ChartFrame.jsx'); assert.ok(f.includes('aria-haspopup="dialog"') && f.includes('aria-expanded={cust}') && f.includes('aria-controls'));
});
ok('the integration: Smart Reports wires the distributions fetch (same cut-off), the chart-request interpreter before the legacy branch, view messages with Undo, and the skipped-chart reasons', () => {
  const s = read('src/pages/SmartReports.jsx');
  assert.ok(s.includes('rev.data.distributions(ncScope, atEnd)') && /inputs = \{[^}]*\bdist\b[^}]*\}/.test(s), 'dist reaches the model inputs');
  assert.ok(s.indexOf('interpretChartRequest(') < s.indexOf('interpretChat(q,'), 'the new interpreter runs first'); assert.ok(s.includes('viewAfterRequest(') && s.includes("kind: 'view'") && s.includes('undoView') && s.includes('skippedLine(r.skippedList'));
  assert.ok(s.includes('onChartView={isLast && !busy ? commitChartView : null}') && s.includes('commitChartView'), 'only the open result is editable');
  assert.ok(!/refresh|regenerate|rev\.data\./.test(s.slice(s.indexOf('const commitChartView'), s.indexOf('const undoView'))), 'a presentation change never refreshes data');
  const x = read('src/components/smart/ExportDialog.jsx'); assert.ok(x.includes('exportPlan(') && x.includes('How charts appear in the file') && x.includes('كيف ستظهر الرسوم في الملف'));
});
ok('hygiene: no new icon family, no emoji, no forbidden vendor/product wording, no real-figure literals in the new files', () => {
  for (const p of FILES) { const s = read(p); assert.ok(!/hugeicons|@iconify|react-icons|lucide|fontawesome/i.test(s), `${p}: icon family`); assert.ok(!/Najiz|ناجز|Makeen|Incorta|مكين/.test(s), `${p}: wording`); assert.ok(!/[\u{1F300}-\u{1FAFF}✅❌]/u.test(s), `${p}: emoji`); }
  const css = read('src/styles/revenue.css'); const block = css.slice(css.indexOf('CHART PICKER · CUSTOMIZE · TOOLBAR')); assert.ok(block.includes('.cp {') && block.includes('@media (max-width: 640px)') && block.includes('.cp-card__why') && block.includes('body.cp-open'));
});

console.log(`chart-picker-ui: ${n} groups passed`);
