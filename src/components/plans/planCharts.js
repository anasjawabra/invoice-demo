// Pure builders of the plan detail's charts and breakdown table — over ONE planning basis (planBasis.js) and its forecast (planForecast.js). Period-aware: the months are the plan's own months (any date range),
// never a fixed 12-month year. Blocks follow the shared chart contract (docs/chart-library.md §2): { type:'chart', id, kind, title, labels, series:[{label, values, role?, dashed?}], keys, tips, note, unit:'SAR' … }.
//   planCumulativeBlock(basis, forecast, {lang})   cumulative planned · actual (to the cut-off) · the planned-to-date point · the forecast as its own dashed series · the TARGET as the reference line
//   planDeviationBlock(basis, {lang, nameOf, topN, selected})   signed bars of `actual − planned to date` by entity (or by municipality) + one «أخرى» row so that Σ bars = the scope deviation to the riyal
//   planBreakdown(basis, {lang, nameOf})   the table behind it, with the reconciliation (Σ municipalities + «غير موزع على البلديات» = the Amanah) for the target AND the actual
import { planMonthLabel, UNALLOCATED_MUNI_KEY, UNALLOCATED_MUNI_LABEL, NO_MUNICIPAL_TARGET } from '../../data/plans/planBasis';

const bi = (ar, en) => ({ ar, en });
const pick = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'en' ? o.en : o.ar) || o.en || '');
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
export const OTHER_LABEL = bi('أخرى', 'Other');
const f0 = (v) => Math.round(v).toLocaleString('en-US');

/* ------------------------------------------------------------------------------------------------ cumulative */
export function planCumulativeBlock(basis, forecast, { lang = 'ar' } = {}) {
  if (!basis || !Array.isArray(basis.months) || !basis.months.length || !basis.cumulative) return null;
  const L = (a, e) => (lang === 'ar' ? a : e); const T = basis.target?.value || 0; const cut = basis.reportingCutoff;
  const multiYear = basis.periodInfo && basis.periodInfo.months > 12;
  const keepYear = multiYear || basis.state === 'future_period' || (!!cut && cut.slice(0, 4) !== String(basis.period?.start || '').slice(0, 4)); // a plan of another year than the reporting year names its year on the axis (Jan 2027 … Dec 2027)
  const labels = basis.months.map((m) => { const lb = planMonthLabel(m.ym); const t = pick(lb, lang); return keepYear ? t : t.replace(/\s\d{4}$/, ''); });
  const ci = basis.months.findIndex((m) => m.cutoffMonth); const lastReached = basis.months.reduce((a, m, i) => (m.reached ? i : a), -1);
  const upcoming = basis.state === 'future_period'; // the period has not started: the PLAN only (its monthly schedule and the target) — no actual, no planned-to-date point, no forecast
  const series = upcoming ? [] : [{ label: L(`الفعلي حتى ${cut || '—'}`, `Actual to ${cut || '—'}`), values: basis.months.map((m) => (fin(m.actualCum) ? m.actualCum : null)), role: 'collected', kind: 'actual' }];
  const hasPlan = T > 0 && basis.months.some((m) => fin(m.plannedCum));
  if (hasPlan) {
    const assumed = !!basis.profile?.assumption;
    series.push({ label: L(`المخطط التراكمي${assumed ? ' (توزيع متساوٍ — افتراض)' : ''}`, `Cumulative plan${assumed ? ' (equal distribution — an assumption)' : ''}`), values: basis.months.map((m) => (fin(m.plannedCum) ? m.plannedCum : null)), role: 'target', kind: 'planned' });
    if (!upcoming && fin(basis.plannedToDate) && lastReached >= 0) series.push({ label: L(`المخطط حتى تاريخه (${cut})`, `Planned to date (${cut})`), values: basis.months.map((m, i) => (i === (ci >= 0 ? ci : lastReached) ? basis.plannedToDate : null)), role: 'gross', kind: 'planned_to_date' });
    series.push({ label: L('المستهدف الكامل للفترة', 'The full-period target'), values: basis.months.map(() => T), role: 'gross', dashed: true, kind: 'target' });
  }
  const upForecast = upcoming && !!forecast && forecast.state === 'ok' && forecast.upcoming === true; // an UPCOMING period's forecast (the run-rate over the whole period) — a dashed series of its own, never the schedule
  if ((!upcoming || upForecast) && forecast && forecast.state === 'ok' && Array.isArray(forecast.cumulative)) {
    series.push({ label: upForecast ? L('توقع للفترة — ليس مخططاً ولا فعلياً (متوسط آخر 3 أشهر مكتملة)', 'Forecast for the period — neither the plan nor actual (average of the last 3 complete months)') : L('توقع — ليس فعلياً (متوسط آخر 3 أشهر مكتملة)', 'Forecast — not actual (average of the last 3 complete months)'), values: forecast.cumulative.map((v) => (fin(v) ? v : null)), role: 'uncollected', dashed: true, kind: 'forecast' });
  }
  const a = basis.period?.start; const b = basis.period?.end;
  return {
    type: 'chart', id: 'plan:cumulative', kind: 'line', markers: true, basis: 'cumulative', unit: 'SAR',
    title: upcoming ? L('التراكمي: المخطط للفترة', 'Cumulative: the plan of the period') : L('التراكمي: الفعلي والمخطط والتوقع', 'Cumulative: actual, plan and forecast'), labels, series, period: { from: a, to: b }, cutoff: cut,
    note: upcoming ? L(`المبالغ تراكمية بالريال السعودي. الفترة لم تبدأ بعد (${a}): المعروض هو الخطة ومستهدفها${upForecast ? ' وخط متقطع للتوقع (ليس مخططاً)' : ' فقط، ولا فعلي ولا توقع'}.${basis.profile?.assumption ? ' المخطط بتوزيع متساوٍ — افتراض.' : ''}`, `Cumulative amounts in SAR. The period has not started (${a}): the plan and its target are shown${upForecast ? ' with a dashed forecast line (not the plan)' : ' only, no actual and no forecast'}.${basis.profile?.assumption ? ' The plan is an equal distribution — an assumption.' : ''}`) : L(`المبالغ تراكمية بالريال السعودي. الفعلي ينتهي عند ${cut} (لا قيمة بعده). الخط المتقطع للتوقع ليس فعلياً. خط المستهدف مرجع لا سلسلة فعلية.${basis.profile?.assumption ? ' المخطط بتوزيع متساوٍ — افتراض.' : ''}`,
      `Cumulative amounts in SAR. The actual ends at ${cut} (no value after it). The dashed forecast line is not actual. The target line is a reference, not a series of actuals.${basis.profile?.assumption ? ' The plan is an equal distribution — an assumption.' : ''}`)
  };
}

