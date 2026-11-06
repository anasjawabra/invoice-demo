// Tests of the investment-contracts pages' data (list + details): contract/investor matching, what Payment.CONTRACTID references, repeated numbers and renewals, installments (partial / full / missing amounts),
// contract-level bill references (deduplicated, never tied to an installment), no double counting, municipality filter, subset markers and export consistency.
// Everything runs on SYNTHETIC exports written to a temp directory — no real record is used. Run with `npm run test:furas`.
import assert from 'node:assert/strict';
import nodeFs from 'node:fs';
import nodeOs from 'node:os';
import nodePath from 'node:path';
import { resetFuras, furasSummary, furasContracts, furasContract, FURAS_KEEP, BILL_PLACEHOLDER, OUTSIDE_SUBSET } from '../server/furasData.js';
import { contractsCsvRows, installmentsCsvRows, csvText } from '../src/data/furasExport.js';

let n = 0; const ok = async (name, fn) => { await fn(); n += 1; console.log('  ok  ' + name); };
const q = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
function makeDir(subset) {
  const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'furas-ct-'));
  const write = (view, rows) => { const heads = FURAS_KEEP[view]; const text = [heads.join(','), ...rows.map((r) => heads.map((h) => q({ source_pt: '20261025', etl_time: '2026-10-27 18:00:00', ...r }[h] ?? '')).join(','))].join('\r\n') + '\r\n'; nodeFs.writeFileSync(nodePath.join(dir, `ads_furas_schema_${view}_df_20261102.csv`), '﻿' + text); };
  const AP = 'Contract-Approved';
  write('contract', [
    { pzinskey: 'PZ-A1', contractnumber: 'CN-A', opportunitynumber: 'OA1', opportunityname: 'Name A', investorid: 'INV-1', contracttype: 'T1', opportunitystatus: AP, rentalstatus: 'started', startdate: '20200101', enddate: '20300101', contractvalue: '1000', annualcontractvalue: '100', totalcontractvaluewithvat: '1150', municipalityid: '001', municipality: 'M1', renewedcontractid: subset ? OUTSIDE_SUBSET : 'PZ-A2' },
    { pzinskey: 'PZ-A2', contractnumber: 'CN-A', opportunitynumber: 'OA2', opportunityname: 'Name A2', investorid: 'INV-1', contracttype: 'T1', opportunitystatus: AP, rentalstatus: 'started', startdate: '20200101', enddate: '20310101', contractvalue: '1000', annualcontractvalue: '100', municipalityid: '001', municipality: 'M1' },
    { pzinskey: 'PZ-B1', contractnumber: 'CN-B', opportunitynumber: 'OB1', opportunityname: 'Name B', investorid: 'INV-X', contracttype: 'T2', opportunitystatus: AP, rentalstatus: 'finished', contractvalue: '500', municipalityid: '002', municipality: 'M2' },
    { pzinskey: 'PZ-C1', contractnumber: 'CN-C', opportunitynumber: 'OC1', investorid: 'INV-1', contracttype: 'T1', opportunitystatus: AP, contractvalue: '70', municipalityid: '001', municipality: 'M1' },
    { pzinskey: 'PZ-C2', contractnumber: 'CN-C', opportunitynumber: 'OC1', investorid: 'INV-1', contracttype: 'T1', opportunitystatus: AP, contractvalue: '80', municipalityid: '001', municipality: 'M1' },
    { pzinskey: 'PZ-D1', contractnumber: 'CN-D', opportunitynumber: 'OD1', investorid: 'INV-1', contracttype: 'T1', opportunitystatus: 'Contract-Cancelled', contractvalue: '5', municipalityid: '001', municipality: 'M1' }]);
  write('payment', [
    { pyguid: 'G1', contractid: 'CN-A', opportunitynumber: 'OA1', investorid: 'INV-1', batchnumber: '1', batchyear: '2026', batchmonths: '12', batchstatus: 'Paid', paymenttype: 'Fixed', paymentduedate: '2026-01-01 00:00:00', invoicedate: '2026-01-02 00:00:00', paymentdate: '2026-01-05 00:00:00', paymentamount: '100', vatamount: '15', batchamountpaid: '100', batchamountbalance: '0', balanceamount: '999' },
    { pyguid: 'G2', contractid: 'CN-A', opportunitynumber: 'OA1', investorid: 'INV-1', batchnumber: '2', batchyear: '2027', batchstatus: 'New', paymentduedate: '2027-01-01 00:00:00', invoicedate: '2027-01-02 00:00:00', paymentamount: '100', batchamountpaid: '40', batchamountbalance: '60' },
    { pyguid: 'G3', contractid: 'CN-A', opportunitynumber: 'OA1', investorid: 'INV-1', batchnumber: '3', batchyear: '2090', batchstatus: 'New', paymentduedate: '2090-01-01 00:00:00', paymentamount: '100' },
    { pyguid: 'G4', contractid: 'CN-A', opportunitynumber: 'OA2', investorid: 'INV-1', batchnumber: '1', batchyear: '2026', batchstatus: 'New', paymentduedate: '2026-06-01 00:00:00' },
    { pyguid: 'G5', contractid: 'PZ-A1', opportunitynumber: 'OA1', investorid: 'INV-1', batchnumber: '9', batchyear: '2026', batchstatus: 'New', paymentamount: '777' }]); // CONTRACTID holding a record KEY, not a number: it must not attach to anything
  write('contractmanagement', [
    { pyid: 'C1', pylabel: 'Manual Contract', contractnumber: 'CN-A', opportunitynumber: 'OA1', sadadbillnumber: '10-20-300001' },
    { pyid: 'C2', pylabel: 'Manual Contract', contractnumber: 'CN-D', opportunitynumber: 'OA1', sadadbillnumber: '10-20-300003' }, // names ANOTHER number: never attached to CN-A although the opportunity number matches
    { pyid: 'C3', pylabel: 'Manual Contract', contractnumber: 'CN-B', sadadbillnumber: BILL_PLACEHOLDER }]);
  write('entitymanagement', [{ pyid: 'E1', pylabel: 'Entity Contract', contractnumber: 'CN-A', sadadbillnumber: '10-20-300001' }]); // the same bill as C1: one bill, two views
  write('imsfw_work', [{ pzinskey: 'W1', pycasename: 'Appeal', opportunitynumber: 'OA2', sadadbillnumber: '10-20-300002' }]);
  write('investor', [{ investorid: 'INV-1' }, { investorid: 'INV-2' }]);
  if (subset) nodeFs.writeFileSync(nodePath.join(dir, 'subset.json'), JSON.stringify({ kind: 'subset', contracts: 5 }));
  return dir;
}
const withDir = async (dir, fn, scope = '') => { const o = { d: process.env.FURAS_EXPORT_DIR, s: process.env.FURAS_STATUS_SCOPE, v: process.env.VERCEL }; process.env.FURAS_EXPORT_DIR = dir; process.env.FURAS_STATUS_SCOPE = scope; delete process.env.VERCEL; resetFuras(); try { return await fn(); } finally { for (const [k, v] of [['FURAS_EXPORT_DIR', o.d], ['FURAS_STATUS_SCOPE', o.s], ['VERCEL', o.v]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } resetFuras(); } };
const full = makeDir(false); const sub = makeDir(true);

await ok('contract numbers: a number is not a record key — repeated numbers keep every record, and a number never multiplies the installments', () => withDir(full, async () => {
  const L = await furasContracts({ all: true }); assert.equal(L.total, 4, 'four distinct numbers: CN-A, CN-B, CN-C, CN-D'); const a = L.rows.find((r) => r.no === 'CN-A'); assert.equal(a.records, 2); assert.equal(a.opportunities, 2);
  const d = await furasContract('CN-A'); assert.equal(d.recordCount, 2); assert.equal(d.payments.rows.length, 4, 'four actual Payment rows, listed once — not 4 × 2 records'); assert.equal(d.currentRecordDetermined, false);
  const c = L.rows.find((r) => r.no === 'CN-C'); assert.equal(c.contractValue.state, 'conflict', 'two records of one number disagree on the value: no value is chosen and nothing is summed'); assert.equal(c.contractValue.value, null);
}));

await ok('Payment.CONTRACTID is the contract NUMBER: a row naming a record key is not attached to any contract', () => withDir(full, async () => {
  const d = await furasContract('CN-A'); assert.ok(!d.payments.rows.some((p) => p.payable === 777), 'the row whose CONTRACTID is a record key is not listed under CN-A');
  const S = await furasSummary(); assert.equal(S.payments.numbersNotFound, 1, 'it is counted as an unmatched number'); assert.equal(S.payments.rowsNotFound, 1);
  assert.deepEqual(d.payments.rows.filter((p) => p.opportunityNumber === 'OA1').map((p) => p.batchNumber), [1, 2, 3], 'installments are ordered by batch within an opportunity');
}));

await ok('installments: payable, paid, outstanding and VAT are separate stored fields; empty means not available — never zero, never unpaid; BALANCEAMOUNT is not exposed', () => withDir(full, async () => {
  const p = (await furasContract('CN-A')).payments.rows; const by = (o, b) => p.find((x) => x.opportunityNumber === o && x.batchNumber === b);
  const full1 = by('OA1', 1); assert.deepEqual([full1.payable, full1.vatAmount, full1.paid, full1.outstanding], [100, 15, 100, 0], 'fully paid: paid = payable, outstanding 0 (BATCHAMOUNTBALANCE), VAT beside the payable — not added');
  const part = by('OA1', 2); assert.deepEqual([part.payable, part.paid, part.outstanding], [100, 40, 60], 'partly paid'); assert.equal(part.vatAmount, null, 'an empty VAT is not zero');
  const bare = by('OA1', 3); assert.deepEqual([bare.paid, bare.outstanding], [null, null], 'no paid / outstanding value: not available, not 0'); assert.equal(by('OA2', 1).payable, null, 'a missing payable amount stays missing');
  assert.ok(p.every((x) => !('balance' in x) && !('balanceAmount' in x)), 'BALANCEAMOUNT is not exposed'); assert.equal(by('OA1', 1).status, 'Paid', 'the source status is returned as stored, not interpreted');
  assert.equal(by('OA1', 3).dueDate, '2090-01-01', 'a future due date is a normal installment, not a flagged date'); assert.deepEqual(by('OA1', 3).dateFlags, {});
}));

await ok('no double counting: the same installment is never listed under two opportunities, and amounts are never summed or joined to contract values', () => withDir(full, async () => {
  const d = await furasContract('CN-A'); const guids = d.payments.rows.map((r) => JSON.stringify([r.opportunityNumber, r.batchNumber, r.batchYear])); assert.equal(new Set(guids).size, guids.length);
  assert.ok(!/total|sum|collected|rate/i.test(JSON.stringify(Object.keys(d.payments)) + JSON.stringify(Object.keys(d.payments.rows[0]))), 'no derived total or rate');
}));

await ok('investor: joined by INVESTORID only; masked; the name is not read; an id missing from the Investor view is reported, not hidden', () => withDir(full, async () => {
  const L = await furasContracts({ all: true }); const a = L.rows.find((r) => r.no === 'CN-A'); const b = L.rows.find((r) => r.no === 'CN-B');
  assert.deepEqual(a.investors.map((i) => i.found), [true]); assert.deepEqual(b.investors.map((i) => i.found), [false], 'INV-X is not in the Investor view');
  assert.ok(a.investors[0].masked.startsWith('•') && !JSON.stringify(L).includes('INV-1'), 'only the masked reference leaves the server');
  const d = await furasContract('CN-B'); assert.equal(d.investor.nameAvailable, false); assert.ok(!JSON.stringify(d).includes('INV-X'));
}));

await ok('contract-level bills: listed once per distinct bill across the three views, never tied to an installment, never taken from a row that names another contract', () => withDir(full, async () => {
  const a = (await furasContract('CN-A')).bills; assert.deepEqual(a.refs.map((r) => r.number), ['10-20-300001', '10-20-300002'], 'the bill in ContractManagement and EntityManagement is ONE bill; the opportunity-only IMSFW_Work row is attached via its opportunity number');
  assert.deepEqual(a.refs[0].views.sort(), ['ContractManagement', 'EntityManagement']); assert.equal(a.installmentLink, 'unavailable'); assert.ok(!a.refs.some((r) => r.number === '10-20-300003'), 'a row naming CN-D is not CN-A\'s');
  assert.ok((await furasContract('CN-A')).payments.rows.every((p) => !('sadadBillNumber' in p) && !('billNumber' in p)), 'no installment carries a bill number');
  const b = (await furasContract('CN-B')).bills; assert.equal(b.refs.length, 0); assert.equal(b.numbersNotRetained, 1, 'a placeholder is counted, never shown as a bill number');
  assert.equal((await furasContract('CN-C')).bills.refs.length, 0);
}));

await ok('statuses stay separate: approval status, execution status and installment status are different fields', () => withDir(full, async () => {
  const r = (await furasContract('CN-A')).records[0]; assert.equal(r.status, 'Contract-Approved'); assert.equal(r.rentalStatus, 'started'); assert.equal((await furasContract('CN-A')).payments.rows[0].status, 'Paid');
  const L = await furasContracts({ filter: { rental: 'finished' } }); assert.deepEqual(L.rows.map((x) => x.no), ['CN-B'], 'the execution-status filter reads RENTALSTATUS');
}));

await ok('scope and filters: approved contracts only by default; Amanah, search by number / opportunity number / name', () => withDir(full, async () => {
  assert.equal((await furasContracts({})).total, 3, 'the cancelled record\'s number (CN-D) is out of scope'); assert.equal((await furasContracts({ filter: { municipality: '002' } })).rows.map((r) => r.no).join(), 'CN-B');
  assert.equal((await furasContracts({ q: 'oa2' })).rows.map((r) => r.no).join(), 'CN-A', 'by opportunity number'); assert.equal((await furasContracts({ q: 'name b' })).rows.map((r) => r.no).join(), 'CN-B', 'by opportunity name'); assert.equal((await furasContracts({ q: 'zzz' })).total, 0);
}, 'Contract-Approved'));

await ok('dates and values: as stored; records that disagree are marked, not chosen', () => withDir(full, async () => {
  const L = await furasContracts({ all: true }); const a = L.rows.find((r) => r.no === 'CN-A'); assert.equal(a.start.value, '2020-01-01'); assert.equal(a.end.state, 'differs'); assert.equal(a.end.value, null);
  assert.equal(a.contractValue.value, 1000); assert.equal(a.annualValue.value, 100); assert.equal(a.valueWithVat.value, 1150, 'total, annual and VAT-inclusive are separate fields, none derived from another');
  assert.equal(L.rows.find((r) => r.no === 'CN-B').start.state, 'none');
}));

await ok('subset markers: a renewal link to a record outside the subset keeps the marker and is not resolved', () => withDir(sub, async () => {
  const d = await furasContract('CN-A'); assert.deepEqual(d.records[0].renewalLink, { resolved: false, outsideSubset: true }); const S = await furasSummary(); assert.equal(S.dataset.subset.contracts, 5);
}));
await ok('a full export has no subset marker and resolves a link between its own records', () => withDir(full, async () => {
  const d = await furasContract('CN-A'); assert.equal(d.records[0].renewalLink.resolved, true); assert.equal((await furasSummary()).dataset.subset, null);
}));

await ok('exports carry what the pages show: the same rows, the same values, unavailable = empty (never 0), investor masked', () => withDir(full, async () => {
  const L = await furasContracts({ all: true }); const rows = contractsCsvRows(L.rows); assert.equal(rows.length, L.rows.length + 1); assert.equal(rows[0].length, rows[1].length);
  const a = rows.find((r) => r[0] === 'CN-A'); assert.equal(a[6], 1000); assert.equal(a[5], '', 'differing end dates are not exported as a value'); const b = rows.find((r) => r[0] === 'CN-B'); assert.equal(b[7], '', 'no annual value → empty cell, not 0');
  assert.ok(!csvText(rows).includes('INV-'), 'no raw investor id'); const ar = contractsCsvRows(L.rows, true); assert.notEqual(ar[0][0], rows[0][0]);
  const pays = (await furasContract('CN-A')).payments.rows; const ir = installmentsCsvRows(pays); assert.equal(ir.length, pays.length + 1);
  const r1 = ir.find((r) => r[1] === 1 && r[0] === 'OA1'); assert.deepEqual([r1[9], r1[10], r1[11], r1[12]], [100, 15, 100, 0]); const r3 = ir.find((r) => r[1] === 3); assert.deepEqual([r3[11], r3[12]], [null, null]); assert.ok(csvText(ir).startsWith('﻿'));
  assert.ok(!ir[0].join().includes('BALANCEAMOUNT'));
}));

await ok('the pages show no AI, data-source, schema, quality or diagnostic section, and no technical record key or column code', () => {
  const read = (f) => nodeFs.readFileSync(f, 'utf8'); const pages = ['src/pages/furas/FurasContracts.jsx', 'src/pages/furas/FurasContract.jsx'].map(read).join('\n');
  for (const bad of ['FurasDecisionRoom', 'DatasetBanner', 'IntegrityChecks', 'LimitsPanel', 'FurasOverview', 'Data requests', 'recordKey', 'COL[', 'fu-col']) assert.ok(!pages.includes(bad), `no «${bad}» on the contract pages`);
  assert.ok(pages.includes('Installment link unavailable') && pages.includes('No linked invoice found in the available data'));
  assert.ok(!/Invoice not issued/i.test(pages), '«invoice not issued» needs evidence the data does not give');
});

console.log(`\n${n} furas-contracts tests passed`);
