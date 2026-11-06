// «أبرز ما يحتاج مراجعة» on the dashboard — at most THREE cases taken from the EXISTING prioritisation (the Decision Room items of useDecisions / decisionRoom.buildDecisionItems, already ranked High → Medium → Low then by amount).
// Nothing is re-ranked or re-invented here; this file only SELECTS and shapes. Pure: no React, no I/O.
//
//   buildReviewPriorities({ items, canSeeDecisions = true, limit = 3 }) → {
//       allowed, reason:null|'no_access'|'no_items', limit, total (open items), shown, remaining (open items not shown — the Decision Room holds them),
//       cases:[{ key, title{ar,en}, entity:{ level:'entity'|'source'|'scope', key|null, name{ar,en} }, measure:{ kind, label{ar,en}, amount|null, count|null, text{ar,en} }, priority:'high'|'medium'|'low', category, inspectTarget:{ type:'decision_item', key, to } }],
//       subsumed:[key]      aggregate items left out because their own entity cases are available (an aggregate is NEVER shown together with its own entity cases),
//       link:{ show, to:'/decisions', label{ar,en} }   `show` only when the person holds the `decisions` module (link and destination respect permissions)
//   }
//   itemLevel(item) → 'entity' | 'source' | 'scope'        subsumedKeys(items) → Set of aggregate keys
// PLAN ITEMS ARE EXCLUDED: the dashboard is independent of the collection plans — Decision Room items of the plan category (`plan_deviation`, keys `plan:*`, or carrying a plan source) are never a priority finding nor a review case
//   (the Decision Room page itself still lists them). `isPlanItem(item)` is the one test.
// SUBSUMPTION: a SCOPE-level item (no Amanah and no source named — e.g. «plan:ministry», the Ministry-wide gap to plan) is subsumed by the ENTITY-level items of the SAME category when at least one exists; the entity cases are the actionable ones.
import { itemLink } from '../../components/decisions/decisionUi';
import { fmtMoney, fmtInt } from '../../utils/money';

const bi = (ar, en) => ({ ar, en });
export const MAX_REVIEW_CASES = 3;
export const DECISIONS_LINK = '/decisions';
export const DECISIONS_LINK_LABEL = bi('عرض كل الحالات في غرفة القرارات', 'View all cases in the Decision Room');

export const itemLevel = (it) => (it?.affected?.amanah ? 'entity' : it?.affected?.source ? 'source' : 'scope');
/** a Decision Room item that belongs to the collection-plan category: never shown on /insights */
export const isPlanItem = (it) => !!it && (it.category === 'plan_deviation' || String(it.key || '').startsWith('plan:') || !!it.planSource);
const isOpen = (it) => it && it.condition?.open !== false && !isPlanItem(it);

export function subsumedKeys(items) {
  const open = (items || []).filter(isOpen); const out = new Set();
  const withEntities = new Set(open.filter((i) => itemLevel(i) === 'entity').map((i) => i.category));
  for (const i of open) if (itemLevel(i) === 'scope' && withEntities.has(i.category)) out.add(i.key);
  return out;
}

export function measureOfItem(it) {
  const m = it?.measure || {}; const label = m.label || bi('', '');
  const val = (lang) => (m.amount != null ? fmtMoney(m.amount, { lang }) : m.count != null ? fmtInt(m.count) : '');
  return { kind: m.kind || null, label, amount: m.amount ?? null, count: m.count ?? null, text: bi(val('ar'), val('en')) };
}
export function entityOfItem(it) {
  const a = it?.affected || {}; const level = itemLevel(it);
  return { level, key: level === 'entity' ? a.amanah : level === 'source' ? a.source : null, name: a.label || bi('', '') };
}

export function buildReviewPriorities({ items = null, canSeeDecisions = true, limit = MAX_REVIEW_CASES } = {}) {
  const n = Math.max(0, Math.min(limit, MAX_REVIEW_CASES));
  const base = { limit: n, cases: [], subsumed: [], link: { show: false, to: DECISIONS_LINK, label: DECISIONS_LINK_LABEL } };
  if (!canSeeDecisions) return { ...base, allowed: false, reason: 'no_access', total: 0, shown: 0, remaining: 0 };
  const open = (items || []).filter(isOpen);
  if (!open.length) return { ...base, allowed: true, reason: 'no_items', total: 0, shown: 0, remaining: 0 };
  const sub = subsumedKeys(open);
  const picked = open.filter((i) => !sub.has(i.key)).slice(0, n);
  const cases = picked.map((it) => ({ key: it.key, title: it.title, entity: entityOfItem(it), measure: measureOfItem(it), priority: it.priority?.level || null, category: it.category, inspectTarget: { type: 'decision_item', key: it.key, to: itemLink(it.key) } }));
  return { ...base, allowed: true, reason: null, total: open.length, shown: cases.length, remaining: open.length - cases.length, cases, subsumed: [...sub], link: { show: true, to: DECISIONS_LINK, label: DECISIONS_LINK_LABEL } };
}
