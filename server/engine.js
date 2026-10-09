// ============================================================================
// Columnar revenue engine. Computes the SAME metrics as the object engine in
// src/data/revenueMetrics.js (tests assert parity on a scaled world), but as tight
// loops over typed arrays, so a scope change over a million invoices takes tens of
// milliseconds instead of seconds and the browser never holds the invoices.
// ============================================================================
import { ENTITIES, ENT_UNASSIGNED, SOURCES, F, RULE_IDS, RULE_BIT, CSTAT, CHANNELS, ENTITY_INDEX, SOURCE_INDEX, ITEMS, dayNum, isoOf, municipalityOf } from '../src/data/catalog.js';
import { normalizeConfig, EXCLUSION_RULES, EXCLUSION_RULE_SET_VERSION, ratio, ppChange, NONCOLLECTION_CATEGORIES } from '../src/data/revenueMetrics.js';
import { invoiceIdOf, parseInvoiceId, idKeyFromSadad, idKeyFromSubscription, idKeyFromViolation, payerName, payerPool } from './names.js';
import { HOUSING_PAYER_BASE } from './world.js';

export const CLASSES = ['collected', 'cancelled', 'excluded', 'objection', 'enforcement', 'linkage_unresolved', 'ineligible_referral', 'partial', 'overdue', 'not_due'];
const C = Object.fromEntries(CLASSES.map((c, i) => [c, i]));
export const CLASS_INDEX = C;

const RULES = EXCLUSION_RULES.map((r, i) => ({ id: r.id, bit: 1 << i, priority: r.priority, approved: r.approval === 'approved', category: r.category, locked: r.locked }));
if (RULES.some((r, i) => r.id !== RULE_IDS[i])) throw new Error('rule order mismatch between catalog and revenueMetrics');
const OBJ_BIT = RULE_BIT['OBJ-1']; const CR_BIT = RULE_BIT['CR-1'];
const BY_PRIORITY = [...RULES].sort((a, b) => a.priority - b.priority);
const NBITS = RULES.length;

// aggregate layout (one Float64Array row per group)
const K = 22;
const M = { exclusionsRules: 21, count: 0, gross: 1, adjustments: 2, exclusions: 3, net: 4, collected: 5, outstanding: 6, overpayment: 7, receiptsOnExcluded: 8, excludedCount: 9, cancelled: 10, cancelledCount: 11, overlapCount: 12, overlapAmount: 13, multiReasonCount: 14, exclusionsApproved: 15, exclusionsUnapproved: 16, overdueOutstanding: 17, notDueOutstanding: 18, violationCount: 19, enforcementCount: 20 };

class Acc {
  constructor(groups) { this.a = new Float64Array(groups * K); this.groups = groups; }
  add(g, D) {
    const a = this.a; const o = g * K;
    a[o + M.count] += 1; a[o + M.gross] += D.gross; a[o + M.adjustments] += D.adj; a[o + M.exclusions] += D.exclTotal; a[o + M.exclusionsRules] += D.exclusionAmount; a[o + M.net] += D.net; a[o + M.collected] += D.collected;
    a[o + M.outstanding] += D.outstanding; a[o + M.overpayment] += D.overpayment;
    if (D.excluded) { a[o + M.excludedCount] += 1; if (D.nReasons > 1) a[o + M.multiReasonCount] += 1; if (D.primaryApproved) a[o + M.exclusionsApproved] += D.exclusionAmount; else a[o + M.exclusionsUnapproved] += D.exclusionAmount; }
    if (D.cancelled) { a[o + M.cancelled] += D.cancelledAmount; a[o + M.cancelledCount] += 1; }
    if (D.overlaps) { a[o + M.overlapCount] += 1; a[o + M.overlapAmount] += D.cancelledAmount; if (D.nReasons > 1) a[o + M.multiReasonCount] += 1; }
    if (D.outstanding > 0) { if (D.daysOverdue > 0) a[o + M.overdueOutstanding] += D.outstanding; else a[o + M.notDueOutstanding] += D.outstanding; }
  }
  addMeta(g, viol, enf) { const o = g * K; if (viol) this.a[o + M.violationCount] += 1; if (enf) this.a[o + M.enforcementCount] += 1; }
  toAgg(g) {
    const a = this.a; const o = g * K; const r = {};
    for (const [k, i] of Object.entries(M)) r[k] = a[o + i];
    r.billedAfterAdj = r.gross; // gross billed already includes approved adjustments: ONE definition everywhere
    r.grossBeforeAdjustments = r.gross - r.adjustments;
    r.collectedOverNet = ratio(r.collected, r.net);
    r.exclusionRate = ratio(r.exclusions, r.gross); // exclusions ÷ gross billed × 100
    r.collectedOverGross = ratio(r.collected, r.gross);
    r.exclusionKpiImpactPp = ppChange(r.collectedOverNet, r.collectedOverGross);
    return r;
  }
}

class TopK {
  constructor(k) { this.k = k; this.idx = []; this.val = []; this.min = -Infinity; }
  push(i, v) {
    if (this.idx.length < this.k) { this.idx.push(i); this.val.push(v); if (this.idx.length === this.k) this.recalc(); return; }
    if (v <= this.min) return;
    const j = this.val.indexOf(this.min); this.idx[j] = i; this.val[j] = v; this.recalc();
  }
  recalc() { this.min = Math.min(...this.val); }
  sorted() { return this.idx.map((i, j) => [i, this.val[j]]).sort((a, b) => b[1] - a[1]); }
}

/* ------------------------------------------------------------------ id lookup */
export function lookupId(st, id) {
  const s = String(id || '').trim();
  if (st.fixtureById.has(s)) return st.fixtureById.get(s);
  const key = parseInvoiceId(s);
  if (key == null) return -1;
  let lo = 0; let hi = st.nGen - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; const v = st.idKey[mid]; if (v === key) return mid; if (v < key) lo = mid + 1; else hi = mid - 1; }
  return -1;
}
function lowerBound(st, key) { let lo = 0; let hi = st.nGen; while (lo < hi) { const mid = (lo + hi) >> 1; if (st.idKey[mid] < key) lo = mid + 1; else hi = mid; } return lo; }
export function idOf(st, i) { if (i >= st.nGen) return st.fixtures.get(i)?.id ?? `X-${i}`; return invoiceIdOf(st.idKey[i]); }

