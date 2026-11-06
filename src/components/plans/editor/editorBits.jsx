import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../../context/I18nContext';
import { topModal } from '../../../utils/modalFocus';
import { tt } from './editorText';
import { milInputText, parseMillions, parsePctToBp, bpText, riyalText } from './editorLogic';

/* Shared building blocks of the plan editor: translation hook, inline icons (same 24 px / 2 px stroke style as the header and sidebar icons — no icon package), notices, the modal overlay used by the side panel and the
   preview / check-list dialogs, and the two number inputs (million riyals, percent). Tab is trapped by Layout's global handler for every [role=dialog][aria-modal=true]; Escape only closes the TOPMOST one. */

export function useTx() {
  const i = useI18n() || {}; const lang = i.lang === 'en' ? 'en' : 'ar';
  const tx = React.useCallback((key, vars) => tt(key, lang, vars), [lang]);
  return { tx, lang, ar: lang === 'ar' };
}

const ICONS = {
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
};
export function Icon({ name, size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{ICONS[name] || ICONS.info}</svg>;
}

export function Notice({ kind = 'info', title, children, role, className = '' }) {
  return (
    <div className={`pe-notice pe-notice--${kind} ${className}`} role={role || (kind === 'error' ? 'alert' : 'status')}>
      <span className="pe-notice__ic"><Icon name={kind === 'ok' ? 'check' : 'info'} /></span>
      <div className="pe-notice__body">{title && <b>{title}</b>}{children}</div>
    </div>
  );
}

export function Chip({ kind = 'neutral', children, title }) { return <span className={`pe-chip pe-chip--${kind}`} title={title}>{children}</span>; }

let lockCount = 0;
function lockScroll() { if (typeof document === 'undefined') return () => {}; lockCount += 1; const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; let done = false; return () => { if (done) return; done = true; lockCount -= 1; if (lockCount <= 0) { lockCount = 0; document.body.style.overflow = prev === 'hidden' ? '' : prev; } }; }

/** modal overlay: role=dialog + aria-modal, focus moves in on open and back to the opener on close, Escape closes the topmost only. `variant` 'panel' = the side panel / mobile sheet, 'dialog' = a centred dialog. */
export function Overlay({ variant = 'dialog', title, subtitle, onClose, children, footer, headExtra = null, dismissible = true, closeLabel, className = '', labelledBy = null, size = 'md' }) {
  const { tx } = useTx(); const ref = useRef(null); const titleId = useId(); const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const el = ref.current; const prev = opener.current;
    const first = el && el.querySelector('[data-autofocus]'); (first || el)?.focus?.({ preventScroll: true });
    const key = (e) => { if (e.key === 'Escape' && dismissible && topModal() === el) { e.stopPropagation(); closeRef.current?.(); } };
    document.addEventListener('keydown', key);
    const unlock = lockScroll();
    return () => { document.removeEventListener('keydown', key); unlock(); if (prev && prev.isConnected) prev.focus?.({ preventScroll: true }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const node = (
    <div className={`pe-overlay pe-overlay--${variant}`} onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) closeRef.current?.(); }}>
      <div ref={ref} className={`pe-box pe-box--${variant} pe-box--${size} ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy || titleId} tabIndex={-1}>
        <header className="pe-box__head">
          <div className="pe-box__titles"><h2 id={titleId} className="pe-box__title">{title}</h2>{subtitle && <div className="pe-box__sub">{subtitle}</div>}</div>
          {headExtra}
          {dismissible && <button type="button" className="pe-iconbtn" onClick={() => closeRef.current?.()} aria-label={closeLabel || tx('common.close')}><Icon name="close" size={18} /></button>}
        </header>
        <div className="pe-box__body">{children}</div>
        {footer && <footer className="pe-box__foot">{footer}</footer>}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? node : createPortal(node, document.body);
}

/** a labelled form field: label, control (children), hint and error. */
export function Field({ label, htmlFor, hint, error, children, className = '' }) {
  return (
    <div className={`pe-field ${className}`}>
      {label && <label htmlFor={htmlFor} className="pe-field__lbl">{label}</label>}
      {children}
      {hint && <div className="pe-field__hint" id={htmlFor ? `${htmlFor}-hint` : undefined}>{hint}</div>}
      {error && <div className="pe-field__err" role="alert">{error}</div>}
    </div>
  );
}

/**
 * An amount typed in the platform unit (million riyals). The text is kept while typing; on blur / Enter it is parsed to WHOLE RIYALS (rounded to the nearest riyal when it has more than six decimals — the rounding is stated under the
 * field). The exact riyals are in the tooltip and printed under the field unless `compact`. A blank value commits `null` (no amount). An invalid text marks the field and commits nothing.
 */
export function AmountInput({ id, value, onCommit, disabled, label, compact = false, placeholder = '—', disabledReason = null, describedBy }) {
  const { tx, lang } = useTx(); const [text, setText] = useState(null); const [bad, setBad] = useState(false);
  const shown = text ?? milInputText(value);
  const parsed = text !== null ? parseMillions(text) : null;
  const commit = () => {
    if (text === null) return; const p = parseMillions(text);
    if (p.invalid) { setBad(true); return; }
    setBad(false); setText(null); onCommit(p.empty ? null : p.riyals);
  };
  const exact = parsed && !parsed.empty && !parsed.invalid ? parsed.riyals : value;
  return (
    <div className="pe-amt">
      <input id={id} className="input pe-amt__in" dir="ltr" inputMode="decimal" aria-label={label} aria-invalid={bad ? 'true' : undefined} aria-describedby={describedBy} disabled={disabled} title={disabled && disabledReason ? disabledReason : riyalText(exact, lang)}
        value={shown} placeholder={placeholder} onChange={(e) => { setText(e.target.value); setBad(false); }} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape' && text !== null) { e.stopPropagation(); setText(null); setBad(false); } }} />
      {bad && <div className="pe-field__err" role="alert">{tx('amount.invalid')}</div>}
      {!compact && !bad && exact !== null && exact !== undefined && <div className="pe-amt__exact" dir="auto">{tx('amount.exact', { value: riyalText(exact, lang) })}{parsed && parsed.rounded ? ` · ${tx('amount.rounded')}` : ''}</div>}
      {compact && parsed && parsed.rounded && !bad && <div className="pe-amt__exact">{tx('amount.rounded')}</div>}
    </div>
  );
}

/** a percentage typed as text (basis-point resolution, 0.01 %). `onCommit(bp)`; blank = 0. */
export function PctInput({ id, bp, onCommit, disabled, label, readOnly = false }) {
  const { tx } = useTx(); const [text, setText] = useState(null); const [bad, setBad] = useState(false);
  const shown = text ?? (bp ? bpText(bp) : '');
  const commit = () => { if (text === null) return; const p = parsePctToBp(text); if (p.invalid) { setBad(true); return; } setBad(false); setText(null); onCommit(p.bp); };
  return (
    <span className="pe-pct">
      <input id={id} className="input pe-pct__in" dir="ltr" inputMode="decimal" aria-label={label} aria-invalid={bad ? 'true' : undefined} disabled={disabled} readOnly={readOnly} value={readOnly ? bpText(bp) : shown} placeholder="0"
        onChange={(e) => { setText(e.target.value); setBad(false); }} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
      <span className="pe-pct__sign" aria-hidden="true">%</span>
      {bad && <span className="pe-field__err" role="alert">{tx('pct.invalid')}</span>}
    </span>
  );
}
