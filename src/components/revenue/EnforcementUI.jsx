import React from 'react';
import { useL } from '../../utils/bi';

// Shared labels and chips for enforcement orders — used by the order list, the order page and the invoice view.
export const MATCH_STATE_LABEL = {
  matched: { en: 'Fully matched', ar: 'مطابق بالكامل', cls: 'rv-cat--collected' },
  partial: { en: 'Partially matched', ar: 'مطابق جزئياً', cls: 'rv-cat--partial' },
  awaiting_review: { en: 'Awaiting review', ar: 'بانتظار المراجعة', cls: 'rv-cat--linkage_unresolved' },
  unmatched: { en: 'Not matched', ar: 'غير مطابق', cls: '' }
};
export const SUMMARY_TO_MATCH = { linked: 'matched', partial: 'partial', candidate: 'awaiting_review', ambiguous: 'awaiting_review', unresolved: 'unmatched' };
export const REASON_LABEL = {
  proposed_unconfirmed: { en: 'proposed links not yet confirmed', ar: 'روابط مقترحة لم تُؤكَّد بعد' },
  unresolved_references: { en: 'references in the order not yet accounted for', ar: 'مراجع في الأمر لم تُحسم بعد' },
  document_pages_unread: { en: 'document pages not read (no text layer)', ar: 'صفحات مستند لم تُقرأ (بلا طبقة نص)' },
  amount_short: { en: 'matched invoices total less than the order amount', ar: 'مجموع الفواتير المطابقة أقل من مبلغ الأمر' },
  amount_over: { en: 'matched invoices total more than the order amount', ar: 'مجموع الفواتير المطابقة أكثر من مبلغ الأمر' },
  amount_not_checkable: { en: 'invoice amounts not available to compare', ar: 'مبالغ الفواتير غير متاحة للمقارنة' }
};
export const ORDER_STATUS_LABEL = {
  open: { en: 'In execution', ar: 'قيد التنفيذ', cls: 'rv-cat--enforcement' },
  suspended: { en: 'Suspended', ar: 'موقوف', cls: 'rv-cat--partial' },
  closed: { en: 'Closed', ar: 'مغلق', cls: 'rv-cat--excluded' }
};
export const PAY_STATUS_LABEL = {
  collected: { en: 'Collected', ar: 'محصّلة', cls: 'rv-cat--collected' },
  partial: { en: 'Partly paid', ar: 'مدفوعة جزئياً', cls: 'rv-cat--partial' },
  overdue: { en: 'Overdue', ar: 'متأخرة', cls: 'rv-cat--overdue' },
  not_due: { en: 'Not yet due', ar: 'غير مستحقة بعد', cls: 'rv-cat--not_due' },
  cancelled: { en: 'Cancelled', ar: 'ملغاة', cls: 'rv-cat--excluded' },
  excluded: { en: 'Excluded', ar: 'مستبعدة', cls: 'rv-cat--excluded' }
};
export const LINK_STATUS_LABEL = {
  confirmed: { en: 'Confirmed', ar: 'مؤكد', cls: 'rv-cat--enforcement' },
  candidate: { en: 'Proposed — no effect yet', ar: 'مقترح — بلا أثر بعد', cls: 'rv-cat--partial' },
  rejected: { en: 'Rejected / withdrawn', ar: 'مرفوض / مسحوب', cls: 'rv-cat--excluded' }
};
export const CONFLICT_LABEL = {
  debtor_mismatch: { en: 'The invoice payer is not the order debtor', ar: 'دافع الفاتورة ليس مدين الأمر' },
  amanah_mismatch: { en: 'Different Amanah', ar: 'أمانة مختلفة' },
  linked_to_other_order: { en: 'Also linked to another order', ar: 'مرتبطة أيضاً بأمر آخر' },
  invoice_cancelled: { en: 'Invoice is cancelled', ar: 'الفاتورة ملغاة' },
  invoice_excluded: { en: 'Invoice is excluded', ar: 'الفاتورة مستبعدة' },
  invoice_collected: { en: 'Invoice already collected in full', ar: 'الفاتورة محصّلة بالكامل' },
  invoice_issued_after_order: { en: 'Invoice issued after the order opened', ar: 'الفاتورة صدرت بعد فتح الأمر' },
  ambiguous_reference: { en: 'Reference matches several invoices', ar: 'المرجع يطابق عدة فواتير' },
  document_other_order: { en: 'Found only in a document that names a different order', ar: 'وردت فقط في مستند يذكر أمراً آخر' },
  weak_reference: { en: 'Weak reference (no year / padded)', ar: 'مرجع ضعيف (بلا سنة / مُكمَّل)' }
};
export const KIND_LABEL = {
  invoice_no: { en: 'Invoice number', ar: 'رقم فاتورة' }, invoice_serial: { en: 'Invoice serial (no year)', ar: 'تسلسل فاتورة (بلا سنة)' },
  sadad_no: { en: 'SADAD number', ar: 'رقم سداد' }, violation_no: { en: 'Violation number', ar: 'رقم مخالفة' },
  contract_no: { en: 'Contract number', ar: 'رقم عقد' }, order_no: { en: 'Enforcement order number', ar: 'رقم أمر التنفيذ' },
  bank_account: { en: 'Bank account (IBAN)', ar: 'حساب بنكي (آيبان)' }, other_number: { en: 'Other number', ar: 'رقم آخر' }
};
export const SOURCE_LABEL = {
  investment: { en: 'Investment', ar: 'استثمار' }, fines: { en: 'Fines', ar: 'مخالفات' }, municipal_fees: { en: 'Municipal fees', ar: 'رسوم بلدية' },
  licenses: { en: 'Licences', ar: 'رخص' }, accommodation: { en: 'Accommodation', ar: 'إيواء' }, tobacco: { en: 'Tobacco', ar: 'تبغ' }, white_lands: { en: 'White lands', ar: 'أراضٍ بيضاء' }, furas: { en: 'Furas', ar: 'فرص' }
};

