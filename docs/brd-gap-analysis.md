# BRD 与代码实现差距分析（Gap Analysis）

| 项目 | 内容 |
|---|---|
| 核对日期 | 2026-08-26 |
| 需求文档 | 《智能发票管理 业务需求文档（BRD）v1.0 中文版》（`D:\工作\NHC\docs\invoice\IntelligentInvoice_BRD_v1.0_中文版.docx`，2026-06-25，MoMAH 共享服务） |
| 代码版本 | invoice-demo v2.0.0（commit `2c80e92`，INTELLIBILL React + Vite 演示） |
| 核对范围 | BRD 第 6/8/12/13/14 章：10 条功能需求（FR-001~010）、12 个用例（UC-01~12）、12 个界面（SCR-01~12）、12 项核心能力（CAP-01~12） |

## 一、总体结论

主链路（摄取 → OCR → 去重 → 三方对账 → 异常检测 → 审批路由 → 回款预测 → 对话查询）的**展示层**已基本演示化覆盖，对应 FR-001~009 与 SCR-01~06、SCR-09。

缺口集中在两块：

1. **BRD 后半部分的四大板块能力**：CAP-10 定期收入报表（市政+住房）、CAP-11 Makken↔Tahsil 平台级对账、CAP-12 Mumtathil 违规跟踪、UC-09 审计与审批记录审查 —— 均无对应页面。
2. **各界面的操作闭环**：审计员决定、暂停发票处置、请求澄清、时限预警、报表导出、下钻筛选等交互动作缺失，页面多为只读展示。

## 二、已覆盖对照（演示级）

| BRD 条目 | 要求摘要 | 代码落点 | 状态 |
|---|---|---|---|
| FR-001 / CAP-01 多源接入 | Email/ERP/Tahsil/Makken/Efa/Sanad 归集 | `src/data/aiProcess.js` INGEST_SOURCES（6 源）+ `src/components/ai/IngestAnimation.jsx` + Pipeline 上传区 | ⚠️ 部分（假上传，见 4.2） |
| FR-002 / CAP-02 OCR 提取 | 10 个必填字段、置信度 | `src/components/ai/OcrExtraction.jsx` + OCR_SAMPLES（10 字段逐字段置信度） | ✅ |
| FR-003 / CAP-03 重复检测 | 比对发票号/交易方/金额/日期 | dup 场景（`SCENARIO_STALL.dup=0`，卡在第一步拦截） | ✅ |
| FR-004 / CAP-04 标准化 | raw→std 统一模型 | OCR_SAMPLES.diff（金额/日期/税号 raw→std 差异展示） | ✅ |
| FR-005 / CAP-05 自动核验 | 发票↔PO↔已收服务匹配、偏差报告 | `src/components/ai/ReconciliationTable.jsx` + RECON（三方对账 + 派生状态） | ✅（发票级） |
| FR-006 / CAP-06 税务验证 | VAT 重算、税号核验（ZATCA） | taxfail 场景：declared≠expected、税号校验位失败 | ✅ |
| FR-007 权限额度合规 | 与财务授权额度表比对 | APPROVALS.reason 文案（金额分级触发 3/4/6 级审批链） | ⚠️ 文案级 |
| FR-008 / CAP-07 异常检测 | 偏差分、风险分级、原因报告 | Risk 页 + RISK_ANALYSIS（fraud 场景：价格偏离基准 +38%、首次交易） | ✅ |
| FR-009 / CAP-08 审批流转 | 按金额/类别路由、SLA、升级 | Approvals 页 + APPROVAL_BASIS（含超时升级文案） | ⚠️ 部分（见 4.5） |
| FR-010 / CAP-09 预测与对话 | 回款概率、仪表盘、三语问答 | Collection 页 + FORECAST_BASIS；Assistant 页（QA 脚本 + 建议问题 + 会话 + 图表） | ⚠️ 部分（缺三概率、报表） |
| 第 13 章 五智能体 | 接入/核验/异常/审批/分析 | Agents 页：A1~A6 编排图、tool-call trace、HITL 统计 | ✅（可视化） |
| HITL 原则 | 置信度 + 人工终审 | ConfidenceBar、HITL_STATS、VALUE_SUMMARY、审批/复核拦截场景 | ✅ |

## 三、完全未实现

