// Paged / searchable / sortable invoice listings, worklists, risk flags and the large streaming export — all over the
// columnar store. Nothing here materialises more than one page of invoice objects.
import { ENTITIES, SOURCES, ITEMS, CHANNELS, CSTAT, CR_STATUS, EFAA_STATUS, RULE_IDS, F, isoOf, dayNum, ENT_UNASSIGNED, municipalityOf } from '../src/data/catalog.js';
import { EXCLUSION_RULES } from '../src/data/revenueMetrics.js';
import { materialize } from './materialize.js';
import { makeCtx, resolveScope, derive, inScope, idOf, lookupId, lowerBound, CLASSES, CLASS_INDEX, agingBucket, TopK } from './engine.js';
import { parseInvoiceId, idKeyFromSadad, idKeyFromSubscription, idKeyFromViolation, payerPool, payerName, sadadOf, violationOf, subscriptionOf, invoiceIdOf, DEED, LICENCE, DISCLOSURE, VISIT, SCHEDULE, REQUEST, parseFacilityKey } from './names.js';
import { HOUSING_PAYER_BASE, WL_PAYER_BASE } from './world.js';
import { grpOf, GRP } from '../src/data/catalog.js';

const low0 = (x) => x.toLowerCase();
const RULE_PRIORITY = Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r.priority]));

