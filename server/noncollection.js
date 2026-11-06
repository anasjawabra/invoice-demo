// «تحليل أسباب عدم التحصيل» — the data service of the non-collection analysis (docs/noncollection-analysis.md).
// ONE pass over the scoped period cohort. Dimensions are kept apart (payment position · due position · exclusion · process · data quality · documented reason);
// nothing is inferred from age, no reason is invented, no recoverability is assessed. The same per-invoice classification (ncClassify) drives the analysis,
// the list filter `filters.nc` and the `nc` object of a list row, so a bucket, a group or a reason opens EXACTLY the invoices it counts.
import { ENTITIES, SOURCES, F, isoOf } from '../src/data/catalog.js';
import { slotOf, municipalityOfCode, MUNICIPALITY_OPTION_NONE, MUNICIPALITY_DIRECT, MUNICIPALITY_UNRESOLVED } from '../src/data/municipalityModel.js';
import { REVENUE_SOURCES } from '../src/data/revenueLedger.js';
import { OBJECTION_STATUSES, OBJECTION_STATUS_OF } from '../src/data/iim.js';
import { makeCtx, resolveScope, derive, inScope, agingBucket, objectionStatusKey, snapshot, bridge } from './engine.js';

const EPS = 0.5; // SAR (float accumulation)

/* ------------------------------------------------------------------ catalogues */
export const AGE_KEYS = ['not_due', '1-30', '31-90', '91-180', '180+', 'unavailable'];
const AGE_ALIAS = { 0: 'not_due', '0': 'not_due' };
const AGE_LABEL = [
  { ar: 'لم يحن استحقاقه', en: 'Not yet due' }, { ar: '1–30 يوماً', en: '1–30 days' }, { ar: '31–90 يوماً', en: '31–90 days' },
  { ar: '91–180 يوماً', en: '91–180 days' }, { ar: 'أكثر من 180 يوماً', en: 'Over 180 days' }, { ar: 'تاريخ الاستحقاق غير متاح', en: 'Due date unavailable' }
];
const DOCUMENTED_AR = 'اعتراض مسجَّل في المصدر'; const DOCUMENTED_EN = 'Objection recorded in the source';

