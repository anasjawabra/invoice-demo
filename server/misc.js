// Meta and data-quality / matching counts.
import { ENTITIES, SOURCES, F, isoOf, dayNum } from '../src/data/catalog.js';
import { makeCtx, resolveScope, derive, inScope, idOf, lookupId } from './engine.js';

export function meta(st, today) {
  const y = today.slice(0, 4); const yN = dayNum(`${y}-01-01`); const pyN = dayNum(`${Number(y) - 1}-01-01`);
  const pyEnd = dayNum(`${Number(y) - 1}${today.slice(4)}`);
  let ytd = 0; let prior = 0; let priorSamePeriod = 0; let lines = 0; let ytdLines = 0; let all = 0;
  const todayN = dayNum(today);
  for (let i = 0; i < st.n; i += 1) {
    if (st.owner[i] !== 0) continue;
    all += 1; lines += st.lines[i];
    const d = st.issue[i];
    if (d >= yN && d <= todayN) { ytd += 1; ytdLines += st.lines[i]; }
    if (d >= pyN && d < yN) prior += 1;
    if (d >= pyN && d <= pyEnd) priorSamePeriod += 1;
  }
  let pays = 0; for (let p = 0; p < st.pn; p += 1) if (st.pDay[p] >= yN && st.pDay[p] <= todayN) pays += 1;
  return {
    today, timezone: 'Asia/Riyadh', demo: true,
    label: { ar: 'بيانات تجريبية', en: 'Demo data' }, labelDetail: { ar: 'بيانات اصطناعية مستوحاة من التقارير الشهرية، وليست بيانات فعلية للوزارة.', en: "Synthetic data inspired by the monthly reports — not the Ministry's actual data." },
    counts: { invoicesTotal: all, invoicesYtd: ytd, invoicesPriorYear: prior, invoicesPriorSamePeriod: priorSamePeriod, lineItemsTotal: lines, lineItemsYtd: ytdLines, paymentsYtd: pays, paymentsTotal: st.pn, contracts: st.contracts.filter(Boolean).length, sanadRequests: st.requests.filter((r) => (r.system || 'sanad') === 'sanad').length, whiteLandsOrders: st.requests.filter((r) => r.system === 'white_lands').length, fixtures: st.nGen < st.n ? st.n - st.nGen : 0 },
    period: { from: isoOf(dayNum(`${y}-01-01`)), to: today, priorFrom: isoOf(pyN), priorTo: isoOf(pyEnd), dataFrom: isoOf(Math.min(...[st.issue[0] || yN])) },
    size: st.meta.size || 'full',
    sizeNote: st.meta.size === 'compact' ? { ar: `عينة تجريبية مصغّرة: ${all.toLocaleString('en-US')} فاتورة اصطناعية بمبالغ كبيرة تحفظ إجماليات التقارير الشهرية؛ عدد الفواتير لا يمثل الحجم التشغيلي الفعلي.`, en: `Compact synthetic sample: ${all.toLocaleString('en-US')} synthetic invoices with large values that keep the monthly-report totals; the invoice count does not represent actual operational volume.` } : null,
    generation: st.meta
  };
}

export function quality(st, req) {
  const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope); const D = ctx.D;
  const q = { records: 0, conflicts: 0, pending: 0, missing: 0, contractUnmatched: 0, contractConfirmedNone: 0, unassigned: 0, makeenMatched: 0, makeenUnmatched: 0, efaaDifferent: 0, efaaTotal: 0, centralInvoices: 0, internalInvoices: 0, lines: 0, investmentInvoices: 0, installmentsInvoiced: 0 };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    q.records += 1; q.lines += st.lines[i];
    if (st.scope[i] === 0) q.centralInvoices += 1; else q.internalInvoices += 1;
    if (st.flags[i] & F.AMT_CONFLICT) q.conflicts += 1;
    if (st.flags[i] & F.MISSING_ID) q.missing += 1;
    if (st.exMask[i] & ~st.exAppr[i]) q.pending += 1;
    if (st.src[i] === 0) { q.investmentInvoices += 1; if (st.cstat[i] === 2) q.contractUnmatched += 1; if (st.cstat[i] === 3) q.contractConfirmedNone += 1; if (st.contract[i] >= 0) q.installmentsInvoiced += 1; }
    if (st.ent[i] === ENTITIES.length - 1) q.unassigned += 1;
    if (st.scope[i] === 0 && i < st.nGen) { if (st.alink[i] === 2) q.makeenUnmatched += 1; else q.makeenMatched += 1; }
    if (st.efaa[i]) { q.efaaTotal += 1; if (st.efaa[i] >= 3) q.efaaDifferent += 1; }
  }
  const sanad = st.requests.filter((r) => (r.system || 'sanad') === 'sanad');
  const ocrLow = sanad.filter((r) => r.method === 1 && r.confidence < 0.8).length;
  const future = st.contracts.reduce((s, c) => s + (c ? c.dues.filter((d) => d.inv < 0 && d.due - 10 > ctx.cutoffN).length : 0), 0);
  return { ...q, requests: sanad.length, requestsIdentified: sanad.filter((r) => r.identified.length).length, whiteLandsOrders: st.requests.length - sanad.length, ocrCrChains: sanad.filter((r) => r.method === 1).length, crChains: sanad.length, crChainsMatched: sanad.filter((r) => st.crView.has(r.crNo)).length, ocrLowConfidence: ocrLow, futureInstallments: future, crViewKnown: st.crView.size, void: D.gross };
}

void SOURCES; void idOf;
