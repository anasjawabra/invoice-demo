// PLAN EDITOR — pure logic (no React, no I/O): amount entry in the platform unit, immutable edits of the client WORKING COPY, edit access, the scope-dependent allocation table, the preview / apply bridge, the monthly
// distribution helpers and the save-validation messages (spec §10: no draft / activation / versions — the page owns saving). Everything user-facing is returned as { ar, en } or as codes the components translate.
// The rules themselves live in src/data/plans/planRules.js (previews, summaries, checks), planAccess.js and planMath.js; this module only adapts them to the editor and never changes a figure on its own.
import * as Rules from '../../../data/plans/planRules.js';
import {
  allocationDifferences, allocationSummary, applyDistributionPreview, applyMunicipalPreview, applyMonthlyPreview, distributionSummary, emptyContent, entityUniverse, municipalRowsOf, municipalSummary,
  normalizeContent, previewDistributeMunicipalRemainder, previewDistributeRemainder, previewMonthlyDistribute, previewRedistributeAll, validateDraft
} from '../../../data/plans/planRules.js';
import { municipalCoverage, mutateDecision, scopeEntityKeys, viewScopeOf } from '../../../data/plans/planAccess.js';
import { BP_TOTAL, fiscalYearPeriod, monthRows } from '../../../data/plans/planMath.js';
import { ENTITIES } from '../../../data/catalog.js';
import { municipalitiesOf } from '../../../data/amanahHierarchy.js';
import { UNITS, scaled } from '../../../utils/money.js';

export const TAB_IDS = ['basics', 'target', 'allocation', 'monthly', 'advanced'];
export const PREVIEW_KINDS = ['entity_remainder', 'entity_all', 'municipal_remainder', 'monthly_equal', 'monthly_remaining'];
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// ---- names ------------------------------------------------------------------------------------------------------------------------------------------------------
const ENTITY_BY_KEY = new Map(ENTITIES.map((e) => [e.en, e]));
/** the display name of an entity key (Arabic / English) */
export const entityName = (key, lang = 'ar') => { const e = ENTITY_BY_KEY.get(key); return e ? (lang === 'en' ? e.en : e.ar) : String(key ?? ''); };
export const muniName = (m, lang = 'ar') => (m ? (lang === 'en' ? m.en || m.ar : m.ar || m.en) : '');
/** a stored user reference {userId, name, nameEn?, currentName?:{ar,en}} → the name to show; null/absent = unknown legacy record */
export function userName(ref, lang = 'ar') {
  if (!ref) return null;
  const cur = ref.currentName && (lang === 'en' ? ref.currentName.en : ref.currentName.ar);
  return cur || (lang === 'en' ? ref.nameEn || ref.name : ref.name || ref.nameEn) || null;
}

// ---- amounts: typed in the platform unit (million riyals) → whole riyals --------------------------------------------------------------------------------------
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** Arabic-Indic digits and separators → plain ASCII number text; grouping marks and spaces are dropped */
export function normalizeNumberText(s) {
  return String(s ?? '').replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٫]/g, '.').replace(/[٬،,\s  ]/g, '').trim();
}
/**
 * "1.5" (million riyals) → { empty:false, invalid:false, riyals:1500000, exact:1500000, rounded:false }. More than 6 decimals cannot be a whole riyal: the value is ROUNDED to the nearest riyal (rounded:true, exact = the unrounded riyals).
 * Blank → { empty:true }. Anything that is not a plain non-negative decimal → { invalid:true } (the field is marked, nothing is stored).
 */
