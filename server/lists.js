// Paged / searchable / sortable invoice listings, worklists, risk flags and the large streaming export — all over the
// columnar store. Nothing here materialises more than one page of invoice objects.
import { ENTITIES, SOURCES, ITEMS, CHANNELS, CSTAT, CR_STATUS, EFAA_STATUS, RULE_IDS, F, isoOf, dayNum } from '../src/data/catalog.js';
import { EXCLUSION_RULES } from '../src/data/revenueMetrics.js';
import { REFERRED_CANCELLED_STAYS_BILLED, OBJECTION_STATUS_OF } from '../src/data/iim.js';
import { materialize } from './materialize.js';
import { iimFields, exclusionOf, exclusionReasonsOf, investmentOutcome, INVOICE_KIND_SHORT_AR } from './iimRow.js';
import { makeCtx, resolveScope, derive, recordRiskFlags, inScope, idOf, lookupId, lookupKey, lookupSadad, lowerBound, CLASSES, CLASS_INDEX, agingBucket, TopK, objectionStatusKey, contractsByNumber } from './engine.js';
import { idKeyFromSadad, idKeyFromSubscription, idKeyFromViolation, payerPool, payerName, sadadOf, violationOf, subscriptionOf, DEED, LICENCE, DISCLOSURE, VISIT, SCHEDULE, REQUEST, parseFacilityKey } from './names.js';
import { HOUSING_PAYER_BASE, WL_PAYER_BASE } from './world.js';
import { grpOf, GRP } from '../src/data/catalog.js';
import { ncMatches, ncRow, ncAsOf, newNc, ncClassify, GROUPS as NC_GROUPS } from './noncollection.js';
import { PRODUCT_KEYS, PRODUCTS, productIdxOf, originIdxOf, ORIGIN_AR, ORIGIN_EN } from '../src/data/iim.js';
import { REVENUE_SOURCES } from '../src/data/revenueLedger.js';
import { ALL_TABLE, accessKeyOf, isVisible } from './accessMask.js';
import { contractVisible, requestVisible } from './contracts.js';
import { planLineMatches } from './planningActions.js';

const low0 = (x) => x.toLowerCase();
const RULE_PRIORITY = Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.priority]));

/* ------------------------------------------------------------------ search resolution */
export function resolveSearch(st, q, tab = ALL_TABLE) {
  const s = String(q || '').trim();
  if (!s) return null;
  // exact invoice id
  const exact = lookupId(st, s); if (exact >= 0) return { list: Int32Array.of(exact) };
  const upper = s.toUpperCase();
  { const ms = contractsByNumber(st, s).filter((c) => contractVisible(st, c, tab)); if (ms.length > 1) return { list: new Int32Array(0), ambiguousContract: ms.length }; } // a number carried by several contract records identifies none of them: no invoices are returned and none is chosen
  { const ms = contractsByNumber(st, s).filter((c) => contractVisible(st, c, tab)); const ct = ms.length === 1 ? ms[0] : null; if (ct) return { list: Int32Array.from(ct.invs) }; } // a contract number is found by exact (trimmed, case-folded) match with a known contract: no format is assumed
  if (/^\d{10}$/.test(s)) { const ct = st.contracts.find((c) => c && c.crNo === s && contractVisible(st, c, tab)); if (ct) return { list: Int32Array.from(ct.invs) }; }
  if (/^\d{12}$/.test(s)) { const l = lookupSadad(st, s); if (l.length) return { list: Int32Array.from(l) }; } // a Sadad number can repeat across billers: every invoice that carries it is returned
  if (/^\d{10}$/.test(s)) { const k = idKeyFromSubscription(s); if (k != null) { const i = lookupKey(st, k); if (i >= 0) return { list: Int32Array.of(i) }; } }
  if (/^\d{14}$/.test(s)) { const k = idKeyFromViolation(s); if (k != null) { const i = lookupKey(st, k); if (i >= 0) return { list: Int32Array.of(i) }; } }
  // source-record identifiers: disclosure / schedule / visit / licence / request keys point at ONE invoice; a deed at its owners' invoices; a facility at all its invoices
  for (const codec of [DISCLOSURE, SCHEDULE, VISIT, LICENCE, REQUEST]) { const k = codec.decode(upper); if (k != null) { const i = lookupKey(st, k); return { list: i >= 0 ? Int32Array.of(i) : new Int32Array(0) }; } }
  { const k = DEED.decode(upper); if (k != null) { const i = lookupKey(st, k); if (i < 0) return { list: new Int32Array(0) }; const g = grpOf(st.flags[i]); const n = g === GRP.WL_HEAD2 ? 2 : g === GRP.WL_HEAD3 ? 3 : 1; return { list: Int32Array.from({ length: n }, (_, j) => i + j) }; } }
  { const fk = parseFacilityKey(upper); if (fk != null) { const bm = new Uint8Array(65536); bm[fk] = 1; return { payer: bm, fixtures: [] }; } }
  { const q = st.requests.find((x) => x.enforceNum === upper && requestVisible(st, x, tab)); if (q) return { list: Int32Array.from(q.identified.length ? q.identified : (st.contracts[q.contractIdx]?.invs || [])) }; }
  { const m2 = /^(?:مالك أرض|LAND OWNER)\s*(\d{5})$/.exec(upper.replace(/\s+/g, ' ')); if (m2) { const bm = new Uint8Array(65536); const idx = WL_PAYER_BASE + Number(m2[1]) - 1000; if (idx >= WL_PAYER_BASE && idx < 65536) bm[idx] = 1; return { payer: bm, fixtures: [] }; } }
  { const m3 = /^(?:مشتري سكني|RESIDENTIAL BUYER)\s*(\d{5})$/.exec(upper.replace(/\s+/g, ' ')); if (m3) { const bm = new Uint8Array(65536); const idx = HOUSING_PAYER_BASE + Number(m3[1]) - 1000; if (idx >= HOUSING_PAYER_BASE && idx < WL_PAYER_BASE) bm[idx] = 1; return { payer: bm, fixtures: [] }; } }
  // a bare prefix of the synthetic owner / buyer names ("مالك", "land") selects that whole population
  if (s.length >= 3) {
    const ow = 'مالك أرض'.startsWith(s) || 'land owner'.startsWith(low0(s)); const by = 'مشتري سكني'.startsWith(s) || 'residential buyer'.startsWith(low0(s));
    if (ow || by) { const bm = new Uint8Array(65536); const [a, b] = ow ? [WL_PAYER_BASE, 65536] : [HOUSING_PAYER_BASE, WL_PAYER_BASE]; for (let k = a; k < b; k += 1) bm[k] = 1; return { payer: bm, fixtures: [] }; }
  }
  // fixtures: match by text
  const fx = []; const low = s.toLowerCase();
  for (const [i, r] of st.fixtures) if (r.id.toLowerCase().includes(low) || (r.co || '').toLowerCase().includes(low) || (r.entityEn || '').toLowerCase().includes(low) || (r.entityAr || '').includes(s)) fx.push(i);
  // payer name substring -> payer bitmap
  const pool = payerPool(); const bm = new Uint8Array(65536); let any = false;
  for (let p = 0; p < pool.length; p += 1) if (pool[p].ar.includes(s) || pool[p].en.toLowerCase().includes(low)) { bm[p] = 1; any = true; }
  return { payer: any ? bm : null, fixtures: fx };
}

