// Tests of the filters of the pages with their OWN filters: enforcement lists and investment contracts
// (src/components/filters/localPages.js + the contracts / enforcement entries of filterConfig.js). Run with `npm run test:filterpages2`.
// All data below is synthetic.
import assert from 'node:assert/strict';
import { geoScopeFromAmanahKeys } from '../src/data/geoScope.js';
import { FILTER_PAGES } from '../src/components/filters/filterConfig.js';
import { isDefaultValue, defaultOf, activeKeys, cascadePatch, deriveChips, defaultValueText, parseUrlFilters, serializeUrlFilters, permittedAmanahOptions } from '../src/components/filters/filterLogic.js';
import {
  enforcementFields, referredFields, enfDefaults, ENF_KEYS, SANAD_REVIEW, SOURCE_REVIEW, sanadMatches, allMatches, eefaaMatches, referredMatches, sanitizeValues, sortOptions,
  contractFields, contractFilterBody, startInRange, CONTRACT_KEYS, CONTRACT_DEFAULTS
} from '../src/components/filters/localPages.js';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };
const opt = (v, l = v) => ({ value: v, label: l });
const O = { entities: [opt('A'), opt('B')], statuses: [opt('1', 'status one'), opt('2')], debtorTypes: [opt('1'), opt('4')], executionBases: [opt('evidence'), opt('none')], mumtathil: [opt('linked'), opt('ambiguous'), opt('unmatched'), opt('conflicting')], reports: [opt('r1')] };
const keysOf = (fields) => fields.map((f) => f.key);

/* ---------------------------------------------------------------- enforcement: field configuration */
ok('sanad list: 3 primary controls (Amanah, source status, ONE review control) and everything else under «More»', () => {
  const f = enforcementFields('sanad', O);
  assert.deepEqual(f.filter((x) => x.primary).map((x) => x.key), ['am', 'st', 'review']);
  assert.deepEqual(keysOf(f.filter((x) => !x.primary)), ['dtype', 'why', 'doc', 'fin', 'from', 'to']);
  assert.equal(new Set(keysOf(f)).size, f.length, 'no duplicate field keys');
  assert.equal(f.some((x) => x.key === 'needs'), false, 'the «needs action» toggle is not a separate control any more');
  assert.ok(SANAD_REVIEW.some((o) => o.value === 'open'), '«needs action» is ONE option of the review control');
  assert.equal(f.filter((x) => x.type === 'text' && x.inputType === 'date').length, 2, 'the referral range is explicit From / To date fields');
});
ok('the config descriptor of the page matches the fields that are built', () => {
  const built = [...enforcementFields('sanad', O), ...enforcementFields('eefaa', O)].map((x) => x.key);
  for (const k of [...FILTER_PAGES.enforcement.primary, ...FILTER_PAGES.enforcement.secondary]) assert.ok(built.includes(k), `enforcement key ${k} is built`);
  assert.deepEqual(FILTER_PAGES.contracts.primary.concat(FILTER_PAGES.contracts.secondary).filter((k) => !contractFields({ scoped: false }).some((f) => f.key === k)), []);
  assert.equal(FILTER_PAGES.planning, undefined, 'the plan page has no page-filter entry: its filter is the URL view scope (Amanah → municipality), tested in tests/plans-ui.test.mjs');
  assert.equal(FILTER_PAGES.enforcement.dateBasis, 'order'); assert.equal(FILTER_PAGES.contracts.dateBasis, 'contract');
});
ok('eefaa and «all» lists: review is Needs action / No action needed, execution basis, Mumtathil link, report, special cases and amount range are in «More»', () => {
  const f = enforcementFields('eefaa', O);
  assert.deepEqual(f.filter((x) => x.primary).map((x) => x.key), ['am', 'st', 'review']);
  assert.deepEqual(keysOf(f.filter((x) => !x.primary)), ['ex', 'mu', 'rp', 'fl', 'min', 'max']);
  assert.deepEqual(SOURCE_REVIEW.map((o) => o.value), ['all', 'open', 'complete']);
  assert.deepEqual(keysOf(enforcementFields('all', O)), ['am', 'st', 'review']);
  assert.deepEqual(keysOf(referredFields()), ['enf']);
});
ok('every field has an «All» / empty default and the URL keys cover every field (+ search and sort)', () => {
  for (const view of ['all', 'sanad', 'eefaa']) {
    const f = enforcementFields(view, O); const d = enfDefaults(view);
    for (const x of f) { assert.ok(ENF_KEYS[view].includes(x.key), `${view}:${x.key} is a URL key`); assert.equal(d[x.key], defaultOf(x), `${view}:${x.key} default`); }
    assert.ok(ENF_KEYS[view].includes('q') && ENF_KEYS[view].includes('sort'));
    assert.equal(d.sort, sortOptions(view)[0].value);
  }
});

