// PLANNING ACTION LINES («أين نركز») — the data service of the planning page's ranked action table (docs/planning-review/07-priorities-and-drivers.md, decisions D-10 of 10-open-decisions.md).
//
// ONE scan over the invoices of the request's scope (the stock: every invoice issued up to the cut-off, exactly like snapshot().stock). Every UNCOLLECTED, non-cancelled, non-excluded invoice with a positive remaining
// balance (derive().outstanding > 0: partial payments leave the REMAINING balance, approved exclusions leave nothing) is assigned to EXACTLY ONE line keyed by (entity [· municipality group], revenue source, class):
//
//   A  blocked      a confirmed enforcement link (or a Sanad-feed order), an open objection, an unresolved linkage, an ineligible referral — kept apart with its REASON; no new referral
//   B  overdue ≤ 180 days            actionable now
//   C  not yet due, due by year-end  actionable within the remaining period (pre-due reminder)
//   D  overdue > 180 days            a business / legal DECISION — never an assumed recovery, never counted as collectible this year
//   E  not yet due, due after year-end   (completes the partition: Σ classes = the stock; not actionable this year)
//   U  due date unavailable          its own class — never read as overdue
//
// Precedence A > U > D > B > C > E (one invoice, one class). Ranking is NOT done here (the page ranks by gap contribution, then actionable amount): `rank` only records the stable default order and `rankInputs`
// carries what a ranking needs. No recovery is estimated (`expectedImpact: null`, reason «غير متاح»); the evidence block holds COUNTS and amounts of observed attributes, never a causal claim.
// The same classification function (planClassOf) answers the list filter `filters.planLine` (server/lists.js), so every line's `drill` opens EXACTLY the invoices the line counts.
import { ENTITIES, SOURCES, F, dayNum } from '../src/data/catalog.js';
import { MUNI_SLOTS, slotOf, municipalityOfCode, MUNICIPALITY_NOT_SPECIFIED, MUNICIPALITY_DIRECT, MUNICIPALITY_UNRESOLVED } from '../src/data/municipalityModel.js';
import { REVENUE_SOURCES } from '../src/data/revenueLedger.js';
import { makeCtx, resolveScope, derive, inScope, CLASS_INDEX } from './engine.js';

export const PLAN_AGED_DAYS = 180; // D-10: the line between «actionable now» and «needs a decision»
export const PLAN_CLASSES = ['A', 'B', 'C', 'D', 'E', 'U'];
export const PLAN_BLOCKERS = ['enforcement', 'objection', 'linkage_unresolved', 'ineligible_referral'];
const CI = Object.fromEntries(PLAN_CLASSES.map((c, i) => [c, i]));
const ACTIONABLE = new Set(['B', 'C']);

