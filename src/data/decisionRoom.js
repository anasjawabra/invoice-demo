// «غرفة القرارات» — the items a CFO needs to look at, DERIVED from the platform's own figures (pure functions, no I/O, no invented data).
// An item exists only when data supports it: six categories (overdue · aged debt · year target · investment contracts · enforcement · data matching).
// Every item says what it is, how much (and on which basis), the evidence to open, a cause that is either established or an explicit hypothesis, the recommended action,
// and a proposed owner role and due date. The ranking is the platform's existing formula (amount .4 · aging .25 · actionability .25 · evidence .1), shown to the reader.
//
// Amount bases are never added together: «period» (invoices of the selected period), «standing» (the balance up to the cutoff), «plan» (fiscal-year target),
// «contracts» and «orders» each keep their own basis. The ONLY total is the period's overdue amount, which with the not-yet-due part equals «غير المحصّل» on the dashboard.
import { PRIORITY_WEIGHTS } from './revenueInsights';
import { forecastYear } from './planForecast';

const bi = (ar, en) => ({ ar, en });
export const CATEGORIES = { overdue: bi('متأخرات', 'Overdue'), aged: bi('ديون قديمة', 'Aged debt'), target: bi('مستهدف السنة', 'Year target'), contracts: bi('العقود الاستثمارية', 'Investment contracts'), enforcement: bi('التنفيذ', 'Enforcement'), data: bi('المطابقة والبيانات', 'Matching and data') };
export const LANES = { decision: bi('يتطلب قراراً', 'Needs a decision'), action: bi('يتطلب إجراءً', 'Needs action'), watch: bi('للمتابعة', 'To follow') };
export const ROLES = {
  amanah_revenue: bi('وحدة الإيرادات في الأمانة', 'Amanah revenue unit'), finance: bi('الإدارة المالية', 'Finance'), enforcement: bi('وحدة التنفيذ', 'Enforcement unit'),
  investment: bi('إدارة الاستثمار', 'Investment management'), data_owner: bi('مالك البيانات', 'Data owner')
};
export const BASES = { period: bi('فواتير الفترة المختارة', 'Invoices of the selected period'), standing: bi('الرصيد القائم حتى تاريخ القطع (كل الفترات)', 'Standing balance to the cutoff (all periods)'), plan: bi('السنة المالية والمستهدف', 'Fiscal year and target'), contracts: bi('جداول العقود', 'Contract schedules'), orders: bi('أوامر التنفيذ', 'Enforcement orders'), data: bi('فحوص المطابقة', 'Matching checks') };
export const W = PRIORITY_WEIGHTS; // { amount: 0.4, aging: 0.25, actionability: 0.25, evidence: 0.1 }
const SHARE_MIN = 0.03; // a cell / Amanah shows only when it holds at least this share of its total
const MAX_PER_CATEGORY = { overdue: 8, aged: 5, target: 6 };
const to = (path, params = {}) => { const q = new URLSearchParams(params).toString(); return q ? `${path}?${q}` : path; };

const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
const rateOf = (c, n) => (n > 0 ? c / n : null);

/** the year-target section from the planning data: Ministry forecast + each entity against the target planned to date (same functions as the planning page) */
export function planSectionOf({ year, reportingDate, entityRows, collectedByKey, collectedTotal, monthly, billedMonthly, standing, yearEnded = false }) {
  const m = Number(reportingDate.slice(5, 7)); const dim = new Date(Date.UTC(year, m, 0)).getUTCDate(); const dayFraction = Number(reportingDate.slice(8, 10)) / dim;
  const planned = (cum) => (m > 1 ? cum[m - 2] : 0) + (cum[m - 1] - (m > 1 ? cum[m - 2] : 0)) * dayFraction;
  const ministryRows = entityRows.filter((r) => r.revenueTarget > 0);
  const target = sum(ministryRows, (r) => r.revenueTarget);
  const cum = Array.from({ length: 12 }, (_, i) => sum(ministryRows, (r) => r.cumulative[i]));
  const f = target > 0 ? forecastYear({ target, cumTarget: cum, monthlyCollected: monthly, reportingMonth: m, yearEnded, dayFraction, billedMonthly, standingUncollected: standing }) : null;
  return {
    year, reportingDate, monthsLeft: f ? f.monthsLeft : 0,
    ministry: f ? { target, collected: collectedTotal, forecast: f.forecast, plannedToDate: f.plannedToDate, avg: f.avg, reasons: f.reasons, maxTotal: f.maxTotal } : null,
    entities: ministryRows.map((r) => ({ key: r.key, target: r.revenueTarget, collected: collectedByKey[r.key] || 0, plannedToDate: planned(r.cumulative) }))
  };
}

