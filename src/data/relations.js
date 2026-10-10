// ONE relationship model and ONE enforcement-status derivation for the whole platform.
//
//   order ──< link >── invoice ──(optional)── contract
//
// * An order covers one or many invoices of any type; an invoice may carry several orders (some closed, some open).
// * Only CONFIRMED links count. A proposed link never changes anything; a withdrawn / rejected link counts for nothing (its history is kept).
// * The contract is never inferred from an amount or a payer name: it exists only where the invoice record carries it (or where Sanad names
//   the contract number on a contract-level request). An invoice without a contract is fully supported.
// * Four things are kept apart and never merged into one label:
//     1. historical referral  — has the invoice EVER been under a confirmed order (true again after the order closes)
//     2. current enforcement   — is a confirmed order open now (in execution, or suspended)
//     3. each order's own status (in execution / suspended / closed, with the closure reason when known)
//     4. the invoice's PAYMENT status (a separate field, never touched by any of the above)
//   Closing an order does not imply payment, does not cancel the balance and does not erase the link or the referral.

export const ORDER_STATUS = { 'قيد التنفيذ': 'open', 'موقوف': 'suspended', 'مغلق': 'closed' };
export const orderStatusOf = (c) => ORDER_STATUS[c?.requestStatus] || 'open'; // hand-anchored cases carry no status: they were treated as in execution
export const STATUS_RANK = { open: 3, suspended: 2, closed: 1 };

// → { confirmed:[order…], proposed:[order…], referredEver, current: 'in_execution'|'suspended'|'none', closedOnly, orders }
export function enforcementOf(invoiceId, cases) {
  const confirmed = []; const proposed = []; const withdrawn = [];
  for (const c of cases) for (const l of c.links || []) {
    if (l.invoiceId !== invoiceId) continue;
    const item = { enforceNum: c.enforceNum, system: c.system, orderStatus: orderStatusOf(c), closeReason: c.closeReason || null, orderAmount: c.amount, openedDate: c.openedDate, origin: l.origin || null, reviewedAt: l.reviewedAt || null, reviewedBy: l.reviewedBy || null };
    if (l.status === 'confirmed') confirmed.push(item); else if (l.status === 'candidate') proposed.push(item); else if (l.ledgerStatus === 'removed') withdrawn.push(item);
  }
  return summarize(confirmed, proposed, withdrawn);
}
function summarize(confirmed, proposed, withdrawn = []) {
  const open = confirmed.filter((o) => o.orderStatus === 'open'); const susp = confirmed.filter((o) => o.orderStatus === 'suspended');
  return {
    confirmed, proposed, withdrawn, orders: [...confirmed, ...proposed],
    referredEver: confirmed.length > 0,
    current: open.length ? 'in_execution' : susp.length ? 'suspended' : 'none',
    closedOnly: confirmed.length > 0 && !open.length && !susp.length,
    status: confirmed.reduce((best, x) => (!best || STATUS_RANK[x.orderStatus] > STATUS_RANK[best] ? x.orderStatus : best), null) // the strongest status among ALL confirmed orders
  };
}
export const invoiceEnforcement = enforcementOf;

// invoice → enforcement summary, built once for a whole set of orders
export function buildIndex(cases) {
  const conf = new Map(); const prop = new Map(); const wd = new Map();
  for (const c of cases) for (const l of c.links || []) {
    const bucket = l.status === 'confirmed' ? conf : l.status === 'candidate' ? prop : l.ledgerStatus === 'removed' ? wd : null; if (!bucket) continue;
    if (!bucket.has(l.invoiceId)) bucket.set(l.invoiceId, []);
    bucket.get(l.invoiceId).push({ enforceNum: c.enforceNum, system: c.system, orderStatus: orderStatusOf(c), closeReason: c.closeReason || null, orderAmount: c.amount, openedDate: c.openedDate, origin: l.origin || null, reviewedAt: l.reviewedAt || null, reviewedBy: l.reviewedBy || null });
  }
  const out = new Map();
  for (const id of new Set([...conf.keys(), ...prop.keys(), ...wd.keys()])) out.set(id, summarize(conf.get(id) || [], prop.get(id) || [], wd.get(id) || []));
  return out;
}

