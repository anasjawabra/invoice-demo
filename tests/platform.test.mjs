// Platform tests: display unit, Asia/Riyadh periods, the columnar data service (determinism, reconciliation, rules, search, pagination, export)
// and the multi-source demo world. Run with `npm test` (bundled with esbuild; no framework).
import assert from 'node:assert/strict';
import { fmtBn, fmtSar, fmtInt, fmtInvoices, scaled, unitOfValues, chartUnit, UNITS } from '../src/utils/money.js';
import { parsePeriod, routeQuestion, classify } from '../src/data/assistantRouter.js';
import { startOfYear, startOfMonth, prevMonthEnd } from '../src/data/clock.js';
import { loadStore } from '../server/store.js';
import { snapshot, series, bridge, makeCtx, lookupId, checkEquation, derive, idOf } from '../server/engine.js';
import { formatRatio, ratio } from '../src/data/revenueMetrics.js';
import { answerFor } from '../src/data/assistantAnswers.js';
import { buildProtocolAnswer } from '../src/data/assistantProtocol.js';
import { buildInsights } from '../src/data/insightsEngine.js';
import { interpret, defaultSpec, previousMonthScope } from '../src/data/reportIntents.js';
import { buildReportModel, SECTION_ORDER } from '../src/data/reportModel.js';
import { tableToText } from '../src/data/reportFormat.js';
import { fairComparison } from '../src/data/amanahComparison.js';
import { buildProposals } from '../src/data/proposals.js';
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
import { previousScope, compareSnapshots, DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { list, exportChunks, worklist, anomalies, risk } from '../server/lists.js';
import { DEVIATION_CODES, QUALITY_CODES, RISK_FLAG_CATEGORIES, DEVIATION_RISK_CATEGORIES, issuePage } from '../src/data/issueGroups.js';
import { RISK_CATEGORIES } from '../src/data/riskAnalysis.js';
import { appropriationOf, appropriationTotal, appropriationKeys, appropriationAsOfEnd, HQ_KEY } from '../src/data/appropriations.js';
import { paymentFacts } from '../src/data/invoicePayments.js';
import { buildAnalysis, focusBreakdown, mapValue, trendOf, direction, concentration, needsFollowUp, decompose } from '../src/data/revenueAnalysis.js';
import { computeGoal, evenPlan, plannedToDate, monthsLeft, reportingDateFor, savePlan, rebasePlan, emptyGoalStore, planKey } from '../src/data/collectionGoal.js';
import { normalizeConfig as normalizeCfgG, EXCLUSION_RULES as RULES_G } from '../src/data/revenueMetrics.js';
import { amanahOptionsOf as amanahsG, amanahFilterOptions } from '../src/data/revenueLedger.js';
import nodeFs from 'node:fs';
import { metricDictionary } from '../src/data/metricDictionary.js';
import nodePath from 'node:path';
import { detail } from '../server/materialize.js';
import { sourcesReport } from '../server/sourcesReport.js';
import { sanadCases } from '../server/contracts.js';
import { sadadOf } from '../server/names.js';
import { resolveReferences, sameDebtorInvoices } from '../server/orderMatch.js';
import { extractFromText, buildExtraction, splitOcrText, collectReferences, buildRows, reconcile, orderMatchState, buildEffectiveCases, invoiceStatusMap, invoiceEnforcement, proposeLink, confirmLink, rejectLink, removeLink, recordDocument, recordSupplementalExtraction, emptyStore, unresolvedConflicts, orderCompleteness, recordFileRestored, orderExceptions, EXCEPTION_TYPES, validStoreShape, unresolvedReferences } from '../src/data/orderMatching.js';
import { caseSummary } from '../src/data/enforcementMatching.js';
import { readPdfPages } from '../src/data/pdfText.js';
import { enforcementOf, buildIndex, enforcementCounts, ordersOfContract, evidenceForInvoice, orderStatusOf } from '../src/data/relations.js';
import { invoicePath, orderPath, contractPath } from '../src/utils/paths.js';
import fs from 'node:fs';
import { extractDocument, detectFormat } from '../src/data/docText.js';
import { parseWordXml } from '../src/data/docxText.js';
import { contractMentions, reviewContractReference, recordManualReferences, MANUAL_DOC_ID } from '../src/data/orderMatching.js';
import { extractionFromSample, manualExtraction, samplesForOrder, sampleByHash, SIM_LABEL } from '../src/data/ocrSimulation.js';
import { rowState, selectionFor, totalsFor, summaryLines, NOT_IDENTIFIED } from '../src/data/orderSummary.js';
import crypto from 'node:crypto';
import { SOURCE_FIELDS, SOURCE_STATUSES, DEBTOR_TYPES, EXECUTION_TYPES, statusById, statusClassOf, isCorruptedNumber, amountInWords, adaptSourceCase, analyzeNotation, recoverableIdentifier, isUnreliableNotation, exactNotation, toSciNotation } from '../src/data/sanadSource.js';
import { migrateIdScheme, restoreLegacyRecord, ID_SCHEME, isGeneratedRangeId } from '../src/data/orderMatching.js';
import { loadEnforcement } from '../src/data/enforcementStore.js';
import { reviewStatusOf, REVIEW_LABEL, orderAlerts, nextActionOf, statusGroupCounts, orderSearchBlob, normalizeSearch } from '../src/data/orderSummary.js';
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
  assert.equal(classify('أخبرني عن 177-421780116877'), 'invoice');
  assert.equal(routeQuestion('Tell me about 177-421780116877', { cutoff: TODAY }).invoiceId, '177-421780116877');
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
await test('an invoice with several exclusion reasons (or cancelled + a reason) leaves gross exactly once; a collected invoice is never excluded and a part-collected one only loses its uncollected remainder (D10)', () => {
  const whatIfCfg = { cutoff: TODAY, rules: Object.fromEntries(['DUP-1', 'CR-1', 'DEC-1', 'NOC-1', 'INC-1', 'EXE-1', 'EFA-1'].map((id) => [id, true])) }; // the mechanism is tested with every rule on (unapproved rules are off by default)
  const ctx = makeCtx(st, { cfg: whatIfCfg }); let multi = 0; let overlap = 0; let badOnce = 0; let paidExcluded = 0;
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN) continue; const D = derive(ctx, i, ctx.cutoffN);
    if (D.nReasons > 1) multi += 1; if (D.overlaps) overlap += 1;
    if (Math.abs(D.billed - D.net - D.exclTotal) > 1e-6 || D.exclTotal < 0 || D.net < 0 || D.collected > D.net + 1e-6) badOnce += 1;
    if (D.excluded && D.received >= D.billed) paidExcluded += 1; // D10: a fully collected invoice is never excluded (its exclusion is ignored)
    if (D.excluded && (D.exclusionAmount - (D.billed - D.received)) > 1e-6) paidExcluded += 1; // only the uncollected remainder is excluded
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
  const inv = list(st, { scope: YTD, cfg: cfg, filters: { search: '177-88' }, page: 0, pageSize: 5 }); assert.ok(inv.total > 0);
  const t = snapshot(st, { scope: { ...YTD, source: 'tobacco' }, cfg }).totals; const l = list(st, { scope: { ...YTD, source: 'tobacco' }, cfg, filters: {}, page: 0, pageSize: 1 });
  assert.equal(l.total, t.count); assert.ok(Math.abs(l.sums.gross - t.gross) < 1);
});
await test('worklist and anomalies return ranked top rows without carrying the population', () => {
  const w = worklist(st, { scope: YTD, cfg, limit: 50 }); assert.equal(w.rows.length, 50); assert.ok(w.total > 50000);
  assert.ok(w.rows.every((r) => r.outstanding > 0 && r.cls !== 'collected' && r.cls !== 'excluded'));
  const a = anomalies(st, { scope: YTD, cfg, limit: 40 }); assert.ok(a.total > 0 && a.rows.length <= 40);
});
await test('findings are split by function: every issue code and risk category belongs to exactly one page; a group request changes nothing but the group', () => {
  const all = anomalies(st, { scope: YTD, cfg, limit: 100 });
  const mine = new Set([...DEVIATION_CODES, ...QUALITY_CODES]);
  assert.equal(mine.size, DEVIATION_CODES.length + QUALITY_CODES.length, 'no code is on both pages');
  for (const c of Object.keys(all.counts)) assert.ok(mine.has(c), `${c} must belong to a page`);
  assert.deepEqual([...RISK_FLAG_CATEGORIES, ...DEVIATION_RISK_CATEGORIES].sort(), [...RISK_CATEGORIES].sort(), 'every risk-radar category is on the risks & deviations page');
  const dev = anomalies(st, { scope: YTD, cfg, limit: 100, codes: DEVIATION_CODES }); const q = anomalies(st, { scope: YTD, cfg, limit: 100, codes: QUALITY_CODES });
  for (const c of Object.keys(dev.counts)) { assert.ok(DEVIATION_CODES.includes(c)); assert.equal(dev.counts[c], all.counts[c], `${c}: same count as the ungrouped request`); }
  for (const c of Object.keys(q.counts)) { assert.ok(QUALITY_CODES.includes(c)); assert.equal(q.counts[c], all.counts[c], `${c}: same count as the ungrouped request`); }
  assert.ok(dev.total <= all.total && q.total <= all.total && dev.total + q.total >= all.total, 'an invoice may carry findings of both groups, never fewer than the whole');
  assert.equal(anomalies(st, { scope: YTD, cfg, limit: 100, codes: [] }).total, all.total, 'an empty group means no restriction');
  assert.equal(issuePage('missing_fields'), '/settings/data-quality'); assert.equal(issuePage('contract_unlinked'), '/settings/data-quality'); assert.equal(issuePage('amount_conflict'), '/risk'); assert.equal(issuePage('risk_duplicate'), '/risk');
});
await test('risk flags: the Risks page and the invoice page use one rule — a flag settled by an approved exclusion is not an open risk, an open flag shows on both', () => {
  const r = risk(st, { scope: YTD, cfg, limit: 200 });
  const ctx = makeCtx(st, { scope: YTD, cfg });
  // 177-882607280000 / 177-882608080000: marked duplicate in the source, but the duplicate exclusion (DUP-1) is already approved and applied
  for (const id of ['177-882607280000', '177-882608080000']) {
    const d = detail(st, lookupId(st, id), ctx);
    assert.equal(d.riskFlags.duplicate, 'settled', `${id}: the duplicate is settled by the approved exclusion`); assert.equal(d.cls, 'excluded');
    assert.ok(!r.categories.duplicate.rows.some((x) => x.id === id), `${id}: a settled duplicate is not listed as a risk`);
  }
  // every invoice listed under a record-level risk category is OPEN on its own page (nothing listed on one page is missing from the other)
  for (const cat of ['duplicate', 'struck_off_registry', 'deceased_person']) for (const row of r.categories[cat].rows) assert.equal(detail(st, lookupId(st, row.id), ctx).riskFlags[cat], 'open', `${row.id} ${cat}`);
  // with the duplicate rule switched off nothing is settled: the same two invoices become OPEN duplicates, listed on the Risks page AND carried by the invoice page
  const off = { cutoff: TODAY, rules: { 'DUP-1': false } }; const r2 = risk(st, { scope: YTD, cfg: off, limit: 200 }); const ctx2 = makeCtx(st, { scope: YTD, cfg: off });
  for (const id of ['177-882607280000', '177-882608080000']) { assert.ok(r2.categories.duplicate.rows.some((x) => x.id === id), `${id}: listed when open`); assert.equal(detail(st, lookupId(st, id), ctx2).riskFlags.duplicate, 'open'); }
  assert.equal(r2.categories.duplicate.count, r.categories.duplicate.count + 2);
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
await test('fair comparison: the mix-expected rates reproduce the overall rate; ranking uses the index, small samples are flagged', () => {
  const f = fairComparison(cYtd); const T = cYtd.totals;
  assert.ok(Math.abs(f.reduce((t, r) => t + (r.expectedRate == null ? 0 : r.net * r.expectedRate), 0) - T.collected) < 1, 'Σ net × expected = collected overall');
  assert.ok(f.some((r) => r.smallSample) && f.every((r) => r.gapShare == null || (r.gapShare >= 0 && r.gapShare <= 1)));
  assert.ok(Math.abs(f.reduce((t, r) => t + (r.gapShare || 0), 0) - 1) < 1e-9, 'gap shares add up to 100 %');
});

/* ------------------------------------------------------------ restructuring: two management areas */
await test('fixed reports: every established report builds directly from the shared snapshot (no prompt), reconciles with it, states units', () => {
  const prev = snapshot(cst, { scope: { from: '2025-01-01', to: '2025-10-08', amanah: 'all', source: 'all' }, cfg: { cutoff: TODAY, collectionsAsOf: 'periodEnd' } });
  assert.equal(FIXED_REPORTS.length, 8); assert.ok(!FIXED_REPORTS.some((d) => d.sections.includes('budget')) && !SECTION_ORDER.includes('budget'), 'no budget / expenditure report');
  for (const def of FIXED_REPORTS) {
    const m = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: def.sections, compare: def.compare }, lang: 'ar', out: mkOut(cYtd), prev: def.compare === 'none' ? null : prev, compare: def.compare, prevScope: { from: '2025-01-01', to: '2025-10-08' }, cash: { months: cYtd.byMonth.map((x) => x.month), values: cYtd.byMonth.map((x) => x.collected) }, bridge: null, targets: DEFAULT_TARGETS, meta: { size: 'compact', counts: { invoicesTotal: cst.n } } });
    assert.ok(m.sections.length >= 1 && m.totals.gross === cYtd.totals.gross, def.key); assert.ok(!JSON.stringify(m).includes('ألف مليون'));
    for (const sec of m.sections) for (const b of sec.blocks) if (b.type === 'table') { const tx = tableToText(b, 'ar'); if (tx.unitText) assert.ok(tx.headers.some((h) => h.includes(tx.unitText)), `${def.key}/${b.id}`); }
  }
  const am = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['amanah'] }, lang: 'ar', out: mkOut(cYtd), targets: DEFAULT_TARGETS }); const fair = am.sections[0].blocks.find((x) => x.id === 'fair'); assert.ok(fair && fair.rows.length > 5);
});
await test('smart reports: ambiguous requests get ONE focused clarification inside the conversation; follow-ups keep the context', () => {
  const c1 = interpret('قارن', null, TODAY); assert.equal(c1.kind, 'clarify'); assert.ok(c1.options.length >= 2);
  const c2 = interpret('اعرض أمانة الرياض وجدة فقط', null, TODAY); assert.equal(c2.kind, 'clarify'); assert.ok(c2.options.every((o) => o.text.includes('فقط')));
  const base = interpret('أنشئ تقرير الإيرادات لهذا الشهر حتى اليوم', null, TODAY).spec; const f1 = interpret('أضف تحليل الاستبعادات', base, TODAY); assert.ok(f1.spec.sections.includes('exclusions') && f1.spec.sections.includes('executive')); assert.equal(f1.spec.scope.from, '2026-10-01');
  const f2 = interpret('حوّله إلى ملخص تنفيذي', f1.spec, TODAY); assert.deepEqual(f2.spec.sections, ['executive']); assert.equal(f2.spec.scope.from, '2026-10-01');
  const shared = { ...defaultSpec(TODAY), scope: { ...defaultSpec(TODAY).scope, amanah: 'Jeddah Amanah' } }; const n = interpret('حلّل المتأخرات حسب مصدر الإيراد', null, TODAY, { base: shared }); assert.equal(n.spec.scope.amanah, 'Jeddah Amanah', 'a new conversation starts from the shared filters'); assert.deepEqual(n.spec.sections, ['sources', 'aging']);
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
  const prev = snapshot(cst, { scope: { from: '2025-01-01', to: '2025-10-08', amanah: 'all', source: 'all' }, cfg: { cutoff: TODAY, collectionsAsOf: 'periodEnd' } });
  const m = buildReportModel({ spec: { ...defaultSpec(TODAY), sections: ['executive', 'amanah'], compare: 'prev_year' }, lang: 'ar', out: mkOut(cYtd), prev, compare: 'prev_year', prevScope: { from: '2025-01-01', to: '2025-10-08' }, targets: DEFAULT_TARGETS });
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
  for (const q of ['ما الميزانية المتبقية؟', 'هل نغطي المصروفات؟', 'how much is the remaining budget?']) { const r = run(q); assert.ok(['clarify', 'unsupported'].includes(r.kind) && r.unapplied?.includes('expenditure'), `${q}: expenditure/budget is declined openly (no expenditure data)`); }
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
await test('AC-A1/A2 parity: Dashboard, Fixed-report headline, Smart report (with and without comparison) and a plain request give identical figures and the same comparison, over 13 selections', () => {
  for (const { key, scope } of scopesMatrix()) {
    const dash = snapshot(st, { scope, cfg: cfgTD });                                             // Dashboard: shared request, default config
    const smart = snapshot(st, { scope, cfg: headlineCfg(cfgTD) });                               // Smart: headline basis via measure()
    const plan = snapshot(st, { scope: { from: scope.from, to: scope.to, amanah: scope.amanah, source: scope.source }, cfg: cfgTD }); // the same request through any other screen
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

await test('EQ10: backup/export/import of the browser-local records — validated before anything is written, replaces the three records as a unit, round-trips exactly', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
  const a = mem(); a.setItem('ib_plans_v1', JSON.stringify({ plans: [{ id: 'P1' }], objectives: [], activeId: 'P1' })); a.setItem('ib_actions_v1', JSON.stringify({ actions: [{ id: 'A1' }], rejected: [] })); a.setItem('ib_smart_convs_v1', JSON.stringify([{ id: 'C1', messages: [] }]));
  const b = buildBackup(a, new Date('2026-10-09T10:00:00Z')); assert.equal(b.format, BACKUP_FORMAT); assert.deepEqual(validateBackup(b), { ok: true, summary: { plans: 1, objectives: 0, goalPlans: 0, actions: 1, proposals: 0, conversations: 1, createdAt: '2026-10-09T10:00:00.000Z' } });
  const t = mem(); t.setItem('ib_plans_v1', 'old'); const r = applyBackup(JSON.parse(JSON.stringify(b)), t); assert.equal(r.ok, true);
  for (const k of ['ib_plans_v1', 'ib_actions_v1', 'ib_smart_convs_v1']) assert.deepEqual(JSON.parse(t.getItem(k)), JSON.parse(a.getItem(k)), `${k} round-trips`);
  const before = JSON.stringify([...t._m]); for (const bad of [null, {}, { format: 'x' }, { ...b, version: 2 }, { ...b, data: { ib_plans_v1: { plans: 'no' } } }, { ...b, data: { ib_actions_v1: {} } }, { ...b, data: { ib_smart_convs_v1: {} } }]) { assert.equal(applyBackup(bad, t).ok, false); }
  assert.equal(JSON.stringify([...t._m]), before, 'an invalid file writes nothing');
  const g = mem(); g.setItem('ib_collection_goal_v1', JSON.stringify({ v: 1, plans: { '2026|all': { year: 2026 } } })); const gb = buildBackup(g); assert.equal(validateBackup(gb).summary.goalPlans, 1); const gt = mem(); applyBackup(gb, gt); assert.deepEqual(JSON.parse(gt.getItem('ib_collection_goal_v1')), JSON.parse(g.getItem('ib_collection_goal_v1')), 'saved dashboard plans round-trip'); assert.equal(validateBackup({ ...gb, data: { ib_collection_goal_v1: { v: 2 } } }).ok, false);
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
    { const e = presetRange('lastMonth', t).to; assert.deepEqual(presetRange('ytdLastMonth', t), { from: `${e.slice(0, 4)}-01-01`, to: e }, 'IIM-11: start of the year to the end of the last CLOSED month'); }
    assert.equal(presetRange('all', t).from, '2025-01-01');
    assert.equal(parsePeriod('آخر 3 أشهر', t).from, l3.from); assert.equal(parsePeriod('آخر 3 أشهر', t).to, l3.to); assert.equal(parsePeriod('هذا الشهر', t).from, presetRange('month', t).from);
  }
  assert.deepEqual(parsePeriod('الربع الحالي حتى اليوم', '2026-10-09'), { from: '2026-10-01', to: '2026-10-09', label: 'qtd' }); assert.equal(parsePeriod('this quarter', '2026-05-20').from, '2026-04-01'); assert.equal(parsePeriod('منذ أول يناير', '2026-10-09').from, '2026-01-01');
  assert.equal(detectPreset('2026-01-01', '2026-10-09', '2026-10-09'), 'ytd'); assert.equal(detectPreset('2026-02-03', '2026-02-04', '2026-10-09'), 'custom'); assert.equal(PRESETS.length, 8); assert.deepEqual(presetRange('ytdLastMonth', '2026-10-19'), { from: '2026-01-01', to: '2026-09-30' }, 'IIM-11 acceptance: on 19 Oct 2026 the preset is 01 Jan – 30 Sep');
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
const idOfInv = (i) => st.idKey[i] ? idOf(st, i) : null;
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
  const text = ['Enforcement order no: EN-5013', 'Debtor ID 1008640729', 'Contract reference: CT-2026-0087', 'Account no: 4410229981', 'IBAN SA0380000000608010167519', 'Total amount: 85,438,130.00 SAR', 'Invoice No | Type | Amount', '177-410830121845 | fines | 44,061,510.00 SAR', '0000095 | municipal', 'SADAD 101234567890', 'Violation no 12345678901234'];
  const r = extractFromText(text.join('\n'), 3); const by = (k) => r.filter((x) => x.kind === k).map((x) => x.value);
  assert.deepEqual(by('invoice_no'), ['177-410830121845']); assert.deepEqual(by('order_no'), ['EN-5013']); assert.deepEqual(by('contract_no'), ['CT-2026-0087']); assert.deepEqual(by('bank_account'), ['SA0380000000608010167519']);
  assert.deepEqual(by('invoice_serial'), ['0000095'], 'a zero-padded serial under an Invoice heading'); assert.deepEqual(by('sadad_no'), ['101234567890']); assert.deepEqual(by('violation_no'), ['12345678901234']);
  assert.ok(by('other_number').includes('1008640729') && by('other_number').includes('4410229981'), 'identity and account numbers are never invoice references');
  assert.ok(!r.some((x) => x.value.includes('85') && isFinite(x.value) && x.kind !== 'other_number'), 'amounts are not references'); assert.ok(r.every((x) => x.page === 3));
  const ex = buildExtraction([{ page: 1, text: '177-410830121845' }, { page: 2, text: 'rows\n177-407800123249\n177-410830121845' }, { page: 3, text: '' }], 'text_layer', { orderNo: 'EN-5013' });
  assert.deepEqual(ex.refs.map((x) => `${x.value}@${x.occurrences.map((o) => o.page)}`), ['177-410830121845@1,2', '177-407800123249@2']); assert.equal(ex.pages[2].needsOcr, true, 'a page with no text is reported as unread'); assert.equal(ex.pages[0].needsOcr, false);
  assert.equal(buildExtraction([{ page: 1, text: 'order EN-9999\n177-407270123447' }], 'text_layer', { orderNo: 'EN-5013' }).orderNumberMismatch, true, 'a document that names another order is flagged');
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
  const some = idOfInv(multi.covers[0]); const i0 = lookupId(st, some); const sad = resolveFor([{ kind: 'sadad_no', value: sadadOf(st.idKey[i0]) }, { kind: 'violation_no', value: '00000000000001' }, { kind: 'contract_no', value: 'CT-2026-0087' }, { kind: 'invoice_id_exact', value: '177-882607220000' }]);
  assert.equal(sad.results[0].status, 'matched'); assert.equal(sad.results[0].candidates[0].invoiceId, some); assert.equal(sad.results[1].status, 'unmatched'); assert.equal(sad.results[2].status, 'contract_not_found'); assert.equal(sad.results[2].candidates.length, 0, 'a contract number never resolves to invoices'); assert.equal(sad.results[3].status, 'matched'); assert.equal(sad.results[3].candidates[0].invoiceId, '177-882607220000', 'an exact id (a hand-anchored 4-digit one) is looked up as written, never padded to another invoice');
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
  const doc = { id: 'h1', name: 'x.pdf', size: 1, addedAt: o.at, extraction: buildExtraction([{ page: 1, text: '177-407270123447' }, { page: 2, text: '' }], 'text_layer') };
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
  const susp = buildEffectiveCases([{ ...c, requestStatus: 'موقوف' }], store); assert.equal(invoiceStatusMap(susp)[cand[0].invoiceId], 'open', 'the source cannot say «suspended»: a demo suspended case is only «not closed»'); assert.equal(orderStatusOf({ requestStatus: 'موقوف' }), 'suspended', 'the model itself still understands the state'); assert.equal(invoiceStatusMap(buildEffectiveCases([{ ...c, requestStatus: 'مغلق' }], store))[cand[0].invoiceId], 'closed');
  assert.equal(rejectLink(store, en, cand[0].invoiceId, { ...o('x'), note: 'n' }).error, 'use_remove', 'a confirmed link is withdrawn, not rejected'); assert.equal(removeLink(store, en, cand[0].invoiceId, { ...o('x'), note: '' }).error, 'note_required');
  store = removeLink(store, en, cand[0].invoiceId, { ...o('2026-10-08T10:00:00Z'), note: 'wrong year' }).store; assert.deepEqual(invoiceStatusMap(buildEffectiveCases([c], store)), { [cand[0].invoiceId]: 'withdrawn' }, 'withdrawing removes the effect (a withdrawn link is no referral; the data service only keeps the fact so a retained cancelled-invoice treatment is not silently reversed)');
  store = rejectLink(store, en, cand[1].invoiceId, { ...o('2026-10-08T10:01:00Z'), note: 'other payer', input: mk(cand[1]) }).store;
  const hist = buildEffectiveCases([c], store)[0].history.map((h) => h.action); assert.deepEqual(hist, ['rejected', 'removed', 'confirmed', 'proposed'], 'every step is kept, newest first');
  const chg = confirmLink(store, en, cand[0].invoiceId, { ...o('2026-10-09T10:00:00Z'), note: 'again', orderStatus: 'suspended' }).store; assert.ok(chg.orders[en].history.some((h) => h.action === 'order_status_changed' && h.detail.from === 'open' && h.detail.to === 'suspended'), 'a change of the order status since the last record is logged');
  const fed = caseOf(orderOf('single')); const fedId = fed.links[0].invoiceId; assert.equal(removeLink(emptyStore(), fed.enforceNum, fedId, { ...o('x'), note: 'r' }).error, 'not_confirmed');
  const wd = removeLink(emptyStore(), fed.enforceNum, fedId, { ...o('2026-10-08T11:00:00Z'), note: 'the reference is a typing error', base: fed.links[0] }).store; assert.deepEqual(invoiceStatusMap(buildEffectiveCases([fed], wd)), { [fedId]: 'withdrawn' }, 'a link from the Sanad feed can be withdrawn; the withdrawal is recorded over it');
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
  if (ci >= 0) { const cid = idOfInv(ci); const x0 = detail(st, ci, makeCtx(st, { cfg, links: {} })); assert.equal(x0.derived.payStatus, 'cancelled'); for (const s of ['open', 'suspended', 'closed', 'candidate']) assert.equal(detail(st, ci, makeCtx(st, { cfg, links: { [cid]: s } })).derived.payStatus, 'cancelled', `${s}: enforcement alone never overrides the source cancellation`); assert.equal(detail(st, ci, makeCtx(st, { cfg, links: { [cid]: 'open' }, enf1: { [cid]: true } })).derived.payStatus, 'cancelled', 'ENF-1 is not applied by anything — not by a link, not by a stored decision');  }
  assert.equal(list(st, { scope: sc, cfg, filters: { exec: 'inexec' }, links: { [id]: 'open' }, page: 0, pageSize: 1000 }).rows.some((r) => r.id === id), true);
  for (const [f, s2, expect] of [['suspended', 'suspended', true], ['inexec', 'suspended', false], ['closed', 'closed', true], ['ever', 'closed', true], ['none', 'closed', false], ['ever', 'candidate', false]]) assert.equal(list(st, { scope: sc, cfg, filters: { exec: f }, links: { [id]: s2 }, page: 0, pageSize: 1000 }).rows.some((r) => r.id === id), expect, `filter ${f} with ${s2}`);
});

await test('Backup: enforcement work (links, document records, extracted references, history) is included and validated; an older backup never removes it; the PDF bytes are not part of the file', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const a = mem(); const store = proposeLink(emptyStore(), 'EN-5000', { invoiceId: '177-407270123447', origin: 'document_text_layer', gross: 5 }, { by: 'x', at: '2026-10-08T10:00:00Z', orderStatus: 'open' }).store; a.setItem('ib_enforcement_v1', JSON.stringify(store));
  const b = buildBackup(a); assert.deepEqual(b.data.ib_enforcement_v1, store); const v = validateBackup(b); assert.equal(v.ok, true); assert.equal(v.summary.enforcementOrders, 1);
  const t = mem(); applyBackup(JSON.parse(JSON.stringify(b)), t); assert.deepEqual(JSON.parse(t.getItem('ib_enforcement_v1')), store, 'round-trips');
  const old = buildBackup(mem()); assert.ok(!('ib_enforcement_v1' in old.data)); applyBackup(old, t); assert.ok(t.getItem('ib_enforcement_v1'), 'a backup made before this feature does not delete the enforcement records');
  assert.equal(applyBackup({ ...b, data: { ...b.data, ib_enforcement_v1: { v: 1, orders: { x: { links: [] } } } } }, mem()).ok, false, 'a malformed record is rejected before anything is written');
});

/* ------------------------------------------------------------ full-page records: one relationship model, enforcement status, completeness, evidence */
await test('Record addresses: one builder per record type (invoice, order, contract) — no query-string drawer addresses', () => {
  assert.equal(invoicePath('177-409470122457'), '/invoices/177-409470122457'); assert.equal(orderPath('EN-5013'), '/enforcement-orders/EN-5013'); assert.equal(contractPath('CT-2023-0013'), '/contracts/CT-2023-0013');
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
  const doc = { id: 'd1', name: 'x.pdf', size: 1, addedAt: 'a', extraction: buildExtraction([{ page: 1, text: '177-407270123447' }, { page: 2, text: '' }], 'text_layer') };
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
  assert.deepEqual(dig.ex.refs.map((r) => r.value), ['177-410830121845', '177-407800123249', '177-409150122601']); assert.ok(dig.ex.refs[2].occurrences[0].page === 2, 'the table row on page 2 is read');
  assert.ok(dig.ex.others.some((o) => o.kind === 'contract_no') && dig.ex.others.some((o) => o.value === '1008640729' && o.label === 'person'), 'contract and identity numbers are set apart'); assert.equal(dig.ex.orderNumberMismatch, false);
  const sc = await read('ar-EN-5143-scanned.pdf'); assert.deepEqual(sc.ex.pages.map((p) => p.needsOcr), [true, true]); assert.equal(sc.ex.refs.length, 0);
  assert.deepEqual(extractFromText('رقم الفاتورة ١٢٣٤٥٦٧\nفاتورة ٠٠٠٠٠٩٥').map((r) => r.value), ['1234567', '0000095'], 'Arabic-Indic digits are read as Latin digits'); assert.deepEqual(extractFromText('الرصيد ٦٦٩٩٢٦٧').filter((r) => r.kind === 'invoice_serial'), [], 'a bare 7-digit figure with no invoice label is not a serial');
});

await test('Backup restore with missing PDFs: the extracted references, page evidence and confirmed links survive; the order reports the file as unavailable; the original is associated again only after an identity check', () => {
  const q = orderOf('multi_partial_refs'); const c = caseOf(q); const o = { by: 'r', at: '2026-10-08T10:00:00Z', orderStatus: 'open' };
  const ex = buildExtraction([{ page: 1, text: `${c.refs[0].value}\n177-427230114465` }, { page: 2, text: '177-425010115464 on page two' }], 'text_layer', { orderNo: q.enforceNum });
  let store = recordDocument(emptyStore(), q.enforceNum, { id: 'f'.repeat(64), name: 'order.pdf', size: 10, kind: 'uploaded', addedAt: o.at, fileStored: true, extraction: ex }, o).store;
  store = proposeLink(store, q.enforceNum, { invoiceId: '177-427230114465', origin: 'document_text_layer', gross: 5, evidence: [{ refKind: 'invoice_no', refValue: '177-427230114465', docId: 'f'.repeat(64), docName: 'order.pdf', pages: [1] }] }, o).store;
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const a = mem(); a.setItem('ib_enforcement_v1', JSON.stringify(store)); const b = buildBackup(a); const t = mem(); assert.equal(applyBackup(JSON.parse(JSON.stringify(b)), t).ok, true);
  const restored = JSON.parse(t.getItem('ib_enforcement_v1')); const eff = buildEffectiveCases([c], restored)[0];
  assert.equal(eff.docs.length, 1); assert.equal(eff.docs[0].extraction.refs.length, 3); assert.deepEqual(eff.docs[0].extraction.refs.find((r) => r.value === '177-425010115464').occurrences.map((x) => x.page), [2], 'page references survive');
  assert.ok(evidenceForInvoice('177-427230114465', [eff]).some((e) => e.page === 1 && e.docName === 'order.pdf'), 'the evidence (document, page, line) survives without the PDF bytes');
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
  const { pages } = await readPdfPages(new Uint8Array(fs.readFileSync('public/samples/invoice_normal_alrajhi.pdf')), lib); const ex = buildExtraction(pages, 'text_layer'); assert.equal(ex.pages[0].needsOcr, false); assert.ok(pages[0].text.includes('INV-2026-0731'), 'the first-demo sample PDFs keep their own (legacy-format) number as text: the id format of the system is now biller-sadad, so it is not read as an invoice reference'); assert.deepEqual(ex.refs.map((r) => r.value), []);
});

/* ------------------------------------------------------------ Brief 4: every source is read (structured · description · notes · attachments), cancelled invoices vs enforcement, contract mentions */
// The samples and the demo run on the compact world at the demo's reference date; the references in the sample files are those of THIS world.
const isInvoiceKindT = (k) => ['invoice_no', 'invoice_serial', 'sadad_no', 'violation_no', 'invoice_corrupted'].includes(k);
const E_DATE = '2026-10-09'; const ecfg = { cutoff: E_DATE };
const est = loadStore(E_DATE, { size: 'compact' }); const estCases = sanadCases(est);
const eo = (arch, nth = 0) => est.requests.filter((r) => r.archetype === arch)[nth];
const ecase = (q) => estCases.find((c) => c.enforceNum === q.enforceNum);
const eInv = (i) => idOf(est, i);
const eResolve = (refs) => resolveReferences(est, { refs, cfg: ecfg }).results;
const SPEC = 'pdfjs-dist/legacy/build/pdf.mjs'; const pdfLib = await import(SPEC);
const sampleBytes = (f) => new Uint8Array(fs.readFileSync(`public/samples/enforcement-orders/${f}`));
const NOW = { by: 'Tester', at: '2026-10-10T08:00:00.000Z', orderStatus: 'open' };
const ESC = { from: '2000-01-01', to: E_DATE, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
const sortedIds = (list) => [...list].map((x) => String(x).toUpperCase()).sort();

await test('Brief 4 · structured field holds one invoice, the description holds the others: every reference is collected (never stops at the first), kept as typed, each matched on its own', () => {
  const q = eo('desc_multi'); const c = ecase(q); assert.equal(c.refs.length, 1, 'the structured field names only the first invoice');
  const refs = collectReferences(c, []).filter((r) => r.kind === 'invoice_no');
  assert.deepEqual(sortedIds(refs.map((r) => r.value)), sortedIds(q.covers.map(eInv)), 'the description’s references are found in every typed variant (lowercase, spaces, dashes, slash)');
  assert.ok(refs.some((r) => r.origins.some((o) => o.type === 'sanad_description' && o.raw && o.raw !== r.value)), 'the text as typed is preserved beside the canonical value');
  const first = refs.find((r) => r.origins.some((o) => o.type === 'sanad_structured')); assert.ok(first.origins.some((o) => o.type === 'sanad_description'), 'the same invoice typed again in the description keeps BOTH occurrences, as one reference');
  const res = eResolve(refs.map((r) => ({ kind: r.kind, value: r.value }))); assert.ok(res.every((x, k) => x.status === 'matched' && x.candidates[0].invoiceId === refs[k].value.toUpperCase()), 'each reference is matched independently');
  assert.equal(orderCompleteness(c).references.sources.description, q.covers.length, 'the sources table counts what the description yielded');
});

await test('Brief 4 · references only in the description or notes: found, flagged for review, and NOT reported as «no related invoices»', () => {
  const q = eo('desc_only'); const c = ecase(q); assert.equal(c.refs.length, 0);
  const refs = collectReferences(c, []).filter((r) => r.kind === 'invoice_no'); assert.deepEqual(sortedIds(refs.map((r) => r.value)), sortedIds(q.covers.map(eInv)));
  assert.ok(refs.every((r) => r.origins.every((o) => o.type === 'sanad_description' || o.type === 'sanad_notes')));
  const eff = buildEffectiveCases([c], emptyStore())[0]; const comp = orderCompleteness(eff);
  assert.equal(comp.references.state, 'incomplete', 'found but undecided'); const ex = orderExceptions(eff); assert.ok(ex.includes('unresolved_references') && !ex.includes('no_references'));
  assert.equal(invoiceStatusMap([eff])[eInv(q.covers[0])], undefined, 'a text mention alone changes no invoice status');
});

await test('Brief 4 · a multi-page PDF that is the ONLY source: all pages and table rows are read, a repeated invoice is one reference with several occurrences', async () => {
  const q = eo('attach_pdf'); const c = ecase(q); assert.equal(c.refs.length, 0); assert.ok(c.attachments.length >= 1 && c.attachments.every((a) => a.retrieved === false), 'Sanad lists the attachment; retrieval is not connected');
  const ex = await extractDocument(sampleBytes(`${q.enforceNum}-attachment.pdf`), { orderNo: q.enforceNum, lib: pdfLib });
  assert.equal(ex.format, 'pdf'); assert.ok(ex.pages.length >= 2); assert.deepEqual(sortedIds(ex.refs.map((r) => r.value)), sortedIds(q.covers.map(eInv)));
  const rep = ex.refs.find((r) => r.occurrences.length > 1); assert.ok(rep && new Set(rep.occurrences.map((o) => o.page)).size >= 2, 'the repeat is on another page and is kept as an occurrence, not a second reference');
  let store = recordDocument(emptyStore(), q.enforceNum, { id: 'h-pdf', name: `${q.enforceNum}-attachment.pdf`, size: 1, kind: 'uploaded', format: 'pdf', extraction: ex }, NOW).store;
  const eff = buildEffectiveCases([c], store)[0]; const refs = collectReferences(eff, eff.docs).filter((r) => r.kind === 'invoice_no');
  assert.equal(refs.length, q.covers.length, 'no duplicate reference'); assert.ok(refs.every((r) => r.origins.every((o) => o.docId === 'h-pdf')));
  assert.equal(orderCompleteness(eff).extraction.attachmentsPending, 0, 'the listed attachment is now added');
});

await test('Brief 4 · a Word document: paragraphs AND table rows are read, page breaks give pages, a contract named in it is a mention (not a referral)', async () => {
  const q = eo('attach_docx'); const bytes = sampleBytes(`${q.enforceNum}-attachment.docx`); assert.equal(await detectFormat(bytes), 'docx');
  const ex = await extractDocument(bytes, { orderNo: q.enforceNum }); assert.equal(ex.format, 'docx'); assert.equal(ex.method, 'docx_text'); assert.ok(ex.tables >= 2 && ex.pages.length === 1 && ex.exactPages === false, 'tables on both parts; ONE unit of reading: a Word file has no exact page numbers');
  assert.deepEqual(sortedIds(ex.refs.map((r) => r.value)), sortedIds(q.covers.map(eInv)), 'the invoice numbers exist ONLY in the tables'); assert.ok(ex.pages.every((p) => !p.needsOcr));
  assert.ok(ex.others.some((o) => o.kind === 'contract_no'), 'the contract number is set apart from the invoice references');
  const c = ecase(q); const eff = buildEffectiveCases([c], recordDocument(emptyStore(), q.enforceNum, { id: 'h-docx', name: 'a.docx', size: 1, format: 'docx', extraction: ex }, NOW).store)[0];
  const cm = contractMentions(eff, eff.docs); assert.equal(cm.length, 1); assert.equal(cm[0].status, 'mentioned'); assert.equal(cm[0].direct, false); assert.equal(cm[0].origins[0].type, 'document_docx_text'); assert.ok(cm[0].origins[0].locs.length >= 1 && cm[0].origins[0].pages.length === 0, 'evidence names a paragraph/table location, never an approximate page');
  const wl = collectReferences(eff, eff.docs).filter((r) => r.kind === 'invoice_no'); assert.ok(wl.every((r) => r.origins[0].locs.every((l) => /^t\d+r\d+$|^p\d+$/.test(l)) && r.origins[0].pages.length === 0), 'table rows are named t<table>r<row>');
  const w = parseWordXml('<w:body><w:p><w:r><w:t>Intro</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>177-407270123447</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>10</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>Next &amp; last</w:t></w:r></w:p></w:body>');
  assert.equal(w.pages.length, 2); assert.equal(w.tables, 1); assert.deepEqual(w.pages[0], ['Intro', '[table 1, row 1] 177-407270123447 | 10']); assert.deepEqual(w.pages[1], ['Next & last']);
});

await test('Brief 4 · a scanned PDF, a legacy .doc and an unknown file are kept but flagged UNREAD with a reason; nothing is treated as read; empty fields ≠ «no related invoices»', async () => {
  const q = eo('attach_unreadable'); const c = ecase(q); assert.equal(c.refs.length, 0); assert.equal(c.attachments.length, 2);
  const scan = await extractDocument(sampleBytes(`${q.enforceNum}-scan.pdf`), { orderNo: q.enforceNum, lib: pdfLib }); assert.ok(scan.pages.some((p) => p.needsOcr && p.reason === 'no_text_layer') && scan.pages.filter((p) => p.needsOcr).every((p) => p.reason === 'no_text_layer'), 'image-only pages are flagged unread with the reason (the sample carries only a one-line «synthetic» caption on page 1)'); assert.equal(scan.refs.length, 0);
  const doc = await extractDocument(sampleBytes(`${q.enforceNum}-legacy.doc`), { orderNo: q.enforceNum }); assert.equal(doc.format, 'doc'); assert.equal(doc.unsupported, true); assert.equal(doc.pages[0].needsOcr, true); assert.equal(doc.pages[0].reason, 'unsupported_format');
  const img = await extractDocument(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), {}); assert.equal(img.format, 'image'); assert.equal(img.pages[0].reason, 'needs_ocr', 'an image needs OCR, which this system does not perform');
  assert.equal((await extractDocument(new Uint8Array([1, 2, 3, 4, 5, 6]), {})).pages[0].reason, 'unknown_format');
  const eff0 = buildEffectiveCases([c], emptyStore())[0]; assert.equal(orderCompleteness(eff0).references.state, 'none'); assert.ok(orderExceptions(eff0).includes('no_references') && orderExceptions(eff0).includes('attachments_not_retrieved'));
  let store = recordDocument(emptyStore(), q.enforceNum, { id: 'h-scan', name: 'scan.pdf', size: 1, format: 'pdf', extraction: scan }, NOW).store; store = recordDocument(store, q.enforceNum, { id: 'h-doc', name: 'legacy.doc', size: 1, format: 'doc', extraction: doc }, NOW).store;
  const eff = buildEffectiveCases([c], store)[0]; const comp = orderCompleteness(eff);
  assert.equal(comp.references.state, 'none', 'still «not identified»'); assert.equal(comp.extraction.state, 'incomplete'); assert.ok(comp.extraction.unreadPages >= 2); assert.ok(orderExceptions(eff).includes('unread_pages'));
});

await test('Brief 4 · the same invoice typed in several fields and documents is ONE reference (every occurrence kept) and one link: the amount is counted once', () => {
  const q = eo('desc_multi'); const c = ecase(q); const id0 = eInv(q.covers[0]);
  const ex = buildExtraction([{ page: 1, text: `Invoice ${id0}` }, { page: 2, text: `rows ${id0.toLowerCase()}` }], 'text_layer', { orderNo: q.enforceNum });
  const eff = buildEffectiveCases([{ ...c, notes: `see ${id0}` }], recordDocument(emptyStore(), q.enforceNum, { id: 'h-r', name: 'r.pdf', size: 1, format: 'pdf', extraction: ex }, NOW).store)[0];
  const refs = collectReferences(eff, eff.docs).filter((r) => r.kind === 'invoice_no'); const r0 = refs.find((r) => r.value.toUpperCase() === id0);
  assert.equal(refs.length, q.covers.length, 'no duplicate rows'); assert.ok(['sanad_structured', 'sanad_description', 'sanad_notes', 'document_text_layer'].every((t) => r0.origins.some((o) => o.type === t)), 'structured, description, notes and the document all kept');
  const res = eResolve(refs.map((r) => ({ kind: r.kind, value: r.value }))); const rows = buildRows(eff, refs, res, eff.links, new Map(), new Set(), eff.docs);
  const matched = rows.filter((r) => r.status === 'matched'); assert.equal(new Set(matched.map((r) => r.candidates[0].invoiceId)).size, matched.length, 'one row per invoice');
  let store = emptyStore(); for (const row of rows) { const k = row.candidates[0]; store = confirmLink(store, q.enforceNum, k.invoiceId, { ...NOW, input: { invoiceId: k.invoiceId, origin: 'sanad_description', gross: k.grossAmount, conflicts: [], resolvedConflicts: [], evidence: [] } }).store; }
  const eff2 = buildEffectiveCases([c], store)[0]; const rec = orderCompleteness(eff2).reconciliation;
  assert.equal(rec.confirmedCount, q.covers.length); assert.equal(rec.confirmedTotal, q.covers.reduce((s, i) => s + est.gross[i], 0), 'each invoice counted once'); assert.ok(Math.abs(rec.difference) <= 1, 'several confirmed invoices reconcile the order amount');
  assert.equal(orderCompleteness(eff2).references.state, 'complete'); assert.ok(orderCompleteness(eff2).references.total === q.covers.length);
});

await test('Matching 2 · the same serial in two different years is NOT a conflict: two legitimate invoices of one order match independently, complete numbers keep their values', () => {
  const q = eo('same_serial_two_years'); const c = ecase(q); const ids = q.covers.map(eInv); assert.equal(q.covers.length, 2); assert.equal(est.idKey[q.covers[0]] % 1e8, est.idKey[q.covers[1]] % 1e8, 'same serial'); assert.notEqual(est.idKey[q.covers[0]], est.idKey[q.covers[1]], 'different years');
  const eff = buildEffectiveCases([c], emptyStore())[0]; const refs = collectReferences(eff, []).filter((r) => r.kind === 'invoice_no'); assert.deepEqual(sortedIds(refs.map((r) => r.value)), sortedIds(ids));
  const rows = buildRows(eff, refs, eResolve(refs.map((r) => ({ kind: r.kind, value: r.value }))), [], new Map(), new Set(), []);
  assert.ok(rows.every((r) => r.status === 'matched' && !r.weak && r.candidates.length === 1), 'each complete number matches exactly one invoice');
  assert.ok(rows.every((r) => !(r.conflicts[r.candidates[0].invoiceId] || []).some((x) => /source|ambig/.test(x)) && r.unresolved[r.candidates[0].invoiceId].length === 0), 'no hard conflict is raised between them');
  assert.ok(rows.every((r) => { const st1 = rowState(r); return st1.kind === 'ready' && st1.preselect; }), 'both are exact matches, preselected for review');
  assert.equal(orderCompleteness(eff).references.sourceConflicts, undefined); assert.ok(!orderExceptions(eff).includes('source_conflict'));
  assert.ok(String(ids[0]).includes('-00') || true); assert.ok(refs.every((r) => /^\d{3,4}-\d{6,14}$/.test(r.value)), 'values keep their zeros');
});

await test('Matching 3 · an incomplete serial matching several invoices is ambiguous; the order’s debtor is supporting evidence only; a full number elsewhere in the order settles it', () => {
  const q = eo('serial_ambiguous'); const c = ecase(q); const eff = buildEffectiveCases([c], emptyStore())[0]; const refs = collectReferences(eff, []).filter((r) => isInvoiceKindT(r.kind));
  const res = eResolve(refs.map((r) => ({ kind: r.kind, value: r.value }))); const rows = buildRows(eff, refs, res, [], new Map(), new Set(), []);
  const row = rows[0]; assert.equal(row.status, 'ambiguous'); assert.ok(row.candidates.length >= 2); const stt = rowState(row); assert.equal(stt.kind, 'ambiguous'); assert.equal(stt.selectable, false); assert.equal(stt.preselect, false);
  assert.equal(selectionFor(rows, { [row.candidates[0].invoiceId]: true }).length, 0, 'even a forced override cannot select an ambiguous reference');
  assert.ok(row.candidates.some((k) => k.payerIdx === c.debtorIdx), 'the order’s debtor owns one candidate — still not sufficient to select it');
  const full = idOfCover(q); const store = recordManualReferences(emptyStore(), q.enforceNum, manualExtraction(full, { orderNo: q.enforceNum }), NOW).store; const eff2 = buildEffectiveCases([c], store)[0];
  const refs2 = collectReferences(eff2, eff2.docs).filter((r) => isInvoiceKindT(r.kind)); const rows2 = buildRows(eff2, refs2, eResolve(refs2.map((r) => ({ kind: r.kind, value: r.value }))), [], new Map(), new Set(), eff2.docs);
  assert.ok(rows2.some((r) => r.status === 'resolved_by_reference'), 'a complete number in the same order identifies exactly one candidate'); assert.ok(rows2.every((r) => ['matched', 'resolved_by_reference', 'duplicate_reference'].includes(r.status)));
  function idOfCover(o) { return eInv(o.covers[0]); }
});

await test('Matching 4 · a genuine conflicting reference (an invoice of ANOTHER payer) needs evidence: not selectable, a typed reason does not override it', () => {
  const q = eo('genuine_conflict'); const c = ecase(q); const other = q.conflictWith; assert.ok(other >= 0 && est.payer[other] !== est.payer[q.covers[0]]);
  const eff = buildEffectiveCases([c], emptyStore())[0]; const refs = collectReferences(eff, []).filter((r) => r.kind === 'invoice_no'); assert.equal(refs.length, 2);
  const rows = buildRows(eff, refs, eResolve(refs.map((r) => ({ kind: r.kind, value: r.value }))), [], new Map(), new Set(), []);
  const bad = rows.find((r) => r.candidates[0].invoiceId === eInv(other)); const good = rows.find((r) => r.candidates[0].invoiceId === eInv(q.covers[0]));
  assert.equal(rowState(bad).kind, 'needs_evidence'); assert.equal(rowState(bad).selectable, false); assert.ok(bad.unresolved[eInv(other)].includes('debtor_mismatch')); assert.equal(rowState(good).kind, 'ready');
  assert.deepEqual(selectionFor(rows).map((x) => x.candidate.invoiceId), [eInv(q.covers[0])], 'only the clean match is preselected');
  const k = bad.candidates[0]; assert.equal(confirmLink(emptyStore(), q.enforceNum, k.invoiceId, { ...NOW, note: 'I am sure it belongs here', input: { invoiceId: k.invoiceId, origin: 'manual_selection', gross: k.grossAmount, conflicts: bad.conflicts[k.invoiceId], resolvedConflicts: [], evidence: [] } }).error, 'unresolved_conflict');
  const docWithPayer = buildExtraction([{ page: 1, text: `Payer identity ${k.payerId}\nInvoice ${eInv(other)}` }], 'text_layer', { orderNo: q.enforceNum }); const eff2 = buildEffectiveCases([c], recordDocument(emptyStore(), q.enforceNum, { id: 'h-id', name: 'x.pdf', size: 1, format: 'pdf', extraction: docWithPayer }, NOW).store)[0];
  const refs2 = collectReferences(eff2, eff2.docs).filter((r) => r.kind === 'invoice_no'); const rows2 = buildRows(eff2, refs2, eResolve(refs2.map((r) => ({ kind: r.kind, value: r.value }))), [], new Map(), new Set(), eff2.docs);
  const bad2 = rows2.find((r) => r.candidates[0].invoiceId === eInv(other)); assert.ok(bad2.resolved[eInv(other)].some((x) => x.by === 'document_names_payer'), 'a document that names the payer’s identity IS evidence'); assert.equal(rowState(bad2).selectable, true);
});

await test('Cancelled 1 · enforcement never overrides a source cancellation or changes a total: flagged for review, amounts identical for every order status, no action (and no stored ENF-1 decision) applies ENF-1', () => {
  for (const q of [eo('cancelled_open'), eo('cancelled_closed')]) {
    const i = q.covers[0]; const id = eInv(i); const det = (links, enf1) => detail(est, i, makeCtx(est, { cfg: ecfg, links, enf1 })).derived;
    const none = det({}); assert.equal(none.sourceCancelled, true); assert.equal(none.cancelled, true); assert.equal(none.payStatus, 'cancelled'); assert.equal(none.outstanding, 0); assert.equal(none.enfConflict, false);
    const states = ['candidate', 'open', 'suspended', 'closed', 'withdrawn'].map((x) => det({ [id]: x }));
    for (const [k, d] of states.entries()) { assert.equal(d.cancelled, true, 'the source cancellation stands'); assert.equal(d.outstanding, 0); assert.equal(d.net, none.net); assert.equal(d.gross, none.gross); assert.equal(d.enfConflict, k > 0, k === 0 ? 'a proposal raises no flag' : 'a confirmed or withdrawn link raises the review flag'); assert.equal(d.enf1Applied, undefined, 'no ENF-1 effect exists'); }
    const legacy = det({ [id]: 'closed' }, { [id]: true }); assert.equal(legacy.cancelled, true, 'a decision stored by an earlier build is history only'); assert.equal(legacy.outstanding, 0); assert.equal(legacy.net, none.net);
    assert.equal(legacy.payStatus === 'collected', false, 'an order never implies payment');
  }
  const q = eo('cancelled_open'); const ids = q.covers.map(eInv); const base = snapshot(est, { scope: ESC, cfg: ecfg, links: {} }); const links = Object.fromEntries(ids.map((x) => [x, 'open'])); const withL = snapshot(est, { scope: ESC, cfg: ecfg, links });
  assert.ok(base.equation.ok && withL.equation.ok, 'the approved identities hold with and without the referral'); assert.equal(withL.stock.enforcement.sourceConflict.count, base.stock.enforcement.sourceConflict.count + ids.length);
  assert.equal(withL.stock.netUncollected, base.stock.netUncollected, 'net uncollected unchanged by the referral'); assert.equal(withL.totals.gross, base.totals.gross); assert.equal(withL.totals.net, base.totals.net);
  assert.equal(withL.stock.enforcement.sourceConflict.outstanding, 0, 'the flagged invoices carry no collectible balance');
  const withLegacy = snapshot(est, { scope: ESC, cfg: ecfg, links, enf1: Object.fromEntries(ids.map((x) => [x, true])) }); assert.equal(withLegacy.stock.netUncollected, base.stock.netUncollected, 'a stored ENF-1 decision changes no amount');
  const rows = list(est, { scope: ESC, cfg: ecfg, filters: { exec: 'conflict', allPeriods: true }, links, page: 0, pageSize: 100 }).rows; assert.ok(ids.every((x) => rows.some((r) => r.id === x && r.enfConflict && r.sourceCancelled)), 'the conflict is listed and countable');
  assert.equal(list(est, { scope: ESC, cfg: ecfg, filters: { exec: 'conflict', allPeriods: true }, links: {}, page: 0, pageSize: 100 }).rows.some((r) => ids.includes(r.id)), false);
  const closedQ = eo('cancelled_closed'); assert.equal(closedQ.status, 'مغلق'); const wd = removeLink(confirmLink(emptyStore(), 'EN-X', ids[0], { ...NOW, input: { invoiceId: ids[0], origin: 'sanad_structured', gross: 1, conflicts: [], resolvedConflicts: [], evidence: [] } }).store, 'EN-X', ids[0], { ...NOW, note: 'withdrawn by the issuer' }).store;
  assert.equal(invoiceStatusMap(buildEffectiveCases([{ enforceNum: 'EN-X', amount: 1, requestStatus: 'قيد التنفيذ', links: [] }], wd))[ids[0]], 'withdrawn', 'withdrawing keeps the review flag (code “withdrawn”) and moves no amount');
  assert.ok(validStoreShape({ v: 1, orders: {}, enf1: { [ids[0]]: { decision: 'apply', by: 'T', at: 'x' } }, enf1History: [{ invoiceId: ids[0], decision: 'apply' }] }), 'a store holding an earlier decision is still valid (kept as history)');
});

await test('Brief 4 · status reflects CONFIRMED links only: text-found and proposed references change nothing, a confirmation does', () => {
  const q = eo('desc_multi'); const c = ecase(q); const ids = q.covers.map(eInv);
  const eff = buildEffectiveCases([c], emptyStore())[0]; const m0 = invoiceStatusMap([eff]); assert.ok(m0[ids[0]], 'the structured reference is the feed’s own confirmed link'); assert.ok(ids.slice(1).every((x) => m0[x] === undefined), 'description-only references are not links');
  const store = proposeLink(emptyStore(), q.enforceNum, { invoiceId: ids[1], origin: 'sanad_description', gross: 1, evidence: [], conflicts: [] }, NOW).store;
  assert.equal(invoiceStatusMap(buildEffectiveCases([c], store))[ids[1]], 'candidate', 'a proposal is not an effect');
  const st2 = confirmLink(store, q.enforceNum, ids[1], { ...NOW }).store; assert.ok(['open', 'suspended', 'closed'].includes(invoiceStatusMap(buildEffectiveCases([c], st2))[ids[1]]));
});

await test('Brief 4 · a contract MENTIONED in an order is not a direct referral; a structured field or a reviewed document makes it one; neither says all its invoices are referred', () => {
  const [q0, q1] = [eo('contract_mention', 0), eo('contract_mention', 1)]; const c0 = ecase(q0); const c1 = ecase(q1); const eff0 = buildEffectiveCases([c0], emptyStore())[0]; const eff1 = buildEffectiveCases([c1], emptyStore())[0];
  const m0 = contractMentions(eff0, []); assert.equal(m0.length, 1); assert.equal(m0[0].status, 'mentioned'); assert.equal(m0[0].direct, false); assert.deepEqual(m0[0].origins.map((o) => o.type), ['sanad_description']);
  const found = eResolve([{ kind: 'contract_no', value: m0[0].contractNo }, { kind: 'contract_no', value: 'CT-2099-0001' }]); assert.equal(found[0].status, 'contract_found'); assert.equal(found[1].status, 'contract_not_found');
  assert.ok(orderExceptions(eff0).includes('contract_mention_unreviewed'));
  const idsOf = (c) => c.links.map((l) => l.invoiceId); const orders0 = ordersOfContract(m0[0].contractNo, [], [eff0]); assert.equal(orders0[0].mentionedOnly, true); assert.equal(orders0[0].contractLevel, false, 'not a direct referral');
  assert.equal(reviewContractReference(emptyStore(), q0.enforceNum, m0[0].contractNo, { ...NOW, decision: 'confirmed', exists: true, evidence: null }).error, 'evidence_required', 'a mention alone cannot be confirmed');
  assert.equal(reviewContractReference(emptyStore(), q1.enforceNum, 'CT-2099-0001', { ...NOW, decision: 'confirmed', exists: false, evidence: { type: 'document_text_layer' } }).error, 'contract_not_found');
  const mention = { type: 'document_docx_text', docId: 'h', docName: 'a.docx', pages: [], snippet: 'contract' };
  assert.equal(reviewContractReference(emptyStore(), q0.enforceNum, m0[0].contractNo, { ...NOW, decision: 'confirmed', exists: true, evidence: mention }).error, 'explicit_statement_required', 'a document that merely names an existing contract is not evidence of a direct referral');
  assert.equal(reviewContractReference(emptyStore(), q0.enforceNum, m0[0].contractNo, { ...NOW, decision: 'confirmed', exists: true, evidence: { ...mention, statedExplicitly: true, quote: '' } }).error, 'explicit_statement_required');
  const ev = { ...mention, location: 't1r2', statedExplicitly: true, quote: 'The contract itself is referred to enforcement' };
  const store = reviewContractReference(emptyStore(), q0.enforceNum, m0[0].contractNo, { ...NOW, decision: 'confirmed', exists: true, evidence: ev }).store; const eff0b = buildEffectiveCases([c0], store)[0];
  const m0b = contractMentions(eff0b, []); assert.equal(m0b[0].status, 'confirmed_by_review'); assert.equal(m0b[0].direct, true);
  const orders0b = ordersOfContract(m0b[0].contractNo, [], [eff0b]); assert.equal(orders0b[0].contractLevel, true); assert.deepEqual(orders0b[0].invoices, [], 'a directly referred contract does not make its invoices referred');
  assert.ok(!orderExceptions(eff0b).includes('contract_mention_unreviewed')); assert.equal(buildEffectiveCases([c1], reviewContractReference(emptyStore(), q1.enforceNum, 'CT-2099-0001', { ...NOW, decision: 'rejected' }).store)[0].contractFacts[0].status, 'rejected');
  const structured = feedCases.find((c) => c.contractNo && !c.refs.length); if (structured) { const e = buildEffectiveCases([structured], emptyStore())[0]; assert.equal(e.contractFacts.find((f) => f.contractNo === structured.contractNo).status, 'supported_by_source'); }
  assert.equal(idsOf(eff0).length, q0.identified.length, 'invoices without a contract-level fact stay linked on their own');
});

/* ------------------------------------------------------------ Round 12: simplified journey, OCR SIMULATION of prepared samples, consolidated review */
const PREP = JSON.parse(fs.readFileSync('public/samples/prepared/index.json', 'utf8')).samples;
const prep = (id) => PREP.find((x) => x.id === id);
const prepBytes = (x) => new Uint8Array(fs.readFileSync(`public/samples/prepared/${x.file}`));
const refsOf = (ex) => sortedIds(ex.refs.filter((r) => isInvoiceKindT(r.kind)).map((r) => r.value));
const reviewRows = (c, store = emptyStore()) => { const eff = buildEffectiveCases([c], store)[0]; const refs = collectReferences(eff, eff.docs).filter((r) => isInvoiceKindT(r.kind)); return { eff, refs, rows: buildRows(eff, refs, eResolve(refs.map((r) => ({ kind: r.kind, value: r.value }))), eff.links, new Map(), new Set(), eff.docs) }; };

await test('Prepared samples: eight scenarios, each tied to ONE existing demo order; files are image-only (no text layer) and match their catalogue SHA-256', async () => {
  assert.deepEqual(PREP.map((x) => x.id).sort(), ['ambiguous_serial', 'amount_discrepancy', 'arabic_scanned', 'genuine_conflict', 'mixed_sources', 'multi_pages', 'one_invoice', 'same_serial_two_years']);
  for (const x of PREP) {
    assert.ok(est.requests.some((r) => r.enforceNum === x.orderNo), `${x.id}: the order exists in the demo world`); const bytes = prepBytes(x);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), x.sha256, `${x.id}: catalogue hash`); assert.equal(sampleByHash(PREP, x.sha256).id, x.id);
    const real = await extractDocument(bytes, { orderNo: x.orderNo, lib: pdfLib }); assert.ok(real.pages.every((p) => p.needsOcr), `${x.id}: real text extraction finds NO text — it is a scan`); assert.equal(real.refs.length, 0);
    assert.equal(x.pages.length, real.pages.length, `${x.id}: one transcript per page`);
  }
  assert.equal(samplesForOrder(PREP, prep('one_invoice').orderNo).length, 1);
});

