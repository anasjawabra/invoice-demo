// Revenue-source analysis of the first dashboard («لوحة المعلومات»): entities × revenue sources × time, from the SAME snapshots the dashboard uses.
// Pure functions, no I/O. Every figure is a sum of the snapshot's entity × source cells, so entities, sources and the Ministry always reconcile with the headline indicators.
//
// MEASURES (existing definitions are kept):
//   collected          = collected on the invoices ISSUED in the period, at the reference date (the dashboard's «المحصّل»); never double counted: one invoice belongs to one entity and one source
//   collection rate    = collected ÷ net billed
//   share              = collected of the source ÷ collected of the entity (contribution to the entity's collection)
//   change             = collected now − collected in the like-for-like previous period (equal elapsed time), in value and in %
//   share shift        = the source's share now − its share in that previous period (percentage points)
//   attainment of the revenue appropriation «نسبة تحقيق الاعتماد مقابل الإيراد» = payments received (payment date, any invoice) ÷ appropriation — a DIFFERENT measure from the collection rate, available only for the fiscal year to date and only for ALL sources together
//   pace deviation     = payments received − the appropriation spread evenly over the elapsed time (the business direction; no approved milestone plan exists) — shown as a deviation from the time-proportional target, never as «lateness»
// There is NO per-source target: the appropriation is never split across sources.
import { ENTITIES } from './catalog';
import { REVENUE_SOURCES } from './revenueLedger';
import { appropriationOf, APPROPRIATION_YEAR } from './appropriations';
import { evenPlan, plannedToDate } from './collectionGoal';

export const SOURCE_KEYS = Object.keys(REVENUE_SOURCES);
const EPS = 1e-9;
const div = (a, b) => (b > EPS ? a / b : null);

const cellMap = (snap) => {
  const m = new Map(); // `${entity}|${source}` → { net, collected, gross, count }
  for (const r of snap?.matrix?.amanahSource || []) m.set(`${r.amanah}|${r.source}`, { net: r.net, collected: r.collected, gross: r.gross, count: r.count });
  return m;
};

export const entityLabel = (key) => { const e = ENTITIES.find((x) => x.en === key); return e ? { ar: e.ar, en: e.en } : { ar: key, en: key }; };
export const sourceLabel = (key) => { const s = REVENUE_SOURCES[key]; return s ? { ar: s.ar, en: s.en } : { ar: key, en: key }; };

// Δcollected = Δnet × previous rate  +  net now × Δrate  (volume effect + rate effect; arithmetic, not a cause)
export function decompose(c, p) {
  if (!p || !(p.net > EPS)) return null;
  const rp = div(p.collected, p.net); const rc = div(c.collected, c.net);
  if (rp == null || rc == null) return null;
  const volume = (c.net - p.net) * rp; const rate = c.net * (rc - rp);
  return { volume, rate, total: c.collected - p.collected };
}

const sum = (cells, f) => cells.reduce((t, c) => t + (c ? f(c) : 0), 0);

// one group of cells (an entity, a source, an entity × source, or a region) against the same group in the previous period
function measureOf(curCells, prevCells) {
  const cur = { net: sum(curCells, (c) => c.net), collected: sum(curCells, (c) => c.collected), gross: sum(curCells, (c) => c.gross), count: sum(curCells, (c) => c.count) };
  const prev = prevCells ? { net: sum(prevCells, (c) => c.net), collected: sum(prevCells, (c) => c.collected), count: sum(prevCells, (c) => c.count) } : null;
  const change = prev ? cur.collected - prev.collected : null;
  return {
    ...cur, rate: div(cur.collected, cur.net),
    prevCollected: prev ? prev.collected : null, prevNet: prev ? prev.net : null, prevRate: prev ? div(prev.collected, prev.net) : null,
    change, changePct: prev && prev.collected > EPS ? change / prev.collected : null, hasPrev: !!prev && (prev.count > 0), isNew: !!prev && prev.collected <= EPS && cur.collected > EPS,
    decomposition: prev ? decompose(cur, prev) : null
  };
}

/**
 * @param {object} i
 * @param {object} i.cur           national snapshot of the period (all entities, all sources)
 * @param {object|null} i.prev     national snapshot of the like-for-like previous period
 * @param {boolean} i.comparable   the previous period lies inside the data coverage and is non-empty
 * @param {string} i.today         the reference date
 */
