import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out = process.env.UI_AUDIT_OUTPUT || '.audit-artifacts/2026-10-25-keyboard/modal'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage();
const results = [], errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.route('http://keyboard.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' })); await page.goto('http://keyboard.test/'); await page.evaluate(() => sessionStorage.setItem('ib_lang', 'en')); await page.addScriptTag({ path: '.test-build/keyboard-modal-harness.js' });
async function run(name, fn) { await fn(); results.push({ name, passed: true }); console.log(`ok ${name}`); }
const modal = page.locator('[role=dialog][aria-modal=true]');
await run('Escape on a running task invokes background once and restores focus', async () => {
  await page.locator('#start').click(); await modal.waitFor(); await page.keyboard.press('Escape'); await modal.waitFor({ state: 'detached' });
  assert.deepEqual(await page.evaluate(() => window.keyboardHarness.calls), { close: 0, background: 1 }); assert.equal(await page.locator('#start').evaluate((el) => el === document.activeElement), true);
});
await run('completion keeps existing focus and Escape uses the completed task callback', async () => {
  await page.locator('#start').click(); await modal.waitFor(); await modal.getByRole('button', { name: 'Cancel', exact: true }).focus(); await page.evaluate(() => window.keyboardHarness.finish()); await modal.getByRole('button', { name: 'Close', exact: true }).waitFor(); assert.equal(await modal.evaluate((el) => el.contains(document.activeElement)), true);
  await page.keyboard.press('Escape'); await modal.waitFor({ state: 'detached' }); assert.deepEqual(await page.evaluate(() => window.keyboardHarness.calls), { close: 1, background: 1 });
});
await run('browser Tab excludes hidden, inert, negative-tabindex and fieldset-disabled actions', async () => {
  await page.locator('#start').click(); await modal.waitFor();
  await modal.evaluate((el) => { const host = document.createElement('div'); host.innerHTML = '<button style="visibility:hidden">Hidden</button><button tabindex="-1">Skipped</button><div inert><button>Inert</button></div><fieldset disabled><button>Disabled by fieldset</button></fieldset>'; el.append(host); });
  const first = modal.getByRole('button', { name: 'Run in background', exact: true }); const last = modal.getByRole('button', { name: 'Cancel', exact: true });
  await last.focus(); await page.keyboard.press('Tab'); assert.equal(await first.evaluate((el) => el === document.activeElement), true);
  await page.keyboard.press('Shift+Tab'); assert.equal(await last.evaluate((el) => el === document.activeElement), true);
});
await browser.close(); assert.equal(errors.length, 0, errors.join('\n')); await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
