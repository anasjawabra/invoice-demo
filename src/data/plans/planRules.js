// PLAN RULES — the pure rules of revenue plans («خطط الإيرادات»): content shape, validation (hard errors vs save checks), allocation and monthly-distribution previews, masking, budget aid.
// No I/O, no React; used by the server (authoritative), the client (editor) and the tests. Spec: docs/revenue-plans-spec.md §1–§2.
// Money is whole riyals; every split uses planMath.apportion (largest remainder) and the ROUNDING REMAINDER is always returned. Nothing is distributed, spread or normalised implicitly: each action is a pure PREVIEW, then an explicit APPLY.
// User-facing text is returned as { ar, en } pairs; errors and checks carry a stable `code`/`id` + `params` so the UI can render them its own way. Every function returns NEW objects (inputs are never mutated).
import { apportion, BP_TOTAL, fiscalYearPeriod, isCalendarYear, isISODate, monthAmounts, monthRows, periodValid, weightsTotal } from './planMath.js';
import { authorisedMunicipalities, entityUniverse, municipalCoverage, mutateDecision, scopeEntityKeys } from './planAccess.js';
import { GEO_HIERARCHY, normalizeGeoScope } from '../geoScope.js';
import { municipalitiesOf, municipalityByRef } from '../amanahHierarchy.js';
import { appropriationOf, appropriationKeys, APPROPRIATION_YEAR, HQ_KEY } from '../appropriations.js';

export { entityUniverse };
export const ALLOCATION_ORIGINS = ['manual', 'distributed', 'migrated', 'seed', 'derived'];
export const DISTRIBUTION_BASES = ['appropriation', 'equal', 'proportional'];
export const MUNICIPAL_ORIGINS = ['manual', 'distributed'];
/** spec §9: the part of an Amanah's allocation not given to a municipality (never auto-spread) */
export const UNALLOCATED_TO_MUNICIPALITIES_LABEL = Object.freeze({ ar: 'غير موزع على البلديات', en: 'Not distributed to municipalities' });
/** spec §9: a municipality with no allocation row has NO target — the Amanah's target is never reused or divided */
export const NO_MUNICIPAL_TARGET_LABEL = Object.freeze({ ar: 'لم يُحدد مستهدف لهذه البلدية', en: 'No target has been set for this municipality' });
/** the profile label shown whenever the monthly split is the equal one (never silent) */
export const EQUAL_PROFILE_LABEL = Object.freeze({ ar: 'توزيع متساوٍ — افتراض', en: 'Equal split — assumption' });
/** the label of the target when a restricted viewer sees only the entities their scope allows */
export const MASKED_TARGET_LABEL = Object.freeze({ ar: 'إجمالي الجهات المتاحة لك', en: 'Total of the entities available to you' });

const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const T = (ar, en) => ({ ar, en });
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const str = (x) => (typeof x === 'string' ? x.trim() : '');
const uniq = (a) => [...new Set(a)];
/** a finite number or null (blank / non-numeric → null) */
const numOrNull = (v) => { if (v === null || v === undefined || v === '') return null; const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : NaN; };

// ---- content shape ------------------------------------------------------------------------------------------------------------------------------------------
/** a blank content: no target, NO allocation rows, no profile (nothing is assumed). `period` wins over `year` (default = the January–December preset of `year`, an assumption pending business confirmation). */
export function emptyContent({ name = '', scope = { kind: 'ministry' }, period = null, year = APPROPRIATION_YEAR } = {}) {
  return normalizeContent({ name, scope, period: period || fiscalYearPeriod(year), target: { amount: null }, allocations: [], distribution: { profile: null }, advanced: {} });
}

function normDistribution(d) {
  const profile = d?.profile === 'equal' || d?.profile === 'manual' ? d.profile : null;
  if (profile !== 'manual') return { profile };
  const weights = {};
  if (isObj(d.weights)) for (const k of Object.keys(d.weights).sort()) { if (!YM.test(k)) continue; const n = numOrNull(d.weights[k]); weights[k] = Number.isFinite(n) ? Math.round(n) : 0; }
  return { profile, weights };
}
/**
 * The FROZEN BASELINE of a derived plan (the remaining-2026 plan): { kind:'remaining_of_annual', cutoff, annualPlanId, annualPlanRevision, derivedAt, annualPeriod, convention{ar,en}, note{ar,en},
 * entities:[{ entityKey, annual, actual, remaining, surplus }], annualTarget, actualToCutoff, remaining, surplus } — whole riyals, written once at creation and never recomputed. Anything else is dropped.
 */
function normBaseline(b) {
  if (!isObj(b) || b.kind !== 'remaining_of_annual') return null;
  const int = (v) => { const n = numOrNull(v); return Number.isFinite(n) ? Math.round(n) : 0; };
  const bi2 = (o) => (isObj(o) ? { ar: str(o.ar), en: str(o.en) } : null);
  const out = { kind: 'remaining_of_annual', cutoff: str(b.cutoff), annualPlanId: str(b.annualPlanId) || null, annualPlanRevision: Number.isInteger(b.annualPlanRevision) ? b.annualPlanRevision : null, derivedAt: typeof b.derivedAt === 'string' ? b.derivedAt : null,
    annualPeriod: isObj(b.annualPeriod) ? { start: str(b.annualPeriod.start), end: str(b.annualPeriod.end) } : null, convention: bi2(b.convention), note: bi2(b.note),
    entities: (Array.isArray(b.entities) ? b.entities : []).filter(isObj).map((e) => ({ entityKey: str(e.entityKey), annual: int(e.annual), actual: int(e.actual), remaining: int(e.remaining), surplus: int(e.surplus) })),
    annualTarget: int(b.annualTarget), actualToCutoff: int(b.actualToCutoff), remaining: int(b.remaining), surplus: int(b.surplus) };
  return out;
}
/** the canonical content: trimmed text, integer riyals / basis points, only the known fields (unknown ones are dropped). Non-numeric values become null (target) / 0 (rows, weights) and are dropped (advanced) — so run validateDraft on the RAW input, which still sees them. */
export function normalizeContent(c) {
  const src = isObj(c) ? c : {};
  const scope = src.scope?.kind === 'ministry' ? { kind: 'ministry' } : { kind: 'entities', entityKeys: Array.isArray(src.scope?.entityKeys) ? uniq(src.scope.entityKeys.filter((k) => typeof k === 'string').map((k) => k.trim()).filter(Boolean)) : [] };
  const p = isObj(src.period) ? src.period : {};
  const start = typeof p.start === 'string' ? p.start.trim() : null; const end = typeof p.end === 'string' ? p.end.trim() : null;
  const preset = p.preset !== 'range' && isCalendarYear({ start, end }) ? 'fiscal-year' : 'range'; // 'fiscal-year' is only valid for a whole calendar year
  const amt = numOrNull(src.target?.amount);
  const target = { amount: Number.isFinite(amt) ? Math.round(amt) : null };
  const b = src.target?.basis;
  if (isObj(b) && b.method === 'budget_x_coverage' && Number.isFinite(Number(b.coverage)) && Number.isFinite(Number(b.budget))) target.basis = { method: 'budget_x_coverage', coverage: Number(b.coverage), budget: Math.round(Number(b.budget)), at: typeof b.at === 'string' ? b.at : null, ...(Number.isInteger(b.carriedFromYear) ? { carriedFromYear: b.carriedFromYear } : {}) }; // carriedFromYear = the budget is the communicated budget of ANOTHER year, carried forward as an assumption (the 2027 collection plan)
  const allocations = (Array.isArray(src.allocations) ? src.allocations : []).filter(isObj).map((a) => {
    const n = numOrNull(a.amount); const row = { entityKey: str(a.entityKey), amount: Number.isFinite(n) ? Math.round(n) : 0, origin: ALLOCATION_ORIGINS.includes(a.origin) ? a.origin : 'manual' };
    const note = str(a.note); if (note) row.note = note; return row;
  });
  const out = { name: str(src.name), scope, period: { start, end, preset }, target, allocations, distribution: normDistribution(src.distribution), advanced: {} };
  // municipal allocations (spec §9): kept as written (an unknown municipality id is NOT dropped — validateDraft refuses it, run on the raw input); the key exists only when there is at least one row
  const mrows = (Array.isArray(src.municipalAllocations) ? src.municipalAllocations : []).filter(isObj).map((a) => {
    const n = numOrNull(a.amount); const row = { entityKey: str(a.entityKey), muniId: str(a.muniId), amount: Number.isFinite(n) ? Math.round(n) : 0, origin: MUNICIPAL_ORIGINS.includes(a.origin) ? a.origin : 'manual' };
    const note = str(a.note); if (note) row.note = note; return row;
  });
  if (mrows.length) out.municipalAllocations = mrows;
  if (isObj(src.entityDistributions)) {
    const ed = {}; for (const k of Object.keys(src.entityDistributions)) { const d = normDistribution(src.entityDistributions[k]); if (d.profile) ed[k] = d; }
    if (Object.keys(ed).length) out.entityDistributions = ed;
  }
  const bl = normBaseline(src.baseline); if (bl) out.baseline = bl;
  const cr = numOrNull(src.advanced?.collectionRate); if (Number.isFinite(cr)) out.advanced.collectionRate = cr;
  const bt = numOrNull(src.advanced?.billingTarget); if (Number.isFinite(bt)) out.advanced.billingTarget = Math.round(bt);
  return out;
}

