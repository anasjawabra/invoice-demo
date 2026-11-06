// Access in «التقارير الذكية», saved results, pickers and per-user state — PURE logic with GeoScope fixtures (all · one Amanah entire · selected municipalities of two Amanahs · a single municipality · no access).
// docs/access-control.md §6 and «Implementation notes — Smart Reports and saved state». Run: npm run test:accessreports
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { municipalitiesOf } from '../src/data/amanahHierarchy.js';
import { ENTITIES, N_AMANAH } from '../src/data/catalog.js';
import { ALL_SCOPE, EMPTY_SCOPE, normalizeGeoScope, entireAmanahGrant, geoScopeSubset, geoScopeKey } from '../src/data/geoScope.js';
import { interpret, describeChange, defaultSpec } from '../src/data/reportIntents.js';
import { resolveEntities } from '../src/data/requestEntities.js';
import * as session from '../src/api/session.js';
import { sessionViewer } from '../src/data/sessionViewer.js';
import { MODULE_IDS } from '../src/data/permissions.js';
import { createStore, makeRecord, canView, coverageOf, mergeCoverage, KEYS, userKeyOf } from '../src/data/reportStore.js';
import { createAnalysisStore } from '../src/data/analysisStore.js';
import { contextChips } from '../src/data/reportModel.js';
import { withState } from '../src/data/decisionRoom.js';
import * as dstore from '../src/data/decisionStore.js';
import { permittedAmanahOptions, municipalityOptions, sanitizeFormValues } from '../src/components/filters/filterLogic.js';
import { buildScopeDefs } from '../src/components/filters/filterConfig.js';
import {
  asGeoScope, amanahAllowed, muniAllowed, groupAllowed, muniKeyAllowed, entireAmanah, allowedEntityKeys, authorizedAmanahOptions, authorizedMunicipalityOptions, sanitizeScopeValues,
  requestedGeoScope, coverageGeo, geoOfCoverage, makeViewer, checkCoverage, accessSignature, respecWithin, allAuthorizedLabel, allMunicipalitiesLabel, describeAccess,
  nsKey, nsStorage, createAccessBoundCache, REOPEN_MSG, HOUSING_KEY
} from '../src/data/reportAccess.js';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { e.message = `[${name}] ${e.message}`; console.error(`FAIL: ${name}`); throw e; } };
const TODAY = '2026-10-09';
const RY = 'Riyadh Amanah'; const JD = 'Jeddah Amanah'; const MK = 'Makkah Amanah'; const EP = 'Eastern Province Amanah';
const jd = municipalitiesOf(JD); const ry = municipalitiesOf(RY);
const RABIGH = jd.find((m) => /رابغ/.test(m.ar)); const LAITH = jd.find((m) => /الليث/.test(m.ar)); const QOUZ = jd.find((m) => /القوز/.test(m.ar));
assert.ok(RABIGH && LAITH && QOUZ);
const mapped = (amanah, refs, extra = {}) => ({ amanah, municipalities: refs, direct: false, notSpecified: false, ...extra });

// the five fixtures of the brief
const S_ALL = ALL_SCOPE;
const S_RY = normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(RY)] });                                         // one Amanah entire
const S_SEL = normalizeGeoScope({ all: false, nonMunicipal: false, grants: [mapped(JD, [RABIGH.refId, QOUZ.refId]), mapped(RY, [ry[0].refId, ry[1].refId])] }); // selected municipalities of two Amanahs
const S_ONE = normalizeGeoScope({ all: false, nonMunicipal: false, grants: [mapped(JD, [QOUZ.refId])] });                                     // a single municipality
const S_NONE = EMPTY_SCOPE;
const S_MIX = normalizeGeoScope({ all: false, nonMunicipal: false, grants: [mapped(JD, [QOUZ.refId], { direct: true }), mapped(MK, [], { notSpecified: true })] }); // granted explicit groups
const RUN = (q, prev = null, opts = {}) => interpret(q, prev, TODAY, opts);
const everything = (r) => JSON.stringify({ q: r.question, o: r.options, p: r.problems });
const amanahNames = (k) => { const e = ENTITIES.find((x) => x.en === k); return [e.en, e.en.replace(/ Amanah$/, ''), e.ar, e.ar.replace(/^أمانة\s*(منطقة|محافظة|مدينة)?\s*/, '')]; };

/* ------------------------------------------------------------------ 1. «all municipalities» and entity resolution */
ok('«all municipalities» means all AUTHORIZED ones: the reading, the labels and the covered scope', () => {
  const sel = RUN('تقرير أمانة جدة كل البلديات', null, { access: S_SEL }); assert.equal(sel.kind, 'report'); assert.equal(sel.spec.scope.amanah, JD); assert.equal(sel.spec.scope.muni, 'all');
  assert.equal(sel.interpretation.access.restricted, true);
  assert.equal(allMunicipalitiesLabel(S_SEL, JD, 'ar'), 'كل البلديات ضمن صلاحيتك'); assert.equal(allMunicipalitiesLabel(S_SEL, JD, 'en'), 'All municipalities within your access');
  assert.equal(allMunicipalitiesLabel(S_ALL, JD, 'ar'), 'كل البلديات'); assert.equal(allMunicipalitiesLabel(S_RY, RY, 'en'), 'All municipalities', 'an entire grant: plain wording');
  // the covered scope is the request ∩ the access: ONLY the two granted Jeddah municipalities — never the whole Amanah, never a direct / not-specified group
  const cov = coverageGeo(sel.spec, S_SEL); assert.deepEqual(cov.grants, [mapped(JD, [QOUZ.refId, RABIGH.refId].sort())]);
  assert.equal(geoScopeSubset(cov, S_SEL), true); assert.equal(geoScopeSubset(requestedGeoScope(sel.spec.scope), S_SEL), false, 'the unrestricted request is wider than the access');
  // «all Amanahs» under a restricted access = everything the access allows
  const allA = RUN('تقرير كل الأمانات', null, { access: S_SEL }); assert.equal(allA.kind, 'report'); assert.equal(allA.spec.scope.amanah, 'all'); assert.deepEqual(coverageGeo(allA.spec, S_SEL), S_SEL);
  assert.match(allAuthorizedLabel(S_SEL, 'ar'), /^كل ما تتيحه صلاحيتك/); assert.match(allAuthorizedLabel(S_SEL, 'en'), /^Everything your access allows/); assert.equal(allAuthorizedLabel(S_ALL, 'en'), 'All Amanahs and entities');
  const lbl = describeChange({ key: 'amanah', value: 'all' }, 'ar', { access: S_SEL }); assert.match(lbl, /كل ما تتيحه صلاحيتك/);
  const lblM = describeChange({ key: 'muni', value: 'all' }, 'en', { access: S_SEL, spec: sel.spec }); assert.match(lblM, /within your access/);
  assert.match(describeChange({ key: 'amanah', value: 'all' }, 'en', { access: S_ALL }), /All Amanahs/, 'unrestricted wording is unchanged');
  // an open request under an unrestricted access reads exactly as before
  const open = RUN('تقرير أمانة جدة كل البلديات', null, { access: S_ALL }); assert.equal(open.kind, 'report'); assert.equal(open.interpretation.access, undefined);
  assert.deepEqual(coverageGeo(open.spec, S_ALL).grants, [entireAmanahGrant(JD)]);
});