/* ------------------------------------------------------------------------------------------------ deviation by entity / municipality */
const rowLabel = (e, nameOf, lang) => (e.rowKind === 'unallocated_muni' ? pick(UNALLOCATED_MUNI_LABEL, lang) : e.rowKind === 'municipality' ? pick(e.label, lang) : pick(nameOf(e.key), lang));
function tipOf(e, lang, name) {
  const r = fin(e.vsPlanRatio) ? `${(e.vsPlanRatio * 100).toFixed(1)}%` : '—';
  return lang === 'ar' ? `${name}: نسبة الإنجاز مقابل المخطط ${r} · المحصّل ${f0(e.actual)} مقابل المخطط ${f0(e.plannedToDate)} ريال` : `${name}: performance against plan ${r} · collected ${f0(e.actual)} vs planned ${f0(e.plannedToDate)} SAR`;
}
/** → { available, reason, block, shown, folded, other, sum, scopeDeviation, reconciles, kind:'entity'|'municipality' } */
export function planDeviationBlock(basis, { lang = 'ar', nameOf = (k) => k, topN = 10, selected = null } = {}) {
  const scopeDev = basis?.deviation?.amount; const kind = basis?.rowsKind === 'municipality' ? 'municipality' : 'entity';
  const out = { available: false, reason: null, block: null, shown: [], folded: [], other: null, sum: null, scopeDeviation: fin(scopeDev) ? scopeDev : null, reconciles: false, kind };
  if (!basis || !fin(scopeDev)) { out.reason = bi('لا انحراف قابل للحساب لهذا الاختيار (لا مستهدف أو لا بيانات أو لم يُحدد مستهدف للبلدية).', 'No deviation can be computed for this selection (no target, no data, or no municipal target).'); return out; }
  if (basis.viewScope?.muni && basis.viewScope.muni !== 'all') { out.reason = bi('الاختيار الحالي بلدية واحدة؛ اختر «كل البلديات التابعة للأمانة» لمقارنة البلديات.', 'The current selection is one municipality; choose “All the Amanah’s municipalities” to compare the municipalities.'); return out; }
  if (basis.viewScope?.amanah && basis.viewScope.amanah !== 'all' && kind === 'entity') { out.reason = bi('الأمانة المختارة غير موزعة على البلديات في هذه الخطة؛ لا مقارنة أدنى مستوى متاحة.', 'The selected Amanah is not distributed to municipalities in this plan; there is no lower-level comparison.'); return out; }
  const rows = (basis.entities || []).filter((e) => e.hasTarget && fin(e.deviation));
  if (rows.length < 2) { out.reason = bi('لا تكفي جهات بمستهدف للمقارنة.', 'Not enough rows with a target to compare.'); return out; }
  const byMag = rows.slice().sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation) || (a.key < b.key ? -1 : 1));
  const shownSet = new Set(byMag.slice(0, Number.isFinite(topN) ? topN : rows.length).map((e) => e.key));
  if (selected && rows.some((e) => e.key === selected)) shownSet.add(selected);
  const shown = rows.filter((e) => shownSet.has(e.key)).sort((a, b) => a.deviation - b.deviation || (a.key < b.key ? -1 : 1));
  const folded = rows.filter((e) => !shownSet.has(e.key));
  const other = scopeDev - sum(shown, (e) => e.deviation); // folded rows + rows without a target + receipts not attributed to a row — by construction Σ bars = the scope deviation
  const showOther = folded.length > 0 || Math.abs(other) >= 0.5;
  const names = shown.map((e) => rowLabel(e, nameOf, lang));
  const labels = names.slice(); const values = shown.map((e) => e.deviation); const keys = shown.map((e) => e.key); const tips = shown.map((e, i) => tipOf(e, lang, names[i]));
  if (showOther) {
    labels.push(folded.length ? `${pick(OTHER_LABEL, lang)} (${folded.length})` : pick(OTHER_LABEL, lang)); values.push(other); keys.push(null);
    tips.push(lang === 'ar' ? `الباقي حتى يساوي مجموع الأشرطة الانحراف الكلي${folded.length ? `: ${folded.length} صفاً` : ' (صفوف بلا مستهدف أو إيرادات غير منسوبة لصف)'}` : `The remainder so that the bars add up to the total deviation${folded.length ? `: ${folded.length} rows` : ' (rows without a target, or collections not attributed to a row)'}`);
  }
  const total = sum(values, (v) => v); const L = (a, e) => (lang === 'ar' ? a : e);
  const block = {
    type: 'chart', id: 'plan:deviation', kind: 'hbar', unit: 'SAR',
    title: kind === 'municipality' ? L('الانحراف عن المخطط حتى تاريخه حسب البلدية', 'Deviation from the plan to date, by municipality') : L('الانحراف عن المخطط حتى تاريخه حسب الجهة', 'Deviation from the plan to date, by entity'),
    labels, series: [{ label: L('الانحراف = المحصّل − المخطط حتى تاريخه', 'Deviation = collected − planned to date'), values }], keys, tips,
    basis: L(`المحصّل من ${basis.period?.start} مقابل المخطط التراكمي حتى تاريخ الإغلاق${basis.profile?.assumption ? ' (توزيع متساوٍ — افتراض)' : ''}`, `Collected from ${basis.period?.start} against the cumulative plan to the cut-off${basis.profile?.assumption ? ' (equal distribution — an assumption)' : ''}`),
    period: { from: basis.period?.start, to: basis.reportingCutoff }, cutoff: basis.reportingCutoff, valueTitle: L('الانحراف (سالب = دون المخطط)', 'Deviation (negative = below plan)'),
    note: L(`المبالغ بالريال السعودي حتى ${basis.reportingCutoff}. السالب = دون المخطط حتى تاريخه. مجموع الأشرطة${showOther ? ' (مع صف «أخرى»)' : ''} = الانحراف الكلي ${f0(total)} ريالاً.`, `Amounts in SAR to ${basis.reportingCutoff}. Negative = below the plan to date. The bars${showOther ? ' (including “Other”)' : ''} add up to the total deviation of SAR ${f0(total)}.`),
    selectedKey: selected || null
  };
  return { available: true, reason: null, block, shown, folded, other: showOther ? other : 0, sum: total, scopeDeviation: scopeDev, reconciles: Math.abs(total - scopeDev) <= 1, kind };
}

