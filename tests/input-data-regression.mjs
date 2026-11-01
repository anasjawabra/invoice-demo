import assert from 'node:assert/strict';
import { parseCsv, importRows, parseImportNumber, SAMPLE_CSV, SAMPLE_LINES_CSV } from '../src/data/ledgerImport.js';
import { checkRange } from '../src/data/dateRange.js';
import { loadStore } from '../server/store.js';
import { makeCtx, derive } from '../server/engine.js';
import { materialize } from '../server/materialize.js';
import { sourceRecord } from '../server/sourceRecords.js';
import { sourcesReport } from '../server/sourcesReport.js';
import { appendRecord } from '../server/fixtures.js';
const h = ['invoice_id', 'amanah', 'issue_date', 'amount'];
const row = (amount) => ['X', 'Riyadh Amanah', '2026-01-01', amount];
for (const value of ['1,2', '0x10', '1e9', '9007199254740993', '9007199254740991.1', '0.10000000000000001', '', '100abc', 'Infinity', 'NaN', '1,,000']) {
  const result = importRows([h, row(value)]); assert.equal(result.accepted.length, 0, value); assert.equal(result.validations.find((v) => v.id === 'amounts').ok, false, value);
}
for (const [value, expected] of [['1,234.56', 1234.56], ['١٬٢٣٤٫٥٦', 1234.56], ['۱۲۳٫۴۵', 123.45], ['00100.00', 100], ['0.0000001', 0.0000001], ['9007199254740991', Number.MAX_SAFE_INTEGER]]) assert.equal(parseImportNumber(value), expected, value);
assert.equal(importRows([h, row('-10')]).accepted.length, 0);
const paid = importRows([[...h, 'paid_amount', 'paid_date'], [...row('100'), '-1', '2026-01-02']]);
assert.equal(paid.validations.find((v) => v.id === 'amounts').count, 1);
const noPaymentDate = importRows([[...h, 'paid_amount'], [...row('100'), '10']]);
assert.equal(noPaymentDate.validations.find((v) => v.id === 'dates').ok, false);
assert.equal(importRows([[...h, 'currency'], [...row('100'), 'USD']]).accepted.length, 0);
assert.equal(importRows([[...h, 'currency'], [...row('100'), 'sar']]).accepted.length, 1);
assert.deepEqual(parseCsv('\uFEFFa,b\r\n"a""b","x\ny"\r\n'), [['a', 'b'], ['a"b', 'x\ny']]);
for (const csv of ['a,b\n"unfinished,b', 'a,b\n"finished"x,b', 'a,b\nunquoted"quote,b']) assert.throws(() => parseCsv(csv), /csv_quote/);
assert.throws(() => importRows([[...h, 'gross_amount'], [...row('100'), '200']]), /ambiguous_import_column:gross/);
assert.equal(importRows([[...h, 'sadad_number'], [...row('100'), '000123']]).accepted[0].sadadNo, '000123');
assert.equal(importRows([h, [...row('100'), 'shifted']]).validations.find((v) => v.id === 'columns').ok, false);
const lh = ['invoice_id', 'issue_date', 'invoice_value', 'line_no', 'line_amount'];
const line = (no, amount, total = '100', date = '2026-01-01') => ['L', date, total, no, amount];
for (const bad of ['bad', '', '-10', '1,2']) {
  const result = importRows([lh, line('1', '60'), line('2', bad)]); assert.equal(result.accepted.length, 0, bad); assert.equal(result.validations.find((v) => v.id === 'amounts').ok, false);
}
for (const rows of [[line('1', '60'), line('2', '40', '200')], [line('1', '60'), line('2', '40', '100', '2026-02-01')], [line('1', '60'), line('1', '40')]]) {
  const result = importRows([lh, ...rows]); assert.equal(result.accepted.length, 0); assert.equal(result.validations.find((v) => v.id === 'consistency').ok, false);
}
assert.equal(importRows([lh, line('1', '60'), line('', '40')]).accepted.length, 0);
const repeated = importRows([lh, line('1', '60'), line('1', '60'), line('2', '40')]);
assert.equal(repeated.accepted.length, 1); assert.equal(repeated.duplicateLines, 1); assert.equal(repeated.accepted[0].amountCheck.status, 'consistent');
const missingAmounts = importRows([lh.slice(0, 4), line('1', '60').slice(0, 4), line('2', '40').slice(0, 4)]);
assert.equal(missingAmounts.accepted[0].amountCheck.status, 'not_checkable'); assert.ok(missingAmounts.accepted[0].lineItems.every((l) => l.amount === null));
const merged = importRows([lh, ['L', '', '100', '1', '60'], ['L', '2026-01-01', '', '2', '40']]);
assert.equal(merged.accepted[0].issueDate, '2026-01-01');
assert.equal(importRows(parseCsv(SAMPLE_CSV)).accepted.length, 3); assert.equal(importRows(parseCsv(SAMPLE_LINES_CSV)).accepted.length, 2);
for (const month of ['00', '13', '99']) for (const day of ['00', '01', '31', '99']) {
  const date = `2026-${month}-${day}`; assert.doesNotThrow(() => checkRange({ from: date, to: date }, { today: '2026-10-25' })); assert.equal(checkRange({ from: date, to: date }, { today: '2026-10-25' }).code, 'incomplete');
}
assert.equal(checkRange({ from: '2025-02-29', to: '2025-03-01' }, { today: '2026-10-25' }).ok, false);
assert.equal(checkRange({ from: '2024-02-29', to: '2026-03-01' }, { today: '2026-10-25', start: '2024-01-01' }).ok, true);
const st = loadStore('2026-10-25', { size: 'compact' }); const ctx = makeCtx(st, { cfg: { cutoff: '2026-10-25' } });
const rec = materialize(st, 0, ctx); rec.lineItems = rec.lineItems.map((line) => ({ ...line, amount: null }));
const source = sourceRecord(st, 0, rec, derive(ctx, 0, ctx.cutoffN), '2026-10-25');
assert.equal(source.checks.revenueLines.sumOfDetailAmount, null); assert.equal(source.checks.revenueLines.sumEqualsInvoice, false);
console.log('Input data passed: exact decimal round-trip, localized digits, currencies, CSV syntax and columns, all invoice lines, duplicate conflicts, missing amounts, validation summaries and invalid calendar dates.');

