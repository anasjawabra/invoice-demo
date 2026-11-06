// ============================================================================
// Companion datasets (`alts`) and semantic descriptors (`dim`) of the report charts — docs/chart-library.md §2 and «Chart data».
// Pure: numbers already verified by the data service in → ready chart-block payloads out. Nothing is fetched or recomputed from raw data here, and every payload is built from
// the SAME snapshot / analysis (same scope, cut-off, permissions) as the block it belongs to, so a presentation switch can never change a figure.
//
// Rules held in every builder:
//  * missing ≠ zero — an entity with no net billed has NO collection rate (it is left out of a scatter and named in the note), a period/entity without an APPROVED target gets no bullet;
//  * the rate of a set is Σ collected ÷ Σ net, never an average of rates;
//  * a tree / flow is ADDITIVE: children sum to their parent and the root to the stated total (checked; the builder returns null otherwise), no amount appears twice;
//  * a distribution holds bins / quartiles only — never raw invoices — and its counts reconcile to a population the report states;
//  * every payload carries its own note (AR/EN) naming the population, the basis and the method; a scatter always carries the fixed non-causation caption.
// ============================================================================
import { fmtInt } from '../utils/money';
import { cumulativeTargetToDate } from './revenueMetrics';

const EPS = 0.5; // SAR
const lx = (lang) => (a, e) => (lang === 'ar' ? a : e);
const sumOf = (rows, f) => rows.reduce((t, r) => t + (Number(f(r)) || 0), 0);
const near = (a, b, tol = EPS) => Math.abs(a - b) <= tol;
const nameList = (names, L, max = 6) => (names.length > max ? `${names.slice(0, max).join(L('، ', ', '))}${L(` و${fmtInt(names.length - max)} أخرى`, ` and ${fmtInt(names.length - max)} more`)}` : names.join(L('، ', ', ')));

export const NON_CAUSAL = { ar: 'العلاقة المعروضة وصفية ولا تعني أن أحد المتغيرين سبب في الآخر.', en: 'The relationship shown is descriptive; it does not mean one variable causes the other.' };
export const MAX_POINTS = 60; // entities in one scatter / bubble
export const MAX_ALT_ROWS = 40; // rows in a dimension-alternative block

/** the semantic descriptor of a chart (docs/chart-library.md §2) */
export const dimOf = (dimension, { ordered = false, measures = [], additive = false, whole = null } = {}) => ({ dimension, ordered, measures, additive, ...(additive && whole ? { whole } : {}) });
const amt = (key) => ({ key, kind: 'amount' });
export const M_NET = amt('net'); export const M_COLLECTED = amt('collected'); export const M_UNCOLLECTED = amt('uncollected'); export const M_EXCLUDED = amt('excluded');
const merge = (parts) => {
  const alts = {}; const notes = {};
  for (const p of parts) { if (!p) continue; if (p.alts) Object.assign(alts, p.alts); if (p.notes) Object.assign(notes, p.notes); }
  return { ...(Object.keys(alts).length ? { alts } : {}), ...(Object.keys(notes).length ? { altsNotes: notes } : {}) };
};
const put = (key, block, noteIfMissing) => (block ? { alts: { [key]: block } } : noteIfMissing ? { notes: { [key]: noteIfMissing } } : null);
export { merge as mergeAlts, put as putAlt };
/**
 * Read one companion payload of a chart block as a full, ready block. To keep the saved report small, a payload that is the same data as a sibling may say `inherit: '<altKey>'`
 * (the sunburst shares the treemap's tree, the scatter shares the bubble's points); every other field of the payload (kind, title, …) overrides the inherited one.
 * Returns null when the block has no such alternative.
 */
export function resolveAlt(block, key) {
  const a = block?.alts?.[key]; if (!a) return null;
  if (!a.inherit) return a;
  const base = block.alts[a.inherit]; if (!base || base.inherit) return null;
  const { inherit, ...own } = a; return { ...base, ...own };
}

