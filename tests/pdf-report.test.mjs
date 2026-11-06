// Tests of the printed-report document (src/utils/pdfReport.js): structure, print rules, fonts, parity with the model, safety. Run with `npm run test:pdf`.
// The real PDF files (Arabic + English), their fonts, text, blank pages and numeric parity are verified by scripts/make-report-pdf.mjs (headless Chromium).
import assert from 'node:assert/strict';
import { buildPdfHtml, rich, printCss, fontFaceCss, chartTable, pdfMeta } from '../src/utils/pdfReport.js';
import { tableToText, chartInfo } from '../src/data/reportFormat.js';

let n = 0; const ok = (name, fn) => { fn(); n += 1; };
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// a synthetic model that touches every block type
const rate = (v) => ({ calculable: true, value: v });
function model(lang, extra = {}) {
  const L = (a, e) => (lang === 'ar' ? a : e);
  const T = { count: 389, gross: 14.7e9, exclusions: 3.27e9, cancelled: 1e8, net: 11.44e9, collected: 7.58e9, outstanding: 3.85e9, collectedOverNet: rate(0.663), exclusionRate: rate(0.222) };
  return {
    id: 'rpt-1', title: L('تقرير الإيرادات والتحصيل', 'Revenue and collection report'), subtitle: '2026-01-01 → 2026-10-09', generatedAt: '2026-11-05T10:00:00.000Z', cutoff: '2026-10-09', lang, synthetic: true,
    context: [{ k: 'period', label: L('الفترة', 'Period'), value: '2026-01-01 → 2026-10-09' }, { k: 'amanah', label: L('الأمانة', 'Amanah'), value: L('كل الأمانات', 'All Amanahs') }],
    totals: T, headline: [{ type: 'kpis', unit: { key: 'B' }, items: [{ label: L('إجمالي المفوتر', 'Gross billed'), value: L('14.70 مليار ريال', '14.70 bn SAR'), sub: L('قبل الاستبعادات', 'before exclusions') }, { label: L('نسبة التحصيل', 'Collection rate'), value: '66.3%', sub: '+9.8 pp' }, { label: L('الفواتير', 'Invoices'), value: '389', sub: '' }] }],
    sections: [
      { key: 'executive', title: L('الملخص التنفيذي', 'Executive summary'), purpose: L('أين الوضع الآن؟', 'Where do we stand?'), blocks: [
        { type: 'text', text: L('نسبة التحصيل 66.3%.', 'Collection rate is 66.3%.') },
        { type: 'chart', kind: 'waterfall', title: L('من الإجمالي إلى الصافي', 'From gross to net'), labels: [L('إجمالي', 'Gross'), L('استبعادات', 'Exclusions'), L('صافي', 'Net')], series: [{ label: L('المبلغ', 'Amount'), values: [14.7e9, -3.27e9, 11.44e9] }], totals: [true, false, true], note: L('صافي = إجمالي − استبعادات', 'Net = gross − exclusions') },
        { type: 'chart', kind: 'stacked_hbar', title: L('المحصّل وغير المحصّل', 'Collected and uncollected'), labels: [L('صافي المفوتر', 'Net billed')], series: [{ label: L('المحصّل', 'Collected'), values: [7.58e9] }, { label: L('غير المحصّل', 'Uncollected'), values: [3.85e9] }] },
        { type: 'insights', title: L('أبرز الرؤى', 'Key insights'), items: [{ title: { ar: 'تحسن التحصيل', en: 'Collection improved' }, body: { ar: 'ارتفعت النسبة إلى {x}.', en: 'The rate rose to {x}.' }, tokens: { x: 7.58e9 }, evidence: [{ k: { ar: 'الفرق', en: 'Gap' }, v: 9.8, fmt: 'pp' }], basis: { ar: 'مقارنة', en: 'comparison' }, caveat: { ar: 'تقريبي', en: 'approximate' } }] },
        { type: 'callout', tone: 'warn', text: L('تنبيه: بيانات تجريبية', 'Note: demo data') }] },
      { key: 'tables', title: L('الجداول', 'Tables'), purpose: '', blocks: [
        { type: 'table', id: 't1', title: L('حسب الأمانة', 'By Amanah'), headers: [{ label: L('الأمانة', 'Amanah'), kind: 'text' }, { label: L('صافي المفوتر', 'Net billed'), kind: 'money' }, { label: L('نسبة التحصيل', 'Collection rate'), kind: 'pct' }, { label: L('الفواتير', 'Invoices'), kind: 'count' }], rows: Array.from({ length: 60 }, (_, i) => [`${L('أمانة', 'Amanah')} ${i + 1}`, 1e8 * (i + 2) + 12345, 0.4 + i / 200, 10 + i]), total: [L('الإجمالي', 'Total'), 9e9, 0.66, 3000], note: L('الإجمالي في الآخر.', 'Total is last.') },
        { type: 'chart', kind: 'heatmap', valueKind: 'rate', title: L('الخريطة الحرارية', 'Heat map'), labels: ['A', 'B'], series: [{ label: L('صف 1', 'Row 1'), values: [0.5, null] }, { label: L('صف 2', 'Row 2'), values: [0.25, 0.75] }] },
        { type: 'chart', kind: 'bar', basis: 'monthly', title: L('شهري', 'Monthly'), labels: ['2026-01', '2026-02'], series: [{ label: L('صافي', 'Net'), values: [1e9, 2e9] }] },
        { type: 'relations', totals: T },
        { type: 'list', items: [L('بند أول', 'First item'), L('بند ثان', 'Second item')] }] }
    ],
    ...extra
  };
}

