// Complete request interpretation for «التقارير الذكية»: Arabic + English terminology, spelling variants (hamza / ta-marbuta / ya / tashkeel / digits / transliterations),
// Amanahs · municipalities · revenue sources · periods · statuses, and the rule that a constraint which cannot be resolved is ASKED about (never dropped, never widened).
// Interpretation only: no financial figure is computed or changed here. Run alone with the command in the report, or as part of `npm run test:chat` (tests/chat-workspace.test.mjs imports this file).
import assert from 'node:assert/strict';
import { interpretChat } from '../src/data/chatIntents.js';
import { loadStore } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { buildReportModel } from '../src/data/reportModel.js';
import { interpret, describeChange } from '../src/data/reportIntents.js';
import { normText, looseKey, toWesternDigits } from '../src/data/textNorm.js';
import { resolveEntities, buildEntityIndex } from '../src/data/requestEntities.js';
import { findUnapplied } from '../src/data/requestGuard.js';
import { ENTITIES, N_AMANAH } from '../src/data/catalog.js';
import { DEFAULT_TARGETS } from '../src/data/revenueMetrics.js';
import { setPlansForTest } from '../src/data/plans/planStore.js';
import { seededStore } from '../src/data/plans/planFixtures.js';
setPlansForTest(seededStore()); // the targets of the reports come from the configured reference plan (the seed is the 2026 reference)

let n = 0; const ok = (name, fn) => { fn(); n += 1; };
process.env.DEMO_SIZE = 'compact';
const TODAY = '2026-10-09'; const cfg = { cutoff: TODAY };
const R = { hasResult: true, resultKind: 'report', hasCharts: true, hasTables: true, pendingFiles: 0 };
const st = loadStore(TODAY);

/* ---------------- complete request interpretation: Arabic + English, spelling variants, targeted clarification, nothing dropped or widened ---------------- */
const RUN = (q, prev = null) => interpret(q, prev, TODAY);
const [RY, JD, EP, MK, MD, AS, TF, QS, AH, JZ, TB, HL, NB, NJ, HB, BH, JF] = ENTITIES.slice(0, N_AMANAH).map((e) => e.en);
const isAr = (t) => /[؀-ۿ]/.test(t);
const asReport = (phrase) => (isAr(phrase) ? `تقرير ${phrase}` : `report for ${phrase}`);

ok('one shared normalisation: digits, tashkeel, tatweel, alef / ya / ta-marbuta forms, case; the chat layer uses the same function', () => {
  assert.equal(normText('الرِّيَاض'), 'الرياض'); assert.equal(normText('الريـــاض'), 'الرياض'); assert.equal(normText('ٱلرياض'), 'الرياض');
  assert.equal(normText('أمانة'), normText('امانة')); assert.equal(normText('أمانه'), normText('امانة')); assert.equal(normText('إيواء'), normText('ايواء'));
  assert.equal(normText('جدة'), normText('جده')); assert.equal(normText('الشرقية'), normText('الشرقيه')); assert.equal(normText('على'), normText('علي'));
  assert.equal(normText('٢٠٢٦'), '2026'); assert.equal(normText('۲۰۲٦'), '2026'); assert.equal(toWesternDigits('١٢٣'), '123');
  assert.equal(normText('RIYADH Amanah'), 'riyadh amanah'); assert.equal(normText('ما هي؟'), 'ما هي');
  assert.equal(normText('‏الرياض‎'), 'الرياض', 'bidi / zero-width marks are dropped');
  assert.equal(looseKey('الرياظ'), looseKey('الرياض')); assert.equal(looseKey('Riyad'), looseKey('Riyadh')); assert.equal(looseKey("Ha'il"), looseKey('Hail')); assert.equal(looseKey('Jeddah'), looseKey('Jedah'));
  assert.equal(interpretChat('تقرير الإيرادات لشهر مارس ٢٠٢٦ حسب الأمانة', R), null, 'Arabic-Indic digits are read as digits by the chat layer too');
});

