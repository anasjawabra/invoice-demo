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
  invoice_cancelled: { en: 'Cancelled in the source — a confirmed link raises a source/enforcement conflict to review', ar: 'ملغاة في المصدر — الرابط المؤكد يُنشئ تعارضاً بين المصدر والإنفاذ يلزم مراجعته' },
  invoice_excluded: { en: 'Invoice is excluded', ar: 'الفاتورة مستبعدة' },
  invoice_collected: { en: 'Invoice already collected in full', ar: 'الفاتورة محصّلة بالكامل' },
  invoice_issued_after_order: { en: 'Invoice issued after the order opened', ar: 'الفاتورة صدرت بعد فتح الأمر' },
  ambiguous_reference: { en: 'Reference matches several invoices', ar: 'المرجع يطابق عدة فواتير' },
  document_other_order: { en: 'Found only in a document that names a different order', ar: 'وردت فقط في مستند يذكر أمراً آخر' },
  weak_reference: { en: 'Weak reference (no year / padded)', ar: 'مرجع ضعيف (بلا سنة / مُكمَّل)' }
};
// What resolves each hard conflict — always EVIDENCE, never a written reason
export const RESOLVE_HINT = {
  ambiguous_reference: { en: 'Resolved only by supporting evidence: another reference of this order that identifies exactly one of these invoices (for example the full invoice number on another page or typed here). Matching the order’s debtor is supporting, not sufficient on its own. A reason does not resolve it.', ar: 'يُحسم بدليل داعم فقط: مرجع آخر في هذا الأمر يحدد فاتورة واحدة منها (مثل رقم الفاتورة الكامل في صفحة أخرى أو يُكتب هنا). ومطابقة مدين الأمر قرينة داعمة وليست كافية وحدها. والسبب المكتوب لا يحسمه.' },
  debtor_mismatch: { en: 'The invoice belongs to another payer. Resolved only if an order document names that payer’s identity number; otherwise it stays unresolved.', ar: 'الفاتورة لدافع آخر. تُحسم فقط إذا ذكر مستند الأمر هوية هذا الدافع؛ وإلا تبقى غير محسومة.' },
  amanah_mismatch: { en: 'Different Amanah: no evidence path — it stays unresolved.', ar: 'أمانة مختلفة: لا مسار دليل — تبقى غير محسومة.' },
  invoice_issued_after_order: { en: 'Issued after the order opened: no evidence path — it stays unresolved.', ar: 'صدرت بعد فتح الأمر: لا مسار دليل — تبقى غير محسومة.' },
  document_other_order: { en: 'Found only in a document that names another order: confirm it only if Sanad’s structured data or this order’s own document names the invoice.', ar: 'ورد فقط في مستند يذكر أمراً آخر: لا يُؤكَّد إلا إذا ذكرته بيانات سند المهيكلة أو مستند هذا الأمر.' }
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

// A compact marker wherever orders are listed or opened; the limits sit under «Integration details». Warnings about a specific result stay beside that result.
export function IntegrationNotice() {
  const { L } = useL();
  return (
    <div className="oj-marker" role="note">
      <span className="rv-tag rv-tag--warn">{L('Demo data · OCR simulation', 'بيانات تجريبية · محاكاة OCR')}</span>
      <details>
        <summary>{L('Integration details', 'تفاصيل التكامل')}</summary>
        <ul>
          <li>{L('Orders and their invoice references come from a SYNTHETIC Sanad feed. Live Sanad retrieval and retrieval of Sanad attachments are not connected: add documents by hand or choose a prepared sample.', 'الأوامر ومراجع فواتيرها من تغذية «اصطناعية» لسند. الاسترجاع الحي من سند وجلب مرفقاته غير متصلين: أضف المستندات يدوياً أو اختر عينة معدّة.')}</li>
          <li>{L('Digital PDFs (text layer) and Word .docx files (paragraphs and tables) are really read by this system. Legacy .doc is not supported.', 'ملفات PDF الرقمية (طبقة النص) وملفات Word .docx (الفقرات والجداول) يقرأها النظام فعلاً. صيغة .doc القديمة غير مدعومة.')}</li>
          <li>{L('Scanned documents: there is NO OCR engine. The prepared samples run a labelled «OCR simulation — demo only» that replays the transcript of the sample; any other scan is flagged «not read» (supply external OCR text or type the references).', 'المستندات الممسوحة: لا يوجد محرك OCR. تشغّل العينات المعدّة «محاكاة OCR — للعرض التجريبي» تعيد نص العينة المعدّ؛ وأي مستند ممسوح آخر يُعلَّم «لم يُقرأ» (زوّد نص OCR خارجياً أو أدخل المراجع يدوياً).')}</li>
          <li>{L('Stored records keep the methods apart: digital extraction · OCR simulation · system OCR (not connected) · imported external OCR text · typed by a person.', 'تحفظ السجلات الطرق منفصلة: استخراج رقمي · محاكاة OCR · OCR النظام (غير متصل) · نص OCR خارجي مستورد · إدخال يدوي.')}</li>
        </ul>
      </details>
    </div>
  );
}

// What «ENF-1 treatment» means — documented rule vs implementation assumptions, and its calculation effect (shown wherever the cancelled-vs-enforcement conflict appears)
export function Enf1Explainer() {
  const { L } = useL();
  return (
    <details className="oj-marker">
      <summary>{L('What is the ENF-1 treatment?', 'ما هي معالجة ENF-1؟')}</summary>
      <ul>
        <li><b>{L('The rule (documented).', 'القاعدة (موثّقة).')}</b> {L('ENF-1 is in the platform’s rule registry: locked, approved, effective 2026-07-01, owner “Revenue data steward”. Its recorded wording is a “meeting correction”: invoices referred to enforcement — often shown “cancelled” in the source — are counted UNCOLLECTED, not excluded. The handover document repeats it.', 'ENF-1 في سجل قواعد المنصة: مقفلة ومعتمدة وسارية من 2026-07-01 ومالكها «أمين بيانات الإيرادات». وصيغتها المسجّلة «تصحيح اجتماع»: الفواتير المحالة للتنفيذ — وتظهر غالباً «ملغاة» في المصدر — تُحتسب غير محصّلة وليست مستبعدة. وتكررها وثيقة التسليم.')}</li>
        <li><b>{L('Calculation effect.', 'الأثر الحسابي.')}</b> {L('Where the rule is applied to a source-cancelled invoice, the cancellation is NOT deducted: the invoice stays in net billed and its remaining balance (billed − received) counts in net uncollected; it is not a rule exclusion. Where it is not applied, the cancelled amount (billed − received) leaves net billed once.', 'حيث تُطبَّق القاعدة على فاتورة ملغاة في المصدر لا يُخصم الإلغاء: تبقى في صافي المفوتر ويُحتسب رصيدها المتبقي (المفوتر − المقبوض) في صافي غير المحصّل؛ وليست استبعاداً بقاعدة. وحيث لا تُطبَّق يخرج المبلغ الملغى (المفوتر − المقبوض) من صافي المفوتر مرة واحدة.')}</li>
        <li><b>{L('Not documented — implementation assumptions.', 'غير موثّق — افتراضات تنفيذ.')}</b> {L('The minutes themselves are not in this repository, so the exact conditions cannot be verified. Which links count as “enforcement” (including links found in documents), whether any order status qualifies (open, suspended, closed, withdrawn) and whether the rule applies automatically are assumptions.', 'محاضر الاجتماع نفسها ليست في المستودع، فلا يمكن التحقق من الشروط بدقة. وما الروابط التي تُعدّ «تنفيذاً» (ومنها الروابط المستخرجة من مستندات)، وهل تؤهّل أي حالة أمر (مفتوح، موقوف، مغلق، مسحوب)، وهل تُطبَّق القاعدة تلقائياً — كلها افتراضات.')}</li>
        <li><b>{L('What this demo does.', 'ما يفعله هذا العرض.')}</b> {L('Enforcement alone never overrides a source cancellation, reinstates collectibility or changes a total — whether active, closed or withdrawn. The disagreement is flagged for review, and the documented rule is applied only to an invoice for which a reviewer records that decision. Business confirmation is pending (EQ3 stays unresolved); no new financial policy is introduced.', 'التنفيذ وحده لا يلغي إلغاءً في المصدر ولا يعيد قابلية التحصيل ولا يغيّر أي إجمالي — نشطاً كان أو مغلقاً أو مسحوباً. يُعلَّم التعارض للمراجعة، وتُطبَّق القاعدة الموثّقة فقط على فاتورة سجّل مراجع قراراً بشأنها. والتأكيد من الأعمال معلّق (يبقى EQ3 غير محسوم)؛ ولا تُستحدث سياسة مالية جديدة.')}</li>
      </ul>
    </details>
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
      {m(comp.references.state === 'complete', comp.references.state === 'complete' ? L('references complete', 'المراجع مكتملة') : comp.references.state === 'none' ? L('invoice numbers not identified — needs review', 'لم يتم تحديد أرقام الفواتير — تحتاج مراجعة') : L(`${comp.references.unresolved + comp.references.proposed} reference(s) open`, `${comp.references.unresolved + comp.references.proposed} مرجع مفتوح`))}
      {m(comp.extraction.state === 'complete', comp.extraction.state === 'complete' ? L('all pages have text', 'لكل الصفحات نص') : comp.extraction.state === 'incomplete' ? (comp.extraction.unreadPages ? L(`${comp.extraction.unreadPages} page(s) unread`, `${comp.extraction.unreadPages} صفحة لم تُقرأ`) : L(`${comp.extraction.attachmentsPending} attachment(s) not added`, `${comp.extraction.attachmentsPending} مرفق لم يُضَف`)) : L('no document', 'لا مستند'))}
      {m(comp.finance.state === 'reconciled', comp.finance.state === 'reconciled' ? L('amount reconciled', 'المبلغ متطابق') : comp.finance.state === 'short' || comp.finance.state === 'over' ? L('amount difference', 'فرق في المبلغ') : L('amount not checkable', 'المبلغ غير قابل للفحص'))}
    </div>
  );
}