// ---- views ---------------------------------------------------------------------------------------------------------------------------------------------------
/** a plan record (spec §10): `content` is the saved configuration; `versions[]` are internal per-save snapshots (metadata only on the client; the snapshot content is read through the versions route). */
const isSavedRecord = (plan) => isObj(plan) && isObj(plan.content);
/**
 * The ONLY input the calculation core and the consumers read: the SAVED plan (`which` = 'inForce' | 'current' → its `content`, versionId `<id>@r<revision>`) or an internal snapshot (`which` = its number → `<id>@s<n>`).
 * 'working' is always null: there is no server-side working copy (the editor keeps it in the client; the page builds its own view of it).
 * → { planId, versionId, versionNumber (= the revision / the snapshot number), name, state:'active' (internal constant), origin, period, scope, content, isHistorical, isSystem, labelSource:{ar,en} } | null
 */
export function planView(plan, which = 'inForce') {
  if (!isSavedRecord(plan)) return null;
  if (which === 'working') return null;
  let content; let versionId; let versionNumber; let isHistorical = false;
  if (which === 'inForce' || which === 'current' || which == null) { content = plan.content; versionNumber = plan.revision ?? null; versionId = `${plan.id}@r${plan.revision ?? 0}`; }
  else {
    const s = (plan.versions || []).find((x) => x.n === Number(which));
    if (!s || !s.content) return null;
    content = s.content; versionNumber = s.n; versionId = `${plan.id}@s${s.n}`; isHistorical = s.revision == null ? true : s.revision !== plan.revision;
  }
  const c = clone(content);
  return { planId: plan.id, versionId, versionNumber, name: c.name, ...(plan.nameEn ? { nameEn: plan.nameEn } : {}), state: 'active', origin: plan.origin, period: c.period, scope: c.scope, content: c, isHistorical, isSystem: !!plan.isSystem, labelSource: T(c.name, c.name) };
}

// ---- validation ----------------------------------------------------------------------------------------------------------------------------------------------
const err = (code, path, params, ar, en) => ({ code, path, params: params || {}, ar, en });
/**
 * DRAFT SAVE: hard errors only. ctx = { universe?: string[], actorScope?: GeoScope (the actor's scope; omitted → no authority check), readOnly?: boolean }.
 * Hard errors: invalid dates / end before start · unknown entity · scope outside the actor's authority · negative or non-numeric amounts / weights / advanced inputs · a duplicate allocation row · a manual month outside the period.
 * Everything else (unallocated / excess amounts, months ≠ 100 %, no target, no profile) is allowed here and only blocks ACTIVATION. Validate the RAW input (before normalizeContent) so non-numeric values are seen.
 * @returns { ok, errors: [{ code, path, params, ar, en }] }
 */
