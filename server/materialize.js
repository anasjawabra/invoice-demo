// Rebuilds the full record object of ONE invoice from the columns (invoice details are loaded when opened, never in bulk).
// Line items, identifiers, evidence texts and the evidence trail are deterministic functions of the invoice key.
import { ENTITIES, SOURCES, ITEMS, CHANNELS, CSTAT, CR_STATUS, EFAA_STATUS, ALINK, RULE_IDS, RULE_BIT, F, isoOf, municipalityOf } from '../src/data/catalog.js';
import { EXCLUSION_RULES } from '../src/data/revenueMetrics.js';
import { Rng, mix } from './world.js';
import { invoiceIdOf, sadadOf, subscriptionOf, violationOf, payerName, beneficiaryIdOf } from './names.js';
import { idOf, derive, makeCtx, recordRiskFlags, CLASSES } from './engine.js';
import { sourceRecord } from './sourceRecords.js';

const RULE_BY_ID = Object.fromEntries(EXCLUSION_RULES.map((r) => [r.id, r]));
const REVIEWER = { en: 'Revenue data steward (demo reviewer)', ar: 'أمين بيانات الإيرادات (مراجع تجريبي)' };

const TEMPLATES = {
  'DUP-1': { evidence: { en: 'Same payer, amount and period as an earlier invoice (duplicate detection).', ar: 'نفس الدافع والمبلغ والفترة لفاتورة سابقة (كشف التكرار).' }, sources: [{ system: 'تحصيل — تفاصيل الفواتير', field: 'بنود الفاتورة', value: 'مطابقة لفاتورة سابقة' }] },
  'CR-1': { evidence: { en: 'CR status (raw) linked through Sanad document extraction.', ar: 'حالة السجل التجاري (خام) المرتبطة عبر استخراج مستندات سند.' }, sources: [] },
  'DEC-1': { evidence: { en: 'Civil-registry flag suggests the debtor is deceased; heir/estate position not established.', ar: 'إشارة السجل المدني تفيد بوفاة المدين؛ وضع الورثة/التركة غير مثبت.' }, sources: [{ system: 'السجل المدني', field: 'حالة الوفاة', value: 'متوفى' }] },
  'NOC-1': { evidence: { en: 'Furas confirms no contract exists for this invoice.', ar: 'فرص تؤكد عدم وجود عقد لهذه الفاتورة.' }, sources: [{ system: 'فرص — العقود', field: 'رقم العقد', value: 'لا يوجد عقد (مؤكد)' }] },
  'INC-1': { evidence: { en: 'Mandatory data incomplete in the source report.', ar: 'بيانات إلزامية غير مكتملة في تقرير المصدر.' }, sources: [{ system: 'إيفاء — تقرير غير المكتمل', field: 'اكتمال البيانات', value: 'غير مكتمل' }] },
  'EXE-1': { evidence: { en: 'Appears in the executed-against report.', ar: 'وارد في تقرير المنفذ ضده.' }, sources: [{ system: 'إيفاء — تقرير المنفذ ضده', field: 'حالة التنفيذ', value: 'منفذ ضده' }] },
  'EFA-1': { evidence: { en: 'Violation is not present in the Efaa system of record.', ar: 'المخالفة غير موجودة في نظام إيفاء المرجعي.' }, sources: [{ system: 'تحصيل — إيفاء v2', field: 'رقم المخالفة', value: 'غير مطابق في إيفاء' }] },
  'OBJ-1': { evidence: { en: 'Open objection in the violations system.', ar: 'اعتراض مفتوح في نظام المخالفات.' }, sources: [{ system: 'إيفاء — تقرير المخالفات العام', field: 'حالة الاعتراض', value: 'مفتوح' }] },
  'ENF-1': { evidence: { en: 'Referred to enforcement.', ar: 'محال إلى التنفيذ.' }, sources: [] }
};

