// IntelliBill — "AI process" mock data (reasoning steps, evidence, OCR fields,
// pipeline handoffs, HITL stats, orchestration). All tri-lingual via {zh,en,ar}.
// Consumed by the shared components under src/components/ai/*.

/* ---------------------------------------------------------------- Ingest sources
   BRD: invoices scattered across Email, Government ERP, Tahseel, Makin, Efa, Sanad. */
export const INGEST_SOURCES = [
  { id: 'email', name: { zh: '邮件', en: 'Email', ar: 'البريد' }, count: 1860 },
  { id: 'erp', name: { zh: '政府 ERP', en: 'Government ERP', ar: 'ERP الحكومي' }, count: 2140 },
  { id: 'tahseel', name: { zh: 'Tahseel · 催收', en: 'Tahseel · Collection', ar: 'Tahseel · التحصيل' }, count: 4820 },
  { id: 'makin', name: { zh: 'Makin · 合同', en: 'Makin · Contracts', ar: 'Makin · العقود' }, count: 3610 },
  { id: 'efa', name: { zh: 'Efa · 支付', en: 'Efa · Payment', ar: 'Efa · الدفع' }, count: 2240 },
  { id: 'sanad', name: { zh: 'Sanad · 凭证', en: 'Sanad · Vouchers', ar: 'Sanad · القسائم' }, count: 1810 }
];

/* ---------------------------------------------------------------- OCR samples
   All 10 BRD-required fields per scenario, with per-field confidence + a
   raw→standardized normalization diff. */
const FIELD_KEYS = {
  invoiceNo: { zh: '发票号 Invoice No', en: 'Invoice No', ar: 'رقم الفاتورة' },
  idNo: { zh: '身份号 ID No', en: 'ID No', ar: 'رقم الهوية' },
  regNo: { zh: '登记号 Registration No', en: 'Registration No', ar: 'رقم التسجيل' },
  payNo: { zh: '支付号 Payment No', en: 'Payment No', ar: 'رقم الدفع' },
  amanah: { zh: '市政厅 Amanah', en: 'Amanah', ar: 'الأمانة' },
  municipality: { zh: '市政局 Municipality', en: 'Municipality', ar: 'البلدية' },
  po: { zh: '付款单号 PO', en: 'Payment Order (PO)', ar: 'أمر الدفع (PO)' },
  amount: { zh: '金额 Amount', en: 'Amount', ar: 'المبلغ' },
  date: { zh: '日期 Date', en: 'Date', ar: 'التاريخ' },
  vat: { zh: '增值税 VAT', en: 'VAT', ar: 'ضريبة القيمة المضافة' }
};

function ocrField(key, val, confidence) {
  return { key: FIELD_KEYS[key], val, confidence, low: confidence < 95 };
}

export const OCR_SAMPLES = {
  normal: {
    docTitle: 'INV-2026-0731 · Al-Rajhi Construction Group',
    fields: [
      ocrField('invoiceNo', 'INV-2026-0731', 99),
      ocrField('idNo', '1042 8830 55', 98),
      ocrField('regNo', 'CR-1010-448120', 97),
      ocrField('payNo', 'PMT-2026-55031', 98),
      ocrField('amanah', 'Riyadh Amanah', 97),
      ocrField('municipality', 'Al-Olaya Municipality', 96),
      ocrField('po', 'PO-88231', 99),
      ocrField('amount', '1,250,000.00 SAR', 99),
      ocrField('date', '2026-07-26', 99),
      ocrField('vat', '3001234567800003', 98)
    ],
    diff: [
      { label: { zh: '金额', en: 'Amount', ar: 'المبلغ' }, raw: 'SAR 1,250,000/-', std: '1250000.00 SAR' },
      { label: { zh: '日期', en: 'Date', ar: 'التاريخ' }, raw: '26/07/2026', std: '2026-07-26' },
      { label: { zh: '增值税', en: 'VAT', ar: 'الضريبة' }, raw: 'Vat No: 3001234567800003', std: '3001234567800003' }
    ]
  },
  fraud: {
    docTitle: 'INV-2026-0730 · NEOM Logistics',
    fields: [
      ocrField('invoiceNo', 'INV-2026-0730', 99),
      ocrField('idNo', '2091 7742 10', 96),
      ocrField('regNo', 'CR-7010-990015', 95),
      ocrField('payNo', 'PMT-2026-55008', 97),
      ocrField('amanah', 'Tabuk Amanah', 96),
      ocrField('municipality', 'NEOM Municipality', 94),
      ocrField('po', 'PO-88192', 98),
      ocrField('amount', '486,000.00 SAR', 99),
      ocrField('date', '2026-07-26', 99),
      ocrField('vat', '3009988776600001', 97)
    ],
    diff: [
      { label: { zh: '金额', en: 'Amount', ar: 'المبلغ' }, raw: '٤٨٦٬٠٠٠ ر.س', std: '486000.00 SAR' },
      { label: { zh: '日期', en: 'Date', ar: 'التاريخ' }, raw: '2026/07/26', std: '2026-07-26' }
    ]
  },
  dup: {
    docTitle: 'INV-2026-0728 · Gulf Facility Mgmt',
    fields: [
      ocrField('invoiceNo', 'INV-2026-0728', 99),
      ocrField('idNo', '1042 8830 55', 97),
      ocrField('regNo', 'CR-1010-448120', 96),
      ocrField('payNo', 'PMT-2026-55031', 98),
      ocrField('amanah', 'Riyadh Amanah', 97),
      ocrField('municipality', 'Al-Olaya Municipality', 96),
      ocrField('po', 'PO-88231', 99),
      ocrField('amount', '1,250,000.00 SAR', 99),
      ocrField('date', '2026-07-25', 99),
      ocrField('vat', '3001234567800003', 98)
    ],
    diff: [
      { label: { zh: '金额', en: 'Amount', ar: 'المبلغ' }, raw: 'SAR 1,250,000.00', std: '1250000.00 SAR' },
      { label: { zh: '日期', en: 'Date', ar: 'التاريخ' }, raw: '25-07-2026', std: '2026-07-25' }
    ]
  },
  taxfail: {
    docTitle: 'INV-2026-0727 · Aramco Logistics Supply',
    fields: [
      ocrField('invoiceNo', 'INV-2026-0727', 99),
      ocrField('idNo', '3055 1120 88', 96),
      ocrField('regNo', 'CR-2055-338890', 95),
      ocrField('payNo', 'PMT-2026-54990', 97),
      ocrField('amanah', 'Eastern Province Amanah', 96),
      ocrField('municipality', 'Dhahran Municipality', 95),
      ocrField('po', 'PO-87990', 98),
      ocrField('amount', '3,180,000.00 SAR', 99),
      ocrField('date', '2026-07-24', 99),
      ocrField('vat', '3005566778800002', 88)
    ],
    diff: [
      { label: { zh: '增值税', en: 'VAT', ar: 'الضريبة' }, raw: 'VAT# 300556677880000 2', std: '3005566778800002 (⚠ 校验失败)' },
      { label: { zh: '金额', en: 'Amount', ar: 'المبلغ' }, raw: 'SAR 3.18M', std: '3180000.00 SAR' }
    ]
  }
};