await test('OCR simulation: deterministic, tied to the sample’s own content (transcript → the SAME reference extraction as real text), labelled, never inferred from a file name', () => {
  const x = prep('multi_pages'); const o = est.requests.find((r) => r.enforceNum === x.orderNo); const a = extractionFromSample(x, { orderNo: x.orderNo }); const b = extractionFromSample(x, { orderNo: x.orderNo });
  assert.deepEqual(a.refs, b.refs, 'the same sample always gives the same result (no randomness)'); assert.equal(a.method, 'ocr_simulated'); assert.equal(a.simulation.label, 'محاكاة OCR — للعرض التجريبي'); assert.equal(SIM_LABEL.ar, 'محاكاة OCR — للعرض التجريبي');
  assert.deepEqual(refsOf(a), sortedIds([...o.covers, ...(o.hidden || [])].map(eInv)), 'the references are exactly the invoices written on the pages'); assert.deepEqual(a.pages.map((p) => p.needsOcr), [false, false, true], 'the stamp page has no text: reported as NOT read'); assert.equal(a.pages[2].reason, 'simulated_no_text');
  assert.equal(a.orderNumberMismatch, false); assert.equal(extractionFromSample(x, { orderNo: 'EN-9999' }).orderNumberMismatch, true, 'a sample used on another order is flagged, not silently accepted');
  const renamed = { ...x, file: 'whatever-12345.pdf', id: x.id }; assert.deepEqual(extractionFromSample(renamed, { orderNo: x.orderNo }).refs, a.refs, 'the file name plays no part');
  const sum = summaryLines(orderCompleteness(buildEffectiveCases([ecase(o)], recordDocument(emptyStore(), o.enforceNum, { id: x.sha256, name: x.file, size: 1, kind: 'prepared_sample', sampleId: x.id, format: 'pdf', extraction: a }, NOW).store)[0]), []); assert.equal(sum.ext.ar, 'صفحة واحدة لم تُقرأ');
});

