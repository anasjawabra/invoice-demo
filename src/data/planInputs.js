// The data behind «خطط الإيرادات» and «غرفة القرارات»: payments received in a plan's period up to the reporting date (payment-date basis, any invoice) by Amanah and month, and the billing / balance of the selection.
// `loadPlanInputsForPlan` below is the ONE loader (the fiscal-year-only `loadPlanInputs` was retired in the cleanup phase), so the plan page and the Decision Room read the same figures. Rules in force are the APPROVED ones only (planning never counts an unapproved exclusion).
import { EXCLUSION_RULES, normalizeConfig } from './revenueMetrics';
import { appropriationKeys, HQ_KEY } from './appropriations';
import { normalizeGeoScope } from './geoScope';
import { DATA_START } from './revenueLedger';
import { resolveViewScope, historyMonths, upcomingForecastSupport } from './plans/planBasis';
import { monthRows, monthStart, monthEnd, periodValid } from './plans/planMath';

export const approvedConfigOf = (cfg) => normalizeConfig({ ...cfg, rules: Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.approval === 'approved'])) });

/**
 * The entities (rows of the budget table) a viewer may see: every one for an all-access person; for a restricted person the organisation's Amanahs ∩ the Amanahs of the person's own geographic grants
 * (+ the housing sector when the grant includes non-municipal entities). The headquarters is never visible to a restricted viewer. `restricted` = fewer rows than the whole Ministry.
 * Targets are NEVER computed from this set: it only chooses which entities are shown.
 */
export function visibleEntityKeys({ orgKeys = null, geoScope = null } = {}) {
  const all = appropriationKeys(); let keys = all.slice();
  if (orgKeys) keys = keys.filter((k) => orgKeys.includes(k) && k !== HQ_KEY);
  const sc = geoScope ? normalizeGeoScope(geoScope) : null;
  if (sc && !sc.all) keys = keys.filter((k) => sc.grants.some((g) => g.amanah === k) || (sc.nonMunicipal && k === 'Housing Sector'));
  return { keys, restricted: keys.length < all.length, all: keys.length === all.length };
}
/**
 * The period-aware inputs of ONE plan version (revenue plans, spec §5) — the same data-service calls as `loadPlanInputs`, for ANY period.
 *   scope      Ministry plan, unrestricted viewer → amanah 'all'; an entity plan (or a restricted viewer) → ONE call with the LIST of entities (`amanah: [...]` — the engine's resolveScope takes a list),
 *              so the entities are summed by the engine itself (no per-entity fan-out, no float re-summing here).
 *   actual     { monthly: (number|null)[] aligned with monthRows(period) from period.start to the cut-off (the last may be partial; a month before DATA_START = null, NOT 0), byEntity, total, meta }
 *   history    { planId, versionId, scopeKey, period, cutoff, months: [{ ym, value|null }] } — the last 3 COMPLETE calendar months on/before the cut-off (they may precede the period); a month with no data is null.
 *              Months wholly inside [period.start, cut-off] come from the same series call; the others from ONE extra series call over the whole month range (parallel).
 *   meta       { planId, versionId, scopeKey, period, cutoff } — carried by both so the basis and the forecast can refuse a mismatched input.
 *   viewScope  { amanah:'all'|key, muni:'all'|MREF id } — the VIEW filter (spec §9), resolved by `resolveViewScope` exactly as the basis does (same `meta.scopeKey`, which carries `|view:<Amanah>|muni:<MREF>`):
 *              an Amanah → `amanah:[key]` and the SAME snapshot call also returns `receivedInPeriod.byMunicipality` (payments by municipality group), from which
 *                 actual.byMunicipality = { [MREF id]: amount }  (reference municipalities) and actual.unattributed = { total, direct, notSpecified, unresolved }  (records with no municipality of the reference:
 *                 issued directly by the Amanah · not specified in source · unmapped / conflicting) — every payment is in exactly ONE group, so Σ byMunicipality + unattributed.total = the snapshot's total (= Σ monthly);
 *              a municipality → the data service's own municipality scope (`scope.muni = '<Amanah>|<MREF-…>'`) for the monthly collections AND the history, so a municipality's forecast uses its own history.
 *              An invalid view scope returns `{ meta, invalid: <reason>, actual: null, history: null }` (the basis then answers `invalid_view_scope`).
 *   upcomingHistory  (option, default false) — for an UPCOMING period (the cut-off precedes the period start) whose start is within the forecast support window (planBasis.upcomingForecastSupport) also load the `history` the upcoming forecast needs:
 *              the last 3 complete calendar months before the cut-off in ONE series call over the same scope (`actual` stays null: nothing is collected inside the period yet).
 * Returns null when `reporting` is missing; `{ future: true, ... }` (no actual; history only with `upcomingHistory`) when the cut-off precedes the period start.
 */
