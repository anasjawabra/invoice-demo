// Pure UI logic of the redesigned Collected / Uncollected lists (src/components/invoices/listLogic.js + their filter mapping in pageFilters.js).
// Run with `npm run test:invoicelists`. Synthetic values only.
import assert from 'node:assert/strict';
import {
  TOP_N, PAGE_SIZES, sharePct, shareText, facetLabel, rankItems, rankedBlock, barTip, toggleKey, selectionFilters, selectionCount, collectedKpis, periodContext,
  uncollectedKpis, dueSegments, priorityAria, priorityText, exportLabel, COLLECTED_WORDS, UNCOLLECTED_WORDS, DUE_LABEL
} from '../src/components/invoices/listLogic.js';
import { collectedListFilters, uncollectedListFilters } from '../src/components/filters/pageFilters.js';
import { chartRender } from '../src/utils/chartDraw.js';
import { rateParts, ratePct } from '../src/components/invoices/rateCardLogic.js';
import nodeFs from 'node:fs';
import { loadStore } from '../server/store.js';
import { snapshot as engineSnapshot } from '../server/engine.js';
import { list as serviceList } from '../server/lists.js';

let n = 0; const ok = (name, fn) => { try { fn(); n += 1; } catch (e) { console.error(`FAIL: ${name}`); throw e; } };
// facets.source: the REVENUE SOURCES (never products)
const items = [
  { key: 'fines', count: 64, collected: 300 }, { key: 'municipal_fees', count: 43, collected: 160 }, { key: 'accommodation', count: 54, collected: 140 }, { key: 'licenses', count: 30, collected: 80 },
  { key: 'white_lands', count: 9, collected: 70 }, { key: 'investment', count: 24, collected: 60 }, { key: 'tobacco', count: 34, collected: 30 }, { key: 'housing_sales', count: 5, collected: 10 }, { key: 'zero', count: 2, collected: 0 }
];

/* ---- ranking: top five + view all ---- */
ok('top five by amount; the rest are counted for «view all»; a zero amount is not ranked', () => {
  const r = rankItems(items, 'collected');
  assert.equal(r.rows.length, TOP_N); assert.deepEqual(r.rows.map((x) => x.key), ['fines', 'municipal_fees', 'accommodation', 'licenses', 'white_lands']);
  assert.equal(r.all.length, 8, 'the zero-amount item is not a bar'); assert.equal(r.hiddenCount, 3);
});
ok('view all shows every ranked item; the total is the sum of the whole facet, not of the visible five', () => {
  const r = rankItems(items, 'collected', { expanded: true });
  assert.equal(r.rows.length, 8); assert.equal(r.hiddenCount, 0); assert.equal(r.total, 850);
  assert.equal(rankItems(items, 'collected').total, 850);
});
ok('a selected item that ranks below the top five stays visible (it replaces the last row)', () => {
  const r = rankItems(items, 'collected', { selectedKey: 'tobacco' });
  assert.equal(r.rows.length, TOP_N); assert.ok(r.rows.some((x) => x.key === 'tobacco')); assert.equal(r.hiddenCount, 3);
});
ok('fewer than five items: all shown, no «view all»', () => { const r = rankItems(items.slice(0, 3), 'collected'); assert.equal(r.rows.length, 3); assert.equal(r.hiddenCount, 0); });
ok('a missing facet is «unavailable», an all-zero facet is empty — never the same thing', () => {
  assert.equal(rankItems(undefined, 'collected').available, false); assert.equal(rankItems(null, 'collected').available, false);
  const z = rankItems([{ key: 'a', count: 3, collected: 0 }], 'collected'); assert.equal(z.available, true); assert.equal(z.rows.length, 0);
  assert.equal(rankedBlock({ dim: 'source', items: [{ key: 'a', count: 3, collected: 0 }], measure: 'collected', title: 't', ar: true }).block, null);
});
ok('ranking is stable for equal amounts (by key) and ignores the input order', () => {
  const a = rankItems([{ key: 'b', collected: 5 }, { key: 'a', collected: 5 }, { key: 'c', collected: 9 }], 'collected').rows.map((x) => x.key);
  assert.deepEqual(a, ['c', 'a', 'b']);
});

