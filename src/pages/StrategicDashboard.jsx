import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line, Doughnut, Radar } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { analyzeScenario, DEFAULT_SCENARIO, LEVERS, OPERATING_PROFILE, PORTFOLIO_TOTAL, trajectory } from '../data/strategicModel';
import { COLLECTIONS } from '../data/mock.js';
import '../styles/strategic-dashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

const copy = {
  en: {
    title: 'Strategic Dashboard', sub: 'Model sustainability scenarios across Opex, revenue, invoicing, collections and exclusions.',
    whatIf: 'What-If Scenarios', agent: 'Modeling Agent · Demo',
    setup: 'Define Your Scenario', targetType: 'Target Type', opexCoverage: 'Cover Opex (%)', collectionAmount: 'Collect Amount (SAR)', target: 'Target Value', horizon: 'Planning Horizon', days: 'days',
    opexHelp: 'The model converts this to SAR using the planning-period Opex.', amountHelp: 'The model uses this as the required collection outcome.',
    variables: 'Adjustable Variables', variableHelp: 'Select variables available in the scenario. Unselected variables stay at 0%',
    invoicing: 'Invoicing Volume / Amount', collections: 'Collections / Collection Rate', exclusions: 'Exclusions Cleanup', statusMix: 'Invoice Status Mix', uncollectible: 'Uncollectible Amounts',
    invoicingDesc: 'Additional valid invoicing capacity inside the period.', collectionsDesc: 'Operational follow-up intensity that improves collection conversion.', exclusionsDesc: 'Reduction in duplicates, disputes, struck-off debtors and enforcement referrals.', statusMixDesc: 'Shift of invoices toward approved, due and collectible statuses.', uncollectibleDesc: 'Reduction of amounts treated as structurally uncollectible.',
    run: 'Analyze Scenario', reset: 'Reset', ready: 'Ready to model sustainability?', readyDesc: 'Choose a target type, set the target value, adjust preliminary variables and run the model.',
    thinking: 'AI is thinking', thinkingDesc: 'Modeling variables, sensitivity and priority actions for your scenario…',
    thinkingSteps: ['Reading scenario parameters', 'Modeling variable impacts', 'Ranking priority actions', 'Preparing results'],
    portfolio: 'Current Gross Invoicing Base', opex: 'Planning-Period Opex', targetAmount: 'Modeled Target', baseline: 'Baseline Collections', projected: 'Scenario Collections', maximum: 'Maximum Achievable Collections',
    results: 'Scenario analysis', met: 'Target met by current scenario', possible: 'Achievable with further changes', impossible: 'Beyond the modeled maximum',
    metDesc: 'The current settings reach the target in this model. Validate the assumptions before execution.', possibleDesc: 'The current settings fall short. The recommended variable changes show a modeled path to the target.', impossibleDesc: 'Even with selected variables at maximum, the target is above the modeled ceiling. Increase invoicing capacity, extend the horizon or revise the target.',
    gap: 'Remaining gap', lift: 'Improvement over baseline', coverage: 'Opex coverage', compare: 'Opex → Revenue → Invoicing → Collections → Sustainability',
    gross: 'Gross invoiced', excluded: 'Excluded impact', net: 'Net invoiced', readyStatus: 'Status-ready base', uncollectibleAmount: 'Uncollectible drag', collected: 'Collected outcome',
    invoicingNeeded: 'More invoicing needed', invoicingNeededHelp: 'Extra gross invoicing needed under the current scenario mix.', maxInvoicingNeededHelp: 'Extra gross invoicing still needed after all selected variables are maxed.',
    sensitivity: 'Variables & impact', sensitivityHelp: 'Additional collections if one variable moves to 100%, holding the others at current settings. Impacts overlap and should not be added together.',
    variable: 'Variable', current: 'Current', recommended: 'Recommended', impact: 'Additional potential', locked: 'Not selected',
    actions: 'Priority actions', actionHelp: 'Sequential changes ranked by modeled impact.', action: 'Move variable', gain: 'Estimated incremental collection', noActions: 'No further variable movement is recommended for this target.',
    roadmap: 'Rough roadmap', roadmapHelp: 'A practical sequence for validating and executing the scenario.', phase1: 'Validate baseline', phase1Desc: 'Confirm Opex, gross invoicing, exclusion categories, status mix and uncollectible assumptions.', phase2: 'Move priority variables', phase2Desc: 'Apply the recommended changes, starting with the highest-impact variables.', phase3: 'Track sustainability', phase3Desc: 'Review collections against Opex coverage weekly and re-run the scenario as exclusions or invoicing change.',
    assumptions: 'Model Assumptions', assumptionText: 'The model starts from the demo receivables portfolio. Opex is fixed at SAR 1.8m per month. Variables are scenario intensities from 0% to 100%: invoicing can lift gross invoicing by up to 40%, collections can lift conversion by up to 22 points, exclusions can reduce the excluded share by up to 55%, status mix can lift ready invoices by up to 17 points, and uncollectible work can reduce the uncollectible share by up to 65%. These coefficients are illustrative and should be calibrated later.',
    stale: 'Parameters changed. Analyze again to update the results.', error: 'Enter a target value greater than zero.', day: 'Day', outcome: 'Estimated outcome after recommended changes',
    coverageGauge: 'Opex coverage', scenarioCompare: 'Collections comparison', valueFlow: 'Value flow waterfall', sensitivityRadar: 'Variable radar', collectionTrajectory: 'Collection trajectory', receivableMix: 'Projected collection mix',
    targetLine: 'Target', baselineLine: 'Baseline', projectedLine: 'Projected', recommendedLine: 'Recommended', maximumLine: 'Maximum',
    waterfallHint: 'Shows how gross invoicing cascades through exclusions, status readiness and uncollectible drag to the final collected amount.',
    radarHint: 'Current (solid) vs recommended (filled) variable intensity. Larger shapes mean more aggressive assumptions.',
    mixHint: 'Proportional share of each receivable in the projected collection outcome.'
  },
  zh: {
    title: '战略仪表盘', sub: '围绕 Opex、收入、开票、回款和可持续性进行情景建模。',
    whatIf: 'What-If 情景建模', agent: '建模智能体 · 演示',
    setup: '设定情景', targetType: '目标类型', opexCoverage: '覆盖 Opex（%）', collectionAmount: '回款金额（SAR）', target: '目标值', horizon: '规划周期', days: '天', opexHelp: '模型会按规划周期的 Opex 折算为 SAR 目标。', amountHelp: '模型会把该金额作为需达到的回款结果。',
    variables: '可调整变量', variableHelp: '选择本情景中允许调整的变量；未选择变量固定为 0%。',
    invoicing: '开票量 / 开票金额', collections: '回款 / 回款率', exclusions: '排除项清理', statusMix: '发票状态结构', uncollectible: '不可回收金额',
    invoicingDesc: '规划周期内新增有效开票能力。', collectionsDesc: '提升回款转化的运营跟进强度。', exclusionsDesc: '减少重复、争议、注销/无效债务人及转执行类排除项。', statusMixDesc: '将发票更多转入已审批、到期、可回收状态。', uncollectibleDesc: '降低被视为结构性不可回收的金额。',
    run: '分析情景', reset: '重置', ready: '准备建模财务可持续性？', readyDesc: '选择目标类型，输入目标值，调整初步变量后运行模型。',
    thinking: 'AI 正在思考', thinkingDesc: '正在为您的情景建模变量、灵敏度与优先行动…',
    thinkingSteps: ['读取情景参数', '建模变量影响', '排序优先行动', '生成分析结果'],
    portfolio: '当前总开票基础', opex: '规划周期 Opex', targetAmount: '折算后目标', baseline: '基准回款', projected: '当前方案回款', maximum: '最大可达回款',
    results: '情景分析', met: '当前方案已满足目标', possible: '进一步调整后可达成', impossible: '超出模型可达上限', metDesc: '当前参数在模型中已达到目标。执行前仍需校验假设。', possibleDesc: '当前方案仍有缺口。下方建议变量调整给出模型中的达成路径。', impossibleDesc: '即使选中变量拉满，目标仍高于模型上限。需要提高开票能力、延长周期或调整目标。',
    gap: '剩余缺口', lift: '相对基准增加', coverage: 'Opex 覆盖率', compare: 'Opex → 收入 → 开票 → 回款 → 可持续性',
    gross: '总开票', excluded: '排除项影响', net: '净开票', readyStatus: '状态可回收基础', uncollectibleAmount: '不可回收拖累', collected: '回款结果',
    invoicingNeeded: '仍需增加开票', invoicingNeededHelp: '在当前情景结构下仍需新增的总开票额。', maxInvoicingNeededHelp: '选中变量拉满后仍需新增的总开票额。',
    sensitivity: '变量与影响', sensitivityHelp: '保持其他变量不变，将单一变量提高到 100% 的额外回款。影响之间会重叠，不能直接相加。', variable: '变量', current: '当前', recommended: '建议', impact: '额外潜力', locked: '未选择',
    actions: '优先行动', actionHelp: '按模型影响排序的连续变量调整。', action: '调整变量', gain: '预计增量回款', noActions: '该目标下无需进一步调整变量。',
    roadmap: '粗略路线图', roadmapHelp: '用于校验和执行情景的建议步骤。', phase1: '校验基线', phase1Desc: '确认 Opex、总开票、排除项类别、状态结构及不可回收假设。', phase2: '调整优先变量', phase2Desc: '按影响大小执行建议调整，从最高影响变量开始。', phase3: '跟踪可持续性', phase3Desc: '每周对照 Opex 覆盖率检查实际回款，并随排除项或开票变化重跑模型。',
    assumptions: '模型假设', assumptionText: '模型基于演示应收账款组合。Opex 固定为每月 SAR 180 万。变量是 0% 到 100% 的情景强度：开票最多提升总开票 40%，回款最多提升转化 22 个百分点，排除项最多降低排除比例 55%，状态结构最多提升可回收发票 17 个百分点，不可回收治理最多降低不可回收比例 65%。这些系数仅用于演示，后续应按历史数据校准。',
    stale: '参数已修改，请重新分析以更新结果。', error: '请输入大于零的目标值。', day: '第', outcome: '完成建议调整后的预计结果',
    coverageGauge: 'Opex 覆盖率', scenarioCompare: '回款对比', valueFlow: '价值流转瀑布图', sensitivityRadar: '变量雷达图', collectionTrajectory: '回款轨迹', receivableMix: '预计回款构成',
    targetLine: '目标', baselineLine: '基准', projectedLine: '当前方案', recommendedLine: '建议方案', maximumLine: '最大可达',
    waterfallHint: '展示总开票如何经过排除项、状态就绪、不可回收拖累层层流转，最终形成回款结果。',
    radarHint: '实线为当前变量强度，填充区域为建议强度；图形越大代表假设越激进。',
    mixHint: '各笔应收款在预计回款结果中的占比。'
  },
  ar: {
    title: 'لوحة المعلومات الاستراتيجية', sub: 'نمذجة الاستدامة عبر المصروفات والإيرادات والفوترة والتحصيل والاستثناءات.',
    whatIf: 'سيناريوهات ماذا لو', agent: 'وكيل النمذجة · تجريبي',
    setup: 'حدد السيناريو', targetType: 'نوع الهدف', opexCoverage: 'تغطية المصروفات (%)', collectionAmount: 'مبلغ التحصيل (ر.س)', target: 'قيمة الهدف', horizon: 'فترة التخطيط', days: 'يوماً', opexHelp: 'يحوّل النموذج النسبة إلى مبلغ حسب مصروفات الفترة.', amountHelp: 'يستخدم النموذج هذا المبلغ كهدف تحصيل مطلوب.',
    variables: 'المتغيرات القابلة للتعديل', variableHelp: 'اختر المتغيرات المتاحة في السيناريو. تبقى غير المختارة عند 0%.',
    invoicing: 'حجم / مبلغ الفوترة', collections: 'التحصيل / معدل التحصيل', exclusions: 'معالجة الاستثناءات', statusMix: 'مزيج حالات الفواتير', uncollectible: 'المبالغ غير القابلة للتحصيل',
    invoicingDesc: 'قدرة فوترة صالحة إضافية داخل الفترة.', collectionsDesc: 'كثافة المتابعة التشغيلية لتحسين التحصيل.', exclusionsDesc: 'تقليل المكررات والنزاعات والحالات غير الصالحة والمحالة للتنفيذ.', statusMixDesc: 'تحويل الفواتير نحو حالات معتمدة ومستحقة وقابلة للتحصيل.', uncollectibleDesc: 'تقليل المبالغ المصنفة كغير قابلة للتحصيل.',
    run: 'تحليل السيناريو', reset: 'إعادة ضبط', ready: 'جاهز لنمذجة الاستدامة؟', readyDesc: 'اختر نوع الهدف وأدخل القيمة وعدّل المتغيرات الأولية ثم شغّل النموذج.',
    thinking: 'الذكاء الاصطناعي يفكر', thinkingDesc: 'جارٍ نمذجة المتغيرات والحساسية وإجراءات الأولوية للسيناريو الخاص بك…',
    thinkingSteps: ['قراءة معلمات السيناريو', 'نمذجة آثار المتغيرات', 'ترتيب إجراءات الأولوية', 'تجهيز النتائج'],
    portfolio: 'أساس الفوترة الحالي', opex: 'مصروفات فترة التخطيط', targetAmount: 'الهدف المحسوب', baseline: 'التحصيل الأساسي', projected: 'تحصيل السيناريو', maximum: 'أقصى تحصيل قابل للتحقيق',
    results: 'تحليل السيناريو', met: 'السيناريو الحالي يحقق الهدف', possible: 'قابل للتحقيق مع تغييرات إضافية', impossible: 'يتجاوز الحد الأقصى للنموذج', metDesc: 'الإعدادات الحالية تحقق الهدف ضمن النموذج. يلزم التحقق من الافتراضات قبل التنفيذ.', possibleDesc: 'الإعدادات الحالية غير كافية. تعرض التغييرات أدناه مساراً تقديرياً لتحقيق الهدف.', impossibleDesc: 'حتى عند رفع المتغيرات المختارة للحد الأعلى يبقى الهدف فوق السقف المقدر. زد الفوترة أو مدد الفترة أو راجع الهدف.',
    gap: 'الفجوة المتبقية', lift: 'التحسن عن الأساس', coverage: 'تغطية المصروفات', compare: 'المصروفات → الإيرادات → الفوترة → التحصيل → الاستدامة',
    gross: 'إجمالي الفوترة', excluded: 'أثر الاستثناءات', net: 'صافي الفوترة', readyStatus: 'أساس الحالات الجاهزة', uncollectibleAmount: 'أثر غير القابل للتحصيل', collected: 'نتيجة التحصيل',
    invoicingNeeded: 'فوترة إضافية مطلوبة', invoicingNeededHelp: 'إجمالي الفوترة الإضافية المطلوبة حسب مزيج السيناريو الحالي.', maxInvoicingNeededHelp: 'إجمالي الفوترة الإضافية المطلوبة بعد رفع المتغيرات المختارة للحد الأعلى.',
    sensitivity: 'المتغيرات والأثر', sensitivityHelp: 'التحصيل الإضافي عند رفع متغير واحد إلى 100% مع تثبيت الباقي. الآثار متداخلة ولا تجمع مباشرة.', variable: 'المتغير', current: 'الحالي', recommended: 'الموصى به', impact: 'إمكانات إضافية', locked: 'غير مختار',
    actions: 'إجراءات الأولوية', actionHelp: 'تغييرات متسلسلة مرتبة حسب الأثر المقدر.', action: 'تحريك المتغير', gain: 'تحصيل إضافي مقدر', noActions: 'لا توجد تغييرات إضافية موصى بها لهذا الهدف.',
    roadmap: 'خارطة طريق تقريبية', roadmapHelp: 'تسلسل عملي للتحقق من السيناريو وتنفيذه.', phase1: 'تحقق من الأساس', phase1Desc: 'أكد المصروفات وإجمالي الفوترة والاستثناءات ومزيج الحالات وافتراضات غير القابل للتحصيل.', phase2: 'حرّك المتغيرات ذات الأولوية', phase2Desc: 'نفّذ التغييرات المقترحة بدءاً بالأعلى أثراً.', phase3: 'تابع الاستدامة', phase3Desc: 'راجع التحصيل مقابل تغطية المصروفات أسبوعياً وأعد تشغيل النموذج عند تغير الاستثناءات أو الفوترة.',
    assumptions: 'افتراضات النموذج', assumptionText: 'يبدأ النموذج من محفظة المستحقات التجريبية. المصروفات ثابتة عند 1.8 مليون ر.س شهرياً. المتغيرات شدة سيناريو من 0% إلى 100%: الفوترة قد ترفع الإجمالي حتى 40%، والتحصيل حتى 22 نقطة، والاستثناءات تخفض الحصة المستثناة حتى 55%، ومزيج الحالات يرفع الجاهزية حتى 17 نقطة، والعمل على غير القابل للتحصيل يخفضها حتى 65%. المعاملات توضيحية وتحتاج معايرة لاحقاً.',
    stale: 'تغيرت المعلمات. أعد التحليل لتحديث النتائج.', error: 'أدخل قيمة هدف أكبر من الصفر.', day: 'اليوم', outcome: 'النتيجة المقدرة بعد التغييرات الموصى بها',
    coverageGauge: 'تغطية المصروفات', scenarioCompare: 'مقارنة التحصيل', valueFlow: 'التدفق القيمي المتتالي', sensitivityRadar: 'رادار المتغيرات', collectionTrajectory: 'مسار التحصيل', receivableMix: 'مزيج التحصيل المتوقع',
    targetLine: 'الهدف', baselineLine: 'الأساس', projectedLine: 'السيناريو', recommendedLine: 'الموصى به', maximumLine: 'الحد الأقصى',
    waterfallHint: 'يوضح كيف يتدفق إجمالي الفوترة عبر الاستثناءات والحالات الجاهزة وغير القابل للتحصيل ليصل إلى المبلغ المحصل.',
    radarHint: 'الخط الحالي للمتغير (الصلب) مقابل الموصى به (المظلل). كلما اتسعت الشكل كانت الفروض أكثر عدوانية.',
    mixHint: 'النصيب التناسبي لكل مستحق في نتيجة التحصيل المتوقعة.'
  }
};

