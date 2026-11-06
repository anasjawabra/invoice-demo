// «غرفة القرارات» — the FOLLOW-UP model (6 Nov 2026 redesign). Deliberately small: a flag, an optional note and an audit trail. Kept on this device (a demo store).
//
//   none  ──flag──▶  flagged  ──complete──▶  followed_up
//                       ▲  └───────unflag───────▶ none        (followed_up can also be unflagged, or flagged again)
//
// · «flagged» = marked for follow-up. «followed_up» (تمت المتابعة) = someone reviewed / followed up. It NEVER means the issue is resolved, an invoice is paid or a
//   recommendation is approved: the condition of the underlying issue comes from the data (item.condition.open), never from this store.
// · No assignee, owner, due date, status lifecycle, deferral or rejection. `by` / `at` are recorded for the audit trail only and are never shown as «responsible».
// · Items are derived from the data with a STABLE key (decisionRoom.js); this store is keyed by it, so recalculating the items never loses anything.
// · The earlier store (`ib_decision_room_v1`: status / owner / due) is migrated ONCE into this one (migrateV1): every note and history entry is kept,
//   the v1 data itself is left untouched in storage.
export const STORE_KEY = 'ib_decision_followup_v2';
export const LEGACY_KEY = 'ib_decision_room_v1';
const bi = (ar, en) => ({ ar, en });
export const FLAGS = { none: bi('بلا علامة', 'Not flagged'), flagged: bi('موسوم للمتابعة', 'Flagged for follow-up'), followed_up: bi('تمت المتابعة', 'Follow-up completed') };
export const ACTIONS = { flag: bi('وضع علامة للمتابعة', 'Flagged for follow-up'), followed_up: bi('تمت المتابعة', 'Follow-up completed'), unflag: bi('إزالة علامة المتابعة', 'Flag removed'), note: bi('ملاحظة', 'Note'), migrated: bi('من الإصدار السابق', 'From the earlier version') };

export const emptyStore = () => ({ v: 2, items: {} });
export const emptyEntry = () => ({ flag: 'none', note: null, history: [] });
const validStore = (v) => !!v && v.v === 2 && !!v.items && typeof v.items === 'object' && !Array.isArray(v.items);
const defaultStorage = () => (typeof localStorage !== 'undefined' ? localStorage : null);

/* ---------------- migration from the v1 (status / owner / due) store ---------------- */
const V1_WORDS = {
  new: bi('جديد', 'New'), in_progress: bi('قيد التنفيذ', 'In progress'), completed: bi('مكتمل', 'Completed'), deferred: bi('مؤجل', 'Deferred'), rejected: bi('مرفوض', 'Rejected'), resolved: bi('انتهى بالبيانات', 'Resolved by the data')
};
const word = (s) => V1_WORDS[s] || bi(String(s ?? ''), String(s ?? ''));
const mig = (at, by, ar, en) => ({ at, by, action: 'migrated', note: en, i18n: bi(ar, en) });
// the new flag for an earlier status, and a plain-words sentence about what changed
const MAP = {
  in_progress: { flag: 'flagged', ar: 'كانت الحالة «قيد التنفيذ» في الإصدار السابق؛ تظهر الآن «موسوم للمتابعة».', en: 'The earlier version showed «In progress»; it now shows «Flagged for follow-up».' },
  completed: { flag: 'followed_up', ar: 'كانت الحالة «مكتمل» في الإصدار السابق؛ تظهر الآن «تمت المتابعة»، وهذا لا يعني أن المشكلة حُلّت.', en: 'The earlier version showed «Completed»; it now shows «Follow-up completed», which does not mean the issue was resolved.' }
};
export function migrateEntryV1(st, { at }) {
  const history = [];
  for (const h of Array.isArray(st?.history) ? st.history : []) {
    if (h.action === 'note') history.push({ at: h.at, by: h.by, action: 'note', note: String(h.text ?? h.note ?? '') });
    else if (h.action === 'status') {
      const reason = h.reason ? String(h.reason) : '';
      history.push(mig(h.at, h.by, `تغيّرت الحالة من «${word(h.from).ar}» إلى «${word(h.to).ar}» (الإصدار السابق).${reason ? ` السبب المسجَّل: ${reason}` : ''}`, `Status changed from «${word(h.from).en}» to «${word(h.to).en}» (earlier version).${reason ? ` Reason recorded: ${reason}` : ''}`));
    } else if (h.action === 'assign') history.push(mig(h.at, h.by, 'قيد قديم من الإصدار السابق نُقل للاطلاع فقط؛ ولا يربط هذا البند بأي شخص.', 'An older entry from the previous version, kept for reference only; it does not tie this item to any person.'));
    else history.push(mig(h.at, h.by, 'حدث من الإصدار السابق.', 'An event from the earlier version.'));
  }
  const status = st?.status || 'new'; const m = MAP[status];
  if (status !== 'new') {
    history.push(m ? mig(at, 'migration', m.ar, m.en)
      : mig(at, 'migration', `كانت الحالة «${word(status).ar}» في الإصدار السابق ولا مقابل لها؛ يظهر البند بلا علامة متابعة.`, `The earlier version showed «${word(status).en}», which has no equivalent; the item now shows no follow-up flag.`));
  }
  const notes = history.filter((h) => h.action === 'note' && h.note);
  return { flag: m ? m.flag : 'none', note: notes.length ? notes[notes.length - 1].note : null, history };
}
/** v1 store → v2 store. Pure and deterministic for a given `at`; the input is never modified. */
export function migrateV1(v1, { at }) {
  const out = emptyStore();
  if (!v1 || typeof v1 !== 'object' || !v1.items || typeof v1.items !== 'object') return out;
  for (const [key, st] of Object.entries(v1.items)) out.items[key] = migrateEntryV1(st, { at });
  return out;
}

