// Tests of the follow-up store of the Decision Room (flag · follow-up completed · remove flag · notes · audit) and of the one-time migration from the earlier
// status / owner / due store (`ib_decision_room_v1`). Run with `npm run test:followup`.
import assert from 'node:assert/strict';
import * as ds from '../src/data/decisionStore.js';

let n = 0; const ok = (name, fn) => { try { fn(); } catch (e) { e.message = `[${name}] ${e.message}`; throw e; } n += 1; };
const ctx = (by = 'Reviewer', at = '2026-10-20T10:00:00Z') => ({ by, at });
const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };
const memory = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, dump: () => Object.fromEntries(m) }; };

ok('the follow-up API is exactly: flag · complete · unflag · addNote (plus load / save / migrate / read helpers); nothing that implies assignment or a status lifecycle', () => {
  for (const f of ['flag', 'complete', 'unflag', 'addNote', 'followUpOf', 'loadStore', 'saveStore', 'emptyStore', 'migrateV1']) assert.equal(typeof ds[f], 'function', f);
  for (const gone of ['assign', 'transition', 'ROLES', 'STATUSES', 'ALLOWED', 'REASON_REQUIRED', 'dueDateOf']) assert.ok(!(gone in ds), `${gone} must be gone`);
  assert.equal(ds.STORE_KEY, 'ib_decision_followup_v2'); assert.equal(ds.LEGACY_KEY, 'ib_decision_room_v1'); assert.deepEqual(Object.keys(ds.FLAGS), ['none', 'flagged', 'followed_up']);
  assert.ok(ds.FLAGS.followed_up.ar === 'تمت المتابعة' && ds.ACTIONS.flag.ar === 'وضع علامة للمتابعة' && ds.ACTIONS.unflag.ar === 'إزالة علامة المتابعة');
});

ok('flag → follow-up completed → remove flag: each step is attributed (who, when), the history only grows, there is no assignee / owner / due / status', () => {
  let s = ds.emptyStore(); assert.deepEqual(ds.followUpOf(s, 'k'), { flag: 'none', note: null, history: [], lastBy: null, lastAt: null });
  s = ds.flag(s, 'k', { note: 'look at the biggest invoices' }, ctx('Reviewer A', '2026-10-20T10:00:00Z')).store;
  assert.equal(s.items.k.flag, 'flagged'); assert.deepEqual(s.items.k.history, [{ at: '2026-10-20T10:00:00Z', by: 'Reviewer A', action: 'flag', note: 'look at the biggest invoices' }]);
  s = ds.complete(s, 'k', { note: 'called the entity' }, ctx('Reviewer B', '2026-10-21T09:00:00Z')).store;
  assert.equal(s.items.k.flag, 'followed_up'); assert.equal(s.items.k.note, 'called the entity'); assert.deepEqual(s.items.k.history[1], { at: '2026-10-21T09:00:00Z', by: 'Reviewer B', action: 'followed_up', note: 'called the entity' });
  s = ds.unflag(s, 'k', {}, ctx('Reviewer C', '2026-10-22T09:00:00Z')).store;
  assert.equal(s.items.k.flag, 'none'); assert.deepEqual(s.items.k.history.map((h) => h.action), ['flag', 'followed_up', 'unflag']); assert.deepEqual(s.items.k.history.map((h) => h.by), ['Reviewer A', 'Reviewer B', 'Reviewer C']);
  for (const h of s.items.k.history) assert.ok(h.at && h.by);
  assert.deepEqual(Object.keys(s.items.k).sort(), ['flag', 'history', 'note'], 'the entry holds a flag, a note and the history — nothing else');
  assert.equal(ds.followUpOf(s, 'k').lastBy, 'Reviewer C'); assert.equal(ds.followUpOf(s, 'k').lastAt, '2026-10-22T09:00:00Z');
  s = ds.flag(s, 'k', {}, ctx('Reviewer A', '2026-10-23T09:00:00Z')).store; assert.equal(s.items.k.flag, 'flagged', 'it can be flagged again after the flag was removed'); assert.equal(s.items.k.history.length, 4);
  s = ds.complete(s, 'k', {}, ctx()).store; s = ds.flag(s, 'k', {}, ctx()).store; assert.equal(s.items.k.flag, 'flagged', 'a followed-up item can be flagged again');
});

