import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { fmtMoney, SANAD_ENFORCEMENT } from '../data/mock';

const PAGE_SIZE = 5;

// Dedicated page for the enforcement orders that still need a document
// attached and OCR-scanned to find a linked invoice number — moved out of
// the Dashboard's Sanad snapshot card so the list has room to grow into its
// own worklist instead of living inline in a summary widget.
export default function SanadOrders() {
  const { t, lang, isRtl } = useI18n();
  const nav = useNavigate();
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(SANAD_ENFORCEMENT.sample.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => SANAD_ENFORCEMENT.sample.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [page]
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('sanad_orders_title')}</div>
          <div className="page-sub">{t('sanad_orders_sub')}</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => nav('/dashboard')}>
          {isRtl ? `${t('back_to_dashboard')} ←` : `${t('back_to_dashboard')} →`}
        </button>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div className="kpi__value">{fmtMoney(SANAD_ENFORCEMENT.recordsReviewed)}</div>
            <div className="kpi__label">{t('dash_sanad_stat_reviewed')}</div>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div className="kpi__value" style={{ color: 'var(--red)' }}>{SANAD_ENFORCEMENT.missingInvoicePct}%</div>
            <div className="kpi__label">{t('dash_sanad_stat_missing')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div className="kpi__value">{fmtMoney(SANAD_ENFORCEMENT.ordersIssued)}</div>
            <div className="kpi__label">{t('dash_sanad_stat_orders')}</div>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div className="kpi__value" style={{ color: 'var(--red)' }}>
              {fmtMoney(SANAD_ENFORCEMENT.ordersUnlinked)}<span style={{ fontSize: 13, fontWeight: 700 }}> / {fmtMoney(SANAD_ENFORCEMENT.ordersIssued)}</span>
            </div>
            <div className="kpi__label">{t('dash_sanad_stat_unlinked')}</div>
          </div>
        </div>
        <div className="muted" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>{t('dash_sanad_note_orders')}</div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 16, marginBottom: 4 }}>{t('dash_sanad_sample_title')}</div>
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 10 }}>{t('sanad_orders_list_sub')}</div>
        <div className="grid" style={{ gap: 8 }}>
          {pageItems.map((s) => {
            const amanah = lang === 'zh' ? s.amanah : lang === 'ar' ? s.amanahAr : s.amanahEn;
            const defendant = lang === 'zh' ? s.defendant.zh : lang === 'ar' ? s.defendant.ar : s.defendant.en;
            return (
              <div key={s.enforceNum} className="card" style={{ padding: 10, background: 'rgba(175, 8, 24, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 900, fontSize: 12 }} dir="ltr">{s.enforceNum}</span>
                    <span className="badge badge--red">{fmtMoney(s.amount)} SAR</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{amanah} · {defendant}</div>
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => nav(`/sanad-orders/${encodeURIComponent(s.enforceNum)}`)}>
                  {t('sanad_order_details_btn')}
                </button>
              </div>
            );
          })}
        </div>

        {pageCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-sm btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              {isRtl ? `→ ${t('pagination_prev')}` : `← ${t('pagination_prev')}`}
            </button>
            <span className="muted" style={{ fontSize: 12 }} dir="ltr">{page + 1} / {pageCount}</span>
            <button type="button" className="btn btn-sm btn-ghost" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
              {isRtl ? `${t('pagination_next')} ←` : `${t('pagination_next')} →`}
            </button>
          </div>
        )}

        <div className="muted" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>{t('dash_sanad_note')}</div>
      </div>
    </div>
  );
}
