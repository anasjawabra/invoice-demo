// IntelliBill — "AI process" mock data (reasoning steps, evidence, OCR fields,
// pipeline handoffs, HITL stats, orchestration). All tri-lingual via {zh,en,ar}.
// Consumed by the shared components under src/components/ai/*.
//
// SCHEMA — a step can be EITHER:
//  (a) legacy: { agent, title, detail, rows[], confidence, confLabel, handoff, blocked }
//  (b) typed-block trace: { agent, title, handoff, blocked, blocks: [ Block, ... ] }
// where each Block is one of:
//  { type:'thought',        text:{i18n}, latencyMs }
//  { type:'tool_call',      tool, request:{}, response:{}, latencyMs }
//  { type:'observation',    text:{i18n}, tone? }
//  { type:'reconciliation', scenario, tolerance? }        // renders 3-way table from RECON
//  { type:'evidence',       items:[{ source:{i18n}|str, detail:{i18n}, tone? }] }
//  { type:'confidence',     value, label:{i18n}, factors:[{ label:{i18n}, points }] }
//  { type:'chart',          chartType:'factorBar'|'collectionCurve'|'priceBench'|'vatVariance', payload }
//  { type:'efficiency',     agent:'A2' | data:{...} }     // Manual-vs-Agent stat
//  { type:'decision',       text:{i18n}, tone, auto:bool, gate:{i18n} }  // final rec + HITL gate
// TraceBlock guarantees every block resolves (no infinite spinner); the drawer
// always closes with the highlighted `conclusion`.

/* ------------------------------------------------------------- Block builders */
const think = (text, latencyMs = 260) => ({ type: 'thought', text, latencyMs });
const tool = (name, request, response, latencyMs = 320) => ({ type: 'tool_call', tool: name, request, response, latencyMs });
const obs = (text, tone) => ({ type: 'observation', text, tone });
const recon = (scenario, tolerance = 0.02) => ({ type: 'reconciliation', scenario, tolerance });
const evid = (items) => ({ type: 'evidence', items });
const conf = (value, label, factors) => ({ type: 'confidence', value, label, factors });
const chart = (chartType, payload) => ({ type: 'chart', chartType, payload });
const eff = (agent) => ({ type: 'efficiency', agent });
const decide = (text, tone, auto, gate) => ({ type: 'decision', text, tone, auto, gate });

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

/* Compact happy-path bundles so EVERY node of the normal walkthrough exposes a
   rich trace (A1 ingest, A3 anomaly-clear, A5 forecast, A6 analytics). A2 uses
   verifyBundle('normal'); A4 reuses APPROVAL_BASIS below. */
const INGEST_OK_BUNDLE = {
  title: { zh: 'A1 摄取标准化 · Agent 运行轨迹', en: 'A1 Ingestion · Agent Run-Trace', ar: 'A1 الاستيعاب · مسار الوكيل' },
  subtitle: { zh: 'Makin PDF · OCR 提取 · 去重', en: 'Makin PDF · OCR extract · dedup', ar: 'Makin · استخراج OCR · تكرار' },
  agentTag: 'A1',
  steps: [
    {
      agent: 'A1',
      title: { zh: '抓取与 OCR 提取', en: 'Fetch & OCR extract', ar: 'الجلب واستخراج OCR' },
      blocks: [
        think({ zh: '从 Makin 拉取 PDF，调用视觉模型提取 10 个结构化字段。', en: 'Pulling the PDF from Makin and calling the vision model to extract 10 structured fields.', ar: 'أسحب PDF من Makin وأستدعي نموذج الرؤية لاستخراج 10 حقول.' }),
        tool('vision.ocr_extract', { source: 'Makin', doc: 'INV-2026-0731.pdf' }, { fields_extracted: 10, avg_confidence: 0.98, low_confidence_fields: 0 }, 420),
        obs({ zh: '成功提取 10 个字段，平均置信度 98%，无低置信字段。', en: 'Extracted 10 fields at 98% average confidence, no low-confidence fields.', ar: 'تم استخراج 10 حقول بثقة 98٪ دون حقول منخفضة.' }, 'ok')
      ]
    },
    {
      agent: 'A1',
      title: { zh: '标准化与去重', en: 'Normalize & dedup', ar: 'التوحيد وكشف التكرار' },
      blocks: [
        tool('dedup.fingerprint_search', { invoice: 'INV-2026-0731', amount: 1250000, vendor: 'Al-Rajhi Construction Group', po: 'PO-88231' }, { duplicate: false, nearest_similarity: 0.34 }, 210),
        eff('A1'),
        decide({ zh: '格式已标准化、无重复 → 移交验证合规 A2。', en: 'Standardized, no duplicate → hand off to Verification (A2).', ar: 'موحّد وبلا تكرار → التسليم إلى التحقق A2.' }, 'ok', true, { zh: '无重复 → 自动放行', en: 'no duplicate → auto-release', ar: 'بلا تكرار → تمرير تلقائي' })
      ]
    }
  ],
  conclusion: { text: { zh: 'OCR 提取 10 字段（98%），标准化并去重通过，移交 A2。', en: 'OCR extracted 10 fields (98%), normalized & dedup passed — handed to A2.', ar: 'استخراج 10 حقول (98٪)، توحيد ونجاح التكرار — سُلّم إلى A2.' }, confidence: 98, tone: 'ok', action: { zh: '移交验证合规 A2', en: 'Hand off to Verification (A2)', ar: 'التسليم إلى التحقق A2' } }
};

const ANOMALY_OK_BUNDLE = {
  title: { zh: 'A3 异常检测 · Agent 运行轨迹', en: 'A3 Anomaly · Agent Run-Trace', ar: 'A3 كشف الشذوذ · مسار الوكيل' },
  subtitle: { zh: 'Al-Rajhi 建设 INV-2026-0731 · 低风险', en: 'Al-Rajhi INV-2026-0731 · low risk', ar: 'الراجحي INV-2026-0731 · مخاطر منخفضة' },
  agentTag: 'A3',
  steps: [
    {
      agent: 'A3',
      title: { zh: '价格基准与供应商画像', en: 'Price benchmark & vendor profile', ar: 'معيار السعر وملف المورد' },
      handoff: { zh: '接收 A2 输出：三单匹配一致、税务合规', en: 'Received A2 output: 3-way match OK & tax-compliant', ar: 'استلام مخرجات A2: مطابقة صحيحة ومتوافقة' },
      blocks: [
        tool('vendor.price_benchmark', { category: 'construction', unit_price: 375 }, { benchmark_unit: 372, deviation_pct: 0.8, sample_size: 512 }, 300),
        tool('erp.get_vendor_profile', { vendor: 'Al-Rajhi Construction Group', cr: 'CR-1010-448120' }, { since_year: 2014, invoices_90d: 41, on_time_rate: 0.94, first_time: false }, 240),
        obs({ zh: '价格贴近基准（+0.8%），老供应商，90 天内 41 张、按时率 94%。', en: 'Price near benchmark (+0.8%); established vendor with 41 invoices in 90d, 94% on-time.', ar: 'السعر قرب المعيار (+0.8٪)؛ مورد راسخ بـ41 فاتورة و94٪ التزام.' }, 'ok'),
        conf(12, { zh: '风险评分 0-100', en: 'Risk score 0-100', ar: 'درجة 0-100' }, [
          { label: { zh: '价格偏离极小', en: 'Minimal price deviation', ar: 'انحراف ضئيل' }, points: 6 },
          { label: { zh: '供应商历史稳定', en: 'Stable vendor history', ar: 'سجل مستقر' }, points: 4 },
          { label: { zh: '金额非整数异常', en: 'Non-round amount', ar: 'مبلغ غير دائري' }, points: 2 }
        ]),
        eff('A3'),
        decide({ zh: '风险评分 12（低危），无欺诈特征 → 自动继续至审批路由。', en: 'Risk 12 (low), no fraud signals → auto-continue to routing.', ar: 'درجة 12 (منخفضة)، بلا احتيال → متابعة تلقائية للتوجيه.' }, 'ok', true, { zh: '风险 < 阈值 → 自动继续', en: 'risk < threshold → auto-continue', ar: 'مخاطر < الحد → متابعة تلقائية' })
      ]
    }
  ],
  conclusion: { text: { zh: '价格贴近基准，供应商稳定，风险评分 12（低），自动继续。', en: 'Price near benchmark, stable vendor, risk 12 (low) — auto-continue.', ar: 'السعر قرب المعيار، مورد مستقر، درجة 12 — متابعة تلقائية.' }, confidence: 88, tone: 'ok', action: { zh: '继续至审批路由 A4', en: 'Continue to routing (A4)', ar: 'المتابعة إلى التوجيه A4' } }
};

