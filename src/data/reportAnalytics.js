// Pure, language-independent report computations for the Smart Reports page.
// Deliberately kept separate from Dashboard.jsx's own useMemo calculations —
// same source array (INVOICES) and same formulas, but this module has no UI
// concerns, so it's safe for both the Dashboard and Smart Reports to read
// from without one risking a regression in the other. If the two ever need
// to be unified, this is the module that should become the single source.
import { INVOICES, gfsForInvoice, SANAD_ENFORCEMENT } from './mock';
import { KSA_PROVINCES } from './ksaProvinces';

const AMANAH_TO_PROVINCE = Object.fromEntries(
  KSA_PROVINCES.flatMap((p) => p.amanahKeys.map((key) => [key, p.iso]))
);

function exclusionReasons(inv) {
  const reasons = [];
  if (inv.status === 'duplicate') reasons.push('duplicate');
  if (inv.hasOpenObjection) reasons.push('appeal');
  if (inv.debtorInvalid) reasons.push('invalid_debtor');
  if (inv.collectedVia === 'enforcement') reasons.push('enforcement');
  return reasons;
}
const isExcluded = (inv) => exclusionReasons(inv).length > 0;

export function computeKpi(invoices) {
  const gross = invoices.reduce((s, i) => s + i.amount, 0);
  const excludedInvoices = invoices.filter(isExcluded);
  const excludedValue = excludedInvoices.reduce((s, i) => s + i.amount, 0);
  const netList = invoices.filter((i) => !isExcluded(i));
  const netInvoiced = gross - excludedValue;
  const collected = netList.filter((i) => i.status === 'approved');
  const collectedValue = collected.reduce((s, i) => s + i.amount, 0);
  const uncollected = netList.filter((i) => i.status !== 'approved');
  const uncollectedValue = uncollected.reduce((s, i) => s + i.amount, 0);
  const collectionRate = netInvoiced ? Math.round((collectedValue / netInvoiced) * 1000) / 10 : 0;
  return {
    gross,
    excludedCount: excludedInvoices.length,
    excludedValue,
    netInvoiced,
    collectedCount: collected.length,
    collectedValue,
    uncollectedCount: uncollected.length,
    uncollectedValue,
    collectionRate,
    invoiceCount: invoices.length
  };
}

export function computeExclusionBreakdown(invoices) {
  const cats = { duplicate: { count: 0, value: 0 }, appeal: { count: 0, value: 0 }, invalid_debtor: { count: 0, value: 0 }, enforcement: { count: 0, value: 0 } };
  for (const inv of invoices) {
    for (const r of exclusionReasons(inv)) {
      cats[r].count += 1;
      cats[r].value += inv.amount;
    }
  }
  return cats;
}

export function computeByProvince(invoices) {
  const stats = new Map(KSA_PROVINCES.map((p) => [p.iso, {
    count: 0, gross: 0, collected: 0, violationCount: 0, enforcementCount: 0, revenue: new Map()
  }]));
  for (const inv of invoices) {
    const iso = AMANAH_TO_PROVINCE[inv.amanahEn];
    if (!iso) continue;
    const s = stats.get(iso);
    s.count += 1;
    s.gross += inv.amount;
    if (inv.status === 'approved') s.collected += inv.amount;
    if (inv.violationNumber) s.violationCount += 1;
    if (inv.collectedVia === 'enforcement') s.enforcementCount += 1;
    const gfs = gfsForInvoice(inv);
    if (gfs) {
      const entry = s.revenue.get(gfs.code) || { code: gfs.code, nameEn: gfs.nameEn, nameAr: gfs.nameAr, name: gfs.name, value: 0 };
      entry.value += inv.amount;
      s.revenue.set(gfs.code, entry);
    }
  }
  return KSA_PROVINCES.map((p) => {
    const s = stats.get(p.iso);
    const revenue = [...s.revenue.values()].sort((a, b) => b.value - a.value);
    return {
      iso: p.iso,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      hasData: p.amanahKeys.length > 0,
      count: s.count,
      gross: s.gross,
      collected: s.collected,
      uncollected: s.gross - s.collected,
      rate: s.gross ? Math.round((s.collected / s.gross) * 100) : 0,
      violationCount: s.violationCount,
      enforcementCount: s.enforcementCount,
      revenue,
      dominantRevenue: revenue[0] || null
    };
  }).filter((p) => p.hasData);
}

export function computeWorklist(invoices, anchorDate, valueWeight = 60) {
  if (!invoices.length) return [];
  const ageDays = (d) => Math.max(0, Math.round((new Date(`${anchorDate}T00:00:00Z`) - new Date(`${d}T00:00:00Z`)) / 86400000));
  const maxAmount = Math.max(...invoices.map((i) => i.amount), 1);
  const maxAge = Math.max(...invoices.map((i) => ageDays(i.date)), 1);
  return invoices
    .map((inv) => {
      const nv = inv.amount / maxAmount;
      const na = ageDays(inv.date) / maxAge;
      const score = Math.round((valueWeight / 100) * nv * 100 + ((100 - valueWeight) / 100) * na * 100);
      return { ...inv, ageInDays: ageDays(inv.date), score };
    })
    .sort((a, b) => b.score - a.score);
}

// Simple linear trend fit over the 8-month recovery-rate series — used only
// to produce an honestly-labeled, low/medium-confidence next-month estimate.
// This is NOT a real statistical forecast model; it's a demo-appropriate
// illustration of "trend continues at its recent slope."
export function computeRecoveryTrend(trendRecovery) {
  const n = trendRecovery.length;
  const xs = trendRecovery.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = trendRecovery.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - meanX) * (trendRecovery[i] - meanY), 0) / xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  const intercept = meanY - slope * meanX;
  const nextValue = Math.round((slope * n + intercept) * 10) / 10;
  const lastValue = trendRecovery[n - 1];
  return { slope: Math.round(slope * 100) / 100, nextValue, lastValue };
}

export function buildReportData({ anchorDate } = {}) {
  const invoices = INVOICES;
  const anchor = anchorDate || invoices.reduce((max, i) => (i.date > max ? i.date : max), invoices[0].date);
  const kpi = computeKpi(invoices);
  const exclusions = computeExclusionBreakdown(invoices);
  const byProvince = computeByProvince(invoices);
  const worklist = computeWorklist(invoices, anchor, 60).slice(0, 5);
  const sortedByRate = [...byProvince].sort((a, b) => a.rate - b.rate);
  const worstProvince = sortedByRate[0];
  const bestProvince = [...byProvince].sort((a, b) => b.rate - a.rate)[0];
  const biggestGapProvince = [...byProvince].sort((a, b) => b.uncollected - a.uncollected)[0];
  const investmentInvoices = invoices.filter((i) => i.source === 'Foras');
  const flaggedNoContract = investmentInvoices.filter((i) => i.hasContract === false);

  return {
    invoices,
    anchor,
    kpi,
    exclusions,
    byProvince,
    worklist,
    worstProvince,
    bestProvince,
    biggestGapProvince,
    sameProvince: worstProvince && biggestGapProvince ? worstProvince.iso === biggestGapProvince.iso : false,
    investmentInvoices,
    flaggedNoContract,
    sanad: SANAD_ENFORCEMENT
  };
}
