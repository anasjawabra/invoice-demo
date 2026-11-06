import { trapTab } from '../utils/modalFocus';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAccess } from '../context/AuthContext';
import { filterNav, canOpenSettings } from '../data/accessModel';
import { riyadhToday, DEMO_TODAY, IS_TIME_TRAVEL } from '../data/clock';
import { ToastProvider } from './Toast';
import AppHeader from './header/AppHeader';
import FloatingAssistantButton from './FloatingAssistantButton';
import AnalysisHost from './analysis/AnalysisHost';
import { useFitTables } from '../utils/fitTables';

function Icon({ name }) {
  // Minimal inline icons (no external deps)
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path d="M4 13h7V4H4v9z" />
          <path d="M13 20h7V11h-7v9z" />
          <path d="M13 4h7v5h-7V4z" />
          <path d="M4 20h7v-5H4v5z" />
        </svg>
      );
    case 'invoices':
      return (
        <svg {...common}>
          <path d="M6 2h9l3 3v17l-2-1-2 1-2-1-2 1-2-1-2 1V2z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h6" />
        </svg>
      );
    case 'risk':
      return (
        <svg {...common}>
          <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case 'collection':
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 3 3 6-6" />
        </svg>
      );
    case 'assistant':
      return (
        <svg {...common}>
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" />
        </svg>
      );
    case 'enforcement':
      return (
        <svg {...common}>
          <path d="M12 3v18M7 21h10M5 7h14" />
          <path d="M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7z" />
        </svg>
      );
    case 'invoice-paid':
      return (
        <svg {...common}>
          <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
          <path d="M9 10l2 2 4-4" />
          <path d="M9 16h6" />
        </svg>
      );
    case 'invoice-open':
      return (
        <svg {...common}>
          <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
          <circle cx="12" cy="10" r="2.5" />
          <path d="M12 9v1.2l.8.5M9 16h6" />
        </svg>
      );
    case 'contracts':
      return (
        <svg {...common}>
          <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5z" />
          <path d="M14 2v5h5M9 13h6M9 17h4" />
        </svg>
      );
    case 'chevrons':
      return (<svg {...common} className="sb-chev"><path d="M13 17l-5-5 5-5M18 17l-5-5 5-5" /></svg>);
    case 'data-sources':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="6" rx="8" ry="3" />
          <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
        </svg>
      );
    case 'smart-reports':
      return (
        <svg {...common}>
          <path d="M9 2h6l5 5v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'what-if':
      return (
        <svg {...common}>
          <path d="M4 19h16" />
          <path d="M4 19V7" />
          <path d="M4 15l4-3 4 2 8-7" />
          <path d="M20 7v4M20 7h-4" />
        </svg>
      );
    case 'decision-room':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 2v20" />
          <path d="M2 12h20" />
        </svg>
      );
  }
}