/* ---------------- storage ---------------- */
/** v2 when present; otherwise a ONE-TIME migration of v1 (written as v2; v1 stays in storage untouched); otherwise empty */
export function loadStore(storage = defaultStorage(), { at = new Date().toISOString() } = {}) {
  try {
    const v2 = JSON.parse(storage?.getItem(STORE_KEY) || 'null'); if (validStore(v2)) return v2;
    const v1 = JSON.parse(storage?.getItem(LEGACY_KEY) || 'null');
    if (v1 && v1.v === 1 && v1.items && typeof v1.items === 'object') { const m = migrateV1(v1, { at }); saveStore(m, storage); return m; }
  } catch { /* an unreadable store is treated as empty */ }
  return emptyStore();
}
export function saveStore(store, storage = defaultStorage()) { try { storage?.setItem(STORE_KEY, JSON.stringify(store)); return true; } catch { return false; } }

/* ---------------- operations (pure; a refused change returns { error } and leaves the store untouched) ---------------- */
const entry = (store, key) => store.items[key] || emptyEntry();
const put = (store, key, st) => ({ ...store, items: { ...store.items, [key]: st } });
const okCtx = (ctx) => !!ctx && typeof ctx.by === 'string' && ctx.by.trim() !== '' && typeof ctx.at === 'string' && ctx.at !== '';
const clean = (n) => { const t = String(n ?? '').trim(); return t || null; };
const log = (st, h, note) => ({ ...st, history: [...st.history, { at: h.at, by: h.by, action: h.action, ...(note ? { note } : {}) }] });

/** none | followed_up → flagged (optional note). Already flagged is refused. */
export function flag(store, key, { note } = {}, ctx) {
  if (!okCtx(ctx)) return { error: 'actor_required' }; if (!key) return { error: 'key_required' };
  const st = entry(store, key); if (st.flag === 'flagged') return { error: 'already_flagged' };
  const n = clean(note); return { store: put(store, key, { ...log(st, { ...ctx, action: 'flag' }, n), flag: 'flagged', note: n ?? st.note ?? null }) };
}
/** flagged → followed_up. Only from flagged. It records that someone followed up; it changes nothing about the issue itself. */
export function complete(store, key, { note } = {}, ctx) {
  if (!okCtx(ctx)) return { error: 'actor_required' };
  const st = entry(store, key); if (st.flag !== 'flagged') return { error: 'not_flagged' };
  const n = clean(note); return { store: put(store, key, { ...log(st, { ...ctx, action: 'followed_up' }, n), flag: 'followed_up', note: n ?? st.note ?? null }) };
}
/** flagged | followed_up → none (the flag is removed; the history stays) */
export function unflag(store, key, { note } = {}, ctx) {
  if (!okCtx(ctx)) return { error: 'actor_required' };
  const st = entry(store, key); if (st.flag === 'none') return { error: 'not_flagged' };
  return { store: put(store, key, { ...log(st, { ...ctx, action: 'unflag' }, clean(note)), flag: 'none' }) };
}
/** a note in any flag state */
export function addNote(store, key, text, ctx) {
  if (!okCtx(ctx)) return { error: 'actor_required' };
  const t = clean(text); if (!t) return { error: 'text_required' };
  const st = entry(store, key); return { store: put(store, key, { ...log(st, { ...ctx, action: 'note' }, t), note: t }) };
}
/** the stored follow-up of an item key (never undefined) */
export const followUpOf = (store, key) => { const st = entry(store, key); const last = st.history[st.history.length - 1] || null; return { flag: st.flag, note: st.note ?? null, history: st.history, lastBy: last?.by ?? null, lastAt: last?.at ?? null }; };