/* ------------------------------------------------------------------ row output */
function tahseelOf(st, i, D) { return D.cancelled ? 'ملغاة' : D.received >= D.billed && D.billed > 0 ? 'محصلة' : D.received > 0 ? 'مسددة جزئياً' : 'غير محصلة'; }
export function tagsOf(st, i, D) {
  const t = []; const f = st.flags[i];
  if (D.received > 0 && D.outstanding > 0) t.push('partial');
  if (D.outstanding > 0 && D.daysOverdue > 0) t.push('overdue');
  if (f & F.AMT_CONFLICT) t.push('amount_conflict');
  const cs = st.cstat[i]; if (st.src[i] === 0 && cs === 2) t.push('contract_unmatched'); if (st.src[i] === 0 && cs === 4) t.push('contract_unlinked');
  if (f & F.MISSING_ID) t.push('missing_fields');
  if (D.overlaps) t.push('also_excluded_reason');
  else if (D.excluded && D.nReasons > 1) t.push('multi_reason');
  if (D.pendingMask) t.push('exclusion_pending');
  if (st.efaa[i] && st.efaa[i] !== 1 && st.efaa[i] !== 2) t.push('efaa_status');
  if (D.link === 1) t.push('enforcement_candidate');
  return t;
}
/** the candidates of an ambiguous reference, with what a user needs to tell them apart (invoice number, GFS code, Amanah and municipality, source, amount, status) */
export function invoiceCandidates(st, body, idx) { const ctx = makeCtx(st, body); return idx.filter((i) => isVisible(st, i, ctx.acc)).map((i) => { const r = rowOut(st, ctx, i, derive(ctx, i, ctx.cutoffN)); return { id: r.id, compositeKey: r.compositeKey, invoiceNo: r.invoiceNo, gfsCode: r.gfsCode, amanahId: r.amanahId, amanahAr: r.amanahAr, amanahEn: r.amanahEn, municipalityId: r.municipalityId, municipalityRefId: r.municipalityRefId, municipalityAr: r.municipalityAr, municipalityEn: r.municipalityEn, municipalityStatus: r.municipalityStatus, source: r.source, platform: r.platform, amount: r.gross, status: r.cls }; }); }
export function rowOut(st, ctx, i, D) {
  const e = st.ent[i];
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const ct = st.contract[i] >= 0 ? st.contracts[st.contract[i]] : null;
  const rules = []; for (let b = 0; b < RULE_IDS.length; b += 1) if (st.exMask[i] & (1 << b)) rules.push(RULE_IDS[b]);
  const im = iimFields(st, i);
  return {
    id: idOf(st, i), index: i,
    entityKey: ENTITIES[e].en, amanahAr: ENTITIES[e].ar, amanahEn: ENTITIES[e].en,
    payerAr: fx ? fx.entityAr || fx.entity : payerName(st.payer[i]).ar, payerEn: fx ? fx.entityEn : payerName(st.payer[i]).en,
    scopeType: st.scope[i] === 1 ? 'internal' : 'central', source: SOURCES[st.src[i]].key, platform: SOURCES[st.src[i]].platform, item: ITEMS[st.item[i]].key, itemAr: ITEMS[st.item[i]].ar, itemEn: ITEMS[st.item[i]].en,
    issueDate: isoOf(st.issue[i]), dueDate: isoOf(st.due[i]), gross: D.gross, billed: D.billed, collected: D.collected, received: D.received, outstanding: D.outstanding, cancelledAmount: D.cancelledAmount, exclusionAmount: D.exclusionAmount, exclusions: D.exclTotal, net: D.net,
    daysOverdue: D.outstanding > 0 ? D.daysOverdue : 0, cls: CLASSES[D.cls], lines: st.lines[i],
    statusRawTahseel: tahseelOf(st, i, D), statusRawEfaa: EFAA_STATUS[st.efaa[i]] || null, crStatusRaw: CR_STATUS[st.crSt[i]] || null,
    contractNo: ct && st.cstat[i] === 1 ? ct.contractNo : fx?.co || null, contractStatus: CSTAT[st.cstat[i]], executionIdx: st.exec[i], enforcement: ctx.mark ? (ctx.ov.get(i)?.link || 0) : 0, payStatus: D.payStatus, sourceCancelled: D.sourceCancelled, enfConflict: D.enfConflict, rules, nReasons: D.nReasons,
    primaryRule: D.primaryBit ? RULE_IDS[Math.round(Math.log2(D.primaryBit))] : null, tags: tagsOf(st, i, D), uploaded: !!(st.flags[i] & F.UPLOADED),
    ...im, invoiceKindAr: im.invoiceKind ? INVOICE_KIND_SHORT_AR[im.invoiceKind] : null, exclusionReason: exclusionOf(D), exclusionReasons: exclusionReasonsOf(D),
    // R7: the Mumtathil appeal status; R11: the invoice it repeats; R8 / R9: the file the exclusion came from
    objectionStatus: st.flags[i] & F.OBJECTION ? (() => { const x = OBJECTION_STATUS_OF[objectionStatusKey(st, i)]; return { key: x.key, ar: x.ar, en: x.en, excludes: x.exclude }; })() : null,
    duplicateOf: st.dupOf?.has(i) ? idOf(st, st.dupOf.get(i)) : null,
    exclusionFile: ctx.ov?.get(i)?.files?.[D.primaryBit ? RULE_IDS[Math.round(Math.log2(D.primaryBit))] : ''] || null,
    // every exclusion reason the invoice meets (kept side by side, never replaced) and the enforcement orders behind «مرتبطة بأمر تنفيذ مؤكد» — so a list can show the badge and link the order
    exclusionRules: D.mask ? RULE_IDS.filter((_, b) => D.mask & (1 << b)) : [],
    enfOrders: D.mask & (1 << RULE_IDS.indexOf('SND-1')) ? [...(st.exec[i] >= 0 ? [{ enforceNum: st.requests[st.exec[i]].enforceNum, status: st.requests[st.exec[i]].status }] : []), ...(((ctx.linkInfo || {})[idOf(st, i)]) || []).map((x) => ({ enforceNum: x.enforceNum, status: x.orderStatus }))] : []
  };
}

