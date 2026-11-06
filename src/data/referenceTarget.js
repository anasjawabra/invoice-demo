// THE REFERENCE-PLAN TARGET — what every NON-plan consumer (Decision Room, dashboard target, Smart Reports, assistant, fixed reports, analysis tasks, exports) reads as «the target» (revenue plans, spec §2 «Reference plan», §9).
// There is ONE source: the plan the data service's references name for the calendar year (planStore.referenceViewFor → resolveReferencePlan), read at its latest SAVED content (spec §10; an unsaved working copy is never read). Nothing is read from the browser
// (the old browser-stored device record is NOT touched here), nothing is chosen silently among several plans, and nothing is ever added across plans.
//
//   referenceFor(year)                         → { referenceState, view?, candidates?, reason?, planId?, source?, sourceLabel? }
//        referenceState: 'ok' | 'ambiguous' | 'none' | 'reference_invalid' (the four states of the reference rules) + 'not_loaded' (plans not on this device yet) | 'no_access' (the person has no planning module)
//   referenceTargets(entityKeys, { year, base, viewScope }) → a LIVE `targets` object (the revenueMetrics shape, getters read the plan store on every access, memoised per store version):
//        fiscalYear · collectionRate · collectionAmountAnnual { value|null, status: 'demo'|'plan'|'unavailable', version(Id), versionNumber, planId, planName, source:'plan', provenance, unavailable } ·
//        monthlyCurve { curveMode:'plan', weights[12] (planned share of the plan target per calendar month of the year), profile } · scopeKind 'ministry'|'available'|'amanah'|'municipality'|'plan_entities' · scopeLabel ·
//        scopeEntityKeys · viewScope · reference {…the printable source…}
//        value === null means UNAVAILABLE (no plan / ambiguous / invalid / no municipal target): it is never read as 0, and no consumer may invent one.
//   targetsForScope(targets, scope)            → the same object bound to the VIEW scope of a report (one Amanah, optionally one municipality): spec §9 — the municipality's explicit allocation or «لم يُحدد مستهدف لهذه البلدية»
//   referenceLine(reference, lang) · referenceNotice(reference, lang) · targetSourceText(targets, lang) · targetUnavailableText(targets, lang)   the sentences every surface prints
//   planSourceOf(reference)                    → { planId, versionId, versionNumber, name, label } | null  (what an item / report / export carries)
// Pure apart from reading the plan store (a plain module: safe in Node tests, where the store is injected with `setPlansForTest`).
import { referenceViewFor, plansStatus, getPlans, getSnapshot } from './plans/planStore.js';
import { planningBasisFromPlan, planScope, normalizeViewScope, RESTRICTED_LABEL, MINISTRY_LABEL, NO_MUNICIPAL_TARGET, PLAN_STATE_TEXT } from './plans/planBasis.js';
import { parseMuniKey } from './municipalityModel';
import { APPROPRIATION_YEAR } from './appropriations';

const bi = (ar, en) => ({ ar, en });
const MONTHS = 12;
const pad2 = (n) => String(n).padStart(2, '0');
export const REFERENCE_LINK = '/planning';
export const AVAILABLE_LABEL = RESTRICTED_LABEL;
const REF_REASON = {
  not_found: bi('الخطة المحددة غير موجودة', 'the configured plan no longer exists'),
  period_mismatch: bi('فترة الخطة المحددة لا تغطي هذه السنة', 'the configured plan’s period does not cover this year')
};

/* ------------------------------------------------------------------------------------------------ the reference state (with the cache's load status) */
export function referenceFor(year = APPROPRIATION_YEAR) {
  const st = plansStatus(); const have = getPlans().length > 0;
  if (st === 'forbidden') return { referenceState: 'no_access', state: 'no_access' };
  if ((st === 'idle' || st === 'loading' || st === 'error') && !have) return { referenceState: 'not_loaded', state: 'not_loaded' };
  return referenceViewFor(year);
}

