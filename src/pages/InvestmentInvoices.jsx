import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { fmtMoney, INVOICES } from '../data/mock';

const pick = (lang, en, ar, zh) => (lang === 'ar' ? ar : lang === 'zh' ? zh : en);

// Dedicated page for investment (Foras) invoices with no linked Furas
// contract — moved out of the Dashboard's compact card so each one can get
// its own AI risk analysis instead of just a plain amount/beneficiary line.
export default function InvestmentInvoices() {
  const { t, lang, isRtl } = useI18n();
  const nav = useNavigate();

  const investmentInvoices = INVOICES.filter((i) => i.source === 'Foras');
  const flagged = investmentInvoices.filter((i) => i.hasContract === false);
  const linked = investmentInvoices.length - flagged.length;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{pick(lang, 'Investment Contract Linkage', 'ربط العقود الاستثمارية', '投资合同关联')}</div>
          <div className="page-sub">{pick(lang, 'Investment invoices with no linked Furas contract, each with an AI risk assessment', 'الفواتير الاستثمارية غير المرتبطة بعقد فرص، مع تقييم مخاطر بالذكاء الاصطناعي لكل فاتورة', '未关联 Furas 合同的投资类发票，每张均附带 AI 风险评估')}</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/dashboard')}>
          {isRtl ? `${pick(lang, 'Back to Dashboard', 'العودة إلى لوحة التحكم', '返回控制台')} ←` : `${pick(lang, 'Back to Dashboard', 'العودة إلى لوحة التحكم', '返回控制台')} →`}
        </button>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="kpi__value">{linked}</div>
          <div className="kpi__label">{t('dash_invest_ok')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" style={{ color: flagged.length ? 'var(--red)' : undefined }}>{flagged.length}</div>
          <div className="kpi__label">{t('dash_invest_flagged')}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 16, marginBottom: 4 }}>
          {pick(lang, 'Flagged Investment Invoices', 'الفواتير الاستثمارية الموسومة', '已标记的投资类发票')}
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 10 }}>
          {pick(lang, 'Each record has no matching contract in the Furas registry.', 'كل سجل لا يملك عقدًا مطابقًا في سجل فرص.', '每条记录在 Furas 合同登记中均无匹配合同。')}
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {flagged.map((inv) => {
            const beneficiary = lang === 'zh' ? inv.entity : lang === 'ar' ? inv.entityAr : inv.entityEn;
            const amanah = lang === 'zh' ? inv.amanah : lang === 'ar' ? inv.amanahAr : inv.amanahEn;
            return (
              <div key={inv.id} className="card" style={{ padding: 10, background: 'rgba(175, 8, 24, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 900, fontSize: 12 }} dir="ltr">{inv.id}</span>
                    <span className="badge badge--red">{fmtMoney(inv.amount)} SAR</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{beneficiary} · {amanah}</div>
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => nav(`/investment-invoices/${encodeURIComponent(inv.id)}`)}>
                  {pick(lang, 'Details', 'التفاصيل', '详情')}
                </button>
              </div>
            );
          })}
          {!flagged.length && (
            <div className="muted" style={{ fontSize: 12.5 }}>
              {pick(lang, 'No unlinked investment invoices under the current data.', 'لا توجد فواتير استثمارية غير مرتبطة ضمن البيانات الحالية.', '当前数据中没有未关联的投资类发票。')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
