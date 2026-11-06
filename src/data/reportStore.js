// The saved side of «التقارير الذكية»: conversations and the reports they produced, kept per signed-in user.
// A report is stored as its STRUCTURED MODEL (title, scope, headline, sections with tables and chart blocks, equation flags), never as a screenshot and never as inputs that must be recomputed:
// reopening a conversation shows exactly the figures that were generated, and «تحديث التقرير» builds a NEW version beside it (nothing is overwritten).
//
// Storage layout (localStorage, injectable for tests):
//   ib_smart_convs_v2:<user>            the light conversation list (messages without models, plus `access`)
//   ib_smart_rep_v1:<user>:<convId>     { v, records: { <assistantMessageId>: record } }   the heavy part, one key per conversation
// A record: { v, id, msgId, convId, kind:'report'|'attachments', lineageId, version, requestId, generatedAt, cutoff, lang, spec,
//             coverage:{all,keys,geo?}, owner?, av?, models:{ar?,en?}, prune?, check }
//  - ACCESS: `coverage.geo` is the GeoScope the report was built for (the request ∩ the user's access at that time; src/data/reportAccess.js), `owner` the user key, `av` the accessVersion.
//    Opening a record re-checks the CURRENT access (canView): coverage ⊆ the user's current effective scope, and the permission still held — otherwise the cached figures are never shown.
//    A record filed under a user other than the reader is never returned.
//  - `models` holds the finished model in BOTH languages when it is a system report (the language switch of the export dialog then needs no recomputation and shows identical figures);
//    an answer built from attached files is stored in the language it was written in only (the files are never stored).
//  - `check` is a checksum of `models`; a record that fails it is reported as unreadable, never shown.
// The legacy shared list (ib_smart_convs_v1) belongs to no user, so it is never shown to anyone and never migrated.

import { normalizeLang } from './lang';
import { cleanView } from './reportView';
import { sessionViewer } from './sessionViewer';
import { coverageGeo, coverageFromGeo, mergeGeoCoverage, checkCoverage } from './reportAccess';

export const KEYS = { index: 'ib_smart_convs_v2', reports: 'ib_smart_rep_v1', legacy: 'ib_smart_convs_v1' };
export const LIMITS = { convs: 30, reportChars: 1200000 }; // per conversation: the JSON of its saved reports; the oldest versions' weight is dropped first (with a stated note)
export const FORMAT = 1;

const defaultStorage = () => { try { return typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null) || null; } catch { return null; } };
// the sign-in name identifies the user (CREDENTIALS[].user); a session without one falls back to its email, then its name, so two different people never share a history
export const userKeyOf = (user) => { const id = user && (user.user || user.username || user.id || user.email || user.nameEn || user.name); return id ? `u:${String(id).toLowerCase()}` : null; };
const indexKey = (uk) => `${KEYS.index}:${uk}`;
const repKey = (uk, convId) => `${KEYS.reports}:${uk}:${convId}`;

// FNV-1a over the JSON text: detects a damaged or hand-edited record (it is not a security measure)
export function checksum(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }

// → JSON-safe copy and the paths that could not be kept exactly (non-finite numbers become null, functions and undefined are dropped); a model that is not exact is flagged, not hidden
export function toJsonSafe(value) {
  const lossy = [];
  const walk = (v, path, depth) => {
    if (depth > 60) { lossy.push(path); return null; }
    if (v === null) return null;
    const t = typeof v;
    if (t === 'number') { if (!Number.isFinite(v)) { lossy.push(path); return null; } return v; }
    if (t === 'string' || t === 'boolean') return v;
    if (t === 'undefined' || t === 'function' || t === 'symbol') { lossy.push(path); return undefined; }
    if (v instanceof Date) return v.toISOString();
    if (v instanceof Map || v instanceof Set) { lossy.push(path); return Array.from(v.entries ? v.entries() : v); }
    if (Array.isArray(v)) return v.map((x, i) => { const r = walk(x, `${path}[${i}]`, depth + 1); return r === undefined ? null : r; });
    const o = {}; for (const k of Object.keys(v)) { const r = walk(v[k], `${path}.${k}`, depth + 1); if (r !== undefined) o[k] = r; } return o;
  };
  return { value: walk(value, '$', 0), lossy };
}

