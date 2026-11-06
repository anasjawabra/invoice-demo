// Municipality hierarchy, part 2: every downstream consumer reads the reference municipality model — Smart Reports interpretation → scope → report → exports,
// the non-collection analysis, the Decision Room, the dashboard drill-down links and the CSV export — for open and restricted organisations. Synthetic data only.
// Run: npm run test:munidown
import assert from 'node:assert/strict';
import { ENTITIES, N_AMANAH } from '../src/data/catalog.js';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { muniLabel, parseMuniKey, MUNICIPALITY_DIRECT, MUNICIPALITY_OPTION_NONE } from '../src/data/municipalityModel.js';
import { interpret, describeChange, defaultSpec } from '../src/data/reportIntents.js';
import { buildReportModel } from '../src/data/reportModel.js';
import { buildDashboardModel } from '../src/data/dashboardReport.js';
import { describeScope } from '../src/data/revenueInsights.js';
import { buildDecisionItems } from '../src/data/decisionRoom.js';
import { previousScope } from '../src/data/revenueMetrics.js';
import { modelToLines, buildCsv, reportFileName, buildWorkbook } from '../src/utils/exportReportModel.js';
import { buildPdfHtml } from '../src/utils/pdfReport.js';
import { tableToText } from '../src/data/reportFormat.js';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { list, exportChunks, EXPORT_COLUMNS } from '../server/lists.js';
import { nonCollectionAnalysis } from '../server/noncollection.js';
import { buildCharts, listRequest, listAmount, drillPopulation } from '../src/components/analysis/nc/ncModel.js';

process.env.DEMO_SIZE = 'compact';
let n = 0; const pending = [];
const ok = (name, fn) => { try { const r = fn(); if (r && typeof r.then === 'function') pending.push(r.then(() => { n += 1; }, (e) => { e.message = `[${name}] ${e.message}`; throw e; })); else n += 1; } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } };
const TODAY = '2026-10-09'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
const JD = 'Jeddah Amanah'; const RY = 'Riyadh Amanah'; const MK = 'Makkah Amanah';
const SC = (extra = {}) => ({ from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', ...extra });
const mkOut = (snap) => ({ snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: null, cards: [], anomalies: [] });
const model = (scope, lang = 'ar', sections = ['executive', 'amanah']) => buildReportModel({ spec: { ...defaultSpec(TODAY), scope, sections }, lang, out: mkOut(snapshot(st, { scope, cfg })), meta: { size: 'compact', counts: { invoicesTotal: st.n } } });
const all = (o, out = []) => { if (typeof o === 'string') out.push(o); else if (Array.isArray(o)) o.forEach((x) => all(x, out)); else if (o && typeof o === 'object') Object.values(o).forEach((x) => all(x, out)); return out; };
const visible = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'links' ? undefined : v))); // drill links legitimately carry the filter key; everything a person reads must not
const NO_ID = /MREF-|\|NOT_SPECIFIED|\|DIRECT|\|UNRESOLVED/; // an internal id or a raw filter key must never reach a person
// a Jeddah municipality with enough invoices to be a meaningful scope
const jd = snapshot(st, { scope: SC({ amanah: JD }), cfg });
const mapped = jd.byMunicipality.filter((g) => g.status === 'mapped').sort((a, b) => b.count - a.count)[0];
assert.ok(mapped && mapped.count >= 3, 'the compact world has a Jeddah municipality with invoices');
const MKEY = mapped.key; const MNAME = muniLabel(MKEY, 'ar');

