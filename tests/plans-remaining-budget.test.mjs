// The REMAINING-2026 plan as a complete plan (shared components, upcoming period, schedule, pace, forecast, in-period) and the NOTIFIED BUDGET («الميزانية المبلّغة») of the selected plan's year.
// Server-side render of the REAL components with the real engine (synthetic data) — every expected number is computed by an independent route. Run: npm run test:plansremaining
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.js';
import { I18nProvider } from '../src/context/I18nContext.jsx';
import { loadStore } from '../server/store.js';
import { snapshot, series } from '../server/engine.js';
import { approvedConfigOf, loadPlanInputsForPlan } from '../src/data/planInputs.js';
import { DEFAULT_CONFIG } from '../src/data/revenueMetrics.js';
import { planningBasisFromPlan, upcomingForecastSupport, UPCOMING_FORECAST_MAX_GAP_DAYS } from '../src/data/plans/planBasis.js';
import { forecastPlan } from '../src/data/planForecast.js';
import { planMeasures } from '../src/data/plans/planMeasures.js';
import { normalizeContent } from '../src/data/plans/planRules.js';
import { seedPlanContent, collectionPlan2027Content, deriveRemainingPlanContent, REMAINING_PLAN_2026 } from '../src/data/plans/planDefaults.js';
import { scheduleRows, upcomingTiles } from '../src/data/plans/planSchedule.js';
import { notifiedBudgetFor, budgetYearOf } from '../src/data/plans/notifiedBudget.js';
import { appropriationOf, appropriationKeys, appropriationTotal, HQ_KEY } from '../src/data/appropriations.js';
import { contextChips, notifiedBudgetChip } from '../src/data/reportModel.js';
import * as U from '../src/components/plans/planUi.js';
import { planCumulativeBlock, planBreakdown, planDeviationBlock } from '../src/components/plans/planCharts.js';
import { PlanSummary, PlanPositionBlock, PlanForecastSection, PlanScheduleSection, PlanBreakdownSection, NotifiedBudget } from '../src/components/plans/PlanSections.jsx';
import { emptyView } from '../src/data/reportView.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const E = React.createElement;
const render = (el, lang = 'ar') => { globalThis.sessionStorage = { getItem: (k) => (k === 'ib_lang' ? lang : null), setItem() {}, removeItem() {} }; try { return renderToStaticMarkup(E(StaticRouter, { location: '/planning/p1' }, E(I18nProvider, null, el))); } finally { delete globalThis.sessionStorage; } };
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
const noop = () => {};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

