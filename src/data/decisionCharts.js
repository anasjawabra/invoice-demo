// «غرفة القرارات» — the page-level charts as SHARED-CHART-SPEC blocks (scratch/_agent-brief.md): { type:'chart', kind, title, labels, series:[{label, values}], note, … }.
// Only what the data supports: a chart the data cannot support is null and `unavailable[key]` says why (unavailable ≠ zero). No decoration, nothing repeated from the dashboard.
// Every block also carries: unit ('SAR' — the renderer picks the one display unit), period, cutoff, basis (text), and `marks[i] = { label, filter }` — the filter
// ({ category?, amanah?, source? }) the page applies to the items when the mark is chosen (filterItems in decisionRoom.js).
import { trendSeries } from './decisionRoom';

const lx = (lang) => (a, e) => (lang === 'ar' ? a : e);
const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
const MAX_BARS = 8;

function scopeAmanahs(S) { const a = S.scope?.amanah; if (a == null || a === 'all') return null; const l = [].concat(a).filter((x) => x && x !== 'all'); return l.length ? l : null; }
const bi2 = (labels, kind, k, lang) => { const o = labels[kind](k); return o?.[lang] || o?.en || String(k); };

/**
 * @param {object} inputs { snapshot, labels, plan?, allowedAmanahs? } — the same object that buildDecisionItems receives
 * @returns {{ overdueRank: {amanah, source}, planVsActual, aging, unavailable: {planVsActual?, aging?, overdueRank?} }}
 */
