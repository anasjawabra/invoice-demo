// Builds the chart-library export artefacts for LOOKING at them and for structure checks: a PowerPoint deck and a PDF with EVERY chart kind, in Arabic and English.
//   npm run make:chartdecks [outDir]      (default .test-build/chart-decks)
// The PNG fallbacks of the picture slides are rasterised by a headless Chromium (CHROME_BIN, the Playwright cache or Google Chrome) so the decks carry real PNGs; without Chromium the SVG is
// embedded with a placeholder PNG (what the Node tests do). Outputs: chartkinds-{ar,en}.pptx / .html / .pdf. Rendering the decks (LibreOffice) is done by the caller, see docs/smart-reports-export.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { buildReportModel } from '../src/data/reportModel.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { buildTemplatePptx, reportFileName } from '../src/utils/exportReportModel.js';
import { buildPdfHtml } from '../src/utils/pdfReport.js';
import { exportBlocks, edgeBlocks } from './chart-export-fixtures.mjs';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan: the seed plan is the 2026 reference (what a fresh data service holds)

process.env.DEMO_SIZE = 'compact';
const outDir = path.resolve(process.argv[2] || '.test-build/chart-decks'); fs.mkdirSync(outDir, { recursive: true });
const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const cYtd = snapshot(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg });
const mkOut = (snap) => ({ snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'التاريخ لا يكفي', en: 'history too short' } }, targetPos: null, achievement: null, cards: [], anomalies: [] });
const meta = { size: 'compact', counts: { invoicesTotal: st.n } };
const cash = { months: cYtd.byMonth.map((x) => x.month), values: cYtd.byMonth.map((x) => x.collected) };

const findChrome = () => [process.env.CHROME_BIN, path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => p && fs.existsSync(p));
const chrome = findChrome();
// SVG → PNG with headless Chromium (2x). Returns null when no Chromium is installed.
function rasterize(svg, w, h) {
  if (!chrome) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-png-')); const f = path.join(dir, 'c.svg'); const o = path.join(dir, 'c.png');
  fs.writeFileSync(f, svg);
  spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${path.join(dir, 'prof')}`, '--hide-scrollbars', '--force-device-scale-factor=2', `--window-size=${Math.ceil(w)},${Math.ceil(h)}`, `--screenshot=${o}`, `file://${f}`], { encoding: 'utf8' });
  const png = fs.existsSync(o) ? new Uint8Array(fs.readFileSync(o)) : null; fs.rmSync(dir, { recursive: true, force: true }); return png;
}
const sec = (key, title, blocks) => ({ key, title, purpose: '', blocks });
function modelFor(lang) {
  const L = (a, e) => (lang === 'ar' ? a : e); const bl = exportBlocks(lang); const ed = edgeBlocks(lang);
  const base = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive'], depth: 'summary', compare: 'none' }, lang, out: mkOut(cYtd), prev: null, compare: 'none', cash, bridge: null, targets: DEFAULT_TARGETS, meta });
  const pick = (...ks) => ks.map((k) => bl[k]);
  return { ...base, meta: { version: 1, generatedAt: base.generatedAt, cutoff: base.cutoff }, headline: [], sections: [
    sec('compare', L('المقارنة', 'Comparison'), pick('bar', 'hbar', 'stacked_col', 'stacked100_col', 'stacked100_hbar', 'pareto', 'bullet')),
    sec('trend', L('الاتجاه', 'Trend'), pick('line', 'area', 'stacked_area', 'combo')),
    sec('composition', L('التركيب', 'Composition'), pick('pie', 'donut', 'waterfall', 'stacked_hbar', 'treemap', 'sunburst', 'sankey')),
    sec('distribution', L('التوزيع والعلاقة', 'Distribution and relationship'), pick('histogram', 'box', 'scatter', 'bubble', 'heatmap')),
    sec('edge', L('حالات حدّية', 'Edge cases'), [ed.area_gap, ed.stacked_area_gap, ed.waterfall_zero, ed.donut_many])
  ] };
}
const fdir = new URL('../node_modules/@fontsource/ibm-plex-sans-arabic/files/', import.meta.url);
const fonts = {}; for (const w of [400, 600, 700]) for (const s of ['arabic', 'latin']) fonts[`${s}-${w}`] = `data:font/woff2;base64,${fs.readFileSync(new URL(`ibm-plex-sans-arabic-${s}-${w}-normal.woff2`, fdir)).toString('base64')}`;
for (const lang of ['ar', 'en']) {
  const model = modelFor(lang); const base = path.join(outDir, `chartkinds-${lang}`);
  const bytes = await buildTemplatePptx(model, fs.readFileSync(new URL(`../public/templates/momah-${lang}.pptx`, import.meta.url)), { rasterize: chrome ? (svg, w, h) => rasterize(svg, w, h) : undefined });
  fs.writeFileSync(`${base}.pptx`, bytes); console.log(`${base}.pptx (${Math.round(bytes.length / 1024)} KB, PNG fallbacks ${chrome ? 'rasterised by Chromium' : 'PLACEHOLDER (no Chromium)'})`);
  if (chrome) {
    fs.writeFileSync(`${base}.html`, buildPdfHtml(model, { fonts, title: reportFileName(model, 'pdf').replace(/\.pdf$/, '') }));
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-prof-'));
    spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${prof}`, '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=8000', `--print-to-pdf=${base}.pdf`, `file://${base}.html`], { encoding: 'utf8' }); fs.rmSync(prof, { recursive: true, force: true });
    console.log(fs.existsSync(`${base}.pdf`) ? `${base}.pdf` : 'PDF FAILED');
  }
}