/* ------------------------------------------------------------------ list */
const SORT_KEYS = { issue: 'issue', gross: 'gross', outstanding: 'outstanding', daysOverdue: 'daysOverdue', collected: 'collected', exclusionAmount: 'exclusionAmount', uncollected: 'uncollected', priority: 'priority', id: 'id' };
const cache = new Map();
const hashOf = (str) => { let h = 5381; for (let i = 0; i < str.length; i += 1) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return `${str.length}.${h.toString(36)}`; };
function lruGet(k) { if (!cache.has(k)) return null; const v = cache.get(k); cache.delete(k); cache.set(k, v); return v; }
function lruSet(k, v) { cache.set(k, v); if (cache.size > 8) cache.delete(cache.keys().next().value); }
let epoch = 0; export const bumpEpoch = () => { epoch += 1; cache.clear(); };

// ENFORCEMENT dimension (from confirmed links only): inexec = an order in execution · suspended = none in execution, one suspended · closed = referred before, every order closed · ever = any of the three · none = never referred
function execMatches(st, ctx, i, exec) {
  const lk = ctx.mark ? (ctx.ov.get(i)?.link || 0) : 0; const srcCancelled = st.cancelDay[i] !== 0 && st.cancelDay[i] <= ctx.cutoffN;
  return exec === 'conflict' ? srcCancelled && (st.exec[i] >= 0 || lk >= 2 || lk === 5) : exec === 'inexec' ? lk === 2 : exec === 'suspended' ? lk === 3 : exec === 'closed' ? lk === 4 : exec === 'ever' ? lk >= 2 : exec === 'none' ? lk < 2
    : exec === 'yes' ? (st.exec[i] >= 0 || lk >= 2) : exec === 'no' ? (st.exec[i] < 0 && lk < 2) : true; // «yes» / «no»: the older two-value filter
}
const PROBLEM_TAGS = new Set(['amount_conflict', 'contract_unmatched', 'contract_unlinked', 'missing_fields', 'exclusion_pending', 'enforcement_candidate']);
/* ------------------------------------------------------------------ facets (docs/invoice-lists-redesign.md «Data-service contract»)
   A facet is the breakdown of the filtered population by ONE dimension, computed in the SAME pass as the list over the rows that match every
   current filter EXCEPT that dimension's own filter — so the chart that offers the alternatives still shows them after one is selected.
   Dimensions: product (scope.product + filters.product) · origin (scope.scopeType + filters.origin) · source = revenue source (scope.source + filters.source) · due (filters.dueState). */
const FACET_KEYS = ['product', 'origin', 'source', 'due'];
const DIM = { product: 1, origin: 2, source: 4, due: 8 };
const NF = 5; // count · collected · outstanding · gross · exclusionAmount
const ALL_SRC = new Uint8Array(SOURCES.length).fill(1);
const DUE_KEYS = ['overdue', 'notYetDue', 'unknown']; // bucket order of the facet; the filter values are overdue · not_due · unknown
const DUE_FILTER = { overdue: 0, not_due: 1, unknown: 2 };
/** the unpaid balance of a derived invoice (D): the outstanding amount, or — for an excluded invoice — the unpaid remainder that the exclusion removed from net */
const balanceOf = (D) => (D.outstanding > 0 ? D.outstanding : D.excluded && D.exclusionAmount > 0 ? D.exclusionAmount : 0);
/** due position of an invoice that still has a balance: 0 overdue · 1 not yet due · 2 due date unavailable (never read as overdue); -1 when nothing is owed */
const dueClassOf = (st, i, D) => (balanceOf(D) <= 0 ? -1 : !(st.due[i] > 0) ? 2 : D.daysOverdue > 0 ? 0 : 1);

