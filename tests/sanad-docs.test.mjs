// Tests of the Sanad document + OCR simulation: the five scenarios, determinism, failure + retry, arbitrary files, conflict detection, the field review (original kept, correction, reviewer,
// timestamp, history surviving a store reload), the missing-document flag, documentState, the labels and the generated PDFs. Fully synthetic data. Run with `npm run test:sanad-docs`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SANAD_SCENARIO_ROWS } from '../src/data/sanadDocs/scenarioRecords.js';
import { SCENARIOS, scenarioById } from '../src/data/sanadDocs/scenarios.js';
import { setCatalog, docBySha } from '../src/data/sanadDocs/catalog.js';
import { memoryBackend, createStore, reviewField, reviewKey } from '../src/data/sanadDocs/store.js';
import { registerProvider, unregisterProvider, listProviders, getProvider, DEFAULT_PROVIDER_ID } from '../src/data/sanadDocs/extraction.js';
import { currentDoc, attachScenarioDoc, attachUpload, runExtraction, reviewRows, countRows, loadDocsIndex, documentState, sha256Hex } from '../src/data/sanadDocs/service.js';
import { compareField, classifyField, structuredValues, AMOUNT_TOLERANCE, DOC_FIELDS, coerceValue } from '../src/data/sanadDocs/compare.js';
import { loadStore } from '../server/store.js';
import { resolveReferences } from '../server/orderMatch.js';
import { ENTITIES } from '../src/data/catalog.js';
import { buildExtraction, collectReferences, isInvoiceKind, buildRows, buildEffectiveCases, recordDocument, confirmLink, unresolvedReferences, emptyStore, invoiceStatusMap } from '../src/data/orderMatching.js';
import { rowState, selectionFor } from '../src/data/orderSummary.js';
import { sanadExtraction, orderDocumentRecord } from '../src/data/sanadDocs/orderFeed.js';
import { rowFlags, withCriteria } from '../src/data/sanadDocs/reviewFlags.js';
import { SIM_LABEL, SIM_EXPLAIN, DOC_MARK, MISSING_DOC_FLAG, MISSING_IN_DOC, STATE_LABEL, EXTRACT_ACTION } from '../src/data/sanadDocs/labels.js';

let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { console.error(`FAILED: ${name}`); throw e; } n += 1; };
const DIR = path.resolve('public/samples/synthetic-sanad');
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8')); setCatalog(index);
const AT = '2026-11-05T09:00:00.000Z';

// a Sanad record as the demo holds it (the importer builds the same shape from a row)
const recordOf = (row) => ({
  enforceNum: `SND-${row['رقم طلب التنفيذ']}`, amount: row['المبلغ'],
  source: { requestNo: String(row['رقم طلب التنفيذ']), claimNo: String(row['رقم طلب المطالبة بألاداء']), claimDate: row['تاريخ المطالبة'], amanah: row['الأمانة'], municipality: row['البلدية'], amount: row['المبلغ'], amountWords: row['المبلغ كتابة'],
    enforcementNo: String(row['رقم الانفاذ']), invoiceNo: String(row['رقم الفاتورة']), debtorType: row['نوع المنفذ ضدة'], executionType: row['نوع التنفيذ'] }
});
const RECORDS = SANAD_SCENARIO_ROWS.map(recordOf); const R = (i) => RECORDS[i - 1];
const fresh = () => { const backend = memoryBackend(); return { backend, store: createStore(backend) }; };
const field = (ex, k) => ex.fields.find((f) => f.key === k);
const readPdf = (sc) => fs.readFileSync(path.join(DIR, sc.file));

await ok('the nine scenario rows: 20 Sanad columns, synthetic request numbers 9100001..9100009, no structured invoice number in 1–6 and a 12-digit Sadad number in 7–9', () => {
  assert.equal(SANAD_SCENARIO_ROWS.length, 9);
  SANAD_SCENARIO_ROWS.forEach((r, i) => { assert.equal(Object.keys(r).length, 20); assert.equal(Number(r['رقم طلب التنفيذ']), 9100001 + i); assert.equal(r['رقم الفاتورة'], i < 6 ? '' : String(r['رقم الفاتورة']).replace(/\D/g, '')); assert.equal(i < 6, r['رقم الفاتورة'] === ''); assert.ok(i < 6 || /^\d{12}$/.test(r['رقم الفاتورة'])); });
  assert.deepEqual(SCENARIOS.map((s) => s.recordKey), RECORDS.map((r) => r.enforceNum));
});

await ok('determinism: the same document and record give the same extraction every time', async () => {
  const run = async () => { const { store } = fresh(); await attachScenarioDoc(store, R(3).enforceNum, 'sc3-conflict', { by: 'T', at: AT }); const e = await runExtraction(store, { orderId: R(3).enforceNum, record: R(3), at: AT }); return JSON.stringify(e); };
  assert.equal(await run(), await run());
});

