// DataInfo — the «i» control with the data-status details that used to crowd the filter row (data cutoff, source, basis, rule version, reconciliation).
//   <DataInfo title="حالة البيانات" rows={[{ label, value, tone? }]} lang="ar" summary="البيانات حتى 5 نوفمبر 2026" />
// The cutoff is information about the DATA, never part of the selected period.
import React, { useRef, useState } from 'react';
import { Popover, useUid } from './overlay';

export default function DataInfo({ title, rows = [], lang = 'ar', summary }) {
  const id = useUid('ft-i'); const [open, setOpen] = useState(false); const wrap = useRef(null); const trigger = useRef(null); const ar = lang === 'ar';
  const t = title || (ar ? 'حالة البيانات' : 'Data status');
  return (
    <div className="ft-pop-wrap ft-info-wrap" ref={wrap}>
      <button ref={trigger} type="button" className="ft-info" aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-pop`} aria-label={summary ? `${t}: ${summary}` : t} title={summary || t} onClick={() => setOpen((v) => !v)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} wrapRef={wrap} triggerRef={trigger} id={`${id}-pop`} label={t} align="end" className="ft-info-pop">
        <b>{t}</b>
        <dl className="ft-info-list">{rows.filter((r) => r && r.value != null && r.value !== '').map((r, i) => <div key={i}><dt>{r.label}</dt><dd className={r.tone ? `is-${r.tone}` : ''}>{r.value}</dd></div>)}</dl>
      </Popover>
    </div>
  );
}