const ROUTE_OK_BUNDLE = {
  title: { zh: 'A4 审批路由 · Agent 运行轨迹', en: 'A4 Routing · Agent Run-Trace', ar: 'A4 التوجيه · مسار الوكيل' },
  subtitle: { zh: 'Al-Rajhi 建设 · 1.25M SAR · 三级链', en: 'Al-Rajhi · 1.25M SAR · 3-level chain', ar: 'الراجحي · 1.25M · 3 مستويات' },
  agentTag: 'A4',
  steps: [
    {
      agent: 'A4',
      title: { zh: '授权矩阵与审批链', en: 'Authorization matrix & chain', ar: 'مصفوفة التفويض والسلسلة' },
      handoff: { zh: '接收 A3 输出：风险评分 12（低危）', en: 'Received A3 output: risk score 12 (low)', ar: 'استلام مخرجات A3: درجة 12 (منخفضة)' },
      blocks: [
        think({ zh: '按金额与部门在授权矩阵中定位审批层级并生成审批卡片。', en: 'Locating the approval level in the authorization matrix by amount and department and generating the approval card.', ar: 'تحديد المستوى في مصفوفة التفويض وإنشاء بطاقة الموافقة.' }),
        tool('routing.match_authority', { amount: 1250000, department: 'Procurement' }, { chain_levels: 3, requires: ['Invoice Clerk', 'Finance Manager', 'Budget & Finance'] }, 190),
        obs({ zh: '金额触发三级审批链，风险低且完全匹配。', en: 'Amount triggers a 3-level chain; risk is low with a full match.', ar: 'المبلغ يطلق سلسلة من 3 مستويات؛ مخاطر منخفضة ومطابقة كاملة.' }, 'ok'),
        eff('A4'),
        decide({ zh: 'AI 建议批准；推送人工确认（HITL）。', en: 'AI recommends approve; pushed to human confirm (HITL).', ar: 'يوصي الذكاء بالموافقة؛ أُرسل للتأكيد البشري (HITL).' }, 'ok', false, { zh: '低风险 → 人工确认', en: 'low risk → human confirm', ar: 'مخاطر منخفضة → تأكيد بشري' })
      ]
    }
  ],
  conclusion: { text: { zh: '三级审批链已分发，AI 建议批准，等待人工确认。', en: '3-level chain dispatched; AI recommends approve, awaiting human confirm.', ar: 'توزيع سلسلة من 3 مستويات؛ يوصي الذكاء بالموافقة بانتظار التأكيد.' }, confidence: 95, tone: 'ok', action: { zh: '推送人工确认（HITL）', en: 'Push to human confirm (HITL)', ar: 'الدفع للتأكيد البشري (HITL)' } }
};

