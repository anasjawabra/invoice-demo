// Tests of the saved-report store: round trip, versions, size fallback, user isolation, permissions. Run with `npm run test:reportstore`.
import assert from 'node:assert/strict';
import { createStore, makeRecord, verifyRecord, modelOfRecord, fitRecords, coverageOf, canView, mergeCoverage, versionsOf, nextVersion, userKeyOf, toJsonSafe, KEYS, LIMITS } from '../src/data/reportStore.js';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };

// an in-memory localStorage with an optional quota (in characters)
function mem(quota = Infinity) {
  const m = new Map();
  const used = () => [...m.entries()].reduce((t, [k, v]) => t + k.length + v.length, 0);
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => { m.delete(k); }, setItem: (k, v) => { const next = used() - (m.has(k) ? k.length + m.get(k).length : 0) + k.length + String(v).length; if (next > quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } m.set(k, String(v)); } };
}
const rows = (k) => Array.from({ length: k }, (_, i) => [`row ${i}`, i * 1000.5, i / 7, null]);
const model = (lang, title, extra = 0) => ({ id: 'rpt-1', title, subtitle: '2026-01-01 → 2026-11-05', generatedAt: '2026-11-05T09:00:00.000Z', cutoff: '2026-11-05', lang, equationOk: true, empty: false, totals: { gross: 1000, net: 800, collected: 500 }, headline: [{ type: 'kpis', items: [{ label: lang === 'ar' ? 'المحصّل' : 'Collected', value: '500', raw: 500 }] }], sections: [{ key: 'executive', title: 'S', blocks: [{ type: 'chart', kind: 'bar', title: 'c', labels: ['a', 'b'], series: [{ label: 's', values: [1, null] }] }, { type: 'table', id: 't', title: 'T', headers: [], rows: rows(extra), total: null }] }], summaryText: 'x' });
const org = (keys) => ({ id: keys ? 'riyadh' : 'mof-hq', amanahKeys: keys });
const spec = (amanah = 'all') => ({ scope: { from: '2026-01-01', to: '2026-11-05', amanah, source: 'all' }, compare: 'none', sections: ['executive'] });
const rec = (msgId, version, at, { extra = 0, convId = 'c1', sp = spec(), o = org(null) } = {}) => makeRecord({ msgId, convId, version, requestId: `u${version}`, lineageId: convId, generatedAt: at, cutoff: '2026-11-05', lang: 'ar', spec: sp, org: o, models: { ar: model('ar', `تقرير ${version}`, extra), en: model('en', `Report ${version}`, extra) } });
const A = userKeyOf({ user: 'demo' }); const B = userKeyOf({ user: 'auditor' });
const conv = (id, title = 'T') => ({ id, title, createdAt: 1, updatedAt: 2, spec: spec(), messages: [{ id: 'u1', role: 'user', text: 'hi' }, { id: 'a1', role: 'assistant', kind: 'report', status: 'done', model: { huge: true }, amodel: { huge: true } }] });

ok('user key: stable per sign-in name (falls back to email, then name), none when nobody is signed in', () => { assert.equal(A, 'u:demo'); assert.equal(userKeyOf(null), null); assert.notEqual(A, B); assert.equal(userKeyOf({ email: 'T@Example.test' }), 'u:t@example.test'); assert.equal(userKeyOf({ canReview: true }), null); });

ok('round trip: the saved model comes back identical in both languages (figures unchanged), with the save details in meta', () => {
  const s = createStore({ storage: mem() }); const r1 = rec('a1', 1, '2026-11-05T09:00:00.000Z', { extra: 30 });
  const w = s.saveReports(A, 'c1', { a1: r1 }); assert.ok(w.ok);
  const back = s.loadReports(A, 'c1'); assert.deepEqual(back.unreadable, []);
  const r = back.records.a1; assert.ok(verifyRecord(r));
  assert.deepEqual(r.models.ar, JSON.parse(JSON.stringify(model('ar', 'تقرير 1', 30)))); assert.deepEqual(r.models.en, JSON.parse(JSON.stringify(model('en', 'Report 1', 30))));
  const m = modelOfRecord(r, 'en'); assert.equal(m.lang, 'en'); assert.equal(m.meta.version, 1); assert.equal(m.meta.generatedAt, '2026-11-05T09:00:00.000Z'); assert.equal(m.meta.cutoff, '2026-11-05'); assert.equal(m.meta.requestId, 'u1');
  assert.equal(modelOfRecord(r, 'ar').totals.net, 800); assert.equal(m.sections[0].blocks[0].series[0].values[1], null, 'a missing value stays missing, never zero');
});

