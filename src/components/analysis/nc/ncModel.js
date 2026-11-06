// «تحليل أسباب عدم التحصيل» — the pure view model of the result page: chart blocks (+ what each mark opens), the plain-language summary, the management questions,
// the drill-down filter that travels in the page address, and the vocabulary of fact kinds / evidence statuses. No React here, so the same code is unit-tested against the data service.
//
// A DRILL is { nc, scope?, label:{ar,en}, expected:{ amount, count?, basis } }:
//   nc      → the `filters.nc` of POST /api/list (each analysis bucket carries its own `filter`; this module never invents a filter of its own)
//   scope   → a patch of the analysis scope (an Amanah or a municipality), so the ACTIVE SCOPE (period, Amanah, source …) is always preserved
//   expected→ the number the chart showed; the supporting table compares it with the list it gets back
export const TABS = ['overview', 'reasons', 'priorities', 'quality'];
export const TAB_LABEL = { overview: { ar: 'نظرة عامة', en: 'Overview' }, reasons: { ar: 'الأسباب والتركّز', en: 'Reasons and concentration' }, priorities: { ar: 'الأولويات والفواتير الداعمة', en: 'Priorities and supporting invoices' }, quality: { ar: 'جودة البيانات والمنهجية', en: 'Data quality and methodology' } };

export const FACT_KIND = {
  source_reported: { ar: 'مبلغ من المصدر', en: 'Source-reported', cls: 'src' },
  calculated: { ar: 'محسوب', en: 'Calculated', cls: 'calc' },
  reviewer_confirmed: { ar: 'مؤكَّد من مراجع', en: 'Reviewer-confirmed', cls: 'rev' },
  hypothesis: { ar: 'فرضية', en: 'Hypothesis', cls: 'hyp' },
  not_documented: { ar: 'غير موثق', en: 'Not documented', cls: 'nodoc' }
};
export const EVIDENCE = {
  source_record: { ar: 'سجل المصدر متاح', en: 'Source record available' },
  calculated: { ar: 'محسوب فقط', en: 'Calculated only' },
  unverified: { ar: 'غير مؤكَّد', en: 'Unverified' },
  missing: { ar: 'الدليل ناقص', en: 'Evidence missing' },
  none: { ar: 'لا سجل في المصدر', en: 'No source record' }
};
/** the fact kind of an action group, from its evidence status (a confirmed enforcement order is a reviewer-confirmed link) */
export const groupFactKind = (g) => (g.key === 'monitor_enforcement' ? 'reviewer_confirmed' : g.evidence.status === 'source_record' ? 'source_reported' : g.evidence.status === 'unverified' ? 'hypothesis' : 'calculated');

/** a date / time / number inside running text keeps its own left-to-right order */
export const iso = (s) => `\u2066${s}\u2069`;
/** «1 invoice» / «2 invoices» (Arabic keeps «فاتورة») */
const invE = (x) => `${Math.round(Number(x) || 0).toLocaleString('en-US')} ${Math.round(Number(x)) === 1 ? 'invoice' : 'invoices'}`;
const pick = (o, ar) => (o == null ? '' : typeof o === 'string' ? o : ar ? (o.ar ?? o.en) : (o.en ?? o.ar));
export const lab = (x, ar) => (ar ? (x.labelAr ?? x.labelEn) : (x.labelEn ?? x.labelAr));
export const titleOf = (g, ar) => (ar ? g.titleAr : g.titleEn);