function LayoutInner() {
  const { t, lang } = useI18n();
  // D-12: «today» is read once when the page loads; a tab left open past midnight (Riyadh) says so instead of silently showing yesterday
  const [dayChanged, setDayChanged] = useState(false);
  useEffect(() => { const check = () => { if (!IS_TIME_TRAVEL && riyadhToday() !== DEMO_TODAY) setDayChanged(true); }; check(); const id = setInterval(check, 300000); document.addEventListener('visibilitychange', check); window.addEventListener('focus', check); return () => { clearInterval(id); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); }; }, []);
  const loc = useLocation();
  // after a route change, keyboard / screen-reader focus moves to the new page's heading (not on the first load, and not when only the query changes)
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) { firstRoute.current = false; return undefined; }
    let tries = 0; let t = null;
    const move = () => { const h = document.querySelector('main h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } else if (tries < 12) { tries += 1; t = window.setTimeout(move, 100); } }; // the heading may appear after the data loads
    t = window.setTimeout(move, 30);
    return () => window.clearTimeout(t);
  }, [loc.pathname]);
  useFitTables(); // a table that cannot fit the page becomes stacked cards instead of scrolling sideways
  useEffect(() => { document.addEventListener('keydown', trapTab); return () => document.removeEventListener('keydown', trapTab); }, []);

  // main navigation: «Daily operations» grouping — group labels are plain headings (not links, not collapsible); every page is its own row.
  // Only the pages the person may open are listed (the module of each page: src/data/accessModel.js ROUTE_PERMISSIONS); a group with no page disappears.
  const access = useAccess();
  const groups = useMemo(() => {
    const labels = {
      '/insights': t('nav_insights'), '/decisions': lang === 'ar' ? 'غرفة القرارات' : 'Decision room',
      '/collection': t('nav_collection_worklist'), '/invoices': t('invoices'), '/enforcement': lang === 'ar' ? 'إدارة أوامر التنفيذ' : 'Enforcement orders management',
      '/exclusions': lang === 'ar' ? 'إدارة الاستبعادات' : 'Exclusions management', '/contracts': t('nav_contracts'),
      '/planning': t('nav_planning'), '/smart-reports': lang === 'ar' ? 'التقارير الذكية' : 'Smart reports', '/products': lang === 'ar' ? 'مصادر البيانات' : 'Data Sources'
    };
    return filterNav(access.can).map((g) => ({ key: g.key, label: lang === 'ar' ? g.ar : g.en, items: g.items.map((it) => ({ to: it.to, icon: it.icon, label: labels[it.to] || it.to })) }));
  }, [t, lang, access.can]);
  // system configuration and administration (metric definitions, users, roles) is its own, rarely used area — not one of the daily operational pages
  const settingsTab = { to: '/settings', icon: 'settings', label: t('nav_system_settings') };
  const showSettings = canOpenSettings(access.can);

  // sidebar: collapsible on desktop (the choice is remembered), a drawer on phones (closes on navigation, Escape or a tap outside; focus goes in and back to the button)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('ib_sidebar_collapsed') === '1'; } catch { return false; } });
  const [drawer, setDrawer] = useState(false); const menuBtn = useRef(null); const sbRef = useRef(null);
  const toggleCollapsed = () => setCollapsed((v) => { const n = !v; try { localStorage.setItem('ib_sidebar_collapsed', n ? '1' : '0'); } catch { /* storage unavailable: the choice is just not remembered */ } return n; });
  useEffect(() => { setDrawer(false); }, [loc.pathname]);
  useEffect(() => {
    if (!drawer) return undefined;
    const first = sbRef.current?.querySelector('a'); first?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { setDrawer(false); menuBtn.current?.focus(); } };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);
  // an invoice page keeps the menu item of the list it was opened from (the exclusion register, the uncollected list); opened any other way it stays under the collected list
  const fromList = loc.pathname.startsWith('/invoices/') && ['/exclusions', '/collection'].includes(loc.state?.from?.path) ? loc.state.from.path : null;
  const isActive = (tab, a) => fromList ? tab.to === fromList : a || (tab.to === '/enforcement' && loc.pathname.startsWith('/enforcement-orders')) || (tab.to === '/insights' && loc.pathname.startsWith('/decisions') && access.can('dashboard'));
  const navItem = (tab) => (
    <NavLink key={tab.to} to={tab.to} end={tab.end} title={collapsed ? tab.label : undefined} className={({ isActive: a }) => `sb-item${isActive(tab, a) ? ' active' : ''}`} aria-current={isActive(tab, loc.pathname === tab.to || loc.pathname.startsWith(`${tab.to}/`)) ? 'page' : undefined}>
      <span className="sb-item__icon"><Icon name={tab.icon} /></span>
      <span className="sb-item__text">{tab.label}</span>
    </NavLink>
  );

  const pageTitle = useMemo(() => {
    const p = loc.pathname.replace(/\/+$/, '');
    if (p === '' || p === '/' || p.startsWith('/insights')) return t('nav_insights');
    if (p.startsWith('/settings/metrics')) return t('nav_metrics');
    if (p.startsWith('/settings/users')) return lang === 'ar' ? 'إدارة المستخدمين' : 'User management';
    if (p.startsWith('/settings/roles')) return lang === 'ar' ? 'الأدوار والصلاحيات' : 'Roles and permissions';
    if (p.startsWith('/settings')) return t('nav_system_settings');
    if (p.startsWith('/contracts')) return t('nav_contracts');
    if (p.startsWith('/invoices')) return t('invoices');
    if (p.startsWith('/collection')) return t('nav_collection_worklist');
    if (p.startsWith('/exclusions')) return lang === 'ar' ? 'إدارة الاستبعادات' : 'Exclusions management';
    if (p.startsWith('/products')) return lang === 'ar' ? 'مصادر البيانات' : 'Data Sources';
    if (p.startsWith('/decisions')) return lang === 'ar' ? 'غرفة القرارات' : 'Decision room';
    if (p.startsWith('/smart-reports')) return lang === 'ar' ? 'التقارير الذكية' : 'Smart reports';
    if (p.startsWith('/planning')) return t('nav_planning');
    if (p.startsWith('/enforcement')) return lang === 'ar' ? 'إدارة أوامر التنفيذ' : 'Enforcement orders management';
    if (p.startsWith('/analysis')) return lang === 'ar' ? 'نتيجة التحليل' : 'Analysis result';
    return 'INTELLIBILL';
  }, [loc.pathname, t, lang]);

  // the browser tab names the page (history, bookmarks and screen readers announce it); the product name stays as set in index.html
  const baseTitle = useMemo(() => document.title.split(' | ').pop(), []);
  useEffect(() => { document.title = pageTitle && pageTitle !== 'INTELLIBILL' ? `${pageTitle} | ${baseTitle}` : baseTitle; }, [pageTitle, baseTitle]);

  return (
    <div className="app-shell" data-collapsed={collapsed ? 'true' : undefined}>
      <a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); const el = document.getElementById('main-content'); el?.focus(); el?.scrollIntoView(); }}>{lang === 'ar' ? 'تخطَّ إلى المحتوى' : 'Skip to content'}</a>
      {IS_TIME_TRAVEL && <div className="day-banner" role="status" data-testid="demo-date-banner">{lang === 'ar' ? `وضع العرض: التاريخ مثبّت على ${DEMO_TODAY} (عبر demoToday — للعرض والمراجعة فقط، وليس تاريخ اليوم الفعلي).` : `Demo mode: the date is pinned to ${DEMO_TODAY} (via demoToday — for demonstration and review only, not today's real date).`} <a href="?demoToday=reset">{lang === 'ar' ? 'إلغاء التثبيت' : 'Unpin'}</a></div>}
      {dayChanged && <div className="day-banner" role="status">{lang === 'ar' ? 'تغيّر التاريخ منذ فتح الصفحة؛ الأرقام تخص اليوم السابق.' : 'The date has changed since this page was opened; figures belong to the previous day.'} <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>{lang === 'ar' ? 'تحديث الآن' : 'Refresh now'}</button></div>}
      <div className="bg-fx" />
      <div className="bg-grid" />

      <aside id="app-sidebar" ref={sbRef} className="sidebar" data-open={drawer ? 'true' : undefined}>
        <NavLink to="/" className="side-brand" title={collapsed ? t('side_brand') : undefined}>
          <div className="side-brand__logo">IB</div>
          <div className="side-brand__text">
            <b>{t('side_brand')}</b>
            <span>{t('brand_tagline')}</span>
          </div>
        </NavLink>
        <nav className="sb-nav" aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
          {groups.map((g) => (
            <div key={g.key} className="sb-group" role="group" aria-labelledby={`sb-g-${g.key}`}>
              <p className="sb-group__label" id={`sb-g-${g.key}`}>{g.label}</p>
              {g.items.map(navItem)}
            </div>
          ))}
          <div className="sb-spacer" />
          {showSettings && navItem(settingsTab)}
        </nav>
        <button type="button" className="sb-collapse" onClick={toggleCollapsed} aria-pressed={collapsed} title={collapsed ? (lang === 'ar' ? 'توسيع القائمة' : 'Expand menu') : (lang === 'ar' ? 'طيّ القائمة' : 'Collapse menu')}>
          <span className="sb-item__icon"><Icon name="chevrons" /></span>
          <span className="sb-item__text">{collapsed ? (lang === 'ar' ? 'توسيع القائمة' : 'Expand menu') : (lang === 'ar' ? 'طيّ القائمة' : 'Collapse menu')}</span>
        </button>
      </aside>
      {drawer && <div className="sidebar-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <div className="main">
        <AppHeader drawerOpen={drawer} onToggleDrawer={() => setDrawer((v) => !v)} menuBtnRef={menuBtn} />


        <main className="content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">{lang === 'ar' ? 'بيانات تجريبية اصطناعية — وليست بيانات فعلية للوزارة، عدا صفحات العقود الاستثمارية فتقرأ نسخة محلية من تصديرات بنك البيانات · التواريخ والأوقات بتوقيت الرياض' : 'Synthetic demo data — not the Ministry’s actual data, except the Investment contracts pages, which read a local copy of the Databank exports · dates and times are Asia/Riyadh'}</footer>

        <FloatingAssistantButton />
        <AnalysisHost />
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <ToastProvider>
      <LayoutInner />
    </ToastProvider>
  );
}