ok('Amanah names: spelling variants, transliterations, cities, glued prepositions — every one resolves to the right Amanah (and never to a second one)', () => {
  const V = [['أمانة الرياض', RY], ['امانة الرياض', RY], ['أمانه الرياض', RY], ['أمانة الرياظ', RY], ['الرياظ', RY], ['للرياض', RY], ['بالرياض', RY], ['Riyadh', RY], ['Riyad', RY], ['Riyadh Amanah', RY], ['Amanah of Riyadh', RY],
    ['جدة', JD], ['جده', JD], ['أمانة جدّة', JD], ['أمانة محافظة جدة', JD], ['لجده', JD], ['Jeddah', JD], ['Jiddah', JD], ['Jedda', JD], ['Jeddah Amanah', JD],
    ['المنطقة الشرقية', EP], ['الشرقيه', EP], ['الدمام', EP], ['Dammam', EP], ['Eastern Province', EP],
    ['مكة', MK], ['مكه المكرمه', MK], ['Makkah', MK], ['Mecca', MK], ['Makka', MK],
    ['المدينة المنورة', MD], ['المدينه المنوره', MD], ['للمدينة', MD], ['Madinah', MD], ['Medina', MD], ['Al-Madinah Al-Munawwarah', MD],
    ['عسير', AS], ['أبها', AS], ['Asir', AS], ['الطائف', TF], ['الطايف', TF], ['Taif', TF], ['Ta’if', TF], ['القصيم', QS], ['بريدة', QS], ['Qassim', QS], ['Al-Qassim', QS], ['Buraydah', QS],
    ['الأحساء', AH], ['الاحساء', AH], ['Al-Ahsa', AH], ['Hofuf', AH], ['جازان', JZ], ['جيزان', JZ], ['Jazan', JZ], ['Jizan', JZ], ['تبوك', TB], ['Tabuk', TB], ['حائل', HL], ['حايل', HL], ["Ha'il", HL], ['Hail', HL],
    ['الحدود الشمالية', NB], ['Northern Borders', NB], ['نجران', NJ], ['Najran', NJ], ['حفر الباطن', HB], ['Hafr Al-Batin', HB], ['الباحة', BH], ['Al Baha', BH], ['الجوف', JF], ['Al Jouf', JF]];
  for (const [phrase, key] of V) {
    for (const q of [asReport(phrase), `${asReport(phrase)} ٢٠٢٦`]) { const r = RUN(q); assert.equal(r.kind, 'report', q); assert.equal(r.spec.scope.amanah, key, q); assert.equal(r.spec.scope.muni, 'all', q); }
    const e = resolveEntities(phrase); assert.deepEqual(e.amanahs.map((a) => a.key), [key], `exactly one Amanah in «${phrase}»`); assert.deepEqual(e.problems, [], phrase);
  }
  for (const e of ENTITIES.slice(0, N_AMANAH)) for (const name of [e.ar, e.en, e.en.replace(/ Amanah$/, '')]) assert.deepEqual(resolveEntities(name).amanahs.map((a) => a.key), [e.en], `the catalogue name «${name}» resolves to itself`);
  const ix = buildEntityIndex(); const owner = new Map();
  for (const g of [...ix.amanahs, ...ix.sources]) for (const p of g.phrases) { const k = p.join(' '); assert.ok(!owner.has(k) || owner.get(k) === g.key, `alias «${k}» belongs to two catalogue entries`); owner.set(k, g.key); }
  assert.equal(RUN('مدينة الرياض').spec.scope.amanah, RY, '«مدينة» (city) is not Al Madinah; only «المدينة» is');
  assert.deepEqual([].concat(RUN('Jeddah, Riyadh').spec.scope.amanah).sort(), [JD, RY].sort(), 'a list needs no connector word'); assert.deepEqual([].concat(RUN('الرياض وجدة ومكة').spec.scope.amanah).sort(), [JD, MK, RY].sort());
});

