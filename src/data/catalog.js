// ============================================================================
// Shared catalog (client + server): entities, sources, items, code tables and
// epoch-day helpers. Codes are what the columnar store keeps per invoice.
// ============================================================================

/* ---------- Entities (Amanahs + the Housing sector + "Unassigned") ---------- */
export const ENTITIES = [
  { en: 'Riyadh Amanah', ar: 'أمانة منطقة الرياض', zh: '利雅得' },
  { en: 'Jeddah Amanah', ar: 'أمانة محافظة جدة', zh: '吉达' },
  { en: 'Eastern Province Amanah', ar: 'أمانة المنطقة الشرقية', zh: '东部省' },
  { en: 'Makkah Amanah', ar: 'أمانة منطقة مكة المكرمة', zh: '麦加' },
  { en: 'Al Madinah Amanah', ar: 'أمانة المدينة المنورة', zh: '麦地那' },
  { en: 'Asir Amanah', ar: 'أمانة منطقة عسير', zh: '阿西尔' },
  { en: 'Taif Amanah', ar: 'أمانة محافظة الطائف', zh: '塔伊夫' },
  { en: 'Al-Qassim Amanah', ar: 'أمانة منطقة القصيم', zh: '卡西姆' },
  { en: 'Al-Ahsa Amanah', ar: 'أمانة محافظة الأحساء', zh: '哈萨' },
  { en: 'Jazan Amanah', ar: 'أمانة منطقة جازان', zh: '吉赞' },
  { en: 'Tabuk Amanah', ar: 'أمانة منطقة تبوك', zh: '塔布克' },
  { en: "Ha'il Amanah", ar: 'أمانة منطقة حائل', zh: '哈伊勒' },
  { en: 'Northern Borders Amanah', ar: 'أمانة منطقة الحدود الشمالية', zh: '北部边境' },
  { en: 'Najran Amanah', ar: 'أمانة منطقة نجران', zh: '纳季兰' },
  { en: 'Hafr Al-Batin Amanah', ar: 'أمانة محافظة حفر الباطن', zh: '哈费尔巴廷' },
  { en: 'Al Bahah Amanah', ar: 'أمانة منطقة الباحة', zh: '巴哈' },
  { en: 'Al Jawf Amanah', ar: 'أمانة منطقة الجوف', zh: '焦夫' },
  { en: 'Housing Sector', ar: 'قطاع الإسكان', zh: '住房部门' },
  { en: 'Unassigned', ar: 'غير محدد الأمانة (لم تُطابق في مكين)', zh: '未分配' }
];
export const N_AMANAH = 17;
export const ENT_HOUSING = 17;
export const ENT_UNASSIGNED = 18;
export const ENTITY_INDEX = Object.fromEntries(ENTITIES.map((e, i) => [e.en, i]));
export const AMANAH_CATALOG = ENTITIES.slice(0, N_AMANAH);

const MUNI_DIRS = [{ en: 'North', ar: 'الشمالية' }, { en: 'Central', ar: 'المركزية' }, { en: 'South', ar: 'الجنوبية' }];
const shortAr = (s) => s.replace(/^أمانة\s*(منطقة|محافظة)?\s*/, '');
const shortEn = (s) => s.replace(/ Amanah$/, '');
export function municipalityOf(ent, muni) {
  const e = ENTITIES[ent];
  if (!e) return null;
  if (ent === ENT_HOUSING) return muni === 0 ? { key: `${e.en}|Sales`, en: 'Housing sales unit', ar: 'وحدة المبيعات السكنية' } : null; // white-land invoices carry a city (source detail), not a municipality
  if (ent === ENT_UNASSIGNED || muni == null || muni > 2) return null;
  const d = MUNI_DIRS[muni];
  return { key: `${e.en}|${d.en}`, en: `${shortEn(e.en)} ${d.en} Municipality`, ar: `بلدية ${shortAr(e.ar)} ${d.ar}` };
}
export function municipalitiesOf(entityEn) {
  const ent = ENTITY_INDEX[entityEn];
  if (ent == null) return [];
  if (ent === ENT_HOUSING) return [municipalityOf(ent, 0)];
  if (ent === ENT_UNASSIGNED) return [];
  return [0, 1, 2].map((m) => municipalityOf(ent, m));
}

/* ---------- Revenue sources ---------- */
export const SOURCES = [
  { key: 'investment', platform: 'Foras' },
  { key: 'fines', platform: 'Mumathil' },
  { key: 'municipal_fees', platform: 'Baladi' },
  { key: 'licenses', platform: 'Amanah Internal Reports' },
  { key: 'accommodation', platform: 'Baladi' },
  { key: 'tobacco', platform: 'Baladi' },
  { key: 'white_lands', platform: 'Baladi' },
  { key: 'housing_sales', platform: 'Baladi' }
];
export const SOURCE_INDEX = Object.fromEntries(SOURCES.map((s, i) => [s.key, i]));

