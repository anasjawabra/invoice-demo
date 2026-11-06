// Builds the printed-report PDF (Arabic and English) of a rich synthetic report with a headless Chromium, then VERIFIES it:
// page count, embedded fonts (pdffonts), selectable text (pdftotext), no blank/near-blank pages (ink per page), numeric parity with the model.
// Run: npm run make:report-pdf [outDir]   (outputs report-{ar,en}.html / .pdf / page PNGs into outDir, default .test-build/report-pdf)
// Chromium: CHROME_BIN, else the Playwright cache (~/Library/Caches/ms-playwright), else Google Chrome. Needs poppler (pdftotext, pdffonts, pdftoppm).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { defaultSpec } from '../src/data/reportIntents.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { buildPdfHtml, chartTable } from '../src/utils/pdfReport.js';
import { reportFileName } from '../src/utils/exportReportModel.js';
import { tableToText } from '../src/data/reportFormat.js';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan: the seed plan is the 2026 reference (what a fresh data service holds)

process.env.DEMO_SIZE = 'compact';
const outDir = path.resolve(process.argv[2] || '.test-build/report-pdf'); fs.mkdirSync(outDir, { recursive: true });
const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const cYtd = snapshot(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg });
const prev = snapshot(st, { scope: { from: '2025-01-01', to: '2025-10-09', amanah: 'all', source: 'all' }, cfg });
const mkOut = (snap) => ({ snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'التاريخ لا يكفي', en: 'history too short' } }, targetPos: null, achievement: null, cards: [], anomalies: [] });
const meta = { size: 'compact', counts: { invoicesTotal: st.n } };
const cash = { months: cYtd.byMonth.map((x) => x.month), values: cYtd.byMonth.map((x) => x.collected) };

// a stress section (synthetic): a 70-row table that must break across pages with a repeating header, a long-title table and a many-column table
function stress(lang) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  const rows = Array.from({ length: 70 }, (_, i) => [`${L('بلدية اختبار', 'Test municipality')} ${i + 1}`, 1_000_000 * (i + 3) + i * 137, 800_000 * (i + 3), 0.5 + (i % 40) / 100, i * 11 + 7]);
  const wide = Array.from({ length: 12 }, (_, i) => [`${L('بند', 'Item')} ${i + 1}`, ...Array.from({ length: 9 }, (_, k) => (i + 1) * (k + 2) * 12345.6)]);
  return { key: 'stress', title: L('ملحق اختباري: جداول طويلة وعريضة (بيانات اصطناعية)', 'Test appendix: long and wide tables (synthetic data)'), purpose: L('قسم اصطناعي لفحص تكرار رأس الجدول وانكسار الصفحات وعدم تقطيع الأرقام.', 'A synthetic section that exercises repeating table headers, page breaks and unbroken numbers.'), blocks: [
    { type: 'table', id: 'stress-long', title: L('جدول طويل يمتد على عدة صفحات: صافي المفوتر والمحصّل ونسبة التحصيل حسب البلدية', 'A long table across several pages: net billed, collected and collection rate by municipality'), headers: [{ label: L('البلدية', 'Municipality'), kind: 'text' }, { label: L('صافي المفوتر', 'Net billed'), kind: 'money' }, { label: L('المحصّل', 'Collected'), kind: 'money' }, { label: L('نسبة التحصيل', 'Collection rate'), kind: 'pct' }, { label: L('الفواتير', 'Invoices'), kind: 'count' }], rows, total: ['Total', rows.reduce((t, r) => t + r[1], 0), rows.reduce((t, r) => t + r[2], 0), 0.8, rows.reduce((t, r) => t + r[4], 0)], note: L('الإجمالي في آخر صف.', 'The total is the last row.') },
    { type: 'table', id: 'stress-wide', title: L('جدول عريض: عشرة أعمدة', 'A wide table: ten columns'), headers: [{ label: L('البند', 'Item'), kind: 'text' }, ...Array.from({ length: 9 }, (_, k) => ({ label: `${L('الشهر', 'Month')} ${k + 1}`, kind: 'money' }))], rows: wide, total: null, note: null }
  ] };
}
const models = {};
for (const lang of ['ar', 'en']) {
  const m = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: SECTION_ORDER, depth: 'detailed', compare: 'prev_year' }, lang, out: mkOut(cYtd), prev, compare: 'prev_year', prevScope: { from: '2025-01-01', to: '2025-10-09' }, cash, bridge: null, targets: DEFAULT_TARGETS, meta });
  m.sections = [...m.sections, stress(lang)]; m.meta = { version: 3, generatedAt: m.generatedAt, cutoff: m.cutoff };
  models[lang] = m;
}