ok('«prepare a report of Amanahs for 2026» (Arabic / English / spelling variants): ALL Amanahs compared, 1 Jan 2026 → the data cutoff (not 31 Dec), no source or status filter', () => {
  const phrases = ['prepare a report of Amanahs for 2026', 'Prepare a report of the Amanahs for 2026', 'Amanahs report 2026', 'Amanat report 2026', 'report on all Amanahs for 2026', 'جهّز تقريراً عن الأمانات لعام 2026', 'جهز تقريرا عن الامانات لعام ٢٠٢٦', 'تقرير الأمانات 2026', 'تقرير الامانات ٢٠٢٦', 'اعرض تقرير الأمانات لعام 2026', 'تقرير كل الأمانات 2026'];
  for (const q of phrases) {
    const r = RUN(q); assert.equal(r.kind, 'report', q); const sc = r.spec.scope;
    assert.equal(sc.amanah, 'all', `${q}: NOT filtered to one Amanah`); assert.equal(sc.muni, 'all'); assert.equal(sc.source, 'all', q); assert.equal(sc.status, 'all', q); assert.equal(sc.scopeType, 'all', q);
    assert.deepEqual([sc.from, sc.to], ['2026-01-01', TODAY], `${q}: year to date, ends at the cutoff`); assert.equal(r.spec.compare, 'none');
    assert.deepEqual(r.spec.sections, ['amanah'], `${q}: the Amanah comparison section`);
    const pc = r.changes.find((c) => c.key === 'period'); assert.ok(pc && pc.endsAtCutoff === true && pc.naturalEnd === '2026-12-31', `${q}: the period change says it ends at the cutoff`);
    assert.ok(describeChange(pc, 'ar', { spec: r.spec }).includes('وليس حتى 31 ديسمبر 2026') && describeChange(pc, 'en', { spec: r.spec }).includes('not to 31 Dec 2026'), 'the cutoff is stated in both languages');
    assert.ok(describeChange(pc, 'en', { spec: r.spec }).includes('9 Oct 2026'), 'the end date shown is the cutoff');
    assert.ok(r.changes.some((c) => c.key === 'amanah' && c.value === 'all'), `${q}: «All Amanahs» is listed in the reading`);
    assert.equal(r.interpretation.genericAmanahs, true); assert.equal(r.interpretation.period.endsAtCutoff, true); assert.deepEqual(r.confirm, [], 'a standard request needs no confirmation');
  }
  // the report built from that reading groups by Amanah (every Amanah is a row), not one Amanah
  const r = RUN('جهّز تقريراً عن الأمانات لعام 2026'); const snap = snapshot(st, { scope: r.spec.scope, cfg });
  const out = { snapshot: snap, forecast: { ready: false, reasonNotReady: { ar: 'x', en: 'x' } }, targetPos: null, achievement: null, cards: [], anomalies: [] };
  const model = buildReportModel({ spec: r.spec, lang: 'en', out, targets: DEFAULT_TARGETS, cases: [], meta: { size: 'compact', counts: { invoicesTotal: st.n } } });
  const am = model.sections.flatMap((x) => x.blocks).find((b) => b.id === 'amanah'); assert.ok(am && am.rows.length > 3, 'the Amanah table has a row per Amanah'); assert.equal(model.sections[0].key, 'amanah', 'the Amanah comparison is the report body (any trailing notes sections are not analyses)');
  // the same words with ONE named Amanah are a one-Amanah report
  for (const q of ['amanah of Riyadh 2026', 'أمانة الرياظ 2026', 'تقرير أمانة الرياض لعام ٢٠٢٦']) { const x = RUN(q); assert.equal(x.kind, 'report', q); assert.equal(x.spec.scope.amanah, RY, q); assert.deepEqual([x.spec.scope.from, x.spec.scope.to], ['2026-01-01', TODAY], q); }
  assert.ok(RUN('أمانة الرياظ 2026').confirm.some((c) => c.key === 'variant_name'), 'a spelling variant is shown for confirmation');
  // a first request that names no Amanah and says nothing about the period keeps the default (and lists no period of its own)
  assert.equal(RUN('Amanah report').spec.scope.amanah, 'all');
});

ok('an Amanah that matches nothing / nearly / several is ASKED about with clickable options — never dropped, never widened to «all Amanahs»', () => {
  const check = (q, kind, firstOptionKey) => {
    const r = RUN(q); assert.equal(r.kind, 'clarify', q); assert.deepEqual(r.changes, [], `${q}: nothing is applied while a part is unresolved`); assert.equal(r.problems[0].kind, kind, q);
    assert.ok(r.question.ar && r.question.en && r.options.length >= 2, q);
    for (const o of r.options) { assert.ok(o.label.ar && o.label.en && o.text, q); const x = RUN(o.text); assert.equal(x.kind, 'report', `${q} → option «${o.text}» is a clean request`); assert.deepEqual([x.spec.scope.from, x.spec.scope.to], ['2026-01-01', TODAY], `${q} → option «${o.text}» keeps the period`); }
    if (firstOptionKey) assert.equal(RUN(r.options[0].text).spec.scope.amanah, firstOptionKey, q);
    return r;
  };
  const a = check('Amanah of Atlantis 2026', 'amanah_unknown', RY); assert.ok(a.question.en.includes('Atlantis') && a.question.en.includes('all Amanahs') && a.question.ar.includes('Atlantis'.length ? 'كل الأمانات' : ''));
  const lastOpt = RUN(a.options[a.options.length - 1].text); assert.equal(lastOpt.spec.scope.amanah, 'all'); assert.ok(lastOpt.spec.sections.includes('amanah'), 'the explicit «all Amanahs» option compares them');
  check('أمانة أطلانطس 2026', 'amanah_unknown', RY); check('تقرير أمانة أطلانطس لعام ٢٠٢٦', 'amanah_unknown', RY); check('Atlantis Amanah report 2026', 'amanah_unknown'); check('amanah Atlantis 2026', 'amanah_unknown');
  const f = check('Amanah of Riyadhh 2026', 'amanah_fuzzy', RY); assert.deepEqual(f.problems[0].candidates, [RY], 'a near miss offers the Amanah it looks like'); check('أمانة جداه 2026', 'amanah_fuzzy', JD);
  for (const q of ['Riyadh and Atlantis amanahs 2026', 'amanah of Riyadh and Atlantis 2026', 'أمانة الرياض وأطلانطس 2026', 'الرياض وجدة وكيرلا 2026']) {
    const r = RUN(q); assert.equal(r.kind, 'clarify', `${q}: the named Amanahs are not applied without the unknown one`); assert.equal(r.problems[0].kind, 'amanah_unknown', q); assert.ok(r.options.length >= 2);
    const without = RUN(r.options[r.options.length - 1].text); assert.equal(without.kind, 'report', q); assert.ok([].concat(without.spec.scope.amanah).includes(RY) || [].concat(without.spec.scope.amanah).includes(JD), `${q}: «continue without it» keeps the Amanahs that were named`);
  }
  // an ordinary word after a name is not an Amanah; a recognised spelling variant is not «unknown»
  assert.equal(RUN('الرياض ومقارنتها').kind, 'report'); assert.equal(RUN('Amanah of Tabuuk').spec.scope.amanah, TB);
  // the property: whatever the unresolvable Amanah phrase, the answer is a question — never a report over all Amanahs
  for (const q of ['Amanah of Gotham', 'report for amanah Wakanda 2026', 'أمانة المريخ', 'تقرير أمانة سيئون للشهر الماضي', 'fines in Atlantis Amanah', 'Amanah of Narnia this month to date', 'show amanah Mordor only']) { const r = RUN(q); assert.equal(r.kind, 'clarify', q); assert.deepEqual(r.changes, [], q); assert.ok(r.question.ar.includes('كل الأمانات') || r.question.en.includes('Amanah'), q); }
  // ambiguity inside the resolver (a name two catalogue entries share) is reported, not resolved by taking the first
  const ix = buildEntityIndex({ entities: [{ en: 'Alpha Amanah', ar: 'أمانة ألفا' }, { en: 'Beta Amanah', ar: 'أمانة بيتا' }], aliases: { 'Alpha Amanah': { ar: ['المركز'], en: [] }, 'Beta Amanah': { ar: ['المركز'], en: ['beta'] } } });
  const amb = resolveEntities('تقرير المركز', { index: ix }); assert.equal(amb.problems[0].kind, 'amanah_ambiguous'); assert.deepEqual(amb.problems[0].candidates.sort(), ['Alpha Amanah', 'Beta Amanah']); assert.equal(amb.amanahs.length, 0);
});

