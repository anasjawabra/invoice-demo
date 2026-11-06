import React from 'react';
import { useTx, AIcon } from './adminBits';
import { roleDisplayName, roleKind, roleUserCount, roleDeleteBlock } from './adminLogic';
import { MODULE_IDS } from '../../data/permissions';

/** the compact roles table: name · short description · modules enabled · users · tags (read-only, starter / protected) · actions */
export default function RoleTable({ roles, users, canManage, onEdit, onDelete }) {
  const { tx, lang, ar } = useTx();
  if (!roles.length) return <div className="adm-empty">{tx('roles.empty')}</div>;
  return (
    <div className="adm-tablewrap">
      <table className="adm-table adm-table--roles">
        <caption className="sr-only">{tx('roles.caption')}</caption>
        <thead><tr>
          <th scope="col">{tx('roles.name')}</th><th scope="col">{tx('roles.explain')}</th><th scope="col" className="num">{tx('roles.modulesCount')}</th><th scope="col" className="num">{tx('roles.userCount')}</th>
          <th scope="col">{tx('roles.kind')}</th><th scope="col"><span className="sr-only">{tx('common.actions')}</span></th>
        </tr></thead>
        <tbody>
          {roles.map((r) => {
            const count = roleUserCount(r, users); const blockKey = roleDeleteBlock(r, count, { canManage }); const kind = roleKind(r);
            const block = blockKey ? tx(blockKey, { n: count }) : null; const name = roleDisplayName(r, lang);
            return (
              <tr key={r.id}>
                <td data-label={tx('roles.name')}><b>{name}</b><small className="adm-sub2">{ar ? r.nameEn : r.nameAr}</small></td>
                <td data-label={tx('roles.explain')} className="adm-explain">{(ar ? r.descriptionAr : r.descriptionEn) || <span className="adm-muted">—</span>}</td>
                <td data-label={tx('roles.modulesCount')} className="num">{r.modules.length}<span className="adm-muted"> / {MODULE_IDS.length}</span></td>
                <td data-label={tx('roles.userCount')} className="num">{count === null ? '—' : count}</td>
                <td data-label={tx('roles.kind')}>
                  {r.readOnly && <span className="adm-tag adm-tag--ro"><AIcon name="lock" size={11} />{tx('roles.readOnlyTag')}</span>}
                  {kind === 'protected' ? <span className="adm-tag adm-tag--protected"><AIcon name="lock" size={11} />{tx('roles.protected')}</span> : kind === 'starter' ? <span className="adm-tag adm-tag--starter">{tx('roles.starter')}</span> : <span className="adm-tag">{tx('roles.custom')}</span>}
                </td>
                <td className="adm-rowact adm-rowact--multi">
                  <button type="button" className="btn btn-sm" onClick={() => onEdit(r)} aria-label={`${canManage ? tx('common.edit') : tx('common.view')} — ${name}`}>{canManage ? tx('common.edit') : tx('common.view')}</button>
                  <button type="button" className="btn btn-sm btn-danger" disabled={!!block} title={block || undefined} aria-label={`${tx('common.delete')} — ${name}`} onClick={() => onDelete(r)}>{tx('common.delete')}</button>
                  {block && <span className="sr-only">{block}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
