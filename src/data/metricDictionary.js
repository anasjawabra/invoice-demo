// ============================================================================
// Metric dictionary — ONE entry per metric, shown on the "Metric dictionary" page
// and behind the (?) on every tile. Each entry carries: definition, formula,
// period basis, date basis, scope, sources, update date, rule version and
// completeness. The numbers themselves always come from computeSnapshot().
// ============================================================================
import { METRIC_DEFINITIONS, EXCLUSION_RULE_SET_VERSION, ratio } from './revenueMetrics';

const BI = (ar, en) => ({ ar, en });

// Static text per metric. `kind` says whether it is a period FLOW, a point-in-time STOCK, a ratio or a plan metric.
const ENTRIES = [
  { key: 'gross', kind: 'flow', sources: ['tahseel', 'makeen'], label: BI('إجمالي المفوتر', 'Gross billed'),
    definition: BI('قيمة الفواتير الصادرة في الفترة قبل أي استبعاد (تشمل التسويات المعتمدة).', 'Value of the invoices issued in the period before any exclusion (approved adjustments included).'),
    formula: BI('Σ قيمة الفاتورة المعدّلة، مرة واحدة لكل فاتورة = الاستبعادات + صافي المفوتر', 'Σ adjusted invoice value, once per invoice = exclusions + net billed'),
    period: BI('الفترة المحددة', 'Selected period'), dateBasis: BI('تاريخ إصدار الفاتورة', 'Invoice issue date') },
  { key: 'adjustments', kind: 'flow', sources: ['tahseel'], label: BI('التسويات المعتمدة', 'Approved adjustments'),
    definition: BI('إشعارات دائنة/تخفيضات معتمدة. تُحتسب داخل إجمالي المفوتر ولا تُخصم مرة ثانية.', 'Approved credit notes / reductions. Already included in gross billed; never deducted again.'),
    formula: BI('Σ التسويات المؤرخة حتى تاريخ القطع (سالبة)', 'Σ adjustments dated up to the cutoff (negative)'),
    period: BI('الفترة المحددة', 'Selected period'), dateBasis: BI('تاريخ التسوية ≤ تاريخ القطع', 'Adjustment date ≤ cutoff') },
  { key: 'cancelled', kind: 'flow', sources: ['tahseel'], label: BI('منها: الفواتير الملغاة', 'Of which: cancelled invoices'),
    definition: BI('فواتير حالتها ملغاة في المصدر. تُخصم من الأساس مرة واحدة، وتأخذ الأسبقية على الاستبعاد.', 'Invoices whose source status is cancelled. Deducted once, and take precedence over exclusion.'),
    formula: BI('Σ المتبقي على الفواتير الملغاة (بعد المقبوض)', 'Σ remaining amount of cancelled invoices (after receipts)'),
    period: BI('الفترة المحددة', 'Selected period'), dateBasis: BI('تاريخ الإلغاء ≤ تاريخ القطع', 'Cancellation date ≤ cutoff'),
    caveat: BI('الفواتير المحالة للتنفيذ وتظهر "ملغاة" في المصدر تبقى غير محصلة (قاعدة ENF-1).', 'Enforcement-referred invoices shown "cancelled" in the source stay uncollected (rule ENF-1).') },
  { key: 'exclusions', kind: 'flow', sources: ['tahseel', 'efaa', 'cr-view', 'furas'], label: BI('الاستبعادات', 'Exclusions'),
    definition: BI('جزء من إجمالي المفوتر يُخصم مرة واحدة فقط: الفواتير الملغاة + الفواتير ذات سبب استبعاد معتمد. للفاتورة سبب رئيسي واحد مهما تعددت الأسباب، والملغاة التي لها سبب استبعاد تُخصم مرة واحدة.', 'The part of gross billed removed exactly once: cancelled invoices + invoices with an approved exclusion reason. One primary reason per invoice however many apply; a cancelled invoice that also has a reason is deducted once.'),
    formula: BI('الملغى + المستبعد بقاعدة معتمدة = إجمالي المفوتر − صافي المفوتر', 'Cancelled + rule-excluded = gross billed − net billed'),
    period: BI('الفترة المحددة', 'Selected period'), dateBasis: BI('فواتير صادرة في الفترة؛ الإلغاء/الاستبعاد سارٍ حتى التاريخ المرجعي', 'Invoices issued in the period; cancellation/exclusion effective up to the reference date'),
    caveat: BI('الاستبعاد لا يعني أن المبلغ غير قابل للتحصيل. لا تُخصم الاستبعادات مجدداً من صافي المفوتر أو غير المحصل.', 'Exclusion never means uncollectible. Exclusions are not deducted again from net billed or uncollected.') },
  { key: 'net', kind: 'flow', sources: ['tahseel', 'makeen'], label: BI('صافي المفوتر', 'Net billed'),
    definition: BI('إجمالي المفوتر بعد خصم الاستبعادات مرة واحدة — أساس نسبة التحصيل لفترة الإصدار.', 'Gross billed less exclusions, deducted once — the base of the collection rate for the issue period.'),
    formula: BI('إجمالي المفوتر − الاستبعادات = المحصّل + غير المحصّل', 'Gross billed − exclusions = collected + uncollected'),
    period: BI('الفترة المحددة', 'Selected period'), dateBasis: BI('تاريخ إصدار الفاتورة', 'Invoice issue date'),
    caveat: BI('صافي المفوتر ليس الرصيد القائم: الأول تدفق لفترة إصدار والثاني رصيد قائم في تاريخ القطع.', 'Net billed is NOT net uncollected: the first is a flow for an issue period, the second a standing balance at the cutoff.') },
  { key: 'collected', kind: 'flow', sources: ['tahseel', 'sadad'], label: BI('المحصّل (ضمن صافي المفوتر)', 'Collected (within net billed)'),
    definition: BI('المبلغ المحصل ضمن صافي المفوتر على فواتير الفترة حتى التاريخ المرجعي. تحصيلات ما بعد التاريخ المرجعي أو على فواتير مستبعدة لا تدخل.', 'Amount collected within net billed on the period\'s invoices up to the reference date. Receipts after the reference date, or on excluded invoices, do not enter.'),
    formula: BI('Σ min(المدفوع، صافي الفاتورة) لكل فاتورة', 'Σ min(paid, invoice net) per invoice'),
    period: BI('الفترة المحددة', 'Selected period'), dateBasis: BI('تاريخ الدفع ≤ تاريخ القطع', 'Payment date ≤ cutoff') },
  { key: 'uncollected', kind: 'flow', sources: ['tahseel', 'sadad'], label: BI('غير المحصّل', 'Uncollected'),
    definition: BI('الجزء من صافي المفوتر الذي لم يُحصَّل حتى التاريخ المرجعي، لفواتير الفترة المحددة.', 'The part of net billed not yet collected at the reference date, for the selected period\'s invoices.'),
    formula: BI('صافي المفوتر − المحصّل', 'Net billed − collected'),
    period: BI('الفترة المحددة', 'Selected period'), dateBasis: BI('فواتير صادرة في الفترة؛ التحصيل حتى التاريخ المرجعي', 'Invoices issued in the period; collections up to the reference date') },
  { key: 'received', kind: 'flow', sources: ['tahseel', 'sadad'], label: BI('المقبوض خلال الفترة', 'Received in period'),
    definition: BI('كل المدفوعات المؤرخة داخل الفترة على فواتير من أي فترة إصدار.', 'All payments dated within the period, on invoices of any issue period.'),
    formula: BI('Σ المدفوعات المؤرخة ضمن الفترة', 'Σ payments dated within the period'),
    period: BI('الفترة المحددة', 'Selected period'), dateBasis: BI('تاريخ الدفع', 'Payment date'),
    caveat: BI('مجتمع مختلف عن "المحصّل"؛ لا يُقسم على صافي مفوتر الفترة.', 'A different population from "Collected"; never divided by period-issued net billed.') },
  { key: 'netUncollected', kind: 'stock', sources: ['tahseel', 'makeen', 'efaa'], label: BI('الرصيد القائم', 'Standing balance (net uncollected)'),
    definition: BI('رصيد الفواتير الصادرة حتى تاريخ القطع ولم تُسدَّد، بعد استبعاد الملغاة والمستبعدة (دون تداخل). يشمل ما لم يحن استحقاقه ويُفصل عن المتأخر.', 'Standing balance of invoices issued up to the cutoff and still unpaid, after removing cancelled and excluded (non-overlapping). Includes not-yet-due amounts, shown apart from arrears.'),
    formula: BI('رقم تقرير غير المسدد − فروقات المطابقة − الملغاة − المستبعدة (غير المتداخلة) + فواتير بعد التقرير + النطاق الداخلي', 'Unpaid report − reconciliation differences − cancelled − excluded (non-overlapping) + invoices after the report + internal scope'),
    period: BI('رصيد في تاريخ القطع', 'Standing balance at the cutoff'), dateBasis: BI('كل ما صدر حتى تاريخ القطع، بغض النظر عن الفترة المحددة', 'Everything issued up to the cutoff, regardless of the selected period') },
  { key: 'overdue', kind: 'stock', sources: ['tahseel'], label: BI('المتأخر (متأخرات)', 'Overdue (arrears)'),
    definition: BI('جزء الرصيد القائم الذي تجاوز تاريخ استحقاقه. الأقساط المستقبلية ليست متأخرات.', 'Part of net uncollected past its due date. Future installments are never arrears.'),
    formula: BI('Σ المتبقي حيث تاريخ الاستحقاق + فترة السماح < تاريخ القطع', 'Σ remaining where due date + grace < cutoff'),
    period: BI('رصيد في تاريخ القطع', 'Standing balance at the cutoff'), dateBasis: BI('تاريخ الاستحقاق', 'Due date') },
  { key: 'notYetDue', kind: 'stock', sources: ['tahseel', 'furas'], label: BI('لم يحن استحقاقه', 'Not yet due'),
    definition: BI('مفوتر ولم يحن استحقاقه. جزء من الرصيد القائم لكنه ليس متأخراً.', 'Invoiced but not yet due. Part of net uncollected but not overdue.'),
    formula: BI('Σ المتبقي حيث تاريخ الاستحقاق ≥ تاريخ القطع', 'Σ remaining where due date ≥ cutoff'),
    period: BI('رصيد في تاريخ القطع', 'Standing balance at the cutoff'), dateBasis: BI('تاريخ الاستحقاق', 'Due date') },
  { key: 'collectedOverNet', kind: 'ratio', sources: ['tahseel'], label: BI('نسبة التحصيل', 'Collection rate'),
    definition: BI('المحصّل ÷ صافي المفوتر × 100 ضمن النطاق والفترة نفسيهما. تُحسب النسبة الإجمالية من مجموع المحصل ÷ مجموع الصافي لا من متوسط نسب الجهات. إذا كان الصافي صفراً: «غير متاحة».', 'Collected ÷ net billed × 100 for the same scope and period. The overall rate is Σ collected ÷ Σ net, never an average of Amanah rates. Zero net billed: "Not available".'),
    formula: BI('المحصّل ÷ صافي المفوتر × 100', 'Collected ÷ net billed × 100'),
    period: BI('الفترة المحددة', 'Selected period'), dateBasis: BI('فواتير صادرة في الفترة', 'Invoices issued in the period') },
  { key: 'targetAchievement', kind: 'plan', sources: ['target-config'], label: BI('تحقيق المستهدف', 'Target achievement'),
    definition: BI('المقبوضات التراكمية منذ بداية السنة المالية ÷ المستهدف الشهري التراكمي المعتمد. المستهدف مُدخل بإصدار؛ لا يُشتق من البيانات ولا يدخل في التنبؤ.', 'Fiscal-year-to-date receipts ÷ cumulative approved monthly target. The target is a versioned INPUT; never derived from data and never used by the forecast.'),
    formula: BI('Σ المقبوضات منذ بداية السنة ÷ (المستهدف السنوي × أوزان الأشهر)', 'Σ fiscal-YTD receipts ÷ (annual target × month weights)'),
    period: BI('منذ بداية السنة المالية', 'Fiscal year to date'), dateBasis: BI('تاريخ الدفع', 'Payment date'),
    caveat: BI('لا تُجمع قيم YTD لشهور مختلفة؛ تُقارن فترات متجانسة فقط.', 'Year-to-date values for different months are never summed; only homogeneous periods are compared.') },
  { key: 'coverage', kind: 'plan', sources: ['budget-config'], label: BI('تغطية الإيرادات', 'Revenue coverage'),
    definition: BI('المقبوضات ÷ الميزانية الأصلية المؤهلة للأبواب 1–3 موزعة على الأشهر المنقضية. لا تُحتسب إلا بوجود مقام معتمد.', 'Receipts ÷ eligible ORIGINAL budget of chapters 1–3 prorated to elapsed months. Calculated only with an approved denominator.'),
    formula: BI('Σ المقبوضات منذ بداية السنة ÷ (ميزانية الأبواب 1–3 × الأشهر المنقضية ÷ 12)', 'Σ fiscal-YTD receipts ÷ (chapters 1–3 budget × elapsed months ÷ 12)'),
    period: BI('منذ بداية السنة المالية', 'Fiscal year to date'), dateBasis: BI('تاريخ الدفع', 'Payment date') },
  { key: 'forecast', kind: 'plan', sources: ['tahseel'], label: BI('التنبؤ بالتحصيل', 'Collection forecast'),
    definition: BI('اتجاه المقبوضات الأساسي بعد عزل التحصيلات الاستثنائية. مستقل عن المستهدف، وتُطبَّق السيناريوهات فوقه ولا تغيّره.', 'Underlying receipts trend after separating exceptional collections. Independent of the target; scenarios layer on top and do not change it.'),
    formula: BI('انحدار خطي على المقبوضات الشهرية الأساسية', 'Linear trend on underlying monthly receipts'),
    period: BI('الأشهر القادمة', 'Coming months'), dateBasis: BI('تاريخ الدفع', 'Payment date') }
];

