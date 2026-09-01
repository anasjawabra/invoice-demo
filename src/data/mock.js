// IntelliBill demo data (ES module)
// Source: legacy assets/js/data.js

/* ---------- Demo accounts ----------
   roleKey drives nav visibility (Layout) per the HLSD 10-persona matrix;
   legacy sessions without a roleKey fall back to 'manager'. */
export const CREDENTIALS = [
  {
    user: 'demo',
    pass: 'demo123',
    roleKey: 'manager',
    name: '李芳军',
    nameEn: 'Li Fangjun',
    nameAr: 'لي فانغجون',
    role: '财务共享中心 · 主管',
    roleEn: 'Shared Service Center · Manager',
    roleAr: 'مركز الخدمات المشتركة · مدير',
    avatar: 'LF'
  },
  {
    user: 'auditor',
    pass: 'demo123',
    roleKey: 'auditor',
    name: 'Ahmad Al-Saud',
    nameEn: 'Ahmad Al-Saud',
    nameAr: 'أحمد آل سعود',
    role: '审计师 · Auditor',
    roleEn: 'Auditor',
    roleAr: 'مدقق',
    avatar: 'AS'
  },
  {
    user: 'reconciler',
    pass: 'demo123',
    roleKey: 'reconciler',
    name: 'Faisal Al-Otaibi',
    nameEn: 'Faisal Al-Otaibi',
    nameAr: 'فيصل العتيبي',
    role: '对账专员 · Reconciliation',
    roleEn: 'Financial Reconciliation Officer',
    roleAr: 'مسؤول التسوية المالية',
    avatar: 'FO'
  },
  {
    user: 'penalties',
    pass: 'demo123',
    roleKey: 'penalties',
    name: 'Noura Al-Harbi',
    nameEn: 'Noura Al-Harbi',
    nameAr: 'نورة الحربي',
    role: '处罚与罚款专员 · Penalties',
    roleEn: 'Penalties & Fines Officer',
    roleAr: 'مسؤول الغرامات والمخالفات',
    avatar: 'NH'
  },
  {
    user: 'admin',
    pass: 'admin',
    roleKey: 'admin',
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

/* ---------- Proactive alerts ---------- */
export const PROACTIVE = [
  {
    icon: 'clock',
    color: 'orange',
    title: 'ZATCA 增值税申报临近',
    titleEn: 'ZATCA VAT filing due soon',
    titleAr: 'اقتراب موعد إقرار ضريبة القيمة المضافة',
    desc: '6 月税期增值税申报将于 3 天后（8 月 1 日）截止，尚有 82 张进项发票待归集。',
    descEn:
      'The June VAT return is due in 3 days (Aug 1); 82 input invoices are still pending consolidation.',
    descAr:
      'إقرار ضريبة القيمة المضافة لشهر يونيو مستحق خلال 3 أيام (1 أغسطس)؛ 82 فاتورة مدخلات بانتظار التجميع.',
    act: '一键归集进项',
    actEn: 'Consolidate inputs',
    actAr: 'تجميع المدخلات'
  },
  {
    icon: 'coins',
    color: 'blue',
    title: '5 张账单 48 小时内到期付款',
    titleEn: '5 invoices due for payment within 48h',
    titleAr: '5 فواتير مستحقة الدفع خلال 48 ساعة',
    desc: '合计 4.62M SAR 的 5 张已批账单将在 48 小时内到期，及时付款可享 2% 早付折扣。',
    descEn:
      '5 approved invoices totaling 4.62M SAR fall due within 48h; paying on time captures a 2% early-payment discount.',
    descAr:
      '5 فواتير معتمدة بإجمالي 4.62 مليون ر.س تستحق خلال 48 ساعة؛ السداد في الوقت المحدد يوفر خصم دفع مبكر 2٪.',
    act: '安排付款',
    actEn: 'Schedule payment',
    actAr: 'جدولة الدفع'
  },
  {
    icon: 'warn',
    color: 'red',
    title: '高延迟风险账款需介入',
    titleEn: 'High delay-risk receivable needs action',
    titleAr: 'ذمة مدينة عالية مخاطر التأخير',
    desc: 'Coastal 物流账款逾期 61 天，AI 预测回收概率仅 21%，建议催收经理立即介入。',
    descEn:
      'Coastal Logistics is 61 days overdue; AI predicts only 21% recovery probability — collection manager should intervene now.',
    descAr:
      'ساحلية للخدمات اللوجستية متأخرة 61 يوماً؛ يتوقع الذكاء الاصطناعي احتمال تحصيل 21٪ فقط — يوصى بتدخل مدير التحصيل فوراً.',
    act: '发起催收',
    actEn: 'Start collection',
    actAr: 'بدء التحصيل'
  },
  {
    icon: 'file',
    color: 'teal',
    title: '框架合同即将到期',
    titleEn: 'Framework contract nearing expiry',
    titleAr: 'اقتراب انتهاء العقد الإطاري',
    desc: 'PO-88231 框架合同 15 天后到期，AI 建议提前准备续接账单批次与新一轮预算冻结。',
    descEn:
      'Framework contract PO-88231 expires in 15 days; AI recommends preparing the continuation invoice batch and a new budget hold in advance.',
    descAr:
      'ينتهي العقد الإطاري PO-88231 خلال 15 يوماً؛ يوصي الذكاء الاصطناعي بإعداد دفعة الفواتير التكميلية وحجز ميزانية جديد مسبقاً.',
    act: '准备续接',
    actEn: 'Prepare renewal',
    actAr: 'تحضير التجديد'
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
    labelAr: 'الحالات الشاذة',
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

/* ---------- 7 agents ---------- */
export const AGENTS = [
  {
    id: 'A0',
    name: '总控编排 Agent',
    nameEn: 'Orchestrator Agent',
    nameAr: 'وكيل التنسيق',
    en: 'Orchestrator',
    form: '多智能体编排',
    formEn: 'Multi-Agent Orchestration',
    formAr: 'تنسيق متعدد الوكلاء',
    color: 'gold',
    desc: '意图识别与任务路由，按流水线调度 6 个子 Agent，统一中/阿对话入口，控制 HITL 断点。',
    descEn:
      'Intent recognition and task routing. Schedules 6 sub-agents via the pipeline, provides a unified ZH/AR chat entry, and controls HITL breakpoints.',
    descAr:
      'التعرف على القصد وتوجيه المهام. يقوم بجدولة 6 وكلاء فرعيين عبر خط الأنابيب، ويوفر مدخل دردشة موحداً بالصينية/العربية، ويتحكم في نقاط توقف HITL.',
    uc: '贯穿全流程 / UC-07',
    model: '豆包多语言模型 · 温度 0.2',
    modelEn: 'Doubao Multilingual · Temp 0.2',
    modelAr: 'Doubao متعدد اللغات · حرارة 0.2',
    status: 'online',
    calls: 48210,
    acc: 100
  },
  {
    id: 'A1',
    name: '摄取 Agent',
    nameEn: 'Ingestion Agent',
    nameAr: 'وكيل الاستيعاب',
    en: 'Ingestion',
    form: '工作流应用',
    formEn: 'Workflow App',
    formAr: 'تطبيق سير العمل',
    color: 'teal',
    desc: '从四平台/邮件/ERP 抓取账单，OCR 提取金额/日期/PO/税号，格式标准化与重复检测。',
    descEn:
      'Fetches invoices from the 4 platforms/email/ERP. OCR extraction of amount/date/PO/VAT, format standardization, and duplicate detection.',
    descAr:
      'يجلب الفواتير من المنصات الأربع/البريد/ERP. استخراج OCR للمبلغ/التاريخ/PO/الرقم الضريبي، توحيد التنسيق، وكشف التكرار.',
    uc: 'UC-01 / FR-001~004',
    model: '豆包视觉+文本 · 温度 0.1',
    modelEn: 'Doubao Vision+Text · Temp 0.1',
    modelAr: 'Doubao رؤية+نص · حرارة 0.1',
    status: 'online',
    calls: 12480,
    acc: 96.4
  },
  {
    id: 'A2',
    name: '验证合规 Agent',
    nameEn: 'Verification Agent',
    nameAr: 'وكيل التحقق',
    en: 'Verification',
    form: '工作流应用',
    formEn: 'Workflow App',
    formAr: 'تطبيق سير العمل',
    color: 'indigo',
    desc: '三单匹配（账单-PO-实收），ZATCA 税务校验，Makeen vs Tahseel 跨平台对账。',
    descEn:
      '3-way matching (Invoice-PO-Receipt), ZATCA tax verification, and cross-platform reconciliation between Makeen and Tahseel.',
    descAr:
      'المطابقة الثلاثية (فاتورة-PO-إيصال)، التحقق الضريبي ZATCA، والتسوية عبر المنصات بين Makeen وTahseel.',
    uc: 'UC-02、UC-11 / FR-005/006',
    model: '豆包文本模型 · 温度 0.2',
    modelEn: 'Doubao Text · Temp 0.2',
    modelAr: 'Doubao نص · حرارة 0.2',
    status: 'online',
    calls: 12210,
    acc: 92.8
  },
  {
    id: 'A3',
    name: '异常检测 Agent',
    nameEn: 'Anomaly Agent',
    nameAr: 'وكيل كشف الشذوذ',
    en: 'Anomaly',
    form: '工作流 + 大模型',
    formEn: 'Workflow + LLM',
    formAr: 'سير العمل + LLM',
    color: 'red',
    desc: '供应商历史模式与行业价格基准比对，离群分析，输出 0-100 风险评分与欺诈警告。',
    descEn:
      'Compares against vendor historical patterns and industry price benchmarks, runs outlier analysis, and outputs a 0-100 risk score with fraud warnings.',
    descAr:
      'يقارن بأنماط المورد التاريخية والمعايير السعرية للقطاع، يجري تحليل القيم الشاذة، ويخرج درجة مخاطرة 0-100 مع تحذيرات الاحتيال.',
    uc: 'UC-03 / FR-008',
    model: '豆包文本模型 · 温度 0.3',
    modelEn: 'Doubao Text · Temp 0.3',
    modelAr: 'Doubao نص · حرارة 0.3',
    status: 'online',
    calls: 11980,
    acc: 88.6
  },
  {
    id: 'A4',
    name: '审批路由 Agent',
    nameEn: 'Routing Agent',
    nameAr: 'وكيل التوجيه',
    en: 'Routing',
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
    id: 'A5',
    name: '催收预测 Agent',
    nameEn: 'Forecasting Agent',
    nameAr: 'وكيل التنبؤ',
    en: 'Forecasting',
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
    id: 'A6',
    name: '分析问答 Agent',
    nameEn: 'Analytics Agent',
    nameAr: 'وكيل التحليلات',
    en: 'Analytics',
    form: '对话型 + 工作流',
    formEn: 'Conversational + Workflow',
    formAr: 'حواري + سير العمل',
    color: 'green',
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

/* ---------- Pipeline steps ---------- */
export const PIPELINE = [
  {
    agent: 'A1',
    name: '摄取',
    nameEn: 'Ingestion',
    nameAr: 'الاستيعاب',
    en: 'Ingestion',
    hint: 'OCR 提取 · 字段映射 · 重复检测',
    hintEn: 'OCR Extraction · Field Mapping · Dedup',
    hintAr: 'استخراج OCR · تعيين الحقول · كشف التكرار'
  },
  {
    agent: 'A2',
    name: '验证合规',
    nameEn: 'Verification',
    nameAr: 'التحقق',
    en: 'Verification',
    hint: '三单匹配 · ZATCA 校验 · 跨平台对账',
    hintEn: '3-Way Match · ZATCA Check · Reconciliation',
    hintAr: 'مطابقة ثلاثية · فحص ZATCA · تسوية'
  },
  {
    agent: 'A3',
    name: '异常检测',
    nameEn: 'Anomaly',
    nameAr: 'كشف الشذوذ',
    en: 'Anomaly',
    hint: '价格基准比对 · 风险评分 0-100',
    hintEn: 'Benchmark Comparison · Risk Score 0-100',
    hintAr: 'مقارنة المعايير · درجة مخاطرة 0-100'
  },
  {
    agent: 'A4',
    name: '审批路由',
    nameEn: 'Routing',
    nameAr: 'التوجيه',
    en: 'Routing',
    hint: '授权矩阵 · 审批链分发 (HITL)',
    hintEn: 'Authorization Matrix · Chain Dispatch (HITL)',
    hintAr: 'مصفوفة التفويض · توزيع السلسلة (HITL)'
  },
  {
    agent: 'A5',
    name: '催收预测',
    nameEn: 'Forecasting',
    nameAr: 'التنبؤ',
    en: 'Forecasting',
    hint: '回收概率 · 延迟风险预警',
    hintEn: 'Recovery Probability · Delay Warnings',
    hintAr: 'احتمال التحصيل · تنبيهات التأخير'
  },
  {
    agent: 'A6',
    name: '分析归档',
    nameEn: 'Analytics',
    nameAr: 'التحليلات',
    en: 'Analytics',
    hint: 'KPI 汇总 · 审计留痕',
    hintEn: 'KPI Aggregation · Audit Trail',
    hintAr: 'تجميع المؤشرات · سجل التدقيق'
  }
];

/* ---------- Sources ---------- */
export const SOURCES = [
  {
    id: 'tahseel',
    name: 'Tahseel',
    desc: '催收平台',
    descEn: 'Collection Platform',
    descAr: 'منصة التحصيل',
    count: 4820,
    color: 'teal'
  },
  {
    id: 'makin',
    name: 'Makeen',
    desc: '合同平台',
    descEn: 'Contract Platform',
    descAr: 'منصة العقود',
    count: 3610,
    color: 'indigo'
  },
  {
    id: 'efa',
    name: 'Efaa',
    desc: '支付平台',
    descEn: 'Payment Platform',
    descAr: 'منصة الدفع',
    count: 2240,
    color: 'green'
  },
  {
    id: 'sanad',
    name: 'Sanad',
    desc: '凭证平台',
    descEn: 'Voucher Platform',
    descAr: 'منصة القسائم',
    count: 1810,
    color: 'gold'
  }
];

/* ---------- Invoices ---------- */
export const INVOICES = [
  {
    id: 'INV-2026-0731',
    entity: 'Al-Rajhi 建设集团',
    entityEn: 'Al-Rajhi Construction Group',
    entityAr: 'مجموعة الراجحي للإنشاءات',
    amount: 1250000,
    currency: 'SAR',
    source: 'Tahseel',
    po: 'PO-88231',
    vat: '3001234567800003',
    date: '2026-07-26',
    status: 'pending',
    risk: 12,
    confidence: 0.97,
    tag: 'normal'
  },
  {
    id: 'INV-2026-0730',
    entity: 'NEOM 物流服务',
    entityEn: 'NEOM Logistics',
    entityAr: 'نيوم للخدمات اللوجستية',
    amount: 486000,
    currency: 'SAR',
    source: 'Makeen',
    po: 'PO-88192',
    vat: '3009988776600001',
    date: '2026-07-26',
    status: 'anomaly',
    risk: 82,
    confidence: 0.71,
    tag: 'fraud'
  },
  {
    id: 'INV-2026-0729',
    entity: 'Saudi Tech Solutions',
    entityEn: 'Saudi Tech Solutions',
    entityAr: 'الحلول التقنية السعودية',
    amount: 92500,
    currency: 'SAR',
    source: 'Efaa',
    po: 'PO-88155',
    vat: '3002233445500007',
    date: '2026-07-25',
    status: 'approved',
    risk: 8,
    confidence: 0.99,
    tag: 'normal'
  },
  {
    id: 'INV-2026-0728',
    entity: 'Gulf Facility Mgmt',
    entityEn: 'Gulf Facility Mgmt',
    entityAr: 'إدارة مرافق الخليج',
    amount: 1250000,
    currency: 'SAR',
    source: 'Tahseel',
    po: 'PO-88231',
    vat: '3001234567800003',
    date: '2026-07-25',
    status: 'duplicate',
    risk: 0,
    confidence: 0.95,
    tag: 'dup'
  },
  {
    id: 'INV-2026-0727',
    entity: 'Aramco 后勤供应',
    entityEn: 'Aramco Logistics Supply',
    entityAr: 'أرامكو للإمداد اللوجستي',
    amount: 3180000,
    currency: 'SAR',
    source: 'Makeen',
    po: 'PO-87990',
    vat: '3005566778800002',
    date: '2026-07-24',
    status: 'review',
    risk: 46,
    confidence: 0.68,
    tag: 'taxfail'
  },
  {
    id: 'INV-2026-0726',
    entity: 'Riyadh 市政工程',
    entityEn: 'Riyadh Municipal Works',
    entityAr: 'أعمال بلدية الرياض',
    amount: 742000,
    currency: 'SAR',
    source: 'Sanad',
    po: 'PO-87921',
    vat: '3007788990000004',
    date: '2026-07-24',
    status: 'approved',
    risk: 15,
    confidence: 0.96,
    tag: 'normal'
  },
  {
    id: 'INV-2026-0725',
    entity: 'STC 通信服务',
    entityEn: 'STC Telecom Services',
    entityAr: 'STC لخدمات الاتصالات',
    amount: 158900,
    currency: 'SAR',
    source: 'Efaa',
    po: 'PO-87880',
    vat: '3003344556600009',
    date: '2026-07-23',
    status: 'approved',
    risk: 5,
    confidence: 0.98,
    tag: 'normal'
  },
  {
    id: 'INV-2026-0724',
    entity: 'Bahri 海运物流',
    entityEn: 'Bahri Maritime Logistics',
    entityAr: 'البحري للخدمات اللوجستية البحرية',
    amount: 2260000,
    currency: 'SAR',
    source: 'Makeen',
    po: 'PO-87812',
    vat: '3006677889900005',
    date: '2026-07-23',
    status: 'pending',
    risk: 33,
    confidence: 0.9,
    tag: 'normal'
  }
];

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
    chain: '账单专员 → 财务经理 → 预算与财务 → 采购复核 → 中心主任 → CFO',
    chainEn:
      'Invoice Clerk → Finance Manager → Budget & Finance → Procurement Review → Center Director → CFO',
    chainAr: 'موظف الفواتير ← المدير المالي ← الميزانية والمالية ← مراجعة المشتريات ← مدير المركز ← الرئيس المالي',
    assignee: '李芳军',
    assigneeEn: 'Li Fangjun',
    assigneeAr: 'لي فانغجون',
    priority: '高',
    priorityEn: 'High',
    priorityAr: 'عالية',
    priorityKey: 'high',
    sla: '4 小时',
    slaEn: '4 hours',
    slaAr: '4 ساعات',
    slaLeft: 3.5,
    reason:
      '金额 > 300 万 SAR，触发六级审批链；且评估已超时 8h，自动升级至中心主任',
    reasonEn:
      'Amount > 3M SAR triggers the 6-level chain; evaluation also overran SLA by 8h, auto-escalated to Center Director',
    reasonAr:
      'المبلغ > 3 مليون ر.س يطلق سلسلة من 6 مستويات؛ كما تجاوز التقييم SLA بـ 8 ساعات، وتم التصعيد تلقائياً لمدير المركز',
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
    assigneeEn: 'Li Fangjun',
    assigneeAr: 'لي فانغجون',
    priority: '中',
    priorityEn: 'Medium',
    priorityAr: 'متوسطة',
    priorityKey: 'mid',
    sla: '8 小时',
    slaEn: '8 hours',
    slaAr: '8 ساعات',
    slaLeft: 7,
    reason: '金额 100~300 万 SAR，触发四级审批链',
    reasonEn: 'Amount 1-3M SAR, triggers 4-level approval chain',
    reasonAr: 'المبلغ 1-3 مليون ر.س، يطلق سلسلة موافقة من 4 مستويات',
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
    assigneeEn: 'Li Fangjun',
    assigneeAr: 'لي فانغجون',
    priority: '中',
    priorityEn: 'Medium',
    priorityAr: 'متوسطة',
    priorityKey: 'mid',
    sla: '8 小时',
    slaEn: '8 hours',
    slaAr: '8 ساعات',
    slaLeft: 6.5,
    reason: '金额 100~300 万 SAR，触发三级审批链',
    reasonEn: 'Amount 1-3M SAR, triggers 3-level approval chain',
    reasonAr: 'المبلغ 1-3 مليون ر.س، يطلق سلسلة موافقة من 3 مستويات',
    match: '完全匹配',
    matchEn: 'Full Match',
    matchAr: 'تطابق كامل',
    risk: 12
  }
];

/* ---------- Risks ---------- */
export const RISKS = [
  {
    id: 'INV-2026-0730',
    entity: 'NEOM 物流服务',
    entityEn: 'NEOM Logistics',
    entityAr: 'نيوم للخدمات اللوجستية',
    score: 82,
    level: '高危',
    levelEn: 'High Risk',
    levelAr: 'خطر عالٍ',
    types: ['价格偏离基准 +38%', '供应商首次交易', '金额整数异常'],
    typesEn: ['Price deviation +38%', 'First-time vendor', 'Round-amount anomaly'],
    typesAr: ['انحراف السعر +38٪', 'مورد لأول مرة', 'مبلغ دائري شاذ'],
    evidence:
      '同品类历史均价 352K SAR，本单 486K SAR，偏离行业基准 +38%；供应商 90 天内无历史账单。',
    evidenceEn:
      'Category avg 352K SAR, this bill 486K SAR (+38% deviation from benchmark); no vendor invoices in the last 90 days.',
    evidenceAr:
      'متوسط الفئة 352 ألف ر.س، هذه الفاتورة 486 ألف ر.س (+38٪ انحراف عن المعيار)؛ لا فواتير للمورد في آخر 90 يوماً.',
    action: '已推送风险雷达，转人工复核',
    actionEn: 'Pushed to Risk Radar, referred for manual review',
    actionAr: 'تم الدفع إلى رادار المخاطر، محال للمراجعة اليدوية',
    color: 'red'
  },
  {
    id: 'INV-2026-0709',
    entity: 'Desert Rose 贸易',
    entityEn: 'Desert Rose Trading',
    entityAr: 'وردة الصحراء للتجارة',
    score: 74,
    level: '高危',
    levelEn: 'High Risk',
    levelAr: 'خطر عالٍ',
    types: ['拆单规避审批', '短期高频提交'],
    typesEn: ['Invoice splitting', 'High-frequency submission'],
    typesAr: ['تقسيم الفواتير', 'تقديم متكرر'],
    evidence: '7 天内提交 5 张金额均为 99.8 万 SAR 的账单，疑似拆分规避 100 万审批阈值。',
    evidenceEn:
      'Submitted 5 invoices of 998K SAR each within 7 days; suspected splitting to evade the 1M approval threshold.',
    evidenceAr:
      'قدم 5 فواتير بقيمة 998 ألف ر.س لكل منها خلال 7 أيام؛ يُشتبه في التقسيم لتجاوز حد الموافقة البالغ مليون.',
    action: '标记待审计师核查',
    actionEn: 'Flagged for auditor review',
    actionAr: 'موسوم لمراجعة المدقق',
    color: 'red'
  },
  {
    id: 'INV-2026-0688',
    entity: 'Falcon 工程',
    entityEn: 'Falcon Engineering',
    entityAr: 'فالكون للهندسة',
    score: 58,
    level: '中危',
    levelEn: 'Mid Risk',
    levelAr: 'خطر متوسط',
    types: ['税号与合同主体不一致'],
    typesEn: ['VAT-contract entity mismatch'],
    typesAr: ['عدم تطابق الرقم الضريبي مع كيان العقد'],
    evidence: 'VAT 号归属主体与 Makeen 合同签约主体不一致，需核实关联关系。',
    evidenceEn:
      'The VAT owner differs from the Makeen contract signatory; the relationship needs verification.',
    evidenceAr:
      'مالك الرقم الضريبي يختلف عن موقّع عقد Makeen؛ يجب التحقق من العلاقة.',
    action: '转合规复核',
    actionEn: 'Referred to compliance review',
    actionAr: 'محال لمراجعة الامتثال',
    color: 'orange'
  },
  {
    id: 'INV-2026-0655',
    entity: 'Oasis 服务',
    entityEn: 'Oasis Services',
    entityAr: 'واحة للخدمات',
    score: 41,
    level: '中危',
    levelEn: 'Mid Risk',
    levelAr: 'خطر متوسط',
    types: ['付款周期异常缩短'],
    typesEn: ['Abnormally shortened payment term'],
    typesAr: ['مدة سداد مختصرة بشكل غير عادي'],
    evidence: '合同约定账期 60 天，本单要求 7 天内付款，偏离常规。',
    evidenceEn:
      'Contract term is 60 days, but this invoice demands payment within 7 days, deviating from the norm.',
    evidenceAr:
      'مدة العقد 60 يوماً، لكن هذه الفاتورة تطلب السداد خلال 7 أيام، بما يخالف المعتاد.',
    action: '提示财务经理关注',
    actionEn: 'Flagged for finance manager attention',
    actionAr: 'تنبيه لانتباه المدير المالي',
    color: 'orange'
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
    delayProb: 48,
    cancelProb: 18,
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
    delayProb: 31,
    cancelProb: 7,
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
    delayProb: 9,
    cancelProb: 3,
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
    delayProb: 55,
    cancelProb: 24,
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
  recovery: [78, 79.5, 81, 82.4, 83.9, 85.2, 86.4, 87.3]
};

/* ---------- Q&A scripts ----------
   `roles`: null = answer for every role; otherwise a roleKey whitelist —
   questions outside the user's scope return the RBAC-denied reply (WF04-03). */
export const QA = [
  {
    match: ['回收率', '收缴', 'recovery', 'collection rate', 'التحصيل', 'تحصيل'],
    roles: null,
    zh: '本月账款回收率为 **87.3%**，环比上升 3.1 个百分点，已超过 85% 的目标。其中 Tahseel 平台回收率最高达 91.2%，Makeen 平台 84.6%。当前有 4 笔逾期账单回收概率低于 40%，建议优先介入。',
    en: "This month's collection rate is **87.3%**, up 3.1 pts month-over-month, exceeding the 85% target. Tahseel leads at 91.2%, Makeen at 84.6%. There are 4 overdue invoices with recovery probability below 40% — priority intervention recommended.",
    ar: 'بلغ معدل التحصيل هذا الشهر **87.3%**، بزيادة 3.1 نقطة مئوية عن الشهر السابق، متجاوزًا الهدف البالغ 85%. أعلى معدل تحصيل على منصة Tahseel بنسبة 91.2%.',
    chart: 'recovery'
  },
  {
    match: ['本月收入', '处理金额', '金额', 'revenue', 'amount', 'processed', 'المبلغ', 'الإيرادات'],
    roles: ['manager', 'admin'],
    zh: '本月已处理账单金额合计 **3.82 亿 SAR**（12,480 张），环比增长 12.5%。其中 Makeen 平台占比 41%，Tahseel 平台 32%。已通过审批金额 3.44 亿，待人工复核金额 0.31 亿。',
    en: 'Total amount processed this month is **382M SAR** (12,480 invoices), up 12.5% MoM. Makeen accounts for 41%, Tahseel 32%. Approved amount is 344M, and 31M is pending manual review.',
    ar: 'إجمالي المبالغ المعالجة هذا الشهر **382 مليون ريال سعودي** (12,480 فاتورة)، بنمو 12.5%.',
    chart: 'source'
  },
  {
    match: ['异常', '欺诈', '风险', 'anomaly', 'fraud', 'risk', 'الشاذة', 'احتيال'],
    roles: ['manager', 'admin', 'auditor'],
    zh: '本月共拦截异常/欺诈账单 **214 起**，其中高危 63 起、中危 151 起。最典型的是 NEOM 物流服务（INV-2026-0730），价格偏离行业基准 +38% 且为首次交易，风险评分 82，已转人工复核。',
    en: 'A total of **214 anomalous/fraudulent invoices** were blocked this month — 63 high-risk and 151 mid-risk. The most notable is NEOM Logistics (INV-2026-0730): price deviated +38% from benchmark and it was a first-time deal, risk score 82, now referred for manual review.',
    ar: 'تم اعتراض **214 حالة** شاذة/احتيالية هذا الشهر، منها 63 عالية الخطورة. أبرزها الفاتورة INV-2026-0730 بدرجة خطورة 82.',
    chart: null
  },
  {
    match: ['自动', '录入', 'automation', 'auto entry', 'الأتمتة'],
    roles: ['manager', 'admin', 'auditor'],
    zh: '字段自动录入率为 **96.4%**，已超过 95% 的目标（FR-002）。重复检出率 98.6%，多源字段映射成功率 100%。近 8 个月自动化率从 88.2% 稳步提升至 96.4%。',
    en: 'The field auto-entry rate is **96.4%**, exceeding the 95% target (FR-002). Duplicate detection rate is 98.6% and multi-source field mapping success is 100%. Over the last 8 months, automation rose steadily from 88.2% to 96.4%.',
    ar: 'بلغ معدل الأتمتة في إدخال الحقول **96.4%**، متجاوزًا الهدف 95%.',
    chart: 'automation'
  }
];

export const DEFAULT_ANSWER = {
  zh: '我是「智能账单管理」总控助手，可回答本月 KPI、回收率、处理金额、异常拦截、自动化率等问题，支持中文与阿拉伯语。你可以试着问我：“本月回收率多少？”或用阿拉伯语提问 “ما هو معدل التحصيل؟”。',
  en: "I am the INTELLIBILL orchestrator assistant. I can answer questions about monthly KPIs, collection rate, processed amount, anomaly interception, and automation rate — in English, Chinese, and Arabic. Try asking: \"What is this month's collection rate?\"",
  ar: 'أنا المساعد الرئيسي لإدارة الفواتير الذكية، يمكنني الإجابة عن مؤشرات الأداء الرئيسية بالعربية والصينية والإنجليزية. جرّب أن تسأل: "ما هو معدل التحصيل؟".'
};

/* ---------- Vendor master (Sanad / ERP registry) ----------
   Referenced by A2 verification & A3 anomaly so intermediate tool results
   quote real-looking, internally-consistent vendor records. */
export const VENDOR_MASTER = {
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

/* ---------- 3-way reconciliation dataset (Invoice ↔ PO ↔ Goods-Receipt) ----------
   Per scenario, internally consistent multi-line records + ZATCA 15% VAT recompute.
   `invUnit` = invoice unit price, `poUnit` = purchase-order unit price,
   `benchUnit` = contract/market benchmark, `grnQty` = goods-received qty.
   Status chips are DERIVED in ReconciliationTable from these raw values. */
export const RECON = {
  normal: {
    invoiceNo: 'INV-2026-0731',
    vendor: 'Al-Rajhi Construction Group',
    po: 'PO-88231',
    grn: 'GRN-2026-4471',
    contract: 'SANAD-CT-2231',
    currency: 'SAR',
    lines: [
      { no: 1, item: { zh: '预拌混凝土 (m³)', en: 'Ready-mix concrete (m³)', ar: 'خرسانة جاهزة (م³)' }, qty: 2000, poQty: 2000, grnQty: 2000, invUnit: 375, poUnit: 375, benchUnit: 372 },
      { no: 2, item: { zh: '钢筋 (吨)', en: 'Steel rebar (ton)', ar: 'حديد تسليح (طن)' }, qty: 250, poQty: 250, grnQty: 250, invUnit: 1400, poUnit: 1400, benchUnit: 1385 },
      { no: 3, item: { zh: '模板租赁 (月)', en: 'Formwork rental (month)', ar: 'إيجار قوالب (شهر)' }, qty: 5, poQty: 5, grnQty: 5, invUnit: 30000, poUnit: 30000, benchUnit: 29500 }
    ],
    vat: { subtotal: 1250000, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: '3001234567800003', valid: true }
  },
  fraud: {
    invoiceNo: 'INV-2026-0730',
    vendor: 'NEOM Logistics',
    po: 'PO-88192',
    grn: 'GRN-2026-4460',
    contract: 'SANAD-CT-7715',
    currency: 'SAR',
    // Invoice↔PO↔GRN are internally consistent (3-way match PASSES at A2);
    // the fraud signal is price-vs-benchmark, caught downstream by A3.
    lines: [
      { no: 1, item: { zh: '重型设备运输 (车次)', en: 'Heavy-equipment transport (trip)', ar: 'نقل معدات ثقيلة (رحلة)' }, qty: 120, poQty: 120, grnQty: 120, invUnit: 3200, poUnit: 3200, benchUnit: 2320 },
      { no: 2, item: { zh: '燃油附加费', en: 'Fuel surcharge', ar: 'رسوم وقود إضافية' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 102000, poUnit: 102000, benchUnit: 98000 }
    ],
    vat: { subtotal: 486000, declared: 72900, expected: 72900, rate: 15 },
    taxId: { value: '3009988776600001', valid: true }
  },
  dup: {
    invoiceNo: 'INV-2026-0728',
    vendor: 'Gulf Facility Mgmt',
    po: 'PO-88231',
    grn: 'GRN-2026-4471',
    contract: 'SANAD-CT-2231',
    currency: 'SAR',
    duplicateOf: 'INV-2026-0731',
    lines: [
      { no: 1, item: { zh: '设施管理服务 (月)', en: 'Facility management (month)', ar: 'إدارة مرافق (شهر)' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 1250000, poUnit: 1250000, benchUnit: 1250000 }
    ],
    vat: { subtotal: 1250000, declared: 187500, expected: 187500, rate: 15 },
    taxId: { value: '3001234567800003', valid: true }
  },
  taxfail: {
    invoiceNo: 'INV-2026-0727',
    vendor: 'Aramco Logistics Supply',
    po: 'PO-87990',
    grn: 'GRN-2026-4402',
    contract: 'SANAD-CT-2799',
    currency: 'SAR',
    // Line 1 unit price differs from PO → total variance +2.4%; VAT declared
    // ≠ ZATCA-expected; tax-ID fails ZATCA check-digit validation.
    lines: [
      { no: 1, item: { zh: '仓储租赁 (月)', en: 'Warehouse leasing (month)', ar: 'تأجير مستودع (شهر)' }, qty: 12, poQty: 12, grnQty: 12, invUnit: 180000, poUnit: 173750, benchUnit: 172000 },
      { no: 2, item: { zh: '车队维护', en: 'Fleet maintenance', ar: 'صيانة أسطول' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 620000, poUnit: 620000, benchUnit: 610000 },
      { no: 3, item: { zh: '装卸与清关', en: 'Handling & customs', ar: 'مناولة وتخليص جمركي' }, qty: 1, poQty: 1, grnQty: 1, invUnit: 400000, poUnit: 400000, benchUnit: 395000 }
    ],
    vat: { subtotal: 3180000, declared: 472800, expected: 477000, rate: 15 },
    taxId: { value: '3005566778800002', valid: false }
  }
};

/* ---------- Manual-baseline vs Agent efficiency (trust / value framing) ----------
   Referenced by EfficiencyStat in traces and the Dashboard HITL summary. */
export const EFFICIENCY = {
  A1: { manualMin: 12, agentSec: 6, manualCost: 16, manualErr: 4.0, agentErr: 0.4 },
  A2: { manualMin: 35, agentSec: 9, manualCost: 48, manualErr: 6.0, agentErr: 0.7 },
  A3: { manualMin: 25, agentSec: 7, manualCost: 34, manualErr: 9.0, agentErr: 1.4 },
  A4: { manualMin: 18, agentSec: 5, manualCost: 24, manualErr: 3.5, agentErr: 0.5 },
  A5: { manualMin: 40, agentSec: 8, manualCost: 55, manualErr: 8.0, agentErr: 1.1 },
  A6: { manualMin: 30, agentSec: 4, manualCost: 41, manualErr: 5.0, agentErr: 0.6 }
};

/* Cumulative value delivered this month (Dashboard HITL summary). */
export const VALUE_SUMMARY = {
  hoursSaved: 3860,
  autoShare: 91.4,
  escalated: 1073,
  costAvoided: 1250000
};

/* ---------- SCR-11: Platform reconciliation (Makeen ↔ Tahseel) ----------
   Weekly diff report. Records derive from the RECON scenarios so the same
   invoice facts stay consistent across pages. Tahseel is authoritative. */
export const RECON_DIFF_TYPES = {
  amount: { label: '金额差异', labelEn: 'Amount diff', labelAr: 'فرق مبلغ', color: 'orange' },
  missingTahsil: { label: 'Tahseel 缺失', labelEn: 'Missing in Tahseel', labelAr: 'مفقود في Tahseel', color: 'blue' },
  missingMakken: { label: 'Makeen 缺失', labelEn: 'Missing in Makeen', labelAr: 'مفقود في Makeen', color: 'indigo' },
  status: { label: '状态差异', labelEn: 'Status diff', labelAr: 'فرق حالة', color: 'gold' }
};

export const PLATFORM_RECON = [
  {
    id: 'INV-2026-0731',
    vendor: 'Al-Rajhi 建设集团',
    vendorEn: 'Al-Rajhi Construction Group',
    vendorAr: 'مجموعة الراجحي للإنشاءات',
    orgId: 'riyadh',
    type: 'amount',
    makkenAmt: 1250000,
    tahsilAmt: 1187500,
    diff: 62500,
    high: true,
    reason: 'Tahseel 回款未含增值税，差额对应 15% 税额的一部分',
    reasonEn: 'Tahseel collection excludes VAT; gap maps to part of the 15% tax',
    reasonAr: 'تحصيل Tahseel لا يشمل الضريبة؛ الفرق جزء من ضريبة 15٪',
    action: '转税务审计员核查',
    actionEn: 'Refer to tax auditor',
    actionAr: 'إحالة إلى مدقق الضرائب'
  },
  {
    id: 'INV-2026-0727',
    vendor: 'Aramco 后勤供应',
    vendorEn: 'Aramco Logistics Supply',
    vendorAr: 'أرامكو للإمداد اللوجستي',
    orgId: 'eastern',
    type: 'amount',
    makkenAmt: 3180000,
    tahsilAmt: 3128400,
    diff: 51600,
    high: true,
    reason: 'Makeen 单价（180,000）高于 PO 基准，差异传导至回款',
    reasonEn: 'Makeen unit price (180,000) above PO baseline; variance carried into collection',
    reasonAr: 'سعر الوحدة في Makeen فوق مرجع PO؛ الفرق انتقل إلى التحصيل',
    action: '以 Tahseel 为准核验',
    actionEn: 'Verify against Tahseel',
    actionAr: 'التحقق مقابل Tahseel'
  },
  {
    id: 'INV-2026-0728',
    vendor: 'Gulf Facility Mgmt',
    vendorEn: 'Gulf Facility Mgmt',
    vendorAr: 'إدارة مرافق الخليج',
    orgId: 'riyadh',
    type: 'status',
    makkenAmt: 1250000,
    tahsilAmt: 1250000,
    diff: 1250000,
    high: true,
    reason: 'Tahseel 显示已回款，Makeen 中该发票已注销',
    reasonEn: 'Collected in Tahseel but cancelled in Makeen',
    reasonAr: 'محصّلة في Tahseel لكن ملغاة في Makeen',
    action: '在 Makeen 中补录',
    actionEn: 'Reinstate in Makeen',
    actionAr: 'إعادة التسجيل في Makeen'
  },
  {
    id: 'INV-2026-0726',
    vendor: 'Riyadh 市政工程',
    vendorEn: 'Riyadh Municipal Works',
    vendorAr: 'أعمال بلدية الرياض',
    orgId: 'riyadh',
    type: 'missingTahsil',
    makkenAmt: 742000,
    tahsilAmt: null,
    diff: 742000,
    high: true,
    reason: 'Makeen 存在计费记录，Tahseel 无对应回款记录',
    reasonEn: 'Billing record exists in Makeen; no matching Tahseel collection record',
    reasonAr: 'سجل فوترة في Makeen بلا مقابل في Tahseel',
    action: '在 Tahseel 中核验',
    actionEn: 'Verify in Tahseel',
    actionAr: 'التحقق في Tahseel'
  },
  {
    id: 'INV-2026-0724',
    vendor: 'Bahri 海运物流',
    vendorEn: 'Bahri Maritime Logistics',
    vendorAr: 'البحري للخدمات اللوجستية البحرية',
    orgId: 'eastern',
    type: 'missingMakken',
    makkenAmt: null,
    tahsilAmt: 2260000,
    diff: 2260000,
    high: true,
    reason: 'Tahseel 已回款，Makeen 无对应计费记录',
    reasonEn: 'Collected in Tahseel; no matching Makeen billing record',
    reasonAr: 'محصّلة في Tahseel؛ لا سجل فوترة في Makeen',
    action: '在 Makeen 中补录',
    actionEn: 'Reinstate in Makeen',
    actionAr: 'إعادة التسجيل في Makeen'
  },
  {
    id: 'INV-2026-0725',
    vendor: 'STC 通信服务',
    vendorEn: 'STC Telecom Services',
    vendorAr: 'STC لخدمات الاتصالات',
    orgId: 'riyadh',
    type: 'amount',
    makkenAmt: 158900,
    tahsilAmt: 154900,
    diff: 4000,
    high: false,
    reason: '手续费计入口径不一致（Makeen 含渠道费）',
    reasonEn: 'Channel-fee accounting differs (Makeen includes the channel fee)',
    reasonAr: 'اختلاف احتساب رسوم القناة',
    action: '人工审查',
    actionEn: 'Manual review',
    actionAr: 'مراجعة يدوية'
  },
  {
    id: 'INV-2026-0730',
    vendor: 'NEOM 物流服务',
    vendorEn: 'NEOM Logistics',
    vendorAr: 'نيوم للخدمات اللوجستية',
    orgId: 'makkah',
    type: 'status',
    makkenAmt: 486000,
    tahsilAmt: 486000,
    diff: 486000,
    high: true,
    reason: 'Makeen 待审批，Tahseel 已按风险拦截拒付，状态未同步',
    reasonEn: 'Pending in Makeen but blocked/rejected in Tahseel after risk flag; status out of sync',
    reasonAr: 'قيد الانتظار في Makeen ومرفوضة في Tahseel بعد وسم المخاطر',
    action: '人工审查',
    actionEn: 'Manual review',
    actionAr: 'مراجعة يدوية'
  }
];

/* ---------- SCR-08: Audit trail (derived from the demo scenarios) ----------
   Immutable event log assembled from the same facts shown on Pipeline / Risk /
   Approvals, so the audit view never contradicts the processing views.
   Uses {zh,en,ar} objects rendered via L() like other component-level data. */
export const AUDIT_STAGES = {
  ingest: { label: { zh: '摄取', en: 'Ingest', ar: 'استيعاب' }, color: 'blue' },
  ocr: { label: { zh: 'OCR 提取', en: 'OCR', ar: 'OCR' }, color: 'blue' },
  dedup: { label: { zh: '去重', en: 'Dedup', ar: 'إزالة التكرار' }, color: 'blue' },
  validate: { label: { zh: '核验', en: 'Validate', ar: 'التحقق' }, color: 'teal' },
  anomaly: { label: { zh: '异常检测', en: 'Anomaly', ar: 'الشذوذ' }, color: 'orange' },
  route: { label: { zh: '审批路由', en: 'Routing', ar: 'التوجيه' }, color: 'purple' },
  approval: { label: { zh: '人工审批', en: 'Approval', ar: 'الموافقة' }, color: 'green' },
  pending: { label: { zh: '暂停待处置', en: 'Pending', ar: 'معلّقة' }, color: 'gold' }
};

export const AUDIT_TRAIL = [
  { time: '2026-07-26 09:14', inv: 'INV-2026-0731', stage: 'ingest', actor: { zh: 'A1 · 摄取智能体', en: 'A1 · Ingestion Agent', ar: 'A1 · وكيل الاستيعاب' }, action: { zh: '从 Tahseel 拉取 PDF，分配唯一标识', en: 'Pulled PDF from Tahseel, assigned unique ID', ar: 'سحب PDF من Tahseel وتعيين معرف' }, conf: 97 },
  { time: '2026-07-26 09:15', inv: 'INV-2026-0731', stage: 'ocr', actor: { zh: 'A1 · 摄取智能体', en: 'A1 · Ingestion Agent', ar: 'A1 · وكيل الاستيعاب' }, action: { zh: 'OCR 提取 10 字段，日期/金额标准化', en: 'OCR extracted 10 fields; date/amount standardized', ar: 'استخراج 10 حقول وتوحيد التاريخ والمبلغ' }, conf: 99 },
  { time: '2026-07-26 09:16', inv: 'INV-2026-0731', stage: 'dedup', actor: { zh: 'A1 · 摄取智能体', en: 'A1 · Ingestion Agent', ar: 'A1 · وكيل الاستيعاب' }, action: { zh: '发票号+主体+金额+日期四元组比对通过', en: 'Tuple match (no/ entity/ amount/ date) passed', ar: 'المطابقة الرباعية نجحت' }, conf: 95 },
  { time: '2026-07-26 09:18', inv: 'INV-2026-0731', stage: 'validate', actor: { zh: 'A2 · 核验智能体', en: 'A2 · Validation Agent', ar: 'A2 · وكيل التحقق' }, action: { zh: '三单匹配通过，ZATCA VAT 复算一致', en: '3-way match passed; ZATCA VAT recompute consistent', ar: 'المطابقة الثلاثية ناجحة والضريبة متسقة' }, conf: 96 },
  { time: '2026-07-26 09:19', inv: 'INV-2026-0731', stage: 'anomaly', actor: { zh: 'A3 · 异常智能体', en: 'A3 · Anomaly Agent', ar: 'A3 · وكيل الشذوذ' }, action: { zh: '风险评分 12（低），放行', en: 'Risk score 12 (low); released', ar: 'درجة 12 (منخفضة)؛ سماح' }, conf: 92 },
  { time: '2026-07-26 09:20', inv: 'INV-2026-0731', stage: 'route', actor: { zh: 'A4 · 路由智能体', en: 'A4 · Routing Agent', ar: 'A4 · وكيل التوجيه' }, action: { zh: '金额 1.25M → 3 级审批链，SLA 8h', en: '1.25M → 3-level chain, SLA 8h', ar: '1.25M → سلسلة 3 مستويات، SLA 8 ساعات' }, conf: 95 },
  { time: '2026-07-27 10:05', inv: 'INV-2026-0731', stage: 'approval', actor: { zh: '李芳军（人工）', en: 'Li Fangjun (human)', ar: 'لي فانغجون (بشري)' }, action: { zh: '人工确认批准，进入付款队列', en: 'Human confirmed approval; queued for payment', ar: 'تأكيد بشري بالموافقة' }, hitl: true },
  { time: '2026-07-26 09:22', inv: 'INV-2026-0730', stage: 'ingest', actor: { zh: 'A1 · 摄取智能体', en: 'A1 · Ingestion Agent', ar: 'A1 · وكيل الاستيعاب' }, action: { zh: '从 Makeen 拉取 PDF，分配唯一标识', en: 'Pulled PDF from Makeen, assigned unique ID', ar: 'سحب PDF من Makeen وتعيين معرف' }, conf: 98 },
  { time: '2026-07-26 09:24', inv: 'INV-2026-0730', stage: 'validate', actor: { zh: 'A2 · 核验智能体', en: 'A2 · Validation Agent', ar: 'A2 · وكيل التحقق' }, action: { zh: '三单一致（价格偏差移交 A3）', en: '3-way consistent (price deviation passed to A3)', ar: 'مطابقة متسقة (انحراف السعر إلى A3)' }, conf: 90 },
  { time: '2026-07-26 09:25', inv: 'INV-2026-0730', stage: 'anomaly', actor: { zh: 'A3 · 异常智能体', en: 'A3 · Anomaly Agent', ar: 'A3 · وكيل الشذوذ' }, action: { zh: '风险 82：价格高于基准 +38%、供应商首次交易', en: 'Risk 82: price +38% over benchmark, first-time vendor', ar: 'درجة 82: السعر +38٪ ومورد جديد' }, conf: 71 },
  { time: '2026-07-26 09:25', inv: 'INV-2026-0730', stage: 'pending', actor: { zh: 'A0 · 编排层', en: 'A0 · Orchestrator', ar: 'A0 · المنسق' }, action: { zh: 'HITL 断点：置信度 71% < 75%，暂停付款转审计师', en: 'HITL breakpoint: confidence 71% < 75%; payment paused, referred to auditor', ar: 'توقف HITL: الثقة 71٪ < 75٪؛ إيقاف وإحالة' }, hitl: true },
  { time: '2026-07-26 09:30', inv: 'INV-2026-0728', stage: 'ingest', actor: { zh: 'A1 · 摄取智能体', en: 'A1 · Ingestion Agent', ar: 'A1 · وكيل الاستيعاب' }, action: { zh: '从 Tahseel 拉取 PDF，分配唯一标识', en: 'Pulled PDF from Tahseel, assigned unique ID', ar: 'سحب PDF من Tahseel وتعيين معرف' }, conf: 96 },
  { time: '2026-07-26 09:31', inv: 'INV-2026-0728', stage: 'dedup', actor: { zh: 'A1 · 摄取智能体', en: 'A1 · Ingestion Agent', ar: 'A1 · وكيل الاستيعاب' }, action: { zh: '与 INV-2026-0731 四元组一致 → 拦截疑似重复', en: 'Tuple matches INV-2026-0731 → blocked as suspected duplicate', ar: 'تطابق رباعي مع INV-2026-0731 → حظر التكرار' }, conf: 95 },
  { time: '2026-07-26 09:31', inv: 'INV-2026-0728', stage: 'pending', actor: { zh: 'A0 · 编排层', en: 'A0 · Orchestrator', ar: 'A0 · المنسق' }, action: { zh: '重复拦截，等待人工确认后归档', en: 'Duplicate blocked; awaiting human confirm to archive', ar: 'حظر التكرار؛ بانتظار التأكيد البشري' }, hitl: true },
  { time: '2026-07-26 09:40', inv: 'INV-2026-0727', stage: 'ingest', actor: { zh: 'A1 · 摄取智能体', en: 'A1 · Ingestion Agent', ar: 'A1 · وكيل الاستيعاب' }, action: { zh: '从 Makeen 拉取 PDF，分配唯一标识', en: 'Pulled PDF from Makeen, assigned unique ID', ar: 'سحب PDF من Makeen وتعيين معرف' }, conf: 97 },
  { time: '2026-07-26 09:42', inv: 'INV-2026-0727', stage: 'validate', actor: { zh: 'A2 · 核验智能体', en: 'A2 · Validation Agent', ar: 'A2 · وكيل التحقق' }, action: { zh: 'VAT 申报 ≠ ZATCA 复算，税号校验位失败，总额偏差 +2.4%', en: 'VAT declared ≠ ZATCA expected; tax-ID check-digit failed; total +2.4%', ar: 'الضريبة المعلنة ≠ المتوقعة؛ فشل الرقم الضريبي؛ +2.4٪' }, conf: 68 },
  { time: '2026-07-26 09:43', inv: 'INV-2026-0727', stage: 'route', actor: { zh: 'A4 · 路由智能体', en: 'A4 · Routing Agent', ar: 'A4 · وكيل التوجيه' }, action: { zh: '评估超时 8h → 自动升级至中心主任', en: 'Evaluation overran SLA by 8h → auto-escalated to Center Director', ar: 'تجاوز 8 ساعات → تصعيد تلقائي للمدير' }, conf: 88 },
  { time: '2026-07-26 14:30', inv: 'INV-2026-0727', stage: 'approval', actor: { zh: '中心主任（人工）', en: 'Center Director (human)', ar: 'مدير المركز (بشري)' }, action: { zh: '要求补正税号后重新提交审批', en: 'Requested tax-ID correction before resubmission', ar: 'طلب تصحيح الرقم الضريبي قبل إعادة التقديم' }, hitl: true }
];

/* ---------- SCR-10: Periodic revenue reporting (Municipal + Housing) ----------
   Figures are split from the monthly KPI universe (382M invoiced / 87.3%
   collection) so the revenue board never contradicts the Dashboard. */
export const REVENUE_SOURCES = [
  { id: 'realty', sector: 'municipal', label: '市政房地产投资', labelEn: 'Municipal real-estate investment', labelAr: 'الاستثمار العقاري البلدي', invoiced: 96400000, collected: 87400000, target: 92000000, lastYear: 79300000 },
  { id: 'penalty', sector: 'municipal', label: '处罚与违规罚款', labelEn: 'Penalties & fines', labelAr: 'الغرامات والمخالفات', invoiced: 58200000, collected: 48000000, target: 54000000, lastYear: 41200000 },
  { id: 'fees', sector: 'municipal', label: '规费与财务对价', labelEn: 'Fees & financial consideration', labelAr: 'الرسوم والمقابل المالي', invoiced: 74800000, collected: 66200000, target: 70000000, lastYear: 63800000 },
  { id: 'hostel', sector: 'municipal', label: '住宿类设施占用', labelEn: 'Accommodation-facility occupancy', labelAr: 'إشغال المرافق الإيوائية', invoiced: 12600000, collected: 6900000, target: 11800000, lastYear: 8100000 },
  { id: 'tobacco', sector: 'municipal', label: '烟草制品申报费', labelEn: 'Tobacco declaration fees', labelAr: 'رسوم إقرار التبغ', invoiced: 8400000, collected: 4100000, target: 7900000, lastYear: 5200000 },
  { id: 'whiteLand', sector: 'housing', label: '白地费（空置土地）', labelEn: 'White-land fee (vacant land)', labelAr: 'رسوم الأراضي البيضاء', invoiced: 98600000, collected: 92000000, target: 92000000, lastYear: 81400000 },
  { id: 'housingSales', sector: 'housing', label: '住宅销售收入', labelEn: 'Residential sales revenue', labelAr: 'إيرادات البيع السكني', invoiced: 28900000, collected: 25100000, target: 26500000, lastYear: 22300000 },
  { id: 'other', sector: 'municipal', label: '其他收入', labelEn: 'Other revenues', labelAr: 'إيرادات أخرى', invoiced: 4100000, collected: 3600000, target: 3800000, lastYear: 3100000 }
];

export const REVENUE_SECTORS = {
  municipal: { label: '市政板块', labelEn: 'Municipal', labelAr: 'القطاع البلدي' },
  housing: { label: '住房板块', labelEn: 'Housing', labelAr: 'قطاع الإسكان' }
};

/* Per-Amanah rollup; org names/labels join from ORGS by orgId. */
export const REVENUE_AMANAH = [
  { orgId: 'riyadh', collected: 118600000, target: 126000000, coverage: 1.92 },
  { orgId: 'makkah', collected: 72400000, target: 78000000, coverage: 1.54 },
  { orgId: 'eastern', collected: 58900000, target: 61000000, coverage: 1.71 },
  { orgId: 'gen-office', collected: 12600000, target: 13200000, coverage: null }
];

/* ---------- SCR-12: Violation follow-up (Efaa ↔ Mumtathil) ---------- */
export const EXEC_STATUS = {
  notReported: { label: '未上报', labelEn: 'Not reported', labelAr: 'لم يُرفع', color: 'blue' },
  referable: { label: '可转办', labelEn: 'Referable', labelAr: 'قابل للإحالة', color: 'gold' },
  unenforceable: { label: '无法执行', labelEn: 'Unenforceable', labelAr: 'غير قابل للتنفيذ', color: 'red' },
  enforced: { label: '已对其执行', labelEn: 'Enforced', labelAr: 'تم التنفيذ', color: 'green' }
};

export const APPEAL_STATUS = {
  none: { label: '无', labelEn: 'None', labelAr: 'لا يوجد', color: '' },
  rejected: { label: '已驳回', labelEn: 'Rejected', labelAr: 'مرفوض', color: 'green' },
  accepted: { label: '已受理', labelEn: 'Accepted', labelAr: 'مقبول', color: 'gold' },
  pending: { label: '等待委员会审查', labelEn: 'Pending committee review', labelAr: 'بانتظار مراجعة اللجنة', color: 'orange' }
};

export const VIOLATION_LAWS = {
  road: { label: '道路与街道违规', labelEn: 'Road & street violation', labelAr: 'مخالفة الطرق' },
  building: { label: '一般建筑违规', labelEn: 'Building violation', labelAr: 'مخالفة بناء' },
  municipal: { label: '市政违规', labelEn: 'Municipal violation', labelAr: 'مخالفة بلدية' }
};

export const VIOLATIONS = [
  {
    id: 'VIO-2026-1042', nid: '1042•••••55', orgId: 'riyadh', lawKey: 'road',
    amount: 148000, execKey: 'referable', appealKey: 'accepted', score: 38,
    updated: '2026-08-24', high: true,
    note: '申诉获受理并调低金额（148K→96K），回款评分 52→38',
    noteEn: 'Appeal accepted with amount reduced (148K→96K); score 52→38',
    noteAr: 'قُبل الاستئناف وخُفض المبلغ؛ الدرجة 52→38'
  },
  {
    id: 'VIO-2026-1038', nid: '2091•••••10', orgId: 'riyadh', lawKey: 'building',
    amount: 86500, execKey: 'notReported', appealKey: 'pending', score: 44,
    updated: '2026-08-24', high: false,
    note: '等待委员会审查：执行流程自动暂停直至作出决定',
    noteEn: 'Pending committee review: enforcement auto-paused until decision',
    noteAr: 'بانتظار اللجنة: التنفيذ موقوف تلقائياً حتى القرار'
  },
  {
    id: 'VIO-2026-1031', nid: '7310•••••82', orgId: 'makkah', lawKey: 'municipal',
    amount: 214000, execKey: 'enforced', appealKey: 'rejected', score: 86,
    updated: '2026-08-23', high: true,
    note: '申诉已驳回，已对其执行，回款评分升至 86',
    noteEn: 'Appeal rejected; enforced; score raised to 86',
    noteAr: 'رُفض الاستئناف وتم التنفيذ؛ الدرجة 86'
  },
  {
    id: 'VIO-2026-1027', nid: '8842•••••03', orgId: 'eastern', lawKey: 'road',
    amount: 42300, execKey: 'unenforceable', appealKey: 'none', score: 12,
    updated: '2026-08-23', high: false,
    note: '被执行方无的可执行资产，转入坏账评估',
    noteEn: 'No enforceable assets; moved to bad-debt assessment',
    noteAr: 'لا أصول قابلة للتنفيذ؛ تحويل لتقييم الديون المعدومة'
  },
  {
    id: 'VIO-2026-1019', nid: '5520•••••41', orgId: 'makkah', lawKey: 'building',
    amount: 67800, execKey: 'referable', appealKey: 'none', score: 63,
    updated: '2026-08-22', high: false,
    note: '身份标识在 Efaa 与 Mumtathil 之间冲突，标记需人工审查',
    noteEn: 'Identity conflicts between Efaa and Mumtathil; flagged for manual review',
    noteAr: 'تعارض الهوية بين المنصتين؛ موسوم لمراجعة يدوية'
  },
  {
    id: 'VIO-2026-1011', nid: '3391•••••27', orgId: 'eastern', lawKey: 'municipal',
    amount: 158500, execKey: 'enforced', appealKey: 'rejected', score: 91,
    updated: '2026-08-21', high: true,
    note: '已执行完毕并回款，评分 91（高）',
    noteEn: 'Enforced and collected; score 91 (high)',
    noteAr: 'تم التنفيذ والتحصيل؛ الدرجة 91'
  },
  {
    id: 'VIO-2026-1005', nid: '6614•••••99', orgId: 'riyadh', lawKey: 'municipal',
    amount: 28900, execKey: 'notReported', appealKey: 'none', score: 57,
    updated: '2026-08-21', high: false,
    note: '新批次接入，待匹配 Tahseel 缴款号',
    noteEn: 'New batch ingested; awaiting Tahseel SADAD match',
    noteAr: 'دفعة جديدة؛ بانتظار مطابقة رقم Sadad'
  }
];

/* ---------- Utility ---------- */
export function fmtMoney(n) {
  return n.toLocaleString('en-US');
}