export function validateDraft(content, ctx = {}) {
  const errors = []; const universe = ctx.universe || entityUniverse(); const c = isObj(content) ? content : {};
  // period
  const p = isObj(c.period) ? c.period : {};
  if (!isISODate(p.start)) errors.push(err('period_invalid_start', 'period.start', {}, 'تاريخ بداية الفترة غير صالح', 'The period start date is not valid'));
  if (!isISODate(p.end)) errors.push(err('period_invalid_end', 'period.end', {}, 'تاريخ نهاية الفترة غير صالح', 'The period end date is not valid'));
  const periodOk = isISODate(p.start) && isISODate(p.end);
  if (periodOk && p.end < p.start) errors.push(err('period_end_before_start', 'period.end', { start: p.start, end: p.end }, 'تاريخ النهاية قبل تاريخ البداية', 'The end date is before the start date'));
  const rows = periodValid({ start: p.start, end: p.end }) ? monthRows({ start: p.start, end: p.end }) : [];
  // scope
  const sc = isObj(c.scope) ? c.scope : {};
  let keys = [];
  if (sc.kind === 'entities') {
    keys = Array.isArray(sc.entityKeys) ? sc.entityKeys : [];
    keys.forEach((k, i) => { if (typeof k !== 'string' || !universe.includes(k.trim())) errors.push(err('unknown_entity', `scope.entityKeys.${i}`, { entityKey: k }, 'جهة غير معروفة في نطاق الخطة', 'Unknown entity in the plan scope')); });
  } else if (sc.kind !== 'ministry') errors.push(err('scope_invalid', 'scope', {}, 'نطاق الخطة غير صالح', 'The plan scope is not valid'));
  if (ctx.actorScope !== undefined || ctx.readOnly) {
    const d = mutateDecision(ctx.actorScope, sc, { readOnly: !!ctx.readOnly });
    if (!d.ok && d.reason !== 'unknown_scope') errors.push(err(d.reason === 'read_only_role' ? 'read_only_role' : 'scope_forbidden', 'scope', { reason: d.reason }, 'نطاق الخطة خارج صلاحياتك', 'The plan scope is outside your authority'));
  }
  // amounts
  const bad = (v) => { const n = numOrNull(v); return n !== null && (!Number.isFinite(n) || n < 0); };
  if (bad(c.target?.amount)) errors.push(err('invalid_amount', 'target.amount', {}, 'المستهدف يجب أن يكون رقمًا غير سالب', 'The target must be a non-negative number'));
  const seen = new Set();
  (Array.isArray(c.allocations) ? c.allocations : []).forEach((a, i) => {
    const key = str(a?.entityKey);
    if (!universe.includes(key)) errors.push(err('unknown_entity', `allocations.${i}.entityKey`, { entityKey: a?.entityKey }, 'جهة غير معروفة في التخصيص', 'Unknown entity in the allocation'));
    else if (seen.has(key)) errors.push(err('duplicate_allocation', `allocations.${i}.entityKey`, { entityKey: key }, 'الجهة مكررة في التخصيص', 'The entity appears twice in the allocation'));
    seen.add(key);
    const n = numOrNull(a?.amount);
    if (n === null || !Number.isFinite(n) || n < 0) errors.push(err('invalid_amount', `allocations.${i}.amount`, { entityKey: key }, 'مبلغ التخصيص يجب أن يكون رقمًا غير سالب', 'The allocation amount must be a non-negative number'));
  });
  // municipal allocations (spec §9): the municipality must be one of the Amanah's (never inferred, never invented); rows for an entity with no allocation yet are allowed in a draft
  if (c.municipalAllocations != null && !Array.isArray(c.municipalAllocations)) errors.push(err('municipal_invalid', 'municipalAllocations', {}, 'تخصيص البلديات غير صالح', 'The municipal allocations are not valid'));
  const scopeSet = new Set(sc.kind === 'ministry' ? universe : keys.filter((k) => typeof k === 'string').map((k) => k.trim()));
  const seenM = new Set();
  (Array.isArray(c.municipalAllocations) ? c.municipalAllocations : []).forEach((m, i) => {
    const path = `municipalAllocations.${i}`;
    if (!isObj(m)) { errors.push(err('municipal_invalid', path, {}, 'صف تخصيص بلدية غير صالح', 'Invalid municipal allocation row')); return; }
    const ek = str(m.entityKey); const mid = str(m.muniId);
    if (!universe.includes(ek)) errors.push(err('unknown_entity', `${path}.entityKey`, { entityKey: m.entityKey }, 'جهة غير معروفة في تخصيص البلدية', 'Unknown entity in the municipal allocation'));
    else if (!scopeSet.has(ek)) errors.push(err('municipal_entity_not_in_scope', `${path}.entityKey`, { entityKey: ek }, 'الجهة خارج نطاق الخطة', 'The entity is outside the plan scope'));
    const known = mid ? municipalityByRef(mid) : null;
    if (!known) errors.push(err('unknown_municipality', `${path}.muniId`, { muniId: m.muniId }, 'بلدية غير معروفة', 'Unknown municipality'));
    else if (universe.includes(ek) && !municipalitiesOf(ek).some((x) => x.refId === mid)) errors.push(err('municipality_not_in_entity', `${path}.muniId`, { entityKey: ek, muniId: mid }, 'البلدية لا تتبع هذه الأمانة', 'The municipality does not belong to this Amanah'));
    const dk = `${ek}\u0000${mid}`;
    if (seenM.has(dk)) errors.push(err('duplicate_municipal_allocation', `${path}.muniId`, { entityKey: ek, muniId: mid }, 'البلدية مكررة في تخصيص الأمانة', 'The municipality appears twice in the Amanah allocation'));
    seenM.add(dk);
    const n = numOrNull(m.amount);
    if (n === null || !Number.isFinite(n) || n < 0) errors.push(err('invalid_amount', `${path}.amount`, { entityKey: ek, muniId: mid }, 'مبلغ البلدية يجب أن يكون رقمًا غير سالب', 'The municipal amount must be a non-negative number'));
    else if (!Number.isInteger(n)) errors.push(err('amount_not_integer', `${path}.amount`, { entityKey: ek, muniId: mid }, 'مبلغ البلدية يجب أن يكون عددًا صحيحًا بالريال', 'The municipal amount must be a whole number of riyals'));
  });
  // distributions (plan level + entity overrides)
  const checkDist = (d, path) => {
    if (!isObj(d)) return;
    if (d.profile != null && d.profile !== 'equal' && d.profile !== 'manual') errors.push(err('invalid_profile', `${path}.profile`, {}, 'نمط التوزيع غير صالح', 'The distribution profile is not valid'));
    if (d.profile === 'manual' && isObj(d.weights)) for (const ym of Object.keys(d.weights)) {
      const n = numOrNull(d.weights[ym]);
      if (!YM.test(ym)) { errors.push(err('month_outside_period', `${path}.weights.${ym}`, { ym }, 'شهر غير صالح في التوزيع', 'Invalid month in the distribution')); continue; }
      if (n === null || !Number.isFinite(n) || n < 0) errors.push(err('invalid_weight', `${path}.weights.${ym}`, { ym }, 'وزن الشهر يجب أن يكون رقمًا غير سالب', 'The month weight must be a non-negative number'));
      if (rows.length && !rows.some((r) => r.ym === ym)) errors.push(err('month_outside_period', `${path}.weights.${ym}`, { ym }, 'شهر خارج فترة الخطة', 'Month outside the plan period'));
    }
  };
  checkDist(c.distribution, 'distribution');
  if (isObj(c.entityDistributions)) for (const k of Object.keys(c.entityDistributions)) {
    if (!universe.includes(k)) errors.push(err('unknown_entity', `entityDistributions.${k}`, { entityKey: k }, 'جهة غير معروفة في التوزيع الشهري', 'Unknown entity in the monthly distribution'));
    checkDist(c.entityDistributions[k], `entityDistributions.${k}`);
  }
  // advanced
  const cr = numOrNull(c.advanced?.collectionRate);
  if (cr !== null && !(Number.isFinite(cr) && cr > 0 && cr <= 1)) errors.push(err('invalid_collection_rate', 'advanced.collectionRate', {}, 'نسبة التحصيل يجب أن تكون بين 0 و100%', 'The collection rate must be above 0 and at most 100%'));
  if (bad(c.advanced?.billingTarget)) errors.push(err('invalid_amount', 'advanced.billingTarget', {}, 'مستهدف الفوترة يجب أن يكون رقمًا غير سالب', 'The billing target must be a non-negative number'));
  return { ok: errors.length === 0, errors };
}

// ---- allocation ----------------------------------------------------------------------------------------------------------------------------------------------
/** target / allocated / unallocated / excess / complete and one row per allocation with its share of the target (null when there is no target) */
export function allocationSummary(content) {
  const c = content || {}; const target = Math.round(Number(c.target?.amount) || 0);
  const rows = (c.allocations || []).map((a) => ({ entityKey: a.entityKey, amount: Math.round(a.amount) || 0, origin: a.origin || 'manual', note: a.note || null }));
  const allocated = rows.reduce((t, r) => t + r.amount, 0);
  return {
    target, hasTarget: target > 0, allocated, unallocated: Math.max(0, target - allocated), excess: Math.max(0, allocated - target), complete: target > 0 && allocated === target, count: rows.length,
    rows: rows.map((r) => ({ ...r, share: target > 0 ? r.amount / target : null }))
  };
}

const scopeKeysOf = (content, universe) => scopeEntityKeys(content?.scope, universe).filter((k) => universe.includes(k));
const emptyRowKeys = (content, keys) => { const have = new Map((content.allocations || []).map((a) => [a.entityKey, a.amount])); return keys.filter((k) => !(have.get(k) > 0)); };

