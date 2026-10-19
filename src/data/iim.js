// ============================================================================
// IIM layer (meeting 18 Oct 2026) — shared by the client and the server.
// Biller / origin, product name, revenue classification (GFS code → sub-class → main class, with the
// biller-dependent override), the exclusion reasons as the business names them, and the invoice-id format.
//
// ASSUMPTIONS kept in ONE place so each can be reversed with one edit:
//   S7  only biller 177 is central — every other biller (the Amanahs, and the Housing sector) is internal.
//   S6  exclusions are applied automatically (EXCLUSIONS_AUTO_APPLY).
// The classification table mirrors the structure of the ministry's «تصنيف الإيرادات» file (codes and names only — no figures).
// ============================================================================
import { ENTITIES, ENT_HOUSING, ENT_UNASSIGNED, N_AMANAH, SOURCES, ITEMS } from './catalog.js';

/* ---------- billers / origin ---------- */
export const CENTRAL_BILLER_IDS = ['177'];
export const CENTRAL_BILLER = { id: '177', ar: 'الفوترة المركزية — وزارة البلديات والإسكان', en: 'Central billing — Ministry of Municipalities and Housing' };
export const HOUSING_BILLER = { id: '171', ar: 'قطاع الإسكان', en: 'Housing sector' };
// S9 (meeting 19 Oct): an invoice cancelled in Sadad BECAUSE it was referred to execution is not «cancelled» — it stays in إجمالي المفوتر and is excluded from net billed as «منفذ ضده – قضايا (سند)».
export const REFERRED_CANCELLED_STAYS_BILLED = true;
export const EXCLUSIONS_AUTO_APPLY = true; // ASSUMPTION S6 — switch to false to return to "proposed, needs confirmation"

const pad = (n, w) => String(n).padStart(w, '0');
/** Biller of an invoice: central invoices are billed under 177; an internal invoice under its own Amanah (or the Housing sector). */
export function billerOf(ent, scope) {
  if (ent === ENT_HOUSING) return HOUSING_BILLER;
  if (scope === 0 || ent === ENT_UNASSIGNED || ent == null) return CENTRAL_BILLER;
  const e = ENTITIES[ent];
  return { id: `3${pad(ent + 1, 2)}`, ar: e.ar, en: e.en };
}
/** الأمانة / الجهة: the Housing sector is an entity (جهة), not an Amanah (D31). */
export const entityTypeOf = (ent) => (ent === ENT_HOUSING || ent === ENT_UNASSIGNED ? 'entity' : 'amanah');
export const ENTITY_TYPE_AR = { amanah: 'أمانة', entity: 'جهة' };
export const isCentralBiller = (billerId) => CENTRAL_BILLER_IDS.includes(String(billerId));
export const originOf = (billerId) => (isCentralBiller(billerId) ? 'central' : 'internal');
export const ORIGIN_AR = { central: 'مركزي', internal: 'داخلي' };
export const ORIGIN_EN = { central: 'Central', internal: 'Internal' };
/** All billers (for filters / lookup), in a stable order. */
export const BILLERS = [CENTRAL_BILLER, ...ENTITIES.slice(0, N_AMANAH).map((e, i) => ({ id: `3${pad(i + 1, 2)}`, ar: e.ar, en: e.en })), HOUSING_BILLER];
export const billerEntity = (billerId) => { const k = BILLERS.findIndex((b) => b.id === String(billerId)); return k <= 0 ? null : k - 1 < N_AMANAH ? k - 1 : ENT_HOUSING; };

/* ---------- invoice id: `${billerId}-${sadadNumber}` ---------- */
export const invoiceKey = (billerId, sadad) => `${billerId}-${sadad}`;
export function parseInvoiceKey(s) { const m = /^(\d{3,4})-(\d{6,14})$/.exec(String(s || '').trim()); return m ? { billerId: m[1], sadad: m[2] } : null; }