/* ---- share % ---- */
ok('share of the total with one decimal; null (shown «—») when the total is zero', () => {
  assert.equal(sharePct(300, 850), 35.3); assert.equal(shareText(160, 850), '18.8%'); assert.equal(sharePct(0, 850), 0);
  assert.equal(sharePct(5, 0), null); assert.equal(shareText(5, 0), '—');
  const total = items.reduce((t, x) => t + x.collected, 0); const sum = items.reduce((t, x) => t + sharePct(x.collected, total), 0);
  assert.ok(Math.abs(sum - 100) < 0.5, 'shares add up to 100 within rounding');
});
ok('hover text carries the share and the invoice count (Arabic and English)', () => {
  assert.equal(barTip(items[0], 'collected', 850, false), '35.3% of the total · 64 invoices');
  assert.equal(barTip(items[0], 'collected', 850, true), '35.3% من الإجمالي · 64 فاتورة');
  assert.ok(barTip({ key: 'a', count: 61, outstanding: 5 }, 'outstanding', 10, false).includes('61 invoices in the list (excluded included)'), 'unpaid bars say the count includes the excluded invoices');
});

/* ---- the chart block (shared report-chart contract) ---- */
ok('the ranked block is an hbar with labels, keys, per-bar tips and the role colour; the bars sum to the facet', () => {
  const r = rankedBlock({ dim: 'source', items, measure: 'collected', role: 'collected', title: 'Collected by revenue source', valueTitle: 'Collected', ar: false, expanded: true });
  const b = r.block; assert.equal(b.kind, 'hbar'); assert.equal(b.labels.length, 8); assert.equal(b.keys.length, 8); assert.equal(b.tips.length, 8);
  assert.equal(b.series[0].role, 'collected'); assert.equal(b.series[0].values.reduce((t, v) => t + v, 0), r.total);
  assert.equal(b.labels[0], 'Fines & penalties'); assert.equal(rankedBlock({ dim: 'source', items, measure: 'collected', title: 't', ar: true }).block.labels[0], 'الغرامات والجزاءات'); assert.ok(!b.labels.some((l) => /Baladi|Mumtathil|Furas/.test(l)), 'no product names in a revenue-source chart');
});
ok('selected bar index follows the key; no selection → -1', () => {
  assert.equal(rankedBlock({ dim: 'source', items, measure: 'collected', title: 't', ar: true, selectedKey: 'municipal_fees' }).selectedIndex, 1);
  assert.equal(rankedBlock({ dim: 'source', items, measure: 'collected', title: 't', ar: true }).selectedIndex, -1);
});
ok('the shared drawing renders the tips in the bar tooltips and a bar is a selectable mark carrying its key', () => {
  const b = rankedBlock({ dim: 'source', items, measure: 'collected', role: 'collected', title: 'T', valueTitle: 'Collected', ar: false }).block;
  const svg = chartRender(b, { lang: 'en', w: 640, interactive: true }).svg;
  assert.ok(svg.includes('35.3% of the total · 64 invoices'), 'tooltip carries share and count'); assert.ok(svg.includes('data-key="fines"')); assert.ok(svg.includes('role="button"'));
  assert.ok(svg.includes('#1B8354'), 'collection green');
  const amber = chartRender({ ...b, series: [{ ...b.series[0], role: 'uncollected' }] }, { lang: 'en', w: 640 }).svg; assert.ok(amber.includes('#E58A00'), 'unpaid is amber');
});
ok('origin and revenue-source labels come from the facet or the catalogue, never a raw key', () => {
  assert.equal(facetLabel('origin', { key: 'central' }, true), 'مركزي'); assert.equal(facetLabel('origin', { key: 'internal' }, false), 'Internal');
  assert.equal(facetLabel('source', { key: 'fines' }, false), 'Fines & penalties'); assert.equal(facetLabel('source', { key: 'x', labelAr: 'س', labelEn: 'X' }, true), 'س');
});

