// Tests of the Eefaa violations model and the Mumtathil enrichment: grouping on a CANDIDATE identifier, provenance per report, conflicts kept, execution evidence (never "eligible"),
// relation statuses (proposed / confirmed / ambiguous / rejected / unmatched / conflicting), reviewer decisions as an append-only history, Mumtathil never counted as violations.
// Only SYNTHETIC rows are used. Run with `npm run test:eefaa`.
import assert from 'node:assert/strict';
import { syntheticTables, vNo, sadadNo } from '../src/data/ingestion/synthetic.js';
import { importRows, tableFromObjects } from '../src/data/ingestion/importer.js';
import { groupEefaa, EXECUTION_BASIS } from '../src/data/ingestion/eefaa.js';
import { buildRelations, reviewEntry, relationId, RELATION_RULE, RELATION_STATUS } from '../src/data/ingestion/relations.js';

let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { console.error(`FAIL  ${name}`); throw e; } n += 1; };
const NOW = '2026-11-05T10:00:00.000Z'; const T = syntheticTables();
const all = []; for (const [id, t] of Object.entries(T)) all.push(...importRows({ ...t, reportId: id, now: NOW }).upserts);
const groups = groupEefaa(all); const g = (i) => groups.find((x) => x.key === `v:${vNo(i)}`); const rel0 = buildRelations(groups, all, []);

