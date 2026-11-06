// ============================================================================
// Municipality names in a typed report request («تقرير أمانة جدة بلدية القوز», “Jeddah municipality of …”).
// The REFERENCE hierarchy (src/data/amanahHierarchy.js) is the only source of names: this module builds a phrase index from it with the project's Arabic
// normalisation (بلدية/بلديه, ة/ه, أ/ا, tashkeel, «بلدية محافظة X» = «بلدية X» = «X»), and finds the municipalities a phrase can mean — ALL of them, across Amanahs:
// the caller (requestEntities.js) decides whether the phrase is unique, ambiguous, outside the stated Amanah, unknown or not permitted. Nothing here picks "the first".
// English matching aliases exist for the Jeddah Amanah only (transliterations a person may type); they are used to MATCH, never shown — the UI always shows the reference name.
// ============================================================================
import { ENTITIES, N_AMANAH } from './catalog';
import { municipalitiesOf } from './amanahHierarchy';
import { looseKey } from './textNorm';

const isArabic = (s) => /[؀-ۿ]/.test(s);
const stripAl = (w) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w);
const BALADIYA = new Set(['بلديه']); // the noun word (looseKey form)
const GOVERNORATE = new Set(['محافضه']); // «محافظة» through looseKey (ظ → ض)

// a name → the word keys the matcher compares (same fold as requestEntities.phraseKeys: looseKey per word, the Arabic article dropped)
export const nameWords = (str) => looseKey(String(str).replace(/[()]/g, ' ')).split(' ').filter(Boolean).map((x) => (isArabic(x) ? stripAl(x) : x));

// Transliterations people type for the Jeddah Amanah's municipalities (matching only; the reference has Arabic names only).
const EN_ALIASES = {
  'MREF-002-001': ['rabigh', 'rabegh', 'rabeg'], 'MREF-002-002': ['qunfudhah', 'qunfudah', 'qunfuda', 'al qunfudhah'], 'MREF-002-003': ['laith', 'lith', 'al laith', 'al lith'],
  'MREF-002-004': ['khulais', 'khulays', 'khulaiss'], 'MREF-002-005': ['al qouz', 'qouz', 'al qoz', 'qoz'], 'MREF-002-006': ['al kamil', 'kamil', 'kamel'], 'MREF-002-007': ['adham', 'adam'],
  'MREF-002-008': ['south al ardiyat', 'southern al ardiyat', 'al ardiyat al janubiyah', 'ardiyat south'], 'MREF-002-009': ['hajar'], 'MREF-002-010': ['al muzaylif', 'muzaylif', 'al mudhaylif'],
  'MREF-002-011': ['al hala', 'hala'], 'MREF-002-013': ['north al ardiyat', 'northern al ardiyat', 'al ardiyat al shamaliyah', 'ardiyat north'], 'MREF-002-014': ['ghamiqah', 'ghumayqah', 'ghamika'], 'MREF-002-015': ['sabt al jarah', 'sabt aljara', 'sabt al jara']
};

