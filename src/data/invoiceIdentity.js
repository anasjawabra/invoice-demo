// INVOICE COMPOSITE KEY (مفتاح الفاتورة المركّب) — the ONE place that builds, validates, parses and resolves an invoice's business identity. Used by the server, the client and the tests.
//
// An invoice identifier alone is NOT globally unique: it can repeat between Amanahs. The business key is
//     invoice identifier  +  GFS code  +  Amanah identifier  [+ municipality identifier]
// · invoice identifier = the source «رقم الفاتورة» (ENT_REVENUES.ACCOUNT_NO). It is NOT the SADAD number and NOT the biller number: those stay separate fields and are never substituted for a component
//   without a verified source mapping.
// · GFS code = the revenue account (ENT_REVENUES.GFS_MAIN_CODE / TB_DIM_GFS_ACCOUNTS).
// · Amanah identifier = the stable source code (TB_DIM_BALADYAT.AMANA_NO), never an entity name. REQUIRED.
// · municipality identifier = BALADYA_KEY / MAIN_BALADYA_NO / BRANCH_BALADYA_NO. OPTIONAL and only meaningful INSIDE its Amanah (municipality codes repeat across Amanahs, so they are never used alone and
//   never interchangeable with the Amanah identifier). Whether the key needs it for uniqueness is an open data question (docs/invoice-composite-key.md).
// Components are TEXT: leading zeros and long digit strings are preserved; a JavaScript number that is not a safe integer is rejected (precision would be lost). A missing component is reported explicitly —
// an incomplete key never becomes an identity. Cross-source records are never merged because their numbers match.
export const KEY_VERSION = 'ick1';
export const REQUIRED = ['invoiceId', 'gfsCode', 'amanahId'];
export const OPTIONAL = ['municipalityId'];
const TAG = { invoiceId: 'inv', gfsCode: 'gfs', amanahId: 'am', municipalityId: 'mu' };
const NAME_OF_TAG = Object.fromEntries(Object.entries(TAG).map(([k, v]) => [v, k]));

// a component as text; null when absent; 'imprecise' when a number cannot be held exactly
function norm(v) {
  if (v == null) return { v: null };
  if (typeof v === 'number') return Number.isSafeInteger(v) ? { v: String(v) } : { bad: 'imprecise' };
  const t = String(v).trim(); return t === '' ? { v: null } : { v: t };
}
// encoded so that the separators «|» and «=» (and «%») can never occur inside a value
const enc = (s) => encodeURIComponent(s);
const dec = (s) => { try { return decodeURIComponent(s); } catch { return null; } };

/** parts = { invoiceId, gfsCode, amanahId, municipalityId? } → { complete, key, parts, missing, invalid } — key is null unless every required component is present and valid */
export function compositeKey(parts = {}) {
  const out = {}; const missing = []; const invalid = [];
  for (const f of [...REQUIRED, ...OPTIONAL]) {
    const n = norm(parts[f]);
    if (n.bad) { invalid.push(f); out[f] = null; } else { out[f] = n.v; if (n.v == null && REQUIRED.includes(f)) missing.push(f); }
  }
  const complete = missing.length === 0 && invalid.length === 0;
  const key = complete ? [KEY_VERSION, ...Object.keys(TAG).filter((f) => out[f] != null).map((f) => `${TAG[f]}=${enc(out[f])}`)].join('|') : null;
  return { complete, key, parts: out, missing, invalid };
}
/** the strict inverse: a key string → its parts, or null when it is not a well-formed composite key (a legacy id, a bare number, a malformed string) */
export function parseCompositeKey(s) {
  const t = String(s ?? '').trim(); const seg = t.split('|'); if (seg[0] !== KEY_VERSION) return null;
  const parts = {};
  for (const x of seg.slice(1)) { const m = /^(inv|gfs|am|mu)=(.*)$/.exec(x); if (!m) return null; const f = NAME_OF_TAG[m[1]]; if (f in parts) return null; const d = dec(m[2]); if (d == null || d === '') return null; parts[f] = d; }
  const r = compositeKey(parts); return r.complete && r.key === t ? r.parts : null;
}
export const isCompositeKey = (s) => parseCompositeKey(s) !== null;
/** the same invoice only when BOTH keys are complete and identical — an incomplete key is never equal to anything (not even to itself) */
export const sameInvoice = (a, b) => { const x = compositeKey(a); const y = compositeKey(b); return x.complete && y.complete && x.key === y.key; };

/** what a user needs to tell candidates apart: invoice identifier, GFS code, Amanah and municipality, source, amount and status */
export const candidateSummary = (c) => ({ id: c.id ?? null, compositeKey: c.compositeKey ?? null, invoiceNo: c.invoiceNo ?? c.invoiceId ?? null, gfsCode: c.gfsCode ?? null, amanahId: c.amanahId ?? null, amanahAr: c.amanahAr ?? null, amanahEn: c.amanahEn ?? null,
  municipalityId: c.municipalityId ?? null, municipalityAr: c.municipalityAr ?? null, municipalityEn: c.municipalityEn ?? null, source: c.source ?? null, amount: c.gross ?? c.amount ?? null, status: c.cls ?? c.status ?? null });

/** a search by number alone: unique → open it; several → NEVER pick one, return them all */
export const resolveByNumber = (candidates) => ({ status: candidates.length === 0 ? 'none' : candidates.length === 1 ? 'unique' : 'ambiguous', matches: candidates });

/** a persisted reference (a legacy id or a bare number) → the composite key, only when it resolves to exactly one invoice; otherwise it is flagged and kept as it is (never reassigned to the first match) */
export function migrateReference(ref, candidates) {
  if (isCompositeKey(ref)) return { status: 'already_composite', key: ref };
  if (candidates.length === 1) { const k = candidates[0].compositeKey; return k ? { status: 'migrated', key: k } : { status: 'incomplete_key', missing: candidates[0].missing || [], keep: ref }; }
  return candidates.length === 0 ? { status: 'unresolved', keep: ref } : { status: 'ambiguous', keep: ref, candidates: candidates.map(candidateSummary) };
}

/* ---- demo mapping (synthetic world): stable codes, NOT names. They stand in for AMANA_NO / BALADYA_KEY until the real source codes are mapped (documented as unresolved). ---- */
export const demoAmanahId = (ent) => (ent == null || ent < 0 ? null : String(ent + 1).padStart(3, '0'));
export const demoMunicipalityId = (muni) => (muni == null || muni < 0 || muni > 2 ? null : String(muni + 1).padStart(3, '0')); // local to its Amanah: «001» exists under every Amanah