/* ------------------------------------------------------------------ the drill-down filter in the page address */
export function encodeDrill(d) { try { return JSON.stringify({ n: d.nc || {}, s: d.scope || null, l: d.label, e: d.expected || null, ...(d.src ? { k: d.src } : {}) }); } catch { return ''; } }
export function decodeDrill(text) {
  if (!text) return null;
  try { const o = JSON.parse(text); if (!o || typeof o.n !== 'object') return null; return { nc: o.n, scope: o.s || null, label: o.l || { ar: '', en: '' }, expected: o.e || null, ...(o.k ? { src: o.k } : {}) }; } catch { return null; }
}
/** → { scope, filters } of POST /api/list for a drill on top of the analysis scope */
export function listRequest(base, drill, { search = '' } = {}) {
  const scope = { ...base, ...(drill?.scope || {}) };
  return { scope, filters: { nc: { ...(drill?.nc || {}) }, ...(search ? { search } : {}) } };
}
/** the amount a list total is compared with: the unpaid part, the excluded part, or both (gross unpaid) */
export const listAmount = (res, population) => (population === 'excluded' ? res.sums.exclusionAmount : population === 'unpaidGross' ? res.sums.outstanding + res.sums.exclusionAmount : res.sums.outstanding);
export const drillPopulation = (d) => d?.nc?.population || 'net';

const D = (nc, label, expected, scope = null) => ({ nc, scope, label, expected });
const L2 = (ar, en) => ({ ar, en });

