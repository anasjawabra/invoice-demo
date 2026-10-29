// Presentation metadata for the current demo; never evidence of business sign-off.
import { REFERRED_CANCELLED_STAYS_BILLED, EXCLUSIONS_AUTO_APPLY } from './iim.js';

export const DEFINITION_REVIEW = {
  status: 'pending_confirmation', approver: null, approvedAt: null,
  label: { en: 'Pending business confirmation', ar: 'بانتظار تأكيد الجهة المختصة' }
};

export const CANCELLATION_POLICY = REFERRED_CANCELLED_STAYS_BILLED ? {
  en: 'Current demo policy S9: a source-cancelled invoice with an execution reference or qualifying enforcement link stays in gross billed. Its remaining balance may be excluded under SND-1 when applicable. ENF-1 itself is a locked reporting dimension, not an exclusion. Business confirmation of this treatment is pending.',
  ar: 'سياسة العرض الحالية S9: تبقى الفاتورة الملغاة في المصدر ضمن إجمالي المفوتر عند وجود مرجع تنفيذ أو رابط تنفيذ مؤهل. قد يُستبعد رصيدها المتبقي وفق SND-1 عند انطباقها. أما ENF-1 فهو بُعد عرض مقفل وليس استبعاداً. المعالجة بانتظار تأكيد الجهة المختصة.'
} : {
  en: 'Current demo policy: a source-cancelled invoice remains cancelled even when referred to enforcement; conflicting links are flagged for review. ENF-1 is a locked reporting dimension, not an exclusion. Business confirmation is pending.',
  ar: 'سياسة العرض الحالية: تبقى الفاتورة الملغاة في المصدر ملغاة ولو أُحيلت للتنفيذ، وتُعلّم الروابط المتعارضة للمراجعة. ENF-1 بُعد عرض مقفل وليس استبعاداً. السياسة بانتظار تأكيد الجهة المختصة.'
};

export const EXCLUSION_APPLICATION_POLICY = EXCLUSIONS_AUTO_APPLY ? {
  en: 'Demo assumption S6 automatically applies eligible enabled exclusion rules. Runtime rule status does not constitute formal business approval.',
  ar: 'يطبّق افتراض العرض S6 قواعد الاستبعاد المفعلة والمؤهلة تلقائياً. حالة القاعدة في الحساب لا تعني اعتماداً رسمياً من الجهة المختصة.'
} : {
  en: 'Eligible exclusion candidates require reviewer confirmation in this demo. Runtime rule status does not constitute formal business approval.',
  ar: 'تتطلب حالات الاستبعاد المؤهلة تأكيد المراجع في هذا العرض. حالة القاعدة في الحساب لا تعني اعتماداً رسمياً من الجهة المختصة.'
};