await ok('scenario 1: the document matches the record — no conflict, high confidence, all reviewed → reviewed', async () => {
  const { store } = fresh(); const id = R(1).enforceNum;
  assert.equal((await currentDoc(store, id)).scenarioId, 'sc1-match'); // supplied with the record
  const ex = await runExtraction(store, { orderId: id, record: R(1), at: AT });
  assert.equal(ex.status, 'completed'); assert.equal(ex.simulated, true); assert.equal(ex.attempts, 1);
  assert.ok(ex.fields.every((f) => f.status === 'extracted' && f.confidence >= 0.9), 'all extracted with high confidence');
  assert.equal(field(ex, 'amount').value, 64155210);
  const idx = await loadDocsIndex(store); assert.equal(documentState(R(1), idx), 'extracted');
  for (const f of ex.fields) assert.ok((await reviewField(store, { orderId: id, extraction: ex, fieldKey: f.key, action: 'confirm', by: 'Reviewer A', at: AT })).ok);
  assert.equal(documentState(R(1), await loadDocsIndex(store)), 'reviewed');
});

await ok('scenario 2: one uncertain value and one field absent from the document', async () => {
  const { store } = fresh(); const id = R(2).enforceNum;
  const ex = await runExtraction(store, { orderId: id, record: R(2), at: AT });
  assert.equal(field(ex, 'enforcementNo').status, 'uncertain'); assert.ok(field(ex, 'enforcementNo').confidence < 0.75);
  const mu = field(ex, 'municipality'); assert.equal(mu.status, 'missing'); assert.equal(mu.value, null); assert.equal(mu.snippet, null);
  assert.equal(ex.fields.filter((f) => f.status === 'conflict').length, 0);
  const rows = reviewRows(ex, {}, R(2)); assert.equal(rows.find((r) => r.key === 'municipality').needsDecision, false); // nothing to decide on a missing field…
  assert.equal(rows.find((r) => r.key === 'municipality').structuredShown, 'وحدة المبيعات السكنية'); // …the structured value stays visible
  assert.equal(MISSING_IN_DOC.ar, 'غير موجود في المستند');
});

await ok('scenario 3: the document total differs from the order amount — a conflict that needs a reviewer decision', async () => {
  const { store } = fresh(); const id = R(3).enforceNum;
  const ex = await runExtraction(store, { orderId: id, record: R(3), at: AT });
  assert.deepEqual(ex.fields.filter((f) => f.status === 'conflict').map((f) => f.key), ['amount']); assert.equal(field(ex, 'amount').value, 149897570);
  const rows = reviewRows(ex, {}, R(3)); assert.ok(rows.find((r) => r.key === 'amount').needsDecision && rows.find((r) => r.key === 'amount').conflict);
  // accepting a conflicting value needs a reason; the structured value can be chosen through a correction
  assert.equal((await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'amount', action: 'confirm', by: 'R', at: AT })).error, 'note_required');
  assert.ok((await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'amount', action: 'confirm', note: 'المستند هو الأصح', by: 'R', at: AT })).ok);
  const c = await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'amount', action: 'correct', value: R(3).source.amount, note: 'القيمة المهيكلة', by: 'R', at: AT });
  assert.equal(c.review.value, 150000000); assert.equal(c.review.original.value, 149897570);
});

await ok('scenario 4: a record without a document stays visible with the flag and no extraction', async () => {
  const { store } = fresh(); const id = R(4).enforceNum;
  assert.equal(await currentDoc(store, id), null);
  assert.equal(documentState(R(4), await loadDocsIndex(store)), 'missing');
  const r = await runExtraction(store, { orderId: id, record: R(4) }); assert.equal(r.status, 'failed'); assert.equal(r.error.code, 'no_document'); assert.equal(r.persisted, false);
  assert.equal(MISSING_DOC_FLAG.ar, 'مستند سند غير متوفر'); assert.equal(STATE_LABEL.missing.ar, MISSING_DOC_FLAG.ar);
  assert.equal(scenarioById('sc4-missing').file, null);
});

await ok('scenario 5: the first attempt fails (kept with its attempt counter), the retry succeeds — also after a reload', async () => {
  const { backend, store } = fresh(); const id = R(5).enforceNum; const pagesSeen = [];
  const a = await runExtraction(store, { orderId: id, record: R(5), at: AT, onPage: (p, t) => pagesSeen.push([p, t]) });
  assert.equal(a.status, 'failed'); assert.equal(a.attempts, 1); assert.equal(a.error.code, 'page_unreadable'); assert.equal(a.error.page, 2); assert.equal(a.error.retryable, true); assert.deepEqual(pagesSeen, [[1, 3]]); assert.deepEqual(a.fields, []);
  assert.equal(documentState(R(5), await loadDocsIndex(store)), 'failed');
  const store2 = createStore(backend); // a page reload: the counter lives in the store, not in memory
  assert.equal((await store2.getExtraction(id)).attempts, 1);
  const b = await runExtraction(store2, { orderId: id, record: R(5), at: AT });
  assert.equal(b.status, 'completed'); assert.equal(b.attempts, 2); assert.equal(b.fields.length, DOC_FIELDS.length); assert.ok(b.fields.every((f) => f.status === 'extracted'));
  assert.equal(documentState(R(5), await loadDocsIndex(createStore(backend))), 'extracted');
});

