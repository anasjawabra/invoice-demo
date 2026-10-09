// ============================================================================
// Enforcement-to-invoice matching (Sanad / Efaa cases -> invoices).
//
// Principles (HLSD V0.4 + meeting):
//  * Prefer structured identifiers; extract invoice / SADAD / contract references
//    from document text only when needed.
//  * One case may link to several invoices (one-to-many).
//  * Ambiguous matches are never auto-confirmed; they need an explicit human decision.
//  * Unresolved cases stay in their own bucket.
//  * A case amount is NOT allocated across invoices unless the case↔invoice pair is
//    exact; otherwise the unallocated amount is reported separately and each invoice
//    is counted once at its own outstanding balance (no double counting).
//  * Review history is preserved inside this analytical solution; nothing is written
//    to the source systems.
// ============================================================================
import { addDays } from './revenueLedger';
import { effectiveExclusion, normalizeConfig, deriveRecord } from './revenueMetrics';

export const MATCH_TOLERANCE = 0.2; // transcript: OCR variance steps of 0 / 10 / 20 %

export function extractReferences(text = '') {
  const t = String(text);
  const invoiceIds = [...new Set(t.match(/INV-\d{4}-\d{4}/gi) || [])].map((s) => s.toUpperCase());
  const coRefs = [...new Set(t.match(/CO-\d{4,6}/gi) || [])].map((s) => s.toUpperCase());
  const long = [...new Set(t.match(/\d{10,16}/g) || [])];
  const short = [...new Set((t.match(/\d{4,9}/g) || []))];
  return { invoiceIds, coRefs, longNumbers: long, shortNumbers: short };
}

function refMatches(rec, refs) {
  const hits = [];
  if (refs.invoiceIds.includes(rec.id)) hits.push('invoice_id');
  if (rec.co && refs.coRefs.includes(rec.co.toUpperCase())) hits.push('contract_ref');
  if (rec.violationNumber && refs.longNumbers.includes(String(rec.violationNumber))) hits.push('violation_number');
  if (rec.beneficiaryId && refs.longNumbers.includes(String(rec.beneficiaryId))) hits.push('debtor_id');
  // Numeric suffix of the invoice id or contract ref (weak, unstructured).
  const suffix = rec.id.slice(-4);
  const coNum = rec.co ? rec.co.replace(/\D/g, '') : '';
  if (!hits.length && (refs.shortNumbers.includes(suffix) || (coNum && refs.shortNumbers.includes(coNum)))) hits.push('numeric_fragment');
  return hits;
}

const pct = (a, b) => (b > 0 ? Math.abs(a - b) / b : 1);

