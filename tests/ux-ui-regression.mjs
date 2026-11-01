// Run with the dev server running. UI_PLAYWRIGHT_MODULE can point to the bundled runtime.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright');
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-fixes';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage(); page.setDefaultTimeout(10000);
await page.addInitScript(() => sessionStorage.setItem('ib_lang', 'en'));
const results = [], errors = [];
page.on('pageerror', (e) => errors.push({ url: page.url(), message: e.message }));
async function go(path) { await page.goto(path); await page.waitForTimeout(650); }
async function run(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); }
  catch (e) { results.push({ name, passed: false, error: e.message }); console.error(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png`, fullPage: false }); }
  await writeFile(`${out}/regressions.json`, JSON.stringify({ results, errors }, null, 2));
}
async function storageFailure(key) {
  await page.evaluate((key) => { const original = Storage.prototype.setItem; window.__restoreStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function (k, v) { if (k === key) throw new DOMException('Audit quota', 'QuotaExceededError'); return original.call(this, k, v); }; }, key);
}
await go('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
await run('empty bulk target is disabled and cannot overwrite targets', async () => {
  await go('/planning'); assert.equal(await page.locator('#tg-overall').inputValue(), ''); assert.equal(await page.locator('.tg-overall button').isDisabled(), true);
  assert.equal(await page.evaluate(() => localStorage.getItem('ib_plan_targets_v1')), null);
});
await run('negative and mixed target input keep the original value', async () => {
  for (const value of ['-10', '10abc', '']) {
    const input = page.locator('input[aria-label^="Coverage target"]').first(); const before = await input.inputValue(); const label = await input.getAttribute('aria-label');
    await input.fill(value); await input.blur(); await page.waitForTimeout(100);
    assert.equal(await page.getByRole('textbox', { name: label, exact: true }).inputValue(), before);
    assert.ok((await page.locator('[role=alert]').allTextContents()).join(' ').includes('zero or more'));
  }
});
await run('Arabic digits save the intended percentage', async () => {
  const input = page.locator('input[aria-label^="Coverage target"]').first(); const label = await input.getAttribute('aria-label');
  await input.fill('١٠'); await input.blur(); await page.waitForTimeout(150);
  assert.equal(await page.getByRole('textbox', { name: label, exact: true }).inputValue(), '10.0');
  await page.screenshot({ path: `${out}/planning-input.png` });
});
await run('failed target save preserves stored and displayed targets', async () => {
  const input = page.locator('input[aria-label^="Coverage target"]').first(); const label = await input.getAttribute('aria-label'); const before = await input.inputValue();
  const stored = await page.evaluate(() => localStorage.getItem('ib_plan_targets_v1'));
  await storageFailure('ib_plan_targets_v1'); await input.fill('25'); await input.blur(); await page.waitForTimeout(100);
  assert.equal(await page.getByRole('textbox', { name: label, exact: true }).inputValue(), before);
  assert.equal(await page.evaluate(() => localStorage.getItem('ib_plan_targets_v1')), stored);
  assert.match((await page.locator('[role=alert]').allTextContents()).join(' '), /Could not save/);
  await page.evaluate(() => window.__restoreStorage());
});
await run('encoded record identifiers recover without a blank page', async () => {
  for (const path of ['/invoices/%25', '/contracts/%25', '/enforcement-orders/%25', '/analysis/%25']) {
    await go(path); await page.locator('h1').waitFor(); await page.locator('[role=alert]').first().waitFor();
  }
});
await run('all uncollected invoices are accessible through pagination', async () => {
  await go('/collection'); await page.locator('tr[data-clickable]').first().waitFor(); const first = await page.locator('tr[data-clickable]').count(); assert.equal(first, 50);
  const ids = new Set();
  for (;;) {
    for (const id of await page.locator('tr[data-clickable] td:nth-child(2) a').allTextContents()) { assert.ok(!ids.has(id)); ids.add(id); }
    const next = page.getByRole('button', { name: 'Next', exact: true }); if (await next.isDisabled()) break;
    const old = await page.locator('tr[data-clickable] td:nth-child(2) a').first().textContent(); await next.click();
    await page.waitForFunction((old) => document.querySelector('tr[data-clickable] td:nth-child(2) a')?.textContent !== old, old);
  }
  assert.equal(ids.size, 130); await page.screenshot({ path: `${out}/collection-last-page.png` });
});
await run('collection details expand by keyboard', async () => {
  const button = page.getByRole('button', { name: 'Show details', exact: true }).first();
  const id = await button.getAttribute('aria-controls'); await button.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator(`button[aria-controls="${id}"]`).getAttribute('aria-expanded'), 'true');
  assert.ok(await page.locator(`[id="${id}"]`).isVisible());
});
for (const [path, endpoint] of [['/collection', 'worklist'], ['/contracts', 'contracts'], ['/exclusions', 'worklist'], ['/risk', 'anomalies'], ['/settings/data-quality', 'anomalies'], ['/settings/data-sources', 'quality']]) {
  await run(`${path}: HTTP failure is an error with working retry`, async () => {
    const pattern = `**/api/${endpoint}`;
    await page.route(pattern, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"test_outage"}' }));
    await go(path); await page.getByRole('button', { name: 'Retry', exact: true }).first().waitFor();
    assert.ok((await page.locator('[role=alert]').allTextContents()).join(' ').includes('could not be loaded'));
    assert.equal(await page.locator('.rv-empty:visible').count(), 0);
    await page.screenshot({ path: `${out}/error-${endpoint}-${results.length}.png` });
    await page.unroute(pattern); await page.getByRole('button', { name: 'Retry', exact: true }).first().click();
    await page.waitForFunction(() => ![...document.querySelectorAll('[role=alert]')].some((e) => e.textContent.includes('test_outage')));
  });
}
await run('broken workbook has a filename-specific visible failure', async () => {
  await go('/settings/data-sources'); await page.locator('#up_file').setInputFiles({ name: 'broken.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from([80, 75, 3, 4, 0]) });
  await page.waitForFunction(() => [...document.querySelectorAll('[role=alert]')].some((e) => e.textContent.includes('broken.xlsx')));
  assert.match((await page.locator('[role=alert]').allTextContents()).join(' '), /Could not read/);
});
await run('mouse and touch sorting is visible on stacked tables', async () => {
  await page.setViewportSize({ width: 375, height: 1000 }); await go('/invoices');
  await page.locator('#inv-sort').selectOption('gross'); await page.getByRole('button', { name: 'Reverse sort order', exact: true }).click();
  assert.equal(await page.locator('#inv-sort').inputValue(), 'gross');
  assert.equal(await page.locator('th[aria-sort=ascending]').count(), 1);
  await page.screenshot({ path: `${out}/mobile-sort.png` }); await page.setViewportSize({ width: 1280, height: 1000 });
});
await run('conversation save failure is visible and can be retried', async () => {
  await go('/smart-reports'); await storageFailure('ib_smart_convs_v1'); await page.locator('#sr-input').fill('revenue report this month'); await page.locator('.sr-composer__btn').click();
  await page.getByRole('button', { name: 'Retry saving', exact: true }).waitFor();
  assert.match((await page.locator('[role=alert]').allTextContents()).join(' '), /Could not save this conversation/);
  await page.locator('.sr-card').first().waitFor({ timeout: 25000 }); await page.evaluate(() => window.__restoreStorage());
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Retry saving', exact: true }).count(), 0);
});
await run('Arabic feedback follows the destination language', async () => {
  await go('/insights'); await page.getByRole('button', { name: 'العربية', exact: true }).click(); await page.waitForTimeout(100);
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl'); const text = (await page.locator('.toast').allTextContents()).join(' ');
  assert.ok(!/Notice|Switched to Arabic/.test(text)); assert.match(text, /[\u0600-\u06ff]/);
});
assert.equal(errors.length, 0, JSON.stringify(errors));
await browser.close();
console.log(`${results.filter((r) => r.passed).length}/${results.length} UI regression checks passed`);
if (results.some((r) => !r.passed)) process.exitCode = 1;
