import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert02Icon, Cancel01Icon, CheckmarkCircle02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import UIIcon from './UIIcon';
import { useI18n } from '../context/I18nContext';

const ToastContext = createContext(null);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function iconFor(type) {
  switch (type) {
    case 'success':
      return CheckmarkCircle02Icon;
    case 'error':
      return Alert02Icon;
    case 'warning':
      return Alert02Icon;
    default:
      return InformationCircleIcon;
  }
}

function iconBg(type) {
  switch (type) {
    case 'success':
      return { background: 'var(--surface-success-subtle)', color: 'var(--success)' };
    case 'error':
      return { background: 'var(--surface-danger-subtle)', color: 'var(--danger)' };
    case 'warning':
      return { background: 'var(--surface-warning-subtle)', color: 'var(--text-warning)' };
    default:
      return { background: 'var(--surface-info-subtle)', color: 'var(--secondary)' };
  }
}

export function ToastProvider({ children }) {
  const { t: translate } = useI18n();
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((toast) => {
    const id = toast?.id || uid();
    const duration = typeof toast?.duration === 'number' ? toast.duration : 3400;

    const item = {
      id,
      type: toast?.type || 'info',
      title: toast?.title || translate(`toast_${toast?.type === 'warning' ? 'warning' : toast?.type === 'success' ? 'success' : toast?.type === 'error' ? 'error' : 'notice'}`),
      message: toast?.message || '',
      duration
    };

    setItems((prev) => [item, ...prev].slice(0, 6));

    const tm = setTimeout(() => remove(id), duration);
    timers.current.set(id, tm);

    return id;
  }, [remove, translate]);

  const api = useMemo(() => {
    return {
      push,
      remove,
      success: (message, opts) => push({ type: 'success', title: opts?.title, message, duration: opts?.duration }),
      error: (message, opts) => push({ type: 'error', title: opts?.title, message, duration: opts?.duration }),
      info: (message, opts) => push({ type: 'info', title: opts?.title, message, duration: opts?.duration }),
      warning: (message, opts) => push({ type: 'warning', title: opts?.title, message, duration: opts?.duration })
    };
  }, [push]);

  useEffect(() => {
    return () => {
      for (const tm of timers.current.values()) clearTimeout(tm);
      timers.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" role="region" aria-label={translate('notif')}>
          {items.map((t) => {
            const bg = iconBg(t.type);
            return (
              <div key={t.id} className="toast" role="status" onClick={() => remove(t.id)}>
                <div className="toast__inner">
                  <div className="toast__icon" style={{ background: bg.background, color: bg.color }}>
                    <UIIcon icon={iconFor(t.type)} size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="toast__title">{t.title}</div>
                    {t.message ? <div className="toast__msg">{t.message}</div> : null}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginInlineStart: 'auto', height: 30 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(t.id);
                    }}
                    aria-label={translate('close')}
                    type="button"
                  >
                    <UIIcon icon={Cancel01Icon} size={18} />
                  </button>
                </div>
                <div className="toast__bar">
                  <i style={{ animationDuration: `${t.duration}ms` }} />
                </div>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
