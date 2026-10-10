// ============================================================================
// Enforcement orders ↔ invoices: classification of references, matching rows, reconciliation, link lifecycle.
//
// Rules this module enforces (business correction: orders cover ONE OR MANY invoices of ANY type; the source is Sanad):
//  * An order's invoice references come from Sanad's structured data and from the order document (text layer, imported OCR text, or manual
//    entry). Every reference found is kept — a single extracted number is never taken to be the complete list.
//  * Invoice numbers are told apart from order, contract, account, commercial-registration, identity and bank numbers; the latter are listed
//    as «other references» and are never matched.
//  * AMOUNT NEVER CREATES A MATCH. The order amount is only compared with the total of the invoices that were matched by reference. A
//    difference is reported (and the order stays partial); it is never closed by inventing a match.
//  * A link is PROPOSED (no effect anywhere) until a person confirms it. Structured exact invoice numbers from Sanad are confirmed by the
//    feed itself; anything document-derived, weak (a bare serial) or ambiguous needs an explicit confirmation, and conflicts need a reason.
//  * Only a CONFIRMED link reflects the order's status on the invoice. The invoice's payment status is a separate field and never changes here.
//  * A partial match is never shown as a full match, and every proposal / confirmation / rejection / removal keeps its history.
// Everything here is pure (no storage, no network): callers pass the store in and get the next store back.
// ============================================================================

export const AMOUNT_TOLERANCE = 1; // SAR — rounding only; anything larger is a real difference
import { ORDER_STATUS, orderStatusOf, STATUS_RANK, invoiceEnforcement, invoiceStatusMap } from './relations';
export { ORDER_STATUS, orderStatusOf, STATUS_RANK, invoiceEnforcement, invoiceStatusMap };

export const INVOICE_KINDS = ['invoice_no', 'invoice_serial', 'sadad_no', 'violation_no'];
export const isInvoiceKind = (k) => INVOICE_KINDS.includes(k);
export const refKey = (kind, value) => `${kind}|${String(value).trim().toUpperCase()}`;

/* ------------------------------------------------------------------ extraction from document text */
const LABEL = {
  invoice: /invoice|inv\.|فاتور/i,
  sadad: /sadad|سداد/i,
  violation: /violation|مخالف/i,
  contract: /contract|عقد/i,
  account: /account|subscription|حساب|اشتراك|iban|آيبان/i,
  order: /enforcement|order no|order number|execution|أمر|تنفيذ|طلب/i,
  cr: /commercial reg|\bCR\b|سجل تجاري|السجل التجاري/i,
  person: /national id|identity|iqama|\bID\b|هوية|إقامة|اقامة/i
};
const NON_INVOICE_LABELS = ['account', 'cr', 'person', 'contract'];
// Arabic text from a PDF often carries bidi marks, tashkeel, tatweel and presentation forms: normalised before any label is looked for (the numbers themselves are never altered)
const normalizeArabic = (s) => String(s).normalize('NFKC').replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u064B-\u065F\u0640\u0001]/g, '');
const toLatinDigits = (s) => normalizeArabic(s).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const clip = (s, n = 170) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

// → [{ kind, value, label, page, snippet }]  — kinds: invoice_no | invoice_serial | sadad_no | violation_no | order_no | contract_no | bank_account | other_number
export function extractFromText(rawText, page = 1) {
  const out = [];
  const lines = toLatinDigits(rawText).split(/\r?\n/);
  let section = null; // the nearest heading-like line says what the following bare numbers are (table columns, lists)
  for (const raw of lines) {
    const line = raw.trim(); if (!line) continue;
    const hasLabel = (k) => LABEL[k].test(line);
    const digitsInLine = (line.match(/\d/g) || []).length;
    if (digitsInLine <= 3 && line.length < 80) { // a heading / column header line
      if (hasLabel('invoice') || hasLabel('sadad') || hasLabel('violation')) section = hasLabel('sadad') ? 'sadad' : hasLabel('violation') ? 'violation' : 'invoice';
      else if (NON_INVOICE_LABELS.some(hasLabel) || hasLabel('order')) section = 'other';
    }
    const used = [];
    const take = (re, fn) => { for (const m of line.matchAll(re)) { if (used.some(([a, b]) => m.index < b && m.index + m[0].length > a)) continue; used.push([m.index, m.index + m[0].length]); fn(m); } };
    const around = (m) => clip(line.length > 190 ? line.slice(Math.max(0, m.index - 70), m.index + m[0].length + 70) : line); // the words around the match (a long description line is not repeated for each number)
    take(/\bSA\d{22}\b/gi, (m) => out.push({ kind: 'bank_account', value: m[0].toUpperCase(), raw: m[0], label: 'IBAN', page, snippet: around(m) }));
    // an invoice number as people really type it: any case, spaces / dashes / slashes between the parts. The ORIGINAL text is kept (`raw`); the value is the canonical INV-YYYY-NNNNNNN (leading zeros kept; a short serial is left as typed and marked weak by the matcher)
    take(/\bINV[\s_\u2013\u2014\/-]*(\d{4})[\s_\u2013\u2014\/-]*(\d{1,7})\b/gi, (m) => out.push({ kind: 'invoice_no', value: `INV-${m[1]}-${m[2]}`, raw: m[0], label: 'pattern', page, snippet: around(m) }));
    take(/\b(?:EN|WLX)-\d{4,8}\b/gi, (m) => out.push({ kind: 'order_no', value: m[0].toUpperCase(), raw: m[0], label: 'pattern', page, snippet: around(m) }));
    take(/\b(?:CT|CNT)-\d{4}-\d{3,6}\b|\bCO-\d{4,6}\b/gi, (m) => out.push({ kind: 'contract_no', value: m[0].toUpperCase(), raw: m[0], label: 'pattern', page, snippet: around(m) }));
    take(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d])|(?<![\d.,])\d+\.\d{1,2}(?![\d])/g, () => {}); // amounts: consumed, never a reference
    take(/(?<![\d.,-])\d{7,16}(?![\d])/g, (m) => {
      const v = m[0]; const nonInv = NON_INVOICE_LABELS.find(hasLabel); const inv = hasLabel('invoice') || hasLabel('sadad') || hasLabel('violation') || section === 'invoice' || section === 'sadad' || section === 'violation';
      let kind = 'other_number'; let label = nonInv || 'unlabelled';
      if (v.length === 12 && !(nonInv && !hasLabel('sadad') && !hasLabel('invoice'))) { kind = 'sadad_no'; label = 'sadad'; }
      else if (v.length === 14 && !(nonInv && !hasLabel('violation') && !hasLabel('invoice'))) { kind = 'violation_no'; label = 'violation'; }
      else if (v.length === 7 && !nonInv && (hasLabel('invoice') || (inv && v.startsWith('0')))) { kind = 'invoice_serial'; label = 'invoice'; } // a bare 7-digit amount under an «Invoice» heading is not taken for a serial
      out.push({ kind, value: v, raw: v, label, page, snippet: around(m) });
    });
  }
  return out;
}

