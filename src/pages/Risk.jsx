import React, { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useI18n } from '../context/I18nContext';
import { fmtMoney } from '../data/mock';
import { computeAllRiskFlags, CATEGORY_LABELS, CATEGORY_COLOR, RISK_CATEGORIES } from '../data/riskAnalysis';
import AgentThinking from '../components/ai/AgentThinking';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const pick = (lang, en, ar, zh) => (lang === 'ar' ? ar : lang === 'zh' ? zh : en);

const CHART_COLOR = {
  duplicate: 'rgba(175, 8, 24, 0.65)',
  struck_off_registry: 'rgba(255, 193, 7, 0.75)',
  deceased_person: 'rgba(230, 126, 34, 0.75)',
  value_anomaly: 'rgba(111, 66, 193, 0.7)'
};
const CATEGORY_ORDER = RISK_CATEGORIES;
const categoryLabel = (c, lang) => (lang === 'ar' ? CATEGORY_LABELS[c].ar : lang === 'zh' ? CATEGORY_LABELS[c].zh : CATEGORY_LABELS[c].en);

function badgeClass(color) {
  const map = { red: 'badge--red', gold: 'badge--gold', orange: 'badge--orange', purple: 'badge--purple', green: 'badge--green' };
  return map[color] || '';
}

// Every step here narrates a REAL, deterministic rule already computed in
// riskAnalysis.js — nothing here is randomized or simulated, so the same
// invoice always produces the same analysis.
function evidenceStep(f, lang) {
  const inv = f.invoice;
  if (f.category === 'duplicate') {
    return {
      title: pick(lang, 'Checking for duplicate submissions', 'التحقق من التكرار', '检查重复提交'),
      detail: pick(
        lang,
        'Matches another recorded invoice on beneficiary + amount + Amanah + date (a 4-field tuple match) — auto-blocked and excluded from net-invoiced.',
        'يطابق فاتورة أخرى مسجَّلة من حيث الجهة المستفيدة والمبلغ والأمانة والتاريخ (تطابق رباعي) — محظورة تلقائيًا ومستبعدة من صافي الفوترة.',
        '在缴款方、金额、市政厅与日期四个字段上与另一条已记录发票匹配（四元组匹配）——已自动拦截并从净开票额中排除。'
      )
    };
  }
  if (f.category === 'struck_off_registry') {
    return {
      title: pick(lang, 'Checking commercial registry status', 'التحقق من حالة السجل التجاري', '核查商业登记状态'),
      detail: pick(
        lang,
        'The beneficiary’s commercial registration is struck off / cancelled — this invoice is excluded from the collection-rate denominator entirely.',
        'السجل التجاري للجهة المستفيدة مشطوب/ملغى — هذه الفاتورة مستبعدة كليًا من مقام معدل التحصيل.',
        '缴款方的商业登记已被注销——该发票已完全从收缴率分母中排除。'
      )
    };
  }
  if (f.category === 'deceased_person') {
    return {
      title: pick(lang, 'Checking debtor status', 'التحقق من حالة المدين', '核查债务人状态'),
      detail: pick(
        lang,
        'The debtor is recorded as deceased — as a sole establishment legally tied to one individual owner, this invoice can no longer be collected through standard channels.',
        'المدين مسجَّل كمتوفى — وبما أنها مؤسسة فردية مرتبطة قانونًا بمالك واحد، لم يعد بالإمكان تحصيل الفاتورة عبر القنوات الاعتيادية.',
        '债务人已被记录为已故——由于这是一家在法律上与单一业主绑定的个体机构，该发票已无法通过常规渠道收缴。'
      )
    };
  }
  return {
    title: pick(lang, 'Comparing against the Amanah’s historical baseline', 'المقارنة مع المعدل التاريخي للأمانة', '与市政厅历史基准对比'),
    detail: pick(
      lang,
      `This invoice is ${f.ratio}× its Amanah’s average invoice amount (${fmtMoney(inv.amount)} SAR vs. an average of ${fmtMoney(f.amanahAvg)} SAR across its other invoices).`,
      `تبلغ قيمة هذه الفاتورة ${f.ratio} ضعف متوسط قيمة فواتير أمانتها (${fmtMoney(inv.amount)} ريال مقابل متوسط ${fmtMoney(f.amanahAvg)} ريال لبقية فواتير الأمانة).`,
      `该发票金额是其所属市政厅平均发票金额的 ${f.ratio} 倍（${fmtMoney(inv.amount)} 里亚尔，而该市政厅其他发票的平均值为 ${fmtMoney(f.amanahAvg)} 里亚尔）。`
    )
  };
}

