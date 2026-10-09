// Inputs of the Planning Room model, aggregated by the data service. The Planning Room never receives invoices:
// every figure below is a server-side aggregate over the whole population (snapshots and monthly series).
import { provincesFromSnapshot } from './provinceStats';
import { addDaysIso } from './clock';

export const LOOKBACK_MONTHS = 12;
const addMonths = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const monthSpan = (from, to) => { const [fy, fm] = from.slice(0, 7).split('-').map(Number); const [ty, tm] = to.slice(0, 7).split('-').map(Number); return (ty - fy) * 12 + (tm - fm) + 1; };
const ratioPct = (r) => (r && r.calculable ? Math.round(r.value * 1000) / 10 : null);

// shape the Planning Room model expects as "kpi"
export function kpiFromSnapshot(snap) {
  const t = snap.totals; const nc = snap.noncollection;
  const uncollectedCount = ['objection', 'enforcement', 'linkage_unresolved', 'ineligible_referral', 'partial', 'overdue', 'not_due'].reduce((s, k) => s + nc[k].count, 0);
  return {
    gross: t.gross, adjustments: t.adjustments, excludedCount: t.excludedCount + t.cancelledCount, excludedValue: t.exclusions, cancelledValue: t.cancelled, ruleExcludedValue: t.exclusionsRules, netInvoiced: t.net,
    collectedCount: Math.max(0, t.count - t.cancelledCount - t.excludedCount - uncollectedCount), collectedValue: t.collected,
    uncollectedCount, uncollectedValue: t.outstanding, collectionRate: ratioPct(t.collectedOverNet), invoiceCount: t.count
  };
}

// exclusion breakdown by APPROVED category only (objection / enforcement are states, not exclusions)
export function exclusionsFromSnapshot(snap) {
  const cats = { duplicate: { count: 0, value: 0 }, appeal: { count: 0, value: 0 }, invalid_debtor: { count: 0, value: 0 }, enforcement: { count: 0, value: 0 }, cancelled: { count: snap.totals.cancelledCount, value: snap.totals.cancelled } };
  for (const [c, e] of Object.entries(snap.exclusionsByCategory || {})) {
    const key = c === 'duplicate' ? 'duplicate' : c === 'objection' ? 'appeal' : c === 'enforcement' ? 'enforcement' : 'invalid_debtor';
    cats[key].count += e.count; cats[key].value += e.amount;
  }
  return cats;
}

const seriesRows = (ser, periodStart, n) => { const sums = Array(n).fill(0); ser.months.forEach((m, i) => { const idx = monthSpan(periodStart, `${m}-01`) - 1; if (idx >= 0 && idx < n) sums[idx] += ser.values[i]; }); return sums.map((value, i) => ({ month: i, value })); };

export async function buildPlanningData(data, { amanah = 'all', periodStart, periodEnd, cutoff }) {
  const scope = (from, to, am = amanah) => ({ from, to, amanah: am, source: 'all' });
  const elapsedEnd = periodEnd < cutoff ? periodEnd : cutoff;
  const lookbackStart = addMonths(periodStart, -LOOKBACK_MONTHS);
  const histEnd = addDaysIso(periodStart, -1);
  const ALL = '2000-01-01';
  const [snapP, snapAll, snapNat, snapHist, serElapsed, serLook, risk] = await Promise.all([
    data.snapshot(scope(periodStart, periodEnd)),
    data.snapshot(scope(ALL, cutoff)),
    amanah === 'all' ? Promise.resolve(null) : data.snapshot(scope(ALL, cutoff, 'all')),
    data.snapshot(scope(ALL, histEnd)),
    elapsedEnd >= periodStart ? data.series(scope(periodStart, elapsedEnd), { asOf: elapsedEnd }) : Promise.resolve({ months: [], values: [] }),
    data.series(scope(lookbackStart, histEnd), { asOf: histEnd }),
    data.risk(scope(periodStart, periodEnd), { limit: 5 })
  ]);
  const empty = snapP.population.issuedInPeriod === 0;
  const base = empty ? snapAll : snapP; // a period with no invoices falls back to everything, as before
  const elapsedMonths = elapsedEnd >= periodStart ? monthSpan(periodStart, elapsedEnd) : 0;
  const histBase = snapHist.population.issuedInPeriod ? snapHist : snapAll;
  const natGross = (snapNat || snapAll).totals.gross;
  const scopeShare = natGross ? Math.min(1, Math.max(0.02, snapAll.totals.gross / natGross)) : 1;
  const nc = base.noncollection;
  const flagCount = Object.values(risk.categories).reduce((s, c) => s + c.count, 0);
  const flagAmount = Object.values(risk.categories).reduce((s, c) => s + (c.amount || 0), 0);
  const shares = provincesFromSnapshot(base);
  const totalGross = shares.reduce((s, p) => s + p.gross, 0);
  return {
    today: cutoff, scope: amanah,
    kpi: kpiFromSnapshot(snapP), exclusions: exclusionsFromSnapshot(snapP),
    monthlyActuals: elapsedMonths ? seriesRows(serElapsed, periodStart, elapsedMonths) : [],
    lookbackSeries: seriesRows(serLook, lookbackStart, LOOKBACK_MONTHS),
    historicalRate: ratioPct(histBase.totals.collectedOverNet) ?? 0,
    scopeShare, overdueOutstanding: nc.overdue.amount + nc.partial.amount,
    amanahShares: shares.map((p) => ({ ...p, share: totalGross ? p.gross / totalGross : 0 })).sort((a, b) => b.gross - a.gross),
    riskFlags: { count: flagCount, amount: flagAmount, categories: risk.categories },
    aging: snapAll.stock.agingPlanning, avgDaysOverdue: snapAll.stock.avgDaysOverdue, objectionOutstanding: snapAll.stock.objectionOutstanding, invoiceCount: snapAll.totals.count,
    snapshot: snapP
  };
}
