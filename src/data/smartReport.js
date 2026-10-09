// ============================================================================
// Smart report builder. Pure: takes the SAME snapshot (and forecast) the
// initiating screen used, so a report can never show different numbers from
// the screen that launched it. English and Arabic are authored; Chinese uses
// the English text.
// ============================================================================
import { formatRatio, CATEGORY_LABELS, NONCOLLECTION_CATEGORIES, EXCLUSION_RULES } from './revenueMetrics';
import { REVENUE_SOURCES } from './revenueLedger';
import { describeScope, pickBi, bi } from './revenueInsights';
import { fmtMoney, scaled, unitOfValues, unitLabel } from '../utils/money';
import { BRIDGE_LABELS } from './bridgeLabels';

export const REPORT_FOCUS = ['revenue', 'amanah', 'noncollection', 'investment'];

export function buildSmartReport({ snapshot, bridge = null, forecast, targetPos, achievement, coverage, cards = [], anomalies = [], cases = [], focus = 'revenue', lang = 'en', request = '' }) {
  const ar = lang === 'ar';
  const L = (en, a) => (ar ? a : en);
  const B = (o) => pickBi(o, lang);
  const M = (n) => fmtMoney(n || 0, { lang: ar ? 'ar' : 'en' });
  const cnt = (n) => Number(n || 0).toLocaleString('en-US');
  const tu = unitOfValues(snapshot.byAmanah.flatMap((g) => [g.gross, g.exclusions, g.net, g.collected, g.outstanding])); // ONE unit for the whole table
  const unitName = unitLabel(tu, ar ? 'ar' : 'en');
  const T = snapshot.totals;
  const Q = snapshot.quality;
  const ratioN = formatRatio(T.collectedOverNet, ar ? 'ar' : 'en');
  const basisTxt = L(`Invoices issued ${snapshot.basis?.invoicesFrom || snapshot.scope.from} → ${snapshot.basis?.invoicesTo || snapshot.scope.to}; collections up to ${snapshot.basis?.collectionsAsOf || snapshot.cutoff}`, `فواتير صادرة ${snapshot.basis?.invoicesFrom || snapshot.scope.from} ← ${snapshot.basis?.invoicesTo || snapshot.scope.to}؛ التحصيل حتى ${snapshot.basis?.collectionsAsOf || snapshot.cutoff}`);

  const subtitle = {
    revenue: L('Revenue & collection performance', 'أداء الإيرادات والتحصيل'),
    amanah: L('Amanah comparison', 'مقارنة الأمانات'),
    noncollection: L('Noncollection & exclusions', 'عدم التحصيل والاستبعادات'),
    investment: L('Investment invoices & enforcement linkage', 'فواتير الاستثمار وربط الإنفاذ')
  }[focus] || '';

  const executiveSummary = L(
    `${describeScope(snapshot.scope, 'en')} — data cutoff ${snapshot.cutoff}. ${cnt(snapshot.totals.count)} invoices issued in the period: gross billed ${M(T.gross)} = exclusions ${M(T.exclusions)} (cancelled ${M(T.cancelled)} + approved rules ${M(T.exclusionsRules)}) + net billed ${M(T.net)}. Net billed = collected ${M(T.collected)} + uncollected ${M(T.outstanding)}. Collection rate = collected ÷ net billed = ${ratioN}. Date basis: ${basisTxt}. Payments dated in the period on invoices of any issue period are a separate indicator: ${M(snapshot.receivedInPeriod.total)}. All figures are illustrative demo data.${request ? ` Request: "${request}".` : ''}`,
    `${describeScope(snapshot.scope, 'ar')} — قطع البيانات ${snapshot.cutoff}. ${cnt(snapshot.totals.count)} فاتورة صادرة في الفترة: إجمالي المفوتر ${M(T.gross)} = الاستبعادات ${M(T.exclusions)} (ملغى ${M(T.cancelled)} + قواعد معتمدة ${M(T.exclusionsRules)}) + صافي المفوتر ${M(T.net)}. وصافي المفوتر = المحصّل ${M(T.collected)} + غير المحصّل ${M(T.outstanding)}. نسبة التحصيل = المحصّل ÷ صافي المفوتر = ${ratioN}. أساس التاريخ: ${basisTxt}. المقبوض حسب تاريخ الدفع داخل الفترة على فواتير أي فترة إصدار مؤشر مستقل: ${M(snapshot.receivedInPeriod.total)}. جميع الأرقام توضيحية.${request ? ` الطلب: "${request}".` : ''}`
  );

  const keyMetrics = [
    { label: L('Gross billed', 'إجمالي المفوتر'), value: M(T.gross), caption: L('Value of invoices issued in the period, before exclusions', 'قيمة الفواتير الصادرة في الفترة قبل الاستبعادات') },
    { label: L('Exclusions', 'الاستبعادات'), value: M(T.exclusions), caption: L(`Cancelled ${M(T.cancelled)} (${T.cancelledCount} invoices) + approved rules ${M(T.exclusionsRules)} (${T.excludedCount} invoices), deducted once; ${T.overlapCount} cancelled invoice(s) also carry a rule reason and are not deducted twice. Not declared uncollectible.`, `ملغى ${M(T.cancelled)} (${T.cancelledCount} فاتورة) + قواعد معتمدة ${M(T.exclusionsRules)} (${T.excludedCount} فاتورة)، تُخصم مرة واحدة؛ ${T.overlapCount} فاتورة ملغاة لها سبب استبعاد أيضاً ولا تُخصم مرتين. لا تُعدّ غير قابلة للتحصيل.`) },
    { label: L('Net billed', 'صافي المفوتر'), value: M(T.net), caption: L('Gross billed − exclusions', 'إجمالي المفوتر − الاستبعادات') },
    { label: L('Collected (within net billed)', 'المحصّل (ضمن صافي المفوتر)'), value: M(T.collected), caption: L('Receipts on the period\'s invoices up to the reference date', 'تحصيلات فواتير الفترة حتى التاريخ المرجعي') },
    { label: L('Uncollected', 'غير المحصّل'), value: M(T.outstanding), caption: L('Net billed − collected', 'صافي المفوتر − المحصّل') },
    { label: L('Collection rate', 'نسبة التحصيل'), value: ratioN, caption: L('Collected ÷ net billed × 100', 'المحصّل ÷ صافي المفوتر × 100') },
    { label: L('Net uncollected (standing balance)', 'صافي غير المحصل (رصيد قائم)'), value: M(snapshot.stock.netUncollected), caption: L(`All issue periods. Overdue ${M(snapshot.stock.overdue)}, not yet due ${M(snapshot.stock.notYetDue)} at ${snapshot.cutoff}. Different from the period's uncollected.`, `كل فترات الإصدار. متأخر ${M(snapshot.stock.overdue)} ولم يحن ${M(snapshot.stock.notYetDue)} عند ${snapshot.cutoff}. يختلف عن غير المحصّل للفترة.`) },
    { label: L('Received in period (any invoice period)', 'المقبوض خلال الفترة (أي فترة إصدار)'), value: M(snapshot.receivedInPeriod.total), caption: L(`By payment date; of which ${M(snapshot.receivedInPeriod.fromPriorInvoices)} on earlier-period invoices. A separate indicator — not used in the collection rate`, `حسب تاريخ الدفع؛ منها ${M(snapshot.receivedInPeriod.fromPriorInvoices)} على فواتير فترات سابقة. مؤشر مستقل — لا يدخل في نسبة التحصيل`) }
  ];
  if (achievement && !achievement.scopeCaveat) keyMetrics.push({ label: L('Collection target achievement', 'تحقيق مستهدف التحصيل'), value: formatRatio(achievement.achievement, ar ? 'ar' : 'en'), caption: L(`Receipts YTD ${M(achievement.receiptsYtd)} vs cumulative target ${M(achievement.targetYtd || 0)} (target is a demo input)`, `المقبوضات ${M(achievement.receiptsYtd)} مقابل المستهدف التراكمي ${M(achievement.targetYtd || 0)} (المستهدف مُدخل توضيحي)`) });
  if (coverage && !coverage.scopeCaveat) keyMetrics.push({ label: L('Revenue coverage, chapters 1–3', 'تغطية الإيرادات للأبواب 1–3'), value: formatRatio(coverage.coverage, ar ? 'ar' : 'en'), caption: L(`Receipts ÷ eligible original budget prorated to ${coverage.elapsedMonths}/12 (${M(coverage.proratedBudget)}). Separate from target achievement; eligibility and transfer rules unresolved.`, `المقبوضات ÷ الميزانية الأصلية المؤهلة موزعة على ${coverage.elapsedMonths}/12 (${M(coverage.proratedBudget)}). مستقلة عن تحقيق المستهدف؛ وقواعد الأهلية والمناقلة غير محسومة.`) });

  const analysisTable = {
    headers: [L('Amanah', 'الأمانة'), L('Invoices', 'الفواتير'), L(`Gross (${unitName})`, `الإجمالي (${unitName})`), L(`Exclusions (${unitName})`, `الاستبعادات (${unitName})`), L(`Net (${unitName})`, `الصافي (${unitName})`), L(`Collected (${unitName})`, `المحصّل (${unitName})`), L(`Uncollected (${unitName})`, `غير المحصّل (${unitName})`), L('Collection rate', 'نسبة التحصيل')],
    rows: snapshot.byAmanah.map((g) => [pickBi(g.label, lang), cnt(g.count), scaled(g.gross, tu), scaled(g.exclusions, tu), scaled(g.net, tu), scaled(g.collected, tu), scaled(g.outstanding, tu), formatRatio(g.collectedOverNet, ar ? 'ar' : 'en', 0)]),
    // exports keep the exact numbers in SAR beside the abbreviated display columns (never the abbreviated value alone)
    rawHeaders: ['amanah', 'invoice_count', 'gross_sar', 'exclusions_sar', 'net_sar', 'collected_sar', 'uncollected_sar', 'collection_rate_pct', `gross_${tu.key.toLowerCase()}`, `exclusions_${tu.key.toLowerCase()}`, `net_${tu.key.toLowerCase()}`, `collected_${tu.key.toLowerCase()}`, `uncollected_${tu.key.toLowerCase()}`],
    rawRows: snapshot.byAmanah.map((g) => [pickBi(g.label, lang), g.count, g.gross, g.exclusions, g.net, g.collected, g.outstanding, g.collectedOverNet.calculable ? Math.round(g.collectedOverNet.value * 1000) / 10 : 'n/a', g.gross / tu.div, g.exclusions / tu.div, g.net / tu.div, g.collected / tu.div, g.outstanding / tu.div])
  };

  // Confirmed findings = states read from records (never causes).
  const discoveries = [];
  for (const c of NONCOLLECTION_CATEGORIES) {
    const n = snapshot.noncollection[c];
    if (n.count) discoveries.push(L(`${CATEGORY_LABELS[c].en}: ${n.count} invoice(s), ${M(n.amount)}${c === 'excluded' ? ' (excluded from the denominator — not declared uncollectible)' : ' outstanding'}. [calculated from records]`, `${CATEGORY_LABELS[c].ar}: ${n.count} فاتورة، ${M(n.amount)}${c === 'excluded' ? ' (مستبعدة من المقام — ولا تُعدّ غير قابلة للتحصيل)' : ' متبقٍ'}. [محسوب من السجلات]`));
  }
  const top = snapshot.byAmanah.filter((g) => g.outstanding > 0)[0];
  if (top) discoveries.unshift(L(`Largest outstanding balance: ${pickBi(top.label, 'en')} — ${M(top.outstanding)} (${T.outstanding > 0 ? Math.round((top.outstanding / T.outstanding) * 100) : 0}% of total). [calculated]`, `أكبر رصيد متبقٍ: ${pickBi(top.label, 'ar')} — ${M(top.outstanding)} (${T.outstanding > 0 ? Math.round((top.outstanding / T.outstanding) * 100) : 0}% من الإجمالي). [محسوب]`));
  if (focus === 'investment') {
    const inv = snapshot.bySource.find((s) => s.key === 'investment');
    discoveries.unshift(inv
      ? L(`Investment (Furas-origin) invoices: ${inv.count} issued, ${M(inv.net)} net billed, ${M(inv.outstanding)} outstanding. Contract schedules, future installments and Sanad execution are on the Contracts page; execution amounts are not added to the debt.`, `فواتير الاستثمار (مصدرها فرص): ${inv.count} صادرة، صافي مفوتر ${M(inv.net)}، متبقٍ ${M(inv.outstanding)}. جداول العقود والدفعات المستقبلية وتنفيذ سند في صفحة العقود؛ ولا تُضاف مبالغ التنفيذ إلى المديونية.`)
      : L('No investment-source invoices in this scope.', 'لا توجد فواتير بمصدر استثماري في هذا النطاق.'));
  }
  if (!discoveries.length) discoveries.push(L('No findings in this scope.', 'لا توجد نتائج في هذا النطاق.'));

  // "Risks" = missing data, conflicts and unresolved decisions (what limits the findings).
  const risks = [];
  if (Q.amountConflictCount) risks.push({ priority: L('High', 'عالية'), title: L(`${Q.amountConflictCount} amount conflict(s)`, `${Q.amountConflictCount} تعارض مبلغ`), rationale: L(`Header amounts conflict with line items on ${Q.amountConflicts.join(', ')}. The figures above use the source header amount; the correct amount is unresolved.`, `تتعارض مبالغ الرأس مع البنود في ${Q.amountConflicts.join('، ')}. تستخدم الأرقام أعلاه مبلغ رأس المصدر؛ والمبلغ الصحيح غير محسوم.`) });
  if (Q.pendingExclusionCount) risks.push({ priority: L('Medium', 'متوسطة'), title: L(`${Q.pendingExclusionCount} exclusion candidate(s) pending review`, `${Q.pendingExclusionCount} مرشح استبعاد بانتظار المراجعة`), rationale: L('They remain in net billed until a reviewer approves them.', 'تبقى ضمن صافي المفوتر حتى يعتمدها مراجع.') });
  if (Q.contractIssueCount) risks.push({ priority: L('Medium', 'متوسطة'), title: L('Investment invoices without a linked contract', 'فواتير استثمار بلا عقد مرتبط'), rationale: L(`${Q.contractIssues.join(', ')}: not excluded; a human decision is required.`, `${Q.contractIssues.join('، ')}: لم تُستبعد؛ ويلزم قرار بشري.`) });
  if (Q.missingFieldCount) risks.push({ priority: L('Medium', 'متوسطة'), title: L('Missing mandatory fields', 'حقول إلزامية ناقصة'), rationale: L(`${Q.missingFieldRecords.join(', ')}: cannot be referred to enforcement until completed.`, `${Q.missingFieldRecords.join('، ')}: لا يمكن إحالتها للتنفيذ قبل الاستكمال.`) });
  if (snapshot.unapprovedRulesApplied.length) risks.push({ priority: L('High', 'عالية'), title: L('Exclusions rest on unapproved rules', 'استبعادات تستند إلى قواعد غير معتمدة'), rationale: L(`${snapshot.unapprovedRulesApplied.join(', ')}: ${M(T.exclusionsUnapproved)} is shown as unapproved and can be switched off in the rule registry.`, `${snapshot.unapprovedRulesApplied.join('، ')}: ${M(T.exclusionsUnapproved)} يُعرض بوصفه غير معتمد ويمكن تعطيل القواعد من سجل القواعد.`) });
  const pendingCases = cases.filter((c) => !c.links.some((l) => l.status === 'confirmed'));
  if (pendingCases.length) risks.push({ priority: L('Medium', 'متوسطة'), title: L(`${pendingCases.length} enforcement case(s) without a confirmed invoice link`, `${pendingCases.length} قضية إنفاذ بلا رابط فاتورة مؤكد`), rationale: L('Recoveries on these cases cannot yet be tied to receivables; candidate matches need human review.', 'لا يمكن ربط متحصلات هذه القضايا بالمستحقات بعد؛ والمطابقات المقترحة تحتاج مراجعة بشرية.') });
  risks.push({ priority: L('Medium', 'متوسطة'), title: L('All figures are demo data', 'جميع الأرقام بيانات تجريبية'), rationale: L('Records are generated demo data standing in for periodic uploads / feeds from Tahseel, Furas, Sanad, Efaa and CR View. They are labelled demo and are not the Ministry\'s actual figures.', 'السجلات بيانات تجريبية مولّدة تحل محل الرفع الدوري أو التغذية من تحصيل وفرص وسند وإيفاء وCR View. وهي موسومة تجريبية وليست أرقام الوزارة الفعلية.'), timeframe: L('Until real reports are uploaded', 'حتى رفع التقارير الفعلية'), confidence: L('Certain', 'مؤكد') });
  risks.push({ priority: L('Medium', 'متوسطة'), title: L('Unresolved business definitions', 'تعريفات أعمال غير محسومة'), rationale: L('Grace-period treatment, the exclusion approval authority and category list, the approved collection-rate target and the coverage eligibility/transfer rules are unresolved and kept configurable.', 'معاملة فترة السماح وجهة اعتماد الاستبعاد وقائمة فئاته والمستهدف المعتمد لمعدل التحصيل وقواعد أهلية التغطية والمناقلة غير محسومة وتبقى قابلة للضبط.') });

  const predictions = [];
  if (forecast?.ready) {
    const lo = forecast.horizon.low.reduce((a, b) => a + b, 0);
    const hi = forecast.horizon.high.reduce((a, b) => a + b, 0);
    predictions.push({
      prediction: L(`Independent forecast of receipts for the rest of fiscal year: ${M(forecast.fiscalYear.projectedRemainder)} (indicative range ${M(lo)}–${M(hi)}).`, `التنبؤ المستقل لمقبوضات بقية السنة المالية: ${M(forecast.fiscalYear.projectedRemainder)} (نطاق إرشادي ${M(lo)}–${M(hi)}).`),
      timeframe: `${forecast.horizon.months[0]} → ${forecast.horizon.months[forecast.horizon.months.length - 1]}`,
      confidence: forecast.backtest ? L(`Measured backtest: n=${forecast.backtest.n}${forecast.backtest.mape != null ? `, MAPE ${(forecast.backtest.mape * 100).toFixed(0)}%` : ''} — small sample, not a guarantee`, `اختبار رجعي مقاس: n=${forecast.backtest.n}${forecast.backtest.mape != null ? `، متوسط الخطأ النسبي ${(forecast.backtest.mape * 100).toFixed(0)}%` : ''} — عينة صغيرة وليست ضماناً`) : L('Not measured (too little history); no accuracy figure is claimed', 'غير مقاس (سجل قصير)؛ ولا تُدّعى نسبة دقة'),
      supporting: `${B(forecast.method.label)}; ${forecast.assumptions.map(B).join(' ')}`,
      changing: forecast.limitations.map(B).join(' ')
    });
    if (targetPos?.annualTarget != null) predictions.push({
      prediction: L(`Position against the approved annual target (demo input ${M(targetPos.annualTarget)}): projected full year ${M(targetPos.projectedTotal)}; gap ${M(targetPos.gapToTarget)}. The forecast is independent of the target and was not adjusted to meet it.`, `الموقف مقابل المستهدف السنوي المعتمد (مُدخل توضيحي ${M(targetPos.annualTarget)}): السنة المتوقعة ${M(targetPos.projectedTotal)}؛ الفجوة ${M(targetPos.gapToTarget)}. التنبؤ مستقل عن المستهدف ولم يُعدَّل ليطابقه.`),
      timeframe: L('Fiscal year', 'السنة المالية'), confidence: L('Indicative only', 'إرشادي فقط'), supporting: B(targetPos.note), changing: L('Any change to the target input or to receipts history.', 'أي تغيير في مُدخل المستهدف أو سجل المقبوضات.')
    });
    if (forecast.exceptional.length) predictions.push({
      prediction: L(`Exceptional large payment(s) detected (${forecast.exceptional.map((e) => `${e.invoiceId} ${M(e.amount)}`).join('; ')}); removed from the fitted trend so underlying performance is not disguised.`, `رُصدت دفعات استثنائية كبيرة (${forecast.exceptional.map((e) => `${e.invoiceId} ${M(e.amount)}`).join('؛ ')})؛ أُزيلت من الاتجاه المُلائم حتى لا تُخفي الأداء الفعلي.`),
      timeframe: forecast.exceptional.map((e) => e.month).join(', '), confidence: L('Rule-based detection', 'كشف قائم على قاعدة'), supporting: L('Payment ≥ 2.5× the median payment and ≥ 35% of its month.', 'دفعة ≥ 2.5 ضعف وسيط الدفعات و≥ 35% من شهرها.'), changing: L('Thresholds are configuration, not statistical truth.', 'العتبات إعدادات وليست حقيقة إحصائية.')
    });
  } else {
    predictions.push({ prediction: L('Forecast not available for this scope.', 'التنبؤ غير متاح لهذا النطاق.'), timeframe: '—', confidence: L('Not calculable', 'غير قابل للاحتساب'), supporting: forecast ? B(forecast.reasonNotReady) : '', changing: '' });
  }

  const additionalReports = [
    ...(bridge ? [{ title: L('Net-uncollected bridge', 'جسر صافي غير المحصل'), description: bridge.steps.map((x) => `${ar ? BRIDGE_LABELS[x.key].ar : BRIDGE_LABELS[x.key].en}: ${M(x.amount)}`).join(' → ') + ` = ${M(bridge.net)}` + (bridge.unmatched.count ? ` · ${L('Unmatched report invoices (shown apart, not in the net)', 'فواتير تقرير غير مطابقة (منفصلة وليست في الصافي)')}: ${bridge.unmatched.count} / ${M(bridge.unmatched.amount)}` : '') }] : []),
    { title: L('Noncollection by state', 'عدم التحصيل حسب الحالة'), description: NONCOLLECTION_CATEGORIES.map((c) => `${B(CATEGORY_LABELS[c])}: ${snapshot.noncollection[c].count} / ${M(snapshot.noncollection[c].amount)}`).join(' · ') },
    { title: L('Revenue source breakdown', 'التفصيل حسب مصدر الإيراد'), description: snapshot.bySource.map((s) => `${ar ? REVENUE_SOURCES[s.key].ar : REVENUE_SOURCES[s.key].en}: ${L('net', 'صافي')} ${M(s.net)}, ${L('collected', 'محصّل')} ${M(s.collected)}, ${L('outstanding', 'متبقٍ')} ${M(s.outstanding)}`).join(' · ') },
    { title: L('Exclusion rules in force', 'قواعد الاستبعاد السارية'), description: EXCLUSION_RULES.map((r) => `${r.id}: ${B(r.label)} — ${snapshot.config.rules[r.id] ? L('enabled', 'مفعّلة') : L('off', 'معطّلة')}`).join(' · ') }
  ];

  const recommendations = cards.map((c) => ({ priority: c.score >= 0.6 ? L('High', 'عالية') : L('Medium', 'متوسطة'), text: `${B(c.title)} — ${B(c.action)} ${L('Responsible', 'المسؤول')}: ${B(c.responsible)}. ${L('Timeframe', 'الإطار الزمني')}: ${B(c.timeframe)}. ${c.impact?.kind === 'upper_bound' ? `${L('Upper-bound impact', 'الأثر الأقصى')}: +${c.impact.pp} pp (${L('arithmetic, not a forecast', 'حسابي وليس تنبؤاً')}).` : ''} ${L('Proposal for human decision.', 'مقترح لقرار بشري.')}` }));
  if (!recommendations.length) recommendations.push({ priority: L('Low', 'منخفضة'), text: L('No recommended interventions for this scope.', 'لا توجد تدخلات موصى بها لهذا النطاق.') });

  const assumptions = [
    L(`Data cutoff ${snapshot.cutoff}; demo data labelled "تجريبية" standing in for periodic report uploads.`, `قطع البيانات ${snapshot.cutoff}؛ بيانات تجريبية موسومة "تجريبية" تحل محل الرفع الدوري للتقارير.`),
    L(`Exclusion rule set: ${snapshot.ruleSetVersion}. Only approved exclusions under enabled rules reduce net billed.`, `مجموعة قواعد الاستبعاد: ${snapshot.ruleSetVersion}. فقط الاستبعادات المعتمدة وفق قواعد مفعّلة تخفض صافي المفوتر.`),
    L(`Grace period: ${snapshot.config.graceDays} day(s) (unresolved).`, `فترة السماح: ${snapshot.config.graceDays} يوم (غير محسومة).`),
    L('Collected and Received are different populations and are never combined in one ratio.', 'المحصّل والمقبوض مجتمعان مختلفان ولا يُجمعان في نسبة واحدة.'),
    L('Monthly figures are derived from dated payment events, never by differencing cumulative reports.', 'الأرقام الشهرية مشتقة من أحداث دفع مؤرخة وليست بطرح تقارير تراكمية.'),
    L('Review decisions update this solution\'s analytical layer only; no source system is modified.', 'قرارات المراجعة تحدّث الطبقة التحليلية لهذه المنصة فقط؛ ولا يُعدَّل أي نظام مصدر.')
  ];

  const labels = {
    executiveSummary: L('Executive summary', 'الملخص التنفيذي'),
    keyMetrics: L('Indicators', 'المؤشرات'),
    metric: L('Metric', 'المؤشر'), value: L('Value', 'القيمة'), note: L('Definition / note', 'التعريف / ملاحظة'),
    detailedAnalysis: L('Amanah breakdown', 'التفصيل حسب الأمانة'),
    aiDiscoveries: L('Findings from records (calculated)', 'نتائج من السجلات (محسوبة)'),
    risksAlerts: L('Missing data, conflicts and unresolved decisions', 'بيانات ناقصة وتعارضات وقرارات غير محسومة'),
    predictions: L('Forecast and limitations', 'التنبؤ وحدوده'),
    additionalReports: L('Further breakdowns', 'تفصيلات إضافية'),
    recommendations: L('Recommended interventions (proposals)', 'التدخلات الموصى بها (مقترحات)'),
    dataAssumptions: L('Data sources, cutoff and assumptions', 'مصادر البيانات وقطعها والافتراضات'),
    priority: L('Priority', 'الأولوية'), title: L('Title', 'العنوان'), rationale: L('Rationale', 'المبرر'),
    timeframe: L('Timeframe', 'الإطار الزمني'), confidence: L('Evidence of accuracy', 'دليل الدقة'),
    supportingFactors: L('Method and assumptions', 'المنهج والافتراضات'), changingFactors: L('Limitations', 'القيود')
  };

  return {
    title: L('Smart revenue report', 'التقرير الذكي للإيرادات'),
    subtitle,
    generatedOn: `${L('Generated', 'أُنشئ')}: ${new Date().toISOString().slice(0, 10)} · ${L('data cutoff', 'قطع البيانات')} ${snapshot.cutoff}`,
    executiveSummary, keyMetrics,
    detailedAnalysis: { intro: L('Each row uses its own net billed as the denominator and the same shared metric definitions as every other screen.', 'يستخدم كل صف صافي مفوتره كمقام ونفس تعريفات المؤشرات المشتركة في بقية الشاشات.'), table: analysisTable },
    discoveries, risks, predictions, additionalReports, recommendations, assumptions, labels,
    charts: {
      composition: { labels: [L('Collected', 'المحصّل'), L('Uncollected', 'غير المحصّل'), L('Exclusions', 'الاستبعادات')], values: [T.collected, T.outstanding, T.exclusions] },
      amanah: { labels: snapshot.byAmanah.map((g) => pickBi(g.label, lang)), net: snapshot.byAmanah.map((g) => g.net), collected: snapshot.byAmanah.map((g) => g.collected) },
      source: { labels: snapshot.bySource.map((s) => (ar ? REVENUE_SOURCES[s.key].ar : REVENUE_SOURCES[s.key].en)), net: snapshot.bySource.map((s) => s.net), collected: snapshot.bySource.map((s) => s.collected) }
    },
    meta: { invoiceCount: T.count, cutoff: snapshot.cutoff, scope: snapshot.scope }
  };
}

export { bi };
