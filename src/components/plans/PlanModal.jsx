// A small modal dialog for the plans pages (create · copy · archive · restore · reference). role=dialog + aria-modal (Layout's global handler traps Tab), Escape closes, focus goes to the first control
// ([data-autofocus] or the dialog) and returns to the opener on close. Logical CSS only (RTL / LTR); styled by src/styles/plans.css (.pln-*).
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAr } from '../../utils/useAr';

export default function PlanModal({ title, subtitle, onClose, children, footer, size = 'md', dismissible = true }) {
  const { L } = useAr(); const ref = useRef(null); const id = useId(); const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  useEffect(() => {
    const el = ref.current; const prev = opener.current;
    const first = el && el.querySelector('[data-autofocus]'); (first || el)?.focus?.({ preventScroll: true });
    const key = (e) => { if (e.key === 'Escape' && dismissible) { e.stopPropagation(); onClose?.(); } };
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; if (prev && prev.isConnected) prev.focus?.({ preventScroll: true }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const node = (
    <div className="pln-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose?.(); }}>
      <div ref={ref} className={`pln-dialog pln-dialog--${size}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <header className="pln-dialog__head">
          <div><h2 id={id} className="pln-dialog__title">{title}</h2>{subtitle && <div className="pln-dialog__sub">{subtitle}</div>}</div>
          {dismissible && <button type="button" className="pln-x" onClick={onClose} aria-label={L('إغلاق', 'Close')}>×</button>}
        </header>
        <div className="pln-dialog__body">{children}</div>
        {footer && <footer className="pln-dialog__foot">{footer}</footer>}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}
