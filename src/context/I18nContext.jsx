import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations } from '../data/i18n';
import { normalizeLang, readStoredLang, pickText, LANG_KEY } from '../data/lang';

const I18nContext = createContext();

// Arabic and English are the only interface languages. A stored, URL or programmatic value that is anything else (a removed language, a typo, a corrupted value)
// is read as Arabic and the stored value is rewritten once (readStoredLang), so an old session never lands on a blank or half-translated screen.
export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => readStoredLang());

  const setLang = useCallback((l) => {
    const next = normalizeLang(l);
    setLangState(next);
    try { sessionStorage.setItem(LANG_KEY, next); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang === 'ar' ? 'ar' : 'en';
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const t = useCallback((key) => {
    if (translations[lang] && translations[lang][key] != null) return translations[lang][key];
    if (translations.en[key] != null) return translations.en[key];
    if (translations.ar[key] != null) return translations.ar[key];
    return key;
  }, [lang]);

  // T(record, 'name') -> record.nameAr in Arabic, record.nameEn in English; falls back Ar <-> En <-> record.name; '' only when none of the three exists
  const T = useCallback((obj, field) => pickText(obj, field, lang), [lang]);

  const isRtl = lang === 'ar';

  return (
    <I18nContext.Provider value={{ lang, setLang, t, T, isRtl }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
