// The Sanad order workflow — from the STRUCTURED reference to a confirmed link: validation first (no document needed), the six banner scenarios, the amount basis (billed value, each invoice once),
// the discrepancy acknowledgment, corrections kept apart from the originals, the manual search path, the one-path rule, and the engine's per-invoice outcome. Real compact demo ledger; synthetic records.
// Run with `npm run test:workflow`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStore } from '../server/store.js';
import { resolveReferences } from '../server/orderMatch.js';
import { snapshot, makeCtx, lookupId } from '../server/engine.js';
import { detail } from '../server/materialize.js';
import { list } from '../server/lists.js';
import { normalizeConfig } from '../src/data/revenueMetrics.js';
import { ENTITIES } from '../src/data/catalog.js';
import { importRows, tableFromObjects } from '../src/data/ingestion/importer.js';
import { reportById } from '../src/data/ingestion/reports.js';
import { sanadRecordToCase } from '../src/data/ingestion/sanadCases.js';
import { collectReferences, isInvoiceKind, buildEffectiveCases, recordDocument, recordManualReferences, proposeLink, confirmLink, dismissReference, emptyStore, invoiceStatusMap, unresolvedReferences } from '../src/data/orderMatching.js';
import { assessOrder, BANNER, confirmationSummary, canConfirm, outcomeOf, manualReferencesFrom, AMOUNT_BASIS } from '../src/data/sanadWorkflow.js';
import { orderDocumentRecord } from '../src/data/sanadDocs/orderFeed.js';
import { SANAD_SCENARIO_ROWS } from '../src/data/sanadDocs/scenarioRecords.js';
import { SCENARIOS } from '../src/data/sanadDocs/scenarios.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { console.error(`FAIL  ${name}`); throw e; } n += 1; };
const TODAY = '2026-10-20'; const st = loadStore(TODAY); const cfg = normalizeConfig({ cutoff: TODAY }); const sc = { from: '2000-01-01', to: TODAY, amanah: 'all', source: 'all' };
const index = JSON.parse(fs.readFileSync('public/samples/synthetic-sanad/index.json', 'utf8'));
const AT = '2026-11-05T09:00:00.000Z'; const O = { by: 'Reviewer Demo', at: AT, orderStatus: 'open' };

// the records as the app builds them: the Sanad Excel seed → importRows → sanadRecordToCase (so the structured «رقم الفاتورة» goes through the real importer)
const headers = reportById('sanad.qadaya_view').fields.map((f) => f.headers[0]);
const imp = importRows({ headers, rows: tableFromObjects(headers, SANAD_SCENARIO_ROWS).rows, reportId: 'sanad.qadaya_view' });
const CASES = imp.upserts.map((u) => sanadRecordToCase(u.record || u)); const caseOf = (no) => CASES.find((c) => c.enforceNum === `SND-91000${String(no).padStart(2, '0')}`);
const resolve = (refs) => resolveReferences(st, { refs, cfg }).results;
const resultsFor = (order) => resolve(collectReferences(order, order.docs || []).filter((r) => isInvoiceKind(r.kind)).map((r) => ({ kind: r.kind, value: r.value })));
const withDoc = (c, scn) => { const sc0 = SCENARIOS.find((s) => s.id === scn); const e = index.docs.find((d) => d.scenarioId === scn); const d = orderDocumentRecord({ orderId: c.enforceNum, sha256: e.sha256, name: e.file, size: e.bytes, scenarioId: scn, attachedAt: AT }, e.pages, c.enforceNum, { at: AT }); void sc0; return d; };
const effective = (c, store) => buildEffectiveCases([c], store)[0];
const assess = (c, docState = 'attached') => assessOrder(c, resultsFor(c), { docState });
const idOfInv = (id) => lookupId(st, id);
const A = '177-407580123348'; const E = '171-407870123177'; const F = '171-407890123168'; const COLLECTED = '171-407910123159'; const H = '177-407980123168';