export function candidates(st, req) {
  const ctx = makeCtx(st, req);
  const scFull = resolveScope(ctx, req.scope);
  const f = req.filters || {};
  const srch = resolveSearch(st, f.search, ctx.acc);
  const ageB = f.age && f.age !== 'all' ? ['0', '1-30', '31-90', '91-180', '180+'].indexOf(f.age) : -1;
  const stateIdx = f.state && f.state !== 'all' && f.state !== 'open' && f.state !== 'noncollected' && f.state !== 'paid' && f.state !== 'uncollected' ? CLASS_INDEX[f.state] : -1;
  const catIdx = f.category && f.category !== 'all' ? CLASS_INDEX[f.category] : -1; // the collection class on top of `state` (the uncollected page's «الحالة الإجرائية»)
  const ruleBit = f.rule && f.rule !== 'all' && f.rule !== 'none' && f.rule !== 'any' ? 1 << RULE_IDS.indexOf(f.rule) : 0;
  const cs = f.contract && f.contract !== 'all' ? (f.contract === 'issue' ? -2 : CSTAT.indexOf(f.contract)) : -1; // 'issue' = contract not matched or not linked
  const periodFilter = !f.allPeriods;
  const nc = f.nc || null; const ncO = nc ? newNc() : null; const ncN = nc ? ncAsOf(ctx, scFull) : ctx.cutoffN; // «تحليل أسباب عدم التحصيل»: the cohort is measured at the same date as the analysis
  const out = []; const sums = { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0, exclusionAmount: 0 };
  const lo = srch?.range ? srch.range[0] : 0; const hi = srch?.range ? srch.range[1] : st.n;
  const D = ctx.D;
  // the four facet dimensions: the list's own filter on each (scope + page filter) is evaluated here, not inside inScope, so a facet can leave exactly its own one out
  const wantF = Array.isArray(req.facets) && req.facets.length ? new Set(req.facets.filter((k) => FACET_KEYS.includes(k))) : null;
  const fProd = f.product && f.product !== 'all' && !(Array.isArray(f.product) && !f.product.length) ? new Set([].concat(f.product)) : null;
  const fOrg = f.origin === 'central' ? 0 : f.origin === 'internal' ? 1 : -1;
  const fSrc = f.source && f.source !== 'all' ? f.source : null;
  const dueSel = f.dueState && f.dueState !== 'all' ? DUE_FILTER[f.dueState] ?? -2 : -1; // an unknown value matches nothing
  const dimMode = !!(wantF && wantF.size) || !!fProd || fOrg >= 0 || !!fSrc;
  const sc = dimMode ? { ...scFull, srcOk: ALL_SRC, prodOk: null, scopeIdx: -1 } : scFull;
  const NP = PRODUCT_KEYS.length; const NS = SOURCES.length;
  const facet = wantF ? { product: wantF.has('product') ? new Float64Array(NP * NF) : null, origin: wantF.has('origin') ? new Float64Array(2 * NF) : null, source: wantF.has('source') ? new Float64Array(NS * NF) : null, due: wantF.has('due') ? new Float64Array(3 * 4 + 2) : null } : null;
  const byPay = { collected: 0, partial: 0, overdue: 0, not_due: 0, cancelled: 0 }; let excludedN = 0;
  const addF = (arr, k) => { const o = k * NF; arr[o] += 1; arr[o + 1] += D.collected; arr[o + 2] += D.outstanding; arr[o + 3] += D.gross; arr[o + 4] += D.exclusionAmount; };
  const consider = (i) => {
    if (st.issue[i] > ctx.cutoffN) return;
    if (!inScope(st, sc, i)) return;
    if (periodFilter && (st.issue[i] < sc.fromN || st.issue[i] > sc.toN)) return;
    if (cs >= 0 && st.cstat[i] !== cs) return;
    if (cs === -2 && st.cstat[i] !== 2 && st.cstat[i] !== 4) return;
    if (f.exec && f.exec !== 'all' && !execMatches(st, ctx, i, f.exec)) return;
    if (f.rule === 'none' && st.exMask[i]) return;
    if (f.rule === 'any' && !st.exMask[i]) return;
    if (ruleBit && !(st.exMask[i] & ruleBit)) return;
    let bad = 0; let oi = 0; let pi = 0;
    if (dimMode) {
      oi = originIdxOf(st.ent[i], st.scope[i]); pi = productIdxOf(st.src[i], st.item[i], oi);
      if (!(scFull.srcOk[st.src[i]] === 1 && (!fSrc || SOURCES[st.src[i]].key === fSrc))) bad |= DIM.source;
      if (!((!scFull.prodOk || scFull.prodOk[pi] === 1) && (!fProd || fProd.has(PRODUCT_KEYS[pi])))) bad |= DIM.product;
      if (!((scFull.scopeIdx < 0 || oi === scFull.scopeIdx) && (fOrg < 0 || oi === fOrg))) bad |= DIM.origin;
      if (bad && (!wantF || (bad & (bad - 1)))) return; // a row failing two dimensions belongs to no list and to no facet
    }
    derive(ctx, i, ncN);
    if (sc.statusSet && !sc.statusSet[D.cls]) return; // global invoice-status filter
    if (stateIdx >= 0 && D.cls !== stateIdx) return;
    if (catIdx >= 0 && D.cls !== catIdx) return;
    if (f.state === 'open' && !(D.outstanding > 0)) return;
    if (f.state === 'noncollected' && D.cls === CLASS_INDEX.collected) return;
    if (f.state === 'paid' && D.cls !== CLASS_INDEX.collected && D.cls !== CLASS_INDEX.partial) return; // the invoice register: invoices with money collected (in full or in part)
    if (f.state === 'uncollected' && !(D.outstanding > 0 || (D.excluded && D.exclusionAmount > 0))) return; // every uncollected, non-cancelled invoice — the EXCLUDED ones included (what the uncollected page lists)
    if (ageB >= 0 && !(D.outstanding > 0 && agingBucket(D.daysOverdue) === ageB)) return;
    if (f.ageMin != null && !(D.outstanding > 0 && !D.excluded && D.daysOverdue >= f.ageMin && D.daysOverdue <= f.ageMax)) return;
    // الفواتير القابلة للإحالة (D21): overdue, uncollected, not excluded or cancelled, with complete data and no order yet
    if (f.eligible && !(D.outstanding > 0 && D.daysOverdue > 0 && !D.excluded && !D.cancelled && D.link < 2 && st.exec[i] < 0 && !(st.flags[i] & (F.MISSING_ID | F.OBJECTION)) && D.cls !== CLASS_INDEX.linkage_unresolved)) return;
    if (f.primary && f.primary !== 'all' && !(D.excluded && D.primaryBit && (f.primary === 'any' || RULE_IDS[Math.round(Math.log2(D.primaryBit))] === f.primary))) return; // the exclusion register: an invoice appears ONCE, under its effective (primary) reason, so the reason counts add up to the excluded total
    if (f.reason && f.reason !== 'all') { const xr = exclusionOf(D); if (f.reason === 'none' ? D.excluded : f.reason === 'any' ? !D.excluded : !xr || xr.ruleId !== f.reason) return; } // the effective exclusion reason (the worklist's `reason`): none · any · a rule id
    if (f.payStatus && f.payStatus !== 'all' && D.payStatus !== f.payStatus) return; // the PAYMENT status (collected · partial · overdue · not_due · cancelled) — independent of any exclusion
    if (f.kind && f.kind !== 'all' && iimFields(st, i).invoiceKind !== f.kind) return; // نوع الفاتورة: occupancy / differences (tobacco and accommodation only)
    if (nc && !ncMatches(st, i, D, nc, ncO)) return; // exactly the invoices a non-collection bucket / group / reason counts
    if (f.planLine && !planLineMatches(st, ctx, i, D, f.planLine)) return; // exactly the invoices a planning action line counts (server/planningActions.js)
    if (f.tag) { const tg = tagsOf(st, i, D); if (f.tag === 'problem' ? !tg.some((x) => PROBLEM_TAGS.has(x)) : !tg.includes(f.tag)) return; }
    // due position (a dimension of its own): only an invoice with an unpaid balance has one — an excluded invoice is classified by its own due date
    const dc = dueClassOf(st, i, D);
    if (dueSel !== -1 && dc !== dueSel) bad |= DIM.due;
    if (bad & (bad - 1)) return;
    if (bad && !wantF) return;
    if (!bad) {
      out.push(i); sums.count += 1; sums.gross += D.gross; sums.exclusions += D.exclTotal; sums.net += D.net; sums.collected += D.collected; sums.outstanding += D.outstanding; sums.exclusionAmount += D.exclusionAmount;
      byPay[D.payStatus] += 1; if (D.excluded && D.exclusionAmount > 0) excludedN += 1;
    }
    if (facet) {
      if (facet.product && (!bad || bad === DIM.product)) addF(facet.product, pi);
      if (facet.origin && (!bad || bad === DIM.origin)) addF(facet.origin, oi);
      if (facet.source && (!bad || bad === DIM.source)) addF(facet.source, st.src[i]);
      if (facet.due && dc >= 0 && (!bad || bad === DIM.due)) { // overdue · not yet due · unknown over the unpaid NON-excluded population; the excluded ones are tallied apart (per bucket and in total)
        const o = dc * 4; if (D.excluded) { facet.due[o + 2] += 1; facet.due[o + 3] += D.exclusionAmount; facet.due[12] += 1; facet.due[13] += D.exclusionAmount; } else { facet.due[o] += 1; facet.due[o + 1] += D.outstanding; }
      }
    }
  };
  if (srch?.list) { for (const i of srch.list) consider(i); }
  else if (srch?.range) { for (let i = lo; i < hi; i += 1) consider(i); }
  else {
    const fxSet = srch?.fixtures ? new Set(srch.fixtures) : null;
    for (let i = 0; i < st.n; i += 1) {
      if (srch) { if (i < st.nGen) { if (!(srch.payer && srch.payer[st.payer[i]])) continue; } else if (!fxSet.has(i)) continue; }
      consider(i);
    }
  }
  return { ctx, sc: scFull, cand: Int32Array.from(out), sums, facets: facet ? facetOut(facet) : null, population: populationOf(f, sums, byPay, excludedN) };
}