/* ------------------------------------------------------------------ chart blocks and what each mark opens */
const top = (arr, n, key) => arr.slice().sort((a, b) => b[key] - a[key]).slice(0, n);
export function buildCharts(a, ar) {
  const P = a.populations; const lg = (x) => lab(x, ar);
  const out = {};
  // 1 · waterfall: gross unpaid → excluded unpaid → net unpaid (additive)
  const wfSteps = [
    { label: L2('إجمالي غير المسدد (شامل المستبعد)', 'Gross unpaid (incl. excluded)'), v: P.unpaidGross.amount, d: D({ population: 'unpaidGross' }, L2('إجمالي غير المسدد (شامل المستبعد)', 'Gross unpaid (incl. excluded)'), { count: P.unpaidGross.count, amount: P.unpaidGross.amount, basis: 'unpaidGross' }) },
    { label: L2('المستبعد بقواعد معتمدة', 'Excluded under approved rules'), v: -P.excludedUnpaid.amount, d: D({ population: 'excluded' }, L2('المستبعد غير المسدد بقواعد معتمدة', 'Excluded unpaid under approved rules'), { count: P.excludedUnpaid.count, amount: P.excludedUnpaid.amount, basis: 'excluded' }) },
    { label: L2('صافي غير المسدد', 'Net unpaid'), v: P.netUnpaid.amount, d: D({}, L2('صافي غير المسدد', 'Net unpaid'), { count: P.netUnpaid.count, amount: P.netUnpaid.amount, basis: 'net' }) }
  ];
  out.waterfall = { block: { type: 'chart', kind: 'waterfall', title: ar ? 'من إجمالي غير المسدد إلى صافي غير المسدد' : 'From gross unpaid to net unpaid', labels: wfSteps.map((s) => pick(s.label, ar)), series: [{ label: ar ? 'المبلغ' : 'Amount', values: wfSteps.map((s) => s.v) }], totals: [true, false, true] }, pick: (s) => wfSteps[s.i]?.d || null };

  // 2 · net unpaid by due position (stacked, additive)
  const dueParts = [
    { key: 'overdue', label: L2('متأخر', 'Overdue'), role: 'exclusions', amount: P.overdue.amount, count: P.overdue.count, nc: { due: 'overdue' } },
    { key: 'not_due', label: L2('لم يحن استحقاقه', 'Not yet due'), role: 'total', amount: P.notYetDue.amount, count: P.notYetDue.count, nc: { due: 'not_due' } },
    ...(P.dueUnknown.count > 0 ? [{ key: 'unknown', label: L2('تاريخ الاستحقاق غير متاح', 'Due date unavailable'), amount: P.dueUnknown.amount, count: P.dueUnknown.count, nc: { due: 'unknown' } }] : [])
  ];
  out.due = { block: { type: 'chart', kind: 'stacked_hbar', title: ar ? 'صافي غير المسدد حسب موقف الاستحقاق' : 'Net unpaid by due position', labels: [ar ? 'صافي غير المسدد' : 'Net unpaid'], series: dueParts.map((p) => ({ label: pick(p.label, ar), role: p.role, values: [p.amount] })) },
    pick: (s) => { if (s.j == null || s.kind === 'label') return D({}, L2('صافي غير المسدد', 'Net unpaid'), { count: P.netUnpaid.count, amount: P.netUnpaid.amount, basis: 'net' }); const p = dueParts[s.j]; return p ? D(p.nc, L2(`صافي غير المسدد — ${p.label.ar}`, `Net unpaid — ${p.label.en}`), { count: p.count, amount: p.amount, basis: 'net' }) : null; } };

  // 3 · net unpaid by documented non-collection reason, ranked (primary allocation: sums to the net)
  const reasons = a.reasons.slice().sort((x, y) => y.amount - x.amount || (x.documented === y.documented ? 0 : x.documented ? -1 : 1));
  out.reasons = { block: { type: 'chart', kind: 'hbar', title: ar ? 'صافي غير المسدد حسب سبب عدم التحصيل الموثَّق' : 'Net unpaid by documented non-collection reason', labels: reasons.map(lg), series: [{ label: ar ? 'صافي غير المسدد' : 'Net unpaid', role: 'net', values: reasons.map((r) => r.amount) }], keys: reasons.map((r) => r.key) },
    pick: (s) => { const r = reasons[s.i]; return r ? D(r.filter.nc, L2(r.labelAr, r.labelEn), { count: r.count, amount: r.amount, basis: 'net' }) : null; }, rows: reasons };

  // 4 · aging buckets of net unpaid
  out.aging = { block: { type: 'chart', kind: 'hbar', title: ar ? 'صافي غير المسدد حسب التقادم' : 'Net unpaid by aging', labels: a.aging.map(lg), series: [{ label: ar ? 'صافي غير المسدد' : 'Net unpaid', role: 'net', values: a.aging.map((x) => x.amount) }], keys: a.aging.map((x) => x.key) },
    pick: (s) => { const x = a.aging[s.i]; return x ? D(x.filter.nc, L2(`التقادم: ${x.labelAr}`, `Aging: ${x.labelEn}`), { count: x.count, amount: x.amount, basis: 'net' }) : null; } };

  // 5 · overdue exposure by Amanah / revenue source / municipality (ranked by overdue; the net-unpaid figure stays in the table fold)
  const am = top(a.byAmanah.filter((x) => x.overdue > 0), 10, 'overdue');
  out.amanah = { block: { type: 'chart', kind: 'hbar', title: ar ? 'المتأخر حسب الأمانة (الأعلى 10)' : 'Overdue by Amanah (top 10)', labels: am.map(lg), series: [{ label: ar ? 'متأخر' : 'Overdue', role: 'exclusions', values: am.map((x) => x.overdue) }], keys: am.map((x) => x.key) },
    pick: (s) => { const x = am[s.i]; return x ? D({ due: 'overdue' }, L2(`المتأخر — ${x.labelAr}`, `Overdue — ${x.labelEn}`), { amount: x.overdue, basis: 'net' }, x.scopePatch) : null; }, rows: am };
  const so = top(a.bySource.filter((x) => x.overdue > 0), 8, 'overdue');
  out.source = { block: { type: 'chart', kind: 'hbar', title: ar ? 'المتأخر حسب مصدر الإيراد' : 'Overdue by revenue source', labels: so.map(lg), series: [{ label: ar ? 'متأخر' : 'Overdue', role: 'exclusions', values: so.map((x) => x.overdue) }], keys: so.map((x) => x.key) },
    pick: (s) => { const x = so[s.i]; return x ? D({ ...x.filter.nc, due: 'overdue' }, L2(`المتأخر — ${x.labelAr}`, `Overdue — ${x.labelEn}`), { amount: x.overdue, basis: 'net' }) : null; }, rows: so };
  const mu = top(a.byMunicipality.filter((x) => x.overdue > 0), 10, 'overdue');
  const muniScope = (x) => ({ amanah: x.amanah, muni: x.key }); // every row is a valid filter value now: a reference municipality or one of the explicit groups (not specified · issued directly · needs review)
  out.muni = { block: { type: 'chart', kind: 'hbar', title: ar ? 'المتأخر حسب البلدية (الأعلى 10)' : 'Overdue by municipality (top 10)', labels: mu.map(lg), series: [{ label: ar ? 'متأخر' : 'Overdue', role: 'exclusions', values: mu.map((x) => x.overdue) }], keys: mu.map((x) => x.key) },
    pick: (s) => { const x = mu[s.i]; if (!x) return null; const sc = muniScope(x); return sc ? D({ due: 'overdue' }, L2(`المتأخر — ${x.labelAr}`, `Overdue — ${x.labelEn}`), { amount: x.overdue, basis: 'net' }, sc) : { unsupported: true, reason: L2('هذا البند بلا بلدية محددة، فلا يوجد مرشّح لفواتيره', 'This item has no municipality, so there is no filter for its invoices') }; }, rows: mu };

  // 6 · Amanah × aging heat map (amounts; a cell with no invoice is hatched, never zero)
  const H = a.heat; const colKeep = H.cols.map((_, j) => (H.cols[j] !== 'unavailable' || H.values.some((r) => r[j] != null)));
  const cols = H.cols.map((k, j) => ({ key: k, j })).filter((c) => colKeep[c.j]);
  out.heat = { block: { type: 'chart', kind: 'heatmap', valueKind: 'amount', title: ar ? 'صافي غير المسدد: الأمانة × التقادم' : 'Net unpaid: Amanah × aging', labels: cols.map((c) => pick(H.colLabels[c.j], ar)), series: H.rows.map((r, i) => ({ label: lg(r), values: cols.map((c) => H.values[i][c.j]) })), keys: cols.map((c) => c.key) },
    pick: (s) => {
      const r = H.rows[s.i]; if (!r) return null;
      if (s.j == null || s.kind === 'label') { const tot = H.values[s.i].reduce((t, v) => t + (v || 0), 0); return D({}, L2(`صافي غير المسدد — ${r.labelAr}`, `Net unpaid — ${r.labelEn}`), { amount: tot, basis: 'net' }, { amanah: r.key }); }
      const c = cols[s.j]; if (!c) return null; const v = H.values[s.i][c.j]; if (v == null) return null;
      const cl = H.colLabels[c.j]; return D({ age: c.key }, L2(`${r.labelAr} × ${cl.ar}`, `${r.labelEn} × ${cl.en}`), { amount: v, basis: 'net' }, { amanah: r.key });
    }, rows: H.rows, cols };
  return out;
}