/* ------------------------------------------------------------------ context */
export function makeCtx(st, req = {}) {
  const cfg = normalizeConfig(req.cfg || {});
  const cutoffN = dayNum(cfg.cutoff);
  const ctx = { st, cfg, cutoffN, owner: Number(req.owner) || 0, graceDays: cfg.graceDays || 0, periodEndMode: cfg.collectionsAsOf === 'periodEnd' };
  let enabled = 0; RULES.forEach((r) => { if (cfg.rules[r.id] && !r.locked) enabled |= r.bit; });
  ctx.enabled = enabled; ctx.objOn = !!cfg.rules['OBJ-1'];
  ctx.crOk = [true, true, false, false, false]; // 0 none (legacy: always qualifies), 1 Active (never), then by cfg
  const names = ['', 'Active', 'Deleted', 'Suspended', 'Cancelled'];
  ctx.crOk = names.map((n, k) => (k === 0 ? true : (cfg.crStatuses || []).includes(n)));
  // overlay: review decisions + enforcement links held by the client
  ctx.mark = null; ctx.ov = new Map();
  const dec = req.decisions || {}; const links = req.links || {};
  const need = Object.keys(dec).length + Object.keys(links).length;
  if (need) {
    ctx.mark = new Uint8Array(st.n);
    for (const [id, d] of Object.entries(dec)) {
      const i = lookupId(st, id); if (i < 0) continue;
      const byRule = d.byRule || (d.exclusion ? { [d.ruleId || '_primary']: d } : null); if (!byRule) continue;
      const o = ctx.ov.get(i) || { set: 0, clr: 0, rej: 0, link: 0 };
      for (const [ruleId, x] of Object.entries(byRule)) {
        const bit = ruleId === '_primary' ? primaryBitOfMask(st.exMask[i]) : RULE_BIT[ruleId]; if (!bit || !x?.exclusion) continue;
        const rs = x.exclusion.reviewStatus;
        if (rs === 'approved') { o.set |= bit; o.clr &= ~bit; o.rej &= ~bit; } else if (rs === 'rejected') { o.clr |= bit; o.set &= ~bit; o.rej |= bit; } else { o.clr |= bit; o.set &= ~bit; o.rej &= ~bit; }
      }
      ctx.ov.set(i, o); ctx.mark[i] = 1;
    }
    for (const [id, status] of Object.entries(links)) {
      const i = lookupId(st, id); if (i < 0) continue;
      const o = ctx.ov.get(i) || { set: 0, clr: 0, rej: 0, link: 0 };
      o.link = status === 'confirmed' ? 2 : status === 'candidate' ? 1 : 0; ctx.ov.set(i, o); ctx.mark[i] = 1;
    }
  }
  ctx.D = { gross: 0, adj: 0, billed: 0, received: 0, cancelled: false, overlaps: false, cancelledAmount: 0, mask: 0, nReasons: 0, primaryBit: 0, primaryApproved: false, excluded: false, exclusionAmount: 0, net: 0, collected: 0, overpayment: 0, outstanding: 0, daysOverdue: 0, cls: 0, pendingMask: 0, link: 0, exclTotal: 0 };
  return ctx;
}
function primaryBitOfMask(mask) { for (const r of BY_PRIORITY) if (mask & r.bit) return r.bit; return 0; }
const popcount = (x) => { let n = 0; while (x) { n += x & 1; x >>>= 1; } return n; };

/* ------------------------------------------------------------------ derive one row (no allocation) */
export function derive(ctx, i, asOfN) {
  const st = ctx.st; const D = ctx.D; const flags = st.flags[i];
  const adj = st.adjDay[i] && st.adjDay[i] <= asOfN ? st.adjAmt[i] : 0;
  const billed = st.gross[i] + adj; // gross billed = invoice value before exclusions (approved adjustments included)
  let appr = st.exAppr[i]; let link = 0; let pending;
  if (ctx.mark && ctx.mark[i]) { const o = ctx.ov.get(i); appr = (appr & ~o.clr) | o.set; link = o.link; pending = st.exMask[i] & ~appr & ~o.rej; } else pending = st.exMask[i] & ~appr;
  let m = st.exMask[i] & appr & ctx.enabled;
  if (m & CR_BIT) { const cs = st.crSt[i]; if (!ctx.crOk[cs]) m &= ~CR_BIT; }
  if (ctx.objOn && (flags & F.OBJECTION) && !(m & OBJ_BIT)) m |= OBJ_BIT;
  let primaryBit = 0; let primaryApproved = false;
  if (m) for (const r of BY_PRIORITY) if (m & r.bit) { primaryBit = r.bit; primaryApproved = r.approved; break; }
  let received = 0; const ps = st.payStart[i]; const pc = st.payCount[i];
  for (let p = ps; p < ps + pc; p += 1) if (st.pDay[p] <= asOfN) received += st.pAmt[p];
  const cd = st.cancelDay[i];
  const cancelled = cd !== 0 && cd <= asOfN && link !== 2;
  const excluded = !cancelled && m !== 0;
  const overlaps = cancelled && m !== 0;
  const cancelledAmount = cancelled ? Math.max(0, billed - received) : 0;
  const base = Math.max(billed - cancelledAmount, 0);
  const collected = excluded ? 0 : Math.min(received, base);
  const overpayment = excluded ? 0 : Math.max(0, received - base);
  const outstanding = excluded || cancelled ? 0 : Math.max(0, billed - received);
  const daysOverdue = Math.max(0, ctx.cutoffN - (st.due[i] + ctx.graceDays));
  D.gross = billed; D.adj = adj; D.billed = billed; D.received = received; D.cancelled = cancelled; D.overlaps = overlaps; D.cancelledAmount = cancelledAmount;
  // every exclusion (cancelled or rule-excluded) leaves gross exactly once, whatever the number of reasons: exclTotal = billed - net
  D.mask = m; D.nReasons = m ? popcount(m) : 0; D.primaryBit = primaryBit; D.primaryApproved = primaryApproved; D.excluded = excluded;
  D.exclusionAmount = excluded ? billed : 0; D.net = excluded ? 0 : billed - cancelledAmount;
  D.exclTotal = billed - D.net; D.collected = collected; D.overpayment = overpayment;
  D.outstanding = outstanding; D.daysOverdue = daysOverdue; D.pendingMask = pending; D.link = link;
  // classification (mirror of classifyRecord)
  let cls;
  if (cancelled) cls = C.cancelled;
  else if (excluded) cls = C.excluded;
  else if (outstanding <= 0) cls = C.collected;
  else {
    const isPartial = received > 0 && outstanding > 0; const isOverdue = daysOverdue > 0; const cs = st.cstat[i];
    if (flags & F.OBJECTION) cls = C.objection;
    else if (link === 2) cls = C.enforcement;
    else if ((flags & F.LEGACY_CANCELLED) || link === 1 || (st.src[i] === 0 && (cs === 2 || cs === 4) && isOverdue)) cls = C.linkage_unresolved;
    else if (isOverdue && (flags & F.MISSING_ID)) cls = C.ineligible_referral;
    else if (isPartial) cls = C.partial;
    else if (isOverdue) cls = C.overdue;
    else cls = C.not_due;
  }
  D.cls = cls;
  return D;
}

