// ============================================================================
// CFO Planning Room — unified calculation engine.
//
// Absorbs decisionRoomModel.js + planningModel.js (both retired). This file
// is the ONLY place that turns real invoice data + a user's planning
// assumptions into every derived number the Planning Room shows — one pure
// function (computeCFOModel) per render, fed by React's own useMemo
// dependency graph. That's the whole "recalculation engine" the spec asks
// for: change any assumption, useMemo's dependency array invalidates,
// everything downstream is recomputed from scratch. No custom event bus,
// no partial updates, no API calls.
//
// Layering (mirrors the "never touch actual data" requirement):
//   Actual      -> INVOICES/COLLECTIONS/etc. from mock.js, read-only.
//   Planning    -> the `assumptions` object the caller passes in (React
//                  state living in DecisionRoom.jsx, never persisted).
//   Calculation -> everything in this file.
//   Scenario    -> SCENARIO_PRESETS below + a session-only saved-scenario
//                  list the page keeps (this file only defines the presets).
//   Presentation-> DecisionRoom.jsx + the chart components.
//
// Every formula that isn't a straight passthrough of real data is written
// out in a comment right above it — Source -> Formula -> Assumption ->
// Result, so the page can show "how is this calculated?" without this file
// needing a second, parallel description of itself.
import { INVOICES, COLLECTIONS, SANAD_ENFORCEMENT, fmtMoney } from './mock';
import { computeKpi, computeByProvince, computeExclusionBreakdown } from './reportAnalytics';
import { computeAllRiskFlags } from './riskAnalysis';
import { DEMO_EXPENSE_CHAPTERS, DEMO_INVESTMENT_CONTRACTS, DEMO_PAYMENT_SCHEDULE, ILLUSTRATIVE_BASELINE_2026 } from './decisionRoomDemoData';

// ---------------------------------------------------------------------------
// Period utilities (carried over from planningModel.js verbatim — the period
// picker's own logic was already correct and period-agnostic; nothing here
// depends on assumptions).
// ---------------------------------------------------------------------------

