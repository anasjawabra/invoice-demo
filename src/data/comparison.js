import { previousScope, compareSnapshots } from './revenueMetrics';

// Like-for-like comparison: BOTH periods are measured at the end of their own period (same age), never one at today and the other
// a year later. When the current period ends today (the default), its figures are the main snapshot itself.
export async function loadComparison(data, scope, cfg, mainSnapshot) {
  const pv = previousScope({ from: scope.from, to: scope.to });
  const atEnd = { cfg: { ...cfg, collectionsAsOf: 'periodEnd' } };
  const same = scope.to >= cfg.cutoff;
  const [curr, prev] = await Promise.all([
    same ? Promise.resolve(mainSnapshot) : data.snapshot({ from: scope.from, to: scope.to, amanah: scope.amanah, source: scope.source, scopeType: scope.scopeType, muni: scope.muni, status: scope.status }, atEnd),
    data.snapshot({ from: pv.from, to: pv.to, basis: pv.basis, amanah: scope.amanah, source: scope.source, scopeType: scope.scopeType, muni: scope.muni, status: scope.status }, atEnd)
  ]);
  return { curr, prev, comparison: compareSnapshots(curr, prev) };
}
