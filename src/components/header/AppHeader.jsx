import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useI18n } from '../../context/I18nContext';
import { useRevenue } from '../../context/RevenueContext';
import HIcon from './HeaderIcons';
import LanguageSwitch from './LanguageSwitch';
import ThemeToggle from './ThemeToggle';
import { UserMenu, UserBlock } from './UserMenu';
import { headerText } from './headerModel';
import { useCompact, useDismiss } from './useHeaderHooks';

// The illustrative-data tag: small and quiet, the same wording and meaning as before; it opens the explanation (Esc / outside click closes).
function DemoBadge({ note, atStart = false }) {
  const { lang } = useI18n();
  const h = headerText(lang);
  const [open, setOpen] = useState(false);
  const root = useRef(null); const btn = useRef(null); const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root, btn);
  return (
    <div className={`hd-demo${atStart ? ' hd-demo--start' : ''}`} ref={root}>
      <button type="button" ref={btn} className="hd-demo__btn" aria-expanded={open} aria-controls={open ? id : undefined} title={h.demoBadgeHelp} onClick={() => setOpen((v) => !v)}>{h.demoBadge}</button>
      {open && <div className="hd-demo__pop" id={id} role="note">{note}</div>}
    </div>
  );
}

// The ONE shared application header (a single <header> landmark): [sidebar button + identity on phones] · illustrative-data tag ·
// spacer · language · theme · user menu (the signed-in account: name + role + log out). There is no organisation / persona switcher and no notification control:
// the data a person sees follows ONLY their account's role and geographic scope (docs/access-control.md). Up to 900 px (where the sidebar becomes a drawer) the secondary controls sit behind one button.
// The platform identity lives in the sidebar on desktop (one place); the compact header shows it because the drawer is closed there.
export default function AppHeader({ drawerOpen, onToggleDrawer, menuBtnRef }) {
  const { t, lang } = useI18n();
  const rev = useRevenue();
  const h = headerText(lang);
  const ar = lang !== 'en';
  const compact = useCompact();
  const [sheet, setSheet] = useState(false);
  const root = useRef(null); const moreBtn = useRef(null); const sheetRef = useRef(null); const sheetId = useId();
  const closeSheet = useCallback(() => setSheet(false), []);
  useDismiss(sheet, closeSheet, root, moreBtn);
  useEffect(() => { if (!compact) setSheet(false); }, [compact]);
  useEffect(() => { if (sheet) sheetRef.current?.focus({ preventScroll: true }); }, [sheet]);

  const size = rev.meta?.size === 'compact' ? (ar ? ` (عينة مضغوطة: ${rev.meta.counts?.invoicesTotal ?? ''} فاتورة)` : ` (compact sample: ${rev.meta.counts?.invoicesTotal ?? ''} invoices)`) : '';
  const note = ar ? `بيانات اصطناعية وليست بيانات الوزارة الفعلية${size}. التواريخ والأوقات بتوقيت الرياض.` : `Synthetic data, not the Ministry’s actual data${size}. Dates and times are Asia/Riyadh.`;

  return (
    <header className="hd" ref={root} data-compact={compact ? 'true' : undefined}>
      <div className="hd__start">
        {compact && (
          <button type="button" ref={menuBtnRef} className="hd-btn hd-btn--icon" aria-expanded={drawerOpen} aria-controls="app-sidebar" aria-label={h.menu} title={h.menu} onClick={onToggleDrawer}><HIcon name="menu" /></button>
        )}
        {compact && (
          <NavLink to="/" className="hd-brand" aria-label={t('side_brand')}>
            <span className="hd-brand__logo" aria-hidden="true">IB</span>
            <span className="hd-brand__name">{t('side_brand')}</span>
          </NavLink>
        )}
        {!compact && <DemoBadge note={note} atStart />}
      </div>

      <div className="hd__end">
        {compact ? (
          <>
            <DemoBadge note={note} />
            <button type="button" ref={moreBtn} className="hd-btn hd-btn--icon" aria-expanded={sheet} aria-controls={sheetId} aria-label={h.more} title={h.more} onClick={() => setSheet((v) => !v)}><HIcon name={sheet ? 'close' : 'more'} /></button>
          </>
        ) : (
          <>
            <LanguageSwitch />
            <ThemeToggle />
            <UserMenu />
          </>
        )}
      </div>

      {compact && sheet && (
        <div className="hd-sheet" id={sheetId} ref={sheetRef} role="region" aria-label={h.more} tabIndex={-1}>
          <div className="hd-sheet__line"><span className="hd-sheet__label">{ar ? 'اللغة' : 'Language'}</span><LanguageSwitch /></div>
          <ThemeToggle withLabel />
          <UserBlock />
        </div>
      )}
    </header>
  );
}
