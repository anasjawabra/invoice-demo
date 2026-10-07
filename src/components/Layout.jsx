import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ORGS } from '../data/mock';
import { ToastProvider, useToast } from './Toast';
import FloatingAssistantButton from './FloatingAssistantButton';
import UIIcon from './UIIcon';
import {
  Analytics01Icon,
  ChartLineData01Icon,
  Chatting01Icon,
  DashboardSquare01Icon,
  File02Icon,
  Invoice01Icon,
  Moon02Icon,
  Notification03Icon,
  SecurityCheckIcon,
  Sun03Icon,
  Target01Icon
} from '@hugeicons/core-free-icons';

const ICONS = {
  dashboard: DashboardSquare01Icon,
  invoices: Invoice01Icon,
  risk: SecurityCheckIcon,
  collection: ChartLineData01Icon,
  assistant: Chatting01Icon,
  'smart-reports': File02Icon,
  'what-if': Analytics01Icon,
  'decision-room': Target01Icon,
  bell: Notification03Icon,
  sun: Sun03Icon,
  moon: Moon02Icon
};

function Icon({ name }) {
  return <UIIcon icon={ICONS[name] || DashboardSquare01Icon} />;
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
      <a className="skip-link" href="#main-content">
        {t('skip_to_content')}
      </a>
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
              aria-pressed={theme === 'dark'}
              aria-label={t('theme_toggle')}
              data-tooltip={t('theme_toggle')}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>

            <select
              className="select language-select"
              value={lang}
              aria-label={t('language_label')}
              onChange={(event) => {
                const nextLang = event.target.value;
                setLang(nextLang);
                toast.info(t(nextLang === 'ar' ? 'switched_ar' : nextLang === 'zh' ? 'switched_zh' : 'switched_en'));
              }}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="ar">العربية</option>
            </select>

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
                data-tooltip={t('data_scope_consolidated')}
                style={{ maxWidth: 340, gap: 'var(--spacing-md)' }}
              >
                <span className="badge badge--indigo">{org.code}</span>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
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
              data-tooltip={t('notif')}
            >
              <Icon name="bell" />
              <span style={{ fontSize: 'var(--text-xs)' }}>{t('notif')}</span>
            </button>

            <div className="pill" style={{ gap: 'var(--spacing-md)' }}>
              <div
                className="badge badge--teal"
                style={{ width: 34, height: 34, borderRadius: 14, paddingInline: '0', display: 'grid', placeItems: 'center' }}
                data-tooltip={T(user, 'name')}
                aria-label={T(user, 'name')}
                role="img"
                tabIndex={0}
              >
                {user?.avatar || 'U'}
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                  {T(user, 'name')}
                </span>
                <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--txt-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
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
                data-tooltip={t('logout')}
              >
                {t('logout')}
              </button>
            </div>

            {isRtl ? (
              <span className="badge" aria-label={t('a11y_rtl_layout')}>RTL</span>
            ) : null}
          </div>
        </header>

        <nav className="tabbar" aria-label={t('a11y_main_navigation')}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              aria-label={tab.label}
              className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
            >
              <span className="tab__icon">
                <Icon name={tab.icon} />
              </span>
              <span className="tab__text">{tab.label}</span>
            </NavLink>
          ))}
        </nav>

        <section className="content" id="main-content" tabIndex={-1}>
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
