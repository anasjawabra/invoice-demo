// The order workflow from the structured Sanad reference to a CONFIRMED link — pure functions (no React, no I/O), so every rule is unit-tested (tests/sanad-workflow.test.mjs).
//
// PRINCIPLES (business requirement)
//  * OCR / the document is a FALLBACK: the structured invoice number(s) of the Sanad request are validated FIRST, on opening the order, against the invoices of the connected sources (the demo ledger
//    unifies Tahseel and the other sources; a Furas contract-installment is the same unified invoice, counted once). Document reading is offered only when the structured data is missing or inconsistent.
//  * User confirmation is required before ANY proposed relationship becomes a confirmed link — in every scenario, even a perfect structured match. Extraction, a proposal and a manual entry change nothing.
//  * ONE path for every reference, whatever its origin (structured Sanad field · document extraction · manual entry · manual search): collectReferences → data-service resolve → buildRows → the same
//    existence / ambiguity / duplicate / amount checks. Originals are never edited: a correction is stored apart (reference_corrected) with its origin, reason, reviewer and time.
//
// AMOUNT BASIS (one definition, used by every function below and by the reducers in orderMatching.js)
//  * order amount   = the Sanad «المبلغ» of the request (order.source.amount; order.amount is the same value);
//  * invoice amount = the invoice's BILLED value = `grossAmount` of the order-match summary (gross + approved adjustments) — NEVER the outstanding balance (shown for information only);
//  * invoices total = the sum over DISTINCT invoices (an invoice named by several references, or represented by several sources, counts once);
//  * tolerance      = 1 SAR (AMOUNT_TOLERANCE): rounding only — anything larger is a real difference.
import { collectReferences, isInvoiceKind, refKey, AMOUNT_TOLERANCE } from './orderMatching';
import { manualExtraction } from './ocrSimulation';

export const AMOUNT_BASIS = {
  ar: 'مبلغ الأمر = «المبلغ» في طلب سند؛ قيمة الفاتورة = قيمتها المفوترة (الإجمالي مع التعديلات المعتمدة) وليس الرصيد غير المحصَّل؛ كل فاتورة تُحتسب مرة واحدة؛ التسامح ريال واحد.',
  en: 'Order amount = the Sanad «amount»; invoice amount = its billed value (gross with approved adjustments), not the outstanding balance; each invoice counted once; tolerance 1 SAR.'
};
export const SOURCES_NOTE = {
  ar: 'تُطابَق الأرقام مع الفواتير الموحّدة من المصادر المتاحة (تحصيل وبقية المصادر)؛ وقسط عقد فرص يُمثَّل فاتورة واحدة موحّدة.',
  en: 'Numbers are matched against the unified invoices of the available sources (Tahseel and the others); a Furas contract installment is one unified invoice.'
};

// the status banners (exact texts)
export const BANNER = {
  match: { key: 'match', tone: 'ok', ar: 'رقم الفاتورة والقيمة متطابقان', en: 'Invoice number and amount agree' },
  not_found: { key: 'not_found', tone: 'warn', ar: 'رقم الفاتورة غير موجود في المصادر المتاحة — يحتاج مراجعة', en: 'The invoice number is not found in the available sources — needs review' },
  amount_diff: { key: 'amount_diff', tone: 'warn', ar: 'اختلاف بين قيمة الفواتير وقيمة أمر التنفيذ', en: 'The invoices’ value differs from the enforcement order amount' },
  no_numbers: { key: 'no_numbers', tone: 'warn', ar: 'لا توجد أرقام فواتير في طلب سند — يمكن استخراجها من المستند أو إدخالها يدوياً', en: 'The Sanad request carries no invoice number — extract it from the document or enter it manually' },
  ambiguous: { key: 'ambiguous', tone: 'warn', ar: 'الرقم يطابق أكثر من فاتورة — اختر الفاتورة الصحيحة بدليل', en: 'The number matches more than one invoice — choose the right one with evidence' },
  corrupted: { key: 'corrupted', tone: 'warn', ar: 'رقم الفاتورة في سند مشوّه (فقدت أرقامه) — يحتاج مراجعة', en: 'The Sanad invoice number is corrupted (digits lost) — needs review' },
  manual: { key: 'manual', tone: 'warn', ar: 'المستند غير متوفر أو تعذّر استخراجه — ابحث عن الفاتورة يدوياً وسجّل السبب', en: 'The document is missing or could not be read — search the invoice manually and record the reason' }
};

const ORIGIN = { structured: 'sanad_structured', description: ['sanad_description', 'sanad_notes'] };
// where a reference came from (one reference can have several origins)
export function originKinds(ref) {
  const out = new Set();
  for (const o of ref.origins || []) {
    const t = String(o.type);
    if (t === ORIGIN.structured) out.add('structured');
    else if (ORIGIN.description.includes(t)) out.add('description');
    else if (t === 'document_manual_search') out.add('manual_search');
    else if (t === 'document_manual_entry') out.add('manual_entry');
    else if (t.startsWith('document_')) out.add('document');
    else out.add('other');
  }
  return [...out];
}