/* ------------------------------------------------------------------ scope */
export function resolveScope(ctx, scope = {}) {
  const st = ctx.st; const cfg = ctx.cfg;
  const toS = scope.to || cfg.cutoff; const fromS = scope.from || `${cfg.cutoff.slice(0, 4)}-01-01`;
  const out = { owner: ctx.owner, from: fromS, to: toS, fromN: dayNum(fromS), toN: Math.min(dayNum(toS), ctx.cutoffN), entOk: new Uint8Array(ENTITIES.length), srcOk: new Uint8Array(SOURCES.length), scopeType: scope.scopeType ?? 'all', muni: scope.muni ?? 'all', item: scope.item ?? 'all', issuedFromN: scope.issuedFrom ? dayNum(scope.issuedFrom) : null, issuedToN: scope.issuedTo ? dayNum(scope.issuedTo) : null };
  const orgKeys = scope.org?.amanahKeys || scope.orgKeys || null;
  const am = scope.amanah ?? 'all';
  const amSet = am === 'all' ? null : new Set([].concat(am));
  for (let e = 0; e < ENTITIES.length; e += 1) {
    const en = ENTITIES[e].en;
    let ok = true;
    if (orgKeys && !orgKeys.includes(en)) ok = false; // regional organisations never see the Housing sector or Unassigned
    if (amSet && !amSet.has(en)) ok = false;
    out.entOk[e] = ok ? 1 : 0;
  }
  const srcF = scope.source ?? 'all';
  for (let s = 0; s < SOURCES.length; s += 1) out.srcOk[s] = srcF === 'all' || SOURCES[s].key === srcF ? 1 : 0;
  out.muniIdx = out.muni !== 'all' ? Number(String(out.muni).split('|').pop() === 'Sales' ? 0 : ['North', 'Central', 'South'].indexOf(String(out.muni).split('|').pop())) : -1;
  out.muniEnt = out.muni !== 'all' ? ENTITY_INDEX[String(out.muni).split('|')[0]] : -1;
  out.itemIdx = out.item !== 'all' ? ITEMS.findIndex((x) => x.key === out.item) : -1;
  out.scopeIdx = out.scopeType === 'central' ? 0 : out.scopeType === 'internal' ? 1 : -1;
  // invoice-status filter: a class name (collected, partial, overdue, not_due, cancelled, excluded, objection, ...) or 'open' (any invoice still owing: not collected / cancelled / excluded)
  out.status = scope.status ?? 'all'; out.statusSet = null;
  if (out.status !== 'all') {
    const set = new Uint8Array(CLASSES.length);
    if (out.status === 'open') CLASSES.forEach((c, k) => { if (c !== 'collected' && c !== 'cancelled' && c !== 'excluded') set[k] = 1; });
    else if (C[out.status] != null) set[C[out.status]] = 1; else set.fill(1);
    out.statusSet = set;
  }
  out.key = `${out.from}|${out.to}|${am === 'all' ? 'all' : [].concat(am).join(',')}|${srcF}|${orgKeys ? orgKeys.join(',') : 'all'}|${out.scopeType}|${out.muni}|${out.item}|${out.status}`;
  return out;
}
const inScope = (st, sc, i) => (st.owner[i] === 0 || st.owner[i] === sc.owner) && sc.entOk[st.ent[i]] === 1 && sc.srcOk[st.src[i]] === 1
  && (sc.scopeIdx < 0 || st.scope[i] === sc.scopeIdx) && (sc.itemIdx < 0 || st.item[i] === sc.itemIdx)
  && (sc.muniEnt < 0 || (st.ent[i] === sc.muniEnt && st.muni[i] === sc.muniIdx));

/* ------------------------------------------------------------------ approved identities
   gross billed = exclusions + net billed;  net billed = collected + uncollected;  gross >= net >= collected >= 0.
   Checked on every aggregate the snapshot returns (total, per Amanah incl. unassigned, per source, per scope type). */
const EQ_TOL = 0.5; // SAR (float accumulation over ~10^6 rows)
export function checkEquation(a) {
  const e1 = a.gross - a.exclusions - a.net; const e2 = a.net - a.collected - a.outstanding;
  const ordered = a.gross + EQ_TOL >= a.net && a.net + EQ_TOL >= a.collected;
  const nonNegative = a.gross >= -EQ_TOL && a.exclusions >= -EQ_TOL && a.net >= -EQ_TOL && a.collected >= -EQ_TOL && a.outstanding >= -EQ_TOL;
  return { grossEqExclusionsPlusNet: Math.abs(e1) <= EQ_TOL, netEqCollectedPlusUncollected: Math.abs(e2) <= EQ_TOL, ordered, nonNegative, diffGross: e1, diffNet: e2, ok: Math.abs(e1) <= EQ_TOL && Math.abs(e2) <= EQ_TOL && ordered && nonNegative };
}

