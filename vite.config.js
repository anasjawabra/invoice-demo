import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The data service (server/) holds the demo world in memory and answers /api/*. In dev it runs inside the Vite
// server (loaded through Vite's SSR loader so extensionless imports resolve); `npm start` runs the bundled build.
function dataService() {
  return {
    name: 'revenue-data-service',
    configureServer(server) {
      let api = null;
      server.middlewares.use('/api', async (req, res) => {
        try {
          if (!api) api = await server.ssrLoadModule('/server/api.js');
          req.url = `/api${req.url === '/' ? '' : req.url}`;
          await api.handleApi(req, res);
        } catch (e) { console.error(e); res.statusCode = 500; res.end(JSON.stringify({ error: 'server_error', message: String(e.message) })); }
      });
      // editing the data service or the shared catalog reloads it (and drops the in-memory world) on the next request
      server.watcher.on('change', (file) => {
        if (/[\\/](server|src[\\/]data[\\/](catalog|sourceAssumptions|clock|revenueMetrics|enforcementMatching))[\\/.]/.test(file) || /[\\/]server[\\/]/.test(file)) {
          for (const m of server.moduleGraph.idToModuleMap.values()) if (/[\\/]server[\\/]|src[\\/]data[\\/](catalog|sourceAssumptions|clock|revenueMetrics|enforcementMatching)/.test(m.id || '')) server.moduleGraph.invalidateModule(m);
          api = null;
          console.log('[data service] source changed: reloading on the next request');
        }
      });
      // warm the store so the first page load is fast
      server.httpServer?.once('listening', () => { server.ssrLoadModule('/server/store.js').then((m) => { const t = Date.now(); m.currentStore(); console.log(`[data service] demo world ready in ${Date.now() - t} ms`); }).catch((e) => console.error(e)); });
    }
  };
}

export default defineConfig({
  plugins: [react(), dataService()],
  server: { port: 3000, host: '0.0.0.0' },
  build: { outDir: 'dist', sourcemap: false }
});
