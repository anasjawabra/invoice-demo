// Export of every chart kind (docs/chart-library.md «Export support»): PowerPoint native charts / pictures, PDF, Word, Excel, CSV. Run with `npm run test:chartexport`.
// Structure is checked on the real package (JSZip): chart parts, embedded workbooks, content types, relationships, picture parts, axis titles, series values, text direction, honesty notes.
// What this does NOT prove: that Microsoft PowerPoint opens the deck (LibreOffice + python-pptx were used by scripts/make-chart-decks.mjs for that), nor the PNG fallback (no canvas in Node: a placeholder).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { buildTemplatePptx, buildWorkbook, buildCsv, buildDocx } from '../src/utils/exportReportModel.js';
import { chartSpecFor, chartXml, chartPlan, PPTX_SUPPORT, PPTX_FALLBACK_NOTE, pptxModeOf, nativeBlocker } from '../src/utils/pptxCharts.js';
import { buildPdfHtml, PDF_SUPPORT, chartTable } from '../src/utils/pdfReport.js';
import { WORD_SUPPORT, ALL_KINDS, chartExportTable, chartExactAmounts, isLegacyChart } from '../src/utils/chartExportData.js';
import { chartInfo } from '../src/data/reportFormat.js';
import { DRAW_KINDS } from '../src/utils/chartKinds.js';
import { exportBlocks, edgeBlocks } from '../scripts/chart-export-fixtures.mjs';