ok('the demo records import with their structured invoice number (a 12-digit Sadad number, a string) — and the scenarios 1–6 carry none', () => {
  assert.equal(CASES.length, 9); assert.equal(caseOf(7).source.invoiceNo, '407580123348'); assert.deepEqual(caseOf(7).refs, [{ kind: 'invoice_no', value: '407580123348' }]);
  for (const k of [1, 2, 3, 4, 5, 6]) assert.deepEqual(caseOf(k).refs, [], `SND-9100${k}`);
  const ref = collectReferences(caseOf(7), []).find((r) => r.origins.some((o) => o.type === 'sanad_structured')); assert.equal(ref.kind, 'sadad_no'); assert.equal(ref.value, '407580123348');
  assert.equal(collectReferences({ refs: [{ kind: 'invoice_no', value: '012345678901' }] }, [])[0].value, '012345678901', 'leading zeros are kept (identifiers stay strings)');
  assert.equal(collectReferences({ refs: [{ kind: 'invoice_no', value: '177-407580123348' }] }, [])[0].kind, 'invoice_no');
});

ok('a) number matches uniquely AND the amount matches → «رقم الفاتورة والقيمة متطابقان»: straight to the confirmation, the document is secondary', () => {
  const a = assess(caseOf(7), 'missing');
  assert.equal(a.scenario, 'match'); assert.equal(a.banner.ar, 'رقم الفاتورة والقيمة متطابقان'); assert.equal(a.banner.tone, 'ok'); assert.equal(a.mode, 'confirm_directly'); assert.equal(a.ocrSecondary, true); assert.equal(a.ocrRequired, false);
  assert.equal(a.structured.matched[0].invoiceId, A); assert.equal(a.structured.total, 41171730); assert.equal(a.orderAmount, 41171730); assert.equal(a.structured.difference, 0); assert.equal(a.manualRecommended, false);
  assert.equal(a.entries[0].origins[0], 'structured');
});

ok('b) number present but no such invoice → «رقم الفاتورة غير موجود في المصادر المتاحة — يحتاج مراجعة» (never «wrong»): extraction offered, manual search available', () => {
  const a = assess(caseOf(8));
  assert.equal(a.scenario, 'not_found'); assert.equal(a.banner.ar, 'رقم الفاتورة غير موجود في المصادر المتاحة — يحتاج مراجعة'); assert.ok(!/خاطئ|خطأ/.test(a.banner.ar));
  assert.equal(a.structured.matched.length, 0); assert.equal(a.structured.unmatched.length, 1); assert.equal(a.offerExtraction, true); assert.equal(a.manualAvailable, true); assert.equal(a.mode, 'document_first');
});

ok('c) number matches but the amount differs → «اختلاف بين قيمة الفواتير وقيمة أمر التنفيذ» with BOTH amounts and the difference', () => {
  const a = assess(caseOf(9));
  assert.equal(a.scenario, 'amount_diff'); assert.equal(a.banner.ar, 'اختلاف بين قيمة الفواتير وقيمة أمر التنفيذ');
  assert.equal(a.orderAmount, 80682830); assert.equal(a.structured.total, 2845640); assert.equal(a.structured.difference, 77837190); assert.equal(a.structured.amountMatch, false);
});

ok('d) no number in Sanad → document extraction offered, manual entry / search available; e) document missing or failed → the manual-search banner', () => {
  const a = assess(caseOf(1)); assert.equal(a.scenario, 'no_numbers'); assert.equal(a.banner.key, 'no_numbers'); assert.equal(a.offerExtraction, true); assert.equal(a.manualRecommended, false);
  const m = assess(caseOf(4), 'missing'); assert.equal(m.scenario, 'no_numbers'); assert.equal(m.banner.ar, BANNER.manual.ar); assert.equal(m.manualRecommended, true);
  assert.equal(assess(caseOf(5), 'failed').banner.key, 'manual'); assert.equal(assess(caseOf(5), 'failed').manualRecommended, true);
  assert.equal(assess(caseOf(8), 'failed').scenario, 'not_found', 'a structured scenario keeps its own banner; the manual search is recommended beside it'); assert.equal(assess(caseOf(8), 'failed').manualRecommended, true);
});

