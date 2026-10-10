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
import { listScenarioLog, validScenarioLogShape, MAX_SCENARIOS, addScenario, renameScenario, updateScenario, duplicateScenario, deleteScenario, listScenarios, cleanScenario, changedLevers, checkName, validScenariosShape } from '../src/data/namedScenarios.js';
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
import { sanadCases } from '../server/contracts.js';
import { sadadOf } from '../server/names.js';
import { resolveReferences, sameDebtorInvoices } from '../server/orderMatch.js';
import { extractFromText, buildExtraction, splitOcrText, collectReferences, buildRows, reconcile, orderMatchState, buildEffectiveCases, invoiceStatusMap, invoiceEnforcement, proposeLink, confirmLink, rejectLink, removeLink, recordDocument, recordSupplementalExtraction, emptyStore, unresolvedConflicts, orderCompleteness, recordFileRestored, orderExceptions, EXCEPTION_TYPES, validStoreShape, unresolvedReferences } from '../src/data/orderMatching.js';
import { caseSummary } from '../src/data/enforcementMatching.js';
import { readPdfPages } from '../src/data/pdfText.js';
import { enforcementOf, buildIndex, enforcementCounts, ordersOfContract, evidenceForInvoice } from '../src/data/relations.js';
import { invoicePath, orderPath, contractPath } from '../src/utils/paths.js';
import fs from 'node:fs';
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
await test('funding projection: baseline receipts and payments are both cash by payment date; the scenario is NOT combined with them (no scenario receipts, payments or balance) and its effects are returned separately', () => {
  const base = { receiptsYtd: 8e9, paymentsYtd: 16e9, series: { values: [1e9, 1e9, 1e9, 1e9, 0.5e9] }, paymentsByMonth: [1.6e9, 1.6e9, 1.6e9, 1.6e9, 0.8e9], forecast: { ready: false }, monthsLeft: 2.5 };
  const p0 = financeProjection({ ...base }); assert.ok(p0.available && p0.method === 'illustrative');
  const p1 = financeProjection({ ...base, scenarioDeltaCash: 1e9, scenario: { slip: 25, expense: 10 } });
  assert.equal(p1.scenario, undefined, 'no combined scenario figure'); assert.deepEqual(p1.base, p0.base, 'the baseline does not move with the scenario');
  assert.ok(Math.abs(p1.scenarioEffects.collectionDelta - 1e9) < 1 && Math.abs(p1.scenarioEffects.collectionSlipped - 0.25e9) < 1 && Math.abs(p1.scenarioEffects.remainingPaymentsDelta - p0.restPay * 0.1) < 1);
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
  const b = buildBackup(a, new Date('2026-10-09T10:00:00Z')); assert.equal(b.format, BACKUP_FORMAT); assert.deepEqual(validateBackup(b), { ok: true, summary: { plans: 1, objectives: 0, scenarios: 0, actions: 1, proposals: 0, conversations: 1, createdAt: '2026-10-09T10:00:00.000Z' } });
  const t = mem(); t.setItem('ib_plans_v1', 'old'); const r = applyBackup(JSON.parse(JSON.stringify(b)), t); assert.equal(r.ok, true);
  for (const k of ['ib_plans_v1', 'ib_actions_v1', 'ib_smart_convs_v1']) assert.deepEqual(JSON.parse(t.getItem(k)), JSON.parse(a.getItem(k)), `${k} round-trips`);
  const before = JSON.stringify([...t._m]); for (const bad of [null, {}, { format: 'x' }, { ...b, version: 2 }, { ...b, data: { ib_plans_v1: { plans: 'no' } } }, { ...b, data: { ib_actions_v1: {} } }, { ...b, data: { ib_smart_convs_v1: {} } }]) { assert.equal(applyBackup(bad, t).ok, false); }
  assert.equal(JSON.stringify([...t._m]), before, 'an invalid file writes nothing');
  const empty = mem(); const bb = buildBackup(empty); assert.equal(bb.data.ib_plans_v1, null); applyBackup(bb, t); assert.equal(t.getItem('ib_plans_v1'), null, 'a record absent from the backup is removed');
});

await test('interpreter corpus: 162 representative + 47 blind + 65 held-out + 72 held-out-2 + 64 held-out-3 + 64 held-out-4 + 63 held-out-5 + 42 held-out-6 (all tuned after their recorded first runs) Arabic / English phrases (regression guard; the first-run scores are in the register) — correct reading or an appropriate clarification / refusal', async () => {
  const { runCorpus, evaluate } = await import('./interpreter-eval.mjs'); const { BLIND } = await import('./interpreter-corpus-blind.mjs'); const { VERIFIED_IDS } = await import('./interpreter-corpus.mjs');
  const { HELDOUT } = await import('./interpreter-corpus-heldout.mjs'); const held = HELDOUT.map((c) => ({ c, ...evaluate(c) }));
  const { HELDOUT2 } = await import('./interpreter-corpus-heldout2.mjs'); const held2 = HELDOUT2.map((c) => ({ c, ...evaluate(c) })); // regression ONLY: tuned against after its recorded first run (docs/interpreter-heldout2-first-run.txt)
  const { HELDOUT3 } = await import('./interpreter-corpus-heldout3.mjs'); const held3 = HELDOUT3.map((c) => ({ c, ...evaluate(c) })); // regression ONLY after its recorded first run (docs/interpreter-heldout3-first-run.txt)
  const { HELDOUT4 } = await import('./interpreter-corpus-heldout4.mjs'); const { HELDOUT5 } = await import('./interpreter-corpus-heldout5.mjs'); const { HELDOUT6 } = await import('./interpreter-corpus-heldout6.mjs'); const held45 = [...HELDOUT4, ...HELDOUT5, ...HELDOUT6].map((c) => ({ c, ...evaluate(c) })); // regression ONLY after their recorded first runs (docs/interpreter-heldout4-first-run.txt, -5-)
  const main = runCorpus(); const blind = BLIND.map((c) => ({ c, ...evaluate(c) })); const all = [...main, ...blind, ...held, ...held2, ...held3, ...held45];
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
  assert.deepEqual(parsePeriod('الربع الحالي حتى اليوم', '2026-10-09'), { from: '2026-10-01', to: '2026-10-09', label: 'qtd' }); assert.equal(parsePeriod('this quarter', '2026-05-20').from, '2026-04-01'); assert.equal(parsePeriod('منذ أول يناير', '2026-10-09').from, '2026-01-01');
  assert.equal(detectPreset('2026-01-01', '2026-10-09', '2026-10-09'), 'ytd'); assert.equal(detectPreset('2026-02-03', '2026-02-04', '2026-10-09'), 'custom'); assert.equal(PRESETS.length, 7);
});