const stateOf = (res, ref) => {
  if (ref.kind === 'invoice_corrupted') return { state: 'corrupted' };
  if (!res) return { state: 'pending' };
  if (res.status === 'matched') return res.weak ? { state: 'weak', invoice: res.candidates[0] } : { state: 'matched', invoice: res.candidates[0] };
  if (res.status === 'ambiguous') return { state: 'ambiguous', candidates: res.candidates };
  return { state: 'unmatched' };
};
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// A group of references → what they identify. `results` = the data service's answers (one per reference).
function summarise(entries, orderAmount) {
  const byId = new Map(); const duplicates = [];
  for (const e of entries) if (e.state === 'matched') { const id = e.invoice.invoiceId; if (byId.has(id)) duplicates.push({ invoiceId: id, ref: e.ref.value }); else byId.set(id, e.invoice); }
  const matched = [...byId.values()];
  const total = round2(matched.reduce((t, k) => t + (k.grossAmount || 0), 0));
  const outstanding = round2(matched.reduce((t, k) => t + (k.outstanding || 0), 0)); // information only — never the comparison basis
  const known = orderAmount != null && Number.isFinite(orderAmount) && orderAmount > 0;
  const difference = known ? round2(orderAmount - total) : null;
  const by = (s) => entries.filter((e) => e.state === s);
  const unresolved = entries.filter((e) => ['unmatched', 'ambiguous', 'corrupted', 'weak', 'pending'].includes(e.state));
  return {
    refs: entries.length, matched, duplicates, total, outstanding, orderAmount: known ? orderAmount : null, difference,
    amountMatch: known && matched.length > 0 && Math.abs(difference) <= AMOUNT_TOLERANCE,
    unmatched: by('unmatched'), ambiguous: by('ambiguous'), corrupted: by('corrupted'), weak: by('weak'), pending: by('pending'), unresolved
  };
}

// assessOrder(order, resolveResults, { docState }) → the status of the order's invoice references.
//   order           : the case (refs, source.amount, docs, dismissedRefs, links…) — collectReferences reads every origin
//   resolveResults  : the answers of the data service for those references ([{ ref: {kind,value}, status, weak, candidates }])
//   docState        : 'missing' | 'attached' | 'extracted' | 'under_review' | 'reviewed' | 'failed' | null (the Sanad document, for the manual-search recommendation)
// Returns { scenario, banner, structured, current, mode, … }:
//   `structured` is the validation of what SANAD ITSELF says (original refs — never changed by a later correction) and decides the banner and the mode;
//   `current` is every live reference (structured + document + manual, minus set-aside / corrected ones) — what would be confirmed now.
export function assessOrder(order, results = [], { docState = null } = {}) {
  const orderAmount = Number(order?.source?.amount ?? order?.amount);
  const amount = Number.isFinite(orderAmount) && orderAmount > 0 ? orderAmount : null;
  const refs = collectReferences(order || {}, order?.docs || []).filter((r) => isInvoiceKind(r.kind));
  const byKey = new Map((results || []).map((r) => [refKey(r.ref.kind, r.ref.value), r]));
  const dismissed = new Set(order?.dismissedRefs || []);
  const entries = refs.map((ref) => ({ ref, origins: originKinds(ref), dismissed: dismissed.has(ref.key), ...stateOf(byKey.get(ref.key), ref) }));
  const structuredE = entries.filter((e) => e.origins.includes('structured'));
  const S = summarise(structuredE, amount); const live = entries.filter((e) => !e.dismissed); const C = summarise(live, amount);

  let scenario;
  if (S.refs === 0) scenario = 'no_numbers';
  else if (!S.matched.length) scenario = S.ambiguous.length ? 'ambiguous' : S.corrupted.length && !S.unmatched.length ? 'corrupted' : 'not_found';
  else if (S.unresolved.length) scenario = S.amountMatch ? 'not_found' : 'amount_diff';
  else scenario = S.amountMatch ? 'match' : 'amount_diff';

  const docMissing = docState === 'missing' || docState === 'failed';
  const unresolvedNow = C.unresolved.length > 0 || (C.matched.length > 0 && !C.amountMatch);
  const manualRecommended = scenario !== 'match' && (docMissing || (['extracted', 'under_review', 'reviewed'].includes(docState) && unresolvedNow));
  const banner = scenario === 'no_numbers' && docMissing ? BANNER.manual : BANNER[scenario];
  const confirmedN = (order?.links || []).filter((l) => l.status === 'confirmed').length;
  return {
    scenario, banner, orderAmount: amount, structured: S, current: C, entries,
    mode: scenario === 'match' ? 'confirm_directly' : 'document_first', // a perfect structured match goes straight to the confirmation panel; reading the document stays available but secondary
    ocrRequired: scenario !== 'match', ocrSecondary: scenario === 'match', offerExtraction: scenario !== 'match', manualRecommended, manualAvailable: true, requireExplanation: true,
    reconciledNow: C.matched.length > 0 && C.amountMatch && C.unresolved.length === 0, confirmedN
  };
}

