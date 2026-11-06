import { useEffect, useState } from 'react';
import { COMPACT_QUERY } from './headerModel';

// True while the viewport is in the compact (phone / drawer) range. The header renders ONE layout at a time, so the page never holds two copies of a control.
export function useCompact() {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(COMPACT_QUERY).matches : false);
  const [compact, setCompact] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(COMPACT_QUERY);
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on));
  }, []);
  return compact;
}

// Closes a popover on Escape (focus returns to its button) or on a pointer press outside it.
export function useDismiss(open, close, rootRef, buttonRef) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); buttonRef?.current?.focus(); } };
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open, close, rootRef, buttonRef]);
}
