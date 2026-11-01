import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-exports'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }); const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => { try { sessionStorage.setItem('ib_lang', 'en'); } catch {} });
const page = await context.newPage(); page.setDefaultTimeout(11000); const results = [], errors = []; page.on('pageerror', (e) => errors.push(e.message));
async function go(path) { await page.goto(path); await page.waitForTimeout(700); }
async function run(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); } catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); } await page.unroute('**/api/export.csv*'); await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2)); }
const action = () => page.locator('a[download][href*="/api/export.csv"], form[action*="/api/export.csv"] button[type=submit]');
async function csvDownload(click = () => action().click()) { const pending = page.waitForEvent('download'); await click(); const file = await pending; const stream = await file.createReadStream(); let text = ''; for await (const chunk of stream) text += chunk; return { file, text }; }
const rows = (text) => text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
await go('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
await run('download follows the list sort across all pages instead of exporting insertion order', async () => {
  await go('/invoices?view=all'); await page.locator('#inv-sort').selectOption('gross'); await page.waitForTimeout(600);
  const first = await page.locator('button[aria-label^="View details:"]').allTextContents(); await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.waitForTimeout(500);
  const second = await page.locator('button[aria-label^="View details:"]').allTextContents(); const before = page.url(); const { text } = await csvDownload();
  const ids = rows(text).slice(1).map((line) => line.split(',')[0]); assert.deepEqual(ids.slice(0, first.length), first); assert.deepEqual(ids.slice(first.length, first.length + second.length), second); assert.equal(page.url(), before);
});
await run('a failed CSV response stays on the page with a visible retry that downloads successfully', async () => {
  await go('/invoices?view=all'); await page.route('**/api/export.csv*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"export unavailable"}' })); const before = page.url(); await action().click();
  await page.getByRole('alert').filter({ hasText: 'Could not download the CSV. Check the connection and retry.' }).waitFor(); assert.equal(page.url(), before); await page.screenshot({ path: `${out}/download-error.png` });
  await page.unroute('**/api/export.csv*'); const { text } = await csvDownload(() => page.getByRole('button', { name: 'Retry export', exact: true }).click()); assert.match(text, /invoice_id/); assert.equal(await action().evaluate((el) => el === document.activeElement), true);
});
await run('a successful JSON or HTML response cannot masquerade as a CSV download', async () => {
  await go('/invoices?view=all'); await page.route('**/api/export.csv*', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>sign in</html>' })); await action().click();
  await page.getByRole('alert').filter({ hasText: 'The download response was not a CSV file. Retry the export.' }).waitFor(); await page.unroute('**/api/export.csv*');
});
await run('repeated export clicks issue one request while the file is pending', async () => {
  await go('/invoices?view=all'); let calls = 0; await page.route('**/api/export.csv*', async (route) => { calls++; await new Promise((resolve) => setTimeout(resolve, 700)); await route.fulfill({ status: 200, contentType: 'text/csv', body: '\uFEFFinvoice_id,amount_sar\nONE,1\n' }); });
  const { text } = await csvDownload(async () => { await action().dispatchEvent('click'); await action().dispatchEvent('click'); }); assert.equal(calls, 1); assert.match(text, /ONE,1/); await page.unroute('**/api/export.csv*');
});
await run('changing the applied search cancels a pending export without downloading stale data', async () => {
  await go('/invoices?view=all'); let downloads = 0; const record = () => downloads++; page.on('download', record);
  await page.route('**/api/export.csv*', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1300)); try { await route.fulfill({ status: 200, contentType: 'text/csv', body: 'invoice_id\nSTALE\n' }); } catch {} });
  await action().click(); await page.locator('#inv_search').fill('EXPORT-NO-MATCH'); await page.waitForTimeout(1650); assert.equal(downloads, 0); page.off('download', record); await page.unroute('**/api/export.csv*');
});
await run('an empty selection downloads its header and keeps the current search', async () => {
  await go('/invoices?view=all'); await page.locator('#inv_search').fill('EXPORT-NO-SUCH-INVOICE'); await page.getByText('No invoices match these filters.', { exact: true }).waitFor(); const { text } = await csvDownload();
  assert.equal(rows(text).length, 1); assert.equal(await page.locator('#inv_search').inputValue(), 'EXPORT-NO-SUCH-INVOICE');
});
await run('keyboard cancellation stops the download and restores focus to its action', async () => {
  await go('/invoices?view=all'); let downloads = 0; const record = () => downloads++; page.on('download', record);
  await page.route('**/api/export.csv*', async (route) => { await new Promise((resolve) => setTimeout(resolve, 900)); try { await route.fulfill({ contentType: 'text/csv', body: 'invoice_id\nCANCELLED\n' }); } catch {} });
  await action().focus(); await page.keyboard.press('Enter'); await page.getByRole('button', { name: 'Cancel export', exact: true }).waitFor(); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await page.getByText('Export cancelled.', { exact: true }).waitFor(); await page.waitForTimeout(1100); assert.equal(downloads, 0); assert.equal(await action().evaluate((el) => el === document.activeElement), true); page.off('download', record); await page.unroute('**/api/export.csv*');
});
await run('download feedback follows a language change made while the request is pending', async () => {
  await go('/invoices?view=all'); await page.route('**/api/export.csv*', async (route) => { await new Promise((resolve) => setTimeout(resolve, 900)); await route.fulfill({ contentType: 'text/csv', body: 'invoice_id,amount_sar\nLANGUAGE,1\n' }); });
  const pending = page.waitForEvent('download'); await action().click(); await page.getByRole('button', { name: 'العربية', exact: true }).click(); await pending; await page.getByText('بدأ تنزيل ملف CSV.', { exact: true }).waitFor(); assert.equal(await page.getByText('CSV download started.', { exact: true }).count(), 0);
});
await run('full-size mode reaches both the download URL and the downloaded dataset', async () => {
  await go('/invoices?view=all&size=full'); await page.locator('#inv-sort').waitFor({ timeout: 45000 }); await page.locator('#inv-sort').selectOption('id'); await page.waitForTimeout(1000); const id = await page.locator('button[aria-label^="View details:"]').first().innerText();
  await page.locator('#inv_search').fill(id); await page.waitForTimeout(700);
  const anchor = page.locator('a[download][href*="/api/export.csv"]'); const form = page.locator('form[action*="/api/export.csv"]');
  const href = await anchor.count() ? await anchor.getAttribute('href') : await form.getAttribute('action'); assert.equal(new URL(href, page.url()).searchParams.get('size'), 'full');
  const rawPayload = await anchor.count() ? new URL(href, page.url()).searchParams.get('q') : await form.locator('input[name=q]').inputValue();
  const { text } = await csvDownload(); assert.equal(rows(text).length, 2); assert.equal(rows(text)[1].split(',')[0], id);
  // Use identical request bodies in both modes, then alternate back to catch shared server caches.
  const body = JSON.parse(rawPayload); body.filters = { ...body.filters, search: '' }; body.pageSize = 1;
  for (const endpoint of ['list', 'snapshot']) {
    const values = [];
    for (const size of ['compact', 'full', 'compact']) {
      const response = await page.request.post(new URL(`/api/${endpoint}?size=${size}`, page.url()).href, { data: body }); assert.equal(response.status(), 200);
      const data = await response.json(); values.push(endpoint === 'list' ? data.total : data.totals.count);
    }
    assert.ok(values[1] > values[0], `${endpoint}: full must contain more invoices`); assert.equal(values[2], values[0], `${endpoint}: compact cache must remain isolated`);
  }
  for (const size of ['compact', 'full', 'compact']) {
    const response = await page.request.get(new URL(`/api/meta?size=${size}`, page.url()).href); assert.equal((await response.json()).size, size);
  }
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
