// Summary of an enforcement order's link state, shared by the order list, the Noncollection page, the insights and the analysis tasks.
// The matching itself (reference extraction, resolution, reconciliation, the link lifecycle) lives in orderMatching.js.
//
// (The earlier amount-and-Amanah «candidate finder» was removed: an amount alone never proposes an invoice. Candidates now come only from
//  references — Sanad's structured data and the order document — resolved against the invoices.)
import { orderMatchState } from './orderMatching';

// states: linked (every reference accounted for AND the amounts reconcile) · partial (something is confirmed but the order is NOT fully matched)
//         · candidate (proposals only, nothing confirmed) · ambiguous · unresolved (nothing yet)
export function caseSummary(c) {
  const m = orderMatchState(c); const r = m.reconciliation;
  const state = m.state === 'matched' ? 'linked' : m.state === 'partial' ? 'partial' : m.state === 'awaiting_review' ? 'candidate' : 'unresolved';
  const matchedAmount = r.confirmedTotal;
  return {
    state, confirmed: r.confirmedCount, candidates: r.proposedCount, reasons: m.reasons, unresolvedRefs: m.unresolved.length, documentGaps: m.gaps.length,
    matchedAmount, difference: r.difference, reconciliation: r,
    allocated: matchedAmount ?? 0, unallocated: matchedAmount == null ? c.amount : Math.max(0, c.amount - matchedAmount) // kept for older callers: «matched» and «not covered by a confirmed invoice»
  };
}