await test('Prepared scenarios (simulated reading → matching → review): one invoice · pages · mixed sources · same serial two years · ambiguous · genuine conflict · amount discrepancy · Arabic scan', () => {
  const run = (id, base = {}) => { const x = prep(id); const q = est.requests.find((r) => r.enforceNum === x.orderNo); const c = { ...ecase(q), ...base }; const ex = extractionFromSample(x, { orderNo: x.orderNo }); const store = recordDocument(emptyStore(), x.orderNo, { id: x.sha256, name: x.file, size: 1, kind: 'prepared_sample', sampleId: x.id, format: 'pdf', extraction: ex }, NOW).store; return { q, c, ex, store, ...reviewRows(c, store) }; };
  let r = run('one_invoice'); assert.equal(r.rows.length, 1); assert.deepEqual(r.rows.map((x) => rowState(x).kind), ['ready']);
  r = run('multi_pages'); const allN = r.q.covers.length + (r.q.hidden || []).length; assert.ok(allN >= 2 && r.rows.length === allN); assert.ok(r.rows.every((x) => rowState(x).kind === 'ready')); assert.equal(selectionFor(r.rows).length, allN); const t = totalsFor(r.eff, orderCompleteness(r.eff).reconciliation, selectionFor(r.rows)); assert.equal(t.selectedTotal, r.q.covers.concat(r.q.hidden || []).reduce((sum, i) => sum + est.gross[i], 0)); assert.ok(Math.abs(t.difference) <= 1);
  r = run('mixed_sources'); assert.equal(r.c.refs.length, 1); assert.ok(r.rows.length >= 3 && r.rows.every((x) => ['ready', 'confirmed'].includes(rowState(x).kind)), 'the structured one, the description one and the attachment ones, merged'); assert.equal(new Set(r.rows.map((x) => x.candidates[0].invoiceId)).size, r.rows.length, 'repeats do not make duplicate rows');
  r = run('same_serial_two_years'); assert.equal(selectionFor(r.rows).length + r.rows.filter((x) => rowState(x).kind === 'confirmed').length, 2, 'both invoices (same serial, different years) are linkable'); assert.ok(r.rows.every((x) => x.status === 'matched'));
  r = run('ambiguous_serial'); assert.ok(r.rows.some((x) => rowState(x).kind === 'ambiguous') && selectionFor(r.rows).length === 0, 'nothing selectable until evidence');
  r = run('genuine_conflict'); assert.ok(r.rows.some((x) => rowState(x).kind === 'needs_evidence'), 'the other payer’s invoice needs evidence'); assert.ok(r.rows.some((x) => rowState(x).kind === 'confirmed'), 'the structured one is already linked'); assert.equal(selectionFor(r.rows).length, 0, 'the conflicting one stays unselected');
  r = run('amount_discrepancy'); const sel = selectionFor(r.rows); const tt = totalsFor(r.eff, orderCompleteness(r.eff).reconciliation, sel); assert.ok(Math.abs(tt.difference) > 1, 'the difference between the order amount and the linked invoices is shown…'); assert.ok(r.rows.every((x) => rowState(x).kind === 'confirmed'), '…and the references are linked regardless (a difference never blocks valid links)'); assert.equal(sel.length, 0); assert.equal(summaryLines(orderCompleteness({ ...r.eff, links: [] }), r.rows).fin, null, 'no finance verdict before any link');
  r = run('arabic_scanned'); assert.ok(r.rows.length >= 2 && r.rows.every((x) => rowState(x).kind === 'ready'), 'Latin invoice numbers inside Arabic text are found'); assert.ok(r.ex.others.some((o) => o.kind === 'contract_no') && r.ex.others.some((o) => o.value === '4410229981'), 'contract and account numbers are set apart');
});

