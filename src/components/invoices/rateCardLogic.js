// Pure logic of the «collection rate within scope» card (tested in tests/invoice-lists-ui.test.mjs). Collected ÷ Net invoiced × 100 over EVERY invoice of the scope;
// a scope with no net invoiced amount has NO rate (state 'na' — never shown as 0 %), while a real 0 % (net > 0, nothing collected) stays 0.0 %.
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export function rateParts(totals) {
  if (!totals) return { state: 'na', rate: null, collected: 0, net: 0, remaining: 0, gotPct: 0, invoices: 0 };
  const net = num(totals.net); const collected = num(totals.collected); const invoices = num(totals.count);
  if (!(net > 0)) return { state: 'na', rate: null, collected, net, remaining: 0, gotPct: 0, invoices };
  const rate = collected / net; // not capped here: the approved identity guarantees collected ≤ net; the BAR is clamped for drawing only
  const gotPct = Math.min(100, Math.max(0, rate * 100));
  return { state: 'ok', rate, collected, net, remaining: Math.max(0, net - collected), gotPct: Math.round(gotPct * 10) / 10, invoices };
}
export const ratePct = (rate) => (rate == null ? '—' : `${(Math.round(rate * 1000) / 10).toFixed(1)}%`);