const SOURCE_LABEL = {
  tahseel: BI('تحصيل', 'Tahseel'), makeen: BI('مكين', 'Makeen'), sadad: BI('سداد', 'SADAD'), efaa: BI('إيفاء', 'Efaa'),
  'cr-view': BI('CR View', 'CR View'), furas: BI('فرص', 'Furas'), 'target-config': BI('إعدادات المستهدف', 'Target configuration'), 'budget-config': BI('إعدادات الميزانية', 'Budget configuration')
};

export function scopeText(scope, lang = 'ar') {
  if (!scope) return '—';
  const am = scope.amanah === 'all' ? (lang === 'ar' ? 'كل الأمانات' : 'all Amanahs') : [].concat(scope.amanah).join(', ');
  const src = scope.source === 'all' ? (lang === 'ar' ? 'كل مصادر الإيراد' : 'all revenue sources') : scope.source;
  return `${am} · ${src} · ${scope.from} → ${scope.to}`;
}

// Completeness = share of in-scope records with every mandatory field and a consistent amount.
export function completenessOf(snapshot) {
  const q = snapshot.quality;
  const total = q.records || 0;
  // counts come from the data service; an invoice that has two problems is counted twice, so this is a conservative (lower) completeness
  const bad = Math.min(total, (q.missingFieldCount || 0) + (q.amountConflictCount || 0) + (q.contractIssueCount || 0));
  return ratio(total - bad, total);
}

export function metricDictionary(snapshot) {
  const completeness = completenessOf(snapshot);
  const asOf = snapshot.cutoff;
  return ENTRIES.map((e) => ({
    ...e,
    scope: { ar: scopeText(snapshot.scope, 'ar'), en: scopeText(snapshot.scope, 'en') },
    sourceLabels: e.sources.map((s) => SOURCE_LABEL[s] || BI(s, s)),
    updatedAt: asOf,
    ruleVersion: EXCLUSION_RULE_SET_VERSION,
    completeness,
    // existing long-form definition (population etc.) when available
    legacy: METRIC_DEFINITIONS[e.key] || null
  }));
}

export const METRIC_KEYS = ENTRIES.map((e) => e.key);