export function buildAnalysis({ cur, prev, comparable, today }) {
  const useP = !!(comparable && prev);
  const cc = cellMap(cur); const pc = useP ? cellMap(prev) : null;
  const entityKeys = ENTITIES.map((e) => e.en).filter((k) => [...cc.keys()].some((x) => x.startsWith(`${k}|`)) || (pc && [...pc.keys()].some((x) => x.startsWith(`${k}|`))));
  const sourceKeys = SOURCE_KEYS.filter((s) => entityKeys.some((e) => cc.has(`${e}|${s}`) || pc?.has(`${e}|${s}`)));

  const cellsOf = (map, e, s) => (e && s ? [map.get(`${e}|${s}`)] : e ? sourceKeys.map((x) => map.get(`${e}|${x}`)) : s ? entityKeys.map((x) => map.get(`${x}|${s}`)) : entityKeys.flatMap((x) => sourceKeys.map((y) => map.get(`${x}|${y}`)))).filter(Boolean);
  const group = (e = null, s = null) => measureOf(cellsOf(cc, e, s), pc ? cellsOf(pc, e, s) : null);

  const total = group();
  const totalCollected = total.collected; const prevTotalCollected = total.prevCollected;

  // payments received (payment date) by entity and the appropriation — only for the fiscal year to date
  const to = cur?.scope?.to; const from = cur?.scope?.from;
  const reporting = to && cur.cutoff && to > cur.cutoff ? cur.cutoff : to;
  const fy = from === `${APPROPRIATION_YEAR}-01-01` && reporting && reporting.slice(0, 4) === String(APPROPRIATION_YEAR);
  const payBy = cur?.receivedInPeriod?.byAmanah || {};
  const targetOf = (key) => {
    if (!fy) return null;
    const a = appropriationOf(key); if (!a || !(a.revAdjusted > 0)) return null;
    const expected = plannedToDate(evenPlan(a.revAdjusted), reporting);
    const pay = payBy[key] || 0;
    return { appropriation: a.revAdjusted, pay, attainment: pay / a.revAdjusted, expected, paceRatio: expected > 0 ? pay / expected : null, deviation: pay - expected, deviationPct: expected > 0 ? pay / expected - 1 : null };
  };

  const entities = entityKeys.map((key) => {
    const g = group(key);
    const sources = {}; for (const s of sourceKeys) {
      const x = group(key, s); if (!x.count && !x.hasPrev) continue;
      const share = div(x.collected, g.collected); const prevShare = x.prevCollected != null ? div(x.prevCollected, g.prevCollected) : null;
      sources[s] = { ...x, share, prevShare, shiftPp: share != null && prevShare != null ? (share - prevShare) * 100 : null };
    }
    return { key, label: entityLabel(key), ...g, share: div(g.collected, totalCollected), prevShare: g.prevCollected != null ? div(g.prevCollected, prevTotalCollected) : null, sources, target: targetOf(key) };
  });
  const sources = sourceKeys.map((s) => {
    const g = group(null, s);
    return { key: s, label: sourceLabel(s), ...g, share: div(g.collected, totalCollected), prevShare: g.prevCollected != null ? div(g.prevCollected, prevTotalCollected) : null, shiftPp: g.prevCollected != null && div(g.prevCollected, prevTotalCollected) != null && div(g.collected, totalCollected) != null ? (div(g.collected, totalCollected) - div(g.prevCollected, prevTotalCollected)) * 100 : null };
  });

  // reconciliation: entities and sources add up to the headline figures, nothing is counted twice
  const hl = cur?.totals || {};
  const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-9);
  const cellSum = [...cc.values()].reduce((t, c) => t + c.collected, 0);
  const checks = {
    entitiesAddUp: near(entities.reduce((t, e) => t + e.collected, 0), hl.collected ?? totalCollected),
    sourcesAddUp: near(sources.reduce((t, e) => t + e.collected, 0), hl.collected ?? totalCollected),
    cellsAddUp: near(cellSum, hl.collected ?? totalCollected),
    netAddsUp: near(entities.reduce((t, e) => t + e.net, 0), hl.net ?? total.net),
    prevEntitiesAddUp: !useP || near(entities.reduce((t, e) => t + (e.prevCollected || 0), 0), prev.totals.collected)
  };
  checks.ok = Object.values(checks).every(Boolean);

  // ---- deviations, ranked by FINANCIAL importance (value first; the % is shown beside it so a large % of a small source cannot dominate)
  const deviations = [];
  const floor = Math.max(1, (prevTotalCollected || totalCollected || 0) * 0.002);
  if (useP) {
    for (const e of entities) if (e.hasPrev && Math.abs(e.change) >= floor) deviations.push({ id: `e:${e.key}`, type: 'change', level: 'entity', entity: e.key, value: e.change, pct: e.changePct, weight: Math.abs(e.change), isNew: e.isNew });
    for (const s of sources) if (s.hasPrev && Math.abs(s.change) >= floor) deviations.push({ id: `s:${s.key}`, type: 'change', level: 'source', source: s.key, value: s.change, pct: s.changePct, weight: Math.abs(s.change), isNew: s.isNew });
    for (const e of entities) for (const [k, s] of Object.entries(e.sources)) {
      if (s.change != null && Math.abs(s.change) >= floor) deviations.push({ id: `es:${e.key}:${k}`, type: 'change', level: 'entity_source', entity: e.key, source: k, value: s.change, pct: s.changePct, weight: Math.abs(s.change), isNew: s.isNew });
      if (s.shiftPp != null && Math.abs(s.shiftPp) >= 2) { const moved = (Math.abs(s.shiftPp) / 100) * e.collected; if (moved >= floor) deviations.push({ id: `sh:${e.key}:${k}`, type: 'share', level: 'entity_source', entity: e.key, source: k, value: s.shiftPp, pct: null, weight: moved, from: s.prevShare, to: s.share }); }
    }
  }
  for (const e of entities) if (e.target && e.target.expected > 0 && Math.abs(e.target.deviation) >= floor) deviations.push({ id: `t:${e.key}`, type: 'target', level: 'entity', entity: e.key, value: e.target.deviation, pct: e.target.deviationPct, weight: Math.abs(e.target.deviation) });
  deviations.sort((a, b) => b.weight - a.weight);

  // the Ministry's own target position (all entities that have an appropriation)
  const withTarget = entities.filter((e) => e.target);
  const ministryTarget = withTarget.length ? withTarget.reduce((t, e) => ({ appropriation: t.appropriation + e.target.appropriation, pay: t.pay + e.target.pay, expected: t.expected + e.target.expected }), { appropriation: 0, pay: 0, expected: 0 }) : null;
  if (ministryTarget) { ministryTarget.unassignedPay = payBy.Unassigned || 0; ministryTarget.attainment = ministryTarget.pay / ministryTarget.appropriation; ministryTarget.deviation = ministryTarget.pay - ministryTarget.expected; ministryTarget.deviationPct = ministryTarget.expected > 0 ? ministryTarget.pay / ministryTarget.expected - 1 : null; ministryTarget.paceRatio = ministryTarget.expected > 0 ? ministryTarget.pay / ministryTarget.expected : null; }

  return { comparable: useP, total, entities, sources, entityKeys, sourceKeys, deviations, ministryTarget, targetAvailable: !!fy, checks, reporting, cur, prev, cc, pc, group };
}

