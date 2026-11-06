// The modal shell shared by the dashboard's ONE details panel (a side sheet; a full-screen sheet on phones) and the optional heatmap dialog:
// role="dialog" aria-modal, focus moves in, Tab is trapped, Esc and the backdrop close it, focus returns to the opener, the page behind does not scroll.
import React, { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

export default function Overlay({ open, onClose, title, closeLabel, side = false, id, children, className = '' }) {
  const ref = useRef(null); const prev = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    prev.current = document.activeElement; const root = ref.current;
    const heading = root && root.querySelector('[data-autofocus]'); (heading || (root && root.querySelector(FOCUSABLE)))?.focus();
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !root) return;
      const els = [...root.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!els.length) { e.preventDefault(); return; }
      const a = els[0]; const z = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === a || !root.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !root.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; if (prev.current && prev.current.focus && document.contains(prev.current)) prev.current.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`ins-ov${side ? ' ins-ov--side' : ''}`}>
      <div className="ins-ov__backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={ref} id={id} className={`ins-ov__box ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="ins-ov__head"><h2 className="ins-ov__title" tabIndex={-1} data-autofocus>{title}</h2><button type="button" className="ft-x ins-ov__x" aria-label={closeLabel} onClick={onClose}>×</button></div>
        <div className="ins-ov__body">{children}</div>
      </div>
    </div>
  );
}
