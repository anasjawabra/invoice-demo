// An explicit 404 inside the application shell (it used to redirect silently to the dashboard).
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAr } from '../utils/useAr';

export default function NotFound() {
  const { L } = useAr(); const loc = useLocation();
  return (
    <div className="st-page" style={{ maxWidth: 640 }}>
      <h1 className="page-title">{L('الصفحة غير موجودة', 'Page not found')}</h1>
      <p className="muted">{L('لا توجد صفحة بهذا العنوان:', 'There is no page at this address:')} <bdi dir="ltr">{loc.pathname}</bdi></p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link className="btn btn-primary" to="/insights">{L('لوحة المعلومات والتقارير', 'Dashboards and reports')}</Link>
        <Link className="btn" to="/planning">{L('التخطيط المالي والاستراتيجي', 'Financial and strategic planning')}</Link>
      </div>
    </div>
  );
}