export function buildDecisionCharts(inputs, lang = 'ar') {
  const L = lx(lang); const { snapshot: S, labels } = inputs; const unavailable = {};
  const allowed = inputs.allowedAmanahs ? new Set(inputs.allowedAmanahs) : null; const okA = (k) => !allowed || allowed.has(k);
  const period = { from: S.scope.from, to: S.scope.to }; const cutoff = S.cutoff || inputs.today;
  const frame = { unit: 'SAR', period, cutoff };
  const noteBase = (basis) => L(`المبالغ بالريال السعودي. الفترة: ${period.from} إلى ${period.to}. تاريخ القطع: ${cutoff}. الأساس: ${basis.ar}`, `Amounts in SAR. Period: ${period.from} to ${period.to}. Cutoff: ${cutoff}. Basis: ${basis.en}`);

  /* ---- ranked overdue exposure: by Amanah, with a by-source variant (period overdue, not-yet-due excluded) */
  const cells = (S.matrix?.amanahSource || []).filter((c) => okA(c.amanah));
  const rank = (groupKey, kind) => {
    const m = new Map(); for (const c of cells) if (c.overdue > 0) m.set(c[groupKey], (m.get(c[groupKey]) || 0) + c.overdue);
    const all = [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)); if (!all.length) return null;
    const top = all.slice(0, MAX_BARS); const total = sum(all, (x) => x[1]); const shown = sum(top, (x) => x[1]);
    const basis = { ar: 'فواتير الفترة المختارة، المتأخر عن الاستحقاق حتى تاريخ القطع (دون ما لم يحن موعده)', en: 'invoices of the selected period, past due at the cutoff (not-yet-due excluded)' };
    return {
      type: 'chart', kind: 'hbar', ranked: true, ...frame, basis: L(basis.ar, basis.en),
      title: kind === 'amanah' ? L('أكبر المتأخرات غير المسدّدة حسب الأمانة', 'Largest unpaid overdue by entity') : L('أكبر المتأخرات غير المسدّدة حسب مصدر الإيراد', 'Largest unpaid overdue by revenue source'),
      labels: top.map(([k]) => bi2(labels, kind, k, lang)), series: [{ label: L('المتأخر غير المسدّد', 'Unpaid overdue'), values: top.map(([, v]) => v) }],
      marks: top.map(([k]) => ({ label: bi2(labels, kind, k, lang), filter: { [kind]: k } })),
      note: `${noteBase(basis)}${all.length > MAX_BARS ? L(` المعروض أكبر ${MAX_BARS} من ${all.length} (${((shown / total) * 100).toFixed(1)}% من المتأخر).`, ` Showing the largest ${MAX_BARS} of ${all.length} (${((shown / total) * 100).toFixed(1)}% of the overdue).`) : ''}`
    };
  };
  const overdueRank = { default: 'amanah', amanah: rank('amanah', 'amanah'), source: new Set(cells.filter((c) => c.overdue > 0).map((c) => c.source)).size > 1 ? rank('source', 'source') : null };
  if (!overdueRank.amanah) unavailable.overdueRank = L('لا متأخرات غير مسدّدة في النطاق.', 'No unpaid overdue balance in the scope.');

  /* ---- actual against PLANNED TO DATE of the configured reference plan (entity level; the plan target is stated in the note, not charted as the comparison; its source plan + version are named) */
  let planVsActual = null; const P = inputs.plan; const sl = scopeAmanahs(S);
  if (P && P.available === false) unavailable.planVsActual = P.notice ? L(P.notice.ar, P.notice.en) : L('الخطة المرجعية غير متاحة.', 'The reference plan is unavailable.');
  else if (!P || !(P.entities || []).length) unavailable.planVsActual = L('لا خطة مرجعية قابلة للمقارنة في هذا النطاق.', 'No comparable reference plan exists for this scope.');
  else if (S.scope.source != null && S.scope.source !== 'all') unavailable.planVsActual = L('المخطط معرَّف للجهة لا للمصدر؛ أزل تصفية المصدر لمقارنة المحصّل بالمخطط.', 'The plan is defined per entity, not per revenue source; remove the source filter to compare collected with the plan.');
  else {
    const ents = P.entities.filter((e) => okA(e.key) && (!sl || sl.includes(e.key)) && e.plannedToDate > 0).sort((a, b) => b.plannedToDate - a.plannedToDate).slice(0, MAX_BARS);
    if (!ents.length) unavailable.planVsActual = L('لا مخطط حتى تاريخه للجهات المعروضة.', 'No planned-to-date amount for the entities in view.');
    else {
      const from0 = P.period?.start || `${P.year}-01-01`; const basis = { ar: `المحصّل حسب تاريخ الدفع من ${from0} مقابل المخطط التراكمي حتى تاريخ التقرير`, en: `collected by payment date from ${from0} against the cumulative plan to the reporting date` };
      planVsActual = {
        type: 'chart', kind: 'bar', ...frame, period: { from: P.period?.start || `${P.year}-01-01`, to: P.reportingDate }, cutoff: P.reportingDate, basis: L(basis.ar, basis.en),
        title: L('المحصّل مقابل المخطط حتى تاريخه', 'Collected against the plan to date'),
        labels: ents.map((e) => bi2(labels, 'amanah', e.key, lang)), series: [{ label: L('المخطط حتى تاريخه', 'Planned to date'), values: ents.map((e) => e.plannedToDate) }, { label: L('المحصّل', 'Collected'), values: ents.map((e) => e.collected) }],
        marks: ents.map((e) => ({ label: bi2(labels, 'amanah', e.key, lang), filter: { category: 'plan_deviation', amanah: e.key } })),
        note: `${L(`المبالغ بالريال السعودي. الفترة: ${from0} إلى ${P.reportingDate}. الأساس: ${basis.ar}.${P.source ? ` المصدر: ${P.source.label.ar}.` : ''} مستهدف الخطة للجهات المعروضة ${num(sum(ents, (e) => e.target))} ريالاً ويُذكر منفصلاً؛ ليس أساس المقارنة.`, `Amounts in SAR. Period: ${from0} to ${P.reportingDate}. Basis: ${basis.en}.${P.source ? ` Source: ${P.source.label.en}.` : ''} The plan target of the entities shown is SAR ${num(sum(ents, (e) => e.target))}, stated separately; it is not the comparison basis.`)}`
      };
    }
  }

  /* ---- aging of the overdue balance (standing balance to the cutoff, all periods; «not yet due» is not lateness and is left out) */
  let aging = null; const ag = S.stock?.aging;
  if (!Array.isArray(ag)) unavailable.aging = L('أعمار الأرصدة غير متاحة في البيانات الحالية.', 'Aging of the balances is not available in the current data.');
  else {
    const buckets = ag.filter((a) => a.key !== '0');
    if (!buckets.some((a) => a.amount > 0)) unavailable.aging = L('لا رصيد متأخر في النطاق.', 'No overdue balance in the scope.');
    else {
      const basis = { ar: 'الرصيد القائم المتأخر حتى تاريخ القطع (كل الفترات)، حسب أيام التأخر بعد الاستحقاق', en: 'standing overdue balance to the cutoff (all periods), by days past due' };
      aging = {
        type: 'chart', kind: 'bar', ...frame, period: { from: null, to: cutoff }, basis: L(basis.ar, basis.en),
        title: L('الرصيد المتأخر حسب عمر التأخر', 'Overdue balance by age past due'),
        labels: buckets.map((a) => a.label?.[lang] || a.label?.en || a.key), series: [{ label: L('الرصيد المتأخر', 'Overdue balance'), values: buckets.map((a) => a.amount) }],
        marks: buckets.map((a) => ({ label: a.label?.[lang] || a.label?.en || a.key, filter: { category: 'overdue_aging' } })),
        note: `${L(`المبالغ بالريال السعودي. تاريخ القطع: ${cutoff}. الأساس: ${basis.ar}. «لم يحن استحقاقه» (${num(ag[0]?.amount)} ريالاً) ليس تأخراً ولا يدخل هنا.`, `Amounts in SAR. Cutoff: ${cutoff}. Basis: ${basis.en}. «Not yet due» (SAR ${num(ag[0]?.amount)}) is not lateness and is left out.`)}`
      };
    }
  }
  return { overdueRank, planVsActual, aging, unavailable };
}

