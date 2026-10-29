import React from 'react';

export default function ReportExportFeedback({ state, owner, L }) {
  if (!state.error || state.error.owner !== owner) return null;
  const format = state.error.kind.toUpperCase();
  return <div className="sr-export-feedback" role="alert">
    <span>{L(`تعذّر تصدير ملف ${format}. أعد المحاولة؛ إذا استمرت المشكلة، حدّث الصفحة.`, `Could not export ${format}. Try again; if the problem persists, refresh this page.`)}</span>
    <button type="button" className="btn btn-sm" disabled={!!state.exporting} onClick={state.retry}>{L('إعادة المحاولة', 'Retry')}</button>
  </div>;
}