/* ---------------------------------------------------------------- the map: one measure, optionally one source, for any group of entities (a region = the sum of its Amanahs) */
export const MAP_MEASURES = ['collected', 'attainment', 'deviation', 'change'];

// → { available, reason, ratio (the colour: 1 = 100 % = green), text: {value, pct}, parts } — never a zero for a missing figure
export function mapValue(A, keys, measure, source = null) {
  const cells = (map) => keys.flatMap((k) => (source ? [map?.get(`${k}|${source}`)] : A.sourceKeys.map((s) => map?.get(`${k}|${s}`)))).filter(Boolean);
  const cur = cells(A.cc);
  if (measure === 'collected') {
    const net = sum(cur, (c) => c.net); const col = sum(cur, (c) => c.collected);
    if (!cur.length || !(net > EPS)) return { available: false, reason: 'no_invoices' };
    return { available: true, ratio: col / net, value: col, pct: col / net, zero: col <= EPS };
  }
  if (measure === 'change') {
    if (!A.comparable) return { available: false, reason: 'no_comparison' };
    const prev = cells(A.pc); const pcol = sum(prev, (c) => c.collected); const col = sum(cur, (c) => c.collected);
    if (!(pcol > EPS)) return col > EPS ? { available: false, reason: 'new', value: col } : { available: false, reason: 'no_previous' };
    return { available: true, ratio: col / pcol, value: col - pcol, pct: col / pcol - 1 };
  }
  // attainment / deviation: the appropriation belongs to the entity as a whole — never split across sources
  if (source) return { available: false, reason: 'no_source_target' };
  if (!A.targetAvailable) return { available: false, reason: 'target_period' };
  const ts = keys.map((k) => A.entities.find((e) => e.key === k)?.target).filter(Boolean);
  if (!ts.length) return { available: false, reason: 'no_appropriation' };
  const approp = sum(ts, (t) => t.appropriation); const pay = sum(ts, (t) => t.pay); const exp = sum(ts, (t) => t.expected);
  if (measure === 'attainment') return { available: true, ratio: pay / approp, value: pay, pct: pay / approp };
  return exp > 0 ? { available: true, ratio: pay / exp, value: pay - exp, pct: pay / exp - 1 } : { available: false, reason: 'no_expected' };
}

