// REGIONAL PERFORMANCE — the metric registry, the legends and the value formatting (pure: no React, no I/O). NO plan / target anywhere.
// docs/insights-redesign-spec.md «Metric semantics» + «Implementation notes — S (decoupling)»: the selected metric drives the value, the COLOUR (a collection-performance band), the legend, the tooltip and the table column — ALL from this
// file and collectionBands.js, so they cannot disagree.
//
//   METRICS[id] = { id, rule:'rate'|'changeCollected'|'changeRate', unit:'money'|'pct'|'pp', signed, needsComparison, label{ar,en}, short{ar,en}, basis{ar,en}, caption{ar,en}, scaleNote{ar,en} }
//       `rule` = the row of the ONE band table (collectionBands.BAND_RULES) that gives the COLOUR. The VALUE and the COLOUR can be different quantities: «المحصّل» is the collected amount, its colour is the collection RATE.
//   buildLegend(metricId, values?, { scale?, comparison? }) → { metric, rule, kind, unit:{ kind, scale, label{ar,en} }, thresholds[], buckets:[{ index, cls, glyph, color, name{ar,en}, label{ar,en}, from, to }], na:{ glyph, name, label },
//                                                              notAvailable{ar,en}, caption, labels, basis, comparisonBasis, bandsTitle, source }
//       The classes are FIXED by the band table (never quantiles of the data, never a ranking): the same value is the same class in every scope.
//   colorOf(legend, driver) → { bucket, buckets, cls, glyph, fill, tone }   driver = the figure the rule judges (rate · relative change as a fraction · pp change); a missing driver has NO bucket
//   formatValue(metricId, value, { lang, scale }) → { sign:'+'|'−'|'', number, unit, text, direction:'up'|'down'|'flat'|null }
//   comparisonBasisText(comparison) → { kind, label{ar,en} }      REASONS[code] → { short{ar,en}, message{ar,en} }   the coded cause of an unavailable value (never 0)
import { pickUnit, UNITS, fmtParts } from '../../utils/money';
import { BAND_RULES, legendClasses, NA_LEGEND, classOf, CLASS_COLORS, glyphOf } from './collectionBands';

const bi = (ar, en) => ({ ar, en });
export const PCT_THRESHOLDS = Object.freeze(BAND_RULES.rate.cuts.map((c) => c / 100));   // = PctScale.PCT_CUTS (asserted by the tests)

export const REGIONAL_METRICS = ['collected', 'collectionRate', 'changeCollected', 'changeRate'];
export const DEFAULT_METRIC = 'collected';
/** «نطاقات أداء التحصيل» — the title of the colour key of the rate-coloured metrics */
export const BANDS_TITLE = bi('نطاقات أداء التحصيل', 'Collection-performance bands');
export const RATE_COLOUR_BASIS = bi('نسبة التحصيل من صافي المفوتر', 'collection rate against net invoiced');