await test('Named scenarios: up to four per plan; save / rename / duplicate / update / delete; unique names; separate from the plan; backup validates the shape', () => {
  const plan = approvePlan(saveVersion(newPlan({ by: 'A', name: 'P', scope: DEFAULT_PLAN_SCOPE, period: { from: '2026-01-01', to: '2026-12-31' } }), { by: 'A', summary: { rate: 0.5 } }), 'A');
  let st = { plans: [plan], objectives: [], activeId: plan.id, scenarios: {} };
  const before = JSON.stringify(st.plans);
  let r = addScenario(st, plan.id, { name: ' تحسّن التحصيل ', scenario: { dRate: 2, recovery: 999, bogus: 5 }, by: 'A' }); assert.ok(r.ok); st = r.st;
  assert.equal(listScenarios(st, plan.id)[0].name, 'تحسّن التحصيل', 'the name is trimmed');
  assert.deepEqual(listScenarios(st, plan.id)[0].scenario, { ...DEFAULT_SCENARIO, dRate: 2, recovery: 100 }, 'levers are clamped to their limits and unknown keys dropped');
  assert.equal(JSON.stringify(st.plans), before, 'saving a scenario does not touch the plan, its status or its versions (still approved)');
  assert.equal(st.plans[0].status, 'approved');
  assert.deepEqual(addScenario(st, plan.id, { name: 'تحسّن التحصيل', scenario: {}, by: 'A' }), { ok: false, error: 'name_dup' }, 'names are unique within a plan');
  r = addScenario(st, plan.id, { name: 'TAHSIN التحصيل', scenario: {}, by: 'A' }); assert.ok(r.ok); st = r.st;
  assert.equal(checkName(st, plan.id, 'Same', null), null); assert.equal(checkName(st, plan.id, '   '), 'name_empty'); assert.equal(checkName(st, plan.id, 'x'.repeat(61)), 'name_long');
  r = duplicateScenario(st, plan.id, listScenarios(st, plan.id)[0].id, 'B', 'نسخة من'); assert.ok(r.ok); st = r.st; assert.equal(listScenarios(st, plan.id).length, 3);
  assert.equal(listScenarios(st, plan.id)[2].name, 'نسخة من تحسّن التحصيل'); assert.deepEqual(listScenarios(st, plan.id)[2].scenario, listScenarios(st, plan.id)[0].scenario);
  r = addScenario(st, plan.id, { name: 'الرابع', scenario: { billing: 10 }, by: 'A' }); assert.ok(r.ok); st = r.st; assert.equal(listScenarios(st, plan.id).length, MAX_SCENARIOS);
  assert.deepEqual(addScenario(st, plan.id, { name: 'الخامس', scenario: {}, by: 'A' }), { ok: false, error: 'limit' }, 'a fifth scenario is refused');
  assert.deepEqual(duplicateScenario(st, plan.id, listScenarios(st, plan.id)[0].id, 'A'), { ok: false, error: 'limit' });
  const id4 = listScenarios(st, plan.id)[3].id;
  r = renameScenario(st, plan.id, id4, 'نمو الفوترة', 'C'); assert.ok(r.ok); st = r.st; assert.equal(listScenarios(st, plan.id)[3].name, 'نمو الفوترة'); assert.equal(listScenarios(st, plan.id)[3].updatedBy, 'C'); assert.equal(listScenarios(st, plan.id)[3].createdBy, 'A');
  assert.equal(renameScenario(st, plan.id, id4, 'تحسّن التحصيل', 'C').error, 'name_dup'); assert.equal(renameScenario(st, plan.id, id4, 'نمو الفوترة', 'C').ok, true, 'keeping its own name is allowed');
  r = updateScenario(st, plan.id, id4, { scenario: { billing: -5, dRate: 1 } }, 'C'); st = r.st; assert.deepEqual(changedLevers(listScenarios(st, plan.id)[3].scenario), [['dRate', 1], ['billing', -5]].sort((a, b) => Object.keys(DEFAULT_SCENARIO).indexOf(a[0]) - Object.keys(DEFAULT_SCENARIO).indexOf(b[0])));
  st = deleteScenario(st, plan.id, id4).st; assert.equal(listScenarios(st, plan.id).length, 3);
  assert.equal(addScenario(st, 'OTHER', { name: 'تحسّن التحصيل', scenario: {}, by: 'A' }).ok, true, 'scenarios belong to a plan: the same name may exist in another plan');
  assert.equal(JSON.stringify(st.plans), before, 'plan, status and saved versions are unchanged after every operation'); assert.equal(st.plans[0].versions.length, 1);
  const log = listScenarioLog(st, plan.id); assert.ok(log.length >= 7, 'every create / duplicate / rename / update / delete is recorded'); assert.equal(log[0].action, 'deleted'); assert.ok(log.some((e) => e.action === 'renamed' && e.detail.from === 'نسخة من تحسّن التحصيل') || log.some((e) => e.action === 'renamed'));
  assert.equal(JSON.stringify(st.plans), before, 'the scenario history is separate: the plan (content, status, history, versions) is untouched'); assert.equal(st.plans[0].history.length, plan.history.length);
  assert.equal(validScenarioLogShape(st.scenarioLog), true); assert.equal(validScenarioLogShape([]), false); assert.equal(validScenarioLogShape({ P: [{ at: 1 }] }), false);
  assert.equal(validScenariosShape(st.scenarios), true); assert.equal(validScenariosShape(undefined), true); assert.equal(validScenariosShape([]), false); assert.equal(validScenariosShape({ P: 'x' }), false); assert.equal(validScenariosShape({ P: [{ id: 1 }] }), false);
  assert.equal(validScenariosShape({ P: [1, 2, 3, 4, 5].map((i) => ({ id: `S${i}`, name: `n${i}`, scenario: {} })) }), false, 'more than four per plan is not a valid store');
  const b = buildBackup({ getItem: (k) => (k === 'ib_plans_v1' ? JSON.stringify(st) : null) }); const v = validateBackup(b); assert.ok(v.ok); assert.equal(v.summary.scenarios, 3);
  b.data.ib_plans_v1.scenarios = { P: 'bad' }; assert.deepEqual(validateBackup(b), { ok: false, error: 'bad_scenarios' });
  // comparison: a scenario at the defaults equals the baseline; a changed lever moves the collected amount in the stated direction
  const base = { N: 1000, C: 600, U: 400, pool: 200, pending: 50, rate: 0.6 };
  const rs0 = runScenario(base, cleanScenario({}), 0.7); assert.equal(rs0.scenario.collected, rs0.baseline.collected);
  const rs1 = runScenario(base, cleanScenario({ dRate: 5 }), 0.7); assert.ok(rs1.scenario.collected > rs1.baseline.collected);
});

await test('D-15: a partly typed date (year 0002 / 0202) is incomplete — never applied and never reported as a data-coverage error', () => {
  for (const y of ['0002', '0020', '0202', '1899']) assert.deepEqual(checkRange({ from: `${y}-02-01`, to: '2026-03-01' }, { today: '2026-10-09' }), { ok: false, code: 'incomplete' });
  assert.deepEqual(checkRange({ from: '', to: '2026-03-01' }, { today: '2026-10-09' }), { ok: false, code: 'incomplete' });
  assert.equal(checkRange({ from: '2026-02-01', to: '2026-03-01' }, { today: '2026-10-09' }).ok, true);
  assert.ok(rangeMessage('incomplete', 'ar', { today: '2026-10-09' }).includes('لن يُطبَّق'));
});

await test('Smart-report safety: a part that cannot be applied is asked about before generating; actions are declined; follow-ups use the same checks; the offer to continue is a real request', () => {
  const T = '2026-10-09'; const run = (q, prev = null) => interpret(q, prev, T);
  for (const q of ['تقرير الإيرادات لأكبر 10 دافعين', 'report in euros for last month', 'invoices above 500000 SAR in Riyadh', 'report excluding Riyadh', 'تقرير حسب العميل', 'تقرير الفواتير يوم الخميس']) { const r = run(q); assert.equal(r.kind, 'clarify', q); assert.ok(r.unapplied?.length, q); }
  const r = run('تقرير الإيرادات بالدولار'); assert.equal(r.options[0].label.ar, 'تابع بدونه'); assert.equal(run(r.options[0].text).kind, 'report'); assert.equal(run(r.options[0].text).unapplied, undefined);
  assert.equal(run('أرسل التقرير بالبريد').kind, 'unsupported'); assert.ok(run('أرسل التقرير بالبريد').question.ar.includes('Word'));
  const prev = run('report for last month').spec; assert.equal(run('sort by amount descending', prev).kind, 'clarify'); assert.equal(run('email it every morning', prev).kind, 'unsupported');
  assert.equal(run('تقرير مارس').kind, 'report'); assert.equal(run('اعرض المتأخرات حسب المصدر').kind, 'report', '«by revenue source» is supported and is not interrogated');
  const u = run('تقرير للمستثمر شركة النور'); assert.equal(u.kind, 'clarify');
  const k = run('تقرير الرسوم المتعثرة فقط'); assert.equal(k.kind, 'clarify'); assert.ok(k.unknownTerms.length);
});