/* ---------- product (اسم المنتج): the system the invoice originates from ---------- */
export const PRODUCTS = {
  foras: { ar: 'فرص', en: 'Furas' },
  screen: { ar: 'شاشة إلكترونية', en: 'Electronic screen' },
  baladi: { ar: 'بلدي', en: 'Baladi' },
  mumtathil: { ar: 'ممتثل', en: 'Mumtathil' },
  tobacco: { ar: 'تبغ', en: 'Tobacco platform' },
  accommodation: { ar: 'إيواء', en: 'Accommodation platform' },
  whiteLands: { ar: 'رسوم الأراضي البيضاء', en: 'White-land fees' },
  internal: { ar: 'الأنظمة الداخلية', en: 'Internal systems' }
};
export const PRODUCT_KEYS = Object.keys(PRODUCTS);
// the product-management unit groups tobacco and accommodation in ONE card (they stay separate in the filters)
export const PRODUCT_GROUPS = [['foras'], ['screen'], ['baladi'], ['mumtathil'], ['tobacco', 'accommodation'], ['whiteLands'], ['internal']];
export const PRODUCT_OF_SOURCE = { investment: 'foras', fines: 'mumtathil', municipal_fees: 'baladi', licenses: 'internal', accommodation: 'accommodation', tobacco: 'tobacco', white_lands: 'whiteLands', housing_sales: 'baladi' };
// the electronic-screen product is the investment ITEM «advertising sites»; every other product follows the revenue source
export const productOf = (sourceKey, itemKey) => (sourceKey === 'investment' && (itemKey === 'ad_sites') ? 'screen' : PRODUCT_OF_SOURCE[sourceKey] || 'baladi');
const PROD_POS = Object.fromEntries(PRODUCT_KEYS.map((k, i) => [k, i]));
const PROD_TABLE = new Uint8Array(SOURCES.length * ITEMS.length);
SOURCES.forEach((sr, si) => ITEMS.forEach((it, ii) => { PROD_TABLE[si * ITEMS.length + ii] = PROD_POS[productOf(sr.key, it.key)]; }));
/** compact per-invoice lookup used by scans: product index of (source index, item index) */
export const productIdxOf = (srcIdx, itemIdx) => PROD_TABLE[srcIdx * ITEMS.length + itemIdx];
export const DISCLOSURE_PRODUCTS = ['tobacco', 'accommodation'];

/* ---------- revenue classification ---------- */
export const MAIN = { municipal: 'رسوم بلدية', investment: 'استثمار', penalties: 'جزاءات وغرامات', misc: 'إيرادات مختلفة', accommodation: 'إيواء', tobacco: 'تبغ', other: 'أخرى' };
export const MAIN_EN = { 'رسوم بلدية': 'Municipal fees', 'استثمار': 'Investment', 'جزاءات وغرامات': 'Penalties and fines', 'إيرادات مختلفة': 'Miscellaneous revenue', 'إيواء': 'Accommodation', 'تبغ': 'Tobacco', 'أخرى': 'Other', 'غير مصنف': 'Unclassified' };
export const UNCLASSIFIED = 'غير مصنف';
export const OTHER_CLASS = MAIN.other; // main class excluded from إجمالي المفوتر (VAT, sale of documents, refunds …)