const bucketOut = (arr, k, key, lab) => { const o = k * NF; return { key, labelAr: lab.ar, labelEn: lab.en, count: arr[o], collected: arr[o + 1], outstanding: arr[o + 2], gross: arr[o + 3], exclusionAmount: arr[o + 4] }; };
function facetOut(fc) {
  const r = {}; const keep = (x) => x.count > 0; // a bucket that holds no invoice is not listed
  if (fc.product) r.product = PRODUCT_KEYS.map((k, n) => bucketOut(fc.product, n, k, PRODUCTS[k])).filter(keep);
  if (fc.origin) r.origin = ['central', 'internal'].map((k, n) => bucketOut(fc.origin, n, k, { ar: ORIGIN_AR[k], en: ORIGIN_EN[k] })).filter(keep);
  if (fc.source) r.source = SOURCES.map((s, n) => bucketOut(fc.source, n, s.key, REVENUE_SOURCES[s.key] || { ar: s.key, en: s.key })).filter(keep);
  if (fc.due) {
    const d = fc.due; r.due = {};
    DUE_KEYS.forEach((k, n) => { r.due[k] = { count: d[n * 4], amount: d[n * 4 + 1], excludedCount: d[n * 4 + 2], excludedAmount: d[n * 4 + 3] }; });
    r.due.excluded = { count: d[12], amount: d[13] };
  }
  return r;
}

/** the register population in words (and its parts): which invoices the list holds, so a page can label every figure with its denominator */
const POPULATIONS = {
  all: { ar: 'كل الفواتير في النطاق', en: 'Every invoice in scope', includes: ['collected', 'partial', 'open', 'excluded', 'cancelled'] },
  paid: { ar: 'فواتير حُصّل منها مبلغ (كلياً أو جزئياً)', en: 'Invoices with money collected (in full or in part)', includes: ['collected', 'partial'] },
  collected: { ar: 'فواتير مسدّدة بالكامل', en: 'Fully paid invoices', includes: ['collected'] },
  partial: { ar: 'فواتير مسدّدة جزئياً', en: 'Partly paid invoices', includes: ['partial'] },
  uncollected: { ar: 'كل الفواتير غير المحصّلة (يشمل المستبعد)', en: 'Every uncollected invoice (excluded included)', includes: ['open', 'partial', 'excluded'] },
  open: { ar: 'فواتير عليها رصيد غير مسدَّد (دون المستبعد)', en: 'Invoices with an unpaid balance (excluded not included)', includes: ['open', 'partial'] },
  noncollected: { ar: 'كل الفواتير غير المحصّلة بالكامل', en: 'Every invoice not fully collected', includes: ['open', 'partial', 'excluded', 'cancelled'] }
};
function populationOf(f, sums, byPay, excludedN) {
  const key = POPULATIONS[f.state] ? f.state : 'all'; const p = POPULATIONS[key];
  // fullyPaid / partlyPaid are the PAYMENT status of the invoices in the list (an excluded invoice keeps its own payment status); excluded = the invoices with an exclusion on the unpaid remainder
  return { key, labelAr: p.ar, labelEn: p.en, includes: p.includes, count: sums.count, fullyPaid: byPay.collected, partlyPaid: byPay.partial, unpaid: byPay.overdue + byPay.not_due, excluded: excludedN, cancelled: byPay.cancelled };
}


export function list(st, req) {
  const page = Math.max(0, Number(req.page) || 0); const size = Math.min(500, Math.max(1, Number(req.pageSize) || 50));
  const sortKey = SORT_KEYS[req.sort?.key] || 'issue'; const dir = req.sort?.dir === 'asc' ? 1 : -1;
  const facetReq = Array.isArray(req.facets) ? FACET_KEYS.filter((k) => req.facets.includes(k)).join(',') : '';
  const ck = JSON.stringify([epoch, accessKeyOf(req.access), req.scope, req.cfg, req.filters, facetReq, req.decisions && hashOf(JSON.stringify(req.decisions)), req.links && hashOf(JSON.stringify(req.links)), req.fileExclusions && hashOf(JSON.stringify(req.fileExclusions)), req.owner, sortKey, dir]); // the CONTENT of the review overlay (not just its size): a link moving from proposed to confirmed, or open to closed, must not return a cached page; every filter and the facet request are part of the key
  let hit = lruGet(ck);
  if (!hit) {
    const { ctx, cand, sums, facets, population } = candidates(st, { ...req, facets: facetReq ? facetReq.split(',') : null });
    let order;
    if (sortKey === 'id') { order = Int32Array.from(cand); if (dir < 0) order.reverse(); }
    else {
      const keys = new Float64Array(cand.length);
      let thr = null; let maxAmt = 1; let maxAge = 1;
      if (sortKey === 'priority') { // the level first (high > medium > low), the old ranking score (amount · aging · actionability · evidence) inside a level
        thr = amountThresholds(st, req);
        for (let j = 0; j < cand.length; j += 1) { derive(ctx, cand[j], ctx.cutoffN); const bal = balanceOf(ctx.D); if (bal > maxAmt) maxAmt = bal; if (ctx.D.daysOverdue > maxAge && st.due[cand[j]] > 0) maxAge = ctx.D.daysOverdue; }
      }
      for (let j = 0; j < cand.length; j += 1) {
        const i = cand[j];
        if (sortKey === 'issue') keys[j] = st.issue[i]; else if (sortKey === 'gross') keys[j] = st.gross[i];
        else {
          derive(ctx, i, ctx.cutoffN); const D = ctx.D;
          keys[j] = sortKey === 'outstanding' ? D.outstanding : sortKey === 'collected' ? D.collected : sortKey === 'exclusionAmount' ? D.exclusionAmount : sortKey === 'uncollected' ? D.outstanding + D.exclusionAmount
            : sortKey === 'priority' ? priorityKey(st, i, D, thr, maxAmt, maxAge) : D.outstanding > 0 ? D.daysOverdue : 0;
        }
      }
      const perm = new Uint32Array(cand.length); for (let j = 0; j < perm.length; j += 1) perm[j] = j;
      perm.sort((a, b) => (keys[a] - keys[b]) * dir || a - b); // typed-array sort: no allocation per comparison
      order = new Int32Array(cand.length); for (let j = 0; j < perm.length; j += 1) order[j] = cand[perm[j]];
    }
    hit = { order, sums, total: cand.length, facets, population };
    lruSet(ck, hit);
  }
  const ctx = makeCtx(st, req); const ncN = req.withNc ? ncAsOf(ctx, resolveScope(ctx, req.scope)) : ctx.cutoffN;
  const thr = req.withPriority ? amountThresholds(st, req) : null; const nco = req.withPriority ? newNc() : null;
  const rows = [];
  for (let j = page * size; j < Math.min(hit.total, (page + 1) * size); j += 1) {
    const i = hit.order[j]; derive(ctx, i, ncN);
    const row = rowOut(st, ctx, i, ctx.D);
    row.uncollected = row.outstanding + row.exclusionAmount; // the unpaid amount of the invoice whether or not an exclusion removed it from net
    if (req.withNc) row.nc = ncRow(st, ctx, i, ctx.D);
    if (req.withPriority) { Object.assign(row, priorityRow(st, i, ctx.D, thr, nco)); }
    if (req.withExclusions) { // the exclusion register needs the evidence records of the rows on this page only
      const D = ctx.D;
      row.exclusions = materialize(st, i, ctx).exclusions; row.cancelled = D.cancelled; row.excluded = D.excluded; row.billedAfterAdj = D.billed;
      row.reasonRules = RULE_IDS.filter((_, b) => D.mask & (1 << b)); row.primaryRuleId = D.primaryBit ? RULE_IDS[Math.round(Math.log2(D.primaryBit))] : null;
    }
    rows.push(row);
  }
  const res = { total: hit.total, page, pageSize: size, sums: hit.sums, population: hit.population, rows };
  if (hit.facets) res.facets = hit.facets;
  return res;
}

