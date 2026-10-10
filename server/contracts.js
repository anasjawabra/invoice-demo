// Furas contracts ↔ invoices ↔ Sanad execution requests, computed from the columnar store.
import { ENTITIES, ITEMS, CR_STATUS, isoOf, municipalityOf } from '../src/data/catalog.js';
import { makeCtx, derive, idOf } from './engine.js';
import { payerName, sadadOf, beneficiaryIdOf } from './names.js';

const METHOD = ['structured', 'ocr'];

function stateOf(D) {
  if (D.cancelled) return 'cancelled';
  if (D.excluded) return 'excluded';
  if (D.outstanding <= 0) return 'paid';
  if (D.received > 0 && D.daysOverdue > 0) return 'partial';
  if (D.daysOverdue > 0) return 'overdue';
  return 'not_due';
}

function cardOf(st, ctx, ct) {
  const D = ctx.D; const today = ctx.cutoffN;
  const schedule = ct.dues.map((d) => {
    const issueN = d.due - 10;
    if (d.inv < 0) return { no: d.no, dueDate: isoOf(d.due), amount: d.amount, remainingContractBalance: d.balance, invoiceNo: null, sadadNo: null, state: issueN <= today ? 'unlinked' : 'future', invoiced: false, collected: 0, outstanding: 0 };
    derive(ctx, d.inv, today);
    return { no: d.no, dueDate: isoOf(st.due[d.inv]), issueDate: isoOf(st.issue[d.inv]), amount: d.amount, remainingContractBalance: d.balance, invoiceNo: idOf(st, d.inv), sadadNo: sadadOf(st.idKey[d.inv]), invoiceIdx: d.inv, state: stateOf(D), invoiced: true, collected: D.collected, outstanding: D.outstanding, daysOverdue: D.daysOverdue };
  });
  const sum = (f) => schedule.reduce((s, x) => s + f(x), 0);
  const reqs = st.requests.filter((q) => q.contractIdx === ct.idx).map((q) => {
    const ids = q.identified.map((i) => idOf(st, i));
    return { enforceNum: q.enforceNum, system: 'sanad', amount: q.amount, openedDate: isoOf(q.openedDay), status: q.status, contractNo: ct.contractNo, identifiedInvoices: ids, identified: ids.length > 0, crViewStatusRaw: CR_STATUS[ct.crSt], addedToNetUncollected: false, documents: [{ type: 'فاتورة', item: `بند ١ — ${payerName(ct.payer).ar}`, crNo: q.crNo, method: METHOD[q.method], confidence: q.confidence }] };
  });
  const linkedDebt = reqs.reduce((s, q) => s + q.identifiedInvoices.reduce((t, id) => t + (schedule.find((x) => x.invoiceNo === id)?.outstanding || 0), 0), 0);
  const arrears = sum((x) => (x.state === 'overdue' || x.state === 'partial' ? x.outstanding : 0));
  const notDue = sum((x) => (x.state === 'not_due' ? x.outstanding : 0));
  return {
    contractNo: ct.contractNo, idx: ct.idx, amanahEn: ENTITIES[ct.ent].en, amanahAr: ENTITIES[ct.ent].ar, municipalityKey: municipalityOf(ct.ent, ct.muni)?.key, municipalityAr: municipalityOf(ct.ent, ct.muni)?.ar,
    tenantAr: payerName(ct.payer).ar, tenantEn: payerName(ct.payer).en, itemKey: ITEMS[ct.item].key, itemAr: ITEMS[ct.item].ar, itemEn: ITEMS[ct.item].en, start: isoOf(ct.start), end: isoOf(ct.end), intervalMonths: ct.intervalMonths,
    status: ct.status, crNo: ct.crNo, crStatusRaw: CR_STATUS[ct.crSt] || null, annualValue: ct.annualValue, totalValue: ct.totalValue,
    schedule,
    invoiceIds: schedule.filter((x) => x.invoiced).map((x) => x.invoiceNo), // kept in the summary: which invoices belong to the contract (never inferred — taken from the contract's own schedule)
    totals: {
      contractValue: ct.totalValue, installments: schedule.length, invoiced: sum((x) => (x.invoiced ? x.amount : 0)), collected: sum((x) => x.collected), arrears, notDue,
      futureNotInvoiced: sum((x) => (x.state === 'future' ? x.amount : 0)), netUncollected: arrears + notDue,
      dueToDate: sum((x) => (x.dueDate <= ctx.cfg.cutoff ? x.amount : 0)), remainingOfDue: sum((x) => (x.invoiced && x.dueDate <= ctx.cfg.cutoff ? x.outstanding : 0)),
      overdueInstallments: schedule.filter((x) => x.state === 'overdue' || x.state === 'partial').length, futureInstallments: schedule.filter((x) => x.state === 'future').length,
      unlinkedInstallments: schedule.filter((x) => x.state === 'unlinked').length
    },
    requests: reqs,
    execution: {
      amount: reqs.reduce((s, q) => s + q.amount, 0), linkedDebt, unidentifiedAmount: reqs.filter((q) => !q.identified).reduce((s, q) => s + q.amount, 0), invoicesIdentified: reqs.some((q) => q.identified), addedToNetUncollected: false,
      note: reqs.length && !reqs.some((q) => q.identified)
        ? { ar: 'طلب التنفيذ مرتبط بالعقد دون فواتير محددة — يُعرض على مستوى العقد ولا يُضاف إلى صافي غير المحصل مرة ثانية.', en: 'Execution request is linked to the contract with no invoices identified — shown at contract level and not added to net uncollected again.' }
        : reqs.length ? { ar: 'فواتير محددة ضمن طلب التنفيذ تبقى غير محصلة ولا تُحتسب مرتين.', en: 'Invoices identified in the request stay uncollected and are not counted twice.' } : null
    },
    crChain: reqs.map((q) => ({ sanadRequest: q.enforceNum, document: `${q.documents[0].type} — ${q.documents[0].item}`, crNo: q.crNo || ct.crNo, method: q.documents[0].method, confidence: q.documents[0].confidence, crViewStatusRaw: CR_STATUS[ct.crSt] || null }))
  };
}

