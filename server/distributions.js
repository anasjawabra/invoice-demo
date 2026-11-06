// Distribution data for the chart library (docs/chart-library.md «Chart data»): histogram bins, box-plot quartiles and the Amanah → municipality → revenue-source cells of the
// SAME scope the report is built for. ONE columnar pass per population; invoice-level values never leave the server — only bins, quartiles and aggregated cells do.
//
// Populations (each reconciles to a figure the report already shows):
//   amount          the period cohort of the financial snapshot (issued in the period, in scope, measured at the same reference date): n = snapshot.totals.count; value = gross billed
//   overdueStanding the standing balance of the aging chart (everything issued up to the cutoff and still owed): n + dueUnknown = Σ snapshot.stock.aging[1..4].count; notDue = aging[0]
//   overduePeriod   the non-collection cohort (period invoices owing, with a known due date and past due): n = nonCollectionAnalysis.populations.overdue.count
// Scope, permissions (org Amanah keys), municipality, source, product and status filters are resolved by the engine's resolveScope / inScope — exactly as snapshot() and list().
// Exclusions follow the approved rules through derive(): the amount histogram counts every invoice of the cohort (gross billed, before exclusions); the overdue distributions hold only
// invoices that still owe an amount (excluded and cancelled invoices owe none).
//
// Quartiles: linear interpolation between order statistics (type 7: position (n-1)·p, as Excel QUARTILE.INC / R default). Whiskers: the most extreme observation within 1.5 × IQR of the
// quartiles (never inside the box: with interpolated quartiles a whisker end is clamped to the box edge); the observations beyond are outliers (at most MAX_OUTLIERS per group are listed, `outlierCount` is the total). A group with fewer than MIN_BOX observations is NOT drawn (listed in `skipped`).
import { ENTITIES, SOURCES, isoOf } from '../src/data/catalog.js';
import { MUNI_SLOTS, slotOf, municipalityOfCode } from '../src/data/municipalityModel.js';
import { makeCtx, resolveScope, derive, inScope } from './engine.js';
import { ncAsOf } from './noncollection.js';

export const MIN_BOX = 5;
export const MAX_OUTLIERS = 5;
const r2 = (x) => Math.round(x * 100) / 100; // halalas: statistics are reported to 2 decimals (counts and bins stay exact)
const MAX_DAY_BINS = 16;
const DAY_WIDTHS = [30, 60, 90, 180, 365, 730, 1460];

