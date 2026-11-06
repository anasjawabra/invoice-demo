import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../context/I18nContext';
import { useAuth, useAccess } from '../../context/AuthContext';
import HIcon from './HeaderIcons';
import { headerText, userMenuItems } from './headerModel';
import { useDismiss } from './useHeaderHooks';
import { READ_ONLY_REASON } from '../../data/accessModel';
import { initialsOf } from '../../utils/identity';

function useLogout() {
  const { logout } = useAuth();
  const nav = useNavigate();
  return () => { logout(); nav('/login', { replace: true }); };
}

function Identity({ user, T }) {
  return (
    <>
      <span className="hd-avatar" aria-hidden="true">{initialsOf(T(user, 'name')) || 'U'}</span>
      <span className="hd-user__who">
        <span className="hd-user__name">{T(user, 'name')}</span>
        <span className="hd-user__role">{T(user, 'role')}</span>
      </span>
    </>
  );
}

// Desktop: avatar + name + role (truncated) + chevron in ONE button that opens a menu (name / role header, then Log out).
export function UserMenu() {
  const { lang, T } = useI18n();
  const { user } = useAuth();
  const access = useAccess();
  const scopeText = access.scopeSummary(lang);
  const summaryText = access.summary(lang); // «Collection Officer · Jeddah Amanah · 3 municipalities» (the server's me.summary)
  const doLogout = useLogout();
  const h = headerText(lang);
  const items = userMenuItems(lang);
  const [open, setOpen] = useState(false);
  const root = useRef(null); const btn = useRef(null); const menu = useRef(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, btn);
  useEffect(() => { if (open) menu.current?.querySelector('[role="menuitem"]')?.focus(); }, [open]);

  const onMenuKey = (e) => {
    const els = [...menu.current.querySelectorAll('[role="menuitem"]')];
    const i = els.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };
  const onBtnKey = (e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } };
  const run = (id) => { setOpen(false); if (id === 'logout') doLogout(); };

  return (
    <div className="hd-user" ref={root}>
      <button type="button" ref={btn} className="hd-user__btn" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} aria-label={`${h.userMenu}: ${T(user, 'name')}, ${T(user, 'role')}`} title={`${T(user, 'name')} · ${summaryText}`} onClick={() => setOpen((v) => !v)} onKeyDown={onBtnKey}>
        <Identity user={user} T={T} />
        <span className="hd-user__chev" data-open={open ? 'true' : undefined}><HIcon name="chevron" size={16} /></span>
      </button>
      {open && (
        <div className="hd-menu" id={menuId} role="menu" aria-label={h.userMenu} ref={menu} onKeyDown={onMenuKey}>
          <div className="hd-menu__head" role="presentation">
            <b>{T(user, 'name')}</b>
            <span className="hd-menu__scope" data-testid="user-scope">{summaryText}</span>
            {access.readOnly && <span className="hd-menu__scope" data-testid="user-readonly">{READ_ONLY_REASON[lang === 'en' ? 'en' : 'ar']}</span>}
          </div>
          {items.map((it) => (
            <button key={it.id} type="button" role="menuitem" className={`hd-menu__item${it.danger ? ' hd-menu__item--danger' : ''}`} onClick={() => run(it.id)}>
              <HIcon name={it.id} />
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Phone sheet: the same identity and the same actions as plain rows (the sheet itself is the menu).
export function UserBlock() {
  const { lang, T } = useI18n();
  const { user } = useAuth();
  const access = useAccess();
  const doLogout = useLogout();
  const items = userMenuItems(lang);
  return (
    <div className="hd-sheet__user">
      <div className="hd-user__static"><Identity user={user} T={T} /></div>
      <div className="hd-menu__scope" style={{ paddingInline: 12, fontSize: 12 }}>{access.summary(lang)}{access.readOnly ? ` · ${READ_ONLY_REASON[lang === 'en' ? 'en' : 'ar']}` : ''}</div>
      {items.map((it) => (
        <button key={it.id} type="button" className={`hd-row${it.danger ? ' hd-row--danger' : ''}`} onClick={() => it.id === 'logout' && doLogout()}>
          <HIcon name={it.id} />
          <span className="hd-row__text">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