const BRAND = {
  primary: '#26634B',
  secondary: '#005A96',
  success: '#006604',
  warning: '#FFC107',
  danger: '#AF0818',
  grey: '#8B93A1',
  muted: '#EAEAEA'
};

const MIX_COLORS = [
  '#26634B', '#005A96', '#C88700', '#6B57A6', '#AF0818', '#3D8B8B', '#8B5A3C', '#5A5A5A'
];

function localeFor(lang) {
  if (lang === 'ar') return 'ar-SA';
  if (lang === 'zh') return 'zh-CN';
  return 'en-US';
}

function useMoneyFormatter(lang) {
  return (value) => new Intl.NumberFormat(localeFor(lang), { style: 'currency', currency: 'SAR', maximumFractionDigits: 0, numberingSystem: 'latn' }).format(value);
}

function usePctFormatter(lang) {
  return (value) => `${new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 1, numberingSystem: 'latn' }).format(value)}%`;
}

function compact(value) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${Math.round(value)}`;
}

function CoverageGauge({ projected, targetAmount, money, isRtl }) {
  const coverage = projected.sustainabilityCoverage;
  const targetPct = targetAmount ? Math.min(100, (targetAmount / projected.opex) * 100) : 0;
  const data = {
    labels: ['Covered', 'Gap'],
    datasets: [{
      data: [Math.min(100, coverage), Math.max(0, 100 - coverage)],
      backgroundColor: [coverage >= targetPct ? BRAND.success : coverage >= targetPct * 0.7 ? BRAND.warning : BRAND.danger, '#EAEAEA'],
      borderWidth: 0,
      cutout: '78%'
    }]
  };
  return (
    <div className="strategic-chart strategic-chart--gauge">
      <Doughnut data={data} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false, rtl: isRtl }, tooltip: { enabled: false } } }} />
      <div className="strategic-gauge-center">
        <strong>{Math.round(coverage)}%</strong>
        <span>SAR {compact(projected.collected)} / {compact(targetAmount)}</span>
      </div>
    </div>
  );
}

function ScenarioCompareChart({ baseline, projected, maximum, targetAmount, money, c, isRtl }) {
  const data = {
    labels: [c.baseline, c.projected, c.maximum],
    datasets: [
      {
        label: c.coverage,
        data: [baseline.sustainabilityCoverage, projected.sustainabilityCoverage, maximum.sustainabilityCoverage],
        backgroundColor: [BRAND.grey, BRAND.primary, BRAND.secondary],
        borderRadius: 6,
        yAxisID: 'y1'
      },
      {
        label: c.targetAmount,
        data: [null, Math.min(100, (targetAmount / projected.opex) * 100), null],
        backgroundColor: BRAND.warning,
        borderRadius: 6,
        yAxisID: 'y1'
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false, rtl: isRtl }, tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.raw)}%` } } },
    scales: {
      x: { grid: { display: false } },
      y: { display: false, min: 0 },
      y1: { position: 'right', beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` }, grid: { color: 'rgba(0,0,0,0.06)' } }
    }
  };
  return <Bar data={data} options={options} />;
}

function WaterfallChart({ projected, money, c, isRtl }) {
  const { grossInvoiced, excludedAmount, netInvoiced, statusReadyAmount, uncollectibleAmount, collected } = projected;
  const items = [
    { key: 'gross', start: 0, end: grossInvoiced, color: BRAND.secondary },
    { key: 'excluded', start: grossInvoiced - excludedAmount, end: grossInvoiced, color: '#C88700' },
    { key: 'net', start: 0, end: netInvoiced, color: '#6B57A6' },
    { key: 'readyStatus', start: 0, end: statusReadyAmount, color: '#3D8B8B' },
    { key: 'uncollectibleAmount', start: statusReadyAmount - uncollectibleAmount, end: statusReadyAmount, color: BRAND.danger },
    { key: 'collected', start: 0, end: collected, color: BRAND.primary }
  ];
  const data = {
    labels: items.map(i => c[i.key]),
    datasets: [{
      label: c.compare,
      data: items.map(i => [i.start, i.end]),
      backgroundColor: items.map(i => i.color),
      borderRadius: 4,
      barPercentage: 0.65
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false, rtl: isRtl },
      tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1, callbacks: { label: (ctx) => money(ctx.raw[1] - ctx.raw[0]) } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { callback: (v) => compact(v) } }
    }
  };
  return <Bar data={data} options={options} />;
}

function SensitivityRadar({ sensitivity, recommended, c, isRtl }) {
  const labels = sensitivity.map(s => c[s.key]);
  const current = sensitivity.map(s => s.value);
  const rec = sensitivity.map(s => (recommended[s.key] ?? s.value));
  const data = {
    labels,
    datasets: [
      {
        label: c.current,
        data: current,
        borderColor: BRAND.primary,
        backgroundColor: 'rgba(38, 99, 75, 0.12)',
        pointBackgroundColor: BRAND.primary,
        borderWidth: 2,
        pointRadius: 3
      },
      {
        label: c.recommended,
        data: rec,
        borderColor: BRAND.warning,
        backgroundColor: 'rgba(255, 193, 7, 0.18)',
        pointBackgroundColor: BRAND.warning,
        borderWidth: 2,
        pointRadius: 3
      }
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 }, rtl: isRtl }, tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1 } },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: { stepSize: 25, callback: (v) => `${v}%`, backdropColor: 'transparent' },
        pointLabels: { font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.08)' }
      }
    }
  };
  return <Radar data={data} options={options} />;
}

function TrajectoryChart({ run, c, isRtl }) {
  const { days, values, enabled } = run.input;
  const { recommended } = run.result;
  const upper = Object.fromEntries(LEVERS.map(key => [key, enabled[key] ? 100 : 0]));
  const baselinePoints = trajectory({}, days);
  const projectedPoints = trajectory(values, days);
  const recommendedPoints = trajectory(recommended, days);
  const maximumPoints = trajectory(upper, days);
  const labels = projectedPoints.map(p => `D${p.day}`);
  const mk = (label, data, color, fill = false, dashed = false) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: fill ? `${color}20` : color,
    borderWidth: 2,
    borderDash: dashed ? [5, 5] : undefined,
    tension: 0.35,
    pointRadius: 0,
    pointHoverRadius: 4,
    fill
  });
  const data = {
    labels,
    datasets: [
      mk(c.baselineLine, baselinePoints.map(p => p.collected), BRAND.grey),
      mk(c.projectedLine, projectedPoints.map(p => p.collected), BRAND.primary),
      mk(c.recommendedLine, recommendedPoints.map(p => p.collected), BRAND.warning),
      mk(c.maximumLine, maximumPoints.map(p => p.collected), BRAND.secondary, false, true),
      mk(c.targetLine, labels.map(() => run.result.targetAmount), BRAND.danger, false, true)
    ]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 }, rtl: isRtl }, tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1 } },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
      y: { beginAtZero: true, ticks: { callback: (v) => compact(v) }, grid: { color: 'rgba(0,0,0,0.06)' } }
    }
  };
  return <Line data={data} options={options} />;
}

function ReceivableMixChart({ projected, lang, isRtl }) {
  const total = projected.collected;
  const shares = COLLECTIONS.map(row => {
    const share = total * (row.amount / PORTFOLIO_TOTAL);
    return share;
  });
  const data = {
    labels: COLLECTIONS.map(row => row[lang === 'zh' ? 'entity' : lang === 'ar' ? 'entityAr' : 'entityEn']),
    datasets: [{
      data: shares,
      backgroundColor: MIX_COLORS,
      borderWidth: 0
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '55%',
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } }, rtl: isRtl },
      tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1, callbacks: { label: (ctx) => `${ctx.label}: ${compact(ctx.raw)} SAR` } }
    }
  };
  return <Doughnut data={data} options={options} />;
}

export default function StrategicDashboard() {
  const { lang, isRtl } = useI18n();
  const c = copy[lang] || copy.en;
  const money = useMoneyFormatter(lang);
  const pct = usePctFormatter(lang);
  const [draft, setDraft] = useState(DEFAULT_SCENARIO);
  const [run, setRun] = useState(null);
  const [error, setError] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const timer = useRef(null);
  const stepTimer = useRef(null);
  const thinkingRef = useRef(null);
  useEffect(() => () => { clearTimeout(timer.current); clearInterval(stepTimer.current); }, []);
  useEffect(() => { if (analyzing && thinkingRef.current) thinkingRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [analyzing]);
  const update = patch => { setDraft(prev => ({ ...prev, ...patch })); setError(false); };
  const updateTargetType = targetType => update({ targetType, target: targetType === 'opexCoverage' ? 65 : 3000000 });
  const stale = run && JSON.stringify(run.input) !== JSON.stringify(draft);
  const result = run?.result;
  const submit = event => {
    event.preventDefault();
    if (!Number.isFinite(Number(draft.target)) || Number(draft.target) <= 0) { setError(true); return; }
    const input = { ...draft, target: Number(draft.target) };
    setDraft(input);
    setAnalyzing(true);
    setRun(null);
    setStep(0);
    window.scrollTo({ top: 0, behavior: 'auto' });
    for (let el = document.querySelector('.strategic-page'); el; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) el.scrollTo({ top: 0, behavior: 'auto' });
    }
    clearTimeout(timer.current);
    clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => setStep(s => Math.min(s + 1, c.thinkingSteps.length - 1)), 600);
    timer.current = setTimeout(() => {
      clearInterval(stepTimer.current);
      setRun({ input, result: analyzeScenario(input) });
      setAnalyzing(false);
    }, c.thinkingSteps.length * 600 + 300);
  };

  const rtlPlugin = useMemo(() => ({ legend: { rtl: isRtl }, tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1, padding: 10 } }), [isRtl]);

  return <div className="strategic-page">
    <div className="page-head"><div><div className="page-title">{c.title}</div><div className="page-sub">{c.sub}</div></div><span className="badge badge--teal">{c.agent}</span></div>
    <form className="card card-pad strategic-form strategic-form--horizontal" onSubmit={submit} noValidate>
      <div className="strategic-form__head"><h2>{c.setup}</h2></div>
      <div className="strategic-form__basics">
        <div className="strategic-form__field">
          <label htmlFor="scenario-target-type">{c.targetType}</label>
          <select id="scenario-target-type" className="select" value={draft.targetType} onChange={e => updateTargetType(e.target.value)}>
            <option value="opexCoverage">{c.opexCoverage}</option>
            <option value="collectionAmount">{c.collectionAmount}</option>
          </select>
        </div>
        <div className="strategic-form__field">
          <label htmlFor="scenario-target">{c.target}</label>
          <div className="strategic-form__value-row">
            <input id="scenario-target" className="input" type="number" min="1" step="any" value={draft.target} aria-invalid={error} aria-describedby={error ? 'scenario-error' : undefined} onChange={e => update({ target: e.target.value })} />
            <span className="strategic-form__hint">{draft.targetType === 'opexCoverage' ? c.opexHelp : c.amountHelp}</span>
          </div>
          {error && <div id="scenario-error" className="strategic-error" role="alert">{c.error}</div>}
        </div>
        <div className="strategic-form__field">
          <label htmlFor="scenario-days">{c.horizon}</label>
          <select id="scenario-days" className="select" value={draft.days} onChange={e => update({ days: Number(e.target.value) })}>{[30, 60, 90].map(days => <option key={days} value={days}>{days} {c.days}</option>)}</select>
        </div>
      </div>
      <div className="strategic-form__levers">
        <div className="strategic-form__levers-head"><h3>{c.variables}</h3><p className="strategic-muted">{c.variableHelp}</p></div>
        <div className="strategic-form__levers-grid">
          {LEVERS.map(key => <div className={`strategic-lever${draft.enabled[key] ? '' : ' is-disabled'}`} key={key}>
            <div className="strategic-lever-title"><label><input type="checkbox" checked={draft.enabled[key]} onChange={e => update({ enabled: { ...draft.enabled, [key]: e.target.checked } })} />{c[key]}</label><div className="strategic-coverage-value strategic-coverage-value--readonly" aria-label={`${c[key]} (%)`}><span>{draft.enabled[key] ? draft.values[key] : 0}</span><span aria-hidden="true">%</span></div></div>
            <p>{c[`${key}Desc`]}</p>
            <input aria-label={c[key]} type="range" min="0" max="100" step="1" disabled={!draft.enabled[key]} value={draft.enabled[key] ? draft.values[key] : 0} onChange={e => update({ values: { ...draft.values, [key]: Number(e.target.value) } })} />
            <div className="strategic-range-labels"><span>0%</span><span>100%</span></div>
          </div>)}
        </div>
      </div>
      <div className="strategic-form__actions">
        <div className="strategic-form__buttons">
          <button className="btn btn-primary" type="submit" disabled={analyzing}>{c.run}</button>
          <button className="btn btn-ghost" type="button" onClick={() => { clearTimeout(timer.current); clearInterval(stepTimer.current); setAnalyzing(false); setStep(0); setDraft(DEFAULT_SCENARIO); setRun(null); setError(false); }}>{c.reset}</button>
        </div>
        <div className="strategic-portfolio"><span>{c.portfolio}</span><strong>{money(PORTFOLIO_TOTAL)}</strong><span>{c.opex}: {money(OPERATING_PROFILE.monthlyOpex * (draft.days / 30))}</span></div>
      </div>
    </form>
    <div className="strategic-results" aria-live="polite">
        {analyzing ? <div ref={thinkingRef} className="card strategic-thinking" role="status">
          <div className="strategic-thinking-orb" aria-hidden="true"><span></span><span></span><span></span></div>
          <h2>{c.thinking}<span className="strategic-thinking-ellipsis" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></h2>
          <p>{c.thinkingDesc}</p>
          <ul className="strategic-thinking-steps">{c.thinkingSteps.map((label, i) => i <= step ? <li key={label} className={i < step ? 'is-done' : 'is-active'}>{label}</li> : null)}</ul>
          <div className="strategic-thinking-bars" aria-hidden="true"><div></div><div></div><div></div></div>
        </div> : !result ? <div className="card strategic-empty"><div className="strategic-empty-icon" aria-hidden="true">◎</div><h2>{c.ready}</h2><p>{c.readyDesc}</p><div className="strategic-preview-tags">{[c.targetType, c.sensitivity, c.actions, c.roadmap].map(label => <span className="badge" key={label}>{label}</span>)}</div></div> : <>
          {stale && <div className="strategic-stale" role="status">{c.stale}</div>}
          <section className={`card card-pad strategic-verdict ${result.meetsTarget ? 'met' : result.achievable ? 'possible' : 'impossible'}`}>
            <div className="strategic-eyebrow">{c.results} · {run.input.days} {c.days} · {c.targetAmount}: {money(result.targetAmount)}</div>
            <h2>{result.meetsTarget ? c.met : result.achievable ? c.possible : c.impossible}</h2>
            <p>{result.meetsTarget ? c.metDesc : result.achievable ? c.possibleDesc : c.impossibleDesc}</p>
          </section>
          <div className="strategic-metrics">{[
            [c.baseline, result.baseline.collected, `${c.coverage}: ${pct(result.baseline.sustainabilityCoverage)}`],
            [c.projected, result.projected.collected, `${c.lift}: ${money(result.projected.collected - result.baseline.collected)}`],
            [c.maximum, result.maximum.collected, `${c.coverage}: ${pct(result.maximum.sustainabilityCoverage)}`]
          ].map(([label, value, help]) => <div className="card card-pad" key={label}><div className="strategic-muted">{label}</div><strong>{money(value)}</strong><small>{help}</small></div>)}</div>

          <div className="strategic-chart-grid">
            <section className="card card-pad strategic-chart-card">
              <h2>{c.coverageGauge}</h2>
              <p className="strategic-muted">{c.targetAmount}: {money(result.targetAmount)} · {c.opex}: {money(result.projected.opex)}</p>
              <div className="strategic-chart-wrap strategic-chart-wrap--gauge">
                <CoverageGauge projected={result.projected} targetAmount={result.targetAmount} money={money} isRtl={isRtl} />
              </div>
            </section>
            <section className="card card-pad strategic-chart-card">
              <h2>{c.scenarioCompare}</h2>
              <p className="strategic-muted">{c.compare}</p>
              <div className="strategic-chart-wrap">
                <ScenarioCompareChart baseline={result.baseline} projected={result.projected} maximum={result.maximum} targetAmount={result.targetAmount} money={money} c={c} isRtl={isRtl} />
              </div>
            </section>
            <section className="card card-pad strategic-chart-card strategic-chart-card--wide">
              <h2>{c.valueFlow}</h2>
              <p className="strategic-muted">{c.waterfallHint}</p>
              <div className="strategic-chart-wrap">
                <WaterfallChart projected={result.projected} money={money} c={c} isRtl={isRtl} />
              </div>
            </section>
            <section className="card card-pad strategic-chart-card">
              <h2>{c.sensitivityRadar}</h2>
              <p className="strategic-muted">{c.radarHint}</p>
              <div className="strategic-chart-wrap">
                <SensitivityRadar sensitivity={result.sensitivity} recommended={result.recommended} c={c} isRtl={isRtl} />
              </div>
            </section>
            <section className="card card-pad strategic-chart-card">
              <h2>{c.receivableMix}</h2>
              <p className="strategic-muted">{c.mixHint}</p>
              <div className="strategic-chart-wrap">
                <ReceivableMixChart projected={result.projected} lang={lang} isRtl={isRtl} />
              </div>
            </section>
            <section className="card card-pad strategic-chart-card strategic-chart-card--wide">
              <h2>{c.collectionTrajectory}</h2>
              <p className="strategic-muted">{c.targetAmount}: {money(result.targetAmount)}</p>
              <div className="strategic-chart-wrap">
                <TrajectoryChart run={run} c={c} isRtl={isRtl} />
              </div>
            </section>
          </div>

          <section className="card card-pad"><h2>{c.sensitivity}</h2><p className="strategic-muted">{c.sensitivityHelp}</p><div className="strategic-table-wrap"><table className="strategic-table"><thead><tr>{[c.variable, c.current, c.recommended, c.impact].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.sensitivity.map(item => <tr key={item.key}><th scope="row">{c[item.key]}</th><td>{item.value}%</td><td>{item.enabled ? `${result.recommended[item.key]}%` : c.locked}</td><td>{item.enabled ? money(item.impact) : '—'}</td></tr>)}</tbody></table></div></section>
          <section className="card card-pad"><h2>{c.actions}</h2><p className="strategic-muted">{c.actionHelp}</p>{result.actions.length ? <ol className="strategic-actions">{result.actions.map(item => <li key={item.key}><div><strong>{c[item.key]}</strong><p>{c.action}: {item.from}% → {item.to}%</p></div><div className="strategic-action-gain"><strong>+{money(item.gain)}</strong><small>{c.gain}</small></div></li>)}</ol> : <p>{c.noActions}</p>}<div className="strategic-outcome"><span>{c.outcome}</span><strong>{money(result.roadmapOutcome.collected)}</strong></div>{!result.achievable && <small>{c.maxInvoicingNeededHelp}: {money(result.maxAdditionalInvoicingNeeded)}</small>}</section>
          <section className="card card-pad"><h2>{c.roadmap}</h2><p className="strategic-muted">{c.roadmapHelp}</p><div className="strategic-roadmap">{[[1, 1, Math.ceil(run.input.days * .15)], [2, Math.ceil(run.input.days * .15) + 1, Math.ceil(run.input.days * .75)], [3, Math.ceil(run.input.days * .75) + 1, run.input.days]].map(([phase, from, to]) => <div key={phase}><span className="strategic-phase">0{phase}</span><small>{c.day} {from}–{to} {lang === 'zh' ? '天' : ''}</small><h3>{c[`phase${phase}`]}</h3><p>{c[`phase${phase}Desc`]}</p>{phase === 2 && result.actions.map(item => <div className="strategic-roadmap-change" key={item.key}>{c[item.key]}: {item.from}% → {item.to}%</div>)}</div>)}</div></section>
        </>}
        {result && <details className="card card-pad strategic-assumptions"><summary>{c.assumptions}</summary><p>{c.assumptionText}</p></details>}
      </div>
  </div>;
}
