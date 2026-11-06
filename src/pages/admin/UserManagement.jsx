import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/adminClient';
import SettingsNav from '../../components/settings/SettingsNav';
import { Dialog, useTx, useLoad, useAdminSession, useAdminCatalog, Notice, ErrorNotice, AIcon } from '../../components/admin/adminBits';
import { UserFilters, UserTable } from '../../components/admin/UserTable';
import UserForm from '../../components/admin/UserForm';
import ActivationDialog from '../../components/admin/ActivationDialog';
import AuditList from '../../components/admin/AuditList';
import { filterUsers, sortUsers, normalizeUser, normalizeRole, hierarchyIndex, userDisplayName } from '../../components/admin/adminLogic';
import '../../components/admin/admin.css';

/* «إدارة المستخدمين» — /settings/users. A user table with search + status filter, «إضافة مستخدم», edit, activate / deactivate (with a confirmation) and the one-time activation code.
   The form is Name · Username / e-mail · ONE role · Geographic access (three options) · Account status. Endpoints: GET /admin/catalog|users|roles|audit, POST /admin/users, PATCH /admin/users/:id,
   POST /admin/users/:id/activation, POST /admin/preview. */
export default function UserManagement() {
  const { tx, lang } = useTx();
  const session = useAdminSession(); const catalog = useAdminCatalog();
  const users = useLoad((signal) => adminApi.users({ signal }), []);
  const rolesQ = useLoad((signal) => adminApi.roles({ signal }), []);
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [editing, setEditing] = useState(null); // 'new' | user
  const [activation, setActivation] = useState(null); // { activation, user, reissued } — held ONLY here and dropped on close
  const [confirm, setConfirm] = useState(null); // { kind:'status'|'reissue', user, to? }
  const [busy, setBusy] = useState(false); const [actionErr, setActionErr] = useState(null); const [flash, setFlash] = useState(null);
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(null), 6000); return () => clearTimeout(t); }, [flash]);

  const canManage = session.can('users') && !session.readOnly;
  const hier = useMemo(() => hierarchyIndex(catalog.data && catalog.data.hierarchy), [catalog.data]);
  const roles = useMemo(() => ((rolesQ.data && rolesQ.data.roles) || []).map(normalizeRole), [rolesQ.data]);
  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const all = useMemo(() => ((users.data && users.data.users) || []).map(normalizeUser), [users.data]);
  const shown = useMemo(() => sortUsers(filterUsers(all, filters, rolesById), lang), [all, filters, rolesById, lang]);

  const loading = session.loading || (users.loading && !users.data) || (catalog.loading && !catalog.data) || (rolesQ.loading && !rolesQ.data);
  const forbidden = !loading && ((users.error && users.error.status === 403) || (session.me && !session.can('users')));
  const fatal = (users.error && users.error.status !== 403 ? users.error : null) || (rolesQ.error && rolesQ.error.status !== 403 ? rolesQ.error : null) || catalog.error;
  const reason = session.readOnly ? tx('user.readOnlyRoleReason') : tx('user.readOnlyReason');

  const afterChange = (msgKey, vars) => { users.reload(); rolesQ.reload(); setFlash(tx(msgKey, vars)); };
  const saved = (r, creating) => {
    setEditing(null);
    if (creating && r.activation) { setActivation({ activation: r.activation, user: r.user, reissued: false }); afterChange('flash.created', { name: userDisplayName(r.user, lang) }); } else afterChange('flash.updated', { name: userDisplayName(r.user, lang) });
  };
  const runStatus = async () => {
    setBusy(true); setActionErr(null);
    try { await adminApi.setStatus(confirm.user.id, confirm.to); setConfirm(null); afterChange(confirm.to === 'inactive' ? 'flash.deactivated' : 'flash.activated', { name: userDisplayName(confirm.user, lang) }); } catch (e) { setActionErr(e); }
    setBusy(false);
  };
  const runReissue = async () => {
    setBusy(true); setActionErr(null);
    try { const r = await adminApi.reissueActivation(confirm.user.id); setConfirm(null); setActivation({ activation: r.activation, user: r.user, reissued: true }); afterChange('flash.reissued', { name: userDisplayName(r.user, lang) }); } catch (e) { setActionErr(e); }
    setBusy(false);
  };

  const body = () => {
    if (loading) return <div className="adm-loading" role="status">{tx('common.loading')}</div>;
    if (forbidden) return <Notice kind="warn" title={tx('common.forbiddenTitle')}>{tx('users.noViewRight')}</Notice>;
    if (fatal) return <ErrorNotice error={fatal} onRetry={() => { session.reload(); users.reload(); catalog.reload(); rolesQ.reload(); }} />;
    return (
      <>
        {!canManage && <Notice kind="info">{reason}</Notice>}
        {users.data && users.data.storage && users.data.storage.durable === false && <Notice kind="warn">{tx('users.storageNote')}</Notice>}
        {flash && <Notice kind="ok" onClose={() => setFlash(null)}>{flash}</Notice>}
        <UserFilters value={filters} onChange={setFilters} shown={shown.length} total={all.length} />
        {all.length === 0 ? <div className="adm-empty">{tx('users.none')}</div>
          : <UserTable users={shown} rolesById={rolesById} selfId={session.me && session.me.id} canManage={canManage} onEdit={setEditing} onReissue={(u) => { setActionErr(null); setConfirm({ kind: 'reissue', user: u }); }}
            onToggleStatus={(u) => { setActionErr(null); setConfirm({ kind: 'status', user: u, to: u.status === 'inactive' ? 'active' : 'inactive' }); }} />}
        {session.can('users') && !forbidden && (
          <details className="adm-audit-box">
            <summary>{tx('audit.title')}</summary>
            <p className="adm-sec__d">{tx('audit.help')}</p>
            <AuditList />
          </details>
        )}
      </>
    );
  };

  return (
    <div className="rv-page adm-page">
      <SettingsNav current="/settings/users" />
      <div className="page-head">
        <div>
          <h1 className="page-title">{tx('users.title')}</h1>
          <div className="page-sub">{tx('users.sub')}</div>
        </div>
        <div className="adm-headact">
          <button type="button" className="btn btn-primary" disabled={!canManage || loading || !catalog.data || !!fatal || forbidden} title={canManage ? undefined : reason} onClick={() => setEditing('new')}><AIcon name="plus" size={15} />{tx('users.new')}</button>
        </div>
      </div>
      {body()}

      {editing && catalog.data && (
        <UserForm user={editing === 'new' ? null : editing} roles={roles} hier={hier} me={session.me} canManage={canManage} onClose={() => setEditing(null)} onSaved={saved} />
      )}
      {confirm && (
        <Dialog size="sm" title={confirm.kind === 'reissue' ? tx('confirm.reissueTitle') : confirm.to === 'inactive' ? tx('confirm.deactivateTitle') : tx('confirm.activateTitle')} subtitle={userDisplayName(confirm.user, lang)} onClose={() => !busy && setConfirm(null)}
          footer={<>
            <button type="button" className="btn" disabled={busy} onClick={() => setConfirm(null)}>{tx('common.cancel')}</button>
            <button type="button" className={`btn ${confirm.kind === 'status' && confirm.to === 'inactive' ? 'btn-danger' : 'btn-primary'}`} disabled={busy} data-autofocus onClick={confirm.kind === 'reissue' ? runReissue : runStatus}>{busy ? tx('common.saving') : confirm.kind === 'reissue' ? tx('confirm.reissueYes') : confirm.to === 'inactive' ? tx('confirm.deactivateYes') : tx('confirm.activateYes')}</button>
          </>}>
          <p>{confirm.kind === 'reissue' ? tx('confirm.reissueBody') : confirm.to === 'inactive' ? tx('confirm.deactivateBody') : tx('confirm.activateBody')}</p>
          {confirm.kind === 'status' && confirm.to === 'inactive' && session.me && session.me.id === confirm.user.id && <Notice kind="warn">{tx('confirm.deactivateSelf')}</Notice>}
          {actionErr && <ErrorNotice error={actionErr} />}
        </Dialog>
      )}
      {activation && <ActivationDialog activation={activation.activation} user={activation.user} reissued={activation.reissued} onClose={() => setActivation(null)} />}
    </div>
  );
}