const TODAY = '2026-11-06'; const NOW = '2026-11-06T09:00:00.000Z'; const AT20 = '2026-11-20';
const mkRev = (day) => { const s = loadStore(day); const c = approvedConfigOf({ ...DEFAULT_CONFIG, cutoff: day }); return { st: s, cfg: c, rev: { data: { snapshot: async (scope, o = {}) => snapshot(s, { scope, cfg: o.cfg || c }), series: async (scope, o = {}) => series(s, { scope, cfg: o.cfg || c }) } } }; };
const W6 = mkRev(TODAY); const W20 = mkRev(AT20);
const direct = (w, from, to) => series(w.st, { scope: { from, to, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' }, cfg: w.cfg }).values.reduce((a, b) => a + b, 0);
const RY = 'Riyadh Amanah'; const JD = 'Jeddah Amanah';
const plan = (o = {}) => ({ id: 'p1', name: 'خطة', isSystem: true, origin: 'seed', state: 'active', content: null, createdBy: null, createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z', lastEditedBy: null, revision: 1, versions: [], legacy: null, viewer: { canEdit: false }, ...o });

const annualC = seedPlanContent(2026, { at: NOW }); const annualP = plan({ id: 'plan-5eed2026', name: annualC.name, content: annualC });
const run = async (p, { w = W6, today = TODAY, viewScope = null, entityKeys = null } = {}) => {
  const view = U.viewOf(p, p.content);
  const D = await loadPlanInputsForPlan(w.rev, { view, reporting: today, approvedCfg: w.cfg, entityKeys, viewScope, upcomingHistory: true });
  const basis = planningBasisFromPlan({ view, today, latestDataDate: today, entityKeys, actual: D?.actual || null, viewScope });
  const forecast = forecastPlan(basis, { history: D?.history, now: NOW });
  return { view, D, basis, forecast, measures: planMeasures(basis, forecast) };
};
const REM = async () => {
  const D = await loadPlanInputsForPlan(W6.rev, { view: U.viewOf(annualP, annualC), reporting: TODAY, approvedCfg: W6.cfg, entityKeys: null, viewScope: null });
  const c = deriveRemainingPlanContent({ annualContent: annualC, actualByEntity: D.actual.byEntity, derivedAt: NOW, annualPlanId: annualP.id, annualPlanRevision: 1 });
  return plan({ id: REMAINING_PLAN_2026.id, name: c.name, nameEn: 'Remaining 2026 Collection Plan', seedKey: REMAINING_PLAN_2026.seedKey, content: c });
};
const remP = await REM(); const bl = remP.content.baseline; const T = remP.content.target.amount;
const c27 = collectionPlan2027Content({ at: NOW }); const p27 = plan({ id: 'plan-2027c0de', name: c27.name, nameEn: '2027 Collection Plan', content: c27 });
const R = await run(remP); const R27 = await run(p27); const RA = await run(annualP);

/* ================================================================== A. the remaining plan BEFORE the period starts */
await ok('summary: ONE «قادمة — تبدأ 7 نوفمبر» status and the FOUR measures (period target · planned Nov 7–30 · planned Dec · required average daily) — no repeated «not available» card', async () => {
  assert.equal(R.basis.state, 'future_period');
  for (const lang of ['ar', 'en']) {
    const h = render(E(PlanSummary, { measures: R.measures, view: R.view, plan: remP, basis: R.basis, budget: null }), lang); const t = text(h);
    assert.equal((t.match(lang === 'ar' ? /قادمة — تبدأ 7 نوفمبر 2026/g : /Upcoming — starts 7 Nov 2026/g) || []).length, 1, `${lang}: one status`);
    assert.equal((t.match(/غير متاح|Not available/g) || []).length, 0, `${lang}: no empty cards`);
    for (const id of ['plan-tile-target', 'plan-tile-first', 'plan-tile-second', 'plan-tile-daily']) assert.ok(h.includes(`id="${id}"`), `${lang}: ${id}`);
    assert.equal((h.match(/class="rv-tile"/g) || []).length, 4, `${lang}: exactly four tiles`);
    assert.ok(lang === 'ar' ? t.includes('المستهدف للفترة المتبقية') && t.includes('المخطط لشهر نوفمبر (7–30 نوفمبر)') && t.includes('المخطط لشهر ديسمبر') && t.includes('متوسط التحصيل اليومي المطلوب') && t.includes('شهر جزئي: 24 من 30 يوماً')
      : t.includes('Target for the remaining period') && t.includes('Planned for Nov (7–30 Nov)') && t.includes('Planned for Dec') && t.includes('Required average daily collection') && t.includes('Partial month: 24 of 30 days'), `${lang}: ${t.slice(0, 700)}`);
  }
  const tiles = upcomingTiles(R.basis, { derived: true });
  assert.deepEqual(tiles.map((x) => x.id), ['target', 'first', 'second', 'daily']);
  assert.equal(tiles[0].value, T); assert.equal(tiles[1].value, R.basis.months[0].planned); assert.equal(tiles[2].value, R.basis.months[1].planned); assert.ok(near(tiles[3].value, T / 55, 1e-6));
  assert.equal(R.measures.actual, null); assert.equal(R.measures.plannedToDate, null); assert.equal(R.measures.achievementToDate, null); assert.equal(R.measures.deviation.amount, null);
  assert.equal(text(render(E(PlanPositionBlock, { basis: R.basis, measures: R.measures }))).trim(), '', 'no position card before the start');
});
await ok('pace figures: daily = target ÷ 55 days (7 Nov – 31 Dec inclusive); monthly = target ÷ (24/30 + 31/31 = 1.8 months by days); date boundaries 7 Nov inclusive, 31 Dec inclusive', () => {
  const rq = R.basis.pace.required; assert.deepEqual([rq.state, rq.upcoming, rq.remainingDays], ['ok', true, 55]);
  assert.ok(near(rq.remainingMonths, 24 / 30 + 31 / 31, 1e-12)); assert.ok(near(rq.daily, T / 55, 1e-6)); assert.ok(near(rq.monthly, T / 1.8, 1e-3)); assert.equal(R.basis.upcoming.days, 55);
  assert.deepEqual(R.basis.period, { start: '2026-11-07', end: '2026-12-31', preset: 'range' });
  assert.equal(R.basis.months[0].start, '2026-11-07'); assert.equal(R.basis.months[0].end, '2026-11-30'); assert.equal(R.basis.months[1].end, '2026-12-31');
  assert.equal(R.basis.months.reduce((t, m) => t + m.days, 0), 55);
  // the pace is the PERIOD's own: it moves with the target only (not with 6 Nov collections of the baseline)
  assert.equal(R.basis.remainingTarget, T);
});
await ok('schedule: Nov (24 of 30 days) + Dec sum to the target TO THE RIYAL; the partial November weighs 24/54; the table, the chart axes (Nov–Dec 2026) and the rows agree; Σ entity allocations = the target = Σ planned months', () => {
  const sc = scheduleRows(R.basis); assert.equal(sc.rows.length, 2); assert.equal(sc.totals.planned, T); assert.equal(sc.totals.reconciles, true);
  assert.equal(sc.rows[0].planned + sc.rows[1].planned, T); assert.ok(sc.rows[0].partial && sc.rows[0].days === 24 && sc.rows[0].monthDays === 30); assert.ok(!sc.rows[1].partial && sc.rows[1].days === 31);
  assert.ok(Math.abs(sc.rows[0].planned / T - 24 / 54) < 1e-6, 'November = 24/54 of the target (day-fraction months)');
  assert.equal(remP.content.allocations.reduce((t, a) => t + a.amount, 0), T, 'Σ allocations = the remaining target');
  const ent = R.basis.entities; for (let i = 0; i < 2; i += 1) assert.ok(Math.abs(ent.reduce((t, e) => t + e.monthly[i], 0) - R.basis.months[i].planned) < 1e-6, `Σ entity month ${i} = the plan month`);
  assert.equal(ent.reduce((t, e) => t + e.target, 0), T);
  for (const lang of ['ar', 'en']) {
    const cb = planCumulativeBlock(R.basis, R.forecast, { lang }); assert.equal(cb.labels.length, 2); assert.ok(/2026/.test(cb.labels.join()) && !/2027|2025/.test(cb.labels.join())); assert.equal(cb.series.find((s) => s.kind === 'planned').values.at(-1), T); assert.equal(cb.series.find((s) => s.kind === 'planned').values[0], R.basis.months[0].planned, 'chart = table');
    const t = text(render(E(PlanScheduleSection, { basis: R.basis }), lang)); assert.ok(t.includes('24 / 30'), `${lang}: ${t.slice(0, 400)}`); assert.ok(!/forecast|توقع —/i.test(t.replace('This is how the target is distributed, not a forecast.', '').replace('هذا الجدول هو توزيع المستهدف وليس توقعاً.', '')));
    const br = text(render(E(PlanBreakdownSection, { basis: R.basis, dev: planDeviationBlock(R.basis, { lang }), bd: planBreakdown(R.basis, { lang }), view: emptyView(), onViewChange: noop }), lang));
    assert.ok(lang === 'ar' ? br.includes('المخطط نوفمبر') && br.includes('المخطط ديسمبر') : br.includes('Planned Nov') && br.includes('Planned Dec'), `${lang}: the allocation table carries each entity's monthly plan`);
  }
});
await ok('baseline block = the FROZEN baseline (never hardcoded): annual − collected = remaining; renders the stored values; the plan content is not changed by running the page', async () => {
  const before = JSON.stringify(remP.content); await run(remP); assert.equal(JSON.stringify(remP.content), before);
  assert.equal(bl.annualTarget - bl.actualToCutoff, bl.remaining); assert.equal(bl.surplus, 0); assert.equal(bl.remaining, T); assert.equal(bl.cutoff, '2026-11-06');
  const crafted = { ...remP, content: { ...remP.content, baseline: { ...bl, annualTarget: 777_000_000, actualToCutoff: 111_000_000, remaining: 666_000_000 } } };
  const t = text(render(E(PlanSummary, { measures: R.measures, view: U.viewOf(crafted, crafted.content), plan: crafted, basis: R.basis }))); assert.ok(/777/.test(t) && /111/.test(t) && /666/.test(t), 'the block reads content.baseline');
});
await ok('forecast BEFORE the period: supported for the remaining plan (recent run-rate × Σ period day fractions, NO baseline collections, four dates), distinct from the target and the schedule, expected achievement = forecast ÷ the remaining target', () => {
  const f = R.forecast; assert.equal(f.state, 'ok'); assert.equal(f.upcoming, true); assert.equal(f.actualToDate, null);
  const rate = (direct(W6, '2026-08-01', '2026-08-31') + direct(W6, '2026-09-01', '2026-09-30') + direct(W6, '2026-10-01', '2026-10-31')) / 3;
  assert.ok(near(f.monthlyRate, rate, 1e-3), 'the mean of the last three COMPLETE months (Aug–Oct)'); assert.ok(near(f.forecastTotal, rate * (24 / 30 + 31 / 31), 1e-2), 'rate × (24/30 + 1)');
  assert.ok(f.forecastTotal < bl.actualToCutoff, 'no baseline collections are inside it'); assert.notEqual(Math.round(f.forecastTotal), T); assert.notEqual(Math.round(f.forecastTotal), R.basis.months[0].planned);
  assert.ok(near(f.expectedAchievementPct, f.forecastTotal / T, 1e-12)); assert.equal(f.cumulative.length, 2); assert.ok(near(f.cumulative[1], f.forecastTotal, 1e-3));
  assert.deepEqual([f.reportingCutoff, f.lastCompleteMonth, f.period.start], ['2026-11-06', '2026-10', '2026-11-07']); assert.ok(f.forecastGeneratedAt); assert.deepEqual(R.measures.dates.reportingCutoff, '2026-11-06');
  assert.equal(R.measures.expected.state, 'ok'); assert.ok(near(R.measures.expected.pct, f.forecastTotal / T, 1e-12)); assert.equal(f.probability, undefined);
  assert.ok(f.assumptions.some((a) => /لا يدخل فيه أي تحصيل سابق/.test(a.ar) && /no collection before the period start/.test(a.en)));
});
await ok('forecast support rule: the period must START within 31 days after the last data date — 1…31 days supported; 0 / 32+ days (the 2027 plan: 56) not', () => {
  assert.equal(UPCOMING_FORECAST_MAX_GAP_DAYS, 31);
  for (const [asOf, start, sup] of [['2026-11-06', '2026-11-07', true], ['2026-11-06', '2026-12-07', true], ['2026-11-06', '2026-12-08', false], ['2026-11-06', '2027-01-01', false], ['2026-11-06', '2026-11-06', false], [null, '2026-11-07', false]]) assert.equal(upcomingForecastSupport({ asOf, periodStart: start }).supported, sup, `${asOf} → ${start}`);
  assert.equal(upcomingForecastSupport({ asOf: '2026-11-06', periodStart: '2027-01-01' }).gapDays, 56);
});
await ok('forecast compatibility: a history of another plan / version / scope / period / cut-off yields NO number (incompatible_input / stale_input)', () => {
  const h = R.D.history; const f = (x) => forecastPlan(R.basis, { history: x, now: NOW });
  assert.equal(f(h).state, 'ok');
  for (const [k, v] of [['planId', 'plan-other'], ['versionId', 'x@r9'], ['scopeKey', 'entities:Riyadh Amanah'], ['period', { start: '2026-11-08', end: '2026-12-31' }]]) { const r = f({ ...h, [k]: v }); assert.equal(r.state, 'incompatible_input', k); assert.equal(r.forecastTotal, null); }
  const st = f({ ...h, cutoff: '2026-11-01' }); assert.equal(st.state, 'stale_input'); assert.equal(st.forecastTotal, null);
  assert.equal(f(null).state, 'incompatible_input'); assert.equal(f({ ...h, months: [{ ym: '2026-10', value: 1 }] }).state, 'insufficient_history');
});
await ok('forecast UI: three DISTINCT labelled things (target · planned schedule · forecast), the forecast is never the schedule, «not a probability», the dashed forecast series is its own', () => {
  for (const lang of ['ar', 'en']) {
    const h = render(E(PlanForecastSection, { basis: R.basis, forecast: R.forecast, measures: R.measures }), lang); const t = text(h);
    for (const id of ['plan-three-target', 'plan-three-schedule', 'plan-three-forecast', 'plan-pace-daily', 'plan-pace-monthly', 'plan-forecast-dates']) assert.ok(h.includes(`id="${id}"`), `${lang}: ${id}`);
    assert.ok(lang === 'ar' ? t.includes('المستهدف — ما يجب تحصيله') && t.includes('الجدول المخطط — كيف يُوزَّع المستهدف') && t.includes('التوقع — ما يشير إليه السجل الحديث') && t.includes('ليست احتمالاً') : t.includes('Target — what must be collected') && t.includes('Planned schedule — how the target is distributed') && t.includes('Forecast — what the recent evidence suggests') && t.includes('not a probability'), lang);
  }
  const cb = planCumulativeBlock(R.basis, R.forecast, { lang: 'ar' }); const fs_ = cb.series.find((s) => s.kind === 'forecast'); assert.ok(fs_.dashed && /ليس مخططاً/.test(fs_.label));
  assert.notDeepEqual(fs_.values, cb.series.find((s) => s.kind === 'planned').values);
});
await ok('2027 plan: forecast UNSUPPORTED with ONE compact explanation (no empty card), the required pace (target ÷ 365 / ÷ 12) still shows, no full-year-2026 forecast figure is copied, and its summary has the same four-measure shape', () => {
  assert.equal(R27.forecast.state, 'future_period'); assert.equal(R27.forecast.reason, 'upcoming_unsupported'); assert.equal(R27.forecast.forecastTotal, null); assert.equal(R27.measures.expected.state, 'future_period');
  assert.notEqual(R27.forecast.forecastTotal, RA.forecast.forecastTotal);
  for (const lang of ['ar', 'en']) {
    const h = render(E(PlanForecastSection, { basis: R27.basis, forecast: R27.forecast, measures: R27.measures }), lang); const t = text(h);
    assert.equal((h.match(/plan-outlook-unsupported/g) || []).length, 1); assert.ok(lang === 'ar' ? t.includes('56 يوماً') && t.includes('31 يوماً') : t.includes('56 days') && t.includes('31 days'), t);
    assert.ok(!h.includes('plan-three') && !/Expected by the end|المتوقع بنهاية الفترة/.test(t)); assert.ok(h.includes('plan-pace-daily'));
    const f26 = RA.forecast.forecastTotal; assert.ok(!text(h).includes(String(Math.round(f26))), 'no copy of the full-year forecast');
  }
  assert.ok(near(R27.basis.pace.required.daily, c27.target.amount / 365, 1e-6)); assert.ok(near(R27.basis.pace.required.monthly, c27.target.amount / 12, 1e-3));
  assert.deepEqual(upcomingTiles(R27.basis).map((x) => x.id), ['target', 'first', 'monthly', 'daily']);
});
await ok('the FULL-YEAR plan keeps its sections: running period, forecast composition, schedule table with the actual + deviation columns of the months that began', () => {
  assert.equal(RA.basis.state, 'ok'); assert.equal(RA.forecast.upcoming, undefined); assert.ok(RA.forecast.bridge);
  const sc = scheduleRows(RA.basis); assert.equal(sc.rows.length, 12); assert.equal(sc.totals.planned, annualC.target.amount); assert.equal(sc.hasActual, true); assert.ok(sc.rows[0].deviation != null && sc.rows[10].deviation == null, 'the deviation of a COMPLETE month only');
  const t = text(render(E(PlanForecastSection, { basis: RA.basis, forecast: RA.forecast, measures: RA.measures }))); assert.ok(t.includes('المتوقع بنهاية الفترة') && t.includes('من أين تأتي فجوة نهاية الفترة'));
});

/* ================================================================== B. the remaining plan IN the period (demo date 2026-11-20) */
await ok('in-period (demo date 2026-11-20): actual = collections 7–20 Nov ONLY (never the baseline), planned-to-date and the signed variance use the existing methodology, no upcoming label, the baseline block stays, the forecast counts the actual once', async () => {
  const r = await run(remP, { w: W20, today: AT20 });
  assert.equal(r.basis.state, 'ok'); assert.equal(r.basis.actualToDate, direct(W20, '2026-11-07', AT20)); assert.ok(r.basis.actualToDate < bl.actualToCutoff / 5, 'not the 6 Nov baseline');
  assert.equal(r.basis.reportingCutoff, AT20); assert.equal(r.basis.remaining.days, 41);
  const planned = T * (14 / 30) * (1 / 1.8) ; // 14 of November's 24 days… in the equal profile: weight 24/30 for the month ⇒ planned to 20 Nov = (14/30)/1.8 of the target
  assert.ok(near(r.basis.plannedToDate, planned, 5), `${r.basis.plannedToDate} vs ${planned}`);
  assert.ok(near(r.measures.deviation.amount, r.basis.actualToDate - r.basis.plannedToDate, 1e-6)); assert.ok(near(r.measures.vsPlanRatio, r.basis.actualToDate / r.basis.plannedToDate, 1e-12)); assert.ok(near(r.measures.achievementToDate, r.basis.actualToDate / T, 1e-12));
  assert.equal(r.forecast.state, 'ok'); assert.notEqual(r.forecast.upcoming, true); assert.ok(near(r.forecast.forecastTotal, r.basis.actualToDate + r.forecast.monthlyRate * (10 / 30 + 31 / 31), 1e-2));
  const t = text(render(E(PlanSummary, { measures: r.measures, view: r.view, plan: remP, basis: r.basis })));
  assert.ok(!t.includes('قادمة') && t.includes('المحصّل حتى 20 نوفمبر 2026') && t.includes('الأساس حتى 6 نوفمبر 2026'), t.slice(0, 600));
  const rq = r.basis.pace.required; assert.ok(near(rq.daily, r.basis.remainingTarget / 41, 1e-6));
  const sc = scheduleRows(r.basis); assert.equal(sc.hasActual, true); assert.equal(sc.rows[0].actual, r.basis.actualToDate); assert.equal(sc.rows[1].actual, null);
  assert.equal(JSON.stringify(remP.content.baseline), JSON.stringify(bl), 'the frozen baseline is untouched');
});

/* ================================================================== C. the notified budget */
const MINISTRY_SCOPE = { kind: 'ministry' };
const totalExp = appropriationKeys().reduce((t, k) => t + appropriationOf(k, 2026).expAdjusted, 0);
await ok('year of the SELECTED plan, never today\'s date: full-year 2026 and remaining-2026 → the 2026 budget; 2027 → unavailable (never 0, never the 2026 figure); a period spanning two years → unavailable; an explicit year wins', () => {
  globalThis.__DEMO_TODAY__ = '2027-03-01';
  try {
    const a = notifiedBudgetFor({ view: annualP.content ? U.viewOf(annualP, annualC) : null }); const r = notifiedBudgetFor({ view: U.viewOf(remP, remP.content) }); const y27 = notifiedBudgetFor({ view: U.viewOf(p27, c27) });
    assert.deepEqual([a.state, a.year, a.amount], ['ok', 2026, totalExp]); assert.equal(a.amount, appropriationTotal().expAdjusted); assert.ok(a.includesHeadquarters);
    assert.deepEqual([r.state, r.year, r.amount], ['ok', 2026, totalExp], 'the remaining plan uses the SAME annual 2026 budget'); assert.notEqual(r.amount, T, 'distinct from the collection target'); assert.notEqual(a.amount, annualC.target.amount);
    assert.deepEqual([y27.state, y27.year, y27.amount, y27.reason], ['unavailable', 2027, null, 'no_budget_for_year']); assert.notEqual(y27.amount, 0);
    assert.notEqual(y27.amount, c27.target.basis.budget, 'the carried-forward assumption is NOT a 2027 notified budget');
    const span = notifiedBudgetFor({ view: { period: { start: '2026-07-01', end: '2027-06-30' }, scope: MINISTRY_SCOPE } }); assert.deepEqual([span.state, span.reason, span.amount], ['unavailable', 'period_spans_years', null]);
    assert.equal(notifiedBudgetFor({ view: U.viewOf(annualP, annualC), year: 2027 }).state, 'unavailable'); assert.equal(budgetYearOf({ start: '2026-11-07', end: '2026-12-31' }), 2026); assert.equal(budgetYearOf({ start: '2026-12-01', end: '2027-01-31' }), null);
  } finally { delete globalThis.__DEMO_TODAY__; }
});
await ok('labels: «الميزانية المبلّغة لعام 2026» / "Notified budget 2026"; the remaining plan says it is the FULL-YEAR 2026 budget, not a Nov–Dec budget, never prorated nor replaced by the remaining requirement; 2027 → «الميزانية المبلّغة غير متوفرة»', () => {
  const a = notifiedBudgetFor({ view: U.viewOf(annualP, annualC) }); const r = notifiedBudgetFor({ view: U.viewOf(remP, remP.content) }); const y = notifiedBudgetFor({ view: U.viewOf(p27, c27) });
  assert.deepEqual([a.label.ar, a.label.en], ['الميزانية المبلّغة لعام 2026', 'Notified budget 2026']); assert.equal(r.label.ar, 'الميزانية المبلّغة لعام 2026'); assert.ok(r.annualOfPartYear === true && a.annualOfPartYear === false);
  assert.ok(/ميزانية سنة 2026 الكاملة، وليست ميزانية فترة الخطة؛ لا تُجزَّأ ولا تُستبدل بالمتبقي من المستهدف/.test(r.subLabel.ar) && /full-year 2026 budget, not a budget of the plan period; it is never prorated or replaced by the remaining requirement/.test(r.subLabel.en));
  assert.equal(y.label.ar, 'الميزانية المبلّغة غير متوفرة'); assert.equal(y.label.en, 'Notified budget not available');
  for (const lang of ['ar', 'en']) {
    const ta = text(render(E(NotifiedBudget, { budget: r }), lang)); assert.ok(ta.includes(lang === 'ar' ? 'الميزانية المبلّغة لعام 2026' : 'Notified budget 2026') && ta.includes('2026') && /32[.,]7/.test(ta), `${lang}: ${ta}`);
    const hy = render(E(NotifiedBudget, { budget: y }), lang); assert.ok(text(hy).includes(lang === 'ar' ? 'الميزانية المبلّغة غير متوفرة' : 'Notified budget not available') && !hy.includes('plan-notified-budget-value'), `${lang}: no value element for an unavailable budget`);
    const inSummary = text(render(E(PlanSummary, { measures: R.measures, view: R.view, plan: remP, basis: R.basis, budget: r }), lang)); assert.equal((inSummary.match(lang === 'ar' ? /الميزانية المبلّغة لعام 2026/g : /Notified budget 2026/g) || []).length, 1, `${lang}: ONE compact figure inside the summary — no duplicate section`);
  }
});
await ok('entity scope + permissions: Amanah view = that Amanah; municipality → unavailable; a restricted viewer = Σ of their visible entities («إجمالي الجهات المتاحة لك», no headquarters); distinct entity keys (no double count); a missing entity budget → unavailable, never 0; the headquarters only in the all-entities Ministry total', () => {
  const v = U.viewOf(annualP, annualC);
  const ry = notifiedBudgetFor({ view: v, viewScope: { amanah: RY, muni: 'all' } }); assert.deepEqual([ry.state, ry.amount, ry.entityKeys], ['ok', appropriationOf(RY, 2026).expAdjusted, [RY]]); assert.equal(ry.includesHeadquarters, false);
  const mu = notifiedBudgetFor({ view: v, viewScope: { amanah: JD, muni: 'MREF-002-001' } }); assert.deepEqual([mu.state, mu.reason, mu.amount], ['unavailable', 'municipality', null]); assert.equal(mu.label.ar, 'الميزانية المبلّغة غير متوفرة على مستوى البلدية');
  const rs = notifiedBudgetFor({ view: v, entityKeys: [RY, JD] }); assert.equal(rs.amount, appropriationOf(RY, 2026).expAdjusted + appropriationOf(JD, 2026).expAdjusted); assert.equal(rs.restricted, true); assert.equal(rs.scopeLabel.ar, 'إجمالي الجهات المتاحة لك'); assert.ok(!rs.entityKeys.includes(HQ_KEY));
  const dup = notifiedBudgetFor({ view: { period: annualC.period, scope: { kind: 'entities', entityKeys: [RY, RY, JD] } } }); assert.equal(dup.amount, rs.amount, 'duplicated keys count once'); assert.equal(dup.includesHeadquarters, false);
  const noHq = notifiedBudgetFor({ view: { period: annualC.period, scope: { kind: 'entities', entityKeys: appropriationKeys().filter((k) => k !== HQ_KEY) } } }); assert.equal(noHq.amount, totalExp - appropriationOf(HQ_KEY, 2026).expAdjusted, 'an all-entities ENTITY plan has no headquarters budget');
  const full = notifiedBudgetFor({ view: v }); assert.equal(full.amount, totalExp); assert.ok(full.includesHeadquarters);
  const viewerKeys = notifiedBudgetFor({ view: v, entityKeys: [RY], viewScope: { amanah: JD, muni: 'all' } }); assert.equal(viewerKeys.state, 'unavailable', 'an Amanah the viewer cannot see'); assert.equal(viewerKeys.amount, null);
  const miss = notifiedBudgetFor({ view: { period: annualC.period, scope: { kind: 'entities', entityKeys: [RY, 'Unassigned Entity'] } } }); assert.deepEqual([miss.state, miss.reason, miss.amount, miss.missing], ['unavailable', 'missing_entity_budget', null, ['Unassigned Entity']]);
  const none = notifiedBudgetFor({ view: { period: annualC.period, scope: { kind: 'entities', entityKeys: [] } } }); assert.equal(none.state, 'unavailable');
  const mo = notifiedBudgetFor({ view: v, entityKeys: [JD], municipalOnlyKeys: [JD], viewScope: { amanah: JD, muni: 'all' } }); assert.deepEqual([mo.state, mo.reason, mo.amount], ['unavailable', 'municipal_only', null], 'a municipal-only viewer never gets the whole Amanah budget');
  assert.equal(notifiedBudgetFor({ view: v, entityKeys: [RY, JD], municipalOnlyKeys: [JD] }).amount, appropriationOf(RY, 2026).expAdjusted);
  // switching plans: each plan reads its own year and scope
  assert.deepEqual([annualP, remP, p27].map((p) => notifiedBudgetFor({ view: U.viewOf(p, p.content) }).year), [2026, 2026, 2027]);
});
await ok('summary of the 2027 plan shows «الميزانية المبلّغة غير متوفرة» inside the same summary (no duplicate section, no zero), and the full-year summary shows the 2026 amount with the year', () => {
  for (const lang of ['ar', 'en']) {
    const b27 = notifiedBudgetFor({ view: R27.view }); const t27 = text(render(E(PlanSummary, { measures: R27.measures, view: R27.view, plan: p27, basis: R27.basis, budget: b27 }), lang));
    assert.ok(t27.includes(lang === 'ar' ? 'الميزانية المبلّغة غير متوفرة' : 'Notified budget not available') && t27.includes('2027')); assert.ok(!/الميزانية المبلّغة لعام|Notified budget 2027/.test(t27));
    const bA = notifiedBudgetFor({ view: RA.view }); const tA = text(render(E(PlanSummary, { measures: RA.measures, view: RA.view, plan: annualP, basis: RA.basis, budget: bA }), lang)); assert.ok(tA.includes(lang === 'ar' ? 'الميزانية المبلّغة لعام 2026' : 'Notified budget 2026') && /32[.,]7/.test(tA), `${lang}: ${tA.slice(-300)}`);
  }
});
await ok('exports: the report model\'s plan context carries «الميزانية المبلّغة لعام <year>: amount» of the reference plan\'s year (or the unavailable text) — only next to the plan chip; restricted viewers get the Σ of their entities', () => {
  const tgt = (period, extra = {}) => ({ reference: { state: 'ok', period, planScopeKind: 'ministry' }, viewScope: { amanah: 'all', muni: 'all' }, scopeEntityKeys: undefined, planEntityKeys: null, ...extra });
  const a = notifiedBudgetChip(tgt(annualC.period), { lang: 'ar' }); assert.equal(a.label, 'الميزانية المبلّغة لعام 2026'); assert.ok(/32[.,]7/.test(a.value), a.value);
  const aEn = notifiedBudgetChip(tgt(annualC.period), { lang: 'en' }); assert.equal(aEn.label, 'Notified budget 2026');
  const r = notifiedBudgetChip(tgt(remP.content.period), { lang: 'ar' }); assert.equal(r.label, 'الميزانية المبلّغة لعام 2026'); assert.ok(r.value.includes('ميزانية سنة 2026 الكاملة'), 'a part-year plan says it is the annual budget');
  const u = notifiedBudgetChip(tgt(c27.period), { lang: 'ar' }); assert.equal(u.label, 'الميزانية المبلّغة غير متوفرة'); assert.ok(u.value.includes('2027') && !/\d{2}[.,]\d.*مليار/.test(u.value));
  const rs = notifiedBudgetChip(tgt(annualC.period, { scopeEntityKeys: [RY, JD] }), { lang: 'ar' }); assert.ok(rs.value.includes('إجمالي الجهات المتاحة لك'));
  const mu = notifiedBudgetChip(tgt(annualC.period, { viewScope: { amanah: JD, muni: 'MREF-002-001' } }), { lang: 'ar' }); assert.equal(mu.label, 'الميزانية المبلّغة غير متوفرة على مستوى البلدية');
  assert.equal(notifiedBudgetChip({ reference: { state: 'none' } }), null);
  const base = { lang: 'ar', snapshot: { cutoff: TODAY }, snapshotMeta: null, labelOfAmanah: (k) => k, labelOfMuni: (k) => k, prevScope: null, compare: 'none', access: null };
  const spec = { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', muni: 'all', source: 'all', status: 'all' } };
  const withPlan = contextChips(spec, { ...base, planTarget: 'الخطة المرجعية: خطة', budgetChip: a }); assert.deepEqual(withPlan.filter((c) => c.k === 'plan' || c.k === 'budget').map((c) => c.k), ['plan', 'budget']);
  assert.equal(contextChips(spec, { ...base, planTarget: null, budgetChip: a }).some((c) => c.k === 'budget'), false, 'no budget chip when no target figure is part of the report');
  const src = fs.readFileSync('src/data/reportModel.js', 'utf8'); assert.ok(/notifiedBudgetChip\(targets/.test(src));
});
await ok('page wiring (source scan): the page computes the budget from the SELECTED plan view + view scope + the viewer\'s entities, passes it to the ONE summary, loads the upcoming history, and renders the shared schedule section; no «today» enters the budget', () => {
  const pg = fs.readFileSync('src/pages/PlanDetail.jsx', 'utf8');
  assert.ok(/notifiedBudgetFor\(\{ view, viewScope, entityKeys, municipalOnlyKeys/.test(pg) && /<PlanSummary measures=\{measures\} view=\{view\} plan=\{plan\} basis=\{basis\} budget=\{budget\} \/>/.test(pg) && /upcomingHistory: true/.test(pg) && /<PlanScheduleSection basis=\{basis\} \/>/.test(pg));
  const nb = fs.readFileSync('src/data/plans/notifiedBudget.js', 'utf8').replace(/\/\/.*$/gm, ''); assert.ok(!/clock|DEMO_TODAY|new Date|Date\.now/.test(nb), 'the budget year never comes from the clock');
  const sections = fs.readFileSync('src/components/plans/PlanSections.jsx', 'utf8'); assert.equal((sections.match(/id="plan-notified-budget"/g) || []).length, 1, 'ONE budget element definition');
  assert.ok(!/المقبوض|مقبوض|Najiz/.test(nb + sections));
});
console.log(`plans remaining + notified budget: ${n} test groups passed`);
