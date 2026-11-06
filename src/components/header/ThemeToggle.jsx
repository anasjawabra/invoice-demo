import React from 'react';
import { useI18n } from '../../context/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import HIcon from './HeaderIcons';
import { headerText } from './headerModel';

// Icon button (or, with `withLabel`, a full-width row in the phone sheet). The theme logic stays in ThemeContext.
export default function ThemeToggle({ withLabel = false }) {
  const { lang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const h = headerText(lang);
  const dark = theme === 'dark';
  const label = dark ? h.themeToLight : h.themeToDark;
  return (
    <button type="button" className={withLabel ? 'hd-row' : 'hd-btn hd-btn--icon'} onClick={toggleTheme} aria-pressed={dark} aria-label={withLabel ? undefined : label} title={label}>
      <HIcon name={dark ? 'sun' : 'moon'} />
      {withLabel && <span className="hd-row__text">{label}</span>}
    </button>
  );
}
