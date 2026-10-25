// The reference text behind the «قاموس المقاييس» page — written for two readers at once: someone who knows the business but not the code, and a developer who needs the exact rule, the inputs and where it lives.
// It describes what the code DOES (server/engine.js · derive(), src/data/revenueMetrics.js, src/data/kpis.js, planTargets.js, planForecast.js, revenueInsights.js). When a rule changes there, change it here.
// Pure data: no I/O. Every text is { ar, en }.
import { EXCLUSION_REASONS, EXCLUSION_SOURCE_OF_RULE } from './iim';
import { EXCLUSION_RULES, ruleById } from './revenueMetrics';
import { RULE_IDS } from './catalog';

const BI = (ar, en) => ({ ar, en });

/* ---------------------------------------------------------------------------------------------------------------------------------------- exclusions */
export const EXCLUSION_INTRO = {
  what: BI(
    'الاستبعاد يُخرج فاتورة غير محصّلة من «القابل للتحصيل» لأن هناك سببًا مثبتًا في جهة أخرى يجعل متابعتها العادية غير ممكنة أو غير مجدية (قضية، اعتراض، سجل مشطوب، لا عقد لها…). الاستبعاد يغيّر المقام في نسبة التحصيل ولا يعني أن المبلغ سقط أو لا يمكن تحصيله.',
    'An exclusion takes an uncollected invoice out of the collectible base because another system holds a documented reason that makes ordinary follow-up impossible or pointless (a court case, an objection, a struck-off registration, no contract…). It changes the denominator of the collection rate; it does not mean the money is written off or uncollectible.'),
  rules: [
    BI('الاستبعاد يقع على الفواتير غير المحصّلة فقط. فاتورة محصّلة بالكامل لا تُستبعد أبدًا (يُتجاهل السبب ويُحسب تحذيرًا في جودة البيانات). والفاتورة المحصّلة جزئيًا يُستبعد منها المتبقي فقط.', 'Only uncollected invoices are excluded. A fully collected invoice is never excluded (the reason is ignored and counted as a data-quality warning). A part-collected invoice loses only its uncollected remainder.'),
    BI('للفاتورة سبب رئيسي واحد مهما تعددت الأسباب (الأعلى أسبقية)، فتُخصم من إجمالي المفوتر مرة واحدة.', 'An invoice has ONE primary reason however many apply (the highest precedence), so it leaves gross billed exactly once.'),
    BI('الفاتورة الملغاة في المصدر تأخذ الأسبقية على أي سبب استبعاد: تُخصم كملغاة لا كمستبعدة. استثناء S9: الملغاة بسبب الإحالة للتنفيذ في سند تبقى مفوترة وتُستبعد بسبب «منفذ ضده – قضايا (سند)».', 'A source-cancelled invoice takes precedence over any exclusion: it is deducted as cancelled, not excluded. Exception S9: an invoice cancelled because it was referred to execution in Sanad stays billed and is excluded as «executed against – Sanad cases».'),
    BI('الأسبقية عند تعدد الأسباب: منفذ ضده (سند) ← منفذ ضده (إيفاء) ← اعتراضات قائمة ← غير مكتمل ← خارج إيفاء ← إيقاف التنفيذ (الشركات الخدمية) ← لا تستند على عقود ← سجلات مشطوبة ← التعديات ← إفادات الأمانات ← فاتورة مكررة.', 'Precedence when several apply: executed against (Sanad) → executed against (Efaa) → open objections → incomplete → outside Efaa → service-company stay → no contract → struck-off → encroachments → Amanah statements → duplicate.'),
    BI('الأسباب كلها مطبَّقة تلقائيًا (EXCLUSIONS_AUTO_APPLY = true) ما لم يرفضها مراجع في صفحة الفاتورة؛ ويمكن إيقاف أي سبب من إعدادات القواعد (cfg.rules) كسيناريو «ماذا لو».', 'Every reason applies automatically (EXCLUSIONS_AUTO_APPLY = true) unless a reviewer rejects it on the invoice page; any reason can be switched off in the rule settings (cfg.rules) as a what-if.')
  ],
  amounts: [
    { f: 'billed            = gross + approvedAdjustments(date ≤ cutoff)', note: BI('قيمة الفاتورة بعد التسويات المعتمدة', 'invoice value after approved adjustments') },
    { f: 'received          = Σ payments(date ≤ asOf)', note: BI('المدفوع حتى تاريخ القياس', 'paid up to the measuring date') },
    { f: 'excluded          = !cancelled AND mask ≠ 0 AND received < billed', note: BI('الشرط الكامل للاستبعاد', 'the full condition for exclusion') },
    { f: 'exclusionAmount   = excluded ? max(billed − received, 0) : 0', note: BI('المبلغ المستبعد = المتبقي غير المحصّل', 'excluded amount = the uncollected remainder') },
    { f: 'net               = billed − cancelledAmount − exclusionAmount', note: BI('صافي المفوتر للفاتورة', 'net billed of the invoice') },
    { f: 'outstanding       = (excluded OR cancelled) ? 0 : max(billed − received, 0)', note: BI('غير المحصّل القابل للتحصيل', 'collectible uncollected') },
    { f: 'إجمالي المستبعد (KPI) = Σ exclusionAmount   ·   Σ reasons.primaryAmount = إجمالي المستبعد', note: BI('مجموع الأسباب يساوي بطاقة الاستبعاد دائمًا (يُختبر آليًا)', 'the reasons always add up to the exclusion card (tested)') }
  ]
};

