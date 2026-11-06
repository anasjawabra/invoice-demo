// COLLECTION-PERFORMANCE BANDS — the ONE classification (and the ONE palette) behind every colour of «الأداء حسب المنطقة» on /insights: map fill · legend · table band column · tooltip/card ·
// details panel · summary text · export column. Pure: no React, no I/O, NO plan/target of any kind (docs/insights-redesign-spec.md «Implementation notes — S (decoupling)»).
//
// Colour is never the only cue: every class has a glyph and a text label. There is NO blue and NO relative ranking: a class depends on the value against an explicit threshold,
// never on the other regions (shuffle the regions ⇒ the same classes).
//
//   rate  (COLLECTION_RATE_BANDS)  collection rate = collected ÷ net invoiced (net invoiced = gross invoiced − exclusions), the SAME population / period basis / source filter / authorised scope for both amounts,
//                                  aggregated from SUMMED amounts (never an average of entity percentages), judged at the 0.1 point the page prints:
//                                  RED  < 40 %  ·  ORANGE  40 % to < 60 %  ·  YELLOW  60 % to < 80 %  ·  GREEN  ≥ 80 %      (= components/strategic/PctScale.jsx PCT_CUTS, the one scale every percentage of the app uses)
//                                  GRAY / hatching = unavailable (no invoices, or net invoiced ≤ 0 — never shown as 0 %).
//   changeCollected / changeRate   (CHANGE_BANDS) the CHANGE against the comparison period (same period last year, or the previous like-for-like period — the existing comparison), described by its size:
//                                  a decrease ≥ 25 % (≥ 15 pp for the rate) RED · ≥ 10 % (≥ 5 pp) ORANGE · any smaller decrease YELLOW · an increase or no change GREEN · no comparable period ⇒ GRAY «غير متاح» (never 0).
//                                  A boundary value belongs to the WORSE class (a decrease of exactly 10 % is orange). The labels describe the CHANGE; they are not an assessment of risk.
//
//   classifyRate(rate) / classifyChange('changeCollected'|'changeRate', value) → class id | null          rate / change as a FRACTION (0.4 = 40 %), changeRate in percentage POINTS
//   classOf(ruleId, driver) · statusOf(ruleId, driver, extra?) · unavailableStatus(ruleId, { reason, reasonLabel, message, detail })
//   status = { rule, family:'rate'|'change', cls, available, rank, glyph, color, label{ar,en}, rangeText{ar,en}|null, driver, reason?, reasonLabel?, message?, detail? }
//   legendClasses(ruleId) → [{ index, cls, glyph, color, name, label }]     RULE_TABLE → the whole table, bilingual (the info control + the docs)     bandCell(rate) → the export cell
const bi = (ar, en) => ({ ar, en });
const r1 = (x) => Math.round(x * 10) / 10;

/* ---------------------------------------------------------------- the palette (no blue) */
// red · orange · yellow · green are the shared percentage colours (components/strategic/PctScale.jsx re-exports them); the hatch (NA_COLORS) = unavailable
export const CLASS_COLORS = Object.freeze({ critical: '#e53935', attention: '#f4903b', slight: '#fde85c', ok: '#4caf2f' });
export const NA_COLORS = Object.freeze({ base: '#F3F4F6', stroke: '#8A919C' });
export const PCT_COLORS_4 = Object.freeze([CLASS_COLORS.critical, CLASS_COLORS.attention, CLASS_COLORS.slight, CLASS_COLORS.ok]);
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
/** the text colour that reads on a fill (WCAG contrast) */
export const inkOn = (hex) => (hex && lum(hex) < 0.32 ? '#FFFFFF' : '#111927');
export const CLASS_ORDER = Object.freeze(['critical', 'attention', 'slight', 'ok', 'na']);

