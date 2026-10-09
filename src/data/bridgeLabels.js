// Labels of the net-uncollected bridge steps (shared by the screens, reports and the assistant).
export const BRIDGE_LABELS = {
  report: { ar: 'رقم تقرير غير المسدد (بعد إزالة التكرار)', en: 'Unpaid-report figure (de-duplicated)' },
  reconciliation: { ar: 'فروقات المطابقة (سداد/إشعارات بعد تاريخ التقرير)', en: 'Reconciliation differences (payments / credit notes after the report)' },
  cancelled: { ar: 'الملغاة', en: 'Cancelled' },
  excluded: { ar: 'المستبعدة (دون تداخل مع الملغاة)', en: 'Excluded (non-overlapping with cancelled)' },
  newInvoices: { ar: 'فواتير صدرت بعد تاريخ التقرير وما زالت غير مسددة', en: 'Invoices issued after the report, still unpaid' },
  missedByReport: { ar: 'فواتير قبل التقرير غير واردة فيه', en: 'Pre-report invoices missing from the report' },
  internal: { ar: 'نطاق داخلي (تقارير الأمانات)', en: 'Internal scope (Amanah reports)' }
};