// the amount the document itself states as the order total, when one is labelled («المبلغ الإجمالي», "Total amount")
export function documentStatedAmount(text) {
  const m = /(?:total amount|order amount|amount due|grand total|المبلغ الإجمالي|إجمالي المبلغ|مبلغ الأمر|المبلغ المطلوب)\D{0,24}(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/i.exec(toLatinDigits(text));
  if (!m) return null; const v = Number(m[1].replace(/,/g, '')); return Number.isFinite(v) ? v : null;
}

// Pages → one extraction record. `pages`: [{ page, text, hasTextLayer }]; method: 'text_layer' | 'ocr_import' | 'manual_entry'
// Methods (kept DISTINCT in every stored record): text_layer (digital PDF text) · docx_text (Word paragraphs/tables) · ocr_simulated (prepared demo sample, NOT real OCR) · ocr_system (an OCR engine of this system — not connected)
// · ocr_import (text imported from an external OCR tool) · manual_entry (typed by a person).
export function buildExtraction(pages, method, { orderNo = null, format = null, reason = null, simulation = null, exactPages = true } = {}) {
  const refs = new Map();
  const others = [];
  let docOrderNos = [];
  const pageInfo = pages.map((p) => ({ page: p.page, chars: String(p.text || '').trim().length, textLayer: p.hasTextLayer !== false, needsOcr: (method === 'text_layer' || method === 'ocr_simulated') && String(p.text || '').trim().length < 10 }));
  for (const pi of pageInfo) pi.reason = pi.needsOcr ? (reason || (method === 'ocr_simulated' ? 'simulated_no_text' : 'no_text_layer')) : null; // why a page counts as unread: no text layer (scan) · unsupported format (legacy .doc, image) …
  for (const p of pages) {
    for (const u of (p.units || [{ loc: null, text: p.text || '' }])) for (const r of extractFromText(u.text || '', p.page)) { // `units`: a Word file is read by paragraph / table row, so evidence can name the LOCATION
      if (r.kind === 'order_no') { docOrderNos.push(r.value); continue; }
      if (!isInvoiceKind(r.kind)) { others.push({ ...r, loc: u.loc }); continue; }
      const k = refKey(r.kind, r.value);
      if (!refs.has(k)) refs.set(k, { kind: r.kind, value: r.value, occurrences: [] });
      refs.get(k).occurrences.push({ page: r.page, loc: u.loc || null, snippet: r.snippet, raw: r.raw });
    }
  }
  docOrderNos = [...new Set(docOrderNos)];
  const stated = pages.map((p) => documentStatedAmount(p.text || '')).find((x) => x != null) ?? null;
  return {
    method, format, exactPages, simulation, pages: pageInfo, refs: [...refs.values()], others: dedupeOthers(others), orderNumbersInDocument: docOrderNos,
    orderNumberMismatch: !!(orderNo && docOrderNos.length && !docOrderNos.includes(String(orderNo).toUpperCase())),
    statedAmount: stated, extractedAt: new Date().toISOString()
  };
}
function dedupeOthers(list) {
  const m = new Map();
  for (const r of list) { const k = refKey(r.kind, r.value); if (!m.has(k)) m.set(k, { kind: r.kind, value: r.value, label: r.label, pages: [], locs: [], snippet: r.snippet }); const e = m.get(k); if (!e.pages.includes(r.page)) e.pages.push(r.page); if (r.loc && !e.locs.includes(r.loc)) e.locs.push(r.loc); }
  return [...m.values()];
}

// pages of a text blob pasted/imported from an OCR tool: split on form feeds or «--- page N ---» / «Page N» marker lines
export function splitOcrText(text) {
  const s = String(text || '');
  let parts = s.split(/\f/);
  if (parts.length === 1) {
    const idx = [...s.matchAll(/^\s*[-=—\s]*(?:page|صفحة)\s*(\d+)\s*(?:of\s*\d+)?[-=—\s]*$/gim)];
    if (idx.length) {
      parts = []; for (let k = 0; k < idx.length; k += 1) parts.push(s.slice(idx[k].index + idx[k][0].length, k + 1 < idx.length ? idx[k + 1].index : s.length));
    }
  }
  return parts.map((t, i) => ({ page: i + 1, text: t, hasTextLayer: true })).filter((p) => p.text.trim() || parts.length === 1);
}

/* ------------------------------------------------------------------ the references an order carries, and how they resolved */
// Sanad's structured references + every document extraction (one record per distinct reference, with where it came from)
// The free-text fields of a Sanad record in which people type invoice numbers (human data entry): the description and the notes.
export const ORDER_TEXT_FIELDS = ['description', 'notes'];
const FIELD_ORIGIN = { description: 'sanad_description', notes: 'sanad_notes' };
export function orderTextRefs(order) {
  const out = [];
  for (const field of ORDER_TEXT_FIELDS) { const text = order?.[field]; if (!text) continue; for (const r of extractFromText(text, 1)) out.push({ ...r, field, origin: FIELD_ORIGIN[field] }); }
  return out;
}

// EVERY source is read — never "the first match wins": the structured invoice-reference field, the description, the notes and every attached document (each page, each table).
// One record per distinct reference (the canonical value; the text as originally typed is kept in each origin) with every place it was found.
export function collectReferences(order, docs = []) {
  const m = new Map();
  const add = (kind, value, origin) => {
    const k = refKey(kind, value);
    if (!m.has(k)) m.set(k, { key: k, kind, value: String(value).trim(), origins: [] });
    m.get(k).origins.push(origin);
  };
  for (const r of order.refs || []) add(r.kind, r.value, { type: 'sanad_structured', field: 'invoice_reference', raw: String(r.value) });
  for (const r of orderTextRefs(order)) if (isInvoiceKind(r.kind)) add(r.kind, r.value, { type: r.origin, field: r.field, raw: r.raw, snippet: r.snippet });
  for (const d of docs) for (const r of d.extraction?.refs || []) {
    const byMethod = new Map(); // text found by the PDF reader, by imported OCR text, or typed by a person are different kinds of evidence
    for (const o of r.occurrences) { const mm = o.via || d.extraction.method; if (!byMethod.has(mm)) byMethod.set(mm, []); byMethod.get(mm).push(o); }
    for (const [mm, occ] of byMethod) add(r.kind, r.value, { type: `document_${mm}`, docId: d.id, docName: d.name, pages: d.extraction.exactPages === false ? [] : [...new Set(occ.map((o) => o.page))], locs: [...new Set(occ.map((o) => o.loc).filter(Boolean))], snippet: occ[0]?.snippet, raw: occ[0]?.raw || r.value });
  }
  return [...m.values()];
}

// CONTRACT numbers are kept apart from invoice references. A number MENTIONED in the description or a document is only a mention; a direct referral of the contract
// is established by the structured source (Sanad's contract field) or by a REVIEWED document / description mention.
export function contractMentions(order, docs = []) {
  const m = new Map();
  const add = (no, origin) => { const k = String(no).toUpperCase(); if (!m.has(k)) m.set(k, { contractNo: k, origins: [] }); m.get(k).origins.push(origin); };
  if (order.contractNo) add(order.contractNo, { type: 'sanad_structured', field: 'contract_number' });
  for (const r of orderTextRefs(order)) if (r.kind === 'contract_no') add(r.value, { type: r.origin, field: r.field, snippet: r.snippet });
  for (const d of docs) for (const o of d.extraction?.others || []) if (o.kind === 'contract_no') add(o.value, { type: `document_${d.extraction.method}`, docId: d.id, docName: d.name, pages: d.extraction.exactPages === false ? [] : o.pages || [], locs: o.locs || [], snippet: o.snippet });
  return [...m.values()].map((c) => {
    const review = order.contractReviews?.[c.contractNo] || null;
    const structured = c.origins.some((o) => o.type === 'sanad_structured');
    const status = structured ? 'supported_by_source' : review?.decision === 'confirmed' ? 'confirmed_by_review' : review?.decision === 'rejected' ? 'rejected' : 'mentioned';
    return { ...c, structured, review, status, direct: status === 'supported_by_source' || status === 'confirmed_by_review' };
  });
}

export const ORIGIN_LABEL = {
  sanad_structured: { en: 'Sanad structured field', ar: 'حقل سند المهيكل' },
  sanad_description: { en: 'Sanad description (free text)', ar: 'وصف سند (نص حر)' },
  sanad_notes: { en: 'Sanad notes (free text)', ar: 'ملاحظات سند (نص حر)' },
  document_docx_text: { en: 'Word document (paragraphs and tables, read by this system)', ar: 'مستند Word (الفقرات والجداول، قرأها النظام)' },
  document_ocr_simulated: { en: 'OCR simulation — demo only (prepared sample)', ar: 'محاكاة OCR — للعرض التجريبي (عينة معدّة)' },
  document_ocr_system: { en: 'OCR engine of this system (not connected)', ar: 'محرك OCR في هذا النظام (غير متصل)' },
  document_text_layer: { en: 'Order PDF (text layer)', ar: 'ملف الأمر (طبقة النص)' },
  document_ocr_import: { en: 'Order document (OCR text imported)', ar: 'مستند الأمر (نص OCR مستورد)' },
  document_manual_entry: { en: 'Order document (typed by a person)', ar: 'مستند الأمر (أدخله شخص)' },
  manual_selection: { en: 'Chosen by a reviewer', ar: 'اختيار المراجع' }
};

// Conflicts between a reference and the data. Two kinds:
//  * HARD conflicts make the link unacceptable AS IT STANDS. A written reason does NOT resolve them: they are resolved only by SUPPORTING EVIDENCE
//    (see `buildRows`: another reference that identifies exactly one candidate; a document that names the payer's identity number), otherwise the link stays unresolved.
//  * WARNINGS are shown next to the link but do not block it (an invoice may legitimately carry several orders, be already collected, etc.).
export function conflictsFor(order, cand, { otherOrders = [], weak = false, ambiguous = false, docMismatch = false } = {}) {
  const c = [];
  if (order.debtorIdx != null && cand.payerIdx != null && order.debtorIdx !== cand.payerIdx) c.push('debtor_mismatch');
  if (order.amanahEn && cand.amanahEn && order.amanahEn !== cand.amanahEn) c.push('amanah_mismatch');
  if (order.openedDate && cand.issueDate && cand.issueDate > order.openedDate) c.push('invoice_issued_after_order');
  if (docMismatch) c.push('document_other_order');
  if (ambiguous) c.push('ambiguous_reference');
  if (otherOrders.length) c.push('linked_to_other_order');
  if (cand.cancelled || cand.sourceCancelled) c.push('invoice_cancelled'); else if (cand.excluded) c.push('invoice_excluded'); else if (cand.paymentStatus === 'collected') c.push('invoice_collected');
  if (weak && !ambiguous) c.push('weak_reference');
  return c;
}
export const HARD_CONFLICTS = new Set(['debtor_mismatch', 'amanah_mismatch', 'invoice_issued_after_order', 'document_other_order', 'ambiguous_reference']);
export const isHardConflict = (x) => HARD_CONFLICTS.has(x);
// the hard conflicts still standing after the evidence that resolves some of them (`resolved`: [{ conflict, by, evidence }])
export const unresolvedConflicts = (conflicts = [], resolved = []) => conflicts.filter((x) => HARD_CONFLICTS.has(x) && !resolved.some((r) => r.conflict === x));

// server results (one per reference) → rows for display, with duplicates distinguished and hard conflicts resolved ONLY by evidence
export function buildRows(order, refs, results, links, otherOrdersByInvoice = new Map(), mismatchedDocs = new Set(), docs = []) {
  const byKey = new Map(results.map((r) => [refKey(r.ref.kind, r.ref.value), r]));
  const firstSeen = new Map();
  const rows = [];
  for (const ref of refs) {
    const res = byKey.get(ref.key);
    const status = !isInvoiceKind(ref.kind) ? 'not_invoice_reference' : !res ? 'pending' : res.status;
    const row = { ...ref, status, weak: !!res?.weak, normalized: res?.normalized || null, candidates: res?.candidates || [], duplicateOf: null, resolvedBy: null, conflicts: {}, resolved: {}, unresolved: {} };
    if (status === 'matched') {
      const id = row.candidates[0].invoiceId;
      if (firstSeen.has(id)) { row.status = 'duplicate_reference'; row.duplicateOf = firstSeen.get(id); } else firstSeen.set(id, ref.value);
    }
    rows.push(row);
  }
  // an ambiguous reference (a bare serial that exists in several years) is settled ONLY when another reference of the same order identifies exactly one of its candidates
  for (const row of rows) {
    if (row.status !== 'ambiguous') continue;
    const hit = rows.find((r) => r !== row && (r.status === 'matched' || r.status === 'duplicate_reference') && !r.weak && row.candidates.some((c) => c.invoiceId === r.candidates[0].invoiceId));
    if (hit) { row.candidates = row.candidates.filter((c) => c.invoiceId === hit.candidates[0].invoiceId); row.status = 'resolved_by_reference'; row.resolvedBy = hit.value; row.duplicateOf = hit.value; }
  }
  // identity numbers the order documents name (payer / debtor ids) with where they were read
  const idEvidence = new Map();
  for (const d of docs) for (const o of d.extraction?.others || []) { if (o.label !== 'person' && !/^\d{10}$/.test(o.value)) continue; if (!idEvidence.has(o.value)) idEvidence.set(o.value, []); idEvidence.get(o.value).push({ docId: d.id, docName: d.name, pages: o.pages || [] }); }
  for (const row of rows) {
    const docOnlyMismatch = row.origins.length > 0 && row.origins.every((o) => o.docId && mismatchedDocs.has(o.docId));
    for (const c of row.candidates) {
      const conflicts = conflictsFor(order, c, { otherOrders: otherOrdersByInvoice.get(c.invoiceId) || [], weak: row.weak, ambiguous: row.status === 'ambiguous', docMismatch: docOnlyMismatch });
      const resolved = [];
      if (conflicts.includes('debtor_mismatch') && c.payerId && idEvidence.has(c.payerId)) resolved.push({ conflict: 'debtor_mismatch', by: 'document_names_payer', evidence: { value: c.payerId, ...idEvidence.get(c.payerId)[0] } });
      row.conflicts[c.invoiceId] = conflicts; row.resolved[c.invoiceId] = resolved; row.unresolved[c.invoiceId] = unresolvedConflicts(conflicts, resolved);
    }
    const linkIds = row.candidates.map((c) => c.invoiceId);
    row.link = links.find((l) => linkIds.includes(l.invoiceId) && l.status !== 'rejected') || null;
    row.rejected = !row.link && links.some((l) => linkIds.includes(l.invoiceId) && l.status === 'rejected');
  }
  return rows;
}

/* ------------------------------------------------------------------ reconciliation and the order's match state */
const live = (c) => (c.links || []).filter((l) => l.status === 'confirmed' || l.status === 'candidate');
export function reconcile(order) {
  const conf = (order.links || []).filter((l) => l.status === 'confirmed'); const prop = (order.links || []).filter((l) => l.status === 'candidate');
  const amt = (l) => (l.gross != null ? l.gross : l.allocated != null ? l.allocated : null);
  const known = (list) => list.every((l) => amt(l) != null);
  const sum = (list) => list.reduce((s, l) => s + (amt(l) || 0), 0);
  const confirmedTotal = conf.length ? (known(conf) ? sum(conf) : null) : 0;
  const proposedTotal = prop.length ? (known(prop) ? sum(prop) : null) : 0;
  const diff = confirmedTotal == null ? null : order.amount - confirmedTotal;
  let state;
  if (!conf.length && !prop.length) state = 'none';
  else if (confirmedTotal == null) state = 'unknown';
  else if (!conf.length) state = 'unconfirmed';
  else if (Math.abs(diff) <= AMOUNT_TOLERANCE) state = 'reconciled';
  else state = diff > 0 ? 'short' : 'over';
  const withProposed = confirmedTotal != null && proposedTotal != null ? order.amount - (confirmedTotal + proposedTotal) : null;
  return { orderAmount: order.amount, confirmedCount: conf.length, proposedCount: prop.length, confirmedTotal, proposedTotal, difference: diff, differenceIfProposedConfirmed: withProposed, wouldReconcile: withProposed != null && Math.abs(withProposed) <= AMOUNT_TOLERANCE && prop.length > 0, state };
}

// invoice references of the order that no link (or decision) accounts for — from Sanad and from the recorded document extractions
export function unresolvedReferences(order) {
  const accounted = new Set();
  for (const l of order.links || []) {
    accounted.add(`id|${l.invoiceId}`);
    for (const e of l.evidence || []) if (e?.refKind) accounted.add(refKey(e.refKind, e.refValue));
  }
  const dismissed = new Set(order.dismissedRefs || []);
  const out = [];
  for (const r of collectReferences(order, order.docs || [])) {
    if (!isInvoiceKind(r.kind)) continue;
    if (accounted.has(r.key) || accounted.has(`id|${r.value.toUpperCase()}`) || dismissed.has(r.key)) continue;
    out.push(r);
  }
  return out;
}
export const documentGaps = (order) => (order.docs || []).flatMap((d) => (d.extraction?.pages || []).filter((p) => p.needsOcr && !(d.ocrCovered || []).includes(p.page)).map((p) => ({ docId: d.id, docName: d.name, page: p.page })));

// THREE separate completeness states — never merged into one label:
//   references  : are all the invoice references found accounted for (confirmed link / recorded decision) and no proposal pending?   (amount equality is NOT required)
//   extraction  : was every page of the order document(s) read (text layer, or text supplied for unread pages)?
//   finance     : do the invoices matched BY REFERENCE add up to the order amount?  (a difference is reported, never closed by inventing a link)
export function orderCompleteness(order) {
  const rec = reconcile(order); const unresolved = unresolvedReferences(order); const gaps = documentGaps(order); const docs = order.docs || [];
  const total = collectReferences(order, docs).filter((r) => isInvoiceKind(r.kind)).length;
  const all = collectReferences(order, docs).filter((r) => isInvoiceKind(r.kind)); const bySource = (t) => all.filter((r) => r.origins.some((o) => o.type === t)).length;
  const sources = { structured: bySource('sanad_structured'), description: bySource('sanad_description'), notes: bySource('sanad_notes'), documents: all.filter((r) => r.origins.some((o) => o.docId)).length, hasDescription: !!String(order.description || '').trim(), hasNotes: !!String(order.notes || '').trim(), attachmentsListed: (order.attachments || []).length, documentsAdded: docs.length };
  // «complete» = every reference FOUND (in any source) is decided. It does NOT prove that every invoice covered by the order was found: extraction and reconciliation say whether anything may be missing.
  const references = { total, unresolved: unresolved.length, proposed: rec.proposedCount, confirmedLinks: rec.confirmedCount, sources, state: !total && !rec.confirmedCount && !rec.proposedCount ? 'none' : unresolved.length || rec.proposedCount ? 'incomplete' : 'complete' };
  const suppliedPages = docs.reduce((n, d) => n + (d.ocrCovered || []).length, 0); // pages whose text was supplied from outside (imported OCR) or typed — not read by this system
  const attachmentsPending = Math.max(0, (order.attachments || []).length - docs.length); // listed by Sanad, not yet added here (retrieval is not connected)
  const extraction = { documents: docs.length, unreadPages: gaps.length, suppliedPages, attachmentsPending, state: attachmentsPending && !gaps.length && docs.length ? 'incomplete' : !docs.length ? 'no_document' : gaps.length ? 'incomplete' : 'complete' };
  const finance = { state: { none: 'no_links', unconfirmed: 'no_confirmed', unknown: 'not_checkable', reconciled: 'reconciled', short: 'short', over: 'over' }[rec.state], difference: rec.difference, confirmedTotal: rec.confirmedTotal, orderAmount: order.amount, proposedTotal: rec.proposedTotal, wouldReconcile: rec.wouldReconcile };
  return { references, extraction, finance, unresolved, gaps, reconciliation: rec };
}

// legacy single summary kept for older callers (insights, analysis tasks): `matched` only if all three are complete — it is never shown as a label
export function orderMatchState(order) {
  const comp = orderCompleteness(order); const rec = comp.reconciliation;
  const reasons = [];
  if (rec.proposedCount) reasons.push('proposed_unconfirmed');
  if (comp.unresolved.length) reasons.push('unresolved_references');
  if (comp.gaps.length) reasons.push('document_pages_unread');
  if (rec.state === 'short' || rec.state === 'over') reasons.push(rec.state === 'short' ? 'amount_short' : 'amount_over');
  if (rec.state === 'unknown') reasons.push('amount_not_checkable');
  let state;
  if (!rec.confirmedCount && !rec.proposedCount) state = 'unmatched';
  else if (!rec.confirmedCount) state = 'awaiting_review';
  else state = reasons.length ? 'partial' : 'matched';
  return { state, reasons, reconciliation: rec, unresolved: comp.unresolved, gaps: comp.gaps, completeness: comp };
}

/* ------------------------------------------------------------------ effective cases = Sanad/anchor base + the user's overlay */
const LINK_STATUS_OUT = { proposed: 'candidate', confirmed: 'confirmed', rejected: 'rejected', removed: 'rejected' };
export const emptyStore = () => ({ v: 1, orders: {}, enf1: {} });
const ord = (store, en) => store.orders[en] || { links: {}, docs: {}, history: [], dismissedRefs: [], contractReviews: {}, statusSeen: null };

export function buildEffectiveCases(baseCases, store) {
  return baseCases.map((c) => {
    const o = store?.orders?.[c.enforceNum];
    const base = (c.links || []).map((l) => ({ ...l, origin: l.origin || (l.reviewedBy ? 'sanad_structured' : 'sanad_structured'), appliedStatus: orderStatusOf(c) }));
    const merged = new Map(base.map((l) => [l.invoiceId, l]));
    if (o) for (const l of Object.values(o.links)) merged.set(l.invoiceId, { ...l, status: LINK_STATUS_OUT[l.status] || l.status, ledgerStatus: l.status, appliedStatus: l.status === 'confirmed' ? orderStatusOf(c) : null });
    const eff = { ...c, orderStatus: orderStatusOf(c), links: [...merged.values()], docs: o ? Object.values(o.docs) : [], dismissedRefs: o?.dismissedRefs || [], contractReviews: o?.contractReviews || {}, history: [...(o?.history || []), ...(c.history || [])], hasUserWork: !!o };
    eff.contractFacts = contractMentions(eff, eff.docs); // contract numbers mentioned / directly referred, with their review status
    return eff;
  });
}

export function otherOrdersByInvoice(cases, exceptEn) {
  const m = new Map();
  for (const c of cases) if (c.enforceNum !== exceptEn) for (const l of c.links || []) if (l.status === 'confirmed' || l.status === 'candidate') { if (!m.has(l.invoiceId)) m.set(l.invoiceId, []); m.get(l.invoiceId).push({ enforceNum: c.enforceNum, status: l.status, orderStatus: orderStatusOf(c) }); }
  return m;
}

/* ------------------------------------------------------------------ the lifecycle (pure reducers over the store) */
const hist = (o, entry) => ({ ...o, history: [entry, ...o.history] });
const put = (store, en, o) => ({ ...store, orders: { ...store.orders, [en]: o } });
// when the order's own status differs from the last one this record saw, say so before anything else is logged
function noteOrderStatus(o, currentStatus, at, by) {
  if (!currentStatus) return o;
  if (o.statusSeen && o.statusSeen !== currentStatus) o = hist(o, { at, by, action: 'order_status_changed', detail: { from: o.statusSeen, to: currentStatus, invoices: Object.values(o.links).filter((l) => l.status === 'confirmed').map((l) => l.invoiceId) } });
  return { ...o, statusSeen: currentStatus };
}

export function recordDocument(store, en, doc, { by, at, orderStatus }) {
  let o = noteOrderStatus(ord(store, en), orderStatus, at, by);
  const prev = o.docs[doc.id];
  o = { ...o, docs: { ...o.docs, [doc.id]: { ...(prev || {}), ...doc, ocrCovered: doc.ocrCovered || prev?.ocrCovered || [] } } };
  o = hist(o, { at, by, action: prev ? 'extraction_updated' : 'document_added', detail: { docId: doc.id, name: doc.name, method: doc.extraction?.method, pages: doc.extraction?.pages?.length ?? null, invoiceReferences: doc.extraction?.refs?.length ?? 0, sha256: doc.id } });
  return { store: put(store, en, o), error: null };
}

// add the OCR/manual text of pages the text layer could not read to an existing document record
export function recordSupplementalExtraction(store, en, docId, extraction, { by, at, orderStatus }) {
  const o0 = ord(store, en); const d = o0.docs[docId]; if (!d) return { store, error: 'document_not_found' };
  let o = noteOrderStatus(o0, orderStatus, at, by);
  const seen = new Map((d.extraction?.refs || []).map((r) => [refKey(r.kind, r.value), { ...r, occurrences: [...r.occurrences] }]));
  for (const r of extraction.refs) { const k = refKey(r.kind, r.value); if (!seen.has(k)) seen.set(k, { kind: r.kind, value: r.value, occurrences: [] }); seen.get(k).occurrences.push(...r.occurrences.map((x) => ({ ...x, via: extraction.method }))); }
  const covered = [...new Set([...(d.ocrCovered || []), ...extraction.pages.map((p) => p.page)])];
  const supplements = [...(d.supplements || []), { method: extraction.method, at, by, pages: extraction.pages.map((p) => p.page), refs: extraction.refs.length }];
  o = { ...o, docs: { ...o.docs, [docId]: { ...d, extraction: { ...d.extraction, refs: [...seen.values()] }, ocrCovered: covered, supplements } } };
  o = hist(o, { at, by, action: 'supplemental_extraction', detail: { docId, method: extraction.method, pages: extraction.pages.map((p) => p.page), invoiceReferences: extraction.refs.length } });
  return { store: put(store, en, o), error: null };
}

// References typed by a person (no file): one pseudo-document «manual-entry» per order that accumulates them; method manual_entry, never mixed with any extraction.
export const MANUAL_DOC_ID = 'manual-entry';
export function recordManualReferences(store, en, extraction, { by, at, orderStatus }) {
  let o = noteOrderStatus(ord(store, en), orderStatus, at, by); const prev = o.docs[MANUAL_DOC_ID];
  const seen = new Map((prev?.extraction?.refs || []).map((r) => [refKey(r.kind, r.value), { ...r, occurrences: [...r.occurrences] }]));
  for (const r of extraction.refs) { const k = refKey(r.kind, r.value); if (!seen.has(k)) seen.set(k, { kind: r.kind, value: r.value, occurrences: [] }); seen.get(k).occurrences.push(...r.occurrences); }
  const doc = { ...(prev || { id: MANUAL_DOC_ID, name: 'manual-entry', size: 0, kind: 'manual', format: 'manual', addedAt: at, fileStored: false }), extraction: { ...extraction, refs: [...seen.values()] } };
  o = { ...o, docs: { ...o.docs, [MANUAL_DOC_ID]: doc } };
  o = hist(o, { at, by, action: 'manual_references_added', detail: { references: extraction.refs.map((r) => r.value), method: 'manual_entry' } });
  return { store: put(store, en, o), error: null };
}

// proposal: no effect on any invoice. A confirmed/removed link is never silently overwritten by a re-proposal.
export function proposeLink(store, en, input, { by, at, orderStatus }) {
  const o0 = ord(store, en); const ex = o0.links[input.invoiceId];
  if (ex && (ex.status === 'confirmed' || ex.status === 'proposed')) return { store, error: null, unchanged: true };
  let o = noteOrderStatus(o0, orderStatus, at, by);
  const link = { invoiceId: input.invoiceId, status: 'proposed', origin: input.origin, evidence: input.evidence || [], conflicts: input.conflicts || [], resolvedConflicts: input.resolvedConflicts || [], gross: input.gross ?? null, snapshot: input.snapshot || null, proposedAt: at, proposedBy: by };
  o = { ...o, links: { ...o.links, [input.invoiceId]: link } };
  o = hist(o, { at, by, action: 'proposed', invoiceId: input.invoiceId, detail: { origin: input.origin, evidence: link.evidence, conflicts: link.conflicts } });
  return { store: put(store, en, o), error: null };
}

export function confirmLink(store, en, invoiceId, { by, at, note = '', orderStatus, input = null }) {
  const o0 = ord(store, en); let ex = o0.links[invoiceId];
  if (!ex && input) ex = { invoiceId, status: 'proposed', origin: input.origin, evidence: input.evidence || [], conflicts: input.conflicts || [], resolvedConflicts: input.resolvedConflicts || [], gross: input.gross ?? null, snapshot: input.snapshot || null, proposedAt: at, proposedBy: by };
  if (!ex) return { store, error: 'not_found' };
  if (input) ex = { ...ex, conflicts: input.conflicts || ex.conflicts, gross: input.gross ?? ex.gross, snapshot: input.snapshot || ex.snapshot }; // the conflicts as they stand NOW decide whether a reason is needed
  if (ex.status === 'confirmed') return { store, error: null, unchanged: true };
  if (input?.resolvedConflicts) ex = { ...ex, resolvedConflicts: input.resolvedConflicts };
  // a written reason never makes a conflicting link acceptable: every HARD conflict must be resolved by supporting evidence, otherwise the link stays unresolved
  if (unresolvedConflicts(ex.conflicts, ex.resolvedConflicts).length) return { store, error: 'unresolved_conflict', conflicts: unresolvedConflicts(ex.conflicts, ex.resolvedConflicts) };
  let o = noteOrderStatus(o0, orderStatus, at, by);
  const link = { ...ex, status: 'confirmed', reviewedBy: by, reviewedAt: at, reviewNote: String(note).trim(), appliedStatus: orderStatus || null };
  o = { ...o, links: { ...o.links, [invoiceId]: link } };
  o = hist(o, { at, by, action: 'confirmed', invoiceId, detail: { origin: link.origin, evidence: link.evidence, conflicts: link.conflicts, resolvedConflicts: link.resolvedConflicts || [], appliedOrderStatus: orderStatus || null, note: link.reviewNote } });
  return { store: put(store, en, o), error: null };
}

export function rejectLink(store, en, invoiceId, { by, at, note = '', orderStatus, input = null }) {
  const o0 = ord(store, en); let ex = o0.links[invoiceId];
  if (!ex && input) ex = { invoiceId, status: 'proposed', origin: input.origin, evidence: input.evidence || [], conflicts: input.conflicts || [], resolvedConflicts: input.resolvedConflicts || [], gross: input.gross ?? null, snapshot: input.snapshot || null, proposedAt: at, proposedBy: by };
  if (!ex) return { store, error: 'not_found' };
  if (ex.status === 'confirmed') return { store, error: 'use_remove' };
  let o = noteOrderStatus(o0, orderStatus, at, by);
  o = { ...o, links: { ...o.links, [invoiceId]: { ...ex, status: 'rejected', reviewedBy: by, reviewedAt: at, reviewNote: String(note).trim() } } };
  o = hist(o, { at, by, action: 'rejected', invoiceId, detail: { note: String(note).trim() } });
  return { store: put(store, en, o), error: null };
}

// withdrawing a confirmed link removes its effect on the invoice; a reason is always required and the history keeps it
export function removeLink(store, en, invoiceId, { by, at, note = '', orderStatus, base = null }) {
  const o0 = ord(store, en); let ex = o0.links[invoiceId];
  // a link that came from Sanad's structured data (not from this person's work) can be withdrawn too: the withdrawal is recorded over it
  if (!ex && base) ex = { invoiceId, status: 'confirmed', origin: 'sanad_structured', evidence: [{ refKind: 'invoice_no', refValue: invoiceId, origin: 'sanad_structured' }], conflicts: [], gross: base.gross ?? null, appliedStatus: orderStatus || null };
  if (!ex || ex.status !== 'confirmed') return { store, error: 'not_confirmed' };
  if (!String(note).trim()) return { store, error: 'note_required' };
  let o = noteOrderStatus(o0, orderStatus, at, by);
  o = { ...o, links: { ...o.links, [invoiceId]: { ...ex, status: 'removed', removedBy: by, removedAt: at, removeNote: String(note).trim() } } };
  o = hist(o, { at, by, action: 'removed', invoiceId, detail: { note: String(note).trim(), wasAppliedStatus: ex.appliedStatus || null } });
  return { store: put(store, en, o), error: null };
}

// the user decided that a reference in the document is not an invoice of this order (kept, with a reason)
export function dismissReference(store, en, key, { by, at, note = '', orderStatus }) {
  let o = noteOrderStatus(ord(store, en), orderStatus, at, by);
  o = { ...o, dismissedRefs: [...new Set([...(o.dismissedRefs || []), key])] };
  o = hist(o, { at, by, action: 'reference_dismissed', detail: { key, note: String(note).trim() } });
  return { store: put(store, en, o), error: null };
}

/* ------------------------------------------------------------------ store shape check (backup import) */
export function validStoreShape(v) {
  if (v == null) return true;
  if (typeof v !== 'object' || Array.isArray(v) || v.v !== 1 || !v.orders || typeof v.orders !== 'object') return false;
  return Object.values(v.orders).every((o) => o && typeof o === 'object' && o.links && typeof o.links === 'object' && !Array.isArray(o.links) && Array.isArray(o.history) && (o.docs == null || (typeof o.docs === 'object' && !Array.isArray(o.docs))) && Object.values(o.links).every((l) => l && typeof l.invoiceId === 'string' && ['proposed', 'confirmed', 'rejected', 'removed'].includes(l.status)));
}

void live;

// the original PDF was added again (after a restore, or on another browser): recorded in the history. The caller has ALREADY checked that the file's SHA-256 equals the record's id.
export function recordFileRestored(store, en, docId, { by, at, orderStatus, name }) {
  const o0 = ord(store, en); const d = o0.docs[docId]; if (!d) return { store, error: 'document_not_found' };
  let o = noteOrderStatus(o0, orderStatus, at, by);
  o = { ...o, docs: { ...o.docs, [docId]: { ...d, fileRestoredAt: at, fileStored: true } } };
  o = hist(o, { at, by, action: 'document_file_restored', detail: { docId, name: name || d.name, sha256: docId } });
  return { store: put(store, en, o), error: null };
}

// The matching-review EXCEPTIONS of an order: what a person still has to look at. An order can carry several (counted once per type).
export const EXCEPTION_TYPES = ['no_references', 'unresolved_references', 'proposals_pending', 'conflicts', 'attachments_not_retrieved', 'unread_pages', 'amount_difference', 'contract_mention_unreviewed', 'contract_level_only'];
export function orderExceptions(order) {
  const comp = orderCompleteness(order); const out = [];
  const contractLevel = !!order.contractNo && !(order.refs || []).length && !(order.links || []).length;
  if (contractLevel) out.push('contract_level_only');
  else if (comp.references.state === 'none') out.push('no_references');
  if (comp.references.unresolved > 0) out.push('unresolved_references');
  if (comp.extraction.attachmentsPending > 0) out.push('attachments_not_retrieved');
  if (contractMentions(order, order.docs || []).some((c) => c.status === 'mentioned')) out.push('contract_mention_unreviewed');
  if (comp.references.proposed > 0) out.push('proposals_pending');
  if ((order.links || []).some((l) => l.status === 'candidate' && unresolvedConflicts(l.conflicts, l.resolvedConflicts).length)) out.push('conflicts');
  if (comp.extraction.state === 'incomplete') out.push('unread_pages');
  if (comp.finance.state === 'short' || comp.finance.state === 'over') out.push('amount_difference');
  return out;
}


// An invoice cancelled in the source that a confirmed enforcement link refers to: a REVIEWER records whether the documented rule ENF-1 (counted uncollected instead of cancelled) is applied,
// or the source cancellation stands. Nothing is applied automatically, and no order event (confirmation, closure, withdrawal) ever changes an amount by itself. (Open business question: EQ3.)
export function decideEnf1(store, invoiceId, { decision, note = '', by, at }) {
  if (!['apply', 'keep_cancelled', 'clear'].includes(decision)) return { store, error: 'bad_decision' };
  const enf1 = { ...(store.enf1 || {}) };
  if (decision === 'clear') delete enf1[invoiceId]; else enf1[invoiceId] = { decision, note: String(note).trim(), by, at };
  const hist = [...(store.enf1History || []), { invoiceId, decision, note: String(note).trim(), by, at }];
  return { store: { ...store, enf1, enf1History: hist }, error: null };
}

// A reviewer decides whether a contract number MENTIONED in the description or a document is a direct referral of that contract. The structured field never needs this;
// a mention alone never establishes a referral. `exists` = the contract number exists in the data (checked by the caller); a number that does not exist cannot be confirmed.
export function reviewContractReference(store, en, contractNo, { decision, note = '', evidence = null, by, at, orderStatus, exists = false }) {
  if (!['confirmed', 'rejected'].includes(decision)) return { store, error: 'bad_decision' };
  if (decision === 'confirmed' && !exists) return { store, error: 'contract_not_found' };
  // a document that merely NAMES an existing contract is not enough: the reviewer must point at the document location AND record that it explicitly states the contract itself is referred, with the statement
  if (decision === 'confirmed' && !(evidence && evidence.docId)) return { store, error: 'evidence_required' };
  if (decision === 'confirmed' && !(evidence.statedExplicitly === true && String(evidence.quote || '').trim().length >= 5)) return { store, error: 'explicit_statement_required' };
  let o = noteOrderStatus(ord(store, en), orderStatus, at, by);
  o = { ...o, contractReviews: { ...(o.contractReviews || {}), [contractNo]: { decision, note: String(note).trim(), evidence, by, at } } };
  o = hist(o, { at, by, action: decision === 'confirmed' ? 'contract_reference_confirmed' : 'contract_reference_rejected', detail: { contractNo, evidence, note: String(note).trim() } });
  return { store: put(store, en, o), error: null };
}
