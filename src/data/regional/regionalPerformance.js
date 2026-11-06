// REGIONAL PERFORMANCE — the ONE dataset behind the «الأداء حسب المنطقة» component (map AND table read the same object) and the metric engine on top of it.
// docs/insights-redesign-spec.md «Implementation notes — S (decoupling)». Pure functions + one thin loader; no React; NO financial formula is changed and NO plan / target is read: every figure is a sum of the snapshot's
// entity × source cells (collected, net, gross, exclusions, uncollected) the dashboard KPIs already come from, plus the existing comparison snapshot (comparison.js).
//
//   authorisedEntityKeys({ orgKeys, geoScope }) → string[] | null        the entity keys the viewer may see on the dashboard (null = all)
//   buildRegionalDataset({ snapshot, prevSnapshot?, comparison?, authorisedKeys? }) → dataset        (pure)
//   loadRegionalDataset(rev, { authorisedKeys? }) → Promise<dataset>     uses rev.snapshot / prevSnapshot / comparison when they are the PAGE scope's, else loads them for rev.scopeEff (never the national snapshot)
//   regionalMetric(dataset, metricId, { lang, level:'region'|'entity' }) → { metric, legend, scale, columns, rows, unattributed, total, comparison }       (per-row value · text parts · BAND STATUS + colour class · availability · tooltip facts · table cells)
//   statusOfMetric(metricId, row, dataset, mv?) → status (collectionBands.js)    rowStatuses(dataset, row) → { rate, changeCollected, changeRate }   — the ONE classification the map, table, card, panel and summary all use
//   regionDetail(dataset, { level, key }, { lang }) → { row, entities, sources, municipalities, increases, decreases, trend, comparable }       (the side panel)
//
// dataset = { schema, scope, cutoff, comparison:{ comparable, basis, previous:{from,to}|null, reason }, regions:[row], entities:[row], unattributed: row|null, total: row, kpi, reconciliation, authorised:{ restricted, keys }, raw }
// row     = { level:'region'|'entity'|'unattributed'|'total', key, iso?, regionIso?, label{ar,en}, entityKeys[], entityCount, hasInvoices, cur:{count,gross,exclusions,net,collected,uncollected,rate}, prev:{count,net,collected,rate}|null, sources:[{key,label,cur,prev}] }
// Records / entities WITHOUT a verified region (the Housing Sector and any entity not in the verified region→Amanah mapping) form the separate `unattributed` row — included in `total`, NEVER put in an invented region.
// Reconciliation: Σ regions + unattributed = total = the KPI strip's collected / net (asserted by tests). Only AUTHORISED entities exist anywhere in the dataset (cells, names, raw rows).
import { KSA_PROVINCES } from '../ksaProvinces';
import { ENTITIES } from '../catalog';
import { REVENUE_SOURCES } from '../revenueLedger';
import { allowedEntityKeys } from '../reportAccess';
import { loadComparison } from '../comparison';
import { unitOfValues, pickUnit } from '../../utils/money';
import { METRICS, REGIONAL_METRICS, REASONS, buildLegend, colorOf, formatValue, metricInfo } from './regionalLegend';
import { statusOf, unavailableStatus } from './collectionBands';

const bi = (ar, en) => ({ ar, en });
const EPS = 1e-9;
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (f(x) || 0), 0);
const div = (a, b) => (b > EPS ? a / b : null);
export const UNATTRIBUTED_LABEL = bi('بدون إسناد جغرافي', 'No geographic attribution');
export const UNATTRIBUTED_NOTE = bi('جهات أو سجلات بلا منطقة موثّقة؛ محسوبة في الإجمالي ولا تُسنَد إلى منطقة.', 'Entities or records without a verified region; counted in the total and never assigned to a region.');
export const REGION_OF = Object.freeze(Object.fromEntries(KSA_PROVINCES.flatMap((p) => p.amanahKeys.map((k) => [k, p.iso]))));
export const LEVEL_LABELS = Object.freeze({ region: bi('المنطقة', 'Region'), entity: bi('الأمانة', 'Amanah'), municipality: bi('البلدية', 'Municipality'), unattributed: UNATTRIBUTED_LABEL, total: bi('الإجمالي', 'Total') });

