// Small PURE text helpers of the plan page (percentages, signed amounts). No React.
export const MINUS = '−';
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
/** a fraction as a percentage: 0.402 → «40.2%»; null / NaN → «—» (never 0 for a missing figure) */
export const pct = (v, d = 1) => (fin(v) ? `${(v * 100).toFixed(d)}%` : '—');
/** «+3.2%» / «−52.7%» */
export const signedPct = (v, d = 1) => (fin(v) ? `${v > 0 ? '+' : v < 0 ? MINUS : ''}${Math.abs(v * 100).toFixed(d)}%` : '—');
/** «−10.25 مليار ريال» — the sign is written as text, the amount by the page's money formatter */
export const signedMoney = (v, money) => (fin(v) ? `${v > 0.5 ? '+' : v < -0.5 ? MINUS : ''}${money(Math.abs(v))}` : '—');
