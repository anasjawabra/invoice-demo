import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-access'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => sessionStorage.setItem('ib_lang', 'en'));
const page = await context.newPage(); page.setDefaultTimeout(12000);
const results = [], errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function go(path) { await page.goto(path); await page.waitForTimeout(650); }
async function login(user = 'demo', org = 'mof-hq') {
  await page.locator('#login-username').fill(user); await page.locator('#login-password').fill('demo123'); await page.locator('#login-org').selectOption(org);
  await page.locator('button[type=submit]').click(); await page.waitForURL((url) => url.pathname !== '/login'); await page.waitForTimeout(600);
}
async function post(endpoint, body) {
  return page.evaluate(async ({ endpoint, body }) => {
    const r = await fetch(`/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session': sessionStorage.getItem('ib_session_id') }, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json() };
  }, { endpoint, body });
}
async function run(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); }
  catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); }
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
let foreignInvoice, foreignContract;
const scope = { from: '2000-01-01', to: '2026-10-25', amanah: 'all', source: 'all' };
const restricted = { ...scope, org: { amanahKeys: ['Riyadh Amanah'] } };
await run('sign-in returns to the original deep link and does not store a password', async () => {
  await go('/invoices?view=all#evidence'); await page.waitForURL('**/login'); await login();
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash, '/invoices?view=all#evidence');
  assert.equal(await page.evaluate(() => 'pass' in JSON.parse(sessionStorage.getItem('ib_user'))), false);
});
await run('invoice and contract details respect the same institution scope as lists', async () => {
  const all = await post('list', { scope, filters: { state: 'all' }, pageSize: 500 });
  const own = all.data.rows.find((r) => r.amanahEn === 'Riyadh Amanah'); foreignInvoice = all.data.rows.find((r) => r.amanahEn !== 'Riyadh Amanah');
  assert.ok(own && foreignInvoice);
  assert.equal((await post('invoice', { scope: restricted, id: own.id })).status, 200);
  assert.equal((await post('invoice', { scope: restricted, id: foreignInvoice.id })).status, 404);
  const contracts = await post('contracts', { scope }); foreignContract = contracts.data.cards.find((c) => c.amanahEn !== 'Riyadh Amanah');
  assert.ok(foreignContract); assert.equal((await post('contract', { scope: restricted, no: foreignContract.contractNo })).status, 404);
});
await run('reference matching reveals no invoice or contract outside the chosen institution', async () => {
  const r = await post('order-match', { scope: restricted, refs: [{ kind: 'invoice_id_exact', value: foreignInvoice.id }, { kind: 'contract_no', value: foreignContract.contractNo }] });
  assert.equal(r.data.results[0].status, 'unmatched'); assert.deepEqual(r.data.results[0].candidates, []);
  assert.equal(r.data.results[1].status, 'contract_not_found'); assert.equal(r.data.results[1].contract, null);
});
await run('changing institution on an open invoice replaces the old detail with an inaccessible state', async () => {
  await go(`/invoices/${encodeURIComponent(foreignInvoice.id)}`); await page.locator('.rp-titlebar').waitFor();
  await page.getByRole('combobox', { name: 'Organization', exact: true }).selectOption('riyadh');
  await page.getByRole('heading', { name: 'Invoice not found', exact: true }).waitFor(); assert.equal(await page.locator('.rp-figures').count(), 0);
  await page.screenshot({ path: `${out}/institution-detail-blocked.png` });
});
await run('changing accounts creates a fresh upload session and clears its import log', async () => {
  await page.evaluate(() => { sessionStorage.setItem('ib_session_id', 'old-account-session'); sessionStorage.setItem('ib_rev_uploads', JSON.stringify({ count: 7, log: [] })); });
  await go('/login'); await login('auditor');
  assert.notEqual(await page.evaluate(() => sessionStorage.getItem('ib_session_id')), 'old-account-session');
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('ib_rev_uploads')).count), 0);
});
await run('auditor can read planning but cannot edit targets', async () => {
  await go('/planning'); const input = page.locator('input[aria-label^="Coverage target"]').first(); await input.waitFor();
  assert.equal(await input.isDisabled(), true); assert.equal(await page.locator('#tg-overall').count(), 0);
  await page.screenshot({ path: `${out}/auditor-planning.png` });
});
await run('auditor can back up but cannot restore local business records', async () => {
  await go('/smart-reports'); await page.getByText('Examples, about the assistant, where my data is kept', { exact: true }).click(); await page.locator('#local-data summary').click();
  assert.equal(await page.locator('#local-import').isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Download a backup', exact: true }).isEnabled(), true);
  await page.getByText('Your role is read-only: you can download a backup but cannot replace data.', { exact: true }).waitFor();
  await page.screenshot({ path: `${out}/auditor-backup.png` });
});
if (!process.env.UI_AUDIT_URL || process.env.UI_AUDIT_URL.includes(':4173')) await run('direct read-only provider actions reject imports and preserve configuration', async () => {
  const uploads = [];
  const listener = (r) => { if (/\/api\/upload(?:\/clear)?$/.test(r.url())) uploads.push(r.url()); }; page.on('request', listener);
  await page.evaluate(async () => {
    const { mountProbe } = await import('/tests/fixtures/access-provider-probe.jsx');
    const container = document.createElement('div'); document.body.append(container); window.__unmountAccessProbe = mountProbe(container);
  });
  await page.waitForFunction(() => window.__accessProbe);
  const result = await page.evaluate(() => { const r = window.__accessProbe; window.__unmountAccessProbe(); return r; });
  page.off('request', listener);
  assert.ok(result.errors.every((error) => error.includes('Read-only role'))); assert.equal(result.after, result.before);
  assert.equal(result.note.error, 'no_permission'); assert.equal(result.legacy.error, 'no_permission'); assert.equal(uploads.length, 0);
});
await run('persisted role and organisation fields are rebuilt from the demo account catalogue', async () => {
  await page.evaluate(() => sessionStorage.setItem('ib_user', JSON.stringify({ user: 'auditor', pass: 'obsolete', canReview: true, org: { id: 'riyadh', amanahKeys: null } })));
  await go('/planning'); await page.getByText('Your role is read-only: you cannot edit targets.', { exact: true }).waitFor();
  const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ib_user')));
  assert.equal(stored.canReview, false); assert.equal('pass' in stored, false); assert.deepEqual(stored.org.amanahKeys, ['Riyadh Amanah']);
});
await run('invalid persisted identity returns to login without runtime errors', async () => {
  await page.evaluate(() => sessionStorage.setItem('ib_user', JSON.stringify({ canReview: true })));
  await go('/products/foras'); await page.waitForURL('**/login'); assert.equal(await page.locator('#login-username').isVisible(), true);
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