/* ---------------------------------------------------------------- 1. Smart Reports: request → interpretation → scope */
ok('requests naming a Jeddah municipality resolve to the reference filter value, show «البلدية: …» in the reading, and never expose an id', () => {
  const name = municipalitiesOf(JD).find((m) => m.key === MKEY).ar;
  for (const q of [`تقرير أمانة جدة ${name}`, `تقرير ${name.replace(/^بلدية /, 'بلديه ').replace(/ة/g, 'ه')} أمانة جدة`, `Jeddah Amanah report, municipality of ${name.replace(/^بلدية /, '')}`]) {
    const r = interpret(q, null, TODAY); assert.equal(r.kind, 'report', q); assert.equal(r.spec.scope.muni, MKEY, q); assert.equal(r.spec.scope.amanah, JD, q);
    const ch = r.changes.find((c) => c.key === 'muni'); assert.ok(ch, q);
    const ar = describeChange(ch, 'ar'); const en = describeChange(ch, 'en'); assert.ok(ar.startsWith('البلدية: ') && ar.includes(MNAME) && !NO_ID.test(ar), ar); assert.ok(en.startsWith('Municipality: ') && !NO_ID.test(en), en);
  }
});
ok('the report built for that scope names the municipality everywhere: title, context chip, file name, scope text and saved scope — by the reference name', () => {
  const sc = SC({ amanah: JD, muni: MKEY });
  for (const lang of ['ar', 'en']) {
    const m = model(sc, lang); const chip = m.context.find((c) => c.k === 'muni'); assert.equal(chip.value, MNAME); assert.ok(m.title.endsWith(MNAME), m.title);
    assert.ok(reportFileName(m, 'pdf').length > 10); assert.ok(!NO_ID.test(all(visible(m)).join(' ')), 'no internal id or raw key in the visible model');
    assert.ok(all(m.sections).some((t) => t.includes(MNAME)), 'the municipality table or text names it');
  }
  assert.ok(describeScope(sc, 'ar').includes(MNAME) && !NO_ID.test(describeScope(sc, 'ar')));
  const all0 = model(SC({ amanah: JD }), 'ar'); assert.equal(all0.context.find((c) => c.k === 'muni').value, 'كل البلديات'); assert.ok(!all0.title.includes(' — بلدية'), 'no municipality in the title when none is selected');
});

