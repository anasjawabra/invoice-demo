import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-journeys'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1280, height: 1000 } });
await context.addInitScript(() => sessionStorage.setItem('ib_lang', 'en'));
const page = await context.newPage(); page.setDefaultTimeout(15000);
const results = [], requests = [], errors = [];
page.on('request', (r) => { if (r.url().includes('/api/') && r.method() === 'POST') requests.push({ url: r.url(), body: r.postDataJSON() }); });
page.on('pageerror', (e) => errors.push(e.message));
async function go(path) { await page.goto(path); await page.waitForTimeout(800); }
async function run(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); }
  catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); }
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
const listRequest = () => requests.filter((r) => r.url.endsWith('/api/list')).at(-1)?.body;
await go('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
await run('gross billed drilldown includes all collection states and matches the scope total', async () => {
  await page.locator('a[href="/invoices?view=all"]').first().click(); await page.getByRole('heading', { name: 'All invoices', exact: true }).waitFor();
  await page.waitForTimeout(600); assert.equal(listRequest().filters.state, 'all');
  const counts = await page.evaluate(async (request) => {
    const headers = { 'Content-Type': 'application/json', 'x-session': sessionStorage.getItem('ib_session_id') };
    const read = async (endpoint) => (await fetch(`/api/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(request) })).json();
    const [list, snapshot] = await Promise.all([read('list'), read('snapshot')]);
    return [list.total, snapshot.totals.count];
  }, listRequest());
  assert.equal(counts[0], counts[1]); assert.ok(counts[0] > 0);
  const postedExport = page.locator('form[action*="/api/export.csv"] input[name=q]');
  const exported = await postedExport.count() ? JSON.parse(await postedExport.inputValue())
    : JSON.parse(new URL(await page.locator('a[href*="/api/export.csv"]').first().getAttribute('href'), page.url()).searchParams.get('q'));
  assert.equal(exported.filters.state, 'all');
  await page.screenshot({ path: `${out}/all-invoices.png` });
});
await run('menu invoice entry retains collected default after all-state drilldown', async () => {
  await go('/invoices');
  assert.equal(listRequest().filters.state, 'paid');
});
await run('product invoice entry includes unpaid invoices and product scope', async () => {
  await go('/products/foras'); await page.getByRole('button', { name: 'Open the invoices list for this product' }).click(); await page.waitForTimeout(650);
  assert.equal(new URL(page.url()).searchParams.get('view'), 'all');
  assert.equal(listRequest().filters.state, 'all'); assert.deepEqual(listRequest().scope.product, ['foras']);
});
await run('product challenge transfers product scope', async () => {
  await go('/products/foras'); await page.locator('.prod-challenges a[href="/collection"]').click(); await page.waitForTimeout(600);
  const req = requests.filter((r) => r.url.endsWith('/api/worklist')).at(-1)?.body;
  assert.deepEqual(req.scope.product, ['foras']);
});
await run('invoice detail returns to the product page with the correct label', async () => {
  await go('/products/foras'); await page.locator('section[aria-label="Invoices"] tbody a').first().click();
  await page.locator('.rp-return').waitFor(); assert.match(await page.locator('.rp-return').innerText(), /Product management/);
  await page.locator('.rp-return').click(); await page.waitForURL('**/products/foras');
});
await run('analysis drilldown carries the selected entity and source, clearing unrelated product filters', async () => {
  await go('/products/foras'); await page.getByRole('button', { name: 'Open the invoices list for this product' }).click();
  await go('/insights'); await page.locator('#ra-entity').waitFor();
  const entity = await page.locator('#ra-entity option[value^="e:"]').first().getAttribute('value');
  const source = await page.locator('#ra-source option').nth(1).getAttribute('value');
  await page.locator('#ra-entity').selectOption(entity); await page.locator('#ra-source').selectOption(source);
  await page.getByRole('link', { name: 'Open the invoices', exact: true }).click(); await page.waitForTimeout(650);
  assert.equal(listRequest().scope.amanah, entity.slice(2)); assert.equal(listRequest().scope.source, source);
  assert.deepEqual(listRequest().scope.product, []); assert.equal(listRequest().filters.state, 'all');
});
for (const endpoint of ['list', 'contracts', 'anomalies']) {
  await run(`product ${endpoint} failure is visible and retry recovers`, async () => {
    await page.route(`**/api/${endpoint}`, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Journey simulated outage' }) }));
    await go('/products/foras'); await page.getByText('This section could not be loaded', { exact: true }).first().waitFor();
    if (endpoint === 'list') assert.equal(await page.getByText('No uncollected invoices in this selection.', { exact: true }).count(), 0);
    await page.screenshot({ path: `${out}/failure-state-${endpoint}.png` });
    await page.unroute(`**/api/${endpoint}`); await page.getByRole('button', { name: 'Retry', exact: true }).first().click();
    await page.waitForTimeout(900); assert.equal(await page.getByText('This section could not be loaded', { exact: true }).count(), 0);
  });
}
await run('product summary failure shows an error and recovers on retry', async () => {
  await page.route('**/api/snapshot', (r) => r.request().postDataJSON()?.scope?.product?.includes('foras')
    ? r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Journey summary outage' }) }) : r.continue());
  await go('/products/foras'); await page.getByText('This section could not be loaded', { exact: true }).waitFor();
  await page.unroute('**/api/snapshot'); await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.locator('section[aria-label="Invoices"] tbody a').first().waitFor();
});
await run('download includes current planning targets; failed restore preserves data and page', async () => {
  await go('/smart-reports'); await page.getByText('Examples, about the assistant, where my data is kept', { exact: true }).click(); await page.locator('#local-data summary').click();
  const targets = { v: 1, years: { 2026: { Riyadh: { coverage: 0.25, collectionRate: 0.6 } } } };
  await page.evaluate((t) => localStorage.setItem('ib_plan_targets_v1', JSON.stringify(t)), targets);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download a backup', exact: true }).click();
  const download = await downloadPromise; const stream = await download.createReadStream(); let contents = ''; for await (const part of stream) contents += part;
  const backup = JSON.parse(contents); assert.deepEqual(backup.data.ib_plan_targets_v1, targets);
  backup.data.ib_actions_v1 = { actions: [{ id: 'new-restore' }] };
  await page.locator('#local-import').setInputFiles({ name: 'journey-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  const before = await page.evaluate(() => ({ ...localStorage }));
  await page.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === 'ib_actions_v1' && v.includes('new-restore')) throw new DOMException('Quota', 'QuotaExceededError'); return set.call(this, k, v); }; });
  await page.getByRole('button', { name: 'Replace the current data', exact: true }).click();
  await page.getByText('Restore failed; your existing data was preserved. Check browser storage, then retry.', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), before);
  await page.screenshot({ path: `${out}/restore-failure.png` });
});
await run('all-state invoice view supports Arabic on a narrow screen', async () => {
  await page.addInitScript(() => sessionStorage.setItem('ib_lang', 'ar'));
  await page.setViewportSize({ width: 375, height: 812 }); await go('/invoices?view=all');
  await page.getByRole('heading', { name: 'جميع الفواتير', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: `${out}/all-invoices-mobile-ar.png` });
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
