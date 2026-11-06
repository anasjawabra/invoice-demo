import React from 'react';

// Inline icons of the header (20 px, 2 px rounded stroke — the same style as the sidebar icons; no external icon package).
export default function HIcon({ name, size = 20 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };
  switch (name) {
    case 'menu': return <svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    case 'more': return <svg {...p}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></svg>;
    case 'close': return <svg {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'chevron': return <svg {...p}><path d="M6 9l6 6 6-6" /></svg>;
    case 'sun': return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>;
    case 'moon': return <svg {...p}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" /></svg>;
    case 'logout': return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>;
    default: return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>;
  }
}