export function materialize(st, i, ctx = null) {
  if (i >= st.nGen) { const f = st.fixtures.get(i); return f ? structuredCloneSafe(f) : null; }
  const c = ctx || makeCtx(st, {});
  const idKey = st.idKey[i]; const id = invoiceIdOf(idKey);
  const e = st.ent[i]; const ent = ENTITIES[e]; const src = SOURCES[st.src[i]]; const item = ITEMS[st.item[i]];
  const issueDate = isoOf(st.issue[i]); const dueDate = isoOf(st.due[i]);
  const muni = municipalityOf(e, st.muni[i]);
  const payer = payerName(st.payer[i]);
  const gross = st.gross[i];
  const flags = st.flags[i];
  const vatRate = src.key === 'fines' ? 0 : 0.15;
  // line items (deterministic split of the header amount)
  const r = new Rng(mix(9, idKey % 1000003, Math.floor(idKey / 1e8)));
  const nl = st.lines[i]; const lines = []; let rest = gross;
  for (let k = 1; k <= nl; k += 1) {
    const a = k === nl ? rest : Math.round((gross / nl) * (0.6 + r.next() * 0.6));
    const v = Math.min(a, rest - (nl - k)); lines.push({ no: k, name: nl > 1 ? `${item.ar} — بند ${k}` : item.ar, amount: v }); rest -= v;
  }
  let amountCheck = { status: 'consistent', basis: 'ex_vat', headerAmount: gross, lineTotal: gross, difference: 0 };
  if (flags & F.AMT_CONFLICT) {
    const diff = Math.max(1, Math.round(gross * (0.04 + r.next() * 0.1)));
    lines[0] = { ...lines[0], amount: lines[0].amount - diff };
    const lt = lines.reduce((s, x) => s + x.amount, 0); const vat = Math.round((gross * vatRate) / (1 + vatRate));
    amountCheck = { status: 'conflict', basis: 'ex_vat', headerAmount: gross, lineTotal: lt, vatDeclared: vat, impliedTotalWithVat: lt + vat, difference: gross - lt, differenceVsLineTotal: gross - lt, differenceVsWithVat: gross - lt - vat };
  }
  const payments = [];
  for (let p = st.payStart[i]; p < st.payStart[i] + st.payCount[i]; p += 1) payments.push({ date: isoOf(st.pDay[p]), amount: st.pAmt[p], channel: CHANNELS[st.pCh[p]] });
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const cancelled = st.cancelDay[i] ? { date: isoOf(st.cancelDay[i]), source: 'تحصيل' } : null;
  const ct = st.contract[i] >= 0 ? st.contracts[st.contract[i]] : null;
  const req = st.exec[i] >= 0 ? st.requests[st.exec[i]] : null;
  const ctReq = ct ? st.requests.find((q) => q.contractIdx === ct.idx) : null;
  // exclusion records
  const exclusions = [];
  for (let b = 0; b < RULE_IDS.length; b += 1) {
    const bit = 1 << b; if (!(st.exMask[i] & bit)) continue;
    const ruleId = RULE_IDS[b]; const tpl = TEMPLATES[ruleId];
    let status = st.exAppr[i] & bit ? 'approved' : 'pending';
    if (c.ov.get(i)) { const o = c.ov.get(i); if (o.set & bit) status = 'approved'; else if (o.rej & bit) status = 'rejected'; else if (o.clr & bit) status = 'pending'; }
    const crRaw = ruleId === 'CR-1' ? CR_STATUS[st.crSt[i]] : null;
    const sources = ruleId === 'CR-1' ? [{ system: 'CR View', field: 'Crstatus', value: crRaw }, { system: 'سند', field: 'CrNo (استخراج)', value: ctReq?.method === 1 ? 'OCR' : 'منظم' }] : tpl.sources;
    exclusions.push({
      category: RULE_BY_ID[ruleId].category, ruleId, ruleVersion: 1, evidence: ruleId === 'CR-1' ? { en: `CR status "${crRaw}" (raw) linked through Sanad document extraction.`, ar: `حالة السجل التجاري "${crRaw}" (خام) المرتبطة عبر استخراج مستندات سند.` } : tpl.evidence,
      sources, rawValue: crRaw, reviewStatus: status, reviewer: status === 'approved' ? REVIEWER : null, reviewDate: status === 'approved' ? isoOf(st.issue[i] + st.exRev[i]) : null,
      effectiveFrom: status === 'approved' ? isoOf(st.issue[i] + st.exRev[i]) : issueDate, effectiveTo: null, reassessment: status === 'approved' ? 'scheduled_annual' : 'not_started'
    });
  }
  const tahseel = cancelled ? 'ملغاة' : paid >= gross ? 'محصلة' : paid > 0 ? 'مسددة جزئياً' : 'غير محصلة';
  const rec = {
    id, idKey, index: i,
    entity: payer.ar, entityEn: payer.en, entityAr: payer.ar,
    amanah: ent.zh, amanahEn: ent.en, amanahAr: ent.ar,
    municipalityEn: muni?.en || null, municipalityAr: muni?.ar || null, municipalityKey: muni?.key || null,
    beneficiaryId: flags & F.MISSING_ID ? null : beneficiaryIdOf(st.payer[i]),
    co: ct && st.cstat[i] === 1 ? ct.contractNo : null,
    sourcePlatform: src.platform, scopeType: st.scope[i] === 1 ? 'internal' : 'central', revenueSource: src.key,
    revenueItem: { key: item.key, ar: item.ar, en: item.en },
    issueDate, dueDate, grossAmount: gross, vatAmount: Math.round((gross * vatRate) / (1 + vatRate)), vatKnown: true, currency: 'SAR',
    lineItems: lines, payments, adjustments: [], adjustmentTotal: 0,
    sourceStatus: cancelled ? 'cancelled' : paid >= gross ? 'collected' : 'uncollected', statusRawTahseel: tahseel, statusRawEfaa: EFAA_STATUS[st.efaa[i]] || null,
    workflowStatus: 'normal',
    objection: flags & F.OBJECTION ? { open: true, ref: `OBJ-${String(idKey % 1e7).padStart(7, '0')}`, system: 'momtathil' } : null,
    enforcementLinks: [], contract: { required: src.key === 'investment', status: CSTAT[st.cstat[i]], ref: ct && st.cstat[i] === 1 ? ct.contractNo : null },
    contractPaymentNo: st.inst[i] || null, contractPaymentTotal: ct ? ct.dues.length : null,
    exclusion: exclusions[0] || null, exclusions, cancelled,
    violationNumber: src.key === 'fines' ? violationOf(idKey) : null, subscriptionNo: subscriptionOf(idKey), sadadNo: sadadOf(idKey),
    crNo: ct && st.crSt[i] ? ct.crNo : null, crStatusRaw: CR_STATUS[st.crSt[i]] || null,
    crEvidence: ctReq && st.crSt[i] ? { method: ctReq.method === 1 ? 'ocr' : 'structured', source: `سند ${ctReq.enforceNum} — بند ١`, confidence: ctReq.confidence } : null,
    executionNo: req ? req.enforceNum : null, contractRequestNo: ctReq ? ctReq.enforceNum : null,
    missingFields: flags & F.MISSING_ID ? ['debtor_id_number'] : [], amountCheck, aiRisk: { score: 0, tag: 'normal' },
    amanahLinkage: ALINK[st.alink[i]], exceptional: !!(flags & F.EXCEPTIONAL),
    provenance: { kind: 'demo', system: 'demo-world', ref: id }
  };
  return rec;
}
const structuredCloneSafe = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