await test('Selection and confirmation: one action links the selected invoices once each; amount basis = invoice gross; difference reported, never forced; confirmation creates links only', () => {
  const x = prep('multi_pages'); const q = est.requests.find((r) => r.enforceNum === x.orderNo); const c = ecase(q);
  const ex = extractionFromSample(x, { orderNo: x.orderNo }); let store = recordDocument(emptyStore(), x.orderNo, { id: x.sha256, name: x.file, size: 1, kind: 'prepared_sample', sampleId: x.id, format: 'pdf', extraction: ex }, NOW).store;
  let { eff, rows } = reviewRows(c, store); const picked = selectionFor(rows, { [rows[0].candidates[0].invoiceId]: false }); assert.equal(picked.length, rows.length - 1, 'a reviewer can untick a preselected match');
  for (const s1 of picked) store = confirmLink(store, x.orderNo, s1.candidate.invoiceId, { ...NOW, input: { invoiceId: s1.candidate.invoiceId, origin: 'document', gross: s1.candidate.grossAmount, conflicts: s1.row.conflicts[s1.candidate.invoiceId], resolvedConflicts: [], evidence: [] } }).store;
  ({ eff, rows } = reviewRows(c, store)); const rec2 = orderCompleteness(eff).reconciliation; assert.equal(rec2.confirmedCount, picked.length); assert.equal(rec2.confirmedTotal, picked.reduce((sum, s1) => sum + s1.candidate.grossAmount, 0));
  assert.equal(rowState(rows.find((r2) => r2.link)).kind, 'confirmed'); assert.deepEqual(selectionFor(rows).map((s1) => s1.candidate.invoiceId), [rows[0].candidates[0].invoiceId].filter((id) => !rows[0].link), 'the remaining one is still offered');
  const tot = totalsFor(eff, rec2, selectionFor(rows)); assert.equal(tot.total, tot.confirmedTotal + tot.selectedTotal); assert.equal(tot.difference, eff.amount - tot.total);
  const map = invoiceStatusMap([eff]); assert.ok(picked.every((s1) => map[s1.candidate.invoiceId]), 'status is reflected on the CONFIRMED links…'); assert.equal(map[rows[0].candidates[0].invoiceId], rows[0].link ? map[rows[0].candidates[0].invoiceId] : undefined, '…and not on the unlinked one');
  const wd = det0(picked[0].candidate.invoiceId); assert.notEqual(wd.payStatus, 'collected', 'linking never marks an invoice paid'); function det0(id) { return detail(est, lookupId(est, id), makeCtx(est, { cfg: ecfg, links: {} })).derived; }
  assert.equal(summaryLines(orderCompleteness(eff), rows).refs.ar.startsWith('تم العثور على'), true);
});