/**
 * @param {object} inp
 *  today, snapshot (period scope), labels { amanah(key) → {ar,en}, source(key) → {ar,en} }, targetRate(amanahKey) → 0..1,
 *  plan (planSectionOf | null), contracts { count, arrears, overdueInstallments, futureNotInvoiced } | null, noContractCount,
 *  orders { suspendedCount, suspendedAmount } | null, matching { amountConflicts, missingFields } | null
 * @returns {{ items: object[], summary: object }}
 */
export function buildDecisionItems(inp) {
  const { snapshot: S, labels, targetRate = () => 0.6 } = inp; const period = { from: S.scope.from, to: S.scope.to };
  const items = []; const add = (it) => items.push({ period, evidence: [], figures: [], cause: { status: 'unknown', text: bi('سبب عدم السداد غير مسجل في البيانات المتاحة؛ أي سبب يُذكر فرضية تُتحقق منها أثناء المتابعة.', 'The reason is not recorded in the available data; any reason given is a hypothesis to verify during follow-up.') }, urgency: 0, actionability: 0.5, evidenceQuality: 0.8, ...it });

  /* ---- 1. overdue: Amanah × source, overdue only (the not-yet-due part is stated beside it and never counted) */
  const cells = (S.matrix?.amanahSource || []).filter((c) => c.overdue > 0);
  const totalOverdue = sum(S.matrix?.amanahSource || [], (c) => c.overdue); const totalNotDue = sum(S.matrix?.amanahSource || [], (c) => c.notDue);
  cells.filter((c) => c.overdue >= SHARE_MIN * totalOverdue).sort((a, b) => b.overdue - a.overdue).slice(0, MAX_PER_CATEGORY.overdue).forEach((c) => {
    const rate = rateOf(c.collected, c.net); const tgt = targetRate(c.amanah); const gap = rate == null ? null : tgt - rate;
    add({
      key: `overdue:${c.amanah}|${c.source}`, category: 'overdue', lane: 'action', basis: 'period', amanah: c.amanah, source: c.source,
      title: bi(`${labels.amanah(c.amanah).ar} — ${labels.source(c.source).ar}: متأخرات للمتابعة`, `${labels.amanah(c.amanah).en} — ${labels.source(c.source).en}: overdue to follow up`),
      problem: bi(`على ${labels.amanah(c.amanah).ar} في ${labels.source(c.source).ar} مبلغ متأخر عن الاستحقاق ولم يُحصَّل.`, `${labels.amanah(c.amanah).en} holds an overdue, uncollected amount in ${labels.source(c.source).en}.`),
      amount: c.overdue, maxDays: c.maxDaysOverdue,
      figures: [
        { label: bi('المتأخر', 'Overdue'), value: c.overdue, kind: 'money' }, { label: bi('لم يحن (خارج المبلغ)', 'Not yet due (not counted)'), value: c.notDue, kind: 'money' },
        { label: bi('صافي المفوتر', 'Net billed'), value: c.net, kind: 'money' }, { label: bi('المحصّل', 'Collected'), value: c.collected, kind: 'money' },
        { label: bi('نسبة التحصيل', 'Collection rate'), value: rate, kind: 'pct' }, { label: bi('مستهدف الجهة', 'Entity target'), value: tgt, kind: 'pct' },
        { label: bi('الفجوة عن المستهدف (نقطة)', 'Gap to the target (pp)'), value: gap == null ? null : gap * 100, kind: 'pp' }, { label: bi('أطول تأخر (يوم)', 'Longest delay (days)'), value: c.maxDaysOverdue, kind: 'count' }
      ],
      evidence: [{ label: bi('الفواتير المتأخرة', 'The overdue invoices'), to: to('/collection', { amanah: c.amanah, src: c.source, category: 'overdue' }) }, { label: bi('الفواتير المحصّلة جزئياً (جزؤها المتأخر داخل المبلغ)', 'Partly collected invoices (their overdue part is inside the amount)'), to: to('/collection', { amanah: c.amanah, src: c.source, category: 'partial' }) }],
      recommendation: bi('متابعة محددة المدة للفواتير المتأخرة وتسجيل استجابة الدافع على كل فاتورة.', 'Run a time-boxed follow-up on the overdue invoices and record the payer’s response on each.'),
      decisionNeeded: null, role: 'amanah_revenue', dueDays: 30, urgency: Math.min(1, (c.maxDaysOverdue || 0) / 180), actionability: 1, evidenceQuality: 0.9
    });
  });
  if (totalNotDue > 0) {
    add({ key: 'upcoming:not_due', category: 'overdue', lane: 'watch', basis: 'period', title: bi('رصيد لم يحن استحقاقه', 'Balance not yet due'), problem: bi('فواتير في الفترة لم يحن موعد سدادها بعد؛ لا تُحسب متأخرة ولا تدخل في المبالغ القابلة للمتابعة.', 'Invoices of the period whose due date has not come; they are not overdue and are not counted as collectible now.'),
      amount: totalNotDue, figures: [{ label: bi('لم يحن استحقاقه', 'Not yet due'), value: totalNotDue, kind: 'money' }, { label: bi('المتأخر (للمقارنة)', 'Overdue (for comparison)'), value: totalOverdue, kind: 'money' }],
      cause: { status: 'confirmed', text: bi('موعد الاستحقاق لم يحن عند قطع البيانات.', 'The due date had not come at the data cutoff.') },
      evidence: [{ label: bi('الفواتير التي لم يحن موعدها', 'Invoices not yet due'), to: to('/collection', { category: 'not_due' }) }],
      recommendation: bi('لا إجراء الآن؛ تُراقب عند حلول مواعيدها.', 'No action now; watch it as the due dates arrive.'), decisionNeeded: null, role: 'amanah_revenue', dueDays: 30, actionability: 0.1, evidenceQuality: 0.9 });
  }

  /* ---- 2. aged debt: standing balance older than 180 days, by Amanah (a decision on the route, not a routine follow-up) */
  const aged = S.stock?.aged180ByAmanah || []; const totalAged = sum(aged, (a) => a.amount);
  aged.filter((a) => a.amount >= SHARE_MIN * totalAged).sort((a, b) => b.amount - a.amount).slice(0, MAX_PER_CATEGORY.aged).forEach((a) => {
    const stock = (S.stock.byAmanah || []).find((g) => g.key === a.key); const share = stock && stock.outstanding > 0 ? a.amount / stock.outstanding : null;
    add({
      key: `aged:${a.key}`, category: 'aged', lane: 'decision', basis: 'standing', amanah: a.key,
      title: bi(`${labels.amanah(a.key).ar}: ديون أعمر من 180 يوماً`, `${labels.amanah(a.key).en}: debt older than 180 days`),
      problem: bi('رصيد قائم مرّ على استحقاقه أكثر من 180 يوماً؛ كلما طال العمر قلّت فرصة التحصيل بالمتابعة العادية.', 'A standing balance more than 180 days past due; the older it gets, the less ordinary follow-up recovers.'),
      amount: a.amount, maxDays: 181,
      figures: [{ label: bi('الرصيد الأعمر من 180 يوماً', 'Balance older than 180 days'), value: a.amount, kind: 'money' }, { label: bi('عدد الفواتير', 'Invoices'), value: a.count, kind: 'count' }, { label: bi('حصته من رصيد الجهة القائم', 'Share of the entity’s standing balance'), value: share, kind: 'pct' }],
      evidence: [{ label: bi('الفواتير المتأخرة للجهة (وسّع الفترة في التصفية لرؤية الأقدم)', 'The entity’s overdue invoices (widen the period in the filter to see the oldest)'), to: to('/collection', { amanah: a.key, category: 'overdue' }) }],
      recommendation: bi('تحديد مسار المعالجة: متابعة مكثفة، أو إحالة المؤهل منها للتنفيذ، أو توثيق قبول المخاطرة.', 'Choose the route: intensive follow-up, referral of the eligible invoices to enforcement, or documenting acceptance of the risk.'),
      decisionNeeded: bi('اعتماد مسار معالجة الديون الأعمر من 180 يوماً.', 'Approve the route for debt older than 180 days.'), role: 'finance', dueDays: 30, urgency: 1, actionability: 0.7, evidenceQuality: 0.9
    });
  });

  /* ---- 3. year target (planning data, with the estimate labelled as a demonstration) */
  const P = inp.plan;
  if (P?.ministry && P.ministry.forecast < P.ministry.target) {
    const M = P.ministry; const gap = M.target - M.forecast; const need = Math.max(M.target - M.collected, 0) / Math.max(P.monthsLeft, 1);
    const miss = (M.reasons || []).filter((r) => r.kind === 'miss');
    add({
      key: 'target:ministry', category: 'target', lane: 'decision', basis: 'plan',
      title: bi(`مستهدف ${P.year}: التقدير أقل من المستهدف السنوي`, `${P.year} target: the estimate is below the annual target`),
      problem: bi('التقدير التجريبي لنهاية السنة لا يبلغ المستهدف السنوي للإيراد.', 'The demonstration estimate for the end of the year does not reach the annual revenue target.'),
      amount: gap, urgency: Math.min(1, 1 - P.monthsLeft / 12),
      figures: [{ label: bi('المستهدف السنوي', 'Annual target'), value: M.target, kind: 'money' }, { label: bi('المحصّل حتى تاريخه', 'Collected to date'), value: M.collected, kind: 'money' }, { label: bi('المخطط حتى تاريخه', 'Planned to date'), value: M.plannedToDate, kind: 'money' },
        { label: bi('تقدير نهاية السنة (متوسط آخر 3 أشهر)', 'Year-end estimate (last-3-month average)'), value: M.forecast, kind: 'money' }, { label: bi('الفجوة المقدّرة', 'Estimated gap'), value: gap, kind: 'money' },
        { label: bi('المعدل الشهري الحالي', 'Current monthly pace'), value: M.avg, kind: 'money' }, { label: bi('المعدل الشهري المطلوب', 'Monthly pace needed'), value: need, kind: 'money' }],
      cause: { status: 'confirmed', text: miss.some((r) => r.code === 'billing_insufficient') ? bi(`حسابياً: حتى بتحصيل كامل الرصيد القائم والفوترة المتوقعة (الحد الأقصى ${Math.round(M.maxTotal / 1e6).toLocaleString('en-US')} مليون) لا يتحقق المستهدف؛ الفوترة غير كافية.`, `By arithmetic: even collecting the whole standing balance and the billing still expected (maximum ${Math.round(M.maxTotal / 1e6).toLocaleString('en-US')} M) cannot reach the target; billing is insufficient.`) : bi('حسابياً: وتيرة التحصيل الحالية أقل من المطلوب لبلوغ المستهدف.', 'By arithmetic: the current collection pace is below what the target needs.') },
      evidence: [{ label: bi('صفحة التخطيط (المستهدف والتقدير)', 'Planning page (target and estimate)'), to: '/planning' }],
      recommendation: bi('إقرار خطة تعويض تغطي الفجوة، أو مراجعة المستهدف بقرار معتمد من صفحة التخطيط.', 'Approve a recovery plan that covers the gap, or revise the target by an approved decision on the planning page.'),
      decisionNeeded: bi('اعتماد خطة التعويض أو تعديل المستهدف.', 'Approve the recovery plan or revise the target.'), role: 'finance', dueDays: 30, actionability: 0.6, evidenceQuality: 0.6, caveat: bi('التقدير تجريبي للعرض التوضيحي وليس نموذجاً معتمداً.', 'The estimate is a demonstration, not an approved model.')
    });
  }
  (P?.entities || []).map((e) => ({ ...e, gap: e.plannedToDate - e.collected, ach: e.plannedToDate > 0 ? e.collected / e.plannedToDate : null })).filter((e) => e.ach != null && e.ach < 0.8 && e.gap > 0)
    .sort((a, b) => b.gap - a.gap).slice(0, MAX_PER_CATEGORY.target - 1).forEach((e) => {
      add({
        key: `target:${e.key}`, category: 'target', lane: 'decision', basis: 'plan', amanah: e.key,
        title: bi(`${labels.amanah(e.key).ar}: متأخرة عن مستهدفها حتى تاريخه`, `${labels.amanah(e.key).en}: behind its target to date`),
        problem: bi('المحصّل أقل من 80% من المستهدف المخطط للجهة حتى تاريخ التقرير.', 'Collected is below 80% of the entity’s planned target to the reporting date.'),
        amount: e.gap, urgency: Math.min(1, 1 - P.monthsLeft / 12),
        figures: [{ label: bi('المستهدف السنوي', 'Annual target'), value: e.target, kind: 'money' }, { label: bi('المخطط حتى تاريخه', 'Planned to date'), value: e.plannedToDate, kind: 'money' }, { label: bi('المحصّل حتى تاريخه', 'Collected to date'), value: e.collected, kind: 'money' }, { label: bi('نسبة التحقق من المخطط', 'Achievement of the plan to date'), value: e.ach, kind: 'pct' }, { label: bi('الفجوة', 'Gap'), value: e.gap, kind: 'money' }],
        cause: { status: 'confirmed', text: bi('حسابياً: المحصّل دون المخطط حتى تاريخه؛ سبب التأخر غير مسجل في البيانات.', 'By arithmetic: collected is below the plan to date; the reason for the delay is not recorded.') },
        evidence: [{ label: bi('المستهدفات والمحصّل لكل جهة', 'Targets and collected by entity'), to: '/planning' }, { label: bi('متأخرات الجهة', 'The entity’s overdue'), to: to('/collection', { amanah: e.key, category: 'overdue' }) }],
        recommendation: bi('مراجعة خطة تحصيل الجهة أو تعديل مستهدفها بقرار معتمد.', 'Review the entity’s collection plan, or revise its target by an approved decision.'),
        decisionNeeded: bi('اعتماد خطة الجهة أو تعديل مستهدفها.', 'Approve the entity’s plan or revise its target.'), role: 'finance', dueDays: 30, actionability: 0.6, evidenceQuality: 0.7
      });
    });

  /* ---- 4. investment contracts */
  const C = inp.contracts;
  if (C?.arrears > 0) {
    add({ key: 'contracts:arrears', category: 'contracts', lane: 'action', basis: 'contracts', title: bi('أقساط عقود استثمارية متأخرة', 'Overdue investment-contract installments'), problem: bi('أقساط فُوترت وحلّ موعدها ولم تُسدَّد.', 'Installments invoiced, due and not paid.'), amount: C.arrears,
      figures: [{ label: bi('المتأخرات', 'Arrears'), value: C.arrears, kind: 'money' }, { label: bi('أقساط متأخرة', 'Overdue installments'), value: C.overdueInstallments, kind: 'count' }, { label: bi('عدد العقود', 'Contracts'), value: C.count, kind: 'count' }],
      evidence: [{ label: bi('العقود الاستثمارية', 'Investment contracts'), to: '/contracts' }], recommendation: bi('متابعة الأقساط المتأخرة لكل عقد وتحديث حالته.', 'Follow up each contract’s overdue installments and update its status.'), decisionNeeded: null, role: 'investment', dueDays: 30, actionability: 0.9, evidenceQuality: 0.85 });
  }
  if (inp.noContractCount > 0) {
    add({ key: 'contracts:no_contract', category: 'contracts', lane: 'action', basis: 'contracts', title: bi('فواتير استثمار مركزية بلا عقد مطابق', 'Central investment invoices with no matched contract'), problem: bi('فواتير استثمارية مركزية لا يعرفها نظام العقود.', 'Central investment invoices the contract data does not know.'),
      amount: null, figures: [{ label: bi('عدد الفواتير', 'Invoices'), value: inp.noContractCount, kind: 'count' }],
      cause: { status: 'hypothesis', text: bi('فرضية: عقد غير مسجّل أو رقم عقد غير مطابق؛ يلزم تأكيد مالك البيانات (لا يُستبعد من الصافي إلا بتأكيد مكتوب).', 'Hypothesis: an unregistered contract or a contract number that does not match; the data owner must confirm (it is excluded from net only with written confirmation).') },
      evidence: [{ label: bi('المخاطر والانحرافات', 'Risks and deviations'), to: '/risk' }], recommendation: bi('طلب تأكيد مالك البيانات لكل فاتورة: وجود عقد أم لا.', 'Ask the data owner to confirm for each invoice whether a contract exists.'), decisionNeeded: null, role: 'data_owner', dueDays: 30, actionability: 0.8, evidenceQuality: 0.7 });
  }
  if (C?.futureNotInvoiced > 0) {
    add({ key: 'contracts:future', category: 'contracts', lane: 'watch', basis: 'contracts', title: bi('أقساط مستقبلية لم تُفوتر بعد', 'Future installments not yet invoiced'), problem: bi('أقساط في جداول العقود لم يحن موعد فوترتها.', 'Installments in the contract schedules whose invoicing date has not come.'), amount: C.futureNotInvoiced,
      figures: [{ label: bi('قادمة غير مفوترة', 'Upcoming, not invoiced'), value: C.futureNotInvoiced, kind: 'money' }], cause: { status: 'confirmed', text: bi('جداول العقود تتضمنها ولم تصدر لها فواتير بعد.', 'The contract schedules include them and no invoice exists yet.') },
      evidence: [{ label: bi('العقود الاستثمارية', 'Investment contracts'), to: '/contracts' }], recommendation: bi('التأكد من إصدار الفواتير في مواعيدها.', 'Make sure the invoices are issued on time.'), decisionNeeded: null, role: 'investment', dueDays: 30, actionability: 0.2, evidenceQuality: 0.8 });
  }

  /* ---- 5. enforcement */
  const O = inp.orders;
  if (O?.suspendedCount > 0) {
    add({ key: 'orders:suspended', category: 'enforcement', lane: 'decision', basis: 'orders', title: bi('أوامر تنفيذ موقوفة', 'Suspended enforcement orders'), problem: bi('أوامر تنفيذ حالتها «موقوف» تحتاج قراراً بالاستئناف أو الإغلاق.', 'Enforcement orders in the «suspended» state need a decision to resume or close.'), amount: O.suspendedAmount > 0 ? O.suspendedAmount : null,
      figures: [{ label: bi('أوامر موقوفة', 'Suspended orders'), value: O.suspendedCount, kind: 'count' }, { label: bi('قيمة الأوامر', 'Order value'), value: O.suspendedAmount > 0 ? O.suspendedAmount : null, kind: 'money' }],
      cause: { status: 'unknown', text: bi('سبب الإيقاف غير متوفر في بيانات الأمر؛ التعثر هنا يعني حالة «موقوف» فقط (لا يوجد تاريخ آخر تحديث).', 'The reason for the suspension is not in the order data; «stalled» here means the «suspended» state only (there is no last-update date).') },
      evidence: [{ label: bi('مساحة الإنفاذ', 'Enforcement workspace'), to: '/enforcement' }], recommendation: bi('مراجعة كل أمر موقوف في مساحة الإنفاذ وتوثيق الاستئناف أو الإغلاق.', 'Review each suspended order in the enforcement workspace and document resuming or closing it.'),
      decisionNeeded: bi('الاستئناف أو الإغلاق لكل أمر موقوف.', 'Resume or close each suspended order.'), role: 'enforcement', dueDays: 30, actionability: 0.8, evidenceQuality: 0.7 });
  }

  /* ---- 6. matching and data */
  const D = inp.matching;
  if (D?.amountConflicts > 0) {
    add({ key: 'data:amount_conflicts', category: 'data', lane: 'action', basis: 'data', title: bi('تعارض بين مبلغ الفاتورة وبنودها', 'Invoice amount conflicts with its line items'), problem: bi('مبلغ الترويسة لا يساوي مجموع البنود فلا يُعرف أيهما الصحيح.', 'The header amount differs from the sum of the lines, so which is right is unknown.'), amount: null,
      figures: [{ label: bi('فواتير متعارضة', 'Conflicting invoices'), value: D.amountConflicts, kind: 'count' }], cause: { status: 'confirmed', text: bi('اختلاف حسابي بين الترويسة والبنود في بيانات المصدر.', 'An arithmetic difference between header and lines in the source data.') },
      evidence: [{ label: bi('المخاطر والانحرافات', 'Risks and deviations'), to: '/risk' }], recommendation: bi('طلب تصحيح المبلغ من مالك البيانات قبل الاعتماد عليه.', 'Ask the data owner to correct the amount before relying on it.'), decisionNeeded: null, role: 'data_owner', dueDays: 30, actionability: 0.7, evidenceQuality: 0.9 });
  }
  if (D?.missingFields > 0) {
    add({ key: 'data:missing_fields', category: 'data', lane: 'watch', basis: 'data', title: bi('حقول إلزامية ناقصة', 'Mandatory fields missing'), problem: bi('فواتير تفتقد حقلاً لازماً للإحالة أو المطابقة.', 'Invoices lacking a field needed for referral or matching.'), amount: null,
      figures: [{ label: bi('فواتير', 'Invoices'), value: D.missingFields, kind: 'count' }], cause: { status: 'confirmed', text: bi('الحقل غير موجود في بيانات المصدر.', 'The field is absent from the source data.') },
      evidence: [{ label: bi('قائمة الفواتير', 'Invoice list'), to: '/invoices' }], recommendation: bi('استكمال الحقول من مصدرها.', 'Complete the fields at their source.'), decisionNeeded: null, role: 'data_owner', dueDays: 30, actionability: 0.4, evidenceQuality: 0.9 });
  }

  /* ---- ranking: the platform's existing formula, with the reasons spelled out */
  const maxAmount = Math.max(1, ...items.map((i) => i.amount || 0));
  for (const it of items) {
    const amountN = (it.amount || 0) / maxAmount;
    const parts = [
      { k: 'amount', label: bi('المبلغ', 'Amount'), v: W.amount * amountN, text: it.amount ? bi(`${Math.round(amountN * 100)}% من أكبر بند`, `${Math.round(amountN * 100)}% of the largest item`) : bi('بلا مبلغ محسوب', 'no computed amount') },
      { k: 'aging', label: bi('العمر / الاستعجال', 'Aging / urgency'), v: W.aging * it.urgency, text: bi(`${Math.round(it.urgency * 100)}%`, `${Math.round(it.urgency * 100)}%`) },
      { k: 'act', label: bi('قابلية الإجراء', 'Actionability'), v: W.actionability * it.actionability, text: bi(`${Math.round(it.actionability * 100)}%`, `${Math.round(it.actionability * 100)}%`) },
      { k: 'ev', label: bi('جودة الدليل', 'Evidence quality'), v: W.evidence * it.evidenceQuality, text: bi(`${Math.round(it.evidenceQuality * 100)}%`, `${Math.round(it.evidenceQuality * 100)}%`) }
    ];
    it.score = Math.round(parts.reduce((t, p) => t + p.v, 0) * 1000) / 1000;
    it.why = parts.slice().sort((a, b) => b.v - a.v).slice(0, 3);
  }
  items.sort((a, b) => b.score - a.score || (b.amount || 0) - (a.amount || 0));

  return { items, summary: { totalOverdue, totalNotDue, uncollected: S.totals.outstanding, largest: items.filter((i) => i.amount).sort((a, b) => b.amount - a.amount)[0] || null } };
}

