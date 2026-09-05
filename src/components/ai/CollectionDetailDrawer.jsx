import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../context/I18nContext';
import { L } from './util';
import { fmtMoney } from '../../data/mock';

const TITLE = { zh: '催收案例详情', en: 'Collection Case Detail', ar: 'تفاصيل حالة التحصيل' };
const STRATEGY_LABEL = { zh: '建议策略', en: 'Recommended Strategy', ar: 'الإستراتيجية الموصى بها' };

function badgeForDelay(k) {
  if (k === 'high') return 'badge--red';
  if (k === 'mid') return 'badge--orange';
  return 'badge--green';
}

/** A labelled value cell; matches the pattern used across the AI drawers. */
function Cell({ label, children, ltr }) {
  return (
    <div className="idd-cell">
      <span className="idd-cell__k">{label}</span>
      <span className="idd-cell__v" {...(ltr ? { dir: 'ltr' } : {})}>{children}</span>
    </div>
  );
}

/**
 * CollectionDetailDrawer — review panel for one overdue receivable (a
 * `COLLECTIONS` record). Reuses the `.ai-drawer`/`.idd-*` shell for visual
 * consistency with InvoiceDetailDrawer, but only shows fields that actually
 * apply to a collections case (no OCR/reconciliation — those belong to the
 * invoice-processing pipeline, not receivables aging).
 *
 * Props:
 *  - c: a COLLECTIONS record (or null)
 *  - open, onClose
 *  - onOpenAI(): opens the AIProcessDrawer with this case's forecast basis
 */
export default function CollectionDetailDrawer({ c, open, onClose, onOpenAI }) {
  const { t, lang } = useI18n();
  const closeRef = useRef(null);

  const onEsc = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onEsc]);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, c]);

  if (!open || !c) return null;

  const entity = lang === 'zh' ? c.entity : lang === 'ar' ? c.entityAr : c.entityEn;
  const delayLabel = lang === 'zh' ? c.delay : lang === 'ar' ? c.delayAr : c.delayEn;
  const penaltyLabel = c.penaltyKey === 'none' ? t('penalty_none') : (lang === 'zh' ? c.penalty : lang === 'ar' ? c.penaltyAr : c.penaltyEn);
  const strategy = lang === 'zh' ? c.strategy : lang === 'ar' ? c.strategyAr : c.strategyEn;

  return createPortal(
    <>
      <div className="ai-drawer-overlay" onClick={onClose} />
      <aside className="ai-drawer idd" role="dialog" aria-modal="true" aria-label={`${L(TITLE, lang)} · ${c.id}`}>
        <div className="ai-drawer__head">
          <div style={{ minWidth: 0 }}>
            <div className="ai-drawer__title">
              <span className={`badge ${badgeForDelay(c.delayKey)}`}>{delayLabel}</span>
              <span dir="ltr">{c.id}</span>
            </div>
            <div className="ai-drawer__sub">{L(TITLE, lang)}</div>
          </div>
          <button type="button" className="ai-drawer__close" onClick={onClose} aria-label={t('close')} ref={closeRef}>
            ×
          </button>
        </div>

        <div className="ai-drawer__body">
          <div className="idd-section">
            <div className="idd-hero">
              <div className="idd-hero__amt" dir="ltr">{fmtMoney(c.amount)} <small>SAR</small></div>
              <span className={`badge ${c.prob >= 80 ? 'badge--green' : c.prob >= 50 ? 'badge--gold' : 'badge--red'}`}>{c.prob}%</span>
            </div>
            <div className="idd-grid">
              <Cell label={t('th_vendor')}>{entity}</Cell>
              <Cell label={t('th_overdue')} ltr>{c.overdue} {t('unit_day')}</Cell>
              <Cell label={t('th_prob')} ltr>{c.prob}%</Cell>
              <Cell label={t('th_delay')}>{delayLabel}</Cell>
              <Cell label={t('th_penalty')}>{penaltyLabel}</Cell>
            </div>
          </div>

          <div className="idd-section">
            <div className="idd-section__head">
              <div className="idd-section__title">{L(STRATEGY_LABEL, lang)}</div>
            </div>
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{strategy}</div>
          </div>

          <div className="idd-actions">
            <button type="button" className="btn btn-primary idd-aibtn" onClick={onOpenAI}>
              {t('ai_basis_btn')}
            </button>
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
