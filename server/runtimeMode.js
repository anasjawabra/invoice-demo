// Deployment configuration is trusted; request headers/query parameters are not.
// The synthetic store is never a production data adapter.
export function runtimeMode(env = process.env) {
  const configured = env.APP_MODE;
  if (configured && !['demo', 'production'].includes(configured)) return 'blocked';
  if (configured === 'production') return 'production';
  if (env.NODE_ENV === 'production' && configured !== 'demo') return 'production';
  return 'demo';
}

export function requireDemoBackend(res) {
  if (runtimeMode() === 'demo') return true;
  res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error: 'production_backend_not_configured' }));
  return false;
}
