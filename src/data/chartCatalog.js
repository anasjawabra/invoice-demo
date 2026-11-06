// The chart-type catalog — PURE (no React). docs/chart-library.md §3.
// Lists every chart family the library draws, with its purpose, names, a short use explanation, what data it needs, how each export renders it and a tiny synthetic preview of its shape;
// and decides — for a given report chart — which types are available, which are not (always with a reason that says what data is missing) and what a switch changes.
import { RENDER, typeIdOf, profileOf, checkType, planConfig, normalizeConfig, patchConfig, resolveType, payloadOf, chartDimensions, applyChartConfig, configChanges, NEEDS_TEXT, langOf, isAdditiveTree, sankeyReconciles, sankeyCheck, treeDepth, waterfallReconciles, histogramCheck, boxDrawable, bulletRows } from './chartConfig';

export { isAdditiveTree, sankeyReconciles, sankeyCheck, treeDepth, waterfallReconciles, histogramCheck, boxDrawable, bulletRows, applyChartConfig, configChanges, normalizeConfig, patchConfig, resolveType, chartDimensions, typeIdOf };

const T = (ar, en) => ({ ar, en });
export const PURPOSES = [
  { id: 'comparison', ar: 'مقارنة', en: 'Comparison' }, { id: 'trend', ar: 'اتجاه', en: 'Trend' }, { id: 'composition', ar: 'تكوين', en: 'Composition' },
  { id: 'distribution', ar: 'توزيع', en: 'Distribution' }, { id: 'relationship', ar: 'علاقة', en: 'Relationship' }
];

