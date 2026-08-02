import React, { useMemo } from 'react';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { fmtMoney, INVOICES, STATUS } from '../data/mock';

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

export default function Invoices() {
  const { t, lang, T } = useI18n();
  const { user } = useAuth();
  const scale = user?.org?.scale ?? 1;

  const stats = useMemo(() => {
    const total = INVOICES.length;
    const approved = INVOICES.filter((i) => i.status === 'approved').length;
    const pending = INVOICES.filter((i) => i.status === 'pending').length;
    const review = INVOICES.filter((i) => i.status === 'review').length;
    const anomaly = INVOICES.filter((i) => i.status === 'anomaly' || i.status === 'duplicate').length;
    return { total, approved, pending, review, anomaly };
  }, []);

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
                <th>{t('th_status')}</th>
                <th>{t('th_po')}</th>
                <th>{t('th_date')}</th>
                <th>{t('info_risk')}</th>
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((inv) => {
                const st = STATUS[inv.status];
                const stLabel = lang === 'zh' ? st?.label : lang === 'ar' ? st?.labelAr : st?.labelEn;
                const badge = badgeForStatusColor(st?.color);
                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 900 }}>{inv.id}</td>
                    <td>{T(inv, 'entity')}</td>
                    <td>{fmtMoney(Math.round(inv.amount * scale))} {inv.currency}</td>
                    <td>{inv.source}</td>
                    <td>
                      <span className={`badge ${badge}`}>{stLabel}</span>
                    </td>
                    <td>{inv.po}</td>
                    <td>{inv.date}</td>
                    <td>
                      <span className={`badge ${inv.risk >= 60 ? 'badge--red' : inv.risk >= 40 ? 'badge--orange' : 'badge--green'}`}>{inv.risk}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