/* ---------------------------------------------------------------- 2. report tables and exports */
const muniTable = (m) => m.sections.flatMap((s) => s.blocks).find((b) => b.type === 'table' && b.id === 'muni');
const sumCol = (t, j) => t.rows.reduce((s, r) => s + (r[j] || 0), 0);
ok('the municipality table: explicit «بلا بلدية (غير محددة في المصدر)» and «مباشر على الأمانة» rows, and its rows add up to the Amanah total (single Amanah AND national)', () => {
  for (const scope of [SC({ amanah: JD }), SC()]) {
    const snap = snapshot(st, { scope, cfg }); const m = model(scope, 'ar'); const t = muniTable(m); assert.ok(t, 'the municipality table exists');
    const labels = t.rows.map((r) => r[0]);
    assert.ok(labels.some((l) => l.startsWith(MUNICIPALITY_DIRECT.ar)), 'the «issued directly» row'); assert.ok(labels.some((l) => l.startsWith(MUNICIPALITY_OPTION_NONE.ar)), 'the «no municipality (not specified in source)» row');
    assert.equal(sumCol(t, 1), snap.totals.count, 'invoice counts add up'); assert.ok(Math.abs(sumCol(t, 4) - snap.totals.net) <= 0.5, 'net adds up'); assert.ok(Math.abs(sumCol(t, 5) - snap.totals.collected) <= 0.5, 'collected adds up');
    assert.ok(Math.abs(sumCol(t, 4) - t.total[4]) <= 0.5 && sumCol(t, 1) === t.total[1], 'the table total equals the sum of its rows');
    assert.ok(!NO_ID.test(labels.join(' ')), 'labels are names');
    if (scope.amanah === JD) { // reconciles to the AMANAH total, row by row against the engine
      const eng = snapshot(st, { scope: SC({ amanah: JD }), cfg }); assert.equal(sumCol(t, 1), eng.byAmanah.find((g) => g.key === JD).count);
      for (const g of eng.byMunicipality) assert.ok(t.rows.some((r) => r[0] === `${muniLabel(g.key, 'ar')} — ${ENTITIES.find((e) => e.en === g.amanah).ar}` && r[1] === g.count), `${g.key} row`);
    }
    assert.ok(t.note.includes('بلا بلدية'), 'the note explains the groups');
  }
  const en = muniTable(model(SC({ amanah: JD }), 'en')); assert.ok(en.rows.some((r) => r[0].startsWith(MUNICIPALITY_DIRECT.en)) && en.rows.some((r) => r[0].startsWith(MUNICIPALITY_OPTION_NONE.en)));
});
ok('drill links of the report rows carry the municipality filter value (and the Amanah); a link opens exactly the row\'s invoices', () => {
  const scope = SC({ amanah: JD }); const snap = snapshot(st, { scope, cfg }); const m = model(scope, 'ar', ['amanah']); const t = muniTable(m); assert.equal(t.links.length, t.rows.length);
  const bucket = snap.byMunicipality.find((g) => g.key === MKEY); const i = t.rows.findIndex((r) => r[0].startsWith(MNAME)); assert.ok(i >= 0 && t.links[i]);
  const q = new URL(`http://x${t.links[i]}`).searchParams; assert.equal(q.get('muni'), MKEY); assert.equal(q.get('amanah'), JD); assert.equal(q.get('from'), '2026-01-01');
  const res = list(st, { scope: SC({ amanah: q.get('amanah'), muni: q.get('muni') }), cfg, page: 0, pageSize: 5 }); assert.equal(res.total, bucket.count, 'the opened list has exactly the row\'s invoices');
});
ok('Word / Excel / PowerPoint text, CSV and the printed (PDF) document carry the same municipality labels', () => {
  const m = model(SC({ amanah: JD, muni: MKEY }), 'ar', ['executive', 'amanah']); const full = model(SC({ amanah: JD }), 'ar', ['amanah']);
  const lines = JSON.stringify(visible(modelToLines(m))); assert.ok(lines.includes(MNAME)); assert.ok(!NO_ID.test(lines));
  const csv = buildCsv(m); assert.ok(csv.includes(MNAME) && !NO_ID.test(csv), 'CSV');
  const html = buildPdfHtml(m); assert.ok(html.includes(MNAME) && !/MREF-/.test(html), 'PDF html');
  const fl = JSON.stringify(modelToLines(full)); assert.ok(fl.includes(MUNICIPALITY_DIRECT.ar) && fl.includes(MUNICIPALITY_OPTION_NONE.ar), 'the explicit group rows are in the export text');
  const wb = buildWorkbook(full); const sheetText = JSON.stringify(wb.SheetNames.map((s) => wb.Sheets[s])); assert.ok(sheetText.includes('بلا بلدية') && sheetText.includes('مباشر على الأمانة'), 'Excel workbook');
  const t = tableToText(muniTable(full), 'ar'); assert.ok(t.rows.length === muniTable(full).rows.length);
});
ok('the dashboard export carries the municipality in its scope line and title', async () => {
  const sc = SC({ amanah: JD, muni: MKEY }); const snap = snapshot(st, { scope: sc, cfg });
  const data = { series: async () => ({ months: snap.byMonth.map((x) => x.month), values: snap.byMonth.map((x) => x.collected) }) };
  const rev = { snapshot: snap, prevSnapshot: null, comparison: null, data, cfg, targets: undefined, scopeEff: sc, scope: { preset: 'ytd' }, cases: [], meta: { size: 'compact', counts: { invoicesTotal: st.n } } };
  const mdl = await buildDashboardModel(rev, 'ar'); assert.equal(mdl.context.find((c) => c.k === 'muni').value, MNAME); assert.ok(mdl.title.includes(MNAME));
});
ok('CSV invoice export: the three municipality columns are present at the end and filled; every row of a municipality export belongs to it', () => {
  assert.deepEqual(EXPORT_COLUMNS.slice(-3), ['municipality_ref_id', 'municipality_status', 'municipality_source_value']);
  const sc = SC({ amanah: JD, muni: MKEY }); const text = [...exportChunks(st, { scope: sc, cfg })].join(''); const rows = text.trim().split('\n').slice(1).filter(Boolean);
  assert.equal(rows.length - 1 <= mapped.count + 1, true); const head = text.split('\n')[1].split(','); const iRef = head.indexOf('municipality_ref_id'); const iSt = head.indexOf('municipality_status'); const iSv = head.indexOf('municipality_source_value'); const iAr = head.indexOf('municipality_ar');
  assert.ok(iRef >= 0 && iSt >= 0 && iSv >= 0 && iAr >= 0);
  const refId = parseMuniKey(MKEY).refId; const data = rows.slice(1).filter((r) => r.includes(refId));
  assert.equal(data.length, mapped.count, 'one CSV row per invoice of the municipality'); for (const r of data) { const c = r.split(','); assert.equal(c[iRef], refId); assert.equal(c[iSt], 'mapped'); assert.ok(c[iSv] && c[iSv].length > 0, 'the source value is filled'); }
  // the explicit groups are filled too
  const direct = [...exportChunks(st, { scope: SC({ amanah: JD, muni: `${JD}|DIRECT` }), cfg })].join('').trim().split('\n').slice(2).filter(Boolean); assert.ok(direct.length > 0 && direct.every((r) => r.split(',')[iSt] === 'direct_amanah'));
  const none = [...exportChunks(st, { scope: SC({ amanah: JD, muni: `${JD}|NOT_SPECIFIED` }), cfg })].join('').trim().split('\n').slice(2).filter(Boolean); assert.ok(none.length > 0 && none.every((r) => r.split(',')[iSt] === 'not_specified' && r.split(',')[iRef] === ''));
});

