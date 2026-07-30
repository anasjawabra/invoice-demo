/* ==========================================================================
   智能账单管理平台 · 演示数据 (Mock Data)
   基于《智能账单管理 BRD v1.0》与 HiAgent 多 Agent 技术方案
   多语言字段：zh 为默认，En/Ar 为英文/阿拉伯文变体。专有名词保持不译。
   ========================================================================== */

window.DEMO = (function () {
  'use strict';

  /* ---------- 演示账号 ---------- */
  const CREDENTIALS = [
    { user: 'demo', pass: 'demo123', name: '李芳军', nameEn: 'Li Fangjun', nameAr: 'لي فانغجون', role: '财务共享中心 · 主管', roleEn: 'Shared Service Center · Manager', roleAr: 'مركز الخدمات المشتركة · مدير', avatar: 'LF' },
    { user: 'auditor', pass: 'demo123', name: 'Ahmad Al-Saud', nameEn: 'Ahmad Al-Saud', nameAr: 'أحمد آل سعود', role: '审计师 · Auditor', roleEn: 'Auditor', roleAr: 'مدقق', avatar: 'AS' },
    { user: 'admin', pass: 'admin', name: '系统管理员', nameEn: 'System Admin', nameAr: 'مدير النظام', role: '平台管理员', roleEn: 'Platform Admin', roleAr: 'مدير المنصة', avatar: 'AD' }
  ];

  /* ---------- 机构上下文（登录后数据按机构隔离）---------- */
  const ORGS = [
    { id: 'mof-hq',   tier: 'central', name: '财政部 · 本部（合并视图）',   nameEn: 'Ministry of Finance · HQ (Consolidated)', nameAr: 'وزارة المالية · المقر (موحّد)',            scale: 1.00, code: 'MOF-HQ' },
    { id: 'gen-office', tier: 'central', name: '部长办公厅',                 nameEn: "Minister's General Office",                nameAr: 'المكتب العام للوزير',                     scale: 0.16, code: 'GEN-OFF' },
    { id: 'riyadh',   tier: 'local',   name: '利雅得市政厅',               nameEn: 'Riyadh Municipality',                       nameAr: 'أمانة منطقة الرياض',                      scale: 0.42, code: 'RUH-MUN' },
    { id: 'makkah',   tier: 'local',   name: '麦加省财政厅',               nameEn: 'Makkah Regional Finance',                   nameAr: 'المالية بمنطقة مكة المكرمة',              scale: 0.28, code: 'MAK-FIN' },
    { id: 'eastern',  tier: 'local',   name: '东部省共享服务中心',         nameEn: 'Eastern Province Shared Service Center',    nameAr: 'مركز الخدمات المشتركة بالمنطقة الشرقية',  scale: 0.19, code: 'EP-SSC' }
  ];

  /* ---------- 主动提醒（前置洞察，UC-05/UC-06，AI 在用户操作前预警）---------- */
  const PROACTIVE = [
    { icon: 'clock', color: 'orange',
      title: 'ZATCA 增值税申报临近', titleEn: 'ZATCA VAT filing due soon', titleAr: 'اقتراب موعد إقرار ضريبة القيمة المضافة',
      desc: '6 月税期增值税申报将于 3 天后（8 月 1 日）截止，尚有 82 张进项发票待归集。', descEn: 'The June VAT return is due in 3 days (Aug 1); 82 input invoices are still pending consolidation.', descAr: 'إقرار ضريبة القيمة المضافة لشهر يونيو مستحق خلال 3 أيام (1 أغسطس)؛ 82 فاتورة مدخلات بانتظار التجميع.',
      act: '一键归集进项', actEn: 'Consolidate inputs', actAr: 'تجميع المدخلات' },
    { icon: 'coins', color: 'blue',
      title: '5 张账单 48 小时内到期付款', titleEn: '5 invoices due for payment within 48h', titleAr: '5 فواتير مستحقة الدفع خلال 48 ساعة',
      desc: '合计 4.62M SAR 的 5 张已批账单将在 48 小时内到期，及时付款可享 2% 早付折扣。', descEn: '5 approved invoices totaling 4.62M SAR fall due within 48h; paying on time captures a 2% early-payment discount.', descAr: '5 فواتير معتمدة بإجمالي 4.62 مليون ر.س تستحق خلال 48 ساعة؛ السداد في الوقت المحدد يوفر خصم دفع مبكر 2٪.',
      act: '安排付款', actEn: 'Schedule payment', actAr: 'جدولة الدفع' },
    { icon: 'warn', color: 'red',
      title: '高延迟风险账款需介入', titleEn: 'High delay-risk receivable needs action', titleAr: 'ذمة مدينة عالية مخاطر التأخير',
      desc: 'Coastal 物流账款逾期 61 天，AI 预测回收概率仅 21%，建议催收经理立即介入。', descEn: 'Coastal Logistics is 61 days overdue; AI predicts only 21% recovery probability — collection manager should intervene now.', descAr: 'ساحلية للخدمات اللوجستية متأخرة 61 يوماً؛ يتوقع الذكاء الاصطناعي احتمال تحصيل 21٪ فقط — يوصى بتدخل مدير التحصيل فوراً.',
      act: '发起催收', actEn: 'Start collection', actAr: 'بدء التحصيل' },
    { icon: 'file', color: 'teal',
      title: '框架合同即将到期', titleEn: 'Framework contract nearing expiry', titleAr: 'اقتراب انتهاء العقد الإطاري',
      desc: 'PO-88231 框架合同 15 天后到期，AI 建议提前准备续接账单批次与新一轮预算冻结。', descEn: 'Framework contract PO-88231 expires in 15 days; AI recommends preparing the continuation invoice batch and a new budget hold in advance.', descAr: 'ينتهي العقد الإطاري PO-88231 خلال 15 يوماً؛ يوصي الذكاء الاصطناعي بإعداد دفعة الفواتير التكميلية وحجز ميزانية جديد مسبقاً.',
      act: '准备续接', actEn: 'Prepare renewal', actAr: 'تحضير التجديد' }
  ];

  /* ---------- 6 大核心 KPI（管理层看板 UC-06）---------- */
  const KPIS = [
    { id: 'processed', label: '本月已处理账单', labelEn: 'Invoices Processed', labelAr: 'الفواتير المعالجة', value: 12480, unit: '张', unitEn: '', unitAr: '', delta: +18.2, icon: 'file', color: 'teal' },
    { id: 'automation', label: '字段自动录入率', labelEn: 'Auto Entry Rate', labelAr: 'معدل الأتمتة', value: 96.4, unit: '%', unitEn: '%', unitAr: '%', delta: +1.7, icon: 'bolt', color: 'indigo', target: 95 },
    { id: 'amount', label: '本月处理金额', labelEn: 'Amount Processed', labelAr: 'المبلغ المعالج', value: 3.82, unit: '亿 SAR', unitEn: 'B SAR', unitAr: 'مليار ر.س', delta: +12.5, icon: 'coins', color: 'gold' },
    { id: 'recovery', label: '账款回收率', labelEn: 'Collection Rate', labelAr: 'معدل التحصيل', value: 87.3, unit: '%', unitEn: '%', unitAr: '%', delta: +3.1, icon: 'trend', color: 'green', target: 85 },
    { id: 'anomaly', label: '异常/欺诈拦截', labelEn: 'Anomalies Blocked', labelAr: 'الحالات الشاذة', value: 214, unit: '起', unitEn: '', unitAr: '', delta: +9.0, icon: 'shield', color: 'red' },
    { id: 'cycle', label: '平均处理周期', labelEn: 'Avg Cycle Time', labelAr: 'دورة المعالجة', value: 0.8, unit: '天', unitEn: 'd', unitAr: 'يوم', delta: -62.4, icon: 'clock', color: 'purple' }
  ];

  /* ---------- 7 个 Agent（1 总控 + 6 业务）---------- */
  const AGENTS = [
    { id: 'A0', name: '总控编排 Agent', nameEn: 'Orchestrator Agent', nameAr: 'وكيل التنسيق', en: 'Orchestrator',
      form: '多智能体编排', formEn: 'Multi-Agent Orchestration', formAr: 'تنسيق متعدد الوكلاء', color: 'gold',
      desc: '意图识别与任务路由，按流水线调度 6 个子 Agent，统一中/阿对话入口，控制 HITL 断点。',
      descEn: 'Intent recognition and task routing. Schedules 6 sub-agents via the pipeline, provides a unified ZH/AR chat entry, and controls HITL breakpoints.',
      descAr: 'التعرف على القصد وتوجيه المهام. يقوم بجدولة 6 وكلاء فرعيين عبر خط الأنابيب، ويوفر مدخل دردشة موحداً بالصينية/العربية، ويتحكم في نقاط توقف HITL.',
      uc: '贯穿全流程 / UC-07', model: '豆包多语言模型 · 温度 0.2', modelEn: 'Doubao Multilingual · Temp 0.2', modelAr: 'Doubao متعدد اللغات · حرارة 0.2', status: 'online', calls: 48210, acc: 100 },
    { id: 'A1', name: '摄取 Agent', nameEn: 'Ingestion Agent', nameAr: 'وكيل الاستيعاب', en: 'Ingestion',
      form: '工作流应用', formEn: 'Workflow App', formAr: 'تطبيق سير العمل', color: 'teal',
      desc: '从四平台/邮件/ERP 抓取账单，OCR 提取金额/日期/PO/税号，格式标准化与重复检测。',
      descEn: 'Fetches invoices from the 4 platforms/email/ERP. OCR extraction of amount/date/PO/VAT, format standardization, and duplicate detection.',
      descAr: 'يجلب الفواتير من المنصات الأربع/البريد/ERP. استخراج OCR للمبلغ/التاريخ/PO/الرقم الضريبي، توحيد التنسيق، وكشف التكرار.',
      uc: 'UC-01 / FR-001~004', model: '豆包视觉+文本 · 温度 0.1', modelEn: 'Doubao Vision+Text · Temp 0.1', modelAr: 'Doubao رؤية+نص · حرارة 0.1', status: 'online', calls: 12480, acc: 96.4 },
    { id: 'A2', name: '验证合规 Agent', nameEn: 'Verification Agent', nameAr: 'وكيل التحقق', en: 'Verification',
      form: '工作流应用', formEn: 'Workflow App', formAr: 'تطبيق سير العمل', color: 'indigo',
      desc: '三单匹配（账单-PO-实收），ZATCA 税务校验，Makin vs Tahseel 跨平台对账。',
      descEn: '3-way matching (Invoice-PO-Receipt), ZATCA tax verification, and cross-platform reconciliation between Makin and Tahseel.',
      descAr: 'المطابقة الثلاثية (فاتورة-PO-إيصال)، التحقق الضريبي ZATCA، والتسوية عبر المنصات بين Makin وTahseel.',
      uc: 'UC-02、UC-11 / FR-005/006', model: '豆包文本模型 · 温度 0.2', modelEn: 'Doubao Text · Temp 0.2', modelAr: 'Doubao نص · حرارة 0.2', status: 'online', calls: 12210, acc: 92.8 },
    { id: 'A3', name: '异常检测 Agent', nameEn: 'Anomaly Agent', nameAr: 'وكيل كشف الشذوذ', en: 'Anomaly',
      form: '工作流 + 大模型', formEn: 'Workflow + LLM', formAr: 'سير العمل + LLM', color: 'red',
      desc: '供应商历史模式与行业价格基准比对，离群分析，输出 0-100 风险评分与欺诈警告。',
      descEn: 'Compares against vendor historical patterns and industry price benchmarks, runs outlier analysis, and outputs a 0-100 risk score with fraud warnings.',
      descAr: 'يقارن بأنماط المورد التاريخية والمعايير السعرية للقطاع، يجري تحليل القيم الشاذة، ويخرج درجة مخاطرة 0-100 مع تحذيرات الاحتيال.',
      uc: 'UC-03 / FR-008', model: '豆包文本模型 · 温度 0.3', modelEn: 'Doubao Text · Temp 0.3', modelAr: 'Doubao نص · حرارة 0.3', status: 'online', calls: 11980, acc: 88.6 },
    { id: 'A4', name: '审批路由 Agent', nameEn: 'Routing Agent', nameAr: 'وكيل التوجيه', en: 'Routing',
      form: '工作流应用', formEn: 'Workflow App', formAr: 'تطبيق سير العمل', color: 'blue',
      desc: '按授权矩阵校验审批权限，按金额/部门动态分发审批链，生成审批卡片，SLA 逾期提醒。',
      descEn: 'Validates approval authority against the authorization matrix, dynamically dispatches approval chains by amount/department, generates approval cards, and sends SLA reminders.',
      descAr: 'يتحقق من صلاحية الموافقة وفق مصفوفة التفويض، يوزع سلاسل الموافقة ديناميكياً حسب المبلغ/القسم، ينشئ بطاقات موافقة، ويرسل تنبيهات SLA.',
      uc: 'UC-04 / FR-007/009', model: '豆包文本模型 · 温度 0.1', modelEn: 'Doubao Text · Temp 0.1', modelAr: 'Doubao نص · حرارة 0.1', status: 'online', calls: 9640, acc: 100 },
    { id: 'A5', name: '催收预测 Agent', nameEn: 'Forecasting Agent', nameAr: 'وكيل التنبؤ', en: 'Forecasting',
      form: '工作流 + 大模型', formEn: 'Workflow + LLM', formAr: 'سير العمل + LLM', color: 'purple',
      desc: '基于历史收缴率/诉讼状态/宏观指标预测回收概率，延迟风险预警，Mumtathil 罚款同步。',
      descEn: 'Predicts recovery probability from historical collection rates, litigation status, and macro indicators; warns of delay risk and syncs Mumtathil penalties.',
      descAr: 'يتنبأ باحتمال التحصيل من معدلات التحصيل التاريخية وحالة التقاضي والمؤشرات الكلية؛ ينبه لمخاطر التأخير ويزامن عقوبات Mumtathil.',
      uc: 'UC-05、UC-12 / FR-010', model: '豆包文本模型 · 温度 0.3', modelEn: 'Doubao Text · Temp 0.3', modelAr: 'Doubao نص · حرارة 0.3', status: 'online', calls: 7320, acc: 86.1 },
    { id: 'A6', name: '分析问答 Agent', nameEn: 'Analytics Agent', nameAr: 'وكيل التحليلات', en: 'Analytics',
      form: '对话型 + 工作流', formEn: 'Conversational + Workflow', formAr: 'حواري + سير العمل', color: 'green',
      desc: '6 个核心 KPI 看板，阿拉伯语/中文自然语言问答(NL2SQL)，定期收入报告，待定账单修正建议。',
      descEn: '6 core KPI dashboards, Arabic/Chinese natural-language Q&A (NL2SQL), periodic revenue reports, and correction suggestions for pending invoices.',
      descAr: '6 لوحات مؤشرات أداء أساسية، أسئلة وأجوبة باللغة الطبيعية بالعربية/الصينية (NL2SQL)، تقارير إيرادات دورية، واقتراحات تصحيح للفواتير المعلقة.',
      uc: 'UC-06/07/08/10', model: '豆包多语言模型 · 温度 0.2-0.5', modelEn: 'Doubao Multilingual · Temp 0.2-0.5', modelAr: 'Doubao متعدد اللغات · حرارة 0.2-0.5', status: 'online', calls: 15870, acc: 94.2 }
  ];

  /* ---------- 账单流水线阶段（对应 Agent） ---------- */
  const PIPELINE = [
    { agent: 'A1', name: '摄取', nameEn: 'Ingestion', nameAr: 'الاستيعاب', en: 'Ingestion', hint: 'OCR 提取 · 字段映射 · 重复检测', hintEn: 'OCR Extraction · Field Mapping · Dedup', hintAr: 'استخراج OCR · تعيين الحقول · كشف التكرار' },
    { agent: 'A2', name: '验证合规', nameEn: 'Verification', nameAr: 'التحقق', en: 'Verification', hint: '三单匹配 · ZATCA 校验 · 跨平台对账', hintEn: '3-Way Match · ZATCA Check · Reconciliation', hintAr: 'مطابقة ثلاثية · فحص ZATCA · تسوية' },
    { agent: 'A3', name: '异常检测', nameEn: 'Anomaly', nameAr: 'كشف الشذوذ', en: 'Anomaly', hint: '价格基准比对 · 风险评分 0-100', hintEn: 'Benchmark Comparison · Risk Score 0-100', hintAr: 'مقارنة المعايير · درجة مخاطرة 0-100' },
    { agent: 'A4', name: '审批路由', nameEn: 'Routing', nameAr: 'التوجيه', en: 'Routing', hint: '授权矩阵 · 审批链分发 (HITL)', hintEn: 'Authorization Matrix · Chain Dispatch (HITL)', hintAr: 'مصفوفة التفويض · توزيع السلسلة (HITL)' },
    { agent: 'A5', name: '催收预测', nameEn: 'Forecasting', nameAr: 'التنبؤ', en: 'Forecasting', hint: '回收概率 · 延迟风险预警', hintEn: 'Recovery Probability · Delay Warnings', hintAr: 'احتمال التحصيل · تنبيهات التأخير' },
    { agent: 'A6', name: '分析归档', nameEn: 'Analytics', nameAr: 'التحليلات', en: 'Analytics', hint: 'KPI 汇总 · 审计留痕', hintEn: 'KPI Aggregation · Audit Trail', hintAr: 'تجميع المؤشرات · سجل التدقيق' }
  ];

  /* ---------- 数据来源平台（平台名为专有名词，不译） ---------- */
  const SOURCES = [
    { id: 'tahseel', name: 'Tahseel', desc: '催收平台', descEn: 'Collection Platform', descAr: 'منصة التحصيل', count: 4820, color: 'teal' },
    { id: 'makin', name: 'Makin', desc: '合同平台', descEn: 'Contract Platform', descAr: 'منصة العقود', count: 3610, color: 'indigo' },
    { id: 'efa', name: 'Efa', desc: '支付平台', descEn: 'Payment Platform', descAr: 'منصة الدفع', count: 2240, color: 'green' },
    { id: 'sanad', name: 'Sanad', desc: '凭证平台', descEn: 'Voucher Platform', descAr: 'منصة القسائم', count: 1810, color: 'gold' }
  ];

  /* ---------- 待处理账单列表（供应商名为专有名词，不译） ---------- */
  const INVOICES = [
    { id: 'INV-2026-0731', entity: 'Al-Rajhi 建设集团', entityEn: 'Al-Rajhi Construction Group', entityAr: 'مجموعة الراجحي للإنشاءات', amount: 1250000, currency: 'SAR', source: 'Tahseel', po: 'PO-88231', vat: '3001234567800003', date: '2026-07-26', status: 'pending', risk: 12, confidence: 0.97, tag: 'normal' },
    { id: 'INV-2026-0730', entity: 'NEOM 物流服务', entityEn: 'NEOM Logistics', entityAr: 'نيوم للخدمات اللوجستية', amount: 486000, currency: 'SAR', source: 'Makin', po: 'PO-88192', vat: '3009988776600001', date: '2026-07-26', status: 'anomaly', risk: 82, confidence: 0.71, tag: 'fraud' },
    { id: 'INV-2026-0729', entity: 'Saudi Tech Solutions', entityEn: 'Saudi Tech Solutions', entityAr: 'الحلول التقنية السعودية', amount: 92500, currency: 'SAR', source: 'Efa', po: 'PO-88155', vat: '3002233445500007', date: '2026-07-25', status: 'approved', risk: 8, confidence: 0.99, tag: 'normal' },
    { id: 'INV-2026-0728', entity: 'Gulf Facility Mgmt', entityEn: 'Gulf Facility Mgmt', entityAr: 'إدارة مرافق الخليج', amount: 1250000, currency: 'SAR', source: 'Tahseel', po: 'PO-88231', vat: '3001234567800003', date: '2026-07-25', status: 'duplicate', risk: 0, confidence: 0.95, tag: 'dup' },
    { id: 'INV-2026-0727', entity: 'Aramco 后勤供应', entityEn: 'Aramco Logistics Supply', entityAr: 'أرامكو للإمداد اللوجستي', amount: 3180000, currency: 'SAR', source: 'Makin', po: 'PO-87990', vat: '3005566778800002', date: '2026-07-24', status: 'review', risk: 46, confidence: 0.68, tag: 'taxfail' },
    { id: 'INV-2026-0726', entity: 'Riyadh 市政工程', entityEn: 'Riyadh Municipal Works', entityAr: 'أعمال بلدية الرياض', amount: 742000, currency: 'SAR', source: 'Sanad', po: 'PO-87921', vat: '3007788990000004', date: '2026-07-24', status: 'approved', risk: 15, confidence: 0.96, tag: 'normal' },
    { id: 'INV-2026-0725', entity: 'STC 通信服务', entityEn: 'STC Telecom Services', entityAr: 'STC لخدمات الاتصالات', amount: 158900, currency: 'SAR', source: 'Efa', po: 'PO-87880', vat: '3003344556600009', date: '2026-07-23', status: 'approved', risk: 5, confidence: 0.98, tag: 'normal' },
    { id: 'INV-2026-0724', entity: 'Bahri 海运物流', entityEn: 'Bahri Maritime Logistics', entityAr: 'البحري للخدمات اللوجستية البحرية', amount: 2260000, currency: 'SAR', source: 'Makin', po: 'PO-87812', vat: '3006677889900005', date: '2026-07-23', status: 'pending', risk: 33, confidence: 0.9, tag: 'normal' }
  ];

  /* ---------- 状态字典 ---------- */
  const STATUS = {
    pending:   { label: '待处理', labelEn: 'Pending', labelAr: 'قيد الانتظار', color: 'blue' },
    approved:  { label: '已通过', labelEn: 'Approved', labelAr: 'تمت الموافقة', color: 'green' },
    anomaly:   { label: '欺诈警告', labelEn: 'Fraud Warning', labelAr: 'تحذير احتيال', color: 'red' },
    duplicate: { label: '重复拦截', labelEn: 'Duplicate Blocked', labelAr: 'منع التكرار', color: 'gold' },
    review:    { label: '待人工复核', labelEn: 'Review Needed', labelAr: 'مراجعة بشرية', color: 'orange' },
    rejected:  { label: '已驳回', labelEn: 'Rejected', labelAr: 'مرفوض', color: 'grey' }
  };

  /* ---------- 审批待办（HITL）---------- */
  const APPROVALS = [
    { id: 'INV-2026-0727', entity: 'Aramco 后勤供应', entityEn: 'Aramco Logistics Supply', entityAr: 'أرامكو للإمداد اللوجستي', amount: 3180000, currency: 'SAR',
      chain: '账单专员 → 财务经理 → 预算与财务 → 采购复核 → 中心主任 → CFO', chainEn: 'Invoice Clerk → Finance Manager → Budget & Finance → Procurement Review → Center Director → CFO', chainAr: 'موظف الفواتير ← المدير المالي ← الميزانية والمالية ← مراجعة المشتريات ← مدير المركز ← الرئيس المالي',
      assignee: '李芳军', assigneeEn: 'Li Fangjun', assigneeAr: 'لي فانغجون',
      priority: '高', priorityEn: 'High', priorityAr: 'عالية', priorityKey: 'high', sla: '4 小时', slaEn: '4 hours', slaAr: '4 ساعات',
      reason: '金额 > 300 万 SAR，触发六级审批链；且评估已超时 8h，自动升级至中心主任', reasonEn: 'Amount > 3M SAR triggers the 6-level chain; evaluation also overran SLA by 8h, auto-escalated to Center Director', reasonAr: 'المبلغ > 3 مليون ر.س يطلق سلسلة من 6 مستويات؛ كما تجاوز التقييم SLA بـ 8 ساعات، وتم التصعيد تلقائياً لمدير المركز',
      match: '部分匹配', matchEn: 'Partial Match', matchAr: 'تطابق جزئي', risk: 46 },
    { id: 'INV-2026-0724', entity: 'Bahri 海运物流', entityEn: 'Bahri Maritime Logistics', entityAr: 'البحري للخدمات اللوجستية البحرية', amount: 2260000, currency: 'SAR',
      chain: '账单专员 → 财务经理 → 预算与财务 → 中心主任', chainEn: 'Invoice Clerk → Finance Manager → Budget & Finance → Center Director', chainAr: 'موظف الفواتير ← المدير المالي ← الميزانية والمالية ← مدير المركز',
      assignee: '李芳军', assigneeEn: 'Li Fangjun', assigneeAr: 'لي فانغجون',
      priority: '中', priorityEn: 'Medium', priorityAr: 'متوسطة', priorityKey: 'mid', sla: '8 小时', slaEn: '8 hours', slaAr: '8 ساعات',
      reason: '金额 100~300 万 SAR，触发四级审批链', reasonEn: 'Amount 1-3M SAR, triggers 4-level approval chain', reasonAr: 'المبلغ 1-3 مليون ر.س، يطلق سلسلة موافقة من 4 مستويات',
      match: '完全匹配', matchEn: 'Full Match', matchAr: 'تطابق كامل', risk: 33 },
    { id: 'INV-2026-0731', entity: 'Al-Rajhi 建设集团', entityEn: 'Al-Rajhi Construction Group', entityAr: 'مجموعة الراجحي للإنشاءات', amount: 1250000, currency: 'SAR',
      chain: '账单专员 → 财务经理 → 预算与财务', chainEn: 'Invoice Clerk → Finance Manager → Budget & Finance', chainAr: 'موظف الفواتير ← المدير المالي ← الميزانية والمالية',
      assignee: '李芳军', assigneeEn: 'Li Fangjun', assigneeAr: 'لي فانغجون',
      priority: '中', priorityEn: 'Medium', priorityAr: 'متوسطة', priorityKey: 'mid', sla: '8 小时', slaEn: '8 hours', slaAr: '8 ساعات',
      reason: '金额 100~300 万 SAR，触发三级审批链', reasonEn: 'Amount 1-3M SAR, triggers 3-level approval chain', reasonAr: 'المبلغ 1-3 مليون ر.س، يطلق سلسلة موافقة من 3 مستويات',
      match: '完全匹配', matchEn: 'Full Match', matchAr: 'تطابق كامل', risk: 12 }
  ];

  /* ---------- 异常/风险雷达（UC-03）---------- */
  const RISKS = [
    { id: 'INV-2026-0730', entity: 'NEOM 物流服务', entityEn: 'NEOM Logistics', entityAr: 'نيوم للخدمات اللوجستية', score: 82, level: '高危', levelEn: 'High Risk', levelAr: 'خطر عالٍ',
      types: ['价格偏离基准 +38%', '供应商首次交易', '金额整数异常'], typesEn: ['Price deviation +38%', 'First-time vendor', 'Round-amount anomaly'], typesAr: ['انحراف السعر +38٪', 'مورد لأول مرة', 'مبلغ دائري شاذ'],
      evidence: '同品类历史均价 352K SAR，本单 486K SAR，偏离行业基准 +38%；供应商 90 天内无历史账单。', evidenceEn: 'Category avg 352K SAR, this bill 486K SAR (+38% deviation from benchmark); no vendor invoices in the last 90 days.', evidenceAr: 'متوسط الفئة 352 ألف ر.س، هذه الفاتورة 486 ألف ر.س (+38٪ انحراف عن المعيار)؛ لا فواتير للمورد في آخر 90 يوماً.',
      action: '已推送风险雷达，转人工复核', actionEn: 'Pushed to Risk Radar, referred for manual review', actionAr: 'تم الدفع إلى رادار المخاطر، محال للمراجعة اليدوية', color: 'red' },
    { id: 'INV-2026-0709', entity: 'Desert Rose 贸易', entityEn: 'Desert Rose Trading', entityAr: 'وردة الصحراء للتجارة', score: 74, level: '高危', levelEn: 'High Risk', levelAr: 'خطر عالٍ',
      types: ['拆单规避审批', '短期高频提交'], typesEn: ['Invoice splitting', 'High-frequency submission'], typesAr: ['تقسيم الفواتير', 'تقديم متكرر'],
      evidence: '7 天内提交 5 张金额均为 99.8 万 SAR 的账单，疑似拆分规避 100 万审批阈值。', evidenceEn: 'Submitted 5 invoices of 998K SAR each within 7 days; suspected splitting to evade the 1M approval threshold.', evidenceAr: 'قدم 5 فواتير بقيمة 998 ألف ر.س لكل منها خلال 7 أيام؛ يُشتبه في التقسيم لتجاوز حد الموافقة البالغ مليون.',
      action: '标记待审计师核查', actionEn: 'Flagged for auditor review', actionAr: 'موسوم لمراجعة المدقق', color: 'red' },
    { id: 'INV-2026-0688', entity: 'Falcon 工程', entityEn: 'Falcon Engineering', entityAr: 'فالكون للهندسة', score: 58, level: '中危', levelEn: 'Mid Risk', levelAr: 'خطر متوسط',
      types: ['税号与合同主体不一致'], typesEn: ['VAT-contract entity mismatch'], typesAr: ['عدم تطابق الرقم الضريبي مع كيان العقد'],
      evidence: 'VAT 号归属主体与 Makin 合同签约主体不一致，需核实关联关系。', evidenceEn: 'The VAT owner differs from the Makin contract signatory; the relationship needs verification.', evidenceAr: 'مالك الرقم الضريبي يختلف عن موقّع عقد Makin؛ يجب التحقق من العلاقة.',
      action: '转合规复核', actionEn: 'Referred to compliance review', actionAr: 'محال لمراجعة الامتثال', color: 'orange' },
    { id: 'INV-2026-0655', entity: 'Oasis 服务', entityEn: 'Oasis Services', entityAr: 'واحة للخدمات', score: 41, level: '中危', levelEn: 'Mid Risk', levelAr: 'خطر متوسط',
      types: ['付款周期异常缩短'], typesEn: ['Abnormally shortened payment term'], typesAr: ['مدة سداد مختصرة بشكل غير عادي'],
      evidence: '合同约定账期 60 天，本单要求 7 天内付款，偏离常规。', evidenceEn: 'Contract term is 60 days, but this invoice demands payment within 7 days, deviating from the norm.', evidenceAr: 'مدة العقد 60 يوماً، لكن هذه الفاتورة تطلب السداد خلال 7 أيام، بما يخالف المعتاد.',
      action: '提示财务经理关注', actionEn: 'Flagged for finance manager attention', actionAr: 'تنبيه لانتباه المدير المالي', color: 'orange' }
  ];

  /* ---------- 催收预测（UC-05/UC-12）---------- */
  const COLLECTIONS = [
    { id: 'INV-2026-0512', entity: 'Sky Bridge 建筑', entityEn: 'Sky Bridge Construction', entityAr: 'سكاي بريدج للإنشاءات', overdue: 45, amount: 890000, prob: 34, delay: '高', delayEn: 'High', delayAr: 'عالٍ', delayKey: 'high',
      strategy: '建议启动法务催告，同步 Mumtathil 罚款状态', strategyEn: 'Recommend legal notice; sync Mumtathil penalty status', strategyAr: 'يوصى بإشعار قانوني؛ مزامنة حالة عقوبة Mumtathil',
      penalty: '已上诉', penaltyEn: 'Appealed', penaltyAr: 'تم الاستئناف', penaltyKey: 'appealed', color: 'red' },
    { id: 'INV-2026-0498', entity: 'Green Valley 农业', entityEn: 'Green Valley Agriculture', entityAr: 'الوادي الأخضر للزراعة', overdue: 28, amount: 320000, prob: 62, delay: '中', delayEn: 'Medium', delayAr: 'متوسط', delayKey: 'mid',
      strategy: '电话+邮件双渠道提醒，7 日内跟进', strategyEn: 'Phone + email reminders; follow up within 7 days', strategyAr: 'تذكير عبر الهاتف والبريد؛ المتابعة خلال 7 أيام',
      penalty: '无', penaltyEn: 'None', penaltyAr: 'لا يوجد', penaltyKey: 'none', color: 'orange' },
    { id: 'INV-2026-0476', entity: 'Metro 运输', entityEn: 'Metro Transport', entityAr: 'مترو للنقل', overdue: 12, amount: 1560000, prob: 88, delay: '低', delayEn: 'Low', delayAr: 'منخفض', delayKey: 'low',
      strategy: '标准催收邮件，回收概率高', strategyEn: 'Standard collection email; high recovery probability', strategyAr: 'بريد تحصيل قياسي؛ احتمال تحصيل مرتفع',
      penalty: '无', penaltyEn: 'None', penaltyAr: 'لا يوجد', penaltyKey: 'none', color: 'green' },
    { id: 'INV-2026-0455', entity: 'Coastal 物流', entityEn: 'Coastal Logistics', entityAr: 'الساحلية للخدمات اللوجستية', overdue: 61, amount: 2100000, prob: 21, delay: '高', delayEn: 'High', delayAr: 'عالٍ', delayKey: 'high',
      strategy: '优先级最高，建议催收经理介入并评估计提坏账', strategyEn: 'Highest priority; recommend collection manager intervention and bad-debt provisioning', strategyAr: 'أعلى أولوية؛ يوصى بتدخل مدير التحصيل وتقييم مخصص الديون المعدومة',
      penalty: '执行中', penaltyEn: 'Enforcing', penaltyAr: 'قيد التنفيذ', penaltyKey: 'enforcing', color: 'red' }
  ];

  /* ---------- 罚款状态字典 ---------- */
  const PENALTY_STATUS = {
    none: { label: '无', labelEn: 'None', labelAr: 'لا يوجد' },
    appealed: { label: '已上诉', labelEn: 'Appealed', labelAr: 'تم الاستئناف' },
    enforcing: { label: '执行中', labelEn: 'Enforcing', labelAr: 'قيد التنفيذ' }
  };

  /* ---------- 月度趋势（近 8 个月）---------- */
  const TREND = {
    labels: ['12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月'],
    labelsEn: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    labelsAr: ['ديسمبر', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو'],
    processed: [6200, 6800, 7400, 8100, 9200, 10300, 11500, 12480],
    automation: [88.2, 89.5, 91.0, 92.4, 93.8, 95.1, 95.9, 96.4],
    recovery: [78, 79.5, 81, 82.4, 83.9, 85.2, 86.4, 87.3]
  };

  /* ---------- AI 问答脚本（中/英/阿三语，UC-07）---------- */
  const QA = [
    {
      match: ['回收率', '收缴', 'recovery', 'collection rate', 'التحصيل', 'تحصيل'],
      zh: '本月账款回收率为 **87.3%**，环比上升 3.1 个百分点，已超过 85% 的目标。其中 Tahseel 平台回收率最高达 91.2%，Makin 平台 84.6%。当前有 4 笔逾期账单回收概率低于 40%，建议优先介入。',
      en: 'This month\'s collection rate is **87.3%**, up 3.1 pts month-over-month, exceeding the 85% target. Tahseel leads at 91.2%, Makin at 84.6%. There are 4 overdue invoices with recovery probability below 40% — priority intervention recommended.',
      ar: 'بلغ معدل التحصيل هذا الشهر **87.3%**، بزيادة 3.1 نقطة مئوية عن الشهر السابق، متجاوزًا الهدف البالغ 85%. أعلى معدل تحصيل على منصة Tahseel بنسبة 91.2%.',
      chart: 'recovery'
    },
    {
      match: ['本月收入', '处理金额', '金额', 'revenue', 'amount', 'processed', 'المبلغ', 'الإيرادات'],
      zh: '本月已处理账单金额合计 **3.82 亿 SAR**（12,480 张），环比增长 12.5%。其中 Makin 平台占比 41%，Tahseel 平台 32%。已通过审批金额 3.44 亿，待人工复核金额 0.31 亿。',
      en: 'Total amount processed this month is **382M SAR** (12,480 invoices), up 12.5% MoM. Makin accounts for 41%, Tahseel 32%. Approved amount is 344M, and 31M is pending manual review.',
      ar: 'إجمالي المبالغ المعالجة هذا الشهر **382 مليون ريال سعودي** (12,480 فاتورة)، بنمو 12.5%.',
      chart: 'source'
    },
    {
      match: ['异常', '欺诈', '风险', 'anomaly', 'fraud', 'risk', 'الشاذة', 'احتيال'],
      zh: '本月共拦截异常/欺诈账单 **214 起**，其中高危 63 起、中危 151 起。最典型的是 NEOM 物流服务（INV-2026-0730），价格偏离行业基准 +38% 且为首次交易，风险评分 82，已转人工复核。',
      en: 'A total of **214 anomalous/fraudulent invoices** were blocked this month — 63 high-risk and 151 mid-risk. The most notable is NEOM Logistics (INV-2026-0730): price deviated +38% from benchmark and it was a first-time deal, risk score 82, now referred for manual review.',
      ar: 'تم اعتراض **214 حالة** شاذة/احتيالية هذا الشهر، منها 63 عالية الخطورة. أبرزها الفاتورة INV-2026-0730 بدرجة خطورة 82.',
      chart: null
    },
    {
      match: ['自动', '录入', 'automation', 'auto entry', 'الأتمتة'],
      zh: '字段自动录入率为 **96.4%**，已超过 95% 的目标（FR-002）。重复检出率 98.6%，多源字段映射成功率 100%。近 8 个月自动化率从 88.2% 稳步提升至 96.4%。',
      en: 'The field auto-entry rate is **96.4%**, exceeding the 95% target (FR-002). Duplicate detection rate is 98.6% and multi-source field mapping success is 100%. Over the last 8 months, automation rose steadily from 88.2% to 96.4%.',
      ar: 'بلغ معدل الأتمتة في إدخال الحقول **96.4%**، متجاوزًا الهدف 95%.',
      chart: 'automation'
    }
  ];

  const DEFAULT_ANSWER = {
    zh: '我是「智能账单管理」总控助手，可回答本月 KPI、回收率、处理金额、异常拦截、自动化率等问题，支持中文与阿拉伯语。你可以试着问我：“本月回收率多少？”或用阿拉伯语提问 “ما هو معدل التحصيل؟”。',
    en: 'I am the INTELLIBILL orchestrator assistant. I can answer questions about monthly KPIs, collection rate, processed amount, anomaly interception, and automation rate — in English, Chinese, and Arabic. Try asking: "What is this month\'s collection rate?"',
    ar: 'أنا المساعد الرئيسي لإدارة الفواتير الذكية، يمكنني الإجابة عن مؤشرات الأداء الرئيسية بالعربية والصينية والإنجليزية. جرّب أن تسأل: "ما هو معدل التحصيل؟".'
  };

  /* ---------- 工具函数 ---------- */
  function fmtMoney(n) {
    return n.toLocaleString('en-US');
  }

  return {
    CREDENTIALS, ORGS, PROACTIVE, KPIS, AGENTS, PIPELINE, SOURCES, INVOICES, STATUS, PENALTY_STATUS,
    APPROVALS, RISKS, COLLECTIONS, TREND, QA, DEFAULT_ANSWER, fmtMoney
  };
})();