export async function loadPlanInputsForPlan(rev, { view, reporting, approvedCfg, entityKeys = null, viewScope = null, upcomingHistory = false }) {
  const period = view?.period || view?.content?.period; if (!reporting || !periodValid(period)) return null;
  const rv = resolveViewScope({ scope: view.scope || view.content?.scope, entityKeys, viewScope }); const sc = rv.sc;
  const cutoff = reporting < period.end ? reporting : period.end;
  const meta = { planId: view.planId ?? null, versionId: view.versionId ?? null, scopeKey: rv.scopeKey, period: { start: period.start, end: period.end }, cutoff };
  if (rv.mode === 'invalid') return { meta, invalid: rv.invalid, future: false, actual: null, history: null, byAmanah: {}, total: 0, monthly: [], facts: null };
  if (cutoff < period.start) {
    const futureOut = { meta, future: true, actual: null, history: null, byAmanah: {}, total: 0, monthly: [], facts: null };
    if (!upcomingHistory || !upcomingForecastSupport({ asOf: cutoff, periodStart: period.start }).supported) return futureOut;
    const hmF = historyMonths(cutoff); const needF = hmF.filter((ym) => monthEnd(ym) >= DATA_START);
    const sF = needF.length ? { from: monthStart(needF[0]) < DATA_START ? DATA_START : monthStart(needF[0]), to: monthEnd(needF[needF.length - 1]), amanah: sc.amanah, source: 'all', scopeType: 'all', muni: rv.mode === 'municipality' ? rv.muniKey : 'all', status: 'all' } : null;
    const serF = sF ? await rev.data.series(sF, { cfg: approvedCfg }) : null;
    const valF = (ym) => { if (!serF) return null; const i = serF.months.indexOf(ym); return i >= 0 ? serF.values[i] : null; };
    return { ...futureOut, history: { ...meta, months: hmF.map((ym) => ({ ym, value: monthEnd(ym) < DATA_START ? null : valF(ym) })) } };
  }
  const rows = monthRows(period).filter((r) => r.start <= cutoff);
  const from = period.start < DATA_START ? DATA_START : period.start;
  const scope = { from, to: cutoff, amanah: sc.amanah, source: 'all', scopeType: 'all', muni: rv.mode === 'municipality' ? rv.muniKey : 'all', status: 'all' };
  const hm = historyMonths(cutoff);
  const covered = (ym) => rows.some((r) => r.ym === ym && r.start === monthStart(ym) && r.end === monthEnd(ym) && r.end <= cutoff && monthStart(ym) >= from);
  const needExtra = hm.filter((ym) => monthEnd(ym) >= DATA_START && !covered(ym));
  const extraScope = needExtra.length ? { ...scope, from: monthStart(needExtra[0]) < DATA_START ? DATA_START : monthStart(needExtra[0]), to: monthEnd(needExtra[needExtra.length - 1]) } : null;
  const noData = from > cutoff;
  const [snap, ser, serHist] = await Promise.all([
    noData ? null : rev.data.snapshot(scope, { cfg: approvedCfg }),
    noData ? null : rev.data.series(scope, { cfg: approvedCfg }),
    extraScope && extraScope.from <= extraScope.to ? rev.data.series(extraScope, { cfg: approvedCfg }) : null
  ]);
  const valOf = (series, ym) => { if (!series) return null; const i = series.months.indexOf(ym); return i >= 0 ? series.values[i] : null; };
  const monthly = rows.map((r) => (r.end < DATA_START || !ser ? null : valOf(ser, r.ym)));
  const history = {
    ...meta,
    months: hm.map((ym) => {
      if (monthEnd(ym) < DATA_START) return { ym, value: null };
      const i = rows.findIndex((r) => r.ym === ym);
      return { ym, value: covered(ym) && i >= 0 ? monthly[i] : valOf(serHist, ym) };
    })
  };
  const R = snap?.receivedInPeriod || { byAmanah: {}, total: 0 };
  const byEntity = R.byAmanah || {};
  const actual = { monthly, byEntity, total: monthly.some((x) => x != null) ? monthly.reduce((t, x) => t + (x || 0), 0) : null, meta };
  if (rv.mode === 'amanah' && snap) {
    // one bucket per payment: a reference municipality, or «غير موزع على البلديات» (issued directly / not specified in source / unmapped or conflicting)
    const prefix = `${rv.amanah}|`; const byMunicipality = {}; const un = { total: 0, direct: 0, notSpecified: 0, unresolved: 0 };
    for (const [k, v] of Object.entries(R.byMunicipality || {})) {
      if (!k.startsWith(prefix) || !(typeof v === 'number')) continue; const tok = k.slice(prefix.length);
      if (tok === 'DIRECT') { un.direct += v; un.total += v; } else if (tok === 'NOT_SPECIFIED') { un.notSpecified += v; un.total += v; } else if (tok === 'UNRESOLVED') { un.unresolved += v; un.total += v; } else byMunicipality[tok] = v;
    }
    actual.byMunicipality = byMunicipality; actual.unattributed = un;
  }
  let facts = null; let billedMonthly = []; let standing = null; let cells = [];
  if (snap) {
    const netBy = new Map(snap.byMonth.map((x) => [x.month, x.net])); const t = snap.totals; const nc = snap.noncollection || {};
    facts = {
      net: t.net, gross: t.gross, exclusions: t.exclusions, cancelled: t.cancelled, cancelledCount: t.cancelledCount,
      fromPriorInvoices: R.fromPriorInvoices ?? null, collectedCohort: t.net > 0 ? t.collected / t.net : null,
      netUncollected: snap.stock?.netUncollected ?? null, objectionOutstanding: snap.stock?.objectionOutstanding ?? 0,
      linkageUnresolved: { count: nc.linkage_unresolved?.count || 0, amount: nc.linkage_unresolved?.amount || 0 },
      quality: { missingFieldCount: snap.quality?.missingFieldCount ?? 0, amountConflictCount: snap.quality?.amountConflictCount ?? 0 }
    };
    billedMonthly = rows.map((r) => netBy.get(r.ym) || 0); standing = snap.stock.netUncollected; cells = snap.matrix.amanahSource;
  }
  return { meta, future: false, actual, history, byAmanah: byEntity, total: R.total ?? 0, monthly, billedMonthly, standing, cells, facts, partialDataStart: period.start < DATA_START ? DATA_START : null };
}
