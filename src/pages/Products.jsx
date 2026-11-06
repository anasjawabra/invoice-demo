import React, { useRef, useState, useEffect } from 'react';
import { useL } from '../utils/bi';
import { DATA_SOURCES, SOURCE_MESSAGE } from '../data/dataSources';

// مصادر البيانات — the directory of data sources. Read-only: one card per source (its services inside the card) and what its data will contain once integrated.
// Until an integration is connected, a click only shows the message below; there are no filters, figures, sample records or lists. Later, a click will open the source's own data list.
export default function Products() {
  const { L, B } = useL();
  const [open, setOpen] = useState(null); const dlg = useRef(null);
  useEffect(() => { const d = dlg.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  const src = DATA_SOURCES.find((s) => s.id === open);
  return (
    <div className="rv-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{L('Data Sources', 'مصادر البيانات')}</h1>
          <div className="page-sub">{L('The sources whose data will become available through integration.', 'المصادر التي ستتاح بياناتها عبر الربط.')}</div>
        </div>
      </div>

      <ul className="ds-grid" aria-label={L('Data sources', 'مصادر البيانات')}>
        {DATA_SOURCES.map((s) => (
          <li key={s.id}>
            <button type="button" className="ds-card" onClick={() => setOpen(s.id)} aria-haspopup="dialog">
              <span className="ds-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg></span>
              <span className="ds-card__name">{B(s.name)}</span>
              <span className="ds-card__desc">{B(s.desc)}</span>
              {s.services.length > 0 && <span className="ds-card__svc"><span className="ds-card__svc-h">{L('Services', 'الخدمات')}</span>{s.services.map((v) => <span key={v.en} className="ds-card__chip">{B(v)}</span>)}</span>}
            </button>
          </li>))}
      </ul>

      <dialog ref={dlg} className="ds-dialog" aria-labelledby="ds-dlg-title" onClose={() => setOpen(null)} onClick={(e) => { if (e.target === dlg.current) setOpen(null); }}>
        {src && (
          <div className="ds-dialog__body">
            <h2 id="ds-dlg-title" className="ds-dialog__title">{B(src.name)}</h2>
            <p className="ds-dialog__msg">{B(SOURCE_MESSAGE)}</p>
            <div className="ds-dialog__actions"><button type="button" className="btn btn-primary" autoFocus onClick={() => setOpen(null)}>{L('Close', 'إغلاق')}</button></div>
          </div>)}
      </dialog>
    </div>
  );
}