export function Chip({ def, extra = null }) {
  const { B } = useL();
  return <span className={`rv-cat ${def.cls || ''}`}>{B(def)}{extra}</span>;
}
export const MatchStateBadge = ({ state }) => <Chip def={MATCH_STATE_LABEL[state] || MATCH_STATE_LABEL.unmatched} />;
export const OrderStatusChip = ({ status }) => <Chip def={ORDER_STATUS_LABEL[status] || ORDER_STATUS_LABEL.open} />;
export const PayStatusChip = ({ status }) => (PAY_STATUS_LABEL[status] ? <Chip def={PAY_STATUS_LABEL[status]} /> : <span className="muted">—</span>);

// the dependency statement shown wherever orders are listed or opened
export function IntegrationNotice({ compact = false }) {
  const { L } = useL();
  return (
    <div className="rv-callout rv-callout--warn" role="note">
      <b>{L('Integration status.', 'حالة التكامل.')}</b>{' '}
      {L('Orders and their invoice references come from a SYNTHETIC Sanad demo feed — live Sanad retrieval is not connected. Sanad order documents cannot be fetched here: add the order PDF by hand. Only the TEXT of digital PDFs is read; no OCR engine is connected, so scanned pages need text from an external OCR tool or typed references.',
        'الأوامر ومراجع فواتيرها من تغذية تجريبية «اصطناعية» لسند — الاسترجاع الحيّ من سند غير متصل. لا يمكن جلب مستندات أوامر سند هنا: أضف ملف PDF للأمر يدوياً. يُقرأ فقط نص ملفات PDF الرقمية؛ ولا يوجد محرك OCR متصل، لذا تحتاج الصفحات الممسوحة ضوئياً إلى نص من أداة OCR خارجية أو إلى مراجع تُدخل يدوياً.')}
      {!compact && ' ' + L('Nothing below is a simulated retrieval or a simulated extraction.', 'ولا شيء أدناه استرجاع أو استخراج محاكى.')}
    </div>
  );
}
