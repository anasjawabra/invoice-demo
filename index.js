/**
 * INTELLIBILL demo entry.
 * Starts the bundled server (SPA + data service) when it has been built (npm run build); otherwise falls back to the zero-dependency
 * static server below, in which case the pages cannot reach the data service and say so.
 */
import fs from 'node:fs';
const bundled = new URL('./dist-server/server.mjs', import.meta.url);
if (fs.existsSync(bundled)) { await import(bundled.href); } else {
  console.warn('dist-server/server.mjs not found - run `npm run build`; serving the static build only (no /api).');
  await import('./static-server.mjs');
}
