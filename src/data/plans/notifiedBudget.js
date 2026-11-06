// THE NOTIFIED BUDGET («الميزانية المبلّغة») shown beside a plan's summary — pure, no I/O.
//
// It is the communicated budget of chapters 1–3 (`appropriationOf(key, year).expAdjusted`, the Ministry of Finance's fixed annual figure; src/data/appropriations.js) of the YEAR OF THE SELECTED PLAN — never today's date, never another
// year's figure, never the plan's collection target (a different measure) and never prorated to a part of the year.
//
//   notifiedBudgetFor({ view, viewScope = null, entityKeys = null, year = null }) → { state:'ok'|'unavailable', year, amount, reason, label{ar,en}, subLabel{ar,en}|null, scopeLabel{ar,en}|null, entityKeys:[…], includesHeadquarters, restricted, missing:[…] }
//     view        the plan view: { period:{start,end}, scope:{kind:'ministry'|'entities', entityKeys?} } (a plan record's `content` works too)
//     viewScope   { amanah:'all'|key, muni:'all'|MREF id } — the page's VIEW filter (never written to the plan). A municipality → unavailable (the budget exists per entity, not per municipality).
//     entityKeys  the entities the VIEWER may see (null = all-entities viewer). A restricted viewer gets the Σ of their visible entities, labelled «إجمالي الجهات المتاحة لك»; the headquarters is never visible to them.
//     municipalOnlyKeys  Amanahs the viewer holds ONLY through municipal grants (plan.municipalOnlyEntityKeys): the Amanah's whole budget is not theirs to see — excluded from the sum; an Amanah view of one of them → unavailable ('municipal_only').
//     year        optional explicit year (the report model passes the reference plan's year); default = the calendar year of the plan period.
//   year rule     a period inside ONE calendar year → that year (the remaining-2026 plan uses 2026); a period spanning two years → unavailable (reason 'period_spans_years').
//   amount        Σ over the DISTINCT entity keys in scope (no double counting). The headquarters' budget is included ONLY in the all-entities Ministry total (a Ministry-scope plan, an unrestricted viewer, no Amanah chosen — the old default);
//                 an entity-scope plan sums its own entities; an Amanah view sums that Amanah. An entity whose budget is missing makes the figure UNAVAILABLE (reason 'missing_entity_budget') — never a silent 0.
//   2027          there is NO 2027 notified budget in the data: the 2027 plan's collection target comes from an explicitly illustrative CARRIED-FORWARD assumption (target.basis.carriedFromYear) which is NOT read here ⇒ unavailable
//                 (reason 'no_budget_for_year'), never zero and never the 2026 figure.
import { appropriationOf, appropriationKeys, HQ_KEY } from '../appropriations.js';
import { ENTITIES } from '../catalog.js';

const bi = (ar, en) => ({ ar, en });
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const NOTIFIED_BUDGET_LABEL = (year) => bi(`الميزانية المبلّغة لعام ${year}`, `Notified budget ${year}`);
export const NOTIFIED_BUDGET_UNAVAILABLE = bi('الميزانية المبلّغة غير متوفرة', 'Notified budget not available');
export const NOTIFIED_BUDGET_MUNICIPALITY = bi('الميزانية المبلّغة غير متوفرة على مستوى البلدية', 'Notified budget is not available at municipality level');
const RESTRICTED = bi('إجمالي الجهات المتاحة لك', 'Total of the entities available to you');
const MINISTRY = bi('الوزارة (كل الجهات)', 'The Ministry (all entities)');
const nameOf = (k) => { if (k === HQ_KEY) return bi('ديوان عام الوزارة (المقر)', 'Ministry headquarters'); const e = ENTITIES.find((x) => x.en === k); return e ? bi(e.ar, e.en) : bi(String(k), String(k)); };

/** the single calendar year of a period (start and end in the same year) or null */
export function budgetYearOf(period) {
  if (!period || !ISO.test(period.start || '') || !ISO.test(period.end || '')) return null;
  const a = Number(period.start.slice(0, 4)); const b = Number(period.end.slice(0, 4));
  return a === b ? a : null;
}
/** is the period exactly one whole calendar year? (the sub-label then says «budget of chapters 1–3», not «annual, not a part-year budget») */
const isWholeYear = (p) => !!p && /^\d{4}-01-01$/.test(p.start || '') && p.end === `${(p.start || '').slice(0, 4)}-12-31`;

const unavailable = (reason, { year = null, label = NOTIFIED_BUDGET_UNAVAILABLE, subLabel = null, scopeLabel = null, missing = [], restricted = false } = {}) =>
  ({ state: 'unavailable', year, amount: null, reason, label, subLabel, scopeLabel, entityKeys: [], includesHeadquarters: false, restricted, missing });

