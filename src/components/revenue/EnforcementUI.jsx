import React from 'react';
import { useL } from '../../utils/bi';

// Shared labels and chips for enforcement orders — used by the order list, the order page and the invoice view.
export const CURRENT_ENFORCEMENT_LABEL = {
  in_execution: { en: 'An order is in execution', ar: 'أمر قيد التنفيذ الآن', cls: 'rv-cat--enforcement' },
  suspended: { en: 'Only suspended orders — not proceeding', ar: 'أوامر موقوفة فقط — غير ماضية', cls: 'rv-cat--partial' },
  none: { en: 'No open order', ar: 'لا أمر مفتوح', cls: '' }
};
export const ORDER_STATUS_LABEL = {
  open: { en: 'In execution', ar: 'قيد التنفيذ', cls: 'rv-cat--enforcement' },
  suspended: { en: 'Suspended (not proceeding)', ar: 'موقوف (غير ماضٍ)', cls: 'rv-cat--partial' },
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

// the enforcement status of an invoice, shown as separate facts: CURRENT (open order now) and HISTORICAL (ever referred — stays true after an order closes)
export function EnforcementChips({ enf }) {
  const { L } = useL();
  return (
    <>
      <Chip def={CURRENT_ENFORCEMENT_LABEL[enf.current]} />
      {enf.referredEver
        ? <span className="rv-cat rv-cat--linkage_unresolved" title={L('Referred to enforcement at least once (confirmed link) — remains true after the order closes', 'أُحيلت إلى التنفيذ مرة على الأقل (رابط مؤكد) — وتبقى هذه الحقيقة بعد إغلاق الأمر')}>{L(`Referred before · ${enf.confirmed.length} order(s)`, `سبقت إحالتها · ${enf.confirmed.length} أمر`)}</span>
        : <span className="rv-cat">{L('Never referred', 'لم تُحَل إلى التنفيذ')}</span>}
      {enf.proposed.length > 0 && <span className="rv-tag rv-tag--warn">{L(`${enf.proposed.length} proposed link(s) — no effect`, `${enf.proposed.length} رابط مقترح — بلا أثر`)}</span>}
    </>
  );
}

// the three completeness states in one compact cell — each its own line, never merged into a single label
export function CompletenessMarks({ comp }) {
  const { L } = useL();
  const m = (ok, text) => <div className={ok ? 'rp-ok' : 'rp-warn'} style={{ fontSize: 12 }}>{ok ? '✓' : '!'} {text}</div>;
  return (
    <div>
      {m(comp.references.state === 'complete', comp.references.state === 'complete' ? L('references complete', 'المراجع مكتملة') : comp.references.state === 'none' ? L('no references yet', 'لا مراجع بعد') : L(`${comp.references.unresolved + comp.references.proposed} reference(s) open`, `${comp.references.unresolved + comp.references.proposed} مرجع مفتوح`))}
      {m(comp.extraction.state === 'complete', comp.extraction.state === 'complete' ? L('all pages have text', 'لكل الصفحات نص') : comp.extraction.state === 'incomplete' ? L(`${comp.extraction.unreadPages} page(s) unread`, `${comp.extraction.unreadPages} صفحة لم تُقرأ`) : L('no document', 'لا مستند'))}
      {m(comp.finance.state === 'reconciled', comp.finance.state === 'reconciled' ? L('amount reconciled', 'المبلغ متطابق') : comp.finance.state === 'short' || comp.finance.state === 'over' ? L('amount difference', 'فرق في المبلغ') : L('amount not checkable', 'المبلغ غير قابل للفحص'))}
    </div>
  );
}