/* ------------------------------------------------------------------ synthetic previews (a shape, never the user's data; language-neutral labels, no currency) */
const cats = ['A', 'B', 'C', 'D', 'E']; const mon = ['M1', 'M2', 'M3', 'M4', 'M5'];
const pv = (kind, extra) => ({ type: 'chart', kind, plain: true, title: '', preview: true, ...extra });
const ser = (label, values, more) => ({ label, values, ...(more || {}) });
const PREVIEW = {
  bar: pv('bar', { labels: cats.slice(0, 4), series: [ser('S1', [4, 7, 5, 8]), ser('S2', [3, 5, 6, 4])] }),
  hbar: pv('hbar', { labels: cats.slice(0, 4), series: [ser('S1', [8, 6, 5, 3]), ser('S2', [5, 4, 4, 2])] }),
  stacked_col: pv('stacked_col', { labels: cats.slice(0, 4), series: [ser('S1', [4, 5, 3, 6]), ser('S2', [2, 3, 4, 2]), ser('S3', [1, 2, 1, 2])] }),
  stacked_hbar: pv('stacked_hbar', { labels: cats.slice(0, 4), series: [ser('S1', [6, 5, 4, 3]), ser('S2', [3, 3, 2, 2]), ser('S3', [1, 2, 2, 1])] }),
  stacked100_col: pv('stacked100_col', { labels: cats.slice(0, 4), series: [ser('S1', [4, 5, 3, 6]), ser('S2', [2, 3, 4, 2]), ser('S3', [1, 2, 1, 2])] }),
  stacked100_hbar: pv('stacked100_hbar', { labels: cats.slice(0, 4), series: [ser('S1', [6, 5, 4, 3]), ser('S2', [3, 3, 2, 2]), ser('S3', [1, 2, 2, 1])] }),
  line: pv('line', { labels: mon, series: [ser('S1', [3, 5, 4, 7, 8]), ser('S2', [2, 3, 4, 4, 6])] }),
  line_markers: pv('line', { markers: true, labels: mon, series: [ser('S1', [3, 5, 4, 7, 8]), ser('S2', [2, 3, 4, 4, 6])] }),
  area: pv('area', { labels: mon, series: [ser('S1', [3, 5, 4, 7, 8])] }),
  stacked_area: pv('stacked_area', { labels: mon, series: [ser('S1', [3, 4, 4, 5, 6]), ser('S2', [2, 2, 3, 3, 4])] }),
  combo: pv('combo', { labels: mon, series: [ser('S1', [4, 6, 5, 8, 9], { type: 'bar', axis: 'primary' }), ser('S2', [40, 55, 50, 65, 70], { type: 'line', axis: 'secondary' })], axis2: { title: '%', kind: 'rate' } }),
  waterfall: pv('waterfall', { labels: cats.slice(0, 4), series: [ser('S1', [100, -30, -20, 50])], totals: [true, false, false, true] }),
  pie: pv('pie', { labels: cats.slice(0, 4), series: [ser('S1', [40, 30, 20, 10])] }),
  donut: pv('donut', { labels: cats.slice(0, 4), series: [ser('S1', [40, 30, 20, 10])] }),
  treemap: pv('treemap', { labels: [], series: [], tree: { label: 'T', value: 10, children: [{ label: 'A', value: 4 }, { label: 'B', value: 3 }, { label: 'C', value: 2 }, { label: 'D', value: 1 }] } }),
  sunburst: pv('sunburst', { labels: [], series: [], tree: { label: 'T', value: 10, children: [{ label: 'A', value: 6, children: [{ label: 'A1', value: 4 }, { label: 'A2', value: 2 }] }, { label: 'B', value: 4, children: [{ label: 'B1', value: 3 }, { label: 'B2', value: 1 }] }] } }),
  heatmap: pv('heatmap', { valueKind: 'amount', labels: ['C1', 'C2', 'C3', 'C4'], series: [ser('R1', [1, 3, 5, 2]), ser('R2', [4, 2, 6, 3]), ser('R3', [2, 5, 1, 7])] }),
  scatter: pv('scatter', { labels: [], series: [], points: [{ x: 1, y: 2, label: 'A' }, { x: 2, y: 3.5, label: 'B' }, { x: 3, y: 3, label: 'C' }, { x: 4, y: 5, label: 'D' }, { x: 5, y: 4.5, label: 'E' }, { x: 6, y: 6.5, label: 'F' }], xTitle: 'X', yTitle: 'Y', xKind: 'count', yKind: 'count' }),
  bubble: pv('bubble', { labels: [], series: [], points: [{ x: 1, y: 2, size: 4, label: 'A' }, { x: 2, y: 3.5, size: 8, label: 'B' }, { x: 3, y: 3, size: 3, label: 'C' }, { x: 4, y: 5, size: 9, label: 'D' }, { x: 5, y: 4.5, size: 5, label: 'E' }], xTitle: 'X', yTitle: 'Y', sizeTitle: 'Size', xKind: 'count', yKind: 'count', sizeKind: 'count' }),
  histogram: pv('histogram', { labels: [], series: [], bins: [{ lo: 0, hi: 10, count: 3 }, { lo: 10, hi: 20, count: 8 }, { lo: 20, hi: 30, count: 14 }, { lo: 30, hi: 40, count: 7 }, { lo: 40, hi: 50, count: 2 }], binUnit: 'days', xTitle: 'X' }),
  box: pv('box', { labels: [], series: [], groups: [{ label: 'A', n: 20, min: 2, q1: 4, median: 6, q3: 9, max: 13 }, { label: 'B', n: 20, min: 1, q1: 3, median: 5, q3: 7, max: 10 }, { label: 'C', n: 20, min: 3, q1: 6, median: 8, q3: 11, max: 15 }], valueTitle: 'Value', valueKind: 'days' }),
  pareto: pv('pareto', { labels: cats, series: [ser('S1', [40, 25, 15, 12, 8])] }),
  bullet: pv('bullet', { labels: [], series: [], bullets: [{ label: 'A', actual: 70, target: 90, ranges: [{ to: 60 }, { to: 80 }, { to: 100 }] }, { label: 'B', actual: 95, target: 80, ranges: [{ to: 60 }, { to: 80 }, { to: 100 }] }, { label: 'C', actual: 40, target: 60, ranges: [{ to: 60 }, { to: 80 }, { to: 100 }] }], valueTitle: 'Value' }),
  sankey: pv('sankey', { labels: [], series: [], nodes: [{ id: 'a', label: 'A', col: 0 }, { id: 'b', label: 'B', col: 0 }, { id: 'c', label: 'C', col: 1 }, { id: 'd', label: 'D', col: 2 }, { id: 'e', label: 'E', col: 2 }], links: [{ from: 'a', to: 'c', value: 5 }, { from: 'b', to: 'c', value: 3 }, { from: 'c', to: 'd', value: 6 }, { from: 'c', to: 'e', value: 2 }] })
};

