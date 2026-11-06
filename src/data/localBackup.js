// Backup / restore of what the demo keeps in THIS browser (EQ10): plans and objectives, the action register and the Smart-report conversations.
// A backup is a plain JSON file; an import is validated before anything is written and replaces the three records as a unit.
import { validStoreShape } from './orderMatching';
import { migrateLangFields, normalizeLang, LANG_KEY } from './lang';
export const BACKUP_FORMAT = 'revenue-demo-local-backup';
export const BACKUP_KEYS = ['ib_plans_v1', 'ib_actions_v1', 'ib_smart_convs_v1'];
// Enforcement-order work (links, document records, extracted references, history). OPTIONAL: an older backup without it never removes what is in the browser.
// The PDF files themselves are NOT in the backup (only their names, hashes and extracted references) — a restored order asks for the file again.
export const OPTIONAL_KEYS = ['ib_enforcement_v1', 'ib_collection_goal_v1']; // the second: the draft monthly plans saved on the Strategic Dashboard

export function buildBackup(storage, now = new Date()) {
  const data = {};
  for (const k of BACKUP_KEYS) { try { const raw = storage.getItem(k); data[k] = raw == null ? null : JSON.parse(raw); } catch { data[k] = null; } }
  for (const k of OPTIONAL_KEYS) { try { const raw = storage.getItem(k); if (raw != null) data[k] = JSON.parse(raw); } catch { /* unreadable: left out */ } }
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
  if (d.ib_enforcement_v1 != null && !validStoreShape(d.ib_enforcement_v1)) return { ok: false, error: 'bad_enforcement' };
  if (d.ib_collection_goal_v1 != null && !(d.ib_collection_goal_v1.v === 1 && d.ib_collection_goal_v1.plans && typeof d.ib_collection_goal_v1.plans === 'object')) return { ok: false, error: 'bad_goal_plans' };
  return { ok: true, summary: { plans: d.ib_plans_v1?.plans.length ?? 0, objectives: d.ib_plans_v1?.objectives.length ?? 0, goalPlans: Object.keys(d.ib_collection_goal_v1?.plans || {}).length, actions: d.ib_actions_v1?.actions.length ?? 0, proposals: d.ib_actions_v1?.proposed?.length ?? 0, conversations: d.ib_smart_convs_v1?.length ?? 0, ...(d.ib_enforcement_v1 ? { enforcementOrders: Object.keys(d.ib_enforcement_v1.orders).length } : {}), createdAt: obj.createdAt } };
}

// The interface language a backup carries, if any (top-level `lang`, `preferences.lang` or `data.ib_lang`), as 'ar' | 'en'; null when it carries none.
// A backup written when other languages existed (e.g. a Chinese preference) imports normally: the value becomes Arabic.
export function backupLang(obj) {
  const raw = obj?.lang ?? obj?.preferences?.lang ?? obj?.data?.ib_lang;
  return raw == null ? null : normalizeLang(raw);
}

// replaces the three records (a key that is null in the backup is removed). Returns the validation result.
// Language fields inside the records are normalised to Arabic / English on the way in; nothing else in them is changed. `sessionStore` (optional, sessionStorage): receives the backup's language preference.
export function applyBackup(obj, storage, sessionStore = null) {
  const v = validateBackup(obj); if (!v.ok) return v;
  const put = (k, val) => { if (val == null) storage.removeItem(k); else storage.setItem(k, JSON.stringify(migrateLangFields(val).value)); };
  for (const k of BACKUP_KEYS) put(k, obj.data[k]);
  for (const k of OPTIONAL_KEYS) if (k in obj.data) put(k, obj.data[k]);
  const lang = backupLang(obj);
  if (lang && sessionStore) { try { sessionStore.setItem(LANG_KEY, lang); } catch { /* storage unavailable */ } }
  return { ...v, ...(lang ? { lang } : {}) };
}
