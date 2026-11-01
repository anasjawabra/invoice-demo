import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-keyboard'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => { try { sessionStorage.setItem('ib_lang', 'en'); } catch {} });
const page = await context.newPage(); page.setDefaultTimeout(12000);
const results = [], errors = []; page.on('pageerror', (e) => errors.push(e.message));
async function go(path) { await page.goto(path); await page.waitForTimeout(700); }
async function run(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); } catch (e) { results.push({ name, passed: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`); await page.screenshot({ path: `${out}/failure-${results.length}.png` }); } await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2)); }
await go('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
await run('metric explanation receives focus, has an accessible name and Escape returns to its trigger', async () => {
  await go('/insights'); const button = page.locator('.rv-def__btn').first(); await button.focus(); await page.keyboard.press('Enter');
  const pop = page.locator('.rv-def__pop'); await pop.waitFor();
  assert.equal(await pop.evaluate((el) => el === document.activeElement), true); assert.ok(await pop.getAttribute('aria-label'));
  await page.keyboard.press('Tab'); assert.equal(await pop.locator('summary').evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press('Escape'); assert.equal(await pop.count(), 0); assert.equal(await button.evaluate((el) => el === document.activeElement), true);
});
await run('tabbing beyond a metric explanation closes it without taking focus back', async () => {
  await go('/insights'); const button = page.locator('.rv-def__btn').first(); await button.focus(); await page.keyboard.press('Enter');
  const pop = page.locator('.rv-def__pop'); await pop.waitFor(); await pop.getByRole('link').focus(); await page.keyboard.press('Tab');
  assert.equal(await pop.count(), 0); assert.equal(await button.evaluate((el) => el === document.activeElement), false);
});
await run('opening the metric dictionary by keyboard moves focus to the new page heading', async () => {
  await go('/insights'); await page.locator('.rv-def__btn').first().focus(); await page.keyboard.press('Enter');
  const pop = page.locator('.rv-def__pop'); await pop.getByRole('link').focus(); await page.keyboard.press('Enter'); await page.waitForURL('**/settings/metrics');
  await page.waitForFunction(() => document.querySelector('main h1') === document.activeElement);
  assert.equal(await pop.count(), 0);
});
await run('Operations opens by keyboard and closes on Escape and when Tab leaves', async () => {
  await go('/collection'); const button = page.getByRole('button', { name: 'Operations', exact: true }); await button.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  assert.equal(await page.locator('#ops-menu a').first().evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press('Escape'); assert.equal(await button.getAttribute('aria-expanded'), 'false'); assert.equal(await button.evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press('Enter'); await page.locator('#ops-menu a').last().focus(); await page.keyboard.press('Tab'); assert.equal(await button.getAttribute('aria-expanded'), 'false');
});
for (const lang of ['en', 'ar']) await run(`mobile preferences closes with Escape and restores focus (${lang})`, async () => {
  await page.setViewportSize({ width: 390, height: 844 }); await go('/collection');
  if (lang === 'ar') { await page.locator('.topbar-toggle').click(); await page.getByRole('button', { name: 'العربية', exact: true }).click(); await page.locator('.topbar-toggle').click(); }
  const button = page.locator('.topbar-toggle'); await button.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
  assert.equal(await button.getAttribute('aria-expanded'), 'false'); assert.equal(await button.evaluate((el) => el === document.activeElement), true);
  await page.screenshot({ path: `${out}/preferences-${lang}.png` });
});
await run('analysis dialog keeps forward and reverse Tab inside, then Escape restores the initiating button', async () => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await go('/collection');
  const trigger = page.getByRole('button', { name: 'Analyze reasons for noncollection', exact: true }); await trigger.focus(); await page.keyboard.press('Enter');
  const modal = page.locator('[role=dialog][aria-modal=true]'); await modal.waitFor(); await page.keyboard.press('Shift+Tab');
  assert.equal(await modal.evaluate((el) => el.contains(document.activeElement)), true);
  await page.keyboard.press('Tab'); assert.equal(await modal.evaluate((el) => el.contains(document.activeElement)), true);
  await page.keyboard.press('Escape'); await modal.waitFor({ state: 'detached' }); assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); assert.equal(results.filter((r) => !r.passed).length, 0);
