// ============================================================================
// Pure calculations of the strategic dashboard: fair (mix-adjusted) comparison of Amanahs, required collection pace, and the
// what-if scenario model. Nothing here fetches data; every input is a figure of the shared snapshot.
//
// SCENARIO RULES (documented in the UI):
//  * Levers act on the SAME pool in a fixed order, so nothing is counted twice:
//      1) billing change      → changes net billed; the added billing is collected only at the BASELINE rate (billing ≠ collection)
//      2) pending-case review → moves amounts between "net" and "excluded"; it is NEVER cash. Resolving a case as "collectible" changes nothing
//      3) collection-rate lever (percentage points of net billed) → cash, limited to what is still uncollected
//      4) overdue recovery (% of the collectible overdue/partial pool that is still open after step 3) → cash, limited to what is still uncollected
//  * Percentage-point changes are percentage points of net billed, never relative changes.
// ============================================================================
export const SCENARIO_LIMITS = { dRate: [-20, 30], recovery: [0, 100], resolve: [0, 100], approve: [0, 100], billing: [-30, 50], expense: [-30, 30], slip: [0, 100] };
export const DEFAULT_SCENARIO = { dRate: 0, recovery: 0, resolve: 0, approve: 0, billing: 0, expense: 0, slip: 0 };
const LIMIT_LABEL = { dRate: ['تغيير معدل التحصيل (نقطة مئوية)', 'Collection-rate change (pp)'], recovery: ['استرداد الأرصدة المتأخرة القابلة للتحصيل (%)', 'Recovery of collectible overdue balances (%)'], resolve: ['حسم الحالات المعلقة (%)', 'Pending cases resolved (%)'], approve: ['نسبة المحسوم كاستبعاد (%)', 'Share of resolved cases approved as exclusions (%)'], billing: ['تغيّر الفوترة المتوقع (%)', 'Expected billing change (%)'], expense: ['تغيّر الإنفاق المتوقع (%)', 'Expected expenditure change (%)'], slip: ['نسبة التحصيل الإضافي الذي يتأخر عن تاريخ التخطيط (%)', 'Share of additional receipts arriving after the planning date (%)'] };

export function validateScenario(input) {
  const value = {}; const warnings = [];
  for (const [k, [lo, hi]] of Object.entries(SCENARIO_LIMITS)) {
    let v = Number(input?.[k]);
    if (!Number.isFinite(v)) { v = DEFAULT_SCENARIO[k]; warnings.push({ field: k, ar: `«${LIMIT_LABEL[k][0]}»: قيمة غير رقمية؛ استُخدمت ${v}.`, en: `“${LIMIT_LABEL[k][1]}”: not a number; ${v} used.` }); }
    if (v < lo || v > hi) { const c = Math.min(hi, Math.max(lo, v)); warnings.push({ field: k, ar: `«${LIMIT_LABEL[k][0]}» خارج النطاق المسموح (${lo} إلى ${hi}); عُدّلت إلى ${c}.`, en: `“${LIMIT_LABEL[k][1]}” is outside the allowed range (${lo} to ${hi}); set to ${c}.` }); v = c; }
    value[k] = v;
  }
  return { value, warnings };
}

export function scenarioBase(snapshot) {
  const T = snapshot.totals; const nc = snapshot.noncollection; const q = snapshot.quality;
  const N = T.net; const C = T.collected; const U = Math.max(0, N - C);
  const pool = Math.min(U, (nc.overdue?.amount || 0) + (nc.partial?.amount || 0)); // collectible overdue / partial balances: no dispute, no missing data
  const pending = Math.min(U, q.pendingExclusionAmount || 0); // exclusion candidates not yet decided, capped by what is uncollected
  return { N, C, U, pool, pending, rate: N > 0 ? C / N : null };
}

export function runScenario(base, input, targetRate = null) {
  const { value: s, warnings } = validateScenario(input);
  const { N, C, pool, pending } = base; const R0 = N > 0 ? C / N : 0;
  const steps = [];
  // 1) billing
  const dN = N * (s.billing / 100); const dCb = dN * R0; let N1 = N + dN; let C1 = C + dCb;
  steps.push({ key: 'billing', cash: true, dNet: dN, dCollected: dCb, note: 'billing' });
  // 2) pending cases (never cash)
  const resolved = pending * (s.resolve / 100); const toExcl = resolved * (s.approve / 100);
  const N2 = N1 - toExcl; const C2 = C1;
  steps.push({ key: 'resolve', cash: false, dNet: -toExcl, dCollected: 0, resolved, toExcl, toCollectible: resolved - toExcl });
  const U2 = Math.max(0, N2 - C2);
  // 3) collection-rate lever
  const dCc = Math.min(U2, Math.max(-C2, N2 * (s.dRate / 100))); const C3 = C2 + dCc; const U3 = Math.max(0, N2 - C3);
  steps.push({ key: 'rate', cash: true, dNet: 0, dCollected: dCc });
  // 4) overdue recovery on what the rate lever has not already collected
  const poolAfter = U2 > 0 ? pool * Math.max(0, 1 - Math.max(0, dCc) / U2) : 0;
  const dCr = Math.min(U3, poolAfter * (s.recovery / 100)); const C4 = C3 + dCr;
  steps.push({ key: 'recovery', cash: true, dNet: 0, dCollected: dCr });
  const U4 = Math.max(0, N2 - C4);
  const rateAfterResolve = N2 > 0 ? C2 / N2 : null; // the rate moves mechanically when cases are excluded — without any cash
  const out = {
    inputs: s, warnings, steps,
    baseline: { net: N, collected: C, uncollected: Math.max(0, N - C), rate: N > 0 ? C / N : null },
    scenario: { net: N2, collected: C4, uncollected: U4, rate: N2 > 0 ? C4 / N2 : null },
    deltaCollected: C4 - C, deltaCash: { billing: dCb, rate: dCc, recovery: dCr },
    nonCash: { netReduction: toExcl, rateEffectPp: rateAfterResolve != null && N1 > 0 ? (rateAfterResolve - C1 / N1) * 100 : null }
  };
  if (targetRate != null) {
    out.target = { rate: targetRate, baselineCollectedNeeded: targetRate * N, scenarioCollectedNeeded: targetRate * N2, baselineGap: Math.max(0, targetRate * N - C), scenarioGap: Math.max(0, targetRate * N2 - C4) };
  }
  return out;
}

