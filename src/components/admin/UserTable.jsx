import React from 'react';
import { useTx, AIcon, StatusBadge, timeText } from './adminBits';
import { initialsOf } from '../../utils/identity';
import { USER_STATUSES, userDisplayName, userSummary } from './adminLogic';

export function UserFilters({ value, onChange, shown, total }) {
  const { tx } = useTx();
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const active = !!(value.q || value.status);
  return (
    <div className="adm-filters" role="search" aria-label={tx('users.filters')}>
      <label className="adm-search"><AIcon name="search" size={15} /><input type="search" value={value.q} onChange={set('q')} placeholder={tx('users.search')} aria-label={tx('users.search')} /></label>
      <label className="adm-field adm-field--inline"><span>{tx('users.status')}</span>
        <select className="select adm-select" value={value.status} onChange={set('status')}><option value="">{tx('common.all')}</option>{USER_STATUSES.map((s) => <option key={s} value={s}>{tx(`status.${s}`)}</option>)}</select></label>
      {active && <button type="button" className="btn btn-sm" onClick={() => onChange({ q: '', status: '' })}>{tx('common.clearFilters')}</button>}
      <span className="adm-muted adm-filters__count" role="status">{tx('users.count', { n: shown, total })}</span>
    </div>
  );
}

/** the users table: name · username / e-mail · role · «Role · Amanah · municipalities» summary · status (symbol + text) · last sign-in (Riyadh) · actions */
export function UserTable({ users, rolesById, selfId, canManage, onEdit, onToggleStatus, onReissue }) {
  const { tx, lang, ar } = useTx();
  if (!users.length) return <div className="adm-empty">{tx('users.empty')}</div>;
  return (
    <div className="adm-tablewrap">
      <table className="adm-table adm-table--users">
        <caption className="sr-only">{tx('users.caption')}</caption>
        <thead><tr>
          <th scope="col">{tx('users.name')}</th><th scope="col">{tx('users.account')}</th><th scope="col">{tx('users.roleAccess')}</th>
          <th scope="col">{tx('users.status')}</th><th scope="col">{tx('users.lastLogin')}</th><th scope="col"><span className="sr-only">{tx('common.actions')}</span></th>
        </tr></thead>
        <tbody>
          {users.map((u) => {
            const name = userDisplayName(u, lang); const inactive = u.status === 'inactive'; const self = selfId === u.id;
            return (
              <tr key={u.id}>
                <td data-label={tx('users.name')}>
                  <div className="adm-who"><span className="adm-avatar" aria-hidden="true">{initialsOf(name)}</span>
                    <span><b>{name}</b>{self && <span className="adm-tag adm-tag--you">{tx('users.you')}</span>}{(ar ? u.nameEn : u.nameAr) && (ar ? u.nameEn : u.nameAr) !== name && <small className="adm-sub2">{ar ? u.nameEn : u.nameAr}</small>}</span></div>
                </td>
                <td data-label={tx('users.account')}><div dir="ltr" className="adm-acct">{u.username}</div>{u.email && <small className="adm-sub2" dir="ltr">{u.email}</small>}</td>
                <td data-label={tx('users.roleAccess')} className="adm-summary">{userSummary(u, rolesById.get(u.roleId), lang)}</td>
                <td data-label={tx('users.status')}><StatusBadge status={u.status} /></td>
                <td data-label={tx('users.lastLogin')} className="adm-nowrap">{u.lastLoginAt ? <span dir="ltr">{timeText(u.lastLoginAt)}</span> : <span className="adm-muted">{tx('user.neverLoggedIn')}</span>}</td>
                <td className="adm-rowact adm-rowact--multi">
                  <button type="button" className="btn btn-sm" onClick={() => onEdit(u)} aria-label={`${canManage ? tx('common.edit') : tx('common.view')} — ${name}`}>{canManage ? tx('common.edit') : tx('common.view')}</button>
                  {u.status === 'invited' && <button type="button" className="btn btn-sm" disabled={!canManage} title={!canManage ? tx('user.readOnlyReason') : undefined} aria-label={`${tx('users.reissue')} — ${name}`} onClick={() => onReissue(u)}>{tx('users.reissue')}</button>}
                  <button type="button" className={`btn btn-sm${inactive ? '' : ' btn-danger'}`} disabled={!canManage} title={!canManage ? tx('user.readOnlyReason') : undefined}
                    aria-label={`${inactive ? tx('users.activate') : tx('users.deactivate')} — ${name}`} onClick={() => onToggleStatus(u)}>{inactive ? tx('users.activate') : tx('users.deactivate')}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
