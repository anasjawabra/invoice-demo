// FURAS DATASET MODE — a LOCAL-ONLY read of the six Databank exports of the Furas schema, kept apart from the generated demo world.
//
// Privacy and deployment rules (enforced here and by tests):
//   · the exports are read from a directory on this machine (env FURAS_EXPORT_DIR, or the one-line file `furas-exports.local`, which is git-ignored); nothing is copied into the repository
//   · the mode is OFF when neither is set, and always OFF on Vercel — the deployed function can never serve it
//   · only non-personal columns are kept in memory (see KEEP); investor names, e-mail, mobile, national/unified ids and commercial-record numbers are never read
//   · nothing is written to disk and no value is logged; investor ids are masked in every answer
//   · the answers carry only what the exports contain: no schedule, date, invoice link, collected amount or unpaid balance is generated here
import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from './furasCsv.js';
import { normalizeAccess } from './accessMask.js';

const KEEP = {
  contract: ['pzinskey', 'contractnumber', 'opportunitynumber', 'investorid', 'contracttype', 'opportunitystatus', 'rentalstatus', 'renewalstatus', 'renewedcontractid', 'awardingdate', 'signingdate', 'startdate', 'enddate',
    'dateofsitehandover', 'dateofsitehandoveractual', 'contractvalue', 'calculatedcontractvalue', 'annualcontractvalue', 'totalcontractvaluewithvat', 'contractterm', 'contractdurationmonths', 'municipalityid', 'municipality',
    'submunicipalityid', 'submunicipality', 'opportunityname', 'primarycontractid', 'source_pt', 'etl_time'],
  payment: ['pyguid', 'contractid', 'opportunitynumber', 'investorid', 'batchnumber', 'batchyear', 'batchstatus', 'paymenttype', 'methodofcollectingpayments', 'batchmonths', 'paymentduedate', 'batchenddate', 'invoicedate',
    'paymentdate', 'paymentamount', 'balanceamount', 'contractvalue', 'ps_contractvalue_annual', 'vatamount', 'batchamountpaid', 'batchamountbalance', 'municipalityid', 'submunicipalityid', 'pxcreatedatetime', 'source_pt', 'etl_time'],
  contractmanagement: ['pyid', 'pylabel', 'pystatuswork', 'contractnumber', 'opportunitynumber', 'investorid', 'municipalityid', 'sadadbillnumber', 'source_pt', 'etl_time'],
  entitymanagement: ['pyid', 'pylabel', 'contractnumber', 'opportunitynumber', 'sadadbillnumber', 'source_pt', 'etl_time'],
  imsfw_work: ['pzinskey', 'pycasename', 'contractnumber', 'opportunitynumber', 'sadadbillnumber', 'source_pt', 'etl_time'],
  investor: ['investorid', 'source_pt']
};
export const FURAS_KEEP = KEEP; // the only columns ever read (tests assert nothing else is kept)
const VIEW_NAME = { contract: 'Contract', payment: 'Payment', contractmanagement: 'ContractManagement', entitymanagement: 'EntityManagement', imsfw_work: 'IMSFW_Work', investor: 'Investor' };
const SCHEMA_COLS = { contract: 38, payment: 31, contractmanagement: 28, entitymanagement: 32, imsfw_work: 54, investor: 8 }; // business-schema columns; the files carry two more (SOURCE_PT, ETL_TIME)
export const OUTSIDE_SUBSET = 'OUTSIDE-SUBSET'; // set by scripts/make-furas-subset.py on a renewal link whose target record is not in the subset (honoured only when the directory has a subset.json)
// SCOPE (a business rule): only APPROVED contracts are shown, because the contract pages exist to be read together with invoices.
// «Approved» = the stored contract status below, taken literally; FURAS_STATUS_SCOPE overrides it ('' or 'all' turns the scope off). Rows that belong only to other contracts are outside the scope too.
export const APPROVED_STATUS = 'Contract-Approved';
export const scopeStatus = () => { const v = process.env.FURAS_STATUS_SCOPE; return v === undefined ? APPROVED_STATUS : (v === '' || v.toLowerCase() === 'all' ? null : v); };
export const BILL_PLACEHOLDER = '00-00-000000'; // the subset builder keeps only the «filled» pattern of a bill number: such a value is a placeholder, never a bill number
const CAP = 10000; // a file with exactly this many rows is treated as a capped sample (the cap rule itself is not documented)
const FLAGGED_MUNICIPALITIES = new Set(['002']); // the data's wording differs from the generated demo's («أمانة العاصمة المقدسة» vs «أمانة منطقة مكة المكرمة»): entity scope to be confirmed

/* ---------------------------------------------------------------------------------------------- configuration */
export function furasDir() {
  if (process.env.VERCEL) return null;
  let d = process.env.FURAS_EXPORT_DIR || null;
  if (!d) { try { d = fs.readFileSync(path.join(process.cwd(), 'furas-exports.local'), 'utf8').trim() || null; } catch { d = null; } }
  try { return d && fs.statSync(d).isDirectory() ? d : null; } catch { return null; }
}
function findFiles(dir) {
  const out = {};
  for (const f of fs.readdirSync(dir).sort()) { const m = /^ads_furas_schema_(contract|payment|contractmanagement|entitymanagement|imsfw_work|investor)_df_(\d+)\.csv$/.exec(f); if (m) out[m[1]] = path.join(dir, f); } // the latest file of each view (sorted names, last wins)
  return out;
}
// light check — never reads the files
export function furasAvailable() {
  const dir = furasDir(); if (!dir) return { available: false, reason: process.env.VERCEL ? 'deployment' : 'not_configured' };
  const files = findFiles(dir); const missing = Object.keys(KEEP).filter((k) => !files[k]);
  return missing.length ? { available: false, reason: 'incomplete' } : { available: true, reason: null };
}