/* ------------------------------------------------------------------ the confirmation summary */
// selected: [{ row, candidate }] (selectionFor) — rows = the review rows; confirmedTotal = billed total of the links already confirmed (null when unknown).
export function confirmationSummary(order, selected, { confirmedTotal = 0 } = {}) {
  const orderAmount = Number(order?.source?.amount ?? order?.amount); const known = Number.isFinite(orderAmount) && orderAmount > 0;
  const items = selected.map(({ row, candidate }) => {
    const kinds = originKinds(row); const docOrigin = (row.origins || []).find((o) => o.docId && o.docId !== 'manual-entry');
    return {
      invoiceId: candidate.invoiceId, gross: candidate.grossAmount || 0, outstanding: candidate.outstanding, paymentStatus: candidate.paymentStatus, amanahEn: candidate.amanahEn,
      sourceCancelled: !!(candidate.sourceCancelled || candidate.cancelled), excludedAlready: !!candidate.excluded, reference: row.value, origins: kinds,
      doc: docOrigin ? { docId: docOrigin.docId, name: docOrigin.docName, pages: docOrigin.pages || [], snippet: docOrigin.snippet || null } : null,
      reason: (row.origins || []).find((o) => String(o.type).startsWith('document_manual'))?.snippet || null,
      warnings: [...(row.conflicts?.[candidate.invoiceId] || [])]
    };
  });
  const selectedTotal = round2(items.reduce((t, x) => t + x.gross, 0));
  const total = confirmedTotal == null ? null : round2(confirmedTotal + selectedTotal);
  const difference = known && total != null ? round2(orderAmount - total) : null;
  const requiresAck = difference != null && Math.abs(difference) > AMOUNT_TOLERANCE;
  return { items, selectedTotal, confirmedTotal, total, orderAmount: known ? orderAmount : null, difference, requiresAck, amountCheck: known && total != null ? { orderAmount, invoicesTotal: total, difference } : null };
}
// may the reviewer confirm? (a difference needs the acknowledgment AND a reason)
export function canConfirm(summary, ack) {
  if (!summary.items.length) return { ok: false, why: 'nothing_selected' };
  if (summary.requiresAck && !(ack && ack.acknowledged === true && String(ack.reason || '').trim())) return { ok: false, why: 'ack_required' };
  return { ok: true };
}

/* ------------------------------------------------------------------ what the engine did after the confirmation */
// detail = the invoice detail read AFTER the confirmation ({ derived, rec }). Never assumes an exclusion: it reports what the engine returned.
export function outcomeOf(detail) {
  const d = detail?.derived; if (!d) return null;
  const snd = (detail.rec?.exclusions || []).some((e) => e.ruleId === 'SND-1');
  const fully = !d.cancelled && d.gross > 0 && d.received >= d.gross;
  const base = { value: d.exclusionAmount || 0, outstanding: d.outstanding, received: d.received, gross: d.gross, sourceConflict: !!d.enfConflict, sourceCancelled: !!d.sourceCancelled, rules: (detail.rec?.exclusions || []).map((e) => e.ruleId) };
  if (d.excluded) return { ...base, state: 'excluded', byLink: snd };
  return { ...base, state: 'not_excluded', reason: fully ? 'collected' : d.cancelled ? 'cancelled' : d.enfConflict ? 'source_conflict' : snd ? 'not_applied' : 'no_rule' };
}
export const OUTCOME_REASON = {
  collected: { ar: 'محصّلة بالكامل — يُطبَّق الاستبعاد على غير المحصَّل فقط', en: 'Fully collected — exclusions apply to the uncollected amount only' },
  cancelled: { ar: 'ملغاة في المصدر — عُلِّمت بتعارض يحتاج مراجعة', en: 'Cancelled in the source — flagged as a conflict to review' },
  source_conflict: { ar: 'تعارض بين المصدر والتنفيذ — يحتاج مراجعة', en: 'Source / enforcement conflict — review required' },
  not_applied: { ar: 'لم يطبّق المحرك القاعدة', en: 'The engine did not apply the rule' },
  no_rule: { ar: 'لا قاعدة استبعاد منطبقة', en: 'No exclusion rule applied' }
};

/* ------------------------------------------------------------------ manual entry and manual search */
// the references a reviewer typed or picked → an extraction record for recordManualReferences (rev.enforcement.addManual). `origin`: manual_entry | manual_search; `reason` is REQUIRED.
export function manualReferencesFrom(text, { origin = 'manual_entry', reason = '', orderNo = null } = {}) {
  const ex = manualExtraction(text, { orderNo });
  return { ...ex, manual: { origin, reason: String(reason || '') } };
}
// a ledger list row (the /api/list answer) → the label of a search result
export const resultOf = (row) => ({ invoiceId: row.id, amanahEn: row.amanahEn, amanahAr: row.amanahAr, payerAr: row.payerAr, payerEn: row.payerEn, issueDate: row.issueDate, gross: row.billed ?? row.gross, outstanding: row.outstanding, paymentStatus: row.payStatus || null, cancelled: !!row.sourceCancelled });