/* ---------------------------------------------------------------- trend by issue month (cohorts), for any entity / source focus */
export function trendOf(A, entity = null, source = null) {
  const pick = (snap) => {
    const by = new Map();
    for (const r of snap?.matrix?.amanahSourceMonth || []) { if (entity && r.amanah !== entity) continue; if (source && r.source !== source) continue; const v = by.get(r.month) || { net: 0, collected: 0 }; v.net += r.net; v.collected += r.collected; by.set(r.month, v); }
    return [...by.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  };
  const c = pick(A.cur); const p = A.comparable ? pick(A.prev) : [];
  return c.map(([month, v], i) => { const q = p[i] ? p[i][1] : null; return { month, collected: v.collected, net: v.net, rate: div(v.collected, v.net), prevMonth: p[i] ? p[i][0] : null, prevCollected: q ? q.collected : null, prevRate: q ? div(q.collected, q.net) : null }; });
}

// improving / declining / stable from the like-for-like change of the collected amount AND of the rate
export function direction(A) {
  const t = A.total; if (!A.comparable || t.changePct == null) return { state: 'unknown' };
  const pp = t.rate != null && t.prevRate != null ? (t.rate - t.prevRate) * 100 : null;
  const up = t.changePct >= 0.02; const down = t.changePct <= -0.02;
  const state = up && (pp == null || pp >= -1) ? 'improving' : down && (pp == null || pp <= 1) ? 'declining' : up || down ? 'mixed' : 'stable';
  return { state, changePct: t.changePct, change: t.change, pp };
}

// where collection concentrates: the smallest set of entities (and of sources) that reaches ≥ 50 % of the collection
export function concentration(A) {
  const top = (rows) => { const sorted = [...rows].filter((r) => r.collected > EPS).sort((a, b) => b.collected - a.collected); const out = []; let acc = 0; for (const r of sorted) { out.push(r); acc += r.share || 0; if (acc >= 0.5) break; } return { rows: out, share: acc }; };
  return { entities: top(A.entities), sources: top(A.sources) };
}

// entities / sources that need follow-up: collection rate clearly below the overall one with a material amount still uncollected
export function needsFollowUp(A, limit = 6) {
  const overall = A.total.rate; if (overall == null) return [];
  const rows = [];
  for (const e of A.entities) { const out = e.net - e.collected; if (e.rate != null && e.rate < overall - 0.05 && out > A.total.net * 0.003) rows.push({ level: 'entity', entity: e.key, rate: e.rate, uncollected: out, gap: (overall - e.rate) * e.net, weight: (overall - e.rate) * e.net }); }
  for (const e of A.entities) for (const [k, s] of Object.entries(e.sources)) { const out = s.net - s.collected; if (s.rate != null && s.rate < overall - 0.15 && out > A.total.net * 0.003) rows.push({ level: 'entity_source', entity: e.key, source: k, rate: s.rate, uncollected: out, gap: (overall - s.rate) * s.net, weight: (overall - s.rate) * s.net }); }
  return rows.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

/* ---------------------------------------------------------------- a focus: any set of entities (a region, one Amanah, or none = the whole Ministry) and its sources */
export function focusBreakdown(A, keys = []) {
  const ks = keys.length ? keys.filter((k) => A.entityKeys.includes(k)) : A.entityKeys;
  const cells = (map, s) => ks.map((k) => map?.get(`${k}|${s}`)).filter(Boolean);
  const all = (map) => A.sourceKeys.flatMap((s) => cells(map, s));
  const total = measureOf(all(A.cc), A.pc ? all(A.pc) : null);
  const sources = A.sourceKeys.map((s) => {
    const m = measureOf(cells(A.cc, s), A.pc ? cells(A.pc, s) : null);
    const share = div(m.collected, total.collected); const prevShare = m.prevCollected != null ? div(m.prevCollected, total.prevCollected) : null;
    return { key: s, label: sourceLabel(s), ...m, share, prevShare, shiftPp: share != null && prevShare != null ? (share - prevShare) * 100 : null };
  }).filter((x) => x.count > 0 || x.hasPrev);
  const shareOfMinistry = div(total.collected, A.total.collected);
  const targets = ks.map((k) => A.entities.find((e) => e.key === k)?.target).filter(Boolean);
  const target = targets.length ? (() => { const t = targets.reduce((a, x) => ({ appropriation: a.appropriation + x.appropriation, pay: a.pay + x.pay, expected: a.expected + x.expected }), { appropriation: 0, pay: 0, expected: 0 }); return { ...t, attainment: t.pay / t.appropriation, deviation: t.pay - t.expected, deviationPct: t.expected > 0 ? t.pay / t.expected - 1 : null, paceRatio: t.expected > 0 ? t.pay / t.expected : null }; })() : null;
  return { keys: ks, total, sources, shareOfMinistry, target };
}