/* ------------------------------------------------------------------ summary, KPIs, questions */
const sumDoc = (a) => a.reasons.filter((r) => r.documented).reduce((t, r) => t + r.count, 0);
/** → [{ kind, text }]: plain-language lines, each labelled as a source fact, a calculated result, an undocumented item or a figure outside the totals */
export function summaryLines(a, ar, f) {
  const P = a.populations; const m = f.money; const n = f.count; const lines = [];
  lines.push({ kind: 'source_reported', text: ar
    ? `صدرت ${n(P.issued.count)} فاتورة في الفترة بقيمة ${m(P.issued.gross)}؛ بقي منها ${n(P.netUnpaid.count)} فاتورة غير مسددة بمبلغ ${m(P.netUnpaid.amount)} (صافي غير المسدد)${P.partlyPaid.count ? `، منها ${n(P.partlyPaid.count)} مسددة جزئياً والمتبقي ${m(P.partlyPaid.amount)}` : ''}. استُبعد ${m(P.excludedUnpaid.amount)} غير مسدد بقواعد معتمدة من إجمالي ${m(P.unpaidGross.amount)}.`
    : `${invE(P.issued.count)} were issued in the period, worth ${m(P.issued.gross)}; ${n(P.netUnpaid.count)} remain unpaid for ${m(P.netUnpaid.amount)} (net unpaid)${P.partlyPaid.count ? `, of which ${n(P.partlyPaid.count)} are partly paid with ${m(P.partlyPaid.amount)} remaining` : ''}. ${m(P.excludedUnpaid.amount)} of unpaid amounts is excluded under approved rules, out of a gross ${m(P.unpaidGross.amount)}.` });
  const topA = a.byAmanah[0];
  lines.push({ kind: 'calculated', text: ar
    ? `من صافي غير المسدد، ${m(P.overdue.amount)} متأخر (${n(P.overdue.count)} فاتورة) و${m(P.notYetDue.amount)} لم يحن استحقاقه (${n(P.notYetDue.count)})${P.dueUnknown.count ? ` و${m(P.dueUnknown.amount)} بلا تاريخ استحقاق` : ''}.${topA && topA.overdue > 0 ? ` أكبر متأخرات لدى ${topA.labelAr}: ${m(topA.overdue)}.` : ''}`
    : `Of the net unpaid, ${m(P.overdue.amount)} is overdue (${invE(P.overdue.count)}) and ${m(P.notYetDue.amount)} is not yet due (${n(P.notYetDue.count)})${P.dueUnknown.count ? ` and ${m(P.dueUnknown.amount)} has no due date` : ''}.${topA && topA.overdue > 0 ? ` The largest overdue balance is with ${topA.labelEn}: ${m(topA.overdue)}.` : ''}` });
  const docN = sumDoc(a);
  lines.push({ kind: 'not_documented', text: ar
    ? `${n(P.undocumented.count)} فاتورة بمبلغ ${m(P.undocumented.amount)} لا يسجّل المصدر سبباً لعدم تحصيلها${docN ? `؛ والسبب موثَّق في ${n(docN)} فاتورة (اعتراض مسجَّل)` : ''}. لم يُستنتج أي سبب من التأخر أو السداد الجزئي أو الإنفاذ أو نقص البيانات.`
    : `${invE(P.undocumented.count)} worth ${m(P.undocumented.amount)} have no non-collection reason recorded in the source${docN ? `; the reason is documented for ${n(docN)} (a recorded objection)` : ''}. No reason is inferred from lateness, part payment, enforcement or missing data.` });
  if (a.unmatched?.count && !a.unmatched.scopedOut) lines.push({ kind: 'calculated', outside: true, text: ar
    ? `${n(a.unmatched.count)} سجلاً من تقرير غير المسدد (${m(a.unmatched.amount)}) لا يقابله سجل في بيان التفاصيل؛ يُعرض منفصلاً وهو خارج كل الإجماليات أعلاه.`
    : `${n(a.unmatched.count)} unpaid-report records (${m(a.unmatched.amount)}) have no match in the details report; they are shown apart and are outside every total above.` });
  return lines;
}