ok('an unauthorized Amanah gets an ACCESS message — no total, no resolved name, no candidate, no count', () => {
  for (const [q, typed] of [['تقرير أمانة جدة', 'جدة'], ['report for Jeddah Amanah', 'Jeddah'], ['تقرير الدمام للربع الأول 2026', 'الدمام'], ['Eastern Province report', 'Eastern']]) {
    const r = RUN(q, null, { access: S_RY }); assert.equal(r.kind, 'clarify', q); assert.ok(r.problems.some((p) => p.kind === 'amanah_forbidden'), q);
    assert.match(r.question.ar, /^لا تملك صلاحية الوصول إلى/); assert.match(r.question.en, /^You don't have access to/);
    const text = everything(r);
    // only what the person typed is named: no OTHER entity of the catalogue (the Eastern Province is typed as «Dammam» and must not come back as «الشرقية»)
    for (const k of ENTITIES.slice(0, N_AMANAH + 1).map((e) => e.en).filter((k) => k !== RY)) for (const nm of amanahNames(k)) if (!q.includes(nm) && nm.length > 3) assert.ok(!text.includes(nm), `${q}: the message / options name «${nm}»`);
    assert.ok(!/\d{3,}/.test(r.question.ar + r.question.en), `${q}: no figure`);
    assert.ok(r.options.length > 0 && r.options.every((o) => interpret(o.text, null, TODAY, { access: S_RY }).kind === 'report'), `${q}: every option is a request the user may run`);
    assert.ok(r.options.every((o) => !(o.text.includes(typed) && !q.startsWith(o.text))), `${q}: no option repeats the unauthorized name`);
  }
  // an Amanah list with one unauthorized item: asked about, never silently dropped
  const mixed = RUN('تقرير الرياض وجدة', null, { access: S_RY }); assert.equal(mixed.kind, 'clarify'); assert.ok(mixed.problems.some((p) => p.kind === 'amanah_forbidden'));
  // the SAME requests are fine for an unrestricted user (the test is meaningful) and for a user who holds the Amanah
  assert.equal(RUN('تقرير أمانة جدة', null, { access: S_ALL }).kind, 'report'); assert.equal(RUN('تقرير أمانة جدة', null, { access: S_SEL }).kind, 'report');
});

ok('did-you-mean suggestions, ambiguous candidates and nearest municipalities are cut to the authorized part', () => {
  const typo = 'تقرير Amanah Jeddaq'; const open = RUN(typo, null, { access: S_ALL }); assert.equal(open.kind, 'clarify'); assert.ok(open.problems[0].candidates.includes(JD), 'an unrestricted user is offered Jeddah');
  const rs = RUN(typo, null, { access: S_RY }); assert.equal(rs.kind, 'clarify'); assert.equal(rs.problems[0].kind, 'amanah_unknown'); assert.deepEqual(rs.problems[0].candidates, []);
  assert.ok(!/جدة|Jeddah/.test(JSON.stringify(rs.options)) && !/جدة|Jeddah/.test(rs.question.ar + rs.question.en), 'no suggestion names the unauthorized Amanah');
  // a typo of an unauthorized municipality inside an authorized Amanah: the nearest names are authorized ones only
  const q2 = 'تقرير أمانة جدة بلدية الليتث'; const open2 = RUN(q2, null, { access: S_ALL }); assert.equal(open2.kind, 'clarify'); assert.ok(open2.problems[0].candidates.includes(LAITH.refId), 'unrestricted: Laith is suggested');
  const sel2 = RUN(q2, null, { access: S_SEL }); assert.equal(sel2.kind, 'clarify'); assert.ok(!everything(sel2).includes('الليث') && !everything(sel2).includes(LAITH.refId), 'restricted: Laith is never suggested');
  // resolveEntities: the candidate lists of an ambiguous / multiple reading hold authorized municipalities only
  const multi = resolveEntities('تقرير أمانة جدة بلدية رابغ وبلدية الليث', { access: S_SEL }); const mp = multi.problems.find((p) => p.kind === 'muni_forbidden' || p.kind === 'muni_multiple');
  assert.ok(mp, 'one of the two municipalities is not granted'); assert.ok(!(mp.candidates || []).includes(LAITH.refId));
  assert.equal(resolveEntities('تقرير أمانة جدة بلدية رابغ', { access: S_SEL }).problems.length, 0);
});

ok('a municipality outside a PARTIAL grant (or an explicit group not granted) is an access message; granted ones work', () => {
  for (const q of ['تقرير أمانة جدة بلدية الليث', 'تقرير بلدية الليث', 'Jeddah municipality of Laith', 'تقرير أمانة جدة بلا بلدية', 'تقرير أمانة جدة مباشر على الأمانة']) {
    const r = RUN(q, null, { access: S_SEL }); assert.equal(r.kind, 'clarify', q); assert.ok(r.problems.some((p) => p.kind === 'muni_forbidden'), q); assert.match(r.question.ar, /^لا تملك صلاحية الوصول إلى/, q);
    assert.ok(!everything(r).includes(RABIGH.refId) && r.options.every((o) => interpret(o.text, null, TODAY, { access: S_SEL }).kind === 'report'), q);
  }
  const g = RUN('تقرير أمانة جدة بلا بلدية', null, { access: S_SEL }); assert.ok(g.question.ar.includes('بلا بلدية'));
  assert.equal(RUN('تقرير أمانة جدة بلدية رابغ', null, { access: S_SEL }).spec.scope.muni, RABIGH.key);
  assert.equal(RUN('تقرير أمانة جدة بلدية القوز', null, { access: S_ONE }).spec.scope.muni, QOUZ.key); assert.equal(RUN('تقرير أمانة جدة بلدية رابغ', null, { access: S_ONE }).kind, 'clarify');
  // granted explicit groups
  assert.equal(RUN('تقرير أمانة جدة مباشر على الأمانة', null, { access: S_MIX }).spec.scope.muni, `${JD}|DIRECT`); assert.equal(RUN('تقرير أمانة مكة بلا بلدية', null, { access: S_MIX }).spec.scope.muni, `${MK}|NOT_SPECIFIED`);
  assert.equal(RUN('تقرير أمانة مكة مباشر على الأمانة', null, { access: S_MIX }).kind, 'clarify', 'direct is not granted for Makkah');
  // «municipality missing»: the count and the examples are the authorized municipalities, the groups only when granted
  const nm = RUN('تقرير بلدية أمانة جدة', null, { access: S_SEL }); assert.equal(nm.problems[0].kind, 'muni_name_missing'); assert.ok(nm.question.ar.includes(' 2 ') && !nm.question.ar.includes('15'), 'two municipalities, not the 15 of the Amanah');
  assert.ok(!/الليث|مباشر|بلا بلدية/.test(everything(nm)), 'no unauthorized example, no group that is not granted');
  const nm2 = RUN('تقرير بلدية أمانة جدة', null, { access: S_MIX }); assert.ok(/مباشر/.test(everything(nm2)), 'a granted group is offered');
});

ok('no access at all: a clear message, nothing is interpreted; an Amanah typed by a user holding none is refused', () => {
  const r = RUN('أنشئ تقرير الإيرادات لهذا الشهر', null, { access: S_NONE }); assert.equal(r.kind, 'unsupported'); assert.equal(r.noAccess, true); assert.deepEqual(r.question, REOPEN_MSG.none);
  assert.equal(RUN('تقرير أمانة الرياض', null, { access: S_NONE }).noAccess, true);
  const e = resolveEntities('تقرير أمانة الرياض', { access: S_NONE }); assert.ok(e.problems.some((p) => p.kind === 'amanah_forbidden')); assert.deepEqual(e.allowed, []);
});

ok('the legacy organisation list still restricts, and combines with the GeoScope (never wider than either)', () => {
  const r = RUN('تقرير أمانة جدة', null, { allowedAmanahs: [RY] }); assert.equal(r.kind, 'clarify'); assert.ok(r.problems.some((p) => p.kind === 'amanah_forbidden')); assert.match(r.question.ar, /صلاحيات/);
  const both = RUN('تقرير أمانة جدة', null, { access: S_SEL, allowedAmanahs: [RY] }); assert.equal(both.kind, 'clarify', 'the organisation narrows the scope');
  assert.equal(RUN('تقرير أمانة الرياض', null, { access: S_SEL, allowedAmanahs: [RY] }).kind, 'report');
  assert.equal(RUN('تقرير أمانة جدة', null, {}).kind, 'report', 'no access option → unchanged behaviour');
});

ok('a base / previous spec holding a value outside the access is sanitised and reported (never silently kept)', () => {
  const base = defaultSpec(TODAY); base.scope.amanah = JD; base.scope.muni = LAITH.key;
  const r = RUN('أنشئ تقرير الإيرادات لهذا الشهر', null, { access: S_SEL, base }); assert.equal(r.kind, 'report'); assert.equal(r.spec.scope.muni, 'all'); assert.equal(r.spec.scope.amanah, JD); assert.ok(r.accessNotice && r.accessNotice.ar && r.accessNotice.en);
  const base2 = defaultSpec(TODAY); base2.scope.amanah = MK; const r2 = RUN('أنشئ تقرير الإيرادات لهذا الشهر', null, { access: S_RY, base: base2 }); assert.equal(r2.spec.scope.amanah, 'all'); assert.ok(r2.accessNotice);
  const clean = RUN('أنشئ تقرير الإيرادات لهذا الشهر', null, { access: S_RY }); assert.equal(clean.accessNotice, undefined);
});

/* ------------------------------------------------------------------ 2. scope helpers */
ok('entity / municipality / group predicates follow the grant (a few municipalities never imply direct or not-specified)', () => {
  assert.equal(amanahAllowed(S_SEL, JD), true); assert.equal(amanahAllowed(S_SEL, MK), false); assert.equal(amanahAllowed(S_ALL, HOUSING_KEY), true); assert.equal(amanahAllowed(S_SEL, HOUSING_KEY), false);
  assert.equal(amanahAllowed(normalizeGeoScope({ all: false, grants: [], nonMunicipal: true }), HOUSING_KEY), true);
  assert.equal(muniAllowed(S_SEL, JD, RABIGH.refId), true); assert.equal(muniAllowed(S_SEL, JD, LAITH.refId), false); assert.equal(muniAllowed(S_RY, RY, ry[5].refId), true);
  assert.equal(groupAllowed(S_SEL, JD, 'DIRECT'), false); assert.equal(groupAllowed(S_SEL, JD, 'NOT_SPECIFIED'), false); assert.equal(groupAllowed(S_RY, RY, 'DIRECT'), true); assert.equal(groupAllowed(S_MIX, JD, 'DIRECT'), true); assert.equal(groupAllowed(S_MIX, JD, 'NOT_SPECIFIED'), false);
  assert.equal(muniKeyAllowed(S_SEL, 'all'), true); assert.equal(muniKeyAllowed(S_SEL, LAITH.key), false); assert.equal(muniKeyAllowed(S_SEL, 'junk'), false); assert.equal(muniKeyAllowed(S_MIX, `${MK}|UNRESOLVED`), true, 'needs-review follows not-specified');
  assert.equal(entireAmanah(S_RY, RY), true); assert.equal(entireAmanah(S_SEL, RY), false); assert.deepEqual(allowedEntityKeys(S_SEL), [JD, RY].sort((a, b) => ENTITIES.findIndex((e) => e.en === a) - ENTITIES.findIndex((e) => e.en === b))); assert.equal(allowedEntityKeys(S_ALL), null);
  assert.deepEqual(asGeoScope({ amanahKeys: [RY] }), asGeoScope(S_RY)); assert.equal(asGeoScope({ amanahKeys: null }).all, true); assert.equal(asGeoScope('x').all, false, 'unrecognisable → EMPTY, never wider');
});

/* ------------------------------------------------------------------ 3. saved reports are re-checked against the CURRENT access */
const SPEC = (amanah = 'all', muni = 'all') => ({ scope: { from: '2026-01-01', to: TODAY, amanah, source: 'all', muni }, compare: 'none', sections: ['executive'] });
const model = (lang) => ({ id: 'rpt-1', title: lang === 'ar' ? 'تقرير' : 'Report', subtitle: 's', generatedAt: '2026-11-05T09:00:00.000Z', cutoff: TODAY, lang, equationOk: true, empty: false, totals: { net: 1 }, headline: [], sections: [], summaryText: 'x' });
const rec = (msgId, spec, access, { owner, av } = {}) => makeRecord({ msgId, convId: 'c1', version: 1, generatedAt: '2026-11-05T09:00:00.000Z', cutoff: TODAY, lang: 'ar', spec, org: null, models: { ar: model('ar'), en: model('en') }, access, owner, accessVersion: av });
const V = (geo, o = {}) => makeViewer({ uid: 'usr-x', geo, ...o });

ok('reopening re-checks the CURRENT access: coverage ⊆ scope shows, ⊄ hides, a lost permission hides, widening shows again', () => {
  const full = rec('a1', SPEC(), S_ALL); assert.equal(full.coverage.all, true); assert.deepEqual(geoOfCoverage(full.coverage), S_ALL);
  const inRy = rec('a2', SPEC(RY), S_ALL); assert.deepEqual(inRy.coverage.keys, [RY]);
  const sel = rec('a3', SPEC(), S_SEL); assert.deepEqual(geoOfCoverage(sel.coverage), S_SEL, '«all» built under a restricted access covers exactly that access');
  // ⊆ → shown
  assert.equal(canView(full.coverage, V(S_ALL)), true); assert.equal(canView(inRy.coverage, V(S_RY)), true); assert.equal(canView(sel.coverage, V(S_SEL)), true);
  // ⊄ → not shown (narrowed, a different Amanah, a single municipality of the two, a partial grant for an entire Amanah, no access)
  assert.equal(canView(full.coverage, V(S_RY)), false, 'a national report after the scope was narrowed');
  assert.equal(canView(inRy.coverage, V(S_SEL)), false, 'entire Riyadh vs two Riyadh municipalities'); assert.equal(canView(sel.coverage, V(S_ONE)), false); assert.equal(canView(sel.coverage, V(S_NONE)), false); assert.equal(canView(inRy.coverage, V(S_NONE)), false);
  assert.equal(canView(rec('a4', SPEC(JD), S_ALL).coverage, V(S_SEL)), false, 'the whole of Jeddah after the access shrank to two Jeddah municipalities');
  // widened again → shown
  assert.equal(canView(sel.coverage, V(normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(JD), entireAmanahGrant(RY)] }))), true);
  assert.equal(canView(sel.coverage, V(S_ALL)), true);
  // the permission lost: nothing is shown, whatever the scope
  assert.equal(canView(sel.coverage, V(S_SEL, { permitted: false })), false); assert.equal(canView(full.coverage, V(S_ALL, { permitted: false })), false);
  assert.deepEqual(checkCoverage(full.coverage, V(S_RY)), { ok: false, reason: 'scope' }); assert.deepEqual(checkCoverage(full.coverage, V(S_ALL, { permitted: false })), { ok: false, reason: 'permission' }); assert.deepEqual(checkCoverage(null, V(S_RY)), { ok: true });
  // an older record (legacy { all, keys } only, no geo) is judged by the same rule
  const legacy = { all: false, keys: [RY] }; assert.equal(canView(legacy, V(S_RY)), true); assert.equal(canView(legacy, V(S_SEL)), false); assert.equal(canView({ all: true, keys: [] }, V(S_RY)), false); assert.equal(canView({ all: true, keys: [] }, V(S_ALL)), true);
  // the legacy organisation check is unchanged
  assert.equal(canView({ all: true, keys: [] }, { amanahKeys: [RY] }), false); assert.equal(canView({ all: false, keys: [RY] }, { amanahKeys: [RY] }), true); assert.deepEqual(coverageOf(SPEC(), { amanahKeys: [RY] }), { all: false, keys: [RY] });
  // a viewer spread over an organisation: the viewer decides
  assert.equal(canView(full.coverage, { amanahKeys: null, ...V(S_RY) }), false);
});

