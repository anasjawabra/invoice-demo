import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { handleApi } from '../server/api.js';
process.env.APP_MODE = 'production';
const server = http.createServer((req, res) => handleApi(req, res)); server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  const base = `http://127.0.0.1:${server.address().port}/api`;
  for (const route of ['/meta', '/sanad-cases', '/export.csv?session=demo&size=full', '/list', '/invoice', '/upload', '/upload/clear', '/exclusions/validate', '/workflow/records']) {
    const response = await fetch(base + route, { method: route.includes('meta') || route.includes('sanad') || route.includes('export') ? 'GET' : 'POST', headers: { 'content-type': 'application/json', 'x-session': 'forged', authorization: 'Bearer forged' }, body: route.includes('meta') || route.includes('sanad') || route.includes('export') ? undefined : JSON.stringify({ owner: 1, scope: { org: { amanahKeys: [] } }, records: [] }) });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'production_backend_not_configured' });
  }
  console.log('Production mode denies all nine tested demo API routes before data generation, including workflow validation, forged credentials and scope.');
} finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
