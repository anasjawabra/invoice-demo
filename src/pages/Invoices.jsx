import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
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
const PRIMARY_AGENT = { normal: 'A2', fraud: 'A3', dup: 'A1', taxfail: 'A2' };

// Map an invoice to the same aiProcess bundle the Risk/Approvals/Pipeline pages
// use: prefer a per-invoice bundle, else fall back to the scenario's key node.
function aiBundleForInvoice(inv) {
  if (RISK_ANALYSIS[inv.id]) return RISK_ANALYSIS[inv.id];
  if (APPROVAL_BASIS[inv.id]) return APPROVAL_BASIS[inv.id];
  const scenario = inv.tag || 'normal';
  const nodes = NODE_DRAWERS[scenario] || NODE_DRAWERS.normal;
  const agent = PRIMARY_AGENT[scenario] || 'A2';
  return nodes[agent] || nodes.A1 || nodes.A2 || null;
}

/* UC-08: statuses that may be resolved through the pending-invoice actions. */
const DISPOSABLE = ['review', 'duplicate', 'anomaly', 'rejected'];

/* Disposition → resulting status (final rejection keeps its own status). */
const DISPOSE_NEXT = { correct: 'pending', refer: 'review', docs: 'review', finalReject: 'rejected' };

export default function Invoices() {
  const { t, lang, T } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const scale = user?.org?.scale ?? 1;

  // Local copy so dispositions (UC-08) mutate rows without touching the source.
  const [items, setItems] = useState(INVOICES);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const [detail, setDetail] = useState(null); // invoice shown in the detail drawer
  const [aiDrawer, setAiDrawer] = useState(null); // aiProcess bundle (stacked on top)
  const triggerRef = useRef(null); // row that opened the detail (for focus return)

  // Pending-invoice resolution state (UC-08): which row is expanded and,
  // once "final reject" is chosen, its mandatory reason input.
  const [disposeId, setDisposeId] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [disposeReason, setDisposeReason] = useState('');

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

  const sources = useMemo(() => ['all', ...new Set(INVOICES.map((i) => i.source))], []);

  const filtered = useMemo(() => {
    return items.filter((i) =>
      (statusFilter === 'all' || i.status === statusFilter) &&
      (sourceFilter === 'all' || i.source === sourceFilter)
    );
  }, [items, statusFilter, sourceFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const approved = items.filter((i) => i.status === 'approved').length;
    const pending = items.filter((i) => i.status === 'pending').length;
    const review = items.filter((i) => i.status === 'review').length;
    const anomaly = items.filter((i) => i.status === 'anomaly' || i.status === 'duplicate').length;
    return { total, approved, pending, review, anomaly };
  }, [items]);

  function applyDisposition(inv, mode) {
    if (mode === 'finalReject') {
      if (!disposeReason.trim()) {
        toast.warning(t('dispose_reason_req'));
        return;
      }
      setItems((prev) => prev.map((x) => (x.id === inv.id ? { ...x, status: DISPOSE_NEXT[mode] } : x)));
      toast.warning(`${t('toast_dispose_reject')}${inv.id}`);
    } else if (mode === 'correct') {
      setItems((prev) => prev.map((x) => (x.id === inv.id ? { ...x, status: DISPOSE_NEXT[mode] } : x)));
      toast.success(`${t('toast_dispose_correct')}${inv.id}`);
    } else if (mode === 'refer') {
      toast.info(`${t('toast_dispose_refer')}${inv.id}`);
    } else if (mode === 'docs') {
      toast.info(`${t('toast_dispose_docs')}${inv.id}`);
    }
    setDisposeId(null);
    setRejecting(false);
    setDisposeReason('');
  }

  const viewLabel = L({ zh: '查看详情', en: 'View details', ar: 'عرض التفاصيل' }, lang);
  const colCount = 9;

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
        {/* Filters (SCR-01/05 style chips, display-layer only) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('inv_filter_status')}</span>
          {['all', ...Object.keys(STATUS)].map((k) => (
            <button
              key={k}
              type="button"
              className={`btn btn-sm ${statusFilter === k ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(k)}
            >
              {k === 'all' ? t('ad_all') : (lang === 'zh' ? STATUS[k].label : lang === 'ar' ? STATUS[k].labelAr : STATUS[k].labelEn)}
            </button>
          ))}
          <span className="hr" style={{ width: 1, height: 20, background: 'var(--line)' }} />
          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>{t('inv_filter_source')}</span>
          {sources.map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-sm ${sourceFilter === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSourceFilter(s)}
            >
              {s === 'all' ? t('ad_all') : s}
            </button>
          ))}
        </div>

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
                <th aria-label={viewLabel} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const stx = STATUS[inv.status];
                const stLabel = lang === 'zh' ? stx?.label : lang === 'ar' ? stx?.labelAr : stx?.labelEn;
                const badge = badgeForStatusColor(stx?.color);
                const disposable = DISPOSABLE.includes(inv.status);
                const expanded = disposeId === inv.id;
                return (
                  <React.Fragment key={inv.id}>
                    <tr
                      className="row-clickable"
                      tabIndex={0}
                      role="button"
                      aria-label={`${viewLabel} · ${inv.id}`}
                      onClick={(e) => openDetail(inv, e)}
                      onKeyDown={(e) => onRowKey(inv, e)}
                    >
                      <td style={{ fontWeight: 900 }} dir="ltr">{inv.id}</td>
                      <td>{T(inv, 'entity')}</td>
                      <td dir="ltr">{fmtMoney(Math.round(inv.amount * scale))} {inv.currency}</td>
                      <td>{inv.source}</td>
                      <td>
                        <span className={`badge ${badge}`}>{stLabel}</span>
                      </td>
                      <td dir="ltr">{inv.po}</td>
                      <td dir="ltr">{inv.date}</td>
                      <td>
                        <span className={`badge ${inv.risk >= 60 ? 'badge--red' : inv.risk >= 40 ? 'badge--orange' : 'badge--green'}`}>{inv.risk}</span>
                      </td>
                      <td className="row-view" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {disposable ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDisposeId(expanded ? null : inv.id);
                              setRejecting(false);
                              setDisposeReason('');
                            }}
                          >
                            {t('btn_dispose')}
                          </button>
                        ) : null}
                        <span className="row-view__link">{viewLabel}<span className="row-view__chev" aria-hidden="true">›</span></span>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="inv-dispose-row">
                        <td colSpan={colCount} style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div style={{ display: 'grid', gap: 10, padding: '6px 4px 10px' }}>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => applyDisposition(inv, 'correct')}>
                                {t('btn_correct')}
                              </button>
                              <button type="button" className="btn btn-danger btn-sm" onClick={() => setRejecting(true)}>
                                {t('btn_final_reject')}
                              </button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyDisposition(inv, 'refer')}>
                                {t('btn_refer')}
                              </button>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyDisposition(inv, 'docs')}>
                                {t('btn_request_docs')}
                              </button>
                            </div>
                            {rejecting ? (
                              <div style={{ display: 'grid', gap: 8 }}>
                                <textarea
                                  className="input"
                                  rows={2}
                                  value={disposeReason}
                                  onChange={(e) => setDisposeReason(e.target.value)}
                                  placeholder={`${t('dispose_reason')} · ${t('dispose_reason_req')}`}
                                  aria-label={t('dispose_reason')}
                                />
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => applyDisposition(inv, 'finalReject')}>
                                    {t('v_submit')}
                                  </button>
                                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRejecting(false)}>
                                    ×
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
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
