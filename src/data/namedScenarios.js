// Named what-if scenarios of a plan (up to four per plan). They are kept in the plan store under `scenarios[planId]`, SEPARATE from the plan's
// saved versions, from approved plans and from actual data: saving, renaming, duplicating or deleting a scenario never touches the plan, its
// status or its versions, and never implies approval. Every function is pure: it returns the next store (or an error code).
import { DEFAULT_SCENARIO, SCENARIO_LIMITS } from './strategicCalc';

export const MAX_SCENARIOS = 4;
export const NAME_MAX = 60;

const uid = () => `SCN-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const key = (n) => String(n).trim().toLowerCase();

export const listScenarios = (st, planId) => (st?.scenarios && Array.isArray(st.scenarios[planId]) ? st.scenarios[planId] : []);
const put = (st, planId, list) => ({ ...st, scenarios: { ...(st.scenarios || {}), [planId]: list } });

// A history of what was done to the scenarios of a plan, kept APART from the plan's own history: scenario work never writes into the plan,
// its versions or its status. Newest first, at most LOG_MAX entries per plan.
export const LOG_MAX = 200;
export const listScenarioLog = (st, planId) => (st?.scenarioLog && Array.isArray(st.scenarioLog[planId]) ? st.scenarioLog[planId] : []);
export function logScenario(st, planId, { action, scenarioId, name, by, detail = null }) {
  const entry = { at: new Date().toISOString(), by, action, scenarioId, name, detail };
  return { ...st, scenarioLog: { ...(st.scenarioLog || {}), [planId]: [entry, ...listScenarioLog(st, planId)].slice(0, LOG_MAX) } };
}

// a stored scenario can only hold the known levers inside their limits (a hand-edited file cannot inject anything else)
export function cleanScenario(sc) {
  const out = { ...DEFAULT_SCENARIO };
  for (const k of Object.keys(DEFAULT_SCENARIO)) {
    const n = Number(sc?.[k]); const [lo, hi] = SCENARIO_LIMITS[k];
    out[k] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0;
  }
  return out;
}

export function checkName(st, planId, name, exceptId = null) {
  const n = String(name ?? '').trim();
  if (!n) return 'name_empty';
  if (n.length > NAME_MAX) return 'name_long';
  if (listScenarios(st, planId).some((s) => s.id !== exceptId && key(s.name) === key(n))) return 'name_dup';
  return null;
}

// → { ok:true, st, id } | { ok:false, error }
export function addScenario(st, planId, { name, scenario, planDate = null, by }) {
  if (listScenarios(st, planId).length >= MAX_SCENARIOS) return { ok: false, error: 'limit' };
  const bad = checkName(st, planId, name); if (bad) return { ok: false, error: bad };
  const now = new Date().toISOString(); const id = uid();
  const rec = { id, name: String(name).trim(), scenario: cleanScenario(scenario), planDate, createdAt: now, createdBy: by, updatedAt: now, updatedBy: by };
  return { ok: true, st: logScenario(put(st, planId, [...listScenarios(st, planId), rec]), planId, { action: 'created', scenarioId: id, name: rec.name, by, detail: changedLevers(rec.scenario) }), id };
}

export function renameScenario(st, planId, id, name, by) {
  const bad = checkName(st, planId, name, id); if (bad) return { ok: false, error: bad };
  const now = new Date().toISOString();
  const old = listScenarios(st, planId).find((s) => s.id === id);
  return { ok: true, st: logScenario(put(st, planId, listScenarios(st, planId).map((s) => (s.id === id ? { ...s, name: String(name).trim(), updatedAt: now, updatedBy: by } : s))), planId, { action: 'renamed', scenarioId: id, name: String(name).trim(), by, detail: { from: old?.name ?? null } }) };
}

// replace the levers of a saved scenario with new ones (e.g. the values now in the editor)
export function updateScenario(st, planId, id, { scenario, planDate = undefined }, by) {
  const now = new Date().toISOString();
  const old = listScenarios(st, planId).find((s) => s.id === id); if (!old) return { ok: false, error: 'missing' };
  return { ok: true, st: logScenario(put(st, planId, listScenarios(st, planId).map((s) => (s.id === id ? { ...s, scenario: cleanScenario(scenario), ...(planDate !== undefined ? { planDate } : {}), updatedAt: now, updatedBy: by } : s))), planId, { action: 'levers_updated', scenarioId: id, name: old.name, by, detail: { before: changedLevers(old.scenario), after: changedLevers(scenario) } }) };
}

export function duplicateScenario(st, planId, id, by, copyWord = 'نسخة من') {
  const src = listScenarios(st, planId).find((s) => s.id === id); if (!src) return { ok: false, error: 'missing' };
  if (listScenarios(st, planId).length >= MAX_SCENARIOS) return { ok: false, error: 'limit' };
  let name = `${copyWord} ${src.name}`.slice(0, NAME_MAX); let i = 2;
  while (checkName(st, planId, name)) { name = `${copyWord} ${src.name}`.slice(0, NAME_MAX - 4) + ` ${i}`; i += 1; if (i > 9) return { ok: false, error: 'name_dup' }; }
  return addScenario(st, planId, { name, scenario: src.scenario, planDate: src.planDate, by });
}

export function deleteScenario(st, planId, id, by = null) {
  const old = listScenarios(st, planId).find((s) => s.id === id);
  return { ok: true, st: logScenario(put(st, planId, listScenarios(st, planId).filter((s) => s.id !== id)), planId, { action: 'deleted', scenarioId: id, name: old?.name ?? null, by, detail: old ? changedLevers(old.scenario) : null }) };
}

// the levers that differ from the default, in a fixed order — what a reader needs to tell two scenarios apart
export function changedLevers(sc) {
  const s = cleanScenario(sc);
  return Object.keys(DEFAULT_SCENARIO).filter((k) => s[k] !== DEFAULT_SCENARIO[k]).map((k) => [k, s[k]]);
}

// does the store hold a well-formed `scenarioLog` value? (used when a backup is imported)
export function validScenarioLogShape(v) {
  if (v == null) return true;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v).every((list) => Array.isArray(list) && list.length <= LOG_MAX && list.every((e) => e && typeof e.at === 'string' && typeof e.action === 'string'));
}
// does the store hold a well-formed `scenarios` value? (used when a backup is imported)
export function validScenariosShape(v) {
  if (v == null) return true;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v).every((list) => Array.isArray(list) && list.length <= MAX_SCENARIOS && list.every((s) => s && typeof s.id === 'string' && typeof s.name === 'string' && s.scenario && typeof s.scenario === 'object'));
}
