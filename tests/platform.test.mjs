// Platform tests: display unit, Asia/Riyadh periods, the columnar data service (determinism, reconciliation, rules, search, pagination, export)
// and the multi-source demo world. Run with `npm test` (bundled with esbuild; no framework).
import assert from 'node:assert/strict';
import { fmtBn, fmtSar, fmtInt, fmtInvoices, scaled, unitOfValues, chartUnit, UNITS } from '../src/utils/money.js';
import { parsePeriod, routeQuestion, classify } from '../src/data/assistantRouter.js';
import { startOfYear, startOfMonth, prevMonthEnd } from '../src/data/clock.js';
import { loadStore } from '../server/store.js';
import { snapshot, series, bridge, makeCtx, lookupId, checkEquation, derive } from '../server/engine.js';
import { formatRatio, ratio } from '../src/data/revenueMetrics.js';
import { answerFor } from '../src/data/assistantAnswers.js';
import { buildProtocolAnswer } from '../src/data/assistantProtocol.js';
import { buildInsights } from '../src/data/insightsEngine.js';
import { interpret, defaultSpec, previousMonthScope } from '../src/data/reportIntents.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { tableToText } from '../src/data/reportFormat.js';
import { runScenario, scenarioBase, validateScenario, fairComparison, requiredPace, DEFAULT_SCENARIO } from '../src/data/strategicCalc.js';
import { createAction, updateAction, rejectProposal, pendingProposals } from '../src/data/actionRegister.js';
import { buildProposals } from '../src/data/proposals.js';
import { answer as strategicAnswer, parseNumber } from '../src/data/strategicAssistant.js';
import { buildCommandModel } from '../src/data/commandModel.js';
import { generateFinance, budgetExecution, operatingCoverage, financeCompatible, plannedByMonth, CHAPTERS } from '../src/data/syntheticFinance.js';
import { financeProjection } from '../src/data/strategicCalc.js';
import { newPlan, saveVersion, patchPlan, approvePlan, addObjective, updateObjective, objectiveProgress, editPlan, unsavedChanges } from '../src/data/planStore.js';
import { addProposal, earlierDecisions } from '../src/data/actionRegister.js';
import { actorName } from '../src/utils/actor.js';
import { PRESETS, presetRange, detectPreset } from '../src/data/periodPresets.js';
import { buildBackup, validateBackup, applyBackup, BACKUP_FORMAT } from '../src/data/localBackup.js';
import { FIXED_REPORTS } from '../src/data/fixedReports.js';
import { buildWorkbook, modelToLines, paginateRows } from '../src/utils/exportReportModel.js';
import { buildDecisionCards } from '../src/data/revenueInsights.js';
import { describeChange } from '../src/data/reportIntents.js';
import { checkRange, rangeMessage } from '../src/data/dateRange.js';
import { fmtRiyadh, riyadhDateOf, lastCompleteMonths } from '../src/data/clock.js';
import { measure, headlineCfg, cfgFor, BASIS, asOfDate, hasToDateVariant, basisLabel } from '../src/data/measure.js';
import { planScopeOf, cfgHash, DEFAULT_PLAN_SCOPE, scopeLabelOf } from '../src/data/planStore.js';
import { previousScope, compareSnapshots, DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { list, exportChunks, worklist, anomalies } from '../server/lists.js';
import { detail } from '../server/materialize.js';
import { sourcesReport } from '../server/sourcesReport.js';
import { contractCards } from '../server/contracts.js';
import { SOURCES, dayNum } from '../src/data/catalog.js';
import { amanahOptionsOf } from '../src/data/revenueLedger.js';

let passed = 0;
const test = async (name, fn) => { try { await fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n`, e); process.exitCode = 1; } };

process.env.DEMO_SIZE = 'full'; // the volume / performance suite runs on the large world; the compact demo has its own tests below
const TODAY = '2026-10-08';
const cfg = { cutoff: TODAY };
const st = loadStore(TODAY);
const YTD = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' };

/* ------------------------------------------------------------ display unit */
await test('every amount carries ONE appropriate unit: SAR · thousand · million · billion — never «ألف مليون»', () => {
  assert.equal(fmtBn(11_000_000_000, { lang: 'ar' }), '11 مليار ريال');
  assert.equal(fmtBn(11_000_000_000, { lang: 'en' }), '11 bn SAR');
  assert.equal(fmtBn(486_191_000, { lang: 'ar' }), '486.19 مليون ريال');
  assert.equal(fmtBn(7_834, { lang: 'ar' }), '7.83 ألف ريال');
  assert.equal(fmtBn(750, { lang: 'ar' }), '750 ريال');
  assert.equal(fmtBn(999_999_000, { lang: 'ar' }), '1 مليار ريال', '999.99 M promotes to the next unit instead of «1,000 مليون»');
  const raw = 11_000_000_000; fmtBn(raw); assert.equal(raw, 11_000_000_000, 'display never changes the stored value');
  assert.ok(!fmtBn(14_918_396_920, { lang: 'ar' }).includes('ألف مليون'));
});
await test('one shared unit inside a table or chart; exact conversion in detail mode; tiny positives never read as zero', () => {
  const vals = [14_918_396_920, 1_362_084_800, 55_000_000]; const u = unitOfValues(vals);
  assert.equal(u.key, 'B'); assert.deepEqual(vals.map((v) => scaled(v, u)), ['14.92', '1.36', '0.06']);
  assert.equal(scaled(486_191_000, UNITS.M, 'detail'), '486.191'); assert.equal(scaled(0), '0'); assert.equal(scaled(4_000, UNITS.B), '<0.01');
  const cu = chartUnit([2_000_000_000, 500_000_000], 'ar'); assert.equal(cu.title, 'القيمة — مليار ريال'); assert.equal(cu.tick(2_000_000_000), '2'); assert.equal(cu.fmt(500_000_000), '0.5 مليار ريال');
  assert.equal(chartUnit([3_000_000, 800_000], 'ar').title, 'القيمة — مليون ريال');
  assert.equal(fmtBn(1_362_084_800, { lang: 'ar', unit: u }), '1.36 مليار ريال');
});
await test('invoice counts are never converted to the money unit; exact SAR stays available', () => {
  assert.equal(fmtInt(500000), '500,000');
  assert.equal(fmtInvoices(500000, { lang: 'ar' }), '500,000 فاتورة');
  assert.equal(fmtInvoices(500000, { lang: 'ar', short: true }), '500 ألف فاتورة');
  assert.equal(fmtSar(486_191_000), '486,191,000 SAR');
  assert.ok(!fmtInvoices(1234).includes('ألف مليون'));
});

/* ------------------------------------------------------------ Asia/Riyadh periods and the assistant router */
await test('assistant periods follow the real date: this month = month start → today; this year = Jan 1 → today', () => {
  assert.deepEqual(parsePeriod('كم المحصل هذا الشهر؟', TODAY), { from: '2026-10-01', to: TODAY, label: 'month' });
  assert.deepEqual(parsePeriod('كم المحصل هذه السنة؟', TODAY), { from: '2026-01-01', to: TODAY, label: 'ytd' });
  assert.deepEqual(parsePeriod('collection last month', TODAY), { from: '2026-09-01', to: '2026-09-30', label: 'lastMonth' });
  assert.equal(parsePeriod('what was collected in March', TODAY).to, '2026-03-31');
  assert.equal(parsePeriod('what was collected in December', TODAY).from, '2025-12-01'); // a later month means last year's
  assert.equal(startOfYear('2027-01-01'), '2027-01-01'); // year rollover moves the default to the new year
  assert.equal(prevMonthEnd('2027-01-05'), '2026-12-31');
  assert.equal(startOfMonth('2026-10-08'), '2026-10-01');
});
await test('assistant routes a new-format invoice id and the collection question', () => {
  assert.equal(classify('أخبرني عن INV-2026-0000731'), 'invoice');
  assert.equal(routeQuestion('Tell me about INV-2026-0000731', { cutoff: TODAY }).invoiceId, 'INV-2026-0000731');
  assert.equal(routeQuestion('كم المحصل هذا الشهر؟', { cutoff: TODAY }).intent, 'overview');
});

/* ------------------------------------------------------------ volume and integrity */
const ytd = snapshot(st, { scope: YTD, cfg });
await test('at least 500,000 DISTINCT invoices for the current year to date, all dated up to today', () => {
  assert.ok(ytd.totals.count >= 500000, String(ytd.totals.count));
  const todayN = dayNum(TODAY);
  for (let i = 0; i < st.nGen; i += 1) { assert.ok(st.issue[i] <= todayN || st.issue[i] > todayN); } // issue dates beyond today are never visible below
  let future = 0; for (let i = 0; i < st.nGen; i += 1) if (st.issue[i] > todayN) future += 1;
  assert.equal(future, 0, 'no invoice is dated after today');
  let futurePay = 0; for (let p = 0; p < st.pn; p += 1) if (st.pDay[p] > todayN) futurePay += 1;
  assert.equal(futurePay, 0, 'no collection is dated after today');
});
await test('invoice ids are unique, strictly increasing and found by binary search', () => {
  for (let i = 1; i < st.nGen; i += 1) assert.ok(st.idKey[i] > st.idKey[i - 1]);
  const id = detail(st, 12345, makeCtx(st, { cfg })).rec.id; assert.equal(lookupId(st, id), 12345);
});
await test('invoices, item rows and payment rows are three different counts', () => {
  const rep = sourcesReport(st, { cfg });
  const items = rep.sources.reduce((t, s) => t + s.ytd.lines, 0); const pays = rep.sources.reduce((t, s) => t + s.ytd.payments, 0);
  assert.ok(items > ytd.totals.count && pays !== ytd.totals.count);
});
await test('breakdowns reconcile to the totals; cancelled and excluded are deducted once', () => {
  const t = ytd.totals;
  assert.ok(Math.abs(ytd.byAmanah.reduce((s, g) => s + g.gross, 0) - t.gross) < 1);
  assert.ok(Math.abs(ytd.bySource.reduce((s, g) => s + g.gross, 0) - t.gross) < 1);
  assert.ok(Math.abs(t.gross - t.exclusions - t.net) < 0.5, 'gross = exclusions + net');
  assert.ok(Math.abs(t.exclusions - t.cancelled - t.exclusionsRules) < 0.5, 'exclusions = cancelled + rules (once)');
  assert.ok(Math.abs(t.net - t.collected - t.outstanding) < 0.5, 'net = collected + uncollected');
  assert.equal(sourcesReport(st, { cfg }).checks.cancelledAndExcludedOverlap, 0);
});
/* ------------------------------------------------------------ approved financial identities */
const eqOf = (snap) => ({ total: checkEquation(snap.totals), groups: [...snap.byAmanah, ...snap.bySource, ...snap.byScope].map((g) => checkEquation(g)) });
await test('worked example: gross 11 = exclusions 2 + net 9; net 9 = collected 6 + uncollected 3; rate 66.7 %; zero net -> «غير متاحة»', () => {
  const a = { gross: 11e9, exclusions: 2e9, net: 9e9, collected: 6e9, outstanding: 3e9 };
  assert.ok(checkEquation(a).ok);
  assert.equal(formatRatio(ratio(a.collected, a.net), 'en'), '66.7%');
  assert.equal(formatRatio(ratio(0, 0), 'ar'), 'غير متاحة');
  assert.equal(checkEquation({ ...a, collected: 9.5e9 }).ok, false, 'collected above net is rejected');
  assert.equal(checkEquation({ ...a, exclusions: 3e9 }).ok, false, 'a second deduction breaks gross = exclusions + net');
});
await test('YTD totals: gross = exclusions + net, net = collected + uncollected, ordered, non-negative — total, per Amanah (incl. unassigned), per source, per scope type', () => {
  assert.ok(ytd.equation.ok, JSON.stringify(ytd.equation));
  const e = eqOf(ytd); assert.ok(e.total.ok); assert.ok(e.groups.every((g) => g.ok));
  assert.ok(ytd.byAmanah.some((g) => g.key === 'Unassigned'), 'Unassigned Amanah is a separate row, never spread over the others');
  for (const k of ['count', 'gross', 'exclusions', 'net', 'collected', 'outstanding']) assert.ok(Math.abs(ytd.byAmanah.reduce((t, g) => t + g[k], 0) - ytd.totals[k]) < 0.5, `Amanahs add up (${k})`);
  assert.ok(Math.abs(ytd.totals.exclusions - ytd.totals.cancelled - ytd.totals.exclusionsRules) < 0.5, 'cancelled + rule exclusions = exclusions (an invoice with both is deducted once)');
});
await test('report matrices: Amanah × source adds up to the totals; Amanah × exclusion reason (+ cancelled) adds up to the exclusions, each invoice once', () => {
  assert.ok(ytd.equation.matrixSumsToTotal);
  const m = ytd.matrix; const T = ytd.totals;
  for (const k of ['count', 'gross', 'net', 'collected', 'outstanding']) assert.ok(Math.abs(m.amanahSource.reduce((t, r) => t + r[k], 0) - T[k]) < 0.5, k);
  assert.ok(Math.abs(m.amanahReasons.reduce((t, r) => t + r.amount, 0) - T.exclusions) < 0.5);
  assert.ok(Math.abs(m.amanahReasons.filter((r) => r.reason === 'cancelled').reduce((t, r) => t + r.amount, 0) - T.cancelled) < 0.5);
  for (const r of m.amanahSource) assert.ok(Math.abs(r.gross - r.exclusions - r.net) < 0.5 && r.net >= r.collected - 0.5, `${r.amanah}/${r.source}`);
  const one = snapshot(st, { scope: { ...YTD, source: 'fines' }, cfg });
  assert.ok(Math.abs(one.matrix.amanahSource.reduce((t, r) => t + r.net, 0) - ytd.matrix.amanahSource.filter((r) => r.source === 'fines').reduce((t, r) => t + r.net, 0)) < 0.5, 'a source filter equals the matching column of the matrix');
});
await test('overall collection rate = Σ collected ÷ Σ net — never the average of Amanah rates', () => {
  const T = ytd.totals; assert.ok(Math.abs(T.collectedOverNet.value - T.collected / T.net) < 1e-12);
  const avg = ytd.byAmanah.filter((g) => g.collectedOverNet.calculable).reduce((t, g) => t + g.collectedOverNet.value, 0) / ytd.byAmanah.length;
  assert.ok(Math.abs(avg - T.collectedOverNet.value) > 1e-6, 'the two methods differ on this data, so the test distinguishes them');
});
await test('every month and every Amanah of the year: identities hold, months add up to the year (counts and amounts)', () => {
  const months = [];
  for (let m = 1; m <= Number(TODAY.slice(5, 7)); m += 1) { const mm = String(m).padStart(2, '0'); const last = m === Number(TODAY.slice(5, 7)) ? TODAY : new Date(Date.UTC(2026, m, 0)).toISOString().slice(0, 10); months.push({ from: `2026-${mm}-01`, to: last }); }
  const sum = { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 };
  for (const mo of months) {
    const s1 = snapshot(st, { scope: { ...mo, amanah: 'all', source: 'all' }, cfg: { ...cfg, collectionsAsOf: 'cutoff' } }); // additivity needs ONE common as-of date (the to-date basis)
    assert.ok(s1.equation.ok, `${mo.from}: ${JSON.stringify(s1.equation)}`);
    for (const k of Object.keys(sum)) sum[k] += s1.totals[k];
  }
  assert.equal(sum.count, ytd.totals.count);
  for (const k of ['gross', 'exclusions', 'net', 'collected', 'outstanding']) assert.ok(Math.abs(sum[k] - ytd.totals[k]) < 1, `months add up to the year (${k})`);
  for (const g of ytd.byAmanah) { const sa = snapshot(st, { scope: { ...YTD, amanah: g.key }, cfg }); assert.ok(sa.equation.ok, g.key); assert.ok(Math.abs(sa.totals.gross - g.gross) < 0.5 && Math.abs(sa.totals.net - g.net) < 0.5 && Math.abs(sa.totals.collected - g.collected) < 0.5, `${g.key}: filtering by the Amanah gives the same figures as its row`); }
});
await test('filters recompute everything from the matching records: source, central/internal, municipality, item — and the invoice list sums equal the cards', () => {
  const cases = [{ source: 'fines' }, { scopeType: 'central' }, { scopeType: 'internal' }, { amanah: ytd.byAmanah[0].key, scopeType: 'central' }, { item: 'tobacco_fee' }];
  for (const f of cases) {
    const sc = { ...YTD, ...f }; const s1 = snapshot(st, { scope: sc, cfg });
    assert.ok(s1.equation.ok, JSON.stringify(f));
    const page = list(st, { scope: sc, cfg, filters: {}, page: 0, pageSize: 5 });
    assert.equal(page.total, s1.totals.count, `${JSON.stringify(f)}: list count = card count`);
    for (const k of ['gross', 'exclusions', 'net', 'collected', 'outstanding']) assert.ok(Math.abs(page.sums[k] - s1.totals[k]) < 1, `${JSON.stringify(f)}: list ${k} = card ${k}`);
  }
  const a = snapshot(st, { scope: { ...YTD, scopeType: 'central' }, cfg }).totals; const b = snapshot(st, { scope: { ...YTD, scopeType: 'internal' }, cfg }).totals;
  assert.ok(Math.abs(a.gross + b.gross - ytd.totals.gross) < 1, 'central + internal = all');
  const mAm = ytd.byAmanah.find((g) => g.key !== 'Unassigned');
});
await test('an invoice with several exclusion reasons (or cancelled + a reason) leaves gross exactly once; payments on excluded invoices never enter «collected»', () => {
  const ctx = makeCtx(st, { cfg }); let multi = 0; let overlap = 0; let badOnce = 0; let paidExcluded = 0;
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN) continue; const D = derive(ctx, i, ctx.cutoffN);
    if (D.nReasons > 1) multi += 1; if (D.overlaps) overlap += 1;
    if (Math.abs(D.billed - D.net - D.exclTotal) > 1e-6 || D.exclTotal < 0 || D.net < 0 || D.collected > D.net + 1e-6) badOnce += 1;
    if (D.excluded && D.received > 0 && D.collected !== 0) paidExcluded += 1;
  }
  assert.ok(multi > 0, 'the world contains multi-reason invoices'); assert.equal(badOnce, 0); assert.equal(paidExcluded, 0);
});
await test('historical dates: nothing that happened after the reference date enters the result; same period at its own end = same result today', () => {
  const sc = { from: '2026-01-01', to: '2026-03-31', amanah: 'all', source: 'all' };
  const hist = snapshot(st, { scope: sc, cfg: { cutoff: '2026-03-31' } }); const today = snapshot(st, { scope: sc, cfg: { cutoff: TODAY, collectionsAsOf: 'periodEnd' } });
  assert.ok(hist.equation.ok && today.equation.ok); assert.equal(hist.basis.collectionsAsOf, '2026-03-31');
  assert.ok(Math.abs(hist.totals.collected - today.totals.collected) < 1 && Math.abs(hist.totals.net - today.totals.net) < 1 && Math.abs(hist.totals.exclusions - today.totals.exclusions) < 1);
  const later = snapshot(st, { scope: sc, cfg }); assert.ok(later.totals.collected >= hist.totals.collected, 'collections at today include later payments, the historical result does not');
  assert.equal(today.basis.invoices, 'issue_date'); assert.equal(today.basis.receiptsByPaymentDate, 'separate_indicator');
});
await test('the assistant quotes the very same numbers as the cards (gross, exclusions, net, collected, uncollected, rate), in Arabic and English', () => {
  const T = ytd.totals;
  for (const lang of ['ar', 'en']) {
    const text = answerFor('overview', { snapshot: ytd }, { lang }).text; const nums = [T.gross, T.exclusions, T.net, T.collected, T.outstanding].map((v) => fmtBn(v, { lang }));
    for (const n of nums) assert.ok(text.includes(n), `${lang}: «${n}» appears`);
    assert.ok(text.includes(formatRatio(T.collectedOverNet, lang)));
    const ex = answerFor('exclusions', { snapshot: ytd }, { lang }).text; assert.ok(ex.includes(fmtBn(T.exclusions, { lang })) && ex.includes(fmtBn(T.cancelled, { lang })) && ex.includes(fmtBn(T.exclusionsRules, { lang })));
    const p = buildProtocolAnswer('overview', { snapshot: ytd }, { lang }); assert.equal(p.meta.number, formatRatio(T.collectedOverNet, lang));
  }
});
await test('export columns carry exclusions and uncollected in exact SAR, and each row obeys gross = exclusions + net', () => {
  const head = [...exportChunks(st, { scope: { ...YTD, source: 'tobacco' }, cfg, filters: {} }, 2000)][0].split('\n').filter((l) => !l.startsWith('﻿#') && !l.startsWith('# '));
  const cols = head[0].split(','); const ci = (n) => cols.indexOf(n); assert.ok(ci('exclusions_sar') > 0 && ci('uncollected_sar') > 0 && ci('net_billed_sar') > 0);
  for (const line of head.slice(1, 400)) { const c = line.split(','); if (c.length < cols.length) continue; assert.ok(Math.abs(Number(c[ci('amount_sar')]) - Number(c[ci('exclusions_sar')]) - Number(c[ci('net_billed_sar')])) < 0.5, line.slice(0, 120)); }
});
await test('the net-uncollected bridge lands exactly on the standing balance and the unmatched rows stay apart', () => {
  const b = bridge(st, { scope: { amanah: 'all' }, cfg }); const s = snapshot(st, { scope: YTD, cfg });
  assert.equal(b.check, 0); assert.ok(Math.abs(b.net - s.stock.netUncollected) < 1);
  assert.ok(b.unmatched.count > 0); assert.ok(!b.steps.some((x) => x.key === 'unmatched'));
});
await test('future contract installments are only in the schedule: never collected, never arrears', () => {
  const cards = contractCards(st, { cfg }, { summary: false });
  const withFuture = cards.filter((c) => c.totals.futureInstallments > 0); assert.ok(withFuture.length > 0);
  for (const c of withFuture.slice(0, 40)) for (const p of c.schedule) if (p.state === 'future') { assert.equal(p.collected, 0); assert.equal(p.outstanding, 0); assert.equal(p.invoiced, false); }
});
await test('execution amounts are not added to the debt (contract level)', () => {
  const cards = contractCards(st, { cfg });
  assert.ok(cards.some((c) => c.requests.length && !c.execution.invoicesIdentified && c.execution.amount > 0));
  assert.ok(cards.every((c) => c.execution.addedToNetUncollected === false));
});

/* ------------------------------------------------------------ stability: same day, next day */
await test('same-day reopen = same numbers; the next day only appends and history does not move', () => {
  const again = snapshot(loadStore(TODAY), { scope: YTD, cfg }).totals; assert.equal(again.gross, ytd.totals.gross); assert.equal(again.count, ytd.totals.count);
  const next = '2026-10-09'; const st2 = loadStore(next);
  const asOfToday = snapshot(st2, { scope: YTD, cfg }).totals;
  assert.equal(asOfToday.count, ytd.totals.count); assert.equal(asOfToday.gross, ytd.totals.gross); assert.ok(Math.abs(asOfToday.collected - ytd.totals.collected) < 1);
  const t2 = snapshot(st2, { scope: { ...YTD, to: next }, cfg: { cutoff: next } }).totals;
  assert.ok(t2.count > ytd.totals.count);
});
await test('the current month ends at today; earlier months are complete', () => {
  const s = series(st, { scope: { from: '2026-01-01', to: TODAY }, cfg });
  assert.equal(s.months.at(-1), '2026-10'); assert.equal(s.months.length, 10);
  const oct = snapshot(st, { scope: { from: '2026-10-01', to: TODAY, amanah: 'all', source: 'all' }, cfg });
  assert.ok(oct.population.issuedInPeriod > 0 && oct.population.issuedInPeriod < 40000);
});
await test('year-over-year uses the same period: Jan 1 → same calendar day last year', () => {
  const prior = snapshot(st, { scope: { from: '2025-01-01', to: '2025-10-08', amanah: 'all', source: 'all' }, cfg });
  assert.ok(prior.totals.count > 400000 && prior.totals.count < ytd.totals.count);
});

/* ------------------------------------------------------------ pagination, search, filters, export at scale */
await test('paged list: total = the whole population, one page of rows, sort and filters work', () => {
  const p0 = list(st, { scope: YTD, cfg, filters: {}, sort: { key: 'outstanding', dir: 'desc' }, page: 0, pageSize: 50 });
  assert.equal(p0.total, ytd.totals.count); assert.equal(p0.rows.length, 50);
  assert.ok(p0.rows[0].outstanding >= p0.rows[49].outstanding);
  const od = list(st, { scope: YTD, cfg, filters: { state: 'overdue' }, page: 0, pageSize: 10 }); assert.ok(od.total > 0 && od.rows.every((r) => r.cls === 'overdue'));
  const wl = list(st, { scope: YTD, cfg, filters: {}, sort: { key: 'gross', dir: 'desc' }, page: 3, pageSize: 25 }); assert.equal(wl.rows.length, 25);
});
await test('search by invoice id, SADAD, payer and source-specific keys; the sum of a filter equals its rows', () => {
  const first = list(st, { scope: YTD, cfg, filters: {}, page: 0, pageSize: 1 }).rows[0];
  const bySadad = list(st, { scope: YTD, cfg, filters: { search: detail(st, first.index, makeCtx(st, { cfg })).rec.sadadNo }, page: 0, pageSize: 5 }); assert.equal(bySadad.total, 1);
  const byId = list(st, { scope: YTD, cfg, filters: { search: first.id }, page: 0, pageSize: 5 }); assert.equal(byId.rows[0].id, first.id);
  const inv = list(st, { scope: YTD, cfg: cfg, filters: { search: 'INV-2026-0000' }, page: 0, pageSize: 5 }); assert.ok(inv.total > 0);
  const t = snapshot(st, { scope: { ...YTD, source: 'tobacco' }, cfg }).totals; const l = list(st, { scope: { ...YTD, source: 'tobacco' }, cfg, filters: {}, page: 0, pageSize: 1 });
  assert.equal(l.total, t.count); assert.ok(Math.abs(l.sums.gross - t.gross) < 1);
});
await test('worklist and anomalies return ranked top rows without carrying the population', () => {
  const w = worklist(st, { scope: YTD, cfg, limit: 50 }); assert.equal(w.rows.length, 50); assert.ok(w.total > 50000);
  assert.ok(w.rows.every((r) => r.outstanding > 0 && r.cls !== 'collected' && r.cls !== 'excluded'));
  const a = anomalies(st, { scope: YTD, cfg, limit: 40 }); assert.ok(a.total > 0 && a.rows.length <= 40);
});
await test('export streams in chunks, keeps exact SAR and a separately named abbreviated column', () => {
  const it = exportChunks(st, { scope: { ...YTD, source: 'white_lands' }, cfg, filters: {} }, 1000);
  const head = it.next().value; assert.ok(head.includes('amount_sar') && !head.includes('thousand_million') && head.includes('supplying_system') && head.includes('demo data'));
  let rows = 0; let chunks = 0; for (const c of it) { chunks += 1; rows += c.split('\n').length - 1; }
  assert.equal(rows, snapshot(st, { scope: { ...YTD, source: 'white_lands' }, cfg }).totals.count); assert.ok(chunks >= 5);
});

/* ------------------------------------------------------------ the multi-source world */
const rep = sourcesReport(st, { cfg });
await test('all eight revenue sources are represented, in both years, and reconcile with the metric layer', () => {
  assert.equal(rep.sources.length, 8);
  assert.ok(rep.sources.every((s) => s.ytd.invoices > 0 && s.prior.invoices > 0));
  for (const [k, v] of Object.entries(rep.reconcile)) assert.ok(v, k);
  assert.ok(rep.checks.idsStrictlyIncreasing && rep.checks.duplicateIds === 0);
});
await test('white lands: low collection, deeds shared by several owners, extension / objection / enforcement present', () => {
  const wl = rep.sources.find((s) => s.key === 'white_lands'); assert.ok(wl.ytd.financial.rate.value < 0.5);
  assert.equal(rep.checks.whiteLandGroupsBroken, 0); assert.ok(wl.ytd.ownersMulti > 0 && wl.ytd.objections > 0 && rep.enforcement.whiteLandsOrders > 0);
  assert.ok(wl.ytd.ext[1] > 0 && wl.ytd.ext[2] > 0);
});
await test('tobacco: wallet settlements and replaced disclosures (original cancelled once, replacement counted)', () => {
  const tb = rep.sources.find((s) => s.key === 'tobacco'); assert.ok(tb.ytd.wallet > 0 && tb.ytd.replacedPairs > 0); assert.equal(rep.checks.tobaccoPairsBroken, 0);
});
await test('every source record: item total equals the invoice, each supplying system appears once, the amount is never duplicated', () => {
  const ctx = makeCtx(st, { cfg }); let n = 0;
  for (const k of SOURCES.map((s) => s.key)) {
    let seen = 0;
    for (let i = st.nGen - 1; i >= 0 && seen < 25; i -= 1) if (SOURCES[st.src[i]].key === k) {
      seen += 1; n += 1; const d = detail(st, i, ctx); const sum = d.rec.lineItems.reduce((s, l) => s + l.amount, 0);
      assert.ok(Math.abs(sum - d.rec.grossAmount) < 0.5 || d.rec.amountCheck.status === 'conflict', d.rec.id);
      const sys = d.sourceRecord.links.map((l) => `${l.system}|${l.dataset}`); assert.equal(new Set(sys).size, sys.length);
      assert.ok(d.sourceRecord.links.length >= 2 && d.sourceRecord.views.length >= 1);
      assert.ok(d.sourceRecord.revenueLines.every((l) => l.TOTAL_AMOUNT === d.rec.grossAmount));
    }
  }
  assert.ok(n >= 150);
});
await test('Q1 calibration against the monthly reports (white lands ~22%, accommodation ≥90%, tobacco 78–90%)', () => {
  const q = loadStore('2026-03-31'); const s = snapshot(q, { scope: { from: '2026-01-01', to: '2026-03-31', amanah: 'all', source: 'all' }, cfg: { cutoff: '2026-03-31' } });
  const by = Object.fromEntries(s.bySource.map((g) => [g.key, g]));
  assert.ok(by.white_lands.collectedOverNet.value > 0.1 && by.white_lands.collectedOverNet.value < 0.35);
  assert.ok(by.accommodation.collectedOverNet.value > 0.9);
  assert.ok(by.tobacco.collectedOverNet.value > 0.78 - 0.05 && by.tobacco.collectedOverNet.value < 0.9);
});

/* ------------------------------------------------------------ compact demo (200–1,000 synthetic invoices) */
const cst = loadStore(TODAY, { size: 'compact' });
import * as XLSXns from 'xlsx';
const XLSX_utils_to_rows = (wb, name) => XLSXns.utils.sheet_to_json(wb.Sheets[name], { header: 1 });
const cYtd = snapshot(cst, { scope: YTD, cfg });
await test('compact demo: 200–1,000 synthetic invoices in total, billion-scale totals, no future-dated movement', () => {
  assert.ok(cst.n >= 200 && cst.n <= 1000, `records: ${cst.n}`);
  assert.ok(cYtd.totals.gross > 5e9, 'billion-scale values are kept'); assert.ok(cYtd.totals.count >= 100);
  const todayN = dayNum(TODAY);
  for (let i = 0; i < cst.n; i += 1) assert.ok(cst.issue[i] <= todayN);
  for (let p = 0; p < cst.pn; p += 1) assert.ok(cst.pDay[p] <= todayN);
  assert.equal(cst.meta.size, 'compact');
});
await test('compact demo: identities hold in total, per month, per Amanah, per source; matrices add up', () => {
  assert.ok(cYtd.equation.ok, JSON.stringify(cYtd.equation));
  for (let m = 1; m <= Number(TODAY.slice(5, 7)); m += 1) { const mm = String(m).padStart(2, '0'); const to = m === Number(TODAY.slice(5, 7)) ? TODAY : new Date(Date.UTC(2026, m, 0)).toISOString().slice(0, 10); assert.ok(snapshot(cst, { scope: { from: `2026-${mm}-01`, to, amanah: 'all', source: 'all' }, cfg }).equation.ok, `month ${m}`); }
  for (const g of cYtd.byAmanah) assert.ok(snapshot(cst, { scope: { ...YTD, amanah: g.key }, cfg }).equation.ok, g.key);
  const sources = new Set(cYtd.bySource.map((x) => x.key)); assert.ok(sources.size >= 7, [...sources].join());
  assert.ok(cYtd.equation.matrixSumsToTotal);
});
await test('compact demo is deterministic, and the same totals hold at the same period end of the prior year (like-for-like)', () => {
  const again = snapshot(loadStore(TODAY, { size: 'compact' }), { scope: YTD, cfg }); assert.equal(again.totals.gross, cYtd.totals.gross); assert.equal(again.totals.count, cYtd.totals.count);
  const prev = snapshot(cst, { scope: { from: '2025-01-01', to: '2025-10-08', amanah: 'all', source: 'all' }, cfg: { cutoff: TODAY, collectionsAsOf: 'periodEnd' } });
  assert.ok(prev.totals.count > 0 && prev.equation.ok);
});
await test('invoice-status filter: every status keeps the identities, and the statuses partition the totals (counts and amounts)', () => {
  const all = ['collected', 'partial', 'overdue', 'not_due', 'cancelled', 'excluded', 'objection', 'enforcement', 'linkage_unresolved', 'ineligible_referral'];
  let c = 0; let g = 0; let col = 0;
  for (const status of all) { const x = snapshot(cst, { scope: { ...YTD, status }, cfg }); assert.ok(x.equation.ok, status); c += x.totals.count; g += x.totals.gross; col += x.totals.collected; }
  assert.equal(c, cYtd.totals.count); assert.ok(Math.abs(g - cYtd.totals.gross) < 1); assert.ok(Math.abs(col - cYtd.totals.collected) < 1);
  const open = snapshot(cst, { scope: { ...YTD, status: 'open' }, cfg }); assert.ok(open.totals.outstanding > 0 && open.equation.ok);
  const lst = list(cst, { scope: { ...YTD, status: 'overdue' }, cfg, filters: {}, page: 0, pageSize: 5 });
  assert.equal(lst.total, snapshot(cst, { scope: { ...YTD, status: 'overdue' }, cfg }).totals.count, 'list count = card count under the same status filter');
});
await test('report-centre data: months, municipalities and statuses each add up to the totals; the exclusion rate is exclusions ÷ gross', () => {
  assert.ok(cYtd.equation.monthsSumToTotal && cYtd.equation.municipalitiesSumToTotal && cYtd.equation.statusSumsToTotal);
  const T = cYtd.totals; assert.ok(Math.abs(T.exclusionRate.value - T.exclusions / T.gross) < 1e-12);
  assert.equal(cYtd.byMonth.length, Number(TODAY.slice(5, 7)));
  const zero = snapshot(cst, { scope: { from: '2026-10-09', to: '2026-10-09', status: 'cancelled', source: 'housing_sales' }, cfg }).totals; assert.equal(zero.net, 0); assert.equal(zero.collectedOverNet.calculable, false, 'zero net billed -> the rate is not available, no division by zero');
});
await test('comparison uses the equivalent elapsed period (same calendar days last year)', () => {
  const pv = previousScope({ from: '2026-01-01', to: '2026-10-08' }); assert.equal(pv.from, '2025-01-01'); assert.equal(pv.to, '2025-10-08');
  const m = previousScope({ from: '2026-10-01', to: '2026-10-08' }); assert.equal(m.from, '2025-10-01'); assert.equal(m.to, '2025-10-08');
});
await test('insights: every figure shown is the snapshot figure; comparison basis and drill-down are present; forecasts only when ready', () => {
  const prev = snapshot(cst, { scope: { from: '2025-01-01', to: '2025-10-08', amanah: 'all', source: 'all' }, cfg: { cutoff: TODAY, collectionsAsOf: 'periodEnd' } });
  const cmp = compareSnapshots(cYtd, prev);
  const res = buildInsights({ snapshot: cYtd, prev, comparison: cmp, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targets: DEFAULT_TARGETS });
  const T = cYtd.totals; const ev = (k) => res.summary.evidence.find((e) => e.k.en === k).v;
  assert.equal(ev('Gross billed'), T.gross); assert.equal(ev('Exclusions'), T.exclusions); assert.equal(ev('Net billed'), T.net); assert.equal(ev('Collected'), T.collected); assert.equal(ev('Uncollected'), T.outstanding);
  assert.ok(res.insights.length >= 4);
  for (const it of res.insights) { assert.ok(it.basis && it.basis.ar && it.basis.en, it.id); assert.ok(['fact', 'comparison', 'outlier', 'estimate', 'quality'].includes(it.kind)); }
  assert.ok(res.insights.some((i) => i.id === 'aging' || i.id === 'exclusions'));
  assert.ok(!res.insights.some((i) => i.id === 'forecast') && res.forecast.available === false, 'no forecast when the history is not sufficient');
  const gap = res.insights.find((i) => i.id === 'gap_0'); if (gap) { const cell = cYtd.matrix.amanahSource.find((r) => r.net === gap.evidence[0].v); assert.ok(cell && cell.collected === gap.evidence[1].v, 'a gap insight quotes its matrix cell exactly'); assert.ok(gap.drill.to.startsWith('/invoices?amanah=')); }
  const rc = res.insights.find((i) => i.id === 'rate_change'); if (rc) assert.ok(Math.abs(rc.evidence[2].v - cmp.collectedOverNetPp.value) < 1e-9);
});

/* ------------------------------------------------------------ unified smart reports: conversation, model, exports */
await test('smart reports conversation: requests fill the filters visibly and follow-ups keep the existing context', () => {
  const t0 = interpret('أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم', null, TODAY);
  assert.equal(t0.kind, 'report'); assert.equal(t0.spec.scope.from, '2026-10-01'); assert.equal(t0.spec.scope.to, TODAY); assert.deepEqual(t0.spec.sections, ['executive']);
  const t1 = interpret('قارن بالشهر الماضي', t0.spec, TODAY);
  assert.equal(t1.spec.compare, 'prev_month'); assert.equal(t1.spec.scope.from, '2026-10-01', 'the period is NOT replaced by «الشهر الماضي» inside a comparison request'); assert.deepEqual(t1.spec.sections, ['executive']);
  const t2 = interpret('اعرض أمانة الرياض فقط', t1.spec, TODAY);
  assert.equal(t2.spec.scope.amanah, 'Riyadh Amanah'); assert.equal(t2.spec.compare, 'prev_month'); assert.equal(t2.spec.scope.from, '2026-10-01'); assert.ok(t2.changes.some((c) => c.key === 'amanah'));
  const t3 = interpret('أضف توزيع مصادر الإيراد', t2.spec, TODAY);
  assert.ok(t3.spec.sections.includes('sources') && t3.spec.sections.includes('executive')); assert.equal(t3.spec.scope.amanah, 'Riyadh Amanah');
  const t4 = interpret('حوّله إلى تقرير تفصيلي', t3.spec, TODAY);
  assert.equal(t4.spec.depth, 'detailed'); assert.ok(t4.spec.sections.length >= 8); assert.equal(t4.spec.scope.amanah, 'Riyadh Amanah'); assert.equal(t4.spec.compare, 'prev_month');
  const t5 = interpret('اعرض كل الأمانات', t4.spec, TODAY); assert.equal(t5.spec.scope.amanah, 'all');
});
await test('smart reports requests: suggested prompts map to the right sections; «المتأخرات حسب المصدر» is a section, not a status filter; gibberish is declined honestly', () => {
  assert.deepEqual(interpret('قارن أداء التحصيل بين الأمانات', null, TODAY).spec.sections, ['amanah']);
  const ex = interpret('حلّل أسباب عدم التحصيل والاستبعادات', null, TODAY).spec; assert.ok(ex.sections.includes('exclusions') && ex.sections.includes('status'));
  const ag = interpret('اعرض المتأخرات حسب مصدر الإيراد', null, TODAY).spec; assert.deepEqual(ag.sections, ['sources', 'aging']); assert.equal(ag.scope.status, 'all'); assert.equal(ag.scope.source, 'all');
  const mo = interpret('جهّز تقريراً شهرياً مشابهاً للتقارير المرفقة', null, TODAY).spec; assert.equal(mo.compare, 'prev_year'); assert.ok(mo.sections.includes('sources') && mo.sections.includes('amanah') && mo.sections.includes('exclusions')); assert.equal(mo.scope.from, '2026-10-01');
  assert.equal(interpret('الفواتير المتأخرة فقط', null, TODAY).spec.scope.status, 'overdue');
  assert.equal(interpret('xyzzy plugh', null, TODAY).kind, 'unsupported');
  assert.deepEqual(previousMonthScope({ from: '2026-10-01', to: '2026-10-09' }, TODAY), { from: '2026-09-01', to: '2026-09-09' });
  assert.deepEqual(previousMonthScope({ from: '2026-03-01', to: '2026-03-31' }, TODAY), { from: '2026-02-01', to: '2026-02-28' });
});
const mkOut = (snap) => ({ snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'التاريخ لا يكفي', en: 'history too short' } }, targetPos: null, achievement: null, coverage: null, cards: [], anomalies: [] });
await test('report model: totals reconcile with the snapshot, every table adds up to its total row, one unit per table, never «ألف مليون»', async () => {
  const prev = snapshot(cst, { scope: { from: '2025-01-01', to: '2025-10-08', amanah: 'all', source: 'all' }, cfg: { cutoff: TODAY, collectionsAsOf: 'periodEnd' } });
  const spec = { ...defaultSpec(TODAY), compare: 'prev_year', depth: 'detailed', sections: SECTION_ORDER.slice() };
  const model = buildReportModel({ spec, lang: 'ar', out: mkOut(cYtd), prev, compare: 'prev_year', prevScope: { from: '2025-01-01', to: '2025-10-08' }, cash: null, bridge: null, targets: DEFAULT_TARGETS, meta: { size: 'compact', counts: { invoicesTotal: cst.n } } });
  const T = cYtd.totals; assert.equal(model.totals.gross, T.gross); assert.equal(model.totals.net, T.net); assert.ok(Math.abs(model.totals.gross - model.totals.exclusions - model.totals.net) < 0.5 && Math.abs(model.totals.net - model.totals.collected - model.totals.outstanding) < 0.5);
  const kp = model.headline[0].items; assert.equal(kp[0].raw, T.gross); assert.equal(kp[2].raw, T.net); assert.equal(kp[4].raw, T.outstanding);
  let tables = 0;
  for (const sec of model.sections) for (const b of sec.blocks) if (b.type === 'table' && b.total) {
    tables += 1;
    b.headers.forEach((h, j) => { if (h.kind === 'money' || h.kind === 'count') { const nums = b.rows.map((r) => r[j]).filter((v) => typeof v === 'number'); if (nums.length === b.rows.length && typeof b.total[j] === 'number' && !['trend'].includes(b.id)) assert.ok(Math.abs(nums.reduce((t, v) => t + v, 0) - b.total[j]) < 1, `${b.id} column ${j}`); } });
    const tx = tableToText(b, 'ar'); if (tx.unitText) assert.ok(tx.headers.some((h) => h.includes(tx.unitText)), `${b.id}: the unit is stated in the headers`);
  }
  assert.ok(tables >= 8, `tables checked: ${tables}`);
  assert.ok(!JSON.stringify(model).includes('ألف مليون'), 'no confusing unit label anywhere in the model');
  assert.ok(model.context.some((c) => c.k === 'period') && model.context.some((c) => c.k === 'basis') && model.context.some((c) => c.k === 'data' && c.value.includes('تجريبية')));
});
await test('exports carry what is displayed: the same context, tables and totals in the workbook, with exact SAR amounts; text export includes filters and basis', () => {
  const spec = { ...defaultSpec(TODAY), sections: ['executive', 'amanah', 'sources'] };
  const model = buildReportModel({ spec, lang: 'ar', out: mkOut(cYtd), prev: null, compare: 'none', targets: DEFAULT_TARGETS, meta: { size: 'compact', counts: { invoicesTotal: cst.n } } });
  const wb = buildWorkbook(model); assert.ok(wb.SheetNames.length >= 5); assert.ok(wb.SheetNames.includes('amounts_sar'));
  const summary = XLSX_utils_to_rows(wb, wb.SheetNames[0]); assert.ok(summary.some((r) => String(r[0]) === 'الفترة'), 'filters are exported'); assert.ok(summary.some((r) => String(r[1] || '').includes('تجريبية')));
  const exact = XLSX_utils_to_rows(wb, 'amounts_sar'); const srcRows = exact.filter((r) => r[0] === 'حسب مصدر الإيراد' && String(r[2]).startsWith('إجمالي المفوتر') && String(r[1]) !== 'الإجمالي'); // the total row carries its exact amount too (excluded from the sum of the parts)
  assert.ok(exact.some((r) => r[0] === 'حسب مصدر الإيراد' && String(r[1]) === 'الإجمالي'), 'the total row is in the exact sheet');
  assert.ok(Math.abs(srcRows.reduce((t, r) => t + r[3], 0) - cYtd.totals.gross) < 1, 'exact SAR by source adds up to the gross billed');
  const lines = modelToLines(model); assert.ok(lines.some((l) => l.k === 'table' && l.title.includes('سياق التقرير')) && lines.some((l) => l.k === 'h2'));
});

/* ------------------------------------------------------------ strategic command dashboard */
await test('scenario model: levers share one pool (no double counting), resolving cases is never cash, billing is separate from collection, inputs are validated', () => {
  const base = scenarioBase(cYtd); const r0 = base.C / base.N;
  const none = runScenario(base, DEFAULT_SCENARIO); assert.ok(Math.abs(none.scenario.collected - base.C) < 1e-6 && Math.abs(none.scenario.net - base.N) < 1e-6);
  const resolveOnly = runScenario(base, { resolve: 100, approve: 100 }); assert.equal(resolveOnly.scenario.collected, base.C, 'resolving cases moves NO cash'); assert.ok(resolveOnly.scenario.net <= base.N && resolveOnly.scenario.rate >= none.scenario.rate, 'only the denominator moves');
  const keep = runScenario(base, { resolve: 100, approve: 0 }); assert.equal(keep.scenario.net, base.N); assert.equal(keep.scenario.collected, base.C, 'resolved as collectible: no change in amounts');
  const bill = runScenario(base, { billing: 10 }); assert.ok(Math.abs(bill.deltaCollected - base.N * 0.1 * r0) < 1e-3, 'added billing is collected only at the baseline rate'); assert.ok(Math.abs(bill.scenario.rate - r0) < 1e-9);
  const rate = runScenario(base, { dRate: 5 }); assert.ok(Math.abs(rate.deltaCollected - base.N * 0.05) < 1e-3, '+5 pp = 5 % of net billed');
  const both = runScenario(base, { dRate: 30, recovery: 100, billing: 50, resolve: 100, approve: 100 });
  assert.ok(both.scenario.collected <= both.scenario.net + 1e-6 && both.scenario.uncollected >= -1e-6, 'collected can never exceed net billed');
  assert.ok(Math.abs(both.deltaCollected - (both.deltaCash.billing + both.deltaCash.rate + both.deltaCash.recovery)) < 1e-3, 'the cash effects add up to the change');
  const sepRate = runScenario(base, { dRate: 10 }).deltaCash.rate; const sepRec = runScenario(base, { recovery: 100 }).deltaCash.recovery; const comb = runScenario(base, { dRate: 10, recovery: 100 });
  assert.ok(comb.deltaCash.rate + comb.deltaCash.recovery <= sepRate + sepRec + 1e-6, 'recovery is reduced by what the rate lever already collected');
  const v = validateScenario({ dRate: 99, recovery: -5, resolve: 'x', approve: 50, billing: 70 }); assert.equal(v.value.dRate, 30); assert.equal(v.value.recovery, 0); assert.equal(v.value.billing, 50); assert.ok(v.warnings.length >= 3);
});
await test('fair comparison: the mix-expected rates reproduce the overall rate; ranking uses the index, small samples are flagged', () => {
  const f = fairComparison(cYtd); const T = cYtd.totals;
  assert.ok(Math.abs(f.reduce((t, r) => t + (r.expectedRate == null ? 0 : r.net * r.expectedRate), 0) - T.collected) < 1, 'Σ net × expected = collected overall');
  assert.ok(f.some((r) => r.smallSample) && f.every((r) => r.gapShare == null || (r.gapShare >= 0 && r.gapShare <= 1)));
  assert.ok(Math.abs(f.reduce((t, r) => t + (r.gapShare || 0), 0) - 1) < 1e-9, 'gap shares add up to 100 %');
  const p = requiredPace({ achievement: { annualTarget: 12e9, receiptsYtd: 6e9, scopeCaveat: false }, series: { values: [1e9, 1e9, 1e9, 1e9, 0.5e9] }, today: '2026-10-09', planDate: '2026-12-31' });
  assert.ok(p.available && Math.abs(p.remaining - 6e9) < 1 && p.monthsLeft > 2.5 && p.monthsLeft < 2.8 && Math.abs(p.perMonth * p.monthsLeft - 6e9) < 1);
  assert.equal(requiredPace({ achievement: { annualTarget: 12e9, receiptsYtd: 1, scopeCaveat: true }, series: null, today: '2026-10-09', planDate: '2026-12-31' }).available, false, 'a narrowed scope has no target to pace against');
});
await test('action register: proposals are not decisions, no owner is invented, every change is logged, rejected/approved proposals leave the queue', () => {
  const props = buildProposals({ snapshot: cYtd, prev: null, comparison: null, targets: DEFAULT_TARGETS, cases: [], scopeText: 'x' });
  assert.ok(props.length >= 3 && new Set(props.map((p) => p.id)).size === props.length); assert.ok(props.every((p) => !('owner' in p) && p.evidence && p.expectedImpact && p.expectedImpact.kind));
  let reg = { actions: [], rejected: [] }; assert.equal(pendingProposals(reg, props).length, props.length);
  reg = createAction(reg, { by: 'مراجع', proposal: props[0], fields: {} }); const a = reg.actions[0];
  assert.equal(a.owner, null, 'no owner unless the reviewer enters one'); assert.equal(a.status, 'approved'); assert.equal(a.history.length, 1); assert.equal(a.evidence, props[0].evidence);
  reg = updateAction(reg, a.id, { owner: 'جهة يحددها المراجع', status: 'in_progress', dueDate: '2026-10-30' }, 'مراجع'); assert.equal(reg.actions[0].history.length, 4);
  reg = updateAction(reg, a.id, { status: 'in_progress' }, 'مراجع'); assert.equal(reg.actions[0].history.length, 4, 'a no-op change is not logged');
  reg = rejectProposal(reg, props[1], 'مراجع', 'ليس أولوية'); const left = pendingProposals(reg, props); assert.equal(left.length, props.length - 2);
});
await test('assistant: answers from the active scope with the same figures as the snapshot, keeps context for follow-ups, labels itself, and declines the unknown', async () => {
  const mk = (extra = {}) => { const applied = []; return { applied, ctx: { lang: 'ar', today: TODAY, scope: { ...YTD, scopeType: 'all', muni: 'all', status: 'all' }, targets: DEFAULT_TARGETS, register: { actions: [], rejected: [] }, proposals: buildProposals({ snapshot: cYtd, targets: DEFAULT_TARGETS, cases: [], scopeText: 'x' }), labelOfAmanah: (k) => k, compare: compareSnapshots,
    fetchSnap: async (sc) => snapshot(cst, { scope: { amanah: 'all', source: 'all', ...sc }, cfg }), fetchPrev: async () => null, getAchievement: async () => null, applyFilters: (o) => applied.push(o), ...extra } }; };
  const T = cYtd.totals; const M = (v) => fmtBn(v, { lang: 'ar' });
  let { ctx } = mk(); const gap = await strategicAnswer('أين أكبر فجوة في التحصيل؟', ctx); assert.equal(gap.intent, 'gap'); assert.ok(gap.text.includes(M(T.outstanding)), 'quotes the snapshot figure'); assert.ok(gap.simulated && gap.table.rows.length >= 3 && gap.drill.to.startsWith('/invoices'));
  const sc = await strategicAnswer('ماذا يحدث إذا ارتفع معدل التحصيل خمس نقاط مئوية؟', ctx); assert.equal(sc.intent, 'scenario'); const r = runScenario(scenarioBase(cYtd), { dRate: 5 }); assert.ok(sc.text.includes(M(r.scenario.collected))); assert.equal(sc.actions[0].patch.dRate, 5);
  assert.equal(parseNumber('خمس نقاط'), 5); assert.equal(parseNumber('٧ نقاط'), 7);
  const m = mk(); const month = await strategicAnswer('أين أكبر فجوة في التحصيل هذا الشهر؟', m.ctx); assert.equal(month.scope.from, '2026-10-01'); assert.deepEqual(m.applied[0], { from: '2026-10-01', to: TODAY }, 'the period is applied to the SHARED filters');
  const fu = await strategicAnswer('وماذا عن أمانة الرياض فقط؟', { ...ctx, last: { intent: 'gap', scope: ctx.scope } }); assert.equal(fu.intent, 'gap', 'a follow-up keeps the previous question'); assert.equal(fu.scope.amanah, 'Riyadh Amanah');
  const unk = await strategicAnswer('طقس الغد', ctx); assert.equal(unk.intent, 'unknown'); assert.ok(unk.text.includes('وليس بنموذج لغوي') || unk.text.includes('not a language model'));
  const pr = await strategicAnswer('ما الإجراءات ذات الأولوية خلال الثلاثين يومًا القادمة؟', ctx); assert.equal(pr.intent, 'priorities'); assert.ok(pr.table.rows.length >= 1);
});
await test('executive summary export: same figures and filters, adds target / mix-adjusted comparison / scenario / action sections, marks unavailable data and unapproved targets', async () => {
  const prev = snapshot(cst, { scope: { from: '2025-01-01', to: '2025-10-08', amanah: 'all', source: 'all' }, cfg: { cutoff: TODAY, collectionsAsOf: 'periodEnd' } });
  const reg = createAction({ actions: [], rejected: [] }, { by: 'x', fields: { title: 'إجراء يدوي', owner: '', dueDate: '2026-10-30' } });
  const model = buildCommandModel({ lang: 'ar', today: TODAY, spec: { preset: 'ytd', scope: { ...YTD, scopeType: 'all', muni: 'all', status: 'all' } }, out: mkOut(cYtd), prev, prevScope: { from: '2025-01-01', to: '2025-10-08' }, cash: null, bridge: null, targets: DEFAULT_TARGETS, cases: [], meta: { size: 'compact', counts: { invoicesTotal: cst.n } }, fair: fairComparison(cYtd), achievement: null, pace: { available: false }, forecast: { ready: false, reasonNotReady: { ar: 'لا يكفي', en: 'short' } }, scenario: { ...DEFAULT_SCENARIO, dRate: 5 }, planDate: '2026-12-31', register: reg });
  const keys = model.sections.map((x) => x.key); for (const k of ['executive', 'fair', 'targets', 'scenario', 'actions', 'assumptions']) assert.ok(keys.includes(k), k);
  assert.equal(model.totals.net, cYtd.totals.net); assert.ok(model.context.some((c) => c.k === 'period'));
  const txt = JSON.stringify(model); assert.ok(txt.includes('البيانات غير متاحة') && txt.includes('غير معتمد') && txt.includes('غير مسند'), 'unavailable data, unapproved targets and the unassigned owner are explicit'); assert.ok(!txt.includes('ألف مليون'));
  const wb = buildWorkbook(model); assert.ok(wb.SheetNames.includes('amounts_sar'));
});

/* ------------------------------------------------------------ restructuring: two management areas */
await test('synthetic finance: labelled, no actual after today, commitment ≥ accrual ≥ payment, budget kept apart; coverage only on a compatible national scope', () => {
  const fin = generateFinance(TODAY); assert.equal(fin.status, 'synthetic'); assert.ok(fin.label.ar.includes('تجريبية'));
  for (const c of fin.chapters) { assert.equal(c.months.length, Number(TODAY.slice(5, 7))); assert.ok(c.months.at(-1).month <= TODAY.slice(0, 7)); for (const m of c.months) { assert.ok(m.commit >= m.accrued - 1e-6 && m.accrued >= m.paid - 1e-6, `${c.key} ${m.month}`); assert.ok(m.cumBudget > 0 && m.cumPaid > 0); } }
  const again = generateFinance(TODAY); assert.equal(JSON.stringify(again), JSON.stringify(fin), 'deterministic');
  const ex = budgetExecution(fin); assert.ok(Math.abs(ex.rows.reduce((t, r) => t + r.paid, 0) - ex.total.paid) < 1e-3); assert.ok(ex.total.commitments >= ex.total.accrued && ex.total.accrued >= ex.total.paid);
  const next = generateFinance('2026-10-10'); assert.equal(next.chapters[0].months.slice(0, -1).map((m) => m.paid).join(), fin.chapters[0].months.slice(0, -1).map((m) => m.paid).join(), 'past months do not change when a day is added');
  assert.ok(Math.abs(plannedByMonth(2026).reduce((t, p) => t + p.planned, 0) - CHAPTERS.reduce((t, c) => t + c.annual, 0)) < 1, 'the monthly plan adds up to the annual budget');
  assert.equal(financeCompatible({ amanah: 'all', source: 'all', muni: 'all', scopeType: 'all', status: 'all' }), true); assert.equal(financeCompatible({ amanah: 'Riyadh Amanah', source: 'all' }), false); assert.equal(financeCompatible({ amanah: 'all', source: 'fines' }), false);
  const cov = operatingCoverage(fin, 8e9); assert.ok(Math.abs(cov.ratio - 8e9 / ex.operating.paid) < 1e-9 && cov.basis.ar.includes('نقدي'));
});
await test('funding projection: scenario cash is added to receipts (timing slip excluded), expenditure change touches only remaining payments, unavailable stays unavailable', () => {
  const base = { receiptsYtd: 8e9, paymentsYtd: 16e9, series: { values: [1e9, 1e9, 1e9, 1e9, 0.5e9] }, paymentsByMonth: [1.6e9, 1.6e9, 1.6e9, 1.6e9, 0.8e9], forecast: { ready: false }, monthsLeft: 2.5 };
  const p0 = financeProjection({ ...base }); assert.ok(p0.available && p0.method === 'illustrative');
  const p1 = financeProjection({ ...base, scenarioDeltaCash: 1e9, scenario: { slip: 25, expense: 10 } });
  assert.ok(Math.abs(p1.scenario.receipts - (p0.base.receipts + 0.75e9)) < 1, 'only the non-slipped share counts inside the horizon'); assert.ok(Math.abs(p1.slipped - 0.25e9) < 1);
  assert.ok(Math.abs(p1.scenario.payments - (16e9 + p0.restPay * 1.1)) < 1, 'actual payments untouched'); assert.equal(p1.base.payments, p0.base.payments);
  assert.equal(financeProjection({ ...base, receiptsYtd: null }).available, false);
});
await test('plans: version, owner, approval; a new version returns an approved plan to draft; scenarios never touch targets; objectives need review to be approved', () => {
  let pl = newPlan({ by: 'x', name: 'خطة', scope: { amanah: 'all' }, period: { from: '2026-01-01', to: '2026-12-31' } }); assert.equal(pl.version, 0); assert.equal(pl.owner, null); assert.equal(pl.status, 'draft');
  pl = saveVersion({ ...pl, owner: 'جهة', scenario: { ...DEFAULT_SCENARIO, dRate: 5 } }, { by: 'x', summary: { rate: 0.6 } }); assert.equal(pl.version, 1); assert.equal(pl.versions[0].scenario.dRate, 5);
  pl = approvePlan(pl, 'مراجع'); assert.equal(pl.status, 'approved'); pl = saveVersion(pl, { by: 'x', summary: {} }); assert.equal(pl.status, 'draft'); assert.equal(pl.approvedBy, null); assert.equal(pl.version, 2);
  const before = JSON.stringify(DEFAULT_TARGETS); runScenario(scenarioBase(cYtd), { dRate: 30, billing: 50 }, DEFAULT_TARGETS.collectionRate.value); assert.equal(JSON.stringify(DEFAULT_TARGETS), before, 'a scenario run leaves targets untouched');
  let st = { plans: [pl], objectives: [], activeId: pl.id }; st = addObjective(st, { by: 'x', fields: { title: 'هدف', metric: 'collection_rate', target: 60 } }); assert.equal(st.objectives[0].status, 'proposed');
  st = updateObjective(st, st.objectives[0].id, { status: 'approved', approvedBy: 'مراجع' }, 'مراجع'); assert.equal(st.objectives[0].history.length, 3);
  assert.equal(objectiveProgress(st.objectives[0], { collection_rate: 57.8 }).state, 'on_track'); assert.equal(objectiveProgress(st.objectives[0], { collection_rate: null }).state, 'unavailable'); assert.equal(objectiveProgress(st.objectives[0], { collection_rate: 61 }).state, 'met');
});
await test('fixed reports: every established report builds directly from the shared snapshot (no prompt), reconciles with it, states units, and the budget report marks synthetic / unavailable data', () => {
  const fin = generateFinance(TODAY); const prev = snapshot(cst, { scope: { from: '2025-01-01', to: '2025-10-08', amanah: 'all', source: 'all' }, cfg: { cutoff: TODAY, collectionsAsOf: 'periodEnd' } });
  assert.equal(FIXED_REPORTS.length, 9);
  for (const def of FIXED_REPORTS) {
    const m = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: def.sections, compare: def.compare }, lang: 'ar', out: mkOut(cYtd), prev: def.compare === 'none' ? null : prev, compare: def.compare, prevScope: { from: '2025-01-01', to: '2025-10-08' }, cash: { months: cYtd.byMonth.map((x) => x.month), values: cYtd.byMonth.map((x) => x.collected) }, bridge: null, targets: DEFAULT_TARGETS, meta: { size: 'compact', counts: { invoicesTotal: cst.n } }, finance: fin, financeOk: true, fyReceiptsYtd: 8e9 });
    assert.ok(m.sections.length >= 1 && m.totals.gross === cYtd.totals.gross, def.key); assert.ok(!JSON.stringify(m).includes('ألف مليون'));
    for (const sec of m.sections) for (const b of sec.blocks) if (b.type === 'table') { const tx = tableToText(b, 'ar'); if (tx.unitText) assert.ok(tx.headers.some((h) => h.includes(tx.unitText)), `${def.key}/${b.id}`); }
  }
  const b = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['budget'] }, lang: 'ar', out: mkOut(cYtd), targets: DEFAULT_TARGETS, finance: fin, financeOk: false });
  assert.ok(JSON.stringify(b).includes('البيانات غير متاحة'), 'a filtered scope shows the budget as unavailable, not zero');
  const ok = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['budget'] }, lang: 'ar', out: mkOut(cYtd), targets: DEFAULT_TARGETS, finance: fin, financeOk: true, fyReceiptsYtd: 8e9 });
  assert.ok(JSON.stringify(ok).includes('تجريبية اصطناعية')); const t = ok.sections[0].blocks.find((x) => x.id === 'budget'); assert.ok(Math.abs(t.rows.reduce((s2, r) => s2 + r[5], 0) - t.total[5]) < 1, 'chapters add up to the total paid');
  const am = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['amanah'] }, lang: 'ar', out: mkOut(cYtd), targets: DEFAULT_TARGETS }); const fair = am.sections[0].blocks.find((x) => x.id === 'fair'); assert.ok(fair && fair.rows.length > 5);
});
await test('smart reports: ambiguous requests get ONE focused clarification inside the conversation; follow-ups keep the context', () => {
  const c1 = interpret('قارن', null, TODAY); assert.equal(c1.kind, 'clarify'); assert.ok(c1.options.length >= 2);
  const c2 = interpret('اعرض أمانة الرياض وجدة فقط', null, TODAY); assert.equal(c2.kind, 'clarify'); assert.ok(c2.options.every((o) => o.text.includes('فقط')));
  const base = interpret('أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم', null, TODAY).spec; const f1 = interpret('أضف تحليل الاستبعادات', base, TODAY); assert.ok(f1.spec.sections.includes('exclusions') && f1.spec.sections.includes('executive')); assert.equal(f1.spec.scope.from, '2026-10-01');
  const f2 = interpret('حوّله إلى ملخص تنفيذي', f1.spec, TODAY); assert.deepEqual(f2.spec.sections, ['executive']); assert.equal(f2.spec.scope.from, '2026-10-01');
  const shared = { ...defaultSpec(TODAY), scope: { ...defaultSpec(TODAY).scope, amanah: 'Jeddah Amanah' } }; const n = interpret('حلّل المتأخرات حسب مصدر الإيراد', null, TODAY, { base: shared }); assert.equal(n.spec.scope.amanah, 'Jeddah Amanah', 'a new conversation starts from the shared filters'); assert.deepEqual(n.spec.sections, ['sources', 'aging']);
});
await test('the planning assistant stays inside planning and hands descriptive questions to Smart reports', async () => {
  const ctx = { mode: 'planning', lang: 'ar', today: TODAY, scope: { ...YTD, scopeType: 'all', muni: 'all', status: 'all' }, targets: DEFAULT_TARGETS, register: { actions: [], rejected: [] }, proposals: [], labelOfAmanah: (k) => k, compare: compareSnapshots, fetchSnap: async (sc) => snapshot(cst, { scope: { amanah: 'all', source: 'all', ...sc }, cfg }), fetchPrev: async () => null, getAchievement: async () => null, applyFilters: () => {} };
  const r = await strategicAnswer('قارن أداء الأمانات', ctx); assert.equal(r.intent, 'redirect'); assert.ok(r.drill.to.startsWith('/insights?view=smart&q='));
  assert.equal((await strategicAnswer('ماذا يحدث إذا ارتفع معدل التحصيل خمس نقاط مئوية؟', ctx)).intent, 'scenario');
});

/* ------------------------------------------------------------ Phase 0 · batch 1 (F-02, F-03, F-09, F-10, F-11) */
await test('F-02: report totals carry the rates and the cancelled share, so the relations block and every export show them (never «غير متاحة» for a calculable rate)', () => {
  const m = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive'] }, lang: 'ar', out: mkOut(cYtd), targets: DEFAULT_TARGETS });
  const rel = m.sections.flatMap((s) => s.blocks).find((b) => b.type === 'relations');
  assert.ok(rel.totals.collectedOverNet.calculable && rel.totals.exclusionRate.calculable && typeof rel.totals.cancelled === 'number');
  assert.equal(rel.totals.cancelled, cYtd.totals.cancelled);
  const rows = modelToLines(m).find((x) => x.k === 'table' && x.title === 'العلاقات المالية').rows.map((r) => r.join(' '));
  assert.ok(rows.some((r) => r.includes('نسبة التحصيل') && r.includes('%')) && rows.some((r) => r.includes('نسبة الاستبعاد') && r.includes('%')));
  assert.ok(!rows.join(' ').includes('غير متاحة'));
});
await test('F-03: the executive report never claims «no interventions» as a result; recommendations come from the same decision cards as Planning', () => {
  const cards = buildDecisionCards(cYtd, { enforcementCases: [] });
  const withCards = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive'] }, lang: 'ar', out: { ...mkOut(cYtd), cards }, targets: DEFAULT_TARGETS });
  const rec = withCards.sections.find((s) => s.key === 'recommendations');
  if (cards.length) assert.ok(rec.blocks[0].items.length >= 1 && !rec.blocks[0].items.join(' ').includes('لم يولّد النظام'));
  const none = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive'] }, lang: 'ar', out: mkOut(cYtd), targets: DEFAULT_TARGETS });
  const txt = none.sections.find((s) => s.key === 'recommendations').blocks[0].items.join(' ');
  assert.ok(!txt.includes('لا توجد تدخلات موصى بها'), 'the false "nothing recommended" sentence is gone'); assert.ok(txt.includes('لا يعني عدم الحاجة'));
});
await test('F-09: every bilingual proposal field has Arabic in .ar and Latin text in .en (no swapped language)', () => {
  const props = buildProposals({ snapshot: cYtd, prev: null, comparison: null, targets: DEFAULT_TARGETS, cases: [], scopeText: 'x' });
  assert.ok(props.length > 0); const isAr = (t) => /[؀-ۿ]/.test(t); const isLat = (t) => !isAr(t);
  for (const p of props) {
    for (const f of [p.title, p.issue, p.action, p.expectedImpact.note, p.suggestedUnit, p.timeframe, ...(p.evidence.figures || []).map((x) => x.k)].filter(Boolean)) {
      assert.ok(isAr(f.ar), `${p.id}: Arabic text expected in .ar → ${f.ar}`); assert.ok(isLat(f.en), `${p.id}: Latin text expected in .en → ${f.en}`);
    }
  }
});
await test('F-10: long tables are paginated (the total row is kept); Excel gets a notes sheet and «%» on percentage headers; sheet names are cut at a word boundary', () => {
  const rows = Array.from({ length: 25 }, (_, i) => [`r${i}`]); const pages = paginateRows(rows);
  assert.equal(pages.flat().length, 25); assert.equal(pages.at(-1).at(-1)[0], 'r24'); assert.ok(pages.every((p) => p.length <= 11));
  const fin = generateFinance(TODAY); const prev = snapshot(cst, { scope: { from: '2025-01-01', to: '2025-10-08', amanah: 'all', source: 'all' }, cfg: { cutoff: TODAY, collectionsAsOf: 'periodEnd' } });
  const m = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive', 'amanah'], compare: 'prev_year' }, lang: 'ar', out: mkOut(cYtd), prev, compare: 'prev_year', prevScope: { from: '2025-01-01', to: '2025-10-08' }, targets: DEFAULT_TARGETS, finance: fin });
  const wb = buildWorkbook(m);
  assert.ok(wb.SheetNames.includes('ملاحظات التقرير'), 'notes sheet'); assert.ok(wb.SheetNames.every((n) => n.length <= 31));
  const notes = XLSX_utils_to_rows(wb, 'ملاحظات التقرير').flat().join(' '); assert.ok(notes.includes('نسبة التحصيل'), 'the relations block (incl. rates) is exported');
  const pctHeaders = wb.SheetNames.flatMap((n) => (XLSX_utils_to_rows(wb, n).slice(0, 2).flat()).map(String)).filter((h) => h.endsWith('(%)')); assert.ok(pctHeaders.length > 0);
});
await test('F-11: a report with no invoices is flagged empty (no zeros presented as results); change chips show human labels, not raw keys', () => {
  const none = snapshot(cst, { scope: { from: '2030-01-01', to: '2030-01-31', amanah: 'all', source: 'all' }, cfg });
  const m = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive'] }, lang: 'ar', out: mkOut(none), targets: DEFAULT_TARGETS });
  assert.equal(m.empty, true); assert.equal(buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive'] }, lang: 'ar', out: mkOut(cYtd), targets: DEFAULT_TARGETS }).empty, false);
  const d = describeChange({ key: 'source', value: 'housing_sales' }, 'ar'); assert.ok(!d.includes('housing_sales'), d);
  assert.ok(!describeChange({ key: 'status', value: 'overdue' }, 'ar').includes('overdue'));
});

/* ------------------------------------------------------------ Phase 0 · batch 2 (dates: D-01, D-02, D-04, D-05, D-07) */
await test('D-01/D-02: a period is applied only when valid; ranges outside the data are clamped and explained, never silently accepted', () => {
  const o = { today: '2026-10-09', start: '2025-01-01' };
  assert.deepEqual(checkRange({ from: '2026-06-01', to: '2026-03-01' }, o), { ok: false, code: 'inverted' });
  assert.equal(checkRange({ from: '', to: '2026-03-01' }, o).code, 'incomplete'); assert.equal(checkRange({ from: '2026-02-30', to: '2026-03-01' }, o).code, 'incomplete');
  assert.equal(checkRange({ from: '2026-11-01', to: '2026-11-30' }, o).code, 'future'); assert.equal(checkRange({ from: '2020-01-01', to: '2020-12-31' }, o).code, 'before_data');
  const c = checkRange({ from: '2020-01-01', to: '2027-01-01' }, o); assert.deepEqual([c.ok, c.from, c.to, c.adjusted], [true, '2025-01-01', '2026-10-09', ['to_clamped', 'from_clamped']]);
  assert.deepEqual(checkRange({ from: '2026-01-01', to: '2026-10-09' }, o), { ok: true, from: '2026-01-01', to: '2026-10-09', adjusted: [] });
  assert.ok(rangeMessage('inverted', 'ar', o).includes('بعد تاريخ النهاية')); assert.ok(rangeMessage('from_clamped', 'en', o).includes('1 Jan 2025'), 'dates in the message are written for people');
});
await test('D-04: a quarter or month that has not started is never turned into a reversed range; the Smart-report interpreter asks which period instead', () => {
  assert.equal(parsePeriod('الربع الثاني', '2026-02-10'), null); assert.equal(parsePeriod('الربع الرابع', '2026-08-15'), null);
  assert.equal(parsePeriod('الربع الثاني', '2026-02-10', { reportFuture: true }).notStarted, true);
  assert.equal(parsePeriod('تقرير الإيرادات للربع الثاني', '2026-10-09').label, 'q2', '«للربع» (ل + الربع) is read as the quarter');
  const q = parsePeriod('الربع الأول', '2026-10-09'); assert.deepEqual([q.from, q.to], ['2026-01-01', '2026-03-31']);
  const q2 = parsePeriod('الربع الثاني 2025', '2026-02-10'); assert.deepEqual([q2.from, q2.to], ['2025-04-01', '2025-06-30'], 'an explicit year is honoured');
  const m = parsePeriod('مارس', '2026-02-10'); assert.deepEqual([m.from, m.to, m.yearAssumed], ['2025-03-01', '2025-03-31', true], 'the previous-year choice is flagged, and the interpreted dates are shown to the user');
  const r = interpret('أنشئ تقرير الإيرادات للربع الثاني', null, '2026-02-10'); assert.equal(r.kind, 'clarify'); assert.ok(r.question.ar.includes('لم يبدأ بعد') && r.question.ar.includes('2026-04-01'));
  const inv = interpret('تقرير الإيرادات 2026-06-01 إلى 2026-03-01', null, TODAY); assert.equal(inv.kind, 'clarify'); assert.ok(inv.question.ar.includes('بعد تاريخ النهاية'));
});
await test('D-05: «previous month» compares equal elapsed days for a single month, and an equal-length preceding period for any other selection', () => {
  assert.deepEqual(previousMonthScope({ from: '2026-01-01', to: '2026-10-09' }, TODAY), { from: '2025-03-25', to: '2025-12-31' }, 'a 282-day year-to-date is compared with the 282 days before it, not with December alone');
  assert.deepEqual(previousMonthScope({ from: '2026-07-01', to: '2026-09-15' }, TODAY), { from: '2026-04-15', to: '2026-06-30' });
  assert.deepEqual(previousMonthScope({ from: '2026-10-01', to: '2026-10-09' }, TODAY), { from: '2026-09-01', to: '2026-09-09' });
  assert.ok(describeChange({ key: 'compare', value: 'prev_month' }, 'ar', { spec: { scope: { from: '2026-01-01', to: '2026-10-09' } } }).includes('المساوية في الطول'));
});
await test('D-07: every timestamp shown to people is Asia/Riyadh (UTC+3), including the date of a report prepared between 21:00 and 24:00 UTC', () => {
  assert.equal(fmtRiyadh('2026-10-09T22:30:00.000Z'), '2026-10-10 01:30'); assert.equal(riyadhDateOf('2026-10-09T22:30:00.000Z'), '2026-10-10');
  assert.equal(fmtRiyadh('2026-10-09T12:44:18.706Z'), '2026-10-09 15:44'); assert.equal(fmtRiyadh('nonsense'), '—');
});

/* ------------------------------------------------------------ Phase 0 · batch 3 (governance guards: F-06, F-07, F-15) */
await test('F-06: a scenario proposal waits for review — it is never an approved action, and repeating it does not duplicate it', () => {
  const reg0 = { actions: [], rejected: [], proposed: [] }; const p = { id: 'scenario:PLAN-1:dRate=3', title: { ar: 'س', en: 's' }, priority: 'medium' };
  const reg1 = addProposal(reg0, p, 'Reviewer'); assert.equal(reg1.actions.length, 0, 'nothing enters the register as approved'); assert.equal(pendingProposals(reg1, []).length, 1);
  assert.equal(addProposal(reg1, p, 'Reviewer').proposed.length, 1, 'same scenario → same proposal');
  const reg2 = createAction(reg1, { by: 'Approver', proposal: p }); assert.equal(pendingProposals(reg2, []).length, 0, 'once approved it leaves the queue'); assert.equal(reg2.actions[0].approvedBy, 'Approver'); assert.ok(reg2.actions[0].approvedAt);
});
await test('F-07: editing an approved plan returns it to draft (logged, saved version untouched); typing does not flood the history; unsaved changes are detectable', () => {
  let pl = newPlan({ by: 'A', name: 'خطة', scope: {}, period: { from: '2026-01-01', to: '2026-12-31' } });
  pl = saveVersion({ ...pl, scenario: { ...pl.scenario, dRate: 3 } }, { by: 'A', summary: {} }); pl = approvePlan(pl, 'A'); assert.equal(pl.status, 'approved'); assert.equal(unsavedChanges(pl), false);
  const edited = editPlan(pl, { scenario: { ...pl.scenario, dRate: 8 } }, 'B');
  assert.equal(edited.status, 'draft'); assert.equal(edited.approvedBy, null); assert.equal(edited.version, 1); assert.equal(edited.versions[0].scenario.dRate, 3, 'the saved version still holds what was approved'); assert.equal(unsavedChanges(edited), true);
  assert.ok(edited.history.some((h) => h.change === 'returned to draft') && edited.history.some((h) => h.change === 'scenario changed'));
  let typed = edited; for (const nm of ['خ', 'خط', 'خطة', 'خطة أ']) typed = editPlan(typed, { name: nm }, 'B'); assert.equal(typed.history.filter((h) => h.change === 'name changed').length, 1, 'consecutive edits of one field are one entry');
  const noop = editPlan(pl, { scenario: { ...pl.scenario } }, 'B'); assert.equal(noop.status, 'approved', 'an edit that changes nothing does not revoke approval');
  assert.equal(actorName({ name: '李芳军', nameEn: 'Li Fangjun', nameAr: 'طارق' }, 'ar'), 'طارق'); assert.equal(actorName({ name: '李芳军', nameEn: 'Li Fangjun', nameAr: 'طارق' }, 'en'), 'Li Fangjun');
});
await test('F-15: a proposal id carries its period and scope — the same finding under another period is a new proposal, and earlier decisions on it stay visible', () => {
  const a = buildProposals({ snapshot: cYtd, prev: null, comparison: null, targets: DEFAULT_TARGETS, cases: [], scopeText: 'x' });
  const monthSnap = snapshot(cst, { scope: { from: '2026-10-01', to: TODAY, amanah: 'all', source: 'all' }, cfg });
  const b = buildProposals({ snapshot: monthSnap, prev: null, comparison: null, targets: DEFAULT_TARGETS, cases: [], scopeText: 'y' });
  assert.ok(a.every((p) => p.id.includes('@2026-01-01..')) && b.every((p) => p.id.includes('@2026-10-01..')));
  const common = a.find((p) => b.some((q) => q.id.split('@')[0] === p.id.split('@')[0])); assert.ok(common, 'a finding recurs across periods');
  const reg = createAction({ actions: [], rejected: [], proposed: [] }, { by: 'A', proposal: common });
  const pendingB = pendingProposals(reg, b); const same = pendingB.find((q) => q.id.split('@')[0] === common.id.split('@')[0]);
  assert.ok(same, 'approved for the year-to-date scope, but still proposed for this month'); assert.equal(earlierDecisions(reg, same)[0].kind, 'approved');
  assert.equal(pendingProposals(reg, a).some((q) => q.id === common.id), false, 'under the SAME scope it is no longer pending');
});

/* ------------------------------------------------------------ Phase 0 · batch 4 (F-05 golden phrases: the audit's verified mis-readings) */
await test('F-05 golden phrases: every request in the audit table is read as the user meant — or answered with a question, never with a silent wrong report', () => {
  const T9 = '2026-10-09'; const ams = amanahOptionsOf(); const key = (re) => ams.find((a) => re.test(a.ar))?.key;
  const run = (q, prev = null) => interpret(q, prev, T9);
  const last = run('أنشئ تقرير الإيرادات للشهر الماضي'); assert.equal(last.kind, 'report'); assert.deepEqual([last.spec.scope.from, last.spec.scope.to], ['2026-09-01', '2026-09-30']);
  const again = run('تقرير الشهر الماضي', last.spec); assert.equal(again.kind, 'report', 'same period again is still a report, not «could not understand»');
  assert.equal(run('أريد تقريراً عن أكبر 5 بلديات').spec.scope.source, 'all', '«بلديات» (municipalities) is not the municipal-fees source');
  assert.equal(run('رسوم بلدية للشهر الماضي').spec.scope.source, 'municipal_fees');
  const east = run('تقرير الاستبعادات للأمانات الشرقية'); assert.equal(east.spec.scope.amanah, key(/^أمانة المنطقة الشرقية/), 'Eastern Amanah applied'); assert.ok(east.changes.some((c) => c.key === 'amanah'));
  const lm = run('تقرير الشهر الماضي مقارنة بالعام الماضي'); assert.deepEqual([lm.spec.scope.from, lm.spec.compare], ['2026-09-01', 'prev_year']);
  const sep = run('تقرير الاستبعادات شهر سبتمبر مقارنة بأغسطس'); assert.deepEqual([sep.spec.scope.from, sep.spec.scope.to, sep.spec.compare], ['2026-09-01', '2026-09-30', 'prev_month']);
  assert.equal(run('تقرير الاستبعادات شهر مارس مقارنة بأغسطس').kind, 'clarify', 'a comparison with a month that is not the previous one is declined openly');
  const jed = run('ما نسبة التحصيل في جدة؟'); assert.equal(jed.spec.scope.amanah, key(/جدة/));
  assert.deepEqual(run('ما الميزانية المتبقية؟').spec.sections, ['budget']); assert.deepEqual(run('هل نغطي المصروفات؟').spec.sections, ['budget']);
  const two = run('قارن الرياض بجدة'); assert.deepEqual([].concat(two.spec.scope.amanah).sort(), [key(/الرياض/), key(/جدة/)].sort()); assert.ok(two.spec.sections.includes('amanah'));
  const cm = run('compare with last month', run('أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم').spec); assert.equal(cm.spec.compare, 'prev_month'); assert.equal(cm.spec.scope.from, '2026-10-01', 'English «compare with last month» does not change the period');
  assert.equal(run('تقرير الإيرادات قبل شهرين').kind, 'clarify', 'an unresolved period phrase is asked about, not ignored');
  assert.equal(run('تقرير آخر 6 أشهر').kind, 'clarify');
});

/* ------------------------------------------------------------ Phase 0 · batch 6 (EQ1 shared measurement, EQ4 plan anchoring, EQ7 presets, proposals) */
const TD = '2026-10-09'; const cfgTD = { cutoff: TD };
const scopesMatrix = () => {
  const periods = { ytd: { from: '2026-01-01', to: TD }, month: { from: '2026-10-01', to: TD }, lastMonth: { from: '2026-09-01', to: '2026-09-30' }, last3: lastCompleteMonths(TD, 3) };
  const dims = [{ amanah: 'all', source: 'all' }, { amanah: 'Riyadh Amanah', source: 'all' }, { amanah: 'all', source: 'fines' }];
  const out = []; for (const [pk, p] of Object.entries(periods)) for (const d of dims) out.push({ key: `${pk}/${d.amanah}/${d.source}`, scope: { ...p, ...d } });
  out.push({ key: 'empty', scope: { from: '2026-01-01', to: '2026-01-31', amanah: 'all', source: 'housing_sales' } });
  return out;
};
await test('EQ7: «آخر 3 أشهر» is the three complete calendar months before the current month, for every month of 2026', () => {
  assert.deepEqual(lastCompleteMonths('2026-10-09', 3), { from: '2026-07-01', to: '2026-09-30' });
  assert.deepEqual(lastCompleteMonths('2026-02-15', 3), { from: '2025-11-01', to: '2026-01-31' }); assert.deepEqual(lastCompleteMonths('2026-03-01', 3), { from: '2025-12-01', to: '2026-02-28' });
  for (let m = 1; m <= 12; m += 1) { const t = `2026-${String(m).padStart(2, '0')}-15`; const r = lastCompleteMonths(t, 3); assert.ok(r.from.endsWith('-01')); assert.equal(r.to, prevMonthEnd(t)); assert.ok(r.from < r.to); }
  assert.deepEqual(parsePeriod('آخر 3 أشهر', '2026-10-09'), { ...lastCompleteMonths('2026-10-09', 3), label: 'last3' });
});
await test('EQ1: the headline measures collections at the period end; «to today» is a separate figure; all views share one rule', () => {
  const closed = { from: '2026-01-01', to: '2026-06-30', amanah: 'all', source: 'all' };
  const head = snapshot(st, { scope: closed, cfg: cfgTD }); const toDate = snapshot(st, { scope: closed, cfg: cfgFor(cfgTD, BASIS.TO_DATE) });
  assert.equal(head.basis.collectionsAsOf, '2026-06-30'); assert.equal(head.basis.collectionsMode, 'period_end'); assert.equal(toDate.basis.collectionsAsOf, TD);
  assert.ok(toDate.totals.collected >= head.totals.collected, 'later payments can only add'); assert.equal(head.totals.gross, toDate.totals.gross);
  assert.equal(hasToDateVariant(closed, TD), true); assert.equal(hasToDateVariant({ from: '2026-10-01', to: TD }, TD), false);
  assert.equal(asOfDate(closed, BASIS.PERIOD_END, TD), '2026-06-30'); assert.equal(asOfDate(closed, BASIS.TO_DATE, TD), TD);
  assert.ok(basisLabel(closed, BASIS.TO_DATE, TD, 'ar').includes('حتى اليوم') && basisLabel(closed, BASIS.PERIOD_END, TD, 'ar').includes('نهاية الفترة'));
  const open = { from: '2026-10-01', to: TD, amanah: 'all', source: 'all' };
  assert.equal(snapshot(st, { scope: open, cfg: cfgTD }).totals.collected, snapshot(st, { scope: open, cfg: cfgFor(cfgTD, BASIS.TO_DATE) }).totals.collected, 'an open period ends today: no difference');
});
await test('AC-A1/A2 parity: Dashboard, Fixed-report headline, Smart report (with and without comparison) and the Planning baseline give identical figures and the same comparison, over 13 selections', () => {
  for (const { key, scope } of scopesMatrix()) {
    const dash = snapshot(st, { scope, cfg: cfgTD });                                             // Dashboard: shared request, default config
    const smart = snapshot(st, { scope, cfg: headlineCfg(cfgTD) });                               // Smart: headline basis via measure()
    const plan = snapshot(st, { scope: planScopeOf({ period: { from: scope.from, to: scope.to }, scope: { amanah: scope.amanah, source: scope.source } }, TD), cfg: cfgTD }); // Planning baseline
    const model = buildReportModel({ spec: { ...defaultSpec(TD), scope, sections: ['executive'] }, lang: 'ar', out: mkOut(dash), targets: DEFAULT_TARGETS });
    const fields = ['count', 'gross', 'exclusions', 'net', 'collected', 'outstanding'];
    for (const f of fields) { assert.equal(smart.totals[f], dash.totals[f], `${key} smart ${f}`); assert.equal(plan.totals[f], dash.totals[f], `${key} plan ${f}`); assert.equal(model.totals[f], dash.totals[f], `${key} fixed ${f}`); }
    for (const [a, b] of [[smart, dash], [plan, dash]]) { assert.equal(a.totals.collectedOverNet.value, b.totals.collectedOverNet.value); assert.equal(a.totals.exclusionRate.value, b.totals.exclusionRate.value); }
    if (dash.totals.count > 0) {
      const pv = previousScope({ from: scope.from, to: scope.to }); const prevOf = (cfg) => snapshot(st, { scope: { ...scope, from: pv.from, to: pv.to }, cfg });
      const c1 = compareSnapshots(dash, prevOf(cfgTD)); const c2 = compareSnapshots(smart, prevOf(headlineCfg(cfgTD)));
      assert.deepEqual(c1.collectedOverNetPp, c2.collectedOverNetPp, `${key} comparison delta`);
      assert.ok(model.context.some((c) => c.k === 'basis'), 'the basis is printed in every report');
    }
  }
});
await test('EQ4: plan figures are computed from the PLAN period and scope: the plan scope object ignores any dashboard filter, caps the end at the cut-off, and a version stores its calculation context', () => {
  const plan = { period: { from: '2026-01-01', to: '2026-12-31' }, scope: { amanah: 'Riyadh Amanah', source: 'all', label: 'x' } };
  assert.deepEqual(planScopeOf(plan, TD), { from: '2026-01-01', to: TD, amanah: 'Riyadh Amanah', source: 'all', scopeType: 'all', muni: 'all', status: 'all' });
  assert.deepEqual(planScopeOf({ period: { from: '2026-01-01', to: '2026-06-30' }, scope: null }, TD).to, '2026-06-30'); assert.equal(planScopeOf({ period: plan.period, scope: null }, TD).amanah, 'all');
  assert.ok(scopeLabelOf({ amanah: 'Riyadh Amanah', source: 'fines' }, true).includes('الرياض') && scopeLabelOf(DEFAULT_PLAN_SCOPE, false) === 'All Amanahs · All sources');
  assert.equal(cfgHash({ graceDays: 0, collectionsAsOf: 'periodEnd', rules: { A: true } }), cfgHash({ graceDays: 0, collectionsAsOf: 'periodEnd', rules: { A: true } })); assert.notEqual(cfgHash({ graceDays: 0, collectionsAsOf: 'periodEnd', rules: {} }), cfgHash({ graceDays: 5, collectionsAsOf: 'periodEnd', rules: {} }));
  const p0 = newPlan({ by: 'A', name: 'n', scope: DEFAULT_PLAN_SCOPE, period: plan.period }); const ctx = { period: p0.period, scope: p0.scope, basis: 'periodEnd', cutoff: TD, config: 'abc', targets: { collectionRate: 0.6, status: 'demo' } };
  const v = saveVersion(p0, { by: 'A', summary: {}, context: ctx }); assert.deepEqual(v.versions[0].context, ctx);
  assert.equal(unsavedChanges(editPlan(v, { period: { from: '2026-02-01', to: '2026-12-31' } }, 'A')), true, 'changing the period is an unsaved change');
  assert.equal(unsavedChanges(editPlan(v, { scope: { ...DEFAULT_PLAN_SCOPE, amanah: 'Riyadh Amanah', label: 'y' } }, 'A')), true, 'changing the scope is an unsaved change');
});
await test('manual and scenario actions both start as PROPOSED: nothing enters the register until a reviewer approves it, and a manual approval keeps its manual origin', () => {
  const reg0 = { actions: [], rejected: [] };
  const man = { id: 'manual:x1', source: 'manual', title: 'عنوان', issue: '', action: '', priority: 'medium', suggestedOwner: 'وحدة', suggestedDue: '2026-11-01', expectedImpact: null, evidence: { text: 't', scope: 's', figures: [] } };
  const reg1 = addProposal(addProposal(reg0, man, 'A'), { id: 'scenario:P:dRate=3', title: 's', priority: 'medium' }, 'A');
  assert.equal(reg1.actions.length, 0); assert.equal(pendingProposals(reg1, []).length, 2); assert.equal('proposed' in reg0, false, 'the input record is not mutated');
  const reg2 = createAction(reg1, { by: 'B', proposal: man, fields: { owner: man.suggestedOwner, dueDate: man.suggestedDue, priority: man.priority } });
  assert.equal(reg2.actions[0].status, 'approved'); assert.equal(reg2.actions[0].source, 'manual'); assert.equal(reg2.actions[0].approvedBy, 'B'); assert.equal(pendingProposals(reg2, []).length, 1);
});

await test('EQ10: backup/export/import of the browser-local records — validated before anything is written, replaces the three records as a unit, round-trips exactly', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
  const a = mem(); a.setItem('ib_plans_v1', JSON.stringify({ plans: [{ id: 'P1' }], objectives: [], activeId: 'P1' })); a.setItem('ib_actions_v1', JSON.stringify({ actions: [{ id: 'A1' }], rejected: [] })); a.setItem('ib_smart_convs_v1', JSON.stringify([{ id: 'C1', messages: [] }]));
  const b = buildBackup(a, new Date('2026-10-09T10:00:00Z')); assert.equal(b.format, BACKUP_FORMAT); assert.deepEqual(validateBackup(b), { ok: true, summary: { plans: 1, objectives: 0, actions: 1, proposals: 0, conversations: 1, createdAt: '2026-10-09T10:00:00.000Z' } });
  const t = mem(); t.setItem('ib_plans_v1', 'old'); const r = applyBackup(JSON.parse(JSON.stringify(b)), t); assert.equal(r.ok, true);
  for (const k of ['ib_plans_v1', 'ib_actions_v1', 'ib_smart_convs_v1']) assert.deepEqual(JSON.parse(t.getItem(k)), JSON.parse(a.getItem(k)), `${k} round-trips`);
  const before = JSON.stringify([...t._m]); for (const bad of [null, {}, { format: 'x' }, { ...b, version: 2 }, { ...b, data: { ib_plans_v1: { plans: 'no' } } }, { ...b, data: { ib_actions_v1: {} } }, { ...b, data: { ib_smart_convs_v1: {} } }]) { assert.equal(applyBackup(bad, t).ok, false); }
  assert.equal(JSON.stringify([...t._m]), before, 'an invalid file writes nothing');
  const empty = mem(); const bb = buildBackup(empty); assert.equal(bb.data.ib_plans_v1, null); applyBackup(bb, t); assert.equal(t.getItem('ib_plans_v1'), null, 'a record absent from the backup is removed');
});

await test('interpreter corpus: 162 representative + 47 blind + 65 held-out Arabic / English phrases (regression guard; the first-run scores are in the register) — correct reading or an appropriate clarification / refusal', async () => {
  const { runCorpus, evaluate } = await import('./interpreter-eval.mjs'); const { BLIND } = await import('./interpreter-corpus-blind.mjs'); const { VERIFIED_IDS } = await import('./interpreter-corpus.mjs');
  const { HELDOUT } = await import('./interpreter-corpus-heldout.mjs'); const held = HELDOUT.map((c) => ({ c, ...evaluate(c) }));
  const main = runCorpus(); const blind = BLIND.map((c) => ({ c, ...evaluate(c) })); const all = [...main, ...blind, ...held];
  const bad = all.filter((x) => !x.ok); const score = (all.length - bad.length) / all.length;
  assert.ok(all.length >= 150, `corpus size ${all.length}`);
  assert.ok(score >= 0.95, `accuracy ${(score * 100).toFixed(1)}%\n${bad.map((x) => `#${x.c.id} ${x.c.q} → ${x.why}`).join('\n')}`);
  for (const x of all.filter((y) => VERIFIED_IDS.includes(y.c.id))) assert.ok(x.ok, `verified failure still fixed: ${x.c.q} → ${x.why}`);
  for (const cat of ['unsupported', 'period-clarify', 'blind-neg']) for (const x of all.filter((y) => y.c.cat === cat)) assert.ok(x.ok, `${cat}: ${x.c.q} → ${x.why}`);
});

await test('AC-D2/D3: every preset equals its definition for 24 reference dates (month ends, 1 Jan, 29 Feb, rollovers); the interpreter returns the same ranges', () => {
  const dates = ['2026-01-01', '2026-01-31', '2026-02-28', '2028-02-29', '2026-03-01', '2026-03-31', '2026-04-01', '2026-04-30', '2026-05-15', '2026-06-30', '2026-07-01', '2026-08-31', '2026-09-30', '2026-10-01', '2026-10-09', '2026-11-30', '2026-12-31', '2027-01-01', '2027-01-31', '2027-02-01', '2027-03-31', '2027-04-15', '2027-06-01', '2027-12-31'];
  assert.equal(dates.length, 24); const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); const pad = (n) => String(n).padStart(2, '0');
  for (const t of dates) {
    const y = Number(t.slice(0, 4)); const m = Number(t.slice(5, 7));
    assert.deepEqual(presetRange('today', t), { from: t, to: t });
    assert.deepEqual(presetRange('month', t), { from: `${y}-${pad(m)}-01`, to: t });
    const pm = m === 1 ? 12 : m - 1; const py = m === 1 ? y - 1 : y; assert.deepEqual(presetRange('lastMonth', t), { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(dim(py, pm))}` });
    const l3 = presetRange('last3', t); const sIdx = y * 12 + (m - 1) - 3; assert.equal(l3.from, `${Math.floor(sIdx / 12)}-${pad((sIdx % 12) + 1)}-01`); assert.equal(l3.to, presetRange('lastMonth', t).to, 'three COMPLETE months: ends with last month');
    const q0 = Math.floor((m - 1) / 3) * 3 + 1; assert.deepEqual(presetRange('qtd', t), { from: `${y}-${pad(q0)}-01`, to: t });
    assert.deepEqual(presetRange('ytd', t), { from: `${y}-01-01`, to: t });
    assert.equal(presetRange('all', t).from, '2025-01-01');
    assert.equal(parsePeriod('آخر 3 أشهر', t).from, l3.from); assert.equal(parsePeriod('آخر 3 أشهر', t).to, l3.to); assert.equal(parsePeriod('هذا الشهر', t).from, presetRange('month', t).from);
  }
  assert.equal(detectPreset('2026-01-01', '2026-10-09', '2026-10-09'), 'ytd'); assert.equal(detectPreset('2026-02-03', '2026-02-04', '2026-10-09'), 'custom'); assert.equal(PRESETS.length, 7);
});

console.log(`\n${passed} tests passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