/* ------------------------------------------------------------------ snapshot */
const AGING = [{ key: '0', label: { ar: 'لم يحن استحقاقه', en: 'Not yet due' } }, { key: '1-30', label: { ar: '1–30 يوماً', en: '1–30 days' } }, { key: '31-90', label: { ar: '31–90 يوماً', en: '31–90 days' } }, { key: '91-180', label: { ar: '91–180 يوماً', en: '91–180 days' } }, { key: '180+', label: { ar: 'أكثر من 180 يوماً', en: 'Over 180 days' } }];
export const agingBucket = (days) => (days <= 0 ? 0 : days <= 30 ? 1 : days <= 90 ? 2 : days <= 180 ? 3 : 4);
export { AGING };

const labelOfEnt = (e) => ({ en: ENTITIES[e].en, ar: ENTITIES[e].ar, zh: ENTITIES[e].zh });
const catOf = (bit) => RULES.find((r) => r.bit === bit);

export function snapshot(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const NE = ENTITIES.length; const NS = SOURCES.length;
  const per = { tot: new Acc(1), ent: new Acc(NE), src: new Acc(NS), scope: new Acc(2) };
  const stk = { tot: new Acc(1), ent: new Acc(NE), src: new Acc(NS) };
  const ncCount = new Float64Array(CLASSES.length); const ncAmt = new Float64Array(CLASSES.length); const ncTop = CLASSES.map(() => new TopK(60)); const ncMaxDays = new Float64Array(CLASSES.length); const ncEnt = new Float64Array(CLASSES.length * NE);
  const exCat = new Map(); const reasonCounts = new Array(NBITS).fill(0); const unappr = new Set();
  const primCnt = new Float64Array(NBITS); const primAmt = new Float64Array(NBITS); const pendCnt = new Float64Array(NBITS);
  const entSrcGross = new Float64Array(NE * NS); const entSrcNet = new Float64Array(NE * NS);
  const MX = 6; const mxA = new Float64Array(NE * NS * MX); // Amanah × source: count, gross, exclusions, net, collected, uncollected (the monthly report's per-source Amanah tables)
  const NCOL = NBITS + 1; const exMx = new Float64Array(NE * NCOL * 2); // Amanah × exclusion reason (primary reason, once) + cancelled: amount, count (the report's excluded-invoices appendix)
  const aging = new Float64Array(5 * 2); // amount, count
  const accMonth = new Map(); // issue-month cohort: 'YYYY-MM' -> Acc(1) measured at the reference date
  const accMuni = new Acc(NE * 5); const accStatus = new Acc(CLASSES.length);
  const agingC = new Float64Array(5 * 2); let ageSum = 0; let ageN = 0; let objAmt = 0; // planning buckets (current, 1-30, 31-60, 61-90, 90+), average days overdue, amount under objection
  const recv = { total: 0, fromPeriodInvoices: 0, fromPriorInvoices: 0, onExcluded: 0, count: 0, byChannel: new Float64Array(CHANNELS.length) };
  const q = { records: 0, conflicts: new TopK(40), conflictN: 0, conflictAtStake: 0, pendingAtStake: 0, pendingN: 0, pending: new TopK(40), missingN: 0, missing: new TopK(40), contractN: 0, contract: new TopK(40), unverifiedN: 0, uploaded: 0, checkable: 0 };
  let ledgerInScope = 0; let issued = 0;
  const { fromN, toN } = sc; const periodAsOf = ctx.periodEndMode ? Math.min(toN, ctx.cutoffN) : ctx.cutoffN;
  const n = st.n; const D = ctx.D;
  for (let i = 0; i < n; i += 1) {
    if (st.issue[i] > ctx.cutoffN) continue;
    if (!inScope(st, sc, i)) continue;
    ledgerInScope += 1;
    const e = st.ent[i]; const s = st.src[i];
    derive(ctx, i, ctx.cutoffN);
    const okCut = !sc.statusSet || sc.statusSet[D.cls]; // invoice-status filter (standing balance and receipts use the status at the reference date)
    // ---- standing balance (everything issued up to the cutoff)
    if (okCut) { stk.tot.add(0, D); stk.ent.add(e, D); stk.src.add(s, D); }
    if (okCut && D.outstanding > 0) { const b = agingBucket(D.daysOverdue); aging[b * 2] += D.outstanding; aging[b * 2 + 1] += 1; const dd = D.daysOverdue; const cb = dd <= 0 ? 0 : dd <= 30 ? 1 : dd <= 60 ? 2 : dd <= 90 ? 3 : 4; agingC[cb * 2] += D.outstanding; agingC[cb * 2 + 1] += 1; if (dd > 0) { ageSum += dd; ageN += 1; } if (D.cls === C.objection) objAmt += D.outstanding; }
    const hasReason = D.mask !== 0;
    // ---- receipts in the period (population A)
    const ps = st.payStart[i]; const pc = st.payCount[i];
    for (let p = ps; p < ps + pc; p += 1) {
      const d = st.pDay[p];
      if (!okCut) break;
      if (d < fromN || d > toN || d > ctx.cutoffN) continue;
      recv.count += 1;
      if (hasReason) { recv.onExcluded += st.pAmt[p]; continue; }
      const a = st.pAmt[p]; recv.total += a; recv.byChannel[st.pCh[p]] += a;
      if (st.issue[i] >= fromN && st.issue[i] <= toN) recv.fromPeriodInvoices += a; else recv.fromPriorInvoices += a;
    }
    // ---- invoices issued in the period (population B)
    if (st.issue[i] < fromN || st.issue[i] > toN) continue;
    const dd = periodAsOf === ctx.cutoffN ? D : derive(ctx, i, periodAsOf);
    if (sc.statusSet && !sc.statusSet[dd.cls]) continue;
    issued += 1;
    per.tot.add(0, dd); per.ent.add(e, dd); per.src.add(s, dd); per.scope.add(st.scope[i], dd);
    { const ym = isoOf(st.issue[i]).slice(0, 7); let am = accMonth.get(ym); if (!am) { am = new Acc(1); accMonth.set(ym, am); } am.add(0, dd); }
    accMuni.add(e * 5 + (municipalityOf(e, Math.min(st.muni[i], 4)) ? Math.min(st.muni[i], 4) : 3), dd); accStatus.add(dd.cls, dd); // (F-22) every invoice WITHOUT a municipality of this entity shares ONE group — it used to be split by a hidden index into identical «no municipality» rows
    const viol = s === 1; const enf = dd.link === 2 || (pc > 0 && (() => { for (let p = ps; p < ps + pc; p += 1) if (st.pCh[p] === 2) return true; return false; })());
    per.ent.addMeta(e, viol, enf); per.src.addMeta(s, viol, enf);
    entSrcGross[e * NS + s] += dd.gross; entSrcNet[e * NS + s] += dd.net;
    { const o = (e * NS + s) * MX; mxA[o] += 1; mxA[o + 1] += dd.gross; mxA[o + 2] += dd.exclTotal; mxA[o + 3] += dd.net; mxA[o + 4] += dd.collected; mxA[o + 5] += dd.outstanding; }
    if (dd.cancelled) { const o = (e * NCOL + NBITS) * 2; exMx[o] += dd.cancelledAmount; exMx[o + 1] += 1; }
    else if (dd.excluded) { const o = (e * NCOL + Math.round(Math.log2(dd.primaryBit))) * 2; exMx[o] += dd.exclusionAmount; exMx[o + 1] += 1; }
    const cls = dd.cls;
    if (cls !== C.collected) { ncCount[cls] += 1; const amt = cls === C.excluded ? dd.exclusionAmount : cls === C.cancelled ? dd.cancelledAmount : dd.outstanding; ncAmt[cls] += amt; ncTop[cls].push(i, amt); ncEnt[cls * NE + e] += amt; if (dd.outstanding > 0 && dd.daysOverdue > ncMaxDays[cls]) ncMaxDays[cls] = dd.daysOverdue; }
    if (dd.excluded) {
      const r = catOf(dd.primaryBit); let c = exCat.get(r.category); if (!c) { c = { count: 0, amount: 0, top: new TopK(25) }; exCat.set(r.category, c); }
      c.count += 1; c.amount += dd.exclusionAmount; c.top.push(i, dd.exclusionAmount);
      { const pb = Math.round(Math.log2(dd.primaryBit)); primCnt[pb] += 1; primAmt[pb] += dd.exclusionAmount; }
      if (!dd.primaryApproved) unappr.add(r.id);
    }
    if (dd.excluded || dd.overlaps) for (let b = 0; b < NBITS; b += 1) if (dd.mask & (1 << b)) reasonCounts[b] += 1;
    if (!dd.excluded && !dd.cancelled && dd.pendingMask) for (let b = 0; b < NBITS; b += 1) if (dd.pendingMask & (1 << b)) pendCnt[b] += 1;
    // quality
    q.records += 1;
    if (st.flags[i] & F.AMT_CONFLICT) { q.conflictN += 1; q.conflictAtStake += st.gross[i]; q.conflicts.push(i, st.gross[i]); }
    if (dd.pendingMask) { q.pendingN += 1; q.pendingAtStake += st.gross[i]; q.pending.push(i, st.gross[i]); }
    if (st.flags[i] & F.MISSING_ID) { q.missingN += 1; q.missing.push(i, st.gross[i]); }
    { const cs = st.cstat[i]; if (s === 0 && (cs === 2 || cs === 4)) { q.contractN += 1; q.contract.push(i, st.gross[i]); } if (cs === 5) q.unverifiedN += 1; }
    if (st.flags[i] & F.UPLOADED) q.uploaded += 1;
    if (!(st.flags[i] & F.NOT_CHECKABLE)) q.checkable += 1;
  }
  const ids = (t) => t.sorted().map(([i]) => idOf(st, i));
  const groupOut = (acc, count, labelFn, keyFn) => { const out = []; for (let g = 0; g < count; g += 1) { if (acc.a[g * K + M.count] === 0) continue; out.push({ key: keyFn(g), label: labelFn(g), ...acc.toAgg(g) }); } return out.sort((a, b) => b.outstanding - a.outstanding || b.gross - a.gross); };
  const entLabel = (g) => labelOfEnt(g);
  const totals = per.tot.toAgg(0);
  const noncollection = {};
  for (const c of NONCOLLECTION_CATEGORIES) { const k = C[c]; let te = -1; let tv = 0; for (let e = 0; e < NE; e += 1) if (ncEnt[k * NE + e] > tv) { tv = ncEnt[k * NE + e]; te = e; } noncollection[c] = { count: ncCount[k], amount: ncAmt[k], invoices: ids(ncTop[k]), maxDaysOverdue: ncMaxDays[k], topAmanah: te >= 0 ? { key: ENTITIES[te].en, label: labelOfEnt(te), amount: tv } : null }; }
  const exclusionsByCategory = {};
  for (const [cat, c] of exCat) exclusionsByCategory[cat] = { count: c.count, amount: c.amount, invoices: ids(c.top) };
  const exclusionReasonCounts = {}; reasonCounts.forEach((cnt, b) => { if (cnt) exclusionReasonCounts[RULES[b].id] = cnt; });
  const stockTot = stk.tot.toAgg(0);
  const byAmanah = groupOut(per.ent, NE, entLabel, (g) => ENTITIES[g].en);
  const byMonth = [...accMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, acc]) => ({ month, ...acc.toAgg(0) }));
  const byMunicipality = []; for (let g = 0; g < NE * 5; g += 1) { if (accMuni.a[g * K + M.count] === 0) continue; const e = Math.floor(g / 5); const mu = municipalityOf(e, g % 5); byMunicipality.push({ key: `${ENTITIES[e].en}|${mu ? mu.key.split('|')[1] : '-'}`, amanah: ENTITIES[e].en, amanahLabel: labelOfEnt(e), municipality: mu ? { key: mu.key, ar: mu.ar, en: mu.en } : null, ...accMuni.toAgg(g) }); }
  byMunicipality.sort((a, b) => b.outstanding - a.outstanding);
  const byStatus = []; for (let k = 0; k < CLASSES.length; k += 1) { if (accStatus.a[k * K + M.count] === 0) continue; byStatus.push({ key: CLASSES[k], ...accStatus.toAgg(k) }); }
  const bySource = groupOut(per.src, NS, () => null, (g) => SOURCES[g].key);
  const byScope = [0, 1].map((g) => ({ key: g === 0 ? 'central' : 'internal', ...per.scope.toAgg(g) }));
  const matrix = { amanahSource: [], amanahReasons: [] };
  for (let e = 0; e < NE; e += 1) {
    for (let s = 0; s < NS; s += 1) { const o = (e * NS + s) * MX; if (mxA[o]) matrix.amanahSource.push({ amanah: ENTITIES[e].en, source: SOURCES[s].key, count: mxA[o], gross: mxA[o + 1], exclusions: mxA[o + 2], net: mxA[o + 3], collected: mxA[o + 4], outstanding: mxA[o + 5] }); }
    for (let b = 0; b < NCOL; b += 1) { const o = (e * NCOL + b) * 2; if (exMx[o + 1]) matrix.amanahReasons.push({ amanah: ENTITIES[e].en, reason: b === NBITS ? 'cancelled' : RULES[b].id, amount: exMx[o], count: exMx[o + 1] }); }
  }
  const sumKeys = ['count', 'gross', 'exclusions', 'net', 'collected', 'outstanding'];
  const partsSum = (rows) => Object.fromEntries(sumKeys.map((k) => [k, rows.reduce((t, r) => t + r[k], 0)]));
  const addsUp = (rows) => { const p = partsSum(rows); return sumKeys.every((k) => Math.abs(p[k] - totals[k]) <= (k === 'count' ? 0 : EQ_TOL)); };
  const equation = {
    total: checkEquation(totals),
    amanahCheck: byAmanah.every((r) => checkEquation(r).ok), sourceCheck: bySource.every((r) => checkEquation(r).ok), scopeCheck: byScope.every((r) => checkEquation(r).ok),
    monthsSumToTotal: addsUp(byMonth), municipalitiesSumToTotal: addsUp(byMunicipality), statusSumsToTotal: addsUp(byStatus),
    amanahSumsToTotal: addsUp(byAmanah), sourceSumsToTotal: addsUp(bySource), scopeSumsToTotal: addsUp(byScope),
    collectionRateFromSums: ratio(totals.collected, totals.net) // overall rate = Σ collected ÷ Σ net — never an average of Amanah rates
  };
  { const ms = matrix.amanahSource.reduce((t, r) => ({ gross: t.gross + r.gross, net: t.net + r.net, collected: t.collected + r.collected, count: t.count + r.count }), { gross: 0, net: 0, collected: 0, count: 0 });
    const er = matrix.amanahReasons.reduce((t, r) => t + r.amount, 0);
    equation.matrixSumsToTotal = ms.count === totals.count && Math.abs(ms.gross - totals.gross) <= EQ_TOL && Math.abs(ms.net - totals.net) <= EQ_TOL && Math.abs(ms.collected - totals.collected) <= EQ_TOL && Math.abs(er - totals.exclusions) <= EQ_TOL; } // reasons + cancelled add up to the exclusions: nothing deducted twice
  equation.ok = equation.monthsSumToTotal && equation.municipalitiesSumToTotal && equation.statusSumsToTotal && equation.matrixSumsToTotal && equation.total.ok && equation.amanahCheck && equation.sourceCheck && equation.scopeCheck && equation.amanahSumsToTotal && equation.sourceSumsToTotal && equation.scopeSumsToTotal;
  const stock = {
    netUncollected: stockTot.outstanding, overdue: stockTot.overdueOutstanding, notYetDue: stockTot.notDueOutstanding,
    invoiceCount: AGING.reduce((s, _, b) => s + aging[b * 2 + 1], 0), cancelled: stockTot.cancelled, cancelledCount: stockTot.cancelledCount,
    excluded: stockTot.exclusionsRules, excludedUnapproved: stockTot.exclusionsUnapproved, excludedApproved: stockTot.exclusionsApproved, excludedCount: stockTot.excludedCount,
    overlapCount: stockTot.overlapCount, overlapAmount: stockTot.overlapAmount, gross: stockTot.gross, exclusionsTotal: stockTot.exclusions, net: stockTot.net, collected: stockTot.collected,
    invoices: stockTot.count,
    aging: AGING.map((a, b) => ({ ...a, amount: aging[b * 2], count: aging[b * 2 + 1] })),
    agingPlanning: ['current', 'd1_30', 'd31_60', 'd61_90', 'd90plus'].map((key, b) => ({ key, amount: agingC[b * 2], count: agingC[b * 2 + 1] })), avgDaysOverdue: ageN ? ageSum / ageN : 0, objectionOutstanding: objAmt,
    byAmanah: groupOut(stk.ent, NE, entLabel, (g) => ENTITIES[g].en),
    bySource: groupOut(stk.src, NS, () => null, (g) => SOURCES[g].key)
  };
  const byAmanahSource = {};
  for (let e = 0; e < NE; e += 1) for (let s = 0; s < NS; s += 1) { const v = entSrcGross[e * NS + s]; if (v) { (byAmanahSource[ENTITIES[e].en] = byAmanahSource[ENTITIES[e].en] || {})[SOURCES[s].key] = v; } }
  const quality = {
    records: q.records, kinds: { demo: q.records - q.uploaded, ...(q.uploaded ? { uploaded: q.uploaded } : {}) },
    amountConflicts: ids(q.conflicts), amountConflictCount: q.conflictN, amountCheckable: q.checkable,
    pendingExclusions: ids(q.pending), pendingExclusionCount: q.pendingN, pendingExclusionAmount: q.pendingAtStake,
    missingFieldRecords: ids(q.missing), missingFieldCount: q.missingN,
    contractIssues: ids(q.contract), contractIssueCount: q.contractN, contractUnverified: [], contractUnverifiedCount: q.unverifiedN,
    conflictAmountAtStake: q.conflictAtStake,
    completenessNote: { en: `${q.checkable} of ${q.records} records have line-item evidence for an amount check; the rest could not be checked.`, ar: `${q.checkable} من ${q.records} سجلاً لديها بنود تفصيلية للتحقق من المبلغ؛ والباقي تعذّر فحصه.` }
  };
  const byChannel = {}; CHANNELS.forEach((c, k) => { if (recv.byChannel[k]) byChannel[c] = recv.byChannel[k]; });
  return {
    scope: { from: sc.from, to: sc.to, status: req.scope?.status ?? 'all', amanah: req.scope?.amanah ?? 'all', source: req.scope?.source ?? 'all', scopeType: req.scope?.scopeType ?? 'all', muni: req.scope?.muni ?? 'all', org: req.scope?.org || null, ...(req.scope?.basis ? { basis: req.scope.basis } : {}) },
    config: ctx.cfg, cutoff: ctx.cfg.cutoff, ruleSetVersion: EXCLUSION_RULE_SET_VERSION,
    population: { issuedInPeriod: issued, ledgerInScope },
    totals,
    exclusionsByCategory, exclusionReasonCounts, unapprovedRulesApplied: [...unappr],
    ruleStats: Object.fromEntries(RULES.map((r, b) => [r.id, { primaryCount: primCnt[b], primaryAmount: primAmt[b], pendingCandidates: pendCnt[b] }])),
    exclusionsApproval: { allApproved: unappr.size === 0, unapprovedAmount: totals.exclusionsUnapproved, approvedAmount: totals.exclusionsApproved },
    stock, noncollection,
    byAmanah, bySource, byScope, byMonth, byMunicipality, byStatus, equation,
    basis: { invoices: 'issue_date', invoicesFrom: sc.from, invoicesTo: sc.to, collectionsAsOf: isoOf(periodAsOf), collectionsMode: periodAsOf === ctx.cutoffN ? 'reference_date' : 'period_end', referenceDate: ctx.cfg.cutoff, receiptsByPaymentDate: 'separate_indicator', timezone: 'Asia/Riyadh' },
    byAmanahSource, matrix,
    receivedInPeriod: { total: recv.total, fromPeriodInvoices: recv.fromPeriodInvoices, fromPriorInvoices: recv.fromPriorInvoices, onExcluded: recv.onExcluded, byChannel, count: recv.count },
    quality
  };
}