/* ---------------------------------------------------------------- Pipeline handoffs
   Per-scenario, per-agent intermediate conclusion + "input received from previous
   agent" line (A2..A6). Index 0 = A1. */
export const PIPELINE_WORK = {
  normal: [
    { conclusion: { zh: '从 Makin 拉取 PDF，OCR 提取 10 个字段，映射统一模型，去重通过。', en: 'Pulled PDF from Makin, OCR extracted 10 fields, mapped to unified model, dedup passed.', ar: 'تم سحب PDF من Makin واستخراج 10 حقول وتوحيدها، واجتياز فحص التكرار.' } },
    { handoff: { zh: '接收 A1 输出：标准化发票 INV-2026-0731（金额/PO/VAT）', en: 'Received A1 output: standardized invoice INV-2026-0731 (amount/PO/VAT)', ar: 'استلام مخرجات A1: الفاتورة الموحدة INV-2026-0731' }, conclusion: { zh: '三单匹配一致，ZATCA 税号有效，VAT 15% 复算通过，匹配置信度 97%。', en: '3-way match consistent, ZATCA tax ID valid, VAT 15% recomputed OK, match confidence 97%.', ar: 'المطابقة الثلاثية متسقة، الرقم الضريبي صالح، إعادة حساب الضريبة 15٪ ناجحة، ثقة 97٪.' } },
    { handoff: { zh: '接收 A2 输出：匹配一致、税务合规', en: 'Received A2 output: matched & tax-compliant', ar: 'استلام مخرجات A2: مطابقة ومتوافقة ضريبياً' }, conclusion: { zh: '价格贴近历史均价，风险评分 12（低危），无欺诈特征。', en: 'Price near historical average, risk score 12 (low), no fraud signals.', ar: 'السعر قريب من المتوسط التاريخي، درجة المخاطرة 12 (منخفضة).' } },
    { handoff: { zh: '接收 A3 输出：风险评分 12（低危）', en: 'Received A3 output: risk score 12 (low)', ar: 'استلام مخرجات A3: درجة 12 (منخفضة)' }, conclusion: { zh: '金额 1.25M，命中三级审批链，推送人工确认（HITL）。', en: 'Amount 1.25M, matched 3-level chain, pushed to human confirm (HITL).', ar: 'المبلغ 1.25M، سلسلة من 3 مستويات، أُرسلت للتأكيد البشري (HITL).' } },
    { handoff: { zh: '接收 A4 输出：待人工审批', en: 'Received A4 output: pending approval', ar: 'استلام مخرجات A4: بانتظار الموافقة' }, conclusion: { zh: '付款计划已建模，预计回收/结算周期正常。', en: 'Payment plan modeled; expected settlement cycle normal.', ar: 'تم نمذجة خطة الدفع؛ دورة التسوية المتوقعة طبيعية.' } },
    { handoff: { zh: '接收 A5 输出：结算周期正常', en: 'Received A5 output: normal settlement', ar: 'استلام مخرجات A5: تسوية طبيعية' }, conclusion: { zh: 'KPI 汇总入库，审计留痕已生成。', en: 'KPIs aggregated, audit trail generated.', ar: 'تم تجميع المؤشرات وإنشاء سجل التدقيق.' } }
  ],
  fraud: [
    { conclusion: { zh: '从 Makin 摄取 NEOM 账单，字段提取完成，去重通过。', en: 'Ingested NEOM invoice from Makin, fields extracted, dedup passed.', ar: 'تم استيعاب فاتورة NEOM، استخراج الحقول، اجتياز التكرار.' } },
    { handoff: { zh: '接收 A1 输出：标准化发票 INV-2026-0730', en: 'Received A1 output: standardized invoice INV-2026-0730', ar: 'استلام مخرجات A1: INV-2026-0730' }, conclusion: { zh: '三单匹配通过，税号有效——移交异常检测复核价格。', en: '3-way match OK, tax valid — handing to anomaly agent for price review.', ar: 'المطابقة والضريبة صحيحة — التحويل لوكيل الشذوذ لمراجعة السعر.' } },
    { handoff: { zh: '接收 A2 输出：账单-PO-实收一致', en: 'Received A2 output: invoice-PO-receipt consistent', ar: 'استلام مخرجات A2: الفاتورة-PO-الإيصال متسقة' }, conclusion: { zh: '⚠ 价格偏离行业基准 +38%，供应商 90 天内无历史，风险评分 82，置信度 71% < 75% → 触发 HITL 断点。', en: '⚠ Price +38% above benchmark, no vendor history in 90d, risk score 82, confidence 71% < 75% → HITL breakpoint.', ar: '⚠ السعر +38٪ فوق المعيار، لا تاريخ للمورد، درجة 82، ثقة 71٪ < 75٪ → نقطة توقف HITL.' } },
    {}, {}, {}
  ],
  dup: [
    { conclusion: { zh: '⚠ 去重环节命中历史重复账单（发票号/金额/供应商/PO 四元组一致），已自动拦截，等待人工确认。', en: '⚠ Dedup matched a historical duplicate (invoice/amount/vendor/PO tuple). Auto-blocked, awaiting human confirm.', ar: '⚠ طابق فحص التكرار فاتورة مكررة (رقم/مبلغ/مورد/PO). حظر تلقائي بانتظار التأكيد.' } },
    {}, {}, {}, {}, {}
  ],
  taxfail: [
    { conclusion: { zh: '摄取 Aramco 账单，字段提取完成——VAT 字段 OCR 置信度仅 88%。', en: 'Ingested Aramco invoice; fields extracted — VAT field OCR confidence only 88%.', ar: 'تم استيعاب فاتورة Aramco؛ ثقة OCR للضريبة 88٪ فقط.' } },
    { handoff: { zh: '接收 A1 输出：标准化发票 INV-2026-0727（VAT 待校验）', en: 'Received A1 output: invoice INV-2026-0727 (VAT to verify)', ar: 'استلام مخرجات A1: INV-2026-0727 (الضريبة قيد التحقق)' }, conclusion: { zh: '⚠ 账单明细与 PO 部分差异，ZATCA 税号校验失败，匹配置信度 68% < 75% → 转人工复核。', en: '⚠ Invoice items partially differ from PO, ZATCA tax-ID check failed, match confidence 68% < 75% → manual review.', ar: '⚠ اختلاف جزئي مع PO، فشل فحص الرقم الضريبي، ثقة 68٪ < 75٪ → مراجعة يدوية.' } },
    {}, {}, {}, {}
  ]
};

