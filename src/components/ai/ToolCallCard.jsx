import React, { useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { SkeletonGrid } from './Skeleton';

/* What each field means and, where it's derived rather than raw input, how
   it's calculated — shown in a click-to-reveal tooltip on the cell. Keys not
   listed here render as plain (non-interactive) cells. */
const FIELD_INFO = {
  doc: {
    zh: '从来源平台抓取的账单文件名。',
    en: 'The invoice file name fetched from the source platform.',
    ar: 'اسم ملف الفاتورة الذي تم جلبه من المنصة المصدر.'
  },
  source: {
    zh: '账单来源平台（Tahseel/Makin/Efa/Sanad）。',
    en: 'The source platform this invoice was fetched from (Tahseel/Makin/Efa/Sanad).',
    ar: 'المنصة التي جُلبت منها الفاتورة (Tahseel/Makin/Efa/Sanad).'
  },
  size_kb: {
    zh: '账单文件大小（KB）。',
    en: 'The invoice file size in kilobytes.',
    ar: 'حجم ملف الفاتورة بالكيلوبايت.'
  },
  queued: {
    zh: '表示账单已成功进入接收队列。',
    en: 'Confirms the invoice was successfully placed in the intake queue.',
    ar: 'يؤكد أن الفاتورة أُدرجت بنجاح في قائمة الاستيعاب.'
  },
  fields_extracted: {
    zh: 'OCR 成功提取的字段数量（满分 10 个标准字段）。',
    en: 'Number of fields OCR successfully extracted, out of the 10 standard fields.',
    ar: 'عدد الحقول التي نجح OCR في استخراجها، من أصل 10 حقول قياسية.'
  },
  avg_confidence: {
    zh: '所有提取字段的平均置信度 = 各字段置信度之和 ÷ 字段数。',
    en: 'Average OCR confidence across all extracted fields = sum of per-field confidence ÷ field count.',
    ar: 'متوسط ثقة استخراج جميع الحقول = مجموع ثقة كل حقل ÷ عدد الحقول.'
  },
  low_confidence_fields: {
    zh: '置信度低于 95% 的字段数量。',
    en: 'Count of fields whose extraction confidence fell below 95%.',
    ar: 'عدد الحقول التي كانت ثقة استخراجها أقل من 95٪.'
  },
  fields_mapped: {
    zh: '已重命名/统一到标准模型的字段数量。',
    en: 'Number of fields renamed/standardized into the unified schema.',
    ar: 'عدد الحقول التي تمت إعادة تسميتها وتوحيدها ضمن النموذج الموحّد.'
  },
  unit_currency: {
    zh: '标准化后使用的货币单位。',
    en: 'The currency unit used after standardization.',
    ar: 'وحدة العملة المعتمدة بعد التوحيد.'
  },
  date_format: {
    zh: '标准化后的日期格式（ISO-8601）。',
    en: 'The standardized date format (ISO-8601).',
    ar: 'صيغة التاريخ الموحّدة (ISO-8601).'
  },
  invoice: {
    zh: '本次操作所涉及账单的编号。',
    en: 'The invoice ID this step is operating on.',
    ar: 'الرقم التعريفي للفاتورة التي تخص هذه الخطوة.'
  },
  amount: {
    zh: '账单金额。',
    en: 'The invoice amount.',
    ar: 'قيمة الفاتورة.'
  },
  amount_raw: {
    zh: '标准化前的原始金额格式。',
    en: 'The amount in its original, pre-standardization format.',
    ar: 'قيمة المبلغ بصيغتها الأصلية قبل التوحيد.'
  },
  co: {
    zh: '与本账单关联的催收单编号。',
    en: 'The Collection Order reference number tied to this invoice.',
    ar: 'الرقم المرجعي لأمر التحصيل المرتبط بهذه الفاتورة.'
  },
  payer: {
    zh: '被要求缴纳本账单款项的实体名称。',
    en: 'The entity being billed for this invoice.',
    ar: 'اسم الجهة المطالَبة بسداد هذه الفاتورة.'
  },
  duplicate: {
    zh: '指纹检索是否命中历史重复账单。',
    en: 'Whether the fingerprint search matched a historical duplicate.',
    ar: 'هل طابق بحث البصمة فاتورة مكررة في السجل التاريخي.'
  },
  duplicate_of: {
    zh: '被匹配到的原始账单编号。',
    en: 'The ID of the original invoice this one matched.',
    ar: 'رقم الفاتورة الأصلية التي طابقتها هذه الفاتورة.'
  },
  similarity: {
    zh: '指纹匹配得分（1.0 = 四个字段完全一致）。',
    en: 'The fingerprint match score (1.0 = all four fields identical).',
    ar: 'درجة تطابق البصمة (1.0 = تطابق تام في الحقول الأربعة).'
  },
  nearest_similarity: {
    zh: '历史记录中找到的最接近相似度，未达到完全匹配。',
    en: 'The closest match found in history — below the exact-duplicate threshold.',
    ar: 'أعلى نسبة تشابه وُجدت في السجل التاريخي، دون الوصول لحد التطابق التام.'
  },
  matched_fields: {
    zh: '比对指纹时匹配一致的字段。',
    en: 'Which fields matched when comparing the fingerprint.',
    ar: 'الحقول التي تطابقت عند مقارنة البصمة.'
  },
  lines: {
    zh: '账单的行项目数量。',
    en: 'The number of line items on this invoice.',
    ar: 'عدد بنود الفاتورة.'
  },
  status: {
    zh: '催收单当前状态。',
    en: "The Collection Order's current status.",
    ar: 'الحالة الحالية لأمر التحصيل.'
  },
  accrual_ref: {
    zh: '关联的应计确认编号。',
    en: 'The linked Accrual Confirmation reference number.',
    ar: 'الرقم المرجعي لإثبات الاستحقاق المرتبط.'
  },
  contract: {
    zh: '框架合同编号。',
    en: 'The framework contract reference number.',
    ar: 'الرقم المرجعي للعقد الإطاري.'
  },
  active: {
    zh: '表示合同当前是否有效。',
    en: 'Whether the contract is currently active.',
    ar: 'يشير إلى أن العقد ما يزال سارياً.'
  },
  benchmark_source: {
    zh: '本次比对所用价格基准的来源。',
    en: 'Where the tariff/price benchmark used for comparison came from.',
    ar: 'مصدر معيار السعر المستخدم للمقارنة.'
  },
  currency: {
    zh: '货币代码。',
    en: 'The currency code.',
    ar: 'رمز العملة.'
  },
  tax_id: {
    zh: '正在通过 ZATCA 核验的税号。',
    en: 'The VAT registration number being validated via ZATCA.',
    ar: 'الرقم الضريبي الجاري التحقق منه عبر منصة ZATCA.'
  },
  rate: {
    zh: '适用的增值税税率（沙特为 15%）。',
    en: 'The VAT rate applied (15% under Saudi regulation).',
    ar: 'نسبة ضريبة القيمة المضافة المطبقة (15٪ وفق النظام السعودي).'
  },
  tax_id_valid: {
    zh: 'ZATCA 税号校验结果。',
    en: 'The result of the ZATCA tax-ID validation.',
    ar: 'نتيجة التحقق من صحة الرقم الضريبي عبر ZATCA.'
  },
  recomputed_vat: {
    zh: '系统复算的增值税 = 金额 × 税率，用于与申报值比对。',
    en: 'VAT recomputed by the system = amount × rate, compared against the declared value.',
    ar: 'الضريبة كما أعاد النظام حسابها = المبلغ × النسبة، للمقارنة مع القيمة المُقرّة.'
  },
  declared_vat: {
    zh: '账单本身申报的增值税金额。',
    en: 'The VAT amount as declared on the invoice itself.',
    ar: 'قيمة الضريبة كما وردت في الفاتورة نفسها.'
  },
  variance: {
    zh: '差异 = 预期值 − 申报值。',
    en: 'The variance = expected value − declared value.',
    ar: 'الفرق = القيمة المتوقعة − القيمة المُقرّة.'
  },
  category: {
    zh: '用于选择合适价格基准的服务/费用类别。',
    en: 'The service/fee category used to pick the right tariff benchmark.',
    ar: 'فئة الخدمة أو الرسم المستخدمة لاختيار معيار السعر المناسب للمقارنة.'
  },
  unit_price: {
    zh: '本行项目的开票单价。',
    en: 'The invoiced unit rate for this line item.',
    ar: 'السعر المفوتَر لكل وحدة في هذا البند.'
  },
  benchmark_unit: {
    zh: '同类别的标准参考单价，取自大量历史交易的平均值（见样本量）。',
    en: 'The standard reference unit rate for this category, averaged from many historical transactions (see sample size).',
    ar: 'السعر المرجعي القياسي لنفس الفئة، محسوب من متوسط عدد كبير من العمليات السابقة (انظر حجم العينة).'
  },
  deviation_pct: {
    zh: '偏离百分比 = (开票单价 − 基准单价) ÷ 基准单价 × 100。',
    en: 'Deviation % = (invoiced unit price − benchmark unit price) ÷ benchmark unit price × 100.',
    ar: 'نسبة الانحراف = (السعر المفوتَر − سعر المعيار) ÷ سعر المعيار × 100.'
  },
  sample_size: {
    zh: '用于计算基准价的历史交易笔数——数值越大，基准越可靠。',
    en: 'The number of historical transactions the benchmark was derived from — more samples, more reliable the benchmark.',
    ar: 'عدد العمليات التاريخية التي اعتُمد عليها لحساب سعر المعيار — كلما زاد الرقم زادت موثوقية المعيار.'
  },
  cr: {
    zh: '缴款方的商业登记号，用于核实其法律身份。',
    en: "The payer's Commercial Registration number, used to verify its legal identity.",
    ar: 'رقم السجل التجاري للجهة الدافعة، يُستخدم للتحقق من هويتها القانونية.'
  },
  since_year: {
    zh: '与该缴款方开始往来的年份。',
    en: "The year this payer's relationship with the ministry began.",
    ar: 'السنة التي بدأ فيها التعامل مع هذه الجهة الدافعة.'
  },
  invoices_90d: {
    zh: '该缴款方过去 90 天内的账单数量——0 代表全新客户。',
    en: 'Invoice count from this payer in the last 90 days — 0 means a brand-new relationship.',
    ar: 'عدد الفواتير الواردة من هذه الجهة خلال آخر 90 يوماً — الصفر يعني أنها جهة جديدة كلياً.'
  },
  on_time_rate: {
    zh: '该缴款方以往按时结清的比例（新客户尚无记录）。',
    en: "This payer's historical on-time settlement rate (no record yet for a new payer).",
    ar: 'نسبة التزام هذه الجهة بالمواعيد في تعاملاتها السابقة (لا يوجد سجل بعد لجهة جديدة).'
  },
  first_time: {
    zh: '表示这是否是该缴款方的首笔交易。',
    en: "Whether this is the payer's first-ever recorded transaction.",
    ar: 'يشير إلى ما إذا كانت هذه أول معاملة مسجّلة لهذه الجهة.'
  },
  first_time_payer: {
    zh: '首次缴款方——没有历史信任记录，风险权重更高。',
    en: 'A first-time payer — no trust history yet, so this carries more risk weight.',
    ar: 'جهة دافعة لأول مرة — لا يوجد سجل ثقة سابق لها، لذا تحمل وزن مخاطرة أعلى.'
  },
  round_amount: {
    zh: '金额是一个整数（无零头）——可能意味着估算金额而非真实核算。',
    en: 'The amount is a suspiciously round number (no fractions) — can suggest an estimate rather than a real calculation.',
    ar: 'المبلغ رقم "مستدير" تماماً بلا كسور — قد يوحي بتقدير تقريبي بدل احتساب فعلي من بنود حقيقية.'
  },
  features: {
    zh: '输入欺诈评分模型的原始特征值（加权前）。',
    en: 'The raw inputs fed into the fraud-scoring model, before weighting.',
    ar: 'المدخلات الخام لنموذج تقييم الاحتيال قبل ترجيحها إلى الدرجة النهائية.'
  },
  fee_deviation: {
    zh: '费用偏离特征值（小数形式），输入欺诈评分模型。',
    en: 'The fee-deviation feature value (as a fraction) fed into the model.',
    ar: 'قيمة انحراف الرسم (كنسبة عشرية) كما تُدخَل في نموذج تقييم الاحتيال.'
  },
  score: {
    zh: '模型输出的风险/欺诈评分（0-100），越高越可疑。',
    en: "The model's output risk/fraud score (0-100) — higher means more suspicious.",
    ar: 'الدرجة الناتجة عن النموذج من 0 إلى 100 — كلما ارتفعت زاد الاشتباه.'
  },
  band: {
    zh: '根据评分数值划分的风险等级。',
    en: 'The risk band derived from the numeric score.',
    ar: 'تصنيف مستوى المخاطرة المشتق من الدرجة الرقمية.'
  },
  top_factor: {
    zh: '对最终评分贡献最大的单一因素。',
    en: 'The single factor that contributed most to the final score.',
    ar: 'العامل الذي ساهم بأكبر نسبة في تكوين الدرجة النهائية.'
  },
  window_days: {
    zh: '用于检索关联账单的时间窗口（天）。',
    en: 'The time window (in days) examined for related invoices.',
    ar: 'المدة الزمنية (بالأيام) التي فُحصت خلالها الفواتير المرتبطة.'
  },
  related_invoices: {
    zh: '在该时间窗口内找到的同一缴款方关联账单数量。',
    en: 'Count of related invoices from the same payer found within the window.',
    ar: 'عدد الفواتير المرتبطة (لنفس الجهة الدافعة) التي وُجدت خلال هذه المدة.'
  },
  each_amount: {
    zh: '每张关联账单的金额，用于检测拆单规避。',
    en: 'The amount of each related invoice — compared against the threshold to detect splitting.',
    ar: 'قيمة كل فاتورة من الفواتير المرتبطة — تُقارن بحد الموافقة لرصد التقسيم.'
  },
  threshold: {
    zh: '正在比对的审批金额阈值。',
    en: 'The approval amount threshold being tested against.',
    ar: 'حد الموافقة الذي تجري مقارنة المبالغ به.'
  },
  gap_pct: {
    zh: '各金额与阈值的接近程度（%）——越接近 0，越像是刻意规避阈值。',
    en: 'How close each amount sits to the threshold (%) — nearer to 0 suggests deliberate threshold evasion.',
    ar: 'نسبة اقتراب كل مبلغ من حد الموافقة — كلما اقتربت من الصفر زاد الاشتباه بتفادٍ متعمد للحد.'
  },
  threshold_evasion: {
    zh: '判断该模式是否为刻意规避审批阈值。',
    en: 'Whether the pattern suggests deliberate evasion of the approval threshold.',
    ar: 'نتيجة تقييم ما إذا كان النمط يوحي بتفادٍ متعمد لحد الموافقة.'
  },
  agreed_term_days: {
    zh: '合同约定的付款账期（天）。',
    en: 'The payment term agreed in the original contract.',
    ar: 'مدة السداد المتفق عليها في العقد الأصلي.'
  },
  invoice_demand_days: {
    zh: '本账单实际要求的付款期限（天）——与约定账期对比可发现异常。',
    en: 'The payment term this invoice actually demands — comparing it to the agreed term reveals the deviation.',
    ar: 'مدة السداد التي تطالب بها هذه الفاتورة فعلياً — مقارنتها بالمدة المتفق عليها تكشف الانحراف.'
  },
  vat_owner: {
    zh: '登记为该税号所有者的实体名称。',
    en: 'The entity registered as the owner of this VAT number.',
    ar: 'اسم الجهة المسجّلة كمالكة لهذا الرقم الضريبي.'
  },
  contract_signatory: {
    zh: '合同签约方名称——与税号所有者对比以发现主体不一致。',
    en: 'The entity that signed the contract — compared against the VAT owner to spot a mismatch.',
    ar: 'اسم الجهة الموقّعة على العقد — تُقارن بمالك الرقم الضريبي لرصد عدم التطابق.'
  },
  match: {
    zh: '上述两个主体是否一致。',
    en: 'Whether the two entities above match.',
    ar: 'نتيجة مقارنة مالك الرقم الضريبي بالجهة الموقّعة على العقد.'
  },
  department: {
    zh: '账单所属部门，用于确定适用的授权矩阵。',
    en: 'The department this invoice routes through, used to select the right authorization matrix.',
    ar: 'القسم الذي تُوجَّه إليه الفاتورة لتحديد مصفوفة الصلاحيات المناسبة.'
  },
  chain_levels: {
    zh: '所需审批层级数，依授权矩阵按金额与部门确定。',
    en: 'Number of approval levels required, determined from the authorization matrix by amount and department.',
    ar: 'عدد مستويات الموافقة المطلوبة، يُحدَّد حسب المبلغ والقسم من مصفوفة التفويض.'
  },
  requires: {
    zh: '审批链中具体需要的角色/职位。',
    en: 'The specific roles required within the approval chain.',
    ar: 'الأدوار/المناصب المطلوبة تحديداً ضمن سلسلة الموافقة.'
  },
  sla_hours: {
    zh: '本步骤规定的服务水平协议时限（小时）。',
    en: 'The SLA time limit for this step, in hours.',
    ar: 'المهلة الزمنية المحددة (SLA) بالساعات لإنجاز هذه الخطوة.'
  },
  elapsed_hours: {
    zh: '自本步骤开始以来实际已过去的小时数。',
    en: 'Actual hours elapsed since this step began.',
    ar: 'عدد الساعات التي انقضت فعلياً منذ بدء هذه الخطوة.'
  },
  overrun: {
    zh: '表示是否已超过 SLA 时限。',
    en: 'Whether the elapsed time has exceeded the SLA limit.',
    ar: 'يشير إلى ما إذا كانت الساعات المنقضية قد تجاوزت مهلة SLA المحددة.'
  },
  escalated_to: {
    zh: '超时后自动升级转交的角色/职位。',
    en: 'Who the case was automatically escalated to after the SLA was exceeded.',
    ar: 'الجهة/المنصب الذي صُعِّدت إليه الحالة تلقائياً بعد تجاوز SLA.'
  },
  overdue_days: {
    zh: '本账单超过到期日的天数。',
    en: 'Days this invoice has been overdue past its due date.',
    ar: 'عدد الأيام التي تجاوزتها الفاتورة عن موعد استحقاقها.'
  },
  segment: {
    zh: '用于选择合适预测模型的行业/领域分类。',
    en: 'The industry/sector segment used to select the right forecasting model.',
    ar: 'القطاع المستخدم لاختيار نموذج التنبؤ المناسب.'
  },
  probability: {
    zh: '模型预测的回收概率（0–1）。',
    en: "The model's predicted collection probability (0–1).",
    ar: 'احتمالية التحصيل كما تنبأ بها النموذج، بين 0 و1.'
  },
  segment_rate: {
    zh: '该行业分类的历史回收率——对回收概率贡献最大。',
    en: 'The historical collection rate for this segment — the biggest contributor to the probability.',
    ar: 'معدل التحصيل التاريخي لهذا القطاع تحديداً — أكبر مساهم في احتمالية التحصيل.'
  },
  litigation: {
    zh: '该账款当前的法律/诉讼状态。',
    en: "The case's current litigation/legal status.",
    ar: 'الحالة القانونية الحالية لهذه الفاتورة.'
  },
  expected_settlement_days: {
    zh: '预计完成结算所需的天数。',
    en: 'Predicted number of days until this invoice is fully settled.',
    ar: 'عدد الأيام المتوقعة حتى تتم تسوية الفاتورة بالكامل.'
  },
  period: {
    zh: '本报告涵盖的时间段。',
    en: 'The reporting period this covers.',
    ar: 'الفترة الزمنية المشمولة بالتقرير.'
  },
  kpis_updated: {
    zh: '本次运行刷新的关键绩效指标数量。',
    en: 'Number of KPIs refreshed by this run.',
    ar: 'عدد مؤشرات الأداء الرئيسية التي تم تحديثها.'
  },
  ledger: {
    zh: '数据入账后的总账状态。',
    en: 'The ledger status after this data was posted.',
    ar: 'حالة السجل المحاسبي بعد ترحيل البيانات.'
  },
  audit_hash: {
    zh: '生成的审计留痕加密指纹，确保记录不可篡改。',
    en: 'A unique cryptographic fingerprint generated for the audit trail, ensuring the record is tamper-proof.',
    ar: 'بصمة تشفير فريدة تُنشأ لسجل التدقيق لضمان عدم إمكانية التعديل عليه لاحقاً.'
  },
  immutable: {
    zh: '确认该审计记录不可被后续修改。',
    en: 'Confirms this audit record cannot be altered afterward.',
    ar: 'يؤكد أن هذا السجل ثابت ولا يمكن التعديل عليه لاحقاً.'
  },
  confidence_breakpoints: {
    zh: '因决策置信度过低而转人工的案例数量。',
    en: 'Count of cases stopped for human review due to low decision confidence.',
    ar: 'عدد الحالات التي أُحيلت للبشر بسبب انخفاض ثقة القرار عن 75٪.'
  },
  amount_threshold: {
    zh: '因超出自动处理金额上限而转人工的案例数量。',
    en: 'Count of cases stopped for human review for exceeding the automated-processing amount limit.',
    ar: 'عدد الحالات التي أُحيلت للبشر بسبب تجاوز حد المبلغ المسموح للمعالجة الآلية.'
  },
  anomaly: {
    zh: '因检测到异常/欺诈嫌疑而转人工的案例数量。',
    en: 'Count of cases stopped for human review due to detected anomaly/fraud risk.',
    ar: 'عدد الحالات التي أُحيلت للبشر بسبب اكتشاف انحراف أو احتيال محتمل.'
  },
  auto_share: {
    zh: '全部由系统自动完成、无需人工介入的案例占比。',
    en: 'Percentage of cases fully automated with no human intervention.',
    ar: 'نسبة الحالات التي عولجت بالكامل آلياً دون تدخل بشري.'
  },
  hours_saved: {
    zh: '本期因自动化而节省的人工工时总数。',
    en: 'Total person-hours saved this period thanks to automation.',
    ar: 'إجمالي ساعات العمل البشري الموفَّرة خلال هذه الفترة نتيجة الأتمتة.'
  }
};

/* Full tool-name -> Arabic label (every tool() name used across aiProcess.js). */
const TOOL_NAME_AR = {
  'analytics.aggregate_kpis': 'تجميع المؤشرات',
  'dedup.fingerprint_search': 'بحث بصمة التكرار',
  'erp.get_payer_profile': 'جلب ملف الجهة الدافعة',
  'finance.get_collection_order': 'جلب أمر التحصيل',
  'forecast.collection_probability': 'التنبؤ باحتمالية التحصيل',
  'format.normalize_fields': 'توحيد الحقول',
  'graph.related_charges': 'الفواتير المرتبطة',
  'ml.fraud_score': 'درجة الاحتيال (تعلم آلي)',
  'orchestrator.hitl_stats': 'إحصاءات HITL للمنسّق',
  'platform.fetch_invoice': 'جلب الفاتورة من المنصة',
  'revenue.fee_benchmark': 'معيار الرسوم',
  'routing.match_authority': 'مطابقة صلاحية التوجيه',
  'sanad.lookup_contract': 'البحث في عقد سند',
  'sla.check': 'فحص SLA',
  'vision.ocr_extract': 'استخراج OCR بالرؤية الحاسوبية',
  'zatca.validate_vat': 'التحقق من الضريبة عبر ZATCA'
};

/* Every request/response object key used across aiProcess.js -> Arabic label. */
const KEY_AR = {
  accrual_ref: 'مرجع إثبات الاستحقاق',
  active: 'نشط',
  agreed_term_days: 'مدة العقد المتفق عليها (أيام)',
  amount: 'المبلغ',
  amount_raw: 'المبلغ الأصلي',
  amount_threshold: 'حد المبلغ',
  anomaly: 'الانحراف',
  audit_hash: 'بصمة التدقيق',
  auto_share: 'نسبة المعالجة التلقائية',
  avg_confidence: 'متوسط الثقة',
  avg_gap_days: 'متوسط الفارق (أيام)',
  band: 'الفئة',
  benchmark_source: 'مصدر المعيار',
  benchmark_unit: 'سعر المعيار',
  category: 'الفئة',
  chain_levels: 'مستويات السلسلة',
  co: 'أمر التحصيل',
  confidence_breakpoints: 'نقاط توقف الثقة',
  contract: 'العقد',
  contract_signatory: 'موقّع العقد',
  cr: 'السجل التجاري',
  currency: 'العملة',
  date_format: 'صيغة التاريخ',
  declared_vat: 'الضريبة المُقرّة',
  department: 'القسم',
  deviation_pct: 'نسبة الانحراف',
  doc: 'المستند',
  duplicate: 'مكرر',
  duplicate_of: 'مكرر لـ',
  each_amount: 'مبلغ كل فاتورة',
  elapsed_hours: 'الساعات المنقضية',
  escalated_to: 'تم التصعيد إلى',
  expected_settlement_days: 'أيام التسوية المتوقعة',
  features: 'الخصائص',
  fee_deviation: 'انحراف الرسم',
  fields_extracted: 'الحقول المستخرجة',
  fields_mapped: 'الحقول المُعيَّنة',
  first_time: 'أول مرة',
  first_time_payer: 'جهة دافعة لأول مرة',
  gap_pct: 'نسبة الفجوة',
  hours_saved: 'الساعات الموفَّرة',
  immutable: 'غير قابل للتعديل',
  invoice: 'الفاتورة',
  invoice_demand_days: 'أيام مطالبة السداد',
  invoices_90d: 'فواتير 90 يوماً',
  kpis_updated: 'مؤشرات محدَّثة',
  ledger: 'السجل المحاسبي',
  lines: 'البنود',
  litigation: 'التقاضي',
  low_confidence_fields: 'حقول منخفضة الثقة',
  match: 'مطابقة',
  matched_fields: 'الحقول المتطابقة',
  nearest_similarity: 'أعلى تشابه',
  on_time_rate: 'معدل الالتزام بالموعد',
  overdue_days: 'أيام التأخير',
  overrun: 'تجاوز',
  payer: 'الجهة الدافعة',
  period: 'الفترة',
  probability: 'الاحتمالية',
  queued: 'في قائمة الانتظار',
  rate: 'النسبة',
  recomputed_vat: 'الضريبة المُعاد حسابها',
  related_invoices: 'الفواتير المرتبطة',
  requires: 'يتطلب',
  round_amount: 'مبلغ دائري',
  sample_size: 'حجم العينة',
  score: 'الدرجة',
  segment: 'الفئة',
  segment_rate: 'معدل الفئة',
  similarity: 'التشابه',
  since_year: 'منذ عام',
  size_kb: 'الحجم (كيلوبايت)',
  sla_hours: 'ساعات SLA',
  source: 'المصدر',
  status: 'الحالة',
  tax_id: 'الرقم الضريبي',
  tax_id_valid: 'صحة الرقم الضريبي',
  threshold: 'الحد',
  threshold_evasion: 'تفادي الحد',
  top_factor: 'العامل الأبرز',
  unit_currency: 'عملة الوحدة',
  unit_price: 'سعر الوحدة',
  variance: 'الفرق',
  vat: 'الضريبة',
  vat_owner: 'مالك الرقم الضريبي',
  window_days: 'نافذة الأيام'
};

/* Enum-like values and role/department names -> Arabic (proper nouns like
   invoice IDs, CR/tax numbers, company names, and "SAR" are left as-is). */
const VALUE_AR = {
  Procurement: 'المشتريات',
  construction: 'البناء والتشييد',
  fee_deviation: 'انحراف الرسم',
  framework_price_list: 'قائمة أسعار الإطار',
  heavy_transport: 'النقل الثقيل',
  high: 'مرتفع',
  none: 'لا يوجد',
  posted: 'مُرحّل',
  released: 'مُصدر',
  'Invoice Clerk': 'موظف الفواتير',
  'Finance Manager': 'المدير المالي',
  'Budget & Finance': 'الميزانية والمالية',
  'Center Director': 'مدير المركز',
  CFO: 'الرئيس المالي'
};

/* Turn a snake_case/dot.path identifier into a readable label, e.g.
   "routing.match_authority" -> "Routing · Match Authority",
   "chain_levels" -> "Chain Levels", "co" -> "CO" (known acronyms stay caps).
   In Arabic, known tool names/keys resolve via TOOL_NAME_AR/KEY_AR first. */
const ACRONYMS = new Set(['co', 'cr', 'vat', 'sla', 'id', 'zatca', 'ac', 'kpi', 'kpis', 'erp', 'nl2sql', 'ml', 'ai']);
function humanizeWord(word) {
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1);
}
function humanizeEn(str) {
  return String(str)
    .split('.')
    .map((part) => part.split('_').map(humanizeWord).join(' '))
    .join(' · ');
}
function humanize(str, lang) {
  if (lang === 'ar') {
    if (TOOL_NAME_AR[str]) return TOOL_NAME_AR[str];
    if (KEY_AR[str]) return KEY_AR[str];
  }
  return humanizeEn(str);
}

