import React, { useId, useState } from 'react';
import { adminApi } from '../../api/adminClient';
import { Dialog, useTx, Notice, ErrorNotice, AIcon } from './adminBits';
import ModuleMatrix from './ModuleMatrix';
import { roleDraftFrom, validateRoleDraft, roleForSave, roleDisplayName, serverFieldErrors } from './adminLogic';

/* Create / edit one role: names (AR + EN), an optional short description, the module matrix (one switch per module) and the single «Read-only» checkbox. Save / Cancel.
   Editing a role only changes what its users can open from their next request; the geographic scope is chosen per user, not here. */
export default function RoleForm({ role, canManage, onClose, onSaved }) {
  const { tx, lang } = useTx(); const idp = useId().replace(/:/g, ''); const creating = !role;
  const [d, setD] = useState(() => roleDraftFrom(role));
  const [saving, setSaving] = useState(false); const [serverErr, setServerErr] = useState(null); const [tried, setTried] = useState(false);
  const check = validateRoleDraft(d); const sf = serverErr ? serverFieldErrors(serverErr, lang) : {};
  const locked = !!d.protected; const disabled = !canManage || saving;
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const err = (k) => (tried && check.fields[k] ? tx(check.fields[k]) : sf[k] || '');
  const save = async () => {
    setTried(true); if (!check.ok) return;
    setSaving(true); setServerErr(null);
    try { const r = creating ? await adminApi.createRole(roleForSave(d)) : await adminApi.updateRole(role.id, roleForSave(d)); onSaved(r.role || r, creating); } catch (e) { setServerErr(e); setSaving(false); }
  };
  const field = (k, label, props = {}) => (
    <div className="adm-field">
      <label htmlFor={`${idp}-${k}`}>{label}</label>
      <input id={`${idp}-${k}`} className="input" value={d[k]} onChange={set(k)} disabled={disabled} aria-invalid={err(k) ? 'true' : undefined} aria-describedby={err(k) ? `${idp}-${k}-e` : undefined} {...props} />
      {err(k) && <div id={`${idp}-${k}-e`} className="adm-fielderr" role="alert">{err(k)}</div>}
    </div>
  );
  return (
    <Dialog size="lg" title={creating ? tx('role.createTitle') : canManage ? tx('role.editTitle') : tx('role.viewTitle')} subtitle={creating ? null : roleDisplayName(role, lang)} onClose={() => !saving && onClose()}
      footer={<>
        <button type="button" className="btn" disabled={saving} onClick={onClose}>{tx('common.cancel')}</button>
        <button type="button" className="btn btn-primary" disabled={disabled} onClick={save}>{saving ? tx('common.saving') : creating ? tx('role.create') : tx('common.save')}</button>
      </>}>
      {!canManage && <Notice kind="info">{tx('roles.readOnlyReason')}</Notice>}
      {serverErr && <ErrorNotice error={serverErr} />}
      <div className="adm-grid2">
        {field('nameAr', tx('role.nameAr'), { dir: 'rtl', maxLength: 60, 'data-autofocus': true })}
        {field('nameEn', tx('role.nameEn'), { dir: 'ltr', maxLength: 60 })}
        {field('descriptionAr', tx('role.descAr'), { dir: 'rtl', maxLength: 300 })}
        {field('descriptionEn', tx('role.descEn'), { dir: 'ltr', maxLength: 300 })}
      </div>
      <ModuleMatrix selected={d.modules} onChange={(modules) => setD({ ...d, modules })} protectedRole={locked} disabled={disabled} error={tried && check.fields.modules ? tx(check.fields.modules) : ''} />
      {locked && <Notice kind="info" title={tx('roles.protectedTitle', { name: roleDisplayName(role, lang) })}>{tx('roles.protectedWhy')}</Notice>}
      <div className="adm-readonly">
        <label className="adm-check"><input type="checkbox" checked={d.readOnly} disabled={disabled || locked} onChange={(e) => setD({ ...d, readOnly: e.target.checked })} aria-describedby={`${idp}-ro`} /><span><b>{tx('role.readOnly')}</b></span></label>
        <p id={`${idp}-ro`} className="adm-hint"><AIcon name="info" size={14} />{tx('role.readOnlyHelp')}{locked && <> {tx('role.readOnlyLocked')}</>}</p>
      </div>
    </Dialog>
  );
}
