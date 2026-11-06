// THE single source of how a signed-in person is NAMED. Pure (no React, no storage); shared by the client and the data service.
//
// The authenticated user record is the only source of identity. It may hold a name in each language (`nameAr`, `nameEn`):
//   · both exist  → they identify the SAME person (the record's author guarantees it; nothing here ever guesses or transliterates a translation);
//   · only ONE exists → that one verified display name is shown in BOTH languages (a Latin name inside the Arabic interface is fine);
//   · none → the username (never an invented persona).
// Initials are generated from the name that is DISPLAYED (a stored `avatar` string is ignored: it can disagree with the name).
// The ROLE label is separate (accessModel.roleName: the role's own Arabic / English names) and never depends on the person's name.

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/** the name to show for `user` in `lang` ('ar' | 'en'): that language's name, else the other language's value of the SAME record, else the username / email / id. user = a `me` / user record ({ nameAr, nameEn, name?, username?, email?, id? }) */
export function displayName(user, lang = 'ar') {
  if (!user || typeof user !== 'object') return '';
  const ar = clean(user.nameAr); const en = clean(user.nameEn); const plain = clean(user.name);
  const first = lang === 'en' ? en || ar : ar || en;
  return first || plain || clean(user.username) || clean(user.user) || clean(user.email) || clean(user.id);
}

const ARABIC = /[؀-ۿ]/;
const DIACRITICS = /[ؐ-ًؚ-ٰٟـ]/g;
const letterOf = (w) => (Array.from(w)[0] || '');
const stripArticle = (w) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w);

/** two-letter initials of a displayed name. Two or more words → first letter of the first + first letter of the last word (hyphens and dots separate words); one word → its first two letters;
 *  Latin letters are upper-cased; an Arabic leading «ال» is skipped. Empty name → ''. */
export function initialsOf(name) {
  const s = clean(name).replace(DIACRITICS, '');
  if (!s) return '';
  const arabic = ARABIC.test(s);
  let words = s.split(/[\s\-·._,]+/).filter(Boolean);
  if (arabic) words = words.map(stripArticle);
  const out = words.length > 1 ? letterOf(words[0]) + letterOf(words[words.length - 1]) : Array.from(words[0] || '').slice(0, 2).join('');
  return arabic ? out : out.toUpperCase();
}

/** the avatar initials of `user` in `lang`, generated from the displayed name */
export const initialsFor = (user, lang = 'ar') => initialsOf(displayName(user, lang));