/* ------------------------------------------------------------------ sankey: a reconciled additive flow */
/** nodes [{id,label,col}] · links [{from,to,value}]; zero links are dropped, every node that has both inflow and outflow must balance (±0.5 SAR); null otherwise */
export function flowBlock({ title, nodes, links, note }) {
  const ls = links.filter((l) => l.value > EPS / 100);
  if (!ls.length || ls.some((l) => !Number.isFinite(l.value) || l.value < 0)) return null;
  const used = new Set(ls.flatMap((l) => [l.from, l.to]));
  const ns = nodes.filter((n) => used.has(n.id));
  for (const n of ns) {
    const inn = sumOf(ls.filter((l) => l.to === n.id), (l) => l.value); const out = sumOf(ls.filter((l) => l.from === n.id), (l) => l.value);
    if (inn > 0 && out > 0 && !near(inn, out)) return null;
  }
  return { type: 'chart', kind: 'sankey', title, nodes: ns, links: ls, note };
}

/** Gross billed → Exclusions | Net billed → Collected | Uncollected (→ Overdue | Not yet due); Exclusions → by reason (top 6 + «other reasons»). T = the snapshot totals. null when gross = 0 or an identity fails. */
export function sankeyAlt(T, { reasons = [], lang }) {
  const L = lx(lang);
  if (!(T.gross > 0) || !near(T.gross, T.exclusions + T.net) || !near(T.net, T.collected + T.outstanding) || T.net < -EPS || T.exclusions < -EPS) return null;
  const nodes = [{ id: 'gross', label: L('إجمالي المفوتر', 'Gross billed'), col: 0 }, { id: 'excluded', label: L('الاستبعادات (شاملة الإلغاء)', 'Exclusions (cancellation included)'), col: 1 }, { id: 'net', label: L('صافي المفوتر', 'Net billed'), col: 1 },
    { id: 'collected', label: L('المحصّل', 'Collected'), col: 2 }, { id: 'uncollected', label: L('غير المحصّل', 'Uncollected'), col: 2 }];
  const links = [{ from: 'gross', to: 'excluded', value: Math.max(0, T.exclusions) }, { from: 'gross', to: 'net', value: Math.max(0, T.net) }, { from: 'net', to: 'collected', value: Math.max(0, T.collected) }, { from: 'net', to: 'uncollected', value: Math.max(0, T.outstanding) }];
  let withReasons = false; let withDue = false;
  const rs = reasons.filter((r) => r.amount > 0).slice().sort((a, b) => b.amount - a.amount || (a.key < b.key ? -1 : 1));
  if (rs.length && near(sumOf(rs, (r) => r.amount), T.exclusions)) {
    const top = rs.slice(0, 6); const rest = rs.slice(6);
    for (const r of top) { nodes.push({ id: `reason:${r.key}`, label: r.label, col: 2 }); links.push({ from: 'excluded', to: `reason:${r.key}`, value: r.amount }); }
    if (rest.length) { nodes.push({ id: 'reason:other', label: L(`أسباب أخرى (${fmtInt(rest.length)})`, `Other reasons (${fmtInt(rest.length)})`), col: 2 }); links.push({ from: 'excluded', to: 'reason:other', value: sumOf(rest, (r) => r.amount) }); }
    withReasons = true;
  }
  if (near(T.overdueOutstanding + T.notDueOutstanding, T.outstanding) && T.outstanding > 0) {
    nodes.push({ id: 'overdue', label: L('متأخر', 'Overdue'), col: 3 }, { id: 'notdue', label: L('لم يحن استحقاقه', 'Not yet due'), col: 3 });
    links.push({ from: 'uncollected', to: 'overdue', value: T.overdueOutstanding }, { from: 'uncollected', to: 'notdue', value: T.notDueOutstanding }); withDue = true;
  }
  return flowBlock({ title: L('تدفق المفوتر: من الإجمالي إلى المحصّل وغير المحصّل', 'Billing flow: from gross to collected and uncollected'), nodes, links,
    note: L(`كل عقدة تجمع مداخلها إلى مخارجها: إجمالي المفوتر = الاستبعادات + صافي المفوتر؛ صافي المفوتر = المحصّل + غير المحصّل${withDue ? '؛ غير المحصّل = متأخر + لم يحن' : ''}${withReasons ? '؛ الاستبعادات موزعة على سببها الرئيسي مرة واحدة' : ''}. لا مبلغ يُحتسب مرتين.`, `Every node's inflow equals its outflow: gross billed = exclusions + net billed; net billed = collected + uncollected${withDue ? '; uncollected = overdue + not yet due' : ''}${withReasons ? '; exclusions are split once, under their primary reason' : ''}. No amount is counted twice.`) });
}