| # | BRD 条目 | BRD 要求 | 代码现状 |
|---|---|---|---|
| 3.1 | UC-10 / SCR-10 / CAP-10 定期收入报表（市政+住房） | 按收入来源（房地产投资、处罚罚款、规费、收容、烟草、白地费、住宅销售）× 各市政总局（Amanah）与目标对比、运营支出覆盖率、月度自动生成 PDF/Excel 并分发 | 无此页面。Dashboard 只有通用 KPI 趋势图，无收入科目维度 |
| 3.2 | UC-11 / SCR-11 / CAP-11 Makken↔Tahsil 平台级对账 | 周度自动对账、差异分类（金额差异 / Makken 缺失 / Tahsil 缺失 / 状态差异）、差异金额统计、纠正措施建议、导出 Excel / 送审计 / 审批对账按钮 | 未做。RECON 是发票级 Invoice↔PO↔GRN 三方对账，不是平台间对账 |
| 3.3 | UC-12 / SCR-12 / CAP-12 Mumtathil 违规对接与跟踪 | 每日拉取 18 字段、按缴款号/身份证号匹配、执行状态（未上报/可转办/无法执行/已执行）+ 申诉状态流（已驳回/已受理/审理中）、回款评分联动、>10 万里亚尔警报、上报执行/跟进申诉/手工更新按钮 | 仅 PENALTY_STATUS 三个静态徽章（无/已上诉/执行中）挂在催收表格，无独立跟踪界面、无申诉流、无按钮 |
| 3.4 | UC-09 / SCR-08 审计与审批记录审查 | 按时间段/登记号/金额/状态检索完整审计轨迹、授权表自动合规检查、合规报告、数字签名导出 PDF/Excel/CSV | 无审计页面。AI 过程 trace 只是可视化，不是可检索的审计日志 |
| 3.5 | 报表导出（全局能力） | UC-06/08/09/10/11 均要求 Excel/PDF 导出 | 全代码 0 处导出功能 |
| 3.6 | UC-06 下钻与筛选 | KPI 下钻（按登记号/来源平台/时间段）、SCR-05 时间段+来源平台筛选器 | Dashboard 与 Invoices 均无筛选器、无下钻 |
| 3.7 | 通知中心（Notification Hub） | 审批通知经邮件 + Sanad 双通道推送、偏差警报、报表定时邮件（UC-06 场景 6） | 无任何通知机制（仅页面内 Toast） |

## 四、部分实现（有演示体现，缺关键交互）

| # | BRD 条目 | 已有 | 缺失 |
|---|---|---|---|
| 4.1 | UC-08 / SCR-07 暂停发票管理 | Invoices 列表有状态徽章（重复拦截/待复核/已驳回） | 四个处置操作：更正重处理 / 最终拒绝 / 转办 / 索要单据；决定理由必填；拒绝后通知实体。发票行只读 |
| 4.2 | UC-01 / SCR-01 发票摄取看板 | 上传区 + 4 个样例场景 + 6 源接入动画 + OCR 10 字段 | 上传是假的（按文件名映射场景）；缺 50MB/格式校验报错、发票来源下拉（Tahsil/Makken/Efaa/Sanad/邮件/手工）、OCR 缺字段时手动补录交互、合同编号/实体类型/负责人备注字段（SCR-01 字段 3、10、11、12） |
| 4.3 | UC-02 / SCR-02 核验结果界面 | 三方对账表 + 匹配度 + ZATCA 税号/VAT 校验 | 审计员决定下拉（接受/拒绝/请求澄清）+ 拒绝必填意见；偏差 >5% 强制转人工的操作流 |
| 4.4 | UC-03 / SCR-03 风险预警看板 | 风险清单 + 偏差分 + 可疑原因 + AI 分析抽屉 | 审计员决定（接受/拒绝/请求追加调查）按钮（Risk.jsx:176 仅有 AI 分析按钮）；误报确认→模型更新反馈环 |
| 4.5 | UC-04 / SCR-04 审批请求 | 同意/拒绝按钮 + 审批链 + SLA + 升级说明文案 | 请求澄清按钮；48h 实时时限计时器；到期前 6h 预警；到期自动升级交互；缺勤替补审批人 |
| 4.6 | UC-05 / SCR-09 回款预测看板 | 回款概率 + 逾期天数 + 催收策略建议 | 三概率展示（回款/延迟/注销）与分级建议徽章（紧急干预/积极跟进/定期跟进）；每日 8 点更新时间戳 |
| 4.7 | RBAC 五角色 | 3 个演示账号（主管/审计/管理员）+ 组织范围开关 | BRD 权限矩阵中发票专员、收入经理、付款审批负责人的差异化视图完全未区分，任何账号看到的内容相同 |

