import { useId, useRef } from 'react';

// Horizontal tabs use automatic activation. DOM direction keeps nested RTL
// sections correct without coupling navigation to the current language.
export default function useTabs({ keys, value, onChange, idPrefix }) {
  const id = useId();
  const prefix = idPrefix || `tabs-${id}`;
  const buttons = useRef(new Map());
  const getTabProps = (key) => ({
    type: 'button',
    role: 'tab',
    id: `${prefix}-tab-${key}`,
    'aria-selected': value === key,
    'aria-controls': `${prefix}-panel-${key}`,
    tabIndex: value === key ? 0 : -1,
    ref: (node) => { if (node) buttons.current.set(key, node); else buttons.current.delete(key); },
    onClick: () => onChange(key),
    onKeyDown: (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || !keys.length) return;
      const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
      const index = keys.indexOf(key);
      let next;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = keys.length - 1;
      else if (event.key === 'ArrowRight') next = (index + (rtl ? -1 : 1) + keys.length) % keys.length;
      else if (event.key === 'ArrowLeft') next = (index + (rtl ? 1 : -1) + keys.length) % keys.length;
      else return;
      event.preventDefault();
      buttons.current.get(keys[next])?.focus();
      onChange(keys[next]);
    }
  });
  const getPanelProps = (key) => ({
    role: 'tabpanel',
    id: `${prefix}-panel-${key}`,
    'aria-labelledby': `${prefix}-tab-${key}`,
    tabIndex: 0
  });
  return { getTabProps, getPanelProps };
}
