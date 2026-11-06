// Navigation / page-title strings for the revenue-intelligence screens.
// Page bodies use inline English/Arabic text (see utils/bi.js). Arabic and English are the only interface
// languages (src/data/lang.js).
export const revenueI18n = {
  en: {
    nav_executive: 'Executive',
    nav_revenue_analysis: 'Revenue Analysis',
    nav_insights: 'Dashboards & Reports',
    nav_noncollection: 'Noncollection & Exclusions',
    nav_contracts: 'Investment contracts',
    nav_metrics: 'Metrics and Glossary Dictionary',
    nav_collection_worklist: 'Uncollected invoices list',
    nav_system_settings: 'System Settings',
    nav_planning: 'Collection Revenue Planning',
    recent_sub: 'Demo data standing in for periodic report uploads — not the Ministry\'s actual figures.',
    dash_decisions_sub: 'Ranked recommendations from the shared metric snapshot (amount, aging, actionability, evidence) — proposals for human decision, not approved actions.',
    inv_ledger_note: 'Illustrative demo ledger aggregated across revenue sources and Amanahs. “Collection state” is derived from dated payments, due dates and review records — not from the AI workflow status, which is shown separately in the invoice details. No production system is connected.'
  },
  ar: {
    nav_executive: 'التنفيذي',
    nav_revenue_analysis: 'تحليل الإيرادات',
    nav_insights: 'لوحة المعلومات والتقارير',
    nav_noncollection: 'عدم التحصيل والاستبعادات',
    nav_contracts: 'العقود الاستثمارية',
    nav_metrics: 'قاموس المقاييس والمصطلحات',
    nav_collection_worklist: 'قائمة الفواتير غير المحصّلة',
    nav_system_settings: 'إعدادات النظام',
    nav_planning: 'تخطيط إيرادات التحصيل',
    recent_sub: 'بيانات تجريبية تحل محل الرفع الدوري للتقارير — وليست أرقام الوزارة الفعلية.',
    dash_decisions_sub: 'توصيات مرتبة من لقطة المؤشرات المشتركة (المبلغ والتقادم والقابلية والدليل) — مقترحات لقرار بشري وليست إجراءات معتمدة.',
    inv_ledger_note: 'سجل توضيحي مُجمَّع عبر مصادر الإيراد والأمانات. تُشتق «حالة التحصيل» من المدفوعات المؤرخة وتواريخ الاستحقاق وسجلات المراجعة — وليس من حالة سير عمل الذكاء الاصطناعي التي تظهر منفصلة في تفاصيل الفاتورة. لا يوجد نظام إنتاج متصل.'
  }
};