export const CLASS_INFO = {
  A: { ar: 'عائق قائم — حسم العائق', en: 'Blocked — resolve the blocker', actionable: false, order: 3 },
  B: { ar: 'متأخر ≤ 180 يوماً — قابل للمتابعة الآن', en: 'Overdue ≤ 180 days — actionable now', actionable: true, order: 1 },
  C: { ar: 'يستحق قبل نهاية السنة', en: 'Due by year-end', actionable: true, order: 2 },
  D: { ar: 'رصيد قديم > 180 يوماً — يحتاج قراراً', en: 'Older than 180 days — needs a decision', actionable: false, order: 4 },
  E: { ar: 'يستحق بعد نهاية السنة', en: 'Due after year-end', actionable: false, order: 5 },
  U: { ar: 'تاريخ الاستحقاق غير متاح', en: 'Due date unavailable', actionable: false, order: 6 }
};
export const BLOCKER_INFO = {
  enforcement: { ar: 'مرتبطة بأمر تنفيذ مؤكد', en: 'Linked to a confirmed enforcement order' },
  objection: { ar: 'عليها اعتراض مفتوح', en: 'Open objection' },
  linkage_unresolved: { ar: 'ربط غير محسوم (عقد أو حالة المصدر)', en: 'Unresolved linkage (contract or source status)' },
  ineligible_referral: { ar: 'غير قابلة للإحالة (بيانات المدين ناقصة)', en: 'Not eligible for referral (payer data missing)' }
};
// rule-based dictionary (a key + text per class — not a generated cause). No recovery estimate anywhere.
export const ACTIONS = {
  follow_existing_action: { ar: 'متابعة الإجراء القائم — لا إحالة جديدة', en: 'Follow the existing action — no new referral' },
  resolve_data_blocker: { ar: 'حسم ربط البيانات قبل أي إجراء — لا إحالة جديدة', en: 'Settle the data linkage before any action — no new referral' },
  follow_up_overdue: { ar: 'متابعة تحصيل الفواتير المتأخرة (يوجد مدين وأمر يمكن البدء به)', en: 'Follow up the overdue invoices (a debtor and an order that can be started)' },
  pre_due_reminder: { ar: 'تذكير قبل الاستحقاق', en: 'Reminder before the due date' },
  escalate_for_decision: { ar: 'رفع للقرار', en: 'Escalate for a decision' },
  no_action_this_year: { ar: 'لا إجراء هذا العام (يستحق بعد نهاية السنة)', en: 'No action this year (due after year-end)' },
  complete_due_date: { ar: 'استكمال تاريخ الاستحقاق قبل أي إجراء', en: 'Complete the due date before any action' }
};
export const EXPECTED_IMPACT_REASON = { ar: 'غير متاح', en: 'Not available' };
const UNSPECIFIED = { ar: 'غير محدد', en: 'Unspecified' };

/** the Dec-31 day number of the cut-off year (the remaining period of the planning year) */
export const yearEndOf = (cfg) => dayNum(`${String(cfg.cutoff).slice(0, 4)}-12-31`);

/** the blocker of a derived invoice, or null. Precedence: a confirmed order → an open objection → an unresolved linkage → an ineligible referral. */
export function blockerOf(st, i, D) {
  if (st.exec[i] >= 0 || (D.link >= 2 && D.link <= 4)) return 'enforcement'; // the same «referred» test as derive(): the Sanad feed, or a confirmed link (a withdrawn link is no referral)
  if (D.cls === CLASS_INDEX.objection) return 'objection';
  if (D.cls === CLASS_INDEX.linkage_unresolved) return 'linkage_unresolved';
  if (D.cls === CLASS_INDEX.ineligible_referral) return 'ineligible_referral';
  return null;
}
/** the plan class of a derived invoice (D = derive(ctx, i, cutoffN)), or null when nothing is owed (collected · excluded · cancelled have outstanding 0) */
export function planClassOf(st, i, D, yearEndN) {
  if (!(D.outstanding > 0)) return null;
  if (blockerOf(st, i, D)) return 'A';
  if (!(st.due[i] > 0)) return 'U'; // a missing due date is never overdue
  if (D.daysOverdue > PLAN_AGED_DAYS) return 'D';
  if (D.daysOverdue > 0) return 'B';
  return st.due[i] <= yearEndN ? 'C' : 'E';
}
/** `filters.planLine` of the invoice list: { cls: 'B' | ['B','C'], blocker?: 'objection' } — true when the derived invoice belongs to the requested line(s) */
export function planLineMatches(st, ctx, i, D, spec) {
  const c = planClassOf(st, i, D, yearEndOf(ctx.cfg)); if (!c) return false;
  const want = [].concat(spec?.cls ?? []); if (want.length && !want.includes(c)) return false;
  if (spec?.blocker && blockerOf(st, i, D) !== spec.blocker) return false;
  return true;
}