// For each reason: what it is, what it is built on, the exact rule, when it does NOT apply, how the demo feeds it, where the code is.
const D = {
  'NOC-1': {
    what: BI('فواتير استثمار صدرت دون وجود عقد لها في «فرص». لا يمكن متابعتها كأقساط عقد، وتحتاج تصحيحًا أو توثيقًا قبل التحصيل.', 'Investment invoices with no contract behind them in Furas. They cannot be followed up as contract instalments and need correcting or documenting first.'),
    basedOn: [BI('فرص — العقود: حالة المطابقة (لا يوجد عقد)', 'Furas — contracts: match state (no contract)'), BI('تحصيل: رقم حساب الإيراد ← التصنيف الرئيسي «استثمار» (جدول GFS في iim.js)', 'Tahseel: revenue account → main class «investment» (GFS table in iim.js)')],
    rule: 'main_class(invoice.gfsCode, origin) = «استثمار»  AND  Furas contract status = confirmed_none   (any Amanah/entity, central OR internal)',
    notWhen: BI('عقد «غير مطابق» (لم يُعثر عليه) ليس «بدون عقد» ولا يُستبعد؛ يبقى في الصافي ويُعلَّم للمراجعة. ولا تنطبق إن سبقتها قاعدة أعلى أسبقية (مثل R2).', 'An UNMATCHED contract (not found) is not «no contract» and is not excluded; it stays in net billed and is flagged. Does not apply when a higher-precedence reason wins (for example R2).'),
    feed: BI('بيانات العرض: بت NOC-1 في عمود exMask يضعه المولّد (عقود بلا ربط) ومعه cstat = 3. ثلاث فواتير داخلية المنشأ مضافة صراحة.', 'Demo: the NOC-1 bit in the exMask column is set by the generator (contract instalments with no link) together with cstat = 3. Three internal-origin invoices are added on purpose.')
  },
  'STY-1': {
    what: BI('فواتير شركة المياه الوطنية والشركات الخدمية الواقعة تحت أمر عالٍ بإيقاف التنفيذ بانتظار لجنة. التسمية مؤقتة للتأكيد.', 'Invoices of the National Water Company and service companies under a high-order stay of execution pending a committee. The label is a working label.'),
    basedOn: [BI('قائمة الوزارة للشركات (قابلة للضبط): SERVICE_COMPANY_LIST في iim.js', 'The Ministry\'s list of companies (configurable): SERVICE_COMPANY_LIST in iim.js'), BI('تحصيل: عميل الفاتورة (payer) والمدفوعات', 'Tahseel: the invoice\'s customer (payer) and its payments')],
    rule: 'customer ∈ SERVICE_COMPANY_LIST  AND  invoice has no payment  AND  not rejected by a reviewer   → takes precedence over R1',
    notWhen: BI('فاتورة عليها أي دفعة لا تُستبعد كاملة بهذه القاعدة (تُحفظ المدفوعات على الفواتير المستبعدة منفصلة في هذا النموذج).', 'An invoice with a payment is not taken out whole by this rule (receipts on excluded invoices are kept apart in this model).'),
    feed: BI('محسوبة في المحرك مباشرة من فهرس العميل (0 و1 = القائمة). حوالي خُمس فواتير «بلا عقد» نُقلت إليها.', 'Computed in the engine from the customer index (0 and 1 = the list). About a fifth of the «no contract» invoices were moved to it.')
  },
  'SND-1': {
    what: BI('أي فاتورة غير محصّلة ظهرت في سند برقم تنفيذ، مهما كانت حالة الأمر (قيد التنفيذ، موقوف، مغلق). الإغلاق لا يعني السداد.', 'Any uncollected invoice that appears in Sanad with an execution number, whatever the status of the order (in execution, suspended, closed). Closing does not mean payment.'),
    basedOn: [BI('سند: أوامر التنفيذ ورقم التنفيذ', 'Sanad: enforcement orders and the execution number'), BI('ربط الأمر بالفاتورة: حقل المراجع المهيكل، أو الاستخراج من مستند (OCR) بعد تأكيد المستخدم', 'Order-to-invoice link: the structured reference field, or extraction from a document (OCR) after the user confirms')],
    rule: 'invoice.executionNo IS NOT NULL   OR   a CONFIRMED link to an order (open | suspended | closed)   →  excluded (uncollected only)',
    notWhen: BI('الرابط «المقترح» لا يغيّر شيئًا حتى يؤكده مستخدم. سحب الرابط المؤكد يُزيل السبب.', 'A merely «proposed» link changes nothing until a person confirms it. Withdrawing a confirmed link removes the reason.'),
    feed: BI('المحرك يضيفه عند وجود رقم تنفيذ (st.exec) أو رابط مؤكد في طبقة links القادمة من المتصفح.', 'The engine adds it when an execution number (st.exec) exists or a confirmed link is present in the links overlay sent by the browser.')
  },
  'INC-1': {
    what: BI('مخالفات حالتها «غير مكتمل» في تقرير إشعار المطالبة بالأداء من إيفاء؛ لا يمكن تحصيلها قبل اكتمال بياناتها.', 'Violations whose status is «incomplete» in Efaa\'s payment-claim notice report; they cannot be collected until their data is complete.'),
    basedOn: [BI('إيفاء — تقرير إشعار المطالبة بالأداء: الحالة', 'Efaa — payment-claim notice report: status'), BI('الربط: رقم المخالفة ← رقم الفاتورة', 'Link: violation number → invoice number')],
    rule: 'report.status = «غير مكتمل»  →  take report.violationNumber  →  match invoice.violationNumber  →  exclude',
    notWhen: BI('الاكتمال/عدمه يؤخذ من هذا التقرير فقط، لا من تقرير «المنفذ ضده».', 'Complete / incomplete comes only from this report, never from the executed-against report.'),
    feed: BI('بيانات العرض: كود إيفاء 4 (غير مكتملة) على فواتير الغرامات + بت INC-1.', 'Demo: Efaa code 4 (incomplete) on fines invoices + the INC-1 bit.')
  },
  'EFA-1': {
    what: BI('جزاءات غير محصّلة لا تظهر في إيفاء (النظام المرجعي للمخالفات)، فلا سند للمتابعة.', 'Uncollected penalties that do not appear in Efaa (the system of record for violations), so there is nothing to follow up on.'),
    basedOn: [BI('تحصيل: المديونيات غير المحصّلة بتصنيف رئيسي «جزاءات وغرامات»', 'Tahseel: uncollected debt with main class «penalties and fines»'), BI('إيفاء: قائمة المخالفات (للمطابقة)', 'Efaa: the violations list (for the match)')],
    rule: 'invoice uncollected  AND  mainClass = «جزاءات وغرامات»  AND  no matching record in the Efaa list  →  link Efaa number ↔ invoice number  →  exclude',
    notWhen: BI('الفواتير الأخرى (غير الجزاءات) لا تدخل. القاعدة مكتوبة على بيانات تحصيل غير المحصّلة.', 'Other classes are out of scope. The rule is written on Tahseel\'s uncollected data.'),
    feed: BI('بيانات العرض: كود إيفاء 0 (غير موجودة) على فواتير الغرامات + بت EFA-1.', 'Demo: Efaa code 0 (not found) on fines invoices + the EFA-1 bit.')
  },
  'EXE-1': {
    what: BI('مخالفات واردة في تقرير «المنفذ ضده» من إيفاء: بدأ التنفيذ على المدين فلا تتابَع كتحصيل عادي.', 'Violations listed in Efaa\'s «executed against» report: enforcement against the debtor has started, so they are not followed up as ordinary collection.'),
    basedOn: [BI('إيفاء — تقرير المنفذ ضده: رقم التنفيذ ورقم المخالفة', 'Efaa — executed-against report: execution number and violation number')],
    rule: 'violation ∈ executed-against report  →  link to its invoice by violation number  →  exclude (every violation in the report)',
    notWhen: BI('لا يعني انتهاء المبلغ. ولا يؤخذ منه الاكتمال/عدمه (ذلك من تقرير الإشعار).', 'It does not mean the amount has ended, and completeness is not taken from it (that comes from the notice report).'),
    feed: BI('بيانات العرض: كود إيفاء 5 (منفذ ضده) + بت EXE-1.', 'Demo: Efaa code 5 (executed against) + the EXE-1 bit.')
  },
  'OBJ-1': {
    what: BI('اعتراضات/استئنافات قائمة على الفاتورة لم تُحسم بالرفض؛ تُجمَّد المتابعة إلى أن تُحسم.', 'Objections / appeals open on the invoice that were not settled by a rejection; follow-up is frozen until they are decided.'),
    basedOn: [BI('إيفاء: عمود حالة الاستئناف (خمس حالات) — المصدر في الشكل الحالي', 'Efaa: the appeal-status column (five statuses) — the source in the current form'), BI('ممتثل: العمود نفسه — سيُغذّي القاعدة مستقبلًا أيضًا دون تغيير في القاعدة', 'Mumtathil: the same column — will also feed the rule in future, with no change to the rule'), BI('تحصيل: رقم الفاتورة', 'Tahseel: the invoice number')],
    rule: 'status ∈ { بانتظار توجيه العضو, بانتظار مراجعة اللجنة, مقبول جزئيًا, مكتمل مقبول }  →  exclude the WHOLE invoice\nstatus = مكتمل مرفوض  →  keep collectable (not an objection case)',
    notWhen: BI('«مكتمل مرفوض» لا يستبعد ولا يُصنَّف «قيد الاعتراض». الخريطة الحالات ← قرار في OBJECTION_STATUSES (iim.js).', '«Complete – rejected» neither excludes nor counts as under objection. The status → decision map is OBJECTION_STATUSES (iim.js).'),
    feed: BI('عمود objSt (1–5) لكل فاتورة بها اعتراض؛ المحرك يقرأه في derive() ويضيف/يزيل بت OBJ-1.', 'The objSt column (1–5) on each invoice with an objection; derive() reads it and sets / clears the OBJ-1 bit.')
  },
  'ENC-1': {
    what: BI('فواتير استثمار صدرت عن استغلال موقع دون عقد (تعدٍّ) وأفادت بها الأمانة بمحضر تعدٍّ؛ قد تكون من خارج فرص ومن أنظمة داخلية.', 'Investment invoices raised for exploiting a site without a contract (an encroachment) and reported by the Amanah with an encroachment report; may be outside Furas and internal.'),
    basedOn: [BI('ملف الأمانة (Excel) يصل بالبريد ويُرفع بقالب الرفع — لا يوجد نظام مصدر', 'The Amanah\'s Excel file received by email and loaded through the upload template — there is no source system')],
    rule: 'row in an uploaded file  AND  reason = «التعديات واستغلال المواقع (محضر التعدي)»  AND  full match on الأمانة + رقم الفاتورة + المبلغ + التاريخ + رقم حساب الإيراد  AND  invoice uncollected  AND  main class = investment',
    notWhen: BI('أي عدم تطابق أو فاتورة محصّلة/ملغاة/غير موجودة يرفض الصف ويُعاد للأمانة بسبب الرفض.', 'Any mismatch, or a collected / cancelled / missing invoice, rejects the row and returns it to the Amanah with the reason.'),
    feed: BI('طبقة fileExclusions في الطلب (تُحفظ على الجهاز) + فواتير مرفوعة سابقًا في بيانات العرض. التحقق: server/exclusionUpload.js.', 'The fileExclusions overlay in the request (kept on the device) + earlier uploads in the demo data. Validation: server/exclusionUpload.js.')
  },
  'ATT-1': {
    what: BI('فواتير أفادت الأمانة بإفادة مكتوبة بأنها غير قابلة للتحصيل. القناة والقالب نفسهما للتعديات.', 'Invoices the Amanah has stated in writing are not collectible. Same channel and template as encroachments.'),
    basedOn: [BI('ملف الأمانة (Excel) عبر قالب الرفع', 'The Amanah\'s Excel file through the upload template')],
    rule: 'row in an uploaded file  AND  reason = «إفادات الأمانات»  AND  full match on the key columns  AND  invoice uncollected',
    notWhen: BI('مثل R8، دون شرط التصنيف الاستثماري.', 'Same as R8 without the investment-class condition.'),
    feed: BI('مثل R8 (fileExclusions + بيانات العرض).', 'Same as R8 (fileExclusions + demo data).')
  },
  'CR-1': {
    what: BI('فواتير مكلّف سجله التجاري محذوف أو ملغى؛ لا طرف يُطالَب.', 'Invoices of a customer whose commercial registration is Deleted or Cancelled; there is no party left to claim from.'),
    basedOn: [BI('بلدي: فاتورة المكلف ورقم السجل', 'Balady: the customer\'s invoice and registration number'), BI('عرض السجل التجاري (CR view): حالة السجل الخام Crstatus', 'The commercial-registration view: the raw status Crstatus')],
    rule: 'invoice.crNo ↔ CR view  AND  Crstatus ∈ cfg.crStatuses (default: Deleted, Cancelled)  →  exclude (uncollected only)',
    notWhen: BI('«معلّق» (Suspended) و«نشط» (Active) لا يستبعدان. الحالة الخام تُحفظ كما وردت.', '«Suspended» and «Active» do not exclude. The raw status is kept as received.'),
    feed: BI('عمود crSt لكل فاتورة + بت CR-1؛ المحرك يسقط البت إن لم تكن الحالة ضمن cfg.crStatuses.', 'The crSt column on each invoice + the CR-1 bit; the engine drops the bit when the status is not in cfg.crStatuses.')
  },
  'DUP-1': {
    what: BI('فاتورة صدرت مرتين للمكلف نفسه في اليوم نفسه برقم مختلف؛ الأقدم رقمًا هي الصحيحة وتُستبعد البقية. اكتشاف بالذكاء الاصطناعي.', 'An invoice issued twice to the same customer on the same day under a different number; the earliest-numbered is the real one and the others are excluded. AI-assisted detection.'),
    basedOn: [BI('تحصيل: العميل، المبلغ، المنتج، رقم حساب الإيراد، تاريخ الإصدار، رقم الفاتورة', 'Tahseel: customer, amount, product, revenue account, issue date, invoice number')],
    rule: 'group by (customerId, amount, product, revenueAccount, issueDate)  → group size > 1  →  keep the smallest invoice number, EXCLUDE the others\nsame values with a DIFFERENT issue year = a yearly repeat, NOT a duplicate',
    notWhen: BI('نفس القيم في سنوات مختلفة (مثل رسوم سنوية) ليست تكرارًا. نادرة الحدوث الآن.', 'The same values in different years (for example an annual fee) are not duplicates. Rare now.'),
    feed: BI('الدالة findDuplicates() في iim.js (للمنطق والاختبار)؛ وفي العرض فاتورتان توأمان مبذورتان بنطاق ترقيم محجوز + علم DUPLICATE_WF.', 'The findDuplicates() function in iim.js (logic and tests); in the demo, seeded twin invoices in a reserved serial range + the DUPLICATE_WF flag.')
  }
};