// code → { sub (تصنيف الإيراد الفرعي), main (تصنيف الإيراد الرئيسي) }
export const GFS = {
  '14155': { sub: 'ريع الأراضي (أجور الأراضي البيضاء، أجور سطحية)', main: MAIN.investment },
  '141229': { sub: 'أرباح أخرى', main: MAIN.investment },
  '142134': { sub: 'أجور العقود التجارية', main: MAIN.investment },
  '142162': { sub: 'تأجير مرافق', main: MAIN.investment },
  '142163': { sub: 'تأجير مباني تجارية', main: MAIN.investment },
  '1421912': { sub: 'تأجير العقارات لأغراض مؤقتة', main: MAIN.investment },
  '142113': { sub: 'اللوحات الإعلانية', main: MAIN.investment },
  '142161': { sub: 'الإيجارات وأقساط المساكن', main: MAIN.investment },
  '11200-11201': { sub: 'التأجير — تأجير أراضي', main: MAIN.investment },
  '11200-11203': { sub: 'التأجير — تأجير المرافق', main: MAIN.investment },
  '11200-11204': { sub: 'التأجير — تأجير مباني تجارية', main: MAIN.investment },
  '11100-11105': { sub: 'رسوم وأجور خدمات — اللوحات الإعلانية', main: MAIN.investment }, // overridden by biller: see OVERRIDES
  '11000-11006': { sub: 'إيرادات المبيعات — مبيعات ناتجة من النشاط غير مصنفة أعلاه', main: MAIN.misc },
  '11000-11007': { sub: 'إيرادات المبيعات — الأراضي', main: MAIN.misc },
  '1421999': { sub: 'مبيعات أخرى', main: MAIN.misc },
  '14': { sub: 'مبيعات أخرى', main: MAIN.misc },
  '11442': { sub: 'إشغال مرافق الإيواء', main: MAIN.accommodation },
  '11422': { sub: 'رسوم التبغ', main: MAIN.tobacco },
  '1421911': { sub: 'رسم مبيعات محلات تقديم منتجات التبغ', main: MAIN.tobacco },
  '1422121': { sub: 'رسم ترخيص نشاط تقديم منتجات التبغ', main: MAIN.tobacco },
  '1438': { sub: 'جزاءات وغرامات مفروضة بموجب أنظمة الجهة', main: MAIN.penalties },
  '1439': { sub: 'جزاءات وغرامات أخرى غير مصنفة (مبيعات المصادرات وغيرها)', main: MAIN.penalties },
  '11400-11401': { sub: 'إيرادات متنوعة — جزاءات وغرامات مفروضة بموجب أنظمة الجهة', main: MAIN.penalties },
  '1438001': { sub: 'جزاءات وغرامات مفروضة بموجب أنظمة الجهة', main: MAIN.penalties },
  '1438002': { sub: 'جزاءات وغرامات مفروضة بموجب أنظمة الجهة', main: MAIN.penalties },
  '142139': { sub: 'أجور الخدمات الأخرى للموانئ', main: MAIN.municipal },
  '11100-11101': { sub: 'رسوم وأجور خدمات — رسوم خدمات بلدية', main: MAIN.municipal },
  '1437': { sub: 'عوائد أرضيات', main: MAIN.municipal },
  '11102': { sub: 'تراخيص المحلات', main: MAIN.municipal },
  '11107': { sub: 'لوحات محلات', main: MAIN.municipal },
  '11110': { sub: 'البناء والترميم والهدم', main: MAIN.municipal },
  '11114': { sub: 'الكشفية', main: MAIN.municipal },
  '1421908': { sub: 'رسوم خدمات بلدية', main: MAIN.municipal },
  '1421909': { sub: 'جمع النفايات', main: MAIN.municipal },
  '1421910': { sub: 'إصدار تراخيص إشغال الأرصفة العامة والطرق', main: MAIN.municipal },
  '1422103': { sub: 'تراخيص المحلات', main: MAIN.municipal },
  '1422104': { sub: 'رسوم وأجور ناتجة من النشاط غير مصنفة أعلاه', main: MAIN.municipal },
  '1422105': { sub: 'تطبيق البتر', main: MAIN.misc },
  '1422106': { sub: 'البناء والترميم والهدم', main: MAIN.municipal },
  '1422107': { sub: 'الحفر', main: MAIN.municipal },
  '1422108': { sub: 'الشهادات الصحية (إصدار الشهادات الصحية)', main: MAIN.municipal },
  '1422109': { sub: 'الكشفية (القيام بالمعاينة أو الكشفية)', main: MAIN.municipal },
  '1422112': { sub: 'إصدار رخصة', main: MAIN.municipal },
  '1422113': { sub: 'تحديث بيانات ترخيص العقار أو تجديد مزاولة النشاط', main: MAIN.municipal },
  '1422199': { sub: 'رسوم الخدمات العامة الأخرى', main: MAIN.municipal },
  '11452103': { sub: 'إصدار تراخيص المباني والأسوار', main: MAIN.municipal },
  '11452104': { sub: 'إصدار رخص الأنشطة التجارية', main: MAIN.municipal },
  '11452105': { sub: 'إصدار تراخيص حفر الشوارع', main: MAIN.municipal },
  '11452106': { sub: 'إصدار التراخيص بتأسيس أو تشغيل أبراج الاتصالات', main: MAIN.municipal },
  '11452109': { sub: 'اعتماد مخططات التطوير العقاري', main: MAIN.municipal },
  '11452107': { sub: 'إصدار التراخيص بتأسيس أو تشغيل الصراف الآلي', main: MAIN.municipal },
  '11452110': { sub: 'إصدار تراخيص استخدام أملاك خاصة لإقامة فعاليات', main: MAIN.municipal },
  '11452111': { sub: 'المقابل المالي للسماح للأنشطة التجارية بالعمل 24 ساعة', main: MAIN.municipal },
  '11452505': { sub: 'رسوم نقل الخدمات', main: MAIN.municipal },
  '11452512': { sub: 'لوحات محلات', main: MAIN.municipal },
  '11452513': { sub: 'لوحات إرشادية', main: MAIN.municipal },
  '11100-11106': { sub: 'رسوم وأجور خدمات — رسوم وأجور ناتجة من النشاط غير مصنفة أعلاه', main: MAIN.municipal },
  '11452108': { sub: 'بلدي — الرخص الإنشائية', main: MAIN.municipal },
  '1421905': { sub: 'رسوم اشتراكات (إيصال مياه وصرف صحي)', main: MAIN.misc },
  '11452511': { sub: 'رسوم خدمات الكهرباء', main: MAIN.misc },
  '11100-11103': { sub: 'رسوم وأجور خدمات — رسوم خدمات الكهرباء', main: MAIN.misc },
  '1453': { sub: 'الإيرادات المتنوعة غير المصنفة في مكان آخر', main: MAIN.misc },
  '11519': { sub: 'رسوم الاستيراد الأخرى', main: MAIN.misc },
  '1421904': { sub: 'مبيعات مياه', main: MAIN.misc },
  '1422119': { sub: 'نقل ملكية العقار', main: MAIN.misc },
  '144122': { sub: 'إيرادات متنوعة غير مصنفة في مكان آخر', main: MAIN.misc },
  '1421903': { sub: 'مبيعات تيار كهربائي', main: MAIN.misc },
  '11400-11402': { sub: 'إيرادات متنوعة — إيرادات مختلفة ناتجة عن النشاط غير مصنفة', main: MAIN.misc },
  '1421907': { sub: 'المخططات', main: MAIN.misc },
  '1422202': { sub: 'نقل الملكية', main: MAIN.misc },
  '33182147': { sub: 'أمانات متنوعة أخرى', main: MAIN.misc },
  // «أخرى» — never part of إجمالي المفوتر (D7)
  '11411': { sub: 'ضريبة القيمة المضافة', main: OTHER_CLASS },
  '1421901': { sub: 'بيع الوثائق والأنظمة', main: OTHER_CLASS },
  '1431': { sub: 'الجزاءات والغرامات', main: OTHER_CLASS },
  '3318212': { sub: 'مرتجع رواتب', main: OTHER_CLASS },
  '144121': { sub: 'مبالغ مستردة من مصروفات سنوات سابقة', main: OTHER_CLASS },
  '180201': { sub: 'أجور الخدمات الإلكترونية التي تقدمها شركة علم', main: OTHER_CLASS }
};
export const OTHER_CODES = Object.keys(GFS).filter((k) => GFS[k].main === OTHER_CLASS);
// Biller-dependent main class: (code, origin) → main class. Advertising boards are a municipal fee when billed centrally (177) and an investment when billed by an Amanah (D6).
export const OVERRIDES = { '11100-11105': { central: MAIN.municipal, internal: MAIN.investment } };
export const gfsList = () => Object.keys(GFS);
export function classify(code, origin) {
  const g = GFS[String(code)];
  if (!g) return { code: code || null, sub: null, main: UNCLASSIFIED };
  const ov = OVERRIDES[String(code)];
  return { code: String(code), sub: g.sub, main: (ov && ov[origin]) || g.main };
}
// revenue item → GFS code. `misc_revenue` is the demo's «other» stream: a share of it carries the six «أخرى» codes (see otherCodeFor).
export const GFS_OF_ITEM = {
  land_lease: '14155', ad_sites: '142113', commercial_units: '142163', ad_boards_amanah: '11100-11105',
  building_violations: '1438', signage_violations: '1438001', health_violations: '1438002',
  inspection_fees: '11114', waste_collection: '1421909', excavation_permits: '11452105', ad_boards: '11100-11105',
  commercial_license: '11452104', signboard_license: '11107', building_permit: '11452103', health_certificate: '1422108',
  hotel_occupancy: '11442', tobacco_fee: '11422', white_land_fee: '1437', misc_revenue: '1453',
  housing_sales: '11000-11007', housing_fees: '1421999'
};
export const OTHER_SHARE = 0.38; // share of the miscellaneous stream that is «أخرى» (illustrative)
export const UNKNOWN_CODE = '1459'; // a code that is NOT in the classification file: shown as «غير مصنف» and counted visibly
export const UNKNOWN_SHARE = 0.03;
/** `h` is any stable 32-bit hash of the invoice: the same invoice always gets the same code. */
export function gfsCodeOf(itemKey, h = 0) {
  if (itemKey === 'misc_revenue') {
    const u = (h % 1000) / 1000;
    if (u < OTHER_SHARE) return OTHER_CODES[(h >>> 10) % OTHER_CODES.length];
    if (u < OTHER_SHARE + UNKNOWN_SHARE) return UNKNOWN_CODE;
  }
  return GFS_OF_ITEM[itemKey] || null;
}
/* compact per-invoice storage: an index into GFS_CODES (255 = a code that is not in the file) */
export const GFS_CODES = Object.keys(GFS);
const GFS_POS = new Map(GFS_CODES.map((c, i) => [c, i]));
export const UNKNOWN_IDX = 255;
export const gfsIndexOf = (code) => (code == null ? UNKNOWN_IDX : GFS_POS.has(String(code)) ? GFS_POS.get(String(code)) : UNKNOWN_IDX);
export const gfsCodeAt = (idx) => (idx === UNKNOWN_IDX ? UNKNOWN_CODE : GFS_CODES[idx]);
export const MAIN_LIST = [MAIN.municipal, MAIN.investment, MAIN.penalties, MAIN.misc, MAIN.accommodation, MAIN.tobacco, MAIN.other, UNCLASSIFIED];
const MAIN_POS = Object.fromEntries(MAIN_LIST.map((m, i) => [m, i]));
export const OTHER_MAIN_IDX = MAIN_POS[MAIN.other]; export const UNCLASSIFIED_MAIN_IDX = MAIN_POS[UNCLASSIFIED];
// mainClassIdx(gfsIdx, originIdx 0 = central / 1 = internal) — a table lookup, so a scan over millions of invoices stays cheap
const MAIN_TABLE = new Uint8Array(256 * 2).fill(UNCLASSIFIED_MAIN_IDX);
GFS_CODES.forEach((c, i) => { MAIN_TABLE[i * 2] = MAIN_POS[classify(c, 'central').main]; MAIN_TABLE[i * 2 + 1] = MAIN_POS[classify(c, 'internal').main]; });
export const mainClassIdx = (gfsIdx, originIdx) => MAIN_TABLE[gfsIdx * 2 + originIdx];
export const originIdxOf = (ent, scope) => (ent === ENT_HOUSING ? 1 : scope === 1 ? 1 : 0); // 0 central · 1 internal — Housing is billed under 171 (internal, S7)
export const classOfRow = (gfsIdx, originIdx) => { const code = gfsCodeAt(gfsIdx); return gfsIdx === UNKNOWN_IDX ? { code, sub: null, main: UNCLASSIFIED } : classify(code, originIdx === 0 ? 'central' : 'internal'); };
/** Display: the name, with the code small after it — rendered by <ClassName/>; this is the plain-text form. */
export const classLabel = (c) => (c && c.sub ? `${c.sub} (${c.code})` : c?.code ? `(${c.code})` : UNCLASSIFIED);