/* ------------------------------------------------------------------ monthly series (receipts population A, billed by issue month) */
export function series(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const asOf = Math.min(sc.toN, ctx.cutoffN);
  const months = []; const idx = new Map();
  for (let y = Number(sc.from.slice(0, 4)), m = Number(sc.from.slice(5, 7)); `${y}-${String(m).padStart(2, '0')}` <= sc.to.slice(0, 7) && `${y}-${String(m).padStart(2, '0')}` <= ctx.cfg.cutoff.slice(0, 7); m += 1) { if (m > 12) { m = 1; y += 1; } const k = `${y}-${String(m).padStart(2, '0')}`; if (k > ctx.cfg.cutoff.slice(0, 7)) break; idx.set(k, months.length); months.push(k); }
  const values = new Float64Array(months.length); const billed = new Float64Array(months.length); const count = new Float64Array(months.length);
  const amts = []; const pinv = []; const pday = [];
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    const iss = st.issue[i];
    if (iss >= sc.fromN && iss <= sc.toN) { const k = idx.get(isoOf(iss).slice(0, 7)); if (k !== undefined) { billed[k] += st.gross[i]; count[k] += 1; } }
    if (sc.issuedFromN != null && (iss < sc.issuedFromN || iss > (sc.issuedToN ?? iss))) continue; // optional: only payments on invoices ISSUED in this window (used by the Planning reconciliation of bases)
    const pc = st.payCount[i]; if (!pc) continue;
    const ps = st.payStart[i];
    let hasReason = -1;
    for (let p = ps; p < ps + pc; p += 1) {
      const d = st.pDay[p]; if (d < sc.fromN || d > asOf) continue;
      if (hasReason < 0) { derive(ctx, i, ctx.cutoffN); hasReason = ctx.D.mask !== 0 ? 1 : 0; }
      if (hasReason) continue;
      const k = idx.get(isoOf(d).slice(0, 7)); if (k === undefined) continue;
      values[k] += st.pAmt[p]; amts.push(st.pAmt[p]); pinv.push(i); pday.push(d);
    }
  }
  const sorted = Float64Array.from(amts).sort(); const typical = sorted.length ? sorted[sorted.length >> 1] : 0;
  const large = [];
  for (let j = 0; j < amts.length; j += 1) { const k = idx.get(isoOf(pday[j]).slice(0, 7)); if (amts[j] >= typical * 2.5 && values[k] > 0 && amts[j] / values[k] >= 0.2) large.push({ invoiceId: idOf(st, pinv[j]), date: isoOf(pday[j]), amount: amts[j] }); }
  return { months, values: Array.from(values), billed: Array.from(billed), invoiceCounts: Array.from(count), typicalPayment: typical, paymentCount: amts.length, payments: large };
}

