import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useL } from '../../utils/bi';

// The sub-navigation of «إعدادات النظام»: system configuration and administration, kept apart from the daily operational pages.
export const SETTINGS_PAGES = [
  { to: '/settings/data-sources', en: 'Data sources', ar: 'مصادر البيانات', hintEn: 'Source status, versions, imports', hintAr: 'حالة المصادر والإصدارات والاستيراد' },
  { to: '/settings/data-quality', en: 'Data quality', ar: 'جودة البيانات', hintEn: 'Records to complete or match', hintAr: 'سجلات تحتاج استكمالاً أو مطابقة' },
  { to: '/settings/metrics', en: 'Metric dictionary', ar: 'قاموس المقاييس', hintEn: 'One definition per metric', hintAr: 'تعريف واحد لكل مقياس' }
];

export default function SettingsNav({ current }) {
  const { L, B } = useL();
  const page = SETTINGS_PAGES.find((p) => p.to === current);
  return (
    <div className="st-nav">
      <nav className="rp-crumbs" aria-label={L('Breadcrumb', 'مسار التنقل')}>
        <ol>
          <li><Link to="/settings">{L('System settings', 'إعدادات النظام')}</Link></li>
          {page && <li><span aria-current="page">{B({ en: page.en, ar: page.ar })}</span></li>}
        </ol>
      </nav>
      <nav className="st-tabs" aria-label={L('System settings sections', 'أقسام إعدادات النظام')}>
        {SETTINGS_PAGES.map((p) => (
          <NavLink key={p.to} to={p.to} className={({ isActive }) => `st-tab${isActive ? ' active' : ''}`}>
            <b>{B({ en: p.en, ar: p.ar })}</b>
            <small>{B({ en: p.hintEn, ar: p.hintAr })}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