/* ------------------------------------------------------------------ scatter / bubble */
/** rows [{key,label,net,collected,outstanding}] → { scatter, bubble }; an entity without net billed has no rate and is named in the note (never plotted at 0). null when fewer than 3 entities can be plotted. */
export function pointsAlt(rows, { lang, entity }) {
  const L = lx(lang);
  const ok = rows.filter((r) => r.net > 0); const miss = rows.filter((r) => !(r.net > 0));
  if (ok.length < 3) return { notes: { scatter: { ar: `يلزم ثلاثة كيانات على الأقل بصافي مفوتر موجب (المتاح ${fmtInt(ok.length)}).`, en: `At least three entities with positive net billed are needed (${fmtInt(ok.length)} available).` } } };
  const kept = ok.slice().sort((a, b) => b.net - a.net || (a.key < b.key ? -1 : 1)).slice(0, MAX_POINTS); const dropped = ok.length - kept.length;
  const pts = kept.map((r) => ({ key: r.key, label: r.label, x: r.net, y: r.collected / r.net, size: Math.max(0, r.outstanding) }));
  const tot = { net: sumOf(kept, (r) => r.net), collected: sumOf(kept, (r) => r.collected) };
  const note = L(
    `كل نقطة ${entity.ar}؛ الأفقي صافي المفوتر والرأسي نسبة التحصيل الموزونة (المحصّل ÷ صافي المفوتر لكل ${entity.ar}). نسبة المجموع = ${tot.net > 0 ? ((tot.collected / tot.net) * 100).toFixed(1) : '—'}% (مجموع المحصّل ÷ مجموع الصافي لا متوسط النسب).${miss.length ? ` بلا صافي مفوتر (النسبة غير محسوبة وليست صفراً، وغير معروضة): ${nameList(miss.map((r) => r.label), L)}.` : ''}${dropped ? ` عُرضت أكبر ${fmtInt(MAX_POINTS)} حسب الصافي؛ ${fmtInt(dropped)} غير معروضة.` : ''} ${NON_CAUSAL.ar}`,
    `Each point is one ${entity.en}; horizontal = net billed, vertical = the weighted collection rate (collected ÷ net billed of that ${entity.en}). The rate of the whole set is ${tot.net > 0 ? ((tot.collected / tot.net) * 100).toFixed(1) : '—'}% (Σ collected ÷ Σ net, not an average of rates).${miss.length ? ` No net billed (rate not calculated, not zero, not plotted): ${nameList(miss.map((r) => r.label), L)}.` : ''}${dropped ? ` The ${fmtInt(MAX_POINTS)} largest by net are shown; ${fmtInt(dropped)} are not.` : ''} ${NON_CAUSAL.en}`);
  const base = { type: 'chart', xTitle: L('صافي المفوتر', 'Net billed'), yTitle: L('نسبة التحصيل (المحصّل ÷ صافي المفوتر)', 'Collection rate (collected ÷ net billed)'), xKind: 'amount', yKind: 'rate', note, missing: miss.map((r) => ({ key: r.key, label: r.label })), dim: dimOf(entity.dimension, { measures: [M_NET, { key: 'rate', kind: 'rate' }] }) };
  return { alts: {
    scatter: { type: 'chart', kind: 'scatter', inherit: 'bubble', title: L(`نسبة التحصيل مقابل صافي المفوتر حسب ${entity.ar}`, `Collection rate vs net billed by ${entity.en}`) },
    bubble: { ...base, kind: 'bubble', title: L(`نسبة التحصيل وصافي المفوتر وغير المحصّل حسب ${entity.ar}`, `Collection rate, net billed and uncollected by ${entity.en}`), points: pts, sizeTitle: L('غير المحصّل', 'Uncollected'), sizeKind: 'amount' } } };
}