/* The action groups (doc §3). Precedence = order of this list: each unpaid invoice lands in exactly ONE primary group; the others are tags. */
export const GROUPS = [
  { key: 'review_amount_conflict',
    titleAr: 'مراجعة تعارض المبلغ أو حالة المصدر', titleEn: 'Review a conflicting amount or an unresolved source status',
    evidence: { status: 'calculated', textAr: 'الفرق بين مبلغ رأس الفاتورة وبنودها محسوب، ولم يُعتمد من المصدر', textEn: 'The gap between the header amount and the line items is calculated, not confirmed by the source' },
    missingAr: 'المبلغ أو الحالة المعتمدة من سجل المصدر', missingEn: 'The amount or status confirmed by the source record',
    nextStepAr: 'مطابقة المبلغ والحالة مع سجل المصدر وطلب التصحيح من مالك البيانات', nextStepEn: 'Match the amount and status with the source record and ask the data owner to correct it',
    rationaleAr: 'لا يصحّ البناء على مبلغ أو حالة متعارضة قبل حسمها', rationaleEn: 'A conflicting amount or status must be settled before anything is built on it' },
  { key: 'request_missing_info',
    titleAr: 'طلب بيانات المدين أو الفاتورة الناقصة', titleEn: 'Request the missing payer or invoice information',
    evidence: { status: 'missing', textAr: 'حقل أساسي غير متوفر في السجل (معرّف المدين أو تاريخ الاستحقاق)', textEn: 'A key field is absent from the record (payer identifier or due date)' },
    missingAr: 'معرّف المدين أو تاريخ الاستحقاق', missingEn: 'Payer identifier or due date',
    nextStepAr: 'طلب الحقول الناقصة من الجهة المصدِّرة للفاتورة', nextStepEn: 'Request the missing fields from the issuing body',
    rationaleAr: 'دون هذه البيانات لا يمكن تحديد موقف الاستحقاق أو الإحالة', rationaleEn: 'Without these fields the due position and any referral cannot be established' },
  { key: 'verify_proposed_link',
    titleAr: 'التحقق من ربط إنفاذ مقترح', titleEn: 'Verify a proposed enforcement link',
    evidence: { status: 'unverified', textAr: 'الربط بأمر إنفاذ مقترح ولم يؤكده مراجع', textEn: 'The link to an enforcement order is proposed and not confirmed by a reviewer' },
    missingAr: 'تأكيد مراجع للربط بأمر الإنفاذ', missingEn: 'A reviewer’s confirmation of the link to the order',
    nextStepAr: 'مراجعة المطابقة وتأكيد الربط أو رفضه', nextStepEn: 'Review the match and confirm or reject the link',
    rationaleAr: 'الربط المقترح لا يغيّر حالة الفاتورة ولا يدل على سداد', rationaleEn: 'A proposed link changes nothing about the invoice and implies no payment' },
  { key: 'review_contract',
    titleAr: 'مراجعة فاتورة استثمار مقابل عقدها في فرص', titleEn: 'Review an investment invoice against its Furas contract',
    evidence: { status: 'calculated', textAr: 'حالة العقد (غير مطابق أو غير مربوط) محسوبة من مطابقة الفاتورة مع سجل العقود', textEn: 'The contract status (unmatched or unlinked) is calculated from matching the invoice with the contract register' },
    missingAr: 'عقد مطابق ومربوط بالفاتورة', missingEn: 'A contract matched and linked to the invoice',
    nextStepAr: 'مراجعة الفاتورة مع إدارة العقود الاستثمارية لربطها بعقدها', nextStepEn: 'Review the invoice with investment contracts to link it to its contract',
    rationaleAr: 'فاتورة استثمار مركزية لا يعرفها سجل العقود', rationaleEn: 'A centrally billed investment invoice that the contract register does not know' },
  { key: 'review_objection',
    titleAr: 'مراجعة حالة الاعتراض المسجَّل', titleEn: 'Review the recorded objection status',
    evidence: { status: 'source_record', textAr: 'اعتراض مسجَّل في ممتثل بحالته', textEn: 'An objection is recorded in Mumtathil with its status' },
    missingAr: 'قرار نهائي على الاعتراض', missingEn: 'A final decision on the objection',
    nextStepAr: 'متابعة حالة الاعتراض مع الجهة المختصة', nextStepEn: 'Follow up the objection status with the responsible body',
    rationaleAr: 'السبب الوحيد الموثَّق في المصدر هو الاعتراض', rationaleEn: 'The objection is the only reason the source documents' },
  { key: 'monitor_enforcement',
    titleAr: 'أمر إنفاذ مؤكَّد — متابعة دون إحالة جديدة', titleEn: 'Confirmed enforcement order — monitor, no new referral',
    evidence: { status: 'source_record', textAr: 'أمر إنفاذ مؤكَّد مرتبط بالفاتورة', textEn: 'A confirmed enforcement order is linked to the invoice' },
    missingAr: 'نتيجة الأمر (سداد أو حفظ)', missingEn: 'The outcome of the order (payment or closure)',
    nextStepAr: 'متابعة الأمر القائم دون إحالة جديدة', nextStepEn: 'Monitor the existing order without a new referral',
    rationaleAr: 'الفاتورة محالة فعلاً؛ الأمر لا يعني حدوث سداد', rationaleEn: 'The invoice is already referred; an order does not mean any payment' },
  { key: 'follow_up_overdue',
    titleAr: 'متابعة فاتورة متأخرة بيانات مكتملة', titleEn: 'Follow up an overdue invoice with complete data',
    evidence: { status: 'calculated', textAr: 'أيام التأخر محسوبة من تاريخ الاستحقاق وتاريخ المرجع', textEn: 'Days overdue are calculated from the due date and the reference date' },
    missingAr: 'سبب عدم التحصيل غير موثق في المصدر', missingEn: 'The reason for non-collection is not documented in the source',
    nextStepAr: 'مراجعة الفاتورة مع الأمانة لتوثيق سبب عدم السداد قبل أي إجراء', nextStepEn: 'Review the invoice with the Amanah to document why it is unpaid before any action',
    rationaleAr: 'بيانات مكتملة ولا يوجد أمر إنفاذ ولا اعتراض', rationaleEn: 'Data is complete and there is no enforcement order or objection' },
  { key: 'not_yet_due',
    titleAr: 'لم يحن استحقاقها — لا إجراء', titleEn: 'Not yet due — no action',
    evidence: { status: 'calculated', textAr: 'تاريخ الاستحقاق لاحق لتاريخ المرجع', textEn: 'The due date is after the reference date' },
    missingAr: 'لا شيء مطلوب', missingEn: 'Nothing required',
    nextStepAr: 'لا إجراء حالياً', nextStepEn: 'No action at present',
    rationaleAr: 'الفاتورة لم يحل موعد سدادها بعد', rationaleEn: 'The invoice is not yet due for payment' }
];
const G_INDEX = Object.fromEntries(GROUPS.map((g, k) => [g.key, k]));
const QUALITY = [
  { key: 'missing_fields', labelAr: 'معرّف المدين ناقص', labelEn: 'Payer identifier missing' },
  { key: 'amount_conflict', labelAr: 'تعارض في المبلغ', labelEn: 'Amount conflict' },
  { key: 'link_unresolved', labelAr: 'حالة أو ربط غير محسوم', labelEn: 'Status or link unresolved' },
  { key: 'contract_unmatched', labelAr: 'فاتورة استثمار غير مطابقة لعقد في فرص', labelEn: 'Investment invoice not matched to a Furas contract' },
  { key: 'due_unavailable', labelAr: 'تاريخ الاستحقاق غير متاح', labelEn: 'Due date unavailable' }
];
const PROCESS = [
  { key: 'confirmed', labelAr: 'أمر إنفاذ مؤكَّد', labelEn: 'Confirmed enforcement order' },
  { key: 'proposed', labelAr: 'ربط إنفاذ مقترح (غير مؤكَّد)', labelEn: 'Proposed enforcement link (unverified)' },
  { key: 'objection', labelAr: 'اعتراض مسجَّل', labelEn: 'Objection recorded' },
  { key: 'none', labelAr: 'لا إجراء مسجَّل', labelEn: 'No process recorded' }
];
const CONFIRMED_SUB = [
  { key: 'confirmed_open', labelAr: 'قيد التنفيذ', labelEn: 'In execution' }, { key: 'confirmed_suspended', labelAr: 'معلَّق', labelEn: 'Suspended' }, { key: 'confirmed_closed', labelAr: 'مغلق', labelEn: 'Closed' }
];