function previewDistribution(mode, content, opts = {}) {
  const universe = opts.universe || entityUniverse(); const year = opts.year ?? (Number(String(content?.period?.start || '').slice(0, 4)) || APPROPRIATION_YEAR);
  const basis = opts.basis; const fail = (code, ar, en, extra = {}) => ({ ok: false, code, ar, en, mode, basis, ...extra });
  if (!DISTRIBUTION_BASES.includes(basis)) return fail('invalid_basis', 'أساس التوزيع غير صالح', 'Invalid distribution basis');
  const sum = allocationSummary(content);
  if (!sum.hasTarget) return fail('no_target', 'حدّد المستهدف أولاً', 'Set the target first');
  const scopeKeys = scopeKeysOf(content, universe);
  const existing = new Map((content.allocations || []).map((a) => [a.entityKey, a]));
  const eligible = uniq([...scopeKeys, ...existing.keys()]); // every row that exists or may exist
  let chosen = Array.isArray(opts.rows) ? uniq(opts.rows.filter((k) => eligible.includes(k))) : mode === 'all' ? scopeKeys : emptyRowKeys(content, scopeKeys);
  chosen = eligible.filter((k) => chosen.includes(k)); // stable order: scope order
  if (!chosen.length) return fail('no_rows', 'لا توجد صفوف مختارة للتوزيع', 'No rows are selected for the distribution');
  const unchosenTotal = sum.rows.filter((r) => !chosen.includes(r.entityKey)).reduce((t, r) => t + r.amount, 0);
  const pool = mode === 'all' ? sum.target - unchosenTotal : sum.target - sum.allocated;
  if (mode !== 'all' && pool <= 0) return fail('no_remainder', 'لا يوجد مبلغ غير موزّع', 'There is no unallocated amount', { unallocated: sum.unallocated, excess: sum.excess });
  if (mode === 'all' && pool < 0) return fail('rows_exceed_target', 'الصفوف غير المختارة تتجاوز المستهدف', 'The unselected rows already exceed the target', { excess: -pool });
  // weights
  const skipped = []; let weights;
  if (basis === 'equal') weights = chosen.map(() => 1);
  else if (basis === 'appropriation') {
    weights = chosen.map((k) => { const a = appropriationOf(k, year); const w = a?.revAdjusted > 0 ? a.revAdjusted : 0; if (!w) skipped.push({ entityKey: k, reason: a ? 'no_revenue_appropriation' : 'no_budget_data' }); return w; });
    if (!weights.some((w) => w > 0)) return fail('no_budget_data', 'لا توجد بيانات اعتماد إيرادات لهذه الجهات', 'No revenue-appropriation data for these entities', { skipped });
  } else {
    weights = chosen.map((k) => existing.get(k)?.amount || 0);
    if (!weights.some((w) => w > 0)) return fail('no_current_amounts', 'لا توجد مبالغ حالية للتوزيع بالتناسب معها', 'No current amounts to distribute in proportion to', { skipped });
  }
  const ap = apportion(pool, weights);
  const rows = []; const unchanged = [];
  chosen.forEach((k, i) => {
    const before = existing.get(k)?.amount || 0; const add = ap.amounts[i];
    const after = mode === 'all' ? add : before + add; // 'remainder' adds the share to what the row holds; 'all' replaces the rows
    const row = { entityKey: k, before, after, delta: after - before, weight: weights[i], existed: existing.has(k), originBefore: existing.get(k)?.origin || null, originAfter: 'distributed' };
    if (row.delta !== 0) rows.push(row); else unchanged.push(k);
  });
  const allocatedAfter = sum.allocated + rows.reduce((t, r) => t + r.delta, 0);
  const remainder = { units: ap.remainder.units, rows: ap.remainder.rows.map((i) => chosen[i]) }; // riyals the flooring left, and which rows received one
  return {
    ok: true, mode, basis, year, target: sum.target, pool, chosen, rows, unchanged, skipped, remainder,
    unallocatedBefore: sum.unallocated, unallocatedAfter: Math.max(0, sum.target - allocatedAfter), allocatedBefore: sum.allocated, allocatedAfter, excessAfter: Math.max(0, allocatedAfter - sum.target),
    manualUntouched: (content.allocations || []).filter((a) => a.origin === 'manual' && !chosen.includes(a.entityKey)).map((a) => a.entityKey)
  };
}
/**
 * PREVIEW: distribute the UNALLOCATED amount (target − Σ rows). opts = { basis: 'appropriation'|'equal'|'proportional', rows?: entityKey[] (default: the scope's EMPTY rows only), year?, universe? }.
 * A row holding an amount changes only if it is listed in `rows`. Result (ok) lists EVERY changed row {entityKey, before, after, delta}, unallocatedBefore/After and `remainder` {units, rows} (the rounding riyals); not ok → { ok:false, code, ar, en }.
 */
export const previewDistributeRemainder = (content, opts) => previewDistribution('remainder', content, opts);
/** PREVIEW: redistribute the WHOLE target over `rows` (default: every row of the scope plus existing rows; rows left out keep their amounts and the pool is target − their total). Same result shape. */
export const previewRedistributeAll = (content, opts) => previewDistribution('all', content, opts);
/** APPLY a distribution preview → { ok, content } (new object). Only the listed rows change (origin 'distributed'); a stale preview (a row no longer holds its `before` amount) is refused: { ok:false, code:'stale_preview' }. */
export function applyDistributionPreview(content, preview) {
  if (!preview?.ok || !Array.isArray(preview.rows)) return { ok: false, code: 'invalid_preview' };
  const next = clone(content); const byKey = new Map(next.allocations.map((a) => [a.entityKey, a]));
  for (const r of preview.rows) if ((byKey.get(r.entityKey)?.amount || 0) !== r.before) return { ok: false, code: 'stale_preview', entityKey: r.entityKey };
  for (const r of preview.rows) {
    const a = byKey.get(r.entityKey);
    if (a) { a.amount = r.after; a.origin = 'distributed'; } else next.allocations.push({ entityKey: r.entityKey, amount: r.after, origin: 'distributed' });
  }
  return { ok: true, content: next };
}

// ---- municipalities (spec §9) ----------------------------------------------------------------------------------------------------------------------------------
/** the municipal allocation rows of a content (never null), optionally of one Amanah */
export const municipalRowsOf = (content, entityKey = null) => (Array.isArray(content?.municipalAllocations) ? content.municipalAllocations : []).filter((m) => m && (entityKey == null || m.entityKey === entityKey));
const muniName = (m) => ({ ar: m.ar, en: m.en });
/** rows of one Amanah folded per municipality id (a duplicate row — only possible in an invalid draft — is summed so the totals still reconcile) */
function foldMunicipal(content, entityKey) {
  const by = new Map();
  for (const r of municipalRowsOf(content, entityKey)) {
    const amount = Math.round(Number(r.amount)) || 0; const cur = by.get(r.muniId);
    if (cur) cur.amount += amount; else by.set(r.muniId, { muniId: r.muniId, amount, origin: r.origin || 'manual', note: r.note || null });
  }
  return by;
}
/**
 * The municipal split of ONE Amanah's allocation: { entityKey, hasMunicipalities (the reference lists municipalities under it), hasAllocation, amanahAmount, allocated (Σ municipal), unallocated («غير موزع على البلديات»), unallocatedLabel,
 * excess (Σ municipal − the Amanah's amount), complete, rows: [{ muniId, name:{ar,en}|null, amount, share (of the Amanah amount; null when it is 0), origin, note, known }], municipalities: every municipality of the Amanah
 * [{ muniId, name, amount (null = no target), origin, share, hasTarget, label (NO_MUNICIPAL_TARGET_LABEL when null) }], count }.
 * A masked viewer's content (municipal-only coverage of this Amanah) hides the Amanah amount: amanahAmount / unallocated / excess / share are null and `municipalities` lists only the municipalities they may see (amanahHidden: true).
 */
export function municipalSummary(content, entityKey) {
  const c = content || {}; const list = municipalitiesOf(entityKey);
  const hidden = Array.isArray(c.maskedAmanahKeys) && c.maskedAmanahKeys.includes(entityKey);
  const seeIds = hidden ? new Set(c.municipalVisibility?.[entityKey] || []) : null;
  const al = (c.allocations || []).find((a) => a.entityKey === entityKey); const amanahAmount = hidden ? null : Math.round(Number(al?.amount)) || 0;
  const by = foldMunicipal(c, entityKey); const allocated = [...by.values()].reduce((t, r) => t + r.amount, 0);
  const share = (amount) => (amanahAmount > 0 ? amount / amanahAmount : null);
  const order = new Map(list.map((m, i) => [m.refId, i]));
  const rows = [...by.values()].sort((a, b) => (order.has(a.muniId) ? order.get(a.muniId) : 1e9) - (order.has(b.muniId) ? order.get(b.muniId) : 1e9) || (a.muniId < b.muniId ? -1 : 1))
    .map((r) => { const m = order.has(r.muniId) ? list[order.get(r.muniId)] : null; return { muniId: r.muniId, name: m ? muniName(m) : null, amount: r.amount, share: share(r.amount), origin: r.origin, note: r.note, known: !!m }; });
  const municipalities = list.filter((m) => !seeIds || seeIds.has(m.refId)).map((m) => { const r = by.get(m.refId); return { muniId: m.refId, name: muniName(m), amount: r ? r.amount : null, origin: r ? r.origin : null, share: r ? share(r.amount) : null, hasTarget: !!r, label: r ? null : NO_MUNICIPAL_TARGET_LABEL }; });
  return {
    entityKey, hasMunicipalities: list.length > 0, hasAllocation: !!al, amanahHidden: hidden, amanahAmount, allocated,
    unallocated: hidden ? null : Math.max(0, amanahAmount - allocated), unallocatedLabel: UNALLOCATED_TO_MUNICIPALITIES_LABEL, excess: hidden ? null : Math.max(0, allocated - amanahAmount),
    complete: !hidden && amanahAmount > 0 && allocated === amanahAmount, rows, municipalities, count: by.size
  };
}
/** the explicit target of ONE municipality: { state: 'ok', amount, origin, note } | { state: 'no_municipal_target', amount: null, reason: 'no_municipal_target', label } — never a share of the Amanah's target (spec §9) */
export function municipalTarget(content, entityKey, muniId) {
  const r = foldMunicipal(content, entityKey).get(muniId);
  if (!r) return { state: 'no_municipal_target', amount: null, reason: 'no_municipal_target', label: NO_MUNICIPAL_TARGET_LABEL };
  return { state: 'ok', amount: r.amount, origin: r.origin, note: r.note };
}

