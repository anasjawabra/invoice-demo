// The payment story of ONE invoice, from its payments up to the reference date — pure, no I/O.
//   settled   = the date on which the payments first covered the invoice value (only when they did)
//   offset    = days from the due date (negative = before the due date, positive = after it)
//   the state follows the invoice's own payment status (collected · partial · overdue / not due → unpaid · cancelled); an exclusion is not a payment state — for an excluded invoice the caller passes the invoice amount as `net`, so the story is told against what was billed
import { daysBetween } from './revenueLedger';
import { overdueDays, paymentLateness } from './lateness';

// overdueDays: the engine's value for the invoice (grace included) — the panel never recomputes it; graceDays is only used for the per-payment lateness
export function paymentFacts({ payments = [], dueDate, issueDate, net = 0, payStatus, today, overdueDays: engineOverdue = null, graceDays = 0 }) {
  const list = [...payments].filter((p) => p && p.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let cum = 0; let settled = null;
  const rows = list.map((p) => {
    cum += Number(p.amount) || 0;
    const covered = net > 0 && cum >= net - 0.5;
    if (covered && !settled) settled = p.date;
    return { date: p.date, channel: p.channel, amount: Number(p.amount) || 0, cumulative: cum, balance: Math.max(net - cum, 0), offset: dueDate ? daysBetween(dueDate, p.date) : null, lateBy: dueDate ? paymentLateness(daysBetween(dueDate, p.date), 0, graceDays).lateBy : null };
  });
  const paid = cum;
  const state = payStatus === 'cancelled' ? 'cancelled' : net > 0 && paid >= net - 0.5 ? 'settled' : paid > 0 ? 'partial' : 'unpaid';
  const open = state === 'partial' || state === 'unpaid';
  const daysOverdue = !open ? 0 : engineOverdue != null ? engineOverdue : dueDate && today ? overdueDays(daysBetween(dueDate, today), 0, graceDays) : 0; // one rule: src/data/lateness.js
  const daysToDue = dueDate && today && (state === 'partial' || state === 'unpaid') ? Math.max(daysBetween(today, dueDate), 0) : 0;
  return {
    state, rows, count: rows.length, paid, remaining: Math.max(net - paid, 0), over: Math.max(paid - net, 0),
    first: rows[0]?.date || null, last: rows[rows.length - 1]?.date || null, settled,
    settledOffset: settled && dueDate ? daysBetween(dueDate, settled) : null,
    daysFromIssue: settled && issueDate ? daysBetween(issueDate, settled) : null,
    daysOverdue, daysToDue
  };
}
