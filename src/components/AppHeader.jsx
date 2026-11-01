import React, { useLayoutEffect, useRef } from 'react';

// Geometry only: keeps sticky/focus clearance in sync with bilingual header wrapping.
export default function AppHeader({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const root = document.documentElement;
    const key = '--ui-header-clearance';
    const previous = root.style.getPropertyValue(key);
    const heightKey = '--ui-header-height';
    const previousHeight = root.style.getPropertyValue(heightKey);
    const update = () => {
      const compact = getComputedStyle(node).display === 'contents';
      const box = (compact ? node.querySelector('.topbar') : node)?.getBoundingClientRect();
      root.style.setProperty(key, `${Math.ceil(box?.height || 0) + 16}px`);
      root.style.setProperty(heightKey, `${Math.max(0, Math.ceil(box?.bottom || 0))}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update); if (previous) root.style.setProperty(key, previous); else root.style.removeProperty(key); if (previousHeight) root.style.setProperty(heightKey, previousHeight); else root.style.removeProperty(heightKey); };
  }, []);
  return <div ref={ref} className="app-header">{children}</div>;
}
