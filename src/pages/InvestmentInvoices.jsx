import React, { useMemo, useState } from 'react';
import { useRevenue } from '../context/RevenueContext';
import { useAsync } from '../utils/useAsync';
import { useL } from '../utils/bi';
import Pager from '../components/Pager';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';

const pick = (lang, en, ar, zh) => (lang === 'ar' ? ar : lang === 'zh' ? zh : en);

// Dedicated page for investment (Foras) invoices with no linked Furas
// contract — moved out of the Dashboard's compact card so each one can get
// its own AI risk analysis instead of just a plain amount/beneficiary line.
export default function InvestmentInvoices() {
  const { t, lang, isRtl } = useI18n();
  const nav = useNavigate();

  const rev = useRevenue();
  const { sar, count } = useL();
  const [page, setPage] = useState(0);
  const PS = 20;
  // investment invoices whose contract is not matched / not linked, and the linked ones: counts and pages come from the data service
  const scopeAll = useMemo(() => ({ amanah: rev.scopeEff.amanah, source: 'investment', from: '2000-01-01', to: rev.cfg.cutoff }), [rev.scopeEff.amanah, rev.cfg.cutoff]);
  const { data: fl } = useAsync(() => rev.data.list(scopeAll, { filters: { contract: 'issue', allPeriods: true }, page, pageSize: PS, sort: { key: 'gross', dir: 'desc' } }), [rev.data, scopeAll, page]);
  const { data: lk } = useAsync(() => rev.data.list(scopeAll, { filters: { contract: 'linked', allPeriods: true }, page: 0, pageSize: 1 }), [rev.data, scopeAll]);
  const flagged = fl?.rows || [];
  const flaggedTotal = fl?.total ?? 0;
  const linked = lk?.total ?? 0;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{pick(lang, 'Investment Contract Linkage', 'ربط العقود الاستثمارية', '投资合同关联')}</h1>
          <div className="page-sub">{pick(lang, 'Investment invoices with no linked Furas contract, each with an AI risk assessment', 'الفواتير الاستثمارية غير المرتبطة بعقد فرص، مع تقييم مخاطر بالذكاء الاصطناعي لكل فاتورة', '未关联 Furas 合同的投资类发票，每张均附带 AI 风险评估')}</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/insights')}>
          {isRtl ? `${pick(lang, 'Back to Dashboard', 'العودة إلى لوحة التحكم', '返回控制台')} ←` : `${pick(lang, 'Back to Dashboard', 'العودة إلى لوحة التحكم', '返回控制台')} →`}
        </button>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr">{count(linked)}</div>
          <div className="kpi__label">{t('dash_invest_ok')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" style={{ color: flaggedTotal ? 'var(--red)' : undefined }} dir="ltr">{count(flaggedTotal)}</div>
          <div className="kpi__label">{t('dash_invest_flagged')}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 16, marginBottom: 4 }}>
          {pick(lang, 'Flagged Investment Invoices', 'الفواتير الاستثمارية الموسومة', '已标记的投资类发票')}
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          {pick(lang, 'Each record has no matching contract in the Furas registry.', 'كل سجل لا يملك عقدًا مطابقًا في سجل فرص.', '每条记录在 Furas 合同登记中均无匹配合同。')}
        </div>
        <div className="grid" style={{ gap: 8 }}>
          {flagged.map((inv) => {
            const beneficiary = lang === 'ar' ? inv.payerAr : inv.payerEn;
            const amanah = lang === 'zh' ? inv.amanahZh : lang === 'ar' ? inv.amanahAr : inv.amanahEn;
            return (
              <div key={inv.id} className="card" style={{ padding: 10, background: 'rgba(180, 35, 24, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 12 }} dir="ltr">{inv.id}</span>
                    <span className="badge badge--red" dir="ltr">{sar(inv.gross)}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{beneficiary} · {amanah}</div>
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => nav(`/investment-invoices/${encodeURIComponent(inv.id)}`)}>
                  {pick(lang, 'Details', 'التفاصيل', '详情')}
                </button>
              </div>
            );
          })}
          <Pager page={page} total={flaggedTotal} size={PS} onPage={setPage} />
          {!flagged.length && (
            <div className="muted" style={{ fontSize: 13 }}>
              {pick(lang, 'No unlinked investment invoices under the current data.', 'لا توجد فواتير استثمارية غير مرتبطة ضمن البيانات الحالية.', '当前数据中没有未关联的投资类发票。')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