/* ------------------------------------------------------------------ per-invoice classification (shared by the analysis, the list filter and the row output) */
export const newNc = () => ({ rem: 0, cancelled: false, excluded: false, payment: 'unpaid', dueMissing: false, overdue: false, due: 'not_due', age: 0, days: 0, objection: false, objKey: null, link: 0, conf: false, confState: null, proposed: false, qMissing: false, qConflict: false, qLink: false, qContract: false, nIssues: 0, tags: 0, group: -1 });
/** D = the derived invoice (derive()). The result lives in `o` (reused: no allocation per invoice). `net` = the invoice is in the net-unpaid population (owing, not excluded, not cancelled). */
export function ncClassify(st, i, D, o) {
  const f = st.flags[i]; const cs = st.cstat[i];
  const rem = D.cancelled ? 0 : Math.max(0, D.billed - D.received);
  o.rem = rem; o.cancelled = D.cancelled; o.excluded = D.excluded && D.exclusionAmount > 0;
  o.payment = D.cancelled ? 'cancelled' : rem <= 0 ? 'paid' : D.received > 0 ? 'partial' : 'unpaid';
  // due position: a missing due date is never read as «overdue» (the engine would compute a huge lateness from day 0)
  o.dueMissing = !(st.due[i] > 0);
  o.overdue = !o.dueMissing && D.daysOverdue > 0;
  o.due = o.dueMissing ? 'unknown' : o.overdue ? 'overdue' : 'not_due';
  o.age = o.dueMissing ? 5 : agingBucket(D.daysOverdue); o.days = o.overdue ? D.daysOverdue : 0;
  o.objection = (f & F.OBJECTION) !== 0; o.objKey = o.objection ? objectionStatusKey(st, i) : null;
  o.link = D.link; o.conf = D.link >= 2 && D.link <= 4; o.confState = D.link === 2 ? 'open' : D.link === 3 ? 'suspended' : D.link === 4 ? 'closed' : null; o.proposed = D.link === 1;
  o.qMissing = (f & F.MISSING_ID) !== 0; o.qConflict = (f & F.AMT_CONFLICT) !== 0; o.qLink = (f & F.LEGACY_CANCELLED) !== 0;
  o.qContract = st.src[i] === 0 && (cs === 2 || cs === 4);
  o.nIssues = (o.qMissing ? 1 : 0) + (o.qConflict ? 1 : 0) + (o.qLink ? 1 : 0) + (o.qContract ? 1 : 0) + (o.dueMissing ? 1 : 0);
  // action groups: bits 0..5 are independent conditions; follow-up / not-yet-due apply only when none of them does
  let t = 0;
  if (o.qConflict || o.qLink) t |= 1; if (o.qMissing || o.dueMissing) t |= 2; if (o.proposed) t |= 4; if (o.qContract) t |= 8; if (o.objection) t |= 16; if (o.conf) t |= 32;
  if (!(t & 63)) t |= o.overdue ? 64 : 128;
  o.tags = t;
  o.group = D.outstanding > 0 ? Math.round(Math.log2(t & -t)) : -1; // primary = the first (highest precedence) applicable group
  return o;
}
const tagKeys = (tags) => GROUPS.filter((_, k) => tags & (1 << k)).map((g) => g.key);
const reasonKeyOf = (o) => (o.objection ? `objection:${o.objKey}` : 'undocumented');

/** the reference date at which the cohort is measured (identical to the snapshot: the cutoff, or the period end when the configuration says so) */
export const ncAsOf = (ctx, sc) => (ctx.periodEndMode ? Math.min(sc.toN, ctx.cutoffN) : ctx.cutoffN);

