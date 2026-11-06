// NoResults — the "nothing matches" state of a filtered list: says what is happening and offers a reset. It NEVER widens the scope by itself and never shows 0 as if it were data.
//   <NoResults lang title hint onReset resetLabel? />
import React from 'react';

export default function NoResults({ lang = 'ar', title, hint, onReset, resetLabel }) {
  const ar = lang === 'ar';
  return (
    <div className="ft-noresults" role="status" aria-live="polite">
      <b>{title || (ar ? 'لا توجد نتائج مطابقة لهذه التصفية' : 'No results match these filters')}</b>
      {hint ? <span className="muted">{hint}</span> : null}
      {onReset ? <button type="button" className="btn btn-sm btn-primary" onClick={onReset}>{resetLabel || (ar ? 'مسح الفلاتر' : 'Clear filters')}</button> : null}
    </div>
  );
}