/* ------------------------------------------------------------------ tree: Amanah → municipality → revenue source (additive) */
const EXPLICIT = /\|(NOT_SPECIFIED|DIRECT|UNRESOLVED)$/;
/**
 * cells [{amanah, muni, source, net}] (server/distributions.js) → the 3-level tree; without cells the 2-level tree from `muniRows` [{amanah, key, net}] (the snapshot's byMunicipality).
 * Per Amanah the explicit groups («directly by the Amanah», «no municipality», «needs review») are always kept, then the `maxMuni` largest reference municipalities, the rest are one «Other municipalities» node.
 * Parents are the exact sums of their children; the root must equal `total` (±0.5) or the builder returns null.
 */
export const MEASURE_NET = { key: 'net', ar: 'صافي المفوتر', en: 'Net billed' };
export const MEASURE_UNPAID = { key: 'uncollected', ar: 'صافي غير المسدد', en: 'Net unpaid' };
export const MAX_TREE_NODES = 150; // a wider tree is cut back to Amanah → municipality so the saved report stays small
export function treeAlt({ cells = null, muniRows = [], total, lang, labelAmanah, labelMuni, labelSource, maxMuni = 4, scopeLabel, measure = MEASURE_NET }) {
  const L = lx(lang);
  const build = (useCells) => {
    const byA = new Map(); // amanah -> Map(muni -> Map(source|'' -> value))
    if (useCells) { for (const c of cells) { if (!(c.net > 0)) continue; const a = byA.get(c.amanah) || new Map(); const m = a.get(c.muni) || new Map(); m.set(c.source, (m.get(c.source) || 0) + c.net); a.set(c.muni, m); byA.set(c.amanah, a); } }
    else { for (const r of muniRows) { if (!(r.net > 0)) continue; const a = byA.get(r.amanah) || new Map(); const m = a.get(r.key) || new Map(); m.set('', (m.get('') || 0) + r.net); a.set(r.key, m); byA.set(r.amanah, a); } }
    const val = (m) => sumOf([...m.values()], (v) => v);
    const amChildren = []; let nodes = 1;
    for (const [am, munis] of byA) {
      const entries = [...munis.entries()].map(([k, srcs]) => ({ key: k, srcs, value: val(srcs), explicit: EXPLICIT.test(k) }));
      const mapped = entries.filter((e) => !e.explicit).sort((a, b) => b.value - a.value || (a.key < b.key ? -1 : 1));
      const keep = [...entries.filter((e) => e.explicit).sort((a, b) => b.value - a.value || (a.key < b.key ? -1 : 1)), ...mapped.slice(0, maxMuni)]; const rest = mapped.slice(maxMuni);
      const node = (key, label, srcs) => {
        if (!useCells) { nodes += 1; return { label, value: srcs.get('') }; }
        const kids = [...srcs.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([s, v]) => ({ label: labelSource(s), value: v }));
        nodes += 1 + kids.length; return { label, value: sumOf(kids, (k) => k.value), children: kids };
      };
      const kids = keep.map((e) => node(e.key, labelMuni(e.key), e.srcs));
      if (rest.length) { const agg = new Map(); for (const e of rest) for (const [s, v] of e.srcs) agg.set(s, (agg.get(s) || 0) + v); kids.push(node('other', L(`بلديات أخرى (${fmtInt(rest.length)})`, `Other municipalities (${fmtInt(rest.length)})`), agg)); }
      const value = sumOf(kids, (k) => k.value); if (value > 0) { nodes += 1; amChildren.push({ key: am, label: labelAmanah(am), value, children: kids }); }
    }
    amChildren.sort((a, b) => b.value - a.value || (a.key < b.key ? -1 : 1));
    return { amChildren, nodes };
  };
  let useCells = !!(cells && cells.length); let r = build(useCells); let trimmed = false;
  if (useCells && r.nodes > MAX_TREE_NODES) { r = build(false); useCells = false; trimmed = true; }
  const { amChildren } = r; const levels = useCells ? 3 : 2;
  const rootValue = sumOf(amChildren, (c) => c.value);
  if (!amChildren.length || !near(rootValue, total)) return null;
  const tree = { key: 'root', label: scopeLabel, value: rootValue, children: amChildren };
  const why = trimmed ? { ar: 'مستوى مصدر الإيراد غير معروض في النطاق الواسع حفاظاً على حجم التقرير المحفوظ؛ اختر أمانة واحدة لعرضه', en: 'the revenue-source level is left out of a wide scope to keep the saved report small; select one Amanah to see it' } : { ar: 'تقسيم مصدر الإيراد غير متاح في هذا النموذج', en: 'the revenue-source split is not available in this model' };
  const note = L(
    `${measure.ar} موزع على ${levels === 3 ? 'الأمانة ← البلدية ← مصدر الإيراد' : `الأمانة ← البلدية (${why.ar})`}؛ كل أب = مجموع أبنائه والجذر = ${scopeLabel}. المجموعات الصريحة («مباشر على الأمانة»، «بلا بلدية (غير محددة في المصدر)»، «تحتاج مراجعة») تظهر كما هي؛ ما بعد أكبر ${fmtInt(maxMuni)} بلدية في كل أمانة مجمّع في «بلديات أخرى». الصافي الصفري لا يُرسم.`,
    `${measure.en} split by ${levels === 3 ? 'Amanah → municipality → revenue source' : `Amanah → municipality (${why.en})`}; every parent is the sum of its children and the root is ${scopeLabel}. The explicit groups (“Issued directly by the Amanah”, “No municipality (not specified in source)”, “Needs review”) appear as they are; beyond the ${fmtInt(maxMuni)} largest municipalities of each Amanah the rest is one “Other municipalities” node. Zero net is not drawn.`);
  const title = L(`${measure.ar}: ${levels === 3 ? 'الأمانة ← البلدية ← المصدر' : 'الأمانة ← البلدية'}`, `${measure.en}: ${levels === 3 ? 'Amanah → municipality → source' : 'Amanah → municipality'}`);
  const base = { type: 'chart', tree, note, dim: dimOf('amanah', { measures: [measure.key === 'net' ? M_NET : M_UNCOLLECTED], additive: true, whole: { label: scopeLabel, value: rootValue } }), levels: [L('الأمانة', 'Amanah'), L('البلدية', 'Municipality'), ...(useCells ? [L('مصدر الإيراد', 'Revenue source')] : [])], valueTitle: L(measure.ar, measure.en) };
  return { alts: { treemap: { ...base, kind: 'treemap', title }, sunburst: { type: 'chart', kind: 'sunburst', inherit: 'treemap', title } } };
}

