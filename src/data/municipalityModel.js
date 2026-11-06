// MUNICIPALITY MODEL (shared client + server): the ONE place that says what an invoice's municipality is, how it is classified, keyed and filtered.
//
// Reference: src/data/amanahHierarchy.js (generated from the Amanah / municipality workbook; names only, NO official codes). The reference is a hierarchy, NOT evidence that an invoice belongs to a municipality:
// the municipality of an invoice must come from the source system's own field (BALADYA_KEY / ARABIC_BALADYA_NAME … per supplying system, see SOURCE_MUNICIPALITY_FIELDS). In the SYNTHETIC world those source values do not
// exist, so `demoMunicipalityCode` assigns one DETERMINISTICALLY from the invoice's stable key — a stand-in, documented as such everywhere it is shown.
//
// Status of one invoice's municipality:
//   mapped                 the source gave a municipality that is in the reference under the invoice's Amanah
//   not_specified          the source gave only the Amanah («البلدية غير محددة في المصدر») — never inferred (payer address, first municipality, random)
//   direct_amanah          the Amanah issues directly: the source value is the Amanah itself (the «self» row of the reference), not a municipality
//   unmapped_source_value  the source gave a municipality name that is NOT in the reference under that Amanah (kept as written, not mapped)
//   conflict               two sources disagree about the municipality (kept for review, not merged)
// The columnar store keeps ONE small code per invoice (st.mref): 0 not_specified · 1 direct_amanah · 2 unmapped_source_value · 3 conflict · 4+k the k-th reference municipality of the Amanah.
//
// Filter VALUES are stable keys, never names:  'all' | '<Amanah key>|<MREF-…>' (a reference municipality) | '<Amanah key>|NOT_SPECIFIED' | '<Amanah key>|DIRECT' | '<Amanah key>|UNRESOLVED' (unmapped + conflict).
// The internal reference ids (MREF-…) are NOT official codes. The composite invoice key's optional `mu` component keeps reading the LEGACY demo field (see invoiceIdentity.demoMunicipalityId): keys never move.
import { ENTITIES, N_AMANAH, ENTITY_INDEX, SOURCES } from './catalog';
import { municipalitiesOf, municipalityByKey, municipalityByRef, municipalityCountOf, amanahSelfOf, findMunicipality, MUNICIPALITY_NOT_SPECIFIED, MAX_MUNICIPALITIES } from './amanahHierarchy';
import { looseKey } from './textNorm';

export { MUNICIPALITY_NOT_SPECIFIED };
export const MUNICIPALITY_DIRECT = { ar: 'مباشر على الأمانة', en: 'Issued directly by the Amanah' };
export const MUNICIPALITY_UNRESOLVED = { ar: 'تحتاج مراجعة (غير مطابقة أو متعارضة)', en: 'Needs review (unmatched or conflicting)' };
export const MUNICIPALITY_OPTION_NONE = { ar: 'بلا بلدية (غير محددة في المصدر)', en: 'No municipality (not specified in source)' };
export const STATUSES = ['mapped', 'not_specified', 'direct_amanah', 'unmapped_source_value', 'conflict'];
export const STATUS_LABEL = {
  mapped: { ar: 'مطابقة للمرجع', en: 'Matched to the reference' },
  not_specified: MUNICIPALITY_NOT_SPECIFIED,
  direct_amanah: MUNICIPALITY_DIRECT,
  unmapped_source_value: { ar: 'اسم البلدية في المصدر غير موجود في المرجع', en: 'The source municipality is not in the reference' },
  conflict: { ar: 'تعارض بين المصادر في البلدية', en: 'Sources disagree on the municipality' }
};

/* ---------- store codes ---------- */
export const MCODE = { NOT_SPECIFIED: 0, DIRECT: 1, UNMAPPED: 2, CONFLICT: 3, FIRST_MAPPED: 4 };
export const MUNI_SLOTS = MCODE.FIRST_MAPPED + MAX_MUNICIPALITIES; // aggregation slots per Amanah (unmapped + conflict share the UNRESOLVED slot 2)
const isAmanah = (ent) => ent != null && ent >= 0 && ent < N_AMANAH;

