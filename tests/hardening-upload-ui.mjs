import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = '.audit-artifacts/2026-10-25-hardening/uploads'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4193' });
const errors = []; page.on('pageerror', (error) => errors.push(error.message));
const results = [];
try {
  await page.addInitScript(() => sessionStorage.setItem('ib_lang', 'en'));
  await page.goto('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123');
  await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights'); await page.goto('/settings/data-sources');
  const table = [['invoice_id', 'amanah', 'issue_date', 'amount'], ['WORKER-001', 'Riyadh Amanah', '2026-01-01', '1234.56']];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(table), 'Invoices');
  for (const [name, buffer] of [['valid.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })], ['valid.csv', Buffer.from(table.map((r) => r.join(',')).join('\n'))]]) {
    await page.locator('#up_file').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
    await page.getByRole('button', { name: 'Import 1 accepted invoice(s)', exact: true }).waitFor({ timeout: 20000 });
    results.push({ name, validPreview: true });
  }
  const zip = new JSZip(); zip.file('xl/worksheets/sheet1.xml', new Uint8Array(17 * 1024 * 1024));
  const bomb = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const cases = [
    ['oversize.csv', Buffer.alloc(10 * 1024 * 1024 + 1)],
    ['too-many.csv', Buffer.from([table[0], ...Array.from({ length: 5001 }, () => table[1])].map((r) => r.join(',')).join('\n'))],
    ['expanded.xlsx', bomb]
  ];
  for (const [name, buffer] of cases) {
    await page.locator('#up_file').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
    await page.getByText(/The file exceeds the import limit/).waitFor({ timeout: 20000 });
    assert.equal(await page.getByRole('button', { name: 'Import 1 accepted invoice(s)', exact: true }).count(), 0);
    results.push({ name, rejected: true });
  }
  await page.screenshot({ path: `${out}/rejected.png`, fullPage: true });
  assert.deepEqual(errors, []);
} finally { await writeFile(`${out}/page.txt`, await page.locator('body').innerText()); await page.screenshot({ path: `${out}/last-page.png`, fullPage: true }); await browser.close(); await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2)); }
console.log('Production worker: CSV/XLSX previews and byte/row/expanded archive rejection passed.');