ok('the stored coverage of a specific municipality / group, merged coverage, and the regenerate-within-access spec', () => {
  assert.deepEqual(requestedGeoScope(SPEC(JD, QOUZ.key).scope).grants, [mapped(JD, [QOUZ.refId])]); assert.deepEqual(requestedGeoScope(SPEC(JD, `${JD}|DIRECT`).scope).grants, [mapped(JD, [], { direct: true })]);
  assert.equal(coverageGeo(SPEC(JD, RABIGH.key), S_ONE).grants.length, 0, 'a municipality outside the grant covers nothing');
  const m = mergeCoverage(rec('a', SPEC(RY), S_ALL).coverage, rec('b', SPEC(JD, QOUZ.key), S_ALL).coverage); assert.ok(geoScopeSubset(geoOfCoverage(m), normalizeGeoScope({ all: false, nonMunicipal: false, grants: [entireAmanahGrant(RY), mapped(JD, [QOUZ.refId])] })));
  assert.equal(canView(m, V(S_RY)), false, 'a conversation holding a report of a second Amanah is locked');
  // regenerate within the current access: out-of-scope values are dropped, never kept; no access → nothing to regenerate
  const r = respecWithin(SPEC(JD, LAITH.key), S_SEL); assert.equal(r.spec.scope.amanah, JD); assert.equal(r.spec.scope.muni, 'all'); assert.deepEqual(r.dropped, ['muni']);
  const r2 = respecWithin(SPEC([JD, MK]), S_SEL); assert.equal(r2.spec.scope.amanah, JD); assert.equal(respecWithin(SPEC(), S_NONE), null);
  assert.equal(respecWithin(SPEC(), S_RY).dropped.length, 0);
  assert.ok(REOPEN_MSG.scope.ar.includes('لم يعد لديك صلاحية على كامل نطاق هذا التقرير'));
});

