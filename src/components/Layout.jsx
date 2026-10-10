import { trapTab } from '../utils/modalFocus';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useRevenue } from '../context/RevenueContext';
import { useTheme } from '../context/ThemeContext';
import { ORGS } from '../data/mock';
import { riyadhToday, DEMO_TODAY, IS_TIME_TRAVEL } from '../data/clock';
import { ToastProvider, useToast } from './Toast';
import FloatingAssistantButton from './FloatingAssistantButton';
import AnalysisHost from './analysis/AnalysisHost';

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
  const rev = useRevenue();
  // D-12: «today» is read once when the page loads; a tab left open past midnight (Riyadh) says so instead of silently showing yesterday
  const [dayChanged, setDayChanged] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false); // phones: language, theme, organisation, notifications and the account sit behind one button
  useEffect(() => { const check = () => { if (!IS_TIME_TRAVEL && riyadhToday() !== DEMO_TODAY) setDayChanged(true); }; check(); const id = setInterval(check, 300000); document.addEventListener('visibilitychange', check); window.addEventListener('focus', check); return () => { clearInterval(id); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); }; }, []);
  const { user, orgScoped, logout, switchOrg } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const nav = useNavigate();
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
  useEffect(() => { document.addEventListener('keydown', trapTab); return () => document.removeEventListener('keydown', trapTab); }, []);

  const org = user?.org || ORGS[0];

  const tabs = useMemo(
    () => [
      { to: '/insights', icon: 'dashboard', label: t('nav_insights') },
      { to: '/planning', icon: 'decision-room', label: t('nav_planning') },
      { to: '/enforcement', icon: 'collection', label: lang === 'ar' ? 'إدارة التنفيذ' : lang === 'zh' ? '执行管理' : 'Enforcement management' },
      { to: '/invoices', icon: 'invoices', label: t('invoices') },
      { to: '/noncollection', icon: 'what-if', label: t('nav_noncollection') },
      { to: '/collection', icon: 'collection', label: t('nav_collection_worklist') },
      { to: '/contracts', icon: 'invoices', label: t('nav_contracts') },
      { to: '/risk', icon: 'risk', label: t('nav_risk_quality') },
      { to: '/data-sources', icon: 'smart-reports', label: t('nav_data_sources') },
      { to: '/metrics', icon: 'dashboard', label: t('nav_metrics') }
    ],
    [t, lang]
  );

  const primaryTabs = tabs.slice(0, 3); const opsTabs = tabs.slice(3); // the three management areas: dashboards & reports · planning · enforcement management
  const opsActive = opsTabs.some((t2) => loc.pathname === t2.to || loc.pathname.startsWith(`${t2.to}/`));
  const [opsOpen, setOpsOpen] = useState(false); const opsRef = React.useRef(null); const opsBtn = React.useRef(null);
  useEffect(() => { setOpsOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!opsOpen) return undefined;
    const onDoc = (e) => { if (opsRef.current && !opsRef.current.contains(e.target)) setOpsOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpsOpen(false); opsBtn.current?.focus(); } };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [opsOpen]);
  const opsLabel = lang === 'ar' ? 'وحدات تشغيلية' : lang === 'zh' ? '运营模块' : 'Operations';

  const pageTitle = useMemo(() => {
    const p = loc.pathname.replace(/\/+$/, '');
    if (p === '' || p === '/' || p.startsWith('/insights')) return t('nav_insights');
    if (p.startsWith('/noncollection')) return t('nav_noncollection');
    if (p.startsWith('/data-sources')) return t('nav_data_sources');
    if (p.startsWith('/contracts')) return t('nav_contracts');
    if (p.startsWith('/metrics')) return t('nav_metrics');
    if (p.startsWith('/invoices')) return t('invoices');
    if (p.startsWith('/risk')) return t('nav_risk_quality');
    if (p.startsWith('/collection')) return t('nav_collection_worklist');
    if (p.startsWith('/planning')) return t('nav_planning');
    if (p.startsWith('/enforcement')) return lang === 'ar' ? 'إدارة التنفيذ' : lang === 'zh' ? '执行管理' : 'Enforcement management';
    if (p.startsWith('/analysis')) return lang === 'ar' ? 'نتيجة التحليل' : 'Analysis result';
    return 'INTELLIBILL';
  }, [loc.pathname, t, lang]);

  // the browser tab names the page (history, bookmarks and screen readers announce it); the product name stays as set in index.html
  const baseTitle = useMemo(() => document.title.split(' | ').pop(), []);
  useEffect(() => { document.title = pageTitle && pageTitle !== 'INTELLIBILL' ? `${pageTitle} | ${baseTitle}` : baseTitle; }, [pageTitle, baseTitle]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); const el = document.getElementById('main-content'); el?.focus(); el?.scrollIntoView(); }}>{lang === 'ar' ? 'تخطَّ إلى المحتوى' : 'Skip to content'}</a>
      {IS_TIME_TRAVEL && <div className="day-banner" role="status" data-testid="demo-date-banner">{lang === 'ar' ? `وضع العرض: التاريخ مثبّت على ${DEMO_TODAY} (عبر demoToday — للعرض والمراجعة فقط، وليس تاريخ اليوم الفعلي).` : `Demo mode: the date is pinned to ${DEMO_TODAY} (via demoToday — for demonstration and review only, not today's real date).`} <a href="?demoToday=reset">{lang === 'ar' ? 'إلغاء التثبيت' : 'Unpin'}</a></div>}
      {dayChanged && <div className="day-banner" role="status">{lang === 'ar' ? 'تغيّر التاريخ منذ فتح الصفحة؛ الأرقام تخص اليوم السابق.' : 'The date has changed since this page was opened; figures belong to the previous day.'} <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>{lang === 'ar' ? 'تحديث الآن' : 'Refresh now'}</button></div>}
      <div className="bg-fx" />
      <div className="bg-grid" />

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <NavLink to="/insights" className="side-brand">
              <div className="side-brand__logo">IB</div>
              <div className="side-brand__text">
                <b>{t('side_brand')}</b>
                <span>{t('brand_tagline')}</span>
              </div>
            </NavLink>
            <details className="demo-note">
              <summary>{lang === 'ar' ? 'بيانات تجريبية' : 'Demo data'}</summary>
              <div role="note">{lang === 'ar' ? `بيانات اصطناعية وليست بيانات الوزارة الفعلية${rev.meta?.size === 'compact' ? ` (عينة مضغوطة: ${rev.meta.counts?.invoicesTotal ?? ''} فاتورة)` : ''}. التواريخ والأوقات بتوقيت الرياض.` : `Synthetic data, not the Ministry’s actual data${rev.meta?.size === 'compact' ? ` (compact sample: ${rev.meta.counts?.invoicesTotal ?? ''} invoices)` : ''}. Dates and times are Asia/Riyadh.`}</div>
            </details>
          </div>

          <button type="button" className="btn btn-sm topbar-toggle" aria-expanded={moreOpen} aria-controls="topbar-controls" onClick={() => setMoreOpen((v) => !v)}>{lang === 'ar' ? 'الإعدادات والحساب' : 'Settings and account'} <span aria-hidden="true">{moreOpen ? '▴' : '▾'}</span></button>
          <div className="topbar-right" id="topbar-controls" data-open={moreOpen ? 'true' : undefined}>
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
                title="中文（不完整）：大部分页面以英文显示 · Chinese (incomplete): most pages are shown in English"
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
              title={t('notif')}
            >
              <Icon name="bell" />
              <span style={{ fontSize: 12 }}>{t('notif')}</span>
            </button>

            <div className="pill" style={{ gap: 10 }}>
              <div
                className="badge badge--teal"
                style={{ width: 34, height: 34, borderRadius: 12, paddingInline: 0, display: 'grid', placeItems: 'center' }}
                title={T(user, 'name')}
              >
                {user?.avatar || 'U'}
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                  {T(user, 'name')}
                </span>
                <span style={{ fontSize: 12, color: 'var(--txt-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
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

          </div>
        </header>

        <nav className="tabbar" aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
          {primaryTabs.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `tab${isActive || (tab.to === '/enforcement' && loc.pathname.startsWith('/enforcement-orders')) ? ' active' : ''}`}>
              <span className="tab__icon"><Icon name={tab.icon} /></span>
              <span className="tab__text">{tab.label}</span>
            </NavLink>
          ))}
          <div className="tab-menu" ref={opsRef}>
            <button type="button" ref={opsBtn} className={`tab${opsActive ? ' active' : ''}`} aria-expanded={opsOpen} aria-controls="ops-menu" onClick={() => setOpsOpen((v) => !v)}>
              <span className="tab__icon"><Icon name="invoices" /></span>
              <span className="tab__text">{opsLabel}</span>
              <span aria-hidden="true" className="tab__chev">▾</span>
            </button>
            {opsOpen && (
              <ul id="ops-menu" className="tab-menu__list">
                {opsTabs.map((tab) => (
                  <li key={tab.to}><NavLink to={tab.to} className={({ isActive }) => `tab-menu__item${isActive ? ' active' : ''}`}>{tab.label}</NavLink></li>
                ))}
              </ul>
            )}
          </div>
        </nav>

        <section className="content" id="main-content" tabIndex={-1}>
          {lang === 'zh' && <div className="rv-callout" role="note" data-testid="zh-notice"><span lang="zh-CN">中文翻译不完整：当前大部分页面、导航和报告尚未翻译，以英文显示（仅部分旧版文本为中文）。</span> <span lang="en">The Chinese translation is incomplete: most current pages, navigation and reports are not translated and are shown in English (only some legacy text is Chinese). Arabic and English are the fully authored languages.</span></div>}
          <div lang={lang === 'zh' ? 'en' : undefined}><Outlet /></div>
        </section>
        <footer className="app-footer">{lang === 'ar' ? 'بيانات تجريبية اصطناعية — وليست بيانات فعلية للوزارة · التواريخ والأوقات بتوقيت الرياض' : 'Synthetic demo data — not the Ministry’s actual data · dates and times are Asia/Riyadh'}</footer>

        <FloatingAssistantButton />
        <AnalysisHost />
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
