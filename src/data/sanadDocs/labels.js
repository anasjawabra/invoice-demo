// Fixed wording of the Sanad document workflow (Arabic first, English beside it). Every text that tells the reader what is simulated lives here, so the UI and the tests share it.
export const SIM_LABEL = { ar: 'محاكاة OCR — بيانات تجريبية', en: 'OCR simulation — synthetic demo data' };
export const SIM_EXPLAIN = {
  ar: 'النتائج المعروضة مخرجات مُعدّة مسبقاً لمستندات تجريبية؛ لم يقرأ النظام أي ملف مرفوع. لا يوجد محرك OCR متصل، والقيم المستخرجة لا تُغيّر سجل سند المصدر.',
  en: 'The results shown are PREDEFINED outputs for synthetic documents; the system did not read any uploaded file. No OCR engine is connected, and the extracted values do not change the source Sanad record.'
};
export const DOC_MARK = 'مستند تجريبي — غير رسمي';
export const DOC_MARK_EN = 'Synthetic document — unofficial';
export const MISSING_DOC_FLAG = { ar: 'مستند سند غير متوفر', en: 'Sanad document not available' };
export const MISSING_IN_DOC = { ar: 'غير موجود في المستند', en: 'Not found in the document' };
export const SECTION_TITLE = { ar: 'مستند سند', en: 'Sanad document' };
export const EXTRACT_ACTION = { ar: 'استخراج البيانات', en: 'Extract data' };

export const STATE_LABEL = {
  missing: { ar: 'مستند سند غير متوفر', en: 'Sanad document not available', cls: 'rv-tag--bad' },
  attached: { ar: 'مستند مرفق — لم تُستخرج بياناته', en: 'Document attached — not extracted yet', cls: '' },
  extracted: { ar: 'تم الاستخراج — بانتظار المراجعة', en: 'Extracted — awaiting review', cls: 'rv-tag--warn' },
  under_review: { ar: 'قيد المراجعة', en: 'Under review', cls: 'rv-tag--warn' },
  reviewed: { ar: 'تمت المراجعة', en: 'Reviewed', cls: 'rv-tag--ok' },
  failed: { ar: 'فشل الاستخراج', en: 'Extraction failed', cls: 'rv-tag--bad' }
};
export const FIELD_STATUS_LABEL = {
  extracted: { ar: 'مستخرج', en: 'Extracted', cls: '' },
  uncertain: { ar: 'غير مؤكد', en: 'Uncertain', cls: 'rv-tag--warn' },
  missing: { ar: 'غير موجود في المستند', en: 'Not found in the document', cls: 'rv-tag--warn' },
  conflict: { ar: 'تعارض مع سند', en: 'Conflicts with Sanad', cls: 'rv-tag--bad' },
  confirmed: { ar: 'معتمد', en: 'Confirmed', cls: 'rv-tag--ok' },
  corrected: { ar: 'مُصحَّح', en: 'Corrected', cls: 'rv-tag--ok' },
  rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'rv-tag--bad' }
};
export const ORIGIN_LABEL = {
  structured: { ar: 'المصدر المهيكل (سند)', en: 'Structured source (Sanad)' },
  document: { ar: 'استخراج من المستند', en: 'Document extraction' },
  reviewer: { ar: 'المراجع', en: 'Reviewer' }
};
export const ERROR_LABEL = {
  not_a_scenario_document: {
    ar: 'الاستخراج المحاكى يحتاج مستنداً تجريبياً من السيناريوهات المقدَّمة. هذا الملف ليس أحدها، فلم تُنتج أي قيمة: لم يقرأ النظام الملف. أرفق مستنداً تجريبياً من القائمة.',
    en: 'Simulated extraction needs a synthetic scenario document that this demo provides. This file is not one of them, so NO value was produced: the system did not read the file. Attach a synthetic document from the list instead.'
  },
  unknown_provider: { ar: 'مزوّد الاستخراج غير مسجّل.', en: 'The extraction provider is not registered.' },
  no_document: { ar: 'لا مستند مرفق بهذا السجل.', en: 'No document is attached to this record.' },
  page_unreadable: { ar: 'تعذّرت قراءة صفحة من المستند.', en: 'A page of the document could not be read.' },
  provider_error: { ar: 'تعذّر الاستخراج.', en: 'Extraction failed.' }
};
export const REVIEW_ERROR = {
  reviewer_required: { ar: 'يلزم اسم المراجع.', en: 'A reviewer name is required.' },
  unknown_field: { ar: 'حقل غير معروف.', en: 'Unknown field.' },
  nothing_to_confirm: { ar: 'لا قيمة مستخرجة لاعتمادها: صحّح القيمة يدوياً.', en: 'There is no extracted value to confirm: correct it by hand.' },
  note_required: { ar: 'اكتب سبب القرار.', en: 'A reason is required.' },
  value_required: { ar: 'أدخل القيمة المصحّحة.', en: 'Enter the corrected value.' },
  invalid_value: { ar: 'القيمة غير صالحة لهذا الحقل.', en: 'The value is not valid for this field.' },
  no_extraction: { ar: 'لا استخراج مكتمل لهذا المستند.', en: 'There is no completed extraction for this document.' },
  unknown_action: { ar: 'إجراء غير معروف.', en: 'Unknown action.' }
};
REVIEW_ERROR.storage_failed = { ar: 'تعذّر على المتصفح حفظ القرار.', en: 'The browser could not store the decision.' };