/** the aggregation slot of a stored code: 0 not specified · 1 direct · 2 unresolved (unmapped + conflict) · 4+k the k-th reference municipality. A code the Amanah does not have counts as not specified (never guessed). */
export function slotOf(ent, code) {
  const st = statusOfCode(ent, code);
  return st === 'mapped' ? code : st === 'direct_amanah' ? MCODE.DIRECT : st === 'not_specified' ? MCODE.NOT_SPECIFIED : MCODE.UNMAPPED;
}
/** the status of a stored code of an Amanah / entity (a code outside the Amanah's list is treated as not specified — never guessed) */
export function statusOfCode(ent, code) {
  if (code === MCODE.DIRECT) return 'direct_amanah';
  if (code === MCODE.UNMAPPED) return 'unmapped_source_value';
  if (code === MCODE.CONFLICT) return 'conflict';
  if (code >= MCODE.FIRST_MAPPED && isAmanah(ent) && code - MCODE.FIRST_MAPPED < municipalityCountOf(ENTITIES[ent].en)) return 'mapped';
  return 'not_specified';
}
/** the reference municipality of a stored code (null unless the status is mapped) */
export const municipalityOfCode = (ent, code) => (statusOfCode(ent, code) === 'mapped' ? municipalitiesOf(ENTITIES[ent].en)[code - MCODE.FIRST_MAPPED] : null);
/** the stored code of a reference municipality (by MREF id) inside an Amanah; null when it is not under that Amanah */
export function codeOfRef(ent, refId) {
  if (!isAmanah(ent)) return null; const i = municipalitiesOf(ENTITIES[ent].en).findIndex((m) => m.refId === refId);
  return i < 0 ? null : MCODE.FIRST_MAPPED + i;
}

/* ---------- filter keys ---------- */
export const MUNI_TOKENS = { NOT_SPECIFIED: 'NOT_SPECIFIED', DIRECT: 'DIRECT', UNRESOLVED: 'UNRESOLVED' };
const TOKEN_OF_STATUS = { not_specified: 'NOT_SPECIFIED', direct_amanah: 'DIRECT', unmapped_source_value: 'UNRESOLVED', conflict: 'UNRESOLVED' };
/** the filter key of one invoice's municipality group (every invoice has one: a reference municipality or one of the three explicit groups) */
export function muniKeyOfCode(ent, code) {
  if (!isAmanah(ent) && ent !== ENTITY_INDEX['Housing Sector']) return null;
  const st = statusOfCode(ent, code); const a = ENTITIES[ent].en;
  if (st === 'mapped') return municipalityOfCode(ent, code).key;
  return `${a}|${TOKEN_OF_STATUS[st]}`;
}
/**
 * a filter value → what it selects. 'all' (or empty) → null (no restriction). A key that is not valid (the OLD demo scheme «Jeddah Amanah|North», another Amanah's municipality, junk) → { invalid: true }.
 * Valid → { amanahEn, ent, kind: 'mapped'|'not_specified'|'direct_amanah'|'unresolved', refId?, codes:[…] }
 */
export function parseMuniKey(key) {
  const s = String(key ?? 'all'); if (s === 'all' || s === '') return null;
  const i = s.lastIndexOf('|'); if (i < 0) return { invalid: true };
  const amanahEn = s.slice(0, i); const token = s.slice(i + 1); const ent = ENTITY_INDEX[amanahEn];
  if (ent == null) return { invalid: true };
  if (token === 'NOT_SPECIFIED') return { amanahEn, ent, kind: 'not_specified', codes: [MCODE.NOT_SPECIFIED] };
  if (token === 'DIRECT') return { amanahEn, ent, kind: 'direct_amanah', codes: [MCODE.DIRECT] };
  if (token === 'UNRESOLVED') return { amanahEn, ent, kind: 'unresolved', codes: [MCODE.UNMAPPED, MCODE.CONFLICT] };
  const m = municipalityByKey(s); if (!m || m.amanahKey !== amanahEn) return { invalid: true };
  return { amanahEn, ent, kind: 'mapped', refId: m.refId, codes: [codeOfRef(ent, m.refId)] };
}
export const isValidMuniKey = (key) => { const p = parseMuniKey(key); return p === null || !p.invalid; };
export const amanahOfMuniKey = (key) => { const p = parseMuniKey(key); return p && !p.invalid ? p.amanahEn : null; };