const FORECAST_OK_BUNDLE = {
  title: { zh: 'A5 催收预测 · Agent 运行轨迹', en: 'A5 Forecasting · Agent Run-Trace', ar: 'A5 التنبؤ · مسار الوكيل' },
  subtitle: { zh: 'INV-2026-0731 · 结算周期建模', en: 'INV-2026-0731 · settlement modeling', ar: 'INV-2026-0731 · نمذجة التسوية' },
  agentTag: 'A5',
  steps: [
    {
      agent: 'A5',
      title: { zh: '结算周期与回收概率', en: 'Settlement cycle & recovery prob.', ar: 'دورة التسوية واحتمال التحصيل' },
      handoff: { zh: '接收 A4 输出：待人工审批', en: 'Received A4 output: pending approval', ar: 'استلام مخرجات A4: بانتظار الموافقة' },
      blocks: [
        think({ zh: '基于合同账期与供应商历史，预测结算时点与回收概率。', en: 'Modeling settlement timing and recovery probability from contract terms and vendor history.', ar: 'أنمذج توقيت التسوية والاحتمال من شروط العقد وتاريخ المورد.' }),
        tool('forecast.collection_probability', { invoice: 'INV-2026-0731', overdue_days: 0, segment: 'construction' }, { probability: 0.95, expected_settlement_days: 42, litigation: 'none' }, 320),
        chart('collectionCurve', { labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'], values: [80, 84, 88, 91, 93, 95] }),
        eff('A5'),
        decide({ zh: '回收概率 95%，结算周期正常 → 无需干预，进入分析归档。', en: 'Recovery 95%, normal settlement → no intervention, proceed to analytics.', ar: 'الاحتمال 95٪، تسوية طبيعية → دون تدخل، إلى التحليلات.' }, 'ok', true, { zh: '概率 ≥ 75% → 自动流转', en: 'prob ≥ 75% → auto flow', ar: 'الاحتمال ≥ 75٪ → تدفق تلقائي' })
      ]
    }
  ],
  conclusion: { text: { zh: '回收概率 95%，预计 42 天内结算，无需人工干预。', en: 'Recovery probability 95%, settlement in ~42 days, no intervention needed.', ar: 'الاحتمال 95٪، التسوية خلال ~42 يوماً، دون تدخل.' }, confidence: 95, tone: 'ok', action: { zh: '进入分析归档 A6', en: 'Proceed to analytics (A6)', ar: 'المتابعة إلى التحليلات A6' } }
};

const ANALYTICS_BUNDLE = {
  title: { zh: 'A6 分析归档 · Agent 运行轨迹', en: 'A6 Analytics · Agent Run-Trace', ar: 'A6 التحليلات · مسار الوكيل' },
  subtitle: { zh: 'KPI 汇总 · 审计留痕', en: 'KPI aggregation · audit trail', ar: 'تجميع المؤشرات · سجل التدقيق' },
  agentTag: 'A6',
  steps: [
    {
      agent: 'A6',
      title: { zh: 'KPI 汇总与审计留痕', en: 'KPI aggregation & audit trail', ar: 'تجميع المؤشرات وسجل التدقيق' },
      handoff: { zh: '接收 A5 输出：结算周期正常', en: 'Received A5 output: normal settlement', ar: 'استلام مخرجات A5: تسوية طبيعية' },
      blocks: [
        tool('analytics.aggregate_kpis', { invoice: 'INV-2026-0731' }, { kpis_updated: 6, ledger: 'posted', audit_hash: '0x7f3a9c21', immutable: true }, 230),
        eff('A6'),
        decide({ zh: '6 项 KPI 已更新，审计留痕已写入不可变账本 → 流程闭环。', en: '6 KPIs updated, audit trail written to the immutable ledger → loop closed.', ar: 'تحديث 6 مؤشرات وكتابة سجل التدقيق في دفتر ثابت → إغلاق الحلقة.' }, 'ok', true, { zh: '全链路完成 → 自动归档', en: 'chain complete → auto-archive', ar: 'اكتمال السلسلة → أرشفة تلقائية' })
      ]
    }
  ],
  conclusion: { text: { zh: '6 项 KPI 已更新，审计留痕写入不可变账本，全链路闭环。', en: '6 KPIs updated, audit trail on the immutable ledger — full-chain loop closed.', ar: 'تحديث 6 مؤشرات وسجل تدقيق ثابت — إغلاق كامل للحلقة.' }, confidence: 99, tone: 'ok', action: { zh: '归档完成', en: 'Archived', ar: 'تمت الأرشفة' } }
};

// Which node the scenario stalls at (0-based). null = runs the full chain.
export const SCENARIO_STALL = { normal: null, fraud: 2, dup: 0, taxfail: 1 };

// Pending action / why-blocked label for the stalled node.
export const SCENARIO_PENDING = {
  fraud: { zh: '欺诈风险评分 82，等待审计师人工复核', en: 'Fraud risk score 82 — awaiting auditor manual review', ar: 'درجة احتيال 82 — بانتظار مراجعة المدقق' },
  dup: { zh: '检测到重复发票，已拦截，等待人工确认', en: 'Duplicate invoice detected, blocked — awaiting human confirm', ar: 'تم اكتشاف فاتورة مكررة، محظورة — بانتظار التأكيد' },
  taxfail: { zh: '税务/匹配置信度 68% < 75%，转合规人工复核', en: 'Tax/match confidence 68% < 75% — referred to compliance', ar: 'ثقة 68٪ < 75٪ — محال للامتثال' }
};

/* ================================================================ A2 verify
   Rich typed-block trace: pull source records → 3-way match table → ZATCA
   VAT recompute (+chart) → cross-platform match & weighted confidence →
   efficiency + HITL decision. */
function verifyBundle(scenario) {
  const fail = scenario === 'taxfail';
  const rc = {
    normal: { inv: 'INV-2026-0731', po: 'PO-88231', grn: 'GRN-2026-4471', taxId: '3001234567800003' },
    fraud: { inv: 'INV-2026-0730', po: 'PO-88192', grn: 'GRN-2026-4460', taxId: '3009988776600001' },
    taxfail: { inv: 'INV-2026-0727', po: 'PO-87990', grn: 'GRN-2026-4402', taxId: '3005566778800002' }
  }[scenario] || {};
  const score = fail ? 68 : 97;
  const vat = fail
    ? { declared: 472800, computed: 477000, expected: 477000 }
    : (scenario === 'fraud' ? { declared: 72900, computed: 72900, expected: 72900 } : { declared: 187500, computed: 187500, expected: 187500 });

  return {
    title: { zh: 'A2 验证合规 · Agent 运行轨迹', en: 'A2 Verification · Agent Run-Trace', ar: 'A2 التحقق · مسار تشغيل الوكيل' },
    subtitle: { zh: '三单匹配 · ZATCA 税务校验 · Makin↔Tahseel 对账', en: '3-way match · ZATCA check · Makin↔Tahseel reconciliation', ar: 'مطابقة ثلاثية · فحص ZATCA · تسوية' },
    agentTag: 'A2',
    steps: [
      {
        agent: 'A2',
        title: { zh: '拉取源单据（PO / 实收 / 合同）', en: 'Pull source records (PO / GRN / contract)', ar: 'سحب المستندات المصدرية' },
        blocks: [
          think({ zh: '已接收 A1 标准化发票，正在从 ERP 拉取采购单、实收单与合同以执行三单匹配。', en: 'Received standardized invoice from A1; fetching PO, goods-receipt and contract to run a 3-way match.', ar: 'استلمت الفاتورة الموحدة من A1؛ أجلب أمر الشراء والاستلام والعقد لإجراء مطابقة ثلاثية.' }),
          tool('erp.get_purchase_order', { po: rc.po, invoice: rc.inv }, { po: rc.po, lines: scenario === 'taxfail' ? 3 : (scenario === 'fraud' ? 2 : 3), status: 'released', grn_ref: rc.grn }, 300),
          tool('sanad.lookup_contract', { contract: scenario === 'fraud' ? 'SANAD-CT-7715' : (scenario === 'taxfail' ? 'SANAD-CT-2799' : 'SANAD-CT-2231') }, { active: true, benchmark_source: 'framework_price_list', currency: 'SAR' }, 240),
          obs({ zh: `已获取采购单 ${rc.po}、实收单 ${rc.grn} 与框架合同。`, en: `Retrieved PO ${rc.po}, goods-receipt ${rc.grn} and the framework contract.`, ar: `تم جلب أمر الشراء ${rc.po} والاستلام ${rc.grn} والعقد الإطاري.` })
        ]
      },
      {
        agent: 'A2',
        title: { zh: '三单匹配（账单 vs PO vs 实收）', en: '3-way match (Invoice vs PO vs Goods-Receipt)', ar: 'المطابقة الثلاثية' },
        blocks: [
          recon(scenario, 0.02),
          obs(
            fail
              ? { zh: '第 1 行单价与 PO 不一致（180,000 vs 173,750），行金额差异使总额偏离 +2.4%。', en: 'Line 1 unit price differs from PO (180,000 vs 173,750); line-total variance pushes the total +2.4%.', ar: 'سعر البند 1 يختلف عن PO (180,000 مقابل 173,750)؛ الفرق يرفع الإجمالي +2.4٪.' }
              : { zh: '全部行项数量与单价均在容差内匹配。', en: 'All line quantities and unit prices match within tolerance.', ar: 'جميع الكميات وأسعار الوحدات مطابقة ضمن الحد المسموح.' },
            fail ? 'danger' : 'ok'
          )
        ]
      },
      {
        agent: 'A2',
        title: { zh: 'ZATCA 税务校验与 VAT 复算', en: 'ZATCA tax check & VAT recompute', ar: 'فحص ZATCA وإعادة حساب الضريبة' },
        blocks: [
          tool('zatca.validate_vat', { tax_id: rc.taxId, amount: vat.declared, rate: 15 }, { tax_id_valid: !fail, recomputed_vat: vat.computed, declared_vat: vat.declared, variance: vat.expected - vat.declared }, 280),
          chart('vatVariance', vat),
          obs(
            fail
              ? { zh: 'ZATCA 税号校验失败（校验位不符），申报 VAT 与应缴相差 4,200 SAR。', en: 'ZATCA tax-ID failed (check-digit mismatch); declared VAT is off by 4,200 SAR.', ar: 'فشل الرقم الضريبي (خطأ رقم التحقق)؛ الضريبة المُقرّة تنحرف بـ4,200 ر.س.' }
              : { zh: '税号有效，VAT 15% 复算与申报一致。', en: 'Tax-ID valid; VAT 15% recompute matches the declared amount.', ar: 'الرقم صالح؛ إعادة حساب الضريبة 15٪ مطابقة للمُقرّ.' },
            fail ? 'danger' : 'ok'
          )
        ]
      },
      {
        agent: 'A2',
        title: { zh: '跨平台对账与置信度', en: 'Cross-platform reconciliation & confidence', ar: 'التسوية والثقة' },
        blocks: [
          tool('graph.match_3way', { invoice: rc.inv, po: rc.po, grn: rc.grn }, { qty_match: true, price_match: !fail, tax_valid: !fail, reconciliation_gap_sar: fail ? 75000 : 0, match_confidence: score }, 360),
          conf(score, { zh: '匹配置信度', en: 'Match confidence', ar: 'ثقة المطابقة' }, fail
            ? [
                { label: { zh: '数量/实收匹配', en: 'Qty & GRN match', ar: 'مطابقة الكمية والاستلام' }, points: 40 },
                { label: { zh: '行金额大体一致', en: 'Line totals mostly consistent', ar: 'الإجماليات متسقة جزئياً' }, points: 18 },
                { label: { zh: '单价不匹配', en: 'Unit price mismatch', ar: 'عدم تطابق سعر الوحدة' }, points: 6 },
                { label: { zh: '税号校验失败', en: 'Tax-ID failed', ar: 'فشل الرقم الضريبي' }, points: 4 }
              ]
            : [
                { label: { zh: '数量/实收匹配', en: 'Qty & GRN match', ar: 'مطابقة الكمية والاستلام' }, points: 40 },
                { label: { zh: '单价匹配', en: 'Unit price match', ar: 'مطابقة سعر الوحدة' }, points: 32 },
                { label: { zh: '税号有效', en: 'Tax-ID valid', ar: 'الرقم الضريبي صالح' }, points: 15 },
                { label: { zh: '对账无差异', en: 'No reconciliation gap', ar: 'لا فجوة تسوية' }, points: 10 }
              ]),
          eff('A2'),
          fail
            ? decide({ zh: '匹配置信度 68% < 75% 且税号失败 → 移交合规人工复核。', en: 'Match confidence 68% < 75% and tax-ID failed → refer to compliance for human review.', ar: 'الثقة 68٪ < 75٪ وفشل الرقم → إحالة للامتثال للمراجعة البشرية.' }, 'danger', false, { zh: '置信度 < 75% → 人工复核', en: 'confidence < 75% → human review', ar: 'الثقة < 75٪ → مراجعة بشرية' })
            : decide({ zh: '三单匹配一致、税务合规 → 自动放行至审批路由 A4。', en: 'All matched & tax-compliant → auto-release to approval routing (A4).', ar: 'الكل مطابق ومتوافق → تمرير تلقائي للتوجيه A4.' }, 'ok', true, { zh: '置信度 ≥ 75% → 自动放行', en: 'confidence ≥ 75% → auto-release', ar: 'الثقة ≥ 75٪ → تمرير تلقائي' })
        ]
      }
    ],
    conclusion: fail
      ? { text: { zh: '匹配置信度 68% < 75%，税号校验失败，转合规人工复核。', en: 'Match confidence 68% < 75% and tax-ID failed — referred to compliance review.', ar: 'ثقة 68٪ < 75٪ وفشل الرقم الضريبي — محال للامتثال.' }, confidence: 68, tone: 'danger', action: { zh: '人工复核税号并补正 PO 差异', en: 'Human to verify tax-ID and correct PO discrepancy', ar: 'التحقق اليدوي من الرقم وتصحيح الفرق' } }
      : { text: { zh: '三单匹配一致，税务合规，跨平台对账无差异。', en: 'All matched, tax-compliant, no reconciliation gaps.', ar: 'الكل مطابق ومتوافق ولا فجوات تسوية.' }, confidence: 97, tone: 'ok', action: { zh: '放行至审批路由 A4', en: 'Release to approval routing (A4)', ar: 'التمرير إلى التوجيه A4' } }
  };
}

/* A1 dedup drawer (duplicate scenario). */
const DEDUP_BUNDLE = {
  title: { zh: 'A1 摄取去重 · Agent 运行轨迹', en: 'A1 Dedup · Agent Run-Trace', ar: 'A1 كشف التكرار · مسار الوكيل' },
  subtitle: { zh: '四元组指纹比对拦截重复付款', en: 'Tuple-fingerprint match blocks double payment', ar: 'مطابقة البصمة تمنع الدفع المزدوج' },
  agentTag: 'A1',
  steps: [
    {
      agent: 'A1',
      title: { zh: '生成指纹并检索历史库', en: 'Build fingerprint & search history', ar: 'بناء البصمة والبحث في السجل' },
      blocks: [
        think({ zh: '对 (发票号, 金额, 供应商, PO) 生成指纹，检索 90 天历史账单库。', en: 'Hashing (invoice, amount, vendor, PO) into a fingerprint and searching the 90-day history store.', ar: 'تجزئة (فاتورة، مبلغ، مورد، PO) في بصمة والبحث في سجل 90 يوماً.' }),
        tool('dedup.fingerprint_search', { invoice: 'INV-2026-0728', amount: 1250000, vendor: 'Gulf Facility Mgmt', po: 'PO-88231' }, { duplicate: true, duplicate_of: 'INV-2026-0731', similarity: 1.0, matched_fields: ['amount', 'vendor', 'po', 'grn'] }, 210),
        obs({ zh: '四元组与 INV-2026-0731 完全一致，判定为重复账单。', en: 'Tuple is an exact match with INV-2026-0731 → duplicate invoice.', ar: 'البصمة تطابق INV-2026-0731 تماماً → فاتورة مكررة.' }, 'danger')
      ]
    },
    {
      agent: 'A1',
      title: { zh: '命中重复 · 自动拦截', en: 'Duplicate hit · auto-blocked', ar: 'تطابق مكرر · حظر تلقائي' },
      blocked: true,
      blocks: [
        evid([
          { source: 'Tahseel · INV-2026-0731', detail: { zh: '原始账单：金额 1,250,000 SAR，PO-88231，实收单 GRN-2026-4471 — 与当前账单四字段一致。', en: 'Original invoice: amount 1,250,000 SAR, PO-88231, GRN-2026-4471 — identical on all four fields.', ar: 'الفاتورة الأصلية: 1,250,000 ر.س، PO-88231، GRN-2026-4471 — متطابقة في الحقول الأربعة.' }, tone: 'danger' }
        ]),
        eff('A1'),
        decide({ zh: '已自动拦截重复付款，为部委规避 1,250,000 SAR 损失，等待人工确认后归档。', en: 'Auto-blocked the double payment, avoiding a 1,250,000 SAR loss — awaiting human confirm to archive.', ar: 'تم حظر الدفع المزدوج تلقائياً، تجنب خسارة 1,250,000 ر.س — بانتظار التأكيد للأرشفة.' }, 'warn', false, { zh: '重复指纹命中 → 拦截并转人工确认', en: 'duplicate fingerprint → block & route to human confirm', ar: 'بصمة مكررة → حظر وإحالة للتأكيد' })
      ]
    }
  ],
  conclusion: { text: { zh: '已拦截重复付款，为部委节省 1,250,000 SAR，等待人工确认。', en: 'Blocked double payment, saved 1,250,000 SAR — awaiting human confirm.', ar: 'حُظر الدفع المزدوج، توفير 1,250,000 — بانتظار التأكيد.' }, tone: 'warn', action: { zh: '人工确认后归档，无需进入后续流程', en: 'Archive after human confirm; no further processing', ar: 'الأرشفة بعد التأكيد؛ لا معالجة إضافية' } }
};

/* A3 risk drawer (fraud scenario, node in pipeline). */
const PIPE_RISK_BUNDLE = {
  title: { zh: 'A3 异常检测 · Agent 运行轨迹', en: 'A3 Anomaly · Agent Run-Trace', ar: 'A3 كشف الشذوذ · مسار الوكيل' },
  subtitle: { zh: 'NEOM 物流 INV-2026-0730 · 价格与供应商画像', en: 'NEOM Logistics INV-2026-0730 · price & vendor profile', ar: 'NEOM · السعر وملف المورد' },
  agentTag: 'A3',
  steps: [
    {
      agent: 'A3',
      title: { zh: '供应商画像与价格基准', en: 'Vendor profile & price benchmark', ar: 'ملف المورد ومعيار السعر' },
      handoff: { zh: '接收 A2 输出：三单匹配通过、税务合规', en: 'Received A2 output: 3-way match OK & tax-compliant', ar: 'استلام مخرجات A2: مطابقة صحيحة ومتوافقة' },
      blocks: [
        think({ zh: 'A2 匹配通过但价格待核。查询同品类基准价与供应商 90 天历史。', en: 'A2 match passed but price needs review. Querying category benchmark and the vendor 90-day history.', ar: 'اجتازت A2 لكن السعر يحتاج مراجعة. أستعلم عن معيار الفئة وتاريخ المورد 90 يوماً.' }),
        tool('vendor.price_benchmark', { category: 'heavy_transport', unit_price: 3200 }, { benchmark_unit: 2320, deviation_pct: 37.9, sample_size: 214, currency: 'SAR' }, 320),
        tool('erp.get_vendor_profile', { vendor: 'NEOM Logistics', cr: 'CR-7010-990015' }, { since_year: 2026, invoices_90d: 0, first_time: true, on_time_rate: null }, 260),
        obs({ zh: '单价高于基准 +38%；供应商 90 天内无历史，为首次交易。', en: 'Unit price +38% over benchmark; vendor has no 90-day history — first-time deal.', ar: 'السعر +38٪ فوق المعيار؛ لا تاريخ للمورد خلال 90 يوماً — أول تعامل.' }, 'danger')
      ]
    },
    {
      agent: 'A3',
      title: { zh: '价格 vs 基准与证据', en: 'Price vs benchmark & evidence', ar: 'السعر مقابل المعيار والأدلة' },
      blocks: [
        chart('priceBench', { labels: [{ zh: '重型运输', en: 'Heavy transport', ar: 'نقل ثقيل' }], invoice: [3200], benchmark: [2320] }),
        evid([
          { source: 'Sanad · SANAD-CT-7715', detail: { zh: '合同基准价 2,320 SAR/车次；本单 INV-2026-0730 单价 3,200 SAR（+37.9%）。', en: 'Contract benchmark 2,320 SAR/trip; this invoice INV-2026-0730 unit_price 3,200 SAR (+37.9%).', ar: 'معيار العقد 2,320 ر.س/رحلة؛ هذه الفاتورة 3,200 ر.س (+37.9٪).' }, tone: 'danger' }
        ])
      ]
    },
    {
      agent: 'A3',
      title: { zh: '欺诈评分拆解', en: 'Fraud-score breakdown', ar: 'تفصيل درجة الاحتيال' },
      blocks: [
        tool('ml.fraud_score', { features: { price_deviation: 0.379, first_time_vendor: true, round_amount: true } }, { score: 82, band: 'high', top_factor: 'price_deviation' }, 300),
        chart('factorBar', { labels: [{ zh: '价格偏离', en: 'Price deviation', ar: 'انحراف السعر' }, { zh: '首次交易', en: 'First-time vendor', ar: 'مورد لأول مرة' }, { zh: '整数金额', en: 'Round amount', ar: 'مبلغ دائري' }], values: [38, 26, 18], max: 100 }),
        conf(82, { zh: '风险评分 0-100', en: 'Risk score 0-100', ar: 'درجة 0-100' }, [
          { label: { zh: '价格偏离 (权重 0.45)', en: 'Price deviation (w 0.45)', ar: 'انحراف السعر (0.45)' }, points: 38 },
          { label: { zh: '首次交易 (权重 0.30)', en: 'First-time vendor (w 0.30)', ar: 'مورد جديد (0.30)' }, points: 26 },
          { label: { zh: '整数金额 (权重 0.25)', en: 'Round amount (w 0.25)', ar: 'مبلغ دائري (0.25)' }, points: 18 }
        ]),
        eff('A3'),
        decide({ zh: '风险评分 82（高危），决策置信度 71% < 75% → 暂停自动付款，移交审计师复核。', en: 'Risk 82 (high), decision confidence 71% < 75% → pause auto-payment and refer to auditor.', ar: 'درجة 82 (عالية)، ثقة القرار 71٪ < 75٪ → إيقاف الدفع وإحالة للمدقق.' }, 'danger', false, { zh: '置信度 < 75% → 审计师人工复核', en: 'confidence < 75% → auditor review', ar: 'الثقة < 75٪ → مراجعة المدقق' })
      ]
    }
  ],
  conclusion: { text: { zh: '风险评分 82（高危），置信度 71% < 75%，触发 HITL，转审计师复核。', en: 'Risk 82 (high), confidence 71% < 75%, HITL triggered — referred to auditor.', ar: 'درجة 82 (عالية)، ثقة 71٪ < 75٪، تفعيل HITL — للمدقق.' }, confidence: 82, tone: 'danger', action: { zh: '暂停自动付款，转人工复核', en: 'Pause auto-payment; manual review', ar: 'إيقاف الدفع؛ مراجعة يدوية' } }
};

// Per-scenario node drawers: which agent nodes expose "view AI analysis".
export const NODE_DRAWERS = {
  normal: {
    A1: INGEST_OK_BUNDLE,
    A2: verifyBundle('normal'),
    A3: ANOMALY_OK_BUNDLE,
    A4: ROUTE_OK_BUNDLE,
    A5: FORECAST_OK_BUNDLE,
    A6: ANALYTICS_BUNDLE
  },
  fraud: { A1: INGEST_OK_BUNDLE, A2: verifyBundle('fraud'), A3: PIPE_RISK_BUNDLE },
  dup: { A1: DEDUP_BUNDLE },
  taxfail: { A1: INGEST_OK_BUNDLE, A2: verifyBundle('taxfail') }
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
      {
        agent: 'A3',
        title: { zh: '高频提交与阈值规避', en: 'High-frequency & threshold evasion', ar: 'تكرار وتجاوز الحد' },
        blocks: [
          think({ zh: '检测到同一供应商短期高频提交，检索关联账单。', en: 'Detected high-frequency submissions from one vendor; retrieving related invoices.', ar: 'رصدت تقديمات متكررة من مورد واحد؛ أجلب الفواتير المرتبطة.' }),
          tool('graph.match_3way', { vendor: 'Desert Rose Trading', window_days: 7 }, { related_invoices: 5, each_amount: 998000, threshold: 1000000, gap_pct: 0.2 }, 300),
          obs({ zh: '7 天内 5 张均为 998K SAR，均低于 100 万审批阈值 0.2%，疑似拆单。', en: '5 invoices of 998K SAR each in 7 days, all 0.2% below the 1M approval threshold — suspected splitting.', ar: '5 فواتير 998K خلال 7 أيام، الكل تحت الحد بـ0.2٪ — يُشتبه بالتقسيم.' }, 'danger'),
          conf(74, { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' }, [
            { label: { zh: '阈值规避', en: 'Threshold evasion', ar: 'تجاوز الحد' }, points: 44 },
            { label: { zh: '短期高频', en: 'High frequency', ar: 'تكرار مرتفع' }, points: 30 }
          ]),
          decide({ zh: '疑似拆单规避审批，标记待审计师合并核查。', en: 'Suspected invoice-splitting to evade approval; flagged for auditor to audit together.', ar: 'يُشتبه بالتقسيم؛ موسوم للمدقق للفحص المجمّع.' }, 'danger', false, { zh: '拆单模式 → 审计师复核', en: 'splitting pattern → auditor review', ar: 'نمط تقسيم → مراجعة المدقق' })
        ]
      }
    ],
    conclusion: { text: { zh: '疑似拆单规避审批，风险评分 74，标记待审计师核查。', en: 'Suspected invoice-splitting to evade approval; risk 74, flagged for auditor.', ar: 'يُشتبه بالتقسيم؛ درجة 74، موسوم للمدقق.' }, confidence: 74, tone: 'danger', action: { zh: '合并审计 5 张关联账单', en: 'Audit the 5 related invoices together', ar: 'تدقيق الفواتير الخمس معاً' } }
  },
  'INV-2026-0688': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'Falcon 工程 · 风险评分 58', en: 'Falcon Engineering · risk score 58', ar: 'فالكون · درجة 58' },
    agentTag: 'A3',
    steps: [
      {
        agent: 'A3',
        title: { zh: '主体一致性核查', en: 'Entity consistency check', ar: 'فحص اتساق الكيان' },
        blocks: [
          tool('sanad.lookup_contract', { vat: '3007788990000004' }, { vat_owner: 'Falcon Engineering Ltd', contract_signatory: 'Falcon Holdings', match: false }, 260),
          obs({ zh: 'VAT 号归属主体与 Makin 合同签约主体不一致。', en: 'VAT owner differs from the Makin contract signatory.', ar: 'مالك الرقم يختلف عن موقّع العقد.' }, 'warn'),
          conf(58, { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' }, [
            { label: { zh: '主体不一致', en: 'Entity mismatch', ar: 'عدم تطابق الكيان' }, points: 38 },
            { label: { zh: '无关联映射', en: 'No affiliation mapping', ar: 'لا ربط انتماء' }, points: 20 }
          ]),
          decide({ zh: '税号与合同主体不一致，转合规复核关联关系。', en: 'VAT-contract entity mismatch; referred to compliance to verify affiliation.', ar: 'عدم تطابق؛ محال للامتثال للتحقق من العلاقة.' }, 'warn', false, { zh: '主体不一致 → 合规复核', en: 'entity mismatch → compliance', ar: 'عدم تطابق → الامتثال' })
        ]
      }
    ],
    conclusion: { text: { zh: '税号与合同主体不一致，风险评分 58，转合规复核。', en: 'VAT-contract entity mismatch; risk 58, referred to compliance.', ar: 'عدم تطابق؛ درجة 58، محال للامتثال.' }, confidence: 58, tone: 'warn', action: { zh: '核实关联关系或退回补正', en: 'Verify affiliation or return for correction', ar: 'التحقق أو الإرجاع للتصحيح' } }
  },
  'INV-2026-0655': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'Oasis 服务 · 风险评分 41', en: 'Oasis Services · risk score 41', ar: 'واحة · درجة 41' },
    agentTag: 'A3',
    steps: [
      {
        agent: 'A3',
        title: { zh: '账期偏离分析', en: 'Payment-term deviation', ar: 'انحراف مدة السداد' },
        blocks: [
          tool('sanad.lookup_contract', { contract: 'SANAD-CT-2655' }, { agreed_term_days: 60, invoice_demand_days: 7 }, 240),
          obs({ zh: '合同约定账期 60 天，本单要求 7 天内付款。', en: 'Contract term is 60 days but the invoice demands payment within 7.', ar: 'مدة العقد 60 يوماً لكن الطلب خلال 7.' }, 'warn'),
          conf(41, { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' }, [
            { label: { zh: '账期异常缩短', en: 'Term abnormally short', ar: 'مدة قصيرة غير طبيعية' }, points: 41 }
          ]),
          decide({ zh: '付款周期异常缩短，提示财务经理按合同账期付款，勿加速。', en: 'Abnormally short term; flag finance manager to pay per contract term, not accelerate.', ar: 'مدة قصيرة؛ تنبيه المدير المالي للدفع وفق العقد دون تسريع.' }, 'warn', false, { zh: '账期偏离 → 财务经理关注', en: 'term deviation → finance manager', ar: 'انحراف المدة → المدير المالي' })
        ]
      }
    ],
    conclusion: { text: { zh: '付款周期异常缩短，风险评分 41，提示财务经理关注。', en: 'Abnormally short term; risk 41, flagged for finance manager.', ar: 'مدة قصيرة؛ درجة 41، تنبيه للمدير المالي.' }, confidence: 41, tone: 'warn', action: { zh: '按合同账期付款，勿加速', en: 'Pay per contract term; do not accelerate', ar: 'الدفع وفق العقد؛ دون تسريع' } }
  }
};

