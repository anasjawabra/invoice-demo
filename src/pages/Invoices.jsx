import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { fmtMoney, INVOICES, STATUS } from '../data/mock';
import { APPROVAL_BASIS, NODE_DRAWERS, RISK_ANALYSIS } from '../data/aiProcess';
import { L } from '../components/ai/util';
import InvoiceDetailDrawer from '../components/ai/InvoiceDetailDrawer';
import AIProcessDrawer from '../components/ai/AIProcessDrawer';

function badgeForStatusColor(c) {
  switch (c) {
    case 'green':
      return 'badge--green';
    case 'red':
      return 'badge--red';
    case 'orange':
      return 'badge--orange';
    case 'gold':
      return 'badge--gold';
    case 'blue':
      return 'badge--blue';
    case 'indigo':
      return 'badge--indigo';
    case 'purple':
      return 'badge--purple';
    default:
      return '';
  }
}

// Which agent node best represents each scenario's "full AI analysis".
const PRIMARY_AGENT = { normal: 'validation', fraud: 'anomaly', dup: 'dedup', taxfail: 'compliance' };

// Map an invoice to the same aiProcess bundle the Risk/Approvals/Pipeline pages
// use: prefer a per-invoice bundle, else fall back to the scenario's key node.
function aiBundleForInvoice(inv) {
  if (RISK_ANALYSIS[inv.id]) return RISK_ANALYSIS[inv.id];
  if (APPROVAL_BASIS[inv.id]) return APPROVAL_BASIS[inv.id];
  const scenario = inv.tag || 'normal';
  const nodes = NODE_DRAWERS[scenario] || NODE_DRAWERS.normal;
  const agent = PRIMARY_AGENT[scenario] || 'validation';
  return nodes[agent] || nodes.ingest || nodes.validation || null;
}

export default function Invoices() {
  const { t, lang, T } = useI18n();
  const { user } = useAuth();
  const scale = user?.org?.scale ?? 1;
  const [searchParams] = useSearchParams();
  const highlightCo = searchParams.get('co');

  const [detail, setDetail] = useState(null); // invoice shown in the detail drawer
  const [aiDrawer, setAiDrawer] = useState(null); // aiProcess bundle (stacked on top)
  const triggerRef = useRef(null); // row that opened the detail (for focus return)

  // Deep-linked from a Dashboard alert (?co=CO-xxxxx) — jump straight to that contract's invoice.
  useEffect(() => {
    if (!highlightCo) return;
    const match = INVOICES.find((inv) => inv.co === highlightCo);
    if (match) setDetail(match);
  }, [highlightCo]);

  const openDetail = useCallback((inv, e) => {
    triggerRef.current = e.currentTarget;
    setDetail(inv);
  }, []);

  const closeDetail = useCallback(() => {
    setDetail(null);
    setAiDrawer(null);
    // Return focus to the row that opened the drawer.
    triggerRef.current?.focus?.();
  }, []);

  const openAi = useCallback(() => {
    if (detail) setAiDrawer(aiBundleForInvoice(detail));
  }, [detail]);

  const onRowKey = useCallback((inv, e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      openDetail(inv, e);
    }
  }, [openDetail]);

  const stats = useMemo(() => {
    const total = INVOICES.length;
    const approved = INVOICES.filter((i) => i.status === 'approved').length;
    const pending = INVOICES.filter((i) => i.status === 'pending').length;
    const review = INVOICES.filter((i) => i.status === 'review').length;
    const anomaly = INVOICES.filter((i) => i.status === 'anomaly' || i.status === 'duplicate').length;
    return { total, approved, pending, review, anomaly };
  }, []);

  const viewLabel = L({ zh: '查看详情', en: 'View details', ar: 'عرض التفاصيل' }, lang);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('invoices')}</div>
          <div className="page-sub">{t('recent_sub')}</div>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card card-pad">
          <div className="kpi__value">{stats.total}</div>
          <div className="kpi__label">{t('inv_total')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.approved}</div>
          <div className="kpi__label">{t('kpi_achieved')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.pending}</div>
          <div className="kpi__label">{t('th_status')}: {lang === 'zh' ? STATUS.pending.label : lang === 'ar' ? STATUS.pending.labelAr : STATUS.pending.labelEn}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.review + stats.anomaly}</div>
          <div className="kpi__label">{t('hitl_banner')}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="table-wrap">
          <table className="table" aria-label="Invoice library">
            <thead>
              <tr>
                <th>{t('th_id')}</th>
                <th>{t('th_vendor')}</th>
                <th>{t('th_amount')}</th>
                <th>{t('th_source')}</th>
                <th>{t('th_paytype')}</th>
                <th>{t('th_status')}</th>
                <th>{t('th_po')}</th>
                <th>{t('th_date')}</th>
                <th>{t('info_risk')}</th>
                <th aria-label={viewLabel} />
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((inv) => {
                const stx = STATUS[inv.status];
                const stLabel = lang === 'zh' ? stx?.label : lang === 'ar' ? stx?.labelAr : stx?.labelEn;
                const badge = badgeForStatusColor(stx?.color);
                return (
                  <tr
                    key={inv.id}
                    className="row-clickable"
                    tabIndex={0}
                    role="button"
                    aria-label={`${viewLabel} · ${inv.id}`}
                    onClick={(e) => openDetail(inv, e)}
                    onKeyDown={(e) => onRowKey(inv, e)}
                    style={highlightCo && inv.co === highlightCo ? { background: 'rgba(0, 128, 255, 0.08)' } : undefined}
                  >
                    <td style={{ fontWeight: 900 }} dir="ltr">{inv.id}</td>
                    <td>{T(inv, 'entity')}</td>
                    <td dir="ltr">{fmtMoney(Math.round(inv.amount * scale))} {inv.currency}</td>
                    <td>{inv.source}</td>
                    <td>
                      <span className={`badge ${inv.payType === 'prepaid' ? 'badge--teal' : 'badge--indigo'}`}>
                        {inv.payType === 'prepaid' ? t('paytype_prepaid') : t('paytype_deferred')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${badge}`}>{stLabel}</span>
                    </td>
                    <td dir="ltr">{inv.co}</td>
                    <td dir="ltr">{inv.date}</td>
                    <td>
                      <span className={`badge ${inv.risk >= 60 ? 'badge--red' : inv.risk >= 40 ? 'badge--orange' : 'badge--green'}`}>{inv.risk}</span>
                    </td>
                    <td className="row-view">
                      <span className="row-view__link">{viewLabel}<span className="row-view__chev" aria-hidden="true">›</span></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <InvoiceDetailDrawer
        inv={detail}
        open={!!detail}
        onClose={closeDetail}
        onOpenAI={openAi}
        suppressClose={!!aiDrawer}
      />
      <AIProcessDrawer open={!!aiDrawer} onClose={() => setAiDrawer(null)} data={aiDrawer} />
    </div>
  );
}