function formatValue(v, key = '', lang) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  if (Array.isArray(v)) return v.map((x) => formatValue(x, key, lang)).join('، ');
  if (typeof v === 'number') {
    // Bare years (e.g. since_year: 2026) shouldn't get a thousands separator.
    if (/year/i.test(key) && Number.isInteger(v) && v >= 1000 && v <= 9999) return String(v);
    return v.toLocaleString('en-US');
  }
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k2, v2]) => `${humanize(k2, lang)}: ${formatValue(v2, k2, lang)}`)
      .join('، ');
  }
  if (typeof v === 'string') {
    if (lang === 'ar' && VALUE_AR[v]) return VALUE_AR[v];
    // Snake_case enum-like strings (e.g. "framework_price_list") read as code —
    // humanize them too, but leave IDs/codes/prose (dates, "CO-88231", sentences) untouched.
    if (/^[a-z]+(_[a-z0-9]+)+$/.test(v)) return humanize(v, lang);
  }
  return String(v);
}

/**
 * KeyValueGrid — renders a plain object as a grid of labelled cells (key
 * humanized, value formatted) instead of raw JSON, so tool-call data reads
 * like normal business content rather than code — in the portal's active
 * language. Cells with a FIELD_INFO entry are clickable/focusable and reveal
 * a tooltip explaining what the number means and how it was derived.
 */