/** the rows of the exclusions tab, in R1…R11 order, with the live engine values (priority, bit) attached */
export function exclusionDocs() {
  return EXCLUSION_REASONS.map((r) => {
    const rule = ruleById(r.ruleId) || {}; const idx = RULE_IDS.indexOf(r.ruleId);
    return { ...r, ...D[r.ruleId], source: EXCLUSION_SOURCE_OF_RULE[r.ruleId], priority: rule.priority, bit: idx >= 0 ? 1 << idx : null, bitIndex: idx, approval: rule.approval, effectiveFrom: rule.effectiveFrom, defaultEnabled: rule.defaultEnabled };
  });
}
export const precedenceList = () => EXCLUSION_RULES.filter((r) => r.priority < 99).sort((a, b) => a.priority - b.priority).map((r) => r.id);

/* ---------------------------------------------------------------------------------------------------------------------------------------- formulas */
// groups of formulas: [{ title, intro?, rows: [{ name, f, meaning, where }] }]
export const FORMULA_GROUPS = [
  { title: BI('الهوية المحاسبية (يجب أن تصح دائمًا)', 'Accounting identities (must always hold)'),
    intro: BI('هذه المعادلات تُختبر آليًا على 14 تركيبة تصفية. أي شاشة تخالفها فيها خطأ.', 'These identities are tested on 14 filter combinations. A screen that breaks one has a bug.'),
    rows: [
      { name: BI('إجمالي المفوتر', 'Gross billed'), f: 'gross = collected + uncollectedTotal + cancelled\ngross = exclusions + net', meaning: BI('كل فاتورة تُحسب مرة واحدة: إما محصّلة أو غير محصّلة (قابلة أو مستبعدة) أو ملغاة.', 'Every invoice is counted once: collected, uncollected (collectible or excluded) or cancelled.'), where: 'src/data/kpis.js · kpiOf()' },
      { name: BI('صافي المفوتر', 'Net billed'), f: 'net = gross − exclusions − cancelled\nnet = collected + collectible', meaning: BI('أساس نسبة التحصيل.', 'The base of the collection rate.'), where: 'server/engine.js · derive()' },
      { name: BI('الإجمالي غير المحصّل', 'Total uncollected'), f: 'uncollectedTotal = collectible + excluded\ncollectible = net − collected', meaning: BI('غير المحصّل يشمل المستبعد؛ والقابل للتحصيل لا يشمله.', 'Uncollected includes the excluded; collectible does not.'), where: 'src/data/kpis.js' },
      { name: BI('الاتجاه الصحيح للأرقام', 'Sign and order'), f: 'gross ≥ net ≥ collected ≥ 0   (tolerance 0.5 SAR)', meaning: BI('لا قيمة سالبة ولا محصّل أكبر من الصافي.', 'No negative value and no collected amount above net.'), where: 'server/engine.js · checkEquation()' },
      { name: BI('أخرى', '«Other» class'), f: 'invoices with main class «أخرى» are OUTSIDE gross billed (D7)', meaning: BI('ضريبة وبيع وثائق ومرتجعات…: لا تغيّر أي مؤشر.', 'VAT, sale of documents, refunds…: they change no KPI.'), where: 'server/engine.js · includeOther' }
    ] },
  { title: BI('النسب', 'Ratios'),
    rows: [
      { name: BI('نسبة التحصيل', 'Collection rate'), f: 'collectionRate = collected ÷ net × 100   (Σ collected ÷ Σ net — never an average of rates)', meaning: BI('الصافي صفر أو غير صالح ← «غير متاحة»، لا 0 ولا ∞. القيمة لا تتجاوز 100%.', 'A zero or invalid denominator gives «not available», never 0 or ∞. Never above 100%.'), where: 'revenueMetrics.js · ratio()' },
      { name: BI('نسبة الاستبعاد', 'Exclusion rate'), f: 'exclusionRate = exclusions ÷ gross × 100\nexcludedShareOfUncollected = excluded ÷ uncollectedTotal', meaning: BI('حجم ما خرج من القابل للتحصيل.', 'How much left the collectible base.'), where: 'server/engine.js · rates' },
      { name: BI('نسبة التغطية', 'Coverage ratio'), f: 'coverage = collected(date of payment, 1 Jan → reporting date) ÷ communicatedBudget(chapters 1–3)', meaning: BI('تغطية التحصيل للميزانية المبلغة؛ مقياس تحصيل لا مصروف.', 'How much of the communicated budget collection covers; a collection measure, not spending.'), where: 'collectionGoal.js' },
      { name: BI('نسبة تحقق المستهدف', 'Target achievement'), f: 'achievement = collected ÷ annualRevenueTarget', meaning: BI('لا مستهدف صالح ← لا نسبة، والتحصيل الصفري ليس نجاحًا.', 'No valid target → no ratio; zero collection is never success.'), where: 'collectionGoal.js · computeGoal()' },
      { name: BI('تغيّر بالنقاط', 'Change in points'), f: 'pp = (rateNow − ratePrev) × 100   (from UNROUNDED ratios, rounded once)', meaning: BI('يُقارَن بالفترة المماثلة السابقة.', 'Compared with the matching previous period.'), where: 'revenueMetrics.js · ppChange()' }
    ] },
  { title: BI('الاستحقاق والتقادم', 'Due dates and ageing'),
    rows: [
      { name: BI('أيام التأخر', 'Days overdue'), f: 'daysOverdue = max(0, cutoff − (dueDate + graceDays))   (graceDays default 0)', meaning: BI('الأقساط المستقبلية ليست متأخرات.', 'Future instalments are never arrears.'), where: 'derive() · cfg.graceDays' },
      { name: BI('الحالة الموحدة للفاتورة', 'Unified invoice state'), f: 'cancelled > excluded > collected > objection > unresolved-linkage > ineligible-referral > partial > overdue > not-due', meaning: BI('ترتيب الفحص: أول شرط يتحقق يحدد الحالة.', 'Evaluated in this order: the first condition that holds decides.'), where: 'derive() · cls' },
      { name: BI('شرائح العمر', 'Age buckets'), f: '0 (not due) · 1–30 · 31–90 · 91–180 · 180+ days', meaning: BI('تُستخدم في قوائم التحصيل وغرفة القرارات.', 'Used in the collection lists and the Decision Room.'), where: 'engine.js · agingBucket()' },
      { name: BI('أساس القياس', 'Measuring date'), f: 'asOf = collectionsAsOf = "periodEnd" ? min(periodEnd, cutoff) : cutoff', meaning: BI('الفترة المغلقة تُقاس عند نهايتها، والمفتوحة عند تاريخ القطع.', 'A closed period is measured at its own end, an open one at the cutoff.'), where: 'cfg.collectionsAsOf' }
    ] },
  { title: BI('المستهدفات والتخطيط', 'Targets and planning'),
    rows: [
      { name: BI('المستهدف السنوي للإيراد', 'Annual revenue target'), f: 'revenueTarget = coverageTarget × communicatedBudget', meaning: BI('الميزانية المبلغة للأبواب 1–3 (توضيحية في العرض).', 'The communicated budget of chapters 1–3 (illustrative in the demo).'), where: 'planTargets.js' },
      { name: BI('الفوترة المطلوبة', 'Required billing'), f: 'requiredBilling = revenueTarget ÷ collectionTarget', meaning: BI('نسبتا التغطية والتحصيل مستقلتان: تغيير التحصيل وحده يحرّك الفوترة المطلوبة لا مستهدف الإيراد. ويُنبَّه إن كان مستهدف الفوترة أقل منها.', 'Coverage and collection are independent: changing only the collection target moves required billing, not the revenue target. A warning shows when the billing target is below it.'), where: 'planTargets.js · billingCheck()' },
      { name: BI('إجمالي الوزارة', 'Ministry total'), f: 'Ministry = Σ entities (revenue target, budget, required billing); coverage = Σ target ÷ Σ budget', meaning: BI('الافتراضي: 66% تغطية و68% تحصيل (توضيحيان)، والتخصيص حسب الأمانة معطّل.', 'Defaults: 66% coverage and 68% collection (illustrative); the per-Amanah override is off.'), where: 'planTargets.js · totalTargets()' },
      { name: BI('التوزيع الشهري', 'Monthly split'), f: 'monthTarget[m] = revenueTarget × weight[m]   (Σ weights = 1, default 1/12)', meaning: BI('يُعاد التطبيع إلى 100% عند الحفظ.', 'Rescaled to 100% on save.'), where: 'planTargets.js' }
    ] },
  { title: BI('التقدير والاحتمال («أين نحن من الخطة»)', 'Estimate and probability'),
    intro: BI('تقدير بسيط قابل للشرح وليس نموذج تنبؤ؛ يظهر موسومًا «تقدير تجريبي – للعرض التوضيحي».', 'A simple, explainable projection, not a forecasting model; it is labelled «demonstration estimate».'),
    rows: [
      { name: BI('تقدير نهاية السنة', 'Year-end estimate'), f: 'avg = mean(collection of the last ≤ 3 CLOSED months)\nestimate = collectedClosedMonths + max(currentMonthCollected, avg) + avg × (monthsLeft − 1)', meaning: BI('يُعاد كل شهر عند وصول الفعلي.', 'Redone every month when actuals arrive.'), where: 'planForecast.js · forecastYear()' },
      { name: BI('الاحتمال', 'Probability'), f: 'p = 1 − Φ((target − estimate) ÷ (sd × √monthsLeft)),  clamped to [0.01, 0.99]\np = 1 if collected ≥ target', meaning: BI('Φ توزيع طبيعي معياري؛ sd انحراف الأشهر المغلقة.', 'Φ is the standard normal CDF; sd is the spread of the closed months.'), where: 'planForecast.js · normalCdf()' },
      { name: BI('سبب «الفوترة غير كافية»', '«Billing is insufficient»'), f: 'maxTotal = collected + standingUncollected + avgBilling × monthsLeft\nif maxTotal < target → billing_insufficient', meaning: BI('حتى تحصيل 100% لا يبلغ المستهدف.', 'Even collecting 100% cannot reach the target.'), where: 'planForecast.js' },
      { name: BI('الانحراف حتى تاريخه', 'Deviation to date'), f: 'deviation = collected − plannedToDate;  deviation% = deviation ÷ plannedToDate', meaning: BI('المخطط حتى اليوم = تراكمي الأشهر السابقة + حصة الشهر الحالي بنسبة ما انقضى منه.', 'Planned to date = cumulative previous months + this month\'s share by the elapsed fraction.'), where: 'planForecast.js' }
    ] },
  { title: BI('الأولوية والترتيب', 'Priority and ranking'),
    rows: [
      { name: BI('درجة الأولوية', 'Priority score'), f: 'score = 0.40 × (amount ÷ maxAmount)\n      + 0.25 × min(1, maxDaysOverdue ÷ 180)\n      + 0.25 × actionability\n      + 0.10 × evidenceQuality', meaning: BI('المبلغ = المتأخر والجزئي فقط (لا ما لم يحن). تُستخدم في قوائم التحصيل وغرفة القرارات؛ لا تُسمّى استردادًا متوقعًا.', 'Amount = overdue and partial only (not what is not yet due). Used by the collection lists and the Decision Room; never called an expected recovery.'), where: 'revenueInsights.js · PRIORITY_WEIGHTS' },
      { name: BI('شذوذ القيمة', 'Value anomaly'), f: 'gross ÷ mean(gross of the same Amanah × source, excluding itself) ≥ 10   AND  group size ≥ 30', meaning: BI('فاتورة بعيدة عن معدل الأمانة.', 'An invoice far from its Amanah\'s baseline.'), where: 'server/lists.js · VALUE_ANOMALY_MULTIPLE' }
    ] },
  { title: BI('الهوية والتصنيف', 'Identity and classification'),
    rows: [
      { name: BI('رقم الفاتورة', 'Invoice number'), f: 'invoiceId = `${billerId}-${sadadNumber}`   e.g. 177-409280122502   (177 = central billing, 171 = Housing, others = Amanah billers)', meaning: BI('رقم السداد وحده غير فريد بين المفوترين.', 'A Sadad number alone is not unique across billers.'), where: 'server/names.js · invoiceIdFor()' },
      { name: BI('التصنيف', 'Classification'), f: 'mainClass = GFS[revenueAccount].main  (biller override: advertising boards = municipal if billed by 177, investment if billed by an Amanah)', meaning: BI('الجدول من ملف «تصنيف الإيرادات»؛ حساب غير معروف = «غير مصنف» ويُحتسب.', 'The table comes from the revenue-classification file; an unknown account is «unclassified» and is counted.'), where: 'src/data/iim.js · classify()' },
      { name: BI('مصدر الفاتورة', 'Invoice origin'), f: 'origin = billerId ∈ CENTRAL_BILLER_IDS ? central : internal', meaning: BI('المركزي = الفوترة المركزية للوزارة (177).', 'Central = the Ministry\'s central billing (177).'), where: 'iim.js · CENTRAL_BILLER_IDS' }
    ] }
];

