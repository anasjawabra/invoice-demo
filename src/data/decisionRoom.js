// «غرفة القرارات» — the findings a reviewer needs to look at, DERIVED from the platform's own figures (pure functions, no I/O, no invented data). Redesign of 6 Nov 2026
// (docs/decision-room-redesign.md is the contract; its «Implemented data model» section lists the final shapes and thresholds).
//
// · SIX categories, an item exists only where the data supports it: plan_deviation · overdue_aging · source_deterioration · installments_unlinked · enforcement_links · data_conflicts.
// · Each item keeps four things apart: verified FACTS (what the records state) · CALCULATED deviations (with the formula) · UNKNOWN causes (never stated as proven) · PROPOSED review steps
//   (never an approved decision). No owners, no deadlines, no recovery probability, no «expected recovered revenue», no recommendation to lower a target.
// · Priority is High / Medium / Low from visible factors and thresholds (PRIORITY_RULE); there is no composite score.
// · Amount bases are never silently added: «period» (invoices of the selected period), «standing» (the balance up to the cutoff, all periods), «fiscal_year» (the plan), «contracts», «orders».
//   Items that count the same population disclose the overlap; only the overdue exposure by Amanah is additive (the Amanah cells partition the scope), see summaryOf.
import { fmtMoney } from '../utils/money';
import { muniLabel, amanahOfMuniKey } from './municipalityModel';
import { invoicePath, orderPath, ordersListPath } from '../utils/paths';
import { PLAN_STATE_TEXT } from './plans/planBasis';
import { UNLINKED_RULE, PROPOSED_RULE, PROPOSED_RULES, NOT_AVAILABLE, unlinkedPrerequisitesText } from './contractRules';

