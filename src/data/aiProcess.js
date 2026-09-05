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
//  { type:'efficiency',     agent:'validation' | data:{...} }     // Manual-vs-Agent stat
//  { type:'decision',       text:{i18n}, tone, auto:bool, gate:{i18n} }  // final rec + HITL gate
// TraceBlock guarantees every block resolves (no infinite spinner); the drawer
// always closes with the highlighted `conclusion`.

/* ------------------------------------------------------------- Block builders */
const think = (text, latencyMs = 260) => ({ type: 'thought', text, latencyMs });
const tool = (name, request, response, latencyMs = 320) => ({ type: 'tool_call', tool: name, request, response, latencyMs });
const obs = (text, tone) => ({ type: 'observation', text, tone });
const recon = (scenario, tolerance = 0.02) => ({ type: 'reconciliation', scenario, tolerance });
const evid = (items) => ({ type: 'evidence', items });
const conf = (value, label, factors, opts) => ({ type: 'confidence', value, label, factors, risk: !!opts?.risk });
const chart = (chartType, payload) => ({ type: 'chart', chartType, payload });
const decide = (text, tone, auto, gate) => ({ type: 'decision', text, tone, auto, gate });

/* ---------------------------------------------------------------- Ingest sources
   Real originating products: Forsah, Momtathil, Baladi (central) and
   Amanah-internal systems — plus generic Email/ERP channels. Tahseel and
   Makin are reporting/view layers, not origins (see note below). */
