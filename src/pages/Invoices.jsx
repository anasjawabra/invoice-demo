import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { fmtMoney, INVOICES, STATUS, COLLECTION_STATUS, gfsForInvoice, collectionStatusFor } from '../data/mock';
import { APPROVAL_BASIS, NODE_DRAWERS, RISK_ANALYSIS } from '../data/aiProcess';
import { L } from '../components/ai/util';
import InvoiceDetailDrawer from '../components/ai/InvoiceDetailDrawer';
import AIProcessDrawer from '../components/ai/AIProcessDrawer';

function badgeForStatusColor(c) {
  switch (c) {
    case 'green':
      return 'badge--green';
    case 'teal':
      return 'badge--teal';
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

function collectionStatusKeyFor(inv) {
  if (inv.status === 'approved') return 'collected';
  if (inv.status === 'duplicate') return 'cancelled';
  return 'uncollected';
}

// Which agent node best represents each scenario's "full AI analysis".
const PRIMARY_AGENT = { normal: 'validation', fraud: 'anomaly', dup: 'dedup', taxfail: 'compliance' };

// Map an invoice to the same aiProcess bundle the Risk/Approvals/Pipeline pages
// use: prefer a per-invoice bundle, else fall back to the scenario's key node.
function aiBundleForInvoice(inv) {
  if (RISK_ANALYSIS[inv.id]) return RISK_ANALYSIS[inv.id];
  if (APPROVAL_BASIS[inv.id]) return APPROVAL_BASIS[inv.id];
  const scenario = inv.tag || 'normal';
  const nodes = NODE_DRAWERS[scenario] || NODE_DRAWERS.normal;
  const agent = PRIMARY_AGENT[scenario] || 'validation';
  return nodes[agent] || nodes.ingest || nodes.validation || null;
}

export default function Invoices() {
  const { t, lang, T } = useI18n();
  const { user } = useAuth();
  const scale = user?.org?.scale ?? 1;
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightCo = searchParams.get('co');
  const filterMode = searchParams.get('filter');

  const [amanahFilter, setAmanahFilter] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [search, setSearch] = useState('');

  const amanahOptions = useMemo(() => {
    const seen = new Map();
    for (const inv of INVOICES) {
      if (!inv.amanahEn || seen.has(inv.amanahEn)) continue;
      seen.set(inv.amanahEn, { key: inv.amanahEn, en: inv.amanahEn, ar: inv.amanahAr, zh: inv.amanah });
    }
    return [...seen.values()].sort((a, b) => a.en.localeCompare(b.en));
  }, []);
  const amanahLabel = (o) => (lang === 'zh' ? o.zh : lang === 'ar' ? o.ar : o.en);

  const activeFilterCount = [amanahFilter, collectionFilter].filter((v) => v !== 'all').length + (search.trim() ? 1 : 0);

  const visibleInvoices = useMemo(() => {
    let list = filterMode === 'problem' ? INVOICES.filter((i) => i.status === 'anomaly' || i.status === 'review' || i.status === 'duplicate') : INVOICES;
    if (amanahFilter !== 'all') list = list.filter((i) => i.amanahEn === amanahFilter);
    if (collectionFilter !== 'all') list = list.filter((i) => collectionStatusKeyFor(i) === collectionFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.id.toLowerCase().includes(q) || (i.entityEn || '').toLowerCase().includes(q) || (i.entity || '').includes(search.trim()) || (i.entityAr || '').includes(search.trim()));
    }
    return list;
  }, [filterMode, amanahFilter, collectionFilter, search]);

  const [detail, setDetail] = useState(null); // invoice shown in the detail drawer
  const [aiDrawer, setAiDrawer] = useState(null); // aiProcess bundle (stacked on top)
  const triggerRef = useRef(null); // row that opened the detail (for focus return)

  // Deep-linked from a Dashboard alert (?co=CO-xxxxx) — jump straight to that contract's invoice.
  useEffect(() => {
    if (!highlightCo) return;
    const match = INVOICES.find((inv) => inv.co === highlightCo);
    if (match) setDetail(match);
  }, [highlightCo]);

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

  const stats = useMemo(() => {
    const total = visibleInvoices.length;
    const approved = visibleInvoices.filter((i) => i.status === 'approved').length;
    const pending = visibleInvoices.filter((i) => i.status === 'pending').length;
    const review = visibleInvoices.filter((i) => i.status === 'review').length;
    const anomaly = visibleInvoices.filter((i) => i.status === 'anomaly' || i.status === 'duplicate').length;
    return { total, approved, pending, review, anomaly };
  }, [visibleInvoices]);

  const viewLabel = L({ zh: '查看详情', en: 'View details', ar: 'عرض التفاصيل' }, lang);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('invoices')}</div>
          <div className="page-sub">{t('recent_sub')}</div>
        </div>
      </div>

      <div className="card card-pad" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <input
          className="input"
          style={{ flex: '1 1 200px', height: 32, minWidth: 160 }}
          placeholder={t('inv_filter_search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" style={{ height: 32, width: 'auto', minWidth: 180, paddingInline: 10, fontSize: 12.5 }} value={amanahFilter} onChange={(e) => setAmanahFilter(e.target.value)}>
          <option value="all">{t('inv_filter_amanah_all')}</option>
          {amanahOptions.map((o) => (
            <option key={o.key} value={o.key}>{amanahLabel(o)}</option>
          ))}
        </select>
        <select className="select" style={{ height: 32, width: 'auto', minWidth: 160, paddingInline: 10, fontSize: 12.5 }} value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)}>
          <option value="all">{t('inv_filter_status_all')}</option>
          {Object.keys(COLLECTION_STATUS).map((k) => (
            <option key={k} value={k}>{lang === 'zh' ? COLLECTION_STATUS[k].label : lang === 'ar' ? COLLECTION_STATUS[k].labelAr : COLLECTION_STATUS[k].labelEn}</option>
          ))}
        </select>
        {activeFilterCount > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => { setAmanahFilter('all'); setCollectionFilter('all'); setSourceFilter('all'); setSearch(''); }}
          >
            {t('inv_filter_clear')} ({activeFilterCount}) ×
          </button>
        )}
        <span className="muted" style={{ fontSize: 11.5, marginInlineStart: 'auto' }}>
          {t('inv_filter_showing').replace('{n}', visibleInvoices.length).replace('{total}', INVOICES.length)}
        </span>
      </div>

      <div className="grid grid-3">
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
      </div>

      <div className="card card-pad">
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>{t('inv_makeen_note')}</div>
        {filterMode === 'problem' && (
          <div
            className="card"
            style={{ padding: '8px 12px', marginBottom: 10, background: 'rgba(175, 8, 24, 0.06)', border: '1px solid rgba(175, 8, 24, 0.22)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t('inv_filter_problem_title')}</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('filter'); return n; })}>
              {t('inv_filter_clear')} ×
            </button>
          </div>
        )}
        <div className="table-wrap">
          <table className="table" aria-label="Invoice library">
            <thead>
              <tr>
                <th>{t('th_id')}</th>
                <th>{t('th_beneficiary')}</th>
                <th>{t('th_amanah')}</th>
                <th>{t('th_gfs')}</th>
                <th>{t('th_collection_status')}</th>
                <th>{t('th_amount')}</th>
                <th>{t('th_date')}</th>
                <th>{t('info_risk')}</th>
                <th aria-label={viewLabel} />
              </tr>
            </thead>
            <tbody>
              {visibleInvoices.map((inv) => {
                const gfs = gfsForInvoice(inv);
                const gfsLabel = gfs ? (lang === 'zh' ? gfs.name : lang === 'ar' ? gfs.nameAr : gfs.nameEn) : '—';
                const cs = collectionStatusFor(inv);
                const csLabel = lang === 'zh' ? cs.label : lang === 'ar' ? cs.labelAr : cs.labelEn;
                const csBadge = badgeForStatusColor(cs.color);
                return (
                  <tr
                    key={inv.id}
                    className="row-clickable"
                    tabIndex={0}
                    role="button"
                    aria-label={`${viewLabel} · ${inv.id}`}
                    onClick={(e) => openDetail(inv, e)}
                    onKeyDown={(e) => onRowKey(inv, e)}
                    style={highlightCo && inv.co === highlightCo ? { background: 'rgba(0, 128, 255, 0.08)' } : undefined}
                  >
                    <td style={{ fontWeight: 900 }} dir="ltr">{inv.id}</td>
                    <td>{T(inv, 'entity')}</td>
                    <td>{T(inv, 'amanah')}</td>
                    <td title={gfs?.code}>{gfsLabel}</td>
                    <td>
                      <span className={`badge ${csBadge}`}>{csLabel}</span>
                    </td>
                    <td dir="ltr">{fmtMoney(Math.round(inv.amount * scale))} {inv.currency}</td>
                    <td dir="ltr">{inv.date}</td>
                    <td>
                      <span className={`badge ${inv.risk >= 60 ? 'badge--red' : inv.risk >= 40 ? 'badge--orange' : 'badge--green'}`}>{inv.risk}</span>
                    </td>
                    <td className="row-view">
                      <span className="row-view__link">{viewLabel}<span className="row-view__chev" aria-hidden="true">›</span></span>
                    </td>
                  </tr>
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
