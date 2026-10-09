import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useRevenue } from '../context/RevenueContext';
import { useAsync } from '../utils/useAsync';
import { legacyInvoiceFor } from '../utils/legacyInvoice';
import { fmtSar } from '../utils/money';
const fmtMoney = (n) => fmtSar(n).replace(/ SAR$/, '');
import AgentThinking from '../components/ai/AgentThinking';

const pick = (lang, en, ar, zh) => (lang === 'ar' ? ar : lang === 'zh' ? zh : en);

const ageInDays = (anchorToday, dateStr) => Math.max(0, Math.round((new Date(`${anchorToday}T00:00:00Z`) - new Date(`${dateStr}T00:00:00Z`)) / 86400000));

export default function InvestmentInvoiceDetail() {
  const { t, lang, isRtl } = useI18n();
  const nav = useNavigate();
  const { id } = useParams();
  const rev = useRevenue();
  // one record, loaded on demand
  const { data: det, loading: detLoading } = useAsync(() => rev.data.invoice(id).catch(() => null), [rev.data, id]);
  const inv = det?.rec ? legacyInvoiceFor(det.rec) : null;

  const [phase, setPhase] = useState('analyzing'); // analyzing | done — runs automatically, no file to attach
  const [tick, setTick] = useState(0);

  const age = inv ? ageInDays(rev.cfg.cutoff, inv.date) : 0;
  const beneficiary = inv ? (lang === 'zh' ? inv.entity : lang === 'ar' ? inv.entityAr : inv.entityEn) : '';
  const amanah = inv ? (lang === 'zh' ? inv.amanah : lang === 'ar' ? inv.amanahAr : inv.amanahEn) : '';

  const steps = useMemo(() => {
    if (!inv) return [];
    return [
      {
        title: pick(lang, 'Reading invoice record', 'قراءة سجل الفاتورة', '读取发票记录'),
        detail: pick(
          lang,
          `${inv.id} — ${beneficiary}, ${amanah}, ${fmtMoney(inv.amount)} SAR (${inv.date}).`,
          `${inv.id} — ${beneficiary}، ${amanah}، ${fmtMoney(inv.amount)} ريال (${inv.date}).`,
          `${inv.id} — ${beneficiary}，${amanah}，${fmtMoney(inv.amount)} 里亚尔（${inv.date}）。`
        )
      },
      {
        title: pick(lang, 'Checking the Furas contract registry', 'التحقق من سجل عقود فرص', '核查 Furas 合同登记'),
        detail: pick(
          lang,
          `No Furas contract record matches this invoice’s contract order reference (${inv.co}) — the investment invoice has no linked contract.`,
          `لا يوجد عقد في سجل فرص يطابق مرجع أمر التعاقد لهذه الفاتورة (${inv.co}) — الفاتورة الاستثمارية بلا عقد مرتبط.`,
          `Furas 合同登记中没有与该发票的合同订单参考号（${inv.co}）匹配的合同——该投资类发票没有关联合同。`
        )
      },
      {
        title: pick(lang, 'Assessing audit exposure', 'تقييم التعرّض الرقابي', '评估审计风险敞口'),
        detail: pick(
          lang,
          `This invoice has been unlinked for ${age} day(s) since issuance${age >= 60 ? ' — past the 60-day threshold this demo treats as elevated audit exposure' : ' — within the normal reconciliation window'}.`,
          `هذه الفاتورة بلا ربط منذ ${age} يومًا من تاريخ إصدارها${age >= 60 ? ' — تجاوزت حد الـ60 يومًا الذي يعتبره هذا العرض تعرّضًا رقابيًا مرتفعًا' : ' — ضمن نافذة التسوية الاعتيادية'}.`,
          `该发票自开具以来已 ${age} 天未关联合同${age >= 60 ? '——已超过本演示视为审计风险升高的60天阈值' : '——仍在正常对账周期内'}。`
        )
      },
      {
        title: pick(lang, 'Conclusion & recommendation', 'الخلاصة والتوصية', '结论与建议'),
        detail: age >= 60
          ? pick(
              lang,
              'Recommend escalating to the audit committee and requiring the beneficiary to submit a valid Furas contract before releasing any further payment.',
              'يوصى بالتصعيد إلى لجنة التدقيق وإلزام الجهة المستفيدة بتقديم عقد فرص صالح قبل صرف أي دفعة إضافية.',
              '建议上报审计委员会，并要求受益方在放行后续付款前提交有效的 Furas 合同。'
            )
          : pick(
              lang,
              'Recommend requiring the beneficiary to submit a valid Furas contract before the next payment cycle; re-check before escalating.',
              'يوصى بإلزام الجهة المستفيدة بتقديم عقد فرص صالح قبل دورة الدفع القادمة، مع إعادة التحقق قبل التصعيد.',
              '建议要求受益方在下一付款周期前提交有效的 Furas 合同；升级前再次核实。'
            )
      }
    ];
  }, [inv, lang, age, beneficiary, amanah]);

  useEffect(() => {
    if (phase !== 'analyzing') return undefined;
    const totalTicks = steps.length * 2;
    if (tick >= totalTicks) {
      const timer = window.setTimeout(() => setPhase('done'), 300);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setTick((n) => n + 1), 550);
    return () => window.clearTimeout(timer);
  }, [phase, tick, steps.length]);

  const activeStepIndex = Math.min(Math.floor(tick / 2), steps.length - 1);
  const activeRevealed = tick % 2 === 1;

  if (!inv) {
    return (
      <div className="grid" style={{ gap: 14 }}>
        <div className="page-head">
          <h1 className="page-title">{detLoading ? pick(lang, 'Loading…', 'جارٍ التحميل…', '加载中…') : pick(lang, 'Record not found', 'لم يتم العثور على هذا السجل', '未找到该记录')}</h1>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/investment-invoices')}>
          {isRtl ? `${pick(lang, 'Back to list', 'العودة إلى القائمة', '返回列表')} ←` : `${pick(lang, 'Back to list', 'العودة إلى القائمة', '返回列表')} →`}
        </button>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title" dir="ltr">{inv.id}</h1>
          <div className="page-sub">{pick(lang, 'Investment contract-linkage detail', 'تفاصيل ربط العقد الاستثماري', '投资合同关联详情')}</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/investment-invoices')}>
          {isRtl ? `${pick(lang, 'Back to list', 'العودة إلى القائمة', '返回列表')} ←` : `${pick(lang, 'Back to list', 'العودة إلى القائمة', '返回列表')} →`}
        </button>
      </div>

      <div className="card card-pad">
        <div className="idd-grid">
          <div className="idd-cell">
            <span className="idd-cell__k">{t('sanad_order_amount')}</span>
            <span className="idd-cell__v" dir="ltr">{fmtMoney(inv.amount)} SAR</span>
          </div>
          <div className="idd-cell">
            <span className="idd-cell__k">{t('th_amanah')}</span>
            <span className="idd-cell__v">{amanah}</span>
          </div>
          <div className="idd-cell">
            <span className="idd-cell__k">{t('th_beneficiary')}</span>
            <span className="idd-cell__v">{beneficiary}</span>
          </div>
          <div className="idd-cell">
            <span className="idd-cell__k">{t('th_date')}</span>
            <span className="idd-cell__v" dir="ltr">{inv.date}</span>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="page-title" style={{ fontSize: 16 }}>{pick(lang, 'AI Risk Analysis', 'تحليل المخاطر بالذكاء الاصطناعي', 'AI 风险分析')}</h2>
        <div className="page-sub">{pick(lang, 'Runs automatically for every unlinked investment invoice', 'يعمل تلقائيًا لكل فاتورة استثمارية غير مرتبطة', '对每张未关联的投资类发票自动运行')}</div>
        <div className="hr" />

        {phase === 'analyzing' && (
          <div className="ai-timeline">
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

        {phase === 'done' && (
          <div className="ai-conclusion">
            <div className="ai-conclusion__label">{t('ai_conclusion')}</div>
            <div className="ai-conclusion__text" style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.7 }}>
              {steps.map((s) => s.detail).join(' ')}
            </div>
            <div className="ai-conclusion__action" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/investment-invoices')}>
                {pick(lang, 'Back to list', 'العودة إلى القائمة', '返回列表')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