await ok('an arbitrary uploaded file: attached and kept, but NO value is ever produced for it', async () => {
  const { store, backend } = fresh(); const id = R(1).enforceNum;
  const junk = new TextEncoder().encode('%PDF-1.4 this is not one of the scenario documents');
  const up = await attachUpload(store, id, { name: 'sanad-9100001.pdf', type: 'application/pdf', bytes: junk }, { by: 'R', at: AT }); // even under a scenario file name
  assert.equal(up.ok, true); assert.equal(up.doc.recognised, false); assert.equal(up.doc.scenarioId, undefined);
  const r = await runExtraction(store, { orderId: id, record: R(1), at: AT });
  assert.equal(r.status, 'failed'); assert.equal(r.error.code, 'not_a_scenario_document'); assert.deepEqual(r.fields, []); assert.deepEqual(r.pages, []); assert.equal(r.persisted, false);
  assert.equal(await store.getExtraction(id), null); assert.equal((await backend.all('extractions')).length, 0);
  assert.equal(documentState(R(1), await loadDocsIndex(store)), 'attached');
  assert.equal((await store.getDoc(id)).sha256, await sha256Hex(junk));
});

await ok('a file is "simulated" only if its SHA-256 equals a scenario document (uploading the real scenario PDF works; its bytes are kept)', async () => {
  const { store } = fresh(); const id = R(2).enforceNum; const bytes = readPdf(scenarioById('sc2-uncertain'));
  const up = await attachUpload(store, id, { name: 'my-copy.pdf', type: 'application/pdf', bytes }, { by: 'R', at: AT });
  assert.equal(up.doc.recognised, true); assert.equal(up.doc.scenarioId, 'sc2-uncertain'); assert.equal(up.doc.source, 'upload');
  const ex = await runExtraction(store, { orderId: id, record: R(2), at: AT }); assert.equal(ex.status, 'completed'); assert.equal(field(ex, 'municipality').status, 'missing');
  assert.equal((await store.getDoc(id)).bytes.byteLength, bytes.length);
  const one = Uint8Array.from(bytes); one[one.length - 1] ^= 1; // a single changed byte is a different file
  assert.equal(docBySha(index, await sha256Hex(one)), null);
});

await ok('conflict detection: identifiers compare exactly, the amount within 1 SAR, other text never blocks', () => {
  assert.equal(AMOUNT_TOLERANCE, 1);
  assert.deepEqual(compareField('invoiceNo', '910000000001', '910000000001'), { comparable: true, same: true, conflict: false });
  assert.equal(compareField('invoiceNo', '910000000030', '910000000003').conflict, true);
  assert.equal(compareField('invoiceNo', '91-0000000001', '910000000001').conflict, false); // separators are not a difference
  assert.equal(compareField('amount', 48250, 48250.9).conflict, false); assert.equal(compareField('amount', 48250, 48251).conflict, false);
  assert.equal(compareField('amount', 48250, 48251.01).conflict, true); assert.equal(compareField('amount', '37,000.00 ريال', 73000).conflict, true);
  assert.equal(compareField('municipality', 'بلدية الوسط', 'بلدية الشرق').conflict, false); assert.equal(compareField('municipality', 'بلدية الوسط', 'بلدية الشرق').same, false);
  assert.equal(compareField('invoiceNo', '910000000001', null).comparable, false); // nothing structured to compare with → no conflict, the document fills a gap
  assert.equal(classifyField('amount', null, 0, 1), 'missing'); assert.equal(classifyField('amanah', 'x', 0.5, 'y'), 'uncertain');
  const sv = structuredValues({ source: { enforcementNo: '9300001', enforcementNoRaw: '2.414E+11', invoiceNo: '4.08380122907E+11' } });
  assert.equal(sv.enforcementNo, null, 'a value with lost digits is not compared'); assert.equal(sv.invoiceNo, '408380122907');
  assert.equal(coerceValue('amount', 'abc').ok, false); assert.equal(coerceValue('amount', '1,250.50').value, 1250.5);
});

