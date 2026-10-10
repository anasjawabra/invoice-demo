// ============================================================================
// Insights derived from the shared revenue snapshot: worklists, executive
// decision cards, gap contributors, and the standard AI analysis result.
// Pure functions of a snapshot — no page may compute these separately.
//
// Every statement is tagged with its epistemic type:
//   fact        a value read from a source record
//   calculated  a value computed from facts by a stated method
//   hypothesis  a possible explanation that needs verification
//   recommendation  a proposed action (never an approved decision)
// A confirmed cause is never inferred from correlation or status alone.
// ============================================================================
import { daysBetween, REVENUE_SOURCES, DATA_CUTOFF } from './revenueLedger';
import { CATEGORY_LABELS, formatRatio, pct1, EXCLUSION_RULES, NOT_CALCULABLE_LABEL } from './revenueMetrics';
import { caseSummary } from './enforcementMatching';
import { fmtBn } from '../utils/money';
import { municipalitiesOf } from './catalog';

const cnt = (n) => Number(n || 0).toLocaleString('en-US');
export const bi = (en, ar) => ({ en, ar });
export const pickBi = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'ar' ? o.ar : o.en) || o.en || '');

// All amounts in text use ONE appropriate unit each (SAR · ألف · مليون · مليار); the stored/calculated values stay in SAR.
export const money = (n) => fmtBn(n, { lang: 'en' });
export const mAr = (n) => fmtBn(n, { lang: 'ar' });

/* ---------- Prioritisation ----------
   Weights are configuration, not truth. Priority deliberately does NOT rank by
   lowest collection percentage; it combines amount, aging, actionable
   opportunity and evidence quality. */
export const PRIORITY_WEIGHTS = { amount: 0.4, aging: 0.25, actionability: 0.25, evidence: 0.1 };

const ACTIONABILITY = {
  overdue: 1,
  partial: 0.85,
  linkage_unresolved: 0.5,
  ineligible_referral: 0.35,
  enforcement: 0.45,
  objection: 0.2,
  not_due: 0.1
};

const RECOMMENDED_STEP = {
  overdue: bi('Follow up with the payer through the Amanah revenue unit', 'المتابعة مع الدافع عبر وحدة الإيرادات في الأمانة'),
  partial: bi('Confirm the remaining balance and agree a payment date', 'تأكيد الرصيد المتبقي والاتفاق على موعد السداد'),
  linkage_unresolved: bi('Resolve the linkage/status first (contract or enforcement link), then follow up', 'حسم الربط/الحالة أولاً (العقد أو رابط الإنفاذ) ثم المتابعة'),
  ineligible_referral: bi('Complete the missing mandatory fields so the invoice becomes eligible for referral', 'استكمال الحقول الإلزامية الناقصة لتصبح الفاتورة مؤهلة للإحالة'),
  enforcement: bi('Track the confirmed enforcement case; no new collection action from this platform', 'متابعة قضية الإنفاذ المؤكدة؛ دون إجراء تحصيل جديد من هذه المنصة'),
  objection: bi('Request status of the objection from the owning unit before any follow-up', 'الاستفسار عن حالة الاعتراض من الجهة المالكة قبل أي متابعة'),
  not_due: bi('No action yet — monitor until the due date', 'لا إجراء حالياً — مراقبة حتى تاريخ الاستحقاق')
};

// Server-computed priority list (amount, aging, actionability, evidence quality) -> rows with the recommended next step.
export function worklistRows(resp) {
  return (resp?.rows || []).map((r) => ({ ...r, nextStep: RECOMMENDED_STEP[r.category] }));
}
export const ACTIONABILITY_OF = ACTIONABILITY;

const ANOMALY_TEXT = {
  amount_conflict: { severity: 3, text: bi('Invoice value and the sum of its items disagree (unresolved, not corrected).', 'قيمة الفاتورة ومجموع بنودها مختلفان (غير محسوم ولم يُصحَّح).') },
  exclusion_pending: { severity: 2, text: bi('Exclusion candidate awaiting human review; the amount stays in net billed until approved.', 'مرشح للاستبعاد بانتظار المراجعة البشرية؛ يبقى المبلغ ضمن صافي المفوتر حتى الاعتماد.') },
  missing_fields: { severity: 2, text: bi('Mandatory field(s) missing.', 'حقول إلزامية ناقصة.') },
  contract_unlinked: { severity: 2, text: bi('Investment invoice has no linked contract. Not excluded automatically — a human decision is required.', 'فاتورة استثمارية بلا عقد مرتبط. لا تُستبعد تلقائياً — يلزم قرار بشري.') },
  contract_unmatched: { severity: 2, text: bi('Contract not matched (this is not "no contract"). Kept in the base and flagged.', 'لم تتم مطابقة العقد (وليس «بدون عقد»). تبقى في الأساس وتُعلَّم.') },
  enforcement_candidate: { severity: 2, text: bi('Enforcement link proposed but not confirmed.', 'رابط إنفاذ مقترح وغير مؤكد.') },
  receipts_on_excluded: { severity: 3, text: bi('Payments recorded on an excluded invoice.', 'مدفوعات مسجلة على فاتورة مستبعدة.') }
};
export const anomalyReasonText = (code) => ANOMALY_TEXT[code]?.text || bi(code, code);