let INDEX = null;
/** the phrase index: [{ refId, key, amanah, ar, phrases:[[word…]…] }] for the 17 Amanahs' reference municipalities. Built once. */
export function municipalityIndex() {
  if (INDEX) return INDEX;
  INDEX = [];
  for (const ent of ENTITIES.slice(0, N_AMANAH)) {
    for (const m of municipalitiesOf(ent.en)) {
      const all = nameWords(m.ar).filter((w) => !BALADIYA.has(w)); const paren = /\(/.test(m.sourceNameAr || m.ar);
      const mainText = String(m.ar).split('(')[0]; const main = nameWords(mainText).filter((w) => !BALADIYA.has(w));
      const noGov = (ws) => ws.filter((w) => !GOVERNORATE.has(w));
      const cand = [all, noGov(all), main, noGov(main)];
      if (!paren) cand.splice(2);
      for (const a of (EN_ALIASES[m.refId] || [])) cand.push(nameWords(a), nameWords(a).filter((w) => w !== 'al'));
      const seen = new Set(); const phrases = [];
      for (const p of cand) { const k = p.join(' '); if (p.length && !seen.has(k)) { seen.add(k); phrases.push(p); } }
      INDEX.push({ refId: m.refId, key: m.key, amanah: ent.en, ar: m.ar, phrases });
    }
  }
  return INDEX;
}
export const municipalityRecordsOf = (amanah) => municipalityIndex().filter((m) => m.amanah === amanah);
export const municipalityRecord = (refId) => municipalityIndex().find((m) => m.refId === refId) || null;

/**
 * The municipalities whose name starts at token `i` (tokens[i..]): the LONGEST matching phrase wins; every municipality with a phrase of that length is returned
 * (more than one = the same name in several places). vars[i] = the comparable keys of token i. `taken[i]` = already consumed.
 * → { len, cands:[index entries] } | null
 */
export function matchMunicipalityAt(vars, taken, i, n = vars.length) {
  let best = 0; let cands = [];
  for (const m of municipalityIndex()) {
    let top = 0;
    for (const p of m.phrases) {
      if (i + p.length > n || p.length <= top) continue;
      let ok = true; for (let j = 0; j < p.length; j += 1) { if (taken[i + j] || !vars[i + j].has(p[j])) { ok = false; break; } }
      if (ok) top = p.length;
    }
    if (top > best) { best = top; cands = [m]; } else if (top === best && top > 0) cands.push(m);
  }
  return best ? { len: best, cands } : null;
}
/** the same for a name written BEFORE the noun («Rabigh municipality»): the match must end exactly at token `end` (exclusive) */
export function matchMunicipalityEndingAt(vars, taken, end) {
  for (let len = Math.min(4, end); len >= 1; len -= 1) {
    const i = end - len; const r = matchMunicipalityAt(vars, taken, i, end);
    if (r && r.len === len) return { ...r, start: i };
  }
  return null;
}

/** the municipalities that look like `target` (a phrase the person wrote), nearest first — SUGGESTIONS only (an edit distance never resolves a name) */
export function nearestMunicipalities(phraseWords, pool, max = 3) {
  const target = phraseWords.join(' '); if (target.length < 3) return [];
  const lev = (a, b) => { if (a === b) return 0; let prev = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i += 1) { const cur = [i]; for (let j = 1; j <= b.length; j += 1) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[b.length]; };
  const scored = [];
  for (const m of pool) {
    let best = Infinity;
    for (const p of m.phrases) { const k = p.join(' '); const tol = Math.max(1, Math.min(2, Math.floor(Math.max(k.length, target.length) / 4))); const d = lev(target, k); if (d <= tol && d < best) best = d; }
    if (best < Infinity) scored.push({ m, d: best });
  }
  return scored.sort((a, b) => a.d - b.d).slice(0, max).map((x) => x.m);
}

/* ---------- the explicit groups: «بلا بلدية / غير محددة» and «مباشر على الأمانة» ---------- */
// Patterns run on windows of NORMALISED tokens (normText form): [from, to) is the token span they consume.
const NOT_SPECIFIED_RE = [
  /^(?:بلا|بدون|دون|من غير|ما فيه|ما في) (?:ال)?بلديه$/, /^(?:ال)?بلديه (?:غير|لم) (?:محدده|تحدد|محدد)(?: في المصدر)?$/, /^(?:ال)?بلديات? غير محدده(?: في المصدر)?$/,
  /^(?:without|no|missing) (?:a )?municipality$/, /^municipality not (?:specified|stated|known)(?: in (?:the )?source)?$/, /^unspecified municipality$/, /^(?:not|un)specified municipalit(?:y|ies)$/
];
const DIRECT_RE = [
  /^(?:ال)?فواتير? (?:ال)?مباشره? (?:علي|من|لدي|عن) (?:ال)?امانه$/, /^(?:مباشر|مباشره|صادره? مباشره?|تصدرها? الامانه مباشره?) (?:علي|من|عن|لدي)? ?(?:ال)?امانه$/, /^(?:مباشر|مباشره) (?:ال)?امانه$/, /^(?:صادر|صادره|تصدرها?) (?:من )?(?:ال)?امانه مباشره$/,
  /^(?:issued )?directly (?:by|from|on) (?:the )?amanah$/, /^direct(?:ly)? (?:on )?(?:the )?amanah$/, /^direct amanah$/, /^amanah direct$/
];
/** the explicit municipality groups named in the request → [{ token:'NOT_SPECIFIED'|'DIRECT', span:[lo,hi) }] (longest window first; spans never overlap) */
export function findMunicipalityGroups(tokens) {
  const out = []; const n = tokens.length; const taken = new Array(n).fill(false);
  for (let len = 5; len >= 2; len -= 1) {
    for (let i = 0; i + len <= n; i += 1) {
      if (taken.slice(i, i + len).some(Boolean)) continue;
      const w = tokens.slice(i, i + len).map((t) => t.n).join(' ');
      const tok = NOT_SPECIFIED_RE.some((re) => re.test(w)) ? 'NOT_SPECIFIED' : DIRECT_RE.some((re) => re.test(w)) ? 'DIRECT' : null;
      if (tok) { out.push({ token: tok, span: [i, i + len] }); for (let j = i; j < i + len; j += 1) taken[j] = true; }
    }
  }
  return out.sort((a, b) => a.span[0] - b.span[0]);
}