/* ------------------------------------------------------------------ net-uncollected bridge */
export const UNMATCHED_REPORT_ROWS = [
  { invoiceNo: '000123456789', amount: 48200000, lines: 2, hint: 'رقم فاتورة غير موجود في تقرير التفاصيل' },
  { invoiceNo: '000123456793', amount: 112750000, lines: 1, hint: 'رقم فاتورة غير موجود في تقرير التفاصيل' },
  { invoiceNo: '000123456800', amount: 9800000, lines: 1, hint: 'رقم فاتورة غير موجود في تقرير التفاصيل' },
  { invoiceNo: '000123456811', amount: 176300000, lines: 3, hint: 'رقم فاتورة غير موجود في تقرير التفاصيل' }
];
export function bridge(st, req) {
  const ctx = makeCtx(st, { ...req, scope: { ...(req.scope || {}), from: '2000-01-01', to: req.cfg?.cutoff } });
  const sc = resolveScope(ctx, req.scope && { ...req.scope, from: '2000-01-01', to: ctx.cfg.cutoff });
  const reportN = req.reportDate ? dayNum(req.reportDate) : dayNum(`${ctx.cfg.cutoff.slice(0, 7)}-01`) - 1;
  const national = req.scope?.amanah === undefined || req.scope?.amanah === 'all';
  const nat = national && (!req.scope?.source || req.scope.source === 'all') && !req.scope?.org?.amanahKeys;
  let reportMatched = 0; let invReport = 0; let lineCount = 0; let naive = 0; let paidAfter = 0; let creditAfter = 0; let cancelled = 0; let cancelledCount = 0; let exclNonOverlap = 0; let exclCount = 0; let exclApproved = 0; let exclUnapproved = 0; let overlapAmt = 0; let overlapCount = 0; let netFromReport = 0; let newInv = 0; let newCount = 0; let internal = 0; let internalCount = 0; let missed = 0;
  const D = ctx.D;
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    derive(ctx, i, ctx.cutoffN);
    if (sc.statusSet && !sc.statusSet[D.cls]) continue; // the invoice-status filter applies to the bridge exactly as it does to the standing balance (it used to be ignored, so a status-filtered report could not reconcile)
    if (st.scope[i] !== 0) { if (D.outstanding > 0) { internal += D.outstanding; internalCount += 1; } continue; }
    const iss = st.issue[i];
    let inReport = false; let rem0 = 0;
    if (iss <= reportN && !(st.cancelDay[i] && st.cancelDay[i] <= reportN)) {
      let paid0 = 0; const ps = st.payStart[i]; const pc = st.payCount[i];
      for (let p = ps; p < ps + pc; p += 1) if (st.pDay[p] <= reportN) paid0 += st.pAmt[p];
      const adj0 = st.adjDay[i] && st.adjDay[i] <= reportN ? st.adjAmt[i] : 0;
      rem0 = Math.max(0, st.gross[i] + adj0 - paid0);
      if (rem0 > 0) inReport = true;
    }
    if (inReport) {
      invReport += 1; reportMatched += rem0; lineCount += st.lines[i]; naive += rem0 * st.lines[i];
      const rawR1 = Math.max(0, D.billed - D.received);
      const diff = rem0 - rawR1;
      let paid0 = 0; { const ps = st.payStart[i]; const pc = st.payCount[i]; for (let p = ps; p < ps + pc; p += 1) if (st.pDay[p] <= reportN) paid0 += st.pAmt[p]; }
      const payPart = Math.max(0, D.received - paid0);
      paidAfter += payPart; creditAfter += diff - payPart;
      if (D.cancelled) { cancelled += rawR1; cancelledCount += 1; if (D.overlaps) { overlapCount += 1; overlapAmt += rawR1; } }
      else if (D.excluded) { exclNonOverlap += rawR1; exclCount += 1; if (D.primaryApproved) exclApproved += rawR1; else exclUnapproved += rawR1; }
      else netFromReport += D.outstanding;
    } else if (D.outstanding > 0) { if (iss > reportN) { newInv += D.outstanding; newCount += 1; } else missed += D.outstanding; }
  }
  let unmatchedLines = 0; let unmatchedAmt = 0; let unmatchedCount = 0;
  if (nat) for (const u of UNMATCHED_REPORT_ROWS) { unmatchedLines += u.lines; unmatchedAmt += u.amount; unmatchedCount += 1; naive += u.amount * u.lines; }
  const net = netFromReport + newInv + internal + missed;
  const steps = [
    { key: 'report', amount: reportMatched, count: invReport, kind: 'start' },
    { key: 'reconciliation', amount: -(paidAfter + creditAfter), kind: 'minus', detail: { payments: paidAfter, creditNotes: creditAfter } },
    { key: 'cancelled', amount: -cancelled, count: cancelledCount, kind: 'minus', detail: { overlapNotDeductedAgain: overlapAmt, overlapCount } },
    { key: 'excluded', amount: -exclNonOverlap, count: exclCount, kind: 'minus', detail: { approvedRules: exclApproved, unapprovedRules: exclUnapproved } },
    { key: 'newInvoices', amount: newInv, count: newCount, kind: 'plus' },
    ...(missed ? [{ key: 'missedByReport', amount: missed, kind: 'plus' }] : []),
    { key: 'internal', amount: internal, count: internalCount, kind: 'plus' }
  ];
  const stepsSum = steps.reduce((s, x) => s + x.amount, 0);
  const inflation = naive - (reportMatched + unmatchedAmt);
  return {
    reportDate: isoOf(reportN), detailsDate: ctx.cfg.cutoff,
    lineCount: lineCount + unmatchedLines, invoiceCountInReport: invReport + unmatchedCount, naiveSum: naive, dedupedTotal: reportMatched + unmatchedAmt, inflation, conflicts: [],
    steps, net, check: Math.round((stepsSum - net) * 100) / 100,
    unmatched: { scopedOut: !nat, nationalCount: UNMATCHED_REPORT_ROWS.length, nationalAmount: UNMATCHED_REPORT_ROWS.reduce((s, u) => s + u.amount, 0), count: nat ? unmatchedCount : 0, amount: nat ? unmatchedAmt : 0, rows: nat ? UNMATCHED_REPORT_ROWS.map((u) => ({ invoiceNo: u.invoiceNo, invoiceValue: u.amount, lines: u.lines, hint: u.hint })) : [] },
    ruleSetApproval: { unapprovedAmount: exclUnapproved, approvedAmount: exclApproved }
  };
}

export { CLASSES as CLASS_NAMES, RULES, K, M, Acc, TopK, popcount, inScope, lowerBound, payerName, payerPool, idKeyFromSadad, idKeyFromSubscription, idKeyFromViolation, HOUSING_PAYER_BASE, CSTAT, SOURCE_INDEX };
