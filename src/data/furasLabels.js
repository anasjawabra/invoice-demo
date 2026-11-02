// Display wording of STORED values in the Furas dataset mode. The stored value is never changed or reinterpreted:
//   · English: the value as stored
//   · Arabic: a LITERAL translation of the words of the stored value (not a business meaning) — the stored value stays available beside it (hover, filter option)
//   · a value without an entry is shown exactly as stored (nothing is invented)
const T = {
  type: {
    'Investment opportunity': 'فرصة استثمارية', 'Telecom Tower Rental': 'تأجير أبراج الاتصالات', 'Temporary Rental': 'تأجير مؤقت', 'Direct Rental Opportunity': 'فرصة تأجير مباشر', 'Direct Rental Request': 'طلب تأجير مباشر', 'Seasonal Temporary Rental': 'تأجير مؤقت موسمي'
  },
  status: { // OPPORTUNITYSTATUS (spelling variants of the source are kept as separate stored values)
    'Contract-Approved': 'عقد — معتمد', 'ContractExtension-Approved': 'تمديد العقد — معتمد', 'ContractExtention-Approved': 'تمديد العقد — معتمد', 'Contract-ExtentionApproved': 'تمديد العقد — معتمد', 'ContractAddendum-Approved': 'ملحق العقد — معتمد',
    'Contract-Assigned': 'عقد — مُسنَد', 'Contract-Suspended': 'عقد — موقوف', 'Contract-Updated': 'عقد — محدَّث', 'Contract-Rejected': 'عقد — مرفوض', 'Contract-Deleted': 'عقد — محذوف', 'Linked': 'مرتبط',
    'Contract-BreachedPayment': 'عقد — إخلال بالدفع', 'Contract-PaymentBreached': 'عقد — إخلال بالدفع', 'Resolved-BreachedPayment': 'تمت المعالجة — إخلال بالدفع',
    'Resolved-CancelledByOfficer': 'تمت المعالجة — ألغاه الموظف', 'Resolved-TerminatedByInvestor': 'تمت المعالجة — أنهاه المستثمر', 'Resolved-TerminatedByOfficer': 'تمت المعالجة — أنهاه الموظف'
  },
  rental: { 'started': 'بدأ', 'finished': 'انتهى', 'prepare-to-start': 'تهيئة للبدء', 'prepare-to-finish': 'تهيئة للانتهاء' },
  renewal: { 'Renewed': 'مُجدَّد', 'Started': 'بدأ' },
  payStatus: { // BATCHSTATUS
    'Paid': 'مدفوعة', 'New': 'جديدة', 'Default': 'تقصير', 'Suspend': 'موقوفة', 'Unpaid': 'غير مدفوعة', 'In Progress': 'قيد التنفيذ', 'Cancelled': 'مُلغاة',
    'Invoice canceled due to contract termination': 'فاتورة مُلغاة بسبب إنهاء العقد', 'Invoice canceled due to contract cancellation': 'فاتورة مُلغاة بسبب إلغاء العقد',
    'Cancel-Regenerated': 'إلغاء — أُعيد إنشاؤها', 'Cancel-PaymentFromTanfeeth': 'إلغاء — دفع عبر تنفيذ'
  }
};
export const STORED_KINDS = Object.keys(T);
// → { text, raw, translated }
export function stored(kind, value, ar) {
  const raw = value == null ? '' : String(value); const t = ar ? T[kind]?.[raw] : null;
  return { text: t || raw, raw, translated: !!t };
}
export const storedText = (kind, value, ar) => stored(kind, value, ar).text;
// filter option text: Arabic shows the translation with the stored value beside it, so the choice stays unambiguous
export const storedOption = (kind, value, ar) => { const s = stored(kind, value, ar); return s.translated ? `${s.text} (${s.raw})` : s.raw; };
export const LITERAL_NOTE = { ar: 'الأسماء ترجمة حرفية لألفاظ القيمة المخزنة وليست تفسيراً لمعناها في الأعمال؛ والقيمة المخزنة تظهر عند التمرير أو بجانب الخيار.', en: 'Names are shown as stored.' };