export function parseMillions(text) {
  const s = normalizeNumberText(text);
  if (s === '') return { empty: true, invalid: false, riyals: null, exact: null, rounded: false };
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return { empty: false, invalid: true, riyals: null, exact: null, rounded: false };
  const exact = Number(s) * 1e6; const riyals = Math.round(exact);
  return { empty: false, invalid: !Number.isFinite(riyals), riyals, exact, rounded: Math.abs(exact - riyals) > 1e-3 };
}
/** riyals → the number text in million riyals (exact conversion, grouped), '' for null */
export const milText = (riyals) => (Number.isFinite(Number(riyals)) && riyals !== null ? scaled(riyals, UNITS.M, 'detail') : '');
/** the same number for an input box (no grouping, so it can be edited and parsed back) */
export const milInputText = (riyals) => (Number.isFinite(Number(riyals)) && riyals !== null ? milText(riyals).replace(/,/g, '') : '');
/** whole riyals with grouping — the exact amount for tooltips */
export const riyalText = (riyals, lang = 'ar') => (Number.isFinite(Number(riyals)) && riyals !== null ? `${Math.round(riyals).toLocaleString('en-US')} ${lang === 'en' ? 'SAR' : 'ريال'}` : '—');
/** percentage text of a share (0.123 → «12.3%»), null → «—» (never 0 for a missing share) */
export const shareText = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—');
/** basis points → «8.33» (two decimals, trailing zeros trimmed) */
export const bpText = (bp) => { const s = ((Number(bp) || 0) / 100).toFixed(2); return s.replace(/0+$/, '').replace(/\.$/, ''); };
/** a percentage typed by a person → whole basis points (0.01 % steps; more decimals are rounded) or { invalid } */
export function parsePctToBp(text) {
  const s = normalizeNumberText(text).replace(/%$/, '');
  if (s === '') return { empty: true, invalid: false, bp: 0 };
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return { empty: false, invalid: true, bp: null };
  const bp = Math.round(Number(s) * 100); return { empty: false, invalid: !Number.isFinite(bp), bp };
}
/** a collection rate typed as a percentage (68 → 0.68) or { invalid } */
export function parseRate(text) {
  const s = normalizeNumberText(text).replace(/%$/, '');
  if (s === '') return { empty: true, invalid: false, rate: null };
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return { empty: false, invalid: true, rate: null };
  const rate = Number(s) / 100; return { empty: false, invalid: !(rate > 0 && rate <= 1), rate };
}

// ---- the client working copy --------------------------------------------------------------------------------------------------------------------------------
/** a normalised deep copy of a content (blank when there is none) — the editor never mutates what the page gave it */
export function workingCopy(content) {
  if (!content) return emptyContent({ name: '' });
  if (content.target?.masked || content.maskedAmanahKeys) return clone(content); // a partial (masked) view keeps its masking markers; it is read-only and never normalised away
  return normalizeContent(clone(content));
}
export const contentKey = (content) => JSON.stringify(normalizeContent(content));

/** May this person edit? The page decides (`readOnlyReason`: null = editable, else {ar,en} or a string); a masked plan (the viewer sees only part of it) is never editable. → { canEdit, reason:{ar,en}|null } */
export function effectiveEdit({ readOnlyReason = null, plan = null } = {}) {
  if (readOnlyReason) return { canEdit: false, reason: typeof readOnlyReason === 'object' ? readOnlyReason : { ar: String(readOnlyReason), en: String(readOnlyReason) } };
  if (plan?.masked) return { canEdit: false, reason: plan.municipalOnlyEntityKeys?.length ? { ar: 'لديك صلاحية على بلديات محددة فقط؛ تعديل الخطة يتطلب صلاحية على الأمانة كاملة', en: 'You hold access to specific municipalities only; editing the plan needs access to the whole Amanah' } : { ar: 'نطاق صلاحياتك لا يغطي كل جهات هذه الخطة', en: 'Your access scope does not cover every entity of this plan' } };
  return { canEdit: true, reason: null };
}

/** the entities this actor may put in a plan scope (whole-Amanah grant, or the non-municipal grant for the Housing Sector) and whether the Ministry scope is open to them */
export function scopeChoices(geoScope) {
  const keys = entityUniverse(); const allowed = keys.filter((k) => municipalCoverage(geoScope, k).whole);
  return { entities: keys, allowed, ministryOk: allowed.length === keys.length };
}

