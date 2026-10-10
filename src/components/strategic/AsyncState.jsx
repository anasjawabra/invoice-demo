// Loading / empty / error states with a retry, so a failed request never looks like zero.
import React from 'react';
import { useAr } from '../../utils/useAr';

export function Skeleton({ height = 90 }) {
  return <div className="st-skel" style={{ height }} aria-hidden="true" />;
}
export function AsyncBlock({ state, onRetry, empty = false, emptyText, height = 120, children }) {
  const { L } = useAr();
  const errBox = state?.error ? (
    <div className="rv-callout rv-callout--bad" role="alert">
      <b>{L('تعذّر تحميل هذا القسم', 'This section could not be loaded')}</b>
      <div style={{ fontSize: 13, marginTop: 4 }}>{String(state.error.message || state.error)}</div>
      {state.data && <div style={{ fontSize: 13, marginTop: 4 }}>{L('ما يظهر أدناه من الاختيار السابق وليس من المرشحات الحالية.', 'What is shown below is from the previous selection, not the current filters.')}</div>}
      {onRetry && <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={onRetry}>{L('إعادة المحاولة', 'Retry')}</button>}
    </div>
  ) : null;
  if (state?.error && !state?.data) return errBox;
  if (!state || (state.loading && !state.data)) return <div role="status" aria-label={L('جارٍ التحميل', 'Loading')}><Skeleton height={height} /></div>;
  if (empty) return <div className="rv-empty">{emptyText || L('البيانات غير متاحة لهذا الاختيار.', 'No data for this selection.')}</div>;
  return (
    <>
      {errBox}
      {state.loading && !state.error && <div className="muted" role="status" style={{ fontSize: 12 }}>{L('جارٍ تحديث هذا القسم…', 'Updating this section…')}</div>}
      <div style={state.error ? { opacity: 0.55 } : undefined}>{children}</div>
    </>
  );
}
