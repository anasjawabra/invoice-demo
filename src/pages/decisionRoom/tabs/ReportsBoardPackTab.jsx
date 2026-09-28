import React, { useMemo } from 'react';
import { buildCFOBoardPackReport } from '../../../data/cfoBoardPackReport';

export default function ReportsBoardPackTab({ t, money, model }) {
  const report = useMemo(() => buildCFOBoardPackReport(model, t, money), [model, t, money]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card card-pad">
        <div className="page-head" style={{ marginBottom: 6 }}>
          <div>
            <div className="page-title" style={{ fontSize: 18 }}>{t('cfo_boardpack_title')}</div>
            <div className="page-sub">{t('cfo_boardpack_sub')}</div>
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="page-title" style={{ fontSize: 16 }}>{t('cfo_boardpack_preview_title')}</div>
        <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>{t('cfo_boardpack_generated_note')}</p>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{report.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>{report.period} · {report.generatedOn}</div>
          <span className="badge badge--indigo" style={{ marginTop: 6 }}>{report.healthScore} · {report.healthBand}</span>
        </div>

        <div className="grid grid-4" style={{ gap: 10, marginTop: 14 }}>
          {report.keyMetrics.map((m) => (
            <div className="card card-pad" key={m.label}>
              <div className="kpi__value" dir="ltr" style={{ fontSize: 16 }}>{m.value}</div>
              <div className="kpi__label">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="table">
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
