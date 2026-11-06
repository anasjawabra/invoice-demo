// Generates Word / Excel / PowerPoint files for every fixed report, a detailed Smart-style report,
// plus a JSON of what each model SHOWS on screen, so scripts/export_parity_check.py can verify that every shown item exists in each file.
// usage: node .test-build/export-parity.mjs <outDir>   (bundled by `npm run verify:exports`)
import fs from 'node:fs';
import { Packer } from 'docx';
import * as XLSX from 'xlsx';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { FIXED_REPORTS } from '../src/data/fixedReports.js';
import { DEFAULT_TARGETS, DEFAULT_CONFIG } from '../src/data/revenueMetrics.js';
import { forecastReceipts, targetVsForecast } from '../src/data/revenueOutlook.js';
import { buildDocx, buildWorkbook, buildTemplatePptx } from '../src/utils/exportReportModel.js';
import { tableToText } from '../src/data/reportFormat.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { list } from '../server/lists.js';
import { buildNcReportModel, NC_APPENDIX_ROWS } from '../src/data/ncReportModel.js';
import { fmtRiyadh } from '../src/data/clock.js';
import { chartExportTable, chartExactAmounts, isLegacyChart } from '../src/utils/chartExportData.js';
import { exportBlocks, edgeBlocks } from './chart-export-fixtures.mjs';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan: the seed plan is the 2026 reference (what a fresh data service holds)

const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
process.env.DEMO_SIZE = 'compact';
const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const YTD = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' };
const cYtd = snapshot(st, { scope: YTD, cfg });
const prev = snapshot(st, { scope: { from: '2025-01-01', to: '2025-10-09', amanah: 'all', source: 'all' }, cfg });
const mkOut = (snap) => ({ snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'التاريخ لا يكفي', en: 'history too short' } }, targetPos: null, achievement: null, cards: [], anomalies: [] });
const meta = { size: 'compact', counts: { invoicesTotal: st.n } };
const cash = { months: cYtd.byMonth.map((x) => x.month), values: cYtd.byMonth.map((x) => x.collected) };
const models = [];
const withMeta = (m, version) => { m.meta = { version, generatedAt: m.generatedAt, cutoff: m.cutoff }; return m; }; // the deck prints «version · generated · data as of» when model.meta is present
for (const def of FIXED_REPORTS) models.push({ id: `fixed-${def.key}`, model: buildReportModel({ spec: { ...defaultSpec(TODAY), sections: def.sections, compare: def.compare }, lang: 'ar', out: mkOut(cYtd), prev: def.compare === 'none' ? null : prev, compare: def.compare, prevScope: { from: '2025-01-01', to: '2025-10-09' }, cash, bridge: null, targets: DEFAULT_TARGETS, meta }) });
models.push({ id: 'smart-detailed', model: buildReportModel({ spec: { ...defaultSpec(TODAY), sections: SECTION_ORDER, depth: 'detailed', compare: 'prev_year' }, lang: 'ar', out: mkOut(cYtd), prev, compare: 'prev_year', prevScope: { from: '2025-01-01', to: '2025-10-09' }, cash, bridge: null, targets: DEFAULT_TARGETS, meta }) });

// the same detailed report in English (the PowerPoint then uses the English template): its items must be present too
models.push({ id: 'smart-detailed-en', model: withMeta(buildReportModel({ spec: { ...defaultSpec(TODAY), sections: SECTION_ORDER, depth: 'detailed', compare: 'prev_year' }, lang: 'en', out: mkOut(cYtd), prev, compare: 'prev_year', prevScope: { from: '2025-01-01', to: '2025-10-09' }, cash, bridge: null, targets: DEFAULT_TARGETS, meta }), 4) });

