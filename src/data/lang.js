// The ONE place that decides which interface languages exist: Arabic (default) and English.
// Anything else - a language removed earlier, a mistyped URL value, a corrupted stored value - becomes Arabic, never a blank screen.
export const SUPPORTED_LANGS = ['ar', 'en'];
export const DEFAULT_LANG = 'ar';

// 'en' / 'en-US' / ' EN-gb ' -> 'en'; 'ar' / 'AR' / 'ar-SA' -> 'ar'; everything else (zh, zh-CN, 'cn', '', null, undefined, objects) -> 'ar'
export function normalizeLang(v) {
  if (typeof v !== 'string') return DEFAULT_LANG;
  const s = v.trim().toLowerCase();
  if (s === 'en' || s.startsWith('en-') || s.startsWith('en_')) return 'en';
  return DEFAULT_LANG;
}

// the stored interface language of this browser tab (sessionStorage key ib_lang): read, normalised, and the stored value rewritten once when it was not already exactly 'ar' | 'en'
export const LANG_KEY = 'ib_lang';
export function readStoredLang(storage = (typeof sessionStorage !== 'undefined' ? sessionStorage : null)) {
  let raw = null;
  try { raw = storage ? storage.getItem(LANG_KEY) : null; } catch { raw = null; }
  const lang = normalizeLang(raw);
  if (raw != null && raw !== lang) { try { storage.setItem(LANG_KEY, lang); } catch { /* storage unavailable */ } }
  return lang;
}

// A record that carries Arabic / English variants of a field (nameAr / nameEn, or {ar,en}): the text for `lang`, falling back Ar <-> En <-> the base field; '' only when none exists
export function pickText(obj, field, lang) {
  if (!obj) return '';
  const l = normalizeLang(lang);
  const ar = obj[`${field}Ar`]; const en = obj[`${field}En`]; const base = obj[field];
  const pref = l === 'ar' ? [ar, en, base] : [en, ar, base];
  for (const v of pref) { if (typeof v === 'string' && v) return v; if (typeof v === 'number') return String(v); }
  return '';
}

// a bilingual object {ar,en}: same fallback, never any other key
export function pickBi(o, lang) {
  if (o == null) return '';
  if (typeof o === 'string') return o;
  const l = normalizeLang(lang);
  return (l === 'ar' ? o.ar || o.en : o.en || o.ar) || '';
}

// Stored data (a backup file, a saved conversation, a settings object) may carry a language value written when other languages existed.
// → { value, changed }: a deep copy where every `lang` / `language` / `locale` / `ib_lang` / `uiLang` field that holds a language code is normalised to 'ar' | 'en'.
// Only language-code-shaped strings are touched; every other value (names, amounts, user-entered text, attachments' content) is copied unchanged.
const LANG_FIELDS = new Set(['lang', 'language', 'locale', 'ib_lang', 'uiLang']);
const CODE_SHAPE = /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{1,8})*$/;
export function migrateLangFields(input) {
  let changed = false;
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) {
        if (LANG_FIELDS.has(k) && typeof x === 'string' && CODE_SHAPE.test(x.trim())) { const n = normalizeLang(x); if (n !== x) changed = true; o[k] = n; } else o[k] = walk(x);
      }
      return o;
    }
    return v;
  };
  const value = walk(input);
  return { value, changed };
}
