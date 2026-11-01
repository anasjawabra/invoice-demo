import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-lifecycle'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => { try { sessionStorage.setItem('ib_lang', 'en'); } catch { /* about:blank and download documents have no storage origin */ } });
const page = await context.newPage(); page.setDefaultTimeout(12000);
const results = [], errors = [];
context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message))); page.on('pageerror', (e) => errors.push(e.message));
async function go(p, path) { await p.goto(path); await p.waitForTimeout(650); }
async function login(p) { await go(p, '/login'); await p.locator('#login-username').fill('demo'); await p.locator('#login-password').fill('demo123'); await p.locator('button[type=submit]').click(); await p.waitForURL('**/insights'); }
async function run(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); }
  catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); }
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
async function manual(p, number) {
  await p.getByText('Type invoice numbers by hand', { exact: true }).click(); await p.getByPlaceholder('177-2200000123', { exact: true }).fill(number);
  await p.getByRole('button', { name: 'Add the numbers', exact: true }).click(); await p.waitForTimeout(250);
}
await login(page);
await run('failed enforcement save changes neither persisted nor displayed records and can be retried', async () => {
  await go(page, '/enforcement-orders/EN-5013');
  const before = await page.evaluate(() => localStorage.getItem('ib_enforcement_v1'));
  await page.evaluate(() => { const original = Storage.prototype.setItem; window.__restoreWrite = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function(k, v) { if (k === 'ib_enforcement_v1') throw new DOMException('Quota', 'QuotaExceededError'); return original.call(this, k, v); }; });
  await manual(page, '177-2200000123'); await page.getByText('Could not record the references.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('ib_enforcement_v1')), before); assert.equal(await page.getByText('Typed references', { exact: true }).count(), 0);
  assert.equal(await page.getByPlaceholder('177-2200000123', { exact: true }).inputValue(), '177-2200000123');
  await page.screenshot({ path: `${out}/save-failed.png` }); await page.evaluate(() => window.__restoreWrite());
  await page.getByRole('button', { name: 'Add the numbers', exact: true }).click(); await page.getByText('Typed references', { exact: true }).waitFor();
  await page.reload(); await page.getByText('Typed references', { exact: true }).waitFor();
});
let other;
await run('two open tabs preserve edits to different enforcement orders', async () => {
  other = await context.newPage(); other.setDefaultTimeout(12000); await login(other); await go(other, '/enforcement-orders/EN-5026');
  await manual(other, '177-2200000124');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ib_enforcement_v1')));
  assert.ok(saved.orders['EN-5013'] && saved.orders['EN-5026']);
  await page.reload(); await page.getByText('Typed references', { exact: true }).waitFor();
  await other.reload(); await other.getByText('Typed references', { exact: true }).waitFor();
});
let label, baseline;
await run('planning targets synchronize across tabs and keep another entity’s edit', async () => {
  await go(page, '/planning'); await go(other, '/planning');
  const first = page.locator('input[aria-label^="Coverage target"]').first(); label = await first.getAttribute('aria-label'); baseline = await first.inputValue();
  const otherLabel = await page.locator('input[aria-label^="Coverage target"]').nth(1).getAttribute('aria-label');
  await first.fill('17.5'); await first.blur(); await other.getByRole('textbox', { name: label, exact: true }).waitFor();
  await other.waitForFunction((label) => Array.from(document.querySelectorAll('input')).some((x) => x.getAttribute('aria-label') === label && x.value === '17.5'), label);
  const second = other.getByRole('textbox', { name: otherLabel, exact: true }); await second.fill('23'); await second.blur();
  await page.waitForFunction((label) => Array.from(document.querySelectorAll('input')).some((x) => x.getAttribute('aria-label') === label && x.value === '23.0'), otherLabel);
  assert.equal(await page.getByRole('textbox', { name: label, exact: true }).inputValue(), '17.5');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ib_plan_targets_v1')));
  assert.ok(Object.values(saved.years).some((year) => Object.values(year).some((entry) => entry.coverage === 0.175) && Object.values(year).some((entry) => entry.coverage === 0.23)));
  await page.screenshot({ path: `${out}/cross-tab-targets.png` });
});
await run('removing saved targets in another tab updates the open page', async () => {
  await other.evaluate(() => localStorage.removeItem('ib_plan_targets_v1'));
  await page.waitForFunction(({ label, baseline }) => Array.from(document.querySelectorAll('input')).some((x) => x.getAttribute('aria-label') === label && x.value === baseline), { label, baseline });
});
await run('corrupted target storage is not silently overwritten by a new edit', async () => {
  await page.evaluate(() => localStorage.setItem('ib_plan_targets_v1', '{corrupt'));
  const input = page.getByRole('textbox', { name: label, exact: true }); await input.fill('19'); await input.blur();
  await page.getByText('Could not read saved targets. Nothing was overwritten; restore a valid backup or check browser storage.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('ib_plan_targets_v1')), '{corrupt');
  await page.evaluate(() => localStorage.removeItem('ib_plan_targets_v1'));
});
await run('large CSV exports preserve every review entry and download without losing the page', async () => {
  const decisions = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`review-${i}`, { note: `saved review ${i}`, byRule: {} }]));
  await page.evaluate((decisions) => sessionStorage.setItem('ib_rev_decisions', JSON.stringify(decisions)), decisions);
  await go(page, '/invoices?view=all');
  const form = page.locator('form[action*="/api/export.csv"]'); await form.waitFor();
  const payload = JSON.parse(await form.locator('input[name=q]').inputValue()); assert.deepEqual(payload.decisions, decisions);
  const expected = await page.evaluate(async (payload) => (await fetch(`/api/export.csv?session=${encodeURIComponent(sessionStorage.getItem('ib_session_id'))}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).text(), payload);
  const beforeUrl = page.url(); const promise = page.waitForEvent('download'); await form.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const download = await promise; const stream = await download.createReadStream(); let actual = ''; for await (const part of stream) actual += part;
  assert.equal(actual.replace(/^\uFEFF/, ''), expected.replace(/^\uFEFF/, '')); assert.equal(page.url(), beforeUrl); assert.match(actual, /invoice_id/);
  await page.screenshot({ path: `${out}/large-export.png` });
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