// a detailed report WITH a ready forecast and the target position (planning review, Phase 4): the planned-to-date, the baseline forecast, its achievement % and the target's status/version are exported like every other shown item
{ const data = { series: async (req, o = {}) => series(st, { scope: req, cfg: { cutoff: o.asOf || TODAY } }) };
  const fc = await forecastReceipts(data, YTD, { ...DEFAULT_CONFIG, cutoff: TODAY }, { targets: DEFAULT_TARGETS }); const tp = fc.ready ? targetVsForecast(fc, DEFAULT_TARGETS) : null;
  for (const lang of ['ar', 'en']) models.push({ id: `smart-forecast-${lang}`, model: withMeta(buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive'], depth: 'detailed', compare: 'none' }, lang, out: { snapshot: cYtd, forecast: fc, targetPos: tp, achievement: null, cards: [], anomalies: [] }, prev: null, compare: 'none', cash, bridge: null, targets: DEFAULT_TARGETS, meta }), '1') }); }

// a report scoped to ONE reference municipality of the Jeddah Amanah (title, context chip and the municipality table carry its reference name) and the Jeddah Amanah without a municipality filter (explicit «بلا بلدية» / «مباشر على الأمانة» rows)
{ const jdAll = snapshot(st, { scope: { ...YTD, amanah: 'Jeddah Amanah', muni: 'all' }, cfg }); const top = jdAll.byMunicipality.filter((g) => g.status === 'mapped').sort((a, b) => b.count - a.count)[0];
  for (const [id, muni] of [['muni-jeddah-all', 'all'], ['muni-jeddah-one', top.key]]) { const sc = { ...YTD, amanah: 'Jeddah Amanah', muni }; const snapM = snapshot(st, { scope: sc, cfg });
    for (const lang of ['ar', 'en']) models.push({ id: `${id}-${lang}`, model: withMeta(buildReportModel({ spec: { ...defaultSpec(TODAY), scope: { ...defaultSpec(TODAY).scope, ...sc }, sections: ['executive', 'amanah'], depth: 'summary' }, lang, out: mkOut(snapM), prev: null, compare: 'none', cash, bridge: null, targets: DEFAULT_TARGETS, meta }), 5) }); } }

// «تحليل أسباب عدم التحصيل»: the structured analysis (with the supporting-invoice appendix) in both languages
{ const sc = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }; const a0 = nonCollectionAnalysis(st, { scope: sc, cfg }); const rs = list(st, { scope: sc, cfg, filters: { nc: {} }, sort: { key: 'outstanding', dir: 'desc' }, page: 0, pageSize: NC_APPENDIX_ROWS, withNc: true });
  const a = { ...a0, invoices: rs.rows, invoicesTotal: rs.total };
  for (const lang of ['ar', 'en']) models.push({ id: `noncollection-${lang}`, model: withMeta(buildNcReportModel(a, { lang }), 1) }); }

// every chart-library kind (stacked / 100 %, area, combo, pareto, histogram, donut, scatter, bubble, bullet, box, treemap, sunburst, sankey) + the edge blocks that take the picture path, in both languages:
// their data tables (every cell), item labels and exact SAR amounts must be in Word, Excel and PowerPoint exactly like the legacy kinds
for (const lang of ['ar', 'en']) {
  const L = (a, e) => (lang === 'ar' ? a : e); const bl = exportBlocks(lang); const ed = edgeBlocks(lang);
  const sec = (key, title, blocks) => ({ key, title, purpose: '', blocks });
  const m = { lang, title: L('رسوم المكتبة: كل الأنواع', 'Chart library: every kind'), subtitle: '2026-01-01 → 2026-10-09', generatedAt: '2026-11-05T10:00:00.000Z', cutoff: TODAY, synthetic: true, context: [{ label: L('الفترة', 'Period'), value: '2026-01-01 → 2026-10-09' }], headline: [],
    sections: [sec('compare', L('المقارنة', 'Comparison'), ['bar', 'hbar', 'stacked_col', 'stacked100_col', 'stacked100_hbar', 'pareto', 'bullet'].map((k) => bl[k])), sec('trend', L('الاتجاه', 'Trend'), ['line', 'area', 'stacked_area', 'combo'].map((k) => bl[k])),
      sec('composition', L('التركيب', 'Composition'), ['pie', 'donut', 'waterfall', 'stacked_hbar', 'treemap', 'sunburst', 'sankey'].map((k) => bl[k])), sec('distribution', L('التوزيع والعلاقة', 'Distribution and relationship'), ['histogram', 'box', 'scatter', 'bubble', 'heatmap'].map((k) => bl[k])),
      sec('edge', L('حالات حدّية', 'Edge cases'), [ed.area_gap, ed.stacked_area_gap, ed.waterfall_zero, ed.donut_many])] };
  models.push({ id: `chartkinds-${lang}`, model: withMeta(m, 1) });
}

// what the model shows on screen: every table row (first cell) and total, chart label, callout / text / list line, insight title, KPI label+value, relations
const shown = (m) => {
  const items = []; const cells = []; const money = []; const add = (kind, text) => { const t = String(text ?? '').trim(); if (t) items.push({ kind, text: t }); };
  const walk = (b) => {
    if (b.type === 'kpis') b.items.forEach((k) => { add('kpi', k.label); add('kpi-value', k.value); });
    else if (b.type === 'table') { const t = tableToText(b, m.lang); add('table-title', b.title); t.rows.forEach((r) => { add('row', r[0]); cells.push(...r.slice(1).map(String)); }); if (t.total) { add('total', t.total[0]); cells.push(...t.total.slice(1).map(String)); }
      b.headers.forEach((h, j) => { if (h.kind === 'money') [...b.rows, ...(b.total ? [b.total] : [])].forEach((r) => { if (typeof r[j] === 'number') money.push(r[j]); }); }); if (b.note) add('note', b.note); }
    else if (b.type === 'chart') {
      add('chart-title', b.title); (b.labels || []).forEach((l) => add('chart-label', l));
      if (!isLegacyChart(b)) { const t = chartExportTable(b, m.lang); t.rows.forEach((r) => { add('chart-row', r[0]); cells.push(...r.slice(1).map(String)); }); chartExactAmounts(b).forEach(([, , v]) => money.push(v)); } // the kind's own table: every cell, every exact SAR amount
    }
    else if (b.type === 'callout' || b.type === 'text') add(b.type, b.text);
    else if (b.type === 'list') b.items.forEach((x) => add('list', x));
    else if (b.type === 'insights') b.items.forEach((i) => add('insight', typeof i.title === 'string' ? i.title : i.title[m.lang]));
    else if (b.type === 'relations') { add('relations', m.lang === 'ar' ? 'نسبة التحصيل' : 'Collection rate'); add('relations', m.lang === 'ar' ? 'نسبة الاستبعاد' : 'Exclusion rate'); }
  };
  m.headline.forEach(walk); m.sections.forEach((s) => { add('section', s.title); s.blocks.forEach(walk); });
  m.context.forEach((c) => { add('context-label', c.label); add('context-value', c.value); });
  add('cutoff', m.cutoff); add('prepared', fmtRiyadh(m.generatedAt)); // the cut-off date and the Riyadh-time stamp are part of every export
  return { items, cells, money };
};
const manifest = [];
for (const { id, model } of models) {
  fs.writeFileSync(`${out}/${id}.docx`, await Packer.toBuffer(buildDocx(model)));
  XLSX.writeFile(buildWorkbook(model), `${out}/${id}.xlsx`);
  fs.writeFileSync(`${out}/${id}.pptx`, await buildTemplatePptx(model, fs.readFileSync(new URL(`../public/templates/momah-${model.lang === 'ar' ? 'ar' : 'en'}.pptx`, import.meta.url))));
  const sh = shown(model); manifest.push({ id, title: model.title, shown: sh.items, cells: sh.cells, money: sh.money });
}
fs.writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest));
console.log(`generated ${manifest.length} models x 3 formats in ${out}`);
