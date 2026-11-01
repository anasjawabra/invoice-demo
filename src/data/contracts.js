// ============================================================================
// Contract view labels: Furas contract ↔ Tahseel invoices ↔ Sanad execution requests.
// The contract cards themselves are computed by the data service (server/contracts.js).
//
// - A contract has a payment SCHEDULE; each scheduled payment can become an
//   invoice. Installments that are not yet due (and usually not yet invoiced) are
//   FUTURE obligations — never arrears.
// - A Sanad request linked to a contract keeps its own amount at CONTRACT level.
//   It is never added to the uncollected stock again (the invoices already are).
// - Sanad document → CR number → CR View status. The raw CR status is shown as
//   received; no exclusion happens without an approved, enabled rule.
// ============================================================================
export const CR_CHAIN_LABELS = {
  sanad: { ar: 'مستند سند', en: 'Sanad document' },
  cr: { ar: 'رقم السجل التجاري', en: 'CR number' },
  crView: { ar: 'حالة CR View', en: 'CR View status' }
};

// The state of ONE scheduled installment. Eight come from an invoice linked to the contract; three describe an installment that has no linked invoice to read.
export const INSTALLMENT_STATES = {
  paid: { ar: 'مسددة', en: 'Paid', tone: 'ok' },
  partial: { ar: 'مسددة جزئياً', en: 'Partly paid', tone: 'warn' },
  overdue: { ar: 'متأخرة', en: 'Overdue', tone: 'bad' },
  not_due: { ar: 'مفوترة — لم يحن استحقاقها', en: 'Invoiced — not yet due', tone: 'info' },
  future: { ar: 'قادمة — لم تُفوتر بعد', en: 'Upcoming — not invoiced yet', tone: 'info' },
  unlinked: { ar: 'مستحقة — لا فاتورة مرتبطة بهذا العقد', en: 'Due — no invoice linked to this contract', tone: 'warn' },
  history: { ar: 'قبل نطاق البيانات', en: 'Before the data range', tone: 'mute' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled', tone: 'mute' },
  excluded: { ar: 'مستبعدة', en: 'Excluded', tone: 'mute' }
};
// one line for each state, shown as the legend under the timeline
export const INSTALLMENT_STATE_HELP = {
  paid: { ar: 'سُدّدت الفاتورة كاملة.', en: 'The invoice is fully paid.' },
  partial: { ar: 'سُدّد جزء من الفاتورة وتجاوزت موعد الاستحقاق.', en: 'Part of the invoice is paid and it is past its due date.' },
  overdue: { ar: 'فاتورة تجاوزت موعد الاستحقاق ولم يُسدَّد منها شيء.', en: 'An invoice past its due date with nothing paid.' },
  not_due: { ar: 'فاتورة صادرة لم يحن موعد استحقاقها.', en: 'An invoice issued whose due date has not come.' },
  future: { ar: 'موعد استحقاقها بعد التاريخ المرجعي ولا فاتورة بعد — ليست متأخرات.', en: 'Due after the reference date and not invoiced yet — never arrears.' },
  unlinked: { ar: 'حلّ موعدها ولا توجد فاتورة مرتبطة بهذا العقد؛ قد توجد فاتورة غير مطابقة في النظام. قاعدة مرشَّحة بانتظار الاعتماد.', en: 'Due, and no invoice is linked to this contract; an unmatched invoice may exist elsewhere. A candidate rule pending confirmation.' },
  history: { ar: 'استحقاقها قبل بداية البيانات المسجلة: لا تتوفر فاتورة ولا تحصيل (غير معروف، وليس صفراً).', en: 'Due before the recorded data starts: no invoice or collection is available (unknown, not zero).' },
  cancelled: { ar: 'فاتورة ملغاة في المصدر.', en: 'An invoice cancelled in the source.' },
  excluded: { ar: 'فاتورة مستبعدة بقاعدة؛ تبقى ظاهرة ولا تُحسب في الصافي.', en: 'An invoice excluded by a rule; it stays visible and is not counted in net invoiced.' }
};
// how the list of installments is cut (the page's main section)
export const TIMELINE_SEGMENTS = [
  { key: 'all', ar: 'الكل', en: 'All', states: null },
  { key: 'done', ar: 'مسددة', en: 'Paid', states: ['paid'] },
  { key: 'open', ar: 'مفوترة ومستحقة', en: 'Invoiced and due', states: ['not_due', 'overdue', 'partial', 'unlinked'] },
  { key: 'upcoming', ar: 'قادمة', en: 'Upcoming', states: ['future'] },
  { key: 'closed', ar: 'مستبعدة / ملغاة', en: 'Excluded / cancelled', states: ['excluded', 'cancelled'] },
  { key: 'history', ar: 'قبل نطاق البيانات', en: 'Before the data range', states: ['history'] }
];
// a value is one of three things; never print a zero for the other two
export const DATA_STATE = {
  known: null,
  not_applicable: { ar: 'لا ينطبق بعد', en: 'Not applicable yet' },
  unknown: { ar: 'غير متاح من المصدر', en: 'Not available from source' }
};
