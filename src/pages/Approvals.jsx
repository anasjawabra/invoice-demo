import React, { useMemo, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../components/Toast';
import { fmtMoney, APPROVALS } from '../data/mock';
import { APPROVAL_BASIS } from '../data/aiProcess';
import AIProcessDrawer from '../components/ai/AIProcessDrawer';

function priorityBadge(k) {
  if (k === 'high') return 'badge--red';
  if (k === 'mid') return 'badge--orange';
  return 'badge--green';
}

export default function Approvals() {
  const { t, lang, T } = useI18n();
  const toast = useToast();

  const [items, setItems] = useState(APPROVALS);
  const [drawer, setDrawer] = useState(null);

  const empty = items.length === 0;

  const pendingCount = useMemo(() => items.length, [items.length]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('approvals')}</div>
          <div className="page-sub">
            {t('hitl_desc')}
          </div>
        </div>
        <span className={`badge ${pendingCount ? 'badge--orange' : 'badge--green'}`}>{pendingCount}</span>
      </div>

      {empty ? (
        <div className="card card-pad">
          <div style={{ fontWeight: 900 }}>{t('apv_empty')}</div>
        </div>
      ) : null}

      <div className="grid grid-2">
        {items.map((a) => (
          <div className="card card-pad" key={a.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 950, fontSize: 14 }}>{a.id}</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>{T(a, 'entity')}</div>
                <div style={{ marginTop: 10, fontWeight: 900 }}>{fmtMoney(a.amount)} {a.currency}</div>
              </div>
              <span className={`badge ${priorityBadge(a.priorityKey)}`}>{t('priority')}: {lang === 'zh' ? a.priority : lang === 'ar' ? a.priorityAr : a.priorityEn}</span>
            </div>

            <div className="hr" />

            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('apv_chain')}</div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: 'var(--txt-dim)' }}>{lang === 'zh' ? a.chain : lang === 'ar' ? a.chainAr : a.chainEn}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="card" style={{ padding: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('apv_assignee')}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--txt-dim)' }}>{lang === 'zh' ? a.assignee : lang === 'ar' ? a.assigneeAr : a.assigneeEn}</div>
                </div>
                <div className="card" style={{ padding: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('apv_sla')}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--txt-dim)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{lang === 'zh' ? a.sla : lang === 'ar' ? a.slaAr : a.slaEn}</span>
                    {typeof a.slaLeft === 'number' ? (
                      <span className={`badge ${a.slaLeft < 6 ? 'badge--orange' : 'badge--green'}`} dir="ltr">
                        {t('sla_left')} {a.slaLeft}h{a.slaLeft < 6 ? ' ⚠' : ''}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('apv_reason')}</div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: 'var(--txt-dim)' }}>{lang === 'zh' ? a.reason : lang === 'ar' ? a.reasonAr : a.reasonEn}</div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setDrawer(APPROVAL_BASIS[a.id])}
              >
                {t('ai_assist_btn')}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => toast.info(`${t('toast_clarify')}${a.id}`)}
              >
                {t('btn_clarify')}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setItems((prev) => prev.filter((x) => x.id !== a.id));
                  toast.success(`${t('toast_approve')}${a.id}`);
                }}
              >
                {t('btn_approve')}
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => {
                  setItems((prev) => prev.filter((x) => x.id !== a.id));
                  toast.warning(`${t('toast_reject')}${a.id}`);
                }}
              >
                {t('btn_reject')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <AIProcessDrawer open={!!drawer} onClose={() => setDrawer(null)} data={drawer} />
    </div>
  );
}