// Tahseel and Makin are "means" — reporting/view layers, NOT where an
// invoice is issued from. Tahseel can't tell you which product within an
// Amanah raised a given invoice, and Makin is a read-only customized-report
// view with no write capability of its own (you don't need it — you already
// have the underlying data). So neither belongs here as a parallel volume
// source; this animation shows the real ORIGINATING products instead —
// everything ingested still ends up fully reflected in Tahseel regardless.
export const INGEST_SOURCES = [
  { id: 'email', name: { zh: '邮件', en: 'Email', ar: 'البريد' }, count: 1860 },
  { id: 'erp', name: { zh: '政府 ERP', en: 'Government ERP', ar: 'ERP الحكومي' }, count: 2140 },
  { id: 'forsah', name: { zh: 'Forsah · 投资', en: 'Forsah · Investment', ar: 'فرص · الاستثمار' }, count: 4820 },
  { id: 'momtathil', name: { zh: 'Momtathil · 违规罚款', en: 'Momtathil · Violations & Fines', ar: 'ممتثل · المخالفات والغرامات' }, count: 3610 },
  { id: 'baladi', name: { zh: 'Baladi · 市政', en: 'Baladi · Municipal', ar: 'بلدي · البلديات' }, count: 2240 },
  { id: 'internal', name: { zh: '安曼纳内部系统', en: 'Amanah-Internal Systems', ar: 'أنظمة داخلية لدى الأمانات' }, count: 1810 }
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
  po: { zh: '催收单号', en: 'Collection Order (CO)', ar: 'أمر التحصيل (CO)' },
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
      ocrField('po', 'CO-88231', 99),
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
      ocrField('po', 'CO-88192', 98),
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
      ocrField('po', 'CO-88231', 99),
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
      ocrField('po', 'CO-87990', 98),
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

/* ---------------------------------------------------------------- Scenario info
   Shared invoice facts per scenario, used by the ingest-family and
   validation/compliance bundle factories below. */
const SCENARIO_INFO = {
  normal: { source: 'Forsah', doc: 'INV-2026-0731.pdf', invoice: 'INV-2026-0731', amount: 1250000, payer: 'Al-Rajhi Construction Group', co: 'CO-88231', accrual: 'AC-2026-4471', contract: 'SANAD-CT-2231', taxId: '3001234567800003', ocrConf: 0.98, lowFields: 0, dupSimilarity: 0.34 },
  fraud: { source: 'Momtathil', doc: 'INV-2026-0730.pdf', invoice: 'INV-2026-0730', amount: 486000, payer: 'NEOM Logistics', co: 'CO-88192', accrual: 'AC-2026-4460', contract: 'SANAD-CT-7715', taxId: '3009988776600001', ocrConf: 0.96, lowFields: 0, dupSimilarity: 0.12 },
  dup: { source: 'Momtathil', doc: 'INV-2026-0728.pdf', invoice: 'INV-2026-0728', amount: 1250000, payer: 'Gulf Facility Mgmt', co: 'CO-88231', accrual: 'AC-2026-4471', contract: 'SANAD-CT-2231', taxId: '3001234567800003', ocrConf: 0.99, lowFields: 0, isDup: true, dupOf: 'INV-2026-0731' },
  taxfail: { source: 'Baladi', doc: 'INV-2026-0727.pdf', invoice: 'INV-2026-0727', amount: 3180000, payer: 'Aramco Logistics Supply', co: 'CO-87990', accrual: 'AC-2026-4402', contract: 'SANAD-CT-2799', taxId: '3005566778800002', ocrConf: 0.95, lowFields: 1, dupSimilarity: 0.08 }
};

/* ---------------------------------------------------------------- Pipeline handoffs
   Per-scenario, per-agent intermediate conclusion + "input received from previous
   agent" line. 11 entries, index 0..10 matching PIPELINE (mock.js):
   0 ingest, 1 ocr, 2 normalize, 3 dedup, 4 validation, 5 compliance,
   6 anomaly, 7 pattern, 8 routing, 9 forecasting, 10 analytics. */
export const PIPELINE_WORK = {
  normal: [
    { conclusion: { zh: '从 Forsah 拉取账单 PDF，加入接收队列。', en: 'Pulled the invoice PDF from Forsah into the intake queue.', ar: 'تم سحب PDF الفاتورة من فرص وإدراجها في قائمة الاستيعاب.' } },
    { handoff: { zh: '接收摄取输出：账单已入队', en: 'Received ingestion output: invoice queued', ar: 'استلام مخرجات الاستيعاب: الفاتورة في القائمة' }, conclusion: { zh: 'OCR 提取 10 个字段，平均置信度 98%。', en: 'OCR extracted 10 fields at 98% average confidence.', ar: 'استخراج OCR لـ10 حقول بثقة 98٪.' } },
    { handoff: { zh: '接收 OCR 输出：10 个字段', en: 'Received OCR output: 10 fields', ar: 'استلام مخرجات OCR: 10 حقول' }, conclusion: { zh: '格式、单位与字段名称已统一映射至标准模型。', en: 'Formats, units, and field labels mapped to the unified model.', ar: 'تم توحيد التنسيقات والوحدات وتسميات الحقول ضمن النموذج الموحد.' } },
    { handoff: { zh: '接收标准化输出：统一模型', en: 'Received normalization output: unified model', ar: 'استلام مخرجات التوحيد: النموذج الموحد' }, conclusion: { zh: '指纹检索未命中重复（相似度 34%）。', en: 'Fingerprint search found no duplicate (nearest similarity 34%).', ar: 'لم يجد بحث البصمة تكراراً (أعلى تشابه 34٪).' } },
    { handoff: { zh: '接收去重输出：无重复', en: 'Received dedup output: no duplicate', ar: 'استلام مخرجات التكرار: لا تكرار' }, conclusion: { zh: '三单匹配一致，匹配置信度 97%。', en: '3-way match consistent, match confidence 97%.', ar: 'المطابقة الثلاثية متسقة، ثقة المطابقة 97٪.' } },
    { handoff: { zh: '接收核验输出：匹配一致', en: 'Received validation output: matched', ar: 'استلام مخرجات التحقق: مطابقة' }, conclusion: { zh: 'ZATCA 税号有效，VAT 15% 复算通过。', en: 'ZATCA tax ID valid, VAT 15% recomputed OK.', ar: 'الرقم الضريبي صالح، إعادة حساب الضريبة 15٪ ناجحة.' } },
    { handoff: { zh: '接收合规输出：税务合规', en: 'Received compliance output: tax-compliant', ar: 'استلام مخرجات الامتثال: متوافق' }, conclusion: { zh: '价格贴近历史均价，风险评分 12（低危），无欺诈特征。', en: 'Price near historical average, risk score 12 (low), no fraud signals.', ar: 'السعر قريب من المتوسط التاريخي، درجة المخاطرة 12 (منخفضة).' } },
    { handoff: { zh: '接收异常检测输出：风险 12（低危）', en: 'Received anomaly output: risk 12 (low)', ar: 'استلام مخرجات الانحراف: درجة 12 (منخفضة)' }, conclusion: { zh: '未见异常提交频率或定价模式，与缴款方历史一致。', en: 'No unusual submission frequency or pricing pattern vs. payer history.', ar: 'لا نمط تكرار أو تسعير غير معتاد مقارنة بسجل الجهة الدافعة.' } },
    { handoff: { zh: '接收模式识别输出：无异常模式', en: 'Received pattern output: no unusual pattern', ar: 'استلام مخرجات الأنماط: لا نمط منحرف' }, conclusion: { zh: '金额 1.25M，命中三级审批链，推送人工确认（HITL）。', en: 'Amount 1.25M, matched 3-level chain, pushed to human confirm (HITL).', ar: 'المبلغ 1.25M، سلسلة من 3 مستويات، أُرسلت للتأكيد البشري (HITL).' } },
    { handoff: { zh: '接收审批路由输出：待人工审批', en: 'Received routing output: pending approval', ar: 'استلام مخرجات التوجيه: بانتظار الموافقة' }, conclusion: { zh: '付款计划已建模，预计回收/结算周期正常。', en: 'Payment plan modeled; expected settlement cycle normal.', ar: 'تم نمذجة خطة الدفع؛ دورة التسوية المتوقعة طبيعية.' } },
    { handoff: { zh: '接收催收预测输出：结算周期正常', en: 'Received forecasting output: normal settlement', ar: 'استلام مخرجات التنبؤ: تسوية طبيعية' }, conclusion: { zh: 'KPI 汇总入库，审计留痕已生成。', en: 'KPIs aggregated, audit trail generated.', ar: 'تم تجميع المؤشرات وإنشاء سجل التدقيق.' } }
  ],
  fraud: [
    { conclusion: { zh: '从 Momtathil 拉取 NEOM 账单 PDF，加入接收队列。', en: 'Pulled the NEOM invoice PDF from Momtathil into the intake queue.', ar: 'تم سحب PDF فاتورة NEOM من ممتثل وإدراجها في القائمة.' } },
    { handoff: { zh: '接收摄取输出：账单已入队', en: 'Received ingestion output: invoice queued', ar: 'استلام مخرجات الاستيعاب: الفاتورة في القائمة' }, conclusion: { zh: 'OCR 提取 10 个字段，平均置信度 96%。', en: 'OCR extracted 10 fields at 96% average confidence.', ar: 'استخراج OCR لـ10 حقول بثقة 96٪.' } },
    { handoff: { zh: '接收 OCR 输出：10 个字段', en: 'Received OCR output: 10 fields', ar: 'استلام مخرجات OCR: 10 حقول' }, conclusion: { zh: '格式与字段名称已统一映射至标准模型。', en: 'Formats and field labels mapped to the unified model.', ar: 'تم توحيد التنسيقات وتسميات الحقول ضمن النموذج الموحد.' } },
    { handoff: { zh: '接收标准化输出：统一模型', en: 'Received normalization output: unified model', ar: 'استلام مخرجات التوحيد: النموذج الموحد' }, conclusion: { zh: '指纹检索未命中重复（相似度 12%）。', en: 'Fingerprint search found no duplicate (nearest similarity 12%).', ar: 'لم يجد بحث البصمة تكراراً (أعلى تشابه 12٪).' } },
    { handoff: { zh: '接收去重输出：无重复', en: 'Received dedup output: no duplicate', ar: 'استلام مخرجات التكرار: لا تكرار' }, conclusion: { zh: '三单匹配通过——移交合规检查税务。', en: '3-way match OK — handing to compliance for tax check.', ar: 'المطابقة صحيحة — التحويل لفحص الامتثال الضريبي.' } },
    { handoff: { zh: '接收核验输出：匹配通过', en: 'Received validation output: matched', ar: 'استلام مخرجات التحقق: مطابقة' }, conclusion: { zh: '税号有效，VAT 复算通过——移交异常检测复核价格。', en: 'Tax ID valid, VAT recompute OK — handing to anomaly for price review.', ar: 'الرقم صالح، إعادة حساب الضريبة ناجحة — التحويل لوكيل الانحراف لمراجعة السعر.' } },
    { handoff: { zh: '接收合规输出：税务合规', en: 'Received compliance output: tax-compliant', ar: 'استلام مخرجات الامتثال: متوافق' }, conclusion: { zh: '⚠ 费用偏离标准基准 +38%，该缴款方 90 天内无历史，风险评分 82，置信度 71% < 75% → 触发 HITL 断点。', en: '⚠ Fee +38% above the standard tariff, no history for this payer in 90d, risk score 82, confidence 71% < 75% → HITL breakpoint.', ar: '⚠ الرسم +38٪ فوق المعيار القياسي، لا تاريخ لهذه الجهة الدافعة، درجة 82، ثقة 71٪ < 75٪ → نقطة توقف HITL.' } },
    {}, {}, {}, {}
  ],
  dup: [
    { conclusion: { zh: '从 Momtathil 拉取 Gulf Facility 账单 PDF，加入接收队列。', en: 'Pulled the Gulf Facility Mgmt invoice PDF from Momtathil into the intake queue.', ar: 'تم سحب PDF فاتورة Gulf Facility من ممتثل وإدراجها في القائمة.' } },
    { handoff: { zh: '接收摄取输出：账单已入队', en: 'Received ingestion output: invoice queued', ar: 'استلام مخرجات الاستيعاب: الفاتورة في القائمة' }, conclusion: { zh: 'OCR 提取 10 个字段，平均置信度 99%。', en: 'OCR extracted 10 fields at 99% average confidence.', ar: 'استخراج OCR لـ10 حقول بثقة 99٪.' } },
    { handoff: { zh: '接收 OCR 输出：10 个字段', en: 'Received OCR output: 10 fields', ar: 'استلام مخرجات OCR: 10 حقول' }, conclusion: { zh: '格式与字段名称已统一映射至标准模型。', en: 'Formats and field labels mapped to the unified model.', ar: 'تم توحيد التنسيقات وتسميات الحقول ضمن النموذج الموحد.' } },
    { handoff: { zh: '接收标准化输出：统一模型', en: 'Received normalization output: unified model', ar: 'استلام مخرجات التوحيد: النموذج الموحد' }, conclusion: { zh: '⚠ 指纹检索命中历史重复账单（发票号/金额/缴款方/催收单四元组一致），已自动拦截，等待人工确认。', en: '⚠ Fingerprint search matched a historical duplicate (invoice/amount/payer/CO tuple). Auto-blocked, awaiting human confirm.', ar: '⚠ طابق بحث البصمة فاتورة مكررة (رقم/مبلغ/جهة دافعة/أمر تحصيل). حظر تلقائي بانتظار التأكيد.' } },
    {}, {}, {}, {}, {}, {}, {}
  ],
  taxfail: [
    { conclusion: { zh: '从 Baladi 拉取 Aramco 账单 PDF，加入接收队列。', en: 'Pulled the Aramco invoice PDF from Baladi into the intake queue.', ar: 'تم سحب PDF فاتورة Aramco من بلدي وإدراجها في القائمة.' } },
    { handoff: { zh: '接收摄取输出：账单已入队', en: 'Received ingestion output: invoice queued', ar: 'استلام مخرجات الاستيعاب: الفاتورة في القائمة' }, conclusion: { zh: 'OCR 提取 10 个字段——VAT 字段置信度仅 88%。', en: 'OCR extracted 10 fields — VAT field confidence only 88%.', ar: 'استخراج OCR لـ10 حقول — ثقة حقل الضريبة 88٪ فقط.' } },
    { handoff: { zh: '接收 OCR 输出：VAT 字段待复核', en: 'Received OCR output: VAT field flagged', ar: 'استلام مخرجات OCR: حقل الضريبة موسوم' }, conclusion: { zh: '格式已统一映射，VAT 字段标记待合规复核。', en: 'Formats mapped to the unified model; VAT field flagged for compliance review.', ar: 'تم توحيد التنسيقات؛ حقل الضريبة موسوم لمراجعة الامتثال.' } },
    { handoff: { zh: '接收标准化输出：统一模型', en: 'Received normalization output: unified model', ar: 'استلام مخرجات التوحيد: النموذج الموحد' }, conclusion: { zh: '指纹检索未命中重复。', en: 'Fingerprint search found no duplicate.', ar: 'لم يجد بحث البصمة تكراراً.' } },
    { handoff: { zh: '接收去重输出：无重复', en: 'Received dedup output: no duplicate', ar: 'استلام مخرجات التكرار: لا تكرار' }, conclusion: { zh: '账单明细与催收单部分差异（第 1 行 +2.4%）——移交合规检查税号。', en: 'Invoice items partially differ from the Collection Order (line 1 +2.4%) — handing to compliance for tax check.', ar: 'انحراف جزئي مع أمر التحصيل (البند 1 +2.4٪) — التحويل لفحص الامتثال الضريبي.' } },
    { handoff: { zh: '接收核验输出：部分差异', en: 'Received validation output: partial variance', ar: 'استلام مخرجات التحقق: انحراف جزئي' }, conclusion: { zh: '⚠ ZATCA 税号校验失败，匹配置信度 68% < 75% → 转人工复核。', en: '⚠ ZATCA tax-ID check failed, match confidence 68% < 75% → manual review.', ar: '⚠ فشل فحص الرقم الضريبي، ثقة 68٪ < 75٪ → مراجعة يدوية.' } },
    {}, {}, {}, {}, {}
  ]
};

/* ================================================================ Ingest family
   ingest → ocr → normalize → dedup. Factories share SCENARIO_INFO so the four
   agents each expose one focused, tool-call-backed step. */
function ingestBundle(scenario) {
  const s = SCENARIO_INFO[scenario];
  return {
    title: { zh: '发票摄取 · Agent 运行轨迹', en: 'Invoice Ingestion · Agent Run-Trace', ar: 'استيعاب الفواتير · مسار الوكيل' },
    subtitle: { zh: `${s.source} PDF · 接收队列`, en: `${s.source} PDF · intake queue`, ar: `${s.source} · قائمة الاستيعاب` },
    agentTag: 'ingest',
    steps: [
      {
        agent: 'ingest',
        title: { zh: '抓取账单', en: 'Fetch invoice', ar: 'جلب الفاتورة' },
        blocks: [
          think({ zh: `从 ${s.source} 拉取账单 PDF，加入统一接收队列。`, en: `Pulling the invoice PDF from ${s.source} into the unified intake queue.`, ar: `أسحب PDF الفاتورة من ${s.source} إلى قائمة الاستيعاب الموحدة.` }),
          tool('platform.fetch_invoice', { source: s.source, doc: s.doc }, { queued: true, size_kb: 412 }, 140),
          obs({ zh: '账单已加入接收队列，等待 OCR 提取。', en: 'Invoice queued for OCR extraction.', ar: 'الفاتورة في قائمة الانتظار لاستخراج OCR.' }, 'ok'),
        ]
      }
    ],
    conclusion: { text: { zh: `账单已从 ${s.source} 摄取并加入队列。`, en: `Invoice fetched from ${s.source} and queued.`, ar: `تم جلب الفاتورة من ${s.source} وإدراجها في القائمة.` }, tone: 'ok', action: { zh: '移交 OCR 提取', en: 'Hand off to OCR Extraction', ar: 'التسليم لاستخراج OCR' } }
  };
}

function ocrBundle(scenario) {
  const s = SCENARIO_INFO[scenario];
  const warn = s.lowFields > 0;
  return {
    title: { zh: 'OCR 数据提取 · Agent 运行轨迹', en: 'OCR Data Extraction · Agent Run-Trace', ar: 'استخراج بيانات OCR · مسار الوكيل' },
    subtitle: { zh: `${s.doc} · 字段识别`, en: `${s.doc} · field recognition`, ar: `${s.doc} · التعرف على الحقول` },
    agentTag: 'ocr',
    steps: [
      {
        agent: 'ocr',
        title: { zh: '字段识别与置信度评分', en: 'Field recognition & confidence scoring', ar: 'التعرف على الحقول وتقييم الثقة' },
        handoff: { zh: '接收摄取输出：账单已入队', en: 'Received ingestion output: invoice queued', ar: 'استلام مخرجات الاستيعاب: الفاتورة في القائمة' },
        blocks: [
          tool('vision.ocr_extract', { source: s.source, doc: s.doc }, { fields_extracted: 10, avg_confidence: s.ocrConf, low_confidence_fields: s.lowFields }, 420),
          obs(
            warn
              ? { zh: `成功提取 10 个字段，平均置信度 ${Math.round(s.ocrConf * 100)}%，${s.lowFields} 个低置信字段（税号）。`, en: `Extracted 10 fields at ${Math.round(s.ocrConf * 100)}% average confidence, ${s.lowFields} low-confidence field (VAT number).`, ar: `تم استخراج 10 حقول بثقة ${Math.round(s.ocrConf * 100)}٪ مع حقل منخفض الثقة (الرقم الضريبي).` }
              : { zh: `成功提取 10 个字段，平均置信度 ${Math.round(s.ocrConf * 100)}%，无低置信字段。`, en: `Extracted 10 fields at ${Math.round(s.ocrConf * 100)}% average confidence, no low-confidence fields.`, ar: `تم استخراج 10 حقول بثقة ${Math.round(s.ocrConf * 100)}٪ دون حقول منخفضة.` },
            warn ? 'warn' : 'ok'
          ),
          decide(
            warn
              ? { zh: '税号字段置信度偏低 → 移交标准化并标记待复核。', en: 'VAT field confidence is low → hand off to normalization, flagged for review.', ar: 'ثقة حقل الضريبة منخفضة → التسليم للتوحيد مع وسم للمراجعة.' }
              : { zh: '全部字段高置信 → 移交标准化。', en: 'All fields high-confidence → hand off to normalization.', ar: 'جميع الحقول بثقة عالية → التسليم للتوحيد.' },
            warn ? 'warn' : 'ok', true,
            { zh: '低置信字段 → 标记复核', en: 'low-confidence field → flagged', ar: 'حقل منخفض الثقة → موسوم' }
          )
        ]
      }
    ],
    conclusion: { text: { zh: `OCR 提取 10 个字段（${Math.round(s.ocrConf * 100)}%）。`, en: `OCR extracted 10 fields (${Math.round(s.ocrConf * 100)}%).`, ar: `استخراج OCR لـ10 حقول (${Math.round(s.ocrConf * 100)}٪).` }, confidence: Math.round(s.ocrConf * 100), tone: warn ? 'warn' : 'ok', action: { zh: '移交元数据标准化', en: 'Hand off to Metadata Normalization', ar: 'التسليم لتوحيد البيانات الوصفية' } }
  };
}

function normalizeBundle(scenario) {
  const s = SCENARIO_INFO[scenario];
  const warn = s.lowFields > 0;
  return {
    title: { zh: '元数据标准化 · Agent 运行轨迹', en: 'Metadata Normalization · Agent Run-Trace', ar: 'توحيد البيانات الوصفية · مسار الوكيل' },
    subtitle: { zh: '格式/单位/字段映射', en: 'Format/unit/field mapping', ar: 'تعيين التنسيق/الوحدات/الحقول' },
    agentTag: 'normalize',
    steps: [
      {
        agent: 'normalize',
        title: { zh: '映射至统一发票模型', en: 'Map to the unified invoice schema', ar: 'التعيين إلى نموذج الفاتورة الموحد' },
        handoff: { zh: '接收 OCR 输出：10 个字段', en: 'Received OCR output: 10 fields', ar: 'استلام مخرجات OCR: 10 حقول' },
        blocks: [
          tool('format.normalize_fields', { invoice: s.invoice, amount_raw: s.amount, source: s.source }, { fields_mapped: 10, unit_currency: 'SAR', date_format: 'ISO-8601' }, 180),
          obs({ zh: '金额、日期与字段名称已统一至标准模型。', en: 'Amount, date, and field labels standardized to the unified model.', ar: 'تم توحيد المبلغ والتاريخ وتسميات الحقول ضمن النموذج الموحد.' }, 'ok'),
        ]
      }
    ],
    conclusion: { text: { zh: '格式、单位与字段名称已统一映射。', en: 'Formats, units, and field labels standardized.', ar: 'تم توحيد التنسيقات والوحدات وتسميات الحقول.' }, tone: warn ? 'warn' : 'ok', action: { zh: '移交重复检测', en: 'Hand off to Duplicates Detection', ar: 'التسليم لاكتشاف التكرار' } }
  };
}

function dedupBundle(scenario) {
  const s = SCENARIO_INFO[scenario];
  if (s.isDup) {
    return {
      title: { zh: '重复检测 · Agent 运行轨迹', en: 'Duplicates Detection · Agent Run-Trace', ar: 'اكتشاف التكرار · مسار الوكيل' },
      subtitle: { zh: '四元组指纹比对拦截重复征收', en: 'Tuple-fingerprint match blocks duplicate charge', ar: 'مطابقة البصمة تمنع التحصيل المزدوج' },
      agentTag: 'dedup',
      steps: [
        {
          agent: 'dedup',
          title: { zh: '生成指纹并检索历史库', en: 'Build fingerprint & search history', ar: 'بناء البصمة والبحث في السجل' },
          handoff: { zh: '接收标准化输出：统一模型', en: 'Received normalization output: unified model', ar: 'استلام مخرجات التوحيد: النموذج الموحد' },
          blocks: [
            think({ zh: '对 (发票号, 金额, 缴款方, 催收单) 生成指纹，检索 90 天历史账单库。', en: 'Hashing (invoice, amount, payer, CO) into a fingerprint and searching the 90-day history store.', ar: 'تجزئة (فاتورة، مبلغ، جهة دافعة، أمر تحصيل) في بصمة والبحث في سجل 90 يوماً.' }),
            tool('dedup.fingerprint_search', { invoice: s.invoice, amount: s.amount, payer: s.payer, co: s.co }, { duplicate: true, duplicate_of: s.dupOf, similarity: 1.0, matched_fields: ['amount', 'payer', 'co', 'accrual'] }, 210),
            obs({ zh: `四元组与 ${s.dupOf} 完全一致，判定为重复账单。`, en: `Tuple is an exact match with ${s.dupOf} → duplicate invoice.`, ar: `البصمة تطابق ${s.dupOf} تماماً → فاتورة مكررة.` }, 'danger')
          ]
        },
        {
          agent: 'dedup',
          title: { zh: '命中重复 · 自动拦截', en: 'Duplicate hit · auto-blocked', ar: 'تطابق مكرر · حظر تلقائي' },
          blocked: true,
          blocks: [
            evid([
              { source: `Tahseel · ${s.dupOf}`, detail: { zh: `原始账单：金额 1,250,000 SAR，催收单 CO-88231，应计确认 AC-2026-4471 — 与当前账单四字段一致。`, en: 'Original invoice: amount 1,250,000 SAR, CO-88231, AC-2026-4471 — identical on all four fields.', ar: 'الفاتورة الأصلية: 1,250,000 ر.س، أمر تحصيل CO-88231، إثبات استحقاق AC-2026-4471 — متطابقة في الحقول الأربعة.' }, tone: 'danger' }
            ]),
            decide({ zh: '已自动拦截重复征收，为该缴款方规避 1,250,000 SAR 的重复账单，等待人工确认后归档。', en: 'Auto-blocked the duplicate charge, sparing the payer a 1,250,000 SAR double bill — awaiting human confirm to archive.', ar: 'تم حظر التحصيل المزدوج تلقائياً، لتجنّب فاتورة مكررة بقيمة 1,250,000 ر.س على الجهة الدافعة — بانتظار التأكيد للأرشفة.' }, 'warn', false, { zh: '重复指纹命中 → 拦截并转人工确认', en: 'duplicate fingerprint → block & route to human confirm', ar: 'بصمة مكررة → حظر وإحالة للتأكيد' })
          ]
        }
      ],
      conclusion: { text: { zh: '已拦截重复征收，为该缴款方避免 1,250,000 SAR 的重复账单，等待人工确认。', en: 'Blocked a duplicate charge, sparing the payer a 1,250,000 SAR double bill — awaiting human confirm.', ar: 'حُظر التحصيل المزدوج، لتجنّب فاتورة مكررة بقيمة 1,250,000 على الجهة الدافعة — بانتظار التأكيد.' }, tone: 'warn', action: { zh: '人工确认后归档，无需进入后续流程', en: 'Archive after human confirm; no further processing', ar: 'الأرشفة بعد التأكيد؛ لا معالجة إضافية' } }
    };
  }
  return {
    title: { zh: '重复检测 · Agent 运行轨迹', en: 'Duplicates Detection · Agent Run-Trace', ar: 'اكتشاف التكرار · مسار الوكيل' },
    subtitle: { zh: `${s.invoice} · 指纹检索`, en: `${s.invoice} · fingerprint search`, ar: `${s.invoice} · بحث البصمة` },
    agentTag: 'dedup',
    steps: [
      {
        agent: 'dedup',
        title: { zh: '生成指纹并检索历史库', en: 'Build fingerprint & search history', ar: 'بناء البصمة والبحث في السجل' },
        handoff: { zh: '接收标准化输出：统一模型', en: 'Received normalization output: unified model', ar: 'استلام مخرجات التوحيد: النموذج الموحد' },
        blocks: [
          tool('dedup.fingerprint_search', { invoice: s.invoice, amount: s.amount, payer: s.payer, co: s.co }, { duplicate: false, nearest_similarity: s.dupSimilarity }, 210),
          decide({ zh: '未命中重复 → 移交自动化核验。', en: 'No duplicate found → hand off to Automated Validation.', ar: 'لا تكرار → التسليم للتحقق الآلي.' }, 'ok', true, { zh: '无重复 → 自动放行', en: 'no duplicate → auto-release', ar: 'بلا تكرار → تمرير تلقائي' })
        ]
      }
    ],
    conclusion: { text: { zh: `指纹检索未命中重复（相似度 ${Math.round(s.dupSimilarity * 100)}%）。`, en: `Fingerprint search found no duplicate (nearest similarity ${Math.round(s.dupSimilarity * 100)}%).`, ar: `لم يجد بحث البصمة تكراراً (أعلى تشابه ${Math.round(s.dupSimilarity * 100)}٪).` }, tone: 'ok', action: { zh: '移交自动化核验', en: 'Hand off to Automated Validation', ar: 'التسليم للتحقق الآلي' } }
  };
}

/* ================================================================ Validation & Compliance
   validation = 3-way match (Invoice-CO-Accrual), compliance = ZATCA tax-ID/VAT
   check. taxfail's HITL gate lives here, at compliance — the ZATCA
   check-digit failure. */
function validationBundle(scenario) {
  const s = SCENARIO_INFO[scenario];
  const variant = scenario === 'taxfail';
  const score = variant ? 82 : 97;
  return {
    title: { zh: '自动化核验 · Agent 运行轨迹', en: 'Automated Validation · Agent Run-Trace', ar: 'التحقق الآلي · مسار الوكيل' },
    subtitle: { zh: '三单匹配 · Makin↔Tahseel 对账', en: '3-way match · Makin↔Tahseel reconciliation', ar: 'مطابقة ثلاثية · تسوية' },
    agentTag: 'validation',
    steps: [
      {
        agent: 'validation',
        title: { zh: '拉取源单据（催收单 / 应计确认 / 合同）', en: 'Pull source records (Collection Order / Accrual Confirmation / contract)', ar: 'سحب المستندات المصدرية' },
        handoff: { zh: '接收去重输出：无重复', en: 'Received dedup output: no duplicate', ar: 'استلام مخرجات التكرار: لا تكرار' },
        blocks: [
          think({ zh: '正在从 ERP 拉取催收单、应计确认与合同以执行三单核验。', en: 'Fetching the Collection Order, Accrual Confirmation, and contract to run a 3-way verification.', ar: 'أجلب أمر التحصيل وإثبات الاستحقاق والعقد لإجراء مطابقة ثلاثية.' }),
          tool('finance.get_collection_order', { co: s.co, invoice: s.invoice }, { co: s.co, lines: variant ? 3 : (scenario === 'fraud' ? 2 : 3), status: 'released', accrual_ref: s.accrual }, 300),
          tool('sanad.lookup_contract', { contract: s.contract }, { active: true, benchmark_source: 'framework_price_list', currency: 'SAR' }, 240),
          obs({ zh: `已获取催收单 ${s.co}、应计确认 ${s.accrual} 与框架合同。`, en: `Retrieved Collection Order ${s.co}, Accrual Confirmation ${s.accrual} and the framework contract.`, ar: `تم جلب أمر التحصيل ${s.co} وإثبات الاستحقاق ${s.accrual} والعقد.` })
        ]
      },
      {
        agent: 'validation',
        title: { zh: '三单核验（账单 vs 催收单 vs 应计确认）', en: '3-way verification (Invoice vs Collection Order vs Accrual Confirmation)', ar: 'المطابقة الثلاثية' },
        blocks: [
          recon(scenario, 0.02),
          obs(
            variant
              ? { zh: '第 1 行单价与催收单不一致（180,000 vs 173,750），行金额差异使总额偏离 +2.4%。', en: 'Line 1 unit price differs from the Collection Order (180,000 vs 173,750); line-total variance pushes the total +2.4%.', ar: 'سعر البند 1 يختلف عن أمر التحصيل (180,000 مقابل 173,750)؛ الفرق يرفع الإجمالي +2.4٪.' }
              : { zh: '全部行项数量与单价均在容差内匹配。', en: 'All line quantities and unit prices match within tolerance.', ar: 'جميع الكميات وأسعار الوحدات مطابقة ضمن الحد المسموح.' },
            variant ? 'warn' : 'ok'
          ),
          conf(score, { zh: '匹配置信度', en: 'Match confidence', ar: 'ثقة المطابقة' }, variant
            ? [
                { label: { zh: '数量/应计确认匹配', en: 'Qty & accrual match', ar: 'مطابقة الكمية والاستحقاق' }, points: 52 },
                { label: { zh: '单价存在差异', en: 'Unit-price variance', ar: 'فرق في سعر الوحدة' }, points: 30 }
              ]
            : [
                { label: { zh: '数量/应计确认匹配', en: 'Qty & accrual match', ar: 'مطابقة الكمية والاستحقاق' }, points: 55 },
                { label: { zh: '单价匹配', en: 'Unit price match', ar: 'مطابقة سعر الوحدة' }, points: 42 }
              ]),
          decide(
            variant
              ? { zh: '存在行价差异，但在阈值内 → 移交合规检查税务。', en: 'Line-price variance found, within threshold → hand off to Compliance for tax check.', ar: 'وجود فرق سعري ضمن الحد → التحويل لفحص الامتثال الضريبي.' }
              : { zh: '三单匹配一致 → 移交合规检查税务。', en: 'All matched → hand off to Compliance for tax check.', ar: 'الكل مطابق → التحويل لفحص الامتثال الضريبي.' },
            variant ? 'warn' : 'ok', true,
            { zh: '匹配置信度达标 → 自动继续', en: 'match confidence OK → auto-continue', ar: 'ثقة المطابقة كافية → متابعة تلقائية' }
          )
        ]
      }
    ],
    conclusion: { text: variant
      ? { zh: '三单匹配存在行价差异（+2.4%），已移交合规检查税务。', en: 'Line-price variance found (+2.4%) — handed to Compliance for tax check.', ar: 'وجود فرق سعري (+2.4٪) — سُلّم لفحص الامتثال الضريبي.' }
      : { zh: '三单匹配一致，已移交合规检查税务。', en: 'All matched — handed to Compliance for tax check.', ar: 'الكل مطابق — سُلّم لفحص الامتثال الضريبي.' },
    tone: variant ? 'warn' : 'ok', action: { zh: '移交合规检查', en: 'Hand off to Compliance Checking', ar: 'التسليم لفحص الامتثال' } }
  };
}

function complianceBundle(scenario) {
  const s = SCENARIO_INFO[scenario];
  const fail = scenario === 'taxfail';
  const score = fail ? 68 : 97;
  const vat = fail
    ? { declared: 472800, computed: 477000, expected: 477000 }
    : (scenario === 'fraud' ? { declared: 72900, computed: 72900, expected: 72900 } : { declared: 187500, computed: 187500, expected: 187500 });
  return {
    title: { zh: '合规检查 · Agent 运行轨迹', en: 'Compliance Checking · Agent Run-Trace', ar: 'فحص الامتثال · مسار الوكيل' },
    subtitle: { zh: 'ZATCA 税务校验 · VAT 复算', en: 'ZATCA tax check · VAT recompute', ar: 'فحص ZATCA · إعادة حساب الضريبة' },
    agentTag: 'compliance',
    steps: [
      {
        agent: 'compliance',
        title: { zh: 'ZATCA 税务校验与 VAT 复算', en: 'ZATCA tax check & VAT recompute', ar: 'فحص ZATCA وإعادة حساب الضريبة' },
        handoff: { zh: '接收核验输出：三单匹配结果', en: 'Received validation output: 3-way match result', ar: 'استلام مخرجات التحقق: نتيجة المطابقة' },
        blocks: [
          tool('zatca.validate_vat', { tax_id: s.taxId, amount: vat.declared, rate: 15 }, { tax_id_valid: !fail, recomputed_vat: vat.computed, declared_vat: vat.declared, variance: vat.expected - vat.declared }, 280),
          chart('vatVariance', vat),
          obs(
            fail
              ? { zh: 'ZATCA 税号校验失败（校验位不符），申报 VAT 与应缴相差 4,200 SAR。', en: 'ZATCA tax-ID failed (check-digit mismatch); declared VAT is off by 4,200 SAR.', ar: 'فشل الرقم الضريبي (خطأ رقم التحقق)؛ الضريبة المُقرّة تنحرف بـ4,200 ر.س.' }
              : { zh: '税号有效，VAT 15% 复算与申报一致。', en: 'Tax-ID valid; VAT 15% recompute matches the declared amount.', ar: 'الرقم صالح؛ إعادة حساب الضريبة 15٪ مطابقة للمُقرّ.' },
            fail ? 'danger' : 'ok'
          ),
          conf(score, { zh: '合规置信度', en: 'Compliance confidence', ar: 'ثقة الامتثال' }, fail
            ? [
                { label: { zh: '税号校验失败', en: 'Tax-ID failed', ar: 'فشل الرقم الضريبي' }, points: 40 },
                { label: { zh: 'VAT 申报存在差异', en: 'VAT declaration variance', ar: 'فرق في الإقرار الضريبي' }, points: 28 }
              ]
            : [
                { label: { zh: '税号有效', en: 'Tax-ID valid', ar: 'الرقم الضريبي صالح' }, points: 62 },
                { label: { zh: 'VAT 复算无差异', en: 'VAT recompute matches', ar: 'إعادة الحساب مطابقة' }, points: 35 }
              ]),
          fail
            ? decide({ zh: '税号校验失败，合规置信度 68% < 75% → 移交人工复核。', en: 'Tax-ID check failed, compliance confidence 68% < 75% → refer to human review.', ar: 'فشل الرقم الضريبي، الثقة 68٪ < 75٪ → إحالة للمراجعة البشرية.' }, 'danger', false, { zh: '置信度 < 75% → 人工复核', en: 'confidence < 75% → human review', ar: 'الثقة < 75٪ → مراجعة بشرية' })
            : decide({ zh: '税务合规 → 自动放行至异常检测。', en: 'Tax-compliant → auto-release to Anomaly & Fraud Detection.', ar: 'متوافق ضريبياً → تمرير تلقائي لاكتشاف الانحراف.' }, 'ok', true, { zh: '置信度 ≥ 75% → 自动放行', en: 'confidence ≥ 75% → auto-release', ar: 'الثقة ≥ 75٪ → تمرير تلقائي' })
        ]
      }
    ],
    conclusion: fail
      ? { text: { zh: 'ZATCA 税号校验失败，合规置信度 68% < 75%，转人工复核。', en: 'ZATCA tax-ID check failed, compliance confidence 68% < 75% — referred to human review.', ar: 'فشل فحص الرقم الضريبي، الثقة 68٪ < 75٪ — إحالة للمراجعة.' }, tone: 'danger', action: { zh: '人工复核税号并补正催收单差异', en: 'Human to verify tax-ID and correct Collection-Order discrepancy', ar: 'التحقق اليدوي من الرقم وتصحيح الفرق' } }
      : { text: { zh: '税务合规，VAT 复算无差异。', en: 'Tax-compliant, VAT recompute with no variance.', ar: 'متوافق ضريبياً، إعادة الحساب دون فرق.' }, tone: 'ok', action: { zh: '移交异常检测', en: 'Hand off to Anomaly & Fraud Detection', ar: 'التسليم لاكتشاف الانحراف' } }
  };
}

/* ================================================================ Anomaly & Fraud Detection */
const ANOMALY_OK_BUNDLE = {
  title: { zh: '异常检测 · Agent 运行轨迹', en: 'Anomaly & Fraud Detection · Agent Run-Trace', ar: 'اكتشاف الانحراف والاحتيال · مسار الوكيل' },
  subtitle: { zh: 'Al-Rajhi 建设 INV-2026-0731 · 低风险', en: 'Al-Rajhi INV-2026-0731 · low risk', ar: 'الراجحي INV-2026-0731 · مخاطر منخفضة' },
  agentTag: 'anomaly',
  steps: [
    {
      agent: 'anomaly',
      title: { zh: '费率基准与缴款方画像', en: 'Fee tariff & payer profile', ar: 'معيار الرسوم وملف الجهة الدافعة' },
      handoff: { zh: '接收合规输出：税务合规', en: 'Received compliance output: tax-compliant', ar: 'استلام مخرجات الامتثال: متوافق' },
      blocks: [
        tool('revenue.fee_benchmark', { category: 'construction', unit_price: 375 }, { benchmark_unit: 372, deviation_pct: 0.8, sample_size: 512 }, 300),
        tool('erp.get_payer_profile', { payer: 'Al-Rajhi Construction Group', cr: 'CR-1010-448120' }, { since_year: 2014, invoices_90d: 41, on_time_rate: 0.94, first_time: false }, 240),
        obs({ zh: '费用贴近基准（+0.8%），老缴款方，90 天内 41 张、按时率 94%。', en: 'Fee near tariff (+0.8%); established payer with 41 invoices in 90d, 94% on-time.', ar: 'الرسم قرب المعيار (+0.8٪)؛ جهة دافعة راسخة بـ41 فاتورة و94٪ التزام.' }, 'ok'),
        conf(12, { zh: '风险评分 0-100', en: 'Risk score 0-100', ar: 'درجة 0-100' }, [
          { label: { zh: '价格偏离极小', en: 'Minimal price deviation', ar: 'انحراف ضئيل' }, points: 6 },
          { label: { zh: '缴款方历史稳定', en: 'Stable payer history', ar: 'سجل مستقر' }, points: 4 },
          { label: { zh: '金额非整数异常', en: 'Non-round amount', ar: 'مبلغ غير دائري' }, points: 2 }
        ], { risk: true }),
        decide({ zh: '风险评分 12（低危），无欺诈特征 → 自动继续至模式识别。', en: 'Risk 12 (low), no fraud signals → auto-continue to Pattern Recognition.', ar: 'درجة 12 (منخفضة)، بلا احتيال → متابعة تلقائية للتعرف على الأنماط.' }, 'ok', true, { zh: '风险 < 阈值 → 自动继续', en: 'risk < threshold → auto-continue', ar: 'مخاطر < الحد → متابعة تلقائية' })
      ]
    }
  ],
  conclusion: { text: { zh: '费用贴近基准，缴款方稳定，风险评分 12（低），自动继续。', en: 'Fee near tariff, stable payer, risk 12 (low) — auto-continue.', ar: 'الرسم قرب المعيار، جهة دافعة مستقرة، درجة 12 — متابعة تلقائية.' }, confidence: 88, tone: 'ok', action: { zh: '继续至模式识别', en: 'Continue to Pattern Recognition', ar: 'المتابعة إلى التعرف على الأنماط' } }
};

const PIPE_RISK_BUNDLE = {
  title: { zh: '异常检测 · Agent 运行轨迹', en: 'Anomaly & Fraud Detection · Agent Run-Trace', ar: 'اكتشاف الانحراف والاحتيال · مسار الوكيل' },
  subtitle: { zh: 'NEOM 物流 INV-2026-0730 · 费用与缴款方画像', en: 'NEOM Logistics INV-2026-0730 · fee & payer profile', ar: 'NEOM · الرسم وملف الجهة الدافعة' },
  agentTag: 'anomaly',
  steps: [
    {
      agent: 'anomaly',
      title: { zh: '缴款方画像与费率基准', en: 'Payer profile & fee tariff', ar: 'ملف الجهة الدافعة ومعيار الرسوم' },
      handoff: { zh: '接收合规输出：税务合规', en: 'Received compliance output: tax-compliant', ar: 'استلام مخرجات الامتثال: متوافق' },
      blocks: [
        think({ zh: '匹配通过但费用待核。查询同品类基准价与该缴款方 90 天历史。', en: 'Match passed but the fee needs review. Querying category tariff and the payer 90-day history.', ar: 'اجتازت المطابقة لكن الرسم يحتاج مراجعة. أستعلم عن معيار الفئة وتاريخ الجهة الدافعة 90 يوماً.' }),
        tool('revenue.fee_benchmark', { category: 'heavy_transport', unit_price: 3200 }, { benchmark_unit: 2320, deviation_pct: 37.9, sample_size: 214, currency: 'SAR' }, 320),
        tool('erp.get_payer_profile', { payer: 'NEOM Logistics', cr: 'CR-7010-990015' }, { since_year: 2026, invoices_90d: 0, first_time: true, on_time_rate: null }, 260),
        obs({ zh: '单价高于基准 +38%；该缴款方 90 天内无历史，为首次收费。', en: 'Unit rate +38% over the tariff; no 90-day history for this payer — first-time charge.', ar: 'السعر +38٪ فوق المعيار؛ لا تاريخ لهذه الجهة الدافعة خلال 90 يوماً — أول تحصيل.' }, 'danger')
      ]
    },
    {
      agent: 'anomaly',
      title: { zh: '价格 vs 基准与证据', en: 'Price vs benchmark & evidence', ar: 'السعر مقابل المعيار والأدلة' },
      blocks: [
        chart('priceBench', { labels: [{ zh: '重型运输', en: 'Heavy transport', ar: 'نقل ثقيل' }], invoice: [3200], benchmark: [2320] }),
        evid([
          { source: 'Sanad · SANAD-CT-7715', detail: { zh: '合同基准价 2,320 SAR/车次；本单 INV-2026-0730 单价 3,200 SAR（+37.9%）。', en: 'Contract benchmark 2,320 SAR/trip; this invoice INV-2026-0730 unit_price 3,200 SAR (+37.9%).', ar: 'معيار العقد 2,320 ر.س/رحلة؛ هذه الفاتورة 3,200 ر.س (+37.9٪).' }, tone: 'danger' }
        ])
      ]
    },
    {
      agent: 'anomaly',
      title: { zh: '欺诈评分拆解', en: 'Fraud-score breakdown', ar: 'تفصيل درجة الاحتيال' },
      blocks: [
        tool('ml.fraud_score', { features: { fee_deviation: 0.379, first_time_payer: true, round_amount: true } }, { score: 82, band: 'high', top_factor: 'fee_deviation' }, 300),
        chart('factorBar', { labels: [{ zh: '价格偏离', en: 'Price deviation', ar: 'انحراف السعر' }, { zh: '首次收费', en: 'First-time payer', ar: 'جهة دافعة لأول مرة' }, { zh: '疑似金额偏差/错误', en: 'Suspected value deviation/error', ar: 'اشتباه انحراف/خطأ في القيمة' }], values: [38, 26, 18], max: 100 }),
        conf(82, { zh: '风险评分 0-100', en: 'Risk score 0-100', ar: 'درجة 0-100' }, [
          { label: { zh: '价格偏离 (权重 0.45)', en: 'Price deviation (w 0.45)', ar: 'انحراف السعر (0.45)' }, points: 38 },
          { label: { zh: '首次收费 (权重 0.30)', en: 'First-time payer (w 0.30)', ar: 'جهة دافعة جديدة (0.30)' }, points: 26 },
          { label: { zh: '疑似金额偏差/错误 (权重 0.25)', en: 'Suspected value deviation/error (w 0.25)', ar: 'اشتباه انحراف/خطأ في القيمة (0.25)' }, points: 18 }
        ], { risk: true }),
        decide({ zh: '风险评分 82（高危）→ 暂停自动征收，移交审计师复核。', en: 'Risk 82 (high) → pause auto-collection and refer to auditor.', ar: 'درجة 82 (عالية) → إيقاف التحصيل وإحالة للمدقق.' }, 'danger', false, { zh: '高危 → 审计师人工复核', en: 'high risk → auditor review', ar: 'مخاطر عالية → مراجعة المدقق' })
      ]
    }
  ],
  conclusion: { text: { zh: '风险评分 82（高危）— 转审计师复核。', en: 'Risk 82 (high) — referred to auditor.', ar: 'درجة 82 (عالية) — للمدقق.' }, tone: 'danger', action: { zh: '暂停自动征收，转人工复核', en: 'Pause auto-collection; manual review', ar: 'إيقاف التحصيل؛ مراجعة يدوية' } }
};

/* ================================================================ Pattern Recognition (new agent) */
const PATTERN_OK_BUNDLE = {
  title: { zh: '模式识别 · Agent 运行轨迹', en: 'Pattern Recognition · Agent Run-Trace', ar: 'التعرف على الأنماط · مسار الوكيل' },
  subtitle: { zh: 'Al-Rajhi 建设 · 提交频率与定价趋势', en: 'Al-Rajhi · submission frequency & pricing trend', ar: 'الراجحي · تكرار الإرسال واتجاه التسعير' },
  agentTag: 'pattern',
  steps: [
    {
      agent: 'pattern',
      title: { zh: '跨发票趋势比对', en: 'Cross-invoice trend comparison', ar: 'مقارنة الاتجاهات عبر الفواتير' },
      handoff: { zh: '接收异常检测输出：风险 12（低危）', en: 'Received anomaly output: risk 12 (low)', ar: 'استلام مخرجات الانحراف: درجة 12 (منخفضة)' },
      blocks: [
        tool('graph.related_charges', { payer: 'Al-Rajhi Construction Group', window_days: 90 }, { related_invoices: 6, avg_gap_days: 15, threshold_evasion: false }, 260),
        obs({ zh: '提交频率与金额分布均在该缴款方历史常规范围内，未见阈值规避或异常聚集。', en: "Submission frequency and amount distribution fall within this payer's historical norms — no threshold evasion or clustering.", ar: 'تكرار الإرسال وتوزيع المبالغ ضمن السلوك المعتاد لهذه الجهة الدافعة — لا تفادٍ للحدود أو تجمّع غير معتاد.' }, 'ok'),
        decide({ zh: '未见异常模式 → 自动继续至审批路由。', en: 'No unusual pattern → auto-continue to Approval Routing.', ar: 'لا نمط منحرف → متابعة تلقائية للتوجيه.' }, 'ok', true, { zh: '无异常模式 → 自动继续', en: 'no unusual pattern → auto-continue', ar: 'لا نمط منحرف → متابعة تلقائية' })
      ]
    }
  ],
  conclusion: { text: { zh: '未见异常提交频率或定价模式，与该缴款方历史一致，自动继续。', en: 'No unusual submission frequency or pricing pattern vs. this payer\'s history — auto-continue.', ar: 'لا نمط تكرار أو تسعير غير معتاد مقارنة بسجل هذه الجهة الدافعة — متابعة تلقائية.' }, confidence: 91, tone: 'ok', action: { zh: '继续至审批路由', en: 'Continue to Approval Routing', ar: 'المتابعة إلى التوجيه' } }
};

// Which node the scenario stalls at (0-based, matches PIPELINE in mock.js).
// 0 ingest, 1 ocr, 2 normalize, 3 dedup, 4 validation, 5 compliance, 6 anomaly,
// 7 pattern, 8 routing, 9 forecasting, 10 analytics. null = runs the full chain.
export const SCENARIO_STALL = { normal: null, fraud: 6, dup: 3, taxfail: 5 };

// Pending action / why-blocked label for the stalled node.
export const SCENARIO_PENDING = {
  fraud: { zh: '欺诈风险评分 82，等待审计师人工复核', en: 'Fraud risk score 82 — awaiting auditor manual review', ar: 'درجة احتيال 82 — بانتظار مراجعة المدقق' },
  dup: { zh: '检测到重复发票，已拦截，等待人工确认', en: 'Duplicate invoice detected, blocked — awaiting human confirm', ar: 'تم اكتشاف فاتورة مكررة، محظورة — بانتظار التأكيد' },
  taxfail: { zh: '税务/匹配置信度 68% < 75%，转合规人工复核', en: 'Tax/match confidence 68% < 75% — referred to compliance', ar: 'ثقة 68٪ < 75٪ — تمت الإحالة إلى الامتثال' }
};

/* ================================================================ Routing */
const ROUTE_OK_BUNDLE = {
  title: { zh: '审批路由 · Agent 运行轨迹', en: 'Approval Routing · Agent Run-Trace', ar: 'توجيه الاعتماد · مسار الوكيل' },
  subtitle: { zh: 'Al-Rajhi 建设 · 1.25M SAR · 三级链', en: 'Al-Rajhi · 1.25M SAR · 3-level chain', ar: 'الراجحي · 1.25M · 3 مستويات' },
  agentTag: 'routing',
  steps: [
    {
      agent: 'routing',
      title: { zh: '授权矩阵与审批链', en: 'Authorization matrix & chain', ar: 'مصفوفة التفويض والسلسلة' },
      handoff: { zh: '接收模式识别输出：无异常模式', en: 'Received pattern output: no unusual pattern', ar: 'استلام مخرجات الأنماط: لا نمط منحرف' },
      blocks: [
        think({ zh: '按金额与部门在授权矩阵中定位审批层级并生成审批卡片。', en: 'Locating the approval level in the authorization matrix by amount and department and generating the approval card.', ar: 'تحديد المستوى في مصفوفة التفويض وإنشاء بطاقة الموافقة.' }),
        tool('routing.match_authority', { amount: 1250000, department: 'Procurement' }, { chain_levels: 3, requires: ['Invoice Clerk', 'Finance Manager', 'Budget & Finance'] }, 190),
        obs({ zh: '金额触发三级审批链，风险低且完全匹配。', en: 'Amount triggers a 3-level chain; risk is low with a full match.', ar: 'المبلغ يطلق سلسلة من 3 مستويات؛ مخاطر منخفضة ومطابقة كاملة.' }, 'ok'),
        decide({ zh: 'AI 建议批准；推送人工确认（HITL）。', en: 'AI recommends approve; pushed to human confirm (HITL).', ar: 'يوصي الذكاء بالموافقة؛ أُرسل للتأكيد البشري (HITL).' }, 'ok', false, { zh: '低风险 → 人工确认', en: 'low risk → human confirm', ar: 'مخاطر منخفضة → تأكيد بشري' })
      ]
    }
  ],
  conclusion: { text: { zh: '三级审批链已分发，AI 建议批准，等待人工确认。', en: '3-level chain dispatched; AI recommends approve, awaiting human confirm.', ar: 'توزيع سلسلة من 3 مستويات؛ يوصي الذكاء بالموافقة بانتظار التأكيد.' }, confidence: 95, tone: 'ok', action: { zh: '推送人工确认（HITL）', en: 'Push to human confirm (HITL)', ar: 'الدفع للتأكيد البشري (HITL)' } }
};

/* ================================================================ Forecasting */
const FORECAST_OK_BUNDLE = {
  title: { zh: '催收预测 · Agent 运行轨迹', en: 'Collection Probability Forecasting · Agent Run-Trace', ar: 'التنبؤ باحتمالية التحصيل · مسار الوكيل' },
  subtitle: { zh: 'INV-2026-0731 · 结算周期建模', en: 'INV-2026-0731 · settlement modeling', ar: 'INV-2026-0731 · نمذجة التسوية' },
  agentTag: 'forecasting',
  steps: [
    {
      agent: 'forecasting',
      title: { zh: '结算周期与回收概率', en: 'Settlement cycle & recovery prob.', ar: 'دورة التسوية واحتمال التحصيل' },
      handoff: { zh: '接收审批路由输出：待人工审批', en: 'Received routing output: pending approval', ar: 'استلام مخرجات التوجيه: بانتظار الموافقة' },
      blocks: [
        think({ zh: '基于合同账期与缴款方历史，预测结算时点与回收概率。', en: 'Modeling settlement timing and recovery probability from contract terms and payer history.', ar: 'أنمذج توقيت التسوية والاحتمال من شروط العقد وتاريخ الجهة الدافعة.' }),
        tool('forecast.collection_probability', { invoice: 'INV-2026-0731', overdue_days: 0, segment: 'construction' }, { probability: 0.95, expected_settlement_days: 42, litigation: 'none' }, 320),
        chart('collectionCurve', { labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'], values: [80, 84, 88, 91, 93, 95] }),
        decide({ zh: '回收概率 95%，结算周期正常 → 无需干预，进入分析归档。', en: 'Recovery 95%, normal settlement → no intervention, proceed to analytics.', ar: 'الاحتمال 95٪، تسوية طبيعية → دون تدخل، إلى التحليلات.' }, 'ok', true, { zh: '概率 ≥ 75% → 自动流转', en: 'prob ≥ 75% → auto flow', ar: 'الاحتمال ≥ 75٪ → تدفق تلقائي' })
      ]
    }
  ],
  conclusion: { text: { zh: '回收概率 95%，预计 42 天内结算，无需人工干预。', en: 'Recovery probability 95%, settlement in ~42 days, no intervention needed.', ar: 'الاحتمال 95٪، التسوية خلال ~42 يوماً، دون تدخل.' }, confidence: 95, tone: 'ok', action: { zh: '进入分析归档', en: 'Proceed to Performance Analytics', ar: 'المتابعة إلى التحليلات' } }
};

/* ================================================================ Analytics */
const ANALYTICS_BUNDLE = {
  title: { zh: '分析归档 · Agent 运行轨迹', en: 'Performance Analytics · Agent Run-Trace', ar: 'تحليلات الأداء · مسار الوكيل' },
  subtitle: { zh: 'KPI 汇总 · 审计留痕', en: 'KPI aggregation · audit trail', ar: 'تجميع المؤشرات · سجل التدقيق' },
  agentTag: 'analytics',
  steps: [
    {
      agent: 'analytics',
      title: { zh: 'KPI 汇总与审计留痕', en: 'KPI aggregation & audit trail', ar: 'تجميع المؤشرات وسجل التدقيق' },
      handoff: { zh: '接收催收预测输出：结算周期正常', en: 'Received forecasting output: normal settlement', ar: 'استلام مخرجات التنبؤ: تسوية طبيعية' },
      blocks: [
        tool('analytics.aggregate_kpis', { invoice: 'INV-2026-0731' }, { kpis_updated: 6, ledger: 'posted', audit_hash: '0x7f3a9c21', immutable: true }, 230),
        decide({ zh: '6 项 KPI 已更新，审计留痕已写入不可变账本 → 流程闭环。', en: '6 KPIs updated, audit trail written to the immutable ledger → loop closed.', ar: 'تحديث 6 مؤشرات وكتابة سجل التدقيق في دفتر ثابت → إغلاق الحلقة.' }, 'ok', true, { zh: '全链路完成 → 自动归档', en: 'chain complete → auto-archive', ar: 'اكتمال السلسلة → أرشفة تلقائية' })
      ]
    }
  ],
  conclusion: { text: { zh: '6 项 KPI 已更新，审计留痕写入不可变账本，全链路闭环。', en: '6 KPIs updated, audit trail on the immutable ledger — full-chain loop closed.', ar: 'تحديث 6 مؤشرات وسجل تدقيق ثابت — إغلاق كامل للحلقة.' }, confidence: 99, tone: 'ok', action: { zh: '归档完成', en: 'Archived', ar: 'تمت الأرشفة' } }
};

// Per-scenario node drawers: which agent nodes expose "view AI analysis".
export const NODE_DRAWERS = {
  normal: {
    ingest: ingestBundle('normal'),
    ocr: ocrBundle('normal'),
    normalize: normalizeBundle('normal'),
    dedup: dedupBundle('normal'),
    validation: validationBundle('normal'),
    compliance: complianceBundle('normal'),
    anomaly: ANOMALY_OK_BUNDLE,
    pattern: PATTERN_OK_BUNDLE,
    routing: ROUTE_OK_BUNDLE,
    forecasting: FORECAST_OK_BUNDLE,
    analytics: ANALYTICS_BUNDLE
  },
  fraud: {
    ingest: ingestBundle('fraud'),
    ocr: ocrBundle('fraud'),
    normalize: normalizeBundle('fraud'),
    dedup: dedupBundle('fraud'),
    validation: validationBundle('fraud'),
    compliance: complianceBundle('fraud'),
    anomaly: PIPE_RISK_BUNDLE
  },
  dup: {
    ingest: ingestBundle('dup'),
    ocr: ocrBundle('dup'),
    normalize: normalizeBundle('dup'),
    dedup: dedupBundle('dup')
  },
  taxfail: {
    ingest: ingestBundle('taxfail'),
    ocr: ocrBundle('taxfail'),
    normalize: normalizeBundle('taxfail'),
    dedup: dedupBundle('taxfail'),
    validation: validationBundle('taxfail'),
    compliance: complianceBundle('taxfail')
  }
};

/* ---------------------------------------------------------------- Risk Radar */
export const RISK_ANALYSIS = {
  'INV-2026-0730': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'NEOM 物流服务 · 风险评分 82', en: 'NEOM Logistics · risk score 82', ar: 'NEOM · درجة 82' },
    agentTag: 'anomaly',
    steps: PIPE_RISK_BUNDLE.steps,
    conclusion: PIPE_RISK_BUNDLE.conclusion
  },
  'INV-2026-0709': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'Desert Rose 贸易 · 风险评分 74', en: 'Desert Rose Trading · risk score 74', ar: 'وردة الصحراء · درجة 74' },
    agentTag: 'pattern',
    steps: [
      {
        agent: 'pattern',
        title: { zh: '高频提交与阈值规避', en: 'High-frequency & threshold evasion', ar: 'تكرار وتجاوز الحد' },
        blocks: [
          think({ zh: '检测到同一缴款方短期高频提交，检索关联账单。', en: 'Detected high-frequency submissions from one payer; retrieving related invoices.', ar: 'رصدت تقديمات متكررة من جهة دافعة واحدة؛ أجلب الفواتير المرتبطة.' }),
          tool('graph.related_charges', { payer: 'Desert Rose Trading', window_days: 7 }, { related_invoices: 5, each_amount: 998000, threshold: 1000000, gap_pct: 0.2 }, 300),
          obs({ zh: '7 天内 5 张均为 998K SAR，均低于 100 万审批阈值 0.2%，疑似拆单。', en: '5 invoices of 998K SAR each in 7 days, all 0.2% below the 1M approval threshold — suspected splitting.', ar: '5 فواتير 998K خلال 7 أيام، الكل تحت الحد بـ0.2٪ — يُشتبه بالتقسيم.' }, 'danger'),
          conf(74, { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' }, [
            { label: { zh: '阈值规避', en: 'Threshold evasion', ar: 'تجاوز الحد' }, points: 44 },
            { label: { zh: '短期高频', en: 'High frequency', ar: 'تكرار مرتفع' }, points: 30 }
          ], { risk: true }),
          decide({ zh: '疑似拆单规避审批，标记待审计师合并核查。', en: 'Suspected invoice-splitting to evade approval; flagged for auditor to audit together.', ar: 'يُشتبه بالتقسيم؛ موسوم للمدقق للفحص المجمّع.' }, 'danger', false, { zh: '拆单模式 → 审计师复核', en: 'splitting pattern → auditor review', ar: 'نمط تقسيم → مراجعة المدقق' })
        ]
      }
    ],
    conclusion: { text: { zh: '疑似拆单规避审批，风险评分 74，标记待审计师核查。', en: 'Suspected invoice-splitting to evade approval; risk 74, flagged for auditor.', ar: 'يُشتبه بالتقسيم؛ درجة 74، موسوم للمدقق.' }, tone: 'danger', action: { zh: '合并审计 5 张关联账单', en: 'Audit the 5 related invoices together', ar: 'تدقيق الفواتير الخمس معاً' } }
  },
  'INV-2026-0688': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'Falcon 工程 · 风险评分 58', en: 'Falcon Engineering · risk score 58', ar: 'فالكون · درجة 58' },
    agentTag: 'compliance',
    steps: [
      {
        agent: 'compliance',
        title: { zh: '主体一致性核查', en: 'Entity consistency check', ar: 'فحص اتساق الكيان' },
        blocks: [
          tool('sanad.lookup_contract', { vat: '3007788990000004' }, { vat_owner: 'Falcon Engineering Ltd', contract_signatory: 'Falcon Holdings', match: false }, 260),
          obs({ zh: 'VAT 号归属主体与 Makin 合同签约主体不一致。', en: 'VAT owner differs from the Makin contract signatory.', ar: 'مالك الرقم يختلف عن موقّع العقد.' }, 'warn'),
          conf(58, { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' }, [
            { label: { zh: '主体不一致', en: 'Entity mismatch', ar: 'عدم تطابق الكيان' }, points: 38 },
            { label: { zh: '无关联映射', en: 'No affiliation mapping', ar: 'لا ربط انتماء' }, points: 20 }
          ], { risk: true }),
          decide({ zh: '税号与合同主体不一致，转合规复核关联关系。', en: 'VAT-contract entity mismatch; referred to compliance to verify affiliation.', ar: 'عدم تطابق؛ تمت الإحالة إلى الامتثال للتحقق من العلاقة.' }, 'warn', false, { zh: '主体不一致 → 合规复核', en: 'entity mismatch → compliance', ar: 'عدم تطابق → الامتثال' })
        ]
      }
    ],
    conclusion: { text: { zh: '税号与合同主体不一致，风险评分 58，转合规复核。', en: 'VAT-contract entity mismatch; risk 58, referred to compliance.', ar: 'عدم تطابق؛ درجة 58، تمت الإحالة إلى الامتثال.' }, tone: 'warn', action: { zh: '核实关联关系或退回补正', en: 'Verify affiliation or return for correction', ar: 'التحقق أو الإرجاع للتصحيح' } }
  },
  'INV-2026-0655': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'Oasis 服务 · 风险评分 41', en: 'Oasis Services · risk score 41', ar: 'واحة · درجة 41' },
    agentTag: 'pattern',
    steps: [
      {
        agent: 'pattern',
        title: { zh: '账期偏离分析', en: 'Payment-term deviation', ar: 'انحراف مدة السداد' },
        blocks: [
          tool('sanad.lookup_contract', { contract: 'SANAD-CT-2655' }, { agreed_term_days: 60, invoice_demand_days: 7 }, 240),
          obs({ zh: '合同约定账期 60 天，本单要求 7 天内付款。', en: 'Contract term is 60 days but the invoice demands payment within 7.', ar: 'مدة العقد 60 يوماً لكن الطلب خلال 7.' }, 'warn'),
          conf(41, { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' }, [
            { label: { zh: '账期异常缩短', en: 'Term abnormally short', ar: 'مدة قصيرة غير طبيعية' }, points: 41 }
          ], { risk: true }),
          decide({ zh: '付款周期异常缩短，提示财务经理按合同账期付款，勿加速。', en: 'Abnormally short term; flag finance manager to pay per contract term, not accelerate.', ar: 'مدة قصيرة؛ تنبيه المدير المالي للدفع وفق العقد دون تسريع.' }, 'warn', false, { zh: '账期偏离 → 财务经理关注', en: 'term deviation → finance manager', ar: 'انحراف المدة → المدير المالي' })
        ]
      }
    ],
    conclusion: { text: { zh: '付款周期异常缩短，风险评分 41，提示财务经理关注。', en: 'Abnormally short term; risk 41, flagged for finance manager.', ar: 'مدة قصيرة؛ درجة 41، تنبيه للمدير المالي.' }, tone: 'warn', action: { zh: '按合同账期付款，勿加速', en: 'Pay per contract term; do not accelerate', ar: 'الدفع وفق العقد؛ دون تسريع' } }
  },
  'INV-2026-0642': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: 'Jizan 投资方 · 风险评分 91', en: 'Jizan Investor · risk score 91', ar: 'مستثمر جازان · درجة 91' },
    agentTag: 'anomaly',
    steps: [
      {
        agent: 'anomaly',
        title: { zh: '与辖区历史上限对比', en: 'Compare against jurisdiction historical ceiling', ar: 'مقارنة بالسقف التاريخي للأمانة' },
        blocks: [
          tool('erp.get_payer_profile', { payer: 'Jizan Investor', amanah: 'Jizan' }, { historical_max_sar: 2000000, invoices_90d: 0, first_time: true }, 260),
          obs({ zh: '吉赞省安曼历史最高单张账单为 200 万 SAR，本单高达 1900 万 SAR。', en: "Jizan Amanah's highest historical invoice is 2M SAR; this one is 19M SAR.", ar: 'أعلى فاتورة تاريخية لأمانة جازان 2 مليون ر.س؛ هذه الفاتورة 19 مليون ر.س.' }, 'danger'),
          conf(91, { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' }, [
            { label: { zh: '远超辖区历史上限', en: 'Far exceeds jurisdiction ceiling', ar: 'تجاوز كبير للسقف التاريخي' }, points: 65 },
            { label: { zh: '首次缴款方', en: 'First-time payer', ar: 'جهة دافعة لأول مرة' }, points: 26 }
          ], { risk: true }),
          decide({ zh: '统计异常，立即暂停自动处理，转人工核实。', en: 'Statistical anomaly; immediately pause auto-processing and refer for manual verification.', ar: 'انحراف إحصائي؛ إيقاف المعالجة الآلية فوراً والإحالة للتحقق اليدوي.' }, 'danger', false, { zh: '统计异常 → 人工核实', en: 'statistical anomaly → manual verification', ar: 'انحراف إحصائي → تحقق يدوي' })
        ]
      }
    ],
    conclusion: { text: { zh: '金额远超该辖区历史上限，风险评分 91，已暂停并转人工核实。', en: "Amount far exceeds this jurisdiction's historical ceiling; risk 91, paused and referred for manual verification.", ar: 'مبلغ يتجاوز بكثير السقف التاريخي؛ درجة 91، تم الإيقاف والإحالة للتحقق.' }, tone: 'danger', action: { zh: '人工核实真实性', en: 'Manually verify legitimacy', ar: 'التحقق اليدوي من الصحة' } }
  },
  'INV-2026-0601': {
    title: { zh: '风险分析过程', en: 'Risk Analysis Process', ar: 'عملية تحليل المخاطر' },
    subtitle: { zh: '缴款方（已故）· 风险评分 34', en: 'Payer (deceased) · risk score 34', ar: 'جهة دافعة (متوفاة) · درجة 34' },
    agentTag: 'anomaly',
    steps: [
      {
        agent: 'anomaly',
        title: { zh: '民事登记比对', en: 'Civil Status cross-check', ar: 'مطابقة مع الأحوال المدنية' },
        blocks: [
          tool('civil_status.check_life_status', { national_id: '10XX-XXXX-XX' }, { status: 'deceased', death_date: '2026-04-12' }, 220),
          obs({ zh: '缴款方民事登记状态为已故（2026-04-12）；需核实本次违规日期是否早于死亡日期。', en: "Civil Status shows the payer as deceased (2026-04-12); need to verify whether this violation predates the death date.", ar: 'سجل الأحوال المدنية يفيد بوفاة الجهة الدافعة (2026-04-12)؛ يلزم التحقق من تاريخ المخالفة مقارنة بتاريخ الوفاة.' }, 'warn'),
          conf(34, { zh: '风险评分', en: 'Risk score', ar: 'الدرجة' }, [
            { label: { zh: '缴款方已故', en: 'Payer deceased', ar: 'الجهة الدافعة متوفاة' }, points: 34 }
          ], { risk: true }),
          decide({ zh: '暂缓自动取消，先核实违规行为是否发生在死亡日期之前。', en: 'Hold before auto-cancelling; first verify whether the violation occurred before the date of death.', ar: 'تعليق الإلغاء التلقائي لحين التحقق من وقوع المخالفة قبل تاريخ الوفاة.' }, 'warn', false, { zh: '已故 → 核实违规时间', en: 'deceased → verify violation timing', ar: 'متوفى → التحقق من توقيت المخالفة' })
        ]
      }
    ],
    conclusion: { text: { zh: '缴款方已故，风险评分 34，暂缓取消并核实违规时间。', en: 'Payer is deceased; risk 34, hold on cancellation pending violation-timing verification.', ar: 'الجهة الدافعة متوفاة؛ درجة 34، تعليق الإلغاء لحين التحقق من التوقيت.' }, tone: 'warn', action: { zh: '核实后按部长理事会决议处理', en: 'After verification, apply per the Council of Ministers decision', ar: 'المعالجة وفق قرار مجلس الوزراء بعد التحقق' } }
  }
};

