// ============================================================================
// Source profiles and DOCUMENTED DEMO ASSUMPTIONS for each revenue source.
//
// The Excel files in the data bank are SCHEMAS (column names, roles, types, descriptions): they contain no rows and
// no value domains. Where a rule is not stated in a schema, the demo uses an assumption listed here. Every
// assumption is a demo setting - it is NOT a ministry-approved rule - and can be changed in one place (the
// `params` objects below are read by the generator and by the record builder).
// ============================================================================
const BI = (ar, en) => ({ ar, en });

/* ------------------------------------------------------------------ tunable parameters (demo settings) */
export const PARAMS = {
  tobacco: {
    feePercents: [2.5, 5, 7.5, 10],     // TOTAL_PERCENTAGE drawn per disclosure (demo values)
    walletShare: 0.3,                    // share of invoices partly/fully settled from the facility wallet on the issue day
    replacedShare: 0.025,                // share of disclosures later replaced by an amended disclosure (original invoice cancelled)
    expiryDays: 30                       // SADAD expiry measured from the issue date (also the due date)
  },
  accommodation: {
    feePercents: [2.5, 5, 5, 7.5],
    expiryDays: 30,
    avgRoomsPerFacility: 40
  },
  white_lands: {
    zoneRates: [25, 15, 8, 4],           // fee per m2 per year by tax zone A..D (SAR) - demo values; area = invoice amount / rate
    ownerSplit: [0.75, 0.17, 0.08],      // share of deeds with 1 / 2 / 3 owners (one invoice per owner)
    payProbability: 0.32,                // eventual payment probability (the monthly reports show 11-22% collected within the first quarter)
    earlyPayShare: 0.4,                  // share of payers that pay within the first weeks after publication
    dueDays: 45,                         // LastTimeToPay after publication
    extensionShare: 0.12,                // unpaid invoices with an extension request
    extensionApproved: 0.55,
    extensionDays: [30, 60, 90],
    objectionShare: 0.05,                // unpaid invoices with an objection
    enforcementShare: 0.05,              // never-paid invoices followed in the white-lands enforcement file
    avgDeedFee: 650000
  },
  licenses: {
    billStatusCodes: { 0: 'غير مدفوعة', 1: 'مدفوعة', 2: 'ملغاة', 3: 'ملغاة', 9: 'بانتظار الاعتماد', 10: 'مرفوضة', 11: 'قيد التجهيز' }
  },
  fines: {
    differentValueShare: 0.03            // violations whose "violation value" differs from the "invoice value" (kept as a data-quality note)
  }
};

/* ------------------------------------------------------------------ system of record per source and import versions */
export const IMPORT_VERSIONS = { tahseel_central: 6, tahseel_internal: 4, incorta_items: 2, makeen: 5, furas: 4, sanad: 3, efaa_v2: 7, sadad: 9, tobacco: 3, accommodation: 3, white_lands: 5, balady: 4, violations: 7, white_lands_enforcement: 2 };

// revenue-account (GFS) codes of the sources, as used by the reports
export const GFS_BY_SOURCE = { investment: '1421901', fines: '1438001', municipal_fees: '142113', licenses: '142162', accommodation: '11442', tobacco: '1422110', white_lands: '1422111', housing_sales: '1422112' };