/** the display label of a filter key / token */
export function muniLabel(key, lang = 'ar') {
  const p = parseMuniKey(key); if (p === null) return lang === 'ar' ? 'كل البلديات' : 'All municipalities';
  if (p.invalid) return String(key);
  if (p.kind === 'mapped') { const m = municipalityByRef(p.refId); return lang === 'ar' ? m.ar : m.en; }
  const L = p.kind === 'not_specified' ? MUNICIPALITY_OPTION_NONE : p.kind === 'direct_amanah' ? MUNICIPALITY_DIRECT : MUNICIPALITY_UNRESOLVED;
  return lang === 'ar' ? L.ar : L.en;
}
/** the options of the dependent municipality filter for ONE Amanah: the explicit groups first (direct / not specified / needs review), then the reference municipalities in workbook order. Not an Amanah (all / several / the Housing Sector) → [] */
export function municipalityFilterOptions(amanah) {
  if (!amanah || amanah === 'all' || Array.isArray(amanah) || ENTITY_INDEX[amanah] == null || ENTITY_INDEX[amanah] >= N_AMANAH) return [];
  return [
    { value: `${amanah}|DIRECT`, label: MUNICIPALITY_DIRECT, kind: 'direct_amanah' },
    { value: `${amanah}|NOT_SPECIFIED`, label: MUNICIPALITY_OPTION_NONE, kind: 'not_specified' },
    { value: `${amanah}|UNRESOLVED`, label: MUNICIPALITY_UNRESOLVED, kind: 'unresolved' },
    ...municipalitiesOf(amanah).map((m) => ({ value: m.key, label: { ar: m.ar, en: m.en }, kind: 'mapped', refId: m.refId }))
  ];
}

/* ---------- the synthetic stand-in ---------- */
// Share of the generated invoices of an Amanah by status (illustrative; the real shares depend on how many source records carry BALADYA_KEY, which is not available):
export const DEMO_SHARE = { direct_amanah: 28, not_specified: 12 }; // percent; the rest are mapped to a reference municipality
const mix = (n) => { let h = Math.imul((Math.abs(n) % 2147483629) | 0, 0x9e3779b1) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; return h >>> 0; };
/**
 * The municipality code of a GENERATED invoice: a pure function of the Amanah, the stable invoice key (or its contract key) and the revenue source — nothing else (no payer address, no randomness, never "the first municipality").
 * white lands: the source carries a city/region only → not_specified. The Housing Sector is not an Amanah: it issues directly.
 */
export function demoMunicipalityCode(ent, seed, sourceKey) {
  if (!isAmanah(ent)) return MCODE.DIRECT;
  if (sourceKey === 'white_lands') return MCODE.NOT_SPECIFIED;
  const n = municipalityCountOf(ENTITIES[ent].en); const h = mix(seed * 31 + ent); const r = h % 100;
  if (r < DEMO_SHARE.direct_amanah) return MCODE.DIRECT;
  if (r < DEMO_SHARE.direct_amanah + DEMO_SHARE.not_specified || n === 0) return MCODE.NOT_SPECIFIED;
  return MCODE.FIRST_MAPPED + (mix(seed * 17 + ent * 7 + 3) % n);
}

/* ---------- classification of source values (used by fixtures / uploads and by the tests; pure) ---------- */
export const normName = (s) => looseKey(String(s ?? '').replace(/[()]/g, ' '));
/**
 * What a record's municipality is, given the Amanah and the municipality name(s) its source(s) gave.
 *   values: [] / [null] → not_specified · [the Amanah's own name] → direct_amanah · [a name in the reference under this Amanah] → mapped
 *   [a name not in the reference] → unmapped_source_value · two sources with different outcomes → conflict
 * Returns { status, code, refId, values }. Nothing is inferred from anything but the given values.
 */