ok('the report store: records are filed under the user; a foreign record is never returned; the accessVersion is stored', () => {
  const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; };
  const st = mem(); const s = createStore({ storage: st }); const A = userKeyOf({ user: 'alice' }); const B = userKeyOf({ user: 'bob' });
  const ra = rec('a1', SPEC(), S_SEL, { owner: A, av: 7 }); assert.equal(ra.owner, A); assert.equal(ra.av, 7);
  assert.ok(s.saveReports(A, 'c1', { a1: ra }).ok); assert.deepEqual(Object.keys(s.loadReports(A, 'c1').records), ['a1']); assert.deepEqual(s.loadReports(B, 'c1').records, {}, 'another user sees nothing');
  assert.ok([...st._m.keys()].every((k) => k.includes(`:${A}`)), 'every key carries the user key');
  // a record of A copied under B's key (a tampered / mis-filed store) is not returned to B
  st.setItem(`${KEYS.reports}:${B}:c1`, st.getItem(`${KEYS.reports}:${A}:c1`)); assert.deepEqual(s.loadReports(B, 'c1'), { records: {}, unreadable: [] });
  s.saveConvs(A, [{ id: 'c1', title: 'T', createdAt: 1, updatedAt: 2, messages: [{ id: 'u', role: 'user', text: 'hi' }] }]); assert.equal(s.listConvs(A).length, 1); assert.equal(s.listConvs(B).length, 0);
  st.setItem(`${KEYS.index}:${B}`, st.getItem(`${KEYS.index}:${A}`)); assert.equal(s.listConvs(B).length, 0, 'a conversation filed under another owner is never listed');
});

