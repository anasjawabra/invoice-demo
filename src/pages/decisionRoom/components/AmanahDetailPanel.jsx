import React from 'react';

// Executive-summary side panel for whichever Amanah is selected on the map
// — every figure here is already computed by cfoModel.computeCFOModel's
// `perAmanah` (a real-share apportionment of the scope-wide totals), this
// component only lays it out.
export default function AmanahDetailPanel({ amanah, money, t }) {
  if (!amanah) {
    return <p className="muted" style={{ fontSize: 12.5 }}>{t('cfo_amanah_sub')}</p>;
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="badge badge--indigo">{t('cfo_amanah_badge')}</span>
        <span style={{ fontWeight: 800 }}>{amanah.en}</span>
      </div>
      <div className="grid grid-2" style={{ gap: 8 }}>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 16 }}>{money(amanah.gross)}</div>
          <div className="kpi__label">{t('dash_kpi_net_invoiced')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 16 }}>{amanah.rate}%</div>
          <div className="kpi__label">{t('cfo_kpi_collection_rate')}</div>
        </div>
      </div>

      <div className="page-title" style={{ fontSize: 13, marginTop: 14 }}>{t('cfo_budget_headroom_title')}</div>
      <div className="grid grid-2" style={{ gap: 8, marginTop: 6 }}>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 15 }}>{money(amanah.spent || 0)}</div>
          <div className="kpi__label">{t('cfo_budget_spent')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 15 }}>{money(amanah.committed || 0)}</div>
          <div className="kpi__label">{t('cfo_budget_committed')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 15 }}>{money(amanah.available || 0)}</div>
          <div className="kpi__label">{t('cfo_budget_available')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr" style={{ fontSize: 15 }}>{amanah.opexCoverage == null ? '—' : `${amanah.opexCoverage}%`}</div>
          <div className="kpi__label">{t('cfo_kpi_coverage')}</div>
        </div>
      </div>
    </div>
  );
}
