// Generates Word / Excel / PowerPoint files for every fixed report, a detailed Smart-style report and the planning summary on the compact demo,
// plus a JSON of what each model SHOWS on screen, so scripts/export_parity_check.py can verify that every shown item exists in each file.
// usage: node .test-build/export-parity.mjs <outDir>   (bundled by `npm run verify:exports`)
import fs from 'node:fs';
import { Packer } from 'docx';
import * as XLSX from 'xlsx';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { buildCommandModel } from '../src/data/commandModel.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { FIXED_REPORTS } from '../src/data/fixedReports.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { generateFinance } from '../src/data/syntheticFinance.js';
import { fairComparison, DEFAULT_SCENARIO } from '../src/data/strategicCalc.js';
import { createAction } from '../src/data/actionRegister.js';
import { buildDocx, buildWorkbook, exportModelToPptx } from '../src/utils/exportReportModel.js';
import { tableToText } from '../src/data/reportFormat.js';
import { fmtRiyadh } from '../src/data/clock.js';

const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
process.env.DEMO_SIZE = 'compact';
const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const YTD = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' };
const cYtd = snapshot(st, { scope: YTD, cfg });
const prev = snapshot(st, { scope: { from: '2025-01-01', to: '2025-10-09', amanah: 'all', source: 'all' }, cfg });
const mkOut = (snap) => ({ snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'التاريخ لا يكفي', en: 'history too short' } }, targetPos: null, achievement: null, coverage: null, cards: [], anomalies: [] });
const fin = generateFinance(TODAY); const meta = { size: 'compact', counts: { invoicesTotal: st.n } };
const cash = { months: cYtd.byMonth.map((x) => x.month), values: cYtd.byMonth.map((x) => x.collected) };
const models = [];
for (const def of FIXED_REPORTS) models.push({ id: `fixed-${def.key}`, model: buildReportModel({ spec: { ...defaultSpec(TODAY), sections: def.sections, compare: def.compare }, lang: 'ar', out: mkOut(cYtd), prev: def.compare === 'none' ? null : prev, compare: def.compare, prevScope: { from: '2025-01-01', to: '2025-10-09' }, cash, bridge: null, targets: DEFAULT_TARGETS, meta, finance: fin, financeOk: true, fyReceiptsYtd: 8e9 }) });
models.push({ id: 'smart-detailed', model: buildReportModel({ spec: { ...defaultSpec(TODAY), sections: SECTION_ORDER.filter((k) => k !== 'budget'), depth: 'detailed', compare: 'prev_year' }, lang: 'ar', out: mkOut(cYtd), prev, compare: 'prev_year', prevScope: { from: '2025-01-01', to: '2025-10-09' }, cash, bridge: null, targets: DEFAULT_TARGETS, meta }) });
const reg = createAction({ actions: [], rejected: [] }, { by: 'x', fields: { title: 'إجراء يدوي', owner: '', dueDate: '2026-10-30' } });
models.push({ id: 'plan-summary', model: buildCommandModel({ lang: 'ar', today: TODAY, spec: { preset: 'custom', scope: { ...YTD, scopeType: 'all', muni: 'all', status: 'all' } }, out: mkOut(cYtd), prev, prevScope: { from: '2025-01-01', to: '2025-10-09' }, cash, bridge: null, targets: DEFAULT_TARGETS, cases: [], meta, fair: fairComparison(cYtd), achievement: null, pace: { available: false }, forecast: { ready: false, reasonNotReady: { ar: 'لا يكفي', en: 'short' } }, scenario: { ...DEFAULT_SCENARIO, dRate: 5 }, planDate: '2026-12-31', register: reg }) });

// what the model shows on screen: every table row (first cell) and total, chart label, callout / text / list line, insight title, KPI label+value, relations
const shown = (m) => {
  const items = []; const cells = []; const money = []; const add = (kind, text) => { const t = String(text ?? '').trim(); if (t) items.push({ kind, text: t }); };
  const walk = (b) => {
    if (b.type === 'kpis') b.items.forEach((k) => { add('kpi', k.label); add('kpi-value', k.value); });
    else if (b.type === 'table') { const t = tableToText(b, m.lang); add('table-title', b.title); t.rows.forEach((r) => { add('row', r[0]); cells.push(...r.slice(1).map(String)); }); if (t.total) { add('total', t.total[0]); cells.push(...t.total.slice(1).map(String)); }
      b.headers.forEach((h, j) => { if (h.kind === 'money') [...b.rows, ...(b.total ? [b.total] : [])].forEach((r) => { if (typeof r[j] === 'number') money.push(r[j]); }); }); if (b.note) add('note', b.note); }
    else if (b.type === 'chart') { add('chart-title', b.title); b.labels.forEach((l) => add('chart-label', l)); }
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
  await exportModelToPptx(model, `${out}/${id}.pptx`);
  const sh = shown(model); manifest.push({ id, title: model.title, shown: sh.items, cells: sh.cells, money: sh.money });
}
fs.writeFileSync(`${out}/manifest.json`, JSON.stringify(manifest));
console.log(`generated ${manifest.length} models x 3 formats in ${out}`);