// GEOGRAPHIC ACCESS. A Furas record names its entity only through the source MUNICIPALITYID / MUNICIPALITY (the Amanah-level entity of the contract), and the mapping of those codes to the Amanahs and
// municipalities of the verified hierarchy is NOT confirmed (see FLAGGED_MUNICIPALITIES / `confirm_entity_scope`). Nothing can therefore be attributed to a geographic scope with certainty, so the dataset is served
// ONLY to a user whose `contracts.view` access is «all Amanahs and municipalities»; any narrower access reads it as unavailable (fail closed — never a partial or guessed attribution).
export const furasAccessAllowed = (access) => normalizeAccess(access).all === true;
export const furasAvailableFor = (access) => (furasAccessAllowed(access) ? furasAvailable() : { available: false, reason: 'geo_scope_unmapped' });

/* ---------------------------------------------------------------------------------------------- helpers */
const num = (s) => { if (s == null) return null; const v = Number(s); return Number.isFinite(v) ? v : null; };
export const dateOnly = (s) => { if (s == null) return null; if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s; };
// field-specific date checks: a future DUE date is legitimate and never flagged; implausible years are flagged «to validate» and shown as stored (nothing is converted from Hijri)
export function dateFlag(s, extractIso, { noFuture = false } = {}) {
  const d = dateOnly(s); if (d == null) return null; const y = Number(d.slice(0, 4)); if (!Number.isFinite(y)) return 'unreadable';
  if (y >= 1300 && y <= 1500) return 'hijri_like'; if (y < 1900) return 'out_of_range'; if (y === 1970) return 'epoch'; if (y > 2100) return 'out_of_range';
  if (noFuture && /^\d{4}-\d{2}-\d{2}$/.test(d) && d > extractIso) return 'after_extract';
  return null;
}
export const maskId = (s) => (s == null ? null : String(s).length <= 4 ? '••••' : '•'.repeat(Math.min(8, String(s).length - 4)) + String(s).slice(-4));
const tail = (s, n = 12) => (s == null ? null : s.length > n ? `…${s.slice(-n)}` : s);
const countBy = (arr, f = (x) => x) => { const m = new Map(); for (const x of arr) { const k = f(x); m.set(k, (m.get(k) || 0) + 1); } return m; };
const top = (m, limit = 60) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);
const same = (a, b) => Math.abs(a - b) < 0.005;