/* ---------------------------------------------------------------- access helpers */
/** the entity keys the viewer may see on the dashboard: their geographic scope ∩ the organisation's list (null = no narrowing). `geoScope` = access.effectiveScope('dashboard'). */
export function authorisedEntityKeys({ orgKeys = null, geoScope = null } = {}) {
  const k = geoScope == null ? null : allowedEntityKeys(geoScope);
  if (k && orgKeys) return k.filter((x) => orgKeys.includes(x));
  return k || orgKeys || null;
}

/* ---------------------------------------------------------------- building blocks */
const entLabel = (key) => { const e = ENTITIES.find((x) => x.en === key); return e ? bi(e.ar, e.en) : bi(key, key); };
const srcLabel = (key) => { const s = REVENUE_SOURCES[key]; return s ? bi(s.ar, s.en) : bi(key, key); };
const curOf = (cells) => {
  const net = sum(cells, (c) => c.net); const collected = sum(cells, (c) => c.collected);
  return { count: sum(cells, (c) => c.count), gross: sum(cells, (c) => c.gross), exclusions: sum(cells, (c) => c.exclusions), net, collected, uncollected: sum(cells, (c) => c.outstanding), rate: div(collected, net) };
};
const prevOfCells = (cells) => { const net = sum(cells, (c) => c.net); const collected = sum(cells, (c) => c.collected); return { count: sum(cells, (c) => c.count), net, collected, rate: div(collected, net) }; };

function sourcesOf(cur, prev) { // prev = null when there is no comparison
  const keys = [...new Set([...cur.map((c) => c.source), ...(prev || []).map((c) => c.source)])];
  return keys.map((k) => ({ key: k, label: srcLabel(k), cur: curOf(cur.filter((c) => c.source === k)), prev: prev ? prevOfCells(prev.filter((c) => c.source === k)) : null }));
}

function makeRow(level, key, label, entityKeys, cur, prev, extra = {}) {
  const c = curOf(cur); const p = prev ? prevOfCells(prev) : null;
  return { level, key, label, entityKeys, entityCount: entityKeys.length, hasInvoices: c.count > 0, cur: c, prev: p, sources: sourcesOf(cur, prev), ...extra };
}

const sameScope = (a, b, cutoff) => {
  if (!a || !b) return false;
  const norm = (v) => (Array.isArray(v) ? v.slice().sort().join(',') : String(v ?? 'all'));
  const to = (t) => (cutoff && t > cutoff ? cutoff : t);
  return a.from === b.from && to(a.to) === to(b.to) && norm(a.amanah) === norm(b.amanah) && norm(a.source) === norm(b.source) && norm(a.scopeType ?? 'all') === norm(b.scopeType ?? 'all') && norm(a.muni) === norm(b.muni) && norm(a.status ?? 'all') === norm(b.status ?? 'all');
};

/**
 * The regional dataset of the PAGE scope. `snapshot` / `prevSnapshot` / `comparison` are the page's own (RevenueContext: rev.snapshot, rev.prevSnapshot, rev.comparison) — the very ones the KPI strip reads.
 * `authorisedKeys` (null = the data service already narrowed the snapshot, nothing further to cut) removes every entity outside the viewer's authorisation from cells, names, plan figures and raw rows.
 */
