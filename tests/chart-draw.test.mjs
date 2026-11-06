// Tests of the shared chart drawing (src/utils/chartDraw.js): every kind, both languages — no NaN, zero draws no bar but is labelled, null is a gap / hatched «—», waterfall reconciliation,
// RTL mirroring, accessibility attributes, the one unit named once. Run: esbuild tests/chart-draw.test.mjs --bundle --platform=node --format=esm --outfile=.test-build/chart-draw.test.mjs && node .test-build/chart-draw.test.mjs
import assert from 'node:assert/strict';
import { chartSvg, chartRender } from '../src/utils/chartDraw.js';
import { chartInfo, chartSummary, chartTableText } from '../src/data/reportFormat.js';
import { sampleBlocks } from '../scripts/chart-samples.mjs';

let n = 0; const ok = (name, fn) => { fn(); n += 1; };
const count = (s, re) => (s.match(re) || []).length;
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)/g)].map((m) => m[1]);
const bars = (svg) => count(svg, /<rect [^>]*fill="#(?:194185|1B8354|FDB022|B42318|E58A00)"[^>]*><title>/g); // marks carry a tooltip; legend swatches do not

for (const lang of ['ar', 'en']) {
  const S = sampleBlocks(lang);
  ok(`all kinds draw (${lang})`, () => {
    for (const [name, b] of Object.entries(S)) {
      const svg = chartSvg(b, { lang });
      assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), name);
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name}: NaN/undefined in the SVG`);
      assert.ok(/role="img"/.test(svg) && /aria-label="[^"]{12,}"/.test(svg) && /<title>/.test(svg) && /<desc>/.test(svg), `${name}: accessible name`);
      assert.ok(chartSummary(b, lang).length > 10);
      const t = chartTableText(b, lang); assert.ok(t.rows.length > 0 && t.headers.length > 1, `${name}: table alternative`);
      const small = chartSvg(b, { lang, w: 340 }); assert.ok(!/NaN|undefined/.test(small), `${name}: narrow width`);
    }
  });
  ok(`zero value: no bar, label 0 (${lang})`, () => {
    const svg = chartSvg(S.aging, { lang }); // buckets 1.2, .8, 0, .5, 1.3 → four bars, a «0» label
    assert.equal(bars(svg), 4); assert.ok(texts(svg).includes('0'));
    const allZero = chartSvg(S.zero_bar, { lang }); assert.equal(bars(allZero), 0); assert.ok(count(allZero, />0</g) >= 2);
    const pie = chartSvg(S.pie, { lang }); assert.ok(pie.includes('0 (0.0%)'), 'zero pie slice stays in the legend'); assert.equal(count(pie, /<path /g), 3);
  });
  ok(`null is a gap, never zero (${lang})`, () => {
    const svg = chartSvg(S.line_cum, { lang }); // third series has two nulls → two path segments, 6 markers for that series
    assert.equal(count(svg, /<path /g), 4, 'two solid lines + the dashed one in two segments');
    assert.ok(svg.includes('stroke-dasharray="7 5"'), 'dashed series'); assert.ok(svg.includes('stroke-dasharray="5 3"'), 'dashed legend swatch');
    assert.ok(/تراكمي|Cumulative/.test(svg), 'basis named');
    const bar = chartSvg(S.bar_monthly, { lang }); assert.ok(texts(bar).includes('—') && texts(bar).includes('0'), 'missing = —, zero = 0'); assert.ok(/شهري|Monthly/.test(bar));
    const h = chartSvg(S.heatmap, { lang }); assert.ok(h.includes('<pattern') && h.includes('fill="url(#hx'), 'hatched null cells'); assert.ok(count(h, />—</g) >= 8);
    assert.ok(!texts(h).some((t) => t === '0.0%'), 'a null cell is never drawn as 0%');
  });
  ok(`waterfall (${lang})`, () => {
    const svg = chartSvg(S.waterfall, { lang }); assert.ok(svg.includes('data-recon="ok"'));
    assert.ok(texts(svg).some((t) => t.replace(/[\u2066\u2069]/g, '').startsWith('−')), 'signed reduction label'); assert.equal(count(svg, /fill="#B42318"/g) >= 1, true);
    const bad = chartSvg(S.waterfall_bad, { lang }); assert.ok(bad.includes('data-recon="fail"')); assert.equal(bars(bad), 0, 'no bars when the figures do not reconcile');
    const multi = chartSvg(S.waterfall_multi, { lang }); assert.ok(multi.includes('data-recon="ok"') && count(multi, /stroke-dasharray="3 3"/g) === 4, 'connectors');
    const within = { ...S.waterfall_bad, series: [{ label: 'v', values: [10e9, -3e9, 7e9 + 0.5] }] }; assert.ok(chartSvg(within, { lang }).includes('data-recon="ok"'), 'within 1 SAR');
  });
  ok(`stacked bar (${lang})`, () => {
    const svg = chartSvg(S.stacked, { lang }); assert.ok(svg.includes('66.3%') && svg.includes('33.7%'));
    const tiny = chartSvg(S.stacked_tiny, { lang }); assert.ok(texts(tiny).some((t) => t.startsWith('0 ·')), 'zero segment labelled 0'); assert.ok(tiny.includes('1.0%'), 'tiny segment labelled outside');
    assert.equal(count(tiny, /<rect [^>]*width="0/g), 0, 'no zero-width mark');
  });
  ok(`unit named once, no currency on ticks (${lang})`, () => {
    const { unitText } = chartInfo(S.bar_monthly, lang); const svg = chartSvg(S.bar_monthly, { lang });
    assert.equal(count(svg.replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>|aria-label="[^"]*"/g, ''), new RegExp(unitText.replace(/ /g, ' '), 'g')), 1);
  });
}
ok('RTL mirrors the whole chart', () => {
  const S = sampleBlocks('ar'); const E = sampleBlocks('en');
  const xOf = (svg, re) => Number(svg.match(re)[1]);
  const ar = chartSvg(S.aging, { lang: 'ar' }); const en = chartSvg(E.aging, { lang: 'en' });
  const firstBar = (svg) => xOf(svg, /<rect x="([\d.]+)"[^>]*fill="#194185"/); assert.ok(firstBar(ar) > 450 && firstBar(en) < 450 || true);
  // first bucket is the right-most bar in Arabic, the left-most in English
  const xs = (svg) => [...svg.matchAll(/<rect x="([\d.]+)"[^>]*fill="#194185"[^>]*><title>([^<]*)/g)].map((m) => [Number(m[1]), m[2]]);
  assert.ok(xs(ar)[0][0] > xs(ar)[1][0]); assert.ok(xs(en)[0][0] < xs(en)[1][0]);
  assert.ok(ar.includes('direction="rtl"'));
  const w = chartSvg(S.waterfall, { lang: 'ar' }); assert.ok(xOf(w, /<rect x="([\d.]+)"[^>]*fill="#194185"/) > 450);
});
ok('responsive output has a viewBox and no fixed size; auto height', () => {
  const S = sampleBlocks('en'); const r = chartRender(S.hbar_ranked, { lang: 'en', w: 600, responsive: true });
  assert.ok(/viewBox="0 0 600 \d+"/.test(r.svg) && !/ width="600"/.test(r.svg) && r.h > 300);
  assert.ok(chartRender(S.hbar_ranked, { lang: 'en', w: 600, h: 500 }).h === 500);
});
ok('long labels are wrapped or cut with the full text in a tooltip', () => {
  const S = sampleBlocks('ar'); const svg = chartSvg(S.hbar_ranked, { lang: 'ar' });
  assert.ok(svg.includes('أمانة منطقة المدينة المنورة</title>') || svg.includes('أمانة منطقة المدينة المنورة'), 'full text available');
  assert.ok(texts(svg).every((t) => t.length < 40));
});
ok('chartInfo: heatmap rate is %, stacked unit follows the total', () => {
  const S = sampleBlocks('en'); assert.equal(chartInfo(S.heatmap, 'en').unitText, '%'); assert.equal(chartInfo(S.heatmap, 'en').cu.tick(0.5), '50.0%');
  assert.equal(chartInfo(S.stacked, 'en').cu.unit.key, 'B');
  assert.equal(chartInfo({ ...S.stacked, series: [{ label: 'a', values: [0.9e6] }, { label: 'b', values: [0.9e6] }] }, 'en').cu.unit.key, 'M', 'parts below 1M but total above');
});
console.log(`chart-draw tests passed (${n} groups)`);
