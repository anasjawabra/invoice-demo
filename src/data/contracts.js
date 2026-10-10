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

export const INSTALLMENT_STATES = {
  paid: { ar: 'مسددة', en: 'Paid', tone: 'ok' },
  partial: { ar: 'مسددة جزئياً', en: 'Partly paid', tone: 'warn' },
  overdue: { ar: 'متأخرة', en: 'Overdue', tone: 'bad' },
  not_due: { ar: 'مفوترة — لم يحن استحقاقها', en: 'Invoiced — not yet due', tone: 'info' },
  future: { ar: 'مستقبلية — لم تُفوتر', en: 'Future — not invoiced', tone: 'mute' },
  unlinked: { ar: 'مستحقة — لم يُربط بها فاتورة', en: 'Due — no invoice linked', tone: 'warn' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled', tone: 'mute' },
  excluded: { ar: 'مستبعدة', en: 'Excluded', tone: 'mute' }
};