/** hard errors that block «حفظ الخطة»: the rules' draft validation (the name is asked for by the page's naming modal, not here) */
export function hardErrors(content, { access = {} } = {}) {
  const v = validateDraft(content, { actorScope: access.geoScope, readOnly: !!access.readOnly });
  return { ok: v.ok, errors: v.errors.slice() };
}

// ---- immutable edits (every function returns a NEW content; blank/unchanged inputs change nothing) -----------------------------------------------------------
const withContent = (content, patch) => ({ ...clone(content), ...patch });
export const setName = (content, name) => withContent(content, { name: String(name ?? '') });
export function setScopeKind(content, kind, allowed = []) {
  if (kind === 'ministry') return withContent(content, { scope: { kind: 'ministry' } });
  const keys = content.scope?.kind === 'entities' ? content.scope.entityKeys : allowed.slice(0, 1);
  return withContent(content, { scope: { kind: 'entities', entityKeys: keys } });
}
export function toggleScopeEntity(content, key, on) {
  const cur = content.scope?.kind === 'entities' ? content.scope.entityKeys.slice() : [];
  const next = on ? [...new Set([...cur, key])] : cur.filter((k) => k !== key);
  const order = entityUniverse(); next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return withContent(content, { scope: { kind: 'entities', entityKeys: next } });
}
export function setPeriodPreset(content, year) { return withContent(content, { period: fiscalYearPeriod(Number(year)) }); }
export function setPeriodRange(content, patch) { return withContent(content, { period: { ...content.period, ...patch, preset: 'range' } }); }
export function setTargetAmount(content, riyals) {
  const c = clone(content); c.target = { ...(c.target || {}), amount: riyals === null || riyals === undefined ? null : Math.round(riyals) }; return c;
}
export function applyBudgetAid(content, aid) {
  const c = clone(content); c.target = { amount: aid.suggestion, basis: { ...aid.basis, at: aid.basis?.at || new Date().toISOString() } }; return c;
}
export function clearTargetBasis(content) { const c = clone(content); if (c.target) delete c.target.basis; return c; }
/** set / clear ONE entity's allocation (blank = remove the row; an edited row becomes manual); unchanged → the same content */
export function setEntityAmount(content, entityKey, riyals) {
  const cur = (content.allocations || []).find((a) => a.entityKey === entityKey);
  if (riyals === null || riyals === undefined) { if (!cur) return content; const c = clone(content); c.allocations = c.allocations.filter((a) => a.entityKey !== entityKey); return c; }
  if (cur && cur.amount === riyals) return content;
  const c = clone(content); const row = (c.allocations || []).find((a) => a.entityKey === entityKey);
  if (row) { row.amount = riyals; row.origin = 'manual'; } else c.allocations = [...(c.allocations || []), { entityKey, amount: riyals, origin: 'manual' }];
  return c;
}
/** set / clear ONE municipality's allocation inside an Amanah (blank = remove the row; an edited row becomes manual) */
export function setMuniAmount(content, entityKey, muniId, riyals) {
  const rows = municipalRowsOf(content, entityKey); const cur = rows.find((r) => r.muniId === muniId);
  if (riyals === null || riyals === undefined) {
    if (!cur) return content; const c = clone(content);
    c.municipalAllocations = (c.municipalAllocations || []).filter((r) => !(r.entityKey === entityKey && r.muniId === muniId)); if (!c.municipalAllocations.length) delete c.municipalAllocations; return c;
  }
  if (cur && cur.amount === riyals) return content;
  const c = clone(content); const list = Array.isArray(c.municipalAllocations) ? c.municipalAllocations : [];
  const row = list.find((r) => r.entityKey === entityKey && r.muniId === muniId);
  if (row) { row.amount = riyals; row.origin = 'manual'; } else list.push({ entityKey, muniId, amount: riyals, origin: 'manual' });
  c.municipalAllocations = list; return c;
}
export function setAdvanced(content, patch) {
  const c = clone(content); c.advanced = { ...(c.advanced || {}), ...patch };
  for (const k of Object.keys(c.advanced)) if (c.advanced[k] === null || c.advanced[k] === undefined) delete c.advanced[k];
  return c;
}