function actionTextFor(f, lang) {
  if (f.category === 'duplicate') {
    return pick(
      lang,
      'No manual invoicing action needed — keep auto-blocked unless the beneficiary formally disputes it.',
      'لا حاجة لإجراء يدوي — يبقى الحظر التلقائي قائمًا ما لم تعترض الجهة المستفيدة رسميًا.',
      '无需人工处理——保持自动拦截状态，除非缴款方正式提出异议。'
    );
  }
  if (f.category === 'struck_off_registry') {
    return pick(
      lang,
      'Refer to the legal/collections team to pursue via the registry-cancellation channel rather than standard invoicing.',
      'الإحالة إلى فريق الشؤون القانونية/التحصيل لمتابعتها عبر مسار شطب السجل بدل الفوترة الاعتيادية.',
      '转交法务/催收团队，通过注销登记渠道而非常规开票流程跟进。'
    );
  }
  if (f.category === 'deceased_person') {
    return pick(
      lang,
      'Refer to the estate/inheritance settlement process; exclude from active collection follow-up.',
      'الإحالة إلى إجراءات تسوية التركة والإرث؛ واستبعادها من متابعة التحصيل النشطة.',
      '转交遗产继承处理流程；从积极催收跟进中排除。'
    );
  }
  return pick(
    lang,
    'Route to manual review before approval — verify the amount against the Makin contract/pricing record before releasing.',
    'التوجيه للمراجعة اليدوية قبل الاعتماد — التحقق من المبلغ مقابل سجل العقد/التسعير في مكين قبل الصرف.',
    '批准前转交人工复核——放行前对照 Makin 合同/定价记录核实金额。'
  );
}

