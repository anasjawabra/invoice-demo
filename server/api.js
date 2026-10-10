// HTTP layer. One JSON endpoint per question the UI asks; every endpoint is answered from the columnar store.
import { riyadhToday } from '../src/data/clock.js';
import { currentStore } from './store.js';
import { snapshot, series, bridge, makeCtx, lookupId } from './engine.js';
import { list, exportChunks, worklist, anomalies, risk, bumpEpoch } from './lists.js';
import { contractCards, contractCard, contractRollup, sanadCases } from './contracts.js';
import { meta, quality } from './misc.js';
import { sourcesReport } from './sourcesReport.js';
import { resolveReferences, sameDebtorInvoices } from './orderMatch.js';
import { detail } from './materialize.js';
import { appendRecord } from './fixtures.js';

const memo = new Map();
const MAX_MEMO = 60;
function memoize(key, fn) {
  if (memo.has(key)) { const v = memo.get(key); memo.delete(key); memo.set(key, v); return v; }
  const v = fn(); memo.set(key, v); if (memo.size > MAX_MEMO) memo.delete(memo.keys().next().value); return v;
}
let epoch = 0;
const ownerOf = (sess) => { if (!sess) return 0; let h = 7; for (const ch of String(sess)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0; return 1 + (h % 60000); };

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > 20e6) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}
const send = (res, code, obj) => { const body = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); };
const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));

export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const hdr = (k) => { const v = req.headers[k]; return Array.isArray(v) ? v[0] : v; };
  const st = currentStore(hdr('x-demo-today') || url.searchParams.get('today'), hdr('x-demo-size') || url.searchParams.get('size'));
  const today = st.meta.today;
  const owner = ownerOf(hdr('x-session') || url.searchParams.get('session'));
  try {
    if (req.method === 'GET' && path === '/meta') return send(res, 200, memoize(`meta|${today}|${epoch}|${owner}`, () => meta(st, today)));
    if (req.method === 'GET' && path === '/sanad-cases') return send(res, 200, { cases: memoize(`cases|${today}`, () => sanadCases(st)) });
    if (req.method === 'GET' && path === '/export.csv') {
      const body = JSON.parse(url.searchParams.get('q') || '{}'); body.owner = owner; body.cfg = { ...(body.cfg || {}), cutoff: today };
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="invoices-${today}.csv"`, 'Cache-Control': 'no-store' });
      const it = exportChunks(st, body);
      const pump = () => { for (;;) { const { value, done } = it.next(); if (done) { res.end(); return; } if (!res.write(value)) { res.once('drain', pump); return; } } };
      return pump();
    }
    if (req.method !== 'POST') return send(res, 404, { error: 'not_found' });
    const body = await readBody(req);
    body.owner = owner; body.cfg = { ...(body.cfg || {}), cutoff: path === '/series' && body.asOf && body.asOf < today ? body.asOf : today };
    const key = (k) => `${k}|${today}|${epoch}|${stable(body)}`;
    switch (path) {
      case '/snapshot': return send(res, 200, memoize(key('snap'), () => snapshot(st, body)));
      case '/series': return send(res, 200, memoize(key('series'), () => series(st, body)));
      case '/bridge': return send(res, 200, memoize(key('bridge'), () => bridge(st, body)));
      case '/list': return send(res, 200, list(st, body));
      case '/worklist': return send(res, 200, memoize(key('wl'), () => worklist(st, body)));
      case '/anomalies': return send(res, 200, memoize(key('an'), () => anomalies(st, body)));
      case '/risk': return send(res, 200, memoize(key('risk'), () => risk(st, body)));
      case '/sources': return send(res, 200, memoize(key('src'), () => sourcesReport(st, body)));
      case '/quality': return send(res, 200, memoize(key('q'), () => quality(st, body)));
      case '/contracts': return send(res, 200, memoize(key('ct'), () => { const cards = contractCards(st, body); return { cards, rollup: contractRollup(cards) }; }));
      case '/contract': { const c = contractCard(st, body, body.no); return c ? send(res, 200, c) : send(res, 404, { error: 'contract_not_found' }); }
      case '/invoice': {
        const i = lookupId(st, body.id);
        if (i < 0 || (st.owner[i] !== 0 && st.owner[i] !== owner)) return send(res, 404, { error: 'invoice_not_found' });
        return send(res, 200, detail(st, i, makeCtx(st, body)));
      }
      case '/order-match': return send(res, 200, resolveReferences(st, body));
      case '/order-debtor-invoices': return send(res, 200, sameDebtorInvoices(st, body));
      case '/upload': {
        const recs = [];
        const duplicates = [];
        for (const r of body.records || []) { const ex = lookupId(st, r.id); if (ex >= 0 && (st.owner[ex] === 0 || st.owner[ex] === owner)) duplicates.push(r.id); else recs.push(r); }
        if (st.n + recs.length > st.cap || st.pn + recs.length * 3 > st.pcap) return send(res, 413, { error: 'upload_capacity_exceeded' });
        for (const r of recs) appendRecord(st, r, { owner, kind: 'upload' });
        epoch += 1; bumpEpoch();
        return send(res, 200, { ok: true, added: recs.length, duplicates });
      }
      case '/upload/clear': {
        let n = 0; for (let i = st.nGen; i < st.n; i += 1) if (st.owner[i] === owner && owner !== 0) { st.owner[i] = 65535; n += 1; }
        epoch += 1; bumpEpoch();
        return send(res, 200, { ok: true, removed: n });
      }
      default: return send(res, 404, { error: 'not_found' });
    }
  } catch (e) {
    console.error('[api]', path, e);
    return send(res, 500, { error: 'server_error', message: String(e.message || e) });
  }
}
export { riyadhToday };
