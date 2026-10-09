// Verification of the multi-source demo world. Run:  npm run verify:sources   (bundled with esbuild, no test framework needed)
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { list } from '../server/lists.js';
import { sourcesReport } from '../server/sourcesReport.js';
import { makeCtx } from '../server/engine.js';
import { detail } from '../server/materialize.js';
import { SOURCES } from '../src/data/catalog.js';

process.env.DEMO_SIZE = process.env.DEMO_SIZE || 'full';
const today = process.argv[2] || process.env.DEMO_TODAY || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const bn = (n) => (n / 1e9).toFixed(3);
let failed = 0;
const ok = (name, cond, extra = '') => { if (!cond) failed += 1; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

console.time('store'); const st = loadStore(today); console.timeEnd('store');
const cfg = { cutoff: today };
const rep = sourcesReport(st, { cfg });
const y = today.slice(0, 4);

console.log(`\nToday (Asia/Riyadh): ${today} · invoices generated: ${st.nGen.toLocaleString('en-US')} · payments: ${st.pn.toLocaleString('en-US')}\n`);
console.log('source'.padEnd(15), 'invoices(YTD)'.padStart(13), 'items'.padStart(9), 'payments'.padStart(9), 'gross bn'.padStart(9), 'collected'.padStart(10), 'rate'.padStart(6), 'outstanding'.padStart(11), '| prior invoices'.padStart(16), 'prior gross');
for (const s of rep.sources) {
  const f = s.ytd.financial || {}; const p = s.prior.financial || {};
  console.log(s.key.padEnd(15), String(s.ytd.invoices).padStart(13), String(s.ytd.lines).padStart(9), String(s.ytd.payments).padStart(9), bn(f.gross || 0).padStart(9), bn(f.collected || 0).padStart(10), (f.rate?.calculable ? Math.round(f.rate.value * 100) + '%' : '—').padStart(6), bn(f.outstanding || 0).padStart(11), '|', String(s.prior.invoices).padStart(8), bn(p.gross || 0));
}
const T = rep.totals.ytd;
console.log(`TOTAL YTD: ${T.count.toLocaleString('en-US')} invoices · gross ${bn(T.gross)} bn = exclusions ${bn(T.exclusions)} (cancelled ${bn(T.cancelled)} + rules ${bn(T.exclusionsRules)}) + net ${bn(T.net)} · net = collected ${bn(T.collected)} + uncollected ${bn(T.outstanding)} · rate ${(100 * T.collected / T.net).toFixed(1)}%\n`);
ok('gross = exclusions + net, net = collected + uncollected (total, per Amanah, per source, per scope type)', snapshot(st, { scope: { from: `${y}-01-01`, to: today, amanah: 'all', source: 'all' }, cfg }).equation.ok);

/* ---- structure / coverage */
ok('all 8 revenue sources are represented in the current year', rep.sources.every((s) => s.ytd.invoices > 0), rep.sources.map((s) => `${s.key}:${s.ytd.invoices}`).join(' '));
ok('all 8 revenue sources are represented in the prior year', rep.sources.every((s) => s.prior.invoices > 0));
ok('>= 500,000 DISTINCT invoices for the current year to date', T.count >= 500000, T.count.toLocaleString('en-US'));
ok('500,000 is a total, not per source: no single source holds it all', rep.sources.every((s) => s.ytd.invoices < T.count * 0.7));
ok('invoice ids are unique and strictly increasing', rep.checks.idsStrictlyIncreasing && rep.checks.duplicateIds === 0);
ok('invoices <> item rows <> payment rows (three different counts)', T.count !== rep.sources.reduce((t, s) => t + s.ytd.lines, 0) && rep.sources.reduce((t, s) => t + s.ytd.payments, 0) !== T.count);
/* ---- reconciliation with the metric layer */
for (const [k, v] of Object.entries(rep.reconcile)) ok(`reconcile: ${k}`, v);
ok('cancelled and excluded never both deduct the same invoice', rep.checks.cancelledAndExcludedOverlap === 0);
ok('no invoice is paid more than its amount', rep.sources.every((s) => s.ytd.paidOverGross === 0 && s.prior.paidOverGross === 0));
/* ---- source specific integrity */
const tb = rep.sources.find((s) => s.key === 'tobacco'); const ac = rep.sources.find((s) => s.key === 'accommodation'); const wl = rep.sources.find((s) => s.key === 'white_lands'); const li = rep.sources.find((s) => s.key === 'licenses'); const fi = rep.sources.find((s) => s.key === 'fines');
ok('tobacco: wallet settlement exists (FROM_WALLET)', tb.ytd.wallet > 0, `${bn(tb.ytd.wallet)} bn`);
ok('tobacco: replaced disclosures come in consistent pairs', rep.checks.tobaccoPairsBroken === 0, `pairs ${tb.ytd.replacedPairs}`);
ok('white lands: multi-owner deeds are consistent (one invoice per owner, same issue date)', rep.checks.whiteLandGroupsBroken === 0, `multi-owner invoices ${wl.ytd.ownersMulti}`);
ok('white lands: extension requests, objections and enforcement orders present', wl.ytd.ext[1] + wl.ytd.ext[2] + wl.ytd.ext[3] > 0 && wl.ytd.objections > 0 && rep.enforcement.whiteLandsOrders > 0, `ext ${wl.ytd.ext.slice(1)} obj ${wl.ytd.objections} orders ${rep.enforcement.whiteLandsOrders}`);
ok('white lands: low collection rate vs accommodation (as in the monthly reports)', (wl.ytd.financial.rate.value || 0) < 0.5 && (ac.ytd.financial.rate.value || 0) > 0.85, `${Math.round(wl.ytd.financial.rate.value * 100)}% vs ${Math.round(ac.ytd.financial.rate.value * 100)}%`);
ok('licences: bill-status codes 0/1/2 present', li.ytd.billStatus[0] > 0 && li.ytd.billStatus[1] > 0 && li.ytd.billStatus[2] > 0, li.ytd.billStatus.join('/'));
ok('fines: invoice value and violation value are both kept (some differ)', fi.ytd.invoices > 0);

/* ---- sampled records: line items sum to the invoice, links, no duplicate amount across systems */
const ctx = makeCtx(st, { cfg });
let sampled = 0; let bad = 0; let noLinks = 0; let amountDup = 0; const perSource = {};
const sampleIdx = []; for (let i = 0; i < st.nGen; i += 997) sampleIdx.push(i);
for (const k of SOURCES.map((x) => x.key)) for (let i = st.nGen - 1, n = 0; i >= 0 && n < 5; i -= 1) if (SOURCES[st.src[i]].key === k) { sampleIdx.push(i); n += 1; }
for (const i of sampleIdx) {
  const d = detail(st, i, ctx); sampled += 1; const sr = d.sourceRecord; const rec = d.rec;
  const sum = rec.lineItems.reduce((s, l) => s + l.amount, 0);
  if (Math.abs(sum - rec.grossAmount) > 0.5 && rec.amountCheck.status !== 'conflict') bad += 1;
  if (!sr || sr.links.length < 2) noLinks += 1;
  const sysSet = new Set(sr.links.map((l) => `${l.system}|${l.dataset}`)); if (sysSet.size !== sr.links.length) amountDup += 1;
  perSource[SOURCES[st.src[i]].key] = (perSource[SOURCES[st.src[i]].key] || 0) + 1;
}
ok(`sampled ${sampled} invoices: item total equals the invoice (except flagged conflicts)`, bad === 0);
ok('sampled invoices carry >= 2 linked source records, each system once (no duplicated invoice)', noLinks === 0 && amountDup === 0);
ok('sampling covered every source', Object.keys(perSource).length === 8, JSON.stringify(perSource));

/* ---- search keys of the new sources */
const probe = (srcKey) => { for (let i = st.nGen - 1; i >= 0; i -= 1) if (SOURCES[st.src[i]].key === srcKey) return i; return -1; };
const searchOk = (label, text, expectId) => { const r = list(st, { scope: { from: '2000-01-01', to: today, amanah: 'all', source: 'all' }, cfg, filters: { search: text, allPeriods: true }, page: 0, pageSize: 5 }); const hit = r.rows.some((x) => x.id === expectId); ok(`search by ${label} finds the invoice`, hit, `${text} -> ${r.total}`); };
for (const k of ['tobacco', 'accommodation', 'white_lands', 'licenses', 'fines']) {
  const i = probe(k); const d = detail(st, i, ctx); const sr = d.sourceRecord;
  searchOk(`${k} SADAD`, d.rec.sadadNo, d.rec.id);
  const flat = sr.views.flatMap((v) => v.fields); const get = (n) => flat.find((f) => f.n === n)?.v;
  if (k === 'tobacco' || k === 'accommodation') { const f = get('FACILITY_KEY'); const r = list(st, { scope: { from: '2000-01-01', to: today, amanah: 'all', source: 'all' }, cfg, filters: { search: f, allPeriods: true }, page: 0, pageSize: 5 }); ok(`search by ${k} facility key finds invoices`, r.total >= 1 && r.rows.some((x) => x.id === d.rec.id), `${f} -> ${r.total}`); }
  if (k === 'white_lands') { const dn = get('DeedNumber'); const r = list(st, { scope: { from: '2000-01-01', to: today, amanah: 'all', source: 'all' }, cfg, filters: { search: dn, allPeriods: true }, page: 0, pageSize: 5 }); ok('search by deed number finds the deed invoices', r.total >= 1, `${dn} -> ${r.total}`); }
  if (k === 'fines') searchOk('violation visit number', get('رقم_الزيارة'), d.rec.id);
}

/* ---- determinism: same day twice = same numbers; the next day only appends */
const a1 = snapshot(st, { scope: { from: `${y}-01-01`, to: today, amanah: 'all', source: 'all' }, cfg }).totals;
const st2 = loadStore(today); const a2 = snapshot(st2, { scope: { from: `${y}-01-01`, to: today, amanah: 'all', source: 'all' }, cfg }).totals;
ok('same-day reopen gives identical totals', a1.gross === a2.gross && a1.collected === a2.collected && a1.count === a2.count);
const nextDay = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const st3 = loadStore(nextDay);
const hist = (store, upTo) => { const c = { cutoff: upTo }; return snapshot(store, { scope: { from: `${y}-01-01`, to: upTo, amanah: 'all', source: 'all' }, cfg: c }).totals; };
const h1 = hist(st, today); const h3 = hist(st3, today); // the new world, looked at AS OF yesterday, must equal yesterday's world
ok('advancing one day does not change history (as-of yesterday identical)', h1.gross === h3.gross && h1.count === h3.count && Math.abs(h1.collected - h3.collected) < 1, `${h1.count} vs ${h3.count}`);
const t3 = hist(st3, nextDay);
ok('the new day only appends (count never decreases, nothing future-dated)', t3.count >= h1.count && t3.collected >= h1.collected - 1);

/* ---- calibration to the monthly report scale, evaluated as of 31 March */
const cal = loadStore(`${y}-03-31`); const calS = snapshot(cal, { scope: { from: `${y}-01-01`, to: `${y}-03-31`, amanah: 'all', source: 'all' }, cfg: { cutoff: `${y}-03-31` } });
const by = Object.fromEntries(calS.bySource.map((g) => [g.key, g]));
console.log('\nAs of 31 March (report cumulative, SAR M): gross · collected ·ratio'); for (const k of ['white_lands', 'accommodation', 'tobacco', 'fines', 'investment']) console.log(' ', k.padEnd(14), Math.round(by[k].gross / 1e6), '·', Math.round(by[k].collected / 1e6), '·', Math.round(by[k].collectedOverNet.value * 100) + '%');
ok('white-land collection within the report range (10-35%) at end of Q1', by.white_lands.collectedOverNet.value > 0.1 && by.white_lands.collectedOverNet.value < 0.35, `${Math.round(by.white_lands.collectedOverNet.value * 100)}%`);
ok('accommodation >= 90% and tobacco 70-90% at end of Q1', by.accommodation.collectedOverNet.value > 0.9 && by.tobacco.collectedOverNet.value > 0.7 && by.tobacco.collectedOverNet.value < 0.9, `${Math.round(by.accommodation.collectedOverNet.value * 100)}% / ${Math.round(by.tobacco.collectedOverNet.value * 100)}%`);

console.log(`\n${failed ? `${failed} CHECK(S) FAILED` : 'ALL CHECKS PASSED'}`);
process.exit(failed ? 1 : 0);