/* ------------------------------------------------------------------ exports: pdf = the same SVG (vector), word = PNG of the SVG + table, pptx = native chart / vector image / table */
const NOTE_VEC = T('يُدرج في العرض كصورة متجهية (SVG مع PNG احتياطي) لأن PowerPoint لا يملك شكلاً أصلياً قابلاً للتحرير لهذا النوع؛ جدول البيانات في الملحق.', 'Placed in the deck as a vector image (SVG with a PNG fallback) because PowerPoint has no editable native form for this type; the data table is in the appendix.');
const NOTE_TBL = T('يُعرض في العرض كجدول أصلي مظلّل (قابل للتحرير) وليس كرسم.', 'Shown in the deck as a native shaded table (editable), not as a chart.');
// the per-kind words of the fallback (same text as PPTX_FALLBACK_NOTE in src/utils/pptxCharts.js — a test keeps them equal)
const NOTES = {
  bullet: T('لا يوجد مخطط رصاصة (Bullet) أصلي في PowerPoint: الرسم صورة متجهية بنطاقاتها وهدفها المعتمد.', 'PowerPoint has no native bullet chart: the drawing is a vector image with its ranges and approved target.'),
  box: T('لا يوجد مخطط صندوقي أصلي في PowerPoint المتوافق: الرسم صورة متجهية.', 'There is no native box plot in compatible PowerPoint: the drawing is a vector image.'),
  treemap: T('خريطة الشجرة ليست نوعاً أصلياً قابلاً للتحرير هنا: الرسم صورة متجهية (وليست مخططاً أعمدة).', 'The treemap is not an editable native type here: the drawing is a vector image (not a bar chart).'),
  sunburst: T('مخطط الشمس المشعة ليس نوعاً أصلياً قابلاً للتحرير هنا: الرسم صورة متجهية.', 'The sunburst is not an editable native type here: the drawing is a vector image.'),
  sankey: T('مخطط ساكي (Sankey) غير متوفر أصلياً في PowerPoint: الرسم صورة متجهية.', 'PowerPoint has no native Sankey: the drawing is a vector image.')
};
const exp = (pptx, id) => ({ pdf: 'vector', word: 'png', pptx, note: pptx === 'vector-image' ? (NOTES[id] || NOTE_VEC) : pptx === 'table' ? NOTE_TBL : null });
// the PPTX column follows what src/utils/pptxCharts.js + pptxDeckPlan.js implement (updated at the end of the chart-library work)
const PPTX_NATIVE = new Set(['bar', 'hbar', 'line', 'line_markers', 'pie', 'donut', 'stacked_col', 'stacked100_col', 'stacked100_hbar', 'stacked_hbar', 'area', 'stacked_area', 'combo', 'pareto', 'histogram', 'scatter', 'bubble', 'waterfall']);
const PPTX_TABLE = new Set(['heatmap']);
const pptxOf = (id) => (PPTX_NATIVE.has(id) ? 'native' : PPTX_TABLE.has(id) ? 'table' : 'vector-image');

