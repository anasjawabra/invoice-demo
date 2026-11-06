// «إجمالي المحصل من أوامر التنفيذ» — the amount COLLECTED through enforcement, read only from payment (collection) records of the invoices that have a CONFIRMED enforcement-order link.
//   * a payment counts only when the payment record itself says it came through enforcement (channel = 'enforcement'): attribution comes from the payment's evidence, never from the order's
//     closure, the invoice's exclusion or the order amount. A payment on a linked invoice with another channel is not counted (and listed apart); one with no channel cannot be attributed.
//   * partial payments are supported (each payment is its own record); each payment is counted ONCE (keyed by its record id) however many orders link the invoice.
//   * the period filter is the PAYMENT date; the Amanah / organisation scope filters the invoice.
//   * «غير متوفر من المصدر»: when the linked invoices carry payments but none of them has attribution evidence, no amount is produced — neither an assumed amount nor zero.
// Payment records are the demo ledger's (synthetic) plus a small, clearly labelled SYNTHETIC set of Tahseel payments added only for this card (see syntheticTahseelPayments): they are NOT part of the ledger,
// so no dashboard, invoice page or exclusion amount reads them (a known limitation, stated on the card).
import { CHANNELS, ENTITIES, isoOf } from '../src/data/catalog.js';
import { makeCtx, resolveScope, inScope, lookupId, idOf } from './engine.js';

// fixed demo records for the invoices of the synthetic Sanad scenario documents + deterministic ones on the first invoices named by the demo Sanad feed
const SCENARIO_FIXED = [
  ['171-407930123150', [['2026-09-14', 3000000], ['2026-10-02', 2500000]]], // partial, two payments
  ['171-407950123141', [['2026-09-20', 9524400]]], // paid in full
  ['171-408030123105', [['2026-10-05', 12000000]]],
  ['171-407850123186', [['2026-09-28', 20000000], ['2026-10-10', 15000000]]],
  ['171-407890123168', [['2026-10-08', 4000000]]] // already partly paid in the ledger: this is an additional enforcement-channel receipt
];
export function syntheticTahseelPayments(st, cutoffN) {
  const out = []; let n = 0; const add = (invoiceId, date, amount, tag) => { n += 1; out.push({ id: `SYN-TAH-${String(n).padStart(4, '0')}`, invoiceId, date, amount, channel: 'enforcement', source: 'synthetic', tag }); };
  for (const [id, pays] of SCENARIO_FIXED) if (lookupId(st, id) >= 0) for (const [d, a] of pays) add(id, d, a, 'scenario');
  const seen = new Set(); let k = 0;
  for (const q of st.requests) { for (const i of q.identified.slice(0, 1)) { const id = idOf(st, i); if (seen.has(id) || k >= 4) continue; seen.add(id); k += 1; const g = Math.round(st.gross[i]); add(id, isoOf(Math.min(q.openedDay + 20 + k * 3, cutoffN)), Math.max(1000, Math.round(g * 0.3)), 'feed'); add(id, isoOf(Math.min(q.openedDay + 45 + k * 3, cutoffN)), Math.max(1000, Math.round(g * 0.2)), 'feed'); } }
  return out;
}

/** req: { ids: [invoice ids with a confirmed link], scope (amanah / org), cfg, from?, to? (payment date), synthetic?: true (default) } */
export function enforcementCollections(st, req) {
  const ctx = makeCtx(st, req); const rs = resolveScope(ctx, { ...(req.scope || {}), from: '2000-01-01', to: ctx.cfg.cutoff });
  const ids = [...new Set((req.ids || []).map(String))]; const from = req.from || '0000-01-01'; const to = req.to || '9999-12-31'; const cutoff = ctx.cfg.cutoff;
  const idx = new Map(); for (const id of ids) { const i = lookupId(st, id); if (i >= 0 && inScope(st, rs, i)) idx.set(id, i); }
  const synth = req.synthetic === false ? [] : syntheticTahseelPayments(st, ctx.cutoffN).filter((p) => idx.has(p.invoiceId));
  const seen = new Set(); const rows = []; const apart = []; let unattributed = 0; let anyEvidence = false; let anyPayment = false;
  const take = (p) => {
    if (seen.has(p.id)) return; seen.add(p.id); if (p.date > cutoff || p.date < from || p.date > to) return; anyPayment = true;
    const row = { paymentId: p.id, invoiceId: p.invoiceId, index: idx.get(p.invoiceId), date: p.date, amount: p.amount, channel: p.channel, source: p.source };
    const i = row.index; row.amanahEn = ENTITIES[st.ent[i]].en; row.amanahAr = ENTITIES[st.ent[i]].ar;
    if (!p.channel) { unattributed += 1; apart.push({ ...row, why: 'no_channel_evidence' }); return; }
    anyEvidence = true;
    if (p.channel === 'enforcement') rows.push(row); else apart.push({ ...row, why: 'other_channel' });
  };
  for (const [id, i] of idx) { let k = 0; for (let q = st.payStart[i]; q < st.payStart[i] + st.payCount[i]; q += 1) { k += 1; take({ id: `TAH-${i}-${q}`, invoiceId: id, date: isoOf(st.pDay[q]), amount: st.pAmt[q], channel: CHANNELS[st.pCh[q]] || null, source: 'ledger' }); } }
  for (const p of synth) take(p);
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.invoiceId.localeCompare(b.invoiceId));
  const total = rows.reduce((t, r) => t + r.amount, 0); const unavailable = anyPayment && !anyEvidence;
  return { available: !unavailable, reason: unavailable ? 'no_attribution_evidence' : null, total: unavailable ? null : total, count: rows.length, invoices: new Set(rows.map((r) => r.invoiceId)).size, rows: rows.map(({ index, ...r }) => r),
    notCounted: { count: apart.length, amount: apart.reduce((t, r) => t + r.amount, 0), items: apart.map(({ index, ...r }) => r) }, linkedInvoices: idx.size, from: req.from || null, to: req.to || null, cutoff,
    evidence: { field: 'channel', value: 'enforcement', synthetic: synth.length }, definition: 'payments with channel «enforcement» on invoices with a confirmed order link; period = payment date; each payment once' };
}