export function buildRegionalDataset({ snapshot, prevSnapshot = null, comparison = null, authorisedKeys = null } = {}) {
  const allowed = Array.isArray(authorisedKeys) ? new Set(authorisedKeys) : null;
  const ok = (k) => !allowed || allowed.has(k);
  const comparable = !!(comparison?.comparable && prevSnapshot);
  const allCur = snapshot?.matrix?.amanahSource || [];
  const curCells = allCur.filter((r) => ok(r.amanah));
  const filtered = curCells.length !== allCur.length; // the client-side authorisation cut something the data service had left in (never the normal case: the service already narrows)
  const prevCells = comparable ? (prevSnapshot?.matrix?.amanahSource || []).filter((r) => ok(r.amanah)) : [];
  const curMonths = (snapshot?.matrix?.amanahSourceMonth || []).filter((r) => ok(r.amanah));
  const prevMonths = comparable ? (prevSnapshot?.matrix?.amanahSourceMonth || []).filter((r) => ok(r.amanah)) : [];

  // the entity universe: entities with invoices now or in the comparison period
  const keys = new Set([...curCells.map((r) => r.amanah), ...prevCells.map((r) => r.amanah)]);
  const ordered = ENTITIES.map((e) => e.en).filter((k) => keys.has(k));
  const unknown = [...keys].filter((k) => !ordered.includes(k)).sort();
  const entityKeys = [...ordered, ...unknown];

  const muniOf = (snap, key) => (snap?.byMunicipality || []).filter((g) => g.amanah === key && g.municipality);
  const entities = entityKeys.map((k) => {
    const c = curCells.filter((r) => r.amanah === k); const p = comparable ? prevCells.filter((r) => r.amanah === k) : null;
    const munis = muniOf(snapshot, k); const pm = new Map(muniOf(comparable ? prevSnapshot : null, k).map((g) => [g.key, g]));
    const municipalities = munis.map((g) => ({ key: g.key, refId: g.municipality.refId ?? null, status: g.status, label: bi(g.municipality.ar, g.municipality.en), cur: { count: g.count, net: g.net, collected: g.collected, uncollected: g.outstanding, rate: div(g.collected, g.net) }, prev: comparable ? (pm.has(g.key) ? { count: pm.get(g.key).count, net: pm.get(g.key).net, collected: pm.get(g.key).collected, rate: div(pm.get(g.key).collected, pm.get(g.key).net) } : { count: 0, net: 0, collected: 0, rate: null }) : null }));
    return makeRow('entity', k, entLabel(k), [k], c, p, { regionIso: REGION_OF[k] || null, municipalities });
  });

  const regions = KSA_PROVINCES.map((p) => {
    const ks = entityKeys.filter((k) => REGION_OF[k] === p.iso); if (!ks.length) return null;
    return makeRow('region', p.iso, bi(p.nameAr, p.nameEn), ks, curCells.filter((r) => ks.includes(r.amanah)), comparable ? prevCells.filter((r) => ks.includes(r.amanah)) : null, { iso: p.iso });
  }).filter(Boolean);
  const unKeys = entityKeys.filter((k) => !REGION_OF[k]);
  const unattributed = unKeys.length ? makeRow('unattributed', 'unattributed', UNATTRIBUTED_LABEL, unKeys, curCells.filter((r) => unKeys.includes(r.amanah)), comparable ? prevCells.filter((r) => unKeys.includes(r.amanah)) : null, { note: UNATTRIBUTED_NOTE }) : null;
  const total = makeRow('total', 'total', LEVEL_LABELS.total, entityKeys, curCells, comparable ? prevCells : null);

  // reconciliation with the KPI figures the page shows (the snapshot totals): regions + unattributed = the total = the KPI
  const T = snapshot?.totals || {}; const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 1e-9);
  const sumRows = (f) => sum(regions, (r) => f(r.cur)) + (unattributed ? f(unattributed.cur) : 0);
  const internal = {
    collectedAddsUp: near(sumRows((c) => c.collected), total.cur.collected), netAddsUp: near(sumRows((c) => c.net), total.cur.net), countAddsUp: near(sumRows((c) => c.count), total.cur.count),
  };
  const kpi = {
    collectedIsKpi: near(total.cur.collected, T.collected ?? total.cur.collected), netIsKpi: near(total.cur.net, T.net ?? total.cur.net), uncollectedIsKpi: near(total.cur.uncollected, T.outstanding ?? total.cur.uncollected)
  };
  const previous = comparable || prevSnapshot ? { from: prevSnapshot?.scope?.from ?? null, to: prevSnapshot?.scope?.to ?? null } : null;
  const reason = comparable ? null : (!prevSnapshot ? 'no_comparison' : (comparison?.notComparableReason || 'no_comparison'));
  return {
    schema: 1,
    scope: snapshot?.scope ? { from: snapshot.scope.from, to: snapshot.scope.to, amanah: snapshot.scope.amanah, source: snapshot.scope.source, scopeType: snapshot.scope.scopeType, muni: snapshot.scope.muni, status: snapshot.scope.status } : null,
    cutoff: snapshot?.cutoff ?? null,
    comparison: { comparable, basis: comparison?.basis ?? null, previous: comparable ? previous : null, reason },
    regions, entities, unattributed, total,
    kpi: { count: T.count ?? null, gross: T.gross ?? null, net: T.net ?? null, collected: T.collected ?? null, uncollected: T.outstanding ?? null },
    reconciliation: { ok: Object.values(internal).every(Boolean) && (filtered || Object.values(kpi).every(Boolean)), checks: { ...internal, ...kpi }, authorisationFiltered: filtered },
    authorised: { restricted: !!allowed, keys: allowed ? [...allowed] : null },
    raw: { cur: curCells, prev: prevCells, curMonths, prevMonths }
  };
}