export function notifiedBudgetFor({ view = null, viewScope = null, entityKeys = null, year = null, municipalOnlyKeys = null } = {}) {
  const content = view?.content || null;
  const period = view?.period || content?.period || null;
  const scope = view?.scope || content?.scope || { kind: 'ministry' };
  const y = fin(year) ? Number(year) : budgetYearOf(period);
  if (!y) return unavailable('period_spans_years', { subLabel: bi('تمتد فترة الخطة على أكثر من سنة ميلادية فلا تُحدَّد سنة واحدة للميزانية.', 'The plan period spans more than one calendar year, so no single budget year applies.') });
  const vs = { amanah: viewScope?.amanah && viewScope.amanah !== 'all' ? viewScope.amanah : 'all', muni: viewScope?.muni && viewScope.muni !== 'all' ? viewScope.muni : 'all' };
  if (vs.muni !== 'all') return unavailable('municipality', { year: y, label: NOTIFIED_BUDGET_MUNICIPALITY, subLabel: bi('تُبلَّغ الميزانية للأمانة أو الجهة، لا للبلدية.', 'The budget is notified to the Amanah / entity, not to a municipality.') });

  // ---- the entities in scope: the plan's scope ∩ what the viewer may see ∩ the chosen Amanah
  const all = appropriationKeys();
  const planKeys = scope.kind === 'entities' ? [...new Set(scope.entityKeys || [])] : all.slice();
  const viewer = Array.isArray(entityKeys) ? new Set(entityKeys) : null; // null = an all-entities viewer
  const muniOnly = new Set(Array.isArray(municipalOnlyKeys) ? municipalOnlyKeys : []);
  const visible = planKeys.filter((k) => (!viewer || viewer.has(k)) && !muniOnly.has(k));
  const restricted = (!!viewer || muniOnly.size > 0) && visible.length < planKeys.length;
  let keys = visible; let scopeLabel = restricted ? RESTRICTED : scope.kind === 'ministry' ? MINISTRY : bi(`${planKeys.length} جهة في الخطة`, `${planKeys.length} ${planKeys.length === 1 ? 'entity' : 'entities'} of the plan`);
  if (vs.amanah !== 'all') {
    if (muniOnly.has(vs.amanah)) return unavailable('municipal_only', { year: y, restricted: true, scopeLabel: nameOf(vs.amanah), subLabel: bi('صلاحيتك على مستوى البلدية، فلا تُعرض ميزانية الأمانة الكاملة.', 'Your access is at municipality level, so the whole Amanah budget is not shown.') });
    if (!visible.includes(vs.amanah)) return unavailable('entity_not_available', { year: y, restricted, subLabel: bi('الجهة المختارة خارج نطاق الخطة أو صلاحيتك.', 'The chosen entity is outside the plan scope or your access.') });
    keys = [vs.amanah]; scopeLabel = nameOf(vs.amanah);
  }
  keys = [...new Set(keys)]; // distinct keys — no entity is ever counted twice
  if (!keys.length) return unavailable('no_scope', { year: y, restricted, scopeLabel });
  const rows = keys.map((k) => ({ k, a: appropriationOf(k, y) }));
  const missing = rows.filter((r) => !r.a || !fin(r.a.expAdjusted)).map((r) => r.k);
  if (missing.length) {
    const none = missing.length === keys.length;
    return unavailable(none ? 'no_budget_for_year' : 'missing_entity_budget', { year: y, restricted, scopeLabel, missing,
      subLabel: none ? bi(`لم تصل ميزانية ${y} المبلّغة بعد؛ لا تُستبدل بميزانية عام آخر ولا بمستهدف التحصيل.`, `The ${y} notified budget has not arrived yet; it is never replaced by another year's budget or by the collection target.`)
        : bi(`ميزانية بعض الجهات (${missing.length}) غير متوفرة لعام ${y}؛ لا يُعرض مجموع ناقص.`, `The budget of ${missing.length} ${missing.length === 1 ? 'entity is' : 'entities are'} not available for ${y}; no partial total is shown.`) });
  }
  const amount = rows.reduce((t, r) => t + r.a.expAdjusted, 0);
  const includesHeadquarters = keys.includes(HQ_KEY);
  const partYear = !isWholeYear(period);
  const subLabel = partYear
    ? bi(`ميزانية سنة ${y} الكاملة، وليست ميزانية فترة الخطة؛ لا تُجزَّأ ولا تُستبدل بالمتبقي من المستهدف.`, `The full-year ${y} budget, not a budget of the plan period; it is never prorated or replaced by the remaining requirement.`)
    : bi('الأبواب 1–3 المبلَّغة من وزارة المالية — منفصلة عن مستهدف التحصيل.', 'Chapters 1–3 as notified by the Ministry of Finance — separate from the collection target.');
  return { state: 'ok', year: y, amount, reason: null, label: NOTIFIED_BUDGET_LABEL(y), subLabel, scopeLabel, entityKeys: keys, includesHeadquarters, restricted, missing: [], annualOfPartYear: partYear };
}
