import React, { useId, useMemo, useState } from 'react';
import { adminApi } from '../../api/adminClient';
import { Dialog, useTx, Notice, ErrorNotice, AIcon } from './adminBits';
import GeoAccess from './GeoAccess';
import SeePreview from './SeePreview';
import { userFormFrom, validateUserForm, userForSave, scopeForSave, accessFits, serverFieldErrors, roleDisplayName, isSelf, userDisplayName, statusChoices } from './adminLogic';

/* Create / edit a user. The form is exactly: Name (AR + EN) · Username / e-mail · Role (one select) · Geographic access (three options) · Account status.
   No password field exists: a new user gets a one-time activation code (shown once by the page after saving). The administrator's own row cannot change its own role, scope or status. */
export default function UserForm({ user, roles, hier, me, canManage, onClose, onSaved }) {
  const { tx, lang } = useTx(); const idp = useId().replace(/:/g, ''); const creating = !user;
  const self = !creating && isSelf(me, user);
  const [f, setF] = useState(() => userFormFrom(user, hier));
  const [saving, setSaving] = useState(false); const [serverErr, setServerErr] = useState(null); const [tried, setTried] = useState(false);
  const check = validateUserForm(f, { creating, lang, hier, self }); const sf = serverErr ? serverFieldErrors(serverErr, lang) : {};
  const doesNotFit = useMemo(() => !creating && !accessFits(user.scope, hier), [creating, user, hier]); // eslint-disable-line react-hooks/exhaustive-deps
  const role = roles.find((r) => r.id === f.roleId) || null; const disabled = !canManage || saving;
  const scope = useMemo(() => scopeForSave(f.access, hier), [f.access, hier]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const err = (k) => (tried && check.fields[k] ? tx(check.fields[k]) : sf[k] || '');
  const save = async () => {
    setTried(true); if (!check.ok) return;
    setSaving(true); setServerErr(null);
    try {
      const body = userForSave(f, hier, { creating, self, originalStatus: user ? user.status : '' }); // own row: never role or scope; a status change is left to the server's last-administrator rule
      const r = creating ? await adminApi.createUser(body) : await adminApi.updateUser(user.id, body);
      onSaved(r, creating);
    } catch (e) { setServerErr(e); setSaving(false); }
  };
  const field = (k, label, props = {}, hint) => (
    <div className="adm-field">
      <label htmlFor={`${idp}-${k}`}>{label}</label>
      <input id={`${idp}-${k}`} className="input" value={f[k]} onChange={set(k)} disabled={disabled || props.readOnlyField} aria-invalid={err(k) ? 'true' : undefined} aria-describedby={err(k) ? `${idp}-${k}-e` : hint ? `${idp}-${k}-h` : undefined} {...props.input} />
      {hint && !err(k) && <div id={`${idp}-${k}-h`} className="adm-field__hint">{hint}</div>}
      {err(k) && <div id={`${idp}-${k}-e`} className="adm-fielderr" role="alert">{err(k)}</div>}
    </div>
  );
  const selfWhy = tx('user.selfWhy');
  return (
    <Dialog size="lg" title={creating ? tx('user.createTitle') : tx('user.editTitle')} subtitle={creating ? null : userDisplayName(user, lang)} onClose={() => !saving && onClose()}
      footer={<>
        <button type="button" className="btn" disabled={saving} onClick={onClose}>{tx('common.cancel')}</button>
        <button type="button" className="btn btn-primary" disabled={disabled} onClick={save}>{saving ? tx('common.saving') : creating ? tx('user.create') : tx('common.save')}</button>
      </>}>
      {!canManage && <Notice kind="info">{tx('user.readOnlyReason')}</Notice>}
      {serverErr && <ErrorNotice error={serverErr} />}
      {tried && !check.ok && <Notice kind="error">{tx('err.fixFields')}</Notice>}
      <div className="adm-grid2">
        {field('nameAr', tx('user.nameAr'), { input: { dir: 'rtl', maxLength: 80, 'data-autofocus': true } })}
        {field('nameEn', tx('user.nameEn'), { input: { dir: 'ltr', maxLength: 80 } })}
        {field('username', tx('user.username'), { readOnlyField: !creating, input: { dir: 'ltr', maxLength: 40, autoComplete: 'off', autoCapitalize: 'none', spellCheck: false } }, creating ? tx('user.usernameHint') : tx('user.usernameFixed'))}
        {field('email', tx('user.email'), { input: { dir: 'ltr', type: 'email', maxLength: 120, autoComplete: 'off' } })}
      </div>
      <div className="adm-grid2">
        <div className="adm-field">
          <label htmlFor={`${idp}-role`}>{tx('user.role')}</label>
          <select id={`${idp}-role`} className="select" value={f.roleId} disabled={disabled || self} onChange={set('roleId')} aria-invalid={err('roleId') ? 'true' : undefined} aria-describedby={self ? `${idp}-self` : err('roleId') ? `${idp}-role-e` : undefined}>
            <option value="">{tx('user.chooseRole')}</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{roleDisplayName(r, lang)}{r.readOnly ? ` — ${tx('roles.readOnlyTag')}` : ''}</option>)}
            {f.roleId && !role && <option value={f.roleId}>{f.roleId}</option>}
          </select>
          {err('roleId') && <div id={`${idp}-role-e`} className="adm-fielderr" role="alert">{err('roleId')}</div>}
        </div>
        <div className="adm-field">
          <label htmlFor={`${idp}-status`}>{tx('user.status')}</label>
          <select id={`${idp}-status`} className="select" value={f.status} disabled={disabled || creating} onChange={set('status')} aria-describedby={`${idp}-status-h`}>
            {statusChoices(creating, user && user.status).map((s) => <option key={s} value={s}>{tx(`status.${s}`)}</option>)}
          </select>
          <div id={`${idp}-status-h`} className="adm-field__hint">{creating ? tx('user.statusHintNew') : tx('user.statusHint')}</div>
        </div>
      </div>
      {self && <p id={`${idp}-self`} className="adm-hint adm-hint--warn"><AIcon name="lock" size={14} />{selfWhy}</p>}
      <GeoAccess value={f.access} onChange={(access) => setF({ ...f, access })} hier={hier} disabled={disabled || self} doesNotFit={doesNotFit} forceMessages={tried} showMessages={tried || !!f.access.option} />
      <SeePreview role={role} scope={scope} />
    </Dialog>
  );
}