/** the dataset of the page scope: uses rev.snapshot / prevSnapshot / comparison while they ARE the page scope's (same period, entity, municipality, source, status), otherwise loads them for rev.scopeEff — never a national snapshot */
export async function loadRegionalDataset(rev, { authorisedKeys = null } = {}) {
  const sc = rev.scopeEff || {};
  let { snapshot, prevSnapshot, comparison } = rev;
  if (!snapshot || !sameScope(snapshot.scope, sc, rev.cfg?.cutoff)) {
    const req = { from: sc.from, to: sc.to, amanah: sc.amanah, source: sc.source, scopeType: sc.scopeType, muni: sc.muni, status: sc.status, product: sc.product, mainClass: sc.mainClass };
    snapshot = await rev.data.snapshot(req);
    const c = await loadComparison(rev.data, req, rev.cfg, snapshot); prevSnapshot = c.prev; comparison = c.comparison;
  }
  return buildRegionalDataset({ snapshot, prevSnapshot, comparison, authorisedKeys });
}

/* ---------------------------------------------------------------- the facts of a row (tooltip / table) */
export function factsOf(row, dataset) {
  const comparable = dataset.comparison.comparable; const p = row.prev; const c = row.cur;
  const change = comparable && p ? c.collected - p.collected : null;
  return {
    count: c.count, gross: c.gross, exclusions: c.exclusions, net: c.net, collected: c.collected, uncollected: c.uncollected, rate: c.net > EPS ? c.rate : null,
    prevCollected: comparable && p ? p.collected : null, prevNet: comparable && p ? p.net : null, prevRate: comparable && p ? p.rate : null,
    change, changePct: comparable && p && p.collected > EPS ? (c.collected - p.collected) / p.collected : null,
    changePp: comparable && p && c.rate != null && p.rate != null ? (c.rate - p.rate) * 100 : null
  };
}

/* ---------------------------------------------------------------- the metrics */
const un = (reason, detail = null, message = null) => ({ value: null, available: false, reason, detail, message: message || REASONS[reason]?.message || null });
const av = (value) => ({ value, available: true, reason: null, detail: null, message: null });

/** the value of ONE metric for one row: { value, available, reason, detail, message } — an unavailable value is NEVER 0 */
export function metricValue(metricId, row, dataset) {
  const c = row.cur; const p = row.prev; const comparable = dataset.comparison.comparable;
  switch (metricId) {
    case 'collected': return c.count > 0 ? av(c.collected) : un('no_invoices');
    case 'collectionRate': return c.count === 0 ? un('no_invoices') : c.net > EPS ? av(c.collected / c.net) : un('zero_denominator');
    case 'changeCollected': {
      if (!comparable || !p) return un('no_comparison');
      if (p.collected > EPS) return av(c.collected / p.collected - 1);
      if (c.collected > EPS) return un('new');
      return p.count === 0 && c.count === 0 ? un('no_comparison') : un('zero_denominator');
    }
    case 'changeRate': {
      if (!comparable || !p) return un('no_comparison');
      if (c.count === 0) return un(p.count === 0 ? 'no_comparison' : 'no_invoices');
      if (!(c.net > EPS)) return un('zero_denominator');
      if (!(p.net > EPS)) return p.count === 0 ? un('new') : un('zero_denominator');
      return av((c.collected / c.net - p.collected / p.net) * 100);
    }
    default: return un('no_data');
  }
}