/** quantile by linear interpolation of a SORTED array (type 7) */
export function quantile(sorted, p) {
  const n = sorted.length; if (!n) return null;
  const pos = (n - 1) * p; const lo = Math.floor(pos); const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
/** a five-number summary with Tukey whiskers; null for no observations */
export function fiveNumber(values) {
  const v = Float64Array.from(values).sort(); const n = v.length; if (!n) return null;
  const q1 = quantile(v, 0.25); const median = quantile(v, 0.5); const q3 = quantile(v, 0.75); const iqr = q3 - q1; const loF = q1 - 1.5 * iqr; const hiF = q3 + 1.5 * iqr;
  let lo = v[0]; let hi = v[n - 1]; const out = [];
  for (let k = 0; k < n; k += 1) if (v[k] >= loF) { lo = v[k]; break; }
  for (let k = n - 1; k >= 0; k -= 1) if (v[k] <= hiF) { hi = v[k]; break; }
  for (let k = 0; k < n; k += 1) if (v[k] < loF || v[k] > hiF) out.push(v[k]);
  // the most extreme outliers first (capped); the count is complete
  out.sort((a, b) => Math.abs(b - median) - Math.abs(a - median));
  return { n, min: r2(Math.min(lo, q1)), q1: r2(q1), median: r2(median), q3: r2(q3), max: r2(Math.max(hi, q3)), outliers: out.slice(0, MAX_OUTLIERS).map(r2), outlierCount: out.length, trueMin: r2(v[0]), trueMax: r2(v[n - 1]) };
}

/* ---- amount bins: 1-2-5 steps on a log scale, half-open [lo, hi); only the contiguous range that holds observations is returned (empty interior bins stay) */
const AMOUNT_EDGES = (() => { const e = [0]; for (let p = 3; p <= 13; p += 1) for (const m of [1, 2, 5]) e.push(m * 10 ** p); return e; })();
const amountBin = (v) => { if (!(v >= AMOUNT_EDGES[1])) return 0; let lo = 1; let hi = AMOUNT_EDGES.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (AMOUNT_EDGES[mid] <= v) lo = mid; else hi = mid - 1; } return lo; };
const trim = (counts, amounts, edgeLo, edgeHi) => {
  let a = 0; while (a < counts.length && counts[a] === 0) a += 1; let b = counts.length - 1; while (b >= 0 && counts[b] === 0) b -= 1;
  const bins = []; for (let k = a; k <= b; k += 1) bins.push({ lo: edgeLo(k), hi: edgeHi(k), count: counts[k], amount: r2(amounts[k]) });
  return bins;
};
const groupsOf = (arrs, keyOf) => {
  const groups = []; const skipped = [];
  for (const [k, v] of arrs) { if (!v.length) continue; if (v.length < MIN_BOX) { skipped.push({ key: keyOf(k), n: v.length }); continue; } groups.push({ key: keyOf(k), ...fiveNumber(v) }); }
  groups.sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1)); skipped.sort((a, b) => (a.key < b.key ? -1 : 1));
  return { groups, skipped };
};
const push = (m, k, v) => { let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push(v); };