/* ------------------------------------------------------------------ the catalog */
const need = (o) => o;
const DEFS = [
  ['bar', 'comparison', false, 'أعمدة', 'Column', 'يقارن قيماً بين فئات؛ يصبح مجمّعاً عند تعدد السلاسل.', 'Compares values across categories; grouped when there are several series.', need({ series: [1, null] })],
  ['hbar', 'comparison', false, 'أشرطة أفقية', 'Horizontal bar', 'الأنسب للأسماء الطويلة وللفئات الكثيرة (مثل الأمانات)؛ مجمّع عند تعدد السلاسل.', 'Best for long names and many categories (such as Amanahs); grouped when there are several series.', need({ series: [1, null] })],
  ['stacked_col', 'composition', false, 'أعمدة مكدّسة', 'Stacked column', 'يعرض أجزاء كلٍّ واحد لكل فئة؛ مثل المحصّل وغير المحصّل.', 'Shows the parts of one whole for each category, such as collected and uncollected.', need({ series: [2, null], additive: true, nonNegative: true })],
  ['stacked_hbar', 'composition', false, 'أشرطة مكدّسة', 'Stacked bar', 'مثل الأعمدة المكدّسة لكن أفقياً للأسماء الطويلة.', 'Like stacked columns but horizontal, for long names.', need({ series: [2, null], additive: true, nonNegative: true })],
  ['stacked100_col', 'composition', true, 'أعمدة مكدّسة ١٠٠٪', '100 % stacked column', 'يقارن تركيب الأجزاء بين الفئات بغضّ النظر عن حجم كل فئة (المبلغ في التلميح).', 'Compares the make-up of each category regardless of its size (the amount stays in the tooltip).', need({ series: [2, null], additive: true, nonNegative: true })],
  ['stacked100_hbar', 'composition', true, 'أشرطة مكدّسة ١٠٠٪', '100 % stacked bar', 'مثل الأعمدة ١٠٠٪ لكن أفقياً.', 'Like the 100 % columns but horizontal.', need({ series: [2, null], additive: true, nonNegative: true })],
  ['line', 'trend', false, 'خطي', 'Line', 'يعرض الاتجاه عبر محور مرتّب (الشهور مثلاً).', 'Shows a trend along an ordered axis (months, for example).', need({ ordered: true, points: 2 })],
  ['line_markers', 'trend', false, 'خطي بعلامات', 'Line with markers', 'خط مع علامة عند كل قيمة، مفيد حين تكون النقاط قليلة.', 'A line with a marker at every value, useful when there are few points.', need({ ordered: true, points: 2 })],
  ['area', 'trend', false, 'مساحة', 'Area', 'اتجاه مع إبراز الحجم الكلي؛ لسلسلة واحدة أو أجزاء كلٍّ واحد.', 'A trend that emphasises overall volume; for one series.', need({ ordered: true, points: 2, nonNegative: true })],
  ['stacked_area', 'composition', false, 'مساحة مكدّسة', 'Stacked area', 'يبيّن كيف يتغيّر تركيب الأجزاء عبر الزمن.', 'Shows how the make-up of the parts changes over time.', need({ ordered: true, additive: true, series: [2, null], nonNegative: true })],
  ['combo', 'comparison', true, 'أعمدة وخط', 'Columns + line', 'أعمدة لمقياس وخط لمقياس آخر (نسبة مثلاً) على محور ثانٍ بعنوانه.', 'Columns for one measure and a line for another (a rate, for example) on a second, labelled axis.', need({ ordered: true, series: [2, null] })],
  ['waterfall', 'composition', false, 'شلال', 'Waterfall', 'جسر من قيمة بداية إلى نهاية عبر خطوات؛ لا يُشتق إلا من مطابقة محفوظة.', 'A bridge from a start to an end value through steps; only from a saved reconciliation.', need({ alts: 'waterfall' })],
  ['pie', 'composition', false, 'دائري', 'Pie', 'حصص أجزاء من إجمالي واحد (حتى ٨ أجزاء، والباقي في «أخرى»).', 'Shares of one total (up to 8 parts, the rest in «Other»).', need({ series: [1, 1], nonNegative: true, partsOfWhole: true })],
  ['donut', 'composition', false, 'حلقي', 'Donut', 'مثل الدائري مع الإجمالي في الوسط.', 'Like the pie, with the total in the centre.', need({ series: [1, 1], nonNegative: true, partsOfWhole: true })],
  ['treemap', 'composition', true, 'خريطة شجرية', 'Treemap', 'مساحة كل مستطيل تتناسب مع قيمته؛ تناسب الفئات الكثيرة أو الهرم.', 'Each rectangle’s area is proportional to its value; fits many categories or a hierarchy.', need({ alts: 'treemap', additive: true })],
  ['sunburst', 'composition', true, 'شمس متعددة المستويات', 'Sunburst', 'هرم من ٢–٣ مستويات (أمانة ← بلدية ← مصدر) بمجاميع متطابقة.', 'A 2–3 level hierarchy (Amanah → municipality → source) with matching totals.', need({ alts: 'sunburst', additive: true })],
  ['heatmap', 'comparison', false, 'خريطة حرارية', 'Heat map', 'مصفوفة صفوف × أعمدة يمثّل اللون قيمتها؛ الفارغ «—» لا بيانات.', 'A rows × columns matrix whose colour carries the value; an empty «—» cell has no data.', need({ alts: 'heatmap' })],
  ['scatter', 'relationship', false, 'نقاط', 'Scatter', 'علاقة بين مقياسين كميين؛ لا تعني سببية.', 'The relationship between two quantitative measures; it does not imply causation.', need({ alts: 'scatter', measures: 2 })],
  ['bubble', 'relationship', true, 'فقاعات', 'Bubble', 'مقياسان على المحورين ومقياس ثالث بحجم الفقاعة؛ لا يعني سببية.', 'Two measures on the axes and a third as bubble size; it does not imply causation.', need({ alts: 'bubble', measures: 3 })],
  ['histogram', 'distribution', true, 'مدرج تكراري', 'Histogram', 'توزيع القيم الفردية في فئات احتواء (المبالغ أو الأيام).', 'The distribution of individual values in bins (amounts or days).', need({ alts: 'histogram' })],
  ['box', 'distribution', true, 'صندوقي', 'Box plot', 'الوسيط والربيعات والمدى لكل مجموعة (٥ ملاحظات على الأقل).', 'Median, quartiles and range for each group (at least 5 observations).', need({ alts: 'box', minObservations: 5 })],
  ['pareto', 'comparison', true, 'باريتو', 'Pareto', 'فئات مرتّبة تنازلياً مع الحصة التراكمية: أين يتركّز المبلغ؟', 'Categories sorted descending with the cumulative share: where is the amount concentrated?', need({ series: [1, 1], nonNegative: true, partsOfWhole: true })],
  ['bullet', 'comparison', true, 'رصاصي', 'Bullet', 'القيمة الفعلية مقابل مستهدف معتمد.', 'The actual value against an approved target.', need({ alts: 'bullet', approvedTargets: true })],
  ['sankey', 'composition', true, 'تدفق (سانكي)', 'Sankey', 'تدفق من مصادر إلى مصبّات بمجاميع متطابقة.', 'A flow from sources to sinks with matching totals.', need({ alts: 'sankey', reconciled: true })]
];