await test('F-22: the municipality table never lists two rows with the same label — invoices without a municipality form ONE group per entity', () => {
  for (const scope of [YTD, { ...YTD, from: '2026-03-01', to: '2026-03-31' }]) {
    const s = snapshot(st, { scope, cfg }); const labels = s.byMunicipality.map((g) => `${g.municipality ? g.municipality.ar : '—'}|${g.amanahLabel?.ar ?? g.amanahLabel}`);
    assert.equal(new Set(labels).size, labels.length, 'duplicate municipality rows'); assert.equal(new Set(s.byMunicipality.map((g) => g.key)).size, s.byMunicipality.length);
    assert.equal(s.byMunicipality.reduce((t, g) => t + g.count, 0), s.totals.count, 'the groups still add up to the total');
  }
});

await test('F-23: receipts by payment date reconcile to collections on the period\'s invoices — receipts on invoices issued in the period equal the headline collected (within the invoice-amount cap), the rest are receipts on other invoices', () => {
  const sum = (r) => r.values.reduce((t, v) => t + v, 0);
  for (const sc of [{ amanah: 'all', source: 'all' }, { amanah: 'Riyadh Amanah', source: 'all' }, { amanah: 'all', source: 'fines' }]) {
    const from = '2026-01-01'; const C = snapshot(st, { scope: { from, to: TODAY, ...sc }, cfg }).totals.collected;
    const A = sum(series(st, { scope: { from, to: TODAY, ...sc }, cfg })); const B = sum(series(st, { scope: { from, to: TODAY, ...sc, issuedFrom: from, issuedTo: TODAY }, cfg }));
    assert.ok(A >= B && B > 0, 'receipts on all invoices ≥ receipts on the period\'s invoices'); assert.ok(Math.abs(B - C) / C < 0.0001, `receipts on the period's invoices ≈ collected (${B} vs ${C})`);
    const other = sum(series(st, { scope: { from, to: TODAY, ...sc, issuedFrom: '2000-01-01', issuedTo: '2025-12-31' }, cfg })); assert.ok(Math.abs(A - B - other) < 1, 'the remainder is exactly the receipts on invoices issued before the period');
  }
  const cq = { cutoff: '2026-06-30' }; const q = { from: '2026-04-01', to: '2026-06-30', amanah: 'all', source: 'all' };
  assert.equal(sum(series(st, { scope: { ...q, from: '2026-01-01', issuedFrom: q.from, issuedTo: q.to }, cfg: cq })), snapshot(st, { scope: q, cfg: cq }).totals.collected, 'a closed period reconciles exactly at its own end');
});

await test('Demo safety: the risky categories (several Amanahs, a variant name, a non-standard period, an inferred comparison, many changes at once) require confirmation; standard requests do not', () => {
  const T = '2026-10-09'; const run = (q, prev = null) => interpret(q, prev, T); const keys = (r) => (r.confirm || []).map((c) => c.key);
  assert.ok(keys(run('تقرير الرياض وجدة ومكة')).includes('multi_amanah')); assert.ok(keys(run('report for Mecca')).includes('variant_name'));
  assert.ok(keys(run('تقرير من 3 مارس إلى 20 مارس')).includes('period_variant')); assert.ok(keys(run('compare September with August for Riyadh')).includes('inferred_comparison'));
  const prev = run('تقرير الشهر الماضي').spec; assert.ok(keys(run('خله لجدة ولمصدر الغرامات وللربع الثاني', prev)).includes('multi_change'));
  for (const q of ['تقرير الإيرادات لهذا الشهر', 'تقرير أمانة الرياض للربع الثاني', 'show overdue invoices in Jeddah', 'قارن بالشهر الماضي', 'تقرير الغرامات لهذا العام']) assert.deepEqual(keys(run(q, q.startsWith('قارن') ? prev : null)), [], `no confirmation for a standard request: ${q}`);
  assert.equal(run('تقرير الرياض وجدة ومكة').kind, 'report', 'the reading is still returned (the UI shows it and waits for the user)');
});

await test('Invoice-status filter: the net-uncollected bridge lands on the standing balance for EVERY status (a status-filtered report used to fail reconciliation and could not be built)', () => {
  for (const status of ['all', 'overdue', 'open', 'partial', 'collected', 'not_due', 'cancelled', 'excluded']) {
    const sc = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status };
    const snap = snapshot(st, { scope: sc, cfg }); const b = bridge(st, { scope: { ...sc, from: '2000-01-01', to: TODAY }, cfg });
    assert.ok(Math.abs(b.check) < 0.5 && Math.abs(b.net - snap.stock.netUncollected) < 0.5, `status ${status}: bridge ${b.net} vs stock ${snap.stock.netUncollected}`);
  }
});

/* ------------------------------------------------------------ enforcement orders ↔ invoices (all invoice types; Sanad; references only, never amount alone) */
const feedCases = sanadCases(st); const orderOf = (arch, nth = 0) => st.requests.filter((r) => r.archetype === arch)[nth];
const caseOf = (q) => feedCases.find((c) => c.enforceNum === q.enforceNum);
const idOfInv = (i) => st.idKey[i] ? `INV-${Math.floor(st.idKey[i] / 1e8)}-${String(st.idKey[i] % 1e8).padStart(7, '0')}` : null;
const resolveFor = (refs) => resolveReferences(st, { refs, cfg });

await test('Orders cover ALL invoice types: the demo world holds one-invoice, several-invoice (different revenue sources), partial-reference, no-reference, wrong-reference, ambiguous, discrepancy and duplicate orders', () => {
  const kinds = new Set(st.requests.filter((r) => r.archetype).map((r) => r.archetype));
  for (const a of ['single', 'multi_exact', 'multi_partial_refs', 'multi_no_refs', 'multi_typo_ref', 'serial_ambiguous', 'amount_discrepancy', 'duplicate_across_orders']) assert.ok(kinds.has(a), a);
  const multi = orderOf('multi_exact'); const sources = new Set(multi.covers.map((i) => st.src[i])); assert.ok(multi.covers.length >= 2 && sources.size >= 2, 'one order, invoices of different types');
  assert.ok(new Set(multi.covers.map((i) => st.payer[i])).size === 1, 'the invoices of one order share its debtor');
  assert.ok(!multi.contractNo, 'not tied to a contract');
  const c = caseOf(multi); assert.equal(c.refs.length, multi.covers.length); assert.equal(c.orderDocument.retrievable, false, 'Sanad document retrieval is declared NOT connected'); assert.equal(c.feed, 'synthetic_demo');
});

