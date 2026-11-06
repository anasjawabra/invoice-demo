// The enforcement exclusion workflow: a reviewer-CONFIRMED link between a Sanad enforcement order and an invoice excludes the invoice (reason «مرتبطة بأمر تنفيذ مؤكد», rule SND-1);
// extraction and a proposed link never do. Amount basis = the uncollected remainder (billed − received), each invoice counted once, payments and the source status untouched,
// Net invoiced = Gross invoiced − Exclusions. Run with `npm run test:exclusion`. Real compact demo ledger; the invoices are the synthetic demo invoices, no external data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStore } from '../server/store.js';
import { snapshot, makeCtx, lookupId, derive, resolveScope, inScope } from '../server/engine.js';
import { detail } from '../server/materialize.js';
import { list, exportChunks, EXPORT_COLUMNS } from '../server/lists.js';
import { normalizeConfig } from '../src/data/revenueMetrics.js';
import { EXCLUSION_REASONS } from '../src/data/iim.js';
import { buildIndex, invoiceStatusMap, linkInfoMap } from '../src/data/relations.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { console.error(`FAIL  ${name}`); throw e; } n += 1; };
const TODAY = '2026-10-20'; const st = loadStore(TODAY); const cfg = normalizeConfig({ cutoff: TODAY }); const sc = { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all' };
const A = '171-407930123150'; const B = '171-407950123141'; const C = '171-408030123105'; const F = '171-407890123168'; // F is PARTLY paid
const H = '177-407980123168'; // cancelled in the source, no order of the feed
const snap = (links = {}, linkInfo = {}) => snapshot(st, { scope: sc, cfg, links, linkInfo });
const det = (id, links = {}, linkInfo = {}) => detail(st, lookupId(st, id), makeCtx(st, { cfg, links, linkInfo }));
const REASON_SND = EXCLUSION_REASONS.find((r) => r.ruleId === 'SND-1');
const base = snap();

ok('the reason is «مرتبطة بأمر تنفيذ مؤكد» (rule SND-1); the Sanad link rule is applied by CONFIRMATION only', () => {
  assert.equal(REASON_SND.ar, 'مرتبطة بأمر تنفيذ مؤكد'); assert.equal(REASON_SND.en, 'Linked to a confirmed enforcement order');
  assert.equal(det(A).derived.excluded, false); for (const s of ['open', 'suspended', 'closed', 'confirmed']) assert.equal(det(A, { [A]: s }).derived.excluded, true, s);
});
ok('a PROPOSED link, a withdrawn link and no link change nothing: not one exclusion, total or status moves', () => {
  for (const links of [{ [A]: 'candidate' }, { [A]: 'withdrawn' }, {}]) {
    const s = snap(links); assert.equal(s.totals.exclusions, base.totals.exclusions); assert.equal(s.totals.excludedCount, base.totals.excludedCount); assert.equal(s.totals.net, base.totals.net); assert.equal(s.totals.outstanding, base.totals.outstanding);
    const d = det(A, links).derived; assert.equal(d.excluded, false); assert.equal(d.outstanding, 9478590);
  }
});
ok('confirmation excludes the invoice: Net invoiced = Gross invoiced − Exclusions, gross unchanged, the identities hold, the invoice counted once', () => {
  const s = snap({ [A]: 'open', [B]: 'open', [C]: 'open' });
  assert.equal(s.totals.gross, base.totals.gross, 'gross invoiced is untouched'); assert.equal(s.totals.exclusions - base.totals.exclusions, 9478590 + 9524400 + 45152220); assert.equal(s.totals.excludedCount - base.totals.excludedCount, 3);
  assert.equal(s.totals.net, s.totals.gross - s.totals.exclusions, 'Net invoiced = Gross invoiced − Exclusions'); assert.ok(s.equation.ok); assert.equal(s.totals.outstanding, base.totals.outstanding - (9478590 + 9524400 + 45152220));
});
ok('amount basis is explicit and consistent: the UNCOLLECTED REMAINDER (billed − received); the partly paid part stays collected and the payment record is untouched', () => {
  const b = det(F).derived; const d = det(F, { [F]: 'open' }).derived;
  assert.ok(b.received > 0 && b.outstanding > 0 && b.received < b.gross); assert.equal(d.received, b.received, 'the payment record is preserved'); assert.equal(d.collected, b.collected);
  assert.equal(d.exclusionAmount, b.gross - b.received, 'only the uncollected remainder is excluded'); assert.equal(d.outstanding, 0); assert.notEqual(d.exclusionAmount, b.gross, 'not the full invoice value');
  assert.equal(det(F, { [F]: 'open' }).rec.exclusions.find((e) => e.ruleId === 'SND-1').amountBasis, 'uncollected_remainder');
  const s = snap({ [F]: 'open' }); assert.equal(s.totals.exclusions - base.totals.exclusions, b.gross - b.received); assert.equal(s.totals.collected, base.totals.collected, 'collections are unchanged'); assert.ok(s.equation.ok);
});
ok('enforcement is not payment and not cancellation: closing, suspending or opening an order moves no payment status, no collected amount and no source status', () => {
  const b = det(A).derived;
  for (const s of ['open', 'suspended', 'closed']) { const d = det(A, { [A]: s }).derived; assert.equal(d.received, b.received); assert.equal(d.collected, b.collected); assert.equal(d.sourceCancelled, b.sourceCancelled); assert.equal(d.cancelled, false); assert.notEqual(d.payStatus, 'collected'); }
});
ok('a closed order does not remove the exclusion by itself; revoking the link reassesses the reason', () => {
  assert.equal(det(A, { [A]: 'closed' }).derived.excluded, true, 'closure alone keeps the exclusion'); assert.equal(det(A, { [A]: 'withdrawn' }).derived.excluded, false, 'revoked link and no other reason → no exclusion');
});
ok('each invoice and its excluded value are counted ONCE however many orders link it (and the evidence lists every order)', () => {
  const mk = (num, status, doc) => ({ enforceNum: num, system: 'sanad', requestStatus: status, amount: 1, links: [{ invoiceId: A, status: 'confirmed', origin: 'manual_selection', reviewedBy: 'R', reviewedAt: '2026-11-05T10:00:00Z', evidence: [{ docName: doc }] }] });
  const cases = [mk('SND-1', 'قيد التنفيذ', 'a.pdf'), mk('SND-2', 'مغلق', 'b.pdf')]; const map = invoiceStatusMap(cases); const info = linkInfoMap(cases);
  assert.deepEqual(Object.keys(map), [A]); assert.equal(map[A], 'open'); assert.equal(info[A].length, 2); assert.equal(buildIndex(cases).get(A).confirmed.length, 2);
  const one = snap({ [A]: 'open' }); const two = snap(map, info); assert.equal(two.totals.exclusions, one.totals.exclusions); assert.equal(two.totals.excludedCount, one.totals.excludedCount);
  const ev = det(A, map, info).rec.exclusions.find((e) => e.ruleId === 'SND-1'); assert.deepEqual(ev.orders.sort(), ['SND-1', 'SND-2']); assert.ok(ev.sources.some((s) => s.value.includes('a.pdf') && s.value.includes('b.pdf')));
});
ok('an invoice already excluded for ANOTHER reason is not counted twice; every reason is kept with its evidence', () => {
  const ctx0 = makeCtx(st, { cfg, links: {} }); let pick = -1; for (let i = 0; i < st.nGen; i += 1) { if (st.exec[i] >= 0) continue; const D = derive(ctx0, i, ctx0.cutoffN); if (D.excluded && !D.cancelled && D.nReasons >= 1 && !(D.mask & (1 << 9))) { pick = i; break; } }
  assert.ok(pick >= 0, 'the demo ledger has invoices excluded for another reason'); const id = (await0(pick));
  const b = detail(st, pick, ctx0); const w = detail(st, pick, makeCtx(st, { cfg, links: { [id]: 'open' }, linkInfo: {} }));
  assert.equal(w.derived.exclusionAmount, b.derived.exclusionAmount, 'the excluded value is counted once'); assert.equal(w.derived.net, b.derived.net); assert.ok(w.derived.nReasons >= b.derived.nReasons + 1, 'the new reason is added, not substituted');
  assert.ok(w.rec.exclusions.some((e) => e.ruleId === 'SND-1') && b.rec.exclusions.length >= 1 && w.rec.exclusions.length >= b.rec.exclusions.length, 'the earlier reasons and their evidence are preserved');
  assert.equal(snap({ [id]: 'open' }).totals.exclusions, base.totals.exclusions, 'totals do not move');
  const rv = detail(st, pick, makeCtx(st, { cfg, links: { [id]: 'withdrawn' } })); assert.equal(rv.derived.excluded, true, 'another valid reason remains → still excluded after the link is revoked');
});
function await0(i) { return detail(st, i, makeCtx(st, { cfg, links: {} })).idStr; }
ok('the exclusion carries its evidence: order, status, reviewer, time and the supporting document', () => {
  const info = { [A]: [{ enforceNum: 'SND-9100001', orderStatus: 'open', reviewedBy: 'Reviewer A', reviewedAt: '2026-11-05T10:15:00Z', documents: ['sanad-9100001.pdf'] }] };
  const e = det(A, { [A]: 'open' }, info).rec.exclusions.find((x) => x.ruleId === 'SND-1'); assert.equal(e.evidence.ar, 'مرتبطة بأمر تنفيذ مؤكد.'); assert.deepEqual(e.orders, ['SND-9100001']); assert.equal(e.reviewer.en, 'Reviewer A'); assert.equal(e.reviewDate, '2026-11-05');
  const text = e.sources.map((s) => s.value).join(' | '); assert.ok(text.includes('SND-9100001') && text.includes('Reviewer A') && text.includes('2026-11-05 10:15') && text.includes('sanad-9100001.pdf'));
});
ok('the exclusion shows in the invoice list (still listed, with its exclusion amount) and the reason breakdown; dashboards and lists agree', () => {
  const links = { [A]: 'open', [B]: 'open' }; const s = snap(links); const stats = s.ruleStats['SND-1']; const b = base.ruleStats['SND-1'] || { primaryCount: 0, primaryAmount: 0 };
  assert.equal(stats.primaryCount - b.primaryCount, 2); assert.equal(stats.primaryAmount - b.primaryAmount, 9478590 + 9524400);
  const rows = list(st, { scope: sc, cfg, filters: { search: A, allPeriods: true }, links, page: 0, pageSize: 5 }).rows; const r = rows.find((x) => x.id === A); assert.ok(r, 'the excluded invoice stays visible in the list'); assert.equal(r.exclusionAmount, 9478590); assert.ok(r.enforcement >= 2, 'with its enforcement status');
});
ok('a source-CANCELLED invoice with a confirmed order is flagged «تعارض بين المصدر والتنفيذ — يحتاج مراجعة»; no amount, payment record or source status changes by the flag', () => {
  const b = det(H).derived; assert.equal(b.sourceCancelled, true); assert.equal(b.enfConflict, false, 'no order → no conflict');
  const d = det(H, { [H]: 'open' }).derived; assert.equal(d.sourceCancelled, true, 'the source status is kept'); assert.equal(d.enfConflict, true); assert.equal(d.received, b.received); assert.ok(snap({ [H]: 'open' }).equation.ok);
  assert.equal(det(H, { [H]: 'candidate' }).derived.enfConflict, false, 'a proposal raises no conflict'); assert.equal(det(H, { [H]: 'closed' }).derived.enfConflict, true, 'closing does not clear it');
  const rows = list(st, { scope: sc, cfg, filters: { exec: 'conflict', allPeriods: true }, links: { [H]: 'open' }, page: 0, pageSize: 50 }).rows; assert.ok(rows.some((x) => x.id === H), 'listed for review');
});
ok('the rule applies to confirmed SANAD links only: an Eefaa invoice link (a reviewer decision kept apart from the order store) never reaches the data service', () => {
  const ctxSrc = fs.readFileSync('src/context/RevenueContext.jsx', 'utf8'); assert.ok(!/eefaa|invoice_link|SourceRecords\(\)\.reviews|\.reviews/.test(ctxSrc.replace(/useSourceRecords\(\); \/\/[^\n]*/, '')), 'the revenue context reads no Eefaa review');
  assert.deepEqual(invoiceStatusMap([{ enforceNum: 'X', requestStatus: 'قيد التنفيذ', links: [] }]), {}, 'links come from Sanad orders only');
});

ok('AMOUNT BASIS consistency (an implementation assumption, not a confirmed business decision): for EVERY invoice the excluded value is the uncollected remainder, partial payments stay collected, and the sums equal the dashboard totals', () => {
  const links = { [A]: 'open', [B]: 'closed', [F]: 'suspended', [H]: 'open' }; const ctx = makeCtx(st, { cfg, links, linkInfo: {} }); const s = snap(links); const rs = resolveScope(ctx, sc);
  let sumExcl = 0; let sumExclusionAmount = 0; let sumCancelled = 0; let partly = 0; let excludedN = 0; let gross = 0; let net = 0; let collected = 0; let outstanding = 0;
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, rs, i)) continue; const D = derive(ctx, i, ctx.cutoffN); gross += D.billed; net += D.net; collected += D.collected; outstanding += D.outstanding; sumExcl += D.exclTotal; sumExclusionAmount += D.exclusionAmount; sumCancelled += D.cancelledAmount;
    if (D.excluded) { excludedN += 1; assert.equal(D.exclusionAmount, Math.max(0, D.billed - D.received), 'excluded value = billed − received'); assert.equal(D.outstanding, 0); assert.equal(D.collected, D.received, 'what was collected stays collected'); if (D.received > 0 && D.received < D.billed) { partly += 1; assert.ok(D.exclusionAmount < D.billed); } }
    assert.equal(D.exclTotal, D.billed - D.net, 'every exclusion leaves gross exactly once');
  }
  assert.ok(partly >= 1, 'the ledger holds partly paid excluded invoices (F among them)'); assert.equal(sumExcl, s.totals.exclusions, 'Σ exclusions of the invoices = the dashboard exclusions'); assert.equal(sumExclusionAmount + sumCancelled, s.totals.exclusions, 'rule exclusions + cancelled = exclusions');
  assert.equal(excludedN, s.totals.excludedCount); assert.equal(gross, s.totals.billedAfterAdj, 'gross invoiced (after approved adjustments)'); assert.equal(s.totals.grossBeforeAdjustments + s.totals.adjustments, s.totals.gross, 'totals.gross is already after approved adjustments'); assert.equal(net, s.totals.net); assert.equal(net, gross - sumExcl, 'Net invoiced = Gross invoiced − Exclusions'); assert.equal(outstanding, s.totals.outstanding); assert.ok(s.equation.ok);
  assert.ok(Math.abs(collected + outstanding - net) < 1, 'net = collected + uncollected (approved identity) with the links applied');
});
ok('exports agree with the dashboard and the invoice: the CSV export carries the excluded value, the net and the state; its totals equal the snapshot', () => {
  const links = { [A]: 'open', [B]: 'open', [F]: 'closed' }; const s = snap(links); const text = [...exportChunks(st, { scope: sc, cfg, links, filters: { allPeriods: true } })].join('');
  const lines = text.split('\n').filter((l) => l && !l.startsWith('\ufeff#')); const head = lines[0].split(','); const col = (name) => head.indexOf(name); const rows = lines.slice(1).map((l) => l.split(','));
  const sum = (name) => rows.reduce((t, r) => t + Number(r[col(name)] || 0), 0); assert.equal(head.length, EXPORT_COLUMNS.length);
  assert.equal(sum('exclusions_sar'), s.totals.exclusions); assert.equal(sum('net_billed_sar'), s.totals.net); assert.equal(sum('collected_sar'), s.totals.collected);
  const ra = rows.find((r) => r[col('invoice_id')] === A); assert.equal(Number(ra[col('excluded_sar')]), 9478590); assert.equal(Number(ra[col('net_billed_sar')]), 0); assert.equal(ra[col('collection_class')], 'excluded'); assert.ok(ra[col('exclusion_rules')] !== undefined);
  const rf = rows.find((r) => r[col('invoice_id')] === F); const d = det(F, links).derived; assert.equal(Number(rf[col('excluded_sar')]), d.exclusionAmount); assert.equal(Number(rf[col('collected_sar')]), d.collected, 'the partly paid invoice keeps its collected amount in the export');
});

console.log(`enforcement exclusion: ${n} test groups passed`);
