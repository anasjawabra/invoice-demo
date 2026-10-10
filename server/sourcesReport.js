// Per-source profile + live counts + integrity checks («بيانات تجريبية»). Served by /api/sources and used by the verification script.
import { SOURCES, SOURCE_INDEX as IS, ITEMS, F, GRP, grpOf, extOf, dayNum, isoOf } from '../src/data/catalog.js';
import { SOURCE_PROFILE, ASSUMPTIONS, PARAMS } from '../src/data/sourceAssumptions.js';
import { makeCtx, derive, snapshot } from './engine.js';

const shiftYear = (iso, d) => `${Number(iso.slice(0, 4)) + d}${iso.slice(4)}`;

export function sourcesReport(st, req = {}) {
  const ctx = makeCtx(st, req); const D = ctx.D;
  const today = ctx.cfg.cutoff; const y = today.slice(0, 4);
  const range = { ytd: [dayNum(`${y}-01-01`), ctx.cutoffN], prior: [dayNum(`${Number(y) - 1}-01-01`), dayNum(shiftYear(today, -1))] };
  const NS = SOURCES.length;
  const mk = () => ({ invoices: 0, lines: 0, payments: 0, gross: 0, grossCancelled: 0, wallet: 0, replacedPairs: 0, ownersMulti: 0, ext: [0, 0, 0, 0], objections: 0, billStatus: [0, 0, 0, 0], valuesDiffer: 0, paidOverGross: 0, amtConflict: 0, enforcement: 0, internal: 0, central: 0, items: {} });
  const acc = { ytd: Array.from({ length: NS }, mk), prior: Array.from({ length: NS }, mk), all: Array.from({ length: NS }, mk) };
  const checks = { idsStrictlyIncreasing: true, duplicateIds: 0, tobaccoPairsBroken: 0, whiteLandGroupsBroken: 0, groupShareNot100: 0, cancelledAndExcludedOverlap: 0 };
  let prevKey = -1;
  for (let i = 0; i < st.nGen; i += 1) {
    const k = st.idKey[i]; if (k <= prevKey) { checks.idsStrictlyIncreasing = false; if (k === prevKey) checks.duplicateIds += 1; } prevKey = k;
    const s = st.src[i]; const a = [acc.all[s]]; const iss = st.issue[i];
    if (iss >= range.ytd[0] && iss <= range.ytd[1]) a.push(acc.ytd[s]);
    if (iss >= range.prior[0] && iss <= range.prior[1]) a.push(acc.prior[s]);
    derive(ctx, i, ctx.cutoffN);
    const g = grpOf(st.flags[i]); const e = extOf(st.flags[i]);
    for (const x of a) {
      x.invoices += 1; x.lines += st.lines[i]; x.payments += st.payCount[i]; x.gross += st.gross[i];
      if (D.cancelled) x.grossCancelled += st.gross[i];
      if (D.received > st.gross[i] + 0.5) x.paidOverGross += 1;
      if (st.flags[i] & F.AMT_CONFLICT) x.amtConflict += 1;
      if (st.scope[i] === 1) x.internal += 1; else x.central += 1;
      x.items[ITEMS[st.item[i]].key] = (x.items[ITEMS[st.item[i]].key] || 0) + 1;
      if (st.exec[i] >= 0) x.enforcement += 1;
      if (s === IS.tobacco || s === IS.accommodation) { // tobacco / accommodation: wallet settlement and replaced disclosures
        for (let p = st.payStart[i]; p < st.payStart[i] + st.payCount[i]; p += 1) if (st.pCh[p] === 5) x.wallet += st.pAmt[p];
        if (g === GRP.TB_REPLACED && s === IS.tobacco) x.replacedPairs += 1;
      }
      if (s === IS.white_lands) { if (g !== 0) x.ownersMulti += 1; x.ext[e] += 1; if (st.flags[i] & F.OBJECTION) x.objections += 1; }
    }
    if (iss >= range.ytd[0] && iss <= range.ytd[1] && s === IS.licenses) {
      const paid = D.received; const code = D.cancelled ? 2 : paid >= st.gross[i] - 0.5 ? 1 : 0;
      acc.ytd[s].billStatus[code] += 1;
    }
    if (D.cancelled && D.excluded) checks.cancelledAndExcludedOverlap += 1; // can never be true: cancelled wins
    if (g === GRP.TB_REPLACED && s === IS.tobacco && st.cancelDay[i]) { // the replacement is visible exactly when the original is cancelled
      const n = i + 1; if (!(n < st.nGen && grpOf(st.flags[n]) === GRP.TB_REPLACEMENT && st.payer[n] === st.payer[i] && st.cancelDay[i] === st.issue[n])) checks.tobaccoPairsBroken += 1;
    }
    if (s === IS.white_lands && (g === GRP.WL_HEAD2 || g === GRP.WL_HEAD3)) {
      const n = g === GRP.WL_HEAD2 ? 2 : 3; let sum = 0; let ok = true;
      for (let j = 1; j < n; j += 1) { const q = i + j; if (q >= st.nGen || grpOf(st.flags[q]) !== (j === 1 ? GRP.WL_OWN2 : GRP.WL_OWN3) || st.issue[q] !== st.issue[i]) ok = false; sum += q < st.nGen ? st.gross[q] : 0; }
      if (!ok) checks.whiteLandGroupsBroken += 1;
      sum += st.gross[i]; if (!(sum > 0)) checks.groupShareNot100 += 1;
    }
  }
  let fixturesYtd = 0; for (let i = st.nGen; i < st.n; i += 1) if (st.owner[i] === 0 && st.issue[i] >= range.ytd[0] && st.issue[i] <= range.ytd[1]) fixturesYtd += 1;
  // financial view straight from the metric layer (the same numbers every screen shows)
  const sc = { from: `${y}-01-01`, to: today, amanah: 'all', source: 'all' };
  const scp = { from: `${Number(y) - 1}-01-01`, to: shiftYear(today, -1), amanah: 'all', source: 'all' };
  const sn = snapshot(st, { ...req, scope: sc, cfg: ctx.cfg }); const sp = snapshot(st, { ...req, scope: scp, cfg: ctx.cfg });
  const fin = (snap) => Object.fromEntries(snap.bySource.map((g) => [g.key, { count: g.count, gross: g.gross, net: g.net, collected: g.collected, outstanding: g.outstanding, cancelled: g.cancelled, exclusions: g.exclusions, rate: g.collectedOverNet }]));
  const finY = fin(sn); const finP = fin(sp);
  const sumBy = (f, k) => Object.values(f).reduce((t, v) => t + v[k], 0);
  const totals = { ytd: sn.totals, prior: sp.totals };
  const reconcile = {
    ytdCountMatches: sumBy(finY, 'count') === sn.totals.count, ytdGrossMatches: Math.abs(sumBy(finY, 'gross') - sn.totals.gross) < 1, ytdCollectedMatches: Math.abs(sumBy(finY, 'collected') - sn.totals.collected) < 1, ytdOutstandingMatches: Math.abs(sumBy(finY, 'outstanding') - sn.totals.outstanding) < 1,
    priorCountMatches: sumBy(finP, 'count') === sp.totals.count, priorGrossMatches: Math.abs(sumBy(finP, 'gross') - sp.totals.gross) < 1,
    countByLoopMatchesSnapshot: acc.ytd.reduce((t, x) => t + x.invoices, 0) + fixturesYtd === sn.population.issuedInPeriod
  };
  const sources = SOURCES.map((s, k) => ({
    key: s.key, platform: s.platform, profile: SOURCE_PROFILE[s.key] || null,
    ytd: { ...acc.ytd[k], financial: finY[s.key] || null }, prior: { ...acc.prior[k], financial: finP[s.key] || null }, allTime: { invoices: acc.all[k].invoices, lines: acc.all[k].lines, payments: acc.all[k].payments },
    assumptions: ASSUMPTIONS.filter((a) => a.sources.includes('all') || a.sources.includes(s.key)).map((a) => a.id)
  }));
  const enforcement = { whiteLandsOrders: st.requests.filter((q) => q.system === 'white_lands').length, sanadRequests: st.requests.filter((q) => (q.system || 'sanad') === 'sanad').length };
  return { fixturesYtd, today, period: { from: sc.from, to: sc.to, priorFrom: scp.from, priorTo: scp.to }, sources, totals, reconcile, checks, enforcement, params: PARAMS, generatedAt: isoOf(ctx.cutoffN) };
}