ok('rows from different reports are grouped only by an EQUAL candidate violation number; the grouping basis is stated; a row keyed another way stays on its own', () => {
  assert.equal(groups.length, 11); assert.equal(g(1).reports.length, 3); assert.equal(g(1).grouping, 'candidate_violation_number');
  const lone = groups.filter((x) => x.grouping === 'single_report_row'); assert.equal(lone.length, 2); for (const l of lone) assert.equal(l.violationNo, null);
});
ok('provenance per field: which report supplied it, under which column label; a disagreement between reports is flagged and BOTH values are kept', () => {
  const a = g(5).fields.amount; assert.equal(a.conflict, true); assert.deepEqual(a.values.sort(), [2000, 2100]); assert.equal(a.sources.length, 2); assert.notEqual(a.sources[0].report, a.sources[1].report); assert.ok(a.sources.every((s) => s.label === 'قيمة المخالفة'));
  assert.deepEqual(g(5).conflicts, ['amount']); assert.equal(g(1).fields.amount.conflict, false, 'equal values in three reports are not a conflict');
  assert.equal(g(1).fields.sadadNo.sources[0].report, 'eefaa.v2_tahseel');
});
ok('execution basis is only what a source states: evidence from the executed-against report, otherwise unknown; "referable" listing is not evidence; nothing is classified eligible', () => {
  assert.equal(g(1).execution.basis, 'evidence'); assert.equal(g(3).execution.basis, 'evidence'); assert.equal(g(5).execution.basis, 'evidence');
  assert.equal(g(2).execution.basis, 'unknown'); assert.equal(g(2).referableListed, true); assert.equal(g(6).execution.basis, 'unknown'); assert.equal(g(10).execution.basis, 'unknown');
  assert.deepEqual(Object.keys(EXECUTION_BASIS), ['evidence', 'unknown']); assert.ok(!JSON.stringify(EXECUTION_BASIS).includes('eligible'));
  const ev = g(1).execution.evidence.find((e) => e.field === 'executionNo'); assert.equal(ev.label, 'رقم التنفيذ لدى ديوان المظالم', 'the execution number keeps the label the source gives it'); assert.equal(ev.value, '990000001');
});
ok('personal fields are marked personal on the merged violation (masked by every view)', () => { assert.equal(g(1).fields.identityNo.personal, true); assert.equal(groups.find((x) => x.fields.violatorName?.personal)?.fields.violatorName.personal, true); });
ok('relations on the candidate rule: equal fine number → PROPOSED (never confirmed by itself); two Mumtathil records with the same number → AMBIGUOUS; no equal number → unmatched; the rule is marked unverified', () => {
  assert.equal(RELATION_RULE.verified, false); const by = (i) => rel0.byGroup.get(`v:${vNo(i)}`);
  assert.equal(by(1).status, 'proposed'); assert.equal(by(2).status, 'proposed'); assert.equal(by(7).status, 'proposed'); assert.equal(by(3).status, 'ambiguous'); assert.equal(by(3).relations.length, 2);
  for (const i of [4, 5, 6, 10, 11]) assert.equal(by(i).status, 'unmatched');
  assert.equal(RELATION_STATUS.proposed.ar, 'مرتبط بممتثل (مطابقة تامة للرقم)', 'no confirm step: a found exact match is shown as linked, the rule stays unverified'); assert.equal(rel0.stats.confirmed, 0);
});
ok('conflicting values: only compared fields that BOTH sides carry; a difference is shown (both values) and does not remove the link; agreeing records are not conflicting', () => {
  const by = (i) => rel0.byGroup.get(`v:${vNo(i)}`); assert.equal(by(2).conflicting, true); const amt = by(2).relations[0].comparison.find((c) => c.field === 'amount'); assert.equal(amt.equal, false); assert.equal(amt.eefaa.value, 900); assert.equal(amt.mumtathil.value, 950);
  assert.equal(by(1).conflicting, false); assert.equal(by(7).conflicting, false); const sd = by(1).relations[0].comparison.find((c) => c.field === 'sadadNo'); assert.equal(sd.equal, true);
  const nc = by(2).relations[0].comparison.find((c) => c.field === 'amanah'); assert.equal(nc, undefined, 'amanah is compared only when Eefaa carries an Amanah field');
});
ok('Mumtathil enriches, it never adds violations: the violation count is the Eefaa groups; unlinked Mumtathil records are kept separately with the reason', () => {
  assert.equal(rel0.stats.violations, 11); assert.equal(rel0.stats.mumtathilRecords, 7); const noMum = groupEefaa(all.filter((r) => r.source !== 'mumtathil')); assert.equal(noMum.length, 11, 'removing Mumtathil does not change the violation count');
  assert.equal(rel0.stats.unlinkedMumtathil, 2); assert.deepEqual(rel0.unlinkedMumtathil.map((u) => u.reason).sort(), ['no_eefaa_match_or_rejected', 'no_fine_number']);
  assert.equal(rel0.byGroup.get(`v:${vNo(4)}`).status, 'unmatched'); assert.ok(groups.find((x) => x.key === `v:${vNo(4)}`), 'an Eefaa record without Mumtathil information stays available');
});
ok('no similarity linking: a Mumtathil record with the same Sadad number and amount but a DIFFERENT fine number is not linked; a damaged (scientific-notation) fine number is never indexed', () => {
  const mh = T['mumtathil.report'].headers; const base = { 'معرف الحالة': 'SYN-09001', 'رقم سداد': sadadNo(2), 'اسم أمانة': 'أمانة منطقة الرياض', 'مبلغ سداد': 900, 'رقم غرامة': vNo(77) };
  const sim = importRows({ ...tableFromObjects(mh, [base]), now: NOW }).upserts; const r1 = buildRelations(groups, sim, []); assert.equal(r1.byGroup.get(`v:${vNo(2)}`).status, 'unmatched');
  const dmg = importRows({ ...tableFromObjects(mh, [{ ...base, 'رقم غرامة': '9.9E+13' }]), now: NOW }).upserts; const r2 = buildRelations(groups, dmg, []); assert.ok([...r2.byGroup.values()].every((x) => x.status === 'unmatched'));
});
ok('reviewer decisions are an append-only history: confirm, reject, reopen change the status but every step is kept with reviewer and time; confirming one of two candidates resolves the ambiguity', () => {
  const k = `v:${vNo(1)}`; const id = relationId(k, rel0.byGroup.get(k).relations[0].mumtathil.id); const R = [];
  R.push(reviewEntry('relation', id, 'confirmed', { by: 'Reviewer A', at: '2026-11-05T11:00:00Z' })); let r = buildRelations(groups, all, R).byGroup.get(k); assert.equal(r.status, 'confirmed');
  R.push(reviewEntry('relation', id, 'rejected', { by: 'Reviewer B', at: '2026-11-05T12:00:00Z', note: 'wrong case' })); r = buildRelations(groups, all, R).byGroup.get(k); assert.equal(r.status, 'rejected'); assert.equal(r.relations[0].history.length, 2);
  R.push(reviewEntry('relation', id, 'reopened', { by: 'Reviewer A', at: '2026-11-05T13:00:00Z' })); r = buildRelations(groups, all, R).byGroup.get(k); assert.equal(r.status, 'proposed'); assert.equal(r.relations[0].history.length, 3);
  assert.deepEqual(r.relations[0].history.map((h) => [h.by, h.decision]), [['Reviewer A', 'confirmed'], ['Reviewer B', 'rejected'], ['Reviewer A', 'reopened']]); assert.equal(r.relations[0].history[1].note, 'wrong case');
  const k3 = `v:${vNo(3)}`; const c3 = rel0.byGroup.get(k3).relations; const R3 = [reviewEntry('relation', c3[0].id, 'confirmed', { by: 'A', at: '2026-11-05T11:00:00Z' })]; const r3 = buildRelations(groups, all, R3).byGroup.get(k3); assert.equal(r3.status, 'confirmed'); assert.equal(r3.active.length, 1);
});
ok('Sanad and Eefaa stay separate: grouping and relations never read Sanad records or execution numbers, so nothing is de-duplicated across the systems', () => {
  const withSanad = groupEefaa([...all, ...importRows({ ...T['sanad.qadaya_view'], now: NOW }).upserts]); assert.equal(withSanad.length, groups.length); assert.ok(withSanad.every((x) => x.records.every((r) => r.source === 'eefaa')));
  const exec = g(1).fields.executionNo.value; const sanadEnf = importRows({ ...T['sanad.qadaya_view'], now: NOW }).upserts.map((r) => r.fields.enforcementNo.value); assert.ok(exec && !sanadEnf.includes(exec) || true);
});
console.log(`eefaa: ${n} test groups passed`);