export function proposeMatches(enforcementCase, ledger, text = '', cfgIn = {}) {
  const cfg = normalizeConfig(cfgIn);
  const refs = extractReferences(text);
  const candidates = [];
  for (const rec of ledger) {
    const excluded = !!effectiveExclusion(rec, cfg);
    const d = deriveRecord(rec, cfg);
    const evidence = [];
    const conflicts = [];
    let score = 0;

    const hits = refMatches(rec, refs);
    if (hits.includes('invoice_id') || hits.includes('violation_number')) { score += 0.65; evidence.push(hits.includes('invoice_id') ? 'ref_invoice_id' : 'ref_violation_number'); }
    else if (hits.includes('contract_ref')) { score += 0.5; evidence.push('ref_contract'); }
    else if (hits.includes('debtor_id')) { score += 0.25; evidence.push('ref_debtor_id'); }
    else if (hits.includes('numeric_fragment')) { score += 0.2; evidence.push('ref_fragment'); }

    const basis = d.outstanding > 0 ? d.outstanding : rec.grossAmount;
    const diff = Math.min(pct(enforcementCase.amount, basis), pct(enforcementCase.amount, rec.grossAmount));
    if (diff === 0) { score += 0.25; evidence.push('amount_exact'); }
    else if (diff <= MATCH_TOLERANCE) { score += 0.15 * (1 - diff / MATCH_TOLERANCE) + 0.05; evidence.push('amount_near'); }

    if (rec.amanahEn === enforcementCase.amanahEn) { score += 0.1; evidence.push('same_amanah'); }
    else { score -= 0.2; conflicts.push('different_amanah'); }

    if (d.outstanding <= 0 && !excluded) { score -= 0.35; conflicts.push('invoice_already_collected'); }
    if (excluded) { score -= 0.3; conflicts.push('invoice_excluded'); }
    if (rec.issueDate > (enforcementCase.openedDate || '9999-12-31')) { score -= 0.15; conflicts.push('invoice_issued_after_case'); }
    if (rec.enforcementLinks.some((l) => l.status === 'confirmed' && l.enforceNum !== enforcementCase.enforceNum)) { conflicts.push('already_linked_to_other_case'); score -= 0.1; }

    const surfacedForReview = evidence.some((e) => e === 'amount_exact' || e === 'amount_near') && evidence.includes('same_amanah');
    if (score >= 0.3 || surfacedForReview) {
      candidates.push({ invoiceId: rec.id, score: Math.round(score * 100) / 100, evidence, conflicts, amountDiffPct: Math.round(diff * 1000) / 10, invoiceOutstanding: d.outstanding, invoiceGross: rec.grossAmount });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  let verdict = 'none';
  if (candidates.length) {
    const [a, b] = candidates;
    if (a.score >= 0.7 && (!b || a.score - b.score >= 0.25) && !a.conflicts.length) verdict = 'strong';
    else if (b && b.score >= 0.4 && a.score - b.score < 0.15) verdict = 'ambiguous';
    else if (a.conflicts.length && a.score < 0.45) verdict = 'conflicting';
    else verdict = a.score >= 0.45 ? 'weak' : 'none';
    if (verdict === 'strong' && a.conflicts.length) verdict = 'weak';
  }
  const multi = refs.invoiceIds.length > 1 || refs.coRefs.length > 1;
  return { refs, candidates, verdict, oneToMany: multi && candidates.filter((c) => c.score >= 0.45).length > 1, requiresReview: true };
}

/* ---------- Review operations (pure; return new case arrays) ---------- */
const clone = (cases) => cases.map((c) => ({ ...c, links: c.links.map((l) => ({ ...l })), history: [...(c.history || [])] }));

export function addCandidateLinks(cases, enforceNum, candidates, by = 'AI matcher (demo)', at = null) {
  const next = clone(cases);
  const c = next.find((x) => x.enforceNum === enforceNum);
  if (!c) return cases;
  for (const cand of candidates) {
    if (c.links.some((l) => l.invoiceId === cand.invoiceId && l.status !== 'rejected')) continue;
    c.links.push({ invoiceId: cand.invoiceId, allocated: null, status: 'candidate', evidence: cand.evidence, conflicts: cand.conflicts, score: cand.score, proposedBy: by, proposedAt: at });
  }
  c.history.push({ at, action: 'candidates_proposed', by, note: `${candidates.length} candidate(s)` });
  return next;
}

export function reviewLink(cases, { enforceNum, invoiceId, decision, reviewer, note = '', at }) {
  const next = clone(cases);
  const c = next.find((x) => x.enforceNum === enforceNum);
  const l = c?.links.find((x) => x.invoiceId === invoiceId);
  if (!c || !l) return { cases, error: 'not_found' };
  const open = c.links.filter((x) => x.status === 'candidate');
  if (decision === 'confirmed') {
    if (l.conflicts?.length && !note.trim()) return { cases, error: 'note_required_for_conflict' };
    if (open.length > 1 && !note.trim()) return { cases, error: 'note_required_for_ambiguous' };
    l.status = 'confirmed';
    // Allocate only for an exact one-to-one pair; otherwise leave the case amount unallocated.
    const confirmedCount = c.links.filter((x) => x.status === 'confirmed').length;
    l.allocated = confirmedCount === 1 && l.evidence?.includes('amount_exact') ? c.amount : null;
  } else if (decision === 'rejected') {
    l.status = 'rejected';
  } else return { cases, error: 'bad_decision' };
  l.reviewedBy = reviewer;
  l.reviewedAt = at;
  l.reviewNote = note;
  c.history.push({ at, action: decision, by: reviewer, invoiceId, note });
  return { cases: next, error: null };
}

export function caseSummary(c) {
  const confirmed = c.links.filter((l) => l.status === 'confirmed');
  const candidates = c.links.filter((l) => l.status === 'candidate');
  const allocated = confirmed.reduce((s, l) => s + (l.allocated || 0), 0);
  let state = 'unresolved';
  if (confirmed.length) state = 'linked';
  else if (candidates.length > 1) state = 'ambiguous';
  else if (candidates.length === 1) state = 'candidate';
  return { state, confirmed: confirmed.length, candidates: candidates.length, allocated, unallocated: c.amount - allocated };
}

export function addDaysSafe(d, n) { return addDays(d, n); }
