// ============================================================================
// Exclusion-rule REGISTRY view. The rules themselves live in revenueMetrics.js
// (EXCLUSION_RULES) so the metric layer has one definition; this module adds the
// descriptive columns the brief asks for per rule: definition, source and
// required fields, effective date, approval status, scope, priority, effect on
// the metrics, evidence and review owner — plus live counts from a snapshot.
// A rule name taken from a report title is NEVER turned into an automatic rule:
// every rule needs its operating definition, and unapproved ones stay
// configurable and visibly flagged.
// ============================================================================
import { EXCLUSION_RULES } from './revenueMetrics';

const BI = (ar, en) => ({ ar, en });

export const RULE_APPROVAL_LABEL = {
  approved: BI('معتمدة', 'Approved'),
  unapproved: BI('غير معتمدة', 'Unapproved')
};

export const RULE_DETAILS = {
  'DUP-1': {
    definition: BI('الفاتورة تكرار لفاتورة مسجلة (نفس العقد/الدافع/المبلغ/الفترة) وتأكد التكرار بمراجعة.', 'The invoice duplicates a registered one (same contract/payer/amount/period) and the duplicate was confirmed by review.'),
    sources: [BI('تحصيل — تفاصيل الفواتير', 'Tahseel — invoice details')], fields: ['رقم الفاتورة', 'رقم العقد', 'الدافع', 'المبلغ', 'تاريخ الإصدار'],
    scope: BI('كل مصادر الإيراد', 'All revenue sources'), evidence: BI('بنود الفاتورتين المتطابقة + قرار المراجع', 'Matching line items of both invoices + reviewer decision')
  },
  'CR-1': {
    definition: BI('سجل تجاري حالته الخام ضمن «معامل الحالات المؤهلة» (افتراضياً Deleted/Cancelled) مع اعتماد مراجع. تبقى الحالة الخام كما وردت.', 'Commercial registration whose RAW status is in the rule parameter (default Deleted / Cancelled), with reviewer approval. The raw status is kept as received.'),
    sources: [BI('سند — تفاصيل الفواتير/المستندات', 'Sanad — invoice / document details'), BI('CR View', 'CR View')], fields: ['CrNo (نص)', 'Crstatus (خام)', 'طريقة الاستخراج', 'البند/المستند'],
    scope: BI('الفواتير المرتبطة بسجل تجاري واحد مؤكد', 'Invoices tied to ONE confirmed registration'), evidence: BI('رقم السجل + البند المستخرج منه + الحالة الخام', 'CR number + the item it was extracted from + raw status'),
    parameter: 'crStatuses'
  },
  'DEC-1': {
    definition: BI('إشارة وفاة المدين من السجل المدني مع دليل مراجَع. فئة مقترحة.', 'Civil-registry flag that the debtor is deceased, with reviewed evidence. Proposed category.'),
    sources: [BI('السجل المدني (غير متصل)', 'Civil registry (not connected)')], fields: ['هوية المدين', 'حالة الوفاة'],
    scope: BI('فواتير الأفراد', 'Individual debtors'), evidence: BI('وثيقة/استعلام + مراجعة بشرية', 'Document/lookup + human review')
  },
  'NOC-1': {
    definition: BI('فاتورة استثمارية تؤكد فرص عدم وجود عقد لها. «عقد غير مطابق» ليس «بدون عقد» ولا يُستبعد.', 'Investment invoice for which Furas confirms no contract exists. An UNMATCHED contract is not "no contract" and is never excluded.'),
    sources: [BI('فرص — العقود', 'Furas — contracts')], fields: ['رقم العقد', 'حالة المطابقة'],
    scope: BI('الاستثمار', 'Investment'), evidence: BI('تأكيد مكتوب من فرص', 'Written confirmation from Furas')
  },
  'INC-1': {
    definition: BI('المخالفة واردة في تقرير «غير المكتمل» لإيفاء؛ ولا تتحول اسم التقرير وحده إلى قاعدة آلية.', 'The violation appears in the Efaa "incomplete" report; the report name alone does not become an automatic rule.'),
    sources: [BI('إيفاء — تقرير غير المكتمل', 'Efaa — incomplete report')], fields: ['رقم المخالفة', 'الحقل الناقص'],
    scope: BI('الغرامات', 'Fines'), evidence: BI('سطر التقرير + الحقل الناقص', 'Report row + the missing field')
  },
  'EXE-1': {
    definition: BI('المدين وارد في تقرير «المنفذ ضده» وفق ضوابط القسم. لا يعني انتهاء المبلغ.', 'Debtor appears in the "executed-against" report under the department\'s controls. It does not mean the amount has ended.'),
    sources: [BI('إيفاء — تقرير المنفذ ضده', 'Efaa — executed-against report')], fields: ['رقم المخالفة', 'حالة التنفيذ'],
    scope: BI('الغرامات', 'Fines'), evidence: BI('سطر التقرير', 'Report row')
  },
  'EFA-1': {
    definition: BI('المخالفة غير موجودة في إيفاء (النظام المرجعي) وفق التعريف المعتمد. حالتا تحصيل وإيفاء تبقيان منفصلتين.', 'The violation is not found in Efaa (system of record) under the approved definition. Tahseel and Efaa statuses stay separate.'),
    sources: [BI('تحصيل — إيفاء v2', 'Tahseel — Efaa v2'), BI('إيفاء — تقرير المخالفات العام', 'Efaa — general violations report')], fields: ['رقم المخالفة', 'الحالة في تحصيل', 'الحالة في إيفاء'],
    scope: BI('الغرامات', 'Fines'), evidence: BI('نتيجة المطابقة + سبب عدم المطابقة', 'Match result + mismatch reason')
  },
  'OBJ-1': {
    definition: BI('اعتراض مفتوح على الفاتورة. حالة متابعة وليست استبعاداً ما لم تُعتمد القاعدة.', 'Open objection on the invoice. A follow-up state, not an exclusion unless the rule is approved.'),
    sources: [BI('ممتثل / نظام الاعتراضات', 'Mumtathil / objections system')], fields: ['رقم الاعتراض', 'حالته'],
    scope: BI('الغرامات', 'Fines'), evidence: BI('سجل الاعتراض', 'Objection record')
  },
  'ENF-1': {
    definition: BI('محال للتنفيذ: يُحتسب غير محصل ولا يُستبعد (قاعدة مقفلة). الفاتورة الملغاة في المصدر مع تنفيذ مرتبط تبقى غير محصلة.', 'Referred to enforcement: counted uncollected, never excluded (locked rule). A source-cancelled invoice with linked enforcement stays uncollected.'),
    sources: [BI('سند', 'Sanad')], fields: ['رقم العقد/الفاتورة', 'رقم طلب التنفيذ'],
    scope: BI('كل المصادر', 'All sources'), evidence: BI('رابط تنفيذ مؤكد', 'Confirmed enforcement link')
  }
};

export const RULE_EFFECT = BI(
  'يخفض صافي المفوتر والرصيد القائم مرة واحدة (السبب الرئيسي فقط) ويغيّر المقام لا القابلية للتحصيل',
  'Lowers net billed and net uncollected once (primary reason only); changes the denominator, not collectability'
);

export function registryRows(snapshot, cfg) {
  const cnt = snapshot.exclusionReasonCounts || {};
  const stats = snapshot.ruleStats || {};
  return EXCLUSION_RULES.map((r) => {
    const d = RULE_DETAILS[r.id] || {};
    const st = stats[r.id] || { primaryCount: 0, primaryAmount: 0, pendingCandidates: 0 };
    const secondary = (cnt[r.id] || 0) - st.primaryCount;
    return {
      ...r,
      ...d,
      enabled: !!cfg.rules[r.id],
      effect: r.locked ? BI('لا أثر: مقفلة (تُحتسب غير محصلة)', 'No effect: locked (counted uncollected)') : RULE_EFFECT,
      primaryCount: st.primaryCount,
      primaryAmount: st.primaryAmount,
      secondaryCount: Math.max(0, secondary),
      pendingCandidates: st.pendingCandidates
    };
  });
}
