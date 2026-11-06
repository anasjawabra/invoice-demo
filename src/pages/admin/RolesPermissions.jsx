import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminClient';
import SettingsNav from '../../components/settings/SettingsNav';
import { Dialog, useTx, useLoad, useAdminSession, Notice, ErrorNotice, AIcon } from '../../components/admin/adminBits';
import RoleTable from '../../components/admin/RoleTable';
import RoleForm from '../../components/admin/RoleForm';
import { normalizeRole, filterRoles, roleDisplayName } from '../../components/admin/adminLogic';
import '../../components/admin/admin.css';

/* «الأدوار والصلاحيات» — /settings/roles. A compact roles table, «إنشاء دور» and ONE form: names, a short description, one On/Off switch per module and the single «Read-only» checkbox.
   Delete a custom role only when no user holds it (the server's role_in_use answer is shown). Endpoints: GET /admin/roles, GET /admin/users (counts), POST /admin/roles, PATCH|DELETE /admin/roles/:id. */
export default function RolesPermissions() {
  const { tx, lang } = useTx();
  const session = useAdminSession();
  const rolesQ = useLoad((signal) => adminApi.roles({ signal }), []);
  const canSeeUsers = session.can('users');
  const usersQ = useLoad((signal) => (canSeeUsers ? adminApi.users({ signal }) : Promise.resolve({ users: [] })), [canSeeUsers, session.loading]);
  const [q, setQ] = useState(''); const [editing, setEditing] = useState(null); // 'new' | role
  const [del, setDel] = useState(null); const [busy, setBusy] = useState(false); const [delErr, setDelErr] = useState(null); const [flash, setFlash] = useState(null);
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(null), 6000); return () => clearTimeout(t); }, [flash]);

  const canManage = session.can('roles') && !session.readOnly;
  const roles = ((rolesQ.data && rolesQ.data.roles) || []).map(normalizeRole); const users = canSeeUsers && usersQ.data ? usersQ.data.users : null;
  const shown = filterRoles(roles, { q });
  const loading = session.loading || (rolesQ.loading && !rolesQ.data);
  const forbidden = !loading && ((rolesQ.error && rolesQ.error.status === 403) || (session.me && !session.can('roles')));
  const fatal = rolesQ.error && rolesQ.error.status !== 403 ? rolesQ.error : null;
  const reason = session.readOnly ? tx('roles.readOnlyRoleReason') : tx('roles.readOnlyReason');

  const saved = (role, creating) => { setEditing(null); rolesQ.reload(); usersQ.reload(); setFlash(tx(creating ? 'flash.roleCreated' : 'flash.roleUpdated', { name: roleDisplayName(role, lang) })); };
  const doDelete = async () => {
    setBusy(true); setDelErr(null);
    try { await adminApi.deleteRole(del.id); setFlash(tx('flash.roleDeleted', { name: roleDisplayName(del, lang) })); setDel(null); rolesQ.reload(); } catch (e) { setDelErr(e); }
    setBusy(false);
  };

  const body = () => {
    if (loading) return <div className="adm-loading" role="status">{tx('common.loading')}</div>;
    if (forbidden) return <Notice kind="warn" title={tx('common.forbiddenTitle')}>{tx('roles.noViewRight')}</Notice>;
    if (fatal) return <ErrorNotice error={fatal} onRetry={() => { session.reload(); rolesQ.reload(); }} />;
    return (
      <>
        {!canManage && <Notice kind="info">{reason}</Notice>}
        {flash && <Notice kind="ok" onClose={() => setFlash(null)}>{flash}</Notice>}
        {roles.length > 6 && (
          <div className="adm-filters" role="search">
            <label className="adm-search"><AIcon name="search" size={15} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('roles.search')} aria-label={tx('roles.search')} /></label>
            <span className="adm-muted adm-filters__count" role="status">{tx('roles.count', { n: shown.length, total: roles.length })}</span>
          </div>
        )}
        <RoleTable roles={shown} users={users} canManage={canManage} onEdit={setEditing} onDelete={(r) => { setDelErr(null); setDel(r); }} />
      </>
    );
  };

  return (
    <div className="rv-page adm-page">
      <SettingsNav current="/settings/roles" />
      <div className="page-head">
        <div><h1 className="page-title">{tx('roles.title')}</h1><div className="page-sub">{tx('roles.sub')}</div></div>
        <div className="adm-headact"><button type="button" className="btn btn-primary" disabled={!canManage || loading || !!fatal || forbidden} title={canManage ? undefined : reason} onClick={() => setEditing('new')}><AIcon name="plus" size={15} />{tx('roles.new')}</button></div>
      </div>
      {body()}
      {editing && <RoleForm role={editing === 'new' ? null : editing} canManage={canManage} onClose={() => setEditing(null)} onSaved={saved} />}
      {del && (
        <Dialog size="sm" title={tx('roles.deleteTitle')} subtitle={roleDisplayName(del, lang)} onClose={() => !busy && setDel(null)}
          footer={<><button type="button" className="btn" disabled={busy} onClick={() => setDel(null)}>{tx('common.cancel')}</button><button type="button" className="btn btn-danger" disabled={busy} data-autofocus onClick={doDelete}>{busy ? tx('common.saving') : tx('roles.deleteYes')}</button></>}>
          <p>{tx('roles.deleteBody')}</p>{delErr && <ErrorNotice error={delErr} />}
        </Dialog>
      )}
    </div>
  );
}
