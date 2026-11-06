// Tests of the redesigned Decision Room data layer (docs/decision-room-redesign.md): the items (six categories, contract shape, priority thresholds, overlap and additivity,
// no forbidden wording), the page-level charts and the item trend. The follow-up store and its migration are tested in tests/decision-followup.test.mjs.
// Run with `npm run test:decisions`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStore as loadData } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { previousScope, compareSnapshots } from '../src/data/revenueMetrics.js';
import { buildDecisionItems, planSectionOf, planUnavailable, withState, summaryOf, filterItems, priorityOf, trendSeries, CATEGORIES, KINDS, THRESHOLDS, PRIORITY_RULE } from '../src/data/decisionRoom.js';
import * as DR from '../src/data/decisionRoom.js';
import { buildDecisionCharts, itemTrend } from '../src/data/decisionCharts.js';
import * as ds from '../src/data/decisionStore.js';
import { setPlansForTest, referenceViewFor } from '../src/data/plans/planStore.js';
import { customPlanRecord, referenceEntry } from '../src/data/plans/planFixtures.js';
import { planningBasisFromPlan } from '../src/data/plans/planBasis.js';
import { forecastPlan } from '../src/data/planForecast.js';
import { planSourceOf, referenceTargets } from '../src/data/referenceTarget.js';
import { PROPOSED_RULE, UNLINKED_RULE } from '../src/data/contractRules.js';

let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
process.env.DEMO_SIZE = 'compact';
const TODAY = '2026-10-20'; const data = loadData(TODAY); const cfg = { cutoff: TODAY };
const FULL = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
const snapOf = (over = {}) => snapshot(data, { scope: { ...FULL, ...over }, cfg });
const prevOf = (over = {}) => { const sc = { ...FULL, ...over }; const pv = previousScope({ from: sc.from, to: sc.to }); const p = snapshot(data, { scope: { ...sc, from: pv.from, to: pv.to, basis: pv.basis }, cfg }); return { snapshot: p, comparable: compareSnapshots(snapshot(data, { scope: sc, cfg }), p).comparable }; };
const labels = { amanah: (k) => ({ ar: `أمانة ${k}`, en: k }), source: (k) => ({ ar: `مصدر ${k}`, en: k }) };
const snap = snapOf();
const CONTRACTS = { count: 7, arrears: 1.5e9, overdueInstallments: 5, unlinkedInstallments: 4, unlinkedAmount: 9e5 };
const ORDERS = { suspendedCount: 10, suspendedAmount: 4e8, suspendedNums: ['EN-1', 'EN-2'], proposedLinks: 3, proposedLinkOrders: 2, unresolvedRefs: 2, unresolvedRefOrders: 1, linkNums: ['EN-3'] };
const matchingOf = (s) => ({ amountConflicts: s.quality.amountConflictCount, conflictAmount: s.quality.conflictAmountAtStake, conflictIds: s.quality.amountConflicts, missingFields: s.quality.missingFieldCount, missingIds: s.quality.missingFieldRecords });
const baseOf = (s, over = {}) => ({ today: TODAY, snapshot: s, labels, previous: null, plan: null, contracts: CONTRACTS, noContractCount: 14, orders: ORDERS, matching: matchingOf(s), ...over });
const base = baseOf(snap, { previous: prevOf() });
const R = buildDecisionItems(base);