/* ------------------------------------------------------------------------------------------------ printable lines */
const nm = (c) => c.name || c.planId;
/** «الخطة المرجعية: <name>» (or «الخطة الوحيدة المؤهلة …» when no reference is configured and exactly one plan is eligible) */
export function referenceLine(ref, lang = 'ar') {
  if (!ref || ref.state !== 'ok') return null;
  const pre = ref.source === 'only_eligible' ? bi('الخطة الوحيدة المؤهلة', 'The only eligible plan') : bi('الخطة المرجعية', 'Reference plan');
  const line = bi(`${pre.ar}: ${ref.name}`, `${pre.en}: ${ref.name}`); // the plan NAME is what people see; the saved snapshot (versionId) travels in the data, not in the wording (spec §10)
  return lang ? line[lang === 'ar' ? 'ar' : 'en'] : line;
}
/** the sentence of a state that is NOT ok (or an ok plan without a target for the view): never a number */
export function referenceNotice(ref, lang = 'ar') {
  if (!ref) return null;
  const pick = (m) => (lang ? m[lang === 'ar' ? 'ar' : 'en'] : m);
  const y = ref.year;
  if (ref.state === 'ok') {
    if (ref.targetState === 'no_municipal_target') return pick(NO_MUNICIPAL_TARGET);
    if (ref.targetState === 'no_target') return pick(PLAN_STATE_TEXT.no_target);
    if (ref.targetState === 'invalid_view_scope') return pick(PLAN_STATE_TEXT.invalid_view_scope);
    return null;
  }
  const list = (ref.candidates || []).map((c) => nm(c));
  const m = {
    ambiguous: bi(`لا خطة مرجعية محددة لعام ${y} وهناك أكثر من خطة محفوظة مؤهلة (${list.join('، ')}): لا يُعرض مستهدف ولا يُختار أحدها تلقائيًا. حدّد الخطة المرجعية من صفحة «خطط الإيرادات» (${REFERENCE_LINK}).`,
      `No reference plan is set for ${y} and more than one saved plan is eligible (${list.join(', ')}): no target is shown and none is picked automatically. Set the reference plan on the revenue plans page (${REFERENCE_LINK}).`),
    none: bi(`لا توجد خطة محفوظة لعام ${y}: المستهدف غير متاح (وليس صفرًا). أنشئ خطة واحفظها من صفحة «خطط الإيرادات» (${REFERENCE_LINK}).`, `There is no saved plan for ${y}: the target is unavailable (not zero). Create and save a plan on the revenue plans page (${REFERENCE_LINK}).`),
    reference_invalid: bi(`الخطة المرجعية المحددة لعام ${y} لم تعد صالحة (${(REF_REASON[ref.reason] || bi(ref.reason || '—', ref.reason || '—')).ar}): المستهدف غير متاح ولا يُستبدل بخطة أخرى. راجع ${REFERENCE_LINK}.`,
      `The reference plan set for ${y} is no longer valid (${(REF_REASON[ref.reason] || bi(ref.reason || '—', ref.reason || '—')).en}): the target is unavailable and no other plan is substituted. See ${REFERENCE_LINK}.`),
    not_loaded: bi('خطط الإيرادات لم تُحمَّل بعد في هذه الجلسة: المستهدف غير متاح مؤقتًا (وليس صفرًا).', 'The revenue plans are not loaded in this session yet: the target is temporarily unavailable (not zero).'),
    no_access: bi('لا صلاحية لقراءة الخطة المرجعية (وحدة التخطيط): المستهدف غير متاح لك.', 'You do not have access to read the reference plan (planning module): the target is unavailable to you.')
  }[ref.state];
  return m ? pick(m) : null;
}
/** the single line a surface prints beside a target: the source plan name (+ the viewer / view scope), or the notice when there is none */
export function targetSourceText(targets, lang = 'ar') {
  const ref = targets?.reference; if (!ref) return null;
  const ar = lang === 'ar';
  if (ref.state !== 'ok') return referenceNotice(ref, lang);
  const parts = [referenceLine(ref, lang)];
  if (targets.scopeKind === 'available') parts.push((ar ? AVAILABLE_LABEL.ar : AVAILABLE_LABEL.en));
  else if ((targets.scopeKind === 'amanah' || targets.scopeKind === 'municipality') && targets.scopeLabel) parts.push(ar ? `نطاق المستهدف: ${targets.scopeLabel.ar}` : `Target scope: ${targets.scopeLabel.en}`);
  if (ref.targetState && ref.targetState !== 'ok') parts.push(referenceNotice(ref, lang));
  return parts.join(' — ');
}
/** non-null exactly when the target cannot be used (state not ok, or no target for the view): the sentence to print instead of a number */
export function targetUnavailableText(targets, lang = 'ar') {
  const ref = targets?.reference; if (!ref) return null;
  if (ref.state !== 'ok') return referenceNotice(ref, lang);
  if (targets.collectionAmountAnnual?.value == null || ref.targetState === 'no_target') return `${referenceLine(ref, lang)} — ${referenceNotice(ref, lang) || (lang === 'ar' ? 'لا مستهدف لهذا النطاق' : 'no target for this scope')}`;
  return null;
}
/** what an item / report / export carries about its source plan */
export const planSourceOf = (ref) => (ref && ref.state === 'ok' ? { planId: ref.planId, versionId: ref.versionId, versionNumber: ref.versionNumber, name: ref.name, origin: ref.origin ?? null, source: ref.source, label: referenceLine(ref, null) } : null);