/** the four (five) financial tiles; `open` is the drill each one opens */
export function kpiTiles(a, ar) {
  const P = a.populations;
  const t = [
    { key: 'net', label: ar ? 'صافي غير المسدد' : 'Net unpaid', amount: P.netUnpaid.amount, count: P.netUnpaid.count, drill: D({}, L2('صافي غير المسدد', 'Net unpaid'), { count: P.netUnpaid.count, amount: P.netUnpaid.amount, basis: 'net' }) },
    { key: 'overdue', label: ar ? 'متأخر' : 'Overdue', amount: P.overdue.amount, count: P.overdue.count, tone: 'bad', drill: D({ due: 'overdue' }, L2('المتأخر', 'Overdue'), { count: P.overdue.count, amount: P.overdue.amount, basis: 'net' }) },
    { key: 'not_due', label: ar ? 'لم يحن استحقاقه' : 'Not yet due', amount: P.notYetDue.amount, count: P.notYetDue.count, drill: D({ due: 'not_due' }, L2('لم يحن استحقاقه', 'Not yet due'), { count: P.notYetDue.count, amount: P.notYetDue.amount, basis: 'net' }) }
  ];
  if (P.dueUnknown.count > 0) t.push({ key: 'unknown', label: ar ? 'تاريخ الاستحقاق غير متاح' : 'Due date unavailable', amount: P.dueUnknown.amount, count: P.dueUnknown.count, tone: 'warn', drill: D({ due: 'unknown' }, L2('تاريخ الاستحقاق غير متاح', 'Due date unavailable'), { count: P.dueUnknown.count, amount: P.dueUnknown.amount, basis: 'net' }) });
  t.push({ key: 'undocumented', label: ar ? 'سبب عدم التحصيل غير موثق' : 'Reason not documented', amount: P.undocumented.amount, count: P.undocumented.count, tone: 'warn', drill: D({ reason: 'undocumented' }, L2('سبب عدم التحصيل غير موثق', 'Non-collection reason not documented'), { count: P.undocumented.count, amount: P.undocumented.amount, basis: 'net' }) });
  return t;
}

