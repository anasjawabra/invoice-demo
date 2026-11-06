import React, { useMemo } from 'react';
import { Dialog, useTx, CopyButton, Notice, AIcon, timeText } from './adminBits';
import { activationLink, userDisplayName } from './adminLogic';

/* The ONE-TIME activation code, shown once when a user is created or a code is re-issued. No password exists anywhere in the demo and no e-mail is sent: the administrator hands the link over.
   The parent keeps the code only in this dialog's state and drops it on close — the server stores a hash only, so afterwards only «re-issue» remains. */
export default function ActivationDialog({ activation, user, reissued = false, onClose }) {
  const { tx, lang } = useTx();
  const link = useMemo(() => activationLink(activation.code, typeof window !== 'undefined' ? window.location.origin : ''), [activation.code]);
  return (
    <Dialog title={reissued ? tx('act.titleReissue') : tx('act.title')} subtitle={user ? `${userDisplayName(user, lang)} · ${user.username}` : null} onClose={onClose} size="md" dismissible={false}
      footer={<button type="button" className="btn btn-primary" data-autofocus onClick={onClose}>{tx('act.done')}</button>}>
      <Notice kind="warn" title={tx('act.onceTitle')}>{tx('act.onceBody')}</Notice>
      <div className="adm-act">
        <div className="adm-act__row">
          <span className="adm-act__lbl">{tx('act.link')}</span>
          <div className="adm-act__box"><input className="input adm-act__input" readOnly value={link} dir="ltr" aria-label={tx('act.link')} onFocus={(e) => e.target.select()} /><CopyButton text={link} label={tx('act.copyLink')} doneLabel={tx('common.copied')} /></div>
        </div>
        <div className="adm-act__row">
          <span className="adm-act__lbl">{tx('act.code')}</span>
          <div className="adm-act__box"><code className="adm-act__code" dir="ltr">{activation.code}</code><CopyButton text={activation.code} label={tx('act.copyCode')} doneLabel={tx('common.copied')} /></div>
        </div>
        <p className="adm-act__exp"><AIcon name="clock" size={14} />{tx('act.expires', { at: `\u2066${timeText(activation.expiresAt) || '—'}\u2069` })}</p>
        <ul className="adm-act__notes">
          <li>{tx('act.noteNoMail')}</li>
          <li>{tx('act.noteSetPassword')}</li>
          <li>{tx('act.noteReissue')}</li>
        </ul>
      </div>
    </Dialog>
  );
}
