import { useEffect } from 'react';

// Presentation-only clearance for the existing floating controls. Content order,
// grids and task state stay unchanged; a focused control can scroll clear of them.
export function useFloatingFocus() {
  useEffect(() => {
    const root = document.documentElement;
    const properties = ['--notification-clearance', '--floating-viewport-clearance'];
    const previous = properties.map((key) => root.style.getPropertyValue(key));
    const observed = new Set();
    let frame = 0;
    const set = (key, value) => {
      const text = `${Math.max(0, Math.ceil(value))}px`;
      if (root.style.getPropertyValue(key) !== text) root.style.setProperty(key, text);
    };
    const visible = (el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && (typeof el.checkVisibility === 'function'
        ? el.checkVisibility({ checkVisibilityCSS: true }) : getComputedStyle(el).visibility !== 'hidden');
    };
    const update = () => {
      frame = 0;
      const toast = document.querySelector('.toast-stack');
      const notices = toast?.querySelector('.toast') && visible(toast);
      const box = notices ? toast.getBoundingClientRect() : null;
      set('--notification-clearance', box ? window.innerHeight - box.top + 12 : 0);
      const floats = [...document.querySelectorAll('.floating-assistant, .dock, .toast-stack')];
      for (const el of observed) if (!floats.includes(el)) { observer?.unobserve(el); observed.delete(el); }
      for (const el of floats) if (!observed.has(el)) { observed.add(el); observer?.observe(el); }
      const painted = floats.filter(visible);
      set('--floating-viewport-clearance', painted.reduce((n, el) => Math.max(n, window.innerHeight - el.getBoundingClientRect().top + 8), 0));

      // Modal contents have their own scroller and sit above ordinary notices.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const active = document.activeElement;
      if (!active || active === document.body || active === root) return;
      if (active.closest('.floating-assistant, .dock, .toast-stack')) return;
      const rect = active.getBoundingClientRect();
      const covering = painted.filter((el) => {
        const r = el.getBoundingClientRect();
        const left = Math.max(0, r.left, rect.left), right = Math.min(window.innerWidth, r.right, rect.right);
        const top = Math.max(0, r.top, rect.top), bottom = Math.min(window.innerHeight, r.bottom, rect.bottom);
        if (left >= right || top >= bottom) return false;
        const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
        return !!hit && el.contains(hit) && !active.contains(hit);
      });
      if (!covering.length) return;
      const bottom = Math.min(...covering.map((el) => el.getBoundingClientRect().top)) - 8;
      const delta = rect.bottom - bottom;
      if (delta > 0) window.scrollBy({ top: Math.ceil(delta), behavior: 'instant' });
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    mutations.observe(root, { attributes: true, attributeFilter: ['dir'] });
    document.addEventListener('focusin', schedule);
    document.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect(); mutations.disconnect();
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      properties.forEach((key, i) => { if (previous[i]) root.style.setProperty(key, previous[i]); else root.style.removeProperty(key); });
    };
  }, []);
}