ok('municipalities (reference hierarchy): a name resolves under its Amanah; unknown / ambiguous / other-Amanah / nameless municipalities are asked about with targeted options; the old North/Central/South words select nothing', () => {
  const MUNI = (k) => `${JD}|${k}`; const RABIGH = MUNI('MREF-002-001'); const QOUZ = MUNI('MREF-002-005'); const LAITH = MUNI('MREF-002-003');
  for (const [q, key] of [['تقرير أمانة جدة بلدية القوز', QOUZ], ['تقرير أمانة جدة بلدية القوز القنفذة', QOUZ], ['تقرير أمانة جدة بلدية القوز (القنفذة)', QOUZ], ['تقرير بلدية محافظة رابغ أمانة جدة', RABIGH], ['تقرير جدة بلديه رابغ', RABIGH], ['بلدية الليث لأمانة جدة 2026', LAITH],
    ['Jeddah municipality of Rabigh', RABIGH], ['municipality of Al Laith Jeddah Amanah', LAITH], ['Rabigh municipality, Jeddah Amanah report', RABIGH]]) {
    const r = RUN(q); assert.equal(r.kind, 'report', q); assert.equal(r.spec.scope.amanah, JD, q); assert.equal(r.spec.scope.muni, key, q);
    assert.ok(r.changes.some((c) => c.key === 'muni' && c.value === key), `${q}: «البلدية: …» is in the reading`);
    assert.ok(/^(?:البلدية|Municipality): /.test(describeChange(r.changes.find((c) => c.key === 'muni'), /[؀-ۿ]/.test(q) ? 'ar' : 'en')) && !/MREF/.test(describeChange(r.changes.find((c) => c.key === 'muni'), 'ar')), `${q}: the reading shows the reference name, never an id`);
    assert.equal(r.interpretation.resolved.find((x) => x.kind === 'municipality').key, key, q);
  }
  // the municipality alone: the parent Amanah comes from the reference (stated in the reading, confirmed by the person)
  const alone = RUN('تقرير بلدية القوز'); assert.equal(alone.kind, 'report'); assert.equal(alone.spec.scope.amanah, JD); assert.equal(alone.spec.scope.muni, QOUZ); assert.ok(alone.confirm.some((c) => c.key === 'muni_amanah_inferred') && alone.changes.some((c) => c.key === 'amanah'));
  // a follow-up keeps the chosen Amanah and applies the municipality to it
  const base = RUN('تقرير أمانة جدة للشهر الماضي'); assert.equal(RUN('بلدية الليث', base.spec).spec.scope.muni, LAITH); assert.equal(RUN('بلدية الليث', base.spec).spec.scope.amanah, JD);
  // explicit groups
  for (const [q, tok] of [['تقرير أمانة جدة بلا بلدية', 'NOT_SPECIFIED'], ['تقرير أمانة جدة بدون بلدية', 'NOT_SPECIFIED'], ['تقرير أمانة جدة البلدية غير محددة في المصدر', 'NOT_SPECIFIED'], ['Jeddah Amanah report no municipality', 'NOT_SPECIFIED'], ['تقرير أمانة جدة مباشر على الأمانة', 'DIRECT'], ['Jeddah Amanah issued directly by the Amanah', 'DIRECT']]) {
    const r = RUN(q); assert.equal(r.kind, 'report', q); assert.equal(r.spec.scope.muni, MUNI(tok), q); assert.equal(r.spec.scope.amanah, JD, q);
  }
  const grpNoAm = RUN('تقرير بلا بلدية'); assert.equal(grpNoAm.kind, 'clarify'); assert.equal(grpNoAm.problems[0].kind, 'muni_amanah_missing'); assert.ok(grpNoAm.options.length >= 3 && grpNoAm.options.every((o) => RUN(o.text).spec.scope.muni.endsWith('|NOT_SPECIFIED')));
  // a misspelling: suggested, never resolved silently, never widened to the Amanah
  const typo = RUN('تقرير أمانة جدة بلدية القوس'); assert.equal(typo.kind, 'clarify'); assert.equal(typo.problems[0].kind, 'muni_unknown'); assert.ok(typo.options.some((o) => /القوز/.test(o.label.ar)) && typo.options.some((o) => RUN(o.text).spec.scope.muni === QOUZ), 'القوز is suggested and re-reads to the exact municipality');
  assert.ok(typo.options.every((o) => RUN(o.text).kind === 'report'));
  // a name under no Amanah
  const unk = RUN('بلدية العزيزية'); assert.equal(unk.kind, 'clarify'); assert.equal(unk.problems[0].kind, 'muni_unknown'); assert.ok(unk.options.every((o) => RUN(o.text).kind === 'report'));
  const unkJ = RUN('Jeddah municipality of Atlantis'); assert.equal(unkJ.kind, 'clarify'); assert.equal(unkJ.problems[0].kind, 'muni_unknown'); assert.ok(unkJ.options.some((o) => RUN(o.text).spec.scope.muni === 'all' && RUN(o.text).spec.scope.amanah === JD), 'one option is the whole Amanah (explicit, not automatic)');
  // the same name under several Amanahs → which one (shawwaq exists under Jeddah and Tabuk)
  const amb = RUN('تقرير بلدية الشواق'); assert.equal(amb.kind, 'clarify'); assert.equal(amb.problems[0].kind, 'muni_ambiguous'); assert.equal(amb.options.length, 2);
  assert.deepEqual(amb.options.map((o) => RUN(o.text).spec.scope.amanah).sort(), [JD, TB].sort()); assert.ok(amb.options.every((o) => RUN(o.text).spec.scope.muni !== 'all'));
  assert.equal(RUN('تقرير أمانة جدة بلدية شواق').spec.scope.muni, MUNI('MREF-002-012'), 'with the Amanah stated the name is unique');
  // a municipality of another Amanah than the one stated
  const other = RUN('تقرير أمانة الرياض بلدية رابغ'); assert.equal(other.kind, 'clarify'); assert.equal(other.problems[0].kind, 'muni_other_amanah'); assert.deepEqual(other.options.map((o) => RUN(o.text).spec.scope.muni), [RABIGH, 'all']); assert.equal(RUN(other.options[1].text).spec.scope.amanah, RY);
  // several municipalities in one request / a municipality asked for without a name
  const multi = RUN('تقرير بلدية رابغ وبلدية الليث'); assert.equal(multi.kind, 'clarify'); assert.equal(multi.problems[0].kind, 'muni_multiple'); assert.deepEqual(multi.options.map((o) => RUN(o.text).spec.scope.muni), [RABIGH, LAITH]);
  const nameless = RUN('بلدية جدة'); assert.equal(nameless.kind, 'clarify'); assert.equal(nameless.problems[0].kind, 'muni_name_missing'); assert.ok(nameless.question.ar.includes('15'), 'the question says how many municipalities the Amanah has in the reference'); assert.equal(RUN('Riyadh municipality').problems[0].kind, 'muni_name_missing');
  // the retired North / Central / South wording is not a municipality any more
  for (const q of ['بلدية الرياض الشمالية', 'north municipality report', 'South municipality', 'البلدية الشمالية 2026']) { const r = RUN(q); assert.ok(r.kind === 'clarify' || !/North|Central|South/.test(r.spec.scope.muni), q); assert.ok(!/\|(North|Central|South)$/.test(r.spec?.scope?.muni || 'all'), q); }
  // plural / section wording is not a municipality request, and «municipal fees» is a source
  for (const q of ['تقرير الأمانات والبلديات 2026', 'compare by municipality', 'تقرير حسب البلدية']) assert.ok(!(RUN(q).problems || []).some((p) => p.kind.startsWith('muni')), q);
  assert.equal(RUN('رسوم بلدية للشهر الماضي').spec.scope.source, 'municipal_fees');
  // «all municipalities» / removing the filter clears it
  const sel = RUN('تقرير أمانة جدة بلدية القوز'); assert.equal(RUN('كل البلديات', sel.spec).spec.scope.muni, 'all'); assert.equal(RUN('أزل مرشح البلدية', sel.spec).spec.scope.muni, 'all');
  // permissions: an organisation limited to the Riyadh Amanah never gets another Amanah's municipality — a permission clarification, no options naming it
  const OPT = { allowedAmanahs: [RY] };
  for (const q of ['تقرير أمانة جدة بلدية القوز', 'تقرير بلدية رابغ', 'تقرير بلدية الشواق', 'تقرير أمانة الرياض بلدية رابغ', 'Jeddah municipality of Rabigh']) {
    const r = interpret(q, null, TODAY, OPT); assert.equal(r.kind, 'clarify', q); assert.ok(r.problems.some((p) => /forbidden/.test(p.kind)), q);
    assert.ok(!/جدة|Jeddah|رابغ|القوز|الشواق|تبوك/.test(JSON.stringify(r.options.map((o) => o.text + o.label.ar))), `${q}: no option reveals another Amanah`);
    assert.ok(r.options.every((o) => interpret(o.text, null, TODAY, OPT).kind === 'report'), q);
  }
  assert.equal(interpret('تقرير أمانة الرياض', null, TODAY, OPT).kind, 'report'); assert.equal(interpret('تقرير أمانة الرياض بلا بلدية', null, TODAY, OPT).spec.scope.muni, `${RY}|NOT_SPECIFIED`);
});