// Which node the scenario stalls at (0-based). null = runs the full chain.
export const SCENARIO_STALL = { normal: null, fraud: 2, dup: 0, taxfail: 1 };

// Pending action / why-blocked label for the stalled node.
export const SCENARIO_PENDING = {
  fraud: { zh: '欺诈风险评分 82，等待审计师人工复核', en: 'Fraud risk score 82 — awaiting auditor manual review', ar: 'درجة احتيال 82 — بانتظار مراجعة المدقق' },
  dup: { zh: '检测到重复发票，已拦截，等待人工确认', en: 'Duplicate invoice detected, blocked — awaiting human confirm', ar: 'تم اكتشاف فاتورة مكررة، محظورة — بانتظار التأكيد' },
  taxfail: { zh: '税务/匹配置信度 68% < 75%，转合规人工复核', en: 'Tax/match confidence 68% < 75% — referred to compliance', ar: 'ثقة 68٪ < 75٪ — محال للامتثال' }
};

/* ---------------------------------------------------------------- A2 verification
   3-way match (Invoice vs PO vs Received) + ZATCA + Makin↔Tahseel reconciliation. */
function verifyBundle(scenario) {
  const fail = scenario === 'taxfail';
  return {
    title: { zh: 'A2 验证合规 · AI 分析过程', en: 'A2 Verification · AI Analysis', ar: 'A2 التحقق · تحليل الذكاء' },
    subtitle: { zh: '三单匹配 · ZATCA 税务校验 · Makin↔Tahseel 对账', en: '3-way match · ZATCA check · Makin↔Tahseel reconciliation', ar: 'مطابقة ثلاثية · فحص ZATCA · تسوية' },
    agentTag: 'A2',
    steps: [
      {
        agent: 'A2',
        title: { zh: '三单匹配（账单 vs PO vs 实收）', en: '3-way match (Invoice vs PO vs Received)', ar: 'المطابقة الثلاثية' },
        detail: { zh: '逐行比对账单明细、采购订单与实收记录。', en: 'Line-by-line compare of invoice items, PO and goods-received.', ar: 'مقارنة بند-ببند للفاتورة وأمر الشراء والاستلام.' },
        rows: [
          { label: { zh: '数量 Qty', en: 'Qty', ar: 'الكمية' }, value: { zh: '匹配 ✓', en: 'Match ✓', ar: 'مطابق ✓' }, tone: 'ok' },
          { label: { zh: '单价 Unit price', en: 'Unit price', ar: 'سعر الوحدة' }, value: fail ? { zh: '不匹配 ✗', en: 'Mismatch ✗', ar: 'غير مطابق ✗' } : { zh: '匹配 ✓', en: 'Match ✓', ar: 'مطابق ✓' }, tone: fail ? 'danger' : 'ok' },
          { label: { zh: '总额 Total', en: 'Total', ar: 'الإجمالي' }, value: fail ? { zh: '差异 +2.4%', en: 'Diff +2.4%', ar: 'فرق +2.4٪' } : { zh: '匹配 ✓', en: 'Match ✓', ar: 'مطابق ✓' }, tone: fail ? 'warn' : 'ok' }
        ]
      },
      {
        agent: 'A2',
        title: { zh: 'ZATCA 税务校验', en: 'ZATCA tax check', ar: 'فحص ZATCA الضريبي' },
        detail: { zh: '校验供应商税号有效性并按 15% 复算 VAT。', en: 'Validate supplier tax-registration and recompute VAT at 15%.', ar: 'التحقق من تسجيل المورد وإعادة حساب الضريبة 15٪.' },
        rows: [
          { label: { zh: '税号有效性', en: 'Tax-reg validity', ar: 'صلاحية الرقم' }, value: fail ? { zh: '校验失败', en: 'Failed', ar: 'فشل' } : { zh: '有效', en: 'Valid', ar: 'صالح' }, tone: fail ? 'danger' : 'ok' },
          { label: { zh: 'VAT 15% 复算', en: 'VAT 15% recompute', ar: 'إعادة حساب 15٪' }, value: fail ? { zh: '偏差 4,200 SAR', en: 'Off by 4,200 SAR', ar: 'انحراف 4,200' } : { zh: '一致', en: 'Consistent', ar: 'متسق' }, tone: fail ? 'warn' : 'ok' }
        ]
      },
      {
        agent: 'A2',
        title: { zh: 'Makin ↔ Tahseel 跨平台对账', en: 'Makin ↔ Tahseel reconciliation', ar: 'تسوية Makin ↔ Tahseel' },
        detail: { zh: 'Tahseel 为记录系统（SoR），比对合同与催收台账差异。', en: 'Tahseel is the system of record; compare contract vs collection ledger.', ar: 'Tahseel هو نظام السجل؛ مقارنة العقد بدفتر التحصيل.' },
        confidence: fail ? 68 : 97,
        confLabel: { zh: '匹配置信度', en: 'Match confidence', ar: 'ثقة المطابقة' }
      }
    ],
    conclusion: fail
      ? { text: { zh: '匹配置信度 68% < 75%，税号校验失败，转合规人工复核。', en: 'Match confidence 68% < 75% and tax-ID failed — referred to compliance review.', ar: 'ثقة 68٪ < 75٪ وفشل الرقم الضريبي — محال للامتثال.' }, confidence: 68, tone: 'danger', action: { zh: '人工复核税号并补正 PO 差异', en: 'Human to verify tax-ID and correct PO discrepancy', ar: 'التحقق اليدوي من الرقم وتصحيح الفرق' } }
      : { text: { zh: '三单匹配一致，税务合规，跨平台对账无差异。', en: 'All matched, tax-compliant, no reconciliation gaps.', ar: 'الكل مطابق ومتوافق ولا فجوات تسوية.' }, confidence: 97, tone: 'ok', action: { zh: '放行至审批路由 A4', en: 'Release to approval routing (A4)', ar: 'التمرير إلى التوجيه A4' } }
  };
}

