import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useL } from '../../utils/bi';
import '../../styles/enforcement-details.css';

// Sticky in-page navigation of a long record page: one chip per section (plain anchors, so keyboard and screen readers work without script).
// The chip of the section being read carries aria-current="location". The bar measures the app's own sticky header and publishes two custom
// properties on the page root (--sn-top, --sn-bottom) so that the bar sits under the header and a section heading is never hidden under the bars when it is jumped to.
// items: [{ id, label, count? }] — only sections that are rendered should be listed.
export default function SectionNav({ items, label }) {
  const { L } = useL();
  const ref = useRef(null);
  const [active, setActive] = useState(items[0]?.id || null);
  const key = items.map((i) => i.id).join('|');

  const measure = () => {
    const nav = ref.current; if (!nav) return 0;
    const bar = document.querySelector('.tabbar'); let top = 0;
    if (bar) { const cs = getComputedStyle(bar); if (cs.position === 'sticky') top = bar.offsetHeight + (parseFloat(cs.top) || 0); }
    const root = nav.closest('.rp') || document.documentElement;
    root.style.setProperty('--sn-top', `${top}px`);
    const bottom = top + nav.offsetHeight; root.style.setProperty('--sn-bottom', `${bottom}px`);
    return bottom;
  };

  useLayoutEffect(() => {
    measure();
    const nav = ref.current; const root = nav?.closest('.rp');
    return () => { root?.style.removeProperty('--sn-top'); root?.style.removeProperty('--sn-bottom'); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // scroll-spy: the section being read is the last one whose top has passed the bars
    let raf = 0;
    const spy = () => {
      raf = 0; const line = measure() + 24; let cur = items[0]?.id || null;
      for (const it of items) { const el = document.getElementById(it.id); if (el && el.getBoundingClientRect().top <= line) cur = it.id; }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = items[items.length - 1]?.id || cur;
      setActive(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(spy); };
    spy(); window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (e, id) => {
    const el = document.getElementById(id); if (!el) return;
    e.preventDefault();
    const folded = el.querySelector(':scope > details'); if (folded && !folded.open) folded.open = true; // a folded section opens when it is the target
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true }); setActive(id);
  };

  return (
    <nav className="sn" ref={ref} aria-label={label || L('Sections of this page', 'أقسام هذه الصفحة')}>
      <ul className="sn__list">
        {items.map((it) => (
          <li key={it.id}>
            <a className="sn__link" href={`#${it.id}`} aria-current={active === it.id ? 'location' : undefined} onClick={(e) => go(e, it.id)}>
              {it.label}{it.count != null && <span className="sn__count">{it.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// «تفاصيل» — a long explanatory sentence folded behind a small native disclosure (keyboard accessible, no script), so a section keeps at most one visible callout.
export function Info({ children, summary = null, className = '' }) {
  const { L } = useL();
  return (
    <details className={`ed-info ${className}`}>
      <summary>{summary || L('Details', 'تفاصيل')}</summary>
      <div className="ed-info__body">{children}</div>
    </details>
  );
}
