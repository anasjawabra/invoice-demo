// IntelliBill demo data (ES module)
// Source: legacy assets/js/data.js

/* ---------- Demo accounts ---------- */
export const CREDENTIALS = [
  {
    user: 'demo',
    pass: 'demo123',
    name: '奥马尔·拉希德',
    nameEn: 'Omar Al-Rashid',
    nameAr: 'عمر الرشيد',
    role: '财务共享中心 · 主管',
    roleEn: 'Shared Service Center · Manager',
    roleAr: 'مركز الخدمات المشتركة · مدير',
    avatar: 'OA'
  },
  {
    user: 'auditor',
    pass: 'demo123',
    name: 'Ahmad Al-Saud',
    nameEn: 'Ahmad Al-Saud',
    nameAr: 'أحمد آل سعود',
    role: '审计师 · Auditor',
    roleEn: 'Auditor',
    roleAr: 'مدقق',
    avatar: 'AS'
  },
  {
    user: 'admin',
    pass: 'admin',
    name: '系统管理员',
    nameEn: 'System Admin',
    nameAr: 'مدير النظام',
    role: '平台管理员',
    roleEn: 'Platform Admin',
    roleAr: 'مدير المنصة',
    avatar: 'AD'
  }
];

/* ---------- Organization context (scoped data) ---------- */
export const ORGS = [
  {
    id: 'mof-hq',
    tier: 'central',
    name: '住房与城乡事务部 · 本部（合并视图）',
    nameEn: 'MoMAH · HQ (Consolidated)',
    nameAr: 'وزارة البلديات والإسكان · المقر (موحّد)',
    scale: 1.0,
    code: 'MOMAH-HQ'
  },
  {
    id: 'gen-office',
    tier: 'central',
    name: '部长办公厅',
    nameEn: "Minister's General Office",
    nameAr: 'المكتب العام للوزير',
    scale: 0.16,
    code: 'GEN-OFF'
  },
  {
    id: 'riyadh',
    tier: 'local',
    name: '利雅得市政厅',
    nameEn: 'Riyadh Municipality',
    nameAr: 'أمانة منطقة الرياض',
    scale: 0.42,
    code: 'RUH-MUN'
  },
  {
    id: 'makkah',
    tier: 'local',
    name: '麦加市政厅',
    nameEn: 'Makkah Municipality',
    nameAr: 'أمانة منطقة مكة المكرمة',
    scale: 0.28,
    code: 'MAK-MUN'
  },
  {
    id: 'eastern',
    tier: 'local',
    name: '东部省共享服务中心',
    nameEn: 'Eastern Province Shared Service Center',
    nameAr: 'مركز الخدمات المشتركة بالمنطقة الشرقية',
    scale: 0.19,
    code: 'EP-SSC'
  }
];

/* ---------- 6 core KPIs ---------- */
export const KPIS = [
  {
    id: 'processed',
    label: '本月已处理账单',
    labelEn: 'Invoices Processed',
    labelAr: 'الفواتير المعالجة',
    value: 12480,
    unit: '张',
    unitEn: '',
    unitAr: '',
    delta: 18.2,
    icon: 'file',
    color: 'teal'
  },
  {
    id: 'automation',
    label: '字段自动录入率',
    labelEn: 'Auto Entry Rate',
    labelAr: 'معدل الأتمتة',
    value: 96.4,
    unit: '%',
    unitEn: '%',
    unitAr: '%',
    delta: 1.7,
    icon: 'bolt',
    color: 'indigo',
    target: 95
  },
  {
    id: 'amount',
    label: '本月处理金额',
    labelEn: 'Amount Processed',
    labelAr: 'المبلغ المعالج',
    value: 3.82,
    unit: '亿 SAR',
    unitEn: 'B SAR',
    unitAr: 'مليار ر.س',
    delta: 12.5,
    icon: 'coins',
    color: 'gold'
  },
  {
    id: 'recovery',
    label: '账款回收率',
    labelEn: 'Collection Rate',
    labelAr: 'معدل التحصيل',
    value: 87.3,
    unit: '%',
    unitEn: '%',
    unitAr: '%',
    delta: 3.1,
    icon: 'trend',
    color: 'green',
    target: 85
  },
  {
    id: 'anomaly',
    label: '异常/欺诈拦截',
    labelEn: 'Anomalies Blocked',
    labelAr: 'الانحرافات',
    value: 214,
    unit: '起',
    unitEn: '',
    unitAr: '',
    delta: 9.0,
    icon: 'shield',
    color: 'red'
  },
  {
    id: 'cycle',
    label: '平均处理周期',
    labelEn: 'Avg Cycle Time',
    labelAr: 'دورة المعالجة',
    value: 0.8,
    unit: '天',
    unitEn: 'd',
    unitAr: 'يوم',
    delta: -62.4,
    icon: 'clock',
    color: 'purple'
  }
];