/* ---------------------------------------------------------------- Approvals */
function approvalBundle(sub, amount, chainLevels, requires, matchConf, tone, auto, gateRule, recText, actionText, extra = []) {
  return {
    title: { zh: '审批路由 · Agent 运行轨迹', en: 'Approval Routing · Agent Run-Trace', ar: 'توجيه الاعتماد · مسار الوكيل' },
    subtitle: sub,
    agentTag: 'routing',
    steps: [
      {
        agent: 'routing',
        title: { zh: '授权矩阵匹配', en: 'Authorization-matrix match', ar: 'مطابقة مصفوفة التفويض' },
        blocks: [
          think({ zh: '按金额与部门在授权矩阵中定位审批层级。', en: 'Locating the approval level in the authorization matrix by amount and department.', ar: 'تحديد مستوى الموافقة في مصفوفة التفويض حسب المبلغ والقسم.' }),
          tool('routing.match_authority', { amount, department: 'Procurement' }, { chain_levels: chainLevels, requires }, 200),
          obs({ zh: `金额触发 ${chainLevels} 级审批链，需 ${requires.join(' / ')}。`, en: `Amount triggers a ${chainLevels}-level chain, requiring ${requires.join(' / ')}.`, ar: `المبلغ يطلق سلسلة ${chainLevels} مستويات، تتطلب ${requires.join(' / ')}.` })
        ]
      },
      {
        agent: 'routing',
        title: { zh: '风险 / 匹配 / SLA 依据', en: 'Risk / match / SLA basis', ar: 'المخاطر / المطابقة / SLA' },
        blocks: [
          ...extra,
          conf(matchConf, { zh: '建议置信度', en: 'Recommendation confidence', ar: 'ثقة التوصية' }, [
            { label: { zh: '匹配结果', en: 'Match result', ar: 'نتيجة المطابقة' }, points: Math.round(matchConf * 0.6) },
            { label: { zh: '风险与合规', en: 'Risk & compliance', ar: 'المخاطر والامتثال' }, points: matchConf - Math.round(matchConf * 0.6) }
          ]),
          decide(recText, tone, auto, gateRule)
        ]
      }
    ],
    conclusion: { text: recText, tone, action: actionText }
  };
}

