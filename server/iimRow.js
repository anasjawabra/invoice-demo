// IIM fields of one invoice (generated or hand-anchored): biller / origin, product, revenue classification, invoice kind, exclusion reason.
// A pure read of the columnar store — nothing is stored per invoice beyond the `gfs` index.
import { SOURCES, ENTITIES, RULE_IDS } from '../src/data/catalog.js';
import { billerOf, originOf, originIdxOf, productOf, PRODUCTS, DISCLOSURE_PRODUCTS, classOfRow, gfsCodeAt, EXCLUSION_REASON_OF_RULE, EXCLUSION_SOURCE_OF_RULE, ORIGIN_AR } from '../src/data/iim.js';
import { sadadOf } from './names.js';

const hashOf = (n) => Math.imul((n % 2147483629) | 0, 0x9e3779b1) >>> 0;
export const DIFFERENCES_SHARE = 14; // % of tobacco / accommodation invoices that are audit differences (فروقات) rather than declared occupancy (إشغالات) — illustrative

export function iimFields(st, i) {
  const fx = i >= st.nGen ? st.fixtures.get(i) : null;
  const ent = st.ent[i]; const sc = st.scope[i];
  const b = fx?.billerId ? { id: fx.billerId, ar: billerOf(ent, sc).ar, en: billerOf(ent, sc).en } : billerOf(ent, sc);
  const origin = originOf(b.id); const oIdx = originIdxOf(ent, sc);
  const sourceKey = SOURCES[st.src[i]].key; const pk = productOf(sourceKey);
  const cls = classOfRow(st.gfs[i], origin === 'central' ? 0 : 1);
  const disclosure = DISCLOSURE_PRODUCTS.includes(pk);
  const kind = disclosure && !fx ? (hashOf(st.idKey[i]) % 100 < DIFFERENCES_SHARE ? 'differences' : 'occupancy') : null;
  return {
    sadadNo: fx ? fx.sadadNo || '' : sadadOf(st.idKey[i]),
    billerId: b.id, billerAr: b.ar, billerEn: b.en, origin, originAr: ORIGIN_AR[origin], originIdx: oIdx,
    productKey: pk, productAr: PRODUCTS[pk].ar, productEn: PRODUCTS[pk].en,
    gfsCode: cls.code, gfsSub: cls.sub, mainClass: cls.main, gfsIdx: st.gfs[i],
    invoiceKind: kind
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