/* ---------------------------------------------------------------- A4 Approvals */
function approvalBundle(sub, amount, chainLevels, requires, matchConf, tone, auto, gateRule, recText, actionText, extra = []) {
  return {
    title: { zh: 'A4 审批路由 · Agent 运行轨迹', en: 'A4 Routing · Agent Run-Trace', ar: 'A4 التوجيه · مسار الوكيل' },
    subtitle: sub,
    agentTag: 'A4',
    steps: [
      {
        agent: 'A4',
        title: { zh: '授权矩阵匹配', en: 'Authorization-matrix match', ar: 'مطابقة مصفوفة التفويض' },
        blocks: [
          think({ zh: '按金额与部门在授权矩阵中定位审批层级。', en: 'Locating the approval level in the authorization matrix by amount and department.', ar: 'تحديد مستوى الموافقة في مصفوفة التفويض حسب المبلغ والقسم.' }),
          tool('routing.match_authority', { amount, department: 'Procurement' }, { chain_levels: chainLevels, requires }, 200),
          obs({ zh: `金额触发 ${chainLevels} 级审批链，需 ${requires.join(' / ')}。`, en: `Amount triggers a ${chainLevels}-level chain, requiring ${requires.join(' / ')}.`, ar: `المبلغ يطلق سلسلة ${chainLevels} مستويات، تتطلب ${requires.join(' / ')}.` })
        ]
      },
      {
        agent: 'A4',
        title: { zh: '风险 / 匹配 / SLA 依据', en: 'Risk / match / SLA basis', ar: 'المخاطر / المطابقة / SLA' },
        blocks: [
          ...extra,
          conf(matchConf, { zh: '建议置信度', en: 'Recommendation confidence', ar: 'ثقة التوصية' }, [
            { label: { zh: '匹配结果', en: 'Match result', ar: 'نتيجة المطابقة' }, points: Math.round(matchConf * 0.6) },
            { label: { zh: '风险与合规', en: 'Risk & compliance', ar: 'المخاطر والامتثال' }, points: matchConf - Math.round(matchConf * 0.6) }
          ]),
          eff('A4'),
          decide(recText, tone, auto, gateRule)
        ]
      }
    ],
    conclusion: { text: recText, confidence: matchConf, tone, action: actionText }
  };
}

