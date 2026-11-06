// The explicit flags of one row of the review table (built on rowState / matchCriteria from orderSummary.js — nothing is matched here):
//   incomplete (short / serial-only / corrupted number) · unmatched · ambiguous · conflicting data (other Amanah, other debtor, amount difference, issued after the order, cancelled in the source) ·
//   already excluded / collected · also linked to another order.
// Each flag: { key, tone: 'bad' | 'warn' | 'info', ar, en }.
import { rowState, matchCriteria, confidenceOf } from '../orderSummary.js';

const F = (key, tone, ar, en) => ({ key, tone, ar, en });
export const FLAG = {
  incomplete: F('incomplete', 'warn', 'رقم ناقص (رقم تسلسلي فقط — لا يحدد فاتورة بمفرده)', 'Incomplete number (serial only — does not identify an invoice by itself)'),
  corrupted: F('corrupted', 'bad', 'رقم مشوّه (فقدت أرقامه) — لا يُطابق', 'Corrupted number (digits lost) — never matched'),
  unmatched: F('unmatched', 'bad', 'مرجع غير مطابق: لا فاتورة بهذا الرقم في النظام', 'Unmatched reference: no invoice carries this number'),
  ambiguous: F('ambiguous', 'warn', 'مطابقة ملتبسة: عدة فواتير بهذا الرقم', 'Ambiguous match: several invoices carry this number'),
  amanah_mismatch: F('amanah_mismatch', 'bad', 'تعارض: فاتورة تابعة لأمانة أخرى غير أمانة الأمر', 'Conflict: the invoice belongs to another Amanah than the order'),
  debtor_mismatch: F('debtor_mismatch', 'bad', 'تعارض: دافع الفاتورة ليس مدين الأمر', 'Conflict: the invoice payer is not the order debtor'),
  invoice_issued_after_order: F('invoice_issued_after_order', 'bad', 'تعارض: الفاتورة صدرت بعد فتح الأمر', 'Conflict: the invoice was issued after the order opened'),
  invoice_cancelled: F('invoice_cancelled', 'bad', 'فاتورة ملغاة في المصدر', 'Invoice cancelled in the source'),
  invoice_excluded: F('invoice_excluded', 'info', 'فاتورة مستبعدة أصلاً', 'Invoice already excluded'),
  invoice_collected: F('invoice_collected', 'info', 'فاتورة محصّلة بالكامل', 'Invoice already collected in full'),
  linked_to_other_order: F('linked_to_other_order', 'warn', 'مرتبطة أيضاً بأمر آخر', 'Also linked to another order'),
  amount_difference: F('amount_difference', 'warn', 'فرق: مبلغ الفواتير المطابقة لا يساوي مبلغ الأمر', 'Difference: the matched invoices do not add up to the order amount'),
  document_other_order: F('document_other_order', 'bad', 'ورد في مستند يذكر أمراً آخر', 'Found only in a document that names another order'),
  weak_reference: F('weak_reference', 'warn', 'مرجع ضعيف', 'Weak reference')
};
const FROM_CONFLICT = ['amanah_mismatch', 'debtor_mismatch', 'invoice_issued_after_order', 'invoice_cancelled', 'invoice_excluded', 'invoice_collected', 'linked_to_other_order', 'document_other_order'];

// row: a buildRows() row (with `criteria` when it has a candidate); returns the flags, most serious first
export function rowFlags(row) {
  const st = rowState(row); const out = []; const cand = st.candidate; const id = cand?.invoiceId;
  if (st.kind === 'duplicate') return out;
  if (st.kind === 'corrupted') out.push(FLAG.corrupted);
  else if (row.kind === 'invoice_serial' || row.weak || row.kind === 'invoice_corrupted') out.push(FLAG.incomplete);
  if (st.kind === 'unmatched') out.push(FLAG.unmatched);
  if (st.kind === 'ambiguous') out.push(FLAG.ambiguous);
  if (id) for (const x of row.conflicts?.[id] || []) if (FROM_CONFLICT.includes(x)) out.push(FLAG[x]);
  if (cand?.sourceCancelled && !out.includes(FLAG.invoice_cancelled)) out.push(FLAG.invoice_cancelled);
  if (cand && row.criteria?.amount === false && st.kind !== 'needs_evidence') out.push(FLAG.amount_difference);
  const rank = { bad: 0, warn: 1, info: 2 };
  return [...new Set(out)].sort((a, b) => rank[a.tone] - rank[b.tone]);
}

// the supporting document references of a row: every origin that is a document, with page(s) and the snippet; structured / free-text origins are listed without a page
export function evidenceOf(row) {
  return (row.origins || []).map((o) => ({ type: o.type, docId: o.docId || null, docName: o.docName || null, pages: o.pages || [], snippet: o.snippet || null, raw: o.raw || null }));
}

// the review rows with the three criteria (invoice number · Amanah · amount), the confidence and the partial-match marker — the SAME computation the review table shows (D22 / D20).
// The order amount is compared with the total of the invoices matched by reference (each counted once).
export function withCriteria(order, rowsIn) {
  const ids = new Map();
  for (const r of rowsIn) { const st = rowState(r); if (st.candidate && st.kind !== 'duplicate' && st.kind !== 'needs_evidence' && st.kind !== 'ambiguous') ids.set(st.candidate.invoiceId, st.candidate.grossAmount || 0); }
  const orderTotal = [...ids.values()].reduce((t, x) => t + x, 0);
  const rows = rowsIn.map((r) => { const cr = matchCriteria(order, r, orderTotal); return { ...r, criteria: cr, confidence: cr ? confidenceOf(order, r, cr) : null, partialMatch: !!cr && !cr.full && rowState(r).kind === 'ready' }; });
  return { rows, orderTotal };
}
