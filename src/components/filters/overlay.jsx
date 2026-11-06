// Overlay primitives of the filter toolbar: useMediaQuery, useDismiss (outside click + Esc, focus returns to the trigger), Popover (anchored, desktop) and Drawer (bottom sheet, mobile).
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 720px)';
export function useMediaQuery(query = MOBILE_QUERY) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query); const on = () => setM(mq.matches); on();
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, [query]);
  return m;
}

// closes on a mouse/touch press outside `wrapRef` and on Escape; Escape returns the focus to the trigger
export function useDismiss(open, wrapRef, onClose, triggerRef) {
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose(false); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(true); if (triggerRef && triggerRef.current) triggerRef.current.focus(); } };
    document.addEventListener('mousedown', down); document.addEventListener('touchstart', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('touchstart', down); document.removeEventListener('keydown', key); };
  }, [open, wrapRef, onClose, triggerRef]);
}

// <Popover open onClose triggerRef id label align>…</Popover> — the parent supplies `wrapRef` (a `.ft-pop-wrap` element that contains BOTH the trigger and the popover)
// If the panel would leave the viewport on its preferred side (RTL / LTR, a trigger near an edge), it opens on the opposite side instead.
export function Popover({ open, onClose, wrapRef, triggerRef, id, label, align = 'start', wide = false, children, className = '' }) {
  useDismiss(open, wrapRef, onClose, triggerRef);
  const ref = useRef(null); const [flip, setFlip] = useState(false);
  useLayoutEffect(() => {
    if (!open) { setFlip(false); return; }
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect(); const vw = document.documentElement.clientWidth;
    if (r.left < 8 || r.right > vw - 8) setFlip(true);
  }, [open]);
  if (!open) return null;
  const side = flip ? (align === 'end' ? 'start' : 'end') : align;
  return <div ref={ref} id={id} role="dialog" aria-label={label} className={`ft-pop ft-pop--${side}${wide ? ' ft-pop--wide' : ''} ${className}`}>{children}</div>;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
// bottom sheet: modal, focus is trapped, Escape and the backdrop close it, the page behind does not scroll
export function Drawer({ open, onClose, title, closeLabel, footer, children, id }) {
  const ref = useRef(null); const prev = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    prev.current = document.activeElement; const root = ref.current;
    const first = root && root.querySelector(FOCUSABLE); if (first) first.focus();
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !root) return;
      const els = [...root.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!els.length) return; const a = els[0]; const z = els[els.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; if (prev.current && prev.current.focus) prev.current.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ft-drawer-wrap">
      <div className="ft-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={ref} id={id} className="ft-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ft-drawer__head"><b>{title}</b><button type="button" className="ft-x" aria-label={closeLabel} onClick={onClose}>×</button></div>
        <div className="ft-drawer__body">{children}</div>
        {footer && <div className="ft-drawer__foot">{footer}</div>}
      </div>
    </div>
  );
}

// stable DOM ids (React 18 useId has «:» characters: made safe for aria / CSS selectors)
export function useUid(prefix = 'ft') { return `${prefix}-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`; }