ok('revenue sources: Arabic + English synonyms and plurals resolve; «fees» alone, an unknown or not-in-the-system source is asked about', () => {
  const S = [['الغرامات', 'fines'], ['غرامات', 'fines'], ['مخالفات', 'fines'], ['المخالفة', 'fines'], ['الجزاءات', 'fines'], ['fines', 'fines'], ['penalties', 'fines'], ['violations', 'fines'], ['رسوم مخالفات', 'fines'],
    ['الاستثمار', 'investment'], ['استثمار', 'investment'], ['investment', 'investment'], ['investments', 'investment'], ['leasing', 'investment'],
    ['رخص', 'licenses'], ['الرخص', 'licenses'], ['التراخيص', 'licenses'], ['رسوم التراخيص', 'licenses'], ['licences', 'licenses'], ['licenses', 'licenses'], ['licence fees', 'licenses'],
    ['الرسوم البلدية', 'municipal_fees'], ['رسوم بلدية', 'municipal_fees'], ['municipal fees', 'municipal_fees'],
    ['الإيواء', 'accommodation'], ['ايواء', 'accommodation'], ['مرافق الإيواء', 'accommodation'], ['accommodation', 'accommodation'],
    ['التبغ', 'tobacco'], ['تبغ', 'tobacco'], ['tobacco', 'tobacco'], ['الأراضي البيضاء', 'white_lands'], ['اراضي بيضاء', 'white_lands'], ['white lands', 'white_lands'], ['الإسكان', 'housing_sales'], ['housing', 'housing_sales']];
  for (const [phrase, key] of S) { const q = asReport(phrase); const r = RUN(`${q} 2026`); assert.equal(r.kind, 'report', q); assert.equal(r.spec.scope.source, key, q); assert.deepEqual(resolveEntities(phrase).sources.map((x) => x.key), [key], phrase); }
  for (const q of ['رسوم 2026', 'تقرير الرسوم', 'fees report', 'report on fees for 2026']) {
    const r = RUN(q); assert.equal(r.kind, 'clarify', q); assert.equal(r.problems[0].kind, 'source_ambiguous', q); assert.ok(r.problems[0].candidates.includes('municipal_fees') && r.problems[0].candidates.includes('licenses'));
    for (const o of r.options) { const x = RUN(o.text); assert.equal(x.kind, 'report', o.text); assert.ok(r.problems[0].candidates.includes(x.spec.scope.source), o.text); }
  }
  for (const [q, kind] of [['Zakat source report', 'source_unavailable'], ['مصدر الزكاة', 'source_unavailable'], ['تقرير الضريبة', 'source_unavailable'], ['source Atlantis 2026', 'source_unknown'], ['مصدر المريخ', 'source_unknown']]) {
    const r = RUN(q); assert.equal(r.kind, 'clarify', q); assert.equal(r.problems[0].kind, kind, q); assert.deepEqual(r.changes, [], q); assert.ok(r.options.length >= 3 && r.options.every((o) => RUN(o.text).kind === 'report'), q); assert.equal(RUN(r.options[0].text).spec.scope.source !== 'all', true, q);
  }
  assert.equal(RUN('fines and investment 2026').kind, 'clarify', 'two sources in one request: asked which');
  const both = RUN('تقرير الغرامات في جدة للربع الثالث ٢٠٢٦'); assert.deepEqual([both.spec.scope.source, both.spec.scope.amanah, both.spec.scope.from, both.spec.scope.to], ['fines', JD, '2026-07-01', '2026-09-30']);
});

