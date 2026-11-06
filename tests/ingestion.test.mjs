// Tests of the source-ingestion layer (Sanad / Eefaa / Mumtathil; records are read from the Data Bank, no Excel upload): identifier and date normalisation, header detection, validation, repeat reads, revisions, provenance, the store, the Sanad adapter.
// Only SYNTHETIC rows are used. Run with `npm run test:ingestion`.
import assert from 'node:assert/strict';
import { normalizeIdentifier, normalizeDate, normalizeAmount } from '../src/data/ingestion/ids.js';
import { REPORTS, detectReport, reportById, METHODS, SOURCES } from '../src/data/ingestion/reports.js';
import { importRows, tableFromObjects, hashText } from '../src/data/ingestion/importer.js';
import { syntheticTables, vNo } from '../src/data/ingestion/synthetic.js';
import { createSourceStore, memoryBackend } from '../src/data/ingestion/store.js';
import { sanadRecordToCase, sanadCaseKey } from '../src/data/ingestion/sanadCases.js';
import { adaptSourceCase } from '../src/data/sanadSource.js';
import { SANAD_SCENARIO_ROWS } from '../src/data/sanadDocs/scenarioRecords.js';
import { ENTITIES } from '../src/data/catalog.js';
const S1 = SANAD_SCENARIO_ROWS[0]; const S1_AMOUNT = S1['المبلغ']; const S1_STATUS = S1['حالة الرفع للتنفيذ']; const S1_AMANAH_EN = ENTITIES.find((e) => e.ar === S1['الأمانة'])?.en; // the first synthetic scenario record (owned by the document workflow)

let n = 0; const ok = async (name, fn) => { try { await fn(); } catch (e) { console.error(`FAIL  ${name}`); throw e; } n += 1; };
const T = syntheticTables(); const N_SANAD = T['sanad.qadaya_view'].rows.length; const NOW = '2026-11-05T10:00:00.000Z'; // N_SANAD: the synthetic Sanad rows (scenario records + generated ones)
const imp = (id, o = {}) => importRows({ ...T[id], reportId: id, file: { name: `${id}.xlsx`, sha256: 'x' }, now: NOW, ...o });