/* ------------------------------------------------------------------------------------------------ the breakdown table + reconciliation */
/**
 * rows of the table behind the chart: one per entity / municipality (+ «غير موزع على البلديات»), each { key, label, kind, target, targetState, actual, planned, deviation, vsPlanRatio, achievement, noTarget, reason }
 * `reconcile` (an Amanah view with municipal allocations only): Σ municipalities + unallocated = the Amanah, for the target AND the actual — { target:{ sum, amanah, ok }, actual:{ sum, amanah, ok } }.
 */
export function planBreakdown(basis, { lang = 'ar', nameOf = (k) => k } = {}) {
  if (!basis || !Array.isArray(basis.entities) || !basis.entities.length) return { rows: [], kind: 'entity', reconcile: null, totals: null };
  const kind = basis.rowsKind === 'municipality' ? 'municipality' : 'entity';
  const rows = basis.entities.map((e) => ({
    key: e.key, rowKind: e.rowKind || 'entity', label: rowLabel(e, nameOf, lang), target: e.target ?? null, targetState: e.targetState || (e.hasTarget ? null : 'no_target'), actual: e.actual ?? null, planned: e.plannedToDate ?? null,
    deviation: e.deviation ?? null, vsPlanRatio: e.vsPlanRatio ?? null, achievement: e.achievementToDate ?? null, noTarget: e.target == null && e.rowKind === 'municipality', excess: !!e.excess,
    reason: e.targetState === 'no_municipal_target' ? NO_MUNICIPAL_TARGET : null
  }));
  let reconcile = null;
  if (kind === 'municipality' && basis.municipal && !basis.municipal.targetHidden) {
    const muni = rows.filter((r) => r.rowKind === 'municipality'); const un = rows.find((r) => r.key === UNALLOCATED_MUNI_KEY);
    const tSum = sum(muni, (r) => r.target) + (un?.target || 0); const aSum = sum(rows, (r) => r.actual);
    reconcile = { target: { sum: tSum, amanah: basis.municipal.amanahTarget, ok: fin(basis.municipal.amanahTarget) && Math.abs(tSum - basis.municipal.amanahTarget) < 1 }, actual: { sum: aSum, amanah: basis.actualToDate, ok: fin(basis.actualToDate) && Math.abs(aSum - basis.actualToDate) < 1 }, excess: basis.municipal.excess || 0 };
  }
  return { rows, kind, reconcile, totals: { target: basis.target?.value ?? null, actual: basis.actualToDate ?? null, planned: basis.plannedToDate ?? null, deviation: basis.deviation?.amount ?? null } };
}

