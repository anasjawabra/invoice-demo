// Row validation for the exclusion upload template (IIM-30). Each row is matched on الأمانة + رقم الفاتورة (invoice numbers repeat across Amanahs), then the amount, the date and
// the revenue account number are checked against the invoice. A FULL match is accepted; any mismatch, a missing invoice or a collected / cancelled invoice is rejected with its reason.
// Nothing is changed here: the check only reads the store.
import { derive, makeCtx, lookupId, lookupSadad, idOf } from './engine.js';
import { iimFields } from './iimRow.js';
import { isoOf } from '../src/data/catalog.js';
import { parseInvoiceKey, MAIN } from '../src/data/iim.js';
import { reasonRuleOf, entityIndexOf } from '../src/data/exclusionUpload.js';
import { isVisible } from './accessMask.js';

const AMOUNT_TOLERANCE = 1; // riyal

/** Which invoice an uploaded row means, among the invoices of ONE Amanah that carry its number: the row's GFS code (account) tells them apart; when it still leaves several — or no account was given and several remain —
 *  the row is rejected as ambiguous with every candidate's composite key. NEVER the first match. Pure (the data service passes the lookups), so it can be tested with isolated data. */
export function pickUploadInvoice(mine, acct, gfsOf, keyOf) {
  const byGfs = acct ? mine.filter((x) => gfsOf(x) === acct) : mine;
  if (byGfs.length > 1) return { code: 'invoice_ambiguous', candidates: byGfs.map(keyOf) };
  const index = byGfs.length === 1 ? byGfs[0] : mine.length === 1 ? mine[0] : -1;
  if (index < 0) return acct ? { code: 'account_mismatch' } : { code: 'invoice_ambiguous', candidates: mine.map(keyOf) };
  return { index };
}

export function checkExclusionRows(st, req) {
  const ctx = makeCtx(st, req); const out = []; const seen = new Set();
  for (const r of req.rows || []) {
    const res = { row: r.row, ok: false, code: null, invoiceId: null, ruleId: null, amount: null, outstanding: null };
    const fail = (code) => { res.code = code; out.push(res); };
    res.ruleId = reasonRuleOf(r.reason); if (!res.ruleId) { fail('reason_invalid'); continue; }
    const no = String(r.invoiceNo || '').trim(); if (!no) { fail('invoice_no_missing'); continue; }
    if (!String(r.amanah || '').trim()) { fail('amanah_missing'); continue; }
    const ent = entityIndexOf(r.amanah); if (ent < 0) { fail('amanah_unknown'); continue; }
    // the invoice: the full number (biller-Sadad) or the Sadad number alone — the Amanah decides which of the invoices that carry it
    let cands = [];
    if (parseInvoiceKey(no)) { const i = lookupId(st, no); if (i >= 0) cands = [i]; } else if (/^\d{6,14}$/.test(no)) cands = lookupSadad(st, no);
    const visible = cands.filter((i) => (st.owner[i] === 0 || st.owner[i] === (req.owner || 0)) && isVisible(st, i, ctx.acc)); // an invoice outside the user's geographic access answers exactly like a missing one
    if (!visible.length) { fail('invoice_not_found'); continue; }
    const mine = visible.filter((i) => st.ent[i] === ent); if (!mine.length) { fail('other_amanah'); continue; }
    // the Amanah is part of the invoice's identity; the GFS code of the row (account) is the next component: several invoices that share a number inside ONE Amanah are told apart by it — never "the first"
    const pick = pickUploadInvoice(mine, String(r.account || '').trim(), (x) => String(iimFields(st, x).gfsCode || ''), (x) => iimFields(st, x).compositeKey);
    if (pick.code) { if (pick.candidates) res.candidates = pick.candidates; fail(pick.code); continue; }
    const i = pick.index;
    res.invoiceId = idOf(st, i); res.compositeKey = iimFields(st, i).compositeKey;
    if (seen.has(res.invoiceId)) { fail('duplicate_in_file'); continue; } seen.add(res.invoiceId);
    const D = derive(ctx, i, ctx.cutoffN);
    res.amount = D.billed; res.outstanding = D.outstanding;
    if (D.cancelled) { fail('cancelled'); continue; }
    if (D.billed > 0 && D.received >= D.billed) { fail('already_collected'); continue; }
    if (!Number.isFinite(r.amount) || Math.abs(r.amount - D.gross) > AMOUNT_TOLERANCE) { fail('amount_mismatch'); continue; }
    if (!r.date || r.date !== isoOf(st.issue[i])) { fail('date_mismatch'); continue; }
    const im = iimFields(st, i); if (String(r.account || '').trim() !== String(im.gfsCode || '')) { fail('account_mismatch'); continue; }
    if (res.ruleId === 'ENC-1' && im.mainClass !== MAIN.investment) { fail('not_investment'); continue; } // R8 is about sites exploited without a contract: investment invoices only
    res.ok = true; res.code = null; out.push(res);
  }
  return { rows: out, accepted: out.filter((x) => x.ok).length, rejected: out.filter((x) => !x.ok).length };
}
