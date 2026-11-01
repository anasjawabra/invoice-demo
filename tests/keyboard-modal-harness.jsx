import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../src/context/I18nContext';
import { AnalysisModal } from '../src/components/analysis/AnalysisProgress';
import { trapTab } from '../src/utils/modalFocus';
const calls = { close: 0, background: 0 }; let sequence = 0;
const fresh = () => ({ id: `keyboard-${++sequence}`, kind: 'noncollection', status: 'running', title: { en: 'Keyboard test', ar: 'اختبار' }, stages: [], scope: { from: '2026-01-01', to: '2026-10-25', amanah: 'all', source: 'all' }, cancellable: true });
function Harness() {
  const [task, setTask] = useState(null);
  window.keyboardHarness = { calls, finish: () => setTask((t) => ({ ...t, status: 'completed', result: {} })) };
  return <I18nProvider><button id="start" onClick={() => setTask(fresh())}>Start</button><AnalysisModal task={task} onCancel={() => {}} onBackground={() => { calls.background++; setTask(null); }} onClose={() => { calls.close++; setTask(null); }} onView={() => {}} /></I18nProvider>;
}
document.addEventListener('keydown', trapTab);
createRoot(document.getElementById('root')).render(<Harness />);