export default function Risk() {
  const { t, lang, isRtl } = useI18n();

  const flags = useMemo(() => computeAllRiskFlags(), []);

  // Group multiple flags for the same invoice into one card.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const f of flags) {
      if (!map.has(f.invoice.id)) map.set(f.invoice.id, { invoice: f.invoice, flags: [], score: 0 });
      const g = map.get(f.invoice.id);
      g.flags.push(f);
      g.score = Math.max(g.score, f.score);
    }
    return [...map.values()].sort((a, b) => b.score - a.score);
  }, [flags]);

  const categoryCounts = useMemo(() => {
    const counts = { duplicate: 0, struck_off_registry: 0, deceased_person: 0, value_anomaly: 0 };
    for (const f of flags) counts[f.category] += 1;
    return counts;
  }, [flags]);

  const totalFlaggedValue = useMemo(() => grouped.reduce((s, g) => s + g.invoice.amount, 0), [grouped]);

  const chartData = useMemo(() => ({
    labels: CATEGORY_ORDER.map((c) => categoryLabel(c, lang)),
    datasets: [{
      data: CATEGORY_ORDER.map((c) => categoryCounts[c]),
      backgroundColor: CATEGORY_ORDER.map((c) => CHART_COLOR[c]),
      borderRadius: 8
    }]
  }), [categoryCounts, lang]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { rtl: isRtl, backgroundColor: '#FFFFFF', titleColor: '#000000', bodyColor: '#323232', borderColor: '#EAEAEA', borderWidth: 1 }
    },
    scales: {
      x: { reverse: isRtl, ticks: { color: '#4A4A4A', font: { size: 10.5 } }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: '#4A4A4A', precision: 0 }, grid: { color: 'rgba(0,0,0,0.06)' } }
    }
  }), [isRtl]);

  const [openId, setOpenId] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | analyzing | done
  const [tick, setTick] = useState(0);

  const activeGroup = grouped.find((g) => g.invoice.id === openId) || null;

  const steps = useMemo(() => {
    if (!activeGroup) return [];
    const inv = activeGroup.invoice;
    const beneficiary = lang === 'zh' ? inv.entity : lang === 'ar' ? inv.entityAr : inv.entityEn;
    const amanah = lang === 'zh' ? inv.amanah : lang === 'ar' ? inv.amanahAr : inv.amanahEn;
    const intro = {
      title: pick(lang, 'Reading invoice record', 'قراءة سجل الفاتورة', '读取发票记录'),
      detail: pick(
        lang,
        `${inv.id} — ${beneficiary}, ${amanah}, ${fmtMoney(inv.amount)} SAR (${inv.date}).`,
        `${inv.id} — ${beneficiary}، ${amanah}، ${fmtMoney(inv.amount)} ريال (${inv.date}).`,
        `${inv.id} — ${beneficiary}，${amanah}，${fmtMoney(inv.amount)} 里亚尔（${inv.date}）。`
      )
    };
    const ruleSteps = activeGroup.flags.map((f) => evidenceStep(f, lang));
    const conclusion = {
      title: pick(lang, 'Conclusion & recommended action', 'الخلاصة والإجراء الموصى به', '结论与建议措施'),
      detail: activeGroup.flags.map((f) => actionTextFor(f, lang)).join(' ')
    };
    return [intro, ...ruleSteps, conclusion];
  }, [activeGroup, lang]);

  useEffect(() => {
    if (phase !== 'analyzing') return undefined;
    const totalTicks = steps.length * 2;
    if (tick >= totalTicks) {
      const id = window.setTimeout(() => setPhase('done'), 300);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setTick((n) => n + 1), 550);
    return () => window.clearTimeout(id);
  }, [phase, tick, steps.length]);

  const activeStepIndex = Math.min(Math.floor(tick / 2), steps.length - 1);
  const activeRevealed = tick % 2 === 1;

  function openAnalysis(id) {
    setOpenId(id);
    setTick(0);
    setPhase('analyzing');
  }
  function closeAnalysis() {
    setOpenId(null);
    setPhase('idle');
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('risk')}</div>
          <div className="page-sub">
            {pick(lang, 'Four MoMAH-confirmed risk categories, detected live from the invoice data — not a fixed list.', 'أربع فئات مخاطر مؤكدة من الوزارة، تُكتشف مباشرةً من بيانات الفواتير — وليست قائمة ثابتة.', '四类经部委确认的风险，直接从发票数据中实时检测——并非固定清单。')}
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        {CATEGORY_ORDER.map((c) => (
          <div className="card card-pad" key={c}>
            <div className="kpi__value">{categoryCounts[c]}</div>
            <div className="kpi__label">{categoryLabel(c, lang)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <div className="card chart-box" style={{ height: 320 }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div>
              <div className="page-title" style={{ fontSize: 16 }}>
                {pick(lang, 'Flags by Category', 'الأعلام حسب الفئة', '按类别统计的风险')}
              </div>
              <div className="page-sub">
                {pick(lang, `${grouped.length} invoices flagged · ${fmtMoney(totalFlaggedValue)} SAR at risk`, `${grouped.length} فاتورة موسومة · ${fmtMoney(totalFlaggedValue)} ريال معرَّض للخطر`, `已标记 ${grouped.length} 张发票 · 涉及金额 ${fmtMoney(totalFlaggedValue)} 里亚尔`)}
              </div>
            </div>
          </div>
          <div style={{ height: 240 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="card card-pad">
          <div className="page-title" style={{ fontSize: 16 }}>
            {pick(lang, 'Flagged Invoices', 'الفواتير الموسومة', '已标记发票')}
          </div>
          <div className="page-sub">
            {pick(lang, 'Ranked by severity · click "AI Analysis" for the evidence behind each flag', 'مرتبة حسب الخطورة · اضغط "تحليل الذكاء الاصطناعي" لعرض الأدلة وراء كل علم', '按严重程度排序 · 点击"AI 分析"查看每个标记背后的证据')}
          </div>
          <div className="hr" />
          <div style={{ display: 'grid', gap: 12 }}>
            {grouped.map((g) => {
              const inv = g.invoice;
              const beneficiary = lang === 'zh' ? inv.entity : lang === 'ar' ? inv.entityAr : inv.entityEn;
              const isOpen = openId === inv.id;
              return (
                <div className="card" style={{ padding: 12, background: 'rgba(255,255,255,0.03)' }} key={inv.id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 950 }} dir="ltr">{inv.id}</div>
                      <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{beneficiary}</div>
                    </div>
                    <span className={`badge ${badgeClass(g.flags[0] ? CATEGORY_COLOR[g.flags[0].category] : 'red')}`}>{g.score}</span>
                  </div>

                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {g.flags.map((f) => (
                      <span key={f.category} className={`badge ${badgeClass(CATEGORY_COLOR[f.category])}`}>
                        {categoryLabel(f.category, lang)}
                      </span>
                    ))}
                    <span className="badge" dir="ltr">{fmtMoney(inv.amount)} SAR</span>
                  </div>

                  {!isOpen && (
                    <div style={{ marginTop: 12 }}>
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openAnalysis(inv.id)}>
                        {pick(lang, 'AI Analysis', 'تحليل الذكاء الاصطناعي', 'AI 分析')}
                      </button>
                    </div>
                  )}

                  {isOpen && phase === 'analyzing' && (
                    <div className="ai-timeline" style={{ marginTop: 12 }}>
                      {steps.slice(0, activeStepIndex + 1).map((step, i) => {
                        const isActive = i === activeStepIndex;
                        const revealed = !isActive || activeRevealed;
                        let cls = 'ai-step';
                        cls += isActive ? (revealed ? ' ai-step--done' : ' ai-step--running') : ' ai-step--done';
                        return (
                          <div className={cls} key={i}>
                            <div className="ai-step__tag">{i + 1}</div>
                            <div className="ai-step__title">{step.title}</div>
                            <div className="ai-step__detail">{revealed ? <span>{step.detail}</span> : <AgentThinking />}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isOpen && phase === 'done' && (
                    <div className="ai-conclusion" style={{ marginTop: 12 }}>
                      <div className="ai-conclusion__label">{t('ai_conclusion')}</div>
                      <div className="ai-conclusion__text" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.7 }}>
                        {steps.map((s) => s.detail).join(' ')}
                      </div>
                      <div className="ai-conclusion__action">
                        <button className="btn btn-ghost btn-sm" type="button" onClick={closeAnalysis}>
                          {pick(lang, 'Close', 'إغلاق', '关闭')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