// Data-quality / anomaly worklist from the data service. Collected invoices MAY appear here (e.g. an amount conflict) but
// are labelled collected and never enter the collection worklist.
export function anomalyRows(resp) {
  return (resp?.rows || []).map((r) => {
    const reasons = (r.tags || []).filter((t) => ANOMALY_TEXT[t]).map((t) => ({ code: t, severity: ANOMALY_TEXT[t].severity, text: ANOMALY_TEXT[t].text }));
    return { id: r.id, row: r, collected: r.outstanding <= 0 && !r.exclusionAmount && r.collected > 0, excluded: r.cls === 'excluded', outstanding: r.outstanding, reasons, severity: Math.max(0, ...reasons.map((x) => x.severity)) };
  });
}

/* ---------- Gap contributors ---------- */
export function gapContributors(snapshot, by = 'amanah', limit = 5) {
  const list = by === 'source' ? snapshot.bySource : snapshot.byAmanah;
  const totalOut = snapshot.totals.outstanding;
  return list
    .filter((g) => g.outstanding > 0)
    .slice(0, limit)
    .map((g) => ({ key: g.key, label: g.label || null, outstanding: g.outstanding, share: totalOut > 0 ? g.outstanding / totalOut : 0, net: g.net, rate: g.collectedOverNet }));
}

/* ---------- Executive decision cards ---------- */
function upperBoundImpact(snapshot, amount) {
  const net = snapshot.totals.net;
  if (!(net > 0)) return { kind: 'not_calculable' };
  return {
    kind: 'upper_bound',
    pp: Math.round((amount / net) * 1000) / 10,
    method: bi(
      `Arithmetic upper bound: if ${money(amount)} were fully collected, collected ÷ net billed would rise by this many points. It is not a forecast of what will be recovered.`,
      `حد أعلى حسابي: لو حُصّل ${mAr(amount)} بالكامل لارتفع المحصّل ÷ صافي المفوتر بهذا العدد من النقاط. وهو ليس تنبؤاً بما سيُسترد.`
    )
  };
}