/* A1 dedup drawer (duplicate scenario). */
const DEDUP_BUNDLE = {
  title: { zh: 'A1 摄取去重 · AI 分析过程', en: 'A1 Dedup · AI Analysis', ar: 'A1 كشف التكرار · تحليل' },
  subtitle: { zh: '四元组指纹比对拦截重复付款', en: 'Tuple-fingerprint match blocks double payment', ar: 'مطابقة البصمة تمنع الدفع المزدوج' },
  agentTag: 'A1',
  steps: [
    { agent: 'A1', title: { zh: '生成指纹', en: 'Build fingerprint', ar: 'بناء البصمة' }, detail: { zh: '对 (发票号, 金额, 供应商, PO) 生成指纹并检索历史库。', en: 'Hash (invoice, amount, vendor, PO) and search history.', ar: 'تجزئة (فاتورة، مبلغ، مورد، PO) والبحث في السجل.' } },
    { agent: 'A1', title: { zh: '命中重复', en: 'Duplicate hit', ar: 'تطابق مكرر' }, blocked: true,
      detail: { zh: '与 INV-2026-0731 四元组完全一致，判定为重复账单。', en: 'Exact tuple match with INV-2026-0731 → duplicate.', ar: 'تطابق تام مع INV-2026-0731 → مكرر.' },
      rows: [
        { label: { zh: '金额', en: 'Amount', ar: 'المبلغ' }, value: '1,250,000 SAR' },
        { label: { zh: '重复对象', en: 'Duplicate of', ar: 'مكرر لـ' }, value: 'INV-2026-0731', tone: 'danger' },
        { label: { zh: 'PO', en: 'PO', ar: 'PO' }, value: 'PO-88231' }
      ] }
  ],
  conclusion: { text: { zh: '已拦截重复付款，为部委节省 1,250,000 SAR，等待人工确认。', en: 'Blocked double payment, saved 1,250,000 SAR — awaiting human confirm.', ar: 'حُظر الدفع المزدوج، توفير 1,250,000 — بانتظار التأكيد.' }, tone: 'warn', action: { zh: '人工确认后归档，无需进入后续流程', en: 'Archive after human confirm; no further processing', ar: 'الأرشفة بعد التأكيد؛ لا معالجة إضافية' } }
};

