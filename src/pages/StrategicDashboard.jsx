import React, { useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { analyzeScenario, DEFAULT_SCENARIO, LEVERS, PORTFOLIO_TOTAL } from '../data/strategicModel';
import '../styles/strategic-dashboard.css';

const copy = {
  en: {
    title: 'Strategic Dashboard', sub: 'Explore possibilities. Understand the trade-offs. Build a path to your target.',
    whatIf: 'What-If Scenarios', agent: 'Modeling Agent · Demo', scope: 'Shared demo portfolio · 4 receivables · all organizations',
    note: 'Illustrative model using Collection Forecast sample data. Results are assumption-based estimates, not live AI predictions or guaranteed recoveries.',
    setup: 'Define your scenario', target: 'Collection target (SAR)', horizon: 'Planning horizon', days: 'days',
    variables: 'Adjust your variables', variableHelp: 'Select the interventions available to your team. Unselected variables stay at 0%.',
    reminders: 'Reminder coverage', legal: 'Legal follow-up coverage', plans: 'Payment-plan coverage',
    remindersDesc: 'Share of receivables receiving structured reminders.', legalDesc: 'Share of high-risk receivables receiving legal follow-up.', plansDesc: 'Share of accounts below 80% recovery probability offered a payment plan.',
    run: 'Analyze scenario', reset: 'Reset', ready: 'Ready to explore your target?', readyDesc: 'Set a target and adjust the available interventions, then run the model to see feasibility, variable impact and a recommended roadmap.',
    portfolio: 'Outstanding portfolio', baseline: 'Baseline estimate', projected: 'Scenario estimate', maximum: 'Maximum achievable estimate',
    results: 'Scenario analysis', met: 'Target met by current scenario', possible: 'Achievable with further changes', impossible: 'Beyond the modeled maximum',
    metDesc: 'The selected settings meet your target in this model. Validate the assumptions and monitor execution.',
    possibleDesc: 'The current settings fall short. The changes below provide a modeled path to your target.',
    impossibleDesc: 'Even at full coverage for every selected variable, the model falls short. Extend the horizon, enable additional interventions or revise the target.',
    gap: 'Remaining gap to target', lift: 'Improvement over baseline', headroom: 'Selected variables at 100% coverage',
    compare: 'Outcome comparison', targetLabel: 'Target', sensitivity: 'Variables & impact', sensitivityHelp: 'Additional recovery when one variable rises to 100%, holding all others at current settings. These impacts overlap and must not be added together.',
    variable: 'Variable', current: 'Current', recommended: 'Recommended', impact: 'Additional potential', locked: 'Not selected',
    actions: 'Priority actions', actionHelp: 'Ranked by additional recovery potential. Gains below are sequential and account for the preceding actions.',
    action: 'Increase coverage', gain: 'Estimated incremental recovery', noActions: 'No further variable increases are recommended. Monitor the current plan or revise the scenario constraints.',
    roadmap: 'Potential roadmap', roadmapHelp: 'A suggested sequence, subject to team capacity and case review. The model does not estimate implementation costs.',
    phase1: 'Validate & prepare', phase1Desc: 'Confirm balances, recovery assumptions and eligible accounts. Assign a collection owner to each priority case.',
    phase2: 'Execute priority actions', phase2Desc: 'Roll out the recommended coverage changes in priority order. Record responses and payment commitments.',
    phase3: 'Review & adapt', phase3Desc: 'Compare actual collections against the target weekly. Re-run the scenario with revised assumptions and escalate remaining gaps.',
    issues: 'Key issues to address', exposure: 'Modeled unrecovered balance', risk: 'Focus first on the largest residual exposures; verify disputes and payment commitments before taking action.',
    assumptions: 'Model assumptions', assumptionText: 'Existing recovery probabilities are treated as 90-day estimates. Shorter horizons use 1 − (1 − probability)^(days / 90). At full coverage, reminders reduce remaining non-recovery by 12%, legal follow-up by 32% for high-risk cases, and payment plans by 18% for accounts below 80% probability. Effects scale by days / 90 and combine multiplicatively. These illustrative coefficients are not calibrated to historical data. The maximum uses selected variables at 100%; unselected variables stay at zero. No new receivables, costs or settlement discounts are modeled.',
    stale: 'Parameters changed. Analyze again to update the results.', error: 'Enter a collection target greater than zero.',
    day: 'Day', outcome: 'Estimated outcome after recommended changes', above: 'The target exceeds the total outstanding portfolio.',
  },
  zh: {
    title: '战略仪表盘', sub: '探索不同方案，理解变量影响，制定目标实现路径。', whatIf: 'What-If 情景建模', agent: '建模智能体 · 演示', scope: '共享演示账款 · 4 笔应收款 · 全部机构',
    note: '使用催收预测中的示例数据进行演示建模。结果基于假设，不是真实 AI 预测，也不保证实际回款。',
    setup: '设定情景', target: '回款目标（SAR）', horizon: '规划周期', days: '天', variables: '调整变量', variableHelp: '选择团队可执行的措施；未选择的变量固定为 0%。',
    reminders: '催收提醒覆盖率', legal: '法务跟进覆盖率', plans: '分期方案覆盖率', remindersDesc: '接受系统化催收提醒的应收款比例。', legalDesc: '接受法务跟进的高风险应收款比例。', plansDesc: '回收概率低于 80% 的账款中，提供分期方案的比例。',
    run: '分析情景', reset: '重置', ready: '准备探索目标实现路径？', readyDesc: '设定目标并调整可用措施，运行模型以查看可达性、变量影响和建议路线图。',
    portfolio: '待回收账款总额', baseline: '基准回款估计', projected: '当前方案回款估计', maximum: '最大可达回款估计', results: '情景分析', met: '当前方案已满足目标', possible: '进一步调整后可达成', impossible: '超出模型可达上限',
    metDesc: '当前参数在模型中已满足目标。请验证假设，并跟踪执行情况。', possibleDesc: '当前方案仍有缺口。以下调整提供了一条模型中的目标实现路径。', impossibleDesc: '即使所有选中变量达到全覆盖，模型仍无法满足目标。请延长周期、启用其他措施或调整目标。',
    gap: '距目标尚有缺口', lift: '相对基准增加', headroom: '所有选中变量均为 100% 覆盖率', compare: '方案结果对比', targetLabel: '目标', sensitivity: '变量与影响', sensitivityHelp: '保持其他变量不变，将单一变量提高至 100% 的额外回款。这些影响存在重叠，不可直接相加。',
    variable: '变量', current: '当前', recommended: '建议', impact: '额外回款潜力', locked: '未选择', actions: '优先行动', actionHelp: '按额外回款潜力排序。下方增量按行动顺序计算，已考虑前序行动。', action: '提高覆盖率', gain: '预计增量回款', noActions: '无需进一步提高变量。请跟踪当前方案，或调整情景约束。',
    roadmap: '潜在实现路线图', roadmapHelp: '以下为建议执行顺序，需结合团队能力及个案审核；模型未估计实施成本。', phase1: '验证与准备', phase1Desc: '确认余额、回收假设和适用账款，为每个重点个案指定催收负责人。', phase2: '执行优先行动', phase2Desc: '按优先顺序落实建议覆盖率，记录客户回复和付款承诺。', phase3: '复盘与调整', phase3Desc: '每周对照目标检查实际回款，更新假设后重新运行模型，并升级处理剩余缺口。',
    issues: '需要关注的关键问题', exposure: '模型预计未回收余额', risk: '优先关注剩余风险敞口最大的账款，采取行动前核实争议及付款承诺。', assumptions: '模型假设', assumptionText: '现有回收概率视为 90 天估计，短周期采用 1 − (1 − 概率)^(天数 / 90)。全覆盖时，提醒将剩余未回收概率降低 12%，法务跟进将高风险账款的剩余未回收概率降低 32%，分期方案将回收概率低于 80% 的账款的剩余未回收概率降低 18%。各效果按天数 / 90 缩放并以乘法组合。系数仅用于演示，未用历史数据校准。上限使用选中变量 100% 覆盖率，未选中变量保持为零。模型不考虑新增应收款、成本及和解折扣。',
    stale: '参数已修改，请重新分析以更新结果。', error: '请输入大于零的回款目标。', day: '第', outcome: '完成建议调整后的回款估计', above: '目标超过了全部待回收账款总额。',
  },
  ar: {
    title: 'لوحة المعلومات الاستراتيجية', sub: 'استكشف السيناريوهات وافهم أثر المتغيرات وحدد مساراً لتحقيق هدفك.', whatIf: 'سيناريوهات ماذا لو', agent: 'وكيل النمذجة · تجريبي', scope: 'محفظة تجريبية مشتركة · 4 مستحقات · جميع الجهات', note: 'نموذج توضيحي يستخدم بيانات توقعات التحصيل التجريبية. النتائج تقديرات مبنية على افتراضات وليست تنبؤات ذكاء اصطناعي فعلية أو ضماناً للتحصيل.',
    setup: 'حدد السيناريو', target: 'هدف التحصيل (ر.س)', horizon: 'فترة التخطيط', days: 'يوماً', variables: 'تعديل المتغيرات', variableHelp: 'اختر الإجراءات المتاحة لفريقك. تبقى المتغيرات غير المختارة عند 0%.', reminders: 'تغطية التذكيرات', legal: 'تغطية المتابعة القانونية', plans: 'تغطية خطط السداد', remindersDesc: 'نسبة المستحقات التي تتلقى تذكيرات منتظمة.', legalDesc: 'نسبة المستحقات عالية المخاطر التي تتلقى متابعة قانونية.', plansDesc: 'نسبة الحسابات ذات احتمال تحصيل أقل من 80% التي تُعرض عليها خطة سداد.',
    run: 'تحليل السيناريو', reset: 'إعادة ضبط', ready: 'هل أنت مستعد لاستكشاف هدفك؟', readyDesc: 'حدد الهدف والإجراءات المتاحة ثم شغّل النموذج لعرض إمكانية التحقيق وأثر المتغيرات وخارطة الطريق.', portfolio: 'إجمالي المستحقات', baseline: 'التقدير الأساسي', projected: 'تقدير السيناريو', maximum: 'أقصى تقدير قابل للتحقيق', results: 'تحليل السيناريو', met: 'السيناريو الحالي يحقق الهدف', possible: 'قابل للتحقيق مع تغييرات إضافية', impossible: 'يتجاوز الحد الأقصى للنموذج', metDesc: 'الإعدادات الحالية تحقق الهدف ضمن النموذج. تحقق من الافتراضات وراقب التنفيذ.', possibleDesc: 'الإعدادات الحالية غير كافية. توفر التغييرات أدناه مساراً تقديرياً لتحقيق الهدف.', impossibleDesc: 'حتى مع التغطية الكاملة للمتغيرات المختارة يبقى الهدف بعيداً. مدد الفترة أو فعّل إجراءات إضافية أو راجع الهدف.',
    gap: 'الفجوة المتبقية', lift: 'التحسن عن الأساس', headroom: 'تغطية 100% لجميع المتغيرات المختارة', compare: 'مقارنة النتائج', targetLabel: 'الهدف', sensitivity: 'المتغيرات وأثرها', sensitivityHelp: 'التحصيل الإضافي عند رفع متغير واحد إلى 100% مع تثبيت البقية. تتداخل الآثار ولا يجوز جمعها.', variable: 'المتغير', current: 'الحالي', recommended: 'الموصى به', impact: 'الإمكانات الإضافية', locked: 'غير مختار', actions: 'الإجراءات ذات الأولوية', actionHelp: 'مرتبة حسب إمكانات التحصيل الإضافية. المكاسب متسلسلة وتأخذ الإجراءات السابقة بالحسبان.', action: 'زيادة التغطية', gain: 'التحصيل الإضافي المقدر', noActions: 'لا توجد زيادات إضافية موصى بها. راقب الخطة أو راجع قيود السيناريو.',
    roadmap: 'خارطة طريق محتملة', roadmapHelp: 'تسلسل مقترح يخضع لقدرة الفريق ومراجعة الحالات. لا يقدر النموذج تكاليف التنفيذ.', phase1: 'التحقق والتحضير', phase1Desc: 'تحقق من الأرصدة والافتراضات والحسابات المؤهلة وحدد مسؤول تحصيل لكل حالة ذات أولوية.', phase2: 'تنفيذ الإجراءات', phase2Desc: 'نفذ تغييرات التغطية بالترتيب وسجل الردود والتعهدات بالدفع.', phase3: 'المراجعة والتعديل', phase3Desc: 'قارن التحصيل الفعلي بالهدف أسبوعياً وأعد تشغيل النموذج بافتراضات محدثة وصعّد الفجوات المتبقية.', issues: 'مسائل رئيسية للمعالجة', exposure: 'الرصيد غير المحصل المقدر', risk: 'ركز على أكبر الأرصدة المتبقية وتحقق من النزاعات والتعهدات قبل اتخاذ الإجراءات.',
    assumptions: 'افتراضات النموذج', assumptionText: 'تُعامل احتمالات التحصيل كتقديرات لمدة 90 يوماً. تستخدم الفترات الأقصر 1 − (1 − الاحتمال)^(الأيام / 90). عند التغطية الكاملة تقلل التذكيرات احتمال عدم التحصيل المتبقي بنسبة 12% والمتابعة القانونية 32% للحالات عالية المخاطر وخطط السداد 18% للحسابات دون احتمال 80%. تتناسب الآثار مع الأيام / 90 وتُدمج بالضرب. المعاملات توضيحية وغير معايرة تاريخياً. يستخدم الحد الأقصى تغطية 100% للمتغيرات المختارة وصفراً لغير المختارة. لا يشمل النموذج مستحقات جديدة أو تكاليف أو خصومات تسوية.',
    stale: 'تغيرت المعلمات. أعد التحليل لتحديث النتائج.', error: 'أدخل هدف تحصيل أكبر من الصفر.', day: 'اليوم', outcome: 'التقدير بعد التغييرات الموصى بها', above: 'يتجاوز الهدف إجمالي المستحقات.',
  }
};

export default function StrategicDashboard() {
  const { lang, T } = useI18n();
  const c = copy[lang] || copy.en;
  const [draft, setDraft] = useState(DEFAULT_SCENARIO);
  const [run, setRun] = useState(null);
  const [error, setError] = useState(false);
  const money = value => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value);
  const update = patch => { setDraft(prev => ({ ...prev, ...patch })); setError(false); };
  const stale = run && JSON.stringify(run.input) !== JSON.stringify(draft);
  const result = run?.result;
  const submit = event => {
    event.preventDefault();
    if (!Number.isFinite(Number(draft.target)) || Number(draft.target) <= 0) { setError(true); return; }
    const input = { ...draft, target: Number(draft.target) };
    setDraft(input);
    setRun({ input, result: analyzeScenario(input) });
  };
  return <div className="strategic-page">
    <div className="page-head"><div><div className="page-title">{c.title}</div><div className="page-sub">{c.sub}</div></div><span className="badge badge--teal">{c.agent}</span></div>
    <div className="strategic-tab">◎ &nbsp; {c.whatIf}</div>
    <div className="strategic-notice"><strong>{c.scope}</strong><span>{c.note}</span></div>
    <div className="strategic-workspace">
      <form className="card card-pad strategic-form" onSubmit={submit} noValidate>
        <h2>{c.setup}</h2>
        <label htmlFor="scenario-target">{c.target}</label>
        <input id="scenario-target" className="input" type="number" min="1" step="any" value={draft.target} aria-invalid={error} aria-describedby={error ? 'scenario-error' : undefined} onChange={e => update({ target: e.target.value })} />
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
        <div className="strategic-portfolio"><span>{c.portfolio}</span><strong>{money(PORTFOLIO_TOTAL)}</strong></div>
      </form>
      <div className="strategic-results" aria-live="polite">
        {!result ? <div className="card strategic-empty"><div className="strategic-empty-icon" aria-hidden="true">◎</div><h2>{c.ready}</h2><p>{c.readyDesc}</p><div className="strategic-preview-tags">{[c.results, c.sensitivity, c.actions, c.roadmap].map(label => <span className="badge" key={label}>{label}</span>)}</div></div> : <>
          {stale && <div className="strategic-stale" role="status">{c.stale}</div>}
          <section className={`card card-pad strategic-verdict ${result.meetsTarget ? 'met' : result.achievable ? 'possible' : 'impossible'}`}>
            <div className="strategic-eyebrow">{c.results} · {run.input.days} {c.days} · {c.targetLabel}: {money(run.input.target)}</div>
            <h2>{result.meetsTarget ? c.met : result.achievable ? c.possible : c.impossible}</h2>
            <p>{result.meetsTarget ? c.metDesc : result.achievable ? c.possibleDesc : c.impossibleDesc}</p>
            {run.input.target > PORTFOLIO_TOTAL && <p><strong>{c.above}</strong></p>}
          </section>
          <div className="strategic-metrics">{[
            [c.baseline, result.baseline, c.portfolio],
            [c.projected, result.projected, `${c.lift}: ${money(result.projected - result.baseline)}`],
            [c.maximum, result.maximum, c.headroom]
          ].map(([label, value, help]) => <div className="card card-pad" key={label}><div className="strategic-muted">{label}</div><strong>{money(value)}</strong><small>{help === c.portfolio ? c.scope : help}</small></div>)}</div>
          <section className="card card-pad"><h2>{c.compare}</h2><div className="strategic-bars">{[[c.baseline, result.baseline, 'baseline'], [c.projected, result.projected, 'scenario'], [c.maximum, result.maximum, 'maximum'], [c.targetLabel, run.input.target, 'target']].map(([label, value, type]) => <div key={type}><div className="strategic-bar-label"><span>{label}</span><strong>{money(value)}</strong></div><div className="strategic-track"><div className={type} style={{ width: `${100 * value / Math.max(PORTFOLIO_TOTAL, run.input.target)}%` }} /></div></div>)}</div><p className="strategic-muted">{c.gap}: <strong>{money(Math.max(0, run.input.target - result.projected))}</strong></p></section>
          <section className="card card-pad"><h2>{c.sensitivity}</h2><p className="strategic-muted">{c.sensitivityHelp}</p><div className="strategic-table-wrap"><table className="strategic-table"><thead><tr>{[c.variable, c.current, c.recommended, c.impact].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.sensitivity.map(item => <tr key={item.key}><th scope="row">{c[item.key]}</th><td>{item.value}%</td><td>{item.enabled ? `${result.recommended[item.key]}%` : c.locked}</td><td>{item.enabled ? money(item.impact) : '—'}</td></tr>)}</tbody></table></div></section>
          <section className="card card-pad"><h2>{c.actions}</h2><p className="strategic-muted">{c.actionHelp}</p>{result.actions.length ? <ol className="strategic-actions">{result.actions.map(item => <li key={item.key}><div><strong>{c[item.key]}</strong><p>{c.action}: {item.from}% → {item.to}%</p></div><div className="strategic-action-gain"><strong>+{money(item.gain)}</strong><small>{c.gain}</small></div></li>)}</ol> : <p>{c.noActions}</p>}<div className="strategic-outcome">{c.outcome}<strong>{money(result.roadmapOutcome)}</strong></div></section>
          <section className="card card-pad"><h2>{c.roadmap}</h2><p className="strategic-muted">{c.roadmapHelp}</p><div className="strategic-roadmap">{[[1, 1, Math.ceil(run.input.days * .15)], [2, Math.ceil(run.input.days * .15) + 1, Math.ceil(run.input.days * .75)], [3, Math.ceil(run.input.days * .75) + 1, run.input.days]].map(([phase, from, to]) => <div key={phase}><span className="strategic-phase">0{phase}</span><small>{c.day} {from}–{to} {lang === 'zh' ? '天' : ''}</small><h3>{c[`phase${phase}`]}</h3><p>{c[`phase${phase}Desc`]}</p>{phase === 2 && result.actions.map(item => <div className="strategic-roadmap-change" key={item.key}>{c[item.key]}: {item.from}% → {item.to}%</div>)}</div>)}</div></section>
          <section className="card card-pad"><h2>{c.issues}</h2><p className="strategic-muted">{c.risk}</p>{result.issues.slice(0, 2).map(row => <div className="strategic-issue" key={row.id}><div><strong>{T(row, 'entity')}</strong><small>{row.id} · {row.overdue} {c.days}</small></div><div><strong>{money(row.unrecovered)}</strong><small>{c.exposure}</small></div></div>)}</section>
        </>}
        <details className="card card-pad strategic-assumptions"><summary>{c.assumptions}</summary><p>{c.assumptionText}</p></details>
      </div>
    </div>
  </div>;
}