export function classifySourceValues(ent, values) {
  const given = [].concat(values ?? []).map((v) => (v == null ? '' : String(v).trim())).filter(Boolean);
  if (!isAmanah(ent)) return { status: given.length ? 'unmapped_source_value' : 'direct_amanah', code: given.length ? MCODE.UNMAPPED : MCODE.DIRECT, refId: null, values: given };
  if (!given.length) return { status: 'not_specified', code: MCODE.NOT_SPECIFIED, refId: null, values: given };
  const a = ENTITIES[ent]; const self = amanahSelfOf(a.en);
  const outcomes = given.map((v) => {
    const k = normName(v);
    if (k === normName(a.ar) || k === normName(a.en) || (self && (k === normName(self.sourceNameAr) || k === normName(self.nameAr)))) return { s: 'direct_amanah' };
    const m = findMunicipality(a.en, v, normName); return m ? { s: 'mapped', refId: m.refId } : { s: 'unmapped_source_value' };
  });
  const distinct = new Set(outcomes.map((o) => `${o.s}|${o.refId || ''}`));
  if (distinct.size > 1) return { status: 'conflict', code: MCODE.CONFLICT, refId: null, values: given };
  const o = outcomes[0];
  if (o.s === 'mapped') return { status: 'mapped', code: codeOfRef(ent, o.refId), refId: o.refId, values: given };
  if (o.s === 'direct_amanah') return { status: 'direct_amanah', code: MCODE.DIRECT, refId: null, values: given };
  return { status: 'unmapped_source_value', code: MCODE.UNMAPPED, refId: null, values: given };
}

/* ---------- source-field mapping (which source field carries the municipality, per supplying system) ---------- */
// From the Data Bank schema dictionaries (schema only). `verified:false` = what the dictionary names, not yet confirmed against real values.
export const SOURCE_MUNICIPALITY_FIELDS = {
  investment: { system: 'Foras (Furas contracts, Databank)', amanahFields: ['MUNICIPALITYID', 'MUNICIPALITY'], municipalityFields: ['SUBMUNICIPALITYID', 'SUBMUNICIPALITY'], note: { ar: 'في عقود فرص يحمل MUNICIPALITYID جهة على مستوى الأمانة؛ والبلدية الأدنى في SUBMUNICIPALITY (لم يُتحقق من تعبئتها).', en: 'In the Furas contracts MUNICIPALITYID holds an Amanah-level entity; the municipality below it would be SUBMUNICIPALITY (population not verified).' } },
  fines: { system: 'Mumathil (compliance family)', amanahFields: ['AmanaNo', 'ArabicAmanaName'], municipalityFields: ['MunicipalityId', 'ArabicMainBaladya', 'SUBMUNICIPALITYID', 'ArabicBranchBaladya'], note: { ar: 'بلدية رئيسية وبلدية فرعية.', en: 'A main municipality and a branch municipality.' } },
  municipal_fees: { system: 'Baladi (Finance / Tahseel, ENT_REVENUES)', amanahFields: ['AMANA_NO', 'ARABIC_AMANA_NAME'], municipalityFields: ['BALADYA_KEY', 'BALADYA_NO', 'MAIN_BALADYA_NO', 'ARABIC_BALADYA_NAME', 'ARABIC_MAIN_BALADYA_NAME'], note: { ar: 'BALADYA_KEY في ENT_REVENUES؛ يتعلق بالبلدية الرئيسية أو الفرعية بحسب المصدر.', en: 'BALADYA_KEY on ENT_REVENUES; main or branch municipality depending on the source.' } },
  licenses: { system: 'Amanah internal reports (Licences)', amanahFields: ['AMANAID', 'AMANANAME', 'AMANA_CODE'], municipalityFields: ['BALADIAID', 'BALADIANAME', 'BALADYA_TYPE', 'MUNICIPALITY_ID'], note: { ar: 'BALADYA_TYPE يميز نوع البلدية.', en: 'BALADYA_TYPE tells the kind of municipality.' } },
  accommodation: { system: 'Baladi (Tobacco & accommodation)', amanahFields: ['AMANA_CODE', 'AMANA_NO', 'AMANA_GUID', 'ARABIC_AMANA_NAME'], municipalityFields: ['BALADYA_CODE', 'BALADYA_NO', 'BALADYA_GUID', 'ARABIC_BALADYA_NAME', 'ARABIC_MUNICIPALITY_NAME', 'BRANCH_BALADYA_ID'], note: { ar: 'بلدية رئيسية وفرعية (BRANCH_BALADYA_*).', en: 'Main and branch municipality (BRANCH_BALADYA_*).' } },
  tobacco: { system: 'Baladi (Tobacco & accommodation)', amanahFields: ['AMANA_CODE', 'AMANA_NO', 'AMANA_GUID', 'ARABIC_AMANA_NAME'], municipalityFields: ['BALADYA_CODE', 'BALADYA_NO', 'BALADYA_GUID', 'ARABIC_BALADYA_NAME', 'ARABIC_MUNICIPALITY_NAME', 'BRANCH_BALADYA_ID'], note: { ar: 'بلدية رئيسية وفرعية (BRANCH_BALADYA_*).', en: 'Main and branch municipality (BRANCH_BALADYA_*).' } },
  white_lands: { system: 'Baladi (white lands DS-037 / DS-038)', amanahFields: [], municipalityFields: [], verified: false, note: { ar: 'جداول الأراضي البيضاء تحمل المدينة والمنطقة فقط (CityName, RegionName) ولا حقل بلدية: تبقى «البلدية غير محددة في المصدر».', en: 'The white-land datasets carry a city and a region only (CityName, RegionName), no municipality field: the municipality stays not specified.' } },
  housing_sales: { system: 'Baladi (housing sales)', amanahFields: [], municipalityFields: [], verified: false, note: { ar: 'غير مغطى بقواميس البيانات المفحوصة؛ تصدر قطاع الإسكان مباشرة.', en: 'Not covered by the inspected dictionaries; the Housing Sector issues directly.' } }
};
void SOURCES;