await ok('a scenario document attached to ANOTHER record shows conflicts', async () => {
  const { store } = fresh(); const id = 'EN-5000'; // an existing generated case: another record
  const other = { enforceNum: id, amount: 99999, source: { requestNo: '4612345', claimNo: '4600000001', amount: 99999, enforcementNo: '4600000001', invoiceNo: '' } };
  assert.equal(await currentDoc(store, id), null);
  await attachScenarioDoc(store, id, 'sc1-match', { by: 'R', at: AT }); const ex = await runExtraction(store, { orderId: id, record: other, at: AT });
  const conflicts = ex.fields.filter((f) => f.status === 'conflict').map((f) => f.key).sort(); assert.deepEqual(conflicts, ['amount', 'claimNo', 'enforcementNo', 'requestNo']);
  assert.equal(field(ex, 'invoiceNo').status, 'extracted'); // no structured invoice number → nothing to conflict with
});

await ok('review: the original is kept, the correction / reviewer / timestamp are recorded, every decision is in the history', async () => {
  const { store } = fresh(); const id = R(2).enforceNum; const ex = await runExtraction(store, { orderId: id, record: R(2), at: AT });
  assert.equal((await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'enforcementNo', action: 'confirm', at: AT })).error, 'reviewer_required');
  assert.equal((await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'municipality', action: 'confirm', by: 'A', at: AT })).error, 'nothing_to_confirm');
  assert.equal((await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'amount', action: 'correct', value: 'abc', by: 'A', at: AT })).error, 'invalid_value');
  assert.equal((await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'enforcementNo', action: 'reject', by: 'A', at: AT })).error, 'note_required');
  const a = await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'enforcementNo', action: 'correct', value: '9300002', note: 'قرأتُ الأصل', by: 'Reviewer A', at: '2026-11-05T10:00:00.000Z' });
  assert.equal(a.review.decision, 'corrected'); assert.equal(a.review.value, '9300002'); assert.equal(a.review.by, 'Reviewer A'); assert.equal(a.review.at, '2026-11-05T10:00:00.000Z');
  assert.deepEqual(a.review.original, { value: '9300002', confidence: 0.54, status: 'uncertain', page: 3, snippet: 'رقم الانفاذ: 9300002 (الرقم باهت في الأصل)' });
  const b = await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'enforcementNo', action: 'correct', value: '9300099', by: 'Reviewer B', at: '2026-11-05T11:00:00.000Z' });
  assert.equal(b.review.value, '9300099'); assert.equal(b.review.original.value, '9300002', 'the original extracted value never changes');
  assert.equal(b.review.history.length, 2); assert.deepEqual(b.review.history.map((h) => [h.by, h.action, h.value, h.previousDecision]), [['Reviewer A', 'correct', '9300002', null], ['Reviewer B', 'correct', '9300099', 'corrected']]);
  const mu = await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'municipality', action: 'correct', value: 'بلدية الشرق', by: 'A', at: AT }); // a missing field can be supplied by a person
  assert.equal(mu.review.original.value, null); assert.equal(mu.review.original.status, 'missing');
  const rows = reviewRows(ex, await store.getReviews(id, ex.sha256), R(2)); const r = rows.find((x) => x.key === 'enforcementNo');
  assert.equal(r.status, 'corrected'); assert.equal(r.final.origin, 'reviewer'); assert.equal(r.history.length, 2); assert.equal(countRows(rows).decided, 2);
  assert.equal((await reviewField(store, { orderId: id, extraction: { ...ex, status: 'failed' }, fieldKey: 'amount', action: 'confirm', by: 'A' })).error, 'no_extraction');
});

await ok('the review history survives a store reload (memory backend → new store)', async () => {
  const { backend, store } = fresh(); const id = R(3).enforceNum; const ex = await runExtraction(store, { orderId: id, record: R(3), at: AT });
  await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'claimNo', action: 'confirm', by: 'Reviewer A', at: AT });
  await reviewField(store, { orderId: id, extraction: ex, fieldKey: 'invoiceNo', action: 'reject', note: 'ليس رقم هذا السجل', by: 'Reviewer A', at: AT });
  const again = createStore(backend); const ex2 = await again.getExtraction(id); assert.deepEqual(ex2.fields, ex.fields);
  const reviews = await again.getReviews(id, ex2.sha256); assert.deepEqual(Object.keys(reviews).sort(), ['claimNo', 'invoiceNo']);
  assert.equal(reviews.invoiceNo.decision, 'rejected'); assert.equal(reviews.invoiceNo.history[0].note, 'ليس رقم هذا السجل'); assert.ok(await backend.get('reviews', reviewKey(id, ex2.sha256, 'claimNo')));
  assert.equal(documentState(R(3), await loadDocsIndex(again)), 'under_review');
});