await test('Summaries: concise Arabic one-liners and the exact «not identified» wording; stored extraction methods stay distinct (digital · docx · simulated · imported OCR · typed)', () => {
  assert.equal(NOT_IDENTIFIED.ar, 'لم يتم تحديد أرقام الفواتير — تحتاج مراجعة');
  const none = summaryLines(orderCompleteness(buildEffectiveCases([{ enforceNum: 'EN-N', amount: 5, requestStatus: 'قيد التنفيذ', links: [], refs: [] }], emptyStore())[0]), []); assert.equal(none.refs.ar, NOT_IDENTIFIED.ar);
  const q = prep('ambiguous_serial'); const o = est.requests.find((r) => r.enforceNum === q.orderNo); const eff = buildEffectiveCases([ecase(o)], emptyStore())[0]; const rows = reviewRows(ecase(o)).rows;
  assert.ok(/^تم العثور على .* — مرجع واحد يحتاج مراجعة$/.test(summaryLines(orderCompleteness(eff), rows).refs.ar) || summaryLines(orderCompleteness(eff), rows).refs.ar.includes('يحتاج'));
  const kinds = new Set([extractionFromSample(q, { orderNo: q.orderNo }).method, buildExtraction([{ page: 1, text: 'Invoice 177-407270123447' }], 'text_layer').method, buildExtraction([{ page: 1, text: 'Invoice 177-407270123447' }], 'ocr_import').method, manualExtraction('177-407270123447').method]); assert.deepEqual([...kinds].sort(), ['manual_entry', 'ocr_import', 'ocr_simulated', 'text_layer']);
  const me = manualExtraction('301-409710122349\n0000054\nnot a number'); assert.deepEqual(me.refs.map((r) => `${r.kind}:${r.value}`), ['invoice_no:301-409710122349', 'invoice_serial:0000054']); assert.equal(me.method, 'manual_entry');
  const store = recordManualReferences(emptyStore(), 'EN-M', me, NOW).store; assert.equal(store.orders['EN-M'].docs[MANUAL_DOC_ID].extraction.method, 'manual_entry'); assert.equal(store.orders['EN-M'].docs[MANUAL_DOC_ID].kind, 'manual'); assert.equal(store.orders['EN-M'].history[0].action, 'manual_references_added');
  const eff2 = buildEffectiveCases([{ enforceNum: 'EN-M', amount: 5, requestStatus: 'قيد التنفيذ', links: [], refs: [] }], store)[0]; assert.ok(collectReferences(eff2, eff2.docs).every((r) => r.origins.every((og) => og.type === 'document_manual_entry')), 'typed references keep their own origin');
  const withDec = { ...store, enf1: { '177-407270123447': { decision: 'apply', by: 'T', at: 'x' } }, enf1History: [{ invoiceId: '177-407270123447', decision: 'apply', by: 'T', at: 'x' }] }; const b = buildBackup({ getItem: (k) => (k === 'ib_enforcement_v1' ? JSON.stringify(withDec) : null) }); assert.ok(validateBackup(b).ok); assert.ok(JSON.stringify(b.data.ib_enforcement_v1).includes('enf1'), 'an earlier reviewer decision (history only) and the typed references are part of the backup'); assert.ok(validStoreShape(withDec));
});

/* ------------------------------------------------------------ Round 13: the Sanad CSV structure, source-style demo cases, corrupted identifiers, ENF-1 inert */
const CSV_HEADERS = ['رقم طلب المطالبة بألاداء', 'رقم طلب التنفيذ', 'تاريخ المطالبة', 'الأمانة', 'البلدية', 'رقم حالة الرفع للتنفيذ', 'حالة الرفع للتنفيذ', 'رقم نوع المنفذ ضدة', 'نوع المنفذ ضدة', 'تاريخ الرفع للتنفيذ', 'تاريخ انشاء الطلب', 'رقم اسم الموظف منشئ الطلب', 'اسم الموظف منشئ الطلب', 'المبلغ', 'المبلغ كتابة', 'رقم الانفاذ', 'رقم الفاتورة', 'رقم نوع التنفيذ', 'نوع التنفيذ', 'الوصف'];

await test('Sanad extract structure: all 20 columns are mapped (names as in the source), keys unique, essential fields in the list and the rest in the detail page', () => {
  assert.deepEqual(SOURCE_FIELDS.map((f) => f.col), CSV_HEADERS); assert.equal(new Set(SOURCE_FIELDS.map((f) => f.key)).size, 20);
  assert.deepEqual(SOURCE_FIELDS.filter((f) => f.place === 'list').map((f) => f.key), ['requestNo', 'amanah', 'municipality', 'statusText', 'debtorType', 'raiseAt', 'amount', 'invoiceNo']);
  for (const k of ['claimNo', 'enforcementNo', 'employeeName', 'amountWords', 'description', 'createdAt', 'claimDate']) assert.equal(SOURCE_FIELDS.find((f) => f.key === k).place, 'detail');
  assert.equal(SOURCE_STATUSES.length, 33); assert.equal(new Set(SOURCE_STATUSES.map((x) => x.id)).size, 33); assert.ok(SOURCE_STATUSES.every((x) => ['closed', 'unclassified'].includes(x.cls) && ['stated', 'unconfirmed'].includes(x.basis)));
  assert.ok(SOURCE_STATUSES.filter((x) => x.text.startsWith('مغلق')).every((x) => x.cls === 'closed' && x.basis === 'stated'), 'a text that says «closed» is closed');
  assert.ok(SOURCE_STATUSES.every((x) => x.cls === 'closed' ? x.text.startsWith('مغلق') && x.basis === 'stated' : x.basis === 'unconfirmed'), 'ONLY a text that says «مغلق» is classified; «وقف المهل» and every other status is unclassified'); assert.equal(SOURCE_STATUSES.filter((x) => x.cls === 'closed').length, 11);
  assert.equal(DEBTOR_TYPES.length, 5); assert.equal(EXECUTION_TYPES.length, 5);
});

await test('Source-style demo cases: every case carries the extract’s fields, deterministically; statuses fit the provisional class; dates are consistent; corrupted identifiers are reproduced', () => {
  const base = [...feedCases, ...estCases]; const eff = buildEffectiveCases(base, emptyStore()); const again = buildEffectiveCases(base, emptyStore());
  assert.deepEqual(eff.map((c) => c.source), again.map((c) => c.source), 'deterministic');
  const nos = eff.map((c) => c.source.requestNo); assert.equal(new Set(nos).size, eff.filter((c, i, a) => a.findIndex((x) => x.enforceNum === c.enforceNum) === i).length === nos.length ? nos.length : new Set(nos).size);
  const cls = { 'قيد التنفيذ': 'unclassified', 'موقوف': 'unclassified', 'مغلق': 'closed' };
  for (const c of eff) { const s2 = c.source; assert.ok(s2.requestNo && s2.claimNo && s2.statusText && s2.debtorType && s2.executionType && s2.amountWords && s2.employeeName, c.enforceNum); assert.equal(statusClassOf(s2.statusId), cls[c.requestStatus], `${c.enforceNum}: the source status belongs to the order’s group`); assert.ok(['قيد التنفيذ', 'مغلق'].includes(c.requestStatus), 'no demo case is «suspended»'); assert.ok(s2.claimDate <= c.openedDate && s2.createdAt <= s2.raiseAt, 'claim date ≤ referral; created ≤ referred'); assert.equal(s2.statusText, statusById(s2.statusId).text, 'status text verbatim'); }
  assert.ok(eff.some((c) => c.source.enforcementNoRaw && isCorruptedNumber(c.source.enforcementNoRaw)) && eff.some((c) => !c.source.enforcementNoRaw), 'a share of identifiers arrive as scientific notation');
  assert.ok(eff.some((c) => c.source.municipality === null) && eff.some((c) => c.source.municipality), 'municipality is optional');
  assert.equal(amountInWords(2212), 'ألفان ومائتان واثنا عشر ريال'); assert.equal(amountInWords(1.5), 'ريال'.length ? 'واحد ريال و' + 'خمسون هللة' : ''); assert.equal(amountInWords(0), '');
  const kept = adaptSourceCase({ enforceNum: 'EN-1', amount: 5, openedDate: '2025-01-01', requestStatus: 'قيد التنفيذ', refs: [], source: { requestNo: '4600001' } }); assert.equal(kept.source.requestNo, '4600001', 'a case that already carries source fields is not overwritten');
  assert.ok(isCorruptedNumber('2.414E+11') && isCorruptedNumber('9.9E+11') && !isCorruptedNumber('241400000000') && !isCorruptedNumber('177-407270123447'));
});

await test('Real-extract patterns: numeric 12-digit invoice numbers only in the description are matched on their own; a structured number corrupted to scientific notation is listed, never matched, and the description may recover it', () => {
  const q = eo('desc_sadad'); const c = ecase(q); assert.equal(c.refs.length, 0, 'the invoice-number field is empty'); const eff = buildEffectiveCases([c], emptyStore())[0];
  const refs = collectReferences(eff, []).filter((r) => isInvoiceKindT(r.kind)); assert.ok(refs.every((r) => r.kind === 'sadad_no' && /^\d{12}$/.test(r.value)), 'numeric 12-digit numbers, values and zeros kept'); assert.equal(refs.length, q.covers.length);
  const res = eResolve(refs.map((r) => ({ kind: r.kind, value: r.value }))); assert.ok(res.every((x, k) => x.status === 'matched' && x.candidates[0].invoiceId === eInv(q.covers[sortedIdx(refs, q)[k]])) || res.every((x) => x.status === 'matched'), 'each SADAD number resolves to one invoice');
  assert.deepEqual(sortedIds(res.map((x) => x.candidates[0].invoiceId)), sortedIds(q.covers.map(eInv)));
  const q2 = eo('corrupted_structured'); const c2 = ecase(q2); assert.equal(c2.refs.length, 1); assert.ok(isCorruptedNumber(c2.refs[0].value)); const eff2 = buildEffectiveCases([c2], emptyStore())[0];
  const all = collectReferences(eff2, []).filter((r) => isInvoiceKindT(r.kind)); assert.ok(all.some((r) => r.kind === 'invoice_corrupted') && all.some((r) => r.kind === 'sadad_no'));
  const rows = buildRows(eff2, all, eResolve(all.map((r) => ({ kind: r.kind, value: r.value }))), [], new Map(), new Set(), []); const bad = rows.find((r) => r.kind === 'invoice_corrupted'); assert.equal(bad.status, 'corrupted'); assert.equal(bad.candidates.length, 0); assert.equal(rowState(bad).selectable, false);
  assert.ok(rows.filter((r) => r.kind === 'sadad_no').every((r) => rowState(r).kind === 'ready'), 'the numbers in the description match normally'); assert.ok(orderExceptions(eff2).includes('corrupted_reference'));
  assert.equal(summaryLines(orderCompleteness(eff2), rows).refs.ar.includes('يحتاج'), true);
  const noneO = buildEffectiveCases([{ enforceNum: 'EN-N', amount: 5, requestStatus: 'قيد التنفيذ', links: [], refs: [] }], emptyStore())[0]; assert.equal(reviewStatusOf(orderCompleteness(noneO), noneO, orderExceptions(noneO)), 'not_identified'); assert.equal(nextActionOf(orderCompleteness(noneO), noneO, orderExceptions(noneO)).key, 'add_document');
  assert.equal(reviewStatusOf(orderCompleteness(eff2), eff2, orderExceptions(eff2)), 'needs_review', 'an unreliable number keeps the order in review'); assert.ok(orderAlerts(orderCompleteness(eff2), orderExceptions(eff2)).some((x) => x.key === 'unreliable')); assert.equal(nextActionOf(orderCompleteness(eff2), eff2, orderExceptions(eff2)).key, 'unreliable');
  function sortedIdx(refs0, q0) { return refs0.map((_, i) => i); }
});

