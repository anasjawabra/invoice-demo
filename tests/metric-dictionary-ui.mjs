import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.UI_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href : 'playwright');
const out = '.audit-artifacts/2026-10-25-metric-dictionary';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [], errors = [];
try {
  for (const [lang, width] of [['en', 1440], ['ar', 375]]) {
    const context = await browser.newContext({ baseURL: process.env.UI_AUDIT_URL || 'http://127.0.0.1:4200', viewport: { width, height: 1000 } });
    await context.addInitScript((lang) => sessionStorage.setItem('ib_lang', lang), lang);
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/login');
    await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123');
    await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
    await page.goto('/settings/metrics'); await page.locator('.rv-metric-list article').first().waitFor();
    const articles = page.locator('.rv-metric-list article');
    const total = await articles.count(); assert.equal(total, 16);
    const values = await page.locator('.rv-metric-value').allTextContents();
    assert.equal(values.length, 11); assert.ok(values.every((v) => v.trim().length));
    assert.equal(await page.locator('.rv-metric-list a[href="/planning"]').count(), 5);
    const text = await page.locator('.rv-metric-list').innerText();
    assert.match(text, lang === 'en' ? /coverage target × adjusted expenditure budget/ : /مستهدف التغطية × ميزانية النفقات/);
    assert.match(text, lang === 'en' ? /Current demo policy S9/ : /سياسة العرض الحالية S9/);
    assert.match(text, lang === 'en' ? /Pending business confirmation/ : /بانتظار تأكيد الجهة المختصة/);
    assert.match(text, lang === 'en' ? /due date \+ grace ≥ cutoff/ : /تاريخ الاستحقاق \+ فترة السماح ≥ تاريخ القطع/);
    assert.equal(await articles.filter({ hasText: lang === 'en' ? 'Planning inputs have not been measured' : 'لم يُقَس اكتمال مدخلات التخطيط' }).count(), 5);
    for (const [i, view] of ['metrics', 'rules', 'formulas', 'mapping'].entries()) {
      // Native buttons support keyboard activation in both RTL and LTR.
      const button = page.locator('.metric-dictionary-views button').nth(i);
      await button.focus(); await page.keyboard.press('Enter');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.metric-dictionary-views [aria-pressed="true"]').count(), 1);
      const count = await articles.count(); assert.equal(count, view === 'rules' ? 12 : total);
      if (view === 'rules') {
        const enf = articles.filter({ has: page.locator('h2', { hasText: 'ENF-1' }) });
        assert.match(await enf.innerText(), /S9/);
        assert.doesNotMatch(await enf.innerText(), /NOT applied|stays cancelled \(conditions/);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${lang} ${view} horizontal overflow`);
      await page.screenshot({ path: `${out}/${lang}-${view}.png` });
      results.push({ lang, width, view, cards: count, passed: true });
    }
    await page.locator('.rv-metric-list a[href="/planning"]').first().click();
    await page.waitForURL('**/planning'); await page.locator('#tg-overall').waitFor();
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
console.log(`${results.length} dictionary views passed; planning links and keyboard navigation passed; no page errors.`);