export const APPROVAL_BASIS = {
  'INV-2026-0727': approvalBundle(
    { zh: 'Aramco 后勤 · 3.18M SAR', en: 'Aramco Logistics · 3.18M SAR', ar: 'Aramco · 3.18M' },
    3180000, 6, ['Center Director', 'CFO'], 68, 'warn', false,
    { zh: '置信度 68% < 75% → 人工决策', en: 'confidence 68% < 75% → human decides', ar: 'الثقة 68٪ < 75٪ → قرار بشري' },
    { zh: 'AI 建议：退回补正税号/催收单差异后再审批。人工做最终决策。', en: 'AI recommends: return for tax/Collection-Order correction before approval. Human decides.', ar: 'يوصي الذكاء: الإرجاع للتصحيح قبل الموافقة. القرار للبشر.' },
    { zh: '退回 / 升级 / 批准（人工选择）', en: 'Return / Escalate / Approve (human choice)', ar: 'إرجاع / تصعيد / موافقة' },
    [tool('sla.check', { invoice: 'INV-2026-0727', sla_hours: 4 }, { elapsed_hours: 12, overrun: true, escalated_to: 'Center Director' }, 180),
      evid([{ source: 'Compliance · match_confidence', detail: { zh: '上游合规置信度 68%，单价与催收单差异导致总额 +2.4%，税号校验失败。', en: 'Upstream compliance confidence 68%; unit-price vs Collection-Order gap drives total +2.4%, tax-ID failed.', ar: 'ثقة الامتثال 68٪؛ فرق السعر يرفع الإجمالي +2.4٪، وفشل الرقم الضريبي.' }, tone: 'danger' }])]
  ),
  'INV-2026-0724': approvalBundle(
    { zh: 'Bahri 海运物流 · 2.26M SAR', en: 'Bahri Maritime · 2.26M SAR', ar: 'البحري · 2.26M' },
    2260000, 4, ['Center Director'], 90, 'ok', false,
    { zh: '置信度 90% ≥ 75%，低风险 → 人工确认即可', en: 'confidence 90% ≥ 75%, low risk → human confirm', ar: 'الثقة 90٪ ≥ 75٪، مخاطر منخفضة → تأكيد بشري' },
    { zh: 'AI 建议：批准。匹配完整、风险低。人工确认即可。', en: 'AI recommends: approve. Full match, low risk. Human to confirm.', ar: 'يوصي الذكاء: الموافقة. مطابقة كاملة ومخاطر منخفضة.' },
    { zh: '批准征收', en: 'Approve collection', ar: 'اعتماد التحصيل' },
    [obs({ zh: '三单完全匹配，风险评分 33（中低），无异常触发。', en: 'Full 3-way match, risk 33 (low-mid), no anomaly.', ar: 'مطابقة كاملة، درجة 33، لا انحراف.' }, 'ok')]
  ),
  'INV-2026-0731': approvalBundle(
    { zh: 'Al-Rajhi 建设 · 1.25M SAR', en: 'Al-Rajhi Construction · 1.25M SAR', ar: 'الراجحي · 1.25M' },
    1250000, 3, ['Budget & Finance'], 95, 'ok', false,
    { zh: '置信度 95% ≥ 75%，低风险且合规 → 人工确认即可', en: 'confidence 95% ≥ 75%, low risk & compliant → human confirm', ar: 'الثقة 95٪ ≥ 75٪، متوافق → تأكيد بشري' },
    { zh: 'AI 建议：批准。低风险且合规。人工做最终决策。', en: 'AI recommends: approve. Low risk & compliant. Human decides.', ar: 'يوصي الذكاء: الموافقة. مخاطر منخفضة ومتوافق.' },
    { zh: '批准征收', en: 'Approve collection', ar: 'اعتماد التحصيل' },
    [obs({ zh: '三单完全匹配，风险评分 12（低），税务合规。', en: 'Full match, risk 12 (low), tax compliant.', ar: 'مطابقة كاملة، درجة 12، متوافق.' }, 'ok')]
  )
};