/* ------------------------------------------------------------------------------------------------ bullets: actual · planned to date · the PLAN-PERIOD target on ONE axis */
/** the names of the plan's target for the axis and the legend — period-aware: a calendar-year plan «مستهدف عام 2026», a derived remaining-of-annual plan «المستهدف المتبقي للفترة», any other range «مستهدف الفترة» */
export function planTargetWords(basis, { derived = false, fmtDate = (d) => d } = {}) {
  const a = basis?.period?.start; const b = basis?.period?.end; const rng = a && b ? `${fmtDate(a)} – ${fmtDate(b)}` : '';
  if (derived) { const y = a ? a.slice(0, 4) : ''; return { tick: bi(`مستهدف المتبقي من ${y}`, `Remaining-of-${y} target`), axis: bi(`نسبة من مستهدف المتبقي من ${y} (${rng})`, `% of the remaining-of-${y} target (${rng})`), of: bi(`من مستهدف المتبقي من ${y}`, `of the remaining-of-${y} target`), title: bi(`الفعلي مقابل المخطط حتى تاريخه ومستهدف المتبقي من ${y}`, `Actual against planned to date and the remaining-of-${y} target`), derived: true }; }
  if (basis?.periodInfo?.isCalendarYear && basis.periodInfo.year) { const y = basis.periodInfo.year; return { tick: bi(`مستهدف عام ${y}`, `${y} target`), axis: bi(`نسبة من مستهدف عام ${y}`, `% of the ${y} target`), of: bi(`من مستهدف عام ${y}`, `of the ${y} target`), title: bi(`الفعلي مقابل المخطط حتى تاريخه ومستهدف عام ${y}`, `Actual against planned to date and the ${y} target`) }; }
  return { tick: bi('مستهدف الفترة', 'Period target'), axis: bi(`نسبة من مستهدف الفترة (${rng})`, `% of the period target (${rng})`), of: bi('من مستهدف الفترة', 'of the period target'), title: bi('الفعلي مقابل المخطط حتى تاريخه ومستهدف الفترة', 'Actual against planned to date and the period target') };
}
/**
 * One bullet row for the view scope (the plan, the Amanah, the viewer's available total …) + the rows of the page (entities, or municipalities of an Amanah view): collected · planned to date · the plan-period target, as a % of that target.
 * Nothing is capped at 100 %: `axisMax` = the largest of 1 and every row's collected / target and planned / target. A row WITHOUT a target (or without actuals) is listed in `missing`, never drawn.
 * Needs the period to have started (an UPCOMING plan has no actual): then `available:false`. The rows are the basis rows themselves — nothing is recomputed.
 * → { available, reason, rows:[{ key, label, scope, actual, planned, target, achievementPct, plannedPct, positionVsPlan }], missing:[label], hidden, total, axisMax, words, kind }
 */