/**
 * PREVIEW: give the Amanah's «غير موزع على البلديات» amount to its municipalities. opts = { basis: 'equal' | 'proportional' (to the municipal amounts they hold; no budget data exists at municipal level), rows?: muniId[] (default: the municipalities with NO amount yet) }.
 * A row holding an amount changes only if listed in `rows`. Lists EVERY changed row {muniId, name, before, after, delta, …}, unallocatedBefore/After and the ROUNDING REMAINDER `remainder` {units, rows: muniId[]};
 * not ok → { ok:false, code: 'invalid_basis'|'no_municipalities'|'amanah_hidden'|'no_entity_allocation'|'no_remainder'|'no_rows'|'no_current_amounts', ar, en }. Changing the Amanah amount never edits municipal rows.
 */
export function previewDistributeMunicipalRemainder(content, entityKey, opts = {}) {
  const basis = opts.basis; const fail = (code, ar, en, extra = {}) => ({ ok: false, code, ar, en, mode: 'municipal_remainder', entityKey, basis, ...extra });
  if (basis !== 'equal' && basis !== 'proportional') return fail('invalid_basis', 'أساس التوزيع غير صالح', 'Invalid distribution basis');
  const list = municipalitiesOf(entityKey); if (!list.length) return fail('no_municipalities', 'لا توجد بلديات تابعة لهذه الأمانة', 'This Amanah has no municipalities');
  const sum = municipalSummary(content, entityKey); if (sum.amanahHidden) return fail('amanah_hidden', 'مخصص الأمانة غير متاح لك', 'The Amanah allocation is not available to you');
  if (!(sum.amanahAmount > 0)) return fail('no_entity_allocation', 'حدّد مخصص الأمانة أولاً', 'Set the Amanah allocation first');
  const pool = sum.amanahAmount - sum.allocated; if (pool <= 0) return fail('no_remainder', 'لا يوجد مبلغ غير موزع على البلديات', 'There is nothing left to distribute to the municipalities', { unallocated: sum.unallocated, excess: sum.excess });
  const existing = foldMunicipal(content, entityKey); const ids = list.map((m) => m.refId);
  const chosen = ids.filter((id) => (Array.isArray(opts.rows) ? opts.rows.includes(id) : !(existing.get(id)?.amount > 0)));
  if (!chosen.length) return fail('no_rows', 'لا توجد بلديات مختارة للتوزيع', 'No municipalities are selected for the distribution');
  const weights = basis === 'equal' ? chosen.map(() => 1) : chosen.map((id) => existing.get(id)?.amount || 0);
  if (!weights.some((w) => w > 0)) return fail('no_current_amounts', 'لا توجد مبالغ حالية للتوزيع بالتناسب معها', 'No current amounts to distribute in proportion to');
  const ap = apportion(pool, weights); const byId = new Map(list.map((m) => [m.refId, m]));
  const rows = []; const unchanged = [];
  chosen.forEach((id, i) => {
    const before = existing.get(id)?.amount || 0; const after = before + ap.amounts[i];
    const row = { muniId: id, name: muniName(byId.get(id)), before, after, delta: after - before, weight: weights[i], existed: existing.has(id), originBefore: existing.get(id)?.origin || null, originAfter: 'distributed' };
    if (row.delta !== 0) rows.push(row); else unchanged.push(id);
  });
  const allocatedAfter = sum.allocated + rows.reduce((t, r) => t + r.delta, 0);
  return {
    ok: true, mode: 'municipal_remainder', entityKey, basis, amanahAmount: sum.amanahAmount, pool, chosen, rows, unchanged,
    remainder: { units: ap.remainder.units, rows: ap.remainder.rows.map((i) => chosen[i]) }, // the riyals the flooring left, and which municipalities received one
    unallocatedBefore: sum.unallocated, unallocatedAfter: Math.max(0, sum.amanahAmount - allocatedAfter), allocatedBefore: sum.allocated, allocatedAfter, excessAfter: Math.max(0, allocatedAfter - sum.amanahAmount),
    manualUntouched: [...existing.values()].filter((r) => r.origin === 'manual' && !chosen.includes(r.muniId)).map((r) => r.muniId)
  };
}
/** APPLY a municipal preview → { ok, content } (new object). Only the listed municipalities change (origin 'distributed'); a stale preview (a row no longer holds its `before` amount) is refused: { ok:false, code:'stale_preview', muniId }. */
export function applyMunicipalPreview(content, preview) {
  if (!preview?.ok || preview.mode !== 'municipal_remainder' || !Array.isArray(preview.rows) || !preview.entityKey) return { ok: false, code: 'invalid_preview' };
  const ek = preview.entityKey; const cur = foldMunicipal(content, ek);
  for (const r of preview.rows) if ((cur.get(r.muniId)?.amount || 0) !== r.before) return { ok: false, code: 'stale_preview', muniId: r.muniId };
  const next = clone(content); const list = Array.isArray(next.municipalAllocations) ? next.municipalAllocations : [];
  for (const r of preview.rows) {
    const row = list.find((x) => x.entityKey === ek && x.muniId === r.muniId);
    if (row) { row.amount = r.after; row.origin = 'distributed'; } else list.push({ entityKey: ek, muniId: r.muniId, amount: r.after, origin: 'distributed' });
  }
  next.municipalAllocations = list;
  return { ok: true, content: next };
}

// ---- monthly distribution --------------------------------------------------------------------------------------------------------------------------------------
const distOf = (content, entityKey) => (entityKey && content.entityDistributions?.[entityKey]) || content.distribution || { profile: null };
/**
 * The monthly split in numbers: profile, label (the «equal — assumption» label when equal), total basis points, remaining (negative = excess), complete, and per month {ym, bp, pct, amount}.
 * `entityKey` = that entity's allocation under its own override (or the plan's distribution); omitted = the plan target. Manual months that do not add up to 10 000 bp are NEVER scaled: each month shows its own share of the amount.
 */
export function distributionSummary(content, { entityKey = null } = {}) {
  const c = content || {}; const rows = monthRows(c.period); const dist = distOf(c, entityKey);
  const amount = entityKey ? (c.allocations || []).find((a) => a.entityKey === entityKey)?.amount || 0 : Math.round(Number(c.target?.amount) || 0);
  const base = { profile: dist.profile || null, entityKey, overridden: !!(entityKey && c.entityDistributions?.[entityKey]), amount, label: dist.profile === 'equal' ? EQUAL_PROFILE_LABEL : null };
  if (!rows.length) return { ...base, totalBp: 0, remainingBp: BP_TOTAL, excessBp: 0, complete: false, months: [], distributedAmount: 0 };
  if (dist.profile === 'equal') {
    const ap = monthAmounts(amount, dist, rows); const w = rows.map((r) => r.fraction); const ws = w.reduce((a, b) => a + b, 0);
    const months = rows.map((r, i) => ({ ym: r.ym, bp: (r.fraction / ws) * BP_TOTAL, pct: (r.fraction / ws) * 100, amount: ap.amounts[i], partial: r.partial }));
    return { ...base, totalBp: BP_TOTAL, remainingBp: 0, excessBp: 0, complete: true, months, distributedAmount: amount, remainder: ap.remainder };
  }
  if (dist.profile === 'manual') {
    const wt = weightsTotal(dist, rows); const full = wt.complete ? monthAmounts(amount, dist, rows) : null;
    const months = rows.map((r, i) => { const bp = Math.max(0, Number(dist.weights?.[r.ym]) || 0); return { ym: r.ym, bp, pct: bp / 100, amount: full ? full.amounts[i] : Math.round((amount * bp) / BP_TOTAL), partial: r.partial }; });
    return { ...base, totalBp: wt.total, remainingBp: Math.max(0, wt.remaining), excessBp: Math.max(0, -wt.remaining), complete: wt.complete, months, distributedAmount: months.reduce((t, m) => t + m.amount, 0), remainder: full ? full.remainder : null };
  }
  return { ...base, totalBp: 0, remainingBp: BP_TOTAL, excessBp: 0, complete: false, months: rows.map((r) => ({ ym: r.ym, bp: 0, pct: 0, amount: 0, partial: r.partial })), distributedAmount: 0 };
}

