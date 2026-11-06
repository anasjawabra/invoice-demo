// THE PERIOD-AWARE PLANNING BASIS — one pure object per (plan version, scope, reporting cut-off) that every plan surface reads (docs/revenue-plans-spec.md §0, §1, §5).
// It works for an annual plan AND for any date range. It is ADDITIVE: the store-based `planningBasis` (planningBasis.js) keeps working until the cleanup phase.
// Pure functions, no I/O. Money = riyals; every *Pct / *Ratio is a FRACTION (0.402 = 40.2 %). Text fields are bilingual { ar, en }.
//
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//   planningBasisFromPlan({ view, today, latestDataDate = today, entityKeys = null, actual = null, staleDays = 3 }) → basis
//     view     = planView(...) of spec §10: { planId, versionId, versionNumber, name, state:'active' (internal constant), origin?, period:{start,end,preset}, scope:{kind,entityKeys?},
//                content:{ target:{amount}, allocations, distribution, entityDistributions?, … }, isHistorical }
//     actual   = what `loadPlanInputsForPlan` returned in `.actual`:
//                { monthly: (number|null)[]  collections by payment month from period.start to the cut-off, aligned with monthRows(period) (the last may be partial; a null month = NOT OBSERVED, never 0),
//                  byEntity?: { [entityKey]: amount }  collections from period.start to the cut-off,
//                  meta?: { planId, versionId, scopeKey, period, cutoff }  — when present it is checked against the view (mismatch → incompatible_input / stale_input, no numbers) }
//     entityKeys = the entities the viewer may see (null = all). Targets/allocations belong to the PLAN; a viewer's keys only choose the rows summed (label «إجمالي الجهات المتاحة لك»).
//   → basis.state (CALCULATION state; the plan's lifecycle state is `planState`)
//        ok · future_period · completed · no_target (zero / not set) · no_data · incompatible_input · stale_input · invalid_period
//   → the FOUR DISTINCT DATES: reportingCutoff (min(today, period end, latest data date)) · latestActualDataDate · lastCompleteMonth (the last calendar month fully on/before the cut-off:
//        the CANDIDATE end of the rate window; `forecastPlan` overwrites it with the last month actually used) · forecastGeneratedAt (null here; set by the forecast).
//   VIEW SCOPE (spec §9, municipality dimension): planningBasisFromPlan({ …, viewScope: { amanah: 'all'|<entity key>, muni: 'all'|<MREF id> } }) — a FILTER, never written to the plan.
//     amanah only → target / planned / rows are that Amanah's; when the plan holds `content.municipalAllocations` for it the rows become MUNICIPALITY rows (key = MREF id) + a final row
//                   { key: '__unallocated_muni__' } «غير موزع على البلديات» (target = Amanah target − Σ municipal allocations; actual = records with no municipality), Σ rows = the Amanah to the riyal.
//     amanah + municipality → target = its explicit municipal allocation; planned = apportioned over the Amanah's distribution; NO allocation ⇒ state 'no_municipal_target' (target null, every
//                   target-dependent measure null + reason 'no_municipal_target', the actual still shown) — the Amanah target is NEVER reused or divided.
//     a bad combination (municipality without Amanah, an Amanah the viewer cannot see, a municipality of another Amanah) → state 'invalid_view_scope'.
//     `scopeKey` carries the view (`|view:<Amanah>|muni:<MREF>`): an input loaded for another view or municipality is `incompatible_input`. No viewScope ⇒ exactly the behaviour above.
//   → NO tolerance, NO status/«on plan/ahead/behind» classification: `deviation` = { amount (signed), pct (tooltip / detail only), unavailable } and `vsPlanRatio` = actual ÷ plannedToDate.
//   → achievementToDate = actual ÷ the FULL-period target, never capped.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
import { monthRows, planMonthly, monthAmounts, plannedTo, periodValid, isISODate, daysInclusive, addDays, monthEnd, isCalendarYear, municipalMonthlyBreakdown } from './planMath';
import { municipalitiesOf, municipalityByRef } from '../amanahHierarchy';
import { ENTITIES } from '../catalog';
import { appropriationKeys, HQ_KEY } from '../appropriations';
import { fmtMoney } from '../../utils/money';