// ---- the allocation table (ONE table; it follows the page's view scope) ---------------------------------------------------------------------------------------
export const ORIGIN_KEYS = ['manual', 'distributed', 'migrated', 'seed', 'derived'];
/**
 * The model of the «التخصيص» tab for the page's view scope.
 *  • Ministry / all entities → { mode:'entities', rows: the plan's entities (+ rows outside the scope, flagged) }; a specific Amanah WITHOUT municipalities → the same table reduced to that Amanah's own row (`single:true`).
 *  • a specific Amanah WITH (authorised) municipalities in the plan scope → { mode:'municipalities', titleKey:'alloc.muniTitle', amanah:{key,name,amount,hidden,hasAllocation}, rows: its municipalities, reconcile }.
 * Saved allocations at both levels are untouched; this only reads. `masked` plans never expose an unallocated / total figure.
 */
export function allocationTableModel({ content, baseContent = null, viewScope, geoScope, lang = 'ar' }) {
  const universe = entityUniverse(); const c = content || {};
  const vs = viewScopeOf(viewScope, { geoScope, universe });
  const scopeKeys = scopeEntityKeys(c.scope, universe);
  const masked = !!c.target?.masked;
  if (vs.amanah !== 'all' && vs.showMunicipality && scopeKeys.includes(vs.amanah)) {
    const ms = municipalSummary(c, vs.amanah); const authorised = new Set(vs.municipalityOptions.map((o) => o.muniId));
    const baseMuni = baseContent ? new Map(municipalRowsOf(baseContent, vs.amanah).map((r) => [r.muniId, r.amount])) : null;
    const rows = ms.municipalities.filter((m) => authorised.has(m.muniId)).map((m) => { const was = baseMuni ? (baseMuni.has(m.muniId) ? baseMuni.get(m.muniId) : null) : undefined; return { ...m, highlight: vs.muni === m.muniId, name: muniName(m.name, lang), baseAmount: was, changed: baseMuni ? was !== m.amount : false }; });
    return {
      mode: 'municipalities', titleKey: 'alloc.muniTitle', view: vs, entityKey: vs.amanah, amanah: { key: vs.amanah, name: entityName(vs.amanah, lang), amount: ms.amanahAmount, hidden: ms.amanahHidden, hasAllocation: ms.hasAllocation },
      rows, reconcile: ms.amanahHidden ? null : { amanahAmount: ms.amanahAmount, allocated: ms.allocated, unallocated: ms.unallocated, excess: ms.excess, complete: ms.complete, unallocatedLabel: ms.unallocatedLabel }, masked: ms.amanahHidden || masked
    };
  }
  const sum = allocationSummary(c); const byKey = new Map(sum.rows.map((r) => [r.entityKey, r]));
  const keys = universe.filter((k) => scopeKeys.includes(k));
  const extra = sum.rows.map((r) => r.entityKey).filter((k) => !keys.includes(k));
  const baseAlloc = baseContent ? new Map((baseContent.allocations || []).map((a) => [a.entityKey, a.amount])) : null;
  let rows = [...keys, ...extra].map((k) => { const r = byKey.get(k); const was = baseAlloc ? (baseAlloc.has(k) ? baseAlloc.get(k) : null) : undefined; return { baseAmount: was, changed: baseAlloc ? was !== (r ? r.amount : null) : false, key: k, name: entityName(k, lang), amount: r ? r.amount : null, share: r ? r.share : null, origin: r ? r.origin : null, note: r?.note || null, outOfScope: !keys.includes(k), hasRow: !!r, highlight: vs.amanah === k }; });
  let notice = null; let single = false;
  if (vs.amanah !== 'all') {
    if (!scopeKeys.includes(vs.amanah) && !byKey.has(vs.amanah)) notice = 'amanah_outside_scope';
    else { rows = rows.filter((r) => r.key === vs.amanah); single = true; }
  }
  return {
    mode: 'entities', titleKey: 'alloc.entityTitle', view: vs, rows, single, notice, masked,
    bar: masked ? null : { target: sum.target, allocated: sum.allocated, unallocated: sum.unallocated, excess: sum.excess, complete: sum.complete, hasTarget: sum.hasTarget },
    muniHint: vs.amanah !== 'all' && single && municipalitiesOf(vs.amanah).length === 0
  };
}
/** the readiness status of a bar / reconciliation: 'complete' | 'unallocated' | 'excess' | 'no_target' */
export function barStatus(b) { if (!b) return null; if (b.excess > 0) return 'excess'; if (b.hasTarget === false) return 'no_target'; if (b.unallocated > 0) return 'unallocated'; return 'complete'; }

