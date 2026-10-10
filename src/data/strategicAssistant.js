// ============================================================================
// The dashboard's embedded assistant — a RULE-BASED simulation of an AI assistant (no language model is connected, and the UI says so).
// It answers from the SAME snapshot and filters as the page, shows the supporting figures, keeps the previous intent for follow-ups and
// never states a cause the records do not contain.
// ============================================================================
import { parsePeriod, parseAmanah, parseSource } from './assistantRouter';
import { fairComparison, scenarioBase, runScenario } from './strategicCalc';
import { buildInsights, sourceAr, sourceEn } from './insightsEngine';
import { isOverdue } from './actionRegister';
import { addDaysIso } from './clock';
import { fmtMoney, fmtInt } from '../utils/money';

const norm = (t) => String(t || '').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[؟?!.,،؛:]/g, ' ').replace(/\s+/g, ' ').trim();
const NUM_WORDS = [['خمسه عشر', 15], ['عشرين', 20], ['ثلاثين', 30], ['واحد', 1], ['نقطه', 1], ['اثنين', 2], ['اثنان', 2], ['ثلاث', 3], ['اربع', 4], ['خمس', 5], ['ست', 6], ['سبع', 7], ['ثماني', 8], ['تسع', 9], ['عشر', 10]];
const AR_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 };
export function parseNumber(text) {
  const t = String(text).replace(/[٠-٩]/g, (d) => String(AR_DIGITS[d]));
  const m = t.match(/(\d+(?:[.,]\d+)?)/); if (m) return Number(m[1].replace(',', '.'));
  const n = norm(text);
  for (const [w, v] of NUM_WORDS) if (new RegExp(`(^| )${w}( |$|ه)`).test(n) && w !== 'نقطه') return v;
  return null;
}

export const SUGGESTED_PROMPTS = [
  { ar: 'أين أكبر فجوة في التحصيل هذا الشهر؟', en: 'Where is the largest collection gap this month?' },
  { ar: 'قارن أداء الأمانات مع مراعاة اختلاف حجم الإيرادات', en: 'Compare Amanah performance, accounting for different revenue volumes' },
  { ar: 'ماذا يحدث إذا ارتفع معدل التحصيل خمس نقاط مئوية؟', en: 'What happens if the collection rate rises five percentage points?' },
  { ar: 'ما الإجراءات ذات الأولوية خلال الثلاثين يومًا القادمة؟', en: 'Which actions are priorities in the next thirty days?' },
  { ar: 'جهّز ملخصًا تنفيذيًا للاجتماع', en: 'Prepare an executive summary for the meeting' }
];

export const PLANNING_PROMPTS = [
  { ar: 'أين أكبر فجوة في التحصيل هذا الشهر؟', en: 'Where is the largest collection gap this month?' },
  { ar: 'هل نحقق المستهدف وما الوتيرة المطلوبة؟', en: 'Are we meeting the target and what pace is required?' },
  { ar: 'ماذا يحدث إذا ارتفع معدل التحصيل خمس نقاط مئوية؟', en: 'What happens if the collection rate rises five percentage points?' },
  { ar: 'ما الإجراءات ذات الأولوية خلال الثلاثين يومًا القادمة؟', en: 'Which actions are priorities in the next thirty days?' },
  { ar: 'جهّز ملخصًا تنفيذيًا للاجتماع', en: 'Prepare an executive summary for the meeting' }
];

function classify(s) {
  if (/(ملخص تنفيذي|ملخص للاجتماع|للاجتماع|ملخصا تنفيذيا)/.test(s)) return 'summary';
  if (/(الاولويه|الاولويات|الاجراءات|ما العمل|ماذا نفعل|خلال (ال)?(30|ثلاثين) يوم)/.test(s)) return 'priorities';
  if (/(ماذا يحدث|ماذا لو|لو |اذا ارتفع|اذا انخفض|اذا زاد|ارتفع معدل|انخفض معدل|زياده معدل|نقاط مئويه|نقطه مئويه|سيناريو)/.test(s)) return 'scenario';
  if (/(قارن|مقارنه|ترتيب|الاسوا|الافضل).*(امانه|الامانات|امانات)|(امانه|الامانات).*(قارن|مقارنه|ترتيب)/.test(s)) return 'compare';
  if (/(فجوه|الفجوات|اكبر.*(عدم تحصيل|تاخر|متبقي)|اين.*(تحصيل|متاخر))/.test(s)) return 'gap';
  if (/(المستهدف|هدف|نحقق|تحقيق)/.test(s)) return 'target';
  if (/(متاخر|التقادم|اعمار)/.test(s)) return 'aging';
  if (/(نسبه التحصيل|معدل التحصيل|كم المحصل|المحصل|الوضع)/.test(s)) return 'position';
  return null;
}

