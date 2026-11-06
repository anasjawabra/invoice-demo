// ============================================================================
// «تحليل أسباب عدم التحصيل» as a REPORT MODEL — the one structure that is shown in Smart Reports and exported (PDF · PowerPoint · Word · Excel).
// Pure: the structured analysis (server/noncollection.js `nonCollectionAnalysis`, via rev.data.noncollection) in → a model out. Nothing is recalculated:
// every figure below is a figure of the analysis, so a table, a chart, the headline and the exported file always agree, in both languages.
//
//   buildNcReportModel(analysis, { lang, meta })  → a normal report model (src/data/reportModel.js shape) that keeps a NON-enumerable `_inputs` ({ analysis })
//   rebuildNcModel(model, lang)                   → the SAME analysis re-expressed in the other language (used by the export dialog's «inLanguage»)
//   ncSections(analysis, lang)                    → the section list; Smart Reports' `noncollection` section delegates to it (ONE implementation)
//   ncHeadline(analysis, lang)                    → the KPI block (net unpaid · overdue · not yet due · amount with an undocumented reason · due unavailable if > 0)
//
// The supporting-invoice APPENDIX is fed by the optional `analysis.invoices` (rows of rev.data.list with `withNc`, sorted by unpaid amount) and `analysis.invoicesTotal`:
// the caller that exports (Smart Reports' generate(), the Collection page's export dialog) fetches the top NC_APPENDIX_ROWS rows and attaches them; this builder never fetches.
// Without them the appendix says the listing is available on screen.
//
// Wording rules (docs/noncollection-analysis.md): the reason for non-collection is «documented» only where the source records it (an objection and its status), otherwise
// «سبب عدم التحصيل غير موثق»; lateness, part payment, enforcement and missing data are STATES, never reasons; no recoverability, no expected recovery, no percentage of confidence;
// the process and data-quality views overlap and are labelled non-additive; the standing balance and the unmatched records are different populations shown apart.
// ============================================================================
import { muniLabel, MUNICIPALITY_DIRECT, MUNICIPALITY_OPTION_NONE, MUNICIPALITY_UNRESOLVED } from './municipalityModel';
import { assignChartIds } from './chartIds';
import { dimOf, mergeAlts, putAlt, flowBlock, treeAlt, histogramAlt, boxAlt, breakdownAlt, muniChartRows, MEASURE_UNPAID } from './chartAlts';
import { fmtMoney, unitOfValues, fmtInt, fmtSar } from '../utils/money';
import { ENTITIES } from './catalog';
import { sourceAr, sourceEn } from './insightsEngine';
import { BRIDGE_LABELS } from './bridgeLabels';

export const NC_TITLE = { ar: 'تحليل أسباب عدم التحصيل', en: 'Non-Collection Analysis' };
export const NC_APPENDIX_ROWS = 50; // supporting invoices attached to an export (the rest are on screen)
export const NC_SECTION_KEYS = ['nc_executive', 'nc_reasons', 'nc_exposure', 'nc_priorities', 'nc_quality', 'nc_method', 'nc_appendix'];

const lx = (lang) => (a, e) => (lang === 'ar' ? a : e);
const lab = (o, lang) => (o ? (lang === 'ar' ? o.labelAr : o.labelEn) || o.labelEn || o.labelAr || o.key || '' : '');
const ratio = (a, b) => (b > 0 ? a / b : null);
const near = (a, b) => Math.abs(a - b) <= 0.5;
const H = (label, kind = 'text') => ({ label, kind });
const tbl = (id, title, headers, rows, { total = null, note = null, main = false, sz = null } = {}) => ({ type: 'table', id, title, headers, rows, total, note, ...(main ? { main: true } : {}), ...(sz ? { sz } : {}) });
export const isNcAnalysis = (a) => !!a && a.kind === 'noncollection' && !!a.populations && Array.isArray(a.groups);

const EVIDENCE = { source_record: ['سجل المصدر متاح', 'Source record available'], calculated: ['محسوب فقط', 'Calculated only'], unverified: ['غير مؤكَّد (مقترح)', 'Unverified (proposed)'], missing: ['ناقص في السجل', 'Missing from the record'], none: ['لا سجل في المصدر', 'No source record'] };
const FACT = { source_reported: ['حقيقة من المصدر', 'Source-reported fact'], not_documented: ['غير موثق', 'Not documented'] };
const PAYMENT = { unpaid: ['غير مسدد كلياً', 'Fully unpaid'], partial: ['مسدد جزئياً', 'Partly paid'] };
const DUE = { overdue: ['متأخر', 'Overdue'], not_due: ['لم يحن استحقاقه', 'Not yet due'], unknown: ['تاريخ الاستحقاق غير متاح', 'Due date unavailable'] };
const PROC_LABEL = { confirmed: ['أمر إنفاذ مؤكَّد', 'Confirmed enforcement order'], proposed: ['ربط مقترح', 'Proposed link'], objection: ['اعتراض مسجَّل', 'Objection recorded'], none: ['لا إجراء', 'No process'] };

/** the limitations, written once (both languages) and placed next to the results they qualify */
const LIMIT = {
  reason: ['سبب عدم التحصيل موثّق فقط حين يسجّله المصدر (اعتراض الدافع وحالته). التأخر والسداد الجزئي وأمر الإنفاذ ونقص البيانات حالات وليست أسباباً، ولا يُستنتج سبب من عمر الفاتورة.', 'A reason is documented only where the source records it (the payer’s objection and its status). Lateness, part payment, an enforcement order and missing data are states, not reasons, and no reason is inferred from the age of an invoice.'],
  due: ['عمر التأخر محسوب من تاريخ الاستحقاق وتاريخ المرجع. أي سجل بلا تاريخ استحقاق يُعدّ منفصلاً ولا يُصنَّف متأخراً.', 'Age past due is calculated from the due date and the reference date. A record without a due date is counted apart and is never classed as overdue.'],
  recov: ['لا يُقيَّم هنا ما يمكن استرداده ولا يُقدَّر أي مبلغ مستقبلي. الربط المقترح أو أمر الإنفاذ المؤكَّد لا يدل على سداد، والتعارض في المبلغ يبقى بمبلغ رأس الفاتورة مع وسمه.', 'Nothing here assesses what could be recovered or estimates a future amount. A proposed link or a confirmed order implies no payment, and a conflicting amount stays at its header amount and is flagged.'],
  overlap: ['عروض الإجراء وجودة البيانات متداخلة (قد تجتمع في فاتورة واحدة) فلا تُجمع. أما الأسباب ومجموعات الإجراء فتوزيع أساسي (كل فاتورة في مجموعة واحدة) يجمع إلى صافي غير المسدد؛ والوسوم الأخرى تُعرض منفصلة.', 'The process and data-quality views overlap (one invoice can sit in several) and are never added up. Reasons and action groups are a primary allocation (each invoice in one group) that sums to net unpaid; the other tags are shown apart.'],
  populations: ['السجلات غير المطابقة (تقرير فقط) خارج كل الإجماليات. والرصيد القائم عند تاريخ المرجع مجتمع مختلف عن فواتير الفترة (كل ما صدر حتى ذلك التاريخ) ولا يُجمع معها ولا يُقارن بها.', 'Unmatched (report-only) records are outside every total. The standing balance at the reference date is a different population from the period’s invoices (everything issued up to that date) and is never added to or compared with them.'],
  suggest: ['المالك المقترح والإجراء التالي مقترحات فقط؛ لا شيء هنا يبدأ إنفاذاً أو يعتمد استبعاداً أو يغيّر سجلاً في المصدر. الترتيب بحسب عوامل ظاهرة في الأعمدة (المبلغ، أطول تأخر)، دون درجة مركّبة.', 'The suggested owner and next step are proposals only; nothing here starts enforcement, approves an exclusion or changes a source record. Groups are ranked by factors shown in the columns (amount, longest overdue), with no composite score.']
};

