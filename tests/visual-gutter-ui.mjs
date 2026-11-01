import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = '.audit-artifacts/2026-10-25-release/gutters'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4188' });
await page.goto('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
const results = [];
for (const width of [375,768,1280,1440]) {
  await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(250);
  const actual = await page.evaluate(() => Object.fromEntries(['.content','.topbar','.tabbar'].map((selector) => { const css=getComputedStyle(document.querySelector(selector)); return [selector, { left: parseFloat(css.paddingLeft), right: parseFloat(css.paddingRight) }]; })));
  const expected = width === 375 ? 16 : 32;
  for (const values of Object.values(actual)) { assert.equal(values.left, expected); assert.equal(values.right, expected); }
  results.push({ width, expected, actual }); await page.screenshot({ path: `${out}/${width}.png` });
}
await browser.close(); await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2)); console.log('4 viewport checks passed for content, header and navigation gutters.');