export const APPROVAL_BASIS = {
  'INV-2026-0727': approvalBundle(
    { zh: 'Aramco 后勤 · 3.18M SAR', en: 'Aramco Logistics · 3.18M SAR', ar: 'Aramco · 3.18M' },
    3180000, 6, ['Center Director', 'CFO'], 62, 'warn', false,
    { zh: '置信度 62% < 75% → 人工决策', en: 'confidence 62% < 75% → human decides', ar: 'الثقة 62٪ < 75٪ → قرار بشري' },
    { zh: 'AI 建议：退回补正税号/PO 差异后再审批。人工做最终决策。', en: 'AI recommends: return for tax/PO correction before approval. Human decides.', ar: 'يوصي الذكاء: الإرجاع للتصحيح قبل الموافقة. القرار للبشر.' },
    { zh: '退回 / 升级 / 批准（人工选择）', en: 'Return / Escalate / Approve (human choice)', ar: 'إرجاع / تصعيد / موافقة' },
    [tool('sla.check', { invoice: 'INV-2026-0727', sla_hours: 4 }, { elapsed_hours: 12, overrun: true, escalated_to: 'Center Director' }, 180),
      evid([{ source: 'A2 · match_confidence', detail: { zh: '上游匹配置信度 68%，单价与 PO 差异导致总额 +2.4%，税号校验失败。', en: 'Upstream match confidence 68%; unit-price vs PO gap drives total +2.4%, tax-ID failed.', ar: 'ثقة المطابقة 68٪؛ فرق السعر يرفع الإجمالي +2.4٪، وفشل الرقم الضريبي.' }, tone: 'danger' }])]
  ),
  'INV-2026-0724': approvalBundle(
    { zh: 'Bahri 海运物流 · 2.26M SAR', en: 'Bahri Maritime · 2.26M SAR', ar: 'البحري · 2.26M' },
    2260000, 4, ['Center Director'], 90, 'ok', false,
    { zh: '置信度 90% ≥ 75%，低风险 → 人工确认即可', en: 'confidence 90% ≥ 75%, low risk → human confirm', ar: 'الثقة 90٪ ≥ 75٪، مخاطر منخفضة → تأكيد بشري' },
    { zh: 'AI 建议：批准。匹配完整、风险低。人工确认即可。', en: 'AI recommends: approve. Full match, low risk. Human to confirm.', ar: 'يوصي الذكاء: الموافقة. مطابقة كاملة ومخاطر منخفضة.' },
    { zh: '批准付款', en: 'Approve payment', ar: 'الموافقة على الدفع' },
    [obs({ zh: '三单完全匹配，风险评分 33（中低），无异常触发。', en: 'Full 3-way match, risk 33 (low-mid), no anomaly.', ar: 'مطابقة كاملة، درجة 33، لا شذوذ.' }, 'ok')]
  ),
  'INV-2026-0731': approvalBundle(
    { zh: 'Al-Rajhi 建设 · 1.25M SAR', en: 'Al-Rajhi Construction · 1.25M SAR', ar: 'الراجحي · 1.25M' },
    1250000, 3, ['Budget & Finance'], 95, 'ok', false,
    { zh: '置信度 95% ≥ 75%，低风险且合规 → 人工确认即可', en: 'confidence 95% ≥ 75%, low risk & compliant → human confirm', ar: 'الثقة 95٪ ≥ 75٪، متوافق → تأكيد بشري' },
    { zh: 'AI 建议：批准。低风险且合规。人工做最终决策。', en: 'AI recommends: approve. Low risk & compliant. Human decides.', ar: 'يوصي الذكاء: الموافقة. مخاطر منخفضة ومتوافق.' },
    { zh: '批准付款', en: 'Approve payment', ar: 'الموافقة على الدفع' },
    [obs({ zh: '三单完全匹配，风险评分 12（低），税务合规。', en: 'Full match, risk 12 (low), tax compliant.', ar: 'مطابقة كاملة، درجة 12، متوافق.' }, 'ok')]
  )
};

