// Municipality hierarchy + invoice municipality model + dependent filter. Run: npm run test:muni  (synthetic data only; the reference workbook is NOT in the repository — the generated module carries its recorded counts).
import assert from 'node:assert/strict';
import { geoScopeFromAmanahKeys } from '../src/data/geoScope.js';
import { ENTITIES, N_AMANAH, ENT_HOUSING } from '../src/data/catalog.js';
import { HIERARCHY, HIERARCHY_META, municipalitiesOf, municipalityByKey, amanahSelfOf, hierarchyIssues, flaggedEntries, MUNICIPALITY_NOT_SPECIFIED, MAX_MUNICIPALITIES } from '../src/data/amanahHierarchy.js';
import {
  MCODE, STATUSES, parseMuniKey, isValidMuniKey, amanahOfMuniKey, muniLabel, municipalityFilterOptions, classifySourceValues, demoMunicipalityCode, municipalityFields,
  SOURCE_MUNICIPALITY_FIELDS, statusOfCode, MUNICIPALITY_DIRECT, DEMO_SHARE
} from '../src/data/municipalityModel.js';
import { compositeKey, demoMunicipalityId, demoAmanahId, parseCompositeKey } from '../src/data/invoiceIdentity.js';
import { buildScopeDefs, scopeToValues } from '../src/components/filters/filterConfig.js';
import { cascadePatch, clearedNoticeText, deriveChips, municipalityOptions, municipalityLabel, defaultValueText } from '../src/components/filters/filterLogic.js';
import { loadStore } from '../server/store.js';
import { iimFields } from '../server/iimRow.js';
import { snapshot, makeCtx, resolveScope } from '../server/engine.js';
import { list, exportChunks, EXPORT_COLUMNS } from '../server/lists.js';
import { materialize } from '../server/materialize.js';
import { handleApi } from '../server/api.js';
import { setAuthenticator } from '../server/api.js';
import { PERMISSION_IDS } from '../src/data/permissions.js';
// these tests call the HTTP handler directly: authenticate them as a full administrator (the authorization behaviour itself is covered by tests/authz-server.test.mjs)
setAuthenticator(() => ({ user: { id: 'usr-test-admin' }, access: { permissions: new Set(PERMISSION_IDS), scopes: Object.fromEntries(PERMISSION_IDS.map((p) => [p, { all: true }])) }, accessVersion: 1 }));


