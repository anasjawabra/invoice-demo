// ============================================================================
// Entity resolver for typed report requests: Amanahs, municipalities and revenue sources, from the REAL catalogues
// (catalog.js ENTITIES + municipalitiesOf, revenueLedger.js REVENUE_SOURCES, insightsEngine.js sourceAr / sourceEn) plus alias tables.
// RULE-BASED and deterministic. It resolves what it can and REPORTS what it cannot — it never drops a named constraint and never widens it:
//   resolveEntities(raw, { isKnown, prevAmanah }) → {
//     amanahs : [{ key, text, via:'name'|'alias'|'variant', span:[i,j) }]   Amanahs named (spelling variants, transliterations, cities, plural-prefixed)
//     genericAmanahs / genericMunicipalities : the plural dimension is mentioned («الأمانات», «Amanahs», «municipalities»): ALL of them, grouped
//     muni : { key, refId|null, amanah, name, phrase, span, via:'stated'|'implied'|'reference'|'group', inferredAmanah, group:null|'NOT_SPECIFIED'|'DIRECT' } | null   the municipality named (REFERENCE hierarchy, src/data/requestMunicipalities.js)
//     sources : [{ key, text, via }]   revenue sources named
//     problems: [ { kind, phrase, span, candidates:[…], … } ]   what could not be resolved — the caller ASKS about every one of them
//     tokens  : [{ raw, n }]    the request cut into words (to rebuild a re-worded request for the clickable options)
//   }
// problem kinds: amanah_unknown · amanah_fuzzy (near miss: «Did you mean…?») · amanah_ambiguous · amanah_forbidden (outside the organisation's permissions) ·
//                muni_unknown (not in the reference; nearest names suggested) · muni_ambiguous (the same name under several Amanahs / entries) · muni_other_amanah (a municipality of another Amanah than the one stated) ·
//                muni_amanah_missing / muni_amanah_ambiguous (a group «no municipality / direct» without a resolvable Amanah) · muni_name_missing (a municipality asked for without a name) · muni_multiple · muni_forbidden (outside the permissions) ·
//                source_unknown · source_ambiguous · source_unavailable
// ACCESS: `allowedAmanahs` (the legacy organisation list) and/or `access` (the signed-in user's GeoScope for the smart_reports module) restrict what can be NAMED: an entity outside it is reported as
//   amanah_forbidden / muni_forbidden and nothing else — never a total, a suggestion or a candidate that is outside it (fuzzy / ambiguous candidate lists, nearest municipalities and the
//   «municipality count» are all cut to the authorized part). `ent.access` = { restricted, none, okAmanah(k), okMuni(amanah, refId), okGroup(amanah, token), entire(k) } for the clarification builder.
// ============================================================================
import { ENTITIES, N_AMANAH } from './catalog';
import { matchMunicipalityAt, matchMunicipalityEndingAt, nearestMunicipalities, findMunicipalityGroups, municipalityIndex } from './requestMunicipalities';
import { REVENUE_SOURCES, REVENUE_SOURCE_KEYS } from './revenueLedger';
import { sourceAr, sourceEn } from './insightsEngine';
import { cleanRaw, normText, looseKey, stripClitics } from './textNorm';
import { asGeoScope, amanahAllowed, muniAllowed, groupAllowed, allowedEntityKeys, entireAmanah } from './reportAccess';

const isArabic = (s) => /[؀-ۿ]/.test(s);
const stripAl = (w) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w);