/* ---------------- permissions: what a saved report covers, and whether the signed-in person may still see it ---------------- */
// coverage = the Amanahs the report's figures include. `all` = every Amanah (a central view); keys = the listed ones.
export function coverageOf(spec, org, access = null) {
  if (access) return coverageFromGeo(coverageGeo(spec, access)); // a GeoScope was given: the coverage is the request ∩ the access, with the legacy { all, keys } fields kept
  const orgKeys = org?.amanahKeys || null; const a = spec?.scope?.amanah;
  const asked = a == null || a === 'all' ? null : [].concat(a);
  if (asked) return { all: false, keys: [...new Set(orgKeys ? asked.filter((k) => orgKeys.includes(k)) : asked)] };
  return orgKeys ? { all: false, keys: [...orgKeys] } : { all: true, keys: [] };
}
export const mergeCoverage = (a, b) => (!a ? b : !b ? a : (a.geo || b.geo) ? mergeGeoCoverage(a, b) : (a.all || b.all) ? { all: true, keys: [] } : { all: false, keys: [...new Set([...a.keys, ...b.keys])] });
// the signed-in person may open a report only when their CURRENT access covers everything the report includes.
// `org` is the legacy organisation `{ amanahKeys }`, or a viewer (reportAccess.makeViewer: { geo, permitted, … }, optionally spread over the organisation): a viewer is checked against its GeoScope and permission.
export function canView(coverage, org, permission = 'smart_reports') {
  if (org && (org.geo || org.permitted === false)) return checkCoverage(coverage, org).ok; // an explicit viewer
  const sv = sessionViewer(permission); // the signed-in session's CURRENT access (null when signed out / in tests): re-checked each time, never remembered from when the result was saved
  if (sv && !checkCoverage(coverage, sv).ok) return false;
  if (!coverage) return true; // nothing was recorded (a conversation with no report yet)
  const keys = org?.amanahKeys || null; if (!keys) return true;
  if (coverage.all) return false;
  return coverage.keys.every((k) => keys.includes(k));
}

/* ---------------- records ---------------- */
export const metaOf = (rec) => ({ version: rec.version ?? null, generatedAt: rec.generatedAt, cutoff: rec.cutoff, requestId: rec.requestId ?? null, reportId: rec.id, lineageId: rec.lineageId ?? null, period: rec.spec?.scope?.from ? { from: rec.spec.scope.from, to: rec.spec.scope.to } : null, savedAt: rec.savedAt || null, pruned: rec.prune ? { detail: !!rec.prune.detail, language: !!rec.prune.language } : null });

export function makeRecord({ id, msgId, convId, kind = 'report', lineageId = null, version = null, requestId = null, generatedAt, cutoff, lang, spec = null, org = null, models, access = null, owner = null, accessVersion = null }) {
  const safe = {}; const lossy = [];
  for (const [l, m] of Object.entries(models || {})) { if (!m) continue; const r = toJsonSafe(m); safe[l] = r.value; lossy.push(...r.lossy); }
  const rec = { v: FORMAT, id: id || `${msgId}`, msgId, convId, kind, lineageId, version, requestId, generatedAt, cutoff, lang, spec: spec ? toJsonSafe(spec).value : null, coverage: spec ? coverageOf(spec, org, access || (org && org.geo) || sessionViewer('smart_reports')?.geo || null) : { all: false, keys: [] }, models: safe, savedAt: new Date().toISOString() };
  if (owner) rec.owner = owner; if (accessVersion != null) rec.av = accessVersion;
  if (lossy.length) rec.lossy = lossy.slice(0, 20);
  rec.check = checksum(JSON.stringify(rec.models));
  return rec;
}
export const verifyRecord = (rec) => !!rec && typeof rec === 'object' && rec.models && typeof rec.models === 'object' && Object.keys(rec.models).length > 0 && rec.check === checksum(JSON.stringify(rec.models));
export const languagesOf = (rec) => Object.keys(rec.models || {});
// a model of the wanted language (or the language it was written in) with the save details the exporters print
// A stored model written for a language that is no longer supported (anything but ar / en) is never shown in that language: the wanted language (normalised), the record's own, the other of ar / en, and only then whatever is stored.
export function modelOfRecord(rec, lang) {
  if (!rec) return null; const want = normalizeLang(lang); const own = normalizeLang(rec.lang);
  const m = rec.models?.[want] || rec.models?.[own] || rec.models?.ar || rec.models?.en || Object.values(rec.models || {})[0]; if (!m) return null;
  return { ...m, ...(m.lang != null ? { lang: normalizeLang(m.lang) } : {}), meta: metaOf(rec) };
}

/* ---------------- fitting a conversation's reports into its size cap ---------------- */
const sizeOf = (records) => JSON.stringify({ v: FORMAT, records }).length;
// a model reduced to what identifies it: title, scope line, headline figures, summary; the sections (tables, charts, findings) are the heavy part
const stubModel = (m) => ({ ...m, sections: [], stubbed: true });
// → { records, notes:[{ msgId, step:'language'|'detail' }] } — drops, oldest first: first the language that was not written in, then the sections. The newest record is kept whole unless it alone exceeds the cap.
export function fitRecords(records, cap = LIMITS.reportChars) {
  const out = JSON.parse(JSON.stringify(records)); const notes = [];
  if (sizeOf(out) <= cap) return { records: out, notes };
  const order = Object.values(out).sort((a, b) => String(a.generatedAt).localeCompare(String(b.generatedAt))).map((r) => r.msgId);
  const older = order.slice(0, -1);
  for (const id of older) { const r = out[id]; const ls = Object.keys(r.models); if (ls.length > 1) { r.models = { [r.lang in r.models ? r.lang : ls[0]]: r.models[r.lang in r.models ? r.lang : ls[0]] }; r.prune = { ...(r.prune || {}), language: true }; r.check = checksum(JSON.stringify(r.models)); notes.push({ msgId: id, step: 'language' }); if (sizeOf(out) <= cap) return { records: out, notes }; } }
  for (const id of older) { const r = out[id]; if (r.prune?.detail) continue; const l = Object.keys(r.models)[0]; r.models = { [l]: stubModel(r.models[l]) }; r.prune = { ...(r.prune || {}), detail: true, language: true }; r.check = checksum(JSON.stringify(r.models)); notes.push({ msgId: id, step: 'detail' }); if (sizeOf(out) <= cap) return { records: out, notes }; }
  return { records: out, notes, over: true };
}