/** `filters.nc` — true when the (already derived) invoice belongs to the requested slice. Default population = net unpaid; nc.population: 'unpaidGross' | 'excluded'. */
export function ncMatches(st, i, D, nc, o) {
  ncClassify(st, i, D, o);
  const pop = nc.population || 'net';
  if (pop === 'net') { if (!(D.outstanding > 0)) return false; }
  else if (pop === 'excluded') { if (!o.excluded) return false; }
  else if (pop === 'unpaidGross') { if (!(D.outstanding > 0 || o.excluded)) return false; }
  else return false;
  if (nc.group && nc.group !== 'all') { if (G_INDEX[nc.group] == null || o.group !== G_INDEX[nc.group]) return false; }
  if (nc.tag && nc.tag !== 'all') { if (G_INDEX[nc.tag] == null || !(o.tags & (1 << G_INDEX[nc.tag]))) return false; }
  if (nc.due && nc.due !== 'all' && o.due !== nc.due) return false;
  if (nc.reason && nc.reason !== 'all') {
    const r = nc.reason;
    if (r === 'documented' || r === 'objection') { if (!o.objection) return false; }
    else if (r === 'undocumented') { if (o.objection) return false; }
    else if (r.startsWith('objection:')) { if (!o.objection || o.objKey !== r.slice(10)) return false; }
    else return false;
  }
  if (nc.payment && nc.payment !== 'all' && o.payment !== nc.payment) return false;
  if (nc.process && nc.process !== 'all') {
    const p = nc.process; const none = !o.conf && !o.proposed && !o.objection;
    const ok = p === 'confirmed' ? o.conf : p === 'proposed' ? o.proposed : p === 'objection' ? o.objection : p === 'none' ? none : p.startsWith('confirmed_') ? o.confState === p.slice(10) : false;
    if (!ok) return false;
  }
  if (nc.quality && nc.quality !== 'all') {
    const q = nc.quality;
    const ok = q === 'missing_fields' ? o.qMissing : q === 'amount_conflict' ? o.qConflict : q === 'link_unresolved' ? o.qLink : q === 'contract_unmatched' ? o.qContract : q === 'due_unavailable' ? o.dueMissing : false;
    if (!ok) return false;
  }
  if (nc.age != null && nc.age !== 'all') { const k = AGE_ALIAS[nc.age] || nc.age; if (AGE_KEYS[o.age] !== k) return false; }
  if (nc.source && nc.source !== 'all' && SOURCES[st.src[i]].key !== nc.source) return false;
  return true;
}

/** the `nc` object of a list row (supporting-invoice table) */
export function ncRow(st, ctx, i, D) {
  const o = ncClassify(st, i, D, newNc()); const net = D.outstanding > 0; const g = net ? GROUPS[o.group] : null;
  const process = []; if (o.conf) process.push('confirmed'); if (o.proposed) process.push('proposed'); if (o.objection) process.push('objection'); if (!process.length) process.push('none');
  const quality = []; if (o.qMissing) quality.push('missing_fields'); if (o.qConflict) quality.push('amount_conflict'); if (o.qLink) quality.push('link_unresolved'); if (o.qContract) quality.push('contract_unmatched'); if (o.dueMissing) quality.push('due_unavailable');
  const x = o.objection ? OBJECTION_STATUS_OF[o.objKey] : null;
  return {
    population: net ? 'netUnpaid' : o.excluded ? 'excludedUnpaid' : null,
    payment: o.payment, due: o.due, excluded: o.excluded, age: AGE_KEYS[o.age],
    process, enforcementState: o.confState, objectionStatus: x ? { key: x.key, ar: x.ar, en: x.en } : null, quality,
    reason: net ? { key: reasonKeyOf(o), documented: o.objection, evidenceStatus: o.objection ? 'source_record' : 'none', source: o.objection ? 'Mumtathil' : null, labelAr: o.objection ? `${DOCUMENTED_AR}: ${x.ar}` : 'سبب عدم التحصيل غير موثق', labelEn: o.objection ? `${DOCUMENTED_EN}: ${x.en}` : 'Non-collection reason not documented' } : null,
    group: g ? g.key : null, tags: net ? tagKeys(o.tags) : [], nextStepAr: g ? g.nextStepAr : null, nextStepEn: g ? g.nextStepEn : null
  };
}

/* ------------------------------------------------------------------ the analysis */
const z = () => ({ count: 0, amount: 0 });
const bump = (b, a) => { b.count += 1; b.amount += a; };
const chk = (key, lhs, rhs, labelAr, labelEn, tol = EPS) => ({ key, ok: Math.abs(lhs - rhs) <= tol, lhs, rhs, labelAr, labelEn });
const newGroupAcc = () => ({ unpaid: 0, overdue: 0, notYetDue: 0, dueUnknown: 0, undocumented: 0, documented: 0, count: 0 });
const addGroupAcc = (a, o, amt) => { a.count += 1; a.unpaid += amt; if (o.due === 'overdue') a.overdue += amt; else if (o.due === 'not_due') a.notYetDue += amt; else a.dueUnknown += amt; if (o.objection) a.documented += amt; else a.undocumented += amt; };

