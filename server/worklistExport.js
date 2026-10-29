import { makeCtx, resolveScope, derive, CLASSES } from './engine.js';
import { csvCell } from '../src/utils/csv.js';
import { worklistRows } from '../src/data/revenueInsights.js';
import { worklistBalance, listEpoch, ACT, W_, evidenceQuality, rowOut, exportValues, exportPreamble, EXPORT_COLUMNS } from './lists.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
function check(version, signal) {
  if (signal?.aborted) throw Object.assign(new Error('query_cancelled'), { name: 'AbortError' });
  if (version !== listEpoch()) throw Object.assign(new Error('dataset_changed_retry'), { status: 409 });
}
export async function prepareWorklistExport(st, req, { signal } = {}) {
  const version = listEpoch(); const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope);
  const ids = []; let maxAmt = 1; let maxAge = 1;
  for (let i = 0; i < st.n; i++) {
    if (i % 4096 === 0) { await tick(); check(version, signal); }
    const bal = worklistBalance(st, req, ctx, sc, i); if (bal == null) continue;
    ids.push(i); maxAmt = Math.max(maxAmt, bal); maxAge = Math.max(maxAge, ctx.D.daysOverdue);
  }
  const scores = new Float64Array(st.n);
  for (let k = 0; k < ids.length; k++) {
    if (k % 4096 === 0) { await tick(); check(version, signal); }
    const i = ids[k]; const bal = worklistBalance(st, req, ctx, sc, i); const D = ctx.D;
    scores[i] = W_.amount * (bal / maxAmt) + W_.aging * (D.daysOverdue / maxAge) + W_.actionability * (ACT[CLASSES[D.cls]] ?? 0.3) + W_.evidence * evidenceQuality(st, i, D);
  }
  let order = Int32Array.from(ids); let scratch = new Int32Array(ids.length);
  const cmp = (a, b) => scores[b] - scores[a] || a - b;
  for (let start = 0; start < order.length; start += 4096) { order.subarray(start, start + 4096).sort(cmp); await tick(); check(version, signal); }
  let operations = 0;
  for (let width = 4096; width < order.length; width *= 2) {
    for (let start = 0; start < order.length; start += 2 * width) {
      const mid = Math.min(start + width, order.length); const end = Math.min(mid + width, order.length); let a = start; let b = mid;
      for (let k = start; k < end; k++) {
        scratch[k] = b >= end || a < mid && cmp(order[a], order[b]) <= 0 ? order[a++] : order[b++];
        if (++operations % 16384 === 0) { await tick(); check(version, signal); }
      }
    }
    [order, scratch] = [scratch, order];
  }
  check(version, signal); return { order, scores, version };
}
export function* worklistExportChunks(st, req, prepared) {
  const { order, scores, version } = prepared; check(version);
  const ctx = makeCtx(st, req);
  const columns = [...EXPORT_COLUMNS, 'priority_rank', 'priority_score', 'category', 'next_step_en', 'next_step_ar'];
  yield exportPreamble(req, ctx, order.length, columns, { exportView: 'worklist', worklistFilters: { category: req.category || 'all', reason: req.reason || 'all', kind: req.kind || 'all', includeExcluded: !!req.includeExcluded }, sort: { key: 'priority', dir: 'desc' }, priorityWeights: W_ });
  let rows = [];
  for (let k = 0; k < order.length; k++) {
    if (k % 500 === 0) check(version);
    const i = order[k]; derive(ctx, i, ctx.cutoffN); const r = rowOut(st, ctx, i, ctx.D);
    const step = worklistRows({ rows: [{ category: r.cls }] })[0].nextStep;
    rows.push([...exportValues(st, i, r), k + 1, Math.round(scores[i] * 1000) / 1000, r.cls, step?.en || '', step?.ar || ''].map(csvCell).join(','));
    if (rows.length === 500) { yield rows.join('\n') + '\n'; rows = []; }
  }
  if (rows.length) yield rows.join('\n') + '\n';
}
