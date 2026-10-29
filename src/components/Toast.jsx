import UISymbol from './UISymbol';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../context/I18nContext';
import { localize } from '../utils/zh';

const ToastContext = createContext(null);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function iconFor(type) {
  switch (type) {
    case 'success':
      return <UISymbol name="check" size={20} />;
    case 'error':
      return <UISymbol name="warning" size={20} />;
    case 'warning':
      return <UISymbol name="warning" size={20} />;
    default:
      return <UISymbol name="info" size={20} />;
  }
}

function iconBg(type) {
  switch (type) {
    case 'success':
      return { background: 'var(--ui-tint)', color: 'var(--ui-green-text)' };
    case 'error':
      return { background: 'color-mix(in srgb, var(--error-text) 10%, var(--surface))', color: 'var(--error-text)' };
    case 'warning':
      return { background: 'color-mix(in srgb, var(--warning-text) 10%, var(--surface))', color: 'var(--warning-text)' };
    default:
      return { background: 'color-mix(in srgb, var(--info-text) 10%, var(--surface))', color: 'var(--info-text)' };
  }
}

export function ToastProvider({ children }) {
  const { lang } = useI18n();
  const label = (en, ar) => lang === 'ar' ? ar : localize(en, lang);
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
      title: toast?.title || (toast?.type === 'success' ? 'Success' : toast?.type === 'error' ? 'Error' : 'Notice'),
      message: toast?.message || '',
      duration
    };

    setItems((prev) => [item, ...prev].slice(0, 6));

    const tm = setTimeout(() => remove(id), duration);
    timers.current.set(id, tm);

    return id;
  }, [remove]);

  const api = useMemo(() => {
    return {
      push,
      remove,
      success: (message, opts) => push({ type: 'success', title: opts?.title || 'Success', message, duration: opts?.duration }),
      error: (message, opts) => push({ type: 'error', title: opts?.title || 'Error', message, duration: opts?.duration }),
      info: (message, opts) => push({ type: 'info', title: opts?.title || 'Notice', message, duration: opts?.duration }),
      warning: (message, opts) => push({ type: 'warning', title: opts?.title || 'Warning', message, duration: opts?.duration })
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
        <div className="toast-stack" role="region" aria-label={label('Notifications', 'الإشعارات')}>
          {items.map((t) => {
            const bg = iconBg(t.type);
            return (
              <div key={t.id} className="toast" role="status" onClick={() => remove(t.id)}>
                <div className="toast__inner">
                  <div className="toast__icon" style={{ background: bg.background, color: bg.color }}>
                    {iconFor(t.type)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="toast__title">{lang === 'ar' ? ({ Notice: 'تنبيه', Success: 'نجاح', Error: 'خطأ', Warning: 'تحذير' }[t.title] || t.title) : localize(t.title, lang)}</div>
                    {t.message ? <div className="toast__msg">{localize(t.message, lang)}</div> : null}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginInlineStart: 'auto', height: 30 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(t.id);
                    }}
                    aria-label={label('Close', 'إغلاق')}
                    type="button"
                  ><UISymbol name="close" /></button>
                </div>
                <div className="toast__bar">
                  <i style={{ animationDuration: `${t.duration}ms`, background: bg.color }} />
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