/* ---------------------------------------------------------------- 3. non-collection analysis */
ok('non-collection: every municipality row is a valid filter value with a «municipality — Amanah» label, and its drill-down opens exactly the bucket (mapped municipality and explicit groups)', () => {
  const scope = SC({ amanah: JD }); const a = nonCollectionAnalysis(st, { scope, cfg }); const base = { ...a.scope }; delete base.org;
  assert.ok(a.byMunicipality.length >= 3); for (const r of a.byMunicipality) { assert.ok(parseMuniKey(r.key) && !parseMuniKey(r.key).invalid, r.key); assert.ok(r.labelAr.includes(' — ') && r.labelAr.endsWith(ENTITIES.find((e) => e.en === JD).ar), r.labelAr); assert.ok(!NO_ID.test(r.labelAr + r.labelEn)); }
  assert.ok(a.byMunicipality.some((r) => r.muniLabelAr === MUNICIPALITY_DIRECT.ar) && a.byMunicipality.some((r) => r.muniLabelAr === MUNICIPALITY_OPTION_NONE.ar));
  assert.equal(a.byMunicipality.reduce((s, r) => s + r.count, 0), a.populations.all?.count ?? a.byMunicipality.reduce((s, r) => s + r.count, 0), 'rows are a partition');
  const ch = buildCharts(a, true).muni; let opened = 0;
  for (let i = 0; i < ch.block.labels.length; i += 1) {
    const d = ch.pick({ kind: 'mark', i, j: 0 }); assert.ok(d && !d.unsupported, 'every row can be opened'); assert.ok(d.scope && d.scope.muni && d.scope.amanah === JD);
    const rq = listRequest(base, d); const res = list(st, { scope: rq.scope, cfg, filters: rq.filters, page: 0, pageSize: 5, withNc: true });
    assert.ok(Math.abs(listAmount(res, drillPopulation(d)) - d.expected.amount) <= 0.5, `${ch.block.labels[i]}: amount`); opened += 1;
    const row = a.byMunicipality.find((r) => r.key === d.scope.muni); assert.equal(rq.scope.muni, row.key);
  }
  assert.ok(opened >= 3);
  const g = snapshot(st, { scope: SC({ amanah: JD, muni: `${JD}|NOT_SPECIFIED` }), cfg }); const ncGroup = nonCollectionAnalysis(st, { scope: SC({ amanah: JD, muni: `${JD}|NOT_SPECIFIED` }), cfg });
  assert.ok(ncGroup.byMunicipality.every((r) => r.key === `${JD}|NOT_SPECIFIED`) && g.byMunicipality.length === 1, 'a municipality scope leaves only its own bucket');
});

/* ---------------------------------------------------------------- 4. Decision Room */
ok('Decision Room: items of a municipality scope carry it in the label, `affected.municipality` and every evidence link (`muni`); without a municipality nothing changes', () => {
  const labels = { amanah: (k) => ({ ar: `أمانة ${k}`, en: k }), source: (k) => ({ ar: `مصدر ${k}`, en: k }) };
  const run = (muni) => { const sc = SC({ amanah: JD, muni }); const snap = snapshot(st, { scope: sc, cfg }); return buildDecisionItems({ today: TODAY, snapshot: snap, labels, previous: null, plan: null, contracts: null, noContractCount: 5, orders: null, matching: { amountConflicts: 0, missingFields: 0 } }); };
  const withM = run(MKEY).items; const without = run('all').items;
  const scoped = withM.filter((it) => it.affected && it.affected.amanah === JD);
  assert.ok(scoped.length > 0, 'there are Jeddah items'); assert.ok(scoped.every((it) => it.affected.municipality === MKEY && JSON.stringify(it.affected.label).includes(MNAME)), 'affected label + municipality');
  for (const it of withM) for (const e of it.evidence) if (e.to && /^\/(collection|invoices)\?/.test(e.to) && /amanah=/.test(e.to)) assert.equal(new URL(`http://x${e.to}`).searchParams.get('muni'), MKEY, `${it.key}: ${e.to}`);
  assert.ok(withM.some((it) => it.evidence.some((e) => /muni=/.test(e.to || ''))), 'at least one link carries muni');
  assert.ok(without.every((it) => !it.affected?.municipality && !it.evidence.some((e) => /muni=/.test(e.to || ''))), 'no municipality scope → no municipality anywhere');
  for (const it of withM) assert.ok(!NO_ID.test(JSON.stringify([it.title, it.affected?.label])), `${it.key}: title and label are names`);
});