/* ------------------------------------------------------------------ histogram / box (from server/distributions.js payloads) */
export function histogramAlt(h, { lang, valueKind, popAr, popEn, extraAr = '', extraEn = '' }) {
  const L = lx(lang);
  if (!h || !(h.n > 0) || !h.bins?.length) return null;
  const total = sumOf(h.bins, (b) => b.count); if (total !== h.n) return null; // the bins cover every observation exactly once
  const isDays = valueKind === 'days';
  const note = isDays
    ? L(`${popAr}: ${fmtInt(h.n)} فاتورة. الفئات متساوية العرض (${fmtInt(h.binWidth)} يوماً) وشاملة الطرفين؛ مجموع الأعمدة = ${fmtInt(h.n)}.${extraAr}`, `${popEn}: ${fmtInt(h.n)} invoices. Bins are equal width (${fmtInt(h.binWidth)} days), both ends inclusive; the bars add up to ${fmtInt(h.n)}.${extraEn}`)
    : L(`${popAr}: ${fmtInt(h.n)} فاتورة، قيمة كل فاتورة إجمالي مفوترها قبل الاستبعاد. الفئات بمقياس لوغاريتمي بخطوات 1-2-5 (عرضها غير متساوٍ)، مغلقة من اليسار ومفتوحة من اليمين؛ مجموع الأعمدة = ${fmtInt(h.n)}.${extraAr}`, `${popEn}: ${fmtInt(h.n)} invoices, each valued at its gross billed before exclusions. Bins use a log scale in 1-2-5 steps (unequal width), closed at the low end and open at the high end; the bars add up to ${fmtInt(h.n)}.${extraEn}`);
  return { type: 'chart', kind: 'histogram', title: isDays ? L('توزيع أيام التأخر للفواتير المتأخرة غير المحصّلة', 'Distribution of days overdue — uncollected overdue invoices') : L('توزيع مبالغ الفواتير (إجمالي المفوتر لكل فاتورة)', 'Distribution of invoice amounts (gross billed per invoice)'),
    bins: h.bins.map((b) => ({ lo: b.lo, hi: b.hi, count: b.count, amount: b.amount })), binUnit: isDays ? 'days' : 'sar', binScale: isDays ? 'linear' : 'log', n: h.n,
    xTitle: isDays ? L('أيام التأخر', 'Days overdue') : L('مبلغ الفاتورة (ريال)', 'Invoice amount (SAR)'), yTitle: L('عدد الفواتير', 'Invoices'), note,
    dim: dimOf(isDays ? 'days' : 'amount', { ordered: true, measures: [{ key: 'count', kind: 'count' }], additive: true, whole: { label: L('الفواتير', 'Invoices'), value: h.n } }) };
}
/** box = per-group quartiles; only groups with n ≥ 5 are drawn, the others are named in the note; null when no group qualifies */
export function boxAlt(box, { lang, valueKind, labelOf, entityAr, entityEn, title, dimension }) {
  const L = lx(lang);
  if (!box || !box.groups?.length) return null;
  const groups = box.groups.map((g) => ({ key: g.key, label: labelOf(g.key), n: g.n, min: g.min, q1: g.q1, median: g.median, q3: g.q3, max: g.max, ...(g.outlierCount ? { outliers: g.outliers, outlierCount: g.outlierCount } : {}) }));
  const sk = (box.skipped || []).map((s) => labelOf(s.key));
  const note = L(
    `صندوق لكل ${entityAr}: الخط الأوسط الوسيط، والصندوق من الربع الأول إلى الثالث (استيفاء خطي بين القيم المرتبة)، والشوارب إلى أبعد قيمة ضمن 1.5 × المدى الربعي، والنقاط خارجها شاذة (حتى 8 لكل مجموعة). يُرسم فقط ما فيه 5 فواتير فأكثر${sk.length ? `؛ غير معروض لقلة الملاحظات: ${nameList(sk, L)}` : ''}.`,
    `One box per ${entityEn}: the line is the median, the box runs from the first to the third quartile (linear interpolation between ordered values), the whiskers reach the most extreme value within 1.5 × IQR and points beyond are outliers (up to 8 per group). Only groups with 5 or more invoices are drawn${sk.length ? `; not shown for too few observations: ${nameList(sk, L)}` : ''}.`);
  return { type: 'chart', kind: 'box', title, groups, valueKind, valueTitle: valueKind === 'days' ? L('أيام التأخر', 'Days overdue') : L('مبلغ الفاتورة (ريال)', 'Invoice amount (SAR)'), skipped: (box.skipped || []).map((s) => ({ key: s.key, label: labelOf(s.key), n: s.n })), note,
    dim: dimOf(dimension, { measures: [{ key: valueKind === 'days' ? 'days' : 'amount', kind: valueKind === 'days' ? 'days' : 'amount' }] }) };
}