/* ---------- Revenue items (بند الإيراد) — structure follows the revenue-account taxonomy seen in the sample extract ---------- */
export const ITEMS = [
  { key: 'land_lease', source: 'investment', ar: 'إيجار أراضي', en: 'Land lease' },
  { key: 'ad_sites', source: 'investment', ar: 'استثمار مواقع إعلانية', en: 'Advertising sites' },
  { key: 'commercial_units', source: 'investment', ar: 'إيجار محلات تجارية', en: 'Commercial units rent' },
  { key: 'building_violations', source: 'fines', ar: 'مخالفات البناء', en: 'Building violations' },
  { key: 'signage_violations', source: 'fines', ar: 'مخالفات اللوحات', en: 'Signage violations' },
  { key: 'health_violations', source: 'fines', ar: 'مخالفات الاشتراطات الصحية', en: 'Health-condition violations' },
  { key: 'inspection_fees', source: 'municipal_fees', ar: 'رسوم الكشفية (المعاينة)', en: 'Inspection fees' },
  { key: 'waste_collection', source: 'municipal_fees', ar: 'جمع النفايات', en: 'Waste collection' },
  { key: 'excavation_permits', source: 'municipal_fees', ar: 'تراخيص حفر الشوارع', en: 'Street-excavation permits' },
  { key: 'ad_boards', source: 'municipal_fees', ar: 'اللوحات الإعلانية', en: 'Advertising boards' },
  { key: 'commercial_license', source: 'licenses', ar: 'رخص الأنشطة التجارية', en: 'Commercial-activity licences' },
  { key: 'signboard_license', source: 'licenses', ar: 'لوحات محلات', en: 'Shop signboards' },
  { key: 'building_permit', source: 'licenses', ar: 'تراخيص المباني والأسوار', en: 'Building and fence permits' },
  { key: 'health_certificate', source: 'licenses', ar: 'الشهادات الصحية', en: 'Health certificates' },
  { key: 'hotel_occupancy', source: 'accommodation', ar: 'إشغال مرافق الإيواء', en: 'Accommodation-facility occupancy' },
  { key: 'tobacco_fee', source: 'tobacco', ar: 'رسم تقديم منتجات التبغ', en: 'Tobacco-product service fee' },
  { key: 'white_land_fee', source: 'white_lands', ar: 'رسوم الأراضي البيضاء', en: 'White-land fees' },
  { key: 'misc_revenue', source: 'municipal_fees', ar: 'إيرادات مختلفة', en: 'Miscellaneous revenue' },
  { key: 'housing_sales', source: 'housing_sales', ar: 'المبيعات السكنية', en: 'Residential sales' },
  { key: 'housing_fees', source: 'housing_sales', ar: 'رسوم المبيعات', en: 'Sales fees' }
];
export const ITEM_INDEX = Object.fromEntries(ITEMS.map((x, i) => [x.key, i]));
export const REVENUE_ITEMS = ITEMS.reduce((m, it) => { (m[it.source] = m[it.source] || []).push(it); return m; }, {});

/* ---------- Code tables ---------- */
export const RULE_IDS = ['DUP-1', 'CR-1', 'DEC-1', 'NOC-1', 'INC-1', 'EXE-1', 'EFA-1', 'OBJ-1', 'ENF-1']; // bit position = index
export const RULE_BIT = Object.fromEntries(RULE_IDS.map((id, i) => [id, 1 << i]));
export const CR_STATUS = [null, 'Active', 'Deleted', 'Suspended', 'Cancelled'];
export const EFAA_STATUS = [null, 'مسددة', 'قائمة', 'تحت الاعتراض', 'غير مكتملة', 'منفذ ضده'];
export const CSTAT = ['not_applicable', 'linked', 'unmatched', 'confirmed_none', 'unlinked', 'unverified'];
export const CHANNELS = ['sadad', 'voluntary', 'enforcement', 'transfer', 'card', 'wallet']; // 'wallet' = deducted from the facility wallet (tobacco / accommodation platforms)
export const CH_WALLET = 5;
export const ALINK = ['internal_report', 'makeen_matched', 'makeen_unmatched'];

/* ---------- Flag bits ---------- */
export const F = {
  OBJECTION: 1, MISSING_ID: 2, AMT_CONFLICT: 4, EXCEPTIONAL: 8, CONTRACT_INV: 16, FIXTURE: 32, UPLOADED: 64,
  LEGACY_CANCELLED: 128, NOT_CHECKABLE: 256, DUPLICATE_WF: 512, NEEDS_CONTRACT: 1024
};
// Two small bit-fields share the upper flag bits (their meaning depends on the revenue source):
//  GRP (bits 11-13): tobacco / accommodation disclosure replacement  -> 1 = replaced by the next invoice, 2 = replaces the previous one
//                    white-land deeds with several owners            -> 1/2 = first of a 2/3-owner deed, 3/4 = 2nd/3rd owner (deed key = this key - 1 / - 2)
//  EXT (bits 14-15): white-land extension request on the invoice     -> 0 none, 1 approved, 2 refused, 3 pending
export const GRP_SHIFT = 11; export const EXT_SHIFT = 14;
export const grpOf = (flags) => (flags >> GRP_SHIFT) & 7;
export const extOf = (flags) => (flags >> EXT_SHIFT) & 3;
export const GRP = { NONE: 0, TB_REPLACED: 1, TB_REPLACEMENT: 2, WL_HEAD2: 1, WL_HEAD3: 2, WL_OWN2: 3, WL_OWN3: 4 };
export const withGrp = (g) => g << GRP_SHIFT; export const withExt = (e) => e << EXT_SHIFT;

/* ---------- Epoch-day helpers ---------- */
export const dayNum = (iso) => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);
const isoCache = new Map();
export const isoOf = (day) => { let s = isoCache.get(day); if (!s) { s = new Date(day * 86400000).toISOString().slice(0, 10); if (isoCache.size < 5000) isoCache.set(day, s); } return s; };
