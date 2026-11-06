import React, { useRef, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { languageSwitchModel, nextLangIndex } from './headerModel';

// ONE compact segmented control «العربية | EN». Changing the language only updates the i18n context: the route, the query string,
// the filters and anything typed stay exactly where they are (nothing is navigated or remounted here).
export default function LanguageSwitch({ className = '' }) {
  const { lang, setLang, isRtl } = useI18n();
  const model = languageSwitchModel(lang);
  const refs = useRef([]);
  const [said, setSaid] = useState('');

  const choose = (code) => {
    if (code === model.options.find((o) => o.pressed)?.code) return;
    setLang(code);
    setSaid(model.announce(code));
  };
  const onKeyDown = (e, index) => {
    const next = nextLangIndex(index, e.key, isRtl);
    if (next == null) return;
    e.preventDefault();
    refs.current[next]?.focus();
  };

  return (
    <div className={`hd-lang ${className}`.trim()} role="group" aria-label={model.groupLabel}>
      {model.options.map((o, i) => (
        <button
          key={o.code}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          className="hd-lang__btn"
          aria-pressed={o.pressed}
          aria-label={o.label}
          title={o.title}
          lang={o.htmlLang}
          dir={o.dir}
          onClick={() => choose(o.code)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {o.short}
        </button>
      ))}
      <span className="sr-only" role="status" aria-live="polite">{said}</span>
    </div>
  );
}