/* ---- selection → filter ---- */
ok('a click selects; the same click again clears; another click replaces', () => {
  assert.equal(toggleKey(null, 'baladi'), 'baladi'); assert.equal(toggleKey('baladi', 'baladi'), null); assert.equal(toggleKey('baladi', 'foras'), 'foras'); assert.equal(toggleKey('baladi', null), null);
});
ok('only the due-position bar adds a page filter; the revenue-source selection is the shared scope source (no second copy)', () => {
  assert.deepEqual(selectionFilters({}), {}); assert.deepEqual(selectionFilters({ dueState: 'overdue' }), { dueState: 'overdue' });
  assert.deepEqual(selectionFilters({ product: 'baladi', origin: 'central' }), {}, 'no product / origin breakdown exists on these pages'); assert.equal(selectionCount({ dueState: 'overdue' }), 1);
});
ok('collected request: state paid; the collection-state filter replaces the state; no product / origin filter', () => {
  const f = collectedListFilters({ search: 'x' }); assert.equal(f.state, 'paid'); assert.equal(f.search, 'x'); assert.ok(!('product' in f) && !('origin' in f));
  assert.equal(collectedListFilters({ collection: 'partial' }).state, 'partial');
});
ok('uncollected request: state «uncollected» (excluded included), the due selection, reason / process / payment / enforcement mapped, defaults add nothing', () => {
  const base = uncollectedListFilters({}); assert.equal(base.state, 'uncollected'); assert.ok(!('reason' in base) && !('category' in base) && !('payStatus' in base) && !('exec' in base) && !('dueState' in base));
  const f = uncollectedListFilters({ sel: { dueState: 'not_due' }, reason: 'none', processStatus: 'objection', payStatus: 'partial', exec: 'inexec' });
  assert.equal(f.dueState, 'not_due'); assert.equal(f.reason, 'none'); assert.equal(f.category, 'objection'); assert.equal(f.payStatus, 'partial'); assert.equal(f.exec, 'inexec'); assert.equal(f.state, 'uncollected');
});

/* ---- KPI strip against the population each figure counts ---- */
ok('collected KPIs: count and amount of the register; fully + partly paid add up to the count', () => {
  const main = { total: 263, sums: { collected: 8.69e9 }, population: { fullyPaid: 252, partlyPaid: 11 } };
  const k = collectedKpis(main); assert.deepEqual(k, { count: 263, amount: 8.69e9, fully: 252, partly: 11, closes: true });
  assert.equal(collectedKpis({ total: 10, sums: { collected: 1 }, population: { fullyPaid: 5, partlyPaid: 4 } }).closes, false, 'a strip that does not add up is flagged');
  assert.deepEqual(collectedKpis(null), { count: 0, amount: 0, fully: 0, partly: 0, closes: true });
});
ok('the period context keeps its own denominators: ALL invoices of the period, rate = collected ÷ net billed', () => {
  const c = periodContext({ count: 419, collected: 8.72e9, net: 12.61e9 }); assert.equal(c.invoices, 419); assert.ok(Math.abs(c.rate - 8.72 / 12.61) < 1e-9);
  assert.equal(periodContext({ count: 0, collected: 0, net: 0 }).rate, null, 'nothing billed: no rate, not 0%');
  assert.notEqual(c.invoices, collectedKpis({ total: 263, sums: {}, population: {} }).count, 'the context population is a different population from the register');
});
ok('uncollected KPIs: total unpaid = excluded unpaid + net unpaid; open + excluded = the list', () => {
  const main = { total: 146, sums: { outstanding: 3.89e9, exclusionAmount: 2.69e9 }, population: { excluded: 54 } };
  const k = uncollectedKpis(main); assert.equal(k.count, 146); assert.equal(k.excludedCount, 54); assert.equal(k.openCount, 92);
  assert.equal(k.totalUnpaid, k.netUnpaid + k.excludedUnpaid); assert.equal(k.netUnpaid, 3.89e9); assert.equal(k.excludedUnpaid, 2.69e9); assert.equal(k.closes, true);
});
ok('due-position segments: three states, net total equals the sum, excluded counted apart, shares add up', () => {
  const d = dueSegments({ overdue: { count: 73, amount: 3.31e9, excludedCount: 52, excludedAmount: 2.6e9 }, notYetDue: { count: 19, amount: 0.58e9, excludedCount: 2, excludedAmount: 7e7 }, unknown: { count: 0, amount: 0, excludedCount: 0, excludedAmount: 0 } });
  assert.deepEqual(d.segments.map((s) => s.key), ['overdue', 'not_due', 'unknown']); assert.equal(d.count, 92); assert.ok(Math.abs(d.total - 3.89e9) < 1);
  assert.equal(d.segments[0].excludedCount, 52); assert.ok(Math.abs(d.segments.reduce((t, s) => t + s.share, 0) - 100) < 0.2); assert.equal(d.segments[2].share, 0);
  assert.equal(dueSegments(undefined).available, false);
});