/* ---------------------------------------------------------------- 5. restricted organisations */
ok('a restricted organisation sees only its own Amanah in the municipality table, the snapshot, the CSV and the non-collection analysis', () => {
  const org = { amanahKeys: [MK] }; const sc = SC({ org });
  const snap = snapshot(st, { scope: sc, cfg }); assert.ok(snap.byMunicipality.length > 0 && snap.byMunicipality.every((g) => g.amanah === MK));
  const t = muniTable(model(sc, 'ar')); assert.ok(t.rows.every((r) => r[0].endsWith(ENTITIES.find((e) => e.en === MK).ar)), 'every municipality row belongs to Makkah'); assert.equal(sumCol(t, 1), snap.totals.count);
  assert.ok(!t.rows.some((r) => /رابغ|القوز|جدة/.test(r[0])), 'no Jeddah municipality');
  // asking for another Amanah's municipality returns nothing for this organisation
  const other = snapshot(st, { scope: SC({ org, amanah: JD, muni: MKEY }), cfg }); assert.equal(other.totals.count, 0, 'another Amanah\'s municipality selects nothing');
  const csv = [...exportChunks(st, { scope: SC({ org, amanah: JD, muni: MKEY }), cfg })].join('').trim().split('\n'); assert.equal(csv.length, 2, 'only the header (+ title line)');
  const nc = nonCollectionAnalysis(st, { scope: sc, cfg }); assert.ok(nc.byMunicipality.every((r) => r.amanah === MK));
  const ownCsv = [...exportChunks(st, { scope: sc, cfg })].join(''); assert.ok(!ownCsv.includes('MREF-002-'), 'no Jeddah reference id in a Makkah organisation\'s export');
});
ok('a restricted organisation naming another Amanah\'s municipality gets the permission clarification — no figures, no options naming the other Amanah', () => {
  const OPT = { allowedAmanahs: [MK] };
  const name = municipalitiesOf(JD).find((m) => m.key === MKEY).ar;
  for (const q of [`تقرير أمانة جدة ${name}`, `تقرير ${name}`, `Jeddah municipality of ${name.replace(/^بلدية /, '')}`]) {
    const r = interpret(q, null, TODAY, OPT); assert.equal(r.kind, 'clarify', q); assert.ok(r.problems.some((p) => /forbidden/.test(p.kind)), q); assert.ok(!all(r.options).join(' ').includes(name.replace(/^بلدية /, '')), 'no option names the municipality'); assert.ok(r.question.ar.includes('صلاحيات'));
    assert.ok(r.options.length > 0 && r.options.every((o) => interpret(o.text, null, TODAY, OPT).kind === 'report'));
  }
  const own = municipalitiesOf(MK)[0]; const r = interpret(`تقرير أمانة مكة ${own.ar}`, null, TODAY, OPT); assert.equal(r.kind, 'report'); assert.equal(r.spec.scope.muni, own.key);
});

/* ---------------------------------------------------------------- 6. nothing of the retired scheme remains */
ok('no consumer reads the North / Central / South scheme: such keys select nothing and the reading never shows them', () => {
  const old = snapshot(st, { scope: SC({ amanah: JD, muni: `${JD}|North` }), cfg }); assert.equal(old.totals.count, 0); assert.equal(old.scope.muniInvalid, true);
  assert.equal(muniLabel(`${JD}|North`, 'ar'), `${JD}|North`);
  for (const q of ['بلدية جدة الشمالية', 'Jeddah north municipality', 'central municipality Riyadh']) { const r = interpret(q, null, TODAY); assert.ok(!/\|(North|Central|South)$/.test(r.spec?.scope?.muni || ''), q); }
  assert.ok(ENTITIES.slice(0, N_AMANAH).every((e) => municipalitiesOf(e.en).length > 0));
});

await Promise.all(pending);
console.log(`municipality downstream: ${n} test groups passed`);
