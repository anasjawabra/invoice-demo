// مصادر البيانات — the directory of the data sources the solution will read once each integration is connected. One card per source or Balady product; a card with several services lists them inside it (Balady is split into three cards: licences and others, tobacco fees, accommodation fees).
// Names and data types are the ones in the project's product catalogue (list of 21 Oct 2026, src/data/productCatalog.js) and the schemas received (e.g. the Furas schema: Investor, Contract, Payment). Nothing here says an
// integration is active, and no figure, record or integration status is shown. Tools and technologies (e.g. the data bank, the platform that carries other sources) are not sources and are not listed.
const BI = (ar, en) => ({ ar, en });

export const DATA_SOURCES = [
  { id: 'balady-licences', name: BI('بلدي – الرخص وغيرها', 'Balady – Licences and others'), desc: BI('فواتير الرخص والخدمات البلدية، وبيانات المكلّف والسجل التجاري.', 'Invoices of licences and municipal services, and payer and commercial register data.'),
    services: [BI('الرخص (التجارية والبناء)', 'Licences (commercial and construction)'), BI('الخدمات البلدية', 'Municipal services'), BI('المكلّف والسجل التجاري', 'Payer and commercial register')] },
  { id: 'balady-tobacco', name: BI('بلدي – رسوم التبغ', 'Balady – Tobacco fees'), desc: BI('فواتير رسوم التبغ.', 'Tobacco fee invoices.'), services: [] },
  { id: 'balady-accommodation', name: BI('بلدي – رسوم الإيواء', 'Balady – Accommodation fees'), desc: BI('فواتير رسوم الإيواء.', 'Accommodation fee invoices.'), services: [] },
  { id: 'furas', name: BI('فرص', 'Furas'), desc: BI('عقود الاستثمار والمستثمرون والدفعات وتواريخ الفواتير.', 'Investment contracts, investors, installments and invoice dates.'), services: [] },
  { id: 'mumtathil', name: BI('ممتثل', 'Mumtathil'), desc: BI('المخالفات والاعتراضات المرفوعة على الفواتير.', 'Violations and objections raised against invoices.'), services: [] },
  { id: 'sanad', name: BI('سند', 'Sanad'), desc: BI('أوامر التنفيذ وأرقام المراجع، ومرفقات أوامر التنفيذ.', 'Enforcement orders and reference numbers, and enforcement order attachments.'),
    services: [BI('البيانات المهيكلة', 'Structured data'), BI('المرفقات (ملفات PDF)', 'Attachments (PDF files)')] },
  { id: 'sadad', name: BI('سداد', 'SADAD'), desc: BI('الفواتير المحالة للتنفيذ وأرقام السجلات التجارية المشطوبة.', 'Invoices referred for enforcement and struck-off commercial register numbers.'), services: [] },
  { id: 'tahseel', name: BI('تحصيل', 'Tahseel'), desc: BI('بيانات الفواتير وبنودها ورمز الإيراد والمبلغ وحالة السداد.', 'Invoice and line-item data, revenue code, amount and payment status.'), services: [] },
  { id: 'efaa', name: BI('إيفاء', 'Efaa'), desc: BI('الغرامات والجزاءات والإحالة للتنفيذ وحالته.', 'Fines, penalties, enforcement referral and its status.'), services: [] },
  { id: 'naqd', name: BI('نقد (ساما)', 'Naqd (SAMA)'), desc: BI('المعاملات المالية ونشاط الحسابات.', 'Financial transactions and account activity.'), services: [] },
  { id: 'alshamel', name: BI('تقرير الشامل', 'Alshamel Report'), desc: BI('فواتير رسوم الأراضي البيضاء غير المحصّلة.', 'Uncollected white-land fee invoices.'), services: [] }
];
export const SOURCE_MESSAGE = BI('سيتم عرض البيانات عند الربط', 'Data will be displayed once the integration is connected.');