/* A3 risk drawer (fraud scenario, node in pipeline). */
const PIPE_RISK_BUNDLE = {
  title: { zh: 'A3 异常检测 · AI 分析过程', en: 'A3 Anomaly · AI Analysis', ar: 'A3 كشف الشذوذ · تحليل' },
  subtitle: { zh: 'NEOM 物流 INV-2026-0730 · 价格与供应商画像', en: 'NEOM Logistics INV-2026-0730 · price & vendor profile', ar: 'NEOM · السعر وملف المورد' },
  agentTag: 'A3',
  steps: [
    { agent: 'A3', title: { zh: '行业价格基准比对', en: 'Industry benchmark', ar: 'المعيار القطاعي' }, detail: { zh: '同品类历史均价 352K SAR，本单 486K SAR。', en: 'Category avg 352K SAR vs this bill 486K SAR.', ar: 'متوسط الفئة 352K مقابل 486K.' }, rows: [{ label: { zh: '偏离', en: 'Deviation', ar: 'الانحراف' }, value: '+38%', tone: 'danger' }] },
    { agent: 'A3', title: { zh: '供应商历史模式', en: 'Vendor history', ar: 'تاريخ المورد' }, detail: { zh: '供应商 90 天内无历史账单，首次交易。', en: 'No invoices in 90 days; first-time vendor.', ar: 'لا فواتير خلال 90 يوماً؛ أول تعامل.' } },
    { agent: 'A3', title: { zh: '风险评分拆解', en: 'Risk score breakdown', ar: 'تفصيل الدرجة' }, confidence: 82, confLabel: { zh: '风险评分 0-100', en: 'Risk score 0-100', ar: 'درجة 0-100' },
      rows: [
        { label: { zh: '价格偏离 (0.45)', en: 'Price dev (0.45)', ar: 'انحراف (0.45)' }, value: '38', tone: 'danger' },
        { label: { zh: '首次交易 (0.30)', en: 'First-time (0.30)', ar: 'أول تعامل (0.30)' }, value: '26' },
        { label: { zh: '整数金额 (0.25)', en: 'Round amount (0.25)', ar: 'مبلغ دائري (0.25)' }, value: '18' }
      ] }
  ],
  conclusion: { text: { zh: '风险评分 82（高危），置信度 71% < 75%，触发 HITL，转审计师复核。', en: 'Risk 82 (high), confidence 71% < 75%, HITL triggered — referred to auditor.', ar: 'درجة 82 (عالية)، ثقة 71٪ < 75٪، تفعيل HITL — للمدقق.' }, confidence: 82, tone: 'danger', action: { zh: '暂停自动付款，转人工复核', en: 'Pause auto-payment; manual review', ar: 'إيقاف الدفع؛ مراجعة يدوية' } }
};

// Per-scenario node drawers: which agent nodes expose "view AI analysis".
export const NODE_DRAWERS = {
  normal: { A2: verifyBundle('normal') },
  fraud: { A2: verifyBundle('fraud'), A3: PIPE_RISK_BUNDLE },
  dup: { A1: DEDUP_BUNDLE },
  taxfail: { A2: verifyBundle('taxfail') }
};

/* ---------------------------------------------------------------- A3 Risk Radar */
export const RISK_ANALYSIS = {
  'INV-2026-0730': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'NEOM 物流服务 · 风险评分 82', en: 'NEOM Logistics · risk score 82', ar: 'NEOM · درجة 82' },
    agentTag: 'A3',
    steps: PIPE_RISK_BUNDLE.steps,
    conclusion: PIPE_RISK_BUNDLE.conclusion
  },
  'INV-2026-0709': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'Desert Rose 贸易 · 风险评分 74', en: 'Desert Rose Trading · risk score 74', ar: 'وردة الصحراء · درجة 74' },
    agentTag: 'A3',
    steps: [
      { agent: 'A3', title: { zh: '高频提交模式', en: 'High-frequency pattern', ar: 'نمط متكرر' }, detail: { zh: '7 天内提交 5 张金额均为 99.8 万 SAR 的账单。', en: '5 invoices of 998K SAR each within 7 days.', ar: '5 فواتير 998K خلال 7 أيام.' } },
      { agent: 'A3', title: { zh: '阈值规避分析', en: 'Threshold-evasion analysis', ar: 'تحليل تجاوز الحد' }, detail: { zh: '均低于 100 万审批阈值 0.2%，疑似拆单。', en: 'All 0.2% below the 1M approval threshold — suspected splitting.', ar: 'الكل تحت الحد بـ0.2٪ — يُشتبه بالتقسيم.' }, confidence: 74, confLabel: { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' } }
    ],
    conclusion: { text: { zh: '疑似拆单规避审批，风险评分 74，标记待审计师核查。', en: 'Suspected invoice-splitting to evade approval; risk 74, flagged for auditor.', ar: 'يُشتبه بالتقسيم؛ درجة 74، موسوم للمدقق.' }, confidence: 74, tone: 'danger', action: { zh: '合并审计 5 张关联账单', en: 'Audit the 5 related invoices together', ar: 'تدقيق الفواتير الخمس معاً' } }
  },
  'INV-2026-0688': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'Falcon 工程 · 风险评分 58', en: 'Falcon Engineering · risk score 58', ar: 'فالكون · درجة 58' },
    agentTag: 'A3',
    steps: [
      { agent: 'A3', title: { zh: '主体一致性核查', en: 'Entity consistency', ar: 'اتساق الكيان' }, detail: { zh: 'VAT 号归属主体与 Makin 合同签约主体不一致。', en: 'VAT owner differs from the Makin contract signatory.', ar: 'مالك الرقم يختلف عن موقّع العقد.' } },
      { agent: 'A3', title: { zh: '关联关系评估', en: 'Relationship assessment', ar: 'تقييم العلاقة' }, detail: { zh: '未在集团关联清单中找到映射记录。', en: 'No mapping found in the group affiliation registry.', ar: 'لا يوجد ربط في سجل الانتماء.' }, confidence: 58, confLabel: { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' } }
    ],
    conclusion: { text: { zh: '税号与合同主体不一致，风险评分 58，转合规复核。', en: 'VAT-contract entity mismatch; risk 58, referred to compliance.', ar: 'عدم تطابق؛ درجة 58، محال للامتثال.' }, confidence: 58, tone: 'warn', action: { zh: '核实关联关系或退回补正', en: 'Verify affiliation or return for correction', ar: 'التحقق أو الإرجاع للتصحيح' } }
  },
  'INV-2026-0655': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'Oasis 服务 · 风险评分 41', en: 'Oasis Services · risk score 41', ar: 'واحة · درجة 41' },
    agentTag: 'A3',
    steps: [
      { agent: 'A3', title: { zh: '账期偏离分析', en: 'Payment-term deviation', ar: 'انحراف مدة السداد' }, detail: { zh: '合同约定账期 60 天，本单要求 7 天内付款。', en: 'Contract term 60 days but invoice demands payment in 7.', ar: 'مدة 60 يوماً لكن الطلب خلال 7.' }, confidence: 41, confLabel: { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' } }
    ],
    conclusion: { text: { zh: '付款周期异常缩短，风险评分 41，提示财务经理关注。', en: 'Abnormally short term; risk 41, flagged for finance manager.', ar: 'مدة قصيرة؛ درجة 41، تنبيه للمدير المالي.' }, confidence: 41, tone: 'warn', action: { zh: '按合同账期付款，勿加速', en: 'Pay per contract term; do not accelerate', ar: 'الدفع وفق العقد؛ دون تسريع' } }
  }
};