// ---------------------------------------------------------------- alias tables (extra names; the catalogue's own names are added automatically)
const AMANAH_ALIASES = {
  'Riyadh Amanah': { ar: ['الرياض', 'رياض'], en: ['riyadh', 'riyad', 'riad', 'ryad', 'ar riyadh', 'er riyadh'] },
  'Jeddah Amanah': { ar: ['جدة', 'جده', 'جدّة'], en: ['jeddah', 'jiddah', 'jedda', 'jidda', 'jaddah', 'jeddah city'] },
  'Eastern Province Amanah': { ar: ['المنطقة الشرقية', 'الشرقية', 'الأمانة الشرقية', 'الدمام', 'دمام'], en: ['eastern province', 'eastern region', 'eastern', 'east province', 'dammam', 'damam', 'sharqiyah', 'ash sharqiyah'] },
  'Makkah Amanah': { ar: ['مكة', 'مكة المكرمة', 'العاصمة المقدسة'], en: ['makkah', 'makka', 'mecca', 'mekka', 'macca', 'makkah al mukarramah', 'holy capital'] },
  'Al Madinah Amanah': { ar: ['المدينة المنورة', '=المدينة', 'مدينة المنورة', 'طيبة'], en: ['madinah', 'madina', 'medina', 'medinah', 'al madinah', 'madinah al munawwarah', 'medina al munawara'] },
  'Asir Amanah': { ar: ['عسير', 'أبها', 'ابها'], en: ['asir', 'aseer', 'assir', 'aser', 'abha'] },
  'Taif Amanah': { ar: ['الطائف', 'الطايف', 'طائف'], en: ['taif', 'ta’if', 'taef', 'tayef'] },
  'Al-Qassim Amanah': { ar: ['القصيم', 'بريدة'], en: ['qassim', 'qasim', 'gassim', 'qaseem', 'buraydah', 'buraidah', 'buraida'] },
  'Al-Ahsa Amanah': { ar: ['الأحساء', 'الاحساء', 'الإحساء', 'الأحسا', 'الحسا', 'الحساء', 'الهفوف'], en: ['ahsa', 'ahsaa', 'hasa', 'hassa', 'al hasa', 'al hassa', 'hofuf', 'hufuf'] },
  'Jazan Amanah': { ar: ['جازان', 'جيزان'], en: ['jazan', 'jizan', 'gizan', 'gazan'] },
  'Tabuk Amanah': { ar: ['تبوك'], en: ['tabuk', 'tabouk', 'tabook'] },
  "Ha'il Amanah": { ar: ['حائل', 'حايل'], en: ['hail', "ha'il", 'hayil', 'hayel'] },
  'Northern Borders Amanah': { ar: ['الحدود الشمالية', 'عرعر'], en: ['northern borders', 'northern border', 'north borders', 'arar'] },
  'Najran Amanah': { ar: ['نجران'], en: ['najran', 'nejran'] },
  'Hafr Al-Batin Amanah': { ar: ['حفر الباطن', 'الباطن'], en: ['hafr al batin', 'hafar al batin', 'hafr albatin', 'hafr', 'hafar'] },
  'Al Bahah Amanah': { ar: ['الباحة', 'باحة'], en: ['bahah', 'baha', 'al baha'] },
  'Al Jawf Amanah': { ar: ['الجوف', 'جوف', 'سكاكا'], en: ['jawf', 'jouf', 'jauf', 'al jouf', 'sakaka'] },
  'Housing Sector': { ar: ['قطاع الإسكان'], en: ['housing sector'] }
};
// the dimension nouns: singular introduces ONE named Amanah, plural means ALL of them
const AMANAH_NOUN_SING = new Set(['امانه', 'امانة', 'amanah', 'amana']);
const AMANAH_NOUN_PLURAL = new Set(['امانات', 'amanahs', 'amanat', 'amanaat', 'amanas', 'amanaa']);
const MUNI_NOUN_SING = new Set(['بلديه', 'municipality']);
const MUNI_NOUN_PLURAL = new Set(['بلديات', 'municipalities', 'munis']);

const SOURCE_ALIASES = {
  investment: { ar: ['استثمار', 'استثمارات', 'استثماري', 'استثمارية', 'ايجار', 'ايجارات', 'تأجير'], en: ['investment', 'investments', 'investing', 'invest', 'lease', 'leasing', 'rent', 'rental'] },
  fines: { ar: ['غرامات', 'غرامة', 'الغرامات والجزاءات', 'جزاءات', 'جزاء', 'مخالفات', 'مخالفة', 'عقوبات'], en: ['fines', 'fine', 'penalties', 'penalty', 'violation', 'violations', 'fines and penalties', 'fines & penalties'] },
  municipal_fees: { ar: ['رسوم بلدية', 'رسوم البلدية', 'الرسوم البلدية', 'بلدي', 'نفايات', 'جمع النفايات'], en: ['municipal fees', 'municipal fee', 'municipal revenue', 'baladi', 'waste collection'] },
  licenses: { ar: ['رخص', 'رخصة', 'ترخيص', 'تراخيص', 'رسوم التراخيص', 'رسوم الرخص'], en: ['license', 'licence', 'licenses', 'licences', 'licensing', 'licence fees', 'license fees'] },
  accommodation: { ar: ['ايواء', 'إيواء', 'مرافق الإيواء', 'مرافق الايواء', 'اشغال', 'إشغال', 'فنادق'], en: ['accommodation', 'accommodation facilities', 'lodging', 'hotel', 'hotels', 'occupancy'] },
  tobacco: { ar: ['تبغ', 'التبغ', 'رسم التبغ', 'رسم منتجات التبغ'], en: ['tobacco', 'tobacco fee', 'tobacco fees'] },
  white_lands: { ar: ['الأراضي البيضاء', 'اراضي بيضاء', 'ارض بيضاء', 'رسوم الأراضي البيضاء'], en: ['white land', 'white lands', 'whitelands', 'white-land', 'white land fees'] },
  housing_sales: { ar: ['الإسكان', 'اسكان', 'مبيعات الإسكان', 'مبيعات سكنية', 'المبيعات السكنية', 'مبيعات سكن'], en: ['housing', 'housing sales', 'housing sector sales', 'residential sales'] }
};
// «fees / رسوم» alone names no source: it fits several (the question lists them)
const FEE_WORD = new Set(['رسوم', 'fees', 'fee']);
const FEE_CANDIDATES = ['municipal_fees', 'licenses', 'white_lands', 'tobacco', 'housing_sales'];
// things people call «a source» that this system does not hold
const NOT_A_SOURCE = new Set(['زكاه', 'zakat', 'ضريبه', 'ضرائب', 'tax', 'taxes', 'vat', 'جمارك', 'customs', 'نفط', 'oil', 'رواتب', 'salaries', 'payroll']);

