// «العوامل المؤثرة في فجوة المستهدف» for the PLAN detail — the same three SEPARATE groups as src/data/planningFactors.js (confirmed facts · hypotheses · missing data; never summed, never read as causes), built over the
// period-aware basis of ONE plan version. The collection-rate / billing-target assumption (content.advanced) is used ONLY by the billing-sufficiency fact. Returns the shape the PlanFactors component renders.
import { fmtMoney } from '../../utils/money';

const bi = (ar, en) => ({ ar, en });
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const pc = (v, d = 1) => (fin(v) ? `${(v * 100).toFixed(d)}%` : '—');
const two = (fn) => bi(fn('ar', (v) => fmtMoney(v, { lang: 'ar' })), fn('en', (v) => fmtMoney(v, { lang: 'en' })));

/** @param o { basis, forecast, inputs (loadPlanInputsForPlan result: .facts), actions (the plan-actions response | null), advanced ({collectionRate?, billingTarget?} of the shown content) } */
export function planFactorsFor({ basis, forecast = null, inputs = null, actions = null, advanced = null } = {}) {
  const facts = []; const hypotheses = []; const missing = [];
  if (!basis || !(basis.target?.value > 0) || basis.actualToDate == null) return { facts, hypotheses, missing, mode: 'gap', empty: true };
  const T = basis.target.value; const C = basis.actualToDate; const P = basis.plannedToDate; const F = inputs?.facts || null; const A = actions?.totals || null; const cut = basis.reportingCutoff;
  const above = !!basis.flags?.aboveTarget;
  if (fin(P) && P > 0) facts.push({ id: 'collected_vs_plan', text: two((l, m) => (l === 'ar' ? `المحصّل ${m(C)} مقابل مخطط ${m(P)} حتى ${cut} (${pc(C / P)} من المخطط حتى تاريخه)${basis.profile?.assumption ? ' — المخطط افتراض بتوزيع متساوٍ' : ''}.` : `Collected ${m(C)} against ${m(P)} planned to ${cut} (${pc(C / P)} of the plan to date)${basis.profile?.assumption ? ' — the plan is an equal-distribution assumption' : ''}.`)) });
  // billing sufficiency: ONLY here are the collection-rate / billing-target assumptions of the plan used
  const requiredBilling = fin(advanced?.billingTarget) && advanced.billingTarget > 0 ? advanced.billingTarget : fin(advanced?.collectionRate) && advanced.collectionRate > 0 ? T / advanced.collectionRate : null;
  if (F && fin(F.net) && requiredBilling > 0 && fin(P) && T > 0) {
    const req = requiredBilling * (P / T);
    if (req > 0) facts.push({ id: 'billing_vs_required', text: two((l, m) => (l === 'ar' ? `صافي المفوتر للفترة حتى تاريخه ${m(F.net)} = ${pc(F.net / req)} من الفوترة التي تتطلبها الخطة حتى تاريخه (${m(req)} وفق افتراض الخطة).` : `Net billed in the period to date ${m(F.net)} = ${pc(F.net / req)} of the billing the plan requires to date (${m(req)} under the plan’s assumption).`)) });
  }
  const req = basis.pace?.required;
  if (forecast?.state === 'ok' && fin(forecast.monthlyRate) && req?.state === 'ok') facts.push({ id: 'pace', text: two((l, m) => (l === 'ar' ? `وتيرة التحصيل في آخر 3 أشهر مكتملة (${forecast.method?.window?.label?.ar || ''}) ${m(forecast.monthlyRate)} شهرياً مقابل ${m(req.monthly)} شهرياً مطلوبة لبلوغ المستهدف في ما تبقى من الفترة.` : `Collections in the last 3 complete months (${forecast.method?.window?.label?.en || ''}) ${m(forecast.monthlyRate)} a month against ${m(req.monthly)} a month required to reach the target in the rest of the period.`)) });
  if (A && A.byClass) {
    const act = A.actionable?.remaining || 0; const aged = A.needsDecision?.remaining || 0; const blocked = A.blocked?.remaining || 0;
    facts.push({ id: 'outstanding', text: two((l, m) => (l === 'ar' ? `الرصيد القائم غير المحصّل ${m(A.remaining)}: قابل للمتابعة ${m(act)} (متأخر حتى 180 يوماً أو يستحق قبل نهاية السنة)، وأقدم من 180 يوماً ${m(aged)}، وعليه عائق قائم ${m(blocked)}. أرصدة قائمة وليست إضافة إلى التوقع.` : `Outstanding uncollected balance ${m(A.remaining)}: actionable ${m(act)} (overdue up to 180 days or falling due by year-end), older than 180 days ${m(aged)}, with a standing blocker ${m(blocked)}. Standing balances, not additions to the forecast.`)) });
    const bl = A.byClass.A?.remaining || 0;
    facts.push({ id: 'blockers', text: bl > 0 ? two((l, m) => (l === 'ar' ? `عوائق قائمة على ${m(bl)} في ${A.byClass.A.count} فاتورة (ربط غير محسوم أو غير قابلة للإحالة أو اعتراض أو أمر تنفيذ قائم).` : `Standing blockers on ${m(bl)} in ${A.byClass.A.count} invoices (unresolved linkage, not eligible for referral, an objection or an existing enforcement order).`)) : bi('لا عوائق قائمة على الرصيد.', 'No standing blockers on the balance.') });
  }
  if (F && fin(F.exclusions) && fin(F.gross) && F.gross > 0) facts.push({ id: 'exclusions', text: two((l, m) => (l === 'ar' ? `استثناءات مطبّقة على فواتير الفترة: ${m(F.exclusions)} = ${pc(F.exclusions / F.gross)} من الإجمالي${F.cancelled > 0 ? `؛ وفواتير ملغاة ${m(F.cancelled)} (${F.cancelledCount})` : ''}.` : `Exclusions applied to the period’s invoices: ${m(F.exclusions)} = ${pc(F.exclusions / F.gross)} of the gross${F.cancelled > 0 ? `; cancelled invoices ${m(F.cancelled)} (${F.cancelledCount})` : ''}.`)) });
  if (F && fin(F.fromPriorInvoices) && F.fromPriorInvoices > 0) facts.push({ id: 'prior', text: two((l, m) => (l === 'ar' ? `من المحصّل ${m(F.fromPriorInvoices)} على فواتير صادرة قبل بداية الفترة (المحصّل بتاريخ الدفع على أي فاتورة).` : `Of the collected amount, ${m(F.fromPriorInvoices)} was paid on invoices issued before the period began (collected by payment date on any invoice).`)) });
  if (F && fin(F.collectedCohort) && fin(basis.achievementToDate)) facts.push({ id: 'cohort_rate', text: bi(`نسبة التحصيل لفواتير الفترة (المحصّل ÷ صافي المفوتر) ${pc(F.collectedCohort)} — مؤشر مختلف عن نسبة تحقيق المستهدف حتى تاريخه ${pc(basis.achievementToDate)}.`, `Collection rate of the period’s invoices (collected ÷ net billed) ${pc(F.collectedCohort)} — a different indicator from the target achievement to date ${pc(basis.achievementToDate)}.`) });

  hypotheses.push({ id: 'h_scale', text: bi('فرضية: مستوى المستهدف أعلى بكثير من قاعدة الفوترة الحالية — يؤكدها مقارنة المستهدف بفوترة الفترات السابقة بعد تثبيته من الإدارة المالية.', 'Hypothesis: the level of the target is far above the current billing base — it would be confirmed by comparing it with earlier periods’ billing once Finance has confirmed the target.') });
  hypotheses.push({ id: 'h_timing', text: bi('فرضية: التأخر في السداد قد ينقل جزءاً من الإيرادات المحصلة إلى ما بعد نهاية الفترة — يؤكدها تحليل تاريخ السداد مقابل تاريخ الاستحقاق على سجل أطول.', 'Hypothesis: late payment may move part of the collections beyond the end of the period — it would be confirmed by analysing payment date against due date over a longer record.') });
  hypotheses.push({ id: 'h_aged', text: bi('فرضية: الأرصدة الأقدم من 180 يوماً قد لا تكون قابلة للتحصيل بالمتابعة العادية — يؤكدها سجل استرداد فعلي حسب عمر الرصيد (غير متوفر).', 'Hypothesis: balances older than 180 days may not be collectable by ordinary follow-up — it would be confirmed by an actual recovery record by age of balance (not available).') });
  if (basis.profile?.assumption) hypotheses.push({ id: 'h_season', text: bi('فرضية: التوزيع المتساوي للمستهدف على الأشهر قد لا يعكس موسمية التحصيل — يتحدد بتوزيع شهري يدوي تؤكده الإدارة المالية.', 'Hypothesis: the equal split of the target over the months may not reflect the seasonality of collection — it is settled by a manual monthly distribution confirmed by Finance.') });

  if (basis.profile?.assumption) missing.push({ id: 'm_plan', text: bi('توزيع شهري مؤكد من الإدارة المالية (الحالي افتراض بتوزيع متساوٍ).', 'A monthly distribution confirmed by Finance (the current one is an equal-distribution assumption).') });
  missing.push({ id: 'm_target', text: bi('تأكيد مستوى المستهدف من مالكه (الخطة المحفوظة ليست قراراً رسمياً بالمستهدف).', 'Confirmation of the target level by its owner (a saved plan is not an official decision on the target).') });
  missing.push({ id: 'm_source', text: bi('مستهدفات على مستوى مصدر الإيراد (لا تُحسب لذلك انحرافات على مستوى المصدر).', 'Targets at revenue-source level (so no source-level deviation can be computed).') });
  missing.push({ id: 'm_load', text: bi('تاريخ تحميل المدفوعات في المصدر (لاختبار التوقع على ما كان معروفاً في كل تاريخ).', 'The load date of payments in the source (to test the forecast on what was known at each date).') });
  missing.push({ id: 'm_recovery', text: bi('سجل استرداد فعلي حسب عمر الرصيد (لذلك لا يُقدَّر أثر متوقع للإجراءات).', 'An actual recovery record by age of balance (so no expected impact of the actions is estimated).') });
  if (F?.quality && (F.quality.missingFieldCount > 0 || F.quality.amountConflictCount > 0)) missing.push({ id: 'm_quality', text: bi(`جودة سجلات فواتير الفترة: ${F.quality.missingFieldCount} سجل ناقص الحقول و${F.quality.amountConflictCount} سجل بتعارض في المبالغ.`, `Quality of the period’s invoice records: ${F.quality.missingFieldCount} records with missing fields and ${F.quality.amountConflictCount} with conflicting amounts.`) });
  const u = A?.byClass?.U; if (u && u.count > 0) missing.push({ id: 'm_due', text: bi(`تاريخ استحقاق غير متاح لـ ${u.count} فاتورة.`, `The due date is unavailable for ${u.count} invoices.`) });
  if (F?.linkageUnresolved?.count > 0) missing.push({ id: 'm_link', text: two((l, m) => (l === 'ar' ? `ربط غير محسوم (عقد أو حالة المصدر) على ${m(F.linkageUnresolved.amount)} في ${F.linkageUnresolved.count} فاتورة.` : `Unresolved linkage (contract or source status) on ${m(F.linkageUnresolved.amount)} in ${F.linkageUnresolved.count} invoices.`)) });
  return { facts, hypotheses, missing, mode: above ? 'support' : 'gap', empty: false };
}