/**
 * The BAND STATUS of a row for a metric — the same function colours the map fill, the table band column, the card, the panel and the summary. The rule comes from METRICS[metric].rule (collectionBands.BAND_RULES):
 * «المحصّل» and «نسبة التحصيل» are both judged by the row's COLLECTION RATE (collected ÷ net invoiced, summed amounts); the two change metrics by the size of their change.
 */
export function statusOfMetric(metricId, row, dataset, mv = null) {
  const m = metricInfo(metricId);
  const driverMetric = m.rule === 'rate' ? 'collectionRate' : m.id;
  const v = driverMetric === m.id && mv ? mv : metricValue(driverMetric, row, dataset);
  if (!v.available) return unavailableStatus(m.rule, { reason: v.reason, reasonLabel: REASONS[v.reason]?.short || null, message: v.message, detail: v.detail });
  return statusOf(m.rule, v.value);
}
/** every status of a row, each by its own rule: the collection rate and the two changes — what the details panel and the summary cite */
export function rowStatuses(dataset, row) {
  return { rate: statusOfMetric('collectionRate', row, dataset), changeCollected: statusOfMetric('changeCollected', row, dataset), changeRate: statusOfMetric('changeRate', row, dataset) };
}

// the table: the selected metric first, then its supporting columns, the BAND column last (text + icon: the same classification as the map fill)
const COLUMNS = {
  collected: ['collected', 'collectionRate', 'net', 'status'],
  collectionRate: ['collectionRate', 'collected', 'net', 'status'],
  changeCollected: ['changeCollected', 'collected', 'prevCollected', 'status'],
  changeRate: ['changeRate', 'collectionRate', 'prevRate', 'status']
};
const COLUMN_DEFS = {
  collected: { label: bi('المحصّل (فواتير الفترة)', 'Collected (period invoices)'), kind: 'money', metric: 'collected' }, collectionRate: { label: bi('نسبة التحصيل من صافي المفوتر', 'Collection rate against net invoiced'), kind: 'pct', metric: 'collectionRate' },
  net: { label: bi('صافي المفوتر', 'Net invoiced'), kind: 'money' }, prevCollected: { label: bi('المحصّل في فترة المقارنة', 'Collected, comparison period'), kind: 'money' },
  prevRate: { label: bi('نسبة التحصيل في فترة المقارنة', 'Collection rate, comparison period'), kind: 'pct' },
  status: { label: bi('نطاق أداء التحصيل', 'Collection-performance band'), kind: 'status' },
  changeCollected: { label: bi('التغير في المحصّل (%)', 'Change in collected (%)'), kind: 'pct', metric: 'changeCollected' }, changeRate: { label: bi('التغير في نسبة التحصيل (نقطة مئوية)', 'Change in collection rate (pp)'), kind: 'pp', metric: 'changeRate' }
};
export const columnsFor = (metricId) => (COLUMNS[metricId] || COLUMNS.collected).map((id, i) => {
  const def = COLUMN_DEFS[id];
  const label = id === 'status' && metricInfo(metricId).rule !== 'rate' ? bi('حجم التغير', 'Size of the change') : def.label; // the change metrics' band column describes the CHANGE
  return { id, ...def, label, primary: i === 0 };
});

function cellValue(col, row, mv, dataset) {
  const f = row.__facts;
  switch (col.id) {
    case 'collected': return row.cur.count > 0 ? av(row.cur.collected) : un('no_invoices');
    case 'net': return row.cur.count > 0 ? av(row.cur.net) : un('no_invoices');
    case 'prevCollected': return f.prevCollected != null ? av(f.prevCollected) : un('no_comparison');
    case 'prevRate': return f.prevRate != null ? av(f.prevRate) : un('no_comparison');
    case 'status': { const st = row.__status; return { value: st.available ? 4 - st.rank : null, available: st.available, reason: st.reason || null, detail: st.detail || null, message: st.message || null, status: st }; } // value = severity (4 = worst) so a descending sort lists the worst first
    default: return col.metric ? (col.primary ? mv : metricValue(col.metric, row, dataset)) : un('no_data');
  }
}
const textOfCell = (col, cv, lang, scale) => {
  if (col.kind === 'status') return { sign: '', number: cv.available ? String(cv.value) : '—', unit: '', text: `${cv.status.glyph} ${(lang === 'ar' ? cv.status.label.ar : cv.status.label.en)}`, direction: null, label: null };
  if (!cv.available) return { sign: '', number: '—', unit: '', text: '—', direction: null, label: cv.reason ? REASONS[cv.reason]?.short : null };
  if (col.metric) return { ...formatValue(col.metric, cv.value, { lang, scale }), label: null };
  const m = col.kind === 'money' ? 'collected' : col.kind === 'pp' ? 'changeRate' : 'collectionRate';
  return { ...formatValue(m, cv.value, { lang, scale }), label: null };
};