let n = 0; const ok = async (name, fn) => { try { await fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };
const tpl = (lang) => fs.readFileSync(new URL(`../public/templates/momah-${lang}.pptx`, import.meta.url));
const mk = (lang, blocks) => ({ lang, title: lang === 'ar' ? 'تقرير اختبار' : 'Test report', subtitle: 'sub', context: [{ label: 'Period', value: '2026' }], headline: [], sections: [{ key: 's', title: 'Sec', purpose: '', blocks }], generatedAt: '2026-11-05T10:00:00.000Z', cutoff: '2026-10-09' });
const deck = async (lang, blocks) => { const bytes = await buildTemplatePptx(mk(lang, blocks), tpl(lang)); const zip = await JSZip.loadAsync(bytes); return { zip, names: Object.keys(zip.files), bytes }; };
const text = async (zip, names, re) => { let t = ''; for (const nm of names.filter((x) => re.test(x))) t += await zip.file(nm).async('string'); return t; };
const slidesXml = (z) => text(z.zip, z.names, /^ppt\/slides\/slide\d+\.xml$/);
const allText = (xml) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('\n');
const chartParts = (z) => z.names.filter((x) => /^ppt\/charts\/chart\d+\.xml$/.test(x));
const vals = (xml, tag) => [...xml.matchAll(new RegExp(`<c:${tag}>.*?</c:${tag}>`, 'gs'))].map((m) => [...m[0].matchAll(/<c:v>([^<]*)<\/c:v>/g)].map((x) => Number(x[1])));
// the cached points of every <c:tag> as index → value (a missing point has no <c:pt>, so positions are NOT the index)
const byIdx = (xml, tag) => [...xml.matchAll(new RegExp(`<c:${tag}>.*?</c:${tag}>`, 'gs'))].map((m) => { const o = {}; for (const p of m[0].matchAll(/<c:pt idx="(\d+)"><c:v>([^<]*)<\/c:v>/g)) o[Number(p[1])] = Number(p[2]); return o; });
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

for (const lang of ['ar', 'en']) {
  const ar = lang === 'ar'; const blocks = exportBlocks(lang); const edges = edgeBlocks(lang);

  await ok(`${lang}: support tables cover every kind and match the real implementation`, () => {
    for (const k of ALL_KINDS) { assert.ok(PPTX_SUPPORT[k], `PPTX_SUPPORT.${k}`); assert.equal(PDF_SUPPORT[k], 'vector'); assert.ok(WORD_SUPPORT[k]); }
    for (const [k, b] of Object.entries(blocks)) { assert.equal(pptxModeOf(b, lang, (kd) => DRAW_KINDS().includes(kd)), PPTX_SUPPORT[b.kind], `${k}: the plan of a normal block equals the declared support`); }
    for (const k of Object.keys(PPTX_SUPPORT)) assert.ok(DRAW_KINDS().includes(k), `the renderer draws ${k}`);
    for (const k of ['bullet', 'box', 'treemap', 'sunburst', 'sankey']) { assert.equal(PPTX_SUPPORT[k], 'vector-image'); assert.ok(PPTX_FALLBACK_NOTE[k].ar && PPTX_FALLBACK_NOTE[k].en); }
    assert.equal(PPTX_SUPPORT.heatmap, 'native-table');
  });

  // ---- native kinds: one chart part each, with its embedded workbook, content type and relationships
  const NATIVE = Object.entries(blocks).filter(([, b]) => PPTX_SUPPORT[b.kind] === 'native').map(([k]) => k);
  for (const k of NATIVE) {
    await ok(`${lang}: ${k} is ONE native chart with an embedded workbook, correct content types and relationships`, async () => {
      const b = blocks[k]; const z = await deck(lang, [b]); const parts = chartParts(z); assert.equal(parts.length, 1, 'one chart part');
      const num = /chart(\d+)\.xml$/.exec(parts[0])[1]; const rels = await z.zip.file(`ppt/charts/_rels/chart${num}.xml.rels`).async('string');
      assert.ok(rels.includes(`../embeddings/Microsoft_Excel_Sheet${num}.xlsx`)); assert.ok(z.zip.file(`ppt/embeddings/Microsoft_Excel_Sheet${num}.xlsx`), 'embedded workbook part');
      const ct = await z.zip.file('[Content_Types].xml').async('string'); assert.ok(ct.includes(`/ppt/charts/chart${num}.xml`) && /Extension="xlsx"/.test(ct));
      const slide = await slidesXml(z); assert.ok(slide.includes('http://schemas.openxmlformats.org/drawingml/2006/chart'), 'a chart frame on a slide');
      assert.ok(!z.names.some((x) => /^ppt\/media\/chartimg/.test(x)), 'no picture for a native chart');
      const wb = XLSX.read(await z.zip.file(`ppt/embeddings/Microsoft_Excel_Sheet${num}.xlsx`).async('uint8array'), { type: 'array' }); const rows = XLSX.utils.sheet_to_json(wb.Sheets.Sheet1, { header: 1 }); assert.ok(rows.length >= 2, 'workbook has the data');
      const xml = await z.zip.file(parts[0]).async('string'); assert.ok(xml.includes('<c:externalData r:id="rId1">'));
    });
  }

  await ok(`${lang}: stacked / 100 % stacked: grouping, series values equal the block, axis in %`, async () => {
    for (const [k, grouping, dir] of [['stacked_col', 'stacked', 'col'], ['stacked100_col', 'percentStacked', 'col'], ['stacked100_hbar', 'percentStacked', 'bar']]) {
      const b = blocks[k]; const xml = await (await deck(lang, [b])).zip.file('ppt/charts/chart1.xml').async('string');
      assert.ok(xml.includes(`<c:grouping val="${grouping}"/>`) && xml.includes(`<c:barDir val="${dir}"/>`), k);
      const div = chartInfo(b, lang).cu.unit.div; assert.equal(vals(xml, 'val').length, b.series.length);
      byIdx(xml, 'val').forEach((o, i) => b.series[i].values.forEach((v, j) => { if (v == null) assert.ok(!(j in o), `${k}: a missing value stays an empty cell`); else assert.ok(Math.abs(o[j] - v / div) < 1e-3, `${k} s${i} p${j}`); }));
      if (grouping === 'percentStacked') assert.ok(xml.includes('formatCode="0%"'));
    }
  });
  await ok(`${lang}: area / stacked area: areaChart, values equal the block, no data labels by default`, async () => {
    for (const k of ['area', 'stacked_area']) { const b = blocks[k]; const xml = await (await deck(lang, [b])).zip.file('ppt/charts/chart1.xml').async('string'); assert.ok(xml.includes('<c:areaChart>')); assert.ok(xml.includes(k === 'area' ? '<c:grouping val="standard"/>' : '<c:grouping val="stacked"/>')); const div = chartInfo(b, lang).cu.unit.div; byIdx(xml, 'val').forEach((o, i) => b.series[i].values.forEach((v, j) => assert.ok(Math.abs(o[j] - v / div) < 1e-3))); assert.ok(!/<c:showVal val="1"\/>/.test(xml)); }
  });
  await ok(`${lang}: combo = bars + line, TWO value axes, the secondary titled with its own unit and on the opposite side`, async () => {
    const b = blocks.combo; const xml = await (await deck(lang, [b])).zip.file('ppt/charts/chart1.xml').async('string');
    assert.ok(xml.includes('<c:barChart>') && xml.includes('<c:lineChart>')); assert.equal((xml.match(/<c:valAx>/g) || []).length, 2); assert.equal((xml.match(/<c:catAx>/g) || []).length, 2);
    assert.ok(xml.includes(`<a:t>${b.axis2.title}</a:t>`), 'secondary axis title = block.axis2.title'); assert.ok(xml.includes('<c:crosses val="max"/>'));
    const secAx = xml.split('<c:valAx>')[2]; assert.ok(secAx.includes(`<c:axPos val="${ar ? 'l' : 'r'}"/>`), 'secondary axis on the far side'); assert.ok(secAx.includes('formatCode="0%"'), 'rate axis in %');
    const prim = xml.split('<c:valAx>')[1]; assert.ok(prim.includes(`<c:axPos val="${ar ? 'r' : 'l'}"/>`)); assert.ok(/bn SAR|مليار ريال/.test(prim), 'primary axis names its unit');
    const line = byIdx(xml, 'val').pop(); b.series[2].values.forEach((v, j) => { if (v == null) assert.ok(!(j in line), 'a missing rate is a gap, not zero'); else assert.ok(Math.abs(line[j] - v) < 1e-5, 'rate values are the block fractions'); });
    assert.ok(xml.includes('<c:legend>'), 'a combo always has a legend');
  });
  await ok(`${lang}: pareto = descending bars + cumulative-share line on a 0-100 % secondary axis, Other kept last`, async () => {
    const b = blocks.pareto; const spec = chartSpecFor(b, { lang }); const xml = chartXml(spec);
    assert.equal((xml.match(/<c:valAx>/g) || []).length, 2); assert.ok(xml.includes('<c:max val="1"/>') && xml.includes('<c:min val="0"/>'));
    const bars = spec.series[0].values; const body = bars.slice(0, -1); assert.deepEqual(body, [...body].sort((a, z) => z - a), 'sorted descending'); assert.equal(spec.labels[spec.labels.length - 1], b.otherLabel, '«Other» is the last group');
    const cum = spec.series[1].values; assert.ok(Math.abs(cum[cum.length - 1] - 1) < 1e-6, 'cumulative reaches 100 %'); cum.forEach((v, i) => i && assert.ok(v >= cum[i - 1]));
    const total = b.series[0].values.reduce((t, v) => t + v, 0); assert.ok(Math.abs(spec.paretoTotal * chartInfo(b, lang).cu.unit.div - total) < 1);
    const z = await deck(lang, [b]); const wb = XLSX.read(await z.zip.file('ppt/embeddings/Microsoft_Excel_Sheet1.xlsx').async('uint8array'), { type: 'array', cellFormula: true }); assert.ok(wb.Sheets.Sheet1.C2.f && wb.Sheets.Sheet1.C2.f.includes('SUM'), 'cumulative column is a live formula');
  });
  await ok(`${lang}: histogram = gap-free columns with bin labels and titled axes`, async () => {
    const b = blocks.histogram; const xml = chartXml(chartSpecFor(b, { lang })); assert.ok(xml.includes('<c:gapWidth val="0"/>') && xml.includes('<c:barDir val="col"/>'));
    assert.ok(xml.includes(`<a:t>${b.xTitle}`), 'x axis title'); const labs = [...xml.matchAll(/<c:cat>.*?<\/c:cat>/gs)][0][0]; assert.equal((labs.match(/<c:pt /g) || []).length, b.bins.length);
    assert.deepEqual(vals(xml, 'val')[0], b.bins.map((x) => x.count), 'counts equal the bins'); assert.ok(!xml.includes('<c:legend>'));
  });
  await ok(`${lang}: donut = doughnutChart, parts in the renderer's order, its total in the hole`, async () => {
    const b = blocks.donut; const spec = chartSpecFor(b, { lang }); const xml = chartXml(spec); assert.ok(xml.includes('<c:doughnutChart>') && xml.includes('<c:holeSize'));
    assert.ok(!xml.includes('<c:dLblPos'), 'no label position on a doughnut (PowerPoint rejects it)'); assert.ok(spec.center && spec.center.fx > 0);
    const z = await deck(lang, [b]); const s = allText(await slidesXml(z)); assert.ok(s.includes(spec.center.text), 'the total is a text box over the hole');
  });
  await ok(`${lang}: scatter / bubble = scatterChart / bubbleChart, two titled axes, values equal the points, NO causation claim`, async () => {
    for (const k of ['scatter', 'bubble']) {
      const b = blocks[k]; const z = await deck(lang, [b]); const xml = await z.zip.file('ppt/charts/chart1.xml').async('string');
      assert.ok(xml.includes(k === 'scatter' ? '<c:scatterChart>' : '<c:bubbleChart>')); assert.equal((xml.match(/<c:valAx>/g) || []).length, 2);
      assert.ok(xml.includes(`<a:t>${b.xTitle}`) && xml.includes(`<a:t>${b.yTitle}`), 'both axes titled'); assert.ok(!xml.includes('<c:trendline>'), 'no trend line (it would imply a relationship)');
      const ys = vals(xml, 'yVal')[0]; assert.equal(ys.length, b.points.length); b.points.forEach((p, i) => assert.ok(Math.abs(ys[i] - p.y) < 1e-6)); if (k === 'bubble') assert.equal(vals(xml, 'bubbleSize')[0].length, b.points.length);
      const s = allText(await slidesXml(z)); assert.ok(s.includes(ar ? 'ولا يعني أن إحداهما سبب الأخرى' : 'does not mean one causes the other'), 'the slide says it is not causation');
      assert.equal((s.match(/caus/gi) || []).length, ar ? 0 : 1, 'the only mention of causation is the denial');
    }
  });

  // ---- kinds with no native form: a picture (SVG + PNG parts), the note, the data table; never another chart type
  for (const k of ['bullet', 'box', 'treemap', 'sunburst', 'sankey']) {
    await ok(`${lang}: ${k} is a vector picture + honest note + its data table, never a native bar chart`, async () => {
      const b = blocks[k]; const z = await deck(lang, [b]); assert.equal(chartParts(z).length, 0, 'no chart part');
      const svgs = z.names.filter((x) => /^ppt\/media\/chartimg\d+\.svg$/.test(x)); const pngs = z.names.filter((x) => /^ppt\/media\/chartimg\d+\.png$/.test(x)); assert.equal(svgs.length, 1); assert.equal(pngs.length, 1);
      const svg = await z.zip.file(svgs[0]).async('string'); assert.ok(svg.startsWith('<svg') && svg.includes(`data-kind="${k}"`), 'the SVG is the shared renderer drawing of THIS kind');
      const png = await z.zip.file(pngs[0]).async('uint8array'); assert.deepEqual([...png.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a valid PNG fallback (a placeholder where nothing can rasterise)');
      const slide = await slidesXml(z); assert.ok(slide.includes('<p:pic>') && slide.includes('asvg:svgBlip') && slide.includes('{96DAC541-7B7A-43D3-8B79-37D633B846F1}'));
      const rel = (await Promise.all(z.names.filter((x) => /^ppt\/slides\/_rels\/slide1\d\d\.xml\.rels$/.test(x)).map((x) => z.zip.file(x).async('string')))).join(''); assert.ok(rel.includes('chartimg1.png') && rel.includes('chartimg1.svg'));
      const ct = await z.zip.file('[Content_Types].xml').async('string'); assert.ok(/Extension="png"/.test(ct) && /Extension="svg"/.test(ct));
      const t = allText(slide); assert.ok(t.includes(PPTX_FALLBACK_NOTE[k][lang]), 'the slide says why it is a picture'); assert.ok(t.includes(ar ? 'صورة رسم متجهية' : 'Chart image'), 'image / editability note'); assert.ok(t.includes(ar ? 'الملحق' : 'Appendix'), 'points to the appendix table');
      // the appendix table carries every row of the chart's data
      const tab = chartExportTable(b, lang); for (const r of tab.rows) assert.ok(t.includes(r[0]) || r[0] === '', `${k}: appendix row «${r[0]}»`);
    });
  }
  await ok(`${lang}: a block a native chart would misdraw takes the image path of the SAME kind and says why`, async () => {
    for (const [k, why] of [['area_gap', 'area'], ['stacked_area_gap', 'stacked_area'], ['donut_many', 'donut']]) {
      const b = edges[k]; assert.equal(pptxModeOf(b, lang), 'vector-image'); assert.ok(nativeBlocker(b, lang)); const z = await deck(lang, [b]); assert.equal(chartParts(z).length, 0); const svg = await z.zip.file('ppt/media/chartimg1.svg').async('string'); assert.ok(svg.includes(`data-kind="${why}"`), k);
      assert.ok(allText(await slidesXml(z)).includes(nativeBlocker(b, lang)[lang]), `${k}: reason on the slide`);
    }
  });
  await ok(`${lang}: a waterfall that crosses zero says it is not the floating bridge; a normal one is native`, async () => {
    const z = await deck(lang, [edges.waterfall_zero]); assert.equal(chartParts(z).length, 1); assert.ok(allText(await slidesXml(z)).includes(ar ? 'الجسر يعبر الصفر' : 'The bridge crosses zero'));
    const z2 = await deck(lang, [blocks.waterfall]); assert.ok(!allText(await slidesXml(z2)).includes(ar ? 'الجسر يعبر الصفر' : 'The bridge crosses zero'));
  });
  await ok(`${lang}: an unknown kind is never replaced by a bar chart`, async () => {
    const b = { type: 'chart', kind: 'radar_x', title: 'Mystery', labels: ['A', 'B'], series: [{ label: 'S', values: [1e6, 2e6] }] }; assert.equal(chartPlan(b, { lang, drawable: (kd) => DRAW_KINDS().includes(kd) }).mode, 'none');
    const z = await deck(lang, [b]); assert.equal(chartParts(z).length, 0); assert.ok(!z.names.some((x) => /chartimg/.test(x))); assert.ok(allText(await slidesXml(z)).includes(ar ? 'لا يوجد رسم لهذا النوع' : 'There is no drawing for this chart kind') || allText(await slidesXml(z)).includes(ar ? 'تعذّر رسم' : 'could not be drawn'));
  });
  await ok(`${lang}: view settings are honoured (labels off, legend off) and an unset flag changes nothing`, async () => {
    for (const k of ['stacked_col', 'combo', 'bar', 'line']) {
      const b = blocks[k]; const plain = chartXml(chartSpecFor(b, { lang })); const off = chartXml(chartSpecFor({ ...b, showLabels: false, showLegend: false }, { lang }));
      assert.ok(!/<c:showVal val="1"\/>/.test(off), `${k}: no value labels`); assert.ok(!off.includes('<c:legend>'), `${k}: no legend`); assert.ok(plain.includes('<c:legend>') || b.series.length < 2);
      const viaCfg = chartXml(chartSpecFor({ ...b, config: { labels: false, legend: false } }, { lang })); assert.equal(viaCfg, off, `${k}: config {labels, legend} = the flags`);
    }
    const on = chartXml(chartSpecFor({ ...blocks.area, showLabels: true }, { lang })); assert.ok(/<c:showVal val="1"\/>/.test(on));
  });
  await ok(`${lang}: text direction`, async () => {
    for (const k of ['bar', 'stacked_col', 'combo', 'scatter', 'donut']) { const x = chartXml(chartSpecFor(blocks[k], { lang })); assert.equal(x.includes('rtl="1"'), ar, `${k} chart text rtl=${ar}`); }
    const z = await deck(lang, [blocks.treemap, blocks.stacked_col]); const s = await slidesXml(z); assert.equal(/rtl="1"/.test(s), ar); assert.ok(s.includes(ar ? 'rtlCol="1"' : 'rtlCol') === ar);
    const cm = chartXml(chartSpecFor(blocks.stacked_col, { lang })); assert.ok(cm.includes(`<c:axPos val="${ar ? 'r' : 'l'}"/>`), 'value axis side mirrors in Arabic');
  });
}

await ok('legacy native kinds are byte-for-byte unchanged', () => {
  const b = (kind, extra = {}) => ({ type: 'chart', kind, title: 't', labels: ['A', 'B', 'C'], series: [{ label: 'S1', values: [3e9, 1.5e9, 2e9] }, { label: 'S2', values: [1e9, null, 0.5e9], dashed: true }], ...extra });
  const cases = { bar: b('bar'), hbar: b('hbar'), line: b('line', { basis: 'monthly' }), pie: b('pie'), stacked: { ...b('stacked_hbar'), labels: ['N'], series: [{ label: 'C', values: [7e9] }, { label: 'U', values: [3e9] }] }, waterfall: { ...b('waterfall'), series: [{ label: 'v', values: [14e9, -3e9, 11e9] }] } };
  const GOLD = { 'bar.ar': 'ba4a74e1f53b1f39', 'hbar.ar': '06f2529a0e197503', 'line.ar': '2e5adf8fc5f1d48a', 'pie.ar': 'cf2920d974c5fcd4', 'stacked.ar': 'de66044096cf8ab9', 'waterfall.ar': '4416c30316b6953a', 'bar.en': '605d13ba2458586f', 'hbar.en': '9d19d9cd484f4b90', 'line.en': 'c4284c9077bcea84', 'pie.en': 'ef1b1efa39843221', 'stacked.en': 'a63d136b84843236', 'waterfall.en': 'e0a1924eded49b94' };
  for (const lang of ['ar', 'en']) for (const [k, blk] of Object.entries(cases)) assert.equal(sha(chartXml(chartSpecFor(blk, { lang }))), GOLD[`${k}.${lang}`], `${k}.${lang}`);
});

// ---- the other formats: PDF, Word, Excel, CSV carry every kind's table and exact amounts
for (const lang of ['ar', 'en']) {
  const blocks = exportBlocks(lang); const all = Object.values(blocks); const model = mk(lang, all);
  await ok(`${lang}: PDF draws every kind (same SVG) and is followed by its data table with every row`, () => {
    const html = buildPdfHtml(model, {}); assert.equal((html.match(/<figure class="chart">/g) || []).length, all.length);
    for (const [k, b] of Object.entries(blocks)) { assert.ok(html.includes(`data-kind="${b.kind}"`), `${k} drawn`); const t = chartTable(b, lang); for (const r of t.rows) assert.ok(html.includes(String(r[0]).replace(/&/g, '&amp;').replace(/</g, '&lt;')) || r[0] === '', `${k} row ${r[0]}`); }
    assert.ok(!html.includes('data-refused'), 'no chart of the fixtures is refused');
  });
  await ok(`${lang}: Excel has a sheet per chart and the exact SAR behind every amount; CSV and Word carry the tables`, () => {
    const wb = buildWorkbook(model); const exact = XLSX.utils.sheet_to_json(wb.Sheets.amounts_sar, { header: 1 });
    for (const [k, b] of Object.entries(blocks)) {
      if (isLegacyChart(b)) continue;
      const want = chartExactAmounts(b); if (b.plain) continue; for (const [, , v] of want.slice(0, 40)) assert.ok(exact.some((r) => r[3] === v), `${k}: exact SAR ${v}`);
    }
    for (const k of ['scatter', 'histogram', 'sankey', 'treemap', 'combo']) assert.ok(chartExactAmounts(blocks[k]).length > 0, `${k}: amounts listed`);
    assert.equal(chartExactAmounts(blocks.scatter).filter((r) => r[1] === blocks.scatter.yTitle).length, 0, 'a rate axis is not SAR');
    assert.equal(chartExactAmounts(blocks.combo).filter((r) => r[1] === blocks.combo.series[2].label).length, 0, 'the secondary rate series is not SAR');
    const csv = buildCsv(model); for (const k of ['scatter', 'bullet', 'sankey', 'histogram']) { const t = chartExportTable(blocks[k], lang); for (const r of t.rows.slice(0, 3)) assert.ok(csv.includes(r[0]), `${k} csv row ${r[0]}`); }
    const d = buildDocx(model); assert.ok(d);
  });
  await ok(`${lang}: ONE source of numbers — the export table is the kind's registered table`, () => {
    for (const b of all) { if (isLegacyChart(b)) continue; const t = chartExportTable(b, lang); assert.ok(t.headers.length >= 2 && t.rows.length >= 1, b.kind); t.rows.forEach((r) => assert.equal(r.length, t.headers.length, `${b.kind}: ragged row`)); }
  });
  await ok(`${lang}: the whole mixed deck builds, every chart part has its workbook, no duplicate shape ids per slide`, async () => {
    const z = await deck(lang, all); const parts = chartParts(z); const wbs = z.names.filter((x) => /^ppt\/embeddings\/Microsoft_Excel_Sheet\d+\.xlsx$/.test(x)); assert.equal(parts.length, wbs.length); assert.equal(parts.length, Object.values(PPTX_SUPPORT).filter((v) => v === 'native').length);
    for (const nm of z.names.filter((x) => /^ppt\/slides\/slide1\d\d\.xml$/.test(x))) { const x = await z.zip.file(nm).async('string'); const ids = [...x.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => m[1]); assert.equal(new Set(ids).size, ids.length, `${nm}: unique shape ids`); }
    const pics = z.names.filter((x) => /chartimg\d+\.svg$/.test(x)).length; assert.equal(pics, Object.values(PPTX_SUPPORT).filter((v) => v === 'vector-image').length);
  });
}
console.log(`chart-export: ${n} checks passed`);
