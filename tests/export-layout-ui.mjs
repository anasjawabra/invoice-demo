import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out = process.env.EXPORT_LAYOUT_OUTPUT || '.audit-artifacts/2026-10-25-release/exports/before';
await mkdir(out, { recursive: true });
const models = JSON.parse(await readFile(`${out}/models.json`, 'utf8'));
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.EXPORT_LAYOUT_URL || 'http://127.0.0.1:4173/login'); await page.evaluate(() => document.fonts.ready);
const results = [];
for (const { id, model } of models) {
  for (const format of (process.env.EXPORT_LAYOUT_FORMATS || 'docx,pptx').split(',')) {
    const pending = page.waitForEvent('download', { timeout: 90000 });
    await page.evaluate(async ({ model, format, id }) => { const exporter = await import('/src/utils/exportReportModel.js'); await exporter.exportModel(format, model); }, { model, format, id });
    const download = await pending; const file = path.resolve(out, `${id}.${format}`); await download.saveAs(file); assert.equal(await download.failure(), null);
  }
  const html = await page.evaluate(async (model) => (await import('/src/utils/exportReportModel.js')).modelToHtml(model), model);
  await writeFile(`${out}/${id}.html`, html);
  const print = await browser.newPage(); await print.setContent(html); await print.evaluate(() => document.fonts.ready);
  const text = await print.locator('h1,h2,h3,h4,p,th,td').allTextContents();
  if (process.env.EXPORT_LAYOUT_REUSE_PRINT !== '1') await print.pdf({ path: `${out}/${id}.pdf`, printBackground: true, preferCSSPageSize: true }); await print.close();
  results.push({ id, paragraphs: text.filter((t) => t.trim()), formats: ['docx','pptx','pdf'], generated: true }); console.log(`Exported ${id}`);
}
await browser.close(); await writeFile(`${out}/manifest.json`, JSON.stringify({ results, errors }, null, 2)); assert.deepEqual(errors, []);
