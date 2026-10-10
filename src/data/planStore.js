// Plans and strategic objectives — user-managed records of the planning area (stored in this browser until a server store exists).
// A plan states its period, organisational scope, owner, assumptions and VERSION; saving creates a new version and logs the change.
// A scenario inside a plan is a user-defined set of assumptions: it never alters actual transactions or approved targets.
import { DEFAULT_SCENARIO } from './strategicCalc';
import { amanahOptionsOf } from './revenueLedger';
import { sourceAr, sourceEn } from './insightsEngine';

const KEY = 'ib_plans_v1';
export const PLAN_STATUS = { draft: { ar: 'مسودة', en: 'Draft' }, review: { ar: 'قيد المراجعة', en: 'Under review' }, approved: { ar: 'معتمدة', en: 'Approved' } };
export const OBJECTIVE_METRICS = {
  collection_rate: { ar: 'نسبة التحصيل (%)', en: 'Collection rate (%)', unit: 'pct', higherIsBetter: true },
  exclusion_rate: { ar: 'نسبة الاستبعاد (%)', en: 'Exclusion rate (%)', unit: 'pct', higherIsBetter: false },
  overdue_share: { ar: 'المتأخر من صافي المفوتر (%)', en: 'Overdue share of net billed (%)', unit: 'pct', higherIsBetter: false },
  receipts_ytd: { ar: 'المقبوضات منذ بداية السنة (ريال)', en: 'Receipts year to date (SAR)', unit: 'sar', higherIsBetter: true },
  budget_execution: { ar: 'نسبة الصرف من الميزانية المتناسبة (%)', en: 'Payments ÷ prorated budget (%)', unit: 'pct', higherIsBetter: null },
  coverage: { ar: 'تغطية الإنفاق التشغيلي من الإيرادات (%)', en: 'Operating-expenditure coverage (%)', unit: 'pct', higherIsBetter: true }
};

// ---- the plan's own scope: its figures are computed from THIS (never from the dashboard filter) ----
export const DEFAULT_PLAN_SCOPE = { amanah: 'all', source: 'all', scopeType: 'all', muni: 'all', status: 'all' };
export function scopeLabelOf(scope, ar = true) {
  const sc = { ...DEFAULT_PLAN_SCOPE, ...(scope || {}) };
  const am = sc.amanah === 'all' ? (ar ? 'كل الأمانات' : 'All Amanahs') : [].concat(sc.amanah).map((k) => { const a = amanahOptionsOf().find((x) => x.key === k); return a ? (ar ? a.ar : a.en) : k; }).join(ar ? '، ' : ', ');
  const src = sc.source === 'all' ? (ar ? 'كل المصادر' : 'All sources') : (ar ? sourceAr(sc.source) : sourceEn(sc.source));
  const st = sc.scopeType && sc.scopeType !== 'all' ? ` · ${sc.scopeType === 'internal' ? (ar ? 'داخلي' : 'Internal') : (ar ? 'مركزي' : 'Central')}` : '';
  return `${am} · ${src}${st}`;
}
// the request scope of a plan: its period (the end is capped at the data cut-off — no actual transactions after today) and its organisational scope
export function planScopeOf(plan, today) {
  const sc = { ...DEFAULT_PLAN_SCOPE, ...(plan?.scope || {}) };
  return { from: plan.period.from, to: plan.period.to < today ? plan.period.to : today, amanah: sc.amanah, source: sc.source, scopeType: sc.scopeType, muni: sc.muni, status: sc.status };
}
// a short stable fingerprint of the configuration a result was computed under (stored with each version)
export function cfgHash(cfg) {
  const t = JSON.stringify({ g: cfg.graceDays, b: cfg.collectionsAsOf, r: cfg.rules, c: cfg.crStatuses, a: cfg.amountBasis });
  let h = 5381; for (let i = 0; i < t.length; i += 1) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0; return h.toString(16);
}