await ok('identifiers stay exact strings: a 14-digit numeric cell keeps every digit, a string keeps its leading zeros, nothing is padded or repaired', () => {
  const a = normalizeIdentifier(99000000000001, { kind: 'numeric', expectedLength: 14 }); assert.equal(a.value, '99000000000001'); assert.equal(a.usable, true); assert.equal(typeof a.value, 'string');
  const b = normalizeIdentifier('0001234', { kind: 'numeric' }); assert.equal(b.value, '0001234'); assert.equal(b.usable, true);
  const c = normalizeIdentifier(1234, { kind: 'numeric', expectedLength: 14 }); assert.equal(c.value, '1234'); assert.ok(c.flags.includes('shorter_than_expected')); // flagged, NOT padded
});
await ok('damaged or ambiguous identifiers are flagged and unusable: rounded scientific notation, > 15 digits, non-numeric, placeholder; an exact notation is recovered but flagged', () => {
  const rounded = normalizeIdentifier('9.9E+13'); assert.equal(rounded.usable, false); assert.equal(rounded.value, null); assert.equal(rounded.raw, '9.9E+13'); assert.ok(rounded.flags.includes('damaged_scientific_notation'));
  const exact = normalizeIdentifier('9.9000000000001E+13'); assert.equal(exact.value, '99000000000001'); assert.equal(exact.usable, true); assert.ok(exact.flags.includes('recovered_from_scientific_notation'));
  const big = normalizeIdentifier(1234567890123456); assert.equal(big.usable, false); assert.ok(big.flags.includes('excel_precision_risk'));
  assert.ok(normalizeIdentifier('12AB45').flags.includes('non_numeric')); assert.ok(normalizeIdentifier('---').flags.includes('placeholder')); assert.ok(normalizeIdentifier(12.5).flags.includes('non_integer'));
  assert.equal(normalizeIdentifier('', {}).usable, false);
});
await ok('dates: Excel serials convert (whole day and fractional), an ambiguous day/month text date is NOT guessed, an unambiguous one is read, placeholders flagged', () => {
  assert.equal(normalizeDate(46056).value, "2026-02-03"); assert.equal(normalizeDate(46056.5).value, "2026-02-03 12:00");
  assert.equal(normalizeDate('3/2/2026').value, null); assert.deepEqual(normalizeDate('3/2/2026').flags, ['ambiguous_date']);
  assert.equal(normalizeDate('25/2/2026').value, '2026-02-25'); assert.equal(normalizeDate('2026-02-25').value, '2026-02-25'); assert.deepEqual(normalizeDate('---').flags, ['placeholder']);
  assert.equal(normalizeAmount('1,250.50').value, 1250.5); assert.deepEqual(normalizeAmount('abc').flags, ['invalid_amount']);
});
await ok('headers are matched by NAME: every synthetic table is detected as its own report, in any column order; the Eefaa views are told apart', () => {
  for (const r of REPORTS) { const t = T[r.id]; assert.equal(detectReport(t.headers).report?.id, r.id, r.id); const rev = [...t.headers].reverse(); assert.equal(detectReport(rev).report?.id, r.id, `${r.id} reversed`); }
  assert.equal(REPORTS.filter((r) => r.source === 'eefaa').length, 5); assert.deepEqual(Object.keys(SOURCES), ['sanad', 'eefaa', 'mumtathil']);
});
await ok('an unknown or incomplete header row is rejected as a whole, naming the missing columns — nothing is guessed', () => {
  const r = importRows({ headers: ['a', 'b'], rows: [[1, 2]], now: NOW }); assert.equal(r.ok, false); assert.equal(r.error, 'header_mismatch');
  const partial = importRows({ headers: T['mumtathil.report'].headers.filter((h) => h !== 'رقم سداد'), rows: [], now: NOW }); assert.equal(partial.ok, false); assert.ok(partial.detail.missing.includes('رقم سداد'));
});
await ok('the records are READ FROM THE DATA BANK (no upload): the Data Bank is the available method, Excel is retired and refused; the method is separate from the business source', () => {
  assert.equal(METHODS.data_bank.available, true); assert.equal(METHODS.excel.available, false); assert.equal(METHODS.direct, undefined);
  const r = imp('sanad.qadaya_view', { method: 'excel' }); assert.equal(r.ok, false); assert.equal(r.error, 'method_unavailable');
  const rec = imp('sanad.qadaya_view').upserts[0]; assert.equal(rec.source, 'sanad'); assert.equal(rec.ingestion.method, 'data_bank', 'the default (and only) method is the Data Bank read'); assert.ok(!rec.id.includes('data_bank'), 'the record identity does not contain the method');
});
await ok('a Sanad import: every row accepted, provenance kept (original raw values, source status verbatim, import time, mapping version, file), personal fields marked', () => {
  const r = imp('sanad.qadaya_view'); assert.equal(r.ok, true); assert.equal(r.batch.rows, N_SANAD); assert.equal(r.batch.created, N_SANAD); assert.equal(r.rejected.length, 0);
  const rec = r.upserts.find((x) => x.keyValue === '9100001'); assert.equal(rec.id, 'sanad.qadaya_view|requestNo|9100001'); assert.equal(rec.ingestion.importedAt, NOW); assert.equal(rec.ingestion.mappingId, 'sanad.qadaya_view'); assert.equal(rec.ingestion.mappingVersion, 1);
  assert.equal(rec.fields.statusText.value, S1_STATUS); assert.equal(rec.fields.requestNo.raw, '9100001'); assert.equal(rec.fields.employeeName.personal, true);
  assert.equal(rec.fields.enforcementNo.label, 'رقم الانفاذ'); // the original label is kept
  const damaged = r.upserts.filter((x) => x.fields.claimNo.flags.includes('damaged_scientific_notation')); assert.ok(damaged.length >= 1, 'a damaged claim number is flagged'); assert.equal(damaged[0].fields.claimNo.value, null); assert.equal(damaged[0].fields.claimNo.raw, '9.2E+11');
});
await ok('validation: a repeated key inside one file is rejected with its row numbers; a damaged key is rejected; an alternate key is used only where the report declares one', () => {
  const t = T['mumtathil.report']; const dup = importRows({ headers: t.headers, rows: [...t.rows, t.rows[0]], now: NOW }); assert.equal(dup.rejected.length, 1); assert.equal(dup.rejected[0].reason, 'duplicate_key_in_file'); assert.equal(dup.rejected[0].rowNumber, t.rows.length + 2); assert.equal(dup.rejected[0].detail.identicalContent, true);
  const bad = tableFromObjects(t.headers, [{ 'معرف الحالة': 'not a key', 'رقم سداد': 1, 'اسم أمانة': 'x' }]); const r1 = importRows({ ...bad, now: NOW }); assert.equal(r1.rejected[0].reason, 'unusable_key');
  const gen = imp('eefaa.general'); const damagedKey = gen.upserts.find((x) => x.keyField === 'businessRef'); assert.ok(damagedKey, 'the row whose violation number is damaged is keyed by the business reference'); assert.ok(damagedKey.flags.includes('key_from_alternate')); assert.ok(damagedKey.flags.includes('damaged_identifier:violationNo'));
  const v2 = imp('eefaa.v2_tahseel'); assert.equal(v2.upserts.filter((x) => x.keyField === 'sadadNo').length, 1);
  const refExec = imp('eefaa.executed_against'); assert.equal(refExec.rejected.length, 0);
});
await ok('importing the same file again creates nothing; changed content becomes a revision that keeps the previous values; an unchanged row is not rewritten', () => {
  const first = imp('sanad.qadaya_view'); const existing = new Map(first.upserts.map((r) => [r.id, r]));
  const again = imp('sanad.qadaya_view', { existing, now: '2026-11-06T10:00:00.000Z' }); assert.equal(again.upserts.length, 0); assert.equal(again.batch.unchanged, N_SANAD); assert.equal(again.batch.created, 0);
  const t = T['sanad.qadaya_view']; const amountCol = t.headers.indexOf('المبلغ'); const rows2 = t.rows.map((r) => r.slice()); rows2[0][amountCol] = 99999;
  const changed = importRows({ headers: t.headers, rows: rows2, existing, now: '2026-11-07T10:00:00.000Z' }); assert.equal(changed.batch.revised, 1); assert.equal(changed.upserts.length, 1);
  const rec = changed.upserts[0]; assert.equal(rec.fields.amount.value, 99999); assert.equal(rec.revisions.length, 1); assert.equal(rec.revisions[0].fields.amount.value, S1_AMOUNT); assert.equal(rec.firstImportedAt, NOW); assert.equal(rec.lastImportedAt, '2026-11-07T10:00:00.000Z');
});
await ok('the store keeps records, batches and an append-only review history; clearing imported records keeps the reviews', async () => {
  const store = createSourceStore(memoryBackend()); const r = imp('mumtathil.report'); await store.commit(r); assert.equal((await store.records()).length, 7); assert.equal((await store.batches()).length, 1);
  assert.equal((await store.recordMap()).size, 7); await store.putReview({ id: 'r1', kind: 'relation', subject: 's', decision: 'confirmed', by: 'A', at: NOW }); await store.putReview({ id: 'r2', kind: 'relation', subject: 's', decision: 'rejected', by: 'B', at: NOW });
  await store.commit(imp('mumtathil.report', { existing: await store.recordMap(), now: '2026-11-06T10:00:00.000Z' })); assert.equal((await store.records()).length, 7, 're-import adds nothing'); assert.equal((await store.batches()).length, 2);
  await store.resetSynthetic(); assert.equal((await store.records()).length, 0); assert.equal((await store.reviews()).length, 2);
});
await ok('an imported Sanad record becomes a case keyed SND-<request no.>, keeping the source fields, the status verbatim and the provenance; adaptSourceCase leaves it untouched; a damaged number is never a usable reference', () => {
  const recs = imp('sanad.qadaya_view').upserts; const c = sanadRecordToCase(recs.find((x) => x.keyValue === '9100001'));
  assert.equal(c.enforceNum, sanadCaseKey('9100001')); assert.equal(c.enforceNum, 'SND-9100001'); assert.equal(c.system, 'sanad'); assert.equal(c.amount, S1_AMOUNT); assert.equal(c.source.statusText, S1_STATUS); assert.equal(c.amanahEn, S1_AMANAH_EN);
  assert.equal(c.ingestion.method, 'data_bank'); assert.equal(c.ingestion.recordId, 'sanad.qadaya_view|requestNo|9100001'); assert.equal(adaptSourceCase(c), c, 'the source fields supplied by the import are not regenerated');
  assert.equal(c.requestStatus, 'قيد التنفيذ', 'only a status the source writes as «مغلق…» is a stated closure'); assert.deepEqual(c.refs, [], 'the structured invoice number of scenario 1 is empty (the real extract captures at most one): the invoices come from the document');
  const closed = recs.map(sanadRecordToCase).filter((x) => x.requestStatus === 'مغلق'); for (const k of closed) assert.ok(/^\s*مغلق/.test(k.source.statusText));
  const dmg = recs.map(sanadRecordToCase).find((x) => x.source.claimNoRaw); assert.ok(dmg); assert.equal(dmg.source.claimNo, ''); assert.equal(dmg.source.claimNoRaw, '9.2E+11');
});
await ok('synthetic data stays synthetic: identifiers sit in the invented ranges and the row hash is deterministic', () => {
  for (const r of imp('eefaa.executed_against').upserts) assert.ok(r.keyValue.startsWith('99'), 'synthetic violation numbers start 99');
  for (const r of imp('sanad.qadaya_view').upserts) assert.ok(r.keyValue.startsWith('91'), 'synthetic request numbers start 91');
  assert.equal(hashText('abc'), hashText('abc')); assert.notEqual(hashText('abc'), hashText('abd'));
  assert.equal(JSON.stringify(syntheticTables()), JSON.stringify(syntheticTables()), 'the synthetic generator is deterministic');
});
console.log(`ingestion: ${n} test groups passed`);