/* ---------- exclusion reasons as the business names them (D11 / D11a) ---------- */
export const EXCLUSION_REASONS = [
  { ruleId: 'CR-1', ar: 'سجلات مشطوبة', en: 'Struck-off records' },
  { ruleId: 'DEC-1', ar: 'متوفى', en: 'Deceased' },
  { ruleId: 'OBJ-1', ar: 'اعتراضات قائمة', en: 'Open objections' },
  { ruleId: 'NOC-1', ar: 'فواتير لا تستند على عقود', en: 'Invoices not based on contracts' },
  { ruleId: 'INC-1', ar: 'غير مكتمل', en: 'Incomplete' },
  { ruleId: 'EFA-1', ar: 'خارج إيفاء', en: 'Outside Efaa' },
  { ruleId: 'EXE-1', ar: 'منفذ ضده – إيفاء', en: 'Executed against – Efaa' },
  { ruleId: 'SND-1', ar: 'منفذ ضده – قضايا (سند)', en: 'Executed against – cases (Sanad)' },
  { ruleId: 'ATT-1', ar: 'إفادات الأمانات', en: 'Amanah statements' },
  { ruleId: 'ENC-1', ar: 'التعديات / استغلال المواقع', en: 'Encroachments / site exploitation' },
  { ruleId: 'DUP-1', ar: 'فاتورة مكررة', en: 'Duplicate invoice' } // not named in the meeting; kept because it is an approved data-quality rule (open question OQ-1)
];
export const EXCLUSION_REASON_OF_RULE = Object.fromEntries(EXCLUSION_REASONS.map((r) => [r.ruleId, r]));
export const EXCLUSION_SOURCE_OF_RULE = { 'CR-1': { ar: 'السجل التجاري', en: 'Commercial registry' }, 'DEC-1': { ar: 'السجل المدني', en: 'Civil registry' }, 'OBJ-1': { ar: 'إيفاء — الاعتراضات', en: 'Efaa — objections' }, 'NOC-1': { ar: 'فرص', en: 'Furas' }, 'INC-1': { ar: 'إيفاء — غير مكتمل', en: 'Efaa — incomplete' }, 'EFA-1': { ar: 'إيفاء', en: 'Efaa' }, 'EXE-1': { ar: 'إيفاء — منفذ ضده', en: 'Efaa — executed against' }, 'SND-1': { ar: 'سند – قضايا', en: 'Sanad – cases' }, 'DUP-1': { ar: 'كشف التكرار', en: 'Duplicate detection' }, 'ATT-1': { ar: 'إفادة الأمانة', en: 'Amanah statement' }, 'ENC-1': { ar: 'محضر التعدي', en: 'Encroachment record' } };