/* ---------------------------------------------------------------- Forecast */
function forecastBundle(sub, prob, segment, overdue, litigation, curve, factors, tone, auto, gateRule, action) {
  return {
    title: { zh: '催收预测 · Agent 运行轨迹', en: 'Collection Probability Forecasting · Agent Run-Trace', ar: 'التنبؤ باحتمالية التحصيل · مسار الوكيل' },
    subtitle: sub,
    agentTag: 'forecasting',
    steps: [
      {
        agent: 'forecasting',
        title: { zh: '回收概率建模', en: 'Recovery-probability modeling', ar: 'نمذجة احتمال التحصيل' },
        blocks: [
          think({ zh: '结合细分历史收缴率、逾期天数、诉讼状态与宏观指标预测回收概率。', en: 'Combining segment collection rate, overdue days, litigation status and macro indicators to predict recovery.', ar: 'أجمع معدل الفئة وأيام التأخير وحالة التقاضي والمؤشرات الكلية لتوقع التحصيل.' }),
          tool('forecast.collection_probability', { invoice: sub.en?.split(' · ')[0] || 'invoice', overdue_days: overdue, segment }, { probability: prob / 100, segment_rate: factors.segRate, litigation }, 320),
          chart('collectionCurve', { labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'], values: curve }),
          conf(prob, { zh: '回收概率', en: 'Recovery prob.', ar: 'احتمال التحصيل' }, factors.rows),
          decide(action, tone, auto, gateRule)
        ]
      }
    ],
    conclusion: {
      text: { zh: `综合各因子，回收概率 ${prob}%。`, en: `Combined factors → recovery probability ${prob}%.`, ar: `احتمال التحصيل ${prob}%.` },
      tone, action
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
  title: { zh: '人机协作 (HITL) 运行统计', en: 'Human Oversight (HITL) Statistics', ar: 'إحصاءات الإشراف البشري (HITL)' },
  subtitle: { zh: '本月 · AI 自动处理 vs 转人工 · 断点触发', en: 'This month · auto vs human · breakpoints', ar: 'هذا الشهر · تلقائي مقابل بشري' },
  agentTag: 'orch',
  stats: [
    { value: '12,480', label: { zh: '本月已处理账单', en: 'Invoices processed', ar: 'الفواتير المعالجة' } },
    { value: '91.4%', label: { zh: 'AI 自动处理占比', en: 'Auto-processed share', ar: 'نسبة المعالجة التلقائية' } },
    { value: '1,073', label: { zh: '转人工复核', en: 'Sent to human', ar: 'أُحيلت للمراجعة البشرية' } },
    { value: '93.7%', label: { zh: '平均决策置信度', en: 'Avg decision confidence', ar: 'متوسط الثقة' } }
  ],
  steps: [
    {
      agent: 'orch',
      title: { zh: '断点来源与价值汇总', en: 'Breakpoint sources & value summary', ar: 'مصادر التوقف وملخص القيمة' },
      blocks: [
        think({ zh: '汇总本月编排层触发的 HITL 断点分布与自动化收益。', en: 'Aggregating this month\'s HITL breakpoint distribution and automation gains from the orchestrator.', ar: 'أجمّع توزيع نقاط توقف HITL ومكاسب الأتمتة لهذا الشهر.' }),
        tool('orchestrator.hitl_stats', { period: '2026-07' }, { confidence_breakpoints: 612, amount_threshold: 327, anomaly: 134, auto_share: 0.914, hours_saved: 3860 }, 260),
        evid([
          { source: 'Orchestrator · breakpoints', detail: { zh: '置信度断点 612 · 金额阈值断点 327 · 异常断点 134。', en: 'Confidence 612 · amount-threshold 327 · anomaly 134.', ar: 'ثقة 612 · حد المبلغ 327 · انحراف 134.' } }
        ]),
        decide({ zh: 'AI 出结论、人工做决策：91.4% 自动完成，其余按风险精准转人工。', en: 'AI concludes, humans decide: 91.4% automated, the rest routed to humans by risk.', ar: 'الذكاء يستنتج والبشر يقررون: 91.4٪ آلي والباقي حسب المخاطر.' }, 'ok', true, { zh: '置信度 < 75% / 超阈值 / 异常 → 人工', en: 'confidence < 75% / over threshold / anomaly → human', ar: 'الثقة < 75٪ / تجاوز / انحراف → بشري' })
      ]
    }
  ],
  conclusion: { text: { zh: 'AI 出结论、人工做决策：91.4% 自动完成，其余按风险精准转人工。', en: 'AI concludes, humans decide: 91.4% automated, the rest routed to humans by risk.', ar: 'الذكاء يستنتج والبشر يقررون: 91.4٪ آلي والباقي حسب المخاطر.' }, confidence: 94, tone: 'ok' }
};

/* ---------------------------------------------------------------- Orchestration */
// Live orchestration graph — inter-agent messages with realistic handoff
// payload summaries. `wave` groups messages that fire together (parallelism).
export const ORCH_MESSAGES = [
  { from: 'orch', to: 'ingest', wave: 0, text: { zh: '派发摄取：从 4 源拉取', en: 'dispatch ingestion: fetch from 4 sources', ar: 'إرسال الاستيعاب: جلب من 4 مصادر' } },
  { from: 'ingest', to: 'ocr', wave: 1, text: { zh: '账单已入队 → 提取字段', en: 'invoice queued → extract fields', ar: 'الفاتورة في القائمة → استخراج الحقول' } },
  { from: 'ocr', to: 'normalize', wave: 2, text: { zh: '10 字段（置信度 0.98）→ 标准化', en: '10 fields (conf 0.98) → normalize', ar: '10 حقول (ثقة 0.98) → التوحيد' } },
  { from: 'normalize', to: 'dedup', wave: 3, text: { zh: '统一模型 → 检索重复', en: 'unified model → search duplicates', ar: 'نموذج موحد → بحث التكرار' } },
  { from: 'dedup', to: 'validation', wave: 4, text: { zh: '未见重复 → 三单匹配', en: 'no duplicate → 3-way match', ar: 'لا تكرار → مطابقة ثلاثية' } },
  { from: 'validation', to: 'compliance', wave: 5, text: { zh: '匹配通过 → 税务校验', en: 'match OK → tax check', ar: 'المطابقة صحيحة → فحص ضريبي' } },
  { from: 'compliance', to: 'anomaly', wave: 6, text: { zh: '税务合规 → 价格异常评分', en: 'tax-compliant → price anomaly scoring', ar: 'متوافق → تقييم انحراف السعر' } },
  { from: 'anomaly', to: 'pattern', wave: 7, text: { zh: '风险 12（低危）→ 跨发票模式比对', en: 'risk 12 (low) → cross-invoice pattern check', ar: 'مخاطر 12 (منخفضة) → مقارنة الأنماط' } },
  { from: 'anomaly', to: 'orch', wave: 7, hitl: true, parallel: true, text: { zh: '并行：高风险案例回报编排层触发 HITL', en: 'in parallel: high-risk cases report to orchestrator → HITL', ar: 'بالتوازي: الحالات عالية الخطورة تُبلغ المنسق ← HITL' } },
  { from: 'pattern', to: 'routing', wave: 8, text: { zh: '无异常模式 → 授权矩阵匹配', en: 'no unusual pattern → authorization-matrix match', ar: 'لا نمط منحرف → مطابقة مصفوفة التفويض' } },
  { from: 'routing', to: 'forecasting', wave: 9, text: { zh: '推送人工确认 → 结算周期建模', en: 'pushed to human confirm → model settlement cycle', ar: 'إرسال للتأكيد البشري → نمذجة دورة التسوية' } },
  { from: 'routing', to: 'orch', wave: 9, hitl: true, parallel: true, text: { zh: '并行：审批 HITL 断点回报编排层', en: 'in parallel: approval HITL breakpoint reports to orchestrator', ar: 'بالتوازي: نقطة توقف الموافقة تُبلغ المنسق' } },
  { from: 'forecasting', to: 'analytics', wave: 10, text: { zh: '回收概率 0.95 → KPI 汇总', en: 'recovery prob 0.95 → aggregate KPIs', ar: 'احتمال التحصيل 0.95 → تجميع المؤشرات' } },
  { from: 'analytics', to: 'orch', wave: 11, text: { zh: 'KPI 已汇总，审计留痕已写入', en: 'KPIs aggregated, audit trail written', ar: 'تم تجميع المؤشرات وكتابة سجل التدقيق' } }
];

// Per-agent synthetic average latency (ms) for the live orchestration metrics.
export const ORCH_LATENCY = {
  ingest: 110, ocr: 190, normalize: 70, dedup: 60,
  validation: 190, compliance: 170,
  anomaly: 260, pattern: 150,
  routing: 190, forecasting: 320, analytics: 230
};
