// THE ANNUAL COLLECTION GOAL — the only calculation behind the Strategic Dashboard («التخطيط المالي والاستراتيجي»). Pure functions, no I/O.
//
// Approved calculations (all for ONE reporting period, ONE invoice scope and ONE Amanah selection):
//   Adjusted Total Invoices      = Gross Billed Amount − Approved Exclusions
//   Collection Rate              = Collected Revenue ÷ Adjusted Total Invoices
//   Target Collection Amount     = Target Collection Rate × Adjusted Total Invoices
//   Remaining Amount to Target   = max(Target Collection Amount − Collected Revenue, 0)
// Collected Revenue comes from Tahseel payments, counted up to the REPORTING DATE only.
//
// Planning assumptions (no approved monthly plan exists, so each is stated on screen):
//   * the annual target is spread EVENLY over the twelve months (cumulative = target × month ÷ 12);
//   * the current, partly elapsed month is prorated by days when progress is compared with the plan and when the pace still needed is calculated;
//   * a plan that has been SAVED is never recalculated silently: its closed months keep their figures when billed amounts or exclusions change; it is updated only by an explicit action.

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
 * @param {number} i.rate                    target collection rate, 0–1
 * @param {number} i.gross                   gross billed amount of the invoices issued in the year (up to the reporting date)
 * @param {number} i.approvedExclusions      approved exclusions of those invoices (cancelled invoices included — see docs)
 * @param {number[]} i.monthlyCollected      collected revenue by payment month, January… up to the reporting month (Tahseel)
 * @param {object|null} i.plan               a saved plan { annualTarget, months:[12 cumulative] } or null
 */
export function computeGoal({ year, today, rate, gross, approvedExclusions, monthlyCollected = [], plan = null }) {
  const reportingDate = reportingDateFor(year, today);
  if (!reportingDate) return { state: 'future_year', year };
  const adjustedTotal = (Number(gross) || 0) - (Number(approvedExclusions) || 0);
  const m = Number(reportingDate.slice(5, 7));
  const base = { year, reportingDate, reportingMonth: m, yearEnded: reportingDate.slice(5) === '12-31', adjustedTotal, gross: Number(gross) || 0, approvedExclusions: Number(approvedExclusions) || 0 };
  if (!(adjustedTotal > 0) || !Number.isFinite(adjustedTotal)) return { ...base, state: 'no_denominator' };

  const r = Math.min(Math.max(Number(rate) || 0, 0), 1);
  const target = r * adjustedTotal;
  const monthly = Array.from({ length: m }, (_, k) => Number(monthlyCollected[k]) || 0);
  let run = 0; const actual = Array.from({ length: MONTHS }, (_, k) => (k < m ? (run += monthly[k]) : null)); // future months are NOT zero: they have no value
  const collected = run;
  const remaining = Math.max(target - collected, 0);

  const saved = plan && Array.isArray(plan.months) && plan.months.length === MONTHS ? plan : null;
  const cumulative = saved ? saved.months : evenPlan(target);
  const planned = plannedToDate(cumulative, reportingDate);
  const left = monthsLeft(reportingDate);
  const drift = saved && Math.abs(saved.annualTarget - target) > 0.5 ? { saved: saved.annualTarget, live: target } : null;

  return {
    ...base, state: 'ok', rate: r, target, collected, collectionRate: collected / adjustedTotal, remaining,
    achieved: target > 0 && collected >= target, exceededBy: collected > target ? collected - target : 0,
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

// a new plan: the annual target spread evenly, all twelve months fixed from now on
export function savePlan(store, { year, amanah, rate, annualTarget, adjustedTotal, at, by }) {
  return { ...store, plans: { ...store.plans, [planKey(year, amanah)]: { year, amanah: amanah || 'all', rate, annualTarget, adjustedTotal, months: evenPlan(annualTarget), savedAt: at, savedBy: by, updatedAt: null } } };
}
// an explicit update to today's figures: months that have CLOSED keep what they were; the new target is spread evenly over the current and later months
export function rebasePlan(store, { year, amanah, rate, annualTarget, adjustedTotal, today, at, by }) {
  const key = planKey(year, amanah); const old = store.plans[key]; if (!old) return savePlan(store, { year, amanah, rate, annualTarget, adjustedTotal, at, by });
  const reporting = reportingDateFor(year, today); if (!reporting || reporting.slice(5) === '12-31' && year < Number(today.slice(0, 4))) return store; // a closed year is never rebased
  const m = Number(reporting.slice(5, 7)); const closed = m - 1; const start = closed > 0 ? old.months[closed - 1] : 0;
  const left = MONTHS - closed; const rest = Math.max(annualTarget - start, 0);
  const months = old.months.map((v, k) => (k < closed ? v : start + rest * ((k - closed + 1) / left)));
  return { ...store, plans: { ...store.plans, [key]: { ...old, rate, annualTarget, adjustedTotal, months, updatedAt: at, updatedBy: by } } };
}