ok('the non-collection analysis store re-checks the CURRENT access too (the `invoices_uncollected` module) and uses the explicit viewer', () => {
  const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
  const store = createAnalysisStore({ storage: mem() }); const U = userKeyOf({ user: 'alice' });
  const analysis = (amanah) => ({ version: 1, kind: 'noncollection', generatedAt: '2026-11-05T10:00:00.000Z', cutoff: TODAY, scope: { from: '2026-01-01', to: TODAY, amanah, source: 'all', scopeType: 'all', muni: 'all', status: 'all' }, totals: { net: 1 } });
  const input = (amanah, task) => ({ analysis: analysis(amanah), taskScope: { amanah }, generatedAt: '2026-11-05T10:00:00.000Z', cutoff: TODAY, sourceTaskId: task });
  const { id } = store.create(U, input('all', 't1'), { org: V(S_SEL), access: S_SEL }); const idRy = store.create(U, input(RY, 't2'), { org: V(S_ALL), access: S_ALL }).id;
  assert.deepEqual(geoOfCoverage(store.list(U, V(S_SEL)).find((x) => x.id === id).coverage), S_SEL);
  assert.equal(store.load(U, id, V(S_SEL)).ok, true); assert.equal(store.load(U, id, V(S_ONE)).error, 'forbidden'); assert.equal(store.load(U, idRy, V(S_SEL)).error, 'forbidden'); assert.equal(store.load(U, idRy, V(S_RY)).ok, true);
  assert.deepEqual(store.list(U, V(S_ONE)).map((x) => x.id), [], 'narrowed: neither is listed'); assert.deepEqual(store.list(U, V(S_ALL, { permitted: false })).map((x) => x.id), []);
  assert.equal(store.addVersion(U, id, input('all', 't3'), { org: V(S_ONE) }).error, 'forbidden');
});

