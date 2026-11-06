// Tests of the cartesian chart kinds (src/utils/chartDrawCartesian.js): stacked / 100 % columns and bars, area, stacked area, combo, pareto, histogram, box, scatter, bubble, bullet, line markers —
// AR + EN, negative / zero / null values, one category, 40 categories, long Arabic labels, phone width, valid XML, no NaN, tooltips equal the data, accessible names and tables, label / legend toggles.
// Run: npm run test:chartcart
import assert from 'node:assert/strict';
import { chartSvg, chartRender, DRAW_KINDS } from '../src/utils/chartKinds.js';
import { chartInfo, chartSummary, chartTableText } from '../src/data/reportFormat.js';
import { fmtSar } from '../src/utils/money.js';
import { cartesianBlocks } from '../scripts/chart-samples-cartesian.mjs';
import { sampleBlocks } from '../scripts/chart-samples.mjs';

let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const count = (s, re) => (s.match(re) || []).length;
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const unesc = (s) => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)/g)].map((m) => unesc(m[1]));
const tags = (svg, name) => [...svg.matchAll(new RegExp(`<${name}\\b([^>]*?)(?:/>|>(?:<title>([^<]*)</title>)?)`, 'g'))].map((m) => ({ a: m[1], title: unesc(m[2]), x: Number(attr(m[1], 'x') ?? attr(m[1], 'cx')), y: Number(attr(m[1], 'y') ?? attr(m[1], 'cy')), w: Number(attr(m[1], 'width')), h: Number(attr(m[1], 'height')), fill: attr(m[1], 'fill'), i: attr(m[1], 'data-i'), j: attr(m[1], 'data-j'), r: Number(attr(m[1], 'r')) }));
const marks = (svg, name = 'rect') => tags(svg, name).filter((t) => t.i != null && attr(t.a, 'data-k') === 'mark');
const titleTexts = (svg) => [...svg.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => unesc(m[1]));
function wellFormed(svg) { // a small XML well-formedness check: balanced tags, quoted attributes, escaped text
  const stack = []; const re = /<[^>]*>|[^<]+/g; let m;
  while ((m = re.exec(svg))) {
    const t = m[0];
    if (t[0] !== '<') { assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/.test(t), `bad entity in text: ${t.slice(0, 50)}`); continue; }
    if (/^<[?!]/.test(t)) continue;
    const close = /^<\//.test(t); const self = /\/>$/.test(t); const name = t.match(/^<\/?([A-Za-z][\w:-]*)/)?.[1]; assert.ok(name, `bad tag ${t.slice(0, 40)}`);
    if (!close) { assert.ok(((t.match(/"/g) || []).length % 2) === 0, `unbalanced quotes in ${t.slice(0, 80)}`); assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;)/.test(t), `bad entity in ${t.slice(0, 80)}`); }
    if (close) assert.equal(stack.pop(), name, `mismatched </${name}>`); else if (!self) stack.push(name);
  }
  assert.equal(stack.length, 0, `unclosed: ${stack.join(',')}`);
}
const KINDS = ['stacked_col', 'stacked100_col', 'stacked100_hbar', 'area', 'stacked_area', 'combo', 'pareto', 'histogram', 'box', 'scatter', 'bubble', 'bullet'];

for (const lang of ['ar', 'en']) {
  const S = cartesianBlocks(lang); const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e);
  ok(`every kind is registered, draws, is valid XML, accessible and tabulated (${lang})`, () => {
    for (const k of KINDS) assert.ok(DRAW_KINDS().includes(k), `${k} registered`);
    for (const [name, b] of Object.entries(S)) {
      for (const opt of [{ w: 900 }, { w: 340, responsive: true }, { w: 600, h: 420 }]) {
        const svg = chartSvg(b, { lang, ...opt }); const id = `${name} ${JSON.stringify(opt)}`;
        assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), id); wellFormed(svg);
        assert.ok(!/NaN|undefined|Infinity/.test(svg), `${id}: NaN/undefined/Infinity in the SVG`);
        assert.ok(/role="img"/.test(svg) && /aria-label="[^"]{12,}"/.test(svg) && /<title>/.test(svg) && /<desc>/.test(svg), `${id}: accessible name`);
      }
      const r = chartRender(b, { lang, w: 340, responsive: true }); const head = r.svg.match(/^<svg[^>]*>/)[0]; assert.ok(/viewBox="0 0 340 [\d.]+"/.test(head) && !/ width="340"/.test(head), `${name}: responsive viewBox`);
      const sum = chartSummary(b, lang); assert.ok(sum.length > 25 && !/NaN|undefined/.test(sum), `${name}: summary`); assert.ok(sum.includes(b.title), `${name}: summary names the chart`);
      const t = chartTableText(b, lang); assert.ok(t.headers.length > 1 && t.rows.length > 0, `${name}: table`); t.rows.forEach((row) => assert.equal(row.length, t.headers.length, `${name}: ragged table row`));
      assert.ok(!JSON.stringify(t).match(/NaN|undefined/), `${name}: table text`);
    }
  });
  ok(`empty blocks degrade to «no data», never throw (${lang})`, () => {
    for (const k of KINDS) { const svg = chartSvg({ type: 'chart', kind: k, title: 'x', labels: [], series: [] }, { lang }); wellFormed(svg); assert.ok(!/NaN|undefined/.test(svg), k); assert.ok(chartSummary({ type: 'chart', kind: k, title: 'x', labels: [], series: [] }, lang).length > 5, `${k} summary`); }
  });

  ok(`stacked columns: parts add up, total above, tooltips = data (${lang})`, () => {
    const b = S.stacked_col; const svg = chartSvg(b, { lang }); const rects = marks(svg);
    assert.equal(rects.length, 15, '5 categories × 3 parts'); const tips = titleTexts(svg);
    b.series.forEach((s) => s.values.forEach((v, i) => assert.ok(tips.some((t) => t.startsWith(`${b.labels[i]} — ${s.label}:`) && t.includes(fmtSar(v, lang))), `tooltip with exact SAR for ${s.label}/${b.labels[i]}`)));
    const totals = b.labels.map((_, i) => b.series.reduce((t, s) => t + s.values[i], 0)); const txt = texts(svg);
    [6.9, 4.8, 4.8, 2.6, 1.7].forEach((v, i) => assert.ok(txt.includes(String(v)), `total label ${v}`)); assert.ok(Math.abs(totals[0] - 6.9e9) < 1);
    // stacked: each category's segment heights sum to the column from the zero line to the total
    const byCat = (i) => rects.filter((r) => r.i === String(i)); const top0 = Math.min(...byCat(0).map((r) => r.y)); const bot0 = Math.max(...byCat(0).map((r) => r.y + r.h)); const top1 = Math.min(...byCat(1).map((r) => r.y)); const bot1 = Math.max(...byCat(1).map((r) => r.y + r.h));
    assert.ok(Math.abs((bot0 - top0) / (bot1 - top1) - totals[0] / totals[1]) < 0.01, 'column heights are proportional to the totals'); assert.ok(Math.abs(bot0 - bot1) < 0.5, 'all columns start on the zero line');
    assert.ok(txt.some((t) => /bn|مليار/.test(t)) && count(svg.replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>|aria-label="[^"]*"/g, ''), /bn SAR|مليار ريال/g) === 1, 'unit named once');
  });
  ok(`stacked: negative, zero, missing and incomplete data (${lang})`, () => {
    const b = S.stacked_edge; const svg = chartSvg(b, { lang }); const rects = marks(svg); const y0 = Number(svg.match(/<line [^>]*y1="([\d.]+)"[^>]*stroke="#98A2B3" stroke-width="1.4"/)[1]);
    const neg = rects.find((r) => r.i === '0' && r.j === '1'); assert.ok(neg.y >= y0 - 0.5, 'a negative part hangs below the zero line');
    assert.equal(rects.filter((r) => r.i === '1').length, 0, 'zeros draw no mark'); assert.ok(titleTexts(svg).some((t) => t.startsWith(`${b.labels[1]}: 0`)) && texts(svg).includes('0'), 'a zero category is labelled 0');
    assert.equal(rects.filter((r) => r.i === '2').length, 1, 'only the known part of an incomplete category is drawn'); assert.ok(texts(svg).includes('—'), 'incomplete → «—», not a total');
    assert.ok(!titleTexts(svg).some((t) => /Total|الإجمالي/.test(t) && t.startsWith(b.labels[0])), 'mixed-sign category has no total label');
    const tot3 = titleTexts(svg).find((t) => t.startsWith(`${b.labels[3]}: ${L('الإجمالي', 'Total')}`)); assert.ok(tot3 && tot3.includes(fmtSar(4e6, lang)), 'total of a complete category');
  });
  ok(`100 % stacked: every category sums to 100 %, a zero total is an empty «—» row (${lang})`, () => {
    for (const kind of ['stacked100_col', 'stacked100_hbar']) {
      const b = S[kind]; const svg = chartSvg(b, { lang }); const tips = titleTexts(svg); assert.ok(![...texts(svg), ...tips].filter((t) => !/not 0|ليست/.test(t)).some((t) => /(^|[^\d.])0(\.0)?%/.test(t.replace(/^0%$/, ''))), 'never 0 %');
      b.labels.slice(0, 5).forEach((lab) => { const shares = tips.filter((t) => t.startsWith(`${lab} — `) && t.includes('·')).map((t) => Number(t.match(/· ([\d.]+)%/)[1])); assert.equal(shares.length, 3); assert.ok(Math.abs(shares.reduce((a, z) => a + z, 0) - 100) < 0.2, `${lab}: shares sum to 100`); });
      b.series.forEach((s) => s.values.slice(0, 5).forEach((v, i) => assert.ok(tips.some((t) => t.startsWith(`${b.labels[i]} — ${s.label}:`) && t.includes(fmtSar(v, lang))), 'amount AND share in the tooltip')));
      assert.ok(tips.some((t) => t.startsWith(`${b.labels[5]}:`) && /not defined|غير معرّفة/.test(t)), 'zero-total category explained'); assert.ok(texts(svg).includes('—'), 'empty «—» mark');
      assert.equal(marks(svg).filter((r) => r.i === '5').length, 0, 'no segment for the zero total'); assert.ok(texts(svg).includes('100%') && texts(svg).includes('0%'), 'percent axis 0–100');
      const neg = chartSvg(S.stacked100_neg, { lang }); assert.ok(neg.includes('data-state="invalid"') && marks(neg).length === 0, 'negative parts: not drawn, said so');
    }
    const t = chartTableText(S.stacked100_col, lang); assert.equal(t.rows.length, 6); assert.ok(/\(\d+\.\d%\)/.test(t.rows[0][1]), 'share column'); assert.deepEqual(t.rows[5].slice(1, 4), ['—', '—', '—'], 'zero-total row is «—»');
  });
  ok(`stacked orientation: stacked_col rows when h, 100 % bar columns when v (${lang})`, () => {
    const h = marks(chartSvg(S.stacked_col_h, { lang })); assert.ok(h[0].w > h[0].h && h.length === 15, 'horizontal bars');
    const v = marks(chartSvg({ ...S.stacked100_hbar, orientation: 'v' }, { lang })); assert.ok(v[0].h > v[0].w, 'columns');
    const d = marks(chartSvg(S.stacked100_hbar, { lang })); assert.ok(d[0].w > d[0].h, 'kind default');
  });
  ok(`40 categories, one category, long labels (${lang})`, () => {
    const many = chartSvg(S.stacked_many, { lang }); wellFormed(many); assert.equal(marks(many).length, 80); assert.ok(/rotate\(/.test(many) || count(many, /data-k="label"/g) >= 40, 'labels rotated or wrapped'); assert.ok(titleTexts(many).includes(S.stacked_many.labels[39]), 'cut labels keep the full text');
    const small = chartSvg(S.stacked_many, { lang, w: 340 }); assert.equal(marks(small).length, 80); assert.ok(texts(small).length < texts(many).length + 5);
    const one = chartSvg(S.stacked_one, { lang }); assert.equal(marks(one).length, 3);
    const long = chartSvg(S.stacked_long, { lang }); assert.ok(texts(long).every((t) => t.length < 52), 'wrapped or cut'); assert.ok(titleTexts(long).includes(S.stacked_long.labels[0]) || long.includes(S.stacked_long.labels[0]), 'full text in a tooltip');
    // 340 wide: no first-label spill beyond the viewBox (rotated labels are cut to the room they have)
    const sm = chartSvg({ ...S.stacked_long, labels: [S.stacked_long.labels[0], 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'], series: S.stacked_long.series.map((s) => ({ ...s, values: [...s.values, 1, 1, 1, 1, 1, 1, 1] })) }, { lang, w: 340 }); wellFormed(sm);
    [...sm.matchAll(/<text x="([\d.]+)"/g)].forEach((m) => assert.ok(Number(m[1]) >= 0 && Number(m[1]) <= 340, `text anchored inside the 340 viewBox (${m[1]})`));
  });
  ok(`line markers: absent = unchanged circles, true = one shape per series, false = lines only (${lang})`, () => {
    const b = S.line_markers; const plain = { ...b }; delete plain.markers; const a = chartSvg(plain, { lang }); assert.equal(a, chartSvg({ ...plain, markers: undefined }, { lang }));
    assert.ok(!a.includes('<polygon') && !/<circle[^>]*data-i=/.test(a), 'legacy line: circles, no drill hook'); assert.ok(count(a, /<circle /g) >= 22);
    const m = chartSvg(b, { lang }); assert.ok(m.includes('<polygon') && /<rect [^>]*data-i=/.test(m) === false && count(m, /data-i="\d+" data-j="2"/g) === 6, 'triangles for the third series (2 nulls skipped)'); assert.ok(count(m, /data-j="1"/g) === 8 && /<rect/.test(m), 'square markers for series 2');
    const off = chartSvg({ ...b, markers: false }, { lang }); assert.ok(count(off, /fill-opacity="0"/g) >= 20, 'invisible hover targets'); assert.equal(count(off, /<circle[^>]*data-i=/g), 22, 'every point stays a drill target'); wellFormed(off);
    assert.ok(count(m, /<path /g) === 4, 'same line segments as without markers');
  });
  ok(`area: zero baseline, missing breaks the area, never drops to zero (${lang})`, () => {
    const svg = chartSvg(S.area, { lang }); const polys = [...svg.matchAll(/<polygon points="([^"]*)"/g)].map((m) => m[1].split(' ').map((p) => p.split(',').map(Number)));
    assert.equal(polys.length, 3, 'net billed (1) + collected in two parts (2)'); const y0 = Number(svg.match(/<line [^>]*y1="([\d.]+)"[^>]*stroke="#98A2B3" stroke-width="1.4"/)[1]);
    polys.forEach((p) => assert.ok(Math.max(...p.map((q) => q[1])) <= y0 + 0.01 && Math.abs(Math.max(...p.map((q) => q[1])) - y0) < 0.01, 'baseline is the zero line'));
    assert.equal(count(svg, /<path /g), 3, 'one line per segment'); assert.ok(titleTexts(svg).some((t) => t.includes(S.area.labels[5]) && /no data|لا بيانات/.test(t)), 'gap marked at the baseline, not drawn as zero');
    const tips = titleTexts(svg); S.area.series[0].values.forEach((v, i) => assert.ok(tips.some((t) => t.startsWith(`${S.area.labels[i]} — ${S.area.series[0].label}`) && t.includes(fmtSar(v, lang))), 'point tooltip'));
    const st = chartSvg(S.stacked_area, { lang }); assert.equal(count(st, /<polygon /g), 3, 'one polygon per layer'); assert.equal(count(st, /<rect [^>]*fill-opacity="0.88"/g), 3, 'the isolated last month is a narrow column'); assert.ok(texts(st).includes('—'), 'the month with a missing part breaks the stack');
    const all = chartSvg({ ...S.stacked_area, series: S.stacked_area.series.map((s) => ({ ...s, values: s.values.map((v, i) => (i === 3 ? 0 : v)) })) }, { lang }); assert.ok(!/NaN/.test(all));
    const negb = chartSvg({ ...S.stacked_area, series: [{ label: 'a', values: [1, -1, 2] }, { label: 'b', values: [1, 1, 1] }], labels: ['x', 'y', 'z'] }, { lang }); assert.ok(negb.includes('data-state="invalid"'), 'stacked area refuses negatives');
    const nonst = chartSvg({ ...S.area, series: [{ label: 'a', values: [1e6, -2e6, 3e6, 0, 1e6, 2e6, 1e6, 1e6] }] }, { lang }); wellFormed(nonst); assert.ok(!/NaN/.test(nonst), 'negative area');
    const info = chartInfo(S.stacked_area, lang); assert.equal(info.cu.unit.key, 'B');
  });
  ok(`combo: two axes, each with its own unit; amount and rate never share one axis (${lang})`, () => {
    const b = S.combo; const svg = chartSvg(b, { lang }); const t = texts(svg);
    assert.ok(t.some((x) => /bn SAR|مليار ريال/.test(x)), 'primary axis titled with the amount unit'); assert.ok(t.includes(b.axis2.title), 'secondary axis titled with its own format');
    assert.ok(t.includes('80%') && t.includes('0%'), 'secondary ticks are percentages'); const prim = t.filter((x) => /^[\d.]+$/.test(x)); assert.ok(prim.length >= 5, 'primary ticks are plain amounts');
    assert.ok(t.some((x) => x.includes(L('المحور الأيسر', 'right axis'))) && t.some((x) => x.includes(L('المحور الأيمن', 'left axis'))), 'legend says which axis each series uses');
    const tips = titleTexts(svg); b.series[0].values.forEach((v, i) => assert.ok(tips.some((x) => x.startsWith(`${b.labels[i]} — ${b.series[0].label}`) && x.includes(fmtSar(v, lang))), 'bar tooltip exact SAR'));
    b.series[2].values.forEach((v, i) => v != null && assert.ok(tips.some((x) => x.startsWith(`${b.labels[i]} — ${b.series[2].label}:`) && x.includes(`${(v * 100).toFixed(1)}%`)), 'line tooltip = rate'));
    assert.equal(marks(svg).filter((r) => r.j === '2').length + marks(svg, 'polygon').length + marks(svg, 'circle').length >= 7, true);
    assert.ok(tips.some((x) => x.includes(`${b.labels[6]} — ${b.series[2].label}: —`)), 'missing rate stays a gap'); assert.equal(count(svg, /<path /g), 1, 'rate line is broken at the missing month (the last month stands alone as a marker)');
    const info = chartInfo(b, lang); assert.equal(info.cu.unit.key, 'B', 'info = primary axis'); assert.equal(chartSummary(b, lang).includes(b.axis2.title), true);
    const cnt = chartSvg({ ...b, valueKind: 'count', axis2: { title: 'x', kind: 'amount' }, series: [{ label: 'n', type: 'bar', values: [10, 20, 30, 40, 50, 60, 70, 80] }, { label: 'amt', type: 'line', axis: 'secondary', values: [1e6, 2e6, 3e6, 4e6, 5e6, 6e6, 7e6, 8e6] }] }, { lang }); assert.ok(texts(cnt).some((x) => /M SAR|مليون ريال/.test(x)) && texts(cnt).includes(L('العدد', 'Count')), 'count + amount axes');
    const only = chartSvg({ ...b, series: b.series.map((s) => ({ ...s, axis: 'secondary' })) }, { lang }); wellFormed(only); assert.ok(texts(only).includes(b.axis2.title) && !texts(only).includes(L('المحور الأيسر', 'right axis')));
    const narrow = chartSvg(b, { lang, w: 340 }); wellFormed(narrow);
  });
  ok(`pareto: sorted descending, «Other» stays last, cumulative reaches 100 %, 80 % reference (${lang})`, () => {
    const b = S.pareto; const svg = chartSvg(b, { lang }); const bars = marks(svg).filter((r) => r.j === '0').sort((a, z) => (ar ? z.x - a.x : a.x - z.x)); const vals = bars.map((r) => Number(unesc(r.title).match(/\(([\d,]+) /)?.[1].replace(/,/g, '')));
    assert.equal(vals.length, 7); const main = vals.slice(0, 6); assert.deepEqual(main, [...main].sort((a, z) => z - a), 'descending'); assert.equal(vals[6], 0.3e9, 'Other last');
    const otherAsLargest = { ...b, series: [{ label: 'v', values: [...b.series[0].values.slice(0, 6), 9e9] }] }; const o = chartSvg(otherAsLargest, { lang }); const ob = marks(o).filter((r) => r.j === '0').sort((a, z) => (ar ? z.x - a.x : a.x - z.x)); assert.ok(ob[6].title.startsWith(b.otherLabel), 'a large remainder group does not jump to the top');
    const cum = marks(svg, 'circle').filter((r) => r.j === '1').sort((a, z) => (ar ? z.x - a.x : a.x - z.x)).map((r) => Number(r.title.match(/([\d.]+)%/)[1])); assert.equal(cum.length, 7); assert.deepEqual(cum, [...cum].sort((a, z) => a - z)); assert.equal(cum[6], 100);
    assert.ok(svg.includes('stroke-dasharray="6 4"') && texts(svg).includes('80%') && texts(svg).includes('100%'), '80 % line and 0–100 % axis'); assert.ok(texts(svg).some((x) => /80 %|80%/.test(x) && x.length > 8), 'caption: how many items reach 80 %');
    assert.ok(texts(svg).includes(L('أخرى', 'Other')) && count(svg, /stroke-dasharray="4 2"/g) === 1, 'Other labelled and drawn apart');
    assert.ok(chartSvg({ ...b, series: [{ label: 'v', values: [1, -1, 2, 3, 4, 5, 6] }] }, { lang }).includes('data-state="invalid"'), 'negative values refused');
    const miss = chartSvg({ ...b, series: [{ label: 'v', values: [5e9, null, 3e9, 1e9, 1e9, 0, 2e9] }] }, { lang }); wellFormed(miss); assert.ok(texts(miss).includes('—')); const t = chartTableText({ ...b, series: [{ label: 'v', values: [5e9, null, 3e9, 1e9, 1e9, 0, 2e9] }] }, lang); assert.equal(t.rows.length, 7); assert.equal(t.rows[5][2], '—', 'missing is not 0 %');
    const tt = chartTableText(b, lang); assert.equal(tt.rows.length, 7); assert.equal(tt.rows[6][3], '100.0%'); assert.equal(tt.rows[6][0], b.otherLabel);
    const one = chartSvg({ ...b, labels: ['A'], series: [{ label: 'v', values: [3e9] }], otherLabel: null }, { lang }); assert.ok(one.includes('100%'));
    const zero = chartSvg({ ...b, series: [{ label: 'v', values: b.labels.map(() => 0) }] }, { lang }); wellFormed(zero); assert.ok(!/NaN/.test(zero));
    const many = chartSvg({ type: 'chart', kind: 'pareto', title: 'p', labels: S.stacked_many.labels, series: [{ label: 'v', values: S.stacked_many.series[0].values }] }, { lang, w: 340 }); wellFormed(many);
  });
  ok(`histogram: bins touch, empty bins stay, x axis in the right unit (${lang})`, () => {
    const b = S.histogram; const svg = chartSvg(b, { lang }); const bars = marks(svg); assert.equal(bars.length, 6, 'six non-empty bins'); assert.ok(!bars.some((r) => r.i === '4'), 'the empty bin has no bar');
    const sorted = [...bars].sort((a, z) => Number(a.i) - Number(z.i)); for (let i = 1; i < sorted.length; i += 1) { const prev = sorted[i - 1]; const cur = sorted[i]; assert.ok(Math.abs(cur.x - (prev.x + (ar ? -1 : 1) * prev.w * (Number(cur.i) - Number(prev.i)))) < 0.2, 'bars touch, the empty bin keeps its width'); }
    const tips = titleTexts(svg); b.bins.forEach((x) => assert.ok(tips.some((t) => t.includes(`${fmtSar(x.lo, lang)} – ${fmtSar(x.hi, lang)}: `) && (x.count === 0 ? t.includes(': 0') : t.includes(x.count.toLocaleString('en-US')))), `tooltip of bin ${x.lo}`));
    assert.ok(tips.some((t) => t.includes('200,000') && t.endsWith(': 0')), 'the empty bin is hoverable and says 0'); assert.ok(texts(svg).includes('0') && texts(svg).includes('350') && texts(svg).some((t) => /K SAR|ألف ريال/.test(t)), 'edges in the chart unit, unit in the axis title');
    const days = chartSvg(S.histogram_days, { lang }); assert.ok(texts(days).includes(L('الأيام بعد الاستحقاق', 'Days past due')) && !/SAR|ريال/.test(texts(days).join(' ')), 'days axis has no currency'); assert.ok(texts(days).some((t) => /not a density|لا الكثافة/.test(t)), 'unequal bins are said');
    assert.ok(!texts(svg).some((t) => /not a density|لا الكثافة/.test(t)), 'equal bins: no caption');
    const gap = { ...S.histogram_days, bins: [{ lo: 0, hi: 30, count: 5 }, { lo: 31, hi: 60, count: 7 }, { lo: 61, hi: null, count: 2 }] }; const g = chartSvg(gap, { lang }); wellFormed(g); assert.ok(texts(g).some((t) => t.includes('≥ 61')), 'open-ended and non-contiguous bins get range labels');
    const t = chartTableText(b, lang); assert.equal(t.rows.length, 7); assert.equal(t.rows[4][1], '0'); const amt = chartTableText({ ...b, valueKind: 'amount' }, lang); assert.equal(amt.headers.length, 3);
    const av = chartSvg({ ...b, valueKind: 'amount' }, { lang }); assert.ok(titleTexts(av).some((t2) => /count|العدد/.test(t2)), 'amount histogram tooltip also gives the count'); assert.equal(chartInfo(S.histogram_days, lang).cu.unit.key, 'count');
    const nul = chartSvg({ ...b, bins: b.bins.map((x, i) => (i === 2 ? { ...x, count: null } : x)) }, { lang }); assert.ok(texts(nul).includes('—'), 'missing count is not zero');
  });
  ok(`box plot: n < 5 not drawn and named, one value axis, outliers, horizontal when many (${lang})`, () => {
    const b = S.box; const svg = chartSvg(b, { lang }); const boxes = marks(svg).filter((r) => r.j === '0'); assert.equal(boxes.length, 4, 'five groups, one with n=3');
    assert.ok(!boxes.some((r) => r.title.startsWith(b.groups[3].label)), 'the small group is not drawn'); assert.ok(texts(svg).some((t) => t.includes(b.groups[3].label) && t.includes('n=3')), 'caption names it');
    assert.equal(marks(svg, 'circle').filter((r) => r.j === '1').length, 8, 'four drawn groups with 2 outliers each'); assert.equal(count(svg, />200</g), 1, 'one shared value axis'); assert.equal(count(svg, /stroke-width="2.6"/g), 4, 'a median line per box');
    const tip = boxes[0].title; [b.groups[0].min, b.groups[0].q1, b.groups[0].median, b.groups[0].q3, b.groups[0].max].forEach((v) => assert.ok(tip.includes(`${Number.isInteger(v) ? v : v.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${L('يوم', 'days')}`), `tooltip has ${v}`));
    const am = chartSvg(S.box_amount, { lang }); assert.ok(titleTexts(am).some((t) => t.includes(fmtSar(S.box_amount.groups[0].median, lang))), 'exact SAR in the box tooltip'); assert.ok(texts(am).some((t) => /K SAR|ألف ريال/.test(t)));
    const many = { ...b, groups: Array.from({ length: 12 }, (_, i) => ({ label: `${L('مجموعة', 'Group')} ${i + 1}`, n: 20, min: 1, q1: 2 + i, median: 4 + i, q3: 6 + i, max: 9 + i, outliers: [] })) }; const h = chartSvg(many, { lang }); const hb = marks(h).filter((r) => r.j === '0'); assert.equal(hb.length, 12); assert.ok(hb[0].w > hb[0].h, 'horizontal when many groups'); wellFormed(h);
    const forced = marks(chartSvg({ ...b, orientation: 'h' }, { lang })).filter((r) => r.j === '0'); assert.ok(forced[0].w > forced[0].h); const vert = marks(chartSvg({ ...many, orientation: 'v' }, { lang })).filter((r) => r.j === '0'); assert.ok(vert[0].h > vert[0].w);
    const none = chartSvg({ ...b, groups: [mk(3), mk(4)] }, { lang }); assert.ok(none.includes('data-state="invalid"') && marks(none).length === 0, 'no group with enough observations'); wellFormed(none);
    const bad = chartSvg({ ...b, groups: [{ ...b.groups[0], q1: 999 }, b.groups[1]] }, { lang }); assert.equal(marks(bad).filter((r) => r.j === '0').length, 1, 'inconsistent statistics are not drawn'); const tt = chartTableText(b, lang); assert.equal(tt.rows.length, 5); assert.ok(/5|fewer|أقل/.test(tt.rows[3][8])); assert.equal(chartInfo(b, lang).cu.unit.key, 'days');
  });
  ok(`scatter: two quantitative axes with their own units, caption, missing points (${lang})`, () => {
    const b = S.scatter; const svg = chartSvg(b, { lang }); const pts = marks(svg, 'circle'); assert.equal(pts.length, 7); const t = texts(svg);
    assert.ok(t.some((x) => x.includes(L('صافي المفوتر', 'Net billed')) && /bn SAR|مليار ريال/.test(x)), 'x: amount unit'); assert.ok(t.some((x) => x.includes(L('نسبة التحصيل', 'Collection rate')) && x.includes('%')), 'y: rate in %');
    assert.ok(t.includes(L('العلاقة لا تعني السببية', 'A relationship is not causation')), 'causation caption inside the SVG'); const tips = titleTexts(svg); b.points.forEach((p) => assert.ok(tips.some((x) => x.startsWith(p.label) && x.includes(fmtSar(p.x, lang)) && x.includes(`${(p.y * 100).toFixed(1)}%`)), `tooltip of ${p.label}`));
    const x0 = Number(svg.match(/<circle cx="([\d.]+)"[^>]*data-i="0"/)[1]); const x3 = Number(svg.match(/<circle cx="([\d.]+)"[^>]*data-i="3"/)[1]); assert.equal(ar ? x0 < x3 : x0 > x3, true, 'larger x lies toward the end (left in Arabic, right in English)');
    const withNull = chartSvg({ ...b, points: [...b.points, { label: 'Z', x: null, y: 0.5 }, { label: 'W', x: 1e9, y: null }] }, { lang }); assert.equal(marks(withNull, 'circle').length, 7, 'incomplete points are not drawn'); assert.ok(texts(withNull).some((x) => /2/.test(x) && /not zero|ليست صفراً/.test(x)));
    const many = chartSvg({ ...b, points: Array.from({ length: 60 }, (_, i) => ({ label: `P${i}`, x: i * 1e6, y: (i % 7) / 10 })) }, { lang }); assert.equal(marks(many, 'circle').length, 60); assert.ok(texts(many).filter((x) => /^P\d+$/.test(x)).length <= 4, 'few labels'); wellFormed(many);
    const same = chartSvg({ ...b, points: [{ label: 'a', x: 5, y: 5 }], xKind: 'count', yKind: 'days' }, { lang }); wellFormed(same); assert.ok(!/NaN/.test(same)); assert.equal(chartInfo(b, lang).unitText, '%'); const tab = chartTableText(b, lang); assert.equal(tab.rows.length, 7); assert.equal(tab.headers.length, 3);
    assert.ok(chartSummary(b, lang).includes(L('السببية', 'causation')));
  });
  ok(`bubble: area proportional to size, size legend, labels for the largest only (${lang})`, () => {
    const b = S.bubble; const svg = chartSvg(b, { lang }); const bub = marks(svg, 'circle'); assert.equal(bub.length, 7); const big = bub.find((r) => r.i === '0'); const small = bub.find((r) => r.i === '3');
    const ratio = (big.r / small.r) ** 2; assert.ok(Math.abs(ratio - b.points[0].size / b.points[3].size) < 0.25, `area ∝ size (${ratio})`); const legendCircles = (svg.match(/<circle [^>]*fill="none" stroke="#667085"/g) || []).length; assert.ok(legendCircles >= 2 && legendCircles <= 3, 'size legend with reference sizes');
    assert.ok(texts(svg).some((x) => x.includes(L('غير المحصّل', 'Uncollected'))), 'size legend title'); assert.ok(texts(svg).includes(L('العلاقة لا تعني السببية', 'A relationship is not causation')));
    assert.equal(texts(svg).filter((x) => b.points.some((p) => p.label === x)).length, 6, 'labels only for the 6 largest'); assert.ok(titleTexts(svg).some((x) => x.startsWith(b.points[6].label)), 'all points keep a tooltip');
    assert.ok(titleTexts(svg).some((x) => x.includes(fmtSar(b.points[0].size, lang))), 'size in the tooltip, exact SAR');
    const nos = chartSvg({ ...b, points: [...b.points, { label: 'N', x: 1e9, y: 0.5, size: null }] }, { lang }); assert.equal(marks(nos, 'circle').length, 7, 'a point without size is not drawn');
    const z = chartSvg({ ...b, points: [{ label: 'a', x: 1, y: 1, size: 0 }, { label: 'b', x: 2, y: 2, size: 0 }] }, { lang }); wellFormed(z); assert.ok(!/NaN/.test(z)); assert.equal(chartSummary(b, lang).includes(b.sizeTitle), true);
  });
  ok(`bullet: actual bar, target tick, «actual / target = %», no target → not drawn (${lang})`, () => {
    const b = S.bullet; const svg = chartSvg(b, { lang }); const t = texts(svg); assert.ok(t.includes('4.2 / 5 = 84.0%') && t.includes('3.1 / 3 = 103.3%') && t.includes('1.9 / 3.2 = 59.4%'), 'achievement labels');
    assert.equal(marks(svg).filter((r) => r.j === '0').length, 3, 'three rows drawn'); assert.equal(count(svg, /stroke-width="3"/g), 3, 'a target tick per drawn row'); assert.ok(!t.includes(b.bullets[3].label) && t.some((x) => x.includes(b.bullets[3].label) && /target|مستهدف/.test(x)), 'row without a target is named in the note');
    const tips = titleTexts(svg); assert.ok(tips.some((x) => x.includes(fmtSar(4.2e9, lang)) && x.includes(fmtSar(5e9, lang)) && x.includes('84.0%')), 'exact SAR');
    assert.ok(t.includes(L('ضعيف', 'Poor')) && t.includes(L('جيد', 'Good')), 'range bands in the legend'); const none = chartSvg({ ...b, bullets: [{ label: 'x', actual: 1, target: null }] }, { lang }); assert.ok(none.includes('data-state="invalid"') && !/NaN/.test(none));
    const rate = chartSvg({ ...b, valueKind: 'rate', bullets: [{ label: 'r', actual: 0.5, target: 0.8 }] }, { lang }); assert.ok(texts(rate).includes('50% / 80% = 62.5%'), 'rates in %'); assert.ok(!texts(rate).some((x) => /SAR|ريال/.test(x)));
    const tab = chartTableText(b, lang); assert.equal(tab.rows.length, 4); assert.equal(tab.rows[0][3], '84.0%'); assert.equal(tab.rows[3][3], '—'); const noact = chartSvg({ ...b, bullets: [{ label: 'x', actual: null, target: 5 }] }, { lang }); wellFormed(noact); assert.ok(texts(noact).includes('—') || texts(noact).some((x) => x.startsWith('—')));
    const wide = chartSvg({ ...b, bullets: Array.from({ length: 70 }, (_, i) => ({ label: `L${i}`, actual: i + 1, target: 40 })) }, { lang }); assert.ok(texts(wide).some((x) => /\+ 10|10 أخرى/.test(x)), '«+N more» beyond 60 rows'); wellFormed(wide);
  });
  ok(`label and legend toggles (${lang})`, () => {
    for (const [name, b] of Object.entries(S)) {
      if (!KINDS.includes(b.kind) && b.kind !== 'line') continue;
      const on = chartSvg(b, { lang }); const noLab = chartSvg({ ...b, showLabels: false }, { lang }); const noLeg = chartSvg({ ...b, showLegend: false }, { lang });
      wellFormed(noLab); wellFormed(noLeg); if (!['stacked100_neg', 'stacked_many'].includes(name)) assert.ok(texts(noLab).length < texts(on).length, `${name}: value labels off`);
      const legendLabels = (b.series || []).map((s) => s.label).filter((l) => l && l.length > 2 && !/^[A-Z]$/.test(l));
      if (b.kind === 'combo') { assert.ok(texts(on).some((x) => x.includes(L('المحور الأيمن', 'left axis'))) && !texts(noLeg).some((x) => x.includes(L('المحور الأيمن', 'left axis')) || x.includes(L('المحور الأيسر', 'right axis'))), 'combo legend toggles'); }
      else legendLabels.forEach((l) => { if (['area', 'stacked_area', 'combo', 'stacked_col', 'stacked100_col', 'stacked100_hbar', 'line'].includes(b.kind)) { assert.ok(texts(on).some((x) => x.includes(l)), `${name}: legend shows ${l}`); assert.ok(!texts(noLeg).some((x) => x.includes(l)), `${name}: legend off hides ${l}`); } });
      assert.ok(noLeg.length <= on.length, `${name}: legend band dropped`);
    }
    const hb = sampleBlocks(lang).hbar_ranked; assert.ok(texts(chartSvg({ ...hb, showLabels: false }, { lang })).length < texts(chartSvg(hb, { lang })).length, 'existing hbar honours showLabels'); assert.ok(chartSvg({ ...hb, showLegend: false }, { lang }).length < chartSvg(hb, { lang }).length);
  });
  ok(`drill hooks point into the block's own indexes (${lang})`, () => {
    const lim = { stacked_col: [5, 3], stacked100_col: [6, 3], stacked100_hbar: [6, 3], area: [8, 2], stacked_area: [8, 3], combo: [8, 3], pareto: [7, 2], histogram: [7, 1], box: [5, 2], scatter: [7, 1], bubble: [7, 1], bullet: [4, 1] };
    for (const k of KINDS) { const b = Object.values(S).find((x) => x.kind === k); const svg = chartSvg(b, { lang }); const hooks = [...svg.matchAll(/data-i="(\d+)"(?: data-j="(\d+)")?/g)]; assert.ok(hooks.length > 0, `${k}: has hooks`); hooks.forEach((m) => { assert.ok(Number(m[1]) < lim[k][0], `${k} i`); if (m[2] != null) assert.ok(Number(m[2]) < lim[k][1], `${k} j`); }); }
    const ps = chartSvg({ ...S.scatter, points: S.scatter.points.map((p) => ({ ...p })) }, { lang }); assert.ok(ps.includes('data-key="a3"'), 'point keys travel with the mark'); const ki = chartSvg({ ...S.stacked_col, keys: ['k0', 'k1', 'k2', 'k3', 'k4'] }, { lang }); assert.ok(ki.includes('data-key="k2"'));
    const inter = chartSvg(S.stacked_col, { lang, interactive: true }); assert.ok(/role="button"/.test(inter) && /tabindex="0"/.test(inter));
  });
}
function mk(nn) { return { label: `g${nn}`, n: nn, min: 1, q1: 2, median: 3, q3: 4, max: 5 }; }
ok('Arabic is mirrored as a whole', () => {
  const A = cartesianBlocks('ar'); const E = cartesianBlocks('en');
  for (const name of ['stacked_col', 'combo', 'histogram']) {
    const first = (svg) => marks(svg).filter((r) => r.i === '0')[0]; const last = (svg, i) => marks(svg).filter((r) => r.i === String(i))[0];
    const ar = chartSvg(A[name], { lang: 'ar' }); const en = chartSvg(E[name], { lang: 'en' }); const li = name === 'histogram' ? 3 : 2; assert.ok(first(ar).x > last(ar, li).x, `${name}: first category at the right in Arabic`); assert.ok(first(en).x < last(en, li).x, `${name}: first category at the left in English`);
  }
  const ar = chartSvg(A.combo, { lang: 'ar' }); const en = chartSvg(E.combo, { lang: 'en' }); const tx = (svg, s) => Number((svg.match(new RegExp(`<text x="([\\d.]+)"[^>]*>${s}`)) || [])[1]); assert.ok(tx(ar, '80%') < 450 && tx(en, '80%') > 450, 'the secondary axis is on the opposite side, mirrored');
  assert.ok(chartSvg(A.stacked100_hbar, { lang: 'ar' }).includes('direction="rtl"'));
});
ok('units: info resolves amount, rate, count and days kinds', () => {
  const E = cartesianBlocks('en');
  assert.equal(chartInfo({ ...E.stacked_col, valueKind: 'count' }, 'en').unitText, ''); assert.equal(chartInfo({ ...E.stacked_col, valueKind: 'count' }, 'en').plain, true);
  assert.equal(chartInfo({ ...E.combo, valueKind: 'rate' }, 'en').cu.tick(0.5), '50%'); assert.equal(chartInfo(E.stacked_col, 'en').unitText, 'bn SAR'); assert.equal(chartInfo(E.histogram, 'en').cu.title, 'Count');
  assert.equal(chartInfo({ ...E.box, valueKind: 'days' }, 'en').cu.fmt(30), '30 days'); assert.equal(chartInfo(E.bullet, 'en').cu.unit.key, 'B');
});
console.log(`chart-cartesian tests passed (${n} groups)`);
