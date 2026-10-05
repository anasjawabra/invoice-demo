import React, { useState } from 'react';
import { Slider } from '../../../components/CFOControlPanel';
import AssumptionsStrip from '../components/AssumptionsStrip';

const BUCKET_COLOR = { current: 'green', d1_30: 'gold', d31_60: 'gold', d61_90: 'red', d90plus: 'red' };

export default function InvoiceCollectionTab({
  t, money, model, assumptions, onAssumptionsChange, scenarioKey, onJumpToTargets, scopedInvoices, agingBuckets
}) {
  const [openBucket, setOpenBucket] = useState(null);

  const disputedValue = scopedInvoices.filter((i) => i.hasOpenObjection).reduce((s, i) => s + i.amount, 0);
  const overdueValue = agingBuckets.filter((b) => b.key !== 'current').reduce((s, b) => s + b.value, 0);
  const allAges = agingBuckets.flatMap((b) => b.rows.map((r) => r.ageDays));
  const avgDays = allAges.length ? Math.round(allAges.reduce((s, a) => s + a, 0) / allAges.length) : 0;

  const kpis = [
    { labelKey: 'cfo_invcoll_total_invoices', value: model.kpi.gross ? scopedInvoices.length : 0 },
    { labelKey: 'cfo_invcoll_invoiced', value: money(model.kpi.gross) },
    { labelKey: 'cfo_invcoll_collected', value: money(model.kpi.collectedValue) },
    { labelKey: 'cfo_invcoll_outstanding', value: money(model.kpi.uncollectedValue) },
    { labelKey: 'cfo_invcoll_overdue', value: money(overdueValue) },
    { labelKey: 'cfo_invcoll_rate', value: `${model.kpi.collectionRate}%` },
    { labelKey: 'cfo_invcoll_avg_days', value: avgDays },
    { labelKey: 'cfo_invcoll_disputed', value: money(disputedValue) }
  ];

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <AssumptionsStrip assumptions={assumptions} scenarioKey={scenarioKey} onJumpToTargets={onJumpToTargets} t={t} />

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{t('cfo_invcoll_title')}</div>
        <div className="page-sub">{t('cfo_invcoll_sub')}</div>
        <div className="grid grid-4" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
          {kpis.map((k) => (
            <div className="card card-pad" key={k.labelKey}>
              <div className="kpi__value" dir="ltr">{k.value}</div>
              <div className="kpi__label">{t(k.labelKey)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_invcoll_aging_title')}</div>
        <div className="page-sub">{t('cfo_invcoll_aging_sub')}</div>
        <div className="grid grid-5" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
          {agingBuckets.map((b) => (
            <button
              key={b.key} type="button"
              className="card card-pad"
              style={{ textAlign: 'start', cursor: 'pointer', borderColor: openBucket === b.key ? 'var(--primary)' : undefined }}
              onClick={() => setOpenBucket(openBucket === b.key ? null : b.key)}
            >
              <span className={`badge badge--${BUCKET_COLOR[b.key]}`} style={{ marginBottom: 'var(--spacing-xs)' }}>{t(`cfo_aging_${b.key}`)}</span>
              <div className="kpi__value" dir="ltr" style={{ fontSize: 'var(--text-md)' }}>{money(b.value)}</div>
              <div className="kpi__label">{b.count} {t('cfo_invcoll_items')}</div>
            </button>
          ))}
        </div>

        {openBucket && (
          <div className="table-wrap" style={{ marginTop: 'var(--spacing-lg)' }} tabIndex={0}>
            <table className="table" aria-label={t('cfo_invcoll_aging_title')}>
              <thead><tr><th>ID</th><th>{t('cfo_invcoll_age_days')}</th><th>Amount</th></tr></thead>
              <tbody>
                {(agingBuckets.find((b) => b.key === openBucket)?.rows || []).slice(0, 25).map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td dir="ltr">{r.ageDays}</td>
                    <td dir="ltr">{money(r.amount)}</td>
                  </tr>
                ))}
                {(agingBuckets.find((b) => b.key === openBucket)?.rows || []).length === 0 && (
                  <tr><td colSpan={3} className="muted">{t('cfo_invcoll_bucket_empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_invcoll_collection_title')}</div>
        <div className="page-sub">{t('cfo_invcoll_collection_sub')}</div>
        <div style={{ marginTop: 'var(--spacing-md)', maxWidth: 420 }}>
          <Slider
            label={`${t('cfo_invcoll_target_rate')} (${t('cfo_invcoll_starting_at')} ${model.actualRate}%)`}
            value={assumptions.collectionRateDelta} min={-30} max={30} unit="pp"
            onChange={(v) => onAssumptionsChange({ ...assumptions, collectionRateDelta: v })}
          />
        </div>
      </div>
    </div>
  );
}
