// Planning ACTION LINES (server/planningActions.js, POST /api/plan-actions; docs/planning-review/07 + 10 D-10).
// Run: npm run test:planactions — synthetic data only. Direct-engine tests over the compact world + HTTP-level tests (signed tokens of an IN-MEMORY identity store, the pattern of tests/authz-server.test.mjs).
//   every uncollected, non-excluded invoice with a remaining balance is in EXACTLY ONE line · Σ lines = the stock net unpaid (national, Jeddah, a municipality scope, a restricted org / geographic access) · class boundaries at 180 days and at year-end ·
//   a missing due date is its own class · partial payments leave the remaining balance · excluded invoices are never in a line · EVERY line's drill reproduces its invoices through list() · 403 without the planning module · masking · AR/EN · no NaN.
import assert from 'node:assert/strict';
import { ENTITIES, F, dayNum } from '../src/data/catalog.js';
import { ALL_SCOPE, normalizeGeoScope, entireAmanahGrant } from '../src/data/geoScope.js';
import { parseMuniKey } from '../src/data/municipalityModel.js';
import { resetForTests, getDb, issueToken } from '../server/identity/index.js';
import { commit } from '../server/identity/store.js';
import { hashPassword } from '../server/identity/crypto.js';
import { loadStore } from '../server/store.js';
import { list, bumpEpoch } from '../server/lists.js';
import { snapshot, makeCtx, derive } from '../server/engine.js';
import { actionLines, planClassOf, blockerOf, yearEndOf, PLAN_CLASSES, PLAN_AGED_DAYS, ACTIONS } from '../server/planningActions.js';
import { ENDPOINTS, requiredPermissionFor } from '../server/endpointAccess.js';
import { handleApi } from '../server/api.js';

let n = 0; const pending = [];
const ok = (name, fn) => { pending.push(async () => { try { await fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } }); };
const TODAY = '2026-11-06'; const FROM = '2000-01-01';
resetForTests(':memory:');
const st = loadStore(TODAY, { size: 'compact' });
const CFG = { cutoff: TODAY };
const JED = 'Jeddah Amanah'; const RIY = 'Riyadh Amanah';
const near = (a, b, msg) => assert.ok(Math.abs(a - b) <= 0.5, `${msg}: ${a} vs ${b}`);
const BASE = { from: FROM, to: TODAY };
const req = (scope = {}, extra = {}) => ({ scope: { ...BASE, ...scope }, cfg: CFG, owner: 0, ...extra });