export function contractCards(st, req, { summary = true } = {}) {
  const ctx = makeCtx(st, req);
  const allowed = req.scope?.org?.amanahKeys || req.scope?.orgKeys || null;
  const am = req.scope?.amanah; const picked = am && am !== 'all' ? new Set([].concat(am)) : null;
  const out = [];
  for (const ct of st.contracts) {
    if (!ct) continue;
    if (allowed && !allowed.includes(ENTITIES[ct.ent].en)) continue;
    if (picked && !picked.has(ENTITIES[ct.ent].en)) continue;
    const c = cardOf(st, ctx, ct);
    if (summary) { c.schedule = undefined; }
    out.push(c);
  }
  return out;
}
export function contractCard(st, req, no) {
  const ctx = makeCtx(st, req);
  const ct = st.contracts.find((c) => c && c.contractNo === no);
  return ct ? cardOf(st, ctx, ct) : null;
}
export function contractRollup(cards) {
  return {
    contracts: cards.length, multiPayment: cards.filter((c) => c.totals.installments > 1).length,
    arrears: cards.reduce((s, c) => s + c.totals.arrears, 0), notDue: cards.reduce((s, c) => s + c.totals.notDue, 0), futureNotInvoiced: cards.reduce((s, c) => s + c.totals.futureNotInvoiced, 0),
    executionAtContractLevel: cards.reduce((s, c) => s + (c.execution.invoicesIdentified ? 0 : c.execution.amount), 0)
  };
}

// Sanad requests in the shape the enforcement workspace keeps its cases
export function sanadCases(st) {
  return st.requests.map((q) => {
    const wl = q.system === 'white_lands';
    return {
      enforceNum: q.enforceNum, system: q.system || 'sanad', amanahEn: ENTITIES[q.ent].en, amount: q.amount, openedDate: isoOf(q.openedDay), contractNo: q.contractNo || null, requestStatus: q.status,
      // what the feed supplies for the order: the invoice references it carries (possibly none / incomplete / wrong), the debtor, and whether the order document can be fetched
      refs: q.refs ? q.refs.map((r) => ({ ...r })) : q.identified.map((i) => ({ kind: 'invoice_no', value: idOf(st, i) })),
      debtorIdx: q.debtor ?? null, debtorName: q.debtor != null ? payerName(q.debtor) : null, debtorId: q.debtor != null ? beneficiaryIdOf(q.debtor) : null,
      description: q.description || '', notes: q.notes || '', attachments: (q.attachments || []).map((x) => ({ ...x, retrieved: false })), closeReason: q.status === 'مغلق' ? (q.closeReason || null) : null, orderDocument: { retrievable: false, reason: 'sanad_document_integration_not_connected' }, feed: 'synthetic_demo',
      documents: wl ? [] : [{ type: 'فاتورة', item: 'بند ١', crNo: q.crNo, method: METHOD[q.method], confidence: q.confidence }],
      links: q.identified.map((i) => ({ invoiceId: idOf(st, i), allocated: 0, gross: st.gross[i], origin: 'sanad_structured', status: 'confirmed', evidence: wl ? ['reference_match'] : ['contract_match', 'reference_match'], reviewedBy: wl ? 'White-lands enforcement file (demo feed)' : 'Sanad structured reference (demo feed)', reviewedAt: isoOf(q.openedDay) })), history: []
    };
  });
}
