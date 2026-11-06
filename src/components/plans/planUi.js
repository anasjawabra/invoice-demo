// «خطط الإيرادات» — the PURE helpers behind the ONE plan page (no React, no I/O): labels, the plan selector rows, the working-copy view, save modes and naming rules, and the save error texts. Workflow: docs/revenue-plans-spec.md §10.
// Everything user-facing is bilingual { ar, en }; nothing here calculates a plan figure (those come from planBasis / planForecast / planMeasures).
import * as rules from '../../data/plans/planRules';
import { isCalendarYear } from '../../data/plans/planMath';
import { mutateDecision } from '../../data/plans/planAccess';
const { normalizeContent } = rules;
import { ENTITIES } from '../../data/catalog';
import { HQ_KEY } from '../../data/appropriations';

export const bi = (ar, en) => ({ ar, en });
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
export const pickL = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (lang === 'en' ? o.en : o.ar) || o.en || o.ar || '');

export const UNKNOWN_OWNER = bi('غير معروف (سجل سابق)', 'Unknown (earlier record)');
export const PERSONAL_DEFAULT = bi('افتراضية', 'Default');
export const SYSTEM_DEFAULT = bi('الخطة الافتراضية للنظام · بيانات توضيحية', 'The system default plan · illustrative data');
/** a system plan that is NOT the global default (e.g. the 2026 illustrative seed) */
export const SYSTEM_PLAN = bi('خطة النظام · بيانات توضيحية', 'System plan · illustrative data');
/** the label of an upcoming plan period (the plan starts in the future) */
export const upcomingLabel = (start, fmtDate) => bi(`قادمة — تبدأ ${fmtDate ? fmtDate(start) : start}`, `Upcoming — starts ${fmtDate ? fmtDate(start) : start}`);
/** the plan's name in the interface language: a SYSTEM plan carries `nameEn`; saved / user plans keep their single name */
export const displayName = (plan, lang = 'ar') => (lang === 'en' && plan && plan.nameEn ? plan.nameEn : (plan && (plan.name || plan.content?.name)) || '');
export const UNSAVED = bi('تغييرات غير محفوظة', 'Unsaved changes');

/** the bilingual name of an entity key (the catalog's own names; the headquarters row has its own label) */
export function entityNameOf(key) {
  if (key === HQ_KEY) return bi('ديوان عام الوزارة (المقر)', 'Ministry headquarters');
  const e = ENTITIES.find((x) => x.en === key); return e ? bi(e.ar, e.en) : bi(String(key), String(key));
}

/* ------------------------------------------------------------------------------------------------ people */
/** a stored user reference { userId, name, nameEn?, currentName?: {ar,en} } (or { system: true }) → bilingual text. null = UNKNOWN (a seed / imported legacy record). */
export function userText(u) {
  if (!u) return UNKNOWN_OWNER;
  if (u.system) return bi('النظام', 'System');
  const ar = u.currentName?.ar || u.name || u.nameEn || ''; const en = u.currentName?.en || u.nameEn || u.name || '';
  return ar || en ? bi(ar || en, en || ar) : UNKNOWN_OWNER;
}

/* ------------------------------------------------------------------------------------------------ scope / period text */
export function scopeText(scope, nameOf, { max = 3 } = {}) {
  if (!scope || scope.kind === 'ministry') return bi('الوزارة (كل الجهات)', 'The Ministry (all entities)');
  const keys = scope.entityKeys || []; const ar = keys.slice(0, max).map((k) => pickL(nameOf(k), 'ar')); const en = keys.slice(0, max).map((k) => pickL(nameOf(k), 'en'));
  const more = keys.length - max;
  return bi(`${keys.length} جهة: ${ar.join('، ')}${more > 0 ? ` و${more} أخرى` : ''}`, `${keys.length} ${keys.length === 1 ? 'entity' : 'entities'}: ${en.join(', ')}${more > 0 ? ` and ${more} more` : ''}`);
}
export function periodText(period, fmtDate) {
  if (!period) return bi('—', '—');
  const a = fmtDate ? fmtDate(period.start) : period.start; const b = fmtDate ? fmtDate(period.end) : period.end;
  if (isCalendarYear(period)) { const y = period.start.slice(0, 4); return bi(`السنة ${y} (${a} – ${b})`, `Year ${y} (${a} – ${b})`); }
  return bi(`${a} – ${b}`, `${a} – ${b}`);
}