/* ------------------------------------------------------------------ priority: High · Medium · Low (no numeric score is ever shown)
   Same inputs as the worklist ranking — the unpaid amount, the overdue age, the evidence quality (and, through the class, the actionability) — read by a transparent rule:
   amount tier  large = at or above the 90th percentile of the unpaid, non-excluded balances of the whole dataset · medium = at or above the 75th · small = below
   age tier     more than 180 days overdue · 91–180 · 31–90 · 1–30 · not overdue
   HIGH    overdue, and (more than 180 days with a medium-or-larger amount, or a large amount more than 30 days overdue)
   MEDIUM  overdue and not high, and (more than 90 days, or a medium-or-larger amount) — a large amount overdue 1–30 days is medium
   LOW     overdue 1–90 days with a small amount · not yet due · excluded (no collection action; the exclusion reason is on the invoice) · fully paid / cancelled has no priority (null)
   Due date unavailable: medium for a large amount, otherwise low (its age cannot be assessed) — never read as overdue.
   Caps: incomplete evidence (quality below 0.8: an amount conflict, a missing payer identifier or several smaller gaps) or an objection under review lowers HIGH to MEDIUM — the data or the objection is settled first. */
const thrCache = new WeakMap();
export const PRIORITY_RULES = { amountPercentiles: { medium: 0.75, large: 0.9 }, severeDays: 180, lateDays: 90, youngDays: 30, evidenceMin: 0.8 };
/** the store-wide amount thresholds (a sample of at most ~100k invoices, deterministic): unpaid non-excluded balances at the cut-off, regardless of filters, so an invoice keeps its priority whatever the user filters */
function amountThresholds(st, req) {
  const ctx = makeCtx(st, { cfg: req.cfg, owner: 0 }); const key = `${epoch}|${ctx.cutoffN}|${ctx.graceDays}|${st.n}`;
  const c = thrCache.get(st); if (c && c.key === key) return c.thr;
  const step = Math.max(1, Math.floor(st.n / 100000)); const vals = []; const D = ctx.D;
  for (let i = 0; i < st.n; i += step) {
    if (st.owner[i] !== 0 || st.issue[i] > ctx.cutoffN) continue;
    derive(ctx, i, ctx.cutoffN); if (D.outstanding > 0 && !D.excluded && !D.cancelled) vals.push(D.outstanding);
  }
  vals.sort((a, b) => a - b);
  const at = (p) => (vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * (vals.length - 1)))] : Infinity);
  const thr = { medium: at(PRIORITY_RULES.amountPercentiles.medium), large: at(PRIORITY_RULES.amountPercentiles.large), n: vals.length };
  thrCache.set(st, { key, thr });
  return thr;
}
const LEVEL_RANK = { low: 0, medium: 1, high: 2 };
/** the priority decision of one derived invoice: { level, amt (0 small · 1 medium · 2 large), age (0 none · 1 1–30 · 2 31–90 · 3 91–180 · 4 over 180), why-code } or null when nothing is owed */
function priorityCore(st, i, D, thr) {
  const bal = balanceOf(D); if (bal <= 0) return null;
  const amt = bal >= thr.large ? 2 : bal >= thr.medium ? 1 : 0;
  const unknown = !(st.due[i] > 0); const days = unknown ? 0 : D.daysOverdue;
  const age = days > 180 ? 4 : days > 90 ? 3 : days > 30 ? 2 : days > 0 ? 1 : 0;
  if (D.excluded) return { level: 'low', amt, age, days, code: 'excluded', bal };
  if (unknown) return { level: amt === 2 ? 'medium' : 'low', amt, age: 0, days: 0, code: 'unknown', bal };
  if (age === 0) return { level: 'low', amt, age, days, code: 'not_due', bal };
  let level = (age === 4 && amt >= 1) || (amt === 2 && age >= 2) ? 'high' : (age >= 3 || amt >= 1) ? 'medium' : 'low';
  let code = level;
  if (level === 'high') {
    if (evidenceQuality(st, i, D) < PRIORITY_RULES.evidenceMin) { level = 'medium'; code = 'cap_evidence'; }
    else if (D.cls === CLASS_INDEX.objection) { level = 'medium'; code = 'cap_objection'; }
  }
  return { level, amt, age, days, code, bal };
}
function priorityKey(st, i, D, thr, maxAmt, maxAge) {
  const p = priorityCore(st, i, D, thr); if (!p) return -1;
  const ev = evidenceQuality(st, i, D); const act = ACT[CLASSES[D.cls]] ?? 0.3;
  return LEVEL_RANK[p.level] * 10 + (W_.amount * (p.bal / maxAmt) + W_.aging * (p.days / maxAge) + W_.actionability * act + W_.evidence * ev);
}
const AMT_WORD = [{ ar: 'مبلغ صغير', en: 'a small amount' }, { ar: 'مبلغ متوسط', en: 'a medium amount' }, { ar: 'مبلغ كبير', en: 'a large amount' }];
const AMT_RULE = [{ ar: 'أقل من أعلى 25٪ من الأرصدة غير المسددة', en: 'below the top 25% of unpaid balances' }, { ar: 'ضمن أعلى 25٪ من الأرصدة غير المسددة', en: 'in the top 25% of unpaid balances' }, { ar: 'ضمن أعلى 10٪ من الأرصدة غير المسددة', en: 'in the top 10% of unpaid balances' }];
const AGE_WORD = [null, { ar: 'متأخر 1–30 يوماً', en: 'overdue 1–30 days' }, { ar: 'متأخر 31–90 يوماً', en: 'overdue 31–90 days' }, { ar: 'متأخر 91–180 يوماً', en: 'overdue 91–180 days' }, { ar: 'متأخر أكثر من 180 يوماً', en: 'overdue more than 180 days' }];
const EXCLUDED_NEXT = { ar: 'مستبعدة من صافي غير المحصّل — لا إجراء تحصيل؛ راجع سبب الاستبعاد', en: 'Excluded from net uncollected — no collection action; see the exclusion reason' };
function whyOf(p) {
  const A = AMT_WORD[p.amt]; const G = AGE_WORD[p.age];
  switch (p.code) {
    case 'excluded': return { ar: 'مستبعدة — لا إجراء تحصيل عليها', en: 'Excluded — no collection action' };
    case 'unknown': return { ar: `${A.ar}، وتاريخ الاستحقاق غير متاح فلا يمكن تقدير التأخر`, en: `${A.en[0].toUpperCase()}${A.en.slice(1)}; the due date is unavailable, so lateness cannot be assessed` };
    case 'not_due': return { ar: 'لم يحن موعد الاستحقاق بعد', en: 'Not yet due' };
    case 'cap_evidence': return { ar: `${A.ar} و${G.ar}، لكن الدليل ناقص — تُحسم البيانات أولاً`, en: `${A.en[0].toUpperCase()}${A.en.slice(1)} and ${G.en}, but the evidence is incomplete — settle the data first` };
    case 'cap_objection': return { ar: `${A.ar} و${G.ar}، لكن عليها اعتراض قيد المراجعة`, en: `${A.en[0].toUpperCase()}${A.en.slice(1)} and ${G.en}, but an objection is under review` };
    default: return { ar: `${A.ar} و${G.ar}`, en: `${A.en[0].toUpperCase()}${A.en.slice(1)}, ${G.en}` };
  }
}
/** `priority` and `nextStep` of a list row (req.withPriority) — null for an invoice with nothing owed */
function priorityRow(st, i, D, thr, nco) {
  const p = priorityCore(st, i, D, thr);
  if (!p) return { priority: null, nextStep: null };
  const ev = evidenceQuality(st, i, D);
  const factors = [
    { label: { ar: 'المبلغ غير المسدّد', en: 'Unpaid amount' }, value: { ar: `${AMT_WORD[p.amt].ar.replace('مبلغ ', '')} (${AMT_RULE[p.amt].ar})`, en: `${['Small', 'Medium', 'Large'][p.amt]} (${AMT_RULE[p.amt].en})` } },
    { label: { ar: 'موقف الاستحقاق', en: 'Due position' }, value: p.code === 'unknown' ? { ar: 'تاريخ الاستحقاق غير متاح', en: 'Due date unavailable' } : p.age ? AGE_WORD[p.age] : { ar: 'لم يحن بعد', en: 'Not yet due' } },
    { label: { ar: 'اكتمال الدليل', en: 'Evidence' }, value: ev >= PRIORITY_RULES.evidenceMin ? { ar: 'مكتمل', en: 'Complete' } : { ar: 'ناقص', en: 'Incomplete' } }
  ];
  if (D.excluded) factors.push({ label: { ar: 'الاستبعاد', en: 'Exclusion' }, value: { ar: 'مستبعدة', en: 'Excluded' } });
  let nextStep = EXCLUDED_NEXT;
  if (!D.excluded) { ncClassify(st, i, D, nco); const g = NC_GROUPS[nco.group]; nextStep = g ? { ar: g.nextStepAr, en: g.nextStepEn } : null; }
  return { priority: { level: p.level, why: whyOf(p), factors }, nextStep };
}