const RATE_BASIS_AR = 'نسبة التحصيل = المحصّل ÷ صافي المفوتر (صافي المفوتر = إجمالي المفوتر − الاستبعادات)، لنفس الفواتير والفترة والمصدر ونطاق الجهات المصرّح بها في البسط والمقام، مجمّعة من المبالغ (لا متوسط نسب الجهات). النطاقات: أحمر أقل من 40% · برتقالي 40% إلى أقل من 60% · أصفر 60% إلى أقل من 80% · أخضر 80% فأكثر · رمادي مخطّط = بيانات غير متاحة أو لا صافي مفوتر صالح (ليس 0%).';
const RATE_BASIS_EN = 'Collection rate = collected ÷ net invoiced (net invoiced = gross invoiced − exclusions), on the same invoices, period, source and authorised entities in numerator and denominator, aggregated from SUMMED amounts (never an average of entity percentages). Bands: red below 40 % · orange 40 % to under 60 % · yellow 60 % to under 80 % · green 80 % and above · gray/hatched = data unavailable or no valid net invoiced (not 0 %).';
export const METRICS = Object.freeze({
  collected: {
    id: 'collected', rule: 'rate', unit: 'money', signed: false, needsComparison: false,
    label: bi('المحصّل', 'Collected'), short: bi('المحصّل', 'Collected'),
    basis: bi('القيمة: المبلغ المحصّل على فواتير الفترة المختارة حتى تاريخ القطع، مجمّعًا للمنطقة من الجهات المصرّح لك بها. اللون: ' + RATE_BASIS_AR + ' المبلغ الكبير لا يعني نسبة تحصيل مرتفعة.', 'Value: the amount collected on the invoices of the selected period up to the cut-off, summed for the region from the entities you are authorised for. Color: ' + RATE_BASIS_EN + ' A large amount does not mean a high rate.'),
    caption: bi('القيمة: المحصّل · اللون: نسبة التحصيل من صافي المفوتر', 'Value: collected · Color: collection rate against net invoiced'),
    scaleNote: bi('الحدود ثابتة (وليست ترتيبًا بين المناطق)', 'Fixed thresholds (not a ranking of the regions)')
  },
  collectionRate: {
    id: 'collectionRate', rule: 'rate', unit: 'pct', signed: false, needsComparison: false,
    label: bi('نسبة التحصيل', 'Collection rate'), short: bi('نسبة التحصيل', 'Collection rate'),
    basis: bi('القيمة: ' + RATE_BASIS_AR + ' اللون: النطاقات نفسها.', 'Value: ' + RATE_BASIS_EN + ' Color: the same bands.'),
    caption: bi('القيمة: نسبة التحصيل · اللون: نسبة التحصيل من صافي المفوتر', 'Value: collection rate · Color: collection rate against net invoiced'),
    scaleNote: bi('أقل من 40% · 40–60% · 60–80% · 80% فأكثر', 'Below 40% · 40–60% · 60–80% · 80% and above')
  },
  changeCollected: {
    id: 'changeCollected', rule: 'changeCollected', unit: 'pct', signed: true, needsComparison: true,
    label: bi('التغير في المحصّل عن الفترة المقارنة', 'Change in collected vs the comparison period'), short: bi('التغير في المحصّل', 'Change in collected'),
    basis: bi('التغير النسبي (%) في المحصّل عن الفترة المقارنة (الفترة نفسها من العام الماضي أو الفترة السابقة المماثلة، من المقارنة الموجودة) المقاسة في نهاية فترتها. لا يُحسب إذا كان محصّل فترة المقارنة صفرًا أو أقل (جديد / غير متاح). اللون يصف حجم التغير: انخفاض 25% فأكثر أحمر · 10% إلى أقل من 25% برتقالي · أقل من 10% أصفر · ارتفاع أو دون تغيير أخضر · رمادي مخطّط = لا فترة مقارنة. الألوان تصف التغير وليست تقييم مخاطر.', 'Relative change (%) in collected against the comparison period (the same period last year or the previous like-for-like period, from the existing comparison), measured at the end of its own period. Not computed when the comparison period collected zero or less (new / unavailable). The color describes the size of the change: a decrease of 25 % or more red · 10 % to under 25 % orange · under 10 % yellow · an increase or no change green · gray/hatched = no comparison period. The colors describe the change; they are not a risk rating.'),
    caption: bi('القيمة: التغير في المحصّل (%) · اللون: حجم التغير عن الفترة المقارنة', 'Value: change in collected (%) · Color: the size of the change vs the comparison period'),
    scaleNote: bi('انخفاض 25% فأكثر · 10% · أقل من 10% · ارتفاع أو دون تغيير', 'Decrease 25 % or more · 10 % · under 10 % · increase or no change')
  },
  changeRate: {
    id: 'changeRate', rule: 'changeRate', unit: 'pp', signed: true, needsComparison: true,
    label: bi('التغير في نسبة التحصيل', 'Change in collection rate'), short: bi('التغير في النسبة', 'Change in rate'),
    basis: bi('الفرق بالنقاط المئوية بين نسبة التحصيل الآن ونسبتها في الفترة المقارنة (نقطة مئوية، وليس نسبة مئوية). اللون يصف حجم التغير: انخفاض 15 نقطة فأكثر أحمر · 5 إلى أقل من 15 برتقالي · أقل من 5 أصفر · ارتفاع أو دون تغيير أخضر · رمادي مخطّط = لا فترة مقارنة. الألوان تصف التغير وليست تقييم مخاطر.', 'The difference in percentage POINTS between the collection rate now and in the comparison period (points, not a percentage). The color describes the size of the change: a decrease of 15 points or more red · 5 to under 15 orange · under 5 yellow · an increase or no change green · gray/hatched = no comparison period. The colors describe the change; they are not a risk rating.'),
    caption: bi('القيمة: التغير في نسبة التحصيل (نقطة مئوية) · اللون: حجم التغير عن الفترة المقارنة', 'Value: change in collection rate (percentage points) · Color: the size of the change vs the comparison period'),
    scaleNote: bi('انخفاض 15 نقطة فأكثر · 5 · أقل من 5 · ارتفاع أو دون تغيير', 'Decrease 15 points or more · 5 · under 5 · increase or no change')
  }
});
export const metricInfo = (id) => METRICS[id] || METRICS[DEFAULT_METRIC];
/** the selector text of a metric: its label + the unit of the change («%» / «نقطة مئوية») so a percent and a point are never confused */
export function metricOptionText(id, lang = 'ar') {
  const m = metricInfo(id); const ar = lang === 'ar'; const l = ar ? m.label.ar : m.label.en;
  return id === 'changeCollected' ? `${l} (%)` : id === 'changeRate' ? `${l} (${ar ? 'نقطة مئوية' : 'pp'})` : l;
}