/* ------------------------------------------------------------------------------------------------ the computation */
const sum = (a, f = (x) => x) => a.reduce((t, x) => t + f(x), 0);
const monthKey = (year, i) => `${year}-${pad2(i + 1)}`;
function unavailable(ref, year, extra = {}) {
  return { ok: false, reference: { state: ref.referenceState || ref.state, ok: false, year, candidates: ref.candidates ? ref.candidates.map((c) => ({ planId: c.planId, name: c.name, versionId: c.versionId, versionNumber: c.versionNumber })) : undefined, reason: ref.reason, planId: ref.planId ?? null, link: REFERENCE_LINK, label: null, targetState: null, ...extra }, T: null, weights: Array(MONTHS).fill(0), scopeKind: 'ministry', scopeLabel: MINISTRY_LABEL, profile: null, entityKeys: null };
}
const restrictedOf = (b, masked) => !!b.restricted || !!masked;
const profileOf = (view) => {
  const p = view?.content?.distribution?.profile ?? null;
  return { kind: p, assumption: p === 'equal', label: p === 'equal' ? bi('توزيع متساوٍ — افتراض', 'Equal distribution — an assumption') : p === 'manual' ? bi('توزيع شهري يدوي', 'Manual monthly distribution') : bi('لم يُحدَّد توزيع شهري', 'No monthly distribution chosen') };
};