/* ---------- 12 agents: 1 orchestrator + 11 specialists ---------- */
export const AGENTS = [
  {
    id: 'orch',
    name: '总控编排 Agent',
    nameEn: 'Orchestrator Agent',
    nameAr: 'وكيل التنسيق',
    en: 'Orchestrator',
    form: '多智能体编排',
    formEn: 'Multi-Agent Orchestration',
    formAr: 'تنسيق متعدد الوكلاء',
    color: 'gold',
    desc: '意图识别与任务路由，按流水线调度 11 个子 Agent，统一中/阿对话入口，控制 HITL 断点。',
    descEn:
      'Intent recognition and task routing. Schedules 11 specialist agents via the pipeline, provides a unified ZH/AR chat entry, and controls HITL breakpoints.',
    descAr:
      'التعرف على القصد وتوجيه المهام. يقوم بجدولة 11 وكيلاً متخصصاً عبر خط الأنابيب، ويوفر مدخل دردشة موحداً بالصينية/العربية، ويتحكم في نقاط توقف HITL.',
    uc: '贯穿全流程 / UC-07',
    model: '豆包多语言模型 · 温度 0.2',
    modelEn: 'Doubao Multilingual · Temp 0.2',
    modelAr: 'Doubao متعدد اللغات · حرارة 0.2',
    status: 'online',
    calls: 48210,
    acc: 100
  },
  {
    id: 'ingest',
    name: '发票摄取 Agent',
    nameEn: 'Invoice Ingestion Agent',
    nameAr: 'وكيل استيعاب الفواتير',
    en: 'Ingestion',
    short: '摄取',
    shortEn: 'Ingestion',
    shortAr: 'الاستيعاب',
    form: '工作流应用',
    formEn: 'Workflow App',
    formAr: 'تطبيق سير العمل',
    color: 'teal',
    desc: '从四平台/邮件/ERP 抓取账单，纳入统一接收队列。',
    descEn: 'Fetches invoices from the 4 platforms, email, and ERP into a single unified intake queue.',
    descAr: 'يجلب الفواتير من المنصات الأربع والبريد الإلكتروني وERP إلى قائمة استيعاب موحّدة.',
    uc: 'UC-01 / FR-001',
    model: '豆包文本模型 · 温度 0.1',
    modelEn: 'Doubao Text · Temp 0.1',
    modelAr: 'Doubao نص · حرارة 0.1',
    status: 'online',
    calls: 3200,
    acc: 97.5
  },
  {
    id: 'ocr',
    name: 'OCR 提取 Agent',
    nameEn: 'OCR Data Extraction Agent',
    nameAr: 'وكيل استخراج البيانات (OCR)',
    en: 'OCR Extraction',
    short: 'OCR',
    shortEn: 'OCR',
    shortAr: 'OCR',
    form: '工作流应用',
    formEn: 'Workflow App',
    formAr: 'تطبيق سير العمل',
    color: 'teal',
    desc: '对每张账单图像/PDF 进行 OCR 提取：缴款方、催收单、金额、日期、税号。',
    descEn: 'OCR extraction of payer, CO, amount, date, and VAT fields from each invoice image or PDF.',
    descAr: 'استخراج OCR لحقول الجهة الدافعة وأمر التحصيل والمبلغ والتاريخ والضريبة من كل فاتورة.',
    uc: 'UC-01 / FR-002',
    model: '豆包视觉+文本 · 温度 0.1',
    modelEn: 'Doubao Vision+Text · Temp 0.1',
    modelAr: 'Doubao رؤية+نص · حرارة 0.1',
    status: 'online',
    calls: 4200,
    acc: 95.0
  },
  {
    id: 'normalize',
    name: '元数据标准化 Agent',
    nameEn: 'Metadata Normalization Agent',
    nameAr: 'وكيل توحيد البيانات الوصفية',
    en: 'Normalization',
    short: '标准化',
    shortEn: 'Normalization',
    shortAr: 'التوحيد',
    form: '工作流应用',
    formEn: 'Workflow App',
    formAr: 'تطبيق سير العمل',
    color: 'blue',
    desc: '将各来源的格式、单位与字段名称统一映射至标准发票模型。',
    descEn: 'Standardizes formats, units, and field labels across sources into the unified invoice schema.',
    descAr: 'يوحّد التنسيقات والوحدات وتسميات الحقول من مختلف المصادر ضمن نموذج بيانات موحّد.',
    uc: 'UC-01 / FR-003',
    model: '豆包文本模型 · 温度 0.1',
    modelEn: 'Doubao Text · Temp 0.1',
    modelAr: 'Doubao نص · حرارة 0.1',
    status: 'online',
    calls: 2800,
    acc: 98.5
  },
  {
    id: 'dedup',
    name: '重复检测 Agent',
    nameEn: 'Duplicates Detection Agent',
    nameAr: 'وكيل اكتشاف التكرار',
    en: 'Duplicates',
    short: '去重',
    shortEn: 'Dedup',
    shortAr: 'التكرار',
    form: '工作流应用',
    formEn: 'Workflow App',
    formAr: 'تطبيق سير العمل',
    color: 'red',
    desc: '对比发票指纹（缴款方/金额/催收单/发票号）与历史记录，拦截重复提交。',
    descEn: 'Searches invoice fingerprints (payer, amount, CO, invoice no.) against history to catch duplicate submissions.',
    descAr: 'يبحث في بصمات الفواتير (الجهة الدافعة، المبلغ، أمر التحصيل، رقم الفاتورة) مقابل السجل التاريخي لرصد التكرار.',
    uc: 'UC-01 / FR-004',
    model: '豆包文本模型 · 温度 0.1',
    modelEn: 'Doubao Text · Temp 0.1',
    modelAr: 'Doubao نص · حرارة 0.1',
    status: 'online',
    calls: 2280,
    acc: 96.0
  },
  {
    id: 'validation',
    name: '自动化核验 Agent',
    nameEn: 'Automated Validation Agent',
    nameAr: 'وكيل التحقق الآلي',
    en: 'Validation',
    short: '核验',
    shortEn: 'Validation',
    shortAr: 'التحقق',
    form: '工作流应用',
    formEn: 'Workflow App',
    formAr: 'تطبيق سير العمل',
    color: 'teal',
    desc: '三单核验（账单-催收单-应计确认）与 Makin/Tahseel 跨平台对账。',
    descEn: '3-way verification (Invoice-Collection Order-Accrual Confirmation) and cross-platform reconciliation between Makin and Tahseel.',
    descAr: 'المطابقة الثلاثية (فاتورة-أمر تحصيل-إثبات استحقاق) والتسوية عبر المنصات بين Makin وTahseel.',
    uc: 'UC-02 / FR-005',
    model: '豆包文本模型 · 温度 0.2',
    modelEn: 'Doubao Text · Temp 0.2',
    modelAr: 'Doubao نص · حرارة 0.2',
    status: 'online',
    calls: 7200,
    acc: 93.5
  },
  {
    id: 'compliance',
    name: '合规检查 Agent',
    nameEn: 'Compliance Checking Agent',
    nameAr: 'وكيل فحص الامتثال',
    en: 'Compliance',
    short: '合规',
    shortEn: 'Compliance',
    shortAr: 'الامتثال',
    form: '工作流应用',
    formEn: 'Workflow App',
    formAr: 'تطبيق سير العمل',
    color: 'red',
    desc: 'ZATCA 税号与增值税校验，比对既定的付款/税务/审批规则。',
    descEn: 'ZATCA tax-ID and VAT validation against the defined payment, tax, and approval rules.',
    descAr: 'التحقق من الرقم الضريبي ZATCA وضريبة القيمة المضافة مقابل قواعد الدفع والضريبة والاعتماد المحددة.',
    uc: 'UC-11 / FR-006',
    model: '豆包文本模型 · 温度 0.2',
    modelEn: 'Doubao Text · Temp 0.2',
    modelAr: 'Doubao نص · حرارة 0.2',
    status: 'online',
    calls: 5010,
    acc: 91.8
  },
  {
    id: 'anomaly',
    name: '异常与欺诈检测 Agent',
    nameEn: 'Anomaly & Fraud Detection Agent',
    nameAr: 'وكيل اكتشاف الانحرافات والاحتيال',
    en: 'Anomaly',
    short: '异常',
    shortEn: 'Anomaly',
    shortAr: 'الانحراف',
    form: '工作流 + 大模型',
    formEn: 'Workflow + LLM',
    formAr: 'سير العمل + LLM',
    color: 'red',
    desc: '比对缴款方历史模式与标准费率基准，输出 0-100 风险评分与欺诈警告。',
    descEn: 'Compares payer historical patterns and standard fee tariffs; outputs a 0-100 risk score with fraud warnings.',
    descAr: 'يقارن بأنماط الجهة الدافعة التاريخية ومعايير الرسوم القياسية للقطاع؛ يخرج درجة مخاطرة 0-100 مع تحذيرات الاحتيال.',
    uc: 'UC-03 / FR-008',
    model: '豆包文本模型 · 温度 0.3',
    modelEn: 'Doubao Text · Temp 0.3',
    modelAr: 'Doubao نص · حرارة 0.3',
    status: 'online',
    calls: 8460,
    acc: 88.0
  },
  {
    id: 'pattern',
    name: '模式识别 Agent',
    nameEn: 'Pattern Recognition Agent',
    nameAr: 'وكيل التعرف على الأنماط',
    en: 'Patterns',
    short: '模式',
    shortEn: 'Patterns',
    shortAr: 'الأنماط',
    form: '工作流 + 大模型',
    formEn: 'Workflow + LLM',
    formAr: 'سير العمل + LLM',
    color: 'purple',
    desc: '识别跨发票的趋势——提交频率、规避阈值、账期漂移——对比缴款方历史常规。',
    descEn: 'Identifies cross-invoice trends — submission frequency, threshold evasion, payment-term drift — against payer norms.',
    descAr: 'يحدد الأنماط عبر الفواتير — تكرار الإرسال، تفادي الحدود، انحراف آجال الدفع — مقارنة بسلوك الجهة الدافعة المعتاد.',
    uc: 'UC-03 / FR-008',
    model: '豆包文本模型 · 温度 0.3',
    modelEn: 'Doubao Text · Temp 0.3',
    modelAr: 'Doubao نص · حرارة 0.3',
    status: 'online',
    calls: 3520,
    acc: 90.5
  },
  {
    id: 'routing',
    name: '审批路由 Agent',
    nameEn: 'Approval Routing Agent',
    nameAr: 'وكيل توجيه الاعتماد',
    en: 'Routing',
    short: '路由',
    shortEn: 'Routing',
    shortAr: 'التوجيه',
    form: '工作流应用',
    formEn: 'Workflow App',
    formAr: 'تطبيق سير العمل',
    color: 'blue',
    desc: '按授权矩阵校验审批权限，按金额/部门动态分发审批链，生成审批卡片，SLA 逾期提醒。',
    descEn:
      'Validates approval authority against the authorization matrix, dynamically dispatches approval chains by amount/department, generates approval cards, and sends SLA reminders.',
    descAr:
      'يتحقق من صلاحية الموافقة وفق مصفوفة التفويض، يوزع سلاسل الموافقة ديناميكياً حسب المبلغ/القسم، ينشئ بطاقات موافقة، ويرسل تنبيهات SLA.',
    uc: 'UC-04 / FR-007/009',
    model: '豆包文本模型 · 温度 0.1',
    modelEn: 'Doubao Text · Temp 0.1',
    modelAr: 'Doubao نص · حرارة 0.1',
    status: 'online',
    calls: 9640,
    acc: 100
  },
  {
    id: 'forecasting',
    name: '催收预测 Agent',
    nameEn: 'Collection Probability Forecasting Agent',
    nameAr: 'وكيل التنبؤ باحتمالية التحصيل',
    en: 'Forecasting',
    short: '预测',
    shortEn: 'Forecasting',
    shortAr: 'التنبؤ',
    form: '工作流 + 大模型',
    formEn: 'Workflow + LLM',
    formAr: 'سير العمل + LLM',
    color: 'purple',
    desc: '基于历史收缴率/诉讼状态/宏观指标预测回收概率，延迟风险预警，Mumtathil 罚款同步。',
    descEn:
      'Predicts recovery probability from historical collection rates, litigation status, and macro indicators; warns of delay risk and syncs Mumtathil penalties.',
    descAr:
      'يتنبأ باحتمال التحصيل من معدلات التحصيل التاريخية وحالة التقاضي والمؤشرات الكلية؛ ينبه لمخاطر التأخير ويزامن عقوبات Mumtathil.',
    uc: 'UC-05、UC-12 / FR-010',
    model: '豆包文本模型 · 温度 0.3',
    modelEn: 'Doubao Text · Temp 0.3',
    modelAr: 'Doubao نص · حرارة 0.3',
    status: 'online',
    calls: 7320,
    acc: 86.1
  },
  {
    id: 'analytics',
    name: '分析问答 Agent',
    nameEn: 'Performance Analytics & Smart Chat Agent',
    nameAr: 'وكيل تحليلات الأداء والمحادثة الذكية',
    en: 'Analytics',
    short: '分析',
    shortEn: 'Analytics',
    shortAr: 'التحليلات',
    form: '对话型 + 工作流',
    formEn: 'Conversational + Workflow',
    formAr: 'حواري + سير العمل',
    color: 'purple',
    desc: '6 个核心 KPI 看板，阿拉伯语/中文自然语言问答(NL2SQL)，定期收入报告，待定账单修正建议。',
    descEn:
      '6 core KPI dashboards, Arabic/Chinese natural-language Q&A (NL2SQL), periodic revenue reports, and correction suggestions for pending invoices.',
    descAr:
      '6 لوحات مؤشرات أداء أساسية، أسئلة وأجوبة باللغة الطبيعية بالعربية/الصينية (NL2SQL)، تقارير إيرادات دورية، واقتراحات تصحيح للفواتير المعلقة.',
    uc: 'UC-06/07/08/10',
    model: '豆包多语言模型 · 温度 0.2-0.5',
    modelEn: 'Doubao Multilingual · Temp 0.2-0.5',
    modelAr: 'Doubao متعدد اللغات · حرارة 0.2-0.5',
    status: 'online',
    calls: 15870,
    acc: 94.2
  }
];