/* ---------------------------------------------------------------- default detection, chips, dependent clearing */
ok('«Clear filters» only when non-default: default values are inactive, any selection is active', () => {
  const f = enforcementFields('sanad', O); const d = enfDefaults('sanad');
  assert.deepEqual(activeKeys(f, d), []);
  assert.deepEqual(activeKeys(f, { ...d, review: 'open', from: '2026-03-01' }), ['review', 'from']);
  assert.equal(isDefaultValue(f.find((x) => x.key === 'from'), ''), true);
});
ok('chips: one per meaningful selection, never an «All» chip; primary controls are left out on desktop; date chips read in words', () => {
  const f = enforcementFields('sanad', O); const d = enfDefaults('sanad');
  assert.deepEqual(deriveChips(f, d, { lang: 'en' }), []);
  const chips = deriveChips(f, { ...d, am: 'A', why: 'conflicts', from: '2026-03-01' }, { lang: 'en', exclude: ['am', 'st', 'review'] });
  assert.deepEqual(chips.map((c) => c.key), ['why', 'from']);
  assert.match(chips[1].value, /2026/); assert.doesNotMatch(chips[1].value, /^2026-03-01$/, 'not the raw ISO text');
  const num = enforcementFields('eefaa', O).find((x) => x.key === 'min');
  assert.match(defaultValueText(num, '500', 'en'), /500/);
});
ok('date range inputs bound each other (From ≤ To) so an inverted range cannot be typed', () => {
  const f = enforcementFields('sanad', O); const from = f.find((x) => x.key === 'from'); const to = f.find((x) => x.key === 'to');
  assert.equal(from.max({ to: '2026-06-30' }), '2026-06-30'); assert.equal(to.min({ from: '2026-03-01' }), '2026-03-01'); assert.equal(from.max({ to: '' }), undefined);
});
ok('dependent clearing: an unknown parent clears the child, and nothing in these pages invents a dependency', () => {
  for (const f of [enforcementFields('sanad', O), enforcementFields('eefaa', O), contractFields({ scoped: true })]) assert.equal(f.some((x) => x.dependsOn), false, 'no municipality-under-Amanah dependency is offered where the data has none');
  const defs = [{ key: 'parent', type: 'select', options: [opt('all'), opt('x')] }, { key: 'child', type: 'select', dependsOn: 'parent', options: (v) => (v.parent === 'x' ? [opt('all'), opt('c1')] : [opt('all')]), clearedNotice: { ar: 'أُزيل', en: 'cleared' } }];
  const r = cascadePatch(defs, { parent: 'x', child: 'c1' }, { parent: 'all' });
  assert.equal(r.values.child, 'all'); assert.deepEqual(r.cleared, ['child']);
});

