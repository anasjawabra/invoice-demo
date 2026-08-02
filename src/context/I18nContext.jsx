import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations } from '../data/i18n';

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => sessionStorage.getItem('ib_lang') || 'en');

  const setLang = useCallback((l) => {
    setLangState(l);
    sessionStorage.setItem('ib_lang', l);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang === 'zh' ? 'zh-CN' : lang === 'ar' ? 'ar' : 'en';
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const t = useCallback((key) => {
    if (translations[lang] && translations[lang][key] != null) return translations[lang][key];
    if (translations.en[key] != null) return translations.en[key];
    return key;
  }, [lang]);

  const T = useCallback((obj, field) => {
    if (!obj) return '';
    const suffix = lang === 'zh' ? '' : lang.charAt(0).toUpperCase() + lang.slice(1);
    const key = field + suffix;
    return obj[key] || obj[field] || '';
  }, [lang]);

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