/* ---------- Sources ---------- */
// Every invoice below is, without exception, also reflected in Tahseel (the
// universal ledger) — that's not a 5th competing bucket, it's true of 100%
// of these. This breakdown is by ORIGINATING PRODUCT: which billing platform
// actually issued the invoice before it was mirrored into Tahseel. Foras,
// Mumathil and Baladi are "central" (ministry-level) systems; internal
// Amanah systems are the 4th, currently-being-phased-out category. Names
// match the real MoMAH source platforms (فرص/ممثل/بلدي) rather than
// invented ones — see momah_data_sources.md for the full real source list.
export const SOURCES = [
  {
    id: 'forsah',
    name: 'Foras',
    desc: '投资类收费（中央系统）',
    descEn: 'Investment fees (central system)',
    descAr: 'رسوم الاستثمار (نظام مركزي)',
    count: 4820,
    color: 'teal'
  },
  {
    id: 'momtathil',
    name: 'Mumathil',
    desc: '违规与罚款（中央系统）',
    descEn: 'Violations & fines (central system)',
    descAr: 'المخالفات والغرامات (نظام مركزي)',
    count: 3610,
    color: 'indigo'
  },
  {
    id: 'baladi',
    name: 'Baladi',
    desc: '市政/电子发票（中央系统）',
    descEn: 'Municipal / e-invoice (central system)',
    descAr: 'بلدي / الفاتورة الإلكترونية (نظام مركزي)',
    count: 2240,
    color: 'green'
  },
  {
    id: 'internal',
    name: 'Amanah Internal Reports',
    desc: '安曼纳内部系统（正逐步淘汰）',
    descEn: "Amanah-internal systems (being phased out)",
    descAr: 'أنظمة داخلية لدى الأمانات (قيد الإيقاف التدريجي)',
    count: 1810,
    color: 'gold'
  }
];