/* ---------------------------------------------------------------- A5 Forecast */
function forecastBundle(sub, prob, segment, overdue, litigation, curve, factors, tone, auto, gateRule, action) {
  return {
    title: { zh: 'A5 催收预测 · Agent 运行轨迹', en: 'A5 Forecasting · Agent Run-Trace', ar: 'A5 التنبؤ · مسار الوكيل' },
    subtitle: sub,
    agentTag: 'A5',
    steps: [
      {
        agent: 'A5',
        title: { zh: '回收概率建模', en: 'Recovery-probability modeling', ar: 'نمذجة احتمال التحصيل' },
        blocks: [
          think({ zh: '结合细分历史收缴率、逾期天数、诉讼状态与宏观指标预测回收概率。', en: 'Combining segment collection rate, overdue days, litigation status and macro indicators to predict recovery.', ar: 'أجمع معدل الفئة وأيام التأخير وحالة التقاضي والمؤشرات الكلية لتوقع التحصيل.' }),
          tool('forecast.collection_probability', { invoice: sub.en?.split(' · ')[0] || 'invoice', overdue_days: overdue, segment }, { probability: prob / 100, segment_rate: factors.segRate, litigation }, 320),
          chart('collectionCurve', { labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'], values: curve }),
          conf(prob, { zh: '回收概率', en: 'Recovery prob.', ar: 'احتمال التحصيل' }, factors.rows),
          eff('A5'),
          decide(action, tone, auto, gateRule)
        ]
      }
    ],
    conclusion: {
      text: { zh: `综合各因子，回收概率 ${prob}%。`, en: `Combined factors → recovery probability ${prob}%.`, ar: `احتمال التحصيل ${prob}%.` },
      confidence: prob, tone, action
    }
  };
}

export const FORECAST_BASIS = {
  'INV-2026-0512': forecastBundle(
    { zh: 'Sky Bridge 建筑 · 逾期 45 天', en: 'INV-2026-0512 · 45d overdue', ar: 'سكاي بريدج · 45 يوماً' }, 34, 'construction', 45, 'appealed',
    [58, 52, 46, 41, 37, 34],
    { segRate: 0.58, rows: [{ label: { zh: '细分历史收缴率 58%', en: 'Segment rate 58%', ar: 'معدل الفئة 58٪' }, points: 20 }, { label: { zh: '逾期 45 天', en: 'Overdue 45d', ar: 'تأخير 45 يوماً' }, points: 8 }, { label: { zh: '罚款已上诉/景气下行', en: 'Penalty appealed / macro down', ar: 'عقوبة مستأنفة / تراجع' }, points: 6 }] },
    'danger', false, { zh: '概率 34% < 40% → 法务催告', en: 'prob 34% < 40% → legal notice', ar: 'احتمال 34٪ < 40٪ → إشعار قانوني' },
    { zh: '启动法务催告，评估计提坏账', en: 'Start legal notice; assess bad-debt provision', ar: 'إشعار قانوني؛ تقييم المخصص' }
  ),
  'INV-2026-0498': forecastBundle(
    { zh: 'Green Valley 农业 · 逾期 28 天', en: 'INV-2026-0498 · 28d overdue', ar: 'الوادي الأخضر · 28 يوماً' }, 62, 'agriculture', 28, 'none',
    [71, 69, 67, 65, 63, 62],
    { segRate: 0.71, rows: [{ label: { zh: '农业细分收缴率 71%', en: 'Agri-segment rate 71%', ar: 'معدل الزراعة 71٪' }, points: 40 }, { label: { zh: '无诉讼/无罚款', en: 'No litigation/penalty', ar: 'لا تقاضٍ/عقوبة' }, points: 22 }] },
    'warn', false, { zh: '概率 62% → 双渠道提醒', en: 'prob 62% → dual-channel reminder', ar: 'احتمال 62٪ → تذكير مزدوج' },
    { zh: '电话+邮件双渠道提醒，7 日内跟进', en: 'Phone + email reminders; follow up in 7 days', ar: 'تذكير هاتف وبريد؛ متابعة خلال 7 أيام' }
  ),
  'INV-2026-0476': forecastBundle(
    { zh: 'Metro 运输 · 逾期 12 天', en: 'INV-2026-0476 · 12d overdue', ar: 'مترو · 12 يوماً' }, 88, 'transport', 12, 'none',
    [80, 82, 84, 86, 87, 88],
    { segRate: 0.94, rows: [{ label: { zh: '按时付款率 94%', en: 'On-time rate 94%', ar: 'الالتزام 94٪' }, points: 66 }, { label: { zh: '仅逾期 12 天', en: 'Only 12d overdue', ar: 'تأخير 12 يوماً فقط' }, points: 22 }] },
    'ok', true, { zh: '概率 88% ≥ 75% → 自动标准催收', en: 'prob 88% ≥ 75% → auto standard reminder', ar: 'احتمال 88٪ ≥ 75٪ → تذكير تلقائي' },
    { zh: '标准催收邮件即可', en: 'Standard collection email suffices', ar: 'بريد تحصيل قياسي' }
  ),
  'INV-2026-0455': forecastBundle(
    { zh: 'Coastal 物流 · 逾期 61 天', en: 'INV-2026-0455 · 61d overdue', ar: 'الساحلية · 61 يوماً' }, 21, 'logistics', 61, 'enforcing',
    [40, 34, 30, 26, 23, 21],
    { segRate: 0.44, rows: [{ label: { zh: '严重逾期 61 天', en: 'Deep overdue 61d', ar: 'تأخر عميق 61 يوماً' }, points: 10 }, { label: { zh: '罚款执行中', en: 'Penalty enforcing', ar: 'عقوبة قيد التنفيذ' }, points: 6 }, { label: { zh: '高延迟风险', en: 'High delay risk', ar: 'خطر تأخير عالٍ' }, points: 5 }] },
    'danger', false, { zh: '概率 21% < 40% → 催收经理介入', en: 'prob 21% < 40% → manager intervention', ar: 'احتمال 21٪ < 40٪ → تدخل المدير' },
    { zh: '最高优先级，催收经理介入并计提坏账', en: 'Top priority; manager intervention + bad-debt provisioning', ar: 'أولوية قصوى؛ تدخل المدير + مخصص' }
  )
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
    {
      agent: 'A0',
      title: { zh: '断点来源与价值汇总', en: 'Breakpoint sources & value summary', ar: 'مصادر التوقف وملخص القيمة' },
      blocks: [
        think({ zh: '汇总本月编排层触发的 HITL 断点分布与自动化收益。', en: 'Aggregating this month\'s HITL breakpoint distribution and automation gains from the orchestrator.', ar: 'أجمّع توزيع نقاط توقف HITL ومكاسب الأتمتة لهذا الشهر.' }),
        tool('orchestrator.hitl_stats', { period: '2026-07' }, { confidence_breakpoints: 612, amount_threshold: 327, anomaly: 134, auto_share: 0.914, hours_saved: 3860 }, 260),
        evid([
          { source: 'Orchestrator · breakpoints', detail: { zh: '置信度断点 612 · 金额阈值断点 327 · 异常断点 134。', en: 'Confidence 612 · amount-threshold 327 · anomaly 134.', ar: 'ثقة 612 · حد المبلغ 327 · شذوذ 134.' } }
        ]),
        eff('A6'),
        decide({ zh: 'AI 出结论、人工做决策：91.4% 自动完成，其余按风险精准转人工。', en: 'AI concludes, humans decide: 91.4% automated, the rest routed to humans by risk.', ar: 'الذكاء يستنتج والبشر يقررون: 91.4٪ آلي والباقي حسب المخاطر.' }, 'ok', true, { zh: '置信度 < 75% / 超阈值 / 异常 → 人工', en: 'confidence < 75% / over threshold / anomaly → human', ar: 'الثقة < 75٪ / تجاوز / شذوذ → بشري' })
      ]
    }
  ],
  conclusion: { text: { zh: 'AI 出结论、人工做决策：91.4% 自动完成，其余按风险精准转人工。', en: 'AI concludes, humans decide: 91.4% automated, the rest routed to humans by risk.', ar: 'الذكاء يستنتج والبشر يقررون: 91.4٪ آلي والباقي حسب المخاطر.' }, confidence: 94, tone: 'ok' }
};

/* ---------------------------------------------------------------- A0 Orchestration */
// Legacy linear task list (kept for reference / fallback).
export const ORCH_TASKS = [
  { route: 'A0 → A1', text: { zh: '派发摄取任务：拉取并 OCR 标准化', en: 'Dispatch ingestion: fetch & OCR-normalize', ar: 'إرسال الاستيعاب: جلب وتوحيد' } },
  { route: 'A1 → A2', text: { zh: '移交标准化发票，执行三单匹配', en: 'Handoff standardized invoice, run 3-way match', ar: 'تسليم الفاتورة وتنفيذ المطابقة' } },
  { route: 'A2 → A3', text: { zh: '移交匹配结果，执行风险评分', en: 'Handoff match result, run risk scoring', ar: 'تسليم المطابقة وتنفيذ التقييم' } },
  { route: 'A3 → A0', text: { zh: '风险 > 阈值，回报编排层触发 HITL 断点', en: 'Risk > threshold, report to orchestrator → HITL breakpoint', ar: 'مخاطر > الحد، إبلاغ المنسق → توقف HITL', hitl: true } },
  { route: 'A0 → A4', text: { zh: '按授权矩阵分发审批链', en: 'Dispatch approval chain per authorization matrix', ar: 'توزيع سلسلة الموافقة' } },
  { route: 'A4 → A5', text: { zh: '审批后移交催收预测', en: 'After approval, handoff to forecasting', ar: 'بعد الموافقة، تسليم للتنبؤ' } },
  { route: 'A5 → A6', text: { zh: '移交结果，汇总 KPI 与审计留痕', en: 'Handoff results, aggregate KPIs & audit trail', ar: 'تسليم النتائج وتجميع المؤشرات' } }
];

// Live orchestration graph — inter-agent messages with realistic handoff
// payload summaries. `wave` groups messages that fire together (parallelism).
export const ORCH_MESSAGES = [
  { from: 'A0', to: 'A1', wave: 0, text: { zh: '派发摄取：从 4 源拉取并 OCR 标准化', en: 'dispatch ingest: fetch from 4 sources & OCR-normalize', ar: 'إرسال الاستيعاب: جلب من 4 مصادر وتوحيد' } },
  { from: 'A1', to: 'A2', wave: 1, text: { zh: '标准化 12 字段（置信度 0.97）→ 移交三单匹配', en: 'normalized 12 fields (conf 0.97) → hand off for 3-way match', ar: 'توحيد 12 حقلاً (ثقة 0.97) → تسليم للمطابقة' } },
  { from: 'A2', to: 'A3', wave: 2, text: { zh: '匹配通过，标记价格异常待评分', en: 'match OK, flag price anomaly for scoring', ar: 'المطابقة صحيحة، وسم شذوذ السعر للتقييم' } },
  { from: 'A2', to: 'A5', wave: 2, parallel: true, text: { zh: '并行：将逾期台账送入催收预测', en: 'in parallel: feed overdue ledger to forecasting', ar: 'بالتوازي: تمرير دفتر المتأخرات للتنبؤ' } },
  { from: 'A3', to: 'A4', wave: 3, hitl: true, text: { zh: '风险 82（高危）→ 路由至中心主任审批', en: 'risk 82 (high) → route to Director approval', ar: 'مخاطر 82 (عالية) → توجيه لموافقة المدير' } },
  { from: 'A5', to: 'A6', wave: 3, parallel: true, text: { zh: '回收概率 0.62 → 输入分析看板', en: 'collection prob 0.62 → feed analytics', ar: 'احتمال التحصيل 0.62 → تغذية التحليلات' } },
  { from: 'A4', to: 'A0', wave: 4, hitl: true, text: { zh: 'HITL 断点：置信度 71% < 75%，等待人工', en: 'HITL breakpoint: confidence 71% < 75%, awaiting human', ar: 'توقف HITL: الثقة 71٪ < 75٪، بانتظار البشر' } },
  { from: 'A6', to: 'A0', wave: 4, parallel: true, text: { zh: 'KPI 已汇总，审计留痕已写入', en: 'KPIs aggregated, audit trail written', ar: 'تم تجميع المؤشرات وكتابة سجل التدقيق' } }
];

// Per-agent synthetic average latency (ms) for the live orchestration metrics.
export const ORCH_LATENCY = { A1: 340, A2: 280, A3: 410, A4: 190, A5: 520, A6: 230 };
