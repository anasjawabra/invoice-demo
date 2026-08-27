import React, { useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../components/Toast';
import { fmtMoney, ORGS, PLATFORM_RECON, RECON_DIFF_TYPES } from '../data/mock';
import { XRECON_ANALYSIS } from '../data/aiProcess';
import AIProcessDrawer from '../components/ai/AIProcessDrawer';
import { exportCSV } from '../utils/export';

function badgeForTypeColor(c) {
  switch (c) {
    case 'orange':
      return 'badge--orange';
    case 'blue':
      return 'badge--blue';
    case 'indigo':
      return 'badge--indigo';
    case 'gold':
      return 'badge--gold';
    default:
      return '';
  }
}

/* Rows without a dedicated trace fall back to the trace of the same type. */
const FALLBACK_TRACE = { amount: 'INV-2026-0731', status: 'INV-2026-0728', missingTahsil: 'INV-2026-0726', missingMakken: 'INV-2026-0726' };

export default function Recon() {
  const { t, lang, T } = useI18n();
  const toast = useToast();

  const [items, setItems] = useState(PLATFORM_RECON);
  const [typeFilter, setTypeFilter] = useState('all');
  const [sent, setSent] = useState({});
  const [drawer, setDrawer] = useState(null);

  const stats = useMemo(() => {
    const total = items.length;
    const value = items.reduce((s, r) => s + r.diff, 0);
    const high = items.filter((r) => r.high).length;
    return { total, value, high };
  }, [items]);

  const filtered = useMemo(() => (
    items.filter((r) => typeFilter === 'all' || r.type === typeFilter)
  ), [items, typeFilter]);

  function openTrace(row) {
    setDrawer(XRECON_ANALYSIS[row.id] || XRECON_ANALYSIS[FALLBACK_TRACE[row.type]]);
  }

  function orgName(orgId) {
    const o = ORGS.find((x) => x.id === orgId);
    return o ? T(o, 'name') : orgId;
  }

  function typeLabel(k) {
    const d = RECON_DIFF_TYPES[k];
    return lang === 'zh' ? d.label : lang === 'ar' ? d.labelAr : d.labelEn;
  }

  function doExport() {
    exportCSV('makeen-tahsil-reconciliation', filtered.map((r) => ({
      invoice: r.id,
      vendor: lang === 'zh' ? r.vendor : lang === 'ar' ? r.vendorAr : r.vendorEn,
      type: typeLabel(r.type),
      makken: r.makkenAmt ?? '',
      tahsil: r.tahsilAmt ?? '',
      diff: r.diff,
      reason: lang === 'zh' ? r.reason : lang === 'ar' ? r.reasonAr : r.reasonEn,
      action: lang === 'zh' ? r.action : lang === 'ar' ? r.actionAr : r.actionEn
    })));
    toast.success(`${t('toast_export')}makeen-tahsil-reconciliation.csv`);
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('recon')}</div>
          <div className="page-sub">{t('recon_sub')}</div>
        </div>
        <span className="badge badge--teal">{t('rcn_auth')}</span>
        <span className="badge badge--indigo" title={t('persona_main')}>{t('persona_recon')}</span>
      </div>

      <div className="grid grid-4">
        <div className="card card-pad">
          <div className="kpi__value">{stats.total}</div>
          <div className="kpi__label">{t('rcn_kpi_total')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr">{fmtMoney(stats.value)}</div>
          <div className="kpi__label">{t('rcn_kpi_value')} (SAR)</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.high}</div>
          <div className="kpi__label">{t('rcn_kpi_high')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" dir="ltr">SUN 08:00</div>
          <div className="kpi__label">{t('updated_daily')}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          {['all', ...Object.keys(RECON_DIFF_TYPES)].map((k) => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${typeFilter === k ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTypeFilter(k)}
            >
              {k === 'all' ? t('rcn_filter_all') : typeLabel(k)}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={doExport}>
            {t('rcn_export')}
          </button>
        </div>

        <div className="table-wrap">
          <table className="table" aria-label="Platform reconciliation">
            <thead>
              <tr>
                <th>{t('th_id')}</th>
                <th>{t('th_vendor')}</th>
                <th>{t('org_label')}</th>
                <th>{t('th_makken')}</th>
                <th>{t('th_tahsil')}</th>
                <th>{t('th_diff')}</th>
                <th>{t('th_type')}</th>
                <th>{t('th_action')}</th>
                <th aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const td = RECON_DIFF_TYPES[r.type];
                const isSent = !!sent[r.id];
                return (
                  <tr key={r.id} style={r.high ? { background: 'rgba(175, 8, 24, 0.04)' } : undefined}>
                    <td style={{ fontWeight: 900 }} dir="ltr">{r.id}</td>
                    <td>{T(r, 'vendor')}</td>
                    <td>{orgName(r.orgId)}</td>
                    <td dir="ltr">{r.makkenAmt == null ? '—' : `${fmtMoney(r.makkenAmt)}`}</td>
                    <td dir="ltr">{r.tahsilAmt == null ? '—' : `${fmtMoney(r.tahsilAmt)}`}</td>
                    <td dir="ltr" style={{ color: r.high ? 'var(--red, #AF0818)' : undefined, fontWeight: 800 }}>
                      {fmtMoney(r.diff)}
                    </td>
                    <td>
                      <span className={`badge ${badgeForTypeColor(td.color)}`}>{typeLabel(r.type)}</span>
                      {r.high ? <span className="badge badge--red" style={{ marginInlineStart: 4 }}>&gt;50K</span> : null}
                    </td>
                    <td style={{ fontSize: 12 }}>{lang === 'zh' ? r.action : lang === 'ar' ? r.actionAr : r.actionEn}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => openTrace(r)}>
                          {t('ai_process_btn')}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          disabled={isSent}
                          onClick={() => {
                            setSent((prev) => ({ ...prev, [r.id]: true }));
                            toast.info(`${t('rcn_sent')}${r.id}`);
                          }}
                        >
                          {isSent ? '✓' : ''}
                          {t('rcn_send_audit')}
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          onClick={() => {
                            setItems((prev) => prev.filter((x) => x.id !== r.id));
                            toast.success(`${t('rcn_approved')}${r.id}`);
                          }}
                        >
                          {t('rcn_approve')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <div className="card card-pad"><div style={{ fontWeight: 900 }}>{t('ad_empty')}</div></div>
        ) : null}
      </div>

      <AIProcessDrawer open={!!drawer} onClose={() => setDrawer(null)} data={drawer} />
    </div>
  );
}