ok('banner texts are exact', () => {
  assert.equal(BANNER.match.ar, 'رقم الفاتورة والقيمة متطابقان'); assert.equal(BANNER.not_found.ar, 'رقم الفاتورة غير موجود في المصادر المتاحة — يحتاج مراجعة'); assert.equal(BANNER.amount_diff.ar, 'اختلاف بين قيمة الفواتير وقيمة أمر التنفيذ');
  const src = fs.readFileSync('src/components/revenue/OrderJourney.jsx', 'utf8'); for (const t of ['تأكيد ربط الفواتير المحددة بأمر التنفيذ', 'التأكيد وحده هو ما يطبّق الاستبعاد؛ الاستخراج أو الربط المقترح لا يؤثر في أي مبلغ']) assert.ok(src.includes(t), t);
});

ok('amount basis: the invoice amount is the BILLED value, never the outstanding balance; each invoice counts once however many references name it; a number matching several invoices is never chosen', () => {
  assert.ok(/القيمة المفوترة|مفوترة/.test(AMOUNT_BASIS.ar) && /not the outstanding/.test(AMOUNT_BASIS.en));
  const partly = { enforceNum: 'X-1', refs: [{ kind: 'invoice_no', value: F }], source: { amount: 190630970 }, amount: 190630970, docs: [], links: [] };
  const a = assess(partly); assert.equal(a.structured.total, 190630970); assert.equal(a.structured.outstanding, 131309453); assert.equal(a.scenario, 'match', 'a partly paid invoice still matches its billed value');
  const twice = { ...partly, refs: [{ kind: 'invoice_no', value: F }, { kind: 'sadad_no', value: '407890123168' }] }; const t = assess(twice);
  assert.equal(t.structured.refs, 2); assert.equal(t.structured.matched.length, 1); assert.equal(t.structured.duplicates.length, 1); assert.equal(t.structured.total, 190630970, 'the duplicate representation is counted once');
  const amb = assessOrder({ enforceNum: 'X-2', refs: [{ kind: 'invoice_no', value: '407890123168' }], source: { amount: 1 }, docs: [], links: [] }, [{ ref: { kind: 'sadad_no', value: '407890123168' }, status: 'ambiguous', candidates: [{ invoiceId: 'a' }, { invoiceId: 'b' }] }]);
  assert.equal(amb.scenario, 'ambiguous'); assert.equal(amb.structured.matched.length, 0); assert.equal(amb.entries[0].candidates.length, 2);
});

ok('tolerance is 1 SAR', () => {
  const o = (amt) => assess({ enforceNum: 'X-3', refs: [{ kind: 'invoice_no', value: A }], source: { amount: amt }, amount: amt, docs: [], links: [] });
  assert.equal(o(41171730.9).scenario, 'match'); assert.equal(o(41171731).scenario, 'match'); assert.equal(o(41171731.5).scenario, 'amount_diff');
});