/* ---------------------------------------------------------------- mapping to the existing page filters */
const sanadRow = (over = {}) => ({ c: { amanahEn: 'A', source: { statusId: 1, debtorTypeId: 4, raiseAt: '2026-04-10 09:00' }, openedDate: '2026-04-10' }, comp: { extraction: { state: 'complete' }, finance: { state: 'reconciled' } }, ex: [], review: 'complete', blob: 'snd-1001 4606424', ...over });
const SV = (over = {}) => ({ ...enfDefaults('sanad'), ...over });
ok('sanad mapping: every control narrows exactly as the old list did', () => {
  const rows = [sanadRow(), sanadRow({ review: 'needs_review', ex: ['conflicts'], blob: 'snd-1002' }), sanadRow({ review: 'not_identified', ex: ['no_references'], c: { amanahEn: 'B', source: { statusId: 2, debtorTypeId: 1, raiseAt: '2026-08-01' } }, comp: { extraction: { state: 'no_document' }, finance: { state: 'short' } } })];
  const run = (v) => rows.filter((r) => sanadMatches(r, SV(v)));
  assert.equal(run({}).length, 3);
  assert.equal(run({ review: 'open' }).length, 2, '«needs action» = every review that is not complete');
  assert.equal(run({ review: 'complete' }).length, 1); assert.equal(run({ review: 'not_identified' }).length, 1);
  assert.equal(run({ am: 'B' }).length, 1); assert.equal(run({ st: '2' }).length, 1); assert.equal(run({ dtype: '4' }).length, 2);
  assert.equal(run({ doc: 'no_document' }).length, 1); assert.equal(run({ fin: 'difference' }).length, 1); assert.equal(run({ why: 'conflicts' }).length, 1);
  assert.equal(run({ from: '2026-04-01', to: '2026-04-30' }).length, 2, 'date basis = the referral (raise) date');
  assert.equal(run({ from: '2026-09-01' }).length, 0); assert.equal(run({ to: '2026-07-31' }).length, 2);
  assert.equal(run({ q: '1002' }).length, 1, 'search matches the order / request / invoice text');
  assert.equal(run({ am: 'A', review: 'open', from: '2026-04-01' }).length, 1, 'filters combine with AND');
});
ok('all / eefaa / referred-invoice mapping', () => {
  const all = [{ entity: 'A', statuses: ['s1'], need: true, blob: '9100001 inv-5' }, { entity: 'B', statuses: ['s2', 's1'], need: false, blob: 'v-7' }];
  const AV = (o) => ({ ...enfDefaults('all'), ...o });
  assert.equal(all.filter((r) => allMatches(r, AV({ review: 'open' }))).length, 1); assert.equal(all.filter((r) => allMatches(r, AV({ review: 'complete' }))).length, 1);
  assert.equal(all.filter((r) => allMatches(r, AV({ st: 's1' }))).length, 2); assert.equal(all.filter((r) => allMatches(r, AV({ am: 'B', q: 'V-7' }))).length, 1);
  const ef = [{ ent: 'A', st: [{ value: 's1' }], need: true, basis: 'evidence', relStatus: 'ambiguous', conflicting: false, reports: ['r1'], hasConflicts: true, damaged: false, amount: 100, blob: 'v1' },
    { ent: 'A', st: [{ value: 's1' }], need: false, basis: 'none', relStatus: undefined, conflicting: true, reports: ['r2'], hasConflicts: false, damaged: true, amount: null, blob: 'v2' }];
  const EV = (o) => ({ ...enfDefaults('eefaa'), ...o }); const run = (o) => ef.filter((r) => eefaaMatches(r, EV(o))).length;
  assert.equal(run({ review: 'open' }), 1); assert.equal(run({ ex: 'evidence' }), 1); assert.equal(run({ mu: 'unmatched' }), 1, 'no Mumtathil record counts as unmatched'); assert.equal(run({ mu: 'conflicting' }), 1);
  assert.equal(run({ rp: 'r2' }), 1); assert.equal(run({ fl: 'conflicts' }), 1); assert.equal(run({ fl: 'damaged' }), 1);
  assert.equal(run({ min: '50' }), 1, 'a violation without an amount is never inside an amount range'); assert.equal(run({ max: '500' }), 1, 'an unknown amount is never inside any amount bound (missing is not zero)'); assert.equal(run({ min: '50', max: '500' }), 1);
  const e = { current: 'in_execution', closedOnly: false }; const c = { current: 'none', closedOnly: true };
  assert.equal(referredMatches('X-1', e, { q: '', enf: 'inexec' }), true); assert.equal(referredMatches('X-1', c, { q: '', enf: 'inexec' }), false);
  assert.equal(referredMatches('X-1', c, { q: 'x-', enf: 'closed' }), true); assert.equal(referredMatches('X-1', c, { q: 'zzz', enf: 'all' }), false);
});
ok('sanitize: an option that no longer exists (old link, ?review=bogus) falls back to the default instead of a blank select', () => {
  const f = enforcementFields('sanad', O);
  assert.equal(sanitizeValues(f, { ...enfDefaults('sanad'), review: 'bogus', st: '999', am: 'A' }).review, 'all');
  assert.equal(sanitizeValues(f, { ...enfDefaults('sanad'), st: '999' }).st, 'all');
  assert.equal(sanitizeValues(f, { ...enfDefaults('sanad'), review: 'open', am: 'A' }).review, 'open', 'the KPI card link ?review=open stays valid');
  assert.equal(sanitizeValues(enforcementFields('sanad', {}), { ...enfDefaults('sanad'), st: '2' }).st, '2', 'before the data loads nothing is discarded');
});
ok('URL round-trip keeps the filters, drops defaults and preserves the other params (the source switch)', () => {
  const keys = ENF_KEYS.sanad; const d = enfDefaults('sanad');
  const s = serializeUrlFilters('?view=sanad', { ...d, review: 'open', from: '2026-03-01', q: 'x' }, keys, d);
  assert.match(s, /view=sanad/); assert.match(s, /review=open/); assert.match(s, /from=2026-03-01/); assert.doesNotMatch(s, /am=|st=|sort=/);
  const back = parseUrlFilters(s, keys, d); assert.equal(back.review, 'open'); assert.equal(back.from, '2026-03-01'); assert.equal(back.q, 'x'); assert.equal(back.am, 'all');
  assert.equal(serializeUrlFilters(s, d, keys, d), '?view=sanad', 'clearing leaves only the view');
});