ok('refusals leave the store untouched: completing needs a flag, flagging twice, removing a flag that is not set, an empty note, no actor', () => {
  const frozen = deepFreeze(ds.flag(ds.emptyStore(), 'k', {}, ctx()).store);
  assert.equal(ds.flag(frozen, 'k', {}, ctx()).error, 'already_flagged'); assert.equal(ds.complete(ds.emptyStore(), 'k', {}, ctx()).error, 'not_flagged', 'follow-up completed only from flagged');
  assert.equal(ds.unflag(ds.emptyStore(), 'k', {}, ctx()).error, 'not_flagged'); assert.equal(ds.addNote(frozen, 'k', '   ', ctx()).error, 'text_required');
  for (const bad of [undefined, {}, { by: '', at: 'x' }, { by: 'A' }, { by: 'A', at: '' }]) { assert.equal(ds.flag(frozen, 'k', {}, bad).error, 'actor_required'); assert.equal(ds.addNote(frozen, 'k', 'x', bad).error, 'actor_required'); assert.equal(ds.complete(frozen, 'k', {}, bad).error, 'actor_required'); assert.equal(ds.unflag(frozen, 'k', {}, bad).error, 'actor_required'); }
  assert.equal(ds.flag(ds.emptyStore(), '', {}, ctx()).error, 'key_required');
  assert.deepEqual(frozen.items.k.history.length, 1, 'the frozen store was never touched (a mutation would have thrown)');
  const unflagged = ds.unflag(frozen, 'k', {}, ctx()).store; assert.equal(frozen.items.k.flag, 'flagged', 'operations are pure: the input is not modified'); assert.equal(unflagged.items.k.flag, 'none');
});

ok('notes: allowed in any flag state, attributed, kept after unflagging; the latest note is mirrored on the entry; a note never changes the flag', () => {
  let s = ds.emptyStore(); s = ds.addNote(s, 'k', ' first note ', ctx('A', 't1')).store; assert.equal(s.items.k.flag, 'none'); assert.equal(s.items.k.note, 'first note');
  s = ds.flag(s, 'k', {}, ctx('B', 't2')).store; assert.equal(s.items.k.note, 'first note', 'flagging without a note keeps the latest note');
  s = ds.addNote(s, 'k', 'second', ctx('C', 't3')).store; assert.equal(s.items.k.flag, 'flagged'); s = ds.complete(s, 'k', {}, ctx('D', 't4')).store; s = ds.addNote(s, 'k', 'third', ctx('E', 't5')).store; assert.equal(s.items.k.flag, 'followed_up');
  s = ds.unflag(s, 'k', { note: 'not relevant now' }, ctx('F', 't6')).store;
  assert.deepEqual(s.items.k.history.map((h) => [h.action, h.by, h.note ?? null]), [['note', 'A', 'first note'], ['flag', 'B', null], ['note', 'C', 'second'], ['followed_up', 'D', null], ['note', 'E', 'third'], ['unflag', 'F', 'not relevant now']]);
  assert.equal(ds.followUpOf(s, 'k').history.length, 6); assert.equal(ds.followUpOf(s, 'other').flag, 'none');
});

ok('following up never changes the condition of the issue: the store holds no condition, amount or status of the underlying item', () => {
  const s = ds.complete(ds.flag(ds.emptyStore(), 'overdue:amanah:X', {}, ctx()).store, 'overdue:amanah:X', { note: 'done' }, ctx()).store;
  const text = JSON.stringify(s); for (const w of ['condition', 'open', 'amount', 'resolved', 'paid', 'status', 'owner', 'assignee', 'due']) assert.ok(!text.includes(`"${w}"`), `the store must not hold «${w}»`);
});