function compute(year, entityKeys, viewScope, { muniGroup = false } = {}) {
  const ref = referenceFor(year);
  if (ref.referenceState !== 'ok') return unavailable(ref, year);
  const view = ref; const content = view.content || {};
  const vs = normalizeViewScope(viewScope);
  const bound = vs.amanah !== 'all';
  const keys = Array.isArray(entityKeys) && entityKeys.length ? entityKeys : null;
  const base = { state: 'ok', ok: true, year, planId: view.planId, versionId: view.versionId, versionNumber: view.versionNumber, name: view.name, origin: view.origin ?? null, illustrative: view.origin === 'seed' || view.isSystem === true, source: view.source, sourceLabel: view.sourceLabel, period: view.period, planScopeKind: view.scope?.kind ?? null, link: REFERENCE_LINK };
  const masked = content.target?.masked === true || view.masked === true;
  const b = planningBasisFromPlan({ view, entityKeys: keys, viewScope: bound ? vs : null });
  if (b.state === 'invalid_view_scope' || b.state === 'invalid_period') {
    const reference = { ...base, targetState: b.state, reason: b.reason, viewScope: vs, viewLabel: null, municipalState: null, masked: restrictedOf(b, masked), label: null }; reference.label = referenceLine(reference, null);
    return { ok: true, reference, T: null, weights: Array(MONTHS).fill(0), scopeKind: 'ministry', scopeLabel: MINISTRY_LABEL, profile: profileOf(view), entityKeys: null, period: view.period };
  }
  // planned amounts per calendar month of `year` (a month outside the plan period plans nothing)
  const plannedOf = (basis) => Array.from({ length: MONTHS }, (_, i) => { const m = (basis.months || []).find((x) => x.ym === monthKey(year, i)); return m ? m.planned : 0; });
  let T = b.target?.value ?? null; let planned = plannedOf(b);
  let scopeKind; let scopeLabel; let restricted = !!b.restricted || masked || (!bound && b.scopeKind === 'available');
  // a municipal-only viewer: the whole-Amanah allocations they hold + the municipal allocations they may see (the Amanah's own amount is withheld by the server) — «إجمالي الجهات المتاحة لك»
  const maskedAmanahs = !bound && Array.isArray(content.maskedAmanahKeys) ? content.maskedAmanahKeys : [];
  if (maskedAmanahs.length) {
    let t = T > 0 ? T : 0; const pl = planned.map((x) => x || 0); let any = T > 0;
    for (const A of maskedAmanahs) {
      const ba = planningBasisFromPlan({ view, entityKeys: keys, viewScope: { amanah: A, muni: 'all' } });
      if (ba.target?.value > 0) { any = true; t += ba.target.value; plannedOf(ba).forEach((x, i) => { pl[i] += x || 0; }); }
    }
    T = any ? t : null; planned = pl; restricted = true;
  }
  const mp = b.municipalState || null;
  if (bound) {
    scopeKind = b.scopeKind === 'municipality' ? 'municipality' : 'amanah'; scopeLabel = b.target?.label || b.viewLabel || b.scopeLabel || null; // a hidden Amanah amount (municipal-only viewer) is labelled «إجمالي الجهات المتاحة لك»
  } else if (restricted) { scopeKind = 'available'; scopeLabel = RESTRICTED_LABEL; }
  else if (view.scope?.kind === 'entities') { scopeKind = 'plan_entities'; scopeLabel = bi('الجهات المشمولة بالخطة', 'The entities covered by the plan'); }
  else { scopeKind = 'ministry'; scopeLabel = MINISTRY_LABEL; }
  if (muniGroup) { T = null; planned = Array(MONTHS).fill(0); }
  let targetState = 'ok';
  if (muniGroup || b.state === 'no_municipal_target') targetState = 'no_municipal_target';
  else if (!(T > 0)) targetState = 'no_target';
  const weights = T > 0 ? planned.map((x) => (x || 0) / T) : Array(MONTHS).fill(0);
  const sc = planScope(view.scope, keys);
  const planEntityKeys = view.scope?.kind === 'entities' && !bound ? sc.visible.slice() : null;
  const reference = { ...base, targetState, viewScope: vs, viewLabel: bound ? scopeLabel : null, municipalState: mp, masked: restricted, label: null };
  reference.label = referenceLine(reference, null);
  return { ok: true, reference, T: targetState === 'ok' ? T : (T === 0 && targetState === 'no_target' ? 0 : null), weights, scopeKind, scopeLabel, profile: profileOf(view), entityKeys: planEntityKeys, period: view.period };
}

let memoKey = null; const memo = new Map();
function cached(year, entityKeys, viewScope, flags) {
  const ver = getSnapshot().version; if (memoKey !== ver) { memo.clear(); memoKey = ver; }
  const k = `${year}|${entityKeys ? entityKeys.join(',') : '-'}|${viewScope ? `${viewScope.amanah}/${viewScope.muni}` : '-'}|${flags?.muniGroup ? 'g' : ''}`;
  if (!memo.has(k)) memo.set(k, compute(year, entityKeys, viewScope, flags));
  return memo.get(k);
}

/**
 * A live `targets` object. `entityKeys` = the viewer's entity keys (null/empty = no narrowing → the plan's own target); `base` = { fiscalYear, collectionRate } carried unchanged (the collection-rate target is a separate illustrative input).
 * Every read goes through the plan store, so saving a plan (or changing the reference) reaches every surface at its next read; an unsaved working copy changes nothing (the store holds saved content only).
 */