const z = () => ({ count: 0, amount: 0 });
const newAcc = () => ({ count: 0, remaining: 0, dueByYearEnd: 0, overdue: z(), notYetDue: z(), dueUnavailable: z(), partial: z(), aged180: z(), enforcementLinked: z(), objected: z(), objectionRecorded: z(), unresolvedLinkage: z(), ineligibleReferral: z(), proposedLink: z(), oldest: 0, blockers: { enforcement: z(), objection: z(), linkage_unresolved: z(), ineligible_referral: z() } });
const bump = (b, a) => { b.count += 1; b.amount += a; };
const fin = (n) => (Number.isFinite(n) ? n : 0);
const sourceInfo = (s) => { const k = SOURCES[s]?.key; const l = k && REVENUE_SOURCES[k]; return k ? { key: k, ar: l?.ar || k, en: l?.en || k } : { key: 'unspecified', ar: UNSPECIFIED.ar, en: UNSPECIFIED.en }; };

/** the municipality group of an invoice (same grouping as the dashboard / non-collection analysis): a reference municipality, or ONE explicit group — issued directly · not specified in source · needs review */
function muniGroup(e, code) {
  const slot = slotOf(e, code); const en = ENTITIES[e].en;
  if (slot >= 4) { const m = municipalityOfCode(e, slot); return { key: m.key, ar: m.ar, en: m.en, status: 'mapped' }; }
  if (slot === 1) return { key: `${en}|DIRECT`, ar: MUNICIPALITY_DIRECT.ar, en: MUNICIPALITY_DIRECT.en, status: 'direct_amanah' };
  if (slot === 2) return { key: `${en}|UNRESOLVED`, ar: MUNICIPALITY_UNRESOLVED.ar, en: MUNICIPALITY_UNRESOLVED.en, status: 'needs_review' };
  return { key: `${en}|NOT_SPECIFIED`, ar: MUNICIPALITY_NOT_SPECIFIED.ar, en: MUNICIPALITY_NOT_SPECIFIED.en, status: 'not_specified' };
}

const DRILL_DROP = new Set(['org', 'orgKeys', 'amanah', 'source', 'muni', 'from', 'to']);
function drillOf(base, cutoff, entityKey, sourceKey, muniKey, planLine) {
  const scope = { ...base, from: '2000-01-01', to: cutoff, amanah: entityKey, source: sourceKey ?? 'all', ...(muniKey ? { muni: muniKey } : {}) };
  return { route: '/collection', scope, filters: { state: 'open', allPeriods: true, planLine } };
}

function actionOf(cls, acc) {
  if (cls === 'A') { const top = PLAN_BLOCKERS.reduce((b, k) => (acc.blockers[k].amount > acc.blockers[b].amount ? k : b), PLAN_BLOCKERS[0]); const key = top === 'enforcement' || top === 'objection' ? 'follow_existing_action' : 'resolve_data_blocker'; return { key, ...ACTIONS[key] }; }
  const key = { B: 'follow_up_overdue', C: 'pre_due_reminder', D: 'escalate_for_decision', E: 'no_action_this_year', U: 'complete_due_date' }[cls];
  return { key, ...ACTIONS[key] };
}

/**
 * actionLines(st, req) → the planning action lines of the request's scope (access mask, organisation narrowing, cut-off and review overlay honoured exactly like snapshot()).
 *   req: { scope, cfg, access, owner, decisions, links, linkInfo, fileExclusions, entityGaps?: { [Amanah key]: gap SAR (planned − collected; positive = behind) }, groupBy?: 'entity' | 'municipality' }
 *   a municipal scope (scope.muni set) or groupBy 'municipality' splits each entity into its municipality groups (reference municipalities + the explicit «issued directly» / «not specified» / «needs review» groups).
 */