// what the data service receives: invoice → the strongest status of its confirmed orders (open > suspended > closed); proposals as «candidate» (no effect)
export function invoiceStatusMap(cases) {
  const m = {};
  for (const [id, e] of buildIndex(cases)) { if (e.status) m[id] = e.status; else if (e.withdrawn.length) m[id] = 'withdrawn'; else if (e.proposed.length) m[id] = 'candidate'; }
  return m;
}

// the orders associated with a contract: Sanad requests that name the contract number (contract level) and every order that is linked
// (confirmed or proposed) to an invoice of the contract. `invoiceIds` comes from the contract's own payment schedule.
export function ordersOfContract(contractNo, invoiceIds, cases) {
  const ids = new Set(invoiceIds.filter(Boolean)); const out = new Map();
  for (const c of cases) {
    // three DIFFERENT facts: the contract is named in the structured source / by a reviewed mention (direct referral) · only MENTIONED (text or document, not reviewed) · some of its invoices are linked
    const fact = (c.contractFacts || []).find((f) => f.contractNo === String(contractNo).toUpperCase());
    const viaContract = !!(c.contractNo && c.contractNo === contractNo) || !!fact?.direct;
    const mentionedOnly = !viaContract && fact?.status === 'mentioned';
    const via = (c.links || []).filter((l) => ids.has(l.invoiceId) && (l.status === 'confirmed' || l.status === 'candidate'));
    if (!viaContract && !mentionedOnly && !via.length) continue;
    out.set(c.enforceNum, { enforceNum: c.enforceNum, orderStatus: orderStatusOf(c), closeReason: c.closeReason || null, sourceStatus: c.source?.statusText || null, amount: c.amount, contractLevel: viaContract, mentionedOnly, factStatus: fact?.status || (viaContract ? 'supported_by_source' : null), factOrigins: fact?.origins || [], invoices: via.map((l) => ({ invoiceId: l.invoiceId, link: l.status === 'confirmed' ? 'confirmed' : 'proposed' })) });
  }
  return [...out.values()];
}

// report counts, stated explicitly and by UNIQUE invoice: «open» (a confirmed order in execution or suspended) vs «ever referred» (also all-closed)
export function enforcementCounts(cases) {
  const idx = buildIndex(cases); const r = { inExecution: 0, suspended: 0, closedOnly: 0, open: 0, everReferred: 0, proposedOnly: 0 };
  for (const e of idx.values()) {
    if (e.current === 'in_execution') r.inExecution += 1; else if (e.current === 'suspended') r.suspended += 1; else if (e.closedOnly) r.closedOnly += 1; else if (e.proposed.length) r.proposedOnly += 1;
    if (e.referredEver) r.everReferred += 1;
  }
  r.open = r.inExecution + r.suspended; return r;
}

export const CLOSE_REASON_LABEL = {
  withdrawn_by_authority: { en: 'Withdrawn by the issuing authority', ar: 'سُحب من الجهة المصدِرة' },
  order_expired: { en: 'The order expired', ar: 'انتهت صلاحية الأمر' },
  replaced_by_other_order: { en: 'Replaced by another order', ar: 'حلّ محله أمر آخر' }
};

// the document evidence behind an invoice's links: every place (document · page · line) in an order's documents where the invoice's reference was read,
// plus the evidence stored with the link itself. Used to show the original document next to the evidence.
export function evidenceForInvoice(invoiceId, cases) {
  const out = []; const seen = new Set();
  const add = (e) => { const k = `${e.enforceNum}|${e.docId}|${e.page}|${e.loc}|${e.snippet}`; if (!seen.has(k)) { seen.add(k); out.push(e); } };
  for (const c of cases) {
    const link = (c.links || []).find((l) => l.invoiceId === invoiceId && (l.status === 'confirmed' || l.status === 'candidate'));
    if (!link) continue;
    for (const d of c.docs || []) for (const r of d.extraction?.refs || []) {
      if (String(r.value).toUpperCase() !== invoiceId.toUpperCase()) continue;
      for (const o of r.occurrences || []) add({ enforceNum: c.enforceNum, docId: d.id, docName: d.name, page: d.extraction.exactPages === false ? null : o.page, loc: o.loc || null, snippet: o.snippet, method: o.via || d.extraction.method, refValue: r.value });
    }
    for (const e of link.evidence || []) if (e && typeof e === 'object' && e.docId) for (const pg of e.pages || [null]) add({ enforceNum: c.enforceNum, docId: e.docId, docName: e.docName, page: pg, snippet: e.snippet || null, method: e.origin, refValue: e.refValue });
  }
  return out;
}
