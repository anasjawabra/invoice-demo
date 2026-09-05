import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { COLLECTIONS, INVOICES, RISKS, fmtMoney } from '../data/mock';

function badgeForColor(c) {
  switch (c) {
    case 'teal':
      return 'badge--teal';
    case 'indigo':
      return 'badge--indigo';
    case 'gold':
      return 'badge--gold';
    case 'green':
      return 'badge--green';
    case 'red':
      return 'badge--red';
    case 'orange':
      return 'badge--orange';
    case 'blue':
      return 'badge--blue';
    case 'purple':
      return 'badge--purple';
    default:
      return '';
  }
}

export default function Dashboard() {
  const { t, lang, isRtl } = useI18n();
  const nav = useNavigate();

  // Period filter for the lifecycle/source panels below — a stakeholder
  // explicitly required this as a real selectable filter (fiscal
  // year, previous month, trailing 3/6/12 months, or a custom from-to range),
  // not a fixed snapshot. COLLECTIONS entries carry no explicit issue date
  // (only days-overdue), so they're placed on the timeline by subtracting
  // `overdue` from the latest real invoice date — an honest derivation from
  // real fields, not an invented one.
  const anchorToday = useMemo(() => INVOICES.reduce((max, i) => (i.date > max ? i.date : max), INVOICES[0].date), []);

  const addMonths = (dateStr, delta) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + delta);
    return d.toISOString().slice(0, 10);
  };
  const subtractDays = (dateStr, days) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };

  const collectionsWithDate = useMemo(
    () => COLLECTIONS.map((c) => ({ ...c, impliedDate: subtractDays(anchorToday, c.overdue) })),
    [anchorToday]
  );

  const availableYears = useMemo(() => {
    const years = new Set(INVOICES.map((i) => i.date.slice(0, 4)));
    collectionsWithDate.forEach((c) => years.add(c.impliedDate.slice(0, 4)));
    return [...years].sort();
  }, [collectionsWithDate]);

  const [dateFilter, setDateFilter] = useState({ mode: 'all', year: '', from: '', to: '' });

  const { rangeStart, rangeEnd } = useMemo(() => {
    switch (dateFilter.mode) {
      case 'prevMonth': {
        const d = new Date(`${anchorToday}T00:00:00Z`);
        const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
        const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)).toISOString().slice(0, 10);
        return { rangeStart: start, rangeEnd: end };
      }
      case '3m':
        return { rangeStart: addMonths(anchorToday, -3), rangeEnd: anchorToday };
      case '6m':
        return { rangeStart: addMonths(anchorToday, -6), rangeEnd: anchorToday };
      case '1y':
        return { rangeStart: addMonths(anchorToday, -12), rangeEnd: anchorToday };
      case 'year':
        return dateFilter.year
          ? { rangeStart: `${dateFilter.year}-01-01`, rangeEnd: `${dateFilter.year}-12-31` }
          : { rangeStart: null, rangeEnd: null };
      case 'custom':
        return { rangeStart: dateFilter.from || null, rangeEnd: dateFilter.to || null };
      default:
        return { rangeStart: null, rangeEnd: null };
    }
  }, [dateFilter, anchorToday]);

  const inRange = (dateStr) => (!rangeStart || dateStr >= rangeStart) && (!rangeEnd || dateStr <= rangeEnd);

  const filteredInvoices = useMemo(() => INVOICES.filter((i) => inRange(i.date)), [rangeStart, rangeEnd]);
  const filteredCollections = useMemo(
    () => collectionsWithDate.filter((c) => inRange(c.impliedDate)),
    [collectionsWithDate, rangeStart, rangeEnd]
  );

  // Latest suspected invoices: real Risk Radar entries, worst score first.
  const suspected = useMemo(() => [...RISKS].sort((a, b) => b.score - a.score), []);

  // Oldest distressed receivables: real Collection Forecast entries, longest overdue first.
  const oldestDebts = useMemo(() => [...COLLECTIONS].sort((a, b) => b.overdue - a.overdue), []);

  // Invoice lifecycle — every deferred-billing invoice must resolve into
  // exactly one of collected / referred-to-enforcement / cancelled /
  // uncollected (prepaid invoices skip this lifecycle entirely).
  const lifecycle = useMemo(() => {
    const deferred = filteredInvoices.filter((i) => i.payType === 'deferred');
    const collectedInvoices = deferred.filter((i) => i.status === 'approved');
    const cancelledInvoices = deferred.filter((i) => i.status === 'duplicate');
    const stillOpenInvoices = deferred.filter((i) => !['approved', 'duplicate'].includes(i.status));
    const enforced = filteredCollections.filter((c) => c.lifecycle === 'enforced');
    const uncollected = filteredCollections.filter((c) => c.lifecycle === 'uncollected');
    // The "collected" bucket itself splits into two distinct cash channels —
    // a payer settling on their own vs. cash that only arrived via forced
    // enforcement (bank transfer after judiciary referral).
    const collectedVoluntary = collectedInvoices.filter((i) => i.collectedVia !== 'enforcement');
    const collectedEnforcement = collectedInvoices.filter((i) => i.collectedVia === 'enforcement');
    const sumAmount = (arr) => arr.reduce((s, i) => s + i.amount, 0);
    return {
      collected: collectedInvoices.length,
      collectedValue: sumAmount(collectedInvoices),
      collectedVoluntary: collectedVoluntary.length,
      collectedVoluntaryValue: sumAmount(collectedVoluntary),
      collectedEnforcement: collectedEnforcement.length,
      collectedEnforcementValue: sumAmount(collectedEnforcement),
      enforced: enforced.length,
      enforcedValue: sumAmount(enforced),
      cancelled: cancelledInvoices.length,
      cancelledValue: sumAmount(cancelledInvoices),
      uncollected: stillOpenInvoices.length + uncollected.length,
      uncollectedValue: sumAmount(stillOpenInvoices) + sumAmount(uncollected)
    };
  }, [filteredInvoices, filteredCollections]);

  const lifecycleTotal = lifecycle.collected + lifecycle.enforced + lifecycle.cancelled + lifecycle.uncollected;
  const pctOf = (n, total) => (total ? Math.round((n / total) * 100) : 0);

  const LIFECYCLE_TILES = [
    { key: 'collected', color: 'green', value: lifecycle.collected, amount: lifecycle.collectedValue, labelKey: 'lifecycle_collected', route: '/invoices' },
    { key: 'enforced', color: 'indigo', value: lifecycle.enforced, amount: lifecycle.enforcedValue, labelKey: 'lifecycle_enforced', route: '/collection' },
    { key: 'cancelled', color: 'gold', value: lifecycle.cancelled, amount: lifecycle.cancelledValue, labelKey: 'lifecycle_cancelled', route: '/invoices' },
    { key: 'uncollected', color: 'red', value: lifecycle.uncollected, amount: lifecycle.uncollectedValue, labelKey: 'lifecycle_uncollected', route: '/collection' }
  ];

  const TILE_TINT = {
    green: 'rgba(0, 102, 4, 0.07)',
    indigo: 'rgba(0, 90, 150, 0.07)',
    gold: 'rgba(255, 193, 7, 0.12)',
    red: 'rgba(175, 8, 24, 0.07)'
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="page-head">
        <div>
          <div className="page-title">{t('dash_title')}</div>
        </div>
      </div>

      <div className="card card-pad" style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 900, fontSize: 12, color: 'var(--muted)' }}>{t('dash_period_label')}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            ['all', 'dash_period_alltime'],
            ['prevMonth', 'dash_period_prev_month'],
            ['3m', 'dash_period_3m'],
            ['6m', 'dash_period_6m'],
            ['1y', 'dash_period_1y']
          ].map(([key, labelKey]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${dateFilter.mode === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDateFilter({ mode: key, year: '', from: '', to: '' })}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <select
          className="select"
          style={{ height: 32, width: 'auto', paddingInline: 10, fontSize: 12.5 }}
          value={dateFilter.mode === 'year' ? dateFilter.year : ''}
          onChange={(e) => setDateFilter({ mode: 'year', year: e.target.value, from: '', to: '' })}
        >
          <option value="" disabled>{t('dash_period_year_placeholder')}</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          type="button"
          className={`btn btn-sm ${dateFilter.mode === 'custom' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setDateFilter((f) => ({ mode: 'custom', year: '', from: f.from || '', to: f.to || '' }))}
        >
          {t('dash_period_custom')}
        </button>
        {dateFilter.mode === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              className="input"
              style={{ height: 32, width: 'auto', paddingInline: 10, fontSize: 12.5 }}
              value={dateFilter.from}
              max={dateFilter.to || undefined}
              onChange={(e) => setDateFilter((f) => ({ ...f, mode: 'custom', from: e.target.value }))}
            />
            <span className="muted" style={{ fontSize: 12 }}>{t('dash_period_to')}</span>
            <input
              type="date"
              className="input"
              style={{ height: 32, width: 'auto', paddingInline: 10, fontSize: 12.5 }}
              value={dateFilter.to}
              min={dateFilter.from || undefined}
              onChange={(e) => setDateFilter((f) => ({ ...f, mode: 'custom', to: e.target.value }))}
            />
          </div>
        )}
        <span className="muted" style={{ fontSize: 11.5, marginInlineStart: 'auto' }}>
          {rangeStart || rangeEnd ? `${rangeStart || '…'} → ${rangeEnd || '…'}` : t('dash_period_alltime')}
        </span>
      </div>

      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 10 }}>
          <div>
            <div className="page-title" style={{ fontSize: 16 }}>{t('lifecycle_title')}</div>
          </div>
        </div>
        <div className="grid grid-4">
          {LIFECYCLE_TILES.map((tile) => (
            <div
              key={tile.key}
              className="card card-pad"
              role="button"
              tabIndex={0}
              style={{
                cursor: 'pointer',
                background: TILE_TINT[tile.color],
                borderInlineStart: `4px solid var(--${tile.color})`
              }}
              onClick={() => nav(tile.route)}
              onKeyDown={(e) => { if (e.key === 'Enter') nav(tile.route); }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div className="kpi__value">{tile.value}</div>
                <span className={`badge badge--${tile.color}`}>{pctOf(tile.value, lifecycleTotal)}%</span>
              </div>
              <div className="kpi__label">{t(tile.labelKey)}</div>
              <div style={{ fontSize: 12.5, fontWeight: 900, marginTop: 3 }}>{fmtMoney(tile.amount)} SAR</div>
              {tile.key === 'collected' && (
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  {t('lifecycle_collected_voluntary')}: {lifecycle.collectedVoluntary} ({pctOf(lifecycle.collectedVoluntary, lifecycle.collected)}%) · {t('lifecycle_collected_enforcement')}: {lifecycle.collectedEnforcement} ({pctOf(lifecycle.collectedEnforcement, lifecycle.collected)}%)
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-pad">
          <div className="page-head" style={{ marginBottom: 10 }}>
            <div className="page-title" style={{ fontSize: 16 }}>{t('suspected_title')}</div>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => nav('/risk')}>
              {isRtl ? `${t('link_details')} ←` : `${t('link_details')} →`}
            </button>
          </div>
          <div className="grid" style={{ gap: 2 }}>
            {suspected.map((r) => {
              const tag = lang === 'zh' ? r.types[0] : lang === 'ar' ? r.typesAr[0] : r.typesEn[0];
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--line)'
                  }}
                >
                  <span className={`badge ${badgeForColor(r.color)}`}>{tag}</span>
                  <span style={{ fontWeight: 800, fontSize: 13 }} dir="ltr">{r.id}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card card-pad">
          <div className="page-head" style={{ marginBottom: 10 }}>
            <div className="page-title" style={{ fontSize: 16 }}>{t('oldest_debt_title')}</div>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => nav('/collection')}>
              {isRtl ? `${t('link_details')} ←` : `${t('link_details')} →`}
            </button>
          </div>
          <div className="grid" style={{ gap: 2 }}>
            {oldestDebts.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--line)'
                }}
              >
                <span className={`badge ${badgeForColor(c.delayKey === 'high' ? 'red' : c.delayKey === 'mid' ? 'orange' : 'green')}`}>
                  {c.overdue} {t('unit_day')}
                </span>
                <span style={{ fontWeight: 800, fontSize: 13 }} dir="ltr">{c.id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
