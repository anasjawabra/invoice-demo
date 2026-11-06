// Meta and data-quality / matching counts.
import { ENTITIES, SOURCES, F, isoOf, dayNum } from '../src/data/catalog.js';
import { makeCtx, resolveScope, derive, inScope, idOf, lookupId } from './engine.js';
import { accessTable, isVisible } from './accessMask.js';
import { contractVisible, requestVisible } from './contracts.js';

export function meta(st, today, access) {
  const tab = accessTable(access); // figures are counted over the records the user's geographic access allows; labels and dates are not data
  const y = today.slice(0, 4); const yN = dayNum(`${y}-01-01`); const pyN = dayNum(`${Number(y) - 1}-01-01`);
  const pyEnd = dayNum(`${Number(y) - 1}${today.slice(4)}`);
  let ytd = 0; let prior = 0; let priorSamePeriod = 0; let lines = 0; let ytdLines = 0; let all = 0;
  const todayN = dayNum(today);
  for (let i = 0; i < st.n; i += 1) {
    if (st.owner[i] !== 0 || !isVisible(st, i, tab)) continue;
    all += 1; lines += st.lines[i];
    const d = st.issue[i];
    if (d >= yN && d <= todayN) { ytd += 1; ytdLines += st.lines[i]; }
    if (d >= pyN && d < yN) prior += 1;
    if (d >= pyN && d <= pyEnd) priorSamePeriod += 1;
  }
  let pays = 0; let paysAll = st.pn;
  if (tab.all) { for (let p = 0; p < st.pn; p += 1) if (st.pDay[p] >= yN && st.pDay[p] <= todayN) pays += 1; }
  else { paysAll = 0; for (let i = 0; i < st.n; i += 1) { if (st.owner[i] !== 0 || !isVisible(st, i, tab)) continue; for (let p = st.payStart[i]; p < st.payStart[i] + st.payCount[i]; p += 1) { paysAll += 1; if (st.pDay[p] >= yN && st.pDay[p] <= todayN) pays += 1; } } }
  const cts = tab.all ? st.contracts.filter(Boolean).length : st.contracts.filter((c) => c && contractVisible(st, c, tab)).length;
  const reqs = tab.all ? st.requests : st.requests.filter((q) => requestVisible(st, q, tab));
  let fixtures = st.nGen < st.n ? st.n - st.nGen : 0; if (!tab.all) { fixtures = 0; for (let i = st.nGen; i < st.n; i += 1) if (isVisible(st, i, tab)) fixtures += 1; }
  return {
    today, timezone: 'Asia/Riyadh', demo: true,
    label: { ar: 'بيانات تجريبية', en: 'Demo data' }, labelDetail: { ar: 'بيانات اصطناعية مستوحاة من التقارير الشهرية، وليست بيانات فعلية للوزارة.', en: "Synthetic data inspired by the monthly reports — not the Ministry's actual data." },
    counts: { invoicesTotal: all, invoicesYtd: ytd, invoicesPriorYear: prior, invoicesPriorSamePeriod: priorSamePeriod, lineItemsTotal: lines, lineItemsYtd: ytdLines, paymentsYtd: pays, paymentsTotal: paysAll, contracts: cts, sanadRequests: reqs.filter((r) => (r.system || 'sanad') === 'sanad').length, whiteLandsOrders: reqs.filter((r) => r.system === 'white_lands').length, fixtures },
    period: { from: isoOf(dayNum(`${y}-01-01`)), to: today, priorFrom: isoOf(pyN), priorTo: isoOf(pyEnd), dataFrom: isoOf(Math.min(...[st.issue[0] || yN])) },
    size: st.meta.size || 'full',
    sizeNote: st.meta.size === 'compact' ? { ar: `عينة تجريبية مصغّرة: ${all.toLocaleString('en-US')} فاتورة اصطناعية بمبالغ كبيرة تحفظ إجماليات التقارير الشهرية؛ عدد الفواتير لا يمثل الحجم التشغيلي الفعلي.`, en: `Compact synthetic sample: ${all.toLocaleString('en-US')} synthetic invoices with large values that keep the monthly-report totals; the invoice count does not represent actual operational volume.` } : null,
    generation: tab.all ? st.meta : { ...st.meta, contracts: cts, requests: reqs.length }
  };
}

export function quality(st, req) {
  const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope); const D = ctx.D;
  const q = { records: 0, conflicts: 0, pending: 0, missing: 0, contractUnmatched: 0, contractConfirmedNone: 0, efaaDifferent: 0, efaaTotal: 0, centralInvoices: 0, internalInvoices: 0, lines: 0, investmentInvoices: 0, installmentsInvoiced: 0 };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    q.records += 1; q.lines += st.lines[i];
    if (st.scope[i] === 0) q.centralInvoices += 1; else q.internalInvoices += 1;
    if (st.flags[i] & F.AMT_CONFLICT) q.conflicts += 1;
    if (st.flags[i] & F.MISSING_ID) q.missing += 1;
    if (st.exMask[i] & ~st.exAppr[i]) q.pending += 1;
    if (st.src[i] === 0) { q.investmentInvoices += 1; if (st.cstat[i] === 2) q.contractUnmatched += 1; if (st.cstat[i] === 3) q.contractConfirmedNone += 1; if (st.contract[i] >= 0) q.installmentsInvoiced += 1; }
    if (st.efaa[i]) { q.efaaTotal += 1; if (st.efaa[i] >= 3) q.efaaDifferent += 1; }
  }
  // the enforcement / contract counts follow the same geographic access as the invoice counts: only requests and contracts the user may see take part
  const tab = ctx.acc; const visReq = tab.all ? st.requests : st.requests.filter((r) => requestVisible(st, r, tab)); const visCt = tab.all ? st.contracts : st.contracts.map((c) => (c && contractVisible(st, c, tab) ? c : null));
  const sanad = visReq.filter((r) => (r.system || 'sanad') === 'sanad');
  const ocrLow = sanad.filter((r) => r.method === 1 && r.confidence < 0.8).length;
  const future = visCt.reduce((s, c) => s + (c ? c.dues.filter((d) => d.inv < 0 && d.due - 10 > ctx.cutoffN).length : 0), 0);
  let crKnown = st.crView.size; if (!tab.all) { const crs = new Set(); for (const c of visCt) if (c && c.crNo) crs.add(c.crNo); for (const r of sanad) if (r.crNo) crs.add(r.crNo); crKnown = [...crs].filter((x) => st.crView.has(x)).length; }
  return { ...q, requests: sanad.length, requestsIdentified: sanad.filter((r) => r.identified.length).length, whiteLandsOrders: visReq.length - sanad.length, ocrCrChains: sanad.filter((r) => r.method === 1).length, crChains: sanad.length, crChainsMatched: sanad.filter((r) => st.crView.has(r.crNo)).length, ocrLowConfidence: ocrLow, futureInstallments: future, crViewKnown: crKnown, void: D.gross };
}

void SOURCES; void idOf;
