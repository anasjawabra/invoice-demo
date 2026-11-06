// Chart presentation config — PURE (no React, no data service). docs/chart-library.md §3–§4.
// A chart is a saved model block; a presentation change (type, orientation, amount ↔ share, grouped ↔ stacked, monthly ↔ cumulative, sort, Top N, labels, legend) is derived
// from that block + a small config and never touches the saved figures. Every transformation is checked: the sums of the displayed data equal the sums of the saved data
// (Top N keeps the remainder in an explicit «Other» row), and a type that does not fit the data is reported as unavailable with a reason instead of being drawn.
//
// This module holds the machinery (profile of a block, type rules, transformations, builders). `chartCatalog.js` adds the type list, the options for the picker and `evaluateChart`.

/* ------------------------------------------------------------------ small helpers */
import { resolveAlt } from './chartAlts';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const T = (ar, en) => ({ ar, en });
const AR_RE = /[؀-ۿ]/;
export const langOf = (block, lang) => (lang === 'ar' || lang === 'en' ? lang : AR_RE.test(`${block?.title || ''}${(block?.labels || []).join('')}`) ? 'ar' : 'en');
const sumOf = (a) => a.reduce((t, v) => (isNum(v) ? t + v : t), 0);
const anyNum = (a) => a.some(isNum);
const nearly = (a, b) => Math.abs(a - b) <= 1e-6 + 1e-9 * Math.max(Math.abs(a), Math.abs(b));