/* ------------------------------------------------------------------ 4. per-user state and cache invalidation */
ok('state is namespaced by user; the demo account adopts its old un-namespaced flags, nobody else does; a user switch never reads another user\'s state', () => {
  const m = new Map(); const base = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
  const a = nsStorage(base, 'u:alice'); const b = nsStorage(base, 'u:bob'); a.setItem('k', '1');
  assert.equal(b.getItem('k'), null); assert.equal(a.getItem('k'), '1'); assert.ok([...m.keys()].every((k) => k.endsWith(':u:alice'))); assert.equal(nsKey('ib_x', 'u:alice'), 'ib_x:u:alice'); assert.equal(nsKey('ib_x', null), null);
  assert.equal(nsStorage(base, null).getItem('k'), null); assert.throws(() => nsStorage(base, null).setItem('k', '1'));
  // the Decision Room follow-up store through it
  m.clear(); m.set(dstore.STORE_KEY, JSON.stringify({ v: 2, items: { 'amanah:legacy': { flag: 'flagged', note: null, history: [] } } })); // the un-namespaced store of an older version
  const demo = nsStorage(base, 'u:demo', { adopt: ['u:demo'] }); const other = nsStorage(base, 'u:alice', { adopt: ['u:demo'] });
  assert.equal(dstore.loadStore(demo).items['amanah:legacy'].flag, 'flagged', 'the demo account keeps the flags it had'); assert.deepEqual(dstore.loadStore(other).items, {}, 'another user starts empty');
  const f = dstore.flag(dstore.loadStore(other), 'item:1', { note: 'n' }, { by: 'Alice', at: '2026-11-06T00:00:00.000Z' }); dstore.saveStore(f.store, other);
  assert.equal(dstore.loadStore(demo).items['item:1'], undefined, 'a flag recorded by one user is not another user\'s'); assert.ok(m.has(`${dstore.STORE_KEY}:u:alice`) && m.has(dstore.STORE_KEY));
  // a stored follow-up of an item outside the current (authorized) list is never displayed: items come from the data, the store only decorates them
  const shown = withState([{ key: 'item:1' }], dstore.loadStore(other)); assert.equal(shown.length, 1); assert.equal(withState([{ key: 'item:2' }], dstore.loadStore(other))[0].followUp.flag, 'none');
  assert.ok(!JSON.stringify(withState([{ key: 'item:2' }], dstore.loadStore(other))).includes('n"'), 'no note of an item that is not in the list');
});

ok('derived caches are dropped when the access signature (user · accessVersion · scope · permission) changes', () => {
  const c = createAccessBoundCache(); const o = {}; const sig = (v) => accessSignature(v);
  const v1 = V(S_SEL, { accessVersion: 3 }); assert.equal(c.bind(sig(v1)), true); c.setWeak(o, 'model'); c.set('k', 1); assert.equal(c.getWeak(o), 'model');
  assert.equal(c.bind(sig(V(S_SEL, { accessVersion: 3 }))), false, 'same access: nothing dropped'); assert.equal(c.getWeak(o), 'model');
  assert.equal(c.bind(sig(V(S_SEL, { accessVersion: 4 }))), true, 'accessVersion changed'); assert.equal(c.getWeak(o), undefined); assert.equal(c.get('k'), undefined);
  c.set('k', 2); assert.equal(c.bind(sig(V(S_ONE, { accessVersion: 4 }))), true, 'scope changed'); assert.equal(c.get('k'), undefined);
  c.set('k', 3); assert.equal(c.bind(sig(V(S_ONE, { accessVersion: 4, permitted: false }))), true, 'permission changed'); assert.equal(c.bind(sig(V(S_ONE, { accessVersion: 4, permitted: false, uid: 'usr-y' }))), true, 'another user');
  assert.notEqual(sig(V(S_ALL)), sig(V(S_RY))); assert.equal(sig(V(S_RY, { canExport: false })) === sig(V(S_RY)), false);
});

ok('source wiring: drafts, caches, export gate, interpretation and pickers are bound to the access (SmartReports.jsx and friends)', () => {
  const sr = fs.readFileSync('src/pages/SmartReports.jsx', 'utf8');
  assert.ok(sr.includes('draftKey(uk)') && !/getItem\(DRAFT_KEY\)/.test(sr), 'drafts are filed under the user');
  assert.ok(sr.includes('boundRef.current.bind(ra.signature)') && sr.includes('attData.current = {}'), 'derived caches drop on an access change');
  assert.ok(sr.includes('!viewer.canExport') && sr.includes('REOPEN_MSG.exportDenied') && /viewerRef\.current\.canExport/.test(sr), 'exports follow the smart_reports module (no separate export permission), re-checked at click time');
  assert.ok(sr.includes('{ base: sharedSpec, access }'), 'requests are interpreted within the access'); assert.ok(!/rev\.org/.test(sr), 'no persona object is read');
  assert.ok(sr.includes('access: token.access') && sr.includes('owner: uk'), 'the model builders and the saved record receive the authorized scope');
  assert.ok(sr.includes('regenerateWithin') && sr.includes('respecWithin'), 'a locked conversation can be regenerated within the current access');
  assert.ok(sr.includes('NoReportsAccess') && /!ra\.permitted/.test(sr), 'without the smart_reports module nothing is read or shown');
  const sf = fs.readFileSync('src/components/filters/ScopeFilters.jsx', 'utf8'); assert.ok(sf.includes('usePickerAccess') && sf.includes('sanitizeScopeValues'), 'the shared filter bar uses the access for its lists and drops injected values');
  const pv = fs.readFileSync('src/components/charts/usePageChartView.js', 'utf8'); assert.ok(pv.includes('userKeyOf(rev.user)') && pv.includes('pageViewStore().load(uk, page)'), 'chart prefs are per user');
  const ud = fs.readFileSync('src/data/useDecisions.js', 'utf8'); assert.ok(ud.includes('nsStorage(localStorage, uk'), 'follow-up flags are per user'); assert.ok(!/assign|assignee/i.test(ud.replace(/Nothing is delegated[^\n]*/g, '')));
});