const HAS_ARABIC = /[؀-ۿ]/;
function KeyValueGrid({ value, lang }) {
  const [openKey, setOpenKey] = useState(null);
  const entries = Object.entries(value || {});
  if (!entries.length) return null;

  function closeIfSelf(k) {
    setOpenKey((cur) => (cur === k ? null : cur));
  }

  return (
    <div className="idd-grid">
      {entries.map(([k, v]) => {
        const formatted = formatValue(v, k, lang);
        const info = FIELD_INFO[k];
        const open = openKey === k;
        if (!info) {
          return (
            <div className="idd-cell" key={k}>
              <span className="idd-cell__k">{humanize(k, lang)}</span>
              <span className="idd-cell__v" dir={HAS_ARABIC.test(formatted) ? 'rtl' : 'ltr'}>{formatted}</span>
            </div>
          );
        }
        return (
          <div className="idd-cell-wrap" style={open ? { gridColumn: '1 / -1' } : undefined} key={k}>
            <button
              type="button"
              className={`idd-cell idd-cell--info${open ? ' idd-cell--open' : ''}`}
              aria-expanded={open}
              onFocus={() => setOpenKey(k)}
              onBlur={() => closeIfSelf(k)}
              onClick={() => setOpenKey((cur) => (cur === k ? null : k))}
            >
              <span className="idd-cell__k">{humanize(k, lang)} <span className="idd-cell__info-dot">ⓘ</span></span>
              <span className="idd-cell__v" dir={HAS_ARABIC.test(formatted) ? 'rtl' : 'ltr'}>{formatted}</span>
            </button>
            {open ? (
              <div className="feature-tooltip" role="tooltip">
                <div className="feature-tooltip__desc">{lang === 'zh' ? info.zh : lang === 'ar' ? info.ar : info.en}</div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * ToolCallCard — a business-readable rendering of an agent's tool/data lookup:
 * a humanized action name, a compact key-value request, a latency chip, and a
 * collapsible key-value response. While `running`, shows a "tool running…"
 * spinner in place of the response; the parent TraceBlock resolves it.
 *
 * Props:
 *  - tool: string (e.g. "tahseel.query_invoice")
 *  - request: JSON-serializable object
 *  - response: JSON-serializable object
 *  - latency: number (ms)
 *  - running: boolean
 */
export default function ToolCallCard({ tool, request, response, latency, running }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(true);

  return (
    <div className={`tool-call${running ? ' tool-call--running' : ''}`}>
      <div className="tool-call__head">
        <span className="tool-call__badge">{t('trace_tool_call')}</span>
        <span className="tool-call__name" dir={lang === 'ar' ? 'rtl' : 'ltr'}>{humanize(tool, lang)}</span>
        {!running && typeof latency === 'number' ? (
          <span className="tool-call__latency">{latency}ms</span>
        ) : null}
      </div>

      <div className="tool-call__section">
        <div className="tool-call__label">{t('trace_request')}</div>
        <KeyValueGrid value={request} lang={lang} />
      </div>

      {running ? (
        <div className="tool-call__section">
          <div className="tool-call__label">
            <span className="ai-spinner" aria-hidden="true" style={{ marginInlineEnd: 6 }} />
            {t('trace_running')}
          </div>
          <SkeletonGrid cells={Math.max(2, Object.keys(request || {}).length)} />
        </div>
      ) : (
        <div className="tool-call__section">
          <div className="tool-call__label tool-call__label--btn">
            <span>{t('trace_response')}</span>
            <button type="button" className="tool-call__toggle" onClick={() => setOpen((o) => !o)}>
              {open ? t('trace_hide') : t('trace_show')}
            </button>
          </div>
          {open ? <KeyValueGrid value={response} lang={lang} /> : null}
        </div>
      )}
    </div>
  );
}