/**
 * The selected metric over the dataset, ready to draw. `level`: 'region' (the map + the regional table; default) or 'entity' (the Amanah rows). The legend, the shared money unit and the colour classes come from the rows listed
 * (+ the unattributed row). The legend classes are FIXED by the band table, so the colour of a row never depends on the other rows; `available` is the availability of the VALUE, `status.available` the availability of the COLOUR
 * (a collected amount can be shown while there is no valid net invoiced ⇒ the row is hatched «غير متاح», not red). Rows are listed by the metric (largest first; unavailable last): an ORDER of display only, never a colour input.
 * row = { key, level, iso?, regionIso?, label, entityKeys, entityCount, value, available, reason, detail, message, reasonLabel{ar,en}, text:{sign,number,unit,text,direction,label?}, status (collectionBands), color:{bucket,buckets,cls,glyph,fill,tone}, direction, facts, cells:{[colId]:{value,available,reason,text}} }
 */
export function regionalMetric(dataset, metricId, { lang = 'ar', level = 'region' } = {}) {
  const m = metricInfo(metricId);
  const list = level === 'entity' ? dataset.entities : dataset.regions;
  const all = [...list, ...(dataset.unattributed ? [dataset.unattributed] : []), dataset.total];
  for (const r of all) r.__facts = factsOf(r, dataset);
  const mvs = new Map(all.map((r) => [r, metricValue(m.id, r, dataset)]));
  for (const r of all) r.__status = statusOfMetric(m.id, r, dataset, mvs.get(r)); // the ONE classification of the row for this metric
  const population = [...list, ...(dataset.unattributed ? [dataset.unattributed] : [])];
  const values = population.map((r) => mvs.get(r)).filter((x) => x.available).map((x) => x.value);
  const columns = columnsFor(m.id);
  // ONE money unit for every money figure of the table, so columns compare
  const moneyVals = [];
  for (const r of all) for (const col of columns) if (col.kind === 'money') { const cv = cellValue(col, r, mvs.get(r), dataset); if (cv.available) moneyVals.push(cv.value); }
  const scale = moneyVals.length ? unitOfValues(moneyVals) : pickUnit(0);
  const legend = buildLegend(m.id, values, { scale: m.unit === 'money' ? scale : null, comparison: dataset.comparison });
  const build = (r) => {
    const mv = mvs.get(r); const facts = r.__facts; const status = r.__status;
    const cells = Object.fromEntries(columns.map((col) => { const cv = cellValue(col, r, mv, dataset); return [col.id, { value: cv.value, available: cv.available, reason: cv.reason, text: textOfCell(col, cv, lang, scale), ...(cv.status ? { status: cv.status } : {}) }]; }));
    const text = textOfCell({ id: m.id, kind: m.unit, metric: m.id }, mv, lang, scale);
    return { key: r.key, level: r.level, ...(r.iso ? { iso: r.iso } : {}), ...(r.regionIso ? { regionIso: r.regionIso } : {}), label: r.label, entityKeys: r.entityKeys.slice(), entityCount: r.entityCount, hasInvoices: r.hasInvoices,
      value: mv.value, available: mv.available, reason: mv.reason, detail: mv.detail, message: mv.message, reasonLabel: mv.reason ? REASONS[mv.reason]?.short : null,
      text, status, color: colorOf(legend, status.available ? status.driver : null), direction: text.direction,
      facts, cells, ...(r.note ? { note: r.note } : {}) };
  };
  const rank = (a, b) => (a.available === b.available ? (a.available ? b.value - a.value : 0) : a.available ? -1 : 1);
  const rows = list.map(build).sort((a, b) => rank(a, b) || (a.label.en < b.label.en ? -1 : 1));
  const moneyUnit = buildLegend('collected', [], { scale }).unit.label; // the unit of the MONEY columns of the table (the legend's unit is the unit of the selected metric: % / points for the rate and the changes)
  const result = { metric: m, level, legend, scale: { key: scale.key, label: legend.unit.label }, moneyUnit, comparison: legend.comparisonBasis, columns, rows, unattributed: dataset.unattributed ? build(dataset.unattributed) : null, total: build(dataset.total) };
  for (const r of all) { delete r.__facts; delete r.__status; }
  return result;
}
export const metricList = () => REGIONAL_METRICS.map((id) => METRICS[id]);

