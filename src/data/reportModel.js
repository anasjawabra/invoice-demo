// ============================================================================
// Report model — the ONE structure that is both rendered in the conversation and exported (Word / Excel / PowerPoint), so the
// exported figures, filters and content are exactly the displayed ones. Pure: built from the shared snapshots only.
//
// Block types: text · kpis · relations · table · chart · insights · callout · list
// Tables hold RAW numbers (money in SAR); the renderer / exporters show every money column in ONE unit (stated in the header)
// and Excel also gets the exact SAR. Charts hold SAR series and use one unit per chart.
// ============================================================================
import { isSingleMonth } from './clock';
import { buildSmartReport } from './smartReport';
import { buildInsights, sourceAr, sourceEn } from './insightsEngine';
import { fairComparison } from './strategicCalc';
import { CATEGORY_LABELS, EXCLUSION_RULES, compareSnapshots } from './revenueMetrics';
import { fmtMoney, unitOfValues, unitLabel, scaled, fmtInt } from '../utils/money';
import { budgetExecution, operatingCoverage, FINANCE_STATUS } from './syntheticFinance';
import { BRIDGE_LABELS } from './bridgeLabels';

export const SECTION_ORDER = ['executive', 'trends', 'amanah', 'sources', 'aging', 'exclusions', 'gaps', 'status', 'budget', 'quality', 'bases', 'channels'];
export const SECTION_META = {
  executive: { ar: 'الملخص التنفيذي', en: 'Executive summary', purpose: { ar: 'ما الوضع الآن؟ العلاقات المالية بين الإجمالي والاستبعادات والصافي والمحصّل.', en: 'What is the situation? The relationships between gross, exclusions, net and collected.' } },
  trends: { ar: 'الاتجاه الشهري', en: 'Monthly trend', purpose: { ar: 'الأداء شهراً بشهر ومقابل العام السابق: فواتير كل شهر (أساس الإصدار) منفصلة عن المقبوض خلال الشهر (أساس الدفع).', en: 'Month-by-month performance and against last year: invoices of each month (issue basis) separate from receipts during the month (payment basis).' } },
  amanah: { ar: 'الأمانات والبلديات', en: 'Amanahs & municipalities', purpose: { ar: 'أين الأداء الأقوى والأضعف؟ الإجمالي = مجموع المحصّل ÷ مجموع الصافي لا متوسط النسب.', en: 'Where is performance strongest and weakest? The total is Σ collected ÷ Σ net, not an average of rates.' } },
  sources: { ar: 'مصادر الإيراد', en: 'Revenue sources', purpose: { ar: 'الأداء بحسب الاستثمار (فرص) والغرامات والرسوم والتراخيص والإيواء والتبغ والأراضي البيضاء والمبيعات.', en: 'Performance by Furas investment, fines, fees, licences, accommodation, tobacco, white lands and sales.' } },
  aging: { ar: 'المتأخرات والتقادم', en: 'Outstanding & aging', purpose: { ar: 'رصيد قائم في التاريخ المرجعي لكل ما صدر حتى ذلك التاريخ، موزع بحسب العمر بعد الاستحقاق.', en: 'A standing balance at the reference date for everything issued up to it, by age past due.' } },
  exclusions: { ar: 'الاستبعادات وأسبابها', en: 'Exclusions & reasons', purpose: { ar: 'ما أُخرج من إجمالي المفوتر ولماذا؛ كل فاتورة تُخصم مرة واحدة تحت سببها الرئيسي.', en: 'What was taken out of gross billed and why; each invoice is deducted once under its primary reason.' } },
  gaps: { ar: 'فجوات التحصيل وأولويات المتابعة', en: 'Collection gaps & priorities', purpose: { ar: 'أكبر فرص رفع التحصيل: فجوة كل خلية أمانة × مصدر مقابل مستهدف تجريبي.', en: 'The biggest opportunities: each Amanah × source cell against a demo target.' } },
  status: { ar: 'الفواتير وحالة الدفع', en: 'Invoices & payment status', purpose: { ar: 'عدد كل حالة ومبلغها؛ مجموع الحالات يساوي مجموع الفواتير.', en: 'The count and amount of each state; the states add up to the total.' } },
  budget: { ar: 'الميزانية وتنفيذ الإنفاق', en: 'Budget and expenditure execution', purpose: { ar: 'الميزانية المعتمدة مقابل الالتزام والاستحقاق والصرف النقدي، وتغطية الإيرادات المحصّلة للإنفاق التشغيلي — على المستوى الوطني وبأساس معلن.', en: 'Approved budget versus commitment, accrual and cash payment, and coverage of operating expenditure by collected revenue — national level, stated basis.' } },
  quality: { ar: 'اكتمال البيانات والمطابقة', en: 'Completeness & reconciliation', purpose: { ar: 'هل يمكن الوثوق بالأرقام؟ فحوص المطابقة ومشاكل الاكتمال والقياسات غير المتاحة.', en: 'Can the numbers be trusted? Reconciliation checks, completeness issues and unavailable measures.' } },
  bases: { ar: 'أساس القياس', en: 'Measurement basis', purpose: { ar: 'يفصل المحصّل على فواتير الفترة عن المقبوض بتاريخ الدفع خلال الفترة.', en: 'Keeps collected on period invoices apart from receipts dated in the period.' } },
  channels: { ar: 'قنوات الدفع', en: 'Payment channels', purpose: { ar: 'من أين يأتي المقبوض (سداد، تحويل، بطاقة، محفظة، تنفيذ).', en: 'Where receipts come from (SADAD, transfer, card, wallet, enforcement).' } }
};
const CHANNEL = { sadad: ['سداد', 'SADAD'], voluntary: ['سداد طوعي', 'Voluntary'], enforcement: ['تنفيذ', 'Enforcement'], transfer: ['تحويل بنكي', 'Bank transfer'], card: ['بطاقة', 'Card'], wallet: ['محفظة المنشأة', 'Facility wallet'] };
const STATUS = { collected: { ar: 'محصّلة بالكامل', en: 'Collected in full' }, ...CATEGORY_LABELS };
const RULE = { cancelled: ['ملغاة في المصدر', 'Cancelled in the source'] };
const ratio = (a, b) => (b > 0 ? a / b : null);
const prevYear = (m) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`;

export const PRESET_LABEL = { ytd: ['السنة حتى اليوم', 'Year to date'], month: ['هذا الشهر حتى اليوم', 'This month to date'], lastMonth: ['الشهر الماضي', 'Last month'], last3: ['آخر 3 أشهر مكتملة', 'Last 3 complete months'], all: ['كل البيانات', 'All data'], custom: ['فترة مخصصة', 'Custom period'] };

export function contextChips(spec, { lang, snapshot, snapshotMeta, labelOfAmanah, labelOfMuni, prevScope = null, compare = 'none' }) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e); const sc = spec.scope;
  const src = sc.source === 'all' ? L('كل المصادر', 'All sources') : (ar ? sourceAr(sc.source) : sourceEn(sc.source));
  const asOf = snapshot?.basis?.collectionsAsOf || snapshot?.cutoff;
  const st = { all: L('كل الحالات', 'All statuses'), collected: L('محصّلة', 'Collected'), open: L('قائمة', 'Open'), overdue: L('متأخرة', 'Overdue'), partial: L('محصّلة جزئياً', 'Partial'), not_due: L('لم يحن استحقاقها', 'Not yet due'), cancelled: L('ملغاة', 'Cancelled'), excluded: L('مستبعدة', 'Excluded') }[sc.status || 'all'] || sc.status;
  const chips = [
    { k: 'period', label: L('الفترة', 'Period'), value: `${sc.from} → ${sc.to}${spec.preset && PRESET_LABEL[spec.preset] ? ` (${PRESET_LABEL[spec.preset][ar ? 0 : 1]})` : ''}` },
    { k: 'amanah', label: L('الأمانة', 'Amanah'), value: sc.amanah === 'all' ? L('كل الأمانات', 'All Amanahs') : labelOfAmanah(sc.amanah) },
    { k: 'muni', label: L('البلدية', 'Municipality'), value: sc.muni === 'all' ? L('كل البلديات', 'All municipalities') : labelOfMuni(sc.muni) },
    { k: 'source', label: L('مصدر الإيراد', 'Revenue source'), value: src },
    { k: 'status', label: L('حالة الفاتورة', 'Invoice status'), value: st },
    ...(sc.scopeType && sc.scopeType !== 'all' ? [{ k: 'scopeType', label: L('النطاق', 'Scope'), value: sc.scopeType === 'internal' ? L('داخلي', 'Internal') : L('مركزي', 'Central') }] : []),
    { k: 'basis', label: L('أساس التقرير', 'Reporting basis'), value: L(`فواتير صادرة في الفترة؛ التحصيل حتى ${asOf}${snapshot?.basis?.collectionsMode === 'period_end' ? ' (نهاية الفترة)' : ''}`, `Invoices issued in the period; collections up to ${asOf}${snapshot?.basis?.collectionsMode === 'period_end' ? ' (the period end)' : ''}`) },
    ...(compare !== 'none' && prevScope ? [{ k: 'compare', label: L('المقارنة', 'Comparison'), value: `${prevScope.from} → ${prevScope.to}${compare === 'prev_month' && !isSingleMonth(sc) ? L(' (الفترة السابقة المساوية في الطول)', ' (preceding period of equal length)') : ''}` }] : []),
    { k: 'data', label: L('البيانات', 'Data'), value: L(`تجريبية اصطناعية${snapshotMeta?.size === 'compact' ? ` — عينة مضغوطة (${(snapshotMeta.counts?.invoicesTotal ?? 0).toLocaleString('en-US')} فاتورة)` : ''}`, `Synthetic demo data${snapshotMeta?.size === 'compact' ? ` — compact sample (${(snapshotMeta.counts?.invoicesTotal ?? 0).toLocaleString('en-US')} invoices)` : ''}`) }
  ];
  return chips;
}

export function buildReportModel({ spec, lang = 'ar', out, prev = null, compare = 'none', prevScope = null, cash = null, bridge = null, targets, cases = [], meta = null, finance = null, financeOk = false, fyReceiptsYtd = null, generatedAt = new Date() }) {
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e); const B = (o) => (o == null ? '' : typeof o === 'string' ? o : (ar ? o.ar : o.en) || o.en || '');
  const snapshot = out.snapshot; const T = snapshot.totals; const comparable = !!prev && prev.totals.count > 0;
  const comparison = comparable ? compareSnapshots(snapshot, prev) : null;
  const labelOfAmanah = (k) => B(snapshot.byAmanah.find((g) => g.key === k)?.label) || k;
  const labelOfMuni = (k) => { const m = snapshot.byMunicipality.find((x) => x.municipality?.key === k)?.municipality; return m ? (ar ? m.ar : m.en) : String(k).split('|').pop(); };
  const chips = contextChips(spec, { lang, snapshot, snapshotMeta: meta, labelOfAmanah, labelOfMuni, prevScope, compare });
  const insightsRes = buildInsights({ snapshot, prev: comparable ? prev : null, comparison, forecast: out.forecast, targets });
  const legacy = buildSmartReport({ snapshot, bridge: out.bridge || bridge, forecast: out.forecast, targetPos: out.targetPos, achievement: out.achievement, coverage: out.coverage, cards: out.cards || [], anomalies: out.anomalies || [], cases, focus: spec.sections.includes('exclusions') ? 'noncollection' : spec.sections.includes('amanah') ? 'amanah' : 'revenue', lang, request: '' });
  // the relations block and the exports read the same typed contract as the Dashboard: amounts + the two rates + the cancelled share of exclusions
  const ctxTotals = { count: T.count, gross: T.gross, exclusions: T.exclusions, cancelled: T.cancelled, net: T.net, collected: T.collected, outstanding: T.outstanding, collectedOverNet: T.collectedOverNet, exclusionRate: T.exclusionRate };

  const tbl = (id, title, headers, rows, { total = null, note = null } = {}) => ({ type: 'table', id, title, headers, rows, total, note });
  const H = (label, kind = 'text') => ({ label, kind });
  const prevRate = (key, by) => { const g = (prev?.[by] || []).find((x) => x.key === key); return g && g.net > 0 ? g.collected / g.net : null; };

  /* ---- sections ---- */
  const sections = {};
  const headline = () => {
    const rate = T.collectedOverNet; const u = unitOfValues([T.gross, T.exclusions, T.net, T.collected, T.outstanding]);
    const m = (v) => fmtMoney(v, { lang, unit: u });
    return [
      { type: 'kpis', unit: u, items: [
        { label: L('إجمالي المفوتر', 'Gross billed'), value: m(T.gross), raw: T.gross, sub: L('قبل الاستبعادات', 'before exclusions') },
        { label: L('الاستبعادات', 'Exclusions'), value: m(T.exclusions), raw: T.exclusions, sub: L(`نسبة الاستبعاد ${T.exclusionRate.calculable ? (T.exclusionRate.value * 100).toFixed(1) + '%' : 'غير متاحة'}`, `Exclusion rate ${T.exclusionRate.calculable ? (T.exclusionRate.value * 100).toFixed(1) + '%' : 'not available'}`) },
        { label: L('صافي المفوتر', 'Net billed'), value: m(T.net), raw: T.net, sub: L('الإجمالي − الاستبعادات', 'Gross − exclusions') },
        { label: L('المحصّل', 'Collected'), value: m(T.collected), raw: T.collected, sub: L('ضمن صافي المفوتر', 'within net billed') },
        { label: L('غير المحصّل', 'Uncollected'), value: m(T.outstanding), raw: T.outstanding, sub: L('الصافي − المحصّل', 'Net − collected') },
        { label: L('نسبة التحصيل', 'Collection rate'), value: rate.calculable ? `${(rate.value * 100).toFixed(1)}%` : L('غير متاحة', 'Not available'), raw: rate.calculable ? rate.value : null, sub: comparable && comparison.collectedOverNetPp.calculable ? L(`${comparison.collectedOverNetPp.value >= 0 ? '+' : ''}${comparison.collectedOverNetPp.value.toFixed(1)} نقطة عن المقارنة`, `${comparison.collectedOverNetPp.value >= 0 ? '+' : ''}${comparison.collectedOverNetPp.value.toFixed(1)} pp vs comparison`) : L('المحصّل ÷ صافي المفوتر × 100', 'Collected ÷ net billed × 100') },
        { label: L('الفواتير', 'Invoices'), value: `${fmtInt(T.count)} ${L('فاتورة', 'invoices')}`, raw: T.count, sub: L('الصادرة في الفترة', 'issued in the period') }
      ] },
    ];
  };
  sections.executive = () => {
    return [
      { type: 'text', text: insightsRes.summary.text[ar ? 'ar' : 'en'] },
      { type: 'relations', totals: ctxTotals },
      ...(comparable ? [tbl('compare', L('المقارنة بالفترة المماثلة', 'Comparison with the equivalent period'), [H(L('المؤشر', 'Measure')), H(L('الفترة الحالية', 'Current'), 'money'), H(L('فترة المقارنة', 'Comparison'), 'money'), H(L('التغير', 'Change'), 'pct')], [
        [L('إجمالي المفوتر', 'Gross billed'), T.gross, prev.totals.gross, ratio(T.gross - prev.totals.gross, prev.totals.gross)],
        [L('الاستبعادات', 'Exclusions'), T.exclusions, prev.totals.exclusions, ratio(T.exclusions - prev.totals.exclusions, prev.totals.exclusions)],
        [L('صافي المفوتر', 'Net billed'), T.net, prev.totals.net, ratio(T.net - prev.totals.net, prev.totals.net)],
        [L('المحصّل', 'Collected'), T.collected, prev.totals.collected, ratio(T.collected - prev.totals.collected, prev.totals.collected)],
        [L('غير المحصّل', 'Uncollected'), T.outstanding, prev.totals.outstanding, ratio(T.outstanding - prev.totals.outstanding, prev.totals.outstanding)]
      ], { note: L(`كل فترة تُقاس عند نهايتها (المدة المنقضية نفسها): ${prevScope.from} → ${prevScope.to}. نسبة التحصيل ${(T.collectedOverNet.value * 100).toFixed(1)}% مقابل ${prev.totals.collectedOverNet.calculable ? (prev.totals.collectedOverNet.value * 100).toFixed(1) + '%' : 'غير متاحة'}.`, `Each period is measured at its own end (equal elapsed time): ${prevScope.from} → ${prevScope.to}. Collection rate ${(T.collectedOverNet.value * 100).toFixed(1)}% vs ${prev.totals.collectedOverNet.calculable ? (prev.totals.collectedOverNet.value * 100).toFixed(1) + '%' : 'not available'}.`) })] : (compare !== 'none' ? [{ type: 'callout', tone: 'warn', text: L('لا توجد مقارنة مكافئة: فترة المقارنة خارج نطاق البيانات أو بلا فواتير.', 'No equivalent comparison: the comparison period is outside the data or empty.') }] : [])),
      { type: 'insights', title: L('أبرز النتائج والرؤى (قواعد حسابية، ليست نموذجاً لغوياً)', 'Key findings and insights (rule-based, not a language model)'), items: insightsRes.insights.slice(0, spec.depth === 'detailed' ? 12 : 4) },
      ...(!insightsRes.forecast.available ? [{ type: 'callout', tone: 'info', text: L(`التنبؤ غير معروض: ${insightsRes.forecast.reason ? B(insightsRes.forecast.reason) : 'التاريخ داخل هذا النطاق لا يكفي لتقدير موثوق.'}`, `Forecast not shown: ${insightsRes.forecast.reason ? B(insightsRes.forecast.reason) : 'the history inside this scope is not long enough for a reliable estimate.'}`) }] : [])
    ];
  };
  sections.trends = () => {
    const months = snapshot.byMonth; const cashBy = new Map((cash?.months || []).map((m, i) => [m, cash.values[i]])); const priorBy = new Map((prev?.byMonth || []).map((m) => [m.month, m]));
    const today = snapshot.cutoff.slice(0, 7);
    const rows = months.map((m) => { const pm = priorBy.get(prevYear(m.month)); return [`${m.month}${m.month === today ? L(' (حتى اليوم)', ' (to date)') : ''}`, m.count, m.gross, m.exclusions, m.net, m.collected, m.outstanding, ratio(m.collected, m.net), pm ? ratio(pm.collected, pm.net) : null, cashBy.has(m.month) ? cashBy.get(m.month) : null]; });
    return [
      { type: 'callout', tone: 'info', text: L('أساسان لا يُخلطان: صافي المفوتر والمحصّل لكل شهر إصدار ويُقاسان في التاريخ المرجعي؛ أما «المقبوض خلال الشهر» فنقد بتاريخ الدفع ويشمل فواتير أشهر سابقة.', 'Two bases, never mixed: net billed and collected are per invoice-issue month measured at the reference date; “received during the month” is cash by payment date and includes earlier months’ invoices.') },
      { type: 'chart', kind: 'bar', title: L('صافي المفوتر والمحصّل والمقبوض بحسب الشهر', 'Net billed, collected and received by month'), labels: months.map((m) => m.month), series: [{ label: L('صافي مفوتر الشهر', 'Net billed (issued in the month)'), values: months.map((m) => m.net) }, { label: L('المحصّل على فواتير الشهر', 'Collected on those invoices'), values: months.map((m) => m.collected) }, { label: L('المقبوض خلال الشهر (تاريخ الدفع)', 'Received during the month (payment date)'), values: months.map((m) => cashBy.get(m.month) ?? null) }] },
      tbl('trend', L('الاتجاه الشهري', 'Monthly trend'), [H(L('شهر الإصدار', 'Issue month')), H(L('الفواتير', 'Invoices'), 'count'), H(L('إجمالي المفوتر', 'Gross billed'), 'money'), H(L('الاستبعادات', 'Exclusions'), 'money'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('نسبة التحصيل', 'Collection rate'), 'pct'), ...(comparable ? [H(L('نفس الشهر العام السابق', 'Same month last year'), 'pct')] : []), H(L('المقبوض في الشهر (تاريخ الدفع)', 'Received in the month (payment date)'), 'money')],
        rows.map((r) => (comparable ? r : [...r.slice(0, 8), r[9]])),
        { total: [L('الإجمالي', 'Total'), T.count, T.gross, T.exclusions, T.net, T.collected, T.outstanding, ratio(T.collected, T.net), ...(comparable ? [ratio(prev.totals.collected, prev.totals.net)] : []), snapshot.receivedInPeriod.total], note: L('تجمع الأشهر إلى الفترة. لا تُجمع التقارير التراكمية. عمود العام السابق بالمدة المنقضية نفسها.', 'Months add up to the period. Cumulative reports are never summed. The prior-year column uses the same elapsed time.') })
    ];
  };
  sections.amanah = () => {
    const am = snapshot.byAmanah.slice().sort((a, b) => b.net - a.net); const mu = snapshot.byMunicipality.slice().sort((a, b) => b.net - a.net);
    const row = (label, g, withPrev) => [label, g.count, g.gross, g.exclusions, g.net, g.collected, g.outstanding, ratio(g.collected, g.net), ratio(g.exclusions, g.gross), ...(withPrev ? [prevRate(g.key, 'byAmanah')] : [])];
    const heads = (first, withPrev) => [H(first), H(L('الفواتير', 'Invoices'), 'count'), H(L('إجمالي المفوتر', 'Gross billed'), 'money'), H(L('الاستبعادات', 'Exclusions'), 'money'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('نسبة التحصيل', 'Collection rate'), 'pct'), H(L('نسبة الاستبعاد', 'Exclusion rate'), 'pct'), ...(withPrev ? [H(L('نسبة العام السابق', 'Last year rate'), 'pct')] : [])];
    const totalRow = (withPrev) => [L('الإجمالي', 'Total'), T.count, T.gross, T.exclusions, T.net, T.collected, T.outstanding, ratio(T.collected, T.net), ratio(T.exclusions, T.gross), ...(withPrev ? [ratio(prev?.totals.collected, prev?.totals.net)] : [])];
    const srcs = [...new Set(snapshot.matrix.amanahSource.map((r) => r.source))];
    const cell = (a, s) => snapshot.matrix.amanahSource.find((r) => r.amanah === a && r.source === s);
    return [
      { type: 'chart', kind: 'bar', title: L('صافي المفوتر والمحصّل حسب الأمانة', 'Net billed and collected by Amanah'), labels: am.map((g) => B(g.label)), series: [{ label: L('صافي المفوتر', 'Net billed'), values: am.map((g) => g.net) }, { label: L('المحصّل', 'Collected'), values: am.map((g) => g.collected) }] },
      tbl('amanah', L('حسب الأمانة', 'By Amanah'), heads(L('الأمانة', 'Amanah'), comparable), am.map((g) => row(B(g.label), g, comparable)), { total: totalRow(comparable), note: L('«غير محدد الأمانة» فواتير لم يطابقها مكين وتُعرض مستقلة دون توزيع.', '“Amanah not determined” = invoices Makeen could not match; shown apart, never spread over the others.') }),
      tbl('muni', L('حسب البلدية', 'By municipality'), heads(L('البلدية', 'Municipality'), false), mu.map((g) => row(`${g.municipality ? (ar ? g.municipality.ar : g.municipality.en) : L('بلا بلدية', 'No municipality')} — ${B(g.amanahLabel)}`, g, false)), { total: totalRow(false), note: L('البلديات متاحة للفواتير المركزية ووحدة المبيعات السكنية؛ ما بلا بلدية يُعرض كما هو.', 'Municipalities exist for central invoices and the housing sales unit; invoices without one are listed as such.') }),
      tbl('fair', L('مقارنة عادلة: الأداء المعدّل بمزيج الإيرادات', 'Fair comparison: performance adjusted for revenue mix'), [H(L('الأمانة', 'Amanah')), H(L('الفواتير', 'Invoices'), 'count'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('معدل التحصيل', 'Collection rate'), 'pct'), H(L('المتوقع بحسب المزيج', 'Expected by mix'), 'pct'), H(L('الفرق (نقطة مئوية)', 'Index (pp)')), H(L('المتأخر من الصافي', 'Overdue share'), 'pct'), H(L('حصة من غير المحصّل', 'Share of uncollected'), 'pct')],
        fairComparison(snapshot).filter((r) => r.net > 0).sort((x, y) => (x.smallSample - y.smallSample) || ((y.index ?? -999) - (x.index ?? -999))).map((r) => [B(r.label) + (r.smallSample ? L(' (عينة صغيرة)', ' (small sample)') : ''), r.count, r.net, r.rate, r.expectedRate, r.index == null ? '—' : `${r.index >= 0 ? '+' : ''}${r.index.toFixed(1)}`, r.overdueShare, r.gapShare]),
        { note: L('المؤشر = معدل الأمانة − المعدل المتوقع إذا حقق كل مصدر من مصادرها معدله العام؛ يعزل أثر اختلاف المزيج وحجم الفواتير. الأمانات الأقل من 10 فواتير موسومة «عينة صغيرة» ولا تُرتَّب فوق غيرها.', 'Index = Amanah rate − the rate expected if each of its sources achieved that source’s overall rate; it removes the effect of different mixes and volumes. Amanahs with fewer than 10 invoices are flagged “small sample” and not ranked above others.') }),
      tbl('amanah_source_net', L('صافي المفوتر: الأمانة × المصدر', 'Net billed: Amanah × source'), [H(L('الأمانة', 'Amanah')), ...srcs.map((s) => H(ar ? sourceAr(s) : sourceEn(s), 'money')), H(L('الإجمالي', 'Total'), 'money')], am.map((g) => [B(g.label), ...srcs.map((s) => cell(g.key, s)?.net ?? null), g.net]), { total: [L('الإجمالي', 'Total'), ...srcs.map((s) => snapshot.matrix.amanahSource.filter((r) => r.source === s).reduce((t, r) => t + r.net, 0)), T.net] }),
      tbl('amanah_source_rate', L('نسبة التحصيل: الأمانة × المصدر', 'Collection rate: Amanah × source'), [H(L('الأمانة', 'Amanah')), ...srcs.map((s) => H(ar ? sourceAr(s) : sourceEn(s), 'pct')), H(L('الإجمالي', 'Total'), 'pct')], am.map((g) => [B(g.label), ...srcs.map((s) => { const c = cell(g.key, s); return c ? ratio(c.collected, c.net) : null; }), ratio(g.collected, g.net)]), { total: [L('الإجمالي', 'Total'), ...srcs.map((s) => { const rs = snapshot.matrix.amanahSource.filter((r) => r.source === s); return ratio(rs.reduce((t, r) => t + r.collected, 0), rs.reduce((t, r) => t + r.net, 0)); }), ratio(T.collected, T.net)] })
    ];
  };
  sections.sources = () => {
    const src = snapshot.bySource.slice().sort((a, b) => b.net - a.net);
    return [
      { type: 'chart', kind: 'bar', title: L('صافي المفوتر والمحصّل حسب مصدر الإيراد', 'Net billed and collected by revenue source'), labels: src.map((g) => (ar ? sourceAr(g.key) : sourceEn(g.key))), series: [{ label: L('صافي المفوتر', 'Net billed'), values: src.map((g) => g.net) }, { label: L('المحصّل', 'Collected'), values: src.map((g) => g.collected) }] },
      tbl('sources', L('حسب مصدر الإيراد', 'By revenue source'), [H(L('مصدر الإيراد', 'Revenue source')), H(L('الفواتير', 'Invoices'), 'count'), H(L('إجمالي المفوتر', 'Gross billed'), 'money'), H(L('الاستبعادات', 'Exclusions'), 'money'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('نسبة التحصيل', 'Collection rate'), 'pct'), ...(comparable ? [H(L('نسبة العام السابق', 'Last year rate'), 'pct')] : []), H(L('نسبة الاستبعاد', 'Exclusion rate'), 'pct')],
        src.map((g) => [ar ? sourceAr(g.key) : sourceEn(g.key), g.count, g.gross, g.exclusions, g.net, g.collected, g.outstanding, ratio(g.collected, g.net), ...(comparable ? [prevRate(g.key, 'bySource')] : []), ratio(g.exclusions, g.gross)]),
        { total: [L('الإجمالي', 'Total'), T.count, T.gross, T.exclusions, T.net, T.collected, T.outstanding, ratio(T.collected, T.net), ...(comparable ? [ratio(prev.totals.collected, prev.totals.net)] : []), ratio(T.exclusions, T.gross)] }),
      { type: 'callout', tone: 'info', text: L('غير متاح في هذا الديمو: التحصيل الفعلي من «تحصيل» (غير مربوط)، مستهدفات التحصيل المعتمدة لكل أمانة، اعتمادات الأبواب 1–3 لكل أمانة، سبب عدم السداد، وتاريخ سداد الدافع. لا تُقدَّر.', 'Not available in this demo: actual Tahseel collections (not connected), approved per-Amanah collection targets, per-Amanah budgets of chapters 1–3, the reason a payer did not pay, and payer payment history. They are not estimated.') }
    ];
  };
  sections.aging = () => {
    const S = snapshot.stock; const sum = S.aging.reduce((t, a) => t + a.amount, 0);
    return [
      { type: 'callout', tone: 'info', text: L(`رصيد قائم وليس غير محصّل الفترة: كل ما صدر حتى ${snapshot.cutoff} ولم يُسدَّد بغض النظر عن فترة الإصدار (ضمن مرشحات الأمانة والمصدر والبلدية).`, `A standing balance, not the period’s uncollected: everything issued up to ${snapshot.cutoff} and still owing, whatever the issue period (within the Amanah, source and municipality filters).`) },
      { type: 'chart', kind: 'bar', title: L('الرصيد غير المحصّل حسب العمر بعد الاستحقاق', 'Uncollected balance by age past due'), labels: S.aging.map((a) => B(a.label)), series: [{ label: L('غير المحصّل', 'Uncollected'), values: S.aging.map((a) => a.amount) }] },
      tbl('aging', L('التقادم', 'Aging'), [H(L('العمر بعد الاستحقاق', 'Age past due')), H(L('الفواتير', 'Invoices'), 'count'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('الحصة', 'Share'), 'pct')], S.aging.map((a) => [B(a.label), a.count, a.amount, ratio(a.amount, sum)]), { total: [L('صافي غير المحصّل القائم', 'Standing net uncollected'), S.invoiceCount, S.netUncollected, 1] }),
      tbl('aging_amanah', L('أكبر الأرصدة حسب الأمانة', 'Largest balances by Amanah'), [H(L('الأمانة', 'Amanah')), H(L('غير المحصّل القائم', 'Standing uncollected'), 'money'), H(L('الحصة', 'Share'), 'pct')], S.byAmanah.slice(0, 8).map((g) => [B(g.label), g.outstanding, ratio(g.outstanding, S.netUncollected)]))
    ];
  };
  sections.exclusions = () => {
    const ids = ['cancelled', ...EXCLUSION_RULES.map((r) => r.id)]; const R = Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, [r.label.ar, r.label.en]]));
    const cols = ids.filter((k) => snapshot.matrix.amanahReasons.some((r) => r.reason === k));
    const by = new Map(); for (const r of snapshot.matrix.amanahReasons) { const a = by.get(r.amanah) || { total: 0, cells: {} }; a.cells[r.reason] = r.amount; a.total += r.amount; by.set(r.amanah, a); }
    const rows = [...by.entries()].sort((a, b) => b[1].total - a[1].total).map(([k, v]) => [labelOfAmanah(k), ...cols.map((c) => v.cells[c] ?? null), v.total]);
    return [
      { type: 'relations', totals: ctxTotals },
      tbl('exclusions', L('الفواتير المستثناة حسب الأمانة والسبب', 'Excluded invoices by Amanah and reason'), [H(L('الأمانة', 'Amanah')), ...cols.map((c) => H((RULE[c] || R[c] || [c, c])[ar ? 0 : 1], 'money')), H(L('إجمالي الاستبعادات', 'Total exclusions'), 'money')], rows,
        { total: [L('الإجمالي', 'Total'), ...cols.map((c) => snapshot.matrix.amanahReasons.filter((r) => r.reason === c).reduce((t, r) => t + r.amount, 0)), T.exclusions], note: L('تظهر كل فاتورة مرة واحدة تحت سببها الرئيسي (الملغاة لها الأسبقية) فيساوي الإجمالي الاستبعادات ولا يتكرر الخصم عند تعدد الأسباب.', 'Each invoice appears once under its primary reason (cancelled takes precedence), so the total equals the exclusions and several reasons never deduct twice.') }),
      { type: 'callout', tone: 'info', text: L(`الاستبعاد ليس حكماً بعدم القابلية للتحصيل. قواعد معتمدة: ${snapshot.exclusionsApproval.approvedAmount > 0 ? fmtMoney(snapshot.exclusionsApproval.approvedAmount, { lang }) : '0'}؛ قواعد غير معتمدة: ${fmtMoney(snapshot.exclusionsApproval.unapprovedAmount, { lang })}.`, `Exclusion does not mean uncollectible. Approved rules: ${snapshot.exclusionsApproval.approvedAmount > 0 ? fmtMoney(snapshot.exclusionsApproval.approvedAmount, { lang }) : '0'}; unapproved rules: ${fmtMoney(snapshot.exclusionsApproval.unapprovedAmount, { lang })}.`) }
    ];
  };
  sections.gaps = () => {
    const target = targets.collectionRate.value;
    const rows = snapshot.matrix.amanahSource.map((r) => ({ ...r, gap: Math.max(0, r.net * target - r.collected) })).filter((r) => r.gap > 0).sort((a, b) => b.gap - a.gap).slice(0, 12);
    return [
      { type: 'callout', tone: 'warn', text: L(`تقدير مقابل مستهدف تجريبي: نسبة ${(target * 100).toFixed(0)}% مُدخل غير معتمد. الفجوة = صافي المفوتر × المستهدف − المحصّل، وليست مبلغاً مؤكد التحصيل.`, `An estimate against a demo target: ${(target * 100).toFixed(0)}% is an unapproved input. Gap = net billed × target − collected; it is not a known-collectible amount.`) },
      tbl('gaps', L('أكبر فجوات التحصيل', 'Largest collection gaps'), [H(L('الأمانة', 'Amanah')), H(L('المصدر', 'Source')), H(L('الفواتير', 'Invoices'), 'count'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('نسبة التحصيل', 'Collection rate'), 'pct'), H(L('غير المحصّل', 'Uncollected'), 'money'), H(L('الفجوة للمستهدف', 'Gap to target'), 'money')],
        rows.map((r) => [labelOfAmanah(r.amanah), ar ? sourceAr(r.source) : sourceEn(r.source), r.count, r.net, ratio(r.collected, r.net), r.outstanding, r.gap]), { note: L('أولويات الفواتير الفردية (المبلغ والتقادم والقابلية للمتابعة) في قائمة التحصيل.', 'Invoice-level priorities (amount, aging, actionability) are in the collection worklist.') })
    ];
  };
  sections.status = () => [
    tbl('status', L('الفواتير حسب الحالة', 'Invoices by status'), [H(L('الحالة', 'Status')), H(L('الفواتير', 'Invoices'), 'count'), H(L('حصة العدد', 'Share of invoices'), 'pct'), H(L('إجمالي المفوتر', 'Gross billed'), 'money'), H(L('الاستبعادات', 'Exclusions'), 'money'), H(L('صافي المفوتر', 'Net billed'), 'money'), H(L('المحصّل', 'Collected'), 'money'), H(L('غير المحصّل', 'Uncollected'), 'money')],
      snapshot.byStatus.slice().sort((a, b) => b.count - a.count).map((g) => [B(STATUS[g.key]) || g.key, g.count, ratio(g.count, T.count), g.gross, g.exclusions, g.net, g.collected, g.outstanding]),
      { total: [L('الإجمالي', 'Total'), T.count, 1, T.gross, T.exclusions, T.net, T.collected, T.outstanding], note: L('لكل فاتورة حالة واحدة (الإلغاء والاستبعاد لهما الأسبقية). لا تُحتسب مدفوعات الفواتير الملغاة/المستبعدة محصّلة. الأعداد أعداد فواتير ولا تُحوَّل لوحدة المبالغ.', 'Each invoice has exactly one status (cancelled and excluded take precedence). Payments on cancelled/excluded invoices are not collected. Counts are invoice counts, never converted to the money unit.') })
  ];
  sections.budget = () => {
    if (!financeOk || !finance) return [{ type: 'callout', tone: 'info', text: L('البيانات غير متاحة لهذا النطاق: الميزانية والإنفاق متوفران (بصورة تجريبية) على المستوى الوطني لكل المصادر فقط. أزل مرشحات الأمانة والبلدية والمصدر والحالة.', 'Data not available for this scope: budget and expenditure exist (synthetic) at national level for all sources only. Clear the Amanah, municipality, source and status filters.') }];
    const ex = budgetExecution(finance); const cov = operatingCoverage(finance, fyReceiptsYtd);
    return [
      { type: 'callout', tone: 'warn', text: `${B(FINANCE_STATUS)} — ${L('تُعرض لإظهار الوظيفة فقط؛ الأرقام الفعلية تتطلب ربط نظام المالية الحكومي.', 'shown only to demonstrate the function; actual figures need the government financial system integration.')}` },
      tbl('budget', L('تنفيذ الميزانية حسب الباب (من بداية السنة حتى اليوم)', 'Budget execution by chapter (year to date)'), [H(L('الباب', 'Chapter')), H(L('الميزانية السنوية المعتمدة', 'Approved annual budget'), 'money'), H(L('الميزانية المتناسبة حتى اليوم', 'Budget prorated to date'), 'money'), H(L('الالتزامات', 'Commitments'), 'money'), H(L('المستحق (الاستحقاق)', 'Accrued'), 'money'), H(L('المصروف نقداً', 'Paid (cash)'), 'money'), H(L('نسبة الصرف من الميزانية المتناسبة', 'Payments ÷ prorated budget'), 'pct'), H(L('المتبقي بعد الالتزامات', 'Left after commitments'), 'money')],
        ex.rows.map((r) => [B(r.label), r.annual, r.budgetToDate, r.commitments, r.accrued, r.paid, r.execution, r.remaining]),
        { total: [L('الإجمالي', 'Total'), ex.total.annual, ex.total.budgetToDate, ex.total.commitments, ex.total.accrued, ex.total.paid, ex.total.execution, ex.rows.reduce((t, r) => t + r.remaining, 0)], note: L('الميزانية والالتزام والاستحقاق والصرف أربعة مفاهيم مختلفة لا تُجمع ولا تُقارن بغير أساسها: الالتزام ≥ الاستحقاق ≥ الصرف.', 'Budget, commitment, accrual and payment are four different things; they are not added together and are compared only on their stated basis: commitment ≥ accrual ≥ payment.') }),
      { type: 'chart', kind: 'bar', title: L('الصرف الشهري مقابل الميزانية الشهرية (الأبواب 1–4)', 'Monthly payments vs monthly budget (chapters 1–4)'), labels: finance.chapters[0].months.map((m) => m.month), series: [{ label: L('الميزانية الشهرية', 'Monthly budget'), values: finance.chapters[0].months.map((_, i) => finance.chapters.reduce((t, c) => t + c.months[i].planned, 0)) }, { label: L('المصروف نقداً', 'Paid (cash)'), values: finance.chapters[0].months.map((_, i) => finance.chapters.reduce((t, c) => t + c.months[i].paid, 0)) }] },
      tbl('coverage', L('تغطية الإنفاق التشغيلي من الإيرادات المحصّلة', 'Operating-expenditure coverage by collected revenue'), [H(L('البند', 'Item')), H(L('القيمة', 'Value'), 'money'), H(L('النسبة', 'Ratio'), 'pct')],
        cov.ratio == null ? [[L('المقبوضات (تاريخ الدفع) منذ بداية السنة', 'Receipts (payment date) year to date'), cov.receiptsYtd, null], [L('صرف الأبواب 1–3 للفترة نفسها', 'Payments of chapters 1–3, same period'), cov.paid, null]] : [[L('المقبوضات (تاريخ الدفع) منذ بداية السنة', 'Receipts (payment date) year to date'), cov.receiptsYtd, null], [L('صرف الأبواب 1–3 للفترة نفسها', 'Payments of chapters 1–3, same period'), cov.paid, null], [L('نسبة التغطية', 'Coverage ratio'), null, cov.ratio]],
        { note: B(cov.basis) + L(' — لا تُحسب إلا للسنة المالية حتى اليوم لأن الأساس والفترة والنطاق يجب أن تتطابق.', ' — only calculated for the fiscal year to date because basis, period and scope must match.') })
    ];
  };
  sections.quality = () => {
    const eq = snapshot.equation; const q = snapshot.quality; const un = snapshot.byAmanah.find((g) => g.key === 'Unassigned');
    const checks = [
      [L('إجمالي المفوتر = الاستبعادات + صافي المفوتر', 'Gross billed = exclusions + net billed'), eq.total.grossEqExclusionsPlusNet],
      [L('صافي المفوتر = المحصّل + غير المحصّل', 'Net billed = collected + uncollected'), eq.total.netEqCollectedPlusUncollected],
      [L('الإجمالي ≥ الصافي ≥ المحصّل ≥ 0', 'Gross ≥ net ≥ collected ≥ 0'), eq.total.ordered && eq.total.nonNegative],
      [L('كل أمانة ومصدر ونوع نطاق يحقق العلاقات نفسها', 'Every Amanah, source and scope type satisfies the same identities'), eq.amanahCheck && eq.sourceCheck && eq.scopeCheck],
      [L('الأمانات والبلديات والمصادر والأشهر والحالات تجمع كل منها إلى الإجمالي', 'Amanahs, municipalities, sources, months and statuses each add up to the total'), eq.amanahSumsToTotal && eq.municipalitiesSumToTotal && eq.sourceSumsToTotal && eq.monthsSumToTotal && eq.statusSumsToTotal],
      [L('جدولا أمانة × مصدر وأمانة × سبب يجمعان إلى الإجماليات', 'Amanah × source and Amanah × reason tables add up'), eq.matrixSumsToTotal],
      ...(bridge ? [[L('جسر تقرير غير المسدد يصل إلى الرصيد القائم', 'Unpaid-report bridge lands on the standing balance'), bridge.check === 0]] : [])
    ];
    return [
      tbl('checks', L('فحوص المطابقة', 'Reconciliation checks'), [H(L('الفحص', 'Check')), H(L('النتيجة', 'Result'))], checks.map(([t, ok]) => [t, ok ? L('✓ متحقق', '✓ passed') : L('✗ غير متحقق', '✗ failed')])),
      ...(bridge ? [tbl('bridge', L('جسر المطابقة: من تقرير غير المسدد إلى صافي غير المحصّل القائم', 'Reconciliation bridge: unpaid report → standing net uncollected'), [H(L('الخطوة', 'Step')), H(L('الفواتير', 'Invoices'), 'count'), H(L('المبلغ', 'Amount'), 'money')], bridge.steps.map((x) => [BRIDGE_LABELS[x.key] ? B(BRIDGE_LABELS[x.key]) : x.key, x.count ?? null, x.amount]), { total: [L('صافي غير المحصّل القائم', 'Standing net uncollected'), null, bridge.net], note: L(`فرق الجسر: ${bridge.check}. الرصيد القائم رصيد في ${bridge.detailsDate} لكل ما صدر حتى ذلك التاريخ.`, `Bridge difference: ${bridge.check}. A balance at ${bridge.detailsDate} for everything issued up to then.`) })] : []),
      tbl('issues', L('مشاكل اكتمال البيانات', 'Completeness issues'), [H(L('المشكلة', 'Issue')), H(L('القيمة', 'Value'), 'text')], [
        [L('صافي مفوتر بلا أمانة (لم يُطابق في مكين)', 'Net billed without an Amanah (unmatched in Makeen)'), fmtMoney(un?.net || 0, { lang })], [L('استبعادات بانتظار المراجعة', 'Exclusions awaiting review'), fmtInt(q.pendingExclusionCount)], [L('فواتير مبلغها يتعارض مع البنود', 'Invoices whose amount conflicts with the item lines'), fmtInt(q.amountConflictCount)], [L('سجلات بحقول إلزامية ناقصة', 'Records with missing mandatory fields'), fmtInt(q.missingFieldCount)], [L('فواتير استثمار بلا عقد مرتبط', 'Investment invoices with no linked contract'), fmtInt(q.contractIssueCount)]]),
      { type: 'callout', tone: 'info', text: L('تعريفات تحتاج اعتماداً: قواعد الاستبعاد (INC-1 وEXE-1 وEFA-1 وNOC-1 وDEC-1 وOBJ-1)؛ هل تُستبعد «الاعتراضات»؛ أسبقية الإلغاء؛ أيام السماح؛ مستهدف نسبة التحصيل المعتمد. الأرقام القائمة على قواعد غير معتمدة موسومة.', 'Definitions to confirm: exclusion rules (INC-1, EXE-1, EFA-1, NOC-1, DEC-1, OBJ-1); whether “objections” are excluded; cancelled-vs-excluded precedence; grace days; the approved collection-rate target. Figures resting on unapproved rules are labelled.') }
    ];
  };
  sections.bases = () => {
    const r = snapshot.receivedInPeriod;
    return [tbl('bases', L('أساس القياس', 'Measurement bases'), [H(L('المقياس', 'Measure')), H(L('الأساس', 'Basis')), H(L('المبلغ', 'Amount'), 'money')], [
      [L('المحصّل على فواتير الفترة', 'Collected on the period’s invoices'), L('تاريخ إصدار الفاتورة ضمن الفترة؛ المدفوعات حتى التاريخ المرجعي', 'Invoice issue date in the period; payments up to the reference date'), T.collected],
      [L('المقبوض خلال الفترة', 'Received during the period'), L('تاريخ الدفع ضمن الفترة لأي فاتورة', 'Payment date in the period, any invoice'), r.total],
      [L('— منه على فواتير الفترة نفسها', '— of which on the period’s own invoices'), '', r.fromPeriodInvoices], [L('— منه على فواتير فترات سابقة', '— of which on earlier invoices'), '', r.fromPriorInvoices],
      [L('مقبوضات على فواتير مستبعدة/ملغاة (لا تُحتسب محصّلة)', 'Receipts on excluded / cancelled invoices (not counted as collected)'), L('تاريخ الدفع ضمن الفترة', 'Payment date in the period'), r.onExcluded]
    ], { note: L('لا يُقسم أي رقم على مقام الآخر. لا يُحتسب إلغاء أو استبعاد إلا إذا سرى في التاريخ المرجعي أو قبله.', 'Neither figure is divided by the other’s denominator. A cancellation or exclusion counts only if effective on or before the reference date.') })];
  };
  sections.channels = () => {
    const rows = Object.entries(snapshot.receivedInPeriod.byChannel || {}).sort((a, b) => b[1] - a[1]); const tot = rows.reduce((t, [, v]) => t + v, 0);
    return [tbl('channels', L('قنوات الدفع', 'Payment channels'), [H(L('القناة', 'Channel')), H(L('المقبوض في الفترة (تاريخ الدفع)', 'Received in period (payment date)'), 'money'), H(L('الحصة', 'Share'), 'pct')], rows.map(([k, v]) => [(CHANNEL[k] || [k, k])[ar ? 0 : 1], v, ratio(v, tot)]), { total: [L('الإجمالي (دون مدفوعات الفواتير المستبعدة)', 'Total (excluding payments on excluded invoices)'), tot, 1] })];
  };

  const keys = SECTION_ORDER.filter((k) => spec.sections.includes(k));
  const out2 = keys.map((k) => ({ key: k, title: SECTION_META[k][ar ? 'ar' : 'en'], purpose: SECTION_META[k].purpose[ar ? 'ar' : 'en'], blocks: sections[k]() }));

  // findings that complete the report (from the older smart report: records-based findings, risks, forecast limits, recommendations, assumptions)
  const tail = [];
  if (spec.depth === 'detailed' || keys.includes('executive')) { // recommendations belong to the headline report; single-topic reports stay focused
    tail.push({ key: 'recommendations', title: L('التوصيات المدعومة بالأدلة (مقترحات)', 'Evidence-supported recommendations (proposals)'), purpose: '', blocks: [{ type: 'list', items: legacy.recommendations.slice(0, spec.depth === 'detailed' ? 8 : 3).map((r) => `[${r.priority}] ${r.text}`) }] });
  }
  if (spec.depth === 'detailed') {
    tail.push({ key: 'findings', title: L('نتائج من السجلات (محسوبة) وتعارضات', 'Findings from the records (calculated) and conflicts'), purpose: '', blocks: [{ type: 'list', items: legacy.discoveries }, { type: 'list', items: legacy.risks.map((r) => `[${r.priority}] ${r.title} — ${r.rationale}`) }] });
    tail.push({ key: 'forecast', title: L('التنبؤ وحدوده', 'Forecast and its limits'), purpose: '', blocks: [{ type: 'list', items: legacy.predictions.map((p) => `${p.prediction} (${legacy.labels.confidence}: ${p.confidence}; ${legacy.labels.timeframe}: ${p.timeframe})`) }] });
  }
  tail.push({ key: 'assumptions', title: L('البيانات والافتراضات', 'Data and assumptions'), purpose: '', blocks: [{ type: 'list', items: [
    L('بيانات تجريبية اصطناعية مستوحاة من التقارير الشهرية وليست بيانات فعلية للوزارة؛ عدد الفواتير في الديمو لا يمثل الحجم التشغيلي.', 'Synthetic demo data inspired by the monthly reports — not the Ministry’s actual data; the invoice count of the demo does not represent operational volume.'),
    L('كل مبلغ بوحدة واحدة مناسبة، وتُعرض كل جدول ورسم بوحدة واحدة؛ والمبلغ الدقيق بالريال في التلميحات والتصدير.', 'Every amount carries one appropriate unit and each table and chart one shared unit; exact SAR amounts are in tooltips and exports.'),
    ...legacy.assumptions.slice(0, 5)
  ] }] });

  const title = spec.title || L('تقرير الإيرادات والتحصيل', 'Revenue and collection report');
  return {
    id: `rpt-${generatedAt.getTime()}`, title, subtitle: chips.find((c) => c.k === 'period').value,
    generatedAt: generatedAt.toISOString(), cutoff: snapshot.cutoff, lang, depth: spec.depth, compare, synthetic: true, context: chips,
    totals: ctxTotals, empty: !(T.count > 0), equationOk: !!snapshot.equation.ok, headline: headline(), sections: [...out2, ...tail],
    summaryText: insightsRes.summary.text[ar ? 'ar' : 'en']
  };
}

export { scaled, unitLabel, unitOfValues };
