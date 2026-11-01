// ONE definition of lateness for the whole demo (engine · contracts · invoice page · lists · exports). Two different questions, never mixed:
//
//  1. OVERDUE UNPAID AMOUNT — «how many days is the money still owed past its due date?»
//     overdueDays = max(0, reference date − (due date + grace days)), reported ONLY while the invoice still has an amount outstanding
//     and is neither excluded nor cancelled. A paid, excluded or cancelled invoice has no overdue days (null on the contract card, 0 in lists).
//     The grace period is the one global parameter (cfg.graceDays, default 0).
//
//  2. PAYMENT LATENESS — «was this payment made on time?»
//     offset  = payment date − due date (negative = before the due date, positive = after it) — the plain fact;
//     lateBy  = max(0, payment date − (due date + grace days)) — days beyond the grace period (0 = on time).
//     It describes a payment that was made; it says nothing about what is still owed.
//
// All dates are day numbers (or ISO dates converted by the caller); no I/O.
export const overdueDays = (refN, dueN, grace = 0) => Math.max(0, refN - (dueN + (grace || 0)));
export const paymentLateness = (payN, dueN, grace = 0) => ({ offset: payN - dueN, lateBy: Math.max(0, payN - (dueN + (grace || 0))) });
// the overdue days an open invoice shows: null when nothing is owed, or the amount is excluded / cancelled
export const openOverdueDays = (D) => (D.outstanding > 0 && !D.excluded && !D.cancelled ? D.daysOverdue : null);