await test('Reference classification: invoice numbers are told apart from order, contract, account, IBAN, identity and amount figures; every page and table row is read', () => {
  const text = ['Enforcement order no: EN-5013', 'Debtor ID 1008640729', 'Contract reference: CT-2026-0087', 'Account no: 4410229981', 'IBAN SA0380000000608010167519', 'Total amount: 85,438,130.00 SAR', 'Invoice No | Type | Amount', 'INV-2025-0000179 | fines | 44,061,510.00 SAR', '0000095 | municipal', 'SADAD 101234567890', 'Violation no 12345678901234'];
  const r = extractFromText(text.join('\n'), 3); const by = (k) => r.filter((x) => x.kind === k).map((x) => x.value);
  assert.deepEqual(by('invoice_no'), ['INV-2025-0000179']); assert.deepEqual(by('order_no'), ['EN-5013']); assert.deepEqual(by('contract_no'), ['CT-2026-0087']); assert.deepEqual(by('bank_account'), ['SA0380000000608010167519']);
  assert.deepEqual(by('invoice_serial'), ['0000095'], 'a zero-padded serial under an Invoice heading'); assert.deepEqual(by('sadad_no'), ['101234567890']); assert.deepEqual(by('violation_no'), ['12345678901234']);
  assert.ok(by('other_number').includes('1008640729') && by('other_number').includes('4410229981'), 'identity and account numbers are never invoice references');
  assert.ok(!r.some((x) => x.value.includes('85') && isFinite(x.value) && x.kind !== 'other_number'), 'amounts are not references'); assert.ok(r.every((x) => x.page === 3));
  const ex = buildExtraction([{ page: 1, text: 'INV-2025-0000179' }, { page: 2, text: 'rows\nINV-2024-0000023\nINV-2025-0000179' }, { page: 3, text: '' }], 'text_layer', { orderNo: 'EN-5013' });
  assert.deepEqual(ex.refs.map((x) => `${x.value}@${x.occurrences.map((o) => o.page)}`), ['INV-2025-0000179@1,2', 'INV-2024-0000023@2']); assert.equal(ex.pages[2].needsOcr, true, 'a page with no text is reported as unread'); assert.equal(ex.pages[0].needsOcr, false);
  assert.equal(buildExtraction([{ page: 1, text: 'order EN-9999\nINV-2025-0000001' }], 'text_layer', { orderNo: 'EN-5013' }).orderNumberMismatch, true, 'a document that names another order is flagged');
  assert.equal(splitOcrText('a\fb').length, 2); assert.equal(splitOcrText('--- page 1 ---\nx\n--- page 2 ---\ny').length, 2);
});

await test('The PDF text layer is really read (all pages, tables included); a scanned page with no text layer is reported as unread — OCR is never simulated', async () => {
  const spec = 'pdfjs-dist/legacy/build/pdf.mjs'; const lib = await import(spec); const dir = 'public/samples/enforcement-orders/';
  const read = async (f) => { const { pages } = await readPdfPages(new Uint8Array(fs.readFileSync(dir + f)), lib); return buildExtraction(pages, 'text_layer', { orderNo: f.match(/EN-\d+/)[0] }); };
  const multi = await read('EN-5026-multi_partial_refs.pdf'); assert.equal(multi.pages.length, 2); assert.equal(multi.refs.length, 3, 'the invoices on the second page are read too'); assert.ok(multi.refs.some((r) => r.occurrences.some((o) => o.page === 2)));
  assert.ok(multi.others.some((o) => o.kind === 'contract_no') && multi.others.some((o) => o.value === '4410229981'), 'contract and account numbers are set apart'); assert.equal(multi.orderNumberMismatch, false);
  const scanned = await read('EN-5039-scanned.pdf'); assert.deepEqual(scanned.pages.map((p) => p.needsOcr), [false, true, true]); assert.equal(scanned.refs.length, 0);
  const wrong = await read('EN-5000-wrong-document.pdf'); assert.equal(wrong.orderNumberMismatch, true);
  const bytes = new Uint8Array(fs.readFileSync(dir + 'EN-5026-multi_partial_refs.pdf')); await readPdfPages(bytes, lib); assert.ok(bytes.length > 100, 'the caller keeps its own bytes (pdf.js gets a copy)');
});

await test('Reference resolution: exact invoice numbers match; a bare serial is ambiguous across years; a wrong number matches nothing and is never replaced by a similar one; non-invoice kinds are never matched', () => {
  const multi = orderOf('multi_exact'); const r = resolveFor(multi.covers.map((i) => ({ kind: 'invoice_no', value: idOfInv(i) })));
  assert.ok(r.results.every((x, k) => x.status === 'matched' && x.candidates[0].invoiceId === idOfInv(multi.covers[k]))); assert.ok(new Set(r.results.map((x) => x.candidates[0].source)).size >= 2, 'different invoice types');
  const amb = orderOf('serial_ambiguous'); const sa = resolveFor(amb.refs).results[0]; assert.equal(sa.status, 'ambiguous'); assert.ok(sa.candidates.length >= 2 && sa.weak); assert.ok(sa.candidates.some((k) => k.invoiceId === idOfInv(amb.covers[0])));
  const typo = orderOf('multi_typo_ref'); const rt = resolveFor(typo.refs); assert.deepEqual(rt.results.map((x) => x.status), ['matched', 'unmatched']); assert.equal(rt.results[1].candidates.length, 0, 'no “similar” invoice is substituted');
  const some = idOfInv(multi.covers[0]); const i0 = lookupId(st, some); const sad = resolveFor([{ kind: 'sadad_no', value: sadadOf(st.idKey[i0]) }, { kind: 'violation_no', value: '00000000000001' }, { kind: 'contract_no', value: 'CT-2026-0087' }, { kind: 'invoice_id_exact', value: 'INV-2026-0722' }]);
  assert.equal(sad.results[0].status, 'matched'); assert.equal(sad.results[0].candidates[0].invoiceId, some); assert.equal(sad.results[1].status, 'unmatched'); assert.equal(sad.results[2].status, 'not_invoice_reference'); assert.equal(sad.results[3].status, 'matched'); assert.equal(sad.results[3].candidates[0].invoiceId, 'INV-2026-0722', 'an exact id (a hand-anchored 4-digit one) is looked up as written, never padded to another invoice');
  const sum = r.results[0].candidates[0]; assert.ok(['overdue', 'partial', 'collected', 'not_due', 'cancelled', 'excluded'].includes(sum.paymentStatus) && sum.grossAmount > 0 && sum.payerName);
});

await test('Amount alone never matches: the same-debtor list is information only, the order amount is only compared with invoices matched by reference, and a discrepancy is reported — never closed by inventing a match', () => {
  const q = orderOf('amount_discrepancy'); const c = caseOf(q); assert.equal(c.links.length, 2, 'the two referenced invoices are linked'); const eff = buildEffectiveCases([c], emptyStore())[0];
  const rec = reconcile(eff); assert.equal(rec.state, 'short'); assert.ok(rec.difference > 0 && Math.abs(rec.difference - st.gross[q.hidden[0]]) < 1, 'the difference equals the invoice nobody referenced');
  const ms = orderMatchState(eff); assert.equal(ms.state, 'partial'); assert.ok(ms.reasons.includes('amount_short')); assert.notEqual(caseSummary(eff).state, 'linked', 'a partial match is never shown as a full match');
  const d = sameDebtorInvoices(st, { debtor: q.debtor, excludeIds: c.links.map((l) => l.invoiceId), cfg }); assert.ok(d.invoices.some((x) => x.invoiceId === idOfInv(q.hidden[0])), 'the unreferenced invoice is listed for investigation');
  const asked = resolveFor(c.refs).results; assert.ok(asked.every((x) => x.candidates.length === 1 && x.candidates[0].invoiceId !== idOfInv(q.hidden[0])), 'resolution never adds it');
});

