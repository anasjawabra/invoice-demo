import { ENTITIES, municipalitiesOf } from './catalog.js';
import { historyScope } from '../utils/historyMemory.js';
const memory = new Map(); const unsaved = new Set();
export const orgScopeKey = (namespace) => `ib_rev_scope_v2_${encodeURIComponent(namespace)}`;
export function normalizeOrgScope(value, org, defaults) {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? { ...defaults, ...value } : defaults;
  const parsed = historyScope(candidate); const scope = parsed || historyScope(defaults);
  let adjusted = !parsed;
  const available = new Set(ENTITIES.filter((e) => !org.amanahKeys || org.amanahKeys.includes(e.en)).map((e) => e.en));
  if (Array.isArray(scope.amanah)) {
    const allowed = [...new Set(scope.amanah.filter((key) => available.has(key)))];
    adjusted ||= allowed.length === 0 || allowed.length !== scope.amanah.length;
    scope.amanah = allowed.length > 1 ? allowed : allowed[0] || 'all';
  } else if (scope.amanah !== 'all' && !available.has(scope.amanah)) { scope.amanah = 'all'; adjusted = true; }
  const munis = typeof scope.amanah === 'string' && scope.amanah !== 'all' ? municipalitiesOf(scope.amanah) : [];
  if (scope.muni !== 'all' && !munis.some((m) => m?.key === scope.muni)) { scope.muni = 'all'; adjusted = true; }
  return { scope, adjusted };
}
export function loadOrgScope(storage, namespace, org, defaults) {
  const key = orgScopeKey(namespace); let value;
  if (unsaved.has(key)) value = memory.get(key);
  else try {
    const own = storage?.getItem(key);
    if (own) value = JSON.parse(own);
    else { const owner = storage?.getItem('ib_rev_scope_owner'); if (!owner || owner === namespace) { const legacy = storage?.getItem('ib_rev_scope'); if (legacy) value = JSON.parse(legacy); } }
  } catch { value = memory.get(key); }
  return normalizeOrgScope(value, org, defaults);
}
export function saveOrgScope(storage, namespace, scope) {
  const key = orgScopeKey(namespace); memory.set(key, scope);
  try { if (!storage) throw new Error('unavailable'); storage.setItem(key, JSON.stringify(scope)); unsaved.delete(key); } catch { unsaved.add(key); }
  // Compatibility mirror for existing tooling; ownership prevents cross-organisation adoption.
  try { storage?.setItem('ib_rev_scope_owner', namespace); storage?.setItem('ib_rev_scope', JSON.stringify(scope)); } catch { /* scoped copy or memory remains available */ }
}