/**
 * PREVIEW of a monthly action on a MANUAL profile (basis points). opts = { mode: 'equal' | 'remaining', months?: ym[] (default: all months for 'equal'; the months with no weight for 'remaining'), entityKey? }.
 *   equal     → the chosen months share equally (10 000 − the basis points of the months left out), whole basis points via apportion
 *   remaining → the not-yet-distributed basis points (10 000 − total) are added equally to the chosen months
 * A profile that is not manual starts from empty weights (nothing is inherited silently). Result: { ok, mode, rows:[{ym, before, after, delta}], totalBefore/After, remainingBefore/After, excessAfter, remainder:{units, months} }.
 */
export function previewMonthlyDistribute(content, { mode, months = null, entityKey = null } = {}) {
  const rows = monthRows(content?.period); const fail = (code, ar, en) => ({ ok: false, code, ar, en, mode });
  if (!rows.length) return fail('no_period', 'حدّد فترة صالحة أولاً', 'Set a valid period first');
  if (mode !== 'equal' && mode !== 'remaining') return fail('invalid_mode', 'إجراء غير صالح', 'Invalid action');
  const dist = distOf(content, entityKey); const before = {}; rows.forEach((r) => { before[r.ym] = dist.profile === 'manual' ? Math.max(0, Math.round(Number(dist.weights?.[r.ym]) || 0)) : 0; });
  const all = rows.map((r) => r.ym);
  let chosen = Array.isArray(months) ? all.filter((m) => months.includes(m)) : mode === 'equal' ? all : all.filter((m) => !before[m]);
  if (!chosen.length) return fail('no_months', 'لا توجد أشهر مختارة', 'No months are selected');
  const totalBefore = all.reduce((t, m) => t + before[m], 0);
  let pool;
  if (mode === 'equal') pool = BP_TOTAL - all.filter((m) => !chosen.includes(m)).reduce((t, m) => t + before[m], 0);
  else { pool = BP_TOTAL - totalBefore; if (pool <= 0) return fail('no_remaining', 'لا توجد نسبة متبقية للتوزيع', 'There is no remaining percentage to distribute'); }
  if (pool < 0) return fail('months_exceed', 'الأشهر غير المختارة تتجاوز 100%', 'The months left out already exceed 100%');
  const ap = apportion(pool, chosen.map(() => 1));
  const after = { ...before }; chosen.forEach((m, i) => { after[m] = mode === 'equal' ? ap.amounts[i] : before[m] + ap.amounts[i]; });
  const out = rows.map((r) => ({ ym: r.ym, before: before[r.ym], after: after[r.ym], delta: after[r.ym] - before[r.ym] }));
  const totalAfter = all.reduce((t, m) => t + after[m], 0);
  return { ok: true, mode, entityKey, chosen, rows: out.filter((r) => r.delta !== 0), allRows: out, totalBefore, totalAfter, remainingBefore: Math.max(0, BP_TOTAL - totalBefore), remainingAfter: Math.max(0, BP_TOTAL - totalAfter), excessAfter: Math.max(0, totalAfter - BP_TOTAL), remainder: { units: ap.remainder.units, months: ap.remainder.rows.map((i) => chosen[i]) }, profileBefore: dist.profile || null };
}
/** APPLY a monthly preview → { ok, content }: the distribution (or the entity's override) becomes manual with the previewed weights; stale previews are refused. */
export function applyMonthlyPreview(content, preview) {
  if (!preview?.ok || !Array.isArray(preview.allRows)) return { ok: false, code: 'invalid_preview' };
  const dist = distOf(content, preview.entityKey);
  const cur = dist.profile === 'manual' ? dist.weights || {} : {};
  for (const r of preview.allRows) if (Math.max(0, Math.round(Number(cur[r.ym]) || 0)) !== r.before) return { ok: false, code: 'stale_preview', ym: r.ym };
  const next = clone(content); const weights = {}; preview.allRows.forEach((r) => { weights[r.ym] = r.after; });
  const d = { profile: 'manual', weights };
  if (preview.entityKey) next.entityDistributions = { ...(next.entityDistributions || {}), [preview.entityKey]: d }; else next.distribution = d;
  return { ok: true, content: next };
}

// ---- save checks · name · default (spec §10) -----------------------------------------------------------------------------------------------------------------
const CHECK_LABELS = {
  target_positive: T('المستهدف أكبر من صفر', 'The target is above zero'),
  allocation_complete: T('التخصيص يساوي المستهدف إلى الريال', 'The allocation equals the target to the riyal'),
  allocations_in_scope: T('كل التخصيصات ضمن نطاق الخطة', 'Every allocation is inside the plan scope'),
  profile_explicit: T('نمط التوزيع الشهري محدد صراحةً', 'The monthly profile is chosen explicitly'),
  months_complete: T('الأشهر اليدوية تساوي 100% بالضبط', 'Manual months add up to exactly 100%'),
  actor_authorised: T('أنت مخوّل على كل جهات الخطة', 'You are authorised for every entity of the plan'),
  municipal_within_entity: T('مجموع تخصيصات البلديات لا يتجاوز مخصص الأمانة', "The municipal allocations do not exceed the Amanah's allocation")
};
/** the rules a plan must pass to be SAVED; `municipal_within_entity` is returned only when the content holds municipal rows. Several named plans may share a scope and a period: there is no duplicate rule */
export const BASE_SAVE_CHECK_IDS = ['target_positive', 'allocation_complete', 'allocations_in_scope', 'profile_explicit', 'months_complete', 'actor_authorised'];
export const SAVE_CHECK_IDS = [...BASE_SAVE_CHECK_IDS, 'municipal_within_entity'];
/**
 * SAVE CHECKS — one entry per rule, in order: target > 0 · Σ allocations = target to the riyal · allocations inside the scope · explicit profile · manual months exactly 10 000 bp (and overrides) · actor authorised
 * (+ municipal Σ ≤ its Amanah allocation ONLY when municipal rows exist, spec §9). ctx = { actorScope (GeoScope), readOnly, universe }.
 * @returns { ok, checks: [{ id, ok, params, label:{ar,en} }], failed: id[] }
 */