/* ---------------------------------------------------------------- the side panel */
const monthly = (rows, keys) => {
  const by = new Map();
  for (const r of rows) { if (keys && !keys.includes(r.amanah)) continue; const v = by.get(r.month) || { net: 0, collected: 0 }; v.net += r.net; v.collected += r.collected; by.set(r.month, v); }
  return [...by.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
};
/** the details of a region / an entity / the unattributed bucket: its entities, revenue sources, municipalities, the FULL increases and decreases against the comparable period, and the monthly trend (current vs comparison, by issue month) */
export function regionDetail(dataset, { level, key }, { lang = 'ar' } = {}) {
  const row = level === 'region' ? dataset.regions.find((r) => r.key === key) : level === 'entity' ? dataset.entities.find((r) => r.key === key) : level === 'unattributed' ? dataset.unattributed : level === 'total' ? dataset.total : null;
  if (!row) return null;
  const comparable = dataset.comparison.comparable; const keys = row.entityKeys;
  const share = (v, t) => div(v, t);
  const sources = row.sources.map((s) => ({ key: s.key, label: s.label, cur: s.cur, prev: comparable ? s.prev : null, share: share(s.cur.collected, row.cur.collected), change: comparable && s.prev ? s.cur.collected - s.prev.collected : null, changePct: comparable && s.prev && s.prev.collected > EPS ? s.cur.collected / s.prev.collected - 1 : null, isNew: comparable && !!s.prev && s.prev.collected <= EPS && s.cur.collected > EPS }))
    .filter((s) => s.cur.count > 0 || (s.prev && s.prev.count > 0)).sort((a, b) => b.cur.collected - a.cur.collected);
  const entities = (level === 'entity' ? [] : keys.map((k) => dataset.entities.find((e) => e.key === k)).filter(Boolean));
  const changeOf = (kind, x, prevCollected, collected) => ({ kind, key: x.key, label: x.label, change: collected - prevCollected, changePct: prevCollected > EPS ? collected / prevCollected - 1 : null, isNew: prevCollected <= EPS && collected > EPS, collected, prevCollected });
  const changes = comparable ? [
    ...(level === 'entity' ? [] : entities.filter((e) => e.prev).map((e) => changeOf('entity', e, e.prev.collected, e.cur.collected))),
    ...sources.filter((s) => s.prev).map((s) => changeOf('source', s, s.prev.collected, s.cur.collected))
  ].filter((c) => Math.abs(c.change) > EPS) : [];
  const increases = changes.filter((c) => c.change > 0).sort((a, b) => b.change - a.change);
  const decreases = changes.filter((c) => c.change < 0).sort((a, b) => a.change - b.change);
  const cur = monthly(dataset.raw.curMonths, keys); const prv = comparable ? monthly(dataset.raw.prevMonths, keys) : [];
  const trend = cur.map(([month, v], i) => { const q = prv[i] ? prv[i][1] : null; return { month, collected: v.collected, net: v.net, rate: div(v.collected, v.net), prevMonth: prv[i] ? prv[i][0] : null, prevCollected: q ? q.collected : null, prevRate: q ? div(q.collected, q.net) : null }; });
  const municipalities = level === 'entity' ? row.municipalities : [];
  return { level, key, label: row.label, levelLabel: LEVEL_LABELS[level], row: { ...row, facts: factsOf(row, dataset) }, entities, sources, municipalities, increases, decreases, trend, comparable, statuses: rowStatuses(dataset, row), lang };
}
