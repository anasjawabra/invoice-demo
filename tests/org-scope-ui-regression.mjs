import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-org-scope'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => { try { sessionStorage.setItem('ib_lang', 'en'); } catch {} });
const page = await context.newPage(); page.setDefaultTimeout(12000); const results = [], errors = [], requests = [];
page.on('pageerror', (e) => errors.push(e.message)); page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/')) requests.push({ url: r.url(), body: r.postDataJSON() }); });
async function go(path) { await page.goto(path); await page.waitForTimeout(700); }
async function run(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); } catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); } await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2)); }
async function org(value) { await page.getByRole('combobox', { name: 'Organization', exact: true }).selectOption(value); await page.locator('#rv-amanah').waitFor(); await page.waitForTimeout(750); }
async function seed(value) { await page.evaluate((value) => { const user = JSON.parse(sessionStorage.getItem('ib_user')); const prefix = `ib_history_v1_${encodeURIComponent(user.user + '|' + user.org.id)}_`; const key = Object.keys(sessionStorage).find((k) => k.startsWith(prefix) && k.includes(encodeURIComponent(history.state.ibEntry)) && k.endsWith('_scope')); if (!key) throw new Error('Current institution snapshot was not found'); const scope = JSON.parse(sessionStorage.getItem(key)); sessionStorage.setItem(key, JSON.stringify({ ...scope, ...value })); }, value); await page.reload(); await page.waitForTimeout(750); }
const req = () => requests.filter((r) => r.url.endsWith('/api/list')).at(-1)?.body;
await go('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
await run('switching from a foreign city and municipality opens a usable regional list', async () => {
  await go('/invoices?view=all'); await page.locator('#rv-amanah').selectOption('Jeddah Amanah'); await page.locator('#rv-muni').selectOption('Jeddah Amanah|South'); await page.waitForTimeout(400); await org('riyadh');
  assert.equal(await page.locator('#rv-amanah').inputValue(), 'all'); assert.equal(await page.locator('#rv-muni').count(), 0); assert.equal(req().scope.amanah, 'all'); assert.deepEqual(req().scope.org.amanahKeys, ['Riyadh Amanah']);
  await page.locator('button[aria-label^="View details:"]').first().waitFor();
});
await run('each institution keeps its own source and location settings', async () => {
  await page.locator('#rv-source').selectOption('investment'); await page.waitForTimeout(500); await org('mof-hq'); assert.equal(await page.locator('#rv-amanah').inputValue(), 'Jeddah Amanah');
  await page.locator('#rv-source').selectOption('fines'); await page.waitForTimeout(400); await org('riyadh'); assert.equal(await page.locator('#rv-source').inputValue(), 'investment'); assert.equal(await page.locator('#rv-amanah').inputValue(), 'all');
});
await run('an out-of-access deep link is reset visibly and export uses the same legal scope', async () => {
  await go('/invoices?view=all&amanah=Jeddah%20Amanah'); await page.getByTestId('scope-adjusted').waitFor(); assert.equal(await page.locator('#rv-amanah').inputValue(), 'all');
  const form = page.locator('form[action*="/api/export.csv"] input[name=q]'); const payload = await form.count() ? JSON.parse(await form.inputValue()) : JSON.parse(new URL(await page.locator('a[href*="/api/export.csv"]').getAttribute('href'), page.url()).searchParams.get('q')); assert.equal(payload.scope.amanah, 'all'); assert.deepEqual(payload.scope.org.amanahKeys, ['Riyadh Amanah']); assert.equal(payload.scope.source, req().scope.source); const summary = requests.filter((r) => r.url.endsWith('/api/snapshot')).at(-1)?.body; assert.equal(summary.scope.amanah, payload.scope.amanah); assert.deepEqual(summary.scope.org.amanahKeys, payload.scope.org.amanahKeys);
  await page.screenshot({ path: `${out}/scope-reset.png` }); await page.getByTestId('scope-adjusted').getByRole('button', { name: 'Dismiss', exact: true }).click(); assert.equal(await page.getByTestId('scope-adjusted').count(), 0); assert.equal(await page.locator('#rv-amanah').evaluate((el) => el === document.activeElement), true);
});
await run('a restored foreign history filter cannot silently empty a regional list', async () => {
  await seed({ amanah: 'Jeddah Amanah', muni: 'Jeddah Amanah|South' }); assert.equal(await page.locator('#rv-amanah').inputValue(), 'all'); await page.getByTestId('scope-adjusted').waitFor(); assert.equal(req().scope.amanah, 'all'); assert.equal(req().scope.muni, 'all');
});
await run('a real multi-entity filter names its selected entities instead of claiming all', async () => {
  await org('mof-hq'); await seed({ amanah: ['Riyadh Amanah', 'Jeddah Amanah'], muni: 'all' });
  assert.equal(await page.locator('#rv-amanah').inputValue(), '__subset'); const selected = await page.locator('#rv-amanah option:checked').innerText(); assert.match(selected, /Riyadh/); assert.match(selected, /Jeddah/); assert.deepEqual(req().scope.amanah, ['Riyadh Amanah','Jeddah Amanah']);
});
await run('a mismatched municipality is cleared while the valid entity and source remain', async () => {
  await seed({ amanah: 'Riyadh Amanah', muni: 'Jeddah Amanah|South', source: 'fines' }); assert.equal(await page.locator('#rv-amanah').inputValue(), 'Riyadh Amanah'); assert.equal(await page.locator('#rv-muni').inputValue(), 'all'); assert.equal(await page.locator('#rv-source').inputValue(), 'fines'); assert.equal(req().scope.muni, 'all'); await page.getByTestId('scope-adjusted').waitFor();
});
await run('a legitimate empty search keeps valid narrow filters and offers its real empty state', async () => {
  const notice = page.getByTestId('scope-adjusted'); if (await notice.count()) await notice.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.locator('#rv-muni').selectOption('Riyadh Amanah|North'); await page.locator('#inv_search').fill('NO-SUCH-INVOICE-ORG-SCOPE');
  await page.getByText('No invoices match these filters.', { exact: true }).waitFor(); assert.equal(req().scope.amanah, 'Riyadh Amanah'); assert.equal(req().scope.muni, 'Riyadh Amanah|North'); assert.equal(req().scope.source, 'fines'); assert.equal(await page.getByTestId('scope-adjusted').count(), 0);
  const exportForm = page.locator('form[action*="/api/export.csv"] input[name=q]'); const exportRequest = await exportForm.count() ? JSON.parse(await exportForm.inputValue()) : JSON.parse(new URL(await page.locator('a[href*="/api/export.csv"]').getAttribute('href'), page.url()).searchParams.get('q')); assert.equal(exportRequest.filters.search, 'NO-SUCH-INVOICE-ORG-SCOPE');
  await page.getByText('No invoices match these filters.', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/legitimate-empty.png` });
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