/** evidence COVERAGE (not money): how many unpaid invoices have a documented reason, and the state of the checks — text, never a score */
export function evidenceCoverage(a, ar, f) {
  const P = a.populations; const ok = a.reconciliation.filter((c) => c.ok).length; const all = a.reconciliation.length;
  return [
    { key: 'reason', text: ar ? `سبب موثق: ${f.count(P.documented.count)} فاتورة من ${f.count(P.netUnpaid.count)}` : `Reason documented: ${f.count(P.documented.count)} of ${invE(P.netUnpaid.count)}` },
    { key: 'verify', text: ok === all ? (ar ? `حالة التحقق: ${f.count(all)} فحص مطابقة، كلها متحققة` : `Verification: all ${f.count(all)} reconciliation checks hold`) : (ar ? `حالة التحقق: ${f.count(ok)} من ${f.count(all)} فحصاً متحقق` : `Verification: ${f.count(ok)} of ${f.count(all)} checks hold`) }
  ];
}

/** the eight management questions, answered ONLY from the analysis; `open` = [{ label, drill }]; `na` = «not available in the data» */
export function managementQuestions(a, ar, f) {
  const P = a.populations; const m = f.money; const n = f.count; const G = (k) => a.groups.find((g) => g.key === k); const Q = (k) => a.quality.find((x) => x.key === k);
  const pr = (k) => a.process.find((x) => x.key === k);
  const qs = [];
  const topA = a.byAmanah[0];
  qs.push({ key: 'amanah', q: L2('أي أمانة لديها أكبر متأخرات؟', 'Which Amanah has the largest overdue balance?'),
    ...(topA && topA.overdue > 0 ? { a: L2(`${topA.labelAr}: ${m(topA.overdue)} متأخراً على ${n(topA.count)} فاتورة غير مسددة.`, `${topA.labelEn}: ${m(topA.overdue)} overdue across ${n(topA.count)} unpaid invoices.`), open: [{ label: L2('عرض فواتير المتأخر', 'Show the overdue invoices'), drill: D({ due: 'overdue' }, L2(`المتأخر — ${topA.labelAr}`, `Overdue — ${topA.labelEn}`), { amount: topA.overdue, basis: 'net' }, topA.scopePatch) }] } : { na: true }) });
  const topS = a.bySource[0];
  qs.push({ key: 'source', q: L2('أي مصدر إيراد يساهم بأكبر قدر من المتأخرات؟', 'Which revenue source contributes the most overdue?'),
    ...(topS && topS.overdue > 0 ? { a: L2(`${topS.labelAr}: ${m(topS.overdue)} متأخراً.`, `${topS.labelEn}: ${m(topS.overdue)} overdue.`), open: [{ label: L2('عرض الفواتير', 'Show the invoices'), drill: D({ ...topS.filter.nc, due: 'overdue' }, L2(`المتأخر — ${topS.labelAr}`, `Overdue — ${topS.labelEn}`), { amount: topS.overdue, basis: 'net' }) }] } : { na: true }) });
  qs.push({ key: 'notdue', q: L2('كم المبلغ الذي لم يحن استحقاقه بعد؟', 'How much is not yet due?'),
    ...(P.notYetDue.count > 0 ? { a: L2(`${m(P.notYetDue.amount)} على ${n(P.notYetDue.count)} فاتورة؛ لا إجراء مطلوب حالياً.`, `${m(P.notYetDue.amount)} across ${invE(P.notYetDue.count)}; no action is needed yet.`), open: [{ label: L2('عرض الفواتير', 'Show the invoices'), drill: D({ due: 'not_due' }, L2('لم يحن استحقاقه', 'Not yet due'), { count: P.notYetDue.count, amount: P.notYetDue.amount, basis: 'net' }) }] } : { a: L2('لا يوجد مبلغ غير مستحق بعد.', 'Nothing is unpaid-but-not-yet-due.') }) });
  qs.push({ key: 'undoc', q: L2('كم المبلغ الذي لا يوجد له سبب عدم تحصيل موثق؟', 'How much has no documented non-collection reason?'),
    ...(P.undocumented.count > 0 ? { a: L2(`${m(P.undocumented.amount)} على ${n(P.undocumented.count)} فاتورة من ${n(P.netUnpaid.count)}؛ لا يسجّل المصدر سبباً لها.`, `${m(P.undocumented.amount)} across ${n(P.undocumented.count)} of ${invE(P.netUnpaid.count)}; the source records no reason for them.`), open: [{ label: L2('عرض الفواتير', 'Show the invoices'), drill: D({ reason: 'undocumented' }, L2('سبب عدم التحصيل غير موثق', 'Reason not documented'), { count: P.undocumented.count, amount: P.undocumented.amount, basis: 'net' }) }] } : { a: L2('كل الفواتير غير المسددة لها سبب موثق.', 'Every unpaid invoice has a documented reason.') }) });
  const gc = G('review_amount_conflict'); const gm = G('request_missing_info'); const lk = Q('link_unresolved');
  const blocked = gc.count + gm.count;
  qs.push({ key: 'blocked', q: L2('أي الحالات متعطلة بسبب بيانات ناقصة أو متعارضة؟', 'Which cases are blocked by missing or conflicting data?'),
    ...(blocked > 0 ? { a: L2(`${n(blocked)} فاتورة: ${n(gc.count)} بتعارض في المبلغ أو الحالة (${m(gc.amount)}) و${n(gm.count)} ببيانات ناقصة (${m(gm.amount)}).`, `${invE(blocked)}: ${n(gc.count)} with a conflicting amount or status (${m(gc.amount)}) and ${n(gm.count)} with missing information (${m(gm.amount)}).`), open: [
      ...(gc.count ? [{ label: L2('تعارض في المبلغ', 'Conflicting amount'), drill: D(gc.filter.nc, L2(titleOf(gc, true), titleOf(gc, false)), { count: gc.count, amount: gc.amount, basis: 'net' }) }] : []),
      ...(gm.count ? [{ label: L2('بيانات ناقصة', 'Missing information'), drill: D(gm.filter.nc, L2(titleOf(gm, true), titleOf(gm, false)), { count: gm.count, amount: gm.amount, basis: 'net' }) }] : [])] } : { a: L2('لا توجد فواتير متعطلة بسبب بيانات ناقصة أو متعارضة.', 'No invoice is blocked by missing or conflicting data.'), ...(lk && lk.count ? {} : {}) }) });
  const cu = Q('contract_unmatched');
  qs.push({ key: 'contract', q: L2('أي فواتير الاستثمار تحتاج مراجعة ربط العقد؟', 'Which investment invoices need their contract link reviewed?'),
    ...(cu && cu.count > 0 ? { a: L2(`${n(cu.count)} فاتورة استثمار (${m(cu.amount)}) لا يعرفها سجل العقود أو غير مربوطة بعقدها.`, `${n(cu.count)} investment invoices (${m(cu.amount)}) are unknown to the contract register or not linked to their contract.`), open: [{ label: L2('عرض الفواتير', 'Show the invoices'), drill: D(cu.filter.nc, L2(cu.labelAr, cu.labelEn), { count: cu.count, amount: cu.amount, basis: 'net' }) }] } : { a: L2('لا فواتير استثمار تحتاج مراجعة ربط العقد.', 'No investment invoice needs a contract-link review.') }) });
  const cf = pr('confirmed');
  qs.push({ key: 'orders', q: L2('أي فواتير لها أمر إنفاذ مؤكَّد؟', 'Which invoices already have a confirmed enforcement order?'),
    ...(cf && cf.count > 0 ? { a: L2(`${n(cf.count)} فاتورة (${m(cf.amount)}) مرتبطة بأمر إنفاذ مؤكَّد؛ وجود الأمر لا يعني حدوث سداد.`, `${invE(cf.count)} (${m(cf.amount)}) are linked to a confirmed enforcement order; an order does not mean any payment.`), open: [{ label: L2('عرض الفواتير', 'Show the invoices'), drill: D(cf.filter.nc, L2(cf.labelAr, cf.labelEn), { count: cf.count, amount: cf.amount, basis: 'net' }) }] } : { na: true, naNote: L2('لا توجد أوامر إنفاذ مؤكَّدة مرتبطة بفواتير هذا النطاق.', 'No confirmed enforcement order is linked to an invoice in this scope.') }) });
  const first = a.groups.filter((g) => g.count > 0 && !g.noAction)[0];
  qs.push({ key: 'first', q: L2('ما الذي يجب مراجعته أولاً؟', 'What should be reviewed first?'),
    ...(first ? { a: L2(`${titleOf(first, true)}: ${n(first.count)} فاتورة بمبلغ ${m(first.amount)}${first.maxOverdueDays ? `، وأطول تأخر ${n(first.maxOverdueDays)} يوماً` : ''}. الترتيب بحسب عوامل ظاهرة (المبلغ ثم أطول تأخر)، دون درجة مركّبة.`, `${titleOf(first, false)}: ${invE(first.count)} worth ${m(first.amount)}${first.maxOverdueDays ? `, longest overdue ${n(first.maxOverdueDays)} days` : ''}. Ranked by visible factors (amount, then longest overdue), without a composite score.`), open: [{ label: L2('عرض الفواتير', 'Show the invoices'), drill: D(first.filter.nc, L2(titleOf(first, true), titleOf(first, false)), { count: first.count, amount: first.amount, basis: 'net' }) }] } : { a: L2('لا فواتير غير مسددة تحتاج إجراءً.', 'No unpaid invoice needs action.') }) });
  return qs;
}

