// The data behind «التخطيط» and «غرفة القرارات»: payments received from 1 January to the reporting date (payment-date basis, any invoice) by Amanah and month, and the billing / balance of the selection.
// ONE function so the planning page and the Decision Room read the same figures. Rules in force are the APPROVED ones only (planning never counts an unapproved exclusion).
import { EXCLUSION_RULES, normalizeConfig } from './revenueMetrics';

export const approvedConfigOf = (cfg) => normalizeConfig({ ...cfg, rules: Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.approval === 'approved'])) });

export async function loadPlanInputs(rev, { year, amanah = 'all', reporting, approvedCfg }) {
  if (!reporting) return null;
  const scope = { from: `${year}-01-01`, to: reporting, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
  const [snap, ser, entSnap] = await Promise.all([
    rev.data.snapshot(scope, { cfg: approvedCfg }),
    rev.data.series({ ...scope, amanah }, { cfg: approvedCfg }),
    amanah === 'all' ? null : rev.data.snapshot({ ...scope, amanah }, { cfg: approvedCfg })
  ]);
  const S = entSnap || snap; const R = snap.receivedInPeriod;
  const m = Number(reporting.slice(5, 7)); const netBy = new Map(S.byMonth.map((x) => [x.month, x.net]));
  return { byAmanah: R.byAmanah || {}, total: R.total, monthly: ser.values, billedMonthly: Array.from({ length: m }, (_, k) => netBy.get(`${year}-${String(k + 1).padStart(2, '0')}`) || 0), standing: S.stock.netUncollected, cells: S.matrix.amanahSource };
}