ok('periods: last quarter, Q3 2026, month and quarter ranges, Arabic-Indic digits, Levant month names, year ranges — applied completely; impossible or conflicting periods are asked about', () => {
  const P = [['last quarter', '2026-07-01', '2026-09-30'], ['previous quarter report', '2026-07-01', '2026-09-30'], ['report for the last quarter', '2026-07-01', '2026-09-30'], ['تقرير الربع الماضي', '2026-07-01', '2026-09-30'], ['الربع السابق', '2026-07-01', '2026-09-30'],
    ['Q3 2026', '2026-07-01', '2026-09-30'], ['report Q3 2026', '2026-07-01', '2026-09-30'], ['الربع الثالث ٢٠٢٦', '2026-07-01', '2026-09-30'], ['تقرير الربع الثالث 2026', '2026-07-01', '2026-09-30'], ['Q2', '2026-04-01', '2026-06-30'],
    ['من يناير إلى مارس 2026', '2026-01-01', '2026-03-31'], ['من يناير الى مارس ٢٠٢٦', '2026-01-01', '2026-03-31'], ['January to March 2026', '2026-01-01', '2026-03-31'], ['from January to March 2026', '2026-01-01', '2026-03-31'], ['between January and March 2026', '2026-01-01', '2026-03-31'],
    ['بين يناير ومارس 2026', '2026-01-01', '2026-03-31'], ['Jan-Mar 2026', '2026-01-01', '2026-03-31'], ['من مارس حتى يونيو', '2026-03-01', '2026-06-30'], ['Q1 to Q3 2026', '2026-01-01', '2026-09-30'], ['من الربع الأول إلى الربع الثالث 2026', '2026-01-01', '2026-09-30'],
    ['this month to date', '2026-10-01', TODAY], ['هذا الشهر حتى اليوم', '2026-10-01', TODAY], ['الشهر الماضي', '2026-09-01', '2026-09-30'], ['year to date', '2026-01-01', TODAY], ['السنة حتى اليوم', '2026-01-01', TODAY],
    ['تقرير آذار', '2026-03-01', '2026-03-31'], ['تقرير كانون الثاني', '2026-01-01', '2026-01-31'], ['تقرير يونية', '2026-06-01', '2026-06-30'], ['2025 to 2026', '2025-01-01', TODAY], ['من 2025 إلى 2026', '2025-01-01', TODAY],
    ['report for 2026-03-15', '2026-03-15', '2026-03-15'], ['report 2026-03', '2026-03-01', '2026-03-31'], ['2026', '2026-01-01', TODAY], ['عام ٢٠٢٦', '2026-01-01', TODAY], ['year 2025', '2025-01-01', '2025-12-31']];
  for (const [q, from, to] of P) { const r = RUN(q); assert.equal(r.kind, 'report', q); assert.deepEqual([r.spec.scope.from, r.spec.scope.to], [from, to], q); }
  // a range that is cut at the cutoff says so; a complete one does not
  for (const q of ['من أغسطس إلى ديسمبر 2026', 'July to December 2026', '2026']) { const pc = RUN(q).changes.find((c) => c.key === 'period'); assert.equal(pc.endsAtCutoff, true, q); assert.ok(pc.naturalEnd > TODAY); }
  for (const q of ['Q3 2026', 'last quarter', 'من يناير إلى مارس 2026', 'this month to date', 'year 2025']) { const pc = RUN(q).changes.find((c) => c.key === 'period'); assert.ok(pc && !pc.endsAtCutoff || q === 'this month to date', q); }
  assert.equal(RUN('year to date').changes.find((c) => c.key === 'period')?.endsAtCutoff, undefined, '«to date» already says it');
  // periods that do not exist / conflict are asked about, with options
  for (const q of ['Q5 2026', 'الربع الخامس', 'report for month 13', 'شهر 13', '31 فبراير', 'report 2026-02-30', '2025 and 2026', 'من نوفمبر إلى فبراير', 'report for 2027', 'report 2024', 'يناير ومارس 2026', 'Q3 2025 to Q1 2026', 'from Q3 to Q1']) {
    const r = RUN(q); assert.equal(r.kind, 'clarify', q); assert.ok(r.question.ar && r.question.en && r.options.length >= 2, q); assert.deepEqual(r.changes, [], q);
    for (const o of r.options) assert.equal(RUN(o.text).kind, 'report', `${q} → ${o.text}`);
  }
  assert.equal(RUN('Q5 2026').problems[0].kind, 'period_invalid'); assert.equal(RUN('الربع الخامس').options.length, 4, 'a non-existent quarter offers the four real ones');
  // a follow-up keeps its other filters when a range is typed
  const base = RUN('تقرير أمانة جدة للشهر الماضي'); const fu = RUN('من يناير إلى مارس 2026', base.spec); assert.deepEqual([fu.spec.scope.from, fu.spec.scope.to, fu.spec.scope.amanah], ['2026-01-01', '2026-03-31', JD]);
});