const scopeLabel = (a, lang) => {
  const L = lx(lang); const s = a.scope || {};
  const am = s.amanah == null || s.amanah === 'all' ? L('كل الأمانات والجهات', 'All Amanahs') : [].concat(s.amanah).map((k) => { const e = ENTITIES.find((x) => x.en === k || x.key === k); return e ? (lang === 'ar' ? e.ar : e.en) : String(k); }).join(L('، ', ', '));
  const src = s.source == null || s.source === 'all' ? L('كل المصادر', 'All sources') : (lang === 'ar' ? sourceAr(s.source) : sourceEn(s.source));
  return { am, src };
};
/** context chips (period · scope · basis incl. the cut-off · data), the same {k,label,value} shape as reportModel.contextChips */
export function ncContext(a, lang) {
  const L = lx(lang); const s = a.scope || {}; const { am, src } = scopeLabel(a, lang);
  const extra = [];
  if (s.scopeType && s.scopeType !== 'all') extra.push({ k: 'scopeType', label: L('النطاق', 'Scope'), value: s.scopeType === 'internal' ? L('داخلي', 'Internal') : L('مركزي', 'Central') });
  if (s.status && s.status !== 'all') extra.push({ k: 'status', label: L('حالة الفاتورة', 'Invoice status'), value: String(s.status) });
  if (s.muni && s.muni !== 'all') extra.push({ k: 'muni', label: L('البلدية', 'Municipality'), value: muniLabel(s.muni, lang === 'ar' ? 'ar' : 'en') });
  return [
    { k: 'period', label: L('الفترة', 'Period'), value: `${s.from} → ${s.to}` },
    { k: 'amanah', label: L('الأمانة / الجهة', 'Amanah'), value: am },
    { k: 'source', label: L('مصدر الإيراد', 'Revenue source'), value: src },
    ...extra,
    { k: 'basis', label: L('أساس التقرير', 'Reporting basis'), value: L(`فواتير صدرت في الفترة؛ غير المسدد مقاس حتى ${a.asOf || a.cutoff}`, `Invoices issued in the period; unpaid measured as of ${a.asOf || a.cutoff}`) },
    { k: 'data', label: L('البيانات', 'Data'), value: L('تجريبية اصطناعية', 'Synthetic demo data') }
  ];
}

/* ------------------------------------------------------------------ headline */
export function ncHeadline(a, lang) {
  const L = lx(lang); const P = a.populations; const N = P.netUnpaid;
  const u = unitOfValues([N.amount, P.overdue.amount, P.notYetDue.amount, P.undocumented.amount, P.dueUnknown.amount]);
  const m = (v) => fmtMoney(v, { lang, unit: u }); const pc = (x) => { const r = ratio(x, N.amount); return r == null ? '' : `${(r * 100).toFixed(1)}%`; };
  const inv = (c) => `${fmtInt(c)} ${L('فاتورة', c === 1 ? 'invoice' : 'invoices')}`;
  const share = (x) => (N.amount > 0 ? L(` · ${pc(x.amount)} من صافي غير المسدد`, ` · ${pc(x.amount)} of net unpaid`) : '');
  const items = [
    { label: L('صافي غير المسدد', 'Net unpaid'), value: m(N.amount), raw: N.amount, sub: L(`${inv(N.count)} من فواتير الفترة`, `${inv(N.count)} issued in the period`) },
    { label: L('متأخر', 'Overdue'), value: m(P.overdue.amount), raw: P.overdue.amount, sub: `${inv(P.overdue.count)}${share(P.overdue)}` },
    { label: L('لم يحن استحقاقه', 'Not yet due'), value: m(P.notYetDue.amount), raw: P.notYetDue.amount, sub: `${inv(P.notYetDue.count)}${share(P.notYetDue)}` },
    { label: L('سبب عدم التحصيل غير موثق', 'Non-collection reason not documented'), value: m(P.undocumented.amount), raw: P.undocumented.amount, sub: `${inv(P.undocumented.count)}${share(P.undocumented)}` },
    ...(P.dueUnknown.amount > 0 || P.dueUnknown.count > 0 ? [{ label: L('تاريخ الاستحقاق غير متاح', 'Due date unavailable'), value: m(P.dueUnknown.amount), raw: P.dueUnknown.amount, sub: `${inv(P.dueUnknown.count)}${share(P.dueUnknown)}` }] : [])
  ];
  return [{ type: 'kpis', unit: u, items }];
}

