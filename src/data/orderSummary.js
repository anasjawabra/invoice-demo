// Pure helpers behind the order page's three-step journey: which reviewed references may be selected, what is preselected, the selected total against the order amount,
// and the one-line summaries. No React here, so the rules are unit-tested.
import { isHardConflict, collectReferences } from './orderMatching';

// row = a row of buildRows(); returns { kind, selectable, preselect, candidate }
//   kind: confirmed · ready · weak · needs_evidence · ambiguous · unmatched · rejected · duplicate · pending
// A reference is selectable only when it identifies exactly ONE invoice with no unresolved hard conflict; only EXACT (complete, non-weak) matches are preselected.
// Ambiguous and conflicting references stay unselected until evidence resolves them — a typed reason never does, and neither does matching the order's debtor on its own.
export function rowState(row) {
  if (row.status === 'duplicate_reference' || (row.status === 'resolved_by_reference' && row.duplicateOf)) return { kind: 'duplicate', selectable: false, preselect: false, candidate: null };
  if (row.status === 'corrupted') return { kind: 'corrupted', selectable: false, preselect: false, candidate: null };
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

// The matching-review status of an order — ONE value for the list and its filter (the other two completeness states stay separate and appear as alerts):
//   not_identified (no invoice reference found anywhere) · contract_level · needs_review (a reference is open, proposed, conflicting or unreliable) · complete (every reference found is decided)
const REVIEW_REASONS = ['unresolved_references', 'proposals_pending', 'conflicts', 'corrupted_reference'];
export function reviewStatusOf(comp, order, exceptions = []) {
  const r = comp.references;
  if (r.state === 'none') return !!order.contractNo && !(order.refs || []).length && !r.confirmedLinks ? 'contract_level' : 'not_identified';
  return r.state === 'incomplete' || exceptions.some((x) => REVIEW_REASONS.includes(x)) ? 'needs_review' : 'complete';
}
export const REVIEW_LABEL = {
  not_identified: { ar: 'أرقام الفواتير غير محددة', en: 'Invoice numbers not identified', tone: 'warn' },
  contract_level: { ar: 'على مستوى العقد', en: 'Contract level', tone: 'warn' },
  needs_review: { ar: 'تحتاج مراجعة', en: 'Needs review', tone: 'warn' },
  complete: { ar: 'مكتملة', en: 'Complete', tone: 'ok' }
};
// small contextual alerts beside the status (explained in the details page)
export function orderAlerts(comp, exceptions = []) {
  const out = [];
  if (exceptions.includes('corrupted_reference')) out.push({ key: 'unreliable', ar: 'رقم غير موثوق', en: 'Unreliable number', why: { ar: 'رقم فاتورة وصل بصيغة علمية ناقصة الأرقام: لا يُطابق.', en: 'An invoice number arrived in scientific notation with missing digits: it is not matched.' } });
  if (comp.extraction.unreadPages) out.push({ key: 'unread', ar: 'مستند لم يُقرأ', en: 'Unread document', why: { ar: 'صفحة أو ملف لم يُقرأ؛ أضف نصه أو مستنداً آخر.', en: 'A page or file was not read; supply its text or another document.' } });
  else if (comp.extraction.attachmentsPending) out.push({ key: 'attachments', ar: 'مرفق لم يُضَف', en: 'Attachment not added', why: { ar: 'مرفق مدرج في سند لم يُجلب هنا؛ أضفه يدوياً.', en: 'An attachment listed by Sanad was not retrieved here; add it by hand.' } });
  if (comp.finance.state === 'short' || comp.finance.state === 'over') out.push({ key: 'gap', ar: 'فرق مالي', en: 'Financial gap', why: { ar: 'الفواتير المربوطة لا تساوي مبلغ الطلب: يستدعي بحثاً، ولا يثبت وجود فاتورة أخرى.', en: 'The linked invoices do not add up to the request amount: it calls for a search; it does not prove another invoice exists.' } });
  return out;
}
// the ONE next action offered at the top of an order (what the person should do now)
export function nextActionOf(comp, order, exceptions = []) {
  const st = reviewStatusOf(comp, order, exceptions); const gap = comp.finance.state === 'short' || comp.finance.state === 'over';
  if (st === 'not_identified' || st === 'contract_level') return { key: 'add_document', ar: `${NOT_IDENTIFIED.ar}.`, en: `${NOT_IDENTIFIED.en}.`, cta: { ar: 'إضافة مستند', en: 'Add a document' } };
  if (exceptions.includes('corrupted_reference')) return { key: 'unreliable', ar: 'رقم فاتورة وصل بصيغة ناقصة الأرقام ولا يمكن مطابقته. راجع بقية الأرقام، وابحث عن الرقم الكامل في الوصف أو في مستند.', en: 'An invoice number arrived with missing digits and cannot be matched. Review the other numbers and look for the full number in the description or a document.', cta: { ar: 'مراجعة المراجع', en: 'Review the references' } };
  if (st === 'needs_review') return { key: 'review', ar: 'هناك مراجع تحتاج مراجعتك قبل التأكيد.', en: 'Some references need your review before confirming.', cta: { ar: 'مراجعة المراجع', en: 'Review the references' } };
  if (comp.extraction.unreadPages) return { key: 'unread', ar: 'صفحة لم تُقرأ. أضف نصها أو مستنداً آخر.', en: 'A page was not read. Supply its text or another document.', cta: { ar: 'إضافة مستند', en: 'Add a document' } };
  if (gap) return { key: 'gap', ar: 'الفواتير المربوطة لا تغطي مبلغ الطلب. قد تكون هناك مراجع ناقصة — والفرق وحده لا يثبت وجود فاتورة أخرى.', en: 'The linked invoices do not cover the request amount. References may be missing — the gap alone does not prove another invoice exists.', cta: { ar: 'إضافة مستند', en: 'Add a document' } };
  return { key: 'done', ar: 'لا إجراء مطلوب الآن.', en: 'No action needed now.', cta: null };
}

// the counts of requests by what the SOURCE STATUS text supports: «closed» only where the text says «مغلق»; everything else is unclassified (never counted as active or suspended)
export function statusGroupCounts(cases) {
  const closed = cases.filter((c) => c.orderStatus === 'closed' || c.requestStatus === 'مغلق').length;
  return { total: cases.length, closed, unclassified: cases.length - closed };
}
const norm = (v) => String(v ?? '').toLowerCase().replace(/[\s\-_/]/g, '');
export const normalizeSearch = norm;
// what the list search looks in: the request / claim / enforcement numbers, the demo reference, every invoice reference found (as written and normalised) and the linked invoices
export function orderSearchBlob(c) {
  const refs = collectReferences(c, c.docs || []);
  return norm([c.source?.requestNo, c.enforceNum, c.source?.claimNo, c.source?.enforcementNo, ...refs.flatMap((r) => [r.value, ...r.origins.map((o) => o.raw)]), ...(c.links || []).map((l) => l.invoiceId)].filter(Boolean).join(' '));
}