/* ------------------------------------------------------------------------------------------------ saved plans · working copy · save modes (§10) */
/** the saved content of a plan record (the §10 record carries `content`) */
export const savedContentOf = (plan) => (plan && plan.content) || null;
/**
 * The `view` the calculation core reads (planBasis.planningBasisFromPlan / loadPlanInputsForPlan): the SAVED plan (`working` false) or the client WORKING COPY (`working` true — a live preview, never stored).
 * The version id is stable while the copy is edited (`<id>@working`), so the loaded data stays valid for it; a saved plan's id carries its revision (`<id>@r<revision>`).
 */
export function viewOf(plan, content, { working = false } = {}) {
  if (!content) return null;
  const id = plan?.id || 'new';
  return { planId: id, versionId: working ? `${id}@working` : `${id}@r${plan?.revision ?? 0}`, versionNumber: null, name: content.name, ...(plan?.nameEn ? { nameEn: plan.nameEn } : {}), state: 'saved', origin: plan?.origin || 'user', isSystem: !!plan?.isSystem,
    period: content.period, scope: content.scope, content, isHistorical: false, working, masked: !!plan?.masked };
}
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x));
/** does the working copy differ from the saved content? (canonical comparison — key order and null-vs-absent noise are ignored) */
export function isDirty(base, working) {
  if (!working) return false;
  const norm = (c) => stable(normalizeContent(c || {}));
  return !base || norm(base) !== norm(working);
}
export function newPlanContent({ year, name = '' } = {}) { return rules.emptyContent({ name, year }); }

/**
 * the default flags of a plan for the selector: `personal` (the caller's EXPLICIT choice) · `global` (the GLOBAL default plan every user opens unless they chose their own; alias `system`, which also stays true for a system plan when the
 * server named no global default) · `illustrative` (a system plan that is not the global default) · `effective` (what /planning opens). When the personal and the global default are the SAME plan, ONE indicator is shown: the global marker.
 */
export function defaultFlags(plan, defaults) {
  const g = defaults?.globalDefaultPlanId || defaults?.systemDefaultPlanId || null;
  const global = g ? g === plan.id : !!plan.isSystem && !defaults?.effectiveDefaultPlanId;
  const personal = !!defaults?.userDefaultPlanId && defaults.userDefaultPlanId === plan.id && !global;
  return { personal, global, system: global, illustrative: !!plan.isSystem && !global, effective: !!defaults?.effectiveDefaultPlanId && defaults.effectiveDefaultPlanId === plan.id };
}
/** the rows of the plan selector: name · period · scope · owner · default flags — NO performance figures. Order: the personal default, the global default, the other system plans, then by name. `query` filters name (both languages) / owner. */
export function selectorRows(plans, defaults, { query = '', nameOf = entityNameOf, lang = 'ar' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const rows = (plans || []).map((plan) => { const content = savedContentOf(plan); return { plan, content, flags: defaultFlags(plan, defaults), name: displayName(plan, lang) || content?.name || '' }; }).filter((r) => r.content);
  const hit = (r) => !q || [r.name, r.plan.name, r.plan.nameEn, userText(r.plan.createdBy).ar, userText(r.plan.createdBy).en].some((x) => String(x || '').toLowerCase().includes(q));
  const rank = (r) => (r.flags.personal ? 0 : r.flags.global ? 1 : r.flags.illustrative ? 2 : 3);
  return rows.filter(hit).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, lang === 'en' ? 'en' : 'ar'));
}