export const CHART_TYPES = DEFS.map(([id, purpose, more, ar, en, useAr, useEn, needs]) => ({
  id, kind: RENDER[id].kind, ...(RENDER[id].markers ? { markers: true } : {}), purpose, more, ar, en, useAr, useEn, needs,
  needsText: NEEDS_TEXT[id] || null, export: exp(pptxOf(id), id), previewSpec: PREVIEW[id]
}));
export const typeById = (id) => CHART_TYPES.find((t) => t.id === id) || null;
export const chartPreview = (id) => typeById(id)?.previewSpec || null;
// the types of one purpose, in catalog order, common ones first when `commonFirst`
export const typesOfPurpose = (purpose, { includeMore = true } = {}) => CHART_TYPES.filter((t) => t.purpose === purpose && (includeMore || !t.more));

/* ------------------------------------------------------------------ evaluation */
const UNEXPECTED = T('تعذّر التحقق من هذا النوع مع هذه البيانات.', 'This type could not be checked against this data.');
// → { ok, reason?, typeId, block, changes:[{key,ar,en}], ignored:[{key,ar,en}] }. `block` is the DISPLAY block (the base block is never changed); when not ok it is the base block as it was.
// `cfg` carries the other knobs (orientation, mode, grouping, cumulative, sort, topN, labels, legend, dimension); `typeId` wins over cfg.kind. opts: { lang, loose }.
export function evaluateChart(block, typeId, cfg = {}, opts = {}) {
  try {
    if (!block || typeof block !== 'object') return { ok: false, reason: UNEXPECTED, typeId, block, changes: [], ignored: [] };
    const r = planConfig(block, { ...(cfg || {}), kind: typeId || cfg?.kind }, opts);
    return { ok: r.ok, ...(r.ok ? {} : { reason: r.reason }), typeId: r.typeId, block: r.block, changes: r.changes, ignored: r.ignored };
  } catch (e) {
    return { ok: false, reason: UNEXPECTED, typeId, block, changes: [], ignored: [] };
  }
}