const bi = (ar, en) => ({ ar, en });
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const sum = (a, f = (x) => x) => a.reduce((t, x) => t + f(x), 0);
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const MONTH_NAMES = { ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
export const planMonthLabel = (ym) => { const m = Number(ym.slice(5, 7)); return bi(`${MONTH_NAMES.ar[m - 1]} ${ym.slice(0, 4)}`, `${MONTH_NAMES.en[m - 1]} ${ym.slice(0, 4)}`); };

export const EQUAL_ASSUMPTION = bi('توزيع متساوٍ — افتراض', 'Equal distribution — an assumption');
export const CALENDAR_YEAR_ASSUMPTION = bi('السنة المالية يناير–ديسمبر افتراض بانتظار تأكيد الجهة المعنية', 'The January–December fiscal year is an assumption pending business confirmation');
export const RESTRICTED_LABEL = bi('إجمالي الجهات المتاحة لك', 'Total of the entities available to you');
export const MINISTRY_LABEL = bi('الوزارة (كل الجهات)', 'The Ministry (all entities)');
export const UNALLOCATED_MUNI_KEY = '__unallocated_muni__';
export const UNALLOCATED_MUNI_LABEL = bi('غير موزع على البلديات', 'Not distributed to municipalities');
export const NO_MUNICIPAL_TARGET = bi('لم يُحدد مستهدف لهذه البلدية', 'No target has been set for this municipality');

/** the text of every explicit state (the UI prints these; none is an error) */
export const PLAN_STATE_TEXT = {
  ok: null,
  future_period: bi('فترة الخطة لم تبدأ بعد: لا محصّل ولا انحراف ولا توقع', 'The plan period has not started: no actual, no deviation, no forecast'),
  completed: bi('انتهت فترة الخطة: النتيجة النهائية للتحقيق، بلا وتيرة مطلوبة ولا توقع', 'The plan period has ended: final achievement, no required pace, no forecast'),
  no_target: bi('لا مستهدف لهذه الخطة: لا نسبة تحقق ولا انحراف ولا فجوة', 'This plan has no target: no achievement, no deviation, no gap'),
  no_data: bi('لا بيانات فعلية لهذه الفترة بعد', 'No actual data for this period yet'),
  incompatible_input: bi('مدخلات البيانات لا تخص هذه الخطة/الإصدار/النطاق/الفترة: لا تُعرض أرقام', 'The data input does not belong to this plan / version / scope / period: no figures are shown'),
  stale_input: bi('مدخلات البيانات محسوبة لتاريخ إغلاق مختلف: لا تُعرض أرقام', 'The data input was computed for a different cut-off date: no figures are shown'),
  invalid_period: bi('فترة الخطة غير صالحة', 'The plan period is not valid'),
  no_municipal_target: NO_MUNICIPAL_TARGET,
  invalid_view_scope: bi('نطاق العرض غير صالح: الأمانة أو البلدية غير متاحة أو غير متطابقة', 'The view scope is not valid: the Amanah or municipality is unavailable or does not match'),
  insufficient_history: bi('لا يكفي سجل لخط الأساس: المطلوب 3 أشهر مكتملة مرصودة', 'Not enough history for the baseline: 3 complete observed months are needed')
};

/** the normalised scope of a plan for one viewer: { kind, universe, visible, restricted, key, amanah } — `amanah` is what the data service takes ('all' or a list of entity keys) */
export function planScope(scope, entityKeys = null) {
  const kind = scope?.kind === 'entities' ? 'entities' : 'ministry';
  const universe = kind === 'ministry' ? appropriationKeys().filter((k) => k !== HQ_KEY) : [...(scope?.entityKeys || [])];
  const visible = Array.isArray(entityKeys) ? universe.filter((k) => entityKeys.includes(k)) : universe.slice();
  const restricted = Array.isArray(entityKeys) && visible.length < universe.length;
  const key = (kind === 'ministry' ? 'ministry' : `entities:${universe.slice().sort().join(',')}`) + (restricted ? `|visible:${visible.slice().sort().join(',')}` : '');
  return { kind, universe, visible, restricted, key, amanah: kind === 'ministry' && !restricted ? 'all' : visible };
}
export const planScopeKey = (scope, entityKeys = null) => planScope(scope, entityKeys).key;

/* ------------------------------------------------------------------------------------------------ VIEW SCOPE (spec §9) — a filter, never part of the plan */
export const DEFAULT_VIEW_SCOPE = Object.freeze({ amanah: 'all', muni: 'all' });
const entLabel = (key) => { const e = ENTITIES.find((x) => x.en === key); return e ? bi(e.ar, e.en) : bi(key, key); };
/** { amanah: 'all'|key, muni: 'all'|refId } — anything else collapses to 'all' */
export function normalizeViewScope(vs) {
  const t = (x) => (typeof x === 'string' && x && x !== 'all' ? x : 'all');
  return { amanah: t(vs?.amanah), muni: t(vs?.muni) };
}
/**
 * The ONE resolution of a view scope, shared by the basis and the data loader so that both stamp the same `scopeKey`:
 *   mode 'none'         no view scope: the plan's own scope for this viewer (today's behaviour, scopeKey unchanged)
 *   mode 'amanah'       one Amanah: sc = planScope(scope, [amanah]); the data call takes amanah:[key]
 *   mode 'municipality' one municipality of that Amanah: also `muniKey` = the data service's municipality filter value '<Amanah>|<MREF-…>'
 *   mode 'invalid'      municipality without Amanah · an Amanah the viewer cannot see · a municipality that is not under that Amanah (`invalid` = the reason)
 * → { vs, mode, invalid, sc (the scope the numbers are computed on), viewer (planScope for the viewer), scopeKey, amanah, muniId, muniKey, muni (reference row | null), label {ar,en}|null }
 */
export function resolveViewScope({ scope = null, entityKeys = null, viewScope = null } = {}) {
  const vs = normalizeViewScope(viewScope); const viewer = planScope(scope, entityKeys);
  const suffix = (vs.amanah !== 'all' ? `|view:${vs.amanah}` : '') + (vs.muni !== 'all' ? `|muni:${vs.muni}` : '');
  const out = (mode, extra = {}) => ({ vs, mode, invalid: null, sc: viewer, viewer, scopeKey: viewer.key + suffix, amanah: null, muniId: null, muniKey: null, muni: null, label: null, ...extra });
  if (vs.amanah === 'all' && vs.muni === 'all') return out('none');
  if (vs.amanah === 'all') return out('invalid', { invalid: 'municipality_without_amanah' });
  if (!viewer.visible.includes(vs.amanah)) return out('invalid', { invalid: 'amanah_not_available' });
  const sc = planScope(scope, [vs.amanah]);
  if (vs.muni === 'all') return out('amanah', { sc, amanah: vs.amanah, label: entLabel(vs.amanah) });
  const m = municipalityByRef(vs.muni);
  if (!m || m.amanahKey !== vs.amanah) return out('invalid', { invalid: 'municipality_not_in_amanah' });
  const a = entLabel(vs.amanah);
  return out('municipality', { sc, amanah: vs.amanah, muniId: m.refId, muniKey: m.key, muni: m, label: bi(`${m.ar} — ${a.ar}`, `${m.en} — ${a.en}`) });
}

/** the municipal allocations of one Amanah of a plan content, de-duplicated by municipality id (duplicates add up): [{ id, amount, origin, note }] in the reference order, unknown ids last */
export function municipalAllocationsOf(content, amanahKey) {
  const by = new Map();
  for (const m of (content?.municipalAllocations || [])) {
    if (!m || m.entityKey !== amanahKey || typeof m.muniId !== 'string' || !fin(m.amount) || m.amount < 0) continue;
    const cur = by.get(m.muniId); by.set(m.muniId, cur ? { ...cur, amount: cur.amount + Math.round(m.amount) } : { id: m.muniId, amount: Math.round(m.amount), origin: m.origin ?? null, note: m.note ?? null });
  }
  const order = new Map(municipalitiesOf(amanahKey).map((x, i) => [x.refId, i]));
  return [...by.values()].sort((a, b) => (order.has(a.id) ? order.get(a.id) : 1e6) - (order.has(b.id) ? order.get(b.id) : 1e6));
}

/** the last calendar month that is fully on or before the cut-off (a month-end cut-off closes its own month) */
export function lastCompleteMonthBefore(cutoff) {
  if (!isISODate(cutoff)) return null;
  const ym = cutoff.slice(0, 7);
  if (cutoff === monthEnd(ym)) return ym;
  const y = Number(ym.slice(0, 4)); const m = Number(ym.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
/** the 3 calendar months (oldest → newest) that end at `lastCompleteMonthBefore(cutoff)` */
export function historyMonths(cutoff, n = 3) {
  let ym = lastCompleteMonthBefore(cutoff); if (!ym) return [];
  const out = [];
  for (let i = 0; i < n; i += 1) { out.unshift(ym); const y = Number(ym.slice(0, 4)); const m = Number(ym.slice(5, 7)); ym = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; }
  return out;
}

/**
 * THE SUPPORT RULE of the forecast of an UPCOMING period (the period starts after the last data date): the recent run-rate (the last three complete observed months before the data cut-off) is carried over the period only when the period
 * STARTS WITHIN `UPCOMING_FORECAST_MAX_GAP_DAYS` days after the last data date. A period starting later (e.g. the 2027 plan, 56 days after) is NOT supported: the run-rate of the last quarter is not extended across months of another season/year.
 * → { supported, gapDays (days from the last data date to the period start), reason: null | 'too_far' | 'no_data_date' | 'not_upcoming' }
 */
export const UPCOMING_FORECAST_MAX_GAP_DAYS = 31;
export function upcomingForecastSupport({ asOf, periodStart } = {}) {
  if (!isISODate(asOf) || !isISODate(periodStart)) return { supported: false, gapDays: null, reason: 'no_data_date' };
  const gapDays = dayDiff(asOf, periodStart);
  if (gapDays < 1) return { supported: false, gapDays, reason: 'not_upcoming' };
  return gapDays <= UPCOMING_FORECAST_MAX_GAP_DAYS ? { supported: true, gapDays, reason: null } : { supported: false, gapDays, reason: 'too_far' };
}

/** the days still ahead (after the cut-off, to the period end), per calendar month: { days, months (Σ days ÷ month days), byMonth } */
export function remainingOf(rows, cutoff) {
  const byMonth = rows.map((r) => {
    const from = cutoff >= r.end ? null : addDays(cutoff, 1) > r.start ? addDays(cutoff, 1) : r.start;
    const days = from ? daysInclusive(from, r.end) : 0;
    return { ym: r.ym, days, monthDays: r.monthDays, fraction: days / r.monthDays };
  });
  return { days: sum(byMonth, (x) => x.days), months: sum(byMonth, (x) => x.fraction), byMonth };
}

/** signed deviation of an actual against a planned amount: { amount, pct (null when planned is 0), unavailable } — no tolerance, no verdict */
export function deviationAmount(actual, planned) {
  if (!fin(planned)) return { amount: null, pct: null, unavailable: 'no_plan' };
  if (!fin(actual)) return { amount: null, pct: null, unavailable: 'no_actual' };
  return { amount: actual - planned, pct: planned > 0 ? (actual - planned) / planned : null, unavailable: null };
}
const ratioOf = (actual, planned) => (!fin(planned) ? { value: null, reason: 'no_plan' } : !fin(actual) ? { value: null, reason: 'no_actual' } : !(planned > 0) ? { value: null, reason: 'planned_zero' } : { value: actual / planned, reason: null });

const notice = (code, tone, m) => ({ code, tone, ar: m.ar, en: m.en });
const sameRange = (a, b) => !!a && !!b && a.start === b.start && a.end === b.end;

export function planningBasisFromPlan({ view, today = null, latestDataDate = null, entityKeys = null, actual = null, staleDays = 3, viewScope = null } = {}) {
  const v = view || {}; const content = v.content || {}; const period = v.period || content.period || null;
  const rv = resolveViewScope({ scope: v.scope || content.scope, entityKeys, viewScope });
  const sc = rv.sc; const viewMode = rv.mode; // sc = the scope the numbers are computed on (the plan's, or the one Amanah of the view)
  const restrictedLike = viewMode === 'none' ? sc.restricted : true; // an Amanah / municipality view takes its target from the allocations it holds, like a restricted viewer
  const latest = latestDataDate || today || null;
  const base = {
    planId: v.planId ?? null, versionId: v.versionId ?? null, versionNumber: v.versionNumber ?? null, name: v.name ?? content.name ?? null, planState: v.state ?? null, origin: v.origin ?? null,
    isHistorical: !!v.isHistorical, period, scope: v.scope || content.scope || null,
    scopeKind: viewMode === 'amanah' ? 'amanah' : viewMode === 'municipality' ? 'municipality' : sc.kind === 'ministry' ? (sc.restricted ? 'available' : 'ministry') : (sc.restricted ? 'available' : 'entities'),
    scopeKey: rv.scopeKey, restricted: rv.viewer.restricted, today: today || null, forecastGeneratedAt: null,
    scopeLabel: rv.label || (sc.restricted ? RESTRICTED_LABEL : sc.kind === 'ministry' ? MINISTRY_LABEL : null),
    viewScope: rv.vs, viewLabel: rv.label, municipalState: null, municipal: null
  };
  const bare = (state, reason = null, extra = {}) => ({
    ...base, state, reason, message: PLAN_STATE_TEXT[state] || null, flags: flagsOf({ isHistorical: base.isHistorical }), reportingCutoff: null, latestActualDataDate: latest, lastCompleteMonth: null,
    target: { value: null, basis: null }, actualToDate: null, plannedToDate: null, achievementToDate: null, vsPlanRatio: null, vsPlanReason: reason, deviation: { amount: null, pct: null, unavailable: reason || 'no_plan' },
    months: [], periodInfo: null, entities: [], rowsKind: 'entity', remainder: null, allocation: null, notices: [], cumulative: { planned: [], actual: [] }, pace: { required: { state: 'none', reason: reason || state, monthly: null, daily: null, remainingDays: null, remainingMonths: null } },
    remaining: null, upcoming: null, outcome: null, stale: { is: false, days: 0, threshold: staleDays }, ...extra
  });

  if (!periodValid(period)) return bare('invalid_period', 'invalid_period');
  const rows = monthRows(period);
  const periodInfo = { start: period.start, end: period.end, preset: period.preset ?? null, days: daysInclusive(period.start, period.end), months: rows.length, isCalendarYear: isCalendarYear(period), year: isCalendarYear(period) ? Number(period.start.slice(0, 4)) : null };

  if (viewMode === 'invalid') return bare('invalid_view_scope', rv.invalid, { periodInfo });

  // ---- the input must belong to THIS plan version, scope (incl. the Amanah / municipality of the view), period and cut-off (checked before any number is produced)
  const meta = actual?.meta || null;
  if (meta) {
    if (meta.planId !== base.planId || meta.versionId !== base.versionId || meta.scopeKey !== rv.scopeKey || !sameRange(meta.period, period)) return bare('incompatible_input', 'input_mismatch', { periodInfo });
  }

  // ---- the plan side: target, months, entities (allocations) — Σ entity = plan to the riyal
  // Municipality dimension (view scope): `mp` = the municipal side of the Amanah of the view (null in a plain view).
  const masked = content.target?.masked === true || v.masked === true || content.masked === true; // a restricted viewer's copy (planAccess.maskPlanForViewer)
  let mp = null; let noMuniTarget = false; let rowsKind = 'entity';
  if (viewMode === 'amanah' || viewMode === 'municipality') {
    const A = rv.amanah; const arow = (content.allocations || []).find((a) => a.entityKey === A);
    const hidden = (Array.isArray(content.maskedAmanahKeys) && content.maskedAmanahKeys.includes(A)) || (masked && !(arow && fin(arow.amount))); // the Amanah's own amount is withheld from a municipal-only viewer
    const parts = municipalAllocationsOf(content, A); const sumM = sum(parts, (p) => p.amount);
    const AM = hidden ? null : (arow && fin(arow.amount) ? Math.round(arow.amount) : 0);
    // planMath.municipalMonthlyBreakdown (agent A2): each municipality is apportioned over the REMAINING monthly capacity of the Amanah ⇒ Σ municipalities + unallocated = the Amanah's months to the riyal
    // (an excess, or a masked municipal-only content with no Amanah row, apportions each municipality on its own: totals identical, ≤ 1 riyal per month apart)
    const mm = municipalMonthlyBreakdown(content, period, A);
    mp = { A, hidden, parts, sumM, AM, mm, excess: !hidden && sumM > AM, byId: Object.fromEntries(parts.map((p) => [p.id, p])) };
    rowsKind = viewMode === 'amanah' && parts.length > 0 ? 'municipality' : 'entity';
  }
  let allocs; let allocated; let T; let targetSet; let pm; let allocation;
  const roundingOf = (list) => list.map((a) => ({ entityKey: a.entityKey, ...monthAmounts(a.amount || 0, content.entityDistributions?.[a.entityKey] || content.distribution, rows).remainder }));
  if (viewMode === 'municipality') {
    // ONE municipality: its explicit allocation or NOTHING (never the Amanah's target, never a division of it)
    const own = mp.byId[rv.muniId] || null; allocs = []; allocated = own ? own.amount : 0; targetSet = true;
    noMuniTarget = !own; T = own ? own.amount : null;
    pm = { rows, entities: {}, plan: own ? mp.mm.municipalities[own.id] : rows.map(() => 0), allocated, complete: !!own };
    allocation = { allocated, unallocated: own ? 0 : null, excess: own ? 0 : null, complete: !!own, rows: own ? 1 : 0, rounding: { units: 0, byEntity: [] }, level: 'municipality' };
  } else if (rowsKind === 'municipality' || (viewMode === 'amanah' && mp.hidden)) {
    allocs = []; targetSet = true;
    if (mp.parts.length === 0) { noMuniTarget = true; T = null; allocated = 0; pm = { rows, entities: {}, plan: rows.map(() => 0), allocated: 0, complete: false }; allocation = { allocated: 0, unallocated: null, excess: null, complete: false, rows: 0, rounding: { units: 0, byEntity: [] }, level: 'municipality' }; }
    else {
      allocated = mp.sumM; T = mp.hidden ? mp.sumM : mp.AM;
      const plan = mp.hidden ? rows.map((_, i) => sum(mp.parts, (p) => mp.mm.municipalities[p.id][i])) : mp.mm.amanah;
      pm = { rows, entities: {}, plan, allocated, complete: !mp.hidden && !mp.excess && mp.AM === mp.sumM };
      allocation = { allocated, unallocated: mp.hidden ? null : Math.max(mp.AM - mp.sumM, 0), excess: mp.hidden ? null : Math.max(mp.sumM - mp.AM, 0), complete: pm.complete, rows: mp.parts.length, rounding: { units: 0, byEntity: [] }, level: 'municipality' };
    }
  } else {
    allocs = (content.allocations || []).filter((a) => !restrictedLike || sc.visible.includes(a.entityKey));
    allocated = sum(allocs, (a) => Math.round(Number(a.amount) || 0));
    const rawTarget = content.target?.amount;
    targetSet = fin(rawTarget);
    T = restrictedLike ? allocated : (targetSet ? Math.round(rawTarget) : null);
    const planContent = { ...content, allocations: allocs, target: { ...(content.target || {}), amount: T } };
    pm = planMonthly(planContent, period);
    const rounding = roundingOf(allocs);
    allocation = { allocated, unallocated: T != null ? Math.max(T - allocated, 0) : null, excess: T != null ? Math.max(allocated - T, 0) : null, complete: restrictedLike ? allocs.length > 0 : pm.complete, rows: allocs.length, rounding: { units: sum(rounding, (r) => r.units), byEntity: rounding.filter((r) => r.units > 0) } };
  }
  const dist = content.distribution || null;
  const profile = { kind: dist?.profile ?? null, assumption: dist?.profile === 'equal', label: dist?.profile === 'equal' ? EQUAL_ASSUMPTION : dist?.profile === 'manual' ? bi('توزيع شهري يدوي', 'Manual monthly distribution') : bi('لم يُحدَّد توزيع شهري', 'No monthly distribution chosen') };
  const target = { value: T, basis: viewMode === 'none' ? (content.target?.basis ?? null) : null, restricted: rv.viewer.restricted || !!mp?.hidden, ...(mp?.hidden ? { label: RESTRICTED_LABEL } : {}) };

  // ---- the dates
  const futurePeriod = !!today && today < period.start;
  let cutoff = null;
  if (!futurePeriod) { const cands = [period.end]; if (today) cands.push(today); if (latest) cands.push(latest); cutoff = cands.reduce((a, b) => (a < b ? a : b)); }
  const stale = { is: false, days: 0, threshold: staleDays };
  if (today && latest) { const ref = today < period.end ? today : period.end; stale.days = Math.max(dayDiff(latest, ref), 0); stale.is = stale.days > staleDays; }
  if (meta && cutoff && meta.cutoff !== cutoff) return bare('stale_input', 'cutoff_mismatch', { periodInfo, reportingCutoff: cutoff, latestActualDataDate: latest });
  const noDataYet = !futurePeriod && (!cutoff || cutoff < period.start || (latest != null && latest < period.start));

  // ---- actual
  const monthly = rows.map((r, i) => (cutoff && r.start <= cutoff && !futurePeriod && Array.isArray(actual?.monthly) && fin(actual.monthly[i]) ? actual.monthly[i] : null));
  const monthsToCutoff = rows.filter((r) => cutoff && r.start <= cutoff && !futurePeriod);
  const observed = monthly.filter((x) => x != null);
  const missingMonths = monthsToCutoff.filter((r, i) => monthly[i] == null).map((r) => r.ym);
  const hasActual = !noDataYet && !futurePeriod && Array.isArray(actual?.monthly) && observed.length > 0;
  const actualToDate = hasActual ? sum(observed) : null;

  // ---- state
  let state = 'ok'; let reason = null;
  if (futurePeriod) { state = 'future_period'; reason = 'not_started'; }
  else if (noMuniTarget) { state = 'no_municipal_target'; reason = 'no_municipal_target'; }
  else if (!(T > 0)) { state = 'no_target'; reason = targetSet || restrictedLike ? 'zero_target' : 'target_missing'; }
  else if (noDataYet) { state = 'no_data'; reason = 'no_data_in_period'; }
  else if (!hasActual) { state = 'no_data'; reason = 'actual_not_loaded'; }
  else if (cutoff >= period.end) { state = 'completed'; reason = 'period_ended'; }
  const calculable = state === 'ok' || state === 'completed' || state === 'no_data' || state === 'no_municipal_target';

  // ---- planned to date (needs a target and a cut-off)
  const planned = cutoff && T > 0 && cutoff >= period.start ? plannedTo(pm.plan, rows, cutoff) : null;
  const dev = T > 0 ? deviationAmount(actualToDate, planned) : { amount: null, pct: null, unavailable: reason || 'no_target' };
  const vs = T > 0 ? ratioOf(actualToDate, planned) : { value: null, reason: reason || 'no_target' };
  const achievementToDate = T > 0 && actualToDate != null ? actualToDate / T : null;
  const remainingTarget = T > 0 && actualToDate != null ? Math.max(T - actualToDate, 0) : T > 0 && futurePeriod ? T : null;
  const exceededBy = T > 0 && actualToDate != null && actualToDate > T ? actualToDate - T : 0;
  const aboveTarget = T > 0 && actualToDate != null && actualToDate >= T;
  // an UPCOMING period: the days / months of the WHOLE period lie ahead (the period start − 1 day plays the cut-off), so the required pace of the period can be stated before it starts; nothing is collected inside it yet
  const dataDates = [today, latest].filter(Boolean); const asOf = futurePeriod && dataDates.length ? dataDates.reduce((a, b) => (a < b ? a : b)) : null; // the data date an UPCOMING period is read at: min(today, last data date)
  const remaining = cutoff && !futurePeriod ? remainingOf(rows, cutoff) : futurePeriod ? remainingOf(rows, addDays(period.start, -1)) : null;
  const upcoming = futurePeriod ? { asOf, daysToStart: asOf ? dayDiff(asOf, period.start) : null, days: remaining.days, months: remaining.months, support: upcomingForecastSupport({ asOf, periodStart: period.start }) } : null;
  const partialMonth = !!cutoff && !futurePeriod && cutoff < period.end && cutoff !== monthEnd(cutoff.slice(0, 7));

  // ---- the required pace (day-based): nothing once the period has ended, nothing once the target is reached
  let required;
  if (futurePeriod && T > 0 && !noMuniTarget) required = { state: 'ok', reason: null, upcoming: true, monthly: T / remaining.months, daily: T / remaining.days, remainingDays: remaining.days, remainingMonths: remaining.months };
  else if (!(T > 0) || !cutoff || futurePeriod || actualToDate == null) required = { state: 'none', reason: futurePeriod ? 'not_started' : !(T > 0) ? (reason || 'no_target') : 'no_actual', monthly: null, daily: null, remainingDays: remaining?.days ?? null, remainingMonths: remaining?.months ?? null };
  else if (state === 'completed' || remaining.days === 0) required = { state: 'none', reason: 'period_ended', monthly: null, daily: null, remainingDays: 0, remainingMonths: 0 };
  else if (remainingTarget === 0) required = { state: 'none', reason: 'target_reached', monthly: null, daily: null, remainingDays: remaining.days, remainingMonths: remaining.months };
  else required = { state: 'ok', reason: null, monthly: remainingTarget / remaining.months, daily: remainingTarget / remaining.days, remainingDays: remaining.days, remainingMonths: remaining.months };

  // ---- months for the table / the cumulative chart (planned at each month end; the actual up to the cut-off, null after: a future month is missing, never zero)
  let cp = 0; let ca = 0;
  const months = rows.map((r, i) => {
    cp += pm.plan[i]; const a = monthly[i]; if (a != null) ca += a;
    return { ym: r.ym, start: r.start, end: r.end, days: r.days, monthDays: r.monthDays, partial: r.partial, planned: noMuniTarget ? null : pm.plan[i], plannedCum: noMuniTarget ? null : cp, actual: a, actualCum: a != null ? ca : null, reached: !!cutoff && !futurePeriod && cutoff >= r.start, complete: !!cutoff && !futurePeriod && cutoff >= r.end, cutoffMonth: !!cutoff && !futurePeriod && cutoff >= r.start && cutoff < r.end };
  });

  // ---- entities (the plan's allocations; a restricted viewer only the rows they may see). Σ planned = the plan's planned (floating-point exact to < 1e-6).
  const byEntity = hasActual && actual.byEntity ? actual.byEntity : null;
  const rowOf = (key, extra, t, monthsOf, act, hasMonths = true) => {
    const hasT = t != null && t > 0; const p = planned != null && hasT && hasMonths ? plannedTo(monthsOf, rows, cutoff) : null; const noT = t == null ? 'no_municipal_target' : 'no_target';
    const d = hasT ? deviationAmount(act, p) : { amount: null, pct: null, unavailable: noT }; const r = hasT ? ratioOf(act, p) : { value: null, reason: noT };
    return { key, ...extra, target: t, hasTarget: hasT, plannedToDate: p, actual: act, deviation: d.amount, deviationPct: d.pct, deviationUnavailable: d.unavailable, vsPlanRatio: r.value, vsPlanReason: r.reason, achievementToDate: hasT && act != null ? act / t : null, monthly: hasMonths ? monthsOf : null };
  };
  let entities; let remainder;
  if (rowsKind === 'municipality') {
    // the Amanah view with municipal allocations: one row per municipality (allocated, or with collections) + «غير موزع على البلديات»; Σ rows = the Amanah to the riyal
    const byM = hasActual && actual.byMunicipality ? actual.byMunicipality : null; const unattr = hasActual && actual.byMunicipality ? (actual.unattributed?.total ?? 0) : null;
    const ids = [...new Set([...mp.parts.map((x) => x.id), ...Object.keys(byM || {}).filter((k) => byM[k])])];
    const order = new Map(municipalitiesOf(mp.A).map((x, i) => [x.refId, i])); ids.sort((a, b) => (order.has(a) ? order.get(a) : 1e6) - (order.has(b) ? order.get(b) : 1e6));
    entities = ids.map((id) => {
      const part = mp.byId[id] || null; const ref = municipalityByRef(id);
      return rowOf(id, { rowKind: 'municipality', muniId: id, amanah: mp.A, label: ref ? bi(ref.ar, ref.en) : bi(id, id), origin: part?.origin ?? null, note: part?.note ?? null, targetState: part ? null : 'no_municipal_target' }, part ? part.amount : null, part ? mp.mm.municipalities[id] : null, byM ? (byM[id] || 0) : null, !!part);
    });
    if (!mp.hidden || (unattr != null && unattr !== 0)) {
      const UT = mp.hidden ? null : Math.max(mp.AM - mp.sumM, 0);
      entities.push(rowOf(UNALLOCATED_MUNI_KEY, { rowKind: 'unallocated_muni', amanah: mp.A, label: UNALLOCATED_MUNI_LABEL, origin: null, note: null, targetState: mp.hidden ? 'hidden' : null, excess: mp.excess }, UT, mp.hidden ? null : mp.mm.unallocated, unattr, !mp.hidden));
    }
    remainder = byM && !mp.hidden && actualToDate != null ? actualToDate - sum(entities, (e) => e.actual || 0) : null;
  } else if (viewMode === 'municipality') { entities = []; remainder = null; }
  else {
    entities = allocs.map((a) => { const t = Math.round(Number(a.amount) || 0); return rowOf(a.entityKey, { rowKind: 'entity', origin: a.origin ?? null, note: a.note ?? null }, t, pm.entities[a.entityKey], byEntity ? (byEntity[a.entityKey] || 0) : null); });
    remainder = byEntity && !restrictedLike && actualToDate != null ? actualToDate - sum(entities, (e) => e.actual || 0) : null;
  }

  // ---- the states to print
  const notices = [];
  if (base.isHistorical) notices.push(notice('historical', 'info', bi('إصدار سابق للقراءة فقط', 'An earlier version, read-only')));
  if (v.origin === 'seed') notices.push(notice('illustrative_plan', 'warn', bi('خطة توضيحية (بيانات توضيحية) — ليست مستهدفًا رسميًا', 'An illustrative plan (illustrative data) — not an official target')));
  if (T > 0 && profile.assumption) notices.push(notice('equal_distribution', 'warn', EQUAL_ASSUMPTION));
  if (periodInfo.isCalendarYear && period.preset === 'fiscal-year') notices.push(notice('calendar_assumption', 'info', CALENDAR_YEAR_ASSUMPTION));
  if (noMuniTarget && state !== 'future_period') notices.push(notice('no_municipal_target', 'warn', NO_MUNICIPAL_TARGET));
  if (!(T > 0) && !noMuniTarget && state !== 'future_period') notices.push(notice('zero_target', 'warn', PLAN_STATE_TEXT.no_target));
  if (T > 0 && !allocation.complete && !restrictedLike) notices.push(notice('allocation_incomplete', 'warn', allocation.excess > 0 ? bi(`مجموع التخصيصات يتجاوز المستهدف بمقدار ${fmtMoney(allocation.excess, { lang: 'ar' })}`, `The allocations exceed the target by ${fmtMoney(allocation.excess, { lang: 'en' })}`) : bi(`غير مخصّص من المستهدف ${fmtMoney(allocation.unallocated, { lang: 'ar' })}`, `${fmtMoney(allocation.unallocated, { lang: 'en' })} of the target is unallocated`)));
  if (partialMonth && cutoff) notices.push(notice('partial_month', 'info', bi(`الأرقام حتى ${cutoff}؛ الشهر الأخير لم يكتمل ويُحتسب المخطط بالتناسب على أيامه`, `Figures are to ${cutoff}; the last month is not complete and the plan is prorated by its days`)));
  if (stale.is) notices.push(notice('stale_data', 'warn', bi(`بيانات غير محدّثة: آخر بيانات ${latest} والتاريخ ${today} (${stale.days} أيام)`, `Data is not up to date: latest data ${latest}, today ${today} (${stale.days} days)`)));
  if (hasActual && missingMonths.length) notices.push(notice('data_gap', 'warn', bi(`أشهر بلا بيانات مرصودة داخل الفترة: ${missingMonths.join('، ')} — لا تُعدّ صفرًا`, `Months with no observed data inside the period: ${missingMonths.join(', ')} — not treated as zero`)));
  if (aboveTarget) notices.push(notice('above_target', 'good', bi(`تحقق المستهدف — تجاوز بمقدار ${fmtMoney(exceededBy, { lang: 'ar' })}`, `Target reached — exceeded by ${fmtMoney(exceededBy, { lang: 'en' })}`)));
  const outcome = state === 'completed' && T > 0 ? { achieved: actualToDate >= T, amount: actualToDate - T, pct: actualToDate / T, label: actualToDate >= T ? bi(`انتهت الفترة: تحقق المستهدف بتجاوز ${fmtMoney(actualToDate - T, { lang: 'ar' })}`, `The period has ended: the target was reached, exceeded by ${fmtMoney(actualToDate - T, { lang: 'en' })}`) : bi(`انتهت الفترة: لم يتحقق المستهدف — الفرق ${fmtMoney(T - actualToDate, { lang: 'ar' })}`, `The period has ended: the target was not reached — short by ${fmtMoney(T - actualToDate, { lang: 'en' })}`) } : null;
  if (outcome) notices.push(notice('period_end', outcome.achieved ? 'good' : 'warn', outcome.label));

  return {
    ...base, state, reason, message: PLAN_STATE_TEXT[state] || null,
    flags: flagsOf({ isHistorical: base.isHistorical, zeroTarget: !(T > 0) && !noMuniTarget, noMunicipalTarget: noMuniTarget, assumedDistribution: T > 0 && profile.assumption, partialMonth, aboveTarget, staleData: stale.is, periodEnded: state === 'completed', incompleteActual: hasActual && missingMonths.length > 0, allocationIncomplete: viewMode === 'none' && T > 0 && !allocation.complete }),
    periodInfo, profile,
    reportingCutoff: cutoff, latestActualDataDate: latest, lastCompleteMonth: cutoff && !futurePeriod ? lastCompleteMonthBefore(cutoff) : null, stale, partialMonth, remaining, upcoming, missingMonths,
    target, allocation, actualToDate, plannedToDate: planned, achievementToDate, vsPlanRatio: vs.value, vsPlanReason: vs.reason, deviation: dev, remainingTarget, exceededBy,
    pace: { required }, outcome, months, cumulative: { planned: months.map((m) => m.plannedCum), actual: months.map((m) => m.actualCum) }, entities, rowsKind, remainder, calculable, notices,
    municipalState: viewMode === 'municipality' ? (noMuniTarget ? 'no_municipal_target' : 'allocated') : viewMode === 'amanah' ? (mp.parts.length > 0 ? 'distributed' : mp.hidden ? 'no_municipal_target' : 'not_distributed') : null,
    municipal: mp ? { view: viewMode, amanah: mp.A, muniId: rv.muniId, allocatedCount: mp.parts.length, allocatedTotal: mp.sumM, unallocated: mp.hidden ? null : Math.max(mp.AM - mp.sumM, 0), excess: mp.hidden ? null : Math.max(mp.sumM - mp.AM, 0), targetHidden: mp.hidden, amanahTarget: mp.hidden ? null : mp.AM, reconciled: !mp.hidden && !!mp.mm.reconciles } : null
  };
}
function flagsOf(o) { return { noMunicipalTarget: !!o.noMunicipalTarget, isHistorical: !!o.isHistorical, zeroTarget: !!o.zeroTarget, assumedDistribution: !!o.assumedDistribution, partialMonth: !!o.partialMonth, aboveTarget: !!o.aboveTarget, staleData: !!o.staleData, periodEnded: !!o.periodEnded, incompleteActual: !!o.incompleteActual, allocationIncomplete: !!o.allocationIncomplete }; }