export async function answer(text, ctx) {
  const { lang, today, fetchSnap, fetchPrev, getAchievement, targets, register, proposals, last, applyFilters, labelOfAmanah } = ctx;
  const ar = lang === 'ar'; const L = (a, e) => (ar ? a : e); const M = (v, u) => fmtMoney(v, { lang, unit: u });
  const s = norm(text);
  // ---- filter overrides found in the sentence (the page applies them to the SHARED filters so everything stays in step)
  const over = {}; const applied = [];
  const per = parsePeriod(text, today); if (per) { over.from = per.from; over.to = per.to; applied.push(L(`الفترة: ${per.from} ← ${per.to}`, `Period: ${per.from} → ${per.to}`)); }
  const am = parseAmanah(text); if (am.length === 1 && /(امانه|بلديه|فقط|عن |ماذا عن)/.test(s)) { over.amanah = am[0]; applied.push(L(`الأمانة: ${labelOfAmanah(am[0])}`, `Amanah: ${labelOfAmanah(am[0])}`)); }
  const src = parseSource(text); if (src && !/(حسب|توزيع).{0,10}مصدر/.test(s)) { over.source = src; applied.push(L(`المصدر: ${ar ? sourceAr(src) : sourceEn(src)}`, `Source: ${sourceEn(src)}`)); }
  let intent = classify(s);
  const followUp = !intent && last && applied.length > 0; if (followUp) intent = last.intent;
  if (!intent) return { intent: 'unknown', simulated: true, title: L('لم أفهم الطلب', 'I did not understand the request'), text: L('أجيب عن أسئلة محددة بقواعد حسابية (وليس بنموذج لغوي): الفجوات، مقارنة الأمانات، السيناريوهات، الأولويات، الملخص التنفيذي، المستهدف، المتأخرات. جرّب أحد الاقتراحات.', 'I answer a defined set of questions with rules (not a language model): gaps, Amanah comparison, scenarios, priorities, executive summary, target, overdue. Try a suggestion.'), facts: [], applied: [] };
  // the planning assistant stays inside planning: descriptive questions belong to the dashboard / smart reports
  if (ctx.mode === 'planning' && ['compare', 'aging', 'position'].includes(intent)) {
    return { intent: 'redirect', simulated: true, applied: [], facts: [], title: L('هذا السؤال يخص لوحة المعلومات والتقارير', 'This question belongs to Dashboards and reports'), text: L('مساعد التخطيط يجيب عن الفجوات والمستهدفات والسيناريوهات والأولويات والملخص. للمقارنات والتقادم والأداء الوصفي استخدم «التقارير الذكية» — يمكنني فتحها بسؤالك.', 'The planning assistant answers gaps, targets, scenarios, priorities and the summary. For comparisons, aging and descriptive performance use “Smart reports” — I can open it with your question.'), drill: { to: `/insights?view=smart&q=${encodeURIComponent(text)}`, label: L('افتح التقارير الذكية بهذا السؤال', 'Open Smart reports with this question') } };
  }
  const scope = { ...ctx.scope, ...over };
  if (Object.keys(over).length) applyFilters(over);
  const snap = await fetchSnap(scope); const T = snap.totals;
  const scopeText = `${scope.from} → ${scope.to}`;
  const base = { intent, scope, simulated: true, applied, facts: [], table: null, actions: [], drill: null };
  const noData = (extra = {}) => ({ ...base, title: L('لا بيانات', 'No data'), text: L('لا توجد فواتير في هذا الاختيار؛ غيّر المرشحات.', 'There are no invoices in this selection; change the filters.'), ...extra });
  if (!(T.count > 0)) return noData();
  const rateTxt = T.collectedOverNet.calculable ? `${(T.collectedOverNet.value * 100).toFixed(1)}%` : L('غير متاحة', 'not available');
  const demoNote = L('بيانات تجريبية اصطناعية.', 'Synthetic demo data.');

  if (intent === 'gap') {
    const cells = (snap.matrix?.amanahSource || []).map((r) => ({ ...r, share: T.outstanding > 0 ? r.outstanding / T.outstanding : null })).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);
    const top = cells[0]; const topAm = snap.byAmanah.slice().sort((a, b) => b.outstanding - a.outstanding)[0];
    const lab = (k) => (ar ? snap.byAmanah.find((g) => g.key === k)?.label?.ar : snap.byAmanah.find((g) => g.key === k)?.label?.en) || k;
    return { ...base, title: L('أكبر فجوة في التحصيل', 'Largest collection gap'),
      text: L(`ضمن ${scopeText}: أكبر غير محصّل في الخلية «${lab(top.amanah)} — ${sourceAr(top.source)}» بمبلغ ${M(top.outstanding)} من صافي مفوتر ${M(top.net)} (نسبة تحصيل ${(top.collected / top.net * 100).toFixed(1)}%)، أي ${(top.share * 100).toFixed(0)}% من غير المحصّل الكلي ${M(T.outstanding)}. أكبر أمانة بغير المحصّل: ${lab(topAm.key)} (${M(topAm.outstanding)}). لا تسجل البيانات سبب عدم السداد، فلا يُنسب سبب. ${demoNote}`, `Within ${scopeText}: the largest uncollected balance is the cell “${lab(top.amanah)} — ${sourceEn(top.source)}”: ${M(top.outstanding)} of ${M(top.net)} net billed (rate ${(top.collected / top.net * 100).toFixed(1)}%), ${(top.share * 100).toFixed(0)}% of total uncollected ${M(T.outstanding)}. Largest Amanah: ${lab(topAm.key)} (${M(topAm.outstanding)}). The data does not record why payers have not paid, so no cause is stated. ${demoNote}`),
      facts: [{ k: L('غير المحصّل الكلي', 'Total uncollected'), v: M(T.outstanding) }, { k: L('نسبة التحصيل', 'Collection rate'), v: rateTxt }, { k: L('الخلية الأكبر', 'Largest cell'), v: M(top.outstanding) }],
      table: { headers: [L('الأمانة', 'Amanah'), L('المصدر', 'Source'), L('صافي المفوتر', 'Net billed'), L('نسبة التحصيل', 'Rate'), L('غير المحصّل', 'Uncollected'), L('حصة من غير المحصّل', 'Share')], rows: cells.map((c) => [lab(c.amanah), ar ? sourceAr(c.source) : sourceEn(c.source), M(c.net), `${(c.collected / c.net * 100).toFixed(1)}%`, M(c.outstanding), `${(c.share * 100).toFixed(0)}%`]) },
      drill: { to: `/invoices?amanah=${encodeURIComponent(top.amanah)}&src=${top.source}`, label: L('فواتير الخلية الأكبر', 'Invoices of the largest cell') } };
  }
  if (intent === 'compare') {
    const all = fairComparison(snap).filter((r) => r.net >= T.net * 0.01 && r.index != null);
    const reliable = all.filter((r) => !r.smallSample); const smallOnly = reliable.length < 2; // a short period leaves few invoices per Amanah: say so instead of hiding the comparison
    const fair = (smallOnly ? all : reliable).sort((a, b) => b.index - a.index);
    if (fair.length < 2) return noData({ text: L('عدد الأمانات الكافية للمقارنة قليل في هذا الاختيار.', 'Too few Amanahs to compare in this selection.') });
    const nm = (r) => (ar ? r.label.ar : r.label.en); const hi = fair[0]; const lo = fair[fair.length - 1];
    return { ...base, title: L('مقارنة الأمانات المعدّلة بمزيج الإيرادات', 'Amanah comparison adjusted for revenue mix'),
      text: L(`لا تُرتَّب الأمانات بالمبلغ المحصّل وحده. يُقارَن معدل كل أمانة بالمعدل المتوقع من مزيج مصادرها (كل مصدر بمعدله العام). الأعلى أداءً بعد التعديل: ${nm(hi)} (${hi.index >= 0 ? '+' : ''}${hi.index.toFixed(1)} نقطة)، والأدنى: ${nm(lo)} (${lo.index.toFixed(1)} نقطة). ${smallOnly ? 'فواتير كل الأمانات في هذه الفترة قليلة (أقل من 10) فالمقارنة إرشادية فقط. ' : ''}الأمانات التي فواتيرها أقل من 10 موسومة «عينة صغيرة». ${demoNote}`, `Amanahs are not ranked by collected amount alone. Each Amanah's rate is compared with the rate expected from its source mix (each source at its overall rate). Highest after adjustment: ${nm(hi)} (${hi.index >= 0 ? '+' : ''}${hi.index.toFixed(1)} pp); lowest: ${nm(lo)} (${lo.index.toFixed(1)} pp). ${smallOnly ? 'Every Amanah has few invoices (under 10) in this period, so the comparison is indicative only. ' : ''}Amanahs with fewer than 10 invoices are flagged “small sample”. ${demoNote}`),
      facts: [{ k: L('الأمانات المقارَنة', 'Amanahs compared'), v: fmtInt(fair.length) }, { k: L('المعدل العام', 'Overall rate'), v: rateTxt }],
      table: { headers: [L('الأمانة', 'Amanah'), L('صافي المفوتر', 'Net billed'), L('معدل التحصيل', 'Rate'), L('المتوقع بحسب المزيج', 'Expected by mix'), L('الفرق (نقطة)', 'Index (pp)'), L('متأخر من الصافي', 'Overdue share'), L('الفواتير', 'Invoices')], rows: fair.map((r) => [nm(r), M(r.net), `${(r.rate * 100).toFixed(1)}%`, `${(r.expectedRate * 100).toFixed(1)}%`, `${r.index >= 0 ? '+' : ''}${r.index.toFixed(1)}`, r.overdueShare == null ? '—' : `${(r.overdueShare * 100).toFixed(0)}%`, `${fmtInt(r.count)}${r.smallSample ? L(' (عينة صغيرة)', ' (small sample)') : ''}`]) },
      drill: { to: '/insights?view=reports&report=amanah', label: L('تقرير الأمانات والبلديات', 'Amanahs & municipalities report') } };
  }
  if (intent === 'scenario') {
    const n = parseNumber(text);
    const down = /(انخفض|نقص|تراجع|هبط|قل )/.test(s);
    let patch = {};
    if (/(استرداد|متاخر)/.test(s)) patch.recovery = Math.min(100, n ?? 25);
    else if (/(الفوتره|الفواتير|الفوترة)/.test(s)) patch.billing = (down ? -1 : 1) * (n ?? 5);
    else patch.dRate = (down ? -1 : 1) * (n ?? 5);
    const sc = runScenario(scenarioBase(snap), patch, targets.collectionRate.value);
    const key = Object.keys(patch)[0]; const unit = key === 'dRate' ? L('نقطة مئوية', 'percentage points') : '%';
    const dC = sc.deltaCollected;
    return { ...base, title: L('محاكاة سيناريو', 'Scenario simulation'),
      text: L(`إذا كان التغيير ${patch[key] >= 0 ? '+' : ''}${patch[key]} ${unit} (${key === 'dRate' ? 'من صافي المفوتر' : key === 'recovery' ? 'من الأرصدة المتأخرة القابلة للتحصيل' : 'في الفوترة'}) ضمن ${scopeText}: يرتفع المحصّل من ${M(sc.baseline.collected)} إلى ${M(sc.scenario.collected)} (${dC >= 0 ? '+' : ''}${M(dC)})، وغير المحصّل من ${M(sc.baseline.uncollected)} إلى ${M(sc.scenario.uncollected)}، ونسبة التحصيل من ${(sc.baseline.rate * 100).toFixed(1)}% إلى ${(sc.scenario.rate * 100).toFixed(1)}%. هذا حساب لسيناريو افتراضي وليس تنبؤاً ولا وعداً بالتحصيل. ${demoNote}`, `If the change is ${patch[key] >= 0 ? '+' : ''}${patch[key]} ${unit} within ${scopeText}: collected moves from ${M(sc.baseline.collected)} to ${M(sc.scenario.collected)} (${dC >= 0 ? '+' : ''}${M(dC)}), uncollected from ${M(sc.baseline.uncollected)} to ${M(sc.scenario.uncollected)}, and the collection rate from ${(sc.baseline.rate * 100).toFixed(1)}% to ${(sc.scenario.rate * 100).toFixed(1)}%. This is the arithmetic of a hypothetical scenario — not a forecast and not a promise of collection. ${demoNote}`),
      facts: [{ k: L('المحصّل (أساس)', 'Collected (baseline)'), v: M(sc.baseline.collected) }, { k: L('المحصّل (سيناريو)', 'Collected (scenario)'), v: M(sc.scenario.collected) }, { k: L('نسبة التحصيل', 'Rate'), v: `${(sc.baseline.rate * 100).toFixed(1)}% → ${(sc.scenario.rate * 100).toFixed(1)}%` }],
      actions: [{ kind: 'scenario', patch, label: L('فتح في لوحة السيناريوهات', 'Open in the scenario panel') }] };
  }
  if (intent === 'priorities') {
    const horizon = addDaysIso(today, 30);
    const open = (register.actions || []).filter((a) => a.status === 'approved' || a.status === 'in_progress');
    const due = open.filter((a) => a.dueDate && a.dueDate <= horizon).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const tx = (v) => (v == null ? '' : typeof v === 'string' ? v : (ar ? v.ar : v.en));
    const props = proposals.slice(0, 3);
    return { ...base, title: L('الأولويات خلال 30 يوماً', 'Priorities for the next 30 days'),
      text: L(`ضمن ${scopeText}: ${due.length} إجراء معتمد استحقاقه خلال 30 يوماً (منها ${due.filter((a) => isOverdue(a, today)).length} متأخر)، و${props.length} مقترح بانتظار مراجعتك مرتبة بالمبلغ والتقادم وقابلية المتابعة. لم تُسند المقترحات لأحد؛ يحددها المراجع. ${demoNote}`, `Within ${scopeText}: ${due.length} approved action(s) fall due within 30 days (${due.filter((a) => isOverdue(a, today)).length} overdue) and ${props.length} proposals await your review, ranked by amount, aging and actionability. Proposals are not assigned to anyone; the reviewer decides. ${demoNote}`),
      facts: [{ k: L('إجراءات مستحقة', 'Actions due'), v: fmtInt(due.length) }, { k: L('مقترحات للمراجعة', 'Proposals to review'), v: fmtInt(props.length) }],
      table: { headers: [L('النوع', 'Type'), L('البند', 'Item'), L('الدليل/الأثر', 'Evidence / impact'), L('الاستحقاق/الحالة', 'Due / status')], rows: [...due.slice(0, 4).map((a) => [L('إجراء معتمد', 'Approved action'), tx(a.title), a.expectedImpact?.amount ? M(a.expectedImpact.amount) : '—', `${a.dueDate} · ${a.owner || L('غير مسند', 'unassigned')}`]), ...props.map((p) => [L('مقترح للمراجعة', 'Proposal to review'), tx(p.title), p.expectedImpact?.amount ? `${M(p.expectedImpact.amount)} (${p.expectedImpact.kind === 'upper_bound' ? L('سقف', 'upper bound') : L('تقدير', 'estimate')})` : '—', tx(p.timeframe)])] },
      drill: { to: '#decisions', label: L('سجل القرارات والمتابعة', 'Decisions and follow-up') } };
  }
  if (intent === 'target') {
    const ach = await getAchievement(scope);
    if (!ach || ach.scopeCaveat || ach.annualTarget == null) return { ...base, title: L('المستهدف', 'Target'), text: L('المستهدف السنوي وطني وغير موزع على أمانة أو مصدر؛ لا يمكن مقارنة نطاق أضيق به. أزل مرشح الأمانة/المصدر لرؤية تحقيق المستهدف. المستهدف نفسه مُدخل تجريبي غير معتمد.', 'The annual target is national and not allocated to an Amanah or source, so a narrower scope cannot be compared with it. Clear the Amanah/source filter to see target achievement. The target itself is an unapproved demo input.'), facts: [] };
    const pct = ach.achievement.calculable ? `${(ach.achievement.value * 100).toFixed(1)}%` : L('غير متاحة', 'not available');
    return { ...base, title: L('تحقيق المستهدف', 'Target achievement'),
      text: L(`المقبوضات منذ بداية السنة المالية ${M(ach.receiptsYtd)} مقابل مستهدف تراكمي ${M(ach.targetYtd || 0)} (تحقق ${pct}). المستهدف مُدخل تجريبي غير معتمد، وهذه مقبوضات بتاريخ الدفع. ${demoNote}`, `Fiscal-year receipts ${M(ach.receiptsYtd)} against a cumulative target of ${M(ach.targetYtd || 0)} (achievement ${pct}). The target is an unapproved demo input and receipts are by payment date. ${demoNote}`),
      facts: [{ k: L('المقبوض', 'Receipts'), v: M(ach.receiptsYtd) }, { k: L('المستهدف التراكمي', 'Cumulative target'), v: M(ach.targetYtd || 0) }, { k: L('الفجوة', 'Gap'), v: ach.gap == null ? '—' : M(ach.gap) }], drill: { to: '#targets', label: L('قسم المستهدفات', 'Targets section') } };
  }
  if (intent === 'aging') {
    const S = snap.stock; const old = (S.aging[3]?.amount || 0) + (S.aging[4]?.amount || 0);
    return { ...base, title: L('المتأخرات والتقادم', 'Overdue and aging'),
      text: L(`الرصيد القائم غير المحصّل ${M(S.netUncollected)} منه متأخر ${M(S.overdue)} ومنه أكثر من 90 يوماً ${M(old)} (${S.netUncollected > 0 ? (old / S.netUncollected * 100).toFixed(0) : 0}%). الرصيد القائم يشمل كل ما صدر حتى ${snap.cutoff} ضمن الأمانة والمصدر المحددين. ${demoNote}`, `The standing uncollected balance is ${M(S.netUncollected)}, of which ${M(S.overdue)} is overdue and ${M(old)} more than 90 days (${S.netUncollected > 0 ? (old / S.netUncollected * 100).toFixed(0) : 0}%). The standing balance covers everything issued up to ${snap.cutoff} within the Amanah and source filters. ${demoNote}`),
      facts: [{ k: L('رصيد قائم', 'Standing balance'), v: M(S.netUncollected) }, { k: L('متأخر', 'Overdue'), v: M(S.overdue) }, { k: L('> 90 يوماً', '> 90 days'), v: M(old) }],
      table: { headers: [L('العمر', 'Age'), L('الفواتير', 'Invoices'), L('غير المحصّل', 'Uncollected')], rows: S.aging.map((a) => [ar ? a.label.ar : a.label.en, fmtInt(a.count), M(a.amount)]) }, drill: { to: '/collection', label: L('قائمة التحصيل', 'Collection worklist') } };
  }
  if (intent === 'summary') {
    const prev = await fetchPrev(scope); const res = buildInsights({ snapshot: snap, prev, comparison: prev ? ctx.compare(snap, prev) : null, forecast: null, targets });
    const top = res.insights.filter((i) => i.severity !== 'info').slice(0, 3);
    const tx = (o) => (ar ? o.ar : o.en);
    return { ...base, title: L('الملخص التنفيذي للاجتماع', 'Executive summary for the meeting'),
      text: `${tx(res.summary.text)}\n${top.map((i, k) => `${k + 1}. ${tx(i.title)} — ${tx(i.body).replace(/\{(\w+)\}/g, (_, key) => (i.tokens?.[key] != null ? M(i.tokens[key]) : ''))}`).join('\n')}\n${L('هذا الملخص مبني على المرشحات النشطة؛ يمكن تصديره بالأرقام والافتراضات نفسها.', 'This summary uses the active filters; it can be exported with the same figures and assumptions.')} ${demoNote}`,
      facts: [{ k: L('صافي المفوتر', 'Net billed'), v: M(T.net) }, { k: L('المحصّل', 'Collected'), v: M(T.collected) }, { k: L('نسبة التحصيل', 'Rate'), v: rateTxt }, { k: L('غير المحصّل', 'Uncollected'), v: M(T.outstanding) }],
      actions: [{ kind: 'export', label: L('تصدير الملخص التنفيذي', 'Export the executive summary') }] };
  }
  // position
  return { ...base, title: L('الوضع الحالي', 'Current position'),
    text: L(`ضمن ${scopeText}: إجمالي المفوتر ${M(T.gross)} = استبعادات ${M(T.exclusions)} + صافي ${M(T.net)}؛ والصافي = محصّل ${M(T.collected)} + غير محصّل ${M(T.outstanding)}. نسبة التحصيل ${rateTxt}. ${demoNote}`, `Within ${scopeText}: gross billed ${M(T.gross)} = exclusions ${M(T.exclusions)} + net ${M(T.net)}; net = collected ${M(T.collected)} + uncollected ${M(T.outstanding)}. Collection rate ${rateTxt}. ${demoNote}`),
    facts: [{ k: L('إجمالي المفوتر', 'Gross'), v: M(T.gross) }, { k: L('صافي المفوتر', 'Net'), v: M(T.net) }, { k: L('المحصّل', 'Collected'), v: M(T.collected) }, { k: L('نسبة التحصيل', 'Rate'), v: rateTxt }] };
}