export function loadPlans() {
  try { const v = JSON.parse(window.localStorage.getItem(KEY) || 'null'); if (v && Array.isArray(v.plans)) return v; } catch { /* storage unavailable */ }
  return { plans: [], objectives: [], activeId: null, scenarios: {}, scenarioLog: {} };
}
export function savePlans(st) { try { window.localStorage.setItem(KEY, JSON.stringify(st)); return true; } catch { return false; } }
const uid = (p) => `${p}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
const log = (by, change, note = '') => ({ at: new Date().toISOString(), by, change, note });

export function newPlan({ by, name, scope, period, owner = '', assumptions = '' }) {
  return { id: uid('PLAN'), name, owner: owner || null, period, scope, assumptions, scenario: { ...DEFAULT_SCENARIO }, planDate: period.to, status: 'draft', version: 0, versions: [], createdAt: new Date().toISOString(), createdBy: by, approvedBy: null, history: [log(by, 'created')] };
}
// freeze the current assumptions and the headline result as the next version
export function saveVersion(plan, { by, summary, context = null }) {
  const v = plan.version + 1;
  return { ...plan, version: v, versions: [{ version: v, at: new Date().toISOString(), by, scenario: { ...plan.scenario }, planDate: plan.planDate, assumptions: plan.assumptions, owner: plan.owner, scope: plan.scope, period: plan.period, summary, context }, ...plan.versions], status: plan.status === 'approved' ? 'draft' : plan.status, approvedBy: plan.status === 'approved' ? null : plan.approvedBy, history: [log(by, `version ${v} saved`, plan.status === 'approved' ? 'a new version returns the plan to draft; it must be approved again' : ''), ...plan.history] };
}
// consecutive edits of the same field by the same person within two minutes are ONE history entry (typing a name must not write 20 lines)
const COALESCE_MS = 120000;
export function patchPlan(plan, patch, by) {
  const next = { ...plan }; const h = [...plan.history];
  for (const [k, v] of Object.entries(patch)) {
    if (JSON.stringify(plan[k]) !== JSON.stringify(v)) {
      const top = h[0]; const same = top && top.change === `${k} changed` && top.by === by && Date.now() - Date.parse(top.at) < COALESCE_MS;
      if (!same) h.unshift(log(by, `${k} changed`));
      next[k] = v;
    }
  }
  next.history = h; return next;
}
// every edit of a plan's content goes through here: it is logged, and an APPROVED plan that changes returns to draft (the saved version is untouched
// and the plan must be approved again) — the same rule that already applies when a new version is saved.
export const PLAN_CONTENT_KEYS = ['name', 'owner', 'assumptions', 'scenario', 'planDate', 'scope', 'period'];
export function editPlan(plan, patch, by) {
  const changed = PLAN_CONTENT_KEYS.some((k) => k in patch && JSON.stringify(plan[k] ?? null) !== JSON.stringify(patch[k] ?? null));
  let next = patchPlan(plan, patch, by);
  if (changed && plan.status === 'approved') next = { ...next, status: 'draft', approvedBy: null, history: [log(by, 'returned to draft', 'edited after approval; the saved version is unchanged and the plan must be approved again'), ...next.history] };
  return next;
}
// does the working copy differ from the latest saved version? (null = nothing saved yet)
export function unsavedChanges(plan) {
  const v = plan.versions?.[0]; if (!v) return null;
  const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
  return !(same(plan.scenario, v.scenario) && same(plan.planDate, v.planDate) && same(plan.assumptions, v.assumptions) && same(plan.owner || '', v.owner || '') && same(plan.period, v.period) && same({ ...DEFAULT_PLAN_SCOPE, ...(plan.scope || {}), label: 0 }, { ...DEFAULT_PLAN_SCOPE, ...(v.scope || {}), label: 0 }));
}
export function approvePlan(plan, by) { return { ...plan, status: 'approved', approvedBy: by, history: [log(by, 'approved'), ...plan.history] }; }

export function addObjective(st, { by, fields }) {
  const o = { id: uid('OBJ'), title: '', metric: 'collection_rate', target: null, due: null, owner: null, status: 'proposed', note: '', createdAt: new Date().toISOString(), createdBy: by, history: [log(by, 'created')], ...fields };
  return { ...st, objectives: [o, ...st.objectives] };
}
export function updateObjective(st, id, patch, by) {
  return { ...st, objectives: st.objectives.map((o) => { if (o.id !== id) return o; const n = { ...o }; const h = [...o.history]; for (const [k, v] of Object.entries(patch)) if (JSON.stringify(o[k]) !== JSON.stringify(v)) { h.unshift(log(by, `${k} changed`)); n[k] = v; } n.history = h; return n; }) };
}
export function removeObjective(st, id) { return { ...st, objectives: st.objectives.filter((o) => o.id !== id) }; }

// progress of an objective against its target. `actuals` = { collection_rate, exclusion_rate, overdue_share, receipts_ytd, budget_execution, coverage } (null = unavailable)
export function objectiveProgress(o, actuals) {
  const m = OBJECTIVE_METRICS[o.metric]; const actual = actuals?.[o.metric];
  if (actual == null || o.target == null || !m) return { actual: actual ?? null, state: 'unavailable' };
  const t = Number(o.target); if (!(t > 0) && m.higherIsBetter !== false) return { actual, state: 'unavailable' };
  const ratio = m.higherIsBetter === false ? (actual <= 0 ? 1 : t / actual) : actual / t;
  const state = m.higherIsBetter === null ? (Math.abs(actual - t) <= t * 0.1 ? 'on_track' : 'off_track') : ratio >= 1 ? 'met' : ratio >= 0.9 ? 'on_track' : 'off_track';
  return { actual, ratio, state };
}