/* ---------- Invoices ---------- */
// Every invoice also carries the Amanah/beneficiary-ID fields a real Makeen
// extract joins in (see gfsForInvoice/collectionStatusFor below) — this is
// what makes the Invoices list an AGGREGATOR view, not just a bill list.
// None of the ORIGINAL fields below are renamed or removed: `.tag` still
// drives RECON/OCR_SAMPLES/NODE_DRAWERS, `.status` still drives the
// Dashboard lifecycle tiles and Assistant stats, `.payType`/`.collectedVia`
// still drive the voluntary/enforcement split, `.co` still drives the
// Invoices deep-link, and `.entityEn` is still the exact PAYER_MASTER key.
export const INVOICES = [
  {
    id: 'INV-2026-0731',
    payType: 'deferred',
    centralSource: true,
    entity: 'Al-Rajhi 建设集团',
    entityEn: 'Al-Rajhi Construction Group',
    entityAr: 'مجموعة الراجحي للإنشاءات',
    amanah: '利雅得', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض',
    beneficiaryId: '1042883055',
    amount: 1749000,
    currency: 'SAR',
    source: 'Foras',
    co: 'CO-88231',
    vat: '3001234567800003',
    date: '2026-07-26',
    status: 'pending',
    risk: 12,
    confidence: 0.97,
    tag: 'normal'
  },
  {
    id: 'INV-2026-0730',
    payType: 'deferred',
    centralSource: true,
    entity: 'NEOM 物流服务',
    entityEn: 'NEOM Logistics',
    entityAr: 'نيوم للخدمات اللوجستية',
    amanah: '塔布克', amanahEn: 'Tabuk Amanah', amanahAr: 'أمانة منطقة تبوك',
    beneficiaryId: '7009988766',
    violationNumber: '10000020226730',
    amount: 307000,
    currency: 'SAR',
    source: 'Mumathil',
    co: 'CO-88192',
    vat: '3009988776600001',
    date: '2026-07-26',
    status: 'anomaly',
    risk: 82,
    confidence: 0.71,
    tag: 'fraud'
  },
  {
    id: 'INV-2026-0729',
    payType: 'deferred',
    centralSource: true,
    entity: 'Saudi Tech Solutions',
    entityEn: 'Saudi Tech Solutions',
    entityAr: 'الحلول التقنية السعودية',
    amanah: '利雅得', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض',
    municipality: 'Al-Olaya', municipalityEn: 'Al-Olaya Municipality', municipalityAr: 'بلدية العليا',
    beneficiaryId: '1022334455',
    amount: 87500,
    currency: 'SAR',
    source: 'Foras',
    co: 'CO-88155',
    vat: '3002233445500007',
    date: '2026-07-25',
    status: 'approved',
    risk: 8,
    confidence: 0.99,
    tag: 'normal',
    // Cash arrived because the payer settled on their own — the other half
    // of the "collected" split the stakeholder asked for (voluntary vs forced).
    collectedVia: 'voluntary'
  },
  {
    id: 'INV-2026-0728',
    payType: 'deferred',
    centralSource: true,
    entity: 'Gulf Facility Mgmt',
    entityEn: 'Gulf Facility Mgmt',
    entityAr: 'إدارة مرافق الخليج',
    amanah: '东部省', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية',
    beneficiaryId: '1041883055',
    violationNumber: '10000020226728',
    amount: 1099000,
    currency: 'SAR',
    source: 'Mumathil',
    co: 'CO-88231',
    vat: '3001234567800003',
    date: '2026-07-25',
    status: 'duplicate',
    risk: 0,
    confidence: 0.95,
    tag: 'dup'
  },
  {
    id: 'INV-2026-0727',
    payType: 'deferred',
    centralSource: true,
    entity: 'Aramco 后勤供应',
    entityEn: 'Aramco Logistics Supply',
    entityAr: 'أرامكو للإمداد اللوجستي',
    amanah: '东部省', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية',
    municipality: 'Al-Khobar', municipalityEn: 'Al-Khobar Municipality', municipalityAr: 'بلدية الخبر',
    beneficiaryId: '2055667788',
    hasOpenObjection: true,
    amount: 4835500,
    currency: 'SAR',
    source: 'Baladi',
    co: 'CO-87990',
    vat: '3005566778800002',
    date: '2026-07-24',
    status: 'review',
    risk: 46,
    confidence: 0.68,
    tag: 'taxfail'
  },
  {
    id: 'INV-2026-0726',
    payType: 'prepaid',
    centralSource: false,
    entity: 'Riyadh 市政工程',
    entityEn: 'Riyadh Municipal Works',
    entityAr: 'أعمال بلدية الرياض',
    amanah: '利雅得', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض',
    beneficiaryId: '1077889900',
    licenseNumber: '450210465726',
    amount: 1073000,
    currency: 'SAR',
    source: 'Amanah Internal Reports (Riyadh Amanah)',
    co: 'CO-87921',
    vat: '3007788990000004',
    date: '2026-07-24',
    status: 'approved',
    risk: 15,
    confidence: 0.96,
    tag: 'normal'
  },
  {
    id: 'INV-2026-0725',
    payType: 'prepaid',
    centralSource: false,
    entity: 'STC 通信服务',
    entityEn: 'STC Telecom Services',
    entityAr: 'STC لخدمات الاتصالات',
    amanah: '麦加', amanahEn: 'Makkah Amanah', amanahAr: 'أمانة منطقة مكة المكرمة',
    municipality: 'Al-Aziziyah', municipalityEn: 'Al-Aziziyah Municipality', municipalityAr: 'بلدية العزيزية',
    beneficiaryId: '1033445566',
    licenseNumber: '450310556725',
    amount: 272500,
    currency: 'SAR',
    source: 'Amanah Internal Reports (Makkah Amanah)',
    co: 'CO-87880',
    vat: '3003344556600009',
    date: '2026-07-23',
    status: 'approved',
    risk: 5,
    confidence: 0.98,
    tag: 'normal'
  },
  {
    id: 'INV-2026-0724',
    payType: 'deferred',
    centralSource: true,
    entity: 'Bahri 海运物流',
    entityEn: 'Bahri Maritime Logistics',
    entityAr: 'البحري للخدمات اللوجستية البحرية',
    amanah: '吉达', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة',
    municipality: 'Al-Shati', municipalityEn: 'Al-Shati Municipality', municipalityAr: 'بلدية الشاطئ',
    beneficiaryId: '3066778899',
    amount: 1601500,
    currency: 'SAR',
    source: 'Baladi',
    co: 'CO-87812',
    vat: '3006677889900005',
    date: '2026-07-23',
    status: 'pending',
    risk: 33,
    confidence: 0.9,
    tag: 'normal'
  },
  {
    id: 'INV-2026-0722',
    payType: 'deferred',
    centralSource: true,
    entity: 'Al-Noor 贸易',
    entityEn: 'Al-Noor Trading',
    entityAr: 'النور للتجارة',
    amanah: '吉达', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة',
    beneficiaryId: '1044556677',
    amount: 687500,
    currency: 'SAR',
    source: 'Mumathil',
    co: 'CO-87764',
    vat: '3004455667700006',
    date: '2026-07-20',
    status: 'approved',
    risk: 10,
    confidence: 0.97,
    tag: 'normal',
    // Cash arrived only after referral to the judiciary and a forced bank
    // transfer — the "collected via enforcement" half of the same split.
    collectedVia: 'enforcement'
  },
  // Trailing 12-month history — gives the Dashboard's period filter
  // (previous month / 3 / 6 / 12 months / by year / custom range) real
  // dated rows to show visibly different totals for, instead of every
  // preset collapsing to the same single-week cluster above.
  {
    id: 'INV-2025-0810', payType: 'deferred', centralSource: true,
    entity: 'Red Sea 承包', entityEn: 'Red Sea Global Contracting', entityAr: 'البحر الأحمر للمقاولات',
    amanah: '塔布克', amanahEn: 'Tabuk Amanah', amanahAr: 'أمانة منطقة تبوك', beneficiaryId: '3088112233',
    amount: 599000, currency: 'SAR', source: 'Baladi', co: 'CO-86210', vat: '3008811223300010',
    date: '2025-08-14', status: 'approved', risk: 9, confidence: 0.97, tag: 'normal'
  },
  {
    id: 'INV-2025-0855', payType: 'prepaid', centralSource: false,
    entity: 'Jeddah 开发公司', entityEn: 'Jeddah Development Co.', entityAr: 'جدة للتطوير',
    amanah: '吉达', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة', beneficiaryId: '1022001100',
    amount: 266500, currency: 'SAR', source: 'Amanah Internal Reports (Jeddah Amanah)', co: 'CO-86340', vat: '3002200110000011',
    date: '2025-09-10', status: 'approved', risk: 6, confidence: 0.98, tag: 'normal'
  },
  {
    id: 'INV-2025-0902', payType: 'deferred', centralSource: true,
    entity: 'NEOM 物流服务', entityEn: 'NEOM Logistics', entityAr: 'نيوم للخدمات اللوجستية',
    amanah: '塔布克', amanahEn: 'Tabuk Amanah', amanahAr: 'أمانة منطقة تبوك', beneficiaryId: '7009988766',
    amount: 630500, currency: 'SAR', source: 'Mumathil', co: 'CO-86510', vat: '3009988776600001',
    date: '2025-10-05', status: 'approved', risk: 11, confidence: 0.96, tag: 'normal'
  },
  {
    id: 'INV-2025-0940', payType: 'deferred', centralSource: true,
    entity: 'Al-Ahsa 农业机构', entityEn: 'Al-Ahsa Agricultural Est.', entityAr: 'مؤسسة الأحساء الزراعية',
    amanah: '哈萨', amanahEn: 'Al-Ahsa Amanah', amanahAr: 'أمانة محافظة الأحساء', beneficiaryId: '1044115566',
    amount: 169500, currency: 'SAR', source: 'Foras', co: 'CO-86690', vat: '3004411556600012',
    date: '2025-11-18', status: 'duplicate', risk: 0, confidence: 0.93, tag: 'dup'
  },
  {
    id: 'INV-2025-0975', payType: 'deferred', centralSource: true,
    entity: 'Al-Rajhi 建设集团', entityEn: 'Al-Rajhi Construction Group', entityAr: 'مجموعة الراجحي للإنشاءات',
    amanah: '利雅得', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض', beneficiaryId: '1042883055',
    amount: 937500, currency: 'SAR', source: 'Foras', co: 'CO-86840', vat: '3001234567800003',
    date: '2025-12-22', status: 'approved', risk: 14, confidence: 0.97, tag: 'normal'
  },
  {
    id: 'INV-2026-0520', payType: 'deferred', centralSource: true,
    entity: 'Bahri 海运物流', entityEn: 'Bahri Maritime Logistics', entityAr: 'البحري للخدمات اللوجستية البحرية',
    amanah: '吉达', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة', beneficiaryId: '3066778899',
    amount: 2641000, currency: 'SAR', source: 'Baladi', co: 'CO-87010', vat: '3006677889900005',
    date: '2026-01-12', status: 'approved', risk: 20, confidence: 0.92, tag: 'normal'
  },
  {
    id: 'INV-2026-0530', payType: 'prepaid', centralSource: false,
    entity: 'STC 通信服务', entityEn: 'STC Telecom Services', entityAr: 'STC لخدمات الاتصالات',
    amanah: '麦加', amanahEn: 'Makkah Amanah', amanahAr: 'أمانة منطقة مكة المكرمة', beneficiaryId: '1033445566',
    amount: 182000, currency: 'SAR', source: 'Amanah Internal Reports (Makkah Amanah)', co: 'CO-87070', vat: '3003344556600009',
    date: '2026-01-28', status: 'approved', risk: 4, confidence: 0.99, tag: 'normal'
  },
  {
    id: 'INV-2026-0545', payType: 'deferred', centralSource: true,
    entity: 'Tabuk 住房机构', entityEn: 'Tabuk Housing Authority', entityAr: 'هيئة إسكان تبوك',
    amanah: '塔布克', amanahEn: 'Tabuk Amanah', amanahAr: 'أمانة منطقة تبوك', beneficiaryId: '1055002233',
    amount: 578000, currency: 'SAR', source: 'Mumathil', co: 'CO-87140', vat: '3005500223300013',
    date: '2026-02-15', status: 'review', risk: 39, confidence: 0.74, tag: 'taxfail',
    // Exclusion category: struck-off commercial registry / deceased debtor —
    // excluded from net-invoiced entirely, never counted as collected.
    debtorInvalid: true,
    debtorInvalidReason: 'struck_off_registry'
  },
  {
    id: 'INV-2026-0560', payType: 'deferred', centralSource: true,
    entity: 'Gulf Facility Mgmt', entityEn: 'Gulf Facility Mgmt', entityAr: 'إدارة مرافق الخليج',
    amanah: '东部省', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية', beneficiaryId: '1041883055',
    amount: 1089500, currency: 'SAR', source: 'Mumathil', co: 'CO-87220', vat: '3001234567800003',
    date: '2026-03-09', status: 'approved', risk: 10, confidence: 0.98, tag: 'normal'
  },
  {
    id: 'INV-2026-0575', payType: 'deferred', centralSource: true,
    entity: 'Saudi Tech Solutions', entityEn: 'Saudi Tech Solutions', entityAr: 'الحلول التقنية السعودية',
    amanah: '利雅得', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض', beneficiaryId: '1022334455',
    amount: 625500, currency: 'SAR', source: 'Foras', co: 'CO-87300', vat: '3002233445500007',
    date: '2026-03-30', status: 'approved', risk: 7, confidence: 0.98, tag: 'normal'
  },
  {
    id: 'INV-2026-0590', payType: 'deferred', centralSource: true,
    entity: 'Aramco 后勤供应', entityEn: 'Aramco Logistics Supply', entityAr: 'أرامكو للإمداد اللوجستي',
    amanah: '东部省', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية', beneficiaryId: '2055667788',
    amount: 1465500, currency: 'SAR', source: 'Baladi', co: 'CO-87380', vat: '3005566778800002',
    date: '2026-04-20', status: 'approved', risk: 17, confidence: 0.95, tag: 'normal'
  },
  {
    id: 'INV-2026-0605', payType: 'prepaid', centralSource: false,
    entity: 'Riyadh 市政工程', entityEn: 'Riyadh Municipal Works', entityAr: 'أعمال بلدية الرياض',
    amanah: '利雅得', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض', beneficiaryId: '1077889900',
    amount: 1109000, currency: 'SAR', source: 'Amanah Internal Reports (Riyadh Amanah)', co: 'CO-87450', vat: '3007788990000004',
    date: '2026-05-11', status: 'approved', risk: 12, confidence: 0.96, tag: 'normal'
  },
  {
    id: 'INV-2026-0620', payType: 'deferred', centralSource: true,
    entity: 'Al-Noor 贸易', entityEn: 'Al-Noor Trading', entityAr: 'النور للتجارة',
    amanah: '吉达', amanahEn: 'Jeddah Amanah', amanahAr: 'أمانة محافظة جدة', beneficiaryId: '1044556677',
    amount: 670000, currency: 'SAR', source: 'Mumathil', co: 'CO-87560', vat: '3004455667700006',
    date: '2026-05-27', status: 'approved', risk: 8, confidence: 0.97, tag: 'normal',
    collectedVia: 'voluntary'
  },
  {
    id: 'INV-2026-0635', payType: 'deferred', centralSource: true,
    entity: 'Metro 运输', entityEn: 'Metro Transport', entityAr: 'مترو للنقل',
    amanah: '利雅得', amanahEn: 'Riyadh Amanah', amanahAr: 'أمانة منطقة الرياض', beneficiaryId: '3066004455',
    amount: 1363500, currency: 'SAR', source: 'Baladi', co: 'CO-87630', vat: '3006600445500014',
    date: '2026-06-08', status: 'approved', risk: 15, confidence: 0.95, tag: 'normal',
    collectedVia: 'enforcement'
  },
  {
    id: 'INV-2026-0650', payType: 'deferred', centralSource: true,
    entity: 'Coastal 物流', entityEn: 'Coastal Logistics', entityAr: 'الساحلية للخدمات اللوجستية',
    amanah: '东部省', amanahEn: 'Eastern Province Amanah', amanahAr: 'أمانة المنطقة الشرقية', beneficiaryId: '3066770011',
    amount: 572000, currency: 'SAR', source: 'Foras', co: 'CO-87700', vat: '3006677001100015',
    date: '2026-06-24', status: 'pending', risk: 22, confidence: 0.9, tag: 'normal',
    // Investment-category invoice (Foras) with no linked Furas contract —
    // the flag rule confirmed across the Mini-BRD and the raw transcript.
    hasContract: false
  },
  // Remaining 9 provinces (previously "no data in this demo") — one fictional
  // invoice each, so every Amanah/province has at least some coverage across
  // the map, the Amanah filter, and the target-achievement ring gauges.
  {
    id: 'INV-2026-0801', payType: 'deferred', centralSource: true,
    entity: 'Najran 边境贸易公司', entityEn: 'Najran Border Trading Co.', entityAr: 'شركة نجران للتجارة الحدودية',
    amanah: '纳季兰', amanahEn: 'Najran Amanah', amanahAr: 'أمانة منطقة نجران', beneficiaryId: '1099887701',
    amount: 415000, currency: 'SAR', source: 'Baladi', co: 'CO-88301', vat: '3009988770100016',
    date: '2025-09-05', status: 'approved', risk: 11, confidence: 0.97, tag: 'normal'
  },
  {
    id: 'INV-2026-0802', payType: 'prepaid', centralSource: false,
    entity: 'Arar 物流枢纽', entityEn: 'Arar Logistics Hub', entityAr: 'مركز عرعر اللوجستي',
    amanah: '北部边境', amanahEn: 'Northern Borders Amanah', amanahAr: 'أمانة منطقة الحدود الشمالية', beneficiaryId: '1088776602',
    amount: 268000, currency: 'SAR', source: 'Mumathil', co: 'CO-88321', vat: '3008877660200017',
    date: '2026-02-01', status: 'pending', risk: 27, confidence: 0.89, tag: 'normal'
  },
  {
    id: 'INV-2026-0803', payType: 'deferred', centralSource: true,
    entity: 'Hail 农业工业公司', entityEn: 'Hail Agri Industries', entityAr: 'حائل للصناعات الزراعية',
    amanah: '哈伊勒', amanahEn: "Ha'il Amanah", amanahAr: 'أمانة منطقة حائل', beneficiaryId: '1077665503',
    amount: 512500, currency: 'SAR', source: 'Foras', co: 'CO-88341', vat: '3007766550300018',
    date: '2025-10-18', status: 'approved', risk: 9, confidence: 0.98, tag: 'normal'
  },
  {
    id: 'INV-2026-0804', payType: 'deferred', centralSource: true,
    entity: 'Abha 高地开发商', entityEn: 'Abha Highland Developers', entityAr: 'مطورو أبها للمرتفعات',
    amanah: '阿西尔', amanahEn: 'Asir Amanah', amanahAr: 'أمانة منطقة عسير', beneficiaryId: '1066554404',
    amount: 891000, currency: 'SAR', source: 'Baladi', co: 'CO-88361', vat: '3006655440400019',
    date: '2025-11-30', status: 'review', risk: 41, confidence: 0.7, tag: 'taxfail',
    // Exclusion category: struck-off commercial registry / deceased debtor —
    // excluded from net-invoiced entirely, never counted as collected. A sole
    // establishment (مؤسسة فردية) is legally tied to one individual owner, so
    // this one is flagged for the debtor's death, not a registry lapse.
    debtorInvalid: true,
    debtorInvalidReason: 'deceased_person'
  },
  {
    id: 'INV-2026-0805', payType: 'prepaid', centralSource: false,
    entity: 'Madinah 酒店集团', entityEn: 'Madinah Hospitality Group', entityAr: 'مجموعة المدينة للضيافة',
    amanah: '麦地那', amanahEn: 'Al Madinah Amanah', amanahAr: 'أمانة المدينة المنورة', beneficiaryId: '1055443305',
    amount: 1245000, currency: 'SAR', source: 'Amanah Internal Reports (Al Madinah Amanah)', co: 'CO-88381', vat: '3005544330500020',
    date: '2026-01-15', status: 'approved', risk: 13, confidence: 0.96, tag: 'normal'
  },
  {
    id: 'INV-2026-0806', payType: 'deferred', centralSource: true,
    entity: 'Qassim 农业科技', entityEn: 'Qassim AgroTech', entityAr: 'القصيم للتقنية الزراعية',
    amanah: '卡西姆', amanahEn: 'Al-Qassim Amanah', amanahAr: 'أمانة منطقة القصيم', beneficiaryId: '1044332206',
    amount: 356500, currency: 'SAR', source: 'Foras', co: 'CO-88401', vat: '3004433220600021',
    date: '2026-03-22', status: 'pending', risk: 24, confidence: 0.91, tag: 'normal',
    // Investment-category invoice (Foras) with no linked Furas contract.
    hasContract: false
  },
  {
    id: 'INV-2026-0807', payType: 'prepaid', centralSource: false,
    entity: 'Al Bahah 旅游地产', entityEn: 'Al Bahah Tourism Estates', entityAr: 'عقارات الباحة السياحية',
    amanah: '巴哈', amanahEn: 'Al Bahah Amanah', amanahAr: 'أمانة منطقة الباحة', beneficiaryId: '1033221107',
    amount: 198000, currency: 'SAR', source: 'Baladi', co: 'CO-88421', vat: '3003322110700022',
    date: '2025-12-08', status: 'approved', risk: 6, confidence: 0.98, tag: 'normal'
  },
  {
    id: 'INV-2026-0808', payType: 'deferred', centralSource: true,
    entity: 'Jazan 港口服务', entityEn: 'Jazan Port Services', entityAr: 'خدمات ميناء جازان',
    amanah: '吉赞', amanahEn: 'Jazan Amanah', amanahAr: 'أمانة منطقة جازان', beneficiaryId: '1022110008',
    amount: 733500, currency: 'SAR', source: 'Mumathil', co: 'CO-88441', vat: '3002211000800023',
    date: '2026-04-05', status: 'duplicate', risk: 0, confidence: 0.94, tag: 'dup'
  },
  {
    id: 'INV-2026-0809', payType: 'prepaid', centralSource: false,
    entity: 'Al Jawf 农业公司', entityEn: 'Al Jawf Agricultural Co.', entityAr: 'شركة الجوف الزراعية',
    amanah: '焦夫', amanahEn: 'Al Jawf Amanah', amanahAr: 'أمانة منطقة الجوف', beneficiaryId: '1011009909',
    amount: 287000, currency: 'SAR', source: 'Amanah Internal Reports (Al Jawf Amanah)', co: 'CO-88461', vat: '3001100990900024',
    date: '2026-05-19', status: 'approved', risk: 8, confidence: 0.97, tag: 'normal'
  }
];

