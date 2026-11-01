import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-resilience'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => sessionStorage.setItem('ib_lang', 'en'));
const page = await context.newPage(); page.setDefaultTimeout(12000);
const results = [], errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function go(path) { await page.goto(path); await page.waitForTimeout(650); }
async function run(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); }
  catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); }
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
await go('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
for (const malformed of [false, true]) await run(`invoice ${malformed ? 'invalid JSON' : '503'} has a retry and is not reported as empty`, async () => {
  await page.route('**/api/list', (r) => r.fulfill({ status: malformed ? 200 : 503, contentType: 'application/json', body: malformed ? '{broken' : '{"error":"temporary_outage"}' }));
  await go('/invoices?view=all'); await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
  assert.equal(await page.getByText('No invoices match these filters.', { exact: true }).count(), 0);
  if (malformed) await page.getByText(/invalid response/).waitFor();
  await page.screenshot({ path: `${out}/invoice-error-${malformed}.png` });
  await page.unroute('**/api/list'); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await page.locator('tr.row-clickable').first().waitFor();
});
await run('late filter results cannot overwrite the latest selection', async () => {
  await go('/invoices?view=all'); const id = await page.locator('tr.row-clickable td:first-child button').first().innerText();
  let release; const gate = new Promise((resolve) => { release = resolve; }); let held = false;
  await page.route('**/api/list', async (r) => {
    if (r.request().postDataJSON()?.filters?.search === 'delayed-old-filter') { held = true; await gate; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, page: 0, pageSize: 50, rows: [] }) }); }
    else await r.continue();
  });
  const search = page.getByRole('textbox', { name: 'Search', exact: true });
  await search.fill('delayed-old-filter');
  for (let i = 0; i < 30 && !held; i++) await page.waitForTimeout(50);
  assert.ok(held); await page.getByText('Updating the list. The rows below are from the previous selection.', { exact: true }).waitFor();
  await search.fill(id); await page.waitForTimeout(700);
  assert.equal(await page.locator('tr.row-clickable').count(), 1); release(); await page.waitForTimeout(300);
  assert.equal(await page.locator('tr.row-clickable').count(), 1); assert.match(await page.locator('tr.row-clickable').innerText(), new RegExp(id));
  await page.unroute('**/api/list');
});
await run('switching contract addresses hides the previous contract while the next one loads', async () => {
  const cards = await page.evaluate(async () => (await (await fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: { from: '2000-01-01', to: '2026-10-25' } }) })).json()).cards);
  const [first, second] = cards; assert.ok(first && second);
  await go(`/contracts/${encodeURIComponent(first.contractNo)}`); await page.locator('.rp-figures').waitFor();
  let release; const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/contract', async (r) => { if (r.request().postDataJSON().no === second.contractNo) await gate; await r.continue(); });
  await page.evaluate((path) => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); }, `/contracts/${encodeURIComponent(second.contractNo)}`);
  await page.getByText('Loading…', { exact: true }).waitFor(); assert.equal(await page.locator('.rp-figures').count(), 0);
  await page.screenshot({ path: `${out}/contract-transition.png` }); release(); await page.locator('.rp-figures').waitFor();
  assert.match(await page.locator('h1').innerText(), new RegExp(second.contractNo)); await page.unroute('**/api/contract');
});
async function importSample() {
  await go('/settings/data-sources'); await page.getByRole('button', { name: 'Sample: invoice details', exact: true }).click();
  await page.getByRole('button', { name: /^Import \d+ accepted invoice/ }).click(); await page.getByRole('button', { name: 'Imported', exact: true }).waitFor();
}
await run('failed removal is visible, retains the import log and can be retried', async () => {
  await importSample(); const before = await page.evaluate(() => sessionStorage.getItem('ib_rev_uploads'));
  await page.route('**/api/upload/clear', (r) => r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"simulated_rejection"}' }));
  await page.getByRole('button', { name: 'Remove all uploaded records', exact: true }).click();
  await page.getByText('Could not remove uploaded records. The import log has been kept; try again.', { exact: true }).waitFor();
  const errorBox = await page.getByText('Could not remove uploaded records. The import log has been kept; try again.', { exact: true }).boundingBox();
  assert.ok(errorBox && errorBox.y >= 0 && errorBox.y < page.viewportSize().height, 'removal feedback must be visible beside the action');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('ib_rev_uploads')), before);
  assert.equal(await page.getByRole('button', { name: 'Remove all uploaded records', exact: true }).isEnabled(), true);
  await page.screenshot({ path: `${out}/clear-failure.png` }); await page.unroute('**/api/upload/clear');
  await page.getByRole('button', { name: 'Remove all uploaded records', exact: true }).click(); await page.getByText('Uploaded records were removed.', { exact: true }).waitFor();
});
await run('repeated removal clicks issue one request and disable conflicting controls', async () => {
  await importSample(); let release; const gate = new Promise((resolve) => { release = resolve; }); let calls = 0;
  await page.route('**/api/upload/clear', async (r) => { calls++; await gate; await r.continue(); });
  await page.getByRole('button', { name: 'Remove all uploaded records', exact: true }).evaluate((button) => { button.click(); button.click(); });
  await page.waitForTimeout(150); assert.equal(calls, 1); assert.equal(await page.locator('#up_file').isDisabled(), true); assert.equal(await page.locator('#up_type').isDisabled(), true);
  release(); await page.getByText('Uploaded records were removed.', { exact: true }).waitFor(); await page.unroute('**/api/upload/clear');
});
await run('lost import acknowledgement is not replayed or reported as success', async () => {
  await go('/settings/data-sources'); await page.getByRole('button', { name: 'Sample: invoice details', exact: true }).click(); let calls = 0;
  await page.route('**/api/upload', async (r) => { calls++; await r.abort('failed'); });
  await page.getByRole('button', { name: /^Import \d+ accepted invoice/ }).click();
  await page.getByText('The import could not be confirmed. It may already have completed. Refresh and check the invoice records before retrying.', { exact: true }).waitFor();
  await page.waitForTimeout(600); assert.equal(calls, 1); assert.equal(await page.getByRole('button', { name: 'Imported', exact: true }).count(), 0);
  await page.screenshot({ path: `${out}/uncertain-import.png` }); await page.unroute('**/api/upload');
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