/* ------------------------------------------------------------------ bullet: actual vs an APPROVED target only */
const isApproved = (t) => !!t && t.status === 'approved' && Number.isFinite(t.value) && t.value > 0;
const nationalScope = (sc, snapScope) => (sc?.amanah ?? 'all') === 'all' && (sc?.source ?? 'all') === 'all' && (sc?.muni ?? 'all') === 'all' && (sc?.scopeType ?? 'all') === 'all' && (sc?.status ?? 'all') === 'all' && !(sc?.product || []).length && (!sc?.mainClass || sc.mainClass === 'all') && !snapScope?.org;
/** collection-rate bullet (collected ÷ net vs the approved collection-rate target) — national, unfiltered scope only; the note names what has no approved target */
export function bulletRateAlt({ targets, T, scope, snapScope, lang }) {
  const L = lx(lang); const t = targets?.collectionRate;
  const why = [];
  if (!isApproved(t)) why.push(L('لا مستهدف معتمد لنسبة التحصيل (المُدخل الحالي توضيحي)', 'no approved collection-rate target (the current input is illustrative)'));
  if (!nationalScope(scope, snapScope)) why.push(L('المستهدف المعتمد وطني ولا توزيع معتمد له على أمانة أو مصدر أو بلدية أو نطاق مقيَّد', 'the approved target is national; no approved allocation exists for an Amanah, source, municipality or restricted scope'));
  if (!T.collectedOverNet?.calculable) why.push(L('لا صافي مفوتر لحساب النسبة الفعلية', 'no net billed to calculate the actual rate'));
  if (why.length) return { notes: { bullet: { ar: `لا يُرسم مؤشر الإنجاز: ${why.map((w) => w).join('؛ ')}.`, en: `The bullet is not drawn: ${why.join('; ')}.` } } };
  return put('bullet', { type: 'chart', kind: 'bullet', title: L('نسبة التحصيل الفعلية مقابل المستهدف المعتمد', 'Actual collection rate vs the approved target'),
    bullets: [{ key: 'collectionRate', label: L('نسبة التحصيل (المحصّل ÷ صافي المفوتر)', 'Collection rate (collected ÷ net billed)'), actual: T.collectedOverNet.value, target: t.value }], valueTitle: L('نسبة التحصيل', 'Collection rate'), valueKind: 'rate',
    note: L(`الفعلي = المحصّل ÷ صافي المفوتر للفترة؛ المستهدف: ${(t.value * 100).toFixed(1)}% (معتمد). لا أمانة أو مصدر أو بلدية لها مستهدف معتمد فلا تُرسم لها مؤشرات.`, `Actual = collected ÷ net billed for the period; target ${(t.value * 100).toFixed(1)}% (approved). No Amanah, source or municipality has an approved target, so none is drawn.`),
    dim: dimOf('entity', { measures: [{ key: 'rate', kind: 'rate' }] }) });
}
/** received (payment date) in the fiscal year to date vs the approved cumulative target — only for a fiscal-year-to-date national scope with an approved annual target */
export function bulletAmountAlt({ targets, snapshot, scope, lang }) {
  const L = lx(lang); const t = targets?.collectionAmountAnnual; const why = [];
  if (!isApproved(t)) why.push(L('لا مستهدف سنوي معتمد للتحصيل (المُدخل الحالي توضيحي)', 'no approved annual collection target (the current input is illustrative)'));
  if (!nationalScope(scope, snapshot.scope)) why.push(L('المستهدف السنوي وطني', 'the annual target is national'));
  const fy = targets?.fiscalYear; const to = snapshot.scope?.to || ''; const from = snapshot.scope?.from || '';
  if (from !== `${fy}-01-01` || !to.startsWith(String(fy))) why.push(L('الفترة ليست من بداية السنة المالية إلى تاريخ ضمنها', 'the period is not the fiscal year to date'));
  if (why.length) return { notes: { bullet: { ar: `لا يُرسم مؤشر الإنجاز: ${why.join('؛ ')}.`, en: `The bullet is not drawn: ${why.join('; ')}.` } } };
  const through = to < snapshot.cutoff ? to : snapshot.cutoff; const tgt = cumulativeTargetToDate(targets, through);
  if (!(tgt > 0)) return { notes: { bullet: { ar: 'لا مستهدف تراكمي معتمد حتى نهاية الفترة.', en: 'No approved cumulative target to the end of the period.' } } };
  return put('bullet', { type: 'chart', kind: 'bullet', title: L('الإيرادات المحصلة مقابل المستهدف التراكمي المعتمد', 'Received vs the approved cumulative target'),
    bullets: [{ key: 'received', label: L('الإيرادات المحصلة (تاريخ الدفع) منذ بداية السنة', 'Received (payment date) since the start of the year'), actual: snapshot.receivedInPeriod.total, target: tgt }], valueTitle: L('ريال', 'SAR'), valueKind: 'amount',
    note: L(`الفعلي على أساس تاريخ الدفع حتى ${through}؛ المستهدف التراكمي المعتمد حتى ${through} (الشهر الحالي موزَّع بالأيام).`, `Actual on a payment-date basis up to ${through}; the approved cumulative target to ${through} (the current month prorated by days).`),
    dim: dimOf('entity', { measures: [{ key: 'received', kind: 'amount' }] }) });
}