ok('document extraction feeds the SAME checks: scenario 8 — the document names the right invoice; the structured number stays unresolved until it is CORRECTED (original kept, correction apart with provenance)', () => {
  const c = caseOf(8); const d = withDoc(c, 'sc8-unmatched'); let store = recordDocument(emptyStore(), c.enforceNum, d, O).store;
  let eff = effective(c, store); assert.equal(eff.links.length, 0, 'extraction alone creates no link');
  const a = assess(eff); assert.equal(a.scenario, 'not_found'); assert.equal(a.current.matched.length, 1); assert.equal(a.current.matched[0].invoiceId, '177-407940123186'); assert.equal(a.current.total, 45919400); assert.equal(a.current.difference, 0);
  assert.equal(a.reconciledNow, false, 'the unmatched structured number is still pending');
  const key = a.structured.unmatched[0].ref.key; assert.equal(key, 'sadad_no|407940123199');
  assert.equal(dismissReference(store, c.enforceNum, key, { ...O, correctedTo: '177-407940123186', origin: 'document_ocr_simulated', reason: '' }).error, 'reason_required');
  store = dismissReference(store, c.enforceNum, key, { ...O, correctedTo: '177-407940123186', origin: 'document_ocr_simulated', reason: 'الرقم المسجّل خاطئ؛ المستند يذكر الرقم الصحيح في الصفحة 2' }).store; eff = effective(c, store);
  assert.deepEqual(eff.refs, [{ kind: 'invoice_no', value: '407940123199' }], 'the original Sanad reference is untouched');
  assert.deepEqual(eff.corrections[key], { from: '407940123199', to: '177-407940123186', origin: 'document_ocr_simulated', reason: 'الرقم المسجّل خاطئ؛ المستند يذكر الرقم الصحيح في الصفحة 2', by: 'Reviewer Demo', at: AT });
  assert.ok(eff.history.some((h) => h.action === 'reference_corrected' && h.detail.from === '407940123199' && h.detail.to === '177-407940123186' && h.detail.origin === 'document_ocr_simulated'));
  assert.equal(assess(eff).scenario, 'not_found', 'the validation of what Sanad said does not change'); assert.equal(assess(eff).reconciledNow, true); assert.equal(unresolvedReferences(eff).length, 1);
});

ok('scenario 9: before extraction the difference is 77,837,190 (needs acknowledgment + reason); after the document names the missing invoice it is 0 (nothing to acknowledge); the shared invoice counts once', () => {
  const c = caseOf(9); const a0 = assess(c); const sel0 = (a) => a.current.matched.map((m) => ({ row: { origins: [{ type: 'sanad_structured' }], value: m.invoiceId, conflicts: {} }, candidate: m }));
  const s0 = confirmationSummary(c, sel0(a0), { confirmedTotal: 0 }); assert.equal(s0.difference, 77837190); assert.equal(s0.requiresAck, true);
  assert.equal(canConfirm(s0, null).ok, false); assert.equal(canConfirm(s0, { acknowledged: true, reason: '  ' }).ok, false); assert.equal(canConfirm(s0, { acknowledged: false, reason: 'x' }).ok, false); assert.equal(canConfirm(s0, { acknowledged: true, reason: 'x' }).ok, true);
  const store = recordDocument(emptyStore(), c.enforceNum, withDoc(c, 'sc9-difference'), O).store; const eff = effective(c, store); const a1 = assess(eff);
  assert.equal(a1.current.matched.length, 2); assert.equal(a1.current.duplicates.length, 1); assert.equal(a1.current.total, 80682830); assert.equal(a1.current.difference, 0); assert.equal(a1.reconciledNow, true);
  const s1 = confirmationSummary(eff, sel0(a1), { confirmedTotal: 0 }); assert.equal(s1.requiresAck, false); assert.equal(canConfirm(s1, null).ok, true);
});

ok('the discrepancy acknowledgment is ENFORCED by the reducer and stored on the link and in the history (order amount, invoices total, difference, reason, reviewer, time)', () => {
  const c = caseOf(9); const id = '177-408960122727'; const input = { invoiceId: id, origin: 'sanad_structured', gross: 2845640, conflicts: [], evidence: [], amountCheck: { orderAmount: 80682830, invoicesTotal: 2845640, difference: 77837190 } };
  assert.equal(confirmLink(emptyStore(), c.enforceNum, id, { ...O, input }).error, 'amount_ack_required');
  assert.equal(confirmLink(emptyStore(), c.enforceNum, id, { ...O, input, ack: { acknowledged: true, reason: '' } }).error, 'amount_ack_required');
  const r = confirmLink(emptyStore(), c.enforceNum, id, { ...O, input, ack: { acknowledged: true, reason: 'الفاتورة الثانية قيد البحث' } }); assert.equal(r.error, null);
  const eff = effective(c, r.store); const l = eff.links[0]; assert.deepEqual(l.amountAck, { orderAmount: 80682830, invoicesTotal: 2845640, difference: 77837190, reason: 'الفاتورة الثانية قيد البحث', acknowledgedBy: 'Reviewer Demo', acknowledgedAt: AT });
  assert.equal(l.reviewedBy, 'Reviewer Demo'); assert.equal(l.reviewedAt, AT); assert.deepEqual(eff.history.find((h) => h.action === 'confirmed').detail.amountAck, l.amountAck);
  const ok0 = confirmLink(emptyStore(), c.enforceNum, id, { ...O, input: { ...input, amountCheck: { orderAmount: 2845640, invoicesTotal: 2845640, difference: 0 } } }); assert.equal(ok0.error, null); assert.equal(effective(c, ok0.store).links[0].amountAck, null);
});