/**
 * The trend inside an item's details — net invoiced and collected by invoice month for the item's Amanah / source (same data as the snapshot matrix).
 * Only for the overdue and source items, and only with at least two months of data; otherwise null (a plan comparison has no monthly planned series).
 * @param {object} item  an item from buildDecisionItems
 * @param {{snapshot: object, lang?: 'ar'|'en'}} ctx
 */
export function itemTrend(item, { snapshot: S, lang = 'ar' } = {}) {
  if (!S || !item || !['overdue_aging', 'source_deterioration'].includes(item.category)) return null;
  const rows = trendSeries(S, { amanah: item.affected?.amanah, source: item.affected?.source }).filter((r) => r.net > 0);
  if (rows.length < 2) return null;
  const L = lx(lang);
  return {
    type: 'chart', kind: 'bar', basis: 'monthly', unit: 'SAR', period: { from: S.scope.from, to: S.scope.to }, cutoff: S.cutoff,
    title: L('صافي المفوتر والمحصّل حسب شهر الفاتورة', 'Net invoiced and collected by invoice month'),
    labels: rows.map((r) => r.month), series: [{ label: L('صافي المفوتر', 'Net invoiced'), values: rows.map((r) => r.net) }, { label: L('المحصّل', 'Collected'), values: rows.map((r) => r.collected) }],
    note: L(`المبالغ بالريال السعودي. الفترة: ${S.scope.from} إلى ${S.scope.to}؛ القطع: ${S.cutoff}. الأشهر حسب تاريخ إصدار الفاتورة؛ الفرق بين العمودين هو غير المحصّل ويشمل ما لم يحن موعده.`, `Amounts in SAR. Period: ${S.scope.from} to ${S.scope.to}; cutoff: ${S.cutoff}. Months are by invoice issue date; the gap between the bars is the uncollected part and includes amounts not yet due.`)
  };
}