/* ------------------------------------------------------------------ dimension alternatives */
/**
 * an hbar of the same measure(s) by another dimension. rows [{key,label,<field>…}]; measures [{key,kind,label,field}] (the first one orders the rows). More than MAX_ALT_ROWS → the remainder is ONE summed «Other» row.
 * With `whole` the rows of the first measure must add up to the stated total (±0.5) or the block is not produced (a breakdown that does not reconcile is not offered).
 */
export function breakdownAlt({ dimension, rows, lang, title, otherLabel, measures, additive = false, whole = null, total = null, note = null }) {
  const L = lx(lang); const f0 = measures[0].field;
  const rs = rows.filter((r) => measures.some((m) => r[m.field] > 0));
  if (rs.length < 2) return null;
  const tot = total ?? whole?.value ?? null;
  if (tot != null && !near(sumOf(rows, (r) => r[f0]), tot)) return null;
  const sorted = rs.slice().sort((a, b) => b[f0] - a[f0] || (a.key < b.key ? -1 : 1));
  let shown = sorted;
  if (sorted.length > MAX_ALT_ROWS) {
    const head = sorted.slice(0, MAX_ALT_ROWS - 1); const rest = sorted.slice(MAX_ALT_ROWS - 1);
    shown = [...head, { key: 'other', label: L(`${otherLabel.ar} (${fmtInt(rest.length)})`, `${otherLabel.en} (${fmtInt(rest.length)})`), ...Object.fromEntries(measures.map((m) => [m.field, sumOf(rest, (r) => r[m.field])])) }];
  }
  return { type: 'chart', kind: 'hbar', ranked: true, otherLabel: L(otherLabel.ar, otherLabel.en), title, labels: shown.map((r) => r.label), series: measures.map((m) => ({ label: m.label, values: shown.map((r) => r[m.field]) })), ...(note ? { note } : {}),
    dim: dimOf(dimension, { measures: measures.map((m) => ({ key: m.key, kind: m.kind })), additive, whole }) };
}

