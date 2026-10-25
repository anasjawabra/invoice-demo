// إدارة المنتجات — the catalogue of products and data systems, as listed for the Ministry (list of 21 Oct 2026): Balady (four invoice products + supporting data) and the other platforms.
// `kind`: 'invoices' = the system issues invoices, so the page shows its figures; 'supporting' = data the solution reads (no invoices of its own).
// `filter` says which part of the demo data a card measures: a revenue SOURCE (Balady products) or a product GROUP (the others). `status` is the integration state as listed — it describes the real
// sources; every figure on the page comes from the simulated demo data.
const BI = (ar, en) => ({ ar, en });

export const PRODUCT_CATALOG = [
  // ---------------------------------------------------------------- بلدي
  { id: 'balady-licences', group: 'balady', kind: 'invoices', name: BI('بلدي – الرخص', 'Balady – Licences'), desc: BI('فواتير الرخص، وتشمل الرخص التجارية ورخص البناء.', 'Licence invoices, including commercial and construction licences.'), filter: { source: 'licenses' } },
  { id: 'balady-accommodation', group: 'balady', kind: 'invoices', name: BI('بلدي – الإيواء', 'Balady – Accommodation'), desc: BI('فواتير الإيواء.', 'Accommodation invoices.'), filter: { source: 'accommodation' } },
  { id: 'balady-tobacco', group: 'balady', kind: 'invoices', name: BI('بلدي – التبغ', 'Balady – Tobacco'), desc: BI('فواتير التبغ.', 'Tobacco invoices.'), filter: { source: 'tobacco' } },
  { id: 'balady-municipal', group: 'balady', kind: 'invoices', name: BI('بلدي – الخدمات البلدية', 'Balady – Municipal services'), desc: BI('فواتير الخدمات البلدية.', 'Municipal service invoices.'), filter: { source: 'municipal_fees' } },
  { id: 'balady-payer-cr', group: 'balady', kind: 'supporting', name: BI('بلدي – المكلّف والسجل التجاري', 'Balady – Payer and Commercial Register'), desc: BI('اسم المكلّف وحالة السجل التجاري من وزارة التجارة. بيانات مساندة وليست فواتير.', 'Payer name and CR status from the Ministry of Commerce. Supporting data rather than invoices.') },
  // ---------------------------------------------------------------- منصات وأنظمة أخرى
  { id: 'foras', group: 'other', kind: 'invoices', name: BI('فرص', 'Furas'), desc: BI('عقود الاستثمار وتواريخ الفواتير وجدول الدفعات والدفعات القادمة (وتشمل الشاشات الإلكترونية).', 'Investment contracts, invoice dates, payment schedule and upcoming payments (electronic screens included).'), filter: { product: ['foras', 'screen'] },
    status: { tone: 'part', text: BI('جزئيًا في بنك البيانات؛ ست جداول مدمجة بالفعل (IIC).', 'Partly in Databank, where six tables are already integrated for IIC.') } },
  { id: 'mumtathil', group: 'other', kind: 'invoices', name: BI('ممتثل', 'Momtathel'), desc: BI('المخالفات والاعتراضات المرفوعة على الفواتير.', 'Violations and objections raised against invoices.'), filter: { product: ['mumtathil'] },
    status: { tone: 'ok', text: BI('في بنك البيانات.', 'In Databank.') } },
  { id: 'sanad-structured', group: 'other', kind: 'supporting', name: BI('سند – البيانات المهيكلة', 'Sanad – Structured'), desc: BI('أوامر التنفيذ وأرقام المراجع.', 'Enforcement orders and reference numbers.'),
    status: { tone: 'part', text: BI('البيانات المهيكلة لسند؛ مسار الوصول يحتاج تأكيداً.', 'Structured Sanad data; the access route is to be confirmed.') } },
  { id: 'sanad-attachments', group: 'other', kind: 'supporting', name: BI('سند – المرفقات', 'Sanad – Attachments'), desc: BI('ملفات PDF لأوامر التنفيذ للتعرف الضوئي (OCR).', 'Enforcement order PDFs for OCR.'),
    status: { tone: 'todo', text: BI('ربما عبر بيانات بلدي — للتأكيد.', 'Possibly via Balady Bayanat — to confirm.') } },
  { id: 'sadad', group: 'other', kind: 'supporting', name: BI('سداد', 'SADAD'), desc: BI('الفواتير المحالة للتنفيذ وأرقام السجلات التجارية المشطوبة.', 'Invoices referred for enforcement and struck-off CR numbers.'),
    status: { tone: 'ok', text: BI('في بنك البيانات، والمخطط (schema) مستلم.', 'In Databank, with the schema received.') } },
  { id: 'tahseel', group: 'other', kind: 'supporting', name: BI('تحصيل', 'Tahseel'), desc: BI('بيانات الفواتير وبنودها ورمز الإيراد والمبلغ وحالة السداد.', 'Invoice and line-item data, revenue code, amount and payment status.'),
    status: { tone: 'ok', text: BI('عبر بيانات بلدي إلى بنك البيانات.', 'Via Balady Bayanat into Databank.') } },
  { id: 'efaa', group: 'other', kind: 'supporting', name: BI('إيفاء', 'Efaa'), desc: BI('الغرامات والجزاءات والإحالة للتنفيذ وحالته.', 'Fines, penalties, enforcement referral and status.'),
    status: { tone: 'ok', text: BI('عبر بيانات بلدي إلى بنك البيانات.', 'Via Balady Bayanat into Databank.') } },
  { id: 'naqd', group: 'other', kind: 'supporting', name: BI('نقد (ساما)', 'Naqd (SAMA)'), desc: BI('المعاملات المالية ونشاط الحسابات.', 'Financial transactions and account activity.'),
    status: { tone: 'ok', text: BI('عبر بيانات بلدي إلى بنك البيانات.', 'Via Balady Bayanat into Databank.') } },
  { id: 'alshamel', group: 'other', kind: 'invoices', name: BI('تقرير الشامل', 'Alshamel Report'), desc: BI('فواتير رسوم الأراضي البيضاء غير المحصّلة.', 'Uncollected white-land fee invoices.'), filter: { product: ['whiteLands'] },
    status: { tone: 'ok', text: BI('عبر بيانات بلدي إلى بنك البيانات.', 'Via Balady Bayanat into Databank.') } }
];
export const catalogById = (id) => PRODUCT_CATALOG.find((x) => x.id === id) || null;
export const catalogGroups = () => ({ balady: PRODUCT_CATALOG.filter((x) => x.group === 'balady'), other: PRODUCT_CATALOG.filter((x) => x.group === 'other') });