/* ------------------------------------------------------------------ search resolution */
export function resolveSearch(st, q) {
  const s = String(q || '').trim();
  if (!s) return null;
  // exact invoice id
  const exact = lookupId(st, s); if (exact >= 0) return { list: Int32Array.of(exact) };
  const key = parseInvoiceId(s);
  const upper = s.toUpperCase();
  let m = /^INV-(\d{4})(?:-(\d{1,7}))?$/.exec(upper);
  if (m) { // id prefix -> contiguous range of the id-sorted region
    const y = Number(m[1]); const frag = m[2] || '';
    const lo = y * 1e8 + (frag ? Number(frag.padEnd(7, '0')) : 0); const hi = y * 1e8 + (frag ? Number(frag.padEnd(7, '9')) : 99999999);
    return { range: [lowerBound(st, lo), lowerBound(st, hi + 1)] };
  }
  if (key != null) return { list: new Int32Array(0) };
  if (/^CT-\d{4}-\d{4}$/.test(upper)) { const ct = st.contracts.find((c) => c && c.contractNo === upper); return { list: Int32Array.from(ct ? ct.invs : []) }; }
  if (/^\d{10}$/.test(s)) { const ct = st.contracts.find((c) => c && c.crNo === s); if (ct) return { list: Int32Array.from(ct.invs) }; }
  if (/^\d{12}$/.test(s)) { const k = idKeyFromSadad(s); if (k != null) { const i = lookupId(st, `INV-${Math.floor(k / 1e8)}-${String(k % 1e8).padStart(7, '0')}`); if (i >= 0) return { list: Int32Array.of(i) }; } }
  if (/^\d{10}$/.test(s)) { const k = idKeyFromSubscription(s); if (k != null) { const i = lookupId(st, `INV-${Math.floor(k / 1e8)}-${String(k % 1e8).padStart(7, '0')}`); if (i >= 0) return { list: Int32Array.of(i) }; } }
  if (/^\d{14}$/.test(s)) { const k = idKeyFromViolation(s); if (k != null) { const i = lookupId(st, `INV-${Math.floor(k / 1e8)}-${String(k % 1e8).padStart(7, '0')}`); if (i >= 0) return { list: Int32Array.of(i) }; } }
  // source-record identifiers: disclosure / schedule / visit / licence / request keys point at ONE invoice; a deed at its owners' invoices; a facility at all its invoices
  for (const codec of [DISCLOSURE, SCHEDULE, VISIT, LICENCE, REQUEST]) { const k = codec.decode(upper); if (k != null) { const i = lookupId(st, invoiceIdOf(k)); return { list: i >= 0 ? Int32Array.of(i) : new Int32Array(0) }; } }
  { const k = DEED.decode(upper); if (k != null) { const i = lookupId(st, invoiceIdOf(k)); if (i < 0) return { list: new Int32Array(0) }; const g = grpOf(st.flags[i]); const n = g === GRP.WL_HEAD2 ? 2 : g === GRP.WL_HEAD3 ? 3 : 1; return { list: Int32Array.from({ length: n }, (_, j) => i + j) }; } }
  { const fk = parseFacilityKey(upper); if (fk != null) { const bm = new Uint8Array(65536); bm[fk] = 1; return { payer: bm, fixtures: [] }; } }
  { const q = st.requests.find((x) => x.enforceNum === upper); if (q) return { list: Int32Array.from(q.identified.length ? q.identified : (st.contracts[q.contractIdx]?.invs || [])) }; }
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
export function rowOut(st, ctx, i, D) {
  const e = st.ent[i]; const muni = municipalityOf(e, st.muni[i]);
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const ct = st.contract[i] >= 0 ? st.contracts[st.contract[i]] : null;
  const rules = []; for (let b = 0; b < RULE_IDS.length; b += 1) if (st.exMask[i] & (1 << b)) rules.push(RULE_IDS[b]);
  return {
    id: idOf(st, i), index: i,
    entityKey: ENTITIES[e].en, amanahAr: ENTITIES[e].ar, amanahEn: ENTITIES[e].en, amanahZh: ENTITIES[e].zh,
    municipalityAr: fx ? fx.municipalityAr : muni?.ar || null, municipalityEn: fx ? fx.municipalityEn : muni?.en || null, municipalityKey: muni?.key || null,
    payerAr: fx ? fx.entityAr || fx.entity : payerName(st.payer[i]).ar, payerEn: fx ? fx.entityEn : payerName(st.payer[i]).en,
    scopeType: st.scope[i] === 1 ? 'internal' : 'central', source: SOURCES[st.src[i]].key, platform: SOURCES[st.src[i]].platform, item: ITEMS[st.item[i]].key, itemAr: ITEMS[st.item[i]].ar, itemEn: ITEMS[st.item[i]].en,
    issueDate: isoOf(st.issue[i]), dueDate: isoOf(st.due[i]), gross: D.gross, billed: D.billed, collected: D.collected, received: D.received, outstanding: D.outstanding, cancelledAmount: D.cancelledAmount, exclusionAmount: D.exclusionAmount, exclusions: D.exclTotal, net: D.net,
    daysOverdue: D.outstanding > 0 ? D.daysOverdue : 0, cls: CLASSES[D.cls], lines: st.lines[i],
    statusRawTahseel: tahseelOf(st, i, D), statusRawEfaa: EFAA_STATUS[st.efaa[i]] || null, crStatusRaw: CR_STATUS[st.crSt[i]] || null,
    contractNo: ct && st.cstat[i] === 1 ? ct.contractNo : fx?.co || null, contractStatus: CSTAT[st.cstat[i]], executionIdx: st.exec[i], enforcement: ctx.mark ? (ctx.ov.get(i)?.link || 0) : 0, payStatus: D.payStatus, sourceCancelled: D.sourceCancelled, enfConflict: D.enfConflict, enf1Applied: D.enf1Applied, rules, nReasons: D.nReasons,
    primaryRule: D.primaryBit ? RULE_IDS[Math.log2(D.primaryBit)] : null, tags: tagsOf(st, i, D), amanahLinkage: st.alink[i], uploaded: !!(st.flags[i] & F.UPLOADED)
  };
}

/* ------------------------------------------------------------------ list */
const SORT_KEYS = { issue: 'issue', gross: 'gross', outstanding: 'outstanding', daysOverdue: 'daysOverdue', collected: 'collected', id: 'id' };
const cache = new Map();
const hashOf = (str) => { let h = 5381; for (let i = 0; i < str.length; i += 1) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return `${str.length}.${h.toString(36)}`; };
function lruGet(k) { if (!cache.has(k)) return null; const v = cache.get(k); cache.delete(k); cache.set(k, v); return v; }
function lruSet(k, v) { cache.set(k, v); if (cache.size > 8) cache.delete(cache.keys().next().value); }
let epoch = 0; export const bumpEpoch = () => { epoch += 1; cache.clear(); };

const PROBLEM_TAGS = new Set(['amount_conflict', 'contract_unmatched', 'contract_unlinked', 'missing_fields', 'exclusion_pending', 'enforcement_candidate']);
export function candidates(st, req) {
  const ctx = makeCtx(st, req);
  const sc = resolveScope(ctx, req.scope);
  const f = req.filters || {};
  const srch = resolveSearch(st, f.search);
  const ageB = f.age && f.age !== 'all' ? ['0', '1-30', '31-90', '91-180', '180+'].indexOf(f.age) : -1;
  const stateIdx = f.state && f.state !== 'all' && f.state !== 'open' && f.state !== 'noncollected' ? CLASS_INDEX[f.state] : -1;
  const ruleBit = f.rule && f.rule !== 'all' && f.rule !== 'none' && f.rule !== 'any' ? 1 << RULE_IDS.indexOf(f.rule) : 0;
  const cs = f.contract && f.contract !== 'all' ? (f.contract === 'issue' ? -2 : CSTAT.indexOf(f.contract)) : -1; // 'issue' = contract not matched or not linked
  const periodFilter = !f.allPeriods;
  const out = []; const sums = { gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 };
  const lo = srch?.range ? srch.range[0] : 0; const hi = srch?.range ? srch.range[1] : st.n;
  const D = ctx.D;
  const consider = (i) => {
    if (st.issue[i] > ctx.cutoffN) return;
    if (!inScope(st, sc, i)) return;
    if (periodFilter && (st.issue[i] < sc.fromN || st.issue[i] > sc.toN)) return;
    if (cs >= 0 && st.cstat[i] !== cs) return;
    if (cs === -2 && st.cstat[i] !== 2 && st.cstat[i] !== 4) return;
    if (f.exec && f.exec !== 'all') { // ENFORCEMENT dimension (from confirmed links only): inexec = an order in execution · suspended = none in execution, one suspended · closed = referred before, every order closed · ever = any of the three · none = never referred
      const lk = ctx.mark ? (ctx.ov.get(i)?.link || 0) : 0; const srcCancelled = st.cancelDay[i] !== 0 && st.cancelDay[i] <= ctx.cutoffN;
      const ok = f.exec === 'conflict' ? srcCancelled && (lk >= 2 || lk === 5) : f.exec === 'inexec' ? lk === 2 : f.exec === 'suspended' ? lk === 3 : f.exec === 'closed' ? lk === 4 : f.exec === 'ever' ? lk >= 2 : f.exec === 'none' ? lk < 2
        : f.exec === 'yes' ? (st.exec[i] >= 0 || lk >= 2) : f.exec === 'no' ? (st.exec[i] < 0 && lk < 2) : true; // «yes» / «no»: the older two-value filter
      if (!ok) return;
    }
    if (f.rule === 'none' && st.exMask[i]) return;
    if (f.rule === 'any' && !st.exMask[i]) return;
    if (ruleBit && !(st.exMask[i] & ruleBit)) return;
    derive(ctx, i, ctx.cutoffN);
    if (sc.statusSet && !sc.statusSet[D.cls]) return; // global invoice-status filter
    if (stateIdx >= 0 && D.cls !== stateIdx) return;
    if (f.state === 'open' && !(D.outstanding > 0)) return;
    if (f.state === 'noncollected' && D.cls === CLASS_INDEX.collected) return;
    if (ageB >= 0 && !(D.outstanding > 0 && agingBucket(D.daysOverdue) === ageB)) return;
    if (f.ageMin != null && !(D.outstanding > 0 && !D.excluded && D.daysOverdue >= f.ageMin && D.daysOverdue <= f.ageMax)) return;
    if (f.tag) { const tg = tagsOf(st, i, D); if (f.tag === 'problem' ? !tg.some((x) => PROBLEM_TAGS.has(x)) : !tg.includes(f.tag)) return; }
    out.push(i); sums.gross += D.gross; sums.exclusions += D.exclTotal; sums.net += D.net; sums.collected += D.collected; sums.outstanding += D.outstanding;
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
  return { ctx, sc, cand: Int32Array.from(out), sums };
}

export function list(st, req) {
  const page = Math.max(0, Number(req.page) || 0); const size = Math.min(500, Math.max(1, Number(req.pageSize) || 50));
  const sortKey = SORT_KEYS[req.sort?.key] || 'issue'; const dir = req.sort?.dir === 'asc' ? 1 : -1;
  const ck = JSON.stringify([epoch, req.scope, req.cfg, req.filters, req.decisions && hashOf(JSON.stringify(req.decisions)), req.links && hashOf(JSON.stringify(req.links)), req.enf1 && hashOf(JSON.stringify(req.enf1)), req.owner, sortKey, dir]); // the CONTENT of the review overlay (not just its size): a link moving from proposed to confirmed, or open to closed, must not return a cached page
  let hit = lruGet(ck);
  if (!hit) {
    const { ctx, cand, sums } = candidates(st, req);
    let order;
    if (sortKey === 'id') { order = Int32Array.from(cand); if (dir < 0) order.reverse(); }
    else {
      const keys = new Float64Array(cand.length);
      for (let j = 0; j < cand.length; j += 1) {
        const i = cand[j];
        if (sortKey === 'issue') keys[j] = st.issue[i]; else if (sortKey === 'gross') keys[j] = st.gross[i];
        else { derive(ctx, i, ctx.cutoffN); keys[j] = sortKey === 'outstanding' ? ctx.D.outstanding : sortKey === 'collected' ? ctx.D.collected : ctx.D.outstanding > 0 ? ctx.D.daysOverdue : 0; }
      }
      const perm = new Uint32Array(cand.length); for (let j = 0; j < perm.length; j += 1) perm[j] = j;
      perm.sort((a, b) => (keys[a] - keys[b]) * dir || a - b); // typed-array sort: no allocation per comparison
      order = new Int32Array(cand.length); for (let j = 0; j < perm.length; j += 1) order[j] = cand[perm[j]];
    }
    hit = { order, sums, total: cand.length };
    lruSet(ck, hit);
  }
  const ctx = makeCtx(st, req);
  const rows = [];
  for (let j = page * size; j < Math.min(hit.total, (page + 1) * size); j += 1) {
    const i = hit.order[j]; derive(ctx, i, ctx.cutoffN);
    const row = rowOut(st, ctx, i, ctx.D);
    if (req.withExclusions) { // the exclusion register needs the evidence records of the rows on this page only
      const D = ctx.D;
      row.exclusions = materialize(st, i, ctx).exclusions; row.cancelled = D.cancelled; row.excluded = D.excluded; row.billedAfterAdj = D.billed;
      row.reasonRules = RULE_IDS.filter((_, b) => D.mask & (1 << b)); row.primaryRuleId = D.primaryBit ? RULE_IDS[Math.round(Math.log2(D.primaryBit))] : null;
    }
    rows.push(row);
  }
  return { total: hit.total, page, pageSize: size, sums: hit.sums, rows };
}

/* ------------------------------------------------------------------ CSV export (streamed in chunks) */
export const EXPORT_COLUMNS = ['invoice_id', 'sadad_no', 'issue_date', 'due_date', 'amanah_en', 'amanah_ar', 'municipality_ar', 'scope', 'revenue_source', 'supplying_system', 'revenue_item', 'amount_sar', 'collected_sar', 'outstanding_sar', 'cancelled_sar', 'excluded_sar', 'exclusions_sar', 'net_billed_sar', 'uncollected_sar', 'state', 'status_tahseel_raw', 'status_efaa_raw', 'days_overdue', 'contract_no', 'exclusion_rules', 'line_items', 'demo_data'];
const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function* exportChunks(st, req, chunk = 4000) {
  const { ctx, cand } = candidates(st, req);
  yield `﻿# demo data: synthetic, inspired by the monthly reports — not the Ministry's actual data. Amounts are exact values in SAR\n${EXPORT_COLUMNS.join(',')}\n`;
  let buf = [];
  for (let j = 0; j < cand.length; j += 1) {
    const i = cand[j]; derive(ctx, i, ctx.cutoffN);
    const r = rowOut(st, ctx, i, ctx.D);
    const sadad = i < st.nGen ? sadadOf(st.idKey[i]) : st.fixtures.get(i)?.sadadNo || '';
    buf.push([r.id, sadad, r.issueDate, r.dueDate, r.amanahEn, r.amanahAr, r.municipalityAr || '', r.scopeType, r.source, r.platform, r.itemEn, r.gross, r.collected, r.outstanding, r.cancelledAmount, r.exclusionAmount, r.exclusions, r.net, r.outstanding, r.cls, r.statusRawTahseel, r.statusRawEfaa || '', r.daysOverdue, r.contractNo || '', r.rules.join('|'), r.lines, 'تجريبية'].map(q).join(','));
    if (buf.length >= chunk) { yield `${buf.join('\n')}\n`; buf = []; }
  }
  if (buf.length) yield `${buf.join('\n')}\n`;
}

/* ------------------------------------------------------------------ worklists */
const ACT = { overdue: 1, partial: 0.85, linkage_unresolved: 0.5, ineligible_referral: 0.35, enforcement: 0.45, objection: 0.2, not_due: 0.1 };
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
      if (!(D.outstanding > 0) || D.excluded || D.cls === CLASS_INDEX.collected) continue;
      if (req.category && req.category !== 'all' && CLASSES[D.cls] !== req.category) continue;
      if (pass === 0) { total += 1; totalOut += D.outstanding; if (D.outstanding > maxAmt) maxAmt = D.outstanding; if (D.daysOverdue > maxAge) maxAge = D.daysOverdue; continue; }
      const ev = evidenceQuality(st, i, D); const act = ACT[CLASSES[D.cls]] ?? 0.3;
      top.push(i, W_.amount * (D.outstanding / maxAmt) + W_.aging * (D.daysOverdue / maxAge) + W_.actionability * act + W_.evidence * ev);
    }
    if (pass === 1) {
      const rows = top.sorted().map(([i, score]) => { derive(ctx, i, ctx.cutoffN); const r = rowOut(st, ctx, i, D); return { ...r, category: r.cls, actionability: ACT[r.cls] ?? 0.3, evidenceQuality: Math.round(evidenceQuality(st, i, D) * 100) / 100, score: Math.round(score * 1000) / 1000 }; });
      return { total, totalOutstanding: totalOut, rows };
    }
  }
  return null;
}