/* ---------------------------------------------------------------- A4 Approvals */
export const APPROVAL_BASIS = {
  'INV-2026-0727': {
    title: { zh: 'AI 辅助分析', en: 'AI-Assisted Analysis', ar: 'تحليل بمساعدة الذكاء' },
    subtitle: { zh: 'Aramco 后勤 · 3.18M SAR', en: 'Aramco Logistics · 3.18M SAR', ar: 'Aramco · 3.18M' },
    agentTag: 'A4',
    steps: [
      { agent: 'A4', title: { zh: '为何路由至此（授权矩阵）', en: 'Why routed here (authorization matrix)', ar: 'لماذا وُجّه هنا' }, detail: { zh: '金额 > 300 万 SAR，触发六级审批链，需中心主任+CFO。', en: 'Amount > 3M SAR triggers the 6-level chain up to Director + CFO.', ar: 'المبلغ > 3M يطلق 6 مستويات حتى المدير والرئيس المالي.' }, rows: [{ label: { zh: '部门', en: 'Department', ar: 'القسم' }, value: 'Procurement' }, { label: { zh: '权限层级', en: 'Authority level', ar: 'المستوى' }, value: 'L6 / CFO' }] },
      { agent: 'A4', title: { zh: '触发依据 / 异常原因', en: 'Trigger basis / anomaly', ar: 'أساس التنبيه' }, detail: { zh: '匹配置信度 68%，评估已超时 8h，自动升级至中心主任。', en: 'Match confidence 68%; SLA overran 8h, auto-escalated to Director.', ar: 'ثقة 68٪؛ تجاوز SLA 8 ساعات، تصعيد للمدير.' }, rows: [{ label: 'SLA', value: { zh: '4 小时（已超时）', en: '4h (overrun)', ar: '4 ساعات (متجاوز)' }, tone: 'danger' }] }
    ],
    conclusion: { text: { zh: 'AI 建议：退回补正税号/PO 差异后再审批。人工做最终决策。', en: 'AI recommends: return for tax/PO correction before approval. Human decides.', ar: 'يوصي الذكاء: الإرجاع للتصحيح قبل الموافقة. القرار للبشر.' }, confidence: 62, tone: 'warn', action: { zh: '退回 / 升级 / 批准（人工选择）', en: 'Return / Escalate / Approve (human choice)', ar: 'إرجاع / تصعيد / موافقة' } }
  },
  'INV-2026-0724': {
    title: { zh: 'AI 辅助分析', en: 'AI-Assisted Analysis', ar: 'تحليل بمساعدة الذكاء' },
    subtitle: { zh: 'Bahri 海运物流 · 2.26M SAR', en: 'Bahri Maritime · 2.26M SAR', ar: 'البحري · 2.26M' },
    agentTag: 'A4',
    steps: [
      { agent: 'A4', title: { zh: '为何路由至此（授权矩阵）', en: 'Why routed here (authorization matrix)', ar: 'لماذا وُجّه هنا' }, detail: { zh: '金额 100~300 万 SAR，触发四级审批链。', en: 'Amount 1-3M SAR triggers the 4-level chain.', ar: 'المبلغ 1-3M يطلق 4 مستويات.' }, rows: [{ label: { zh: '权限层级', en: 'Authority level', ar: 'المستوى' }, value: 'L4 / Director' }] },
      { agent: 'A4', title: { zh: '风险与匹配', en: 'Risk & match', ar: 'المخاطر والمطابقة' }, detail: { zh: '三单完全匹配，风险评分 33（中低），无异常触发。', en: 'Full 3-way match, risk 33 (low-mid), no anomaly.', ar: 'مطابقة كاملة، درجة 33، لا شذوذ.' }, confidence: 90, confLabel: { zh: '建议置信度', en: 'Recommendation confidence', ar: 'ثقة التوصية' } }
    ],
    conclusion: { text: { zh: 'AI 建议：批准。匹配完整、风险低。人工确认即可。', en: 'AI recommends: approve. Full match, low risk. Human to confirm.', ar: 'يوصي الذكاء: الموافقة. مطابقة كاملة ومخاطر منخفضة.' }, confidence: 90, tone: 'ok', action: { zh: '批准付款', en: 'Approve payment', ar: 'الموافقة على الدفع' } }
  },
  'INV-2026-0731': {
    title: { zh: 'AI 辅助分析', en: 'AI-Assisted Analysis', ar: 'تحليل بمساعدة الذكاء' },
    subtitle: { zh: 'Al-Rajhi 建设 · 1.25M SAR', en: 'Al-Rajhi Construction · 1.25M SAR', ar: 'الراجحي · 1.25M' },
    agentTag: 'A4',
    steps: [
      { agent: 'A4', title: { zh: '为何路由至此（授权矩阵）', en: 'Why routed here (authorization matrix)', ar: 'لماذا وُجّه هنا' }, detail: { zh: '金额 100~300 万 SAR，触发三级审批链。', en: 'Amount 1-3M SAR triggers the 3-level chain.', ar: 'المبلغ 1-3M يطلق 3 مستويات.' }, rows: [{ label: { zh: '权限层级', en: 'Authority level', ar: 'المستوى' }, value: 'L3 / Budget' }] },
      { agent: 'A4', title: { zh: '风险与匹配', en: 'Risk & match', ar: 'المخاطر والمطابقة' }, detail: { zh: '三单完全匹配，风险评分 12（低），税务合规。', en: 'Full match, risk 12 (low), tax compliant.', ar: 'مطابقة كاملة، درجة 12، متوافق.' }, confidence: 95, confLabel: { zh: '建议置信度', en: 'Recommendation confidence', ar: 'ثقة التوصية' } }
    ],
    conclusion: { text: { zh: 'AI 建议：批准。低风险且合规。人工做最终决策。', en: 'AI recommends: approve. Low risk & compliant. Human decides.', ar: 'يوصي الذكاء: الموافقة. مخاطر منخفضة ومتوافق.' }, confidence: 95, tone: 'ok', action: { zh: '批准付款', en: 'Approve payment', ar: 'الموافقة على الدفع' } }
  }
};

