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
export const ORDER_STATUS = { 'قيد التنفيذ': 'open', 'موقوف': 'suspended', 'مغلق': 'closed' };
export const orderStatusOf = (c) => ORDER_STATUS[c?.requestStatus] || 'open'; // hand-anchored cases carry no status: they were treated as in execution
export const STATUS_RANK = { open: 3, suspended: 2, closed: 1 };

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
const toLatinDigits = (s) => String(s).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
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
    take(/\bSA\d{22}\b/gi, (m) => out.push({ kind: 'bank_account', value: m[0].toUpperCase(), label: 'IBAN', page, snippet: clip(line) }));
    take(/\bINV-\d{4}-\d{1,7}\b/gi, (m) => out.push({ kind: 'invoice_no', value: m[0].toUpperCase(), label: 'pattern', page, snippet: clip(line) }));
    take(/\b(?:EN|WLX)-\d{4,8}\b/gi, (m) => out.push({ kind: 'order_no', value: m[0].toUpperCase(), label: 'pattern', page, snippet: clip(line) }));
    take(/\b(?:CT|CNT)-\d{4}-\d{3,6}\b|\bCO-\d{4,6}\b/gi, (m) => out.push({ kind: 'contract_no', value: m[0].toUpperCase(), label: 'pattern', page, snippet: clip(line) }));
    take(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?![\d])|(?<![\d.,])\d+\.\d{1,2}(?![\d])/g, () => {}); // amounts: consumed, never a reference
    take(/(?<![\d.,-])\d{7,16}(?![\d])/g, (m) => {
      const v = m[0]; const nonInv = NON_INVOICE_LABELS.find(hasLabel); const inv = hasLabel('invoice') || hasLabel('sadad') || hasLabel('violation') || section === 'invoice' || section === 'sadad' || section === 'violation';
      let kind = 'other_number'; let label = nonInv || 'unlabelled';
      if (v.length === 12 && !(nonInv && !hasLabel('sadad') && !hasLabel('invoice'))) { kind = 'sadad_no'; label = 'sadad'; }
      else if (v.length === 14 && !(nonInv && !hasLabel('violation') && !hasLabel('invoice'))) { kind = 'violation_no'; label = 'violation'; }
      else if (v.length === 7 && !nonInv && (hasLabel('invoice') || (inv && v.startsWith('0')))) { kind = 'invoice_serial'; label = 'invoice'; } // a bare 7-digit amount under an «Invoice» heading is not taken for a serial
      out.push({ kind, value: v, label, page, snippet: clip(line) });
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
export function buildExtraction(pages, method, { orderNo = null } = {}) {
  const refs = new Map();
  const others = [];
  let docOrderNos = [];
  const pageInfo = pages.map((p) => ({ page: p.page, chars: String(p.text || '').trim().length, textLayer: p.hasTextLayer !== false, needsOcr: method === 'text_layer' && String(p.text || '').trim().length < 10 }));
  for (const p of pages) {
    for (const r of extractFromText(p.text || '', p.page)) {
      if (r.kind === 'order_no') { docOrderNos.push(r.value); continue; }
      if (!isInvoiceKind(r.kind)) { others.push(r); continue; }
      const k = refKey(r.kind, r.value);
      if (!refs.has(k)) refs.set(k, { kind: r.kind, value: r.value, occurrences: [] });
      refs.get(k).occurrences.push({ page: r.page, snippet: r.snippet });
    }
  }
  docOrderNos = [...new Set(docOrderNos)];
  const stated = pages.map((p) => documentStatedAmount(p.text || '')).find((x) => x != null) ?? null;
  return {
    method, pages: pageInfo, refs: [...refs.values()], others: dedupeOthers(others), orderNumbersInDocument: docOrderNos,
    orderNumberMismatch: !!(orderNo && docOrderNos.length && !docOrderNos.includes(String(orderNo).toUpperCase())),
    statedAmount: stated, extractedAt: new Date().toISOString()
  };
}
function dedupeOthers(list) {
  const m = new Map();
  for (const r of list) { const k = refKey(r.kind, r.value); if (!m.has(k)) m.set(k, { kind: r.kind, value: r.value, label: r.label, pages: [], snippet: r.snippet }); const e = m.get(k); if (!e.pages.includes(r.page)) e.pages.push(r.page); }
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
export function collectReferences(order, docs = []) {
  const m = new Map();
  const add = (kind, value, origin) => {
    const k = refKey(kind, value);
    if (!m.has(k)) m.set(k, { key: k, kind, value: String(value).trim(), origins: [] });
    m.get(k).origins.push(origin);
  };
  for (const r of order.refs || []) add(r.kind, r.value, { type: 'sanad_structured' });
  for (const d of docs) for (const r of d.extraction?.refs || []) {
    const byMethod = new Map(); // text found by the PDF reader, by imported OCR text, or typed by a person are different kinds of evidence
    for (const o of r.occurrences) { const m = o.via || d.extraction.method; if (!byMethod.has(m)) byMethod.set(m, []); byMethod.get(m).push(o); }
    for (const [m, occ] of byMethod) add(r.kind, r.value, { type: `document_${m}`, docId: d.id, docName: d.name, pages: [...new Set(occ.map((o) => o.page))], snippet: occ[0]?.snippet });
  }
  return [...m.values()];
}
export const ORIGIN_LABEL = {
  sanad_structured: { en: 'Sanad structured data', ar: 'بيانات سند المهيكلة' },
  document_text_layer: { en: 'Order PDF (text layer)', ar: 'ملف الأمر (طبقة النص)' },
  document_ocr_import: { en: 'Order document (OCR text imported)', ar: 'مستند الأمر (نص OCR مستورد)' },
  document_manual_entry: { en: 'Order document (typed by a person)', ar: 'مستند الأمر (أدخله شخص)' },
  manual_selection: { en: 'Chosen by a reviewer', ar: 'اختيار المراجع' }
};

// Conflicts a reviewer must see (and justify) before a candidate invoice can be linked to this order.
export function conflictsFor(order, cand, { otherOrders = [], weak = false, ambiguous = false, docMismatch = false } = {}) {
  const c = [];
  if (order.debtorIdx != null && cand.payerIdx != null && order.debtorIdx !== cand.payerIdx) c.push('debtor_mismatch');
  if (order.amanahEn && cand.amanahEn && order.amanahEn !== cand.amanahEn) c.push('amanah_mismatch');
  if (otherOrders.length) c.push('linked_to_other_order');
  if (cand.cancelled) c.push('invoice_cancelled'); else if (cand.excluded) c.push('invoice_excluded'); else if (cand.paymentStatus === 'collected') c.push('invoice_collected');
  if (order.openedDate && cand.issueDate && cand.issueDate > order.openedDate) c.push('invoice_issued_after_order');
  if (docMismatch) c.push('document_other_order');
  if (ambiguous) c.push('ambiguous_reference'); else if (weak) c.push('weak_reference');
  return c;
}
export const NOTE_REQUIRED = new Set(['debtor_mismatch', 'amanah_mismatch', 'linked_to_other_order', 'invoice_cancelled', 'invoice_excluded', 'invoice_collected', 'invoice_issued_after_order', 'ambiguous_reference', 'document_other_order']);
export const needsNote = (conflicts = []) => conflicts.some((x) => NOTE_REQUIRED.has(x));

// server results (one per reference) → rows for display, with duplicates distinguished
export function buildRows(order, refs, results, links, otherOrdersByInvoice = new Map(), mismatchedDocs = new Set()) {
  const byKey = new Map(results.map((r) => [refKey(r.ref.kind, r.ref.value), r]));
  const firstSeen = new Map();
  const rows = [];
  for (const ref of refs) {
    const res = byKey.get(ref.key);
    const status = !isInvoiceKind(ref.kind) ? 'not_invoice_reference' : !res ? 'pending' : res.status;
    const row = { ...ref, status, weak: !!res?.weak, normalized: res?.normalized || null, candidates: res?.candidates || [], duplicateOf: null, conflicts: {} };
    if (status === 'matched') {
      const id = row.candidates[0].invoiceId;
      if (firstSeen.has(id)) { row.status = 'duplicate_reference'; row.duplicateOf = firstSeen.get(id); } else firstSeen.set(id, ref.value);
    }
    const docOnlyMismatch = ref.origins.length > 0 && ref.origins.every((o) => o.docId && mismatchedDocs.has(o.docId));
    for (const c of row.candidates) row.conflicts[c.invoiceId] = conflictsFor(order, c, { otherOrders: otherOrdersByInvoice.get(c.invoiceId) || [], weak: row.weak, ambiguous: status === 'ambiguous', docMismatch: docOnlyMismatch });
    const linkIds = row.candidates.map((c) => c.invoiceId);
    row.link = links.find((l) => linkIds.includes(l.invoiceId) && l.status !== 'rejected') || null;
    row.rejected = !row.link && links.some((l) => linkIds.includes(l.invoiceId) && l.status === 'rejected');
    rows.push(row);
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

// matched | partial | awaiting_review | unmatched  (+ reasons). `matched` requires EVERYTHING to line up; anything less is visibly partial.
export function orderMatchState(order) {
  const rec = reconcile(order);
  const unresolved = unresolvedReferences(order); const gaps = documentGaps(order);
  const reasons = [];
  if (rec.proposedCount) reasons.push('proposed_unconfirmed');
  if (unresolved.length) reasons.push('unresolved_references');
  if (gaps.length) reasons.push('document_pages_unread');
  if (rec.state === 'short' || rec.state === 'over') reasons.push(rec.state === 'short' ? 'amount_short' : 'amount_over');
  if (rec.state === 'unknown') reasons.push('amount_not_checkable');
  let state;
  if (!rec.confirmedCount && !rec.proposedCount) state = 'unmatched';
  else if (!rec.confirmedCount) state = 'awaiting_review';
  else state = reasons.length ? 'partial' : 'matched';
  return { state, reasons, reconciliation: rec, unresolved, gaps };
}

/* ------------------------------------------------------------------ effective cases = Sanad/anchor base + the user's overlay */
const LINK_STATUS_OUT = { proposed: 'candidate', confirmed: 'confirmed', rejected: 'rejected', removed: 'rejected' };
export const emptyStore = () => ({ v: 1, orders: {} });
const ord = (store, en) => store.orders[en] || { links: {}, docs: {}, history: [], dismissedRefs: [], statusSeen: null };

export function buildEffectiveCases(baseCases, store) {
  return baseCases.map((c) => {
    const o = store?.orders?.[c.enforceNum];
    const base = (c.links || []).map((l) => ({ ...l, origin: l.origin || (l.reviewedBy ? 'sanad_structured' : 'sanad_structured'), appliedStatus: orderStatusOf(c) }));
    const merged = new Map(base.map((l) => [l.invoiceId, l]));
    if (o) for (const l of Object.values(o.links)) merged.set(l.invoiceId, { ...l, status: LINK_STATUS_OUT[l.status] || l.status, ledgerStatus: l.status, appliedStatus: l.status === 'confirmed' ? orderStatusOf(c) : null });
    return { ...c, orderStatus: orderStatusOf(c), links: [...merged.values()], docs: o ? Object.values(o.docs) : [], dismissedRefs: o?.dismissedRefs || [], history: [...(o?.history || []), ...(c.history || [])], hasUserWork: !!o };
  });
}

// enforcement status each invoice carries — the map the data service receives (confirmed links only; a proposal is code 'candidate' = no effect)
export function invoiceStatusMap(cases) {
  const m = {};
  for (const c of cases) {
    for (const l of c.links || []) {
      if (l.status === 'confirmed') {
        const s = orderStatusOf(c); const cur = m[l.invoiceId];
        if (!cur || cur === 'candidate' || STATUS_RANK[s] > STATUS_RANK[cur]) m[l.invoiceId] = s;
      } else if (l.status === 'candidate' && !m[l.invoiceId]) m[l.invoiceId] = 'candidate';
    }
  }
  return m;
}

// everything the invoice view needs: the orders that are confirmed on it (with their status), and proposals awaiting review
export function invoiceEnforcement(invoiceId, cases) {
  const confirmed = []; const proposed = [];
  for (const c of cases) for (const l of c.links || []) {
    if (l.invoiceId !== invoiceId) continue;
    const item = { enforceNum: c.enforceNum, system: c.system, orderStatus: orderStatusOf(c), orderAmount: c.amount, openedDate: c.openedDate, origin: l.origin || null, reviewedAt: l.reviewedAt || null, reviewedBy: l.reviewedBy || null };
    if (l.status === 'confirmed') confirmed.push(item); else if (l.status === 'candidate') proposed.push(item);
  }
  const status = confirmed.reduce((best, x) => (!best || STATUS_RANK[x.orderStatus] > STATUS_RANK[best] ? x.orderStatus : best), null);
  return { confirmed, proposed, status };
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

// proposal: no effect on any invoice. A confirmed/removed link is never silently overwritten by a re-proposal.
export function proposeLink(store, en, input, { by, at, orderStatus }) {
  const o0 = ord(store, en); const ex = o0.links[input.invoiceId];
  if (ex && (ex.status === 'confirmed' || ex.status === 'proposed')) return { store, error: null, unchanged: true };
  let o = noteOrderStatus(o0, orderStatus, at, by);
  const link = { invoiceId: input.invoiceId, status: 'proposed', origin: input.origin, evidence: input.evidence || [], conflicts: input.conflicts || [], gross: input.gross ?? null, snapshot: input.snapshot || null, proposedAt: at, proposedBy: by };
  o = { ...o, links: { ...o.links, [input.invoiceId]: link } };
  o = hist(o, { at, by, action: 'proposed', invoiceId: input.invoiceId, detail: { origin: input.origin, evidence: link.evidence, conflicts: link.conflicts } });
  return { store: put(store, en, o), error: null };
}

export function confirmLink(store, en, invoiceId, { by, at, note = '', orderStatus, input = null }) {
  const o0 = ord(store, en); let ex = o0.links[invoiceId];
  if (!ex && input) ex = { invoiceId, status: 'proposed', origin: input.origin, evidence: input.evidence || [], conflicts: input.conflicts || [], gross: input.gross ?? null, snapshot: input.snapshot || null, proposedAt: at, proposedBy: by };
  if (!ex) return { store, error: 'not_found' };
  if (input) ex = { ...ex, conflicts: input.conflicts || ex.conflicts, gross: input.gross ?? ex.gross, snapshot: input.snapshot || ex.snapshot }; // the conflicts as they stand NOW decide whether a reason is needed
  if (ex.status === 'confirmed') return { store, error: null, unchanged: true };
  if (needsNote(ex.conflicts) && !String(note).trim()) return { store, error: 'note_required' };
  let o = noteOrderStatus(o0, orderStatus, at, by);
  const link = { ...ex, status: 'confirmed', reviewedBy: by, reviewedAt: at, reviewNote: String(note).trim(), appliedStatus: orderStatus || null };
  o = { ...o, links: { ...o.links, [invoiceId]: link } };
  o = hist(o, { at, by, action: 'confirmed', invoiceId, detail: { origin: link.origin, evidence: link.evidence, conflicts: link.conflicts, appliedOrderStatus: orderStatus || null, note: link.reviewNote } });
  return { store: put(store, en, o), error: null };
}

export function rejectLink(store, en, invoiceId, { by, at, note = '', orderStatus, input = null }) {
  const o0 = ord(store, en); let ex = o0.links[invoiceId];
  if (!ex && input) ex = { invoiceId, status: 'proposed', origin: input.origin, evidence: input.evidence || [], conflicts: input.conflicts || [], gross: input.gross ?? null, snapshot: input.snapshot || null, proposedAt: at, proposedBy: by };
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