export function anomalies(st, req) {
  const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope); const D = ctx.D; const limit = Math.min(300, req.limit || 100);
  const top = new TopK(limit); const counts = {}; let total = 0;
  const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || st.issue[i] < sc.fromN || st.issue[i] > sc.toN || !inScope(st, sc, i)) continue;
    derive(ctx, i, ctx.cutoffN);
    const f = st.flags[i]; let sev = 0; const codes = [];
    if (f & F.AMT_CONFLICT) { codes.push('amount_conflict'); sev = 3; }
    if (D.pendingMask) { codes.push('exclusion_pending'); sev = Math.max(sev, 2); }
    if (f & F.MISSING_ID) { codes.push('missing_fields'); sev = Math.max(sev, 2); }
    if (st.src[i] === 0 && st.cstat[i] === 4) { codes.push('contract_unlinked'); sev = Math.max(sev, 2); }
    if (st.src[i] === 0 && st.cstat[i] === 2) { codes.push('contract_unmatched'); sev = Math.max(sev, 2); }
    if (D.link === 1) { codes.push('enforcement_candidate'); sev = Math.max(sev, 2); }
    if (D.excluded && D.received > 0) { codes.push('receipts_on_excluded'); sev = 3; }
    for (const c of codes) bump(c);
    if (sev && (!req.code || req.code === 'all' || codes.includes(req.code))) { total += 1; top.push(i, sev * 1e12 + st.gross[i]); }
  }
  const rows = top.sorted().map(([i]) => { derive(ctx, i, ctx.cutoffN); return rowOut(st, ctx, i, D); });
  return { total, counts, rows };
}