/* ---------------------------------------------------------------- A5 Forecast */
function forecastBundle(sub, prob, steps, tone, action) {
  return {
    title: { zh: '预测依据', en: 'Prediction Basis', ar: 'أساس التنبؤ' },
    subtitle: sub,
    agentTag: 'A5',
    steps,
    conclusion: {
      text: { zh: `综合各因子，回收概率 ${prob}%。`, en: `Combined factors → recovery probability ${prob}%.`, ar: `احتمال التحصيل ${prob}%.` },
      confidence: prob, tone, action
    }
  };
}

export const FORECAST_BASIS = {
  'INV-2026-0512': forecastBundle(
    { zh: 'Sky Bridge 建筑 · 逾期 45 天', en: 'Sky Bridge Construction · 45d overdue', ar: 'سكاي بريدج · 45 يوماً' }, 34,
    [
      { agent: 'A5', title: { zh: '细分历史收缴率', en: 'Segment collection rate', ar: 'معدل الفئة' }, detail: { zh: '建筑业细分历史收缴率 58%。', en: 'Construction-segment historical rate 58%.', ar: 'معدل قطاع الإنشاءات 58٪.' }, rows: [{ label: { zh: '逾期天数', en: 'Overdue days', ar: 'أيام التأخير' }, value: '45', tone: 'warn' }, { label: { zh: '诉讼状态', en: 'Litigation', ar: 'التقاضي' }, value: { zh: '未起诉', en: 'None', ar: 'لا يوجد' } }] },
      { agent: 'A5', title: { zh: 'Mumtathil 罚款 + 宏观', en: 'Mumtathil penalty + macro', ar: 'عقوبة ممتثل + الكلي' }, detail: { zh: 'Mumtathil 罚款已上诉，行业景气度下行。', en: 'Mumtathil penalty appealed; sector sentiment down.', ar: 'العقوبة مستأنفة؛ القطاع هابط.' }, confidence: 34, confLabel: { zh: '回收概率', en: 'Recovery prob.', ar: 'احتمال التحصيل' } }
    ], 'danger', { zh: '启动法务催告，评估计提坏账', en: 'Start legal notice; assess bad-debt provision', ar: 'إشعار قانوني؛ تقييم المخصص' }),
  'INV-2026-0498': forecastBundle(
    { zh: 'Green Valley 农业 · 逾期 28 天', en: 'Green Valley Agriculture · 28d overdue', ar: 'الوادي الأخضر · 28 يوماً' }, 62,
    [
      { agent: 'A5', title: { zh: '历史与逾期', en: 'History & overdue', ar: 'التاريخ والتأخير' }, detail: { zh: '农业细分收缴率 71%，逾期 28 天。', en: 'Agri-segment rate 71%, overdue 28 days.', ar: 'معدل الزراعة 71٪، تأخير 28 يوماً.' }, rows: [{ label: { zh: '罚款', en: 'Penalty', ar: 'العقوبة' }, value: { zh: '无', en: 'None', ar: 'لا يوجد' }, tone: 'ok' }] },
      { agent: 'A5', title: { zh: '概率合成', en: 'Probability synthesis', ar: 'تركيب الاحتمال' }, detail: { zh: '无诉讼、无罚款，中等回收概率。', en: 'No litigation/penalty → medium recovery.', ar: 'لا تقاضٍ/عقوبة → متوسط.' }, confidence: 62, confLabel: { zh: '回收概率', en: 'Recovery prob.', ar: 'احتمال التحصيل' } }
    ], 'warn', { zh: '电话+邮件双渠道提醒，7 日内跟进', en: 'Phone + email reminders; follow up in 7 days', ar: 'تذكير هاتف وبريد؛ متابعة خلال 7 أيام' }),
  'INV-2026-0476': forecastBundle(
    { zh: 'Metro 运输 · 逾期 12 天', en: 'Metro Transport · 12d overdue', ar: 'مترو · 12 يوماً' }, 88,
    [
      { agent: 'A5', title: { zh: '优质付款历史', en: 'Strong payment history', ar: 'تاريخ سداد قوي' }, detail: { zh: '过去 12 个月按时付款率 94%，逾期仅 12 天。', en: 'On-time rate 94% over 12 months; only 12 days overdue.', ar: 'نسبة الالتزام 94٪؛ تأخير 12 يوماً فقط.' }, confidence: 88, confLabel: { zh: '回收概率', en: 'Recovery prob.', ar: 'احتمال التحصيل' } }
    ], 'ok', { zh: '标准催收邮件即可', en: 'Standard collection email suffices', ar: 'بريد تحصيل قياسي' }),
  'INV-2026-0455': forecastBundle(
    { zh: 'Coastal 物流 · 逾期 61 天', en: 'Coastal Logistics · 61d overdue', ar: 'الساحلية · 61 يوماً' }, 21,
    [
      { agent: 'A5', title: { zh: '严重逾期 + 执行中', en: 'Deep overdue + enforcing', ar: 'تأخر عميق + تنفيذ' }, detail: { zh: '逾期 61 天，Mumtathil 罚款执行中。', en: '61 days overdue; Mumtathil penalty enforcing.', ar: '61 يوماً؛ عقوبة قيد التنفيذ.' }, rows: [{ label: { zh: '罚款状态', en: 'Penalty', ar: 'العقوبة' }, value: { zh: '执行中', en: 'Enforcing', ar: 'قيد التنفيذ' }, tone: 'danger' }] },
      { agent: 'A5', title: { zh: '概率合成', en: 'Probability synthesis', ar: 'تركيب الاحتمال' }, detail: { zh: '高延迟风险，回收概率极低。', en: 'High delay risk; very low recovery.', ar: 'خطر تأخير عالٍ؛ احتمال منخفض جداً.' }, confidence: 21, confLabel: { zh: '回收概率', en: 'Recovery prob.', ar: 'احتمال التحصيل' } }
    ], 'danger', { zh: '最高优先级，催收经理介入并计提坏账', en: 'Top priority; manager intervention + bad-debt provisioning', ar: 'أولوية قصوى؛ تدخل المدير + مخصص' })
};