export function saveChecks(content, ctx = {}) {
  const c = normalizeContent(content); const universe = ctx.universe || entityUniverse();
  const sum = allocationSummary(c); const out = [];
  const add = (id, ok, params = {}) => out.push({ id, ok: !!ok, params, label: CHECK_LABELS[id] });
  add('target_positive', sum.hasTarget, { target: sum.target });
  add('allocation_complete', sum.complete, { target: sum.target, allocated: sum.allocated, unallocated: sum.unallocated, excess: sum.excess });
  const scopeKeys = scopeEntityKeys(c.scope, universe); const outside = c.scope?.kind === 'ministry' ? (c.allocations || []).map((a) => a.entityKey).filter((k) => !universe.includes(k)) : (c.allocations || []).map((a) => a.entityKey).filter((k) => !scopeKeys.includes(k));
  const emptyScope = c.scope?.kind !== 'ministry' && scopeKeys.length === 0;
  add('allocations_in_scope', outside.length === 0 && !emptyScope, { outside, emptyScope });
  const rows = monthRows(c.period); const planProfile = c.distribution?.profile;
  const overrides = Object.entries(c.entityDistributions || {});
  const profilesOk = (planProfile === 'equal' || planProfile === 'manual') && overrides.every(([, d]) => d.profile === 'equal' || d.profile === 'manual') && rows.length > 0;
  add('profile_explicit', profilesOk, { profile: planProfile || null });
  const incomplete = [];
  if (planProfile === 'manual') { const t = weightsTotal(c.distribution, rows); if (!t.complete) incomplete.push({ entityKey: null, total: t.total, remaining: t.remaining }); }
  for (const [k, d] of overrides) if (d.profile === 'manual') { const t = weightsTotal(d, rows); if (!t.complete) incomplete.push({ entityKey: k, total: t.total, remaining: t.remaining }); }
  add('months_complete', incomplete.length === 0, { incomplete, applicable: planProfile === 'manual' || overrides.some(([, d]) => d.profile === 'manual') });
  const d = mutateDecision(ctx.actorScope, c.scope, { readOnly: !!ctx.readOnly });
  add('actor_authorised', d.ok, { reason: d.reason });
  if (municipalRowsOf(c).length) { // spec §9: optional sub-allocation; the check exists only when the plan has municipal rows. Σ municipal ≤ the Amanah's allocation (the part left over is «غير موزع على البلديات»)
    const keys = uniq(municipalRowsOf(c).map((m) => m.entityKey)); const over = [];
    for (const k of keys) { const s2 = municipalSummary(c, k); if (s2.excess > 0) over.push({ entityKey: k, amanahAmount: s2.amanahAmount, allocated: s2.allocated, excess: s2.excess }); }
    add('municipal_within_entity', over.length === 0, { entities: over, entityCount: keys.length });
  }
  const failed = out.filter((x) => !x.ok).map((x) => x.id);
  return { ok: failed.length === 0, checks: out, failed };
}

export const PLAN_NAME_MAX = 80;
const nameKey = (s) => String(s).trim().normalize('NFC').toLowerCase();
/**
 * The plan NAME rule: trimmed, 1–80 characters, unique (case-insensitive) among the plans VISIBLE to the actor. `visibleNames` = the names of those plans (strings or { name }) EXCLUDING the plan being renamed/updated.
 * → { ok, name (trimmed), errors: [{ code: 'name_required' | 'name_too_long' | 'name_taken', path: 'name', params, ar, en }] }
 */
export function validatePlanName(name, visibleNames = []) {
  const s = typeof name === 'string' ? name.trim() : ''; const errors = [];
  if (!s) errors.push(err('name_required', 'name', {}, 'اسم الخطة مطلوب', 'The plan name is required'));
  else if (Array.from(s).length > PLAN_NAME_MAX) errors.push(err('name_too_long', 'name', { max: PLAN_NAME_MAX }, `اسم الخطة يجب ألا يتجاوز ${PLAN_NAME_MAX} حرفًا`, `The plan name must not exceed ${PLAN_NAME_MAX} characters`));
  else {
    const k = nameKey(s);
    if ((Array.isArray(visibleNames) ? visibleNames : []).some((n) => (typeof n === 'string' ? n : n && n.name) != null && nameKey(typeof n === 'string' ? n : n.name) === k)) errors.push(err('name_taken', 'name', {}, 'يوجد لديك خطة بهذا الاسم؛ اختر اسمًا آخر', 'A plan with this name already exists; choose another name'));
  }
  return { ok: errors.length === 0, name: s, errors };
}

/** the label of the system-provided illustrative default plan */
export const SYSTEM_PLAN_LABEL = Object.freeze({ ar: 'الخطة الافتراضية للنظام · بيانات توضيحية', en: 'System default plan · illustrative data' });
const planNameOf = (p) => String(p?.name ?? p?.content?.name ?? '');
/**
 * Which plan opens by default: the caller's EXPLICIT personal default if it still exists and is visible → else the GLOBAL default plan (the shared setting an administrator controls) if visible → else the first visible `isSystem` plan → else the first visible plan by name.
 * input = { plans (records, with `isSystem`, `name`), userDefaultPlanId, globalDefaultPlanId (undefined = the first system plan is the global default: the earlier behaviour), visibleIds? (omitted = every given plan is visible) }
 * → { userDefaultPlanId (the VALID personal default or null), globalDefaultPlanId (the visible global default or null), systemDefaultPlanId (= globalDefaultPlanId; kept for compatibility), effectiveDefaultPlanId (or null), source: 'personal' | 'global' | 'fallback' | 'none' }
 */
export function defaultPlanResolution({ plans = [], userDefaultPlanId = null, globalDefaultPlanId, visibleIds = null } = {}) {
  const vis = Array.isArray(visibleIds) || visibleIds instanceof Set ? new Set(visibleIds) : null;
  const list = (Array.isArray(plans) ? plans : []).filter((p) => p && typeof p.id === 'string' && (!vis || vis.has(p.id)));
  const byName = (a, b) => { const x = planNameOf(a); const y = planNameOf(b); return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : 1; };
  const sorted = [...list].sort(byName);
  const user = userDefaultPlanId && list.some((p) => p.id === userDefaultPlanId) ? userDefaultPlanId : null;
  const firstSystem = sorted.find((p) => p.isSystem)?.id || null;
  const configured = globalDefaultPlanId === undefined ? firstSystem : globalDefaultPlanId;
  const global = configured && list.some((p) => p.id === configured) ? configured : null;
  const fallback = firstSystem || sorted[0]?.id || null;
  const effectiveDefaultPlanId = user || global || fallback || null;
  return { userDefaultPlanId: user, globalDefaultPlanId: global, systemDefaultPlanId: global, effectiveDefaultPlanId, source: user ? 'personal' : global ? 'global' : fallback ? 'fallback' : 'none' };
}

// ---- differences -----------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Per-entity allocation difference between an independent entity plan and the reference (Ministry) plan — SHOWN, NEVER reconciled: neither value is replaced or adjusted.
 * Both arguments are planViews. → { rows:[{ entityKey, entityPlan, reference (null when the reference has no row), difference (entityPlan − reference | null) }], entityPlanTotal, referenceTotal (of the SAME entities), difference, note }
 */
export function allocationDifferences(entityPlanView, referenceView) {
  const mine = entityPlanView?.content?.allocations || []; const ref = new Map((referenceView?.content?.allocations || []).map((a) => [a.entityKey, a.amount]));
  const rows = mine.map((a) => { const r = ref.has(a.entityKey) ? ref.get(a.entityKey) : null; return { entityKey: a.entityKey, entityPlan: a.amount, reference: r, difference: r == null ? null : a.amount - r }; });
  const entityPlanTotal = rows.reduce((t, r) => t + r.entityPlan, 0); const refRows = rows.filter((r) => r.reference != null); const referenceTotal = refRows.reduce((t, r) => t + r.reference, 0);
  return {
    rows, entityPlanTotal, referenceTotal, difference: refRows.length ? refRows.reduce((t, r) => t + r.entityPlan, 0) - referenceTotal : null,
    referencePlanId: referenceView?.planId || null, entityPlanId: entityPlanView?.planId || null,
    note: T('الفرق للعرض فقط؛ لا يُعدَّل أي من المبلغين ولا تُسوّى الخطتان.', 'The difference is shown only; neither amount is changed and the two plans are not reconciled.')
  };
}