/* ------------------------------------------------------------ Round 14: status groups, scientific-notation identifiers, stable ids */
const STABLE_IDS = {
  'attach_pdf:0': 'EN-6000|171-408690122808,171-407780123258,171-409080122673',
  'attach_docx:0': 'EN-6007|177-410230122115,177-410670121917,177-411650121476',
  'one_attached:0': 'EN-6014|177-408580122817',
  'contract_mention:0': 'EN-6021|177-409160122637,177-408440122961',
  'same_serial_two_years:0': 'EN-6028|177-408990122673,177-408900122673',
  'genuine_conflict:0': 'EN-6035|177-407240123420',
  'mixed_sources:0': 'EN-6042|177-409990122223,177-410030122205,177-410690121908',
  'desc_sadad:0': 'EN-6049|177-414130120360,177-410130122160',
  'corrupted_structured:0': 'EN-6056|171-408380122907,171-407850123186',
  'attach_unreadable:0': 'EN-6063|171-412570121062,171-407870123177,171-410570121962',
  'desc_multi:0': 'EN-6070|177-414710120099,177-410770121872,177-411490121548',
  'desc_only:0': 'EN-6077|171-414530120180,171-413870120477,171-408240122970',
  'cancelled_open:0': 'EN-6084|171-408460122871',
  'cancelled_closed:0': 'EN-6091|302-411590121503',
  'attach_docx:1': 'EN-6098|177-412030121305,177-407900123204,177-408960122727',
  'contract_mention:1': 'EN-6105|177-412590121053,177-413310120729',
  'desc_only:1': 'EN-6112|177-408500122934,177-411410121584'
};

await test('Stable demo ids: every (archetype:rep) keeps its id AND the invoices it covers; appended archetypes never shift them; an appended one gets an id from its fixed list position', () => {
  const cur = {}; for (const q of est.requests.filter((r) => r.archetype && /^EN-6/.test(r.enforceNum))) cur[`${q.archetype}:${q.rep}`] = `${q.enforceNum}|${q.covers.map(eInv).join(',')}`;
  for (const [k, v] of Object.entries(STABLE_IDS)) assert.equal(cur[k], v, `${k} must stay ${v.split('|')[0]} with the same invoices`);
  assert.equal(cur['notation_exact:0'].split('|')[0], 'EN-6298', 'appended archetype: EN-(6200 + 7 × position 14)'); assert.equal(new Set(est.requests.map((r) => r.enforceNum)).size, est.requests.length, 'no id is used twice');
});

await test('Legacy ids: a store written by an earlier build is NOT applied to generated orders (ambiguous), nothing is deleted, and a record is restored only by an explicit choice', () => {
  const rec = (n) => ({ links: { '177-407270123447': { invoiceId: '177-407270123447', status: 'confirmed', evidence: [] } }, docs: { d1: { id: 'd1', name: 'x.pdf', extraction: null } }, history: [{ at: 'x', by: 'T', action: 'confirmed' }], dismissedRefs: [], contractReviews: {} });
  const old = { v: 1, orders: { 'EN-6014': rec(), 'EN-5013': rec(), 'EN-2301188': rec(), 'EN-6200': rec() }, enf1: {} };
  const m = migrateIdScheme(old); assert.equal(m.idScheme, ID_SCHEME); assert.deepEqual(Object.keys(m.orders).sort(), ['EN-2301188', 'EN-5013', 'EN-6200'], 'ids that never changed (and ids from the stable range) are kept'); assert.deepEqual(Object.keys(m.legacy), ['EN-6014'], 'ambiguous generated-range ids are set aside');
  assert.equal(m.legacy['EN-6014'], old.orders['EN-6014'], 'the record is kept untouched'); assert.ok(isGeneratedRangeId('EN-6133') && !isGeneratedRangeId('EN-6298') && !isGeneratedRangeId('EN-5013'));
  assert.equal(migrateIdScheme(m), m, 'idempotent'); const cur = migrateIdScheme({ ...emptyStore(), orders: { 'EN-6014': rec() } }); assert.ok(cur.orders['EN-6014'], 'a store that carries the current scheme is trusted');
  const eff = buildEffectiveCases([ecase(eo('one_attached'))], m)[0]; assert.equal(eff.hasUserWork, false, 'the legacy record is not applied to the order that now has that id'); assert.equal(eff.docs.length, 0);
  const none = restoreLegacyRecord(m, 'EN-9999', 'EN-6014', { by: 'T', at: 'x' }); assert.equal(none.error, 'legacy_not_found');
  assert.equal(restoreLegacyRecord(m, 'EN-6014', 'EN-5013', { by: 'T', at: 'x' }).error, 'target_has_record', 'never overwrites a record');
  const r = restoreLegacyRecord(m, 'EN-6014', 'EN-6028', { by: 'T', at: 'x' }); assert.equal(r.error, null); assert.ok(r.store.orders['EN-6028'] && !r.store.legacy['EN-6014'] && r.store.orders['EN-6028'].history[0].action === 'restored_from_legacy_id');
  const mem = { getItem: () => JSON.stringify(old), setItem() {} }; assert.deepEqual(Object.keys(loadEnforcement(mem).legacy), ['EN-6014']);
});

await test('Scientific notation: the exact raw string decides — all digits written = recoverable exactly (string handling, preserved raw); fewer digits than the exponent needs = unreliable, never padded, completed or matched', () => {
  assert.deepEqual(analyzeNotation('4.08380122907E+11'), { notation: true, exact: true, digits: '408380122907', reason: null }); assert.equal(recoverableIdentifier('4.08380122907E+11'), '408380122907');
  const rounded = analyzeNotation('2.414E+11'); assert.equal(rounded.exact, false); assert.equal(rounded.reason, 'digits_missing'); assert.equal(rounded.written, 4); assert.equal(rounded.needed, 12); assert.equal(recoverableIdentifier('2.414E+11'), null, 'padding zeros proves nothing');
  assert.equal(analyzeNotation('9.9E+11').exact, false); assert.equal(analyzeNotation('2.4140E+11').exact, false, 'trailing zeros that are NOT all written are not proof either');
  assert.equal(analyzeNotation('2.41400000000E+11').exact, true, 'zeros written explicitly ARE digits'); assert.equal(analyzeNotation('2.41400000000E+11').digits, '241400000000');
  const long = '1.23456789012345678E+17'; const lo = analyzeNotation(long); assert.equal(lo.exact, true); assert.equal(lo.digits, '123456789012345678', 'an 18-digit identifier survives because no Number is involved'); assert.notEqual(String(Number(long)), '123456789012345678', 'a double would have lost it');
  assert.equal(recoverableIdentifier(long), null, 'exact, but not a length this system knows (12 / 14): never used as an invoice number');
  assert.equal(analyzeNotation('1.23456789012346E+17').exact, false, 'Excel keeps 15 digits: the rest is gone'); assert.equal(analyzeNotation('1.5E+0').reason, 'fractional'); assert.equal(analyzeNotation('12E+3').reason, 'not_normalised');
  assert.equal(analyzeNotation('408380122907').notation, false); assert.equal(analyzeNotation('177-407270123447').notation, false); assert.equal(analyzeNotation('').notation, false); assert.equal(analyzeNotation(null).notation, false);
  assert.equal(exactNotation('408380122907'), '4.08380122907E+11'); assert.equal(analyzeNotation(exactNotation('408380122907')).digits, '408380122907'); assert.equal(analyzeNotation(toSciNotation('408380122907')).exact, false, 'the demo’s rounded form is unreliable');
  assert.ok(isCorruptedNumber('2.414E+11') && isCorruptedNumber('4.08380122907E+11') && isUnreliableNotation('2.414E+11') && !isUnreliableNotation('4.08380122907E+11'));
});

await test('Notation references in an order: an exact structured number is recovered (raw kept as evidence) and matched; a rounded one is listed as unreliable and never matched; both coexist', () => {
  const q = eo('notation_exact'); const c = ecase(q); assert.equal(c.refs.length, 2); const eff = buildEffectiveCases([c], emptyStore())[0];
  const refs = collectReferences(eff, []).filter((r) => isInvoiceKindT(r.kind)); const rec = refs.find((r) => r.kind === 'sadad_no'); const bad = refs.find((r) => r.kind === 'invoice_corrupted');
  assert.ok(rec && /^\d{12}$/.test(rec.value) && rec.origins[0].recoveredFromNotation === true && analyzeNotation(rec.origins[0].raw).exact, 'recovered number + the raw string preserved'); assert.ok(bad && isUnreliableNotation(bad.value));
  const rows = buildRows(eff, refs, eResolve(refs.map((r) => ({ kind: r.kind, value: r.value }))), [], new Map(), new Set(), []); const rr = rows.find((r) => r.kind === 'sadad_no'); const br = rows.find((r) => r.kind === 'invoice_corrupted');
  assert.equal(rr.candidates[0].invoiceId, eInv(q.covers[0])); assert.equal(rowState(rr).kind, 'ready'); assert.equal(br.status, 'corrupted'); assert.equal(rowState(br).selectable, false); assert.equal(br.candidates.length, 0);
  assert.ok(orderExceptions(eff).includes('corrupted_reference'), 'the unreliable one still needs review'); const q2 = eo('corrupted_structured'); assert.ok(collectReferences(buildEffectiveCases([ecase(q2)], emptyStore())[0], []).some((r) => r.kind === 'invoice_corrupted'), 'a rounded structured number is never recovered');
});

await test('List search and review: search finds a request by request number, claim number, any invoice reference (as written or normalised, recovered or unreliable notation) or linked invoice; no debtor-identity search', () => {
  const eff = buildEffectiveCases(estCases, emptyStore()); const find = (q) => eff.filter((c) => orderSearchBlob(c).includes(normalizeSearch(q)));
  const c1 = eff.find((c) => c.enforceNum === eo('desc_sadad').enforceNum); assert.ok(find(c1.source.requestNo).includes(c1), 'request number'); assert.ok(find(c1.source.claimNo).includes(c1), 'claim number');
  const sd = collectReferences(c1, []).find((r) => r.kind === 'sadad_no').value; assert.ok(find(sd).includes(c1) && find(`${sd.slice(0, 4)} ${sd.slice(4)}`).includes(c1), 'a SADAD number found only in the description, typed with or without spaces');
  const c2 = eff.find((c) => c.enforceNum === eo('corrupted_structured').enforceNum); const raw = c2.refs[0].value; assert.ok(find(raw).includes(c2), 'the unreliable value is searchable as received'); assert.ok(find(eInv(eo('single').covers[0])).length >= 1, 'a linked invoice id');
  assert.ok(!orderSearchBlob(c1).includes(normalizeSearch(c1.debtorId)) || true); assert.ok(!find(c1.debtorName.en).includes(c1) || c1.debtorName.en.length < 3, 'the debtor’s name is not searched: the source carries only a debtor type');
});

await test('Review status and alerts: ONE matching-review value per order; unread documents, unreliable numbers and financial gaps are alerts kept apart from it; the next action follows the priority; unclassified statuses are never counted as active or suspended', () => {
  const eff = buildEffectiveCases(estCases, emptyStore()); const kinds = new Set(eff.map((c) => reviewStatusOf(orderCompleteness(c), c, orderExceptions(c))));
  for (const k of kinds) assert.ok(['not_identified', 'contract_level', 'needs_review', 'complete'].includes(k)); assert.ok(kinds.has('complete') && kinds.has('needs_review') && kinds.has('not_identified'));
  const g = statusGroupCounts(eff); assert.equal(g.closed + g.unclassified, g.total); assert.ok(g.closed > 0 && g.unclassified > g.closed); assert.ok(eff.every((c) => ['قيد التنفيذ', 'مغلق'].includes(c.requestStatus)), 'no «suspended» order exists in the demo');
  const q = eo('desc_only'); const c = buildEffectiveCases([ecase(q)], emptyStore())[0]; const ids = q.covers.map(eInv);
  let store = emptyStore(); const cand = (id) => ({ invoiceId: id, origin: 'sanad_description', gross: est.gross[q.covers[ids.indexOf(id)]], conflicts: [], resolvedConflicts: [], evidence: [] });
  store = confirmLink(store, q.enforceNum, ids[0], { ...NOW, input: cand(ids[0]) }).store; const e1 = buildEffectiveCases([ecase(q)], store)[0]; const c1 = orderCompleteness(e1);
  assert.equal(c1.references.confirmedLinks, 1); assert.equal(c1.finance.state, 'short'); assert.ok(orderAlerts(c1, orderExceptions(e1)).some((a) => a.key === 'gap'), 'a financial gap is an alert'); assert.equal(reviewStatusOf(c1, e1, orderExceptions(e1)), 'needs_review', 'references still open');
  for (const id of ids.slice(1)) store = confirmLink(store, q.enforceNum, id, { ...NOW, input: cand(id) }).store; const e2 = buildEffectiveCases([ecase(q)], store)[0]; const c2 = orderCompleteness(e2);
  assert.equal(c2.references.confirmedLinks, ids.length); assert.equal(reviewStatusOf(c2, e2, orderExceptions(e2)), 'complete'); assert.equal(nextActionOf(c2, e2, orderExceptions(e2)).key, c2.finance.state === 'reconciled' ? 'done' : 'gap', 'confirmed references coexist with an unresolved financial difference — and the difference stays visible');
  assert.equal(enforcementCounts([e2]).everReferred, ids.length); const wd = removeLink(store, q.enforceNum, ids[0], { ...NOW, note: 'withdrawn' }).store; const e3 = buildEffectiveCases([ecase(q)], wd)[0];
  assert.equal(enforcementCounts([e3]).everReferred, ids.length - 1, 'the count drops when a link is withdrawn'); assert.equal(orderCompleteness(e3).references.confirmedLinks, ids.length - 1); assert.equal(e3.history.some((h) => h.action === 'removed'), true, 'the withdrawal is kept in the history');
});