/* ------------------------------------------------------------------ the sections */
export const ncSections = (a, lang = 'ar') => assignChartIds({ sections: ncSectionsRaw(a, lang) }).sections; // every chart carries its stable id here, so the embedded section and the standalone model are identical
function ncSectionsRaw(a, lang = 'ar') {
  const L = lx(lang); const ar = lang === 'ar';
  if (!isNcAnalysis(a)) return [{ key: 'nc_executive', title: L('تحليل أسباب عدم التحصيل', 'Non-collection analysis'), purpose: '', blocks: [{ type: 'callout', tone: 'warn', text: L('تعذّر تحميل تحليل أسباب عدم التحصيل لهذا النطاق؛ أعد المحاولة من صفحة التحصيل.', 'The non-collection analysis could not be loaded for this scope; try again from the Collection page.') }] }];
  const P = a.populations; const N = P.netUnpaid; const m = (v) => fmtMoney(v, { lang }); const sec = (key, title, purpose, blocks) => ({ key, title, purpose, blocks: blocks.filter(Boolean) });
  const pct = (x, base = N.amount) => { const r = ratio(x, base); return r == null ? '—' : `${(r * 100).toFixed(1)}%`; };
  const callout = (key, tone = 'info') => ({ type: 'callout', tone, text: L(LIMIT[key][0], LIMIT[key][1]) });
  const empty = !(P.issued.count > 0);
  const failed = a.reconciliation.filter((c) => !c.ok); const okN = a.reconciliation.length - failed.length;
  const top = a.groups.find((g) => !g.noAction && g.count > 0);
  const out = [];

  /* ---- 1. executive summary (findings first) */
  const exec = [];
  if (empty) exec.push({ type: 'text', text: L('لا توجد فواتير صادرة ضمن هذا النطاق والفترة، فلا يوجد ما يُحلَّل.', 'No invoices were issued in this scope and period, so there is nothing to analyse.') });
  else {
    exec.push({ type: 'text', text: L(
      `ما الذي بقي غير مسدد: صافي غير المسدد على فواتير الفترة ${m(N.amount)} (${fmtInt(N.count)} فاتورة)، بعد استبعاد ${m(P.excludedUnpaid.amount)} غير مسدد بقواعد معتمدة من إجمالي غير مسدد ${m(P.unpaidGross.amount)}.`,
      `What remains unpaid: net unpaid on the period’s invoices is ${m(N.amount)} (${fmtInt(N.count)} invoices), after ${m(P.excludedUnpaid.amount)} unpaid under approved exclusions out of a gross unpaid ${m(P.unpaidGross.amount)}.`) });
    exec.push({ type: 'text', text: L(
      `ما المتأخر: ${m(P.overdue.amount)} متأخر (${pct(P.overdue.amount)})، و${m(P.notYetDue.amount)} لم يحن استحقاقه (${pct(P.notYetDue.amount)})${P.dueUnknown.amount > 0 ? `، و${m(P.dueUnknown.amount)} تاريخ استحقاقه غير متاح (${pct(P.dueUnknown.amount)})` : ''}. النسب من صافي غير المسدد.`,
      `What is overdue: ${m(P.overdue.amount)} is overdue (${pct(P.overdue.amount)}), ${m(P.notYetDue.amount)} is not yet due (${pct(P.notYetDue.amount)})${P.dueUnknown.amount > 0 ? `, and ${m(P.dueUnknown.amount)} has no due date available (${pct(P.dueUnknown.amount)})` : ''}. Shares are of net unpaid.`) });
    exec.push({ type: 'text', text: P.documented.amount > 0 ? L(
      `ما الذي يفسّر ذلك: سبب عدم التحصيل موثّق في المصدر لـ ${m(P.documented.amount)} فقط (${pct(P.documented.amount)})، وهو اعتراض مسجَّل؛ أما ${m(P.undocumented.amount)} (${pct(P.undocumented.amount)}) فـ«سبب عدم التحصيل غير موثق». التأخر والسداد الجزئي والإنفاذ ونقص البيانات ليست أسباباً.`,
      `What explains it: the source documents a reason for only ${m(P.documented.amount)} (${pct(P.documented.amount)}), a recorded objection; ${m(P.undocumented.amount)} (${pct(P.undocumented.amount)}) is “Non-collection reason not documented”. Lateness, part payment, enforcement and missing data are not reasons.`) : L(
      `ما الذي يفسّر ذلك: لا يسجّل المصدر أي سبب لعدم التحصيل لأي من هذه الفواتير؛ فكامل ${m(P.undocumented.amount)} «سبب عدم التحصيل غير موثق». التأخر والسداد الجزئي والإنفاذ ونقص البيانات ليست أسباباً.`,
      `What explains it: the source records no reason for any of these invoices; the whole ${m(P.undocumented.amount)} is “Non-collection reason not documented”. Lateness, part payment, enforcement and missing data are not reasons.`) });
    exec.push({ type: 'text', text: L(
      `مدى الاعتماد على الأرقام: المبالغ حقائق من سجلات الفواتير والتحصيل؛ أما التصنيف بحسب الاستحقاق ومجموعات الإجراء فمحسوب؛ والسبب غير الموثق ليس استنتاجاً. ${fmtInt(okN)} من ${fmtInt(a.reconciliation.length)} فحص مطابقة متحقق${failed.length ? `، و${fmtInt(failed.length)} غير متحقق (انظر قسم المطابقة)` : ''}.`,
      `How reliable: amounts are facts from the invoice and collection records; the due-position classification and the action groups are calculated; an undocumented reason is not an inference. ${fmtInt(okN)} of ${fmtInt(a.reconciliation.length)} reconciliation checks pass${failed.length ? `; ${fmtInt(failed.length)} do not (see the reconciliation section)` : ''}.`) });
    exec.push({ type: 'text', text: top
      ? L(`أين نبدأ: «${top.titleAr}» — ${fmtInt(top.count)} فاتورة و${m(top.amount)}. الإجراء المقترح: ${top.nextStepAr}. (اقتراح فقط؛ لا يبدأ أي إنفاذ.)`, `Where to act first: “${top.titleEn}” — ${fmtInt(top.count)} invoices, ${m(top.amount)}. Proposed next step: ${top.nextStepEn}. (A proposal only; nothing starts enforcement.)`)
      : L('أين نبدأ: لا توجد مجموعة إجراء ذات فواتير تتطلب متابعة الآن.', 'Where to act first: no action group has invoices that call for follow-up now.') });
    exec.push(callout('recov'));
    const flow = () => (near(P.unpaidGross.amount, P.excludedUnpaid.amount + N.amount) && near(N.amount, P.overdue.amount + P.notYetDue.amount + P.dueUnknown.amount)
      ? flowBlock({ title: L('تدفق غير المسدد: من الإجمالي إلى الصافي وموقف الاستحقاق', 'Unpaid flow: from gross unpaid to net unpaid and due position'), nodes: [{ id: 'gross', label: L('إجمالي غير المسدد', 'Gross unpaid'), col: 0 }, { id: 'excluded', label: L('المستبعد غير المسدد (قواعد معتمدة)', 'Excluded unpaid (approved rules)'), col: 1 }, { id: 'net', label: L('صافي غير المسدد', 'Net unpaid'), col: 1 }, { id: 'overdue', label: L('متأخر', 'Overdue'), col: 2 }, { id: 'notdue', label: L('لم يحن استحقاقه', 'Not yet due'), col: 2 }, { id: 'unknown', label: L('تاريخ الاستحقاق غير متاح', 'Due date unavailable'), col: 2 }],
        links: [{ from: 'gross', to: 'excluded', value: P.excludedUnpaid.amount }, { from: 'gross', to: 'net', value: N.amount }, { from: 'net', to: 'overdue', value: P.overdue.amount }, { from: 'net', to: 'notdue', value: P.notYetDue.amount }, { from: 'net', to: 'unknown', value: P.dueUnknown.amount }],
        note: L('كل عقدة تجمع مداخلها إلى مخارجها: إجمالي غير المسدد = المستبعد + الصافي؛ الصافي = متأخر + لم يحن + غير متاح. لا مبلغ يُحتسب مرتين.', 'Every node’s inflow equals its outflow: gross unpaid = excluded + net; net = overdue + not yet due + unavailable. No amount is counted twice.') }) : null);
    if (P.unpaidGross.amount > 0) exec.push({ type: 'chart', kind: 'waterfall', dim: dimOf('step', { ordered: true, measures: [{ key: 'amount', kind: 'amount' }] }), ...mergeAlts([putAlt('sankey', flow())]), title: L('من إجمالي غير المسدد إلى صافي غير المسدد', 'From gross unpaid to net unpaid'), labels: [L('إجمالي غير المسدد', 'Gross unpaid'), L('المستبعد غير المسدد (قواعد معتمدة)', 'Excluded unpaid (approved rules)'), L('صافي غير المسدد', 'Net unpaid')], series: [{ label: L('المبلغ', 'Amount'), values: [P.unpaidGross.amount, -P.excludedUnpaid.amount, N.amount] }], totals: [true, false, true], note: L('صافي غير المسدد = إجمالي غير المسدد − المستبعد غير المسدد؛ وهو غير المحصّل في اللقطة المالية لنفس النطاق.', 'Net unpaid = gross unpaid − excluded unpaid; it equals the uncollected amount of the financial snapshot for the same scope.') });
    if (N.amount > 0) exec.push({ type: 'chart', kind: 'stacked_hbar', dim: dimOf('due', { measures: [{ key: 'overdue', kind: 'amount' }, { key: 'notDue', kind: 'amount' }, { key: 'dueUnknown', kind: 'amount' }], additive: true, whole: { label: L('صافي غير المسدد', 'Net unpaid'), value: N.amount } }), title: L('صافي غير المسدد حسب موقف الاستحقاق', 'Net unpaid by due position'), labels: [L('صافي غير المسدد', 'Net unpaid')], series: [{ label: L('متأخر', 'Overdue'), values: [P.overdue.amount] }, { label: L('لم يحن استحقاقه', 'Not yet due'), values: [P.notYetDue.amount] }, ...(P.dueUnknown.amount > 0 ? [{ label: L('تاريخ الاستحقاق غير متاح', 'Due date unavailable'), values: [P.dueUnknown.amount] }] : [])], note: L('المتأخر + لم يحن + غير المتاح = صافي غير المسدد (تقسيم كامل).', 'Overdue + not yet due + unavailable = net unpaid (a complete partition).') });
  }
  out.push(sec('nc_executive', L('الملخص التنفيذي', 'Executive summary'), '', exec));
  if (empty) return out;

  /* ---- 2. reasons */
  const rs = a.reasons.filter((r) => r.amount > 0 || r.key === 'undocumented');
  out.push(sec('nc_reasons', L('ما الذي يفسّر عدم التحصيل؟', 'What explains non-collection?'), L('التوزيع الأساسي لصافي غير المسدد بحسب السبب الموثَّق في المصدر؛ ما لا يسجّله المصدر «غير موثق» ولا يُستنتج.', 'The primary allocation of net unpaid by the reason the source documents; whatever the source does not record is “not documented” and never inferred.'), [
    callout('reason'),
    N.amount > 0 ? { type: 'chart', kind: 'hbar', ranked: true, otherLabel: L('أسباب أخرى', 'Other reasons'), dim: dimOf('reason', { measures: [{ key: 'uncollected', kind: 'amount' }], additive: true, whole: { label: L('صافي غير المسدد', 'Net unpaid'), value: N.amount } }), title: L('صافي غير المسدد حسب سبب عدم التحصيل الموثَّق', 'Net unpaid by documented non-collection reason'), labels: rs.map((r) => lab(r, lang)), series: [{ label: L('غير المسدد', 'Unpaid'), values: rs.map((r) => r.amount) }], note: L(`المقام: صافي غير المسدد ${m(N.amount)}؛ الأسباب تجمع إليه.`, `Denominator: net unpaid ${m(N.amount)}; the reasons sum to it.`) } : null,
    tbl('nc_reasons', L('الأسباب حسب التوثيق', 'Reasons by documentation'), [H(L('السبب', 'Reason')), H(L('حالة الدليل / نوع المعلومة', 'Evidence status / kind of finding')), H(L('الفواتير', 'Invoices'), 'count'), H(L('غير المسدد', 'Unpaid'), 'money'), H(L('من صافي غير المسدد', 'Of net unpaid'), 'pct')],
      rs.map((r) => [lab(r, lang), `${(EVIDENCE[r.evidence] || EVIDENCE.none)[ar ? 0 : 1]} — ${(FACT[r.factKind] || FACT.not_documented)[ar ? 0 : 1]}`, r.count, r.amount, ratio(r.amount, N.amount)]),
      { total: [L('الإجمالي = صافي غير المسدد', 'Total = net unpaid'), '', N.count, N.amount, N.amount > 0 ? 1 : null], note: L('كل فاتورة تُحتسب مرة واحدة في التوزيع الأساسي. اعتراض الدافع هو السبب الوحيد الذي يسجّله المصدر.', 'Each invoice is counted once in the primary allocation. The payer’s objection is the only reason the source records.') }),
    tbl('nc_position', L('صافي غير المسدد حسب موقف السداد', 'Net unpaid by payment position'), [H(L('الموقف', 'Position')), H(L('الفواتير', 'Invoices'), 'count'), H(L('غير المسدد (المتبقي)', 'Unpaid (remainder)'), 'money'), H(L('الحصة', 'Share'), 'pct')],
      [[PAYMENT.unpaid[ar ? 0 : 1], P.fullyUnpaid.count, P.fullyUnpaid.amount, ratio(P.fullyUnpaid.amount, N.amount)], [PAYMENT.partial[ar ? 0 : 1], P.partlyPaid.count, P.partlyPaid.amount, ratio(P.partlyPaid.amount, N.amount)]],
      { total: [L('الإجمالي = صافي غير المسدد', 'Total = net unpaid'), N.count, N.amount, N.amount > 0 ? 1 : null], note: L(`المسدَّد جزئياً: المحصّل منه ${m(P.partlyPaid.collected)} يبقى محصّلاً ولا يدخل في غير المسدد؛ المتبقي فقط هو غير المسدد. السداد الجزئي موقف سداد وليس سبباً.`, `Partly paid: the ${m(P.partlyPaid.collected)} already collected stays collected and is not in unpaid; only the remainder is unpaid. Part payment is a payment position, not a reason.`) })
  ]));

  /* ---- 3. exposure: aging, Amanah, revenue source, heat map */
  const ag = a.aging.filter((x) => x.key !== 'unavailable' || x.amount > 0 || x.count > 0);
  const amTop = a.byAmanah.filter((x) => x.overdue > 0).slice(0, 12); const srcOv = a.bySource.filter((x) => x.overdue > 0);
  const hcols = a.heat.cols.map((_, c) => c).filter((c) => a.heat.values.some((r) => r[c] != null));
  const heatOk = a.heat.rows.length >= 2 && hcols.length >= 2;
  const dueCols = a.byAmanah.some((x) => x.dueUnknown > 0) || P.dueUnknown.amount > 0;
  const exposureRow = (x) => [lab(x, lang), x.count, x.unpaid, x.overdue, x.notYetDue, ...(dueCols ? [x.dueUnknown] : []), x.undocumented];
  const exposureHead = (first) => [H(first), H(L('الفواتير', 'Invoices'), 'count'), H(L('غير المسدد', 'Unpaid'), 'money'), H(L('متأخر', 'Overdue'), 'money'), H(L('لم يحن', 'Not yet due'), 'money'), ...(dueCols ? [H(L('الاستحقاق غير متاح', 'Due unavailable'), 'money')] : []), H(L('سببه غير موثق', 'Reason not documented'), 'money')];
  const exposureTotal = (arr) => [L('الإجمالي = صافي غير المسدد', 'Total = net unpaid'), arr.reduce((t, x) => t + x.count, 0), arr.reduce((t, x) => t + x.unpaid, 0), arr.reduce((t, x) => t + x.overdue, 0), arr.reduce((t, x) => t + x.notYetDue, 0), ...(dueCols ? [arr.reduce((t, x) => t + x.dueUnknown, 0)] : []), arr.reduce((t, x) => t + x.undocumented, 0)];
  const oneAmanah = typeof a.scope?.amanah === 'string' && a.scope.amanah !== 'all';
  const entLabel = (k) => { const e = ENTITIES.find((x) => x.en === k || x.key === k); return e ? (ar ? e.ar : e.en) : String(k); };
  const dist = a.distributions; const distOk = !!dist?.overduePeriod && dist.overduePeriod.n === P.overdue.count; // the payload must describe THIS cohort (same overdue count as the analysis)
  const NEEDS_DIST = { ar: 'يتطلب بيانات على مستوى الفاتورة تُجلب عند إنشاء التقرير (غير مرفقة بهذا النموذج).', en: 'Needs invoice-level data fetched when the report is generated (not attached to this model).' };
  const OV = [{ key: 'overdue', kind: 'amount', label: L('المتأخر', 'Overdue'), field: 'overdue' }];
  const muniRowsNc = a.byMunicipality.map((x) => ({ key: x.key, status: x.status, amanah: x.amanah, label: oneAmanah ? (ar ? x.muniLabelAr : x.muniLabelEn) : lab(x, lang), overdue: x.overdue, unpaid: x.unpaid }));
  const ageAlts = () => mergeAlts([
    putAlt('histogram', distOk ? histogramAlt(dist.overduePeriod, { lang, valueKind: 'days', popAr: 'صافي غير المسدد المتأخر على فواتير الفترة', popEn: 'Overdue net unpaid on the period’s invoices', extraAr: ` ${fmtInt(P.notYetDue.count)} فاتورة لم يحن استحقاقها${P.dueUnknown.count ? ` و${fmtInt(P.dueUnknown.count)} بلا تاريخ استحقاق` : ''} خارج هذا الرسم.`, extraEn: ` ${fmtInt(P.notYetDue.count)} invoices not yet due${P.dueUnknown.count ? ` and ${fmtInt(P.dueUnknown.count)} with no due date` : ''} are outside this chart.` }) : null, NEEDS_DIST),
    putAlt('box', distOk ? boxAlt(dist.overduePeriod.box.byAmanah, { lang, valueKind: 'days', labelOf: entLabel, entityAr: 'أمانة', entityEn: 'Amanah', dimension: 'amanah', title: L('أيام التأخر حسب الأمانة', 'Days overdue by Amanah') }) : null, NEEDS_DIST)
  ]);
  const amanahAlts = () => {
    const cells = distOk && dist.tree ? dist.tree.map((c) => ({ amanah: c.amanah, muni: c.muni, source: c.source, net: c.outstanding })) : null;
    const treeIn = { muniRows: a.byMunicipality.map((x) => ({ amanah: x.amanah, key: x.key, net: x.unpaid })), total: N.amount, lang, labelAmanah: entLabel, labelMuni: (k) => muniLabel(k, lang), labelSource: (k) => (ar ? sourceAr(k) : sourceEn(k)), maxMuni: oneAmanah ? 12 : 3, scopeLabel: L('إجمالي النطاق', 'Scope total'), measure: MEASURE_UNPAID };
    const tree = (cells && treeAlt({ ...treeIn, cells })) || treeAlt(treeIn);
    const EXPL = { direct_amanah: lang === 'ar' ? MUNICIPALITY_DIRECT.ar : MUNICIPALITY_DIRECT.en, not_specified: lang === 'ar' ? MUNICIPALITY_OPTION_NONE.ar : MUNICIPALITY_OPTION_NONE.en, needs_review: lang === 'ar' ? MUNICIPALITY_UNRESOLVED.ar : MUNICIPALITY_UNRESOLVED.en };
    const muniRows = muniChartRows(muniRowsNc, { single: oneAmanah, top: oneAmanah ? 15 : 12, fields: ['overdue'], explicitLabel: EXPL, otherLabel: { ar: 'بلديات أخرى', en: 'Other municipalities' }, lang });
    return mergeAlts([tree,
      putAlt('bySource', breakdownAlt({ dimension: 'source', rows: a.bySource.map((x) => ({ key: x.key, label: lab(x, lang), overdue: x.overdue })), lang, title: L('المتأخر حسب مصدر الإيراد', 'Overdue by revenue source'), otherLabel: { ar: 'مصادر أخرى', en: 'Other sources' }, measures: OV, total: P.overdue.amount })),
      putAlt('byMunicipality', breakdownAlt({ dimension: 'municipality', rows: muniRows, lang, title: L('المتأخر حسب البلدية', 'Overdue by municipality'), otherLabel: { ar: 'بلديات أخرى', en: 'Other municipalities' }, measures: OV, total: P.overdue.amount }))]);
  };
  const sourceAlts = () => mergeAlts([putAlt('byAmanah', breakdownAlt({ dimension: 'amanah', rows: a.byAmanah.map((x) => ({ key: x.key, label: lab(x, lang), overdue: x.overdue })), lang, title: L('المتأخر حسب الأمانة', 'Overdue by Amanah'), otherLabel: { ar: 'أمانات أخرى', en: 'Other Amanahs' }, measures: OV, total: P.overdue.amount }))]);
  out.push(sec('nc_exposure', L('أين يتركّز المتأخر؟', 'Where is the overdue concentrated?'), L('عمر التأخر والتعرّض حسب الأمانة ومصدر الإيراد؛ كل رسم يجمع إلى صافي غير المسدد أو يُظهر المتأخر منه.', 'Age past due and exposure by Amanah and revenue source; each chart sums to net unpaid or shows the overdue part of it.'), [
    callout('due'),
    ag.some((x) => x.amount > 0) ? { type: 'chart', kind: 'bar', dim: dimOf('aging', { ordered: true, measures: [{ key: 'uncollected', kind: 'amount' }], additive: true, whole: { label: L('صافي غير المسدد', 'Net unpaid'), value: N.amount } }), ...ageAlts(), title: L('صافي غير المسدد حسب عمر التأخر', 'Net unpaid by age past due'), labels: ag.map((x) => lab(x, lang)), series: [{ label: L('غير المسدد', 'Unpaid'), values: ag.map((x) => x.amount) }], note: L(`الفئات تجمع إلى صافي غير المسدد ${m(N.amount)}. «لم يحن استحقاقه» ليس تأخراً.`, `The buckets sum to net unpaid ${m(N.amount)}. “Not yet due” is not lateness.`) } : null,
    amTop.length ? { type: 'chart', kind: 'hbar', ranked: true, otherLabel: L('أمانات أخرى', 'Other Amanahs'), dim: dimOf('amanah', { measures: [{ key: 'overdue', kind: 'amount' }] }), ...amanahAlts(), title: L('الأمانات الأعلى تعرّضاً للمتأخر', 'Amanahs with the largest overdue exposure'), labels: amTop.map((x) => lab(x, lang)), series: [{ label: L('المتأخر', 'Overdue'), values: amTop.map((x) => x.overdue) }], note: a.byAmanah.length > amTop.length ? L(`الأعلى ${amTop.length} من ${a.byAmanah.length} أمانة بحسب المبلغ المتأخر؛ الجدول الكامل في الملحق.`, `Top ${amTop.length} of ${a.byAmanah.length} Amanahs by overdue amount; the full table is in the appendix.`) : null } : null,
    srcOv.length ? { type: 'chart', kind: 'hbar', ranked: true, otherLabel: L('مصادر أخرى', 'Other sources'), dim: dimOf('source', { measures: [{ key: 'overdue', kind: 'amount' }] }), ...sourceAlts(), title: L('مصادر الإيراد الأعلى تعرّضاً للمتأخر', 'Revenue sources with the largest overdue exposure'), labels: srcOv.map((x) => lab(x, lang)), series: [{ label: L('المتأخر', 'Overdue'), values: srcOv.map((x) => x.overdue) }] } : null,
    heatOk ? { type: 'chart', kind: 'heatmap', valueKind: 'amount', dim: dimOf('amanah', { measures: [{ key: 'uncollected', kind: 'amount' }] }), title: L('غير المسدد: الأمانة × عمر التأخر', 'Unpaid: Amanah × age past due'), labels: hcols.map((c) => lab(a.heat.colLabels?.[c] ? { labelAr: a.heat.colLabels[c].ar, labelEn: a.heat.colLabels[c].en } : { key: a.heat.cols[c] }, lang)), series: a.heat.rows.map((r, i) => ({ label: lab(r, lang), values: hcols.map((c) => a.heat.values[i][c]) })), note: L(`أعلى ${a.heat.rows.length} أمانة بحسب غير المسدد. الخلية «—» = لا فواتير (ليست صفراً).`, `Top ${a.heat.rows.length} Amanahs by unpaid. A “—” cell = no invoices (not zero).`) } : null,
    tbl('nc_by_amanah', L('غير المسدد حسب الأمانة', 'Unpaid by Amanah'), exposureHead(L('الأمانة / الجهة', 'Amanah')), a.byAmanah.map(exposureRow), { total: exposureTotal(a.byAmanah), note: L('مرتّبة بحسب المبلغ المتأخر ثم غير المسدد.', 'Ranked by overdue amount, then by unpaid.') }),
    tbl('nc_by_source', L('غير المسدد حسب مصدر الإيراد', 'Unpaid by revenue source'), exposureHead(L('مصدر الإيراد', 'Revenue source')), a.bySource.map(exposureRow), { total: exposureTotal(a.bySource) })
  ]));

  /* ---- 4. priorities */
  const grp = a.groups; const ev = (g) => (EVIDENCE[g.evidence?.status] || EVIDENCE.none)[ar ? 0 : 1];
  const suggested = L('مقترح', 'suggested');
  out.push(sec('nc_priorities', L('أين نبدأ؟ مجموعات الإجراء', 'Where to act: action groups'), L('كل فاتورة غير مسددة في مجموعة إجراء واحدة (الأسبقية بحسب ترتيب المجموعات)؛ الترتيب بعوامل ظاهرة بلا درجة مركّبة.', 'Each unpaid invoice sits in exactly one action group (precedence by group order); ranked by visible factors with no composite score.'), [
    callout('suggest', 'warn'),
    tbl('nc_priorities', L('مجموعات الإجراء بحسب الأولوية', 'Action groups by priority'), [H(L('الترتيب ومجموعة الإجراء', 'Rank and action group')), H(L('الفواتير', 'Invoices'), 'count'), H(L('غير المسدد', 'Unpaid'), 'money'), H(L('حالة الدليل', 'Evidence status')), H(L('الإجراء التالي (مقترح)', 'Next step (suggested)'))],
      grp.map((g) => [`${g.rank}. ${ar ? g.titleAr : g.titleEn}`, g.count, g.amount, ev(g), ar ? g.nextStepAr : g.nextStepEn]), { total: [L('الإجمالي = صافي غير المسدد', 'Total = net unpaid'), grp.reduce((t, g) => t + g.count, 0), grp.reduce((t, g) => t + g.amount, 0), '', ''], main: true, note: L('«لم يحن استحقاقها — لا إجراء» تُعرض في آخر الترتيب. المبالغ هنا غير مسددة فعلاً وليست توقعاً لما سيُحصَّل.', '“Not yet due — no action” is last. The amounts here are actually unpaid; they are not a forecast of what will be collected.') }),
    tbl('nc_priorities_detail', L('تفاصيل مجموعات الإجراء: المعلومات الناقصة وعوامل الترتيب والمالك المقترح', 'Action-group detail: missing information, ranking factors and suggested owner'), [H(L('مجموعة الإجراء', 'Action group')), H(L('الترتيب', 'Rank'), 'count'), H(L('المعلومات الناقصة', 'Missing information')), H(L('أطول تأخر (يوم)', 'Longest overdue (days)'), 'count'), H(L('مشاكل البيانات', 'Data issues'), 'count'), H(L('وسوم متداخلة (غير جمعية)', 'Also tagged (not additive)'), 'count'), H(L('المالك المقترح', 'Suggested owner')), H(L('أساس الاقتراح', 'Rationale'))],
      grp.map((g) => [ar ? g.titleAr : g.titleEn, g.rank, ar ? g.missingAr : g.missingEn, g.maxOverdueDays, g.dataIssues, g.nonAdditiveTags?.count ?? 0, `${ar ? g.suggestedOwner?.ar : g.suggestedOwner?.en}`.replace(/\s*\((مقترح|suggested)\)\s*$/, '') + ` (${suggested})`, ar ? g.rationaleAr : g.rationaleEn]),
      { note: L('الأعداد في «وسوم متداخلة» تتضمن الفواتير التي تنطبق عليها المجموعة ضمن وسومها الثانوية، فلا تُجمع مع الأعداد الأساسية. الموعد النهائي يحدده المالك.', 'The “also tagged” counts include invoices to which the group applies as a secondary tag, so they are not added to the primary counts. The deadline is set by the owner.') })
  ]));

  /* ---- 5. data quality & reconciliation */
  const money = (key, v) => (/count/.test(key) ? fmtInt(v) : fmtSar(v, lang)); const nz = (v) => (Number.isFinite(v) ? v : 0);
  const stepLabel = (x) => (BRIDGE_LABELS[x.key] ? BRIDGE_LABELS[x.key][lang] : x.key);
  const SB = a.standingBalance; const UM = a.unmatched;
  out.push(sec('nc_quality', L('جودة البيانات والمطابقة', 'Data quality and reconciliation'), L('هل يمكن الوثوق بالأرقام؟ كل علاقة محاسبية بطرفيها، وعروض الإجراء والجودة المتداخلة منفصلة، وغير المطابق خارج الإجماليات.', 'Can the numbers be trusted? Every identity with both sides; the overlapping process and quality views apart; unmatched records outside the totals.'), [
    failed.length ? { type: 'callout', tone: 'warn', text: L(`${fmtInt(failed.length)} من ${fmtInt(a.reconciliation.length)} فحص مطابقة غير متحقق: راجع الجدول أدناه قبل الاعتماد على هذا التقرير.`, `${fmtInt(failed.length)} of ${fmtInt(a.reconciliation.length)} reconciliation checks do not hold: review the table below before relying on this report.`) } : null,
    tbl('nc_checks', L('فحوص المطابقة (الطرف الأول والطرف الثاني)', 'Reconciliation checks (both sides)'), [H(L('الفحص', 'Check')), H(L('الطرف الأول', 'Left side')), H(L('الطرف الثاني', 'Right side')), H(L('الفرق', 'Difference')), H(L('النتيجة', 'Result'))],
      a.reconciliation.map((c) => [lab(c, lang), money(c.key, nz(c.lhs)), money(c.key, nz(c.rhs)), money(c.key, Math.abs(nz(c.lhs) - nz(c.rhs))), c.ok ? L('✓ متحقق', '✓ passed') : L('✗ غير متحقق', '✗ failed')]),
      { note: L(`المبالغ بالريال بدقتها؛ الأعداد أعداد فواتير. ${fmtInt(okN)} من ${fmtInt(a.reconciliation.length)} متحقق.`, `Amounts in exact SAR; counts are invoice counts. ${fmtInt(okN)} of ${fmtInt(a.reconciliation.length)} pass.`) }),
    callout('overlap'),
    tbl('nc_process', L('عرض الإجراء المسجَّل (متداخل — غير جمعي)', 'Recorded process view (overlapping — not additive)'), [H(L('الإجراء', 'Process')), H(L('الفواتير', 'Invoices'), 'count'), H(L('غير المسدد', 'Unpaid'), 'money')],
      a.process.flatMap((p) => [[lab(p, lang), p.count, p.amount], ...(p.sub || []).map((s) => [`— ${lab(s, lang)}`, s.count, s.amount])]),
      { note: L('لا يوجد صف إجمالي عمداً: الفاتورة الواحدة قد تظهر في أكثر من صف. الأمر المؤكَّد أو المقترح لا يعني حدوث سداد.', 'There is no total row on purpose: one invoice can appear in more than one row. A confirmed or proposed order does not mean any payment.') }),
    tbl('nc_flags', L('أعلام جودة البيانات (متداخلة — غير جمعية)', 'Data-quality flags (overlapping — not additive)'), [H(L('العلم', 'Flag')), H(L('الفواتير', 'Invoices'), 'count'), H(L('غير المسدد', 'Unpaid'), 'money')], a.quality.map((q) => [lab(q, lang), q.count, q.amount]), { note: L('جودة البيانات وصف للسجل وليست سبباً لعدم السداد، ولا تُجمع الأعلام.', 'Data quality describes the record; it is not a reason for non-payment, and the flags are never added up.') }),
    callout('populations'),
    tbl('nc_unmatched', L('سجلات غير مطابقة (تقرير فقط) — خارج كل الإجماليات', 'Unmatched (report-only) records — outside every total'), [H(L('البند', 'Item')), H(L('السجلات', 'Records'), 'count'), H(L('المبلغ', 'Amount'), 'money'), H(L('ضمن الإجماليات؟', 'In the totals?'))], [[L('سجلات التقرير غير المطابقة لفاتورة', 'Report records matching no invoice'), UM.count, UM.amount, L('لا', 'No')]], { note: UM.scopedOut ? L('النطاق المحدد يستبعد هذه السجلات، فلا تظهر هنا.', 'The selected scope leaves these records out, so none are shown here.') : L('تُعرض منفصلة ولا تدخل في أي إجمالي أعلاه.', 'Shown apart; they are in none of the totals above.') }),
    tbl('nc_standing', L('الرصيد القائم عند تاريخ المرجع — مجتمع مختلف عن فواتير الفترة', 'Standing balance at the reference date — a different population from the period’s invoices'), [H(L('البند', 'Item')), H(L('المبلغ', 'Amount'), 'money')], [[L('الرصيد القائم (كل ما صدر حتى تاريخ المرجع)', 'Standing balance (everything issued up to the reference date)'), SB.amount], [L('— متأخر', '— overdue'), SB.overdue], [L('— لم يحن استحقاقه', '— not yet due'), SB.notYetDue], ...(SB.dueUnknown > 0 ? [[L('— تاريخ الاستحقاق غير متاح', '— due date unavailable'), SB.dueUnknown]] : [])], { note: L('لا يُجمع هذا الرصيد مع صافي غير المسدد أعلاه ولا يُقارن به.', 'This balance is not added to, nor compared with, the net unpaid above.') }),
    SB.bridge?.steps?.length ? tbl('nc_bridge', L('جسر المطابقة إلى الرصيد القائم', 'Reconciliation bridge to the standing balance'), [H(L('الخطوة', 'Step')), H(L('الفواتير', 'Invoices'), 'count'), H(L('المبلغ', 'Amount'), 'money')], SB.bridge.steps.map((x) => [stepLabel(x), x.count ?? null, x.amount]), { total: [L('الرصيد القائم', 'Standing balance'), null, SB.bridge.net], note: L(`فرق الجسر: ${SB.bridge.check}.`, `Bridge difference: ${SB.bridge.check}.`) }) : null
  ]));

  /* ---- 6. methodology */
  const src = (arT, enT) => L(arT, enT);
  out.push(sec('nc_method', L('المنهجية والتعريفات', 'Methodology and definitions'), '', [
    tbl('nc_method', L('التعريفات والصيغ والمصادر', 'Definitions, formulas and sources'), [H(L('المصطلح', 'Term')), H(L('التعريف / الصيغة', 'Definition / formula')), H(L('المصدر', 'Source'))], [
      [L('فواتير الفترة', 'Period invoices'), L('الفواتير الصادرة ضمن الفترة والنطاق المحددين، وتُقاس عند تاريخ المرجع.', 'Invoices issued in the selected period and scope, measured at the reference date.'), src('سجل الفواتير (تجريبي)', 'Invoice register (synthetic)')],
      [L('إجمالي غير المسدد', 'Gross unpaid'), L('Σ (المفوتر − المستلم) للفواتير غير المحصّلة وغير الملغاة، شاملاً المستبعدة.', 'Σ (billed − received) over uncollected, non-cancelled invoices, including excluded ones.'), src('بيانات التحصيل (تجريبية)', 'Collection data (synthetic)')],
      [L('المستبعد غير المسدد', 'Excluded unpaid'), L('الجزء غير المسدد المشمول بقواعد استبعاد معتمدة؛ قواعد الاستبعاد لا تتغير هنا.', 'The unpaid part under approved exclusion rules; the exclusion rules are not changed here.'), src('قواعد الاستبعاد المعتمدة', 'Approved exclusion rules')],
      [L('صافي غير المسدد', 'Net unpaid'), L('إجمالي غير المسدد − المستبعد غير المسدد = غير المحصّل في اللقطة المالية. يتجزأ إلى متأخر + لم يحن + غير متاح، وإلى غير مسدد كلياً + مسدد جزئياً (المتبقي).', 'Gross unpaid − excluded unpaid = uncollected in the financial snapshot. It partitions into overdue + not yet due + unavailable, and into fully unpaid + partly paid (remainder).'), src('اللقطة المالية', 'Financial snapshot')],
      [L('متأخر / لم يحن / غير متاح', 'Overdue / not yet due / unavailable'), L('بحسب تاريخ الاستحقاق وتاريخ المرجع مع أيام السماح المعتمدة؛ بلا تاريخ استحقاق = غير متاح (لا يُعدّ متأخراً).', 'By the due date and the reference date with the approved grace days; no due date = unavailable (never overdue).'), src('تاريخ الاستحقاق في الفاتورة', 'Due date on the invoice')],
      [L('سبب موثَّق', 'Documented reason'), L('اعتراض مسجَّل من الدافع بحالته؛ غير ذلك «سبب عدم التحصيل غير موثق». لا يُستنتج سبب من التأخر أو السداد الجزئي أو الإنفاذ أو نقص البيانات.', 'An objection recorded by the payer with its status; otherwise “Non-collection reason not documented”. No reason is inferred from lateness, part payment, enforcement or missing data.'), src('سجل الاعتراضات (ممتثل — تجريبي)', 'Objection register (Mumtathil — synthetic)')],
      [L('مجموعة الإجراء', 'Action group'), L('توزيع أساسي: كل فاتورة غير مسددة في أول مجموعة تنطبق عليها بحسب الأسبقية (تعارض المبلغ، البيانات الناقصة، ربط مقترح، عقد استثمار، اعتراض، أمر مؤكَّد، متابعة متأخر، لم يحن). الوسوم الأخرى تُعرض منفصلة.', 'A primary allocation: each unpaid invoice sits in the first group that applies by precedence (amount conflict, missing data, proposed link, investment contract, objection, confirmed order, overdue follow-up, not yet due). The other tags are shown apart.'), src('حساب من السجلات أعلاه', 'Calculated from the records above')],
      [L('عمر التأخر', 'Age past due'), L('أيام التأخر بعد الاستحقاق في فئات: 1–30، 31–90، 91–180، أكثر من 180 يوماً.', 'Days overdue in buckets: 1–30, 31–90, 91–180, over 180.'), src('حساب من تاريخ الاستحقاق', 'Calculated from the due date')],
      [L('أنواع المعلومة', 'Kinds of finding'), L('حقيقة من المصدر · تصنيف محسوب · مؤكَّد من مراجع · فرضية غير مؤكدة؛ وحالة الدليل: سجل المصدر · محسوب فقط · ناقص. لا تُعرض درجات احتمال.', 'Source-reported fact · calculated classification · reviewer-confirmed · unverified hypothesis; evidence status: source record · calculated only · missing. No probability scores are shown.'), src('هذا التحليل', 'This analysis')]
    ], { note: L('البيانات تجريبية اصطناعية وليست بيانات الوزارة الفعلية.', 'The data is synthetic demo data, not the Ministry’s actual data.') })
  ]));

  /* ---- 7. appendix: the supporting invoices */
  const rows = Array.isArray(a.invoices) ? a.invoices : null; const total = a.invoicesTotal ?? N.count;
  const gTitle = (k) => { const g = grp.find((x) => x.key === k); return g ? (ar ? g.titleAr : g.titleEn) : '—'; };
  const pos = (r) => [r.nc?.due && DUE[r.nc.due] ? DUE[r.nc.due][ar ? 0 : 1] : '', r.nc?.payment === 'partial' ? PAYMENT.partial[ar ? 0 : 1] : ''].filter(Boolean).join(' · ');
  const listed = rows ? Math.round(rows.reduce((t, r) => t + r.outstanding, 0) * 100) / 100 : 0;
  const appendix = [];
  if (rows && rows.length) {
    appendix.push(tbl('nc_invoices', L('الفواتير الداعمة: أكبر غير المسدد', 'Supporting invoices: largest unpaid amounts'), [H(L('رقم الفاتورة', 'Invoice no.'), 'text'), H(L('الأمانة / الجهة', 'Amanah')), H(L('مصدر الإيراد', 'Revenue source')), H(L('تاريخ الاستحقاق', 'Due date')), H(L('أيام التأخر', 'Days past due'), 'count'), H(L('غير المسدد', 'Unpaid'), 'money'), H(L('الموقف', 'Position')), H(L('السبب الموثَّق', 'Documented reason')), H(L('مجموعة الإجراء', 'Action group'))],
      rows.map((r) => [String(r.invoiceNo ?? r.id), ar ? r.amanahAr : r.amanahEn, ar ? r.productAr : r.productEn, r.dueDate || '—', r.nc?.due === 'overdue' ? r.daysOverdue : null, r.outstanding, pos(r) || '—', r.nc?.reason ? lab(r.nc.reason, lang) : '—', gTitle(r.nc?.group)]),
      { sz: 8,
        note: L(`الأعلى ${fmtInt(rows.length)} فاتورة من ${fmtInt(total)} فاتورة غير مسددة بحسب المبلغ؛ مجموع المعروض ${fmtSar(listed, lang)} من صافي غير المسدد ${fmtSar(N.amount, lang)}. القائمة الكاملة على الشاشة (صفحة التحصيل). هوية الفاتورة = الرقم + رمز GFS + الأمانة.`, `The ${fmtInt(rows.length)} largest of ${fmtInt(total)} unpaid invoices by amount; the listed total is ${fmtSar(listed, lang)} of net unpaid ${fmtSar(N.amount, lang)}. The full list is on screen (Collection page). Invoice identity = number + GFS code + Amanah.`) }));
  } else {
    appendix.push({ type: 'callout', tone: 'info', text: L(`قائمة الفواتير الداعمة (${fmtInt(N.count)} فاتورة غير مسددة) متاحة على الشاشة في صفحة التحصيل ولم تُرفق بهذا الملف.`, `The supporting-invoice listing (${fmtInt(N.count)} unpaid invoices) is available on screen on the Collection page and is not attached to this file.`) });
  }
  out.push(sec('nc_appendix', L('الملحق: الفواتير الداعمة', 'Appendix: supporting invoices'), L('الفواتير التي تدعم الأرقام أعلاه، مرتّبة بحسب المبلغ غير المسدد.', 'The invoices behind the figures above, ranked by unpaid amount.'), appendix));
  return out;
}