/* ------------------------------------------------------------------ 5. pickers */
ok('picker options come ONLY from the access: Amanahs, municipalities ∩ grant, explicit groups only when granted', () => {
  assert.deepEqual(authorizedAmanahOptions(S_SEL).map((a) => a.key).sort(), [JD, RY]); assert.equal(authorizedAmanahOptions(S_ALL).length, N_AMANAH + 1); assert.deepEqual(authorizedAmanahOptions(S_NONE), []);
  assert.ok(!authorizedAmanahOptions(S_RY).some((a) => a.key === HOUSING_KEY), 'the Housing Sector needs the non-municipal grant');
  assert.ok(authorizedAmanahOptions(normalizeGeoScope({ all: false, grants: [entireAmanahGrant(RY)], nonMunicipal: true })).some((a) => a.key === HOUSING_KEY));
  // municipalities of an Amanah = the Amanah's options ∩ the grant
  const sel = authorizedMunicipalityOptions(S_SEL, JD); assert.deepEqual(sel.map((o) => o.value).sort(), [QOUZ.key, RABIGH.key].sort(), 'selected municipalities only — no direct / not-specified / needs-review group');
  assert.deepEqual(authorizedMunicipalityOptions(S_SEL, MK), [], 'an Amanah not granted lists nothing'); assert.deepEqual(authorizedMunicipalityOptions(S_SEL, 'all'), []); assert.deepEqual(authorizedMunicipalityOptions(S_SEL, [JD, RY]), []);
  const ent = authorizedMunicipalityOptions(S_RY, RY); assert.equal(ent.length, 3 + ry.length); assert.deepEqual(ent.slice(0, 3).map((o) => o.kind), ['direct_amanah', 'not_specified', 'unresolved']);
  assert.deepEqual(authorizedMunicipalityOptions(S_MIX, JD).map((o) => o.kind).sort(), ['direct_amanah', 'mapped']); assert.deepEqual(authorizedMunicipalityOptions(S_MIX, MK).map((o) => o.kind).sort(), ['not_specified', 'unresolved']);
  assert.equal(authorizedMunicipalityOptions(S_ALL, RY).length, ent.length);
  // the filter-logic wrappers
  assert.deepEqual(permittedAmanahOptions(S_SEL).map((a) => a.key).sort(), [JD, RY]); assert.equal(permittedAmanahOptions(null).length, N_AMANAH + 1);
  assert.deepEqual(municipalityOptions(JD, S_SEL).map((o) => o.value).sort(), [QOUZ.key, RABIGH.key].sort()); assert.equal(municipalityOptions(RY).length, 3 + ry.length, 'no access argument → unchanged');
  // the options come ONLY from the account's scope: an Amanah outside it is never offered
  assert.ok(!permittedAmanahOptions(S_SEL).some((a) => a.key === MK), 'an Amanah outside the access is not offered'); assert.equal(permittedAmanahOptions(S_ALL).length, N_AMANAH + 1);
  // the field definitions of the shared toolbar
  const defs = buildScopeDefs(['amanah', 'municipality'], { access: S_SEL }); const am = defs.find((d) => d.key === 'amanah'); const mu = defs.find((d) => d.key === 'municipality');
  assert.deepEqual(am.options({ amanah: 'all' }).map((o) => o.value).sort(), ['all', JD, RY].sort()); assert.equal(am.options({ amanah: 'all' })[0].label.ar, 'كل ما تتيحه صلاحيتك');
  assert.deepEqual(mu.options({ amanah: JD }).map((o) => o.value).sort(), ['all', QOUZ.key, RABIGH.key].sort()); assert.equal(mu.options({ amanah: JD })[0].label.ar, 'كل البلديات ضمن صلاحيتك'); assert.equal(mu.disabled({ amanah: MK }), true, 'an Amanah outside the access has no municipalities');
  const open = buildScopeDefs(['amanah', 'municipality'], {}); assert.equal(open.find((d) => d.key === 'amanah').options({ amanah: 'all' })[0].label.ar, 'جميع الأمانات والجهات');
  // contextChips: the report names the authorized scope; «all» reads as «within your access»; an unrestricted report is unchanged
  const snap = { cutoff: TODAY, basis: {} }; const chipsOf = (access) => contextChips(SPEC(), { lang: 'ar', snapshot: snap, snapshotMeta: null, labelOfAmanah: (k) => k, labelOfMuni: (k) => k, access });
  const restricted = chipsOf(S_SEL); assert.ok(restricted.find((c) => c.k === 'access').value.includes(describeAccess(S_SEL, 'ar'))); assert.match(restricted.find((c) => c.k === 'amanah').value, /كل ما تتيحه صلاحيتك/); assert.match(restricted.find((c) => c.k === 'muni').value, /ضمن صلاحيتك/);
  assert.equal(chipsOf(S_ALL).some((c) => c.k === 'access'), false); assert.equal(chipsOf(null).find((c) => c.k === 'amanah').value, 'كل الأمانات والجهات');
});

ok('a value injected through the URL / a stored selection outside the access is dropped (never kept, never widened)', () => {
  let r = sanitizeScopeValues({ amanah: MK, muni: 'all' }, S_SEL); assert.deepEqual([r.amanah, r.muni, r.dropped], ['all', 'all', ['amanah']]);
  r = sanitizeScopeValues({ amanah: JD, muni: LAITH.key }, S_SEL); assert.deepEqual([r.amanah, r.muni, r.dropped], [JD, 'all', ['muni']]);
  r = sanitizeScopeValues({ amanah: JD, muni: RABIGH.key }, S_SEL); assert.deepEqual([r.amanah, r.muni, r.dropped], [JD, RABIGH.key, []]);
  r = sanitizeScopeValues({ amanah: MK, muni: `${MK}|MREF-004-001` }, S_SEL); assert.deepEqual([r.amanah, r.muni], ['all', 'all'], 'an Amanah that is dropped takes its municipality with it');
  r = sanitizeScopeValues({ amanah: [JD, MK, RY], muni: 'all' }, S_SEL); assert.deepEqual([r.amanah, r.dropped], [[JD, RY], ['amanah']]); r = sanitizeScopeValues({ amanah: [MK, EP], muni: 'all' }, S_SEL); assert.equal(r.amanah, 'all');
  r = sanitizeScopeValues({ amanah: 'all', muni: 'junk' }, S_SEL); assert.deepEqual([r.muni, r.dropped], ['all', ['muni']]); r = sanitizeScopeValues({ amanah: MK, muni: 'all' }, S_ALL); assert.equal(r.amanah, MK, 'an unrestricted access keeps everything');
  r = sanitizeScopeValues({ amanah: JD, muni: `${JD}|DIRECT` }, S_SEL); assert.deepEqual([r.muni, r.dropped], ['all', ['muni']], 'a group that is not granted'); assert.equal(sanitizeScopeValues({ amanah: JD, muni: `${JD}|DIRECT` }, S_MIX).muni, `${JD}|DIRECT`);
  const f = sanitizeFormValues({ amanah: MK, municipality: `${MK}|MREF-004-001`, source: 'fines' }, S_SEL); assert.deepEqual([f.values.amanah, f.values.municipality, f.values.source, f.dropped], ['all', 'all', 'fines', ['amanah', 'muni']]);
  assert.equal(sanitizeFormValues({ amanah: '__multi', municipality: 'all' }, S_SEL).values.amanah, '__multi', 'the report-only «several Amanahs» value is untouched');
  // the shared dashboard filter handed to Smart Reports is sanitised the same way
  assert.equal(sanitizeScopeValues({ amanah: 'all', muni: 'all' }, S_NONE).amanah, 'all');
});