/** the per-entity difference between THIS entity plan and the reference plan of its year (shown, never reconciled); null when it does not apply */
export function referenceDifference({ plan, content, referenceView }) {
  if (content?.scope?.kind !== 'entities' || !referenceView || referenceView.referenceState !== 'ok' || (plan && referenceView.planId === plan.id)) return null;
  const d = allocationDifferences({ planId: plan?.id || null, content }, referenceView);
  return d.rows.length ? { ...d, referenceName: referenceView.name, referenceVersionId: referenceView.versionId } : null;
}

// ---- previews (pure; applying is a separate, explicit step) -------------------------------------------------------------------------------------------------------
/** the rows a preview would use by default (what the engine picks), so the dialog can show them ticked */
export function previewDefaults(kind, content, { entityKey = null } = {}) {
  if (kind === 'entity_remainder') { const keys = scopeEntityKeys(content.scope); const have = new Map((content.allocations || []).map((a) => [a.entityKey, a.amount])); return { basis: 'equal', rows: keys.filter((k) => !(have.get(k) > 0)) }; }
  if (kind === 'entity_all') return { basis: 'equal', rows: scopeEntityKeys(content.scope) };
  if (kind === 'municipal_remainder') { const have = new Map(municipalRowsOf(content, entityKey).map((r) => [r.muniId, r.amount])); return { basis: 'equal', rows: municipalitiesOf(entityKey).map((m) => m.refId).filter((id) => !(have.get(id) > 0)) }; }
  if (kind === 'monthly_equal') return { months: monthRows(content.period).map((r) => r.ym) };
  if (kind === 'monthly_remaining') { const d = distOf(content, entityKey); const w = d.profile === 'manual' ? d.weights || {} : {}; return { months: monthRows(content.period).map((r) => r.ym).filter((m) => !(Number(w[m]) > 0)) }; }
  return {};
}
/** PREVIEW of an action → the rules' preview object (ok | {ok:false, code, ar, en}); never changes `content` */
export function buildPreview(kind, content, opts = {}) {
  if (kind === 'entity_remainder') return previewDistributeRemainder(content, { basis: opts.basis, rows: opts.rows });
  if (kind === 'entity_all') return previewRedistributeAll(content, { basis: opts.basis, rows: opts.rows });
  if (kind === 'municipal_remainder') return previewDistributeMunicipalRemainder(content, opts.entityKey, { basis: opts.basis, rows: opts.rows });
  if (kind === 'monthly_equal') return previewMonthlyDistribute(content, { mode: 'equal', months: opts.months, entityKey: opts.entityKey || null });
  if (kind === 'monthly_remaining') return previewMonthlyDistribute(content, { mode: 'remaining', months: opts.months, entityKey: opts.entityKey || null });
  return { ok: false, code: 'invalid_kind', ar: 'إجراء غير معروف', en: 'Unknown action' };
}
/** APPLY a previewed action → { ok, content } | { ok:false, code } (a stale preview is refused). Only called from the dialog's confirm button. */
export function applyPreview(kind, content, preview) {
  if (kind === 'entity_remainder' || kind === 'entity_all') return applyDistributionPreview(content, preview);
  if (kind === 'municipal_remainder') return applyMunicipalPreview(content, preview);
  if (kind === 'monthly_equal' || kind === 'monthly_remaining') return applyMonthlyPreview(content, preview);
  return { ok: false, code: 'invalid_preview' };
}
/** the rows of a preview as a flat, display-ready list: { id, before, after, delta, received (a rounding riyal landed here) } plus the totals the dialog prints */
export function previewRows(preview) {
  if (!preview?.ok) return [];
  const rem = new Set(preview.remainder?.rows || preview.remainder?.months || []);
  return (preview.rows || []).map((r) => ({ id: r.entityKey || r.muniId || r.ym, name: r.name || null, before: r.before, after: r.after, delta: r.delta, received: rem.has(r.entityKey || r.muniId || r.ym) }));
}

