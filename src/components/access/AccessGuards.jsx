// Route guards and the «not authorised» states. The data service is the authority (401 / 403); these only keep the UI honest: a page the person may not open is never rendered, and a refused request shows a clear message (no data, no totals).
import React from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAccess } from '../../context/AuthContext';
import { useAr } from '../../utils/useAr';
import { ROUTE_PERMISSIONS, SETTINGS_LANDING_ORDER, firstAllowedRoute, moduleName } from '../../data/accessModel';

/** the state shown instead of a page (or a panel) whose module the person does not hold — `modules` names the module(s) that open it (`permissions` is the older prop name) */
export function NoPermission({ modules, permissions = [], compact = false }) {
  const { L, lang } = useAr(); const access = useAccess();
  const home = firstAllowedRoute(access.can);
  const needs = (modules || permissions).map((m) => moduleName(m, lang)).filter(Boolean);
  return (
    <div className={compact ? 'rv-callout rv-callout--warn' : 'st-page'} style={compact ? undefined : { maxWidth: 640 }} role="alert" data-testid="no-permission">
      {!compact && <h1 className="page-title">{L('غير مصرّح', 'Not authorised')}</h1>}
      <p className={compact ? undefined : 'muted'} style={{ marginBlock: compact ? 0 : undefined }}>
        <b>{L('ليست لديك صلاحية', 'You do not have permission')}</b> {compact ? L('للاطلاع على هذه البيانات أو تنفيذ هذا الإجراء.', 'to see this data or perform this action.') : L('لفتح هذه الصفحة. لا تُعرض أي بيانات.', 'to open this page. No data is shown.')}
        {needs.length > 0 && <> {L('الوحدة المطلوبة:', 'Required module:')} <bdi>{needs.join(L('، ', ', '))}</bdi>.</>}
      </p>
      {!compact && <p className="muted">{L('إن كنت تحتاج هذه الصفحة فاطلب من مسؤول النظام تفعيل الوحدة لدورك.', 'If you need this page, ask the system administrator to switch the module on for your role.')}</p>}
      {!compact && home && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link className="btn btn-primary" to={home}>{L('الانتقال إلى صفحة متاحة لك', 'Go to a page you can open')}</Link></div>}
    </div>
  );
}

const entryOf = (pattern) => ROUTE_PERMISSIONS.find((r) => r.pattern === pattern);
/** guard of one route: `pattern` is the route's path in App.jsx (the key of ROUTE_PERMISSIONS) */
export function RequireRoute({ pattern, children }) {
  const access = useAccess();
  const e = entryOf(pattern);
  if (!e) return <NoPermission />; // a route without a guard entry is closed, never open
  if (e.kind === 'page' && !e.any.some(access.can)) return <NoPermission modules={e.any} />;
  return children;
}

/** the index route: the first page the person may open (sidebar order); none → the «not authorised» page */
export function LandingRedirect() {
  const { can } = useAccess();
  const to = firstAllowedRoute(can);
  return <Navigate to={to || '/not-authorised'} replace />;
}
/** /settings → the first system-settings page the person may open */
export function SettingsLanding() {
  const { can } = useAccess();
  const to = firstAllowedRoute(can, SETTINGS_LANDING_ORDER);
  return to ? <Navigate to={to} replace /> : <NoPermission modules={['metrics']} />;
}
export function NotAuthorisedPage() {
  const loc = useLocation();
  return <NoPermission modules={loc.state?.need || []} />;
}
