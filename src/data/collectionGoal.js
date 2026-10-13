// THE ANNUAL COLLECTION GOAL — the only calculation behind the Strategic Dashboard («التخطيط المالي والاستراتيجي»). Pure functions, no I/O.
//
// The goal is the REVENUE APPROPRIATION «الاعتماد مقابل الإيراد» of chapters 1–3 after adjustment: the amount the entity is expected to collect during the fiscal year
// (src/data/appropriations.js). For ONE fiscal year, ONE entity (or the whole Ministry):
//   Collected                    = payments received from 1 January to the reporting date (payment-date basis, any invoice; Tahseel)
//   Share of the appropriation   = Collected ÷ Revenue appropriation
//   Remaining to the appropriation = max(Revenue appropriation − Collected, 0)
// A selection without a valid positive appropriation has NO target: nothing is rated, nothing is "achieved".
//
// Planning assumptions (no approved monthly plan exists, so each is stated on screen):
//   * the annual target is spread EVENLY over the twelve months (cumulative = target × month ÷ 12);
//   * the current, partly elapsed month is prorated by days when progress is compared with the plan and when the pace still needed is calculated;
//   * a plan that has been SAVED is a DRAFT, not an approved plan, and is never recalculated silently: its closed months keep their figures when the appropriation changes; it is updated only by an explicit action.

const pad = (n) => String(n).padStart(2, '0');
export const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate(); // month 1–12
export const MONTHS = 12;

// the date progress is measured at: today for the current year, 31 December for a past year, none for a future year
export function reportingDateFor(year, today) {
  const y = Number(String(today).slice(0, 4));
  if (!Number.isFinite(year) || year > y) return null;
  return year === y ? today : `${year}-12-31`;
}

// cumulative plan for a target spread evenly over twelve months: index 0 = end of January … index 11 = end of December
export const evenPlan = (target) => Array.from({ length: MONTHS }, (_, i) => target * ((i + 1) / MONTHS));

// the plan figure at the reporting date: the closed months in full, the current month in proportion to the days elapsed
export function plannedToDate(cumulative, reportingDate) {
  const m = Number(reportingDate.slice(5, 7)); const d = Number(reportingDate.slice(8, 10)); const y = Number(reportingDate.slice(0, 4));
  const prev = m > 1 ? cumulative[m - 2] : 0; const cur = cumulative[m - 1];
  return prev + (cur - prev) * (d / daysInMonth(y, m));
}

// whole months still ahead after the reporting month, plus the part of the reporting month still to come (by days); 0 once the year has ended
export function monthsLeft(reportingDate) {
  const y = Number(reportingDate.slice(0, 4)); const m = Number(reportingDate.slice(5, 7)); const d = Number(reportingDate.slice(8, 10));
  const dim = daysInMonth(y, m);
  return (dim - d) / dim + (MONTHS - m);
}

/**
 * @param {object} i
 * @param {number} i.year
 * @param {string} i.today                   reference date (ISO) — the latest date with data
 * @param {number} i.target                  the revenue appropriation after adjustment (riyals); missing / zero / negative = no valid target
 * @param {number[]} i.monthlyCollected      payments received by payment month, January… up to the reporting month (Tahseel)
 * @param {object|null} i.plan               a saved DRAFT plan { annualTarget, months:[12 cumulative] } or null
 *
 * States: future_year · no_target (no valid positive appropriation: no rate, no remainder, nothing is "achieved") · ok.
 */
export function computeGoal({ year, today, target: targetIn, monthlyCollected = [], plan = null }) {
  const reportingDate = reportingDateFor(year, today);
  if (!reportingDate) return { state: 'future_year', year };
  const m = Number(reportingDate.slice(5, 7));
  const monthly = Array.from({ length: m }, (_, k) => Number(monthlyCollected[k]) || 0);
  let run = 0; const actual = Array.from({ length: MONTHS }, (_, k) => (k < m ? (run += monthly[k]) : null)); // future months are NOT zero: they have no value
  const collected = run;
  const base = { year, reportingDate, reportingMonth: m, yearEnded: reportingDate.slice(5) === '12-31', collected, actual };
  const target = Number(targetIn);
  if (!(Number.isFinite(target) && target > 0)) return { ...base, state: 'no_target' };
  const remaining = Math.max(target - collected, 0);

  const saved = plan && Array.isArray(plan.months) && plan.months.length === MONTHS ? plan : null;
  const cumulative = saved ? saved.months : evenPlan(target);
  const planned = plannedToDate(cumulative, reportingDate);
  const left = monthsLeft(reportingDate);
  const drift = saved && Math.abs(saved.annualTarget - target) > 0.5 ? { saved: saved.annualTarget, live: target } : null;

  return {
    ...base, state: 'ok', target, collectionRate: collected / target, remaining,
    achieved: collected >= target, exceededBy: collected > target ? collected - target : 0,
    plan: { source: saved ? 'saved' : 'assumed', cumulative, annualTarget: saved ? saved.annualTarget : target, savedAt: saved?.savedAt || null, drift },
    plannedToDate: planned, versusPlan: collected - planned, actual,
    pace: { monthsLeft: left, requiredPerMonth: left > 0 && remaining > 0 ? remaining / left : 0, plannedPerMonth: left > 0 ? Math.max(cumulative[MONTHS - 1] - planned, 0) / left : 0 }
  };
}

/* ------------------------------------------------------------------ the saved plan (written only after a person asks) */
export const GOAL_KEY = 'ib_collection_goal_v1';
export const planKey = (year, amanah) => `${year}|${amanah || 'all'}`;
export const emptyGoalStore = () => ({ v: 1, plans: {} });
export function loadGoalStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { const v = JSON.parse(storage?.getItem(GOAL_KEY) || 'null'); return v && v.v === 1 && v.plans && typeof v.plans === 'object' ? v : emptyGoalStore(); } catch { return emptyGoalStore(); }
}
export function saveGoalStore(store, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) { try { storage?.setItem(GOAL_KEY, JSON.stringify(store)); return true; } catch { return false; } }

// a new DRAFT plan (saving is not approval): the annual target spread evenly, all twelve months fixed from now on
export function savePlan(store, { year, amanah, annualTarget, at, by }) {
  return { ...store, plans: { ...store.plans, [planKey(year, amanah)]: { year, amanah: amanah || 'all', annualTarget, basis: 'revenue_appropriation', months: evenPlan(annualTarget), savedAt: at, savedBy: by, updatedAt: null } } };
}
// an explicit update to today's figures: months that have CLOSED keep what they were; the new target is spread evenly over the current and later months
export function rebasePlan(store, { year, amanah, annualTarget, today, at, by }) {
  const key = planKey(year, amanah); const old = store.plans[key]; if (!old) return savePlan(store, { year, amanah, annualTarget, at, by });
  const reporting = reportingDateFor(year, today); if (!reporting || reporting.slice(5) === '12-31' && year < Number(today.slice(0, 4))) return store; // a closed year is never rebased
  const m = Number(reporting.slice(5, 7)); const closed = m - 1; const start = closed > 0 ? old.months[closed - 1] : 0;
  const left = MONTHS - closed; const rest = Math.max(annualTarget - start, 0);
  const months = old.months.map((v, k) => (k < closed ? v : start + rest * ((k - closed + 1) / left)));
  return { ...store, plans: { ...store.plans, [key]: { ...old, annualTarget, months, updatedAt: at, updatedBy: by } } };
}