/* ------------------------------------------------------------------ risk radar (counts + top rows per category) */
export const VALUE_ANOMALY_MULTIPLE = 10;
export function risk(st, req) {
  const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope); const D = ctx.D; const limit = req.limit || 60;
  // peer baseline: mean gross per (entity, source) over the scope
  const sum = new Float64Array(ENTITIES.length * SOURCES.length); const cnt = new Float64Array(ENTITIES.length * SOURCES.length);
  for (let i = 0; i < st.n; i += 1) { if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i) || st.issue[i] < sc.fromN || st.issue[i] > sc.toN) continue; const g = st.ent[i] * SOURCES.length + st.src[i]; sum[g] += st.gross[i]; cnt[g] += 1; }
  const cat = { duplicate: { n: 0, amt: 0, top: new TopK(limit) }, struck_off_registry: { n: 0, amt: 0, top: new TopK(limit) }, deceased_person: { n: 0, amt: 0, top: new TopK(limit) }, value_anomaly: { n: 0, amt: 0, top: new TopK(limit) } };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i) || st.issue[i] < sc.fromN || st.issue[i] > sc.toN) continue;
    const f = st.flags[i];
    if (f & F.DUPLICATE_WF) { cat.duplicate.n += 1; cat.duplicate.amt += st.gross[i]; cat.duplicate.top.push(i, 90); }
    const fx = i >= st.nGen ? st.fixtures.get(i) : null;
    if (fx?.debtorInvalid || fx?.invalidDebtor) { const c = fx.debtorInvalidReason === 'deceased_person' ? 'deceased_person' : 'struck_off_registry'; cat[c].n += 1; cat[c].amt += st.gross[i]; cat[c].top.push(i, 85); }
    else if (st.crSt[i] === 2 || st.crSt[i] === 4) { derive(ctx, i, ctx.cutoffN); if (D.outstanding > 0) { cat.struck_off_registry.n += 1; cat.struck_off_registry.amt += st.gross[i]; cat.struck_off_registry.top.push(i, 85); } }
    const g = st.ent[i] * SOURCES.length + st.src[i];
    if (cnt[g] >= 30) { const avg = (sum[g] - st.gross[i]) / (cnt[g] - 1); const ratio = avg > 0 ? st.gross[i] / avg : 0; if (ratio >= VALUE_ANOMALY_MULTIPLE) { cat.value_anomaly.n += 1; cat.value_anomaly.amt += st.gross[i]; cat.value_anomaly.top.push(i, Math.min(99, 60 + (ratio - VALUE_ANOMALY_MULTIPLE) * 2)); } }
  }
  const out = {};
  for (const [k, v] of Object.entries(cat)) out[k] = { count: v.n, amount: v.amt, rows: v.top.sorted().map(([i, score]) => { derive(ctx, i, ctx.cutoffN); return { ...rowOut(st, ctx, i, D), score: Math.round(score) }; }) };
  return { categories: out, valueAnomalyMultiple: VALUE_ANOMALY_MULTIPLE };
}
void ENT_UNASSIGNED; void CHANNELS; void violationOf; void subscriptionOf; void dayNum;
