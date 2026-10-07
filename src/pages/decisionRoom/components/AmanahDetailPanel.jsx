import React from 'react';

// Executive-summary side panel for whichever Amanah is selected on the map
// — every figure here is already computed by cfoModel.computeCFOModel's
// `perAmanah` (a real-share apportionment of the scope-wide totals), this
// component only lays it out.
export default function AmanahDetailPanel({ amanah, money, t, lang }) {
  if (!amanah) {
    return <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t('cfo_amanah_sub')}</p>;
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
        <span className="badge badge--indigo">{t('cfo_amanah_badge')}</span>
        <span style={{ fontWeight: 700 }}>{lang === 'ar' ? (amanah.nameAr || amanah.ar || amanah.en) : lang === 'zh' ? (amanah.name || amanah.zh || amanah.en) : (amanah.nameEn || amanah.en)}</span>
      </div>
      <div className="grid grid-2" style={{ gap: 'var(--spacing-md)' }}>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 'var(--text-md)' }}>{money(amanah.gross)}</div>
          <div className="kpi__label">{t('dash_kpi_net_invoiced')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 'var(--text-md)' }}>{amanah.rate}%</div>
          <div className="kpi__label">{t('cfo_kpi_collection_rate')}</div>
        </div>
      </div>

      <div className="page-title" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--spacing-lg)' }}>{t('cfo_budget_headroom_title')}</div>
      <div className="grid grid-2" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-xs)' }}>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 'var(--text-sm)' }}>{money(amanah.spent || 0)}</div>
          <div className="kpi__label">{t('cfo_budget_spent')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 'var(--text-sm)' }}>{money(amanah.committed || 0)}</div>
          <div className="kpi__label">{t('cfo_budget_committed')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 'var(--text-sm)' }}>{money(amanah.available || 0)}</div>
          <div className="kpi__label">{t('cfo_budget_available')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 'var(--text-sm)' }}>{amanah.opexCoverage == null ? '—' : `${amanah.opexCoverage}%`}</div>
          <div className="kpi__label">{t('cfo_kpi_coverage')}</div>
        </div>
      </div>
    </div>
  );
}
