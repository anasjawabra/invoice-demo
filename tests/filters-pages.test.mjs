// Tests of the per-page filter logic of Collected invoices · Uncollected · Exclusions · Decision Room · Product (src/components/filters/pageFilters.js + their FILTER_PAGES entries).
// Run with `npm run test:filterpages`. Synthetic values only.
import assert from 'node:assert/strict';
import {
  PROCESS_STATES, PAY_STATUS_KEYS, EXEC_KEYS, kindVisible, collectedLocal, uncollectedLocal, exclusionsLocal, localDefaults, localIsDefault, localActiveCount,
  categoryTarget, dueStatusFor, collectedFilters, uncollectedExtras, exclusionsFilters, decisionsLocal, scopeIsDefault, narrowing
} from '../src/components/filters/pageFilters.js';
import { FILTER_PAGES, buildScopeDefs, scopeToValues } from '../src/components/filters/filterConfig.js';
import { DUE_POSITION_KEYS, STATUS_LABELS, cascadePatch, deriveChips, defaultValueText, isDefaultValue, defaultOf, activeKeys } from '../src/components/filters/filterLogic.js';
import { EXCLUSION_REASONS } from '../src/data/iim.js';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };
const TODAY = '2026-11-05';
const scope = (over = {}) => ({ preset: 'ytd', from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', product: [], mainClass: 'all', ...over });
const keysOf = (c) => [...c.primary, ...c.secondary];

/* ---- page configurations (the brief's table) ---- */
ok('Collected invoices: period · Amanah · municipality · revenue source primary; origin / classification secondary; issue-date basis stated', () => {
  const c = FILTER_PAGES.collected;
  assert.deepEqual(c.primary, ['period', 'amanah', 'municipality', 'source']); assert.ok(!c.secondary.includes('municipality')); assert.equal(c.dateBasis, 'issue');
  assert.ok(!keysOf(c).includes('status') && !keysOf(c).includes('duePosition'), 'the list has its own collection state: no invoice-status control');
});
ok('Uncollected: Amanah · municipality · revenue source · due position primary; period is secondary', () => {
  const c = FILTER_PAGES.uncollected;
  assert.deepEqual(c.primary, ['amanah', 'municipality', 'source', 'duePosition']); assert.ok(c.secondary.includes('period') && !c.secondary.includes('municipality'));
  assert.ok(!keysOf(c).includes('status'), 'one control per scope field: the due position replaces the status select');
});
ok('Exclusions: period · Amanah · municipality · reason (the page-own slot) primary; source / product secondary', () => {
  const c = FILTER_PAGES.exclusions;
  assert.deepEqual(c.primary, ['period', 'amanah', 'municipality', 'extra']); assert.ok(['source', 'product'].every((k) => c.secondary.includes(k)));
});
ok('Product page: no product / classification control (the product is the page); Decision Room: period · Amanah · category', () => {
  assert.ok(!keysOf(FILTER_PAGES.product).includes('product') && !keysOf(FILTER_PAGES.product).includes('mainClass') && !keysOf(FILTER_PAGES.product).includes('source'));
  assert.deepEqual(FILTER_PAGES.decisions.primary, ['period', 'amanah', 'municipality', 'extra']); assert.deepEqual(FILTER_PAGES.decisions.secondary, ['source']); assert.deepEqual(decisionsLocal().primary, ['category']); assert.deepEqual(decisionsLocal().secondary, ['priority', 'flag']);
});
ok('no page has more than 4 primary controls on desktop (the local primary replaces the «extra» slot)', () => {
  assert.ok(FILTER_PAGES.exclusions.primary.length + exclusionsLocal().primary.length - 1 <= 4);
  for (const k of ['collected', 'uncollected', 'exclusions', 'decisions', 'product']) assert.ok(FILTER_PAGES[k].primary.length <= 4, k);
});

/* ---- due position → engine ---- */
ok('the due position offers exactly the engine payment/due classes, never a process state', () => {
  const d = buildScopeDefs(['duePosition'], { today: TODAY })[0];
  assert.equal(d.scopeKey, 'status');
  assert.deepEqual(d.options.map((o) => o.value), ['all', ...DUE_POSITION_KEYS]); assert.deepEqual(DUE_POSITION_KEYS, ['open', 'overdue', 'not_due', 'partial']);
  for (const p of PROCESS_STATES) assert.ok(!DUE_POSITION_KEYS.includes(p), `${p} is a process state`);
  assert.ok(d.options.every((o) => o.value === 'all' || STATUS_LABELS[o.value]));
});
ok('the due position is the shared scope status (list, KPIs and analysis read the same field)', () => {
  assert.equal(scopeToValues(scope({ status: 'overdue' })).duePosition, 'overdue');
  assert.equal(scopeToValues(scope()).duePosition, 'all');
});
ok('legacy ?category= links: a due position goes to the scope status, a process state to its own field, anything else is not a filter', () => {
  assert.deepEqual(categoryTarget('overdue'), { status: 'overdue' }); assert.deepEqual(categoryTarget('not_due'), { status: 'not_due' }); assert.deepEqual(categoryTarget('partial'), { status: 'partial' });
  assert.deepEqual(categoryTarget('objection'), { processStatus: 'objection' }); assert.deepEqual(categoryTarget('linkage_unresolved'), { processStatus: 'linkage_unresolved' });
  assert.deepEqual(categoryTarget('excluded'), {}); assert.deepEqual(categoryTarget('all'), {}); assert.deepEqual(categoryTarget(null), {});
});
ok('a status this list cannot honour (collected, cancelled, excluded) falls back to «all»; due positions are kept', () => {
  assert.equal(dueStatusFor('collected'), 'all'); assert.equal(dueStatusFor('cancelled'), 'all'); assert.equal(dueStatusFor('excluded'), 'all'); assert.equal(dueStatusFor(undefined), 'all');
  for (const k of DUE_POSITION_KEYS) assert.equal(dueStatusFor(k), k);
});

/* ---- values → requests ---- */
ok('Collected invoices request: "paid" by default; partial / collected narrow it; kind is sent only while a product with that filter is selected', () => {
  assert.deepEqual(collectedFilters({}), { search: '', state: 'paid', kind: 'all', allPeriods: false, tag: undefined });
  assert.equal(collectedFilters({ collection: 'partial' }).state, 'partial'); assert.equal(collectedFilters({ collection: 'collected' }).state, 'collected');
  assert.equal(collectedFilters({ kind: 'occupancy', product: [] }).kind, 'all', 'a leftover invoice type is never sent when its control is not shown');
  assert.equal(collectedFilters({ kind: 'occupancy', product: ['tobacco'] }).kind, 'occupancy');
  assert.equal(collectedFilters({ problem: true }).tag, 'problem'); assert.equal(collectedFilters({ allPeriods: true }).allPeriods, true);
});
ok('Uncollected worklist request: excluded invoices included; process state → category; pay status and enforcement only when set', () => {
  assert.deepEqual(uncollectedExtras({}), { includeExcluded: true, reason: 'all', kind: 'all' });
  assert.deepEqual(uncollectedExtras({ processStatus: 'objection', payStatus: 'overdue', exec: 'inexec', reason: 'none' }), { includeExcluded: true, reason: 'none', kind: 'all', category: 'objection', payStatus: 'overdue', exec: 'inexec' });
  assert.equal(uncollectedExtras({ kind: 'differences', product: ['accommodation'] }).kind, 'differences'); assert.equal(uncollectedExtras({ kind: 'differences', product: ['foras'] }).kind, 'all');
});
ok('Exclusions request: every reason or one effective reason; the payment status is independent of the exclusion', () => {
  assert.deepEqual(exclusionsFilters({}), { search: '', state: 'all', primary: 'any', payStatus: 'all', kind: 'all' });
  assert.equal(exclusionsFilters({ reason: EXCLUSION_REASONS[0].ruleId }).primary, EXCLUSION_REASONS[0].ruleId); assert.equal(exclusionsFilters({ pay: 'partial' }).payStatus, 'partial');
});

/* ---- page-own fields: definitions, defaults, dependent selections ---- */
ok('the page-own definitions are valid select fields, default «all», with distinct keys', () => {
  for (const l of [collectedLocal({ product: ['tobacco'] }), uncollectedLocal({ product: ['tobacco'] }), exclusionsLocal()]) {
    const ks = l.defs.map((d) => d.key); assert.equal(new Set(ks).size, ks.length);
    for (const d of l.defs) { assert.equal(d.type, 'select'); assert.equal(defaultOf(d), 'all'); assert.ok(d.label.ar && d.label.en); }
    assert.deepEqual([...l.primary, ...l.secondary].sort(), ks.sort());
  }
});
ok('the invoice-type field exists only for tobacco / accommodation', () => {
  assert.equal(kindVisible([]), false); assert.equal(kindVisible(['foras']), false); assert.equal(kindVisible(['tobacco']), true);
  assert.ok(!collectedLocal({ product: ['foras'] }).defs.some((d) => d.key === 'kind')); assert.ok(collectedLocal({ product: ['accommodation'] }).defs.some((d) => d.key === 'kind'));
  assert.ok(uncollectedLocal({ product: ['tobacco'] }).defs.some((d) => d.key === 'kind') && !uncollectedLocal({ product: [] }).defs.some((d) => d.key === 'kind'));
});
ok('default detection per page: untouched = default; any selection is active; counts only non-defaults', () => {
  for (const l of [collectedLocal({ product: ['tobacco'] }), uncollectedLocal({ product: ['tobacco'] }), exclusionsLocal()]) {
    const base = localDefaults(l); assert.equal(localIsDefault(l, base), true); assert.equal(localActiveCount(l, base), 0);
    const first = l.defs[0]; const v = { ...base, [first.key]: (typeof first.options === 'function' ? first.options(base) : first.options).find((o) => o.value !== 'all').value };
    assert.equal(localIsDefault(l, v), false); assert.equal(localActiveCount(l, v), 1);
  }
});
ok('the exclusion reason: a primary control; zero-count reasons are disabled unless selected; one option per reason plus «all»', () => {
  const l = exclusionsLocal({ reasonCount: (id) => ` · ${id}`, reasonDisabled: (id) => id === EXCLUSION_REASONS[0].ruleId });
  assert.deepEqual(l.primary, ['reason']); assert.deepEqual(l.secondary, ['pay']);
  const r = l.defs[0]; assert.equal(r.options.length, EXCLUSION_REASONS.length + 1); assert.equal(r.options[1].disabled, true); assert.equal(r.options[2].disabled, false);
  assert.ok(r.options[1].label.en.includes(EXCLUSION_REASONS[0].ruleId), 'the count text is part of the label');
});
ok('payment status options are payment states only (never an exclusion), enforcement options are the data service values', () => {
  const d = uncollectedLocal({}).defs; const pay = d.find((x) => x.key === 'payStatus'); const ex = d.find((x) => x.key === 'exec');
  assert.deepEqual(pay.options.map((o) => o.value), ['all', ...PAY_STATUS_KEYS]); assert.ok(!pay.options.some((o) => o.value === 'excluded'));
  assert.deepEqual(ex.options.map((o) => o.value), ['all', ...EXEC_KEYS]);
});
ok('due position and exclusion reason / processing status never combine: choosing a position clears them visibly; they are not offered/enabled while a position is set', () => {
  const l = uncollectedLocal({}); const all = [...buildScopeDefs(['duePosition'], { today: TODAY }), ...l.defs];
  const base = { duePosition: 'all', reason: EXCLUSION_REASONS[0].ruleId, processStatus: 'all', payStatus: 'all', exec: 'all', kind: 'all' };
  const r = cascadePatch(all, base, { duePosition: 'overdue' });
  assert.deepEqual(r.cleared, ['reason']); assert.equal(r.values.reason, 'all');
  const reason = l.defs.find((d) => d.key === 'reason'); const proc = l.defs.find((d) => d.key === 'processStatus');
  assert.deepEqual(reason.options({ duePosition: 'overdue', processStatus: 'all' }).map((o) => o.value), ['all', 'none']);
  assert.deepEqual(reason.options({ duePosition: 'all', processStatus: 'objection' }).map((o) => o.value), ['all', 'none']);
  assert.equal(reason.options({ duePosition: 'all', processStatus: 'all' }).length, EXCLUSION_REASONS.length + 2);
  assert.equal(proc.disabled({ duePosition: 'overdue', reason: 'all' }), true); assert.equal(proc.disabled({ duePosition: 'all', reason: EXCLUSION_REASONS[0].ruleId }), true); assert.equal(proc.disabled({ duePosition: 'all', reason: 'none' }), false);
  const r2 = cascadePatch(all, { ...base, reason: 'all', processStatus: 'objection' }, { duePosition: 'not_due' }); assert.deepEqual(r2.cleared, ['processStatus']);
});
ok('chips: a secondary selection gets a readable chip, a default gets none, a primary control gets none on desktop (no duplicate of the reason control)', () => {
  const l = exclusionsLocal(); const defs = [...buildScopeDefs(['period', 'amanah', 'municipality'], { today: TODAY }), ...l.defs];
  const vals = { ...scopeToValues(scope()), reason: EXCLUSION_REASONS[0].ruleId, pay: 'partial' };
  const chips = deriveChips(defs, vals, { lang: 'en', exclude: ['period', 'amanah', ...l.primary], valueText: (d, v) => defaultValueText(d, v, 'en') });
  assert.deepEqual(chips.map((c) => c.key), ['pay']); assert.equal(chips[0].value, 'Partly paid');
  assert.deepEqual(deriveChips(defs, { ...scopeToValues(scope()), reason: 'all', pay: 'all' }, { lang: 'ar', exclude: [] }), [], 'no «All» chips at all');
  assert.ok(activeKeys(defs, vals, { today: TODAY }).includes('reason'), 'the reason still counts as an active filter (clear button, drawer count)');
});

/* ---- scope default + narrowing + Decision Room ---- */
ok('scopeIsDefault: year to date and everything «all»; any Amanah / source / municipality / status / product / class / origin / other period breaks it', () => {
  assert.equal(scopeIsDefault(scope(), TODAY), true);
  for (const o of [{ amanah: 'Riyadh Amanah' }, { source: 'fines' }, { muni: 'Riyadh Amanah|North' }, { status: 'overdue' }, { product: ['foras'] }, { mainClass: 'استثمار' }, { scopeType: 'central' }, { preset: 'month', from: '2026-11-01' }]) assert.equal(scopeIsDefault(scope(o), TODAY), false, JSON.stringify(o));
});
ok('narrowing = something differs from the default (scope, page-own field, search or an extra condition) — drives the no-results reset', () => {
  const l = exclusionsLocal(); const base = localDefaults(l);
  assert.equal(narrowing({ scopeActive: false, local: l, values: base }), false);
  assert.equal(narrowing({ scopeActive: true, local: l, values: base }), true);
  assert.equal(narrowing({ local: l, values: { ...base, pay: 'overdue' } }), true);
  assert.equal(narrowing({ local: l, values: base, search: ' ' }), false); assert.equal(narrowing({ local: l, values: base, search: 'INV' }), true);
  assert.equal(narrowing({ local: l, values: base, extra: 1 }), true);
});
ok('isDefaultValue/defaultOf agree for the due position (all) and the page-own selects', () => {
  const d = buildScopeDefs(['duePosition'], { today: TODAY })[0]; assert.equal(isDefaultValue(d, 'all'), true); assert.equal(isDefaultValue(d, 'overdue'), false);
});

console.log(`filters-pages: ${n} checks passed`);