export function actionLines(st, req = {}) {
  const ctx = makeCtx(st, req); const sc = resolveScope(ctx, req.scope);
  const cutoffN = ctx.cutoffN; const yearEndN = yearEndOf(ctx.cfg); const cutoff = ctx.cfg.cutoff;
  const byMuni = req.groupBy === 'municipality' || (req.scope && req.scope.muni != null && req.scope.muni !== 'all' && req.scope.muni !== '');
  const NS = SOURCES.length; const NSLOT = byMuni ? MUNI_SLOTS : 1; const NC = PLAN_CLASSES.length;
  const D = ctx.D; const lines = new Map();
  const sep = { excluded: z(), cancelled: z() };
  for (let i = 0; i < st.n; i += 1) {
    if (st.issue[i] > cutoffN || !inScope(st, sc, i)) continue;
    derive(ctx, i, cutoffN);
    if (sc.statusSet && !sc.statusSet[D.cls]) continue; // the scope's invoice-status filter, as for the stock
    if (D.cancelled) { bump(sep.cancelled, D.cancelledAmount); continue; }
    if (D.excluded) { if (D.exclusionAmount > 0) bump(sep.excluded, D.exclusionAmount); continue; }
    const cls = planClassOf(st, i, D, yearEndN); if (!cls) continue;
    const e = st.ent[i]; const s = st.src[i]; const slot = byMuni ? slotOf(e, st.mref[i]) : 0;
    const key = ((e * NSLOT + slot) * NS + s) * NC + CI[cls];
    let a = lines.get(key); if (!a) { a = newAcc(); a.e = e; a.s = s; a.slot = slot; a.code = st.mref[i]; a.cls = cls; lines.set(key, a); }
    const amt = D.outstanding; const f = st.flags[i];
    a.count += 1; a.remaining += amt;
    const dueKnown = st.due[i] > 0;
    if (dueKnown && st.due[i] <= yearEndN) a.dueByYearEnd += amt;
    if (!dueKnown) bump(a.dueUnavailable, amt); else if (D.daysOverdue > 0) { bump(a.overdue, amt); if (D.daysOverdue > a.oldest) a.oldest = D.daysOverdue; if (D.daysOverdue > PLAN_AGED_DAYS) bump(a.aged180, amt); } else bump(a.notYetDue, amt);
    if (D.received > 0) bump(a.partial, amt);
    if (f & F.OBJECTION) bump(a.objectionRecorded, amt);
    if (D.link === 1) bump(a.proposedLink, amt);
    const bl = blockerOf(st, i, D);
    if (bl) { bump(a.blockers[bl], amt); if (bl === 'enforcement') bump(a.enforcementLinked, amt); else if (bl === 'objection') bump(a.objected, amt); else if (bl === 'linkage_unresolved') bump(a.unresolvedLinkage, amt); else bump(a.ineligibleReferral, amt); }
  }

  // ---- entity gap contribution (entity level only: there is no source target, so a source never carries a gap)
  const gapsIn = req.entityGaps && typeof req.entityGaps === 'object' && !Array.isArray(req.entityGaps) ? req.entityGaps : null;
  const gapOf = (key) => (gapsIn && Number.isFinite(Number(gapsIn[key])) && gapsIn[key] !== null && gapsIn[key] !== '' ? Number(gapsIn[key]) : null);
  const gapTotal = gapsIn ? Object.keys(gapsIn).reduce((t, k) => t + (gapOf(k) ?? 0), 0) : null;
  const shareOf = (g) => (g === null || !(gapTotal > 0) ? null : g / gapTotal);

  const baseScope = {}; for (const [k, v] of Object.entries(req.scope || {})) if (!DRILL_DROP.has(k)) baseScope[k] = v;
  const out = []; const cells = new Map(); const ents = new Map(); const byClass = Object.fromEntries(PLAN_CLASSES.map((c) => [c, { count: 0, remaining: 0, dueByYearEnd: 0, lines: 0 }]));
  for (const a of lines.values()) {
    const ek = ENTITIES[a.e].en; const src = sourceInfo(a.s); const mg = byMuni ? muniGroup(a.e, a.code) : null; const cls = a.cls;
    const gap = gapOf(ek);
    const isAct = ACTIONABLE.has(cls);
    const drill = drillOf(baseScope, cutoff, ek, src.key === 'unspecified' ? 'all' : src.key, mg && mg.key, { cls });
    const breakdown = cls === 'A' ? PLAN_BLOCKERS.filter((k) => a.blockers[k].count > 0).map((k) => ({ key: k, ar: BLOCKER_INFO[k].ar, en: BLOCKER_INFO[k].en, count: a.blockers[k].count, amount: a.blockers[k].amount, drill: drillOf(baseScope, cutoff, ek, src.key === 'unspecified' ? 'all' : src.key, mg && mg.key, { cls: 'A', blocker: k }) })) : [];
    const line = {
      id: `${ek}|${mg ? `${mg.key}|` : ''}${src.key}|${cls}`,
      entity: { key: ek, ar: ENTITIES[a.e].ar, en: ENTITIES[a.e].en }, ...(mg ? { municipality: mg } : {}),
      source: src, class: cls, classLabel: { ar: CLASS_INFO[cls].ar, en: CLASS_INFO[cls].en }, actionable: isAct,
      count: a.count, remaining: a.remaining, dueByYearEnd: a.dueByYearEnd, oldestDaysOverdue: a.oldest,
      overdue: a.overdue, notYetDue: a.notYetDue, dueUnavailable: a.dueUnavailable, partial: a.partial,
      evidence: { enforcementLinked: a.enforcementLinked, objected: a.objected, objectionRecorded: a.objectionRecorded, unresolvedLinkage: a.unresolvedLinkage, ineligibleReferral: a.ineligibleReferral, proposedLink: a.proposedLink, aged180: a.aged180, partial: a.partial, dueUnavailable: a.dueUnavailable, oldestDaysOverdue: a.oldest },
      ...(cls === 'A' ? { blockers: breakdown } : {}),
      recommendedAction: actionOf(cls, a), expectedImpact: null, expectedImpactReason: { ...EXPECTED_IMPACT_REASON },
      contributionToGap: { level: 'entity', entityGap: gap, share: shareOf(gap) },
      drill,
      rankInputs: { actionable: isAct ? a.remaining : 0, cellActionable: 0, entityGap: gap, remaining: a.remaining, oldestDaysOverdue: a.oldest }
    };
    out.push(line);
    const bc = byClass[cls]; bc.count += a.count; bc.remaining += a.remaining; bc.dueByYearEnd += a.dueByYearEnd; bc.lines += 1;
    // roll-ups: entity × [municipality] × source cells and entities (the page groups B + C of one cell into one ranked row)
    const ck = `${ek}|${mg ? mg.key : ''}|${src.key}`; let cell = cells.get(ck);
    if (!cell) { cell = { id: ck, entity: line.entity, ...(mg ? { municipality: mg } : {}), source: src, remaining: 0, actionable: 0, aged: 0, blocked: 0, oldestDaysOverdue: 0, byClass: Object.fromEntries(PLAN_CLASSES.map((c) => [c, 0])), contributionToGap: line.contributionToGap }; cells.set(ck, cell); }
    cell.remaining += a.remaining; cell.byClass[cls] += a.remaining; if (isAct) cell.actionable += a.remaining; if (cls === 'D') cell.aged += a.remaining; if (cls === 'A') cell.blocked += a.remaining; if (a.oldest > cell.oldestDaysOverdue) cell.oldestDaysOverdue = a.oldest;
    let en = ents.get(ek); if (!en) { en = { key: ek, ar: line.entity.ar, en: line.entity.en, remaining: 0, actionable: 0, aged: 0, blocked: 0, byClass: Object.fromEntries(PLAN_CLASSES.map((c) => [c, 0])), contributionToGap: line.contributionToGap }; ents.set(ek, en); }
    en.remaining += a.remaining; en.byClass[cls] += a.remaining; if (isAct) en.actionable += a.remaining; if (cls === 'D') en.aged += a.remaining; if (cls === 'A') en.blocked += a.remaining;
  }
  for (const cell of cells.values()) {
    cell.drillActionable = drillOf(baseScope, cutoff, cell.entity.key, cell.source.key === 'unspecified' ? 'all' : cell.source.key, cell.municipality && cell.municipality.key, { cls: ['B', 'C'] });
  }
  for (const l of out) l.rankInputs.cellActionable = cells.get(`${l.entity.key}|${l.municipality ? l.municipality.key : ''}|${l.source.key}`).actionable;
  // the stable default order: actionable cell first (largest), then the entity's gap, then class order, then the line's own balance, then ids — never a score
  out.sort((x, y) => (y.rankInputs.cellActionable - x.rankInputs.cellActionable) || ((y.rankInputs.entityGap ?? -Infinity) - (x.rankInputs.entityGap ?? -Infinity) || 0) || (CLASS_INFO[x.class].order - CLASS_INFO[y.class].order) || (y.remaining - x.remaining) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  out.forEach((l, k) => { l.rank = k + 1; });
  const cellsOut = [...cells.values()].sort((x, y) => (y.actionable - x.actionable) || ((y.contributionToGap.entityGap ?? -Infinity) - (x.contributionToGap.entityGap ?? -Infinity) || 0) || (y.remaining - x.remaining) || (x.id < y.id ? -1 : 1));
  cellsOut.forEach((c, k) => { c.rank = k + 1; });
  const entsOut = [...ents.values()].sort((x, y) => (y.actionable - x.actionable) || (y.remaining - x.remaining) || (x.key < y.key ? -1 : 1));
  const sum = (k) => PLAN_CLASSES.reduce((t, c) => t + byClass[c][k], 0);
  const actionableAmt = byClass.B.remaining + byClass.C.remaining;

  return {
    version: 1, kind: 'planning_action_lines', cutoff, asOf: cutoff, yearEnd: `${cutoff.slice(0, 4)}-12-31`, agedDays: PLAN_AGED_DAYS, level: byMuni ? 'municipality' : 'entity',
    scope: { amanah: req.scope?.amanah ?? 'all', source: req.scope?.source ?? 'all', muni: req.scope?.muni ?? 'all', org: req.scope?.org || null },
    classes: PLAN_CLASSES.map((c) => ({ key: c, ar: CLASS_INFO[c].ar, en: CLASS_INFO[c].en, actionable: CLASS_INFO[c].actionable, ...byClass[c] })),
    lines: out, cells: cellsOut, entities: entsOut,
    totals: { count: sum('count'), remaining: sum('remaining'), dueByYearEnd: sum('dueByYearEnd'), byClass, actionable: { count: byClass.B.count + byClass.C.count, remaining: actionableAmt }, needsDecision: { count: byClass.D.count, remaining: byClass.D.remaining }, blocked: { count: byClass.A.count, remaining: byClass.A.remaining }, lines: out.length },
    separate: { excluded: sep.excluded, cancelled: sep.cancelled, note: { ar: 'المستبعد والملغى خارج الأسطر وخارج الإجمالي.', en: 'Excluded and cancelled invoices are outside the lines and the totals.' } },
    gaps: { supplied: !!gapsIn, total: gapTotal === null ? null : fin(gapTotal), level: 'entity', note: { ar: 'المساهمة في الفجوة على مستوى الجهة فقط؛ لا مستهدف لمصدر الإيراد.', en: 'Gap contribution exists at entity level only; there is no revenue-source target.' } },
    expectedImpact: { available: false, reason: { ...EXPECTED_IMPACT_REASON } },
    notes: [
      { ar: 'المبالغ أرصدة قائمة وليست إضافية إلى التقدير؛ لا يُقدَّر مبلغ قابل للاسترداد لعدم توفر بيانات تتحقق منه.', en: 'Amounts are standing balances, not additions to the forecast; no recoverable amount is estimated because no data can validate one.' },
      { ar: 'كل فاتورة غير محصّلة في سطر واحد فقط (عائق ثم تاريخ استحقاق غير متاح ثم أقدم من 180 يوماً ثم متأخر ثم يستحق قبل نهاية السنة ثم بعدها)؛ فلا ازدواج بين الأسطر.', en: 'Every uncollected invoice sits in exactly one line (blocker, then due date unavailable, then older than 180 days, then overdue, then due by year-end, then after) — no double counting between lines.' },
      { ar: 'حد الـ180 يوماً من فئات التقادم القائمة وهو قاعدة عمل قيد التأكيد مع ملاك التحصيل (D-10).', en: 'The 180-day line comes from the existing ageing tiers and is a business rule pending confirmation by the collection owners (D-10).' }
    ]
  };
}