/* ------------------------------------------------------------------ 6. the live session as a viewer: MODULE ids, read-only may export, a module switched off hides saved results */
const MEM = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const meWith = (modules, scope, readOnly = false, extra = {}) => ({ id: 'usr-s', username: 's', nameAr: 'س', nameEn: 'S', status: 'active', role: { id: 'r', nameAr: 'د', nameEn: 'R', readOnly }, modules, permissions: modules, scope, scopes: Object.fromEntries(modules.map((m) => [m, scope])), orgOptions: [], accessVersion: 1, ...extra });
async function signInAs(me) {
  const f = async (url) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => (url === '/api/auth/login' ? { token: 'tok.S', me } : {}) });
  session.__configure({ storage: MEM(), fetch: f }); globalThis.fetch = f; await session.login('s', 'whatever-123', null);
}
{
  assert.equal(sessionViewer('smart_reports'), null, 'signed out → no viewer (the callers keep their organisation-only check)');
  await signInAs(meWith(MODULE_IDS, S_SEL, true)); // a read-only role holding everything, restricted to two municipalities of two Amanahs
  let v = sessionViewer('smart_reports'); assert.equal(v.permitted, true); assert.equal(v.canExport, true, 'a read-only role may export'); assert.deepEqual(v.geo, S_SEL); assert.equal(v.uid, 'usr-s');
  let u = sessionViewer('invoices_uncollected'); assert.equal(u.permitted, true); assert.deepEqual(u.geo, S_SEL);
  // saved results are re-checked against it each time: inside the scope shows, outside hides
  assert.equal(canView(rec('s1', SPEC(JD, QOUZ.key), S_ALL).coverage, null), true); assert.equal(canView(rec('s2', SPEC(MK), S_ALL).coverage, null), false);
  // smart_reports switched off (a permission change applies on the next /auth/me): the saved report is hidden and the export is off, whatever the scope
  await signInAs(meWith(MODULE_IDS.filter((m) => m !== 'smart_reports'), S_ALL));
  v = sessionViewer('smart_reports'); assert.equal(v.permitted, false); assert.equal(v.canExport, false); assert.equal(canView(rec('s3', SPEC(RY), S_ALL).coverage, null), false, 'module off ⇒ nothing saved is shown');
  assert.equal(sessionViewer('invoices_uncollected').permitted, true, 'the non-collection analyses follow THEIR module, not smart_reports');
  await signInAs(meWith(['smart_reports'], S_ALL)); u = sessionViewer('invoices_uncollected'); assert.equal(u.permitted, false);
  await signInAs(meWith(['smart_reports'], S_RY)); assert.deepEqual(sessionViewer('smart_reports').geo, S_RY); assert.equal(sessionViewer('invoices_uncollected').geo.grants.length, 0, 'a module that is not held has the EMPTY scope');
  session.signOut(null); assert.equal(sessionViewer('smart_reports'), null);
  n += 1;
}
// the pure viewer rules with the module vocabulary: a signature changes with the module, the scope, the read-only-independent export flag and the accessVersion
ok('the access signature drops derived caches when the module / scope / version changes (read-only does not matter for reading or exporting)', () => {
  const sig = (v) => accessSignature(v);
  assert.notEqual(sig(V(S_ALL)), sig(V(S_ALL, { permitted: false }))); assert.notEqual(sig(V(S_ALL)), sig(V(S_RY))); assert.notEqual(sig(V(S_ALL)), sig(V(S_ALL, { accessVersion: 9 })));
  assert.equal(sig(V(S_ALL, { canExport: true })), sig(V(S_ALL)));
});
const src = (f) => fs.readFileSync(f, 'utf8').replace(/\/\/[^\n]*/g, '');
ok('Smart Reports source hygiene: module ids only (smart_reports / invoices_uncollected), export tied to the module', () => {
  for (const f of ['src/data/reportAccess.js', 'src/data/useReportAccess.js', 'src/data/sessionViewer.js', 'src/data/reportStore.js', 'src/data/analysisStore.js', 'src/pages/SmartReports.jsx']) assert.ok(!/reports\.(view|export)|collection\.(view|export)/.test(src(f)), `${f} still names a retired permission`);
  assert.ok(src('src/data/reportStore.js').includes("'smart_reports'") && src('src/data/analysisStore.js').includes("'invoices_uncollected'") && src('src/data/useReportAccess.js').includes("'smart_reports'"));
  assert.ok(/canExport = permitted/.test(src('src/data/useReportAccess.js')) && /canExport: a\.can\(permission\)/.test(src('src/data/sessionViewer.js')), 'export has no separate permission');
});

console.log(`access in Smart Reports: ${n} test groups passed`);
