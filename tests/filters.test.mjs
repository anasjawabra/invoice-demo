// Tests of the platform filter logic (src/components/filters/filterLogic.js + filterConfig.js + the period registry). Run with `npm run test:filters`.
import assert from 'node:assert/strict';
import { ALL_SCOPE, geoScopeFromAmanahKeys } from '../src/data/geoScope.js';
import { PERIOD_CHOICES, periodChoiceLabel, presetRange, presetAvailable, detectPreset } from '../src/data/periodPresets.js';
import { DATA_START } from '../src/data/revenueLedger.js';
import {
  SCOPE_DEFAULTS, DEFAULT_PERIOD_PRESET, activeKeys, isDefaultValue, defaultOf, deriveChips, cascadePatch, clearedNoticeText, permittedAmanahOptions, municipalityOptions,
  dateBasisLabel, dateBasisLine, periodIsDefault, periodText, validateCustomRange, parseUrlFilters, serializeUrlFilters, STATUS_LABELS, DUE_POSITION_KEYS, pick
} from '../src/components/filters/filterLogic.js';
import { FILTER_PAGES, buildScopeDefs, scopeToValues, applyScopePatch } from '../src/components/filters/filterConfig.js';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };
const TODAY = '2026-11-05';
const scope = (over = {}) => ({ preset: 'ytd', from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', product: [], mainClass: 'all', ...over });
const defsFor = (keys, ctx = {}) => buildScopeDefs(keys, { today: TODAY, ...ctx });
const ALL_KEYS = ['period', 'amanah', 'municipality', 'source', 'status', 'invoiceOrigin', 'product', 'mainClass'];

/* ---- period registry: six choices, ranges around month / quarter / year ends ---- */
ok('six period choices, in the agreed order; the registry stays the single source of ranges', () => {
  assert.deepEqual(PERIOD_CHOICES, ['month', 'lastMonth', 'qtd', 'ytd', 'all', 'custom']);
  for (const k of PERIOD_CHOICES.filter((x) => x !== 'custom')) assert.ok(presetRange(k, TODAY), k);
  assert.equal(periodChoiceLabel('all', 'ar'), 'جميع البيانات المتاحة'); assert.equal(periodChoiceLabel('all', 'en'), 'All available data');
  assert.equal(periodChoiceLabel('ytd', 'ar'), 'السنة حتى اليوم');
  assert.equal(periodChoiceLabel('last3', 'en'), 'Last 3 complete months', 'a stored preset that is not offered any more keeps its own label');
});
ok('month to date / previous month / quarter to date / year to date / all data on an ordinary day', () => {
  assert.deepEqual(presetRange('month', TODAY), { from: '2026-11-01', to: TODAY });
  assert.deepEqual(presetRange('lastMonth', TODAY), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(presetRange('qtd', TODAY), { from: '2026-10-01', to: TODAY });
  assert.deepEqual(presetRange('ytd', TODAY), { from: '2026-01-01', to: TODAY });
  assert.deepEqual(presetRange('all', TODAY), { from: DATA_START, to: TODAY });
});
ok('around month ends: 31st, 1st, leap February, January (previous month = last December), quarter edges', () => {
  assert.deepEqual(presetRange('lastMonth', '2026-03-31'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(presetRange('lastMonth', '2026-03-01'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(presetRange('lastMonth', '2028-03-01'), { from: '2028-02-01', to: '2028-02-29' }, 'leap year');
  assert.deepEqual(presetRange('lastMonth', '2026-01-01'), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(presetRange('month', '2026-01-31'), { from: '2026-01-01', to: '2026-01-31' });
  assert.deepEqual(presetRange('qtd', '2026-03-31'), { from: '2026-01-01', to: '2026-03-31' });
  assert.deepEqual(presetRange('qtd', '2026-04-01'), { from: '2026-04-01', to: '2026-04-01' }, 'first day of a quarter');
  assert.deepEqual(presetRange('qtd', '2026-12-31'), { from: '2026-10-01', to: '2026-12-31' });
  assert.deepEqual(presetRange('ytd', '2026-12-31'), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(presetRange('all', '2026-01-01'), { from: DATA_START, to: '2026-01-01' });
});
ok('a preset entirely before the first loaded date is flagged unavailable (never silently replaced)', () => {
  assert.equal(presetAvailable('lastMonth', '2025-01-15'), false, 'December 2024 is before the data start');
  assert.equal(presetAvailable('lastMonth', '2025-02-10'), true);
  assert.equal(presetAvailable('ytd', '2025-01-01'), true);
});
ok('default detection of the period follows the RANGE (a custom range equal to year to date is still the default)', () => {
  assert.equal(DEFAULT_PERIOD_PRESET, 'ytd');
  assert.equal(periodIsDefault({ preset: 'ytd', from: '2026-01-01', to: TODAY }, TODAY), true);
  assert.equal(periodIsDefault({ preset: 'custom', from: '2026-01-01', to: TODAY }, TODAY), true);
  assert.equal(periodIsDefault({ preset: 'month', from: '2026-11-01', to: TODAY }, TODAY), false);
  assert.equal(periodIsDefault({ preset: 'custom', from: '2026-02-01', to: '2026-03-31' }, TODAY), false);
  assert.equal(detectPreset('2026-02-01', '2026-03-31', TODAY), 'custom');
});
ok('the period text names the choice and the range once (no cutoff inside it)', () => {
  assert.equal(periodText({ preset: 'ytd', from: '2026-01-01', to: TODAY }, 'ar'), 'السنة حتى اليوم · 1 يناير – 5 نوفمبر 2026');
  assert.equal(periodText({ preset: 'ytd', from: '2026-01-01', to: TODAY }, 'en'), 'Year to date · 1 Jan – 5 Nov 2026');
  assert.equal(periodText({ preset: 'custom', from: '2026-03-01', to: '2026-04-15' }, 'en'), 'Custom range · 1 Mar – 15 Apr 2026');
});

/* ---- custom range validation ---- */
ok('custom range: from <= to and inside the data availability, with the reason', () => {
  assert.deepEqual(validateCustomRange('2026-03-01', '2026-04-15', { today: TODAY }).ok, true);
  const inv = validateCustomRange('2026-05-01', '2026-04-01', { today: TODAY, lang: 'en' }); assert.equal(inv.ok, false); assert.equal(inv.code, 'inverted'); assert.match(inv.message, /start date is after the end date/);
  assert.equal(validateCustomRange('2026-12-01', '2026-12-31', { today: TODAY }).code, 'future');
  assert.equal(validateCustomRange('2024-01-01', '2024-06-30', { today: TODAY }).code, 'before_data');
  assert.equal(validateCustomRange('2026-02', '2026-03-01', { today: TODAY }).code, 'incomplete');
  const adj = validateCustomRange('2024-06-01', '2026-12-31', { today: TODAY, lang: 'en' }); assert.equal(adj.ok, true); assert.equal(adj.from, DATA_START); assert.equal(adj.to, TODAY); assert.ok(adj.message, 'an adjusted range is explained');
  assert.equal(validateCustomRange('2026-03-05', '2026-03-05', { today: TODAY }).ok, true, 'one day');
});

/* ---- date basis ---- */
ok('date-basis labels per page kind', () => {
  assert.equal(dateBasisLabel('issue', 'ar'), 'تاريخ الإصدار'); assert.equal(dateBasisLabel('payment', 'ar'), 'تاريخ الدفع'); assert.equal(dateBasisLabel('contract', 'ar'), 'تاريخ العقد'); assert.equal(dateBasisLabel('order', 'ar'), 'تاريخ الأمر');
  assert.equal(dateBasisLabel('payment', 'en'), 'Payment date'); assert.equal(dateBasisLabel('nope', 'en'), '');
  assert.equal(dateBasisLine('order', 'en'), 'Date basis: Order date');
  const dated = Object.entries(FILTER_PAGES).filter(([, v]) => v.dateBasis); for (const [k, v] of dated) assert.ok(dateBasisLabel(v.dateBasis, 'ar'), `${k} has a valid date basis`);
  assert.equal(FILTER_PAGES.contracts.dateBasis, 'contract'); assert.equal(FILTER_PAGES.enforcement.dateBasis, 'order');
});

/* ---- defaults + «Clear filters» detection ---- */
ok('the real defaults (year to date, everything else all) show NO active filter', () => {
  const defs = defsFor(ALL_KEYS); const values = scopeToValues(scope());
  assert.deepEqual(activeKeys(defs, values, { today: TODAY }), []);
  assert.deepEqual(SCOPE_DEFAULTS, { amanah: 'all', source: 'all', muni: 'all', status: 'all', scopeType: 'all', product: [], mainClass: 'all' });
});
ok('each non-default value is detected on its own key (period included)', () => {
  const defs = defsFor(ALL_KEYS);
  const act = (s) => activeKeys(defs, scopeToValues(scope(s)), { today: TODAY });
  assert.deepEqual(act({ preset: 'month', from: '2026-11-01' }), ['period']);
  assert.deepEqual(act({ amanah: 'Riyadh Amanah' }), ['amanah']);
  assert.deepEqual(act({ amanah: 'Riyadh Amanah', muni: 'Riyadh Amanah|North' }), ['amanah', 'municipality']);
  assert.deepEqual(act({ source: 'fines' }), ['source']); assert.deepEqual(act({ status: 'overdue' }), ['status']); assert.deepEqual(act({ scopeType: 'central' }), ['invoiceOrigin']);
  assert.deepEqual(act({ product: ['foras'] }), ['product']); assert.deepEqual(act({ mainClass: 'استثمار' }), ['mainClass']);
  assert.deepEqual(act({ amanah: ['Riyadh Amanah', 'Jeddah Amanah'] }), ['amanah'], 'a multi-Amanah selection is non-default');
});
ok('duePosition and status are ONE scope field: a page offers one of them, never both', () => {
  const d = defsFor(['period', 'status', 'duePosition']); assert.deepEqual(d.map((x) => x.key), ['period', 'duePosition']);
  const due = d.find((x) => x.key === 'duePosition'); assert.deepEqual(due.options.map((o) => o.value), ['all', ...DUE_POSITION_KEYS]);
  assert.equal(scopeToValues(scope({ status: 'overdue' })).duePosition, 'overdue');
});
ok('hidden statuses are not offered (ScopeBar hideStatuses)', () => {
  const st = defsFor(['status'], { hideStatuses: ['cancelled', 'excluded'] })[0]; assert.ok(!st.options.some((o) => ['cancelled', 'excluded'].includes(o.value))); assert.ok(st.options.some((o) => o.value === 'collected'));
});

/* ---- chips ---- */
ok('chips: only meaningful non-default selections — never an «All …» chip, never the period', () => {
  const defs = defsFor(ALL_KEYS);
  const none = deriveChips(defs, scopeToValues(scope()), { lang: 'ar', ctx: { today: TODAY } }); assert.deepEqual(none, []);
  const vals = scopeToValues(scope({ preset: 'month', from: '2026-11-01', amanah: 'Riyadh Amanah', source: 'fines', product: ['foras', 'baladi'], status: 'overdue' }));
  const chips = deriveChips(defs, vals, { lang: 'en', ctx: { today: TODAY } });
  assert.deepEqual(chips.map((c) => c.key), ['amanah', 'source', 'status', 'product']);
  assert.ok(!chips.some((c) => c.key === 'period'), 'the period lives in its own control');
  assert.ok(chips.every((c) => !/^all\b/i.test(c.value) && c.value !== 'All'), 'no «All …» chip');
  assert.equal(chips.find((c) => c.key === 'product').value, 'Furas, Baladi'); assert.equal(chips.find((c) => c.key === 'status').value, STATUS_LABELS.overdue.en);
  const ar = deriveChips(defs, vals, { lang: 'ar', ctx: { today: TODAY } }); assert.equal(ar.find((c) => c.key === 'amanah').value, 'أمانة منطقة الرياض');
  const ex = deriveChips(defs, vals, { lang: 'en', ctx: { today: TODAY }, exclude: ['amanah', 'source'] }); assert.deepEqual(ex.map((c) => c.key), ['status', 'product'], 'primary controls already show their value');
});

/* ---- dependent clearing ---- */
ok('municipality options depend on the Amanah: none for «all» and for the Housing sector; for an Amanah its reference municipalities plus three explicit groups (tests/municipality.test.mjs checks the hierarchy)', () => {
  assert.deepEqual(municipalityOptions('all'), []); assert.deepEqual(municipalityOptions(['a', 'b']), []);
  assert.equal(municipalityOptions('Riyadh Amanah').length, 3 + 47); assert.ok(municipalityOptions('Riyadh Amanah').every((o) => o.value.startsWith('Riyadh Amanah|')));
  assert.equal(municipalityOptions('Housing Sector').length, 0);
  const mu = defsFor(['amanah', 'municipality']).find((d) => d.key === 'municipality'); assert.equal(mu.disabled({ amanah: 'all' }), true); assert.equal(mu.disabled({ amanah: 'Riyadh Amanah' }), false);
});
ok('changing the Amanah clears an incompatible municipality AND says so; an unchanged Amanah / empty municipality clears nothing', () => {
  const defs = defsFor(['period', 'amanah', 'municipality']); const values = scopeToValues(scope({ amanah: 'Riyadh Amanah', muni: 'Riyadh Amanah|North' }));
  const r = cascadePatch(defs, values, { amanah: 'Jeddah Amanah' });
  assert.equal(r.values.municipality, 'all'); assert.deepEqual(r.cleared, ['municipality']);
  assert.equal(clearedNoticeText(defs, r.cleared, 'ar'), 'أُزيلت البلدية لأن الأمانة تغيّرت'); assert.match(clearedNoticeText(defs, r.cleared, 'en'), /municipality was cleared/);
  assert.deepEqual(cascadePatch(defs, values, { amanah: 'Riyadh Amanah' }).cleared, [], 'same Amanah: nothing changes');
  assert.deepEqual(cascadePatch(defs, scopeToValues(scope({ amanah: 'Riyadh Amanah' })), { amanah: 'Jeddah Amanah' }).cleared, [], 'municipality was already «all»: nothing to announce');
  assert.deepEqual(cascadePatch(defs, values, { amanah: 'all' }).cleared, ['municipality']);
  const both = cascadePatch(defs, values, { amanah: 'Jeddah Amanah', municipality: 'Jeddah Amanah|Central' }); assert.equal(both.values.municipality, 'Jeddah Amanah|Central'); assert.deepEqual(both.cleared, [], 'a patch that sets both is kept');
});

/* ---- permissions ---- */
ok('Amanah options are limited to the ACCOUNT\'s geographic access (null / all = every Amanah)', () => {
  const all = permittedAmanahOptions(ALL_SCOPE); assert.ok(all.length >= 17); assert.equal(permittedAmanahOptions(null).length, all.length);
  const one = permittedAmanahOptions(geoScopeFromAmanahKeys(['Riyadh Amanah'])); assert.deepEqual(one.map((a) => a.key), ['Riyadh Amanah']);
  const two = permittedAmanahOptions(geoScopeFromAmanahKeys(['Makkah Amanah', 'Jeddah Amanah'])); assert.deepEqual(two.map((a) => a.key).sort(), ['Jeddah Amanah', 'Makkah Amanah']);
  const def = buildScopeDefs(['amanah'], { access: geoScopeFromAmanahKeys(['Riyadh Amanah']), today: TODAY })[0]; const opts = def.options({ amanah: 'all' });
  assert.deepEqual(opts.map((o) => o.value), ['all', 'Riyadh Amanah'], 'nothing outside the permissions is offered');
  assert.match(pick(opts[0].label, 'en'), /access/);
  const full = buildScopeDefs(['amanah'], { access: ALL_SCOPE, today: TODAY })[0].options({ amanah: 'all' }); assert.ok(full.length > 17); assert.equal(pick(full[0].label, 'en'), 'All Amanahs and entities');
});

/* ---- binding to the shared scope setters ---- */
ok('a filter patch reaches the right shared-scope setter, Amanah before municipality, presets by key, custom by range', () => {
  const calls = []; const rec = (name) => (...a) => calls.push([name, ...a]);
  const setters = { today: TODAY, setPreset: rec('preset'), setCustomRange: rec('custom'), setAmanah: rec('amanah'), setMuni: rec('muni'), setSource: rec('source'), setStatus: rec('status'), setScopeType: rec('origin'), setProduct: rec('product'), setMainClass: rec('class') };
  applyScopePatch({ municipality: 'Jeddah Amanah|North', amanah: 'Jeddah Amanah', period: { preset: 'qtd', from: '2026-10-01', to: TODAY }, source: 'fines', duePosition: 'overdue', invoiceOrigin: 'central', product: ['foras'], mainClass: 'استثمار' }, setters);
  assert.deepEqual(calls, [['preset', 'qtd'], ['amanah', 'Jeddah Amanah'], ['muni', 'Jeddah Amanah|North'], ['source', 'fines'], ['status', 'overdue'], ['origin', 'central'], ['product', ['foras']], ['class', 'استثمار']]);
  calls.length = 0; applyScopePatch({ period: { preset: 'custom', from: '2026-03-01', to: '2026-04-15' } }, setters); assert.deepEqual(calls, [['custom', '2026-03-01', '2026-04-15']]);
  calls.length = 0; applyScopePatch({ amanah: '__multi' }, setters); assert.deepEqual(calls, [], 'the report-only «several Amanahs» value is a no-op');
});

/* ---- page configuration registry ---- */
ok('every page configuration has <= 4 primary controls and only known keys; primary and secondary never overlap', () => {
  const known = new Set(['period', 'amanah', 'municipality', 'source', 'status', 'invoiceOrigin', 'product', 'mainClass', 'duePosition', 'comparison', 'extra']);
  for (const [name, c] of Object.entries(FILTER_PAGES)) {
    assert.ok(c.primary.length <= 4, `${name}: ${c.primary.length} primary controls`);
    assert.ok(!c.primary.some((k) => c.secondary.includes(k)), `${name}: overlap`);
    if (!c.local) for (const k of [...c.primary, ...c.secondary]) assert.ok(known.has(k), `${name}: unknown key ${k}`);
    if (!c.local) assert.ok(!(c.primary.concat(c.secondary).includes('status') && c.primary.concat(c.secondary).includes('duePosition')), `${name}: status and duePosition together`);
  }
  assert.deepEqual(FILTER_PAGES.dashboard.primary, ['period', 'amanah', 'municipality', 'source']); assert.deepEqual(FILTER_PAGES.dashboard.secondary, []);
  for (const k of ['default', 'dashboard', 'decisions', 'collected', 'uncollected', 'exclusions', 'product']) { const c = FILTER_PAGES[k]; assert.ok(c.primary.includes('municipality') && !c.secondary.includes('municipality'), `${k}: the municipality is a primary control`); assert.equal(c.primary.indexOf('municipality'), c.primary.indexOf('amanah') + 1, `${k}: right after the Amanah`); }
  for (const k of ['contracts']) assert.ok(!FILTER_PAGES[k].primary.concat(FILTER_PAGES[k].secondary).includes('municipality'), `${k}: no municipality in the data`);
  assert.ok(!FILTER_PAGES.dashboard.secondary.includes('comparison'), 'the dashboard compares automatically with the same period last year: no comparison control');
  assert.ok(FILTER_PAGES.uncollected.primary.includes('duePosition')); assert.ok(FILTER_PAGES.local === undefined);
});
ok('product / main class are consolidated in the «Revenue classification» group, status / origin in «Invoice»; revenue source is its own field', () => {
  const d = defsFor(['source', 'product', 'mainClass', 'status', 'invoiceOrigin', 'municipality', 'amanah']); const g = (k) => d.find((x) => x.key === k).group;
  assert.equal(g('product'), 'classification'); assert.equal(g('mainClass'), 'classification'); assert.equal(g('status'), 'invoice'); assert.equal(g('invoiceOrigin'), 'invoice'); assert.equal(g('municipality'), 'location');
  assert.equal(d.find((x) => x.key === 'source').label.en, 'Revenue source', 'revenue source keeps a distinct name');
  assert.equal(d.find((x) => x.key === 'product').label.en, 'Product (platform)');
});
ok('comparison is offered only when the page supplies it, and defaults to «none»', () => {
  assert.equal(defsFor(['comparison']).length, 0);
  const c = defsFor(['comparison'], { comparison: { value: 'none' } })[0]; assert.deepEqual(c.options.map((o) => o.value), ['none', 'prev_year', 'prev_month']); assert.equal(defaultOf(c), 'none');
  assert.equal(isDefaultValue(c, 'none'), true); assert.equal(isDefaultValue(c, 'prev_year'), false);
});

/* ---- URL round-trip ---- */
ok('URL state: defaults are omitted, other params preserved, arrays round-trip, parse gives the defaults back', () => {
  const keys = ['status', 'amanah', 'product']; const defaults = { status: 'all', amanah: 'all', product: [] };
  assert.equal(serializeUrlFilters('', defaults, keys, defaults), '');
  const s = serializeUrlFilters('?page=3&q=ab', { status: 'overdue', amanah: 'all', product: ['foras', 'baladi'] }, keys, defaults);
  const sp = new URLSearchParams(s); assert.equal(sp.get('page'), '3'); assert.equal(sp.get('q'), 'ab'); assert.equal(sp.get('status'), 'overdue'); assert.equal(sp.get('product'), 'foras,baladi'); assert.equal(sp.has('amanah'), false);
  assert.deepEqual(parseUrlFilters(s, keys, defaults), { status: 'overdue', amanah: 'all', product: ['foras', 'baladi'] });
  const back = serializeUrlFilters(s, { status: 'all', amanah: 'all', product: [] }, keys, defaults); assert.equal(new URLSearchParams(back).toString(), 'page=3&q=ab', 'clearing removes only the filter keys');
  assert.deepEqual(parseUrlFilters('?status=open&unrelated=1', keys, defaults), { status: 'open', amanah: 'all', product: [] });
  const r2 = parseUrlFilters(serializeUrlFilters('', { status: 'a b&c', amanah: 'Riyadh Amanah', product: [] }, keys, defaults), keys, defaults); assert.equal(r2.status, 'a b&c'); assert.equal(r2.amanah, 'Riyadh Amanah');
});

console.log(`filters: ${n} checks passed`);