export function nonCollectionAnalysis(st, req) {
  const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope);
  const NE = ENTITIES.length; const NS = SOURCES.length; const D = ctx.D; const o = newNc();
  const asOf = ncAsOf(ctx, sc);
  const pop = { issued: { count: 0, gross: 0 }, unpaidGross: z(), excludedUnpaid: z(), netUnpaid: z(), fullyUnpaid: z(), partlyPaid: { count: 0, amount: 0, collected: 0 }, overdue: z(), notYetDue: z(), dueUnknown: z(), undocumented: z(), documented: z() };
  const reasonAcc = new Map(); const undoc = z();
  const proc = { confirmed: z(), proposed: z(), objection: z(), none: z(), confirmed_open: z(), confirmed_suspended: z(), confirmed_closed: z() };
  const qual = { missing_fields: z(), amount_conflict: z(), link_unresolved: z(), contract_unmatched: z(), due_unavailable: z() };
  const aging = AGE_KEYS.map(() => z());
  const ent = Array.from({ length: NE }, newGroupAcc); const src = Array.from({ length: NS }, newGroupAcc); const muni = new Map();
  const heat = new Float64Array(NE * 6); const heatN = new Float64Array(NE * 6);
  const gAcc = GROUPS.map(() => ({ count: 0, amount: 0, maxDays: 0, issues: 0, process: { confirmed: 0, proposed: 0, objection: 0, none: 0 }, tagged: z() }));
  let standingDueUnknown = 0;
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > ctx.cutoffN || !inScope(st, sc, i)) continue;
    // standing balance: a due date that is missing is carved out of the engine's «overdue» part (the engine reads day 0 as a due date)
    if (!(st.due[i] > 0)) { derive(ctx, i, ctx.cutoffN); if ((!sc.statusSet || sc.statusSet[D.cls]) && D.outstanding > 0) standingDueUnknown += D.outstanding; }
    if (st.issue[i] < sc.fromN || st.issue[i] > sc.toN) continue;
    derive(ctx, i, asOf);
    if (sc.statusSet && !sc.statusSet[D.cls]) continue;
    pop.issued.count += 1; pop.issued.gross += D.gross;
    ncClassify(st, i, D, o);
    if (o.excluded) { bump(pop.excludedUnpaid, D.exclusionAmount); bump(pop.unpaidGross, D.exclusionAmount); }
    if (!(D.outstanding > 0)) continue;
    const a = D.outstanding; const e = st.ent[i]; const s = st.src[i];
    bump(pop.netUnpaid, a); bump(pop.unpaidGross, a);
    if (o.payment === 'partial') { bump(pop.partlyPaid, a); pop.partlyPaid.collected += D.collected; } else bump(pop.fullyUnpaid, a);
    if (o.due === 'overdue') bump(pop.overdue, a); else if (o.due === 'not_due') bump(pop.notYetDue, a); else bump(pop.dueUnknown, a);
    if (o.objection) { bump(pop.documented, a); const k = `objection:${o.objKey}`; let r = reasonAcc.get(k); if (!r) { r = z(); reasonAcc.set(k, r); } bump(r, a); } else { bump(pop.undocumented, a); bump(undoc, a); }
    // overlapping (NON-additive) views
    if (o.conf) { bump(proc.confirmed, a); bump(proc[`confirmed_${o.confState}`], a); } if (o.proposed) bump(proc.proposed, a); if (o.objection) bump(proc.objection, a); if (!o.conf && !o.proposed && !o.objection) bump(proc.none, a);
    if (o.qMissing) bump(qual.missing_fields, a); if (o.qConflict) bump(qual.amount_conflict, a); if (o.qLink) bump(qual.link_unresolved, a); if (o.qContract) bump(qual.contract_unmatched, a); if (o.dueMissing) bump(qual.due_unavailable, a);
    bump(aging[o.age], a);
    addGroupAcc(ent[e], o, a); addGroupAcc(src[s], o, a);
    { // municipality groups (same as the dashboard): a reference municipality, or one explicit group — not specified in source / issued directly by the Amanah / needs review
      const slot = slotOf(e, st.mref[i]); const en = ENTITIES[e].en; const m0 = slot >= 4 ? municipalityOfCode(e, slot) : null;
      const key = m0 ? m0.key : `${en}|${slot === 1 ? 'DIRECT' : slot === 2 ? 'UNRESOLVED' : 'NOT_SPECIFIED'}`; let m = muni.get(key);
      if (!m) { const L = slot === 1 ? MUNICIPALITY_DIRECT : slot === 2 ? MUNICIPALITY_UNRESOLVED : MUNICIPALITY_OPTION_NONE; m = { acc: newGroupAcc(), key, amanah: en, labelAr: `${m0 ? m0.ar : L.ar} — ${ENTITIES[e].ar}`, labelEn: `${m0 ? m0.en : L.en} — ${en}`, muniLabelAr: m0 ? m0.ar : L.ar, muniLabelEn: m0 ? m0.en : L.en, status: m0 ? 'mapped' : slot === 1 ? 'direct_amanah' : slot === 2 ? 'needs_review' : 'not_specified' }; muni.set(key, m); }
      addGroupAcc(m.acc, o, a); }
    heat[e * 6 + o.age] += a; heatN[e * 6 + o.age] += 1;
    // action groups: primary allocation (additive) + tags (overlapping)
    const g = gAcc[o.group]; g.count += 1; g.amount += a; if (o.days > g.maxDays) g.maxDays = o.days; g.issues += o.nIssues;
    g.process[o.conf ? 'confirmed' : o.proposed ? 'proposed' : o.objection ? 'objection' : 'none'] += 1;
    for (let k = 0; k < GROUPS.length; k += 1) if (o.tags & (1 << k)) bump(gAcc[k].tagged, a);
  }

  // the engine's own figures for the SAME scope (financial calculations are reused, never redone here)
  const snap = snapshot(st, req); const br = bridge(st, req); const stock = snap.stock;
  const standing = { amount: stock.netUncollected, overdue: stock.overdue - standingDueUnknown, notYetDue: stock.notYetDue, dueUnknown: standingDueUnknown, count: stock.invoiceCount,
    bridge: { reportDate: br.reportDate, detailsDate: br.detailsDate, steps: br.steps, net: br.net, check: br.check }, note: 'different population: every invoice issued up to the cutoff, not the period cohort' };

  // reasons (primary allocation; sums to net unpaid)
  const reasons = [];
  for (const x of OBJECTION_STATUSES) { const r = reasonAcc.get(`objection:${x.key}`); if (r) reasons.push({ key: `objection:${x.key}`, labelAr: `${DOCUMENTED_AR}: ${x.ar}`, labelEn: `${DOCUMENTED_EN}: ${x.en}`, count: r.count, amount: r.amount, evidence: 'source_record', factKind: 'source_reported', documented: true, filter: { nc: { reason: `objection:${x.key}` } } }); }
  reasons.push({ key: 'undocumented', labelAr: 'سبب عدم التحصيل غير موثق', labelEn: 'Non-collection reason not documented', count: undoc.count, amount: undoc.amount, evidence: 'none', factKind: 'not_documented', documented: false, filter: { nc: { reason: 'undocumented' } } });
  const processOut = [...PROCESS.map((p) => ({ ...p, ...proc[p.key], nonAdditive: true, filter: { nc: { process: p.key } }, ...(p.key === 'confirmed' ? { sub: CONFIRMED_SUB.map((c) => ({ ...c, ...proc[c.key], nonAdditive: true, filter: { nc: { process: c.key } } })) } : {}) }))];
  const qualityOut = QUALITY.map((q) => ({ ...q, ...qual[q.key], nonAdditive: true, filter: { nc: { quality: q.key } } }));
  const agingOut = AGE_KEYS.map((key, k) => ({ key, labelAr: AGE_LABEL[k].ar, labelEn: AGE_LABEL[k].en, ...aging[k], filter: { nc: { age: key } } }));
  const rankDue = (x, y) => y.overdue - x.overdue || y.unpaid - x.unpaid;
  const byAmanah = ent.map((a, e) => ({ key: ENTITIES[e].en, labelAr: ENTITIES[e].ar, labelEn: ENTITIES[e].en, ...a, scopePatch: { amanah: ENTITIES[e].en } })).filter((x) => x.count > 0).sort(rankDue);
  const byMunicipality = [...muni.values()].map((m) => ({ key: m.key, labelAr: m.labelAr, labelEn: m.labelEn, muniLabelAr: m.muniLabelAr, muniLabelEn: m.muniLabelEn, amanah: m.amanah, status: m.status, ...m.acc, scopePatch: { amanah: m.amanah, muni: m.key } })).sort(rankDue);
  const bySource = src.map((a, s) => ({ key: SOURCES[s].key, labelAr: REVENUE_SOURCES[SOURCES[s].key]?.ar || SOURCES[s].key, labelEn: REVENUE_SOURCES[SOURCES[s].key]?.en || SOURCES[s].key, ...a, filter: { nc: { source: SOURCES[s].key } } })).filter((x) => x.count > 0).sort(rankDue);
  const top = byAmanah.slice().sort((x, y) => y.unpaid - x.unpaid).slice(0, 12);
  const heatOut = { rows: top.map((x) => ({ key: x.key, labelAr: x.labelAr, labelEn: x.labelEn })), cols: AGE_KEYS.slice(), colLabels: AGE_LABEL.map((l) => ({ ar: l.ar, en: l.en })),
    values: top.map((x) => { const e = ENTITIES.findIndex((v) => v.en === x.key); return AGE_KEYS.map((_, c) => (heatN[e * 6 + c] > 0 ? heat[e * 6 + c] : null)); }) };

  const groups = GROUPS.map((g, k) => { const a = gAcc[k];
    return { key: g.key, precedence: k + 1, rank: 0, titleAr: g.titleAr, titleEn: g.titleEn, count: a.count, amount: a.amount, maxOverdueDays: a.maxDays, process: a.process, dataIssues: a.issues,
      evidence: { status: g.evidence.status, textAr: g.evidence.textAr, textEn: g.evidence.textEn }, missingAr: g.missingAr, missingEn: g.missingEn, nextStepAr: g.nextStepAr, nextStepEn: g.nextStepEn, rationaleAr: g.rationaleAr, rationaleEn: g.rationaleEn,
      filter: { nc: { group: g.key } }, nonAdditiveTags: { count: a.tagged.count, amount: a.tagged.amount, filter: { nc: { tag: g.key } } }, suggestedOwner: { ar: 'الأمانة المعنية (مقترح)', en: 'The Amanah concerned (suggested)', suggested: true }, noAction: g.key === 'not_yet_due' }; });
  // ranked by transparent factors shown as columns (amount, longest overdue days); the «no action» group is last. No composite score.
  [...groups].sort((x, y) => (x.noAction - y.noAction) || y.amount - x.amount || y.maxOverdueDays - x.maxOverdueDays).forEach((g, r) => { g.rank = r + 1; });
  groups.sort((x, y) => x.rank - y.rank);

  // reconciliation: every identity with both sides
  const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
  const N = pop.netUnpaid;
  const reconciliation = [
    chk('issued_count', pop.issued.count, snap.totals.count, 'عدد الفواتير الصادرة = عدد اللقطة المالية', 'Issued invoices = the financial snapshot count', 0),
    chk('unpaidGross_eq_excluded_plus_net', pop.unpaidGross.amount, pop.excludedUnpaid.amount + N.amount, 'إجمالي غير المسدد = المستبعد غير المسدد + صافي غير المسدد', 'Gross unpaid = excluded unpaid + net unpaid'),
    chk('unpaidGross_count', pop.unpaidGross.count, pop.excludedUnpaid.count + N.count, 'عدد إجمالي غير المسدد = المستبعد + الصافي', 'Gross-unpaid count = excluded + net', 0),
    chk('net_eq_due_partition', N.amount, pop.overdue.amount + pop.notYetDue.amount + pop.dueUnknown.amount, 'صافي غير المسدد = متأخر + لم يحن + تاريخ غير متاح', 'Net unpaid = overdue + not yet due + due date unavailable'),
    chk('net_eq_payment_partition', N.amount, pop.fullyUnpaid.amount + pop.partlyPaid.amount, 'صافي غير المسدد = غير مسدد كلياً + مسدد جزئياً (المتبقي)', 'Net unpaid = fully unpaid + partly paid (remainder)'),
    chk('net_eq_reason_partition', N.amount, pop.documented.amount + pop.undocumented.amount, 'صافي غير المسدد = موثق السبب + غير موثق', 'Net unpaid = documented + not documented'),
    chk('reasons_sum_eq_net', sum(reasons, (r) => r.amount), N.amount, 'مجموع الأسباب (التوزيع الأساسي) = صافي غير المسدد', 'Reasons (primary allocation) sum to net unpaid'),
    chk('net_eq_snapshot_outstanding', N.amount, snap.totals.outstanding, 'صافي غير المسدد = غير المحصّل في اللقطة المالية لنفس النطاق', 'Net unpaid = uncollected in the financial snapshot of the same scope'),
    chk('excluded_eq_snapshot_exclusions', pop.excludedUnpaid.amount, snap.totals.exclusionsRules, 'المستبعد غير المسدد = استبعادات القواعد في اللقطة المالية', 'Excluded unpaid = rule exclusions in the financial snapshot'),
    chk('amanah_sum_eq_net', sum(byAmanah, (r) => r.unpaid), N.amount, 'مجموع الأمانات = صافي غير المسدد', 'Σ Amanahs = net unpaid'),
    chk('municipality_sum_eq_net', sum(byMunicipality, (r) => r.unpaid), N.amount, 'مجموع البلديات = صافي غير المسدد', 'Σ municipalities = net unpaid'),
    chk('source_sum_eq_net', sum(bySource, (r) => r.unpaid), N.amount, 'مجموع المصادر = صافي غير المسدد', 'Σ revenue sources = net unpaid'),
    chk('aging_sum_eq_net', sum(agingOut, (r) => r.amount), N.amount, 'مجموع فئات التقادم = صافي غير المسدد', 'Σ aging buckets = net unpaid'),
    chk('aging_count_eq_net', sum(agingOut, (r) => r.count), N.count, 'عدد فئات التقادم = عدد الصافي', 'Aging counts = net count', 0),
    chk('groups_sum_eq_net', sum(groups, (g) => g.amount), N.amount, 'مجموع مجموعات الإجراء (التوزيع الأساسي) = صافي غير المسدد', 'Action groups (primary allocation) sum to net unpaid'),
    chk('groups_count_eq_net', sum(groups, (g) => g.count), N.count, 'عدد مجموعات الإجراء = عدد الصافي', 'Action-group counts = net count', 0),
    chk('heat_sum_eq_net', heat.reduce((t, v) => t + v, 0), N.amount, 'مجموع الخريطة الحرارية (كل الأمانات) = صافي غير المسدد', 'Heat map (all Amanahs) = net unpaid'),
    chk('standing_eq_snapshot_stock', standing.amount, stock.netUncollected, 'الرصيد القائم = رصيد اللقطة', 'Standing balance = snapshot stock'),
    chk('standing_parts', standing.amount, standing.overdue + standing.notYetDue + standing.dueUnknown, 'الرصيد القائم = متأخر + لم يحن + تاريخ غير متاح', 'Standing balance = overdue + not yet due + due unavailable'),
    chk('standing_eq_bridge', standing.amount, br.net, 'الرصيد القائم = صافي جسر المطابقة', 'Standing balance = reconciliation-bridge net')
  ];

  const notes = [
    { ar: 'سبب عدم التحصيل موثق فقط حين يسجّله المصدر (الاعتراض وحالته)؛ ما عداه «غير موثق» ولا يُستنتج من التأخر أو السداد الجزئي أو الإنفاذ أو نقص البيانات.', en: 'A reason is documented only where the source records it (an objection and its status); everything else is «not documented» and is never inferred from lateness, part payment, enforcement or missing data.' },
    { ar: 'تواريخ الاستحقاق متوفرة لكل سجل في البيانات التجريبية؛ وأي سجل بلا تاريخ استحقاق يُعدّ منفصلاً ولا يُصنَّف متأخراً.', en: 'A due date is available for every record in the synthetic data; a record without one is counted apart and is never classed as overdue.' },
    { ar: 'السجلات غير المطابقة (تقرير فقط) خارج كل الإجماليات وتُعرض منفصلة.', en: 'Unmatched (report-only) records are outside every total and shown apart.' },
    { ar: 'الرصيد القائم عند تاريخ المرجع مجتمع مختلف عن فواتير الفترة ولا يُجمع معها.', en: 'The standing balance at the reference date is a different population from the period cohort and is never added to it.' },
    { ar: 'العروض (الإجراء، جودة البيانات) متداخلة وغير قابلة للجمع؛ أما الأسباب ومجموعات الإجراء فتوزيع أساسي يجمع إلى الصافي.', en: 'The process and data-quality views overlap and are not additive; reasons and action groups are a primary allocation that sums to the net.' },
    { ar: 'لا يُقيَّم القابل للاسترداد ولا يُقدَّر تحصيل متوقع؛ والربط المقترح أو الأمر المؤكَّد لا يدل على سداد. التعارض في المبلغ يبقى بمبلغ رأس الفاتورة مع وسمه.', en: 'Recoverability is not assessed and no expected recovery is estimated; a proposed link or a confirmed order implies no payment. Conflicting amounts stay at their header amount and are flagged.' },
    { ar: 'المالك والموعد النهائي المقترحان للمجموعات مقترحات فقط؛ لا شيء هنا يبدأ إنفاذاً أو يعتمد استبعاداً أو يغيّر سجلاً في المصدر.', en: 'Suggested owners are suggestions only; nothing here starts enforcement, approves an exclusion or changes a source record.' }
  ];
  const sCl = req.scope || {};
  return {
    version: 1, kind: 'noncollection', generatedAt: new Date().toISOString(), cutoff: ctx.cfg.cutoff, asOf: isoOf(asOf),
    scope: { from: sc.from, to: sc.to, amanah: sCl.amanah ?? 'all', source: sCl.source ?? 'all', scopeType: sCl.scopeType ?? 'all', muni: sCl.muni ?? 'all', status: sCl.status ?? 'all', org: sCl.org || null },
    populations: pop, standingBalance: standing,
    unmatched: { count: br.unmatched.count, amount: br.unmatched.amount, includedInTotals: false, scopedOut: br.unmatched.scopedOut, rows: br.unmatched.rows },
    reconciliation, reasons, process: processOut, quality: qualityOut, aging: agingOut, byAmanah, byMunicipality, bySource, heat: heatOut, groups, notes
  };
}
