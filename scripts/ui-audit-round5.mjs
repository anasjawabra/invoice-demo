const endpoint = 'http://127.0.0.1:9223';
const viewportWidth = Number(process.argv[2]) || 1440;
const viewportHeight = Number(process.argv[3]) || 1000;
const summaryOnly = process.argv.includes('summary');
const quick = process.argv.includes('quick');
const screenshotArg = process.argv.find((arg) => arg.startsWith('screenshot='));
const screenshotLight = process.argv.includes('shot-light');
const pages = await fetch(`${endpoint}/json`).then((r) => r.json());
const page = pages.find((item) => item.type === 'page');
if (!page) throw new Error('No Edge page target found');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let id = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    browserErrors.push(message.params.exceptionDetails?.text || 'Runtime exception');
  }
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function navigate(path) {
  await send('Page.navigate', { url: `http://127.0.0.1:4173${path}` });
  await pause(900);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile: viewportWidth < 600 });
await navigate('/login');

await evaluate(`document.querySelector('form')?.requestSubmit()`);
await pause(1200);

const routes = ['/dashboard', '/invoices', '/risk', '/collection', '/assistant', '/smart-reports', '/what-if', '/decision-room', '/sanad-orders', '/investment-invoices'];
const modes = [
  { theme: 'light', lang: 'en' },
  { theme: 'dark', lang: 'ar' }
];
const results = [];
const generatedCharts = [];
let drawerAudit = null;

for (const mode of modes) {
  await evaluate(`sessionStorage.setItem('ib_theme', '${mode.theme}'); sessionStorage.setItem('ib_lang', '${mode.lang}')`);
  for (const route of routes) {
    await navigate(route);
    const audit = await evaluate(`(() => {
      const selectors = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="tab"],[role="switch"],[tabindex]:not([tabindex="-1"])';
      const visible = (el) => {
        const s = getComputedStyle(el); const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      const label = (el) => {
        const labelled = el.getAttribute('aria-labelledby');
        return (el.getAttribute('aria-label') || (labelled && document.getElementById(labelled)?.textContent) || el.title || el.innerText || el.value || el.placeholder || '').trim();
      };
      const controls = [...document.querySelectorAll(selectors)].filter(visible);
      const small = controls.map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), name: label(el).slice(0, 50), w: Math.round(r.width), h: Math.round(r.height), cls: el.className?.toString().slice(0, 60) || '' };
      }).filter((x) => x.w < 24 || x.h < 24);
      const compact = controls.filter((el) => /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || ['button', 'tab', 'switch'].includes(el.getAttribute('role'))).map((el) => {
        const target = /^(checkbox|radio)$/.test(el.type) && el.closest('label') ? el.closest('label') : el;
        const r = target.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), name: label(el).slice(0, 50), w: Math.round(r.width), h: Math.round(r.height), cls: el.className?.toString().slice(0, 60) || '' };
      }).filter((x) => x.w < 44 || x.h < 44);
      const unnamed = controls.filter((el) => !label(el)).map((el) => ({ tag: el.tagName.toLowerCase(), cls: el.className?.toString().slice(0, 80) || '', type: el.getAttribute('type') || '' }));
      const canvases = [...document.querySelectorAll('canvas')].map((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), pixels: [el.width, el.height] }; });
      const tables = [...document.querySelectorAll('.table-wrap, .strategic-table-wrap')].map((el) => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, keyboardScrollable: el.tabIndex >= 0 }));
      return {
        path: location.pathname,
        theme: document.documentElement.dataset.theme,
        dir: document.documentElement.dir,
        title: document.querySelector('h1')?.innerText || document.title,
        controls: controls.length,
        small,
        compact,
        unnamed,
        canvases,
        tables,
        overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth
      };
    })()`);
    results.push(audit);
  }
}

await evaluate(`sessionStorage.setItem('ib_theme', 'dark'); sessionStorage.setItem('ib_lang', 'ar')`);

await navigate('/invoices');
await evaluate(`document.querySelector('.row-clickable')?.click()`);
await pause(350);
drawerAudit = await evaluate(`(() => {
  const drawer = document.querySelector('.ai-drawer');
  if (!drawer) return null;
  const rect = drawer.getBoundingClientRect();
  const close = drawer.querySelector('.ai-drawer__close')?.getBoundingClientRect();
  return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height), viewport: [innerWidth, innerHeight], bodyScrollable: drawer.querySelector('.ai-drawer__body')?.scrollHeight > drawer.querySelector('.ai-drawer__body')?.clientHeight, close: close ? [Math.round(close.width), Math.round(close.height)] : null };
})()`);
await evaluate(`document.querySelector('.ai-drawer__close')?.click()`);

if (!quick) {
  await navigate('/smart-reports');
  await evaluate(`document.querySelector('.card.card-pad .btn-primary')?.click()`);
  await pause(6000);
  generatedCharts.push(await evaluate(`({ route: location.pathname, state: 'generated', canvases: [...document.querySelectorAll('canvas')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), c.width, c.height]; }) })`));

  await navigate('/what-if');
  await evaluate(`document.querySelector('.strategic-form')?.requestSubmit()`);
  await pause(5000);
  generatedCharts.push(await evaluate(`({ route: location.pathname, state: 'analyzed', canvases: [...document.querySelectorAll('canvas')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), c.width, c.height]; }) })`));

  await navigate('/decision-room');
  const tabCount = await evaluate(`document.querySelectorAll('.dr-subtabbar button').length`);
  for (let tabIndex = 0; tabIndex < tabCount; tabIndex += 1) {
    await evaluate(`document.querySelectorAll('.dr-subtabbar button')[${tabIndex}]?.click()`);
    await pause(250);
    generatedCharts.push(await evaluate(`({ route: location.pathname, state: document.querySelector('.dr-subtab.active')?.innerText || '${tabIndex}', canvases: [...document.querySelectorAll('canvas')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), c.width, c.height]; }) })`));
  }
}

await navigate('/dashboard');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
const focus = await evaluate(`(() => { const el = document.activeElement; const s = getComputedStyle(el); return { tag: el.tagName, name: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 60), outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor }; })()`);

if (screenshotArg) {
  if (screenshotLight) {
    await evaluate(`sessionStorage.setItem('ib_theme', 'light'); sessionStorage.setItem('ib_lang', 'en')`);
    await navigate('/dashboard');
  }
  const { writeFile } = await import('node:fs/promises');
  const filePath = screenshotArg.slice('screenshot='.length);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(filePath, Buffer.from(shot.data, 'base64'));
}

const report = summaryOnly ? {
  viewport: [viewportWidth, viewportHeight],
  pages: results.map(({ path, theme, dir, small, compact, unnamed, overflow, canvases, tables }) => ({ path, theme, dir, small, compact, unnamed, overflow, canvasCount: canvases.length, tables })),
  generatedCharts,
  drawerAudit,
  focus,
  browserErrors
} : { viewport: [viewportWidth, viewportHeight], results, generatedCharts, drawerAudit, focus, browserErrors };
console.log(JSON.stringify(report, null, 2));
socket.close();