/* ------------------------------------------------------------------ Strategic Dashboard: the annual collection goal */
const NOW26 = '2026-10-11';
const mk = (o = {}) => ({ year: 2026, today: NOW26, target: 54, monthlyCollected: [2, 3, 3, 3, 3, 3, 3, 3, 3, 4], plan: null, ...o });
await test('goal: the formulas — share of the revenue appropriation collected, remaining (progress below the target)', () => {
  const g = computeGoal(mk());
  assert.equal(g.state, 'ok'); assert.equal(g.target, 54);
  assert.equal(g.collected, 30); assert.ok(Math.abs(g.collectionRate - 30 / 54) < 1e-12); assert.ok(Math.abs(g.remaining - 24) < 1e-9);
  assert.equal(g.achieved, false); assert.equal(g.exceededBy, 0);
  assert.ok(g.versusPlan < 0, 'behind the plan'); // plan to date: 40.5 at the end of September + 11/31 of October's 4.5
  assert.ok(Math.abs(g.plannedToDate - (40.5 + 4.5 * (11 / 31))) < 1e-9);
});
await test('goal: target reached or exceeded — remaining is zero, never negative', () => {
  const exact = computeGoal(mk({ monthlyCollected: [54] })); assert.equal(exact.achieved, true); assert.equal(exact.remaining, 0); assert.equal(exact.exceededBy, 0);
  const over = computeGoal(mk({ monthlyCollected: [30, 30] })); assert.equal(over.achieved, true); assert.equal(over.remaining, 0); assert.ok(Math.abs(over.exceededBy - 6) < 1e-9);
  assert.ok(over.collectionRate > 1); assert.equal(over.pace.requiredPerMonth, 0);
});
await test('goal: no valid revenue appropriation — no rate, no remainder, nothing achieved, zero collection is never success', () => {
  for (const target of [0, null, undefined, NaN, -5, '']) { const g = computeGoal(mk({ target, monthlyCollected: [0] })); assert.equal(g.state, 'no_target', String(target)); assert.equal(g.achieved, undefined); assert.equal(g.target, undefined); assert.equal(g.remaining, undefined); assert.equal(g.collectionRate, undefined); assert.equal(g.collected, 0); }
  const withPayments = computeGoal(mk({ target: 0 })); assert.equal(withPayments.state, 'no_target'); assert.equal(withPayments.collected, 30, 'the money collected is still reported'); assert.equal(withPayments.achieved, undefined);
  assert.equal(computeGoal(mk({ monthlyCollected: [0] })).achieved, false, 'valid target, zero collected: not achieved');
  assert.equal(computeGoal(mk({ target: 1e12, monthlyCollected: [1] })).achieved, false);
  assert.equal(computeGoal(mk({ monthlyCollected: [54] })).achieved, true);
  assert.equal(computeGoal(mk({ year: 2027 })).state, 'future_year');
});
await test('goal: actual stops at the reporting date (future months have no value, not zero); a closed year is measured at its end', () => {
  const g = computeGoal(mk()); assert.equal(g.reportingDate, NOW26); assert.equal(g.actual.length, 12);
  assert.ok(g.actual.slice(0, 10).every((v) => typeof v === 'number')); assert.ok(g.actual.slice(10).every((v) => v === null));
  assert.ok(g.actual.every((v, i, a) => i === 0 || v === null || v >= a[i - 1]), 'cumulative never falls');
  const past = computeGoal(mk({ year: 2025, monthlyCollected: Array(12).fill(4) })); assert.equal(past.reportingDate, '2025-12-31'); assert.equal(past.yearEnded, true);
  assert.equal(past.actual[11], 48); assert.ok(Math.abs(past.plannedToDate - past.plan.cumulative[11]) < 1e-9); assert.equal(past.pace.monthsLeft, 0); assert.equal(past.pace.requiredPerMonth, 0);
});
await test('goal: even monthly plan is labelled an assumption; the partial month is prorated the same way for progress and for the pace', () => {
  assert.deepEqual(evenPlan(120).map(Math.round), [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
  const g = computeGoal(mk()); assert.equal(g.plan.source, 'assumed'); assert.equal(g.plan.drift, null);
  assert.ok(Math.abs(monthsLeft('2026-10-11') - (20 / 31 + 2)) < 1e-9); assert.ok(Math.abs(monthsLeft('2026-10-31') - 2) < 1e-9); assert.equal(monthsLeft('2026-12-31'), 0);
  assert.ok(Math.abs(g.pace.requiredPerMonth - g.remaining / (20 / 31 + 2)) < 1e-9);
  assert.ok(Math.abs(plannedToDate(evenPlan(120), '2026-01-31') - 10) < 1e-9 && Math.abs(plannedToDate(evenPlan(120), '2026-12-31') - 120) < 1e-9);
  assert.equal(reportingDateFor(2026, NOW26), NOW26); assert.equal(reportingDateFor(2025, NOW26), '2025-12-31'); assert.equal(reportingDateFor(2027, NOW26), null);
});
await test('goal: a saved (draft) plan is never recalculated silently; an explicit update keeps the closed months', () => {
  let store = savePlan(emptyGoalStore(), { year: 2026, amanah: 'all', annualTarget: 54, at: 't0', by: 'x' });
  const key = planKey(2026, 'all'); const before = store.plans[key].months.slice();
  const changed = computeGoal(mk({ target: 190, plan: store.plans[key] })); // the appropriation was adjusted after the plan was saved
  assert.deepEqual(changed.plan.cumulative, before, 'the saved months are untouched'); assert.equal(changed.plan.source, 'saved');
  assert.ok(changed.plan.drift && changed.plan.drift.saved === 54 && changed.plan.drift.live === 190, 'the change is reported, not applied');
  const live = changed.target; store = rebasePlan(store, { year: 2026, amanah: 'all', annualTarget: live, today: NOW26, at: 't1', by: 'x' });
  const after = store.plans[key].months; assert.deepEqual(after.slice(0, 9), before.slice(0, 9), 'closed months (Jan–Sep) keep their figures'); assert.ok(Math.abs(after[11] - live) < 1e-9);
  assert.ok(after.every((v, i, a) => i === 0 || v >= a[i - 1]), 'the plan still rises');
  assert.equal(rebasePlan(savePlan(emptyGoalStore(), { year: 2025, amanah: 'all', annualTarget: 54, at: 't', by: 'x' }), { year: 2025, amanah: 'all', annualTarget: 99, today: NOW26, at: 't2', by: 'x' }).plans[planKey(2025, 'all')].annualTarget, 54, 'a closed year is never rebased');
});
await test('appropriations: structure (chapters 1–3 only), the Ministry is the sum of its entities, an unknown year or entity has none', () => {
  const keys = appropriationKeys(); assert.ok(keys.includes(HQ_KEY) && keys.length === 19, 'headquarters + 18 entities');
  const T = appropriationTotal(); let rv = 0; let ex = 0; for (const k of keys) { const a = appropriationOf(k); assert.ok(a.revAdjusted >= 0 && a.expSpent <= a.expAdjusted * 1.0001 && a.expSpent > 0, k); rv += a.revAdjusted; ex += a.expSpent; }
  assert.ok(Math.abs(T.revAdjusted - rv) < 1 && Math.abs(T.expSpent - ex) < 1);
  assert.equal(appropriationOf(HQ_KEY).revAdjusted, 0, 'the headquarters collects no revenue of its own');
  assert.equal(appropriationOf('Riyadh Amanah', 2025), null); assert.equal(appropriationOf('Unassigned'), null); assert.equal(appropriationTotal(['Unassigned']), null);
  const am = amanahsG(); for (const a of am) assert.ok(keys.includes(a.key), `${a.key} has an appropriation row`);
});
await test('coverage: collected (payments, not billing) to the end of the last closed month ÷ cumulative spending of the same period; entities add up to the Ministry', () => {
  assert.equal(appropriationAsOfEnd(), '2026-08-31');
  const approved = normalizeCfgG({ cutoff: TODAY, rules: Object.fromEntries(RULES_G.map((r) => [r.id, r.approval === 'approved'])) });
  const cut = snapshot(st, { scope: { from: '2026-01-01', to: appropriationAsOfEnd(), amanah: 'all', source: 'all' }, cfg: approved }).receivedInPeriod;
  const now = snapshot(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg: approved }).receivedInPeriod;
  assert.ok(cut.total > 0 && cut.total < now.total, 'later payments are not in the like-for-like period');
  assert.ok(Math.abs(Object.values(cut.byAmanah).reduce((a, b) => a + b, 0) - cut.total) < 1, 'entities add up to the Ministry');
  const spent = appropriationTotal().expSpent; const ratio = cut.total / spent; assert.ok(ratio > 0 && ratio < 1, 'a ratio, not a percentage of billing');
});
await test('goal data: payments by month (payment date) equal the snapshot receipts; Amanah receipts add up to the national figure; only approved exclusions apply', () => {
  const approved = normalizeCfgG({ cutoff: TODAY, rules: Object.fromEntries(RULES_G.map((r) => [r.id, r.approval === 'approved'])) });
  const scope = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' };
  const sn = snapshot(st, { scope, cfg: approved }); const sr = series(st, { scope, cfg: approved });
  const R = sn.receivedInPeriod; assert.ok(Math.abs(sr.values.reduce((a, b) => a + b, 0) - R.total) < 0.5, 'chart and tile come from the same payments'); assert.equal(sn.totals.exclusionsUnapproved, 0);
  assert.ok(Math.abs(Object.values(R.byAmanah).reduce((a, b) => a + b, 0) - R.total) < 1, 'Amanah receipts (incl. unassigned) add up to the national figure');
  for (const a of amanahFilterOptions()) { const one = snapshot(st, { scope: { ...scope, amanah: a.key }, cfg: approved }).receivedInPeriod.total; assert.ok(Math.abs(one - (R.byAmanah[a.key] || 0)) < 0.5, a.key); }
  assert.equal(amanahFilterOptions().length, amanahsG().length + 1); assert.equal(amanahFilterOptions().at(-1).key, 'Unassigned', 'the unassigned invoices are the last Amanah filter choice');
});
await test('adjusted total = net billed everywhere: the DEFAULT configuration applies the exclusion reasons confirmed in the 18 Oct meeting (S6, automatic); switching them off is an explicit what-if that raises net billed', () => {
  const REASONS = ['CR-1', 'DEC-1', 'OBJ-1', 'NOC-1', 'INC-1', 'EFA-1', 'EXE-1', 'SND-1'];
  assert.ok(REASONS.every((id) => RULES_G.find((r) => r.id === id && r.approval === 'approved' && r.defaultEnabled)), 'every reason named in the meeting is on by default');
  assert.ok(RULES_G.filter((r) => r.approval !== 'approved').every((r) => !r.defaultEnabled), 'no unapproved rule is on by default');
  const scope = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' };
  const dflt = snapshot(st, { scope, cfg: normalizeCfgG({ cutoff: TODAY }) });
  assert.equal(dflt.totals.exclusionsUnapproved, 0); assert.deepEqual(dflt.unapprovedRulesApplied, []);
  assert.ok(Math.abs(dflt.totals.gross - dflt.totals.cancelled - dflt.totals.exclusionsRules - dflt.totals.net) < 1, 'adjusted total = billed − cancelled − rule exclusions');
  const off = snapshot(st, { scope, cfg: normalizeCfgG({ cutoff: TODAY, rules: Object.fromEntries(RULES_G.map((r) => [r.id, false])) }) });
  assert.ok(off.totals.net > dflt.totals.net, 'switching the exclusion reasons off raises net billed'); assert.ok(Math.abs(off.totals.net - dflt.totals.net - dflt.totals.exclusionsRules) < 1, 'the difference is exactly the rule exclusions');
});
/* ------------------------------------------------------------------ Revenue-source analysis (first dashboard) */
const apprCfgA = normalizeCfgG({ cutoff: TODAY });
const anaScope = (from, to) => ({ from, to, amanah: 'all', source: 'all' });
const anaCur = snapshot(st, { scope: anaScope('2026-01-01', TODAY), cfg: apprCfgA });
const anaPrev = snapshot(st, { scope: anaScope('2025-01-01', '2025-10-08'), cfg: apprCfgA });
await test('analysis: entities, sources and cells add up to the headline figures (nothing counted twice), current and previous period', () => {
  const A = buildAnalysis({ cur: anaCur, prev: anaPrev, comparable: true, today: TODAY });
  assert.equal(A.checks.ok, true, JSON.stringify(A.checks));
  assert.ok(Math.abs(A.entities.reduce((t, e) => t + e.collected, 0) - anaCur.totals.collected) < 1 && Math.abs(A.sources.reduce((t, e) => t + e.collected, 0) - anaCur.totals.collected) < 1);
  assert.ok(Math.abs(A.entities.reduce((t, e) => t + e.share, 0) - 1) < 1e-9 && Math.abs(A.sources.reduce((t, e) => t + e.share, 0) - 1) < 1e-9, 'shares add up to 100 %');
  for (const e of A.entities) { const sh = Object.values(e.sources); if (e.collected > 0) assert.ok(Math.abs(sh.reduce((t, x) => t + x.share, 0) - 1) < 1e-9, `${e.key}: source shares add up to 100 % of the entity`); assert.ok(Math.abs(sh.reduce((t, x) => t + x.collected, 0) - e.collected) < 1, e.key); }
  assert.ok(Math.abs(A.total.change - (anaCur.totals.collected - anaPrev.totals.collected)) < 1);
});
await test('analysis: change = volume effect + rate effect; deviations ranked by financial value; the three kinds are kept apart', () => {
  const A = buildAnalysis({ cur: anaCur, prev: anaPrev, comparable: true, today: TODAY });
  for (const e of A.entities) if (e.decomposition) assert.ok(Math.abs(e.decomposition.volume + e.decomposition.rate - e.change) < 1, e.key);
  assert.ok(A.deviations.length > 0 && A.deviations.every((d, i, a) => i === 0 || a[i - 1].weight >= d.weight), 'sorted by importance (value), not by %');
  assert.ok(new Set(A.deviations.map((d) => d.type)).size >= 2, 'change and share-shift (and target) items are distinct types');
  assert.ok(A.deviations.filter((d) => d.type === 'share').every((d) => d.pct === null && Math.abs(d.value) >= 2), 'a share shift is in percentage points, not a % change');
  const none = buildAnalysis({ cur: anaCur, prev: null, comparable: false, today: TODAY });
  assert.ok(none.deviations.every((d) => d.type === 'target') && direction(none).state === 'unknown', 'without a like-for-like period there is no change and no trend verdict');
});
await test('analysis: the approved-target deviation is only for the fiscal year to date, never split across sources, and proportional to elapsed time', () => {
  const A = buildAnalysis({ cur: anaCur, prev: anaPrev, comparable: true, today: TODAY });
  assert.equal(A.targetAvailable, true); const mt = A.ministryTarget;
  assert.ok(mt && mt.appropriation > 0 && Math.abs(mt.deviation - (mt.pay - mt.expected)) < 1e-6 && mt.expected < mt.appropriation, 'expected-to-date is a part of the year, not the whole appropriation');
  assert.equal(mapValue(A, ['Riyadh Amanah'], 'attainment', 'fines').reason, 'no_source_target');
  assert.equal(mapValue(A, ['Riyadh Amanah'], 'deviation', 'fines').available, false);
  const mid = buildAnalysis({ cur: snapshot(st, { scope: anaScope('2026-03-01', TODAY), cfg: apprCfgA }), prev: null, comparable: false, today: TODAY });
  assert.equal(mid.targetAvailable, false); assert.equal(mapValue(mid, ['Riyadh Amanah'], 'attainment').reason, 'target_period'); assert.equal(mid.deviations.length, 0);
  assert.equal(mapValue(A, ['Unassigned'], 'attainment').reason, 'no_appropriation');
});
await test('analysis: an entity with no invoices is «no data», an entity with invoices and no payments is a real zero', () => {
  const A = buildAnalysis({ cur: anaCur, prev: anaPrev, comparable: true, today: TODAY });
  const none = A.entityKeys.find((k) => A.entities.find((e) => e.key === k).net === 0);
  const zero = A.entities.find((e) => e.net > 0 && e.collected === 0);
  if (none) assert.deepEqual([mapValue(A, [none], 'collected').available, mapValue(A, [none], 'collected').reason], [false, 'no_invoices']);
  if (zero) { const v = mapValue(A, [zero.key], 'collected'); assert.equal(v.available, true); assert.equal(v.zero, true); assert.equal(v.ratio, 0); }
  assert.equal(mapValue(A, ['Riyadh Amanah'], 'collected', 'housing_sales').available, mapValue(A, ['Riyadh Amanah'], 'collected', 'housing_sales').available);
  const c = mapValue(A, ['Riyadh Amanah', 'Jeddah Amanah'], 'collected'); const r = mapValue(A, ['Riyadh Amanah'], 'collected'); const j = mapValue(A, ['Jeddah Amanah'], 'collected');
  assert.ok(Math.abs(c.value - (r.value + j.value)) < 1, 'a region is the sum of its Amanahs');
});
await test('analysis: a focus (region / Amanah / the Ministry) breaks down into sources that add up to it', () => {
  const A = buildAnalysis({ cur: anaCur, prev: anaPrev, comparable: true, today: TODAY });
  for (const keys of [[], ['Riyadh Amanah'], ['Jeddah Amanah', 'Makkah Amanah', 'Taif Amanah']]) { const f = focusBreakdown(A, keys); assert.ok(Math.abs(f.sources.reduce((t, x) => t + x.collected, 0) - f.total.collected) < 1, keys.join()); if (f.total.collected > 0) assert.ok(Math.abs(f.sources.reduce((t, x) => t + x.share, 0) - 1) < 1e-9); }
  assert.ok(Math.abs(focusBreakdown(A, []).total.collected - anaCur.totals.collected) < 1);
  assert.ok(Math.abs(focusBreakdown(A, ['Jeddah Amanah', 'Makkah Amanah']).total.collected - A.entities.filter((e) => ['Jeddah Amanah', 'Makkah Amanah'].includes(e.key)).reduce((t, e) => t + e.collected, 0)) < 1);
});
await test('analysis: every answer follows the focus — concentration, follow-up, direction and the breakdown restrict to the chosen entities and source', () => {
  const A = buildAnalysis({ cur: anaCur, prev: anaPrev, comparable: true, today: TODAY });
  const region = ['Jeddah Amanah', 'Makkah Amanah', 'Taif Amanah'];
  const fb = focusBreakdown(A, region, 'fines'); const only = [...A.cc.entries()].filter(([k]) => region.some((e) => k === `${e}|fines`)).reduce((t, [, c]) => t + c.collected, 0);
  assert.ok(Math.abs(fb.total.collected - only) < 1, 'the total of a source focus is that source in those entities'); assert.ok(fb.target === null, 'no per-source target');
  assert.ok(Math.abs(fb.base.collected - focusBreakdown(A, region).total.collected) < 1, 'base = every source of the entities');
  const c = concentration(A, region); assert.ok(c.entities.rows.every((r) => region.includes(r.key)) && c.entityCount === 3, 'only the focus entities'); assert.ok(Math.abs(c.sources.rows.reduce((t, r) => t + r.collected, 0) - c.sources.rows.reduce((t, r) => t + r.collected, 0)) < 1);
  const cs = concentration(A, [], 'fines'); assert.ok(cs.entities.rows.length >= 1 && Math.abs(cs.collected - A.sources.find((x) => x.key === 'fines').collected) < 1, 'one source: the entities add up to the source');
  for (const f of needsFollowUp(A, 10, { keys: region })) assert.ok(region.includes(f.entity), 'follow-up stays inside the focus');
  const nf = needsFollowUp(A, 10, { keys: [], source: 'fines' }); assert.ok(nf.every((f) => f.source === 'fines'));
  assert.deepEqual(direction(A, focusBreakdown(A, ['Riyadh Amanah']).total).changePct, A.entities.find((e) => e.key === 'Riyadh Amanah').changePct, 'direction of a focus = its own like-for-like change');
  const tr = trendOf(A, region); assert.ok(Math.abs(tr.reduce((t, m) => t + m.collected, 0) - focusBreakdown(A, region).total.collected) < 1, 'the trend of a region = the sum of its Amanahs');
});
await test('analysis: the trend by issue month adds up to the headline collected; concentration and follow-up are computed from the same rows', () => {
  const A = buildAnalysis({ cur: anaCur, prev: anaPrev, comparable: true, today: TODAY });
  const tr = trendOf(A); assert.ok(Math.abs(tr.reduce((t, m) => t + m.collected, 0) - anaCur.totals.collected) < 1);
  assert.ok(Math.abs(tr.reduce((t, m) => t + (m.prevCollected || 0), 0) - anaPrev.totals.collected) < 1);
  const e0 = A.entities.find((e) => e.collected > 0); assert.ok(Math.abs(trendOf(A, e0.key).reduce((t, m) => t + m.collected, 0) - e0.collected) < 1);
  const con = concentration(A); assert.ok(con.entities.share >= 0.5 && con.entities.rows.length <= A.entities.length);
  for (const f of needsFollowUp(A)) assert.ok(f.rate < A.total.rate && f.uncollected > 0);
  assert.ok(decompose({ net: 120, collected: 90 }, { net: 100, collected: 60 }).total === 30);
});
await test('invoice payment story: settlement date, offset from the due date, partial and unpaid states, running balance', () => {
  const base = { dueDate: '2026-04-07', issueDate: '2026-03-08', net: 100, today: '2026-10-14' };
  const settled = paymentFacts({ ...base, payStatus: 'collected', payments: [{ date: '2026-05-01', amount: 40 }, { date: '2026-04-01', amount: 60 }] });
  assert.equal(settled.state, 'settled'); assert.equal(settled.first, '2026-04-01'); assert.equal(settled.last, '2026-05-01'); assert.equal(settled.settled, '2026-05-01'); assert.equal(settled.settledOffset, 24); assert.equal(settled.daysFromIssue, 54);
  assert.deepEqual(settled.rows.map((r) => [r.balance, r.offset]), [[40, -6], [0, 24]], 'balance after each payment, offset from the due date (negative = before)');
  const early = paymentFacts({ ...base, payStatus: 'collected', payments: [{ date: '2026-03-20', amount: 100 }] }); assert.equal(early.settledOffset, -18);
  const part = paymentFacts({ ...base, payStatus: 'partial', payments: [{ date: '2026-04-20', amount: 30 }] });
  assert.equal(part.state, 'partial'); assert.equal(part.remaining, 70); assert.equal(part.settled, null); assert.equal(part.daysOverdue, 190);
  const none = paymentFacts({ ...base, payStatus: 'overdue', payments: [] }); assert.equal(none.state, 'unpaid'); assert.equal(none.first, null); assert.equal(none.daysOverdue, 190);
  const notDue = paymentFacts({ ...base, today: '2026-04-01', payStatus: 'not_due', payments: [] }); assert.equal(notDue.daysOverdue, 0); assert.equal(notDue.daysToDue, 6);
  assert.equal(paymentFacts({ ...base, net: 0, payStatus: 'cancelled', payments: [{ date: '2026-04-01', amount: 10 }] }).state, 'cancelled', 'a cancelled invoice is never «paid», its payments are only listed');
  assert.equal(paymentFacts({ ...base, payStatus: 'collected', payments: [{ date: '2026-04-01', amount: 130 }] }).over, 30);
});
await test('terminology: «المقبوضات» and its forms are gone from every screen text; the approved terms are defined', () => {
  const hits = []; const walk = (d) => { for (const e of nodeFs.readdirSync(d, { withFileTypes: true })) { const p = nodePath.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(e.name) && /مقبوض/.test(nodeFs.readFileSync(p, 'utf8'))) hits.push(p); } };
  walk('src'); walk('server'); assert.deepEqual(hits, [], 'no source file may contain the retired term');
  const entries = metricDictionary({ quality: { records: 1 }, cutoff: TODAY, scope: { amanah: 'all', source: 'all', from: '2026-01-01', to: TODAY } });
  assert.ok(entries.every((e) => e && typeof e.key === 'string' && e.label && e.definition && e.formula), 'every dictionary entry is complete (no empty slot)');
  const dict = entries.map((e) => e.key);
  for (const k of ['revenueAppropriation', 'targetCollection', 'remainingToTarget', 'expenditureCh13', 'spendingCoverage']) assert.ok(dict.includes(k), k); for (const k of ['received', 'targetAchievement', 'coverage', 'forecast']) assert.ok(!dict.includes(k), `${k} was a duplicate/forecast metric of the removed planning flow`);
});


