// Leaving a page with unsaved changes asks first. BrowserRouter has no blocker API (useBlocker needs a data router), so the guard covers every way out the page can see:
//   · closing / reloading the tab (beforeunload)
//   · a click on any in-app link (the sidebar, breadcrumbs …): a CAPTURE listener on the document stops it before React Router handles it and remembers the destination
//   · a programmatic leave the page itself starts (switching plan in the selector): `request(to)`
// Not covered (documented limit): the browser Back / Forward buttons — a popstate cannot be cancelled once the router has reacted.
//   const guard = useUnsavedGuard({ dirty, navigate });  → { pending (a path | null), request(to), proceed(), stay() }
import { useCallback, useEffect, useRef, useState } from 'react';

/** the in-app destination of a click on an anchor (a path + query) or null when it must not be intercepted (external, new tab, modified click, same page) */
export function internalTarget(a, here = typeof window !== 'undefined' ? window.location : { origin: '', pathname: '' }, e = {}) {
  if (!a || !a.getAttribute) return null;
  const href = a.getAttribute('href'); if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return null;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return null;
  if (a.target && a.target !== '_self') return null; if (a.hasAttribute('download')) return null;
  let u; try { u = new URL(href, here.origin || 'http://x.local'); } catch { return null; }
  if (here.origin && u.origin !== here.origin) return null;
  if (u.pathname === here.pathname) return null; // the same page (a filter or a hash change) never loses the working copy
  return `${u.pathname}${u.search}${u.hash}`;
}

export default function useUnsavedGuard({ dirty, navigate }) {
  const [pending, setPending] = useState(null); const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  useEffect(() => {
    if (!dirty) return undefined;
    const before = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    const click = (e) => {
      if (!dirtyRef.current || e.defaultPrevented) return;
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      const to = internalTarget(a, window.location, e); if (!to) return;
      e.preventDefault(); e.stopPropagation(); setPending(to);
    };
    window.addEventListener('beforeunload', before); document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', before); document.removeEventListener('click', click, true); };
  }, [dirty]);
  const request = useCallback((to) => { if (dirtyRef.current) setPending(to); else navigate(to); }, [navigate]);
  const proceed = useCallback(() => { const to = pending; dirtyRef.current = false; setPending(null); if (to) navigate(to); }, [pending, navigate]);
  const stay = useCallback(() => setPending(null), []);
  return { pending, request, proceed, stay };
}
