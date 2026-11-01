import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.CSV_STREAM_OUTPUT || '.audit-artifacts/2026-10-25-query-streaming/browser'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4197', viewport: { width: 1440, height: 1000 } });
const errors = []; const results = []; page.on('pageerror', (error) => errors.push(error.message));
await page.addInitScript(() => {
  sessionStorage.setItem('ib_lang', 'en');
  window.__pickerCalls = 0;
  window.showSaveFilePicker = async () => {
    window.__pickerCalls++;
    if (window.__pickerCancel) throw new DOMException('Cancelled', 'AbortError');
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('csv-stream-verification.csv', { create: true });
    const writer = await handle.createWritable(); await writer.write('ORIGINAL FILE'); await writer.close();
    window.__csvHandle = handle;
    return handle;
  };
});
const action = () => page.getByRole('button', { name: 'Save large CSV to file', exact: true });
const original = async () => assert.equal(await page.evaluate(async () => (await window.__csvHandle.getFile()).text()), 'ORIGINAL FILE');
async function run(name, fn) { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); }
try {
  await page.goto('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
  await page.goto('/invoices?view=all'); await action().waitFor();
  await run('direct write uses a real browser file stream and commits valid CSV', async () => {
    await action().click(); await page.getByText('CSV file saved.', { exact: true }).waitFor({ timeout: 20000 });
    const text = await page.evaluate(async () => (await window.__csvHandle.getFile()).text()); assert.match(text, /invoice_id,sadad_no/);
    assert.equal(await action().evaluate((el) => el === document.activeElement), true);
  });
  await run('HTML masquerading as a successful CSV never replaces the existing file', async () => {
    await page.route('**/api/export.csv*', (route) => route.fulfill({ contentType: 'text/html', body: '<html>login</html>' })); await action().click();
    await page.getByRole('alert').filter({ hasText: 'The download response was not a CSV file.' }).waitFor(); await original(); await page.unroute('**/api/export.csv*');
  });
  await run('retry retains direct-save mode and asks for a file again', async () => {
    const calls = await page.evaluate(() => window.__pickerCalls); await page.getByRole('button', { name: 'Retry export', exact: true }).click();
    await page.getByText('CSV file saved.', { exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.__pickerCalls), calls + 1);
  });
  await run('cancelling the picker sends no export request', async () => {
    await page.evaluate(() => { window.__pickerCancel = true; }); let calls = 0;
    await page.route('**/api/export.csv*', (route) => { calls++; return route.abort(); }); await action().click();
    await page.getByText('Export cancelled.', { exact: true }).waitFor(); assert.equal(calls, 0); await page.evaluate(() => { window.__pickerCancel = false; }); await page.unroute('**/api/export.csv*');
  });
  await run('ordinary download refuses an oversized CSV and points to direct saving', async () => {
    const body = Buffer.alloc(33 * 1024 * 1024, 65); Buffer.from('invoice_id,amount\n').copy(body);
    await page.route('**/api/export.csv*', (route) => route.fulfill({ contentType: 'text/csv', body }));
    await page.locator('a[download][href*="/api/export.csv"]').click();
    await page.getByRole('alert').filter({ hasText: 'This file exceeds the 32 MiB browser download limit.' }).waitFor({ timeout: 30000 }); await page.unroute('**/api/export.csv*');
  });
  await run('cancelling after bytes arrive aborts the real file stream without replacing the old file', async () => {
    await page.evaluate(() => {
      window.__normalFetch = window.fetch; window.__chunksSent = 0;
      window.fetch = (url, options) => {
        if (!String(url).includes('/api/export.csv')) return window.__normalFetch(url, options);
        let timer;
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('invoice_id,amount\n'));
            timer = setInterval(() => { controller.enqueue(new Uint8Array(65536).fill(65)); window.__chunksSent++; }, 100);
          }, cancel() { clearInterval(timer); }
        });
        return Promise.resolve(new Response(body, { headers: { 'Content-Type': 'text/csv' } }));
      };
    });
    try {
      await action().click(); await page.waitForFunction(() => window.__chunksSent >= 2);
      await page.getByRole('button', { name: 'Cancel export', exact: true }).click(); await page.getByText('Export cancelled.', { exact: true }).waitFor();
      await page.waitForTimeout(150); await original();
    } finally { await page.evaluate(() => { window.fetch = window.__normalFetch; }); }
  });
  await run('large real dataset is saved without calling Response.blob or making a download Blob', async () => {
    await page.goto('/invoices?view=all&size=full'); await page.locator('#inv-sort').waitFor({ timeout: 60000 });
    await page.locator('.table-wrap[aria-busy="false"]').waitFor({ timeout: 60000 });
    const updated = page.waitForResponse((response) => response.url().includes('/api/list') && response.request().method() === 'POST', { timeout: 60000 });
    await page.getByRole('button', { name: 'All data', exact: true }).click(); await updated;
    await page.locator('.table-wrap[aria-busy="false"]').waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      Response.prototype.blob = () => { throw new Error('Whole response buffering is forbidden'); };
      window.__objectUrlCalls = 0; URL.createObjectURL = () => { window.__objectUrlCalls++; throw new Error('Download Blob is forbidden'); };
    });
    const started = Date.now(); await action().click(); await page.getByText('CSV file saved.', { exact: true }).waitFor({ timeout: 120000 });
    const file = await page.evaluate(async () => {
      const file = await window.__csvHandle.getFile(); let lines = 0; const decoder = new TextDecoder();
      for await (const part of file.stream()) lines += (decoder.decode(part, { stream: true }).match(/\n/g) || []).length;
      return { bytes: file.size, rows: lines - 2, prefix: await file.slice(0, 1024).text(), objectUrlCalls: window.__objectUrlCalls };
    });
    assert.ok(file.bytes > 32 * 1024 ** 2); assert.ok(file.rows > 1000000); assert.match(file.prefix, /invoice_id,sadad_no/); assert.equal(file.objectUrlCalls, 0);
    results.push({ name: 'large file measurements', passed: true, ...file, ms: Date.now() - started });
    await page.screenshot({ path: `${out}/saved-large.png`, fullPage: false });
  });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${out}/last-page.txt`, await page.locator('body').innerText().catch(() => 'unavailable'));
  await page.screenshot({ path: `${out}/last-page.png`, fullPage: false }).catch(() => {});
  await page.evaluate(async () => { try { const root = await navigator.storage.getDirectory(); await root.removeEntry('csv-stream-verification.csv'); } catch {} }).catch(() => {});
  await browser.close(); await writeFile(`${out}/results.json`, JSON.stringify({ results, errors, filePicker: 'Test replacement; real browser OPFS file handle and createWritable' }, null, 2));
}
