// ActiveFilterChips — removable chips ONLY for meaningful non-default selections.
//   <ActiveFilterChips chips={[{ key, label, value, onRemove }]} notice="أُزيلت البلدية لأن الأمانة تغيّرت" onDismissNotice={…} lang="ar" />
// Never an «All …» chip and never the period (it lives in PeriodSelect). `notice` is the visible, aria-live announcement of a dependent selection that was cleared.
import React from 'react';

export default function ActiveFilterChips({ chips = [], notice = '', onDismissNotice, lang = 'ar' }) {
  const ar = lang === 'ar';
  if (!chips.length && !notice) return null;
  return (
    <div className="ft-chips" aria-label={ar ? 'الفلاتر المطبّقة' : 'Applied filters'} role="group">
      {chips.map((c) => (
        <span key={c.key} className="ft-chip">
          <em>{c.label}</em> <bdi>{c.value}</bdi>
          <button type="button" className="ft-chip__x" aria-label={ar ? `إزالة فلتر ${c.label}: ${c.value}` : `Remove filter ${c.label}: ${c.value}`} onClick={c.onRemove}>×</button>
        </span>
      ))}
      <span className="ft-notice ft-notice--inline" role="status" aria-live="polite">{notice}{notice && onDismissNotice ? <button type="button" className="ft-chip__x" aria-label={ar ? 'إخفاء الإشعار' : 'Dismiss the notice'} onClick={onDismissNotice}>×</button> : null}</span>
    </div>
  );
}