/* ---------- the fields every invoice row / detail carries ---------- */
/**
 * The municipality fields of one invoice.
 *   ent, code: from the store (st.ent / st.mref) · sourceKey: the revenue source · sourceValue: the original text the source gave (fixtures / uploads); omitted for generated invoices,
 *   whose source value is a SYNTHETIC stand-in for the source field (BALADYA_KEY / ARABIC_BALADYA_NAME of the supplying system).
 */
export function municipalityFields({ ent, code, sourceKey, sourceValue = null, synthetic = true }) {
  const status = statusOfCode(ent, code); const a = ENTITIES[ent]; const m = status === 'mapped' ? municipalityOfCode(ent, code) : null;
  const map = SOURCE_MUNICIPALITY_FIELDS[sourceKey] || null;
  const fieldList = map && map.municipalityFields.length ? map.municipalityFields.slice(0, 2).join(' / ') : null;
  const self = isAmanah(ent) ? amanahSelfOf(a.en) : null;
  let value = sourceValue != null && String(sourceValue).trim() !== '' ? String(sourceValue).trim() : null;
  if (value == null && synthetic) value = status === 'mapped' ? m.sourceNameAr : status === 'direct_amanah' ? (self ? self.sourceNameAr : a.ar) : null;
  const note = status === 'not_specified' ? MUNICIPALITY_NOT_SPECIFIED : STATUS_LABEL[status];
  return {
    municipalityRefId: m ? m.refId : null, // INTERNAL reference id — not an official code
    municipalityKey: muniKeyOfCode(ent, code),
    municipalityAr: m ? m.ar : null, municipalityEn: m ? m.en : null,
    municipalityStatus: status,
    municipalityNote: note,
    municipalityFlags: m ? m.flags : [],
    municipalitySource: { value, system: map ? map.system : null, field: fieldList, simulated: !!synthetic, mapping: map ? map.note : null },
    municipalitySourceValue: value, municipalitySourceSystem: map ? map.system : null
  };
}
