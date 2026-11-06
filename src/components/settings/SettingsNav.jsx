import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useL } from '../../utils/bi';
import { useAccess } from '../../context/AuthContext';
import { canOpenRoute } from '../../data/accessModel';

// The sub-navigation of «إعدادات النظام»: system configuration and administration, kept apart from the daily operational pages.
export const SETTINGS_PAGES = [
  { to: '/settings/metrics', en: 'Metrics and Glossary Dictionary', ar: 'قاموس المقاييس والمصطلحات', hintEn: 'Definitions, formulas, sources and schema availability', hintAr: 'التعريفات والمعادلات والمصادر وتوفر المخطط' },
  { to: '/settings/users', en: 'User management', ar: 'إدارة المستخدمين', hintEn: 'Accounts, roles and geographic access', hintAr: 'الحسابات والأدوار والنطاق الجغرافي' },
  { to: '/settings/roles', en: 'Roles and permissions', ar: 'الأدوار والصلاحيات', hintEn: 'What each role may do', hintAr: 'ما يسمح به كل دور' }
];

export default function SettingsNav({ current }) {
  const { L, B } = useL();
  const { can } = useAccess();
  const page = SETTINGS_PAGES.find((p) => p.to === current);
  const pages = SETTINGS_PAGES.filter((p) => canOpenRoute(p.to, can)); // only the settings pages the person may open
  return (
    <div className="ss-nav">
      <nav className="rp-crumbs" aria-label={L('Breadcrumb', 'مسار التنقل')}>
        <ol>
          <li><Link to="/settings">{L('System settings', 'إعدادات النظام')}</Link></li>
          {page && <li><span aria-current="page">{B({ en: page.en, ar: page.ar })}</span></li>}
        </ol>
      </nav>
      <nav className="ss-tabs" aria-label={L('System settings sections', 'أقسام إعدادات النظام')}>
        {pages.map((p) => (
          <NavLink key={p.to} to={p.to} className={({ isActive }) => `ss-tab${isActive ? ' active' : ''}`}>
            <b>{B({ en: p.en, ar: p.ar })}</b>
            <small>{B({ en: p.hintEn, ar: p.hintAr })}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