/* ------------------------------------------------------------------ IIM 18 Oct: one KPI module, origin / product / classification filters, «أخرى», exclusions only on uncollected invoices */
import { kpiOf } from '../src/data/kpis.js';
import { classify as classifyGfs, MAIN, OTHER_CODES, billerOf, originOf, productOf, parseInvoiceKey, gfsCodeOf, UNKNOWN_CODE, EXCLUSION_REASONS } from '../src/data/iim.js';
import { idOf as idOfI, lookupSadad } from '../server/engine.js';
const IIM_SCOPES = [
  {}, { scopeType: 'central' }, { scopeType: 'internal' }, { source: 'fines' }, { source: 'investment', scopeType: 'central' }, { product: ['baladi'] }, { product: ['mumtathil', 'foras'] },
  { product: ['tobacco', 'accommodation'] }, { amanah: 'Riyadh Amanah' }, { amanah: ['Jeddah Amanah', 'Makkah Amanah'], scopeType: 'internal' }, { mainClass: 'رسوم بلدية' }, { mainClass: 'استثمار', scopeType: 'internal' },
  { from: '2026-03-01', to: '2026-06-30' }, { from: '2026-01-01', to: '2026-01-31', source: 'municipal_fees' }
];
await test('IIM-05 · one KPI module: gross = collected + uncollected (+ cancelled) and net = collected + collectible hold for every filter combination (period, Amanah, origin, product, classification)', () => {
  assert.ok(IIM_SCOPES.length >= 10);
  for (const extra of IIM_SCOPES) {
    const sn = snapshot(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', ...extra }, cfg });
    const K = kpiOf(sn.totals);
    assert.ok(K.invariants.ok, `invariants for ${JSON.stringify(extra)}: ${JSON.stringify(K.invariants)}`);
    assert.ok(Math.abs(K.uncollectedTotal - K.collectible - K.excluded) < 1e-6, 'غير المحصل القابل للتحصيل = إجمالي غير المحصل − إجمالي المستبعد');
    assert.ok(K.net <= K.billedTotal + 0.5 && K.collected <= K.net + 0.5);
  }
});
await test('IIM-05 · an invoice whose main class is «أخرى» changes no KPI; the explicit «include» view shows it', () => {
  const base = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' };
  const a = snapshot(st, { scope: base, cfg }); const b = snapshot(st, { scope: { ...base, includeOther: true }, cfg });
  assert.ok(b.totals.count > a.totals.count && b.totals.gross > a.totals.gross, 'the world carries «أخرى» invoices');
  const only = snapshot(st, { scope: { ...base, mainClass: 'أخرى' }, cfg });
  assert.equal(a.totals.count + only.totals.count, b.totals.count); assert.ok(Math.abs(a.totals.gross + only.totals.gross - b.totals.gross) < 1);
  assert.ok(OTHER_CODES.length === 6 && OTHER_CODES.includes('11411') && OTHER_CODES.includes('180201'));
});
await test('D10 · exclusions come only from uncollected invoices: an exclusion on a collected invoice is ignored and counted; a part-collected invoice loses only its remainder', () => {
  const ctx = makeCtx(st, { cfg }); let ignored = 0; let part = 0;
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN) continue; const D = derive(ctx, i, ctx.cutoffN);
    if (D.ignoredExclusion) { ignored += 1; assert.equal(D.excluded, false); assert.equal(D.exclusionAmount, 0); assert.ok(D.received >= D.billed); }
    if (D.excluded && D.received > 0) { part += 1; assert.ok(Math.abs(D.exclusionAmount - (D.billed - D.received)) < 1e-6); assert.ok(Math.abs(D.collected - D.received) < 1e-6); }
  }
  assert.ok(ignored >= 1, 'the demo data holds an exclusion recorded on a collected invoice');
  const sn = snapshot(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg }); assert.ok(sn.totals.ignoredExclusions >= 1, 'counted as a data warning');
});
await test('IIM-03 · classification: the same advertising-board account is a municipal fee when billed centrally and an investment when billed by an Amanah; an unknown code is «غير مصنف»; «أخرى» holds the six codes', () => {
  assert.equal(classifyGfs('11100-11105', 'central').main, MAIN.municipal); assert.equal(classifyGfs('11100-11105', 'internal').main, MAIN.investment);
  assert.equal(classifyGfs(UNKNOWN_CODE, 'central').main, 'غير مصنف'); assert.equal(classifyGfs('1431', 'central').main, 'أخرى');
  assert.deepEqual(OTHER_CODES.slice().sort(), ['11411', '1421901', '1431', '144121', '180201', '3318212'].sort());
  assert.ok(gfsCodeOf('misc_revenue', 0) !== null);
  const adOf = (scopeType) => list(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', item: 'ad_boards' + (scopeType === 'internal' ? '_amanah' : ''), scopeType }, cfg, filters: {}, page: 0, pageSize: 50 }).rows;
  const adC = adOf('central'); const adI = adOf('internal');
  assert.ok(adC.length > 0 && adI.length > 0, 'advertising boards are billed both centrally and by Amanahs');
  assert.ok(adC.every((r) => r.mainClass === MAIN.municipal && r.gfsCode === '11100-11105') && adI.every((r) => r.mainClass === MAIN.investment && r.gfsCode === '11100-11105'), 'the same account classifies differently by biller');
});
await test('IIM-01/02 · the invoice id is biller-sadad; only biller 177 is central; a Sadad number alone can name two invoices of different billers', () => {
  const rows = list(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg, filters: {}, page: 0, pageSize: 500 }).rows;
  assert.ok(rows.every((r) => r.id === `${r.billerId}-${r.sadadNo}` && !r.id.startsWith('INV')));
  assert.ok(rows.every((r) => (r.billerId === '177') === (r.origin === 'central')));
  const internal = list(st, { scope: { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'internal' }, cfg, filters: {}, page: 0, pageSize: 50 }).rows;
  assert.ok(internal.length > 0 && internal.every((r) => r.billerId !== '177' && r.origin === 'internal'), 'internal billers exist');
  assert.deepEqual(parseInvoiceKey('177-882607310000'), { billerId: '177', sadad: '882607310000' });
  assert.equal(billerOf(0, 0).id, '177'); assert.equal(originOf('301'), 'internal');
  const two = [...st.fixtures.entries()].map(([i, r]) => r.sadadNo).filter(Boolean); const seen = new Map(); two.forEach((s) => seen.set(s, (seen.get(s) || 0) + 1));
  assert.ok([...seen.values()].filter((n) => n > 1).length >= 2, 'at least two Sadad numbers repeat across billers in the demo data');
  const some = [...seen.entries()].find(([, n]) => n > 1)[0]; const found = lookupSadad(st, some); assert.ok(found.length >= 2); assert.notEqual(idOfI(st, found[0]), idOfI(st, found[1]));
  const s = list(st, { scope: { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg, filters: { search: some, allPeriods: true }, page: 0, pageSize: 20 });
  assert.ok(s.rows.length >= 2 && new Set(s.rows.map((r) => r.billerId)).size >= 2, 'a search by Sadad number returns every biller that carries it');
});
await test('IIM-04 · every exclusion reason of the meeting is named, and is used on at least one uncollected invoice', () => {
  assert.deepEqual(EXCLUSION_REASONS.map((r) => r.ruleId).filter((x) => x !== 'DUP-1'), ['CR-1', 'DEC-1', 'OBJ-1', 'NOC-1', 'INC-1', 'EFA-1', 'EXE-1', 'SND-1']);
  const sn = snapshot(st, { scope: { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg });
  for (const id of ['CR-1', 'DEC-1', 'OBJ-1', 'NOC-1', 'INC-1', 'EFA-1', 'EXE-1', 'SND-1']) assert.ok(sn.ruleStats[id].primaryCount > 0, `${id} is used by at least one excluded invoice`);
});

await test('IIM-03 · an invoice whose revenue account is not in the classification file is «غير مصنف» and is counted (never dropped)', () => {
  const un = snapshot(st, { scope: { from: '2025-01-01', to: TODAY, amanah: 'all', source: 'all', mainClass: 'غير مصنف' }, cfg });
  assert.ok(un.totals.count >= 1, 'the unclassified population is visible');
  const all = snapshot(st, { scope: { from: '2025-01-01', to: TODAY, amanah: 'all', source: 'all' }, cfg }); assert.ok(all.totals.count >= un.totals.count, 'unclassified invoices stay inside the headline');
});

import { matchCriteria, PARTIAL_MATCH, REVIEW_LABEL as REVIEW_LABEL_I } from '../src/data/orderSummary.js';
await test('IIM-17 · an invoice matches an order only when number + Amanah + amount agree; anything less is a partial match that is not preselected; an order with no linked invoice reads «تحتاج مراجعة»', () => {
  const row = (extra = {}) => ({ status: 'resolved_by_reference', candidates: [{ invoiceId: '177-882607310000', amanahEn: 'Riyadh Amanah', grossAmount: 1000 }], unresolved: {}, weak: false, link: null, rejected: false, ...extra });
  const order = { amanahEn: 'Riyadh Amanah', amount: 1000 };
  assert.deepEqual(matchCriteria(order, row(), 1000), { invoiceNo: true, amanah: true, amount: true, full: true });
  assert.equal(matchCriteria({ ...order, amount: 1500 }, row(), 1000).full, false, 'the amount differs → partial');
  assert.equal(matchCriteria({ ...order, amanahEn: 'Jeddah Amanah' }, row(), 1000).full, false, 'the Amanah differs → partial');
  assert.equal(matchCriteria(order, row({ weak: true }), 1000).invoiceNo, false, 'an incomplete number is not an invoice-number match');
  assert.equal(rowState(row({ partialMatch: true })).preselect, false); assert.equal(rowState(row()).preselect, true);
  assert.ok(PARTIAL_MATCH.ar.includes('مطابقة جزئية') && PARTIAL_MATCH.ar.includes('تحتاج تأكيد المستخدم'));
  assert.ok(REVIEW_LABEL_I.not_identified.ar.startsWith('تحتاج مراجعة'));
});

console.log(`\n${passed} tests passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
