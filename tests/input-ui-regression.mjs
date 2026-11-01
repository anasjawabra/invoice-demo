import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-inputs'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => { try { sessionStorage.setItem('ib_lang', 'en'); } catch { /* blank document */ } });
const page = await context.newPage(); page.setDefaultTimeout(12000);
const results = [], errors = []; page.on('pageerror', (e) => errors.push(e.message));
async function go(path) { await page.goto(path); await page.waitForTimeout(600); }
async function run(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); }
  catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); }
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
const csv = (rows) => rows.map((r) => r.map((v) => /[,"\r\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v)).join(',')).join('\n');
async function upload(name, contents) { await page.locator('#up_file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(typeof contents === 'string' ? contents : csv(contents)) }); await page.waitForTimeout(150); }
const h = ['invoice_id', 'amanah', 'issue_date', 'amount'];
const row = (id, amount) => [id, 'Riyadh Amanah', '2026-01-01', amount];
const checks = (text) => page.locator('ul[aria-label="Validation checks"] li').filter({ hasText: text });
await go('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
await run('unclosed CSV quotes are rejected with the filename and a subsequent valid file recovers', async () => {
  await go('/settings/data-sources'); await upload('broken-quotes.csv', 'invoice_id,amanah,issue_date,amount,payer\nX,Riyadh Amanah,2026-01-01,100,"Alice');
  await page.getByText('Could not read “broken-quotes.csv”: the CSV quotation marks are invalid or incomplete. Fix the file and retry.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Import \d/ }).count(), 0);
  await upload('recovered.csv', [h, row('BOUND-RECOVERED', '100')]); await page.getByRole('button', { name: /^Import 1 accepted/ }).waitFor();
});
await run('ambiguous amount columns have a specific error instead of choosing a value', async () => {
  await upload('duplicate-columns.csv', [[...h, 'gross_amount'], [...row('BOUND-DUP', '100'), '200']]);
  await page.getByText('Could not import “duplicate-columns.csv”: multiple columns identify “gross”. Keep one column for each field and retry.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Import \d/ }).count(), 0);
});
await run('malformed and imprecise amounts are rejected while Arabic decimal amounts import exactly', async () => {
  await upload('amount-boundaries.csv', [h, row('BOUND-ARABIC', '١٬٢٣٤٫٥٦'), row('BOUND-COMMA', '1,2'), row('BOUND-HEX', '0x10'), row('BOUND-LARGE', '9007199254740993')]);
  assert.equal(await checks('Amounts valid').locator('.rv-badge--bad').innerText(), '3');
  await page.getByRole('button', { name: /^Import 1 accepted/ }).click(); await page.getByRole('button', { name: 'Imported', exact: true }).waitFor();
  await page.getByText('Integrity checks pass', { exact: true }).waitFor();
  await go('/invoices/BOUND-ARABIC'); await page.locator('#items summary').click();
  assert.equal(await page.locator('#items tbody tr td:last-child').first().innerText(), '1,234.56 SAR');
});
const lh = ['invoice_id', 'issue_date', 'invoice_value', 'line_no', 'line_amount'];
await run('an invalid later line rejects the invoice and identifies the row', async () => {
  await go('/settings/data-sources'); await upload('bad-second-line.csv', [lh, ['BOUND-LINE', '2026-01-01', '100', '1', '60'], ['BOUND-LINE', '2026-01-01', '100', '2', 'bad']]);
  await page.getByText('Line amount is missing or invalid; the invoice amount was not substituted — row 3', { exact: true }).waitFor();
  assert.equal(await checks('Amounts valid').locator('.rv-badge--bad').innerText(), '1'); assert.equal(await page.getByRole('button', { name: /^Import 0 accepted/ }).isDisabled(), true);
  await page.screenshot({ path: `${out}/invalid-line.png` });
});
await run('conflicting invoice totals and duplicate line numbers fail the consistency check', async () => {
  await upload('conflicting-lines.csv', [lh, ['BOUND-TOTAL', '2026-01-01', '100', '1', '60'], ['BOUND-TOTAL', '2026-01-01', '200', '2', '40'], ['BOUND-DUPLINE', '2026-01-01', '100', '1', '60'], ['BOUND-DUPLINE', '2026-01-01', '100', '1', '40']]);
  assert.equal(await checks('Repeated invoice fields and line numbers agree').locator('.rv-badge--bad').innerText(), '2');
  assert.equal(await page.getByRole('button', { name: /^Import 0 accepted/ }).isDisabled(), true);
});
await run('paid amounts, invalid dates and unsupported currency have matching failed checks', async () => {
  await upload('field-boundaries.csv', [[...h, 'paid_amount', 'paid_date', 'currency'], [...row('BOUND-PAID', '100'), '-1', '2026-01-02', 'SAR'], [...row('BOUND-NODATE', '100'), '10', '', 'SAR'], ['BOUND-DATE', 'Riyadh Amanah', '2026-13-01', '100', '', '', 'SAR'], [...row('BOUND-USD', '100'), '', '', 'USD']]);
  assert.equal(await checks('Amounts valid').locator('.rv-badge--bad').innerText(), '1');
  assert.equal(await checks('Dates valid and in order').locator('.rv-badge--bad').innerText(), '2');
  assert.equal(await checks('Revenue source and currency supported').locator('.rv-badge--bad').innerText(), '1');
  await page.locator('ul[aria-label="Validation checks"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/field-validation.png` });
});
await run('missing line amounts stay unknown in the imported invoice instead of becoming zero or its total', async () => {
  await upload('missing-line-amounts.csv', [lh.slice(0, 4), ['BOUND-UNKNOWN', '2026-01-01', '100', '1'], ['BOUND-UNKNOWN', '2026-01-01', '100', '2']]);
  await page.getByRole('button', { name: /^Import 1 accepted/ }).click(); await page.getByRole('button', { name: 'Imported', exact: true }).waitFor();
  await go('/invoices/BOUND-UNKNOWN'); await page.locator('#items summary').click();
  assert.deepEqual(await page.locator('#items tbody tr td:last-child').allTextContents(), ['—', '—']);
  await page.screenshot({ path: `${out}/unknown-line-amounts.png` });
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
