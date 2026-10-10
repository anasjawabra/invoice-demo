import React, { useCallback, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useL } from './bi';

// Where a record page was opened FROM, so «back» returns to that exact place: the same list with the same filters, sorting, page and scroll position.
//  * RecordLink adds { from: { path, search, label } } to the navigation state (and remembers the scroll position of the page it leaves).
//  * A list page reads its own remembered state only when it is re-entered by a return (state.restore) or by the browser's Back button (POP);
//    opening the list afresh from the menu starts clean, exactly as before.
const LS = (k) => `ib_listmem_${k}`;
const SC = (path) => `ib_scroll_${path}`;

export function readListMemory(key, restore) {
  if (!restore) return null;
  try { const raw = sessionStorage.getItem(LS(key)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function writeListMemory(key, snapshot) { try { sessionStorage.setItem(LS(key), JSON.stringify(snapshot)); } catch { /* storage unavailable */ } }
export function useShouldRestore() {
  const loc = useLocation(); const type = useNavigationType();
  return type === 'POP' || !!loc.state?.restore;
}
// re-applies the remembered scroll position once the list has its rows
export function useRestoreScroll(ready) {
  const loc = useLocation(); const restore = useShouldRestore(); const done = useRef(false);
  useEffect(() => {
    if (!restore || done.current || !ready) return;
    done.current = true;
    let y = 0; try { y = Number(sessionStorage.getItem(SC(loc.pathname + loc.search))) || 0; } catch { /* none */ }
    if (y > 0) { // the page may still be growing (rows arrive, sections load): try again for a moment until the saved position is reachable
      let n = 0; const tick = () => { window.scrollTo(0, y); n += 1; if (n < 40 && Math.abs(window.scrollY - y) > 4) window.setTimeout(tick, 150); };
      window.setTimeout(tick, 0); // (not requestAnimationFrame: it is paused while the tab is in the background)
    }
  }, [ready, restore, loc.pathname, loc.search]);
}
const OR = (path) => `ib_origin_${path}`;
// a record page remembers where it was itself opened from, so that coming BACK to it (from a record it opened) keeps its own way back
const saveScroll = (loc) => {
  try {
    sessionStorage.setItem(SC(loc.pathname + loc.search), String(window.scrollY));
    if (loc.state?.from) sessionStorage.setItem(OR(loc.pathname + loc.search), JSON.stringify(loc.state.from));
    else sessionStorage.removeItem(OR(loc.pathname + loc.search)); // opened afresh (menu, address): no stale origin
  } catch { /* none */ }
};
const readOrigin = (path) => { try { const raw = sessionStorage.getItem(OR(path)); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; } };

export function usePageLabel() {
  const { L } = useL(); const loc = useLocation();
  const p = loc.pathname.replace(/\/+$/, '');
  const rec = /^\/(invoices|enforcement-orders|contracts)\/([^/]+)/.exec(p);
  if (rec) return decodeURIComponent(rec[2]);
  if (p.startsWith('/invoices')) return L('Invoices', 'سجل الفواتير');
  if (p.startsWith('/enforcement')) return L('Enforcement management', 'إدارة التنفيذ');
  if (p.startsWith('/contracts')) return L('Contracts', 'العقود');
  if (p.startsWith('/noncollection')) return L('Noncollection and exclusions', 'عدم التحصيل والاستبعادات');
  if (p.startsWith('/collection')) return L('Collection worklist', 'قائمة التحصيل');
  if (p.startsWith('/risk')) return L('Data quality and risks', 'جودة البيانات والمخاطر');
  if (p.startsWith('/data-sources')) return L('Data sources', 'مصادر البيانات');
  if (p.startsWith('/planning')) return L('Planning', 'التخطيط');
  if (p.startsWith('/analysis')) return L('Analysis result', 'نتيجة التحليل');
  return L('Dashboards and reports', 'لوحة المعلومات والتقارير');
}

// a link to a record page that remembers where the reader came from
export function RecordLink({ to, children, label, ...rest }) {
  const loc = useLocation(); const pageLabel = usePageLabel();
  const onClick = (e) => { saveScroll(loc); rest.onClick?.(e); };
  return <Link {...rest} to={to} state={{ from: { path: loc.pathname, search: loc.search, label: label || pageLabel } }} onClick={onClick}>{children}</Link>;
}
// imperative version (rows that open a record when clicked)
export function useOpenRecord() {
  const loc = useLocation(); const nav = useNavigate(); const label = usePageLabel();
  return useCallback((to) => { saveScroll(loc); nav(to, { state: { from: { path: loc.pathname, search: loc.search, label } } }); }, [loc, nav, label]);
}
// the contextual return target of a record page: where it was opened from, or the given fallback list
export function useReturnTarget(fallback) {
  const loc = useLocation(); const nav = useNavigate();
  const from = loc.state?.from || null;
  const target = from ? { path: from.path + (from.search || ''), label: from.label, restore: true } : { path: fallback.path, label: fallback.label, restore: false };
  const go = useCallback(() => nav(target.path, { state: { restore: true, from: readOrigin(target.path) } }), [nav, target.path]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...target, go };
}
