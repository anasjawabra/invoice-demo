import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { useRevenue } from '../context/RevenueContext';
import { readHistory, writeHistory, historyScope } from './historyMemory';
const EntryContext = createContext(null);
export const useHistoryEntry = () => useContext(EntryContext);

// PUSH/POP gets its own component state. Query-consuming REPLACE retains the entry.
export function HistoryEntryPage({ children }) {
  const loc = useLocation(); const type = useNavigationType(); const rev = useRevenue();
  const namespace = `${rev.user?.user || 'anonymous'}|${rev.org.id}`;
  const holder = useRef(null); const [, redraw] = useState(0);
  const last = holder.current;
  if (!last || last.namespace !== namespace || last.locationKey !== loc.key) {
    const marker = window.history.state?.ibEntry;
    const id = (type === 'REPLACE' && last?.path === loc.pathname ? last.id : marker) || (loc.key === 'default' ? (window.crypto?.randomUUID?.() || `entry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`) : loc.key);
    const same = last?.id === id && last.namespace === namespace;
    const restore = type === 'POP' || !!loc.state?.restore || (!last && !!marker);
    const seed = loc.state?.restoreEntryId;
    const scope = !same && restore ? historyScope(readHistory(namespace, id, 'scope') ?? (seed ? readHistory(namespace, seed, 'scope') : null)) : null;
    holder.current = { id, namespace, restoreFrom: seed, path: loc.pathname, locationKey: loc.key, restore: same ? last.restore : restore, legacy: same ? last.legacy : !marker && type === 'POP', ready: same ? last.ready : !scope, scope, scroll: same ? last.scroll : (readHistory(namespace, id, 'scroll') ?? (seed ? readHistory(namespace, seed, 'scroll') : null)) };
  }
  const entry = holder.current; const ready = entry.ready;
  useLayoutEffect(() => {
    window.history.replaceState({ ...window.history.state, ibEntry: entry.id }, '', window.location.href);
    if (!ready) { rev.restoreHistoryScope(entry.scope); entry.ready = true; redraw((n) => n + 1); }
  }, [entry.id, loc.key, ready]);
  useEffect(() => { if (ready) { const scope = historyScope(rev.scope); if (scope) writeHistory(namespace, entry.id, 'scope', scope); } }, [namespace, entry.id, ready, rev.scope]);
  useLayoutEffect(() => {
    let y = window.scrollY; let frame = 0; let dirty = false;
    const save = () => { frame = 0; if (!dirty) return; writeHistory(namespace, entry.id, 'scroll', y); };
    const onScroll = () => { dirty = true; y = window.scrollY; if (!frame) frame = window.requestAnimationFrame(save); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.cancelAnimationFrame(frame); save(); };
  }, [namespace, entry.id]);
  return <EntryContext.Provider value={entry}>{ready ? React.cloneElement(children, { key: `${namespace}|${entry.id}` }) : <div role="status">{rev.user && document.documentElement.lang === 'ar' ? 'جارٍ استعادة العرض…' : 'Restoring view…'}</div>}</EntryContext.Provider>;
}