// ---- monthly distribution ---------------------------------------------------------------------------------------------------------------------------------------
export const distOf = (content, entityKey = null) => (entityKey && content.entityDistributions?.[entityKey]) || content.distribution || { profile: null };
/** the summary of the plan-level or one entity's distribution (planRules.distributionSummary) plus whether the entity has its own override */
export function monthlyModel(content, entityKey = null) {
  const s = distributionSummary(content, { entityKey });
  return { ...s, rows: monthRows(content.period), overrideAllowed: !!entityKey, inherited: !!entityKey && !content.entityDistributions?.[entityKey] };
}
function putDist(content, entityKey, dist) {
  const c = clone(content);
  if (entityKey) { const ed = { ...(c.entityDistributions || {}) }; if (dist) ed[entityKey] = dist; else delete ed[entityKey]; if (Object.keys(ed).length) c.entityDistributions = ed; else delete c.entityDistributions; }
  else c.distribution = dist || { profile: null };
  return c;
}
/** choose the profile EXPLICITLY (null = none chosen). Manual starts from the weights already stored (empty when switching from equal) — nothing is inherited silently. */
export function setProfile(content, entityKey, profile) {
  const cur = distOf(content, entityKey);
  if (profile === 'manual') return putDist(content, entityKey, { profile: 'manual', weights: cur.profile === 'manual' ? { ...(cur.weights || {}) } : {} });
  if (profile === 'equal') return putDist(content, entityKey, { profile: 'equal' });
  return entityKey ? putDist(content, entityKey, null) : putDist(content, null, { profile: null });
}
/** type one month's share in basis points (manual profile only); NEVER rescales the other months */
export function setMonthBp(content, entityKey, ym, bp) {
  const cur = distOf(content, entityKey); if (cur.profile !== 'manual') return content;
  if ((Number(cur.weights?.[ym]) || 0) === bp) return content;
  return putDist(content, entityKey, { profile: 'manual', weights: { ...(cur.weights || {}), [ym]: Math.max(0, Math.round(bp)) } });
}
/** give one entity its own monthly distribution (starts as the explicit equal one) or take it back */
export function setEntityOverride(content, entityKey, on) { return on ? putDist(content, entityKey, { profile: 'equal' }) : putDist(content, entityKey, null); }

// ---- save validation (spec §10: shown as plain inline messages) ----------------------------------------------
/**
 * The rules a plan must meet to be SAVED: target > 0 · allocations = target · inside scope · explicit profile · months 100 % · municipal Σ ≤ Amanah · actor authorised.
 * → { ok, checks:[{id, ok, params, label}], failed:id[] }
 */
export function saveChecksOf(content, { plan = null, access = {} } = {}) {
  const ctx = { planId: plan?.id || null, actorScope: access.geoScope, readOnly: !!access.readOnly };
  const res = Rules.saveChecks(content, ctx);
  const checks = res.checks || [];
  const failed = checks.filter((c) => !c.ok).map((c) => c.id);
  return { ok: failed.length === 0, checks, failed };
}
/** where each failing rule is fixed: the tab to go to and the explicit action (if any) that fixes it */
export const CHECK_FIX = {
  target_positive: { tab: 'target' },
  allocation_complete: { tab: 'allocation', action: 'entity_remainder' },
  allocations_in_scope: { tab: 'basics' },
  profile_explicit: { tab: 'monthly' },
  months_complete: { tab: 'monthly', action: 'monthly_remaining' },
  actor_authorised: { tab: null },
  municipal_within_entity: { tab: 'allocation' }
};

export { BP_TOTAL };