/**
 * municipality rows for a chart: the explicit groups (summed over the Amanahs in a national scope, separate inside one Amanah), the `top` largest reference municipalities, one «Other» row.
 * Every invoice is in exactly one row. rows: [{key, status, label, <fields>}] (the snapshot's byMunicipality, labelled). `single` = one Amanah in scope.
 */
export function muniChartRows(rows, { single, top, fields, explicitLabel, otherLabel, lang }) {
  const L = lx(lang);
  const sum = (rs) => Object.fromEntries(fields.map((f) => [f, sumOf(rs, (r) => r[f])]));
  const byField = (a, b) => b[fields[0]] - a[fields[0]] || (a.key < b.key ? -1 : 1);
  const explicit = rows.filter((r) => r.status !== 'mapped'); const mapped = rows.filter((r) => r.status === 'mapped').sort(byField);
  const groups = [];
  if (single) { for (const r of explicit.slice().sort(byField)) groups.push({ key: r.key, label: r.label, ...sum([r]) }); }
  else {
    const bucket = (st) => (['needs_review', 'unmapped_source_value', 'conflict'].includes(st) ? 'needs_review' : st);
    for (const st of ['direct_amanah', 'not_specified', 'needs_review']) { const rs = explicit.filter((r) => bucket(r.status) === st); if (rs.length) groups.push({ key: `group:${st}`, label: `${explicitLabel[st]}${L(` — كل الأمانات (${fmtInt(rs.length)})`, ` — all Amanahs (${fmtInt(rs.length)})`)}`, ...sum(rs) }); }
  }
  const head = mapped.slice(0, top).map((r) => ({ key: r.key, label: r.label, ...sum([r]) })); const rest = mapped.slice(top);
  const out = [...groups, ...head]; if (rest.length) out.push({ key: 'other', label: L(`${otherLabel.ar} (${fmtInt(rest.length)})`, `${otherLabel.en} (${fmtInt(rest.length)})`), ...sum(rest) });
  return out;
}