export const SOURCE_PROFILE = {
  tobacco: {
    label: BI('التبغ', 'Tobacco'),
    files: ['Tobacco_Schema.xlsx'],
    sheets: ['INVOICES', 'DISCLOSURES', 'SCHEDULES', 'FACILITIES'],
    level: BI('فاتورة (INVOICES) مرتبطة بإفصاح شهري (DISCLOSURES) وجدولة (SCHEDULES) ومنشأة (FACILITIES)', 'Invoice linked to a monthly disclosure, a schedule and a facility'),
    keys: ['INVOICE_KEY', 'DISCLOSURE_KEY', 'FACILITY_KEY', 'SADAD_NO'],
    supplier: BI('منصة إفصاح التبغ (جداول TB_*) عبر إنكورتا، ثم تحصيل للحالة والسداد', 'Tobacco disclosure platform (TB_* tables) via Incorta, then Tahseel for status and collection')
  },
  accommodation: {
    label: BI('الإيواء', 'Accommodation'),
    files: ['ACCOMMODATION_Schema.xlsx (غير مرفق لكنه في نفس المجلد)'],
    sheets: ['Invoices', 'Disclosures', 'Schedules', 'Facilities'],
    level: BI('فاتورة مرتبطة بإفصاح إشغال (أيام × سعر يومي) وجدولة ومنشأة', 'Invoice linked to an occupancy disclosure (days x daily price), a schedule and a facility'),
    keys: ['INVOICE_KEY', 'DISCLOSURE_KEY', 'FACILITY_KEY', 'SADAD_NO'],
    supplier: BI('منصة إفصاح الإيواء عبر إنكورتا، ثم تحصيل', 'Accommodation disclosure platform via Incorta, then Tahseel')
  },
  white_lands: {
    label: BI('الأراضي البيضاء', 'White lands'),
    files: ['White_Lands_Schema.xlsx', 'Idle_lands_Schema.xlsx', 'Revenues_Schema.xlsx (LAND_FEES_REVENUES)'],
    sheets: ['DS_038_IdleLandInvoices', 'DS_088_IdleLandDeeds', 'DS_037_IdleLandDetails', 'DS_035_IdleLandOwners', 'DS_040_IdleLandObjections', 'DS_041_TimeLimitRequest', 'DS_039_IdleLand_Violations', 'Basic_IDLE_LANDS_INFO_BS', 'LAND_FEES_REVENUES'],
    level: BI('فاتورة لكل مالك (DeedOwnerRequestId) على صك وقطعة أرض، ضمن دورة فرز ومرحلة', 'One invoice per deed-owner request on a deed and a land plot, inside a sorting cycle and stage'),
    keys: ['InvoiceId', 'SadadNum', 'LandfessDeedId', 'DeedOwnerRequestId', 'LandId', 'FarzCycleId'],
    supplier: BI('منظومة الأراضي البيضاء (DS_035..DS_088)، وتحصيل لا يحمل رسومها حسب الاجتماع', 'White-lands system (DS_035..DS_088); Tahseel does not carry these fees per the meeting')
  },
  licenses: {
    label: BI('التراخيص', 'Licences'),
    files: ['LICENSES_DATASET_Schema.xlsx', 'Revenues_Schema.xlsx (BALADY_BILLS)'],
    sheets: ['DS_001_Issued_Commercial_Licenses', 'DS_002_Commercial_License_Requests', 'Building_license_vw', 'medical_license_bs', 'Housing_DM', 'BALADY_BILLS'],
    level: BI('فاتورة مرتبطة برخصة وطلب في منصة بلدي (الفاتورة الأخيرة فقط في سجل الرخصة التجارية)', 'Bill linked to a licence and a request in Balady (a commercial licence row carries only its LAST bill)'),
    keys: ['BILL_NUMBER', 'LIC_ID', 'REQ_ID', 'DATA_KEY'],
    supplier: BI('منصة بلدي (BALADY_BILLS) وتقارير الأمانات الداخلية', 'Balady (BALADY_BILLS) and the Amanah internal reports')
  },
  fines: {
    label: BI('الغرامات والجزاءات', 'Fines and penalties'),
    files: ['Violations_Report_BS_Schema.xlsx'],
    sheets: ['Violations_report_BV'],
    level: BI('مخالفة واحدة في زيارة رقابية (صف لكل مخالفة) وقيمتان: الفاتورة والمخالفة', 'One violation row per inspection visit with two amounts: invoice value and violation value'),
    keys: ['معرف_المخالفة', 'رقم_المخالفة_في_ايفاء', 'رقم_السداد', 'رقم_الزيارة'],
    supplier: BI('إيفاء / ممتثل (تقرير المخالفات عبر إنكورتا)', 'Efaa / Mumathil (violations report via Incorta)')
  },
  municipal_fees: {
    label: BI('الرسوم البلدية', 'Municipal fees'),
    files: ['Revenues_Schema.xlsx (ENT_REVENUES)'],
    sheets: ['ENT_REVENUES'],
    level: BI('بند فاتورة (DETAIL_ID) والمبلغ الإجمالي مكرر على كل بند', 'Invoice line (DETAIL_ID); the invoice total is repeated on every line'),
    keys: ['ACCOUNT_NO', 'REVENUE_KEY', 'REQUEST_ID'],
    supplier: BI('إنكورتا - طبقة الإيرادات الموحدة', 'Incorta consolidated revenue layer')
  },
  housing_sales: {
    label: BI('المبيعات السكنية', 'Residential sales'),
    files: ['Housing_DM (ضمن LICENSES_DATASET_Schema.xlsx) - ليس مصدر فواتير'],
    sheets: ['Housing_DM'],
    level: BI('لا يوجد مخطط فواتير للمبيعات السكنية في الملفات؛ استُخدمت بنية الفاتورة الموحدة فقط', 'No sales-invoice schema in the files; only the unified invoice structure is used'),
    keys: ['SADAD'],
    supplier: BI('قطاع الإسكان (لا مخطط مرفق)', 'Housing sector (no schema attached)')
  },
  investment: {
    label: BI('الاستثمار', 'Investment'),
    files: ['(لا ملف جديد - من العقود والتحليل السابق)'],
    sheets: [],
    level: BI('فاتورة دفعة عقد', 'Contract installment invoice'),
    keys: ['contract_no', 'installment_no'],
    supplier: BI('فرص', 'Furas')
  }
};

