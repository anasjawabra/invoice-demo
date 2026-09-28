import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ORGS } from '../data/mock';
import { ToastProvider, useToast } from './Toast';
import FloatingAssistantButton from './FloatingAssistantButton';

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
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
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
  const { t, lang, setLang, T, isRtl } = useI18n();
  const { user, orgScoped, logout, switchOrg } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();

  const org = user?.org || ORGS[0];

  const tabs = useMemo(
    () => [
      { to: '/dashboard', icon: 'dashboard', label: t('dashboard'), end: true },
      { to: '/invoices', icon: 'invoices', label: t('invoices') },
      { to: '/risk', icon: 'risk', label: t('risk') },
      { to: '/collection', icon: 'collection', label: t('collection') },
      { to: '/decision-room', icon: 'decision-room', label: t('decision_room_nav') },
      { to: '/assistant', icon: 'assistant', label: t('assistant') },
      { to: '/smart-reports', icon: 'smart-reports', label: t('smart_reports_nav') },
      { to: '/what-if', icon: 'what-if', label: t('what_if_nav') }
    ],
    [t]
  );

  const pageTitle = useMemo(() => {
    const p = loc.pathname.replace(/\/+$/, '');
    if (p === '' || p === '/' || p === '/dashboard') return t('dashboard');
    if (p.startsWith('/invoices')) return t('invoices');
    if (p.startsWith('/risk')) return t('risk');
    if (p.startsWith('/collection')) return t('collection');
    if (p.startsWith('/decision-room')) return t('decision_room_nav');
    if (p.startsWith('/assistant')) return t('assistant');
    if (p.startsWith('/smart-reports')) return t('smart_reports_nav');
    if (p.startsWith('/what-if')) return t('what_if_nav');
    if (p.startsWith('/sanad-orders')) return t('sanad_orders_title');
    return 'INTELLIBILL';
  }, [loc.pathname, t]);

  return (
    <div className="app-shell">
      <div className="bg-fx" />
      <div className="bg-grid" />

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <NavLink to="/dashboard" className="side-brand">
              <div className="side-brand__logo">IB</div>
              <div className="side-brand__text">
                <b>{t('side_brand')}</b>
                <span>{t('brand_tagline')}</span>
              </div>
            </NavLink>
            <div className="topbar-title">{pageTitle}</div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="btn btn-ghost btn-sm theme-toggle"
              onClick={toggleTheme}
              aria-label={t('theme_toggle')}
              title={t('theme_toggle')}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>

            <div className="pill" aria-label="Language">
              <button
                type="button"
                className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setLang('en');
                  toast.info(t('switched_en'));
                }}
              >
                EN
              </button>
              <button
                type="button"
                className={`btn btn-sm ${lang === 'zh' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setLang('zh');
                  toast.info(t('switched_zh'));
                }}
              >
                中文
              </button>
              <button
                type="button"
                className={`btn btn-sm ${lang === 'ar' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setLang('ar');
                  toast.info(t('switched_ar'));
                }}
              >
                العربية
              </button>
            </div>

            {orgScoped ? (
              <select
                className="select"
                style={{ width: 270 }}
                value={org.id}
                onChange={(e) => {
                  switchOrg(e.target.value);
                  toast.success(t('org_switched'));
                }}
                aria-label={t('org_label')}
              >
                {ORGS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {T(o, 'name')} · {t(o.tier === 'central' ? 'tier_central' : 'tier_local')}
                  </option>
                ))}
              </select>
            ) : (
              <div
                className="pill org-consolidated"
                role="group"
                tabIndex={0}
                aria-label={t('data_scope_consolidated')}
                title={t('data_scope_consolidated')}
                style={{ maxWidth: 340, gap: 8 }}
              >
                <span className="badge badge--indigo">{org.code}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 200
                  }}
                >
                  {T(org, 'name')}
                </span>
                <span className="badge badge--teal" style={{ whiteSpace: 'nowrap' }}>
                  {t('all_orgs')}
                </span>
              </div>
            )}

            <button
              type="button"
              className="btn"
              onClick={() => toast.info(t('notif_msg'))}
              aria-label={t('notif')}
              title={t('notif')}
            >
              <Icon name="bell" />
              <span style={{ fontSize: 12 }}>{t('notif')}</span>
            </button>

            <div className="pill" style={{ gap: 10 }}>
              <div
                className="badge badge--teal"
                style={{ width: 34, height: 34, borderRadius: 14, paddingInline: 0, display: 'grid', placeItems: 'center' }}
                title={T(user, 'name')}
              >
                {user?.avatar || 'U'}
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 850, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                  {T(user, 'name')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--txt-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                  {T(user, 'role')}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  logout();
                  nav('/login', { replace: true });
                }}
                title={t('logout')}
              >
                {t('logout')}
              </button>
            </div>

            {isRtl ? (
              <span className="badge" title="RTL">RTL</span>
            ) : null}
          </div>
        </header>

        <nav className="tabbar" aria-label="Main navigation">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
            >
              <span className="tab__icon">
                <Icon name={tab.icon} />
              </span>
              <span className="tab__text">{tab.label}</span>
            </NavLink>
          ))}
        </nav>

        <section className="content">
          <Outlet />
        </section>

        <FloatingAssistantButton />
      </main>
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