ok('manual SEARCH path (no document): the ledger search finds invoices by number / Sadad number / payer; the picked ones need a REQUIRED explanation, flow through the same checks and reconcile the order', () => {
  const c = caseOf(4); assert.equal(c.amount, 81316770); const ids = ['177-412170121242', '177-414830120045'];
  for (const id of ids) { const rows = list(st, { scope: sc, cfg, filters: { search: id, allPeriods: true }, page: 0, pageSize: 5 }).rows; assert.equal(rows.length, 1); assert.equal(rows[0].id, id); }
  assert.equal(list(st, { scope: sc, cfg, filters: { search: '412170121242', allPeriods: true }, page: 0, pageSize: 5 }).rows[0].id, ids[0], 'by the Sadad number');
  assert.ok(list(st, { scope: sc, cfg, filters: { search: 'مالك أرض', allPeriods: true }, page: 0, pageSize: 5 }).total > 0, 'by payer');
  const ex = manualReferencesFrom(ids.join('\n'), { origin: 'manual_search', reason: '', orderNo: c.enforceNum }); assert.equal(recordManualReferences(emptyStore(), c.enforceNum, ex, O).error, 'reason_required');
  const ex2 = manualReferencesFrom(ids.join('\n'), { origin: 'manual_search', reason: 'الفاتورتان تطابقان مبلغ الأمر وأمانته حسب البحث', orderNo: c.enforceNum });
  const store = recordManualReferences(emptyStore(), c.enforceNum, ex2, O).store; const eff = effective(c, store);
  assert.equal(eff.links.length, 0); assert.ok(eff.history.some((h) => h.action === 'manual_references_added' && h.detail.origin === 'manual_search' && h.detail.reason.startsWith('الفاتورتان')));
  const refs = collectReferences(eff, eff.docs); assert.deepEqual(refs.map((r) => r.value), ids); assert.ok(refs.every((r) => r.origins[0].type === 'document_manual_search' && r.origins[0].snippet.startsWith('الفاتورتان')));
  const a = assess(eff, 'missing'); assert.equal(a.current.matched.length, 2); assert.equal(a.current.total, 81316770); assert.equal(a.current.difference, 0); assert.equal(a.reconciledNow, true); assert.equal(a.entries[0].origins[0], 'manual_search');
});

ok('scenario 5 (first extraction fails) and 1 (no numbers; three invoices in the document) complete through the same single path', () => {
  const c5 = caseOf(5); const ex = manualReferencesFrom(`${F}\n${E}`, { origin: 'manual_search', reason: 'اختيار يدوي بعد تعذّر الاستخراج', orderNo: c5.enforceNum }); const a5 = assess(effective(c5, recordManualReferences(emptyStore(), c5.enforceNum, ex, O).store), 'failed');
  assert.equal(a5.current.total, 241874670); assert.equal(a5.reconciledNow, true);
  const c1 = caseOf(1); const a1 = assess(effective(c1, recordDocument(emptyStore(), c1.enforceNum, withDoc(c1, 'sc1-match'), O).store), 'extracted'); assert.equal(a1.current.matched.length, 3); assert.equal(a1.current.total, 64155210); assert.equal(a1.reconciledNow, true); assert.equal(a1.scenario, 'no_numbers');
});

