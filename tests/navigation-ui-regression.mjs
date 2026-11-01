import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-navigation'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4180', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => { try { sessionStorage.setItem('ib_lang', 'en'); } catch {} });
const page = await context.newPage(); page.setDefaultTimeout(10000); const results = [], errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function go(path) { await page.goto(path); await page.waitForTimeout(700); }
async function run(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); } catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); } await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2)); }
async function spa(path) { await page.evaluate((path) => { history.pushState({ idx: (history.state?.idx || 0) + 1, key: crypto.randomUUID(), usr: null }, '', path); window.dispatchEvent(new PopStateEvent('popstate', { state: history.state })); }, path); await page.waitForTimeout(800); }
async function reset() { await page.evaluate(() => { for (let i = sessionStorage.length - 1; i >= 0; i--) { const key = sessionStorage.key(i); if (key.startsWith('ib_listmem_') || key.startsWith('ib_rev_scope_v2_') || key === 'ib_rev_scope' || key === 'ib_rev_scope_owner') sessionStorage.removeItem(key); } }); }
await go('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
await run('source and institution link parameters are both consumed in one navigation', async () => {
  await reset(); await go('/invoices?view=all&src=fines&amanah=Riyadh%20Amanah');
  assert.equal(new URL(page.url()).searchParams.has('amanah'), false); assert.equal(new URL(page.url()).searchParams.has('src'), false);
  const scope = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ib_rev_scope'))); assert.equal(scope.source, 'fines'); assert.equal(scope.amanah, 'Riyadh Amanah');
});
await run('same-page history navigation applies a new source and institution', async () => {
  await reset(); await go('/invoices?view=all'); await spa('/invoices?view=all&src=fines&amanah=Jeddah%20Amanah');
  const scope = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ib_rev_scope'))); assert.equal(scope.source, 'fines'); assert.equal(scope.amanah, 'Jeddah Amanah');
  assert.equal(new URL(page.url()).searchParams.has('src'), false);
});
await run('unknown source and institution parameters are explained without poisoning shared filters', async () => {
  await reset(); await go('/invoices?view=all&src=missing-source&amanah=missing-entity');
  const scope = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ib_rev_scope'))); assert.equal(scope.source, 'all'); assert.equal(scope.amanah, 'all');
  await page.getByText('Some link filters were not recognized and were ignored. Choose filters below.', { exact: true }).waitFor();
});
await run('contract query changes and browser back update the existing list search', async () => {
  await reset(); await go('/invoices?view=all'); await spa('/invoices?view=all&co=CONTRACT-HISTORY'); assert.equal(await page.locator('#inv_search').inputValue(), 'CONTRACT-HISTORY');
  await page.goBack(); await page.waitForTimeout(650); assert.equal(await page.locator('#inv_search').inputValue(), '');
});
await run('contextual return reuses its original history entry and keeps list search', async () => {
  await reset(); await go('/invoices?view=all'); const row = page.locator('button[aria-label^="View details:"]').first(); const id = await row.innerText();
  await page.locator('#inv_search').fill(id); await page.waitForTimeout(650); const index = await page.evaluate(() => history.state.idx);
  await page.locator('button[aria-label^="View details:"]').first().click(); await page.locator('.rp-return').waitFor(); await page.locator('.rp-return').click(); await page.waitForURL('**/invoices?view=all');
  assert.equal(await page.evaluate(() => history.state.idx), index); assert.equal(await page.locator('#inv_search').inputValue(), id);
  await page.reload(); await page.waitForTimeout(650); assert.equal(await page.locator('#inv_search').inputValue(), id);
});
await run('a directly opened invoice returns to a fresh fallback list', async () => {
  await reset(); await go('/invoices'); const id = await page.locator('button[aria-label^="View details:"]').first().innerText();
  await page.evaluate(() => sessionStorage.setItem('ib_listmem_invoices', JSON.stringify({ search: 'OLD-UNRELATED-SEARCH' })));
  await go(`/invoices/${encodeURIComponent(id)}`); await page.locator('.rp-return').click(); await page.waitForURL('**/invoices'); assert.equal(await page.locator('#inv_search').inputValue(), '');
});
await run('leaving a restored list cancels its pending scroll retries', async () => {
  await reset(); await go('/invoices?view=all'); await page.locator('button[aria-label^="View details:"]').first().click(); await page.locator('.rp-return').waitFor();
  await page.evaluate(() => { const entry = history.state?.usr?.from?.entryId; const key = Object.keys(sessionStorage).find((k) => k.includes(encodeURIComponent(entry)) && k.endsWith('_scroll')); if (key) sessionStorage.setItem(key, '100000'); else sessionStorage.setItem('ib_scroll_/invoices?view=all', '100000'); window.__scrollCalls = []; const original = window.scrollTo; window.scrollTo = function(...args) { window.__scrollCalls.push(location.pathname); return original.apply(this, args); }; });
  await page.locator('.rp-return').click(); await page.waitForURL('**/invoices?view=all'); await page.locator('button[aria-label^="View details:"]').first().waitFor(); await page.waitForTimeout(40);
  await page.locator('a[href="/settings"]').click(); await page.waitForURL('**/settings/data-sources'); await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(() => window.__scrollCalls.filter((path) => path.startsWith('/settings'))), []);
});
await run('analysis result return also reuses its source history entry', async () => {
  await reset(); await go('/collection'); const index = await page.evaluate(() => history.state.idx);
  await page.getByRole('button', { name: 'Analyze reasons for noncollection', exact: true }).click();
  const view = page.locator('[role=dialog][aria-modal=true]').getByRole('button', { name: 'View results', exact: true }); await view.waitFor({ timeout: 25000 }); await view.click(); await page.waitForURL('**/analysis/**');
  await page.locator('.rp-return').click(); await page.waitForURL('**/collection'); assert.equal(await page.evaluate(() => history.state.idx), index);
});
await run('malformed saved list values recover to usable controls', async () => {
  await reset(); await go('/invoices?view=all'); await page.evaluate(() => { const key = Object.keys(sessionStorage).find((k) => k.includes(encodeURIComponent(history.state.ibEntry)) && k.endsWith('_list_invoices_all')) || 'ib_listmem_invoices_all'; sessionStorage.setItem(key, JSON.stringify({ search: {}, page: -4, sort: { key: 'no-such-sort', dir: 'sideways' }, collectionFilter: [] })); }); await page.reload(); await page.waitForTimeout(650); await page.locator('#inv_search').waitFor(); assert.equal(await page.locator('#inv_search').inputValue(), ''); await page.locator('button[aria-label^="View details:"]').first().waitFor();
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
