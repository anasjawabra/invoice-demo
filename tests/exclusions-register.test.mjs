// Exclusions register — isolated test data: identity resolution of upload rows, repeated uploads, a partly paid invoice that is excluded, payment status kept apart from exclusion, export.
import assert from 'node:assert/strict';
import { loadStore } from '../server/store.js';
import { snapshot, derive, makeCtx, idOf } from '../server/engine.js';
import { list, exportChunks } from '../server/lists.js';
import { pickUploadInvoice, checkExclusionRows } from '../server/exclusionUpload.js';
import { iimFields } from '../server/iimRow.js';
import { isoOf, ENTITIES } from '../src/data/catalog.js';
import nodeFs from 'node:fs';
import { kpiOf } from '../src/data/kpis.js';
import { EXCLUSION_REASONS } from '../src/data/iim.js';
import { exclusionsReasonChart, reasonOrder } from '../src/data/exclusionsChart.js';

process.env.DEMO_SIZE = 'compact';
let passed = 0; const test = (name, fn) => { try { fn(); passed += 1; console.log(`  ok  ${name}`); } catch (e) { process.exitCode = 1; console.error(`  FAIL  ${name}\n${e.stack}`); } };
const TODAY = '2026-11-05'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const SC = { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all' };
const ctx0 = makeCtx(st, { cfg });

test('identity: rows that share a number inside one Amanah are told apart by the GFS code; when they are not, the row is ambiguous with every candidate — never the first one', () => {
  const gfs = { 10: '111', 11: '222', 12: '222' }; const gfsOf = (x) => gfs[x]; const keyOf = (x) => `key-${x}`;
  assert.deepEqual(pickUploadInvoice([10], '', gfsOf, keyOf), { index: 10 }, 'one invoice carries the number');
  assert.deepEqual(pickUploadInvoice([10, 11], '222', gfsOf, keyOf), { index: 11 }, 'the account picks the right one');
  const none = pickUploadInvoice([10, 11], '', gfsOf, keyOf); assert.equal(none.code, 'invoice_ambiguous'); assert.deepEqual(none.candidates, ['key-10', 'key-11']);
  const both = pickUploadInvoice([11, 12], '222', gfsOf, keyOf); assert.equal(both.code, 'invoice_ambiguous'); assert.deepEqual(both.candidates, ['key-11', 'key-12'], 'the account alone does not decide when several still match');
  assert.equal(pickUploadInvoice([10, 11], '999', gfsOf, keyOf).code, 'account_mismatch');
  for (const r of [pickUploadInvoice([10, 11], '', gfsOf, keyOf), pickUploadInvoice([11, 12], '222', gfsOf, keyOf)]) assert.equal(r.index, undefined, 'no invoice is chosen');
});

// a partly paid invoice (isolated test data: taken from the synthetic population, excluded through an uploaded-file overlay)
let partial = -1; for (let i = 0; i < st.nGen && partial < 0; i += 1) { if (st.issue[i] > ctx0.cutoffN || st.cancelDay[i] || st.exMask[i]) continue; const D = derive(ctx0, i, ctx0.cutoffN); if (D.received > 0 && D.outstanding > 0 && !D.excluded && !D.cancelled && st.ent[i] < 17) partial = i; }
assert.ok(partial >= 0, 'the synthetic data has a partly paid, uncollected invoice');
const fe = { [idOf(st, partial)]: { ruleId: 'ATT-1', file: 'isolated-test.xlsx', at: '2026-11-05T09:00:00Z', by: 'tester' } };

test('a partly paid invoice that is excluded: the paid part stays collected, only the unpaid remainder is excluded, the payment status stays «partly paid», nothing is counted twice', () => {
  const D = derive(makeCtx(st, { cfg, fileExclusions: fe }), partial, ctx0.cutoffN); const D0 = derive(ctx0, partial, ctx0.cutoffN);
  assert.equal(D.excluded, true); assert.equal(D.payStatus, 'partial', 'exclusion is not a payment status'); assert.equal(D0.payStatus, 'partial');
  assert.ok(Math.abs(D.exclusionAmount - (D.billed - D.received)) < 0.01, 'excluded amount = the unpaid remainder'); assert.ok(Math.abs(D.collected - D0.collected) < 0.01 && D.collected > 0, 'collected is unchanged and distinct');
  assert.ok(Math.abs(D.collected + D.exclusionAmount - D.billed) < 0.01 && D.outstanding === 0, 'original = collected + excluded; nothing left uncollected');
  const base = list(st, { scope: SC, cfg, filters: { primary: 'ATT-1' }, page: 0, pageSize: 500 }); const rows = list(st, { scope: SC, cfg, fileExclusions: fe, filters: { primary: 'ATT-1' }, page: 0, pageSize: 500 });
  assert.equal(rows.total, base.total + 1, 'the uploaded invoice joins the list (a cached page without the file must never be served)'); const r = rows.rows.find((x) => x.id === idOf(st, partial));
  assert.equal(r.payStatus, 'partial'); assert.ok(r.gross > r.exclusionAmount, 'the original amount is not shown as entirely excluded'); assert.equal(r.exclusionReason.ruleId, 'ATT-1');
  const s0 = snapshot(st, { scope: SC, cfg }); const s1 = snapshot(st, { scope: SC, cfg, fileExclusions: fe });
  assert.ok(s1.equation.ok && s0.equation.ok, 'the financial identities hold'); assert.ok(Math.abs(s1.totals.collected - s0.totals.collected) < 0.01, 'collected is not changed by the exclusion');
  assert.ok(Math.abs((s1.totals.exclusions - s0.totals.exclusions) - D.exclusionAmount) < 0.01 && s1.totals.excludedCount === s0.totals.excludedCount + 1, 'the total excluded grows by exactly the remainder, once');
});
test('payment status is a separate filter: the partly paid excluded invoice is found by «partly paid», not by «excluded»', () => {
  const f = (payStatus) => list(st, { scope: SC, cfg, fileExclusions: fe, filters: { primary: 'any', payStatus }, page: 0, pageSize: 500 });
  assert.ok(f('partial').rows.some((r) => r.id === idOf(st, partial))); assert.equal(f('excluded').total, 0, '«excluded» is not a payment status');
  const all = f('all'); assert.equal(all.rows.filter((r) => r.payStatus === 'partial').length, f('partial').total);
  assert.equal(all.total, f('overdue').total + f('partial').total + f('not_due').total + f('collected').total + f('cancelled').total, 'the payment statuses partition the excluded invoices');
});
test('repeated uploads: applying the same file again changes nothing (an invoice is excluded once)', () => {
  const twice = { ...fe, ...fe }; const a = snapshot(st, { scope: SC, cfg, fileExclusions: fe }).totals; const b = snapshot(st, { scope: SC, cfg, fileExclusions: twice }).totals;
  assert.deepEqual([a.exclusions, a.excludedCount, a.net], [b.exclusions, b.excludedCount, b.net]);
  const ctx = makeCtx(st, { cfg, fileExclusions: fe }); const D = derive(ctx, partial, ctx.cutoffN); const D2 = derive(ctx, partial, ctx.cutoffN); assert.equal(D.exclusionAmount, D2.exclusionAmount);
});
test('upload rows: invalid or missing fields and repeated rows are rejected with their own explanation; one Amanah resolves its own invoice only', () => {
  const im = iimFields(st, partial); const row = (extra = {}) => ({ row: 2, invoiceNo: idOf(st, partial), date: isoOf(st.issue[partial]), amount: st.gross[partial], amanah: ENTITIES[st.ent[partial]].ar, name: 'x', account: im.gfsCode, reason: 'إفادات الأمانات', ...extra });
  const code = (r) => checkExclusionRows(st, { rows: [r], cfg }).rows[0].code;
  assert.equal(code(row()), null, 'a valid row is accepted'); assert.equal(code(row({ invoiceNo: '' })), 'invoice_no_missing'); assert.equal(code(row({ amanah: '' })), 'amanah_missing'); assert.equal(code(row({ reason: 'x' })), 'reason_invalid');
  assert.equal(code(row({ amount: 1 })), 'amount_mismatch'); assert.equal(code(row({ date: '2020-01-01' })), 'date_mismatch'); assert.equal(code(row({ account: '0' })), 'account_mismatch');
  assert.equal(code(row({ amanah: ENTITIES[(st.ent[partial] + 1) % 17].ar })), 'other_amanah', 'another Amanah never picks this invoice');
  const dup = checkExclusionRows(st, { rows: [row(), row({ row: 3 })], cfg }); assert.equal(dup.accepted, 1); assert.equal(dup.rows[1].code, 'duplicate_in_file');
  const ok = checkExclusionRows(st, { rows: [row()], cfg }).rows[0]; assert.ok(ok.compositeKey && ok.compositeKey.startsWith('ick1|'), 'the match carries the verified composite identity');
});
test('export: the CSV carries payment status separately from the exclusion (reason, excluded amount), and the rows reconcile with the list', () => {
  const body = { scope: SC, cfg, fileExclusions: fe, filters: { primary: 'any' } }; let text = ''; for (const c of exportChunks(st, body)) text += c;
  const lines = text.replace(/^﻿/, '').split('\n').filter(Boolean); const head = lines[1].split(','); const iPay = head.indexOf('payment_status'); const iEx = head.indexOf('excluded_sar'); const iCls = head.indexOf('collection_class'); assert.ok(iPay > 0 && iEx > 0 && iCls > 0 && !head.includes('state'));
  const rows = lines.slice(2); const l = list(st, { scope: SC, cfg, fileExclusions: fe, filters: { primary: 'any' }, page: 0, pageSize: 500 });
  assert.equal(rows.length, l.total); assert.ok(Math.abs(rows.reduce((t, r) => t + Number(r.split(',')[iEx] || 0), 0) - l.sums.exclusionAmount) < 1);
  assert.ok(rows.every((r) => !['excluded'].includes(r.split(',')[iPay])), 'no row carries «excluded» as its payment status'); assert.ok(rows.every((r) => r.split(',')[iCls] === 'excluded'), 'the collection class is its own column');
});
test('multiple applicable reasons: one row, one deduction (the amount is excluded once)', () => {
  const l = list(st, { scope: SC, cfg, filters: { primary: 'any' }, page: 0, pageSize: 500 }); const multi = l.rows.filter((r) => r.exclusionReasons.length > 1);
  for (const r of multi) assert.ok(Math.abs(r.exclusionAmount - (r.gross - r.received)) < 0.01, 'excluded once: the unpaid remainder, whatever the number of reasons');
  assert.ok(Math.abs(l.sums.exclusionAmount - l.rows.reduce((t, r) => t + r.exclusionAmount, 0)) < 1);
});

/* ---- /exclusions refinement: one reasons table, chart and KPIs on the SAME figures ---- */
const SCN = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', product: [], mainClass: 'all' };
const reasonRows = (stats) => EXCLUSION_REASONS.map((r) => ({ ...r, count: stats[r.ruleId]?.primaryCount || 0, amount: stats[r.ruleId]?.primaryAmount || 0 }));
for (const [name, scope] of [['national', SCN], ['Jeddah', { ...SCN, amanah: 'Jeddah Amanah' }]]) {
  test(`${name}: KPI = table total = chart total = list total = CSV export; every excluded invoice is counted once under its effective reason`, () => {
    const snap = snapshot(st, { scope, cfg }); const K = kpiOf(snap.totals); const stats = snap.ruleStats || {}; const rows = reasonRows(stats);
    const sumAmt = rows.reduce((t, r) => t + r.amount, 0); const sumN = rows.reduce((t, r) => t + r.count, 0);
    assert.ok(Math.abs(sumAmt - K.excluded) <= 1 && sumN === K.excludedCount, 'the reasons add up to the KPI (amount and count)');
    const chart = exclusionsReasonChart(rows, 'en'); const chartTotal = chart ? chart.series[0].values.reduce((t, v) => t + v, 0) : 0; assert.ok(Math.abs(chartTotal - K.excluded) <= 1, 'the chart bars add up to the KPI');
    const tableOrder = rows.filter((r) => r.count > 0).sort(reasonOrder).map((r) => r.ruleId); const chartOrder = chart ? chart.keys : [];
    assert.deepEqual(tableOrder.filter((k) => chartOrder.includes(k)), chartOrder, 'the chart lists the reasons in the SAME descending order as the table');
    assert.deepEqual(tableOrder, chartOrder, 'the same reasons (every reason with invoices has a bar and a row)');
    const all = list(st, { scope, cfg, filters: { primary: 'any' }, page: 0, pageSize: 1 }); assert.equal(all.total, K.excludedCount); assert.ok(Math.abs(all.sums.exclusionAmount - K.excluded) <= 1, 'the list total (every excluded invoice) = the KPI');
    let seen = 0;
    for (const r of rows.filter((x) => x.count > 0)) {
      const l = list(st, { scope, cfg, filters: { primary: r.ruleId }, page: 0, pageSize: 1 });
      assert.equal(l.total, r.count, `${r.ruleId}: the drill-through (bar or table action) lists exactly the counted invoices`); assert.ok(Math.abs(l.sums.exclusionAmount - r.amount) <= 1, `${r.ruleId}: and their excluded amount`); seen += l.total;
      const csv = [...exportChunks(st, { scope, cfg, filters: { primary: r.ruleId } })].join(''); const lines = csv.split('\n').filter((x) => x.trim()); assert.ok(lines.length - 1 >= r.count, `${r.ruleId}: the CSV export holds every invoice of the reason (header + rows)`);
    }
    assert.equal(seen, K.excludedCount, 'each excluded invoice appears under exactly ONE reason (no overlap, none missing)');
  });
}
test('KPI share: excluded ÷ uncollected BEFORE exclusions × 100, from the unrounded amounts; the denominator is net uncollected + excluded (not net uncollected alone)', () => {
  const K = kpiOf(snapshot(st, { scope: SCN, cfg }).totals);
  assert.ok(Math.abs(K.uncollectedTotal - (K.collectible + K.excluded)) < 1e-6, 'uncollected before exclusions = net uncollected after exclusions + excluded');
  const share = K.excluded / K.uncollectedTotal; assert.ok(share > 0 && share < 1); assert.notEqual(K.excluded / K.collectible, share, 'not the same as excluded ÷ net uncollected');
  const rounded = Math.round(K.excluded / 1e4) / 1e2; const sharedFromRounded = rounded / (Math.round(K.uncollectedTotal / 1e4) / 1e2); assert.ok(Math.abs(share - sharedFromRounded) < 0.01, 'rounding would only move the third decimal — the page still uses the exact amounts');
});
test('page source: one reasons table (all reasons with invoices, no top-five / show-all toggle), no second table under the chart, neutral chart colours, three KPI cards with the unit apart', () => {
  const page = nodeFs.readFileSync('src/pages/Exclusions.jsx', 'utf8'); const chart = nodeFs.readFileSync('src/data/exclusionsChart.js', 'utf8'); const strip = nodeFs.readFileSync('src/components/invoices/KpiStrip.jsx', 'utf8');
  assert.ok(!/TOP_N|showAll|setShowAll|عرض جميع الأسباب|Show all reasons|ex-toggle/.test(page), 'the top-five limit and the show-all link are gone');
  assert.ok(/PageChart[^>]*table=\{false\}/.test(page), 'no additional data table under the chart: the reasons table is its accessible alternative');
  assert.ok(!/role:\s*'exclusions'/.test(chart), 'the bars are not all red (the shared palette)');
  assert.ok(!/ex-summary/.test(page) && /<KpiStrip/.test(page) && /kpiItems/.test(page));
  for (const t of ['إجمالي المبلغ المستبعد', 'عدد الفواتير المستبعدة', 'نسبة المستبعد من إجمالي غير المحصّل قبل الاستبعاد', 'فاتورة']) assert.ok(page.includes(t), t);
  assert.ok(/k\.unit/.test(strip) && /il-kpi__unit/.test(strip), 'the unit is a separate element beside the value');
  const keys = [...page.matchAll(/\{ key: '(amt|n|share)'/g)].map((m) => m[1]); assert.deepEqual(keys, ['amt', 'n', 'share'], 'exactly three KPI cards');
});
console.log(`\n${passed} exclusions-register tests passed${process.exitCode ? ' — WITH FAILURES' : ''}`);
