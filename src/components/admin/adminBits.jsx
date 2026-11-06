import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../context/I18nContext';
import { adminApi, AdminApiError } from '../../api/adminClient';
import { useAccess } from '../../context/AuthContext';
import { tt, errorText } from './adminText';
import { statusMeta } from './adminLogic';
import { fmtRiyadh } from '../../data/clock';

/* shared building blocks of the two administration pages: translation hook, inline icons (same 24px / 2px-stroke style as the header and sidebar icons — no icon package),
   switch, badge, notices, modal dialog, session / catalog hooks. */

/** `tx(key, vars)` in the page language. Every visible string of the administration pages goes through the dictionary in adminText.js (AR + EN parity is tested). */
export function useTx() {
  const { lang } = useI18n();
  const tx = useCallback((key, vars) => tt(key, lang, vars), [lang]);
  return { tx, lang: lang === 'en' ? 'en' : 'ar', ar: lang !== 'en' };
}

const ICONS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  ban: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  building: <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M3 21h18M8 8h2M8 12h2M8 16h2" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  minus: <path d="M5 12h14" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>
};
export function AIcon({ name, size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICONS[name] || ICONS.info}</svg>;
}

/** an on / off switch with a text state (never colour alone). */
export function Switch({ checked, onChange, disabled, labelledBy, describedBy, onText, offText, id }) {
  return (
    <span className="adm-switch">
      <button type="button" id={id} role="switch" aria-checked={checked ? 'true' : 'false'} aria-labelledby={labelledBy} aria-describedby={describedBy} disabled={disabled}
        className={`switch${checked ? ' switch--on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="switch__track" /><span className="switch__thumb" />
      </button>
      {(onText || offText) && <span className="adm-switch__state" aria-hidden="true">{checked ? onText : offText}</span>}
    </span>
  );
}

export function StatusBadge({ status }) {
  const { tx } = useTx(); const m = statusMeta(status);
  return <span className={`adm-st ${m.cls}`}><AIcon name={m.icon} size={13} />{tx(`status.${status}`)}</span>;
}

export function Notice({ kind = 'info', title, children, onClose, role }) {
  const { tx } = useTx();
  return (
    <div className={`adm-notice adm-notice--${kind}`} role={role || (kind === 'error' ? 'alert' : 'status')}>
      <span className="adm-notice__ic"><AIcon name={kind === 'error' || kind === 'warn' ? 'info' : kind === 'ok' ? 'check' : 'info'} /></span>
      <div className="adm-notice__body">{title && <b>{title}</b>}{children}</div>
      {onClose && <button type="button" className="adm-iconbtn" onClick={onClose} aria-label={tx('common.dismiss')}><AIcon name="close" /></button>}
    </div>
  );
}

/** an API failure, in the page language and WITHOUT any server detail beyond the documented codes */
export function ErrorNotice({ error, onRetry }) {
  const { tx, lang } = useTx();
  if (!error) return null;
  return <Notice kind="error">{errorText(error, lang)}{onRetry && <> <button type="button" className="adm-link" onClick={onRetry}>{tx('common.retry')}</button></>}</Notice>;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/** modal dialog: role=dialog + aria-modal (Tab is trapped by Layout's global handler), Escape closes, focus returns to the opener. */
export function Dialog({ title, subtitle, onClose, size = 'md', dismissible = true, children, footer, closeLabel, className = '' }) {
  const { tx } = useTx(); const ref = useRef(null); const titleId = useId(); const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  useEffect(() => {
    const el = ref.current; const prev = opener.current;
    const first = el && el.querySelector('[data-autofocus]'); (first || el)?.focus?.({ preventScroll: true });
    const key = (e) => { if (e.key === 'Escape' && dismissible) { e.stopPropagation(); onClose?.(); } };
    document.addEventListener('keydown', key);
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prevOverflow; if (prev && prev.isConnected) prev.focus?.({ preventScroll: true }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const node = (
    <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose?.(); }}>
      <div ref={ref} className={`adm-dialog adm-dialog--${size} ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="adm-dialog__head">
          <div><h2 id={titleId} className="adm-dialog__title">{title}</h2>{subtitle && <div className="adm-dialog__sub">{subtitle}</div>}</div>
          {dismissible && <button type="button" className="adm-iconbtn" onClick={onClose} aria-label={closeLabel || tx('common.close')}><AIcon name="close" size={18} /></button>}
        </header>
        <div className="adm-dialog__body">{children}</div>
        {footer && <footer className="adm-dialog__foot">{footer}</footer>}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}

export function CopyButton({ text, label, doneLabel, className = 'btn btn-sm' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* the code stays visible for a manual copy */ } document.body.removeChild(ta);
    }
    setDone(true); setTimeout(() => setDone(false), 2000);
  };
  return <button type="button" className={className} onClick={copy}><AIcon name={done ? 'check' : 'copy'} />{done ? doneLabel : label}<span className="sr-only" role="status">{done ? doneLabel : ''}</span></button>;
}

/** time in Riyadh: «2026-11-06 14:05» (the interface states «بتوقيت الرياض» in the column header) */
export const timeText = (at) => (at ? fmtRiyadh(at) : null);

/* ---------------------------------------------------------------- data hooks */
/** run an async loader; { data, error, loading, reload }. The loader receives an AbortSignal. */
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ac = new AbortController(); let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve().then(() => loader(ac.signal)).then((data) => { if (live) setState({ data, error: null, loading: false }); }, (error) => { if (live && !(error && error.name === 'AbortError')) setState({ data: null, error, loading: false }); });
    return () => { live = false; ac.abort(); };
  }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: useCallback(() => setTick((t) => t + 1), []) };
}

/** the signed-in administrator's own access, from the app's access context (the server-issued `me`): { me, can(moduleId), readOnly, loading }.
 *  readOnly = the signed-in person's ROLE is read-only: the pages keep every write action disabled with the reason (the server refuses them anyway). */
export function useAdminSession() {
  const a = useAccess();
  const me = a.ready ? a.me : null;
  return { me, can: (id) => a.ready && a.can(id), readOnly: !!(a.readOnly || (me && (me.readOnly || (me.role && me.role.readOnly)))), loading: !a.ready, error: null, reload: () => a.refresh && a.refresh() };
}
/** GET /api/admin/catalog (modules, starter roles, the Amanah → municipality hierarchy for the picker) */
export function useAdminCatalog() { return useLoad((signal) => adminApi.catalog({ signal }), []); }

/** "what will they see?": the preview of ONE role + ONE scope (POST /admin/preview), debounced; `body` null → no request */
export function usePreview(body, { debounce = 350 } = {}) {
  const key = body ? JSON.stringify(body) : '';
  const [state, setState] = useState({ data: null, error: null, loading: !!body });
  useEffect(() => {
    if (!body) { setState({ data: null, error: null, loading: false }); return undefined; }
    let live = true; const ac = new AbortController(); setState((s) => ({ ...s, loading: true, error: null }));
    const t = setTimeout(() => { adminApi.preview(body, { signal: ac.signal }).then((data) => { if (live) setState({ data, error: null, loading: false }); }, (error) => { if (live && !(error && error.name === 'AbortError')) setState({ data: null, error, loading: false }); }); }, debounce);
    return () => { live = false; clearTimeout(t); ac.abort(); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

export { AdminApiError };
