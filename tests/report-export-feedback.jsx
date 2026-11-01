// Isolated failure/retry fixture: never included by the application entry point.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import useReportExport from '../src/utils/useReportExport';
import ReportExportFeedback from '../src/components/smart/ReportExportFeedback';
import { localize } from '../src/utils/zh';
import '../src/styles/variables.css';
import '../src/styles/global.css';
import '../src/styles/app-foundation.css';
import '../src/styles/ui-completion.css';

function Fixture() {
  const calls = useRef([]);
  const complete = useRef(null);
  const [revision, setRevision] = useState(1);
  const [lang, setLang] = useState('en');
  const [done, setDone] = useState(false);
  const state = useReportExport(async (kind, model) => {
    calls.current.push({ kind, revision: model.revision });
    if (calls.current.length === 1) throw new Error('Simulated file preparation failure');
    await new Promise((resolve) => { complete.current = resolve; });
    setDone(true);
  });
  const L = (_ar, en) => localize(en, lang);
  return <main className="content ui-section-stack">
    <h1>Export failure and retry</h1>
    <button className="btn" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}>Toggle language</button>
    <button className="btn" disabled={!!state.exporting} onClick={() => state.download('xlsx', { revision }, 'report-1')}>Export Excel</button>
    <button className="btn" onClick={() => setRevision((n) => n + 1)}>Change displayed report</button>
    <ReportExportFeedback state={state} owner="report-1" L={L} />
    <ReportExportFeedback state={state} owner="other-report" L={L} />
    {state.exporting && <button className="btn" onClick={() => complete.current?.()}>Finish export</button>}
    <output>{JSON.stringify({ calls: calls.current, revision, pending: state.exporting, done })}</output>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