// the type to suggest first: the one the report builder chose, unless the data says another reads better (many or long-named categories → horizontal bars; a line on an unordered axis → columns; an unreadable pie → horizontal bars)
export function recommendedKind(block, opts = {}) {
  try {
    const p = profileOf(block); const cur = p.current;
    if (p.special || !p.n) return cur;
    let want = cur;
    if (cur === 'bar' && p.ordered !== true && (p.n > 12 || p.maxLabelLen > 16)) want = 'hbar';
    else if (cur === 'line' || cur === 'line_markers') { if (p.ordered === false) want = 'bar'; }
    else if ((cur === 'pie' || cur === 'donut') && p.n > 8) want = 'hbar';
    if (want !== cur && evaluateChart(block, want, {}, opts).ok) return want;
    return cur;
  } catch { return typeIdOf(block || {}); }
}

// the config that reproduces the block as it is (what the picker starts from)
export function defaultConfig(block) {
  const id = typeIdOf(block || {}); const FAMS = { bar: ['v', 'grouped', 'amount'], hbar: ['h', 'grouped', 'amount'], stacked_col: ['v', 'stacked', 'amount'], stacked_hbar: ['h', 'stacked', 'amount'], stacked100_col: ['v', 'stacked', 'share'], stacked100_hbar: ['h', 'stacked', 'share'] };
  const f = FAMS[id] || ['v', 'grouped', 'amount'];
  return { kind: id, orientation: f[0], mode: f[2], grouping: f[1], cumulative: block?.basis === 'cumulative', sort: 'none', topN: null, labels: null, legend: null, dimension: block?.dim?.dimension || null };
}

// → { recommended, available:[{id, changes}], unavailable:[{id, reason:{ar,en}}] } ; every catalog type appears in exactly one list; never throws
export function chartOptions(block, opts = {}) {
  const available = []; const unavailable = [];
  for (const t of CHART_TYPES) {
    const r = evaluateChart(block, t.id, {}, opts);
    if (r.ok) available.push({ id: t.id, changes: r.changes, ...(r.typeId !== t.id ? { typeId: r.typeId } : {}) }); else unavailable.push({ id: t.id, reason: r.reason });
  }
  return { recommended: recommendedKind(block, opts), current: typeIdOf(block || {}), available, unavailable };
}

/* ------------------------------------------------------------------ export plan (the per-model listing is `exportPlan` in reportView.js) */
// → one entry of the export plan for a (displayed) chart block
export function exportEntryFor(b, i = 0) {
  const id = typeIdOf(b); const t = typeById(id); const ex = t ? t.export : exp('vector-image', id);
  return { chartId: b.id || `chart:${i}`, title: b.title || '', kind: b.kind || 'bar', typeId: id, pdf: ex.pdf, word: ex.word, pptx: ex.pptx, note: ex.note };
}
export { profileOf, checkType, payloadOf, langOf };
