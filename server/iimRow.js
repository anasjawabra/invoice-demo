// IIM fields of one invoice (generated or hand-anchored): biller / origin, product, revenue classification, invoice kind, exclusion reason.
// A pure read of the columnar store — nothing is stored per invoice beyond the `gfs` index.
import { SOURCES, ITEMS, ENTITIES, RULE_IDS } from '../src/data/catalog.js';
import { billerOf, originOf, originIdxOf, productOf, entityTypeOf, ENTITY_TYPE_AR, PRODUCTS, DISCLOSURE_PRODUCTS, classOfRow, gfsCodeAt, EXCLUSION_REASON_OF_RULE, EXCLUSION_SOURCE_OF_RULE, ORIGIN_AR } from '../src/data/iim.js';
import { sadadOf, subscriptionOf, REQUEST, facilityKeyOf, personName, nationalIdOf, mobileOf, payerName, beneficiaryIdOf } from './names.js';
import { MAIN } from '../src/data/iim.js';
import { isoOf } from '../src/data/catalog.js';

const hashOf = (n) => Math.imul((n % 2147483629) | 0, 0x9e3779b1) >>> 0;
export const DIFFERENCES_SHARE = 14; // % of tobacco / accommodation invoices that are audit differences (فروقات) rather than declared occupancy (إشغالات) — illustrative

export function iimFields(st, i) {
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const ent = st.ent[i]; const sc = st.scope[i];
  const b = fx?.billerId ? { id: fx.billerId, ar: billerOf(ent, sc).ar, en: billerOf(ent, sc).en } : billerOf(ent, sc);
  const origin = originOf(b.id); const oIdx = originIdxOf(ent, sc);
  const sourceKey = SOURCES[st.src[i]].key; const pk = productOf(sourceKey, ITEMS[st.item[i]].key, oIdx);
  const cls = classOfRow(st.gfs[i], origin === 'central' ? 0 : 1);
  const disclosure = DISCLOSURE_PRODUCTS.includes(pk);
  const kind = disclosure && !fx ? (hashOf(st.idKey[i]) % 100 < DIFFERENCES_SHARE ? 'differences' : 'occupancy') : null;
  return {
    sadadNo: fx ? fx.sadadNo || '' : sadadOf(st.idKey[i]),
    billerId: b.id, billerAr: b.ar, billerEn: b.en, origin, originAr: ORIGIN_AR[origin], originIdx: oIdx,
    productKey: pk, productAr: PRODUCTS[pk].ar, productEn: PRODUCTS[pk].en,
    gfsCode: cls.code, gfsSub: cls.sub, mainClass: cls.main, gfsIdx: st.gfs[i],
    invoiceKind: kind, entityType: entityTypeOf(ent), entityTypeAr: ENTITY_TYPE_AR[entityTypeOf(ent)]
  };
}
export const INVOICE_KIND_AR = { occupancy: 'إشغالات (إفصاح من المكلف)', differences: 'فروقات (ناتجة عن التدقيق)' };
export const INVOICE_KIND_SHORT_AR = { occupancy: 'إشغالات', differences: 'فروقات' };

// the reason an invoice is excluded (the primary one), as the business names it — only when the exclusion applies (uncollected, not cancelled)
export function exclusionOf(D) {
  if (!D.excluded || !D.primaryBit) return null;
  const ruleId = RULE_IDS[Math.round(Math.log2(D.primaryBit))];
  const r = EXCLUSION_REASON_OF_RULE[ruleId]; const s = EXCLUSION_SOURCE_OF_RULE[ruleId];
  return r ? { ruleId, reasonAr: r.ar, reasonEn: r.en, sourceAr: s?.ar || null, sourceEn: s?.en || null } : null;
}
void ENTITIES; void gfsCodeAt;

// the investment-invoice outcomes (IIM-16): internal → an information note (never a deviation); central and found in Furas → linked; central and NOT found → a flag with the possible causes
export const INVESTMENT_NO_CONTRACT_CAUSES = [
  { ar: 'فاتورة شاشة إلكترونية صادرة يدويًا', en: 'An electronic-screen invoice issued manually' },
  { ar: 'استغلال الموقع بعد انتهاء العقد', en: 'Use of the site after the contract ended' },
  { ar: 'احتمال خطأ في التصنيف', en: 'A possible classification error' },
  { ar: 'عقد منتهٍ دون تجديد', en: 'A contract that expired without renewal' }
];
export function investmentOutcome(st, i, im) {
  if (im.mainClass !== MAIN.investment) return null;
  if (im.origin === 'internal') return 'internal_note';
  const cs = st.cstat[i]; // 1 linked · 2 unmatched · 3 confirmed none · 4 unlinked · 5 unverified · 0 not applicable
  return cs === 1 ? 'linked' : cs === 2 || cs === 3 || cs === 4 ? 'not_linked' : 'linked_unverified';
}

// everything the invoice page adds to a record: ids, classification, beneficiary, dates, disclosure and contract details (all fictional in the demo)
export function iimDetail(st, i, rec, D) {
  const im = iimFields(st, i); const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const idKey = st.idKey[i]; const gen = !fx;
  const pk = im.productKey; const company = gen ? st.payer[i] < 10000 : true;
  const last = rec.payments?.length ? rec.payments.reduce((m, p) => (p.date > m ? p.date : m), '') : null;
  const full = D.collected > 0 && D.outstanding <= 0 && !D.cancelled ? last : null;
  const settle = full ? isoOf(Math.round((Date.parse(full) / 86400000) + 1 + (idKey % 3))) : null; // settlement follows the payment by 1–3 days
  const out = { ...im, exclusion: exclusionOf(D), referenceNo: gen ? subscriptionOf(idKey) : null, requestNo: gen && ['municipal_fees', 'licenses', 'white_lands'].includes(rec.revenueSource) ? REQUEST.of(idKey) : null,
    beneficiary: { idType: company ? { ar: 'سجل تجاري', en: 'Commercial registration' } : { ar: 'هوية وطنية', en: 'National ID' }, id: rec.beneficiaryId || null, name: { ar: rec.entityAr, en: rec.entityEn }, mobile: gen && !(st.flags[i] & 2) ? mobileOf(st.payer[i]) : null },
    paidDate: full, settlementDate: settle, cancelDate: rec.cancelled?.date || null, revenueAmount: Math.max(0, rec.grossAmount - (rec.vatAmount || 0)),
    disclosure: null, investment: null };
  if (im.invoiceKind) { // tobacco / accommodation (D16)
    const iss = isoOf(st.issue[i]); const prev = Date.UTC(Number(iss.slice(0, 4)), Number(iss.slice(5, 7)) - 2, 1); const dd = new Date(prev);
    out.disclosure = { kind: im.invoiceKind, taxpayer: { ar: rec.entityAr, en: rec.entityEn }, facility: { key: facilityKeyOf(st.payer[i]), ar: rec.entityAr, en: rec.entityEn }, year: im.invoiceKind === 'occupancy' ? dd.getUTCFullYear() : null, month: im.invoiceKind === 'occupancy' ? dd.getUTCMonth() + 1 : null };
  }
  const outcome = investmentOutcome(st, i, im);
  if (outcome) out.investment = { outcome, causes: outcome === 'not_linked' ? INVESTMENT_NO_CONTRACT_CAUSES : [] };
  void personName; void nationalIdOf; void payerName; void beneficiaryIdOf; void pk;
  return out;
}