// fonts from the same bundled files the browser build inlines
const fdir = new URL('../node_modules/@fontsource/ibm-plex-sans-arabic/files/', import.meta.url);
const fonts = {}; for (const w of [400, 600, 700]) for (const s of ['arabic', 'latin']) fonts[`${s}-${w}`] = `data:font/woff2;base64,${fs.readFileSync(new URL(`ibm-plex-sans-arabic-${s}-${w}-normal.woff2`, fdir)).toString('base64')}`;

const findChrome = () => {
  const c = [process.env.CHROME_BIN, ...['chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'].map((p) => path.join(os.homedir(), 'Library/Caches/ms-playwright', p)), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'];
  return c.find((p) => p && fs.existsSync(p));
};
const chrome = findChrome(); if (!chrome) { console.error('no Chromium found (set CHROME_BIN)'); process.exit(2); }
const sh = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });

// numbers/words a model shows (what the PDF must carry)
const numsOf = (s) => String(s ?? '').match(/\d[\d,]*(?:\.\d+)?/g) || [];
function shownTexts(m) {
  const cells = []; const labels = []; const add = (...xs) => xs.forEach((x) => { if (x != null && x !== '') cells.push(String(x)); });
  const walk = (b) => {
    if (b.type === 'kpis') b.items.forEach((k) => { add(k.value, k.sub); labels.push(k.label); });
    else if (b.type === 'table') { const t = tableToText(b, m.lang); t.rows.forEach((r) => { add(...r.slice(1)); labels.push(r[0]); }); if (t.total) add(...t.total.slice(1)); labels.push(b.title); }
    else if (b.type === 'chart') { const ct = chartTable(b, m.lang); ct.rows.forEach((r) => { add(...r.slice(1)); labels.push(r[0]); }); labels.push(b.title); }
    else if (b.type === 'insights') b.items.forEach((i) => { labels.push(typeof i.title === 'string' ? i.title : i.title[m.lang]); });
  };
  m.headline.forEach(walk); m.sections.forEach((s) => { labels.push(s.title); s.blocks.forEach(walk); });
  add(m.cutoff); return { cells, labels };
}