## 五、演示范畴外（前端 demo 不涉及）

- NFR-001~010：性能（P95≤3s）、可用性 99.5%、审计日志留存 7 年、AES-256/PDPL 数据保护、水平扩展、零停机更新、模型准确率指标、集成可靠性（Retry/熔断）。
- 11.1 节全部平台集成：Tahsil/Makken/Efaa/Sanad/政府 ERP 的 API 双向对接、SSO/IAM、ZATCA 实时核验、Notification Hub。

## 六、补齐建议（按演示性价比排序）

1. **四个新页面**：SCR-10 收入报表、SCR-11 平台对账、SCR-12 Mumtathil 跟踪、SCR-08 审计审查 —— 正好是 BRD 的沙特特色能力（CAP-10/11/12），当前完全空白。
2. **操作闭环按钮**：Approvals/Risk/核验结果加"请求澄清 / 请求追加调查 / 审计员决定"按钮；Invoices 加暂停发票四处置操作（配合 Toast 即可演示）。
3. **SCR-09 三概率展示**：在 Collection 页把单概率扩展为回款/延迟/注销三列 + 分级建议徽章，改动小、见效快。
4. **导出与筛选**：Dashboard/Invoices 加时间段与来源平台筛选器；导出可用前端生成 CSV/打印 PDF 兜底。

## 七、补齐设计方案（与现有功能保持逻辑与风格一致）

### 7.1 一致性基准：现有系统的 6 条隐性规律

新功能不是模仿样式，而是遵守同一套生成规则：

| # | 规律 | 现有证据 |
|---|---|---|
| 1 | 数据先行，无服务层：一切功能 = `mock.js` / `aiProcess.js` 一个新常量 + 页面消费 | 8 个页面全是此模式 |
| 2 | 三语各归其位：UI 词条进 `i18n.js` 用 `t()`；业务对象用 `titleEn/titleAr` 后缀 + `T()`；AI trace 用 `{zh,en,ar}` + `L()` | 三套机制并存、从不混用 |
| 3 | AI 入口统一范式：`btn btn-ghost btn-sm`「AI 分析」→ `setDrawer(XXX_ANALYSIS[id])`，抽屉数据用 builders 组装，结尾必有 decision block + 置信度 | 5 个页面同一写法 |
| 4 | 操作 = 本地 state 变化 + toast，无持久化承诺 | Approvals 的同意/拒绝 |
| 5 | 数值带组织缩放：金额/计数乘 `user.org.scale` | Dashboard / Invoices |
| 6 | 跨页实体同源：同一发票号在各页面出现的是同一组事实 | INV-2026-0730 贯穿全站 |

### 7.2 核心设计思想：单一事实源派生

四个新页面的数据不从零编造，而是从现有场景派生：

- 审计页的轨迹日志 = 现有 `PIPELINE_WORK` / `RISK_ANALYSIS` / `APPROVAL_BASIS` 各步骤加上时间戳与操作者。
- 平台对账页的差异记录 = 现有 `RECON` 行数据复制到 Makken 侧后人为制造偏差。
- 收入页的科目金额 = 现有 `KPIS` / `TREND` 月度数字按科目拆分。

由此演示叙事闭环：INV-2026-0730 在 Pipeline 被拦截、在 Risk 是 82 分、在审计页可查完整轨迹、在对账报告中再次出现 —— 评审时经得起交叉点击。`VENDOR_MASTER` 让 tool_call 中间结果自洽即是此思路的先例。

### 7.3 四个新页面设计