await test('Order match state: matched only when every reference is accounted for AND the amounts reconcile; proposals, unread pages, unresolved references and amount differences each keep it partial', () => {
  const q = orderOf('multi_exact'); const base = caseOf(q);
  assert.equal(orderMatchState(buildEffectiveCases([base], emptyStore())[0]).state, 'matched');
  const part = orderOf('multi_partial_refs'); const pc = caseOf(part); const peff = buildEffectiveCases([pc], emptyStore())[0];
  assert.equal(orderMatchState(peff).state, 'partial'); assert.equal(pc.refs.length, 1, 'Sanad supplied one reference of several'); assert.ok(reconcile(peff).difference > 0);
  const none = orderOf('multi_no_refs'); const neff = buildEffectiveCases([caseOf(none)], emptyStore())[0]; assert.equal(orderMatchState(neff).state, 'unmatched'); assert.equal(caseSummary(neff).state, 'unresolved');
  const typo = caseOf(orderOf('multi_typo_ref')); const teff = buildEffectiveCases([typo], emptyStore())[0]; assert.equal(orderMatchState(teff).state, 'partial'); assert.equal(unresolvedReferences(teff).length, 1, 'the wrong reference stays unresolved');
  let store = emptyStore(); const en = part.enforceNum; const o = { by: 'rev', at: '2026-10-08T10:00:00Z', orderStatus: 'open' };
  const doc = { id: 'h1', name: 'x.pdf', size: 1, addedAt: o.at, extraction: buildExtraction([{ page: 1, text: 'INV-2025-0000001' }, { page: 2, text: '' }], 'text_layer') };
  store = recordDocument(store, en, doc, o).store; const withDoc = buildEffectiveCases([pc], store)[0]; const m1 = orderMatchState(withDoc);
  assert.ok(m1.reasons.includes('document_pages_unread') && m1.reasons.includes('unresolved_references'), 'an unread page and a new reference keep it partial'); assert.equal(m1.gaps[0].page, 2);
  store = recordSupplementalExtraction(store, en, 'h1', buildExtraction([{ page: 2, text: 'no invoice here' }], 'manual_entry'), o).store; assert.equal(orderMatchState(buildEffectiveCases([pc], store)[0]).gaps.length, 0, 'supplied text closes the page gap');
});

await test('Link lifecycle: a proposal has NO effect; only a confirmed link reflects the order status; ambiguous / conflicting links need a written reason; rejection and withdrawal keep their history', () => {
  const q = orderOf('serial_ambiguous'); const c = caseOf(q); const en = c.enforceNum; const cand = resolveFor(q.refs).results[0].candidates; const o = (at) => ({ by: 'Reviewer A', at, orderStatus: 'open' });
  const conf = (x) => ['ambiguous_reference', ...(x.payerIdx !== q.debtor ? ['debtor_mismatch'] : [])]; const mk = (x) => ({ invoiceId: x.invoiceId, origin: 'manual_selection', gross: x.grossAmount, evidence: [{ refKind: 'invoice_serial', refValue: q.refs[0].value }], conflicts: conf(x) });
  let store = proposeLink(emptyStore(), en, mk(cand[0]), o('2026-10-08T09:00:00Z')).store;
  let cases = buildEffectiveCases([c], store); assert.deepEqual(invoiceStatusMap(cases), { [cand[0].invoiceId]: 'candidate' }, 'a proposal is sent as «candidate» (no category change)'); assert.equal(invoiceEnforcement(cand[0].invoiceId, cases).confirmed.length, 0); assert.equal(invoiceEnforcement(cand[0].invoiceId, cases).proposed.length, 1);
  assert.equal(confirmLink(store, en, cand[0].invoiceId, { ...o('2026-10-08T09:05:00Z'), note: 'same debtor and the amount equals the order' }).error, 'unresolved_conflict', 'a written reason NEVER makes a conflicting / ambiguous link acceptable'); assert.deepEqual(unresolvedConflicts(['weak_reference', 'linked_to_other_order'], []), [], 'warnings do not block'); assert.deepEqual(unresolvedConflicts(['debtor_mismatch'], []), ['debtor_mismatch']);
  const evidence = conf(cand[0]).map((x) => ({ conflict: x, by: 'supporting_evidence', evidence: { page: 1 } }));
  store = confirmLink(store, en, cand[0].invoiceId, { ...o('2026-10-08T09:06:00Z'), note: 'resolved by evidence', input: { ...mk(cand[0]), resolvedConflicts: evidence } }).store; cases = buildEffectiveCases([c], store);
  assert.deepEqual(invoiceStatusMap(cases), { [cand[0].invoiceId]: 'open' }); assert.equal(invoiceEnforcement(cand[0].invoiceId, cases).status, 'open'); assert.equal(invoiceEnforcement(cand[1].invoiceId, cases).status, null, 'the other candidate is untouched');
  const susp = buildEffectiveCases([{ ...c, requestStatus: 'موقوف' }], store); assert.equal(invoiceStatusMap(susp)[cand[0].invoiceId], 'suspended'); assert.equal(invoiceStatusMap(buildEffectiveCases([{ ...c, requestStatus: 'مغلق' }], store))[cand[0].invoiceId], 'closed');
  assert.equal(rejectLink(store, en, cand[0].invoiceId, { ...o('x'), note: 'n' }).error, 'use_remove', 'a confirmed link is withdrawn, not rejected'); assert.equal(removeLink(store, en, cand[0].invoiceId, { ...o('x'), note: '' }).error, 'note_required');
  store = removeLink(store, en, cand[0].invoiceId, { ...o('2026-10-08T10:00:00Z'), note: 'wrong year' }).store; assert.deepEqual(invoiceStatusMap(buildEffectiveCases([c], store)), {}, 'withdrawing removes the effect');
  store = rejectLink(store, en, cand[1].invoiceId, { ...o('2026-10-08T10:01:00Z'), note: 'other payer', input: mk(cand[1]) }).store;
  const hist = buildEffectiveCases([c], store)[0].history.map((h) => h.action); assert.deepEqual(hist, ['rejected', 'removed', 'confirmed', 'proposed'], 'every step is kept, newest first');
  const chg = confirmLink(store, en, cand[0].invoiceId, { ...o('2026-10-09T10:00:00Z'), note: 'again', orderStatus: 'suspended' }).store; assert.ok(chg.orders[en].history.some((h) => h.action === 'order_status_changed' && h.detail.from === 'open' && h.detail.to === 'suspended'), 'a change of the order status since the last record is logged');
  const fed = caseOf(orderOf('single')); const fedId = fed.links[0].invoiceId; assert.equal(removeLink(emptyStore(), fed.enforceNum, fedId, { ...o('x'), note: 'r' }).error, 'not_confirmed');
  const wd = removeLink(emptyStore(), fed.enforceNum, fedId, { ...o('2026-10-08T11:00:00Z'), note: 'the reference is a typing error', base: fed.links[0] }).store; assert.deepEqual(invoiceStatusMap(buildEffectiveCases([fed], wd)), {}, 'a link from the Sanad feed can be withdrawn; the withdrawal is recorded over it');
  assert.equal(unresolvedReferences(buildEffectiveCases([fed], wd)[0]).length, 0, 'the withdrawn reference stays accounted for by that decision');
  assert.ok(validStoreShape(store)); assert.equal(validStoreShape({ v: 1, orders: { x: { links: { a: { invoiceId: 'a', status: 'weird' } }, history: [] } } }), false);
});