/** the drill of an action group card (primary allocation) and of its overlapping tag */
export const groupDrill = (g, ar) => D(g.filter.nc, L2(g.titleAr, g.titleEn), { count: g.count, amount: g.amount, basis: 'net' });
export const processDrill = (x) => D(x.filter.nc, L2(x.labelAr, x.labelEn), { count: x.count, amount: x.amount, basis: 'net' });

/** the process strings of a group card: «None recorded: 67» … (non-zero only) */
export function processText(g, ar) {
  const NAME = { confirmed: L2('أمر إنفاذ مؤكَّد', 'Confirmed order'), proposed: L2('ربط مقترح', 'Proposed link'), objection: L2('اعتراض مسجَّل', 'Objection recorded'), none: L2('لا إجراء مسجَّل', 'No process recorded') };
  return Object.entries(g.process || {}).filter(([, v]) => v > 0).map(([k, v]) => `${pick(NAME[k], ar)}: ${v}`).join(' · ');
}

/** reconciliation rows for the quality tab (counts vs amounts) */
export const isCountCheck = (c) => /count/.test(c.key);

/** the one-line provenance (synthetic data) */
export const PROVENANCE = L2('بيانات تجريبية مُصطنعة وليست أرقام الوزارة الفعلية', 'Synthetic demonstration data, not the Ministry’s actual figures');
