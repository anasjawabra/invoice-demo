// Backup / restore of what the demo keeps in THIS browser (EQ10): plans and objectives, the action register and the Smart-report conversations.
// A backup is a plain JSON file; an import is validated before anything is written and replaces the three records as a unit.
export const BACKUP_FORMAT = 'revenue-demo-local-backup';
export const BACKUP_KEYS = ['ib_plans_v1', 'ib_actions_v1', 'ib_smart_convs_v1'];

export function buildBackup(storage, now = new Date()) {
  const data = {};
  for (const k of BACKUP_KEYS) { try { const raw = storage.getItem(k); data[k] = raw == null ? null : JSON.parse(raw); } catch { data[k] = null; } }
  return { format: BACKUP_FORMAT, version: 1, createdAt: now.toISOString(), note: 'Synthetic demo records stored in one browser; not an official record.', data };
}

// → { ok:true, summary } | { ok:false, error }
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object' || obj.format !== BACKUP_FORMAT) return { ok: false, error: 'not_a_backup' };
  if (obj.version !== 1) return { ok: false, error: 'unsupported_version' };
  const d = obj.data || {};
  if (d.ib_plans_v1 != null && !(Array.isArray(d.ib_plans_v1.plans) && Array.isArray(d.ib_plans_v1.objectives))) return { ok: false, error: 'bad_plans' };
  if (d.ib_actions_v1 != null && !(Array.isArray(d.ib_actions_v1.actions))) return { ok: false, error: 'bad_actions' };
  if (d.ib_smart_convs_v1 != null && !Array.isArray(d.ib_smart_convs_v1)) return { ok: false, error: 'bad_conversations' };
  return { ok: true, summary: { plans: d.ib_plans_v1?.plans.length ?? 0, objectives: d.ib_plans_v1?.objectives.length ?? 0, actions: d.ib_actions_v1?.actions.length ?? 0, proposals: d.ib_actions_v1?.proposed?.length ?? 0, conversations: d.ib_smart_convs_v1?.length ?? 0, createdAt: obj.createdAt } };
}

// replaces the three records (a key that is null in the backup is removed). Returns the validation result.
export function applyBackup(obj, storage) {
  const v = validateBackup(obj); if (!v.ok) return v;
  for (const k of BACKUP_KEYS) { const val = obj.data[k]; if (val == null) storage.removeItem(k); else storage.setItem(k, JSON.stringify(val)); }
  return v;
}