export function buildDecisionCards(snapshot, { enforcementCases = [], limit = 5 } = {}) {
  const cards = [];
  const nc = snapshot.noncollection;
  const T = snapshot.totals;
  const idsFor = (cat) => nc[cat].invoices;
  const maxAmount = Math.max(nc.overdue.amount, nc.partial.amount, nc.objection.amount, nc.linkage_unresolved.amount, nc.ineligible_referral.amount, nc.enforcement.amount, 1);
  const mk = (card) => {
    const score = PRIORITY_WEIGHTS.amount * (card.amount / maxAmount) + PRIORITY_WEIGHTS.aging * Math.min(1, (card.maxDaysOverdue || 0) / 180) + PRIORITY_WEIGHTS.actionability * card.actionability + PRIORITY_WEIGHTS.evidence * card.evidenceQuality;
    cards.push({ ...card, score: Math.round(score * 1000) / 1000 });
  };

  const collectibleIds = [...idsFor('overdue'), ...idsFor('partial')];
  const collectibleCount = nc.overdue.count + nc.partial.count;
  if (collectibleCount) {
    const amount = nc.overdue.amount + nc.partial.amount;
    const topPick = [nc.overdue.topAmanah, nc.partial.topAmanah].filter(Boolean).sort((x, y) => y.amount - x.amount)[0] || null;
    const topA = topPick ? topPick.label.en : null; const topAr = topPick ? topPick.label.ar : null; const topAmt = topPick?.amount || 0;
    const maxDays = Math.max(nc.overdue.maxDaysOverdue || 0, nc.partial.maxDaysOverdue || 0);
    mk({
      id: 'overdue_followup', kind: 'collection', amount, count: collectibleCount, invoiceIds: collectibleIds, maxDaysOverdue: maxDays,
      actionability: 1, evidenceQuality: 0.9,
      title: bi('Overdue and partially collected invoices', 'فواتير متأخرة أو محصّلة جزئياً'),
      gap: bi(`${money(amount)} outstanding on ${collectibleCount.toLocaleString('en-US')} invoice(s) past due; largest share in ${topA || '—'} (${money(topAmt || 0)}).`, `${mAr(amount)} متبقٍ على ${collectibleCount.toLocaleString('en-US')} فاتورة متأخرة؛ أكبر حصة في ${topAr || '—'} (${mAr(topAmt || 0)}).`),
      evidence: bi('Source facts: due date passed at the data cutoff and payments received are below the billed amount.', 'حقائق المصدر: انقضى تاريخ الاستحقاق عند قطع البيانات والمدفوعات أقل من المبلغ المفوتر.'),
      cause: { status: 'unestablished', text: bi('Why the payer has not paid is not recorded in the available data. Possible reasons (cash-flow, dispute, administrative delay) are hypotheses to verify during follow-up.', 'سبب عدم السداد غير مسجل في البيانات المتاحة. الأسباب المحتملة (سيولة، نزاع، تأخر إداري) فرضيات تُتحقق منها أثناء المتابعة.') },
      action: bi('Run a time-boxed follow-up on the listed invoices and record the payer response against each invoice.', 'تنفيذ متابعة محددة المدة للفواتير المدرجة وتسجيل استجابة الدافع على كل فاتورة.'),
      responsible: bi('Amanah revenue unit (proposed)', 'وحدة الإيرادات في الأمانة (مقترح)'),
      timeframe: bi('Within 30 days (proposed)', 'خلال 30 يوماً (مقترح)'),
      impact: upperBoundImpact(snapshot, amount),
      followUp: bi('Re-measure collected ÷ net billed and outstanding for this population after 30 days.', 'إعادة قياس المحصّل ÷ صافي المفوتر والمتبقي لهذه الفئة بعد 30 يوماً.'),
      drill: { to: '/collection' }
    });
  }

  if (nc.objection.count) {
    const ids = idsFor('objection');
    mk({
      id: 'objection', kind: 'objection', amount: nc.objection.amount, count: nc.objection.count, invoiceIds: ids, maxDaysOverdue: 0,
      actionability: 0.25, evidenceQuality: 0.8,
      title: bi('Invoices under open objection', 'فواتير قيد الاعتراض'),
      gap: bi(`${money(nc.objection.amount)} outstanding is under an open objection (${nc.objection.count.toLocaleString('en-US')} invoices).`, `${mAr(nc.objection.amount)} متبقٍ قيد اعتراض مفتوح (${nc.objection.count.toLocaleString('en-US')} فاتورة).`),
      evidence: bi('Source fact: an objection record is open for each listed invoice. The objection outcome is not in the data.', 'حقيقة من المصدر: سجل اعتراض مفتوح لكل فاتورة مدرجة. نتيجة الاعتراض غير موجودة في البيانات.'),
      cause: { status: 'confirmed', text: bi('Confirmed state: objection open. Whether the objection is valid is not established.', 'حالة مؤكدة: الاعتراض مفتوح. صحة الاعتراض غير مثبتة.') },
      action: bi('Obtain the objection status and expected decision date from the owning unit; keep the invoice in net billed unless the exclusion rule for objections is formally approved.', 'الحصول على حالة الاعتراض وتاريخ القرار المتوقع من الجهة المالكة؛ وإبقاء الفاتورة في صافي المفوتر ما لم تُعتمد رسمياً قاعدة استبعاد الاعتراضات.'),
      responsible: bi('Objection-owning unit / Ministry revenue team (proposed)', 'الجهة المالكة للاعتراضات / فريق الإيرادات بالوزارة (مقترح)'),
      timeframe: bi('Status within 14 days (proposed)', 'الحالة خلال 14 يوماً (مقترح)'),
      impact: upperBoundImpact(snapshot, nc.objection.amount),
      followUp: bi('Track the objection outcome; reclassify when decided.', 'تتبع نتيجة الاعتراض وإعادة التصنيف عند صدور القرار.'),
      drill: { to: '/noncollection' }
    });
  }

  if (nc.linkage_unresolved.count || nc.ineligible_referral.count) {
    const ids = [...idsFor('linkage_unresolved'), ...idsFor('ineligible_referral')];
    const amount = nc.linkage_unresolved.amount + nc.ineligible_referral.amount;
    mk({
      id: 'linkage', kind: 'data_gap', amount, count: nc.linkage_unresolved.count + nc.ineligible_referral.count, invoiceIds: ids, maxDaysOverdue: Math.max(nc.linkage_unresolved.maxDaysOverdue || 0, nc.ineligible_referral.maxDaysOverdue || 0),
      actionability: 0.5, evidenceQuality: 0.55,
      title: bi('Invoices blocked by missing links or mandatory data', 'فواتير معطّلة بسبب ربط أو بيانات إلزامية ناقصة'),
      gap: bi(`${money(amount)} on ${(nc.linkage_unresolved.count + nc.ineligible_referral.count).toLocaleString('en-US')} invoice(s) cannot be actioned until a contract/enforcement link or mandatory field is resolved.`, `${mAr(amount)} على ${(nc.linkage_unresolved.count + nc.ineligible_referral.count).toLocaleString('en-US')} فاتورة لا يمكن اتخاذ إجراء بشأنها حتى يُحسم ربط العقد/الإنفاذ أو حقل إلزامي.`),
      evidence: bi('Source facts: unlinked investment contract, pending enforcement candidate, or missing debtor identifier.', 'حقائق المصدر: عقد استثماري غير مرتبط أو مرشح إنفاذ معلّق أو معرّف مدين ناقص.'),
      cause: { status: 'confirmed', text: bi('Confirmed data gap. An unlinked contract is NOT a reason to exclude the invoice.', 'فجوة بيانات مؤكدة. عدم ربط العقد ليس سبباً لاستبعاد الفاتورة.') },
      action: bi('Ask the data owner (Furas for contracts, Sanad/Efaa for enforcement, source Amanah for debtor data) to resolve the listed items; review matches in the enforcement workspace.', 'مطالبة مالك البيانات (فرص للعقود، سند/إفاء للإنفاذ، الأمانة لبيانات المدين) بحسم البنود المدرجة؛ ومراجعة التطابقات في مساحة الإنفاذ.'),
      responsible: bi('Furas / Sanad / Efaa data owners and the Amanah (proposed)', 'مالكو بيانات فرص وسند وإفاء والأمانة (مقترح)'),
      timeframe: bi('Within 21 days (proposed)', 'خلال 21 يوماً (مقترح)'),
      impact: upperBoundImpact(snapshot, amount),
      followUp: bi('Count of invoices with unresolved links should fall to zero.', 'يجب أن ينخفض عدد الفواتير ذات الروابط غير المحسومة إلى الصفر.'),
      drill: { to: '/enforcement-orders' }
    });
  }

  const conflicts = snapshot.quality.amountConflicts;
  const conflictN = snapshot.quality.amountConflictCount ?? conflicts.length;
  if (conflictN) {
    const atStake = snapshot.quality.conflictAmountAtStake;
    mk({
      id: 'amount_conflicts', kind: 'data_quality', amount: atStake, count: conflictN, invoiceIds: conflicts, maxDaysOverdue: 0,
      actionability: 0.6, evidenceQuality: 0.4,
      title: bi('Invoice amounts that conflict with their line items', 'مبالغ فواتير تتعارض مع بنودها'),
      gap: bi(`${conflictN.toLocaleString('en-US')} invoice(s) with ${money(atStake)} of billed amount show an unreconciled difference between header amount and line items.`, `${conflictN.toLocaleString('en-US')} فاتورة بمبلغ ${mAr(atStake)} تظهر فرقاً غير مسوّى بين مبلغ الرأس وبنود الفاتورة.`),
      evidence: bi('Calculated check on invoices that carry line-item evidence (not all do).', 'فحص حسابي على الفواتير التي تتضمن بنوداً تفصيلية (ليست جميعها).'),
      cause: { status: 'unestablished', text: bi('Which figure is correct (header, line items, VAT basis) cannot be determined from the data.', 'تعذّر تحديد الرقم الصحيح (الرأس أو البنود أو أساس الضريبة) من البيانات.') },
      action: bi('Ask the issuing Amanah to confirm the correct amount before collection action or KPI reporting relies on it.', 'مطالبة الأمانة المُصدِرة بتأكيد المبلغ الصحيح قبل الاعتماد عليه في التحصيل أو التقارير.'),
      responsible: bi('Issuing Amanah / billing system owner (proposed)', 'الأمانة المُصدِرة / مالك نظام الفوترة (مقترح)'),
      timeframe: bi('Within 14 days (proposed)', 'خلال 14 يوماً (مقترح)'),
      impact: { kind: 'not_calculable', reason: bi('Impact depends on which amount is correct.', 'الأثر يعتمد على أي المبلغين هو الصحيح.') },
      followUp: bi('Number of unresolved amount conflicts.', 'عدد تعارضات المبالغ غير المحسومة.'),
      drill: { to: '/risk' }
    });
  }

  const pendingN = snapshot.quality.pendingExclusionCount ?? snapshot.quality.pendingExclusions.length;
  if (pendingN) {
    const ids = snapshot.quality.pendingExclusions;
    const amount = snapshot.quality.pendingExclusionAmount || 0;
    mk({
      id: 'exclusion_review', kind: 'review', amount, count: pendingN, invoiceIds: ids, maxDaysOverdue: 0,
      actionability: 0.7, evidenceQuality: 0.6,
      title: bi('Exclusion candidates awaiting review', 'مرشحو استبعاد بانتظار المراجعة'),
      gap: bi(`${money(amount)} is flagged for possible exclusion but remains in net billed until a reviewer approves it.`, `${mAr(amount)} مُعلَّم لاستبعاد محتمل ويبقى ضمن صافي المفوتر حتى يعتمده مراجع.`),
      evidence: bi('Evidence attached to each candidate; none is approved yet.', 'الدليل مرفق بكل مرشح؛ ولم يُعتمد أيٌّ منها بعد.'),
      cause: { status: 'hypothesis', text: bi('Hypothesis: debtor is deceased. Estate/heir position is not established; exclusion does not mean uncollectible.', 'فرضية: المدين متوفى. وضع التركة/الورثة غير مثبت؛ والاستبعاد لا يعني عدم القابلية للتحصيل.') },
      action: bi('Review the evidence and approve, reject or defer each candidate.', 'مراجعة الدليل واعتماد أو رفض أو تأجيل كل مرشح.'),
      responsible: bi('Revenue data steward (proposed)', 'أمين بيانات الإيرادات (مقترح)'),
      timeframe: bi('Next monthly KPI cut (proposed)', 'قبل قطع المؤشرات الشهري القادم (مقترح)'),
      impact: { kind: 'calculated_if_approved', pp: snapshot.totals.net > 0 ? Math.round((snapshot.totals.collected / (snapshot.totals.net - amount) - snapshot.totals.collected / snapshot.totals.net) * 1000) / 10 : null, method: bi('Change in collected ÷ net billed if all candidates were approved (arithmetic).', 'التغير في المحصّل ÷ صافي المفوتر لو اعتُمد جميع المرشحين (حساب).') },
      followUp: bi('Pending-exclusion count.', 'عدد الاستبعادات المعلقة.'),
      drill: { to: '/noncollection' }
    });
  }

  // Requests tied to a CONTRACT without identified invoices are a contract-level fact: their amount may be the same debt the
  // invoices already carry, so it is never added to uncollected and they do not belong in the invoice-matching backlog.
  const contractLevel = enforcementCases.filter((c) => c.contractNo && !c.links.some((l) => l.status === 'confirmed'));
  if (contractLevel.length) {
    const amount = contractLevel.reduce((s, c) => s + c.amount, 0);
    mk({
      id: 'execution_contract_level', kind: 'enforcement_followup', amount, count: contractLevel.length, invoiceIds: [], maxDaysOverdue: 0,
      actionability: 0.55, evidenceQuality: 0.6,
      title: bi('Execution requests tied to contracts, invoices not identified', 'طلبات تنفيذ مرتبطة بعقود دون تحديد الفواتير'),
      gap: bi(`${contractLevel.length} Sanad request(s) worth ${money(amount)} are linked to contracts only. This amount may be the same debt already in net uncollected, so it is NOT added to it.`, `${contractLevel.length} طلب في سند بقيمة ${mAr(amount)} مرتبط بعقود فقط. قد يمثل المبلغ المديونية نفسها الموجودة في الرصيد القائم لذا لا يُضاف إليه.`),
      evidence: bi('Source facts: request number, contract number, status and amount from Sanad; no invoice-level detail.', 'حقائق المصدر: رقم الطلب ورقم العقد والحالة والمبلغ من سند؛ دون تفاصيل على مستوى الفاتورة.'),
      cause: { status: 'confirmed', text: bi('Confirmed gap: the invoices covered by each request are not identified, and the amount is not spread across installments without evidence.', 'فجوة مؤكدة: الفواتير المشمولة بكل طلب غير محددة، ولا يُوزَّع المبلغ على الدفعات دون دليل.') },
      action: bi('Ask Sanad for the invoice or document detail behind each request, then link the invoices with evidence.', 'مطالبة سند بتفاصيل الفواتير أو المستندات خلف كل طلب ثم ربط الفواتير بالدليل.'),
      responsible: bi('Revenue analyst with the Sanad data owner (proposed)', 'محلل الإيرادات مع مالك بيانات سند (مقترح)'),
      timeframe: bi('Within 30 days (proposed)', 'خلال 30 يوماً (مقترح)'),
      impact: { kind: 'not_calculable', reason: bi('Which invoices are covered is unknown, so no impact can be stated.', 'الفواتير المشمولة غير معروفة لذا لا يمكن ذكر أثر.') },
      followUp: bi('Number of requests with identified invoices.', 'عدد الطلبات ذات الفواتير المحددة.'),
      drill: { to: '/contracts' }
    });
  }

  const pendingCases = enforcementCases.filter((c) => !(c.contractNo && !(c.refs || []).length && !c.links.length) && ['unresolved', 'candidate', 'ambiguous', 'partial'].includes(caseSummary(c).state)); // contract-level requests without identified invoices have their own card below
  if (pendingCases.length) {
    const amount = pendingCases.reduce((s, c) => s + c.amount, 0);
    mk({
      id: 'enforcement_matching', kind: 'matching', amount, count: pendingCases.length, invoiceIds: [], maxDaysOverdue: 0,
      actionability: 0.6, evidenceQuality: 0.45,
      title: bi('Enforcement orders not fully matched to invoices', 'أوامر إنفاذ غير مطابقة بالكامل مع الفواتير'),
      gap: bi(`${pendingCases.length} enforcement order(s) worth ${money(amount)} are not fully matched to invoices (no confirmed link, or only some of the order's invoices / amount), so their recoveries cannot yet be tied to receivables.`, `${pendingCases.length} أمر إنفاذ بقيمة ${mAr(amount)} غير مطابق بالكامل مع الفواتير (لا رابط مؤكد، أو فواتير/مبلغ جزئي فقط)، لذا لا يمكن بعد ربط متحصلاتها بالمستحقات.`),
      evidence: bi('Source facts: case numbers and amounts (illustrative). Candidate matches need human confirmation.', 'حقائق المصدر: أرقام القضايا ومبالغها (توضيحية). المطابقات المقترحة تحتاج تأكيداً بشرياً.'),
      cause: { status: 'confirmed', text: bi('Confirmed gap: no reviewed link. Not evidence of non-payment by itself.', 'فجوة مؤكدة: لا يوجد ربط مراجَع. وهي ليست دليلاً على عدم السداد بحد ذاتها.') },
      action: bi('Review candidate matches case by case; keep ambiguous cases unresolved until evidence is added.', 'مراجعة المطابقات المقترحة حالة بحالة؛ وإبقاء الحالات الملتبسة غير محسومة حتى إضافة دليل.'),
      responsible: bi('Revenue analyst with Sanad data owner (proposed)', 'محلل الإيرادات مع مالك بيانات سند (مقترح)'),
      timeframe: bi('Within 30 days (proposed)', 'خلال 30 يوماً (مقترح)'),
      impact: { kind: 'not_calculable', reason: bi('Recovery depends on case outcomes, not on linking itself.', 'الاسترداد يعتمد على نتائج القضايا وليس على الربط نفسه.') },
      followUp: bi('Number of cases with a confirmed link; unallocated case amount.', 'عدد القضايا ذات الرابط المؤكد؛ والمبلغ غير المخصص.'),
      drill: { to: '/enforcement-orders' }
    });
  }

  return cards.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ---------- Standard analysis result ---------- */
export const ASSERTION_TYPES = ['fact', 'calculated', 'hypothesis', 'recommendation'];

function indicator(label, value, kind = 'calculated', note = null) {
  return { label, value, kind, note };
}

export function describeScope(scope, lang = 'en') {
  const a = scope.amanah === 'all' ? (lang === 'ar' ? 'جميع الأمانات' : 'All Amanahs') : Array.isArray(scope.amanah) ? scope.amanah.join(', ') : scope.amanah;
  const s = scope.source === 'all' ? (lang === 'ar' ? 'جميع مصادر الإيراد' : 'All revenue sources') : (REVENUE_SOURCES[scope.source]?.[lang === 'ar' ? 'ar' : 'en'] || scope.source);
  const ar = lang === 'ar';
  const extra = [];
  if (scope.scopeType && scope.scopeType !== 'all') extra.push(scope.scopeType === 'internal' ? (ar ? 'داخلي' : 'Internal') : (ar ? 'مركزي' : 'Central'));
  if (scope.muni && scope.muni !== 'all') { const [ent] = String(scope.muni).split('|'); const m = municipalitiesOf(ent).find((x) => x && x.key === scope.muni); extra.push(m ? (ar ? m.ar : m.en) : scope.muni); }
  return `${scope.from} → ${scope.to} · ${a} · ${s}${extra.length ? ` · ${extra.join(' · ')}` : ''}`;
}

export function buildAnalysisResult(kind, { snapshot, bridge = null, references = [], forecast = null, targetPos = null, coverage = null, achievement = null, cards = [], enforcementCases = [], invoiceId = null, limitations = [] }) {
  const T = snapshot.totals;
  const q = snapshot.quality;
  const qn = { pending: q.pendingExclusionCount ?? q.pendingExclusions.length, conflicts: q.amountConflictCount ?? q.amountConflicts.length, contract: q.contractIssueCount ?? q.contractIssues.length, missing: q.missingFieldCount ?? q.missingFieldRecords.length };
  const sample = (arr, n) => `${arr.slice(0, 6).join(', ')}${n > 6 ? ` …(+${(n - 6).toLocaleString('en-US')})` : ''}`;
  const sampleAr = (arr, n) => `${arr.slice(0, 6).join('، ')}${n > 6 ? ` …(+${(n - 6).toLocaleString('en-US')})` : ''}`;
  const nc = snapshot.noncollection;
  const out = {
    kind,
    cutoff: snapshot.cutoff,
    scope: snapshot.scope,
    ruleSet: snapshot.ruleSetVersion,
    provenance: bi('Illustrative demo data — not production figures.', 'بيانات توضيحية للعرض — وليست أرقام إنتاج.'),
    indicators: [],
    references: [],
    confirmed: [],
    hypotheses: [],
    missing: [],
    recommendations: [],
    assumptions: [],
    limitations: [...limitations],
    links: []
  };

  out.indicators.push(
    indicator(bi('Gross billed', 'إجمالي المفوتر'), money(T.gross), 'calculated'),
    indicator(bi('Exclusions (deducted once)', 'الاستبعادات (تُخصم مرة واحدة)'), money(T.exclusions), 'calculated', bi(`Cancelled ${money(T.cancelled)} (${cnt(T.cancelledCount)}) + approved rules ${money(T.exclusionsRules)} (${cnt(T.excludedCount)}); not "uncollectible"${snapshot.unapprovedRulesApplied.length ? `; ${money(T.exclusionsUnapproved)} rests on UNAPPROVED rules` : ''}`, `ملغى ${mAr(T.cancelled)} (${cnt(T.cancelledCount)}) + قواعد معتمدة ${mAr(T.exclusionsRules)} (${cnt(T.excludedCount)})؛ ليست "غير قابلة للتحصيل"${snapshot.unapprovedRulesApplied.length ? `؛ منها ${mAr(T.exclusionsUnapproved)} وفق قواعد غير معتمدة` : ''}`)),
    indicator(bi('Net billed', 'صافي المفوتر'), money(T.net), 'calculated', bi('Gross billed − exclusions', 'إجمالي المفوتر − الاستبعادات')),
    indicator(bi('Collected (within net billed)', 'المحصّل (ضمن صافي المفوتر)'), money(T.collected), 'calculated'),
    indicator(bi('Uncollected', 'غير المحصّل'), money(T.outstanding), 'calculated', bi('Net billed − collected', 'صافي المفوتر − المحصّل')),
    indicator(bi('Net uncollected (standing balance at the cutoff)', 'الرصيد القائم (الرصيد القائم عند القطع)'), money(snapshot.stock.netUncollected), 'calculated', bi(`Overdue ${money(snapshot.stock.overdue)} · not yet due ${money(snapshot.stock.notYetDue)}. Different from net billed.`, `متأخر ${mAr(snapshot.stock.overdue)} · لم يحن ${mAr(snapshot.stock.notYetDue)}. يختلف عن صافي المفوتر.`)),
    indicator(bi('Collection rate', 'نسبة التحصيل'), formatRatio(T.collectedOverNet), 'calculated', bi('Collected ÷ net billed × 100', 'المحصّل ÷ صافي المفوتر × 100')),
    indicator(bi('Received in period (all invoice periods)', 'المقبوض خلال الفترة (جميع فترات الإصدار)'), money(snapshot.receivedInPeriod.total), 'calculated', bi('Different population from "Collected"', 'مجتمع مختلف عن "المحصّل"'))
  );

  const ratioTxt = formatRatio(T.collectedOverNet);
  out.executiveSummary = bi(
    `For ${describeScope(snapshot.scope, 'en')} (data to ${snapshot.cutoff}): gross billed ${money(T.gross)} = exclusions ${money(T.exclusions)} (cancelled ${money(T.cancelled)} + rules ${money(T.exclusionsRules)}) + net billed ${money(T.net)}; net billed = collected ${money(T.collected)} + uncollected ${money(T.outstanding)} (collection rate ${ratioTxt}). Net uncollected at the cutoff is ${money(snapshot.stock.netUncollected)} (a standing balance, not the same as net billed).`,
    `لنطاق ${describeScope(snapshot.scope, 'ar')} (بيانات حتى ${snapshot.cutoff}): إجمالي المفوتر ${mAr(T.gross)} = الاستبعادات ${mAr(T.exclusions)} (ملغى ${mAr(T.cancelled)} + قواعد ${mAr(T.exclusionsRules)}) + صافي المفوتر ${mAr(T.net)}؛ وصافي المفوتر = المحصّل ${mAr(T.collected)} + غير المحصّل ${mAr(T.outstanding)} (نسبة التحصيل ${ratioTxt}). الرصيد القائم عند القطع ${mAr(snapshot.stock.netUncollected)} (رصيد قائم وليس هو صافي المفوتر).`
  );

  // Confirmed (source facts / calculated states)
  for (const cat of ['overdue', 'partial', 'objection', 'enforcement', 'linkage_unresolved', 'ineligible_referral', 'not_due']) {
    if (nc[cat].count) out.confirmed.push({ kind: 'calculated', text: bi(`${CATEGORY_LABELS[cat].en}: ${cnt(nc[cat].count)} invoice(s), ${money(nc[cat].amount)} outstanding.`, `${CATEGORY_LABELS[cat].ar}: ${cnt(nc[cat].count)} فاتورة، ${mAr(nc[cat].amount)} متبقٍ.`), invoices: nc[cat].invoices });
  }
  for (const [cat, e] of Object.entries(snapshot.exclusionsByCategory)) {
    out.confirmed.push({ kind: 'calculated', text: bi(`Excluded under an approved rule (${cat.replace(/_/g, ' ')}): ${cnt(e.count)} invoice(s), ${money(e.amount)} — removed from the KPI denominator, not declared uncollectible.`, `مستبعد وفق قاعدة معتمدة (${cat}): ${cnt(e.count)} فاتورة، ${mAr(e.amount)} — خارج مقام المؤشر ولا يُعدّ غير قابل للتحصيل.`), invoices: e.invoices });
  }
  if (bridge) {
    const step = (k) => bridge.steps.find((x) => x.key === k);
    const rep = step('report'); const rec = step('reconciliation'); const can = step('cancelled'); const exc = step('excluded');
    out.bridge = bridge;
    out.confirmed.push({ kind: 'calculated', text: bi(
      `Net-uncollected bridge: unpaid report ${money(rep.amount)} → reconciliation differences ${money(rec.amount)} → cancelled ${money(can.amount)} → excluded (non-overlapping) ${money(exc.amount)}${step('newInvoices').amount ? ` → issued after the report +${money(step('newInvoices').amount)}` : ''}${step('internal').amount ? ` → internal scope +${money(step('internal').amount)}` : ''} = ${money(bridge.net)}.`,
      `جسر الرصيد القائم: تقرير غير المسدد ${mAr(rep.amount)} ← فروقات المطابقة ${mAr(rec.amount)} ← الملغى ${mAr(can.amount)} ← المستبعد (دون تداخل) ${mAr(exc.amount)}${step('newInvoices').amount ? ` ← صادر بعد التقرير +${mAr(step('newInvoices').amount)}` : ''}${step('internal').amount ? ` ← النطاق الداخلي +${mAr(step('internal').amount)}` : ''} = ${mAr(bridge.net)}.`), invoices: [] });
    if (can.detail?.overlapCount) out.confirmed.push({ kind: 'calculated', text: bi(`${cnt(can.detail.overlapCount)} cancelled invoice(s) also carry an exclusion reason (${money(can.detail.overlapNotDeductedAgain)}): deducted once, as cancelled.`, `${cnt(can.detail.overlapCount)} فاتورة ملغاة لها سبب استبعاد أيضاً (${mAr(can.detail.overlapNotDeductedAgain)}): تُخصم مرة واحدة كملغاة.`), invoices: [] });
    if (bridge.unmatched.count) out.missing.push({ kind: 'fact', text: bi(`${cnt(bridge.unmatched.count)} unpaid-report invoice(s) worth ${money(bridge.unmatched.amount)} could not be matched to the details report. They are listed apart and are neither deducted nor added to the net.`, `${cnt(bridge.unmatched.count)} فاتورة في تقرير غير المسدد بقيمة ${mAr(bridge.unmatched.amount)} لم تُطابق مع بيان التفاصيل. تُعرض منفصلة ولا تُخصم ولا تُضاف إلى الصافي.`), invoices: [] });
  }
  if (snapshot.unapprovedRulesApplied.length) out.missing.push({ kind: 'fact', text: bi(`Exclusions of ${money(T.exclusionsUnapproved)} (invoices issued in the period) rest on rules that are NOT approved (${snapshot.unapprovedRulesApplied.join(', ')}); they are configurable and the figures are shown as unapproved.`, `استبعادات بقيمة ${mAr(T.exclusionsUnapproved)} (فواتير صادرة في الفترة) تستند إلى قواعد غير معتمدة (${snapshot.unapprovedRulesApplied.join('، ')})؛ وهي قابلة للضبط وتُعرض الأرقام بوصفها غير معتمدة.`), invoices: [] });
  out.references = references.slice(0, 8).filter((d) => d.outstanding > 0).map((d) => ({ invoiceId: d.id, outstanding: d.outstanding, category: d.category || d.cls }));

  // Hypotheses (never presented as findings)
  if (nc.overdue.count + nc.partial.count) out.hypotheses.push({ kind: 'hypothesis', text: bi('Overdue balances may reflect payer cash-flow or administrative delay; the data records no reason for non-payment, so this needs verification during follow-up.', 'قد تعكس الأرصدة المتأخرة ضعف سيولة لدى الدافع أو تأخراً إدارياً؛ لا تسجل البيانات سبب عدم السداد لذا يلزم التحقق أثناء المتابعة.') });
  if (qn.pending) out.hypotheses.push({ kind: 'hypothesis', text: bi(`${qn.pending.toLocaleString('en-US')} pending exclusion candidate(s) rest on a hypothesis (e.g. deceased debtor) that has not been reviewed.`, `${qn.pending} مرشح استبعاد معلق يستند إلى فرضية (مثل وفاة المدين) لم تُراجَع بعد.`) });

  // Missing data & conflicts
  if (qn.conflicts) out.missing.push({ kind: 'fact', text: bi(`${qn.conflicts.toLocaleString('en-US')} invoice(s) have header amounts that conflict with line items (${sample(q.amountConflicts, qn.conflicts)}); the correct amount is unresolved and is NOT adjusted in these figures.`, `${qn.conflicts.toLocaleString('en-US')} فاتورة يتعارض مبلغها مع بنودها (${sampleAr(q.amountConflicts, qn.conflicts)})؛ المبلغ الصحيح غير محسوم ولم يُعدَّل في هذه الأرقام.`), invoices: q.amountConflicts });
  if (qn.contract) out.missing.push({ kind: 'fact', text: bi(`${qn.contract.toLocaleString('en-US')} investment invoice(s) have no matched contract (${sample(q.contractIssues, qn.contract)}). They are not excluded.`, `${qn.contract.toLocaleString('en-US')} فاتورة استثمارية بلا عقد مطابق (${sampleAr(q.contractIssues, qn.contract)}). لم تُستبعد.`), invoices: q.contractIssues });
  if (qn.missing) out.missing.push({ kind: 'fact', text: bi(`Mandatory fields missing on ${qn.missing.toLocaleString('en-US')} invoice(s) (${sample(q.missingFieldRecords, qn.missing)}).`, `حقول إلزامية ناقصة في ${qn.missing.toLocaleString('en-US')} فاتورة (${sampleAr(q.missingFieldRecords, qn.missing)}).`), invoices: q.missingFieldRecords });
  out.missing.push({ kind: 'fact', text: bi('All records are demo data standing in for periodic report uploads / feeds from Tahseel, Furas, Sanad, Efaa and CR View; they are not the Ministry\'s actual figures. The accommodation, tobacco and white-lands sources are synthetic too, built from the column structure of their schema files (no real rows were available); their value patterns are documented demo assumptions.', 'جميع السجلات بيانات تجريبية تحل محل الرفع الدوري للتقارير أو التغذية من تحصيل وفرص وسند وإيفاء وCR View؛ وليست أرقام الوزارة الفعلية. مصادر الإيواء والتبغ والأراضي البيضاء اصطناعية أيضاً، مبنية على أعمدة ملفات مخططاتها (لا صفوف حقيقية)، وأنماط قيمها افتراضات تجريبية موثقة.') });
  if (T.exclusions > 0 && snapshot.config.graceDays === 0) out.missing.push({ kind: 'fact', text: bi('Grace-period treatment is unresolved; overdue status uses 0 grace days.', 'معاملة فترة السماح غير محسومة؛ تعتمد حالة التأخر على 0 يوم سماح.'), invoices: [] });

  // Recommendations (from decision cards)
  for (const c of cards.slice(0, 4)) out.recommendations.push({ kind: 'recommendation', text: bi(`${c.title.en}: ${c.action.en} Responsible: ${c.responsible.en}. Timeframe: ${c.timeframe.en}.`, `${c.title.ar}: ${c.action.ar} المسؤول: ${c.responsible.ar}. الإطار الزمني: ${c.timeframe.ar}.`), impact: c.impact, cardId: c.id });

  out.assumptions.push(
    bi(`Exclusion rule set: ${snapshot.ruleSetVersion}. Only approved exclusions under enabled rules reduce net billed.`, `مجموعة قواعد الاستبعاد: ${snapshot.ruleSetVersion}. فقط الاستبعادات المعتمدة وفق قواعد مفعّلة تخفض صافي المفوتر.`),
    bi('Collected counts payments up to the data cutoff on invoices issued in the period; receipts on earlier invoices appear only in "Received in period".', 'يحتسب المحصّل المدفوعات حتى قطع البيانات على فواتير صادرة في الفترة؛ أما المقبوضات على فواتير أقدم فتظهر فقط في "المقبوض خلال الفترة".')
  );
  out.limitations.push(bi('Demo data (generated, labelled "تجريبية"); patterns are illustrative, not findings about real Amanahs.', 'بيانات تجريبية (مولّدة وموسومة "تجريبية")؛ الأنماط توضيحية وليست نتائج عن أمانات حقيقية.'));

  if (forecast) {
    if (forecast.ready) {
      out.indicators.push(indicator(bi('Independent forecast: remaining-year receipts', 'التنبؤ المستقل: مقبوضات المتبقي من السنة'), money(forecast.fiscalYear.projectedRemainder), 'calculated', bi('Trend method; indicative range only', 'طريقة الاتجاه؛ نطاق إرشادي فقط')));
      out.limitations.push(...forecast.limitations);
      out.assumptions.push(...forecast.assumptions);
    } else out.missing.push({ kind: 'fact', text: forecast.reasonNotReady, invoices: [] });
  }
  if (targetPos?.annualTarget != null && targetPos.projectedTotal != null) {
    out.indicators.push(indicator(bi('Approved annual target (demo input)', 'المستهدف السنوي المعتمد (مُدخل توضيحي)'), money(targetPos.annualTarget), 'fact', bi('Target is an input; forecast is independent', 'المستهدف مُدخل؛ والتنبؤ مستقل')));
  }
  if (achievement) out.indicators.push(indicator(bi('Target achievement (receipts YTD ÷ cumulative target)', 'تحقيق المستهدف (المقبوضات ÷ المستهدف التراكمي)'), formatRatio(achievement.achievement), 'calculated'));
  if (coverage) out.indicators.push(indicator(bi('Coverage of chapters 1–3 (own denominator)', 'تغطية الأبواب 1–3 (مقام مستقل)'), formatRatio(coverage.coverage), 'calculated', bi('Eligibility and transfer rules unresolved', 'قواعد الأهلية والمناقلة غير محسومة')));

  out.links = [{ to: '/noncollection', label: bi('Noncollection & exclusions', 'عدم التحصيل والاستبعادات') }, { to: '/invoices', label: bi('Invoice library', 'سجل الفواتير') }];
  if (invoiceId) out.links.unshift({ to: `/invoices/${encodeURIComponent(invoiceId)}`, label: bi(`Invoice ${invoiceId}`, `الفاتورة ${invoiceId}`) });
  return out;
}

export { NOT_CALCULABLE_LABEL, EXCLUSION_RULES, pct1, DATA_CUTOFF, daysBetween };
