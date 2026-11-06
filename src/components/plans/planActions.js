// The two saves of the plan page as plain async functions (no React) so the page, the naming dialog and the tests share ONE behaviour (docs/revenue-plans-spec.md §10):
//   submitCreate  — a NEW saved plan («حفظ» in the naming modal: a new plan · «حفظ كخطة جديدة» · the system plan · a plan the person may not edit). Checks the NAME and the CONFIGURATION first (nothing is sent while either is
//                   invalid), then POST /plans. The caller's entered values are never touched — a failure returns the problems and nothing else changes.
//   submitUpdate  — «حفظ الخطة» on an existing editable plan: PUT /plans/:id with the plan's `revision` (a stale revision → conflict; the stored plan is unchanged). No name prompt, no duplicate.
// `api` = the plansClient shape ({ createPlan, updatePlan }); `refresh` = refreshPlans (the list is updated before the caller selects the saved plan).
import { nameProblem, clientSaveProblems, requestProblems, isConflict } from './planUi';

export async function submitCreate({ api, name, content, setDefault = false, copyOf = null, plans = [], ctx = {}, refresh = null }) {
  const nProblem = nameProblem(name, plans);
  if (nProblem) return { ok: false, kind: 'name', problems: [nProblem.text] };
  const cfg = clientSaveProblems({ ...content, name: String(name).trim() }, ctx);
  if (cfg.length) return { ok: false, kind: 'config', problems: cfg.map((c) => c.text) };
  try {
    const res = await api.createPlan({ name: String(name).trim(), content: { ...content, name: String(name).trim() }, setDefault: !!setDefault, ...(copyOf ? { copyOf } : {}) });
    if (refresh) await refresh();
    return { ok: true, plan: res.plan || res };
  } catch (error) { return { ok: false, kind: 'server', error, problems: requestProblems(error) }; }
}

export async function submitUpdate({ api, plan, content, ctx = {}, refresh = null }) {
  const cfg = clientSaveProblems(content, ctx);
  if (cfg.length) return { ok: false, kind: 'config', problems: cfg.map((c) => c.text) };
  try {
    const res = await api.updatePlan(plan.id, plan.revision, content, content.name !== plan.name ? content.name : undefined);
    if (refresh) await refresh();
    return { ok: true, plan: res.plan || res };
  } catch (error) {
    if (isConflict(error)) { if (refresh) await refresh(); return { ok: false, kind: 'conflict', error, problems: [] }; }
    return { ok: false, kind: 'server', error, problems: requestProblems(error) };
  }
}