ok('a damaged record is reported as unreadable and never returned', () => {
  const st = mem(); const s = createStore({ storage: st }); s.saveReports(A, 'c1', { a1: rec('a1', 1, '2026-11-05T09:00:00.000Z') });
  const k = `${KEYS.reports}:${A}:c1`; const j = JSON.parse(st.getItem(k)); j.records.a1.models.ar.totals.net = 999999; st.setItem(k, JSON.stringify(j));
  const back = s.loadReports(A, 'c1'); assert.deepEqual(back.records, {}); assert.deepEqual(back.unreadable, ['a1']);
});

ok('non-finite numbers are flagged, not silently kept', () => { const r = toJsonSafe({ a: NaN, b: [1, Infinity], c: undefined }); assert.deepEqual(r.value, { a: null, b: [1, null] }); assert.equal(r.lossy.length, 3); });

ok('conversations: the list is light (no models), per user', () => {
  const s = createStore({ storage: mem() }); s.saveConvs(A, [conv('c1', 'Mine')]);
  const l = s.listConvs(A); assert.equal(l.length, 1); assert.equal(l[0].owner, A); assert.equal(l[0].messages[1].model, undefined); assert.equal(l[0].messages[1].amodel, undefined);
});

ok('user isolation: another user never lists, loads or reaches the first user\'s conversations or reports', () => {
  const st = mem(); const s = createStore({ storage: st });
  s.saveConvs(A, [conv('c1', 'Secret')]); s.saveReports(A, 'c1', { a1: rec('a1', 1, '2026-11-05T09:00:00.000Z') });
  assert.deepEqual(s.listConvs(B), []); assert.deepEqual(s.loadReports(B, 'c1').records, {}); assert.deepEqual(s.listConvs(null), []); assert.equal(s.usage(B), 0); assert.ok(s.usage(A) > 0);
  // even a conversation copied under the other user's key is refused (it is owned by A)
  st.setItem(`${KEYS.index}:${B}`, st.getItem(`${KEYS.index}:${A}`)); assert.deepEqual(s.listConvs(B), []);
  // and a record filed under another conversation id is refused
  const v = JSON.parse(st.getItem(`${KEYS.reports}:${A}:c1`)); st.setItem(`${KEYS.reports}:${A}:c9`, JSON.stringify(v)); assert.deepEqual(s.loadReports(A, 'c9').records, {});
  // the legacy shared list belongs to nobody
  st.setItem(KEYS.legacy, JSON.stringify([conv('old')])); assert.deepEqual(s.listConvs(B), []); assert.equal(s.listConvs(A).length, 1);
});

ok('delete removes the conversation AND its saved versions', () => {
  const st = mem(); const s = createStore({ storage: st });
  s.saveConvs(A, [conv('c1'), conv('c2')]); s.saveReports(A, 'c1', { a1: rec('a1', 1, '2026-11-05T09:00:00.000Z') }); s.saveReports(A, 'c2', { a2: rec('a2', 1, '2026-11-05T09:00:00.000Z', { convId: 'c2' }) });
  s.removeConv(A, 'c1'); assert.deepEqual(s.listConvs(A).map((c) => c.id), ['c2']); assert.equal(st.getItem(`${KEYS.reports}:${A}:c1`), null); assert.ok(st.getItem(`${KEYS.reports}:${A}:c2`));
  // dropping a conversation from the list also drops its reports
  s.saveConvs(A, []); assert.equal(st.getItem(`${KEYS.reports}:${A}:c2`), null);
});

ok('versions are numbered in order and a new one never replaces an earlier one', () => {
  const r1 = rec('a1', 1, '2026-11-05T09:00:00.000Z'); const r2 = rec('a2', 2, '2026-11-05T10:00:00.000Z');
  const map = { a2: r2, a1: r1 }; assert.deepEqual(versionsOf(map).map((r) => r.version), [1, 2]); assert.equal(nextVersion(map), 3); assert.equal(nextVersion({}), 1);
  assert.equal(r1.models.ar.title, 'تقرير 1'); assert.equal(r2.models.ar.title, 'تقرير 2'); assert.notEqual(r1.generatedAt, r2.generatedAt);
});