/* ---------------------------------------------------------------- HITL stats */
export const HITL_STATS = {
  title: { zh: '人机协作 (HITL) 运行统计', en: 'Human-in-the-Loop (HITL) Statistics', ar: 'إحصاءات الإنسان في الحلقة' },
  subtitle: { zh: '本月 · AI 自动处理 vs 转人工 · 断点触发', en: 'This month · auto vs human · breakpoints', ar: 'هذا الشهر · تلقائي مقابل بشري' },
  agentTag: 'A0',
  stats: [
    { value: '12,480', label: { zh: '本月已处理账单', en: 'Invoices processed', ar: 'الفواتير المعالجة' } },
    { value: '91.4%', label: { zh: 'AI 自动处理占比', en: 'Auto-processed share', ar: 'نسبة المعالجة التلقائية' } },
    { value: '1,073', label: { zh: '转人工复核', en: 'Sent to human', ar: 'محال للبشر' } },
    { value: '93.7%', label: { zh: '平均决策置信度', en: 'Avg decision confidence', ar: 'متوسط الثقة' } }
  ],
  steps: [
    { agent: 'A0', title: { zh: '断点触发来源', en: 'Breakpoint triggers', ar: 'مصادر التوقف' }, detail: { zh: '置信度 < 75%、金额超阈值、异常评分过高时暂停并转人工。', en: 'Pauses when confidence < 75%, amount over threshold, or high anomaly score.', ar: 'يتوقف عند ثقة < 75٪ أو تجاوز المبلغ أو درجة شذوذ عالية.' },
      rows: [
        { label: { zh: '置信度断点', en: 'Confidence breakpoints', ar: 'ثقة' }, value: '612' },
        { label: { zh: '金额阈值断点', en: 'Amount-threshold', ar: 'حد المبلغ' }, value: '327' },
        { label: { zh: '异常断点', en: 'Anomaly breakpoints', ar: 'شذوذ' }, value: '134', tone: 'danger' }
      ] }
  ],
  conclusion: { text: { zh: 'AI 出结论、人工做决策：91.4% 自动完成，其余按风险精准转人工。', en: 'AI concludes, humans decide: 91.4% automated, the rest routed to humans by risk.', ar: 'الذكاء يستنتج والبشر يقررون: 91.4٪ آلي والباقي حسب المخاطر.' }, confidence: 94, tone: 'ok' }
};

/* ---------------------------------------------------------------- A0 Orchestration */
export const ORCH_TASKS = [
  { route: 'A0 → A1', text: { zh: '派发摄取任务：拉取并 OCR 标准化', en: 'Dispatch ingestion: fetch & OCR-normalize', ar: 'إرسال الاستيعاب: جلب وتوحيد' } },
  { route: 'A1 → A2', text: { zh: '移交标准化发票，执行三单匹配', en: 'Handoff standardized invoice, run 3-way match', ar: 'تسليم الفاتورة وتنفيذ المطابقة' } },
  { route: 'A2 → A3', text: { zh: '移交匹配结果，执行风险评分', en: 'Handoff match result, run risk scoring', ar: 'تسليم المطابقة وتنفيذ التقييم' } },
  { route: 'A3 → A0', text: { zh: '风险 > 阈值，回报编排层触发 HITL 断点', en: 'Risk > threshold, report to orchestrator → HITL breakpoint', ar: 'مخاطر > الحد، إبلاغ المنسق → توقف HITL', hitl: true } },
  { route: 'A0 → A4', text: { zh: '按授权矩阵分发审批链', en: 'Dispatch approval chain per authorization matrix', ar: 'توزيع سلسلة الموافقة' } },
  { route: 'A4 → A5', text: { zh: '审批后移交催收预测', en: 'After approval, handoff to forecasting', ar: 'بعد الموافقة، تسليم للتنبؤ' } },
  { route: 'A5 → A6', text: { zh: '移交结果，汇总 KPI 与审计留痕', en: 'Handoff results, aggregate KPIs & audit trail', ar: 'تسليم النتائج وتجميع المؤشرات' } }
];
