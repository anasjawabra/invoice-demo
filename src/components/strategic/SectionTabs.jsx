import React, { useCallback, useEffect, useRef } from 'react';

// A compact horizontal tab bar (WAI-ARIA tabs, manual activation). The panels stay mounted and are only hidden, so what a person typed or selected in a section survives a tab switch.
//  * tabs: [{ id, label }] in visual order (first = start edge: the right in Arabic)
//  * panels carry the SAME ids as the tabs' targets, so existing hashes (#outlook …) keep meaning; the tab id is `${idPrefix}-tab-${id}`
//  * roving focus: only the selected tab is in the Tab sequence; Arrow keys follow the visual direction, Home/End jump to the ends, Enter/Space activate (a native button)
//  * the selected / focused tab is revealed inside the bar by scrolling the bar itself — never the page
export const tabIdOf = (prefix, id) => `${prefix}-tab-${id}`;

export default function SectionTabs({ tabs, active, onSelect, label, rtl, idPrefix = 'plan' }) {
  const listRef = useRef(null);

  const reveal = useCallback((el) => {
    const list = listRef.current; if (!list || !el) return;
    const c = list.getBoundingClientRect(); const r = el.getBoundingClientRect(); const pad = 12;
    let delta = 0;
    if (r.left < c.left + pad) delta = r.left - (c.left + pad); else if (r.right > c.right - pad) delta = r.right - (c.right - pad);
    if (!delta) return;
    list.scrollLeft += delta; // instant: no motion to tone down, and it works while the tab is in the background. scrollLeft grows toward the right in both directions, so the same delta works in RTL. Only the bar scrolls — never the page
  }, []);

  useEffect(() => { reveal(document.getElementById(tabIdOf(idPrefix, active))); }, [active, idPrefix, reveal]);

  const focusTab = (i) => { const t = tabs[(i + tabs.length) % tabs.length]; const el = document.getElementById(tabIdOf(idPrefix, t.id)); el?.focus({ preventScroll: true }); reveal(el); };
  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => tabIdOf(idPrefix, t.id) === e.target.id); if (i < 0) return;
    const next = rtl ? 'ArrowLeft' : 'ArrowRight'; const prev = rtl ? 'ArrowRight' : 'ArrowLeft'; // the visual direction: in Arabic the first tab is on the right
    if (e.key === next) { e.preventDefault(); focusTab(i + 1); }
    else if (e.key === prev) { e.preventDefault(); focusTab(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusTab(0); }
    else if (e.key === 'End') { e.preventDefault(); focusTab(tabs.length - 1); }
  };

  return (
    <div className="pt-bar">
      <div className="pt-list" role="tablist" aria-label={label} aria-orientation="horizontal" ref={listRef} onKeyDown={onKeyDown}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} type="button" role="tab" id={tabIdOf(idPrefix, t.id)} className={`pt-tab${on ? ' is-active' : ''}`} aria-selected={on} aria-controls={t.id} tabIndex={on ? 0 : -1}
              onClick={() => onSelect(t.id)} onFocus={(e) => reveal(e.currentTarget)}>{t.label}</button>
          );
        })}
      </div>
    </div>
  );
}
