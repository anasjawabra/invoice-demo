import { normalizeLang } from '../../data/lang';

// Pure logic of the shared application header (no React): the language switch model, the user-menu items and the compact (phone) menu items. Unit-tested in tests/header.test.mjs.

// The two supported interface languages. Order = DOM order: العربية then EN (so «العربية | EN» reads naturally in both directions).
export const LANG_OPTIONS = [
  { code: 'ar', short: 'العربية', full: 'العربية', htmlLang: 'ar', dir: 'rtl' },
  { code: 'en', short: 'EN', full: 'English', htmlLang: 'en', dir: 'ltr' }
];

// Anything that is not one of the supported languages (a stale stored preference) is shown as Arabic, the default.
export function activeLang(lang) {
  return normalizeLang(lang);
}

// The segmented control's two buttons for the current language (exactly one is pressed).
export function languageSwitchModel(lang) {
  const active = activeLang(lang);
  const ar = active === 'ar';
  return {
    groupLabel: ar ? 'اللغة' : 'Language',
    options: LANG_OPTIONS.map((o) => ({
      ...o,
      pressed: o.code === active,
      // the accessible name of a button is its own language's full name, plus the state in the interface language
      label: o.full,
      title: o.code === active ? (ar ? `اللغة الحالية: ${o.full}` : `Current language: ${o.full}`) : (ar ? `التبديل إلى ${o.full}` : `Switch to ${o.full}`)
    })),
    announce: (code) => (code === 'en' ? 'Switched to English' : 'تم التبديل إلى العربية')
  };
}

// Arrow-key navigation inside the group: returns the index to focus next (or null if the key is not handled).
// In a right-to-left page the visual right is the DOM start, so ArrowRight moves to the previous button there.
export function nextLangIndex(index, key, isRtl, count = LANG_OPTIONS.length) {
  const step = (d) => (index + d + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight') return step(isRtl ? -1 : 1);
  if (key === 'ArrowLeft') return step(isRtl ? 1 : -1);
  if (key === 'ArrowDown') return step(1);
  if (key === 'ArrowUp') return step(-1);
  return null;
}

// The user menu (desktop and inside the phone sheet): who is signed in, then the account actions. Logout lives here only.
export function userMenuItems(lang) {
  const ar = activeLang(lang) === 'ar';
  return [{ id: 'logout', label: ar ? 'تسجيل الخروج' : 'Log out', danger: true }];
}

// The phone sheet: every secondary control of the desktop header, in order, behind one button.
export function mobileMenuItems() {
  return [{ id: 'language' }, { id: 'theme' }, { id: 'user' }];
}

// The compact layout applies up to this width (the same width at which the sidebar becomes a drawer).
export const COMPACT_MAX_WIDTH = 900;
export const COMPACT_QUERY = `(max-width: ${COMPACT_MAX_WIDTH}px)`;

// Header labels in the two languages (new strings only; existing ones come from the translation catalogue).
export function headerText(lang) {
  const ar = activeLang(lang) === 'ar';
  return {
    menu: ar ? 'القائمة' : 'Menu',
    more: ar ? 'التحكم والحساب' : 'Controls and account',
    close: ar ? 'إغلاق' : 'Close',
    theme: ar ? 'المظهر' : 'Theme',
    themeToDark: ar ? 'التبديل إلى الوضع الداكن' : 'Switch to dark mode',
    themeToLight: ar ? 'التبديل إلى الوضع الفاتح' : 'Switch to light mode',
    account: ar ? 'الحساب' : 'Account',
    userMenu: ar ? 'قائمة المستخدم' : 'User menu',
    demoBadge: ar ? 'بيانات تجريبية' : 'Demo data',
    demoBadgeHelp: ar ? 'بيانات تجريبية: اصطناعية وليست بيانات الوزارة الفعلية' : 'Demo data: synthetic, not the Ministry’s actual data'
  };
}
