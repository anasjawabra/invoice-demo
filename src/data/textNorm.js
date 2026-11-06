// ONE text-normalisation function for everything that reads a typed request (Smart Reports interpreter, chat layer, request guard, entity resolver).
// Spelling variants fold to one form so «أمانة / امانة / أمانه», «جدة / جده», «ٱلرياض», «الريـــاض», «٢٠٢٦» and «RIYADH» are read alike:
//   * Arabic-Indic / Persian digits → 0-9 (BEFORE the diacritics range is stripped, which would otherwise delete them)
//   * tashkeel, Quranic marks and tatweel removed; zero-width / bidi control characters removed; presentation forms (ﻻ…) → NFKC
//   * alef forms أ إ آ ٱ → ا ;  ى → ي ;  ة → ه ;  Persian ی ک → ي ك ;  lower-case ; punctuation → space ; spaces collapsed
// `normText` is the text the interpreter's patterns run on (the same output as the previous `norm`, plus digits / zero-width / Persian letters).
// `looseKey` is a STRONGER fold used only to compare NAMES (hamza on waw / ya, ظ ↔ ض, doubled letters) — never to run patterns on.
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'; const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const toWesternDigits = (t) => String(t ?? '').replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
const ZERO_WIDTH = /[​-‏‪-‮⁦-⁩﻿­]/g;

// the raw request cleaned for matching but keeping its own letters (hamza, ta-marbuta, case): digits, tashkeel, tatweel, zero-width characters, spaces
export function cleanRaw(t) {
  return toWesternDigits(String(t ?? '').normalize('NFKC')).replace(ZERO_WIDTH, '').replace(/[ً-ٰٟۖ-ۭ]/g, '').replace(/ـ/g, '').replace(/[  -  ]/g, ' ').replace(/\s+/g, ' ').trim();
}
export const normText = (t) => cleanRaw(t).toLowerCase()
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ی/g, 'ي').replace(/ک/g, 'ك')
  .replace(/[؟?!.,،؛;:]/g, ' ').replace(/\s+/g, ' ').trim();

// A NAME key: pattern-free, stronger than normText. Arabic: hamza seats ؤ ئ ء dropped to their carrier, ظ → ض (the common mis-spelling «الرياظ»), doubled letters collapsed.
// Latin: diacritics and apostrophes / hyphens dropped («Ha'il» = «Hail», «Al-Ahsa» = «Al Ahsa» handled by the caller), doubled letters collapsed («Jeddah» = «Jedah»), «dh» → «d» («Riyadh» = «Riyad»).
export function looseKey(t) {
  let s = normText(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`ʿʾ‘]/g, '');
  s = s.replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '').replace(/ظ/g, 'ض').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/dh\b/g, 'd').replace(/(.)\1+/g, '$1');
  return s;
}
// the same key per word (the unit the entity resolver compares)
export const wordKeys = (t) => looseKey(t).split(' ').filter(Boolean);
// strip the glued Arabic clitics from ONE normalised word: و ف (and) · ب (with/in) · ل (for) · ك (like) + the article ال; «للرياض» → «رياض», «بالرياض» → «رياض»
export function stripClitics(w) {
  const out = new Set([w]);
  let cur = w;
  for (let i = 0; i < 3; i += 1) {
    let next = cur;
    if (/^لل.{2,}/.test(cur)) next = `ال${cur.slice(2)}`; // ل + ال → لل («للمدينة» = ل + «المدينة»)
    else if (/^[وفبلك].{3,}/.test(cur) && !/^(?:ال)/.test(cur)) next = cur.slice(1);
    else if (/^ال.{2,}/.test(cur)) next = cur.slice(2);
    if (next === cur) break;
    out.add(next); cur = next;
  }
  return [...out];
}
