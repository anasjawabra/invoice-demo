// Navigation / page-title strings for the revenue-intelligence screens.
// Page bodies use inline English/Arabic text (see utils/bi.js); Chinese falls
// back to English via I18nContext.t().
export const revenueI18n = {
  en: {
    nav_executive: 'Executive',
    nav_revenue_analysis: 'Revenue Analysis',
    nav_insights: 'Dashboards & Reports',
    nav_noncollection: 'Noncollection & Exclusions',
    nav_data_sources: 'Data Sources',
    nav_contracts: 'Contracts & Enforcement',
    nav_metrics: 'Metric Dictionary',
    nav_collection_worklist: 'Collection Worklist',
    nav_risk_quality: 'Data Quality & Risk',
    nav_planning: 'Financial & Strategic Planning',
    recent_sub: 'Demo data standing in for periodic report uploads — not the Ministry\'s actual figures.',
    dash_decisions_sub: 'Ranked recommendations from the shared metric snapshot (amount, aging, actionability, evidence) — proposals for human decision, not approved actions.',
    inv_makeen_note: 'Illustrative demo ledger aggregated across revenue sources and Amanahs. “Collection state” is derived from dated payments, due dates and review records — not from the AI workflow status, which is shown separately in the invoice details. No production system is connected.'
  },
  ar: {
    nav_executive: 'التنفيذي',
    nav_revenue_analysis: 'تحليل الإيرادات',
    nav_insights: 'لوحة المعلومات والتقارير',
    nav_noncollection: 'عدم التحصيل والاستبعادات',
    nav_data_sources: 'مصادر البيانات',
    nav_contracts: 'العقود والتنفيذ',
    nav_metrics: 'قاموس المقاييس',
    nav_collection_worklist: 'قائمة التحصيل',
    nav_risk_quality: 'جودة البيانات والمخاطر',
    nav_planning: 'التخطيط المالي والاستراتيجي',
    recent_sub: 'بيانات تجريبية تحل محل الرفع الدوري للتقارير — وليست أرقام الوزارة الفعلية.',
    dash_decisions_sub: 'توصيات مرتبة من لقطة المؤشرات المشتركة (المبلغ والتقادم والقابلية والدليل) — مقترحات لقرار بشري وليست إجراءات معتمدة.',
    inv_makeen_note: 'سجل توضيحي مُجمَّع عبر مصادر الإيراد والأمانات. تُشتق «حالة التحصيل» من المدفوعات المؤرخة وتواريخ الاستحقاق وسجلات المراجعة — وليس من حالة سير عمل الذكاء الاصطناعي التي تظهر منفصلة في تفاصيل الفاتورة. لا يوجد نظام إنتاج متصل.'
  },
  zh: {}
};