function addMonthsUTC(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function monthSpan(fromDate, toDate) {
  const [fy, fm] = fromDate.slice(0, 7).split('-').map(Number);
  const [ty, tm] = toDate.slice(0, 7).split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

function durationEnd(today, n) {
  const d = new Date(`${addMonthsUTC(today, n)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function isExcluded(inv) {
  return inv.status === 'duplicate' || inv.hasOpenObjection || inv.debtorInvalid || inv.collectedVia === 'enforcement';
}

export function anchorToday(invoices = INVOICES) {
  return invoices.reduce((max, i) => (i.date > max ? i.date : max), invoices[0].date);
}

export const PERIOD_MODES = ['toYearEnd', 'annual', 'quarterly', 'monthly', 'months', 'custom'];

export function computePeriod(mode, { months, from, to } = {}, invoices = INVOICES) {
  const today = anchorToday(invoices);
  if (mode === 'custom') {
    return { periodStart: from || today, periodEnd: to || durationEnd(today, 12) };
  }
  const periodStart = `${today.slice(0, 7)}-01`;
  let periodEnd;
  switch (mode) {
    case 'toYearEnd':
      periodEnd = `${today.slice(0, 4)}-12-31`;
      break;
    case 'quarterly':
      periodEnd = durationEnd(periodStart, 3);
      break;
    case 'monthly':
      periodEnd = durationEnd(periodStart, 1);
      break;
    case 'months':
      periodEnd = durationEnd(periodStart, Math.max(1, Number(months) || 1));
      break;
    case 'annual':
    default:
      periodEnd = durationEnd(periodStart, 12);
  }
  return { periodStart, periodEnd };
}

export function periodTotalMonths(periodStart, periodEnd) {
  return Math.max(1, monthSpan(periodStart, periodEnd));
}

export function computeMonthlyActuals(periodStart, periodEnd, invoices = INVOICES) {
  const today = anchorToday(invoices);
  const elapsedEnd = periodEnd < today ? periodEnd : today;
  if (elapsedEnd < periodStart) return [];
  const elapsedMonths = monthSpan(periodStart, elapsedEnd);
  const sums = Array(elapsedMonths).fill(0);
  for (const inv of invoices) {
    if (inv.date < periodStart || inv.date > elapsedEnd) continue;
    if (isExcluded(inv) || inv.status !== 'approved') continue;
    const idx = monthSpan(periodStart, inv.date) - 1;
    if (idx >= 0 && idx < elapsedMonths) sums[idx] += inv.amount;
  }
  return sums.map((value, i) => ({ month: i, value }));
}

export function computeAmanahShares(invoices) {
  // Keep every province with a defined Amanah (hasData), even ones with zero
  // invoices in the current period/filter — the map needs all 13 shapes to
  // draw (zero-data ones render greyed via mapFillForMetric's own count===0
  // check), not just the subset that happens to have data right now.
  const byProvince = computeByProvince(invoices).filter((p) => p.hasData);
  const totalGross = byProvince.reduce((s, p) => s + p.gross, 0);
  return byProvince
    .map((p) => ({ ...p, share: totalGross ? p.gross / totalGross : 0 }))
    .sort((a, b) => b.gross - a.gross);
}

function shiftDate(dateStr, months) {
  if (!months) return dateStr;
  return addMonthsUTC(dateStr, months);
}

function monthIndexOf(periodStart, dateStr) {
  return monthSpan(periodStart, dateStr) - 1;
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------------------
// Assumptions (the Planning layer's shape) + Scenario presets.
// Only variables with a real, present business meaning are exposed — no
// "collection timing" or similar invented knob with nothing behind it.
// ---------------------------------------------------------------------------

export const DEFAULT_ASSUMPTIONS = {
  revenueGrowthPct: 0, // % adjustment applied to the trended revenue pace
  collectionRateDelta: 0, // percentage points added to the real collection rate
  expenseGrowthPct: 0, // % adjustment applied to all 4 expense chapters
  chapterAdjustments: { ch1: 0, ch2: 0, ch3: 0, ch4: 0 }, // per-chapter % on top of the global one
  investmentAmount: 0, // a new, proposed investment (SAR) — not yet committed
  investmentTimingMonths: 0, // months from period start when it would land
  contractPaymentDeferralMonths: 0, // shifts demo contract/vendor payments by N months (rephasing)
  overdueRecoveryPct: 0, // % boost applied to the real overdue-receivables recovery estimate (forecastedCollections)
  additionalRevenueSAR: 0 // a new, proposed revenue initiative (SAR) — added directly to expected collections
};

// Concrete, documented deltas — not vague labels. Conservative pressures
// revenue/collection down and expenses up; Optimistic the opposite;
// Base is "no change from the real trend."
export const SCENARIO_PRESETS = {
  base: { ...DEFAULT_ASSUMPTIONS },
  conservative: { ...DEFAULT_ASSUMPTIONS, revenueGrowthPct: -5, collectionRateDelta: -5, expenseGrowthPct: 5 },
  optimistic: { ...DEFAULT_ASSUMPTIONS, revenueGrowthPct: 5, collectionRateDelta: 10, expenseGrowthPct: -5 }
};

// Financial Health Score — documented weights (sum to 100) and thresholds.
// These are planning assumptions, not official ministry policy — exposed as
// adjustable in the Control Panel per the "must be configurable, never
// arbitrary" requirement. Each dimension scores 0-100 before weighting.
export const DEFAULT_HEALTH_WEIGHTS = {
  revenue: 20, // achieved/expected vs. baseline trend
  collection: 20, // collection rate vs. the 70% benchmark already used app-wide
  expense: 15, // expense growth held near 0% is "healthy"
  liquidity: 20, // net position vs. inflows
  outstanding: 10, // uncollected share of net invoiced
  commitment: 10, // upcoming commitments vs. inflows
  investment: 5 // proposed investment vs. computed capacity
};

// ---------------------------------------------------------------------------
// Linear trend fit — same "not a real statistical model" honesty as
// reportAnalytics.computeRecoveryTrend, reused/generalized to project N
// months of a real monthly series forward.
// ---------------------------------------------------------------------------

// Trailing lookback window (months) used to fit a real trend before a
// forward-looking period, and the shared projection formula below — both
// computeCFOModel's live monthlySeries (future months) and
// computePlanVsActual's retrospective comparison (elapsed months) call the
// exact same function so the two views can never silently drift apart.
const LOOKBACK_MONTHS = 12;

function projectMonthCollected({ trend, actualRate, expectedRate, revenueGrowthPct }, m) {
  if (!trend) return 0;
  const trendedCollected = Math.max(0, trend.slope * (LOOKBACK_MONTHS + m) + trend.intercept);
  const impliedInvoicedPace = actualRate ? trendedCollected / (actualRate / 100) : trendedCollected;
  return Math.round(impliedInvoicedPace * (1 + revenueGrowthPct / 100) * (expectedRate / 100));
}

function linearFit(monthlyActuals) {
  const n = monthlyActuals.length;
  if (n < 2) return null;
  const xs = monthlyActuals.map((m) => m.month);
  const ys = monthlyActuals.map((m) => m.value);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  const slope = denom ? xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / denom : 0;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

// ---------------------------------------------------------------------------
// The master calculation — everything downstream of one call.
// ---------------------------------------------------------------------------

export function computeCFOModel({
  invoices = INVOICES,
  assumptions = DEFAULT_ASSUMPTIONS,
  periodStart,
  periodEnd,
  healthWeights = DEFAULT_HEALTH_WEIGHTS
}) {
  const periodInvoices = invoices.filter((i) => i.date >= periodStart && i.date <= periodEnd);
  const kpi = computeKpi(periodInvoices); // "actual, this period" — can be small/zero for a forward-looking period that just started; that's honest, not a bug
  const exclusions = computeExclusionBreakdown(periodInvoices);
  const totalMonths = periodTotalMonths(periodStart, periodEnd);
  const monthlyActuals = computeMonthlyActuals(periodStart, periodEnd, invoices);
  const monthsElapsed = monthlyActuals.length;
  const monthsRemaining = Math.max(0, totalMonths - monthsElapsed);

  // The period is forward-looking (starts "today"), so it rarely has more
  // than a few real elapsed weeks of its own — nowhere near enough to fit a
  // trend or a stable collection rate. Both are instead derived from a
  // trailing lookback of REAL history immediately before the period starts
  // (up to 12 months), continuing the same timeline into the projected
  // months. This is still 100% real data — just a wider, more stable real
  // window than "whatever happened to fall inside the forward period so far".
  const lookbackStart = addMonthsUTC(periodStart, -LOOKBACK_MONTHS);
  const lookbackSeries = (() => {
    const sums = Array(LOOKBACK_MONTHS).fill(0);
    for (const inv of invoices) {
      if (inv.date < lookbackStart || inv.date >= periodStart) continue;
      if (isExcluded(inv) || inv.status !== 'approved') continue;
      const idx = monthSpan(lookbackStart, inv.date) - 1;
      if (idx >= 0 && idx < LOOKBACK_MONTHS) sums[idx] += inv.amount;
    }
    return sums.map((value, i) => ({ month: i, value }));
  })();
  const trend = linearFit(lookbackSeries);
  const historicalInvoices = invoices.filter((i) => i.date < periodStart);
  const historicalKpi = computeKpi(historicalInvoices.length ? historicalInvoices : invoices);
  const actualRate = historicalKpi.collectionRate; // %, real, stable (whole real history before the period, not the sparse in-period slice)
  const expectedRate = clamp(actualRate + assumptions.collectionRateDelta, 0, 100);

  // Expense chapters: DEMO_EXPENSE_CHAPTERS.forecast is a national ANNUAL
  // figure. Scaled by (a) this period's length and (b) a real apportionment
  // factor — this scope's share of total real gross invoicing (1.0 for "all
  // Amanahs", a real fraction for a single one) — so a single-Amanah scope
  // doesn't get compared against the whole ministry's expense base. Floored
  // at 2% so a very small Amanah doesn't zero expenses out entirely.
  const scopeShare = clamp(
    INVOICES.reduce((s, i) => s + i.amount, 0)
      ? invoices.reduce((s, i) => s + i.amount, 0) / INVOICES.reduce((s, i) => s + i.amount, 0)
      : 1,
    0.02, 1
  );
  const chapters = DEMO_EXPENSE_CHAPTERS.map((c) => {
    const pct = assumptions.expenseGrowthPct + (assumptions.chapterAdjustments[c.id] || 0);
    const annualAdjusted = Math.round(c.forecast * (1 + pct / 100) * scopeShare);
    const periodAdjusted = Math.round(annualAdjusted * (totalMonths / 12));
    return { ...c, pct, annualAdjusted, periodAdjusted, monthlyRunRate: annualAdjusted / 12 };
  });

  // Contract/vendor commitments + a proposed new investment, both rephased
  // by the deferral/timing assumptions, filtered to what actually falls
  // inside this period.
  const contractRows = DEMO_PAYMENT_SCHEDULE.map((p) => ({ ...p, dueDate: shiftDate(p.dueDate, assumptions.contractPaymentDeferralMonths) }));
  const investmentRow = assumptions.investmentAmount > 0
    ? [{ id: 'NEW-INVESTMENT', category: 'new_investment', amount: assumptions.investmentAmount, dueDate: shiftDate(periodStart, assumptions.investmentTimingMonths) }]
    : [];
  const allCommitments = [...contractRows, ...investmentRow].filter((r) => r.dueDate >= periodStart && r.dueDate <= periodEnd);

  // Monthly series — the single source of truth for every time-based chart
  // (Cash Flow Forecast, Liquidity Gap, Coverage). Elapsed months use the
  // REAL collected amount as-is (never re-derived). Future months: back out
  // an implied invoiced pace from the real trend (trend / actual rate),
  // then re-apply revenue growth + the NEW expected collection rate —
  // exactly "Collection Forecast = Expected Billing x Scenario Collection
  // Rate" (Section 23's own worked example).
  const monthlySeries = [];
  for (let m = 0; m < totalMonths; m++) {
    const actualRow = monthlyActuals.find((r) => r.month === m);
    let collected = null;
    let isActual = false;
    if (actualRow) {
      collected = actualRow.value;
      isActual = true;
    } else if (trend) {
      // Continue the same lookback timeline: lookback months are x=0..11,
      // so the first projected period-month is x=12, matching how the
      // trend was fit.
      collected = projectMonthCollected({ trend, actualRate, expectedRate, revenueGrowthPct: assumptions.revenueGrowthPct }, m);
    }
    const monthlyExpense = Math.round(chapters.reduce((s, c) => s + c.monthlyRunRate, 0));
    const monthCommitments = allCommitments.filter((r) => monthIndexOf(periodStart, r.dueDate) === m).reduce((s, r) => s + r.amount, 0);
    const outflow = monthlyExpense + monthCommitments;
    monthlySeries.push({ month: m, isActual, collected, expense: monthlyExpense, commitments: monthCommitments, outflow, net: collected == null ? null : collected - outflow });
  }

  // additionalRevenueSAR: a proposed new revenue initiative, added directly
  // to expected collections — same "not yet real, but a real lever" pattern
  // as investmentAmount on the expense side.
  const expectedCollections = monthlySeries.reduce((s, r) => s + (r.collected || 0), 0) + assumptions.additionalRevenueSAR;
  const expectedExpenses = monthlySeries.reduce((s, r) => s + r.expense, 0);
  const totalCommitmentsInPeriod = monthlySeries.reduce((s, r) => s + r.commitments, 0);

  // Forecasted near-term recovery of the 4 known overdue receivables
  // (probability-weighted) — a one-time snapshot addition to inflows, same
  // as the existing Decision Room already computed it, not spread monthly.
  // overdueRecoveryPct scales this real recovery estimate up/down — a
  // real lever on real data, not a separate invented figure.
  const forecastedCollections = Math.round(COLLECTIONS.reduce((s, c) => s + c.amount * (c.prob / 100), 0) * (1 + assumptions.overdueRecoveryPct / 100));

  const inflows = expectedCollections + forecastedCollections;
  const outflows = expectedExpenses + totalCommitmentsInPeriod;
  const netPosition = inflows - outflows;
  // Expense Coverage = Expected Revenue/Collections / Expected Expenses (Section 23's exact formula).
  const expenseCoverage = outflows ? Math.round((inflows / outflows) * 1000) / 10 : null;

  // Per-Amanah detail for the map drill-down panel — every figure here is
  // the NATIONAL/scope-wide number above apportioned by this Amanah's own
  // real historical share of gross invoicing (the same `share` already used
  // to distribute the revenue target). Nothing new is invented; this is
  // just the existing totals sliced by a real weight.
  const amanahShares = computeAmanahShares(periodInvoices.length ? periodInvoices : invoices);
  const perAmanah = amanahShares.map((p) => {
    const expectedTarget = Math.round((expectedCollections || 0) * p.share);
    const spent = Math.round(expectedExpenses * p.share);
    const committed = Math.round(totalCommitmentsInPeriod * p.share);
    const budget = Math.round((expectedExpenses + totalCommitmentsInPeriod) * p.share) || 1;
    const available = Math.max(0, expectedTarget - spent - committed);
    return {
      ...p,
      expectedTarget, spent, committed, budget, available,
      spendRate: budget ? Math.round((spent / budget) * 100) : null,
      ceilingCommitment: budget ? Math.round(((spent + committed) / budget) * 100) : null,
      liquidityRemainingPct: expectedTarget ? Math.round((available / expectedTarget) * 100) : null,
      opexCoverage: spent ? Math.round((p.collected / spent) * 100) : null
    };
  });

  const model = {
    periodStart, periodEnd, totalMonths, monthsElapsed, monthsRemaining,
    assumptions, healthWeights,
    kpi, exclusions, actualRate, expectedRate, trend,
    chapters, expectedExpenses,
    contractRows, investmentRow, allCommitments, totalCommitmentsInPeriod,
    monthlySeries, expectedCollections, forecastedCollections,
    inflows, outflows, netPosition, expenseCoverage,
    perAmanah
  };

  model.risks = computeFinancialRisks(model, periodInvoices);
  model.health = computeHealthScore(model);
  model.recommendations = buildCFORecommendations(model);
  model.investmentCapacity = computeInvestmentCapacity(model);
  model.paymentPriority = computePaymentPriority(model);

  return model;
}

// ---------------------------------------------------------------------------
// Financial Risk Engine (Section 10). 6 categories; each carries severity,
// SAR impact, affected period, its source, and a recommended action.
// ---------------------------------------------------------------------------

export function computeFinancialRisks(model, periodInvoices) {
  const risks = [];

  // Revenue risk: expected collections trailing the real trend baseline
  // (i.e. the growth assumption itself is negative, or the trend is falling).
  if (model.assumptions.revenueGrowthPct < 0) {
    risks.push({
      id: 'revenue-growth', category: 'revenue', severity: model.assumptions.revenueGrowthPct <= -10 ? 'high' : 'medium',
      impactSAR: Math.round(model.expectedCollections * Math.abs(model.assumptions.revenueGrowthPct) / 100),
      period: `${model.periodStart} → ${model.periodEnd}`, source: 'revenueGrowthPct assumption', action: 'accelerate_invoicing'
    });
  }

  // Collection risk: real collection rate below the 70% benchmark already
  // used everywhere else in this app (map legend, ring gauges).
  if (model.actualRate < 70) {
    risks.push({
      id: 'collection-rate', category: 'collection', severity: model.actualRate < 40 ? 'high' : 'medium',
      impactSAR: Math.round(model.kpi.netInvoiced * (70 - model.actualRate) / 100),
      period: `${model.periodStart} → ${model.periodEnd}`, source: 'reportAnalytics.computeKpi', action: 'prioritize_overdue'
    });
  }
  // Real, MoMAH-confirmed risk categories (duplicates/struck-off/deceased/value anomaly).
  const flags = computeAllRiskFlags(periodInvoices);
  if (flags.length) {
    risks.push({
      id: 'invoice-quality', category: 'collection', severity: flags.length > 5 ? 'high' : 'medium',
      impactSAR: flags.reduce((s, f) => s + (f.invoice?.amount || 0), 0),
      period: `${model.periodStart} → ${model.periodEnd}`, source: 'riskAnalysis.computeAllRiskFlags', action: 'review_flagged_invoices', count: flags.length
    });
  }

  // Liquidity risk: expected outflows exceed expected inflows.
  if (model.netPosition < 0) {
    risks.push({
      id: 'liquidity-gap', category: 'liquidity', severity: model.netPosition < -model.inflows * 0.2 ? 'high' : 'medium',
      impactSAR: Math.abs(model.netPosition), period: `${model.periodStart} → ${model.periodEnd}`,
      source: 'inflows - outflows', action: 'rephase_or_collect'
    });
  }

  // Expense risk: expense growth assumption is positive (spending above the trend).
  if (model.assumptions.expenseGrowthPct > 0) {
    risks.push({
      id: 'expense-growth', category: 'expense', severity: model.assumptions.expenseGrowthPct >= 10 ? 'high' : 'medium',
      impactSAR: Math.round(model.expectedExpenses * model.assumptions.expenseGrowthPct / (100 + model.assumptions.expenseGrowthPct)),
      period: `${model.periodStart} → ${model.periodEnd}`, source: 'expenseGrowthPct assumption', action: 'review_discretionary_spend'
    });
  }

  // Commitment risk: upcoming contract/vendor/investment payments exceed a
  // documented 40% share of expected inflows in this period (a labeled
  // planning threshold, not an official rule).
  if (model.inflows && model.totalCommitmentsInPeriod / model.inflows > 0.4) {
    risks.push({
      id: 'commitment-pressure', category: 'commitment', severity: model.totalCommitmentsInPeriod / model.inflows > 0.6 ? 'high' : 'medium',
      impactSAR: model.totalCommitmentsInPeriod, period: `${model.periodStart} → ${model.periodEnd}`,
      source: 'DEMO_PAYMENT_SCHEDULE + investment assumption', action: 'rephase_commitments'
    });
  }

  // Investment risk: proposed investment exceeds computed capacity (filled
  // in by computeInvestmentCapacity below via a second pass — see caller).
  if (model.assumptions.investmentAmount > 0) {
    const capacityEstimate = model.netPosition + model.assumptions.investmentAmount; // capacity without this investment
    if (model.assumptions.investmentAmount > Math.max(0, capacityEstimate) * 0.9) {
      risks.push({
        id: 'investment-conflict', category: 'investment', severity: model.assumptions.investmentAmount > capacityEstimate ? 'high' : 'medium',
        impactSAR: model.assumptions.investmentAmount, period: `${model.periodStart} → ${model.periodEnd}`,
        source: 'investmentAmount vs. computed liquidity capacity', action: 'resize_or_defer_investment'
      });
    }
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  return risks.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

// ---------------------------------------------------------------------------
// Financial Health Score (Section 11). Each dimension scores 0-100, then a
// weighted average (weights documented above, adjustable by the caller).
// ---------------------------------------------------------------------------

export function computeHealthScore(model) {
  const w = model.healthWeights;
  const scoreRevenue = clamp(100 + model.assumptions.revenueGrowthPct * 4, 0, 100); // +/-25% growth spans the full range
  const scoreCollection = clamp((model.expectedRate / 70) * 100, 0, 100); // 70% benchmark = 100
  const scoreExpense = clamp(100 - Math.abs(model.assumptions.expenseGrowthPct) * 5, 0, 100); // any move away from 0% costs points
  const scoreLiquidity = model.inflows ? clamp(50 + (model.netPosition / model.inflows) * 100, 0, 100) : 50;
  const outstandingShare = model.kpi.netInvoiced ? model.kpi.uncollectedValue / model.kpi.netInvoiced : 0;
  const scoreOutstanding = clamp(100 - outstandingShare * 150, 0, 100);
  const commitmentShare = model.inflows ? model.totalCommitmentsInPeriod / model.inflows : 0;
  const scoreCommitment = clamp(100 - commitmentShare * 125, 0, 100);
  const investmentShare = model.inflows ? model.assumptions.investmentAmount / Math.max(1, model.inflows) : 0;
  const scoreInvestment = clamp(100 - investmentShare * 100, 0, 100);

  const dims = { revenue: scoreRevenue, collection: scoreCollection, expense: scoreExpense, liquidity: scoreLiquidity, outstanding: scoreOutstanding, commitment: scoreCommitment, investment: scoreInvestment };
  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const score = Math.round(Object.entries(dims).reduce((s, [k, v]) => s + v * (w[k] || 0), 0) / totalWeight);
  const band = score >= 75 ? 'strong' : score >= 55 ? 'watch' : 'atRisk';
  return { score, band, dims, weights: w };
}

// ---------------------------------------------------------------------------
// CFO Recommendation Engine (Sections 12-13) — driven entirely by the risks
// just computed, each carrying issue/action/impact/riskAddressed.
// ---------------------------------------------------------------------------

export function buildCFORecommendations(model) {
  return model.risks.map((r) => ({
    id: r.id, kind: r.id, priority: r.severity, impactSAR: r.impactSAR, riskCategory: r.category, action: r.action
  }));
}

// ---------------------------------------------------------------------------
// Investment Capacity (Section 15): available capacity BEFORE the proposed
// investment is netted in, compared against what's proposed. Never silently
// rejected — just flagged.
// ---------------------------------------------------------------------------

export function computeInvestmentCapacity(model) {
  // Capacity = inflows - expenses - existing (non-investment) commitments -
  // a documented 10% liquidity reserve buffer (a labeled planning
  // assumption, not a hard rule).
  const existingCommitments = model.totalCommitmentsInPeriod - model.assumptions.investmentAmount;
  const reserveBuffer = Math.round(model.inflows * 0.10);
  const capacity = Math.max(0, model.inflows - model.expectedExpenses - existingCommitments - reserveBuffer);
  const proposed = model.assumptions.investmentAmount;
  return { capacity, proposed, exceedsCapacity: proposed > capacity, reserveBuffer, reserveBufferPct: 10 };
}

// ---------------------------------------------------------------------------
// Payment Prioritization (Section 16) — buckets by due-date proximity to
// "today", a documented, explainable threshold set (not an official rule).
// ---------------------------------------------------------------------------

export function computePaymentPriority(model) {
  const today = anchorToday();
  const daysUntil = (dateStr) => Math.round((new Date(`${dateStr}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
  const rows = [
    ...COLLECTIONS.map((c) => ({ id: c.id, amount: c.amount, days: -c.overdue, real: true })),
    ...model.contractRows.map((r) => ({ id: r.id, amount: r.amount, days: daysUntil(r.dueDate), real: false })),
    ...model.investmentRow.map((r) => ({ id: r.id, amount: r.amount, days: daysUntil(r.dueDate), real: false }))
  ];
  const bucketOf = (days) => (days <= 30 ? 'immediate' : days <= 90 ? 'nearTerm' : days <= 180 ? 'planned' : 'flexible');
  return rows.map((r) => ({ ...r, bucket: bucketOf(r.days) })).sort((a, b) => a.days - b.days);
}

// ---------------------------------------------------------------------------
// Amanah Financial Position Ranking (Section 9.10) — configurable criteria.
// ---------------------------------------------------------------------------

export const AMANAH_RANK_CRITERIA = ['revenue', 'collection', 'liquidityPressure', 'outstanding'];

export function rankAmanahs(perAmanah, criterion) {
  const withScore = perAmanah.map((p) => {
    let value;
    switch (criterion) {
      case 'collection': value = p.rate; break;
      case 'outstanding': value = p.uncollected; break;
      case 'liquidityPressure': value = p.gross ? p.uncollected / p.gross : 0; break;
      case 'revenue':
      default: value = p.gross;
    }
    return { ...p, rankValue: value };
  });
  const ascending = criterion === 'collection'; // lower collection rate = worse, show first
  return withScore.sort((a, b) => (ascending ? a.rankValue - b.rankValue : b.rankValue - a.rankValue));
}

// ---------------------------------------------------------------------------
// Map coloring metrics (the "تلوين الخريطة حسب" toggle row) — each maps a
// real, already-computed per-Amanah number to the same green/gold/red
// semantic used everywhere else in this app. "Parks coverage" / "road
// quality" from the reference design have no real data anywhere in this app
// and are deliberately not included — only real, present metrics are
// offered, per this app's own "never invent a variable with nothing behind
// it" rule.
export const MAP_METRICS = ['summary', 'collection', 'expenseCoverage', 'commitment'];

// Returns a 0-100 "how healthy" score for a metric, used both for the map
// fill color and for finding the worst Amanah (the "needs attention" banner).
// Higher is always better here, regardless of the metric's own natural
// direction (e.g. commitment pressure is inverted so 100 = safest).
function amanahMetricScore(p, metric) {
  switch (metric) {
    case 'collection': return p.rate;
    case 'expenseCoverage': return p.opexCoverage == null ? null : Math.min(100, p.opexCoverage);
    case 'commitment': return p.ceilingCommitment == null ? null : Math.max(0, 100 - p.ceilingCommitment);
    case 'summary':
    default: return p.rate;
  }
}

export function mapFillForMetric(p, metric) {
  if (!p.hasData || p.count === 0) return 'rgba(108,115,127,0.10)';
  const score = amanahMetricScore(p, metric);
  if (score == null) return 'rgba(108,115,127,0.10)';
  return score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--gold)' : 'var(--red)';
}

// The single worst-scoring Amanah with real data for the given metric — the
// "يتطلب المعالجة أولاً" (needs attention first) banner.
export function worstAmanahByMetric(perAmanah, metric) {
  const withData = perAmanah.filter((p) => p.hasData && p.count > 0 && amanahMetricScore(p, metric) != null);
  if (!withData.length) return null;
  return withData.reduce((worst, p) => (amanahMetricScore(p, metric) < amanahMetricScore(worst, metric) ? p : worst));
}

// ---------------------------------------------------------------------------
// Chart-feeding helpers (Section 9) — each just calls computeCFOModel a few
// times with different assumption deltas. All synchronous, all cheap (the
// dataset is small), so this stays well inside the "no unnecessary work,
// feels immediate" performance bar (Section 25).
// ---------------------------------------------------------------------------

// Revenue Bridge/Waterfall: Baseline -> +Growth effect -> +Collection-rate
// effect -> Forecast, each stage computed by isolating that one assumption.
export function computeRevenueBridge(args) {
  const base = computeCFOModel({ ...args, assumptions: { ...args.assumptions, revenueGrowthPct: 0, collectionRateDelta: 0 } });
  const withGrowth = computeCFOModel({ ...args, assumptions: { ...args.assumptions, collectionRateDelta: 0 } });
  const final = computeCFOModel(args);
  return [
    { key: 'baseline', value: base.expectedCollections },
    { key: 'growthEffect', value: withGrowth.expectedCollections - base.expectedCollections },
    { key: 'collectionEffect', value: final.expectedCollections - withGrowth.expectedCollections },
    { key: 'forecast', value: final.expectedCollections }
  ];
}

// Collection Improvement Impact: current rate and +5/+10/+15 points.
export function computeCollectionSensitivity(args) {
  return [0, 5, 10, 15].map((delta) => {
    const m = computeCFOModel({ ...args, assumptions: { ...args.assumptions, collectionRateDelta: (args.assumptions.collectionRateDelta || 0) + delta } });
    return { key: `+${delta}pp`, rate: m.expectedRate, collected: m.expectedCollections, netPosition: m.netPosition };
  });
}

// Expense / Revenue Sensitivity: -10/-5/base/+5/+10%.
export function computeExpenseSensitivity(args) {
  return [-10, -5, 0, 5, 10].map((delta) => {
    const m = computeCFOModel({ ...args, assumptions: { ...args.assumptions, expenseGrowthPct: (args.assumptions.expenseGrowthPct || 0) + delta } });
    return { key: delta === 0 ? 'base' : `${delta > 0 ? '+' : ''}${delta}%`, netPosition: m.netPosition };
  });
}

export function computeRevenueSensitivity(args) {
  return [-10, -5, 0, 5, 10].map((delta) => {
    const m = computeCFOModel({ ...args, assumptions: { ...args.assumptions, revenueGrowthPct: (args.assumptions.revenueGrowthPct || 0) + delta } });
    return { key: delta === 0 ? 'base' : `${delta > 0 ? '+' : ''}${delta}%`, netPosition: m.netPosition };
  });
}

// ---------------------------------------------------------------------------
// Strategic Targets tab — Trend vs. Target vs. Actual (real data only: Trend
// is the base-scenario trailing trend, Target is the live model's own
// assumptions, Actual is real elapsed-period data). No fabricated "actual"
// for expenses/net position/health — this dataset has no real monthly
// expense ledger, so those rows only carry Trend/Target and leave Actual
// null rather than invent a figure (rendered as "—" by the caller).
// ---------------------------------------------------------------------------

export function computeTargetTrendComparison(model, scenarioModels) {
  const base = scenarioModels.base;
  return [
    { key: 'collections', trend: base.expectedCollections, target: model.expectedCollections, actual: model.kpi.collectedValue },
    { key: 'expenses', trend: base.expectedExpenses, target: model.expectedExpenses, actual: null },
    { key: 'netPosition', trend: base.netPosition, target: model.netPosition, actual: null },
    { key: 'health', trend: base.health.score, target: model.health.score, actual: null }
  ];
}

// ---------------------------------------------------------------------------
// Execution & Monitoring tab — Plan vs. Actual, collections only. Elapsed
// months already carry a real `collected` figure in monthlySeries; this
// re-derives what the SAME target scenario would have projected for those
// same months (via the identical projectMonthCollected formula the live
// forecast uses for future months), so "target" and "actual" are always
// comparing like with like. Deliberately collections-only: expense/
// commitment figures in this model are 100% demo-sourced in every month,
// elapsed or future, so a "plan vs actual" expense row would be comparing a
// real number against a fabricated one — never done here.
// ---------------------------------------------------------------------------

export function computePlanVsActual(model) {
  return model.monthlySeries
    .filter((r) => r.isActual)
    .map((r) => {
      const target = projectMonthCollected(
        { trend: model.trend, actualRate: model.actualRate, expectedRate: model.expectedRate, revenueGrowthPct: model.assumptions.revenueGrowthPct },
        r.month
      );
      return { month: r.month, target, actual: r.collected, variance: r.collected - target };
    });
}

// ---------------------------------------------------------------------------
// Invoice & Collection tab — real aging buckets. This dataset has no
// separate due-date field, so age is measured from the invoice's own issue
// date (labeled as such by the caller) — a real, honest proxy, not a
// fabricated due-date schedule. Only outstanding (non-excluded, not yet
// approved/collected) invoices are bucketed.
// ---------------------------------------------------------------------------

export const AGING_BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90plus'];

export function computeAgingBuckets(invoices, anchorDate) {
  const today = anchorDate || anchorToday(invoices);
  const buckets = { current: [], d1_30: [], d31_60: [], d61_90: [], d90plus: [] };
  for (const inv of invoices) {
    if (isExcluded(inv) || inv.status === 'approved') continue;
    const ageDays = Math.round((new Date(`${today}T00:00:00Z`) - new Date(`${inv.date}T00:00:00Z`)) / 86400000);
    const key = ageDays <= 0 ? 'current' : ageDays <= 30 ? 'd1_30' : ageDays <= 60 ? 'd31_60' : ageDays <= 90 ? 'd61_90' : 'd90plus';
    buckets[key].push({ ...inv, ageDays });
  }
  return AGING_BUCKETS.map((key) => {
    const rows = buckets[key];
    return { key, rows, count: rows.length, value: rows.reduce((s, r) => s + r.amount, 0) };
  });
}

// ---------------------------------------------------------------------------
// Illustrative 2026 Baseline model — a SEPARATE, clearly-labeled data mode
// (see decisionRoomDemoData.ILLUSTRATIVE_BASELINE_2026 for the 5 confirmed
// numbers this is built from). Never mixed with real invoice data. Shaped
// like computeCFOModel's real output so every existing tab component
// renders it unmodified, but only the 5 confirmed figures are literal —
// health/risk/investment-capacity are DERIVED from them by reusing the
// exact same real-mode formulas (never re-implemented), and every array
// with no illustrative basis (perAmanah/chapters/monthlySeries/
// paymentPriority) stays empty rather than inventing content — callers
// already guard on .length for these.
// ---------------------------------------------------------------------------

export function buildIllustrativeModel({ assumptions = DEFAULT_ASSUMPTIONS, healthWeights = DEFAULT_HEALTH_WEIGHTS } = {}) {
  const base = ILLUSTRATIVE_BASELINE_2026;

  // Revenue growth% + collection-rate-delta both scale the baseline revenue
  // (the same two "target-setting" levers used in Strategic Targets);
  // additionalRevenueSAR adds a proposed new-initiative amount directly.
  // overdueRecoveryPct has no illustrative-baseline overdue figure to scale
  // (only the 5 headline numbers are confirmed) — it is intentionally inert
  // here, not approximated.
  const expectedCollections = Math.max(0, Math.round(
    base.revenue * (1 + assumptions.revenueGrowthPct / 100) * (1 + assumptions.collectionRateDelta / 100)
    + assumptions.additionalRevenueSAR
  ));
  const expectedExpenses = Math.max(0, Math.round(base.expenditure * (1 + assumptions.expenseGrowthPct / 100)));
  const netPosition = expectedCollections - expectedExpenses;
  const expenseCoverage = expectedExpenses ? Math.round((expectedCollections / expectedExpenses) * 1000) / 10 : null;

  const model = {
    isIllustrative: true,
    periodStart: `${base.fiscalYear}-01-01`, periodEnd: `${base.fiscalYear}-12-31`,
    totalMonths: 12, monthsElapsed: 0, monthsRemaining: 12,
    assumptions, healthWeights,
    // "Actual" here IS the confirmed baseline (the spec frames 16,000M/
    // 35,000M as the CURRENT 2026 position) — it does not move with the
    // assumption sliders, exactly like real mode's kpi vs. expectedX split.
    kpi: {
      gross: base.revenue, excludedCount: 0, excludedValue: 0, netInvoiced: base.revenue,
      collectedCount: 0, collectedValue: base.revenue, uncollectedCount: 0,
      uncollectedValue: Math.max(0, base.expenditure - base.revenue),
      collectionRate: base.coveragePct, invoiceCount: 0
    },
    exclusions: {
      duplicate: { count: 0, value: 0 }, appeal: { count: 0, value: 0 },
      invalid_debtor: { count: 0, value: 0 }, enforcement: { count: 0, value: 0 }
    },
    actualRate: base.coveragePct, expectedRate: base.coveragePct, trend: null,
    chapters: [], expectedExpenses,
    contractRows: [], investmentRow: [], allCommitments: [], totalCommitmentsInPeriod: 0,
    monthlySeries: [], expectedCollections, forecastedCollections: 0,
    inflows: expectedCollections, outflows: expectedExpenses, netPosition, expenseCoverage,
    perAmanah: []
  };

  model.risks = computeFinancialRisks(model, []);
  model.health = computeHealthScore(model);
  model.recommendations = buildCFORecommendations(model);
  model.investmentCapacity = computeInvestmentCapacity(model);
  model.paymentPriority = [];

  return model;
}

export { fmtMoney, SANAD_ENFORCEMENT, DEMO_INVESTMENT_CONTRACTS };