/* ---------- GFS revenue-account classification, by originating platform ----------
   A real Makeen-style aggregator extract joins every invoice back to a GFS
   revenue account regardless of which of the 4 platforms actually issued
   it — derived here once rather than repeated on all 24 records. */
const GFS_BY_SOURCE = {
  Foras: { code: '1421901', name: '投资类收费', nameEn: 'Investment Fees', nameAr: 'رسوم الاستثمار' },
  Mumathil: { code: '1438001', name: '违规与罚款', nameEn: 'Penalties & Fines', nameAr: 'جزاءات وغرامات مفروضة بموجب أنظمة الجهة' },
  Baladi: { code: '142113', name: '市政杂项收费', nameEn: 'Municipal Fees', nameAr: 'رسوم بلدية متنوعة' }
};
const GFS_INTERNAL = { code: '142162', name: '商业活动许可费', nameEn: 'Commercial License Fees', nameAr: 'اصدار رخص الانشطة التجارية' };

export function gfsForInvoice(inv) {
  if (!inv) return null;
  if (GFS_BY_SOURCE[inv.source]) return GFS_BY_SOURCE[inv.source];
  if (inv.source?.startsWith('Amanah Internal Reports')) return GFS_INTERNAL;
  return null;
}

/* ---------- Makeen-style collection status ----------
   Derived from the EXISTING workflow `.status`/`.payType` fields rather
   than stored per-record, so it can never drift out of sync with the AI
   workflow status the rest of the app is built around: approved -> collected,
   duplicate (auto-blocked) -> cancelled, anything still in-flight ->
   uncollected. Mirrors the real Makeen "حالة الفاتورة" 4-value vocabulary. */
export const COLLECTION_STATUS = {
  uncollected: { label: '未收缴', labelEn: 'Uncollected', labelAr: 'غير محصلة', color: 'red' },
  cancelled: { label: '已作废', labelEn: 'Cancelled', labelAr: 'ملغاة', color: 'gold' },
  collected: { label: '已收缴', labelEn: 'Collected', labelAr: 'محصلة', color: 'green' },
  paid: { label: '已支付', labelEn: 'Paid', labelAr: 'مدفوعة', color: 'teal' }
};

export function collectionStatusFor(inv) {
  if (!inv) return COLLECTION_STATUS.uncollected;
  if (inv.status === 'approved') return COLLECTION_STATUS.collected;
  if (inv.status === 'duplicate') return COLLECTION_STATUS.cancelled;
  return COLLECTION_STATUS.uncollected;
}

/* ---------- Status dictionary ---------- */
export const STATUS = {
  pending: { label: '待处理', labelEn: 'Pending', labelAr: 'قيد الانتظار', color: 'blue' },
  approved: { label: '已通过', labelEn: 'Approved', labelAr: 'تمت الموافقة', color: 'green' },
  anomaly: { label: '欺诈警告', labelEn: 'Fraud Warning', labelAr: 'تحذير احتيال', color: 'red' },
  duplicate: {
    label: '重复拦截',
    labelEn: 'Duplicate Blocked',
    labelAr: 'منع التكرار',
    color: 'gold'
  },
  review: { label: '待人工复核', labelEn: 'Review Needed', labelAr: 'مراجعة بشرية', color: 'orange' },
  rejected: { label: '已驳回', labelEn: 'Rejected', labelAr: 'مرفوض', color: 'grey' }
};

/* ---------- HITL approvals ---------- */
export const APPROVALS = [
  {
    id: 'INV-2026-0727',
    entity: 'Aramco 后勤供应',
    entityEn: 'Aramco Logistics Supply',
    entityAr: 'أرامكو للإمداد اللوجستي',
    amount: 3180000,
    currency: 'SAR',
    chain: '账单专员 → 财务经理 → 预算与财务 → 收入保障复核 → 中心主任 → CFO',
    chainEn:
      'Invoice Clerk → Finance Manager → Budget & Finance → Revenue Assurance Review → Center Director → CFO',
    chainAr: 'موظف الفواتير ← المدير المالي ← الميزانية والمالية ← مراجعة ضمان الإيرادات ← مدير المركز ← الرئيس المالي',
    assignee: '李芳军',
    assigneeEn: 'Omar Al-Rashid',
    assigneeAr: 'طارق',
    priority: '高',
    priorityEn: 'High',
    priorityAr: 'عالية',
    priorityKey: 'high',
    sla: '4 小时',
    slaEn: '4 hours',
    slaAr: '4 ساعات',
    reason:
      '部分匹配（置信度 71% < 75%）触发人工复核；评估已超时 8h，自动升级至中心主任',
    reasonEn:
      'Partial match (confidence 71% < 75%) flagged for human review; evaluation also overran SLA by 8h, auto-escalated to Center Director',
    reasonAr:
      'مطابقة جزئية (ثقة 71٪ < 75٪) أحيلت للمراجعة البشرية؛ كما تجاوز التقييم SLA بـ 8 ساعات، وتم التصعيد تلقائياً لمدير المركز',
    match: '部分匹配',
    matchEn: 'Partial Match',
    matchAr: 'تطابق جزئي',
    risk: 46
  },
  {
    id: 'INV-2026-0724',
    entity: 'Bahri 海运物流',
    entityEn: 'Bahri Maritime Logistics',
    entityAr: 'البحري للخدمات اللوجستية البحرية',
    amount: 2260000,
    currency: 'SAR',
    chain: '账单专员 → 财务经理 → 预算与财务 → 中心主任',
    chainEn: 'Invoice Clerk → Finance Manager → Budget & Finance → Center Director',
    chainAr: 'موظف الفواتير ← المدير المالي ← الميزانية والمالية ← مدير المركز',
    assignee: '李芳军',
    assigneeEn: 'Omar Al-Rashid',
    assigneeAr: 'طارق',
    priority: '中',
    priorityEn: 'Medium',
    priorityAr: 'متوسطة',
    priorityKey: 'mid',
    sla: '8 小时',
    slaEn: '8 hours',
    slaAr: '8 ساعات',
    reason: '匹配置信度 90%，仍按金额规模转人工复核（100~300 万 SAR）',
    reasonEn: 'Match confidence 90% — still routed for human oversight given the amount scale (1-3M SAR)',
    reasonAr: 'ثقة المطابقة 90٪ — أُحيلت للمراجعة البشرية نظراً لحجم المبلغ (1-3 مليون ر.س)',
    match: '完全匹配',
    matchEn: 'Full Match',
    matchAr: 'تطابق كامل',
    risk: 33
  },
  {
    id: 'INV-2026-0731',
    entity: 'Al-Rajhi 建设集团',
    entityEn: 'Al-Rajhi Construction Group',
    entityAr: 'مجموعة الراجحي للإنشاءات',
    amount: 1250000,
    currency: 'SAR',
    chain: '账单专员 → 财务经理 → 预算与财务',
    chainEn: 'Invoice Clerk → Finance Manager → Budget & Finance',
    chainAr: 'موظف الفواتير ← المدير المالي ← الميزانية والمالية',
    assignee: '李芳军',
    assigneeEn: 'Omar Al-Rashid',
    assigneeAr: 'طارق',
    priority: '中',
    priorityEn: 'Medium',
    priorityAr: 'متوسطة',
    priorityKey: 'mid',
    sla: '8 小时',
    slaEn: '8 hours',
    slaAr: '8 ساعات',
    reason: '匹配置信度 97%，按金额规模例行转人工复核（100~300 万 SAR）',
    reasonEn: 'Match confidence 97% — routine human oversight given the amount scale (1-3M SAR)',
    reasonAr: 'ثقة المطابقة 97٪ — مراجعة بشرية اعتيادية نظراً لحجم المبلغ (1-3 مليون ر.س)',
    match: '完全匹配',
    matchEn: 'Full Match',
    matchAr: 'تطابق كامل',
    risk: 12
  }
];