export function chartDistributions(st, req) {
  const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope); const D = ctx.D; const NS = SOURCES.length;
  const asOf = ncAsOf(ctx, sc); // the period cohort is measured exactly as the snapshot and the non-collection analysis do
  const { fromN, toN } = sc;
  // ---- accumulators
  const aCounts = new Array(AMOUNT_EDGES.length - 1).fill(0); const aAmounts = new Array(AMOUNT_EDGES.length - 1).fill(0); const aAll = []; let aSum = 0;
  const aByEnt = new Map(); const aBySrc = new Map();
  const standing = []; const standingByEnt = new Map(); let sNotDue = { count: 0, amount: 0 }; let sUnknown = { count: 0, amount: 0 }; let sAmountByVal = [];
  const period = []; const periodByEnt = new Map(); let pAmountByVal = [];
  const cells = new Map(); // (entity, municipality slot, source) -> net · collected · uncollected · count
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    const e = st.ent[i]; const s = st.src[i];
    // ---- the standing balance (issued up to the cutoff, measured at the cutoff)
    derive(ctx, i, ctx.cutoffN);
    if ((!sc.statusSet || sc.statusSet[D.cls]) && D.outstanding > 0) {
      if (!(st.due[i] > 0)) { sUnknown.count += 1; sUnknown.amount += D.outstanding; } else if (D.daysOverdue > 0) { standing.push(D.daysOverdue); sAmountByVal.push(D.outstanding); push(standingByEnt, e, D.daysOverdue); } else { sNotDue.count += 1; sNotDue.amount += D.outstanding; }
    }
    if (st.issue[i] < fromN || st.issue[i] > toN) continue;
    // ---- the period cohort
    const dd = asOf === ctx.cutoffN ? D : derive(ctx, i, asOf);
    if (sc.statusSet && !sc.statusSet[dd.cls]) continue;
    const g = dd.gross; const b = amountBin(g); aCounts[b] += 1; aAmounts[b] += g; aSum += g; aAll.push(g); push(aByEnt, e, g); push(aBySrc, s, g);
    { const slot = slotOf(e, st.mref[i]); const k = (e * MUNI_SLOTS + slot) * NS + s; let c = cells.get(k); if (!c) { c = [0, 0, 0, 0]; cells.set(k, c); } c[0] += dd.net; c[1] += dd.collected; c[2] += dd.outstanding; c[3] += 1; }
    if (dd.outstanding > 0 && st.due[i] > 0 && dd.daysOverdue > 0) { period.push(dd.daysOverdue); pAmountByVal.push(dd.outstanding); push(periodByEnt, e, dd.daysOverdue); }
  }
  // ---- equal-width day bins (width chosen from a fixed list so the count stays readable; the same bins in every language)
  const dayHist = (vals, amts) => {
    if (!vals.length) return { n: 0, binWidth: null, bins: [] };
    let mx = 0; for (const v of vals) if (v > mx) mx = v; const w = DAY_WIDTHS.find((x) => Math.ceil(mx / x) <= MAX_DAY_BINS) || DAY_WIDTHS[DAY_WIDTHS.length - 1];
    const nb = Math.ceil(mx / w); const counts = new Array(nb).fill(0); const amounts = new Array(nb).fill(0);
    vals.forEach((v, k) => { const bi = Math.min(nb - 1, Math.floor((v - 1) / w)); counts[bi] += 1; amounts[bi] += amts[k]; });
    return { n: vals.length, binWidth: w, bins: counts.map((count, k) => ({ lo: k * w + 1, hi: (k + 1) * w, count, amount: r2(amounts[k]) })) };
  };
  const stat = (v) => { const f = fiveNumber(v); return f ? { n: f.n, min: f.trueMin, q1: f.q1, median: f.median, q3: f.q3, max: f.trueMax } : null; };
  const entKey = (e) => ENTITIES[e].en; const srcKey = (s) => SOURCES[s].key;
  const aH = trim(aCounts, aAmounts, (k) => AMOUNT_EDGES[k], (k) => AMOUNT_EDGES[k + 1]);
  // ---- Amanah → municipality → source cells (net · collected · uncollected), one row per cell
  const tree = []; for (const [k, c] of cells) {
    const s = k % NS; const g = Math.floor(k / NS); const e = Math.floor(g / MUNI_SLOTS); const slot = g % MUNI_SLOTS; const en = ENTITIES[e].en; const m0 = slot >= 4 ? municipalityOfCode(e, slot) : null;
    tree.push({ amanah: en, muni: m0 ? m0.key : `${en}|${slot === 1 ? 'DIRECT' : slot === 2 ? 'UNRESOLVED' : 'NOT_SPECIFIED'}`, source: srcKey(s), net: c[0], collected: c[1], outstanding: c[2], count: c[3] });
  }
  tree.sort((x, y) => (x.amanah < y.amanah ? -1 : x.amanah > y.amanah ? 1 : x.muni < y.muni ? -1 : x.muni > y.muni ? 1 : x.source < y.source ? -1 : 1));
  return {
    version: 1, kind: 'distributions', cutoff: ctx.cfg.cutoff, asOf: isoOf(asOf),
    scope: { from: sc.from, to: sc.to, amanah: req.scope?.amanah ?? 'all', source: req.scope?.source ?? 'all', muni: req.scope?.muni ?? 'all', status: req.scope?.status ?? 'all' },
    method: { quantile: 'linear interpolation between order statistics (type 7: position (n − 1)·p)', whisker: '1.5 × IQR', minBox: MIN_BOX, amountBins: '1-2-5 steps on a log scale, half-open [lo, hi)', dayBins: 'equal width, inclusive [lo, hi] in days' },
    amount: { n: aAll.length, sum: aSum, summary: stat(aAll), bins: aH, box: { byAmanah: groupsOf(aByEnt, entKey), bySource: groupsOf(aBySrc, srcKey) } },
    overdueStanding: { ...dayHist(standing, sAmountByVal), notDue: sNotDue, dueUnknown: sUnknown, summary: stat(standing), box: { byAmanah: groupsOf(standingByEnt, entKey) } },
    overduePeriod: { ...dayHist(period, pAmountByVal), summary: stat(period), box: { byAmanah: groupsOf(periodByEnt, entKey) } },
    tree
  };
}