const report = [];
for (const lang of ['ar', 'en']) {
  const model = models[lang]; const base = path.join(outDir, `report-${lang}`);
  const html = buildPdfHtml(model, { fonts, title: reportFileName(model, 'pdf').replace(/\.pdf$/, '') });
  fs.writeFileSync(`${base}.html`, html);
  const render = (htmlFile, pdfFile) => {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-prof-'));
    const r = sh(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${prof}`, '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=8000', `--print-to-pdf=${pdfFile}`, `file://${htmlFile}`]);
    fs.rmSync(prof, { recursive: true, force: true });
    if (!fs.existsSync(pdfFile)) { console.error(r.stderr); process.exit(3); }
  };
  render(`${base}.html`, `${base}.pdf`);
  // the same document without the chart drawings: their value labels sit side by side without spaces, which glues numbers together in text extraction; the tables / KPIs are what the parity check reads
  fs.writeFileSync(`${base}-noplot.html`, html.replace(/<div class="plot">.*?<\/div>/gs, '')); render(`${base}-noplot.html`, `${base}-noplot.pdf`);
  // page images (60 dpi grey for the ink check, 70 dpi colour for looking)
  for (const f of fs.readdirSync(outDir)) if (f.startsWith(`report-${lang}-p`)) fs.rmSync(path.join(outDir, f));
  sh('pdftoppm', ['-r', '70', '-png', `${base}.pdf`, `${base}-p`]);
  const info = sh('pdfinfo', [`${base}.pdf`]).stdout; const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] || 0); const size = /Page size:\s+(.*)/.exec(info)?.[1];
  const fontsOut = sh('pdffonts', [`${base}.pdf`]).stdout.split('\n').slice(2).filter(Boolean).map((l) => l.trim().split(/\s+/));
  const embedded = fontsOut.filter((f) => /\byes\b/.test(f.join(' '))).length; const names = [...new Set(fontsOut.map((f) => f[0].replace(/^[A-Z]{6}\+/, '')))];
  const text = sh('pdftotext', ['-enc', 'UTF-8', `${base}-noplot.pdf`, '-']).stdout; const textAll = sh('pdftotext', ['-enc', 'UTF-8', `${base}.pdf`, '-']).stdout;
  // per-page ink (share of non-white pixels) and words
  const ink = []; const words = [];
  for (let p = 1; p <= pages; p += 1) {
    const g = sh('pdftoppm', ['-r', '30', '-gray', '-f', String(p), '-l', String(p), `${base}.pdf`, `${base}-g`]);
    const f = fs.readdirSync(outDir).find((x) => x.startsWith(`report-${lang}-g`) && x.endsWith('.pgm') && Number(/-(\d+)\.pgm$/.exec(x)[1]) === p);
    const buf = fs.readFileSync(path.join(outDir, f)); const hdr = buf.toString('latin1', 0, 20).match(/^P5\s+(\d+)\s+(\d+)\s+255\s/); const px = buf.subarray(hdr[0].length); let dark = 0; for (const v of px) if (v < 200) dark += 1;
    ink.push(Number((dark / px.length * 100).toFixed(2))); fs.rmSync(path.join(outDir, f));
    words.push(sh('pdftotext', ['-f', String(p), '-l', String(p), `${base}.pdf`, '-']).stdout.split(/\s+/).filter(Boolean).length);
  }
  // numeric parity: every number the model shows must occur in the PDF text at least as many times
  const { cells, labels } = shownTexts(model); const have = new Map(); for (const n of numsOf(text)) have.set(n, (have.get(n) || 0) + 1);
  const need = new Map(); for (const c of cells) for (const n of numsOf(c)) need.set(n, (need.get(n) || 0) + 1);
  let total = 0; let matched = 0; const missing = [];
  for (const [n, k] of need) { total += k; const h = have.get(n) || 0; matched += Math.min(k, h); if (h < k) missing.push(`${n} (need ${k}, has ${h})`); }
  // labels: Arabic extraction from a PDF is viewer-dependent (poppler returns the lam-alef ligature and some letter pairs in visual order), so a label counts as present when a
  // window of the extracted letters (spaces, marks and punctuation ignored) holds exactly the same letters, in any order
  const skel = (t) => [...String(t).normalize('NFKC')].filter((c) => /[\p{L}\p{N}]/u.test(c) && !/\p{M}/u.test(c));
  const flat = skel(text); const labelFound = (lab) => {
    const want = skel(lab); if (!want.length) return true; const cnt = new Map(); for (const c of want) cnt.set(c, (cnt.get(c) || 0) + 1);
    let bad = cnt.size; const L0 = want.length; // number of letters whose count is not yet balanced
    const add = (c, d) => { const before = cnt.get(c) || 0; const after = before - d; cnt.set(c, after); if (before === 0 && after !== 0) bad += 1; else if (before !== 0 && after === 0) bad -= 1; };
    for (let i = 0; i < flat.length; i += 1) { add(flat[i], 1); if (i >= L0) add(flat[i - L0], -1); if (i >= L0 - 1 && bad === 0) return true; }
    return false;
  };
  let lt = 0; let lm = 0; const lmiss = []; for (const lab of labels) { if (!skel(lab).length) continue; lt += 1; if (labelFound(lab) || String(lab).split(/\s+/).filter((w) => skel(w).length >= 2).every((w) => labelFound(w))) lm += 1; else lmiss.push(lab); } // a long label wrapped over several lines of a narrow cell is read back interleaved with its neighbours: then each of its words must be found
  const blank = ink.map((v, i) => (v < 0.15 || words[i] < 8 ? i + 1 : null)).filter(Boolean);
  const res = { lang, pages, size, fontsEmbedded: `${embedded}/${fontsOut.length}`, fontNames: names, textChars: textAll.length, numbers: `${matched}/${total}`, missing: missing.slice(0, 12), labels: `${lm}/${lt}`, labelsMissing: lmiss.slice(0, 6), inkPct: ink, words, nearBlankPages: blank, htmlKB: Math.round(html.length / 1024), pdfKB: Math.round(fs.statSync(`${base}.pdf`).size / 1024) };
  report.push(res); console.log(JSON.stringify(res));
}
fs.writeFileSync(path.join(outDir, 'verify.json'), JSON.stringify(report, null, 1));
const bad = report.some((r) => r.nearBlankPages.length || r.fontsEmbedded.split('/')[0] !== r.fontsEmbedded.split('/')[1] || r.numbers.split('/')[0] !== r.numbers.split('/')[1] || r.labels.split('/')[0] !== r.labels.split('/')[1]);
console.log(bad ? 'VERIFY: issues found (see above)' : 'VERIFY: ok');
process.exit(bad ? 1 : 0);