/** how «حفظ الخطة» behaves: 'create' (the naming modal — a new plan, the system plan, or a plan this person may not edit) · 'update' (PUT the same plan) · 'none' (a read-only role: disabled with the reason) */
export function saveMode(plan, { canEdit = false, readOnly = false, isNew = false } = {}) {
  if (readOnly) return { mode: 'none', reason: bi('دورك للقراءة فقط ولا يسمح بحفظ الخطط', 'Your role is read-only and cannot save plans') };
  if (isNew || !plan) return { mode: 'create', reason: null };
  if (plan.isSystem) return { mode: 'create', reason: bi('الخطة الافتراضية للنظام لا تُعدَّل؛ يُحفظ تعديلك كخطة جديدة باسمك', 'The system default plan is never overwritten; your changes are saved as a new plan of yours') };
  if (!canEdit) return { mode: 'create', reason: bi('لا تملك صلاحية تعديل هذه الخطة؛ يُحفظ تعديلك كخطة جديدة باسمك', 'You may not edit this plan; your changes are saved as a new plan of yours') };
  return { mode: 'update', reason: null };
}
/** may this person edit THIS plan in place? (the server enforces the same rule: 403) */
export function canEditPlan(plan, { geoScope, readOnly = false } = {}) {
  if (!plan || plan.isSystem || readOnly || plan.masked) return false;
  if (typeof plan.viewer?.canEdit === 'boolean') return plan.viewer.canEdit;
  const c = savedContentOf(plan); return !!c && !plan.masked && mutateDecision(geoScope, c.scope, { readOnly }).ok;
}
/** name rules: trimmed, 1–80 characters, unique (case-insensitive) among the plans visible to the actor (`exceptId` = the plan being renamed) → null | { code, text:{ar,en} } */
export function nameProblem(name, plans, exceptId = null) {
  const t = String(name || '').trim();
  if (!t) return { code: 'name_required', text: bi('اكتب اسم الخطة', 'Enter the plan name') };
  if (t.length > 80) return { code: 'name_too_long', text: bi('اسم الخطة 80 حرفاً كحد أقصى', 'The plan name is 80 characters at most') };
  const taken = (plans || []).find((p) => p.id !== exceptId && String(p.name || savedContentOf(p)?.name || '').trim().toLowerCase() === t.toLowerCase());
  return taken ? { code: 'name_taken', text: bi('يوجد خطة بهذا الاسم؛ اختر اسماً آخر', 'A plan with this name exists; choose another name') } : null;
}
/** the save validation shown BEFORE the request (the server is the authority): hard errors of the draft rules + the failed save checks. → [{ id, text:{ar,en}, params }] */
export function clientSaveProblems(content, ctx0 = {}) {
  const ctx = { actorScope: ctx0.actorScope !== undefined ? ctx0.actorScope : ctx0.geoScope, readOnly: !!ctx0.readOnly, universe: ctx0.universe };
  const out = [];
  const v = rules.validateDraft ? rules.validateDraft(content, ctx) : { errors: [] };
  for (const e of v.errors || []) out.push({ id: e.code, text: bi(e.ar, e.en), params: e.params });
  if (!out.length) {
    const checks = rules.saveChecks(content, ctx);
    for (const c of checks.checks || []) if (!c.ok) out.push({ id: c.id, text: c.label, params: c.params });
  }
  return out;
}
/** a failed save / default / reference request → bilingual text lines (the server's own wording first) */
export function requestProblems(e) {
  if (!e) return [];
  if (e.errors?.length) return e.errors.map((x) => bi(x.ar || x.code, x.en || x.code));
  if (e.checks?.length) { const f = e.checks.filter((c) => !c.ok); if (f.length) return f.map((c) => c.label || bi(c.id, c.id)); }
  const m = {
    system_plan_readonly: bi('الخطة الافتراضية للنظام لا تُعدَّل. احفظ كخطة جديدة.', 'The system default plan cannot be changed. Save as a new plan.'),
    read_only_role: bi('دورك للقراءة فقط ولا يسمح بحفظ الخطط.', 'Your role is read-only and cannot save plans.'),
    forbidden: bi('نطاق صلاحيتك لا يغطي كل جهات هذه الخطة.', 'Your access scope does not cover every entity of this plan.'),
    name_taken: bi('يوجد خطة بهذا الاسم؛ اختر اسماً آخر.', 'A plan with this name exists; choose another name.'),
    name_required: bi('اكتب اسم الخطة.', 'Enter the plan name.'),
    plan_not_found: bi('الخطة لم تعد متاحة لك.', 'The plan is no longer available to you.'),
    reference_not_eligible: bi('هذه الخطة لا تغطي العام المختار.', 'This plan does not cover the chosen year.'),
    network: bi('تعذّر الاتصال بخدمة البيانات.', 'Could not reach the data service.')
  };
  return [m[e.code] || (e.reason && m[e.reason]) || bi(`تعذّر تنفيذ الطلب (${e.code || 'خطأ'}).`, `The request failed (${e.code || 'error'}).`)];
}
export const isConflict = (e) => !!e && e.code === 'revision_conflict';
export const municipalOnlyViewer = (plan) => !!(plan?.municipalOnlyEntityKeys && plan.municipalOnlyEntityKeys.length);