/* ---------------------------------------------------------------- THE BANDS (the only place thresholds live) */
/** the collection-rate bands, in PERCENT: the lower bounds of orange / yellow / green (red is everything below the first) */
export const COLLECTION_RATE_BANDS = Object.freeze({ cuts: Object.freeze([40, 60, 80]), classes: Object.freeze(['critical', 'attention', 'slight', 'ok']) });
/** the size of a decrease that makes it red / orange (below `attention` but above 0 = yellow); `unit` pct = the relative change of collected, pp = percentage POINTS of the collection rate */
export const CHANGE_BANDS = Object.freeze({
  changeCollected: Object.freeze({ unit: 'pct', critical: 25, attention: 10 }),
  changeRate: Object.freeze({ unit: 'pp', critical: 15, attention: 5 })
});
export const BAND_RULES = Object.freeze({
  rate: Object.freeze({ id: 'rate', family: 'rate', unit: 'pct', classes: COLLECTION_RATE_BANDS.classes, cuts: COLLECTION_RATE_BANDS.cuts, measure: bi('نسبة التحصيل (المحصّل ÷ صافي المفوتر)', 'Collection rate (collected ÷ net invoiced)'),
    source: bi('السلّم الموثّق المشترك للنسب المئوية (40 / 60 / 80%)؛ صافي المفوتر = إجمالي المفوتر − الاستبعادات.', 'The documented shared percentage scale (40 / 60 / 80 %); net invoiced = gross invoiced − exclusions.') }),
  changeCollected: Object.freeze({ id: 'changeCollected', family: 'change', unit: 'pct', classes: Object.freeze(['critical', 'attention', 'slight', 'ok']), decrease: CHANGE_BANDS.changeCollected, measure: bi('التغير النسبي في المحصّل عن الفترة المقارنة', 'Relative change in collected vs the comparison period'),
    source: bi('حدود حجم الانخفاض: 25% فأكثر أحمر، 10% إلى أقل من 25% برتقالي، أقل من 10% أصفر؛ الارتفاع أو عدم التغير أخضر. تصف الألوان التغير وليست تقييم مخاطر.', 'Size of a decrease: 25 % or more red, 10 % to under 25 % orange, under 10 % yellow; an increase or no change green. The colours describe the change; they are not a risk rating.') }),
  changeRate: Object.freeze({ id: 'changeRate', family: 'change', unit: 'pp', classes: Object.freeze(['critical', 'attention', 'slight', 'ok']), decrease: CHANGE_BANDS.changeRate, measure: bi('تغير نسبة التحصيل (نقطة مئوية) عن الفترة المقارنة', 'Change in the collection rate (percentage points) vs the comparison period'),
    source: bi('حدود حجم الانخفاض: 15 نقطة مئوية فأكثر أحمر، 5 إلى أقل من 15 برتقالي، أقل من 5 أصفر؛ الارتفاع أو عدم التغير أخضر. تصف الألوان التغير وليست تقييم مخاطر.', 'Size of a decrease: 15 percentage points or more red, 5 to under 15 orange, under 5 yellow; an increase or no change green. The colours describe the change; they are not a risk rating.') })
});
export const RULE_IDS = Object.freeze(Object.keys(BAND_RULES));

/* ---------------------------------------------------------------- classification */
/** collection rate (a fraction) → critical | attention | slight | ok (null when it is not a number). Judged at the 0.1 point the page prints, so a value printed «80.0%» is green. */
export function classifyRate(rate) {
  if (!Number.isFinite(rate)) return null;
  const p = r1(rate * 100); const cuts = COLLECTION_RATE_BANDS.cuts;
  return COLLECTION_RATE_BANDS.classes[cuts.filter((c) => p >= c).length];
}
/** a change: `changeCollected` takes the relative change as a FRACTION (-0.12 = −12 %), `changeRate` the change in percentage POINTS (-3.4). → critical | attention | slight | ok */
export function classifyChange(ruleId, value) {
  if (!Number.isFinite(value)) return null;
  const R = BAND_RULES[ruleId]; if (!R || R.family !== 'change') return null;
  const v = R.unit === 'pct' ? r1(value * 100) : r1(value);
  if (-v >= R.decrease.critical) return 'critical';
  if (-v >= R.decrease.attention) return 'attention';
  return v < 0 ? 'slight' : 'ok';
}
export function classOf(ruleId, driver) { return ruleId === 'rate' ? classifyRate(driver) : classifyChange(ruleId, driver); }

/* ---------------------------------------------------------------- texts */
const GLYPHS = { rate: { critical: '▼▼', attention: '▼', slight: '◐', ok: '✓', na: '○' }, change: { critical: '▼▼', attention: '▼', slight: '▽', ok: '▲', na: '○' } };
const NAMES = {
  rate: { critical: bi('نسبة منخفضة جدًا', 'Very low rate'), attention: bi('نسبة منخفضة', 'Low rate'), slight: bi('نسبة متوسطة', 'Medium rate'), ok: bi('نسبة مرتفعة', 'High rate') },
  change: { critical: bi('انخفاض كبير', 'Large decrease'), attention: bi('انخفاض', 'Decrease'), slight: bi('انخفاض طفيف', 'Slight decrease'), ok: bi('ارتفاع أو دون تغيير', 'Increase or no change') }
};
const NA_NAMES = { rate: bi('غير متاح', 'Not available'), change: bi('غير متاح', 'Not available') };
const f1 = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
/** the threshold text of a class, bilingual: «أقل من 40%» … */
function rangeText(ruleId, cls) {
  const R = BAND_RULES[ruleId];
  if (ruleId === 'rate') {
    const [a, b, c] = R.cuts;
    return { critical: bi(`أقل من ${a}%`, `Below ${a}%`), attention: bi(`${a}% إلى أقل من ${b}%`, `${a}% to under ${b}%`), slight: bi(`${b}% إلى أقل من ${c}%`, `${b}% to under ${c}%`), ok: bi(`${c}% فأكثر`, `${c}% and above`) }[cls];
  }
  const d = R.decrease; const pp = R.unit === 'pp';
  const unitAr = (v) => (pp ? (v >= 3 && v <= 10 ? ' نقاط مئوية' : ' نقطة مئوية') : '%'); // Arabic plural: 3–10 «نقاط», otherwise «نقطة»
  const unitEn = pp ? ' pp' : '%';
  return {
    critical: bi(`انخفاض ${f1(d.critical)}${unitAr(d.critical)} فأكثر`, `Decrease of ${f1(d.critical)}${unitEn} or more`),
    attention: bi(`انخفاض ${f1(d.attention)}${unitAr(d.attention)} إلى أقل من ${f1(d.critical)}${unitAr(d.critical)}`, `Decrease of ${f1(d.attention)} to under ${f1(d.critical)}${unitEn}`),
    slight: bi(`انخفاض أقل من ${f1(d.attention)}${unitAr(d.attention)}`, `Decrease of under ${f1(d.attention)}${unitEn}`),
    ok: bi('صفر أو أكثر (دون انخفاض)', 'Zero or more (no decrease)')
  }[cls];
}
export const classRank = (cls) => CLASS_ORDER.indexOf(cls);
const nameOf = (ruleId, cls) => (cls === 'na' ? NA_NAMES[BAND_RULES[ruleId].family] : NAMES[BAND_RULES[ruleId].family][cls]);
export const glyphOf = (ruleId, cls) => GLYPHS[BAND_RULES[ruleId].family][cls] || GLYPHS.rate.na;