const reportReq = { cfg: { cutoff: '2026-10-25' }, scope: { org: { amanahKeys: ['Riyadh Amanah'] } }, owner: 42 };
const beforeReport = sourcesReport(st, reportReq);
const imported = importRows([h, row('1234.56')]).accepted[0];
appendRecord(st, { ...imported, id: 'REPORT-OWN' }, { owner: 42, kind: 'upload' });
appendRecord(st, { ...imported, id: 'REPORT-OTHER' }, { owner: 43, kind: 'upload' });
appendRecord(st, { ...imported, id: 'REPORT-OUTSIDE', amanahEn: 'Jeddah Amanah' }, { owner: 42, kind: 'upload' });
const afterReport = sourcesReport(st, reportReq);
assert.ok(Object.values(beforeReport.reconcile).every(Boolean)); assert.ok(Object.values(afterReport.reconcile).every(Boolean));
assert.equal(afterReport.uploadsYtd, 1);
assert.ok(Math.abs(afterReport.totals.ytd.gross - beforeReport.totals.ytd.gross - 1234.56) < 0.01);
const none = sourcesReport(st, { ...reportReq, scope: { org: { amanahKeys: [] } } });
assert.equal(none.totals.ytd.count, 0); assert.equal(none.uploadsYtd, 0); assert.ok(none.sources.every((s) => s.allTime.invoices === 0));
assert.deepEqual(none.enforcement, { whiteLandsOrders: 0, sanadRequests: 0 }); assert.ok(Object.values(none.reconcile).every(Boolean));
console.log('Source coverage passed: own uploads reconcile, other sessions and institutions excluded, empty institution grants return no counts or amounts.');
