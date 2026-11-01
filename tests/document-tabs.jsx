// Real document viewer with two read-only fixtures. No records are written.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from '../src/context/I18nContext';
import OrderDocuments from '../src/components/revenue/OrderDocuments';
import '../src/styles/variables.css';
import '../src/styles/global.css';
import '../src/styles/revenue.css';
import '../src/styles/record.css';
import '../src/styles/app-foundation.css';
import '../src/styles/ui-completion.css';

const order = { docs: [
  { id: 'manual-entry', kind: 'manual', extraction: { refs: [{ value: '177-1000000001' }] } },
  { id: 'fixture-second-document', kind: 'manual', extraction: { refs: [{ value: '177-1000000002' }] } }
] };
function Fixture() {
  const { lang, setLang } = useI18n();
  return <main className="content ui-section-stack" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <h1>Document tabs keyboard regression</h1>
    <button className="btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>Toggle direction</button>
    <OrderDocuments order={order} rev={{ canReview: false }} />
  </main>;
}
createRoot(document.getElementById('root')).render(<I18nProvider><Fixture /></I18nProvider>);
