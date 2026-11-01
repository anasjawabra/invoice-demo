import React, { useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import AppIcon from './AppIcon';

export default function AppNavigation({ tabs, settingsTab }) {
  const { lang } = useI18n();
  const { pathname } = useLocation();
  const ref = useRef(null);

  // Keep the current module visible after navigation, language or viewport changes.
  useLayoutEffect(() => {
    const node = ref.current;
    const revealActive = () => {
      const active = node.querySelector('[aria-current="page"]');
      if (!active) return;
      const bounds = node.getBoundingClientRect();
      const link = active.getBoundingClientRect();
      const inset = 12;
      if (link.left < bounds.left + inset) node.scrollLeft += link.left - bounds.left - inset;
      else if (link.right > bounds.right - inset) node.scrollLeft += link.right - bounds.right + inset;
    };
    revealActive();
    const observer = new ResizeObserver(revealActive);
    observer.observe(node);
    for (const link of node.children) observer.observe(link);
    return () => observer.disconnect();
  }, [pathname, lang]);

  return (
    <nav ref={ref} id="app-navigation" className="app-navigation" aria-label={lang === 'ar' ? 'التنقل الرئيسي' : lang === 'zh' ? '主导航' : 'Main navigation'} tabIndex={0}>
      {[...tabs, settingsTab].map(tab => {
        const related = (tab.to === '/enforcement' && pathname.startsWith('/enforcement-orders'))
          || (tab.to === '/insights' && pathname.startsWith('/decisions'));
        return <NavLink key={tab.to} to={tab.to} aria-current={related ? 'page' : undefined} className={({ isActive }) => `app-navigation__link${isActive || related ? ' active' : ''}`}>
          <AppIcon name={tab.icon} /><span>{tab.label}</span>
        </NavLink>;
      })}
    </nav>
  );
}