/* ---------------------------------------------------------------- contracts */
const CO = { scoped: true, amanahs: [{ code: '001', name: 'Amanah One' }, { code: '002', name: 'Amanah Two' }], rentals: [opt('started')], types: [opt('operate')], statuses: [opt('Contract-Approved')] };
ok('contracts (approved-only scope): Amanah + execution status primary; service type and the contract start range in «More»; no municipality, no installment filter, no stored-status select', () => {
  const f = contractFields(CO);
  assert.deepEqual(f.filter((x) => x.primary).map((x) => x.key), ['amanah', 'rental']);
  assert.deepEqual(keysOf(f.filter((x) => !x.primary)), ['type', 'from', 'to']);
  assert.equal(f.some((x) => /municipal|installment|payment/i.test(x.key)), false);
  assert.deepEqual(keysOf(contractFields({ ...CO, scoped: false })).slice(0, 3), ['amanah', 'rental', 'status'], 'when the dataset is not scoped the stored status is offered');
  assert.match(f.find((x) => x.key === 'from').label.en, /start date \(as stored\)/i, 'the date basis is stated on the control');
  assert.deepEqual(CONTRACT_KEYS.filter((k) => k !== 'q'), ['amanah', 'rental', 'type', 'status', 'from', 'to']);
});
ok('contract filter body: defaults are omitted and the keys are the ones the data service understands', () => {
  assert.deepEqual(contractFilterBody(CONTRACT_DEFAULTS), {});
  assert.deepEqual(contractFilterBody({ ...CONTRACT_DEFAULTS, amanah: '001', rental: 'started', type: 'operate', from: '2022-01-01', to: '2022-12-31' }), { municipality: '001', rental: 'started', type: 'operate', startFrom: '2022-01-01', startTo: '2022-12-31' });
  assert.deepEqual(contractFilterBody({ ...CONTRACT_DEFAULTS, status: 'Contract-Approved' }, true), {}, 'inside the approved-only scope the stored status is not sent');
  assert.deepEqual(contractFilterBody({ ...CONTRACT_DEFAULTS, status: 'Contract-Approved' }, false), { status: 'Contract-Approved' });
  const f = contractFields(CO); assert.deepEqual(activeKeys(f, { ...CONTRACT_DEFAULTS, from: '2022-01-01' }), ['from']);
});
ok('contract start range rule: single stored start inside the range only; none / differing starts are not guessed in', () => {
  assert.equal(startInRange('2022-03-29', '2022-01-01', '2022-12-31'), true); assert.equal(startInRange('2023-01-01', '', '2022-12-31'), false);
  assert.equal(startInRange(null, '2022-01-01', ''), false); assert.equal(startInRange('2022-03-29', '', ''), true);
});

/* ----------------------------------------------------------------  limits of the account */
ok('the Amanah options offered by a page are limited to the account\'s geographic access', () => {
  const access = geoScopeFromAmanahKeys(['Riyadh Amanah']); assert.ok(permittedAmanahOptions(access).every((a) => a.key === 'Riyadh Amanah'), 'the options offered are limited to the account scope');
});

console.log(`filters-pages2: ${n} checks passed`);
