import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import AppIcon from './AppIcon';
import UISymbol from './UISymbol';

const MOBILE_NAV = '(max-width: 900px)';

export default function AppSidebar({ tabs, settingsTab, open, setOpen }) {
  const { lang } = useI18n();
  const location = useLocation();
  const dialog = useRef(null);
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_NAV).matches);
  const label = (en, zh, ar) => lang === 'ar' ? ar : lang === 'zh' ? zh : en;
  const navigationLabel = label('Main navigation', '主导航', 'التنقل الرئيسي');

  useEffect(() => {
    const media = window.matchMedia(MOBILE_NAV);
    const update = () => { setMobile(media.matches); setOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [setOpen]);

  useEffect(() => { setOpen(false); }, [location.pathname, location.search, setOpen]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (mobile && open && !node.open) node.showModal();
    else if ((!mobile || !open) && node.open) node.close();
  }, [mobile, open]);

  useEffect(() => {
    if (!mobile || !open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mobile, open]);

  const link = (tab) => {
    const related = (tab.to === '/enforcement' && location.pathname.startsWith('/enforcement-orders'))
      || (tab.to === '/insights' && location.pathname.startsWith('/decisions'));
    const active = related || location.pathname === tab.to || location.pathname.startsWith(`${tab.to}/`);
    return <Link key={tab.to} to={tab.to} aria-current={active ? 'page' : undefined} onClick={() => setOpen(false)} className={`app-sidebar__link${active ? ' active' : ''}`}>
      <AppIcon name={tab.icon} /><span>{tab.label}</span>
    </Link>;
  };

  const contents = <>
    {mobile && <div className="app-sidebar__heading"><b>{navigationLabel}</b><button type="button" className="btn app-sidebar__close" aria-label={label('Close navigation', '关闭导航', 'إغلاق التنقل')} onClick={() => setOpen(false)} autoFocus><UISymbol name="close" size={20} /></button></div>}
    <nav className="app-sidebar__nav" aria-label={navigationLabel}>
      <div className="app-sidebar__sections">
        <div className="app-sidebar__group">
          <div className="app-sidebar__label">{label('Workspace', '工作区', 'مساحة العمل')}</div>
          {tabs.slice(0, 6).map(link)}
        </div>
        <div className="app-sidebar__group">
          <div className="app-sidebar__label">{label('Operations', '业务操作', 'العمليات')}</div>
          {tabs.slice(6).map(link)}
        </div>
      </div>
      <div className="app-sidebar__footer">{link(settingsTab)}</div>
    </nav>
  </>;

  return mobile
    ? <dialog id="app-navigation" ref={dialog} className="app-sidebar app-sidebar--drawer" role="dialog" aria-modal="true" aria-label={navigationLabel} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>{contents}</dialog>
    : <aside id="app-navigation" className="app-sidebar">{contents}</aside>;
}