ok('size cap: the oldest versions lose the other language first, then their sections; the newest stays whole; every drop is reported', () => {
  const r1 = rec('a1', 1, '2026-11-05T09:00:00.000Z', { extra: 400 }); const r2 = rec('a2', 2, '2026-11-05T10:00:00.000Z', { extra: 400 }); const r3 = rec('a3', 3, '2026-11-05T11:00:00.000Z', { extra: 400 });
  const full = JSON.stringify({ records: { a1: r1, a2: r2, a3: r3 } }).length;
  const f1 = fitRecords({ a1: r1, a2: r2, a3: r3 }, Math.floor(full * 0.8));
  assert.ok(f1.notes.length > 0 && f1.notes[0].msgId === 'a1' && f1.notes[0].step === 'language'); assert.deepEqual(Object.keys(f1.records.a1.models), ['ar']); assert.deepEqual(Object.keys(f1.records.a3.models).sort(), ['ar', 'en']); assert.ok(verifyRecord(f1.records.a1));
  const f2 = fitRecords({ a1: r1, a2: r2, a3: r3 }, Math.floor(full * 0.4));
  assert.ok(f2.notes.some((x) => x.step === 'detail')); assert.equal(f2.records.a1.models.ar.sections.length, 0); assert.equal(f2.records.a1.models.ar.totals.net, 800, 'headline figures remain'); assert.equal(f2.records.a1.prune.detail, true);
  assert.equal(f2.records.a3.models.ar.sections[0].blocks[1].rows.length, 400, 'the newest version is untouched'); assert.ok(verifyRecord(f2.records.a1) && verifyRecord(f2.records.a2));
  const f3 = fitRecords({ a1: r1 }, 10); assert.ok(f3.over, 'a single record over the cap is reported, not cut');
  assert.equal(modelOfRecord(f2.records.a1, 'ar').meta.pruned.detail, true);
});

ok('quota fallback: when the browser refuses, older versions shrink and the save still succeeds; when nothing fits the failure is reported', () => {
  const r1 = rec('a1', 1, '2026-11-05T09:00:00.000Z', { extra: 300 }); const r2 = rec('a2', 2, '2026-11-05T10:00:00.000Z', { extra: 300 });
  const full = JSON.stringify({ v: 1, records: { a1: r1, a2: r2 } }).length;
  const s = createStore({ storage: mem(Math.floor(full * 0.7)) }); const w = s.saveReports(A, 'c1', { a1: r1, a2: r2 });
  assert.ok(w.ok, 'saved after shrinking'); assert.ok(w.notes.length > 0); assert.equal(s.loadReports(A, 'c1').records.a2.models.ar.sections[0].blocks[1].rows.length, 300, 'the newest version is whole');
  const tiny = createStore({ storage: mem(200) }); const w2 = tiny.saveReports(A, 'c1', { a1: r1 }); assert.equal(w2.ok, false); assert.equal(w2.error, 'quota');
  const none = createStore({ storage: null }); assert.equal(none.saveReports(A, 'c1', { a1: r1 }).ok, false); assert.deepEqual(none.listConvs(A), []);
  assert.ok(LIMITS.reportChars > 100000);
});

ok('permissions: coverage follows the Amanah actually included; a narrower organisation cannot open a wider report', () => {
  assert.deepEqual(coverageOf(spec('all'), org(null)), { all: true, keys: [] });
  assert.deepEqual(coverageOf(spec('all'), org(['Riyadh Amanah'])), { all: false, keys: ['Riyadh Amanah'] }, 'under a local organisation "all" means its own Amanah');
  assert.deepEqual(coverageOf(spec(['Makkah Amanah', 'Riyadh Amanah']), org(null)), { all: false, keys: ['Makkah Amanah', 'Riyadh Amanah'] });
  const central = coverageOf(spec('all'), org(null)); const riyadh = coverageOf(spec('Riyadh Amanah'), org(null)); const makkah = coverageOf(spec('Makkah Amanah'), org(null));
  assert.equal(canView(central, org(null)), true); assert.equal(canView(central, org(['Riyadh Amanah'])), false, 'a national report is restricted for a Riyadh-only organisation');
  assert.equal(canView(riyadh, org(['Riyadh Amanah'])), true); assert.equal(canView(makkah, org(['Riyadh Amanah'])), false); assert.equal(canView(riyadh, org(null)), true); assert.equal(canView(null, org(['x'])), true);
  assert.deepEqual(mergeCoverage(riyadh, makkah), { all: false, keys: ['Riyadh Amanah', 'Makkah Amanah'] }); assert.equal(mergeCoverage(riyadh, central).all, true);
  assert.deepEqual(rec('a1', 1, '2026-11-05T09:00:00.000Z', { sp: spec('Makkah Amanah') }).coverage, { all: false, keys: ['Makkah Amanah'] });
});

console.log(`report store: ${n} tests passed`);
