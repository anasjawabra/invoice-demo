// ============================================================================
// Action register — management follow-up of the dashboard's findings.
//
// Proposals (computed from the data) are NOT decisions: a reviewer must approve one before it becomes an action, and nothing is assigned
// automatically — «owner» stays empty («غير مسند») until an authorised user enters it. Every change is recorded in the action's history.
// Persistence: this browser (localStorage). There is no server-side action store yet (listed as a dependency).
// ============================================================================
const KEY = 'ib_actions_v1';

export const STATUSES = ['approved', 'in_progress', 'done', 'cancelled'];
export const STATUS_LABEL = { approved: { ar: 'معتمد — بانتظار البدء', en: 'Approved — not started' }, in_progress: { ar: 'قيد التنفيذ', en: 'In progress' }, done: { ar: 'مكتمل', en: 'Done' }, cancelled: { ar: 'ملغى', en: 'Cancelled' } };
export const PRIORITY_LABEL = { high: { ar: 'عالية', en: 'High' }, medium: { ar: 'متوسطة', en: 'Medium' }, low: { ar: 'منخفضة', en: 'Low' } };

export function loadRegister() {
  try { const v = JSON.parse(window.localStorage.getItem(KEY) || 'null'); if (v && Array.isArray(v.actions)) return { actions: v.actions, rejected: v.rejected || [], proposed: v.proposed || [] }; } catch { /* storage unavailable */ }
  return { actions: [], rejected: [], proposed: [] };
}
export function saveRegister(reg) { try { window.localStorage.setItem(KEY, JSON.stringify(reg)); return true; } catch { return false; } }

const uid = () => `ACT-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const entry = (by, field, from, to, note = '') => ({ at: new Date().toISOString(), by, field, from, to, note });

// approve a proposal (or create a manual action) → a committed action. `fields` are what the reviewer entered.
export function createAction(reg, { by, proposal = null, fields = {} }) {
  const base = proposal ? {
    proposalId: proposal.id, title: proposal.title, issue: proposal.issue, action: proposal.action, evidence: proposal.evidence, priority: proposal.priority,
    expectedImpact: proposal.expectedImpact, drill: proposal.drill || null
  } : { proposalId: null, title: '', issue: '', action: '', evidence: null, priority: 'medium', expectedImpact: null, drill: null };
  const a = {
    id: uid(), createdAt: new Date().toISOString(), createdBy: by, source: proposal ? 'proposal' : 'manual', ...base, ...fields,
    owner: fields.owner && String(fields.owner).trim() ? String(fields.owner).trim() : null, dueDate: fields.dueDate || null,
    status: 'approved', approvedBy: by, approvedAt: new Date().toISOString(), outcome: null,
    history: [entry(by, 'created', null, proposal ? 'approved from proposal' : 'manual', proposal ? proposal.id : '')]
  };
  return { ...reg, actions: [a, ...reg.actions] };
}
export function updateAction(reg, id, patch, by, note = '') {
  return { ...reg, actions: reg.actions.map((a) => {
    if (a.id !== id) return a;
    const next = { ...a }; const h = [...a.history];
    for (const [k, v] of Object.entries(patch)) {
      const nv = k === 'owner' ? (String(v || '').trim() || null) : v;
      if (JSON.stringify(a[k]) !== JSON.stringify(nv)) { h.push(entry(by, k, a[k] ?? null, nv ?? null, k === 'status' ? note : '')); next[k] = nv; }
    }
    next.history = h; return next;
  }) };
}
export function rejectProposal(reg, proposal, by, reason = '') {
  return { ...reg, rejected: [{ id: proposal.id, title: proposal.title, at: new Date().toISOString(), by, reason }, ...reg.rejected] };
}
// a proposal made by a person (e.g. from a scenario) waits for review like a computed one; it is NEVER an approved action
export function addProposal(reg, proposal, by) {
  if ((reg.proposed || []).some((p) => p.id === proposal.id) || reg.actions.some((a) => a.proposalId === proposal.id)) return reg;
  return { ...reg, proposed: [{ ...proposal, proposedBy: by, proposedAt: new Date().toISOString() }, ...(reg.proposed || [])] };
}
// proposals that are neither approved nor rejected yet (computed ones + the ones people added)
export function pendingProposals(reg, proposals) {
  const done = new Set([...reg.actions.map((a) => a.proposalId).filter(Boolean), ...reg.rejected.map((r) => r.id)]);
  const seen = new Set(); const all = [...proposals, ...(reg.proposed || [])].filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  return all.filter((p) => !done.has(p.id));
}
// a proposal id is «<kind>@<period and scope>»: the same finding under another period/scope is a NEW proposal, but earlier decisions on it stay visible
export const proposalBase = (id) => String(id || '').split('@')[0];
export function earlierDecisions(reg, p) {
  const base = proposalBase(p.id);
  return [
    ...reg.actions.filter((a) => a.proposalId && a.proposalId !== p.id && proposalBase(a.proposalId) === base).map((a) => ({ kind: 'approved', at: a.createdAt, by: a.createdBy, scope: a.evidence?.scope || '' })),
    ...reg.rejected.filter((r) => r.id !== p.id && proposalBase(r.id) === base).map((r) => ({ kind: 'rejected', at: r.at, by: r.by, scope: '' }))
  ];
}
export function isOverdue(a, today) { return !!a.dueDate && a.dueDate < today && (a.status === 'approved' || a.status === 'in_progress'); }