await test('Engine: the collection category and the payment status follow the FINANCIAL state only — an enforcement link (open, suspended, closed or merely proposed) never moves an invoice between uncollected categories; enforcement is its own dimension', () => {
  const q = orderOf('single'); const i = q.covers[0]; const id = idOfInv(i); const run = (links) => detail(st, i, makeCtx(st, { cfg, links }));
  const base = run({});
  for (const s of ['candidate', 'closed', 'open', 'suspended', 'confirmed']) {
    const x = run({ [id]: s }); assert.equal(JSON.stringify(x.cls), JSON.stringify(base.cls), `${s}: category unchanged`);
    assert.deepEqual([x.derived.payStatus, x.derived.outstanding, x.derived.collected], [base.derived.payStatus, base.derived.outstanding, base.derived.collected], `${s}: payment figures unchanged`);
  }
  const sc = { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all' };
  const uncollected = (links) => snapshot(st, { scope: sc, cfg, links }).stock.netUncollected;
  for (const s of ['candidate', 'closed', 'open', 'suspended']) assert.equal(uncollected({ [id]: s }), uncollected({}), `${s}: net uncollected unchanged`);
  const cat = (links, status) => snapshot(st, { scope: { ...sc, status }, cfg, links }).totals.count;
  assert.equal(cat({ [id]: 'open' }, 'overdue'), cat({}, 'overdue'), 'still in the overdue view while an order is open'); assert.equal(cat({ [id]: 'closed' }, 'overdue'), cat({}, 'overdue'), 'closing the order does not remove an unpaid invoice from the uncollected view'); assert.equal(cat({ [id]: 'open' }, 'enforcement'), 0, 'enforcement is no longer a collection category');
  const e = (links) => snapshot(st, { scope: sc, cfg, links }).stock.enforcement; assert.deepEqual([e({ [id]: 'open' }).inExecution.count, e({ [id]: 'suspended' }).suspended.count, e({ [id]: 'closed' }).closedOnly.count], [1, 1, 1], 'the dimension is reported apart, suspended separately from in-execution');
  assert.ok(snapshot(st, { scope: sc, cfg, links: { [id]: 'open' } }).equation.ok, 'the approved identities still hold');
  // an invoice cancelled in the source but referred to enforcement stays an uncollected invoice — also after the order closes
  let ci = -1; for (let k = 0; k < st.nGen; k += 1) if (st.cancelDay[k] && st.cancelDay[k] <= dayNum(TODAY)) { ci = k; break; }
  if (ci >= 0) { const cid = idOfInv(ci); const x0 = detail(st, ci, makeCtx(st, { cfg, links: {} })); assert.equal(x0.derived.payStatus, 'cancelled'); for (const s of ['open', 'suspended', 'closed']) assert.notEqual(detail(st, ci, makeCtx(st, { cfg, links: { [cid]: s } })).derived.payStatus, 'cancelled', `${s}: a confirmed referral keeps the invoice uncollected`); assert.equal(detail(st, ci, makeCtx(st, { cfg, links: { [cid]: 'candidate' } })).derived.payStatus, 'cancelled', 'a proposal changes nothing'); }
  assert.equal(list(st, { scope: sc, cfg, filters: { exec: 'inexec' }, links: { [id]: 'open' }, page: 0, pageSize: 1000 }).rows.some((r) => r.id === id), true);
  for (const [f, s2, expect] of [['suspended', 'suspended', true], ['inexec', 'suspended', false], ['closed', 'closed', true], ['ever', 'closed', true], ['none', 'closed', false], ['ever', 'candidate', false]]) assert.equal(list(st, { scope: sc, cfg, filters: { exec: f }, links: { [id]: s2 }, page: 0, pageSize: 1000 }).rows.some((r) => r.id === id), expect, `filter ${f} with ${s2}`);
});

await test('Backup: enforcement work (links, document records, extracted references, history) is included and validated; an older backup never removes it; the PDF bytes are not part of the file', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const a = mem(); const store = proposeLink(emptyStore(), 'EN-5000', { invoiceId: 'INV-2025-0000001', origin: 'document_text_layer', gross: 5 }, { by: 'x', at: '2026-10-08T10:00:00Z', orderStatus: 'open' }).store; a.setItem('ib_enforcement_v1', JSON.stringify(store));
  const b = buildBackup(a); assert.deepEqual(b.data.ib_enforcement_v1, store); const v = validateBackup(b); assert.equal(v.ok, true); assert.equal(v.summary.enforcementOrders, 1);
  const t = mem(); applyBackup(JSON.parse(JSON.stringify(b)), t); assert.deepEqual(JSON.parse(t.getItem('ib_enforcement_v1')), store, 'round-trips');
  const old = buildBackup(mem()); assert.ok(!('ib_enforcement_v1' in old.data)); applyBackup(old, t); assert.ok(t.getItem('ib_enforcement_v1'), 'a backup made before this feature does not delete the enforcement records');
  assert.equal(applyBackup({ ...b, data: { ...b.data, ib_enforcement_v1: { v: 1, orders: { x: { links: [] } } } } }, mem()).ok, false, 'a malformed record is rejected before anything is written');
});

/* ------------------------------------------------------------ full-page records: one relationship model, enforcement status, completeness, evidence */
await test('Record addresses: one builder per record type (invoice, order, contract) — no query-string drawer addresses', () => {
  assert.equal(invoicePath('INV-2025-0000111'), '/invoices/INV-2025-0000111'); assert.equal(orderPath('EN-5013'), '/enforcement-orders/EN-5013'); assert.equal(contractPath('CT-2023-0013'), '/contracts/CT-2023-0013');
  assert.equal(invoicePath('A B/C'), '/invoices/A%20B%2FC');
});

await test('Enforcement status keeps four things apart: historical referral, current enforcement, each order\'s status, payment status; closing or withdrawing one order never removes another confirmed order\'s effect', () => {
  const c1 = { enforceNum: 'EN-A', requestStatus: 'مغلق', amount: 10, closeReason: null, links: [{ invoiceId: 'INV-X', status: 'confirmed' }] };
  const c2 = { enforceNum: 'EN-B', requestStatus: 'قيد التنفيذ', amount: 20, links: [{ invoiceId: 'INV-X', status: 'confirmed' }, { invoiceId: 'INV-Y', status: 'candidate' }] };
  let e = enforcementOf('INV-X', [c1, c2]);
  assert.equal(e.referredEver, true); assert.equal(e.current, 'in_execution'); assert.equal(e.confirmed.length, 2); assert.deepEqual(e.confirmed.map((o) => o.orderStatus), ['closed', 'open']); assert.equal(e.confirmed[0].closeReason, null, 'unknown closure reason stays unknown');
  assert.deepEqual(invoiceStatusMap([c1, c2]), { 'INV-X': 'open', 'INV-Y': 'candidate' });
  // the open order is withdrawn: the closed one remains a historical referral, nothing is open any more
  const w = { ...c2, links: c2.links.map((l) => (l.invoiceId === 'INV-X' ? { ...l, status: 'rejected' } : l)) }; e = enforcementOf('INV-X', [c1, w]);
  assert.equal(e.current, 'none'); assert.equal(e.referredEver, true, 'closing/withdrawing does not erase the referral'); assert.equal(e.closedOnly, true);
  // the CLOSED order is withdrawn instead: the open order keeps its full effect
  const w1 = { ...c1, links: [{ invoiceId: 'INV-X', status: 'rejected' }] }; e = enforcementOf('INV-X', [w1, c2]); assert.equal(e.current, 'in_execution'); assert.equal(invoiceStatusMap([w1, c2])['INV-X'], 'open');
  const n = enforcementCounts([c1, c2]); assert.deepEqual([n.inExecution, n.everReferred, n.open, n.closedOnly, n.proposedOnly], [1, 1, 1, 0, 1], 'unique invoices: INV-X counted once although it carries two orders');
  assert.equal(enforcementOf('INV-Z', [c1, c2]).referredEver, false); assert.equal(buildIndex([c1, c2]).get('INV-X').orders.length, 2);
  assert.deepEqual(ordersOfContract('CT-1', ['INV-X', null], [c1, c2, { enforceNum: 'EN-C', contractNo: 'CT-1', links: [] }]).map((o) => [o.enforceNum, o.contractLevel]), [['EN-A', false], ['EN-B', false], ['EN-C', true]], 'orders of a contract: via its invoices, and contract-level requests that name its number');
  assert.deepEqual(ordersOfContract('CT-9', ['INV-Q'], [c1, c2]), [], 'nothing is inferred');
});

