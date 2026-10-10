// Enforcement-order reference resolution (server side — the invoice world lives here).
// The client sends the REFERENCES an order carries (from Sanad's structured data or extracted from the order document); this module only says
// which system invoices each reference points to. It never matches on amount, never guesses from "similar" numbers, and never invents a
// candidate: a reference either resolves exactly, resolves to several invoices (ambiguous), or does not resolve.
import { SOURCES, isoOf } from '../src/data/catalog.js';
import { ENTITIES } from '../src/data/catalog.js';
import { makeCtx, derive, lookupId, idOf } from './engine.js';
import { idKeyFromSadad, idKeyFromViolation, invoiceIdOf, parseInvoiceId, payerName, beneficiaryIdOf } from './names.js';

const FULL_ID = /^INV-(\d{4})-(\d{1,7})$/i;

function serialIndex(st) {
  if (st._serialIdx) return st._serialIdx;
  const m = new Map();
  for (let i = 0; i < st.nGen; i += 1) { const k = st.idKey[i] % 1e8; if (!m.has(k)) m.set(k, []); m.get(k).push(i); }
  st._serialIdx = m; return m;
}

function summary(st, ctx, i) {
  const D = derive(ctx, i, ctx.cutoffN);
  const exec = st.exec[i] >= 0 ? st.requests[st.exec[i]] : null;
  const generated = i < st.nGen;
  return {
    invoiceId: idOf(st, i), source: SOURCES[st.src[i]]?.key || null, amanahEn: ENTITIES[st.ent[i]]?.en || null,
    payerName: generated ? payerName(st.payer[i]) : null, payerId: generated ? beneficiaryIdOf(st.payer[i]) : null, payerIdx: generated ? st.payer[i] : null,
    issueDate: isoOf(st.issue[i]), dueDate: isoOf(st.due[i]), grossAmount: D.billed, netAmount: D.net, outstanding: D.outstanding, collected: D.collected,
    paymentStatus: D.payStatus, daysOverdue: D.daysOverdue, excluded: D.excluded, cancelled: D.cancelled, sourceCancelled: D.sourceCancelled, enfConflict: D.enfConflict,
    contractNo: st.contract[i] >= 0 && st.contracts[st.contract[i]] ? st.contracts[st.contract[i]].contractNo : null, // only the contract the invoice itself carries — never inferred
    serverIdentifiedOrder: exec ? exec.enforceNum : null
  };
}

// refs: [{ kind: 'invoice_no' | 'invoice_serial' | 'sadad_no' | 'violation_no' | other, value, ... }]
// → [{ ref, status: 'matched' | 'ambiguous' | 'unmatched' | 'not_invoice_reference', weak, normalized, candidates: [summary] }]
export function resolveReferences(st, req) {
  const ctx = makeCtx(st, req);
  const out = [];
  for (const ref of req.refs || []) {
    const value = String(ref.value ?? '').trim(); const kind = ref.kind;
    let idx = []; let weak = false; let normalized = null;
    if (kind === 'invoice_id_exact') { const i = lookupId(st, value); if (i >= 0) idx = [i]; } // a link's own invoice id: looked up exactly, never padded
    else if (kind === 'invoice_no') {
      let id = value.toUpperCase();
      const m = FULL_ID.exec(id);
      if (m && m[2].length < 7 && !st.fixtureById.has(id)) { id = `INV-${m[1]}-${m[2].padStart(7, '0')}`; normalized = id; weak = true; } // a short serial is padded, and says so
      const i = lookupId(st, id); if (i >= 0) idx = [i];
    } else if (kind === 'invoice_serial') {
      const digits = value.replace(/\D/g, ''); weak = true;
      if (digits) idx = serialIndex(st).get(Number(digits)) || [];
    } else if (kind === 'sadad_no') {
      const key = idKeyFromSadad(value.replace(/\D/g, '')); const i = key == null ? -1 : lookupId(st, invoiceIdOf(key)); if (i >= 0) idx = [i];
    } else if (kind === 'violation_no') {
      const key = idKeyFromViolation(value.replace(/\D/g, '')); const i = key == null ? -1 : lookupId(st, invoiceIdOf(key)); if (i >= 0) idx = [i];
    } else if (kind === 'contract_no') { // a contract number MENTIONED by an order: only says whether such a contract exists (never a referral by itself)
      const ct = (st.contracts || []).find((c) => c && c.contractNo === value.toUpperCase());
      out.push({ ref, status: ct ? 'contract_found' : 'contract_not_found', weak: false, normalized: null, candidates: [], contract: ct ? { contractNo: ct.contractNo, amanahEn: ENTITIES[ct.ent]?.en || null } : null }); continue;
    } else { out.push({ ref, status: 'not_invoice_reference', weak: false, normalized: null, candidates: [] }); continue; }
    idx = idx.filter((i) => i >= 0 && st.issue[i] <= ctx.cutoffN);
    out.push({ ref, status: idx.length === 0 ? 'unmatched' : idx.length === 1 ? 'matched' : 'ambiguous', weak, normalized, candidates: idx.map((i) => summary(st, ctx, i)) });
  }
  return { results: out, cutoff: ctx.cfg.cutoff };
}

// the order's debtor and the invoices of the same debtor that the order does NOT reference — an investigation aid for an amount discrepancy,
// never a list of matches (amount alone never creates a match).
export function sameDebtorInvoices(st, req) {
  const ctx = makeCtx(st, req); const debtor = Number(req.debtor); const exclude = new Set((req.excludeIds || []).map((x) => String(x)));
  if (!Number.isFinite(debtor)) return { invoices: [] };
  const out = [];
  for (let i = 0; i < st.nGen; i += 1) {
    if (st.payer[i] !== debtor || st.issue[i] > ctx.cutoffN) continue;
    const s = summary(st, ctx, i); if (exclude.has(s.invoiceId) || !(s.outstanding > 0)) continue;
    out.push(s);
    if (out.length >= 30) break;
  }
  return { invoices: out };
}

void parseInvoiceId;