/* ---------- Collection forecast ---------- */
export const COLLECTIONS = [
  {
    id: 'INV-2026-0512',
    entity: 'Sky Bridge 建筑',
    entityEn: 'Sky Bridge Construction',
    entityAr: 'سكاي بريدج للإنشاءات',
    overdue: 45,
    amount: 890000,
    prob: 34,
    delay: '高',
    delayEn: 'High',
    delayAr: 'عالٍ',
    delayKey: 'high',
    strategy: '建议启动法务催告，同步 Mumtathil 罚款状态',
    strategyEn: 'Recommend legal notice; sync Mumtathil penalty status',
    strategyAr: 'يوصى بإشعار قانوني؛ مزامنة حالة عقوبة Mumtathil',
    penalty: '已上诉',
    penaltyEn: 'Appealed',
    penaltyAr: 'تم الاستئناف',
    penaltyKey: 'appealed',
    lifecycle: 'uncollected',
    color: 'red'
  },
  {
    id: 'INV-2026-0498',
    entity: 'Green Valley 农业',
    entityEn: 'Green Valley Agriculture',
    entityAr: 'الوادي الأخضر للزراعة',
    overdue: 28,
    amount: 320000,
    prob: 62,
    delay: '中',
    delayEn: 'Medium',
    delayAr: 'متوسط',
    delayKey: 'mid',
    strategy: '电话+邮件双渠道提醒，7 日内跟进',
    strategyEn: 'Phone + email reminders; follow up within 7 days',
    strategyAr: 'تذكير عبر الهاتف والبريد؛ المتابعة خلال 7 أيام',
    penalty: '无',
    penaltyEn: 'None',
    penaltyAr: 'لا يوجد',
    penaltyKey: 'none',
    lifecycle: 'uncollected',
    color: 'orange'
  },
  {
    id: 'INV-2026-0476',
    entity: 'Metro 运输',
    entityEn: 'Metro Transport',
    entityAr: 'مترو للنقل',
    overdue: 12,
    amount: 1560000,
    prob: 88,
    delay: '低',
    delayEn: 'Low',
    delayAr: 'منخفض',
    delayKey: 'low',
    strategy: '标准催收邮件，回收概率高',
    strategyEn: 'Standard collection email; high recovery probability',
    strategyAr: 'بريد تحصيل قياسي؛ احتمال تحصيل مرتفع',
    penalty: '无',
    penaltyEn: 'None',
    penaltyAr: 'لا يوجد',
    penaltyKey: 'none',
    lifecycle: 'uncollected',
    color: 'green'
  },
  {
    id: 'INV-2026-0455',
    entity: 'Coastal 物流',
    entityEn: 'Coastal Logistics',
    entityAr: 'الساحلية للخدمات اللوجستية',
    overdue: 61,
    amount: 2100000,
    prob: 21,
    delay: '高',
    delayEn: 'High',
    delayAr: 'عالٍ',
    delayKey: 'high',
    strategy: '优先级最高，建议催收经理介入并评估计提坏账',
    strategyEn:
      'Highest priority; recommend collection manager intervention and bad-debt provisioning',
    strategyAr: 'أعلى أولوية؛ يوصى بتدخل مدير التحصيل وتقييم مخصص الديون المعدومة',
    penalty: '执行中',
    penaltyEn: 'Enforcing',
    penaltyAr: 'قيد التنفيذ',
    penaltyKey: 'enforcing',
    lifecycle: 'enforced',
    color: 'red'
  }
];

/* ---------- Penalty status dictionary ---------- */
export const PENALTY_STATUS = {
  none: { label: '无', labelEn: 'None', labelAr: 'لا يوجد' },
  appealed: { label: '已上诉', labelEn: 'Appealed', labelAr: 'تم الاستئناف' },
  enforcing: { label: '执行中', labelEn: 'Enforcing', labelAr: 'قيد التنفيذ' }
};