/* ------------------------------------------------------------------ renderer kinds per catalog id */
export const RENDER = {
  bar: { kind: 'bar' }, hbar: { kind: 'hbar' },
  stacked_col: { kind: 'stacked_col' }, stacked_hbar: { kind: 'stacked_hbar' }, stacked100_col: { kind: 'stacked100_col' }, stacked100_hbar: { kind: 'stacked100_hbar' },
  line: { kind: 'line' }, line_markers: { kind: 'line', markers: true }, area: { kind: 'area' }, stacked_area: { kind: 'stacked_area' }, combo: { kind: 'combo' },
  waterfall: { kind: 'waterfall' }, pie: { kind: 'pie' }, donut: { kind: 'donut' }, treemap: { kind: 'treemap' }, sunburst: { kind: 'sunburst' }, heatmap: { kind: 'heatmap' },
  scatter: { kind: 'scatter' }, bubble: { kind: 'bubble' }, histogram: { kind: 'histogram' }, box: { kind: 'box' }, pareto: { kind: 'pareto' }, bullet: { kind: 'bullet' }, sankey: { kind: 'sankey' }
};
export const typeIdOf = (block) => { const k = block?.kind || 'bar'; return k === 'line' && block.markers ? 'line_markers' : k; };
// orientation / grouping / percentage basis of the bar family (the modifiers of the config pick the member of the family)
const FAM = {
  bar: { o: 'v', g: 'grouped', m: 'amount' }, hbar: { o: 'h', g: 'grouped', m: 'amount' },
  stacked_col: { o: 'v', g: 'stacked', m: 'amount' }, stacked_hbar: { o: 'h', g: 'stacked', m: 'amount' },
  stacked100_col: { o: 'v', g: 'stacked', m: 'share' }, stacked100_hbar: { o: 'h', g: 'stacked', m: 'share' }
};
const famId = (o, g, m) => (g === 'stacked' ? (m === 'share' ? (o === 'h' ? 'stacked100_hbar' : 'stacked100_col') : (o === 'h' ? 'stacked_hbar' : 'stacked_col')) : (o === 'h' ? 'hbar' : 'bar'));
const SPECIAL = new Set(['waterfall', 'heatmap', 'treemap', 'sunburst', 'sankey', 'scatter', 'bubble', 'histogram', 'box', 'bullet']);
const CAT_BUILD = new Set(['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar', 'line', 'line_markers', 'area', 'stacked_area', 'combo', 'pie', 'donut', 'pareto']);
const SORTABLE = new Set(['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'stacked100_col', 'stacked100_hbar', 'pie', 'donut', 'pareto', 'treemap']);
const TIME_OK = new Set(['bar', 'hbar', 'stacked_col', 'stacked_hbar', 'line', 'line_markers', 'area', 'stacked_area', 'combo']);
const SHARE_PLAIN = new Set(['bar', 'hbar', 'line', 'line_markers', 'area']);
const PARALLEL = ['keys', 'ids', 'drill', 'keyList', 'tooltips', 'tips']; // arrays aligned with `labels` that must follow a re-ordering
const ALT_IDS = new Set(['scatter', 'bubble', 'histogram', 'box', 'bullet', 'sankey', 'sunburst', 'treemap', 'waterfall']);
const PIE_MAX = 8; // a pie / donut shows at most 8 parts: the smallest are grouped into «Other»

/* ------------------------------------------------------------------ validators (exported, pure) */
const MONTH_RE = /^(?:\d{4}[-/]\d{1,2}|\d{1,2}[-/]\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s*'?\d{2,4})?|q[1-4](?:\s*\d{2,4})?|\d{4}|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)(?:\s+\d{2,4})?$/i;
const BUCKET_RE = /^(?:\d+\s*[–—-]\s*\d+|[<>≥≤]\s*\d+|\d+\s*\+)$/;
export const monthLike = (l) => MONTH_RE.test(String(l ?? '').trim());
export const bucketLike = (l) => BUCKET_RE.test(String(l ?? '').trim());

// A hierarchy is additive when every parent's value equals the sum of its children's (± tol SAR) and every value is finite and non-negative.
export function isAdditiveTree(tree, tol = 0.5) {
  if (!tree || typeof tree !== 'object') return false;
  const walk = (n) => {
    if (!n || !isNum(n.value) || n.value < 0) return false;
    if (Array.isArray(n.children) && n.children.length) {
      let s = 0; for (const c of n.children) { if (!walk(c)) return false; s += c.value; }
      return Math.abs(s - n.value) <= tol;
    }
    return true;
  };
  return walk(tree) && tree.value > 0;
}
export const treeDepth = (tree) => { const d = (n) => (Array.isArray(n?.children) && n.children.length ? 1 + Math.max(...n.children.map(d)) : 0); return tree ? d(tree) : 0; };
export const treeLeaves = (tree) => { const l = (n) => (Array.isArray(n?.children) && n.children.length ? n.children.flatMap(l) : [n]); return tree ? l(tree) : []; };

// → { ok, reason? } : nodes[{id,label,col}], links[{from,to,value}]. Every link joins two known nodes left to right (col increases), values are finite and non-negative, a pair of nodes is linked once
// (no amount appears twice), and every INTERMEDIATE node has inflow = outflow (± tol SAR). At least one source and one sink.
export function sankeyCheck(s, tol = 0.5) {
  const nodes = Array.isArray(s?.nodes) ? s.nodes : []; const links = Array.isArray(s?.links) ? s.links : [];
  if (nodes.length < 3 || links.length < 2) return { ok: false, reason: T('التدفق يحتاج ثلاث عُقد وربطين على الأقل.', 'A flow needs at least three nodes and two links.') };
  const col = new Map(); for (const n of nodes) { if (n == null || n.id == null || col.has(n.id)) return { ok: false, reason: T('معرّفات عُقد التدفق مكررة أو ناقصة.', 'The flow nodes have duplicate or missing ids.') }; col.set(n.id, n.col); }
  const inn = new Map(); const out = new Map(); const seen = new Set();
  for (const l of links) {
    if (!col.has(l.from) || !col.has(l.to)) return { ok: false, reason: T('ربط يشير إلى عقدة غير موجودة.', 'A link points to a node that does not exist.') };
    if (!isNum(l.value) || l.value < 0) return { ok: false, reason: T('قيمة ربط غير صالحة (سالبة أو غير رقمية).', 'A link value is invalid (negative or not a number).') };
    if (!(col.get(l.to) > col.get(l.from))) return { ok: false, reason: T('الربط لا يتجه من اليسار إلى اليمين (دورة أو عقدتان في العمود نفسه).', 'A link does not go left to right (a cycle, or two nodes in the same column).') };
    const k = `${l.from}>${l.to}`; if (seen.has(k)) return { ok: false, reason: T('المبلغ نفسه يظهر مرتين بين عقدتين.', 'The same amount appears twice between two nodes.') }; seen.add(k);
    out.set(l.from, (out.get(l.from) || 0) + l.value); inn.set(l.to, (inn.get(l.to) || 0) + l.value);
  }
  let sources = 0; let sinks = 0;
  for (const n of nodes) {
    const i = inn.get(n.id) || 0; const o = out.get(n.id) || 0; const hasIn = inn.has(n.id); const hasOut = out.has(n.id);
    if (!hasIn && !hasOut) return { ok: false, reason: T('عقدة بلا أي ربط.', 'A node has no link.') };
    if (!hasIn) sources += 1; else if (!hasOut) sinks += 1;
    else if (Math.abs(i - o) > tol) return { ok: false, reason: T(`عقدة وسيطة لا يتطابق وارده مع صادره (${Math.round(i)} ≠ ${Math.round(o)}).`, `An intermediate node does not balance: inflow ${Math.round(i)} ≠ outflow ${Math.round(o)}.`) };
  }
  if (!sources || !sinks) return { ok: false, reason: T('التدفق بلا مصدر أو بلا مصبّ.', 'The flow has no source or no sink.') };
  return { ok: true };
}
export const sankeyReconciles = (s, tol = 0.5) => sankeyCheck(s, tol).ok;

// waterfall payload (`series[0].values` + `totals`): first total + steps = last total (± tol)
export function waterfallReconciles(b, tol = 0.5) {
  const v = b?.series?.[0]?.values; if (!Array.isArray(v) || v.length < 3 || !v.every(isNum)) return false;
  const tot = Array.isArray(b.totals) ? b.totals : v.map((_, i) => i === 0 || i === v.length - 1);
  let run = 0; let ok = true;
  v.forEach((x, i) => { if (tot[i]) { if (i > 0 && Math.abs(run - x) > tol) ok = false; run = x; } else run += x; });
  return ok && tot.some(Boolean);
}
export function histogramCheck(h) {
  const bins = h?.bins; if (!Array.isArray(bins) || bins.length < 2) return false;
  let prev = -Infinity; let total = 0;
  for (const b of bins) { if (!isNum(b.lo) || !isNum(b.hi) || !(b.hi >= b.lo) || !isNum(b.count) || b.count < 0 || b.lo < prev - 1e-9) return false; prev = b.hi; total += b.count; }
  return total > 0;
}
// → number of groups with n >= 5 whose statistics are ordered (the only ones a box plot draws)
export function boxDrawable(bx) {
  const g = Array.isArray(bx?.groups) ? bx.groups : [];
  return g.filter((x) => x && x.n >= 5 && [x.min, x.q1, x.median, x.q3, x.max].every(isNum) && x.min <= x.q1 && x.q1 <= x.median && x.median <= x.q3 && x.q3 <= x.max).length;
}
export const bulletRows = (b) => (Array.isArray(b?.bullets) ? b.bullets.filter((r) => r && isNum(r.actual) && isNum(r.target) && r.target >= 0) : []);
const pointsOk = (pl, needSize) => Array.isArray(pl?.points) && pl.points.filter((p) => isNum(p.x) && isNum(p.y) && (!needSize || (isNum(p.size) && p.size >= 0))).length >= 3;

/* ------------------------------------------------------------------ the profile of a block: the facts every rule reads */
export function profileOf(block) {
  const kind = block?.kind || 'bar'; const labels = Array.isArray(block?.labels) ? block.labels : []; const series = Array.isArray(block?.series) ? block.series : [];
  const n = labels.length; const m = series.length; const dim = block?.dim && typeof block.dim === 'object' ? block.dim : null;
  const vals = series.map((s) => Array.from({ length: n }, (_, i) => (s && Array.isArray(s.values) ? s.values[i] : null)));
  const flat = vals.flat(); const dflt = block?.plain ? 'plain' : block?.valueKind === 'rate' ? 'rate' : 'amount'; const dm = Array.isArray(dim?.measures) ? dim.measures : null;
  const mk = series.map((_, i) => (dm && (dm[i] || (dm.length === 1 ? dm[0] : null)))?.kind || dflt);
  const seriesBy = dim?.seriesBy === 'dimension' ? 'dimension' : 'measure';
  const cumulative = block?.basis === 'cumulative'; const monthly = block?.basis === 'monthly' || (dim?.dimension === 'month' && !cumulative);
  let ordered = typeof dim?.ordered === 'boolean' ? dim.ordered : null;
  if (ordered === null) {
    if (block?.basis === 'monthly' || cumulative || ['line', 'area', 'stacked_area'].includes(kind) || ['month', 'aging'].includes(dim?.dimension)) ordered = true;
    else if (n > 0 && (labels.every(monthLike) || labels.every(bucketLike))) ordered = true;
  }
  const stackedKind = /^stacked/.test(kind);
  const additive = dim?.additive === true ? true : dim?.additive === false ? false : stackedKind ? true : (m >= 2 && series.every((s) => ['collected', 'uncollected'].includes(s?.role)) && new Set(series.map((s) => s.role)).size === m) ? true : false;
  const summable = m > 0 && mk.every((k) => k === 'amount' || k === 'count');
  const uniform = new Set(mk).size <= 1;
  const partsOfWhole = typeof dim?.partsOfWhole === 'boolean' ? dim.partsOfWhole : (m === 1 && summable && !cumulative ? (dim ? true : null) : false);
  return {
    kind, current: typeIdOf(block || {}), special: SPECIAL.has(kind), n, m, labels, series, vals, mk, uniform, summable, seriesBy, cumulative, monthly, ordered, additive, partsOfWhole,
    hasNull: flat.some((v) => !isNum(v)), anyValue: flat.some(isNum), negative: flat.some((v) => isNum(v) && v < 0), allZero: flat.every((v) => !isNum(v) || v === 0),
    maxLabelLen: labels.reduce((t, l) => Math.max(t, String(l ?? '').length), 0), whole: isNum(dim?.whole?.value) ? dim.whole : null, loose: false
  };
}

/* ------------------------------------------------------------------ alternative payloads (alts) */
// the saved companion payload of a type, read through resolveAlt (chartAlts.js: a payload may `inherit` a sibling's data), or the block itself when it already is that kind
export function payloadOf(block, id) {
  const alt = (k) => resolveAlt(block, k); const own = (k) => (block?.kind === k ? block : null); const treeOwn = block?.tree && ['treemap', 'sunburst'].includes(block.kind) ? block : null;
  switch (id) {
    case 'treemap': return alt('treemap') || alt('sunburst') || treeOwn;
    case 'sunburst': return alt('sunburst') || alt('treemap') || treeOwn;
    case 'scatter': return alt('scatter') || alt('bubble') || own('scatter') || own('bubble');
    case 'bubble': return alt('bubble') || own('bubble');
    case 'sankey': case 'histogram': case 'box': case 'bullet': case 'waterfall': case 'heatmap': return alt(id) || own(id);
    default: return null;
  }
}

/* ------------------------------------------------------------------ the rules: which type fits which data (null = fits, otherwise the reason) */
const R = {
  unknown: T('نوع رسم غير معروف.', 'Unknown chart type.'),
  noData: T('لا توجد قيم لرسمها.', 'There are no values to draw.'),
  waterfall: T('الشلال مطابقة حسابية (من البداية إلى النهاية) فلا يُحوَّل إلى نوع آخر؛ استخدم «عرض الجدول».', 'A waterfall is a reconciliation (start to end), so it is never converted to another type; use “View data table”.'),
  heatmap: T('الخريطة الحرارية مصفوفة (صفوف × أعمدة) تفقد معناها بأي شكل آخر.', 'A heat map is a matrix (rows × columns) and loses its meaning in any other shape.'),
  special: T('بيانات هذا الرسم ليست فئات وسلاسل فلا يمكن إعادة رسمها بنوع آخر؛ استخدم «عرض الجدول».', 'This chart’s data is not categories × series, so it cannot be redrawn as another type; use “View data table”.'),
  units: T('السلاسل بوحدات مختلفة (مبلغ بجانب نسبة أو عدد) ولا تتشارك محوراً واحداً؛ استخدم الجمع (أعمدة + خط).', 'The series use different units (an amount next to a rate or a count) and cannot share one axis; use the combo chart (columns + line).'),
  unordered: T('لا ترتيب مفيداً لهذا المحور (فئات مثل الأمانات ليست تسلسلاً زمنياً ولا مقياساً)، والخط أو المساحة توحي باتجاه غير موجود.', 'This axis has no meaningful order (categories such as Amanahs are not a time sequence or a scale), so a line or area would imply a trend that does not exist.'),
  onePoint: T('الاتجاه يحتاج نقطتين على الأقل؛ توجد نقطة واحدة.', 'A trend needs at least two points; there is only one.'),
  nonAdditive: T('السلاسل ليست أجزاءً متنافية من كلٍّ واحد (صافي المفوتر والمحصّل يتداخلان مثلاً) فتكديسها يكرّر الحساب؛ المحصّل + غير المحصّل يصحّان.', 'The series are not non-overlapping parts of one whole (net billed and collected overlap, for example), so stacking them would double count; collected + uncollected would be fine.'),
  twoSeries: T('يحتاج إلى سلسلتين أو أكثر.', 'Needs two or more series.'),
  nulls: T('توجد قيم مفقودة (والمفقود ليس صفراً)؛ هذا النوع كان سيخفيها أو يرسمها صفراً.', 'Some values are missing (and missing is not zero); this type would hide them or draw them as zero.'),
  negatives: T('توجد قيم سالبة؛ هذا النوع يفترض أجزاءً غير سالبة.', 'There are negative values; this type assumes non-negative parts.'),
  zeroTotal: T('المجموع صفر فلا توجد حصص لرسمها.', 'The total is zero, so there are no shares to draw.'),
  zeroCategory: T('لبعض الفئات مجموع صفري فلا حصة لها.', 'Some categories have a zero total, so they have no share.'),
  rateParts: T('النسب والمتوسطات ليست أجزاءً من إجمالي.', 'Rates and averages are not parts of a total.'),
  pieSeries: T('الدائري يعرض مقياساً واحداً. هذه سلاسل بمقاييس مختلفة وليست أجزاء كلٍّ واحد (اختر سلسلة واحدة أو استخدم أعمدة).', 'A pie shows one measure. These are several different measures, not parts of one whole (use one series, or bars).'),
  pieMany: T('أجزاء متعددة الفئات والسلاسل معاً لا تصلح دائرياً.', 'Parts that vary by both category and series cannot be shown as one pie.'),
  pieNotWhole: T('لم يُصرَّح بأن الفئات أجزاء من كلٍّ واحد (لا وصف للبعد في الرسم).', 'It is not stated that the categories are parts of one whole (this chart has no dimension description).'),
  pieCumulative: T('القيم تراكمية (مجاميع جارية) وليست أجزاءً من إجمالي.', 'The values are cumulative (running totals), not parts of a total.'),
  fewParts: T('يحتاج إلى جزأين على الأقل.', 'Needs at least two parts.'),
  partsExceed: T('مجموع الأجزاء يتجاوز الإجمالي المصرّح به.', 'The parts add up to more than the stated total.'),
  cumulativeShape: T('القيم تراكمية (مجاميع جارية): التكديس أو الحصص عليها يضلّل.', 'The values are running totals; stacking or sharing them would mislead.')
};
const NEEDS = {
  scatter: T('يحتاج إلى مقياسين كميين لكل فئة (سلسلتان) أو نقاطاً محفوظة في التقرير؛ ولا يتوفر ذلك هنا.', 'Needs two quantitative measures per category (two series) or points saved in the report; neither is available here.'),
  bubble: T('يحتاج إلى مقياسين وحجم لكل فئة (ثلاث سلاسل) أو نقاطاً بحجم محفوظة في التقرير؛ ولا يتوفر ذلك هنا.', 'Needs two measures and a size measure per category (three series) or sized points saved in the report; neither is available here.'),
  histogram: T('يحتاج إلى توزيع القيم الفردية (فئات الاحتواء) ولم يُحفظ في هذا التقرير؛ أنشئ نسخة جديدة منه.', 'Needs the distribution of the individual observations (bins), which this report did not save; build a new report version.'),
  box: T('يحتاج إلى إحصاءات التوزيع (٥ ملاحظات على الأقل في مجموعة) ولم تُحفظ في هذا التقرير.', 'Needs distribution statistics with at least 5 observations in a group, which this report did not save.'),
  sankey: T('يحتاج إلى تدفقات محفوظة ومتطابقة (الوارد = الصادر لكل عقدة وسيطة) ولا يتوفر ذلك في هذا التقرير.', 'Needs saved flows that reconcile (inflow = outflow at every intermediate node); this report has none.'),
  sunburst: T('يحتاج إلى هرم إضافي (مجموع الأبناء = الأب) بمستويين أو ثلاثة ولم يُحفظ في هذا التقرير.', 'Needs an additive hierarchy (children add up to the parent) with 2–3 levels, which this report did not save.'),
  treemap: T('يحتاج إلى سلسلة واحدة غير سالبة بأجزاء من كلٍّ واحد، أو هرماً إضافياً محفوظاً.', 'Needs one non-negative series of parts of one whole, or a saved additive hierarchy.'),
  bullet: T('لا يوجد مستهدف معتمد: الرسم الرصاصي يحتاج مستهدفاً معتمداً (مستهدفات التخطيط) ولا يُخترع مستهدف.', 'No approved target: a bullet chart needs an approved target (planning targets), and a target is never invented.'),
  waterfall: T('الشلال يُبنى من مطابقة حسابية محفوظة في التقرير ولا يُشتق من أعمدة.', 'A waterfall comes from a reconciliation saved in the report; it is not derived from bars.'),
  heatmap: T('يحتاج إلى مقياس واحد عبر بُعدين (السلاسل فئات بعد ثانٍ) أو مصفوفة محفوظة في التقرير؛ ولا يتوفر ذلك هنا.', 'Needs one measure across two dimensions (the series are categories of a second dimension) or a matrix saved in the report; neither is available here.'),
  pareto: T('يحتاج إلى سلسلة واحدة غير سالبة من ٣ فئات فأكثر بقيم تُجمع.', 'Needs one non-negative series of 3 or more categories whose values add up.')
};
export const NEEDS_TEXT = NEEDS;

const catGate = (p) => { if (p.special) return p.kind === 'waterfall' ? R.waterfall : p.kind === 'heatmap' ? R.heatmap : R.special; if (!p.n || !p.m || !p.anyValue) return R.noData; return null; };
const isOrdered = (p) => p.ordered === true || (p.loose && p.ordered === null);
const isParts = (p) => p.partsOfWhole === true || (p.loose && p.partsOfWhole === null);
const stackGate = (p) => catGate(p) || (p.m < 2 ? R.twoSeries : !p.additive ? R.nonAdditive : p.cumulative ? R.cumulativeShape : p.hasNull ? R.nulls : p.negative ? R.negatives : !p.uniform || !p.summable ? R.units : null);
const share100 = (p) => stackGate(p) || (p.vals[0].some((_, i) => sumOf(p.vals.map((v) => v[i])) <= 0) ? R.zeroCategory : null);
const lineGate = (p) => catGate(p) || (!p.uniform ? R.units : !isOrdered(p) ? R.unordered : p.n < 2 || !p.vals.some((v) => v.filter(isNum).length >= 2) ? R.onePoint : null);
const areaGate = (p) => lineGate(p) || (p.hasNull ? R.nulls : p.negative ? R.negatives : p.m >= 2 && !p.additive ? T('المساحات المتراكبة تخفي بعضها؛ استخدم الخطوط، أو المساحة المكدّسة إن كانت السلاسل أجزاء من كلٍّ واحد.', 'Overlapping areas hide each other; use lines, or a stacked area if the series are parts of one whole.') : null);
function pieParts(b, p) {
  if (p.m === 1) return { labels: b.labels.slice(0, p.n), values: p.vals[0].slice(), transposed: false };
  if (p.additive && p.n === 1) return { labels: b.series.map((s) => String(s.label ?? '')), values: p.vals.map((v) => v[0]), transposed: true };
  return null;
}
function pieGate(b, p) {
  const g = catGate(p); if (g) return g;
  if (p.m > 1) { if (!(p.additive && p.n === 1)) return p.additive ? R.pieMany : R.pieSeries; if (!p.uniform || !p.summable) return R.units; } else {
    if (p.cumulative) return R.pieCumulative; if (!p.summable) return R.rateParts; if (!isParts(p)) return R.pieNotWhole;
  }
  const parts = pieParts(b, p); if (!parts) return R.pieSeries;
  if (parts.values.some((v) => !isNum(v))) return R.nulls; if (parts.values.some((v) => v < 0)) return R.negatives;
  const total = sumOf(parts.values); if (!(total > 0)) return R.zeroTotal; if (parts.values.length < 2) return R.fewParts;
  if (p.whole && p.whole.value + 0.5 < total) return R.partsExceed;
  return null;
}
function paretoGate(b, p) {
  const g = catGate(p); if (g) return g;
  if (p.m !== 1 || p.n < 3 || !p.summable || p.cumulative || !isParts(p)) return NEEDS.pareto;
  if (p.hasNull) return R.nulls; if (p.negative) return R.negatives; if (!(sumOf(p.vals[0]) > 0)) return R.zeroTotal; return null;
}
const heatGate = (b, p) => {
  const pl = payloadOf(b, 'heatmap'); if (pl && Array.isArray(pl.series) && pl.series.length >= 2 && Array.isArray(pl.labels) && pl.labels.length >= 2) return null;
  if (p.special) return p.kind === 'waterfall' ? R.waterfall : R.special;
  if (p.m < 2 || p.n < 2 || !p.anyValue || p.seriesBy !== 'dimension' || !p.uniform || !['amount', 'rate'].includes(p.mk[0]) || p.negative || p.cumulative) return NEEDS.heatmap;
  return null;
};
function scatterGate(b, p, needSize) {
  const pl = payloadOf(b, needSize ? 'bubble' : 'scatter'); if (pl && pointsOk(pl, needSize)) return null;
  if (p.special || p.m < (needSize ? 3 : 2) || p.seriesBy === 'dimension' || p.cumulative) return needSize ? NEEDS.bubble : NEEDS.scatter;
  const [x, y, s] = p.vals; if (needSize && s.some((v) => isNum(v) && v < 0)) return T('حجم الفقاعة لا يكون سالباً.', 'A bubble size cannot be negative.');
  const pairs = x.filter((v, i) => isNum(v) && isNum(y[i]) && (!needSize || (isNum(s[i]) && s[i] >= 0))).length;
  return pairs >= 3 ? null : (needSize ? NEEDS.bubble : NEEDS.scatter);
}
const treeGate = (b, id, p) => {
  const pl = payloadOf(b, id);
  if (id === 'sunburst') { if (!pl || !isAdditiveTree(pl.tree)) return NEEDS.sunburst; const d = treeDepth(pl.tree); return d >= 2 && d <= 3 ? null : NEEDS.sunburst; }
  if (pl && isAdditiveTree(pl.tree)) return null;
  if (catGate(p) || p.m !== 1 || p.n < 2 || p.hasNull || p.negative || p.cumulative || !p.summable || !isParts(p) || !(sumOf(p.vals[0]) > 0)) return NEEDS.treemap;
  return null;
};
const comboGate = (p) => catGate(p) || (p.m < 2 ? R.twoSeries : !isOrdered(p) ? R.unordered : p.n < 2 ? R.onePoint : new Set(p.mk).size > 2 ? T('أكثر من وحدتين مختلفتين لا تتسع لمحورين.', 'More than two different units do not fit two axes.') : null);

const RULES = {
  bar: (b, p) => catGate(p) || (!p.uniform ? R.units : null),
  hbar: (b, p) => catGate(p) || (!p.uniform ? R.units : null),
  stacked_col: (b, p) => stackGate(p), stacked_hbar: (b, p) => stackGate(p), stacked100_col: (b, p) => share100(p), stacked100_hbar: (b, p) => share100(p),
  line: (b, p) => lineGate(p), line_markers: (b, p) => lineGate(p), area: (b, p) => areaGate(p),
  stacked_area: (b, p) => stackGate(p) || (!isOrdered(p) ? R.unordered : p.n < 2 ? R.onePoint : null),
  combo: (b, p) => comboGate(p),
  waterfall: (b) => { const pl = payloadOf(b, 'waterfall'); return pl && waterfallReconciles(pl) ? null : NEEDS.waterfall; },
  pie: (b, p) => pieGate(b, p), donut: (b, p) => pieGate(b, p),
  treemap: (b, p) => treeGate(b, 'treemap', p), sunburst: (b, p) => treeGate(b, 'sunburst', p),
  heatmap: (b, p) => heatGate(b, p),
  scatter: (b, p) => scatterGate(b, p, false), bubble: (b, p) => scatterGate(b, p, true),
  histogram: (b) => { const pl = payloadOf(b, 'histogram'); return pl && histogramCheck(pl) ? null : NEEDS.histogram; },
  box: (b) => { const pl = payloadOf(b, 'box'); return pl && boxDrawable(pl) >= 1 ? null : NEEDS.box; },
  pareto: (b, p) => paretoGate(b, p),
  bullet: (b) => { const pl = payloadOf(b, 'bullet'); return pl && pl.targetApproved !== false && bulletRows(pl).length >= 1 ? null : NEEDS.bullet; },
  sankey: (b) => { const pl = payloadOf(b, 'sankey'); if (!pl) return NEEDS.sankey; const c = sankeyCheck(pl); return c.ok ? null : T(`التدفقات لا تتطابق: ${c.reason.ar}`, `The flows do not reconcile: ${c.reason.en}`); }
};
// → null when `id` fits `block`, otherwise {ar,en}. `o.loose` (the legacy global chart-type command): an undeclared order / undeclared parts-of-a-whole is given the benefit of the doubt.
export function checkType(block, id, p, o = {}) {
  if (!RENDER[id]) return R.unknown;
  const pr = p || profileOf(block); pr.loose = !!o.loose;
  if (id === pr.current) return null;
  const why = (RULES[id] ? RULES[id](block, pr) : R.unknown) || null;
  const note = block?.altsNotes?.[id]; // the report builder's own words for «not offered» (no approved target, fewer than 3 entities…)
  return why && note && typeof note.ar === 'string' && typeof note.en === 'string' && ALT_IDS.has(id) ? note : why;
}

/* ------------------------------------------------------------------ config */
export const CONFIG_KEYS = ['kind', 'orientation', 'mode', 'grouping', 'cumulative', 'sort', 'topN', 'labels', 'legend', 'dimension'];
// a config with only its valid explicit keys (anything else is dropped); null / undefined mean «not set»
export function normalizeConfig(cfg) {
  const c = {}; const x = cfg && typeof cfg === 'object' ? cfg : {};
  if (typeof x.kind === 'string' && x.kind) c.kind = x.kind;
  if (x.orientation === 'v' || x.orientation === 'h') c.orientation = x.orientation;
  if (x.mode === 'amount' || x.mode === 'share') c.mode = x.mode;
  if (x.grouping === 'grouped' || x.grouping === 'stacked') c.grouping = x.grouping;
  if (typeof x.cumulative === 'boolean') c.cumulative = x.cumulative;
  if (['none', 'desc', 'asc', 'label'].includes(x.sort)) c.sort = x.sort;
  if (isNum(x.topN) && x.topN >= 1) c.topN = Math.floor(x.topN);
  if (typeof x.labels === 'boolean') c.labels = x.labels;
  if (typeof x.legend === 'boolean') c.legend = x.legend;
  if (typeof x.dimension === 'string' && x.dimension) c.dimension = x.dimension;
  return c;
}
// the type id a config resolves to: kind + the bar-family modifiers
export function resolveType(cfg, block) {
  const kind = cfg.kind || typeIdOf(block); const a = FAM[kind]; if (!a) return kind;
  return famId(cfg.orientation || a.o, cfg.grouping || a.g, cfg.mode || a.m);
}
// merge a patch into a config; changing the kind resets the modifiers that came from the previous kind (the new kind brings its own orientation / grouping / basis)
export function patchConfig(cfg, patch) {
  const base = normalizeConfig(cfg); const p = normalizeConfig(patch); const out = { ...base, ...p };
  if (p.kind && p.kind !== base.kind) ['orientation', 'grouping', 'mode'].forEach((k) => { if (!(k in p)) delete out[k]; });
  return out;
}

/* ------------------------------------------------------------------ transformations (pure; each returns a new block) */
const copy = (b) => ({ ...b, labels: [...(b.labels || [])], series: (b.series || []).map((s) => ({ ...s, values: [...(s.values || [])] })) });
function permute(b, order) {
  const out = { ...b, labels: order.map((i) => b.labels[i]), series: b.series.map((s) => ({ ...s, values: order.map((i) => (s.values ? s.values[i] ?? null : null)) })) };
  for (const k of PARALLEL) if (Array.isArray(b[k]) && b[k].length === b.labels.length) out[k] = order.map((i) => b[k][i]);
  return out;
}
const rowKey = (b, p) => b.labels.map((_, i) => (p.additive ? (anyNum(p.vals.map((v) => v[i])) ? sumOf(p.vals.map((v) => v[i])) : -Infinity) : (isNum(p.vals[0]?.[i]) ? p.vals[0][i] : -Infinity)));
export function sortRows(b, mode, p, lang) {
  if (!mode || mode === 'none') return b;
  const key = rowKey(b, p); const idx = b.labels.map((_, i) => i);
  if (mode === 'label') idx.sort((x, y) => String(b.labels[x]).localeCompare(String(b.labels[y]), lang === 'ar' ? 'ar' : 'en') || x - y);
  else idx.sort((x, y) => (mode === 'asc' ? key[x] - key[y] : key[y] - key[x]) || x - y);
  if (b.otherIndex != null && b.otherIndex >= 0) { const k = idx.indexOf(b.otherIndex); idx.splice(k, 1); idx.push(b.otherIndex); const out = permute(b, idx); out.otherIndex = idx.length - 1; return out; } // the «Other» row stays last
  return permute(b, idx);
}
const otherLabelOf = (k, lang) => (lang === 'ar' ? `أخرى (${k})` : `Other (${k})`);
// keep the `keep` largest rows (by the rule's key, descending), fold the rest into ONE explicit «Other» row (summed per series; null only when every folded value is missing).
export function foldTopN(b, keep, p, lang) {
  const prior = b.otherIndex != null && b.otherIndex >= 0 ? { index: b.otherIndex, count: b.otherCount || 1 } : null;
  const key = rowKey(b, p); const idx = b.labels.map((_, i) => i).filter((i) => !prior || i !== prior.index);
  idx.sort((x, y) => key[y] - key[x] || x - y);
  const kept = idx.slice(0, keep); const folded = idx.slice(keep); const rest = folded.concat(prior ? [prior.index] : []);
  const base = permute(b, kept); delete base.otherIndex; delete base.otherCount; delete base.otherLabel;
  if (!rest.length) return base;
  const count = folded.length + (prior ? prior.count : 0); const label = otherLabelOf(count, lang);
  const out = { ...base, labels: [...base.labels, label] };
  out.series = base.series.map((s, j) => { const vs = rest.map((i) => b.series[j].values[i]); return { ...s, values: [...s.values, anyNum(vs) ? sumOf(vs) : null] }; });
  for (const k of PARALLEL) if (Array.isArray(out[k])) out[k] = [...out[k], null];
  out.otherIndex = out.labels.length - 1; out.otherCount = count; out.otherLabel = label;
  return out;
}
const canCumulate = (p) => p.monthly && !p.cumulative && p.summable && p.n >= 2 && p.vals.every((v) => { const last = v.reduce((t, x, i) => (isNum(x) ? i : t), -1); return v.slice(0, last + 1).every(isNum); });
export function cumulate(b, lang) {
  const out = copy(b);
  out.series = out.series.map((s) => { let run = 0; const vs = s.values.map((x) => { if (!isNum(x)) return null; run += x; return run; }); return { ...s, values: vs };
  });
  out.basis = 'cumulative';
  if (b.title && !/تراكمي|cumulative/i.test(b.title)) out.title = `${b.title}${lang === 'ar' ? ' — تراكمي' : ' — cumulative'}`;
  return out;
}
const SHARE_TITLE = T('الحصة من إجمالي السلسلة (%)', 'Share of the series total (%)');
export function toShare(b, lang) {
  const out = copy(b);
  out.series = out.series.map((s) => { const t = sumOf(s.values); return { ...s, values: s.values.map((x) => (isNum(x) && t > 0 ? (x / t) * 100 : null)) }; });
  out.plain = true; out.valueTitle = SHARE_TITLE[lang]; out.shareOf = 'series-total';
  return out;
}
const seriesSums = (b) => (b.series || []).map((s) => sumOf(s.values || []));
const sumsEqual = (a, b) => a.length === b.length && a.every((x, i) => nearly(x, b[i]));

/* ------------------------------------------------------------------ builders: the display block of a type */
const stripFor = (b) => { const { type, id, title, note, dim, alts, config, showLabels, showLegend } = b; return { type: type || 'chart', ...(id != null ? { id } : {}), title, ...(note ? { note } : {}), ...(dim ? { dim } : {}), ...(alts ? { alts } : {}), ...(config ? { config } : {}), ...(showLabels != null ? { showLabels } : {}), ...(showLegend != null ? { showLegend } : {}) }; };
const withKind = (b, id) => { const out = { ...b, kind: RENDER[id].kind }; if (RENDER[id].markers) out.markers = true; else delete out.markers; return out; };
function fromPayload(b, id, pl) {
  const { type: _t, id: _i, alts: _a, config: _c, ...rest } = pl;
  const out = { ...stripFor(b), ...rest, kind: RENDER[id].kind, labels: pl.labels || [], series: pl.series || [] };
  if (b.title && !pl.title) out.title = b.title;
  return out;
}
const R4 = (x) => Number(x.toFixed(6));
function buildPie(work, id, p, lang) {
  const parts = pieParts(work, profileOf(work)); const total = sumOf(parts.values);
  let { labels, values } = parts; let extraAdded = false; const w = p.whole;
  if (w && w.value - total > 0.5) { labels = [...labels, lang === 'ar' ? 'أخرى (باقي الإجمالي)' : 'Other (rest of total)']; values = [...values, R4(w.value - total)]; extraAdded = true; }
  let out = { ...work, labels, series: [{ ...(work.series[0] || {}), label: parts.transposed ? String(work.labels[0] ?? '') : (work.series[0]?.label ?? ''), values }] };
  delete out.dashed; delete out.otherIndex; delete out.otherCount; delete out.otherLabel;
  if (extraAdded) { out.otherIndex = labels.length - 1; out.otherLabel = labels[labels.length - 1]; out.otherCount = 1; }
  if (values.length > PIE_MAX) {
    const pp = profileOf(out); pp.additive = false; // one series: rank by its own values
    out = foldTopN(out, PIE_MAX - 1, pp, lang);
  }
  return withKind(out, id);
}
function buildPareto(work, id, p, lang, cfg) {
  const n = work.labels.length; const pp = profileOf(work); let out = sortRows(work, 'desc', pp, lang);
  const keep = cfg.topN || (n > 20 ? 15 : null);
  if (keep && n > keep) out = foldTopN(out, keep, profileOf(out), lang);
  return withKind({ ...out, series: [out.series[0]] }, id);
}
function buildCombo(work, id, p, lang) {
  const prim = p.mk[0]; const mixed = p.mk.some((k) => k !== prim);
  const series = work.series.map((s, i) => ({ ...s, type: mixed ? (p.mk[i] === prim ? 'bar' : 'line') : (i === 0 ? 'bar' : 'line'), axis: mixed && p.mk[i] !== prim ? 'secondary' : 'primary' }));
  const out = { ...work, series };
  if (mixed) { const k = p.mk.find((x) => x !== prim); out.axis2 = { title: k === 'rate' ? (lang === 'ar' ? 'النسبة (%)' : 'Rate (%)') : k === 'count' ? (lang === 'ar' ? 'العدد' : 'Count') : k === 'days' ? (lang === 'ar' ? 'الأيام' : 'Days') : (lang === 'ar' ? 'المبلغ' : 'Amount'), kind: k }; }
  return withKind(out, id);
}
function buildXY(work, id, p) {
  const pl = payloadOf(work, id);
  if (pl && pointsOk(pl, id === 'bubble')) return fromPayload(work, id, pl);
  const kindOf = (k) => (['amount', 'rate', 'count', 'days'].includes(k) ? k : 'count');
  const [x, y, s] = work.series; const pts = [];
  work.labels.forEach((l, i) => { const xv = x.values[i]; const yv = y.values[i]; const sv = s ? s.values[i] : null; if (isNum(xv) && isNum(yv) && (id !== 'bubble' || (isNum(sv) && sv >= 0))) pts.push({ x: xv, y: yv, ...(id === 'bubble' ? { size: sv } : {}), label: String(l ?? ''), key: i }); });
  return { ...stripFor(work), kind: RENDER[id].kind, labels: [], series: [], points: pts, xTitle: String(x.label ?? ''), yTitle: String(y.label ?? ''), xKind: kindOf(p.mk[0]), yKind: kindOf(p.mk[1]), ...(id === 'bubble' ? { sizeTitle: String(s.label ?? ''), sizeKind: kindOf(p.mk[2]) } : {}) };
}
function buildTree(work, id, p, lang) {
  const pl = payloadOf(work, id);
  if (pl && isAdditiveTree(pl.tree) && (id === 'treemap' || (treeDepth(pl.tree) >= 2 && treeDepth(pl.tree) <= 3))) return fromPayload(work, id, pl);
  const v = p.vals[0]; const kids = work.labels.map((l, i) => ({ label: String(l ?? ''), value: v[i] }));
  const out = withKind({ ...work, series: [work.series[0]] }, id); out.tree = { label: p.whole?.label || work.title || (lang === 'ar' ? 'الإجمالي' : 'Total'), value: sumOf(v), children: kids };
  return out;
}
function buildHeat(work, id, p) {
  const pl = payloadOf(work, 'heatmap');
  if (pl && Array.isArray(pl.series) && pl.series.length >= 2) return fromPayload(work, id, pl);
  return { ...withKind(work, id), valueKind: p.mk[0] === 'rate' ? 'rate' : 'amount' };
}
export function buildType(work, id, p, lang, cfg = {}) {
  switch (id) {
    case 'pie': case 'donut': return buildPie(work, id, p, lang);
    case 'pareto': return buildPareto(work, id, p, lang, cfg);
    case 'combo': return buildCombo(work, id, p, lang);
    case 'scatter': case 'bubble': return buildXY(work, id, p);
    case 'treemap': case 'sunburst': return buildTree(work, id, p, lang);
    case 'heatmap': return buildHeat(work, id, p);
    case 'waterfall': { const pl = payloadOf(work, 'waterfall'); return pl === work ? work : fromPayload(work, id, pl); }
    case 'histogram': case 'box': case 'bullet': case 'sankey': { const pl = payloadOf(work, id); return pl === work ? work : fromPayload(work, id, pl); }
    default: return withKind(work, id);
  }
}

/* ------------------------------------------------------------------ the plan: type + transformations + messages */
const msg = (key, ar, en) => ({ key, ar, en });
// dimensions the saved model already holds as ready category blocks: `alts.by<Dimension>` (bySource, byAmanah, byMunicipality, byProduct, …) or `alts[<dimension>]`, each { labels, series, dim?, title?, … }
const DIM_RESERVED = new Set(['scatter', 'bubble', 'histogram', 'box', 'sankey', 'sunburst', 'treemap', 'bullet', 'waterfall', 'heatmap', 'monthly']);
const dimKeyOf = (alts, dimension) => { const cap = `by${dimension.charAt(0).toUpperCase()}${dimension.slice(1)}`; return alts && (alts[cap] ? cap : alts[dimension] && !DIM_RESERVED.has(dimension) ? dimension : null); };
export function chartDimensions(block) {
  const a = block?.alts && typeof block.alts === 'object' ? block.alts : {}; const cur = block?.dim?.dimension || null; const out = [];
  for (const k of Object.keys(a)) {
    if (DIM_RESERVED.has(k) || !Array.isArray(a[k]?.labels) || !Array.isArray(a[k]?.series) || !a[k].labels.length) continue;
    const id = /^by[A-Z]/.test(k) ? `${k.charAt(2).toLowerCase()}${k.slice(3)}` : k; out.push({ id, current: id === cur, altKey: k });
  }
  return out;
}
export const DIMENSION_NEEDS = T('يحتاج إلى نسخة جديدة من التقرير تحمل هذا البعد.', 'Needs a new report version that holds this dimension.');

// → { ok, reason?, typeId, block, changes:[{key,ar,en}], ignored:[{key,ar,en}] } ; never throws on bad input, never mutates `base`.
export function planConfig(base, cfgIn, opts = {}) {
  const lang = langOf(base, opts.lang); const c = normalizeConfig(cfgIn); const changes = []; const ignored = [];
  const fail = (reason, id) => ({ ok: false, reason, typeId: id || resolveType(c, base), block: base, changes: [], ignored });
  if (!base || typeof base !== 'object') return fail(R.unknown);
  const idWanted = resolveType(c, base);
  if (!RENDER[idWanted]) return fail(R.unknown, idWanted);
  let work = base;
  // 1. another dimension, only when the saved model holds it
  const curDim = base.dim?.dimension || null;
  if (c.dimension && c.dimension !== curDim) {
    const key = dimKeyOf(base.alts, c.dimension); const pl = key && base.alts[key];
    if (pl && Array.isArray(pl.labels) && Array.isArray(pl.series) && pl.labels.length) {
      const { type: _t, id: _i, alts: _a, altsNotes: _n, config: _c, kind: _k, ...rest } = pl;
      work = { ...base, ...rest, ...(pl.dim ? {} : { dim: { ...(base.dim || {}), dimension: c.dimension } }), kind: base.kind, labels: pl.labels, series: pl.series };
      changes.push(msg('dimension', `البُعد: ${c.dimension} (من أرقام التقرير المحفوظة نفسها)`, `Dimension: ${c.dimension} (from the same saved report figures)`));
    } else ignored.push(msg('dimension', DIMENSION_NEEDS.ar, DIMENSION_NEEDS.en));
  }
  const p = profileOf(work); p.loose = !!opts.loose;
  const why = checkType(work, idWanted, p, { loose: !!opts.loose }); if (why) return fail(why, idWanted);
  const id = idWanted; const catSource = !p.special && CAT_BUILD.has(id) || (!p.special && ['heatmap', 'scatter', 'bubble', 'treemap'].includes(id));
  // 2. data transformations on category data
  let data = work; let pNow = p;
  const altTree = id === 'treemap' && payloadOf(work, 'treemap') && isAdditiveTree(payloadOf(work, 'treemap').tree);
  if (catSource && !altTree) {
    // sort / Top N (a re-ordering and a folding: the sums are verified right after)
    const sortMode = c.sort && c.sort !== 'none' ? c.sort : null; const ord = isOrdered(pNow); const sortable = SORTABLE.has(id) && !ord;
    if (sortMode && !sortable) ignored.push(msg('sort', ord ? 'الترتيب لا يُطبَّق على محور زمني أو متسلسل.' : 'الترتيب لا يناسب هذا النوع.', ord ? 'Sorting does not apply to a time or ordered axis.' : 'Sorting does not fit this type.'));
    if (c.topN && !SORTABLE.has(id)) ignored.push(msg('topn', 'أعلى N لا يناسب هذا النوع.', 'Top N does not fit this type.'));
    else if (c.topN && ord) ignored.push(msg('topn', 'أعلى N لا يُطبَّق على محور زمني؛ كل الشهور تبقى.', 'Top N does not apply to a time axis; every month stays.'));
    else if (c.topN && !pNow.summable) ignored.push(msg('topn', 'مجموعة «أخرى» لا يمكن جمعها لنسب أو متوسطات.', 'An «Other» group cannot be summed for rates or averages.'));
    const topN = c.topN && SORTABLE.has(id) && !ord && pNow.summable && c.topN < data.labels.length ? c.topN : null;
    if (sortMode && sortable) { data = sortRows(data, sortMode, pNow, lang); changes.push(msg('order', `الترتيب: ${sortMode === 'desc' ? 'تنازلي بالقيمة' : sortMode === 'asc' ? 'تصاعدي بالقيمة' : 'أبجدي'}.`, `Order: ${sortMode === 'desc' ? 'descending by value' : sortMode === 'asc' ? 'ascending by value' : 'alphabetical'}.`)); }
    if (topN) {
      data = foldTopN(data, topN, pNow, lang);
      changes.push(msg('topn', `أعلى ${topN} فئات مع مجموعة «أخرى» تضم ${data.otherCount || 0} فئة مجمّعة (المجموع لا يتغيّر وتظهر في الجدول أيضاً).`, `Top ${topN} categories plus an «Other» group of ${data.otherCount || 0} folded categories (the total is unchanged and the group is in the table too).`));
    }
    if (!sumsEqual(seriesSums(work), seriesSums(data))) return fail(T('تعذّر الحفاظ على المجاميع بعد التحويل؛ لم يُطبَّق.', 'The totals could not be preserved after the change; it was not applied.'), id);
    pNow = profileOf(data);
    // monthly → cumulative (a running sum, the basis is named)
    if (c.cumulative === true && !p.cumulative) {
      if (!TIME_OK.has(id)) ignored.push(msg('cumulative', 'الإجمالي التراكمي لا يناسب هذا النوع.', 'A running total does not fit this type.'));
      else if (!canCumulate(pNow)) ignored.push(msg('cumulative', 'التراكمي يحتاج قيماً شهرية محفوظة، قابلة للجمع، بلا شهور مفقودة في الوسط.', 'Cumulative needs saved, additive monthly values with no missing month in between.'));
      else { data = cumulate(data, lang); pNow = profileOf(data); changes.push(msg('basis', 'الأساس: من قيم شهرية إلى مجموع تراكمي (جمع جارٍ؛ آخر قيمة = مجموع الفترة).', 'Basis: monthly values become a running total (the last value = the period total).')); }
    } else if (c.cumulative === false && p.cumulative) ignored.push(msg('cumulative', 'القيم الشهرية الأصلية غير محفوظة لهذا الرسم التراكمي.', 'The original monthly values of this cumulative chart are not saved.'));
    // amount → share of the series total
    if (c.mode === 'share' && SHARE_PLAIN.has(id)) {
      if (!pNow.summable || pNow.negative || pNow.cumulative) ignored.push(msg('percentage', 'الحصص تحتاج مبالغ أو أعداداً غير سالبة غير تراكمية.', 'Shares need non-negative, non-cumulative amounts or counts.'));
      else { data = toShare(data, lang); changes.push(msg('percentage', 'أساس النسبة: كل قيمة ÷ مجموع سلسلتها (المقام: مجموع الفئات المعروضة)؛ تُعرض كنسبة مئوية لا كمبلغ.', 'Percentage basis: each value ÷ its series total (denominator: the sum of the displayed categories); shown as a percentage, not an amount.')); }
    }
  } else if (!altTree) {
    if (c.topN) ignored.push(msg('topn', 'أعلى N لا يناسب هذا النوع.', 'Top N does not fit this type.'));
    if (c.sort && c.sort !== 'none') ignored.push(msg('sort', 'الترتيب لا يناسب هذا النوع.', 'Sorting does not fit this type.'));
    if (c.cumulative) ignored.push(msg('cumulative', 'الإجمالي التراكمي لا يناسب هذا النوع.', 'A running total does not fit this type.'));
  }
  // 3. build the type
  const cur = p.current; let out = id === cur && data === work ? data : buildType(data, id, profileOf(data), lang, c);
  if (!out) return fail(R.unknown, id);
  // type-level messages (aggregation, percentage basis, grouping, Top N, axis)
  const fa = FAM[cur]; const fb = FAM[id];
  if (fa && fb && fa.g !== fb.g) changes.push(msg('grouping', fb.g === 'stacked' ? 'التجميع: تُكدَّس السلاسل فوق بعضها بدل عرضها جنباً إلى جنب (المجموع لكل فئة يظهر).' : 'التجميع: تُعرض السلاسل جنباً إلى جنب بدل تكديسها.', fb.g === 'stacked' ? 'Grouping: the series are stacked instead of side by side (each category shows its total).' : 'Grouping: the series are shown side by side instead of stacked.'));
  if (fb && fb.m === 'share' && !(fa && fa.m === 'share')) changes.push(msg('percentage', 'أساس النسبة: كل فئة تُقاس إلى 100٪ من مجموعها (المبلغ يبقى في التلميح).', 'Percentage basis: each category is scaled to 100 % of its own total (the amount stays in the tooltip).'));
  if (fa && fa.m === 'share' && fb && fb.m === 'amount') changes.push(msg('percentage', 'أساس النسبة: من حصص ٪ إلى مبالغ.', 'Percentage basis: from % shares back to amounts.'));
  if (id !== cur) {
    if ((id === 'pie' || id === 'donut') && p.m > 1) changes.push(msg('aggregation', 'الأجزاء هي السلاسل (مكوّنات الكل الواحد) لفئة واحدة.', 'The parts are the series (components of the single total) of one category.'));
    if ((id === 'pie' || id === 'donut') && out.otherIndex != null && out.otherCount > 1 && out.otherCount !== data.otherCount && !c.topN) changes.push(msg('topn', `أكثر من ${PIE_MAX} أجزاء: تُعرض أكبر ${PIE_MAX - 1} مع مجموعة «أخرى» (المجموع لا يتغيّر وتظهر في الجدول).`, `More than ${PIE_MAX} parts: the largest ${PIE_MAX - 1} are shown with an «Other» group (the total is unchanged and it is in the table).`));
    if ((id === 'pie' || id === 'donut') && p.whole && out.otherIndex != null && out.otherCount !== data.otherCount && !changes.some((x) => x.key === 'topn')) changes.push(msg('aggregation', 'الأجزاء المعروضة أقل من الإجمالي: أُضيفت «أخرى» = الإجمالي − الأجزاء.', 'The parts shown are less than the total: «Other» = total − parts was added.'));
    if (id === 'pareto') changes.push(msg('aggregation', 'الفئات مرتّبة تنازلياً مع خط الحصة التراكمية (٠–١٠٠٪) على محور ثانٍ.', 'Categories sorted descending with a cumulative-share line (0–100 %) on a second axis.'));
    if (id === 'pareto' && out.otherIndex != null && out.otherCount !== data.otherCount && !c.topN) changes.push(msg('topn', 'فئات كثيرة: تُعرض أكبر ١٥ مع مجموعة «أخرى» (المجموع لا يتغيّر).', 'Many categories: the largest 15 are shown with an «Other» group (the total is unchanged).'));
    if (id === 'combo') changes.push(msg('aggregation', p.mk.some((k) => k !== p.mk[0]) ? 'أعمدة للمقياس الأول وخط على محور ثانٍ بعنوانه ووحدته.' : 'السلسلة الأولى أعمدة والبقية خطوط على المحور نفسه.', p.mk.some((k) => k !== p.mk[0]) ? 'Columns for the first measure and a line on a second axis with its own title and unit.' : 'The first series as columns, the others as lines on the same axis.'));
    if ((id === 'scatter' || id === 'bubble') && !payloadOf(work, id)) { const omit = work.labels.length - (out.points ? out.points.length : 0); if (omit > 0) changes.push(msg('aggregation', `${omit} فئة ينقصها أحد المقاييس لا تُرسم (المفقود ليس صفراً).`, `${omit} categories missing one of the measures are not drawn (missing is not zero).`)); }
    if (id === 'scatter' || id === 'bubble') { if (!(payloadOf(work, id) && pointsOk(payloadOf(work, id), id === 'bubble'))) changes.push(msg('aggregation', `كل فئة نقطة (س = ${work.series[0]?.label ?? ''}، ص = ${work.series[1]?.label ?? ''}${id === 'bubble' ? `، الحجم = ${work.series[2]?.label ?? ''}` : ''}). العلاقة لا تعني سببية.`, `Each category becomes a point (x = ${work.series[0]?.label ?? ''}, y = ${work.series[1]?.label ?? ''}${id === 'bubble' ? `, size = ${work.series[2]?.label ?? ''}` : ''}). A relationship is not causation.`)); else changes.push(msg('aggregation', 'تُرسم نقاط محفوظة في التقرير. العلاقة لا تعني سببية.', 'Draws the points saved in the report. A relationship is not causation.')); }
    if (['histogram', 'box', 'bullet', 'sankey', 'sunburst', 'waterfall'].includes(id) || (id === 'treemap' && out.tree && payloadOf(work, 'treemap'))) changes.push(msg('aggregation', 'يستخدم بيانات محفوظة في التقرير لهذا الشكل وليس جدول الفئات؛ الأرقام نفسها دون إعادة حساب.', 'Uses the data saved in the report for this shape (not the category table); the same figures, nothing recomputed.'));
    if (id === 'heatmap') changes.push(msg('aggregation', 'السلاسل صفوف والفئات أعمدة، واللون يمثّل القيمة.', 'Series become rows, categories become columns; colour carries the value.'));
    if (id === 'treemap' && !payloadOf(work, 'treemap')) changes.push(msg('aggregation', 'مستوى واحد: كل فئة مستطيل بمساحة تتناسب مع قيمتها.', 'One level: each category is a rectangle with area proportional to its value.'));
  }
  // 4. display flags
  if (c.labels !== undefined || c.legend !== undefined) {
    out = { ...out }; if (c.labels !== undefined) out.showLabels = c.labels; if (c.legend !== undefined) out.showLegend = c.legend;
  }
  if (out !== base && Object.keys(c).length) out = { ...out, config: c };
  return { ok: true, typeId: id, block: out, changes, ignored };
}

// the displayed block of a base block under a config; the base is never changed. An invalid request returns the base block as it is (never throws).
export function applyChartConfig(baseBlock, cfg, opts = {}) {
  try {
    if (baseBlock?.config && JSON.stringify(baseBlock.config) === JSON.stringify(normalizeConfig(cfg)) && Object.keys(normalizeConfig(cfg)).length) return baseBlock; // already applied (idempotent)
    const r = planConfig(baseBlock, cfg, opts); return r.ok ? r.block : baseBlock;
  } catch { return baseBlock; }
}
// the messages that explain, in both languages, what a config changes in the figures' presentation (aggregation, percentage basis, grouping, Top N, cumulative) — shown before «Apply»
export function configChanges(block, cfg, opts = {}) {
  try { const r = planConfig(block, cfg, opts); return r.ok ? r.changes : []; } catch { return []; }
}