// ---- masking -------------------------------------------------------------------------------------------------------------------------------------------------
const isAmanahKey = (k) => GEO_HIERARCHY.has(k);
/** the entities a content names (scope, allocations, municipal rows) */
const contentEntityKeys = (c, universe) => uniq([...scopeEntityKeys(c?.scope, universe), ...(c?.allocations || []).map((a) => a.entityKey), ...municipalRowsOf(c).map((m) => m.entityKey)]);
function maskContent(c, vis, partial = [], geo = null) {
  const out = clone(c); const part = new Set(partial);
  out.allocations = (out.allocations || []).filter((a) => vis.has(a.entityKey) && !part.has(a.entityKey)); // an Amanah allocation seen only through municipal grants is HIDDEN (not returned, not summed)
  let visibleTotal = out.allocations.reduce((t, a) => t + (a.amount || 0), 0);
  if (c.municipalAllocations !== undefined) {
    const visIds = {}; for (const k of part) visIds[k] = authorisedMunicipalities(geo, k);
    out.municipalAllocations = municipalRowsOf(c).filter((m) => vis.has(m.entityKey) && (!part.has(m.entityKey) || visIds[m.entityKey].includes(m.muniId))).map(clone);
    if (!out.municipalAllocations.length) delete out.municipalAllocations;
    for (const m of out.municipalAllocations || []) if (part.has(m.entityKey)) visibleTotal += m.amount || 0; // the viewer's target = their whole-Amanah allocations + the municipal allocations they may see
  }
  const contributions = out.allocations.length + (out.municipalAllocations || []).filter((m) => part.has(m.entityKey)).length;
  out.target = { amount: part.size && !contributions ? null : visibleTotal, masked: true, label: MASKED_TARGET_LABEL }; // municipal-only viewer with nothing visible: no target (never 0, never the Amanah's)
  out.advanced = {};
  if (out.baseline) { // the frozen baseline follows the viewer's entities; a viewer who sees an Amanah only through municipal grants gets NO baseline (its Amanah totals must not be derivable)
    if (part.size) delete out.baseline;
    else { const es = out.baseline.entities.filter((e) => vis.has(e.entityKey)); const sm = (k) => es.reduce((t, e) => t + (e[k] || 0), 0); out.baseline = { ...out.baseline, entities: es, annualTarget: sm('annual'), actualToCutoff: sm('actual'), remaining: sm('remaining'), surplus: sm('surplus') }; }
  }
  if (part.size) { out.maskedAmanahKeys = [...part]; out.municipalVisibility = {}; for (const k of part) out.municipalVisibility[k] = authorisedMunicipalities(geo, k); }
  if (out.scope?.kind === 'entities') out.scope = { kind: 'entities', entityKeys: out.scope.entityKeys.filter((k) => vis.has(k)) };
  if (out.entityDistributions) { const ed = {}; for (const k of Object.keys(out.entityDistributions)) if (vis.has(k)) ed[k] = out.entityDistributions[k]; if (Object.keys(ed).length) out.entityDistributions = ed; else delete out.entityDistributions; }
  return out;
}
/**
 * A restricted viewer's copy of a plan record: only the allocations of the entities they may see, `target.amount` replaced by the visible Σ labelled «إجمالي الجهات المتاحة لك», no advanced / basis.
 * `visibleEntityKeys` = the viewer's entities (planAccess.visibleEntityKeysOfScope); a plan whose every entity is visible is returned unchanged (copy). Adds `masked: true` and `visibleEntityKeys`; legacy metadata is withheld.
 * `geoScope` (optional 3rd argument, the viewer's GeoScope; pass it for every restricted viewer): an entity the viewer covers only through MUNICIPAL grants (not the whole-Amanah grant) has its Amanah allocation HIDDEN (not returned,
 * not summed) and only the municipal allocations of the municipalities they may see are returned; target.amount = whole-Amanah allocations + those municipal amounts (none ⇒ null with the masked label). Municipal rows of other
 * municipalities are removed. The content then carries `maskedAmanahKeys` + `municipalVisibility {entityKey: muniId[]}` and the plan `municipalOnlyEntityKeys` — nothing from which the Amanah total or the unallocated figure could be derived.
 * Without `geoScope` the behaviour is exactly the earlier one (any grant makes the entity's allocation visible).
 */
export function maskPlanForViewer(plan, visibleEntityKeys, geoScope) {
  if (!plan) return plan;
  const vis = new Set(Array.isArray(visibleEntityKeys) ? visibleEntityKeys : []);
  const universe = entityUniverse(); const geo = geoScope === undefined ? null : normalizeGeoScope(geoScope);
  const partialOf = (c) => (geo ? contentEntityKeys(c, universe).filter((k) => vis.has(k) && isAmanahKey(k) && !municipalCoverage(geo, k).whole) : []);
  const whole = (c) => { const keys = scopeEntityKeys(c?.scope, universe); return keys.length > 0 && keys.every((k) => vis.has(k)) && partialOf(c).length === 0; };
  const mask = (c) => (c && !whole(c) ? maskContent(c, vis, partialOf(c), geo) : clone(c));
  const next = clone(plan);
  const all = [plan.content, plan.working?.content, ...(plan.versions || []).map((v) => v.content)].filter(Boolean);
  if (plan.content) next.content = mask(plan.content); // the simplified record (spec §10): the saved content, masked like every snapshot
  if (next.working) next.working = { ...next.working, content: mask(plan.working.content) };
  next.versions = (plan.versions || []).map((v) => ({ ...clone(v), ...(v.content ? { content: mask(v.content) } : {}) }));
  if (all.some((c) => !whole(c))) {
    next.masked = true; next.visibleEntityKeys = [...vis]; next.legacy = null;
    const mo = uniq(all.flatMap((c) => (whole(c) ? [] : partialOf(c)))); if (mo.length) next.municipalOnlyEntityKeys = mo;
  }
  return next;
}

// ---- budget aid ----------------------------------------------------------------------------------------------------------------------------------------------
/**
 * A SUGGESTION for the target: communicated budget (Σ expAdjusted of the scope's entities; a Ministry scope includes the headquarters' budget, as the old default did) × coverage.
 * A basis NOTE only — the plan never depends on the budget afterwards. Unavailable where there is no budget data (e.g. another year).
 * @returns { available:false, reason } | { available:true, budget, coverage, suggestion, includesHeadquarters, missing:[entityKey], basis:{method:'budget_x_coverage', coverage, budget, at}, note:{ar,en} }
 */
export function budgetAid({ scope, year = APPROPRIATION_YEAR, coverage = 0.66, at = null } = {}) {
  const keys = scope?.kind === 'ministry' ? appropriationKeys() : scopeEntityKeys(scope).filter((k) => entityUniverse().includes(k));
  if (!keys.length) return { available: false, reason: 'no_scope', ar: 'اختر النطاق أولاً', en: 'Choose the scope first' };
  let budget = 0; const missing = []; let any = false;
  for (const k of keys) { const a = appropriationOf(k, year); if (a) { any = true; budget += a.expAdjusted; } else missing.push(k); }
  if (!any) return { available: false, reason: 'no_budget_data', ar: 'لا تتوفر بيانات ميزانية لهذه السنة', en: 'No budget data is available for this year' };
  const cov = Number(coverage); if (!(cov > 0)) return { available: false, reason: 'invalid_coverage', ar: 'نسبة التغطية غير صالحة', en: 'The coverage is not valid' };
  const includesHeadquarters = keys.includes(HQ_KEY);
  return {
    available: true, budget, coverage: cov, suggestion: Math.round(budget * cov), includesHeadquarters, missing,
    basis: { method: 'budget_x_coverage', coverage: cov, budget, at },
    note: T(`اقتراح فقط: الميزانية المبلغة للأبواب الثلاثة الأولى${includesHeadquarters ? ' (شاملة ميزانية المقر)' : ''} × نسبة التغطية. لا يوجد ارتباط حي؛ المستهدف يبقى رقمًا تكتبه أنت.`, `A suggestion only: the communicated budget of the first three chapters${includesHeadquarters ? ' (including the headquarters)' : ''} × the coverage. There is no live link; the target stays a number you enter.`)
  };
}