// strings of an object, depth-first (every bilingual text, label and link)
const strings = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (Array.isArray(o)) o.forEach((x) => strings(x, out)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => strings(x, out)); return out; };
const numbers = (o, out = []) => { if (typeof o === 'number') out.push(o); else if (Array.isArray(o)) o.forEach((x) => numbers(x, out)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => numbers(x, out)); return out; };
const clean = (items, what) => { for (const s of strings(items)) assert.ok(!/NaN|undefined|Infinity|\[object|null%/.test(s), `${what}: bad text «${s.slice(0, 80)}»`); for (const x of numbers(items)) assert.ok(Number.isFinite(x), `${what}: non-finite number`); };

/* the plan section is built from the CONFIGURED REFERENCE PLAN (a plan record injected into the plan store, as the data service would hold it): Jeddah 6bn + Asir 4bn, equal monthly profile */
const PLAN_REC = customPlanRecord({ id: 'plan-d0000001', name: 'خطة اختبار الدار', allocations: { 'Jeddah Amanah': 6e9, 'Asir Amanah': 4e9 } });
setPlansForTest({ plans: [PLAN_REC], references: { 2026: referenceEntry(PLAN_REC.id) } });
const refView = referenceViewFor(2026); const SRC = planSourceOf(referenceTargets(null, { year: 2026 }).reference);
const months = (v) => Array.from({ length: 10 }, () => v);
const sectionFor = (byEntity, total) => {
  const b0 = planningBasisFromPlan({ view: refView, today: TODAY, latestDataDate: TODAY });
  const meta = { planId: refView.planId, versionId: refView.versionId, scopeKey: b0.scopeKey, period: { start: refView.period.start, end: refView.period.end }, cutoff: TODAY };
  const basis = planningBasisFromPlan({ view: refView, today: TODAY, latestDataDate: TODAY, actual: { monthly: months(total / 10), byEntity, meta } });
  const forecast = forecastPlan(basis, { history: { ...meta, months: ['2026-07', '2026-08', '2026-09'].map((ym) => ({ ym, value: total / 10 })) }, now: '2026-10-20T00:00:00.000Z' });
  return planSectionOf({ basis, forecast, source: SRC });
};
const PLAN = sectionFor({ 'Jeddah Amanah': 2e9, 'Asir Amanah': 3e9 }, 5e9);
const RICH = buildDecisionItems({ ...base, plan: PLAN });

ok('the overdue and not-yet-due parts of the cells add up to «غير المحصّل» of the dashboard (a partition); aged by Amanah adds up to the 180+ bucket', () => {
  const cells = snap.matrix.amanahSource; const od = cells.reduce((t, c) => t + c.overdue, 0); const nd = cells.reduce((t, c) => t + c.notDue, 0);
  assert.ok(Math.abs(od + nd - snap.totals.outstanding) < 1); assert.ok(nd > 0 && od > 0);
  const aged = snap.stock.aged180ByAmanah.reduce((t, a) => t + a.amount, 0); assert.ok(Math.abs(aged - snap.stock.aging[4].amount) < 1);
  assert.equal(R.context.totalOverdue + R.context.totalNotDue, snap.totals.outstanding);
});

ok('categories: exactly the six; consolidation — no per-cell overdue items, no separate aged/target/not-due/arrears/future items; keys are unique and stable across rebuilds', () => {
  assert.deepEqual(Object.keys(CATEGORIES), ['plan_deviation', 'overdue_aging', 'source_deterioration', 'installments_unlinked', 'enforcement_links', 'data_conflicts']);
  for (const x of [R, RICH]) {
    const keys = x.items.map((i) => i.key); assert.equal(new Set(keys).size, keys.length, 'unique keys');
    for (const i of x.items) assert.ok(Object.keys(CATEGORIES).includes(i.category), i.key);
    assert.ok(!keys.some((k) => /^(aged:|upcoming:|target:|overdue:[^:]+\|)/.test(k) || k === 'contracts:arrears' || k === 'contracts:future' || k === 'data:' + 'missing'), 'old duplicate families are gone');
    const sig = x.items.map((i) => `${i.category}|${i.affected.amanah || ''}|${i.affected.source || ''}|${i.measure.label.en}`); assert.equal(new Set(sig).size, sig.length, 'no two items say the same thing about the same entity');
    const titles = x.items.map((i) => i.title.en); assert.equal(new Set(titles).size, titles.length);
  }
  assert.deepEqual(buildDecisionItems(base).items.map((i) => i.key), R.items.map((i) => i.key));
  const cats = new Set(RICH.items.map((i) => i.category)); for (const c of Object.keys(CATEGORIES)) assert.ok(cats.has(c), `category ${c} has data in the full input`);
});

ok('every item follows the contract: kind, question, what, affected, period, measure (labelled), comparison basis, facts / calculated / unknown / proposed, evidence links with a status, priority with factors, verification, overlap, additive, condition', () => {
  const STATUS = ['source_record', 'calculated', 'unverified', 'missing'];
  for (const i of RICH.items) {
    assert.ok(['decision', 'review', 'clarification'].includes(i.kind), i.key); assert.ok(KINDS[i.kind]);
    for (const f of ['title', 'question', 'what']) assert.ok(i[f]?.ar && i[f]?.en, `${i.key}.${f}`);
    assert.ok(i.affected.label.ar && i.affected.label.en, i.key); assert.ok(i.period && 'from' in i.period && i.period.to && i.cutoff);
    assert.ok(['exposure', 'gap', 'overdue', 'amount', 'count'].includes(i.measure.kind)); assert.ok(i.measure.label.en && i.measure.basis.ar);
    assert.ok(i.measure.kind === 'count' ? Number.isFinite(i.measure.count) : Number.isFinite(i.measure.amount), `${i.key} has the labelled number`);
    assert.ok(i.comparison.basis.en && Array.isArray(i.comparison.values));
    assert.ok(i.facts.length > 0 && i.unknown.length > 0 && i.proposed.length > 0 && Array.isArray(i.calculated) && Array.isArray(i.options) && Array.isArray(i.missing), i.key);
    assert.ok(i.evidence.length > 0, `evidence for ${i.key}`);
    for (const e of i.evidence) { assert.ok(e.to.startsWith('/') && e.label.ar && e.label.en && STATUS.includes(e.status), `${i.key}: ${e.to}`); }
    assert.ok(['high', 'medium', 'low'].includes(i.priority.level) && i.priority.why.ar && i.priority.why.en && i.priority.factors.length >= 1);
    for (const f of i.priority.factors) assert.ok(['high', 'medium', 'low'].includes(f.grade) && f.threshold.en && f.label.ar, i.key);
    assert.ok(['verified', 'needs_verification'].includes(i.verification)); assert.equal(typeof i.additive, 'boolean'); assert.equal(i.condition.open, true);
    for (const o of i.overlap) assert.ok(RICH.items.some((x) => x.key === o.with) && o.note.ar && o.note.en);
    for (const c of i.calculated) assert.ok(c.label.en && ['SAR', 'pct', 'pp', 'count', 'days'].includes(c.unit) && c.formula?.en, `${i.key} calculated «${c.label.en}» carries its formula`);
    for (const o of i.options) assert.ok(o.title.en && o.implication.en);
    for (const v of i.comparison.values) assert.ok(['SAR', 'pct', 'count'].includes(v.unit), i.key);
  }
  clean(RICH.items, 'rich items'); assert.ok(PRIORITY_RULE.en.includes('Medium'));
});

ok('the old workflow model is gone: no score, owner / role, due days, lane or recommendation-and-decision fields on items; the module exports no assignment API', () => {
  for (const i of RICH.items) for (const f of ['score', 'why', 'owner', 'role', 'dueDays', 'lane', 'recommendation', 'decisionNeeded', 'cause', 'overdueAction', 'status', 'assignee']) assert.ok(!(f in i), `${i.key} still has «${f}»`);
  for (const e of ['ROLES', 'STATUSES', 'BASES', 'W', 'REASON_REQUIRED', 'assign', 'transition', 'dueDateOf']) assert.ok(!(e in DR) && !(e in ds), `${e} must not be exported`);
});

ok('kinds: plan deviation = management decision; data conflicts and missing contract = clarification; enforcement, installments and source deterioration = operational review; an Amanah with a material aged balance = decision, otherwise review', () => {
  const by = (c) => RICH.items.filter((i) => i.category === c);
  for (const i of by('plan_deviation')) assert.equal(i.kind, 'decision');
  for (const i of by('data_conflicts')) assert.equal(i.kind, 'clarification');
  for (const i of by('enforcement_links')) assert.equal(i.kind, 'review');
  assert.equal(RICH.items.find((i) => i.key === 'contracts:no_contract').kind, 'clarification'); assert.equal(RICH.items.find((i) => i.key === 'contracts:unlinked').kind, 'review');
  for (const i of by('source_deterioration')) assert.equal(i.kind, 'review');
  const totalAged = snap.stock.aged180ByAmanah.reduce((t, a) => t + a.amount, 0);
  for (const i of by('overdue_aging').filter((x) => x.key.startsWith('overdue:amanah:'))) {
    const a = snap.stock.aged180ByAmanah.find((g) => g.key === i.affected.amanah); const material = !!a && a.amount / totalAged >= THRESHOLDS.agedDecision;
    assert.equal(i.kind, material ? 'decision' : 'review', i.key); assert.equal(i.options.length > 0, material, 'options only where a route choice exists'); if (material) for (const o of i.options) assert.ok(o.implication.en.length > 10);
  }
  assert.ok(by('overdue_aging').some((i) => i.kind === 'decision') && by('overdue_aging').some((i) => i.kind === 'review'));
});

ok('overdue items: the amount is the OVERDUE part only (cells of the Amanah); the not-yet-due amount is stated beside it and never counted; the aged balance is a separate, labelled standing basis', () => {
  const cell = (a) => snap.matrix.amanahSource.filter((c) => c.amanah === a).reduce((t, c) => t + c.overdue, 0);
  const am = R.items.filter((i) => i.key.startsWith('overdue:amanah:')); assert.ok(am.length >= 2 && am.length <= THRESHOLDS.maxAmanah);
  for (const i of am) {
    const a = i.affected.amanah; if (i.measure.basis.en.startsWith('Invoices of the selected period')) assert.equal(i.measure.amount, cell(a), `${a}: the period overdue`);
    else assert.equal(i.measure.amount, snap.stock.aged180ByAmanah.find((g) => g.key === a).amount, `${a}: the aged balance`);
    assert.ok(i.measure.basis.en.length > 20);
  }
  const shown = am.filter((i) => i.additive).reduce((t, i) => t + i.measure.amount, 0); assert.ok(shown <= R.context.totalOverdue + 1);
  const src = R.items.filter((i) => i.key.startsWith('overdue:source:')); for (const i of src) assert.equal(i.measure.amount, snap.matrix.amanahSource.filter((c) => c.source === i.affected.source).reduce((t, c) => t + c.overdue, 0));
  assert.ok(src.length > 0 && src.every((i) => i.affected.source && !i.affected.amanah));
  const top = am[0]; assert.ok(top.facts.some((f) => /not yet due/i.test(f.en)) || top.facts.length > 0);
});

ok('scopes: all · one Amanah · one source · an Amanah with no data · an empty period — items only where the data supports them, no NaN, no text errors', () => {
  const none = (s, extra = {}) => buildDecisionItems({ today: TODAY, snapshot: s, labels, ...extra });
  const jed = snapOf({ amanah: 'Jeddah Amanah' }); const rj = buildDecisionItems(baseOf(jed, { previous: prevOf({ amanah: 'Jeddah Amanah' }), plan: PLAN }));
  assert.ok(rj.items.length > 0); clean(rj.items, 'jeddah');
  for (const i of rj.items.filter((x) => x.affected.amanah)) assert.equal(i.affected.amanah, 'Jeddah Amanah', `${i.key} stays inside the Amanah scope`);
  assert.ok(!rj.items.some((i) => i.key === 'plan:ministry'), 'the Ministry-level plan item describes all entities, not one Amanah'); assert.ok(!rj.items.some((i) => i.key === 'plan:Asir Amanah'));
  assert.ok(rj.items.some((i) => i.key === 'plan:Jeddah Amanah'), 'its own plan gap');
  const fin = snapOf({ source: 'fines' }); const rf = buildDecisionItems(baseOf(fin, { previous: prevOf({ source: 'fines' }), plan: PLAN })); clean(rf.items, 'fines');
  assert.ok(!rf.items.some((i) => i.key.startsWith('overdue:source:')), 'one source: a by-source item would only repeat the Amanah items'); assert.ok(!rf.items.some((i) => i.category === 'plan_deviation'), 'the plan is per entity, not per source');
  const hafr = snapOf({ amanah: 'Hafr Al-Batin Amanah' }); const rh = none(hafr); assert.deepEqual(rh.items, [], 'an Amanah with nothing to follow: no items'); assert.equal(summaryOf(withState(rh.items, ds.emptyStore())).openFinancialIssues, 0);
  const empty = snapOf({ from: '2026-10-19', to: '2026-10-19', amanah: 'Hafr Al-Batin Amanah' }); assert.deepEqual(none(empty).items, []); clean(none(empty).context, 'empty context');
  assert.equal(summaryOf([]).financialTotal, null); assert.ok(summaryOf([]).financialTotalReason.en);
});

ok('categories without data produce no items (contracts / orders / matching / plan / previous period all absent → only the invoice-based overdue items)', () => {
  const only = buildDecisionItems({ today: TODAY, snapshot: snap, labels, contracts: null, noContractCount: 0, orders: null, matching: null, plan: null, previous: null });
  assert.ok(only.items.length > 0 && only.items.every((i) => i.category === 'overdue_aging'));
  assert.ok(!buildDecisionItems(baseOf(snap, { contracts: { ...CONTRACTS, unlinkedInstallments: 0 }, noContractCount: 0, orders: { suspendedCount: 0, suspendedAmount: 0, proposedLinks: 0, unresolvedRefs: 0 }, matching: { amountConflicts: 0, missingFields: 0 } })).items.some((i) => ['installments_unlinked', 'enforcement_links', 'data_conflicts'].includes(i.category)));
});

ok('priority = High / Medium / Low from visible factors and thresholds — never a score; the rule is documented; items needing verification are held at Medium', () => {
  const f = (grade) => ({ key: 'k', label: { ar: 'ع', en: 'F' }, value: 1, unit: 'pct', text: { ar: 'ع', en: 't' }, grade, threshold: { ar: 'ع', en: 'th' } });
  assert.equal(priorityOf([f('high'), f('high')]).level, 'high'); assert.equal(priorityOf([f('high'), f('medium')]).level, 'medium'); assert.equal(priorityOf([f('medium'), f('medium')]).level, 'medium');
  assert.equal(priorityOf([f('medium'), f('low')]).level, 'low'); assert.equal(priorityOf([f('low'), f('low')]).level, 'low'); assert.equal(priorityOf([f('high')]).level, 'high', 'a single-factor item is High when that factor is High');
  const capped = priorityOf([f('high'), f('high')], { needsVerification: true }); assert.equal(capped.level, 'medium'); assert.ok(capped.capped && /verification/.test(capped.why.en) && /تحقق/.test(capped.why.ar));
  // the real items: each factor's grade follows the stated thresholds; the level follows the stated rule; there is no numeric score anywhere
  const G = THRESHOLDS.graded;
  for (const i of RICH.items) {
    const grades = i.priority.factors.map((x) => x.grade); const H = grades.filter((g) => g === 'high').length; const M = grades.filter((g) => g === 'medium').length;
    let level = H > 0 && H >= Math.min(2, grades.length) ? 'high' : H >= 1 || M >= 2 ? 'medium' : 'low'; if (i.verification === 'needs_verification' && level === 'high') level = 'medium';
    assert.equal(i.priority.level, level, `${i.key}: level follows the rule`); assert.ok(!('score' in i.priority) && !numbers(i.priority.why).length);
    for (const x of i.priority.factors) {
      if (x.key === 'overdue_share') assert.equal(x.grade, x.value >= G.overdueShare.high ? 'high' : x.value >= G.overdueShare.medium ? 'medium' : 'low');
      if (x.key === 'age') assert.equal(x.grade, x.value > G.ageDays.high ? 'high' : x.value > G.ageDays.medium ? 'medium' : 'low');
      if (x.key === 'rate_drop') assert.equal(x.grade, x.value >= G.ratePp.high ? 'high' : x.value >= G.ratePp.medium ? 'medium' : 'low');
      if (x.key === 'shortfall') assert.equal(x.grade, x.value >= G.planShortfall.high ? 'high' : x.value >= G.planShortfall.medium ? 'medium' : 'low');
    }
    assert.ok(i.priority.why.en.startsWith({ high: 'High', medium: 'Medium', low: 'Low' }[i.priority.level]));
  }
  const big = buildDecisionItems(baseOf(snap, { matching: { amountConflicts: 100, conflictAmount: 0.5 * snap.totals.net, conflictIds: [], missingFields: 100, missingIds: [] } })).items.filter((i) => i.category === 'data_conflicts');
  assert.ok(big.length === 2 && big.every((i) => i.verification === 'needs_verification' && i.priority.level !== 'high'), 'big conflicts still need verification: held at Medium'); assert.ok(big.find((i) => i.key === 'data:amount_conflicts').priority.capped);
  const lv = RICH.items.map((i) => ({ high: 0, medium: 1, low: 2 }[i.priority.level])); assert.deepEqual(lv, [...lv].sort((a, b) => a - b), 'ranked High → Low');
});

ok('forbidden wording: no recovery / expected revenue / assignment / owner / responsible / deadline / probability, and never a recommendation to lower a target (EN and AR, every string of every item)', () => {
  const EN = [/\brecover(y|ed|able|ies)?\b/i, /\bexpected\b/i, /\bassign(ed|ee|ment|ments|s)?\b/i, /(?<!data )\bowners?\b/i, /\bresponsible\b/i, /\bdeadlines?\b/i, /\bprobabilit/i, /\blikel(y|ihood)\b/i, /\b(lower|reduce|cut|revise|amend|decrease|adjust)\w*\s+(the\s+|its\s+|their\s+|an?\s+)?(annual\s+)?(targets?|goals?)\b/i, /write[- ]?off/i, /\bapprove (the|a) (route|plan|recovery)/i, /\bcollectible\b/i];
  const AR = [/مسؤول|مسئول/, /مُسند|مسند|إسناد|اسناد|تكليف/, /استرداد|استرجاع/, /متوقع/, /احتمال/, /الموعد النهائي/, /(خفض|تخفيض|تقليل|تعديل)\s+(ال)?(مستهدف|هدف)/, /اعتماد الهدف/, /قابل للتحصيل/];
  const bag = [...strings(RICH.items), ...strings(summaryOf(withState(RICH.items, ds.emptyStore()), RICH.context)), ...strings(PRIORITY_RULE)];
  for (const s of bag) { for (const r of EN) assert.ok(!r.test(s), `EN forbidden ${r}: «${s.slice(0, 90)}»`); for (const r of AR) assert.ok(!r.test(s), `AR forbidden ${r}: «${s.slice(0, 90)}»`); }
  // exposure is never presented as an expected / recovered amount; the plan items never suggest changing the target
  for (const i of RICH.items.filter((x) => x.category === 'plan_deviation')) assert.ok(i.options.length === 2 && i.proposed[0].en.startsWith('Investigate the reason for the gap before any measure'));
});

ok('unknown causes: every item has at least one unknown; a cause is never stated as proven in what / facts / calculated (those hold records and arithmetic only)', () => {
  for (const i of RICH.items) {
    assert.ok(i.unknown.length >= 1 && i.unknown.every((u) => u.ar && u.en), i.key);
    for (const s of strings([i.what, i.facts, i.calculated])) assert.ok(!/\bbecause\b|\bcaused by\b|\bdue to\b|\bthanks to\b|بسبب|نتيجة لـ/i.test(s), `${i.key}: asserts a cause «${s.slice(0, 80)}»`);
  }
  for (const i of RICH.items.filter((x) => x.category === 'overdue_aging')) assert.ok(i.unknown.some((u) => /not recorded|no documented|unknown/i.test(u.en)), `${i.key}: the missing reason is said`);
  for (const i of RICH.items.filter((x) => x.category === 'plan_deviation')) assert.ok(/not recorded/.test(i.unknown[0].en) && /calculated deviation/.test(i.unknown[0].en));
  // a documented reason (an objection) is reported as such, at scope level
  const withObj = buildDecisionItems({ ...base, snapshot: { ...snap, stock: { ...snap.stock, objectionOutstanding: 5e7 } } }).items.find((i) => i.key.startsWith('overdue:amanah:'));
  assert.ok(withObj.unknown[0].en.includes('recorded objection') && withObj.proposed.some((p) => /objection/i.test(p.en)));
});

ok('plan deviation: collected against PLANNED TO DATE (the annual target is stated separately); the gap is planned − collected; an entity on track produces no item; the forecast is labelled illustrative; never recommends lowering a target', () => {
  const pl = RICH.items.filter((i) => i.category === 'plan_deviation'); assert.ok(pl.some((i) => i.key === 'plan:ministry') && pl.some((i) => i.key === 'plan:Jeddah Amanah'));
  for (const i of pl) {
    const e = i.key === 'plan:ministry' ? { plannedToDate: PLAN.ministry.plannedToDate, collected: PLAN.ministry.collected, target: PLAN.ministry.target } : PLAN.entities.find((x) => `plan:${x.key}` === i.key);
    assert.equal(i.measure.kind, 'gap'); assert.equal(i.measure.amount, e.plannedToDate - e.collected); assert.equal(i.periodBasis, 'fiscal_year'); assert.equal(i.period.from, '2026-01-01');
    const v = Object.fromEntries(i.comparison.values.map((x) => [x.label.en, x.value])); assert.equal(v['Planned to date'], e.plannedToDate); assert.equal(v['Collected to date'], e.collected); assert.equal(v['Plan target (shown separately)'], e.target);
    assert.ok(/not the comparison basis/.test(i.comparison.basis.en)); assert.ok(i.calculated.some((c) => c.label.en === 'Gap to the plan to date' && c.value === i.measure.amount && /Planned to date − collected/.test(c.formula.en)));
    assert.ok(i.options.length === 2 && i.verification === 'verified');
  }
  const m = pl.find((i) => i.key === 'plan:ministry'); assert.ok(m.calculated.some((c) => /illustrative/i.test(c.label.en) && /not an approved model/.test(c.formula.en)), 'the estimate is labelled');
  const easy = sectionFor({ 'Jeddah Amanah': 6e9, 'Asir Amanah': 4e9 }, 10e9);
  assert.ok(!buildDecisionItems({ ...base, plan: easy }).items.some((i) => i.category === 'plan_deviation'), 'on or above plan: no plan item');
  assert.ok(!buildDecisionItems({ ...base, plan: { ...PLAN, entities: PLAN.entities.map((e) => ({ ...e, plannedToDate: 0 })), ministry: { ...PLAN.ministry, plannedToDate: 0 } } }).items.some((i) => i.category === 'plan_deviation'), 'no planned-to-date amount: no deviation');
});

ok('source deterioration: only with a verified like-for-like comparison — the rate must have fallen by the threshold against the previous equivalent period; an unavailable or non-comparable previous period produces nothing', () => {
  const none1 = buildDecisionItems({ ...base, previous: null }); const none2 = buildDecisionItems({ ...base, previous: { ...base.previous, comparable: false } });
  assert.ok(![...none1.items, ...none2.items].some((i) => i.category === 'source_deterioration'));
  const S = base.previous.snapshot; const mk = (patch) => ({ ...base.previous, snapshot: { ...S, bySource: S.bySource.map((g) => (g.key === 'fines' ? patch(g) : g)) } });
  const rate = (g) => g.collectedOverNet.value; const curFines = snap.bySource.find((g) => g.key === 'fines');
  const higher = (pp) => (g) => ({ ...g, collectedOverNet: { ...g.collectedOverNet, calculable: true, value: rate(curFines) + pp / 100 } });
  const hit = buildDecisionItems({ ...base, previous: mk(higher(12)) }).items.find((i) => i.key === 'source:fines'); assert.ok(hit, 'a 12-point fall is raised');
  const v = Object.fromEntries(hit.comparison.values.map((x) => [x.label.en, x.value])); assert.ok(Math.abs(v['Current period'] - rate(curFines)) < 1e-12 && Math.abs(v['Previous equivalent period'] - (rate(curFines) + 0.12)) < 1e-12);
  assert.ok(Math.abs(hit.calculated[0].value + 12) < 1e-9 && hit.calculated[0].unit === 'pp' && /previous-period rate/.test(hit.calculated[0].formula.en)); assert.ok(/each measured at the end of its own period/.test(hit.comparison.basis.en));
  assert.ok(/not recorded/.test(hit.unknown[0].en) && hit.kind === 'review' && hit.verification === 'verified' && hit.measure.kind === 'overdue');
  assert.ok(!buildDecisionItems({ ...base, previous: mk(higher(3)) }).items.some((i) => i.key === 'source:fines'), 'a 3-point fall is below the threshold');
  assert.ok(!buildDecisionItems({ ...base, previous: mk((g) => ({ ...g, collectedOverNet: { calculable: false, value: null } })) }).items.some((i) => i.key === 'source:fines'), 'an incalculable previous rate is never guessed');
  const thr = THRESHOLDS.deteriorationPp; for (const i of R.items.filter((x) => x.category === 'source_deterioration')) { const vv = i.comparison.values; assert.ok((vv[1].value - vv[0].value) * 100 >= thr - 1e-9, `${i.key}: the fall is real`); }
});

ok('overlap and additivity: items that count the same invoices disclose it (both ways); only the overdue by Amanah is additive and its entities are disjoint; the financial total is that sum, or null with a reason when a clash exists', () => {
  const st = withState(RICH.items, ds.emptyStore()); const sm = summaryOf(st, RICH.context); const by = new Map(RICH.items.map((i) => [i.key, i]));
  for (const i of RICH.items) for (const o of i.overlap) assert.ok(by.get(o.with).overlap.some((x) => x.with === i.key), 'overlap is symmetric');
  const add = RICH.items.filter((i) => i.additive); assert.ok(add.length >= 2 && add.every((i) => i.key.startsWith('overdue:amanah:') && i.measure.kind === 'overdue'));
  for (const a of add) for (const b of add) if (a !== b) assert.ok(!a.overlap.some((o) => o.with === b.key), 'additive items never overlap each other');
  const src = RICH.items.find((i) => i.key.startsWith('overdue:source:')); assert.ok(src.overlap.length > 0 && !src.additive, 'a source item overlaps the Amanah items and is not additive');
  assert.ok(RICH.items.find((i) => i.key === 'plan:Jeddah Amanah').overlap.some((o) => o.with === 'overdue:amanah:Jeddah Amanah' && /different basis/.test(o.note.en)), 'plan gap vs overdue of the same entity: different bases, not added');
  assert.ok(RICH.items.find((i) => i.key === 'orders:suspended').overlap.length > 0);
  assert.equal(RICH.items.find((i) => i.key === 'contracts:unlinked').overlap.length, 0, 'installments without an invoice are a different population');
  assert.equal(sm.financialTotal.amount, add.reduce((t, i) => t + i.measure.amount, 0)); assert.deepEqual(sm.financialTotal.itemKeys.sort(), add.map((i) => i.key).sort()); assert.ok(sm.financialTotal.amount <= RICH.context.totalOverdue + 1); assert.equal(sm.financialTotal.scopeTotal, RICH.context.totalOverdue);
  assert.ok(sm.overlapNote.en && /not added/.test(sm.overlapNote.en));
  // force a clash: the total disappears and says why
  const clash = st.map((i) => (i.key === add[0].key ? { ...i, overlap: [...i.overlap, { with: add[1].key, note: { ar: 'ع', en: 'x' } }] } : i)); const sc = summaryOf(clash);
  assert.equal(sc.financialTotal, null); assert.ok(sc.financialTotalReason.en && sc.overlapNote);
  // no additive item: no total
  assert.equal(summaryOf(st.map((i) => ({ ...i, additive: false }))).financialTotal, null);
  // with nothing overlapping there is no note
  assert.equal(summaryOf(st.filter((i) => i.category === 'installments_unlinked' && i.key === 'contracts:unlinked')).overlapNote, null);
});

ok('summary: open financial issues · flagged · needing verification; flag changes move «flagged», never the open count; a followed-up item whose issue is still open stays open', () => {
  const ctx = { by: 'Reviewer', at: '2026-10-20T10:00:00Z' }; const key = RICH.items.find((i) => i.kind === 'decision').key; const key2 = RICH.items.find((i) => i.key === 'data:amount_conflicts').key;
  let s = ds.emptyStore(); const s0 = summaryOf(withState(RICH.items, s), RICH.context);
  assert.equal(s0.flagged, 0); assert.equal(s0.openFinancialIssues, RICH.items.filter((i) => i.measure.kind !== 'count').length); assert.equal(s0.needsVerification, RICH.items.filter((i) => i.verification === 'needs_verification').length);
  s = ds.flag(s, key, { note: 'check with the entity' }, ctx).store; s = ds.flag(s, key2, {}, ctx).store;
  const s1 = summaryOf(withState(RICH.items, s), RICH.context); assert.equal(s1.flagged, 2); assert.equal(s1.openFinancialIssues, s0.openFinancialIssues);
  s = ds.complete(s, key, { note: 'called the entity' }, ctx).store;
  const st2 = withState(RICH.items, s); const s2 = summaryOf(st2, RICH.context); const it = st2.find((i) => i.key === key);
  assert.equal(it.followUp.flag, 'followed_up'); assert.equal(it.condition.open, true, 'following up changes nothing about the issue'); assert.equal(it.measure.amount, RICH.items.find((i) => i.key === key).measure.amount);
  assert.equal(s2.flagged, 1); assert.equal(s2.followedUp, 1); assert.equal(s2.openFinancialIssues, s0.openFinancialIssues, 'followed up ≠ resolved'); assert.equal(s2.needsVerification, s0.needsVerification);
  s = ds.unflag(s, key, {}, ctx).store; const s3 = summaryOf(withState(RICH.items, s), RICH.context); assert.equal(s3.flagged, 1); assert.equal(s3.followedUp, 0); assert.equal(s3.openFinancialIssues, s0.openFinancialIssues);
  // an issue the data stops raising is simply not an item (its history waits in the store under its key)
  assert.ok(ds.followUpOf(s, 'gone:key').history.length === 0 && ds.followUpOf(s, key).history.length === 3);
  assert.ok(withState(RICH.items.slice(0, 2), s).every((i) => i.condition.open));
});

ok('filters (the page toolbar and the chart marks): category · Amanah · source · kind · priority · follow-up flag', () => {
  const st = withState(RICH.items, ds.flag(ds.emptyStore(), 'overdue:amanah:Jeddah Amanah', {}, { by: 'T', at: 'x' }).store);
  assert.equal(filterItems(st, {}).length, st.length); assert.equal(filterItems(st, { category: 'all', amanah: 'all' }).length, st.length);
  assert.ok(filterItems(st, { category: 'overdue_aging' }).every((i) => i.category === 'overdue_aging'));
  const j = filterItems(st, { amanah: 'Jeddah Amanah' }); assert.ok(j.length >= 2 && j.every((i) => i.affected.amanah === 'Jeddah Amanah'));
  const f = filterItems(st, { source: 'fines' }); assert.ok(f.length > 0 && f.every((i) => i.affected.source === 'fines'));
  assert.deepEqual(filterItems(st, { flag: 'flagged' }).map((i) => i.key), ['overdue:amanah:Jeddah Amanah']); assert.ok(filterItems(st, { flag: 'none' }).length === st.length - 1);
  assert.ok(filterItems(st, { priority: 'high' }).every((i) => i.priority.level === 'high')); assert.ok(filterItems(st, { kind: 'clarification' }).every((i) => i.kind === 'clarification'));
  assert.equal(filterItems(st, { category: 'plan_deviation', amanah: 'Jeddah Amanah' }).length, 1);
});

ok('evidence links keep the scope: list links carry the Amanah / source / period; invoice links use the invoice id path; order links the order path; nothing points at a removed page', () => {
  const am = R.items.find((i) => i.key === 'overdue:amanah:Jeddah Amanah'); const l = am.evidence.find((e) => /category=overdue/.test(e.to) && /from=/.test(e.to)); assert.ok(l && l.to.includes('amanah=Jeddah+Amanah') && l.to.includes('to=2026-10-20') && l.to.startsWith('/collection?'));
  const src = R.items.find((i) => i.key === 'overdue:source:fines'); assert.ok(src.evidence[0].to.includes('src=fines') && src.evidence[0].to.includes('from=2026-01-01'));
  const dc = R.items.find((i) => i.key === 'data:amount_conflicts'); assert.ok(dc.evidence.filter((e) => e.to.startsWith('/invoices/')).length > 0 && dc.evidence.length <= 6);
  assert.ok(R.items.find((i) => i.key === 'orders:suspended').evidence.some((e) => e.to === '/enforcement-orders/EN-1')); assert.ok(R.items.find((i) => i.key === 'orders:links').evidence.some((e) => e.to === '/enforcement?view=orders'));
  for (const e of R.items.flatMap((i) => i.evidence)) assert.ok(!/\/(agents|challenges|data-sources|data-quality)/.test(e.to), e.to);
});

ok('installments without a verified invoice link: only that framing (proposed rule, unverified, generated schedule), the four prerequisites named as missing, arrears only as context', () => {
  const u = RICH.items.find((i) => i.key === 'contracts:unlinked'); const text = JSON.stringify([u.title, u.what, u.facts, u.unknown, u.proposed, u.missing]);
  assert.ok(text.includes(PROPOSED_RULE.en) && text.includes(PROPOSED_RULE.ar) && /generated/i.test(text) && u.verification === 'needs_verification' && u.priority.level !== 'high');
  for (const p of UNLINKED_RULE.prerequisites) assert.ok(u.missing.some((m) => m.en.includes(p.en) && m.ar.includes(p.ar)), p.key);
  assert.ok(u.facts.some((f) => /context only/.test(f.en) && /not part of this item/.test(f.en)) && u.evidence.every((e) => e.status === 'unverified'));
  assert.ok(u.proposed[0].en.includes('confirmed Furas contract records') && !/found in the Furas extract/i.test(text));
  assert.ok(!RICH.items.some((i) => i.key === 'contracts:arrears' || i.key === 'contracts:future'));
  const nc = RICH.items.find((i) => i.key === 'contracts:no_contract'); assert.ok(/not proof that no contract exists/.test(nc.what.en) && nc.measure.kind === 'count' && nc.measure.amount === undefined);
});

ok('an organisation scope: Amanahs outside allowedAmanahs never appear (items, plan entities, chart marks)', () => {
  const allowed = ['Jeddah Amanah', 'Asir Amanah']; const inp = { ...base, plan: PLAN, allowedAmanahs: allowed }; const r = buildDecisionItems(inp);
  for (const i of r.items) { if (i.affected.amanah) assert.ok(allowed.includes(i.affected.amanah), `${i.key} is outside the scope`); }
  assert.ok(r.items.some((i) => i.affected.amanah === 'Jeddah Amanah')); assert.ok(!r.items.some((i) => i.key.includes('Housing Sector')));
  const ch = buildDecisionCharts(inp, 'en'); for (const m of [...ch.overdueRank.amanah.marks, ...(ch.planVsActual?.marks || [])]) assert.ok(allowed.includes(m.filter.amanah));
});

/* ---------------- charts ---------------- */
ok('charts · ranked overdue exposure: largest first, by Amanah with a by-source variant; each mark maps to a filter; unit, period, cutoff and basis are stated', () => {
  for (const lang of ['en', 'ar']) {
    const ch = buildDecisionCharts(base, lang); const c = ch.overdueRank.amanah;
    assert.equal(c.type, 'chart'); assert.equal(c.kind, 'hbar'); assert.ok(c.ranked); assert.equal(c.labels.length, c.series[0].values.length); assert.equal(c.marks.length, c.labels.length);
    const v = c.series[0].values; assert.deepEqual(v, [...v].sort((a, b) => b - a), 'largest first'); assert.ok(v.length <= 8);
    c.marks.forEach((m, i) => { assert.equal(m.label, c.labels[i]); assert.ok(m.filter.amanah); assert.equal(v[i], snap.matrix.amanahSource.filter((x) => x.amanah === m.filter.amanah).reduce((t, x) => t + x.overdue, 0)); });
    for (const k of ['2026-01-01', '2026-10-20', lang === 'ar' ? 'بالريال السعودي' : 'SAR']) assert.ok(c.note.includes(k), `${lang}: the note names ${k}`); assert.equal(c.unit, 'SAR'); assert.deepEqual(c.period, { from: '2026-01-01', to: '2026-10-20' }); assert.equal(c.cutoff, TODAY); assert.ok(c.basis.length > 20);
    const s = ch.overdueRank.source; assert.equal(s.kind, 'hbar'); s.marks.forEach((m) => assert.ok(m.filter.source)); assert.equal(s.series[0].values.reduce((t, x) => t + x, 0), snap.matrix.amanahSource.reduce((t, x) => t + x.overdue, 0), 'all sources shown: they add up to the overdue');
    assert.equal(ch.overdueRank.default, 'amanah'); clean(ch, `charts ${lang}`);
  }
  assert.ok(buildDecisionCharts(baseOf(snapOf({ source: 'fines' })), 'en').overdueRank.source === null, 'a single source has no by-source variant');
});

ok('charts · actual vs planned only where a comparable reference plan exists (else null + the reason); the plan target and its source plan are in the note, not the comparison; unavailable ≠ zero', () => {
  const none = buildDecisionCharts(base, 'en'); assert.equal(none.planVsActual, null); assert.ok(none.unavailable.planVsActual.length > 10);
  const ch = buildDecisionCharts({ ...base, plan: PLAN }, 'en'); const c = ch.planVsActual;
  assert.equal(c.kind, 'bar'); assert.deepEqual(c.series.map((s) => s.label), ['Planned to date', 'Collected']); assert.equal(c.labels.length, 2);
  c.marks.forEach((m, i) => { const e = PLAN.entities.find((x) => x.key === m.filter.amanah); assert.equal(c.series[0].values[i], e.plannedToDate); assert.equal(c.series[1].values[i], e.collected); assert.equal(m.filter.category, 'plan_deviation'); });
  assert.ok(c.note.includes('plan target') && c.note.includes(SRC.label.en) && c.note.includes('2026-01-01') && c.note.includes(TODAY) && c.note.includes('SAR') && /not the comparison basis/.test(c.note));
  assert.equal(buildDecisionCharts({ ...base, plan: PLAN, snapshot: snapOf({ source: 'fines' }) }, 'en').planVsActual, null); assert.ok(buildDecisionCharts({ ...base, plan: PLAN, snapshot: snapOf({ source: 'fines' }) }, 'en').unavailable.planVsActual.includes('source'));
  assert.equal(buildDecisionCharts({ ...base, plan: { ...PLAN, entities: [] } }, 'en').planVsActual, null);
  const ar = buildDecisionCharts({ ...base, plan: PLAN }, 'ar'); assert.equal(ar.planVsActual.series[0].label, 'المخطط حتى تاريخه');
});

ok('charts · aging of the overdue balance: the verified buckets (not-yet-due is not lateness and is left out), sums to the overdue stock; unavailable stock → null with a reason, never zeros', () => {
  const c = buildDecisionCharts(base, 'en').aging; assert.equal(c.kind, 'bar'); assert.equal(c.labels.length, 4); assert.ok(!c.labels.some((l) => /Not yet due/.test(l)));
  assert.deepEqual(c.series[0].values, snap.stock.aging.slice(1).map((a) => a.amount)); assert.ok(Math.abs(c.series[0].values.reduce((t, x) => t + x, 0) - snap.stock.overdue) < 1);
  assert.ok(c.marks.every((m) => m.filter.category === 'overdue_aging')); assert.ok(c.note.includes('all periods') && c.note.includes(TODAY) && c.note.includes('Not yet due'));
  const gone = buildDecisionCharts({ ...base, snapshot: { ...snap, stock: { ...snap.stock, aging: undefined } } }, 'en'); assert.equal(gone.aging, null); assert.ok(gone.unavailable.aging.length > 10);
  const zero = buildDecisionCharts({ ...base, snapshot: { ...snap, stock: { ...snap.stock, aging: snap.stock.aging.map((a) => ({ ...a, amount: 0 })) } } }, 'en'); assert.equal(zero.aging, null);
  assert.equal(buildDecisionCharts(base, 'ar').aging.labels[0], snap.stock.aging[1].label.ar);
});

ok('item trend: net invoiced and collected by invoice month for the item’s Amanah / source (same matrix); null where the data cannot support it (plan, enforcement, data items, fewer than two months)', () => {
  const am = R.items.find((i) => i.key === 'overdue:amanah:Jeddah Amanah'); assert.equal(am.trend, true);
  const t = itemTrend(am, { snapshot: snap, lang: 'en' }); assert.equal(t.kind, 'bar'); assert.equal(t.basis, 'monthly'); assert.equal(t.series.length, 2); assert.equal(t.labels.length, t.series[0].values.length);
  const rows = trendSeries(snap, { amanah: 'Jeddah Amanah' }); assert.deepEqual(t.labels, rows.map((r) => r.month)); assert.deepEqual(t.series[0].values, rows.map((r) => r.net)); assert.deepEqual(t.series[1].values, rows.map((r) => r.collected));
  assert.ok(t.note.includes('SAR') && t.note.includes('2026-01-01') && t.note.includes(TODAY)); assert.deepEqual(t.labels, [...t.labels].sort());
  assert.equal(itemTrend(R.items.find((i) => i.key === 'data:amount_conflicts'), { snapshot: snap }), null); assert.equal(itemTrend(RICH.items.find((i) => i.key === 'plan:ministry'), { snapshot: snap }), null); assert.equal(itemTrend(R.items.find((i) => i.key === 'orders:suspended'), { snapshot: snap }), null);
  assert.equal(itemTrend(am, { snapshot: { ...snap, matrix: { ...snap.matrix, amanahSourceMonth: [] } } }), null); assert.equal(itemTrend(am, {}), null);
  assert.equal(itemTrend(am, { snapshot: snap, lang: 'ar' }).series[0].label, 'صافي المفوتر');
  for (const i of RICH.items) assert.equal(!!itemTrend(i, { snapshot: snap }), i.trend, `${i.key}: the trend flag matches`);
});

ok('permissions and wiring (source): only users who can review change a flag; the hook exposes the follow-up API and no assignment; items come from the organisation-scoped data', () => {
  const hook = fs.readFileSync('src/data/useDecisions.js', 'utf8');
  assert.ok(/if \(!rev\.canDo\.followup\) return \{ ok: false, error: 'no_permission' \}/.test(hook), 'the gate (decisions.followup) runs before any store change');
  for (const f of ['flag:', 'complete:', 'unflag:', 'note:', 'followUp:']) assert.ok(hook.includes(f), f);
  assert.ok(!/assign|setStatus|ROLES|STATUSES|dueDate/.test(hook), 'no assignment in the hook'); assert.ok(hook.includes('allowedAmanahs: allowedKeys') && !/rev\.org/.test(hook), 'the items are limited to the account scope, never a persona');
  for (const f of ['src/data/decisionRoom.js', 'src/data/decisionStore.js', 'src/data/decisionCharts.js']) assert.ok(!/\b(assignee|ROLES|dueDateOf|REASON_REQUIRED)\b/.test(fs.readFileSync(f, 'utf8').replace(/no assignee[^\n]*/gi, '')), `${f}: no assignment vocabulary`);
});

console.log(`decision room: ${n} test groups passed`);