/** items with their stored state; items that no longer exist but were worked on come back as «انتهى بالبيانات» */
export function withState(items, store, { today }) {
  const byKey = new Map(items.map((i) => [i.key, i]));
  const out = items.map((i) => { const st = store.items[i.key]; const status = st?.status || 'new'; return { ...i, state: st || null, status, overdueAction: !!st?.due && st.due < today && ['new', 'in_progress'].includes(status) }; });
  for (const [key, st] of Object.entries(store.items)) {
    if (byKey.has(key) || ['completed', 'rejected'].includes(st.status)) continue;
    out.push({ key, category: st.meta?.category || 'data', lane: st.meta?.lane || 'watch', title: st.meta?.title || bi(key, key), amount: st.meta?.amount ?? null, state: st, status: 'resolved', resolvedByData: true, evidence: [], figures: [], why: [], score: 0, role: st.owner || null, overdueAction: false });
  }
  return out;
}

/** the four numbers of the executive summary */
export function summaryOf(withStates, summary) {
  const open = (i) => ['new', 'in_progress'].includes(i.status);
  return {
    decisions: withStates.filter((i) => i.lane === 'decision' && open(i)).length,
    overdueActions: withStates.filter((i) => i.overdueAction).length,
    collectible: summary.totalOverdue, notDue: summary.totalNotDue, uncollected: summary.uncollected,
    largest: summary.largest
  };
}
