// The work done on Decision Room items: status, owner, due date and the history of every change — kept on this device (a demo store, like the enforcement and exclusion decisions).
// Items are derived from the data with a STABLE key (see decisionRoom.js); this store is keyed by it, so recalculating the items never loses anything.
// Pure functions over a plain object; a transition outside the lifecycle, or a deferral / rejection without a reason, is refused.
export const STORE_KEY = 'ib_decision_room_v1';
export const STATUSES = {
  new: { ar: 'جديد', en: 'New' }, in_progress: { ar: 'قيد التنفيذ', en: 'In progress' }, completed: { ar: 'مكتمل', en: 'Completed' },
  deferred: { ar: 'مؤجل', en: 'Deferred' }, rejected: { ar: 'مرفوض', en: 'Rejected' }, resolved: { ar: 'انتهى بالبيانات', en: 'Resolved by the data' }
};
// جديد → قيد التنفيذ → مكتمل; مؤجل / مرفوض (السبب إلزامي) ويمكن استئنافهما
export const ALLOWED = { new: ['in_progress', 'deferred', 'rejected'], in_progress: ['completed', 'deferred', 'rejected'], deferred: ['in_progress', 'rejected'], rejected: ['in_progress'], completed: [] };
export const REASON_REQUIRED = ['deferred', 'rejected'];

export const emptyStore = () => ({ v: 1, items: {} });
export function loadStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { const v = JSON.parse(storage?.getItem(STORE_KEY) || 'null'); return v && v.v === 1 && v.items && typeof v.items === 'object' ? v : emptyStore(); } catch { return emptyStore(); }
}
export function saveStore(store, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) { try { storage?.setItem(STORE_KEY, JSON.stringify(store)); return true; } catch { return false; } }

// the first touch of an item keeps what it was (title, category, lane, amount) so it can still be shown if the data later stops raising it
const touch = (store, key, meta) => store.items[key] ? store.items[key] : { status: 'new', owner: null, assignee: null, due: null, createdAt: null, meta: meta ? { title: meta.title, category: meta.category, lane: meta.lane, amount: meta.amount ?? null } : null, history: [] };
const put = (store, key, st) => ({ ...store, items: { ...store.items, [key]: st } });

/** owner = a role key, assignee = a person's name (optional), due = YYYY-MM-DD */
export function assign(store, key, { owner, assignee = null, due }, { by, at, meta = null }) {
  if (!owner) return { error: 'owner_required' };
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: 'due_required' };
  const st = touch(store, key, meta);
  const next = { ...st, owner, assignee, due, createdAt: st.createdAt || at, history: [...st.history, { at, by, action: 'assign', owner, assignee, due }] };
  return { store: put(store, key, next) };
}

export function transition(store, key, to, { reason = '', amountNow = null } = {}, { by, at, meta = null }) {
  const st = touch(store, key, meta); const from = st.status;
  if (!(ALLOWED[from] || []).includes(to)) return { error: 'not_allowed' };
  if (REASON_REQUIRED.includes(to) && !String(reason).trim()) return { error: 'reason_required' };
  const next = { ...st, status: to, createdAt: st.createdAt || at, ...(to === 'completed' ? { completedAt: at, amountAtClose: amountNow } : {}), history: [...st.history, { at, by, action: 'status', from, to, ...(String(reason).trim() ? { reason: String(reason).trim() } : {}) }] };
  return { store: put(store, key, next) };
}

export function addNote(store, key, text, { by, at, meta = null }) {
  const t = String(text || '').trim(); if (!t) return { error: 'text_required' };
  const st = touch(store, key, meta);
  return { store: put(store, key, { ...st, createdAt: st.createdAt || at, history: [...st.history, { at, by, action: 'note', text: t }] }) };
}

export const dueDateOf = (today, days) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