/** the classes of a rule for the legend and the info control, worst first: [{ index, cls, glyph, color, name, label (the threshold text) }] */
export function legendClasses(ruleId) {
  const R = BAND_RULES[ruleId];
  return R.classes.map((cls, index) => ({ index, cls, glyph: glyphOf(ruleId, cls), color: CLASS_COLORS[cls], name: nameOf(ruleId, cls), label: rangeText(ruleId, cls) }));
}
export const thresholdRows = legendClasses;
export const NA_LEGEND = (ruleId) => ({ cls: 'na', glyph: GLYPHS.rate.na, name: nameOf(ruleId, 'na'), label: ruleId === 'rate' ? bi('بيانات غير متاحة أو لا صافي مفوتر صالح (صفر أو أقل) — ليست 0%', 'Data unavailable or no valid net invoiced (zero or less) — not 0%') : bi('لا فترة مماثلة سابقة للمقارنة — ليس صفرًا', 'No comparable previous period — not zero') });
/** the whole table, ready to print: { [rule]: { measure, source, classes:[…], na } } */
export const RULE_TABLE = Object.freeze(Object.fromEntries(RULE_IDS.map((id) => [id, { id, measure: BAND_RULES[id].measure, source: BAND_RULES[id].source, classes: legendClasses(id), na: NA_LEGEND(id) }])));

/* ---------------------------------------------------------------- the status object */
/** a status of an AVAILABLE figure. `driver` = the figure the rule judges (rate · change); `extra` is merged in. */
export function statusOf(ruleId, driver, extra = {}) {
  const cls = classOf(ruleId, driver); if (!cls) return unavailableStatus(ruleId, { reason: 'no_data' });
  const R = BAND_RULES[ruleId];
  return { rule: ruleId, family: R.family, cls, available: true, rank: classRank(cls), glyph: glyphOf(ruleId, cls), color: CLASS_COLORS[cls], label: nameOf(ruleId, cls), rangeText: rangeText(ruleId, cls), driver, ...extra };
}
/** an UNAVAILABLE figure: gray / hatched, with the coded reason — never a band, never zero */
export function unavailableStatus(ruleId, { reason = 'no_data', reasonLabel = null, message = null, detail = null } = {}, extra = {}) {
  const R = BAND_RULES[ruleId];
  return { rule: ruleId, family: R.family, cls: 'na', available: false, rank: classRank('na'), glyph: GLYPHS.rate.na, color: null, label: nameOf(ruleId, 'na'), rangeText: null, driver: null, reason, reasonLabel, message, detail, ...extra };
}
/** the status text sentence of a status (glyph + name), for the tooltip / the accessible name / the export cell */
export const statusText = (st, lang = 'ar') => `${st.glyph} ${(lang === 'ar' ? st.label.ar : st.label.en)}`;

/* ---------------------------------------------------------------- the export cell */
/**
 * The text of the «نطاق أداء التحصيل» column of the exported «حسب المنطقة» table — the SAME classifier as the map / table / card / panel, from SUMMED collected and SUMMED net.
 *   { collected, net } of the row (net ≤ 0 or missing ⇒ unavailable, never 0 %)  → { cls, available, text{ar,en} }
 */
export function bandCell({ collected = null, net = null } = {}) {
  const NA = GLYPHS.rate.na;
  if (!Number.isFinite(collected) || !Number.isFinite(net) || !(net > 1e-9)) return { cls: 'na', available: false, text: bi(`${NA} غير متاح — لا صافي مفوتر صالح`, `${NA} Not available — no valid net invoiced`) };
  const rate = collected / net; const st = statusOf('rate', rate); const pct = `${(Math.round(rate * 1000) / 10).toFixed(1)}%`;
  return { cls: st.cls, available: true, text: bi(`${st.glyph} ${st.label.ar} (${pct}) — ${st.rangeText.ar}`, `${st.glyph} ${st.label.en} (${pct}) — ${st.rangeText.en}`) };
}
