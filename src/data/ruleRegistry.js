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
  'SND-1': {
    definition: BI('أي فاتورة في سند لها رقم تنفيذ تُستبعد مهما كانت حالة الأمر. تنطبق على غير المحصّلة فقط.', 'Any invoice in Sanad with an execution number is excluded, whatever the order status. Uncollected invoices only.'),
    sources: [BI('سند — أوامر التنفيذ', 'Sanad — enforcement orders')], fields: ['رقم التنفيذ', 'رقم الفاتورة'],
    scope: BI('كل المصادر', 'All sources'), evidence: BI('رابط تنفيذ مؤكد', 'Confirmed enforcement link')
  },
  'EXE-1': {
    definition: BI('كل مخالفة في تقرير «المنفذ ضده» (رقم التنفيذ ورقم المخالفة) تُربط بفاتورتها وتُستبعد. الاكتمال لا يؤخذ من هذا التقرير.', 'Every violation in the «executed-against» report (execution and violation numbers) is linked to its invoice and excluded. Completeness is not taken from this report.'),
    sources: [BI('إيفاء — تقرير المنفذ ضده', 'Efaa — executed-against report')], fields: ['رقم التنفيذ', 'رقم المخالفة'],
    scope: BI('الغرامات', 'Fines'), evidence: BI('سطر التقرير', 'Report row')
  },
  'OBJ-1': {
    definition: BI('المصدر: إيفاء في الشكل الحالي، وممتثل أيضًا مستقبلًا (حالة الاستئناف). تُستبعد: بانتظار توجيه العضو، بانتظار مراجعة اللجنة، مقبول جزئيًا، مكتمل مقبول. تبقى: مكتمل مرفوض.', 'Source: Efaa in the current form, Mumtathil also in future (appeal status). Excluded: awaiting the member, awaiting the committee, partly accepted, complete – accepted. Kept: complete – rejected.'),
    sources: [BI('إيفاء — حالة الاستئناف (حاليًا)', 'Efaa — appeal status (current)'), BI('ممتثل — حالة الاستئناف (مستقبلًا)', 'Mumtathil — appeal status (future)')], fields: ['رقم الاعتراض', 'حالة الاستئناف'],
    scope: BI('الغرامات', 'Fines'), evidence: BI('سجل الاعتراض وحالته', 'Objection record and its status')
  },
  'INC-1': {
    definition: BI('تقرير «إشعار المطالبة بالأداء» في إيفاء: الحالة «غير مكتمل» → يؤخذ رقم المخالفة ويُربط برقم الفاتورة وتُستبعد.', 'Efaa «payment-claim notice» report: status «incomplete» → the violation number is linked to the invoice number and the invoice is excluded.'),
    sources: [BI('إيفاء — تقرير إشعار المطالبة بالأداء', 'Efaa — payment-claim notice report')], fields: ['رقم المخالفة', 'الحالة'],
    scope: BI('الغرامات', 'Fines'), evidence: BI('سطر التقرير', 'Report row')
  },
  'EFA-1': {
    definition: BI('الجزاءات (الفئة الرئيسية الجزاءات والغرامات) ضمن غير المحصّلة التي لا تظهر في إيفاء؛ يُربط رقم إيفاء برقم الفاتورة.', 'Penalties (main class: fines and penalties) within the uncollected invoices that do not appear in Efaa; the Efaa number is linked to the invoice number.'),
    sources: [BI('المديونيات (تحصيل) مقابل قائمة إيفاء', 'Uncollected debt (Tahseel) vs the Efaa list')], fields: ['رقم المخالفة', 'الحالة في إيفاء'],
    scope: BI('الغرامات', 'Fines'), evidence: BI('نتيجة المطابقة', 'Match result')
  },
  'STY-1': {
    definition: BI('العميل ضمن قائمة قابلة للضبط (شركة المياه الوطنية والشركات الخدمية) تحت أمر عالٍ بإيقاف التنفيذ بانتظار لجنة. تسبق قاعدة «فواتير لا تستند على عقود». التسمية مؤقتة.', 'The customer is on a configurable list (the National Water Company and service companies) under a high-order stay of execution pending a committee. Takes precedence over «invoices not based on contracts». Working label.'),
    sources: [BI('قائمة الوزارة', 'Ministry list')], fields: ['العميل'],
    scope: BI('كل المصادر', 'All sources'), evidence: BI('القائمة المعتمدة', 'The approved list')
  },
  'NOC-1': {
    definition: BI('أي فاتورة، من أي أمانة أو جهة (مركزية أو داخلية)، بحساب إيراد استثماري ولا عقد لها في فرص. «عقد غير مطابق» ليس «بدون عقد».', 'Any invoice, from any Amanah or entity (central or internal), with an investment revenue account and no contract in Furas. An UNMATCHED contract is not «no contract».'),
    sources: [BI('فرص — العقود', 'Furas — contracts')], fields: ['رقم العقد', 'حالة المطابقة'],
    scope: BI('الاستثمار', 'Investment'), evidence: BI('غياب العقد في فرص', 'No contract in Furas')
  },
  'CR-1': {
    definition: BI('فاتورة بلدي مرتبطة بعرض السجل التجاري: الحالة محذوف أو ملغى → تُستبعد. تبقى الحالة الخام كما وردت.', 'Balady invoice joined with the commercial-registration view: status Deleted or Cancelled → excluded. The raw status is kept as received.'),
    sources: [BI('بلدي', 'Balady'), BI('عرض السجل التجاري', 'CR view')], fields: ['CrNo (نص)', 'Crstatus (خام)'],
    scope: BI('الفواتير المرتبطة بسجل تجاري', 'Invoices tied to a registration'), evidence: BI('رقم السجل + الحالة الخام', 'CR number + raw status')
  },
  'ENC-1': {
    definition: BI('فواتير استثمار (خارج فرص وقد تكون داخلية) تفيد بها الأمانة بمحضر تعدٍّ. تُحمَّل بقالب الرفع فقط.', 'Investment invoices (outside Furas, may be internal) reported by the Amanah with an encroachment report. Loaded through the upload template only.'),
    sources: [BI('ملف الأمانة (رفع يدوي)', 'Amanah file (manual upload)')], fields: ['رقم الفاتورة', 'الأمانة', 'سبب الاستبعاد'],
    scope: BI('الاستثمار', 'Investment'), evidence: BI('الملف المرفوع', 'The uploaded file')
  },
  'ATT-1': {
    definition: BI('إفادة الأمانة بأن الفاتورة غير قابلة للتحصيل. القناة والقالب نفسهما للتعديات.', 'The Amanah states that the invoice is not collectible. Same channel and template as encroachments.'),
    sources: [BI('ملف الأمانة (رفع يدوي)', 'Amanah file (manual upload)')], fields: ['رقم الفاتورة', 'الأمانة', 'سبب الاستبعاد'],
    scope: BI('كل المصادر', 'All sources'), evidence: BI('الملف المرفوع', 'The uploaded file')
  },
  'DUP-1': {
    definition: BI('نفس العميل والمبلغ والمنتج وحساب الإيراد وتاريخ الإصدار برقم فاتورة مختلف؛ تبقى الأقدم رقمًا. تكرار السنة التالية ليس تكرارًا.', 'Same customer, amount, product, revenue account and issue date with a different invoice number; the earliest-numbered stays. A repeat in another year is not a duplicate.'),
    sources: [BI('الكشف بالذكاء الاصطناعي', 'AI duplicate detection')], fields: ['العميل', 'المبلغ', 'المنتج', 'حساب الإيراد', 'تاريخ الإصدار'],
    scope: BI('كل مصادر الإيراد', 'All revenue sources'), evidence: BI('الفاتورتان المتطابقتان', 'The two matching invoices')
  },
  'ENF-1': {
    definition: BI('محال للتنفيذ: بُعد منفصل وليس استبعاداً. القاعدة التي تعدّ الفاتورة الملغاة في المصدر والمحالة غير محصّلة غير مطبّقة: شروطها وجهة اعتمادها غير مؤكدة، وتبقى الفاتورة ملغاة مع تعليم التعارض.', 'Referred to enforcement: a separate dimension, not an exclusion. The rule that would count a source-cancelled, referred invoice as uncollected is NOT applied: its conditions and approver are unconfirmed; the invoice stays cancelled and the disagreement is flagged.'),
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
