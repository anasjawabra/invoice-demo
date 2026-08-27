import React, { useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../components/Toast';
import { fmtMoney, APPEAL_STATUS, EXEC_STATUS, ORGS, VIOLATION_LAWS, VIOLATIONS } from '../data/mock';
import { VIOLATION_ANALYSIS } from '../data/aiProcess';
import AIProcessDrawer from '../components/ai/AIProcessDrawer';

function badgeForColor(c) {
  switch (c) {
    case 'blue':
      return 'badge--blue';
    case 'gold':
      return 'badge--gold';
    case 'red':
      return 'badge--red';
    case 'green':
      return 'badge--green';
    case 'orange':
      return 'badge--orange';
    default:
      return '';
  }
}

function badgeForScore(s) {
  if (s >= 80) return 'badge--green';
  if (s >= 40) return 'badge--orange';
  return 'badge--red';
}

/* Rows without a dedicated trace reuse the appeal-accepted narrative. */
const FALLBACK_TRACE = 'VIO-2026-1042';

const HIGH_VALUE = 100000; // BRD UC-12 alert threshold (SAR)

export default function Violations() {
  const { t, lang, T } = useI18n();
  const toast = useToast();

  const [items, setItems] = useState(VIOLATIONS);
  const [execFilter, setExecFilter] = useState('all');
  const [drawer, setDrawer] = useState(null);

  const stats = useMemo(() => {
    const byKey = {};
    for (const k of Object.keys(EXEC_STATUS)) byKey[k] = items.filter((v) => v.execKey === k).length;
    return byKey;
  }, [items]);

  const filtered = useMemo(() => (
    items.filter((v) => execFilter === 'all' || v.execKey === execFilter)
  ), [items, execFilter]);

  function dictLabel(dict, key) {
    const d = dict[key];
    return lang === 'zh' ? d.label : lang === 'ar' ? d.labelAr : d.labelEn;
  }

  function orgName(orgId) {
    const o = ORGS.find((x) => x.id === orgId);
    return o ? T(o, 'name') : orgId;
  }

  function applyAction(v, mode) {
    if (mode === 'refer') {
      setItems((prev) => prev.map((x) => (x.id === v.id ? { ...x, execKey: 'enforced' } : x)));
      toast.success(`${t('toast_vio_refer')}${v.id}`);
    } else if (mode === 'follow') {
      toast.info(`${t('toast_vio_follow')}${v.id}`);
    } else {
      toast.info(`${t('toast_vio_manual')}${v.id}`);
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('violations')}</div>
          <div className="page-sub">{t('vio_sub')}</div>
        </div>
        <span className="badge badge--teal">{t('updated_daily')}</span>
        <span className="badge badge--indigo" title={t('persona_main')}>{t('persona_penalties')}</span>
      </div>

      {/* Four-state enforcement KPIs (SCR-12) */}
      <div className="grid grid-4">
        {Object.keys(EXEC_STATUS).map((k) => (
          <div className="card card-pad" key={k}>
            <div className="kpi__value">{stats[k]}</div>
            <div className="kpi__label">{dictLabel(EXEC_STATUS, k)}</div>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          {['all', ...Object.keys(EXEC_STATUS)].map((k) => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${execFilter === k ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setExecFilter(k)}
            >
              {k === 'all' ? t('ad_all') : dictLabel(EXEC_STATUS, k)}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          <table className="table" aria-label="Violations follow-up">
            <thead>
              <tr>
                <th>{t('th_vio_id')}</th>
                <th>{t('th_nid')}</th>
                <th>{t('org_label')}</th>
                <th>{t('th_law')}</th>
                <th>{t('th_amount')}</th>
                <th>{t('th_exec')}</th>
                <th>{t('th_appeal')}</th>
                <th>{t('th_score')}</th>
                <th aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const ex = EXEC_STATUS[v.execKey];
                const ap = APPEAL_STATUS[v.appealKey];
                const lw = VIOLATION_LAWS[v.lawKey];
                const note = lang === 'zh' ? v.note : lang === 'ar' ? v.noteAr : v.noteEn;
                return (
                  <tr
                    key={v.id}
                    title={note}
                    style={v.amount > HIGH_VALUE ? { background: 'rgba(175, 8, 24, 0.04)' } : undefined}
                  >
                    <td style={{ fontWeight: 900 }} dir="ltr">{v.id}</td>
                    <td dir="ltr">{v.nid}</td>
                    <td>{orgName(v.orgId)}</td>
                    <td style={{ fontSize: 12 }}>{T(lw, 'label')}</td>
                    <td dir="ltr" style={{ fontWeight: 800, color: v.amount > HIGH_VALUE ? 'var(--red, #AF0818)' : undefined }}>
                      {fmtMoney(v.amount)}
                      {v.amount > HIGH_VALUE ? <span className="badge badge--red" style={{ marginInlineStart: 4 }}>&gt;100K</span> : null}
                    </td>
                    <td><span className={`badge ${badgeForColor(ex.color)}`}>{dictLabel(EXEC_STATUS, v.execKey)}</span></td>
                    <td><span className={`badge ${badgeForColor(ap.color)}`}>{dictLabel(APPEAL_STATUS, v.appealKey)}</span></td>
                    <td dir="ltr"><span className={`badge ${badgeForScore(v.score)}`}>{v.score}%</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => setDrawer(VIOLATION_ANALYSIS[v.id] || VIOLATION_ANALYSIS[FALLBACK_TRACE])}
                        >
                          {t('ai_process_btn')}
                        </button>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          disabled={v.execKey === 'enforced'}
                          onClick={() => applyAction(v, 'refer')}
                        >
                          {t('vio_refer')}
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => applyAction(v, 'follow')}>
                          {t('vio_follow')}
                        </button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => applyAction(v, 'manual')}>
                          {t('vio_manual')}
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