await ok('documentState / loadDocsIndex: missing · attached · extracted · under_review · reviewed · failed', async () => {
  const { store } = fresh(); let idx = await loadDocsIndex(store);
  assert.deepEqual(RECORDS.map((r) => documentState(r, idx)), ['attached', 'attached', 'attached', 'missing', 'attached', 'attached', 'missing', 'attached', 'attached']); // the record supplied with its document is "attached"; scenario 4 has none
  assert.equal(documentState({ enforceNum: 'EN-5013' }, idx), 'missing'); assert.equal(documentState({ enforceNum: 'EN-5013' }, undefined), 'missing');
  assert.ok(idx instanceof Map && idx.has('SND-9100001') && !idx.get('SND-9100001').doc.bytes);
  await runExtraction(store, { orderId: R(2).enforceNum, record: R(2), at: AT }); assert.equal(documentState(R(2), await loadDocsIndex(store)), 'extracted');
  const ex = await store.getExtraction(R(2).enforceNum);
  await reviewField(store, { orderId: R(2).enforceNum, extraction: ex, fieldKey: 'amount', action: 'confirm', by: 'A', at: AT }); assert.equal(documentState(R(2), await loadDocsIndex(store)), 'under_review');
  for (const f of ex.fields.filter((x) => x.status !== 'missing')) await reviewField(store, { orderId: R(2).enforceNum, extraction: ex, fieldKey: f.key, action: 'confirm', by: 'A', at: AT });
  idx = await loadDocsIndex(store); assert.equal(documentState(R(2), idx), 'reviewed'); assert.equal(idx.get('SND-9100002').counts.pending, 0);
  await attachScenarioDoc(store, 'EN-5013', 'sc1-match', { by: 'A', at: AT }); assert.equal(documentState({ enforceNum: 'EN-5013' }, await loadDocsIndex(store)), 'attached');
  await attachScenarioDoc(store, R(2).enforceNum, 'sc2-uncertain', { by: 'A', at: AT }); // attaching a document starts a new extraction for that order
  assert.equal(documentState(R(2), await loadDocsIndex(store)), 'attached');
});

await ok('the provider interface: registry, a replacement provider, and the labelled simulation', async () => {
  assert.equal(DEFAULT_PROVIDER_ID, 'simulation'); const sim = getProvider('simulation'); assert.equal(sim.simulated, true); assert.equal(sim.label.ar, SIM_LABEL.ar);
  assert.throws(() => registerProvider({ id: 'bad' }));
  registerProvider({ id: 'fake-real', label: { ar: 'مزوّد', en: 'Provider' }, async extract(doc, rec, ctx) { ctx.onPage?.(1, 1); return { status: 'completed', pages: [{ page: 1, text: 'x' }], fields: [{ key: 'amount', value: 1, confidence: 1, page: 1, snippet: 'x', status: 'extracted' }] }; } });
  assert.ok(listProviders().some((p) => p.id === 'fake-real'));
  const { store } = fresh(); await attachScenarioDoc(store, R(1).enforceNum, 'sc1-match', { by: 'A', at: AT });
  const ex = await runExtraction(store, { orderId: R(1).enforceNum, record: R(1), providerId: 'fake-real', at: AT }); assert.equal(ex.providerId, 'fake-real'); assert.equal(ex.simulated, false);
  unregisterProvider('fake-real'); assert.equal((await runExtraction(store, { orderId: R(1).enforceNum, record: R(1), providerId: 'fake-real' })).error.code, 'unknown_provider');
});

await ok('labels: the exact simulation label, its explanation and the document marker', () => {
  assert.equal(SIM_LABEL.ar, 'محاكاة OCR — بيانات تجريبية'); assert.equal(SIM_LABEL.en, 'OCR simulation — synthetic demo data');
  assert.ok(/PREDEFINED/.test(SIM_EXPLAIN.en) && /did not read any uploaded file/.test(SIM_EXPLAIN.en)); assert.ok(/مُعدّة مسبقاً/.test(SIM_EXPLAIN.ar) && /لم يقرأ النظام أي ملف مرفوع/.test(SIM_EXPLAIN.ar));
  assert.equal(DOC_MARK, 'مستند تجريبي — غير رسمي'); assert.equal(EXTRACT_ACTION.ar, 'استخراج البيانات');
  assert.equal(DOC_FIELDS.find((f) => f.key === 'enforcementNo').ar, 'رقم الانفاذ');
});

await ok('the generated PDFs exist, their SHA-256 matches index.json, every page carries the marker and the transcripts equal the scenario texts', () => {
  const withFile = SCENARIOS.filter((s) => s.file); assert.equal(index.docs.length, withFile.length); assert.equal(withFile.length, 7);
  for (const sc of withFile) {
    const e = index.docs.find((d) => d.scenarioId === sc.id); assert.ok(e, sc.id); const bytes = readPdf(sc);
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF'); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), e.sha256); assert.equal(e.bytes, bytes.length);
    assert.deepEqual(e.pages.map((p) => p.text), sc.pages); assert.ok(sc.pages.every((t) => t.startsWith(DOC_MARK)));
    for (const f of Object.values(sc.fields)) if (f) assert.ok(sc.pages[f.page - 1].includes(f.snippet), `${sc.id}: snippet «${f.snippet}» is on page ${f.page}`);
    assert.equal(e.recordKey, sc.recordKey);
    try { const txt = execFileSync('pdftotext', [path.join(DIR, sc.file), '-']).toString(); assert.ok(/تجريب/.test(txt), 'Arabic text layer'); assert.ok(sc.pages.length === (txt.match(/\f/g) || []).length); } catch (e2) { if (e2.code !== 'ENOENT') throw e2; }
  }
  assert.equal(new Set(index.docs.map((d) => d.sha256)).size, 7);
});

