// A small «i» information tooltip: hover shows it, a click (or Enter / Space) PINS it open and a second click unpins it, keyboard focus opens it, Esc or an outside click closes it; it is described by role="tooltip" and reachable by keyboard.
import React, { useEffect, useId, useRef, useState } from 'react';

export default function InfoTip({ label, children }) {
  const [hover, setHover] = useState(false); const [pinned, setPinned] = useState(false); const open = hover || pinned; const id = useId(); const ref = useRef(null);
  const close = () => { setHover(false); setPinned(false); };
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('mousedown', away); return () => document.removeEventListener('mousedown', away);
  }, [open]);
  return (
    <span className="il-tip" ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
      <button type="button" className="il-tip__btn" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setPinned((v) => !v)} onFocus={(e) => { if (e.target.matches && e.target.matches(':focus-visible')) setPinned(true); }} onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget)) close(); }}>i</button>
      {open && <span id={id} role="tooltip" className="il-tip__pop">{children}</span>}
    </span>
  );
}