const bi = (ar, en) => ({ ar, en });
const T = (f) => ({ ar: f(true), en: f(false) });             // T((a) => a ? 'عربي' : 'English')
const $ = (n, a) => fmtMoney(n, { lang: a ? 'ar' : 'en' });  // one money format, the app's own
const pc = (v) => (v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(1)}%`);
const num = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('en-US') : '—');
const div = (a, b) => (b > 0 && Number.isFinite(a) ? a / b : null);
const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
const link = (path, params = {}) => { const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString(); return q ? `${path}?${q}` : path; };

export const CATEGORIES = {
  plan_deviation: bi('أداء التحصيل دون المخطط', 'Collection below plan'),
  overdue_aging: bi('المتأخرات وأعمارها', 'Overdue balances and aging'),
  source_deterioration: bi('تراجع مصدر إيراد', 'Revenue-source deterioration'),
  installments_unlinked: bi('أقساط استثمارية بلا فاتورة مرتبطة', 'Investment installments without a verified invoice link'),
  enforcement_links: bi('علاقات التنفيذ والفواتير', 'Enforcement and invoice relationships'),
  data_conflicts: bi('تعارضات بيانات مؤثرة', 'Material data conflicts')
};
export const CATEGORY_ORDER = Object.keys(CATEGORIES);
export const KINDS = { decision: bi('قرار إداري', 'Management decision'), review: bi('مراجعة تشغيلية', 'Operational review'), clarification: bi('توضيح بيانات', 'Data clarification') };
export const PRIORITY_LABELS = { high: bi('أولوية مرتفعة', 'High priority'), medium: bi('أولوية متوسطة', 'Medium priority'), low: bi('أولوية منخفضة', 'Low priority') };
export const VERIFICATION_LABELS = { verified: bi('الدليل من سجلات المصدر', 'Evidence from source records'), needs_verification: bi('يحتاج تحققاً من الدليل', 'Evidence needs verification') };
export const MEASURE_KINDS = { exposure: bi('تعرّض', 'Exposure'), gap: bi('فجوة', 'Gap'), overdue: bi('متأخر', 'Overdue'), amount: bi('مبلغ', 'Amount'), count: bi('عدد', 'Count') };
// kept for the Furas «data requests» page, which still groups its read-only items by lane
export const LANES = { decision: bi('يتطلب قراراً', 'Needs a decision'), action: bi('يتطلب إجراءً', 'Needs action'), watch: bi('للمتابعة', 'To follow') };

/* ---------------- thresholds (one place; the doc and the tests read these) ---------------- */
export const THRESHOLDS = {
  amanahShareMin: 0.05,        // an Amanah gets an overdue item when it holds at least this share of the scope's overdue …
  agedShareMin: 0.10,          // … or at least this share of the scope's balance older than 180 days
  agedDecision: 0.10,          // aged balance at least this share of the scope's aged balance → a route choice exists (management decision)
  sourceShareMin: 0.20,        // a source gets its own overdue item at this share of the scope's overdue (only when more than one source is in scope)
  maxAmanah: 6, maxSource: 3,
  deteriorationPp: 5,          // collection rate of a source fell by at least this many points against the previous equivalent period
  deteriorationNetShare: 0.03, // … and the source holds at least this share of the scope's net invoiced
  maxDeterioration: 3,
  planShortfallMin: 0.10,      // collected is at least this far below the planned-to-date amount (the Decision Room's OWN attention threshold; there is no tolerance band and no «on plan / ahead / behind» class anywhere — the sign of the deviation is stated in words)
  maxPlanEntities: 4,
  graded: {                    // factor → { high, medium }; days use «more than», the rest «at least»
    overdueShare: { high: 0.25, medium: 0.10 }, ageDays: { high: 180, medium: 90 },
    planShortfall: { high: 0.25, medium: 0.10 }, planOfAnnual: { high: 0.10, medium: 0.03 },
    ratePp: { high: 15, medium: 5 },
    valueOfNet: { high: 0.05, medium: 0.01 }, orderCount: { high: 10, medium: 3 }, installmentCount: { high: 20, medium: 5 },
    conflictOfNet: { high: 0.02, medium: 0.005 }, recordCount: { high: 20, medium: 5 }, missingCount: { high: 50, medium: 10 }
  }
};
export const PRIORITY_RULE = bi(
  'لكل بند عاملان أو ثلاثة ظاهرة عتباتها. مرتفعة: كل العوامل (حتى اثنين) في المستوى المرتفع. متوسطة: عامل واحد مرتفع أو عاملان متوسطان. منخفضة: غير ذلك. البند الذي ما زال دليله يحتاج تحققاً لا يتجاوز المتوسطة. لا درجة مركّبة.',
  'Each item has two or three visible factors with stated thresholds. High: every factor (up to two) is High. Medium: one factor High or two factors Medium. Low: otherwise. An item whose evidence still needs verification is held at Medium. No composite score.'
);
const LEVEL_RANK = { high: 0, medium: 1, low: 2 };

/** a graded factor: { key, label, value, unit, text, grade, threshold } */
function factor(key, label, value, unit, text, { high, medium }, gt = false) {
  const g = value == null || !Number.isFinite(value) ? 'low' : (gt ? value > high : value >= high) ? 'high' : (gt ? value > medium : value >= medium) ? 'medium' : 'low';
  const f = (v) => (unit === 'pct' ? pc(v) : unit === 'days' ? `${v}` : unit === 'pp' ? `${v}` : num(v));
  const u = (a) => (unit === 'days' ? (a ? ' يوماً' : ' days') : unit === 'pp' ? (a ? ' نقطة' : ' pp') : '');
  const op = gt ? '>' : '≥';
  return { key, label, value, unit, text, grade: g, threshold: T((a) => (a ? `مرتفع ${op} ${f(high)}${u(a)} · متوسط ${op} ${f(medium)}${u(a)}` : `High ${op} ${f(high)}${u(a)} · Medium ${op} ${f(medium)}${u(a)}`)) };
}
export function priorityOf(factors, { needsVerification = false } = {}) {
  const H = factors.filter((f) => f.grade === 'high').length; const M = factors.filter((f) => f.grade === 'medium').length;
  let level = H > 0 && H >= Math.min(2, factors.length) ? 'high' : H >= 1 || M >= 2 ? 'medium' : 'low';
  const capped = needsVerification && level === 'high'; if (capped) level = 'medium';
  const G = { high: bi('مرتفع', 'High'), medium: bi('متوسط', 'Medium'), low: bi('منخفض', 'Low') };
  const why = T((a) => `${PRIORITY_LABELS[level][a ? 'ar' : 'en']}: ${factors.map((f) => `${f.label[a ? 'ar' : 'en']} ${f.text[a ? 'ar' : 'en']} (${G[f.grade][a ? 'ar' : 'en']})`).join(a ? '؛ ' : '; ')}${capped ? (a ? ' — خُفّضت إلى متوسطة لأن الدليل ما زال يحتاج تحققاً' : ' — held at Medium because the evidence still needs verification') : ''}.`);
  return { level, why, factors: factors.map((f) => ({ label: f.label, value: f.value, unit: f.unit, text: f.text, grade: f.grade, threshold: f.threshold })), capped };
}

/**
 * The plan section of the Decision Room, built from the CONFIGURED REFERENCE PLAN's period-aware basis (planningBasisFromPlan + forecastPlan — src/data/plans/, referenceTarget.js): the Ministry (or the viewer's total) + each entity
 * against the amount PLANNED TO DATE. There is NO tolerance and NO «on plan / ahead / behind» status: the section carries the signed deviation, and an item exists only where collection is below the plan to date by the
 * Decision Room's own threshold (THRESHOLDS.planShortfallMin). The section always names the SOURCE plan + version.
 *   basis    planningBasisFromPlan(...) result (state ok | completed)           forecast  forecastPlan(...) | null
 *   source   referenceTarget.planSourceOf(reference) → { planId, versionId, versionNumber, name, label }
 *   masked   [{ key, basis }] — Amanahs the viewer sees only through MUNICIPAL grants: their rows are the visible municipalities' allocations (Σ target / planned / collected), «إجمالي الجهات المتاحة لك»
 * A basis that is not usable (draft_incomplete, no_target, no_data, future_period, incompatible_input …) gives { available:false, state, notice } — never a zero.
 * `unavailable(state, ref)` builds the same shape for a reference that is ambiguous / none / reference_invalid / not_loaded / no_access.
 */
export function planUnavailable(state, { notice = null, source = null, year = null, candidates = null, reason = null } = {}) {
  return { available: false, state, year, reason, candidates, source, notice: notice || PLAN_STATE_TEXT[state] || null, link: '/planning' };
}
export function planSectionOf({ basis, forecast = null, source = null, masked = [] }) {
  if (!basis || (basis.state !== 'ok' && basis.state !== 'completed')) return planUnavailable(basis?.state || 'no_data', { source, notice: basis?.message || null, reason: basis?.reason || null });
  const mrows = masked.filter((m) => m.basis && (m.basis.state === 'ok' || m.basis.state === 'completed'))
    .map((m) => { const rows = (m.basis.entities || []).filter((r) => r.rowKind === 'municipality' && r.hasTarget && r.actual != null); return { key: m.key, target: sum(rows, (r) => r.target), plannedToDate: sum(rows, (r) => r.plannedToDate), collected: sum(rows, (r) => r.actual), rows: rows.length }; })
    .filter((r) => r.rows > 0 && r.target > 0);
  const own = (basis.entities || []).filter((e) => e.hasTarget && e.actual != null && e.rowKind !== 'municipality');
  const entities = [...own.map((e) => ({ key: e.key, target: e.target, collected: e.actual, plannedToDate: e.plannedToDate, deviation: e.deviation, deviationPct: e.deviationPct })),
    ...mrows.map((r) => ({ key: r.key, target: r.target, collected: r.collected, plannedToDate: r.plannedToDate, deviation: r.collected - r.plannedToDate, deviationPct: div(r.collected - r.plannedToDate, r.plannedToDate), municipalTotal: true }))];
  const baseT = basis.target?.value > 0 ? basis.target.value : 0; const baseC = basis.actualToDate; const baseP = basis.plannedToDate;
  const target = baseT + sum(mrows, (r) => r.target);
  const hasBase = baseT > 0 && baseC != null && baseP != null;
  const collected = (hasBase ? baseC : 0) + sum(mrows, (r) => r.collected); const planned = (hasBase ? baseP : 0) + sum(mrows, (r) => r.plannedToDate);
  const f = forecast && forecast.state === 'ok' && !mrows.length ? forecast : null;
  const ended = basis.state === 'completed';
  return {
    available: true, state: basis.state, year: Number(basis.reportingCutoff.slice(0, 4)), reportingDate: basis.reportingCutoff, period: basis.period, source, restricted: !!basis.restricted || mrows.length > 0,
    monthsLeft: ended ? 0 : (basis.remaining?.months ?? 0), planProfile: basis.profile || null,
    ministry: target > 0 && (hasBase || mrows.length) ? {
      target, collected, forecast: f ? f.forecastTotal : null, plannedToDate: planned, avg: f?.monthlyRate ?? null,
      requiredMonthly: mrows.length ? null : (basis.pace?.required?.monthly ?? null), requiredDaily: mrows.length ? null : (basis.pace?.required?.daily ?? null),
      deviation: collected - planned, deviationPct: div(collected - planned, planned)
    } : null,
    entities
  };
}

/** the monthly net / collected of the invoices of a scope (by invoice month) from the snapshot matrix — the same data the item trend and the charts read */
export function trendSeries(S, { amanah, source } = {}) {
  const m = new Map();
  for (const r of S?.matrix?.amanahSourceMonth || []) {
    if (amanah && r.amanah !== amanah) continue; if (source && r.source !== source) continue;
    const x = m.get(r.month) || { month: r.month, net: 0, collected: 0 }; x.net += r.net || 0; x.collected += r.collected || 0; m.set(r.month, x);
  }
  return [...m.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}
const hasTrend = (S, d) => trendSeries(S, d).filter((x) => x.net > 0).length >= 2;

const scopeList = (S) => { const a = S.scope?.amanah; if (a == null || a === 'all') return null; const l = [].concat(a).filter((x) => x && x !== 'all'); return l.length ? l : null; };

/**
 * @param {object} inp
 *  today, snapshot (the selected period), labels { amanah(key) → {ar,en}, source(key) → {ar,en} }, allowedAmanahs (array | null = all: the user's organisation scope),
 *  previous { snapshot, comparable } | null  — the previous equivalent period of the SAME scope, each measured at the end of its own period (comparison.js); source deterioration needs it,
 *  plan (planSectionOf | null), contracts { count, arrears, overdueInstallments, unlinkedInstallments, unlinkedAmount } | null, noContractCount,
 *  orders { suspendedCount, suspendedAmount, suspendedNums?, amanahs?, proposedLinks?, proposedLinkOrders?, unresolvedRefs?, unresolvedRefOrders?, linkNums? } | null,
 *  matching { amountConflicts, conflictAmount?, conflictIds?, missingFields, missingIds? } | null
 * @returns {{ items: object[], context: object }}
 */
export function buildDecisionItems(inp) {
  const { snapshot: S, labels } = inp; const cutoff = S.cutoff || inp.today; const period = { from: S.scope.from, to: S.scope.to };
  const allowed = inp.allowedAmanahs ? new Set(inp.allowedAmanahs) : null; const okA = (k) => !allowed || allowed.has(k);
  const th = THRESHOLDS; const G = th.graded; const sl = scopeList(S); const oneAmanah = sl && sl.length === 1 ? sl[0] : null;
  // a municipality scope (one Amanah + one reference municipality / explicit group) is part of every item built from the snapshot: label, `affected.municipality` and the evidence links' `muni` param
  const muniKey = oneAmanah && S.scope?.muni && S.scope.muni !== 'all' && amanahOfMuniKey(S.scope.muni) === oneAmanah ? S.scope.muni : null;
  const withMuni = (L0) => (muniKey ? T((ar) => `${L0[ar ? 'ar' : 'en']} — ${muniLabel(muniKey, ar ? 'ar' : 'en')}`) : L0);
  const scopeLabel = oneAmanah ? withMuni(labels.amanah(oneAmanah)) : bi('كل الجهات في النطاق', 'All entities in scope');
  const net = S.totals?.net || 0;
  const pops = new Map(); const items = [];
  const seen = new Set();
  const add = (it, pop) => {
    if (seen.has(it.key)) return; seen.add(it.key);
    const base = { period, periodBasis: 'selected', cutoff, comparison: { basis: bi('', ''), values: [] }, facts: [], calculated: [], unknown: [], proposed: [], options: [], evidence: [], missing: [], overlap: [], additive: false, condition: { open: true }, trend: false };
    items.push({ ...base, ...it }); pops.set(it.key, pop);
  };
  const amL = (a) => (a === oneAmanah ? withMuni(labels.amanah(a)) : labels.amanah(a)); // the Amanah's label carries the municipality when the scope is one
  const af = (a, s) => ({ ...(a ? { amanah: a } : {}), ...(a && a === oneAmanah && muniKey ? { municipality: muniKey } : {}), ...(s ? { source: s } : {}), label: a && s ? T((x) => `${amL(a)[x ? 'ar' : 'en']} — ${labels.source(s)[x ? 'ar' : 'en']}`) : a ? amL(a) : s ? labels.source(s) : scopeLabel });
  const scopeAf = () => ({ ...(oneAmanah ? { amanah: oneAmanah } : {}), ...(muniKey ? { municipality: muniKey } : {}), ...(S.scope.source && S.scope.source !== 'all' && !Array.isArray(S.scope.source) ? { source: S.scope.source } : {}), label: scopeLabel });
  const scopeParams = { from: period.from, to: period.to, ...(oneAmanah ? { amanah: oneAmanah } : {}), ...(muniKey ? { muni: muniKey } : {}) }; // the municipality filter value travels with the Amanah
  const reasonLine = (a, od) => (S.stock?.objectionOutstanding > 0
    ? bi(`في النطاق مبلغ ${$(S.stock.objectionOutstanding, true)} عليه اعتراض مسجَّل؛ الاعتراض هو السبب الوحيد الموثَّق في البيانات، وتوزيعه على هذه الجهة غير متاح.`, `The scope holds ${$(S.stock.objectionOutstanding, false)} under a recorded objection — the only documented reason in the data; its split to this entity is not available.`)
    : bi('لا سبب موثَّق لعدم السداد في بيانات هذا المبلغ (لا يوجد اعتراض مسجَّل)؛ سبب التأخر غير معروف.', 'No documented reason for non-payment is recorded for this amount (no objection is recorded); the cause of the delay is unknown.'));

  /* ---- 1. overdue and aging: by Amanah (period overdue; the aged part is the standing balance older than 180 days, stated separately) and by source */
  const cells = (S.matrix?.amanahSource || []).filter((c) => okA(c.amanah));
  const totalOverdue = sum(cells, (c) => c.overdue); const totalNotDue = sum(cells, (c) => c.notDue);
  const aged = (S.stock?.aged180ByAmanah || []).filter((a) => okA(a.key)); const totalAged = sum(aged, (a) => a.amount);
  const agedBy = new Map(aged.map((a) => [a.key, a])); const standingBy = new Map((S.stock?.byAmanah || []).map((g) => [g.key, g]));
  const byAm = new Map();
  for (const c of cells) { const g = byAm.get(c.amanah) || { overdue: 0, notDue: 0, net: 0, collected: 0, maxDays: 0, sources: new Map() }; g.overdue += c.overdue || 0; g.notDue += c.notDue || 0; g.net += c.net || 0; g.collected += c.collected || 0; g.maxDays = Math.max(g.maxDays, c.maxDaysOverdue || 0); if (c.overdue > 0) g.sources.set(c.source, (g.sources.get(c.source) || 0) + c.overdue); byAm.set(c.amanah, g); }
  const bySrc = new Map();
  for (const c of cells) { const g = bySrc.get(c.source) || { overdue: 0, notDue: 0, net: 0, collected: 0, maxDays: 0, amanahs: new Map() }; g.overdue += c.overdue || 0; g.notDue += c.notDue || 0; g.net += c.net || 0; g.collected += c.collected || 0; g.maxDays = Math.max(g.maxDays, c.maxDaysOverdue || 0); if (c.overdue > 0) g.amanahs.set(c.amanah, (g.amanahs.get(c.amanah) || 0) + c.overdue); bySrc.set(c.source, g); }

  const keys = [...new Set([...byAm.keys(), ...agedBy.keys()])];
  const cand = keys.map((k) => ({ k, od: byAm.get(k)?.overdue || 0, ag: agedBy.get(k)?.amount || 0 }))
    .filter((x) => (totalOverdue > 0 && x.od / totalOverdue >= th.amanahShareMin) || (totalAged > 0 && x.ag / totalAged >= th.agedShareMin))
    .sort((a, b) => b.od - a.od || b.ag - a.ag || (a.k < b.k ? -1 : 1)).slice(0, th.maxAmanah);
  for (const x of cand) {
    const g = byAm.get(x.k) || { overdue: 0, notDue: 0, net: 0, collected: 0, maxDays: 0, sources: new Map() }; const a = agedBy.get(x.k); const A = amL(x.k);
    const periodMaterial = totalOverdue > 0 && x.od / totalOverdue >= th.amanahShareMin; const agedMaterial = totalAged > 0 && x.ag / totalAged >= th.agedDecision;
    const share = div(x.od, totalOverdue); const agedShare = div(x.ag, standingBy.get(x.k)?.outstanding); const ageDays = Math.max(g.maxDays, x.ag > 0 ? 181 : 0);
    const topSources = [...g.sources.entries()].sort((p, q) => q[1] - p[1]).slice(0, 3);
    const factors = periodMaterial
      ? [factor('overdue_share', bi('حصة من متأخرات النطاق', 'Share of the scope’s overdue'), share, 'pct', bi(pc(share), pc(share)), G.overdueShare), factor('age', bi('أطول تأخر', 'Longest overdue'), ageDays, 'days', T((ar) => (x.ag > 0 && g.maxDays <= 180 ? (ar ? 'أكثر من 180 يوماً' : 'over 180 days') : (ar ? `${ageDays} يوماً` : `${ageDays} days`))), G.ageDays, true)]
      : [factor('aged_share', bi('حصة من الرصيد الأعمر من 180 يوماً في النطاق', 'Share of the scope’s balance older than 180 days'), div(x.ag, totalAged), 'pct', bi(pc(div(x.ag, totalAged)), pc(div(x.ag, totalAged))), G.overdueShare), factor('age', bi('أطول تأخر', 'Longest overdue'), ageDays, 'days', bi('أكثر من 180 يوماً', 'over 180 days'), G.ageDays, true)];
    const decision = agedMaterial && x.ag > 0;
    add({
      key: `overdue:amanah:${x.k}`, kind: decision ? 'decision' : 'review', category: 'overdue_aging',
      title: bi(`${A.ar}: ${periodMaterial ? 'متأخرات غير مسدّدة' : 'ديون أعمر من 180 يوماً'}`, `${A.en}: ${periodMaterial ? 'unpaid overdue balances' : 'debt older than 180 days'}`),
      question: decision ? bi(`ما مسار معالجة الأرصدة الأعمر من 180 يوماً لدى ${A.ar}، وأي الفواتير تُراجَع أولاً؟`, `Which route fits the balances older than 180 days at ${A.en}, and which invoices are reviewed first?`)
        : bi(`أي الفواتير المتأخرة لدى ${A.ar} تُراجَع أولاً؟`, `Which overdue invoices at ${A.en} are reviewed first?`),
      what: T((ar) => (periodMaterial
        ? (ar ? `على ${A.ar} مبلغ ${$(x.od, true)} غير مسدّد وقد حلّ موعد استحقاقه، من فواتير ${period.from} إلى ${period.to}؛ وهو ${pc(share)} من متأخرات النطاق.${x.ag > 0 ? ` ويضمّ رصيدها القائم ${$(x.ag, true)} مرّ على استحقاقه أكثر من 180 يوماً (كل الفترات).` : ''}`
          : `${A.en} holds ${$(x.od, false)} unpaid and past its due date, on invoices of ${period.from} to ${period.to} — ${pc(share)} of the scope’s overdue.${x.ag > 0 ? ` Its standing balance also includes ${$(x.ag, false)} more than 180 days past due (all periods).` : ''}`)
        : (ar ? `لدى ${A.ar} رصيد قائم ${$(x.ag, true)} مرّ على استحقاقه أكثر من 180 يوماً (كل الفترات)${agedShare != null ? `، أي ${pc(agedShare)} من رصيدها القائم` : ''}.` : `${A.en} has a standing balance of ${$(x.ag, false)} more than 180 days past due (all periods)${agedShare != null ? `, ${pc(agedShare)} of its standing balance` : ''}.`))),
      affected: af(x.k),
      measure: periodMaterial
        ? { kind: 'overdue', label: bi('المتأخر غير المسدّد', 'Unpaid overdue'), amount: x.od, basis: bi('فواتير الفترة المختارة، المتأخر عن الاستحقاق حتى تاريخ القطع (دون ما لم يحن)', 'Invoices of the selected period, past due at the cutoff (not-yet-due excluded)') }
        : { kind: 'overdue', label: bi('رصيد أعمر من 180 يوماً', 'Balance older than 180 days'), amount: x.ag, basis: bi('الرصيد القائم حتى تاريخ القطع (كل الفترات)', 'Standing balance to the cutoff (all periods)') },
      comparison: { basis: bi('متأخر هذه الجهة مقابل إجمالي متأخرات النطاق (الفترة نفسها)', 'This entity’s overdue against the scope’s total overdue (same period)'), values: [{ label: bi('هذه الجهة', 'This entity'), value: x.od, unit: 'SAR' }, { label: bi('إجمالي النطاق', 'Scope total'), value: totalOverdue, unit: 'SAR' }] },
      facts: [
        ...(g.net > 0 ? [{ ...T((ar) => (ar ? `صافي المفوتر للفترة ${$(g.net, true)}، والمحصّل ${$(g.collected, true)}.` : `Net invoiced in the period ${$(g.net, false)}; collected ${$(g.collected, false)}.`)), evidence: 'source_record' }] : []),
        ...(g.overdue > 0 ? [{ ...T((ar) => (ar ? `المتأخر عن الاستحقاق ${$(g.overdue, true)}؛ وما لم يحن موعده ${$(g.notDue, true)} لا يُحسب متأخراً.${g.maxDays > 0 ? ` أطول تأخر ${g.maxDays} يوماً.` : ''}` : `Past due ${$(g.overdue, false)}; ${$(g.notDue, false)} not yet due is not counted as overdue.${g.maxDays > 0 ? ` Longest delay ${g.maxDays} days.` : ''}`)), evidence: 'source_record' }] : []),
        ...(topSources.length ? [{ ...T((ar) => (ar ? `أكبر المصادر في المتأخر: ${topSources.map(([s, v]) => `${labels.source(s).ar} (${$(v, true)})`).join('، ')}.` : `Largest sources of the overdue: ${topSources.map(([s, v]) => `${labels.source(s).en} (${$(v, false)})`).join(', ')}.`)), evidence: 'calculated' }] : []),
        ...(a ? [{ ...T((ar) => (ar ? `${num(a.count)} فاتورة مرّ على استحقاقها أكثر من 180 يوماً، قيمتها ${$(a.amount, true)} (كل الفترات).` : `${num(a.count)} invoices more than 180 days past due, worth ${$(a.amount, false)} (all periods).`)), evidence: 'source_record' }] : [])
      ],
      calculated: [
        ...(g.net > 0 ? [{ label: bi('نسبة التحصيل', 'Collection rate'), value: div(g.collected, g.net), unit: 'pct', formula: bi('المحصّل ÷ صافي المفوتر', 'Collected ÷ net invoiced') }] : []),
        ...(periodMaterial ? [{ label: bi('حصة من متأخرات النطاق', 'Share of the scope’s overdue'), value: share, unit: 'pct', formula: bi('متأخر الجهة ÷ إجمالي متأخر النطاق', 'Entity overdue ÷ scope overdue') }] : []),
        ...(agedShare != null ? [{ label: bi('الأعمر من 180 يوماً من رصيدها القائم', 'Older than 180 days, of its standing balance'), value: agedShare, unit: 'pct', formula: bi('الرصيد الأعمر من 180 يوماً ÷ الرصيد القائم للجهة', 'Balance older than 180 days ÷ the entity’s standing balance') }] : [])
      ],
      unknown: [reasonLine(true, x.od), bi('لا يتوفر سجل لمراجعات الدافع أو التزاماته بالسداد في البيانات الحالية.', 'No record of payer contacts or payment commitments is available in the current data.')],
      proposed: [
        bi('ابدأ بمراجعة الفواتير الأعلى قيمة في قائمة المتأخرات لهذه الجهة (القائمة مفتوحة بالنطاق نفسه).', 'Start with the highest-value invoices in this entity’s overdue list (the list opens with the same scope).'),
        ...(S.stock?.objectionOutstanding > 0 ? [bi('تحقق من حالة الاعتراضات المسجَّلة قبل الاستمرار في المتابعة.', 'Check the status of the recorded objections before continuing the follow-up.')] : []),
        ...(x.ag > 0 ? [bi('حدّد ما يؤهَّل منها للإحالة إلى مساحة الإنفاذ وفق القواعد القائمة هناك؛ لا شيء يُحال من هذه الصفحة.', 'Identify which of them qualify for referral under the rules of the enforcement workspace; nothing is referred from this page.')] : [])
      ],
      options: decision ? [
        { title: bi('متابعة مكثفة للفواتير الأعلى قيمة', 'Intensive follow-up of the highest-value invoices'), implication: bi('يبقى الرصيد مفتوحاً ويُقاس بتغيّر المتأخر في الفترات التالية؛ لا يغيّر أي سجل مالي.', 'The balance stays open and is measured by the change in overdue in later periods; no financial record changes.') },
        { title: bi('مراجعة أهلية الإحالة إلى التنفيذ', 'Review eligibility for referral to enforcement'), implication: bi('تُجرى المراجعة في مساحة الإنفاذ بقواعدها ومستنداتها؛ الإحالة نفسها قرار منفصل هناك.', 'The review happens in the enforcement workspace with its rules and documents; the referral itself is a separate decision there.') },
        { title: bi('تدوين عدم اتخاذ إجراء مع السبب في ملاحظة المتابعة', 'Record that no action is taken, with the reason, in the follow-up note'), implication: bi('يبقى الرصيد ظاهراً كمفتوح ولا يُعدّل أو يُستبعد.', 'The balance stays visible as open; nothing is adjusted or excluded.') }
      ] : [],
      evidence: [
        ...(g.overdue > 0 ? [
          { label: bi('الفواتير المتأخرة لهذه الجهة', 'This entity’s overdue invoices'), to: link('/collection', { ...scopeParams, amanah: x.k, category: 'overdue' }), status: 'source_record' },
          { label: bi('الفواتير المحصّلة جزئياً (جزؤها المتأخر داخل المبلغ)', 'Partly collected invoices (their overdue part is inside the amount)'), to: link('/collection', { ...scopeParams, amanah: x.k, category: 'partial' }), status: 'source_record' }] : []),
        ...(a ? [{ label: bi('فواتير الجهة المتأخرة (وسّع الفترة لرؤية الأقدم)', 'The entity’s overdue invoices (widen the period to see the oldest)'), to: link('/collection', { amanah: x.k, ...(x.k === oneAmanah && muniKey ? { muni: muniKey } : {}), category: 'overdue' }), count: a.count, status: 'source_record' }] : [])
      ],
      missing: [bi('سبب عدم السداد لكل فاتورة (غير مسجَّل ما عدا الاعتراضات)', 'The reason for non-payment per invoice (not recorded, except objections)')],
      priority: priorityOf(factors, { needsVerification: false }), verification: 'verified',
      additive: periodMaterial, trend: hasTrend(S, { amanah: x.k })
    }, { fam: 'inv', part: 'amanah', am: [x.k], src: [...g.sources.keys()] });
  }

  // by source: only when several sources are in scope (otherwise it repeats the Amanah items)
  const sourcesInScope = bySrc.size;
  if (sourcesInScope > 1 && totalOverdue > 0) {
    [...bySrc.entries()].filter(([, g]) => g.overdue / totalOverdue >= th.sourceShareMin).sort((p, q) => q[1].overdue - p[1].overdue).slice(0, th.maxSource).forEach(([s, g]) => {
      const Sx = labels.source(s); const share = div(g.overdue, totalOverdue); const tops = [...g.amanahs.entries()].sort((p, q) => q[1] - p[1]).slice(0, 3);
      add({
        key: `overdue:source:${s}`, kind: 'review', category: 'overdue_aging',
        title: bi(`${Sx.ar}: متأخرات غير مسدّدة حسب المصدر`, `${Sx.en}: unpaid overdue balances by revenue source`),
        question: bi(`أي الأمانات والفواتير في ${Sx.ar} تُراجَع أولاً؟`, `Which entities and invoices in ${Sx.en} are reviewed first?`),
        what: T((ar) => (ar ? `في ${Sx.ar} مبلغ ${$(g.overdue, true)} غير مسدّد وقد حلّ موعد استحقاقه، من فواتير ${period.from} إلى ${period.to}؛ وهو ${pc(share)} من متأخرات النطاق.` : `${Sx.en} holds ${$(g.overdue, false)} unpaid and past its due date on invoices of ${period.from} to ${period.to} — ${pc(share)} of the scope’s overdue.`)),
        affected: af(null, s),
        measure: { kind: 'overdue', label: bi('المتأخر غير المسدّد', 'Unpaid overdue'), amount: g.overdue, basis: bi('فواتير الفترة المختارة، المتأخر عن الاستحقاق حتى تاريخ القطع (دون ما لم يحن)', 'Invoices of the selected period, past due at the cutoff (not-yet-due excluded)') },
        comparison: { basis: bi('متأخر هذا المصدر مقابل إجمالي متأخرات النطاق (الفترة نفسها)', 'This source’s overdue against the scope’s total overdue (same period)'), values: [{ label: bi('هذا المصدر', 'This source'), value: g.overdue, unit: 'SAR' }, { label: bi('إجمالي النطاق', 'Scope total'), value: totalOverdue, unit: 'SAR' }] },
        facts: [
          { ...T((ar) => (ar ? `صافي المفوتر للمصدر ${$(g.net, true)}، والمحصّل ${$(g.collected, true)}؛ وما لم يحن موعده ${$(g.notDue, true)} لا يُحسب متأخراً.` : `Net invoiced for the source ${$(g.net, false)}; collected ${$(g.collected, false)}; ${$(g.notDue, false)} not yet due is not counted as overdue.`)), evidence: 'source_record' },
          ...(tops.length ? [{ ...T((ar) => (ar ? `أكبر الجهات في المتأخر: ${tops.map(([k, v]) => `${labels.amanah(k).ar} (${$(v, true)})`).join('، ')}.` : `Largest entities in the overdue: ${tops.map(([k, v]) => `${labels.amanah(k).en} (${$(v, false)})`).join(', ')}.`)), evidence: 'calculated' }] : [])
        ],
        calculated: [{ label: bi('نسبة التحصيل', 'Collection rate'), value: div(g.collected, g.net), unit: 'pct', formula: bi('المحصّل ÷ صافي المفوتر', 'Collected ÷ net invoiced') }, { label: bi('حصة من متأخرات النطاق', 'Share of the scope’s overdue'), value: share, unit: 'pct', formula: bi('متأخر المصدر ÷ إجمالي متأخر النطاق', 'Source overdue ÷ scope overdue') }],
        unknown: [reasonLine(true, g.overdue)],
        proposed: [bi('راجع الفواتير الأعلى قيمة في هذا المصدر ضمن النطاق نفسه، وابدأ بالجهات الأكبر حصة.', 'Review the highest-value invoices of this source within the same scope, starting with the entities holding the largest shares.'), ...(S.stock?.objectionOutstanding > 0 ? [bi('تحقق من حالة الاعتراضات المسجَّلة.', 'Check the status of the recorded objections.')] : [])],
        evidence: [{ label: bi('الفواتير المتأخرة لهذا المصدر', 'This source’s overdue invoices'), to: link('/collection', { ...scopeParams, src: s, category: 'overdue' }), status: 'source_record' }],
        missing: [bi('سبب عدم السداد لكل فاتورة (غير مسجَّل ما عدا الاعتراضات)', 'The reason for non-payment per invoice (not recorded, except objections)')],
        priority: priorityOf([factor('overdue_share', bi('حصة من متأخرات النطاق', 'Share of the scope’s overdue'), share, 'pct', bi(pc(share), pc(share)), G.overdueShare), factor('age', bi('أطول تأخر', 'Longest overdue'), g.maxDays, 'days', bi(`${g.maxDays} يوماً`, `${g.maxDays} days`), G.ageDays, true)]), verification: 'verified',
        trend: hasTrend(S, { source: s })
      }, { fam: 'inv', part: 'source', am: [...g.amanahs.keys()], src: [s] });
    });
  }

  /* ---- 2. revenue-source deterioration: needs a verified like-for-like comparison with the previous equivalent period (each measured at the end of its own period) */
  const P = inp.previous;
  if (P?.snapshot && P.comparable !== false) {
    const prevBy = new Map((P.snapshot.bySource || []).map((g) => [g.key, g]));
    (S.bySource || []).map((g) => { const p = prevBy.get(g.key); const now = g.collectedOverNet; const was = p?.collectedOverNet; return { g, p, now: now?.calculable ? now.value : null, was: was?.calculable ? was.value : null }; })
      .filter((r) => r.now != null && r.was != null && (r.g.net || 0) > 0 && (r.p.net || 0) > 0 && div(r.g.net, net) >= th.deteriorationNetShare && (r.was - r.now) * 100 >= th.deteriorationPp)
      .sort((a, b) => (b.was - b.now) - (a.was - a.now)).slice(0, th.maxDeterioration).forEach((r) => {
        const s = r.g.key; const Sx = labels.source(s); const drop = (r.was - r.now) * 100; const od = r.g.overdueOutstanding || 0; const shareOd = div(od, totalOverdue);
        const prevRange = `${P.snapshot.scope.from} → ${P.snapshot.scope.to}`;
        add({
          key: `source:${s}`, kind: 'review', category: 'source_deterioration',
          title: bi(`${Sx.ar}: انخفاض نسبة التحصيل عن الفترة المماثلة السابقة`, `${Sx.en}: collection rate below the previous equivalent period`),
          question: bi(`هل الانخفاض في ${Sx.ar} واسع أم يعود إلى فواتير محدودة، وما الذي يحتاج تحققاً؟`, `Is the fall in ${Sx.en} broad or driven by a few invoices, and what needs checking?`),
          what: T((ar) => (ar ? `نسبة التحصيل في ${Sx.ar} ${pc(r.now)} للفترة الحالية مقابل ${pc(r.was)} للفترة المماثلة السابقة (${prevRange})، بانخفاض ${drop.toFixed(1)} نقطة.` : `The collection rate in ${Sx.en} is ${pc(r.now)} for the current period against ${pc(r.was)} for the previous equivalent period (${prevRange}), ${drop.toFixed(1)} points lower.`)),
          affected: { ...(oneAmanah ? { amanah: oneAmanah } : {}), ...(muniKey ? { municipality: muniKey } : {}), source: s, label: oneAmanah ? T((ar) => `${amL(oneAmanah)[ar ? 'ar' : 'en']} — ${Sx[ar ? 'ar' : 'en']}`) : Sx },
          measure: { kind: 'overdue', label: bi('المتأخر غير المسدّد في المصدر', 'Unpaid overdue in the source'), amount: od, basis: bi('فواتير الفترة الحالية، المتأخر عن الاستحقاق حتى تاريخ القطع', 'Invoices of the current period, past due at the cutoff') },
          comparison: { basis: bi('نسبة التحصيل (المحصّل ÷ صافي المفوتر) لنفس المصدر والنطاق: الفترة الحالية مقابل الفترة المماثلة السابقة، وكلتاهما مقيسة عند نهاية فترتها', 'Collection rate (collected ÷ net invoiced) for the same source and scope: current period against the previous equivalent period, each measured at the end of its own period'), values: [{ label: bi('الفترة الحالية', 'Current period'), value: r.now, unit: 'pct' }, { label: bi('الفترة المماثلة السابقة', 'Previous equivalent period'), value: r.was, unit: 'pct' }] },
          facts: [
            { ...T((ar) => (ar ? `الفترة الحالية: صافي المفوتر ${$(r.g.net, true)}، المحصّل ${$(r.g.collected, true)}.` : `Current period: net invoiced ${$(r.g.net, false)}, collected ${$(r.g.collected, false)}.`)), evidence: 'source_record' },
            { ...T((ar) => (ar ? `الفترة السابقة (${prevRange}): صافي المفوتر ${$(r.p.net, true)}، المحصّل ${$(r.p.collected, true)}.` : `Previous period (${prevRange}): net invoiced ${$(r.p.net, false)}, collected ${$(r.p.collected, false)}.`)), evidence: 'source_record' }
          ],
          calculated: [{ label: bi('التغيّر في نسبة التحصيل', 'Change in the collection rate'), value: -drop, unit: 'pp', formula: bi('نسبة الفترة الحالية − نسبة الفترة السابقة (بالنقاط المئوية)', 'Current-period rate − previous-period rate (percentage points)') }, { label: bi('حصة المصدر من متأخرات النطاق', 'Source share of the scope’s overdue'), value: shareOd, unit: 'pct', formula: bi('متأخر المصدر ÷ إجمالي متأخر النطاق', 'Source overdue ÷ scope overdue') }],
          unknown: [bi('سبب الانخفاض غير مسجَّل؛ المقارنة تُظهر أن النسبة انخفضت لا لماذا انخفضت، ولا يصحّ عدّه تراجعاً في أداء التحصيل قبل فحص الفواتير.', 'The reason for the fall is not recorded; the comparison shows that the rate fell, not why, so it should not be read as weaker collection performance before the invoices are examined.')],
          proposed: [bi('افحص الفواتير غير المسدّدة الأعلى قيمة في هذا المصدر لمعرفة هل الانخفاض واسع أم من فواتير محدودة.', 'Examine the highest-value unpaid invoices of this source to see whether the fall is broad or from a few invoices.'), bi('قارن تركيب الفواتير (الأمانات والمنتجات) بين الفترتين قبل أي استنتاج.', 'Compare the mix of invoices (entities and products) between the two periods before drawing any conclusion.')],
          evidence: [{ label: bi('الفواتير المتأخرة لهذا المصدر', 'This source’s overdue invoices'), to: link('/collection', { ...scopeParams, src: s, category: 'overdue' }), status: 'source_record' }, { label: bi('مقارنة الفترتين', 'The two-period comparison'), to: link('/insights'), status: 'calculated' }],
          missing: [bi('أسباب الانخفاض (غير مسجَّلة)', 'Reasons for the fall (not recorded)')],
          priority: priorityOf([factor('rate_drop', bi('انخفاض نسبة التحصيل', 'Fall in the collection rate'), drop, 'pp', bi(`${drop.toFixed(1)} نقطة`, `${drop.toFixed(1)} points`), G.ratePp), factor('overdue_share', bi('حصة من متأخرات النطاق', 'Share of the scope’s overdue'), shareOd, 'pct', bi(pc(shareOd), pc(shareOd)), G.overdueShare)]), verification: 'verified',
          trend: hasTrend(S, { source: s })
        }, { fam: 'inv', part: 'source', am: [...(bySrc.get(s)?.amanahs.keys() || [])], src: [s] });
      });
  }

  /* ---- 3. collection below the plan: collected (payment-date basis) against the amount PLANNED TO DATE of the CONFIGURED REFERENCE PLAN (its name + version travel with every item); the plan target is stated separately.
          No tolerance band: an item exists where collection is below the plan to date by THRESHOLDS.planShortfallMin; the sign of the deviation is stated in words. */
  const PL = inp.plan; const planOk = PL && PL.available !== false && (S.scope.source == null || S.scope.source === 'all');
  if (planOk) {
    const periodPlan = { from: PL.period?.start || `${PL.year}-01-01`, to: PL.reportingDate };
    const planSrc = PL.source || null; const srcAr = planSrc ? planSrc.label.ar : null; const srcEn = planSrc ? planSrc.label.en : null;
    const basisPlan = bi('المحصّل (حسب تاريخ الدفع) مقابل المخطط حتى تاريخ التقرير؛ مستهدف الخطة يُذكر منفصلاً وليس أساس المقارنة', 'Collected (payment-date basis) against the amount planned to the reporting date; the plan target is shown separately and is not the comparison basis');
    const mkPlan = (key, A, e, extra = {}) => {
      const gap = e.plannedToDate - e.collected; const ach = div(e.collected, e.plannedToDate); const shortfall = div(gap, e.plannedToDate); const ofAnnual = div(gap, e.target);
      return {
        key, kind: 'decision', category: 'plan_deviation', periodBasis: 'fiscal_year', period: periodPlan, cutoff: PL.reportingDate, planSource: planSrc,
        title: bi(`${A.ar}: التحصيل دون المخطط حتى تاريخه`, `${A.en}: collection below the plan to date`),
        question: bi(`ما أسباب الفجوة عن المخطط لدى ${A.ar}، وهل يلزم أي إجراء قبل النظر في تدابير تصحيحية؟`, `What explains the gap to plan at ${A.en}, and is any step needed before corrective measures are considered?`),
        what: T((ar) => (ar ? `المحصّل ${$(e.collected, true)} حتى ${PL.reportingDate} مقابل ${$(e.plannedToDate, true)} مخططاً حتى التاريخ نفسه، أي أقل بمبلغ ${$(gap, true)} (${pc(shortfall)} من المخطط حتى تاريخه).` : `Collected ${$(e.collected, false)} to ${PL.reportingDate} against ${$(e.plannedToDate, false)} planned to the same date — ${$(gap, false)} below (${pc(shortfall)} of the plan to date).`)),
        measure: { kind: 'gap', label: bi('الفجوة عن المخطط حتى تاريخه', 'Gap to the plan to date'), amount: gap, basis: bi('المخطط حتى تاريخ التقرير − المحصّل حتى التاريخ نفسه', 'Planned to the reporting date − collected to the same date') },
        comparison: { basis: basisPlan, values: [{ label: bi('المخطط حتى تاريخه', 'Planned to date'), value: e.plannedToDate, unit: 'SAR' }, { label: bi('المحصّل حتى تاريخه', 'Collected to date'), value: e.collected, unit: 'SAR' }, { label: bi('مستهدف الخطة (منفصل)', 'Plan target (shown separately)'), value: e.target, unit: 'SAR' }] },
        facts: [{ ...T((ar) => (ar ? `مستهدف الخطة ${$(e.target, true)}؛ المخطط حتى تاريخ التقرير ${$(e.plannedToDate, true)}؛ المحصّل ${$(e.collected, true)} (حسب تاريخ الدفع، من ${periodPlan.from}).${srcAr ? ` المصدر: ${srcAr}.` : ''}${e.municipalTotal || PL.restricted ? ' النطاق: إجمالي الجهات المتاحة لك.' : ''}` : `Plan target ${$(e.target, false)}; planned to the reporting date ${$(e.plannedToDate, false)}; collected ${$(e.collected, false)} (payment-date basis, from ${periodPlan.from}).${srcEn ? ` Source: ${srcEn}.` : ''}${e.municipalTotal || PL.restricted ? ' Scope: total of the entities available to you.' : ''}`)), evidence: 'source_record' }],
        calculated: [
          { label: bi('الفجوة عن المخطط حتى تاريخه', 'Gap to the plan to date'), value: gap, unit: 'SAR', formula: bi('المخطط حتى تاريخه − المحصّل', 'Planned to date − collected') },
          { label: bi('نسبة المحقَّق من المخطط حتى تاريخه', 'Achievement of the plan to date'), value: ach, unit: 'pct', formula: bi('المحصّل ÷ المخطط حتى تاريخه', 'Collected ÷ planned to date') },
          { label: bi('الفجوة كنسبة من مستهدف الخطة', 'Gap as a share of the plan target'), value: ofAnnual, unit: 'pct', formula: bi('الفجوة ÷ مستهدف الخطة', 'Gap ÷ plan target') },
          ...(extra.calculated || [])
        ],
        unknown: [bi('سبب التحصيل دون المخطط غير مسجَّل في البيانات؛ الفجوة نتيجة حسابية وليست تفسيراً (قد تعود إلى حجم الفوترة أو توقيت السداد أو توزيع المخطط على الأشهر).', 'The reason collection is below plan is not recorded; the gap is a calculated deviation, not an explanation (it may relate to billing volume, payment timing or how the plan is phased).')],
        proposed: [
          bi('ابحث في سبب الفجوة قبل النظر في أي تدبير: قارن الفوترة والتحصيل شهرياً للجهة وراجع متأخراتها.', 'Investigate the reason for the gap before any measure is considered: compare monthly billing and collection for the entity and review its overdue balances.'),
          bi(`تحقق من أن المخطط التراكمي المستعمل في المقارنة هو مخطط الخطة المرجعية المذكورة${srcAr ? ` (${srcAr})` : ''}.`, `Check that the cumulative plan used in the comparison is the one of the reference plan named${srcEn ? ` (${srcEn})` : ''}.`)
        ],
        options: [
          { title: bi('بحث الأسباب أولاً', 'Investigate the causes first'), implication: bi('لا يتغيّر المخطط ولا المستهدف؛ تُحدَّد أسباب الفجوة بالبيانات قبل أي خطوة تالية.', 'The plan and the target do not change; the causes are established from the data before any next step.') },
          { title: bi('مراجعة خطة التحصيل للجهة بعد معرفة الأسباب', 'Review the entity’s collection actions once the causes are known'), implication: bi('أي تغيير في الخطط أو المستهدفات يتم في صفحة «خطط الإيرادات» خارج هذه الصفحة؛ ولا شيء يُنفَّذ هنا.', 'Any change to plans or targets is made on the revenue plans page, outside this page; nothing is executed here.') }
        ],
        evidence: [{ label: bi('الخطة المرجعية (المستهدف والمحصّل)', 'The reference plan (target and collected)'), to: planSrc?.planId ? `/planning/${planSrc.planId}` : '/planning', status: 'source_record' }, ...(extra.evidence || [])],
        missing: [bi('أسباب الفجوة (غير مسجَّلة)', 'Reasons for the gap (not recorded)')],
        priority: priorityOf([factor('shortfall', bi('الفجوة من المخطط حتى تاريخه', 'Gap as a share of the plan to date'), shortfall, 'pct', bi(pc(shortfall), pc(shortfall)), G.planShortfall), factor('of_annual', bi('الفجوة من مستهدف الخطة', 'Gap as a share of the plan target'), ofAnnual, 'pct', bi(pc(ofAnnual), pc(ofAnnual)), G.planOfAnnual)]), verification: 'verified'
      };
    };
    const M = PL.ministry; const gapAll = M ? M.plannedToDate - M.collected : 0;
    const scopeAll = !sl; // the Ministry-level comparison describes all entities in view, so only when no Amanah filter narrows the scope
    if (M && scopeAll && M.plannedToDate > 0 && gapAll > 0 && gapAll / M.plannedToDate >= th.planShortfallMin) {
      const need = M.requiredMonthly; // day-based (the plan basis): the remaining target ÷ the months still ahead by days — none once the period has ended
      add(mkPlan('plan:ministry', bi('الوزارة (كل الجهات المعروضة)', 'The Ministry (all entities in view)'), { target: M.target, collected: M.collected, plannedToDate: M.plannedToDate }, {
        calculated: [
          ...(need != null ? [{ label: bi('المعدل الشهري المطلوب لبلوغ مستهدف الخطة', 'Monthly pace needed to reach the plan target'), value: need, unit: 'SAR', formula: bi('(مستهدف الخطة − المحصّل) ÷ الأشهر المتبقية محسوبة بالأيام', '(Plan target − collected) ÷ the months left, counted by days') }, ...(M.avg != null ? [{ label: bi('المعدل الشهري الحالي (متوسط آخر 3 أشهر مكتملة)', 'Current monthly pace (last-3-complete-month average)'), value: M.avg, unit: 'SAR', formula: bi('متوسط التحصيل الشهري لآخر 3 أشهر مكتملة', 'Average monthly collection of the last 3 complete months') }] : [])] : []),
          ...(M.forecast != null ? [{ label: bi('تقدير نهاية الفترة (توضيحي، متوسط آخر 3 أشهر مكتملة + المتبقي من الشهر)', 'End-of-period estimate (illustrative, last-3-complete-month average + the rest of the month)'), value: M.forecast, unit: 'SAR', formula: bi('تقدير تجريبي للعرض وليس نموذجاً معتمداً؛ يختلف عن المحصّل الفعلي', 'A demonstration estimate, not an approved model; distinct from what was actually collected') }] : [])
        ]
      }), { fam: 'plan', am: null });
    }
    (PL.entities || []).filter((e) => okA(e.key) && (!sl || sl.includes(e.key))).map((e) => ({ ...e, gap: e.plannedToDate - e.collected }))
      .filter((e) => e.plannedToDate > 0 && e.gap > 0 && e.gap / e.plannedToDate >= th.planShortfallMin).sort((a, b) => b.gap - a.gap).slice(0, th.maxPlanEntities).forEach((e) => {
        add(mkPlan(`plan:${e.key}`, labels.amanah(e.key), e, { evidence: [{ label: bi('متأخرات الجهة', 'The entity’s overdue'), to: link('/collection', { amanah: e.key, category: 'overdue' }), status: 'source_record' }] }), { fam: 'plan', am: [e.key] });
        const it = items.find((x) => x.key === `plan:${e.key}`); if (it) it.affected = { amanah: e.key, label: labels.amanah(e.key) }; // the plan (annual target) exists per entity, not per municipality
      });
    const minI = items.find((x) => x.key === 'plan:ministry'); if (minI) minI.affected = { label: bi('الوزارة (كل الجهات المعروضة)', 'The Ministry (all entities in view)') };
  }

  /* ---- 4. investment installments due without a verified invoice link (a PROPOSED rule over a GENERATED schedule — never a finding from the Furas extract) */
  const C = inp.contracts;
  if (C?.unlinkedInstallments > 0) {
    const amt = C.unlinkedAmount > 0 ? C.unlinkedAmount : null;
    add({
      key: 'contracts:unlinked', kind: 'review', category: 'installments_unlinked', periodBasis: 'standing', period: { from: null, to: cutoff },
      title: bi(`أقساط استحق موعدها بلا فاتورة مرتبطة موثَّقة (${PROPOSED_RULE.ar})`, `Installments due without a verified invoice link (${PROPOSED_RULE.en})`),
      question: bi('هل تتطابق هذه الأقساط مع سجلات العقود المؤكدة في «فرص» وهل أُصدرت لها فواتير؟', 'Do these installments match confirmed Furas contract records, and were invoices issued for them?'),
      what: bi(UNLINKED_RULE.statement.ar, UNLINKED_RULE.statement.en),
      affected: scopeAf(),
      measure: amt != null ? { kind: 'amount', label: bi('قيمة الأقساط المستحقة بلا فاتورة مرتبطة (جدول مُولَّد)', 'Value of installments due with no linked invoice (generated schedule)'), amount: amt, basis: bi('جدول عقود مُولَّد، قاعدة مقترحة غير معتمدة', 'Generated contract schedule, proposed unapproved rule') }
        : { kind: 'count', label: bi('أقساط مستحقة بلا فاتورة مرتبطة (جدول مُولَّد)', 'Installments due with no linked invoice (generated schedule)'), count: C.unlinkedInstallments, basis: bi('جدول عقود مُولَّد، قاعدة مقترحة غير معتمدة', 'Generated contract schedule, proposed unapproved rule') },
      comparison: { basis: bi('أقساط الجدول المُولَّد المستحقة مقابل الفواتير المرتبطة بعقودها في السجل المُولَّد', 'Due installments of the generated schedule against the invoices linked to their contracts in the generated ledger'), values: [{ label: bi('أقساط بلا فاتورة مرتبطة', 'Installments with no linked invoice'), value: C.unlinkedInstallments, unit: 'count' }, { label: bi('العقود المشمولة', 'Contracts covered'), value: C.count ?? null, unit: 'count' }] },
      facts: [
        { ...T((ar) => (ar ? `الجدول والسجل المستخدمان مُولَّدان للعرض؛ لا يُعدّ ما يظهر هنا نتيجة من مستخرج «فرص».` : `The schedule and ledger used here are generated for the demonstration; nothing here is a finding from the Furas extract.`)), evidence: 'unverified' },
        ...(C.overdueInstallments > 0 ? [{ ...T((ar) => (ar ? `للسياق فقط: في الجدول نفسه ${num(C.overdueInstallments)} قسطاً فُوتر وفات موعد سداده ولم يُسدَّد${C.arrears > 0 ? ` (${$(C.arrears, true)})`: ''}؛ وهو غير محتسب في مبلغ هذا البند.` : `For context only: the same schedule has ${num(C.overdueInstallments)} installments invoiced, past their due date and unpaid${C.arrears > 0 ? ` (${$(C.arrears, false)})` : ''}; it is not part of this item’s amount.`)), evidence: 'unverified' }] : [])
      ],
      calculated: [{ label: bi('أقساط مستحقة بلا فاتورة مرتبطة', 'Installments due with no linked invoice'), value: C.unlinkedInstallments, unit: 'count', formula: bi(PROPOSED_RULES.due_no_invoice_linked.statement.ar, PROPOSED_RULES.due_no_invoice_linked.statement.en) }, ...(amt != null ? [{ label: bi('قيمتها', 'Their value'), value: amt, unit: 'SAR', formula: bi('مجموع مبالغ هذه الأقساط في الجدول المُولَّد', 'Sum of these installments’ amounts in the generated schedule') }] : [])],
      unknown: [bi(`سبب غياب الفاتورة المرتبطة غير مسجَّل: قد لا تكون أُصدرت، أو أُصدرت برقم عقد غير مطابق، أو أن الجدول المُولَّد لا يطابق الواقع. ${NOT_AVAILABLE.ar}.`, `The reason no invoice is linked is not recorded: it may not have been issued, may carry a different contract number, or the generated schedule may differ from reality. ${NOT_AVAILABLE.en}.`)],
      proposed: [
        bi('راجع هذه الأقساط مقابل سجلات العقود المؤكدة في «فرص» قبل اعتبار أي منها نتيجة.', 'Review these installments against confirmed Furas contract records before treating any of them as a finding.'),
        bi('اتفقوا على قاعدة الاستحقاق وفترة السماح، وتحققوا من المتطلبات المسبقة قبل رفع أي قسط للمتابعة.', 'Agree the due-date and grace rule, and check the prerequisites before raising any installment for follow-up.')
      ],
      evidence: [{ label: bi('العقود الاستثمارية', 'Investment contracts'), to: '/contracts', count: C.unlinkedInstallments, status: 'unverified' }],
      missing: UNLINKED_RULE.prerequisites.map((p) => bi(`${p.ar} — ${NOT_AVAILABLE.ar}`, `${p.en} — ${NOT_AVAILABLE.en}`)),
      priority: priorityOf([factor('value', bi('قيمة الأقساط من صافي المفوتر', 'Value as a share of net invoiced'), amt != null ? div(amt, net) : null, 'pct', bi(amt != null ? pc(div(amt, net)) : 'غير متاح', amt != null ? pc(div(amt, net)) : 'not available'), G.valueOfNet), factor('count', bi('عدد الأقساط', 'Installments'), C.unlinkedInstallments, 'count', bi(num(C.unlinkedInstallments), num(C.unlinkedInstallments)), G.installmentCount)], { needsVerification: true }),
      verification: 'needs_verification'
    }, { fam: 'ctr' });
  }
  if (inp.noContractCount > 0) {
    add({
      key: 'contracts:no_contract', kind: 'clarification', category: 'installments_unlinked', periodBasis: 'selected',
      title: bi('فواتير استثمار مركزية بلا عقد مطابق', 'Central investment invoices with no matched contract'),
      question: bi('هل لهذه الفواتير عقود في سجلات «فرص»؟', 'Do these invoices have contracts in the Furas records?'),
      what: bi('فواتير استثمارية مركزية لا يوجد لها عقد بالرقم نفسه في بيانات العقود. المطابقة بالرقم وحده؛ وغياب المطابقة ليس دليلاً على عدم وجود عقد.', 'Central investment invoices with no contract of the same number in the contract data. The match is by number alone; no match is not proof that no contract exists.'),
      affected: { ...scopeAf(), source: 'investment', label: oneAmanah ? T((ar) => `${scopeLabel[ar ? 'ar' : 'en']} — ${labels.source('investment')[ar ? 'ar' : 'en']}`) : labels.source('investment') },
      measure: { kind: 'count', label: bi('فواتير بلا عقد مطابق', 'Invoices with no matched contract'), count: inp.noContractCount, basis: bi('مطابقة رقم العقد فقط', 'Contract-number match only') },
      comparison: { basis: bi('فواتير الاستثمار المركزية مقابل أرقام العقود في بيانات العقود', 'Central investment invoices against the contract numbers in the contract data'), values: [{ label: bi('فواتير بلا عقد مطابق', 'Invoices with no matched contract'), value: inp.noContractCount, unit: 'count' }] },
      facts: [{ ...T((ar) => (ar ? `${num(inp.noContractCount)} فاتورة استثمارية لا يطابق رقم عقدها أي عقد في بيانات العقود.` : `${num(inp.noContractCount)} investment invoices whose contract number matches no contract in the contract data.`)), evidence: 'source_record' }],
      calculated: [],
      unknown: [bi('هل يوجد عقد برقم مختلف أو غير مسجَّل غير معروف؛ ولا يُستبعد شيء من الصافي إلا بتأكيد مكتوب من مالك البيانات.', 'Whether a contract exists under a different or unregistered number is unknown; nothing is excluded from net without written confirmation from the data owner.')],
      proposed: [bi('اطلب من مالك البيانات تأكيد وجود عقد لكل فاتورة من هذه الفواتير.', 'Ask the data owner to confirm whether a contract exists for each of these invoices.')],
      evidence: [{ label: bi('قائمة فواتير الاستثمار', 'Investment invoice list'), to: link('/invoices', { ...scopeParams, src: 'investment' }), count: inp.noContractCount, status: 'source_record' }],
      missing: [bi('رقم العقد المطابق (غير متاح لهذه الفواتير)', 'The matching contract number (not available for these invoices)')],
      priority: priorityOf([factor('count', bi('عدد الفواتير', 'Invoices'), inp.noContractCount, 'count', bi(num(inp.noContractCount), num(inp.noContractCount)), G.recordCount)], { needsVerification: true }), verification: 'needs_verification'
    }, { fam: 'inv', part: 'data', am: null, src: ['investment'] });
  }

  /* ---- 5. enforcement and invoice relationships */
  const O = inp.orders;
  if (O?.suspendedCount > 0) {
    const amt = O.suspendedAmount > 0 ? O.suspendedAmount : null;
    add({
      key: 'orders:suspended', kind: 'review', category: 'enforcement_links', periodBasis: 'standing', period: { from: null, to: cutoff },
      title: bi('أوامر تنفيذ موقوفة', 'Suspended enforcement orders'),
      question: bi('ما سبب إيقاف هذه الأوامر، وهل ما زالت الفواتير المرتبطة بها مفتوحة؟', 'Why are these orders suspended, and are the invoices linked to them still open?'),
      what: T((ar) => (ar ? `${num(O.suspendedCount)} أمر تنفيذ حالته «موقوف»${amt ? ` بقيمة ${$(amt, true)}` : ''}؛ سبب الإيقاف غير متوفر في بيانات الأمر.` : `${num(O.suspendedCount)} enforcement orders are in the «suspended» state${amt ? `, worth ${$(amt, false)}` : ''}; the reason for the suspension is not in the order data.`)),
      affected: scopeAf(),
      measure: amt != null ? { kind: 'exposure', label: bi('قيمة الأوامر الموقوفة', 'Value of suspended orders'), amount: amt, basis: bi('قيمة الأمر كما في بيانات أوامر التنفيذ', 'Order value as in the enforcement-order data') } : { kind: 'count', label: bi('أوامر موقوفة', 'Suspended orders'), count: O.suspendedCount, basis: bi('حالة الأمر في بيانات التنفيذ', 'Order state in the enforcement data') },
      comparison: { basis: bi('الأوامر الموقوفة ضمن نطاق الجهات المعروضة', 'Suspended orders within the entities in view'), values: [{ label: bi('أوامر موقوفة', 'Suspended orders'), value: O.suspendedCount, unit: 'count' }] },
      facts: [{ ...T((ar) => (ar ? `حالة ${num(O.suspendedCount)} أمراً في بيانات التنفيذ «موقوف»؛ لا يوجد تاريخ آخر تحديث، فلا يعني «موقوف» هنا أكثر من الحالة نفسها.` : `${num(O.suspendedCount)} orders are «suspended» in the enforcement data; there is no last-update date, so «suspended» here means the state only.`)), evidence: 'source_record' }],
      calculated: [],
      unknown: [bi('سبب الإيقاف غير متوفر في بيانات الأمر.', 'The reason for the suspension is not in the order data.'), bi('لا يُعرف من هذه البيانات هل الفواتير المرتبطة ما زالت مفتوحة.', 'These data do not show whether the linked invoices are still open.')],
      proposed: [bi('راجع كل أمر موقوف في مساحة الإنفاذ وتحقق من سبب الإيقاف المذكور في مستنداته.', 'Review each suspended order in the enforcement workspace and check the reason for the suspension stated in its documents.'), bi('تحقق من حالة الفواتير المرتبطة بكل أمر قبل أي خطوة.', 'Check the state of the invoices linked to each order before any step.')],
      evidence: [{ label: bi('الأوامر في مساحة الإنفاذ', 'Orders in the enforcement workspace'), to: ordersListPath, count: O.suspendedCount, status: 'source_record' }, ...(O.suspendedNums || []).slice(0, 3).map((n) => ({ label: bi(`الأمر ${n}`, `Order ${n}`), to: orderPath(n), status: 'source_record' }))],
      missing: [bi('سبب الإيقاف وتاريخ آخر تحديث (غير متوفرين)', 'The reason for the suspension and the last-update date (not available)')],
      priority: priorityOf([factor('value', bi('قيمة الأوامر من صافي المفوتر', 'Order value as a share of net invoiced'), amt != null ? div(amt, net) : null, 'pct', bi(amt != null ? pc(div(amt, net)) : 'غير متاح', amt != null ? pc(div(amt, net)) : 'not available'), G.valueOfNet), factor('count', bi('عدد الأوامر', 'Orders'), O.suspendedCount, 'count', bi(num(O.suspendedCount), num(O.suspendedCount)), G.orderCount)]), verification: 'verified'
    }, { fam: 'ord', am: O.amanahs || null });
  }
  if ((O?.proposedLinks || 0) + (O?.unresolvedRefs || 0) > 0) {
    const pl = O.proposedLinks || 0; const ur = O.unresolvedRefs || 0; const n = pl + ur;
    add({
      key: 'orders:links', kind: 'review', category: 'enforcement_links', periodBasis: 'standing', period: { from: null, to: cutoff },
      title: bi('علاقات أوامر التنفيذ بالفواتير غير المحسومة', 'Unresolved relationships between enforcement orders and invoices'),
      question: bi('أي الروابط المقترحة والمراجع غير المحسومة تحتاج تحققاً من المستندات؟', 'Which proposed links and unresolved references need checking against the documents?'),
      what: T((ar) => (ar ? `${num(pl)} رابطاً مقترحاً بين أمر وفاتورة بانتظار المراجعة${ur ? `، و${num(ur)} مرجعاً لفاتورة في الأوامر لم يُحسم` : ''}. الرابط المقترح ليس مؤكداً ولا يغيّر أي مبلغ.` : `${num(pl)} proposed order-to-invoice links await review${ur ? `, and ${num(ur)} invoice references in orders are unresolved` : ''}. A proposed link is not confirmed and changes no amount.`)),
      affected: scopeAf(),
      measure: { kind: 'count', label: bi('روابط ومراجع غير محسومة', 'Unresolved links and references'), count: n, basis: bi('أوامر التنفيذ في النطاق المعروض', 'Enforcement orders in the entities in view') },
      comparison: { basis: bi('روابط مقترحة ومراجع غير محسومة لدى الأوامر في النطاق', 'Proposed links and unresolved references across the orders in scope'), values: [{ label: bi('روابط مقترحة', 'Proposed links'), value: pl, unit: 'count' }, { label: bi('مراجع غير محسومة', 'Unresolved references'), value: ur, unit: 'count' }] },
      facts: [{ ...T((ar) => (ar ? `${num(O.proposedLinkOrders || 0)} أمراً لديها روابط مقترحة${ur ? `، و${num(O.unresolvedRefOrders || 0)} أمراً لديها مراجع غير محسومة` : ''}.` : `${num(O.proposedLinkOrders || 0)} orders have proposed links${ur ? `, and ${num(O.unresolvedRefOrders || 0)} orders have unresolved references` : ''}.`)), evidence: 'source_record' }],
      calculated: [],
      unknown: [bi('لا يُعرف قبل المراجعة هل الروابط المقترحة صحيحة؛ الاقتراح يعتمد على مراجع في الأمر أو مستنداته وحدها.', 'It is not known before review whether the proposed links are right; a proposal rests only on references in the order or its documents.')],
      proposed: [bi('تحقق من كل رابط مقترح مقابل مستند الأمر ومفتاح الفاتورة المركّب (الرقم + رمز الحساب + الأمانة) قبل تأكيده.', 'Verify each proposed link against the order document and the invoice composite key (number + GFS + Amanah) before confirming it.'), bi('أدرج قراراً موثَّقاً لكل مرجع غير محسوم (ربط أو استبعاد) في مساحة الإنفاذ.', 'Record a documented decision (link or dismiss) for each unresolved reference in the enforcement workspace.')],
      evidence: [{ label: bi('الأوامر في مساحة الإنفاذ', 'Orders in the enforcement workspace'), to: ordersListPath, count: O.proposedLinkOrders || undefined, status: 'unverified' }, ...(O.linkNums || []).slice(0, 3).map((x) => ({ label: bi(`الأمر ${x}`, `Order ${x}`), to: orderPath(x), status: 'unverified' }))],
      missing: [bi('تأكيد الروابط المقترحة بمستند أو مفتاح فاتورة مركّب', 'Confirmation of the proposed links by a document or a composite invoice key')],
      priority: priorityOf([factor('count', bi('روابط ومراجع غير محسومة', 'Unresolved links and references'), n, 'count', bi(num(n), num(n)), G.recordCount)], { needsVerification: true }), verification: 'needs_verification'
    }, { fam: 'ord', am: O.amanahs || null });
  }

  /* ---- 6. material data conflicts (clarifications) */
  const D = inp.matching;
  if (D?.amountConflicts > 0) {
    const amt = D.conflictAmount > 0 ? D.conflictAmount : null; const ids = (D.conflictIds || []).slice(0, 5);
    add({
      key: 'data:amount_conflicts', kind: 'clarification', category: 'data_conflicts', periodBasis: 'selected',
      title: bi('تعارض بين مبلغ الفاتورة ومجموع بنودها', 'Invoice amount conflicts with the sum of its lines'),
      question: bi('أي المبلغين هو الصحيح لكل فاتورة متعارضة؟', 'Which amount is correct for each conflicting invoice?'),
      what: T((ar) => (ar ? `${num(D.amountConflicts)} فاتورة مبلغ ترويستها لا يساوي مجموع بنودها${amt ? ` (فرق مبالغ يبلغ ${$(amt, true)})` : ''}؛ فلا يُعرف أيهما الصحيح.` : `${num(D.amountConflicts)} invoices have a header amount that differs from the sum of their lines${amt ? ` (amounts at stake ${$(amt, false)})` : ''}, so which is right is unknown.`)),
      affected: scopeAf(),
      measure: amt != null ? { kind: 'amount', label: bi('المبلغ محل التعارض', 'Amount at stake in the conflicts'), amount: amt, basis: bi('فواتير الفترة المختارة التي يتعارض فيها المبلغ مع البنود', 'Invoices of the selected period whose amount conflicts with the lines') } : { kind: 'count', label: bi('فواتير متعارضة', 'Conflicting invoices'), count: D.amountConflicts, basis: bi('فواتير الفترة المختارة', 'Invoices of the selected period') },
      comparison: { basis: bi('مبلغ الترويسة مقابل مجموع البنود لكل فاتورة', 'Header amount against the sum of the lines, per invoice'), values: [{ label: bi('فواتير متعارضة', 'Conflicting invoices'), value: D.amountConflicts, unit: 'count' }, ...(amt != null ? [{ label: bi('المبلغ محل التعارض', 'Amount at stake'), value: amt, unit: 'SAR' }] : [])] },
      facts: [{ ...T((ar) => (ar ? `اختلاف حسابي بين الترويسة والبنود في بيانات المصدر لـ ${num(D.amountConflicts)} فاتورة.` : `An arithmetic difference between header and lines in the source data for ${num(D.amountConflicts)} invoices.`)), evidence: 'source_record' }],
      calculated: amt != null ? [{ label: bi('المبلغ محل التعارض', 'Amount at stake'), value: amt, unit: 'SAR', formula: bi('مجموع الفروق بين الترويسة والبنود للفواتير المتعارضة', 'Sum of the differences between header and lines for the conflicting invoices') }] : [],
      unknown: [bi('لا يُعرف أي المبلغين يعكس الواقع؛ ولا يصحّ الاعتماد على أرقام هذه الفواتير في قرار مالي قبل حسم الفرق.', 'It is not known which amount reflects reality; figures from these invoices should not support a financial decision before the difference is settled.')],
      proposed: [bi('اطلب من مالك البيانات تصحيح أو تأكيد المبلغ لكل فاتورة قبل الاعتماد على أرقامها.', 'Ask the data owner to correct or confirm the amount for each invoice before relying on its figures.'), bi('فرِّق بين الفواتير بمفتاحها المركّب عند الطلب (الرقم + رمز الحساب + الأمانة).', 'Identify the invoices by their composite key (number + GFS + Amanah) when raising the request.')],
      evidence: [...ids.map((id) => ({ label: bi(`الفاتورة ${id}`, `Invoice ${id}`), to: invoicePath(id), status: 'source_record' })), { label: bi('قائمة الفواتير', 'Invoice list'), to: link('/invoices', scopeParams), count: D.amountConflicts, status: 'source_record' }],
      missing: [bi('المبلغ الصحيح لكل فاتورة (غير متاح حتى يؤكده مالك البيانات)', 'The correct amount per invoice (not available until the data owner confirms)')],
      priority: priorityOf([factor('value', bi('المبلغ محل التعارض من صافي المفوتر', 'Amount at stake as a share of net invoiced'), amt != null ? div(amt, net) : null, 'pct', bi(amt != null ? pc(div(amt, net)) : 'غير متاح', amt != null ? pc(div(amt, net)) : 'not available'), G.conflictOfNet), factor('count', bi('فواتير متعارضة', 'Conflicting invoices'), D.amountConflicts, 'count', bi(num(D.amountConflicts), num(D.amountConflicts)), G.recordCount)], { needsVerification: true }), verification: 'needs_verification'
    }, { fam: 'inv', part: 'data', am: null, src: null });
  }
  if (D?.missingFields > 0) {
    const ids = (D.missingIds || []).slice(0, 5);
    add({
      key: 'data:missing_fields', kind: 'clarification', category: 'data_conflicts', periodBasis: 'selected',
      title: bi('حقول إلزامية ناقصة في فواتير', 'Mandatory fields missing in invoices'),
      question: bi('أي حقول يلزم استكمالها من المصدر ليتسنى الربط والإحالة؟', 'Which fields must be completed at the source so matching and referral can proceed?'),
      what: T((ar) => (ar ? `${num(D.missingFields)} فاتورة تفتقد حقلاً لازماً للإحالة أو المطابقة.` : `${num(D.missingFields)} invoices lack a field needed for referral or matching.`)),
      affected: scopeAf(),
      measure: { kind: 'count', label: bi('فواتير ناقصة الحقول', 'Invoices with missing fields'), count: D.missingFields, basis: bi('فواتير الفترة المختارة', 'Invoices of the selected period') },
      comparison: { basis: bi('الحقول الإلزامية الموجودة مقابل المطلوبة', 'Mandatory fields present against required'), values: [{ label: bi('فواتير ناقصة الحقول', 'Invoices with missing fields'), value: D.missingFields, unit: 'count' }] },
      facts: [{ ...T((ar) => (ar ? `الحقل غير موجود في بيانات المصدر لـ ${num(D.missingFields)} فاتورة.` : `The field is absent from the source data for ${num(D.missingFields)} invoices.`)), evidence: 'source_record' }],
      calculated: [],
      unknown: [bi('لا يُعرف هل الحقل غير مسجَّل في المصدر أم فُقد أثناء النقل.', 'It is not known whether the field was never recorded at the source or was lost in transfer.')],
      proposed: [bi('استكمل الحقول من مصدرها عبر مالك البيانات قبل الاعتماد على هذه الفواتير في الربط أو الإحالة.', 'Have the data owner complete the fields at the source before these invoices are used for matching or referral.')],
      evidence: [...ids.map((id) => ({ label: bi(`الفاتورة ${id}`, `Invoice ${id}`), to: invoicePath(id), status: 'source_record' })), { label: bi('قائمة الفواتير', 'Invoice list'), to: link('/invoices', scopeParams), count: D.missingFields, status: 'source_record' }],
      missing: [bi('قيمة الحقل الناقص (غير متاحة)', 'The missing field value (not available)')],
      priority: priorityOf([factor('count', bi('فواتير ناقصة الحقول', 'Invoices with missing fields'), D.missingFields, 'count', bi(num(D.missingFields), num(D.missingFields)), G.missingCount)], { needsVerification: true }), verification: 'needs_verification'
    }, { fam: 'inv', part: 'data', am: null, src: null });
  }

  disclose(items, pops);
  items.sort((a, b) => LEVEL_RANK[a.priority.level] - LEVEL_RANK[b.priority.level] || (b.measure.amount ?? -1) - (a.measure.amount ?? -1) || (b.measure.count ?? -1) - (a.measure.count ?? -1) || (a.key < b.key ? -1 : 1));
  return { items, context: { totalOverdue, totalNotDue, uncollected: S.totals?.outstanding ?? null, net, agedTotal: totalAged, cutoff, period,
    plan: inp.plan ? (inp.plan.available === false ? { available: false, state: inp.plan.state, notice: inp.plan.notice, reason: inp.plan.reason ?? null, candidates: inp.plan.candidates ?? null, source: inp.plan.source ?? null, link: inp.plan.link || '/planning' } : { available: true, state: inp.plan.state, source: inp.plan.source ?? null, period: inp.plan.period ?? null, reportingDate: inp.plan.reportingDate, restricted: !!inp.plan.restricted }) : null } };
}

/* ---------------- overlap disclosure: items that count the same population say so (the amounts must not be added) ---------------- */
const meet = (a, b) => a == null || b == null || a.some((x) => b.includes(x));
function overlapNote(A, B) {
  if (A.fam === 'ctr' || B.fam === 'ctr') return null; // installments of a generated schedule have no invoice: a different population
  if (A.fam === 'inv' && B.fam === 'inv') {
    if (A.part && A.part === B.part && A.part !== 'data') return null; // two Amanah items (or two source items) are disjoint by construction
    if (!meet(A.am, B.am) || !meet(A.src, B.src)) return null;
    return bi('يعدّ الفواتير غير المسدّدة نفسها في الفترة نفسها؛ لا تُجمع المبالغ.', 'Counts the same unpaid invoices of the same period; the amounts must not be added.');
  }
  const [p, q] = A.fam === 'plan' ? [A, B] : B.fam === 'plan' ? [B, A] : [null, null];
  if (p && q.fam === 'inv') return meet(p.am, q.am) ? bi('يخصّ الجهة نفسها لكن بأساس مختلف (مبالغ محصّلة حسب تاريخ الدفع مقابل فواتير غير مسدّدة)؛ لا تُجمع المبالغ.', 'Concerns the same entity on a different basis (payments received by payment date versus unpaid invoices); the amounts must not be added.') : null;
  const [o, r] = A.fam === 'ord' ? [A, B] : B.fam === 'ord' ? [B, A] : [null, null];
  if (o && r.fam === 'inv') return r.part === 'data' ? null : meet(o.am, r.am) ? bi('قد تشمل الأوامر فواتير هي نفسها ضمن المتأخر؛ لا تُجمع المبالغ.', 'The orders may cover invoices that are also in the overdue balance; the amounts must not be added.') : null;
  return null;
}
function disclose(items, pops) {
  for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
    const a = items[i]; const b = items[j]; const note = overlapNote(pops.get(a.key), pops.get(b.key)); if (!note) continue;
    a.overlap.push({ with: b.key, note }); b.overlap.push({ with: a.key, note });
  }
}

/* ---------------- filters, follow-up state, summary ---------------- */
/** the filter the page and the chart marks apply: { category, amanah, source, kind, priority, flag } — 'all' / undefined = no filter */
export function filterItems(items, f = {}) {
  const all = (v) => v == null || v === 'all' || v === '';
  return items.filter((i) => (all(f.category) || i.category === f.category) && (all(f.amanah) || i.affected?.amanah === f.amanah) && (all(f.source) || i.affected?.source === f.source)
    && (all(f.kind) || i.kind === f.kind) && (all(f.priority) || i.priority.level === f.priority) && (all(f.flag) || (i.followUp?.flag || 'none') === f.flag));
}
/** items with their stored follow-up. The condition of the issue is NOT touched: a followed-up item whose issue is still open stays open. */
export function withState(items, store) {
  return items.map((i) => { const st = store?.items?.[i.key]; return { ...i, followUp: { flag: st?.flag || 'none', note: st?.note ?? null, history: st?.history || [], lastBy: st?.history?.length ? st.history[st.history.length - 1].by : null, lastAt: st?.history?.length ? st.history[st.history.length - 1].at : null } }; });
}

const FINANCIAL = new Set(['exposure', 'gap', 'overdue', 'amount']);
/** the strip: open financial issues · flagged for follow-up · needing evidence verification; a financial total ONLY when the additive populations are disjoint */
export function summaryOf(items, context = null) {
  const open = items.filter((i) => i.condition?.open !== false);
  const additive = open.filter((i) => i.additive && i.measure?.amount != null);
  const keys = new Set(additive.map((i) => i.key)); const clash = additive.find((i) => i.overlap.some((o) => keys.has(o.with)));
  let financialTotal = null; let financialTotalReason = null;
  if (!additive.length) financialTotalReason = bi('لا توجد بنود مبالغها قابلة للجمع دون ازدواج.', 'No items have amounts that can be added without double counting.');
  else if (clash) financialTotalReason = bi('بعض البنود تعدّ الفئة نفسها من الفواتير، فلا يُعرض إجمالي.', 'Some items count the same invoices, so no total is shown.');
  else financialTotal = { amount: additive.reduce((t, i) => t + i.measure.amount, 0), label: bi('المتأخر غير المسدّد للجهات المعروضة', 'Unpaid overdue of the entities shown'), basis: bi('فواتير الفترة المختارة، المتأخر عن الاستحقاق حتى القطع؛ تجمع الأمانات دون ازدواج', 'Invoices of the selected period, past due at the cutoff; the entities add up without double counting'), itemKeys: additive.map((i) => i.key), scopeTotal: context?.totalOverdue ?? null };
  const overlapping = open.filter((i) => i.overlap.length);
  return {
    total: items.length, open: open.length,
    openFinancialIssues: open.filter((i) => FINANCIAL.has(i.measure?.kind)).length,
    flagged: items.filter((i) => i.followUp?.flag === 'flagged').length,
    followedUp: items.filter((i) => i.followUp?.flag === 'followed_up').length,
    needsVerification: open.filter((i) => i.verification === 'needs_verification').length,
    financialTotal, financialTotalReason,
    overlapNote: !overlapping.length ? null : financialTotal
      ? bi('بعض البنود تعدّ الفواتير نفسها (الإفصاح في كل بند)؛ لذلك يُجمع المتأخر حسب الجهة وحده (لا ازدواج فيه) ولا تُجمع مبالغ باقي البنود.', 'Some items count the same invoices (disclosed on each item), so only the overdue by entity is totalled (it has no double counting) and the other item amounts are not added.')
      : bi('بعض البنود تعدّ الفواتير نفسها (الإفصاح في كل بند)، لذلك لا تُجمع مبالغ البنود ولا يُعرض إجمالي عام.', 'Some items count the same invoices (disclosed on each item), so item amounts are not added and no overall total is shown.')
  };
}
