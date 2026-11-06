// Tests of the PURE logic of the redesigned Decision Room UI (src/components/decisions/decisionUi.js + the page filters in pageFilters.js): which items a view shows (category · priority · flag · chart mark),
// the chart-mark chip, the summary strip rules (the financial total is hidden when null), the follow-up buttons by flag state and permission, value formatting, and a source scan proving that no assignment /
// owner / due-date wording survives in the UI files. Items come from the real data layer over the synthetic compact demo data. Run with `npm run test:decisionui`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadStore as loadData } from '../server/store.js';
import { snapshot } from '../server/engine.js';
import { previousScope, compareSnapshots } from '../src/data/revenueMetrics.js';
import { buildDecisionItems, withState, summaryOf, CATEGORIES } from '../src/data/decisionRoom.js';
import { buildDecisionCharts } from '../src/data/decisionCharts.js';
import * as ds from '../src/data/decisionStore.js';
import { decisionsLocal, DECISION_PAGE_KEYS, DECISION_PAGE_DEFAULTS, localIsDefault, localActiveCount } from '../src/components/filters/pageFilters.js';
import { FILTER_PAGES, buildScopeDefs } from '../src/components/filters/filterConfig.js';
import { parseUrlFilters, serializeUrlFilters, deriveChips } from '../src/components/filters/filterLogic.js';
import * as U from '../src/components/decisions/decisionUi.js';

let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
process.env.DEMO_SIZE = 'compact';
const TODAY = '2026-10-20'; const data = loadData(TODAY); const cfg = { cutoff: TODAY };
const FULL = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
const snap = snapshot(data, { scope: FULL, cfg });
const pv = previousScope({ from: FULL.from, to: FULL.to }); const prevSnap = snapshot(data, { scope: { ...FULL, from: pv.from, to: pv.to, basis: pv.basis }, cfg });
const labels = { amanah: (k) => ({ ar: `أمانة ${k}`, en: k }), source: (k) => ({ ar: `مصدر ${k}`, en: k }) };
const inp = {
  today: TODAY, snapshot: snap, labels, previous: { snapshot: prevSnap, comparable: true }, plan: null,
  contracts: { count: 7, arrears: 1.5e9, overdueInstallments: 5, unlinkedInstallments: 4, unlinkedAmount: 9e5 },
  noContractCount: 14,
  orders: { suspendedCount: 10, suspendedAmount: 4e8, suspendedNums: ['EN-1'], proposedLinks: 3, proposedLinkOrders: 2, unresolvedRefs: 2, unresolvedRefOrders: 1, linkNums: ['EN-3'] },
  matching: { amountConflicts: snap.quality.amountConflictCount, conflictAmount: snap.quality.conflictAmountAtStake, conflictIds: snap.quality.amountConflicts, missingFields: snap.quality.missingFieldCount, missingIds: snap.quality.missingFieldRecords }
};
const R = buildDecisionItems(inp); const store0 = ds.emptyStore();
const CTX = { by: 'Reviewer', at: '2026-10-20T10:00:00Z' };
const flagged = (key) => ds.flag(store0, key, {}, CTX).store;
const itemsWith = (store) => withState(R.items, store);
const base = itemsWith(store0);
assert.ok(base.length >= 3, 'the synthetic data supports several items');