await test('Report counts are explicit: the data service returns open-order and ever-referred counts by UNIQUE invoice; a closed-only invoice is ever-referred but not open; payment figures never move', () => {
  const q = orderOf('single'); const id = idOfInv(q.covers[0]); const sc = { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all' };
  const E = (links) => snapshot(st, { scope: sc, cfg, links }).stock; const base = E({});
  assert.deepEqual([base.enforcement.open.count, base.enforcement.everReferred.count], [0, 0]);
  const closed = E({ [id]: 'closed' }); assert.deepEqual([closed.enforcement.open.count, closed.enforcement.closedOnly.count, closed.enforcement.everReferred.count], [0, 1, 1]);
  const open = E({ [id]: 'open' }); assert.deepEqual([open.enforcement.inExecution.count, open.enforcement.everReferred.count], [1, 1]); const susp = E({ [id]: 'suspended' }); assert.equal(susp.enforcement.open.count, 1);
  assert.equal(E({ [id]: 'candidate' }).enforcement.everReferred.count, 0, 'a proposal is not a referral');
  assert.equal(open.netUncollected, base.netUncollected, 'enforcement never changes the balance'); assert.equal(closed.netUncollected, base.netUncollected);
  assert.ok(open.enforcement.open.outstanding > 0);
});

await test('Closure reasons come only from the feed (never a payment reason) and are unknown otherwise; one invoice carries a closed AND an open order in the demo feed', () => {
  const closed = feedCases.filter((c) => c.requestStatus === 'مغلق' && c.feed === 'synthetic_demo' && c.enforceNum.startsWith('EN-5'));
  assert.ok(closed.length >= 2 && closed.some((c) => c.closeReason) && closed.some((c) => !c.closeReason), 'some closure reasons known, some unknown');
  for (const c of feedCases) { if (c.requestStatus !== 'مغلق') assert.equal(c.closeReason ?? null, null); else assert.ok([null, 'withdrawn_by_authority', 'order_expired', 'replaced_by_other_order'].includes(c.closeReason ?? null)); }
  const first = orderOf('single'); assert.equal(first.status, 'مغلق'); const dup = st.requests.filter((r) => r.archetype === 'duplicate_across_orders'); assert.ok(dup.length && dup.every((r) => r.status !== 'مغلق') && dup.some((r) => r.covers.includes(first.covers[0])), 'a later order names the same invoice as the closed one');
});

await test('Three completeness states are separate: references complete while the amount differs; extraction incomplete while references are complete; no document is not "complete"', () => {
  const q = orderOf('amount_discrepancy'); const eff = buildEffectiveCases([caseOf(q)], emptyStore())[0]; const m = orderCompleteness(eff);
  assert.equal(m.references.state, 'complete', 'every reference found is confirmed — the amount is not required'); assert.equal(m.finance.state, 'short'); assert.equal(m.extraction.state, 'no_document');
  const doc = { id: 'd1', name: 'x.pdf', size: 1, addedAt: 'a', extraction: buildExtraction([{ page: 1, text: 'INV-2025-0000001' }, { page: 2, text: '' }], 'text_layer') };
  const o = { by: 'r', at: '2026-10-08T10:00:00Z', orderStatus: 'open' }; let store = recordDocument(emptyStore(), q.enforceNum, { ...doc, extraction: buildExtraction([{ page: 1, text: `${caseOf(q).refs[0].value} and more text here` }, { page: 2, text: '' }], 'text_layer') }, o).store;
  const e2 = orderCompleteness(buildEffectiveCases([caseOf(q)], store)[0]); assert.equal(e2.extraction.state, 'incomplete'); assert.equal(e2.references.state, 'complete'); assert.equal(e2.finance.state, 'short');
  const full = orderOf('multi_exact'); const f = orderCompleteness(buildEffectiveCases([caseOf(full)], emptyStore())[0]); assert.deepEqual([f.references.state, f.finance.state, f.extraction.state], ['complete', 'reconciled', 'no_document'], 'reconciled and referenced, but no document was read: not the same as complete extraction');
  assert.equal(orderCompleteness(buildEffectiveCases([caseOf(orderOf('multi_no_refs'))], emptyStore())[0]).references.state, 'none');
});

await test('Conflicts are resolved by EVIDENCE only: an ambiguous serial is settled by another reference that names one invoice; a debtor mismatch only by a document naming the payer; a reason never helps', () => {
  const q = orderOf('serial_ambiguous'); const c = caseOf(q); const cand = resolveFor(q.refs).results[0].candidates; const exact = cand.find((x) => x.invoiceId === idOfInv(q.covers[0]));
  const doc = { id: 'dx', name: 'o.pdf', size: 1, addedAt: 'a', extraction: buildExtraction([{ page: 1, text: `Invoice ${exact.invoiceId}\nDebtor ID ${exact.payerId}` }], 'text_layer', { orderNo: q.enforceNum }) };
  const eff0 = buildEffectiveCases([c], emptyStore())[0];
  const rowsOf = (eff, docs) => { const refs = collectReferences(eff, docs).filter((r) => ['invoice_no', 'invoice_serial'].includes(r.kind)); const asked = resolveFor(refs.map((r) => ({ kind: r.kind, value: r.value }))).results; return buildRows(eff, refs, asked, eff.links, new Map(), new Set(), docs); };
  const before = rowsOf(eff0, []); assert.equal(before[0].status, 'ambiguous'); assert.ok(before[0].unresolved[cand[0].invoiceId].includes('ambiguous_reference'), 'cannot be confirmed as it stands');
  const after = rowsOf(eff0, [doc]); const serialRow = after.find((r) => r.kind === 'invoice_serial'); assert.equal(serialRow.status, 'resolved_by_reference'); assert.equal(serialRow.candidates.length, 1); assert.equal(serialRow.candidates[0].invoiceId, exact.invoiceId); assert.equal(serialRow.unresolved[exact.invoiceId].length, 0);
  const exactRow = after.find((r) => r.kind === 'invoice_no'); assert.equal(exactRow.status, 'matched');
  // a candidate whose payer is not the order debtor: unresolved unless a document names that payer's identity number
  const other = cand.find((x) => x.payerIdx !== q.debtor);
  if (other) { const b = before[0].unresolved[other.invoiceId]; assert.ok(b.includes('debtor_mismatch')); const named = { id: 'dy', name: 'p.pdf', size: 1, addedAt: 'a', extraction: buildExtraction([{ page: 2, text: `Joint debtor ID ${other.payerId}` }], 'text_layer', { orderNo: q.enforceNum }) }; const withId = rowsOf(eff0, [named])[0]; assert.ok(!withId.unresolved[other.invoiceId].includes('debtor_mismatch') && withId.resolved[other.invoiceId].length === 1); }
});

await test('Repeated references across pages and documents and different forms of the same invoice are deduplicated: evidence is kept, the invoice amount is counted once', () => {
  const q = orderOf('multi_exact'); const c = caseOf(q); const id0 = idOfInv(q.covers[0]); const i0 = lookupId(st, id0);
  const d1 = { id: 'a1', name: 'a.pdf', size: 1, addedAt: 'a', extraction: buildExtraction([{ page: 1, text: id0 }, { page: 3, text: `again ${id0}\nSADAD ${sadadOf(st.idKey[i0])}` }], 'text_layer', { orderNo: q.enforceNum }) };
  const d2 = { id: 'b2', name: 'b.pdf', size: 1, addedAt: 'a', extraction: buildExtraction([{ page: 2, text: id0 }], 'ocr_import', { orderNo: q.enforceNum }) };
  const eff = { ...buildEffectiveCases([c], emptyStore())[0], docs: [d1, d2] }; const refs = collectReferences(eff, [d1, d2]).filter((r) => r.key === `invoice_no|${id0}`);
  assert.equal(refs.length, 1, 'one reference'); assert.equal(refs[0].origins.length, 3, 'with every place it was found: Sanad, a.pdf (pages 1 and 3), b.pdf (imported OCR text, page 2)'); assert.deepEqual(refs[0].origins.find((o) => o.docId === 'a1').pages, [1, 3]); assert.ok(refs[0].origins.some((o) => o.type === 'document_ocr_import'));
  const asked = resolveFor(collectReferences(eff, [d1, d2]).filter((r) => ['invoice_no', 'sadad_no'].includes(r.kind)).map((r) => ({ kind: r.kind, value: r.value }))).results;
  const rows = buildRows(eff, collectReferences(eff, [d1, d2]).filter((r) => ['invoice_no', 'sadad_no'].includes(r.kind)), asked, eff.links, new Map(), new Set(), [d1, d2]);
  assert.ok(rows.some((r) => r.status === 'duplicate_reference' && r.kind === 'sadad_no'), 'the SADAD number of the same invoice is a duplicate reference');
  assert.equal(reconcile(eff).confirmedTotal, q.covers.reduce((s, i) => s + st.gross[i], 0), 'amounts are counted once per invoice');
});

await test('Arabic PDFs: a digital Arabic PDF is read (numbers robust across pages and the table); an Arabic SCANNED PDF has no text layer and stays «not read» — nothing is OCR\'d by this system', async () => {
  const spec = 'pdfjs-dist/legacy/build/pdf.mjs'; const lib = await import(spec); const dir = 'public/samples/enforcement-orders/';
  const read = async (f) => { const { pages } = await readPdfPages(new Uint8Array(fs.readFileSync(dir + f)), lib); return { pages, ex: buildExtraction(pages, 'text_layer', { orderNo: 'EN-5013' }) }; };
  const dig = await read('ar-EN-5013-digital.pdf'); assert.equal(dig.pages.length, 2); assert.ok(/[؀-ۿ]/.test(dig.pages[0].text), 'a real Arabic text layer');
  assert.deepEqual(dig.ex.refs.map((r) => r.value), ['INV-2025-0000179', 'INV-2024-0000023', 'INV-2025-0000095']); assert.ok(dig.ex.refs[2].occurrences[0].page === 2, 'the table row on page 2 is read');
  assert.ok(dig.ex.others.some((o) => o.kind === 'contract_no') && dig.ex.others.some((o) => o.value === '1008640729' && o.label === 'person'), 'contract and identity numbers are set apart'); assert.equal(dig.ex.orderNumberMismatch, false);
  const sc = await read('ar-EN-5143-scanned.pdf'); assert.deepEqual(sc.ex.pages.map((p) => p.needsOcr), [true, true]); assert.equal(sc.ex.refs.length, 0);
  assert.deepEqual(extractFromText('رقم الفاتورة ١٢٣٤٥٦٧\nفاتورة ٠٠٠٠٠٩٥').map((r) => r.value), ['1234567', '0000095'], 'Arabic-Indic digits are read as Latin digits'); assert.deepEqual(extractFromText('الرصيد ٦٦٩٩٢٦٧').filter((r) => r.kind === 'invoice_serial'), [], 'a bare 7-digit figure with no invoice label is not a serial');
});

await test('Backup restore with missing PDFs: the extracted references, page evidence and confirmed links survive; the order reports the file as unavailable; the original is associated again only after an identity check', () => {
  const q = orderOf('multi_partial_refs'); const c = caseOf(q); const o = { by: 'r', at: '2026-10-08T10:00:00Z', orderStatus: 'open' };
  const ex = buildExtraction([{ page: 1, text: `${c.refs[0].value}\nINV-2025-0000999` }, { page: 2, text: 'INV-2025-0000888 on page two' }], 'text_layer', { orderNo: q.enforceNum });
  let store = recordDocument(emptyStore(), q.enforceNum, { id: 'f'.repeat(64), name: 'order.pdf', size: 10, kind: 'uploaded', addedAt: o.at, fileStored: true, extraction: ex }, o).store;
  store = proposeLink(store, q.enforceNum, { invoiceId: 'INV-2025-0000999', origin: 'document_text_layer', gross: 5, evidence: [{ refKind: 'invoice_no', refValue: 'INV-2025-0000999', docId: 'f'.repeat(64), docName: 'order.pdf', pages: [1] }] }, o).store;
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const a = mem(); a.setItem('ib_enforcement_v1', JSON.stringify(store)); const b = buildBackup(a); const t = mem(); assert.equal(applyBackup(JSON.parse(JSON.stringify(b)), t).ok, true);
  const restored = JSON.parse(t.getItem('ib_enforcement_v1')); const eff = buildEffectiveCases([c], restored)[0];
  assert.equal(eff.docs.length, 1); assert.equal(eff.docs[0].extraction.refs.length, 3); assert.deepEqual(eff.docs[0].extraction.refs.find((r) => r.value === 'INV-2025-0000888').occurrences.map((x) => x.page), [2], 'page references survive');
  assert.ok(evidenceForInvoice('INV-2025-0000999', [eff]).some((e) => e.page === 1 && e.docName === 'order.pdf'), 'the evidence (document, page, line) survives without the PDF bytes');
  assert.ok(!('bytes' in eff.docs[0]) && JSON.stringify(b).indexOf('%PDF') < 0, 'the backup holds no PDF content');
  const r = recordFileRestored(restored, q.enforceNum, 'f'.repeat(64), { ...o, name: 'order.pdf' }); assert.equal(r.error, null); assert.ok(r.store.orders[q.enforceNum].history.some((h) => h.action === 'document_file_restored'));
  assert.equal(recordFileRestored(restored, q.enforceNum, 'e'.repeat(64), o).error, 'document_not_found', 'a different identity is not associated');
});

await test('Enforcement management: matching-review exceptions are typed and counted per order; a contract-level request is an exception of its own and is never spread over invoices', () => {
  const ex = (arch, nth = 0) => orderExceptions(buildEffectiveCases([caseOf(orderOf(arch, nth))], emptyStore())[0]);
  assert.ok(ex('amount_discrepancy').includes('amount_difference')); assert.ok(ex('multi_no_refs').includes('no_references')); assert.ok(ex('multi_typo_ref').includes('unresolved_references')); assert.ok(ex('serial_ambiguous').includes('unresolved_references'));
  assert.deepEqual(ex('multi_exact'), [], 'a fully referenced, reconciled order has no exception');
  const contractLevel = feedCases.find((c) => c.contractNo && !c.refs.length); if (contractLevel) assert.deepEqual(orderExceptions(buildEffectiveCases([contractLevel], emptyStore())[0]), ['contract_level_only']);
  const prop = { enforceNum: 'EN-P', amount: 5, links: [{ invoiceId: 'INV-Z', status: 'candidate', gross: 5, conflicts: ['debtor_mismatch'], resolvedConflicts: [] }], refs: [{ kind: 'invoice_no', value: 'INV-Z' }] };
  const e = orderExceptions(prop); assert.ok(e.includes('conflicts') && e.includes('proposals_pending')); assert.ok(e.every((k) => EXCEPTION_TYPES.includes(k)));
});

await test('Arabic presentation-form text (as a PDF text layer returns it) is normalised before labels are looked for; the three sample invoice PDFs of the first demo are digital PDFs and are read', async () => {
  assert.deepEqual(extractFromText('ﺭﻗﻢ ﺍﻟﻔﺎﺗﻮﺭﺓ ١٢٣٤٥٦٧').map((r) => [r.kind, r.value]), [['invoice_serial', '1234567']], 'presentation forms of «رقم الفاتورة» are recognised as an invoice label');
  const spec = 'pdfjs-dist/legacy/build/pdf.mjs'; const lib = await import(spec);
  const { pages } = await readPdfPages(new Uint8Array(fs.readFileSync('public/samples/invoice_normal_alrajhi.pdf')), lib); const ex = buildExtraction(pages, 'text_layer'); assert.deepEqual(ex.refs.map((r) => r.value), ['INV-2026-0731']); assert.equal(ex.pages[0].needsOcr, false);
});

console.log(`\n${passed} tests passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
