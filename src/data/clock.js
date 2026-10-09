// ============================================================================
// Demo clock. "Today" is the real calendar date in Asia/Riyadh each time the
// system loads — the demo is NOT pinned to a fixed date.
//
// Overrides exist only so tests and reviewers can time-travel deterministically:
//   * globalThis.__DEMO_TODAY__ = 'YYYY-MM-DD'   (tests)
//   * ?demoToday=YYYY-MM-DD in the URL           (remembered for the session)
// ============================================================================
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function riyadhToday(now = new Date()) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function override() {
  try {
    if (typeof globalThis !== 'undefined' && ISO.test(globalThis.__DEMO_TODAY__ || '')) return globalThis.__DEMO_TODAY__;
    if (typeof window !== 'undefined' && window.location) {
      const q = new URLSearchParams(window.location.search).get('demoToday');
      if (q && ISO.test(q)) { window.sessionStorage.setItem('ib_demo_today', q); return q; }
      if (q === 'reset') window.sessionStorage.removeItem('ib_demo_today');
      const s = window.sessionStorage.getItem('ib_demo_today');
      if (s && ISO.test(s) && q !== 'reset') return s;
    }
  } catch { /* storage may be blocked */ }
  return null;
}

export const DEMO_TODAY = override() || riyadhToday();
export const IS_TIME_TRAVEL = DEMO_TODAY !== riyadhToday();

export const addDaysIso = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const startOfYear = (d) => `${d.slice(0, 4)}-01-01`;
export const startOfMonth = (d) => `${d.slice(0, 7)}-01`;
export const endOfMonth = (d) => { const y = Number(d.slice(0, 4)); const m = Number(d.slice(5, 7)); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
export const prevMonthEnd = (d) => addDaysIso(startOfMonth(d), -1);
export const shiftYearIso = (d, n) => {
  const y = Number(d.slice(0, 4)) + n;
  const md = d.slice(5);
  if (md === '02-29') return `${y}-02-${new Date(Date.UTC(y, 2, 0)).getUTCDate()}`;
  return `${y}-${md}`;
};
