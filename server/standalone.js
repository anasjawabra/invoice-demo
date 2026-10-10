// Production entry: serves the built SPA (./dist) and the data service (/api/*) from ONE process.
// Bundled to dist-server/server.mjs (npm run build:server); no npm install is needed at runtime.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';
import { currentStore } from './store.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = fs.existsSync(path.join(here, '..', 'dist')) ? path.join(here, '..', 'dist') : path.join(here, 'dist');
const PORT = process.env.PORT || process.env._APP_PORT || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json' };

const sendFile = (res, filePath) => { res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': /\/assets\//.test(filePath) ? 'public, max-age=31536000, immutable' : 'no-cache' }); fs.createReadStream(filePath).pipe(res); };
const sendIndex = (res) => fs.readFile(path.join(DIST, 'index.html'), (err, data) => { if (err) { res.writeHead(500, { 'Content-Type': 'text/plain' }); return res.end('dist/index.html not found — run npm run build'); } res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(data); });

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/api' || urlPath.startsWith('/api/')) return await handleApi(req, res);
    if (urlPath === '/') return sendIndex(res);
    const filePath = path.join(DIST, urlPath);
    if (!filePath.startsWith(DIST)) { res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Forbidden'); }
    fs.stat(filePath, (err, stat) => (!err && stat.isFile() ? sendFile(res, filePath) : sendIndex(res))); // SPA fallback for React Router
    return undefined;
  } catch (e) { console.error(e); res.writeHead(500, { 'Content-Type': 'text/plain' }); return res.end('Server error'); }
});

server.listen(PORT, '0.0.0.0', () => {
  const t = Date.now(); currentStore(); // build the demo world for today (Asia/Riyadh) before the first request
  console.log(`INTELLIBILL listening on port ${PORT} · demo world ready in ${Date.now() - t} ms`);
});