ok('no filter shows every item, in the data layer\'s ranked order', () => {
  assert.deepEqual(U.viewItems(base, DECISION_PAGE_DEFAULTS).map((i) => i.key), base.map((i) => i.key));
  assert.deepEqual(U.viewItems(base, {}).map((i) => i.key), base.map((i) => i.key));
});
ok('category and priority filter the list; the counts of the groups add up to the whole', () => {
  const cats = [...new Set(base.map((i) => i.category))]; let total = 0;
  for (const c of cats) { const v = U.viewItems(base, { category: c }); assert.ok(v.length > 0 && v.every((i) => i.category === c)); total += v.length; }
  assert.equal(total, base.length);
  total = 0; for (const p of ['high', 'medium', 'low']) { const v = U.viewItems(base, { priority: p }); assert.ok(v.every((i) => i.priority.level === p)); total += v.length; }
  assert.equal(total, base.length);
  const c0 = base[0].category; const p0 = base[0].priority.level;
  assert.ok(U.viewItems(base, { category: c0, priority: p0 }).every((i) => i.category === c0 && i.priority.level === p0), 'two filters combine with AND');
});
ok('the follow-up flag filter: none · flagged · followed_up follow the store, and they partition the list', () => {
  const k = base[0].key; const k2 = base[1].key;
  let s = flagged(k); s = ds.complete(ds.flag(s, k2, {}, CTX).store, k2, {}, CTX).store;
  const items = itemsWith(s);
  assert.deepEqual(U.viewItems(items, { flag: 'flagged' }).map((i) => i.key), [k]);
  assert.deepEqual(U.viewItems(items, { flag: 'followed_up' }).map((i) => i.key), [k2]);
  assert.equal(U.viewItems(items, { flag: 'none' }).length, items.length - 2);
});
ok('a chart mark filters the list; with a page filter that excludes it the list is EMPTY (no silent widening); marks of every chart apply', () => {
  const C = buildDecisionCharts(inp, 'ar'); assert.ok(C.overdueRank.amanah, 'the ranked overdue chart exists');
  const m = U.markFrom('rank-amanah', C.overdueRank.amanah, { i: 0 }); assert.ok(m && m.filter.amanah && m.label);
  const v = U.viewItems(base, {}, m); assert.ok(v.every((i) => i.affected.amanah === m.filter.amanah));
  assert.equal(U.markFrom('rank-amanah', C.overdueRank.amanah, { i: 999 }), null);
  const other = base.find((i) => i.category !== 'overdue_aging' && i.affected.amanah === m.filter.amanah);
  assert.equal(U.viewItems(base, { category: 'data_conflicts' }, m).length, 0, 'the entity has no data-conflict item: nothing is shown instead of widening');
  if (C.aging) { const a = U.markFrom('aging', C.aging, { i: 0 }); assert.deepEqual(a.filter, { category: 'overdue_aging' }); assert.ok(U.viewItems(base, {}, a).every((i) => i.category === 'overdue_aging')); }
  if (C.overdueRank.source) { const s = U.markFrom('rank-source', C.overdueRank.source, { i: 0 }); assert.ok(s.filter.source); assert.ok(U.viewItems(base, {}, s).every((i) => i.affected.source === s.filter.source)); }
  void other;
});
ok('choosing the selected mark again clears it; a different mark replaces it', () => {
  const a = { chart: 'aging', i: 1, label: 'x', filter: {} }; const b = { chart: 'aging', i: 2, label: 'y', filter: {} };
  assert.equal(U.toggleMark(a, { ...a }), null); assert.equal(U.toggleMark(a, b), b); assert.equal(U.toggleMark(null, a), a); assert.equal(U.toggleMark(a, null), null);
});
ok('chips: the chart-mark chip reads «من الرسم: …» and exists only when a mark is chosen; the page filters are the toolbar\'s own (derived chips for the More-panel fields)', () => {
  assert.equal(U.markChip(null), null);
  const c = U.markChip({ label: 'Riyadh' }, 'ar'); assert.deepEqual([c.label, c.value], ['من الرسم:', 'Riyadh']); assert.equal(U.markChip({ label: 'R' }, 'en').label, 'From the chart:');
  const L = decisionsLocal(); const chips = deriveChips(L.defs, { category: 'all', priority: 'high', flag: 'flagged' }, { lang: 'ar', exclude: L.primary });
  assert.deepEqual(chips.map((x) => x.key), ['priority', 'flag']); assert.equal(chips[0].value, 'أولوية مرتفعة'); assert.equal(chips[1].value, 'موسوم للمتابعة');
  assert.equal(U.viewIsNarrowed({}, null), false); assert.equal(U.viewIsNarrowed({ priority: 'high' }, null), true); assert.equal(U.viewIsNarrowed({}, { label: 'x' }), true); assert.equal(U.pageFilterCount({ category: 'a', priority: 'all', flag: 'x' }), 2);
});
ok('the toolbar configuration: period · Amanah · municipality · Category primary; More: revenue source, priority, follow-up flag; no owner / status / lane filter; the page keys live in the URL', () => {
  const cfgp = FILTER_PAGES.decisions; const L = decisionsLocal();
  assert.deepEqual([...cfgp.primary.filter((k) => k !== 'extra'), ...L.primary], ['period', 'amanah', 'municipality', 'category']);
  assert.deepEqual([...cfgp.secondary, ...L.secondary], ['source', 'priority', 'flag']);
  assert.deepEqual(L.defs.map((d) => d.key), DECISION_PAGE_KEYS);
  assert.deepEqual(L.defs.map((d) => d.key).filter((k) => /owner|status|lane|assign|due/i.test(k)), []);
  assert.deepEqual(L.defs[0].options.map((o) => o.value), ['all', ...Object.keys(CATEGORIES)]);
  assert.ok(localIsDefault(L, DECISION_PAGE_DEFAULTS)); assert.equal(localActiveCount(L, { ...DECISION_PAGE_DEFAULTS, flag: 'flagged' }), 1);
  const keys = [...DECISION_PAGE_KEYS, 'item']; const defaults = { ...DECISION_PAGE_DEFAULTS, item: '' };
  const url = serializeUrlFilters('?x=1', { ...defaults, priority: 'high', item: 'plan:ministry' }, keys, defaults);
  assert.equal(url, '?x=1&priority=high&item=plan%3Aministry'); assert.deepEqual(parseUrlFilters(url, keys, defaults), { ...defaults, priority: 'high', item: 'plan:ministry' });
  assert.equal(serializeUrlFilters(url, defaults, keys, defaults), '?x=1', 'defaults are removed, other params kept');
  assert.equal(buildScopeDefs(['source'], { today: TODAY }).length, 1);
});
ok('summary strip: three counts follow the FILTERED list; the financial total appears only when summary.financialTotal is non-null (label, basis, share of the scope total)', () => {
  const full = summaryOf(base, R.context); const S = U.stripOf(full);
  assert.deepEqual(S.tiles.map((t) => t.key), ['openFinancial', 'flagged', 'verify']);
  assert.deepEqual(S.tiles.map((t) => t.count), [full.openFinancialIssues, full.flagged, full.needsVerification]);
  const sub = U.viewItems(base, { category: 'data_conflicts' }); const Ssub = U.stripOf(summaryOf(sub, R.context));
  assert.equal(Ssub.tiles[2].count, sub.filter((i) => i.verification === 'needs_verification' && i.condition.open).length, 'the strip counts reconcile with the list it sits above');
  if (full.financialTotal) {
    assert.equal(S.total.amount, full.financialTotal.amount); assert.ok(S.total.label.ar && S.total.basis.en);
    assert.ok(S.total.share == null || (S.total.share > 0 && S.total.share <= 1.0000001), 'share of the scope total');
  }
  const noTotal = U.stripOf({ ...full, financialTotal: null, financialTotalReason: { ar: 'x', en: 'y' } });
  assert.equal(noTotal.total, null, 'nothing is shown for the total when the data layer returns null'); assert.ok(!JSON.stringify(noTotal).includes('"x"'), 'not even the reason is surfaced as a number');
  const fake = U.stripOf({ ...full, financialTotal: { amount: 300, label: { ar: 'a', en: 'a' }, basis: { ar: 'b', en: 'b' }, itemKeys: [], scopeTotal: 1200 } });
  assert.equal(fake.total.share, 0.25); assert.equal(U.stripOf({ ...full, financialTotal: { amount: 1, label: { ar: 'a', en: 'a' }, basis: { ar: 'b', en: 'b' }, itemKeys: [], scopeTotal: null } }).total.share, null);
  assert.equal(U.stripOf(null), null);
  const none = U.stripOf(summaryOf([], R.context)); assert.deepEqual(none.tiles.map((t) => t.count), [0, 0, 0]); assert.equal(none.total, null);
});
ok('follow-up controls by flag state × permission: flag from none/followed_up · complete only from flagged · remove from flagged/followed_up; no permission → disabled WITH the reason', () => {
  const c = (f, p) => U.followControls(f, p);
  assert.deepEqual([c('none', true).flag.visible, c('none', true).complete.visible, c('none', true).unflag.visible], [true, false, false]);
  assert.deepEqual([c('flagged', true).flag.visible, c('flagged', true).complete.visible, c('flagged', true).unflag.visible], [false, true, true]);
  assert.deepEqual([c('followed_up', true).flag.visible, c('followed_up', true).complete.visible, c('followed_up', true).unflag.visible], [true, false, true]);
  for (const f of ['none', 'flagged', 'followed_up']) {
    const ok1 = c(f, true); for (const k of ['flag', 'complete', 'unflag']) if (ok1[k].visible) { assert.equal(ok1[k].enabled, true); assert.equal(ok1[k].reason, null); }
    const ro = c(f, false); for (const k of ['flag', 'complete', 'unflag']) if (ro[k].visible) { assert.equal(ro[k].enabled, false); assert.ok(ro[k].reason.ar && ro[k].reason.en); }
    assert.equal(ro.note.enabled, false); assert.equal(ok1.note.enabled, true);
  }
  assert.deepEqual(Object.values(U.FLAG_BUTTONS).map((b) => b.ar), ['وضع علامة للمتابعة', 'تمت المتابعة', 'إزالة علامة المتابعة']);
  // every state the controls offer is accepted by the store (the UI never offers a refused change)
  let s = store0; const k = base[0].key;
  assert.ok(ds.flag(s, k, {}, CTX).store); s = ds.flag(s, k, {}, CTX).store; assert.ok(ds.complete(s, k, {}, CTX).store); s = ds.complete(s, k, {}, CTX).store;
  assert.ok(ds.flag(s, k, {}, CTX).store && ds.unflag(s, k, {}, CTX).store);
  assert.match(U.FOLLOW_STATEMENT.ar, /تمت المتابعة تعني أنه رُوجع أو تمت متابعته؛ لا تعني أن المشكلة المالية حُلّت أو أن الفاتورة سُدّدت أو أن التوصية اعتُمدت/);
  assert.match(U.FOLLOW_STATEMENT.en, /does not mean the financial issue is resolved, the invoice paid or the recommendation approved/);
});
ok('a followed-up item stays financially open: the flag never changes the condition, and the strip still counts it as open', () => {
  const k = base.find((i) => i.condition.open && ['exposure', 'gap', 'overdue', 'amount'].includes(i.measure.kind)).key;
  const s = ds.complete(flagged(k), k, {}, CTX).store; const items = itemsWith(s); const it = items.find((x) => x.key === k);
  assert.equal(it.followUp.flag, 'followed_up'); assert.equal(it.condition.open, true);
  assert.equal(summaryOf(items, R.context).openFinancialIssues, summaryOf(base, R.context).openFinancialIssues);
  assert.equal(U.CONDITION_LABELS.open.ar, 'مفتوحة ماليًا');
});
ok('formatting: units, the labelled row amount, migrated history text', () => {
  assert.equal(U.formatValue(0.1234, 'pct'), '12.3%'); assert.equal(U.formatValue(null, 'pct', 'en'), 'n/a'); assert.equal(U.formatValue(NaN, 'SAR'), 'غير متاح');
  assert.equal(U.formatValue(-4.25, 'pp', 'en'), '−4.3 pp'); assert.equal(U.formatValue(181, 'days', 'en'), '181 days'); assert.equal(U.formatValue(12345, 'count'), '12,345');
  const it = base.find((i) => i.measure.amount != null); const t = U.measureText(it, 'ar'); assert.ok(t.startsWith(it.measure.label.ar) && t.length > it.measure.label.ar.length);
  const cnt = base.find((i) => i.measure.count != null); if (cnt) assert.ok(/\d/.test(U.measureText(cnt, 'en')));
  assert.equal(U.historyText({ note: 'n', i18n: { ar: 'عربي', en: 'English' } }, 'ar'), 'عربي'); assert.equal(U.historyText({ note: 'n', i18n: { ar: 'عربي', en: 'English' } }, 'en'), 'English'); assert.equal(U.historyText({ note: 'plain' }, 'ar'), 'plain'); assert.equal(U.historyText({}, 'ar'), '');
  assert.equal(U.itemLink('plan:ministry'), '/decisions?item=plan%3Aministry');
});
ok('dashboard preview helper (previewItems; the dashboard now reads the same items through buildReviewPriorities): the highest-priority OPEN findings, in the same order as the room', () => {
  const p = U.previewItems(base, 4); assert.ok(p.length > 0 && p.length <= 4); assert.deepEqual(p.map((i) => i.key), base.filter((i) => i.condition.open !== false).slice(0, p.length).map((i) => i.key));
  const order = { high: 0, medium: 1, low: 2 }; for (let i = 1; i < p.length; i += 1) assert.ok(order[p[i - 1].priority.level] <= order[p[i].priority.level], 'ranked High → Medium → Low');
  assert.deepEqual(U.previewItems([], 3), []);
});
ok('no assignment / owner / due-date / score wording in the UI source files', () => {
  const files = ['src/pages/DecisionRoom.jsx', 'src/components/decisions/DecisionParts.jsx', 'src/components/decisions/DecisionBadges.jsx', 'src/components/decisions/DecisionDetail.jsx', 'src/components/decisions/DecisionCharts.jsx', 'src/components/decisions/DecisionStrip.jsx', 'src/components/decisions/decisionUi.js'];
  const bad = /بلا مسؤول|غير مُسند|إسناد|المسؤول|الاستحقاق المقترح|متأخرة عن موعدها|assign|owner|due date|past their due|overdueActions|ROLES|STATUSES|LANES|\.score|scoreTone|0\.4 ×/i;
  for (const f of files) { const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'); const m = bad.exec(src); assert.equal(m, null, `${f}: ${m && m[0]}`); }
});
console.log(`decision-room-ui tests: ${n} passed`);
