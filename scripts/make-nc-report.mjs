// Builds the «تحليل أسباب عدم التحصيل» report as real files for visual inspection and parity: PowerPoint (supplied templates, Arabic + English) and PDF (headless Chromium, Arabic + English).
// Run: npm run make:nc-report [outDir] [ytd|all]   (default outDir .test-build/nc-report; scope ytd = this year, all = every period since 2000)
// Synthetic data only. The decks are converted with LibreOffice and the PDFs rasterised with poppler by hand/shell (see the report that accompanies the feature).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadStore } from '../server/store.js';
import { list } from '../server/lists.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { buildNcReportModel, NC_APPENDIX_ROWS } from '../src/data/ncReportModel.js';
import { buildPdfHtml, chartTable } from '../src/utils/pdfReport.js';
import { buildTemplatePptx, reportFileName } from '../src/utils/exportReportModel.js';
import { tableToText } from '../src/data/reportFormat.js';

process.env.DEMO_SIZE = 'compact';
const outDir = path.resolve(process.argv[2] || '.test-build/nc-report'); fs.mkdirSync(outDir, { recursive: true });
const TODAY = '2026-11-05'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const scope = { from: process.argv[3] === 'all' ? '2000-01-01' : '2026-01-01', to: TODAY, amanah: 'all', source: 'all' };
const a0 = nonCollectionAnalysis(st, { scope, cfg });
const rows = list(st, { scope, cfg, filters: { nc: {} }, sort: { key: 'outstanding', dir: 'desc' }, page: 0, pageSize: NC_APPENDIX_ROWS, withNc: true });
const analysis = { ...a0, invoices: rows.rows, invoicesTotal: rows.total };
const meta = { version: 1, generatedAt: analysis.generatedAt, cutoff: analysis.cutoff };
const models = { ar: buildNcReportModel(analysis, { lang: 'ar', meta }), en: buildNcReportModel(analysis, { lang: 'en', meta }) };
fs.writeFileSync(path.join(outDir, 'analysis-summary.json'), JSON.stringify({ scope, populations: a0.populations, checks: a0.reconciliation.filter((c) => !c.ok).length, invoices: rows.rows.length, invoicesTotal: rows.total }, null, 1));

// PowerPoint
for (const lang of ['ar', 'en']) {
  const tpl = fs.readFileSync(new URL(`../public/templates/momah-${lang}.pptx`, import.meta.url));
  fs.writeFileSync(path.join(outDir, `nc-${lang}.pptx`), await buildTemplatePptx(models[lang], tpl)); console.log(`${outDir}/nc-${lang}.pptx`);
}

// PDF (same document builder and fonts as scripts/make-report-pdf.mjs)
const fdir = new URL('../node_modules/@fontsource/ibm-plex-sans-arabic/files/', import.meta.url);
const fonts = {}; for (const w of [400, 600, 700]) for (const s of ['arabic', 'latin']) fonts[`${s}-${w}`] = `data:font/woff2;base64,${fs.readFileSync(new URL(`ibm-plex-sans-arabic-${s}-${w}-normal.woff2`, fdir)).toString('base64')}`;
const chrome = [process.env.CHROME_BIN, path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && fs.existsSync(p));
if (!chrome) { console.error('no Chromium found (set CHROME_BIN)'); process.exit(2); }
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const numsOf = (s) => String(s ?? '').match(/\d[\d,]*(?:\.\d+)?/g) || [];
const report = [];
for (const lang of ['ar', 'en']) {
  const m = models[lang]; const base = path.join(outDir, `nc-${lang}`);
  const html = buildPdfHtml(m, { fonts, title: reportFileName(m, 'pdf').replace(/\.pdf$/, '') }); fs.writeFileSync(`${base}.html`, html);
  const render = (htmlFile, pdfFile) => { const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-prof-')); sh(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${prof}`, '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=8000', `--print-to-pdf=${pdfFile}`, `file://${htmlFile}`]); fs.rmSync(prof, { recursive: true, force: true }); if (!fs.existsSync(pdfFile)) { console.error('pdf failed'); process.exit(3); } };
  render(`${base}.html`, `${base}.pdf`);
  fs.writeFileSync(`${base}-noplot.html`, html.replace(/<div class="plot">.*?<\/div>/gs, '')); render(`${base}-noplot.html`, `${base}-noplot.pdf`);
  for (const f of fs.readdirSync(outDir)) if (f.startsWith(`nc-${lang}-p`)) fs.rmSync(path.join(outDir, f));
  sh('pdftoppm', ['-r', '80', '-png', `${base}.pdf`, `${base}-p`]);
  const pages = Number(/Pages:\s+(\d+)/.exec(sh('pdfinfo', [`${base}.pdf`]).stdout)?.[1] || 0);
  const text = sh('pdftotext', ['-enc', 'UTF-8', `${base}-noplot.pdf`, '-']).stdout;
  // numeric parity: every number the model shows (tables, total rows, chart data, KPIs) must occur in the PDF text at least as often
  const cells = []; const add = (...xs) => xs.forEach((x) => { if (x != null && x !== '') cells.push(String(x)); });
  for (const b of [...m.headline, ...m.sections.flatMap((s) => s.blocks)]) {
    if (b.type === 'kpis') b.items.forEach((k) => { add(k.value, k.sub); });
    else if (b.type === 'table') { const t = tableToText(b, lang); t.rows.forEach((r) => add(...r.slice(1))); if (t.total) add(...t.total.slice(1)); }
    else if (b.type === 'chart') chartTable(b, lang).rows.forEach((r) => add(...r.slice(1)));
  }
  const have = new Map(); for (const n of numsOf(text)) have.set(n, (have.get(n) || 0) + 1);
  const need = new Map(); for (const c of cells) for (const n of numsOf(c)) need.set(n, (need.get(n) || 0) + 1);
  let total = 0; let matched = 0; const missing = []; for (const [n, k] of need) { total += k; const h = have.get(n) || 0; matched += Math.min(k, h); if (h < k) missing.push(`${n} (need ${k}, has ${h})`); }
  const res = { lang, pages, numbers: `${matched}/${total}`, missing: missing.slice(0, 10) }; report.push(res); console.log(JSON.stringify(res));
}
fs.writeFileSync(path.join(outDir, 'verify.json'), JSON.stringify(report, null, 1));