| 页面 | 路由 / 导航位 | 数据（新增常量） | 布局（复用现有骨架） | AI 抽屉数据 | 操作按钮 |
|---|---|---|---|---|---|
| 收入报表 SCR-10 | `/revenue`，Collection 之后 | `REVENUE_SOURCES`（8 科目 × 5 Amanah，自 TREND 拆分）+ `REVENUE_TARGETS` | 筛选行（板块/期间，本地 state）→ KPI 行（达成率 <60% 红）→ 堆叠柱图 + 科目明细表 | `REVENUE_ANALYSIS`：think → tool_call(query_revenue) → chart → decision(执行摘要) | AI 摘要、导出 |
| 平台对账 SCR-11 | `/recon`，Invoices 之后 | `PLATFORM_RECON`（与发票级 `RECON` 区分命名）：invoiceNo、makkenAmt、tahsilAmt、diffType 4 态、suggestion | KPI（差异总额、>5 万高危数、Tahsil 权威 badge）→ 类型筛选 chips → 对账表（差额红绿） | `XRECON_ANALYSIS[id]`：tool_call(match_by_invoice_no) → obs(回退身份标识匹配) → decision | 送审计、审批对账（Approvals 同款 state+toast） |
| 违规跟踪 SCR-12 | `/violations`，Collection 之后 | `VIOLATIONS` + 新枚举 `EXEC_STATUS`(4 态) / `APPEAL_STATUS`(4 态)，替代 3 态 `PENALTY_STATUS` | 四态计数 KPI → 状态筛选 → 表格（评分色阶、>10 万行红、身份证脱敏） | `VIOLATION_ANALYSIS[id]`：tool_call(pull_mumtathil) → obs(申诉受理、金额调低) → decision(评分 X→Y) | 上报执行、跟进申诉（本地 state 更新徽章 + toast） |
| 审计审查 SCR-08 | `/audit`，Agents 之前 | `AUDIT_TRAIL`（由现有各场景 trace 派生成事件日志：时间、发票、阶段、操作者、理由） | 检索卡（时间段/状态/金额区间/登记号，全本地过滤）→ 结果表 → 行展开完整轨迹（复用 TraceBlock） | `AUDIT_CHECK`：tool_call(check_authority_matrix) → evidence(全绿/一处红) → decision | 合规检查、导出 CSV |

页面级图表不扩展 TraceChart 的 4 种 chartType，直接按 Dashboard / Collection 的 Chart.js 模板写（options 复制、ref destroy on unmount）。

### 7.4 操作闭环（改造现有页面，套 Approvals 范式）

- Invoices：`review` / `duplicate` / `rejected` 行加处置按钮组（更正重提 / 最终拒绝 / 转办 / 索要单据），拒绝时行内展开理由 textarea（必填）—— 不用模态框，保持轻量。
- Approvals：加第三按钮「请求澄清」（ghost）；SLA 从静态文案改为倒计时徽章，<6h 变橙（setInterval 即可）。
- Risk：加「接受 / 请求追加调查」→ 移除或升级 + toast。
- InvoiceDetailDrawer：taxfail 场景在对账表下方加审计员决定区（下拉 接受/拒绝/请求澄清 + 意见 + 提交），演示「偏差 >5% 强制转人工」。

### 7.5 横切能力

- 导出：新建 `src/utils/export.js` 的 `exportCSV(filename, rows)`（Blob + `a.download`，零依赖，与 index.js 零依赖服务器哲学一致），所有「导出 Excel」按钮统一降级为真实 CSV 下载。
- 筛选：Dashboard / Invoices 加 chips（时间段 30/90/365 天、来源平台），只过滤展示层。
- RBAC（可选，优先级最低）：`CREDENTIALS` 加 roleKey，Layout 按角色隐藏导航项；只做导航级差异，不做字段级。

### 7.6 实施顺序与依赖

1. SCR-09 三概率（半天级：COLLECTIONS 加两字段 + 两列徽章 + 图表改 3 dataset）。
2. 操作闭环按钮（1 天，纯现有页面小改）。
3. 平台对账 + 审计页（数据自 RECON 派生，最快出效果）；导出工具随本步一起做。
4. 收入报表 + 违规跟踪（新数据面最大）。
5. RBAC 最后或不做。

每步完成后按仓库惯例 `npm run build` 并提交 `dist/`。

## 八、HLSD 原型文档对设计的输入

核对对象：《[Need Review]SS-IntelligentInvoice-HLSD-Prototpye-v0.1-20260824.docx》（ByteDance 编制，2026-08-24，Prototype 阶段草案，含 8 张官方 WF 泳道图）。结论：**对第七章设计有直接帮助**，以下六点可落地。

### 8.1 缺口优先级获得官方背书

HLSD 将 BRD 用例升格为正式需求 FR-011~015，全部标注 **P0（Must have）**，与本文档缺口清单 1:1 对应：

| HLSD 需求 | 内容 | 对应第七章设计项 |
|---|---|---|
| FR-011 | 暂停与被拒发票管理 | 7.4 Invoices 处置按钮组 |
| FR-012 | 财务审计与审批路径审查 | 7.3 审计审查页（/audit） |
| FR-013 | 定期收入报表 | 7.3 收入报表页（/revenue） |
| FR-014 | Makeen–Tahseel 对账 | 7.3 平台对账页（/recon） |
| FR-015 | 违规/申诉/执行跟踪 | 7.3 违规跟踪页（/violations） |