await ok('nothing real: no brand / system names or real-looking identifiers in the scenario data', () => {
  const blob = JSON.stringify([SANAD_SCENARIO_ROWS, SCENARIOS]) + JSON.stringify(index);
  for (const bad of ['Makeen', 'Incorta', 'Najiz', 'ناجز', 'مكين']) assert.ok(!blob.includes(bad), bad);
});


/* ------------------------------------------------------------------ invoice references: extraction → the EXISTING matching pipeline → review → confirmation */
const TODAY = '2026-11-05'; process.env.DEMO_SIZE = 'compact'; const world = loadStore(TODAY); const cfg = { cutoff: TODAY };
const resolve = (refs) => resolveReferences(world, { refs, cfg }).results;
const docOf = (sc) => { const e = index.docs.find((d) => d.scenarioId === sc.id); return { orderId: sc.recordKey, sha256: e.sha256, name: e.file, size: e.bytes, scenarioId: sc.id, attachedAt: AT }; };
const caseOfRecord = (r, docs = []) => ({ enforceNum: r.enforceNum, system: 'sanad', amanahEn: ENTITIES.find((e) => e.ar === r.source.amanah)?.en, amount: r.amount, openedDate: '2026-06-09', refs: [], requestStatus: 'قيد التنفيذ', links: [], docs, description: '', notes: '', source: r.source });
const SCN = SCENARIOS.filter((s) => s.file);
// the review rows exactly as the order page builds them (collectReferences → server resolve → buildRows → criteria)
const reviewOf = (sc, links = []) => {
  const rec = recordOf(SANAD_SCENARIO_ROWS[sc.n - 1]); const d = orderDocumentRecord(docOf(sc), index.docs.find((x) => x.scenarioId === sc.id).pages, sc.recordKey, { at: AT });
  const c = caseOfRecord(rec, [d]); const refs = collectReferences(c, c.docs).filter((r) => isInvoiceKind(r.kind));
  const res = resolve(refs.map((r) => ({ kind: r.kind, value: r.value }))); const rows0 = buildRows(c, refs, res, links, new Map(), new Set(), c.docs);
  return { c, d, rows: withCriteria(c, rows0).rows, refs };
};

await ok('every scenario transcript yields its invoice references through buildExtraction, each with page and the passage it was read from; nothing else is taken for an invoice', () => {
  for (const sc of SCN) {
    const e = index.docs.find((d) => d.scenarioId === sc.id); const ex = sanadExtraction(docOf(sc), e.pages, sc.recordKey);
    assert.equal(ex.method, 'ocr_simulated'); assert.equal(ex.simulation.label, SIM_LABEL.ar); assert.equal(ex.simulation.sha256, e.sha256); assert.equal(ex.format, 'pdf');
    assert.deepEqual(ex.refs.map((r) => r.value), sc.invoices.map((i) => i.value), sc.id);
    for (const r of ex.refs) { const want = sc.invoices.find((i) => i.value === r.value); const o = r.occurrences[0]; assert.equal(o.page, want.page, `${sc.id} ${r.value} page`); assert.ok(e.pages[o.page - 1].text.includes(o.snippet) && o.snippet.includes(o.raw), 'the snippet is a passage of that page'); }
    assert.ok(ex.refs.every((r) => ['invoice_no', 'invoice_serial'].includes(r.kind)));
    assert.ok(ex.others.every((o) => o.kind === 'other_number'), 'request / claim / enforcement numbers are never invoice references');
    assert.equal(ex.orderNumberMismatch, false);
  }
  assert.equal(sanadExtraction(docOf(SCN[0]), index.docs[0].pages, 'SND-9100001').statedAmount, 64155210);
  assert.equal(SCN.find((s) => s.id === 'sc2-uncertain').invoices.find((i) => i.value === '0000031').expect, 'incomplete');
});

