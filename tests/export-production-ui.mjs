import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium }=await import(pathToFileURL(process.env.UI_PLAYWRIGHT_MODULE).href);
const out='.audit-artifacts/2026-10-25-release/production-exports'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}); const page=await browser.newPage({baseURL:'http://127.0.0.1:4188'}); const errors=[]; page.on('pageerror',(e)=>errors.push(e.message));
await page.addInitScript(()=>sessionStorage.setItem('ib_lang','en'));
await page.goto('/login'); await page.locator('#login-username').fill('demo'); await page.locator('#login-password').fill('demo123'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/insights');
await page.goto('/smart-reports'); await page.locator('#sr-input').fill('revenue report this month'); await page.locator('.sr-composer__btn').click(); await page.locator('.sr-card').first().waitFor({timeout:45000});
const results=[];
for(const [label,extension] of [['Word','docx'],['PowerPoint','pptx']]){const pending=page.waitForEvent('download',{timeout:60000});await page.getByRole('button',{name:label,exact:true}).last().click();const file=await pending;await file.saveAs(`${out}/report.${extension}`);assert.equal(await file.failure(),null);results.push({format:extension,downloaded:true});}
await page.evaluate(()=>{const descriptor=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow');Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{...descriptor,get(){const win=descriptor.get.call(this);win.print=()=>{window.__exportPrintHtml=win.document.documentElement.outerHTML;};return win;}});});
await page.getByRole('button',{name:'PDF',exact:true}).last().click();await page.waitForFunction(()=>!!window.__exportPrintHtml,{},{timeout:15000});const html=await page.evaluate(()=>window.__exportPrintHtml);assert.match(html,/Report context and filters/);await writeFile(`${out}/report.html`,html);const print=await browser.newPage();await print.setContent(html);await print.pdf({path:`${out}/report.pdf`,printBackground:true,preferCSSPageSize:true});await print.close();results.push({format:'pdf',printFrameCaptured:true});
await browser.close();await writeFile(`${out}/results.json`,JSON.stringify({results,errors},null,2));assert.deepEqual(errors,[]);console.log('Production Word, PowerPoint and PDF print actions passed.');