/* ---------------- migration from the v1 store ---------------- */
const V1 = {
  v: 1,
  items: {
    'overdue:Jeddah|fines': { status: 'in_progress', owner: 'finance', assignee: 'Sara Hassan', due: '2026-11-19', createdAt: '2026-10-01T08:00:00Z', meta: { title: { ar: 'ع', en: 'T' }, category: 'overdue', lane: 'action', amount: 5 },
      history: [{ at: '2026-10-01T08:00:00Z', by: 'Manager One', action: 'assign', owner: 'finance', assignee: 'Sara Hassan', due: '2026-11-19' }, { at: '2026-10-02T08:00:00Z', by: 'Sara Hassan', action: 'status', from: 'new', to: 'in_progress' }, { at: '2026-10-03T08:00:00Z', by: 'Sara Hassan', action: 'note', text: 'called the payer' }, { at: '2026-10-04T08:00:00Z', by: 'Sara Hassan', action: 'note', text: 'promised a visit' }] },
    'target:ministry': { status: 'completed', owner: 'finance', assignee: null, due: '2026-10-30', completedAt: '2026-10-25T08:00:00Z', amountAtClose: 7, history: [{ at: '2026-10-01T08:00:00Z', by: 'Manager One', action: 'assign', owner: 'finance', assignee: null, due: '2026-10-30' }, { at: '2026-10-02T08:00:00Z', by: 'Manager One', action: 'status', from: 'new', to: 'in_progress' }, { at: '2026-10-25T08:00:00Z', by: 'Manager One', action: 'status', from: 'in_progress', to: 'completed' }] },
    'aged:Asir': { status: 'deferred', owner: 'finance', due: '2026-11-01', history: [{ at: '2026-10-02T08:00:00Z', by: 'Manager One', action: 'status', from: 'new', to: 'in_progress' }, { at: '2026-10-05T08:00:00Z', by: 'Manager One', action: 'status', from: 'in_progress', to: 'deferred', reason: 'waiting for the debtor' }] },
    'orders:suspended': { status: 'rejected', owner: 'enforcement', due: '2026-11-01', history: [{ at: '2026-10-02T08:00:00Z', by: 'Manager One', action: 'status', from: 'new', to: 'rejected', reason: 'not relevant' }] },
    'data:old': { status: 'resolved', history: [] },
    'data:amount_conflicts': { status: 'new', owner: null, due: null, history: [{ at: '2026-10-06T08:00:00Z', by: 'Analyst', action: 'note', text: 'asked the data owner' }] },
    'odd:key': { status: 'something_new', history: [{ at: 'x', by: 'y', action: 'surprise' }] }
  }
};
const AT = '2026-11-06T09:00:00Z';

ok('migration maps status → flag: new → none · in progress → flagged · completed → follow-up completed · deferred / rejected / resolved → none', () => {
  const m = ds.migrateV1(V1, { at: AT }); assert.equal(m.v, 2);
  const flags = Object.fromEntries(Object.entries(m.items).map(([k, e]) => [k, e.flag]));
  assert.deepEqual(flags, { 'overdue:Jeddah|fines': 'flagged', 'target:ministry': 'followed_up', 'aged:Asir': 'none', 'orders:suspended': 'none', 'data:old': 'none', 'data:amount_conflicts': 'none', 'odd:key': 'none' });
  assert.equal(Object.keys(m.items).length, Object.keys(V1.items).length, 'no item is dropped');
});

ok('migration keeps every note and every history entry (time, actor, text) in order; the latest note becomes the entry note', () => {
  const m = ds.migrateV1(V1, { at: AT }); const e = m.items['overdue:Jeddah|fines'];
  assert.deepEqual(e.history.filter((h) => h.action === 'note'), [{ at: '2026-10-03T08:00:00Z', by: 'Sara Hassan', action: 'note', note: 'called the payer' }, { at: '2026-10-04T08:00:00Z', by: 'Sara Hassan', action: 'note', note: 'promised a visit' }]);
  assert.equal(e.note, 'promised a visit'); assert.deepEqual(e.history.map((h) => h.at).slice(0, 4), ['2026-10-01T08:00:00Z', '2026-10-02T08:00:00Z', '2026-10-03T08:00:00Z', '2026-10-04T08:00:00Z'], 'chronological order kept');
  assert.equal(m.items['data:amount_conflicts'].note, 'asked the data owner'); assert.equal(m.items['data:amount_conflicts'].history.length, 1);
  // every v1 history entry has a counterpart; the only extra is the one explanatory entry per item that had a status
  for (const [k, st] of Object.entries(V1.items)) assert.equal(m.items[k].history.length, st.history.length + (st.status && st.status !== 'new' ? 1 : 0), k);
});