await ok('the documents name REAL invoices of the demo ledger (uncollected, not excluded, none linked to an order), as the coordinator listed them', () => {
  const want = { '171-407930123150': [9478590, 'overdue'], '171-407950123141': [9524400, 'overdue'], '171-408030123105': [45152220, 'overdue'], '171-407850123186': [103790970, 'overdue'], '171-407870123177': [51243700, 'overdue'], '171-407890123168': [190630970, 'partial'], '171-407990123123': [79244410, 'overdue'], '177-407980123168': [77876290, 'cancelled'], '177-408500122934': [70653160, 'overdue'] };
  const res = resolve(Object.keys(want).map((v) => ({ kind: 'invoice_no', value: v })));
  res.forEach((r) => { const [gross, pay] = want[r.ref.value]; const k = r.candidates[0]; assert.equal(r.status, 'matched', r.ref.value); assert.equal(k.grossAmount, gross); assert.equal(k.paymentStatus, pay); assert.equal(k.serverIdentifiedOrder, null); assert.equal(k.excluded, false); });
  assert.equal(res.find((r) => r.ref.value === '171-407890123168').candidates[0].outstanding, 131309453);
  assert.equal(res.find((r) => r.ref.value === '177-407980123168').candidates[0].sourceCancelled, true);
  assert.equal(ENTITIES.find((e) => e.en === res[0].candidates[0].amanahEn).ar, 'قطاع الإسكان');
});

await ok('scenario 1: three invoices, all matched with a full match (number · Amanah · amount) and selected; their total is the order amount', () => {
  const { c, rows } = reviewOf(SCN[0]); assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => rowState(r).kind === 'ready' && r.criteria.full && !r.partialMatch && rowFlags(r).length === 0), 'no flag on a clean match');
  const sel = selectionFor(rows); assert.equal(sel.length, 3); assert.equal(sel.reduce((t, x) => t + x.candidate.grossAmount, 0), 64155210); assert.equal(c.amount, 64155210);
  assert.deepEqual(rows.map((r) => r.origins.find((o) => o.docId).pages), [[2], [2], [3]]); assert.ok(rows.every((r) => r.origins.find((o) => o.docId).snippet.includes(r.value)));
});

await ok('scenario 2: D matches; the short number is flagged incomplete AND ambiguous; the unmatched number is flagged — partial confirmation leaves two pending', () => {
  const { c, rows, d } = reviewOf(SCN[1]); const by = Object.fromEntries(rows.map((r) => [r.value, r]));
  assert.equal(rowState(by['171-407850123186']).kind, 'ready'); assert.deepEqual(rowFlags(by['171-407850123186']).map((f) => f.key), ['amount_difference'], 'D alone is not the order total (E is still unresolved)');
  const serial = by['0000031']; assert.equal(rowState(serial).kind, 'ambiguous'); assert.equal(serial.candidates.length, 3); assert.deepEqual(rowFlags(serial).map((f) => f.key).sort(), ['ambiguous', 'incomplete']);
  assert.equal(rowState(by['171-407777777777']).kind, 'unmatched'); assert.deepEqual(rowFlags(by['171-407777777777']).map((f) => f.key), ['unmatched']);
  // confirm ONLY D (as the reviewer's selection does) through the existing reducers
  let store = recordDocument(emptyStore(), c.enforceNum, d, { by: 'R', at: AT, orderStatus: 'open' }).store;
  assert.equal(buildEffectiveCases([c], store)[0].links.length, 0, 'extraction alone creates no link');
  const r = confirmLink(store, c.enforceNum, '171-407850123186', { by: 'Reviewer A', at: AT, orderStatus: 'open', input: { invoiceId: '171-407850123186', origin: 'document_ocr_simulated', gross: 103790970, evidence: by['171-407850123186'].origins.map((o) => ({ refKind: 'invoice_no', refValue: '171-407850123186', origin: o.type, docId: o.docId, docName: o.docName, pages: o.pages, snippet: o.snippet })), conflicts: [], resolvedConflicts: [] } });
  assert.equal(r.error, null); const eff = buildEffectiveCases([c], r.store)[0];
  assert.deepEqual(eff.links.map((l) => [l.invoiceId, l.status]), [['171-407850123186', 'confirmed']]); assert.equal(eff.links[0].reviewedBy, 'Reviewer A'); assert.equal(eff.links[0].reviewedAt, AT);
  assert.ok(eff.links[0].evidence[0].docName === 'sanad-9100002.pdf' && eff.links[0].evidence[0].pages[0] === 2 && /171-407850123186/.test(eff.links[0].evidence[0].snippet), 'the link keeps the supporting document, page and passage');
  assert.deepEqual(unresolvedReferences(eff).map((x) => x.value).sort(), ['0000031', '171-407777777777'], 'the other two stay pending');
  assert.deepEqual(invoiceStatusMap([eff]), { '171-407850123186': 'open' });
});