// ---------------------------------------------------------------- index building
// a phrase → the word keys the matcher compares: looseKey per word, Arabic article dropped («الرياض» = «رياض»); Latin «al / el» article optional
function phraseKeys(str) {
  const keepAl = String(str).startsWith('='); // «=المدينة»: the article is part of the name (a bare «مدينة» = «city» must not match)
  const w = looseKey(String(str).replace(/^=/, '')).split(' ').filter(Boolean).map((x) => (isArabic(x) && !keepAl ? stripAl(x) : x));
  return w;
}
function expandPhrase(str) {
  const base = phraseKeys(str); const out = [base];
  if (!base.length || isArabic(str)) return out;
  if (base.length > 1 && /^(?:al|el|ar|ash|as|an|at|ad|az)$/.test(base[0])) out.push(base.slice(1)); // «al qassim» → «qassim»
  if (base.length > 1) out.push([base.join('')]); // «al qassim» → «alqassim»
  const m = base.length === 1 && base[0].match(/^(?:al|el)(.{3,})$/); if (m) out.push([m[1]]); // «alqassim» → «qassim»
  return out;
}
export function buildEntityIndex({ entities = ENTITIES.slice(0, N_AMANAH + 1), aliases = AMANAH_ALIASES } = {}) {
  const amanahs = [];
  for (const e of entities) {
    const core = (e.ar || '').replace(/^أمانة\s*(منطقة|محافظة|مدينة)?\s*/, '').trim(); const coreShort = core.replace(/^المنطقة\s+/, '');
    const strs = [e.ar, core, coreShort, e.en, (e.en || '').replace(/ Amanah$/, ''), ...((aliases[e.en] || {}).ar || []), ...((aliases[e.en] || {}).en || [])].filter((x) => x && String(x).length > 1);
    const phrases = []; const seen = new Set();
    for (const s of strs) for (const p of expandPhrase(s)) { const k = p.join(' '); if (p.length && !seen.has(k)) { seen.add(k); phrases.push(p); } }
    amanahs.push({ key: e.en, ar: e.ar, en: e.en, phrases, official: new Set([looseKey(core), looseKey(coreShort), looseKey((e.en || '').replace(/ Amanah$/, '')), looseKey(e.en), looseKey(e.ar)]) });
  }
  const sources = REVENUE_SOURCE_KEYS.map((key) => {
    const strs = [REVENUE_SOURCES[key].ar, REVENUE_SOURCES[key].en, sourceAr(key), sourceEn(key), ...(SOURCE_ALIASES[key]?.ar || []), ...(SOURCE_ALIASES[key]?.en || [])].filter(Boolean);
    const phrases = []; const seen = new Set();
    for (const s of strs) for (const p of expandPhrase(s)) { const k = p.join(' '); if (p.length && !seen.has(k)) { seen.add(k); phrases.push(p); } }
    return { key, phrases, official: new Set([looseKey(sourceAr(key)), looseKey(sourceEn(key)), key]) };
  });
  return { amanahs, sources };
}
let INDEX = null; const index = () => INDEX || (INDEX = buildEntityIndex());

// every word the resolver understands, normalised — the interpreter adds them to its vocabulary so a recognised name is never reported as «unknown»
export function entityVocabulary() {
  const set = new Set(); const ix = index();
  const add = (w) => { const n = normText(w); if (n) n.split(' ').forEach((x) => x && set.add(x)); };
  for (const grp of [ix.amanahs, ix.sources]) for (const g of grp) for (const p of g.phrases) p.forEach((w) => { set.add(w); set.add(`ال${w}`); });
  for (const v of Object.values(AMANAH_ALIASES)) [...v.ar, ...v.en].forEach(add);
  for (const v of Object.values(SOURCE_ALIASES)) [...v.ar, ...v.en].forEach(add);
  [...AMANAH_NOUN_SING, ...AMANAH_NOUN_PLURAL, ...MUNI_NOUN_SING, ...MUNI_NOUN_PLURAL, ...FEE_WORD, ...NOT_A_SOURCE].forEach(add);
  return set;
}

