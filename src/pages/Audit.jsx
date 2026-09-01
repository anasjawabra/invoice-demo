import React, { useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../components/Toast';
import { AUDIT_STAGES, AUDIT_TRAIL, INVOICES, STATUS } from '../data/mock';
import { AUDIT_CHECK } from '../data/aiProcess';
import AIProcessDrawer from '../components/ai/AIProcessDrawer';
import { exportCSV } from '../utils/export';
import { L } from '../components/ai/util';

function badgeForStageColor(c) {
  switch (c) {
    case 'blue':
      return 'badge--blue';
    case 'teal':
      return 'badge--teal';
    case 'orange':
      return 'badge--orange';
    case 'purple':
      return 'badge--purple';
    case 'green':
      return 'badge--green';
    case 'gold':
      return 'badge--gold';
    default:
      return '';
  }
}

export default function Audit() {
  const { t, lang } = useI18n();
  const toast = useToast();

  const [invFilter, setInvFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [drawer, setDrawer] = useState(null);

  const stats = useMemo(() => {
    const events = AUDIT_TRAIL.length;
    const invoices = new Set(AUDIT_TRAIL.map((e) => e.inv)).size;
    const hitl = AUDIT_TRAIL.filter((e) => e.hitl).length;
    return { events, invoices, hitl, violations: 0 };
  }, []);

  // SCR-08 search criteria: stage / invoice no / status / amount range. Amount
  // and status join the INVOICES records so the audit view stays same-source.
  const filtered = useMemo(() => {
    const q = invFilter.trim().toLowerCase();
    const min = parseFloat(amountMin);
    const max = parseFloat(amountMax);
    return AUDIT_TRAIL.filter((e) => {
      if (stageFilter !== 'all' && e.stage !== stageFilter) return false;
      if (q && !e.inv.toLowerCase().includes(q)) return false;
      const inv = INVOICES.find((i) => i.id === e.inv);
      if (statusFilter !== 'all' && inv?.status !== statusFilter) return false;
      if (!Number.isNaN(min) && (!inv || inv.amount < min)) return false;
      if (!Number.isNaN(max) && (!inv || inv.amount > max)) return false;
      return true;
    });
  }, [invFilter, stageFilter, statusFilter, amountMin, amountMax]);

  function doExport() {
    exportCSV('audit-trail', filtered.map((e) => ({
      time: e.time,
      invoice: e.inv,
      stage: L(AUDIT_STAGES[e.stage].label, lang),
      actor: L(e.actor, lang),
      action: L(e.action, lang),
      confidence: e.conf ?? '',
      hitl: e.hitl ? 'yes' : ''
    })));
    toast.success(`${t('toast_export')}audit-trail.csv`);
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('audit')}</div>
          <div className="page-sub">{t('audit_sub')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge--indigo" title={t('persona_main')}>{t('persona_auditor')} · {t('persona_governance')}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={doExport}>
            {t('ad_export')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            title={t('exp_signed_note')}
            onClick={() => toast.info(t('exp_signed_note'))}
          >
            {t('exp_signed')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setDrawer(AUDIT_CHECK)}>
            {t('ad_compliance')}
          </button>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card card-pad">
          <div className="kpi__value">{stats.events}</div>
          <div className="kpi__label">{t('ad_kpi_events')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.invoices}</div>
          <div className="kpi__label">{t('ad_kpi_invoices')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value">{stats.hitl}</div>
          <div className="kpi__label">{t('ad_kpi_hitl')}</div>
        </div>
        <div className="card card-pad">
          <div className="kpi__value" style={{ color: 'var(--green, #006604)' }}>{stats.violations}</div>
          <div className="kpi__label">{t('ad_kpi_compliance')}</div>
        </div>
      </div>

      <div className="card card-pad">
        {/* Search criteria (SCR-08): invoice no + stage + period preset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('ad_search')}</span>
          <input
            className="input"
            style={{ width: 200 }}
            value={invFilter}
            onChange={(e) => setInvFilter(e.target.value)}
            placeholder={t('ad_filter_inv')}
            aria-label={t('ad_filter_inv')}
            dir="ltr"
          />
          <select
            className="select"
            style={{ width: 180 }}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            aria-label={t('ad_filter_stage')}
          >
            <option value="all">{`${t('th_stage')}: ${t('ad_all')}`}</option>
            {Object.keys(AUDIT_STAGES).map((k) => (
              <option key={k} value={k}>{L(AUDIT_STAGES[k].label, lang)}</option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 180 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={t('th_status')}
          >
            <option value="all">{`${t('th_status')}: ${t('ad_all')}`}</option>
            {Object.keys(STATUS).map((k) => (
              <option key={k} value={k}>
                {lang === 'zh' ? STATUS[k].label : lang === 'ar' ? STATUS[k].labelAr : STATUS[k].labelEn}
              </option>
            ))}
          </select>
          <input
            className="input"
            style={{ width: 130 }}
            type="number"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
            placeholder={t('ad_filter_min')}
            aria-label={t('ad_filter_min')}
            dir="ltr"
          />
          <span className="muted">—</span>
          <input
            className="input"
            style={{ width: 130 }}
            type="number"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
            placeholder={t('ad_filter_max')}
            aria-label={t('ad_filter_max')}
            dir="ltr"
          />
        </div>

        <div className="table-wrap">
          <table className="table" aria-label="Audit trail">
            <thead>
              <tr>
                <th>{t('th_time')}</th>
                <th>{t('th_id')}</th>
                <th>{t('th_stage')}</th>
                <th>{t('th_actor')}</th>
                <th>{t('th_act')}</th>
                <th>{t('th_conf')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const st = AUDIT_STAGES[e.stage];
                return (
                  <tr key={`${e.time}-${e.inv}-${i}`} style={e.hitl ? { background: 'rgba(255, 193, 7, 0.05)' } : undefined}>
                    <td dir="ltr" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{e.time}</td>
                    <td dir="ltr" style={{ fontWeight: 900 }}>{e.inv}</td>
                    <td>
                      <span className={`badge ${badgeForStageColor(st.color)}`}>{L(st.label, lang)}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{L(e.actor, lang)}</td>
                    <td style={{ fontSize: 12, color: 'var(--txt-dim)' }}>{L(e.action, lang)}</td>
                    <td dir="ltr">
                      {typeof e.conf === 'number' ? (
                        <span className={`badge ${e.conf >= 75 ? 'badge--green' : 'badge--orange'}`}>{e.conf}%</span>
                      ) : (
                        <span className="badge badge--gold">HITL</span>
                      )}
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