ok('statuses: several / pending / due / unknown statuses are asked about; subsumed ones are not; synonyms resolve', () => {
  for (const [q, status] of [['overdue invoices', 'overdue'], ['late invoices', 'overdue'], ['الفواتير المتأخرة', 'overdue'], ['unpaid invoices only', 'open'], ['الفواتير غير المسددة', 'open'], ['paid invoices', 'collected'], ['الفواتير المدفوعة', 'collected'], ['الفواتير المسددة جزئيا', 'partial'], ['partially paid invoices', 'partial'], ['الفواتير الملغاة', 'cancelled'], ['الفواتير المتأخرة غير المحصلة', 'overdue']]) { const r = RUN(q); assert.equal(r.kind, 'report', q); assert.equal(r.spec.scope.status, status, q); }
  for (const [q, kind] of [['overdue and partial invoices', 'status_multiple'], ['الفواتير المتأخرة والمحصلة', 'status_multiple'], ['pending invoices', 'status_ambiguous'], ['الفواتير المعلقة', 'status_ambiguous'], ['due invoices', 'status_ambiguous'], ['frozen invoices', 'status_unknown'], ['الفواتير المجمدة', 'status_unknown']]) {
    const r = RUN(q); assert.equal(r.kind, 'clarify', q); assert.equal(r.problems[0].kind, kind, q); assert.deepEqual(r.changes, [], q); assert.ok(r.options.length >= 2, q);
    for (const o of r.options) { const x = RUN(o.text); assert.equal(x.kind, 'report', `${q} → ${o.text}`); assert.notEqual(x.spec.scope.status, 'all', `${q} → ${o.text}`); }
  }
  assert.equal(RUN('الفواتير الداخلية فقط').spec.scope.scopeType, 'internal', 'a scope word is not an unknown status');
});