/** the comparison the change metrics are measured against: the existing comparison's basis, named for the person */
export function comparisonBasisText(comparison) {
  const kind = comparison?.comparable ? (comparison.basis === 'same_period_last_year' ? 'same_period_last_year' : 'previous_period') : null;
  if (kind === 'same_period_last_year') return { kind, label: bi('الفترة نفسها من العام الماضي', 'the same period last year') };
  if (kind === 'previous_period') return { kind, label: bi('الفترة السابقة المماثلة', 'the previous like-for-like period') };
  return { kind: null, label: bi('الفترة المقارنة (غير متاحة)', 'the comparison period (not available)') };
}

/** the coded cause of an unavailable value: a figure that cannot be computed is NEVER shown as 0 */
export const REASONS = Object.freeze({
  no_invoices: { short: bi('لا فواتير', 'No invoices'), message: bi('لا فواتير في هذه الجهة ضمن الفترة والمرشحات المختارة.', 'No invoices for this unit in the selected period and filters.') },
  no_comparison: { short: bi('لا مقارنة', 'No comparison'), message: bi('لا فترة مقارنة ضمن تغطية البيانات.', 'No comparison period inside the data coverage.') },
  zero_denominator: { short: bi('المقام صفر', 'Zero denominator'), message: bi('المقام صفر أو غير موجب (صافي المفوتر، أو محصّل فترة المقارنة)، فلا تُحسب النسبة.', 'The denominator is zero or not positive (net invoiced, or the comparison period’s collected), so the ratio is not computed.') },
  no_data: { short: bi('لا بيانات', 'No data'), message: bi('لا بيانات متاحة لهذه الوحدة.', 'No data is available for this unit.') },
  new: { short: bi('جديد', 'New'), message: bi('جديد: لا تحصيل موجب في فترة المقارنة، فلا تُحسب نسبة تغير.', 'New: nothing was collected in the comparison period, so no change rate is computed.') }
});
export const REASON_CODES = Object.keys(REASONS);

/* ---------------------------------------------------------------- formatting */
const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');
/**
 * The display parts of ONE value of a metric. `scale` = the money unit entry (UNITS.B …) shared by every row of the table so columns compare; pct/pp are fixed 1-decimal.
 * Zero never carries a sign. Money: number in the shared unit + « مليار ريال » / "bn SAR". pp is worded «نقطة مئوية» / "pp" and NEVER «%».
 */
export function formatValue(metricId, value, { lang = 'ar', scale = null, signed: forceSigned = null } = {}) {
  const m = metricInfo(metricId); const ar = lang === 'ar'; const isSigned = forceSigned == null ? m.signed : forceSigned; // `signed:true` prints a money amount with its sign (an increase / decrease in collected)
  if (!Number.isFinite(value)) return { sign: '', number: '—', unit: '', text: '—', direction: null };
  const rounded = m.unit === 'money' ? value : m.unit === 'pct' ? Math.round(value * 1000) / 10 : Math.round(value * 10) / 10;
  const signed = isSigned ? sgn(rounded === 0 ? 0 : value) : (value < 0 ? '−' : '');
  const direction = isSigned ? (rounded === 0 && m.unit !== 'money' ? 'flat' : value > 0 ? 'up' : value < 0 ? 'down' : 'flat') : null;
  if (m.unit === 'money') {
    const u = scale || pickUnit(Math.abs(value)); const p = fmtParts(Math.abs(value), { lang, unit: u });
    return { sign: signed, number: p.num, unit: p.label, text: `${signed}${p.num} ${p.label}`, direction };
  }
  if (m.unit === 'pp') { const n = Math.abs(rounded).toFixed(1); const unit = ar ? 'نقطة مئوية' : 'pp'; return { sign: signed, number: n, unit, text: `${signed}${n} ${unit}`, direction }; }
  const n = Math.abs(rounded).toFixed(1);
  return { sign: signed, number: n, unit: '%', text: `${signed}${n}%`, direction };
}

