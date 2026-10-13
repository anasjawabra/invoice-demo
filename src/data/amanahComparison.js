// Fair (mix-adjusted) comparison of Amanahs — used by the Amanah report. Pure: every input is a figure of the shared snapshot.
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
