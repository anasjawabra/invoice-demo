import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = '.audit-artifacts/2026-10-25-rescan'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const routes = ['/insights', '/planning', '/smart-reports', '/enforcement', '/exclusions', '/products', '/invoices?view=all', '/collection', '/contracts', '/risk', '/settings/data-sources', '/settings/data-quality', '/settings/metrics', '/decisions'];
const results = [], errors = [], apiErrors = [];
try {
  for (const [lang, width] of [['en', 1440], ['ar', 375]]) {
    const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4201', viewport: { width, height: 1000 } });
    await context.addInitScript((l) => sessionStorage.setItem('ib_lang', l), lang);
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', (e) => errors.push({ lang, url: page.url(), error: e.message }));
    page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) apiErrors.push({ url: r.url(), status: r.status() }); });
    await page.goto('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
    const detailRoutes = new Set();
    for (const path of routes) {
      await page.goto(path); await page.locator('h1').first().waitFor(); await page.waitForLoadState('networkidle');
      const prefix = path === '/contracts' ? '/contracts/' : path === '/products' ? '/products/' : path === '/enforcement' ? '/enforcement-orders/' : null;
      if (prefix) { const link = page.locator(`a[href^="${prefix}"]`).first(); await link.waitFor(); detailRoutes.add(await link.getAttribute('href')); }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${lang} ${path}: page overflow`);
      assert.ok((await page.locator('h1').first().innerText()).trim());
      await page.screenshot({ path: `${out}/${lang}-${path.split('?')[0].replaceAll('/', '_')}.png` });
      results.push({ lang, width, path, heading: await page.locator('h1').first().innerText(), passed: true });
      if (path === '/invoices?view=all') { await page.locator('table tbody button.rv-link').first().click(); await page.waitForURL('**/invoices/*'); detailRoutes.add(new URL(page.url()).pathname); }
    }
    assert.equal(detailRoutes.size, 4);
    for (const path of detailRoutes) {
      await page.goto(path); await page.locator('h1').first().waitFor(); await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('[role="alert"]').count(), 0, `${lang} ${path}: detail load alert`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${lang} ${path}: overflow`);
      results.push({ lang, width, path, heading: await page.locator('h1').first().innerText(), passed: true });
    }
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(apiErrors, []);
} finally {
  await writeFile(`${out}/pages.json`, JSON.stringify({ results, errors, apiErrors }, null, 2));
  await browser.close();
}
console.log(`${results.length} page checks passed across English desktop and Arabic mobile.`);