### 8.2 WF-01~08 步骤序列 = 新页面 AI 抽屉的官方叙事脚本

HLSD 为 8 个工作流给出了步骤级 To-Be 序列（并附泳道图），新页面的 AIProcessDrawer trace 可按 WF 步骤逐条组装（think → tool_call → decision），使演示叙事与官方流程一一对应：

| 工作流 | 页面 | trace 组装要点（源自 HLSD 步骤） |
|---|---|---|
| WF-01 智能发票处理（11 步） | Pipeline | 核验与异常**并行**后汇合（WF01-06）、审计员复核决定（WF01-07）、审批三选一（WF01-09）、异常处置（WF01-11） |
| WF-02 回款预测（8 步） | Collection | 每日 8 点前触发 → 三概率生成 → 阈值分级（紧急/积极/定期）→ 更新 SCR-09 → 高风险告警 |
| WF-03 绩效分析（8 步） | Dashboard | RBAC 校验 → 数据新鲜度 → 六 KPI → 下钻 → 导出留审计 |
| WF-04 对话洞察（7 步） | Assistant | 意图解析 → RBAC 过滤 → 检索 → 阿语回答 + 图表 → 会话入审计日志 |
| WF-05 审计审查（7 步） | /audit | 检索 → 证据组装 → 授权表合规检查 → 合规报告 → 数字签名导出 + 审计元日志 |
| WF-06 收入报表（8 步） | /revenue | 月度触发 → 加载 Tahseel 数据 → 科目 KPI → 覆盖率 → 目标对比（冲突以 Tahseel 为准）→ 导出分发 |
| WF-07 平台对账（9 步） | /recon | 周日 8 点触发 → 发票号优先匹配、失败回退受益人 ID+金额 → 差异分类 → 金额计算 → >5 万每日更新 → 审批/送审 |
| WF-08 违规跟踪（10 步） | /violations | SADAD 号优先匹配 → 委员会审查中则暂停执行 → 评分联动更新 → 重大变化告警 → 三按钮（上报执行/跟进申诉/手工更新） |

### 8.3 J-01~08 用户旅程确认操作闭环是必经步骤

J-01 的 8 步展开明确要求了第七章 7.4 的全部交互——它们不是锦上添花，而是官方旅程的组成部分：J-01.2 低置信度字段人工纠正、J-01.3 重复时人工决定停止或放行、J-01.7 审批人三选一（同意/拒绝/请求澄清）、J-01.8 异常处置五动作（更正/拒绝/升级/索证/重跑）。J-02 的"建议不改变发票官方状态"等措辞可直接用作新页面副标题文案。

### 8.4 角色体系从 5 个扩充到 10 个

HLSD 新增：治理专员（Governance Officer）、对账专员（Financial Reconciliation Officer）、处罚与罚款专员（Penalties & Fines Officer）、现场催收经理（Field Collection Manager）、Amanah 领导。RBAC 设计（7.5）据此调整：演示账号可按 Persona 映射（如 auditor=审计+治理、新增 reconciler、penalties 账号），每个新页面 page-head 标注主要 Persona。

### 8.5 Dashboard KPI 对齐清单

WF03-04 给出六项 KPI 权威清单：实际回款率、平均处理时长、未结清发票金额、已发现财务异常数、发票按时审批率、当日接收发票数（按板块/Amanah 分类）。现有 KPIS 应向此清单对齐。

### 8.6 命名与阈值待澄清事项（demo 采用值）

- **平台拼写不统一**：HLSD 用 Tahseel / Makeen / Efaa；BRD 中文版用 Tahsil / Makken；代码混用 Tahseel / Makin / Efa。建议统一为 HLSD 拼写（英文权威版），需全局替换 `mock.js` / `i18n.js` 文案。
- **阈值方向冲突**（HLSD 已标记待澄清，demo 取安全值）：异常检出率取「≥85%（6 个月）→95%（第一年）」；违规金额警报取「>10 万 SAR」（BRD 方向，HLSD 写反）；F1 取「≥85%」。
- 其他 HLSD 待澄清项（15%~30% 双重含义、2025 年 250 亿时间线、两处 SLA 定义重复）不影响演示，登记备查即可。