await ok('scenario 3: another Amanah is a hard conflict that cannot be confirmed; the bare serial is ambiguous (two invoices); the amount differs from the order', () => {
  const { c, rows } = reviewOf(SCN[2]); const by = Object.fromEntries(rows.map((r) => [r.value, r]));
  assert.equal(rowState(by['171-407990123123']).kind, 'ready'); assert.ok(rowFlags(by['171-407990123123']).some((f) => f.key === 'amount_difference'), 'the order states 150,000,000; the matched invoice is 79,244,410');
  const other = by['177-408500122934']; assert.equal(rowState(other).kind, 'needs_evidence'); assert.ok(rowFlags(other).some((f) => f.key === 'amanah_mismatch' && f.tone === 'bad'));
  const amb = by['0000094']; assert.equal(rowState(amb).kind, 'ambiguous'); assert.equal(amb.candidates.length, 2); assert.deepEqual(rowFlags(amb).map((f) => f.key).sort(), ['ambiguous', 'incomplete']);
  assert.equal(selectionFor(rows).length, 0, 'a partial match (amount differs) is never preselected'); const all = Object.fromEntries(rows.flatMap((r) => (rowState(r).candidate ? [[rowState(r).candidate.invoiceId, true]] : []))); assert.deepEqual(selectionFor(rows, all).map((x) => x.candidate.invoiceId), ['171-407990123123'], 'even if everything is ticked only G can be selected');
  const store = recordDocument(emptyStore(), c.enforceNum, c.docs[0], { by: 'R', at: AT, orderStatus: 'open' }).store;
  assert.equal(confirmLink(store, c.enforceNum, '177-408500122934', { by: 'R', at: AT, orderStatus: 'open', input: { invoiceId: '177-408500122934', origin: 'x', gross: 70653160, conflicts: ['amanah_mismatch'], evidence: [] } }).error, 'unresolved_conflict', 'a reason never resolves another-Amanah');
  assert.equal(c.docs[0].extraction.statedAmount, 149897570);
});

await ok('scenario 5: the partly paid invoice F and the clean E are both matched; F shows its outstanding below the gross', () => {
  const { rows } = reviewOf(SCN.find((s) => s.id === 'sc5-retry')); const f = rows.find((r) => r.value === '171-407890123168').candidates[0];
  assert.deepEqual(rows.map((r) => rowState(r).kind), ['ready', 'ready']); assert.equal(f.paymentStatus, 'partial'); assert.equal(f.grossAmount, 190630970); assert.equal(f.outstanding, 131309453);
  assert.equal(selectionFor(rows).reduce((t, x) => t + x.candidate.grossAmount, 0), 241874670);
});

await ok('scenario 6: the cancelled invoice H is matched but flagged «cancelled in the source»; after confirmation the order link carries it', () => {
  const { c, rows } = reviewOf(SCN.find((s) => s.id === 'sc6-cancelled')); const h = rows[0];
  assert.equal(rowState(h).kind, 'ready'); assert.ok(rowFlags(h).some((f) => f.key === 'invoice_cancelled' && f.tone === 'bad')); assert.equal(h.candidates[0].sourceCancelled, true);
  const store = recordDocument(emptyStore(), c.enforceNum, c.docs[0], { by: 'R', at: AT, orderStatus: 'open' }).store;
  const r = confirmLink(store, c.enforceNum, '177-407980123168', { by: 'R', at: AT, orderStatus: 'open', input: { invoiceId: '177-407980123168', origin: 'x', gross: 77876290, conflicts: h.conflicts['177-407980123168'], evidence: [] } });
  assert.equal(r.error, null); assert.deepEqual(invoiceStatusMap(buildEffectiveCases([c], r.store)), { '177-407980123168': 'open' });
});

await ok('no link and no invoice status from extraction or proposals alone; nothing at all for an unread file', async () => {
  for (const sc of SCN) {
    const { c, d } = reviewOf(sc); const store = recordDocument(emptyStore(), c.enforceNum, d, { by: 'R', at: AT, orderStatus: 'open' }).store;
    const eff = buildEffectiveCases([c], store); assert.equal(eff[0].links.length, 0, sc.id); assert.deepEqual(invoiceStatusMap(eff), {}, sc.id); assert.equal(eff[0].docs.length, 1);
  }
  const { store } = fresh(); const junk = new TextEncoder().encode('%PDF-1.4 unread'); await attachUpload(store, R(1).enforceNum, { name: 'x.pdf', type: 'application/pdf', bytes: junk }, { by: 'R', at: AT });
  const r = await runExtraction(store, { orderId: R(1).enforceNum, record: R(1), at: AT }); assert.deepEqual(r.pages, []); assert.deepEqual(r.fields, []); // nothing to feed into the order: the panel only records completed simulated extractions
});

await ok('the review table labels: the confirm button and the effect sentence are exact', () => {
  const src = fs.readFileSync('src/components/revenue/OrderJourney.jsx', 'utf8');
  for (const t of ['تأكيد ربط الفواتير المحددة بأمر التنفيذ', 'Confirm the selected invoices’ link to the enforcement order', 'التأكيد وحده هو ما يطبّق الاستبعاد؛ الاستخراج أو الربط المقترح لا يؤثر في أي مبلغ']) assert.ok(src.includes(t), t);
});

console.log(`sanad docs: ${n} test groups passed`);