/* ---------- fair comparison ---------- */
// For each Amanah: amount, collection rate, share of net that is overdue, the rate EXPECTED from its revenue-source mix (each source at the
// all-Amanah rate of that source) and the mix-adjusted index = actual − expected (percentage points). Ranking uses the index, not the amount.
export function fairComparison(snapshot, { minInvoices = 10 } = {}) {
  const T = snapshot.totals; const srcRate = new Map(snapshot.bySource.map((g) => [g.key, g.net > 0 ? g.collected / g.net : null]));
  const bySrc = new Map(); for (const r of snapshot.matrix?.amanahSource || []) { const a = bySrc.get(r.amanah) || []; a.push(r); bySrc.set(r.amanah, a); }
  const totalOut = T.outstanding;
  return snapshot.byAmanah.map((g) => {
    const cells = bySrc.get(g.key) || []; const net = g.net;
    const expected = net > 0 ? cells.reduce((t, c) => t + c.net * (srcRate.get(c.source) ?? (T.net > 0 ? T.collected / T.net : 0)), 0) / net : null;
    const rate = net > 0 ? g.collected / net : null;
    return {
      key: g.key, label: g.label, count: g.count, gross: g.gross, net, collected: g.collected, outstanding: g.outstanding, overdue: g.overdueOutstanding,
      rate, overdueShare: net > 0 ? g.overdueOutstanding / net : null, exclusionRate: g.gross > 0 ? g.exclusions / g.gross : null,
      expectedRate: expected, index: rate != null && expected != null ? (rate - expected) * 100 : null,
      gapShare: totalOut > 0 ? g.outstanding / totalOut : null, smallSample: g.count < minInvoices
    };
  });
}

/* ---------- required pace (national fiscal-year target only) ---------- */
export function monthsBetweenDates(fromIso, toIso) {
  const a = new Date(`${fromIso}T00:00:00Z`); const b = new Date(`${toIso}T00:00:00Z`);
  return Math.max(0, (b - a) / 86400000 / 30.4375);
}
export function requiredPace({ achievement, series, today, planDate }) {
  if (!achievement || achievement.scopeCaveat || achievement.annualTarget == null) return { available: false };
  const remaining = Math.max(0, achievement.annualTarget - achievement.receiptsYtd);
  const monthsLeft = monthsBetweenDates(today, planDate);
  const vals = series?.values || []; const last3 = vals.slice(-4, -1); // complete months only
  const recent = last3.length ? last3.reduce((t, v) => t + v, 0) / last3.length : null;
  return { available: true, remaining, monthsLeft, perMonth: monthsLeft > 0 ? remaining / monthsLeft : null, recentAvgMonthly: recent, ratioToRecent: recent && monthsLeft > 0 ? remaining / monthsLeft / recent : null };
}

/* ---------- funding outlook (receipts vs payments) — national, cash basis, illustrative while expenditure is synthetic ---------- */
// receipts: actual year to date + the rest of the year (forecast when it is reliable, otherwise the recent monthly average = illustrative)
// payments: actual year to date + the rest of the year at the recent monthly average. Receipts and payments are both CASH by payment date.
// The scenario is NOT combined with them: its collection effect is measured on the plan period's INVOICES (a different basis from receipts by payment date),
// so no scenario balance is produced. The scenario's effects are returned beside the baseline (`scenarioEffects`) to be shown separately, never summed.
export function financeProjection({ receiptsYtd, paymentsYtd, series, paymentsByMonth, forecast, monthsLeft, scenarioDeltaCash = 0, scenario = DEFAULT_SCENARIO }) {
  if (receiptsYtd == null || paymentsYtd == null || !(monthsLeft >= 0)) return { available: false };
  const recent = (vals) => { const v = (vals || []).slice(-4, -1); return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null; };
  const recentReceipts = recent(series?.values); const recentPay = recent(paymentsByMonth);
  if (recentPay == null) return { available: false };
  const fcRest = forecast?.ready ? forecast.horizon.point.reduce((t, v) => t + v, 0) : null;
  const restReceipts = fcRest != null ? fcRest : recentReceipts != null ? recentReceipts * monthsLeft : null;
  if (restReceipts == null) return { available: false };
  const restPay = recentPay * monthsLeft;
  const base = { receipts: receiptsYtd + restReceipts, payments: paymentsYtd + restPay };
  const s = validateScenario(scenario).value;
  const scenarioEffects = { collectionDelta: scenarioDeltaCash, collectionSlipped: scenarioDeltaCash * (s.slip / 100), remainingPaymentsDelta: restPay * (s.expense / 100) }; // shown separately; no combined total
  return { available: true, method: fcRest != null ? 'forecast' : 'illustrative', restReceipts, restPay, base: { ...base, balance: base.receipts - base.payments }, scenarioEffects };
}
