import { ENTITIES } from '../src/data/catalog.js';

// Record details and reference lookups obey the same organisation boundary as lists.
// Deliberately independent of report period, source and collection-state filters.
export function canAccessEntity(req, entity) {
  const allowed = req.scope?.org?.amanahKeys || req.scope?.orgKeys;
  return !allowed || allowed.includes(entity);
}
export function canAccessInvoice(st, req, i) {
  return i >= 0 && i < st.n && canAccessEntity(req, ENTITIES[st.ent[i]]?.en) &&
    (st.owner[i] === 0 || st.owner[i] === req.owner);
}