/* ------------------------------------------------------------------ CSV export (streamed in chunks) */
export const EXPORT_COLUMNS = ['invoice_id', 'sadad_no', 'issue_date', 'due_date', 'amanah_en', 'amanah_ar', 'municipality_ar', 'scope', 'revenue_source', 'supplying_system', 'revenue_item', 'amount_sar', 'collected_sar', 'outstanding_sar', 'cancelled_sar', 'excluded_sar', 'exclusions_sar', 'net_billed_sar', 'uncollected_sar', 'collection_class', 'status_tahseel_raw', 'status_efaa_raw', 'days_overdue', 'contract_no', 'exclusion_rules', 'line_items', 'demo_data', 'invoice_number', 'gfs_code', 'amanah_id', 'municipality_id', 'invoice_composite_key', 'exclusion_reason_ar', 'exclusion_reason_en', 'payment_status', 'priority', 'exclusion_flag', 'municipality_ref_id', 'municipality_status', 'municipality_source_value'];
const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function* exportChunks(st, req, chunk = 4000) {
  const { ctx, cand } = candidates(st, { ...req, facets: null }); // ALL filtered rows, never the page; no facet is computed for a file
  const thr = amountThresholds(st, req);
  // ONE comment line (the header stays on line 2): every filtered result is in the file, then the synthetic-data provenance
  yield `﻿# يشمل كل النتائج المصفّاة (${cand.length}) — includes all ${cand.length} filtered results · demo data: synthetic, inspired by the monthly reports — not the Ministry's actual data. Amounts are exact values in SAR\n${EXPORT_COLUMNS.join(',')}\n`;
  let buf = [];
  for (let j = 0; j < cand.length; j += 1) {
    const i = cand[j]; derive(ctx, i, ctx.cutoffN);
    const r = rowOut(st, ctx, i, ctx.D);
    const sadad = i < st.nGen ? sadadOf(st.idKey[i]) : st.fixtures.get(i)?.sadadNo || '';
    const pr = priorityCore(st, i, ctx.D, thr);
    buf.push([r.id, sadad, r.issueDate, r.dueDate, r.amanahEn, r.amanahAr, r.municipalityAr || '', r.scopeType, r.source, r.platform, r.itemEn, r.gross, r.collected, r.outstanding, r.cancelledAmount, r.exclusionAmount, r.exclusions, r.net, r.outstanding, r.cls, r.statusRawTahseel, r.statusRawEfaa || '', r.daysOverdue, r.contractNo || '', r.rules.join('|'), r.lines, 'تجريبية', r.invoiceNo, r.gfsCode || '', r.amanahId || '', r.municipalityId || '', r.compositeKey || '', r.exclusionReason?.reasonAr || '', r.exclusionReason?.reasonEn || '', r.payStatus, pr ? pr.level : '', r.exclusionAmount > 0 ? 'excluded' : '', r.municipalityRefId || '', r.municipalityStatus || '', r.municipalitySourceValue || ''].map(q).join(','));
    if (buf.length >= chunk) { yield `${buf.join('\n')}\n`; buf = []; }
  }
  if (buf.length) yield `${buf.join('\n')}\n`;
}

