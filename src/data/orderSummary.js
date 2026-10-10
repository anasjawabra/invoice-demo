// Pure helpers behind the order page's three-step journey: which reviewed references may be selected, what is preselected, the selected total against the order amount,
// and the one-line summaries. No React here, so the rules are unit-tested.
import { isHardConflict } from './orderMatching';

// row = a row of buildRows(); returns { kind, selectable, preselect, candidate }
//   kind: confirmed · ready · weak · needs_evidence · ambiguous · unmatched · rejected · duplicate · pending
// A reference is selectable only when it identifies exactly ONE invoice with no unresolved hard conflict; only EXACT (complete, non-weak) matches are preselected.
// Ambiguous and conflicting references stay unselected until evidence resolves them — a typed reason never does, and neither does matching the order's debtor on its own.
export function rowState(row) {
  if (row.status === 'duplicate_reference' || (row.status === 'resolved_by_reference' && row.duplicateOf)) return { kind: 'duplicate', selectable: false, preselect: false, candidate: null };
  if (row.status === 'pending') return { kind: 'pending', selectable: false, preselect: false, candidate: null };
  if (row.status === 'unmatched' || row.status === 'not_invoice_reference') return { kind: 'unmatched', selectable: false, preselect: false, candidate: null };
  if (row.status === 'ambiguous') return { kind: 'ambiguous', selectable: false, preselect: false, candidate: null };
  const cand = row.candidates[0]; if (!cand) return { kind: 'unmatched', selectable: false, preselect: false, candidate: null };
  if (row.link?.status === 'confirmed') return { kind: 'confirmed', selectable: false, preselect: false, candidate: cand };
  if ((row.unresolved[cand.invoiceId] || []).some(isHardConflict)) return { kind: 'needs_evidence', selectable: false, preselect: false, candidate: cand };
  if (row.rejected) return { kind: 'rejected', selectable: true, preselect: false, candidate: cand };
  if (row.weak) return { kind: 'weak', selectable: true, preselect: false, candidate: cand };
  return { kind: 'ready', selectable: true, preselect: true, candidate: cand };
}

// the invoices to link: one entry per distinct invoice (several references to the same invoice are one link)
export function selectionFor(rows, overrides = {}) {
  const out = new Map();
  for (const row of rows) {
    const st = rowState(row); if (!st.candidate || st.kind === 'confirmed') continue;
    const id = st.candidate.invoiceId; const on = id in overrides ? !!overrides[id] : st.preselect;
    if (st.selectable && on && !out.has(id)) out.set(id, { row, candidate: st.candidate });
  }
  return [...out.values()];
}

// amounts: the BASIS is the invoice's gross (value before exclusions and payments). Each invoice is counted once.
export function totalsFor(order, reconciliation, selected) {
  const selectedTotal = selected.reduce((s, x) => s + (x.candidate.grossAmount || 0), 0);
  const confirmedTotal = reconciliation.confirmedTotal; // null when a confirmed link has no known amount
  const total = confirmedTotal == null ? null : confirmedTotal + selectedTotal;
  return { orderAmount: order.amount, selectedCount: selected.length, selectedTotal, confirmedCount: reconciliation.confirmedCount, confirmedTotal, total, difference: total == null ? null : order.amount - total };
}

const AR_PAGES = (n) => (n === 1 ? 'صفحة واحدة' : n === 2 ? 'صفحتان' : n <= 10 ? `${n} صفحات` : `${n} صفحة`);
const AR_REFS = (n) => (n === 1 ? 'مرجع واحد' : n === 2 ? 'مرجعان' : n <= 10 ? `${n} مراجع` : `${n} مرجعاً`);
const AR_INV = (n) => (n === 1 ? 'فاتورة واحدة' : n === 2 ? 'فاتورتين' : n <= 10 ? `${n} فواتير` : `${n} فاتورة`);
export const NOT_IDENTIFIED = { ar: 'لم يتم تحديد أرقام الفواتير — تحتاج مراجعة', en: 'Invoice numbers not identified — needs review' };

// the three short lines (references · extraction · finance). `rows` = review rows; `comp` = orderCompleteness()
export function summaryLines(comp, rows) {
  const states = rows.map(rowState).filter((s) => s.kind !== 'duplicate');
  const identified = new Set(states.filter((s) => s.candidate && s.kind !== 'needs_evidence').map((s) => s.candidate.invoiceId)).size;
  const needReview = states.filter((s) => !['confirmed', 'ready', 'rejected'].includes(s.kind)).length;
  const refs = !states.length && !comp.references.confirmedLinks ? { ar: NOT_IDENTIFIED.ar, en: NOT_IDENTIFIED.en, tone: 'warn' }
    : { ar: `${identified ? `تم العثور على ${AR_INV(identified)}` : 'لم تُحدَّد أي فاتورة بعد'}${needReview ? ` — ${AR_REFS(needReview)} ${needReview === 1 ? 'يحتاج' : needReview === 2 ? 'يحتاجان' : needReview <= 10 ? 'تحتاج' : 'يحتاج'} مراجعة` : ''}`, en: `${identified ? `${identified} invoice(s) found` : 'No invoice identified yet'}${needReview ? ` — ${needReview} reference(s) need review` : ''}`, tone: needReview ? 'warn' : 'ok' };
  const unread = comp.extraction.unreadPages;
  const ext = comp.extraction.state === 'no_document' ? null : unread ? { ar: `${AR_PAGES(unread)} ${unread === 2 ? 'لم تُقرآ' : 'لم تُقرأ'}`, en: `${unread} page(s) not read`, tone: 'warn' } : { ar: 'قُرئت كل الصفحات', en: 'Every page was read', tone: 'ok' };
  const f = comp.finance.state;
  const fin = f === 'short' || f === 'over' ? { ar: 'يوجد فرق في المبلغ', en: 'There is an amount difference', tone: 'warn' } : f === 'reconciled' ? { ar: 'المبلغ متطابق', en: 'The amount is reconciled', tone: 'ok' } : null;
  return { refs, ext, fin };
}