ok('migration neutralises assignment: the old assign events stay as read-only «migrated» entries that name no responsible person, owner, role or due date', () => {
  const m = ds.migrateV1(V1, { at: AT }); const text = JSON.stringify(m);
  for (const w of ['finance', 'enforcement"', '2026-11-19', '2026-10-30', '2026-11-01', 'assignee', '"owner"', '"due"', 'amountAtClose', 'completedAt']) { assert.ok(!text.includes(w), `the migrated store still carries «${w}»`); }
  const assign = m.items['overdue:Jeddah|fines'].history[0]; assert.equal(assign.action, 'migrated'); assert.equal(assign.at, '2026-10-01T08:00:00Z'); assert.equal(assign.by, 'Manager One', 'the actor of the event is audit information');
  assert.ok(/previous version/i.test(assign.note) && /does not tie this item to any person/.test(assign.note) && assign.i18n.ar.includes('قيد قديم') && !/assign|إسناد|responsible/i.test(`${assign.note} ${assign.i18n.ar}`), 'the legacy entry is kept for reference and no longer mentions assignment')
  assert.ok(!/Sara|Hassan/.test(JSON.stringify(m.items['overdue:Jeddah|fines'].history[0])), 'the assignee is not named in the assign entry');
  for (const e of Object.values(m.items)) for (const h of e.history) assert.ok(['note', 'migrated'].includes(h.action), 'only notes and migrated entries come from v1');
});

ok('migration states the previous status in plain words (EN and AR); «completed» is said NOT to mean resolved; statuses without an equivalent say so; reasons are kept', () => {
  const m = ds.migrateV1(V1, { at: AT }); const last = (k) => m.items[k].history.at(-1); const all = (k) => m.items[k].history.map((h) => h.note).join(' | ');
  assert.equal(last('overdue:Jeddah|fines').by, 'migration'); assert.equal(last('overdue:Jeddah|fines').at, AT); assert.ok(/«In progress»/.test(last('overdue:Jeddah|fines').note) && /«Flagged for follow-up»/.test(last('overdue:Jeddah|fines').note) && last('overdue:Jeddah|fines').i18n.ar.includes('قيد التنفيذ'));
  assert.ok(/«Completed»/.test(last('target:ministry').note) && /does not mean the issue was resolved/.test(last('target:ministry').note) && last('target:ministry').i18n.ar.includes('لا يعني'));
  assert.ok(/«Deferred»/.test(last('aged:Asir').note) && /no equivalent/.test(last('aged:Asir').note) && last('aged:Asir').i18n.ar.includes('مؤجل') && all('aged:Asir').includes('waiting for the debtor'));
  assert.ok(/«Rejected»/.test(last('orders:suspended').note) && all('orders:suspended').includes('not relevant')); assert.ok(/«Resolved by the data»/.test(last('data:old').note));
  assert.ok(/Status changed from «New» to «In progress»/.test(m.items['overdue:Jeddah|fines'].history[1].note), 'earlier status changes are kept in plain words');
  assert.equal(m.items['data:amount_conflicts'].history.length, 1, 'a status «new» needs no explanation'); assert.ok(m.items['odd:key'].history.at(-1).action === 'migrated', 'an unknown status is stated, never dropped');
});

ok('migration is pure, deterministic and idempotent: the input is untouched, the same input gives the same output, an empty / malformed store gives an empty one', () => {
  const frozen = deepFreeze(JSON.parse(JSON.stringify(V1))); const a = ds.migrateV1(frozen, { at: AT }); const b = ds.migrateV1(frozen, { at: AT }); assert.deepEqual(a, b); assert.deepEqual(frozen, V1);
  for (const bad of [null, undefined, {}, { v: 1 }, { v: 1, items: null }, 'x', 5]) assert.deepEqual(ds.migrateV1(bad, { at: AT }), ds.emptyStore());
  assert.deepEqual(ds.migrateV1({ v: 1, items: { k: { status: 'new', history: [] } } }, { at: AT }).items.k, { flag: 'none', note: null, history: [] });
  assert.deepEqual(ds.migrateV1({ v: 1, items: { k: { status: 'in_progress' } } }, { at: AT }).items.k.flag, 'flagged', 'a v1 entry without a history array still migrates');
});