/* ---------- 8-month trend ---------- */
export const TREND = {
  labels: ['12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月'],
  labelsEn: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
  labelsAr: ['ديسمبر', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو'],
  processed: [6200, 6800, 7400, 8100, 9200, 10300, 11500, 12480],
  automation: [88.2, 89.5, 91.0, 92.4, 93.8, 95.1, 95.9, 96.4],
  recovery: [78, 79.5, 81, 82.4, 83.9, 85.2, 86.4, 87.3],
  // Average days from invoice issue to collection (penalty/fine invoices) —
  // shorter lifetime means less revenue deferred into next fiscal year.
  invoiceLifetimeDays: [45, 41, 37, 32, 28, 24, 20, 18]
};

/* ---------- Q&A scripts ---------- */
// Templates use {{placeholders}} filled from real, live-computed data (see
// Assistant.jsx's `stats`) so an answer can never drift out of sync with what
// the corresponding page actually shows — the same discipline applied to the
// Dashboard's proactive alerts.
export const QA = [
  {
    // Ordered first: keywords like 'الإيرادات'/'revenue' also appear in the
    // generic amount/revenue entry below, and QA lookup takes the first
    // match — this one must win for revenue-benchmark questions.
    match: ['收入基准', '收入报告', '部级', 'revenue benchmark', 'benchmark report', 'ministry-wide', 'executive report', 'معيار الإيرادات', 'التقرير التنفيذي', 'تقرير الإيرادات', 'تقرير الوزارة'],
    zh: '这是一个示例性的部级收入基准（单位：百万里亚尔，仅用于演示，与本演示的虚构发票数据无关）：总开票额 **{{realGross}}M**，净开票额 **{{realNet}}M**（占总额{{realNetPct}}%），实际收缴 **{{realCollected}}M**（占净额{{realCollectedPct}}%）。按来源看，市政房地产投资占比最高（{{realTopWeight}}%，收缴率{{realTopRate}}%），其次是住房板块（{{realHousingWeight}}%，收缴率{{realHousingRate}}%）。同比上一年，收缴从{{realCollected2025}}M增长至{{realCollected}}M（+{{realCollectedYoy}}%）。',
    en: "This is an illustrative, sample ministry-wide revenue benchmark (SAR millions — for demo purposes only, unrelated to this demo's fictional invoice data): gross invoiced **SAR {{realGross}}M**, net invoiced **SAR {{realNet}}M** ({{realNetPct}}% of gross), actually collected **SAR {{realCollected}}M** ({{realCollectedPct}}% of net). By source, Municipal Real-Estate Investment leads at {{realTopWeight}}% of net-invoiced value ({{realTopRate}}% collected), followed by Housing at {{realHousingWeight}}% ({{realHousingRate}}% collected). Year-over-year, collected revenue rose from SAR {{realCollected2025}}M to SAR {{realCollected}}M (+{{realCollectedYoy}}%).",
    ar: 'هذا معيار إيرادات توضيحي (نموذجي) على مستوى الوزارة (بالمليون ريال — لأغراض العرض التوضيحي فقط، وغير مرتبط ببيانات الفواتير الافتراضية في هذا العرض): إجمالي المفوتر **{{realGross}} مليون**، صافي الفوترة **{{realNet}} مليون** ({{realNetPct}}% من الإجمالي)، المحصل فعليًا **{{realCollected}} مليون** ({{realCollectedPct}}% من الصافي). حسب المصدر، تتصدر إيرادات استثمار العقارات البلدية بنسبة {{realTopWeight}}% من صافي الفوترة (نسبة تحصيل {{realTopRate}}%)، يليها قطاع الإسكان بنسبة {{realHousingWeight}}% (تحصيل {{realHousingRate}}%). مقارنة بالعام السابق، ارتفع المحصل من {{realCollected2025}} مليون إلى {{realCollected}} مليون (+{{realCollectedYoy}}%).',
    chart: 'realRevenueSource'
  },
  {
    match: ['回收率', '收缴', 'recovery', 'collection rate', 'التحصيل', 'تحصيل'],
    zh: '本月账款回收率为 **{{recovery}}%**，环比上升 {{recoveryDelta}} 个百分点，已超过 {{recoveryTarget}}% 的目标。当前有 {{lowCount}} 笔逾期账单回收概率低于 40%（详见催收预测页面），建议优先介入。',
    en: "This month's collection rate is **{{recovery}}%**, up {{recoveryDelta}} pts month-over-month, exceeding the {{recoveryTarget}}% target. There are {{lowCount}} overdue invoices with recovery probability below 40% (see Collection Forecast) — priority intervention recommended.",
    ar: 'بلغ معدل التحصيل هذا الشهر **{{recovery}}%**، بزيادة {{recoveryDelta}} نقطة مئوية عن الشهر السابق، متجاوزًا الهدف البالغ {{recoveryTarget}}%. هناك {{lowCount}} فواتير متعثرة باحتمال تحصيل أقل من 40% (راجع توقعات التحصيل).',
    chart: 'recovery'
  },
  {
    match: ['本月收入', '处理金额', '金额', 'revenue', 'amount', 'processed', 'المبلغ', 'الإيرادات'],
    zh: '本月已处理账单金额合计 **{{amountB}} 亿 SAR**（{{processedCount}} 张），环比增长 {{amountDelta}}%。其中 Mumathil 平台占比 {{makinPct}}%，Foras 平台 {{tahseelPct}}%（全部均已反映在 Tahseel 主账本中）。',
    en: 'Total amount processed this month is **{{amountB}} B SAR** ({{processedCount}} invoices), up {{amountDelta}}% MoM. Mumathil accounts for {{makinPct}}%, Foras {{tahseelPct}}% of originating platforms (all of it is also reflected in the Tahseel master ledger).',
    ar: 'إجمالي المبالغ المعالجة هذا الشهر **{{amountB}} مليار ر.س** ({{processedCount}} فاتورة)، بنمو {{amountDelta}}%. تشكل منصة Mumathil {{makinPct}}٪ ومنصة Foras {{tahseelPct}}٪ من المصادر (وجميعها معكوسة في السجل الرئيسي تحصيل).',
    chart: 'source'
  },
  {
    match: ['异常', '欺诈', '风险', 'anomaly', 'fraud', 'risk', 'المنحرفة', 'احتيال'],
    zh: '本月共拦截异常/欺诈账单 **{{anomalyTotal}} 起**，风险雷达当前列出 {{riskListCount}} 条重点案例（{{highRisk}} 项高危、{{midRisk}} 项中危）。最典型的是 {{topRiskEntity}}（{{topRiskId}}），{{topRiskTag}}，风险评分 {{topRiskScore}}，已转人工复核。',
    en: '**{{anomalyTotal}} anomalous/fraudulent invoices** were intercepted this month. Risk Radar currently lists {{riskListCount}} priority cases ({{highRisk}} high-risk, {{midRisk}} mid-risk). The top case is {{topRiskEntity}} ({{topRiskId}}) — {{topRiskTag}}, risk score {{topRiskScore}}, referred for manual review.',
    ar: 'تم اعتراض **{{anomalyTotal}} حالة** منحرفة/احتيالية هذا الشهر. يعرض رادار المخاطر حالياً {{riskListCount}} حالة ذات أولوية ({{highRisk}} عالية الخطورة، {{midRisk}} متوسطة). أبرزها {{topRiskEntity}} ({{topRiskId}}) — {{topRiskTag}}، بدرجة خطورة {{topRiskScore}}.',
    chart: 'riskBuckets'
  },
  {
    match: ['自动', '录入', 'automation', 'auto entry', 'الأتمتة'],
    zh: '字段自动录入率为 **{{automation}}%**，已超过 {{automationTarget}}% 的目标（FR-002）。近 8 个月自动化率从 {{automationStart}}% 稳步提升至 {{automation}}%。',
    en: 'The field auto-entry rate is **{{automation}}%**, exceeding the {{automationTarget}}% target (FR-002). Over the last 8 months, automation rose steadily from {{automationStart}}% to {{automation}}%.',
    ar: 'بلغ معدل الأتمتة في إدخال الحقول **{{automation}}%**، متجاوزًا الهدف {{automationTarget}}%. ارتفع من {{automationStart}}% إلى {{automation}}% خلال 8 أشهر.',
    chart: 'automation'
  },
  {
    match: ['逾期', '催收清单', 'overdue', 'distressed', 'receivable', 'متعثر', 'متأخر'],
    zh: '催收预测页面当前列出 **{{debtCount}} 笔逾期账款**，合计 {{debtTotalK}} 千 SAR。最久逾期的是 {{oldestEntity}}（{{oldestId}}），已逾期 {{oldestDays}} 天，AI 预测回收概率仅 {{oldestProb}}%，建议催收经理立即介入。',
    en: 'Collection Forecast currently lists **{{debtCount}} overdue receivables** totaling {{debtTotalK}}K SAR. The longest-overdue is {{oldestEntity}} ({{oldestId}}), {{oldestDays}} days overdue with only {{oldestProb}}% predicted recovery — collection manager should intervene now.',
    ar: 'تعرض صفحة توقعات التحصيل حالياً **{{debtCount}} مديونية متعثرة** بإجمالي {{debtTotalK}} ألف ر.س. أطولها تأخراً {{oldestEntity}} ({{oldestId}})، متأخرة {{oldestDays}} يوماً باحتمال تحصيل {{oldestProb}}% فقط — يوصى بتدخل مدير التحصيل فوراً.',
    chart: 'collectionProb'
  },
  {
    match: ['待审批', '审批中心', 'pending approval', 'approval center', 'approvals', 'معلقة', 'موافقات'],
    zh: '审批中心当前有 **{{apvCount}} 笔待审批账单**，合计 {{apvTotalM}} 百万 SAR，最高优先级为 {{apvTopEntity}}（{{apvTopId}}，{{apvTopAmount}} SAR）。',
    en: 'Approval Center currently has **{{apvCount}} invoices pending approval**, totaling {{apvTotalM}}M SAR. Top priority is {{apvTopEntity}} ({{apvTopId}}, {{apvTopAmount}} SAR).',
    ar: 'يوجد حالياً في مركز الموافقات **{{apvCount}} فواتير معلقة**، بإجمالي {{apvTotalM}} مليون ر.س. الأعلى أولوية {{apvTopEntity}} ({{apvTopId}}، {{apvTopAmount}} ر.س).',
    chart: 'approvalsBar'
  },
  {
    match: ['账单状态', '状态分布', 'invoice status', 'status distribution', 'حالة الفواتير'],
    zh: '账单库当前共 **{{invTotal}} 张账单**：{{stApproved}} 张已通过、{{stPending}} 张待处理、{{stReview}} 张待人工复核、{{stDuplicate}} 张重复拦截、{{stAnomaly}} 张欺诈警告。',
    en: 'The Invoice Library currently has **{{invTotal}} invoices**: {{stApproved}} approved, {{stPending}} pending, {{stReview}} under review, {{stDuplicate}} duplicate-blocked, {{stAnomaly}} fraud-flagged.',
    ar: 'يضم سجل الفواتير حالياً **{{invTotal}} فاتورة**: {{stApproved}} معتمدة، {{stPending}} قيد الانتظار، {{stReview}} بمراجعة بشرية، {{stDuplicate}} محظورة للتكرار، {{stAnomaly}} بتحذير احتيال.',
    chart: 'invoiceStatus'
  },
  {
    match: ['处理周期', '处理时间', 'processing time', 'cycle time', 'وقت المعالجة', 'دورة المعالجة'],
    zh: '当前平均处理周期为 **{{avgHours}} 小时**，相比人工处理的 3-5 天大幅缩短。',
    en: 'The current average processing cycle is **{{avgHours}} hours**, a major reduction from the 3-5 days required for manual processing.',
    ar: 'يبلغ متوسط دورة المعالجة الحالية **{{avgHours}} ساعة**، بانخفاض كبير مقارنة بـ3-5 أيام في المعالجة اليدوية.',
    chart: null
  }
];

export const DEFAULT_ANSWER = {
  zh: '我是「智能账单管理」总控助手，可回答本月 KPI、回收率、处理金额、异常拦截、自动化率等问题，支持中文与阿拉伯语。你可以试着问我：“本月回收率多少？”或用阿拉伯语提问 “ما هو معدل التحصيل؟”。',
  en: "I am the INTELLIBILL orchestrator assistant. I can answer questions about monthly KPIs, collection rate, processed amount, anomaly interception, and automation rate — in English, Chinese, and Arabic. Try asking: \"What is this month's collection rate?\"",
  ar: 'أنا المساعد الرئيسي لإدارة الفواتير الذكية، يمكنني الإجابة عن مؤشرات الأداء الرئيسية بالعربية والصينية والإنجليزية. جرّب أن تسأل: "ما هو معدل التحصيل؟".'
};

/* ---------- Payer master (Sanad / ERP registry) ----------
   Referenced by the validation & anomaly agents so intermediate tool results
   quote real-looking, internally-consistent payer records. */
export const PAYER_MASTER = {
  'Al-Rajhi Construction Group': {
    cr: 'CR-1010-448120', vatReg: '3001234567800003', sinceYear: 2014,
    invoices90d: 41, onTimeRate: 0.94, defaultRisk: 'low'
  },
  'NEOM Logistics': {
    cr: 'CR-7010-990015', vatReg: '3009988776600001', sinceYear: 2026,
    invoices90d: 0, onTimeRate: null, defaultRisk: 'unknown'
  },
  'Gulf Facility Mgmt': {
    cr: 'CR-1010-448120', vatReg: '3001234567800003', sinceYear: 2018,
    invoices90d: 12, onTimeRate: 0.88, defaultRisk: 'low'
  },
  'Aramco Logistics Supply': {
    cr: 'CR-2055-338890', vatReg: '3005566778800002', sinceYear: 2011,
    invoices90d: 27, onTimeRate: 0.91, defaultRisk: 'low'
  }
};

/* ---------- 3-way reconciliation dataset (Invoice ↔ Collection Order ↔ Accrual Confirmation) ----------
   Per scenario, internally consistent multi-line fee-assessment records + ZATCA 15%
   VAT recompute. `invUnit` = invoice unit rate, `poUnit` = collection-order unit rate,
   `benchUnit` = standard fee-tariff benchmark, `grnQty` = accrual-confirmed qty.
   Status chips are DERIVED in ReconciliationTable from these raw values. */
export const RECON = {
  normal: {
    invoiceNo: 'INV-2026-0731',
    payer: 'Al-Rajhi Construction Group',
    co: 'CO-88231',
    accrual: 'AC-2026-4471',
    contract: 'SANAD-CT-2231',
    currency: 'SAR',
    lines: [
      { no: 1, item: { zh: '场地占用费 (m²)', en: 'Site occupation fee (m²)', ar: 'رسوم إشغال الموقع (م²)' }, qty: 2000, poQty: 2000, grnQty: 2000, invUnit: 375, poUnit: 375, benchUnit: 372 },
      { no: 2, item: { zh: '建筑废弃物处理费 (吨)', en: 'Construction-waste disposal fee (ton)', ar: 'رسوم التخلص من مخلفات البناء (طن)' }, qty: 250, poQty: 250, grnQty: 250, invUnit: 1400, poUnit: 1400, benchUnit: 1385 },
      { no: 3, item: { zh: '脚手架许可月费 (月)', en: 'Scaffolding permit fee (month)', ar: 'رسوم ترخيص السقالات الشهرية (شهر)' }, qty: 5, poQty: 5, grnQty: 5, invUnit: 30000, poUnit: 30000, benchUnit: 29500 }
    ],
    vat: { subtotal: 1250000, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: '3001234567800003', valid: true }
  },
  fraud: {
    invoiceNo: 'INV-2026-0730',
    payer: 'NEOM Logistics',
    co: 'CO-88192',
    accrual: 'AC-2026-4460',
    contract: 'SANAD-CT-7715',
    currency: 'SAR',
    // Invoice↔CO↔Accrual are internally consistent (3-way verification PASSES at Validation);
    // the anomaly signal is fee-vs-tariff, caught downstream by Anomaly & Fraud Detection.
    lines: [
      { no: 1, item: { zh: '重型车辆通行许可费 (车次)', en: 'Heavy-vehicle route permit fee (trip)', ar: 'رسوم تصريح مسار المركبات الثقيلة (رحلة)' }, qty: 120, poQty: 120, grnQty: 120, invUnit: 3200, poUnit: 3200, benchUnit: 2320 },
      { no: 2, item: { zh: '燃油与环保附加费', en: 'Fuel & environmental levy', ar: 'رسوم الوقود والبيئة الإضافية' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 102000, poUnit: 102000, benchUnit: 98000 }
    ],
    vat: { subtotal: 486000, declared: 72900, expected: 72900, rate: 15 },
    taxId: { value: '3009988776600001', valid: true }
  },
  dup: {
    invoiceNo: 'INV-2026-0728',
    payer: 'Gulf Facility Mgmt',
    co: 'CO-88231',
    accrual: 'AC-2026-4471',
    contract: 'SANAD-CT-2231',
    currency: 'SAR',
    duplicateOf: 'INV-2026-0731',
    lines: [
      { no: 1, item: { zh: '设施运营许可费 (月)', en: 'Facility operating license fee (month)', ar: 'رسوم ترخيص تشغيل المرفق (شهر)' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 1250000, poUnit: 1250000, benchUnit: 1250000 }
    ],
    vat: { subtotal: 1250000, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: '3001234567800003', valid: true }
  },
  taxfail: {
    invoiceNo: 'INV-2026-0727',
    payer: 'Aramco Logistics Supply',
    co: 'CO-87990',
    accrual: 'AC-2026-4402',
    contract: 'SANAD-CT-2799',
    currency: 'SAR',
    // Line 1 unit rate differs from the Collection Order → total variance +2.4%; VAT declared
    // ≠ ZATCA-expected; tax-ID fails ZATCA check-digit validation.
    lines: [
      { no: 1, item: { zh: '仓储分区许可费 (月)', en: 'Warehouse zoning fee (month)', ar: 'رسوم تقسيم المستودعات (شهر)' }, qty: 12, poQty: 12, grnQty: 12, invUnit: 180000, poUnit: 173750, benchUnit: 172000 },
      { no: 2, item: { zh: '车队登记续期费', en: 'Fleet registration renewal fee', ar: 'رسوم تجديد تسجيل الأسطول' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 620000, poUnit: 620000, benchUnit: 610000 },
      { no: 3, item: { zh: '装卸与清关征费', en: 'Handling & customs levy', ar: 'رسوم المناولة والتخليص الجمركي' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 400000, poUnit: 400000, benchUnit: 395000 }
    ],
    vat: { subtotal: 3180000, declared: 472800, expected: 477000, rate: 15 },
    taxId: { value: '3005566778800002', valid: false }
  }
};

/* ---------- Illustrative Sanad-style enforcement-order / invoice-linkage finding ----------
   Fictional, illustrative-only figures — NOT derived from any real Sanad
   extract or any confidential ministry data. Shaped to demonstrate the same
   kind of finding a real enforcement/invoice linkage audit could surface
   (referral records reviewed, orders actually issued vs. requested, and how
   many of those issued orders carry no linked invoice number), with
   invented case numbers, amounts, and Amanahs for demo purposes only. */
export const SANAD_ENFORCEMENT = {
  recordsReviewed: 31850,
  missingInvoicePct: 7,
  ordersIssued: 2180,
  // Small residual gap (~7%) — the large majority are already linked from
  // prior manual reconciliation work; this remaining slice is the actual
  // backlog this demo's OCR-linking flow (below) illustrates a fix for.
  ordersUnlinked: 153,
  ordersUnlinkedValue: 10000000,
  sample: [
    { enforceNum: 'EN-2607714', amanahEn: 'Riyadh Amanah', amanah: '利雅得', amanahAr: 'أمانة الرياض', amount: 355000, defendant: { en: 'Individual (investor)', zh: '个人（投资者）', ar: 'فرد (مستثمر)' } },
    { enforceNum: 'EN-2119843', amanahEn: 'Eastern Province Amanah', amanah: '东部省', amanahAr: 'أمانة المنطقة الشرقية', amount: 590500, defendant: { en: 'Registered company', zh: '注册公司', ar: 'شركة مسجلة في المملكة' } },
    { enforceNum: 'EN-2884026', amanahEn: 'Jeddah Amanah', amanah: '吉达', amanahAr: 'أمانة محافظة جدة', amount: 875250, defendant: { en: 'Registered company', zh: '注册公司', ar: 'شركة مسجلة في المملكة' } },
    { enforceNum: 'EN-2093317', amanahEn: 'Tabuk Amanah', amanah: '塔布克', amanahAr: 'أمانة منطقة تبوك', amount: 412500, defendant: { en: 'Registered company', zh: '注册公司', ar: 'شركة مسجلة في المملكة' } },
    { enforceNum: 'EN-2451982', amanahEn: 'Makkah Amanah', amanah: '麦加', amanahAr: 'أمانة منطقة مكة المكرمة', amount: 268000, defendant: { en: 'Individual (investor)', zh: '个人（投资者）', ar: 'فرد (مستثمر)' } },
    { enforceNum: 'EN-2760541', amanahEn: 'Al Madinah Amanah', amanah: '麦地那', amanahAr: 'أمانة المدينة المنورة', amount: 1245000, defendant: { en: 'Registered company', zh: '注册公司', ar: 'شركة مسجلة في المملكة' } }
  ]
};

/* ---------- Illustrative ministry-wide revenue benchmark ----------
   Fictional, illustrative-only figures for demo purposes — NOT sourced from
   any real ministry executive report or confidential financial data. Shaped
   to demonstrate the same kind of gross→net→collected revenue ladder, by
   revenue-source breakdown, and year-over-year comparison a real executive
   report might show. Internally consistent (source rows sum to the
   cumulative totals; YoY % derived from the two year figures shown), but
   every number here is invented. All amounts are in SAR MILLIONS, a
   completely different scale from the fictional per-invoice INVOICES array
   above. Treat as a fixed reference snapshot, not something the demo's
   period filter should touch. */
export const REVENUE_BENCHMARK_SAMPLE = {
  month: 'sample-month',
  bySource: [
    { key: 'investment', nameEn: 'Municipal Real-Estate Investment', nameAr: 'إيرادات استثمار العقارات البلدية', name: '市政房地产投资收入', rate: 64, collected: 2180, netInvoiced: 3410, weight: 30 },
    { key: 'housing', nameEn: 'Housing Sector', nameAr: 'قطاع الإسكان', name: '住房板块', rate: 71, collected: 2100, netInvoiced: 2950, weight: 26 },
    { key: 'penalties', nameEn: 'Penalties & Fines', nameAr: 'إيرادات الجزاءات والغرامات', name: '罚款与处罚收入', rate: 58, collected: 1320, netInvoiced: 2270, weight: 20 },
    { key: 'misc', nameEn: 'Misc. Revenues & Fees', nameAr: 'الإيرادات المختلفة وإيرادات الرسوم والمقابلات المالية', name: '其他收入及费用', rate: 100, collected: 1820, netInvoiced: 1820, weight: 16 },
    { key: 'sales', nameEn: 'Sales Fees', nameAr: 'رسوم المبيعات', name: '销售费用', rate: 88, collected: 800, netInvoiced: 910, weight: 8 }
  ],
  cumulative: { collected: 8220, netInvoiced: 11360, grossInvoiced: 12480, collectedPctOfNet: 72, netPctOfGross: 91 },
  // Year-over-year, illustrative (sample year vs. prior sample year).
  yoy: {
    collected: { y2026: 8220, y2025: 7020, pct: 17 },
    netInvoiced: { y2026: 11360, y2025: 10430, pct: 9 },
    grossInvoiced: { y2026: 12480, y2025: 10970, pct: 14 },
    budgetTarget: { y2026: 6250, y2025: 5840, pct: 7 }
  }
};

/* ---------- Utility ---------- */
export function fmtMoney(n) {
  return n.toLocaleString('en-US', { numberingSystem: 'latn' });
}