let n = 0; const pending = [];
const ok = (name, fn) => { try { const r = fn(); if (r && typeof r.then === 'function') pending.push(r.then(() => { n += 1; }, (e) => { console.error(`FAIL: ${name}`); throw e; })); else n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };
const AMANAHS = ENTITIES.slice(0, N_AMANAH).map((e) => e.en);
const FROM = '2025-01-01'; const TO = '2026-11-06';
const sc = (extra = {}) => ({ from: FROM, to: TO, ...extra });

/* ------------------------------------------------------------------ 1. the hierarchy (reference workbook, names only) */
ok('the generated hierarchy is structurally valid', () => assert.deepEqual(hierarchyIssues(), []));
ok('recorded reference counts: 285 rows · 17 self rows · 1 ministry row · 267 municipalities (266 regular + 1 oddly formatted) · 18 distinct parents', () => {
  const m = HIERARCHY_META;
  assert.equal(m.rows, 285); assert.equal(HIERARCHY.length, 285); assert.equal(m.selfRows, 17); assert.equal(m.ministryRows, 1);
  assert.equal(m.municipalities, 267); assert.equal(m.municipalitiesRegularName, 266); assert.equal(m.nameFormatEntries, 1); assert.equal(m.distinctParents, 18); assert.equal(m.amanahsResolved, 17);
  assert.equal(HIERARCHY.filter((e) => e.kind === 'municipality').length, 267);
  assert.equal(17 + 1 + 267, 285);
});
ok('every resolved parent is one of the project Amanahs; all 17 Amanahs are present with exactly one self row', () => {
  for (const a of AMANAHS) { assert.ok(amanahSelfOf(a), `${a} has a self row`); assert.ok(municipalitiesOf(a).length > 0, `${a} has municipalities`); }
  for (const e of HIERARCHY) if (e.amanahKey) assert.ok(AMANAHS.includes(e.amanahKey), e.amanahKey);
  assert.deepEqual(municipalitiesOf('Housing Sector'), []); assert.deepEqual(municipalitiesOf('nope'), []);
});
ok('municipalities per Amanah match the reference counts and add up to 267; the Amanah itself is never a municipality', () => {
  let total = 0;
  for (const a of AMANAHS) { const list = municipalitiesOf(a); total += list.length; assert.equal(list.length, HIERARCHY_META.municipalitiesPerAmanah[a], a); for (const m of list) { assert.equal(m.kind, 'municipality'); assert.notEqual(m.ar, amanahSelfOf(a).nameAr); } }
  assert.equal(total, 267);
  assert.equal(municipalitiesOf('Jeddah Amanah').length, 15, 'the Jeddah reference has 16 rows: its own row + 15 municipalities');
  assert.equal(municipalitiesOf('Riyadh Amanah').length, 47); assert.equal(MAX_MUNICIPALITIES, 47);
  assert.equal(municipalitiesOf('Makkah Amanah').length, 3, 'the Makkah Amanah is named «أمانة العاصمة المقدسة» in the reference');
});
ok('flags: the spelling variant (Hafr Al-Batin parent), the ministry row, the oddly formatted name (original text kept) and the aliased parent names', () => {
  const hafr = HIERARCHY.filter((e) => e.amanahKey === 'Hafr Al-Batin Amanah'); assert.ok(hafr.every((e) => e.flags.includes('spelling_variant')) && hafr.length === 5);
  assert.ok(amanahSelfOf('Hafr Al-Batin Amanah').flags.includes('amanah_self'));
  const min = HIERARCHY.find((e) => e.kind === 'ministry_hq'); assert.ok(min.flags.includes('ministry_hq') && min.flags.includes('spelling_variant') && min.amanahKey === null);
  const odd = HIERARCHY.filter((e) => e.flags.includes('name_format')); assert.equal(odd.length, 1);
  assert.equal(odd[0].sourceNameAr, '(بلدية القوز(القنفذة', 'the original text is preserved'); assert.equal(odd[0].nameAr, 'بلدية القوز (القنفذة)'); assert.equal(odd[0].amanahKey, 'Jeddah Amanah'); assert.equal(odd[0].kind, 'municipality');
  assert.deepEqual(HIERARCHY_META.parentAliases.map((a) => a.amanahKey).sort(), ['Al Madinah Amanah', 'Makkah Amanah']);
  assert.ok(flaggedEntries().length >= 8);
});
ok('no name appears twice, no municipality under two parents, internal ids are unique, well formed and NOT official codes', () => {
  const names = HIERARCHY.filter((e) => e.kind === 'municipality').map((e) => e.sourceNameAr); assert.equal(new Set(names).size, names.length);
  const refs = HIERARCHY.map((e) => e.ref).filter(Boolean); assert.equal(new Set(refs).size, refs.length); assert.ok(refs.every((r) => /^MREF-\d{3}-\d{3}$/.test(r)));
  assert.equal(HIERARCHY_META.duplicateNames, 0); assert.equal(HIERARCHY_META.childrenUnderTwoParents, 0);
  const j = municipalitiesOf('Jeddah Amanah')[0]; assert.equal(j.refId, 'MREF-002-001'); assert.equal(municipalityByKey(j.key).refId, j.refId); assert.equal(municipalityByKey('Riyadh Amanah|MREF-002-001'), null, 'a municipality key is only valid under its own Amanah');
});

/* ------------------------------------------------------------------ 2. keys, options, classification */
ok('filter keys: stable, parsed, validated; the retired demo scheme and foreign keys are invalid (never "all", never a blank)', () => {
  const j = municipalitiesOf('Jeddah Amanah')[3];
  assert.equal(parseMuniKey('all'), null); assert.equal(parseMuniKey(undefined), null);
  const p = parseMuniKey(j.key); assert.equal(p.kind, 'mapped'); assert.equal(p.refId, j.refId); assert.equal(p.ent, 1); assert.equal(amanahOfMuniKey(j.key), 'Jeddah Amanah');
  assert.equal(parseMuniKey('Jeddah Amanah|NOT_SPECIFIED').kind, 'not_specified'); assert.equal(parseMuniKey('Jeddah Amanah|DIRECT').kind, 'direct_amanah'); assert.deepEqual(parseMuniKey('Jeddah Amanah|UNRESOLVED').codes, [2, 3]);
  for (const bad of ['Jeddah Amanah|North', 'Housing Sector|Sales', 'Riyadh Amanah|MREF-002-001', 'junk', 'Jeddah Amanah|MREF-002-999']) { assert.equal(parseMuniKey(bad).invalid, true, bad); assert.equal(isValidMuniKey(bad), false); }
  assert.equal(muniLabel('Jeddah Amanah|NOT_SPECIFIED', 'ar'), 'بلا بلدية (غير محددة في المصدر)'); assert.equal(muniLabel(j.key, 'ar'), j.ar);
});
ok('options: Jeddah → exactly its 15 municipalities (+3 explicit groups); none for all / several / the Housing Sector; counts per Amanah match the reference', () => {
  const o = municipalityFilterOptions('Jeddah Amanah'); assert.equal(o.length, 3 + 15);
  assert.deepEqual(o.slice(0, 3).map((x) => x.kind), ['direct_amanah', 'not_specified', 'unresolved']);
  assert.equal(o.filter((x) => x.kind === 'mapped').length, 15); assert.ok(o.filter((x) => x.kind === 'mapped').every((x) => x.value.startsWith('Jeddah Amanah|MREF-002-')));
  assert.ok(!o.some((x) => String(x.label.ar).includes('أمانة محافظة جدة')), 'the Amanah\'s own row is not an option');
  for (const bad of ['all', undefined, ['Jeddah Amanah', 'Riyadh Amanah'], 'Housing Sector', 'nope']) assert.deepEqual(municipalityFilterOptions(bad), []);
  let mapped = 0; for (const a of AMANAHS) { const c = municipalityFilterOptions(a).filter((x) => x.kind === 'mapped').length; assert.equal(c, HIERARCHY_META.municipalitiesPerAmanah[a]); mapped += c; }
  assert.equal(mapped, 267);
  assert.deepEqual(municipalityOptions('Jeddah Amanah').map((x) => x.value), o.map((x) => x.value));
});
ok('classification of source values: mapped · direct · not specified · unmapped · conflict — nothing inferred', () => {
  const jed = ENTITIES.findIndex((e) => e.en === 'Jeddah Amanah'); const first = municipalitiesOf('Jeddah Amanah')[0];
  assert.equal(classifySourceValues(jed, []).status, 'not_specified'); assert.equal(classifySourceValues(jed, [null, '']).status, 'not_specified');
  const m = classifySourceValues(jed, [first.ar]); assert.equal(m.status, 'mapped'); assert.equal(m.refId, first.refId);
  assert.equal(classifySourceValues(jed, [first.ar.replace('بلدية', 'بلديه')]).status, 'mapped', 'spelling variants of the same name still match (Arabic normalisation)');
  assert.equal(classifySourceValues(jed, [ENTITIES[jed].ar]).status, 'direct_amanah');
  assert.equal(classifySourceValues(jed, ['بلدية غير موجودة']).status, 'unmapped_source_value');
  assert.equal(classifySourceValues(jed, [first.ar, 'بلدية غير موجودة']).status, 'conflict');
  assert.equal(classifySourceValues(jed, [first.ar, municipalitiesOf('Jeddah Amanah')[1].ar]).status, 'conflict');
  assert.equal(classifySourceValues(jed, [first.ar, first.ar]).status, 'mapped');
  const ruy = ENTITIES.findIndex((e) => e.en === 'Riyadh Amanah'); assert.equal(classifySourceValues(ruy, [first.ar]).status, 'unmapped_source_value', 'a Jeddah municipality under the Riyadh Amanah is not a match');
  assert.equal(classifySourceValues(ENT_HOUSING, []).status, 'direct_amanah');
  assert.deepEqual(STATUSES.slice().sort(), ['conflict', 'direct_amanah', 'mapped', 'not_specified', 'unmapped_source_value']);
});
ok('the synthetic stand-in is deterministic, never defaults to the first municipality, never infers from anything else; white lands carry no municipality', () => {
  const jed = 1; const seen = new Map();
  for (let s = 1; s <= 4000; s += 1) { const a = demoMunicipalityCode(jed, 2026 * 1e8 + s, 'municipal_fees'); assert.equal(a, demoMunicipalityCode(jed, 2026 * 1e8 + s, 'municipal_fees')); seen.set(a, (seen.get(a) || 0) + 1); }
  const mapped = [...seen].filter(([c]) => c >= MCODE.FIRST_MAPPED); assert.equal(mapped.length, 15, 'every Jeddah municipality is used'); assert.ok(mapped.every(([, v]) => v > 40));
  const direct = seen.get(MCODE.DIRECT) / 4000 * 100; const none = seen.get(MCODE.NOT_SPECIFIED) / 4000 * 100;
  assert.ok(Math.abs(direct - DEMO_SHARE.direct_amanah) < 3 && Math.abs(none - DEMO_SHARE.not_specified) < 3, `shares ${direct.toFixed(1)} / ${none.toFixed(1)}`);
  assert.equal(demoMunicipalityCode(jed, 12345, 'white_lands'), MCODE.NOT_SPECIFIED); assert.equal(demoMunicipalityCode(ENT_HOUSING, 12345, 'housing_sales'), MCODE.DIRECT);
});
ok('the source-field mapping covers all 8 supplying systems; white lands and housing are marked unverified', () => {
  assert.deepEqual(Object.keys(SOURCE_MUNICIPALITY_FIELDS).sort(), ['accommodation', 'fines', 'housing_sales', 'investment', 'licenses', 'municipal_fees', 'tobacco', 'white_lands']);
  assert.ok(SOURCE_MUNICIPALITY_FIELDS.municipal_fees.municipalityFields.includes('BALADYA_KEY')); assert.ok(SOURCE_MUNICIPALITY_FIELDS.licenses.municipalityFields.includes('BALADIAID')); assert.ok(SOURCE_MUNICIPALITY_FIELDS.tobacco.municipalityFields.includes('ARABIC_BALADYA_NAME'));
  assert.equal(SOURCE_MUNICIPALITY_FIELDS.white_lands.verified, false); assert.equal(SOURCE_MUNICIPALITY_FIELDS.white_lands.municipalityFields.length, 0);
});

/* ------------------------------------------------------------------ 3. the dependent filter (pure logic of the toolbar) */
ok('the municipality filter is disabled with «Select an Amanah first» until ONE Amanah is chosen, then lists that Amanah only; changing the Amanah clears it visibly', () => {
  const defs = buildScopeDefs(['amanah', 'municipality'], {}); const mu = defs.find((d) => d.key === 'municipality');
  assert.equal(mu.searchable, true); assert.equal(mu.dependsOn, 'amanah'); assert.deepEqual(mu.options({ amanah: 'all' }), [{ value: 'all', label: { ar: 'اختر أمانة أولاً', en: 'Select an Amanah first' } }], 'the placeholder is INSIDE the disabled control'); assert.equal(mu.options({ amanah: 'Housing Sector' })[0].label.en, 'No municipalities for this entity');
  assert.equal(mu.disabled({ amanah: 'all' }), true); assert.equal(mu.disabled({ amanah: ['a', 'b'] }), true); assert.equal(mu.disabled({ amanah: 'Jeddah Amanah' }), false);
  const opts = mu.options({ amanah: 'Jeddah Amanah' }); assert.equal(opts[0].value, 'all'); assert.equal(opts[0].label.ar, 'كل البلديات'); assert.equal(opts.length, 1 + 3 + 15);
  const jed = municipalitiesOf('Jeddah Amanah')[2];
  const r = cascadePatch(defs, { amanah: 'Jeddah Amanah', municipality: jed.key }, { amanah: 'Riyadh Amanah' });
  assert.equal(r.values.municipality, 'all'); assert.deepEqual(r.cleared, ['municipality']); assert.ok(clearedNoticeText(defs, r.cleared, 'ar').length > 0);
  const same = cascadePatch(defs, { amanah: 'Jeddah Amanah', municipality: jed.key }, { amanah: 'Jeddah Amanah' }); assert.equal(same.values.municipality, jed.key);
  const cleared = cascadePatch(defs, { amanah: 'Jeddah Amanah', municipality: jed.key }, { amanah: 'all' }); assert.equal(cleared.values.municipality, 'all', 'clearing the Amanah clears the municipality');
  const chips = deriveChips(defs, { amanah: 'Jeddah Amanah', municipality: jed.key }, { lang: 'ar', valueText: (d, v) => defaultValueText({ ...d, options: typeof d.options === 'function' ? d.options({ amanah: 'Jeddah Amanah', municipality: jed.key }) : d.options }, v, 'ar') });
  const chip = chips.find((c) => c.key === 'municipality'); assert.ok(chip && chip.value === jed.ar, 'an active municipality chip shows the municipality name'); assert.ok(!chips.some((c) => c.key === 'municipality' && c.value.includes('كل')));
  assert.equal(scopeToValues({ amanah: 'Jeddah Amanah', muni: jed.key }).municipality, jed.key);
  assert.equal(municipalityLabel('Jeddah Amanah|DIRECT', 'en'), MUNICIPALITY_DIRECT.en);
});

/* ------------------------------------------------------------------ 4. the data (compact demo world) */
const today = TO; const TODAY_API = TO; process.env.DEMO_SIZE = 'compact';
const st = loadStore(today);
const LIVE = []; for (let i = 0; i < st.n; i += 1) if (st.owner[i] !== 65535) LIVE.push(i);
ok('every invoice carries Amanah + municipality fields with a status; mapped ones are reference municipalities of THEIR Amanah; not-specified rows carry the exact wording and no name', () => {
  const seen = {};
  for (const i of LIVE) {
    const im = iimFields(st, i); seen[im.municipalityStatus] = (seen[im.municipalityStatus] || 0) + 1;
    assert.ok(STATUSES.includes(im.municipalityStatus)); assert.ok(im.amanahId && im.municipalityKey);
    if (im.municipalityStatus === 'mapped') { const m = municipalityByKey(im.municipalityKey); assert.ok(m && m.amanahKey === ENTITIES[st.ent[i]].en && m.refId === im.municipalityRefId && im.municipalityAr === m.ar); assert.equal(im.municipalitySourceValue, m.sourceNameAr); }
    else { assert.equal(im.municipalityAr, null); assert.equal(im.municipalityRefId, null); }
    if (im.municipalityStatus === 'not_specified') { assert.equal(im.municipalityNote.ar, 'البلدية غير محددة في المصدر'); assert.equal(im.municipalityNote.en, 'Municipality not specified in source'); assert.equal(im.municipalitySourceValue, null); }
    assert.ok(im.municipalitySource.system, 'the supplying system is named'); assert.equal(im.municipalitySource.system, SOURCE_MUNICIPALITY_FIELDS[['investment', 'fines', 'municipal_fees', 'licenses', 'accommodation', 'tobacco', 'white_lands', 'housing_sales'][st.src[i]]].system);
  }
  assert.ok(seen.mapped > 100 && seen.not_specified > 20 && seen.direct_amanah > 50, JSON.stringify(seen));
  assert.ok(seen.unmapped_source_value >= 1 && seen.conflict >= 1, `the fixtures carry an unmapped and a conflicting source value: ${JSON.stringify(seen)}`);
});
ok('white-land invoices never get a municipality (the source gives a city only); Housing-sector invoices are issued directly', () => {
  for (const i of LIVE) { const im = iimFields(st, i); if (st.src[i] === 6 && i < st.nGen && st.ent[i] < N_AMANAH) assert.equal(im.municipalityStatus, 'not_specified'); if (st.ent[i] === ENT_HOUSING && i < st.nGen) assert.equal(im.municipalityStatus, 'direct_amanah'); }
});
ok('detail record (materialize) carries the same municipality fields; a fixture keeps the text its source gave', () => {
  const i = LIVE.find((x) => iimFields(st, x).municipalityStatus === 'mapped'); const rec = materialize(st, i); const im = iimFields(st, i);
  assert.equal(rec.municipalityStatus, 'mapped'); assert.equal(rec.municipalityAr, im.municipalityAr); assert.equal(rec.municipalityRefId, im.municipalityRefId);
  const cf = LIVE.find((x) => iimFields(st, x).municipalityStatus === 'conflict'); const fr = materialize(st, cf); assert.equal(fr.municipalityStatus, 'conflict'); assert.ok(fr.municipalitySourceValue.includes(' / ')); assert.equal(fr.municipalityAr, null);
  const um = LIVE.find((x) => iimFields(st, x).municipalityStatus === 'unmapped_source_value'); assert.ok(iimFields(st, um).municipalitySourceValue.startsWith('بلدية'));
});

/* ---- identity: the composite keys do not move ---- */
ok('composite keys: the optional `mu` component still reads the LEGACY demo field (keys unchanged), is distinct from the reference municipality, and every key is unique', () => {
  const keys = new Set(); const keysNoMu = new Set(); let withMu = 0;
  for (const i of LIVE) {
    const im = iimFields(st, i); assert.equal(im.municipalityId, i < st.nGen ? demoMunicipalityId(st.muni[i]) : null, 'legacy component'); if (im.municipalityId) withMu += 1;
    assert.ok(im.compositeKey && im.compositeKey.startsWith('ick1|')); keys.add(im.compositeKey);
    const p = parseCompositeKey(im.compositeKey); assert.equal(p.amanahId, demoAmanahId(st.ent[i])); assert.equal(p.municipalityId ?? null, im.municipalityId);
    keysNoMu.add(compositeKey({ invoiceId: p.invoiceId, gfsCode: p.gfsCode, amanahId: p.amanahId }).key);
    assert.ok(!im.compositeKey.includes('MREF'), 'the reference id is never part of the key');
  }
  assert.equal(keys.size, LIVE.length); assert.equal(keysNoMu.size, LIVE.length, 'EVIDENCE: number + GFS + Amanah is already unique in the demo world — the municipality is not needed for uniqueness');
  assert.ok(withMu > 0);
});
ok('the same invoice number in different Amanahs stays distinguishable; a missing municipality never merges two records', () => {
  const byNo = new Map(); for (const i of LIVE) { const im = iimFields(st, i); (byNo.get(im.invoiceNo) || byNo.set(im.invoiceNo, []).get(im.invoiceNo)).push(im); }
  const shared = [...byNo.values()].filter((v) => v.length > 1); assert.ok(shared.length >= 1, 'the demo world has shared numbers');
  for (const g of shared) assert.equal(new Set(g.map((x) => x.compositeKey)).size, g.length);
  const none = LIVE.map((i) => iimFields(st, i)).filter((x) => x.municipalityStatus !== 'mapped'); assert.equal(new Set(none.map((x) => x.compositeKey)).size, none.length);
  // same number + GFS + Amanah in two municipalities would differ only by the municipality part: the key format supports it (mu) and keeps them apart
  const a = compositeKey({ invoiceId: '77', gfsCode: '1', amanahId: '002', municipalityId: '001' }).key; const b = compositeKey({ invoiceId: '77', gfsCode: '1', amanahId: '002', municipalityId: '002' }).key; const c = compositeKey({ invoiceId: '77', gfsCode: '1', amanahId: '002' }).key;
  assert.equal(new Set([a, b, c]).size, 3);
});

/* ---- totals reconcile, per Amanah ---- */
const ZERO = { count: 0, gross: 0, exclusions: 0, net: 0, collected: 0, outstanding: 0 };
const addTo = (acc, g) => { for (const k of Object.keys(ZERO)) acc[k] += g[k] || 0; return acc; };
ok('per Amanah: Σ (mapped municipalities + not specified + issued directly + needs review) = the Amanah total, no double counting; and each group equals its own filtered snapshot', () => {
  for (const a of AMANAHS) {
    const s = snapshot(st, { scope: sc({ amanah: a }) }); assert.equal(s.equation.ok, true, a);
    const sum = s.byMunicipality.reduce(addTo, { ...ZERO }); const t = s.totals;
    for (const k of Object.keys(ZERO)) assert.ok(Math.abs(sum[k] - (t[k] || 0)) < 0.5, `${a} ${k}: ${sum[k]} vs ${t[k]}`);
    assert.ok(s.byMunicipality.every((g) => g.amanah === a)); assert.equal(new Set(s.byMunicipality.map((g) => g.key)).size, s.byMunicipality.length);
    for (const g of s.byMunicipality) {
      const f = snapshot(st, { scope: sc({ amanah: a, muni: g.key }) });
      for (const k of ['count', 'gross', 'net', 'collected', 'outstanding']) assert.ok(Math.abs((f.totals[k] || 0) - g[k]) < 0.5, `${g.key} ${k}`);
      assert.equal(f.equation.ok, true);
    }
    // every selectable option reconciles too: the filter options together cover the Amanah
    const viaOptions = municipalityFilterOptions(a).reduce((acc, o) => addTo(acc, snapshot(st, { scope: sc({ amanah: a, muni: o.value }) }).totals), { ...ZERO });
    assert.equal(viaOptions.count, t.count, `${a}: the filter options cover every invoice exactly once`); assert.ok(Math.abs(viaOptions.net - t.net) < 1);
  }
});
ok('the municipality filter never changes an amount: an Amanah\'s total is the same whether or not municipalities are looked at; the overall total = Σ Amanahs', () => {
  const all = snapshot(st, { scope: sc() }); const per = AMANAHS.concat(['Housing Sector']).reduce((a, e) => addTo(a, snapshot(st, { scope: sc({ amanah: e }) }).totals), { ...ZERO });
  assert.equal(per.count, all.totals.count); assert.ok(Math.abs(per.net - all.totals.net) < 1);
  const sm = snapshot(st, { scope: sc({ amanah: 'all', muni: 'all' }) }); assert.equal(sm.totals.gross, all.totals.gross);
  assert.equal(all.equation.ok, true); assert.equal(all.equation.municipalitiesSumToTotal, true);
});

/* ---- list, KPIs and export follow the same scope ---- */
ok('list rows, KPIs (snapshot) and the CSV export agree for a municipality, and every row belongs to it', () => {
  const a = 'Jeddah Amanah'; const g = snapshot(st, { scope: sc({ amanah: a }) }).byMunicipality.find((x) => x.municipality.status === 'mapped' && x.count > 3); assert.ok(g);
  const scope = sc({ amanah: a, muni: g.key }); const res = list(st, { scope, page: 0, pageSize: 500, filters: { allPeriods: false } });
  const k = snapshot(st, { scope });
  assert.ok(res.rows.length > 0 && res.rows.every((r) => r.municipalityKey === g.key && r.municipalityStatus === 'mapped' && r.amanahEn === a));
  assert.equal(res.total, k.totals.count, 'list total = KPI count');
  const csv = [...exportChunks(st, { scope, filters: { allPeriods: false } })].join(''); const lines = csv.trim().split('\n'); assert.equal(lines.length - 2, res.total, 'CSV rows = list total');
  const head = lines[1].split(','); assert.deepEqual(head.slice(-3), ['municipality_ref_id', 'municipality_status', 'municipality_source_value']); assert.equal(EXPORT_COLUMNS.slice(-3).join(), head.slice(-3).join());
  assert.ok(lines.slice(2).every((l) => l.includes(g.municipality.refId)));
  const none = list(st, { scope: sc({ amanah: a, muni: `${a}|NOT_SPECIFIED` }), page: 0, pageSize: 500, filters: { allPeriods: false } }); assert.ok(none.rows.length > 0 && none.rows.every((r) => r.municipalityStatus === 'not_specified' && r.municipalityAr === null));
});

/* ---- permissions ---- */
ok('a restricted viewer (request-level Amanah narrowing) can neither list nor open another Amanah\'s municipality or invoices through the filter value', () => {
  const org = { amanahKeys: ['Riyadh Amanah'] };
  const jedM = municipalitiesOf('Jeddah Amanah')[0].key; const ryM = municipalitiesOf('Riyadh Amanah')[0].key;
  const own = snapshot(st, { scope: sc({ org, muni: 'all' }) }); assert.ok(own.byMunicipality.every((g) => g.amanah === 'Riyadh Amanah'));
  const foreign = snapshot(st, { scope: sc({ org, amanah: 'Jeddah Amanah', muni: jedM }) }); assert.equal(foreign.totals.count || 0, 0);
  const foreign2 = snapshot(st, { scope: sc({ org, muni: jedM }) }); assert.equal(foreign2.totals.count || 0, 0);
  const l = list(st, { scope: sc({ org, muni: jedM }), page: 0, pageSize: 50, filters: { allPeriods: false } }); assert.equal(l.total, 0); assert.equal(l.rows.length, 0);
  const mine = list(st, { scope: sc({ org, amanah: 'Riyadh Amanah', muni: ryM }), page: 0, pageSize: 50, filters: { allPeriods: false } }); assert.ok(mine.rows.every((r) => r.amanahEn === 'Riyadh Amanah'));
  // the options offered to that viewer are only its own Amanah's (the Amanah select is limited to the account's scope; the municipality list follows the chosen Amanah)
  const defs = buildScopeDefs(['amanah', 'municipality'], { access: geoScopeFromAmanahKeys(org.amanahKeys) }); const am = defs.find((d) => d.key === 'amanah').options({ amanah: 'all' }).map((o) => o.value);
  assert.ok(am.includes('Riyadh Amanah') && !am.includes('Jeddah Amanah'));
});
ok('opening an invoice by id / URL is limited by the request-level narrowing too: another Amanah\'s invoice is «not found», and opens for the right one', async () => {
  const call = (body) => new Promise((resolve) => { const res = { writeHead(c) { this.code = c; }, end(b) { resolve({ code: this.code, body: JSON.parse(b) }); } }; handleApi({ method: 'POST', url: `/api/invoice?today=${TODAY_API}`, headers: {}, body }, res); });
  const jed = LIVE.find((i) => ENTITIES[st.ent[i]].en === 'Jeddah Amanah' && i < st.nGen); const id = iimFields(st, jed).compositeKey; const scope = { from: '2000-01-01', to: TODAY_API };
  assert.equal((await call({ id, scope })).code, 200);
  assert.equal((await call({ id, scope: { ...scope, org: { amanahKeys: ['Riyadh Amanah'] } } })).code, 404);
  assert.equal((await call({ id, scope: { ...scope, org: { amanahKeys: ['Jeddah Amanah'] } } })).code, 200);
});
ok('an invalid / legacy municipality key selects nothing and is reported — it is never widened to "all"', () => {
  const s = snapshot(st, { scope: sc({ amanah: 'Jeddah Amanah', muni: 'Jeddah Amanah|North' }) }); assert.equal(s.totals.count || 0, 0); assert.equal(s.scope.muniInvalid, true);
  const ctx = makeCtx(st, {}); assert.equal(resolveScope(ctx, sc({ muni: 'all' })).muniInvalid, false);
});

/* ---- the explicit statuses exist as pure functions even where the data has none ---- */
ok('municipalityFields: every status renders the right wording and never invents a name', () => {
  const jed = 1;
  const f = (code, sv) => municipalityFields({ ent: jed, code, sourceKey: 'municipal_fees', sourceValue: sv, synthetic: false });
  assert.equal(f(MCODE.NOT_SPECIFIED).municipalityNote.ar, MUNICIPALITY_NOT_SPECIFIED.ar); assert.equal(f(MCODE.NOT_SPECIFIED).municipalityAr, null);
  assert.equal(f(MCODE.UNMAPPED, 'بلدية س').municipalitySourceValue, 'بلدية س'); assert.equal(f(MCODE.UNMAPPED, 'بلدية س').municipalityAr, null);
  assert.equal(f(MCODE.CONFLICT, 'أ / ب').municipalityStatus, 'conflict');
  assert.equal(f(MCODE.FIRST_MAPPED).municipalityAr, municipalitiesOf('Jeddah Amanah')[0].ar); assert.equal(statusOfCode(jed, MCODE.FIRST_MAPPED + 99), 'not_specified', 'a code the Amanah does not have is not guessed');
  assert.equal(f(MCODE.DIRECT).municipalityStatus, 'direct_amanah');
});

await Promise.all(pending);
console.log(`municipality tests: ${n} passed`);