// full detail payload for the invoice drawer: record + derived figures at the cutoff
export function detail(st, i, ctx) {
  const rec = materialize(st, i, ctx);
  const D = derive(ctx, i, ctx.cutoffN);
  const derived = { gross: D.gross, adjustments: D.adj, billedAfterAdj: D.billed, exclusionsTotal: D.exclTotal, received: D.received, collected: D.collected, overpayment: D.overpayment, outstanding: D.outstanding, payStatus: D.payStatus, sourceCancelled: D.sourceCancelled, enfConflict: D.enfConflict, cancelled: D.cancelled, cancelledAmount: D.cancelledAmount, overlapsCancelled: D.overlaps, excluded: D.excluded, exclusionAmount: D.exclusionAmount, net: D.net, daysOverdue: D.daysOverdue, reasonMask: D.mask, nReasons: D.nReasons, primaryRuleId: D.primaryBit ? RULE_IDS[Math.log2(D.primaryBit)] : null };
  const sourceRec = i < st.nGen ? sourceRecord(st, i, rec, D, ctx.cfg.cutoff) : null;
  const riskFlags = recordRiskFlags(st, ctx, i); // { duplicate | struck_off_registry | deceased_person: 'open' | 'settled' } — the same rule as the Risks & Deviations page
  return { rec, derived, cls: CLASSES[D.cls], idStr: idOf(st, i), sourceRecord: sourceRec, riskFlags };
}
void RULE_BIT;
