// Tests of the hierarchy / flow chart kinds (src/utils/chartDrawHier.js + src/data/chartTree.js): donut · treemap · sunburst · sankey, both languages, wide and 340 px.
// Run: esbuild tests/chart-hier.test.mjs --bundle --platform=node --format=esm --outfile=.test-build/chart-hier.test.mjs && node .test-build/chart-hier.test.mjs
import assert from 'node:assert/strict';
import '../src/utils/chartKinds.js';
import { chartSvg, chartRender } from '../src/utils/chartDraw.js';
import { chartInfo, chartSummary, chartTableText } from '../src/data/reportFormat.js';
import { treemapLayout } from '../src/utils/chartDrawHier.js';
import { flattenTree, treeIsAdditive, treeTotal, treeProblem, treeFromSeries, sankeyReconciles, sankeyProblem } from '../src/data/chartTree.js';
import { hierSamples } from '../scripts/chart-samples-hier.mjs';

let n = 0; const ok = (name, fn) => { fn(); n += 1; };
const count = (s, re) => (s.match(re) || []).length;
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => attrs(m[0]));
const titles = (svg) => [...svg.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
const SAR = (v, lang) => `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${lang === 'ar' ? 'ريال' : 'SAR'}`;
// minimal XML well-formedness: balanced tags, no stray < or &, quoted attributes
function wellFormed(svg) {
  const stack = []; const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g; let last = 0; let m;
  while ((m = re.exec(svg))) {
    const text = svg.slice(last, m.index); assert.ok(!/[<>]/.test(text) && !/&(?!amp;|lt;|gt;|quot;)/.test(text), `stray markup/entity in text: ${text.slice(0, 60)}`); last = re.lastIndex;
    if (m[1]) assert.equal(stack.pop(), m[2], `unbalanced </${m[2]}>`); else if (!m[4]) stack.push(m[2]);
  }
  assert.equal(stack.length, 0, 'unclosed tags'); assert.equal(last, svg.length, 'trailing garbage');
}
const KINDS = (S) => Object.entries(S);
const REFUSED = { donut_neg: 'negative', donut_zero: 'zero', treemap_bad: 'not-additive', treemap_neg: 'negative', treemap_zero: 'zero', treemap_null: 'missing', sunburst_bad: 'not-additive', sunburst_root: 'flat', sankey_bad: 'not-reconciled', sankey_neg: 'negative', sankey_missing: 'link', sankey_null: 'missing', sankey_single: 'empty' };

for (const lang of ['ar', 'en']) {
  const S = hierSamples(lang);
  ok(`every sample draws valid SVG, no NaN/undefined, accessible, narrow too (${lang})`, () => {
    for (const [name, b] of KINDS(S)) for (const w of [900, 340]) {
      const svg = chartSvg(b, { lang, w }); assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), name); wellFormed(svg);
      assert.ok(!/NaN|undefined|Infinity|="null"|>null</.test(svg.replace(/data-refused="[^"]*"/, '')), `${name}@${w}: NaN/undefined/null in the SVG`);
      assert.ok(/role="img"/.test(svg) && /aria-label="[^"]{12,}"/.test(svg) && /<title>/.test(svg) && /<desc>/.test(svg), `${name}: accessible name`);
      assert.ok(new RegExp(`viewBox="0 0 ${w} \\d+"`).test(svg), `${name}: viewBox`);
      const t = chartTableText(b, lang); assert.ok(t.headers.length > 1 && t.rows.length > 0 || REFUSED[name], `${name}: table alternative`);
      assert.ok(chartSummary(b, lang).length > 10, `${name}: summary`);
      if (w === 340 && !REFUSED[name]) { // nothing drawn outside the canvas
        tags(svg, 'rect').forEach((r) => { if (r.width && r.x != null) assert.ok(Number(r.x) >= -1 && Number(r.x) + Number(r.width) <= w + 1, `${name}: rect outside at 340 (${r.x}+${r.width})`); });
        tags(svg, 'text').forEach((tx) => assert.ok(Number(tx.x) >= -1 && Number(tx.x) <= w + 1, `${name}: text anchor outside at 340`));
      }
    }
  });
  ok(`non-additive / negative / zero / null / non-reconciled inputs are refused with «No data» (${lang})`, () => {
    for (const [name, why] of Object.entries(REFUSED)) {
      const svg = chartSvg(S[name], { lang }); assert.ok(svg.includes(`data-refused="${why}"`), `${name}: refused as ${why}`); assert.ok(svg.includes(lang === 'ar' ? 'لا بيانات' : 'No data'), name);
      assert.equal(count(svg, /<(?:path|rect) [^>]*data-k=/g), 0, `${name}: no mark of a refused chart`);
    }
    assert.ok(!chartSvg(S.donut, { lang }).includes('data-refused'));
  });

  ok(`donut: angles sum to 2π, ordered by size, centre total + unit, legend with amounts (${lang})`, () => {
    const svg = chartSvg(S.donut, { lang }); const sw = tags(svg, 'path').map((p) => Number(p['data-sweep']));
    assert.equal(sw.length, 3, 'three nonzero slices; the zero part draws nothing'); assert.ok(Math.abs(sw.reduce((a, b) => a + b, 0) - 2 * Math.PI) < 1e-4);
    assert.ok(sw[0] >= sw[1] && sw[1] >= sw[2], 'by size'); assert.ok(Math.abs(sw[0] / (2 * Math.PI) - 2.4 / 3.27) < 1e-4, 'angle ∝ value');
    assert.ok(svg.includes('>3.27<') && svg.includes(lang === 'ar' ? 'مليار ريال' : 'bn SAR'), 'centre total + unit'); assert.ok(svg.includes('73.4%') && svg.includes('0.75'), 'legend amount and share');
    assert.ok(svg.includes(`${SAR(2.4e9, lang)}`) && titles(svg).some((x) => x.includes('73.4%')), 'tooltip: exact SAR + share');
    assert.ok(count(svg, /fill="#fff" fill-opacity|stroke="#98A2B3"/g) >= 1, 'a zero part is a hollow legend swatch');
    const one = chartSvg(S.donut_one, { lang }); const o1 = tags(one, 'path'); assert.equal(o1.length, 1); assert.ok(Math.abs(Number(o1[0]['data-sweep']) - 2 * Math.PI) < 1e-4, 'one slice = the full ring'); assert.ok(/fill-rule="evenodd"/.test(one));
    const nul = chartSvg(S.donut_null, { lang }); assert.equal(count(nul, /<path /g), 2); assert.ok(texts(nul).includes('—'), 'null shown as —, not as 0'); assert.ok(chartTableText(S.donut_null, lang).rows.some((r) => r[1] === '—'));
  });
  ok(`donut: more than 8 parts → 7 + one explicit «Other» slice, summed and labelled (${lang})`, () => {
    const b = S.donut_other; const svg = chartSvg(b, { lang }); const paths = tags(svg, 'path'); assert.equal(paths.length, 8); const sw = paths.map((p) => Number(p['data-sweep']));
    assert.ok(Math.abs(sw.reduce((a, c) => a + c, 0) - 2 * Math.PI) < 1e-4); assert.ok(sw.slice(0, 7).every((x, i, a) => !i || a[i - 1] >= x));
    const other = b.series[0].values.slice(7).reduce((a, c) => a + c, 0); const tot = b.series[0].values.reduce((a, c) => a + c, 0);
    assert.ok(paths[7]['data-k'] === 'other' && Math.abs(sw[7] / (2 * Math.PI) - other / tot) < 1e-4, 'Other = the summed remainder');
    assert.ok(svg.includes(lang === 'ar' ? 'أخرى' : 'Other') && titles(svg).some((x) => x.includes(SAR(other, lang))), 'labelled; exact amount in the tooltip');
    const t = chartTableText(b, lang); assert.equal(t.rows.length, 12, 'the table keeps every part'); assert.equal(t.headers.length, 4);
    assert.equal(t.rows.reduce((a, r) => a + Number(r[1].replace(/,/g, '')), 0), Math.round(tot * 100) / 100, 'table sums to the total');
  });
  ok(`treemap: squarified, leaves ∝ values, groups bordered with names, tooltips with exact SAR (${lang})`, () => {
    const b = S.treemap; const svg = chartSvg(b, { lang }); const rows = flattenTree(b.tree); const leaves = rows.filter((e) => e.leaf);
    const lf = tags(svg, 'rect').filter((r) => r['data-k'] === 'leaf'); assert.equal(lf.length, leaves.length); const gr = tags(svg, 'rect').filter((r) => r['data-k'] === 'group'); assert.equal(gr.length, rows.filter((e) => !e.leaf && e.depth > 0).length, 'every parent is a bordered group');
    // within one parent the areas are exactly proportional (padding only shifts the ratio between parents)
    const boxes = treemapLayout(rows, 900, 500); const area = (i) => { const x = boxes.find((q) => q.idx === i); return x.w * x.h; };
    rows.filter((e) => !e.leaf && e.children.length > 1 && e.depth > 0).forEach((p) => { const kids = p.children.filter((i) => rows[i].value > 0); const ratios = kids.map((i) => area(i) / rows[i].value); assert.ok(Math.max(...ratios) / Math.min(...ratios) < 1.001, `siblings of ${p.label}`); });
    const all = leaves.map((e) => area(e.index) / e.value); assert.ok(Math.max(...all) / Math.min(...all) < 1.6, 'across the tree the ratio stays within the padding distortion');
    const sumA = leaves.reduce((a, e) => a + area(e.index), 0); assert.ok(sumA < 900 * 500 && sumA > 0.7 * 900 * 500, 'leaves + group padding fill the plot');
    const flat = flattenTree({ label: 'T', value: 60, children: [{ label: 'a', value: 30 }, { label: 'b', value: 20 }, { label: 'c', value: 10 }] }); const fb = treemapLayout(flat, 600, 400);
    [1, 2, 3].forEach((i) => assert.ok(Math.abs((fb.find((q) => q.idx === i).w * fb.find((q) => q.idx === i).h) / (600 * 400) - flat[i].value / 60) < 1e-9, 'one level: exact'));
    const t0 = titles(svg); leaves.forEach((e) => assert.ok(t0.some((x) => x.includes(SAR(e.value, lang)) && x.includes(e.path.join(' › '))), `tooltip of ${e.path.join('/')}`));
    assert.ok(t0.some((x) => /%/.test(x) && x.includes(lang === 'ar' ? 'من المستوى الأعلى' : 'of parent')) && t0.some((x) => x.includes(lang === 'ar' ? 'من الإجمالي' : 'of total')));
    lf.forEach((r) => assert.ok(r['data-i'] != null && r['data-j'] != null && r['data-key'])); assert.ok(svg.includes(b.tree.children[0].label), 'group names and the legend');
    const w = lf.map((r) => Number(r.width) * Number(r.height)); assert.ok(w.every((a) => a > 0));
  });
  ok(`treemap: flat series (null listed, zero not drawn), single node, 60 leaves, long labels, ramp legend (${lang})`, () => {
    const flat = chartSvg(S.treemap_flat, { lang }); assert.equal(tags(flat, 'rect').filter((r) => r['data-k'] === 'leaf').length, 10, '12 − 1 null − 1 zero'); assert.ok(/linearGradient/.test(flat));
    assert.ok(/\(ليس صفراً\)|not zero/.test(flat) && /equal to zero|قيمته صفر/.test(flat), 'null and zero named in the notes');
    const tb = chartTableText(S.treemap_flat, lang); assert.equal(tb.rows.length, 13, 'root + 10 + the null listed'); assert.ok(tb.rows.some((r) => r[1] === '—'));
    const single = chartSvg(S.treemap_single, { lang }); assert.equal(tags(single, 'rect').filter((r) => r['data-k'] === 'leaf').length, 1);
    const big = chartSvg(S.treemap_60, { lang }); assert.equal(tags(big, 'rect').filter((r) => r['data-k'] === 'leaf').length, 60); assert.equal(chartTableText(S.treemap_60, lang).rows.length, 1 + 6 + 60);
    const long = chartSvg(S.treemap_long, { lang }); assert.ok(texts(long).every((s) => s.length < 75), 'cut labels'); assert.ok(titles(long).some((x) => x.includes(S.treemap_long.tree.children[0].label)), 'full label in a tooltip');
    const noL = chartSvg({ ...S.treemap, showLabels: false, showLegend: false }, { lang }); assert.equal(count(noL, /<text [^>]*font-size="10.5"/g), 0, 'labels off: no leaf label'); assert.equal(count(noL, / rx="2"/g), 0, 'legend off: no swatch'); assert.ok(count(chartSvg(S.treemap, { lang }), /<text [^>]*font-size="10.5"/g) > 5); assert.ok(count(noL, /data-k="leaf"/g) > 10);
  });
  ok(`sunburst: ring angles sum to 2π, tooltips carry breadcrumb + exact + shares, centre total (${lang})`, () => {
    const b = S.sunburst; const svg = chartSvg(b, { lang }); const rows = flattenTree(b.tree); const ps = tags(svg, 'path');
    for (const ring of [1, 2, 3]) { const sw = ps.filter((p) => p['data-ring'] === String(ring)).map((p) => Number(p['data-sweep'])); assert.ok(Math.abs(sw.reduce((a, c) => a + c, 0) - 2 * Math.PI) < 1e-3, `ring ${ring} covers the full circle`); assert.equal(sw.length, rows.filter((e) => e.depth === ring && e.value > 0).length); }
    const total = treeTotal(b.tree); ps.filter((p) => p['data-ring'] === '1').forEach((p) => { const e = rows[Number(p['data-i'])]; assert.ok(Math.abs(Number(p['data-sweep']) / (2 * Math.PI) - e.value / total) < 1e-4, 'angle ∝ value'); });
    const leaf = rows.find((e) => e.depth === 3); const tip = titles(svg).find((x) => x.startsWith(leaf.path.join(' › '))); assert.ok(tip && tip.includes(SAR(leaf.value, lang)) && /%/.test(tip) && tip.includes(lang === 'ar' ? 'من المستوى الأعلى' : 'of parent'));
    assert.ok(svg.includes(`>${chartInfo(b, lang).cu.tick(total)}<`) && svg.includes(lang === 'ar' ? 'مليار ريال' : 'bn SAR'), 'centre total + unit');
    ps.forEach((p) => assert.ok(p['data-i'] != null && p['data-j'] != null && p['data-key'], 'drill hooks')); assert.equal(count(svg, /<text [^>]*>[^<]*<\/text>/g) > 10, true);
    const two = chartSvg(S.sunburst_2, { lang }); assert.ok(!tags(two, 'path').some((p) => p['data-ring'] === '3')); const one = chartSvg(S.sunburst_1ring, { lang }); assert.equal(tags(one, 'path').length, 2);
  });
  ok(`sankey: widths ∝ values, tiny link kept (min width) and listed, node amounts, tooltips (${lang})`, () => {
    const b = S.sankey; const svg = chartSvg(b, { lang }); const ls = tags(svg, 'path').filter((p) => p['data-v']); assert.equal(ls.length, 4);
    const r = ls.map((p) => Number(p['data-w']) / Number(p['data-v'])); assert.ok(Math.max(...r) / Math.min(...r) < 1.0001, 'thickness = value × one scale');
    assert.ok(svg.includes('>7.58<') || svg.includes('7.58'), 'node amounts'); assert.ok(titles(svg).some((x) => x.includes(SAR(7.58e9, lang)) && /%/.test(x)), 'link tooltip with exact SAR');
    const tiny = chartSvg(S.sankey_tiny, { lang }); const tl = tags(tiny, 'path').filter((p) => p['data-v']); const small = tl.find((p) => p['data-v'] === '20'); assert.ok(small && small['data-min'] === '1' && Number(small['data-w']) >= 1.5, 'min visible width, flagged');
    const rest = tl.filter((p) => !p['data-min']).map((p) => Number(p['data-w']) / Number(p['data-v'])); assert.ok(Math.max(...rest) / Math.min(...rest) < 1.0001);
    assert.ok(chartTableText(S.sankey_tiny, lang).rows.some((x) => x[2] === '20'), 'the tiny flow is in the table');
    const zero = chartSvg(S.sankey_zero, { lang }); assert.equal(tags(zero, 'path').filter((p) => p['data-v']).length, 4, 'a zero flow draws no band'); assert.ok(chartTableText(S.sankey_zero, lang).rows.some((x) => x[2] === '0'));
    const t = chartTableText(b, lang); assert.deepEqual(t.rows.map((x) => x.length), [3, 3, 3, 3]); assert.equal(t.rows[0][2], '3,270,000,000');
    tags(svg, 'rect').filter((q) => q['data-k'] === 'node').forEach((q) => assert.ok(q['data-i'] != null && q['data-key']));
    ls.forEach((p) => assert.ok(p['data-i'] != null && /^[a-z]+&gt;[a-z]+$/.test(p['data-key'])));
    const ext = chartSvg(S.sankey_ext, { lang }); assert.equal(tags(ext, 'path').filter((p) => p['data-v']).length, 7); const many = chartSvg(S.sankey_many, { lang }); assert.equal(tags(many, 'path').filter((p) => p['data-v']).length, 32);
    const longS = chartSvg(S.sankey_long, { lang, w: 340 }); assert.ok(texts(longS).every((s) => s.length < 40), 'long labels cut'); assert.ok(titles(longS).some((x) => x.includes(S.sankey_long.nodes[0].label)), 'full label in the node tooltip');
  });
  ok(`interactive: marks are focusable buttons; static output has none (${lang})`, () => {
    for (const k of ['donut', 'treemap', 'sunburst', 'sankey']) { const i = chartSvg(S[k], { lang, interactive: true }); assert.ok(/role="group"/.test(i) && count(i, /tabindex="0" role="button" class="rc-mark" aria-label="[^"]{4,}"/g) >= 3, k); assert.ok(!/tabindex/.test(chartSvg(S[k], { lang })), k); }
    assert.ok(!/tabindex/.test(chartSvg(S.donut_other, { lang, interactive: true }).match(/<path[^>]*data-k="other"[^>]*>/)[0]), 'the grouped «Other» slice is not a drill target');
  });
}
ok('RTL mirrors the whole chart (first column / first slice / first group at the right)', () => {
  const A = hierSamples('ar'); const E = hierSamples('en'); const node = (svg, key) => Number(tags(svg, 'rect').find((q) => q['data-key'] === key).x);
  const sa = chartSvg(A.sankey, { lang: 'ar' }); const se = chartSvg(E.sankey, { lang: 'en' }); assert.ok(node(sa, 'gross') > 450 && node(se, 'gross') < 450); assert.ok(node(sa, 'coll') < node(sa, 'net') && node(se, 'coll') > node(se, 'net'));
  const lnk = (svg) => { const d = tags(svg, 'path').find((p) => p['data-key'] === 'gross&gt;net').d; return Number(d.match(/^M([\d.]+),/)[1]); }; assert.ok(lnk(sa) > 450 && lnk(se) < 450);
  const ta = chartSvg(A.treemap, { lang: 'ar' }); const te = chartSvg(E.treemap, { lang: 'en' }); const big = (svg) => tags(svg, 'rect').filter((q) => q['data-k'] === 'group' && q['data-j'] === '1').sort((p, q) => Number(q.width) * Number(q.height) - Number(p.width) * Number(p.height))[0]; assert.ok(Number(big(ta).x) > 450 && Number(big(te).x) < 450, 'the largest group is first: right in Arabic, left in English');
  const da = chartSvg(A.donut, { lang: 'ar' }); const de = chartSvg(E.donut, { lang: 'en' }); const cx = (svg) => Number(svg.match(/<text x="([\d.]+)"[^>]*>(?:الإجمالي|Total)/)[1]); assert.ok(cx(da) > 450 && cx(de) < 450, 'the ring is at the right in Arabic, at the left in English'); assert.ok(da.includes('direction="rtl"') && sa.includes('direction="rtl"'));
});
ok('responsive output: viewBox, no fixed size; fixed height honoured', () => {
  const S = hierSamples('en'); for (const k of ['donut', 'treemap', 'sunburst', 'sankey']) { const r = chartRender(S[k], { lang: 'en', w: 600, responsive: true }); assert.ok(/viewBox="0 0 600 \d+"/.test(r.svg) && !/ width="600"/.test(r.svg), k); assert.ok(chartRender(S[k], { lang: 'en', w: 600, h: 900 }).h === 900, k); }
});
ok('labels with markup characters are escaped', () => {
  const b = { type: 'chart', kind: 'treemap', title: 'a & b <c>', tree: { label: 'T & <x>', value: 30, children: [{ label: 'A & B', value: 10 }, { label: '<i>"q"</i>', value: 20 }] } }; const svg = chartSvg(b, { lang: 'en' }); wellFormed(svg); assert.ok(svg.includes('A &amp; B'));
  const s = chartSvg({ type: 'chart', kind: 'sankey', title: 'x', nodes: [{ id: 'a', label: 'A & <1>', col: 0 }, { id: 'b', label: 'B', col: 1 }], links: [{ from: 'a', to: 'b', value: 5 }] }, { lang: 'en' }); wellFormed(s); assert.ok(s.includes('A &amp; &lt;1&gt;'));
});
ok('plain (file-sourced) blocks are not labelled SAR', () => {
  const b = { ...hierSamples('en').treemap_flat, plain: true, valueTitle: 'Invoices', series: [{ label: 'x', values: [30, 20, 10] }], labels: ['a', 'b', 'c'] }; const svg = chartSvg(b, { lang: 'en' }); assert.ok(!/SAR/.test(svg) && svg.includes('Invoices'));
});
ok('chartTree: treeIsAdditive / treeProblem / treeFromSeries / treeTotal', () => {
  const t = { label: 'T', value: 100, children: [{ label: 'a', value: 60 }, { label: 'b', value: 40, children: [{ label: 'x', value: 25 }, { label: 'y', value: 15 }] }] };
  assert.equal(treeIsAdditive(t), true); assert.equal(treeTotal(t), 100); assert.equal(treeIsAdditive({ ...t, value: 101 }), false); assert.equal(treeIsAdditive({ ...t, value: 100.4 }), true, 'within 0.5 SAR'); assert.equal(treeIsAdditive({ ...t, value: 100.4 }, 0.1), false);
  assert.equal(treeProblem({ label: 'T', children: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }), null, 'a parent without a value is the sum of its children'); assert.equal(treeTotal({ label: 'T', children: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }), 3);
  assert.equal(treeProblem({ label: 'T', value: 3, children: [{ label: 'a', value: 3 }, { label: 'b', value: null }] }).code, 'missing'); assert.equal(treeProblem({ label: 'T', value: 3, children: [{ label: 'a', value: 5 }, { label: 'b', value: -2 }] }).code, 'negative'); assert.equal(treeProblem(null).code, 'empty'); assert.equal(treeProblem(t.children[1] && { ...t, children: [{ label: 'a', value: 50 }] }).code, 'sum');
  const fs = treeFromSeries(['a', 'b', 'c'], [1, null, 2], 'T'); assert.equal(fs.tree.value, 3); assert.equal(fs.missing.length, 1);
  assert.deepEqual(flattenTree(t).map((e) => [e.label, e.depth, e.path.join('/')]), [['T', 0, ''], ['a', 1, 'a'], ['b', 1, 'b'], ['x', 2, 'b/x'], ['y', 2, 'b/y']]);
});
ok('chartTree: sankeyReconciles', () => {
  const nodes = [{ id: 'g', col: 0 }, { id: 'e', col: 1 }, { id: 'n', col: 1 }, { id: 'c', col: 2 }, { id: 'u', col: 2 }]; const links = [{ from: 'g', to: 'e', value: 30 }, { from: 'g', to: 'n', value: 70 }, { from: 'n', to: 'c', value: 40 }, { from: 'n', to: 'u', value: 30 }];
  assert.equal(sankeyReconciles(nodes, links), true); assert.equal(sankeyReconciles(nodes, links.map((l) => (l.to === 'u' ? { ...l, value: 30.4 } : l))), true, 'within 0.5'); assert.equal(sankeyReconciles(nodes, links.map((l) => (l.to === 'u' ? { ...l, value: 31 } : l))), false); assert.equal(sankeyReconciles(nodes, links.map((l) => (l.to === 'u' ? { ...l, value: 31 } : l)), 2), true, 'custom tol');
  assert.equal(sankeyProblem(nodes, links.map((l) => (l.to === 'u' ? { ...l, value: 31 } : l))).code, 'imbalance'); assert.equal(sankeyReconciles(nodes, [...links, { from: 'n', to: 'zz', value: 0 }]), false, 'missing node'); assert.equal(sankeyReconciles(nodes, [...links.slice(0, 3), { from: 'n', to: 'u', value: -30 }]), false, 'negative');
  assert.equal(sankeyReconciles(nodes, [...links, { from: 'c', to: 'n', value: 1 }]), false, 'backward link'); assert.equal(sankeyReconciles(nodes, links.map((l, i) => (i === 2 ? { ...l, value: null } : l))), false, 'null'); assert.equal(sankeyReconciles([nodes[0]], []), false); assert.equal(sankeyReconciles([...nodes, { id: 'g' }], links), false, 'duplicate id');
  assert.equal(sankeyReconciles(nodes.map(({ id }) => ({ id })), links), true, 'columns inferred from the links');
});
ok('registered formats: info / summary / table', () => {
  const S = hierSamples('en'); assert.equal(chartInfo(S.treemap, 'en').cu.unit.key, 'B'); assert.equal(chartInfo(S.sankey, 'en').cu.unit.key, 'B'); assert.equal(chartInfo(S.donut, 'en').unitText, 'bn SAR'); assert.equal(chartInfo(S.donut, 'ar').unitText, 'مليار ريال');
  assert.ok(/^Treemap: /.test(chartSummary(S.treemap, 'en')) && /largest/.test(chartSummary(S.treemap, 'en')) && /^Sankey flow chart: /.test(chartSummary(S.sankey, 'en')) && /^Donut chart: /.test(chartSummary(S.donut, 'en')) && /^Sunburst chart: /.test(chartSummary(S.sunburst, 'en')));
  const tt = chartTableText(S.treemap, 'en'); assert.deepEqual(tt.headers, ['Amanah', 'Municipality', 'Source', 'Amount (SAR)', 'Share of parent', 'Share of total']); const rows = flattenTree(S.treemap.tree); assert.equal(tt.rows.length, rows.length);
  const leafRow = tt.rows[rows.findIndex((e) => e.depth === 3)]; assert.ok(leafRow[0] && leafRow[1] && leafRow[2] && /%$/.test(leafRow[4]) && /%$/.test(leafRow[5])); assert.equal(tt.rows[0][5], '100.0%'); assert.ok(Math.abs(rows.filter((e) => e.leaf).reduce((a, e) => a + e.value, 0) - treeTotal(S.treemap.tree)) < 0.5);
  assert.deepEqual(chartTableText(S.sankey, 'en').headers, ['From', 'To', 'Amount (SAR)']); assert.deepEqual(chartTableText(hierSamples('ar').sankey, 'ar').rows[1].slice(0, 2), ['إجمالي المفوتر', 'صافي المفوتر']);
  assert.equal(chartInfo({ kind: 'sankey' }, 'en').cu.unit.key, 'S', 'robust to an empty block');
});
function texts(svg) { return [...svg.matchAll(/<text[^>]*>([^<]*)/g)].map((m) => m[1]); }
console.log(`chart-hier tests passed (${n} groups)`);