/* ---------------------------------------------------------------------------------------------------------------------------------------- developer reference */
export const DEV_REFERENCE = {
  flow: [
    BI('المتصفح يرسل كل طلب بجسم واحد: { scope, cfg, decisions, links, fileExclusions, … } إلى /api/<endpoint>.', 'The browser sends every request with one body: { scope, cfg, decisions, links, fileExclusions, … } to /api/<endpoint>.'),
    BI('الخدمة تبني سياقًا makeCtx(st, req) فيه قواعد الاستبعاد المفعّلة وطبقات القرارات والروابط والملفات، ثم تمرّ على كل فاتورة بالدالة derive(ctx, i, asOf) دون تخصيص ذاكرة.', 'The service builds a context makeCtx(st, req) holding the enabled rules and the decisions / links / files overlays, then runs derive(ctx, i, asOf) over each invoice without allocating.'),
    BI('كل الأرقام في الواجهة (البطاقات، القوائم، الرسوم، التصدير، المساعد) تأتي من النتيجة نفسها؛ ممنوع إعادة حساب استبعاد أو نسبة في صفحة.', 'Every figure in the UI (cards, lists, charts, exports, the assistant) comes from the same result; no page may recompute an exclusion or a ratio.')
  ],
  endpoints: [
    ['POST /api/snapshot', 'totals, KPIs, ruleStats (primaryCount / primaryAmount per reason), byAmanah, bySource, equation checks'],
    ['POST /api/worklist · /api/list', 'uncollected / collected invoice rows (rowOut: ids, class, reason, source, objection status, duplicateOf, file)'],
    ['POST /api/invoice', 'one invoice: record, derived figures, exclusion records, risk flags, source records'],
    ['POST /api/exclusion-check', 'row validation for the upload template (accepted / rejected + reason code)'],
    ['POST /api/series · /api/bridge · /api/risk · /api/sources · /api/quality', 'monthly series, reconciliation bridge, risk radar, source report, data quality'],
    ['GET /api/export.csv', 'streamed CSV of the current filters']
  ],
  columns: [
    ['idKey, issue, due, gross, adjAmt/adjDay', 'invoice key (year × 1e8 + serial), epoch days, amount, approved adjustment'],
    ['payStart / payCount + pDay, pAmt, pCh', 'payments (separate table): date, amount, channel'],
    ['cancelDay', 'source cancellation date (0 = none)'],
    ['exMask / exAppr', 'bit per exclusion rule: candidate / approved (bit index = position in RULE_IDS, catalog.js)'],
    ['flags', 'OBJECTION · MISSING_ID · AMT_CONFLICT · DUPLICATE_WF · FIXTURE · UPLOADED …'],
    ['objSt · crSt · efaa · cstat', 'appeal status 1–5 (Efaa today, Mumtathil also later) · CR status · Efaa status code · contract-link state'],
    ['payer · ent · scope · src · item · gfs', 'customer index · Amanah · central/internal · revenue source · item · revenue account index'],
    ['exec · contract', 'Sanad request index · Furas contract index']
  ],
  config: [
    ['cfg.rules[ruleId]', 'switch a reason on / off (what-if). Defaults: every approved reason on.'],
    ['cfg.crStatuses', 'raw CR statuses that qualify for R10 (default Deleted, Cancelled)'],
    ['cfg.graceDays · cfg.collectionsAsOf', 'grace period (0) · measuring basis (periodEnd | cutoff)'],
    ['EXCLUSIONS_AUTO_APPLY (iim.js)', 'true: reasons apply unless a reviewer rejects them (assumption S6)'],
    ['REFERRED_CANCELLED_STAYS_BILLED (iim.js)', 'true: an invoice cancelled because of a referral stays billed and is excluded as R3 (S9)'],
    ['SERVICE_COMPANY_LIST · OBJECTION_STATUSES (iim.js)', 'the R2 customer list · the R7 status → decision map'],
    ['SHOW_INTERNAL_NOTES (uiFlags.js)', 'false: hides explanatory notes written for the team']
  ],
  addRule: [
    BI('1. أضف المعرّف في RULE_IDS (catalog.js) — موضعه هو رقم البت. 2. أضف الكائن في EXCLUSION_RULES بنفس الترتيب مع priority.', '1. Add the id to RULE_IDS (catalog.js) — its position is the bit number. 2. Add the object to EXCLUSION_RULES in the same order with a priority.'),
    BI('3. أضف السبب إلى EXCLUSION_REASONS ومصدره في iim.js. 4. إن كانت القاعدة محسوبة لا مخزَّنة فأضف شرطها في derive(). 5. أضف اختبارًا إيجابيًا وسلبيًا في tests/platform.test.mjs، وحدّث هذه الصفحة (dictionaryDocs.js).', '3. Add the reason and its source to EXCLUSION_REASONS in iim.js. 4. If the rule is computed rather than stored, add its condition in derive(). 5. Add a positive and a negative test in tests/platform.test.mjs and update this page (dictionaryDocs.js).')
  ]
};