/* ---- wording ---- */
ok('priority is High / Medium / Low with the rule in the accessible name — never a number', () => {
  const p = { level: 'high', why: { ar: 'متأخرة أكثر من 180 يوماً', en: 'Overdue more than 180 days' } };
  assert.equal(priorityText('high', false), 'High'); assert.equal(priorityText('medium', true), 'متوسطة'); assert.equal(priorityText('low', true), 'منخفضة');
  assert.equal(priorityAria(p, false), 'High priority: Overdue more than 180 days'); assert.ok(priorityAria(p, true).startsWith('الأولوية عالية'));
  assert.ok(!/\d\.\d/.test(priorityAria({ level: 'low', why: { en: 'x' } }, false)));
  assert.equal(priorityAria(null, false), 'Priority not available');
});
ok('export label says ALL filtered results with the count (not the page)', () => {
  assert.equal(exportLabel(146, true), 'تصدير كل النتائج المصفّاة (146)'); assert.equal(exportLabel(146, false), 'Export all filtered results (146)');
});
ok('population wording: register includes partly paid; «collected» is on these invoices; period = issue date, no receipts implied; no «collectible»', () => {
  assert.ok(/جزئي/.test(COLLECTED_WORDS.registerNote.ar) && /partly/i.test(COLLECTED_WORDS.registerNote.en) && /these same invoices/.test(COLLECTED_WORDS.registerNote.en));
  assert.ok(/ISSUE/.test(COLLECTED_WORDS.periodBasis.en) && /payment-date/.test(COLLECTED_WORDS.periodBasis.en) && /تاريخ إصدار/.test(COLLECTED_WORDS.periodBasis.ar));
  const all = JSON.stringify([UNCOLLECTED_WORDS, COLLECTED_WORDS]); assert.ok(!/collectible|القابل للتحصيل/i.test(all));
  assert.ok(/excluded/i.test(UNCOLLECTED_WORDS.total.en) && /exclusions/i.test(UNCOLLECTED_WORDS.net.en)); assert.equal(DUE_LABEL.unknown.en, 'Due date unavailable');
  assert.deepEqual(PAGE_SIZES, [25, 50]);
});