for (const lang of ['ar', 'en']) {
  const m = model(lang); const html = buildPdfHtml(m, { fonts: { 'arabic-400': 'data:font/woff2;base64,AAAA', 'latin-400': 'data:font/woff2;base64,BBBB' } }); const rtl = lang === 'ar';

  ok(`${lang}: document language and direction`, () => {
    assert.ok(html.startsWith('<!doctype html>')); assert.ok(html.includes(`<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}">`)); assert.ok(html.includes('<meta charset="utf-8">'));
    assert.ok(html.includes(`<title>${esc(m.title)}</title>`));
  });
  ok(`${lang}: @page A4 with margins, margin boxes, running header and footer with page X of Y`, () => {
    const css = printCss(m);
    assert.match(css, /@page\{size:A4;margin:[\d.]+mm [\d.]+mm [\d.]+mm [\d.]+mm;/); assert.ok(css.includes('counter(page)') && css.includes('counter(pages)'));
    for (const box of ['@top-', '@bottom-center', '@bottom-']) assert.ok(css.includes(box), box);
    assert.ok(css.includes(m.title)); assert.ok(css.includes(lang === 'ar' ? 'بيانات تجريبية اصطناعية' : 'Synthetic demo data'));
    assert.ok(css.includes(lang === 'ar' ? 'صفحة ' : 'Page ') && css.includes('2026-10-09'), 'cut-off in the footer');
    assert.ok(css.includes(`direction:${rtl ? 'rtl' : 'ltr'}`));
    assert.ok(css.includes('print-color-adjust:exact'));
  });
  ok(`${lang}: repeating table headers and page-break rules`, () => {
    const css = printCss(m); assert.ok(css.includes('thead{display:table-header-group}')); assert.ok(css.includes('tr{break-inside:avoid}'));
    assert.ok(css.includes('break-after:avoid') && css.includes('figure.chart{margin:0;break-inside:avoid}') && css.includes('.kpi{') && css.includes('.insight{'));
    assert.ok(css.includes('table-layout:fixed') && html.includes('<colgroup>'), 'fixed layout with proportional columns'); assert.ok(css.includes('td.n{white-space:nowrap}'), 'numbers never wrap');
    const tables = html.match(/<table /g).length; assert.equal(html.match(/<thead>/g).length, tables, 'every table has a thead'); assert.ok(tables >= 6);
    assert.ok(!/<tfoot/.test(html), 'no tfoot (it would repeat at the foot of every page): the total is a styled last row'); assert.ok(html.includes('class="total"'));
  });
  ok(`${lang}: cover block, KPI grid, headings, charts with data tables`, () => {
    assert.ok(html.includes('<h1>') && html.includes(esc(m.title))); assert.ok(html.includes('class="cover"') && html.includes('class="prov"'));
    for (const s of m.sections) assert.ok(html.includes(`<h2>${esc(s.title)}</h2>`), s.title);
    for (const it of m.headline[0].items) { assert.ok(html.includes(esc(it.label))); assert.ok(html.includes(esc(it.value.split(' ')[0])), it.value); }
    assert.equal(html.match(/<figure class="chart">/g).length, 4); assert.equal(html.match(/<svg /g).length, 4); assert.equal(html.match(/class="chartdata"|chartdata/g).length >= 4, true);
    assert.ok(html.includes(lang === 'ar' ? 'بيانات الرسم' : 'Chart data'));
    assert.ok(html.includes('class="kv"') && html.includes('white-space:nowrap'), 'KPI values never wrap mid-number');
  });
  ok(`${lang}: every table cell, the total row and the notes are present`, () => {
    for (const b of m.sections[1].blocks.filter((x) => x.type === 'table')) {
      const t = tableToText(b, lang); for (const c of [...t.rows.flat(), ...(t.total || [])]) assert.ok(html.includes(esc(c)), `cell ${c}`);
      for (const h of t.headers) assert.ok(html.includes(esc(h)), `header ${h}`); assert.ok(html.includes(esc(b.note)));
      assert.ok(html.includes(esc(t.unitText)), 'the unit is stated');
    }
    for (const x of m.sections[1].blocks.find((b) => b.type === 'list').items) assert.ok(html.includes(esc(x)));
    assert.ok(html.includes('class="callout warn"'));
  });
  ok(`${lang}: chart data tables carry the drawn numbers (heat map as %, missing as —, waterfall signed, stacked totals and shares)`, () => {
    const heat = chartTable(m.sections[1].blocks[1], lang); assert.deepEqual(heat.rows[0].slice(1), ['50.0%', '—']); assert.deepEqual(heat.rows[1].slice(1), ['25.0%', '75.0%']); assert.equal(heat.unitText, '');
    const wf = chartTable(m.sections[0].blocks[1], lang); const { cu } = chartInfo(m.sections[0].blocks[1], lang); assert.equal(wf.rows[1][1], String(cu.tick(-3.27e9))); assert.ok(String(wf.rows[1][1]).includes('3.27'));
    const sb = chartTable(m.sections[0].blocks[2], lang); assert.equal(sb.headers.length, 6); assert.ok(sb.rows[0].includes('66.3%') && sb.rows[0].includes('33.7%'), JSON.stringify(sb.rows[0]));
  });
  ok(`${lang}: relations, insights (tokens filled, evidence, basis, caveat)`, () => {
    assert.ok(html.includes(lang === 'ar' ? 'العلاقات المالية' : 'Financial relationships')); assert.ok(html.includes('66.3%') && html.includes('22.2%'));
    assert.ok(html.includes('class="insight"') && !html.includes('{x}')); assert.ok(html.includes('class="ev"')); assert.ok(html.includes(lang === 'ar' ? 'تحفظ' : 'Caveat'));
  });
  ok(`${lang}: numbers are isolated left-to-right (never reordered inside right-to-left text) and aligned to the column end`, () => {
    assert.ok(html.includes('<td class="n"><bdi dir="ltr">') && html.includes('<th class="n"><bdi dir="ltr">'));
    assert.ok(printCss(m).includes(`th.n,td.n{text-align:${rtl ? 'left' : 'right'};`));
  });
  ok(`${lang}: no external URL anywhere (fonts inline, no CDN); only data URIs`, () => {
    const noNs = html.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '');
    assert.ok(!/https?:\/\//i.test(noNs), 'no http(s) URL'); assert.ok(!/<link\b|<script\b|@import|<img\b|<iframe/i.test(noNs));
    const urls = [...noNs.matchAll(/url\(([^)]*)\)/g)].map((x) => x[1].replace(/"/g, '')).filter((u) => !u.startsWith('#')); /* url(#id): a reference inside the drawing (hatch, clip), not a fetch */ assert.ok(urls.length >= 2); for (const u of urls) assert.ok(u.startsWith('data:font/woff2;base64,'), u);
  });
  ok(`${lang}: fonts: IBM Plex Sans Arabic faces with unicode ranges; the chart text is forced onto the same font`, () => {
    const css = fontFaceCss({ 'arabic-400': 'data:x', 'latin-700': 'data:y' }); assert.equal(css.match(/@font-face/g).length, 2); assert.ok(css.includes("font-family:'IBM Plex Sans Arabic'") && css.includes('font-weight:700') && css.includes('unicode-range:U+0600-06FF'));
    assert.equal(fontFaceCss({}), ''); assert.ok(html.includes(".plot svg text{font-family:'IBM Plex Sans Arabic'"));
    assert.ok(html.includes('tabular-nums'));
  });
  ok(`${lang}: the provenance line is on the document (cover and running header; no closing block, which could orphan onto a page of its own)`, () => {
    const line = lang === 'ar' ? 'بيانات تجريبية اصطناعية' : 'Synthetic demo data'; assert.ok(html.split(line).length - 1 >= 2);
  });
}

ok('Arabic and English documents differ in direction, alignment and margin-box sides', () => {
  const ar = printCss(model('ar')); const en = printCss(model('en'));
  assert.ok(ar.includes('@top-right{content:"تقرير') && en.includes('@top-left{content:"Revenue')); assert.ok(ar.includes('padding-right:15pt') || ar.includes('padding-right'));
});
ok('Arabic text: identifiers and date ranges are isolated left-to-right, range arrows point the reading way; English text is only escaped', () => {
  assert.equal(rich('الفاتورة 177-2200000123 مدفوعة', 'ar'), 'الفاتورة <bdi dir="ltr">177-2200000123</bdi> مدفوعة');
  assert.equal(rich('2026-01-01 → 2026-10-09', 'ar'), '<bdi dir="ltr">2026-01-01</bdi> ← <bdi dir="ltr">2026-10-09</bdi>');
  assert.equal(rich('a<b 177-22 → x', 'en'), 'a&lt;b 177-22 → x'); assert.equal(rich('قطاع-الإسكان', 'ar'), 'قطاع-الإسكان');
  assert.ok(buildPdfHtml(model('ar')).includes('<bdi dir="ltr">2026-01-01</bdi> ← '));
});
ok('model.meta (version, generated, cut-off) drives the footer; absent meta falls back to the model; nothing crashes without either', () => {
  const m = model('ar', { meta: { version: 4, generatedAt: '2026-11-05T09:30:00.000Z', cutoff: '2026-10-01' } }); const css = printCss(m);
  assert.ok(css.includes('الإصدار 4') && css.includes('2026-10-01') && !css.includes('الإصدار 4 ·\u0000')); assert.ok(buildPdfHtml(m).includes('2026-10-01'));
  assert.equal(pdfMeta(model('en')).version, ''); assert.ok(pdfMeta(model('en')).cutoff.includes('2026-10-09'));
  assert.equal(pdfMeta(model('en', { meta: { version: { n: 2 } } })).version, 'Version 2');
  const bare = model('en'); delete bare.generatedAt; delete bare.cutoff; delete bare.context; delete bare.headline; assert.doesNotThrow(() => buildPdfHtml(bare));
  assert.equal(pdfMeta(bare).generated, '');
});
ok('content is escaped (no markup injection from titles, labels or notes); CSS strings are escaped', () => {
  const m = model('en', { title: 'A <script>alert(1)</script></style><b>x</b> "q" \\ end' }); const html = buildPdfHtml(m);
  assert.ok(!html.includes('<script>alert') && html.includes('&lt;script&gt;')); assert.equal(html.match(/<\/style>/g).length, 1, 'a title cannot close the style element'); const css = printCss(m); assert.ok(css.includes('\\"q\\"') && css.includes('\\\\ end'));
});
ok('the on-screen preview bar (print hint + button) exists only when asked and is never printed', () => {
  assert.ok(!buildPdfHtml(model('en')).includes('class="bar"')); const h = buildPdfHtml(model('en'), { toolbar: true });
  assert.ok(h.includes('class="bar"') && h.includes('window.print()') && h.includes('Save as PDF') && h.includes('@media print{.bar{display:none!important}}'));
  assert.ok(buildPdfHtml(model('ar'), { toolbar: true }).includes('حفظ بصيغة PDF'));
});
ok('a chart that cannot be drawn leaves its data table, not a broken document', () => {
  const m = model('en'); m.sections[1].blocks.push({ type: 'chart', kind: 'bar', title: 'Empty', labels: [], series: [] }); const html = buildPdfHtml(m); assert.ok(html.includes('Empty'));
});
ok('the document title is the proposed PDF file name', () => { assert.ok(buildPdfHtml(model('en'), { title: 'Revenue_2026_en' }).includes('<title>Revenue_2026_en</title>')); });

console.log(`pdf-report tests: ${n} passed`);
