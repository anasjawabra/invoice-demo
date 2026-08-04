import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { ORGS } from '../data/mock';
import { ToastProvider, useToast } from './Toast';

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
    case 'pipeline':
      return (
        <svg {...common}>
          <path d="M4 6h6v6H4V6z" />
          <path d="M14 6h6v6h-6V6z" />
          <path d="M9 9h6" />
          <path d="M4 16h6v4H4v-4z" />
          <path d="M14 16h6v4h-6v-4z" />
          <path d="M9 18h6" />
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
    case 'approvals':
      return (
        <svg {...common}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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
    case 'agents':
      return (
        <svg {...common}>
          <path d="M12 2l8 6-8 6-8-6 8-6z" />
          <path d="M4 14l8 6 8-6" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();

  const org = user?.org || ORGS[0];

  const groups = useMemo(() => {
    return [
      {
        title: t('nav_overview'),
        items: [{ to: '/dashboard', icon: 'dashboard', label: t('dashboard') }]
      },
      {
        title: t('nav_proc'),
        items: [
          { to: '/pipeline', icon: 'pipeline', label: t('process') },
          { to: '/invoices', icon: 'invoices', label: t('invoices') },
          { to: '/approvals', icon: 'approvals', label: t('approvals') }
        ]
      },
      {
        title: t('nav_risk'),
        items: [
          { to: '/risk', icon: 'risk', label: t('risk') },
          { to: '/collection', icon: 'collection', label: t('collection') }
        ]
      },
      {
        title: t('nav_hub'),
        items: [
          { to: '/assistant', icon: 'assistant', label: t('assistant') },
          { to: '/agents', icon: 'agents', label: t('agents') }
        ]
      }
    ];
  }, [t]);

  const pageTitle = useMemo(() => {
    const p = loc.pathname.replace(/\/+$/, '');
    if (p === '' || p === '/' || p === '/dashboard') return t('dashboard');
    if (p.startsWith('/pipeline')) return t('process');
    if (p.startsWith('/invoices')) return t('invoices');
    if (p.startsWith('/approvals')) return t('approvals');
    if (p.startsWith('/risk')) return t('risk');
    if (p.startsWith('/collection')) return t('collection');
    if (p.startsWith('/assistant')) return t('assistant');
    if (p.startsWith('/agents')) return t('agents');
    return 'INTELLIBILL';
  }, [loc.pathname, t]);

  return (
    <div className="app-shell">
      <div className="bg-fx" />
      <div className="bg-grid" />

      <aside className="sidebar">
        <NavLink to="/dashboard" className="side-brand">
          <div className="side-brand__logo">IB</div>
          <div className="side-brand__text">
            <b>{t('side_brand')}</b>
            <span>{t('brand_tagline')}</span>
          </div>
        </NavLink>

        <nav className="side-nav" aria-label="Main navigation">
          {groups.map((g) => (
            <div className="nav-group" key={g.title}>
              <div className="nav-group__title">{g.title}</div>
              {g.items.map((it) => (
                <div className="nav-item" key={it.to}>
                  <NavLink
                    to={it.to}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                    end={it.to === '/dashboard'}
                  >
                    <div className="nav-link__icon">
                      <Icon name={it.icon} />
                    </div>
                    <div className="nav-link__text">{it.label}</div>
                  </NavLink>
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>{t('agents_online')}</span>
          <span className="badge badge--teal">7</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="topbar-title">{pageTitle}</div>
            <div className="pill" title={t('org_scope_note')}>
              <span className="badge badge--indigo">{org.code}</span>
              <span style={{ color: 'var(--txt-dim)', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
                {T(org, 'name')}
              </span>
            </div>
          </div>

          <div className="topbar-right">
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

        <section className="content">
          <Outlet />
        </section>
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