/* ------------------------------------------------------------------ assumptions (ids are shown with every record they touch) */
export const ASSUMPTIONS = [
  { id: 'A-ALL-1', sources: ['all'], text: BI('ملفات المخطط تحتوي أعمدة وأوصافاً فقط بلا صفوف: أنماط القيم (مبالغ، حالات، نسب) افتراضات تجريبية مستوحاة من التقارير الشهرية.', 'The schema files hold columns and descriptions only, no rows: value patterns (amounts, statuses, percentages) are demo assumptions inspired by the monthly reports.') },
  { id: 'A-ALL-2', sources: ['all'], text: BI('كل أسماء الأشخاص والمنشآت والهويات والسجلات مولّدة اصطناعياً؛ لا تُنسخ من أي ملف.', 'All person, facility, identity and registry values are synthetic; none is copied from a file.') },
  { id: 'A-ALL-3', sources: ['all'], text: BI('الفاتورة الموحدة واحدة مهما تعددت أنظمة أو بنود أو ملفات تحمل سجلها؛ المبلغ يُحتسب من رأس الفاتورة مرة واحدة.', 'There is ONE unified invoice however many systems, items or files carry it; the amount is taken once from the header.') },
  { id: 'A-TB-1', sources: ['tobacco'], text: BI('مبلغ الفاتورة = أساس الإفصاح × نسبة الاحتساب + الضريبة، والضريبة (TAX) جزء من المبلغ ومعروضة منفصلة (15%).', 'Invoice amount = disclosed base x calculation percentage + VAT; VAT (TAX) is inside the amount and shown apart (15%).') },
  { id: 'A-TB-2', sources: ['tobacco'], text: BI('FROM_WALLET دفعة تُخصم من محفظة المنشأة يوم الإصدار؛ والباقي يُسدد عبر سداد.', 'FROM_WALLET is a payment deducted from the facility wallet on the issue day; the rest is paid through SADAD.') },
  { id: 'A-TB-3', sources: ['tobacco'], text: BI('أكواد وأسماء حالات الفاتورة والنوع غير مذكورة في المخطط: المستخدم هنا مفردات تجريبية (صادرة، مسددة جزئياً، مسددة، منتهية الصلاحية، ملغاة).', 'Invoice status and type vocabularies are not in the schema; the demo vocabulary is used (issued, partly paid, paid, expired, cancelled).') },
  { id: 'A-TB-4', sources: ['tobacco', 'accommodation'], text: BI('تاريخ انتهاء الصلاحية يعادل تاريخ الاستحقاق؛ الفاتورة المنتهية الصلاحية غير المسددة تبقى مديونية ولا تُعتبر ملغاة.', 'SADAD expiry equals the due date; an expired unpaid invoice stays a debt and is NOT treated as cancelled.') },
  { id: 'A-TB-5', sources: ['tobacco', 'accommodation'], text: BI('الجدولة التي لم يُقدَّم عنها إفصاح لا تنتج فاتورة ولا تدخل غير المحصل (التزام محتمل لا ذمة).', 'A schedule with no disclosure produces no invoice and is not part of uncollected (a possible obligation, not a receivable).') },
  { id: 'A-TB-6', sources: ['tobacco'], text: BI('الإفصاح المعدّل (REPLACED_WITH_KEY) يلغي فاتورة الإفصاح الأصلي ويصدر فاتورة جديدة؛ يُخصم الملغى مرة واحدة.', 'An amended disclosure (REPLACED_WITH_KEY) cancels the original disclosure invoice and issues a new one; the cancelled amount is deducted once.') },
  { id: 'A-AC-1', sources: ['accommodation'], text: BI('مبلغ الفاتورة = أيام الإشغال المفصح عنها × السعر اليومي للنسبة، وهو أيضاً إجمالي الإشغال × نسبة الاحتساب؛ الضريبة داخل المبلغ.', 'Invoice amount = disclosed occupancy days x daily price of the percentage, which also equals total occupancy x calculation percentage; VAT is inside the amount.') },
  { id: 'A-AC-2', sources: ['accommodation'], text: BI('الإفصاحات المرفوضة (REJECTED_OCCUPANCIES) لا تنتج فاتورة؛ تُعرض أعدادها فقط.', 'Rejected occupancy lines (REJECTED_OCCUPANCIES) produce no invoice; only their counts are shown.') },
  { id: 'A-WL-1', sources: ['white_lands'], text: BI('تصدر فاتورة لكل مالك على الصك (DeedOwnerRequestId) بنسبة ملكيته؛ تعدد الملاك لا يعني تكراراً.', 'One invoice per owner of a deed (DeedOwnerRequestId) in proportion to the ownership share; several owners are not duplicates.') },
  { id: 'A-WL-2', sources: ['white_lands'], text: BI('المساحة المقيّمة = قيمة الفاتورة ÷ سعر المتر للشريحة الضريبية (قيم تجريبية)؛ ليست معادلة معتمدة.', 'Evaluated area = invoice amount / zone rate per m2 (demo values); not an approved formula.') },
  { id: 'A-WL-3', sources: ['white_lands'], text: BI('موجة الفوترة السنوية في يناير تتبع التقارير الشهرية (التحصيل 11-22% في الربع الأول)؛ باقي الأشهر فواتير تكميلية صغيرة.', 'The annual billing wave is in January as in the monthly reports (11-22% collected in the first quarter); other months are small supplementary invoices.') },
  { id: 'A-WL-4', sources: ['white_lands'], text: BI('طلب التمديد المعتمد يدفع آخر موعد للسداد (LastTimeToPay) بمقدار المدة الممنوحة؛ المرفوض لا يغيّره.', 'An approved extension request moves LastTimeToPay by the period granted; a refused one does not.') },
  { id: 'A-WL-5', sources: ['white_lands'], text: BI('الاعتراض المفتوح يجعل الفاتورة بحالة «قيد الاعتراض» وتبقى ضمن غير المحصل؛ ولا تُستبعد تلقائياً.', 'An open objection puts the invoice in the "under objection" state; it stays in uncollected and is NOT excluded automatically.') },
  { id: 'A-WL-6', sources: ['white_lands'], text: BI('غرامة مخالفة الأرض (DS_039) معلومة مرتبطة بالفاتورة ولا تُضاف إلى مبلغها (منعاً للازدواج).', 'The land-violation fine (DS_039) is information linked to the invoice and is NOT added to its amount (no double counting).') },
  { id: 'A-WL-7', sources: ['white_lands'], text: BI('ملف التنفيذ الشامل للأراضي البيضاء مسار ثالث مستقل عن إيفاء وسند: يربط رقم أمر التنفيذ بالفواتير؛ ومبلغ التنفيذ لا يُضاف للمديونية.', 'The white-lands comprehensive enforcement file is a third track apart from Efaa and Sanad: it maps the order number to invoices; the execution amount is not added to the debt.') },
  { id: 'A-LI-1', sources: ['licenses'], text: BI('حالات الفاتورة 9 و10 و11 (بانتظار الاعتماد، مرفوضة، قيد التجهيز) ليست مطالبة قابلة للتحصيل ولا تُولَّد كفواتير؛ تُعدّ في جودة المصدر فقط.', 'Bill statuses 9, 10 and 11 (awaiting approval, rejected, in preparation) are not collectible demands and are not generated as invoices; they are counted in source quality only.') },
  { id: 'A-LI-2', sources: ['licenses'], text: BI('الحالتان 2 و3 (ملغاة) تُعاملان كفاتورة ملغاة تُخصم مرة واحدة.', 'Statuses 2 and 3 (cancelled) are a cancelled invoice, deducted once.') },
  { id: 'A-LI-3', sources: ['licenses'], text: BI('سجل الرخصة التجارية يحمل آخر فاتورة فقط؛ الفواتير السابقة للرخصة تأتي من BALADY_BILLS ولا تُعدّ مرتين.', 'A commercial-licence row carries only its last bill; earlier bills come from BALADY_BILLS and are not counted twice.') },
  { id: 'A-LI-4', sources: ['licenses'], text: BI('لا يوجد في مخططات الرخص مبلغ رسوم الرخصة التجارية أو رخصة البناء: المبلغ من BALADY_BILLS (BILL_AMOUNT) ومساحة المحل تشتق منه افتراضياً.', 'The commercial and building licence views carry no fee amount: the amount comes from BALADY_BILLS (BILL_AMOUNT) and the shop area is derived from it by assumption.') },
  { id: 'A-LI-5', sources: ['licenses'], text: BI('Housing_DM رخصة سكن بقيمة عقد إيجار وليس فاتورة رسوم: لا تُولَّد منه فواتير.', 'Housing_DM is a housing licence with a rent-contract value, not a fee invoice: no invoices are generated from it.') },
  { id: 'A-FI-1', sources: ['fines'], text: BI('«قيمة الفاتورة» و«قيمة المخالفة» رقمان مختلفان في التقرير: تُحتسب قيمة الفاتورة، وتُعرض قيمة المخالفة، والاختلاف يُعدّ ملاحظة جودة.', '"Invoice value" and "violation value" are two different fields: the invoice value is counted, the violation value is shown, and a difference is a data-quality note.') },
  { id: 'A-FI-2', sources: ['fines'], text: BI('المخالفة غير المعتمدة (حالة الاعتماد) ليست فاتورة بعد ولا تُولَّد؛ والمخالفة التي تتطلب التنبيه لأول مرة لا فاتورة لها.', 'An unapproved violation is not an invoice yet and is not generated; a violation that only requires a first-time warning has no invoice.') },
  { id: 'A-FI-3', sources: ['fines'], text: BI('رقم المخالفة في إيفاء (14 رقماً) نص؛ ويربط الفاتورة بإيفاء دون استبدال حالة تحصيل.', 'The Efaa violation number (14 digits) is text; it links the invoice to Efaa without replacing the Tahseel status.') },
  { id: 'A-RV-1', sources: ['all'], text: BI('في ENT_REVENUES يتكرر TOTAL_AMOUNT على كل بند: تُحتسب الفاتورة مرة بمبلغها ويجب أن يساوي مجموع DETAIL_AMOUNT قيمة الفاتورة.', 'In ENT_REVENUES TOTAL_AMOUNT repeats on every line: the invoice is counted once and the sum of DETAIL_AMOUNT must equal the invoice value.') },
  { id: 'A-RV-2', sources: ['all'], text: BI('تاريخ التسوية (RECONCILITION_DATE) يلي تاريخ السداد بيوم إلى ثلاثة؛ لا يُستخدم تاريخ التسوية بديلاً لتاريخ السداد.', 'The reconciliation date follows the payment date by one to three days; it is never used in place of the payment date.') },
  { id: 'A-HS-1', sources: ['housing_sales'], text: BI('قطاع الإسكان في التقارير الشهرية = رسوم الأراضي البيضاء + المبيعات السكنية (مبالغ صغيرة)؛ لا مخطط فواتير للمبيعات.', 'In the monthly reports the housing sector = white-land fees + residential sales (small amounts); there is no sales-invoice schema.') }
];

export const assumptionsFor = (source) => ASSUMPTIONS.filter((a) => a.sources.includes('all') || a.sources.includes(source));