/* ------------------------------------------------------------------ worklists */
const ACT = { excluded: 0.05, overdue: 1, partial: 0.85, linkage_unresolved: 0.5, ineligible_referral: 0.35, enforcement: 0.45, objection: 0.2, not_due: 0.1 };
const W_ = { amount: 0.4, aging: 0.25, actionability: 0.25, evidence: 0.1 };
function evidenceQuality(st, i, D) {
  let qv = 1; const f = st.flags[i]; const cs = st.cstat[i];
  if (f & F.AMT_CONFLICT) qv -= 0.4; if (f & F.MISSING_ID) qv -= 0.25; if (st.src[i] === 0 && (cs === 4 || cs === 2)) qv -= 0.2; if (cs === 5) qv -= 0.05; if (D.pendingMask) qv -= 0.1;
  return Math.max(0.1, qv);
}
export function worklist(st, req) {
  const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope); const D = ctx.D;
  const limit = Math.min(500, req.limit || 100);
  let maxAmt = 1; let maxAge = 1; let total = 0; let totalOut = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    var top = pass === 1 ? new TopK(limit) : null; // eslint-disable-line no-var
    for (let i = 0; i < st.n; i += 1) {
      if (st.issue[i] > ctx.cutoffN || st.issue[i] < sc.fromN || st.issue[i] > sc.toN || !inScope(st, sc, i)) continue;
      derive(ctx, i, ctx.cutoffN);
      // IIM-06: the list shows ALL uncollected invoices — the excluded ones included (they are uncollected too); a reason filter narrows it
      const exIn = D.excluded && req.includeExcluded; const bal = exIn ? D.exclusionAmount : D.outstanding;
      if (!exIn && (!(D.outstanding > 0) || D.excluded || D.cls === CLASS_INDEX.collected)) continue;
      if (!(bal > 0)) continue;
      if (sc.statusSet && !sc.statusSet[D.cls]) continue; // the scope's invoice-status / due-position filter (the same one the list, the KPIs and the export apply)
      if (req.category && req.category !== 'all' && CLASSES[D.cls] !== req.category) continue;
      if (req.payStatus && req.payStatus !== 'all' && D.payStatus !== req.payStatus) continue; // the PAYMENT status — independent of any exclusion
      if (req.exec && req.exec !== 'all' && !execMatches(st, ctx, i, req.exec)) continue; // the enforcement dimension (confirmed links)
      if (req.kind && req.kind !== 'all' && iimFields(st, i).invoiceKind !== req.kind) continue;
      if (req.reason && req.reason !== 'all') { const xr = exclusionOf(D); if (req.reason === 'none' ? D.excluded : req.reason === 'any' ? !D.excluded : !xr || xr.ruleId !== req.reason) continue; }
      if (pass === 0) { total += 1; totalOut += bal; if (bal > maxAmt) maxAmt = bal; if (D.daysOverdue > maxAge) maxAge = D.daysOverdue; continue; }
      const ev = evidenceQuality(st, i, D); const act = ACT[CLASSES[D.cls]] ?? 0.3;
      top.push(i, W_.amount * (bal / maxAmt) + W_.aging * (D.daysOverdue / maxAge) + W_.actionability * act + W_.evidence * ev);
    }
    if (pass === 1) {
      const rows = top.sorted().map(([i, score]) => { derive(ctx, i, ctx.cutoffN); const r = rowOut(st, ctx, i, D); return { ...r, category: r.cls, uncollected: r.outstanding + r.exclusionAmount, actionability: ACT[r.cls] ?? 0.3, evidenceQuality: Math.round(evidenceQuality(st, i, D) * 100) / 100, score: Math.round(score * 1000) / 1000 }; });
      return { total, totalOutstanding: totalOut, rows };
    }
  }
  return null;
}

export function anomalies(st, req) {
  const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope); const D = ctx.D; const limit = Math.min(300, req.limit || 100);
  const top = new TopK(limit); const counts = {}; let total = 0;
  const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
  const group = Array.isArray(req.codes) && req.codes.length ? new Set(req.codes) : null; // a page may ask for one GROUP of issue codes: only those count toward the total and the ranking
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || st.issue[i] < sc.fromN || st.issue[i] > sc.toN || !inScope(st, sc, i)) continue;
    derive(ctx, i, ctx.cutoffN);
    const f = st.flags[i]; const found = []; // [code, severity]
    if (f & F.AMT_CONFLICT) found.push(['amount_conflict', 3]);
    if (D.pendingMask) found.push(['exclusion_pending', 2]);
    if (f & F.MISSING_ID) found.push(['missing_fields', 2]);
    if (st.src[i] === 0 && st.cstat[i] === 4) found.push(['contract_unlinked', 2]);
    if (st.src[i] === 0 && st.cstat[i] === 2) found.push(['contract_unmatched', 2]);
    if (D.link === 1) found.push(['enforcement_candidate', 2]);
    if (D.excluded && D.received > 0) found.push(['receipts_on_excluded', 3]);
    if (st.src[i] === 0) { const oc = investmentOutcome(st, i, iimFields(st, i)); if (oc === 'not_linked') found.push(['investment_no_contract', 2]); } // IIM-16: a central investment invoice that Furas does not know
    const inGroup = group ? found.filter(([c]) => group.has(c)) : found;
    let sev = 0; const codes = []; for (const [c, v] of inGroup) { codes.push(c); sev = Math.max(sev, v); }
    for (const c of codes) bump(c);
    if (sev && (!req.code || req.code === 'all' || codes.includes(req.code))) { total += 1; top.push(i, sev * 1e12 + st.gross[i]); }
  }
  const rows = top.sorted().map(([i]) => { derive(ctx, i, ctx.cutoffN); return rowOut(st, ctx, i, D); });
  return { total, counts, rows };
}

void CHANNELS; void violationOf; void subscriptionOf; void dayNum;