export function referenceTargets(entityKeys = null, { year = APPROPRIATION_YEAR, base = {}, viewScope = null, muniGroup = false } = {}) {
  const keys = Array.isArray(entityKeys) && entityKeys.length ? entityKeys.slice() : null;
  const vs = viewScope ? normalizeViewScope(viewScope) : null;
  const read = () => cached(year, keys, vs && (vs.amanah !== 'all' || vs.muni !== 'all') ? vs : null, { muniGroup });
  const statusOf = (r) => (r.reference.state !== 'ok' ? 'unavailable' : r.reference.illustrative ? 'demo' : 'plan');
  const amountOf = () => {
    const r = read(); const ref = r.reference; const ok = ref.state === 'ok' && r.T != null && ref.targetState !== 'no_municipal_target';
    return {
      value: ok ? r.T : null, status: ok ? statusOf(r) : 'unavailable', unavailable: ok && ref.targetState === 'ok' ? null : (ref.state !== 'ok' ? ref.state : ref.targetState),
      version: ref.versionId ?? null, versionId: ref.versionId ?? null, versionNumber: ref.versionNumber ?? null, planId: ref.planId ?? null, planName: ref.name ?? null, owner: null, editedAt: null, source: 'plan',
      provenance: ref.state === 'ok' ? bi(`${referenceLine(ref, null).ar}${ref.illustrative ? ' — بيانات توضيحية' : ''}.`, `${referenceLine(ref, null).en}${ref.illustrative ? ' — illustrative data' : ''}.`) : bi(referenceNotice(ref, 'ar'), referenceNotice(ref, 'en'))
    };
  };
  const o = { fiscalYear: base.fiscalYear ?? year, collectionRate: base.collectionRate ?? { value: 0.6, status: 'demo', version: 1 } };
  if (keys) o.scopeEntityKeys = keys.slice();
  const defs = {
    collectionAmountAnnual: { enumerable: true, get: amountOf },
    monthlyCurve: { enumerable: true, get: () => { const r = read(); return { curveMode: 'plan', weights: r.weights, equalWeights: r.weights, status: 'demo', source: 'plan', profile: r.profile }; } },
    scopeKind: { enumerable: true, get: () => read().scopeKind },
    scopeLabel: { enumerable: true, get: () => read().scopeLabel },
    reference: { enumerable: true, get: () => read().reference },
    viewScope: { enumerable: true, get: () => read().reference.viewScope || { amanah: 'all', muni: 'all' } },
    planEntityKeys: { enumerable: true, get: () => read().entityKeys }
  };
  const t = Object.defineProperties(o, defs);
  Object.defineProperty(t, '__rebuild', { enumerable: false, value: { entityKeys: keys, year, base: { fiscalYear: o.fiscalYear, collectionRate: o.collectionRate } } });
  return t;
}

/**
 * The targets bound to the VIEW scope of a report (spec §9): a scope of exactly ONE Amanah reads that Amanah's allocation; one reference municipality reads that municipality's explicit allocation,
 * or «لم يُحدد مستهدف لهذه البلدية» (never the Amanah's target, never a division of it); an explicit municipality group (direct / not specified / needs review) has no municipal target either.
 * Any other scope (all / several Amanahs) returns `targets` unchanged. Targets not built by `referenceTargets` are returned unchanged.
 */
export function targetsForScope(targets, scope) {
  const rb = targets?.__rebuild; if (!rb || !scope) return targets;
  const am = scope.amanah; if (typeof am !== 'string' || am === 'all') return targets;
  const mk = scope.muni && scope.muni !== 'all' ? parseMuniKey(scope.muni) : null;
  if (mk && mk.invalid) return referenceTargets(rb.entityKeys, { year: rb.year, base: rb.base, viewScope: { amanah: am, muni: 'all' }, muniGroup: true });
  if (mk && mk.kind !== 'mapped') return referenceTargets(rb.entityKeys, { year: rb.year, base: rb.base, viewScope: { amanah: am, muni: 'all' }, muniGroup: true });
  return referenceTargets(rb.entityKeys, { year: rb.year, base: rb.base, viewScope: { amanah: am, muni: mk ? mk.refId : 'all' } });
}

/** does this targets object describe the target of the report scope `sc`? (the narrower-scope caveat of the achievement is raised when not) */
export function targetCoversScope(targets, sc) {
  const vs = targets?.viewScope;
  if (vs && vs.amanah !== 'all') {
    if (typeof sc.amanah !== 'string' || sc.amanah === 'all' || sc.amanah !== vs.amanah) return false;
    const mk = sc.muni && sc.muni !== 'all' ? parseMuniKey(sc.muni) : null; const ref = mk && !mk.invalid && mk.kind === 'mapped' ? mk.refId : null;
    if (mk && !ref) return false;
    return vs.muni === 'all' ? !mk : ref === vs.muni;
  }
  return sc.amanah === 'all' && !(targets?.planEntityKeys);
}