/* ---- «نسبة التحصيل ضمن النطاق» card (docs: Invoices page) ---- */
ok('rate card: Collected ÷ Net invoiced × 100 over the whole scope; remaining = net − collected; the bar is drawn from the same two numbers', () => {
  const p = rateParts({ net: 400, collected: 300, count: 12 });
  assert.equal(p.state, 'ok'); assert.equal(p.rate, 0.75); assert.equal(p.remaining, 100); assert.equal(p.gotPct, 75); assert.equal(p.invoices, 12); assert.equal(ratePct(p.rate), '75.0%');
  assert.equal(ratePct(0.7082), '70.8%');
});
ok('rate card: zero is NOT unavailable — 0 % with a denominator is 0.0 %, no denominator is «—» with state na (never shown as 0 %)', () => {
  const z = rateParts({ net: 50, collected: 0, count: 3 }); assert.equal(z.state, 'ok'); assert.equal(ratePct(z.rate), '0.0%'); assert.equal(z.gotPct, 0);
  for (const t of [{ net: 0, collected: 0, count: 4 }, null, undefined, {}]) { const n0 = rateParts(t); assert.equal(n0.state, 'na'); assert.equal(n0.rate, null); assert.equal(ratePct(n0.rate), '—'); }
  assert.equal(rateParts({ net: 100, collected: 140, count: 1 }).gotPct, 100, 'the bar is clamped for drawing only (the approved identity keeps collected ≤ net)');
});
{
  process.env.DEMO_SIZE = 'compact'; const TODAY = '2026-11-05'; const st = loadStore(TODAY); const cfg = { cutoff: TODAY };
  const SC = { from: '2026-01-01', to: TODAY, amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all', product: [], mainClass: 'all' };
  const totalsOf = (scope) => engineSnapshot(st, { scope, cfg }).totals;
  const lst = (scope, filters, extra = {}) => serviceList(st, { scope, cfg, filters, page: 0, pageSize: 1, ...extra });
  ok('selected source: the card\'s numerator AND denominator both follow the source; the sources add up to the national figures; the source SHARE of collected is a different number from the source RATE', () => {
    const nat = totalsOf(SC); const srcs = lst(SC, {}, { facets: ['source'] }).facets.source; // every invoice of the scope (a source with no paid invoice still has a rate)
    let sumNet = 0; let sumCol = 0; let sumCount = 0;
    for (const f of srcs) {
      const t = totalsOf({ ...SC, source: f.key }); const p = rateParts(t); assert.equal(p.state, 'ok', f.key);
      assert.ok(Math.abs(t.net - (t.gross - t.exclusions)) <= 1, `${f.key}: net = gross − exclusions`); assert.ok(Math.abs(p.remaining - (t.net - t.collected)) <= 1, `${f.key}: remaining = net − collected`);
      assert.ok(Math.abs(t.collected - f.collected) <= 1, `${f.key}: the card's collected for the source equals the source's collected over the scope`);
      sumNet += t.net; sumCol += t.collected; sumCount += t.count;
      const share = f.collected / nat.collected; assert.ok(Math.abs(share - t.collected / nat.collected) < 1e-9 && (t.net > 0 ? Math.abs(p.rate - t.collected / t.net) < 1e-12 : false), `${f.key}: the SHARE of collected (÷ all collected) and the RATE (÷ the source's own net) have different denominators`);
    }
    assert.ok(Math.abs(sumNet - nat.net) <= 2 && Math.abs(sumCol - nat.collected) <= 2 && sumCount === nat.count, 'every source figure adds up to the national scope (no invoice counted twice)');
    assert.equal(lst(SC, {}).total, nat.count, 'the invoice count of the card is every invoice in scope (excluded and cancelled included) — the same as the unfiltered list');
  });
  ok('geographic scope: the card follows Amanah (and municipality) exactly like the list', () => {
    const t = totalsOf({ ...SC, amanah: 'Jeddah Amanah' }); assert.equal(lst({ ...SC, amanah: 'Jeddah Amanah' }, {}).total, t.count); assert.ok(t.net < totalsOf(SC).net);
  });
}
ok('page source: the old panel is gone; the new card carries the approved heading, the one-line population note, the info tooltip and no dashed box', () => {
  const page = nodeFs.readFileSync('src/pages/Invoices.jsx', 'utf8'); const card = nodeFs.readFileSync('src/components/invoices/CollectionRateCard.jsx', 'utf8'); const css = nodeFs.readFileSync('src/styles/revenue.css', 'utf8');
  assert.ok(!/سياق الفترة|Period context|PopulationNote/.test(page), 'the oversized «period context» panel is removed from the collected page');
  assert.ok(/<CollectionRateCard/.test(page));
  for (const t of ['نسبة التحصيل ضمن النطاق', 'Collection rate within scope', 'النسبة لجميع فواتير النطاق المحدد، بينما يعرض السجل الفواتير المحصّلة كلياً أو جزئياً.', 'The rate covers all invoices in the selected scope. The register shows fully or partially paid invoices.', 'Collected ÷ Net invoiced × 100']) assert.ok(card.includes(t), t);
  const tip = nodeFs.readFileSync('src/components/invoices/InfoTip.jsx', 'utf8'); assert.ok(/InfoTip/.test(card) && /role="tooltip"/.test(tip) && /aria-expanded/.test(tip) && /Escape/.test(tip), 'the formula lives in a keyboard-accessible information tooltip');
  assert.ok(/\.il-viz--rate[^}]*align-items:\s*start/.test(css) && !/\.il-rate\s*\{[^}]*dashed/.test(css), 'the card is not stretched to the chart height and has no dashed border');
  assert.ok(/shareLabel/.test(page), 'the selected-source share chip says what it is a share OF (separate from the rate)');
});
console.log(`invoice-lists-ui: ${n} tests passed`);