// ---------------------------------------------------------------- tokens
function tokenize(raw) {
  const out = []; const re = /\S+/g; let m;
  const clean = cleanRaw(raw);
  while ((m = re.exec(clean)) !== null) {
    const parts = m[0].replace(/^[("'«“\[]+|[)"'»”\].,،؛;:؟?!]+$/g, ''); // surrounding punctuation is not part of the word
    // «Al-Ahsa» / «Al-Madinah Al-Munawwarah»: a hyphen between Latin letters separates two words
    const pieces = /[A-Za-z][-_][A-Za-z]/.test(parts) ? parts.split(/[-_]/) : [parts];
    pieces.forEach((pc, k) => { const n = normText(pc); if (n) out.push({ raw: pc, n, comma: k === pieces.length - 1 && /[,،؛;]$/.test(m[0]) }); });
  }
  return out;
}
// the comparable keys of ONE token: Arabic with glued clitics stripped («للرياض», «بجدة», «والدمام»), Latin plain / singular, both through looseKey
function variantsOf(t) {
  const out = new Set(); const lk = looseKey(t.n); if (!lk) return out;
  if (isArabic(lk)) { for (const v0 of stripClitics(normText(t.n))) { const v = looseKey(v0); out.add(v); out.add(stripAl(v)); } } // clitics are stripped BEFORE doubled letters collapse («للمدينة» = ل + ال + مدينة)
  else { out.add(lk); out.add(lk.replace(/(?:ies)$/, 'y')); out.add(lk.replace(/(?:es|s)$/, '')); out.add(lk.replace(/^(?:al|el)(?=.{3,}$)/, '')); }
  return out;
}

// ---------------------------------------------------------------- distance (suggestions for near misses only — never used to resolve silently)
function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) { const cur = [i]; for (let j = 1; j <= b.length; j += 1) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[b.length];
}
const skeleton = (s) => s.replace(/[aeiouy]+/g, 'a');
function nearest(groups, phrase) {
  const target = phraseKeys(phrase).join(' '); if (target.length < 3) return [];
  const sk = skeleton(target); const scored = [];
  for (const g of groups) {
    let best = Infinity;
    for (const p of g.phrases) {
      const k = p.join(' '); const tol = Math.max(1, Math.min(2, Math.floor(Math.max(k.length, target.length) / 4))); // 1 edit for short names, 2 for long ones
      const ds = isArabic(target) ? 99 : lev(sk, skeleton(k)); const d = Math.min(lev(target, k), ds <= 1 ? 1 : 99); // a vowel-only difference counts as one edit
      if (d <= tol && d < best) best = d;
    }
    if (best < Infinity) scored.push({ key: g.key, d: best });
  }
  return scored.sort((a, b) => a.d - b.d).slice(0, 3).map((x) => x.key);
}

// ---------------------------------------------------------------- resolution
const SLOT_STOP = new Set(['كل', 'جميع', 'فقط', 'بس', 'واحده', 'واحد', 'معينه', 'معين', 'محدده', 'محدد', 'اخري', 'اخر', 'ما', 'التي', 'الذي', 'اللي', 'هذه', 'هذا', 'ذات', 'كاملة', 'كامله', 'فلتر', 'فلاتر', 'مرشح', 'مرشحات', 'تصفيه', 'تقرير', 'قسم', 'مقارنه', 'filter', 'filters', 'section', 'report', 'comparison', 'data', 'figures', 'level', 'breakdown', 'table', 'chart',
  'any', 'one', 'specific', 'particular', 'certain', 'other', 'another', 'each', 'every', 'same', 'which', 'that', 'this', 'the', 'a', 'an', 'all', 'only', 'just', 'my', 'our', 'by', 'per', 'for', 'with', 'and', 'or', 'vs', 'versus', 'than', 'to', 'from', 'is', 'are', 'was', 'at', 'on']);
const SLOT_SKIP_AR = new Set(['منطقه', 'محافظه', 'مدينه', 'منطقة', 'محافظة', 'مدينة', 'ال']);
const SLOT_SKIP_EN = new Set(['of', 'in', 'for', 'at', 'region', 'province', 'governorate', 'city', 'called', 'named', 'the', 'town']);
const CONNECTORS = new Set(['و', 'and', 'or', 'او', 'مع', 'with', 'plus', '&', 'vs', 'versus', 'مقابل', 'ثم']);
const PRE_DIM = new Set(['حسب', 'بحسب', 'لكل', 'كل', 'by', 'per', 'each', 'every', 'رسوم', 'الرسوم', 'عن']);
const hasDigit = (s) => /\d/.test(s);

/** the access context of a resolution: legacy `allowedAmanahs` (organisation list) AND/OR a GeoScope. With neither, everything is allowed. */
export function accessContext({ allowedAmanahs = null, access = null } = {}) {
  const legacy = allowedAmanahs ? new Set(allowedAmanahs) : null; const scope = access ? asGeoScope(access) : null;
  const scoped = !!scope && !scope.all; const restricted = !!legacy || scoped;
  const okAmanah = (k) => (!legacy || legacy.has(k)) && (!scoped || amanahAllowed(scope, k));
  const okMuni = (amanah, refId) => okAmanah(amanah) && (!scoped || muniAllowed(scope, amanah, refId));
  const okGroup = (amanah, token) => okAmanah(amanah) && (!scoped || groupAllowed(scope, amanah, token));
  const entire = (k) => !scoped || entireAmanah(scope, k);
  let keys = null; if (scoped) { keys = allowedEntityKeys(scope); if (legacy) keys = keys.filter((k) => legacy.has(k)); } else if (legacy) keys = [...legacy];
  return { restricted, none: restricted && (keys ? keys.length === 0 : false), keys, okAmanah, okMuni, okGroup, entire };
}

export function resolveEntities(raw, { isKnown = () => false, prevAmanah = null, index: ixOverride = null, allowedAmanahs = null, access = null } = {}) {
  const ix = ixOverride || index(); const tokens = tokenize(raw); const n = tokens.length;
  const AC = accessContext({ allowedAmanahs, access });
  const vars = tokens.map(variantsOf); const used = new Array(n).fill(false);
  const problems = []; const amanahs = []; const sources = [];
  const matchAt = (groups, i, taken = used) => {
    let best = null;
    for (const g of groups) for (const p of g.phrases) {
      if (i + p.length > n) continue; let ok = true;
      for (let j = 0; j < p.length; j += 1) { if (taken[i + j] || !vars[i + j].has(p[j])) { ok = false; break; } }
      if (ok && (!best || p.length > best.len)) best = { g, len: p.length, ties: [] };
      else if (ok && best && p.length === best.len && g !== best.g) best.ties.push(g);
    }
    return best;
  };
  // ---- Amanahs: longest phrase first, left to right; every consumed token is marked so a name is never read twice
  for (let i = 0; i < n;) {
    const m = matchAt(ix.amanahs, i);
    if (!m) { i += 1; continue; }
    const text = tokens.slice(i, i + m.len).map((t) => t.raw).join(' ');
    const lk = looseKey(text); const exact = [...m.g.official].some((o) => o && (lk === o || lk === o.replace(/^ال/, '') || phraseKeys(o).join(' ') === phraseKeys(lk).join(' ')));
    if (m.ties.length) { // the candidates a person may choose between are the AUTHORIZED ones only (an unauthorized one is never listed)
      const cands = [m.g.key, ...m.ties.map((x) => x.key)]; const okC = cands.filter(AC.okAmanah);
      if (okC.length > 1) problems.push({ kind: 'amanah_ambiguous', phrase: text, span: [i, i + m.len], candidates: okC });
      else amanahs.push({ key: okC[0] || m.g.key, text, via: 'variant', span: [i, i + m.len] }); // one authorized reading, or none (then the forbidden message below)
    } else amanahs.push({ key: m.g.key, text, via: exact ? 'name' : 'variant', span: [i, i + m.len] });
    for (let j = 0; j < m.len; j += 1) used[i + j] = true;
    i += m.len;
  }
  const okAm = AC.okAmanah;
  if (AC.restricted) for (const a of amanahs) if (!okAm(a.key)) problems.push({ kind: 'amanah_forbidden', phrase: a.text, span: a.span, candidates: [] }); // named, but outside the user's access: the message names ONLY what the user typed
  // ---- the explicit municipality groups («بلا بلدية / غير محددة», «مباشر على الأمانة»): consumed here so their words are never read as an Amanah noun or an unknown name
  const groups = findMunicipalityGroups(tokens).filter((g) => !used.slice(g.span[0], g.span[1]).some(Boolean));
  groups.forEach((g) => { for (let j = g.span[0]; j < g.span[1]; j += 1) used[j] = true; });
  // ---- revenue sources
  for (let i = 0; i < n;) {
    const m = matchAt(ix.sources, i);
    if (!m) { i += 1; continue; }
    const text = tokens.slice(i, i + m.len).map((t) => t.raw).join(' ');
    if (!sources.some((s) => s.key === m.g.key)) sources.push({ key: m.g.key, text, via: [...m.g.official].includes(looseKey(text)) ? 'name' : 'alias', span: [i, i + m.len] });
    for (let j = 0; j < m.len; j += 1) used[i + j] = true;
    i += m.len;
  }
  const nonDim = (i) => !used[i] && !isKnown(tokens[i].n) && !hasDigit(tokens[i].n) && tokens[i].n.length >= 2 && !SLOT_STOP.has(tokens[i].n) && !CONNECTORS.has(tokens[i].n);
  const isNoun = (i, set) => set.has(tokens[i].n) || (isArabic(tokens[i].n) ? [...vars[i]].some((v) => set.has(v)) : set.has(looseKey(tokens[i].n))); // a Latin plural («amanahs») is NOT the singular noun

  // ---- generic plural dimension nouns
  let genericAmanahs = false; let genericMunicipalities = false;
  tokens.forEach((t, i) => { if (isNoun(i, AMANAH_NOUN_PLURAL)) genericAmanahs = true; if (isNoun(i, MUNI_NOUN_PLURAL)) genericMunicipalities = true; });

  // ---- an Amanah named by its singular noun («أمانة X», «Amanah of X», «X Amanah») that matches none of the catalogue
  const unknownCandidate = (from, dir) => { // the unknown words right after (dir=1) or before (dir=-1) a noun
    let k = from;
    if (dir === 1) while (k < n && !used[k] && (SLOT_SKIP_EN.has(tokens[k].n) || SLOT_SKIP_AR.has(tokens[k].n))) k += 1;
    const idx = [];
    if (dir === 1) { while (k < n && idx.length < 3 && nonDim(k) && !(idx.length && tokens[k - 1].comma)) { idx.push(k); k += 1; } }
    else { k = from - 1; if (k >= 0 && nonDim(k) && /^[a-z]/.test(tokens[k].n)) idx.push(k); }
    return idx;
  };
  const slotSpans = [];
  tokens.forEach((t, i) => {
    if (!isNoun(i, AMANAH_NOUN_SING) || (i > 0 && PRE_DIM.has(tokens[i - 1].n) && !isArabic(t.n))) return;
    let idx = unknownCandidate(i + 1, 1);
    // English «Amanah Atlantis»: only when written with an «of / in / for» or a capital letter (a lower-case word right after «amanah» is usually a report word)
    if (idx.length && !isArabic(t.n) && !(/^[A-Z]/.test(tokens[idx[0]].raw) || /^(?:of|in|for|at|called|named)$/.test(tokens[i + 1]?.n || ''))) idx = [];
    if (!idx.length && !isArabic(t.n)) idx = unknownCandidate(i, -1); // «Atlantis Amanah»
    if (!idx.length) return;
    const phrase = idx.map((k) => tokens[k].raw).join(' '); const lo = Math.min(i, ...idx); const hi = Math.max(i, ...idx) + 1;
    const near = nearest(ix.amanahs.filter((g) => AC.okAmanah(g.key)), phrase);
    problems.push({ kind: near.length ? 'amanah_fuzzy' : 'amanah_unknown', phrase, span: [lo, hi], candidates: near }); slotSpans.push([lo, hi]); idx.forEach((k) => { used[k] = true; });
  });
  // a list continuation: «الرياض وأطلانطس», «Riyadh and Atlantis» — the word after «and» next to a resolved Amanah is a name too
  // (when the sentence says «Amanah / أمانة / Amanahs» or already lists two Amanahs, so an ordinary word after a name is not mistaken for one)
  const listy = tokens.some((t, i) => isNoun(i, AMANAH_NOUN_SING) || isNoun(i, AMANAH_NOUN_PLURAL)) || amanahs.length >= 2;
  if (listy) for (const a of amanahs) {
    let k = a.span[1]; if (k >= n) continue;
    let glued = false;
    if (CONNECTORS.has(tokens[k].n)) k += 1;
    else if (isArabic(tokens[k].n) && /^و.{3,}/.test(tokens[k].n)) glued = true;
    else if (!tokens[k - 1].comma) continue;
    if (k < n && nonDim(k) && !slotSpans.some(([lo, hi]) => k >= lo && k < hi) && /^[a-z\u0621-\u064A]{3,}$/.test(tokens[k].n)) {
      const phrase = glued ? tokens[k].raw.replace(/^و/, '') : tokens[k].raw; const near = nearest(ix.amanahs.filter((g) => AC.okAmanah(g.key)), phrase); const lead = !glued && CONNECTORS.has(tokens[k - 1].n); used[k] = true;
      problems.push({ kind: near.length ? 'amanah_fuzzy' : 'amanah_unknown', phrase, span: [lead ? k - 1 : k, k + 1], connector: glued ? 'و' : lead ? tokens[k - 1].raw : '', candidates: near, listItem: true, named: amanahs.map((x) => x.key) });
    }
  }
  // clitic-glued first item of a list: «وأطلانطس» after a resolved Amanah is covered above through its stripped form
  // ---- municipalities: names are resolved against the REFERENCE hierarchy (never a direction word, never "the first one")
  const statedAm = [...new Set(amanahs.map((a) => a.key))];
  const ctxAm = statedAm.length === 1 ? statedAm[0] : statedAm.length === 0 ? prevAmanah : null; // the Amanah a municipality is read under (stated, else the one already chosen)
  const MUNI_PRE = new Set(['حسب', 'بحسب', 'لكل', 'كل', 'by', 'per', 'each', 'every']);
  const MUNI_SKIP = new Set(['محافظه', 'of', 'the', 'in', 'في', 'ال']);
  const amTok = (k) => amanahs.some((a) => k >= a.span[0] && k < a.span[1]);
  const okM = (m) => AC.okMuni(m.amanah, m.refId); // a municipality of an authorized Amanah may still be outside a partial grant
  const pools = (keys) => municipalityIndex().filter((m) => okM(m) && (!keys || keys.includes(m.amanah)));
  const hits = []; let muniProblem = null; const muniNouns = [];
  tokens.forEach((t, i) => { if (!used[i] && isNoun(i, MUNI_NOUN_SING) && !(i > 0 && MUNI_PRE.has(tokens[i - 1].n)) && !(i > 0 && FEE_WORD.has(tokens[i - 1].n))) muniNouns.push(i); });
  for (const p of muniNouns) {
    if (used[p]) continue;
    let k = p + 1; while (k < n && (MUNI_SKIP.has(tokens[k].n) || AMANAH_NOUN_SING.has(tokens[k].n) || amTok(k) || (k > p + 1 && isNoun(k, MUNI_NOUN_SING)))) k += 1; // «بلدية محافظة X», «municipality of X», «بلدية جدة X»
    let hit = k < n ? matchMunicipalityAt(vars, used, k) : null; let start = k;
    if (!hit && !isArabic(tokens[p].n)) { const b = matchMunicipalityEndingAt(vars, used, p); if (b) { hit = b; start = b.start; } } // «Rabigh municipality»
    if (hit) {
      const lo = Math.min(p, start); const hi = Math.max(p + 1, start + hit.len); for (let j = lo; j < hi; j += 1) used[j] = true;
      const phrase = tokens.slice(start, start + hit.len).map((x) => x.raw).join(' ');
      const okC = hit.cands.filter(okM); // the candidates are cut to the authorized ones HERE, so no later list (ambiguous / multiple / other-Amanah) can name an unauthorized municipality
      if (!okC.length) { muniProblem = muniProblem || { kind: 'muni_forbidden', phrase, span: [lo, hi], candidates: [] }; continue; }
      hits.push({ cands: okC, phrase, span: [lo, hi] }); continue;
    }
    const unk = []; for (let q = k; q < n && unk.length < 3 && nonDim(q) && !(unk.length && tokens[q - 1].comma); q += 1) unk.push(q);
    if (unk.length) {
      const words = unk.map((q) => tokens[q].n); const near = nearestMunicipalities(words.map((w) => looseKey(w)).map((w) => (isArabic(w) ? stripAl(w) : w)), pools(ctxAm && okAm(ctxAm) ? [ctxAm] : null));
      muniProblem = muniProblem || { kind: 'muni_unknown', phrase: unk.map((q) => tokens[q].raw).join(' '), span: [p, unk[unk.length - 1] + 1], amanah: ctxAm, candidates: near.map((m) => m.refId) }; unk.forEach((q) => { used[q] = true; });
    } else if (statedAm.length === 1 && amanahs.some((a) => (a.span[0] > p && a.span[0] <= p + 3) || (a.span[1] <= p && a.span[1] >= p - 2))) {
      const am = amanahs[0]; muniProblem = muniProblem || { kind: 'muni_name_missing', amanah: statedAm[0], span: [Math.min(p, am.span[0]), Math.max(p + 1, am.span[1])] };
    }
  }
  let muni = null;
  const mk = (m, span, phrase, via, inferred = false) => ({ key: m.key, refId: m.refId, amanah: m.amanah, name: m.ar, phrase, span, via, inferredAmanah: inferred, group: null });
  const place = (cands, phrase, span) => { // the municipalities a written name can mean → one of them, or ONE targeted problem
    const pool = cands.filter(okM);
    if (!pool.length) return { problem: { kind: 'muni_forbidden', phrase, span, candidates: [] } };
    if (ctxAm) {
      const inA = pool.filter((m) => m.amanah === ctxAm);
      if (inA.length === 1) return { muni: mk(inA[0], span, phrase, statedAm.length ? 'stated' : 'implied') };
      if (inA.length > 1) return { problem: { kind: 'muni_ambiguous', phrase, span, amanah: ctxAm, candidates: inA.map((m) => m.refId) } };
      return { problem: { kind: 'muni_other_amanah', phrase, span, amanah: ctxAm, implied: !statedAm.length, candidates: pool.map((m) => m.refId) } };
    }
    if (statedAm.length > 1) { const inS = pool.filter((m) => statedAm.includes(m.amanah)); return { problem: { kind: 'muni_amanah_ambiguous', phrase, span, candidates: inS.length ? [...new Set(inS.map((m) => m.amanah))] : statedAm, refs: pool.map((m) => m.refId) } }; }
    if (pool.length === 1) return { muni: mk(pool[0], span, phrase, 'reference', true) }; // the reference gives the parent Amanah (shown in the reading; the person confirms)
    return { problem: { kind: 'muni_ambiguous', phrase, span, amanah: null, candidates: pool.map((m) => m.refId) } };
  };
  const sig = (h) => h.cands.map((c) => c.refId).sort().join(',');
  if (!muniProblem && hits.length > 1 && new Set(hits.map(sig)).size > 1) {
    const lo = Math.min(...hits.map((h) => h.span[0])); const hi = Math.max(...hits.map((h) => h.span[1]));
    muniProblem = { kind: 'muni_multiple', amanah: ctxAm, candidates: hits.map((h) => (h.cands.length === 1 ? h.cands[0].refId : (h.cands.find((c) => c.amanah === ctxAm) || h.cands[0]).refId)), span: [lo, hi] };
  } else if (!muniProblem && hits.length) { const h = hits[0]; const r = place(h.cands, h.phrase, h.span); if (r.muni) muni = r.muni; else muniProblem = r.problem; }
  if (!muniProblem && !muni && groups.length) {
    const g = groups[0]; const phrase = tokens.slice(g.span[0], g.span[1]).map((x) => x.raw).join(' ');
    if (ctxAm && !okAm(ctxAm)) muniProblem = { kind: 'muni_forbidden', phrase, span: g.span, candidates: [] };
    else if (ctxAm && !AC.okGroup(ctxAm, g.token)) muniProblem = { kind: 'muni_forbidden', phrase, span: g.span, candidates: [], group: g.token }; // the group is not part of the user's grant for this Amanah
    else if (ctxAm && !municipalityIndex().some((m) => m.amanah === ctxAm)) muniProblem = { kind: 'muni_unknown', phrase, span: g.span, amanah: ctxAm, noMunis: true, candidates: [] };
    else if (ctxAm) muni = { key: `${ctxAm}|${g.token}`, refId: null, amanah: ctxAm, name: null, phrase, span: g.span, via: statedAm.length ? 'stated' : 'implied', inferredAmanah: false, group: g.token };
    else muniProblem = { kind: statedAm.length > 1 ? 'muni_amanah_ambiguous' : 'muni_amanah_missing', group: g.token, phrase, span: g.span, candidates: statedAm };
  }
  if (muniProblem) problems.push(muniProblem);
  // ---- sources that match nothing / several things
  const SRC_NOUN = new Set(['مصدر', 'source']);
  tokens.forEach((t, i) => {
    if (used[i] && !sources.some((s) => i >= s.span[0] && i < s.span[1])) return;
    if (NOT_A_SOURCE.has(t.n) || [...vars[i]].some((v) => NOT_A_SOURCE.has(v))) {
      const lo = i > 0 && isNoun(i - 1, SRC_NOUN) ? i - 1 : i; const hi = i + 1 < n && isNoun(i + 1, SRC_NOUN) ? i + 2 : i + 1; // «Zakat source» / «مصدر الزكاة»: the noun goes with it
      problems.push({ kind: 'source_unavailable', phrase: t.raw, span: [lo, hi] });
    }
  });
  const srcNoun = (i) => isNoun(i, SRC_NOUN) && !(i > 0 && PRE_DIM.has(tokens[i - 1].n));
  tokens.forEach((t, i) => {
    if (!srcNoun(i) || used[i]) return;
    let k = i + 1; while (k < n && (['الايراد', 'ايراد', 'of', 'revenue', 'ال', 'من', 'the', 'named', 'called', 'يسمي'].includes(tokens[k].n))) k += 1;
    const idx = []; while (k < n && idx.length < 3 && nonDim(k) && !(idx.length && tokens[k - 1].comma)) { idx.push(k); k += 1; }
    if (!idx.length && !isArabic(t.n) && i > 0 && nonDim(i - 1) && /^[a-z]+$/.test(tokens[i - 1].n)) idx.push(i - 1); // «Zakat source»
    if (!idx.length) return;
    const phrase = idx.map((q) => tokens[q].raw).join(' '); const near = nearest(ix.sources, phrase); idx.forEach((q) => { used[q] = true; });
    if (!problems.some((p) => p.kind === 'source_unavailable' && idx.some((q) => q >= p.span[0] && q < p.span[1]))) problems.push({ kind: 'source_unknown', phrase, span: [Math.min(i, ...idx), Math.max(i, ...idx) + 1], candidates: near });
  });
  if (!sources.length && !problems.some((p) => p.kind.startsWith('source_'))) {
    const fi = tokens.findIndex((t, i) => !used[i] && (FEE_WORD.has(t.n) || [...vars[i]].some((v) => FEE_WORD.has(v))) && !(i > 0 && PRE_DIM.has(tokens[i - 1].n) && tokens[i - 1].n !== 'رسوم'));
    if (fi >= 0) problems.push({ kind: 'source_ambiguous', phrase: tokens[fi].raw, span: [fi, fi + 1], candidates: FEE_CANDIDATES });
  }
  return { amanahs, genericAmanahs, genericMunicipalities, muni, muniKey: muni ? muni.key : null, groups, allowed: AC.restricted ? AC.keys : null, access: AC, sources, problems, tokens, usedMuniNoun: muniNouns.length > 0, consumed: tokens.filter((_, i) => used[i]).map((t) => t.n) };
}

// the request re-worded: tokens [lo, hi) replaced by `text` (used to build clickable options that keep the rest of the request: period, source, sections…)
export function replaceSpan(tokens, [lo, hi], text) {
  return [...tokens.slice(0, lo).map((t) => t.raw), text, ...tokens.slice(hi).map((t) => t.raw)].filter((x) => x !== '').join(' ');
}
export const removeSpan = (tokens, span) => replaceSpan(tokens, span, '');
// several replacements at once: edits = [{ span:[lo,hi), text }] (non-overlapping); words outside every span are kept in order
export function applyEdits(tokens, edits) {
  const sorted = edits.slice().sort((a, b) => a.span[0] - b.span[0]); const out = []; let k = 0;
  for (const e of sorted) { while (k < e.span[0]) { out.push(tokens[k].raw); k += 1; } if (e.text) out.push(e.text); k = Math.max(k, e.span[1]); }
  while (k < tokens.length) { out.push(tokens[k].raw); k += 1; }
  return out.join(' ').trim();
}
export const amanahCore = (a) => (a.ar || '').replace(/^أمانة\s*(منطقة|محافظة|مدينة)?\s*/, '').trim();
export { REVENUE_SOURCE_KEYS };
