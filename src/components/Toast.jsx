import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function iconFor(type) {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '!';
    case 'warning':
      return '!';
    default:
      return 'i';
  }
}

function iconBg(type) {
  switch (type) {
    case 'success':
      return { background: 'rgba(53, 208, 127, 0.16)', color: 'var(--green)' };
    case 'error':
      return { background: 'rgba(255, 106, 106, 0.14)', color: 'var(--red)' };
    case 'warning':
      return { background: 'rgba(255, 159, 67, 0.14)', color: 'var(--orange)' };
    default:
      return { background: 'rgba(74, 168, 255, 0.12)', color: 'var(--blue)' };
  }
}

export function ToastProvider({ children }) {
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
        <div className="toast-stack" role="region" aria-label="Notifications">
          {items.map((t) => {
            const bg = iconBg(t.type);
            return (
              <div key={t.id} className="toast" role="status" onClick={() => remove(t.id)}>
                <div className="toast__inner">
                  <div className="toast__icon" style={{ background: bg.background, color: bg.color }}>
                    {iconFor(t.type)}
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
                    aria-label="Close"
                    type="button"
                  >
                    ×
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