ok('loadStore: v2 when present; otherwise a ONE-TIME migration written as v2 while the v1 data stays in storage byte-for-byte; a second load never migrates again or overwrites later work', () => {
  const v1raw = JSON.stringify(V1); const st = memory({ [ds.LEGACY_KEY]: v1raw });
  const first = ds.loadStore(st, { at: AT }); assert.equal(first.v, 2); assert.equal(first.items['overdue:Jeddah|fines'].flag, 'flagged');
  assert.equal(st.getItem(ds.LEGACY_KEY), v1raw, 'the v1 data is never destroyed or changed'); assert.deepEqual(JSON.parse(st.getItem(ds.STORE_KEY)), first, 'v2 was written');
  // work after the migration
  const worked = ds.flag(first, 'new:key', { note: 'n' }, ctx()).store; ds.saveStore(worked, st);
  const second = ds.loadStore(st, { at: '2030-01-01T00:00:00Z' }); assert.deepEqual(second, worked, 'loading again returns the v2 store as saved — no second migration, nothing lost'); assert.equal(second.items['target:ministry'].history.at(-1).at, AT, 'the migration time is the original one');
  assert.equal(st.getItem(ds.LEGACY_KEY), v1raw);
  // idempotence of the migrated content: migrating the same v1 again gives the same entries as the first load
  assert.deepEqual(ds.migrateV1(JSON.parse(v1raw), { at: AT }), first);
});

ok('loadStore degrades safely: nothing / garbage / a wrong version → an empty store; a broken v2 falls back to migrating v1; saving to an unavailable storage reports false and does not throw', () => {
  assert.deepEqual(ds.loadStore(memory(), { at: AT }), ds.emptyStore()); assert.deepEqual(ds.loadStore(null), ds.emptyStore());
  assert.deepEqual(ds.loadStore(memory({ [ds.STORE_KEY]: 'not json' })), ds.emptyStore()); assert.deepEqual(ds.loadStore(memory({ [ds.STORE_KEY]: JSON.stringify({ v: 1, items: {} }) })), ds.emptyStore());
  assert.deepEqual(ds.loadStore(memory({ [ds.STORE_KEY]: JSON.stringify({ v: 2, items: [] }), [ds.LEGACY_KEY]: JSON.stringify(V1) }), { at: AT }).items['target:ministry'].flag, 'followed_up');
  assert.equal(ds.saveStore(ds.emptyStore(), { setItem() { throw new Error('quota'); } }), false); assert.equal(ds.saveStore(ds.emptyStore(), null), true);
  assert.deepEqual(ds.loadStore(memory({ [ds.LEGACY_KEY]: JSON.stringify({ v: 9, items: { k: {} } }) })), ds.emptyStore(), 'an unknown v1 version is not guessed at');
});

ok('after migration the entries behave like any other: a migrated flagged item can be completed, a followed-up one unflagged, notes appended, history only grows', () => {
  let s = ds.migrateV1(V1, { at: AT }); const k = 'overdue:Jeddah|fines'; const len = s.items[k].history.length;
  s = ds.complete(s, k, { note: 'visit done' }, ctx('Rev', '2026-11-07T08:00:00Z')).store; assert.equal(s.items[k].flag, 'followed_up'); assert.equal(s.items[k].history.length, len + 1);
  s = ds.flag(s, 'aged:Asir', { note: 'reopened after review' }, ctx('Rev', '2026-11-07T09:00:00Z')).store; assert.equal(s.items['aged:Asir'].flag, 'flagged'); assert.ok(s.items['aged:Asir'].history.some((h) => /waiting for the debtor/.test(h.note)), 'the old reason is still in the history');
  s = ds.unflag(s, 'target:ministry', {}, ctx('Rev', '2026-11-07T10:00:00Z')).store; assert.equal(s.items['target:ministry'].flag, 'none');
});

console.log(`decision follow-up: ${n} test groups passed`);
