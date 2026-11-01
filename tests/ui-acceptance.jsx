// Test-only entry: renders the real application or exceptional states, never shipped in main.jsx.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Link } from 'react-router-dom';
import axe from 'axe-core';
import App from '../src/App';
import { I18nProvider, useI18n } from '../src/context/I18nContext';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { AuthProvider } from '../src/context/AuthContext';
import { RevenueProvider } from '../src/context/RevenueContext';
import { AsyncBlock } from '../src/components/strategic/AsyncState';
import { RecordState } from '../src/components/record/RecordPage';
import AnalysisProgress, { AnalysisModal } from '../src/components/analysis/AnalysisProgress';
import { trapTab } from '../src/utils/modalFocus';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '../src/styles/variables.css';
import '../src/styles/global.css';
import '../src/styles/ai-process.css';
import '../src/styles/revenue.css';
import '../src/styles/record.css';
import '../src/styles/smart-reporting.css';
import '../src/styles/app-foundation.css';
import '../src/styles/ui-completion.css';
import '../src/styles/chart-theme';
const params = new URLSearchParams(location.search);
const states = ['queued', 'running', 'completed', 'completed_with_limitations', 'failed', 'cancelled'];
const bi = (en) => ({ en, ar: { 'Test analysis': 'تحليل تجريبي', 'Read source': 'قراءة المصدر', 'Calculate': 'الحساب', 'Review': 'المراجعة' }[en] || en });
async function auditSettledPage() {
  await document.fonts.ready;
  // Measure final rendered colors, rather than an intermediate route-entry fade.
  const finite = document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations));
  await Promise.all(finite.map(a => a.finished.catch(() => {})));
  return axe.run(document.querySelector('#application'), { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } });
}
function task(status) {
  return { id: `fixture-${status}`, title: bi('Test analysis'), status, kind: 'invoice', cancellable: true,
    scope: { from: '2026-01-01', to: '2026-10-28', amanah: 'all', source: 'all' },
    stages: ['Read source', 'Calculate', 'Review'].map((label, i) => ({ id: String(i), label: bi(label), detail: bi(label), active: bi(label), status: i === 0 ? 'completed' : i === 1 ? ({ running: 'active', failed: 'failed', cancelled: 'cancelled', queued: 'upcoming' }[status] || 'completed') : status.startsWith('completed') ? 'completed' : 'not_run' })),
    warnings: status === 'completed_with_limitations' ? [{ text: bi('Some source data is unavailable.') }] : [],
    result: status.startsWith('completed') ? {} : null };
}
function Gallery() {
  const [modal, setModal] = useState(false);
  React.useEffect(() => { document.addEventListener('keydown', trapTab); return () => document.removeEventListener('keydown', trapTab); }, []);
  return <main className="content" id="main-content"><div className="st-page">
    <h1>UI acceptance: exceptional states</h1>
    <section className="ui-section-stack"><h2>Loading / empty / errors</h2>
      <AsyncBlock state={{ loading: true }} />
      <AsyncBlock state={{ data: {} }} empty />
      <AsyncBlock state={{ error: new Error('Source unavailable') }} onRetry={() => {}} />
      <RecordState notFound kind="Invoice" backTo={{ path: '/', label: 'Return' }} />
      <RecordState error={new Error('Source unavailable')} onRetry={() => {}} />
    </section>
    <button className="btn btn-primary" onClick={() => setModal(true)}>Open analysis modal</button>
    {states.map(s => <section key={s} className="ui-section-stack" aria-label={s}><h2>{s}</h2><AnalysisProgress task={task(s)} onCancel={() => {}} onClose={() => {}} onView={() => {}} /></section>)}
    {modal && <AnalysisModal task={task('completed')} onClose={() => setModal(false)} onView={() => setModal(false)} />}
  </div></main>;
}
function Harness() {
  const { setLang } = useI18n(); const { toggleTheme } = useTheme(); const [result, setResult] = useState('');
  return <>
    <div id="application">{params.has('states') ? <Gallery /> : <AuthProvider><RevenueProvider><App /></RevenueProvider></AuthProvider>}</div>
    <nav aria-label="Acceptance tools" onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', bottom: 0, insetInlineStart: 0, zIndex: 99999, display: 'flex', gap: 4, padding: 4, background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <button className="btn btn-sm" onClick={() => setLang('en')}>Test EN</button><button className="btn btn-sm" onClick={() => setLang('ar')}>Test AR</button><button className="btn btn-sm" onClick={toggleTheme}>Test theme</button>
      <button className="btn btn-sm" onClick={async () => { setResult('running'); const r = await auditSettledPage(); setResult(JSON.stringify(r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })))); }}>Audit accessibility</button>
      <output id="audit-status" data-audit-state={result === 'running' ? 'running' : result ? 'done' : 'idle'}>{result === 'running' ? 'Auditing' : result ? 'Done' : 'Ready'}</output>
    </nav><pre id="audit-result" hidden>{result}</pre>
  </>;
}
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[params.get('route') || '/insights']}><ThemeProvider><I18nProvider><Harness /></I18nProvider></ThemeProvider></MemoryRouter>);