/* ---------------------------------------------------------------------------------------------- load */
let loading = null;
export function loadFuras() {
  if (loading) return loading;
  loading = (async () => {
    const dir = furasDir(); if (!dir) throw new Error('furas_unavailable');
    const files = findFiles(dir); const D = { loadedAt: new Date().toISOString(), views: {}, subset: null };
    try { const m = JSON.parse(fs.readFileSync(path.join(dir, 'subset.json'), 'utf8')); if (m && m.kind === 'subset') D.subset = { contracts: m.contracts, scenarios: m.scenarios || null }; } catch { /* a full export has no manifest */ }
    for (const k of Object.keys(KEEP)) {
      const text = await fs.promises.readFile(files[k], 'utf8'); const p = parseCsv(text, KEEP[k]);
      D.views[k] = { name: VIEW_NAME[k], rows: p.n, columns: p.header.length, schemaColumns: SCHEMA_COLS[k], capped: p.n === CAP, cols: p.cols };
    }
    applyScope(D, scopeStatus());
    index(D); console.log('[furas] local exports loaded'); // counts and values are never logged
    return D;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}
export const resetFuras = () => { loading = null; };

// keep only the rows of the approved contracts: contract records of the status; payment and case rows are dropped only when they belong to OTHER (not approved) contracts —
// a row that matches no contract at all stays, so the integrity checks still see it. Numbers and opportunity numbers are compared in the whole Contract view first.
function applyScope(D, status) {
  D.scope = null; D.hiddenByNo = new Map(); if (!status) return;
  const take = (v, keep) => { const V = D.views[v]; const out = {}; for (const k of Object.keys(V.cols)) out[k] = keep.map((i) => V.cols[k][i]); V.fileRows = V.rows; V.cols = out; V.rows = keep.length; };
  const C = D.views.contract.cols; const nC = D.views.contract.rows;
  const allNo = new Set(); const allOpp = new Set(); const apNo = new Set(); const apOpp = new Set(); const keepC = [];
  for (let i = 0; i < nC; i += 1) {
    const no = C.contractnumber[i]; const o = C.opportunitynumber[i]; if (no != null) allNo.add(no); if (o != null) allOpp.add(o);
    if (C.opportunitystatus[i] === status) { keepC.push(i); if (no != null) apNo.add(no); if (o != null) apOpp.add(o); }
  }
  const hidden = new Map(); for (let i = 0; i < nC; i += 1) { if (C.opportunitystatus[i] === status) continue; const no = C.contractnumber[i]; if (no != null) hidden.set(no, (hidden.get(no) || 0) + 1); }
  for (const [no, n] of hidden) if (apNo.has(no)) D.hiddenByNo.set(no, n);
  const numbersOut = [...allNo].filter((n) => !apNo.has(n)).length;
  const P = D.views.payment.cols; const keepP = []; for (let i = 0; i < D.views.payment.rows; i += 1) { const no = P.contractid[i]; if (no != null && allNo.has(no) && !apNo.has(no)) continue; keepP.push(i); }
  const keepCase = (v) => { const X = D.views[v].cols; const keep = []; for (let i = 0; i < D.views[v].rows; i += 1) { const no = X.contractnumber[i]; const o = X.opportunitynumber[i]; const matchesAp = (no != null && apNo.has(no)) || (o != null && apOpp.has(o)); const matchesOther = !matchesAp && ((no != null && allNo.has(no)) || (o != null && allOpp.has(o))); if (!matchesOther) keep.push(i); } return keep; };
  const before = Object.fromEntries(Object.keys(D.views).map((k) => [k, D.views[k].rows]));
  const wasCapped = D.views.payment.capped;
  take('contract', keepC); take('payment', keepP); for (const v of ['contractmanagement', 'entitymanagement', 'imsfw_work']) take(v, keepCase(v));
  D.views.payment.capped = wasCapped; // the cap is a property of the file, not of the scope
  D.scope = { status, numbersOutside: numbersOut, recordsOutside: before.contract - D.views.contract.rows, excluded: Object.fromEntries(['contract', 'payment', 'contractmanagement', 'entitymanagement', 'imsfw_work'].map((k) => [k, before[k] - D.views[k].rows])) };
}

function index(D) {
  const C = D.views.contract.cols; const P = D.views.payment.cols; const nC = D.views.contract.rows; const nP = D.views.payment.rows;
  // extract identity (the same on every row of a file)
  const first = (v, c) => (D.views[v].cols[c] || []).find((x) => x != null) || null;
  const pt = first('contract', 'source_pt'); D.partition = pt && /^\d{8}$/.test(pt) ? dateOnly(pt) : pt; D.etl = first('contract', 'etl_time');
  // contract records by contract number (a number is NOT a record key: it can carry several records)
  D.byNo = new Map(); D.byPz = new Map(); D.noNumber = 0;
  for (let i = 0; i < nC; i += 1) { const no = C.contractnumber[i]; if (no == null) D.noNumber += 1; else { const a = D.byNo.get(no); if (a) a.push(i); else D.byNo.set(no, [i]); } if (C.pzinskey[i] != null) D.byPz.set(C.pzinskey[i], i); }
  D.byOpp = new Map(); for (let i = 0; i < nC; i += 1) { const o = C.opportunitynumber[i]; if (o != null) { const a = D.byOpp.get(o); if (a) a.push(i); else D.byOpp.set(o, [i]); } }
  // payment rows by contract number (listed ONCE under the number; never multiplied by the contract records of that number)
  D.payByNo = new Map(); for (let i = 0; i < nP; i += 1) { const no = P.contractid[i]; if (no == null) continue; const a = D.payByNo.get(no); if (a) a.push(i); else D.payByNo.set(no, [i]); }
  // case / workflow rows (not payments): kept as counts per contract number or opportunity number
  const M = D.views.contractmanagement.cols; D.cmByNo = new Map(); D.cmByOpp = new Map();
  for (let i = 0; i < D.views.contractmanagement.rows; i += 1) { const n = M.contractnumber[i]; if (n != null) { const a = D.cmByNo.get(n); if (a) a.push(i); else D.cmByNo.set(n, [i]); } const o = M.opportunitynumber[i]; if (o != null) { const a = D.cmByOpp.get(o); if (a) a.push(i); else D.cmByOpp.set(o, [i]); } }
  D.investors = new Set(D.views.investor.cols.investorid.filter((x) => x != null));
  D.municipalities = municipalityTable(C, nC);
}

function municipalityTable(C, n) {
  const names = new Map(); // code → Map(name → records)
  for (let i = 0; i < n; i += 1) { const c = C.municipalityid[i]; if (c == null) continue; if (!names.has(c)) names.set(c, new Map()); const m = names.get(c); const nm = C.municipality[i] || null; m.set(nm, (m.get(nm) || 0) + 1); }
  const out = new Map();
  for (const [code, m] of names) { const s = top(m); out.set(code, { code, sourceName: s[0][0], variants: s.slice(1).map(([name, records]) => ({ name, records })), flag: FLAGGED_MUNICIPALITIES.has(code) ? 'confirm_entity_scope' : null }); } // the source name is the most frequent spelling; variants are kept, never merged away
  return out;
}

/* ---------------------------------------------------------------------------------------------- structure of a contract number */
// A contract NUMBER can carry several records; the records are grouped by OPPORTUNITY number. Three shapes, from the data alone (no record is chosen as current):
//   single   — one record
//   versions — several records, all under one opportunity number (the same opportunity stored more than once)
//   multi    — records under two or more opportunity numbers
export const SHAPES = ['single', 'versions', 'multi'];
const shapeOf = (n, groups) => (n <= 1 ? 'single' : groups <= 1 ? 'versions' : 'multi');

/* ---------------------------------------------------------------------------------------------- per-number view */
function numberRows(D) {
  if (D.numRows) return D.numRows;
  const C = D.views.contract.cols; const out = [];
  for (const [no, idx] of D.byNo) {
    const dist = (col) => countBy(idx.map((i) => C[col][i]).filter((x) => x != null));
    const types = dist('contracttype'); const statuses = dist('opportunitystatus'); const codes = dist('municipalityid');
    const vals = new Set(idx.map((i) => num(C.contractvalue[i])).filter((v) => v != null).map((v) => v.toFixed(2))); const ann = new Set(idx.map((i) => num(C.annualcontractvalue[i])).filter((v) => v != null).map((v) => v.toFixed(2)));
    const ends = new Set(idx.map((i) => C.enddate[i]).filter((x) => x != null));
    const starts = new Set(idx.map((i) => C.startdate[i]).filter((x) => x != null));
    const rental = dist('rentalstatus'); const names = dist('opportunityname'); const withVat = new Set(idx.map((i) => num(C.totalcontractvaluewithvat[i])).filter((v) => v != null).map((v) => v.toFixed(2)));
    const investors = [...new Set(idx.map((i) => C.investorid[i]).filter((x) => x != null))];
    const oppNos = [...new Set(idx.map((i) => C.opportunitynumber[i]).filter((x) => x != null))];
    const oppGroups = new Set(idx.map((i) => C.opportunitynumber[i])); const opps = [...oppGroups].filter((x) => x != null).length;
    out.push({
      no, n: idx.length, opps, groups: oppGroups.size, oppNos, names: top(names), rental: top(rental), investors, investorsFound: investors.filter((x) => D.investors.has(x)).length,
      startState: starts.size === 0 ? 'none' : starts.size === 1 ? 'single' : 'differs', start: starts.size === 1 ? dateOnly([...starts][0]) : null, startFlag: starts.size === 1 ? dateFlag([...starts][0], D.partition) : null,
      endState: ends.size === 0 ? 'none' : ends.size === 1 ? 'single' : 'differs', end: ends.size === 1 ? dateOnly([...ends][0]) : null, endFlag: ends.size === 1 ? dateFlag([...ends][0], D.partition) : null,
      vatState: withVat.size === 0 ? 'none' : withVat.size === 1 ? 'single' : 'conflict', valueWithVat: withVat.size === 1 ? Number([...withVat][0]) : null, shape: shapeOf(idx.length, oppGroups.size), types: top(types), statuses: top(statuses), codes: [...codes.keys()], payRows: (D.payByNo.get(no) || []).length,
      invRows: (D.payByNo.get(no) || []).filter((i) => D.views.payment.cols.invoicedate[i] != null).length, hidden: D.hiddenByNo.get(no) || 0,
      valueState: vals.size === 0 ? 'none' : vals.size === 1 ? 'single' : 'conflict', value: vals.size === 1 ? Number([...vals][0]) : null, valueCount: vals.size,
      annualState: ann.size === 0 ? 'none' : ann.size === 1 ? 'single' : 'conflict', annual: ann.size === 1 ? Number([...ann][0]) : null,
      conflicts: { status: statuses.size > 1, type: types.size > 1, value: vals.size > 1, annual: ann.size > 1, endDate: ends.size > 1, municipality: codes.size > 1 }
    });
  }
  out.sort((a, b) => (a.no < b.no ? -1 : a.no > b.no ? 1 : 0));
  D.numRows = out; return out;
}

/* ---------------------------------------------------------------------------------------------- summary (every figure is computed from the files) */
export async function furasSummary() {
  const D = await loadFuras(); if (D.summary) return D.summary;
  const C = D.views.contract.cols; const P = D.views.payment.cols; const nC = D.views.contract.rows; const nP = D.views.payment.rows; const rows = numberRows(D);
  const extract = D.partition;
  const files = Object.keys(KEEP).map((k) => { const v = D.views[k]; return { key: k, view: v.name, rows: v.rows, fileRows: v.fileRows ?? v.rows, columns: v.columns, schemaColumns: v.schemaColumns, scope: D.subset ? 'subset' : v.capped ? 'capped_sample' : 'not_capped' }; });
  // contract numbers and records
  const repeated = rows.filter((r) => r.n > 1);
  const conflicts = (k) => repeated.filter((r) => r.conflicts[k]).length;
  const consistent = rows.filter((r) => r.valueState === 'single');
  const countRecords = (col) => countBy(C[col].filter((x) => x != null)); const countNumbers = (field) => { const m = new Map(); for (const r of rows) for (const [v] of r[field]) m.set(v, (m.get(v) || 0) + 1); return m; };
  const nTypes = countNumbers('types'); const nStatuses = countNumbers('statuses');
  const byType = top(countRecords('contracttype')).map(([value, records]) => ({ value, records, numbers: nTypes.get(value) || 0 }));
  const byStatus = top(countRecords('opportunitystatus')).map(([value, records]) => ({ value, records, numbers: nStatuses.get(value) || 0 }));
  const muniRecords = countBy(C.municipalityid.filter((x) => x != null)); const muniNumbers = new Map(); for (const r of rows) for (const c of r.codes) muniNumbers.set(c, (muniNumbers.get(c) || 0) + 1);
  const byMunicipality = [...D.municipalities.values()].sort((a, b) => (a.code < b.code ? -1 : 1)).map((m) => ({ ...m, records: muniRecords.get(m.code) || 0, numbers: muniNumbers.get(m.code) || 0 }));
  const filled = (col) => C[col].filter((x) => x != null).length;
  let links = 0; let resolved = 0; let outside = 0; let selfRef = 0; let sameNo = 0;
  for (let i = 0; i < nC; i += 1) { const r = C.renewedcontractid[i]; if (r == null) continue; links += 1; const j = D.byPz.get(r); if (j == null) { if (D.subset && r === OUTSIDE_SUBSET) outside += 1; continue; } resolved += 1; if (j === i) selfRef += 1; if (C.contractnumber[j] === C.contractnumber[i]) sameNo += 1; }
  const investorsFound = C.investorid.filter((x) => x != null && D.investors.has(x)).length;
  // payment extract
  const payNos = [...D.payByNo.keys()]; const matched = payNos.filter((no) => D.byNo.has(no));
  let rowsAfter = 0; let rows2 = 0; let rowsUnmatched = 0; let maxMatch = 0;
  for (let i = 0; i < nP; i += 1) { const m = (D.byNo.get(P.contractid[i]) || []).length; rowsAfter += m; if (m === 0) rowsUnmatched += 1; if (m > 1) rows2 += 1; if (m > maxMatch) maxMatch = m; }
  const keyCount = countBy(Array.from({ length: nP }, (_, i) => `${P.contractid[i]}|${P.batchyear[i]}|${P.batchnumber[i]}`)); const duplicateRows = [...keyCount.values()].reduce((t, v) => t + (v > 1 ? v - 1 : 0), 0);
  const byPayStatus = top(countBy(P.batchstatus.filter((x) => x != null))).map(([value, count]) => ({ value, rows: count, scheduledAmount: 0 }));
  const ps = new Map(byPayStatus.map((x) => [x.value, x])); let amountTotal = 0; let amountRows = 0; let zero = 0;
  for (let i = 0; i < nP; i += 1) { const a = num(P.paymentamount[i]); if (a == null) continue; amountTotal += a; amountRows += 1; if (a === 0) zero += 1; const s = ps.get(P.batchstatus[i]); if (s) s.scheduledAmount += a; }
  const flagCount = (col, opts) => { const m = new Map(); for (let i = 0; i < nP; i += 1) { const f = dateFlag(P[col][i], extract, opts); if (f) m.set(f, (m.get(f) || 0) + 1); } return Object.fromEntries(m); };
  const per = countBy(Array.from({ length: nP }, (_, i) => P.contractid[i]).filter((x) => x != null)); let c3 = 0; let contiguous = 0;
  for (const [no, c] of per) { if (c < 3) continue; c3 += 1; const bn = (D.payByNo.get(no) || []).map((i) => num(P.batchnumber[i])).filter((x) => x != null).sort((a, b) => a - b); if (bn.length === c && new Set(bn).size === c && bn[bn.length - 1] - bn[0] + 1 === c) contiguous += 1; }
  const paidDates = []; for (let i = 0; i < nP; i += 1) { if (P.batchstatus[i] === 'Paid' && P.paymentdate[i] && !dateFlag(P.paymentdate[i], extract, { noFuture: true })) paidDates.push(dateOnly(P.paymentdate[i])); }
  const createMax = P.pxcreatedatetime.filter((x) => x != null).reduce((m, x) => (x > m ? x : m), '');
  // case rows and the other views
  const M = D.views.contractmanagement.cols; const cmFound = M.contractnumber.filter((x) => x != null && D.byNo.has(x)).length; const cmNo = M.contractnumber.filter((x) => x != null).length; const cmOpp = M.opportunitynumber.filter((x) => x != null); const cmOppFound = cmOpp.filter((x) => D.byOpp.has(x)).length;
  const sadadFilled = (v) => D.views[v].cols.sadadbillnumber.filter((x) => x != null).length;
  const pFound = P.investorid.filter((x) => x != null && D.investors.has(x)).length; const pInv = P.investorid.filter((x) => x != null).length;
  D.summary = {
    dataset: { title: 'Furas Databank exports', schema: 'Furas business schema', extract, etl: D.etl, files, subset: D.subset, scope: D.scope, note: 'Read locally at runtime; not in Git, not in any build, not in any log.' },
    contracts: {
      shapes: Object.fromEntries(SHAPES.map((k) => [k, rows.filter((r) => r.shape === k).length])), records: nC, distinctNumbers: D.byNo.size, recordsWithoutNumber: D.noNumber, numbersWithSeveralRecords: repeated.length, recordsInRepeatedNumbers: repeated.reduce((t, r) => t + r.n, 0), maxRecordsPerNumber: rows.reduce((m, r) => Math.max(m, r.n), 0),
      recordKeyUnique: D.byPz.size === nC, conflictsAmongRepeated: { status: conflicts('status'), type: conflicts('type'), value: conflicts('value'), annual: conflicts('annual'), endDate: conflicts('endDate'), municipality: conflicts('municipality') },
      byType, byStatus, byRental: top(countRecords('rentalstatus')).map(([value, records]) => ({ value, records })), byMunicipality, numbersWithSeveralTypes: rows.filter((r) => r.conflicts.type).length,
      dates: { startFilled: filled('startdate'), endFilled: filled('enddate'), signingFilled: filled('signingdate'), awardingFilled: filled('awardingdate') },
      values: { numbersWithSingleValue: consistent.length, sumOfSingleValues: consistent.reduce((t, r) => t + r.value, 0), numbersWithConflictingValues: rows.filter((r) => r.valueState === 'conflict').length, numbersWithoutValue: rows.filter((r) => r.valueState === 'none').length },
      renewal: { links, resolved, outsideSubset: outside, unresolved: links - resolved - outside, selfReference: selfRef, sameContractNumber: sameNo },
      investorIdFound: investorsFound, investorIdFilled: filled('investorid')
    },
    payments: {
      rows: nP, capped: D.views.payment.capped, distinctNumbers: payNos.length, numbersFoundInContract: matched.length, numbersNotFound: payNos.length - matched.length, rowsNotFound: rowsUnmatched, rowsMatchingSeveralRecords: rows2, maxRecordsMatched: maxMatch,
      rowsAfterNumberJoin: rowsAfter, duplicateRows, contractsWithThreePlusRows: c3, contractsWithContiguousBatches: contiguous,
      scheduledAmount: { total: amountTotal, rows: amountRows, zeroRows: zero }, byStatus: byPayStatus,
      byMethod: top(countBy(P.methodofcollectingpayments.filter((x) => x != null))).map(([value, rows2_]) => ({ value, rows: rows2_ })), byType: top(countBy(P.paymenttype.filter((x) => x != null))).map(([value, rows2_]) => ({ value, rows: rows2_ })),
      dueDateFlags: flagCount('paymentduedate'), invoiceDateFlags: flagCount('invoicedate', { noFuture: true }), paymentDateFlags: flagCount('paymentdate', { noFuture: true }),
      invoiceDateFilled: P.invoicedate.filter((x) => x != null).length, numbersWithInvoiceDate: rows.filter((r) => r.invRows > 0).length, paymentDateFilled: P.paymentdate.filter((x) => x != null).length, collectedFieldFilled: P.batchamountpaid.filter((x) => x != null).length,
      latest: { createdField: 'PXCREATEDATETIME', created: createMax || null, paymentDateField: 'PAYMENTDATE (rows with status Paid, values after the extract date excluded)', paymentDate: paidDates.sort().pop() || null },
      investorIdFound: pFound, investorIdFilled: pInv
    },
    cases: { contractManagementRows: D.views.contractmanagement.rows, withContractNumber: cmNo, contractNumberFound: cmFound, withOpportunityNumber: cmOpp.length, opportunityNumberFound: cmOppFound, sadadBillNumberFilled: { contractManagement: sadadFilled('contractmanagement'), entityManagement: sadadFilled('entitymanagement'), imsfwWork: sadadFilled('imsfw_work') } },
    investors: { rows: D.views.investor.rows }
  };
  return D.summary;
}

/* ---------------------------------------------------------------------------------------------- list of distinct contract numbers */
export async function furasContracts(body = {}) {
  const D = await loadFuras(); let rows = numberRows(D); const f = body.filter || {};
  const q = String(body.q || '').trim().toUpperCase();
  if (q) rows = rows.filter((r) => r.no.toUpperCase().includes(q) || r.oppNos.some((o) => o.toUpperCase().includes(q)) || r.names.some(([v]) => v.toUpperCase().includes(q)));
  if (f.rental) rows = rows.filter((r) => r.rental.some(([v]) => v === f.rental));
  if (f.type) rows = rows.filter((r) => r.types.some(([v]) => v === f.type));
  if (f.status) rows = rows.filter((r) => r.statuses.some(([v]) => v === f.status));
  if (f.municipality) rows = rows.filter((r) => r.codes.includes(f.municipality));
  if (f.startFrom || f.startTo) rows = rows.filter((r) => r.start && (!f.startFrom || r.start >= f.startFrom) && (!f.startTo || r.start <= f.startTo)); // contract START date as stored (a number whose records disagree on it, or with none, is not guessed into a range)
  if (f.shape && SHAPES.includes(f.shape)) rows = rows.filter((r) => r.shape === f.shape);
  if (f.severalRecords) rows = rows.filter((r) => r.n > 1);
  if (f.conflicting) rows = rows.filter((r) => Object.values(r.conflicts).some(Boolean));
  if (f.inPaymentExtract) rows = rows.filter((r) => r.payRows > 0);
  if (f.withInvoiceDate) rows = rows.filter((r) => r.invRows > 0);
  const size = body.all ? Math.max(1, rows.length) : Math.min(100, Math.max(1, Number(body.pageSize) || 25)); const page = body.all ? 0 : Math.max(0, Number(body.page) || 0); // all: the whole filtered list, for the export
  const names = D.municipalities;
  return {
    total: rows.length, page, pageSize: size,
    rows: rows.slice(page * size, (page + 1) * size).map((r) => ({
      no: r.no, records: r.n, opportunities: r.opps, shape: r.shape,
      name: { state: r.names.length === 0 ? 'none' : r.names.length === 1 ? 'single' : 'several', value: r.names.length ? r.names[0][0] : null, distinct: r.names.length },
      investors: r.investors.map((id) => ({ masked: maskId(id), found: D.investors.has(id) })), executionStatuses: r.rental.map(([value, n]) => ({ value, records: n })),
      start: { state: r.startState, value: r.start, flag: r.startFlag }, end: { state: r.endState, value: r.end, flag: r.endFlag }, valueWithVat: { state: r.vatState, value: r.valueWithVat }, types: r.types.map(([value, n]) => ({ value, records: n })), statuses: r.statuses.map(([value, n]) => ({ value, records: n })),
      municipalities: r.codes.map((c) => ({ code: c, sourceName: names.get(c)?.sourceName || null })), paymentRowsInExtract: r.payRows, invoiceDateRows: r.invRows, hiddenRecords: r.hidden,
      contractValue: { state: r.valueState, value: r.value, distinct: r.valueCount }, annualValue: { state: r.annualState, value: r.annual }, conflicts: r.conflicts
    }))
  };
}

/* ---------------------------------------------------------------------------------------------- one contract number */
export async function furasContract(no) {
  const D = await loadFuras(); const key = String(no || '').trim(); const idx = D.byNo.get(key);
  if (!idx) { const hit = [...D.byNo.keys()].find((k) => k.toUpperCase() === key.toUpperCase()); if (!hit) return null; return furasContract(hit); }
  const C = D.views.contract.cols; const P = D.views.payment.cols; const extract = D.partition; const names = D.municipalities;
  const rec = (i) => {
    const link = C.renewedcontractid[i] != null ? D.byPz.get(C.renewedcontractid[i]) : undefined;
    return {
      recordKey: tail(C.pzinskey[i]), opportunityNumber: C.opportunitynumber[i], opportunityName: C.opportunityname[i], investorId: maskId(C.investorid[i]), contractType: C.contracttype[i], status: C.opportunitystatus[i], rentalStatus: C.rentalstatus[i], renewalStatus: C.renewalstatus[i],
      awardingDate: dateOnly(C.awardingdate[i]), signingDate: dateOnly(C.signingdate[i]), startDate: dateOnly(C.startdate[i]), endDate: dateOnly(C.enddate[i]), handoverPlanned: dateOnly(C.dateofsitehandover[i]), handoverActual: dateOnly(C.dateofsitehandoveractual[i]),
      contractValue: num(C.contractvalue[i]), calculatedValue: num(C.calculatedcontractvalue[i]), annualValue: num(C.annualcontractvalue[i]), valueWithVat: num(C.totalcontractvaluewithvat[i]), term: C.contractterm[i], durationMonths: C.contractdurationmonths[i],
      municipality: C.municipalityid[i] == null ? null : { code: C.municipalityid[i], sourceName: names.get(C.municipalityid[i])?.sourceName || null, nameOnRecord: C.municipality[i], flag: names.get(C.municipalityid[i])?.flag || null }, subMunicipality: C.submunicipality[i],
      primaryLink: C.primarycontractid[i] == null ? null : D.subset && C.primarycontractid[i] === OUTSIDE_SUBSET ? { resolved: false, outsideSubset: true } : D.byPz.has(C.primarycontractid[i]) ? { resolved: true, contractNumber: C.contractnumber[D.byPz.get(C.primarycontractid[i])] } : { resolved: false },
      renewalLink: C.renewedcontractid[i] == null ? null : link == null ? (D.subset && C.renewedcontractid[i] === OUTSIDE_SUBSET ? { resolved: false, outsideSubset: true } : { resolved: false }) : { resolved: true, contractNumber: C.contractnumber[link], selfReference: link === i, sameContractNumber: C.contractnumber[link] === C.contractnumber[i] },
      dateFlags: Object.fromEntries(['startdate', 'enddate', 'signingdate', 'awardingdate'].map((c) => [c, dateFlag(C[c][i], extract)]).filter(([, v]) => v))
    };
  };
  const records = idx.map(rec);
  // the records grouped by opportunity number, in the order the opportunities first appear; a record without an opportunity number forms its own group
  const groupMap = new Map(); records.forEach((r, i) => { const k = r.opportunityNumber ?? null; if (!groupMap.has(k)) groupMap.set(k, []); groupMap.get(k).push(i); });
  const groups = [...groupMap.entries()].map(([opportunityNumber, recordIndexes]) => ({ opportunityNumber, recordIndexes }));
  const fields = ['contractType', 'status', 'contractValue', 'calculatedValue', 'annualValue', 'endDate', 'startDate', 'opportunityNumber', 'investorId'];
  const differing = fields.filter((f) => new Set(records.map((r) => JSON.stringify(r[f]))).size > 1);
  const oppSet = new Set(idx.map((i) => C.opportunitynumber[i]));
  const payIdx = D.payByNo.get(key) || [];
  // INSTALLMENTS = the actual Payment rows of this contract NUMBER (Payment.CONTRACTID holds the contract number: observed, not the record key). Nothing is generated, nothing is added up.
  //   payable  = PAYMENTAMOUNT (what is payable for the batch; NOT a collected amount)      paid        = BATCHAMOUNTPAID (the received amount; empty = not available, never zero)
  //   outstanding = BATCHAMOUNTBALANCE (empty = not available).  BALANCEAMOUNT is not displayed: it does not behave as «remaining after payment» in the data and its definition is unconfirmed.
  //   vat = VATAMOUNT, shown beside the payable amount, never added to it (the VAT basis of PAYMENTAMOUNT is not confirmed).
  const payments = payIdx.map((i) => ({
    batchNumber: num(P.batchnumber[i]), batchYear: P.batchyear[i], status: P.batchstatus[i], paymentType: P.paymenttype[i], method: P.methodofcollectingpayments[i], batchMonths: P.batchmonths[i],
    dueDate: dateOnly(P.paymentduedate[i]), batchEndDate: dateOnly(P.batchenddate[i]), invoiceDate: dateOnly(P.invoicedate[i]), paymentDate: dateOnly(P.paymentdate[i]),
    payable: num(P.paymentamount[i]), vatAmount: num(P.vatamount[i]), paid: num(P.batchamountpaid[i]), outstanding: num(P.batchamountbalance[i]), opportunityNumber: P.opportunitynumber[i],
    investorId: maskId(P.investorid[i]),
    recordsWithSameOpportunity: idx.filter((j) => C.opportunitynumber[j] === P.opportunitynumber[i]).length,
    dateFlags: Object.fromEntries([['dueDate', dateFlag(P.paymentduedate[i], extract)], ['batchEndDate', dateFlag(P.batchenddate[i], extract)], ['invoiceDate', dateFlag(P.invoicedate[i], extract, { noFuture: true })], ['paymentDate', dateFlag(P.paymentdate[i], extract, { noFuture: true })]].filter(([, v]) => v))
  })).sort((a, b) => String(a.opportunityNumber).localeCompare(String(b.opportunityNumber)) || (a.batchNumber ?? 1e9) - (b.batchNumber ?? 1e9) || String(a.dueDate).localeCompare(String(b.dueDate)));
  const M = D.views.contractmanagement.cols; const cm = new Set(D.cmByNo.get(key) || []); for (const o of oppSet) for (const i of D.cmByOpp.get(o) || []) cm.add(i);
  // CONTRACT-LEVEL bill references: SADADBILLNUMBER on the workflow views (ContractManagement, EntityManagement, IMSFW_Work), matched by contract number or opportunity number. They are listed ONCE per distinct bill
  // (a bill that appears in several views is one bill) and are NOT tied to an installment: Payment carries no bill key, so an installment-to-invoice link is unavailable. A workflow row is a case snapshot, not an invoice.
  const oppNos = new Set(idx.map((i) => C.opportunitynumber[i]).filter((x) => x != null));
  const billMap = new Map(); let placeholderRows = 0; let caseRowsWithBill = 0;
  for (const [view, label] of [['contractmanagement', 'ContractManagement'], ['entitymanagement', 'EntityManagement'], ['imsfw_work', 'IMSFW_Work']]) {
    const X = D.views[view].cols; const n = D.views[view].rows;
    for (let i = 0; i < n; i += 1) {
      const b = X.sadadbillnumber[i]; if (b == null) continue; const o = X.opportunitynumber[i]; const cn = X.contractnumber[i];
      const mine = cn === key || (cn == null && o != null && oppNos.has(o)); // a row that names ANOTHER contract number is not this contract's, even if its opportunity number matches
      if (!mine) continue;
      caseRowsWithBill += 1;
      if (b === BILL_PLACEHOLDER) { placeholderRows += 1; continue; }
      const e = billMap.get(b) || { number: b, views: [] }; if (!e.views.includes(label)) e.views.push(label); billMap.set(b, e);
    }
  }
  const bills = { refs: [...billMap.values()].sort((a, b) => (a.number < b.number ? -1 : 1)), caseRowsWithBill, numbersNotRetained: placeholderRows, installmentLink: 'unavailable' };
  const investorIds = [...new Set(idx.map((i) => C.investorid[i]).filter((x) => x != null))];
  return {
    investor: { ids: investorIds.map((id) => ({ masked: maskId(id), found: D.investors.has(id) })), nameAvailable: false },
    bills,
    scope: D.scope ? { status: D.scope.status, hiddenRecords: D.hiddenByNo.get(key) || 0 } : null,
    contractNumber: key, records, recordCount: records.length, shape: shapeOf(records.length, groups.length), opportunityCount: groups.filter((g) => g.opportunityNumber != null).length, groups, differingFields: differing, currentRecordDetermined: false,
    payments: { rows: payments, rowsInExtract: payments.length, extractIsCapped: D.views.payment.capped },
    caseRows: { count: cm.size, byLabel: top(countBy([...cm].map((i) => M.pylabel[i] || null))).map(([value, n]) => ({ value, rows: n })) },
    dataset: { extract, etl: D.etl }
  };
}

/* ---------------------------------------------------------------------------------------------- decision-room input */
export async function furasDecisionInput() {
  const S = await furasSummary(); const c = S.contracts; const p = S.payments;
  const dateIssues = (o) => Object.values(o).reduce((t, v) => t + v, 0);
  return {
    dataset: S.dataset, repeated: { numbers: c.numbersWithSeveralRecords, records: c.recordsInRepeatedNumbers, conflicts: c.conflictsAmongRepeated }, conflictingValues: c.values.numbersWithConflictingValues,
    payments: { rows: p.rows, capped: p.capped, distinctNumbers: p.distinctNumbers, rowsMatchingSeveralRecords: p.rowsMatchingSeveralRecords, rowsNotFound: p.rowsNotFound, contractsWithThreePlusRows: p.contractsWithThreePlusRows, contiguous: p.contractsWithContiguousBatches },
    dateIssues: { due: dateIssues(p.dueDateFlags), invoice: dateIssues(p.invoiceDateFlags), payment: dateIssues(p.paymentDateFlags), flags: { due: p.dueDateFlags, invoice: p.invoiceDateFlags, payment: p.paymentDateFlags } },
    startDateFilled: c.dates.startFilled, records: c.records, statusValues: c.byStatus.length, renewal: c.renewal
  };
}