ok('the request guard and the follow-ups use the same normalisation (Arabic-Indic numbers in «top 5»; a follow-up Amanah typo is asked about)', () => {
  assert.ok(findUnapplied(normText('أكبر ٥ أمانات')).some((u) => u.key === 'top_n')); const t = RUN('أكبر ٥ أمانات'); assert.equal(t.kind, 'clarify'); assert.ok(t.unapplied.includes('top_n'));
  const base = RUN('تقرير الشهر الماضي'); assert.equal(RUN('اعرض أمانة الرياظ فقط', base.spec).spec.scope.amanah, RY); const bad = RUN('اعرض أمانة أطلانطس فقط', base.spec); assert.equal(bad.kind, 'clarify'); assert.equal(bad.spec, base.spec, 'the existing report spec is untouched while the question is open');
  assert.equal(RUN('كل الأمانات', RUN('تقرير أمانة جدة').spec).spec.scope.amanah, 'all', 'asking for all Amanahs explicitly widens on purpose');
});

ok('«حلل أسباب عدم التحصيل» / non-collection analysis / why are invoices unpaid → the single section `noncollection` (never the exclusions section); with «والاستبعادات» the exclusions pair is kept', () => {
  for (const q of ['حلل أسباب عدم التحصيل لهذه السنة', 'أسباب عدم السداد', 'تحليل أسباب عدم التحصيل', 'non-collection analysis', 'analyze non collection', 'why are invoices unpaid', 'why are my invoices still unpaid this year?', 'reasons for non-payment']) {
    const r = RUN(q); assert.deepEqual(r.spec.sections, ['noncollection'], q); assert.deepEqual(r.problems || [], [], q); assert.equal(r.spec.scope.status, 'all', q);
  }
  assert.equal(RUN('non-collection analysis for Riyadh').spec.scope.amanah, RY); assert.deepEqual(RUN('حلل أسباب عدم التحصيل').spec.sections, ['noncollection']);
  const both = RUN('حلّل أسباب عدم التحصيل والاستبعادات').spec.sections; assert.ok(both.includes('noncollection') && both.includes('exclusions') && both.includes('status'));
  assert.deepEqual(RUN('show exclusions').spec.sections, ['exclusions'], 'the plain exclusions request is unchanged');
});

export const groups = n;
if (import.meta.url === `file://${process.argv[1]}`) console.log(`request interpretation: ${n} test groups passed`);