export function planBulletRows(basis, { lang = 'ar', nameOf = (k) => k, top = 5, all = false, derived = false, fmtDate } = {}) {
  const kind = basis?.rowsKind === 'municipality' ? 'municipality' : 'entity'; const words = planTargetWords(basis, { derived, fmtDate });
  const out = { available: false, reason: null, rows: [], missing: [], hidden: 0, total: 0, axisMax: 1, words, kind };
  if (!basis) return out;
  if (basis.state === 'future_period') { out.reason = bi('لا فعلي ولا مخطط حتى تاريخه قبل بدء الفترة.', 'No actual and no planned-to-date figures before the period starts.'); return out; }
  const T = basis.target?.value || 0;
  const scopeLabel = basis.viewLabel || basis.scopeLabel || (basis.scope && basis.scope.kind === 'entities' ? bi('إجمالي الخطة', 'Plan total') : bi('الوزارة (كل الجهات)', 'The Ministry (all entities)'));
  const scopeName = pick(scopeLabel, lang); const rows = [];
  if (T > 0 && fin(basis.actualToDate) && fin(basis.plannedToDate)) rows.push({ key: '__scope__', label: scopeName, scope: true, actual: basis.actualToDate, planned: basis.plannedToDate, target: T });
  else out.missing.push(scopeName);
  const ents = (basis.entities || []).filter((e) => !(basis.scopeKind === 'amanah' && kind === 'entity' && e.key === basis.viewScope?.amanah)); // an Amanah view WITHOUT municipal rows: its one entity row IS the scope row — never drawn twice
  const drawable = ents.filter((e) => e.hasTarget && fin(e.actual) && fin(e.plannedToDate));
  for (const e of ents) if (!drawable.includes(e)) out.missing.push(rowLabel(e, nameOf, lang));
  const sorted = drawable.slice().sort((a, b) => b.target - a.target || (a.key < b.key ? -1 : 1)); const keep = all || !Number.isFinite(top) ? sorted : sorted.slice(0, top);
  out.hidden = sorted.length - keep.length; out.total = sorted.length;
  keep.forEach((e) => rows.push({ key: e.key, label: rowLabel(e, nameOf, lang), scope: false, actual: e.actual, planned: e.plannedToDate, target: e.target }));
  rows.forEach((r) => { r.achievementPct = r.actual / r.target; r.plannedPct = r.planned / r.target; r.positionVsPlan = r.planned > 0 ? r.actual / r.planned : null; });
  out.rows = rows; out.axisMax = Math.max(1, ...rows.flatMap((r) => [r.achievementPct, r.plannedPct])); out.available = rows.length > 0;
  if (!rows.length) out.reason = bi('لا مستهدف قابل للمقارنة في هذا الاختيار.', 'There is no target to compare in this selection.');
  return out;
}
/** the shared `bullet` block of those rows: the axis is the % of the plan-period target (valueKind rate, not capped), the bar = collected, the bands = up to the planned-to-date / up to the target, the tick = the target; the amounts sit in each row's caption and the table view. */
export function planBulletBlock(basis, o = {}) {
  const lang = o.lang || 'ar'; const L = (a, e) => (lang === 'ar' ? a : e); const data = o.data || planBulletRows(basis, o); if (!data.available) return null;
  const money = o.money || f0; const W = data.words; const niceMax = Math.max(1, data.axisMax); const iso = (t) => `\u2068${t}\u2069`; const cap = (r) => `${iso(money(r.actual))} / ${iso(money(r.target))} = ${pc(r.achievementPct)}`; const pc = (v) => (fin(v) ? `${(v * 100).toFixed(1)}%` : '—'); // cap(): each amount is its own bidi isolate, so «9.21 مليار ريال / 21.59 مليار ريال = 42.7%» reads in one order inside the left-to-right number layout of the chart
  return {
    type: 'chart', id: 'plan:bullet', kind: 'bullet', unit: 'SAR', valueKind: 'rate', valueTitle: pick(W.axis, lang), title: pick(W.title, lang), targetLabel: W.tick,
    bullets: data.rows.map((r) => ({
      key: r.key, label: r.label, actual: r.achievementPct, target: 1,
      ranges: [{ to: Math.min(r.plannedPct, 1), label: L('المخطط حتى تاريخه', 'Planned to date') }, { to: 1 }],
      caption: bi(cap(r), cap(r)),
      cells: [iso(money(r.actual)), iso(money(r.planned)), iso(money(r.target)), pc(r.plannedPct), r.positionVsPlan == null ? '—' : pc(r.positionVsPlan)]
    })),
    cellHeaders: [bi('المحصّل', 'Collected'), bi('المخطط حتى تاريخه', 'Planned to date'), bi('المستهدف', 'Target'), bi('المخطط حتى تاريخه % من المستهدف', 'Planned to date, % of the target'), bi('المحصّل % من المخطط حتى تاريخه', 'Collected, % of the plan to date')],
    note: L(`المحور نسبة من ${pick(W.tick, 'ar')} ويمتد إلى 100% على الأقل (حتى ${Math.round(niceMax * 100)}%) ويتجاوزها إن زاد المحصّل — بلا سقف. الشريط = المحصّل ÷ المستهدف حتى ${basis.reportingCutoff}، الظل = المخطط حتى تاريخه ÷ المستهدف، الخط = المستهدف (100%). الصف الأول = ${pick(data.rows[0]?.scope ? { ar: data.rows[0].label, en: data.rows[0].label } : { ar: 'الإجمالي', en: 'the total' }, 'ar')}، ثم ${data.kind === 'municipality' ? 'البلديات' : 'الجهات'} مرتبة بحجم المستهدف (الأكبر أولاً).${W.derived ? ' المحصّل من بداية الفترة فقط؛ محصّل الأساس المجمّد لا يُحسب هنا ويُعرض منفصلاً في «الأساس».' : ''}`,
      `The axis is the % of the ${pick(W.tick, 'en')}; it reaches 100% at least (to ${Math.round(niceMax * 100)}%) and goes past it when collections exceed the target — no cap. The bar = collected ÷ target to ${basis.reportingCutoff}, the shade = planned to date ÷ target, the tick = the target (100%). The first row is ${data.rows[0]?.scope ? data.rows[0].label : 'the total'}, then ${data.kind === 'municipality' ? 'municipalities' : 'entities'} ranked by target size (largest first).${W.derived ? ' Only collections from the start of the period count; the frozen baseline collections are not counted again and are shown separately in the «Baseline» block.' : ''}`), cutoff: basis.reportingCutoff
  };
}
