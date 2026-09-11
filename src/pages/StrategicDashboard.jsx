import React, { useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { analyzeScenario, DEFAULT_SCENARIO, LEVERS, OPERATING_PROFILE, PORTFOLIO_TOTAL } from '../data/strategicModel';
import '../styles/strategic-dashboard.css';

const copy = {
  en: {
    title: 'Strategic Dashboard', sub: 'Model sustainability scenarios across Opex, revenue, invoicing, collections and exclusions.',
    whatIf: 'What-If Scenarios', agent: 'Modeling Agent · Demo', scope: 'Shared demo portfolio · 4 receivables · preliminary variables',
    note: 'Illustrative model only. The variable list is a starting point for product discussion, not a final specification or live AI forecast.',
    setup: 'Define your scenario', targetType: 'Target type', opexCoverage: 'Cover opex (%)', collectionAmount: 'Collect amount (SAR)', target: 'Target value', horizon: 'Planning horizon', days: 'days',
    opexHelp: 'The model converts this to SAR using the planning-period Opex.', amountHelp: 'The model uses this as the required collection outcome.',
    variables: 'Adjustable variables', variableHelp: 'Select variables available in the scenario. Unselected variables stay at 0%.',
    invoicing: 'Invoicing volume / amount', collections: 'Collections / collection rate', exclusions: 'Exclusions cleanup', statusMix: 'Invoice status mix', uncollectible: 'Uncollectible amounts',
    invoicingDesc: 'Additional valid invoicing capacity inside the period.', collectionsDesc: 'Operational follow-up intensity that improves collection conversion.', exclusionsDesc: 'Reduction in duplicates, disputes, struck-off debtors and enforcement referrals.', statusMixDesc: 'Shift of invoices toward approved, due and collectible statuses.', uncollectibleDesc: 'Reduction of amounts treated as structurally uncollectible.',
    run: 'Analyze scenario', reset: 'Reset', ready: 'Ready to model sustainability?', readyDesc: 'Choose a target type, set the target value, adjust preliminary variables and run the model.',
    portfolio: 'Current gross invoicing base', opex: 'Planning-period Opex', targetAmount: 'Modeled target', baseline: 'Baseline collections', projected: 'Scenario collections', maximum: 'Maximum achievable collections',
    results: 'Scenario analysis', met: 'Target met by current scenario', possible: 'Achievable with further changes', impossible: 'Beyond the modeled maximum',
    metDesc: 'The current settings reach the target in this model. Validate the assumptions before execution.', possibleDesc: 'The current settings fall short. The recommended variable changes show a modeled path to the target.', impossibleDesc: 'Even with selected variables at maximum, the target is above the modeled ceiling. Increase invoicing capacity, extend the horizon or revise the target.',
    gap: 'Remaining gap', lift: 'Improvement over baseline', coverage: 'Opex coverage', compare: 'Opex → Revenue → Invoicing → Collections → Sustainability',
    gross: 'Gross invoiced', excluded: 'Excluded impact', net: 'Net invoiced', readyStatus: 'Status-ready base', uncollectibleAmount: 'Uncollectible drag', collected: 'Collected outcome',
    invoicingNeeded: 'More invoicing needed', invoicingNeededHelp: 'Extra gross invoicing needed under the current scenario mix.', maxInvoicingNeededHelp: 'Extra gross invoicing still needed after all selected variables are maxed.',
    sensitivity: 'Variables & impact', sensitivityHelp: 'Additional collections if one variable moves to 100%, holding the others at current settings. Impacts overlap and should not be added together.',
    variable: 'Variable', current: 'Current', recommended: 'Recommended', impact: 'Additional potential', locked: 'Not selected',
    actions: 'Priority actions', actionHelp: 'Sequential changes ranked by modeled impact.', action: 'Move variable', gain: 'Estimated incremental collection', noActions: 'No further variable movement is recommended for this target.',
    roadmap: 'Rough roadmap', roadmapHelp: 'A practical sequence for validating and executing the scenario.', phase1: 'Validate baseline', phase1Desc: 'Confirm Opex, gross invoicing, exclusion categories, status mix and uncollectible assumptions.', phase2: 'Move priority variables', phase2Desc: 'Apply the recommended changes, starting with the highest-impact variables.', phase3: 'Track sustainability', phase3Desc: 'Review collections against Opex coverage weekly and re-run the scenario as exclusions or invoicing change.',
    assumptions: 'Model assumptions', assumptionText: 'The model starts from the demo receivables portfolio. Opex is fixed at SAR 1.8m per month. Variables are scenario intensities from 0% to 100%: invoicing can lift gross invoicing by up to 40%, collections can lift conversion by up to 22 points, exclusions can reduce the excluded share by up to 55%, status mix can lift ready invoices by up to 17 points, and uncollectible work can reduce the uncollectible share by up to 65%. These coefficients are illustrative and should be calibrated later.',
    stale: 'Parameters changed. Analyze again to update the results.', error: 'Enter a target value greater than zero.', day: 'Day', outcome: 'Estimated outcome after recommended changes',
  },
  zh: {
    title: '战略仪表盘', sub: '围绕 Opex、收入、开票、回款和可持续性进行情景建模。',
    whatIf: 'What-If 情景建模', agent: '建模智能体 · 演示', scope: '共享演示账款 · 4 笔应收款 · 初步变量', note: '仅用于演示建模。变量清单是产品讨论的初步范围，不是最终规格，也不是真实 AI 预测。',
    setup: '设定情景', targetType: '目标类型', opexCoverage: '覆盖 Opex（%）', collectionAmount: '回款金额（SAR）', target: '目标值', horizon: '规划周期', days: '天', opexHelp: '模型会按规划周期的 Opex 折算为 SAR 目标。', amountHelp: '模型会把该金额作为需达到的回款结果。',
    variables: '可调整变量', variableHelp: '选择本情景中允许调整的变量；未选择变量固定为 0%。',
    invoicing: '开票量 / 开票金额', collections: '回款 / 回款率', exclusions: '排除项清理', statusMix: '发票状态结构', uncollectible: '不可回收金额',
    invoicingDesc: '规划周期内新增有效开票能力。', collectionsDesc: '提升回款转化的运营跟进强度。', exclusionsDesc: '减少重复、争议、注销/无效债务人及转执行类排除项。', statusMixDesc: '将发票更多转入已审批、到期、可回收状态。', uncollectibleDesc: '降低被视为结构性不可回收的金额。',
    run: '分析情景', reset: '重置', ready: '准备建模财务可持续性？', readyDesc: '选择目标类型，输入目标值，调整初步变量后运行模型。',
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
  },
  ar: {
    title: 'لوحة المعلومات الاستراتيجية', sub: 'نمذجة الاستدامة عبر المصروفات والإيرادات والفوترة والتحصيل والاستثناءات.',
    whatIf: 'سيناريوهات ماذا لو', agent: 'وكيل النمذجة · تجريبي', scope: 'محفظة تجريبية مشتركة · 4 مستحقات · متغيرات أولية', note: 'نموذج توضيحي فقط. قائمة المتغيرات نقطة بداية للنقاش وليست مواصفات نهائية أو توقعاً فعلياً.',
    setup: 'حدد السيناريو', targetType: 'نوع الهدف', opexCoverage: 'تغطية المصروفات (%)', collectionAmount: 'مبلغ التحصيل (ر.س)', target: 'قيمة الهدف', horizon: 'فترة التخطيط', days: 'يوماً', opexHelp: 'يحوّل النموذج النسبة إلى مبلغ حسب مصروفات الفترة.', amountHelp: 'يستخدم النموذج هذا المبلغ كهدف تحصيل مطلوب.',
    variables: 'المتغيرات القابلة للتعديل', variableHelp: 'اختر المتغيرات المتاحة في السيناريو. تبقى غير المختارة عند 0%.',
    invoicing: 'حجم / مبلغ الفوترة', collections: 'التحصيل / معدل التحصيل', exclusions: 'معالجة الاستثناءات', statusMix: 'مزيج حالات الفواتير', uncollectible: 'المبالغ غير القابلة للتحصيل',
    invoicingDesc: 'قدرة فوترة صالحة إضافية داخل الفترة.', collectionsDesc: 'كثافة المتابعة التشغيلية لتحسين التحصيل.', exclusionsDesc: 'تقليل المكررات والنزاعات والحالات غير الصالحة والمحالة للتنفيذ.', statusMixDesc: 'تحويل الفواتير نحو حالات معتمدة ومستحقة وقابلة للتحصيل.', uncollectibleDesc: 'تقليل المبالغ المصنفة كغير قابلة للتحصيل.',
    run: 'تحليل السيناريو', reset: 'إعادة ضبط', ready: 'جاهز لنمذجة الاستدامة؟', readyDesc: 'اختر نوع الهدف وأدخل القيمة وعدّل المتغيرات الأولية ثم شغّل النموذج.',
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
  }
};

const barWidth = (value, max) => `${Math.min(100, 100 * value / Math.max(1, max))}%`;

export default function StrategicDashboard() {
  const { lang } = useI18n();
  const c = copy[lang] || copy.en;
  const [draft, setDraft] = useState(DEFAULT_SCENARIO);
  const [run, setRun] = useState(null);
  const [error, setError] = useState(false);
  const money = value => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value);
  const pct = value => `${new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 1 }).format(value)}%`;
  const update = patch => { setDraft(prev => ({ ...prev, ...patch })); setError(false); };
  const updateTargetType = targetType => update({ targetType, target: targetType === 'opexCoverage' ? 65 : 3000000 });
  const stale = run && JSON.stringify(run.input) !== JSON.stringify(draft);
  const result = run?.result;
  const submit = event => {
    event.preventDefault();
    if (!Number.isFinite(Number(draft.target)) || Number(draft.target) <= 0) { setError(true); return; }
    const input = { ...draft, target: Number(draft.target) };
    setDraft(input);
    setRun({ input, result: analyzeScenario(input) });
  };
  const comparisonMax = result ? Math.max(result.targetAmount, result.maximum.collected, result.projected.grossInvoiced) : 1;

  return <div className="strategic-page">
    <div className="page-head"><div><div className="page-title">{c.title}</div><div className="page-sub">{c.sub}</div></div><span className="badge badge--teal">{c.agent}</span></div>
    <div className="strategic-tab">◎ &nbsp; {c.whatIf}</div>
    <div className="strategic-notice"><strong>{c.scope}</strong><span>{c.note}</span></div>
    <div className="strategic-workspace">
      <form className="card card-pad strategic-form" onSubmit={submit} noValidate>
        <h2>{c.setup}</h2>
        <label htmlFor="scenario-target-type">{c.targetType}</label>
        <select id="scenario-target-type" className="select" value={draft.targetType} onChange={e => updateTargetType(e.target.value)}>
          <option value="opexCoverage">{c.opexCoverage}</option>
          <option value="collectionAmount">{c.collectionAmount}</option>
        </select>
        <label htmlFor="scenario-target">{c.target}</label>
        <input id="scenario-target" className="input" type="number" min="1" step="any" value={draft.target} aria-invalid={error} aria-describedby={error ? 'scenario-error' : undefined} onChange={e => update({ target: e.target.value })} />
        <p className="strategic-muted">{draft.targetType === 'opexCoverage' ? c.opexHelp : c.amountHelp}</p>
        {error && <div id="scenario-error" className="strategic-error" role="alert">{c.error}</div>}
        <label htmlFor="scenario-days">{c.horizon}</label>
        <select id="scenario-days" className="select" value={draft.days} onChange={e => update({ days: Number(e.target.value) })}>{[30, 60, 90].map(days => <option key={days} value={days}>{days} {c.days}</option>)}</select>
        <h3>{c.variables}</h3><p className="strategic-muted">{c.variableHelp}</p>
        {LEVERS.map(key => <div className={`strategic-lever${draft.enabled[key] ? '' : ' is-disabled'}`} key={key}>
          <div className="strategic-lever-title"><label><input type="checkbox" checked={draft.enabled[key]} onChange={e => update({ enabled: { ...draft.enabled, [key]: e.target.checked } })} />{c[key]}</label><div className="strategic-coverage-value"><input className="input" aria-label={`${c[key]} (%)`} type="number" min="0" max="100" step="1" disabled={!draft.enabled[key]} value={draft.enabled[key] ? draft.values[key] : 0} onChange={e => update({ values: { ...draft.values, [key]: Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))) } })} /><span aria-hidden="true">%</span></div></div>
          <p>{c[`${key}Desc`]}</p>
          <input aria-label={c[key]} type="range" min="0" max="100" step="1" disabled={!draft.enabled[key]} value={draft.enabled[key] ? draft.values[key] : 0} onChange={e => update({ values: { ...draft.values, [key]: Number(e.target.value) } })} />
          <div className="strategic-range-labels"><span>0%</span><span>100%</span></div>
        </div>)}
        <button className="btn btn-primary" type="submit">{c.run} <span aria-hidden="true">↗</span></button>
        <button className="btn btn-ghost" type="button" onClick={() => { setDraft(DEFAULT_SCENARIO); setRun(null); setError(false); }}>{c.reset}</button>
        <div className="strategic-portfolio"><span>{c.portfolio}</span><strong>{money(PORTFOLIO_TOTAL)}</strong><span>{c.opex}: {money(OPERATING_PROFILE.monthlyOpex * (draft.days / 30))}</span></div>
      </form>
      <div className="strategic-results" aria-live="polite">
        {!result ? <div className="card strategic-empty"><div className="strategic-empty-icon" aria-hidden="true">◎</div><h2>{c.ready}</h2><p>{c.readyDesc}</p><div className="strategic-preview-tags">{[c.targetType, c.sensitivity, c.actions, c.roadmap].map(label => <span className="badge" key={label}>{label}</span>)}</div></div> : <>
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
          <section className="card card-pad"><h2>{c.compare}</h2><div className="strategic-bars">{[
            [c.opex, result.projected.opex, 'baseline'], [c.gross, result.projected.grossInvoiced, 'scenario'], [c.excluded, result.projected.excludedAmount, 'target'], [c.net, result.projected.netInvoiced, 'maximum'], [c.readyStatus, result.projected.statusReadyAmount, 'scenario'], [c.uncollectibleAmount, result.projected.uncollectibleAmount, 'target'], [c.collected, result.projected.collected, 'scenario']
          ].map(([label, value, type]) => <div key={label}><div className="strategic-bar-label"><span>{label}</span><strong>{money(value)}</strong></div><div className="strategic-track"><div className={type} style={{ width: barWidth(value, comparisonMax) }} /></div></div>)}</div><p className="strategic-muted">{c.gap}: <strong>{money(Math.max(0, result.targetAmount - result.projected.collected))}</strong> · {c.invoicingNeeded}: <strong>{money(result.meetsTarget ? 0 : result.additionalInvoicingNeeded)}</strong></p></section>
          <section className="card card-pad"><h2>{c.sensitivity}</h2><p className="strategic-muted">{c.sensitivityHelp}</p><div className="strategic-table-wrap"><table className="strategic-table"><thead><tr>{[c.variable, c.current, c.recommended, c.impact].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.sensitivity.map(item => <tr key={item.key}><th scope="row">{c[item.key]}</th><td>{item.value}%</td><td>{item.enabled ? `${result.recommended[item.key]}%` : c.locked}</td><td>{item.enabled ? money(item.impact) : '—'}</td></tr>)}</tbody></table></div></section>
          <section className="card card-pad"><h2>{c.actions}</h2><p className="strategic-muted">{c.actionHelp}</p>{result.actions.length ? <ol className="strategic-actions">{result.actions.map(item => <li key={item.key}><div><strong>{c[item.key]}</strong><p>{c.action}: {item.from}% → {item.to}%</p></div><div className="strategic-action-gain"><strong>+{money(item.gain)}</strong><small>{c.gain}</small></div></li>)}</ol> : <p>{c.noActions}</p>}<div className="strategic-outcome"><span>{c.outcome}</span><strong>{money(result.roadmapOutcome.collected)}</strong></div>{!result.achievable && <small>{c.maxInvoicingNeededHelp}: {money(result.maxAdditionalInvoicingNeeded)}</small>}</section>
          <section className="card card-pad"><h2>{c.roadmap}</h2><p className="strategic-muted">{c.roadmapHelp}</p><div className="strategic-roadmap">{[[1, 1, Math.ceil(run.input.days * .15)], [2, Math.ceil(run.input.days * .15) + 1, Math.ceil(run.input.days * .75)], [3, Math.ceil(run.input.days * .75) + 1, run.input.days]].map(([phase, from, to]) => <div key={phase}><span className="strategic-phase">0{phase}</span><small>{c.day} {from}–{to} {lang === 'zh' ? '天' : ''}</small><h3>{c[`phase${phase}`]}</h3><p>{c[`phase${phase}Desc`]}</p>{phase === 2 && result.actions.map(item => <div className="strategic-roadmap-change" key={item.key}>{c[item.key]}: {item.from}% → {item.to}%</div>)}</div>)}</div></section>
        </>}
        <details className="card card-pad strategic-assumptions"><summary>{c.assumptions}</summary><p>{c.assumptionText}</p></details>
      </div>
    </div>
  </div>;
}
