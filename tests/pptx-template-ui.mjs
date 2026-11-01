// Run against Vite with UI_PLAYWRIGHT_MODULE set to the installed Playwright entry.
// Fixtures: bundle/run tests/export-layout-fixtures.mjs into PPTX_TEST_OUTPUT first.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const out = process.env.PPTX_TEST_OUTPUT || '.test-build/momah-template/output';
await mkdir(out, { recursive: true });
const sources = Object.fromEntries(await Promise.all(['en', 'ar'].map(async (lang) => [lang, await JSZip.loadAsync(await readFile(`src/assets/reports/momah-template-${lang}.pptx`))])));
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ baseURL: process.env.PPTX_TEST_URL || 'http://127.0.0.1:3000' });
const errors = []; page.on('pageerror', (error) => errors.push(error.message));
const templateRequests = []; page.on('request', (request) => { if (/momah-template-(en|ar).*\.pptx/.test(request.url())) templateRequests.push(request.url()); });
const results = [];
const buttonLang = process.env.PPTX_TEST_BUTTON_LANG || 'en';

async function inspect(file, expected = [], lang = 'en') {
  const source = sources[lang === 'ar' ? 'ar' : 'en'];
  const deck = await JSZip.loadAsync(await readFile(file));
  for (const [name, part] of Object.entries(source.files)) {
    if (!part.dir && /^ppt\/(slideMasters|slideLayouts|theme|media|fonts)\//.test(name)) {
      assert.ok(deck.file(name), `Missing template resource: ${name}`);
      assert.deepEqual(await deck.file(name).async('uint8array'), await part.async('uint8array'), `Template changed: ${name}`);
    }
  }
  const xmlParts = await Promise.all(Object.entries(deck.files).filter(([name, part]) => !part.dir && /\.(xml|rels)$/.test(name)).map(async ([name, part]) => [name, await part.async('string')]));
  const parsed = await page.evaluate((parts) => parts.map(([name, text]) => {
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    return { name, invalid: !!xml.querySelector('parsererror'),
      text: Array.from(xml.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 't')).map((node) => node.textContent).join('\n'),
      targets: Array.from(xml.getElementsByTagName('Relationship')).filter((node) => node.getAttribute('TargetMode') !== 'External').map((node) => node.getAttribute('Target')) };
  }), xmlParts);
  for (const part of parsed) {
    assert.equal(part.invalid, false, `Malformed XML: ${part.name}`);
    for (const target of part.targets) {
      const base = part.name === '_rels/.rels' ? '' : path.posix.dirname(path.posix.dirname(part.name));
      const resolved = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(base, target));
      assert.ok(deck.file(resolved), `Broken relationship: ${part.name} → ${resolved}`);
    }
  }
  const slides = parsed.filter((part) => /^ppt\/slides\/slide\d+.xml$/.test(part.name));
  const allText = slides.map((slide) => slide.text).join('\n');
  assert.doesNotMatch(allText, /AI Execution|ShareService Sector Status Update|Qualification and Procurement|Data Readiness/);
  assert.doesNotMatch(allText, /Click to (?:add|edit)|اضغط لإضافة عنوان|انقر لتحرير/);
  assert.ok(!Object.keys(deck.files).some((name) => /^ppt\/notesSlides\//.test(name)), 'Sample notes removed');
  for (const text of expected.filter(Boolean)) assert.ok(allText.includes(String(text)), `Missing report content: ${String(text).slice(0, 150)}`);
  const presentation = await deck.file('ppt/presentation.xml').async('string');
  assert.match(presentation, /cx="12192000"/); assert.match(presentation, /cy="6858000"/);
  assert.ok(deck.file('ppt/media/momah-logo-fallback.png'), 'Cover logo works without SVG support');
  const last = slides.length;
  for (const [number, layout] of [[1, 1], [2, 30], [last - 1, 27], [last, 26]]) {
    assert.match(await deck.file(`ppt/slides/_rels/slide${number}.xml.rels`).async('string'), new RegExp(`slideLayout${layout}\\.xml`));
  }
  const charts = parsed.filter((part) => /^ppt\/charts\/chart\d+.xml$/.test(part.name)).length;
  return { slides: slides.length, charts };
}

try {
  await page.addInitScript((lang) => sessionStorage.setItem('ib_lang', lang), buttonLang);
  await page.goto('/login');
  await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123');
  await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
  await page.goto('/smart-reports');
  await page.locator('#sr-input').fill('revenue report this month'); await page.locator('.sr-composer__btn').click();
  await page.locator('.sr-card').first().waitFor({ timeout: 45000 });
  const pending = page.waitForEvent('download', { timeout: 60000 });
  await page.getByRole('button', { name: 'PowerPoint', exact: true }).last().click();
  const download = await pending; const file = path.resolve(out, 'button-download.pptx');
  await download.saveAs(file); assert.equal(await download.failure(), null);
  results.push({ id: 'button-download', lang: buttonLang, ...await inspect(file, buttonLang === 'en' ? ['Report context and filters'] : [], buttonLang) });

  if (process.env.PPTX_TEST_BUTTON_ONLY !== '1') {
    const fixtures = JSON.parse(await readFile(`${out}/models.json`, 'utf8'));
    const zh = structuredClone(fixtures.find((fixture) => fixture.id === 'en-empty').model);
    Object.assign(zh, { lang: 'zh', title: '共享服务收入分析报告', subtitle: '报告期间：2026年1月1日至2026年10月25日', context: [{ label: '范围', value: '全部机构' }] });
    zh.sections = [{ title: '收入明细', blocks: [{ type: 'table', title: '机构收入', headers: [{ label: '机构', kind: 'text' }, { label: '说明', kind: 'text' }], rows: Array.from({ length: 35 }, (_, i) => [`机构 ${i + 1}`, '需要保留的完整中文说明，用于检查跨页后的表格数据和最后一行。']), total: ['合计', '最后一行必须保留'] }] }];
    fixtures.push({ id: 'zh-pagination', model: zh });
    for (const { id, model } of fixtures) {
      const pending = page.waitForEvent('download', { timeout: 60000 });
      const expected = await page.evaluate(async (model) => {
        const exporter = await import('/src/utils/exportReportModel.js');
        await exporter.exportModelToPptx(model);
        return [model.title, model.subtitle, ...exporter.modelToLines(model).flatMap((item) => item.k === 'table' ? [...item.headers, ...item.rows.flat(), item.note] : [item.text])];
      }, model);
      const download = await pending; const file = path.resolve(out, `${id}.pptx`);
      await download.saveAs(file); assert.equal(await download.failure(), null);
      const result = await inspect(file, expected, model.lang);
      if (id.includes('detailed')) assert.ok(result.charts > 0, 'Charts remain editable');
      results.push({ id, ...result }); console.log(`Verified ${id}: ${result.slides} slides, ${result.charts} native charts`);
    }
    assert.equal(templateRequests.filter((url) => /momah-template-en/.test(url)).length, 1, 'English and Chinese share one cached template');
    assert.equal(templateRequests.filter((url) => /momah-template-ar/.test(url)).length, 1, 'Arabic has an independent cached template');
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/verification.json`, JSON.stringify({ results, errors }, null, 2));
  console.log('PowerPoint button, original template resources, XML relationships and report content passed.');
} finally { await browser.close(); }