/* ------------------------------------------------------------------ the model */
export function buildNcReportModel(analysis, { lang = 'ar', meta = null } = {}) {
  const a = analysis; const L = lx(lang); const valid = isNcAnalysis(a);
  const P = valid ? a.populations : null;
  const scope = valid ? a.scope : {};
  const chips = valid ? ncContext(a, lang) : [];
  const failed = valid ? a.reconciliation.filter((c) => !c.ok).length : 0;
  const sections = ncSections(a, lang);
  const model = assignChartIds({
    id: `nc-${valid ? Date.parse(a.generatedAt) || 0 : 0}`, title: NC_TITLE[lang], subtitle: valid ? `${scope.from} → ${scope.to}` : '',
    generatedAt: valid ? a.generatedAt : new Date(0).toISOString(), cutoff: valid ? a.cutoff : '', lang, depth: 'summary', compare: 'none', synthetic: true, kind: 'noncollection', context: chips,
    totals: valid ? { count: P.issued.count, gross: P.issued.gross, unpaidGross: P.unpaidGross.amount, excludedUnpaid: P.excludedUnpaid.amount, netUnpaid: P.netUnpaid.amount, netUnpaidCount: P.netUnpaid.count, overdue: P.overdue.amount, notYetDue: P.notYetDue.amount, dueUnknown: P.dueUnknown.amount, documented: P.documented.amount, undocumented: P.undocumented.amount } : {},
    empty: !valid || !(P.issued.count > 0), equationOk: valid && failed === 0,
    headline: valid && P.issued.count > 0 ? ncHeadline(a, lang) : [], sections: [...sections, { key: 'assumptions', title: L('البيانات والافتراضات', 'Data and assumptions'), purpose: '', blocks: [{ type: 'list', items: [
      L('البيانات اصطناعية وليست بيانات الوزارة الفعلية، وعدد الفواتير لا يمثل الحجم التشغيلي.', 'The data is synthetic, not the Ministry’s actual data, and the invoice count does not represent operational volume.'),
      L('لكل جدول ورسم وحدة مبلغ واحدة؛ والمبلغ الدقيق بالريال في فحوص المطابقة وجدول الفواتير.', 'Each table and chart uses one amount unit; exact SAR amounts are in the reconciliation checks and the invoice table.'),
      L('الأرقام كلها من التحليل نفسه؛ لا يُعاد حسابها في التقرير ولا في الملفات المصدَّرة.', 'Every figure comes from the same analysis; nothing is recalculated in the report or the exported files.')
    ] }] }],
    summaryText: ''
  });
  model.summaryText = (model.sections[0]?.blocks || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ');
  if (meta) model.meta = { ...meta };
  Object.defineProperty(model, '_inputs', { value: { analysis: a, ncReport: true, spec: { scope: { from: scope.from, to: scope.to } } }, enumerable: false });
  return model;
}

/** the SAME analysis re-expressed in another language (the export dialog's «inLanguage»); null when the model carries no analysis */
export function rebuildNcModel(model, lang) {
  const a = model?._inputs?.analysis; if (!a) return null;
  return buildNcReportModel(a, { lang, meta: model.meta || null });
}
