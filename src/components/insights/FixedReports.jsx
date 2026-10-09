// «التقارير الثابتة» — predefined reports that open directly (no prompt) under the shared filters and export exactly what is shown.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRevenue } from '../../context/RevenueContext';
import { useAsync } from '../../utils/useAsync';
import { useAr } from '../../utils/useAr';
import ReportView from '../smart/ReportView';
import { ToDateFigure } from '../revenue/RevenueUI';
import { AsyncBlock } from '../strategic/AsyncState';
import { FIXED_REPORTS, FIXED_GROUPS } from '../../data/fixedReports';
import { buildReportModel } from '../../data/reportModel';
import { generateFinance, financeCompatible } from '../../data/syntheticFinance';
import { forecastReceipts } from '../../data/revenueOutlook';
import { buildDecisionCards } from '../../data/revenueInsights';
import { exportModelToDocx, exportModelToXlsx, exportModelToPptx } from '../../utils/exportReportModel';

function ReportBody({ def }) {
  const rev = useRevenue(); const { L, B, lang } = useAr();
  const { snapshot, prevSnapshot, comparison, data, cfg, targets } = rev; const s = rev.scopeEff; const today = cfg.cutoff;
  const [exporting, setExporting] = useState(''); const [rt, setRt] = useState(0); const [exportErr, setExportErr] = useState(''); const [exportDone, setExportDone] = useState('');
  const needs = def.sections;
  const financeOk = financeCompatible(s, rev.org); const fin = useMemo(() => generateFinance(today), [today]);
  const scopeBase = useMemo(() => ({ amanah: s.amanah, source: s.source, scopeType: s.scopeType, muni: s.muni, status: s.status }), [s.amanah, s.source, s.scopeType, s.muni, s.status]);
  const X = useAsync(async () => {
    const sc = { from: s.from, to: s.to, ...scopeBase };
    const [cash, bridge, fyRec, forecast] = await Promise.all([
      needs.includes('trends') ? data.series(sc, { asOf: s.to < today ? s.to : today }) : null,
      needs.includes('quality') ? data.bridge({ ...scopeBase, from: '2000-01-01', to: today }) : null,
      needs.includes('budget') && financeOk ? data.series({ amanah: 'all', source: 'all', from: `${today.slice(0, 4)}-01-01`, to: today }, { asOf: today }).then((r) => r.values.reduce((t, v) => t + v, 0)) : null,
      needs.includes('executive') ? forecastReceipts(data, scopeBase, cfg, { targets }) : null
    ]);
    return { cash, bridge, fyRec, forecast };
  }, [data, JSON.stringify(scopeBase), s.from, s.to, today, def.key, financeOk, cfg, targets, rt]);
  const yoy = comparison?.comparable && comparison.basis === 'same_period_last_year';
  const compare = def.compare !== 'none' && yoy ? 'prev_year' : 'none';
  const model = useMemo(() => {
    if (!X.data) return null;
    const spec = { title: B({ ar: def.ar, en: def.en }), preset: rev.scope.preset, scope: { from: s.from, to: s.to, ...scopeBase }, compare, depth: 'summary', sections: def.sections };
    const forecast = X.data.forecast || { ready: false, reasonNotReady: { ar: 'غير مطلوب في هذا التقرير', en: 'not needed in this report' } };
    return buildReportModel({ spec, lang, out: { snapshot, forecast, targetPos: null, achievement: null, coverage: null, cards: needs.includes('executive') ? buildDecisionCards(snapshot, { enforcementCases: rev.cases }) : [], anomalies: [] }, prev: compare === 'prev_year' ? prevSnapshot : null, compare, prevScope: prevSnapshot?.scope, cash: X.data.cash, bridge: X.data.bridge, targets, cases: rev.cases, meta: rev.meta, finance: fin, financeOk, fyReceiptsYtd: X.data.fyRec });
  }, [X.data, snapshot, prevSnapshot, compare, lang, def.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const doExport = async (kind) => { if (!model || exporting) return; setExporting(kind); setExportErr(''); setExportDone(''); try { if (kind === 'docx') await exportModelToDocx(model); if (kind === 'xlsx') exportModelToXlsx(model); if (kind === 'pptx') await exportModelToPptx(model); setExportDone({ docx: 'Word', xlsx: 'Excel', pptx: 'PowerPoint' }[kind]); } catch (e) { setExportErr(String(e.message || e)); } finally { setExporting(''); } };
  return (
    <div className="card st-card">
      <div className="sr-card__bar">
        <div className="muted" style={{ fontSize: 13 }}>{B(def.purpose)}</div>
        <div className="sr-card__actions">{[['docx', 'Word'], ['xlsx', 'Excel'], ['pptx', 'PowerPoint']].map(([k, n]) => <button key={k} type="button" className="btn btn-sm" disabled={!model || snapshot.totals.count === 0} aria-disabled={!!exporting || undefined} onClick={() => doExport(k)}>{exporting === k ? L('جارٍ التصدير…', 'Exporting…') : `${L('تصدير', 'Export')} ${n}`}</button>)}</div>
      </div>
      <ToDateFigure snapshot={snapshot} />
      <div className="muted" role="status" style={{ fontSize: 13, marginBlock: exportDone ? 0 : -6 }}>{exportDone ? L(`تم إنشاء ملف ${exportDone} وتنزيله من المتصفح.`, `The ${exportDone} file was created and handed to the browser's download.`) : ''}</div>
      {exportErr && <div className="rv-callout rv-callout--bad" role="alert">{L('تعذّر التصدير: ', 'Export failed: ')}{exportErr}</div>}
      {def.compare !== 'none' && !yoy && <div className="rv-callout">{L('لا توجد مقارنة مكافئة لهذه الفترة (العام السابق خارج نطاق البيانات)؛ تُعرض الأرقام دون مقارنة.', 'No equivalent comparison for this period (last year is outside the data); figures are shown without comparison.')}</div>}
      {snapshot.totals.count === 0 ? <div className="rv-empty">{L('لا فواتير في هذا الاختيار؛ البيانات غير متاحة وليست صفراً.', 'No invoices in this selection; the data is unavailable, not zero.')}</div>
        : <AsyncBlock state={X} onRetry={() => setRt((n) => n + 1)} height={260}>{model && <ReportView model={model} />}</AsyncBlock>}
    </div>
  );
}

export default function FixedReports({ reportKey, setReport }) {
  const { L, B, ar } = useAr();
  const def = FIXED_REPORTS.find((r) => r.key === reportKey);
  // After the user opens or leaves a report the control they pressed is gone: put keyboard focus on the new heading (not on first load).
  const head = useRef(null); const seen = useRef(reportKey);
  useEffect(() => { if (seen.current !== reportKey) { seen.current = reportKey; const a = document.activeElement; if (!a || a === document.body) head.current?.focus(); } }, [reportKey]);
  if (def) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setReport(null)}>{ar ? '→' : '←'} {L('كل التقارير الثابتة', 'All fixed reports')}</button>
          <h2 ref={head} tabIndex={-1} style={{ margin: 0, fontSize: 18 }}>{B({ ar: def.ar, en: def.en })}</h2>
          <select aria-label={L('تقرير آخر', 'Another report')} className="select" value={def.key} onChange={(e) => setReport(e.target.value)}>{FIXED_REPORTS.map((r) => <option key={r.key} value={r.key}>{B({ ar: r.ar, en: r.en })}</option>)}</select>
        </div>
        <ReportBody def={def} key={def.key} />
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {FIXED_GROUPS.map((g) => (
        <section key={g.ar} style={{ display: 'grid', gap: 8 }} aria-label={B(g)}>
          <h2 ref={g === FIXED_GROUPS[0] ? head : undefined} tabIndex={g === FIXED_GROUPS[0] ? -1 : undefined} className="rv-sec-title" style={{ margin: 0 }}>{B(g)}</h2>
          <div className="st-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {g.keys.map((k) => FIXED_REPORTS.find((r) => r.key === k)).map((r) => (
              <button key={r.key} type="button" className="card st-card sr-fixed" onClick={() => setReport(r.key)}>
                <b>{B({ ar: r.ar, en: r.en })}</b>
                <span className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>{B(r.purpose)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
