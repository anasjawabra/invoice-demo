// Row validation for the exclusion upload template (IIM-30). Each row is matched on الأمانة + رقم الفاتورة (invoice numbers repeat across Amanahs), then the amount, the date and
// the revenue account number are checked against the invoice. A FULL match is accepted; any mismatch, a missing invoice or a collected / cancelled invoice is rejected with its reason.
// Nothing is changed here: the check only reads the store.
import { derive, makeCtx, lookupId, lookupSadad, idOf } from './engine.js';
import { iimFields } from './iimRow.js';
import { isoOf } from '../src/data/catalog.js';
import { parseInvoiceKey, MAIN } from '../src/data/iim.js';
import { reasonRuleOf, entityIndexOf } from '../src/data/exclusionUpload.js';

const AMOUNT_TOLERANCE = 1; // riyal

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
    const visible = cands.filter((i) => st.owner[i] === 0 || st.owner[i] === (req.owner || 0));
    if (!visible.length) { fail('invoice_not_found'); continue; }
    const mine = visible.filter((i) => st.ent[i] === ent); if (!mine.length) { fail('other_amanah'); continue; }
    const i = mine[0]; res.invoiceId = idOf(st, i);
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
