// Enforcement-order reference resolution (server side — the invoice world lives here).
// The client sends the REFERENCES an order carries (from Sanad's structured data or extracted from the order document); this module only says
// which system invoices each reference points to. It never matches on amount, never guesses from "similar" numbers, and never invents a
// candidate: a reference either resolves exactly, resolves to several invoices (ambiguous), or does not resolve.
import { SOURCES, ITEMS, isoOf } from '../src/data/catalog.js';
import { ENTITIES } from '../src/data/catalog.js';
import { makeCtx, derive, lookupId, lookupKey, lookupSadad, lookupComposite, idOf, contractsByNumber } from './engine.js';
import { iimFields } from './iimRow.js';
import { idKeyFromViolation, payerName, beneficiaryIdOf } from './names.js';
import { parseInvoiceKey } from '../src/data/iim.js';
import { isVisible } from './accessMask.js';
import { contractVisible } from './contracts.js';

function serialIndex(st) { // a year-less serial (the old «INV-YYYY-NNNNNNN» tail) matches the invoices of every year: always ambiguous, never a match on its own
  if (st._serialIdx) return st._serialIdx;
  const m = new Map();
  for (let i = 0; i < st.nGen; i += 1) { const k = st.idKey[i] % 1e8; if (!m.has(k)) m.set(k, []); m.get(k).push(i); }
  st._serialIdx = m; return m;
}

// the invoice's composite identity: what a reviewer needs to tell candidates apart, and the key a CONFIRMED link stores
const identityOf = (st, i) => { const im = iimFields(st, i); return { compositeKey: im.compositeKey, invoiceNo: im.invoiceNo, gfsCode: im.gfsCode, amanahId: im.amanahId, municipalityId: im.municipalityId }; };
// the invoice's own basic facts, shown beside a link so the reviewer sees what it is without leaving the order: issuing biller, supplying system, revenue source and item, product, scope, kind, revenue account, municipality
function invoiceFacts(st, i) {
  const im = iimFields(st, i);
  return {
    sadadNo: im.sadadNo || null, billerId: im.billerId, billerAr: im.billerAr, billerEn: im.billerEn, platform: SOURCES[st.src[i]]?.platform || null,
    itemAr: ITEMS[st.item[i]]?.ar || null, itemEn: ITEMS[st.item[i]]?.en || null, productAr: im.productAr, productEn: im.productEn,
    scopeType: st.scope[i] === 1 ? 'internal' : 'central', invoiceKind: im.invoiceKind || null, gfsCode: im.gfsCode, gfsSub: im.gfsSub, mainClass: im.mainClass,
    municipalityAr: im.municipalityAr, municipalityEn: im.municipalityEn, municipalityRefId: im.municipalityRefId, municipalityStatus: im.municipalityStatus
  };
}

function summary(st, ctx, i) {
  const D = derive(ctx, i, ctx.cutoffN);
  const exec = st.exec[i] >= 0 ? st.requests[st.exec[i]] : null;
  const generated = i < st.nGen;
  return {
    invoiceId: idOf(st, i), ...identityOf(st, i), source: SOURCES[st.src[i]]?.key || null, amanahEn: ENTITIES[st.ent[i]]?.en || null,
    payerName: generated ? payerName(st.payer[i]) : null, payerId: generated ? beneficiaryIdOf(st.payer[i]) : null, payerIdx: generated ? st.payer[i] : null,
    issueDate: isoOf(st.issue[i]), dueDate: isoOf(st.due[i]), grossAmount: D.billed, netAmount: D.net, outstanding: D.outstanding, collected: D.collected,
    paymentStatus: D.payStatus, daysOverdue: D.daysOverdue, excluded: D.excluded, cancelled: D.cancelled, sourceCancelled: D.sourceCancelled, enfConflict: D.enfConflict,
    contractNo: st.contract[i] >= 0 && st.contracts[st.contract[i]] ? st.contracts[st.contract[i]].contractNo : null, // only the contract the invoice itself carries — never inferred
    serverIdentifiedOrder: exec ? exec.enforceNum : null,
    ...invoiceFacts(st, i)
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
    if (kind === 'invoice_corrupted') { out.push({ ref, status: 'corrupted', weak: false, normalized: null, candidates: [] }); continue; } // a number a spreadsheet turned into scientific notation: the digits are lost, nothing is guessed
    if (kind === 'composite_key') { const i = lookupComposite(st, value); if (i >= 0) idx = [i]; } // the composite key: exact, one invoice
    else if (kind === 'invoice_id_exact') { const i = lookupId(st, value); if (i >= 0) idx = [i]; } // a link's own invoice id: looked up exactly, never padded
    else if (kind === 'invoice_no') { // `${billerId}-${sadadNumber}`: looked up exactly; the pair identifies one invoice
      const p = parseInvoiceKey(value.replace(/[\s_\u2013\u2014/]+/g, '-')); const i = p ? lookupId(st, `${p.billerId}-${p.sadad}`) : -1; if (i >= 0) idx = [i];
    } else if (kind === 'invoice_serial') {
      const digits = value.replace(/\D/g, ''); weak = true;
      if (digits) idx = serialIndex(st).get(Number(digits)) || [];
    } else if (kind === 'sadad_no') { // a bare Sadad number is NOT unique across billers: every invoice carrying it is a candidate (several → ambiguous)
      idx = lookupSadad(st, value.replace(/\D/g, ''));
    } else if (kind === 'violation_no') {
      const key = idKeyFromViolation(value.replace(/\D/g, '')); const i = key == null ? -1 : lookupKey(st, key); if (i >= 0) idx = [i];
    } else if (kind === 'contract_no') { // a contract number MENTIONED by an order: only says whether a contract with that number exists — never a referral, never an approved link, and not a unique record when several carry the number
      const found = contractsByNumber(st, value).filter((c) => contractVisible(st, c, ctx.acc)); const ct = found.length === 1 ? found[0] : null;
      out.push({ ref, status: found.length > 1 ? 'contract_ambiguous' : ct ? 'contract_found' : 'contract_not_found', matches: found.length, weak: false, normalized: null, candidates: [], contract: ct ? { contractNo: ct.contractNo, amanahEn: ENTITIES[ct.ent]?.en || null } : null }); continue;
    } else { out.push({ ref, status: 'not_invoice_reference', weak: false, normalized: null, candidates: [] }); continue; }
    idx = idx.filter((i) => i >= 0 && st.issue[i] <= ctx.cutoffN && isVisible(st, i, ctx.acc) && (st.owner[i] === 0 || st.owner[i] === ctx.owner)); // an invoice outside the user's geographic access (or another user's upload) resolves exactly like a missing one: no candidate, no count
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
    if (st.payer[i] !== debtor || st.issue[i] > ctx.cutoffN || !isVisible(st, i, ctx.acc)) continue;
    const s = summary(st, ctx, i); if (exclude.has(s.invoiceId) || !(s.outstanding > 0)) continue;
    out.push(s);
    if (out.length >= 30) break;
  }
  return { invoices: out };
}

