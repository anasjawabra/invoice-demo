import React, { useMemo } from 'react';
import { buildCFOBoardPackReport } from '../../../data/cfoBoardPackReport';

export default function ReportsBoardPackTab({ t, money, model }) {
  const report = useMemo(() => buildCFOBoardPackReport(model, t, money), [model, t, money]);

  return (
    <div className="grid" style={{ gap: 'var(--spacing-lg)' }}>
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 'var(--spacing-xs)' }}>
          <div>
            <div className="page-title" style={{ fontSize: 'var(--text-lg)' }}>{t('cfo_boardpack_title')}</div>
            <div className="page-sub">{t('cfo_boardpack_sub')}</div>
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>{t('print')}</button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_boardpack_preview_title')}</div>
        <p className="muted" style={{ fontSize: 'var(--text-2xs)', marginTop: 'var(--spacing-xs)' }}>{t('cfo_boardpack_generated_note')}</p>

        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{report.title}</div>
          <div className="muted" style={{ fontSize: 'var(--text-xs)' }}>{report.period} · {report.generatedOn}</div>
          <span className="badge badge--indigo" style={{ marginTop: 'var(--spacing-xs)' }}>{report.healthScore} · {report.healthBand}</span>
        </div>

        <div className="grid grid-4" style={{ gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
          {report.keyMetrics.map((m) => (
            <div className="card card-pad" key={m.label}>
              <div className="kpi__value" dir="ltr" style={{ fontSize: 'var(--text-md)' }}>{m.value}</div>
              <div className="kpi__label">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="table-wrap" style={{ marginTop: 'var(--spacing-lg)' }} tabIndex={0}>
          <table className="table" aria-label={t('cfo_boardpack_preview_title')}>
            <thead><tr><th>{t('cfo_risk_title')}</th><th>{t('cfo_risk_impact')}</th><th>{t('cfo_ap_issue')}</th></tr></thead>
            <tbody>
              {report.risks.map((r, i) => (
                <tr key={i}>
                  <td>{r.category} · {r.severity}</td>
                  <td dir="ltr">{r.impact}</td>
                  <td>{r.action}</td>
                </tr>
              ))}
              {report.risks.length === 0 && <tr><td colSpan={3} className="muted">{t('cfo_risk_empty')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