/* ------------------------------------------------------------------ helpers */
function walk(o, path, fn) { if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`, fn); } else fn(o, path); }
function noNaN(o, label) { walk(o, label, (v, p) => { if (typeof v === 'number') assert.ok(Number.isFinite(v), `${p} is not a finite number (${v})`); assert.notEqual(v, undefined, `${p} is undefined`); }); }
/** every invoice a drill opens, through the REAL list(): the page re-adds the organisation / access of the request exactly like requestFor() does */
function drillRows(drill, r) {
  const rows = [];
  for (let p = 0; ; p += 1) {
    const x = list(st, { scope: { ...drill.scope, ...(r.scope?.org ? { org: r.scope.org } : {}) }, cfg: r.cfg || CFG, filters: drill.filters, access: r.access, owner: 0, page: p, pageSize: 500, sort: { key: 'id', dir: 'asc' }, decisions: r.decisions, links: r.links });
    rows.push(...x.rows); if (rows.length >= x.total) return { rows, total: x.total, sums: x.sums };
  }
}
const stockOf = (r) => snapshot(st, { scope: r.scope, cfg: r.cfg || CFG, access: r.access, owner: 0, decisions: r.decisions, links: r.links }).stock;
/** the full contract of one response against the engine and the list */
function verify(res, r, label) {
  noNaN(res, label);
  const stock = stockOf(r);
  near(res.totals.remaining, stock.netUncollected, `${label}: Σ lines = stock net unpaid`);
  assert.equal(res.totals.count, stock.invoiceCount, `${label}: invoice count`);
  near(PLAN_CLASSES.reduce((t, c) => t + res.totals.byClass[c].remaining, 0), res.lines.reduce((t, l) => t + l.remaining, 0), `${label}: Σ classes = Σ lines`);
  const seen = new Map(); let lineSum = 0; let lineCount = 0;
  for (const l of res.lines) {
    assert.ok(l.count > 0 && l.remaining > 0, `${label}: a line holds invoices`);
    assert.ok(l.entity.ar && l.entity.en && l.source.ar && l.source.en && l.classLabel.ar && l.classLabel.en && l.recommendedAction.ar && l.recommendedAction.en && l.recommendedAction.key, `${label}: AR/EN labels`);
    assert.equal(l.expectedImpact, null); assert.equal(l.expectedImpactReason.ar, 'غير متاح'); assert.equal(l.expectedImpactReason.en, 'Not available');
    assert.equal(l.drill.route, '/collection'); assert.equal(l.drill.filters.state, 'open'); assert.equal(l.drill.filters.allPeriods, true);
    const d = drillRows(l.drill, r);
    assert.equal(d.total, l.count, `${label} ${l.id}: drill count = line count`);
    near(d.sums.outstanding, l.remaining, `${label} ${l.id}: drill total = line remaining`);
    for (const row of d.rows) { assert.ok(!seen.has(row.id), `${label}: ${row.id} is in two lines (${seen.get(row.id)} and ${l.id})`); seen.set(row.id, l.id); assert.ok(row.outstanding > 0 && row.cls !== 'excluded' && row.cls !== 'cancelled', `${label}: only uncollected, non-excluded, non-cancelled invoices`); }
    near(d.rows.reduce((t, x) => t + x.outstanding, 0), l.remaining, `${label} ${l.id}: rows sum`);
    if (l.class === 'A') { assert.ok(l.blockers.length > 0, 'a blocked line names its reason'); near(l.blockers.reduce((t, b) => t + b.amount, 0), l.remaining, `${label} ${l.id}: blockers sum`); for (const b of l.blockers) { const bd = drillRows(b.drill, r); assert.equal(bd.total, b.count); near(bd.sums.outstanding, b.amount, `${label} ${l.id} ${b.key}`); assert.ok(b.ar && b.en); } }
    else assert.equal(l.blockers, undefined);
    lineSum += l.remaining; lineCount += l.count;
  }
  assert.equal(seen.size, lineCount, `${label}: the drill invoices are disjoint across lines`); assert.equal(lineCount, stock.invoiceCount);
  near(lineSum, stock.netUncollected, `${label}: Σ remaining`);
  // the actionable roll-up (B + C of a cell) opens exactly B ∪ C
  for (const c of res.cells.slice(0, 40)) { const d = drillRows(c.drillActionable, r); near(d.sums.outstanding, c.actionable, `${label} ${c.id}: actionable drill`); }
  near(res.cells.reduce((t, c) => t + c.remaining, 0), stock.netUncollected, `${label}: Σ cells`); near(res.entities.reduce((t, e) => t + e.remaining, 0), stock.netUncollected, `${label}: Σ entities`);
  near(res.totals.actionable.remaining, res.totals.byClass.B.remaining + res.totals.byClass.C.remaining, 'actionable = B + C');
  near(res.separate.excluded.amount, stock.excluded, `${label}: excluded unpaid is apart from the lines`);
  return res;
}

/* ================================================================== 1. the national population */
const NAT = req();
let natRes;
ok('national: Σ lines = the stock net unpaid to the SAR; every invoice in exactly one line; every line\'s drill reproduces the line through list(); AR/EN everywhere; no NaN', () => {
  natRes = verify(actionLines(st, NAT), NAT, 'national');
  assert.equal(natRes.kind, 'planning_action_lines'); assert.equal(natRes.level, 'entity'); assert.equal(natRes.cutoff, TODAY); assert.equal(natRes.yearEnd, '2026-12-31');
  assert.deepEqual(natRes.classes.map((c) => c.key), PLAN_CLASSES);
  assert.ok(natRes.totals.byClass.B.count > 0 && natRes.totals.byClass.D.count > 0, 'the compact world has actionable and aged balances');
  assert.ok(natRes.lines.length > 20);
});
ok('the line key is unique (entity · source · class) and ids are stable between two calls; the default order is stable and ranks are 1…N', () => {
  const ids = natRes.lines.map((l) => l.id); assert.equal(new Set(ids).size, ids.length);
  const again = actionLines(st, NAT); assert.deepEqual(again.lines.map((l) => [l.id, l.rank]), natRes.lines.map((l) => [l.id, l.rank]));
  assert.deepEqual(natRes.lines.map((l) => l.rank), natRes.lines.map((_, k) => k + 1));
  const c0 = natRes.lines[0].rankInputs.cellActionable; assert.ok(natRes.lines.every((l) => l.rankInputs.cellActionable <= c0 + 0.5), 'the largest actionable cell first');
});
ok('every line carries the full field set: remaining, due by year-end, oldest days overdue, evidence counts, action key + text, no recovery estimate', () => {
  for (const l of natRes.lines) {
    for (const k of ['count', 'remaining', 'dueByYearEnd', 'oldestDaysOverdue']) assert.equal(typeof l[k], 'number', k);
    assert.ok(l.dueByYearEnd <= l.remaining + 0.5);
    for (const k of ['enforcementLinked', 'objected', 'objectionRecorded', 'unresolvedLinkage', 'ineligibleReferral', 'aged180', 'partial', 'dueUnavailable']) assert.equal(typeof l.evidence[k].count, 'number', k);
    assert.ok(l.recommendedAction.key in ACTIONS);
    if (l.class === 'B') assert.ok(l.oldestDaysOverdue >= 1 && l.oldestDaysOverdue <= PLAN_AGED_DAYS && l.evidence.aged180.count === 0);
    if (l.class === 'D') { assert.ok(l.oldestDaysOverdue > PLAN_AGED_DAYS && l.evidence.aged180.count === l.count); assert.equal(l.recommendedAction.key, 'escalate_for_decision'); assert.equal(l.recommendedAction.ar, 'رفع للقرار'); }
    if (l.class === 'C') { assert.equal(l.oldestDaysOverdue, 0); assert.equal(l.recommendedAction.ar, 'تذكير قبل الاستحقاق'); near(l.dueByYearEnd, l.remaining, 'C is due by year-end'); }
    if (l.class === 'B') assert.equal(l.recommendedAction.ar, 'متابعة تحصيل الفواتير المتأخرة (يوجد مدين وأمر يمكن البدء به)');
    if (l.class === 'A') { assert.ok(l.recommendedAction.ar.includes('لا إحالة جديدة')); assert.equal(l.actionable, false); }
    assert.equal(l.actionable, l.class === 'B' || l.class === 'C');
  }
  assert.equal(natRes.expectedImpact.available, false); assert.equal(natRes.expectedImpact.reason.ar, 'غير متاح');
});
ok('the aged part (class D) and the blocked part (class A) are kept apart from the actionable part; the data-linkage blockers of the world are named with their reason', () => {
  const t = natRes.totals; near(t.needsDecision.remaining, t.byClass.D.remaining, 'D'); near(t.blocked.remaining, t.byClass.A.remaining, 'A');
  const stock = stockOf(NAT); const aged = stock.aging[4].amount; assert.ok(t.byClass.D.remaining <= aged + 0.5, 'class D is part of the > 180-day stock (the rest of it is blocked)');
  assert.ok(natRes.lines.filter((l) => l.class === 'A').every((l) => l.blockers.every((b) => ['enforcement', 'objection', 'linkage_unresolved', 'ineligible_referral'].includes(b.key))));
});

/* ================================================================== 2. Jeddah, a municipality scope, an organisation, a restricted geographic access */
ok('Jeddah: only Jeddah lines; Σ = the Jeddah stock; drills carry the Amanah and reproduce each line', () => {
  const r = req({ amanah: JED }); const res = verify(actionLines(st, r), r, 'Jeddah');
  assert.ok(res.lines.length > 3 && res.lines.every((l) => l.entity.key === JED && l.drill.scope.amanah === JED));
});
ok('a source filter narrows the same way (drill carries the source): Jeddah fines', () => {
  const r = req({ amanah: JED, source: 'fines' }); const res = verify(actionLines(st, r), r, 'Jeddah fines');
  assert.ok(res.lines.every((l) => l.source.key === 'fines' && l.drill.scope.source === 'fines'));
});
ok('municipality level: each Amanah splits into reference municipalities + the explicit direct / not-specified / needs-review groups; Σ = the Amanah stock; drills carry the municipality key', () => {
  const r = req({ amanah: JED }, { groupBy: 'municipality' }); const res = verify(actionLines(st, r), r, 'Jeddah municipalities');
  assert.equal(res.level, 'municipality'); assert.ok(res.lines.every((l) => l.municipality && l.municipality.key && l.municipality.ar && l.municipality.en && ['mapped', 'direct_amanah', 'not_specified', 'needs_review'].includes(l.municipality.status)));
  assert.ok(res.lines.every((l) => { const p = parseMuniKey(l.drill.scope.muni); return p && !p.invalid; }), 'every drill municipality key is a valid filter key');
  const keys = new Set(res.lines.map((l) => l.municipality.key)); assert.ok(keys.size >= 2, 'the Amanah has more than one municipality group');
  const national = actionLines(st, req({}, { groupBy: 'municipality' })); const kinds = new Set(national.lines.map((l) => l.municipality.status)); assert.ok(kinds.has('mapped'));
  near(national.totals.remaining, natRes.totals.remaining, 'national by municipality = national by entity'); noNaN(national, 'national municipalities');
});
ok('a municipality scope (scope.muni) = that group only: Σ = the municipality stock for a mapped municipality AND for each explicit group', () => {
  const all = actionLines(st, req({ amanah: JED }, { groupBy: 'municipality' })); const keys = [...new Set(all.lines.map((l) => l.municipality.key))];
  for (const key of keys.slice(0, 6)) { const r = req({ amanah: JED, muni: key }); const res = verify(actionLines(st, r), r, `muni ${key}`); assert.equal(res.level, 'municipality'); assert.ok(res.lines.every((l) => l.municipality.key === key && l.drill.scope.muni === key)); }
  const exp = (suffix) => keys.find((k) => k.endsWith(`|${suffix}`)); const explicit = ['DIRECT', 'NOT_SPECIFIED', 'UNRESOLVED'].map(exp).filter(Boolean);
  for (const key of explicit) { const r = req({ amanah: JED, muni: key }); verify(actionLines(st, r), r, `explicit ${key}`); }
  const pt = (k) => k.slice(k.lastIndexOf('|') + 1);
  assert.ok(keys.some((k) => !['DIRECT', 'NOT_SPECIFIED', 'UNRESOLVED'].includes(pt(k))), 'a mapped municipality exists');
});
ok('organisation narrowing (scope.org.amanahKeys): only those entities; Σ = the same-scope stock; drills reproduce through the org-narrowed list', () => {
  const r = req({ org: { amanahKeys: [RIY, JED] } }); const res = verify(actionLines(st, r), r, 'org');
  assert.deepEqual([...new Set(res.lines.map((l) => l.entity.key))].sort(), [JED, RIY].sort());
});
ok('a restricted GEOGRAPHIC access (municipalities of Jeddah + the direct / not-specified groups): lines and totals are computed over the authorised invoices only', () => {
  const m = actionLines(st, req({ amanah: JED }, { groupBy: 'municipality' })).lines.map((l) => l.municipality).filter((x) => x.status === 'mapped').map((x) => x.key.split('|')[1]);
  const refs = [...new Set(m)].slice(0, 2); assert.ok(refs.length === 2);
  const access = normalizeGeoScope({ all: false, nonMunicipal: false, grants: [{ amanah: JED, municipalities: refs, direct: true, notSpecified: true }] });
  const r = req({}, { access }); const res = verify(actionLines(st, r), r, 'restricted access');
  assert.ok(res.lines.length > 0 && res.lines.every((l) => l.entity.key === JED));
  const full = actionLines(st, req({ amanah: JED })); assert.ok(res.totals.remaining < full.totals.remaining, 'the restricted total is smaller than the whole Amanah');
  const none = normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(RIY)] });
  const rr = req({ amanah: JED }, { access: none }); const empty = actionLines(st, rr); assert.equal(empty.lines.length, 0); assert.equal(empty.totals.remaining, 0);
});

/* ================================================================== 3. class boundaries, missing due date, partial payments, exclusions, blockers (a copy of the store's columns is changed and restored) */
function pickClean(k, filter = () => true) { // uncollected invoices with NO blocker, whatever their due date becomes
  const ctx = makeCtx(st, NAT); const out = []; const ye = yearEndOf(ctx.cfg);
  for (let i = 0; i < st.n && out.length < k; i += 1) {
    if (st.issue[i] > ctx.cutoffN || st.owner[i] !== 0) continue;
    if ((st.flags[i] & (F.LEGACY_CANCELLED | F.MISSING_ID | F.OBJECTION)) || st.src[i] === 0 || st.exec[i] >= 0) continue;
    const D = derive(ctx, i, ctx.cutoffN); if (!(D.outstanding > 0) || D.link) continue; if (!filter(i, D)) continue;
    const c = planClassOf(st, i, D, ye); if (c && c !== 'A' && c !== 'U') out.push(i);
  }
  return out;
}
const idsIn = (res, i) => { // the class lines whose drill opens invoice i
  const hit = [];
  for (const l of res.lines) { const d = drillRows(l.drill, NAT); if (d.rows.some((x) => x.index === i)) hit.push(l.class); }
  return hit;
};
ok('boundaries: exactly 180 days overdue is B, 181 is D, 1 day is B, due today is C, due on 31 Dec is C, due on 1 Jan is E, no due date is U — and each invoice is in exactly one line', () => {
  const ctx = makeCtx(st, NAT); const ye = yearEndOf(ctx.cfg); const cutN = ctx.cutoffN;
  const picks = pickClean(7); assert.equal(picks.length, 7);
  const cases = [[cutN - 180, 'B'], [cutN - 181, 'D'], [cutN - 1, 'B'], [cutN, 'C'], [ye, 'C'], [ye + 1, 'E'], [0, 'U']];
  const saved = picks.map((i) => st.due[i]);
  try {
    picks.forEach((i, k) => { st.due[i] = cases[k][0]; }); bumpEpoch();
    const res = actionLines(st, NAT);
    picks.forEach((i, k) => {
      const D = derive(ctx, i, cutN); assert.equal(planClassOf(st, i, D, ye), cases[k][1], `due ${cases[k][0]}`);
      assert.deepEqual(idsIn(res, i), [cases[k][1]], `invoice ${k} is in exactly one line: ${cases[k][1]}`);
    });
    near(res.totals.remaining, stockOf(NAT).netUncollected, 'boundary scenario: Σ lines = stock');
    assert.ok(res.totals.byClass.E.count >= 1 && res.totals.byClass.U.count >= 1);
    const u = res.lines.find((l) => l.class === 'U'); assert.equal(u.oldestDaysOverdue, 0, 'a missing due date is never overdue'); assert.equal(u.overdue.count, 0); assert.equal(u.dueUnavailable.count, u.count); assert.equal(u.recommendedAction.key, 'complete_due_date'); assert.equal(u.dueByYearEnd, 0);
    const e = res.lines.find((l) => l.class === 'E'); assert.equal(e.dueByYearEnd, 0, 'due after year-end is not collectible within the remaining period'); assert.equal(e.actionable, false);
    verify(res, NAT, 'boundary scenario');
  } finally { picks.forEach((i, k) => { st.due[i] = saved[k]; }); bumpEpoch(); }
  near(actionLines(st, NAT).totals.remaining, natRes.totals.remaining, 'the store is restored');
});
ok('the year-end follows the cut-off year: the same due date is C in one year and E when the cut-off is in the year before', () => {
  assert.equal(yearEndOf({ cutoff: '2026-11-06' }), dayNum('2026-12-31')); assert.equal(yearEndOf({ cutoff: '2026-12-31' }), dayNum('2026-12-31')); assert.equal(yearEndOf({ cutoff: '2027-01-01' }), dayNum('2027-12-31'));
  const i = pickClean(1)[0]; const ctx = makeCtx(st, NAT); const saved = st.due[i];
  try { st.due[i] = dayNum('2027-01-15'); const D = derive(ctx, i, ctx.cutoffN); assert.equal(planClassOf(st, i, D, dayNum('2026-12-31')), 'E'); assert.equal(planClassOf(st, i, D, dayNum('2027-12-31')), 'C'); } finally { st.due[i] = saved; }
});
ok('partial payments: the line holds the REMAINING balance, not the billed amount', () => {
  const ctx = makeCtx(st, NAT); const ye = yearEndOf(ctx.cfg); let found = 0;
  for (let i = 0; i < st.n && found < 3; i += 1) {
    if (st.issue[i] > ctx.cutoffN || st.owner[i] !== 0) continue;
    const D = derive(ctx, i, ctx.cutoffN); if (!(D.received > 0 && D.outstanding > 0) || D.excluded) continue;
    if (!planClassOf(st, i, D, ye)) continue;
    assert.ok(D.outstanding < D.billed && Math.abs(D.outstanding - (D.billed - D.received)) <= 0.5); found += 1;
  }
  assert.ok(found > 0, 'the world has partly paid invoices');
  const pl = natRes.lines.filter((l) => l.partial.count > 0); assert.ok(pl.length > 0);
  for (const l of pl) { const d = drillRows(l.drill, NAT); const partRows = d.rows.filter((x) => x.received > 0); assert.equal(partRows.length, l.partial.count); near(partRows.reduce((t, x) => t + x.outstanding, 0), l.partial.amount, `${l.id} partial remaining`); assert.ok(partRows.every((x) => x.outstanding < x.billed)); }
});
ok('excluded invoices are never in a line (they are apart, uncounted); cancelled likewise', () => {
  const ex = list(st, { scope: NAT.scope, cfg: CFG, filters: { state: 'excluded', allPeriods: true }, page: 0, pageSize: 500, owner: 0 }); assert.ok(ex.total > 0);
  const inLines = new Set(); for (const l of natRes.lines) for (const x of drillRows(l.drill, NAT).rows) inLines.add(x.id);
  for (const row of ex.rows) assert.ok(!inLines.has(row.id), `${row.id} is excluded and must not be in a line`);
  assert.ok(natRes.separate.excluded.count > 0 && natRes.separate.excluded.amount > 0);
  assert.ok(natRes.separate.cancelled.count >= 0 && Number.isFinite(natRes.separate.cancelled.amount));
  // an approved exclusion moves the invoice OUT of the lines and out of the totals
  const ctx = makeCtx(st, NAT); const ye = yearEndOf(ctx.cfg); let moved = 0;
  for (const row of ex.rows) { const i = row.index; const D = derive(ctx, i, ctx.cutoffN); assert.equal(planClassOf(st, i, D, ye), null); moved += 1; }
  assert.ok(moved > 0);
});
ok('blocked invoices (class A): with the enforcement and objection exclusion rules OFF they stay uncollected, sit in an A line WITH their reason, and every drill (line and reason) reproduces them', () => {
  const cfg = { cutoff: TODAY, rules: { 'SND-1': false, 'OBJ-1': false } };
  const ctx0 = makeCtx(st, NAT); const ye = yearEndOf(ctx0.cfg);
  const cand = pickClean(2, (i, D) => D.daysOverdue > 0 && D.daysOverdue <= 180); assert.equal(cand.length, 2);
  // a confirmed link on a clean overdue invoice (review overlay of the request)
  const all = []; for (let p = 0; ; p += 1) { const x = list(st, { scope: NAT.scope, cfg: CFG, filters: { state: 'open', allPeriods: true }, page: p, pageSize: 500, sort: { key: 'id', dir: 'asc' }, owner: 0 }); all.push(...x.rows); if (all.length >= x.total) break; }
  const byIdx = new Map(all.map((x) => [x.index, x.id])); const linkedId = byIdx.get(cand[0]); assert.ok(linkedId);
  // default configuration: the confirmed link EXCLUDES the invoice (rule SND-1) — it leaves the lines and the totals
  const on = req({}, { links: { [linkedId]: 'confirmed' } }); const resOn = actionLines(st, on);
  near(resOn.totals.remaining, stockOf(on).netUncollected, 'SND-1 on: Σ = stock'); assert.ok(resOn.totals.remaining < natRes.totals.remaining, 'the linked invoice left the lines');
  assert.ok(resOn.separate.excluded.amount > natRes.separate.excluded.amount, 'and is counted apart as excluded');
  // rule OFF: it stays uncollected and is BLOCKED (enforcement), with the reason on its line
  const off = { scope: NAT.scope, cfg, owner: 0, links: { [linkedId]: 'confirmed' } }; const resOff = verify(actionLines(st, off), off, 'SND-1 off');
  const aLines = resOff.lines.filter((l) => l.class === 'A'); const enf = aLines.flatMap((l) => l.blockers).filter((b) => b.key === 'enforcement'); assert.ok(enf.length >= 1, 'the confirmed link is an enforcement blocker');
  assert.ok(aLines.some((l) => l.evidence.enforcementLinked.count >= 1 && l.recommendedAction.key === 'follow_existing_action'));
  const D = derive(makeCtx(st, off), cand[0], makeCtx(st, off).cutoffN); assert.equal(blockerOf(st, cand[0], D), 'enforcement'); assert.equal(planClassOf(st, cand[0], D, ye), 'A');
  // the same invoice is in no time-class line any more
  const cls = []; for (const l of resOff.lines) if (drillRows(l.drill, off).rows.some((x) => x.index === cand[0])) cls.push(l.class); assert.deepEqual(cls, ['A']);
  // the whole world with the objection rule off: objections are blocked too and everything still reconciles
  const wide = { scope: NAT.scope, cfg, owner: 0 }; const resWide = verify(actionLines(st, wide), wide, 'rules off');
  assert.ok(resWide.totals.blocked.remaining >= natRes.totals.blocked.remaining);
});

/* ================================================================== 4. the gap contribution (supplied by the page) */
ok('contributionToGap: entity level, from req.entityGaps; shares add up to 1 over the entities; absent / invalid values give null — never a guess', () => {
  const gaps = { [RIY]: 3.0e9, [JED]: 1.0e9, 'Eastern Province Amanah': 1.0e9, 'Housing Sector': -0.5e9 }; // an entity ahead of plan carries a negative gap
  const res = actionLines(st, req({}, { entityGaps: gaps })); noNaN(res, 'gaps'); assert.equal(res.gaps.supplied, true); near(res.gaps.total, 4.5e9, 'Σ supplied');
  for (const l of res.lines) {
    const g = gaps[l.entity.key]; if (g === undefined) { assert.equal(l.contributionToGap.entityGap, null); assert.equal(l.contributionToGap.share, null); continue; }
    assert.equal(l.contributionToGap.level, 'entity'); assert.equal(l.contributionToGap.entityGap, g); near(l.contributionToGap.share * res.gaps.total, g, 'share'); assert.equal(l.rankInputs.entityGap, g);
  }
  const sh = res.entities.filter((e) => e.contributionToGap.share !== null).reduce((t, e) => t + e.contributionToGap.share, 0); assert.ok(Math.abs(sh - 1) < 1e-9, `shares sum to 1 (${sh})`);
  const none = actionLines(st, req({}, {})); assert.equal(none.gaps.supplied, false); assert.ok(none.lines.every((l) => l.contributionToGap.entityGap === null && l.contributionToGap.share === null));
  const bad = actionLines(st, req({}, { entityGaps: { [RIY]: 'x', [JED]: null, 'Housing Sector': NaN } })); noNaN(bad, 'bad gaps'); assert.ok(bad.lines.every((l) => l.contributionToGap.entityGap === null && l.contributionToGap.share === null));
  // a gap map never changes any amount
  near(res.totals.remaining, natRes.totals.remaining, 'gap map does not change amounts');
});

/* ================================================================== 5. HTTP: the planning module only, masking, caching */
let seq = 0; const stamp = new Date().toISOString();
function mkUser(modules, scope = ALL_SCOPE) {
  const db = getDb(); seq += 1;
  const role = { id: `role-pa${seq}`, nameAr: `دور ${seq}`, nameEn: `Test role ${seq}`, descriptionAr: '', descriptionEn: '', modules: [...modules], readOnly: false, starter: false, protected: false, createdAt: stamp, updatedAt: stamp };
  db.roles.push(role);
  const user = { id: `usr-pa${seq}`, username: `pa${seq}`, email: null, nameAr: `مستخدم ${seq}`, nameEn: `User ${seq}`, avatar: 'T', status: 'active', roleId: role.id, scope, tokenVersion: 1, createdAt: stamp, createdBy: 'test', updatedAt: stamp, lastLoginAt: null, credential: hashPassword('Test-pass-1234') };
  db.users.push(user); commit();
  return { user, role, token: issueToken(user) };
}
function call(token, method, path, body) {
  return new Promise((resolve) => {
    const res = { chunks: [], writeHead(c, h) { this.code = c; this.headers = h || {}; }, write(c) { this.chunks.push(String(c)); return true; }, once() {}, end(b) { const t = b !== undefined ? b : this.chunks.join(''); let j = null; try { j = JSON.parse(t); } catch { /* not json */ } resolve({ code: this.code, text: t, body: j }); } };
    handleApi({ method, url: `/api${path}?today=${TODAY}`, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: method === 'GET' ? undefined : JSON.parse(JSON.stringify(body || {})) }, res);
  });
}
const post = (u, path, body) => call(u.token, 'POST', path, body);
const BODY = (scope = {}, extra = {}) => ({ scope: { ...BASE, ...scope }, cfg: CFG, ...extra });
const ALL_MODULES = ['dashboard', 'invoices_collected', 'invoices_uncollected', 'exclusions', 'contracts', 'enforcement', 'planning', 'decisions', 'smart_reports', 'data_sources'];

ok('the endpoint is mapped to the planning module ONLY (no other data module may read it) and listed in the endpoint map', () => {
  const e = ENDPOINTS.find(([m, p]) => m === 'POST' && p === '/plan-actions'); assert.ok(e, 'listed');
  const need = requiredPermissionFor('POST', '/plan-actions', {}); assert.equal(need.kind, 'permission'); assert.deepEqual(need.anyOf, ['planning']);
  assert.equal(requiredPermissionFor('GET', '/plan-actions', {}).kind, 'unknown');
});
ok('HTTP 401 without a token; 403 {error:"forbidden", permission:"planning"} with NO data for a user without the planning module (even holding every other data module)', async () => {
  assert.equal((await call(null, 'POST', '/plan-actions', BODY())).code, 401);
  const noPlan = mkUser(ALL_MODULES.filter((m) => m !== 'planning')); const r = await post(noPlan, '/plan-actions', BODY());
  assert.equal(r.code, 403); assert.equal(r.body.error, 'forbidden'); assert.equal(r.body.permission, 'planning'); assert.equal(r.body.module, 'planning'); assert.deepEqual(Object.keys(r.body).sort(), ['error', 'module', 'permission']);
  const dash = mkUser(['dashboard', 'invoices_uncollected']); assert.equal((await post(dash, '/plan-actions', BODY())).code, 403);
  const adm = mkUser(['users', 'roles']); assert.equal((await post(adm, '/plan-actions', BODY())).code, 403);
});
ok('HTTP 200 for the planning module: the response equals the engine (national) and a planning user can still use the other planning reads', async () => {
  const u = mkUser(['planning']); const r = await post(u, '/plan-actions', BODY()); assert.equal(r.code, 200);
  noNaN(r.body, 'http national'); near(r.body.totals.remaining, natRes.totals.remaining, 'http = engine'); assert.equal(r.body.lines.length, natRes.lines.length);
  assert.deepEqual(r.body.lines.map((l) => l.id), natRes.lines.map((l) => l.id));
  assert.equal((await post(u, '/snapshot', BODY())).code, 200);
});
ok('HTTP masking: a restricted planning user gets lines and totals over the authorised invoices only (equal to an independent recount); a different scope never receives another user\'s cached answer', async () => {
  const jed = normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(JED)] });
  const riy = normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(RIY)] });
  const uj = mkUser(['planning'], jed); const ur = mkUser(['planning'], riy); const ua = mkUser(['planning'], ALL_SCOPE);
  const a = await post(uj, '/plan-actions', BODY()); const b = await post(ur, '/plan-actions', BODY()); const c = await post(ua, '/plan-actions', BODY());
  assert.equal(a.code, 200); assert.ok(a.body.lines.length > 0 && a.body.lines.every((l) => l.entity.key === JED)); assert.ok(b.body.lines.length > 0 && b.body.lines.every((l) => l.entity.key === RIY));
  // independent recount: the unrestricted list rows of the Amanah (state open) summed
  const recount = (am) => { let t = 0; for (let p = 0; ; p += 1) { const x = list(st, { scope: { ...BASE, amanah: am }, cfg: CFG, filters: { state: 'open', allPeriods: true }, page: p, pageSize: 500, sort: { key: 'id', dir: 'asc' }, owner: 0 }); t += x.rows.reduce((s, r) => s + r.outstanding, 0); if ((p + 1) * 500 >= x.total) return t; } };
  near(a.body.totals.remaining, recount(JED), 'Jeddah user total'); near(b.body.totals.remaining, recount(RIY), 'Riyadh user total'); near(c.body.totals.remaining, natRes.totals.remaining, 'unrestricted user total');
  assert.ok(a.body.totals.remaining !== b.body.totals.remaining && a.body.totals.remaining < c.body.totals.remaining);
  // a client request for another Amanah can only narrow: the Jeddah user asking for Riyadh gets nothing
  const x = await post(uj, '/plan-actions', BODY({ amanah: RIY })); assert.equal(x.code, 200); assert.equal(x.body.lines.length, 0); assert.equal(x.body.totals.remaining, 0);
  // the answer is repeatable (cached per access scope) and never leaks across users
  const a2 = await post(uj, '/plan-actions', BODY()); assert.deepEqual(a2.body.totals, a.body.totals);
  // the drill of a restricted user's line opens only authorised invoices, and equals the line (the list applies the same mask)
  const ar = { scope: { ...BASE }, cfg: CFG, access: jed, owner: 0 }; const direct = actionLines(st, ar); assert.deepEqual(direct.lines.map((l) => l.id), a.body.lines.map((l) => l.id));
  for (const l of direct.lines.slice(0, 12)) { const d = drillRows(l.drill, ar); assert.equal(d.total, l.count); near(d.sums.outstanding, l.remaining, l.id); assert.ok(d.rows.every((row) => row.entityKey === JED)); }
  verify(direct, ar, 'restricted Jeddah');
});
ok('HTTP: a municipality-level request answers over HTTP and equals the engine', async () => {
  const u = mkUser(['planning']); const r = await post(u, '/plan-actions', BODY({ amanah: JED }, { groupBy: 'municipality' })); assert.equal(r.code, 200); assert.equal(r.body.level, 'municipality');
  near(r.body.totals.remaining, actionLines(st, req({ amanah: JED }, { groupBy: 'municipality' })).totals.remaining, 'http muni = engine');
});

for (const run of pending) await run();
console.log(`planning-actions tests: ${n} passed`);