/* ---------------- the store ---------------- */
// Everything below takes the signed-in user's key; with no key (nobody signed in) nothing is read or written.
export function createStore({ storage = defaultStorage(), limits = LIMITS } = {}) {
  const read = (k) => { try { const t = storage?.getItem(k); return t ? JSON.parse(t) : null; } catch { return null; } };
  const write = (k, v) => { try { storage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch { return false; } };
  const drop = (k) => { try { storage?.removeItem(k); } catch { /* storage unavailable */ } };

  const listConvs = (uk) => {
    if (!uk || !storage) return [];
    const v = read(indexKey(uk)); if (!v || v.v !== FORMAT || !Array.isArray(v.convs)) return [];
    return v.convs.filter((c) => c && c.id && Array.isArray(c.messages) && c.owner === uk); // a conversation filed under another user is never listed
  };
  // the light list; conversations that left it (more than the limit, or deleted) lose their saved reports too
  const saveConvs = (uk, convs) => {
    if (!uk || !storage) return { ok: false, error: 'unavailable' };
    const list = convs.slice(0, limits.convs).map((c) => ({ ...c, owner: uk, messages: c.messages.map(({ model, progress, amodel, ...m }) => (m.view ? { ...m, view: cleanView(m.view) } : m)) })); // a message's `view` (chart type, parts shown, per-chart configs — src/data/reportView.js) is kept, reduced to its valid parts
    const before = listConvs(uk).map((c) => c.id); const keep = new Set(list.map((c) => c.id));
    const ok = write(indexKey(uk), { v: FORMAT, convs: list });
    if (ok) before.filter((id) => !keep.has(id)).forEach((id) => drop(repKey(uk, id)));
    return { ok, error: ok ? null : 'quota' };
  };
  const loadReports = (uk, convId) => { // → { records, unreadable:[msgId] }
    const out = { records: {}, unreadable: [] }; if (!uk || !storage) return out;
    const v = read(repKey(uk, convId)); if (!v || v.v !== FORMAT || !v.records) return out;
    for (const [id, rec] of Object.entries(v.records)) {
      if (rec && rec.owner && rec.owner !== uk) continue; // a record filed under another user is never returned (nor reported)
      if (rec && rec.convId === convId && verifyRecord(rec)) out.records[id] = rec; else out.unreadable.push(id);
    }
    return out;
  };
  // all records of ONE conversation are written together, within the per-conversation cap; → { ok, records (what was actually saved), notes (what was reduced), error }
  const saveReports = (uk, convId, records, { cap = limits.reportChars } = {}) => {
    if (!uk || !storage) return { ok: false, error: 'unavailable', records, notes: [] };
    let c = cap; let fitted = fitRecords(records, c);
    for (let i = 0; i < 3; i += 1) {
      if (write(repKey(uk, convId), { v: FORMAT, records: fitted.records })) return { ok: true, records: fitted.records, notes: fitted.notes, over: !!fitted.over };
      c = Math.floor(Math.min(c, sizeOf(fitted.records)) * 0.55); fitted = fitRecords(fitted.records, c); // the browser refused: shrink the older versions and try again
    }
    return { ok: false, error: 'quota', records, notes: [] };
  };
  const removeReports = (uk, convId) => { if (uk) drop(repKey(uk, convId)); };
  const removeConv = (uk, convId) => { if (!uk || !storage) return; removeReports(uk, convId); const convs = listConvs(uk).filter((c) => c.id !== convId); write(indexKey(uk), { v: FORMAT, convs }); };
  const usage = (uk) => { if (!uk || !storage) return 0; let n = 0; for (let i = 0; i < (storage.length || 0); i += 1) { const k = storage.key(i); if (k && (k === indexKey(uk) || k.startsWith(`${KEYS.reports}:${uk}:`))) n += (storage.getItem(k) || '').length; } return n; };
  return { listConvs, saveConvs, loadReports, saveReports, removeReports, removeConv, usage };
}

/* ---------------- versions of one conversation's reports ---------------- */
// the report records of a conversation in the order they were generated (a refresh or a modified request each adds one; none is replaced)
export const versionsOf = (records) => Object.values(records || {}).filter((r) => r.kind === 'report').sort((a, b) => (a.version || 0) - (b.version || 0) || String(a.generatedAt).localeCompare(String(b.generatedAt)));
export const nextVersion = (records) => versionsOf(records).reduce((m, r) => Math.max(m, r.version || 0), 0) + 1;