ok('an UNCONFIRMED extraction, manual entry or proposal changes NOTHING: no confirmed link, no exclusion, no total moves; only a confirmation does', () => {
  const base = snapshot(st, { scope: sc, cfg, links: {} });
  const c = caseOf(9); let store = recordDocument(emptyStore(), c.enforceNum, withDoc(c, 'sc9-difference'), O).store;
  store = recordManualReferences(store, c.enforceNum, manualReferencesFrom('177-409340122475', { origin: 'manual_entry', reason: 'مكتوب', orderNo: c.enforceNum }), O).store;
  assert.deepEqual(invoiceStatusMap([effective(c, store)]), {}); const same = snapshot(st, { scope: sc, cfg, links: invoiceStatusMap([effective(c, store)]) }); assert.equal(same.totals.exclusions, base.totals.exclusions);
  store = proposeLink(store, c.enforceNum, { invoiceId: '177-409340122475', origin: 'document_ocr_simulated', gross: 77837190, evidence: [], conflicts: [] }, O).store; const map = invoiceStatusMap([effective(c, store)]); assert.deepEqual(map, { '177-409340122475': 'candidate' });
  const prop = snapshot(st, { scope: sc, cfg, links: map }); assert.equal(prop.totals.exclusions, base.totals.exclusions); assert.equal(prop.totals.net, base.totals.net); assert.equal(prop.totals.outstanding, base.totals.outstanding);
  const conf = confirmLink(store, c.enforceNum, '177-409340122475', { ...O, input: null }); assert.equal(conf.error, null); const m2 = invoiceStatusMap([effective(c, conf.store)]); assert.equal(m2['177-409340122475'], 'open');
  const after = snapshot(st, { scope: sc, cfg, links: m2 }); assert.equal(after.totals.exclusions - base.totals.exclusions, 77837190, 'the confirmed link excludes the uncollected value, once');
});

ok('exclusion OUTCOME per invoice after confirmation (never assumed): uncollected → excluded with its value; partly paid → only the uncollected remainder; FULLY COLLECTED → not excluded; cancelled → flagged conflict', () => {
  const det = (id, links) => detail(st, idOfInv(id), makeCtx(st, { cfg, links }));
  const o1 = outcomeOf(det(A, { [A]: 'open' })); assert.equal(o1.state, 'excluded'); assert.equal(o1.value, 41171730); assert.equal(o1.byLink, true);
  const o2 = outcomeOf(det(F, { [F]: 'open' })); assert.equal(o2.state, 'excluded'); assert.equal(o2.value, 131309453); assert.ok(o2.received > 0, 'payment kept');
  const o3 = outcomeOf(det(COLLECTED, { [COLLECTED]: 'open' })); assert.equal(o3.state, 'not_excluded'); assert.equal(o3.reason, 'collected'); assert.equal(o3.value, 0);
  const o4 = outcomeOf(det(H, { [H]: 'open' })); assert.equal(o4.sourceConflict, true); assert.equal(o4.sourceCancelled, true);
  assert.equal(outcomeOf(det(A, { [A]: 'candidate' })).state, 'not_excluded', 'a proposal excludes nothing');
  assert.equal(outcomeOf(null), null);
});

ok('scenario data: SND-9100001…9; the new PDFs exist; 4 has no document; 7 needs none', () => {
  assert.equal(SANAD_SCENARIO_ROWS.length, 9); const have = index.docs.map((d) => d.scenarioId).sort(); assert.deepEqual(have, ['sc1-match', 'sc2-uncertain', 'sc3-conflict', 'sc5-retry', 'sc6-cancelled', 'sc8-unmatched', 'sc9-difference']);
  assert.ok(!SCENARIOS.find((s) => s.n === 4).file && !SCENARIOS.find((s) => s.n === 7).file);
  assert.deepEqual(SCENARIOS.find((s) => s.id === 'sc9-difference').invoices.map((i) => i.value), ['177-408960122727', '177-409340122475']);
  assert.ok(ENTITIES.length > 0);
});

console.log(`sanad workflow: ${n} test groups passed`);
