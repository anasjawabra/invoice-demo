import React, { useLayoutEffect, useRef } from 'react';

// Geometry only: keeps sticky/focus clearance in sync with bilingual header wrapping.
export default function AppHeader({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    const root = document.documentElement;
    const key = '--ui-header-clearance';
    const previous = root.style.getPropertyValue(key);
    const update = () => {
      const compact = getComputedStyle(node).display === 'contents';
      const box = (compact ? node.querySelector('.tabbar') : node)?.getBoundingClientRect();
      root.style.setProperty(key, `${Math.ceil(box?.height || 0) + 16}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); if (previous) root.style.setProperty(key, previous); else root.style.removeProperty(key); };
  }, []);
  return <div ref={ref} className="app-header">{children}</div>;
}