/* ---------------------------------------------------------------- legend */
// the cuts of a rule in the units of its DRIVER (for the legend's from/to and the docs): rate = fractions · changeCollected = fractions of the previous · changeRate = points
function cutsOf(ruleId) {
  const R = BAND_RULES[ruleId];
  if (ruleId === 'rate') return R.cuts.map((c) => c / 100);
  const k = R.unit === 'pct' ? 100 : 1;
  return [-R.decrease.critical / k, -R.decrease.attention / k, 0];
}

/**
 * The legend of a metric: the FIXED classes of its colour rule (red / orange / yellow / green) with their threshold text, the caption «القيمة … · اللون …» and the «unavailable» entry.
 * `values` is accepted for API compatibility and ignored: the classes never depend on the other regions. `scale` = the money unit entry used by the VALUES (the legend states the value unit).
 * `comparison` = the dataset's comparison: the change metrics NAME the comparison basis in the caption («… عن الفترة نفسها من العام الماضي»).
 */
export function buildLegend(metricId, values = [], { scale = null, comparison = null } = {}) { // eslint-disable-line no-unused-vars
  const m = metricInfo(metricId); const R = BAND_RULES[m.rule]; const cuts = cutsOf(m.rule);
  const classes = legendClasses(m.rule);
  const rangeOf = (i) => [i === 0 ? null : cuts[i - 1], i === classes.length - 1 ? null : cuts[i]];
  const unitMeta = m.unit === 'money'
    ? { kind: 'money', scale: scale ? scale.key : null, label: bi(scale ? `${scale.ar ? `${scale.ar} ` : ''}ريال` : 'ريال', scale ? `${scale.en ? `${scale.en} ` : ''}SAR` : 'SAR') }
    : m.unit === 'pp' ? { kind: 'pp', scale: null, label: bi('نقطة مئوية', 'percentage points') }
      : { kind: 'pct', scale: null, label: bi('%', '%') };
  const na = NA_LEGEND(m.rule);
  const cb = m.needsComparison ? comparisonBasisText(comparison) : null;
  const caption = cb
    ? (m.id === 'changeCollected'
      ? bi(`القيمة: التغير في المحصّل (%) عن ${cb.label.ar} · اللون: حجم التغير`, `Value: change in collected (%) vs ${cb.label.en} · Color: the size of the change`)
      : bi(`القيمة: التغير في نسبة التحصيل (نقطة مئوية) عن ${cb.label.ar} · اللون: حجم التغير`, `Value: change in collection rate (percentage points) vs ${cb.label.en} · Color: the size of the change`))
    : m.caption;
  return {
    metric: m.id, rule: m.rule, kind: R.family, unit: unitMeta, thresholds: cuts,
    buckets: classes.map((c, index) => ({ index, cls: c.cls, glyph: c.glyph, color: c.color, name: c.name, label: c.label, from: rangeOf(index)[0], to: rangeOf(index)[1] })),
    na, notAvailable: bi(`${na.name.ar} — ${na.label.ar}`, `${na.name.en} — ${na.label.en}`),
    labels: m.label, basis: m.basis, caption, scaleNote: m.scaleNote, source: R.source, comparisonBasis: cb,
    bandsTitle: R.family === 'rate' ? BANDS_TITLE : bi('حجم التغير', 'Size of the change')
  };
}

/** the colour class of a DRIVER on a legend: { bucket, buckets, cls, glyph, fill, tone } — a missing / non-finite driver has NO bucket (bucket null, fill null) */
export function colorOf(legend, driver) {
  const n = legend.buckets.length; const cls = Number.isFinite(driver) ? classOf(legend.rule, driver) : null;
  if (!cls) return { bucket: null, buckets: n, cls: 'na', glyph: glyphOf(legend.rule, 'na'), fill: null, tone: null };
  const bucket = legend.buckets.findIndex((b) => b.cls === cls);
  return { bucket, buckets: n, cls, glyph: legend.buckets[bucket].glyph, fill: CLASS_COLORS[cls], tone: cls === 'ok' ? 'pos' : 'neg' };
}

export { UNITS };
