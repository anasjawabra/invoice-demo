// PLAN MATH — the shared pure primitives of revenue plans (dates, month rows, integer apportionment, planned-to-date). No I/O, no React; used by the server, the client and the tests.
// Money: whole riyals (integers). Every split of an amount uses LARGEST-REMAINDER apportionment, so the parts always add up to the whole to the riyal and the rounding remainder is returned, never hidden.
// Dates: 'YYYY-MM-DD' strings in UTC arithmetic. Months: 'YYYY-MM'.
export const pad2 = (n) => String(n).padStart(2, '0');
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isISODate = (s) => typeof s === 'string' && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const T = (s) => Date.parse(`${s}T00:00:00Z`);
export const addDays = (s, n) => new Date(T(s) + n * 86400000).toISOString().slice(0, 10);
/** inclusive number of days from a to b (a ≤ b → ≥ 1; b < a → 0) */
export const daysInclusive = (a, b) => (T(b) < T(a) ? 0 : Math.round((T(b) - T(a)) / 86400000) + 1);
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const ymOf = (s) => s.slice(0, 7);
export const monthStart = (ym) => `${ym}-01`;
export const monthEnd = (ym) => `${ym}-${pad2(daysInMonth(Number(ym.slice(0, 4)), Number(ym.slice(5, 7))))}`;
const nextYm = (ym) => { const y = Number(ym.slice(0, 4)); const m = Number(ym.slice(5, 7)); return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`; };

/** the January–December preset of a calendar year (an ASSUMPTION pending business confirmation — callers label it) */
export const fiscalYearPeriod = (year) => ({ start: `${year}-01-01`, end: `${year}-12-31`, preset: 'fiscal-year' });
export const periodValid = (p) => !!p && isISODate(p.start) && isISODate(p.end) && T(p.end) >= T(p.start);
export const periodDays = (p) => (periodValid(p) ? daysInclusive(p.start, p.end) : 0);
/** is this a whole calendar year Jan 1 – Dec 31? */
export const isCalendarYear = (p) => periodValid(p) && p.start.slice(5) === '01-01' && p.end.slice(5) === '12-31' && p.start.slice(0, 4) === p.end.slice(0, 4);
/** the identical-period test used by the duplicate-baseline rule */
export const samePeriod = (a, b) => !!a && !!b && a.start === b.start && a.end === b.end;
export const periodsOverlap = (a, b) => periodValid(a) && periodValid(b) && T(a.start) <= T(b.end) && T(b.start) <= T(a.end);

/** one row per calendar month the period touches: { ym, start, end (clipped to the period), days (in the period), monthDays, fraction = days ÷ monthDays (1 for a whole month) } */
export function monthRows(period) {
  if (!periodValid(period)) return [];
  const rows = []; let ym = ymOf(period.start); const last = ymOf(period.end);
  for (;;) {
    const s = monthStart(ym) < period.start ? period.start : monthStart(ym); const e = monthEnd(ym) > period.end ? period.end : monthEnd(ym);
    const monthDays = daysInMonth(Number(ym.slice(0, 4)), Number(ym.slice(5, 7))); const days = daysInclusive(s, e);
    rows.push({ ym, start: s, end: e, days, monthDays, fraction: days / monthDays, partial: days < monthDays });
    if (ym === last) break; ym = nextYm(ym);
  }
  return rows;
}

/**
 * LARGEST-REMAINDER apportionment of a whole-riyal `total` over non-negative `weights` (Σ > 0): floor shares, then the leftover riyals go to the largest fractional parts (ties → lower index).
 * @returns { amounts: int[], remainder: { units, rows: int[] } }  — `remainder` = how many riyals the flooring left and which rows received one (the "rounding remainder" the UI shows)
 */
export function apportion(total, weights) {
  const n = weights.length; const tot = Math.round(Number(total) || 0);
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0)); const sum = w.reduce((a, b) => a + b, 0);
  if (!n || !(sum > 0) || !(tot >= 0)) return { amounts: new Array(n).fill(0), remainder: { units: 0, rows: [] }, ok: false };
  const exact = w.map((x) => (tot * x) / sum); const base = exact.map(Math.floor);
  let left = tot - base.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f || a.i - b.i);
  const rows = []; for (let k = 0; k < order.length && left > 0; k += 1) { if (order[k].f <= 1e-12 && left === 0) break; base[order[k].i] += 1; rows.push(order[k].i); left -= 1; }
  return { amounts: base, remainder: { units: rows.length, rows: rows.sort((a, b) => a - b) }, ok: true };
}

export const BP_TOTAL = 10000; // manual month weights are whole basis points (0.01 %): they must add up to exactly 10 000
/**
 * the numeric weight of each month row for a distribution { profile: 'equal' | 'manual', weights?: { [ym]: basisPoints } }:
 *   equal  → 1 per whole month, the day-fraction for a partial first/last month (a 12-month calendar year is exactly 1/12 each)
 *   manual → the stored basis points (a missing month = 0)
 */
export function distributionWeights(distribution, rows) {
  if (distribution?.profile === 'manual') return rows.map((r) => Math.max(0, Number(distribution.weights?.[r.ym]) || 0));
  return rows.map((r) => r.fraction);
}
/** manual weights: total basis points, the % remaining (can be negative = excess) and whether it is exactly complete */
export function weightsTotal(distribution, rows) {
  const total = rows.reduce((a, r) => a + (Math.max(0, Number(distribution?.weights?.[r.ym]) || 0)), 0);
  return { total, remaining: BP_TOTAL - total, complete: total === BP_TOTAL };
}
/** whole-riyal amount of each month row for ONE amount under a distribution */
export function monthAmounts(amount, distribution, rows) { return apportion(amount, distributionWeights(distribution, rows)); }

/**
 * Entity month amounts of a plan content: each allocation is apportioned over the months with its own override distribution when it has one, else the plan's.
 * @param content { target:{amount}, allocations:[{entityKey, amount}], distribution, entityDistributions?: { [entityKey]: distribution } }
 * @returns { rows, entities: { [entityKey]: int[] }, plan: int[], allocated, complete }
 * `plan` = Σ entity months (so entity and plan reconcile by construction); with NO allocations it is the plan target apportioned directly (a draft).
 */
export function planMonthly(content, period) {
  const rows = monthRows(period); const alloc = content?.allocations || []; const entities = {};
  for (const a of alloc) entities[a.entityKey] = monthAmounts(a.amount || 0, content.entityDistributions?.[a.entityKey] || content.distribution, rows).amounts;
  const allocated = alloc.reduce((t, a) => t + (Math.round(a.amount) || 0), 0);
  const plan = alloc.length ? rows.map((_, i) => alloc.reduce((t, a) => t + entities[a.entityKey][i], 0)) : monthAmounts(content?.target?.amount || 0, content?.distribution, rows).amounts;
  return { rows, entities, plan, allocated, complete: alloc.length > 0 && allocated === Math.round(content?.target?.amount || 0) };
}

/**
 * MUNICIPAL month amounts (additive). A municipality's allocation is a slice of its Amanah's allocation and inherits the Amanah's monthly distribution (the entity's override if any, else the plan's).
 * Rows come from `content.municipalAllocations` ([{ entityKey, muniId, amount }]); rows of one municipality are summed; the order is by muniId (reference order) so the result never depends on the order the user typed them.
 * Exact reconciliation: the Amanah's month amounts A are fixed (planMath.monthAmounts); each municipality's amount is apportioned over the REMAINING capacity of each month (largest remainder), in muniId order, and what is left is
 * «غير موزع على البلديات». So Σ municipalities + unallocated = the Amanah's month amounts to the riyal, never negative, and unallocated is exactly 0 when the municipalities add up to the Amanah.
 * A municipality's months are within one riyal of apportion(its amount, the distribution); its own total is exact. If Σ municipal > the Amanah's amount (an excess; a draft may hold it) the months cannot fit: each municipality is then
 * apportioned on its own over the distribution, unallocated is all zeros and `reconciles` is false. A masked viewer's content has no Amanah row, so the same fallback applies (their figures may differ by ≤ 1 riyal in a month from the full view; totals are identical).
 * @returns { rows, entityKey, amanah: int[], municipalities: { [muniId]: int[] }, unallocated: int[], amanahAmount, allocated, unallocatedAmount, excess, reconciles }
 */
export function municipalMonthlyBreakdown(content, period, entityKey) {
  const rows = monthRows(period); const c = content || {};
  const dist = c.entityDistributions?.[entityKey] || c.distribution;
  const amanahAmount = Math.round(Number((c.allocations || []).find((a) => a.entityKey === entityKey)?.amount) || 0);
  const by = new Map();
  for (const m of c.municipalAllocations || []) if (m && m.entityKey === entityKey && typeof m.muniId === 'string') by.set(m.muniId, (by.get(m.muniId) || 0) + (Math.round(Number(m.amount)) || 0));
  const ids = [...by.keys()].sort();
  const allocated = ids.reduce((t, id) => t + by.get(id), 0); const excess = Math.max(0, allocated - amanahAmount);
  const amanah = monthAmounts(amanahAmount, dist, rows).amounts;
  const municipalities = {}; let unallocated;
  if (!excess) {
    let cap = amanah.slice();
    for (const id of ids) { const x = by.get(id) > 0 ? apportion(by.get(id), cap).amounts : cap.map(() => 0); municipalities[id] = x; cap = cap.map((v, i) => v - x[i]); }
    unallocated = cap;
  } else {
    for (const id of ids) municipalities[id] = monthAmounts(by.get(id), dist, rows).amounts;
    unallocated = rows.map(() => 0);
  }
  const reconciles = !excess && rows.every((_, i) => ids.reduce((t, id) => t + municipalities[id][i], 0) + unallocated[i] === amanah[i]);
  return { rows, entityKey, amanah, municipalities, unallocated, amanahAmount, allocated, unallocatedAmount: Math.max(0, amanahAmount - allocated), excess, reconciles };
}
/**
 * One municipality's month amounts: { rows, entityKey, muniId, state: 'ok' | 'no_municipal_target', amount: int|null, amounts: int[]|null }.
 * A municipality with NO allocation row gets amount/amounts = null (never zeros, never a share of the Amanah): «لم يُحدد مستهدف لهذه البلدية».
 */
export function municipalMonthly(content, period, entityKey, muniId) {
  const b = municipalMonthlyBreakdown(content, period, entityKey); const m = b.municipalities[muniId];
  if (!m) return { rows: b.rows, entityKey, muniId, state: 'no_municipal_target', amount: null, amounts: null };
  return { rows: b.rows, entityKey, muniId, state: 'ok', amount: m.reduce((t, x) => t + x, 0), amounts: m };
}

/** planned collections to a cut-off from month amounts: closed months in full, the month holding the cut-off in proportion to the period days elapsed in it, later months 0; before the start → 0; after the end → everything */
export function plannedTo(amounts, rows, cutoff) {
  if (!rows.length || !isISODate(cutoff)) return null;
  if (cutoff < rows[0].start) return 0;
  let sum = 0;
  rows.forEach((r, i) => { if (cutoff >= r.end) sum += amounts[i]; else if (cutoff >= r.start) sum += amounts[i] * (daysInclusive(r.start, cutoff) / r.days); });
  return sum;
}
