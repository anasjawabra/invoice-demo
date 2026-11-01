import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-history-entry'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => { try { sessionStorage.setItem('ib_lang', 'en'); } catch {} });
const page = await context.newPage(); page.setDefaultTimeout(12000); const results = [], errors = []; page.on('pageerror', (e) => errors.push(e.message));
async function go(path) { await page.goto(path); await page.waitForTimeout(650); }
async function run(name, fn) { if (process.env.HISTORY_CASE && !name.includes(process.env.HISTORY_CASE)) return; try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); } catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); } await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2)); }
async function spa(path) { await page.evaluate((path) => { history.pushState({ idx: (history.state?.idx || 0) + 1, key: crypto.randomUUID(), usr: null }, '', path); dispatchEvent(new PopStateEvent('popstate', { state: history.state })); }, path); await page.waitForTimeout(650); }
async function newInvoiceVisit(preserveScroll = false) { const link = page.locator('a[href="/insights"]').first(); if (preserveScroll) await link.evaluate((el) => el.click()); else await link.click(); await page.waitForURL('**/insights'); await page.locator('a[href="/invoices?view=all"]').first().click(); await page.waitForURL('**/invoices?view=all'); await page.locator('#inv_search').waitFor(); await page.waitForTimeout(450); }
async function back() { await page.goBack(); await page.waitForTimeout(800); }
async function forward() { await page.goForward(); await page.waitForTimeout(800); }
await go('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
await run('two separate invoice visits retain their own searches across Back, Forward and reload', async () => {
  await go('/invoices?view=all'); await page.locator('#inv_search').fill('FIRST-VISIT'); await page.waitForTimeout(450);
  await newInvoiceVisit(); assert.equal(await page.locator('#inv_search').inputValue(), '');
  await page.locator('#inv_search').fill('SECOND-VISIT'); await page.waitForTimeout(450); await back(); await back(); assert.equal(await page.locator('#inv_search').inputValue(), 'FIRST-VISIT');
  await forward(); await forward(); assert.equal(await page.locator('#inv_search').inputValue(), 'SECOND-VISIT'); await page.reload(); await page.waitForTimeout(750); assert.equal(await page.locator('#inv_search').inputValue(), 'SECOND-VISIT');
});
await run('same-path invoice view transitions restore the correct sort and page', async () => {
  await go('/invoices?view=all'); await page.locator('#inv_search').fill(''); await page.locator('#inv-sort').selectOption('gross'); await page.waitForTimeout(500);
  const next = page.getByRole('button', { name: 'Next', exact: true }); await next.click(); await page.waitForTimeout(550); const id = await page.locator('button[aria-label^="View details:"]').first().innerText();
  await page.getByRole('button', { name: 'Operations', exact: true }).click(); await page.locator('#ops-menu a[href="/invoices"]').click(); await page.waitForURL('**/invoices'); await page.locator('#inv-sort').selectOption('id'); await page.waitForTimeout(450); await back();
  assert.equal(await page.locator('#inv-sort').inputValue(), 'gross'); assert.equal(await page.locator('button[aria-label^="View details:"]').first().innerText(), id);
  await forward(); assert.equal(await page.locator('#inv-sort').inputValue(), 'id');
});
await run('shared source and period restore before the old list page is loaded', async () => {
  await go('/invoices?view=all'); await page.getByRole('combobox', { name: 'Revenue source', exact: true }).selectOption('fines'); await page.waitForTimeout(650);
  await page.getByRole('button', { name: 'Last month', exact: true }).click(); await page.waitForTimeout(650);
  const firstScope = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ib_rev_scope')));
  await newInvoiceVisit(); await page.getByRole('combobox', { name: 'Revenue source', exact: true }).selectOption('investment'); await page.getByRole('button', { name: 'Year to date', exact: true }).click(); await page.waitForTimeout(650);
  await back(); await back(); const restored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ib_rev_scope')));
  assert.equal(restored.source, 'fines'); assert.equal(restored.from, firstScope.from); assert.equal(restored.to, firstScope.to);
});
await run('contracts from two visits retain independent search and filter values', async () => {
  await go('/contracts'); await page.locator('#ct_q').fill('FIRST-CONTRACT'); await page.locator('#ct_f').selectOption('arrears'); await page.waitForTimeout(100);
  await spa('/insights'); await spa('/contracts'); await page.locator('#ct_q').fill('SECOND-CONTRACT'); await page.locator('#ct_f').selectOption('future'); await page.waitForTimeout(100);
  await back(); await back(); assert.equal(await page.locator('#ct_q').inputValue(), 'FIRST-CONTRACT'); assert.equal(await page.locator('#ct_f').inputValue(), 'arrears');
  await forward(); await forward(); assert.equal(await page.locator('#ct_q').inputValue(), 'SECOND-CONTRACT'); assert.equal(await page.locator('#ct_f').inputValue(), 'future');
});
await run('scroll memory belongs to the entry even when the invoice URL is identical', async () => {
  await go('/invoices?view=all'); await page.locator('#inv_search').fill(''); await page.getByRole('combobox', { name: 'Revenue source', exact: true }).selectOption('all'); await page.getByRole('button', { name: 'Year to date', exact: true }).click(); await page.waitForTimeout(500); await page.evaluate(() => scrollTo(0, 1100)); await page.waitForTimeout(250); const firstY = await page.evaluate(() => scrollY);
  // The header is static. A normal Playwright click scrolls it into view before
  // navigation, replacing the saved position with zero. Dispatch the same link
  // action without that test-driver scroll to isolate history restoration.
  await newInvoiceVisit(true); await page.evaluate(() => scrollTo(0, 2200)); await page.waitForTimeout(250); const secondY = await page.evaluate(() => scrollY); assert.ok(secondY - firstY > 100);
  await back(); await back(); await page.waitForFunction((y) => Math.abs(scrollY - y) < 8, firstY); assert.ok(Math.abs(await page.evaluate(() => scrollY) - firstY) < 8, `first: ${await page.evaluate(() => scrollY)} expected ${firstY}`);
  await forward(); await forward(); await page.waitForFunction((y) => Math.abs(scrollY - y) < 8, secondY); assert.ok(Math.abs(await page.evaluate(() => scrollY) - secondY) < 8, `second: ${await page.evaluate(() => scrollY)} expected ${secondY}`);
  await page.screenshot({ path: `${out}/restored-scroll.png` });
});
await run('changing institution cannot restore another institution’s list snapshot', async () => {
  await go('/invoices?view=all'); await page.locator('#inv_search').fill('HQ-ONLY-SEARCH'); await page.waitForTimeout(450);
  await page.getByRole('combobox', { name: 'Organization', exact: true }).selectOption('riyadh'); await page.locator('#inv_search').waitFor(); await page.waitForTimeout(700);
  assert.equal(await page.locator('#inv_search').inputValue(), ''); await page.locator('#inv_search').fill('RIYADH-SEARCH'); await page.waitForTimeout(450);
  await page.getByRole('combobox', { name: 'Organization', exact: true }).selectOption('mof-hq'); await page.locator('#inv_search').waitFor(); await page.waitForTimeout(700);
  assert.equal(await page.locator('#inv_search').inputValue(), 'HQ-ONLY-SEARCH');
});
await run('a nonadjacent contextual return copies the old view into an independent entry', async () => {
  await go('/invoices?view=all'); await page.locator('#inv_search').fill(''); await page.waitForTimeout(500);
  const id = await page.locator('button[aria-label^="View details:"]').first().innerText(); await page.locator('#inv_search').fill(id); await page.waitForTimeout(500);
  const original = await page.evaluate(() => history.state.ibEntry); await page.locator('button[aria-label^="View details:"]').first().click(); await page.locator('.rp-return').waitFor();
  await page.evaluate(() => { history.pushState({ idx: history.state.idx + 1, key: crypto.randomUUID(), usr: history.state.usr }, '', location.pathname + '?section=items'); dispatchEvent(new PopStateEvent('popstate', { state: history.state })); }); await page.locator('.rp-return').click(); await page.waitForURL('**/invoices?view=all');
  assert.notEqual(await page.evaluate(() => history.state.ibEntry), original); assert.equal(await page.locator('#inv_search').inputValue(), id);
  await page.locator('#inv_search').fill('CLONED-VIEW'); await page.waitForTimeout(450); await back(); await page.locator('.rp-return').click(); await page.waitForURL('**/invoices?view=all'); assert.equal(await page.locator('#inv_search').inputValue(), id);
});
await run('an unavailable randomUUID API does not prevent an initial list from opening', async () => {
  await page.addInitScript(() => { Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }); });
  await go('/invoices?view=all&initial=uuid-unavailable'); await page.locator('#inv_search').waitFor(); assert.ok((await page.evaluate(() => history.state.ibEntry)).startsWith('entry-'));
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
